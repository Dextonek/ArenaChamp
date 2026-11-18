import { clamp, lerp, ribbon, rgba, smooth, type Ctx, type Pt } from '../../core';
import { JADE, leafShape } from './grove';

/**
 * The jade serpent: a long snake-dragon seen from the side, cel-shaded in three greens with an ivory belly of plates,
 * scales cut as scallops, a fin of swept spines along its back, a tail that ends in a jade leaf; the head a long wedge
 * with a hard brow over a narrow gold eye, swept-back crests and two gold whiskers. No horns, no fangs, no mane.
 *
 * The body follows a track: the head travels along it and the body is its trail, as a snake moves.
 */

/** A path measured by its length, so the body can be laid along it at even spacing. */
export class Track {
  readonly pts: Pt[];
  readonly at0: number[];
  readonly total: number;
  constructor(pts: Pt[]) {
    this.pts = pts;
    this.at0 = [0];
    for (let i = 1; i < pts.length; i++) this.at0.push(this.at0[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    this.total = this.at0[this.at0.length - 1];
  }
  /** The point `s` along the track; beyond either end it goes on straight. */
  at(s: number): Pt {
    const p = this.pts, a = this.at0, n = p.length;
    if (s <= 0) {
      const dx = p[1].x - p[0].x, dy = p[1].y - p[0].y, l = Math.hypot(dx, dy) || 1;
      return { x: p[0].x + (dx / l) * s, y: p[0].y + (dy / l) * s };
    }
    if (s >= this.total) {
      const dx = p[n - 1].x - p[n - 2].x, dy = p[n - 1].y - p[n - 2].y, l = Math.hypot(dx, dy) || 1;
      return { x: p[n - 1].x + (dx / l) * (s - this.total), y: p[n - 1].y + (dy / l) * (s - this.total) };
    }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (a[mid] <= s) lo = mid; else hi = mid;
    }
    const k = (s - a[lo]) / (a[hi] - a[lo] || 1);
    return { x: lerp(p[lo].x, p[hi].x, k), y: lerp(p[lo].y, p[hi].y, k) };
  }
  /** Built from a function of u (0 to 1). */
  static of(f: (u: number) => Pt, n = 1200) {
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) pts.push(f(i / n));
    return new Track(pts);
  }
}

export interface SerpentPose {
  track: Track;
  /** How far along the track the head is. */
  head: number;
  /** The body's length along the track. */
  length: number;
  /** The body's greatest width. */
  width: number;
  /** 1: its back is on the left of its heading; -1: on the right. */
  flip: number;
  t: number;
  /** The share of the body (from the head) drawn as a second pass over the rest: a neck rising over its own coils. */
  neck?: number;
  /** The gold glint in its eye, 0 to 1. */
  glint?: number;
  /** The glow's strength. */
  light?: number;
  /** A softer, wider glow round the body (the coil). */
  aura?: number;
  /** The ivory belly band's width (1 as seen from the side; less where it is seen more from above). */
  belly?: number;
  /** Drawn only up to this share of the body from the tail (for the tail being swallowed by the leaves). */
  alpha?: number;
}

interface Body { p: Pt[]; d: Pt[]; b: Pt[]; w: number[] }

const N = 220;

function bodyOf(s: SerpentPose): Body {
  const p: Pt[] = [], d: Pt[] = [], b: Pt[] = [], w: number[] = [];
  for (let i = 0; i <= N; i++) p.push(s.track.at(s.head - (s.length * i) / N));
  for (let i = 0; i <= N; i++) {
    const a = p[Math.max(0, i - 1)], c = p[Math.min(N, i + 1)];
    let dx = a.x - c.x, dy = a.y - c.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    d.push({ x: dx, y: dy });
    b.push({ x: dy * s.flip, y: -dx * s.flip });
    const k = i / N;
    const neck = 0.8 + 0.2 * smooth(clamp((k - 0.015) / 0.09));
    const taper = k < 0.28 ? 1 : Math.max(0.05, (1 - (k - 0.28) / 0.72) ** 0.85);
    w.push(s.width * neck * taper);
  }
  return { p, d, b, w };
}

const off = (B: Body, i0: number, i1: number, o: (i: number) => number) => {
  const out: Pt[] = [];
  for (let i = i0; i <= i1; i++) out.push({ x: B.p[i].x + B.b[i].x * o(i), y: B.p[i].y + B.b[i].y * o(i) });
  return out;
};

