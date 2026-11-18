import { clamp, lerp, rgba, type Ctx, type Pt } from '../../core';
import { C, edgePath, ribbonEdges } from './common';

/**
 * The fox-spirit of blue fire (a kyūbi, nine tails), seen from the front: a narrow face with tall ears and swept cheek
 * ruffs like a shrine fox's, slit eyes, a jewel-flame on the brow, tiers of flame fur at its throat, and nine tails of
 * fire fanned behind it like a lyre. Cel-shaded in mid teals with ink outlines (flat layer); its rims, markings, eyes and
 * the flames off its ears burn on the glow layer, each part cut out of the glow behind it so the layers stack properly.
 */

export interface FoxPose {
  /** The head's middle on screen, and the size of one unit in pixels. */
  x: number;
  y: number;
  s: number;
  /** How far it has formed: 0 nothing, 1 whole (the tails grow out, the head comes in). */
  form: number;
  /** The eyes, 0 shut to 1 open. */
  eyes: number;
  /** The tails' fan opened wider (0 to 1), for the rush. */
  spread: number;
  t: number;
}

/** The head's right half as quadratic curves from the crown: [control, end] in units, y down. Points only at the tips. */
const CROWN: Pt = { x: 0, y: -0.52 };
const HEAD_SEGS: [Pt, Pt][] = [
  [{ x: 0.17, y: -0.6 }, { x: 0.3, y: -0.7 }],
  [{ x: 0.52, y: -1.08 }, { x: 0.84, y: -1.76 }],
  [{ x: 1.12, y: -1.26 }, { x: 1.05, y: -0.5 }],
  [{ x: 1.1, y: -0.2 }, { x: 1.28, y: -0.06 }],
  [{ x: 1.56, y: 0.06 }, { x: 1.8, y: 0.32 }],
  [{ x: 1.42, y: 0.3 }, { x: 1.2, y: 0.42 }],
  [{ x: 1.46, y: 0.62 }, { x: 1.52, y: 0.84 }],
  [{ x: 1.2, y: 0.68 }, { x: 0.94, y: 0.72 }],
  [{ x: 0.62, y: 0.86 }, { x: 0.38, y: 1.26 }],
  [{ x: 0.2, y: 1.6 }, { x: 0, y: 1.74 }],
];
const EAR_IN: [Pt, Pt, Pt] = [{ x: 0.38, y: -0.74 }, { x: 0.8, y: -1.6 }, { x: 0.96, y: -0.6 }];

export type FoxPalette = typeof BASE;
const BASE = {
  fill: '#1b7067', light: '#3aab98', shade: '#11514b', ear: '#0b3b37', line: '#03201d',
  tail: '#18665e', tailLight: '#34a08f', ruff: '#2a8f80', ruffLight: '#5cc7b3',
};

/** For the impact frame: near-white fills under the same dark lines (inverted, the body turns to ink, the lines to paper). */
export const PALE_FOX: FoxPalette = {
  fill: '#ffffff', light: '#ffffff', shade: '#c4beb2', ear: '#a9a397', line: '#020a09',
  tail: '#ffffff', tailLight: '#ffffff', ruff: '#ffffff', ruffLight: '#ffffff',
};

const at = (p: FoxPose, q: Pt): Pt => ({ x: p.x + q.x * p.s, y: p.y + q.y * p.s });

/** The head's outline as a path (both halves). */
function headPath(ctx: Ctx, p: FoxPose) {
  const c = at(p, CROWN);
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  for (const [k, e] of HEAD_SEGS) {
    const a = at(p, k), b = at(p, e);
    ctx.quadraticCurveTo(a.x, a.y, b.x, b.y);
  }
  for (let i = HEAD_SEGS.length - 1; i >= 0; i--) {
    const k = HEAD_SEGS[i][0];
    const e = i > 0 ? HEAD_SEGS[i - 1][1] : CROWN;
    const a = at(p, { x: -k.x, y: k.y }), b = at(p, { x: -e.x, y: e.y });
    ctx.quadraticCurveTo(a.x, a.y, b.x, b.y);
  }
  ctx.closePath();
}

