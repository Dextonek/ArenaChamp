import { clamp, lerp, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { FOAM, GOLD, LINE, TEAL_LIGHT } from './common';

/**
 * The water dragon: a long body rising out of the whirlpool's throat in a spiral round an upright axis, cel-shaded
 * (Prussian back, teal flank, a pale gold belly of plates), scales cut as scallops, a foam fin along its back, and the
 * head: a long snout under a heavy brow, an open jaw with white fangs, gold antler horns, a foam mane and gold whiskers.
 *
 * The body follows one path in space: the head travels along it and the body is its trail, so it comes out of the water
 * as a snake would. Parts behind the axis are drawn first, then the front, each half-turn as one run (one outline, one
 * fill), so it overlaps itself correctly. The glow layer is erased under each run before that run's light is drawn, so a
 * near coil hides the light of a far one and of the moon.
 */

export interface DragonPose {
  /** The axis of the spiral: x, and the water's y. */
  ax: number;
  ay: number;
  /** 0..1: how far the head has come along its path. */
  emerge: number;
  /** 0..1: how wide the jaw is open. */
  roar: number;
  t: number;
  /** 0..1 glow strength. */
  light: number;
}

/** Turns, height, body length (in path units) and the spiral's tilt. */
const TURNS = 1.75;
const HEIGHT = 660;
const BODY = 1.08;
const TILT = 0.44;

interface BodyPt { x: number; y: number; depth: number; w: number; s: number; under: boolean; nx?: number; ny?: number }

const sway = wobble(4001);

/** A point of the path at u (0 in the throat, 1 at the top). */
function pathAt(p: DragonPose, u: number) {
  const phi = Math.PI / 2 - Math.PI * 2 * TURNS * (1 - u);
  const R = 40 + 390 * clamp(u) ** 0.7 + 14 * sway(u * 4 + p.t * 0.9) * clamp(u * 4);
  const h = HEIGHT * u;
  return {
    x: p.ax + Math.cos(phi) * R,
    y: p.ay - h + Math.sin(phi) * R * TILT,
    depth: Math.sin(phi),
  };
}

/** The body as points from the tail (s = 0) to the head (s = 1). */
export function bodyPoints(p: DragonPose, n = 160): BodyPt[] {
  const head = lerp(-0.05, 1, p.emerge);
  const out: BodyPt[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const u = head - BODY * (1 - s);
    const q = pathAt(p, u);
    const persp = 1 + 0.12 * q.depth;
    const w = (16 + 72 * Math.sin(Math.PI * Math.min(1, s * 0.6 + 0.04)) ** 0.7) * persp;
    out.push({ x: q.x, y: q.y, depth: q.depth, w, s, under: u < 0 });
  }
  return out;
}

/** Where the body goes into the water. */
export function entryPoint(p: DragonPose): Pt {
  const q = pathAt(p, 0);
  return { x: q.x, y: q.y };
}

/** Splits the body into runs of the same side (behind or before the axis), overlapping by one point. */
function runs(pts: BodyPt[]) {
  const out: BodyPt[][] = [];
  let cur: BodyPt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (cur.length && (cur[cur.length - 1].depth >= 0) !== (p.depth >= 0)) {
      cur.push(p);
      out.push(cur);
      cur = [pts[i - 1]];
    }
    cur.push(p);
  }
  if (cur.length > 1) out.push(cur);
  return out
    .map((r) => ({ r, d: r.reduce((a, b) => a + b.depth, 0) / r.length }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.r);
}

/** Normal (left-hand) at i of a polyline (the body's own, worked out over the whole body, when it has one). */
function normalAt(pts: Pt[], i: number) {
  const q = pts[i] as BodyPt;
  if (q.nx !== undefined && q.ny !== undefined) return { nx: q.nx, ny: q.ny };
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  let nx = -(b.y - a.y), ny = b.x - a.x;
  const l = Math.hypot(nx, ny) || 1;
  nx /= l; ny /= l;
  return { nx, ny };
}

/** A ribbon's path (no fill), widths from `w(i)`, shifted sideways by `shift(i)`. */
function ribbonPath(ctx: Ctx, pts: Pt[], w: (i: number) => number, shift: (i: number) => number = () => 0) {
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const { nx, ny } = normalAt(pts, i);
    const hw = w(i) / 2, c = shift(i);
    left.push({ x: pts[i].x + nx * (c + hw), y: pts[i].y + ny * (c + hw) });
    right.push({ x: pts[i].x + nx * (c - hw), y: pts[i].y + ny * (c - hw) });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const q of left) ctx.lineTo(q.x, q.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
}

/** Which side the belly is on: the side facing down on screen. */
function bellySide(pts: Pt[]) {
  const mid = Math.floor(pts.length / 2);
  const { ny } = normalAt(pts, mid);
  return ny > 0 ? 1 : -1;
}

/**
 * The dorsal fin along a run's back, as a closed path: its base along the back edge, its free edge cut into swept-back
 * points (one per few body points), each point leaning towards the tail. Returns the ray lines too.
 */
function finPath(ctx: Ctx, run: BodyPt[], side: number, t: number) {
  const base: Pt[] = [], edge: Pt[] = [], rays: [Pt, Pt][] = [];
  for (let i = 0; i < run.length; i++) {
    const p = run[i];
    const { nx, ny } = normalAt(run, i);
    const j = Math.max(0, i - 1), k = Math.min(run.length - 1, i + 1);
    let tx = run[k].x - run[j].x, ty = run[k].y - run[j].y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    // Height: a sawtooth (each tooth rises towards its point and drops), fading at the neck and the tail.
    const ph = ((p.s * 46 + 0.35 * Math.sin(p.s * 23) + 0.2 * Math.sin(p.s * 57) + t * 0.6) % 1 + 1) % 1;
    const tooth = 0.35 + 0.65 * ph ** 1.6;
    const ends = clamp(p.s * 8 - 0.4) * clamp((0.95 - p.s) * 14);
    const h = p.w * 0.62 * tooth * ends;
    const b = { x: p.x + nx * side * p.w * 0.4, y: p.y + ny * side * p.w * 0.4 };
    const e = { x: b.x + nx * side * h - tx * h * 0.7, y: b.y + ny * side * h - ty * h * 0.7 };
    base.push(b);
    edge.push(e);
    if (ph > 0.8 && ends > 0.3) rays.push([b, e]);
  }
  ctx.beginPath();
  ctx.moveTo(base[0].x, base[0].y);
  for (const q of edge) ctx.lineTo(q.x, q.y);
  for (let i = base.length - 1; i >= 0; i--) ctx.lineTo(base[i].x, base[i].y);
  ctx.closePath();
  return rays;
}

/** One run of the body on the flat layer. */
function runFlat(ctx: Ctx, run: BodyPt[], t: number, shade: number) {
  const side = -bellySide(run);
  const far = shade < 0;
  // The fin behind the body's edge.
  const rays = finPath(ctx, run, side, t);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = far ? '#9fc4cc' : '#e4f4f0';
  ctx.fill();
  ctx.strokeStyle = far ? 'rgba(40,90,110,0.6)' : 'rgba(60,130,150,0.75)';
  ctx.lineWidth = 2.5;
  for (const [a, b] of rays) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // The outline, then the body.
  ctx.fillStyle = LINE;
  ribbonPath(ctx, run, (i) => run[i].w + 12);
  ctx.fill();
  ctx.fillStyle = far ? '#0c2c4c' : '#123c64';
  ribbonPath(ctx, run, (i) => run[i].w);
  ctx.fill();
  ctx.save();
  ribbonPath(ctx, run, (i) => run[i].w);
  ctx.clip();
  // The flank: a lighter band on the belly side.
  ctx.fillStyle = far ? '#1b5f7a' : '#23809a';
  ribbonPath(ctx, run, (i) => run[i].w * 0.55, (i) => -side * run[i].w * 0.2);
  ctx.fill();
  // Scales: rows of scallops, open towards the tail.
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = far ? 'rgba(90,170,190,0.35)' : 'rgba(140,220,225,0.55)';
  for (let i = 1; i < run.length - 1; i += 1) {
    const p = run[i];
    const { nx, ny } = normalAt(run, i);
    const dir = Math.atan2(run[i + 1].y - run[i - 1].y, run[i + 1].x - run[i - 1].x);
    const sc = p.w * 0.13;
    for (let r = -2; r <= 2; r++) {
      const off = (r + (i % 2) * 0.5) * sc * 1.6;
      if (Math.abs(off) > p.w * 0.42) continue;
      ctx.beginPath();
      ctx.arc(p.x + nx * off, p.y + ny * off, sc, dir + Math.PI / 2, dir + Math.PI * 1.5);
      ctx.stroke();
    }
  }
  // The belly: pale gold plates along the lower edge.
  ctx.fillStyle = far ? '#9a8a5e' : '#e6d29a';
  ribbonPath(ctx, run, (i) => run[i].w * 0.26, (i) => -side * run[i].w * 0.4);
  ctx.fill();
  ctx.strokeStyle = far ? 'rgba(60,50,30,0.6)' : 'rgba(110,84,40,0.7)';
  ctx.lineWidth = 2;
  for (let i = 1; i < run.length - 1; i += 2) {
    const p = run[i];
    const { nx, ny } = normalAt(run, i);
    const a = -side * p.w * 0.27, b = -side * p.w * 0.53;
    ctx.beginPath();
    ctx.moveTo(p.x + nx * a, p.y + ny * a);
    ctx.lineTo(p.x + nx * b, p.y + ny * b);
    ctx.stroke();
  }
  ctx.restore();
}

/** One run's light on the glow layer: erase under it (body and fin), then a ridge line and glints on its scales. */
function runGlow(ctx: Ctx, run: BodyPt[], t: number, k: number) {
  const side = -bellySide(run);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ribbonPath(ctx, run, (i) => run[i].w + 14);
  ctx.fill();
  finPath(ctx, run, side, t);
  ctx.lineWidth = 8;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  if (k <= 0) return;
  const front = run.reduce((a, b) => a + b.depth, 0) / run.length > 0 ? 1 : 0.45;
  // A teal line along the ridge, inside the outline, and a fainter one on the fin's edge.
  ctx.fillStyle = rgba(TEAL_LIGHT, 0.75 * k * front);
  ribbonPath(ctx, run, (i) => 3.5 * Math.min(1, run[i].s * 6), (i) => side * run[i].w * 0.38);
  ctx.fill();
  // Glints: a few scales catching the light, flickering along the body.
  const r = rng(77 + Math.floor(t * 12));
  for (let i = 1; i < run.length - 1; i++) {
    if (r.next() > 0.16) continue;
    const p = run[i];
    const { nx, ny } = normalAt(run, i);
    const off = r.range(-0.3, 0.35) * p.w * side;
    const dir = Math.atan2(run[i + 1].y - run[i - 1].y, run[i + 1].x - run[i - 1].x);
    ctx.beginPath();
    ctx.arc(p.x + nx * off, p.y + ny * off, p.w * 0.13, dir + Math.PI / 2, dir + Math.PI * 1.5);
    ctx.strokeStyle = rgba(r.next() < 0.75 ? TEAL_LIGHT : '#ffffff', 0.85 * k * front);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

/** Where the head is and which way the neck runs (radians). */
export function headFrame(p: DragonPose) {
  const pts = bodyPoints(p);
  const a = pts[pts.length - 4], b = pts[pts.length - 1];
  return { x: b.x, y: b.y, angle: Math.atan2(b.y - a.y, b.x - a.x), w: b.w, depth: b.depth };
}

/** The whole dragon: body runs in depth order, the foam where it leaves the water, then the head; both layers. */
export function dragon(flat: Ctx, glow: Ctx, p: DragonPose) {
  const pts = bodyPoints(p);
  const visible = pts.filter((q) => !q.under);
  if (visible.length < 3) return;
  // Normals over the whole body, so that runs meet without a seam.
  visible.forEach((q, i) => {
    const { nx, ny } = normalAt(visible.map((v) => ({ x: v.x, y: v.y })), i);
    q.nx = nx;
    q.ny = ny;
  });
  const hf = headFrame(p);
  for (const run of runs(visible)) {
    const d = run.reduce((a, b) => a + b.depth, 0) / run.length;
    runFlat(flat, run, p.t, d);
    runGlow(glow, run, p.t, p.light);
  }
  collar(flat, glow, entryPoint(p), p.t, clamp(visible.length / 30));
  // Water shed off the body: bright drops falling from the coils (glow layer).
  if (p.light > 0) {
    const r = rng(5353);
    for (let i = 0; i < 70; i++) {
      const q = visible[Math.floor(r.next() * visible.length)];
      const life = r.range(0.5, 1.0), age = ((p.t + r.range(0, life)) % life) / life;
      const x = q.x + r.range(-0.4, 0.4) * q.w, y = q.y + q.w * 0.4 + age * age * r.range(120, 260);
      glow.fillStyle = rgba(r.next() < 0.6 ? TEAL_LIGHT : '#ffffff', p.light * (1 - age) * 0.9);
      glow.beginPath();
      glow.ellipse(x, y, r.range(1.5, 3), r.range(3, 7), 0, 0, Math.PI * 2);
      glow.fill();
    }
  }
  if (pts[pts.length - 1].under) return;
  // The head faces along the neck but settles to face left, a little down, as it comes to the top.
  const settle = clamp((p.emerge - 0.8) / 0.2);
  let ang = hf.angle;
  const target = Math.PI + 0.2;
  const da = ((target - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  ang += da * settle;
  const S = hf.w * 3.0;
  // Facing right its top is up with no mirroring; facing left it is mirrored across its length (roll -1).
  const c = Math.cos(ang);
  const roll = Math.sign(c || 1) * Math.max(0.05, Math.min(1, Math.abs(c) * 2.6) ** 0.7);
  head(flat, glow, { x: hf.x, y: hf.y, angle: ang, scale: S, roll, roar: p.roar, t: p.t, light: p.light });
}

/** The foam thrown up where the body leaves the water: claws round it and a ring of light. */
function collar(flat: Ctx, glow: Ctx, at: Pt, t: number, k: number) {
  if (k <= 0) return;
  const r = rng(707);
  const claws: { pts: Pt[]; w: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r.range(-0.1, 0.1);
    const bx = at.x + Math.cos(a) * 95, by = at.y + Math.sin(a) * 26;
    const out = Math.atan2(Math.sin(a) * 0.3 - 1.4, Math.cos(a));
    const len = r.range(50, 110) * k * (0.85 + 0.15 * Math.sin(t * 6 + i));
    const pts: Pt[] = [{ x: bx, y: by }];
    let x = bx, y = by, ang = out;
    const curl = (Math.cos(a) > 0 ? 1 : -1) * r.range(1.5, 2.5);
    for (let j = 1; j <= 10; j++) {
      ang += (curl / 10) * (j / 10) * 1.8;
      x += Math.cos(ang) * len / 10;
      y += Math.sin(ang) * len / 10;
      pts.push({ x, y });
    }
    claws.push({ pts, w: r.range(12, 22) * k });
  }
  flat.fillStyle = LINE;
  for (const c of claws) { ribbonPath(flat, c.pts, (i) => (c.w + 8) * (1 - (i / c.pts.length) * 0.8)); flat.fill(); }
  flat.beginPath();
  flat.ellipse(at.x, at.y, 120, 34, 0, 0, Math.PI * 2);
  flat.fill();
  flat.fillStyle = FOAM;
  for (const c of claws) { ribbonPath(flat, c.pts, (i) => c.w * (1 - (i / c.pts.length) * 0.92)); flat.fill(); }
  flat.beginPath();
  flat.ellipse(at.x, at.y, 114, 29, 0, 0, Math.PI * 2);
  flat.fill();
  flat.beginPath();
  flat.ellipse(at.x, at.y + 2, 74, 15, 0, 0, Math.PI * 2);
  flat.fillStyle = '#0b2a48';
  flat.fill();
  flat.strokeStyle = LINE;
  flat.lineWidth = 4;
  flat.stroke();
  glow.save();
  glow.globalCompositeOperation = 'destination-out';
  glow.beginPath();
  glow.ellipse(at.x, at.y, 124, 38, 0, 0, Math.PI * 2);
  glow.fill();
  glow.restore();
  glow.beginPath();
  glow.ellipse(at.x, at.y, 150, 44, 0, 0, Math.PI * 2);
  glow.strokeStyle = rgba(TEAL_LIGHT, 0.55 * k);
  glow.lineWidth = 4;
  glow.stroke();
}

interface HeadLook { x: number; y: number; angle: number; scale: number; roll: number; roar: number; t: number; light: number }

/**
 * Sets up the head's frame: origin at the neck, +x along the snout, its top up the screen. `roll` (-1..1) squashes the
 * head across its length, so that as the heading passes the vertical it rolls through edge-on instead of flipping.
 */
function headSpace(ctx: Ctx, h: HeadLook) {
  ctx.translate(h.x, h.y);
  ctx.rotate(h.angle);
  ctx.scale(h.scale, h.scale * h.roll);
}

/** The upper head: skull, brow, snout and upper jaw, as one closed path (units of the head's length). */
function upperPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.05);
  ctx.bezierCurveTo(-0.12, -0.2, -0.06, -0.28, 0.02, -0.3);
  ctx.bezierCurveTo(0.12, -0.36, 0.3, -0.41, 0.42, -0.36);
  ctx.bezierCurveTo(0.5, -0.33, 0.54, -0.27, 0.6, -0.26);
  ctx.bezierCurveTo(0.72, -0.25, 0.88, -0.23, 0.98, -0.25);
  ctx.bezierCurveTo(1.06, -0.28, 1.14, -0.2, 1.13, -0.1);
  ctx.bezierCurveTo(1.13, -0.03, 1.1, 0.0, 1.06, 0.01);
  ctx.bezierCurveTo(0.85, 0.02, 0.6, 0.03, 0.4, 0.04);
  ctx.bezierCurveTo(0.32, 0.06, 0.26, 0.12, 0.2, 0.14);
  ctx.bezierCurveTo(0.08, 0.17, -0.06, 0.08, -0.1, -0.05);
  ctx.closePath();
}

const HINGE = { x: 0.32, y: 0.06 };

/** The lower jaw, hinged behind the mouth's corner, open by `o`. */
function lowerPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(0.3, 0.06);
  ctx.bezierCurveTo(0.55, 0.08, 0.85, 0.06, 1.0, 0.06);
  ctx.bezierCurveTo(1.04, 0.08, 1.03, 0.13, 0.98, 0.14);
  ctx.bezierCurveTo(0.75, 0.18, 0.5, 0.24, 0.3, 0.24);
  ctx.bezierCurveTo(0.18, 0.22, 0.2, 0.1, 0.3, 0.06);
  ctx.closePath();
}

function jawSpace(ctx: Ctx, o: number) {
  ctx.translate(HINGE.x, HINGE.y);
  ctx.rotate(0.5 * o);
  ctx.translate(-HINGE.x, -HINGE.y);
}

function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, m = 1 - s;
    out.push({
      x: m * m * m * p0.x + 3 * m * m * s * p1.x + 3 * m * s * s * p2.x + s * s * s * p3.x,
      y: m * m * m * p0.y + 3 * m * m * s * p1.y + 3 * m * s * s * p2.y + s * s * s * p3.y,
    });
  }
  return out;
}

