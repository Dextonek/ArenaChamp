import { H, W, clamp, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { halftone, INK, SERIF, type TitleText } from '../paper';

/**
 * Frost Lotus's ground and weather: crystalline frost that grows across the frame (branches at sixty degrees, like a
 * snowflake's arms), the navy night that floods in as halftone dots, the frozen sheet of ice over everything, the cracks
 * and the shards it breaks into, mist, falling snow and the snow's halftone dusting on the paper. Also a blue copy of the
 * title card (the shared one has a red square and a red-brown stroke).
 */

// ---------------------------------------------------------------------------------------------------------------------
// Frost: branching crystal lines, grown from roots; a segment shows once the growth has reached its distance from the root.

export interface FrostSeg { ax: number; ay: number; bx: number; by: number; d0: number; d1: number; depth: number; taper: number }
export interface FrostRoot { x: number; y: number; angle: number; len: number }

/**
 * One branch: a nearly straight spine in short steps, with feathered side branches at sixty degrees (often in pairs, as
 * on a snowflake's arm), shorter towards its tip.
 */
function grow(r: ReturnType<typeof rng>, out: FrostSeg[], x: number, y: number, a: number, len: number, d0: number, depth: number, maxDepth: number) {
  const n = Math.max(2, Math.round(len / (depth ? 26 : 34)));
  const step = len / n;
  let px = x, py = y;
  for (let i = 0; i < n; i++) {
    a += r.range(-0.035, 0.035);
    const nx = px + Math.cos(a) * step, ny = py + Math.sin(a) * step;
    out.push({ ax: px, ay: py, bx: nx, by: ny, d0: d0 + i * step, d1: d0 + (i + 1) * step, depth, taper: 1 - i / n });
    if (depth < maxDepth && i > 0 && i < n - 1 && r.next() < (depth ? 0.55 : 0.75)) {
      const rest = len - i * step;
      const bl = Math.min(rest * r.range(0.22, 0.4), depth ? 60 : 200) * r.range(0.7, 1.1);
      const both = r.next() < 0.75, side = r.sign();
      grow(r, out, px, py, a + side * (Math.PI / 3), bl, d0 + i * step, depth + 1, maxDepth);
      if (both) grow(r, out, px, py, a - side * (Math.PI / 3), bl * r.range(0.8, 1), d0 + i * step, depth + 1, maxDepth);
    }
    px = nx; py = ny;
  }
}

export function frostTree(seed: number, roots: FrostRoot[], maxDepth = 3): FrostSeg[] {
  const r = rng(seed);
  const out: FrostSeg[] = [];
  for (const root of roots) grow(r, out, root.x, root.y, root.angle, root.len, 0, 0, maxDepth);
  return out;
}

/**
 * Draws the frost grown to distance `g` (from each root): one stroke per depth with `widths[depth]`, each branch thinning
 * towards its tip in three steps.
 */
export function frostDraw(ctx: Ctx, segs: FrostSeg[], g: number, widths: number[], color: string, alpha: number) {
  if (alpha <= 0 || g <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(color, alpha);
  for (let d = 0; d < widths.length; d++) {
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      for (const s of segs) {
        if (s.depth !== d || s.d0 >= g || Math.min(2, Math.floor((1 - s.taper) * 3)) !== b) continue;
        const k = clamp((g - s.d0) / (s.d1 - s.d0));
        ctx.moveTo(s.ax, s.ay);
        ctx.lineTo(lerp(s.ax, s.bx, k), lerp(s.ay, s.by, k));
      }
      ctx.lineWidth = widths[d] * (1 - b * 0.28);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The growing tips of the frost: small bright stars where the branches are still growing (glow). */
export function frostTips(ctx: Ctx, segs: FrostSeg[], g: number, k: number, maxDepth = 1) {
  if (k <= 0) return;
  ctx.fillStyle = rgba('#ffffff', k);
  ctx.beginPath();
  for (const s of segs) {
    if (s.depth > maxDepth || s.d0 >= g || s.d1 < g) continue;
    const u = clamp((g - s.d0) / (s.d1 - s.d0));
    const x = lerp(s.ax, s.bx, u), y = lerp(s.ay, s.by, u), r = s.depth ? 3 : 5;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

// ---------------------------------------------------------------------------------------------------------------------
// Sheets made once (they never depend on time): the night and the frozen ice.

let night: HTMLCanvasElement | null = null;
let frozen: HTMLCanvasElement | null = null;

/** The navy night: lighter in the middle, a fine dot screen growing towards it. */
function nightSheet() {
  if (night) return night;
  night = document.createElement('canvas');
  night.width = W;
  night.height = H;
  const c = night.getContext('2d')!;
  c.fillStyle = '#081231';
  c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(960, 600, 40, 960, 600, 1150);
  g.addColorStop(0, '#1d3b7a');
  g.addColorStop(0.45, '#0e2150');
  g.addColorStop(1, '#040a1c');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  halftone(c, 'rgba(70,120,200,0.22)', 13, (x, y) => 0.75 * (1 - Math.hypot(x - 960, (y - 600) * 1.3) / 900));
  return night;
}

export function nightGround(ctx: Ctx, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(nightSheet(), 0, 0, W, H);
  ctx.restore();
}

/** Where the world freezes from: the lotus's core. */
export const FREEZE_AT: Pt = { x: 960, y: 600 };

/** The frost that covers the whole frame when it freezes: long arms out from the core. */
export const FREEZE: FrostSeg[] = (() => {
  const r = rng(4242), roots: FrostRoot[] = [];
  for (let i = 0; i < 12; i++) roots.push({ x: FREEZE_AT.x, y: FREEZE_AT.y, angle: (i / 12) * Math.PI * 2 + r.range(-0.15, 0.15), len: r.range(1100, 1400) });
  return frostTree(77, roots, 2);
})();

/** The pale sheet of ice laid over the frozen frame: frosted glass with the freeze's branches and long glints. */
function frozenSheet() {
  if (frozen) return frozen;
  frozen = document.createElement('canvas');
  frozen.width = W;
  frozen.height = H;
  const c = frozen.getContext('2d')!;
  const g = c.createRadialGradient(960, 600, 60, 960, 600, 1150);
  g.addColorStop(0, '#e8f8ff');
  g.addColorStop(0.5, '#c2e6f8');
  g.addColorStop(1, '#84c2ea');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  halftone(c, 'rgba(70,140,205,0.35)', 12, (x, y) => (Math.hypot(x - 960, (y - 600) * 1.4) / 1000 - 0.35) * 0.9);
  frostDraw(c, FREEZE, 5000, [5, 2.6, 1.5], '#3f78b6', 0.6);
  // Long glints across the glass.
  c.fillStyle = 'rgba(255,255,255,0.5)';
  for (const [x0, w] of [[300, 90], [470, 26], [1250, 140], [1480, 30]] as const) {
    c.beginPath();
    c.moveTo(x0, -20);
    c.lineTo(x0 + w, -20);
    c.lineTo(x0 + w - 700, 1100);
    c.lineTo(x0 - 700, 1100);
    c.closePath();
    c.fill();
  }
  return frozen;
}

export function frozenGround(ctx: Ctx, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.drawImage(frozenSheet(), 0, 0, W, H);
  ctx.restore();
}

/** Makes both sheets now, so the first frame that needs them is not slow. */
export function warmSheets() {
  nightSheet();
  frozenSheet();
}

// ---------------------------------------------------------------------------------------------------------------------
// The night flooding in over the paper as halftone dots, from the frame's edges inwards.

const fieldA = wobble(301), fieldB = wobble(517);

function nightReach(x: number, y: number, p: number) {
  const fromEdge = Math.min(x + 60, W - x + 60, (y + 60) * 1.5, (H - y + 60) * 1.5) / 760;
  const n = 0.16 * fieldA(x * 0.007 + y * 0.003) + 0.1 * fieldB(y * 0.01 - x * 0.004);
  return clamp((p * 1.7 - (fromEdge + n)) * 3);
}

export function nightFlood(ctx: Ctx, p: number, draw: (ctx: Ctx) => void) {
  if (p <= 0) return;
  if (p >= 1) { draw(ctx); return; }
  ctx.save();
  ctx.beginPath();
  const cell = 20;
  for (let y = cell / 2; y < H + cell; y += cell) {
    const odd = Math.round(y / cell) % 2;
    for (let x = odd ? 0 : -cell / 2; x < W + cell; x += cell) {
      const s = nightReach(x, y, p);
      if (s < 0.04) continue;
      const r = cell * 0.76 * s;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.clip();
  draw(ctx);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------
// Mist and snow.

/** Cold mist breathed across the paper: a halftone cloud drifting right, with thin curling wisps (flat). */
export function mist(ctx: Ctx, t: number, k: number, at: Pt) {
  if (k <= 0) return;
  const lobes = [
    { dx: -380, dy: 40, rx: 360, ry: 110, v: 40 },
    { dx: -60, dy: 70, rx: 420, ry: 90, v: 55 },
    { dx: 300, dy: 20, rx: 330, ry: 100, v: 35 },
    { dx: -620, dy: -60, rx: 260, ry: 80, v: 60 },
  ];
  const w = wobble(66);
  halftone(ctx, rgba('#7fa6cc', 0.5), 12, (x, y) => {
    let s = 0;
    for (const l of lobes) {
      const cx = at.x + l.dx + l.v * t, cy = at.y + l.dy + 10 * Math.sin(t + l.dx);
      s = Math.max(s, 1 - ((x - cx) / l.rx) ** 2 - ((y - cy) / l.ry) ** 2);
    }
    return s * k * (0.75 + 0.25 * w(x * 0.01 + t * 0.5));
  }, { x: at.x - 1000, y: at.y - 200, w: 2000, h: 360 });
  // Wisps: thin curling strokes.
  const r = rng(707);
  for (let i = 0; i < 7; i++) {
    const y0 = at.y + r.range(-90, 120), x0 = at.x + r.range(-900, 200), len = r.range(320, 640), ph = r.range(0, 6), amp = r.range(10, 30);
    const pts: Pt[] = [];
    for (let j = 0; j <= 24; j++) {
      const u = j / 24, x = x0 + u * len + 70 * t;
      pts.push({ x, y: y0 + Math.sin(u * 5 + ph + t * 1.4) * amp - u * u * 30 });
    }
    ctx.fillStyle = rgba(i % 3 ? '#9dbcd9' : '#b6aee0', 0.55 * k);
    ribbon(ctx, pts, (u) => 5 * Math.sin(Math.PI * u) ** 0.7);
  }
}

/** Falling snow: dots, and some six-armed flakes; `t0` is when it starts falling (pure in t). */
export function snowfall(ctx: Ctx, t: number, k: number, seed: number, count: number, colors: string[], big = 1) {
  if (k <= 0) return;
  const r = rng(seed);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x0 = r.range(-60, W + 60), y0 = r.range(0, H + 120), v = r.range(40, 120), sway = r.range(10, 40), f = r.range(0.6, 1.4);
    const flake = r.next() < 0.3, size = (flake ? r.range(6, 13) : r.range(1.6, 4.5)) * big, spin = r.range(-1, 1);
    const color = r.pick(colors), a = k * r.range(0.6, 1);
    const y = ((y0 + v * t) % (H + 120)) - 60;
    const x = x0 + Math.sin(t * f + i) * sway - 25 * t;
    if (flake) {
      ctx.strokeStyle = rgba(color, a);
      ctx.lineWidth = Math.max(1.4, size * 0.2);
      ctx.beginPath();
      for (let j = 0; j < 3; j++) {
        const ang = spin * t + (j / 3) * Math.PI;
        ctx.moveTo(x - Math.cos(ang) * size, y - Math.sin(ang) * size);
        ctx.lineTo(x + Math.cos(ang) * size, y + Math.sin(ang) * size);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(color, a);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The snow's dusting on the paper: blue-grey halftone drifts along the bottom and a fine scatter (flat), `k` 0 to 1. */
export function snowDust(ctx: Ctx, k: number) {
  if (k <= 0) return;
  const w = wobble(919), w2 = wobble(313);
  halftone(ctx, rgba('#8aa6c6', 0.7), 14, (x, y) => {
    const drift = (y - 860 - 70 * w(x * 0.004) - 30 * w2(x * 0.013)) / 200;
    return clamp(drift) * 0.9 * k;
  }, { x: 0, y: 700, w: W, h: H - 700 });
  halftone(ctx, rgba('#a9bfd8', 0.6), 14, (x, y) => {
    const n = w(x * 0.006 + y * 0.009) + 0.6 * w2(y * 0.012 - x * 0.004);
    return (n - 0.75) * 1.6 * k;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Cracks and shards.

const RADII = [0, 150, 330, 560, 820, 1100, 1500];
const SPOKES = 13;

/** The crack network: vertices on rings round FREEZE_AT, shared by neighbouring shards. */
const VERTS: Pt[][] = (() => {
  const r = rng(1201);
  const base = Array.from({ length: SPOKES }, (_, i) => (i / SPOKES) * Math.PI * 2 + r.range(-0.12, 0.12));
  return RADII.map((R, j) => base.map((a) => {
    if (j === 0) return { ...FREEZE_AT };
    const aa = a + r.range(-0.16, 0.16), rr = R * r.range(0.86, 1.12);
    // Kept to the frame (and a little past it), so every shard carries a picture of its own.
    return { x: clamp(FREEZE_AT.x + Math.cos(aa) * rr * 1.15, -30, W + 30), y: clamp(FREEZE_AT.y + Math.sin(aa) * rr * 0.9, -30, H + 30) };
  }));
})();

export interface Shard { pts: Pt[]; c: Pt; ring: number; delay: number; out: Pt; speed: number; spin: number; tilt: number }

export const SHARDS: Shard[] = (() => {
  const r = rng(3301), out: Shard[] = [];
  const add = (pts: Pt[], ring: number) => {
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p.x * q.y - q.x * p.y; }
    if (Math.abs(area) < 400) return;
    const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    const dx = c.x - FREEZE_AT.x, dy = c.y - FREEZE_AT.y, l = Math.hypot(dx, dy) || 1;
    out.push({
      pts, c, ring, delay: ring * 0.05 + r.range(0, 0.12), out: { x: dx / l, y: dy / l },
      speed: r.range(150, 420), spin: r.range(1.2, 3.4) * r.sign(), tilt: r.range(0, 6.28),
    });
  };
  for (let j = 0; j < RADII.length - 1; j++) {
    for (let i = 0; i < SPOKES; i++) {
      const i2 = (i + 1) % SPOKES;
      const a = VERTS[j][i], b = VERTS[j][i2], c = VERTS[j + 1][i2], d = VERTS[j + 1][i];
      if (j === 0) add([a, c, d], j);
      else if (j >= 2 && r.next() < 0.5) {
        if (r.next() < 0.5) { add([a, b, c], j); add([a, c, d], j); } else { add([a, b, d], j); add([b, c, d], j); }
      } else add([a, b, c, d], j);
    }
  }
  return out;
})();

/** The crack lines grown out to radius `reach` from FREEZE_AT (one path; the caller strokes it). */
export function crackPath(ctx: Ctx, reach: number) {
  ctx.beginPath();
  const dist = (p: Pt) => Math.hypot((p.x - FREEZE_AT.x) / 1.15, (p.y - FREEZE_AT.y) / 0.9);
  const part = (a: Pt, b: Pt) => {
    const da = dist(a), db = dist(b);
    if (Math.min(da, db) >= reach) return;
    const [p, q, dp, dq] = da <= db ? [a, b, da, db] : [b, a, db, da];
    const k = dq > dp ? clamp((reach - dp) / (dq - dp)) : 1;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(lerp(p.x, q.x, k), lerp(p.y, q.y, k));
  };
  for (const s of SHARDS) for (let i = 0; i < s.pts.length; i++) part(s.pts[i], s.pts[(i + 1) % s.pts.length]);
}

/** Where a shard is at time `dt` after the shatter began: pushed out a little, then falling and turning. */
export function shardMotion(s: Shard, dt: number) {
  const d = Math.max(0, dt - s.delay);
  const pop = 10 * clamp(dt / 0.08) * (1 + s.ring * 0.4);
  return {
    x: s.out.x * (pop + s.speed * d),
    y: s.out.y * (pop + s.speed * d * 0.6) + 0.5 * 3600 * d * d,
    angle: s.spin * d,
    d,
  };
}

/** Whether any of a shard is on screen after its motion `m`. */
export function shardVisible(s: Shard, m: { x: number; y: number; angle: number }) {
  const cos = Math.cos(m.angle), sin = Math.sin(m.angle);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of s.pts) {
    const dx = p.x - s.c.x, dy = p.y - s.c.y;
    const x = s.c.x + m.x + dx * cos - dy * sin, y = s.c.y + m.y + dx * sin + dy * cos;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return x1 > -10 && x0 < W + 10 && y1 > -10 && y0 < H + 10;
}

export function shardPath(ctx: Ctx, s: Shard) {
  ctx.beginPath();
  ctx.moveTo(s.pts[0].x, s.pts[0].y);
  for (const p of s.pts) ctx.lineTo(p.x, p.y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------------------------------------------------
// The title card in blue (a copy of art/paper.ts's, with its square and stroke recoloured).

export function frostTitle(ctx: Ctx, k: number, dark: boolean, text: TitleText) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 74px ${SERIF}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText(text.kanji, 50, 110);
  ctx.strokeText(text.kanji, 44, 104);
  ctx.fillStyle = '#f7fbff';
  ctx.fillText(text.kanji, 44, 104);
  ctx.font = `800 26px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#cfe2f2' : '#1c2c4c';
  ctx.fillText(text.english, 46, 156);
  ctx.fillStyle = '#070b16';
  ctx.beginPath();
  ctx.moveTo(34, 176);
  ctx.lineTo(474, 172);
  ctx.lineTo(478, 186); ctx.lineTo(470, 190); ctx.lineTo(482, 240); ctx.lineTo(474, 268);
  ctx.lineTo(40, 272);
  ctx.lineTo(30, 252); ctx.lineTo(38, 236); ctx.lineTo(28, 200);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, 196, 0, 256);
  const [c0, c1, c2] = text.colors ?? ['#ffffff', '#7fe6ff', '#2a6cd8'];
  g.addColorStop(0, c0);
  g.addColorStop(0.45, c1);
  g.addColorStop(1, c2);
  ctx.font = `900 58px ${SERIF}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#06122e';
  ctx.strokeText(text.move, 64, 245);
  ctx.fillStyle = g;
  ctx.fillText(text.move, 64, 245);
  ['#5fd4ff', '#8c8a92', '#8c8a92', '#8c8a92'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(486 + i * 15, 268, 9, 9);
  });
  ctx.font = `700 17px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#8fa3b8' : '#4c5566';
  ctx.fillText(text.romaji, 48, 306);
  ctx.restore();
}
