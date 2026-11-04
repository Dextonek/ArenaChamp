import * as THREE from 'three';
import type { Enemy } from './common';
import type { HitOptions } from './targeting';

/**
 * Skillshot projectiles (pipeline/designs/mechanics.md section 2). A bolt flies from the caster along a direction at a
 * fixed speed and hits the first enemy its path touches: a swept capsule on the ground plane, checked every frame. It
 * is dodged by stepping off the line before it arrives, not by leaving a zone, so its hit skips the duel's zone checks
 * (`HitOptions.projectile`). The arena owns the bolts and ticks them (`ProjectileSystem`); a spell only asks for one
 * through `CastContext.projectile` and draws the `Projectile` handle it gets back (`parts/bolt.ts` has a ready look).
 */
export interface ProjectileOptions {
  /** Where it starts (feet position of the caster; y is ignored). */
  from: THREE.Vector3;
  /** Flight direction on the ground plane (y is ignored, need not be normalised). */
  dir: THREE.Vector3;
  /** m/s. */
  speed: number;
  /** Flight distance before it ends (m). */
  range: number;
  /** Collision radius of the bolt (m); an enemy body adds `BODY_RADIUS`. */
  radius: number;
  /**
   * What a hit does. The engine adds `projectile: true` and, unless set, `from` = where the bolt was; a hit with
   * `pull` gets `from` = where the bolt started instead (the caster), so the target is dragged toward the caster.
   */
  hit: HitOptions;
  /**
   * Turn rate in rad/s while it flies: the direction rotates this fast, so the path is a circular arc (radius
   * `speed / |curve|`). Positive turns to the left of the direction of travel (counter-clockwise seen from above),
   * negative to the right. `arcShot` computes the launch direction and rate for an arc through a chosen point. A
   * bounce straightens the bolt; split children fly straight. Hits are swept along the real path as for any bolt.
   */
  curve?: number;
  /** Keeps flying after a hit; every enemy is hit once. */
  pierce?: boolean;
  /**
   * Reflects off walls and pillars this many times before cover stops it (Opaline). Each reflection adds `reflectRange`
   * metres (default 2) and `reflectBonus` of the hit's damage (default 0.25 = +25%). `bankPath` in obstacles.ts gives
   * the same path without flying it. Follow `Projectile.reflections`, and `onReflect` for a flash.
   */
  reflect?: number;
  reflectRange?: number;
  reflectBonus?: number;
  onReflect?: (bolt: Projectile, at: THREE.Vector3) => void;
  /** After a hit it turns toward the nearest other enemy within `BOUNCE_RANGE` of the hit, this many times. */
  bounce?: number;
  /**
   * Fans out into `count` child bolts over `spreadDeg`: `at: 'hit'` at the first hit (the parent ends), `at: 'end'`
   * at max range. Children never hit an enemy their parent hit; they do not split, bounce or pierce.
   * `hit` (default: the parent's) and `range` (default 6) are the children's.
   */
  split?: { count: number; spreadDeg: number; at: 'hit' | 'end'; hit?: HitOptions; range?: number };
}

/**
 * A wall of wind that destroys the other side's bolts (`CastContext.boltWall`). A segment `a` to `b` on the ground
 * plane with a half-thickness. It does not block walking, sight or the owner's own bolts, and it does not stop homing
 * basic attacks (those are hits, not bolts). Bolts are tested along their swept path every frame, so a fast bolt
 * cannot tunnel through it.
 */
export interface BoltWallOptions {
  /** Ends of the wall (ground plane; y is ignored). */
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** Half the thickness (m). A bolt adds its own radius. */
  halfWidth: number;
  /** Lifetime (s). */
  seconds: number;
  /** Called for every bolt it destroys, with the bolt and where it died (children count as bolts). */
  onBlock?: (bolt: Projectile, at: THREE.Vector3) => void;
}

/** The handle of a bolt wall: `end()` removes it early. The system drops it after `seconds` and on `clear()`. */
export class BoltWall {
  alive = true;
  /** Seconds left. */
  left: number;
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  /** @internal */
  constructor(readonly side: 'hero' | 'opponent', readonly opts: BoltWallOptions) {
    this.a = new THREE.Vector3(opts.a.x, 0, opts.a.z);
    this.b = new THREE.Vector3(opts.b.x, 0, opts.b.z);
    this.left = opts.seconds;
  }

