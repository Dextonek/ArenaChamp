import type { Trait } from './types';

const SLOT_KEYS = ['Q', 'W', 'E', 'R'];
/** Seconds of the encore after Crescendo (matches the spell's aura), and the cooldown his spells get in it. */
const ENCORE = 3;
const ENCORE_GAP = 1;

/**
 * Cantor (support). Passive Rhythm: a spell cast after a different slot than the last one deals +15%. Twist Song meter:
 * every spell adds 25 (max 100); Crescendo needs a full meter and spends it, and starts an encore: for 3 s his other
 * spells come back after 1 s. The meter does not fill in the encore.
 */
export const bardTrait: Trait = {
  passive: { name: 'Rhythm', blurb: 'A spell cast after a different spell than the last one deals 15% more damage. Repeating a slot breaks the beat.' },
  twist: { name: 'Song meter', blurb: 'Each spell adds 25 to the song meter. Crescendo needs a full meter (100): then for 3 s his other spells come back after 1 s.' },
  resource: { name: 'Song', max: 100, color: '#ffd24a' },
  speed: 4.0,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'note' },
  canCast: (t, slot) => (slot === 3 && t.res < 100 ? 'Song meter not full' : null),
  castMods(t, slot) {
    const last = t.mem.last ?? -1;
    t.mem.last = slot;
    if (slot === 3) t.res = 0;
    if (last !== slot) {
      t.say('RHYTHM', '#ffe58a');
      return { power: 1.15 };
    }
    return {};
  },
  afterCast(t, slot) {
    if (slot === 3) {
      t.mem.encoreUntil = t.time + ENCORE;
      t.say('ENCORE', '#ffe58a');
      for (let i = 0; i < 3; i++) t.setCooldown(i, 0);
    } else if (t.time >= (t.mem.encoreUntil ?? 0)) {
      t.addRes(25);
    }
  },
  cooldown: (t, slot, base) => (slot < 3 && t.time < (t.mem.encoreUntil ?? 0) ? ENCORE_GAP : base),
  badge: (t) => (t.time < (t.mem.encoreUntil ?? 0) ? 'ENCORE' : t.mem.last !== undefined ? SLOT_KEYS[t.mem.last] ?? '' : ''),
};
