import type { Trait } from './types';

/**
 * Auriel (support). Passive Aegis: every shield she makes is 30% stronger, and for 3 s after a shield spell her hits
 * deal +25% (adapted: a trait cannot see her shield, so it is a timed might after Radiant Spear, Halo or Judgement).
 * Twist Recast W: Aegis Wall can be cast once more within 3 s as a Slam, free, at 60% damage.
 */
export const dawnTrait: Trait = {
  passive: { name: 'Aegis', blurb: 'Her shields are 30% stronger, and for 3 seconds after a shield spell her hits deal 25% more damage.' },
  twist: { name: 'Slam', blurb: 'After Aegis Wall, press W again within 3 seconds to slam it down early: free, at 60% damage.' },
  speed: 3.9,
  attack: { kind: 'ranged', range: 5.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'spear' },
  shieldMul: 1.3,
  recast: { slot: 1, window: 3, name: 'Slam', power: 0.6 },
  afterCast(t, slot) {
    if (slot === 0 || slot === 2 || slot === 3) {
      t.buff('might', 0.25, 3);
      t.mem.mightUntil = t.time + 3;
    }
  },
  badge: (t) => (t.time < (t.mem.mightUntil ?? 0) ? '+25%' : ''),
};
