import type { Trait } from './types';

/**
 * Fenna (support). Passive Regrowth: heals 4% of her max HP per second while she has not been hit for 1.5 s. Twist Seeds:
 * her other hits plant a seed on the enemy (max 4, 6 s); Bloom Lash plants two on a bare enemy and blooms a seeded one:
 * root 0.45 s per seed. World Blossom heals her 60 more over 3 s.
 */

/** World Blossom's heal over time: total and seconds. */
const BLOSSOM = 60;
const BLOSSOM_S = 3;
export const groveTrait: Trait = {
  passive: { name: 'Regrowth', blurb: 'Heals 4% of her max HP per second while she has not been hit for 1.5 seconds.' },
  twist: { name: 'Seeds', blurb: 'Her hits plant a seed on the enemy (max 4); Bloom Lash plants two. Bloom Lash on a seeded enemy makes them bloom: rooted 0.45 s per seed.' },
  speed: 4.0,
  attack: { kind: 'ranged', range: 5.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'petal' },
  dealt(t, hit) {
    if (!hit.victimIsHero) return;
    const seeds = t.stacks('seed');
    if (hit.kind === 'spell' && hit.slot === 0 && seeds > 0) {
      hit.opts.status = { kind: 'root', seconds: 0.45 * seeds };
      t.clearStacks('seed');
      t.say('BLOOM', '#ff9fd0');
    } else {
      t.addStacks('seed', hit.kind === 'spell' && hit.slot === 0 ? 2 : 1, 6, 4);
    }
  },
  afterCast(t, slot) {
    if (slot === 3) t.mem.bloomUntil = t.time + BLOSSOM_S;
  },
  // Bloom Lash lost its self-heal: it hits a little harder instead.
  castMods: (_t, slot) => (slot === 0 ? { power: 1.15 } : {}),
  taken(t) {
    t.mem.lastHit = t.time;
  },
  tick(t, dt) {
    if (t.time < (t.mem.bloomUntil ?? 0)) {
      t.mem.bloomHeal = (t.mem.bloomHeal ?? 0) + (BLOSSOM / BLOSSOM_S) * dt;
      if (t.mem.bloomHeal >= 5) { t.heal(Math.floor(t.mem.bloomHeal)); t.mem.bloomHeal -= Math.floor(t.mem.bloomHeal); }
    }
    if (t.hp() >= t.maxHp()) return;
    if (t.time - (t.mem.lastHit ?? -99) >= 1.5 && t.hp() < t.maxHp()) {
      // Healed in chunks of 5+: one green number every few frames, not one per frame (and fewer heal messages online).
      t.mem.regen = (t.mem.regen ?? 0) + t.maxHp() * 0.04 * dt;
      if (t.mem.regen >= 5) { t.heal(Math.floor(t.mem.regen)); t.mem.regen -= Math.floor(t.mem.regen); }
    }
  },
  badge(t) {
    const n = t.stacks('seed');
    return n > 0 ? String(n) : '';
  },
};