  end() {
    this.alive = false;
  }
}

/** The side a bolt belongs to, from its world's tag ('hero', 'hero-unit', 'opponent', 'opponent-unit'). */
const sideOfTag = (tag: string): 'hero' | 'opponent' => (tag.startsWith('hero') ? 'hero' : 'opponent');

/** Called for every hit, by the bolt that made it (children too): the enemy and where the bolt was. */
export type ProjectileHitCallback = (target: Enemy, at: THREE.Vector3, bolt: Projectile) => void;

/** Half-width of a figure for bolt collisions (m), when it has no measured body. */
export const BODY_RADIUS = 0.5;
const bodyOf = (figure: Enemy) => figure.body?.radius ?? BODY_RADIUS;
/** How far a bounce looks for the next enemy (m). */
export const BOUNCE_RANGE = 6;
/** Bolts fly this high above the floor (m). */
export const BOLT_HEIGHT = 1.1;

/** The handle a spell follows: where the bolt is, whether it still flies, and what it split into. */
export class Projectile {
  readonly pos = new THREE.Vector3();
  readonly dir = new THREE.Vector3();
  alive = true;
  /** Child bolts from a split (their own children included in theirs). Only grows. */
  readonly children: Projectile[] = [];
  /** Enemies hit so far by this bolt and its ancestors. */
  readonly hitSet = new Set<Enemy>();
  /** Enemies hit by this bolt (children count separately). */
  hits = 0;
  /** Times it has reflected off cover so far. */
  reflections = 0;
  /** Distance left before it ends (m). */
  rangeLeft: number;
  bounces: number;
  splitDone = false;
  /** Turn rate now (rad/s, from `opts.curve`). */
  curve: number;

  /** @internal */
  constructor(
    readonly id: number,
    readonly world: ProjectileWorld,
    readonly opts: ProjectileOptions,
    readonly root: Projectile | null,
    readonly callbacks: ProjectileHitCallback[],
    readonly speed: number,
    readonly radius: number,
    range: number,
    readonly isChild: boolean,
  ) {
    this.rangeLeft = range;
    this.bounces = isChild ? 0 : opts.bounce ?? 0;
    this.curve = isChild ? 0 : opts.curve ?? 0;
  }

  /** Registers a hit listener. It fires for this bolt's whole family (children share it). Returns the bolt. */
  onHit(cb: ProjectileHitCallback) {
    this.callbacks.push(cb);
    return this;
  }

  /** @internal */
  fire(target: Enemy, at: THREE.Vector3) {
    for (const cb of this.callbacks) cb(target, at, this);
  }
}

/** What the bolts collide with and how a hit is delivered; the arena builds one per cast context. */
export interface ProjectileWorld {
  /** The enemies a bolt can hit right now (alive), with where they stand. */
  victims(): { figure: Enemy; pos: THREE.Vector3 }[];
  /** Delivers a hit (the flag `projectile: true` is already set). */
  hit(target: Enemy, opts: HitOptions): void;
  /** True when something solid stands between the two points (a pillar): the bolt ends there. */
  blocked?(a: THREE.Vector3, b: THREE.Vector3): boolean;
  /** Where a to b first meets something solid, and its outward normal: a reflecting bolt turns there. */
  surface?(a: THREE.Vector3, b: THREE.Vector3): { t: number; nx: number; nz: number } | null;
  /** Tally key for `ProjectileSystem.stats` ('hero', 'opponent'). */
  tag: string;
}

export interface ProjectileStats {
  /** Root bolts fired (children not counted). */
  fired: number;
  /** Root bolts that ended with at least one hit anywhere in their family. */
  landed: number;
  /** Root bolts whose whole family hit nothing. */
  missed: number;
  /** Hits delivered (a pierce or a split can give several per bolt). */
  hits: number;
}

/** Closest distance from point (px, pz) to the segment a-b on the ground plane, and the position along it (0..1). */
function segmentTouch(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 1e-9 ? THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  return { t, d: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)) };
}

/** Rotates a ground direction by `angle` rad toward its left (counter-clockwise seen from above). */
function turnDir(d: THREE.Vector3, angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  // dir = (sin φ, cos φ): φ + angle.
  const x = d.x * c + d.z * s, z = d.z * c - d.x * s;
  d.x = x;
  d.z = z;
}