/** One run of the body, from index i0 to i1 (flat). */
function bodyRun(ctx: Ctx, B: Body, i0: number, i1: number, s: SerpentPose) {
  if (i1 - i0 < 1) return;
  const n = i1 - i0;
  const W = (u: number) => B.w[Math.round(i0 + u * n)];
  const pts = B.p.slice(i0, i1 + 1);
  // The fin: swept spines along the back, under everything else.
  const fin: Pt[] = [], base: Pt[] = [];
  for (let i = i0; i <= i1; i++) {
    const k = i / N;
    const on = smooth(clamp((k - 0.04) / 0.06)) * (1 - smooth(clamp((k - 0.62) / 0.2)));
    const saw = 1 - ((i * 0.2 + 0.2) % 1);
    const h = (B.w[i] * 0.42 + s.width * 0.36 * on * (0.35 + 0.65 * saw)) * (on > 0.01 ? 1 : 0.5);
    fin.push({ x: B.p[i].x + B.b[i].x * h - B.d[i].x * s.width * 0.18 * on * saw, y: B.p[i].y + B.b[i].y * h - B.d[i].y * s.width * 0.18 * on * saw });
    base.push({ x: B.p[i].x, y: B.p[i].y });
  }
  ctx.beginPath();
  ctx.moveTo(base[0].x, base[0].y);
  for (const q of fin) ctx.lineTo(q.x, q.y);
  for (let i = base.length - 1; i >= 0; i--) ctx.lineTo(base[i].x, base[i].y);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = JADE.outline;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = JADE.deep;
  ctx.fill();
  // The spines' light edges.
  ctx.strokeStyle = rgba(JADE.light, 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let j = 0; j < fin.length; j++) {
    const i = i0 + j, saw = 1 - ((i * 0.2 + 0.2) % 1);
    if (saw > 0.72 && i / N > 0.06 && i / N < 0.72) {
      const q = fin[j], p = B.p[i];
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(lerp(q.x, p.x, 0.55), lerp(q.y, p.y, 0.55));
    }
  }
  ctx.stroke();
  // Outline, shadow, the lit band, the belly.
  ctx.fillStyle = JADE.outline;
  ribbon(ctx, pts, (u) => W(u) + 9);
  ctx.fillStyle = JADE.shadow;
  ribbon(ctx, pts, (u) => W(u));
  ctx.fillStyle = JADE.mid;
  ribbon(ctx, off(B, i0, i1, (i) => B.w[i] * 0.1), (u) => W(u) * 0.62);
  const belly = off(B, i0, i1, (i) => -B.w[i] * (0.45 - 0.15 * (s.belly ?? 1)));
  const bw = s.belly ?? 1;
  ctx.fillStyle = JADE.belly;
  ribbon(ctx, belly, (u) => W(u) * 0.3 * bw);
  // Belly plates: short dark lines across the belly band.
  ctx.strokeStyle = rgba('#5d7a5a', 0.85);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = i0 + 1; i < i1; i += 3) {
    const w = B.w[i];
    if (w < 8) continue;
    const c = belly[i - i0];
    const h = w * 0.15 * bw;
    ctx.moveTo(c.x + B.b[i].x * h, c.y + B.b[i].y * h);
    ctx.lineTo(c.x - B.b[i].x * h + B.d[i].x * 3, c.y - B.b[i].y * h + B.d[i].y * 3);
  }
  ctx.stroke();
  // Scales: scallops on the lit band, their free edges towards the tail.
  ctx.strokeStyle = rgba('#103f2b', 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = i0 + 1; i < i1; i += 3) {
    const w = B.w[i];
    if (w < 14) continue;
    const r = w * 0.12, ta = Math.atan2(-B.d[i].y, -B.d[i].x);
    for (const row of [-0.08, 0.2, 0.42]) {
      const o = (row + (Math.floor(i / 3) % 2 ? 0.1 : 0)) * w;
      const cx = B.p[i].x + B.b[i].x * o, cy = B.p[i].y + B.b[i].y * o;
      ctx.moveTo(cx + Math.cos(ta - 1.3) * r, cy + Math.sin(ta - 1.3) * r);
      ctx.arc(cx, cy, r, ta - 1.3, ta + 1.3);
    }
  }
  ctx.stroke();
  // The cel highlight along the back.
  ctx.fillStyle = rgba(JADE.pale, 0.85);
  ribbon(ctx, off(B, i0, i1, (i) => B.w[i] * 0.3), (u) => W(u) * 0.07 * Math.sin(Math.PI * clamp(u * 1.2 - 0.1)));
}