/** A shape of curved sides through three points (an ear's inside, a blaze). */
function softTri(ctx: Ctx, p: FoxPose, pts: Pt[], bulge = 0.12) {
  const s = pts.map((q) => at(p, q));
  const cx = s.reduce((a, q) => a + q.x, 0) / s.length, cy = s.reduce((a, q) => a + q.y, 0) / s.length;
  ctx.beginPath();
  ctx.moveTo(s[0].x, s[0].y);
  for (let i = 0; i < s.length; i++) {
    const a = s[i], b = s[(i + 1) % s.length];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    ctx.quadraticCurveTo(mx + (mx - cx) * bulge, my + (my - cy) * bulge, b.x, b.y);
  }
  ctx.closePath();
}

/** A flame-shaped ribbon: its spine and two edges. */
interface Plume { pts: Pt[]; L: Pt[]; R: Pt[]; i: number; prof: (j: number) => number }

/** A spine whose heading turns by `turn(u)` from `a` (u 0 to 1 along it). */
function spine(b: Pt, a: number, len: number, n: number, turn: (u: number) => number): Pt[] {
  const pts: Pt[] = [{ ...b }];
  let x = b.x, y = b.y;
  for (let i = 1; i <= n; i++) {
    const u = (i - 0.5) / n, ang = a + turn(u);
    x += (Math.cos(ang) * len) / n;
    y += (Math.sin(ang) * len) / n;
    pts.push({ x, y });
  }
  return pts;
}

const LENS = [5.0, 5.7, 6.1, 5.9, 5.3, 6.0, 6.2, 5.6, 4.9];

/** The nine tails, back to front: the middle (upright) one first, the outer, lower ones last. */
function tails(p: FoxPose): Plume[] {
  const out: Plume[] = [];
  const grow = easeOutK(clamp(p.form * 1.1));
  const base = at(p, { x: 0, y: 2.3 });
  for (const i of [4, 3, 5, 2, 6, 1, 7, 0, 8]) {
    const f = (i - 4) / 4;
    const side = i === 4 ? -1 : Math.sign(f);
    const sway = 0.06 * Math.sin(p.t * 1.4 + i * 0.8);
    // Two wings of four, leaving the moon open above the head; the ninth sweeps low to the left.
    const open = 0.62 * (1 - 0.25 * p.spread);
    const a = i === 4
      ? Math.PI * 0.84 + sway
      : -Math.PI / 2 + side * (open + (Math.abs(f) - 0.25) / 0.75 * (Math.PI / 2 + 0.22 - open)) + 0.08 + sway;
    const len = p.s * LENS[i] * (i === 4 ? 0.75 : 1) * (0.12 + 0.88 * grow);
    const n = 30;
    // An S: a slight counter-bend, then the tip curls up (mirrored either side), all turned a little the spiral's way.
    const curlK = i === 4 ? 1 : Math.abs(f) ** 0.6;
    const turn = (u: number) => -side * (1.25 * u * u * curlK - 0.28 * Math.sin(Math.PI * u)) + 0.3 * u * u + 0.1 * Math.sin(u * 3.5 - p.t * 2 + i);
    const pts = spine(base, a, len, n, turn);
    const prof = (j: number) => {
      const u = j / n;
      const wave = 1 + 0.06 * Math.sin(u * 9 - p.t * 5 + i);
      return p.s * (0.7 * Math.sin(Math.PI * u ** 0.72) ** 0.8 + 0.16 * (1 - u)) * wave;
    };
    const e = ribbonEdges(pts, prof);
    out.push({ pts, L: e.left, R: e.right, i, prof });
  }
  return out;
}
const easeOutK = (k: number) => 1 - (1 - k) ** 3;

