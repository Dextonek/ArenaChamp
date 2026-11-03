import type { Trait } from './types';

/** Her spells cost this share of max HP, by slot (Q W E R). */
const COST = [0.025, 0.04, 0.05, 0.06];

/** Blood Bond: the recast window, and how long the mark ripens before a recast may pop it. */
export const BOND_WINDOW = 3.8;
export const BOND_RIPEN = 1.5;

/**
 * Vesper's Blood Bond mark, keyed by her figure. The effect (`src/spells/targeted/bloodBond.ts`) opens it on the cast and
 * pops it; the trait feeds it: `landed` adds the damage she deals to the enemy hero while it is `live` (`tally`), and
 * the recast (`recastAct`, `replay: false`) sets `pop`. `tracked` is set by `tick`, which only runs on the screen that
 * owns her trait: where it stays false (the other player's screen of a network duel, which gets no hit reports) the
 * effect pops for a flat damage instead of a tally.
 */
export interface BloodBond { live: boolean; tally: number; pop: boolean; tracked: boolean }
export const bloodBonds = new WeakMap<object, BloodBond>();

/**
 * Vesper (assassin). Passive Blood price: heals 18% of the damage she deals. Twist HP as cost: her spells cool down
 * 25% faster but cost 2.5-6% of her max HP; under 30% HP they are free and deal +20%. Hemolance heals 6 when it lands.
 * Blood Bond can be cast again within 3.8 s to pop the mark (no effect plays, only the pop).
 */
export const bloodTrait: Trait = {
  passive: { name: 'Blood price', blurb: 'Heals 18% of all damage she deals. Her drain bolt and a landed Hemolance heal 6 more.' },
  twist: { name: 'HP as cost', blurb: 'Her spells cool down 25% faster but cost 2.5-6% of her max HP. Under 30% HP they cost nothing and deal 20% more. Recast Blood Bond (after 1.5 s) to pop the mark early.' },
  speed: 4,
  attack: { kind: 'ranged', range: 5.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'drop' },
  recast: { slot: 3, window: BOND_WINDOW, name: 'Pop the bond', replay: false },
  castMods(t, slot) {
    if (t.hp() < t.maxHp() * 0.3) return { power: 1.2 };
    t.payHp(t.maxHp() * (COST[slot] ?? 0.05));
    return {};
  },
  cooldown: (_t, _slot, base) => base * 0.75,
  recastAct(t, slot) {
    if (slot !== 3) return;
    const bond = bloodBonds.get(t.self());
    if (!bond || !bond.live) return;
    bond.pop = true;
    t.say('BOND', '#ff3b4e');
  },
  landed(t, hit) {
    t.heal(hit.damage * 0.18 + (hit.kind === 'attack' || (hit.kind === 'spell' && hit.slot === 0) ? 6 : 0));
    // Blood Bond keeps count of what she deals to the enemy hero while the mark stands.
    const bond = bloodBonds.get(t.self());
    if (bond && bond.live && hit.victimIsHero) bond.tally += hit.damage;
  },
  tick(t) {
    const bond = bloodBonds.get(t.self());
    if (bond) bond.tracked = true;
  },
  badge: (t) => (t.hp() < t.maxHp() * 0.3 ? '+20%' : ''),
};