/** A tendril (foam or whisker) as points: from `b`, heading `a`, curling by `curl`. */
function tendril(b: Pt, a: number, len: number, curl: number, n = 12): Pt[] {
  const pts: Pt[] = [b];
  let x = b.x, y = b.y, ang = a;
  for (let j = 1; j <= n; j++) {
    ang += (curl / n) * (j / n) * 1.8;
    x += Math.cos(ang) * len / n;
    y += Math.sin(ang) * len / n;
    pts.push({ x, y });
  }
  return pts;
}

/** Draws tapered strands with an ink edge: all the edges first, then all the fills, so they read as one mass. */
function strands(ctx: Ctx, list: { pts: Pt[]; w: number }[], fill: string, edge: number) {
  ctx.fillStyle = LINE;
  for (const m of list) { ribbonPath(ctx, m.pts, (i) => (m.w + edge) * (1 - (i / (m.pts.length - 1)) * 0.75)); ctx.fill(); }
  ctx.fillStyle = fill;
  for (const m of list) { ribbonPath(ctx, m.pts, (i) => m.w * (1 - (i / (m.pts.length - 1)) * 0.94)); ctx.fill(); }
}

/** The horns: gold antlers sweeping back from behind the brow, with a tine. */
function horn(ctx: Ctx, dx: number, dy: number, edge: number, col: string, t: number) {
  const s = 0.02 * Math.sin(t * 1.3);
  const main = bez({ x: 0.24 + dx, y: -0.36 + dy }, { x: 0.05 + dx, y: -0.6 + dy }, { x: -0.3 + dx, y: -0.66 + dy + s }, { x: -0.72 + dx, y: -0.56 + dy + s });
  const tine = bez({ x: -0.06 + dx, y: -0.6 + dy }, { x: -0.1 + dx, y: -0.74 + dy }, { x: -0.18 + dx, y: -0.84 + dy }, { x: -0.32 + dx, y: -0.9 + dy + s }, 12);
  strands(ctx, [{ pts: main, w: 0.09 }, { pts: tine, w: 0.05 }], col, edge);
}