/** The chest's right half, from under the cheek ruff down to the middle flame tongue: [control, end] in units. */
const BIB_TOP: Pt = { x: 0.7, y: 0.7 };
const BIB_SEGS: [Pt, Pt][] = [
  [{ x: 1.25, y: 1.25 }, { x: 1.05, y: 2.15 }],
  [{ x: 1.02, y: 2.5 }, { x: 1.18, y: 2.95 }],
  [{ x: 0.78, y: 2.6 }, { x: 0.52, y: 2.6 }],
  [{ x: 0.5, y: 2.95 }, { x: 0.46, y: 3.3 }],
  [{ x: 0.25, y: 2.85 }, { x: 0, y: 2.8 }],
];
/** The chest: a bib of flame fur under the head, ending in tongues of fire (both halves). */
function bibPath(ctx: Ctx, p: FoxPose) {
  const top = at(p, { x: -BIB_TOP.x, y: BIB_TOP.y });
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  const r = at(p, BIB_TOP);
  ctx.lineTo(r.x, r.y);
  for (const [k, e] of BIB_SEGS) {
    const a = at(p, k), b = at(p, e);
    ctx.quadraticCurveTo(a.x, a.y, b.x, b.y);
  }
  for (let i = BIB_SEGS.length - 1; i >= 0; i--) {
    const k = BIB_SEGS[i][0];
    const e = i > 0 ? BIB_SEGS[i - 1][1] : BIB_TOP;
    const a = at(p, { x: -k.x, y: k.y }), b = at(p, { x: -e.x, y: e.y });
    ctx.quadraticCurveTo(a.x, a.y, b.x, b.y);
  }
  ctx.closePath();
}
/** The pale V of fur down the chest. */
function bibLight(ctx: Ctx, p: FoxPose) {
  const pts = [{ x: -0.62, y: 0.9 }, { x: 0.62, y: 0.9 }, { x: 0.3, y: 2.0 }, { x: 0, y: 2.7 }, { x: -0.3, y: 2.0 }];
  softTri(ctx, p, pts, 0.08);
}

/** Where along a tail the fur turns to fire (a fraction of its points). */
const SOLID = 0.8;

/** The solid (fur) part of a tail: its edges to SOLID, closed by a notch like the base of a flame. */
function solidPath(ctx: Ctx, pl: Plume) {
  const n = pl.pts.length - 1, m = Math.round(n * SOLID);
  ctx.beginPath();
  ctx.moveTo(pl.L[0].x, pl.L[0].y);
  for (let j = 1; j <= m; j++) ctx.lineTo(pl.L[j].x, pl.L[j].y);
  const notch = pl.pts[m - 3];
  ctx.quadraticCurveTo(pl.pts[m].x, pl.pts[m].y, notch.x, notch.y);
  ctx.quadraticCurveTo(pl.pts[m].x, pl.pts[m].y, pl.R[m].x, pl.R[m].y);
  for (let j = m - 1; j >= 0; j--) ctx.lineTo(pl.R[j].x, pl.R[j].y);
  ctx.closePath();
}

/** The fire end of a tail (glow): bands of flame from where the fur ends out past the tip, licking. */
function tailFire(ctx: Ctx, pl: Plume, s: number, t: number, a: number) {
  const n = pl.pts.length - 1, m0 = Math.round(n * SOLID) - 4;
  const pts = pl.pts.slice(m0);
  // Carry the flame on past the tip, rising and flickering.
  const tip = pl.pts[n], prev = pl.pts[n - 2];
  let ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  let x = tip.x, y = tip.y;
  const extra = s * (1.1 + 0.25 * Math.sin(t * 7 + pl.i * 1.7));
  for (let k = 1; k <= 8; k++) {
    ang += (Math.atan2(-1, 0) - ang) * 0.12 + 0.12 * Math.sin(t * 6 + pl.i + k * 0.7);
    x += (Math.cos(ang) * extra) / 8;
    y += (Math.sin(ang) * extra) / 8;
    pts.push({ x, y });
  }
  const N = pts.length - 1;
  const w = (j: number) => {
    const u = j / N;
    const base = j + m0 <= n ? pl.prof(j + m0) : 0;
    const body = Math.max(base, s * 0.3 * (1 - u) ** 1.2);
    return body * (1 - u) ** 0.35 * (1 + 0.1 * Math.sin(j * 0.55 - t * 9 + pl.i));
  };
  for (const [color, wk, al] of [[C.fireDeep, 1.0, 0.55], [C.fire, 0.6, 0.75], [C.firePale, 0.18, 0.85]] as const) {
    const e = ribbonEdges(pts, (j) => w(j) * wk * Math.min(1, j / 4 + 0.3));
    ctx.fillStyle = rgba(color, al * a);
    edgePath(ctx, e.left, e.right);
    ctx.fill();
  }
  // A tongue splitting off upward.
  const j = Math.round(N * 0.45), q = pts[j];
  const sp = spine(q, -Math.PI / 2 + 0.4 * (pl.i < 4 ? -1 : 1) + 0.3 * Math.sin(t * 4 + pl.i), s * (0.7 + 0.2 * Math.sin(t * 9 + pl.i)), 10, (u) => 0.6 * u * Math.sin(t * 5 + pl.i));
  flameTongue(ctx, sp, s * 0.12, a * 0.85);
}

