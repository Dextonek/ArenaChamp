import * as THREE from 'three';
import type { Enemy } from '../effects/common';
import { shornBodies, sheepLook, sheepMarkLook, SHEEP_CSS } from '../effects/parts/sheep';
import { MAX_UNITS, type Summon, type SummonUnit } from '../effects/summon';
import type { CastContext } from '../effects/targeting';
import type { GroundMark, Trait } from './types';

/** Crook Whack (Q): a cone, its reach, width (degrees, full), damage and wind-up (the root on Bo). */
export const CROOK_REACH = 4;
export const CROOK_ANGLE = 100;
export const CROOK_DAMAGE = 45;
export const CROOK_WIND = 0.55;

/** Spare Sheep (W): reach, how many, how long they live, and when the flung sheep land. */
export const SPARE_RANGE = 8;
export const SPARE_COUNT = 3;
export const SPARE_SECONDS = 6;
export const SPARE_LAND = 0.5;

/** The sheep: HP, the bump a sheep makes, how often, and how fast it walks. */
export const SHEEP_HP = 30;
export const SHEEP_DAMAGE = 5;
export const SHEEP_EVERY = 1.1;
export const SHEEP_SPEED = 3.4;
/** A sheared sheep trots this much faster. */
export const SHORN_SPEED = 1.5;

/** Shear (E): the nearest sheep within this reach is sheared; the wool bolt's damage, Wool, wind-up, speed, range and radius. */
export const SHEAR_REACH = 6;
export const SHEAR_DAMAGE = 40;
export const SHEAR_WOOL = 3;
export const SHEAR_WIND = 0.25;
export const SHEAR_SPEED = 20;
export const SHEAR_RANGE = 8;
export const SHEAR_RADIUS = 0.3;

/** Stampede (R): sheep, line length and width, wind-up, speed, damage per sheep, hits one victim takes at most, and a sheep's reach. */
export const STAMPEDE_COUNT = 8;
export const STAMPEDE_LENGTH = 12;
export const STAMPEDE_WIDTH = 4;
export const STAMPEDE_WIND = 0.8;
export const STAMPEDE_SPEED = 8;
export const STAMPEDE_DAMAGE = 25;
export const STAMPEDE_MAX_HITS = 3;
export const STAMPEDE_REACH = 0.75;

/** Wool: how long a stack lasts (s), how many make a sheep of the enemy, and how long they are one (s); their size then. */
export const WOOL_SECONDS = 8;
export const WOOL_MAX = 5;
export const BAA_SECONDS = 1;
export const BAA_SCALE = 0.62;

/**
 * What Bo keeps, per figure: `flock` (the sheep his Q and W made, on the screen that simulates them), and `foe` (the enemy hero,
 * written by `tick`, so a sheep's `goal` can tell the hero from the enemy's units). `baaAt`: when the enemy turned into a sheep
 * (`t.time`, read on both screens by `marks`).
 */
export interface SheepBook { flock: SummonUnit[]; foe: Enemy | null; baaAt: number }
export const sheepBooks = new WeakMap<object, SheepBook>();

export function bookOf(who: object): SheepBook {
  let b = sheepBooks.get(who);
  if (!b) { b = { flock: [], foe: null, baaAt: -1 }; sheepBooks.set(who, b); }
  return b;
}

/** The nearest sheep of the flock within `reach` of `from` that still has its wool, or null. */
export function nearestSheep(b: SheepBook, from: THREE.Vector3, reach = SHEAR_REACH): SummonUnit | null {
  let best: SummonUnit | null = null, bd = reach;
  for (const u of b.flock) {
    if (!u.alive || shornBodies.has(u.figure.palette.body)) continue;
    const d = Math.hypot(u.pos.x - from.x, u.pos.z - from.z);
    if (d <= bd) { bd = d; best = u; }
  }
  return best;
}

/**
 * Makes `count` sheep at `at` for Bo (`ctx.summon`; nothing where it is undefined, a network duel). Every sheep walks to the NEARER
 * of Bo and the enemy hero (the P rule: `goal`), and still bumps whoever is in reach. The engine caps a side at 6 units: with
 * four alive, two more are made; with six, none. Returns what was really made.
 */
export function spawnSheep(ctx: CastContext, at: THREE.Vector3, count: number, seconds: number): SummonUnit[] {
  if (!ctx.summon) return [];
  const b = bookOf(ctx.caster), bo = ctx.caster.group.position;
  const handle: Summon = ctx.summon({
    kind: 'melee', at: at.clone(), count, hp: SHEEP_HP, seconds, damage: SHEEP_DAMAGE, attackEvery: SHEEP_EVERY, speed: SHEEP_SPEED,
    color: SHEEP_CSS.wool, look: sheepLook,
    goal: (pos) => {
      const foe = b.foe;
      if (!foe) return null;
      const f = foe.group.position;
      return Math.hypot(f.x - pos.x, f.z - pos.z) <= Math.hypot(bo.x - pos.x, bo.z - pos.z) ? f : bo;
    },
  });
  b.flock = b.flock.filter((u) => u.alive);
  b.flock.push(...handle.units);
  return handle.units;
}

const aliveCount = (b: SheepBook) => b.flock.filter((u) => u.alive).length;

