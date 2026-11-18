import { clamp, type Ctx, type Pt } from '../../core';

/**
 * Small helpers for Spirit Lanterns: the palette, colour mixing, closed paths from edge lists, curling spines. (Copied
 * from the phoenix's helpers, so the two pieces do not lean on each other.)
 */

export const C = {
  /** Rice paper and sumi ink. */
  paper: '#e9e6df',
  ink: '#101413',
  /** The night: deep teal-black. */
  night0: '#030b0b',
  night1: '#071918',
  night2: '#0d2a28',
  mist: '#2c5e58',
  /** Ghost-fire. */
  fireDeep: '#127a6c',
  fire: '#3fd8b8',
  firePale: '#b8fff0',
  /** The one warm accent. */
  amber: '#ffb347',
  amberPale: '#ffe2a6',
  amberDeep: '#d9781e',
  /** Bone ivory. */
  bone: '#efe6d2',
  boneShade: '#cbbfa5',
  /** The seal. */
  seal: '#0f4f4b',
};

/** Mixes two '#rrggbb' colours, k from 0 (a) to 1 (b); returns '#rrggbb'. */
export function mix(a: string, b: string, k: number) {
  k = clamp(k);
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((p >> s) & 255) * (1 - k) + ((q >> s) & 255) * k);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

/** A closed path through `left` then `right` reversed (a ribbon's outline). */
export function edgePath(ctx: Ctx, left: Pt[], right: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
}

/** A closed polygon path. */
export function polyPath(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Unit normals (rotated +90 degrees on screen) along a polyline. */
export function normals(pts: Pt[]): Pt[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  });
}

/** The two edges of a ribbon round `pts`: `wl(i)` on the normal's side, `wr(i)` on the other. */
export function ribbonEdges(pts: Pt[], wl: (i: number) => number, wr: (i: number) => number = wl) {
  const n = normals(pts);
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = wl(i), b = wr(i);
    left.push({ x: pts[i].x + n[i].x * a, y: pts[i].y + n[i].y * a });
    right.push({ x: pts[i].x - n[i].x * b, y: pts[i].y - n[i].y * b });
  }
  return { left, right };
}

/** A curling spine: from `b` at angle `a`, bending by `curl` radians in all (more towards the tip). */
export function curlSpine(b: Pt, a: number, len: number, curl: number, n = 12, wave?: (u: number) => number): Pt[] {
  const pts: Pt[] = [{ x: b.x, y: b.y }];
  let x = b.x, y = b.y;
  const step = len / n;
  for (let i = 1; i <= n; i++) {
    const u = (i - 0.5) / n;
    const ang = a + curl * u ** 1.5 + (wave ? wave(u) : 0);
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    pts.push({ x, y });
  }
  return pts;
}

/** A smooth closed path through `pts` (quadratic curves between the midpoints). */
export function smoothPath(ctx: Ctx, pts: Pt[]) {
  const n = pts.length;
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  ctx.beginPath();
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  ctx.closePath();
}

/** A smooth open path through `pts`. */
export function smoothOpen(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l.x, l.y);
}
