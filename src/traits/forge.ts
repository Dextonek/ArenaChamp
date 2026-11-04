import type { CastMods, Trait, TraitHit, TraitView } from './types';

/** Heat: at most this many stacks on the enemy, each batch lasting this long. A spell on 3 Heat is Tempered. */
export const HEAT_MAX = 3;
export const HEAT_SECONDS = 5;
/** Forge Roar: how long the slam stays armed, and its extra damage and knock-up. */
export const SLAM_SECONDS = 3;
export const SLAM_DAMAGE = 35;
export const SLAM_KNOCKUP = 0.5;
export const SLAM_TEMPERED_KNOCKUP = 0.8;
/** Molten Core: seconds, extra damage per basic attack, extra reach (m). Quench: the hold while it plants him. */
export const CORE_SECONDS = 6;
export const CORE_DAMAGE = 25;
export const CORE_REACH = 0.4;
export const QUENCH_HOLD = 0.6;
/** What a Tempered spell adds. */
export const TEMPER_STUN = 0.75;
export const TEMPER_VULNERABLE = { amount: 0.2, seconds: 3 };

const BASE_ATTACK = 18;

/**
 * What Brannoc's spells and effects share, per figure (the effects play on both screens). Written from his own client
 * and, on the other screen, from `ownChanged`. Times are `performance.now()` milliseconds so an effect started later
 * can tell a stale value from a fresh one.
 */
export interface ForgeFx {
  /** When the slam was last spent or ran out (Forge Roar's hammer stops glowing). */
  slamOffAt: number;
  /** When the core last ended (burnt out or Quenched). */
  coreOffAt: number;
  /** Basic attacks swung while the core burned, counted over the whole round (Molten Core draws a cone for each). */
  swings: number;
  /** Seconds the core had left when it was Quenched, and when that was decided. */
  quenchLeft: number;
  quenchAt: number;
}

export const forgeFx = new WeakMap<object, ForgeFx>();

export function fxOf(fig: object): ForgeFx {
  let f = forgeFx.get(fig);
  if (!f) { f = { slamOffAt: 0, coreOffAt: 0, swings: 0, quenchLeft: 0, quenchAt: 0 }; forgeFx.set(fig, f); }
  return f;
}

/** His own client only: the slam / the core is running now. */
const slamOn = (t: TraitView) => t.time < (t.mem.slamUntil ?? 0);
const coreOn = (t: TraitView) => t.time < (t.mem.coreUntil ?? 0);

function endSlam(t: TraitView) {
  t.mem.slamUntil = 0;
  t.show('slam', 0);
  fxOf(t.self()).slamOffAt = performance.now();
}

function endCore(t: TraitView) {
  t.mem.coreUntil = 0;
  t.show('core', 0);
  fxOf(t.self()).coreOffAt = performance.now();
}

const swallowed = (k: string) => k === 'slow' || k === 'root' || k === 'knockup';

/**
 * Brannoc (tank). Passive Hot Iron: his hits put Heat on the enemy (3 at most, 5 s, shown as pips over them: `addStacks`
 * in `dealt`). His next spell that lands on a 3-Heat enemy is Tempered: it clears the Heat and gets its bonus (Q: stunned
 * 0.75 s instead of the slow; E: the enemy takes 20% more for 3 s; R's Quench: stunned 0.75 s). A spell that Tempered adds
 * no Heat of its own, and only the first hit of a cast counts (`hit.cast`), so a burn tick never Tempers. It is decided in
 * `dealt` because online that is the screen that knows the true Heat.
 * Q Chain Hammer adds no Heat. W Forge Roar (kit buff: +30% armour 3 s) arms a slam (`mem.slamUntil`, shown as 'slam'): his
 * next basic attack is power (18 + 35) / 18 with a 0.5 s knock-up and adds 2 Heat; on a 3-Heat enemy it is a 0.8 s knock-up
 * and clears the Heat. E Red-Hot Rivet adds 2 Heat. No speed buff anywhere.
 * R Molten Core: 6 s (`mem.coreUntil`, shown as 'core'): +25 damage per basic attack (a power ratio), 0.4 m more reach
 * (3 m), +1 Heat per attack hit, and slows, roots and knock-ups are swallowed in `taken`, from the hit's options and from
 * the cast's mods. Each swing is counted as 'slag' (the effect draws a 3 m cone for it on both screens). The recast Quench
 * (opens 0.3 s later) ends the core, works out the seconds left (`forgeFx.quenchLeft`, shown as 'quench' in tenths) and
 * holds him 0.6 s; the effect (`src/spells/targeted/moltenCore.ts`) does the ring and the burst of 30 + 10 per second left.
 */
