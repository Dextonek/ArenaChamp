import { clamp, lerp, rgba, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { GOLD, INK, LAPIS, P, TURQ, mirrored, smoothClosed, smoothOpen } from './palette';
import { wing } from './sky';

/**
 * The Sun Scarab: a sacred scarab seen from above, as an amulet is, head up, built like a jewel. A fan-shaped head with six
 * ray teeth, a broad shield (the pronotum), two wing cases with lapis inlays set in gold, a turquoise shoulder cell each,
 * and six legs with toothed shins; the front pair is raised to hold the sun.
 *
 * Drawn in local units round the body's middle (the join of shield and wing cases), about 520 long from the head's teeth
 * to the wing cases' tip; `scale` 1 is that size in picture units. Light comes from the top left, as hard cel shapes.
 */

export interface BeetlePose {
  x: number;
  y: number;
  /** Radians; 0 is head up. */
  angle: number;
  scale: number;
  /** The wing cases lifted and the hind wings out, 0 to 1. */
  spread?: number;
  /** Walking: a phase in radians (the legs swing round it), and how much (0 still). */
  gait?: number;
  stride?: number;
}

type Mode = 'gold' | 'ink' | 'solid';
export interface BeetleStyle {
  mode?: Mode;
  /** The fill for 'solid' and the paper for 'ink'. */
  color?: string;
  /** Outline width in local units. */
  ow?: number;
  /** In 'ink': the inlays' colours (ink, and the paper, by default). */
  inlay?: string;
  inlay2?: string;
}

/** Where the sun sits in the scarab's frame (held up by the front legs), and its radius, in local units. */
export const DISC_AT: Pt = { x: 0, y: -440 };
export const DISC_R = 150;

// ---------------------------------------------------------------- shapes (made once, in local units)

interface Shapes {
  head: Path2D;
  pronotum: Path2D;
  elytron: Path2D;
  scutellum: Path2D;
  abdomen: Path2D;
  inlayA: Path2D;
  inlayB: Path2D;
  shoulder: Path2D;
  pronInlay: Path2D;
  pronSide: Path2D;
}
let shapes: Shapes | null = null;

/** The head, a fan with six ray teeth round H. */
const H = P(0, -186);
function headPts(): Pt[] {
  const pol = (deg: number, r: number) => P(H.x + Math.sin((deg * Math.PI) / 180) * r, H.y - Math.cos((deg * Math.PI) / 180) * r);
  const right = [pol(0, 74), pol(12, 104), pol(24, 82), pol(38, 106), pol(52, 84), pol(66, 102), pol(82, 80), pol(96, 74), P(64, -144), P(30, -136), P(0, -134)];
  return mirrored(right);
}

function ribbonPath(pts: Pt[], width: (u: number) => number) {
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const w = width(i / (pts.length - 1)) / 2;
    left.push(P(pts[i].x + nx * w, pts[i].y + ny * w));
    right.push(P(pts[i].x - nx * w, pts[i].y - ny * w));
  }
  const p = new Path2D();
  smoothOpen(p, left);
  p.lineTo(right[right.length - 1].x, right[right.length - 1].y);
  smoothOpen(p, right.reverse(), false);
  p.closePath();
  return p;
}