/** The head's outline in its own units (x forward to the snout, y towards the belly), for a body 64 wide. */
const HEAD: [number, number][] = [
  [-40, -28], [-6, -35], [26, -42], [58, -46], [86, -41], [104, -31], [130, -25], [156, -18], [176, -9], [186, 0],
  [181, 7], [160, 15], [128, 23], [92, 31], [56, 36], [24, 36], [-8, 31], [-40, 28],
];
const MOUTH: [number, number][] = [[182, 5], [150, 10], [116, 13], [90, 14], [74, 17]];
const TOP_LIGHT: [number, number][] = [[6, -33], [56, -40], [84, -35], [104, -26], [130, -20], [176, -6], [150, -12], [116, -17], [84, -27], [48, -30], [12, -26]];
const BROW: [number, number][] = [[54, -46], [88, -41], [110, -29], [94, -27], [76, -31], [60, -33]];
/** Two blades swept back low along the neck from behind the brow, and a smaller frill back from the jaw. */
const CREST: [number, number][] = [[52, -42], [20, -58], [-40, -70], [-190, -74], [-100, -54], [-30, -40]];
const CREST2: [number, number][] = [[18, -38], [-20, -50], [-80, -58], [-150, -56], [-70, -40], [-20, -32]];
const FRILL: [number, number][] = [[40, 28], [0, 36], [-60, 44], [-130, 46], [-60, 30], [-10, 24]];

function curve(ctx: Ctx, pts: [number, number][], close: boolean) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  if (close) ctx.closePath();
}
const path = (ctx: Ctx, pts: [number, number][]) => curve(ctx, pts, true);

/** Sets the head's frame: at the body's front, along its heading, its back up. */
function headFrame(ctx: Ctx, B: Body, s: SerpentPose) {
  const S = s.width / 64, p = B.p[0], d = B.d[0];
  // x along the heading, y towards the belly (the opposite of the back).
  ctx.transform(d.x * S, d.y * S, -B.b[0].x * S, -B.b[0].y * S, p.x, p.y);
}

