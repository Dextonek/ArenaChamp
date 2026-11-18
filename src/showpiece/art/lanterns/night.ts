import { H, W, clamp, lerp, rgba, rng, wobble, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { C } from './common';

/**
 * The night of the procession: a teal-black sky with a fine dot screen, a pale moon low behind a gate, a stone path
 * running to it between the lanterns, bands of mist; and the way the night comes: dark dots that grow in from the edges
 * of the paper until they meet.
 */

/** Where the path's lines meet (the horizon), and how far down the ground comes at scale 1. */
export const HORIZON = 600;
export const GROUND = 480;
export const VX = 960;
/** The moon behind the gate. */
export const MOON = { x: 960, y: 452, r: 205 };

let sky: HTMLCanvasElement | null = null;

/** The night sky and ground (made once): a deep teal-black, lighter at the horizon, and a fine teal dot screen. */
function skySheet() {
  if (sky) return sky;
  sky = document.createElement('canvas');
  sky.width = W;
  sky.height = H;
  const c = sky.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.night0);
  g.addColorStop(0.45, C.night1);
  g.addColorStop(HORIZON / H, '#11312e');
  g.addColorStop(HORIZON / H + 0.002, '#081a19');
  g.addColorStop(1, '#040d0d');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // A soft lift of light round the moon.
  const m = c.createRadialGradient(MOON.x, MOON.y, MOON.r * 0.8, MOON.x, MOON.y, 900);
  m.addColorStop(0, 'rgba(70,140,128,0.32)');
  m.addColorStop(1, 'rgba(70,140,128,0)');
  c.fillStyle = m;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(80,170,155,0.11)';
  for (let y = 4; y < H; y += 9) for (let x = (y / 9) % 2 ? 4 : 8.5; x < W; x += 9) c.fillRect(x, y, 2, 2);
  return sky;
}

export function nightSky(ctx: Ctx) {
  ctx.drawImage(skySheet(), 0, 0, W, H);
}

