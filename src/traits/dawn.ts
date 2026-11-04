import type { Enemy } from '../effects/common';
import type { CastContext, HitOptions } from '../effects/targeting';
import type { TraitView, Trait } from './types';

/**
 * Radiant Parry's state (keyed by Auriel's figure). Kept for the old Radiant Parry spell file (`spells/targeted/radiantParry.ts`),
 * which the VFX tool still lists; the v5 kit no longer casts it and this trait no longer writes it.
 */
export interface DawnParry { live: boolean; parried: boolean; fromUnit: boolean; enemy?: Enemy | null }
export const dawnParries = new WeakMap<object, DawnParry>();

/** Seconds of the sun-shield stance (Radiant Parry). Still read by the old spell file. */
export const PARRY_SECONDS = 0.6;
/** Seconds Dawn Descent keeps her airborne and untouchable (old spell file). */
export const DESCENT_AIR = 1.0;

// --- Kits v5 numbers (pipeline/designs/kits-v5.md, "Auriel") ------------------------------------------------------
/** Q First Light: the shield its hit gives, and the burst when it ends (60% of the shield, 3 m). */
export const Q_SHIELD = 20;
export const Q_SHIELD_SECONDS = 3;
export const Q_BURST = 12;
export const Q_BURST_RADIUS = 3;
/** W Dawnward: shield, its life, the burst (42 = 60% of 70, 3 m) and the extra basic-attack reach while it holds. */
export const W_SHIELD = 55;
export const W_SHIELD_SECONDS = 3;
export const W_BURST = 33;
export const W_BURST_RADIUS = 3;
export const W_REACH = 3;
/** E Oathbrand: how long the brand lasts, and the stun a burst adds to a branded enemy. */
export const BRAND_SECONDS = 2.5;
export const BRAND_STUN = 0.8;
/** R Sunrise: shield and life, then the fixed ring (radius, seconds it closes) and its burst (120 = 60% of 200). */
export const R_SHIELD = 160;
export const R_SHIELD_SECONDS = 5;
export const R_RING_RADIUS = 5;
export const R_RING_SECONDS = 1.6;
export const R_BURST = 100;

/**
 * Her shield as the trait tracks it, keyed by Auriel's figure, read by the four spell effects on BOTH screens. `kind`:
 * 0 none, 1 Q's small shield, 2 Dawnward, 3 Sunrise. `broke` is set when the shield is gone (used up, ran out or popped);
 * the effect of that spell then plays its burst. Own client: `afterCast` opens it for W and R, `landed` opens it for Q's
 * shield and `tick` watches `t.shieldAmount()`. Other screen: `ownChanged` builds it from `show('shield', kind)` and
 * marks the end from `show('sunbreak', n)`. `born` and `until` (round time) only serve the clean-up and the time-out.
 * A new cast of W or R, or a new Q shield, replaces the record: the spell it belonged to then plays no burst.
 */
export interface AurielShield { kind: 0 | 1 | 2 | 3; size: number; broke: boolean; brokeAt: number; born: number; until: number }
export const aurielShields = new WeakMap<object, AurielShield>();

const SIZE = [0, Q_SHIELD, W_SHIELD, R_SHIELD];
const SECONDS = [0, Q_SHIELD_SECONDS, W_SHIELD_SECONDS, R_SHIELD_SECONDS];

/** True while the shield of `kind` (or any of the given kinds) is up. */
export function aurielHolds(owner: object, ...kinds: number[]): boolean {
  const r = aurielShields.get(owner);
  return !!r && !r.broke && kinds.includes(r.kind);
}

/**
 * True only inside `burstHit`: the hit being resolved is one of her shield bursts. The whole hit pipeline (the effect's
 * `ctx.hit`, `resolve`, the `dealt` hook) runs in one call on the screen that decides the hit, so a module flag is a
 * reliable marker (a copy of the options would lose any mark put on them).
 */
let bursting = false;

/**
 * A shield burst's hit on `target`: always `projectile: true` (the burst's place is only known when the shield ends, so
 * no telegraph can show it; the effect checks live positions itself). The trait's `dealt` stuns a branded enemy.
 */
export function burstHit(ctx: CastContext, target: Enemy, opts: HitOptions) {
  bursting = true;
  try {
    ctx.hit(target, { ...opts, projectile: true });
  } finally {
    bursting = false;
  }
}

/** Opens the record of a new shield of `kind` and sends its kind to the other screen. Own client only. */
function open(t: TraitView, kind: 1 | 2 | 3) {
  aurielShields.set(t.self(), { kind, size: SIZE[kind], broke: false, brokeAt: 0, born: t.time, until: t.time + SECONDS[kind] });
  // 0 first, so the same kind twice in a row is still a change the other screen hears.
  t.show('shield', 0);
  t.show('shield', kind);
}