/** The mane: foam streaming back from the top of the skull. */
function maneStrands(t: number) {
  const r = rng(2525);
  return Array.from({ length: 7 }, (_, i) => {
    const b = { x: r.range(-0.08, 0.2), y: r.range(-0.32, -0.12) };
    return { pts: tendril(b, Math.PI + r.range(-0.5, 0.1) + 0.08 * Math.sin(t * 2.2 + i), r.range(0.4, 0.7), -r.range(1.2, 2.4)), w: r.range(0.07, 0.11) };
  });
}

/** The cheek frill: foam tufts from the cheek, laid over the neck's join. */
function frillStrands(t: number) {
  const r = rng(3131);
  return Array.from({ length: 5 }, (_, i) => {
    const b = { x: r.range(0.1, 0.26), y: r.range(-0.12, 0.06) };
    return { pts: tendril(b, Math.PI + r.range(-0.35, 0.15) + 0.06 * Math.sin(t * 2.6 + i), r.range(0.24, 0.36), -r.range(1.2, 2.0), 10), w: r.range(0.09, 0.12) };
  });
}

/** The whiskers: two long gold barbels from the upper lip, trailing back in slow S curves. */
function whiskers(t: number): Pt[][] {
  return [0, 1].map((i) => {
    const s = Math.sin(t * 1.6 + i * 2);
    return bez({ x: 1.04, y: -0.06 + i * 0.05 }, { x: 0.85, y: 0.45 + i * 0.1 + s * 0.08 }, { x: 0.1, y: -0.05 + s * 0.15 }, { x: -0.75, y: 0.4 + i * 0.22 - s * 0.12 }, 40);
  });
}