/** The fox (flat layer). */
export function foxFlat(ctx: Ctx, p: FoxPose, COL: FoxPalette = BASE) {
  if (p.form <= 0) return;
  const lw = Math.max(2, p.s * 0.04);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = clamp(p.form * 2.5);
  for (const tl of tails(p)) plumeFlat(ctx, tl, COL.tail, COL.tailLight, COL.line, lw);
  const hk = headK(p);
  ctx.globalAlpha = clamp(hk * 2);
  const hp = headPose(p);
  bibPath(ctx, hp);
  ctx.fillStyle = COL.ruff;
  ctx.fill();
  ctx.save();
  bibPath(ctx, hp);
  ctx.clip();
  ctx.fillStyle = COL.ruffLight;
  bibLight(ctx, hp);
  ctx.fill();
  ctx.restore();
  bibPath(ctx, hp);
  ctx.strokeStyle = COL.line;
  ctx.lineWidth = lw;
  ctx.stroke();
  // The head: its fill, the lighter blaze down the brow and muzzle, the ear insides, the shade under the ruffs.
  headPath(ctx, hp);
  ctx.fillStyle = COL.fill;
  ctx.fill();
  ctx.save();
  headPath(ctx, hp);
  ctx.clip();
  ctx.fillStyle = COL.shade;
  for (const side of [1, -1]) {
    softTri(ctx, hp, [{ x: 0.9 * side, y: 0.5 }, { x: 1.7 * side, y: 0.9 }, { x: 0.36 * side, y: 1.4 }], 0.2);
    ctx.fill();
  }
  ctx.fillStyle = COL.light;
  softTri(ctx, hp, [{ x: 0, y: -0.56 }, { x: 0.42, y: -0.1 }, { x: 0.2, y: 1.45 }, { x: 0, y: 1.7 }, { x: -0.2, y: 1.45 }, { x: -0.42, y: -0.1 }], 0.06);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COL.ear;
  for (const side of [1, -1]) {
    softTri(ctx, hp, EAR_IN.map((q) => ({ x: q.x * side, y: q.y })), 0.1);
    ctx.fill();
  }
  headPath(ctx, hp);
  ctx.strokeStyle = COL.line;
  ctx.lineWidth = lw;
  ctx.stroke();
  // The eyes' ink, the nose.
  for (const side of [1, -1]) {
    eyePath(ctx, hp, side, 1.3, 1);
    ctx.fillStyle = COL.line;
    ctx.fill();
  }
  softTri(ctx, hp, [{ x: -0.13, y: 1.54 }, { x: 0.13, y: 1.54 }, { x: 0, y: 1.76 }], 0.15);
  ctx.fillStyle = COL.line;
  ctx.fill();
  ctx.restore();
}