function makeShapes(): Shapes {
  const head = new Path2D();
  const hp = headPts();
  head.moveTo(hp[0].x, hp[0].y);
  for (const q of hp) head.lineTo(q.x, q.y);
  head.closePath();

  const pronotum = new Path2D();
  smoothClosed(pronotum, mirrored([P(0, -150), P(62, -160), P(112, -166), P(140, -150), P(166, -110), P(178, -66), P(168, -30), P(146, -10), P(96, -2), P(0, 2)]));

  const elytron = new Path2D();
  elytron.moveTo(6, 0);
  smoothOpen(elytron, [P(6, 0), P(64, -4), P(126, -6), P(160, 8), P(176, 50), P(180, 110), P(170, 170), P(142, 222), P(96, 254), P(46, 268), P(6, 270)], false);
  elytron.closePath();

  const scutellum = new Path2D();
  scutellum.moveTo(-26, 0);
  scutellum.lineTo(26, 0);
  scutellum.lineTo(0, 44);
  scutellum.closePath();

  const abdomen = new Path2D();
  abdomen.ellipse(0, 120, 128, 150, 0, 0, Math.PI * 2);

  // Lapis inlays on each wing case: two long tapering stripes following its curve.
  const inlayA = ribbonPath([P(46, 34), P(48, 100), P(46, 170), P(40, 228)], (u) => 34 * (1 - 0.55 * u));
  const inlayB = ribbonPath([P(112, 44), P(122, 100), P(120, 160), P(100, 210)], (u) => 32 * (1 - 0.6 * u));
  const shoulder = new Path2D();
  smoothClosed(shoulder, [P(104, 14), P(140, 14), P(158, 30), P(150, 44), P(116, 40)]);

  // The shield's inlay: a lapis frame inset round its edge (the head covers its front middle).
  const pronInlay = new Path2D();
  smoothClosed(pronInlay, mirrored([P(0, -138), P(60, -144), P(112, -140), P(140, -104), P(146, -64), P(128, -34), P(70, -24), P(0, -22)]));
  const pronSide = new Path2D();
  for (const x of [-60, -30, 0, 30, 60]) pronSide.ellipse(x, -58, 9, 9, 0, 0, Math.PI * 2);

  return { head, pronotum, elytron, scutellum, abdomen, inlayA, inlayB, shoulder, pronInlay, pronSide };
}

// ---------------------------------------------------------------- legs

interface Leg { coxa: Pt; knee: Pt; foot: Pt; toe: Pt; w1: number; w2: number; teeth: number; phase: number }
const LEGS: Leg[] = [
  // The front pair, raised to hold the sun.
  { coxa: P(96, -128), knee: P(206, -214), foot: P(160, -318), toe: P(116, -350), w1: 40, w2: 40, teeth: 3, phase: 0 },
  // The middle pair, out to the side.
  { coxa: P(146, -18), knee: P(262, -36), foot: P(322, 86), toe: P(352, 150), w1: 36, w2: 32, teeth: 2, phase: Math.PI },
  // The hind pair, long, back.
  { coxa: P(132, 76), knee: P(250, 128), foot: P(266, 270), toe: P(276, 344), w1: 36, w2: 30, teeth: 2, phase: 0 },
];

const rot = (p: Pt, o: Pt, a: number): Pt => {
  const c = Math.cos(a), s = Math.sin(a), x = p.x - o.x, y = p.y - o.y;
  return P(o.x + x * c - y * s, o.y + x * s + y * c);
};

function legPaths(leg: Leg, swing: number) {
  const k = rot(leg.knee, leg.coxa, swing);
  const f = rot(leg.foot, leg.coxa, swing * 1.3);
  const toe = rot(leg.toe, leg.coxa, swing * 1.4);
  const femur = taper(leg.coxa, k, leg.w1, leg.w1 * 0.62);
  const tibia = taper(k, f, leg.w2 * 0.5, leg.w2);
  // Teeth on the outer edge of the shin, near its end.
  const teeth = new Path2D();
  const dx = f.x - k.x, dy = f.y - k.y, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
  // The outer side is away from the body (x > 0 side of the shin's line).
  let nx = -uy, ny = ux;
  if (nx < 0) { nx = -nx; ny = -ny; }
  for (let i = 0; i < leg.teeth; i++) {
    const u = 0.5 + i * 0.2;
    const bx = k.x + dx * u, by = k.y + dy * u;
    const w = leg.w2 * (0.5 + 0.5 * u) * 0.5;
    teeth.moveTo(bx + nx * w - ux * 12, by + ny * w - uy * 12);
    teeth.lineTo(bx + nx * (w + 22) + ux * 6, by + ny * (w + 22) + uy * 6);
    teeth.lineTo(bx + nx * w + ux * 10, by + ny * w + uy * 10);
    teeth.closePath();
  }
  return { femur, tibia, teeth, k, f, toe };
}

