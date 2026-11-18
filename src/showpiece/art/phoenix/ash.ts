import { clamp, lerp, rgba, rng, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { curlSpine, edgePath, polyPath, ribbonEdges, smoothPath } from './common';

/**
 * The paper side of the phoenix: the heap of grey ash with its one ember, the cracks of light that run through it, the ash
 * thrown out when it bursts, the black that bursts out of it, and at the end the green sprout and the golden feather.
 */

export const INK = '#1e1915';
/** The heap's base centre and size (its full width is 760 units at scale 1, its height 230). */
export const HEAP = { x: 960, y: 880 };
const HW = 400, HH = 270;

/** The heap's outline in its own units (0, 0 at the middle of its base), made once. */
const OUTLINE: Pt[] = (() => {
  const out: Pt[] = [];
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n;
    // A pile: peaked, its slopes lumpy with small clumps of ash.
    const bump = 1 + 0.06 * Math.sin(u * 9 + 1) + 0.05 * Math.abs(Math.sin(u * 23 + 2)) + 0.035 * Math.abs(Math.sin(u * 47));
    const shape = (1 - Math.abs(u)) ** 1.2 * 0.75 + (1 - u * u) ** 1.6 * 0.25;
    out.push({ x: u * HW, y: -HH * shape * bump - 6 * Math.abs(Math.sin(u * 61)) * (1 - u * u) });
  }
  for (let i = n; i >= 0; i--) {
    const u = -1 + (2 * i) / n;
    out.push({ x: u * HW, y: 20 * (1 - u * u) });
  }
  return out;
})();

export interface HeapAt { x: number; y: number; s: number }

const place = (h: HeapAt, q: Pt, dx = 0, dy = 0, k = 1): Pt => ({ x: h.x + (q.x * k + dx) * h.s, y: h.y + (q.y * k + dy) * h.s });

/** The top of the heap (where the ember sits and the sprout grows). */
export const heapTop = (h: HeapAt): Pt => ({ x: h.x, y: h.y - HH * h.s + 8 * h.s });

export function heapPath(ctx: Ctx, h: HeapAt) {
  smoothPath(ctx, OUTLINE.map((q) => place(h, q)));
}

/**
 * The heap on paper (flat): a soft ground shadow, the grey mound in three cel tones with dots in the shade, layer lines,
 * the charred logs of the pyre, the ink outline. `heat` (0 to 1) warms its inside towards the burst with orange dots.
 */