function plumeFlat(ctx: Ctx, pl: Plume, fill: string, light: string, line: string, lw: number) {
  ctx.fillStyle = fill;
  solidPath(ctx, pl);
  ctx.fill();
  ctx.save();
  solidPath(ctx, pl);
  ctx.clip();
  const mid = pl.L.map((q, j) => ({ x: lerp(q.x, pl.pts[j].x, 0.35), y: lerp(q.y, pl.pts[j].y, 0.35) }));
  ctx.fillStyle = light;
  edgePath(ctx, pl.L, mid);
  ctx.fill();
  ctx.restore();
  solidPath(ctx, pl);
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** How far the head has come in (later than the tails). */
const headK = (p: FoxPose) => clamp((p.form - 0.25) / 0.6);
const headPose = (p: FoxPose): FoxPose => ({ ...p, s: p.s * (0.85 + 0.15 * headK(p)) });

/** Cuts a shape out of the glow layer (so the light of what is behind it does not show through). */
function cut(ctx: Ctx, a: number, path: () => void) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = clamp(a);
  path();
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

/** The fox's fire (glow layer): rims, markings, the brow jewel, the eyes, flames off its ears and ruffs. */
export function foxGlow(ctx: Ctx, p: FoxPose, k = 1) {
  if (p.form <= 0 || k <= 0) return;
  const t = p.t;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const a = clamp(p.form * 2.5) * k;
  for (const tl of tails(p)) {
    cut(ctx, clamp(p.form * 2.5), () => solidPath(ctx, tl));
    plumeGlow(ctx, tl, p.s, a);
    tailFire(ctx, tl, p.s, t, a);
  }
  const hk = headK(p);
  const ha = clamp(hk * 2) * k;
  if (ha > 0) {
    const hp = headPose(p);
    cut(ctx, clamp(hk * 2), () => bibPath(ctx, hp));
    bibPath(ctx, hp);
    ctx.strokeStyle = rgba(C.fire, 0.5 * ha);
    ctx.lineWidth = hp.s * 0.05;
    ctx.stroke();
    ctx.strokeStyle = rgba(C.firePale, 0.8 * ha);
    ctx.lineWidth = hp.s * 0.016;
    ctx.stroke();
    cut(ctx, clamp(hk * 2), () => headPath(ctx, hp));
    // Flames licking off the cheek ruffs.
    const flames: [Pt, number, number][] = [[{ x: 1.8, y: 0.32 }, -0.3, 0.7], [{ x: 1.52, y: 0.84 }, 0.1, 0.5]];
    for (const [q, ang, size] of flames) {
      for (const side of [1, -1]) {
        const base = at(hp, { x: q.x * side, y: q.y });
        const aa = side > 0 ? ang : Math.PI - ang;
        const fl = 0.75 + 0.25 * Math.sin(t * 9 + side + q.x * 5);
        const sp = spine(base, aa, hp.s * 0.95 * size * fl, 12, (u) => -side * 0.9 * u * u * (aa < -1 ? 0.3 : 1) + 0.25 * Math.sin(t * 4 + q.y * 3) * u);
        flameTongue(ctx, sp, hp.s * 0.17 * size, ha);
      }
    }
    // The rim round the head.
    for (const [color, w, al] of [[C.fire, 0.06, 0.55], [C.firePale, 0.02, 0.9]] as const) {
      headPath(ctx, hp);
      ctx.strokeStyle = rgba(color, al * ha);
      ctx.lineWidth = hp.s * w;
      ctx.stroke();
    }
    // The markings: a sweep from each eye up towards the ear, and a fine line down the muzzle.
    for (const side of [1, -1]) {
      const m = [{ x: 0.78, y: -0.3 }, { x: 0.92, y: -0.56 }, { x: 0.86, y: -0.98 }].map((q) => at(hp, { x: q.x * side, y: q.y }));
      const e = ribbonEdges(m, (i) => hp.s * 0.065 * (1 - i / 2.3));
      ctx.fillStyle = rgba(C.fire, 0.85 * ha);
      edgePath(ctx, e.left, e.right);
      ctx.fill();
      const mz = [{ x: 0.24, y: 0.12 }, { x: 0.2, y: 0.8 }, { x: 0.11, y: 1.42 }].map((q) => at(hp, { x: q.x * side, y: q.y }));
      const e2 = ribbonEdges(mz, (i) => hp.s * 0.022 * (1 - i / 2.5));
      ctx.fillStyle = rgba(C.firePale, 0.6 * ha);
      edgePath(ctx, e2.left, e2.right);
      ctx.fill();
    }
    // The eyes: narrow slits of pale fire.
    if (p.eyes > 0) {
      for (const side of [1, -1]) {
        eyePath(ctx, hp, side, 1, p.eyes);
        ctx.fillStyle = rgba(C.fire, 0.95 * ha);
        ctx.fill();
        eyePath(ctx, hp, side, 0.6, p.eyes * 0.7);
        ctx.fillStyle = rgba(C.firePale, ha);
        ctx.fill();
      }
    }
    // The jewel-flame on the brow: the brightest point.
    const jw = [{ x: 0, y: -0.04 }, { x: 0.14, y: -0.22 }, { x: 0.06, y: -0.4 }, { x: 0, y: -0.64 }, { x: -0.06, y: -0.4 }, { x: -0.14, y: -0.22 }]
      .map((q) => at(hp, { x: q.x, y: q.y + 0.02 * Math.sin(t * 7) }));
    ctx.beginPath();
    ctx.moveTo(jw[0].x, jw[0].y);
    for (let i = 1; i <= jw.length; i++) {
      const q = jw[i % jw.length], pr = jw[i - 1];
      ctx.quadraticCurveTo(pr.x, pr.y, (pr.x + q.x) / 2, (pr.y + q.y) / 2);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(C.firePale, ha);
    ctx.fill();
    const jc = at(hp, { x: 0, y: -0.22 });
    ctx.beginPath();
    ctx.arc(jc.x, jc.y, hp.s * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#ffffff', ha);
    ctx.fill();
  }
  ctx.restore();
}

/** A plume's light: a faint fire inside, a burning rim along its lit edge, a pale streak (glow). */
function plumeGlow(ctx: Ctx, pl: Plume, s: number, a: number) {
  ctx.fillStyle = rgba(C.fire, 0.07 * a);
  solidPath(ctx, pl);
  ctx.fill();
  const m = Math.round((pl.pts.length - 1) * SOLID);
  for (const [color, w, al] of [[C.fire, 0.05, 0.5], [C.firePale, 0.016, 0.85]] as const) {
    ctx.beginPath();
    ctx.moveTo(pl.L[0].x, pl.L[0].y);
    for (const q of pl.L.slice(0, m + 1)) ctx.lineTo(q.x, q.y);
    ctx.strokeStyle = rgba(color, al * a);
    ctx.lineWidth = s * w;
    ctx.stroke();
  }
  const n = pl.pts.length - 1, j0 = Math.round(n * 0.2), j1 = Math.round(n * (SOLID - 0.04));
  const core: Pt[] = [];
  for (let j = j0; j <= j1; j++) core.push({ x: lerp(pl.L[j].x, pl.pts[j].x, 0.55), y: lerp(pl.L[j].y, pl.pts[j].y, 0.55) });
  const e = ribbonEdges(core, (j) => s * 0.035 * Math.sin((Math.PI * j) / (core.length - 1)));
  ctx.fillStyle = rgba(C.firePale, 0.55 * a);
  edgePath(ctx, e.left, e.right);
  ctx.fill();
}

/** A tongue of ghost-fire along a spine, tapering from `w` (glow). */
function flameTongue(ctx: Ctx, sp: Pt[], w: number, a: number) {
  const n = sp.length - 1;
  for (const [color, wk, al] of [[C.fireDeep, 1.5, 0.55], [C.fire, 1, 0.8], [C.firePale, 0.4, 0.9]] as const) {
    const e = ribbonEdges(sp, (i) => w * wk * Math.sin(Math.PI * Math.min(1, 0.25 + (i / n) * 0.75)) ** 0.8);
    ctx.fillStyle = rgba(color, al * a);
    edgePath(ctx, e.left, e.right);
    ctx.fill();
  }
}

/** The almond eye slanting up and out, `open` 0 (a line) to 1; `grow` scales it round its middle. */
function eyePath(ctx: Ctx, p: FoxPose, side: number, grow: number, open: number) {
  const m = { x: 0.53, y: -0.12 };
  const q = (x: number, y: number) => at(p, { x: (m.x + (x - m.x) * grow) * side, y: m.y + (y - m.y) * grow });
  const inner = q(0.27, 0.0), outer = q(0.82, -0.3);
  const up = q(0.5, lerp(-0.1, -0.27, open)), lo = q(0.58, lerp(-0.1, -0.02, open));
  ctx.beginPath();
  ctx.moveTo(inner.x, inner.y);
  ctx.quadraticCurveTo(up.x, up.y, outer.x, outer.y);
  ctx.quadraticCurveTo(lo.x, lo.y, inner.x, inner.y);
  ctx.closePath();
}
