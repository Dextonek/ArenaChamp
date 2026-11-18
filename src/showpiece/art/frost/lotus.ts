import { clamp, easeOutBack, lerp, rgba, seg, type Ctx, type Pt } from '../../core';

/**
 * Frost Lotus's figures: the lotus of ice (petals as faceted crystals, cel-shaded, with navy outlines), the ice pad it
 * sits on, the snowflake mandalas that turn behind it and the ring of ice blades. The bodies go on the flat layer; their
 * light (rims, veins, the core) on the glow layer; the cutouts punch their silhouettes out of the glow layer, so a glow
 * drawn behind them (the mandalas) stays behind.
 */

export const NAVY = '#0a1636';
export const CYAN = '#7fe6ff';

/** Where the lotus stands: the middle of its base. */
export const LOTUS: Pt = { x: 960, y: 770 };
/** Its glowing core, in the cup. */
export const CORE: Pt = { x: 960, y: 600 };

interface PetalDef {
  /** Open angle from straight up, radians. */
  angle: number;
  len: number;
  /** Half its width, as a part of its length. */
  wide: number;
  /** Row: 0 the low sepals, 1 back, 2 middle, 3 front. */
  row: number;
  /** When it opens, seconds after the opening starts. */
  delay: number;
}

const ROWS = [
  // radius of the ring the row stands on, its base's height above LOTUS, its colours (light, mid-light, mid, shadow)
  { ring: 60, lift: -6, tint: ['#b9daf0', '#7fb0dc', '#4f82bd', '#24447e'] },
  { ring: 70, lift: 28, tint: ['#cfe9f8', '#93c4e6', '#5e95c9', '#2a4f8a'] },
  { ring: 56, lift: 14, tint: ['#e3f4fd', '#aad6f0', '#73aedb', '#36659f'] },
  { ring: 40, lift: -4, tint: ['#f8fdff', '#c8ecfb', '#8fcbea', '#5866ad'] },
];

/** Every petal, in drawing order (back first). */
export const PETALS: PetalDef[] = (() => {
  const out: PetalDef[] = [];
  const add = (row: number, angles: number[], len: number, wide: number) => {
    for (const a of angles) for (const s of a === 0 ? [1] : [-1, 1]) out.push({ angle: a * s, len, wide, row, delay: 0 });
  };
  add(0, [1.72, 1.42], 240, 0.3);
  add(1, [1.16, 0.82, 0.47], 380, 0.32);
  add(2, [0.96, 0.6, 0.25], 345, 0.34);
  add(3, [0.7, 0.35, 0], 285, 0.37);
  // Petal by petal: each row from the outside in, the rows one after the other.
  const order = [...out].sort((a, b) => a.row - b.row || Math.abs(b.angle) - Math.abs(a.angle) || a.angle - b.angle);
  order.forEach((p, i) => { p.delay = i * 0.105; });
  // Draw from the back: rows in order, and within a row the outer ones first.
  return out.sort((a, b) => a.row - b.row || Math.abs(b.angle) - Math.abs(a.angle));
})();

/** How open each petal is at time `t` when the opening starts at `t0` (0 a bud, 1 open), with a little overshoot. */
export function petalOpen(p: PetalDef, t: number, t0: number) {
  return easeOutBack(seg(t, t0 + p.delay, t0 + p.delay + 0.62), 1.4);
}

interface PetalPose { base: Pt; angle: number; len: number; half: number; tint: string[]; row: number }

/**
 * The closed bud, designed as its own pose: one broad front petal, the two beside it peeking out as shoulders, the
 * middle and back rows shrunk down behind them, and the sepals cupping the base. (`turn` scales the open angle.)
 */
