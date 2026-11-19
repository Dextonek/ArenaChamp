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
  // The longest roads first, kept whole; a shorter one is cut where it runs along them (2026-11-19, the user: "there is multiple road
  // mix together": taken in the floor's order, a spur into a yard was kept and the long track by it cut, two ends side by side).
  const lens = full.map((p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; });
  const order = full.map((_, k) => k).sort((a, b) => lens[b] - lens[a] || a - b);
  const pieces: { pts: Pt[]; len: number; joins: number }[] = [];
  order.forEach((k, rank) => {
    const pts = full[k];
    const near = (q: Pt) => {
      let best: { at: Pt; d: number } | null = null;
      for (let r = 0; r < rank; r++) {
        const e = order[r], l = coarse[e], bx = Math.max(l.x0 - q[0], 0, q[0] - l.x1), bz = Math.max(l.z0 - q[1], 0, q[1] - l.z1);
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
          let joins = joinedStart ? 1 : 0;
          if (endJoin) {
            const e = run[run.length - 1], f = run[run.length - 2], n = near(e);
            if (n && onward(e, n.at, [e[0] - f[0], e[1] - f[1]])) { run.push(n.at); joins++; }
          }
          // the joins rounded too (a join is a turn of its own), at a tighter radius
          pieces.push({ pts: endJoin || joinedStart ? resample(smoothPath(run.filter((_, i) => i === 0 || i === run.length - 1 || i % 4 === 0), 2.5), step) : run, len, joins });
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
  // A short piece left between two roads, joined to one at each end (a stub that only links two roads already near each other): dropped.
  const out = pieces.filter((p) => !(p.joins === 2 && p.len < 12)).map((p) => p.pts);
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
 * The roads' sides, planned once for every chapter (2026-11-19, the user: "put them into scenario", then "Yes, all chapters"); each
 * chapter draws the pieces in its own look through the callbacks it gives (the ones it leaves out are not planned). Along the clean
 * network (world coordinates), on the caller's own random stream:
 * - `kerb`: where a road comes into a place, stones lining both edges for its last 9 m (2.15 m out, every half metre);
 * - `lantern`: every 15 to 19 m, from side to side, 3 m out;
 * - `post` and `rail`: a fence on the outer side of every bend (and now and then on a straight), posts every 2 m, 3.3 m out, rails
 *   between neighbouring posts so they follow the curve;
 * - `verge`: grass (or the chapter's like) on both verges, 2.25 to 2.85 m out;
 * - `signpost` at each mouth into a place (not the camp), `milestone` where a road ends on another road.
 * `ok(x, z, pad, road, place?)` says whether a piece may stand there (the chapter's own ground, cover, water...; `road`: how far from
 * the clean roads at least); `blocked(x, z, r)` whether it would stand on one of the floor's spots (then it is drawn muted: the caller
 * decides what muted means). The draws from `rnd` are the same whatever the callbacks draw.
 */
export interface Roadside {
  rnd: () => number;
  places: { x: number; z: number; r: number; kind?: string }[];
  ok(x: number, z: number, pad: number, road: number, place?: number): boolean;
  blocked(x: number, z: number, r: number): boolean;
  kerb?(x: number, z: number, yaw: number, u: number, sy: number, muted: boolean): void;
  lantern?(x: number, z: number, nx: number, nz: number, side: number, yaw: number, muted: boolean): void;
  post?(x: number, z: number, yaw: number): void;
  rail?(mx: number, mz: number, yaw: number, len: number): void;
  vergeOk?(x: number, z: number): boolean;
  verge?(x: number, z: number, scale: number, turn: number, sy: number): void;
  signpost?(x: number, z: number, a: number, muted: boolean): void;
  milestone?(x: number, z: number, yaw: number, muted: boolean): void;
}
export function roadside(net: Pt[][], o: Roadside) {
  const rr = o.rnd;
  for (const p of net) {
    const pts: { x: number; z: number; ux: number; uz: number; s: number }[] = [];
    const total = along(p, 1, (x, z, ux, uz, s) => pts.push({ x, z, ux, uz, s }));
    if (total < 4) continue;
    const placeAt = (q: Pt) => o.places.find((pl) => Math.hypot(pl.x - q[0], pl.z - q[1]) < pl.r + 2.5);
    const startPlace = placeAt(p[0]), endPlace = placeAt(p[p.length - 1]);
    // how much the road turns round each point (over 3 m either side), and to which side
    const bendAt = (i: number) => {
      const a = pts[Math.max(0, i - 3)], b = pts[Math.min(pts.length - 1, i + 3)];
      const cross = a.ux * b.uz - a.uz * b.ux;
      return { turn: Math.acos(Math.max(-1, Math.min(1, a.ux * b.ux + a.uz * b.uz))), outer: cross > 0 ? -1 : 1 };
    };
    let side = rr() < 0.5 ? 1 : -1, nextLamp = 4 + rr() * 8, fenceRun = 0, fenceSide = 1;
    const posts: { x: number; z: number; side: number }[] = [];
    const flushFence = () => {
      for (let i = 1; i < posts.length; i++) {
        const a = posts[i - 1], b = posts[i], L = Math.hypot(b.x - a.x, b.z - a.z);
        if (L > 2.6 || a.side !== b.side) continue;
        o.rail?.((a.x + b.x) / 2, (a.z + b.z) / 2, Math.atan2(b.x - a.x, b.z - a.z), L + 0.1);
      }
      posts.length = 0;
    };
    pts.forEach((q, i) => {
      const nx = -q.uz, nz = q.ux, yaw = Math.atan2(q.ux, q.uz);
      const toStart = q.s, toEnd = total - q.s;
      // kerbs where the road comes into a place
      if (o.kerb && ((startPlace && toStart < 9) || (endPlace && toEnd < 9))) {
        for (const s of [-1, 1]) for (const f of [0, 0.5]) {
          const x = q.x + nx * s * 2.15 + q.ux * f, z = q.z + nz * s * 2.15 + q.uz * f;
          if (!o.ok(x, z, 0.2, 1.9)) continue;
          const muted = o.blocked(x, z, 0.3), u = rr(), yj = (rr() - 0.5) * 0.15, sy = 1 + rr() * 0.35;
          o.kerb(x, z, yaw + yj, u, sy, muted);
        }
      }
      // a lantern now and then, from side to side
      if (o.lantern && q.s >= nextLamp && toEnd > 3) {
        const x = q.x + nx * side * 3.0, z = q.z + nz * side * 3.0;
        if (o.ok(x, z, 0.5, 2.6, 1)) { o.lantern(x, z, nx, nz, side, yaw, o.blocked(x, z, 0.7)); nextLamp = q.s + 15 + rr() * 4; side = -side; }
        else nextLamp = q.s + 2;
      }
      // a fence on the outer side of a bend; now and then a run on a straight
      if (o.post) {
        const bend = bendAt(i);
        if (bend.turn > 0.3 && fenceRun <= 0) { if (posts.length) flushFence(); fenceRun = 8; fenceSide = bend.outer; }
        else if (fenceRun <= 0 && rr() < 0.012) { if (posts.length) flushFence(); fenceRun = 8 + rr() * 10; fenceSide = rr() < 0.5 ? 1 : -1; }
        if (fenceRun > 0) {
          fenceRun -= 1;
          if (i % 2 === 0) {
            const x = q.x + nx * fenceSide * 3.3, z = q.z + nz * fenceSide * 3.3;
            if (o.ok(x, z, 0.3, 2.9, 1) && !o.blocked(x, z, 0.3)) { o.post(x, z, yaw); posts.push({ x, z, side: fenceSide }); }
            else flushFence();
          }
          if (fenceRun <= 0) flushFence();
        }
      }
      // grass on the verges
      if (o.verge) for (const s of [-1, 1]) {
        if (rr() < 0.45) continue;
        const d = 2.25 + rr() * 0.6, x = q.x + nx * s * d + q.ux * (rr() - 0.5), z = q.z + nz * s * d + q.uz * (rr() - 0.5);
        if ((o.vergeOk && !o.vergeOk(x, z)) || !o.ok(x, z, 0.2, 2.1, 0.5)) continue;
        const sc = 0.7 + rr() * 0.6, turn = rr() * 6.28, sy = 0.6 + rr() * 0.7;
        o.verge(x, z, sc, turn, sy);
      }
    });
    flushFence();
    // a signpost at each mouth into a place, a milestone where a road ends on another road
    for (const [q, pl, u] of [[p[0], startPlace, pts[0]], [p[p.length - 1], endPlace, pts[pts.length - 1]]] as const) {
      const nx = -u.uz, nz = u.ux, s = rr() < 0.5 ? 1 : -1;
      if (pl) {
        if (!o.signpost) continue;
        const x = q[0] + nx * s * 2.8, z = q[1] + nz * s * 2.8, a = Math.atan2(q[0] - pl.x, q[1] - pl.z);
        if (pl.kind === 'camp' || !o.ok(x, z, 0.4, 2.3)) continue;
        o.signpost(x, z, a, o.blocked(x, z, 0.5));
      } else {
        if (!o.milestone) continue;
        const x = q[0] + nx * s * 2.7 - u.ux * 1.5, z = q[1] + nz * s * 2.7 - u.uz * 1.5;
        if (!o.ok(x, z, 0.4, 2.3)) continue;
        o.milestone(x, z, Math.atan2(u.ux, u.uz), o.blocked(x, z, 0.4));
      }
    }
  }
}

/** A floor's roads as world points (offsets from the ring's middle plus `RING`), the clean network. */
export const worldNet = (paths: Pt[][], ring: { x: number; z: number }) => roadNet(paths).map((p) => p.map(([dx, dz]) => [ring.x + dx, ring.z + dz] as Pt));

/**
 * The distance to the nearest road, the old legs or the clean curve, whichever is nearer (a chapter's props measured against the legs
 * alone; on the inside of a bend the curve came up to about 1.5 m nearer). Past 5 m from the legs no check asks, so the legs decide.
 */
export function legsOrCurve(legs: (x: number, z: number) => number, net: Pt[][]): (x: number, z: number) => number {
  const curve = distanceTo(net);
  return (x, z) => { const d = legs(x, z); return d > 5 ? d : Math.min(d, curve(x, z)); };
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
