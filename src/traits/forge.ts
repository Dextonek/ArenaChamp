import type { CastMods, Trait, TraitView } from './types';

/**
 * Heat (the rework of 2026-11-12, pipeline/designs/heroes-rework.md): his own bar, 0 to `HEAT_MAX`. Q, W and E have no
 * cooldown; each adds `HEAT_GAIN` and is cast at the power of the Heat it found (`heatPower`). Heat cools `COOL_RATE` a
 * second once he has cast nothing for `COOL_AFTER` s.
 */
export const HEAT_MAX = 100;
export const HEAT_GAIN = [40, 30, 30, 0];
export const COOL_AFTER = 2.5;
export const COOL_RATE = 10;
/** A spell's power at 0 Heat and at white heat; in between it runs straight. */
export const POWER_COLD = 0.55;
export const POWER_WHITE = 1.15;
/**
 * White heat (the bar full): it stays until he Quenches. He burns `BURN` HP each second and each Q, W, E costs `WHITE_COST`
 * HP; slows, roots and knock-ups do nothing to him and each basic attack deals `WHITE_ATTACK` more.
 */
export const BURN = 14;
export const WHITE_COST = 35;
export const WHITE_ATTACK = 15;
/** Quench (R): the burst is 30 + 10 per `quenchLeft` second in the effect; this many of those seconds per point of Heat. */
export const QUENCH_PER_HEAT = 0.05;
export const QUENCH_HOLD = 0.6;
export const QUENCH_STUN = 0.75;
/** Forge Roar: how long the slam stays armed, and its extra damage and knock-up. */
export const SLAM_SECONDS = 3;
export const SLAM_DAMAGE = 30;
export const SLAM_KNOCKUP = 0.5;
/** The old stance's length: only the VFX tool's Molten Core still plays it (`src/spells/targeted/moltenCore.ts`). */
export const CORE_SECONDS = 6;

const BASE_ATTACK = 18;

/**
 * What Brannoc's spells and effects share, per figure (the effects play on both screens). Written from his own client
 * and, on the other screen, from `ownChanged`. Times are `performance.now()` milliseconds so an effect started later
 * can tell a stale value from a fresh one.
 */
export interface ForgeFx {
  /** When the slam was last spent or ran out (Forge Roar's hammer stops glowing). */
  slamOffAt: number;
  /** When the core last ended (the VFX tool's stance; a Quench ends it). */
  coreOffAt: number;
  /** Basic attacks swung while the old core burned (the VFX tool's stance draws a cone for each). */
  swings: number;
  /**
   * The Quench's strength in the effect's own unit (seconds the old core had left: 10 damage each), and when the trait
   * decided it. A fresh `quenchAt` also tells the effect that this cast is the Quench.
   */
  quenchLeft: number;
  quenchAt: number;
}

export const forgeFx = new WeakMap<object, ForgeFx>();

export function fxOf(fig: object): ForgeFx {
  let f = forgeFx.get(fig);
  if (!f) { f = { slamOffAt: 0, coreOffAt: 0, swings: 0, quenchLeft: 0, quenchAt: 0 }; forgeFx.set(fig, f); }
  return f;
}

/** His own client only: the slam is armed / the hammer is white-hot now. */
const slamOn = (t: TraitView) => t.time < (t.mem.slamUntil ?? 0);
const white = (t: TraitView) => !!t.mem.white;

/** The power of a spell cast at `heat`. */
export const heatPower = (heat: number) => POWER_COLD + (POWER_WHITE - POWER_COLD) * Math.max(0, Math.min(1, heat / HEAT_MAX));

function endSlam(t: TraitView) {
  t.mem.slamUntil = 0;
  t.show('slam', 0);
  fxOf(t.self()).slamOffAt = performance.now();
}

const swallowed = (k: string) => k === 'slow' || k === 'root' || k === 'knockup';

/** How the CPU plays him: a breath between spells (he swings in it), how long it rides white heat, where it Quenches. */
const AI_REST = 1.1;
const AI_RIDE = 3.5;
const AI_QUENCH_REACH = 2.5;
/**
 * In reach of his hammer the CPU casts as a swing lands and not while the next one is on its way up: a cast drops a
 * wind-up (the player's hero's does, and so a person's; the computer's opponent's swing lands anyway, `src/duel.ts`).
 * Within `AI_SWING_REACH` m it casts only in the `AI_AFTER_SWING` s after a swing, or when none has come for `AI_NO_SWING` s.
 */
