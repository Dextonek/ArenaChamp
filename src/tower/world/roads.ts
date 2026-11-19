/**
 * The Climb's roads as they are DRAWN (2026-11-19, the user: "lets make road more cleanly and like put them into scenario").
 *
 * A floor's data keeps its roads as the generator laid them: a few straight legs a road, with a hard corner at every joint, and on most
 * sea and sands floors the camp's road to the middle running for 15 to 26 m right beside a spoke road (two roads side by side). Everything
 * that keeps off a road (cover, scenes, life, the depth's props) measures against those legs and is left as it is; only the painters
 * and the roadside props walk the CLEAN network made here:
 *
 * - every corner rounded (a curve of up to `R` m each side of the joint; it leaves the old line by at most about a metre and a half);
 * - a stretch of a road that runs within `overlap` m of an earlier road is dropped, and the cut end is joined to that road where it is
 *   nearest (a T junction, a crossing, or one road where there were two);
 * - points about every `step` m, so stones and slabs can be laid along the curve (`along`), never in stair-steps at a bend.
 *
 * Offsets (dx, dz) from the ring's middle, as in the floors' data. The result is cached per paths array.
 */
export type Pt = [number, number];

/** A road's corners rounded: each joint becomes a quadratic curve from `d` before it to `d` after it (`d` at most `R`, and at most
 *  0.45 of either leg, so two curves never overlap). */
export function smoothPath(p: Pt[], R = 6): Pt[] {
  if (p.length < 3) return p.slice();
  const out: Pt[] = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const d = Math.min(R, l1 * 0.45, l2 * 0.45);
    const A: Pt = [b[0] - ((b[0] - a[0]) / l1) * d, b[1] - ((b[1] - a[1]) / l1) * d];
    const B: Pt = [b[0] + ((c[0] - b[0]) / l2) * d, b[1] + ((c[1] - b[1]) / l2) * d];
    const turn = Math.abs(Math.atan2((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])));
    const n = Math.max(2, Math.min(10, Math.ceil(turn / 0.12)));
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      out.push([u * u * A[0] + 2 * u * t * b[0] + t * t * B[0], u * u * A[1] + 2 * u * t * b[1] + t * t * B[1]]);
    }
  }
  out.push(p[p.length - 1]);
  return out;
}

/** The line's points about every `step` m (its own points kept where they are closer). */
export function resample(p: Pt[], step: number): Pt[] {
  const out: Pt[] = [p[0]];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** The nearest point of a line to (x, z), and how far it is. */
export function nearestOn(p: Pt[], x: number, z: number): { at: Pt; d: number } {
  let best: { at: Pt; d: number } = { at: p[0], d: Infinity };
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / l2)) : 0;
    const q: Pt = [a[0] + ex * t, a[1] + ez * t], d = Math.hypot(x - q[0], z - q[1]);
    if (d < best.d) best = { at: q, d };
  }
  return best;
}

const CACHE = new WeakMap<object, Pt[][]>();

/**
 * The clean network of a floor's roads (see the head of this file). `overlap`: how near an earlier road a stretch must run to be
 * dropped (about a road's width). Pieces shorter than `minLen` m that are left between two cuts are dropped too.
 */
