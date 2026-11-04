import * as THREE from 'three';
import type { MinionLook } from '../effects/parts/minion';
import { MASON_CSS, GERALD_HEIGHT, GERALD_RADIUS, buildAura, buildDust, buildGerald, buildRubble, type GeraldMood } from '../effects/parts/mason';
import type { SummonUnit } from '../effects/summon';
import type { CastContext } from '../effects/targeting';
import { pillar, type Obstacle } from '../obstacles';
import type { GroundMark, Trait, TraitView } from './types';

/** Gerald: his HP, the round that makes Bram take less, how near he must be for the shove, how far a lean reaches. */
export const GERALD_HP = 220;
export const AURA_RADIUS = 3;
export const AURA_REDUCTION = 0.15;
export const SHOVE_REACH = 3;
export const LEAN_REACH = 8;
/** Rubble a crash leaves: seconds it lies, how close to its line counts as standing on it, how often the slow is refreshed. */
export const RUBBLE_LIFE = 3;
export const RUBBLE_REACH = 0.9;
const SLOW_TICK = 0.3;
const SLOW_SECONDS = 0.6;
const HEAP_LIFE = 4;
const DUST_LIFE = 1.2;
const ANGRY_SECONDS = 1.2;
/** An obstacle that has no end of its own: a round is far shorter. */
const FOREVER = 3600;

/** A heap of broken stone where Gerald (or a Gerald that was replaced) fell. */
export interface RubbleHeap { x: number; z: number; yaw: number; born: number; life: number }
/** What a crash left: a line of rubble that slows (`born` on Gerald's clock). */
export interface RubbleLine { ax: number; az: number; bx: number; bz: number; born: number }

/**
 * Gerald's record, per Bram figure (the effects play on both screens, so they and the trait share it through this map).
 * `x`, `z`: where he stands now (the shove moves them every frame). `obstacle`, `unit`: the engine's real obstacle and the
 * hidden 220 HP `turret` at his spot. `mood` holds until `moodUntil` (on his clock), then he is bored. The rest is
 * bookkeeping: `moving` (a shove runs), `toppling` (R runs: the effect draws him), `sorry` (the trait says SORRY GERALD once).
 */
export interface GeraldState {
  x: number;
  z: number;
  hp: number;
  obstacle: Obstacle | null;
  unit: SummonUnit | null;
  mood: GeraldMood;
  alive: boolean;
  /** Counts every end of a Gerald (a drop, a break, a new round): an effect that was mid-move checks it and lets go. */
  epoch: number;
  moodUntil: number;
  raisedAt: number;
  moving: boolean;
  toppling: boolean;
  sorry: boolean;
  /** The trait's round clock, written by `marks` on both screens; undefined in the VFX tool (no trait runs there). */
  clock: number | undefined;
  /** Any cast context of this hero: `removeObstacle` is the arena's and takes any. */
  ctx: CastContext | null;
  heaps: RubbleHeap[];
  lines: RubbleLine[];
  dusts: { x: number; z: number; born: number }[];
}

const states = new WeakMap<object, GeraldState>();

export function geraldOf(fig: object): GeraldState {
  let s = states.get(fig);
  if (!s) {
    s = {
      x: 0, z: 0, hp: 0, obstacle: null, unit: null, mood: 'bored', alive: false, epoch: 0, moodUntil: 0, raisedAt: 0, moving: false,
      toppling: false, sorry: false, clock: undefined, ctx: null, heaps: [], lines: [], dusts: [],
    };
    states.set(fig, s);
  }
  return s;
}

/** Gerald's clock: the trait's round time in a duel, real time in the VFX tool. */
export function geraldNow(fig: object): number {
  return geraldOf(fig).clock ?? performance.now() / 1000;
}

/** True when a trait is running this figure (a duel): `marks` draws Gerald. In the VFX tool the effects draw him themselves. */
export function geraldLive(fig: object): boolean {
  return geraldOf(fig).clock !== undefined;
}

export function setGeraldMood(fig: object, mood: GeraldMood, seconds: number) {
  const g = geraldOf(fig);
  g.mood = mood;
  g.moodUntil = geraldNow(fig) + seconds;
}

