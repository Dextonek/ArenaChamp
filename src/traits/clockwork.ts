import type { Trait } from './types';

/** How near her turret a cast must be for Overclock (m), and the share of cooldown it saves. */
const STATION = 5;
const SAVE = 0.15;

/**
 * Ada (summoner). Passive Overclock: a spell she casts within 5 m of one of her turrets gets a 15% shorter cooldown
 * (an engineer at her station). Twist Scrap: her hits on the enemy make scrap, every third attack extra; Cog Turret
 * with 50 scrap spends it and that turret shoots 20% harder.
 */
export const clockworkTrait: Trait = {
  passive: { name: 'Overclock', blurb: 'A spell she casts within 5 m of her turret cools down 15% faster.' },
  twist: { name: 'Scrap', blurb: 'Her hits on the enemy make scrap, every third attack extra. Cog Turret with 50 scrap spends it: that turret shoots 20% harder.' },
  resource: { name: 'Scrap', max: 100, color: '#d9a066', start: 0 },
  speed: 3.9,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1, windup: 0.25, speed: 18, look: 'rivet' },
  castMods(t, slot) {
    if (slot === 1 && t.res >= 50) {
      t.res -= 50;
      t.say('UPGRADED', '#ffd9a0');
      return { power: 1.2 };
    }
    // Rivet Shot hits twice now (it sticks and pops): its first hit is a little lighter.
    return slot === 0 ? { power: 0.9 } : {};
  },
  cooldown(t, _slot, base) {
    const p = t.self().group.position;
    if (!t.units().some((u) => Math.hypot(u.x - p.x, u.z - p.z) <= STATION)) return base;
    t.say('OVERCLOCK', '#ffd9a0');
    return base * (1 - SAVE);
  },
  landed(t, hit) {
    if (!hit.victimIsHero) return;
    if (hit.kind === 'attack') {
      const n = (t.mem.hits ?? 0) + 1;
      t.mem.hits = n % 3;
      t.addRes(n % 3 === 0 ? 10 : 3);
    } else if (hit.kind === 'spell') {
      t.addRes(5);
    }
  },
  badge(t) {
    const p = t.self().group.position;
    const near = t.units().some((u) => Math.hypot(u.x - p.x, u.z - p.z) <= STATION);
    const scrap = t.res >= 50 ? `${Math.floor(t.res)}!` : t.res > 0 ? String(Math.floor(t.res)) : '';
    return near ? `OC ${scrap}`.trim() : scrap;
  },
};
