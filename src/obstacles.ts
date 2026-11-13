import * as THREE from 'three';

/**
 * Solid obstacles on the floor (the duel ring's pillars and walls), all as capsules on the ground plane: a segment
 * from (ax, az) to (bx, bz) with a radius. A pillar is a capsule of zero length. They block walking (`pushOut`,
 * `steer`) and line of sight (`blocksSight`): a spell can only be cast at an enemy or a spot the caster can see.
 */
export interface Obstacle {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Half thickness (wall) or radius (pillar). */
  r: number;
  /** Height of the mesh (looks only; every obstacle blocks sight fully). */
  height: number;
  kind: 'pillar' | 'wall';
  /** A wall that is part of the room itself (a boss room's own walls): it never breaks. */
  fixed?: boolean;
}

export const pillar = (x: number, z: number, r = 0.85): Obstacle => ({ ax: x, az: z, bx: x, bz: z, r, height: 4.2, kind: 'pillar' });
export const wall = (ax: number, az: number, bx: number, bz: number): Obstacle => ({ ax, az, bx, bz, r: 0.35, height: 2.3, kind: 'wall' });

/**
 * `Math.hypot` of two numbers, to the last bit as Chrome and the game server compute it (the same sums in the same order;
 * checked on 20 million pairs), without the array the built-in one makes for every call: these checks run thousands of
 * times a frame in a room with much cover, and were the game's largest source of garbage (docs/pipeline/performance.md).
 * A plain `Math.sqrt(x * x + z * z)` is NOT the same number in a third of all cases, and would let two builds of the game
 * walk a hero a hair apart.
 */
export function hyp(x: number, z: number) {
  x = Math.abs(x);
  z = Math.abs(z);
  const max = x > z ? x : z;
  if (max === 0) return 0;
  if (max === Infinity) return Infinity;
  // Kahan's sum of the two squares, each scaled by the larger.
  let n = x / max, summand = n * n, sum = summand;
  const lost = (sum - 0) - summand;
  n = z / max;
  summand = n * n - lost;
  sum += summand;
  return Math.sqrt(sum) * max;
}

/**
 * The closest point to (px, pz) on the segment a-b, left in `_c` (x, z): no object is made. Read it before the next call.
 * (A typed array, not two variables: a number kept in a module's variable is boxed anew on every write.)
 */
const _c = new Float64Array(2);
function closestOn(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0;
  _c[0] = ax + dx * t;
  _c[1] = az + dz * t;
}

/** Closest point to (px, pz) on the obstacle's segment. */
function closest(o: Obstacle, px: number, pz: number) {
  closestOn(o.ax, o.az, o.bx, o.bz, px, pz);
  return { x: _c[0], z: _c[1] };
}

/** Distance from (px, pz) to the obstacle's segment. */
function distTo(o: Obstacle, px: number, pz: number) {
  closestOn(o.ax, o.az, o.bx, o.bz, px, pz);
  return hyp(px - _c[0], pz - _c[1]);
}

/** True when a point on the floor is inside this obstacle. */
export function contains(o: Obstacle, x: number, z: number) {
  return distTo(o, x, z) <= o.r;
}

/**
 * The first obstacle surface on the way from a to b (ground plane): how far along it (0..1) and the surface's outward
 * normal there, or null when the way is clear. Bank shots reflect off this.
 */
export function firstSurface(a: { x: number; z: number }, b: { x: number; z: number }, obstacles: readonly Obstacle[]): { t: number; nx: number; nz: number } | null {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(len / 0.08));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    for (const o of obstacles) {
      closestOn(o.ax, o.az, o.bx, o.bz, x, z);
      const dx = x - _c[0], dz = z - _c[1], d = hyp(dx, dz);
      if (d > o.r) continue;
      if (d < 1e-5) return { t, nx: -(b.x - a.x) / (len || 1), nz: -(b.z - a.z) / (len || 1) };
      return { t, nx: dx / d, nz: dz / d };
    }
  }
  return null;
}

