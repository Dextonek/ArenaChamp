import { addGroundWiper } from './ground';
import * as THREE from 'three';
import type { CastContext } from '../effects/targeting';
import { Bloom, GROVE } from '../effects/parts/grove';
import type { Obstacle } from '../obstacles';
import type { GroundMark, Trait } from './types';

/**
 * Fenna (support, v5). Passive Living Garden: her Seed Shot and Pollen Glide plant a flower where they land (at most 4, the
 * oldest goes, 7 s each). Within 3 m of her flowers she heals 3 HP a second per flower (at most 2 flowers count), or 4 per
 * flower within 6 m of a standing World Tree: at most 8 HP a second. An enemy within 1.5 m of a flower is slowed (0.6 s,
 * refreshed every 0.4 s); one that stands within 1 m of a flower for 0.6 s in all tramples it. Her Strangle Vine roots 1.4 s
 * instead of 1.0 s when the enemy is within 3 m of a flower. Basic attack: a ranged petal (5.5 m).
 *
 * The flowers and the tree are state that outlives every spell, so they live here, in WeakMaps keyed by her figure, and the
 * spell effects add to them at the moment they land, on both screens (`plantFlower`, `raiseTree`). `marks` draws the
 * flowers and ages them out (both screens, every frame) and writes the clock the effects read (`gardenNow`). `tick` (her own
 * client) heals; `victimTick` (the victim's screen) slows and tramples, and tells her client which flower went with
 * `noteOwner('trample', id)`, which `peerNote` turns into the same removal. Ids are 0..19 (the message clamps to 0-20).
 */

export const FLOWER_LIFE = 7;
export const MAX_FLOWERS = 4;
export const GARDEN_R = 3;
export const SLOW_R = 1.5;
export const TRAMPLE_R = 1;
export const TRAMPLE_S = 0.6;
export const HEAL_PER_FLOWER = 3;
export const HEAL_MAX_FLOWERS = 2;
export const TREE_HEAL_R = 6;
export const TREE_HEAL_PER_FLOWER = 4;
export const NEAR_FLOWER_R = 3;
/** World Tree: seconds from the cast to the burst, and seconds it then stands. */
export const TREE_BURST_S = 1.2;
export const TREE_LIFE_S = 8;
const PUFF_LIFE = 0.55;

export interface Flower { id: number; x: number; z: number; born: number }

interface Garden { flowers: Flower[]; puffs: { x: number; z: number; born: number }[]; next: number }

/** A World Tree: where, when it was cast (garden clock), and the obstacle it stands as. `upAt` >= 0: it was uprooted then. */
export interface WorldTree {
  x: number;
  z: number;
  cast: number;
  burst: number;
  until: number;
  upAt: number;
  obstacle: Obstacle | null;
  ctx: CastContext | null;
}

const gardens = new WeakMap<object, Garden>();
const clocks = new WeakMap<object, number>();
const trees = new WeakMap<object, WorldTree>();
/** Seconds each flower has been stood on (the victim's screen). */
const stomps = new WeakMap<Flower, number>();

/** The seconds a figure's trait last wrote (its round clock); in the VFX tool, where no trait runs, real time. */
export function gardenNow(fig: object): number {
  return clocks.get(fig) ?? performance.now() / 1000;
}

/** True when a trait is writing this figure's clock (a duel): the effects then leave the flowers to `marks`. */
export function gardenLive(fig: object): boolean {
  return clocks.has(fig);
}

/** Writes the clock. A clock that went back (a new round) or flowers from the future (the tool's real time) empty the garden. */
function syncClock(fig: object, time: number) {
  const prev = clocks.get(fig);
  const g = gardens.get(fig);
  const tree = trees.get(fig);
  if (prev !== undefined && time < prev - 0.5) { gardens.delete(fig); trees.delete(fig); }
  else {
    if (g && g.flowers.some((f) => f.born > time + 0.5)) gardens.delete(fig);
    if (tree && tree.cast > time + 0.5) trees.delete(fig);
  }
  clocks.set(fig, time);
}

function garden(fig: object): Garden {
  let g = gardens.get(fig);
  if (!g) { g = { flowers: [], puffs: [], next: 0 }; gardens.set(fig, g); }
  return g;
}

export function flowersOf(fig: object): readonly Flower[] {
  return gardens.get(fig)?.flowers ?? [];
}

/** Plants a flower for `fig` now (the oldest goes past 4). Call it at the moment a spell lands, on both screens. */
export function plantFlower(fig: object, x: number, z: number): Flower {
  const g = garden(fig);
  const f: Flower = { id: g.next, x, z, born: gardenNow(fig) };
  g.next = (g.next + 1) % 20;
  g.flowers.push(f);
  while (g.flowers.length > MAX_FLOWERS) g.flowers.shift();
  return f;
}