const AI_SWING_REACH = 3.0;
const AI_AFTER_SWING = 0.5;
const AI_NO_SWING = 2.4;

/**
 * Brannoc (tank), reworked round one rule: Heat. Q, W and E have no cooldown (the kit's 0.5 s is only the gap the game
 * server asks between two casts of a slot). Each adds Heat to his own bar (`resource`) and is cast at the power of the
 * Heat it found: x0.55 cold, x1.15 white-hot (`castMods`, so the power travels with the cast). Q adds 40, W and E 30, so
 * the third spell in a row turns the hammer white. Heat cools 10 a second once he has cast nothing for 2.5 s (`tick`).
 * White heat: the bar full. It does not cool; it stays until he Quenches. He burns 14 HP each second (`payHp`, in whole
 * seconds, which cannot take his last HP) and each Q, W, E costs him 35 HP in place of Heat; slows, roots and knock-ups do
 * nothing to him (`taken`) and every basic attack deals 15 more (`attackMods`). Shown as 'core' (a pip and a white ring).
 * R is the Quench at any Heat (the drawn Quench of `moltenCore.ts`, told by a fresh `forgeFx.quenchAt`): he plants himself
 * 0.6 s, the 3 m ring bursts for 30 + 0.5 per point of Heat (80 at white heat), stuns 0.75 s if he was white-hot (a status
 * in the cast's mods), and the hammer is cold again. Its 11 s cooldown is the game server's: one ultimate in 10 s.
 * W Forge Roar (kit buff: +30% armour 3 s) arms a slam (`mem.slamUntil`, shown as 'slam'): his next basic attack is
 * +30 with a 0.5 s knock-up.
 * The CPU (`aiHold`): a breath between spells so he swings, no Chain Hammer on an enemy already in reach, no second roar
 * on an armed slam, a roar between two rivets in reach, no spell that would turn the hammer white while the Quench is far
 * from ready; white-hot it pays for spells only above half HP, rides the heat 3.5 s, then Quenches with the enemy inside
 * the ring (anywhere under 25% HP).
 * Measured 2026-11-12 (docs/balance/rework-brannoc-after.html): 53% against the benchmark heroes on both sides and 34% as
 * the player's hero alone; a second run of the same code gave 59% and 43%. Without the CPU's breath between spells: 44%.
 */
