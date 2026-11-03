import * as THREE from 'three';
import type { Trait } from './types';

/**
 * Where Kaia's Ball Lightning is, keyed by her figure. The effect (`src/spells/targeted/ballLightning.ts`) writes the
 * orb's position every frame while it flies and hovers (`hit`: it ended on an enemy, so she lands short of it); the
 * recast (`recastAct`) reads it and blinks her there. `taken` is set by the recast so the effect can draw the blink.
 */
export interface StormOrb { x: number; z: number; hit: boolean; taken: boolean; fromX: number; fromZ: number }
export const stormOrbs = new WeakMap<object, StormOrb>();

/** Thunderlance damage scale: x0.6 uncharged to x1.5 fully charged. */
export const LANCE_MIN = 0.6;
export const LANCE_MAX = 1.5;

/**
 * Kaia (mage). Passive Static: every third spell she casts also stuns for 0.4 s. Twist Hold: aiming Arc Lance longer
 * charges it (up to x1.35 damage after 1.2 s) and aiming Thunderlance longer charges it (x0.6 to x1.5 after 1.5 s).
 * Ball Lightning can be cast again within 3 s to blink to the orb (no effect, only the move).
 */
export const stormTrait: Trait = {
  passive: { name: 'Static', blurb: 'Every third spell she casts also stuns what it hits for 0.4 s.' },
  twist: { name: 'Charged lance', blurb: 'Aim Arc Lance (1.2 s) or Thunderlance (1.5 s) longer to charge them: up to 35% and 150% damage. Recast Ball Lightning within 3 s to blink to the orb.' },
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'spark' },
  hold: [{ slot: 0, seconds: 1.2 }, { slot: 3, seconds: 1.5 }],
  recast: { slot: 1, window: 3, name: 'Blink to orb', replay: false },
  castMods(t, slot, charge) {
    const n = (t.mem.casts ?? 0) + 1;
    t.mem.casts = n % 3;
    const mods: { power?: number; status?: { kind: 'stun'; seconds: number } } = {};
    if (slot === 0) {
      mods.power = 1 + 0.35 * charge;
      if (charge >= 0.99) t.say('CHARGED', '#9fe8ff');
    }
    if (slot === 3) {
      mods.power = LANCE_MIN + (LANCE_MAX - LANCE_MIN) * charge;
      if (charge >= 0.99) t.say('FULL CHARGE', '#9fe8ff');
    }
    if (n % 3 === 0) {
      mods.status = { kind: 'stun', seconds: 0.4 };
      t.say('STATIC', '#9fe8ff');
    }
    return mods;
  },
  recastAct(t, slot) {
    if (slot !== 1) return;
    const me = t.self();
    const orb = stormOrbs.get(me);
    if (!orb || orb.taken) return;
    const p = me.group.position;
    let x = orb.x, z = orb.z;
    if (orb.hit) {
      // The orb ended on an enemy: land 1.2 m short of it, on her side.
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz) || 1;
      x += (dx / d) * Math.min(1.2, d);
      z += (dz / d) * Math.min(1.2, d);
    }
    orb.taken = true;
    orb.fromX = p.x;
    orb.fromZ = p.z;
    t.say('BLINK', '#9fe8ff');
    t.moveTo(new THREE.Vector3(x, 0, z), 0.05);
  },
  badge: (t) => `${t.mem.casts ?? 0}/3`,
};
