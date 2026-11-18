import { rng, type Ctx, type Pt } from '../core';
import { SERIF } from './paper';

/**
 * The katana, drawn flat with a dark outline like the clip: a cream-and-black wrapped hilt with gold fittings, a gold
 * guard, a black lacquered scabbard with gold cracks, a red-ribbed end and a gold cap, a red cord, two paper seals.
 *
 * Its own frame: x runs along the sword from the guard (x = 0) towards the tip, y is across it. The hilt is at negative x.
 * The whole sword is about 1000 units long at scale 1.
 */

const OUT = '#1b1012';
const GOLD = ['#7a4f12', '#d9a43c', '#ffe7a0', '#b9842a'];
export const HILT = 250;
export const SAYA = 740;
export const BLADE = 700;
const CURVE = 0.00005;
/** How thick the sword is across, against its length (the clip's sword is stout). */
const TH = 1.32;

/** The centre line bends a little, as a katana does. */
const cy = (x: number) => -CURVE * x * x;
const slope = (x: number) => -2 * CURVE * x;

/** A band along the centre line from x0 to x1, its width from w0 to w1 (or a function of x). */
function bandPath(ctx: Ctx, x0: number, x1: number, w: (x: number) => number, step = 12) {
  const top: Pt[] = [], bot: Pt[] = [];
  const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / step));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = cy(x), s = slope(x), l = Math.hypot(1, s);
    const nx = -s / l, ny = 1 / l, h = (w(x) * TH) / 2;
    top.push({ x: x - nx * h, y: y - ny * h });
    bot.push({ x: x + nx * h, y: y + ny * h });
  }
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (const p of top) ctx.lineTo(p.x, p.y);
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
  ctx.closePath();
}

/** A gradient across the sword's width (top to bottom of a band of width w at x). */
function across(ctx: Ctx, x: number, w: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x, cy(x) - (w * TH) / 2, x, cy(x) + (w * TH) / 2);
  for (const [k, c] of stops) g.addColorStop(k, c);
  return g;
}

const goldAcross = (ctx: Ctx, x: number, w: number) =>
  across(ctx, x, w, [[0, GOLD[0]], [0.25, GOLD[2]], [0.5, GOLD[1]], [1, GOLD[0]]]);

function fillOutline(ctx: Ctx, fill: string | CanvasGradient, line = 2.4) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = line;
  ctx.strokeStyle = OUT;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Where on screen a point of the sword's frame lands, and the world's "down" in the sword's frame. */
export interface Pose {
  x: number;
  y: number;
  /** Radians; 0 points the blade to the right. */
  angle: number;
  scale: number;
}

function enter(ctx: Ctx, p: Pose) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.scale(p.scale, p.scale);
}

/** The world's down (screen +y) in the sword's frame. */
const down = (p: Pose) => ({ x: Math.sin(p.angle), y: Math.cos(p.angle) });

