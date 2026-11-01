import type { Trait } from './types';

/**
 * Vex (mage). Passive Toxin: her hits on the enemy hero add a stack (max 5, 4 s); the hit that reaches 5 deals +60 and
 * clears them. Twist: her spells hit 15% softer up front, the stacks do the work; Caustic Pool adds 2 per hit and
 * Grand Transmutation 3.
 */
export const alchemyTrait: Trait = {
  passive: { name: 'Toxin', blurb: 'Her hits add a toxin stack to the enemy (max 5, 4 s). The hit that makes the fifth deals 50 extra damage and clears them.' },
  twist: { name: 'Slow poison', blurb: 'Her spells hit 15% softer up front, but each cast of Caustic Pool adds 2 stacks and Grand Transmutation 3.' },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6.5, damage: 9, interval: 1.0, windup: 0.25, speed: 18, look: 'dart' },
  dealt(t, hit) {
    if (!hit.victimIsHero) return;
    if (hit.kind === 'spell') hit.damage *= 0.85;
    // A spell adds its stacks once per cast (Caustic Pool ticks many times); every basic attack adds one.
    if (hit.kind === 'spell' && hit.cast !== undefined && hit.slot !== undefined) {
      // Per slot: a Caustic Pool still ticking while she casts something else must not count again.
      if (t.mem[`tox${hit.slot}`] === hit.cast) return;
      t.mem[`tox${hit.slot}`] = hit.cast;
    }
    const add = hit.kind === 'spell' && hit.slot === 3 ? 3 : hit.kind === 'spell' && hit.slot === 1 ? 2 : 1;
    if (t.addStacks('toxin', add, 4, 5) >= 5) {
      hit.damage += 50;
      t.clearStacks('toxin');
      t.say('TOXIN BURST', '#c8ff4a');
    }
  },
  badge(t) {
    const n = t.stacks('toxin');
    return n > 0 ? String(n) : '';
  },
};
