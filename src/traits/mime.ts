import * as THREE from 'three';
import type { GroundMark, Trait, TraitView } from './types';
import { MIME_CSS, crumbLook, wallLook } from '../effects/parts/mime';
import { MAX_UNITS, type SummonUnit } from '../effects/summon';
import type { BoltWall } from '../effects/projectile';
import type { CastContext } from '../effects/targeting';
import type { MinionLook } from '../effects/parts/minion';
import { segDist, type Obstacle } from '../obstacles';

/** Invisible Ball (Q): damage, reach (m), speed (m/s), wind-up (s) and the bolt's radius (m; the drawn line is `boltWidth(radius)`). */
export const BALL_DAMAGE = 72;
export const BALL_RANGE = 9;
export const BALL_SPEED = 22;
export const BALL_WIND = 0.3;
export const BALL_RADIUS = 0.3;

/** Wall (W): reach (m), nearest spot (m), length (m), seconds it stands, seconds she draws it, thickness (half, m), the most plain walls at once. */
export const WALL_RANGE = 9;
export const WALL_MIN = 1.5;
export const WALL_LEN = 4;
export const WALL_LIFE = 5;
export const WALL_RISE = 0.5;
export const WALL_R = 0.14;
export const WALL_MAX = 3;
export const WALL_HEIGHT = 2.3;
/** Wall's three charges: one back every `WALL_EVERY` s; `WALL_GAP` s between two casts. */
export const WALL_CHARGES = 3;
export const WALL_EVERY = 3;
export const WALL_GAP = 0.6;
/** The CPU raises a Wall only with the enemy this far away (m). */
export const WALL_AI_MIN = 3;
export const WALL_AI_MAX = 8;

/** Rope Trick (E): reach (m), wind-up (s), the pull (m) and its time (s), damage, and how far a target may step off before it lands (m). */
export const ROPE_RANGE = 7;
export const ROPE_WIND = 0.5;
export const ROPE_PULL = 3;
export const ROPE_PULL_TIME = 0.3;
export const ROPE_DAMAGE = 55;
export const ROPE_SLACK = 2.2;

/** Boxed In (R): reach (m), the wind-up (s), a side (m), seconds it stands once closed, and the nearest spot (m, so she is outside). */
export const BOX_RANGE = 9;
export const BOX_WIND = 0.8;
export const BOX_SIDE = 3;
export const BOX_LIFE = 3;
export const BOX_MIN = 2.4;
export const BOX_AI_MAX = 8;

/** How long a broken wall's chalk lies in pieces (s), and how far ahead (m) her own bolt opens the walls on its path. */
export const CRUMB_SECONDS = 0.7;
const PASS_LOOK = 1.6;

/** One wall. `x1..z2`: its two ends. `bornAt` / `until` are `performance.now()` milliseconds, set when it rises. */
export interface MimeWall {
  /** Unique per figure, the same on both screens (a count of walls made at the casts, wrapping at 900: a `show` value is capped at 999): the break message names it. */
  id: number;
  x1: number; z1: number; x2: number; z2: number;
  box: boolean;
  life: number;
  raised: boolean;
  bornAt: number;
  until: number;
  gone: boolean;
  goneAt: number;
  /** It ended by a hit (not by time or by making room). */
  broke: boolean;
  /** The other screen has been told it broke (or told us). */
  told: boolean;
  /** The obstacle, and whether it stands in the arena now (her own bolt opens it for a moment). */
  o: Obstacle | null;
  inWorld: boolean;
  /** The cast context that made it: removing or putting back the obstacle goes through it. */
  ctx: CastContext | null;
  /** The 1 HP unit that takes the hits (only where `ctx.summon` exists: the screen that decides hits), and the bolt wall. */
  unit: SummonUnit | null;
  bw: BoltWall | null;
}

/** What Mum leaves behind, per figure: the effects play on both screens and the CPU reuses one effect per spell, so the walls live here. */
export interface MimeBook { seq: number; walls: MimeWall[] }
export const mimeBooks = new WeakMap<object, MimeBook>();

export function bookOf(who: object): MimeBook {
  let b = mimeBooks.get(who);
  if (!b) { b = { seq: 0, walls: [] }; mimeBooks.set(who, b); }
  return b;
}

/** The walls that stand now. */
export function liveWalls(b: MimeBook, now = performance.now()) {
  return b.walls.filter((w) => w.raised && !w.gone && now < w.until);
}

