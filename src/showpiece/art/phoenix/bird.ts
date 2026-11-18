import { clamp, lerp, rgba, rng, type Ctx, type Pt } from '../../core';
import { bezier, curlSpine, edgePath, mixHexHex, polyPath, ribbonEdges, smoothPath } from './common';

/**
 * The phoenix: a mythic firebird seen from the front, wings either raised and folded (rising) or spread across the frame,
 * a long S of a neck with the head in profile, a crest of flame feathers, and a tail of long ribbon plumes with crimson
 * eye-spots. Every feather is a cel-shaded blade with a dark outline; each one can be ash grey (with embers in its quill)
 * or alight, so the wings can catch fire feather by feather.
 *
 * One rig, driven by a `BirdPose`. `birdGeometry` lays it out for a frame; `birdFlat` draws the figure (flat layer) and
 * `birdGlow` cuts its silhouette out of the glow layer and lays its own light (rims, flames, the eye) over it.
 */

export interface BirdPose {
  /** Where the body's middle is, and the size (1 is the full-frame spread). */
  x: number;
  y: number;
  s: number;
  /** 0: wings raised over the back and folded; 1: spread wide across the frame. */
  spread: number;
  /** A small beat of the wings, -1 to 1. */
  flap: number;
  /** 0: head bowed; 1: raised. */
  lift: number;
  /** 0: beak shut; 1: open (the cry). */
  beak: number;
  /** How far the fire has run through the feathers: 0 all ash, about 1.15 every feather alight. */
  ignite: number;
  /** The glow of the embers in the ash feathers' quills, 0 to 1. */
  ember: number;
  /** White-hot, 0 to 1 (the dive). */
  heat: number;
  t: number;
}

type Kind = 'prim' | 'sec' | 'cov' | 'marg' | 'arm' | 'body' | 'crest' | 'tail';
type Pal = { main: string; light: string; shade: string };

const FIRE: Record<Kind, Pal> = {
  prim: { main: '#e85a1c', light: '#ffa443', shade: '#93270f' },
  sec: { main: '#f27a20', light: '#ffc057', shade: '#a83a16' },
  cov: { main: '#ffa22e', light: '#ffe08a', shade: '#c9601c' },
  marg: { main: '#ffc443', light: '#fff0b4', shade: '#d98a26' },
  arm: { main: '#ffd25a', light: '#fff6cc', shade: '#e09a2e' },
  body: { main: '#ffb437', light: '#ffe9a0', shade: '#c8641e' },
  crest: { main: '#ffc84a', light: '#fff3c0', shade: '#e0782a' },
  tail: { main: '#ff9a2a', light: '#ffe08a', shade: '#c24a18' },
};
const ASH: Record<Kind, Pal> = {
  prim: { main: '#4b4642', light: '#6c6661', shade: '#2d2a27' },
  sec: { main: '#56514c', light: '#78726b', shade: '#34302d' },
  cov: { main: '#67615b', light: '#8c857d', shade: '#403b37' },
  marg: { main: '#777069', light: '#9d968d', shade: '#4b4641' },
  arm: { main: '#69635d', light: '#878079', shade: '#46413c' },
  body: { main: '#6e6862', light: '#99928a', shade: '#423d39' },
  crest: { main: '#7a736c', light: '#a39b92', shade: '#4a4540' },
  tail: { main: '#5e5853', light: '#857e77', shade: '#393532' },
};
const LINE_FIRE = '#2a0a04', LINE_ASH = '#121010';
export const CRIMSON = '#c8191f';
const WHITE_HOT = '#fff4dc';

/** A colour of a part, between ash and fire, whitened by the heat. */
function col(kind: Kind, which: keyof Pal, k: number, heat: number) {
  return mixHexHex(mixHexHex(ASH[kind][which], FIRE[kind][which], k), WHITE_HOT, heat * 0.85);
}
const lineCol = (k: number, heat: number) => mixHexHex(mixHexHex(LINE_ASH, LINE_FIRE, k), '#b06a30', heat);

/** One feather of the right wing: where on the arm it grows (0 shoulder, 1 wrist), its angle off the arm, its size. */
interface FeatherDef { kind: Kind; f: number; d: number; len: number; w: number; curl: number; notch: number; at: number }

