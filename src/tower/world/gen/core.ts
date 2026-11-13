import type { Spot } from '../def';
import type { Look, Piece } from '../zone';

/**
 * What every chapter's generator shares (pipeline/designs/tower-50.md): random numbers, the outline of a zone of any shape, the ground
 * kept clear, free spots, cover, roads, and the move into the world (mirrored or not). Imports types only: it runs under `node` too
 * (pipeline/tools/gen-floors.ts).
 *
 * Coordinates are offsets from the ring's middle (`RING`) in one frame ("canonical": the chapter's own side, the sea's, to the east)
 * until `Layout.world` moves them into the world, mirrored when the floor's side is the west.
 */

export const RING = { x: 0, z: 7 }; // src/arenas/common.ts `RING`
export type V = { x: number; z: number };

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const r2 = (x: number) => Math.round(x * 100) / 100;
export const r4 = (x: number) => Math.round(x * 10000) / 10000;
export const len = (v: V) => Math.hypot(v.x, v.z);
export const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.z - b.z);
export const add = (a: V, b: V, k = 1): V => ({ x: a.x + b.x * k, z: a.z + b.z * k });
export const unit = (v: V): V => { const l = len(v) || 1; return { x: v.x / l, z: v.z / l }; };
export const toMid = (p: V): V => unit({ x: -p.x, z: -p.z });
/** A point `d` m out at `deg` degrees from the north, clockwise (east is 90, south 180). */
export const polar = (deg: number, d: number): V => ({ x: d * Math.sin((deg * Math.PI) / 180), z: -d * Math.cos((deg * Math.PI) / 180) });
/** The bearing of `p` in degrees from the north, clockwise. */
export const bearing = (p: V) => (Math.atan2(p.x, -p.z) * 180) / Math.PI;
export const segDist = (p: V, a: V, b: V) => {
  const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / l2)) : 0;
  return Math.hypot(p.x - (a.x + ex * t), p.z - (a.z + ez * t));
};

/**
 * A zone's walkable outline: `n` radii round the middle, from +x (east) towards +z (south), as `Math.atan2(dz, dx)` counts (land.ts
 * `rimAt` reads the same). Wavy, not round: three low waves of random phase, scaled so the area is `area` m2, kept between `min` and
 * `max` m out.
 */
export function makeOutline(rnd: () => number, o: { area: number; n?: number; waves?: [number, number, number]; min?: number; max?: number }) {
  const n = o.n ?? 48, [w1, w2, w3] = o.waves ?? [0.16, 0.1, 0.07];
  const p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;
  const shape = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return 1 + w1 * Math.sin(a + p1) + w2 * Math.sin(2 * a + p2) + w3 * Math.sin(3 * a + p3);
  });
  // area of the polygon of radii (r0 = 1): 1/2 sum r_i r_{i+1} sin(2pi/n)
  const unitArea = 0.5 * Math.sin((Math.PI * 2) / n) * shape.reduce((s, r, i) => s + r * shape[(i + 1) % n], 0);
  const k = Math.sqrt(o.area / unitArea);
  return shape.map((s) => r2(Math.max(o.min ?? 0, Math.min(o.max ?? 1e9, s * k))));
}
/** The outline's radius in direction `a` (radians, `atan2(dz, dx)`), smoothly between samples (land.ts's `rimAt`). */
export function rimAt(rim: number[], a: number) {
  const n = rim.length, t = ((((a / (Math.PI * 2)) % 1) + 1) % 1) * n, i = Math.floor(t) % n, f = t - Math.floor(t);
  const s = f * f * (3 - 2 * f);
  return rim[i] + (rim[(i + 1) % n] - rim[i]) * s;
}
/** How far inside the outline `p` is (negative: outside). */
export const inside = (rim: number[], p: V) => rimAt(rim, Math.atan2(p.z, p.x)) - len(p);
/** The radius toward a bearing (degrees from the north, clockwise). */
export const rimToward = (rim: number[], deg: number) => rimAt(rim, Math.atan2(-Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)));
/** The outline mirrored east to west (its samples read at pi - a). */
export function mirrorRim(rim: number[]) {
  const n = rim.length;
  return rim.map((_, j) => r2(rimAt(rim, Math.PI - (j / n) * Math.PI * 2)));
}

