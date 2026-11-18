/**
 * The showpiece's small helpers: time windows, easing, a seeded random, and 2D path helpers.
 *
 * Every frame is a pure function of time (`drawFrame(t)` in sequence.ts): nothing is carried from one frame to the next,
 * so scrubbing, the comparison sheets and the frame-by-frame film all see the same picture for the same time.
 */

/** The picture is drawn in these units whatever the canvas's real size. */
export const W = 1920;
export const H = 1080;

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** 0 before `a`, 1 after `b`, linear between. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const smooth = (k: number) => k * k * (3 - 2 * k);
export const easeOut = (k: number) => 1 - (1 - k) ** 3;
export const easeIn = (k: number) => k * k * k;
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const easeOutBack = (k: number, s = 1.7) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2;
/** Up over [a, b], held, down over [c, d]. */
export const env = (t: number, a: number, b: number, c: number, d: number) => Math.min(seg(t, a, b), 1 - seg(t, c, d));

/** A seeded random (mulberry32): the same seed, the same numbers, on every frame. */
export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a: number, b: number) => a + (b - a) * next(),
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** A smooth 1D noise in [-1, 1] (sum of sines with seeded phases). */
export function wobble(seed: number) {
  const r = rng(seed);
  const parts = [0, 1, 2].map((i) => ({ f: (1.3 + i * 1.7) * r.range(0.8, 1.2), p: r.range(0, 6.283), a: 1 / (i + 1) }));
  const sum = parts.reduce((s, p) => s + p.a, 0);
  return (x: number) => parts.reduce((s, p) => s + p.a * Math.sin(x * p.f + p.p), 0) / sum;
}

export type Ctx = CanvasRenderingContext2D;
export type Pt = { x: number; y: number };

/** A colour with a given alpha: `rgba(r,g,b,a)` from '#rrggbb'. */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
}

/** A ribbon along a polyline whose width follows `width(k)` (k from 0 to 1 along it): filled as one shape. */
export function ribbon(ctx: Ctx, pts: Pt[], width: (k: number) => number) {
  if (pts.length < 2) return;
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const w = width(i / (pts.length - 1)) / 2;
    left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
    right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

/** Points along an arc of a circle (angles in radians). */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n = 48): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/** A jagged lightning bolt from a to b: midpoint displacement, `depth` levels. */
export function bolt(r: ReturnType<typeof rng>, a: Pt, b: Pt, rough: number, depth = 5): Pt[] {
  let pts = [a, b];
  let amp = rough;
  for (let d = 0; d < depth; d++) {
    const next: Pt[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      const nx = -(q.y - p.y), ny = q.x - p.x, l = Math.hypot(nx, ny) || 1;
      const o = r.range(-amp, amp);
      next.push({ x: mx + (nx / l) * o, y: my + (ny / l) * o }, q);
    }
    pts = next;
    amp *= 0.55;
  }
  return pts;
}

export function polyline(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
}

/** What a frame asks of the final screen pass. */
export interface ScreenParams {
  /** A white flash over everything, 0 to 1. */
  flash: number;
  /** Colour fringes at the edges, in pixels of a 1920 frame. */
  aberration: number;
  /** How much the glow layer blooms (multiplies the base strength). */
  bloom: number;
  /** Darkening of the corners, 0 to 1. */
  vignette: number;
  /** Turns every colour to its opposite for an impact frame, 0 to 1. */
  invert: number;
}

export const quietScreen = (): ScreenParams => ({ flash: 0, aberration: 0, bloom: 1, vignette: 0.25, invert: 0 });
