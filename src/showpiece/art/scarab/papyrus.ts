import { H, W, clamp, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { GOLD, INK, LAPIS, OCHRE, PAPYRUS, SAND, SAND_SHADE, SANDSTONE, TURQ } from './palette';
import { glint } from './sky';

/**
 * The papyrus side of Sun Scarab: the sheet with its crossed fibres, a band of hieroglyph-like glyphs in boxes (abstract
 * strokes, not words), the sun drawn as an ink circle, the sand pouring in and the dunes it builds, the sandstorm that
 * brings the papyrus back, and the gold dust settling on it.
 */

let sheet: HTMLCanvasElement | null = null;

/** The papyrus: warm cream, crossed strips of fibre, darker at the edges, a fine dot screen. Made once. */
function papyrusSheet() {
  if (sheet) return sheet;
  sheet = document.createElement('canvas');
  sheet.width = W;
  sheet.height = H;
  const c = sheet.getContext('2d')!;
  c.fillStyle = PAPYRUS;
  c.fillRect(0, 0, W, H);
  const r = rng(404);
  // Horizontal strips (the top layer of the sheet) and fainter vertical ones under them.
  for (let i = 0; i < 70; i++) {
    const y = r.range(0, H), h = r.range(6, 26);
    c.fillStyle = r.next() < 0.5 ? `rgba(160,120,60,${r.range(0.03, 0.07)})` : `rgba(255,248,225,${r.range(0.05, 0.12)})`;
    c.fillRect(0, y, W, h);
  }
  for (let i = 0; i < 40; i++) {
    const x = r.range(0, W), w = r.range(10, 40);
    c.fillStyle = `rgba(150,110,55,${r.range(0.015, 0.04)})`;
    c.fillRect(x, 0, w, H);
  }
  // Long fibre hairs.
  for (let i = 0; i < 420; i++) {
    const y = r.range(0, H), x = r.range(-200, W), l = r.range(80, 420);
    c.strokeStyle = `rgba(120,85,40,${r.range(0.05, 0.13)})`;
    c.lineWidth = r.range(0.6, 1.6);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + l, y + r.range(-2, 2));
    c.stroke();
  }
  // Light in the middle, burnt towards the edges.
  const g = c.createRadialGradient(W * 0.5, H * 0.45, 120, W * 0.5, H * 0.5, W * 0.68);
  g.addColorStop(0, 'rgba(255,250,232,0.4)');
  g.addColorStop(0.7, 'rgba(200,160,100,0.08)');
  g.addColorStop(1, 'rgba(130,85,35,0.34)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(130,95,50,0.13)';
  for (let y = 3; y < H; y += 7) for (let x = (y / 7) % 2 ? 3 : 6.5; x < W; x += 7) c.fillRect(x, y, 1.6, 1.6);
  return sheet;
}

export function papyrus(ctx: Ctx, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(papyrusSheet(), 0, 0, W, H);
  ctx.restore();
}

/** The sheet carried on past its edges (mirrored copies round it), for when the climb turns the world. */
export function papyrusWide(ctx: Ctx) {
  const img = papyrusSheet();
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 2; j++) {
      ctx.save();
      ctx.translate(i * W + (i !== 0 ? W : 0) * (Math.abs(i) % 2 ? 1 : 0), j * H + (Math.abs(j) % 2 ? H : 0));
      ctx.scale(Math.abs(i) % 2 ? -1 : 1, Math.abs(j) % 2 ? -1 : 1);
      ctx.drawImage(img, 0, 0, W, H);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- the glyph band

/** The band of glyphs along the bottom of the sheet. */
export const BAND = { x0: 70, x1: 1850, y0: 912, y1: 1032 };
let bandSheet: HTMLCanvasElement | null = null;

type Glyph = (c: Ctx, cx: number, cy: number, s: number, r: ReturnType<typeof rng>) => void;

/** Abstract glyph parts (strokes, not real signs), each drawn round (cx, cy) in a cell of size s. */
const PARTS: Glyph[] = [
  // A disc with a dot.
  (c, x, y, s, r) => {
    c.beginPath(); c.arc(x, y, s * 0.2, 0, Math.PI * 2);
    c.fillStyle = r.pick([OCHRE, '#c8442a', GOLD.base]); c.fill(); c.stroke();
    c.beginPath(); c.arc(x, y, s * 0.05, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
  },
  // A water line: a zigzag.
  (c, x, y, s) => {
    c.beginPath();
    for (let i = 0; i <= 6; i++) c.lineTo(x - s * 0.36 + (i * s * 0.72) / 6, y + (i % 2 ? -1 : 1) * s * 0.07);
    c.save(); c.strokeStyle = LAPIS.base; c.lineWidth = 5; c.stroke(); c.restore();
  },
  // A reed: a tall leaf.
  (c, x, y, s) => {
    c.beginPath();
    c.moveTo(x, y + s * 0.38);
    c.quadraticCurveTo(x + s * 0.16, y, x + s * 0.04, y - s * 0.4);
    c.quadraticCurveTo(x - s * 0.1, y, x, y + s * 0.38);
    c.fillStyle = TURQ.base; c.fill(); c.stroke();
  },
  // Three short strokes.
  (c, x, y, s) => {
    for (const d of [-1, 0, 1]) { c.beginPath(); c.moveTo(x + d * s * 0.16, y - s * 0.16); c.lineTo(x + d * s * 0.16, y + s * 0.16); c.stroke(); }
  },
  // A loaf: half a disc on a line.
  (c, x, y, s) => {
    c.beginPath(); c.arc(x, y + s * 0.1, s * 0.24, Math.PI, 0); c.closePath();
    c.fillStyle = OCHRE; c.fill(); c.stroke();
  },
  // A pillar with crossbars.
  (c, x, y, s) => {
    c.beginPath(); c.moveTo(x, y - s * 0.38); c.lineTo(x, y + s * 0.38); c.stroke();
    for (const d of [-0.24, -0.1]) { c.beginPath(); c.moveTo(x - s * 0.14, y + d * s); c.lineTo(x + s * 0.14, y + d * s); c.stroke(); }
  },
  // An almond with a dot.
  (c, x, y, s) => {
    c.beginPath();
    c.moveTo(x - s * 0.3, y); c.quadraticCurveTo(x, y - s * 0.22, x + s * 0.3, y); c.quadraticCurveTo(x, y + s * 0.18, x - s * 0.3, y);
    c.fillStyle = '#f3e6c6'; c.fill(); c.stroke();
    c.beginPath(); c.arc(x, y - s * 0.01, s * 0.07, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
  },
  // Steps.
  (c, x, y, s) => {
    c.beginPath();
    c.moveTo(x - s * 0.3, y + s * 0.25); c.lineTo(x - s * 0.3, y + s * 0.05); c.lineTo(x - s * 0.1, y + s * 0.05);
    c.lineTo(x - s * 0.1, y - s * 0.15); c.lineTo(x + s * 0.1, y - s * 0.15); c.lineTo(x + s * 0.1, y - s * 0.3);
    c.lineTo(x + s * 0.3, y - s * 0.3); c.lineTo(x + s * 0.3, y + s * 0.25); c.closePath();
    c.fillStyle = SAND; c.fill(); c.stroke();
  },
  // A triangle.
  (c, x, y, s) => {
    c.beginPath(); c.moveTo(x, y - s * 0.26); c.lineTo(x + s * 0.24, y + s * 0.2); c.lineTo(x - s * 0.24, y + s * 0.2); c.closePath();
    c.fillStyle = GOLD.base; c.fill(); c.stroke();
  },
  // A loop on a stem.
  (c, x, y, s) => {
    c.beginPath(); c.ellipse(x, y - s * 0.2, s * 0.1, s * 0.15, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(x, y - s * 0.05); c.lineTo(x, y + s * 0.38); c.stroke();
  },
  // A crook.
  (c, x, y, s) => {
    c.beginPath(); c.moveTo(x + s * 0.04, y + s * 0.38); c.lineTo(x + s * 0.04, y - s * 0.2);
    c.arc(x - s * 0.08, y - s * 0.2, s * 0.12, 0, Math.PI, true); c.stroke();
  },
];

/** The band, made once: double rules, boxes, a glyph group in each box. */
function bandCanvas() {
  if (bandSheet) return bandSheet;
  bandSheet = document.createElement('canvas');
  bandSheet.width = W;
  bandSheet.height = H;
  const c = bandSheet.getContext('2d')!;
  const { x0, x1, y0, y1 } = BAND;
  c.strokeStyle = INK;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // The rules: a thick and a thin above and below, with a lapis line between.
  for (const [y, w] of [[y0 - 10, 2], [y0, 4.5], [y1, 4.5], [y1 + 10, 2]] as const) {
    c.lineWidth = w;
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
  }
  c.strokeStyle = LAPIS.base;
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(x0, y0 - 5); c.lineTo(x1, y0 - 5); c.moveTo(x0, y1 + 5); c.lineTo(x1, y1 + 5); c.stroke();
  const r = rng(1337);
  const cell = 98;
  const n = Math.floor((x1 - x0) / cell);
  const pad = ((x1 - x0) - n * cell) / 2;
  for (let i = 0; i < n; i++) {
    const bx = x0 + pad + i * cell;
    c.strokeStyle = INK;
    c.lineWidth = 3;
    if (i > 0) { c.beginPath(); c.moveTo(bx, y0 + 8); c.lineTo(bx, y1 - 8); c.stroke(); }
    // One to three parts, stacked or side by side.
    c.lineWidth = 4.5;
    const cx = bx + cell / 2, cy = (y0 + y1) / 2, s = (y1 - y0) * 0.9;
    const k = r.next();
    if (k < 0.4) r.pick(PARTS)(c, cx, cy, s, r);
    else if (k < 0.75) {
      r.pick(PARTS)(c, cx, cy - s * 0.24, s * 0.55, r);
      r.pick(PARTS)(c, cx, cy + s * 0.24, s * 0.55, r);
    } else {
      r.pick(PARTS)(c, cx - cell * 0.22, cy, s * 0.6, r);
      r.pick(PARTS)(c, cx + cell * 0.22, cy, s * 0.6, r);
    }
  }
  // Wear on the ink.
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    c.fillStyle = `rgba(0,0,0,${r.range(0.2, 0.6)})`;
    c.beginPath(); c.arc(r.range(x0, x1), r.range(y0 - 12, y1 + 12), r.range(0.8, 2.4), 0, Math.PI * 2); c.fill();
  }
  return bandSheet;
}

/** The glyph band, written on from the left up to `k` (0 to 1). */
export function glyphBand(ctx: Ctx, k: number, alpha = 1) {
  if (k <= 0) return;
  const { x0, x1, y0, y1 } = BAND;
  const x = lerp(x0 - 20, x1 + 20, clamp(k));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(0, y0 - 30, x, y1 - y0 + 60);
  ctx.clip();
  ctx.drawImage(bandCanvas(), 0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------- the sun as an ink circle

/** The sun drawn on the papyrus: an ochre wash in a dot screen, and one brush ring (flat). `gild` turns the wash gold. */
export function inkSun(ctx: Ctx, c: Pt, r: number, k: number, wash: number, gild = 0) {
  if (wash > 0) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(gild > 0 ? '#f2c25a' : '#e9b465', 0.55 * wash + 0.3 * gild);
    ctx.fill();
    halftone(ctx, rgba(gild > 0 ? '#c27a12' : '#b4692a', 0.55 * wash), 11, (x, y) => {
      const d = Math.hypot(x - c.x + r * 0.25, y - c.y + r * 0.25) / r;
      return Math.hypot(x - c.x, y - c.y) < r * 0.96 ? clamp((d - 0.55) * 1.1) : 0;
    }, { x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 });
  }
  if (k <= 0) return;
  const a0 = -Math.PI / 2 - 0.3, a1 = a0 + Math.PI * 2 * 1.05 * clamp(k);
  const pts: Pt[] = [];
  for (let i = 0; i <= 80; i++) {
    const a = lerp(a0, a1, i / 80), w = 1 + 0.01 * Math.sin(a * 3 + 1);
    pts.push({ x: c.x + Math.cos(a) * r * w, y: c.y + Math.sin(a) * r * w });
  }
  ctx.fillStyle = INK;
  ribbon(ctx, pts, (u) => 13 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.12)) ** 0.7));
  // The dot in the middle: the old sign for the sun.
  const dk = clamp((k - 0.8) * 5);
  if (dk > 0) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.13 * dk, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }
}

// ---------------------------------------------------------------- the dunes

const dw = wobble(23), dw2 = wobble(57);

/** The crest of the front dune (k 0 to 1 is how far the sand has piled), at x. */
export function frontCrest(x: number, k: number) {
  const full = 700 + 38 * dw(x * 0.0021) + 22 * dw2(x * 0.006) + 0.00009 * (x - 960) ** 2;
  // It piles up first under the stream (at the right) and spreads.
  const local = clamp(k * 1.7 - Math.abs(x - 1480) / 1500);
  return lerp(1130, full, 1 - (1 - local) ** 2);
}

/** The crest of the back dune, higher and darker. */
export function backCrest(x: number, k: number) {
  const full = 610 + 46 * dw2(x * 0.0017 + 3) + 18 * dw(x * 0.009) + 0.00012 * (x - 900) ** 2;
  const local = clamp(k * 1.5 - 0.15 - Math.abs(x - 1380) / 1700);
  return lerp(1130, full, 1 - (1 - local) ** 2);
}

/** The dunes run on far past the frame's sides (the climb turns the world). */
const X0 = -1500, X1 = W + 1500;

function crestPath(crest: (x: number) => number, below = H + 1400) {
  const p = new Path2D();
  p.moveTo(X0, below);
  for (let x = X0; x <= X1; x += 20) p.lineTo(x, crest(x));
  p.lineTo(X1, below);
  p.closePath();
  return p;
}

/** A dune (flat): the sand body, a shadow face under the crest, ripples, dots, and an ink line on the crest. */
function dune(ctx: Ctx, crest: (x: number) => number, base: string, shade: string, ripple: string, seed: number, lift: number) {
  const body = crestPath(crest);
  ctx.fillStyle = base;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // The shadow face: a band under the crest, wider where the crest falls away to the right.
  const sh = new Path2D();
  sh.moveTo(X0, crest(X0));
  for (let x = X0; x <= X1; x += 20) sh.lineTo(x, crest(x));
  for (let x = X1; x >= X0; x -= 20) {
    const slope = (crest(x + 10) - crest(x - 10)) / 20;
    sh.lineTo(x, crest(x) + 26 + clamp(slope * 2.4 + 0.3) * 90);
  }
  sh.closePath();
  ctx.fillStyle = shade;
  ctx.fill(sh);
  halftone(ctx, rgba(INK, 0.16), 12, (x, y) => clamp((y - crest(x)) / 260) * 0.7, { x: -300, y: 500, w: W + 600, h: H - 300 });
  // Wind ripples: thin curves following the crest.
  const r = rng(seed);
  ctx.strokeStyle = ripple;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x0 = r.range(-100, W), len = r.range(160, 420), d = r.range(60, 340);
    ctx.beginPath();
    for (let j = 0; j <= 10; j++) {
      const x = x0 + (len * j) / 10;
      const y = crest(x) + d + 8 * Math.sin(j * 0.9);
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // The crest line, and a lit edge under it.
  ctx.beginPath();
  for (let x = X0; x <= X1; x += 20) x === X0 ? ctx.moveTo(x, crest(x)) : ctx.lineTo(x, crest(x));
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (lift > 0) {
    ctx.beginPath();
    for (let x = X0; x <= X1; x += 20) x === X0 ? ctx.moveTo(x, crest(x) + 9) : ctx.lineTo(x, crest(x) + 9);
    ctx.strokeStyle = rgba('#fff0c8', 0.7 * lift);
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

export function backDune(ctx: Ctx, k: number) {
  if (k <= 0) return;
  dune(ctx, (x) => backCrest(x, k), SANDSTONE, '#86502a', rgba('#5a3418', 0.5), 31, 0);
}

export function frontDune(ctx: Ctx, k: number) {
  if (k <= 0) return;
  dune(ctx, (x) => frontCrest(x, k), SAND, SAND_SHADE, rgba('#8a5a2a', 0.55), 32, 1);
}

/** The stream of sand pouring in from the top right onto the dune (flat). `k` its flow, 0 to 1. */
export function sandStream(ctx: Ctx, t: number, k: number, dk: number) {
  if (k <= 0) return;
  const land = { x: 1480, y: frontCrest(1480, dk) };
  const top = { x: 1700, y: -60 };
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    pts.push({ x: lerp(top.x, land.x, u) + Math.sin(u * Math.PI) * 70, y: lerp(top.y, land.y, u ** 0.85) });
  }
  // A wide veil of blown sand, the body of the stream, and its bright core.
  ctx.fillStyle = rgba(SAND, 0.45 * k);
  ribbon(ctx, pts, (u) => (90 + 160 * u * u) * k);
  ctx.fillStyle = rgba(SAND_SHADE, 1);
  ribbon(ctx, pts, (u) => (52 + 40 * u) * k);
  ctx.fillStyle = rgba(SAND, 1);
  ribbon(ctx, pts.map((p) => ({ x: p.x - 8, y: p.y })), (u) => (22 + 16 * u) * k);
  // Ink edges, broken.
  for (const side of [-1, 1]) {
    ctx.fillStyle = rgba(INK, 0.85 * k);
    ribbon(ctx, pts.map((p, i) => ({ x: p.x + side * ((52 + 40 * (i / 24)) * k) / 2, y: p.y })), (u) => 3.5 * Math.abs(Math.sin(u * 9 + t * 4)));
  }
  // Grains falling along it and blown off it.
  const r = rng(808);
  for (let i = 0; i < 320; i++) {
    const u = (r.next() + t * r.range(0.9, 1.6)) % 1;
    const p = pts[Math.floor(u * 24)];
    const spread = r.range(-1, 1) * (30 + 160 * u * u);
    ctx.fillStyle = rgba(r.pick([SANDSTONE, SAND_SHADE, INK, OCHRE]), k * r.range(0.6, 1));
    ctx.beginPath();
    ctx.arc(p.x + spread, p.y + r.range(-10, 10), r.range(1.5, 4.5), 0, Math.PI * 2);
    ctx.fill();
  }
  // Drifts of sand blown across the sheet from the stream.
  for (let i = 0; i < 26; i++) {
    const y = r.range(80, 760), len = r.range(160, 520), ph = (r.next() + t * r.range(0.5, 0.9)) % 1;
    const x1 = lerp(1700, -200, ph), x0 = x1 + len;
    const dpts: Pt[] = Array.from({ length: 8 }, (_, j) => ({ x: lerp(x0, x1, j / 7), y: y + 10 * Math.sin(j * 0.8 + i) }));
    ctx.fillStyle = rgba(r.pick([SAND_SHADE, OCHRE, SANDSTONE]), 0.55 * k * Math.sin(Math.PI * ph));
    ribbon(ctx, dpts, (u) => r.range(2, 5) * Math.sin(Math.PI * u));
  }
  // The splash where it lands.
  for (let i = 0; i < 60; i++) {
    const ph = (r.next() + t * 1.8) % 1;
    const a = -Math.PI / 2 + r.range(-1.3, 1.3), d = 40 + 220 * ph;
    ctx.fillStyle = rgba(r.pick([SANDSTONE, SAND_SHADE, OCHRE]), k * (1 - ph));
    ctx.beginPath();
    ctx.arc(land.x + Math.cos(a) * d, land.y + Math.sin(a) * d * 0.5 + 300 * ph * ph, r.range(2, 5), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Sand thrown up where something breaks out of the dune at x (flat): grains flying up and falling back. */
export function sandBurst(ctx: Ctx, at: Pt, t: number, t0: number, k: number, width = 260) {
  if (k <= 0) return;
  const r = rng(919);
  for (let i = 0; i < 120; i++) {
    const birth = t0 + r.range(0, 1.4);
    const age = t - birth;
    if (age < 0 || age > 1.1) continue;
    const x0 = at.x + r.range(-1, 1) * width, vx = r.range(-1, 1) * 160, vy = -r.range(250, 700);
    const x = x0 + vx * age, y = at.y + vy * age + 900 * age * age;
    if (y > at.y + 40) continue;
    ctx.fillStyle = rgba(r.pick([SANDSTONE, SAND_SHADE, SAND, INK]), k * (1 - age / 1.1));
    ctx.beginPath();
    ctx.arc(x, y, r.range(2, 5.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Sand pouring off something rising: thin streams falling from points along `edge` (flat). */
export function sandOff(ctx: Ctx, edge: Pt[], t: number, k: number, floor: number) {
  if (k <= 0) return;
  const r = rng(2024);
  for (const e of edge) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ph = (r.next() + t * r.range(1.2, 2.2)) % 1;
      const y = e.y + ph * (floor - e.y);
      ctx.fillStyle = rgba(r.pick([SAND, SAND_SHADE, SANDSTONE]), k * (1 - ph * 0.6));
      ctx.beginPath();
      ctx.arc(e.x + r.range(-8, 8) + ph * r.range(-20, 20), y, r.range(2, 4.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- the sandstorm

const sw = wobble(303), sw2 = wobble(717);

/** How far the papyrus has come back at a point, for a storm front at `front` x (it sweeps left to right). */
function stormReach(x: number, y: number, front: number) {
  const n = 120 * sw(y * 0.006 + x * 0.001) + 60 * sw2(y * 0.017 - x * 0.004);
  return clamp((front - x - n) / 160);
}

/** The new scene coming in behind the storm front as dots that grow until they meet (flat). */
export function stormReveal(ctx: Ctx, front: number, scene: (ctx: Ctx) => void) {
  ctx.save();
  ctx.beginPath();
  const cell = 22;
  for (let y = cell / 2; y < H + cell; y += cell) {
    const odd = Math.round(y / cell) % 2;
    for (let x = odd ? cell : cell / 2; x < W + cell; x += cell) {
      const s = stormReach(x, y, front);
      if (s < 0.04) continue;
      if (s >= 1) { ctx.rect(x - cell, y - cell, cell * 2, cell * 2); continue; }
      const rr = cell * 0.78 * s;
      ctx.moveTo(x + rr, y);
      ctx.arc(x, y, rr, 0, Math.PI * 2);
    }
  }
  ctx.clip();
  scene(ctx);
  ctx.restore();
}

/** Wipes the glow away where the papyrus has come back. */
export function stormClearGlow(ctx: Ctx, front: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createLinearGradient(front - 200, 0, front + 200, 0);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** The storm itself (flat): a wall of driven sand streaks round the front, grains racing ahead of it. */
export function storm(ctx: Ctx, front: number, t: number, k: number) {
  if (k <= 0) return;
  const r = rng(4242);
  for (let i = 0; i < 90; i++) {
    const y = r.range(-40, H + 40);
    const lead = r.range(-500, 260);
    const len = r.range(220, 900);
    const x1 = front + lead + 40 * sw(y * 0.01 + t * 2);
    const x0 = x1 - len;
    const thick = r.range(5, 26);
    const pts: Pt[] = Array.from({ length: 10 }, (_, j) => ({ x: lerp(x0, x1, j / 9), y: y + 14 * Math.sin(j * 0.7 + t * 6 + i) }));
    ctx.fillStyle = rgba(r.pick([SAND, SAND_SHADE, OCHRE, SANDSTONE, '#d9b77e']), k * r.range(0.65, 1));
    ribbon(ctx, pts, (u) => thick * Math.sin(Math.PI * u) ** 0.7);
  }
  // A few ink streaks for line.
  for (let i = 0; i < 18; i++) {
    const y = r.range(0, H), x1 = front + r.range(-300, 200), len = r.range(200, 600);
    const pts: Pt[] = Array.from({ length: 8 }, (_, j) => ({ x: lerp(x1 - len, x1, j / 7), y: y + 6 * Math.sin(j + t * 5) }));
    ctx.fillStyle = rgba(INK, 0.8 * k);
    ribbon(ctx, pts, (u) => 4 * Math.sin(Math.PI * u));
  }
  // Grains racing ahead.
  for (let i = 0; i < 260; i++) {
    const y = r.range(0, H), x = front + r.range(-200, 520) + ((t * 900 * r.range(0.6, 1.2)) % 200);
    ctx.fillStyle = rgba(r.pick([SANDSTONE, SAND_SHADE, OCHRE, INK]), k * r.range(0.5, 1));
    ctx.fillRect(x, y, r.range(3, 14), r.range(1.5, 3.5));
  }
}

// ---------------------------------------------------------------- gold dust

/** The gold dust's flakes at time t: where each is, its size, its turn. */
function flakes(t: number, t0: number) {
  const r = rng(1201);
  const age = Math.max(0, t - t0);
  const out: { x: number; y: number; sz: number; turn: number; ph: number; big: boolean }[] = [];
  for (let i = 0; i < 160; i++) {
    const x0 = r.range(0, W), y0 = r.range(-200, H * 0.82), fall = r.range(80, 260);
    const ph = r.range(0, 6.28), big = r.next() > 0.82, sz = big ? r.range(5, 8) : r.range(2.2, 4.5);
    const settle = 1 - Math.exp(-age * r.range(0.8, 1.6));
    out.push({
      x: x0 + Math.sin(ph + age * 1.7) * 14 * (1 - settle),
      y: y0 + fall * settle,
      sz, ph, big,
      turn: lerp(0.35, 1, Math.abs(Math.sin(ph + age * 3 * (1 - settle)))),
    });
  }
  return out;
}

/** Gold dust settling on the papyrus after the storm (flat): flakes drifting down and slowing, from t0. */
export function goldDust(ctx: Ctx, t: number, t0: number, k: number) {
  if (k <= 0) return;
  for (const f of flakes(t, t0)) {
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.sz, f.sz * f.turn, f.ph, 0, Math.PI * 2);
    ctx.fillStyle = rgba(f.turn > 0.7 ? GOLD.hi : GOLD.base, k);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(GOLD.deep, 0.9 * k);
    ctx.stroke();
  }
}

/** A few of the big flakes catching the light (glow): small twinkles. */
export function goldTwinkles(ctx: Ctx, t: number, t0: number, k: number) {
  if (k <= 0) return;
  flakes(t, t0).forEach((f, i) => {
    if (!f.big) return;
    const tw = Math.max(0, Math.sin(t * 3.1 + i * 1.7)) ** 6;
    if (tw < 0.05) return;
    glint(ctx, { x: f.x, y: f.y }, 16 * tw, 0.75 * k * tw, '#fff2c0');
  });
}
