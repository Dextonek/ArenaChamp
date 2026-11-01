import type { Trait } from './types';

/**
 * Mortis (summoner). Passive Grave harvest: every unit that dies, either side's, gives him a bone (max 10). Twist
 * Bones: Grave Call and Legion of the Ossuary spend them all: +12% damage per bone for the units they raise. Bone
 * Spear grows with the pile: +5% damage per bone held (not spent).
 */
export const boneTrait: Trait = {
  passive: { name: 'Grave harvest', blurb: 'Every summoned unit that dies, his or the enemy, gives him a bone (max 10). He starts each round with 4.' },
  twist: { name: 'Bones', blurb: 'Grave Call and Legion of the Ossuary spend all his bones: the units they raise hit 12% harder per bone. Bone Spear deals 5% more per bone he holds.' },
  resource: { name: 'Bones', max: 10, color: '#e8e2cc', start: 4 },
  speed: 3.8,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'bone' },
  tick(t) {
    const deaths = t.unitDeaths();
    const d = deaths - (t.mem.seen ?? 0);
    t.mem.seen = deaths;
    if (d > 0) t.addRes(d);
  },
  castMods(t, slot) {
    if (slot === 0) return { power: 1 + 0.05 * Math.floor(t.res) };
    if ((slot !== 1 && slot !== 3) || t.res < 1) return {};
    const bones = Math.floor(t.res);
    t.res = 0;
    t.say(`${bones} BONES`, '#f4efd8');
    return { power: 1 + 0.12 * bones };
  },
  badge: (t) => (t.res > 0 ? String(Math.floor(t.res)) : ''),
};
