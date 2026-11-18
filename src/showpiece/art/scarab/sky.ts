import { H, W, clamp, lerp, ribbon, rng, rgba, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { GOLD, INK, LAPIS, NIGHT, NIGHT_LOW, SUN, TURQ } from './palette';

/**
 * The sky side of Sun Scarab: the sun disc the scarab rolls, the lapis night with its stars, the winged sun at the zenith
 * with its rays, and the pillar of gold light.
 */

// ---------------------------------------------------------------- the sun disc

/**
 * The sun disc (flat): a gold-orange disc in a gold ring, cel-shaded, with grooves round its rim that turn with `roll` so
 * it is seen rolling. `heat` 0 to 1 whitens its middle as it ignites.
 */
export function sunDisc(ctx: Ctx, x: number, y: number, r: number, roll: number, heat = 0, ow = 7) {
  if (r <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  const disc = new Path2D();
  disc.arc(0, 0, r, 0, Math.PI * 2);
  ctx.save();
  ctx.clip(disc);
  // The outer ring: gold with a shadow crescent at the bottom right.
  ctx.fillStyle = GOLD.hi;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.beginPath();
  ctx.arc(r * 0.05, r * 0.05, r, 0, Math.PI * 2);
  ctx.fillStyle = GOLD.base;
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-r * 2, -r * 2, r * 4, r * 4);
  ctx.arc(-r * 0.13, -r * 0.13, r, 0, Math.PI * 2);
  ctx.fillStyle = GOLD.sh;
  ctx.fill('evenodd');
  // The grooves round the ring, turning.
  ctx.strokeStyle = rgba(GOLD.deep, 0.9);
  ctx.lineWidth = Math.max(1.5, r * 0.022);
  for (let i = 0; i < 24; i++) {
    const a = roll + (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.lineTo(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97);
    ctx.stroke();
  }
  // The inner sun: orange-red with its own crescent, engraved rays, and a bright core.
  const ir = r * 0.74;
  ctx.beginPath();
  ctx.arc(0, 0, ir, 0, Math.PI * 2);
  ctx.fillStyle = mixHex(SUN.base, '#fff3c8', heat * 0.6);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, ir, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(-r * 2, -r * 2, r * 4, r * 4);
  ctx.arc(-ir * 0.16, -ir * 0.16, ir, 0, Math.PI * 2);
  ctx.fillStyle = mixHex(SUN.sh, '#ffb648', heat * 0.7);
  ctx.fill('evenodd');
  ctx.restore();
  ctx.strokeStyle = rgba('#8a3608', 0.7 * (1 - heat));
  ctx.lineWidth = Math.max(1.2, r * 0.016);
  for (let i = 0; i < 12; i++) {
    const a = roll + (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * ir * 0.5, Math.sin(a) * ir * 0.5);
    ctx.lineTo(Math.cos(a) * ir * 0.86, Math.sin(a) * ir * 0.86);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, ir * 0.46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-ir * 0.08, -ir * 0.08, ir * (0.3 + 0.5 * heat), 0, Math.PI * 2);
  ctx.fillStyle = rgba(SUN.core, clamp(0.35 + heat));
  ctx.fill();
  // The highlight arc at the top left.
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, Math.PI * 1.05, Math.PI * 1.45);
  ctx.strokeStyle = 'rgba(255,252,235,0.95)';
  ctx.lineWidth = r * 0.05;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
  // The lines: the ring between the parts, and the outline.
  ctx.beginPath();
  ctx.arc(0, 0, ir, 0, Math.PI * 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = ow * 0.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.lineWidth = ow;
  ctx.stroke();
  ctx.restore();
}

function mixHex(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, clamp(k)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** The sun's light (glow): a thin rim of light and a soft halo, at `k`. */
export function sunLight(ctx: Ctx, x: number, y: number, r: number, k: number, halo = 1) {
  if (k <= 0) return;
  const g = ctx.createRadialGradient(x, y, r * 0.98, x, y, r * (1.5 + 0.8 * halo));
  g.addColorStop(0, rgba('#ffc44a', 0.4 * k));
  g.addColorStop(0.35, rgba('#ff9a1e', 0.12 * k));
  g.addColorStop(1, 'rgba(255,140,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.arc(x, y, r * 0.98, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, Math.PI * 2);
  ctx.strokeStyle = rgba('#fff1c0', 0.9 * k);
  ctx.lineWidth = 5;
  ctx.stroke();
}

/** The sun's face burning (glow), over the flat disc, for the ignition. */
export function sunFire(ctx: Ctx, x: number, y: number, r: number, k: number) {
  if (k <= 0) return;
  const g = ctx.createRadialGradient(x - r * 0.1, y - r * 0.1, 0, x, y, r);
  g.addColorStop(0, rgba('#fffaf0', k));
  g.addColorStop(0.6, rgba('#ffd27a', 0.85 * k));
  g.addColorStop(1, rgba('#ff9a1e', 0.6 * k));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

// ---------------------------------------------------------------- the night

let nightSheet: HTMLCanvasElement | null = null;

/** The lapis night: deep blue-black, lighter lapis low down in a dot screen, fine stars. Made once. */
function nightCanvas() {
  if (nightSheet) return nightSheet;
  nightSheet = document.createElement('canvas');
  nightSheet.width = W;
  nightSheet.height = H;
  const c = nightSheet.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, NIGHT);
  g.addColorStop(0.65, '#0a1446');
  g.addColorStop(1, NIGHT_LOW);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  halftone(c, rgba('#2a4cb8', 0.36), 14, (x, y) => (y / H) ** 2.2 * 0.75 + 0.1 * Math.sin(x * 0.004), { x: 0, y: 0, w: W, h: H });
  return nightSheet;
}

export function night(ctx: Ctx, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(nightCanvas(), 0, 0, W, H);
  ctx.restore();
}

/**
 * The climb's arc: the camera stays on the scarab while the world turns round `c` (to its right) by `theta`, so the sky
 * wheels past and its path curves away. World points turn to the screen by -theta round c.
 */
export interface Arc { c: Pt; r: number; theta: number }

export function arcPoint(a: Arc, p: Pt): Pt {
  const cs = Math.cos(-a.theta), sn = Math.sin(-a.theta), x = p.x - a.c.x, y = p.y - a.c.y;
  return { x: a.c.x + x * cs - y * sn, y: a.c.y + x * sn + y * cs };
}

/**
 * The stars, wheeling with the arc: small dots on the flat layer and the bright ones as four-pointed glints on the glow
 * layer (not where `hide` says, in world units: under the papyrus).
 */
export function stars(flat: Ctx, glow: Ctx, t: number, k: number, a: Arc, hide?: (world: Pt) => boolean, dth = 0) {
  if (k <= 0) return;
  const r = rng(515);
  for (let i = 0; i < 1500; i++) {
    const rho = r.range(Math.max(0, a.r - 1100), a.r + 1300), al = r.range(Math.PI - 0.8, Math.PI + 2.2);
    const big = r.next() < 0.07;
    const sp = r.range(2, 5), s = big ? r.range(3, 4.5) : r.range(1.2, 2.6), ph = r.next() * 6.28;
    const sa = al - a.theta;
    const x = a.c.x + Math.cos(sa) * rho, y = a.c.y + Math.sin(sa) * rho;
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
    const tw = 0.6 + 0.4 * Math.sin(t * sp + ph);
    const col = rgba(big ? '#fff3d0' : '#b9c8ff', k * (big ? 0.95 : 0.5 + 0.35 * tw));
    // While the sky wheels fast, each star is drawn as the short arc it swept in one frame.
    const streak = rho * dth;
    if (streak > 3) {
      flat.beginPath();
      flat.arc(a.c.x, a.c.y, rho, sa, sa + dth);
      flat.strokeStyle = col;
      flat.lineWidth = s;
      flat.lineCap = 'round';
      flat.stroke();
    } else {
      flat.fillStyle = col;
      flat.beginPath();
      flat.arc(x, y, s / 2, 0, Math.PI * 2);
      flat.fill();
    }
    if (big && !(hide && hide({ x: a.c.x + Math.cos(al) * rho, y: a.c.y + Math.sin(al) * rho }))) {
      // Glints dim and shrink as they streak, so they do not jump from frame to frame.
      const calm = 1 / (1 + streak / 12);
      glint(glow, { x, y }, s * (3.5 + 2.5 * tw) * (0.4 + 0.6 * calm), k * (0.45 + 0.4 * tw) * calm, '#fff0c8');
    }
  }
}

/** A four-pointed glint (glow). */
export function glint(ctx: Ctx, c: Pt, size: number, k: number, col = '#ffffff') {
  if (k <= 0 || size <= 0) return;
  ctx.fillStyle = rgba(col, clamp(k));
  ctx.beginPath();
  const w = size * 0.13;
  ctx.moveTo(c.x, c.y - size);
  ctx.quadraticCurveTo(c.x + w, c.y - w, c.x + size, c.y);
  ctx.quadraticCurveTo(c.x + w, c.y + w, c.x, c.y + size);
  ctx.quadraticCurveTo(c.x - w, c.y + w, c.x - size, c.y);
  ctx.quadraticCurveTo(c.x - w, c.y - w, c.x, c.y - size);
  ctx.fill();
}

/**
 * The sun's path up the sky: the arc's circle, as a band of gold dots between two lapis rules (flat), starting where the
 * scarab rose (world angle pi). The dots the sun has passed are lit (glow).
 */
export function skyPath(flat: Ctx, glow: Ctx, a: Arc, k: number, hide?: (world: Pt) => boolean, dth = 0) {
  if (k <= 0) return;
  const a0 = Math.PI, a1 = Math.PI + 2.6;
  // The close dots only while the sky moves slowly (under a quarter of their spacing a frame); a solid line under them,
  // and sparse gold markers that can be followed at any speed.
  const dots = k * (1 - clamp((a.r * dth - 6) / 10));
  const lit = (al: number) => al < a0 + a.theta && !(hide && hide({ x: a.c.x + Math.cos(al) * a.r, y: a.c.y + Math.sin(al) * a.r }));
  flat.beginPath();
  flat.arc(a.c.x, a.c.y, a.r, a0 - a.theta, a1 - a.theta);
  flat.strokeStyle = rgba(GOLD.base, 0.9 * k * (1 - dots * 0.6));
  flat.lineWidth = 5;
  flat.stroke();
  const visible = (al: number) => {
    const sa = al - a.theta;
    const x = a.c.x + Math.cos(sa) * a.r, y = a.c.y + Math.sin(sa) * a.r;
    return x < -30 || x > W + 30 || y < -30 || y > H + 30 ? null : { x, y };
  };
  if (dots > 0) {
    for (let al = a0; al <= a1; al += 34 / a.r) {
      const q = visible(al);
      if (!q) continue;
      flat.beginPath();
      flat.arc(q.x, q.y, 7, 0, Math.PI * 2);
      flat.fillStyle = rgba(GOLD.base, 0.95 * dots);
      flat.fill();
      flat.lineWidth = 2;
      flat.strokeStyle = rgba(INK, 0.8 * dots);
      flat.stroke();
      if (lit(al)) {
        glow.beginPath();
        glow.arc(q.x, q.y, 5.5, 0, Math.PI * 2);
        glow.fillStyle = rgba('#ffe7a8', 0.8 * dots);
        glow.fill();
      }
    }
  }
  // Markers: gold diamonds every 420 units.
  for (let al = a0 + 210 / a.r; al <= a1; al += 420 / a.r) {
    const q = visible(al);
    if (!q) continue;
    const sa = al - a.theta, tx = -Math.sin(sa), ty = Math.cos(sa), nx = Math.cos(sa), ny = Math.sin(sa);
    flat.beginPath();
    flat.moveTo(q.x + tx * 22, q.y + ty * 22);
    flat.lineTo(q.x + nx * 14, q.y + ny * 14);
    flat.lineTo(q.x - tx * 22, q.y - ty * 22);
    flat.lineTo(q.x - nx * 14, q.y - ny * 14);
    flat.closePath();
    flat.fillStyle = rgba(GOLD.base, k);
    flat.fill();
    flat.lineWidth = 3;
    flat.strokeStyle = rgba(INK, 0.9 * k);
    flat.stroke();
    if (lit(al)) glint(glow, q, 26, 0.7 * k, '#ffe7a8');
  }
  // Two thin rules beside the dots, like the band of a sky goddess's body.
  for (const off of [-24, 24]) {
    flat.beginPath();
    flat.arc(a.c.x, a.c.y, a.r + off, a0 - a.theta, a1 - a.theta);
    flat.strokeStyle = rgba('#4a74e0', 0.9 * k);
    flat.lineWidth = 3.5;
    flat.stroke();
  }
}

/** Cuts a disc out of the glow layer (so light painted after stays off the sun's flat face). */
export function cutDisc(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the winged sun

/**
 * One great wing of the winged sun, the right one, root at (0, 0), reaching out along +x to `span` (flat). Egyptian
 * banded wing: a gold rim, two rows of small scale feathers in lapis and turquoise, a long row of turquoise, then a fringe
 * of long gold primaries with lapis shafts drooping out from the bottom. `k` 0 to 1 unfolds it (the fringe opens last).
 * 'ink' draws it as lines on `paper`, 'solid' as one shape in `paper`.
 */
export function wing(ctx: Ctx, span: number, h: number, k: number, mode: 'gold' | 'ink' | 'solid' = 'gold', paper = '#efe2c2', ow = 6) {
  if (k <= 0) return;
  const top0 = (u: number) => -h * (0.42 + 0.5 * u ** 2.2);
  const bot0 = (u: number) => h * (0.42 - 0.38 * u ** 1.6);
  // The tip narrows to a rounded point, curling up.
  const taper = (u: number) => (u > 0.8 ? 1 - 0.8 * ((u - 0.8) / 0.2) ** 2 : 1);
  const mid = (u: number) => (top0(u) + bot0(u)) / 2 - h * 0.12 * clamp((u - 0.8) / 0.2) ** 2;
  const top = (u: number) => mid(u) + (top0(u) - (top0(u) + bot0(u)) / 2) * taper(u);
  const bot = (u: number) => mid(u) + (bot0(u) - (top0(u) + bot0(u)) / 2) * taper(u);
  const at = (u: number, v: number): Pt => ({ x: u * span, y: lerp(top(u), bot(u), v) });
  const band = (v0: number, v1: number, u0 = 0, u1 = 1) => {
    const p = new Path2D();
    const n = 24;
    for (let i = 0; i <= n; i++) { const q = at(lerp(u0, u1, i / n), v0); i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y); }
    for (let i = n; i >= 0; i--) { const q = at(lerp(u0, u1, i / n), v1); p.lineTo(q.x, q.y); }
    p.closePath();
    return p;
  };
  const line = mode === 'solid' ? paper : INK;
  const fill = (p: Path2D, col: string, w = ow) => {
    ctx.fillStyle = mode === 'gold' ? col : paper;
    ctx.fill(p);
    if (mode !== 'solid' && w > 0) { ctx.strokeStyle = line; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke(p); }
  };
  // The fringe of long primaries first, under the wing's body, outer ones first.
  const fk = clamp((k - 0.25) / 0.75);
  const N = 15;
  for (let i = N - 1; i >= 0; i--) {
    const u = 0.04 + (i / (N - 1)) * 0.9;
    const base = at(u, 0.92);
    const ang = lerp(1.25, 0.22, u ** 0.9) * (0.35 + 0.65 * fk);
    const len = h * lerp(1.15, 0.75, u) * (0.4 + 0.6 * fk);
    const wdt = span / N * 1.5;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const tip = { x: base.x + dx * len, y: base.y + dy * len };
    const nx = -dy, ny = dx;
    const p = new Path2D();
    p.moveTo(base.x - nx * wdt * 0.5 - dx * 20, base.y - ny * wdt * 0.5 - dy * 20);
    p.lineTo(tip.x - nx * wdt * 0.42 - dx * wdt * 0.3, tip.y - ny * wdt * 0.42 - dy * wdt * 0.3);
    p.quadraticCurveTo(tip.x + dx * wdt * 0.25, tip.y + dy * wdt * 0.25, tip.x + nx * wdt * 0.42 - dx * wdt * 0.3, tip.y + ny * wdt * 0.42 - dy * wdt * 0.3);
    p.lineTo(base.x + nx * wdt * 0.5 - dx * 20, base.y + ny * wdt * 0.5 - dy * 20);
    p.closePath();
    fill(p, i % 2 ? GOLD.base : '#e39a1c');
    if (mode === 'gold') {
      // A shadow down one side and a lapis shaft.
      ctx.save();
      ctx.clip(p);
      ctx.fillStyle = GOLD.sh;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(tip.x + nx * wdt, tip.y + ny * wdt);
      ctx.lineTo(base.x + nx * wdt, base.y + ny * wdt);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = LAPIS.base;
      ribbon(ctx, [lerpPt(base, tip, 0.15), lerpPt(base, tip, 0.5), lerpPt(base, tip, 0.82)], (q) => wdt * 0.22 * Math.sin(Math.PI * q) ** 0.6);
    } else if (mode === 'ink') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = ow * 0.5;
      ctx.beginPath();
      ctx.moveTo(lerpPt(base, tip, 0.15).x, lerpPt(base, tip, 0.15).y);
      ctx.lineTo(lerpPt(base, tip, 0.8).x, lerpPt(base, tip, 0.8).y);
      ctx.stroke();
    }
  }
  // The wing's body: the bands.
  const body = band(0, 1);
  fill(body, GOLD.base);
  if (mode === 'solid') return;
  // Long turquoise feathers (the lower band), divided along the wing.
  fill(band(0.56, 1), mode === 'gold' ? TURQ.base : paper, ow * 0.6);
  // Two rows of scale feathers: rounded cells, lapis and turquoise in turn.
  for (const [v0, v1, n, off] of [[0.14, 0.35, 22, 0], [0.35, 0.56, 19, 0.5]] as const) {
    for (let j = 0; j < n; j++) {
      const u0 = (j + off * 0.5) / n, u1 = (j + 1 + off * 0.5) / n;
      if (u1 > 1.001) continue;
      const a = at(u0, v0), b = at(u1, v0), c = at(u1, v1), d = at(u0, v1);
      const p = new Path2D();
      p.moveTo(a.x, a.y);
      p.lineTo(b.x, b.y);
      p.lineTo(c.x, c.y - (c.y - b.y) * 0.25);
      p.quadraticCurveTo((c.x + d.x) / 2, (c.y + d.y) / 2 + (c.y - b.y) * 0.25, d.x, d.y - (d.y - a.y) * 0.25);
      p.closePath();
      const col = (j + (off ? 1 : 0)) % 2 ? LAPIS.base : TURQ.base;
      fill(p, mode === 'gold' ? col : (j % 2 ? INK : paper), ow * 0.5);
    }
  }
  // Long feathers in the lower band, as lines along the wing.
  ctx.strokeStyle = mode === 'gold' ? rgba(TURQ.sh, 1) : INK;
  ctx.lineWidth = ow * 0.45;
  for (const v of [0.7, 0.85]) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const q = at(0.02 + (i / 24) * 0.95, v); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.stroke();
  }
  for (let j = 1; j < 9; j++) {
    const u = j / 9, a = at(u, 0.56), b = at(u - 0.05, 1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (mode === 'gold') {
    // A highlight along the top rim and a shadow under it, cel style.
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = GOLD.hi;
    const rim = band(0, 0.06);
    ctx.fill(rim);
    ctx.fillStyle = rgba(GOLD.sh, 1);
    ctx.fill(band(0.1, 0.14));
    ctx.restore();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = ow;
  ctx.stroke(body);
}

const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

/** Both wings of the winged sun round `c` (flat), the disc's radius `r` setting where they join it. */
export function wingedSun(ctx: Ctx, c: Pt, r: number, span: number, h: number, k: number, mode: 'gold' | 'ink' | 'solid' = 'gold', paper?: string, ow = 6) {
  if (k <= 0) return;
  for (const m of [1, -1]) {
    ctx.save();
    ctx.translate(c.x, c.y + r * 0.05);
    ctx.scale(m, 1);
    ctx.translate(r * 0.55, 0);
    ctx.scale(0.15 + 0.85 * k, 0.6 + 0.4 * k);
    ctx.rotate(-0.04);
    wing(ctx, span, h, k, mode, paper, ow);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- rays and the pillar

/**
 * Rays sweeping the night round the sun: alternate wedges of lighter lapis (flat), turning, and thin gold rays (glow).
 */
export function rays(flat: Ctx, glow: Ctx, c: Pt, t: number, k: number, spin: number) {
  if (k <= 0) return;
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2, w = (Math.PI / n) * 0.55;
    flat.beginPath();
    flat.moveTo(c.x, c.y);
    flat.arc(c.x, c.y, 2400, a - w, a + w);
    flat.closePath();
    flat.fillStyle = rgba('#172c80', 0.42 * k);
    flat.fill();
  }
  const r = rng(77);
  for (let i = 0; i < 28; i++) {
    const a = spin * 1.6 + r.range(0, Math.PI * 2), len = r.range(500, 1300), w = r.range(2, 7);
    const fl = 0.55 + 0.45 * Math.sin(t * r.range(3, 7) + i);
    const pts: Pt[] = Array.from({ length: 8 }, (_, j) => ({ x: c.x + Math.cos(a) * (180 + (len * j) / 7), y: c.y + Math.sin(a) * (180 + (len * j) / 7) }));
    glow.fillStyle = rgba('#ffd27a', 0.42 * k * fl);
    ribbon(glow, pts, (u) => w * Math.sin(Math.PI * u) ** 0.5);
  }
}

/** The pillar of gold light falling at the viewer (glow): a vertical shaft round x, `w` wide, white at its core. */
export function pillar(ctx: Ctx, x: number, t: number, k: number, w: number) {
  if (k <= 0 || w <= 0) return;
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, 'rgba(255,170,40,0)');
  g.addColorStop(0.22, rgba('#ffb233', 0.35 * k));
  g.addColorStop(0.4, rgba('#ffe08a', 0.9 * k));
  g.addColorStop(0.5, rgba('#fffaf0', k));
  g.addColorStop(0.6, rgba('#ffe08a', 0.9 * k));
  g.addColorStop(0.78, rgba('#ffb233', 0.35 * k));
  g.addColorStop(1, 'rgba(255,170,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - w, -50, w * 2, H + 100);
  // Bright streaks running down inside it.
  const r = rng(Math.floor(t * 24) * 13 + 5);
  for (let i = 0; i < 16; i++) {
    const sx = x + r.range(-0.6, 0.6) * w, y0 = r.range(-200, H), l = r.range(200, 700);
    const pts: Pt[] = Array.from({ length: 6 }, (_, j) => ({ x: sx, y: y0 + (l * j) / 5 }));
    const sw = r.range(2, 6);
    ctx.fillStyle = rgba('#ffffff', 0.6 * k);
    ribbon(ctx, pts, (u) => sw * Math.sin(Math.PI * u));
  }
}
