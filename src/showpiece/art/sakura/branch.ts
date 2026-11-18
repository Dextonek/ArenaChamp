import { clamp, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { SAKURA, type FlowerPose } from './petal';

/**
 * The cherry branch, brushed in sumi ink: a main limb from the lower left rising across the frame, its side limbs and
 * twigs, every one a tapered ribbon with dry-brush streaks and knots. Made once; drawn grown up to a time and bent by
 * the wind (each point turned about the root, more the further out it is). The blossom sites hang on it.
 */

/** The point the whole branch turns about in the wind. */
export const ROOT: Pt = { x: -80, y: 900 };

export interface Limb {
  pts: Pt[];
  w0: number;
  w1: number;
  /** When it starts to be brushed, and how long it takes. */
  t0: number;
  dur: number;
  /** Its arc length (for the flowers' wave). */
  s0: number;
}

/** A smooth curve through control points (Catmull-Rom), `n` points per span. */
function spline(cp: Pt[], n = 14): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < cp.length - 1; i++) {
    const p0 = cp[Math.max(0, i - 1)], p1 = cp[i], p2 = cp[i + 1], p3 = cp[Math.min(cp.length - 1, i + 2)];
    for (let j = 0; j < n; j++) {
      const u = j / n, u2 = u * u, u3 = u2 * u;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(cp[cp.length - 1]);
  return out;
}

function lengthOf(pts: Pt[]) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

/** The point at fraction `u` along a polyline, and its direction. */
export function along(pts: Pt[], u: number): { p: Pt; a: number } {
  const f = clamp(u) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i;
  const a = pts[i], b = pts[i + 1];
  return { p: { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }, a: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** The main limbs: [control points, base width, tip width, parent limb, where on it]. */
const MAIN: [Pt[], number, number, number, number][] = [
  [[{ x: -80, y: 930 }, { x: 180, y: 846 }, { x: 470, y: 790 }, { x: 760, y: 742 }, { x: 1040, y: 690 }, { x: 1320, y: 600 }, { x: 1560, y: 500 }, { x: 1760, y: 452 }, { x: 1890, y: 446 }], 58, 7, -1, 0],
  [[{ x: 0, y: 0 }, { x: 470, y: 660 }, { x: 560, y: 560 }, { x: 700, y: 492 }, { x: 790, y: 470 }], 24, 4, 0, 0.27],
  [[{ x: 0, y: 0 }, { x: 900, y: 610 }, { x: 990, y: 520 }, { x: 1080, y: 420 }, { x: 1150, y: 330 }, { x: 1170, y: 262 }], 26, 4, 0, 0.47],
  [[{ x: 0, y: 0 }, { x: 1250, y: 700 }, { x: 1360, y: 760 }, { x: 1470, y: 780 }, { x: 1560, y: 770 }], 18, 4, 0, 0.6],
  [[{ x: 0, y: 0 }, { x: 1470, y: 440 }, { x: 1530, y: 350 }, { x: 1640, y: 290 }, { x: 1730, y: 270 }], 20, 4, 0, 0.76],
  [[{ x: 0, y: 0 }, { x: 640, y: 830 }, { x: 760, y: 880 }, { x: 860, y: 890 }], 13, 3, 0, 0.36],
  [[{ x: 0, y: 0 }, { x: 1010, y: 480 }, { x: 920, y: 400 }, { x: 870, y: 330 }], 11, 3, 2, 0.42],
];

/** Every limb and twig, in drawing order. */
export const LIMBS: Limb[] = (() => {
  const out: Limb[] = [];
  for (const [cp, w0, w1, parent, at] of MAIN) {
    let pts = cp;
    let t0 = 0.12, s0 = 0;
    if (parent >= 0) {
      const par = out[parent];
      const { p } = along(par.pts, at);
      pts = [p, ...cp.slice(1)];
      t0 = par.t0 + par.dur * at;
      s0 = par.s0 + lengthOf(par.pts) * at;
    }
    const sp = spline(pts);
    out.push({ pts: sp, w0, w1, t0, dur: parent < 0 ? 0.85 : 0.18 + lengthOf(sp) / 2400, s0 });
  }
  // Twigs: short strokes off the limbs.
  const r = rng(4242);
  const mains = out.length;
  for (let li = 0; li < mains; li++) {
    const limb = out[li];
    const n = li === 0 ? 7 : li < 5 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const at = li === 0 ? r.range(0.15, 0.95) : r.range(0.3, 0.9);
      const { p, a } = along(limb.pts, at);
      const side = r.sign();
      // Twigs lean up, as a cherry's do.
      let ang = a + side * r.range(0.5, 1.1);
      if (Math.sin(ang) > 0.3) ang = a - side * r.range(0.5, 1.0);
      const len = r.range(50, 130);
      const bend = r.sign() * r.range(0.25, 0.6);
      const cp = [p, { x: p.x + Math.cos(ang) * len * 0.5, y: p.y + Math.sin(ang) * len * 0.5 },
        { x: p.x + Math.cos(ang + bend) * len, y: p.y + Math.sin(ang + bend) * len }];
      const sp = spline(cp, 6);
      const w = lerp(limb.w0, limb.w1, at);
      out.push({ pts: sp, w0: Math.min(11, w * 0.55), w1: 3.2, t0: limb.t0 + limb.dur * at, dur: 0.22, s0: limb.s0 + lengthOf(limb.pts) * at });
    }
  }
  return out;
})();

/** A point turned about the root by the wind's bend. */
export function bendPt(p: Pt, bend: number): Pt {
  if (bend === 0) return p;
  const dx = p.x - ROOT.x, dy = p.y - ROOT.y, d = Math.hypot(dx, dy);
  const a = bend * (d / 1900) ** 1.6;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: ROOT.x + dx * c - dy * s, y: ROOT.y + dx * s + dy * c };
}

const dry = wobble(3131);

export interface BranchStyle {
  /** The ink's colour. */
  color: string;
  /** Dry-brush streaks (paper showing through), 0 to 1. */
  streaks: number;
  /** A rim of light along the upper side (glow layer), 0 to 1. */
  rim?: number;
}

/** The branch brushed in up to time `t` (each limb grows from its base), bent by `bend`. */
export function drawBranch(ctx: Ctx, t: number, bend: number, st: BranchStyle, glow?: Ctx) {
  for (const [li, limb] of LIMBS.entries()) {
    const k = clamp((t - limb.t0) / limb.dur);
    if (k <= 0) continue;
    const n = Math.max(2, Math.ceil(limb.pts.length * k));
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const u = (k * i) / (n - 1);
      const { p } = along(limb.pts, u);
      pts.push(bendPt(p, bend));
    }
    const width = (u: number) => {
      const g = u * k;
      // The brush's tip: the stroke tapers where it is still being drawn.
      const tip = k < 1 ? clamp((1 - u) * 8) * 0.6 + 0.4 : 1;
      const base = li === 0 ? 1 : 0.85 + 0.15 * clamp(u * 6);
      return lerp(limb.w0, limb.w1, g ** 0.8) * tip * base * (1 + 0.08 * dry(g * 30 + li));
    };
    // A pale wash of ink round the stroke, where the brush bled into the paper.
    if (st.streaks > 0) {
      ctx.fillStyle = rgba('#6b5a63', 0.12 * st.streaks);
      ribbon(ctx, pts, (u) => width(u) * 1.45 + 3);
    }
    ctx.fillStyle = st.color;
    ribbon(ctx, pts, width);
    // Knots: small swellings along the bigger limbs.
    if (limb.w0 > 12) {
      const r = rng(77 + li);
      for (let i = 0; i < 4; i++) {
        // Both randoms drawn before the test, so a knot appearing never moves the next ones.
        const u = r.range(0.1, 0.9), turn = r.range(-0.4, 0.4);
        if (u > k) continue;
        const { p, a } = along(limb.pts, u);
        const q = bendPt(p, bend), w = lerp(limb.w0, limb.w1, u ** 0.8);
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, w * 0.8, w * 0.62, a + turn, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Dry-brush streaks: thin lines of paper along the stroke, broken.
    if (st.streaks > 0 && limb.w0 > 10) {
      for (let s = 0; s < 3; s++) {
        const off = (s - 1) * 0.28 - 0.08;
        const w = wobble(500 + li * 7 + s);
        const seg: Pt[] = [];
        const flush = () => {
          if (seg.length > 2) {
            ctx.fillStyle = rgba(SAKURA.paper, 0.32 * st.streaks);
            ribbon(ctx, seg.splice(0), (u) => 2.2 * Math.sin(Math.PI * u));
          } else seg.length = 0;
        };
        for (let i = 0; i < pts.length; i++) {
          const v = i / Math.max(1, pts.length - 1);
          if (w(v * k * 14) < 0.05) { flush(); continue; }
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          const ww = width(v);
          seg.push({ x: pts[i].x - Math.sin(ang) * ww * off, y: pts[i].y + Math.cos(ang) * ww * off });
        }
        flush();
      }
    }
    // The moon's light on the upper edge.
    if (glow && st.rim && st.rim > 0) {
      const rimPts = pts.map((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const ww = width(i / Math.max(1, pts.length - 1)) * 0.46;
        // The side that faces up.
        const sx = Math.sin(ang), sy = -Math.cos(ang), up = sy < 0 ? 1 : -1;
        return { x: p.x + sx * ww * up, y: p.y + sy * ww * up };
      });
      glow.fillStyle = rgba('#ff9cc4', 0.55 * st.rim);
      ribbon(glow, rimPts, (u) => 2.4 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)));
    }
  }
}