/** A wall made at a cast, not raised yet. Writes it to the book (both screens do, so the ids agree). */
export function newWall(b: MimeBook, x1: number, z1: number, x2: number, z2: number, box: boolean, life: number): MimeWall {
  const w: MimeWall = {
    id: (b.seq = (b.seq % 900) + 1), x1, z1, x2, z2, box, life, raised: false, bornAt: 0, until: 0, gone: false, goneAt: 0, broke: false, told: false,
    o: null, inWorld: false, ctx: null, unit: null, bw: null,
  };
  // Forget what ended long ago.
  const now = performance.now();
  b.walls = b.walls.filter((k) => !k.gone || now - k.goneAt < 1500);
  b.walls.push(w);
  return w;
}

/** The summoned unit's look: nothing (the marks draw the wall), and its HP bar is sent far below the floor, so no bar gives the wall away. */
const HIDDEN: MinionLook = () => ({ root: new THREE.Group(), animate() { /* no figure */ }, barY: -300 });

/**
 * Ends a wall now: the obstacle goes, the bolt wall goes, the unit runs out. `broke`: a hit did it. Safe to call twice.
 */
export function dropWall(w: MimeWall, broke: boolean) {
  if (w.gone) return;
  w.gone = true;
  w.broke = broke;
  w.goneAt = performance.now();
  if (w.o && w.inWorld) w.ctx?.removeObstacle?.(w.o);
  w.o = null;
  w.inWorld = false;
  w.bw?.end();
  w.bw = null;
  if (w.unit?.alive) w.unit.left = 0;
}

/**
 * Makes room for `need` more walls: at most `WALL_MAX` plain Walls stand, and her units are capped at `MAX_UNITS` (6) a side, so
 * Box (4) and Walls (3) together can be too many: the oldest wall goes. `keep`: the walls this cast is about to raise.
 */
export function makeRoom(b: MimeBook, need: number, box: boolean, keep: readonly MimeWall[]) {
  for (let guard = 0; guard < 12; guard++) {
    const live = liveWalls(b).filter((w) => !keep.includes(w));
    const oldest = (list: MimeWall[]) => list.reduce((a, c) => (c.bornAt < a.bornAt ? c : a));
    const plain = live.filter((w) => !w.box);
    if (!box && plain.length >= WALL_MAX) dropWall(oldest(plain), false);
    else if (live.length + need > MAX_UNITS) dropWall(oldest(live), false);
    else return;
  }
}

/**
 * Gives a raised wall its 1 HP unit, where `ctx.summon` exists. The cap of 6 counts a unit that was just dropped until the engine's next
 * step, so a Box that drops a wall to make room finds the slot taken: `victimTick` calls this again, one frame later, for any wall
 * still without a unit (the bolt wall covers that frame).
 */
function attachUnit(ctx: CastContext, w: MimeWall) {
  const now = performance.now();
  const sm = ctx.summon?.({
    kind: 'turret', at: new THREE.Vector3((w.x1 + w.x2) / 2, 0, (w.z1 + w.z2) / 2), hp: 1, seconds: Math.max(0.2, (w.until - now) / 1000 + 0.1),
    damage: 0, attackEvery: 999, range: 0.01, color: MIME_CSS.chalk, look: HIDDEN,
  });
  w.unit = sm?.units[0] ?? null;
  sm?.onDeath((u) => dropWall(w, u.slain));
}

/**
 * Raises a wall now: its 1 HP unit first (so the engine does not push it out of the obstacle), then the obstacle (a capsule of
 * `WALL_R`), then a bolt wall on the same segment. A bolt that reaches the wall anywhere along its length stops on the obstacle and
 * is caught by the bolt wall at once: `onBlock` breaks the wall, so "one hit of any size" holds for the whole 4 m, not only near
 * the unit. The unit takes what a bolt does not: basic attacks and spells. Where there is no `ctx.summon` or `ctx.boltWall` (the
 * other screen of a network duel) the wall is still an obstacle and is told when it breaks.
 */
export function raiseWall(ctx: CastContext, w: MimeWall) {
  const now = performance.now();
  w.raised = true;
  w.ctx = ctx;
  w.bornAt = now;
  w.until = now + w.life * 1000;
  attachUnit(ctx, w);
  const o: Obstacle = { ax: w.x1, az: w.z1, bx: w.x2, bz: w.z2, r: WALL_R, height: WALL_HEIGHT, kind: 'wall' };
  w.o = ctx.addObstacle ? ctx.addObstacle(o, w.life) : null;
  w.inWorld = !!w.o;
  w.bw = ctx.boltWall?.({
    a: new THREE.Vector3(w.x1, 0, w.z1), b: new THREE.Vector3(w.x2, 0, w.z2), halfWidth: WALL_R + 0.02, seconds: w.life,
    onBlock: () => dropWall(w, true),
  }) ?? null;
}

