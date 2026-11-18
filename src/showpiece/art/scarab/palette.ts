import type { Pt } from '../../core';

/**
 * Sun Scarab's colours and a few shape helpers shared by its art: papyrus and brown-black ink, desert ochre and
 * sandstone, gold, deep lapis blue and a turquoise accent.
 */

export const PAPYRUS = '#e8d8b4';
export const PAPYRUS_DARK = '#cdb88c';
export const INK = '#1d1209';
export const OCHRE = '#c98a3a';
export const SAND = '#e0b56c';
export const SAND_SHADE = '#b98249';
export const SANDSTONE = '#a8693a';

export const GOLD = { hi: '#ffe7a0', base: '#f0b230', sh: '#b46a12', deep: '#6e3a08' };
export const LAPIS = { hi: '#5a83e0', base: '#2446a6', sh: '#13266e', deep: '#0a1440' };
export const TURQ = { hi: '#a6f4e2', base: '#2fbfae', sh: '#17807a' };

export const NIGHT = '#060a22';
export const NIGHT_LOW = '#0f1d5c';
export const SUN = { hi: '#fff0b8', base: '#f6a21e', sh: '#c4570e', core: '#fff8e2' };

/** A closed smooth path through points (Catmull-Rom as cubic Béziers). */
export function smoothClosed(p: Path2D, pts: Pt[]) {
  const n = pts.length;
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    p.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
  }
  p.closePath();
}

/** An open smooth curve through points, continuing the current path. */
export function smoothOpen(p: Path2D | CanvasRenderingContext2D, pts: Pt[], move = true) {
  const n = pts.length;
  if (move) p.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    p.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
  }
}

/** A right half (top centre to bottom centre) mirrored into a whole symmetric outline. */
export function mirrored(right: Pt[]): Pt[] {
  const left = right.slice(1, -1).reverse().map((p) => ({ x: -p.x, y: p.y }));
  return [...right, ...left];
}

export const P = (x: number, y: number): Pt => ({ x, y });