/** The hilt, from the pommel (x = -HILT) to the guard (x = 0), and the guard itself. */
function hilt(ctx: Ctx, glint: number) {
  const w = (x: number) => 34 + (x + HILT) * 0.012;
  // Ray skin under the wrap.
  bandPath(ctx, -HILT + 16, -14, w);
  fillOutline(ctx, across(ctx, -120, 36, [[0, '#2a1416'], [0.5, '#4a1c20'], [1, '#1e0e10']]));
  // The wrap: cream cords crossing, a red diamond showing between each pair.
  const n = 7, x0 = -HILT + 22, x1 = -18, step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * step, b = a + step, m = (a + b) / 2, h = (w(m) * TH) / 2, y = cy(m);
    ctx.beginPath();
    ctx.moveTo(m, y - h * 0.5); ctx.lineTo(m + step * 0.22, y); ctx.lineTo(m, y + h * 0.5); ctx.lineTo(m - step * 0.22, y); ctx.closePath();
    ctx.fillStyle = '#9b1b22';
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(a + 2, y - s * h * 0.95);
      ctx.lineTo(a + step * 0.42, y - s * h * 0.95);
      ctx.lineTo(b - 2, y + s * h * 0.95);
      ctx.lineTo(b - step * 0.42, y + s * h * 0.95);
      ctx.closePath();
      fillOutline(ctx, across(ctx, m, h * 2, [[0, '#f6efdc'], [0.5, '#e5d9bb'], [1, '#bfae8a']]), 1.6);
    }
  }
  // The gold ornament under the wrap's middle.
  ctx.beginPath();
  ctx.ellipse(-HILT * 0.48, cy(-HILT * 0.48), 26, 7 * TH, 0, 0, Math.PI * 2);
  fillOutline(ctx, goldAcross(ctx, -HILT * 0.48, 14), 1.6);
  // Pommel cap and the collar at the guard.
  bandPath(ctx, -HILT, -HILT + 18, () => 38);
  fillOutline(ctx, goldAcross(ctx, -HILT, 38));
  bandPath(ctx, -16, 0, () => 38);
  fillOutline(ctx, goldAcross(ctx, -8, 38));
  // The guard: a gold oval seen nearly edge on.
  ctx.beginPath();
  ctx.ellipse(4, cy(4), 15, 40 * TH, 0, 0, Math.PI * 2);
  fillOutline(ctx, (() => {
    const g = ctx.createLinearGradient(-6, -40, 14, 40);
    g.addColorStop(0, GOLD[2]); g.addColorStop(0.45, GOLD[1]); g.addColorStop(1, GOLD[0]);
    return g;
  })(), 2.6);
  ctx.beginPath();
  ctx.ellipse(4, cy(4), 7, 30 * TH, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(90,50,10,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (glint > 0) sheen(ctx, -HILT, 0, glint);
}

/** The blade from the guard out to `len` (the part beyond the scabbard's mouth is what shows). */
function blade(ctx: Ctx, len: number) {
  const w = (x: number) => (x > len - 60 ? 26 * Math.max(0.05, (len - x) / 60) ** 0.7 : 28 - x * 0.006);
  bandPath(ctx, 6, len, w, 10);
  fillOutline(ctx, across(ctx, len / 2, 28, [[0, '#7d8790'], [0.35, '#c9d2d9'], [0.55, '#f4f8fb'], [1, '#e3eaef']]), 2);
  // The temper line, wavy, along the edge side.
  ctx.beginPath();
  for (let x = 30; x < len - 50; x += 8) {
    const y = cy(x) + 5 + Math.sin(x * 0.09) * 2.2;
    if (x === 30) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // The collar at the blade's root.
  bandPath(ctx, 6, 30, () => 32);
  fillOutline(ctx, goldAcross(ctx, 18, 32), 1.8);
}

/** The scabbard from its mouth (x = 0) to its cap (x = SAYA). */
function saya(ctx: Ctx, glint: number, seed: number) {
  const w = (x: number) => 40 - x * 0.007;
  bandPath(ctx, 0, SAYA - 22, w);
  fillOutline(ctx, across(ctx, 300, 40, [[0, '#050304'], [0.28, '#3a3236'], [0.42, '#161013'], [1, '#050304']]));
  // A twisted rib in the lacquer.
  ctx.save();
  bandPath(ctx, 40, 530, w);
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,110,120,0.22)';
  ctx.lineWidth = 3;
  for (let x = 40; x < 560; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, cy(x) - 22 * TH);
    ctx.lineTo(x + 18, cy(x + 18) + 22 * TH);
    ctx.stroke();
  }
  ctx.restore();
  // Gold cracks.
  const r = rng(seed);
  ctx.strokeStyle = '#e2ae45';
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    let x = r.range(60, 470), y = cy(x) + r.range(-12, 12) * TH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = r.range(1.4, 2.4);
    for (let j = 0; j < 4; j++) {
      x += r.range(14, 40);
      y = Math.max(cy(x) - 16 * TH, Math.min(cy(x) + 16 * TH, y + r.range(-10, 10)));
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // The mouth's gold ring, the cord's knob and the band before the red end.
  bandPath(ctx, 0, 14, () => 44);
  fillOutline(ctx, goldAcross(ctx, 7, 44));
  bandPath(ctx, 150, 168, () => 43);
  fillOutline(ctx, goldAcross(ctx, 159, 43));
  ctx.beginPath();
  ctx.ellipse(159, cy(159) + 26 * TH, 9, 9, 0, 0, Math.PI * 2);
  fillOutline(ctx, goldAcross(ctx, 159, 18), 1.6);
  // The red end, ribbed.
  bandPath(ctx, 545, SAYA - 22, w);
  fillOutline(ctx, across(ctx, 620, 38, [[0, '#4a0a0e'], [0.3, '#d23a3a'], [0.5, '#a3161c'], [1, '#3c0609']]));
  ctx.save();
  bandPath(ctx, 545, SAYA - 22, w);
  ctx.clip();
  ctx.strokeStyle = 'rgba(40,0,4,0.55)';
  ctx.lineWidth = 2;
  for (let x = 552; x < SAYA - 22; x += 9) {
    ctx.beginPath(); ctx.moveTo(x, cy(x) - 24 * TH); ctx.lineTo(x + 3, cy(x) + 24 * TH); ctx.stroke();
  }
  ctx.restore();
  bandPath(ctx, 530, 548, () => 42);
  fillOutline(ctx, goldAcross(ctx, 539, 42));
  // The gold cap, rounded.
  ctx.beginPath();
  const x = SAYA - 24, y = cy(x);
  ctx.moveTo(x, y - 18 * TH);
  ctx.lineTo(SAYA - 8, y - 17 * TH);
  ctx.quadraticCurveTo(SAYA + 8, y, SAYA - 8, y + 17 * TH);
  ctx.lineTo(x, y + 18 * TH);
  ctx.closePath();
  fillOutline(ctx, goldAcross(ctx, x, 36));
  if (glint > 0) sheen(ctx, 0, SAYA, glint);
}

/** A soft white light that slides along the sword (`glint` 0 to 1 is where it is). */
function sheen(ctx: Ctx, x0: number, x1: number, glint: number) {
  const x = x0 + (x1 - x0) * glint;
  const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  bandPath(ctx, Math.max(x0, x - 70), Math.min(x1, x + 70), () => 14);
  ctx.fillStyle = g;
  ctx.fill();
}

/** The red cord from the knob, hanging (with gravity in screen space) and swinging, with a tassel. */
function cord(ctx: Ctx, p: Pose, sway: number) {
  const d = down(p);
  const ax = 159, ay = cy(159) + 32 * TH;
  const len = 140;
  const side = { x: -d.y, y: d.x };
  const end = { x: ax + d.x * len + side.x * sway * 40, y: ay + d.y * len + side.y * sway * 40 };
  const mid = { x: ax + d.x * len * 0.5 + side.x * (18 + sway * 30), y: ay + d.y * len * 0.5 + side.y * (18 + sway * 30) };
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#d42a2a';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Tassel.
  ctx.beginPath();
  ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = GOLD[1];
  ctx.fill();
  ctx.strokeStyle = '#ff4a3a';
  ctx.lineWidth = 1.6;
  for (let i = -3; i <= 3; i++) {
    const a = Math.atan2(d.y, d.x) + i * 0.09;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x + Math.cos(a) * 26, end.y + Math.sin(a) * 26);
    ctx.stroke();
  }
}

