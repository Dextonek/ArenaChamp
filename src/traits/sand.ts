import type { Trait } from './types';

/**
 * Burrow (E): seconds from the cast during which Sefu is untouchable. The effect (`src/spells/targeted/burrow.ts`) times
 * its dive, tunnel and eruption to it; `afterCast` opens the deadline and `taken` swallows every hit before it.
 */
export const BURROW_SECONDS = 1.1;

/**
 * Sefu (controller). Passive Sandstorm: rooted enemies take +45% from him (slowed ones are Isolde's), and his Sand Lash and Dune
 * Surge both root. Twist Hold W: aiming Quicksand longer charges it (full after 1 s): up to 50% more damage and a short extra
 * root on what it hits. Burrow (E): while it lasts every hit on him is swallowed whole (`taken`). Basic attack: a thrown sand
 * lash (5 m) that slows 0.4 s.
 */
export const sandTrait: Trait = {
  passive: { name: 'Sandstorm', blurb: 'Rooted enemies take 45% more damage from him. His spells other than Quicksand hit 15% harder. Burrow makes him untouchable for 1.1 s.' },
  twist: { name: 'Charged quicksand', blurb: 'Aim Quicksand longer (up to 1 s): up to 50% more damage and it roots what it hits for up to 0.5 s longer.' },
  speed: 4,
  attack: { kind: 'ranged', range: 5.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'sand' },
  hold: { slot: 1, seconds: 1 },
  castMods(t, slot, charge) {
    // His other spells hit 15% harder.
    if (slot !== 1) return { power: 1.15 };
    if (charge >= 0.99) t.say('FULL SAND', '#f0d28a');
    return { power: 1 + 0.5 * charge, status: charge >= 0.3 ? { kind: 'root', seconds: 0.5 * charge } : undefined };
  },
  afterCast(t, slot) {
    // Burrow: untouchable from the cast until the eruption has passed (the deadline is in round time).
    if (slot === 2) t.mem.burrow = t.time + BURROW_SECONDS;
  },
  taken(t, hit) {
    if (t.time < (t.mem.burrow ?? -1)) hit.blocked = true;
  },
  attackMods: () => ({ status: { kind: 'slow', seconds: 0.4 } }),
  dealt(t, hit) {
    const st = hit.victimIsHero ? t.status(hit.victim) : undefined;
    // Only roots: a bonus on slowed enemies is Isolde's.
    if (st?.has('root')) hit.damage *= 1.45;
  },
};