/** The moon (flat): bone ivory, a halftone shade on its lower left, a thin ink rim. `k` fades it in. */
export function moon(ctx: Ctx, k: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.beginPath();
  ctx.arc(MOON.x, MOON.y, MOON.r, 0, Math.PI * 2);
  ctx.fillStyle = '#cfd6c8';
  ctx.fill();
  ctx.clip();
  halftone(ctx, 'rgba(70,110,100,0.5)', 14, (x, y) => {
    const d = Math.hypot(x - (MOON.x + 70), y - (MOON.y - 60)) / MOON.r;
    return (d - 0.75) * 1.4;
  }, { x: MOON.x - MOON.r, y: MOON.y - MOON.r, w: MOON.r * 2, h: MOON.r * 2 });
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.beginPath();
  ctx.arc(MOON.x, MOON.y, MOON.r, 0, Math.PI * 2);
  ctx.strokeStyle = rgba('#0a1d1b', 0.8);
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

/** The torii-like gate at the path's end (flat): two pillars, a tie beam, a curved top beam; solid ink. */
export function gate(ctx: Ctx, color = C.ink, alpha = 1, at: Pt = { x: VX, y: 676 }, s = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(at.x, at.y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  // Pillars, leaning in a touch.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 128, 0);
    ctx.lineTo(side * 104, -268);
    ctx.lineTo(side * 86, -268);
    ctx.lineTo(side * 106, 0);
    ctx.closePath();
    ctx.fill();
    // Its stone foot.
    ctx.fillRect(side * 117 - 16, -10, 32, 10);
  }
  // The tie beam (nuki) through both pillars, and the short post in the middle.
  ctx.fillRect(-170, -222, 340, 15);
  ctx.fillRect(-9, -258, 18, 40);
  // The lower top beam (shimaki) and the curved upper one (kasagi), its ends lifting.
  ctx.fillRect(-176, -266, 352, 12);
  ctx.beginPath();
  ctx.moveTo(-222, -306);
  ctx.quadraticCurveTo(-120, -280, 0, -284);
  ctx.quadraticCurveTo(120, -280, 222, -306);
  ctx.lineTo(214, -290);
  ctx.quadraticCurveTo(110, -264, 0, -266);
  ctx.quadraticCurveTo(-110, -264, -214, -290);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The scale of a thing at depth `z` (1 at the front). */
export const depth = (z: number) => 1 / z;
/** Where the ground is under a thing at scale `s`. */
export const groundY = (s: number) => HORIZON + GROUND * s;

/** The stone path (flat): slabs in perspective from the bottom of the frame to the gate, dark with ink joints. */
export function stonePath(ctx: Ctx, k = 1) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  const half = 300;
  const sNear = 1.15, sFar = 0.16;
  const edge = (s: number, side: number) => ({ x: VX + side * half * s, y: groundY(s) });
  // The path's whole face, a shade lighter than the ground, lit from the far end.
  const a = edge(sNear, -1), b = edge(sNear, 1), c = edge(sFar, 1), d = edge(sFar, -1);
  const g = ctx.createLinearGradient(0, d.y, 0, a.y);
  g.addColorStop(0, '#2a4f4a');
  g.addColorStop(0.25, '#173532');
  g.addColorStop(1, '#0a1c1b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
  // Joints across: slabs evenly spaced in depth.
  ctx.strokeStyle = 'rgba(2,8,8,0.85)';
  for (let z = 1 / sNear; z < 1 / sFar; z += 0.42) {
    const s = 1 / z;
    const l = edge(s, -1), r = edge(s, 1);
    ctx.lineWidth = Math.max(1, 5 * s);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();
    // The joints along, staggered from row to row.
    const row = Math.round(z / 0.42);
    const z2 = z + 0.42, s2 = 1 / z2;
    for (const f of row % 2 ? [-0.33, 0.33] : [0]) {
      ctx.beginPath();
      ctx.moveTo(VX + f * half * s, groundY(s));
      ctx.lineTo(VX + f * half * s2, groundY(s2));
      ctx.stroke();
    }
  }
  // The edges in ink.
  ctx.strokeStyle = '#020707';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(d.x, d.y);
  ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y);
  ctx.stroke();
  ctx.restore();
}

/** Mist (flat): long soft bands drifting sideways at the given heights. */
export function mist(ctx: Ctx, t: number, k: number, bands: { y: number; h: number; a: number; v: number }[]) {
  if (k <= 0) return;
  for (const [i, b] of bands.entries()) {
    const w = wobble(400 + i);
    const g = ctx.createLinearGradient(0, b.y - b.h, 0, b.y + b.h);
    const a = b.a * k;
    g.addColorStop(0, rgba(C.mist, 0));
    g.addColorStop(0.5, rgba(C.mist, a));
    g.addColorStop(1, rgba(C.mist, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    const off = t * b.v;
    ctx.moveTo(-50, b.y + b.h);
    for (let x = -50; x <= W + 50; x += 40) ctx.lineTo(x, b.y - b.h * (0.7 + 0.3 * w(x * 0.004 + off * 0.01)));
    ctx.lineTo(W + 50, b.y + b.h);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * The night coming in over the paper: dark dots growing in from the frame's edges (and last of all round `keep`, the
 * lantern), drawn as a clip into which `night` paints the night scene. `p` 0 to 1.
 */
export function nightFlood(ctx: Ctx, p: number, keep: Pt, night: (ctx: Ctx) => void) {
  if (p <= 0) return;
  if (p >= 1) { night(ctx); return; }
  const f1 = wobble(71), f2 = wobble(93);
  const reach = (x: number, y: number) => {
    const d = Math.hypot((x - keep.x) / 1.25, y - keep.y) / 900;
    const n = 0.16 * f1(x * 0.005 + y * 0.003) + 0.1 * f2(y * 0.008 - x * 0.004);
    return clamp((p * 1.7 - (1.1 - d) - n) * 3);
  };
  ctx.save();
  ctx.beginPath();
  const cell = 22;
  for (let y = cell / 2; y < H + cell; y += cell) {
    const odd = Math.round(y / cell) % 2;
    for (let x = odd ? cell : cell / 2; x < W + cell; x += cell) {
      const s = reach(x, y);
      if (s < 0.04) continue;
      const r = cell * 0.76 * s;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.clip();
  night(ctx);
  ctx.restore();
}

/** Small ink brush strokes of mist on the paper (flat): grey washes low in the frame. */
export function paperMist(ctx: Ctx, t: number, k: number) {
  if (k <= 0) return;
  const r = rng(515);
  for (let i = 0; i < 5; i++) {
    const y = r.range(760, 1000), x0 = r.range(-200, 1200), len = r.range(500, 900), h = r.range(10, 26);
    const drift = t * r.range(4, 10);
    const g = ctx.createLinearGradient(x0 + drift, 0, x0 + drift + len, 0);
    g.addColorStop(0, 'rgba(120,118,110,0)');
    g.addColorStop(0.3, rgba('#7c7a72', 0.16 * k));
    g.addColorStop(0.8, rgba('#7c7a72', 0.1 * k));
    g.addColorStop(1, 'rgba(120,118,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x0 + drift + len / 2, y, len / 2, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  void lerp;
}
