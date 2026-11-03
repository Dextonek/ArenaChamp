import * as THREE from 'three';
import type { Trait } from './types';

/**
 * Where the last Unwind sent a hero (x, z), keyed by its figure. The trait writes it in `afterCast` (before the effect
 * plays); `src/spells/targeted/unwind.ts` reads it in `cast()` to draw and telegraph the arrival spot at once. Only the
 * side that ran the trait knows it: the other screen of a network duel finds nothing and reads the figure's position
 * once it has moved instead.
 */
export const unwindDest = new WeakMap<object, { x: number; z: number }>();

/** Seconds Unwind goes back. */
export const UNWIND_BACK = 2.5;
/** Seconds the Quickstep tempo bonus lasts. */
export const QUICKSTEP_SECONDS = 2;

/**
 * Tempo (mage). Passive Echo: each spell he casts winds the cooldowns of his other spells back 1.3 s. Twist Quickstep:
 * the dash holds two charges (one back every 8 s), and for 2 s after each one his cooldowns tick twice as fast.
 * Unwind (R) puts him where he stood 2.5 s ago with the HP he had then (it never lowers his HP).
 */
export const chronoTrait: Trait = {
  passive: { name: 'Echo', blurb: 'Every spell he casts winds the cooldowns of his other spells back 1.3 s.' },
  twist: { name: 'Quickstep', blurb: 'Two Quickstep charges (one back every 8 s). For 2 s after a dash his cooldowns tick twice as fast.' },
  speed: 4,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'gear' },
  charges: { slot: 2, count: 2, every: 8 },
  attackMods: () => ({ status: { kind: 'slow', seconds: 0.5 } }),
  afterCast(t, slot) {
    for (let s = 0; s < 4; s++) {
      if (s === slot) continue;
      const left = t.cooldownLeft(s);
      if (left > 0) t.setCooldown(s, Math.max(0, left - 1.3));
    }
    if (slot === 2) {
      t.mem.qs = QUICKSTEP_SECONDS;
      t.say('QUICKSTEP', '#d4ff5a');
    }
    if (slot === 3) {
      const past = t.past(UNWIND_BACK);
      if (!past) return;
      // His HP goes back up to what it was, never down.
      const gain = past.hp - t.hp();
      if (gain > 0) t.heal(gain);
      unwindDest.set(t.self(), { x: past.x, z: past.z });
      t.moveTo(new THREE.Vector3(past.x, 0, past.z), 0.25);
    }
  },
  tick(t, dt) {
    const left = t.mem.qs ?? 0;
    if (left <= 0) return;
    // The second tick: the same dt taken off every running cooldown once more.
    const d = Math.min(dt, left);
    t.mem.qs = left - d;
    for (let s = 0; s < 4; s++) {
      const c = t.cooldownLeft(s);
      if (c > 0) t.setCooldown(s, Math.max(0, c - d));
    }
  },
  badge: (t) => ((t.mem.qs ?? 0) > 0 ? 'x2' : ''),
};
