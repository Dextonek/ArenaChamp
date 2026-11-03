import type { Trait } from './types';

/**
 * Vex (mage). Passive Toxin: her hits on the enemy hero add a stack (max 5, 4 s); the hit that reaches 5 deals +60 and
 * clears them. Twist: her spells hit 12% softer up front, the stacks do the work; Caustic Pool adds 2 per hit.
 * Elixir of Unmaking (R) is a state: for 5 s of round time her Q has a 0.4 s cooldown and adds double toxin.
 */

/** Seconds the Elixir of Unmaking lasts. */
export const UNMAKING_SECONDS = 5;
export const alchemyTrait: Trait = {
  passive: { name: 'Toxin', blurb: 'Her hits add a toxin stack to the enemy (max 5, 4 s). The hit that makes the fifth deals 50 extra damage and clears them.' },
  twist: { name: 'Slow poison', blurb: 'Her spells hit 12% softer up front, but each cast of Caustic Pool adds 2 stacks. Elixir of Unmaking: for 5 s Q recharges in 0.4 s and adds double toxin.' },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6.5, damage: 9, interval: 1.0, windup: 0.25, speed: 18, look: 'dart' },
  afterCast(t, slot) {
    if (slot !== 3) return;
    // The state is a deadline in round time; Q is ready the moment she drinks.
    t.mem.unmaking = t.time + UNMAKING_SECONDS;
    t.setCooldown(0, 0);
    // The elixir also sharpens her: +20% damage for the same 5 s.
    t.buff('might', 0.2, UNMAKING_SECONDS);
    t.say('UNMAKING', '#c8ff4a');
  },
  cooldown(t, slot, base) {
    return slot === 0 && (t.mem.unmaking ?? 0) > t.time ? Math.min(base, 0.4) : base;
  },
  dealt(t, hit) {
    if (!hit.victimIsHero) return;
    if (hit.kind === 'spell') hit.damage *= 0.88;
    // A spell adds its stacks once per cast (Caustic Pool ticks many times); every basic attack adds one.
    if (hit.kind === 'spell' && hit.cast !== undefined && hit.slot !== undefined) {
      // Per slot: a Caustic Pool still ticking while she casts something else must not count again.
      if (t.mem[`tox${hit.slot}`] === hit.cast) return;
      t.mem[`tox${hit.slot}`] = hit.cast;
    }
    let add = hit.kind === 'spell' && hit.slot === 1 ? 2 : 1;
    // Elixir of Unmaking: her Q hits apply double toxin.
    if (hit.kind === 'spell' && hit.slot === 0 && (t.mem.unmaking ?? 0) > t.time) add *= 2;
    if (t.addStacks('toxin', add, 4, 5) >= 5) {
      hit.damage += 50;
      t.clearStacks('toxin');
      t.say('TOXIN BURST', '#c8ff4a');
    }
  },
  badge(t) {
    const n = t.stacks('toxin'), on = (t.mem.unmaking ?? 0) > t.time;
    return n > 0 ? `${n}${on ? ' x2' : ''}` : on ? 'x2' : '';
  },
};