/**
 * The path of a bolt that reflects off obstacles: points from `from`, along `dir`, for `range` metres, gaining `extra`
 * metres per reflection, at most `reflections` of them. A pure function of its inputs, so both screens of a network duel
 * and the aim strip draw the same line. Bank shots: Opaline.
 */
export function bankPath(from: { x: number; z: number }, dir: { x: number; z: number }, range: number, reflections: number, obstacles: readonly Obstacle[], extra = 2): { x: number; z: number }[] {
  const l = Math.hypot(dir.x, dir.z) || 1;
  let dx = dir.x / l, dz = dir.z / l, x = from.x, z = from.z, left = range, r = reflections;
  const out = [{ x, z }];
  for (let guard = 0; guard < reflections + 2 && left > 1e-3; guard++) {
    const end = { x: x + dx * left, z: z + dz * left };
    const hit = firstSurface({ x, z }, end, obstacles);
    if (!hit || r <= 0) {
      const t = hit ? hit.t : 1;
      out.push({ x: x + (end.x - x) * t, z: z + (end.z - z) * t });
      break;
    }
    const nx = x + (end.x - x) * hit.t, nz = z + (end.z - z) * hit.t;
    out.push({ x: nx, z: nz });
    left = left * (1 - hit.t) + extra;
    const dot = dx * hit.nx + dz * hit.nz;
    dx -= 2 * dot * hit.nx;
    dz -= 2 * dot * hit.nz;
    x = nx + dx * 0.02;
    z = nz + dz * 0.02;
    r--;
  }
  return out;
}

/** Moves `p` (ground plane, y ignored) out of every obstacle, keeping `body` clearance. Returns `p`. */
export function pushOut(p: THREE.Vector3, obstacles: readonly Obstacle[], body = 0.5) {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      closestOn(o.ax, o.az, o.bx, o.bz, p.x, p.z);
      const cx = _c[0], cz = _c[1];
      let dx = p.x - cx, dz = p.z - cz;
      const d = hyp(dx, dz), min = o.r + body;
      if (d >= min) continue;
      if (d < 1e-5) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
      p.x = cx + dx * min;
      p.z = cz + dz * min;
    }
  }
  return p;
}

/** How far ahead (m) a walk looks for an obstacle in its way: next to nothing, so the turn comes at contact, not before. */
const SLIDE_LOOK = 0.03;
/** Below this share of the walk left along the edge, the walker is pressing nearly straight at the obstacle. */
const HEAD_ON = 0.35;
/** The least speed along an edge, as a share of the walk, so a shallow slide does not crawl. */
const SLIDE_SPEED = 0.6;
/** Pressing straight at an obstacle: which way round this walker goes, kept until it leaves or turns away. */
const slideMemory = new WeakMap<THREE.Vector3, { o: Obstacle; side: number; dx: number; dz: number }>();

/**
 * Where a walk goes when an obstacle is in its way: the part of the walk that runs along the obstacle's edge, the way
 * the walker is already pushing (never against it). Pressing nearly straight at it, the walker goes round at 0.7 of its
 * speed, by the nearer end, and keeps that side until it leaves the obstacle or turns away (no flipping).
 * Only the nearest obstacle the straight walk would run into counts, so a gap wide enough for the body is walked
 * straight through. `dir` is a unit vector on the ground plane; `p` is the walker's own live position (it keys the
 * memory); `reach`: how far the walk still goes. Returns a new vector of length 1 or less: multiply it by the step.
 */
