import type { Trait } from './types';

/**
 * Lyra (marksman). Passive Focus: standing still powers up Starshot (+5% damage per second, max +20%); moving resets
 * it. Twist Ammo Q: Starshot has 3 charges, one back every 3 s, instead of a cooldown. Long shot: Starshot deals 20%
 * more to an enemy beyond 8 m (it no longer bounces). (The design's "+range" with Focus is not buildable: a trait
 * cannot change a spell's range, so it is damage only.)
 */
export const astralTrait: Trait = {
  passive: { name: 'Focus', blurb: 'Each second she stands still adds 5% damage to Starshot (max +20%). Moving resets it. Starshot deals 20% more to an enemy beyond 8 m.' },
  twist: { name: 'Starshot ammo', blurb: 'Starshot has 3 charges instead of a cooldown; one comes back every 3 seconds.' },
  speed: 4.0,
  attack: { kind: 'ranged', range: 8.5, damage: 13, interval: 1.4, windup: 0.32, speed: 24, look: 'arrow' },
  charges: { slot: 0, count: 3, every: 3 },
  castMods(t, slot) {
    if (slot !== 0) return {};
    return { power: 1 + Math.min(0.2, 0.05 * t.still) };
  },
  dealt(t, hit) {
    if (hit.kind === 'spell' && hit.slot === 0 && hit.victimIsHero && t.enemyDistance() > 8) {
      hit.damage *= 1.2;
      t.say('LONG SHOT', '#fff0b0');
    }
  },
  badge(t) {
    const pct = Math.round(Math.min(20, 5 * Math.floor(t.still)));
    return pct > 0 ? `+${pct}%` : '';
  },
};
