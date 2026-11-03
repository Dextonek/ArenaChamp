import type { Trait } from './types';

/**
 * Zephyr (bruiser). Passive Tailwind: walks fastest, and each spell gives +10% walk speed for 2 s. Twist Momentum:
 * walking fills the bar; at full his next damaging spell also knocks back and costs half its cooldown. The Wind Barrier
 * (E, slot 2) deals no damage, so it neither spends the bar nor gets the bonus. The Gale Cyclone (R) is the moving
 * ultimate: with a full bar its hits shove harder and it comes back in half the time.
 */
export const skyTrait: Trait = {
  passive: { name: 'Tailwind', blurb: 'Walks the fastest of all heroes. Every spell he casts gives +10% walk speed for 2 s.' },
  twist: { name: 'Momentum', blurb: 'Walking fills the bar (5 s of running). At full, his next damaging spell (not the Wind Barrier) also knocks back hard and has half its cooldown.' },
  resource: { name: 'Momentum', max: 100, color: '#9fe8ff' },
  speed: 4.6,
  attack: { kind: 'melee', range: 2.4, damage: 10, interval: 0.9, windup: 0.22, speed: 0, look: 'sweep' },
  tick(t, dt) {
    if (t.still === 0) t.addRes(dt * 20);
  },
  attackMods: () => ({ knock: 1 }),
  castMods(t, slot) {
    // The wall does no damage: keep the bar for the next spell.
    if (slot === 2 || t.res < 100) return {};
    t.res = 0;
    t.mem.half = 1;
    t.say('GUST', '#9fe8ff');
    return { knock: 8 };
  },
  cooldown(t, _slot, base) {
    if (!t.mem.half) return base;
    t.mem.half = 0;
    return base / 2;
  },
  afterCast(t) {
    t.buff('haste', 0.1, 2);
  },
  badge: (t) => (t.res >= 100 ? 'MAX' : ''),
};