/** The mood he shows now. */
export function moodNow(fig: object): GeraldMood {
  const g = geraldOf(fig);
  return geraldNow(fig) < g.moodUntil ? g.mood : 'bored';
}

/** True while Gerald stands (a shove may be moving him), so a spell can use him. */
export function geraldHere(g: GeraldState) {
  return g.alive && !g.toppling;
}

/** Spots a heap of rubble. */
export function addHeap(fig: object, x: number, z: number, life = HEAP_LIFE) {
  const g = geraldOf(fig);
  const now = geraldNow(fig);
  g.heaps.push({ x, z, yaw: (x * 7.3 + z * 3.1) % 6.28, born: now, life });
  g.dusts.push({ x, z, born: now });
  if (g.heaps.length > 8) g.heaps.shift();
  if (g.dusts.length > 8) g.dusts.shift();
}

/**
 * Takes Gerald away: the obstacle goes, the unit is expired (`left = 0`: it ends next tick with `slain` false, which the
 * `onDeath` guard ignores, so no word), and a heap of rubble stays at his spot when `heap` is set. The word is not said here.
 */
export function dropGerald(fig: object, heap: boolean) {
  const g = geraldOf(fig);
  if (!g.alive && !g.obstacle && !g.unit) return;
  const u = g.unit;
  g.unit = null;
  if (u && u.alive) u.left = 0;
  if (g.obstacle) g.ctx?.removeObstacle?.(g.obstacle);
  g.obstacle = null;
  if (g.alive && heap) addHeap(fig, g.x, g.z);
  g.epoch++;
  g.alive = false;
  g.moving = false;
  g.toppling = false;
}

/** His hidden unit: nothing to draw (the mark does that), a bar over the pillar's top. */
const HIDDEN: MinionLook = () => ({ root: new THREE.Group(), animate() { /* no figure */ }, barY: GERALD_HEIGHT + 0.5 });

/**
 * Raises Gerald at (x, z): any old Gerald crumbles (no word), then the unit (made first so the engine does not push it out)
 * and the obstacle. Both screens call it with the same spot (from `sentFrom` and `point`). Without `ctx.summon` (a network
 * duel) he has no HP and cannot be broken.
 */
export function raiseGeraldAt(fig: object, ctx: CastContext, x: number, z: number) {
  dropGerald(fig, true);
  const g = geraldOf(fig);
  g.ctx = ctx;
  g.x = x;
  g.z = z;
  g.hp = GERALD_HP;
  g.epoch++;
  g.alive = true;
  g.moving = g.toppling = g.sorry = false;
  g.raisedAt = geraldNow(fig);
  setGeraldMood(fig, 'alarmed', 0.9);
  const sm = ctx.summon?.({
    kind: 'turret', at: new THREE.Vector3(x, 0, z), hp: GERALD_HP, seconds: FOREVER, damage: 0, attackEvery: 999, range: 0.01,
    color: MASON_CSS.body, look: HIDDEN,
  });
  g.unit = sm?.units[0] ?? null;
  sm?.onDeath((u) => {
    // Only a break by damage counts; a Gerald we removed ourselves has already let go of this unit.
    if (g.unit !== u || !u.slain) return;
    g.unit = null;
    if (g.obstacle) g.ctx?.removeObstacle?.(g.obstacle);
    g.obstacle = null;
    addHeap(fig, g.x, g.z);
    g.epoch++;
    g.alive = false;
    g.moving = g.toppling = false;
    g.sorry = true;
  });
  const o = pillar(x, z, GERALD_RADIUS);
  o.height = GERALD_HEIGHT;
  g.obstacle = ctx.addObstacle ? ctx.addObstacle(o, FOREVER) : null;
}

/** Puts Gerald's obstacle back at his (new) spot after a shove. */
export function standGerald(fig: object, ctx: CastContext, x: number, z: number) {
  const g = geraldOf(fig);
  g.ctx = ctx;
  g.x = x;
  g.z = z;
  if (g.obstacle) ctx.removeObstacle?.(g.obstacle);
  const o = pillar(x, z, GERALD_RADIUS);
  o.height = GERALD_HEIGHT;
  g.obstacle = ctx.addObstacle ? ctx.addObstacle(o, FOREVER) : null;
}

