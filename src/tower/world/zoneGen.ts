import { RING, seeded } from '../../arenas/common';
import { pillar, type Obstacle } from '../../obstacles';

/**
 * What the wood's and the canyon's zones share (stage 2 of the Tower's floors as worlds): a zone is drawn from where it is OPEN (places,
 * and corridors between them, as circles and capsules) and everything else is filled with big masses of cover (tree clumps, bastions of
 * rock): a few tens of fat pillars instead of hundreds of small ones (the navigator builds its graph from the pieces, so the count is
 * what costs). A mass's radius is how far it can grow before it touches the open ground (less a small margin), so the open ground's edge
 * IS the masses' edge, and the way between two places is whatever corridor was asked for.
 *
 * Offsets (dx, dz) are from the middle of the ring (`RING`), as in the floors' data.
 */

export interface Open {
  x: number; z: number; r: number;
  /** A capsule from (x, z) to (x2, z2), radius r. */
  x2?: number; z2?: number;
}
export interface Mass { x: number; z: number; r: number }

/** How far (dx, dz) is outside the open ground (negative inside it). */
export function outside(opens: Open[], x: number, z: number) {
  let d = 1e9;
  for (const o of opens) {
    const ex = (o.x2 ?? o.x) - o.x, ez = (o.z2 ?? o.z) - o.z, l2 = ex * ex + ez * ez;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - o.x) * ex + (z - o.z) * ez) / l2)) : 0;
    d = Math.min(d, Math.hypot(x - (o.x + ex * t), z - (o.z + ez * t)) - o.r);
  }
  return d;
}

/** A corridor of half-width `w` along a line of points: its capsules. */
export const corridor = (pts: [number, number][], w: number): Open[] =>
  pts.slice(1).map((p, i) => ({ x: pts[i][0], z: pts[i][1], x2: p[0], z2: p[1], r: w }));

/**
 * The masses that fill all but the open ground: a hex lattice (jittered) over the ring and a little beyond, each as big as it can be
 * without touching the open ground. `rMax` caps a mass, `rMin` drops the ones that would be too small to be worth a piece.
 */
export function masses(opens: Open[], o: { ring: number; spacing: number; rMax: number; rMin: number; margin: number; jitter: number; seed: number; reach?: number; rFill?: number; rPlug?: number; deep?: number }): Mass[] {
  const rnd = seeded(o.seed), out: Mass[] = [], reach = o.ring + (o.reach ?? 1.5);
  const rowH = o.spacing * 0.866;
  for (let row = -Math.ceil(reach / rowH); row <= Math.ceil(reach / rowH); row++) {
    for (let col = -Math.ceil(reach / o.spacing); col <= Math.ceil(reach / o.spacing); col++) {
      const x = (col + (row & 1 ? 0.5 : 0)) * o.spacing + (rnd() - 0.5) * o.jitter, z = row * rowH + (rnd() - 0.5) * o.jitter;
      if (Math.hypot(x, z) > reach) continue;
      const r = Math.min(o.rMax, outside(opens, x, z) - o.margin);
      if (r >= o.rMin) out.push({ x, z, r });
    }
  }
  // The lattice leaves holes where open ground is near: fill what is still free and wide enough (greedily, widest first) with more masses,
  // so that what is left uncovered is only a thin strip along the open ground's edge (at most `rFill` + `margin` deep), never a clearing.
  const rFill = o.rFill ?? 2, cell = 1.2, free: { x: number; z: number; r: number }[] = [];
  for (let x = -reach; x <= reach; x += cell) for (let z = -reach; z <= reach; z += cell) {
    if (Math.hypot(x, z) > reach) continue;
    const r = Math.min(o.rMax, outside(opens, x, z) - o.margin);
    if (r >= rFill && !out.some((m) => Math.hypot(m.x - x, m.z - z) < m.r)) free.push({ x, z, r });
  }
  free.sort((a, b) => b.r - a.r);
  const left = new Set(free);
  for (const f of free) {
    if (!left.has(f)) continue;
    out.push({ x: f.x, z: f.z, r: f.r });
    for (const g of left) if (Math.hypot(g.x - f.x, g.z - f.z) < f.r) left.delete(g);
  }
  // Two masses that do not quite touch leave a channel a walker can squeeze through (the navigator lets a body of 0.5 m graze cover): plug
  // every spot a walker could stand on deep in the forest (more than `deep` m from the open ground) with a small mass, so the forest has no
  // way through it. The strips along the open ground's edge are left: they are dead ends no deeper than `deep`.
  const body = 0.47, plugR = o.rPlug ?? 2, deep = o.deep ?? 3.4;
  for (let x = -reach; x <= reach; x += 0.6) for (let z = -reach; z <= reach; z += 0.6) {
    if (Math.hypot(x, z) > reach) continue;
    const away = outside(opens, x, z);
    if (away < deep) continue;
    if (out.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + body)) continue;
    out.push({ x, z, r: Math.min(plugR, away - o.margin) });
  }
  return out;
}

/** A mass as the cover the arena knows (a pillar; `height` is only the look). */
export const massCover = (m: Mass, height: number): Obstacle => ({ ...pillar(RING.x + m.x, RING.z + m.z, m.r), height });

/** The barrier that closes a corridor: across the middle of its longest leg, ends buried in the masses on both sides. */
export function barrier(pts: [number, number][], w: number, height: number, set: 0 | 1, name: string) {
  let best = 0, bl = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (l > bl) { bl = l; best = i; }
  }
  const a = pts[best - 1], b = pts[best], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, tx = (b[0] - a[0]) / bl, tz = (b[1] - a[1]) / bl;
  const nx = -tz, nz = tx, half = w + 4.2;
  const at = (dx: number, dz: number) => ({ x: RING.x + dx, z: RING.z + dz });
  return { a: at(mx - nx * half, mz - nz * half), b: at(mx + nx * half, mz + nz * half), r: 0.7, height, set, name };
}
