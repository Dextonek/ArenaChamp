import { clamp, lerp, rgba, type Ctx, type Pt } from '../../core';

/**
 * Sakura Requiem's petals and flowers, cel-shaded: a petal is a rounded fan with the cherry's notch at its tip, filled in
 * three pinks with a hard shadow band and a dark plum outline. Every shape is built through a 2D matrix (rotation and
 * foreshortening) instead of ctx.scale, so the outline keeps its width however a petal is turned.
 */

export const SAKURA = {
  paper: '#efe9e1',
  ink: '#171014',
  /** Cherry pink, light to deep. */
  light: '#ffdce8',
  mid: '#f6a3c0',
  deep: '#d9577f',
  /** The plum shadow and outline. */
  plum: '#5a1a3e',
  outline: '#2b0c1f',
  /** White-hot pink, for light. */
  hot: '#fff1f7',
  glow: '#ff7fb2',
  /** The night: plum-black. */
  night: '#13070e',
} as const;

/** An affine matrix [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f. */
export type M = [number, number, number, number, number, number];

export const mat = (x: number, y: number, angle: number, sx = 1, sy = 1): M => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * sx, s * sx, -s * sy, c * sy, x, y];
};
/** `m` then `n` (n applied in m's frame). */
export const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
export const ap = (m: M, x: number, y: number): Pt => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

/**
 * A petal's outline in its own frame: its base at the origin, its tip along +x at `len`, half width `hw`, with the
 * notch at the tip. Drawn through `m`.
 */
export function petalPath(ctx: Ctx, m: M, len: number, hw: number, notch = 1) {
  const P = (x: number, y: number) => ap(m, x * len, y * hw);
  const n = 0.86 + 0.1 * (1 - notch);
  const a = P(0, 0);
  ctx.moveTo(a.x, a.y);
  bez(ctx, P(0.12, -0.78), P(0.52, -1.06), P(0.88, -0.66));
  quad(ctx, P(1.0, -0.48), P(0.985, -0.2));
  line(ctx, P(n, 0));
  line(ctx, P(0.985, 0.2));
  quad(ctx, P(1.0, 0.48), P(0.88, 0.66));
  bez(ctx, P(0.52, 1.06), P(0.12, 0.78), a);
  ctx.closePath();
}
const bez = (ctx: Ctx, a: Pt, b: Pt, c: Pt) => ctx.bezierCurveTo(a.x, a.y, b.x, b.y, c.x, c.y);
const quad = (ctx: Ctx, a: Pt, b: Pt) => ctx.quadraticCurveTo(a.x, a.y, b.x, b.y);
const line = (ctx: Ctx, a: Pt) => ctx.lineTo(a.x, a.y);

export interface PetalStyle {
  /** 0 to 1. */
  alpha?: number;
  /** Outline width in picture units. */
  line?: number;
  /** True: the petal is seen from behind (deeper, flatter colours). */
  back?: boolean;
  /** 0 to 1: how far the colours have turned to the night's (a petal lit by the moon). */
  dusk?: number;
  /** The deep pink at the base, as a part of the length. */
  base?: number;
}

