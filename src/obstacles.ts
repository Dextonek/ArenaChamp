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
}

export const pillar = (x: number, z: number, r = 0.85): Obstacle => ({ ax: x, az: z, bx: x, bz: z, r, height: 4.2, kind: 'pillar' });
export const wall = (ax: number, az: number, bx: number, bz: number): Obstacle => ({ ax, az, bx, bz, r: 0.35, height: 2.3, kind: 'wall' });

/**
 * The duel ring's layout (ring centre (0, 7), radius 12; the heroes start at z 13 and z 1). Point-symmetric about
 * the centre, so both sides get the same cover: a short wall across the middle hides the two starts from each
 * other, four pillars at the diagonals, and two side walls along the edge.
 */
export const DUEL_OBSTACLES: Obstacle[] = [
  wall(-2.2, 7, 2.2, 7),
  pillar(-5, 3.6),
  pillar(5, 3.6),
  pillar(-5, 10.4),
  pillar(5, 10.4),
  wall(-8.6, 5.4, -8.6, 8.6),
  wall(8.6, 5.4, 8.6, 8.6),
];

/** Closest point to (px, pz) on the obstacle's segment. */
function closest(o: Obstacle, px: number, pz: number) {
  const dx = o.bx - o.ax, dz = o.bz - o.az, len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? THREE.MathUtils.clamp(((px - o.ax) * dx + (pz - o.az) * dz) / len2, 0, 1) : 0;
  return { x: o.ax + dx * t, z: o.az + dz * t };
}

/** Moves `p` (ground plane, y ignored) out of every obstacle, keeping `body` clearance. Returns `p`. */
export function pushOut(p: THREE.Vector3, obstacles: readonly Obstacle[], body = 0.5) {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      const c = closest(o, p.x, p.z);
      let dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz), min = o.r + body;
      if (d >= min) continue;
      if (d < 1e-5) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
      p.x = c.x + dx * min;
      p.z = c.z + dz * min;
    }
  }
  return p;
}

/**
 * A walking direction that slides round an obstacle in the way instead of pushing into it: when the hero at `p`
 * is about to touch an obstacle it is walking toward, the direction turns along the obstacle's edge (the side
 * closer to where it was going). `dir` is a unit vector on the ground plane; returns a new unit vector.
 * Only an obstacle the straight walk would run into turns it, the nearest one: a gap between two obstacles that is
 * wide enough for the body is walked straight through (turning for both made the hero shuffle in place there).
 * `reach`: how far the walk still goes.
 */
export function steer(p: THREE.Vector3, dir: THREE.Vector3, obstacles: readonly Obstacle[], body = 0.5, reach = Infinity) {
  const out = dir.clone();
  // Look ahead no further than the walk goes: a goal right beside an obstacle is reached, not circled.
  const look = Math.min(0.7, reach), ex = p.x + dir.x * look, ez = p.z + dir.z * look;
  let hit: Obstacle | null = null, hitD = Infinity;
  for (const o of obstacles) {
    const c = closest(o, p.x, p.z);
    const nx = c.x - p.x, nz = c.z - p.z, d = Math.hypot(nx, nz);
    if (d > o.r + body + look || d < 1e-5 || d >= hitD) continue;
    if ((nx * dir.x + nz * dir.z) / d <= 0.05) continue;
    if (segDist(p.x, p.z, ex, ez, o.ax, o.az, o.bx, o.bz) >= o.r + body - 0.01) continue;
    hit = o;
    hitD = d;
  }
  if (hit) {
    const o = hit;
    const c = closest(o, p.x, p.z);
    const nx = c.x - p.x, nz = c.z - p.z, d = Math.hypot(nx, nz);
    // Tangent of the obstacle's edge, on the side of the obstacle's middle the hero already stands on (sideways
    // of the walk). Choosing by the walk direction alone flips every frame when walking straight at it.
    let tx = -nz / d, tz = nx / d;
    const mx = p.x - (o.ax + o.bx) / 2, mz = p.z - (o.az + o.bz) / 2;
    const along = mx * dir.x + mz * dir.z;
    const lx = mx - along * dir.x, lz = mz - along * dir.z;
    const side = tx * lx + tz * lz;
    if (side < 0 || (Math.abs(side) < 1e-4 && tx * out.x + tz * out.z < 0)) { tx = -tx; tz = -tz; }
    out.set(tx, 0, tz);
  }
  return out.normalize();
}

/** Distance between the segments a-b and c-d on the ground plane. */
export function segDist(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number) {
  const cross = (ox: number, oz: number, px: number, pz: number, qx: number, qz: number) => (px - ox) * (qz - oz) - (pz - oz) * (qx - ox);
  const d1 = cross(cx, cz, dx, dz, ax, az), d2 = cross(cx, cz, dx, dz, bx, bz);
  const d3 = cross(ax, az, bx, bz, cx, cz), d4 = cross(ax, az, bx, bz, dx, dz);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  const pt = (px: number, pz: number, sx: number, sz: number, ex: number, ez: number) => {
    const c = closest({ ax: sx, az: sz, bx: ex, bz: ez, r: 0, height: 0, kind: 'wall' }, px, pz);
    return Math.hypot(px - c.x, pz - c.z);
  };
  return Math.min(pt(ax, az, cx, cz, dx, dz), pt(bx, bz, cx, cz, dx, dz), pt(cx, cz, ax, az, bx, bz), pt(dx, dz, ax, az, bx, bz));
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
    const dist = (t: number) => {
      const px = from.x + dx * t, pz = from.z + dz * t, c = closest(o, px, pz);
      return Math.hypot(px - c.x, pz - c.z);
    };
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
export function blocksSight(a: THREE.Vector3, b: THREE.Vector3, obstacles: readonly Obstacle[]) {
  return obstacles.some((o) => segDist(a.x, a.z, b.x, b.z, o.ax, o.az, o.bx, o.bz) < o.r * 0.9);
}

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