/** The right wing's feathers, in drawing order (back to front). Built once. */
const WING: FeatherDef[] = (() => {
  const r = rng(4242);
  const out: FeatherDef[] = [];
  // Primaries: the long blades fanning from the wrist, the outermost nearly along the arm.
  for (let i = 0; i < 10; i++) {
    const f = 1.0 - i * 0.03;
    out.push({ kind: 'prim', f, d: 0.1 + i * 0.088, len: 600 - i * 21, w: 36, curl: 0.34 + r.range(-0.05, 0.05), notch: 0.32, at: 0.5 + f * 0.5 + r.range(0, 0.04) });
  }
  // Secondaries along the forearm, hanging back.
  for (let j = 0; j < 9; j++) {
    const f = 0.71 - j * 0.074;
    out.push({ kind: 'sec', f, d: 1.0 + j * 0.065, len: 390 - j * 9, w: 36, curl: 0.3 + r.range(-0.05, 0.05), notch: 0.28, at: 0.42 + f * 0.55 + r.range(0, 0.04) });
  }
  // Greater coverts over their bases.
  for (let j = 0; j < 12; j++) {
    const f = 0.97 - j * 0.074;
    out.push({ kind: 'cov', f, d: 0.6 + j * 0.07, len: 215 - j * 5, w: 27, curl: 0.25, notch: 0.15, at: 0.25 + f * 0.55 + r.range(0, 0.03) });
  }
  // Small marginal coverts along the arm.
  for (let j = 0; j < 15; j++) {
    const f = 1.0 - j * 0.064;
    out.push({ kind: 'marg', f, d: 0.85 + j * 0.03, len: 105, w: 21, curl: 0.2, notch: 0, at: 0.12 + f * 0.5 + r.range(0, 0.03) });
  }
  return out;
})();

/** A blade laid out for a frame: its spine and two edges (on screen), how alight it is, and its flash. */
export interface Blade {
  kind: Kind;
  pts: Pt[];
  /** The trailing (notched) and leading edges. */
  T: Pt[];
  Ld: Pt[];
  k: number;
  flash: number;
  w: number;
  len: number;
  i: number;
}

export interface Plume { pts: Pt[]; L: Pt[]; R: Pt[]; k: number; w: number; eye: boolean; kind: Kind; i: number }

export interface BirdGeo {
  pose: BirdPose;
  blades: Blade[];
  arms: { L: Pt[]; R: Pt[]; k: number }[];
  tail: Plume[];
  crest: Plume[];
  headPlumes: Plume[];
  torso: Pt[];
  neck: { L: Pt[]; R: Pt[]; pts: Pt[] };
  skull: Pt[];
  beakU: Pt[];
  beakL: Pt[];
  eye: Pt[];
  eyeAt: Pt;
  mark: Pt[];
  body: number;
  ow: number;
}

/** The feather blade's half width along it (0 at base, 1 at the tip): a narrow quill, full a third of the way, a point. */
const prof = (u: number) => Math.max(0.28 * (1 - u), Math.sin(Math.PI * u ** 0.7) ** 0.75);
/** The notches cut into a feather's trailing edge (towards its tip). */
const saw = (u: number) => (u > 0.3 && u < 0.97 ? ((u * 4.2) % 1) ** 2.2 : 0);

/** Points of the right arm (local units): from the shoulder outward, bowed forward. */
function armPoint(theta: number, len: number, f: number): Pt {
  const dx = Math.cos(theta), dy = Math.sin(theta);
  const arch = 70 * Math.sin(Math.PI * Math.min(1, f));
  return { x: 50 + dx * len * f + dy * arch, y: -78 + dy * len * f - dx * arch };
}