/**
 * Auriel (support). Passive Oath of Dawn: when one of her shields breaks or runs out it bursts in light (3 m) for 60% of
 * its size. The bursts are made by the spell effects (they play on both screens and watch `aurielShields`); this trait
 * makes the shields, watches how they end, and gives the rest of the rules:
 * - Q First Light: a hit on the enemy hero gives a 30 shield for 3 s, but not while Dawnward or Sunrise holds (the
 *   engine keeps the larger amount and restarts the clock, so a small shield would hold a big one up).
 * - W Dawnward: 70 for 3 s; her basic attacks reach 3 m farther while it holds. Recast Pop (arms at 0.2 s) ends it now.
 *   Cannot be cast while Sunrise holds.
 * - E Oathbrand: its hit brands the enemy for 2.5 s; a burst that catches a branded enemy stuns it 0.8 s (`dealt`).
 * - R Sunrise: 200 for 5 s. Recast Pop (arms at 0.3 s) ends it now. When it ends a ring closes on her spot (the effect).
 * The CPU never pops on its own (`aiWait`): the shield runs out and bursts by itself.
 */
export const dawnTrait: Trait = {
  passive: { name: 'Oath of Dawn', blurb: 'When one of her shields breaks or runs out, it bursts in light (3 m) for 60% of its size. A burst that catches a branded enemy stuns it for 0.8 s.' },
  speed: 3.9,
  attack: { kind: 'ranged', range: 5.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'spear' },
  recast: [
    { slot: 1, window: W_SHIELD_SECONDS, arm: 0.2, name: 'Pop', replay: false, aiWait: true },
    { slot: 3, window: R_SHIELD_SECONDS + 0.2, arm: 0.3, name: 'Pop', replay: false, aiWait: true },
  ],
  ownLook: { ward: { color: '#f2b83c', shape: 'gem' } },
  aiHold(t, slot, dist) {
    // W and R use a large self radius so their bursts find the enemy later (see the kit file): the CPU casts them close in.
    if (slot === 1) return dist > 6.5 || aurielHolds(t.self(), 3);
    if (slot === 3) return dist > 8;
    return false;
  },
  canCast(t, slot) {
    return slot === 1 && aurielHolds(t.self(), 3) ? 'Sunrise holds' : null;
  },
  attackReach(t) {
    return aurielHolds(t.self(), 2) ? W_REACH : 0;
  },
  afterCast(t, slot) {
    if (slot === 0) {
      // Q's shield comes with its hit (`landed`).
      t.mem.qOpen = 1;
    } else if (slot === 1) {
      open(t, 2);
      t.shield(W_SHIELD, W_SHIELD_SECONDS);
      t.show('ward', 1);
    } else if (slot === 3) {
      open(t, 3);
      t.shield(R_SHIELD, R_SHIELD_SECONDS);
    }
  },
  recastAct(t, slot) {
    // Only the shield this recast belongs to: a Sunrise cast over a Dawnward leaves the old recast with nothing to pop.
    if (!aurielHolds(t.self(), slot === 1 ? 2 : 3)) return;
    t.clearShield();
  },
  landed(t, hit) {
    if (hit.kind !== 'spell' || hit.slot !== 0 || !hit.victimIsHero) return;
    // Only the cone's own hit gives a shield; the burst of that shield is a slot 0 hit too.
    if (!t.mem.qOpen) return;
    t.mem.qOpen = 0;
    if (aurielHolds(t.self(), 2, 3)) return;
    open(t, 1);
    t.shield(Q_SHIELD, Q_SHIELD_SECONDS);
  },
  dealt(t, hit) {
    if (hit.kind !== 'spell' || !hit.victimIsHero) return;
    if (hit.slot === 2) {
      t.addStacks('brand', 1, BRAND_SECONDS, 1);
      return;
    }
    if (bursting && t.stacks('brand') > 0) hit.opts.status = { kind: 'stun', seconds: BRAND_STUN };
  },
  ownChanged(t, name, n) {
    // The other screen: build the record from the kind, mark it from the end count (see `AurielShield`).
    if (name === 'shield' && n >= 1 && n <= 3) {
      aurielShields.set(t.self(), { kind: n as 1 | 2 | 3, size: SIZE[n], broke: false, brokeAt: 0, born: t.time, until: t.time + SECONDS[n] });
    }
    if (name === 'sunbreak' && n > 0) {
      const r = aurielShields.get(t.self());
      if (r && !r.broke) { r.broke = true; r.brokeAt = t.time; }
    }
  },
  tick(t) {
    const r = aurielShields.get(t.self());
    if (!r) return;
    // A record from an earlier round.
    if (t.time < r.born) { aurielShields.delete(t.self()); return; }
    if (r.broke) return;
    // The shield is made in the same frame; a short grace covers the engine applying it.
    if (t.time < r.born + 0.15) return;
    if (t.shieldAmount() > 0 && t.time < r.until + 1) return;
    r.broke = true;
    r.brokeAt = t.time;
    t.mem.breaks = (t.mem.breaks ?? 0) + 1;
    t.show('sunbreak', t.mem.breaks);
    if (r.kind === 2) t.show('ward', 0);
  },
  badge(t) {
    const r = aurielShields.get(t.self());
    return r && !r.broke && r.kind > 0 ? `${Math.max(0, Math.ceil(r.until - t.time))}s` : '';
  },
};
