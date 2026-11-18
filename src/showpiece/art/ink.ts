import { clamp, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../core';
import { halftone, PAPER, RED, INK } from './paper';

/**
 * The cuts and the way back to paper: a slash streaking across the frame, white speed lines, the paper flooding back in
 * as halftone dots, the long red strokes the cut leaves on the paper, and the ring of the sword clicking home.
 */

/** A slash: a bright streak along a line through `c` at `angle`, drawn on over [0, 1] by `k` and fading by `fade` (glow). */
export function slashStreak(ctx: Ctx, c: Pt, angle: number, k: number, fade: number, width = 1) {
  if (k <= 0 || fade >= 1) return;
  const ax = Math.cos(angle), ay = Math.sin(angle);
  const from = -1300, to = lerp(-1300, 1300, clamp(k));
  const tail = Math.max(from, to - 1600);
  const pts: Pt[] = [];
  for (let i = 0; i <= 30; i++) {
    const d = lerp(tail, to, i / 30);
    pts.push({ x: c.x + ax * d, y: c.y + ay * d });
  }
  const a = 1 - clamp(fade);
  const w = (u: number) => Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)) ** 0.5 * width;
  ctx.fillStyle = rgba('#ff5a1e', 0.5 * a);
  ribbon(ctx, pts, (u) => 70 * w(u));
  ctx.fillStyle = rgba('#ffc08a', 0.9 * a);
  ribbon(ctx, pts, (u) => 30 * w(u));
  ctx.fillStyle = rgba('#ffffff', a);
  ribbon(ctx, pts, (u) => 10 * w(u));
}

