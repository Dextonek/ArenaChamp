import type { Trait } from './types';

/** Damage per living wasp (his summoned units). */
const PER_WASP = 0.03;

/**
 * Sirix (juggernaut). Passive Hive: each of his living wasps gives him +3% damage. Twist Stance: Chitin Carapace flips
 * him between swarm (+5% damage) and carapace (15% less damage taken); that spell has an 8 s cooldown.
 */
export const hiveTrait: Trait = {
  passive: { name: 'Hive', blurb: 'Each of his living wasps gives him 3% more damage.' },
  twist: { name: 'Stance switch', blurb: 'Chitin Carapace flips his stance (8 s cooldown). Swarm: +5% damage. Carapace: takes 15% less damage.' },
  speed: 4,
  attack: { kind: 'melee', range: 2.4, damage: 13, interval: 1.2, windup: 0.3, speed: 0, look: 'claw' },
  castMods: (t) => ({ power: (t.mem.stance ? 1 : 1.05) * (1 + PER_WASP * t.units().length) }),
  attackMods: (t) => ({ power: (t.mem.stance ? 1 : 1.05) * (1 + PER_WASP * t.units().length) }),
  afterCast(t, slot) {
    if (slot !== 2) return;
    t.mem.stance = t.mem.stance ? 0 : 1;
    t.say(t.mem.stance ? 'CARAPACE' : 'SWARM', '#e0b040');
  },
  cooldown: (_t, slot, base) => (slot === 2 ? 8 : base),
  tick(t) {
    if (t.mem.stance && t.time >= (t.mem.armorAt ?? 0)) {
      t.mem.armorAt = t.time + 0.6;
      t.buff('armor', 0.15, 0.8);
    }
  },
  badge(t) {
    const n = t.units().length;
    return `${t.mem.stance ? 'C' : 'S'}${n ? ` +${Math.round(n * PER_WASP * 100)}%` : ''}`;
  },
};
