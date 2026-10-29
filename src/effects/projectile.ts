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
  /** What a hit does. The engine adds `projectile: true` and, unless set, `from` = where the bolt was. */
  hit: HitOptions;
  /** Keeps flying after a hit; every enemy is hit once. */
  pierce?: boolean;
  /** After a hit it turns toward the nearest other enemy within `BOUNCE_RANGE` of the hit, this many times. */
  bounce?: number;
  /**
   * Fans out into `count` child bolts over `spreadDeg`: `at: 'hit'` at the first hit (the parent ends), `at: 'end'`
   * at max range. Children never hit an enemy their parent hit; they do not split, bounce or pierce.
   * `hit` (default: the parent's) and `range` (default 6) are the children's.
   */
  split?: { count: number; spreadDeg: number; at: 'hit' | 'end'; hit?: HitOptions; range?: number };
}

/** Called for every hit, by the bolt that made it (children too): the enemy and where the bolt was. */
export type ProjectileHitCallback = (target: Enemy, at: THREE.Vector3, bolt: Projectile) => void;

/** Half-width of a figure for bolt collisions (m). */
export const BODY_RADIUS = 0.5;
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
  /** Distance left before it ends (m). */
  rangeLeft: number;
  bounces: number;
  splitDone = false;

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

/** The arena's bolts: spawns, moves and collides them every frame. */
export class ProjectileSystem {
  /** Bolts in flight (children included). */
  readonly live: Projectile[] = [];
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

  /** Bolts currently flying toward `figure` (what its AI looks at to dodge). */
  threats(figure: Enemy): Projectile[] {
    return this.live.filter((p) => p.world.victims().some((v) => v.figure === figure));
  }

  clear() {
    for (const p of this.live) p.alive = false;
    this.live.length = 0;
    this.open.clear();
  }

  resetStats() {
    this.stats = {};
  }

  update(dt: number) {
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
    const dist = Math.min(p.speed * dt, p.rangeLeft);
    const a = p.pos, b = this._v.copy(a).addScaledVector(p.dir, dist);
    if (p.world.blocked?.(a, b)) {
      p.alive = false;
      return;
    }
    const reach = p.radius + BODY_RADIUS;
    // Enemies the swept capsule touches this frame, in the order the bolt meets them.
    const touched = p.world.victims()
      .filter((v) => !p.hitSet.has(v.figure))
      .map((v) => ({ v, ...segmentTouch(a.x, a.z, b.x, b.z, v.pos.x, v.pos.z) }))
      .filter((c) => c.d <= reach)
      .sort((c1, c2) => c1.t - c2.t);
    let moved = dist;
    for (const c of touched) {
      const at = new THREE.Vector3().copy(a).addScaledVector(p.dir, dist * c.t);
      p.hitSet.add(c.v.figure);
      p.hits++;
      this.tally(p.world.tag).hits++;
      p.world.hit(c.v.figure, { ...p.opts.hit, projectile: true, from: p.opts.hit.from ?? at.clone() });
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
        p.dir.set(next.pos.x - at.x, 0, next.pos.z - at.z).normalize();
        p.rangeLeft = Math.max(p.rangeLeft, Math.hypot(next.pos.x - at.x, next.pos.z - at.z) + 2);
        return;
      }
      p.alive = false;
      return;
    }
    p.pos.addScaledVector(p.dir, moved);
    p.rangeLeft -= moved;
    if (p.rangeLeft <= 1e-4) {
      p.alive = false;
      if (p.opts.split?.at === 'end' && !p.splitDone) this.split(p);
    }
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
      const opts: ProjectileOptions = { ...p.opts, hit: s.hit ?? p.opts.hit, range: s.range ?? 6, pierce: false, bounce: 0, split: undefined };
      const child = new Projectile(this.nextId++, p.world, opts, root, p.callbacks, p.speed, p.radius, opts.range, true);
      for (const e of p.hitSet) child.hitSet.add(e);
      this.init(child, p.pos, new THREE.Vector3(Math.sin(base + off), 0, Math.cos(base + off)));
      p.children.push(child);
    }
  }
}