/** Removes a flower that aged out (no puff). */
export function removeFlower(fig: object, id: number): boolean {
  const g = gardens.get(fig);
  const i = g ? g.flowers.findIndex((f) => f.id === id) : -1;
  if (!g || i < 0) return false;
  g.flowers.splice(i, 1);
  return true;
}

/** A flower trampled: removed, with a stomp puff where it stood. */
export function trampleFlower(fig: object, id: number): boolean {
  const g = gardens.get(fig);
  const f = g?.flowers.find((x) => x.id === id);
  if (!g || !f) return false;
  removeFlower(fig, id);
  g.puffs.push({ x: f.x, z: f.z, born: gardenNow(fig) });
  return true;
}

function prune(fig: object, now: number) {
  const g = gardens.get(fig);
  if (!g) return;
  for (const f of g.flowers.filter((x) => now - x.born >= FLOWER_LIFE)) removeFlower(fig, f.id);
  g.puffs = g.puffs.filter((p) => now - p.born < PUFF_LIFE);
}

/** A World Tree is cast at (x, z) now. Replaces any earlier record. */
export function raiseTree(fig: object, x: number, z: number): WorldTree {
  const cast = gardenNow(fig);
  const t: WorldTree = { x, z, cast, burst: cast + TREE_BURST_S, until: cast + TREE_BURST_S + TREE_LIFE_S, upAt: -1, obstacle: null, ctx: null };
  trees.set(fig, t);
  return t;
}

/** The tree that is cast and not uprooted or over (still sprouting or standing), else null: a second R cast is the Uproot. */
export function treeActive(fig: object): WorldTree | null {
  const t = trees.get(fig);
  if (!t) return null;
  const now = gardenNow(fig);
  return t.upAt < 0 && now < t.until && t.cast <= now + 0.5 ? t : null;
}

/** The tree while it stands (burst, not over, not uprooted), else null. */
export function treeStanding(fig: object): WorldTree | null {
  const t = treeActive(fig);
  return t && gardenNow(fig) >= t.burst ? t : null;
}

/** The record of the last tree even when it is over (the effect that raised it reads `upAt` from it). */
export function treeRecord(fig: object): WorldTree | undefined {
  return trees.get(fig);
}

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

// ---------------------------------------------------------------------------------------------------------------
// Looks of the ground marks
// ---------------------------------------------------------------------------------------------------------------

const flat = (m: THREE.Material) => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };

/** The flower on the ground: a big open bloom on a dark soil disc, a pink ring at the trample reach, a pale one at the slow reach. */
function flowerLook(): THREE.Object3D {
  const g = new THREE.Group();
  const disc = (r: number, color: number, opacity: number, y: number) => {
    const o = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), flat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
    o.position.y = y;
    o.renderOrder = 2;
    g.add(o);
  };
  const ring = (r: number, color: number, opacity: number, y: number) => {
    const o = new THREE.Mesh(new THREE.RingGeometry(r - 0.045, r, 56).rotateX(-Math.PI / 2), flat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
    o.position.y = y;
    o.renderOrder = 3;
    g.add(o);
  };
  disc(SLOW_R, GROVE.body, 0.13, 0.01);
  ring(SLOW_R, GROVE.bark, 0.6, 0.02);
  disc(0.8, GROVE.dark, 0.6, 0.03);
  ring(TRAMPLE_R, GROVE.accent, 0.55, 0.03);
  const b = new Bloom();
  b.open(new THREE.Vector3(0, 0, 0), 0.85, 0.01);
  b.update(1);
  g.add(b.mesh);
  return g;
}

/** A stomp puff: a ring of petals thrown flat across a dark patch. It shrinks away as its short life runs out. */
function puffLook(): THREE.Object3D {
  const g = new THREE.Group();
  const patch = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24).rotateX(-Math.PI / 2), flat(new THREE.MeshBasicMaterial({ color: GROVE.dark, transparent: true, opacity: 0.55, depthWrite: false })));
  patch.position.y = 0.02;
  g.add(patch);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.55), new THREE.MeshBasicMaterial({ color: i % 2 ? GROVE.bark : GROVE.accent }));
    petal.position.set(Math.sin(a) * 0.62, 0.12, Math.cos(a) * 0.62);
    petal.rotation.set(0.25, a, 0, 'YXZ');
    g.add(petal);
  }
  return g;
}

