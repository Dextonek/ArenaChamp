import { H, W, clamp, rng, rgba, type Ctx, type Pt } from '../../core';

/**
 * Celestial Clockwork's shared pieces: the palette, the clock's centre and radii, the constellations of the star chart,
 * which of their stars become the clock's hands, the parchment sheet (made once) and small drawing helpers.
 */

export const PARCH = '#e8e0c8';
export const SEPIA = '#5a3b20';
export const SEPIA_SOFT = '#8c6a46';
export const SPACE = '#06071a';
export const INDIGO = '#161a46';
export const BRASS = '#c99a42';
export const BRASS_HI = '#f4d98e';
export const BRASS_SH = '#7c5622';
export const BRASS_DK = '#3c2810';
export const OUTLINE = '#130d07';
export const STAR = '#f6f2e4';
export const GOLD = '#ffcf6a';
export const CYAN = '#7ff0ff';
export const SEAL = '#262a6e';

/** The clock's centre (also the compass rose's). */
export const C: Pt = { x: 960, y: 560 };

/** The chart's astrolabe ring and the brass rings that take its place. */
export const R = {
  chart: 440,
  gearIn: 392,
  gearOut: 440,
  teeth: 466,
  tickIn: 318,
  tickOut: 372,
  armil: 258,
  hub: 46,
};

export interface Constellation {
  stars: Pt[];
  edges: [number, number][];
}