export function steer(p: THREE.Vector3, dir: THREE.Vector3, obstacles: readonly Obstacle[], body = 0.5, reach = Infinity) {
  // Look ahead no further than the walk goes: a goal right beside an obstacle is reached, not circled.
  const look = Math.min(SLIDE_LOOK, reach), ex = p.x + dir.x * look, ez = p.z + dir.z * look;
  let hit: Obstacle | null = null, hitD = Infinity;
  for (const o of obstacles) {
    closestOn(o.ax, o.az, o.bx, o.bz, p.x, p.z);
    const nx = _c[0] - p.x, nz = _c[1] - p.z, d = hyp(nx, nz);
    if (d > o.r + body + look || d < 1e-5 || d >= hitD) continue;
    if ((nx * dir.x + nz * dir.z) / d <= 0.05) continue;
    if (segDist(p.x, p.z, ex, ez, o.ax, o.az, o.bx, o.bz) >= o.r + body - 0.01) continue;
    hit = o;
    hitD = d;
  }
  if (!hit) {
    slideMemory.delete(p);
    return dir.clone();
  }
  const c = closest(hit, p.x, p.z);
  const d = Math.hypot(c.x - p.x, c.z - p.z), nx = (c.x - p.x) / d, nz = (c.z - p.z) / d;
  const into = dir.x * nx + dir.z * nz;
  const vx = dir.x - into * nx, vz = dir.z - into * nz, along = Math.hypot(vx, vz);
  if (along >= HEAD_ON) {
    slideMemory.delete(p);
    const speed = Math.max(along, SLIDE_SPEED) / along;
    return new THREE.Vector3(vx * speed, 0, vz * speed);
  }
  // Nearly straight at it. The edge's tangent turns with the normal, so a side stays the same way round.
  const tx = -nz, tz = nx;
  let mem = slideMemory.get(p);
  if (!mem || mem.o !== hit || mem.dx * dir.x + mem.dz * dir.z < 0.9) {
    const lean = vx * tx + vz * tz;
    const off = (p.x - (hit.ax + hit.bx) / 2) * tx + (p.z - (hit.az + hit.bz) / 2) * tz;
    mem = { o: hit, side: Math.abs(lean) > 0.05 ? Math.sign(lean) : off < 0 ? -1 : 1, dx: dir.x, dz: dir.z };
    slideMemory.set(p, mem);
  }
  return new THREE.Vector3(tx * mem.side * 0.7, 0, tz * mem.side * 0.7);
}

const cross = (ox: number, oz: number, px: number, pz: number, qx: number, qz: number) => (px - ox) * (qz - oz) - (pz - oz) * (qx - ox);
/** Distance from the point p to the segment s-e. */
function pointSeg(px: number, pz: number, sx: number, sz: number, ex: number, ez: number) {
  closestOn(sx, sz, ex, ez, px, pz);
  return hyp(px - _c[0], pz - _c[1]);
}

/** Distance between the segments a-b and c-d on the ground plane. */
export function segDist(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number) {
  const d1 = cross(cx, cz, dx, dz, ax, az), d2 = cross(cx, cz, dx, dz, bx, bz);
  const d3 = cross(ax, az, bx, bz, cx, cz), d4 = cross(ax, az, bx, bz, dx, dz);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(pointSeg(ax, az, cx, cz, dx, dz), pointSeg(bx, bz, cx, cz, dx, dz), pointSeg(cx, cz, ax, az, bx, bz), pointSeg(dx, dz, ax, az, bx, bz));
}

/** Where a moving body first touches an obstacle (`sweepHit`). */
export interface SweepContact {
  /** How far along from to (0..1) the body's centre is at the first touch. */
  t: number;
  /** The body's centre at that moment (y = 0). */
  point: THREE.Vector3;
  /** The obstacle's nearest spot to the body then (y = 0). */
  surface: THREE.Vector3;
  /** Unit vector from the obstacle toward the body at the touch (the way a slammed body bounces back). */
  normal: THREE.Vector3;
  obstacle: Obstacle;
}

/**
 * Sweeps a round body of `radius` along the straight path from `from` to `to` (ground plane) and returns the first
 * obstacle it touches, with the body's centre at that moment, or null when the path is clear. A body that starts
 * inside an obstacle touches at t = 0. For a carry (Brannoc's Forge Charge): sweep the carried target's path with its
 * body radius (0.5) to find the wall it is slammed into. Pass the live list (`arena.obstacles`).
 */
