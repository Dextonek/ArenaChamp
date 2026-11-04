import type { Trait, TraitHit, TraitView } from './types';
import { icicleStandingLook } from '../effects/parts/frost';

/** Chill: at most this many stacks on the enemy, each batch lasting this long. At `SLOW_AT` or more her hit also slows. */
export const CHILL_MAX = 5;
export const CHILL_SECONDS = 4;
export const SLOW_AT = 3;
export const SLOW_SECONDS = 2;
/** The freeze at 5 Chill: seconds stunned, and the multiplier on the hit that freezes. */
export const FREEZE_SECONDS = 0.9;
export const FREEZE_MUL = 1.3;
/** Chill each hit adds. */
export const CHILL_ATTACK = 1;
export const CHILL_ICICLE = 2;
export const CHILL_SHATTER = 1;
export const CHILL_HOARFROST = 2;
export const CHILL_RIME = 2;

/** Icicle (Q): range, speed, wind-up, how long it stands in the floor, and the recast (Shatter). */
export const ICICLE_RANGE = 11;
export const ICICLE_SPEED = 22;
export const ICICLE_WIND = 0.3;
export const ICICLE_STAY = 2;
export const SHATTER_ARM = 1.6;
export const SHATTER_WINDOW = 2.8;
export const SHATTER_RADIUS = 2;

/** Rime Armour (E): armour amount (the kit's buff) and seconds. */
export const RIME_ARMOUR = 0.4;
export const RIME_SECONDS = 3;

/** Winter's Shatter (R): the wind-up, the base damage and the damage per Chill it spends. */
export const WINTER_WIND = 0.8;
export const WINTER_BASE = 50;
export const WINTER_PER_CHILL = 30;

/**
 * The icicle Isolde's Q leaves standing, per figure (the effect plays on both screens, and the CPU's side reuses one effect
 * for every cast, so the spot lives here and not in the effect). The effect writes it at the cast, on both screens, from the
 * cast's start and aim; `marks` draws the standing icicle from it and the recast (the effect again) reads it. Times are
 * `performance.now()` milliseconds. `bornAt`: when the bolt reaches the end of its flight and sticks; `until`: 2 s later.
 * `shattered`: the recast was pressed (set at its cast, which is what lets `dealt` tell a shatter hit from the bolt's);
 * `gone`: the icicle is spent, so the mark drops.
 */
export interface IcicleRecord { x: number; z: number; yaw: number; castAt: number; bornAt: number; until: number; shattered: boolean; gone: boolean }
export const icicles = new WeakMap<object, IcicleRecord>();

/** Her own client: Rime Armour is up now. */
const rimeOn = (t: TraitView) => t.time < (t.mem.rimeUntil ?? 0);
/** While the enemy is frozen it gains no Chill at all (the freeze is decided in `dealt`, on the screen of the hit). */
const frozen = (t: TraitView) => t.time < (t.mem.frozenUntil ?? 0);

/**
 * Isolde (controller). Passive Deep Winter: her hits put Chill on the enemy (5 at most, 4 s, shown as snowflake pips:
 * `addStacks` in `dealt`, which online runs on the victim's screen, where the truth lives). Basic attacks add 1, Q 2, its
 * Shatter 1, W 2. A hit that leaves 3 or more Chill also slows (2 s) when it carries no status of its own. With 5 Chill on the
 * enemy BEFORE a hit that is not R, that hit freezes them: +30% damage, stun 0.9 s, the Chill clears, and until the freeze
 * ends (`mem.frozenUntil`) no Chill is added. R spends the Chill instead: +30 per stack on its base 50, and clears them, so a
 * frozen enemy (no Chill) takes only 50 and R never freezes.
 * Q Icicle (`src/spells/targeted/icicle.ts`) leaves the icicle in `icicles` for 2 s; its recast Shatter opens 1.6 s after the
 * cast (`arm`) and stays open to 2.8 s. E Rime Armour: the kit's +40% armour for 3 s, shown as a pip; while it runs a basic
 * attack that hits her gives the attacker 2 Chill (`taken`, her own client). W Hoarfrost and R Winter's Shatter are targeted.
 */