export function birdGeometry(p: BirdPose): BirdGeo {
  const s = p.s;
  const T = (q: Pt, side = 1): Pt => ({ x: p.x + q.x * s * side, y: p.y + q.y * s });
  // The wings.
  const theta = lerp(-1.2, -0.44, p.spread) + p.flap * 0.13;
  const fold = 0.2 + 0.8 * p.spread;
  const LA = 600 * (0.74 + 0.26 * p.spread);
  const blades: Blade[] = [];
  const arms: { L: Pt[]; R: Pt[]; k: number }[] = [];
  for (const side of [-1, 1]) {
    WING.forEach((d, i) => {
      const base = armPoint(theta, LA, d.f);
      const lenK = d.kind === 'prim' ? 0.82 + 0.18 * p.spread : 1;
      // The feathers' own little beat: the long ones lag the arm.
      const lag = d.kind === 'prim' || d.kind === 'sec' ? -p.flap * 0.08 : 0;
      const spine = curlSpine(base, theta + d.d * fold + lag, d.len * lenK, d.curl * (0.6 + 0.4 * p.spread), 12).map((q) => T(q, side));
      const n = spine.length - 1;
      const w = d.w * s;
      const trail = (j: number) => w * prof(j / n) * (1 - d.notch * saw(j / n));
      const lead = (j: number) => w * prof(j / n) * 0.86;
      // Mirroring flips which side the normal points to.
      const e = side > 0 ? ribbonEdges(spine, trail, lead) : ribbonEdges(spine, lead, trail);
      const raw = (p.ignite - d.at) / 0.07;
      blades.push({
        kind: d.kind, pts: spine, T: side > 0 ? e.left : e.right, Ld: side > 0 ? e.right : e.left,
        k: clamp(raw), flash: clamp(raw) * (1 - clamp((raw - 1) / 2)), w, len: d.len * lenK * s, i: i + (side > 0 ? 100 : 0),
      });
    });
    // The arm's leading edge: a band of small gold feathers over the bases.
    const ap: Pt[] = [];
    for (let j = 0; j <= 16; j++) ap.push(T(armPoint(theta, LA, -0.02 + (1.04 * j) / 16), side));
    const aw = (j: number) => s * lerp(30, 12, j / 16) * Math.min(1, 0.25 + (j / 16) * 7);
    const e = ribbonEdges(ap, aw, aw);
    arms.push({ L: e.left, R: e.right, k: clamp((p.ignite - 0.08) / 0.08) });
  }
  // Interleave: both wings' feathers by kind, so the left and right layers sit the same way.
  const order: Kind[] = ['prim', 'sec', 'cov', 'marg'];
  blades.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  const body = clamp(p.ignite / 0.1);
  // The tail: seven long plumes, waving.
  const tail: Plume[] = [];
  for (const k of [-3, 3, -2, 2, -1, 1, 0]) {
    const len = (400 + (3 - Math.abs(k)) * 70) * (0.85 + 0.15 * p.spread);
    const a = Math.PI / 2 - k * 0.24 + 0.05 * Math.sin(p.t * 1.3 + k);
    const ph = p.t * 3.1 + k * 0.9;
    // The outer plumes curl outward at the end (a lyre); all of them wave.
    const spine = curlSpine({ x: k * 9, y: 150 }, a, len, -k * 0.3, 22, (u) => 0.3 * Math.sin(u * 5 - ph) * u).map((q) => T(q));
    const n = spine.length - 1;
    const eye = Math.abs(k) <= 2;
    const w = (j: number) => s * (eye ? 9 + 9 * clamp((j / n - 0.45) / 0.4) * (1 - clamp((j / n - 0.9) / 0.1)) : 17 * (1 - j / n) ** 0.8 + 0.5);
    const e = ribbonEdges(spine, w, w);
    tail.push({ pts: spine, L: e.left, R: e.right, k: clamp((p.ignite - 0.1 - 0.06 * Math.abs(k)) / 0.1), w: 13 * s, eye, kind: 'tail', i: k });
  }

  // The neck: a long S up to the head.
  const head: Pt = { x: lerp(66, 104, p.lift), y: lerp(-262, -372, p.lift) };
  const neckPts = bezier({ x: 0, y: -90 }, { x: -70, y: -190 }, { x: lerp(-5, 20, p.lift), y: lerp(-250, -320, p.lift) }, head, 22).map((q) => T(q));
  const nn = neckPts.length - 1;
  const nw = (j: number) => s * lerp(33, 19, j / nn);
  const ne = ribbonEdges(neckPts, nw, nw);
  const torso: Pt[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    const rx = 70 * (1 - 0.42 * Math.max(0, sn) ** 1.4) * (1 + 0.08 * Math.max(0, -sn));
    torso.push(T({ x: rx * c, y: 6 + (sn > 0 ? 165 : 118) * sn }));
  }

  // The head, in profile facing right; its own frame.
  const H = T(head);
  const ha = lerp(0.5, -0.1, p.lift) - 0.22 * p.beak;
  const hs = 1.38 * s;
  const HT = (q: Pt): Pt => ({ x: H.x + (Math.cos(ha) * q.x - Math.sin(ha) * q.y) * hs, y: H.y + (Math.sin(ha) * q.x + Math.cos(ha) * q.y) * hs });
  const skull = [[-38, 6], [-36, -12], [-22, -27], [0, -31], [22, -26], [38, -16], [46, -6], [45, 8], [32, 18], [8, 24], [-16, 25], [-32, 18]]
    .map(([x, y]) => HT({ x, y }));
  const beakU = [[38, -15], [55, -15], [70, -11], [84, -4], [95, 5], [101, 14], [102, 22], [97, 16], [88, 10], [75, 6], [58, 4], [42, 4]].map(([x, y]) => HT({ x, y }));
  const open = 0.5 * p.beak;
  const beakL = [[42, 5], [58, 8], [72, 11], [84, 14], [78, 18], [62, 20], [46, 19], [40, 14]].map(([x, y]) => {
    const dx = x - 42, dy = y - 6;
    return HT({ x: 42 + dx * Math.cos(open) - dy * Math.sin(open), y: 6 + dx * Math.sin(open) + dy * Math.cos(open) });
  });
  const eye = [[4, -7], [12, -14], [26, -12], [31, -8], [16, -4]].map(([x, y]) => HT({ x, y }));
  const markSpine = [[22, 1], [6, 5], [-12, 6], [-34, 2]].map(([x, y]) => HT({ x, y }));
  const me = ribbonEdges(markSpine, (j) => hs * 5.5 * (1 - j / 3) + 0.5);
  const mark = [...me.left, ...me.right.reverse()];
  // The crest: flame feathers sweeping back from the crown.
  const crest: Plume[] = [];
  for (let i = 0; i < 7; i++) {
    const b = HT({ x: -2 - i * 6, y: -28 + i * 3.5 });
    const len = hs * [120, 175, 230, 270, 240, 190, 140][i];
    const a = ha + Math.PI + 1.05 - i * 0.16;
    const ph = p.t * 4 + i * 1.3;
    const spine = curlSpine(b, a, len, -0.9 + 0.1 * i, 14, (u) => 0.12 * Math.sin(u * 4 - ph) * u);
    const n = spine.length - 1;
    const w = (j: number) => hs * 9 * prof(j / n);
    const e = ribbonEdges(spine, w, w);
    crest.push({ pts: spine, L: e.left, R: e.right, k: clamp((p.ignite - 0.03) / 0.08), w: hs * 9, eye: false, kind: 'crest', i });
  }
  const headPlumes: Plume[] = [];
  return {
    pose: p, blades, arms, tail, crest, headPlumes, torso, neck: { L: ne.left, R: ne.right, pts: neckPts },
    skull, beakU, beakL, eye, eyeAt: HT({ x: 19, y: -9 }), mark, body, ow: Math.max(2, 5 * s),
  };
}

