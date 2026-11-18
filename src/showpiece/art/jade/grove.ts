import { clamp, easeOut, lerp, ribbon, rng, rgba, seg, type Ctx, type Pt } from '../../core';

/**
 * The bamboo grove brushed in sumi ink on the paper: stalks in three washes (pale far, grey middle, near black), each
 * stalk a stack of separate tapered strokes with a node mark between them, twigs with fans of long pointed leaves; the
 * wind that bends them; the three cuts that slice them; and the cut pieces that fall and lie on the paper at the end.
 */

export const JADE = {
  outline: '#06140d',
  deep: '#0f3d29',
  shadow: '#17583f',
  mid: '#2a8a5f',
  light: '#4fb784',
  pale: '#9ee3bd',
  mint: '#c9f7dd',
  belly: '#dbe9c8',
  gold: '#d9ad4c',
  goldLight: '#ffe08a',
  ground: '#06120c',
  ink: '#1e5a3c',
};

interface Tone { body: string; edge: string; light: string; leaf: string }
export const TONES: Tone[] = [
  { body: '#c9c7be', edge: '#b3b1a8', light: '#e1ded6', leaf: '#c2c0b7' },
  { body: '#818580', edge: '#5f635d', light: '#a9aba3', leaf: '#747872' },
  { body: '#232823', edge: '#0c0f0d', light: '#525951', leaf: '#191d1a' },
];

interface LeafSpec { a: number; len: number; w: number }
interface Twig { y: number; side: number; len: number; leaves: LeafSpec[] }
export interface Stalk { x: number; w: number; tone: number; lean: number; nodes: number[]; twigs: Twig[]; seed: number; born: number; front: boolean }

/** [x, width, tone, when it is brushed in (0 to 1 of the grove's painting), in front of the serpent] */
const SPEC: [number, number, number, number, boolean][] = [
  [70, 18, 0, 0.30, false], [335, 16, 0, 0.42, false], [800, 20, 0, 0.36, false], [1090, 17, 0, 0.5, false],
  [1395, 21, 0, 0.33, false], [1705, 18, 0, 0.46, false], [1890, 16, 0, 0.55, false],
  [215, 28, 1, 0.18, false], [575, 30, 1, 0.25, false], [945, 27, 1, 0.12, false], [1335, 30, 1, 0.22, false],
  [1640, 28, 1, 0.28, false],
  [445, 40, 2, 0.08, true], [720, 46, 2, 0.0, false], [1205, 52, 2, 0.04, true], [1520, 42, 2, 0.14, false],
  [1810, 48, 2, 0.1, true],
];

export const STALKS: Stalk[] = SPEC.map(([x, w, tone, born, front], i) => {
  const r = rng(300 + i * 17);
  const nodes: number[] = [];
  let y = 1130 + r.range(0, 60);
  while (y > -160) {
    nodes.push(y);
    y -= r.range(150, 205) * (0.75 + w / 110);
  }
  nodes.push(y);
  const twigs: Twig[] = [];
  let side = r.sign();
  for (let n = 1; n < nodes.length - 1; n++) {
    if (nodes[n] > 760 || r.next() < (tone === 2 ? 0.25 : 0.45)) continue;
    const count = 3 + Math.floor(r.next() * 3);
    const leaves: LeafSpec[] = [];
    const scale = tone === 2 ? 1 : tone === 1 ? 0.8 : 0.62;
    for (let k = 0; k < count; k++) {
      leaves.push({ a: 0.55 + (k - (count - 1) / 2) * 0.32 + r.range(-0.08, 0.08), len: r.range(105, 170) * scale, w: r.range(15, 21) * scale });
    }
    twigs.push({ y: nodes[n], side, len: r.range(40, 90) * scale, leaves });
    side = -side;
  }
  return { x, w, tone, lean: r.range(-0.03, 0.03), nodes, twigs, seed: r.range(0, 6.28), born, front };
});

/** The wind's strength over time: calm, rising, gusting, and held still from the first cut on (`freeze`). */
export function windAt(t: number) {
  const rise = seg(t, 1.45, 2.5);
  const gust = 0.12 * Math.sin(t * 4.1) + 0.06 * Math.sin(t * 9.3);
  return rise * (0.85 + gust) - 0.25 * seg(t, 3.4, 4.6) * rise;
}

