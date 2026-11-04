import type { Trait } from './types';
import { BONE_CSS, skeletonLook } from '../effects/parts/bone';

/** A bone pile stays this long where a summoned unit was slain (his or the enemy's). Both sides count. */
export const PILE_KEEP = 8;
/** Every this-many basic attacks that land raise a small skeleton. */
export const ATTACKS_PER_SKELETON = 5;

/** The small skeleton the fifth basic attack raises. */
const RAISED = { hp: 36, seconds: 6, damage: 7 };

/** Bone Armour: 30 plus 30 per living skeleton, at most 120, for 4 s. */
export const ARMOUR_BASE = 30;
export const ARMOUR_PER_SKELETON = 30;
export const ARMOUR_MAX = 120;
export const ARMOUR_SECONDS = 4;

/**
 * Bone Armour's shield as the trait tracks it, keyed by Mortis's figure. `afterCast` (slot 2) opens it; `taken` adds up
 * the damage he takes meanwhile, and once that has used the shield up `broke` is set; the recast (Shatter)
 * sets it too. The effect (`src/spells/targeted/boneArmour.ts`) reads it: when the armour breaks its shards fly at the
 * enemy at once, else at 3.5 s. On the other screen of a network duel the cast rules never run, so `ownChanged` writes
 * a broke record there when he shows `armourbroke` (born now, so the shards fly at the right moment); without one the
 * shards fly at 3.5 s.
 */
export interface BoneArmourState { amount: number; absorbed: number; broke: boolean; born: number; until: number }
export const boneArmours = new WeakMap<object, BoneArmourState>();

/**
 * Mortis (summoner). Passive Ossuary: every summoned unit that dies by damage, his or the enemy's, leaves a bone pile
 * for 8 s (`deathSpots(8)`, both sides), which his spells use (Bone Fan: a shard per pile near him; Raise Dead: a
 * skeleton per pile near the spot). The piles are drawn on the ground for their full 8 s on both screens (`marks`).
 * Every fifth basic attack that lands raises a small skeleton at his feet. Bone Armour's shield is made here (30 plus 30
 * per living skeleton); a recast (Shatter) breaks it early so the shards fly at once.
 */
export const boneTrait: Trait = {
  passive: {
    name: 'Ossuary',
    blurb: 'Every unit that dies, his or the enemy\'s, leaves a bone pile for 8 s, drawn on the ground for its whole life: Bone Fan throws a shard per pile near him, Raise Dead a skeleton per pile near the spot. Every fifth basic attack that lands raises a small skeleton.',
  },
  speed: 3.8,
  recast: { slot: 2, window: 4, name: 'Shatter', replay: false, arm: 0.3, aiWait: true },
  marks(t) {
    return t.deathSpots(PILE_KEEP).map((d) => ({ x: d.x, z: d.z, kind: 'bones' as const, age: d.age, life: PILE_KEEP }));
  },
  ownChanged(t, name, n) {
    // The other screen: the shards fly now (the effect watches this record).
    if (name === 'armourbroke' && n === 0) boneArmours.delete(t.self());
    if (name === 'armourbroke' && n > 0) boneArmours.set(t.self(), { amount: 0, absorbed: 0, broke: true, born: t.time, until: t.time + 1 });
  },
  recastAct(t, slot) {
    if (slot !== 2) return;
    const a = boneArmours.get(t.self());
    if (a) a.broke = true;
    t.clearShield();
    t.show('armourbroke', 1);
  },
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'bone' },
  afterCast(t, slot) {
    if (slot !== 2) return;
    t.show('armourbroke', 0);
    const n = t.units().length;
    const amount = Math.min(ARMOUR_MAX, ARMOUR_BASE + ARMOUR_PER_SKELETON * n);
    t.shield(amount, ARMOUR_SECONDS);
    boneArmours.set(t.self(), { amount, absorbed: 0, broke: false, born: t.time, until: t.time + ARMOUR_SECONDS });
    t.say(`BONE ARMOUR ${amount}`, BONE_CSS.hot);
  },
  taken(t, hit) {
    const a = boneArmours.get(t.self());
    if (!a || a.broke || hit.blocked || t.time > a.until) return;
    a.absorbed += hit.damage;
    if (a.absorbed >= a.amount) {
      a.broke = true;
      t.show('armourbroke', 1);
    }
  },
  landed(t, hit) {
    if (hit.kind !== 'attack') return;
    t.mem.hits = (t.mem.hits ?? 0) + 1;
    if (t.mem.hits % ATTACKS_PER_SKELETON !== 0) return;
    const raised = t.summon({ kind: 'melee', count: 1, ...RAISED, attackEvery: 1, color: BONE_CSS.body, look: skeletonLook });
    if (raised) t.say('RISE', BONE_CSS.body);
  },
  tick(t) {
    // Drop a finished (or previous round's) armour record.
    const a = boneArmours.get(t.self());
    if (a && (t.time < a.born || t.time > a.until + 1)) boneArmours.delete(t.self());
  },
  badge(t) {
    const piles = t.deathSpots(PILE_KEEP).length;
    const n = (t.mem.hits ?? 0) % ATTACKS_PER_SKELETON;
    return piles > 0 ? `${n}/${ATTACKS_PER_SKELETON} +${piles}` : `${n}/${ATTACKS_PER_SKELETON}`;
  },
};