/** A floor's layout while it is being made: its cover, the ground kept clear, and the checks a free spot passes. */
export class Layout {
  readonly cover: Piece[] = [];
  readonly keep: { c: V; r: number }[] = [];
  readonly lanes: { a: V; b: V; w: number }[] = [];
  readonly rim: number[];
  readonly rnd: () => number;
  readonly n: number;
  // (no parameter properties: node's plain TypeScript mode, which runs this, does not take them)
  constructor(rim: number[], rnd: () => number, n: number) {
    this.rim = rim;
    this.rnd = rnd;
    this.n = n;
  }
  range(a: number, b: number) { return a + (b - a) * this.rnd(); }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.rnd() * xs.length)]; }

  pill(look: Look, c: V, r: number, h: number) {
    this.cover.push({ look, o: { ax: r2(c.x), az: r2(c.z), bx: r2(c.x), bz: r2(c.z), r: r2(r), height: r2(h), kind: 'pillar' } });
  }
  wall(look: Look, a: V, b: V, r = 0.35, h = 2.3) {
    this.cover.push({ look, o: { ax: r2(a.x), az: r2(a.z), bx: r2(b.x), bz: r2(b.z), r: r2(r), height: r2(h), kind: 'wall' } });
  }
  /** The outline's walls: invisible, fixed, just past the outline, so a walk stops at it whatever its shape. */
  edges(pad = 0.6, r = 0.6) {
    const n = this.rim.length;
    const at = (i: number) => { const a = (i / n) * Math.PI * 2, rr = this.rim[i % n] + pad + r; return { x: Math.cos(a) * rr, z: Math.sin(a) * rr }; };
    for (let i = 0; i < n; i++) {
      const a = at(i), b = at(i + 1);
      this.cover.push({ look: 'edge', o: { ax: r2(a.x), az: r2(a.z), bx: r2(b.x), bz: r2(b.z), r, height: 3, kind: 'wall', fixed: true } });
    }
  }
  hitsCover(p: V, rad: number) {
    return this.cover.some(({ o }) => segDist(p, { x: o.ax, z: o.az }, { x: o.bx, z: o.bz }) < o.r + rad);
  }
  inKeep(p: V, rad: number) {
    return this.keep.some((d) => dist(p, d.c) < d.r + rad) || this.lanes.some((l) => segDist(p, l.a, l.b) < l.w + rad);
  }
  reserve(p: V, r: number) { this.keep.push({ c: p, r }); return p; }
  lane(a: V, b: V, w: number) { this.lanes.push({ a, b, w }); }
  /** A free spot: inside the outline by `margin`, off cover, off the kept ground. Tries round `near` within `spread`, widening. */
  spot(near: V, spread: number, rad: number, ok: (p: V) => boolean = () => true, margin = 3): V {
    for (let i = 0; i < 600; i++) {
      const s = spread * (1 + i / 80), a = this.rnd() * 6.28, d = this.rnd() * s, p = { x: near.x + Math.cos(a) * d, z: near.z + Math.sin(a) * d };
      if (inside(this.rim, p) < margin + rad || this.hitsCover(p, rad + 0.8) || this.inKeep(p, rad) || !ok(p)) continue;
      return { x: r2(p.x), z: r2(p.z) };
    }
    throw new Error(`floor ${this.n}: no free spot near ${near.x.toFixed(1)}, ${near.z.toFixed(1)}`);
  }
  /** A road from `a` to `b` bending once or twice; its corridor is kept clear. Returns its points. */
  road(a: V, b: V, bends = 1, amp = 4, w = 2.4): V[] {
    const pts: V[] = [a];
    for (let k = 1; k <= bends; k++) {
      const t = k / (bends + 1), m = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, nrm = unit({ x: -(b.z - a.z), z: b.x - a.x });
      let p = add(m, nrm, this.range(-amp, amp));
      if (inside(this.rim, p) < 6) p = m;
      pts.push({ x: r2(p.x), z: r2(p.z) });
    }
    pts.push(b);
    for (let i = 1; i < pts.length; i++) this.lane(pts[i - 1], pts[i], w);
    return pts;
  }
}

/** The move into the world: mirrored east to west when `m` is -1, then moved to the ring's middle. */
export function worldOf(m: 1 | -1) {
  const X = (v: V): Spot => ({ x: r2(RING.x + m * v.x), z: r2(RING.z + v.z) });
  const off = (v: V): [number, number] => [r2(m * v.x), r2(v.z)];
  const piece = (p: Piece): Piece => ({ look: p.look, o: { ...p.o, ax: r2(RING.x + m * p.o.ax), az: r2(RING.z + p.o.az), bx: r2(RING.x + m * p.o.bx), bz: r2(RING.z + p.o.bz) } });
  return { X, off, piece, yaw: (y: number) => r2(m * y) };
}

/** A shortest walk along the roads (their points joined where they meet, within `join` m) from the point nearest `a` to the one nearest `b`. */
export function roadRoute(roads: V[][], a: V, b: V, join = 1.5): V[] {
  const nodes: V[] = [], links: number[][] = [];
  const nodeOf = (p: V) => {
    let i = nodes.findIndex((q) => dist(q, p) < join);
    if (i < 0) { i = nodes.length; nodes.push(p); links.push([]); }
    return i;
  };
  for (const r of roads) for (let k = 1; k < r.length; k++) { const i = nodeOf(r[k - 1]), j = nodeOf(r[k]); links[i].push(j); links[j].push(i); }
  const near = (p: V) => nodes.reduce((best, q, i) => (dist(q, p) < dist(nodes[best], p) ? i : best), 0);
  const s = near(a), t = near(b), d = new Array(nodes.length).fill(Infinity), prev = new Array(nodes.length).fill(-1), done = new Array(nodes.length).fill(false);
  d[s] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0 || u === t) break;
    done[u] = true;
    for (const v of links[u]) { const nd = d[u] + dist(nodes[u], nodes[v]); if (nd < d[v]) { d[v] = nd; prev[v] = u; } }
  }
  const path: V[] = [];
  for (let u = t; u >= 0; u = prev[u]) path.unshift(nodes[u]);
  return path[0] && dist(path[0], nodes[s]) < 0.01 ? path : [nodes[s], nodes[t]];
}
