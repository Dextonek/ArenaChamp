import { clamp, bolt, polyline, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../core';
import { halftone } from './paper';

/**
 * The tear in the world that the slash opens: a long lens of burning edges across the frame, lightning crawling off its
 * rims, dark shards and embers in the air. Its edges go on the glow layer; its dark inside on the flat layer.
 */

export interface RiftShape {
  /** Centre of the lens. */
  cx: number;
  cy: number;
  /** The slash's direction, radians (negative rises to the right). */
  angle: number;
  /** Half its length along the slash. */
  half: number;
  /** Half its opening at the middle. */
  open: number;
}

export const RIFT: RiftShape = { cx: 960, cy: 478, angle: -0.30, half: 1100, open: 228 };

/** The slash runs from u = -REACH to +REACH (past both edges of the frame); the opening is the middle part, |u| < MOUTH. */
const REACH = 1.25;
const MOUTH = 0.95;

const jagTop = wobble(11), jagBot = wobble(23), fine = wobble(5);

/** Half the opening at u along the slash (zero outside the mouth, where the two rims run together as one beam). */
const profile = (s: RiftShape, u: number) => s.open * Math.max(0, 1 - ((u + 0.04) / MOUTH) ** 2) ** 1.15;

/** A point at u along the slash, `off` across it (positive is below the slash on screen). */
export function riftPoint(s: RiftShape, u: number, off: number): Pt {
  const ax = Math.cos(s.angle), ay = Math.sin(s.angle);
  return { x: s.cx + ax * u * s.half - ay * off, y: s.cy + ay * u * s.half + ax * off };
}

/**
 * The two rims as polylines (top, then bottom), with a ragged edge that crawls a little over time. `out` moves each line
 * away from the opening (negative: into it), so bands can be laid side by side across a rim.
 */
export function rims(s: RiftShape, t: number, n = 90, out = 0) {
  const top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = -REACH + (2 * REACH * i) / n, h = profile(s, u);
    const j1 = 1 + 0.035 * jagTop(u * 5 + t * 0.6) + 0.012 * fine(u * 30 + t * 2);
    const j2 = 1 + 0.035 * jagBot(u * 5 - t * 0.6) + 0.012 * fine(u * 27 - t * 2 + 3);
    const o = out * beamWidth(u);
    top.push(riftPoint(s, u, -(h * j1 + o)));
    bot.push(riftPoint(s, u, h * j2 + o));
  }
  return { top, bot };
}

/** How thick the burning band is at u: full at the mouth, thinner towards the frame's edges. */
const beamWidth = (u: number) => clamp(1.2 - 0.4 * Math.abs(u), 0.3, 1);

/** The lens as a path (for filling or clipping). */
export function lensPath(ctx: Ctx, s: RiftShape, t: number) {
  const { top, bot } = rims(s, t);
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (const p of top) ctx.lineTo(p.x, p.y);
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
  ctx.closePath();
}

/** The dark around the rift on the flat layer: black with a red haze and dark-red dots near the tear. */
export function riftBackdrop(ctx: Ctx, s: RiftShape, heat: number) {
  ctx.fillStyle = '#0b0607';
  ctx.fillRect(0, 0, 1920, 1080);
  if (heat <= 0) return;
  const cos = Math.cos(s.angle), sin = Math.sin(s.angle);
  // Distance from the slash's line, so the haze follows the tear.
  const near = (x: number, y: number) => {
    const dx = x - s.cx, dy = y - s.cy;
    const along = (dx * cos + dy * sin) / s.half, across = Math.abs(-dx * sin + dy * cos);
    const h = profile(s, along) + 50;
    return clamp(1 - (across - h) / 240) * clamp(1.6 - Math.abs(along));
  };
  halftone(ctx, rgba('#6e1409', 0.55 * heat), 13, (x, y) => near(x, y) * 0.8);
}

