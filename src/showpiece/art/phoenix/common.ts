import { clamp, type Ctx, type Pt } from '../../core';

/** Small helpers shared by the phoenix's art: colour mixing and closed paths from edge lists. */

/** Mixes two '#rrggbb' colours, k from 0 (a) to 1 (b); returns '#rrggbb'. */
export function mixHexHex(a: string, b: string, k: number) {
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

/** Points of a cubic Bezier. */
export function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    out.push({
      x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
      y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
    });
  }
  return out;
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