export function sweepHit(from: THREE.Vector3, to: THREE.Vector3, radius: number, obstacles: readonly Obstacle[]): SweepContact | null {
  const dx = to.x - from.x, dz = to.z - from.z;
  let best: SweepContact | null = null;
  for (const o of obstacles) {
    const reach = o.r + radius;
    // Distance from the body to the obstacle's segment as the body moves is convex in t: find the lowest point, then the first crossing.
    const dist = (t: number) => distTo(o, from.x + dx * t, from.z + dz * t);
    let hitT: number;
    if (dist(0) <= reach) hitT = 0;
    else {
      let lo = 0, hi = 1;
      for (let i = 0; i < 40; i++) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (dist(m1) < dist(m2)) hi = m2; else lo = m1;
      }
      const low = (lo + hi) / 2;
      if (dist(low) > reach) continue;
      lo = 0; hi = low;
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        if (dist(m) <= reach) hi = m; else lo = m;
      }
      hitT = hi;
    }
    if (best && hitT >= best.t) continue;
    const px = from.x + dx * hitT, pz = from.z + dz * hitT, c = closest(o, px, pz);
    let nx = px - c.x, nz = pz - c.z;
    const d = Math.hypot(nx, nz);
    if (d < 1e-5) { nx = -dx; nz = -dz; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; } else { nx /= d; nz /= d; }
    best = { t: hitT, point: new THREE.Vector3(px, 0, pz), surface: new THREE.Vector3(c.x, 0, c.z), normal: new THREE.Vector3(nx, 0, nz), obstacle: o };
  }
  return best;
}

/** True when an obstacle stands between `a` and `b` (ground plane): no line of sight. */
export function blocksSight(a: { x: number; z: number }, b: { x: number; z: number }, obstacles: readonly Obstacle[]) {
  return obstacles.some((o) => segDist(a.x, a.z, b.x, b.z, o.ax, o.az, o.bx, o.bz) < o.r * 0.9);
}

/** Whether a spell's aim strip and cast strip end at cover: line skillshots are bolts, unless `overCover`. A bank shot draws its own bounce. */
export const stopsAtCover = (s: { aim?: string; overCover?: true; bank?: true }) => s.aim === 'line' && !s.overCover && !s.bank;

/** Stone meshes for the obstacles: pillars with a gold band and cap, low walls with a gold top edge. */
export function buildObstacleMeshes(obstacles: readonly Obstacle[]) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x3a3440, roughness: 0.82, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1a22, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.4, metalness: 0.8, emissive: 0x2a1a04, emissiveIntensity: 0.6 });
  const shadowed = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; return m; };
  for (const o of obstacles) {
    if (o.kind === 'pillar') {
      const col = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.82, o.r * 0.92, o.height, 10), stone));
      col.position.set(o.ax, o.height / 2, o.az);
      const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(o.r * 1.08, o.r * 1.15, 0.35, 10), dark));
      base.position.set(o.ax, 0.175, o.az);
      const cap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(o.r * 1.1, o.r * 0.9, 0.3, 10), dark));
      cap.position.set(o.ax, o.height + 0.15, o.az);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.86, o.r * 0.86, 0.14, 10), gold);
      band.position.set(o.ax, o.height * 0.72, o.az);
      g.add(col, base, cap, band);
    } else {
      const len = Math.hypot(o.bx - o.ax, o.bz - o.az);
      const yaw = Math.atan2(o.bx - o.ax, o.bz - o.az);
      const w = new THREE.Group();
      w.position.set((o.ax + o.bx) / 2, 0, (o.az + o.bz) / 2);
      w.rotation.y = yaw;
      const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(o.r * 2, o.height, len + o.r * 2), stone));
      body.position.y = o.height / 2;
      const top = new THREE.Mesh(new THREE.BoxGeometry(o.r * 2.3, 0.12, len + o.r * 2.3), gold);
      top.position.y = o.height + 0.06;
      const foot = shadowed(new THREE.Mesh(new THREE.BoxGeometry(o.r * 2.6, 0.25, len + o.r * 2.6), dark));
      foot.position.y = 0.125;
      w.add(body, top, foot);
      g.add(w);
    }
  }
  return g;
}