export const forgeTrait: Trait = {
  aiHold(t, slot, dist) {
    const hp = t.hp() / Math.max(1, t.maxHp());
    if (slot === 3) {
      if (!white(t)) return true;
      if (hp < 0.25) return false;
      if (dist > AI_QUENCH_REACH) return true;
      return t.time - (t.mem.whiteAt ?? 0) < AI_RIDE && hp > 0.45;
    }
    if (t.time < (t.mem.aiRest ?? 0)) return true;
    if (dist <= AI_SWING_REACH) {
      const since = t.time - (t.mem.swungAt ?? -9);
      if (since > AI_AFTER_SWING && since < AI_NO_SWING) return true;
    }
    if (white(t)) return hp < 0.5;
    if (t.res + HEAT_GAIN[slot] >= HEAT_MAX && t.cooldownLeft(3) > 2) return true;
    if (slot === 1 && slamOn(t)) return true;
    // In reach he roars and swings before the next rivet, so every spell is played.
    if (slot === 2 && dist <= 3.4 && t.mem.last === 3 && !slamOn(t)) return true;
    return slot === 0 && dist < 3.2;
  },
  // The CPU against him steps back from white heat: he is no faster, he is burning, and the Quench reaches 3 m.
  enemyGoal(t) {
    const e = t.enemy();
    if (!e || !white(t) || t.enemyDistance() > 4) return null;
    const me = t.self().group.position, p = e.group.position;
    return { x: p.x + (p.x - me.x), z: p.z + (p.z - me.z) };
  },
  passive: {
    name: 'Heat',
    blurb: 'No cooldowns. Each spell heats his hammer, and a hot spell hits harder: 55% cold, 115% white-hot. At white heat he burns 14 HP a second and pays 35 HP a spell, nothing slows or roots him and his attacks deal +15, until he Quenches. Heat cools when he rests 2.5 s.',
  },
  resource: { name: 'Heat', max: HEAT_MAX, color: '#ff5a12' },
  ownLook: {
    slam: { color: '#ffb03a', shape: 'gem' },
    core: { color: '#fff3d0', shape: 'mark' },
  },
  ownChanged(t, name, n) {
    // The other screen: the effects read these from the per-figure record.
    const fx = fxOf(t.self());
    if (name === 'slam' && n === 0) fx.slamOffAt = performance.now();
    if (name === 'core' && n === 0) fx.coreOffAt = performance.now();
    if (name === 'quench' && n > 0) { fx.quenchLeft = n / 10; fx.quenchAt = performance.now(); }
  },
  speed: 3.6,
  attack: { kind: 'melee', range: 2.6, damage: BASE_ATTACK, interval: 1.6, windup: 0.4, speed: 0, look: 'smash' },
  castMods(t, slot) {
    const m: Partial<CastMods> = {};
    if (slot === 3) {
      // The Quench: what the Heat was is the burst's strength; white heat also stuns. The hammer is cold again.
      const left = t.res * QUENCH_PER_HEAT;
      const fx = fxOf(t.self());
      fx.quenchLeft = left;
      fx.quenchAt = performance.now();
      fx.coreOffAt = fx.quenchAt;
      // A zero first, so two Quenches with the same number still reach the other screen as a change.
      t.show('quench', 0);
      t.show('quench', Math.max(1, Math.round(left * 10)));
      if (white(t)) m.status = { kind: 'stun', seconds: QUENCH_STUN };
      t.mem.white = 0;
      t.show('core', 0);
      t.addRes(-HEAT_MAX);
      t.hold(QUENCH_HOLD);
      t.say('QUENCH', '#6fe0ff');
      return m;
    }
    m.power = heatPower(t.res);
    if (white(t)) t.payHp(WHITE_COST);
    else t.addRes(HEAT_GAIN[slot]);
    return m;
  },
  afterCast(t, slot) {
    t.mem.castAt = t.time;
    t.mem.last = slot + 1;
    t.mem.aiRest = t.time + AI_REST;
    if (slot === 1) {
      t.mem.slamUntil = t.time + SLAM_SECONDS;
      fxOf(t.self()).slamOffAt = 0;
      t.show('slam', 1);
    }
  },
  attackMods(t) {
    const m: Partial<CastMods> = {};
    let extra = 0;
    t.mem.swungAt = t.time;
    if (slamOn(t)) {
      endSlam(t);
      extra += SLAM_DAMAGE;
      m.status = { kind: 'knockup', seconds: SLAM_KNOCKUP };
      t.say('SLAM', '#ffb03a');
    }
    if (white(t)) extra += WHITE_ATTACK;
    if (extra) m.power = (BASE_ATTACK + extra) / BASE_ATTACK;
    return m;
  },
  tick(t, dt) {
    if (t.mem.slamUntil && !slamOn(t)) endSlam(t);
    if (!white(t) && t.res >= HEAT_MAX) {
      t.mem.white = 1;
      t.mem.whiteAt = t.time;
      t.mem.burnAt = t.time + 1;
      t.show('core', 1);
      t.say('WHITE HEAT', '#fff3d0');
    }
    if (white(t)) {
      // The burn, a whole second at a time (each is one number over his head and one message online).
      if (t.time >= (t.mem.burnAt ?? 0)) {
        t.mem.burnAt = t.time + 1;
        t.payHp(BURN);
      }
    } else if (t.res > 0 && t.time - (t.mem.castAt ?? 0) >= COOL_AFTER) t.addRes(-COOL_RATE * dt);
    // The ring under him: 1 warm, 2 red-hot (both screens draw it from this).
    t.show('glow', white(t) ? 0 : t.res >= 67 ? 2 : t.res >= 34 ? 1 : 0);
  },
  taken(t, hit) {
    // White heat: slows, roots and knock-ups do nothing to him. That is the whole immunity.
    if (!white(t)) return;
    if (hit.opts.status && swallowed(hit.opts.status.kind)) delete hit.opts.status;
    // The cast's own mods (a trait's status on every hit) are added after this hook, so strip them there too.
    if (hit.mods.status && swallowed(hit.mods.status.kind)) delete hit.mods.status;
  },
  ring(t) {
    if (t.own('core') > 0) return { radius: 1.25, color: '#fff3d0', opacity: 0.85 };
    const g = t.own('glow');
    return g > 0 ? { radius: 1.05, color: g > 1 ? '#ff5a12' : '#b8431a', opacity: g > 1 ? 0.6 : 0.35 } : null;
  },
  badge: (t) => (t.own('core') > 0 ? 'WHITE' : t.res >= 1 ? `${Math.round(heatPower(t.res) * 100)}%` : ''),
};