/** Two paper seals hanging from the scabbard near its mouth, with red marks. */
function seals(ctx: Ctx, p: Pose, sway: number) {
  const d = down(p);
  const side = { x: -d.y, y: d.x };
  const marks = [['封', '斷'], ['封']];
  [60, 104].forEach((ax, i) => {
    const a = { x: ax, y: cy(ax) + 12 * TH };
    const len = 150 + i * 14;
    const sw = sway * (i ? -12 : 16);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(Math.atan2(d.y, d.x) - Math.PI / 2 + sw * 0.004);
    // Now +y is down the strip.
    ctx.beginPath();
    ctx.rect(-15, 0, 30, len);
    ctx.fillStyle = '#f4eedf';
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,20,0.7)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#d5262b';
    ctx.font = `900 19px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    marks[i].forEach((m, j) => ctx.fillText(m, 0, 40 + j * 56));
    ctx.restore();
    void side;
  });
}

export interface KatanaLook {
  /** How far the sword is drawn out of the scabbard, along its length (0 = sheathed). */
  drawn?: number;
  /** A light sliding along the scabbard, 0 to 1 (negative = none). */
  glint?: number;
  /** How the cord and seals swing, -1 to 1. */
  sway?: number;
  seed?: number;
}

/** The sheathed sword (or partly drawn: `drawn` units of blade between the guard and the scabbard's mouth). */
export function katana(ctx: Ctx, pose: Pose, look: KatanaLook = {}) {
  const drawn = look.drawn ?? 0, glint = look.glint ?? -1, sway = look.sway ?? 0;
  enter(ctx, pose);
  // The sword slides towards the hilt's side as it is drawn.
  ctx.save();
  ctx.translate(-drawn, 0);
  if (drawn > 0) blade(ctx, BLADE);
  hilt(ctx, glint);
  ctx.restore();
  seals(ctx, pose, sway);
  saya(ctx, glint, look.seed ?? 7);
  cord(ctx, pose, sway);
  ctx.restore();
}

/** The bare sword, out of its scabbard. */
export function bareSword(ctx: Ctx, pose: Pose, glint = -1) {
  enter(ctx, pose);
  blade(ctx, BLADE);
  hilt(ctx, glint);
  ctx.restore();
}

/** The empty scabbard alone. */
export function scabbard(ctx: Ctx, pose: Pose, look: KatanaLook = {}) {
  enter(ctx, pose);
  seals(ctx, pose, look.sway ?? 0);
  saya(ctx, look.glint ?? -1, look.seed ?? 7);
  cord(ctx, pose, look.sway ?? 0);
  ctx.restore();
}