export function heapFlat(ctx: Ctx, h: HeapAt, heat = 0, cool = false) {
  const s = h.s;
  // The shadow on the paper.
  ctx.fillStyle = 'rgba(70,62,55,0.22)';
  ctx.beginPath();
  ctx.ellipse(h.x + 30 * s, h.y + 10 * s, 440 * s, 36 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  halftone(ctx, 'rgba(70,62,55,0.35)', 9, (x, y) => 0.75 - Math.hypot((x - h.x - 60 * s) / (420 * s), (y - h.y - 12 * s) / (30 * s)),
    { x: h.x - 420 * s, y: h.y - 30 * s, w: 900 * s, h: 80 * s });
  // The charred logs of the pyre, buried in it, poking out.
  log(ctx, place(h, { x: -60, y: -60 }), -2.62, 360 * s, 24 * s, cool);
  log(ctx, place(h, { x: 70, y: -70 }), -0.42, 330 * s, 22 * s, cool);
  const main = cool ? '#a29b93' : '#8e8881', light = cool ? '#c9c3bb' : '#b7b1a9', shade = cool ? '#79726b' : '#635d57';
  heapPath(ctx, h);
  ctx.fillStyle = main;
  ctx.fill();
  ctx.save();
  heapPath(ctx, h);
  ctx.clip();
  // The light: a band down the upper left slope.
  const ridge = OUTLINE.slice(4, 38);
  const band = [...ridge.map((q) => place(h, q)), ...ridge.slice().reverse().map((q, i) => place(h, { x: q.x + 46 + 10 * Math.sin(i * 0.7), y: q.y + 70 }))];
  smoothPath(ctx, band);
  ctx.fillStyle = light;
  ctx.fill();
  // The shade: the heap less a copy shifted up and left.
  ctx.beginPath();
  ctx.rect(h.x - 600 * s, h.y - 400 * s, 1200 * s, 600 * s);
  const sh = OUTLINE.map((q) => place(h, q, -42, -34, 1));
  ctx.moveTo(sh[0].x, sh[0].y);
  for (const q of sh) ctx.lineTo(q.x, q.y);
  ctx.closePath();
  ctx.fillStyle = shade;
  ctx.fill('evenodd');
  halftone(ctx, rgba('#3e3935', 0.55), 10 * s, (x, y) => 0.15 + ((x - h.x) / (HW * s)) * 0.45 + ((y - h.y + 60 * s) / (120 * s)) * 0.35,
    { x: h.x - HW * s, y: h.y - HH * s, w: HW * 2 * s, h: (HH + 24) * s });
  // Layer lines in the ash.
  ctx.strokeStyle = rgba('#4a4540', 0.7);
  ctx.lineWidth = 2.6 * s;
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1, bow] of [[-300, -40, -120, -110, -16], [-80, -170, 90, -150, -10], [40, -60, 260, -70, -14], [-200, -10, -20, -40, -8], [130, -150, 250, -110, -8]]) {
    const a = place(h, { x: x0, y: y0 }), b = place(h, { x: x1, y: y1 });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + bow * s, b.x, b.y);
    ctx.stroke();
  }
  // Heat inside: orange dots, thickest near the top.
  if (heat > 0) {
    const top = heapTop(h);
    halftone(ctx, rgba('#e8641e', 0.9), 12 * s, (x, y) => heat * 1.5 - Math.hypot(x - top.x, (y - top.y) * 1.4) / (300 * s) * (1.2 - heat * 0.5),
      { x: h.x - HW * s, y: h.y - HH * s, w: HW * 2 * s, h: (HH + 24) * s });
  }
  ctx.restore();
  // Clumps of ash on the slopes: small rounded lumps with a light top.
  const r = rng(4141);
  for (let i = 0; i < 26; i++) {
    const u = r.range(-0.8, 0.8);
    const q = OUTLINE[Math.round((u + 1) * 32)];
    const at = place(h, { x: q.x + r.range(-10, 10), y: q.y * r.range(0.25, 0.9) + 8 });
    const rr = r.range(7, 16) * s;
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(at.x + rr * 0.25, at.y + rr * 0.2, rr * 1.3, rr * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = r.next() < 0.5 ? light : main;
    ctx.beginPath();
    ctx.ellipse(at.x, at.y, rr * 1.15, rr * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // A log lying in front, half sunk in the ash.
  log(ctx, place(h, { x: 120, y: 14 }), -0.12, 300 * s, 22 * s, cool);
  heapPath(ctx, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5 * s;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** A charred log: a dark tapering bar in two tones, cracked across like scales, its end broken off (flat). */
function log(ctx: Ctx, at: Pt, ang: number, len: number, w: number, cool: boolean) {
  const r = rng(Math.round(at.x * 7 + at.y));
  const end = { x: at.x + Math.cos(ang) * len, y: at.y + Math.sin(ang) * len };
  const pts = Array.from({ length: 7 }, (_, i) => ({ x: lerp(at.x, end.x, i / 6), y: lerp(at.y, end.y, i / 6) }));
  const wAt = (i: number) => w * (1 - 0.22 * (i / 6)) * (1 + 0.06 * Math.sin(i * 2.1 + at.x));
  const e = ribbonEdges(pts, wAt);
  ctx.save();
  ctx.lineJoin = 'round';
  edgePath(ctx, e.left, e.right);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = cool ? '#3a332e' : '#2a2420';
  ctx.fill();
  ctx.fillStyle = cool ? '#5a514a' : '#463d36';
  const half = ribbonEdges(pts, (i) => -wAt(i) * 0.15, (i) => wAt(i) * 0.85);
  edgePath(ctx, half.left, half.right);
  ctx.fill();
  // Cracks across the charcoal, unevenly spaced, some only part way.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  let u = r.range(0.06, 0.12);
  while (u < 0.9) {
    const c = { x: lerp(at.x, end.x, u), y: lerp(at.y, end.y, u) };
    const ww = w * (1 - 0.22 * u);
    const reach = r.range(0.2, 1);
    const bow = r.range(4, 12);
    ctx.beginPath();
    ctx.moveTo(c.x - nx * ww, c.y - ny * ww);
    ctx.quadraticCurveTo(c.x + Math.cos(ang) * bow, c.y + Math.sin(ang) * bow, c.x + nx * ww * (reach * 1.2 - 1), c.y + ny * ww * (reach * 1.2 - 1));
    ctx.stroke();
    u += r.range(0.07, 0.15);
  }
  // The broken end: a ragged face with its rings.
  const we = w * 0.78;
  const face = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2, rr = r.range(0.75, 1.1);
    const lx = Math.cos(a) * we * 0.5 * rr, ly = Math.sin(a) * we * rr;
    return { x: end.x + Math.cos(ang) * lx - Math.sin(ang) * ly, y: end.y + Math.sin(ang) * lx + Math.cos(ang) * ly };
  });
  polyPath(ctx, face);
  ctx.fillStyle = cool ? '#6d645c' : '#57483f';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(end.x, end.y, we * 0.25, we * 0.5, ang, 0, Math.PI * 2);
  ctx.strokeStyle = cool ? '#4a423c' : '#8a3a1c';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

/** The ember on the heap's top: a dark coal with a split of orange (flat). */
export function emberFlat(ctx: Ctx, at: Pt, b: number) {
  ctx.fillStyle = INK;
  smoothPath(ctx, [[-24, 2], [-14, -15], [6, -18], [24, -6], [20, 9], [-4, 12]].map(([x, y]) => ({ x: at.x + x * 1.6, y: at.y + y * 1.6 })));
  ctx.fill();
  ctx.fillStyle = `rgb(${Math.round(lerp(150, 255, b))},${Math.round(lerp(40, 130, b))},${Math.round(lerp(20, 40, b))})`;
  smoothPath(ctx, [[-12, -2], [-4, -10], [10, -9], [14, -2], [2, 3]].map(([x, y]) => ({ x: at.x + x * 1.6, y: at.y + y * 1.6 })));
  ctx.fill();
}

/** The ember's light (glow): a small hot core that breathes; `b` 0 to 1 is the breath, `k` how bright overall. */
export function emberGlow(ctx: Ctx, at: Pt, b: number, k: number) {
  const R = (22 + 26 * b) * (0.6 + 0.4 * k);
  const g = ctx.createRadialGradient(at.x, at.y - 4, 0, at.x, at.y - 4, R * 2.2);
  g.addColorStop(0, rgba('#fff6dc', clamp(0.55 + 0.45 * b) * k));
  g.addColorStop(0.18, rgba('#ffb040', 0.85 * k));
  g.addColorStop(0.5, rgba('#ff5a14', 0.3 * k * (0.5 + 0.5 * b)));
  g.addColorStop(1, rgba('#ff3a0a', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(at.x, at.y - 4, R * 2.2, 0, Math.PI * 2);
  ctx.fill();
}

/** Warm halftone rings round the ember on the paper (flat): its breath made visible. */
export function heatRings(ctx: Ctx, at: Pt, b: number, k: number) {
  if (k <= 0) return;
  const R = 150 + 120 * b;
  halftone(ctx, rgba('#e2702a', 0.75 * k), 11, (x, y) => {
    const d = Math.hypot(x - at.x, (y - at.y) * 1.25) / R;
    return d < 1 ? (1 - d) * 0.9 * k : 0;
  }, { x: at.x - R, y: at.y - R, w: R * 2, h: R * 1.6 });
}

/** A crack: one straight piece, how far from the ember it starts, and how deep in the branching it is. */
interface Crack { a: Pt; b: Pt; d: number; depth: number }

/** The cracks that run out of the ember through the heap (in heap units, from the top), made once. */
const CRACKS: Crack[] = (() => {
  const r = rng(1717);
  const out: Crack[] = [];
  const grow = (p: Pt, ang: number, d: number, depth: number, left: number) => {
    let x = p.x, y = p.y, a = ang, dist = d;
    const steps = Math.round(r.range(5, 9) * (1 - depth * 0.25));
    for (let i = 0; i < steps && left > 0; i++) {
      const len = r.range(18, 34) * (1 - depth * 0.2);
      a += r.range(-0.45, 0.45);
      // Pulled downward (cracks run down the slope).
      a += (Math.PI / 2 - a) * 0.1;
      const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
      out.push({ a: { x, y }, b: { x: nx, y: ny }, d: dist, depth });
      dist += len;
      x = nx; y = ny;
      if (depth < 2 && r.next() < 0.3) grow({ x, y }, a + r.sign() * r.range(0.5, 1.0), dist, depth + 1, left - 1);
    }
  };
  for (let i = 0; i < 9; i++) {
    const ang = lerp(0.08, Math.PI - 0.08, i / 8) + r.range(-0.12, 0.12);
    grow({ x: 0, y: 0 }, ang, 0, 0, 4);
  }
  return out;
})();

/**
 * The cracks grown to `g` (distance from the ember) on the heap: dark splits in the ash (flat) with light along them
 * (glow). Clipped to the heap.
 */
export function cracks(flat: Ctx, glow: Ctx, h: HeapAt, g: number, light: number) {
  if (g <= 0) return;
  const top = heapTop(h);
  const s = h.s;
  for (const [ctx, color, w, a] of [[flat, INK, 7, 1], [glow, '#ff6a1c', 6, 0.85 * light], [glow, '#ffe2a0', 2.2, light]] as const) {
    if (a <= 0) continue;
    ctx.save();
    heapPath(ctx, h);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(color, a);
    for (const c of CRACKS) {
      if (c.d > g) continue;
      const len = Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y);
      const k = clamp((g - c.d) / len);
      ctx.lineWidth = w * s * (1 - c.depth * 0.28) * (1 - 0.5 * clamp(c.d / 380));
      ctx.beginPath();
      ctx.moveTo(top.x + c.a.x * s, top.y + c.a.y * s);
      ctx.lineTo(top.x + (c.a.x + (c.b.x - c.a.x) * k) * s, top.y + (c.a.y + (c.b.y - c.a.y) * k) * s);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** The black bursting out of the heap: a spiky star growing from it over `k` (flat). Calls `inside` clipped to it. */
export function blackBurst(ctx: Ctx, c: Pt, k: number, t: number, inside: (ctx: Ctx) => void) {
  if (k <= 0) return;
  const r = rng(Math.floor(t * 30) + 11);
  const R = lerp(40, 2600, k);
  ctx.save();
  ctx.beginPath();
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = R * (i % 2 ? r.range(0.45, 0.7) : r.range(0.95, 1.15));
    const x = c.x + Math.cos(a) * rr * 1.2, y = c.y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.clip();
  inside(ctx);
  ctx.restore();
}

/** One piece of ash thrown out by the burst. */
interface Chunk { x: number; y: number; vx: number; vy: number; spin: number; size: number; pts: Pt[]; hot: boolean; tone: number }

const CHUNKS: Chunk[] = (() => {
  const r = rng(3131);
  return Array.from({ length: 64 }, () => {
    const a = -Math.PI / 2 + r.range(-1.45, 1.45);
    const sp = r.range(500, 1700);
    const size = r.next() < 0.85 ? r.range(6, 18) : r.range(22, 34);
    const n = 5 + Math.floor(r.next() * 3);
    const pts = Array.from({ length: n }, (_, i) => {
      const aa = (i / n) * Math.PI * 2 + r.range(-0.3, 0.3), rr = r.range(0.55, 1);
      return { x: Math.cos(aa) * rr, y: Math.sin(aa) * rr };
    });
    return { x: r.range(-300, 300), y: r.range(-200, 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: r.range(-8, 8), size, pts, hot: r.next() < 0.45, tone: r.next() };
  });
})();

/** The ash thrown out of the heap, `age` seconds after the burst: grey flakes (flat) with burning edges (glow). */
export function ashChunks(flat: Ctx, glow: Ctx, age: number, k: number) {
  if (age < 0 || k <= 0) return;
  for (const c of CHUNKS) {
    const x = HEAP.x + c.x + c.vx * age * (1 - 0.25 * age), y = HEAP.y - 100 + c.y + c.vy * age + 900 * age * age;
    if (y > 1200 || x < -100 || x > 2020) continue;
    const s = c.size * (1 - 0.35 * clamp(age / 1.6));
    const a = c.spin * age;
    const pts = c.pts.map((q) => ({ x: x + (q.x * Math.cos(a) - q.y * Math.sin(a)) * s, y: y + (q.x * Math.sin(a) + q.y * Math.cos(a)) * s }));
    flat.fillStyle = rgba(c.tone < 0.5 ? '#4f4a46' : '#7a746d', k);
    polyPath(flat, pts);
    flat.fill();
    if (c.hot) {
      glow.strokeStyle = rgba('#ff8a2a', 0.8 * k * (1 - clamp(age / 1.4)));
      glow.lineWidth = 2.5;
      polyPath(glow, pts);
      glow.stroke();
    }
  }
}

/** Fine grey ash flakes drifting on the paper (flat): they rise slowly, sway, and loop. */
export function ashMotes(ctx: Ctx, t: number, k: number, seed: number, count: number, colors = ['#8a847d', '#6e6862', '#b0aaa2']) {
  if (k <= 0) return;
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x0 = r.range(0, 1920), sp = r.range(18, 50), off = r.range(0, 1200), sw = r.range(10, 40), ph = r.range(0, 6.28);
    const size = r.range(2, 5.5);
    const y = 1120 - ((t * sp + off) % 1200);
    const x = x0 + Math.sin(t * 0.8 + ph) * sw;
    const c = r.pick(colors);
    ctx.fillStyle = rgba(c, 0.8 * k);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.6 + ph);
    ctx.fillRect(-size, -size * 0.45, size * 2, size * 0.9);
    ctx.restore();
  }
}

/** The green sprout growing out of the heap's top over `k`, its two slim leaves opening over `leaf` (flat). */
export function sprout(ctx: Ctx, base: Pt, k: number, leaf: number, t: number) {
  if (k <= 0) return;
  const H = 125 * k;
  const sway = 0.04 * Math.sin(t * 1.6);
  const tip = { x: base.x + 8 * k + Math.sin(sway) * H, y: base.y - H };
  const stem: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    stem.push({ x: lerp(base.x, tip.x, u) + Math.sin(u * Math.PI) * -14 * k, y: lerp(base.y, tip.y, u) });
  }
  const e = ribbonEdges(stem, (i) => lerp(4.2, 2.4, i / 14));
  ctx.lineJoin = 'round';
  edgePath(ctx, e.left, e.right);
  ctx.strokeStyle = '#22331a';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.fillStyle = '#5c8f3e';
  ctx.fill();
  if (leaf <= 0) return;
  for (const [ang, len, curl] of [[-2.7, 96, 0.75], [-0.42, 112, -0.8]] as const) {
    const sp = curlSpine(tip, ang + sway, len * leaf, curl * leaf, 16);
    const n = sp.length - 1;
    // Slim and pointed: widest a third of the way out.
    const w = (j: number) => 12 * leaf * Math.sin(Math.PI * (j / n) ** 0.7) ** 1.1;
    const le = ribbonEdges(sp, w);
    edgePath(ctx, le.left, le.right);
    ctx.strokeStyle = '#22331a';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.fillStyle = '#5f9442';
    ctx.fill();
    // The light half of the leaf, and its vein.
    ctx.fillStyle = '#98bd6a';
    edgePath(ctx, le.left.slice(1, n), sp.slice(1, n));
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    for (let j = 1; j < n - 1; j++) ctx.lineTo(sp[j].x, sp[j].y);
    ctx.strokeStyle = '#2f4f22';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

/**
 * The golden feather (flat): quill at `at`, pointing along `ang`. A long slim vane, gold at the base running to flame
 * orange and a crimson point, cel-shaded, with its barbs, one split in the edge and soft down at the base.
 */
export function goldFeather(ctx: Ctx, at: Pt, ang: number, len: number, bend = 0.22) {
  const quill = { x: at.x + Math.cos(ang) * len * 0.1, y: at.y + Math.sin(ang) * len * 0.1 };
  const sp = curlSpine(quill, ang, len * 0.9, bend, 22);
  const n = sp.length - 1;
  const prof = (j: number) => {
    const u = j / n;
    return 27 * Math.max(0.1 * (1 - u), Math.sin(Math.PI * u ** 0.62) ** 0.65);
  };
  const split = (j: number) => (Math.abs(j / n - 0.58) < 0.03 ? 0.35 : 1);
  const e = ribbonEdges(sp, (j) => prof(j) * split(j), (j) => prof(j) * 0.8);
  const lp = (a: Pt, b: Pt, k: number) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Soft down at the base: loose curling strands.
  ctx.strokeStyle = '#e8b85a';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const b = sp[1 + (i % 3)];
    const side = i % 2 ? 1 : -1;
    const a = ang + side * (1.2 + 0.15 * i);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x + Math.cos(a) * 22, b.y + Math.sin(a) * 22, b.x + Math.cos(a + side * 0.9) * 30 + Math.cos(ang) * 12, b.y + Math.sin(a + side * 0.9) * 30 + Math.sin(ang) * 12);
    ctx.stroke();
  }
  // The bare quill.
  ctx.strokeStyle = '#3a1c06';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(at.x, at.y);
  ctx.lineTo(sp[2].x, sp[2].y);
  ctx.stroke();
  ctx.strokeStyle = '#f6d58a';
  ctx.lineWidth = 4;
  ctx.stroke();
  edgePath(ctx, e.left, e.right);
  ctx.strokeStyle = '#3a1c06';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#f2b232';
  ctx.fill();
  ctx.save();
  edgePath(ctx, e.left, e.right);
  ctx.clip();
  // Towards the tip it runs to flame orange, then a crimson point.
  for (const [u0, color] of [[0.62, '#ee7a22'], [0.86, '#c8281c']] as const) {
    const j0 = Math.round(n * u0);
    const a = sp[j0], b = sp[j0 + 1];
    const d = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(a.x + Math.cos(d) * 400, a.y + Math.sin(d) * 400, 400, 200, d, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // The shaded half and the light half.
  ctx.fillStyle = rgba('#8a3a0c', 0.35);
  edgePath(ctx, e.left.map((q, j) => lp(sp[j], q, 0.9)), sp);
  ctx.fill();
  ctx.fillStyle = rgba('#fff2b0', 0.75);
  edgePath(ctx, e.right.slice(1, n - 1).map((q, j) => lp(sp[j + 1], q, 0.8)), e.right.slice(1, n - 1).map((q, j) => lp(sp[j + 1], q, 0.3)));
  ctx.fill();
  // Barbs: fine lines slanting towards the tip.
  ctx.strokeStyle = rgba('#7a3a0c', 0.55);
  ctx.lineWidth = 1.5;
  for (let j = 2; j < n - 1; j++) {
    for (const edge of [e.left, e.right]) {
      const q = edge[Math.min(n, j + 2)];
      ctx.beginPath();
      ctx.moveTo(sp[j].x, sp[j].y);
      ctx.lineTo(lerp(sp[j].x, q.x, 0.9), lerp(sp[j].y, q.y, 0.9));
      ctx.stroke();
    }
  }
  // The rachis.
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  for (let j = 1; j < n - 1; j++) ctx.lineTo(sp[j].x, sp[j].y);
  ctx.strokeStyle = '#fbe6a8';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#8a4a10';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