export interface Site {
  /** The limb and where on it. */
  limb: number;
  at: number;
  /** Offset from the limb, in its own frame (along, across). */
  off: Pt;
  pose: Omit<FlowerPose, 'x' | 'y' | 'open'>;
  /** When it begins to bud, and when it bursts open. */
  bud: number;
  burst: number;
}

/** Blossom sites: clusters along the limbs and at the twigs' tips, made once. */
export const SITES: Site[] = (() => {
  const out: Site[] = [];
  const r = rng(808);
  const total = Math.max(...LIMBS.map((l) => l.s0 + lengthOf(l.pts)));
  const add = (limb: number, at: number, size: number) => {
    const L = LIMBS[limb];
    const cluster = r.next() < 0.55 ? 2 : r.next() < 0.5 ? 3 : 1;
    for (let c = 0; c < cluster; c++) {
      const across = r.range(-1, 1) * (L.w0 * 0.5 + 18) + (c ? r.sign() * r.range(16, 34) : 0);
      const s = L.s0 + lengthOf(L.pts) * at;
      const bud = 1.15 + 1.25 * (s / total) + r.range(-0.08, 0.12);
      out.push({
        limb, at: clamp(at + (c ? r.range(-0.04, 0.04) : 0)), off: { x: c ? r.range(-22, 22) : 0, y: across },
        pose: { r: size * r.range(0.85, 1.15), rot: r.range(0, 6.28), tilt: r.range(0.55, 1), tiltAt: r.range(0, 3.14) },
        bud, burst: bud + r.range(0.45, 0.75),
      });
    }
  };
  // Along the main limb, the side limbs, and at every twig's tip.
  for (const at of [0.2, 0.32, 0.43, 0.52, 0.63, 0.72, 0.8, 0.88, 0.97]) add(0, at, 50);
  for (let li = 1; li < 7; li++) for (const at of [0.35, 0.62, 0.92]) add(li, at, li >= 5 ? 40 : 46);
  for (let li = 7; li < LIMBS.length; li++) add(li, 1, 42);
  return out;
})();

/** Where a site's flower is, with the wind's bend. */
export function siteAt(s: Site, bend: number): Pt {
  const { p, a } = along(LIMBS[s.limb].pts, s.at);
  const c = Math.cos(a), sn = Math.sin(a);
  return bendPt({ x: p.x + c * s.off.x - sn * s.off.y, y: p.y + sn * s.off.x + c * s.off.y }, bend);
}
