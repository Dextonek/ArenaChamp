import type { Trait } from './types';

/** Her spells cost this share of max HP, by slot (Q W E R). */
const COST = [0.04, 0.05, 0.06, 0.08];

/**
 * Vesper (juggernaut). Passive Blood price: heals 18% of the damage she deals. Twist HP as cost: her spells cool down
 * 25% faster but cost 4-8% of her max HP; under 30% HP they are free and deal +20%.
 */
export const bloodTrait: Trait = {
  passive: { name: 'Blood price', blurb: 'Heals 18% of all damage she deals. Her drain bolt heals 6 more per hit.' },
  twist: { name: 'HP as cost', blurb: 'Her spells cool down 25% faster but cost 4-8% of her max HP. Under 30% HP they cost nothing and deal 20% more.' },
  speed: 4,
  attack: { kind: 'ranged', range: 5.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'drop' },
  castMods(t, slot) {
    if (t.hp() < t.maxHp() * 0.3) return { power: 1.2 };
    t.payHp(t.maxHp() * (COST[slot] ?? 0.05));
    return {};
  },
  cooldown: (_t, _slot, base) => base * 0.75,
  landed(t, hit) {
    t.heal(hit.damage * 0.18 + (hit.kind === 'attack' ? 6 : 0));
  },
  badge: (t) => (t.hp() < t.maxHp() * 0.3 ? '+20%' : ''),
};