/** The chart's constellations, round the edges of the frame (the title card's corner is kept clear). */
export const SKY: Constellation[] = [
  { stars: [{ x: 1470, y: 150 }, { x: 1565, y: 222 }, { x: 1668, y: 186 }, { x: 1752, y: 268 }, { x: 1700, y: 352 }, { x: 1830, y: 392 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]] },
  { stars: [{ x: 1562, y: 534 }, { x: 1690, y: 474 }, { x: 1826, y: 566 }, { x: 1748, y: 672 }, { x: 1606, y: 650 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
  { stars: [{ x: 1420, y: 892 }, { x: 1536, y: 820 }, { x: 1652, y: 904 }, { x: 1786, y: 858 }, { x: 1712, y: 1000 }],
    edges: [[0, 1], [1, 2], [2, 3], [2, 4]] },
  { stars: [{ x: 170, y: 990 }, { x: 262, y: 884 }, { x: 392, y: 926 }, { x: 470, y: 822 }, { x: 566, y: 906 }, { x: 434, y: 1016 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]] },
  { stars: [{ x: 120, y: 470 }, { x: 236, y: 418 }, { x: 336, y: 524 }, { x: 262, y: 646 }, { x: 410, y: 716 }],
    edges: [[0, 1], [1, 2], [2, 3], [2, 4]] },
  { stars: [{ x: 708, y: 64 }, { x: 812, y: 40 }, { x: 1110, y: 46 }, { x: 1216, y: 82 }],
    edges: [[0, 1], [2, 3]] },
];

/** Every star in order (constellation by constellation), with its index in the flat list. */
export const ALL_STARS: { c: number; i: number; p: Pt; n: number }[] = [];
SKY.forEach((con, c) => con.stars.forEach((p, i) => ALL_STARS.push({ c, i, p, n: ALL_STARS.length })));

/** The hands: their stars' distances from the centre and sideways offsets (a constellation, not a straight rod). */
export const HOUR = { len: 236, slots: [[58, 0], [104, 5], [150, -4], [196, 4], [236, 0]] as [number, number][] };
export const MINUTE = { len: 372, slots: [[60, 0], [114, -4], [168, 5], [222, -3], [272, 4], [322, -3], [372, 0]] as [number, number][] };

/** Which sky stars are pulled into which hand slot (constellation, star). */
export const HAND_FROM: { hand: 'h' | 'm'; slot: number; c: number; i: number }[] = [
  { hand: 'h', slot: 0, c: 4, i: 2 }, { hand: 'h', slot: 1, c: 4, i: 3 }, { hand: 'h', slot: 2, c: 3, i: 3 },
  { hand: 'h', slot: 3, c: 3, i: 4 }, { hand: 'h', slot: 4, c: 4, i: 4 },
  { hand: 'm', slot: 0, c: 1, i: 0 }, { hand: 'm', slot: 1, c: 1, i: 4 }, { hand: 'm', slot: 2, c: 0, i: 1 },
  { hand: 'm', slot: 3, c: 2, i: 1 }, { hand: 'm', slot: 4, c: 0, i: 4 }, { hand: 'm', slot: 5, c: 2, i: 0 },
  { hand: 'm', slot: 6, c: 0, i: 0 },
];

export const handOf = (c: number, i: number) => HAND_FROM.findIndex((h) => h.c === c && h.i === i);

/** A point at angle `a` and distance `d` from the centre, pushed `side` across. */
export function polar(a: number, d: number, side = 0, o: Pt = C): Pt {
  return { x: o.x + Math.cos(a) * d - Math.sin(a) * side, y: o.y + Math.sin(a) * d + Math.cos(a) * side };
}

let sheet: HTMLCanvasElement | null = null;

/** The old star-chart parchment: warm, stained, darker at the edges, with a fine dot screen. Made once. */
function parchSheet() {
  if (sheet) return sheet;
  sheet = document.createElement('canvas');
  sheet.width = W;
  sheet.height = H;
  const c = sheet.getContext('2d')!;
  c.fillStyle = PARCH;
  c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W * 0.5, H * 0.48, 120, W * 0.5, H * 0.5, W * 0.68);
  g.addColorStop(0, 'rgba(255,250,232,0.55)');
  g.addColorStop(0.7, 'rgba(214,196,156,0.15)');
  g.addColorStop(1, 'rgba(150,112,66,0.42)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const r = rng(808);
  for (let i = 0; i < 16; i++) {
    const x = r.range(0, W), y = r.range(0, H), s = r.range(60, 240);
    const st = c.createRadialGradient(x, y, 0, x, y, s);
    st.addColorStop(0, `rgba(160,118,64,${r.range(0.04, 0.09)})`);
    st.addColorStop(0.8, `rgba(160,118,64,${r.range(0.02, 0.05)})`);
    st.addColorStop(1, 'rgba(160,118,64,0)');
    c.fillStyle = st;
    c.fillRect(x - s, y - s, s * 2, s * 2);
  }
  c.lineCap = 'round';
  for (let i = 0; i < 700; i++) {
    const x = r.range(0, W), y = r.range(0, H), a = r.range(-0.4, 0.4), l = r.range(8, 40);
    c.strokeStyle = `rgba(110,80,46,${r.range(0.03, 0.08)})`;
    c.lineWidth = r.range(0.6, 1.4);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  c.fillStyle = 'rgba(120,92,58,0.14)';
  for (let y = 3; y < H; y += 7) for (let x = (y / 7) % 2 ? 3 : 6.5; x < W; x += 7) c.fillRect(x, y, 1.6, 1.6);
  return sheet;
}

export function parchment(ctx: Ctx, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(parchSheet(), 0, 0, W, H);
  ctx.restore();
}

/** A star glint: a small hot core and four thin rays (glow layer). */
export function glint(ctx: Ctx, p: Pt, size: number, k: number, color = '#fff1c8', rot = 0) {
  if (k <= 0 || size <= 0) return;
  const s = size;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 1.2);
  g.addColorStop(0, rgba('#ffffff', 0.95 * k));
  g.addColorStop(0.3, rgba(color, 0.55 * k));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, s * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(color, 0.9 * k);
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2, l = (i % 2 ? 2.2 : 3.2) * s, w = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * l, p.y + Math.sin(a) * l);
    ctx.lineTo(p.x + Math.cos(a + Math.PI / 2) * w, p.y + Math.sin(a + Math.PI / 2) * w);
    ctx.lineTo(p.x - Math.cos(a + Math.PI / 2) * w, p.y - Math.sin(a + Math.PI / 2) * w);
    ctx.closePath();
    ctx.fill();
  }
}

/** A four-pointed star shape (path only). */
export function starPath(ctx: Ctx, p: Pt, r: number, inner = 0.28, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 4, d = i % 2 ? r * inner : r;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** Sepia and brass ink specks for the parchment. */
export const SPECKS = [SEPIA, SEPIA_SOFT, '#a8875a', BRASS_SH];

/** Wipes the glow layer out under the title card so nothing glows through its letters. */
export function clearTitleGlow(ctx: Ctx, k: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(240, 150, 120, 240, 150, 560);
  g.addColorStop(0, `rgba(0,0,0,${clamp(k)})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 820, 720);
  ctx.restore();
}