function drawHead(ctx: Ctx, B: Body, s: SerpentPose) {
  ctx.save();
  headFrame(ctx, B, s);
  ctx.lineJoin = 'round';
  // Crests and frill, swept back behind the head.
  for (const shape of [CREST2, FRILL, CREST]) {
    path(ctx, shape);
    ctx.strokeStyle = JADE.outline;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.fillStyle = shape === CREST ? JADE.mid : JADE.shadow;
    ctx.fill();
  }
  ctx.strokeStyle = rgba(JADE.pale, 0.9);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(30, -50); ctx.quadraticCurveTo(-40, -66, -170, -72);
  ctx.moveTo(-10, 33); ctx.quadraticCurveTo(-60, 40, -115, 44);
  ctx.stroke();
  // The head: filled, then outlined everywhere but its back, where it runs into the neck.
  path(ctx, HEAD);
  ctx.fillStyle = JADE.mid;
  ctx.fill();
  curve(ctx, HEAD, false);
  ctx.strokeStyle = JADE.outline;
  ctx.lineWidth = 9;
  ctx.stroke();
  // The back of the head, shaded into the neck.
  ctx.beginPath();
  ctx.moveTo(-40, 28); ctx.lineTo(-8, 31); ctx.lineTo(24, 36); ctx.lineTo(40, 14); ctx.lineTo(-40, 6);
  ctx.closePath();
  ctx.fillStyle = JADE.shadow;
  ctx.fill();
  // The lower jaw in shadow, under the mouth line.
  ctx.beginPath();
  ctx.moveTo(MOUTH[0][0], MOUTH[0][1]);
  for (const [x, y] of MOUTH) ctx.lineTo(x, y);
  ctx.lineTo(56, 36); ctx.lineTo(92, 31); ctx.lineTo(128, 23); ctx.lineTo(160, 15);
  ctx.closePath();
  ctx.fillStyle = JADE.shadow;
  ctx.fill();
  // The throat and cheek in shadow.
  ctx.beginPath();
  ctx.moveTo(-30, 30); ctx.lineTo(24, 37); ctx.lineTo(56, 36); ctx.lineTo(74, 6); ctx.lineTo(40, 12); ctx.lineTo(-30, 8);
  ctx.closePath();
  ctx.fill();
  // The lit top plane and the hard brow.
  path(ctx, TOP_LIGHT);
  ctx.fillStyle = JADE.light;
  ctx.fill();
  path(ctx, BROW);
  ctx.fillStyle = JADE.outline;
  ctx.fill();
  // The mouth line, ending in a small hook.
  ctx.beginPath();
  ctx.moveTo(MOUTH[0][0], MOUTH[0][1]);
  for (const [x, y] of MOUTH) ctx.lineTo(x, y);
  ctx.lineTo(64, 23);
  ctx.strokeStyle = JADE.outline;
  ctx.lineWidth = 4;
  ctx.stroke();
  // A dark marking drawn back from the eye along the side of the head.
  ctx.fillStyle = JADE.outline;
  ribbon(ctx, [{ x: 72, y: -18 }, { x: 40, y: -20 }, { x: 4, y: -16 }, { x: -30, y: -10 }], (u) => 6 * (1 - u) + 0.5);
  // Cheek scales.
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba('#103f2b', 0.9);
  ctx.beginPath();
  for (const [x, y] of [[36, -14], [20, -2], [44, 2], [8, -18], [56, -14]]) {
    ctx.moveTo(x - 8, y - 6);
    ctx.quadraticCurveTo(x - 14, y, x - 8, y + 6);
  }
  ctx.stroke();
  // The nostril.
  ctx.beginPath();
  ctx.ellipse(165, -9, 5, 2, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = JADE.outline;
  ctx.fill();
  // The eye: narrow, gold, a dark slit.
  ctx.save();
  ctx.translate(86, -21);
  ctx.rotate(-0.16);
  ctx.beginPath();
  ctx.moveTo(-17, 1);
  ctx.quadraticCurveTo(0, -11, 17, -1);
  ctx.quadraticCurveTo(2, 9, -17, 1);
  ctx.closePath();
  ctx.fillStyle = JADE.gold;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = JADE.outline;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-3, -2.5, 9, 2.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = JADE.goldLight;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(1, 0, 1.8, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0c08';
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** The gold whiskers, flowing back from the snout (flat, in front of the body). */
function whiskers(ctx: Ctx, B: Body, s: SerpentPose) {
  ctx.save();
  headFrame(ctx, B, s);
  for (const [y0, ph, len, drop] of [[12, 0, 330, 90], [16, 1.7, 250, 140]] as const) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28;
      pts.push({ x: 160 + 14 * Math.sin(Math.PI * u) - u * len, y: y0 + drop * u ** 1.4 + 20 * Math.sin(u * 6 - s.t * 5 + ph) * u });
    }
    ctx.fillStyle = JADE.outline;
    ribbon(ctx, pts, (u) => 7 * (1 - u) + 1.2);
    ctx.fillStyle = JADE.gold;
    ribbon(ctx, pts, (u) => 3.8 * (1 - u) + 0.2);
  }
  ctx.restore();
}

/** The tail's leaf: a jade leaf blade continuing from the tail's tip. */
function tailLeaf(ctx: Ctx, B: Body, s: SerpentPose) {
  const p = B.p[N], d = B.d[N];
  const a = Math.atan2(-d.y, -d.x) + 0.15 * Math.sin(s.t * 3) * s.flip;
  ctx.fillStyle = JADE.outline;
  leafShape(ctx, p.x - d.x * 4, p.y - d.y * 4, a, s.width * 2.3, s.width * 0.62, 0.1 * s.flip);
  ctx.fillStyle = JADE.mid;
  leafShape(ctx, p.x, p.y, a, s.width * 2.1, s.width * 0.44, 0.1 * s.flip);
  ctx.fillStyle = JADE.light;
  leafShape(ctx, p.x + Math.cos(a) * 8, p.y + Math.sin(a) * 8, a, s.width * 1.6, s.width * 0.12, 0.1 * s.flip);
}

/** The serpent on the flat layer. */
export function serpentFlat(ctx: Ctx, s: SerpentPose) {
  const B = bodyOf(s);
  const split = Math.round(N * (s.neck ?? 0));
  ctx.save();
  ctx.globalAlpha = s.alpha ?? 1;
  tailLeaf(ctx, B, s);
  bodyRun(ctx, B, split, N, s);
  if (split > 0) bodyRun(ctx, B, 0, split + 1, s);
  drawHead(ctx, B, s);
  whiskers(ctx, B, s);
  ctx.restore();
}

/** The body and head's silhouette, filled (for punching the serpent out of the glow under it). */
function silhouette(ctx: Ctx, B: Body, s: SerpentPose, i0: number, i1: number, head: boolean) {
  ribbon(ctx, B.p.slice(i0, i1 + 1), (u) => B.w[Math.round(i0 + u * (i1 - i0))] + 10);
  if (head) {
    ctx.save();
    headFrame(ctx, B, s);
    path(ctx, HEAD);
    ctx.fill();
    path(ctx, CREST);
    ctx.fill();
    ctx.restore();
  }
}

/** The serpent's light (glow layer): a jade line along its spine, the eye's glint; with `aura`, a soft rim round it. */
export function serpentGlow(ctx: Ctx, s: SerpentPose) {
  const light = (s.light ?? 1) * (s.alpha ?? 1);
  const B = bodyOf(s);
  const split = Math.round(N * (s.neck ?? 0));
  const runs: [number, number][] = split > 0 ? [[split, N], [0, split + 1]] : [[0, N]];
  for (const [i0, i1] of runs) {
    const aura = s.aura ?? 0;
    if (aura > 0) {
      // A wide soft band round this run, then the run itself punched out of it: light along its edges.
      const pts = B.p.slice(i0, i1 + 1);
      ctx.fillStyle = rgba('#178a50', 0.22 * aura * light);
      ribbon(ctx, pts, (u) => B.w[Math.round(i0 + u * (i1 - i0))] * 1.7 + 30);
      ctx.fillStyle = rgba('#5cf0a4', 0.36 * aura * light);
      ribbon(ctx, pts, (u) => B.w[Math.round(i0 + u * (i1 - i0))] + 20);
    }
    if (aura > 0 || i0 === 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      silhouette(ctx, B, s, i0, i1, i0 === 0);
      ctx.restore();
    }
    if (light <= 0) continue;
    // The spine's light, from just behind the head to near the tail.
    const a = Math.max(i0, Math.round(N * 0.03)), b = Math.min(i1, Math.round(N * 0.9));
    if (b - a < 2) continue;
    const spine = off(B, a, b, (i) => B.w[i] * 0.3);
    const fade = (u: number) => Math.sin(Math.PI * clamp(((a + u * (b - a)) / N - 0.03) / 0.87)) ** 0.6;
    ctx.fillStyle = rgba('#20c873', 0.45 * light);
    ribbon(ctx, spine, (u) => 11 * fade(u) * (s.width / 64));
    ctx.fillStyle = rgba('#a6ffd2', 0.95 * light);
    ribbon(ctx, spine, (u) => 3.4 * fade(u) * (s.width / 64));
    // Beads of light along it.
    for (let i = a + 5; i < b; i += 11) {
      const q = spine[i - a], r = 4 * fade((i - a) / (b - a)) * (s.width / 64);
      ctx.fillStyle = rgba('#e8fff2', 0.9 * light);
      ctx.beginPath();
      ctx.moveTo(q.x - r * 2, q.y); ctx.lineTo(q.x, q.y - r); ctx.lineTo(q.x + r * 2, q.y); ctx.lineTo(q.x, q.y + r);
      ctx.closePath();
      ctx.fill();
    }
  }
  const glint = s.glint ?? 0;
  if (glint > 0) {
    ctx.save();
    headFrame(ctx, B, s);
    ctx.translate(86, -23);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
    g.addColorStop(0, rgba('#fff6cc', glint));
    g.addColorStop(0.3, rgba('#ffd060', 0.7 * glint));
    g.addColorStop(1, rgba('#ff9a20', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba('#fff3c4', glint);
    for (const [a, len] of [[-0.2, 120], [Math.PI / 2 - 0.2, 45], [Math.PI - 0.2, 120], [-Math.PI / 2 - 0.2, 45]] as const) {
      ribbon(ctx, [{ x: 0, y: 0 }, { x: Math.cos(a) * len * glint, y: Math.sin(a) * len * glint }], (u) => 4.5 * (1 - u));
    }
    ctx.restore();
  }
}

/** The head's position and heading (for effects that come from it). */
export function headPoint(s: SerpentPose): Pt {
  const B = bodyOf(s);
  const S = s.width / 64;
  return { x: B.p[0].x + B.d[0].x * 90 * S - B.b[0].x * -20 * S, y: B.p[0].y + B.d[0].y * 90 * S - B.b[0].y * -20 * S };
}