/**
 * The launch of a curving bolt that flies a circular arc from `from` through `to` (ground plane): the direction to
 * fire in, the `curve` rate and the arc length to use as `range`. `bend` is the total turn of the heading along the
 * arc in radians (positive: the path bows to the right of the chord and turns left; negative the mirror image; 0:
 * a straight shot). The chord is `from` to `to`; the heading at launch is the chord's rotated by `-bend / 2`.
 * Both screens of a network duel get the same numbers from the cast (`CastContext.point`, `bend`).
 */
export function arcShot(from: THREE.Vector3, to: THREE.Vector3, bend: number, speed: number): { dir: THREE.Vector3; curve: number; range: number } {
  const chord = Math.hypot(to.x - from.x, to.z - from.z);
  const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
  if (chord < 1e-6) return { dir: new THREE.Vector3(0, 0, -1), curve: 0, range: 0 };
  dir.divideScalar(chord);
  const b = THREE.MathUtils.clamp(bend, -MAX_BEND, MAX_BEND);
  if (Math.abs(b) < 1e-3) return { dir, curve: 0, range: chord };
  // Circle through both ends with total turn b: radius = chord / (2 sin(b/2)), length = radius * b.
  const length = (chord * b) / (2 * Math.sin(b / 2));
  turnDir(dir, -b / 2);
  return { dir, curve: (b * speed) / length, range: Math.abs(length) };
}

/** Largest bend an arc aim uses (rad): 80 degrees of total turn. */
export const MAX_BEND = THREE.MathUtils.degToRad(80);
/** The bend of an arc aim (rad): 70 degrees of total turn. */
export const ARC_BEND = THREE.MathUtils.degToRad(70);
/** An aim this close (rad) to the line toward the enemy counts as straight on: the side is the resting one. */
export const ARC_DEAD = THREE.MathUtils.degToRad(12);

/**
 * The bend an arc aim uses. The arc bows away from `axis` (the unit direction toward the enemy): a point left of that
 * line makes the shot bow to the left of the chord, so it launches wide on that side and curls back onto the point
 * (round the cover on that side); a point right of it bows right. Within `ARC_DEAD` of the line (aiming straight at
 * the enemy) it bows to `rest` (+1 right, -1 left), which the caller flips after each arc cast so successive shots
 * alternate; `flip` (Shift) turns the side round. Returns a signed bend for `arcShot`: positive bows right.
 */
export function arcBendFor(from: THREE.Vector3, point: THREE.Vector3, axis: THREE.Vector3, rest: number, flip = false): number {
  const cx = point.x - from.x, cz = point.z - from.z;
  // Angle of the chord left of the axis (the heading is atan2(x, z); left is the increasing way).
  const off = Math.atan2(cx * axis.z - cz * axis.x, cx * axis.x + cz * axis.z);
  let side = Math.abs(off) >= ARC_DEAD ? (off > 0 ? -1 : 1) : rest >= 0 ? 1 : -1;
  if (flip) side = -side;
  return side * ARC_BEND;
}

/** Points along the arc `arcShot` describes (`n` + 1 of them, ground plane, y = 0), for the aim strip and the AI's path checks. */
export function arcPoints(from: THREE.Vector3, to: THREE.Vector3, bend: number, n = 24): THREE.Vector3[] {
  const a = arcShot(from, to, bend, 1);
  const out: THREE.Vector3[] = [];
  const d = a.dir.clone();
  const p = new THREE.Vector3(from.x, 0, from.z);
  const step = a.range / n, dTurn = a.curve * step;
  for (let i = 0; i <= n; i++) {
    out.push(p.clone());
    turnDir(d, dTurn / 2);
    p.addScaledVector(d, step);
    turnDir(d, dTurn / 2);
  }
  return out;
}

/** The arena's bolts: spawns, moves and collides them every frame. */
export class ProjectileSystem {
  /** Bolts in flight (children included). */
  readonly live: Projectile[] = [];
  /** Bolt walls standing now. */
  readonly walls: BoltWall[] = [];
  stats: Record<string, ProjectileStats> = {};
  private nextId = 1;
  /** Root bolts still flying or whose children do, to settle the `landed` / `missed` tally. */
  private open = new Set<Projectile>();
  private _v = new THREE.Vector3();

  spawn(world: ProjectileWorld, opts: ProjectileOptions): Projectile {
    const p = new Projectile(this.nextId++, world, opts, null, [], opts.speed, opts.radius, opts.range, false);
    this.init(p, opts.from, opts.dir);
    this.tally(world.tag).fired++;
    this.open.add(p);
    return p;
  }

