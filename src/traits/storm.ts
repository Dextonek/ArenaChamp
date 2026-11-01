import type { Trait } from './types';

/**
 * Kaia (mage). Passive Static: every third spell she casts also stuns for 0.4 s. Twist Hold Q: aiming Arc Lance longer
 * charges it, up to x1.35 damage after 1.2 s. Eye of the Storm hits 10% harder on a longer cooldown.
 */
export const stormTrait: Trait = {
  passive: { name: 'Static', blurb: 'Every third spell she casts also stuns what it hits for 0.4 s.' },
  twist: { name: 'Charged lance', blurb: 'Aim Arc Lance longer to charge it: up to 35% more damage after 1.2 s of aiming.' },
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'spark' },
  hold: { slot: 0, seconds: 1.2 },
  castMods(t, slot, charge) {
    const n = (t.mem.casts ?? 0) + 1;
    t.mem.casts = n % 3;
    const mods: { power?: number; status?: { kind: 'stun'; seconds: number } } = {};
    if (slot === 0) {
      mods.power = 1 + 0.35 * charge;
      if (charge >= 0.99) t.say('CHARGED', '#9fe8ff');
    }
    // Eye of the Storm is her one slow, heavy spell (26 s cooldown on the kit).
    if (slot === 3) mods.power = 1.1;
    if (n % 3 === 0) {
      mods.status = { kind: 'stun', seconds: 0.4 };
      t.say('STATIC', '#9fe8ff');
    }
    return mods;
  },
  badge: (t) => `${t.mem.casts ?? 0}/3`,
};