/** Where a stalk's middle is at height y for a given bend (wind). */
export function stalkX(s: Stalk, y: number, bend: number, t: number) {
  const h = clamp((1100 - y) / 1200);
  const flutter = Math.sin(t * 2.3 + s.seed) * 0.12 + Math.sin(t * 5.3 + s.seed * 2) * 0.05;
  const stiff = s.tone === 2 ? 0.8 : s.tone === 1 ? 1 : 1.15;
  return s.x + s.lean * (1100 - y) + bend * (1 + flutter) * h * h * 230 * stiff;
}

/** A long pointed bamboo leaf from its base along angle `a` (flat). */
export function leafShape(ctx: Ctx, x: number, y: number, a: number, len: number, w: number, curl = 0.12) {
  const pts: Pt[] = [];
  const ca = Math.cos(a), sa = Math.sin(a);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10, along = len * u, off = curl * len * u * u;
    pts.push({ x: x + ca * along - sa * off, y: y + sa * along + ca * off });
  }
  ribbon(ctx, pts, (u) => w * Math.sin(Math.PI * Math.min(1, u ** 0.55)) ** 0.9);
}

const offsetX = (pts: Pt[], dx: number) => pts.map((p) => ({ x: p.x + dx, y: p.y }));

/**
 * One stalk (flat): brushed up from the bottom to `grow` (0 to 1), its leaves out to `leafK`. `bend` is the wind,
 * `t` only makes it flutter.
 */
export function drawStalk(ctx: Ctx, s: Stalk, bend: number, t: number, grow = 1, leafK = 1, alpha = 1) {
  if (grow <= 0) return;
  const tone = TONES[s.tone];
  const top = lerp(1150, -170, grow);
  ctx.save();
  ctx.globalAlpha = alpha;
  const w = s.w;
  for (let i = 0; i < s.nodes.length - 1; i++) {
    const y0 = s.nodes[i], y1 = s.nodes[i + 1];
    if (y0 - 4 < top) break;
    const ya = y0 - 4, yb = Math.max(y1 + 4, top);
    const full = yb === y1 + 4;
    const pts: Pt[] = [];
    for (let j = 0; j <= 8; j++) {
      const y = lerp(ya, yb, j / 8);
      pts.push({ x: stalkX(s, y, bend, t), y });
    }
    // The segment: a little wider at its two ends, as a brush pressed at the node.
    ctx.fillStyle = tone.body;
    // A segment still being brushed ends in the brush's rounded tip.
    ribbon(ctx, pts, (u) => w * (0.94 + 0.1 * Math.abs(u - 0.5) ** 2 * 4) * (full ? 1 : 1 - 0.7 * u ** 3));
    // The dry brush's light streak, and the dark edge on the shadow side.
    ctx.fillStyle = rgba(tone.light, 0.6);
    ribbon(ctx, offsetX(pts, -w * 0.2), (u) => w * 0.2 * Math.sin(Math.PI * clamp(u * 1.15 - 0.07)) ** 0.5);
    ctx.fillStyle = rgba(tone.edge, 0.9);
    ribbon(ctx, offsetX(pts, w * 0.36), (u) => w * 0.16 * Math.sin(Math.PI * clamp(u * 1.1 - 0.05)) ** 0.4);
  }
  // The node marks: a short curved stroke a little wider than the stalk, and a thinner one under it.
  ctx.fillStyle = tone.edge;
  for (let i = 1; i < s.nodes.length; i++) {
    const y = s.nodes[i];
    if (y < top) break;
    const cx = stalkX(s, y, bend, t);
    for (const [dy, th, wid] of [[0, 7, 0.66], [7, 3, 0.55]] as const) {
      const pts: Pt[] = [];
      for (let j = 0; j <= 6; j++) {
        const u = j / 6;
        pts.push({ x: cx + lerp(-w * wid, w * wid, u), y: y + dy - 3 * Math.sin(Math.PI * u) });
      }
      ribbon(ctx, pts, (u) => th * Math.sin(Math.PI * u) ** 0.5);
    }
  }
  // Twigs and leaf fans.
  if (leafK > 0) {
    for (const tw of s.twigs) {
      if (tw.y < top) continue;
      const k = clamp(leafK * 1.3 - (1100 - tw.y) / 2600);
      if (k <= 0) continue;
      const bx = stalkX(s, tw.y, bend, t), by = tw.y;
      const ta = tw.side > 0 ? -0.75 + bend * 0.5 : Math.PI + 0.75 + bend * 0.5;
      const ex = bx + Math.cos(ta) * tw.len * k, ey = by + Math.sin(ta) * tw.len * k;
      ctx.fillStyle = tone.edge;
      ribbon(ctx, [{ x: bx, y: by }, { x: (bx + ex) / 2, y: (by + ey) / 2 - 4 }, { x: ex, y: ey }], (u) => 5 * (1 - u * 0.7));
      ctx.fillStyle = tone.leaf;
      tw.leaves.forEach((lf, n) => {
        // Hanging out and down; the wind sweeps them flat to the right and they flutter.
        let a = tw.side > 0 ? lf.a : Math.PI - lf.a;
        const flutter = Math.sin(t * 7.3 + n * 1.9 + s.seed) * 0.16 + Math.sin(t * 12.1 + n) * 0.06;
        a = lerp(a, -0.08 + (n - 2) * 0.1, clamp(bend * 0.75)) + flutter * clamp(bend * 1.2);
        leafShape(ctx, ex, ey, a, lf.len * easeOut(k), lf.w, tw.side * 0.1);
      });
    }
  }
  ctx.restore();
}