/** The unit follows him and keeps his HP in the record; a drop in HP makes him furious. Called every frame on both screens. */
function syncGerald(fig: object, g: GeraldState) {
  const u = g.unit;
  if (!g.alive || !u || !u.alive) return;
  // A knock from a hit would push the unit out of the pillar (and a shove moves him): hold it on his spot.
  u.pos.set(g.x, 0, g.z);
  u.knock.set(0, 0, 0);
  if (u.hp < g.hp - 1e-3) setGeraldMood(fig, 'angry', ANGRY_SECONDS);
  g.hp = u.hp;
}

/** A new round clears the arena's obstacles and units without a word to us: forget Gerald (`mem` is cleared each round). */
function roundCheck(t: TraitView, g: GeraldState) {
  if (t.mem.seen) return;
  t.mem.seen = 1;
  g.epoch++;
  g.alive = g.moving = g.toppling = g.sorry = false;
  g.obstacle = null;
  g.unit = null;
  g.heaps = [];
  g.lines = [];
  g.dusts = [];
  g.moodUntil = 0;
}

const distTo = (t: TraitView, g: GeraldState) => {
  const p = t.self().group.position;
  return Math.hypot(p.x - g.x, p.z - g.z);
};

/** Distance from (px, pz) to the segment a-b. */
function segPoint(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const k = l2 > 1e-9 ? Math.min(1, Math.max(0, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + dx * k), pz - (az + dz * k));
}

const MOOD_KIND: Record<GeraldMood, string> = { bored: 'gerald', alarmed: 'gerald-alarmed', angry: 'gerald-angry' };

/**
 * Bram (bruiser, melee). Passive Best Friends: Gerald, one pillar at most, a real obstacle with 220 HP and a face that
 * changes (bored, alarmed in a shove, furious when hit). Within 3 m of him Bram takes 15% less (`taken`); a faint chalk ring
 * round Gerald shows that distance (a mark: a hero's `ring` sits at the hero's feet, not at Gerald's). Gerald is drawn by
 * `marks` (so no later cast can cut him off): his record lives in `geraldOf`, written by the effects on both screens.
 * Q Raise Gerald, W The Shove, E A Good Lean and R Gerald, No! need him (`canCast`); the CPU holds them without him.
 * See pipeline/designs/kit-mason.md.
 */