/** Puts a wall's obstacle back after her bolt has gone by. */
function resume(w: MimeWall, now: number) {
  if (w.gone || !w.o || w.inWorld || now >= w.until) return;
  w.ctx?.addObstacle?.(w.o, Math.max(0.05, (w.until - now) / 1000));
  w.inWorld = true;
}

/**
 * Her own bolt passes her own walls. Obstacles stop every bolt, whoever threw it (and nothing shared tells them apart), so while
 * her bolt is within `PASS_LOOK` m of a wall on its path the wall's obstacle is lifted out, and it is put back when the bolt has
 * gone by. The bolt wall stays, so the enemy's bolts are still caught. Call it every frame while the bolt flies, with the bolt's
 * place and direction, and `restoreWalls` when it ends.
 */
export function passBolt(who: object, pos: THREE.Vector3, dir: THREE.Vector3, radius: number) {
  const b = mimeBooks.get(who);
  if (!b) return;
  const now = performance.now(), ex = pos.x + dir.x * PASS_LOOK, ez = pos.z + dir.z * PASS_LOOK;
  for (const w of b.walls) {
    if (!w.raised || w.gone || !w.o) continue;
    const near = segDist(pos.x, pos.z, ex, ez, w.x1, w.z1, w.x2, w.z2) < WALL_R + radius + 0.35;
    if (near && w.inWorld) { w.ctx?.removeObstacle?.(w.o); w.inWorld = false; }
    else if (!near) resume(w, now);
  }
}

export function restoreWalls(who: object) {
  const b = mimeBooks.get(who);
  if (!b) return;
  const now = performance.now();
  for (const w of b.walls) resume(w, now);
}

/** True when `o` is one of her walls' obstacles (standing or lifted out): her own bolt's path ignores them. */
export function isOwnWall(who: object, o: Obstacle) {
  return !!mimeBooks.get(who)?.walls.some((w) => w.o === o);
}

/**
 * Where a wall's unit stands: on the wall, at the point where the line from the enemy to her crosses it (so a bolt aimed at her
 * meets the unit's reach), else the point of the wall nearest the enemy. A bolt touches a unit within its own radius plus 0.5 m
 * of its line, so the unit follows the shot; the bolt wall covers the rest of the length.
 */
function unitSpot(w: MimeWall, me: THREE.Vector3, en: THREE.Vector3 | undefined, out: THREE.Vector3) {
  const dx = w.x2 - w.x1, dz = w.z2 - w.z1, len2 = dx * dx + dz * dz || 1;
  let k = 0.5;
  if (en) {
    const sx = me.x - en.x, sz = me.z - en.z, den = dx * sz - dz * sx;
    const hit = Math.abs(den) > 1e-6 ? { k: ((en.x - w.x1) * sz - (en.z - w.z1) * sx) / den, s: ((en.x - w.x1) * dz - (en.z - w.z1) * dx) / den } : null;
    if (hit && hit.k >= 0 && hit.k <= 1 && hit.s >= 0 && hit.s <= 1) k = hit.k;
    else k = ((en.x - w.x1) * dx + (en.z - w.z1) * dz) / len2;
  }
  k = THREE.MathUtils.clamp(k, 0.1, 0.9);
  return out.set(w.x1 + dx * k, 0, w.z1 + dz * k);
}

const spot = new THREE.Vector3();

function wallsOf(t: TraitView) {
  return mimeBooks.get(t.self())?.walls;
}

/**
 * Mum (controller, ranged). Passive Silence Is Golden: she makes up to three invisible walls (Wall, W) and Box's four. They are real
 * obstacles for both heroes, shown only as faint chalk on the floor and a faint shimmer in the air, and one hit of any size breaks one.
 *
 * Where each rule runs. The walls are `mimeBooks` records the spells write on BOTH screens at the cast (ids count the walls made), and
 * raise at the rise: `raiseWall` makes the obstacle, a bolt wall and, where `ctx.summon` exists (the screen that decides hits: the only
 * screen offline, the victim's online), a 1 HP unit. `marks` draws every wall on both screens. A break is learned where the hit is
 * decided: from the unit's death or the bolt wall's block. `victimTick` (that screen) keeps each unit on the line between the enemy and
 * her, expires walls and tells her client with `noteOwner('broke', id)`; `tick` (her client) expires walls and tells the other screen
 * with `show('broke', id)`, whose `ownChanged` drops the same wall. The units count toward the cap of 6 a side: making a wall or a Box
 * that would go over drops the oldest wall. Her own Q passes her walls (`passBolt`).
 */
