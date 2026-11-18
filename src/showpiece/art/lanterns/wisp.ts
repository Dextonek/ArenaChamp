import { clamp, rgba, rng, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { C, edgePath, ribbonEdges } from './common';

/**
 * Ghost-fire (hitodama): a round flame head with a long tapering tail, cel-shaded in three bands (deep teal, cyan,
 * pale) round a white core; the tail's edges lick. And the great spiral the ghost-fires gather into.
 */

/** A ghost-fire along `path` (head first, then back along its tail), `size` the head's radius (glow layer). */
export function hitodama(ctx: Ctx, path: Pt[], size: number, t: number, seed: number, k = 1) {
  if (k <= 0 || path.length < 2 || size <= 0) return;
  const n = path.length - 1;
  const lick = (i: number, band: number) => 1 + 0.22 * Math.sin(i * 1.25 - t * 15 + seed * 1.7 + band) * (i / n);
  const bands: [string, number, number][] = [[C.fireDeep, 1.55, 0.42], [C.fire, 1.0, 0.85], [C.firePale, 0.5, 0.95]];
  for (const [b, [color, wk, ak]] of bands.entries()) {
    const width = (i: number) => size * wk * (1 - i / n) ** 1.6 * lick(i, b);
    const e = ribbonEdges(path, width);
    ctx.fillStyle = rgba(color, ak * k);
    edgePath(ctx, e.left, e.right);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(path[0].x, path[0].y, size * wk * 1.02, 0, Math.PI * 2);
    ctx.fill();
  }
  // The white-hot heart.
  ctx.fillStyle = rgba('#ffffff', k);
  ctx.beginPath();
  ctx.arc(path[0].x, path[0].y, size * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The spiral's own light (glow): three arms of pale fire wound round `c`, turning, drawn on over `k`; flattened to
 * `squash` for the perspective.
 */
export function spiralArms(ctx: Ctx, c: Pt, t: number, k: number, R: number, squash = 0.62) {
  if (k <= 0) return;
  const rot = t * 2.6 + 1.2 * t * t * 0.1;
  for (let arm = 0; arm < 3; arm++) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 50; i++) {
      const u = i / 50;
      const r = R * (0.06 + 0.94 * u);
      const a = rot + (arm * Math.PI * 2) / 3 - u * 4.2;
      pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * squash });
    }
    for (const [color, w, al] of [[C.fireDeep, 26, 0.3], [C.fire, 9, 0.55], [C.firePale, 3, 0.8]] as const) {
      const e = ribbonEdges(pts, (i) => w * Math.sin(Math.PI * (i / 50) ** 0.7) * clamp(k * 1.5));
      ctx.fillStyle = rgba(color, al * k);
      edgePath(ctx, e.left, e.right);
      ctx.fill();
    }
  }
}

/** The spiral's light on the ground and sky in flat colour (flat): teal halftone dots round it. */
export function spiralDots(ctx: Ctx, c: Pt, R: number, k: number) {
  if (k <= 0) return;
  halftone(ctx, rgba('#2a9c8a', 0.55), 15, (x, y) => {
    const d = Math.hypot(x - c.x, (y - c.y) / 0.7) / R;
    return (1 - d) * 1.1 * k;
  }, { x: c.x - R, y: c.y - R * 0.7, w: R * 2, h: R * 1.4 });
}

/** The bright knot the spiral closes to, and its burst (glow). */
export function core(ctx: Ctx, c: Pt, r: number, k: number) {
  if (k <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
  g.addColorStop(0, rgba('#ffffff', k));
  g.addColorStop(0.35, rgba(C.firePale, 0.9 * k));
  g.addColorStop(0.6, rgba(C.fire, 0.5 * k));
  g.addColorStop(1, rgba(C.fireDeep, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A ring of ghost-fire opening out (glow), `k` 0 to 1 over its life. */
export function shockRing(ctx: Ctx, c: Pt, k: number, reach: number, squash = 0.8) {
  if (k <= 0 || k >= 1) return;
  const R = 80 + (reach - 80) * Math.sqrt(k);
  const a = (1 - k) ** 1.5;
  for (const [w, color, al] of [[50 * (1 - k) + 6, C.fireDeep, 0.4], [12 * (1 - k) + 2, C.firePale, 0.9]] as const) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R, R * squash, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(color, al * a);
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

/** Lines rushing out from a centre (glow): the fox's rush at the viewer. */
export function rushLines(ctx: Ctx, c: Pt, t: number, k: number) {
  if (k <= 0) return;
  const slot = Math.floor(t * 30);
  for (let i = 0; i < 80; i++) {
    const r = rng(i * 53 + slot * 977);
    if (r.next() > 0.6) continue;
    const a = r.range(0, Math.PI * 2), r0 = r.range(300, 620), r1 = r0 + r.range(400, 1100);
    const pts = Array.from({ length: 9 }, (_, j) => {
      const d = r0 + ((r1 - r0) * j) / 8;
      return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.8 };
    });
    ctx.fillStyle = rgba(r.next() < 0.6 ? '#e8fffa' : C.fire, 0.85 * k);
    const e = ribbonEdges(pts, (j) => r.range(1.5, 5) * Math.sin((Math.PI * j) / 8));
    edgePath(ctx, e.left, e.right);
    ctx.fill();
  }
}
