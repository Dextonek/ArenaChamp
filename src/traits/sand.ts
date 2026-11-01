import type { Trait } from './types';

/**
 * Sefu (controller). Passive Sandstorm: rooted enemies take +45% from her (slowed ones are Isolde's). Twist Hold W: aiming Quicksand longer
 * charges it (full after 1 s): up to 50% more damage and a short extra root on what it hits. Basic attack: a thrown sand lash (5 m)
 * that slows 0.4 s.
 */
export const sandTrait: Trait = {
  passive: { name: 'Sandstorm', blurb: 'Rooted enemies take 45% more damage from her. Her spells other than Quicksand hit 15% harder.' },
  twist: { name: 'Charged quicksand', blurb: 'Aim Quicksand longer (up to 1 s): up to 50% more damage and it roots what it hits for up to 0.5 s longer.' },
  speed: 4,
  attack: { kind: 'ranged', range: 5.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'sand' },
  hold: { slot: 1, seconds: 1 },
  castMods(t, slot, charge) {
    // His other spells hit 15% harder (Dune Ward lost its shield in the uniqueness pass).
    if (slot !== 1) return { power: 1.15 };
    if (charge >= 0.99) t.say('FULL SAND', '#f0d28a');
    return { power: 1 + 0.5 * charge, status: charge >= 0.3 ? { kind: 'root', seconds: 0.5 * charge } : undefined };
  },
  attackMods: () => ({ status: { kind: 'slow', seconds: 0.4 } }),
  dealt(t, hit) {
    const st = hit.victimIsHero ? t.status(hit.victim) : undefined;
    // Only roots: a bonus on slowed enemies is Isolde's.
    if (st?.has('root')) hit.damage *= 1.45;
  },
};
