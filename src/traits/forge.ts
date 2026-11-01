import type { Trait } from './types';

/**
 * Brannoc (tank). Passive Anvil stance: takes 15% less damage while standing still. Twist Heat: each spell adds 35; at
 * full heat the next spell is empowered (+50% damage, stuns 0.3 s) and the heat vents.
 */
export const forgeTrait: Trait = {
  passive: { name: 'Anvil stance', blurb: 'Takes 15% less damage while standing still.' },
  twist: { name: 'Heat', blurb: 'Each spell adds 35 heat. At full heat the next spell is empowered: +50% damage and a 0.3 s stun. Then the heat vents.' },
  resource: { name: 'Heat', max: 100, color: '#ff8a3c' },
  speed: 3.6,
  attack: { kind: 'melee', range: 2.6, damage: 18, interval: 1.6, windup: 0.4, speed: 0, look: 'smash' },
  attackMods(t) {
    const n = (t.mem.swings ?? 0) + 1;
    t.mem.swings = n % 3;
    return n % 3 === 0 ? { knock: 2 } : {};
  },
  castMods(t) {
    if (t.res < 100) return {};
    t.res = 0;
    t.mem.vent = 1;
    t.say('OVERHEAT', '#ffb070');
    return { power: 1.5, status: { kind: 'stun', seconds: 0.3 } };
  },
  afterCast(t) {
    if (t.mem.vent) t.mem.vent = 0;
    else t.addRes(35);
  },
  taken(t, hit) {
    if (t.still > 0.3 && hit.victim === t.self()) hit.damage *= 0.85;
  },
  badge: (t) => (t.still > 0.3 ? 'ON' : ''),
};
