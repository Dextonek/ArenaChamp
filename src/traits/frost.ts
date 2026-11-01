import type { Trait } from './types';

/**
 * Isolde (controller). Passive Frostbite: slowed enemies take +20% from her. Twist Chill stacks: every hit of hers on
 * the enemy hero adds a chill (max 3, 5 s); the hit that makes the third freezes it (stun 0.8 s) and clears them.
 * Glacial Mantle is an ice block: for 1.5 s nothing touches her (every hit is swallowed on her own screen) and she can
 * neither walk, attack nor cast.
 */

/** Seconds of the ice block (matches the spell's `hold`). */
const ICE = 1.5;
export const frostTrait: Trait = {
  passive: { name: 'Frostbite', blurb: 'Enemies that are slowed take 20% more damage from her. Glacial Mantle freezes her in an ice block for 1.5 s: nothing can hurt her, and she cannot act.' },
  twist: { name: 'Chill', blurb: 'Every hit adds a chill on the enemy (max 3). The hit that makes the third freezes it in place for 0.8 s.' },
  speed: 3.9,
  attack: { kind: 'ranged', range: 8, damage: 13, interval: 1.4, windup: 0.32, speed: 20, look: 'icicle' },
  canCast: (t) => (t.time < (t.mem.iceUntil ?? 0) ? 'Frozen in ice' : null),
  afterCast(t, slot) {
    if (slot !== 2) return;
    t.mem.iceUntil = t.time + ICE;
    t.hold(ICE);
  },
  taken(t, hit) {
    if (t.time >= (t.mem.iceUntil ?? 0)) return;
    hit.blocked = true;
    if (t.time >= (t.mem.saidAt ?? 0)) { t.mem.saidAt = t.time + 0.5; t.say('ICE BLOCK', '#bfeaff'); }
  },
  dealt(t, hit) {
    if (!hit.victimIsHero) return;
    if (t.status(hit.victim)?.has('slow')) hit.damage *= 1.2;
    const n = t.addStacks('chill', 1, 5, 3);
    if (n >= 3) {
      hit.opts.status = { kind: 'stun', seconds: 0.8 };
      t.clearStacks('chill');
      t.say('FROZEN', '#bfeaff');
    }
  },
  badge: (t) => {
    const n = t.stacks('chill');
    return n > 0 ? `${n}/3` : '';
  },
};