/** A limb segment: a rounded tapered bar from a (width wa) to b (width wb). */
function taper(a: Pt, b: Pt, wa: number, wb: number) {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const p = new Path2D();
  p.moveTo(a.x + nx * wa / 2, a.y + ny * wa / 2);
  p.lineTo(b.x + nx * wb / 2, b.y + ny * wb / 2);
  p.arc(b.x, b.y, wb / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
  p.lineTo(a.x - nx * wa / 2, a.y - ny * wa / 2);
  p.arc(a.x, a.y, wa / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
  p.closePath();
  return p;
}

// ---------------------------------------------------------------- shading

type Pal = { hi: string; base: string; sh: string };

/**
 * Hard cel shading inside a shape: a highlight rim at the top left, the base, a shadow crescent at the bottom right with a
 * dot screen in it, then the outline. `m` is the mirror (-1 for the left half) so the light stays at the top left.
 */
function cel(ctx: Ctx, path: Path2D, c: Pal, m: number, a: number, b: number, ow: number, dots = true, box?: [number, number, number, number]) {
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = c.hi;
  ctx.fill(path);
  ctx.save();
  ctx.translate(b * m, b);
  ctx.fillStyle = c.base;
  ctx.fill(path);
  ctx.restore();
  const sh = new Path2D();
  sh.rect(-3000, -3000, 6000, 6000);
  sh.addPath(path, new DOMMatrix().translate(-a * m, -a));
  ctx.fillStyle = c.sh;
  ctx.fill(sh, 'evenodd');
  if (dots && box) {
    ctx.clip(sh, 'evenodd');
    halftone(ctx, rgba(INK, 0.28), 10, () => 0.55, { x: box[0], y: box[1], w: box[2], h: box[3] });
  }
  ctx.restore();
  if (ow > 0) {
    ctx.lineWidth = ow;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.stroke(path);
  }
}

function fillOnly(ctx: Ctx, path: Path2D, color: string, ow: number, line = INK) {
  ctx.fillStyle = color;
  ctx.fill(path);
  if (ow > 0) {
    ctx.lineWidth = ow;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = line;
    ctx.stroke(path);
  }
}

// ---------------------------------------------------------------- the figure

/** Puts the context into the scarab's frame. Call `ctx.restore()` after. */
export function beetleFrame(ctx: Ctx, p: BeetlePose) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.scale(p.scale, p.scale);
}

/** A point of the scarab's frame in picture units. */
export function beetlePoint(p: BeetlePose, q: Pt): Pt {
  const c = Math.cos(p.angle), s = Math.sin(p.angle);
  return { x: p.x + (q.x * c - q.y * s) * p.scale, y: p.y + (q.x * s + q.y * c) * p.scale };
}

/** Where the scarab's sun is, in picture units, and its radius. */
export function discOf(p: BeetlePose) {
  const c = beetlePoint(p, DISC_AT);
  return { x: c.x, y: c.y, r: DISC_R * p.scale };
}

/**
 * The scarab. 'gold' is the jewel; 'ink' is a line drawing on `color` (the impact frame, the papyrus at the end); 'solid'
 * is a flat silhouette in `color` (to cut light away, or stand black against it).
 */
export function beetle(ctx: Ctx, p: BeetlePose, style: BeetleStyle = {}) {
  shapes ??= makeShapes();
  const S = shapes;
  const mode = style.mode ?? 'gold';
  const ow = style.ow ?? 7;
  const spread = clamp(p.spread ?? 0);
  const gait = p.gait ?? 0, stride = p.stride ?? 0;
  const paperCol = style.color ?? '#efe2c2';
  beetleFrame(ctx, p);

  // The wings, under everything, when the wing cases open: feathered like a falcon's, as on the old pectorals.
  if (spread > 0.01) {
    for (const m of [1, -1]) {
      ctx.save();
      ctx.scale(m, 1);
      ctx.translate(70, -30);
      ctx.rotate(lerp(1.2, -0.12, spread));
      wing(ctx, 560 * (0.35 + 0.65 * spread), 150, spread, mode, mode === 'solid' ? style.color : paperCol, ow * 0.85);
      ctx.restore();
    }
  }
  // The body under the wing cases (seen when they open).
  if (spread > 0.01) {
    if (mode === 'solid') fillOnly(ctx, S.abdomen, style.color!, 0);
    else {
      fillOnly(ctx, S.abdomen, mode === 'ink' ? paperCol : '#7a4610', ow);
      ctx.strokeStyle = mode === 'ink' ? INK : GOLD.sh;
      ctx.lineWidth = 5;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 40 + i * 40, 110 - i * 12, 26, 0, 0.15, Math.PI - 0.15);
        ctx.stroke();
      }
    }
  }

  // Legs, both sides; the tripod gait swings opposite legs together.
  for (const m of [1, -1]) {
    for (let i = 0; i < LEGS.length; i++) {
      const leg = LEGS[i];
      const swing = stride * Math.sin(gait + leg.phase + (m < 0 ? Math.PI : 0)) * (i === 0 ? 0.35 : 1);
      const g = legPaths(leg, swing);
      ctx.save();
      ctx.scale(m, 1);
      if (mode === 'solid') {
        fillOnly(ctx, g.femur, style.color!, 0);
        fillOnly(ctx, g.tibia, style.color!, 0);
        fillOnly(ctx, g.teeth, style.color!, 0);
      } else if (mode === 'ink') {
        fillOnly(ctx, g.teeth, INK, 0);
        fillOnly(ctx, g.tibia, paperCol, ow * 0.8);
        fillOnly(ctx, g.femur, paperCol, ow * 0.8);
      } else {
        const legPal = { hi: GOLD.hi, base: '#d8901e', sh: GOLD.deep };
        fillOnly(ctx, g.teeth, GOLD.sh, ow * 0.6);
        cel(ctx, g.tibia, legPal, m, 9, 5, ow * 0.8, false);
        cel(ctx, g.femur, legPal, m, 10, 5, ow * 0.8, false);
      }
      // The foot: three beads and a claw.
      const dx = g.toe.x - g.f.x, dy = g.toe.y - g.f.y;
      for (let j = 0; j < 3; j++) {
        const u = 0.18 + j * 0.3, r = 9 - j * 1.5;
        const c = P(g.f.x + dx * u, g.f.y + dy * u);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, r * 1.3, r, Math.atan2(dy, dx), 0, Math.PI * 2);
        ctx.fillStyle = mode === 'solid' ? style.color! : mode === 'ink' ? paperCol : GOLD.sh;
        ctx.fill();
        if (mode !== 'solid') { ctx.lineWidth = ow * 0.55; ctx.strokeStyle = INK; ctx.stroke(); }
      }
      ctx.beginPath();
      ctx.moveTo(g.f.x + dx * 0.95, g.f.y + dy * 0.95);
      ctx.lineTo(g.toe.x + dx * 0.12, g.toe.y + dy * 0.12);
      ctx.lineWidth = ow * 0.7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = mode === 'solid' ? style.color! : INK;
      ctx.stroke();
      ctx.restore();
    }
  }

  // The wing cases, lifting out from their shoulders as they open.
  for (const m of [1, -1]) {
    ctx.save();
    ctx.scale(m, 1);
    // Hinged at the outer shoulder, they swing out like doors.
    ctx.translate(150, 0);
    ctx.rotate(-0.78 * spread);
    ctx.translate(-150, 0);
    if (mode === 'solid') fillOnly(ctx, S.elytron, style.color!, 0);
    else if (mode === 'ink') {
      fillOnly(ctx, S.elytron, paperCol, ow);
      fillOnly(ctx, S.inlayA, style.inlay ?? INK, ow * 0.4);
      fillOnly(ctx, S.inlayB, style.inlay ?? INK, ow * 0.4);
      fillOnly(ctx, S.shoulder, style.inlay2 ?? paperCol, ow * 0.6);
    } else {
      cel(ctx, S.elytron, GOLD, m, 26, 9, 0, true, [0, -10, 190, 290]);
      // Gold cloisons round the inlays, then the lapis and the turquoise.
      ctx.lineWidth = 12;
      ctx.strokeStyle = GOLD.sh;
      ctx.stroke(S.inlayA);
      ctx.stroke(S.inlayB);
      cel(ctx, S.inlayA, LAPIS, m, 10, 5, 3.5, false);
      cel(ctx, S.inlayB, LAPIS, m, 10, 5, 3.5, false);
      ctx.lineWidth = 10;
      ctx.strokeStyle = GOLD.sh;
      ctx.stroke(S.shoulder);
      cel(ctx, S.shoulder, TURQ, m, 7, 4, 3, false);
      // A specular streak along the outer edge.
      if (m > 0) {
        ctx.save();
        ctx.clip(S.elytron);
        ctx.fillStyle = 'rgba(255,250,225,0.95)';
        const st = ribbonPath([P(150, 40), P(160, 90), P(158, 140)], (u) => 9 * Math.sin(Math.PI * u));
        ctx.fill(st);
        ctx.restore();
      } else {
        ctx.save();
        ctx.clip(S.elytron);
        ctx.fillStyle = 'rgba(255,250,225,0.95)';
        ctx.fill(ribbonPath([P(160, 36), P(172, 100), P(166, 170), P(144, 214)], (u) => 12 * Math.sin(Math.PI * u)));
        ctx.restore();
      }
      fillOnly(ctx, S.elytron, 'rgba(0,0,0,0)', ow);
    }
    ctx.restore();
  }

  // The shield and its inlays.
  if (mode === 'solid') fillOnly(ctx, S.pronotum, style.color!, 0);
  else if (mode === 'ink') {
    fillOnly(ctx, S.pronotum, paperCol, ow);
    ctx.lineCap = 'round';
    ctx.lineWidth = 22;
    ctx.strokeStyle = INK;
    ctx.stroke(S.pronInlay);
    if (style.inlay) {
      ctx.lineWidth = 13;
      ctx.strokeStyle = style.inlay;
      ctx.stroke(S.pronInlay);
    }
  } else {
    // Shaded as two halves so the light stays top left on both.
    ctx.save();
    ctx.clip(S.pronotum);
    for (const m of [1, -1]) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(m > 0 ? 0 : -400, -400, 400, 800);
      ctx.clip();
      ctx.scale(m, 1);
      cel(ctx, S.pronotum, GOLD, m, 22, 8, 0, true, [0, -170, 190, 180]);
      ctx.restore();
    }
    ctx.restore();
    // The lapis band set in gold: an ink edge, the gold cloison, the stone, a fine light line on it.
    ctx.lineCap = 'round';
    for (const [w, c] of [[34, INK], [28, GOLD.sh], [19, LAPIS.base]] as const) {
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.stroke(S.pronInlay);
    }
    ctx.save();
    ctx.translate(-3, -4);
    ctx.lineWidth = 4;
    ctx.strokeStyle = LAPIS.hi;
    ctx.stroke(S.pronInlay);
    ctx.restore();
    // A row of turquoise beads across the middle.
    ctx.lineWidth = 9;
    ctx.strokeStyle = GOLD.sh;
    ctx.stroke(S.pronSide);
    ctx.fillStyle = TURQ.base;
    ctx.fill(S.pronSide);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke(S.pronSide);
    ctx.fillStyle = 'rgba(255,250,225,0.95)';
    ctx.fill(ribbonPath([P(-150, -140), P(-120, -158), P(-70, -164)], (u) => 10 * Math.sin(Math.PI * u)));
    fillOnly(ctx, S.pronotum, 'rgba(0,0,0,0)', ow);
  }
  // The small gold triangle between the wing cases.
  if (mode === 'solid') fillOnly(ctx, S.scutellum, style.color!, 0);
  else fillOnly(ctx, S.scutellum, mode === 'ink' ? paperCol : GOLD.base, ow * 0.7);

  // The head: the ray-toothed fan, with grooves running out to its teeth.
  if (mode === 'solid') fillOnly(ctx, S.head, style.color!, 0);
  else {
    if (mode === 'ink') fillOnly(ctx, S.head, paperCol, 0);
    else {
      ctx.save();
      ctx.clip(S.head);
      for (const m of [1, -1]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(m > 0 ? 0 : -300, -400, 300, 400);
        ctx.clip();
        ctx.scale(m, 1);
        cel(ctx, S.head, GOLD, m, 16, 7, 0, false);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.strokeStyle = mode === 'ink' ? INK : GOLD.deep;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (const deg of [-52, -26, 0, 26, 52]) {
      const a = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(H.x + Math.sin(a) * 26, H.y - Math.cos(a) * 26);
      ctx.lineTo(H.x + Math.sin(a) * 70, H.y - Math.cos(a) * 70);
      ctx.stroke();
    }
    // The eyes, at the head's back corners.
    for (const m of [1, -1]) {
      ctx.beginPath();
      ctx.ellipse(m * 70, -150, 13, 9, m * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = mode === 'ink' ? INK : LAPIS.sh;
      ctx.fill();
    }
    fillOnly(ctx, S.head, 'rgba(0,0,0,0)', ow);
  }
  ctx.restore();
}

/** The scarab's outline as one filled shape in `color` (to cut light away behind it). */
export function beetleSilhouette(ctx: Ctx, p: BeetlePose, color: string) {
  beetle(ctx, p, { mode: 'solid', color });
}