export function roadNet(paths: Pt[][], o: { R?: number; step?: number; overlap?: number; minLen?: number } = {}): Pt[][] {
  const hit = CACHE.get(paths);
  if (hit) return hit;
  const R = o.R ?? 6, step = o.step ?? 0.5, overlap = o.overlap ?? 3.2, minLen = o.minLen ?? 2.5;
  const full = paths.map((p) => resample(smoothPath(p, R), step));
  // for the search: each road thinned to 2 m pieces (a bend's chord sags a few cm) with its box, skipped whole when farther than the best
  const coarse = full.map((p) => {
    const q = p.filter((_, i) => i % 4 === 0 || i === p.length - 1);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of q) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    return { q, x0, z0, x1, z1 };
  });
  const out: Pt[][] = [];
  full.forEach((pts, k) => {
    const near = (q: Pt) => {
      let best: { at: Pt; d: number } | null = null;
      for (let e = 0; e < k; e++) {
        const l = coarse[e], bx = Math.max(l.x0 - q[0], 0, q[0] - l.x1), bz = Math.max(l.z0 - q[1], 0, q[1] - l.z1);
        if (best && Math.hypot(bx, bz) >= best.d) continue;
        const n = nearestOn(l.q, q[0], q[1]);
        if (!best || n.d < best.d) best = n;
      }
      return best;
    };
    const keep = pts.map((q) => { const n = near(q); return !n || n.d > overlap; });
    /** Does the way from `a` to `b` go on the way the road ran (`u`), not back on itself? */
    const onward = (a: Pt, b: Pt, u: Pt) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return l < 1e-6 || (dx * u[0] + dz * u[1]) / l > -0.2; };
    let run: Pt[] = [], joinedStart = false;
    const flush = (endJoin: boolean) => {
      if (run.length >= 2) {
        let len = 0;
        for (let i = 1; i < run.length; i++) len += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]);
        if (len >= minLen) {
          if (endJoin) {
            const e = run[run.length - 1], f = run[run.length - 2], n = near(e);
            if (n && onward(e, n.at, [e[0] - f[0], e[1] - f[1]])) run.push(n.at);
          }
          // the joins rounded too (a join is a turn of its own), at a tighter radius
          out.push(endJoin || joinedStart ? resample(smoothPath(run.filter((_, i) => i === 0 || i === run.length - 1 || i % 4 === 0), 2.5), step) : run);
        }
      }
      run = [];
      joinedStart = false;
    };
    for (let i = 0; i < pts.length; i++) {
      if (keep[i]) {
        if (run.length === 0 && i > 0 && i + 1 < pts.length) { // a cut start joins the road it left, unless that join turns back
          const n = near(pts[i]);
          if (n && onward(n.at, pts[i], [pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]])) { run.push(n.at); joinedStart = true; }
        }
        run.push(pts[i]);
      } else if (run.length) flush(true);
    }
    flush(false);
  });
  CACHE.set(paths, out);
  return out;
}

/**
 * How far (x, z) is from the nearest road of a network, fast: each road thinned to every `every`-th point (2 m pieces; a bend's chord
 * sags a few centimetres) and skipped whole when its box is farther than the best so far. For the many checks a floor's props make.
 */
export function distanceTo(net: Pt[][], every = 4, reach = 6): (x: number, z: number) => number {
  // A grid of 8 m cells, each holding the pieces within `reach` m of it: a check looks only at its own cell's pieces. Farther than
  // `reach` from every road it answers Infinity (the callers only ask whether a road is within a few metres).
  const CELL = 8, cells = new Map<string, number[]>(), segs: number[][] = [];
  for (const p of net) {
    const q = p.filter((_, i) => i % every === 0 || i === p.length - 1);
    for (let i = 1; i < q.length; i++) {
      const s = [q[i - 1][0], q[i - 1][1], q[i][0], q[i][1]], id = segs.push(s) - 1;
      const cx0 = Math.floor((Math.min(s[0], s[2]) - reach) / CELL), cx1 = Math.floor((Math.max(s[0], s[2]) + reach) / CELL);
      const cz0 = Math.floor((Math.min(s[1], s[3]) - reach) / CELL), cz1 = Math.floor((Math.max(s[1], s[3]) + reach) / CELL);
      for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
        const k = `${cx}:${cz}`;
        let c = cells.get(k);
        if (!c) cells.set(k, (c = []));
        c.push(id);
      }
    }
  }
  return (x, z) => {
    const c = cells.get(`${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`);
    if (!c) return Infinity;
    let best = Infinity;
    for (const id of c) {
      const [ax, az, bx, bz] = segs[id], ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
      best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
    }
    return best > reach ? Infinity : best;
  };
}

/**
 * Walks a line every `step` m from `start` (arc length, across its joints): `fn(x, z, ux, uz, s)` with the way it runs (a unit vector)
 * and how far along it is. Stops `end` m before its end.
 */
export function along(p: Pt[], step: number, fn: (x: number, z: number, ux: number, uz: number, s: number) => void, start = 0, end = 0) {
  let total = 0;
  for (let i = 1; i < p.length; i++) total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  let s = start, i = 1, at = 0;
  while (s <= total - end && i < p.length) {
    const a = p[i - 1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s > at + L && i < p.length - 1) { at += L; i++; continue; }
    const t = L > 0 ? Math.min(1, (s - at) / L) : 0, ux = L > 0 ? (b[0] - a[0]) / L : 1, uz = L > 0 ? (b[1] - a[1]) / L : 0;
    fn(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, ux, uz, s);
    s += step;
  }
  return total;
}

/** A line moved sideways by `off` m (left of the way it runs for a positive `off`). */
export function offsetLine(p: Pt[], off: number): Pt[] {
  return p.map((q, i) => {
    const j = Math.min(p.length - 1, i + 1), k = Math.max(0, i - 1), nx = -(p[j][1] - p[k][1]), nz = p[j][0] - p[k][0], nl = Math.hypot(nx, nz) || 1;
    return [q[0] + (nx / nl) * off, q[1] + (nz / nl) * off] as Pt;
  });
}