/** The lens's dark inside (flat layer). */
export function riftInside(ctx: Ctx, s: RiftShape, t: number, k: number) {
  if (k <= 0) return;
  lensPath(ctx, s, t);
  const g = ctx.createRadialGradient(s.cx, s.cy, 20, s.cx, s.cy, s.half * MOUTH);
  g.addColorStop(0, '#0e0303');
  g.addColorStop(0.6, '#1a0504');
  g.addColorStop(1, '#2e0906');
  ctx.fillStyle = g;
  ctx.globalAlpha = k;
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * The burning rims (glow layer), shaded like a cel: a dark red outer edge, orange, and a light band along the inner edge
 * where the tear is hottest. Towards both tips the two rims run together into a white beam. `heat` 0 to 1 scales the
 * brightness, `white` adds a white-hot core.
 */
export function riftRims(ctx: Ctx, s: RiftShape, t: number, heat: number, white = 0) {
  if (heat <= 0) return;
  // k runs 0 to 1 along a rim: back to u.
  const taper = (k: number) => beamWidth(-REACH + 2 * REACH * k);
  const bands: [number, number, string, number][] = [
    // offset outward, width, colour, alpha
    [18, 150, '#c82a0a', 0.14],
    [16, 100, '#7e1206', 0.95],
    [10, 80, '#e8481a', 0.97],
    [-2, 50, '#ff8a3e', 0.95],
    [-12, 26, '#ffc890', 0.95],
  ];
  for (const [out, w, c, a] of bands) {
    const { top, bot } = rims(s, t, 120, out);
    ctx.fillStyle = rgba(c, a * heat);
    ribbon(ctx, top, (k) => w * taper(k));
    ribbon(ctx, bot, (k) => w * taper(k));
  }
  const { top, bot } = rims(s, t, 120, -16);
  ctx.fillStyle = rgba('#fff2e0', clamp(0.8 * heat + white));
  ribbon(ctx, top, (k) => (8 + 30 * white) * taper(k));
  ribbon(ctx, bot, (k) => (8 + 30 * white) * taper(k));
  // Where the rims have run together, a pale hot core along the beam.
  for (const sign of [1, -1]) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) pts.push(riftPoint(s, sign * (MOUTH * 0.82 + ((REACH - MOUTH * 0.82) * i) / 40), 0));
    const w = (k: number) => Math.min(1, k * 4) * (1 - 0.55 * k);
    ctx.fillStyle = rgba('#ffd8c8', 0.7 * heat);
    ribbon(ctx, pts, (k) => 46 * w(k));
    ctx.fillStyle = rgba('#ffffff', 0.85 * heat);
    ribbon(ctx, pts, (k) => 14 * w(k));
  }
}

/** Lightning crawling off the rims, flickering on a fast clock (glow layer). */
export function riftLightning(ctx: Ctx, s: RiftShape, t: number, k: number, count = 22) {
  if (k <= 0) return;
  const slot = Math.floor(t * 14);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < count; i++) {
    const on = rng(i * 977 + slot * 131).next();
    if (on > 0.42 * k + 0.08) continue;
    const r = rng(i * 7919 + slot * 31);
    const u = r.next() < 0.7 ? r.range(-MOUTH, MOUTH) : r.range(-1.1, 1.1), side = r.sign();
    const h = profile(s, u) + 50 * beamWidth(u);
    const a = riftPoint(s, u, side * h);
    const len = r.range(70, 240);
    const ang = s.angle + side * Math.PI / 2 + r.range(-0.7, 0.7);
    const b = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
    const main = bolt(r, a, b, len * 0.35, 5);
    const draw = (pts: Pt[], w: number) => {
      polyline(ctx, pts);
      ctx.strokeStyle = rgba('#e8400e', 0.55 * k);
      ctx.lineWidth = w * 2;
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffa868', 0.75 * k);
      ctx.lineWidth = w * 0.7;
      ctx.stroke();
    };
    draw(main, 1.5);
    // A branch or two.
    for (let j = 0; j < 2; j++) {
      const from = main[Math.floor(r.range(0.3, 0.8) * main.length)];
      const ba = ang + r.range(-1, 1);
      const bl = len * r.range(0.25, 0.5);
      draw(bolt(r, from, { x: from.x + Math.cos(ba) * bl, y: from.y + Math.sin(ba) * bl }, bl * 0.4, 3), 1.2);
    }
  }
}