function closedPose(p: PetalDef) {
  switch (p.row) {
    case 0: return { turn: 0.5, len: 0.6, wide: 0.62 };
    case 1: return { turn: 0.1, len: 0.56, wide: 0.55 };
    case 2: return { turn: 0.2, len: 0.84, wide: 0.5 };
    default: return p.angle === 0 ? { turn: 0, len: 1.1, wide: 0.74 } : { turn: 0.42, len: 0.98, wide: 0.6 };
  }
}

/** Where a petal is for an openness `k` (0 the closed bud, 1 the open flower) and a size `scale`. */
function pose(p: PetalDef, k: number, at: Pt, scale: number): PetalPose {
  const row = ROWS[p.row];
  const c = closedPose(p);
  const angle = lerp(p.angle * c.turn, p.angle, k);
  const ring = row.ring * lerp(0.25, 1, clamp(k));
  // The rows stand on rings seen from a little above: across is wide, depth is squashed.
  const base = { x: at.x + Math.sin(angle) * ring * scale, y: at.y - (row.lift + Math.cos(angle) * ring * 0.18) * scale };
  const len = p.len * scale * lerp(c.len, 1, clamp(k));
  const half = p.len * p.wide * scale * lerp(c.wide, 1, clamp(k));
  return { base, angle, len, half, tint: row.tint, row: p.row };
}

/** The petal's outline in its own frame (pointing up, -y): a broad leaf with a pointed tip. */
function petalPath(ctx: Ctx, L: number, w: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * 1.25, -L * 0.12, -w * 1.18, -L * 0.62, 0, -L);
  ctx.bezierCurveTo(w * 1.18, -L * 0.62, w * 1.25, -L * 0.12, 0, 0);
  ctx.closePath();
}

function poly(ctx: Ctx, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** One petal on the flat layer: four facets inside a curved outline, a glint, and a navy outline. */
function petalFlat(ctx: Ctx, q: PetalPose, frost = 0) {
  const L = q.len, w = q.half;
  ctx.save();
  ctx.translate(q.base.x, q.base.y);
  ctx.rotate(q.angle);
  petalPath(ctx, L, w);
  ctx.save();
  ctx.clip();
  const M: [number, number] = [w * 0.08, -L * 0.52];
  const T: [number, number] = [0, -L];
  const [light, midLight, mid, shadow] = q.tint;
  const facets: [[number, number][], string][] = [
    [[[0, L * 0.1], [-2 * w, L * 0.1], [-2 * w, -L * 0.36], M], midLight],
    [[M, [-2 * w, -L * 0.36], [-2 * w, -L * 1.1], T], light],
    [[M, T, [2 * w, -L * 1.1], [2 * w, -L * 0.5]], mid],
    [[M, [2 * w, -L * 0.5], [2 * w, L * 0.1], [0, L * 0.1]], shadow],
  ];
  for (const [pts, c] of facets) {
    poly(ctx, pts);
    ctx.fillStyle = c;
    ctx.fill();
  }
  // A thin glint facet on the lit side, and a darker vein at the root.
  poly(ctx, [T, [-w * 0.62, -L * 0.6], [-w * 0.3, -L * 0.56]]);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  poly(ctx, [[0, 0], [w * 0.5, -L * 0.18], M, [-w * 0.25, -L * 0.2]]);
  ctx.fillStyle = rgba('#1d3d78', 0.35);
  ctx.fill();
  if (frost > 0) {
    ctx.fillStyle = rgba('#ffffff', 0.55 * frost);
    ctx.fillRect(-2 * w, -L * 1.1, 4 * w, L * 1.3);
  }
  ctx.restore();
  // Facet lines, then the outline.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(M[0], M[1]); ctx.lineTo(T[0], T[1]);
  ctx.moveTo(-w * 1.0, -L * 0.37); ctx.lineTo(M[0], M[1]); ctx.lineTo(w * 1.0, -L * 0.48);
  ctx.strokeStyle = rgba(NAVY, 0.5);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  petalPath(ctx, L, w);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 4.5;
  ctx.stroke();
  ctx.restore();
}

/** One petal's light on the glow layer: a rim along its lit edge, and a vein up the ridge. */
function petalGlow(ctx: Ctx, q: PetalPose, rim: number, vein: number) {
  const L = q.len, w = q.half;
  ctx.save();
  ctx.translate(q.base.x, q.base.y);
  ctx.rotate(q.angle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (rim > 0) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, -L * 0.1);
    ctx.bezierCurveTo(-w * 1.16, -L * 0.3, -w * 1.1, -L * 0.66, 0, -L);
    ctx.strokeStyle = rgba('#bff4ff', 0.75 * rim);
    ctx.lineWidth = 3.2;
    ctx.stroke();
  }
  if (vein > 0) {
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.04);
    ctx.lineTo(w * 0.08, -L * 0.52);
    ctx.lineTo(0, -L * 0.86);
    ctx.strokeStyle = rgba(CYAN, 0.5 * vein);
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.85 * vein);
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
  ctx.restore();
}