/** A thin glowing line along the cut, with a soft halo (glow layer). */
export function cutLine(ctx: Ctx, c: Pt, angle: number, k: number, width = 1) {
  if (k <= 0) return;
  const ax = Math.cos(angle), ay = Math.sin(angle);
  const a = { x: c.x - ax * 1400, y: c.y - ay * 1400 }, b = { x: c.x + ax * 1400, y: c.y + ay * 1400 };
  for (const [w, col, al] of [[22, '#c8300c', 0.35], [7, '#ff6a2a', 0.9], [2.5, '#ffe0c0', 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = rgba(col, al * k);
    ctx.lineWidth = w * width;
    ctx.stroke();
  }
}

/** White speed lines out from a centre, flickering (glow layer). */
export function speedLines(ctx: Ctx, c: Pt, t: number, k: number) {
  if (k <= 0) return;
  const slot = Math.floor(t * 20);
  for (let i = 0; i < 60; i++) {
    const r = rng(i * 37 + slot * 1009);
    if (r.next() > 0.5) continue;
    const a = r.range(0, Math.PI * 2), r0 = r.range(260, 520), r1 = r0 + r.range(300, 900);
    // Several points along the line: a ribbon's width is taken at its points, and a two-point one would be zero at both.
    const pts = Array.from({ length: 9 }, (_, j) => {
      const d = r0 + ((r1 - r0) * j) / 8;
      return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d };
    });
    ctx.fillStyle = rgba('#ffffff', 0.85 * k);
    ribbon(ctx, pts, (u) => r.range(2, 6) * Math.sin(Math.PI * u));
  }
}

const field = wobble(64), field2 = wobble(91);

/**
 * How far the paper has come back at a point (0 to 1) for progress `p`: it comes in from the right and the top and bottom
 * edges, raggedly, and last of all over the middle of the frame.
 */
function paperReach(x: number, y: number, p: number) {
  const fromEdge = Math.min(1920 - x + 200, y + 140, 1080 - y + 160) / 900 + 0.25 * (x / 1920 - 0.5);
  const n = 0.18 * field(x * 0.006 + y * 0.004) + 0.12 * field2(y * 0.009 - x * 0.003);
  return clamp((p * 1.6 - (fromEdge + n)) * 3.2);
}

/**
 * The paper flooding back over the dark, as halftone dots that grow until they meet (flat layer). Returns nothing; the
 * caller fades the glow layer by `p` itself.
 */
export function paperFlood(ctx: Ctx, p: number, paperImage: (ctx: Ctx) => void) {
  if (p <= 0) return;
  // Where the paper has fully come back, the sheet itself; at its edge, dots of paper colour.
  ctx.save();
  ctx.beginPath();
  const cell = 20;
  for (let y = cell / 2; y < 1080 + cell; y += cell) {
    const odd = Math.round(y / cell) % 2;
    for (let x = (odd ? cell : cell / 2); x < 1920 + cell; x += cell) {
      const s = paperReach(x, y, p);
      if (s < 0.04) continue;
      const r = cell * 0.75 * s;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.clip();
  paperImage(ctx);
  ctx.restore();
}

/** Red and black halftone clusters left where the eye was, shrinking away (flat layer, over the paper). */
export function inkRemnants(ctx: Ctx, k: number) {
  if (k <= 0) return;
  const r = rng(733);
  for (let i = 0; i < 7; i++) {
    const cx = r.range(500, 1500), cy = r.range(250, 800), rx = r.range(120, 260), ry = r.range(50, 110);
    const red = i % 3 !== 0;
    halftone(ctx, red ? rgba('#c8241c', 0.95) : rgba(INK, 0.95), 16, (x, y) => {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      return (1 - d) * 1.4 * k;
    }, { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 });
  }
}

/** Long red strokes across the paper where the cut went, with a grey smear beside them (flat layer). */
export function redStrokes(ctx: Ctx, k: number, t: number) {
  if (k <= 0) return;
  const lines: [number, number, number, string][] = [
    // start y at x=0, end y at x=1920, width, colour
    [770, 205, 10, '#c8221c'],
    [800, 238, 4, '#e0463a'],
    [745, 185, 2.5, '#a01812'],
  ];
  const grow = clamp(k * 1.4);
  // A wide grey smear under the strokes.
  ctx.fillStyle = 'rgba(140,135,130,0.18)';
  ribbon(ctx, strokePts(820, 270, grow), (u) => 70 * Math.sin(Math.PI * u) ** 0.6);
  for (const [y0, y1, w, c] of lines) {
    ctx.fillStyle = rgba(c, 0.95 * k);
    ribbon(ctx, strokePts(y0, y1, grow), (u) => w * Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.4);
  }
  void t;
}

function strokePts(y0: number, y1: number, k: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const u = (i / 40) * k, x = lerp(-60, 1980, u);
    // A slight sag, as a brush would leave.
    pts.push({ x, y: lerp(y0, y1, u) + Math.sin(Math.PI * u) * 26 });
  }
  return pts;
}

/** The ring of the blade clicking home: a thin red circle opening out, with fine radial lines (flat layer). */
export function clickRing(ctx: Ctx, at: Pt, k: number) {
  if (k <= 0 || k >= 1) return;
  const R = lerp(60, 430, Math.sqrt(k)), a = 1 - k;
  ctx.beginPath();
  ctx.arc(at.x, at.y, R, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(RED, 0.8 * a);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const r = rng(12);
  for (let i = 0; i < 18; i++) {
    const ang = r.range(0, Math.PI * 2), r0 = R * r.range(0.15, 0.4), r1 = R * r.range(0.5, 0.8);
    ctx.beginPath();
    ctx.moveTo(at.x + Math.cos(ang) * r0, at.y + Math.sin(ang) * r0);
    ctx.lineTo(at.x + Math.cos(ang) * r1, at.y + Math.sin(ang) * r1);
    ctx.strokeStyle = rgba(INK, 0.5 * a);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/** The sword's red trail as it swings (flat layer): an arc behind its tip. */
export function swingTrail(ctx: Ctx, pts: Pt[], k: number) {
  if (k <= 0 || pts.length < 2) return;
  ctx.fillStyle = rgba('#d42a24', 0.85 * k);
  ribbon(ctx, pts, (u) => 16 * u ** 1.5);
}

export { PAPER };