/** Dark glass shards drifting slowly and turning (drawn opaque on the glow layer, so they hide what is behind). */
export function shards(ctx: Ctx, t: number, k: number, seed: number, count: number, burst: { x: number; y: number; t0: number } | null = null) {
  if (k <= 0) return;
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    let x = r.range(-40, 1960), y = r.range(-40, 1120);
    const size = r.range(7, 26), spin = r.range(-2, 2), a0 = r.range(0, 6.28);
    const vx = r.range(-14, 14), vy = r.range(-22, 6);
    if (burst) {
      // Thrown out from a point, slowing.
      const dt = Math.max(0, t - burst.t0), ang = r.range(0, 6.28), sp = r.range(250, 1100);
      const d = sp * (1 - Math.exp(-dt * 2.4)) / 2.4;
      x = burst.x + Math.cos(ang) * d * 1.4;
      y = burst.y + Math.sin(ang) * d * 0.8;
    } else {
      x += vx * t;
      y += vy * t;
    }
    const a = a0 + spin * t;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.5, size * 0.42);
    ctx.lineTo(-size * 0.35, -size * 0.5);
    ctx.closePath();
    ctx.fillStyle = rgba('#1a1214', k);
    ctx.fill();
    ctx.strokeStyle = rgba('#8a6a60', 0.6 * k);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
}

/** Embers rising and fading (glow layer). */
export function embers(ctx: Ctx, t: number, k: number, seed: number, count: number) {
  if (k <= 0) return;
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const life = r.range(1.5, 3.5), off = r.range(0, life);
    const x0 = r.range(0, 1920), y0 = r.range(200, 1100);
    const age = ((t + off) % life) / life;
    const x = x0 + Math.sin(t * r.range(0.5, 1.5) + i) * 20, y = y0 - age * r.range(80, 220);
    const a = Math.sin(Math.PI * age) * k;
    ctx.fillStyle = rgba(r.next() < 0.7 ? '#ff7a30' : '#ffd8a0', a);
    ctx.beginPath();
    ctx.arc(x, y, r.range(1.5, 4.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The tear's inside filled white-hot as it bursts open (glow layer), `k` 0 to 1. */
export function riftWhiteHot(ctx: Ctx, s: RiftShape, t: number, k: number) {
  if (k <= 0) return;
  lensPath(ctx, s, t);
  const g = ctx.createLinearGradient(...xy(riftPoint(s, -0.8, 0)), ...xy(riftPoint(s, 0.8, 0)));
  g.addColorStop(0, rgba('#ffe8d8', k));
  g.addColorStop(0.5, rgba('#ffffff', k));
  g.addColorStop(1, rgba('#ffd0c0', k));
  ctx.fillStyle = g;
  ctx.fill();
}

const xy = (p: Pt): [number, number] => [p.x, p.y];

/** Gold spikes thrown out from the rims as the tear bursts (glow layer), growing over `k` and fading by `fade`. */
export function riftSpikes(ctx: Ctx, s: RiftShape, t: number, k: number, fade: number) {
  if (k <= 0 || fade >= 1) return;
  const r = rng(616);
  const a = 1 - clamp(fade);
  for (let i = 0; i < 34; i++) {
    const u = r.range(-0.75, 0.75), side = r.sign();
    const h = profile(s, u) * Math.min(1, k * 1.5);
    const base = riftPoint(s, u, side * h);
    const len = r.range(120, 460) * clamp(k * 1.3), w = r.range(8, 20);
    const ang = s.angle + side * Math.PI / 2 + r.range(-0.25, 0.25);
    const tip = { x: base.x + Math.cos(ang) * len, y: base.y + Math.sin(ang) * len };
    const nx = -Math.sin(ang) * w / 2, ny = Math.cos(ang) * w / 2;
    ctx.beginPath();
    ctx.moveTo(base.x + nx, base.y + ny);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(base.x - nx, base.y - ny);
    ctx.closePath();
    ctx.fillStyle = rgba(r.next() < 0.5 ? '#ffc070' : '#e8803a', 0.85 * a);
    ctx.fill();
  }
  void t;
}