/** A cel-shaded petal through `m` (flat layer). */
export function celPetal(ctx: Ctx, m: M, len: number, hw: number, st: PetalStyle = {}) {
  const alpha = st.alpha ?? 1;
  if (alpha <= 0.01) return;
  const back = !!st.back;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.beginPath();
  petalPath(ctx, m, len, hw);
  ctx.fillStyle = back ? SAKURA.mid : SAKURA.light;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // The hard shadow: one side of the petal, along a soft curve.
  ctx.beginPath();
  const s0 = ap(m, -0.1 * len, 0.1 * hw), s1 = ap(m, 0.45 * len, 0.3 * hw), s2 = ap(m, 1.1 * len, -0.05 * hw);
  const s3 = ap(m, 1.1 * len, 1.4 * hw), s4 = ap(m, -0.1 * len, 1.4 * hw);
  ctx.moveTo(s0.x, s0.y);
  ctx.quadraticCurveTo(s1.x, s1.y, s2.x, s2.y);
  ctx.lineTo(s3.x, s3.y);
  ctx.lineTo(s4.x, s4.y);
  ctx.closePath();
  ctx.fillStyle = back ? SAKURA.deep : SAKURA.mid;
  ctx.fill();
  // The deep pink at the base, where the petal meets the flower's heart.
  ctx.beginPath();
  const c = ap(m, 0, 0), rx = ap(m, (st.base ?? 0.34) * len, 0);
  ctx.arc(c.x, c.y, Math.hypot(rx.x - c.x, rx.y - c.y), 0, Math.PI * 2);
  ctx.fillStyle = back ? SAKURA.plum : SAKURA.deep;
  ctx.fill();
  // A highlight stroke near the tip on the lit side.
  if (!back) {
    ctx.beginPath();
    const h0 = ap(m, 0.5 * len, -0.5 * hw), h1 = ap(m, 0.72 * len, -0.62 * hw), h2 = ap(m, 0.84 * len, -0.4 * hw);
    ctx.moveTo(h0.x, h0.y);
    ctx.quadraticCurveTo(h1.x, h1.y, h2.x, h2.y);
    ctx.strokeStyle = rgba('#ffffff', 0.85);
    ctx.lineWidth = Math.max(1.2, hw * 0.12);
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // Fine veins from the base.
  ctx.strokeStyle = rgba(SAKURA.plum, 0.28);
  ctx.lineWidth = 1;
  for (const v of [-0.35, 0, 0.35]) {
    const a = ap(m, 0.3 * len, v * 0.4 * hw), b = ap(m, 0.7 * len, v * hw);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const dusk = st.dusk ?? 0;
  if (dusk > 0) {
    ctx.fillStyle = rgba('#3a1030', 0.75 * dusk);
    ctx.fillRect(-4000, -4000, 8000, 8000);
  }
  ctx.restore();
  ctx.beginPath();
  petalPath(ctx, m, len, hw);
  ctx.strokeStyle = SAKURA.outline;
  ctx.lineWidth = st.line ?? 2.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/**
 * A loose petal flying: at `p`, turned by `angle`, its width `flip` (-1 to 1) as it tumbles (below 0 its back shows).
 */
export function loosePetal(ctx: Ctx, p: Pt, angle: number, size: number, flip: number, st: PetalStyle = {}) {
  const f = Math.abs(flip) < 0.12 ? 0.12 * Math.sign(flip || 1) : flip;
  // The petal's frame: the base half a length behind the middle, so it turns about its middle.
  const m = mul(mat(p.x, p.y, angle, 1, f), mat(-size * 0.5, 0, 0));
  celPetal(ctx, m, size, size * 0.42, { base: 0.24, ...st, back: f < 0, line: st.line ?? Math.max(1.4, size * 0.05) });
}

/** A petal of light (glow layer): pink with a white-hot core. */
export function lightPetal(ctx: Ctx, p: Pt, angle: number, size: number, flip: number, alpha: number, hot = 1) {
  if (alpha <= 0.01) return;
  const f = Math.abs(flip) < 0.15 ? 0.15 : Math.abs(flip);
  const m = mul(mat(p.x, p.y, angle, 1, f), mat(-size * 0.5, 0, 0));
  ctx.beginPath();
  petalPath(ctx, m, size, size * 0.46);
  ctx.fillStyle = rgba(SAKURA.glow, 0.75 * alpha);
  ctx.fill();
  if (hot > 0) {
    const n = mul(m, mat(size * 0.16, 0, 0));
    ctx.beginPath();
    petalPath(ctx, n, size * 0.66, size * 0.24);
    ctx.fillStyle = rgba(SAKURA.hot, alpha * hot);
    ctx.fill();
  }
}

/** A dark petal with a rim of pink light, on the glow layer: it hides what is behind it. */
export function rimPetal(ctx: Ctx, p: Pt, angle: number, size: number, flip: number, alpha: number) {
  if (alpha <= 0.01) return;
  const f = Math.abs(flip) < 0.15 ? 0.15 : Math.abs(flip);
  const m = mul(mat(p.x, p.y, angle, 1, f), mat(-size * 0.5, 0, 0));
  ctx.beginPath();
  petalPath(ctx, mul(m, mat(-size * 0.04, 0, 0, 1.08, 1.18)), size, size * 0.42);
  ctx.fillStyle = rgba('#ffb3cf', 0.95 * alpha);
  ctx.fill();
  ctx.beginPath();
  petalPath(ctx, mul(m, mat(size * 0.02, -size * 0.03, 0)), size * 0.98, size * 0.36);
  ctx.fillStyle = rgba('#24091a', alpha);
  ctx.fill();
}

export interface FlowerPose {
  x: number;
  y: number;
  /** Radius of the open flower. */
  r: number;
  /** The flower's turn. */
  rot: number;
  /** The face's tilt: its shape is squashed by this along `tiltAt` (1 = facing us). */
  tilt: number;
  tiltAt: number;
  /** 0 nothing, to 0.35 a bud growing, to 0.55 the bud swelling, to 1 open. */
  open: number;
  /** Which of the five petals are still on (bit j for petal j); 31 = all. */
  petals?: number;
  dusk?: number;
}

/** The flower's frame: centred at its middle, turned, and foreshortened by its tilt. */
const flowerM = (f: FlowerPose): M => mul(mul(mat(f.x, f.y, f.tiltAt), mat(0, 0, 0, 1, f.tilt)), mat(0, 0, f.rot - f.tiltAt));

/** A cherry blossom, cel-shaded, as it opens (flat layer). */
export function flower(ctx: Ctx, f: FlowerPose) {
  if (f.open <= 0) return;
  const k = f.open;
  const budK = clamp(k / 0.35);
  const swell = clamp((k - 0.35) / 0.2);
  const bloom = clamp((k - 0.55) / 0.45);
  const fm = flowerM(f);
  const mask = f.petals ?? 31;
  if (bloom <= 0) {
    bud(ctx, f, budK, swell);
    return;
  }
  // The petals unfold from the bud's point outward, with a little overshoot.
  const ob = 1 + 2.4 * (bloom - 1) ** 3 + 1.4 * (bloom - 1) ** 2;
  const len = f.r * lerp(0.55, 1, ob), hw = f.r * lerp(0.26, 0.5, Math.min(1, ob));
  const order = [0, 1, 2, 3, 4].sort((a, b) => Math.sin(a * 1.2566 + f.rot) - Math.sin(b * 1.2566 + f.rot));
  for (const j of order) {
    if (!(mask & (1 << j))) continue;
    const a = lerp(-Math.PI / 2 + (j - 2) * 0.22, -Math.PI / 2 + j * ((Math.PI * 2) / 5), Math.min(1, ob));
    celPetal(ctx, mul(fm, mat(0, 0, a)), len, hw, { line: Math.max(1.8, f.r * 0.07), dusk: f.dusk });
  }
  // The bud's last tip, closing inside the petals.
  if (bloom < 0.3) bud(ctx, f, 1, 1, 1 - bloom / 0.3);
  heart(ctx, fm, f.r * Math.min(1, ob), f.dusk ?? 0);
}

/** The flower's heart: a deep pink star, stamens, pollen dots. */
function heart(ctx: Ctx, fm: M, r: number, dusk: number) {
  const c = ap(fm, 0, 0);
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = r * (i % 2 ? 0.1 : 0.22);
    const p = ap(fm, Math.cos(a) * rr, Math.sin(a) * rr);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = dusk > 0.5 ? SAKURA.plum : '#b8325f';
  ctx.fill();
  ctx.strokeStyle = SAKURA.plum;
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, l = r * (i % 2 ? 0.4 : 0.5);
    const p = ap(fm, Math.cos(a) * l, Math.sin(a) * l);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, l = r * (i % 2 ? 0.4 : 0.5);
    const p = ap(fm, Math.cos(a) * l, Math.sin(a) * l);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.4, r * 0.055), 0, Math.PI * 2);
    ctx.fillStyle = SAKURA.outline;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x - 0.5, p.y - 0.5, Math.max(0.8, r * 0.03), 0, Math.PI * 2);
    ctx.fillStyle = '#fff4e0';
    ctx.fill();
  }
  ctx.restore();
}