/**
 * Bo, the angry shepherd (summoner, ranged). Passive Wool Over Your Eyes: his sheep walk to whoever is NEAREST, Bo or the enemy.
 * Whatever a sheep's bump, Shear's wool or a Stampede sheep lands on the enemy adds 1 Wool (Shear's ball 3): `addStacks('wool', n, 8, 5)`.
 * At 5 Wool the Wool is gone and the enemy is a sheep for 1 s: *Baa*. They cannot cast (silence), walk slowly (slow), are drawn
 * 62% size with a little sheep over their head and the word BAA. A sheep blocks bolts like any unit and has 30 HP.
 *
 * Where each rule runs. `dealt` (where the hit is decided: the victim's screen online) adds the Wool; `victimTick` (the same screen)
 * sees 5 and turns the enemy into a sheep with two `hitEnemy` status hits, and keeps the 1 s as the hidden `baa` stack, which
 * reaches both screens, so `enemyScale`, `enemyLabel` and `marks` (read on both) draw the same thing. `tick` (Bo's own client, where
 * his units live) keeps `book.foe` for the sheep's `goal` and prunes the flock. `canCast` refuses Shear with no sheep within 6 m and
 * Spare Sheep with a full flock.
 * The CPU (`aiHold`): Q is never held (it casts it within 4 m); W only with the enemy within 8 m; E only with an unsheared sheep within
 * 6 m; R only with the enemy within 10 m.
 */
export const sheepTrait: Trait = {
  passive: {
    name: 'Wool Over Your Eyes',
    blurb: 'His sheep walk to whoever is nearest, Bo or you. Each touch adds Wool; at 5 Wool you are a sheep for 1 s: no casting, slow. A sheep has 30 HP and blocks bolts.',
  },
  twist: {
    name: 'Where He Stands',
    blurb: 'Where Bo stands decides where the flock goes. Stand far from him and they come to you. Kill them, or lead them off.',
  },
  speed: 3.9,
  attack: { kind: 'ranged', range: 6, damage: 9, interval: 0.9, windup: 0.25, speed: 18, look: 'sand', color: '#c9b26a' },
  hiddenStacks: ['baa'],

  aiHold(t, slot, dist) {
    if (slot === 1) return dist > SPARE_RANGE;
    if (slot === 2) return !nearestSheep(bookOf(t.self()), t.self().group.position);
    if (slot === 3) return dist > 10;
    return false;
  },

  canCast(t, slot) {
    const b = bookOf(t.self());
    if (slot === 2 && !nearestSheep(b, t.self().group.position)) return 'No sheep to shear';
    if (slot === 1 && aliveCount(b) >= MAX_UNITS) return 'The flock is full';
    return null;
  },

  afterCast(t, slot) {
    if (slot === 3) t.say('GET BACK HERE!', SHEEP_CSS.rage);
    else if (slot === 2) t.say('HOLD STILL!', SHEEP_CSS.rage);
    else if (slot === 1) t.say('COME ON, LASSES', SHEEP_CSS.hay);
    else if (Math.random() < 0.5) t.say('SHOO!', SHEEP_CSS.rage);
  },

  /** Bo's own client: who the sheep may walk to, and a flock without its dead. */
  tick(t) {
    const b = bookOf(t.self());
    b.foe = t.enemy();
    if (b.flock.length > 0) b.flock = b.flock.filter((u) => u.alive);
  },

  /** Where the hit is decided: a touch of a sheep, Shear's wool or a Stampede sheep adds Wool. */
  dealt(t, hit) {
    if (hit.kind === 'trait' || hit.blocked || !hit.victimIsHero) return;
    if (t.stacks('baa') > 0) return;
    let n = 0;
    if (hit.kind === 'unit') n = 1;
    else if (hit.kind === 'spell' && hit.slot === 2) n = SHEAR_WOOL;
    else if (hit.kind === 'spell' && hit.slot === 3) n = 1;
    if (n > 0) t.addStacks('wool', n, WOOL_SECONDS, WOOL_MAX);
  },

  /** Five Wool: the enemy is a sheep for a second. Where the enemy's hits are decided. */
  victimTick(t) {
    if (t.stacks('wool') < WOOL_MAX || t.stacks('baa') > 0) return;
    t.clearStacks('wool');
    t.addStacks('baa', 1, BAA_SECONDS, 1);
    t.hitEnemy({ damage: 0, knock: 0, color: SHEEP_CSS.accent, status: { kind: 'silence', seconds: BAA_SECONDS } });
    t.hitEnemy({ damage: 0, knock: 0, color: SHEEP_CSS.accent, status: { kind: 'slow', seconds: BAA_SECONDS } });
    t.say('BAA!', SHEEP_CSS.accent);
  },

  /** Both screens: a sheep is small. */
  enemyScale(t) {
    return t.stacks('baa') > 0 ? BAA_SCALE : 1;
  },
  enemyLabel(t) {
    return t.stacks('baa') > 0 ? { text: 'BAA', color: SHEEP_CSS.accent } : null;
  },

  marks(t) {
    const b = bookOf(t.self()), e = t.enemy();
    if (t.stacks('baa') <= 0 || !e) { b.baaAt = -1; return []; }
    if (b.baaAt < 0 || b.baaAt > t.time) b.baaAt = t.time;
    const out: GroundMark[] = [{ x: e.group.position.x, z: e.group.position.z, kind: 'sheep', age: t.time - b.baaAt, life: 2 }];
    return out;
  },
  markLook: { sheep: sheepMarkLook },

  badge(t) {
    const n = aliveCount(bookOf(t.self()));
    return n > 0 ? String(n) : '';
  },
};
