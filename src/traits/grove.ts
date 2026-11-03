import type { Trait } from './types';

/**
 * Fenna (support). Passive Regrowth: heals 4% of her max HP per second while she has not been hit for 1.5 s. Twist Seeds:
 * her other hits plant a seed on the enemy (max 4, 6 s); Bloom Lash plants two on a bare enemy and blooms a seeded one:
 * root 0.45 s per seed. Seed of Rebirth (R): for 5 s, one hit that would drop her under 15% HP blooms her back up by
 * 35% of her max instead (a lethal hit leaves her on 1 HP first); unused, it blooms at the end for a small heal.
 */

/** Seed of Rebirth: seconds it hangs on her, the HP share it guards, the heal when it triggers, the heal if it does not. */
const SEED_S = 5;
const SEED_FLOOR = 0.15;
const SEED_HEAL = 0.35;
const SEED_END_HEAL = 0.06;
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
    if (slot !== 3) return;
    t.mem.seedUntil = t.time + SEED_S;
    t.mem.seedUsed = 0;
  },
  // Bloom Lash lost its self-heal: it hits a little harder instead.
  castMods: (_t, slot) => (slot === 0 ? { power: 1.15 } : {}),
  taken(t, hit) {
    t.mem.lastHit = t.time;
    if (t.time >= (t.mem.seedUntil ?? 0) || t.mem.seedUsed || hit.damage <= 0) return;
    const hp = t.hp(), max = t.maxHp();
    if (hp - hit.damage >= max * SEED_FLOOR) return;
    // Cheat death: a lethal hit leaves her on 1 HP, then the seed blooms and heals her (the heal lands before the hit).
    t.mem.seedUsed = 1;
    hit.damage = Math.min(hit.damage, Math.max(0, hp - 1));
    t.heal(Math.round(max * SEED_HEAL));
    t.say('REBIRTH', '#ff9fd0');
  },
  tick(t, dt) {
    // The seed ran out unused: it blooms for a small heal.
    if (t.mem.seedUntil && t.time >= t.mem.seedUntil) {
      if (!t.mem.seedUsed) t.heal(Math.round(t.maxHp() * SEED_END_HEAL));
      t.mem.seedUntil = 0;
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