/** The silhouette of a stalk's straight segments (for punching it out of the glow layer). */
export function stalkSilhouette(ctx: Ctx, s: Stalk, bend: number, t: number) {
  const pts: Pt[] = [];
  for (let j = 0; j <= 24; j++) {
    const y = lerp(1160, -180, j / 24);
    pts.push({ x: stalkX(s, y, bend, t), y });
  }
  ribbon(ctx, pts, () => s.w * 1.05);
}

/** Leaves blown across the paper in the wind, tumbling (flat): ink, and a few in green ink. */
export function windLeaves(ctx: Ctx, t: number, k: number, from = 1.6, until = 5.6) {
  if (k <= 0) return;
  const r = rng(4242);
  for (let i = 0; i < 46; i++) {
    const born = r.range(from - 1.2, until), v = r.range(900, 1700), y0 = r.range(120, 1000);
    const len = r.range(50, 110), w = len * 0.17, spin = r.range(4, 11) * r.sign(), a0 = r.range(0, 6.28);
    const green = r.next() < 0.35;
    const age = t - born;
    if (age < 0) continue;
    const x = -160 + age * v;
    if (x > 2100) continue;
    const y = y0 + 90 * Math.sin(age * 2.2 + a0) - age * 60;
    const a = 0.25 * Math.sin(age * 3 + a0) - 0.15 + Math.sin(age * spin) * 0.6;
    const flip = Math.abs(Math.cos(age * spin * 0.7 + a0));
    ctx.fillStyle = rgba(green ? JADE.ink : '#1a1e1b', 0.9 * k);
    leafShape(ctx, x, y, a, len, w * (0.25 + 0.75 * flip), 0.15 * Math.sign(Math.cos(age * spin * 0.7 + a0)));
  }
}

/** Grey dry-brush wind lines streaking across (flat). */
export function windLines(ctx: Ctx, t: number, k: number) {
  if (k <= 0) return;
  const r = rng(777);
  for (let i = 0; i < 22; i++) {
    const period = r.range(0.7, 1.3), off = r.range(0, period), y0 = r.range(90, 1040), len = r.range(500, 1100);
    const cyc = Math.floor((t + off) / period), age = ((t + off) % period) / period;
    const rr = rng(i * 31 + cyc * 977);
    const y = y0 + rr.range(-60, 60), head = lerp(-300, 2400, age), curve = rr.range(-50, 50);
    const pts: Pt[] = [];
    for (let j = 0; j <= 16; j++) {
      const u = j / 16, x = head - len * (1 - u);
      pts.push({ x, y: y + curve * Math.sin(Math.PI * u) + (x / 1920) * -40 });
    }
    ctx.fillStyle = rgba(r.next() < 0.3 ? '#5f8f72' : '#6b6a64', 0.32 * k * Math.sin(Math.PI * age));
    ribbon(ctx, pts, (u) => rr.range(2, 5) * Math.sin(Math.PI * u) ** 0.6);
  }
}

/** The three wind cuts: each a line through (960, y) at an angle; they never cross inside the frame. */
export interface Cut { y: number; a: number; t: number; dir: number }
export const CUTS: Cut[] = [
  { y: 300, a: -0.25, t: 5.45, dir: 1 },
  { y: 590, a: -0.19, t: 5.9, dir: -1 },
  { y: 845, a: -0.14, t: 6.35, dir: 1 },
];

export const cutPoint = (c: Cut): Pt => ({ x: 960, y: c.y });