  /** Raises a wall of wind owned by `side`: it destroys the other side's bolts that cross it. */
  wall(side: 'hero' | 'opponent', opts: BoltWallOptions): BoltWall {
    const w = new BoltWall(side, opts);
    this.walls.push(w);
    return w;
  }

  /** Bolts currently flying toward `figure` (what its AI looks at to dodge). */
  threats(figure: Enemy): Projectile[] {
    return this.live.filter((p) => p.world.victims().some((v) => v.figure === figure));
  }

  clear() {
    for (const p of this.live) p.alive = false;
    this.live.length = 0;
    this.open.clear();
    for (const w of this.walls) w.alive = false;
    this.walls.length = 0;
  }

  resetStats() {
    this.stats = {};
  }

  update(dt: number) {
    if (this.walls.length) {
      for (const w of this.walls) {
        w.left -= dt;
        if (w.left <= 0) w.alive = false;
      }
      this.walls.splice(0, this.walls.length, ...this.walls.filter((w) => w.alive));
    }
    const n = this.live.length;
    for (let i = 0; i < n; i++) {
      const p = this.live[i];
      if (p.alive) this.step(p, dt);
    }
    // Drop the ended ones, then settle the tallies of families that are over.
    this.live.splice(0, this.live.length, ...this.live.filter((p) => p.alive));
    for (const root of this.open) {
      if (this.familyAlive(root)) continue;
      this.open.delete(root);
      const s = this.tally(root.world.tag);
      if (this.familyHits(root) > 0) s.landed++;
      else s.missed++;
    }
  }

  private tally(tag: string): ProjectileStats {
    return (this.stats[tag] ??= { fired: 0, landed: 0, missed: 0, hits: 0 });
  }

  private familyAlive(p: Projectile): boolean {
    return p.alive || p.children.some((c) => this.familyAlive(c));
  }

  private familyHits(p: Projectile): number {
    return p.hits + p.children.reduce((s, c) => s + this.familyHits(c), 0);
  }

  private init(p: Projectile, from: THREE.Vector3, dir: THREE.Vector3) {
    p.pos.set(from.x, BOLT_HEIGHT, from.z);
    p.dir.set(dir.x, 0, dir.z);
    if (p.dir.lengthSq() < 1e-8) p.dir.set(0, 0, -1);
    p.dir.normalize();
    this.live.push(p);
  }