export const frostTrait: Trait = {
  passive: {
    name: 'Deep Winter',
    blurb: 'Her hits put Chill on the enemy (5 at most, 4 s, shown as snowflakes): at 3 or more it slows them. With 5 Chill her next hit freezes them: stunned 0.9 s, +30% damage, and the Chill clears. A frozen enemy gains no Chill.',
  },
  twist: {
    name: 'Chill',
    blurb: 'Basic attacks add 1 Chill, Icicle 2, its Shatter 1, Hoarfrost 2. Winter\'s Shatter spends the Chill for 30 more damage each.',
  },
  speed: 3.9,
  attack: { kind: 'ranged', range: 8, damage: 12, interval: 1.4, windup: 0.32, speed: 20, look: 'icicle' },
  recast: { slot: 0, window: SHATTER_WINDOW, arm: SHATTER_ARM, name: 'Shatter', power: 1, replay: true },
  ownLook: {
    rime: { color: '#e8f4fa', shape: 'gem' },
  },
  // The CPU shatters the icicle only when the enemy stands inside its ring, not blindly the moment the recast opens.
  aiHold(t, slot) {
    if (slot !== 0) return false;
    const r = icicles.get(t.self());
    const e = t.enemy();
    if (!r || r.gone || r.shattered || !e || performance.now() >= r.until) return false;
    const p = e.group.position;
    return Math.hypot(p.x - r.x, p.z - r.z) > SHATTER_RADIUS - 0.2;
  },
  marks(t) {
    const r = icicles.get(t.self());
    if (!r || r.gone) return [];
    const now = performance.now();
    if (now < r.bornAt || now >= r.until) return [];
    return [{ x: r.x, z: r.z, kind: 'icicle', age: (now - r.bornAt) / 1000, life: ICICLE_STAY, yaw: r.yaw }];
  },
  markLook: {
    icicle: () => icicleStandingLook(SHATTER_RADIUS),
  },
  afterCast(t, slot) {
    if (slot !== 2) return;
    t.mem.rimeUntil = t.time + RIME_SECONDS;
    t.show('rime', 1);
    t.say('RIME ARMOUR', '#c9efff');
  },
  tick(t) {
    if (t.mem.rimeUntil && !rimeOn(t)) {
      t.mem.rimeUntil = 0;
      t.show('rime', 0);
    }
  },
  /**
   * Rime Armour: a basic attack that hits her gives the attacker 2 Chill. `taken` runs on her own client, and the Chill she
   * keeps on the enemy is her own runtime's `addStacks`: offline that is the truth. Online the truth is the victim's screen
   * (`dealt` runs there), which this does not reach: her stacks message only sets the pips on the enemy's own screen, and
   * the enemy's next hit-resolving screen still counts its own Chill. So online the pips show, the slow and freeze may not follow.
   */
  taken(t, hit) {
    if (!rimeOn(t) || hit.kind !== 'attack' || hit.blocked || frozen(t)) return;
    t.addStacks('chill', CHILL_RIME, CHILL_SECONDS, CHILL_MAX);
    t.say('RIME', '#c9efff');
  },
  dealt(t, hit) {
    if (!hit.victimIsHero || (hit.kind !== 'spell' && hit.kind !== 'attack')) return;
    const chill = t.stacks('chill');
    // R spends the Chill: no freeze, no new Chill, no slow.
    if (hit.kind === 'spell' && hit.slot === 3) {
      if (chill > 0) {
        hit.damage += WINTER_PER_CHILL * chill;
        t.clearStacks('chill');
        t.say(`SHATTER ${chill}`, '#e8f4fa');
      }
      return;
    }
    if (chill >= CHILL_MAX) {
      freeze(t, hit);
      return;
    }
    if (frozen(t)) return;
    const n = t.addStacks('chill', chillOf(t, hit), CHILL_SECONDS, CHILL_MAX);
    if (n >= SLOW_AT && !hit.opts.status && !hit.mods.status) hit.opts.status = { kind: 'slow', seconds: SLOW_SECONDS };
  },
  badge(t) {
    const n = t.stacks('chill');
    return n > 0 ? `${n}/${CHILL_MAX}` : '';
  },
};

/** Chill this hit adds: a basic attack 1; Q 2 (its Shatter 1); W 2; nothing else. */
function chillOf(t: TraitView, hit: TraitHit): number {
  if (hit.kind === 'attack') return CHILL_ATTACK;
  if (hit.slot === 0) return icicles.get(t.self())?.shattered ? CHILL_SHATTER : CHILL_ICICLE;
  if (hit.slot === 1) return CHILL_HOARFROST;
  return 0;
}

/** The freeze: this hit deals 30% more and stuns, the Chill clears, and nothing more is added until it ends. */
function freeze(t: TraitView, hit: TraitHit) {
  hit.damage *= FREEZE_MUL;
  hit.opts.status = { kind: 'stun', seconds: FREEZE_SECONDS };
  t.clearStacks('chill');
  t.mem.frozenUntil = t.time + FREEZE_SECONDS;
  t.say('FROZEN', '#bfeaff');
}