const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** One feather blade, cel-shaded: outline, body, the trailing half in shade, a light sliver on the leading edge, the quill. */
function bladeFlat(ctx: Ctx, b: Blade, heat: number, ow: number) {
  const pal = (w: keyof Pal) => col(b.kind, w, b.k, heat);
  edgePath(ctx, b.T, b.Ld);
  ctx.strokeStyle = lineCol(b.k, heat);
  ctx.lineWidth = ow;
  ctx.stroke();
  ctx.fillStyle = pal('main');
  ctx.fill();
  const n = b.pts.length;
  const m = Math.max(3, Math.round(n * 0.94));
  ctx.fillStyle = pal('shade');
  edgePath(ctx, b.T.slice(0, m).map((q, i) => lerpPt(b.pts[i], q, 0.86)), b.pts.slice(0, m));
  ctx.fill();
  ctx.fillStyle = pal('light');
  edgePath(ctx, b.Ld.slice(1, m - 1).map((q, i) => lerpPt(b.pts[i + 1], q, 0.84)), b.Ld.slice(1, m - 1).map((q, i) => lerpPt(b.pts[i + 1], q, 0.42)));
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(b.pts[0].x, b.pts[0].y);
  for (let i = 1; i < Math.round(n * 0.8); i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
  ctx.strokeStyle = rgba(mixHexHex(LINE_ASH, LINE_FIRE, b.k), 0.55);
  ctx.lineWidth = Math.max(1, ow * 0.45);
  ctx.stroke();
}

function plumeFlat(ctx: Ctx, q: Plume, heat: number, ow: number) {
  edgePath(ctx, q.L, q.R);
  ctx.strokeStyle = lineCol(q.k, heat);
  ctx.lineWidth = ow;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = col(q.kind, 'main', q.k, heat);
  ctx.fill();
  // The shaded side and a bright stripe down the middle.
  const n = q.pts.length;
  ctx.fillStyle = col(q.kind, 'shade', q.k, heat);
  edgePath(ctx, q.L.map((p, i) => lerpPt(q.pts[i], p, 0.9)), q.pts.map((p, i) => lerpPt(p, q.L[i], 0.15)));
  ctx.fill();
  ctx.fillStyle = col(q.kind, 'light', q.k, heat);
  edgePath(ctx, q.R.slice(0, n - 1).map((p, i) => lerpPt(q.pts[i], p, 0.7)), q.R.slice(0, n - 1).map((p, i) => lerpPt(q.pts[i], p, 0.2)));
  ctx.fill();
  if (q.eye) eyeSpot(ctx, q, heat, ow);
}

/** The tail plume's eye-spot near its tip: a crimson ring round a gold heart. */
function eyeSpot(ctx: Ctx, q: Plume, heat: number, ow: number) {
  const j = Math.round((q.pts.length - 1) * 0.86);
  const a = q.pts[j - 1], b = q.pts[j + 1] ?? q.pts[j];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const c = q.pts[j];
  const R = q.w * 2.2;
  const ell = (rx: number, ry: number, fill: string) => {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, ang, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ell(R * 1.25 + ow, R * 0.78 + ow, lineCol(q.k, heat));
  ell(R * 1.25, R * 0.78, mixHexHex(mixHexHex('#5a2a26', CRIMSON, q.k), WHITE_HOT, heat * 0.85));
  ell(R * 0.8, R * 0.46, col('tail', 'light', q.k, heat));
  ell(R * 0.3, R * 0.18, mixHexHex(mixHexHex('#5a2a26', CRIMSON, q.k), WHITE_HOT, heat * 0.85));
}

/** The whole figure on the flat layer. */
export function birdFlat(ctx: Ctx, g: BirdGeo) {
  const { heat } = g.pose;
  const ow = g.ow;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const q of g.tail) plumeFlat(ctx, q, heat, ow);
  for (const b of g.blades) bladeFlat(ctx, b, heat, ow);
  for (const a of g.arms) {
    edgePath(ctx, a.L, a.R);
    ctx.strokeStyle = lineCol(a.k, heat);
    ctx.lineWidth = ow;
    ctx.stroke();
    ctx.fillStyle = col('arm', 'main', a.k, heat);
    ctx.fill();
    ctx.fillStyle = col('arm', 'light', a.k, heat);
    edgePath(ctx, a.R.map((p, i) => lerpPt(a.L[i], p, 0.85)), a.R.map((p, i) => lerpPt(a.L[i], p, 0.45)));
    ctx.fill();
  }
  for (const q of g.headPlumes) plumeFlat(ctx, q, heat, ow * 0.7);
  // The neck.
  const bk = g.body;
  edgePath(ctx, g.neck.L, g.neck.R);
  ctx.strokeStyle = lineCol(bk, heat);
  ctx.lineWidth = ow;
  ctx.stroke();
  ctx.fillStyle = col('body', 'main', bk, heat);
  ctx.fill();
  ctx.fillStyle = col('body', 'shade', bk, heat);
  edgePath(ctx, g.neck.L.map((p, i) => lerpPt(g.neck.pts[i], p, 0.9)), g.neck.pts.map((p, i) => lerpPt(p, g.neck.L[i], 0.1)));
  ctx.fill();
  ctx.fillStyle = col('body', 'light', bk, heat);
  edgePath(ctx, g.neck.R.map((p, i) => lerpPt(g.neck.pts[i], p, 0.8)), g.neck.R.map((p, i) => lerpPt(g.neck.pts[i], p, 0.45)));
  ctx.fill();
  // Small scale feathers down the neck.
  neckScales(ctx, g, heat);
  // The torso, with rows of breast feathers.
  polyPath(ctx, g.torso);
  ctx.strokeStyle = lineCol(bk, heat);
  ctx.lineWidth = ow;
  ctx.stroke();
  ctx.fillStyle = col('body', 'main', bk, heat);
  ctx.fill();
  breast(ctx, g, heat);
  // The crest and the head.
  for (const q of g.crest) plumeFlat(ctx, q, heat, ow * 0.8);
  smoothPath(ctx, g.skull);
  ctx.strokeStyle = lineCol(bk, heat);
  ctx.lineWidth = ow * 0.8;
  ctx.stroke();
  ctx.fillStyle = col('body', 'main', bk, heat);
  ctx.fill();
  // The crown lighter, the cheek in shade.
  ctx.save();
  smoothPath(ctx, g.skull);
  ctx.clip();
  ctx.fillStyle = col('body', 'light', bk, heat);
  smoothPath(ctx, g.skull.map((q) => ({ x: q.x + (q.x - g.eyeAt.x) * -0.1, y: q.y - 9 * g.pose.s })));
  ctx.fill();
  ctx.fillStyle = col('body', 'main', bk, heat);
  smoothPath(ctx, g.skull.map((q) => ({ x: q.x + 4 * g.pose.s, y: q.y + 13 * g.pose.s })));
  ctx.fill();
  ctx.restore();
  for (const [pts, fill] of [[g.beakL, mixHexHex(mixHexHex('#8b8580', '#e8c070', bk), WHITE_HOT, heat * 0.85)], [g.beakU, mixHexHex(mixHexHex('#aaa39b', '#ffe6a6', bk), WHITE_HOT, heat * 0.85)]] as const) {
    polyPath(ctx, pts as Pt[]);
    ctx.strokeStyle = lineCol(bk, heat);
    ctx.lineWidth = ow * 0.8;
    ctx.stroke();
    ctx.fillStyle = fill as string;
    ctx.fill();
  }
  polyPath(ctx, g.mark);
  ctx.fillStyle = mixHexHex(mixHexHex('#4a3532', CRIMSON, bk), WHITE_HOT, heat * 0.8);
  ctx.fill();
  polyPath(ctx, g.eye);
  ctx.fillStyle = lineCol(bk, heat * 0.5);
  ctx.fill();
  ctx.restore();
}

/** Scale feathers down the front of the neck: small arcs, open towards the head. */
function neckScales(ctx: Ctx, g: BirdGeo, heat: number) {
  const pts = g.neck.pts, s = g.pose.s;
  ctx.strokeStyle = col('body', 'shade', g.body, heat);
  ctx.lineWidth = Math.max(1, 2.2 * s);
  for (let i = 2; i < pts.length - 3; i += 2) {
    const a = pts[i], b = pts[i + 1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    for (const off of [-0.45, 0, 0.45]) {
      const w = s * lerp(33, 19, i / pts.length);
      const c = { x: a.x - Math.sin(ang) * off * w, y: a.y + Math.cos(ang) * off * w };
      ctx.beginPath();
      ctx.arc(c.x, c.y, w * 0.28, ang + Math.PI * 0.5, ang + Math.PI * 1.5, true);
      ctx.stroke();
    }
  }
}

/** Rows of breast feathers over the torso (clipped to it), lighter up top, and a shaded flank. */
function breast(ctx: Ctx, g: BirdGeo, heat: number) {
  const { x, y, s } = g.pose;
  ctx.save();
  polyPath(ctx, g.torso);
  ctx.clip();
  for (let r = 0; r < 7; r++) {
    const yy = y + (-90 + r * 34) * s;
    const odd = r % 2;
    for (let c = -2; c <= 2; c++) {
      const xx = x + (c * 34 + odd * 17) * s;
      const rr = 17 * s * (1 - r * 0.05);
      // A small pointed feather tip.
      ctx.beginPath();
      ctx.moveTo(xx - rr, yy);
      ctx.quadraticCurveTo(xx - rr * 0.9, yy + rr * 1.1, xx, yy + rr * 1.5);
      ctx.quadraticCurveTo(xx + rr * 0.9, yy + rr * 1.1, xx + rr, yy);
      ctx.fillStyle = col('body', r < 2 ? 'light' : 'main', g.body, heat);
      ctx.fill();
      ctx.strokeStyle = rgba(col('body', 'shade', g.body, heat), 0.7);
      ctx.lineWidth = Math.max(1, 1.8 * s);
      ctx.stroke();
    }
  }
  // The flank in shade on the right, a light on the upper left.
  ctx.fillStyle = rgba(col('body', 'shade', g.body, heat), 0.85);
  ctx.beginPath();
  ctx.ellipse(x + 95 * s, y + 40 * s, 80 * s, 210 * s, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Every closed shape of the figure (for cutting its silhouette out of the glow layer, whitening it, or an ink frame). */
export function birdSilhouette(ctx: Ctx, g: BirdGeo, fill: string, ow: number) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.lineWidth = ow;
  ctx.lineJoin = 'round';
  const both = () => { ctx.fill(); ctx.stroke(); };
  for (const q of g.tail) { edgePath(ctx, q.L, q.R); both(); }
  for (const b of g.blades) { edgePath(ctx, b.T, b.Ld); both(); }
  for (const a of g.arms) { edgePath(ctx, a.L, a.R); both(); }
  for (const q of [...g.headPlumes, ...g.crest]) { edgePath(ctx, q.L, q.R); both(); }
  edgePath(ctx, g.neck.L, g.neck.R); both();
  for (const pts of [g.torso, g.beakU, g.beakL]) { polyPath(ctx, pts); both(); }
  smoothPath(ctx, g.skull); both();
  ctx.restore();
}

/**
 * The figure's light on the glow layer: its silhouette cut out of whatever glow is behind it, then embers in the ash
 * feathers' quills, each feather's flash as it catches, a rim of light on its leading edge, flame tongues off the long
 * feathers' tips, the eye, and (for the dive) the whole figure white-hot.
 */
export function birdGlow(ctx: Ctx, g: BirdGeo) {
  const p = g.pose;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  birdSilhouette(ctx, g, '#000', g.ow);
  ctx.restore();
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = p.s;
  // Embers in the quills while still ash.
  if (p.ember > 0) {
    for (const b of g.blades) {
      const a = p.ember * (1 - b.k);
      if (a <= 0.01) continue;
      const n = b.pts.length;
      ctx.beginPath();
      ctx.moveTo(b.pts[1].x, b.pts[1].y);
      for (let i = 2; i < Math.round(n * 0.75); i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
      ctx.strokeStyle = rgba('#ff6a1c', 0.85 * a);
      ctx.lineWidth = Math.max(1, 2.6 * s);
      ctx.stroke();
    }
    emberCracks(ctx, g, p.ember * (1 - g.body));
  }
  for (const b of g.blades) {
    if (b.k <= 0) continue;
    if (b.flash > 0.01) {
      edgePath(ctx, b.T, b.Ld);
      ctx.fillStyle = rgba('#fff3d2', 0.55 * b.flash);
      ctx.fill();
    }
    // The leading edge's rim.
    ctx.beginPath();
    const n = b.Ld.length;
    ctx.moveTo(b.Ld[1].x, b.Ld[1].y);
    for (let i = 2; i < n - 2; i++) ctx.lineTo(b.Ld[i].x, b.Ld[i].y);
    ctx.strokeStyle = rgba('#ffd98a', (b.kind === 'prim' ? 0.28 : 0.42) * b.k);
    ctx.lineWidth = Math.max(1, 2.4 * s);
    ctx.stroke();
    if (b.kind === 'prim' || b.kind === 'sec') tongue(ctx, b.pts, b.w * (b.kind === 'prim' ? 0.8 : 1), b.len * (b.kind === 'prim' ? 0.2 : 0.28), b.k, p.t, b.i);
  }
  for (const q of g.crest) tongue(ctx, q.pts, q.w * 1.2, q.w * 9, q.k, p.t, 40 + q.i);
  for (const q of g.tail) {
    if (q.k <= 0) continue;
    // A hot line down the middle of each plume.
    ctx.beginPath();
    ctx.moveTo(q.pts[1].x, q.pts[1].y);
    for (let i = 2; i < q.pts.length - 1; i++) ctx.lineTo(q.pts[i].x, q.pts[i].y);
    ctx.strokeStyle = rgba('#ffe2a0', 0.55 * q.k);
    ctx.lineWidth = Math.max(1, 3 * s);
    ctx.stroke();
    if (!q.eye) tongue(ctx, q.pts, q.w * 1.1, q.w * 8, q.k, p.t, 60 + q.i);
  }
  // The rim of the torso and neck.
  if (g.body > 0) {
    ctx.strokeStyle = rgba('#ffe0a0', 0.45 * g.body);
    ctx.lineWidth = Math.max(1, 2.5 * s);
    polyPath(ctx, g.torso);
    ctx.stroke();
  }
  // The eye: a white-hot point.
  const e = g.eyeAt, er = Math.max(2, 5 * s);
  const gr = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, er * 4);
  gr.addColorStop(0, rgba('#ffffff', 0.4 + 0.6 * Math.max(g.body, p.ember)));
  gr.addColorStop(0.3, rgba('#ffd27a', 0.6 * Math.max(g.body, p.ember)));
  gr.addColorStop(1, rgba('#ff7a2a', 0));
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(e.x, e.y, er * 4, 0, Math.PI * 2);
  ctx.fill();
  if (p.heat > 0) birdSilhouette(ctx, g, rgba('#fff6e4', p.heat), g.ow);
  ctx.restore();
}

/** A flame tongue off a feather's tip, carrying on its line and flickering (glow). */
function tongue(ctx: Ctx, pts: Pt[], w: number, len: number, k: number, t: number, seed: number) {
  if (k <= 0) return;
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const fl = 0.75 + 0.25 * Math.sin(t * 13 + seed * 1.7) + 0.12 * Math.sin(t * 29 + seed);
  const ph = t * 14 + seed;
  const sp = curlSpine(a, ang, len * fl + Math.hypot(b.x - a.x, b.y - a.y), 0, 10, (u) => 0.35 * Math.sin(u * 5 - ph) * u);
  const n = sp.length - 1;
  const outer = ribbonEdges(sp, (j) => w * 0.55 * (1 - j / n) ** 0.9);
  edgePath(ctx, outer.left, outer.right);
  ctx.fillStyle = rgba('#ff6a1a', 0.7 * k);
  ctx.fill();
  const inner = ribbonEdges(sp, (j) => w * 0.22 * (1 - j / n) ** 0.9);
  edgePath(ctx, inner.left, inner.right);
  ctx.fillStyle = rgba('#ffe08a', 0.9 * k);
  ctx.fill();
}

/** Fine cracks of fire through the ash body (glow). */
function emberCracks(ctx: Ctx, g: BirdGeo, k: number) {
  if (k <= 0.01) return;
  const { x, y, s } = g.pose;
  const r = rng(717);
  ctx.strokeStyle = rgba('#ff7a2a', 0.9 * k);
  ctx.lineWidth = Math.max(1, 2.4 * s);
  for (let i = 0; i < 9; i++) {
    let px = r.range(-55, 55), py = r.range(-110, 140);
    ctx.beginPath();
    ctx.moveTo(x + px * s, y + py * s);
    for (let j = 0; j < 4; j++) {
      px += r.range(-22, 22);
      py += r.range(8, 30);
      ctx.lineTo(x + px * s, y + py * s);
    }
    ctx.stroke();
  }
  // Along the neck's middle.
  ctx.beginPath();
  const np = g.neck.pts;
  ctx.moveTo(np[2].x, np[2].y);
  for (let i = 3; i < np.length - 2; i++) ctx.lineTo(np[i].x + Math.sin(i * 2.3) * 5 * s, np[i].y);
  ctx.stroke();
}