export const mimeTrait: Trait = {
  meter: { name: 'WALLS', max: WALL_MAX, value: (t) => { const b = mimeBooks.get(t.self()); return b ? liveWalls(b).length : 0; } },
  passive: {
    name: 'Silence Is Golden',
    blurb: 'She makes up to 3 invisible walls (Wall) and Boxed In makes 4 more: real, solid for both of you, for 5 s (3 s for the Box), shown only as faint chalk lines on the floor and a faint shimmer. One hit of any size breaks a wall.',
  },
  twist: {
    name: 'Which Wall Is Real',
    blurb: 'A wall for cover is not a wall to trap you: read the chalk, and break the one in your way with anything. She never speaks, and her walls cost her her own sight too.',
  },
  speed: 4.1,
  attack: { kind: 'ranged', range: 5.5, damage: 14, interval: 0.9, windup: 0.25, speed: 20, look: 'orb' },
  charges: { slot: 1, count: WALL_CHARGES, every: WALL_EVERY },
  // The CPU raises a Wall only with the enemy 3 to 8 m away and fewer than 3 plain walls standing; Boxed In only within 8 m.
  aiHold(t, slot, dist) {
    if (slot === 1) {
      const b = mimeBooks.get(t.self());
      const plain = b ? liveWalls(b).filter((w) => !w.box).length : 0;
      return dist < WALL_AI_MIN || dist > WALL_AI_MAX || plain >= WALL_MAX;
    }
    if (slot === 3) return dist > BOX_AI_MAX;
    return false;
  },
  marks(t) {
    const b = mimeBooks.get(t.self());
    if (!b || b.walls.length === 0) return [];
    const now = performance.now(), out: GroundMark[] = [];
    for (const w of b.walls) {
      if (!w.raised) continue;
      const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1), yaw = Math.atan2(w.x2 - w.x1, w.z2 - w.z1);
      const x = (w.x1 + w.x2) / 2, z = (w.z1 + w.z2) / 2;
      if (!w.gone && now < w.until) out.push({ x, z, kind: 'wall', age: (now - w.bornAt) / 1000, life: (w.until - w.bornAt) / 1000, yaw, length: len });
      else if (w.gone && w.broke && now - w.goneAt < CRUMB_SECONDS * 1000) out.push({ x, z, kind: 'crumb', age: (now - w.goneAt) / 1000, life: CRUMB_SECONDS, yaw, length: len });
    }
    return out;
  },
  markLook: {
    wall: () => wallLook(WALL_HEIGHT),
    crumb: () => crumbLook(),
  },
  /** Her own client: walls that ran out, and breaks decided here (a bolt wall's block) told to the other screen, one a frame. */
  tick(t) {
    const walls = wallsOf(t);
    if (!walls || walls.length === 0) return;
    const now = performance.now();
    for (const w of walls) if (w.raised && !w.gone && now >= w.until + 100) dropWall(w, false);
    const w = walls.find((k) => k.broke && !k.told);
    if (w) { w.told = true; t.show('broke', w.id); }
  },
  /** The screen that decides hits: units follow the shot, walls expire, a break by a unit is told to her client. */
  victimTick(t) {
    const walls = wallsOf(t);
    if (!walls || walls.length === 0) return;
    const now = performance.now(), me = t.self().group.position, en = t.enemy()?.group.position;
    for (const w of walls) {
      if (!w.raised) continue;
      if (!w.gone && now >= w.until + 100) { dropWall(w, false); continue; }
      if (!w.gone && !w.unit && w.ctx?.summon) attachUnit(w.ctx, w);
      if (!w.gone && w.unit?.alive) {
        w.unit.pos.copy(unitSpot(w, me, en, spot));
        w.unit.knock.set(0, 0, 0);
      }
    }
    const w = walls.find((k) => k.broke && !k.told && k.unit);
    if (w) { w.told = true; t.noteOwner('broke', w.id); }
  },
  peerNote(t, name, n) {
    if (name !== 'broke') return;
    const w = wallsOf(t)?.find((k) => k.id === n);
    if (w) { w.told = true; dropWall(w, true); }
  },
  ownChanged(t, name, n) {
    if (name !== 'broke') return;
    const w = wallsOf(t)?.find((k) => k.id === n);
    if (w) { w.told = true; dropWall(w, true); }
  },
  badge(t) {
    const b = mimeBooks.get(t.self());
    const n = b ? liveWalls(b).length : 0;
    return n > 0 ? String(n) : '';
  },
};
