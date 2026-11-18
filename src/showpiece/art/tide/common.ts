import { H, W, clamp, lerp, ribbon, rng, rgba, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';

/**
 * Tidebreaker's palette and its paper: a warm cream sheet (a woodblock print's), Prussian blue ink, teal light, foam
 * white and a little gold. Plus the small ink pieces of the pool: the falling drop, the rings it spreads, the crown.
 */

export const CREAM = '#efe6d2';
export const PRUSSIAN = '#0d2747';
export const DEEP = '#071628';
export const NIGHT = '#06101f';
export const INDIGO = '#17426f';
export const BLUE = '#2a6aa0';
export const SKY = '#8fb8cf';
export const TEAL = '#2fb3a8';
export const TEAL_LIGHT = '#8ff0e0';
export const FOAM = '#f7f3e8';
export const GOLD = '#d9a443';
export const LINE = '#0a1b30';

let sheet: HTMLCanvasElement | null = null;

/** The cream sheet: warm in the middle, a little darker at the edges, a fine dot screen and a faint grain, made once. */
function creamSheet() {
  if (sheet) return sheet;
  sheet = document.createElement('canvas');
  sheet.width = W;
  sheet.height = H;
  const c = sheet.getContext('2d')!;
  c.fillStyle = CREAM;
  c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W * 0.5, H * 0.42, 120, W * 0.5, H * 0.5, W * 0.72);
  g.addColorStop(0, 'rgba(255,252,240,0.6)');
  g.addColorStop(1, 'rgba(200,180,145,0.38)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(150,128,100,0.15)';
  for (let y = 3; y < H; y += 7) for (let x = (y / 7) % 2 ? 3 : 6.5; x < W; x += 7) c.fillRect(x, y, 1.6, 1.6);
  // Fibres of the paper: short faint strokes.
  const r = rng(3301);
  c.strokeStyle = 'rgba(140,118,90,0.08)';
  c.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = r.range(0, W), y = r.range(0, H), a = r.range(0, Math.PI), l = r.range(6, 22);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  return sheet;
}

export function creamPaper(ctx: Ctx, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(creamSheet(), 0, 0, W, H);
  ctx.restore();
}

/** Applies a camera (a zoom `s` about the point `at`, and a shift) to both layers; undo with `uncam`. */
export function cam(ctxs: Ctx[], at: Pt, s: number, dx = 0, dy = 0) {
  for (const c of ctxs) {
    c.save();
    c.translate(at.x + dx, at.y + dy);
    c.scale(s, s);
    c.translate(-at.x, -at.y);
  }
}
export function uncam(ctxs: Ctx[]) {
  for (const c of ctxs) c.restore();
}

/** Ink specks in the piece's blues. */
export function blueSpecks(ctx: Ctx, seed: number, count: number, alpha: number, box = { x: 0, y: 0, w: W, h: H }) {
  if (alpha <= 0) return;
  const r = rng(seed);
  const cols = [PRUSSIAN, INDIGO, BLUE, '#9a9590'];
  for (let i = 0; i < count; i++) {
    const x = box.x + r.next() * box.w, y = box.y + r.next() * box.h;
    const s = r.next() < 0.85 ? r.range(1.5, 4.5) : r.range(6, 13);
    ctx.fillStyle = rgba(r.pick(cols), alpha * r.range(0.5, 1));
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A straight streak from a to b, pointed at both ends and `w` wide in the middle (a ribbon of two points would be zero
 * wide at both, and draw nothing).
 */
export function streak(ctx: Ctx, a: Pt, b: Pt, w: number) {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * w, ny = (dx / l) * w;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mx + nx, my + ny, b.x, b.y);
  ctx.quadraticCurveTo(mx - nx, my - ny, a.x, a.y);
  ctx.closePath();
  ctx.fill();
}

/** Halftone dots whose largest size closes the gaps between them (the shared one stops just short). */
export function dots(ctx: Ctx, color: string, cell: number, size: (x: number, y: number) => number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let y = -cell / 2; y < H + cell; y += cell) {
    const odd = Math.round(y / cell) % 2;
    for (let x = (odd ? 0 : -cell / 2); x < W + cell; x += cell) {
      const s = clamp(size(x, y));
      if (s < 0.04) continue;
      const r = cell * 0.72 * s;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

/** The pool's centre and its look (an ellipse seen from a low angle). */
export const POOL = { x: 960, y: 800, rx: 620, ry: 118 };

/**
 * The still pool on the paper: a pale blue wash that fades into halftone at its edges (no hard rim, as a woodblock's
 * gradation), a brush line under its near edge, long calm ripple lines and the moon's pale reflection (flat layer).
 */
export function pool(ctx: Ctx, k: number, t: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  const { x, y, rx, ry } = POOL;
  const d = (px: number, py: number) => Math.hypot((px - x) / rx, (py - y) / ry);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, -rx * 0.25, 0, 0, 0, rx * 0.92);
  g.addColorStop(0, 'rgba(120,165,195,0.75)');
  g.addColorStop(0.7, 'rgba(150,190,210,0.55)');
  g.addColorStop(1, 'rgba(170,200,212,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The wash breaks into dots towards its edge, darker at the far side.
  halftone(ctx, rgba(INDIGO, 0.55), 11, (px, py) => {
    const e = d(px, py);
    if (e > 1.12) return 0;
    const far = clamp(1 - (py - (y - ry)) / (ry * 1.4));
    return clamp(1 - Math.abs(e - 0.92) * 4) * 0.8 + far * 0.35 * (e < 1 ? 1 : 0);
  }, { x: x - rx * 1.15, y: y - ry * 1.15, w: rx * 2.3, h: ry * 2.3 });
  // The moon's reflection: a pale squashed disc with two broken lines across it.
  ctx.fillStyle = 'rgba(250,246,232,0.75)';
  ctx.beginPath();
  ctx.ellipse(x - 150, y - 22, 92, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Long ripple lines, thin at both ends.
  const r = rng(77);
  for (let i = 0; i < 8; i++) {
    const yy = y - ry * 0.62 + i * ry * 0.19 + Math.sin(t * 0.8 + i) * 2;
    const half = rx * Math.sqrt(Math.max(0, 1 - ((yy - y) / ry) ** 2)) * r.range(0.4, 0.8);
    const cx = x + r.range(-120, 120);
    const pts: Pt[] = [];
    for (let j = 0; j <= 24; j++) {
      const u = j / 24;
      pts.push({ x: cx - half + half * 2 * u, y: yy + Math.sin(u * 9 + i + t * 1.2) * 1.6 });
    }
    ctx.fillStyle = rgba(i % 3 === 0 ? PRUSSIAN : INDIGO, 0.8);
    ribbon(ctx, pts, (u) => 3.4 * Math.sin(Math.PI * u) ** 0.7);
  }
  // A brush line under the near edge, thick in the middle.
  const front: Pt[] = [];
  for (let j = 0; j <= 50; j++) {
    const a = lerp(0.12, Math.PI - 0.12, j / 50);
    front.push({ x: x + Math.cos(a) * rx * 0.98, y: y + Math.sin(a) * ry * 0.98 + 6 });
  }
  ctx.fillStyle = LINE;
  ribbon(ctx, front, (u) => 9 * Math.sin(Math.PI * u) ** 0.8);
  ctx.restore();
}

/** A drop of water: a teardrop with an ink outline, a Prussian body and a white highlight (flat layer). */
export function drop(ctx: Ctx, at: Pt, size: number, stretch = 1) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(size, size * stretch);
  ctx.beginPath();
  ctx.moveTo(0, -1.9);
  ctx.bezierCurveTo(0.35, -1.0, 1, -0.35, 1, 0.25);
  ctx.bezierCurveTo(1, 0.85, 0.55, 1.15, 0, 1.15);
  ctx.bezierCurveTo(-0.55, 1.15, -1, 0.85, -1, 0.25);
  ctx.bezierCurveTo(-1, -0.35, -0.35, -1.0, 0, -1.9);
  ctx.closePath();
  ctx.lineWidth = 0.22 / Math.max(0.6, stretch);
  ctx.strokeStyle = LINE;
  ctx.stroke();
  const g = ctx.createLinearGradient(-1, -1, 1, 1);
  g.addColorStop(0, BLUE);
  g.addColorStop(1, PRUSSIAN);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = FOAM;
  ctx.beginPath();
  ctx.ellipse(-0.42, 0.05, 0.16, 0.42, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Ink rings spreading on the pool from the drop: brush ellipses, thick at the front, broken at the back (flat layer).
 * `k` 0..1 is how far they have gone; `alpha` fades them.
 */
export function inkRings(ctx: Ctx, c: Pt, k: number, alpha: number, count = 5, reach = 1100, squash = 0.2) {
  if (k <= 0 || alpha <= 0) return;
  for (let i = 0; i < count; i++) {
    const kk = clamp(k * 1.25 - i * 0.12);
    if (kk <= 0) continue;
    const R = lerp(20, reach * (1 - i * 0.12), 1 - (1 - kk) ** 2.2);
    const a = alpha * (1 - kk ** 3);
    const w = lerp(16, 5, kk) * (1 - i * 0.1);
    const pts: Pt[] = [];
    for (let j = 0; j <= 60; j++) {
      const ang = -0.25 + (Math.PI + 0.5) * (j / 60);
      pts.push({ x: c.x + Math.cos(ang) * R, y: c.y + Math.sin(ang) * R * squash });
    }
    ctx.fillStyle = rgba(i % 2 ? INDIGO : PRUSSIAN, a);
    ribbon(ctx, pts, (u) => w * Math.sin(Math.PI * u) ** 0.5);
    // The back half, thinner and broken into dashes.
    for (let d = 0; d < 6; d++) {
      const a0 = Math.PI + 0.25 + d * 0.5, a1 = a0 + 0.32;
      const back: Pt[] = [];
      for (let j = 0; j <= 8; j++) {
        const ang = lerp(a0, a1, j / 8);
        back.push({ x: c.x + Math.cos(ang) * R, y: c.y + Math.sin(ang) * R * squash });
      }
      ctx.fillStyle = rgba(PRUSSIAN, a * 0.7);
      ribbon(ctx, back, (u) => w * 0.45 * Math.sin(Math.PI * u));
    }
  }
}

/**
 * The crown the drop throws up as it lands: a ring of drops leaping out and falling, and a rebound column in the middle
 * (flat layer). `age` is seconds since the landing.
 */
export function crown(ctx: Ctx, c: Pt, age: number, scale = 1) {
  if (age < 0 || age > 1.2) return;
  const r = rng(4242);
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2 + r.range(-0.1, 0.1);
    const sp = r.range(260, 520) * scale, up = r.range(500, 900) * scale, s0 = r.range(5, 12);
    const x = c.x + Math.cos(ang) * sp * age;
    const z = Math.sin(ang) * sp * age * 0.2;
    const y = c.y + z - (up * age - 0.5 * 2600 * scale * age * age);
    if (y > c.y + z + 4) continue;
    const s = s0 * scale * (1 - age * 0.5);
    drop(ctx, { x, y }, s, 1);
  }
  // The rebound column: up and back down.
  const h = Math.max(0, Math.sin(Math.PI * clamp((age - 0.08) / 0.55))) * 190 * scale;
  if (h > 2) {
    ctx.beginPath();
    ctx.moveTo(c.x - 16 * scale, c.y);
    ctx.quadraticCurveTo(c.x - 6 * scale, c.y - h * 0.6, c.x - 4 * scale, c.y - h);
    ctx.arc(c.x, c.y - h, 4 * scale, Math.PI, 0);
    ctx.quadraticCurveTo(c.x + 6 * scale, c.y - h * 0.6, c.x + 16 * scale, c.y);
    ctx.closePath();
    ctx.fillStyle = BLUE;
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 4;
    ctx.stroke();
    drop(ctx, { x: c.x, y: c.y - h - 26 * scale }, 9 * scale, 1);
  }
}
