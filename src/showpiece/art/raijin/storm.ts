import { clamp, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { OUT } from './drum';

/**
 * The storm: the indigo night, cloud banks drawn as flat cel shapes (one outline round the whole bank, a dark crescent
 * under every billow, halftone in the deep parts), their edges lit by the lightning, and the night spreading out from the
 * drum behind the shock of its strike.
 */

/** The night sky (flat layer): deep indigo at the top, a violet haze low down, a fine violet dot screen. */
export function nightSky(ctx: Ctx, haze = 1, c: Pt = { x: 960, y: 640 }) {
  const g = ctx.createLinearGradient(0, -100, 0, 1180);
  g.addColorStop(0, '#05051a');
  g.addColorStop(0.55, '#121042');
  g.addColorStop(1, '#251d62');
  ctx.fillStyle = g;
  ctx.fillRect(-120, -120, 2160, 1320);
  if (haze <= 0) return;
  const r = ctx.createRadialGradient(c.x, c.y, 50, c.x, c.y, 900);
  r.addColorStop(0, rgba('#4a36b0', 0.45 * haze));
  r.addColorStop(1, rgba('#4a36b0', 0));
  ctx.fillStyle = r;
  ctx.fillRect(-120, -120, 2160, 1320);
  halftone(ctx, rgba('#6c58d8', 0.28 * haze), 14, (x, y) => 0.75 - Math.hypot((x - c.x) / 1.4, y - c.y) / 900, { x: 0, y: 0, w: 1920, h: 1080 });
}

export interface Bank {
  seed: number;
  /** +1 hangs from the top (billows downward), -1 rises from the bottom (billows upward). */
  dir: 1 | -1;
  /** Mean billow radius. */
  bump: number;
  /** Outline, dark, mid, deep (halftone) tones. */
  tones: [string, string, string, string];
}

export const CEILING: Bank = { seed: 71, dir: 1, bump: 150, tones: [OUT, '#0c0a28', '#1e1a52', '#07061a'] };
export const CEILING_BACK: Bank = { seed: 33, dir: 1, bump: 190, tones: [OUT, '#18144a', '#2c2672', '#100d36'] };
export const FLOOR: Bank = { seed: 19, dir: -1, bump: 140, tones: [OUT, '#0e0b2e', '#221d5e', '#08061c'] };
export const FLOOR_BACK: Bank = { seed: 58, dir: -1, bump: 180, tones: [OUT, '#1b1650', '#30297c', '#130f3e'] };

interface Billow { x: number; y: number; r: number; sx: number }

/** The billows of a bank whose edge is at `y`, slid sideways by `drift`. */
function billows(b: Bank, y: number, drift: number): Billow[] {
  const r = rng(b.seed);
  const out: Billow[] = [];
  let x = -420 + r.range(0, 80);
  while (x < 2340) {
    // Mostly middling billows, now and then a great one; all wider than tall.
    const rad = b.bump * (r.next() < 0.28 ? r.range(1.35, 1.85) : r.range(0.55, 1.0));
    const sx = r.range(1.3, 1.75);
    // The edge rises and falls in long swells, as a real bank does.
    const swell = Math.sin(x * 0.004 + b.seed) * b.bump * 0.5;
    out.push({ x: x + drift, y: y + b.dir * (swell - rad * 0.15) + r.range(-0.12, 0.12) * b.bump, r: rad, sx });
    x += rad * sx * r.range(0.85, 1.15);
  }
  // A second, smaller row tucked under the edge, so the shapes stack.
  const out2: Billow[] = [];
  x = -380 + r.range(0, 120);
  while (x < 2340) {
    const rad = b.bump * r.range(0.4, 0.7);
    const swell = Math.sin(x * 0.004 + b.seed) * b.bump * 0.5;
    if (r.next() < 0.3) out2.push({ x: x + drift, y: y + b.dir * (swell + b.bump * 0.5) + r.range(-0.1, 0.1) * b.bump, r: rad, sx: r.range(1.3, 1.7) });
    x += rad * r.range(2.4, 3.6);
  }
  return [...out, ...out2];
}

function bankPath(ctx: Ctx, b: Bank, list: Billow[], y: number) {
  ctx.beginPath();
  const edge = y - b.dir * b.bump * 0.55;
  if (b.dir === 1) ctx.rect(-500, -600, 2920, edge + 600);
  else ctx.rect(-500, edge, 2920, 1800 - edge);
  for (const p of list) {
    ctx.moveTo(p.x + p.r * p.sx, p.y);
    ctx.ellipse(p.x, p.y, p.r * p.sx, p.r, 0, 0, Math.PI * 2);
  }
}

/** A cloud bank (flat layer): one ink outline round the whole, cel crescents under the billows, halftone in the deep. */
export function cloudBank(ctx: Ctx, b: Bank, y: number, drift: number, lit = 0) {
  const list = billows(b, y, drift);
  const [out, dark, mid, deep] = b.tones;
  ctx.save();
  ctx.lineJoin = 'round';
  bankPath(ctx, b, list, y);
  ctx.lineWidth = 11;
  ctx.strokeStyle = out;
  ctx.stroke();
  ctx.fillStyle = mid;
  ctx.fill();
  ctx.clip();
  // The deep of the bank, away from its edge: darker, then dots.
  const edgeY = y + b.dir * b.bump * 0.2;
  const g = ctx.createLinearGradient(0, edgeY - b.dir * b.bump * 3.5, 0, edgeY);
  g.addColorStop(0, deep);
  g.addColorStop(1, rgba(deep, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-500, -600, 2920, 2400);
  // Each billow: a dark crescent along its underside, the face of the billow in the mid tone; the light of the
  // lightning (`lit`) turns the faces paler.
  const face = lit > 0 ? mixHex(mid, '#7464d8', 0.4 * clamp(lit)) : mid;
  const rim = mixHex(mid, '#9a8cf0', 0.35 + 0.4 * clamp(lit));
  for (const p of list) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r * p.sx, p.r, 0, 0, Math.PI * 2);
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(out, 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(p.x - p.r * 0.12, p.y - p.r * 0.2, p.r * 0.9 * p.sx, p.r * 0.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = face;
    ctx.fill();
    // A thin light line just inside the billow's upper edge, as a cel highlight.
    ctx.beginPath();
    ctx.ellipse(p.x - p.r * 0.12, p.y - p.r * 0.2, p.r * 0.8 * p.sx, p.r * 0.8, 0, -Math.PI * 0.9, -Math.PI * 0.6);
    ctx.strokeStyle = rim;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // Halftone in the crescents and the deep.
  const cell = 12;
  halftone(ctx, rgba(deep, 0.85), cell, (px, py) => {
    const d = b.dir * (edgeY - py) / (b.bump * 2.2);
    return d * 1.1 - 0.15;
  }, { x: 0, y: b.dir === 1 ? -20 : edgeY - b.bump * 3, w: 1920, h: b.dir === 1 ? edgeY + 20 : b.bump * 3 + 200 });
  ctx.restore();
}

/** The lit edges of a bank's billows, where the lightning catches them (glow layer). */
export function cloudRims(ctx: Ctx, b: Bank, y: number, drift: number, k: number, color = '#a68cff') {
  if (k <= 0) return;
  const list = billows(b, y, drift);
  ctx.lineCap = 'round';
  for (const p of list) {
    const mid = b.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r * p.sx - 2, p.r - 2, 0, mid - 0.75, mid + 0.75);
    ctx.strokeStyle = rgba(color, 0.7 * k);
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

/** Mixes two '#rrggbb' colours. */
export function mixHex(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round((((pa >> s) & 255) * (1 - k)) + (((pb >> s) & 255) * k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const ragged = wobble(301), ragged2 = wobble(77);

/**
 * The night spreading out from `c` behind a shock front at radius `R` (flat layer): inside, `night(ctx)`; at the front,
 * dots of night that shrink outward over the paper.
 */
export function nightReveal(ctx: Ctx, c: Pt, R: number, night: (ctx: Ctx) => void) {
  if (R <= 0) return;
  const reach = (x: number, y: number) => {
    const a = Math.atan2(y - c.y, x - c.x);
    const edge = R * (1 + 0.06 * ragged(a * 3) + 0.03 * ragged2(a * 9));
    return clamp(1 - (Math.hypot(x - c.x, y - c.y) - edge) / 160);
  };
  ctx.save();
  ctx.beginPath();
  const cell = 22;
  for (let y = -cell / 2; y < 1080 + cell; y += cell) {
    const odd = Math.abs(Math.round(y / cell)) % 2;
    for (let x = (odd ? cell : cell / 2) - cell; x < 1920 + cell; x += cell) {
      const s = reach(x, y);
      if (s < 0.04) continue;
      const rr = cell * 0.75 * s;
      ctx.moveTo(x + rr, y);
      ctx.arc(x, y, rr, 0, Math.PI * 2);
    }
  }
  ctx.clip();
  night(ctx);
  ctx.restore();
}

/** Thin slanting rain (flat layer). */
export function rain(ctx: Ctx, t: number, k: number) {
  if (k <= 0) return;
  const r = rng(909);
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const sp = r.range(1500, 2300), x0 = r.range(-200, 2100), off = r.range(0, 1);
    const y = ((t * sp) / 1200 + off) % 1 * 1400 - 160;
    const x = x0 - y * 0.18;
    const len = r.range(40, 90);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.18, y + len);
    ctx.strokeStyle = rgba('#8a7ee0', 0.35 * k);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}