export interface LotusState {
  /** The time and when the opening started (petals open one by one from then); or `open` alone for all petals. */
  t?: number;
  t0?: number;
  open?: number;
  at?: Pt;
  scale?: number;
  /** A white rime over every petal (frozen), 0 to 1. */
  frost?: number;
}

function poses(s: LotusState): PetalPose[] {
  const at = s.at ?? LOTUS, scale = s.scale ?? 1;
  return PETALS.map((p) => {
    const k = s.open !== undefined ? s.open : petalOpen(p, s.t ?? 0, s.t0 ?? 0);
    return pose(p, k, at, scale);
  });
}

/** The ice pad under the lotus (flat): a faceted disc seen from above, with a halftone-free soft shadow on `ground`. */
export function icePad(ctx: Ctx, at: Pt = LOTUS, scale = 1, onPaper = true) {
  const rx = 300 * scale, ry = 56 * scale, depth = 26 * scale;
  const cx = at.x, cy = at.y + 24 * scale;
  // The shadow it throws.
  ctx.beginPath();
  ctx.ellipse(cx + 26 * scale, cy + depth + 18 * scale, rx * 1.08, ry * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = onPaper ? 'rgba(40,60,100,0.16)' : 'rgba(0,0,0,0.35)';
  ctx.fill();
  // Its rim (the side), as a band of facets.
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
    const p0 = { x: cx + Math.cos(a0) * rx, y: cy + Math.sin(a0) * ry }, p1 = { x: cx + Math.cos(a1) * rx, y: cy + Math.sin(a1) * ry };
    poly(ctx, [[p0.x, p0.y], [p1.x, p1.y], [p1.x, p1.y + depth], [p0.x, p0.y + depth]]);
    ctx.fillStyle = i % 2 ? '#3f74ad' : '#5a90c6';
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // The top face: lit from the upper left, with a few cut lines out from the middle and an inner ring.
  const g = ctx.createLinearGradient(cx - rx * 0.6, cy - ry * 2, cx + rx * 0.5, cy + ry * 1.5);
  g.addColorStop(0, '#f2fbff');
  g.addColorStop(0.55, '#bfe2f6');
  g.addColorStop(1, '#7fb4dc');
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    ctx.moveTo(cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.55);
    ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  ctx.moveTo(cx + rx * 0.55, cy);
  ctx.ellipse(cx, cy, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.moveTo(cx - rx, cy);
  ctx.lineTo(cx - rx, cy + depth);
  ctx.ellipse(cx, cy + depth, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, cy);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 4;
  ctx.stroke();
}

/** The lotus as an ink impact frame: every petal solid in `fill`, edged in `edge` so the layers still read. */
export function lotusInk(ctx: Ctx, s: LotusState, fill: string, edge: string) {
  ctx.save();
  ctx.lineJoin = 'round';
  for (const q of poses(s)) {
    ctx.save();
    ctx.translate(q.base.x, q.base.y);
    ctx.rotate(q.angle);
    petalPath(ctx, q.len, q.half);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -q.len * 0.08);
    ctx.lineTo(q.half * 0.08, -q.len * 0.52);
    ctx.lineTo(0, -q.len * 0.9);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Punches the ice pad out of the glow layer. */
export function padCutout(ctx: Ctx, at: Pt = LOTUS, scale = 1) {
  const rx = 300 * scale, ry = 56 * scale, depth = 26 * scale, cx = at.x, cy = at.y + 24 * scale;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 2, ry + 2, 0, Math.PI, 0);
  ctx.lineTo(cx + rx + 2, cy + depth);
  ctx.ellipse(cx, cy + depth, rx + 2, ry + 2, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

/** The lotus's petals on the flat layer. */
export function lotusFlat(ctx: Ctx, s: LotusState) {
  for (const q of poses(s)) petalFlat(ctx, q, s.frost ?? 0);
}

/**
 * The lotus's light on the glow layer, petal by petal from the back: each petal first punches itself out of what is
 * already there (so a front petal hides the glow behind it), then lays down its own rim and vein. `core` is drawn between
 * the middle and the front row, so the front petals cover it.
 */
export function lotusLight(ctx: Ctx, s: LotusState, rim: number, vein: number, core?: () => void) {
  const qs = poses(s);
  let coreDone = !core;
  for (const q of qs) {
    if (!coreDone && q.row === 3) { core!(); coreDone = true; }
    cutPetal(ctx, q, q.row === 3 && core ? 0.88 : 1);
    petalGlow(ctx, q, rim * (q.row === 0 ? 0.5 : 1), vein * (q.row === 0 ? 0.3 : 1));
  }
  if (!coreDone) core!();
}

function cutPetal(ctx: Ctx, q: PetalPose, k: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${clamp(k)})`;
  ctx.translate(q.base.x, q.base.y);
  ctx.rotate(q.angle);
  petalPath(ctx, q.len * 1.01, q.half * 1.02);
  ctx.fill();
  ctx.restore();
}

/** The core: a white-hot seed of light in the cup with a cyan and lilac halo (glow). */
export function coreGlow(ctx: Ctx, at: Pt, k: number, t: number) {
  if (k <= 0) return;
  const R = 200 * k * (1 + 0.04 * Math.sin(t * 7));
  const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, R);
  g.addColorStop(0, rgba('#ffffff', clamp(k)));
  g.addColorStop(0.16, rgba('#d8fbff', 0.9 * k));
  g.addColorStop(0.42, rgba('#5fd2ff', 0.35 * k));
  g.addColorStop(0.75, rgba('#8f7ef0', 0.12 * k));
  g.addColorStop(1, rgba('#8f7ef0', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(at.x, at.y, R, 0, Math.PI * 2);
  ctx.fill();
  // A small four-pointed star.
  ctx.fillStyle = rgba('#ffffff', 0.9 * k);
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const L = 120 * k, w = 5 * k;
    ctx.beginPath();
    ctx.moveTo(at.x - dx * L, at.y - dy * L);
    ctx.lineTo(at.x + dy * w, at.y - dx * w);
    ctx.lineTo(at.x + dx * L, at.y + dy * L);
    ctx.lineTo(at.x - dy * w, at.y + dx * w);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * A snowflake mandala (glow): six arms with paired side branches, hexagon rings and a ring of small diamonds, drawn on
 * over `k` (arms grow from the middle) and turned by `rot`.
 */
export function mandala(ctx: Ctx, c: Pt, R: number, rot: number, k: number, color: string, alpha: number, width = 3) {
  if (k <= 0) return;
  const grow = clamp(k * 1.2);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(rot);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(color, alpha * clamp(k * 2));
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, ax = Math.cos(a), ay = Math.sin(a);
    const reach = R * grow;
    ctx.moveTo(ax * R * 0.12, ay * R * 0.12);
    ctx.lineTo(ax * reach, ay * reach);
    for (const [at, len] of [[0.32, 0.2], [0.55, 0.24], [0.76, 0.16], [0.9, 0.08]] as const) {
      if (at * R > reach) continue;
      const bl = len * R * clamp((reach - at * R) / (len * R));
      for (const s of [-1, 1]) {
        const b = a + s * (Math.PI / 3);
        ctx.moveTo(ax * at * R, ay * at * R);
        ctx.lineTo(ax * at * R + Math.cos(b) * bl, ay * at * R + Math.sin(b) * bl);
      }
    }
  }
  // Hexagon rings.
  for (const [rr, off] of [[0.22, 0], [0.44, Math.PI / 6], [0.66, 0]] as const) {
    if (rr > grow) continue;
    for (let i = 0; i <= 6; i++) {
      const a = off + (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * rr * R, y = Math.sin(a) * rr * R;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  // A thin outer circle and diamonds on it.
  if (grow >= 1) {
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.04, 0, Math.PI * 2);
    ctx.lineWidth = width * 0.5;
    ctx.stroke();
    ctx.fillStyle = rgba(color, alpha * clamp(k * 2));
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + Math.PI / 24, d = R * 1.04, s = i % 2 ? 7 : 12;
      ctx.save();
      ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
      ctx.rotate(a);
      poly(ctx, [[-s, 0], [0, -s * 0.45], [s, 0], [0, s * 0.45]]);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Blades in the ring. */
export const BLADES = 12;

export interface BladePose { x: number; y: number; angle: number; size: number }

/** One ice blade: a long faceted crystal pointing along `angle`, cel-shaded with a navy outline (flat). */
export function bladeFlat(ctx: Ctx, b: BladePose) {
  if (b.size <= 0.01) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  ctx.scale(b.size, b.size);
  const L = 120, back = 46, w = 17;
  const top: [number, number][] = [[-back, 0], [-back * 0.4, -w], [L * 0.3, -w * 0.7], [L, 0]];
  const bot: [number, number][] = [[-back, 0], [L, 0], [L * 0.3, w * 0.7], [-back * 0.4, w]];
  poly(ctx, top);
  ctx.fillStyle = '#eaf9ff';
  ctx.fill();
  poly(ctx, bot);
  ctx.fillStyle = '#5c93cc';
  ctx.fill();
  poly(ctx, [[-back * 0.4, -w], [L * 0.3, -w * 0.7], [L, 0], [L * 0.2, -w * 0.25]]);
  ctx.fillStyle = '#b5e2f7';
  ctx.fill();
  ctx.lineJoin = 'miter';
  poly(ctx, [[-back, 0], [-back * 0.4, -w], [L * 0.3, -w * 0.7], [L, 0], [L * 0.3, w * 0.7], [-back * 0.4, w]]);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();
}

export function bladeCutout(ctx: Ctx, b: BladePose) {
  if (b.size <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  ctx.scale(b.size, b.size);
  poly(ctx, [[-48, 0], [-19, -19], [36, -13], [124, 0], [36, 13], [-19, 19]]);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

/** A blade's light (glow): a white edge and a spark at its tip. */
export function bladeGlow(ctx: Ctx, b: BladePose, k: number) {
  if (b.size <= 0.01 || k <= 0) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  ctx.scale(b.size, b.size);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-18, -16);
  ctx.lineTo(36, -11);
  ctx.lineTo(118, 0);
  ctx.strokeStyle = rgba('#dffaff', 0.85 * k);
  ctx.lineWidth = 2.6;
  ctx.stroke();
  const g = ctx.createRadialGradient(120, 0, 0, 120, 0, 40);
  g.addColorStop(0, rgba('#ffffff', 0.9 * k));
  g.addColorStop(1, rgba(CYAN, 0));
  ctx.fillStyle = g;
  ctx.fillRect(80, -40, 80, 80);
  ctx.restore();
}