export const forgeTrait: Trait = {
  // The CPU against him walks away from the Molten Core: he is no faster.
  enemyGoal(t) {
    const e = t.enemy();
    if (!e || !coreOn(t) || t.enemyDistance() > 5) return null;
    const me = t.self().group.position, p = e.group.position;
    return { x: p.x + (p.x - me.x), z: p.z + (p.z - me.z) };
  },
  passive: {
    name: 'Hot Iron',
    blurb: 'His hits put Heat on the enemy (3 at most, 5 s, shown as pips). His next spell on a 3-Heat enemy is Tempered: it gets its bonus and clears the Heat.',
  },
  ownLook: {
    slam: { color: '#ffb03a', shape: 'gem' },
    core: { color: '#ff5a12', shape: 'mark' },
  },
  ownChanged(t, name, n) {
    // The other screen: the effects read these from the per-figure record.
    const fx = fxOf(t.self());
    if (name === 'slam' && n === 0) fx.slamOffAt = performance.now();
    if (name === 'core' && n === 0) fx.coreOffAt = performance.now();
    if (name === 'slag') fx.swings = n;
    if (name === 'quench' && n > 0) { fx.quenchLeft = n / 10; fx.quenchAt = performance.now(); }
  },
  speed: 3.6,
  attack: { kind: 'melee', range: 2.6, damage: BASE_ATTACK, interval: 1.6, windup: 0.4, speed: 0, look: 'smash' },
  recast: { slot: 3, window: CORE_SECONDS, arm: 0.3, name: 'Quench', power: 1, replay: true, aiWait: true },
  attackMods(t) {
    const m: Partial<CastMods> = {};
    let extra = 0;
    if (slamOn(t)) {
      endSlam(t);
      extra += SLAM_DAMAGE;
      m.status = { kind: 'knockup', seconds: SLAM_KNOCKUP };
      t.say('SLAM', '#ffb03a');
    }
    if (coreOn(t)) {
      extra += CORE_DAMAGE;
      const n = (t.mem.swings ?? 0) + 1;
      t.mem.swings = n;
      fxOf(t.self()).swings = n;
      t.show('slag', n);
    }
    if (extra) m.power = (BASE_ATTACK + extra) / BASE_ATTACK;
    return m;
  },
  attackReach: (t) => (coreOn(t) ? CORE_REACH : 0),
  afterCast(t, slot) {
    if (slot === 1) {
      t.mem.slamUntil = t.time + SLAM_SECONDS;
      fxOf(t.self()).slamOffAt = 0;
      t.show('slam', 1);
    }
    if (slot === 3) {
      t.mem.coreUntil = t.time + CORE_SECONDS;
      fxOf(t.self()).coreOffAt = 0;
      t.show('core', 1);
    }
  },
  recastAct(t, slot) {
    if (slot !== 3) return;
    // Quench: the core ends, and what was left of it is the burst's strength.
    const left = Math.max(0, (t.mem.coreUntil ?? 0) - t.time);
    const fx = fxOf(t.self());
    fx.quenchLeft = left;
    fx.quenchAt = performance.now();
    endCore(t);
    // A zero first, so two Quenches with the same number still reach the other screen as a change.
    t.show('quench', 0);
    t.show('quench', Math.max(1, Math.round(left * 10)));
    t.hold(QUENCH_HOLD);
    t.say('QUENCH', '#6fe0ff');
  },
  tick(t) {
    if (t.mem.slamUntil && !slamOn(t)) endSlam(t);
    if (t.mem.coreUntil && !coreOn(t)) endCore(t);
  },
  dealt(t, hit) {
    if (!hit.victimIsHero) return;
    if (hit.kind === 'attack') {
      // The slam carries a knock-up in its mods; a core swing adds one Heat (the stance is shown, so both screens know).
      const slam = hit.mods.status?.kind === 'knockup';
      if (slam && t.stacks('heat') >= HEAT_MAX) {
        t.clearStacks('heat');
        hit.opts.status = { kind: 'knockup', seconds: SLAM_TEMPERED_KNOCKUP };
        t.say('TEMPERED', '#ffb03a');
        return;
      }
      const n = (slam ? 2 : 0) + (t.own('core') > 0 ? 1 : 0);
      if (n > 0) t.addStacks('heat', n, HEAT_SECONDS, HEAT_MAX);
      return;
    }
    if (hit.kind !== 'spell' || hit.slot === undefined || hit.slot > 3) return;
    // Once per cast: a burn tick, or a second hit of the same cast, neither Tempers nor adds Heat.
    if (hit.cast !== undefined) {
      if (t.mem[`c${hit.slot}`] === hit.cast) return;
      t.mem[`c${hit.slot}`] = hit.cast;
    }
    if (t.stacks('heat') >= HEAT_MAX) {
      temper(t, hit);
      return;
    }
    if (hit.slot === 2) t.addStacks('heat', 2, HEAT_SECONDS, HEAT_MAX);
  },
  taken(t, hit) {
    // Molten Core: slows, roots and knock-ups do nothing to him. That is the whole immunity.
    if (!coreOn(t)) return;
    if (hit.opts.status && swallowed(hit.opts.status.kind)) delete hit.opts.status;
    // The cast's own mods (a trait's status on every hit) are added after this hook, so strip them there too.
    if (hit.mods.status && swallowed(hit.mods.status.kind)) delete hit.mods.status;
  },
};

/** The Tempered bonus of the slot that hit: the Heat is spent. */
function temper(t: TraitView, hit: TraitHit) {
  t.clearStacks('heat');
  t.say('TEMPERED', '#ffb03a');
  if (hit.slot === 0 || hit.slot === 3) hit.opts.status = { kind: 'stun', seconds: TEMPER_STUN };
  if (hit.slot === 2) hit.opts.debuff = { kind: 'vulnerable', amount: TEMPER_VULNERABLE.amount, seconds: TEMPER_VULNERABLE.seconds };
}