export const groveTrait: Trait = {
  meter: { name: 'FLOWERS', max: MAX_FLOWERS, value: (t) => flowersOf(t.self()).length },
  passive: {
    name: 'Living Garden',
    blurb: 'Seed Shot and Pollen Glide plant a flower where they land (4 at most, 7 s each). Within 3 m of flowers she heals 3 HP a second per flower (2 count), 4 near her tree. An enemy within 1.5 m of a flower is slowed; standing within 1 m for 0.6 s tramples it.',
  },
  speed: 4.0,
  attack: { kind: 'ranged', range: 5.5, damage: 10, interval: 0.7, windup: 0.18, speed: 20, look: 'petal' },
  recast: { slot: 3, window: 9.2, arm: 1.3, name: 'Uproot', power: 1 },
  // The CPU Uproots only with the enemy in the thorns' reach.
  aiHold(t, slot) {
    const tree = slot === 3 ? treeActive(t.self()) : null, e = t.enemy();
    return !!tree && !!e && Math.hypot(e.group.position.x - tree.x, e.group.position.z - tree.z) > 3;
  },
  markLook: { flower: flowerLook, puff: puffLook },
  marks(t) {
    const fig = t.self();
    syncClock(fig, t.time);
    prune(fig, t.time);
    const g = gardens.get(fig);
    if (!g) return [];
    const out: GroundMark[] = g.flowers.map((f) => ({ x: f.x, z: f.z, kind: 'flower', age: t.time - f.born, life: FLOWER_LIFE }));
    for (const p of g.puffs) out.push({ x: p.x, z: p.z, kind: 'puff', age: t.time - p.born, life: PUFF_LIFE });
    return out;
  },
  // Her own client: the heal. Every frame (heals are batched by the host).
  tick(t, dt) {
    const fig = t.self();
    syncClock(fig, t.time);
    prune(fig, t.time);
    const flowers = flowersOf(fig);
    if (!flowers.length || t.hp() >= t.maxHp()) return;
    const pos = fig.group.position;
    const tree = treeStanding(fig);
    const rates: number[] = [];
    for (const f of flowers) {
      if (dist(pos.x, pos.z, f.x, f.z) > GARDEN_R) continue;
      rates.push(tree && dist(f.x, f.z, tree.x, tree.z) <= TREE_HEAL_R ? TREE_HEAL_PER_FLOWER : HEAL_PER_FLOWER);
    }
    rates.sort((a, b) => b - a);
    const rate = rates.slice(0, HEAL_MAX_FLOWERS).reduce((s, r) => s + r, 0);
    if (rate > 0) t.heal(rate * dt);
  },
  // The victim's screen: the slow near a flower and the trample.
  victimTick(t, dt) {
    const foe = t.enemy();
    const fig = t.self();
    const g = gardens.get(fig);
    t.mem.slowT = (t.mem.slowT ?? 0) - dt;
    if (!foe || !g || !g.flowers.length) return;
    const p = foe.group.position;
    let slow = false;
    for (const f of g.flowers.slice()) {
      const d = dist(p.x, p.z, f.x, f.z);
      if (d <= SLOW_R) slow = true;
      if (d > TRAMPLE_R) continue;
      const s = (stomps.get(f) ?? 0) + dt;
      if (s >= TRAMPLE_S) {
        trampleFlower(fig, f.id);
        t.noteOwner('trample', f.id);
      } else stomps.set(f, s);
    }
    if (slow && t.mem.slowT <= 0) {
      t.mem.slowT = 0.4;
      t.hitEnemy({ damage: 0, knock: 0, status: { kind: 'slow', seconds: 0.6 } });
    }
  },
  peerNote(t, name, n) {
    if (name === 'trample') trampleFlower(t.self(), n);
  },
  // The CPU walks to the nearest flower within 3 m of it and tramples it.
  enemyGoal(t) {
    const foe = t.enemy();
    const g = gardens.get(t.self());
    if (!foe || !g) return null;
    const p = foe.group.position;
    let best: Flower | null = null, bd = NEAR_FLOWER_R;
    for (const f of g.flowers) {
      const d = dist(p.x, p.z, f.x, f.z);
      if (d <= bd) { bd = d; best = f; }
    }
    return best ? { x: best.x, z: best.z } : null;
  },
  badge(t) {
    const n = flowersOf(t.self()).length;
    return n > 0 ? String(n) : '';
  },
};

addGroundWiper((owner, x, z, r) => {
  const g = gardens.get(owner);
  if (g) g.flowers = g.flowers.filter((f) => Math.hypot(f.x - x, f.z - z) > r);
});