export const masonTrait: Trait = {
  passive: {
    name: 'Best Friends',
    blurb: 'Gerald: one pillar, a real wall with 220 HP and a carved face that changes. Within 3 m of him Bram takes 15% less damage. Break him or fight away from him.',
  },
  twist: { name: 'Cover, weapon or escape?', blurb: 'Gerald is cover, a thrown weapon and a way in. Each use spends one of the others.' },
  speed: 3.8,
  attack: { kind: 'melee', range: 2.5, damage: 18, interval: 1.2, windup: 0.35, speed: 0, look: 'smash' },
  ownLook: { gerald: { color: '#c9b48a', shape: 'gem' } },
  markLook: {
    gerald: () => buildGerald('bored'),
    'gerald-alarmed': () => buildGerald('alarmed'),
    'gerald-angry': () => buildGerald('angry'),
    geraldAura: () => buildAura(AURA_RADIUS),
    rubble: buildRubble,
    dust: buildDust,
  },
  // Both screens, every frame: the round check, his unit held on his spot, and everything drawn on the ground.
  marks(t) {
    const fig = t.self();
    const g = geraldOf(fig);
    roundCheck(t, g);
    const now = t.time;
    g.clock = now;
    syncGerald(fig, g);
    const out: GroundMark[] = [];
    if (geraldHere(g)) {
      // He looks at the enemy (else at the middle of the ring).
      const e = t.enemy();
      const tx = e ? e.group.position.x : 0, tz = e ? e.group.position.z : 7;
      const age = now - g.raisedAt;
      const yaw = Math.atan2(tx - g.x, tz - g.z);
      out.push({ x: g.x, z: g.z, kind: MOOD_KIND[moodNow(fig)], yaw, age, life: age + 10 });
      out.push({ x: g.x, z: g.z, kind: 'geraldAura', age, life: age + 10 });
    }
    g.heaps = g.heaps.filter((h) => now - h.born < h.life);
    g.dusts = g.dusts.filter((d) => now - d.born < DUST_LIFE);
    g.lines = g.lines.filter((l) => now - l.born < RUBBLE_LIFE);
    for (const h of g.heaps) out.push({ x: h.x, z: h.z, kind: 'rubble', yaw: h.yaw, age: now - h.born, life: h.life });
    for (const d of g.dusts) out.push({ x: d.x, z: d.z, kind: 'dust', age: now - d.born, life: DUST_LIFE });
    for (const l of g.lines) {
      const len = Math.hypot(l.bx - l.ax, l.bz - l.az);
      const n = Math.max(1, Math.round(len / 1.25));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        out.push({ x: l.ax + (l.bx - l.ax) * k, z: l.az + (l.bz - l.az) * k, kind: 'rubble', yaw: i * 1.9 + l.born, age: now - l.born, life: RUBBLE_LIFE });
      }
    }
    return out;
  },
  // The victim's screen: the rubble a crash left slows whoever stands on it.
  victimTick(t, dt) {
    const g = geraldOf(t.self());
    const foe = t.enemy();
    t.mem.slowT = (t.mem.slowT ?? 0) - dt;
    if (!foe || g.lines.length === 0 || t.mem.slowT > 0) return;
    const now = t.time, p = foe.group.position;
    for (const l of g.lines) {
      if (now - l.born >= RUBBLE_LIFE || segPoint(l.ax, l.az, l.bx, l.bz, p.x, p.z) > RUBBLE_REACH) continue;
      t.mem.slowT = SLOW_TICK;
      t.hitEnemy({ damage: 0, knock: 0, status: { kind: 'slow', seconds: SLOW_SECONDS } });
      return;
    }
  },
  // Bram's own client: 15% less within 3 m of a standing Gerald.
  taken(t, hit) {
    const g = geraldOf(t.self());
    if (geraldHere(g) && distTo(t, g) <= AURA_RADIUS) hit.damage = Math.round(hit.damage * (1 - AURA_REDUCTION));
  },
  canCast(t, slot) {
    if (slot === 0) return null;
    const g = geraldOf(t.self());
    if (!geraldHere(g)) return 'Raise Gerald first';
    if (g.moving) return 'Gerald is busy';
    const d = distTo(t, g);
    if (slot === 1 && d > SHOVE_REACH) return 'Too far from Gerald';
    if (slot === 2 && d > LEAN_REACH) return 'Too far from Gerald';
    return null;
  },
  afterCast(t, slot) {
    if (slot === 1) t.say('EXCUSE ME', MASON_CSS.hot);
    if (slot === 2) {
      // A reluctant hug: the shield, and a word.
      t.shield(60, 2);
      t.say('HUG', MASON_CSS.foil);
    }
    if (slot === 3) {
      t.say('GERALD, NO!', MASON_CSS.fury);
      t.show('gerald', 0);
    }
  },
  tick(t) {
    const fig = t.self();
    const g = geraldOf(fig);
    roundCheck(t, g);
    t.show('gerald', geraldHere(g) ? 1 : 0);
    if (g.sorry) {
      g.sorry = false;
      t.say('SORRY GERALD', MASON_CSS.hot);
    }
  },
  badge(t) {
    const g = geraldOf(t.self());
    return geraldHere(g) ? String(Math.max(0, Math.round(g.hp))) : '';
  },
  // The CPU without Gerald raises him first (Q); with him it uses the rest only where they can work.
  aiHold(t, slot) {
    const g = geraldOf(t.self());
    if (slot === 0) return false;
    if (!geraldHere(g) || g.moving) return true;
    const e = t.enemy();
    const d = distTo(t, g);
    const fromG = e ? Math.hypot(e.group.position.x - g.x, e.group.position.z - g.z) : Infinity;
    if (slot === 1) return !(d <= SHOVE_REACH && fromG <= 9);
    if (slot === 2) return !(d > 2.5 && d <= LEAN_REACH);
    return !(d <= 4 && fromG <= 9);
  },
};
