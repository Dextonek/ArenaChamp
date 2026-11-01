import type { Trait } from './types';

/**
 * Zephyr (assassin). Passive Tailwind: walks fastest, and each spell gives +10% walk speed for 2 s. Twist Momentum:
 * walking fills the bar; at full the next spell also knocks back and costs half its cooldown.
 */
export const skyTrait: Trait = {
  passive: { name: 'Tailwind', blurb: 'Walks the fastest of all heroes. Every spell he casts gives +10% walk speed for 2 s.' },
  twist: { name: 'Momentum', blurb: 'Walking fills the bar (5 s of running). At full, his next spell also knocks back hard and has half its cooldown.' },
  resource: { name: 'Momentum', max: 100, color: '#9fe8ff' },
  speed: 4.6,
  attack: { kind: 'melee', range: 2.4, damage: 10, interval: 0.9, windup: 0.22, speed: 0, look: 'sweep' },
  tick(t, dt) {
    if (t.still === 0) t.addRes(dt * 20);
  },
  attackMods: () => ({ knock: 1 }),
  castMods(t) {
    if (t.res < 100) return {};
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