/** The head on both layers. */
function head(flat: Ctx, glow: Ctx, h: HeadLook) {
  const edge = 0.035;
  const o = h.roar;
  flat.save();
  headSpace(flat, h);
  flat.lineJoin = 'round';
  flat.lineCap = 'round';
  horn(flat, 0.09, 0.02, edge * 0.9, '#8a6a2c', h.t);
  strands(flat, maneStrands(h.t), FOAM, edge);
  for (const wsk of whiskers(h.t)) {
    flat.fillStyle = LINE;
    ribbonPath(flat, wsk, (i) => lerp(0.04, 0.012, i / wsk.length));
    flat.fill();
    flat.fillStyle = GOLD;
    ribbonPath(flat, wsk, (i) => lerp(0.02, 0.004, i / wsk.length));
    flat.fill();
  }
  // The mouth's inside, then the lower jaw with its fangs and beard.
  flat.beginPath();
  flat.moveTo(0.28, 0.06);
  flat.lineTo(1.06, 0.0);
  flat.lineTo(1.0, 0.08 + 0.5 * o);
  flat.lineTo(0.3, 0.2);
  flat.closePath();
  flat.fillStyle = '#030c18';
  flat.fill();
  flat.save();
  jawSpace(flat, o);
  const beard = [0.5, 0.64, 0.78].map((x, i) => ({ pts: tendril({ x, y: 0.18 }, Math.PI * 0.7 + i * 0.05, 0.2 + i * 0.03, 1.4, 8), w: 0.085 }));
  strands(flat, beard, FOAM, edge);
  lowerPath(flat);
  flat.lineWidth = edge * 2;
  flat.strokeStyle = LINE;
  flat.stroke();
  flat.fillStyle = '#17506e';
  flat.fill();
  fangs(flat, [[0.92, 0.09], [0.76, 0.05], [0.62, 0.04]], 0.07, -1);
  flat.restore();
  // The upper head.
  upperPath(flat);
  flat.lineWidth = edge * 2;
  flat.strokeStyle = LINE;
  flat.stroke();
  flat.fillStyle = '#1f6c8c';
  flat.fill();
  fangs(flat, [[0.98, 0.11], [0.82, 0.055], [0.68, 0.045], [0.55, 0.04]], 0.02, 1);
  flat.save();
  upperPath(flat);
  flat.clip();
  // Cel shade: the lower half (jaw and cheek) darker; a light along the top of the snout.
  flat.fillStyle = 'rgba(6,24,46,0.5)';
  flat.beginPath();
  flat.moveTo(-0.3, -0.12);
  flat.bezierCurveTo(0.2, -0.04, 0.6, -0.14, 1.3, -0.12);
  flat.lineTo(1.3, 0.3);
  flat.lineTo(-0.3, 0.3);
  flat.closePath();
  flat.fill();
  flat.fillStyle = 'rgba(150,230,230,0.45)';
  const ridge = bez({ x: 0.58, y: -0.235 }, { x: 0.72, y: -0.225 }, { x: 0.88, y: -0.215 }, { x: 1.06, y: -0.22 }, 16);
  ribbonPath(flat, ridge, (i) => 0.035 * Math.sin(Math.PI * i / 16));
  flat.fill();
  // Ridges on the cheek and along the snout.
  flat.strokeStyle = LINE;
  flat.lineWidth = 0.014;
  for (const [x0, y0, x1, y1] of [[0.02, -0.1, 0.26, -0.13], [0.06, 0.0, 0.28, -0.05], [0.66, -0.15, 0.98, -0.16]]) {
    flat.beginPath();
    flat.moveTo(x0, y0);
    flat.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 0.04, x1, y1);
    flat.stroke();
  }
  flat.restore();
  flat.fillStyle = LINE;
  flat.beginPath();
  flat.ellipse(1.07, -0.16, 0.034, 0.018, -0.5, 0, Math.PI * 2);
  flat.fill();
  horn(flat, 0, 0, edge, GOLD, h.t);
  // The eye: a narrow almond slanting down to the snout, under a heavy brow.
  flat.beginPath();
  flat.moveTo(0.37, -0.255);
  flat.quadraticCurveTo(0.46, -0.305, 0.575, -0.25);
  flat.quadraticCurveTo(0.47, -0.215, 0.37, -0.255);
  flat.closePath();
  flat.fillStyle = '#d8fff4';
  flat.fill();
  flat.fillStyle = LINE;
  flat.beginPath();
  flat.ellipse(0.48, -0.252, 0.01, 0.026, 0, 0, Math.PI * 2);
  flat.fill();
  flat.beginPath();
  flat.moveTo(0.3, -0.29);
  flat.bezierCurveTo(0.4, -0.37, 0.54, -0.35, 0.64, -0.27);
  flat.bezierCurveTo(0.54, -0.31, 0.44, -0.31, 0.34, -0.26);
  flat.closePath();
  flat.fill();
  strands(flat, frillStrands(h.t), FOAM, edge);
  flat.restore();

  // The glow layer: erase under the head, then the eye, the light in the throat, a rim on the brow and the whiskers.
  glow.save();
  headSpace(glow, h);
  glow.save();
  glow.globalCompositeOperation = 'destination-out';
  glow.lineWidth = edge * 2.5;
  upperPath(glow);
  glow.fill();
  glow.stroke();
  glow.save();
  jawSpace(glow, o);
  lowerPath(glow);
  glow.fill();
  glow.stroke();
  glow.restore();
  glow.restore();
  if (h.light > 0) {
    const k = h.light;
    const eg = glow.createRadialGradient(0.47, -0.255, 0, 0.47, -0.255, 0.1);
    eg.addColorStop(0, rgba('#ffffff', 0.95 * k));
    eg.addColorStop(0.35, rgba(TEAL_LIGHT, 0.75 * k));
    eg.addColorStop(1, rgba('#1a9a90', 0));
    glow.fillStyle = eg;
    glow.beginPath();
    glow.arc(0.47, -0.255, 0.1, 0, Math.PI * 2);
    glow.fill();
    if (o > 0.05) {
      glow.beginPath();
      glow.moveTo(0.34, 0.07);
      glow.lineTo(1.0, 0.03);
      glow.lineTo(0.94, 0.08 + 0.42 * o);
      glow.lineTo(0.36, 0.17);
      glow.closePath();
      const mg = glow.createLinearGradient(0.3, 0, 1.0, 0);
      mg.addColorStop(0, rgba('#e8fffa', 0.8 * o * k));
      mg.addColorStop(0.5, rgba('#3fd8c8', 0.45 * o * k));
      mg.addColorStop(1, rgba('#0a4a50', 0));
      glow.fillStyle = mg;
      glow.fill();
    }
    glow.fillStyle = rgba(TEAL_LIGHT, 0.6 * k);
    const rim = bez({ x: 0.02, y: -0.3 }, { x: 0.2, y: -0.4 }, { x: 0.38, y: -0.39 }, { x: 0.5, y: -0.32 }, 16);
    ribbonPath(glow, rim, (i) => 0.012 * Math.sin(Math.PI * i / 16), () => 0.012);
    glow.fill();
    glow.fillStyle = rgba('#ffe6a8', 0.45 * k);
    for (const wsk of whiskers(h.t)) { ribbonPath(glow, wsk, (i) => lerp(0.008, 0.002, i / wsk.length)); glow.fill(); }
  }
  glow.restore();
}

/** Fangs along a jaw line: [x, length] white triangles, pointing down (dir 1) or up (-1) from the line at y0. */
function fangs(ctx: Ctx, list: [number, number][], y0: number, dir: number) {
  for (const [x, len] of list) {
    const w = 0.022 + len * 0.18;
    ctx.beginPath();
    ctx.moveTo(x - w, y0);
    ctx.quadraticCurveTo(x - w * 0.2, y0 + dir * len * 0.6, x + w * 0.3, y0 + dir * len);
    ctx.quadraticCurveTo(x + w * 0.4, y0 + dir * len * 0.4, x + w, y0);
    ctx.closePath();
    ctx.fillStyle = '#f6f8f0';
    ctx.fill();
    ctx.lineWidth = 0.011;
    ctx.strokeStyle = LINE;
    ctx.stroke();
  }
}