/** A bud: a deep pink drop in a plum calyx, growing over `k`, swelling and paling over `swell`. */
function bud(ctx: Ctx, f: FlowerPose, k: number, swell: number, alpha = 1) {
  if (k <= 0 || alpha <= 0) return;
  const s = f.r * (0.32 + 0.16 * swell) * (1 + 2.0 * (k - 1) ** 3 + 1.0 * (k - 1) ** 2);
  const m = mul(mat(f.x, f.y, f.rot - Math.PI / 2 + 0.4), mat(0, 0, 0));
  ctx.save();
  ctx.globalAlpha = alpha;
  // The drop.
  ctx.beginPath();
  const P = (x: number, y: number) => ap(m, x * s, y * s);
  const a = P(-0.2, 0);
  ctx.moveTo(a.x, a.y);
  bez(ctx, P(-0.2, -0.9), P(1.1, -0.75), P(1.45, 0));
  bez(ctx, P(1.1, 0.75), P(-0.2, 0.9), a);
  ctx.closePath();
  ctx.fillStyle = swell > 0.5 ? SAKURA.mid : SAKURA.deep;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  const b = P(0.6, 0.15);
  ctx.ellipse(b.x, b.y, s * 0.9, s * 0.45, f.rot, 0, Math.PI * 2);
  ctx.fillStyle = swell > 0.5 ? SAKURA.deep : SAKURA.plum;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = SAKURA.outline;
  ctx.lineWidth = Math.max(1.6, f.r * 0.06);
  ctx.stroke();
  // The calyx: two small dark leaves at the base.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const c0 = P(-0.35, 0), c1 = P(0.25, side * 0.85), c2 = P(0.7, side * 0.2);
    ctx.moveTo(c0.x, c0.y);
    ctx.quadraticCurveTo(c1.x, c1.y, c2.x, c2.y);
    const c3 = P(0.3, side * 0.1);
    ctx.quadraticCurveTo(c3.x, c3.y, c0.x, c0.y);
    ctx.fillStyle = SAKURA.plum;
    ctx.fill();
  }
  ctx.restore();
}

/** A small pop of light where a flower bursts open (glow): a ring and a four-point star, over `k` 0 to 1. */
export function bloomPop(ctx: Ctx, p: Pt, r: number, k: number) {
  if (k <= 0 || k >= 1) return;
  const a = 1 - k;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * (0.5 + 0.8 * Math.sqrt(k)), 0, Math.PI * 2);
  ctx.strokeStyle = rgba('#ff5f9e', 0.7 * a * a);
  ctx.lineWidth = 2.5 * a + 0.5;
  ctx.stroke();
  const L = r * (0.3 + 0.7 * a);
  ctx.fillStyle = rgba(SAKURA.hot, 0.9 * a);
  ctx.beginPath();
  ctx.moveTo(p.x - L, p.y);
  ctx.lineTo(p.x, p.y - L * 0.12);
  ctx.lineTo(p.x + L, p.y);
  ctx.lineTo(p.x, p.y + L * 0.12);
  ctx.closePath();
  ctx.moveTo(p.x, p.y - L);
  ctx.lineTo(p.x + L * 0.12, p.y);
  ctx.lineTo(p.x, p.y + L);
  ctx.lineTo(p.x - L * 0.12, p.y);
  ctx.closePath();
  ctx.fill();
}
