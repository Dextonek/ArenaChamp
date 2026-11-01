import type { Trait } from './types';

/** Ink each slot costs (Q W E R), and what a basic attack and a second of waiting give back. */
const COST = [20, 30, 30, 50];
const PER_ATTACK = 15;
const PER_SECOND = 6;

/**
 * Shiori (summoner). Passive Ink trail: everything of hers that hits the enemy hero stains it, so it deals 20% less for
 * 2 s. Twist Ink reserve: the only hero with mana. Her spells cost ink (20 / 30 / 30 / 50 of 100); her basic attacks
 * draw 15 back and the well refills 6 a second, so she trades attacks for spells.
 */
export const inkTrait: Trait = {
  passive: { name: 'Ink trail', blurb: 'Her hits, her familiars too, stain the enemy: it deals 20% less damage for 2 s.' },
  twist: { name: 'Ink reserve', blurb: 'Her spells cost ink: Q 20, W 30, E 30, R 50 (of 100). Each basic attack draws 15 back; the well refills 6 a second.' },
  resource: { name: 'Ink', max: 100, color: '#6a5f9a', start: 100 },
  speed: 4.1,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1, windup: 0.25, speed: 18, look: 'ink' },
  canCast: (t, slot) => (t.res < (COST[slot] ?? 0) ? 'Not enough ink' : null),
  castMods(t, slot) {
    t.addRes(-(COST[slot] ?? 0));
    return {};
  },
  attackMods(t) {
    t.addRes(PER_ATTACK);
    return {};
  },
  tick(t, dt) {
    t.addRes(PER_SECOND * dt);
  },
  dealt(_t, hit) {
    if (hit.victimIsHero && !hit.opts.debuff) hit.opts.debuff = { kind: 'weaken', amount: 0.2, seconds: 2 };
  },
  badge: (t) => String(Math.floor(t.res)),
};