/** How far a cut's upper part has slid down along it, as a vector. */
export function cutSlide(c: Cut, t: number): Pt {
  const d = 52 * easeOut(seg(t, c.t + 0.02, c.t + 0.32)) + 14 * seg(t, c.t + 0.32, c.t + 1.4);
  const ux = -Math.cos(c.a), uy = -Math.sin(c.a);
  const lift = 5 * easeOut(seg(t, c.t + 0.02, c.t + 0.2));
  return { x: ux * d + Math.sin(c.a) * lift, y: uy * d - Math.cos(c.a) * lift };
}

/** Clips to one side of a cut (side -1: above it, 1: below it). */
export function clipSide(ctx: Ctx, c: Cut, side: number) {
  const ax = Math.cos(c.a), ay = Math.sin(c.a), nx = -ay * side, ny = ax * side, far = 5000;
  const p = cutPoint(c);
  ctx.beginPath();
  ctx.moveTo(p.x - ax * far, p.y - ay * far);
  ctx.lineTo(p.x + ax * far, p.y + ay * far);
  ctx.lineTo(p.x + ax * far + nx * far, p.y + ay * far + ny * far);
  ctx.lineTo(p.x - ax * far + nx * far, p.y - ay * far + ny * far);
  ctx.closePath();
  ctx.clip();
}

/**
 * Draws `scene` once a band between the cuts that have landed, each band moved by the slides of the cuts below which
 * it lies. Before the first cut it is just the scene.
 */
export function slicedBands(ctx: Ctx, t: number, scene: (ctx: Ctx, band: number) => void) {
  // Only the cuts that have landed divide the picture (they land top to bottom), so no seam shows before a cut.
  const m = CUTS.filter((c) => t >= c.t).length;
  if (m === 0) {
    scene(ctx, -1);
    return;
  }
  for (let band = 0; band <= m; band++) {
    let ox = 0, oy = 0;
    for (let c = band; c < m; c++) {
      const s = cutSlide(CUTS[c], t);
      ox += s.x; oy += s.y;
    }
    ctx.save();
    ctx.translate(ox, oy);
    if (band > 0) clipSide(ctx, CUTS[band - 1], 1);
    if (band < m) clipSide(ctx, CUTS[band], -1);
    scene(ctx, band);
    ctx.restore();
  }
}

/** Where a stalk crosses a cut (for the pale cut faces). */
export function stalkOnCut(s: Stalk, c: Cut, bend: number, t: number): Pt {
  // The line is nearly flat, so two passes of fixed-point iteration find the crossing.
  let y = c.y;
  for (let i = 0; i < 3; i++) {
    const x = stalkX(s, y, bend, t);
    y = c.y + Math.tan(c.a) * (x - 960);
  }
  return { x: stalkX(s, y, bend, t), y };
}

/** The pale cut face of a stalk sliced along a cut: a thin ellipse of green-white pith with a darker rim (flat). */
export function cutFace(ctx: Ctx, at: Pt, w: number, a: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(at.x, at.y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2 / Math.cos(a) + 1, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#5c8a69';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -0.5, w / 2 / Math.cos(a) - 4, 3.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e3eed6';
  ctx.fill();
  ctx.restore();
}

/** A piece of cut bamboo lying or falling (flat): a straight segment, one node, its two ends sliced on a slant. */
export function bambooPiece(ctx: Ctx, x: number, y: number, angle: number, len: number, w: number, slant = 0.5) {
  const tone = TONES[2];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const h = w / 2, d = w * slant;
  ctx.beginPath();
  ctx.moveTo(-len / 2 + d, -h);
  ctx.lineTo(len / 2, -h);
  ctx.lineTo(len / 2 - d, h);
  ctx.lineTo(-len / 2, h);
  ctx.closePath();
  ctx.fillStyle = tone.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(tone.light, 0.6);
  ctx.fillRect(-len / 2, -h * 0.55, len, h * 0.42);
  ctx.fillStyle = tone.edge;
  ctx.fillRect(-len / 2, h * 0.55, len, h * 0.45);
  // The node.
  ctx.fillRect(len * 0.08 - 3, -h - 2, 6, w + 4);
  ctx.restore();
  // The pale slanted cut faces at both ends.
  for (const end of [-1, 1]) {
    ctx.save();
    ctx.translate(end * (len / 2 - d / 2), 0);
    ctx.rotate(Math.atan2(w, -d));
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.hypot(w, d) / 2, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5c8a69';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.hypot(w, d) / 2 - 4, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e3eed6';
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