  private step(p: Projectile, dt: number) {
    let dist = Math.min(p.speed * dt, p.rangeLeft);
    // A curving bolt turns half of this step's angle before it moves and half after: the chord matches the arc.
    const turn = p.curve * (dist / p.speed);
    if (turn) turnDir(p.dir, turn / 2);
    const a = p.pos, b = this._v.copy(a).addScaledVector(p.dir, dist);
    if (p.world.blocked?.(a, b)) {
      const s = p.reflections < (p.opts.reflect ?? 0) ? p.world.surface?.(a, b) : null;
      if (!s) {
        p.alive = false;
        return;
      }
      // A bank shot: up to the surface, then away from it, a little farther and a little stronger.
      p.pos.addScaledVector(p.dir, dist * s.t);
      p.rangeLeft += (p.opts.reflectRange ?? 2) - dist * s.t;
      const dot = p.dir.x * s.nx + p.dir.z * s.nz;
      p.dir.x -= 2 * dot * s.nx;
      p.dir.z -= 2 * dot * s.nz;
      p.pos.addScaledVector(p.dir, 0.02);
      p.reflections++;
      p.curve = 0;
      p.opts.onReflect?.(p, p.pos.clone());
      return;
    }
    // A wall of the other side on the path: the bolt flies up to it, hits what it meets on the way, then ends there.
    const wallCut = this.walls.length ? this.crossWall(p, a, b) : null;
    if (wallCut) {
      dist *= wallCut.t;
      b.copy(a).addScaledVector(p.dir, dist);
    }
    // Enemies the swept capsule touches this frame, in the order the bolt meets them. Each hero has the size of its model.
    const touched = p.world.victims()
      .filter((v) => !p.hitSet.has(v.figure))
      .map((v) => ({ v, ...segmentTouch(a.x, a.z, b.x, b.z, v.pos.x, v.pos.z) }))
      .filter((c) => c.d <= p.radius + bodyOf(c.v.figure))
      .sort((c1, c2) => c1.t - c2.t);
    let moved = dist;
    for (const c of touched) {
      const at = new THREE.Vector3().copy(a).addScaledVector(p.dir, dist * c.t);
      p.hitSet.add(c.v.figure);
      p.hits++;
      this.tally(p.world.tag).hits++;
      const origin = p.opts.hit.pull ? new THREE.Vector3(p.opts.from.x, 0, p.opts.from.z) : at.clone();
      const bonus = p.reflections > 0 && p.opts.hit.damage !== undefined ? { damage: p.opts.hit.damage * (1 + (p.opts.reflectBonus ?? 0.25) * p.reflections) } : null;
      p.world.hit(c.v.figure, { ...p.opts.hit, ...bonus, projectile: true, from: p.opts.hit.from ?? origin });
      p.fire(c.v.figure, at);
      if (p.opts.pierce) continue;
      // The first hit of a bolt that does not pierce: split, bounce on, or end here.
      p.pos.copy(at);
      moved = dist * c.t;
      p.rangeLeft -= moved;
      if (p.opts.split?.at === 'hit' && !p.splitDone) {
        this.split(p);
        p.alive = false;
        return;
      }
      const next = p.bounces > 0 ? this.nextTarget(p, at) : null;
      if (next) {
        p.bounces--;
        p.curve = 0;
        p.dir.set(next.pos.x - at.x, 0, next.pos.z - at.z).normalize();
        p.rangeLeft = Math.max(p.rangeLeft, Math.hypot(next.pos.x - at.x, next.pos.z - at.z) + 2);
        return;
      }
      p.alive = false;
      return;
    }
    p.pos.addScaledVector(p.dir, moved);
    if (wallCut) {
      p.alive = false;
      wallCut.wall.opts.onBlock?.(p, p.pos.clone());
      return;
    }
    if (turn) turnDir(p.dir, turn / 2);
    p.rangeLeft -= moved;
    if (p.rangeLeft <= 1e-4) {
      p.alive = false;
      if (p.opts.split?.at === 'end' && !p.splitDone) this.split(p);
    }
  }

  /** The first wall of the other side the path a to b meets, and where along it (0..1), or null. */
  private crossWall(p: Projectile, a: THREE.Vector3, b: THREE.Vector3): { wall: BoltWall; t: number } | null {
    const side = sideOfTag(p.world.tag);
    let best: { wall: BoltWall; t: number } | null = null;
    for (const w of this.walls) {
      if (!w.alive || w.side === side) continue;
      const reach = w.opts.halfWidth + p.radius;
      const steps = Math.min(40, Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.12)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const d = segmentTouch(w.a.x, w.a.z, w.b.x, w.b.z, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t).d;
        if (d <= reach) {
          if (!best || t < best.t) best = { wall: w, t };
          break;
        }
      }
    }
    return best;
  }

  /** The nearest live enemy within `BOUNCE_RANGE` of `at` that this bolt's family has not hit. */
  private nextTarget(p: Projectile, at: THREE.Vector3) {
    let best: { figure: Enemy; pos: THREE.Vector3 } | null = null, bestD = BOUNCE_RANGE;
    for (const v of p.world.victims()) {
      if (p.hitSet.has(v.figure)) continue;
      const d = Math.hypot(v.pos.x - at.x, v.pos.z - at.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  private split(p: Projectile) {
    const s = p.opts.split!;
    p.splitDone = true;
    const base = Math.atan2(p.dir.x, p.dir.z);
    const root = p.root ?? p;
    for (let i = 0; i < s.count; i++) {
      const off = s.count > 1 ? THREE.MathUtils.degToRad(-s.spreadDeg / 2 + (s.spreadDeg * i) / (s.count - 1)) : 0;
      const opts: ProjectileOptions = { ...p.opts, hit: s.hit ?? p.opts.hit, range: s.range ?? 6, pierce: false, bounce: 0, split: undefined, curve: 0 };
      const child = new Projectile(this.nextId++, p.world, opts, root, p.callbacks, p.speed, p.radius, opts.range, true);
      for (const e of p.hitSet) child.hitSet.add(e);
      this.init(child, p.pos, new THREE.Vector3(Math.sin(base + off), 0, Math.cos(base + off)));
      p.children.push(child);
    }
  }
}
