import { isBehind, type Trait } from './types';

/**
 * Nyx (assassin). Passive Backstab: hits from behind the enemy deal +20%. Twist Combo points: each of her spells that
 * lands on the enemy hero adds one (max 5); her ultimate spends them all for +15% damage each. Umbral Blink is a heavy
 * dive: x1.35 damage on a 5 s cooldown.
 */
export const shadowTrait: Trait = {
  passive: { name: 'Backstab', blurb: 'Hits from behind the enemy (outside its front 120°) deal 20% more damage.' },
  twist: { name: 'Combo points', blurb: 'Each of her spells that hits the enemy hero adds a point (max 5). Eclipse Execution spends them all: +15% damage per point.' },
  resource: { name: 'Combo', max: 5, color: '#b58cff' },
  speed: 4.6,
  attack: { kind: 'melee', range: 1.9, damage: 8, interval: 0.7, windup: 0.18, speed: 0, look: 'twin' },
  dealt(t, hit) {
    const v = hit.victim.group.position, me = t.self().group.position;
    if (hit.victimIsHero && isBehind(me, v, hit.victim.group.rotation.y)) {
      hit.damage *= 1.2;
      t.say('BACKSTAB', '#d9b8ff');
    }
  },
  landed(t, hit) {
    if (hit.kind === 'spell' && hit.victimIsHero && hit.slot !== undefined && hit.slot < 3 && !t.mem[`pt${hit.slot}`]) {
      // One point per cast, however many times the spell hits.
      t.mem[`pt${hit.slot}`] = 1;
      t.addRes(1);
    }
  },
  afterCast(t, slot) {
    if (slot < 3) t.mem[`pt${slot}`] = 0;
  },
  castMods(t, slot) {
    // Umbral Blink is her heavy dive: 35% more damage on a 5 s cooldown (kit).
    if (slot === 0) return { power: 1.35 };
    if (slot !== 3 || t.res <= 0) return {};
    const points = t.res;
    t.res = 0;
    t.say(`${points} COMBO`, '#d9b8ff');
    return { power: 1 + 0.15 * points };
  },
  badge: (t) => (t.res > 0 ? String(t.res) : ''),
};
