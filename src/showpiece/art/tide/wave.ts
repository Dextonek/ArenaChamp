import { clamp, easeInOut, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { FOAM, LINE, TEAL_LIGHT } from './common';

/**
 * The great wave, in the woodblock manner: a Prussian blue mass rising from the right and curling over to the left, its
 * inside striped with lighter lines that follow its back, a band of foam along the crest, and the lip breaking into
 * foam claws that curl like fingers. The full moon sits in the hollow under the lip.
 *
 * The outline is a list of key points (the back from the bottom right up over the crest to the lip's tip, then back under
 * the lip, down the hollow and the face to the trough), smoothed into a dense polyline. `rise` 0..1 lifts it out of a
 * flat sea, the crest first and the lip last.
 */

type Key = [number, number, number];

/** [x, y, delay]: the delay (0..0.6) is how late in the rise that point arrives. */
const BACK: Key[] = [
  [2010, 1130, 0], [2010, 700, 0], [1770, 548, 0.05], [1530, 372, 0.1], [1290, 226, 0.16], [1050, 158, 0.22],
  [830, 170, 0.3], [660, 230, 0.38], [548, 330, 0.46], [508, 440, 0.54],
];
const UNDER: Key[] = [
  [566, 468, 0.56], [626, 398, 0.5], [722, 344, 0.44], [850, 334, 0.38], [958, 392, 0.3], [1010, 502, 0.24],
  [986, 640, 0.16], [905, 764, 0.1], [760, 852, 0.05], [560, 902, 0], [300, 916, 0], [-30, 908, 0], [-30, 1130, 0],
];

export const SEA_Y = 910;

/** The hollow under the lip, where the moon shows. */
export const HOLLOW = { x: 735, y: 575 };

/**
 * The same keys for a steep hump without the curl (the wave half risen), so the rise goes flat sea, hump, curl without
 * the outline folding over itself.
 */
const HUMP: [number, number][] = [
  [2010, 1130], [2010, 760], [1770, 640], [1530, 500], [1310, 384], [1110, 304], [960, 282], [862, 300], [800, 340], [770, 392],
  [790, 420], [818, 444], [846, 476], [866, 522], [878, 582], [870, 650], [840, 722], [780, 800], [680, 860], [520, 900], [300, 916],
  [-30, 908], [-30, 1130],
];

/** A key point at rise `k`: flat sea (shifted right), then the hump, then its place in the curl. */
function placeKey(key: Key, idx: number, k: number, t: number): Pt {
  const [x, y, d] = key;
  const [hx, hy] = HUMP[idx];
  const a = easeInOut(clamp(k / 0.5 - d * 0.4));
  const b = easeInOut(clamp((k - 0.42 - d * 0.3) / 0.4));
  const fx = hx + 420, fy = SEA_Y + 6 + (hy - SEA_Y) * 0.04;
  const px = lerp(lerp(fx, hx, a), x, b), py = lerp(lerp(fy, hy, a), y, b);
  const sway = wob(t * 0.9 + idx * 0.35) * 8 * a;
  return { x: px + sway, y: py + sway * 0.5 };
}
const wob = wobble(808);

/** Catmull-Rom through the keys, `n` points per span. */
function spline(keys: Pt[], n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
    for (let j = 0; j < n; j++) {
      const s = j / n, s2 = s * s, s3 = s2 * s;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3),
      });
    }
  }
  out.push(keys[keys.length - 1]);
  return out;
}

export interface WaveShape {
  back: Pt[];
  under: Pt[];
  rise: number;
}

export function waveShape(rise: number, t: number): WaveShape {
  const b = BACK.map((k, i) => placeKey(k, i, rise, t));
  const u = UNDER.map((k, i) => placeKey(k, i + BACK.length, rise, t));
  // The lip's tip joins the two: the back ends where the underside starts.
  const all = spline([...b, ...u], 12);
  const nb = (b.length - 1) * 12;
  return { back: all.slice(0, nb + 1), under: all.slice(nb), rise };
}

export function wavePath(ctx: Ctx, w: WaveShape) {
  ctx.beginPath();
  const pts = [...w.back, ...w.under];
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.closePath();
}

/** Mixes two '#rrggbb' colours. */
export function mix(a: string, b: string, k: number) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(lerp((A >> s) & 255, (B >> s) & 255, clamp(k)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

/** Points offset from a polyline along its left-hand normal by `d(k)`. */
function offset(pts: Pt[], d: (k: number) => number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const o = d(i / (pts.length - 1));
    return { x: p.x + nx * o, y: p.y + ny * o };
  });
}

/**
 * The wave on the flat layer. `night` 0..1 darkens it to the night's colours.
 */
export function waveFlat(ctx: Ctx, w: WaveShape, t: number, night: number) {
  if (w.rise <= 0) return;
  const deep = mix('#123a66', '#081a33', night), mid = mix('#1f5a92', '#0f3256', night), pale = mix('#7fb2cf', '#2c6f86', night);
  ctx.save();
  wavePath(ctx, w);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 12;
  ctx.stroke();
  const g = ctx.createLinearGradient(1400, 200, 900, 1000);
  g.addColorStop(0, mid);
  g.addColorStop(0.55, deep);
  g.addColorStop(1, mix('#0d2c50', '#050f1f', night));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // The lighter lines inside, following the back (the woodblock's striations), inward from it.
  const backPart = w.back.slice(16);
  for (let i = 1; i <= 13; i++) {
    const d = i * 30 + i * i * 2.2;
    const line = offset(backPart, (k) => -d * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, k * 1.1 + 0.05))));
    ctx.fillStyle = rgba(i < 4 ? '#ffffff' : '#9cc6dc', 1);
    ctx.globalAlpha = (i < 4 ? 0.5 : 0.42) * (1 - i / 16) * (1 - 0.55 * night);
    ribbon(ctx, line, (k) => (i < 4 ? 7 : 5) * Math.sin(Math.PI * k) ** 0.6);
  }
  ctx.globalAlpha = 1;
  // The face under the lip: paler, with foam streaks.
  const face = offset(w.under.slice(18, 80), () => -46);
  ctx.fillStyle = rgba(pale, 0.5);
  ribbon(ctx, face, (k) => 70 * Math.sin(Math.PI * k));
  halftone(ctx, rgba('#cfe6ee', 0.35 * (1 - 0.6 * night)), 14, (x, y) => {
    const dx = (x - 940) / 220, dy = (y - 620) / 300;
    return 0.9 - Math.hypot(dx, dy);
  }, { x: 700, y: 300, w: 480, h: 640 });
  ctx.restore();
  // The sea's long lines in the trough, to the left.
  seaLines(ctx, t, night);
  foamCrest(ctx, w, t);
}

/** Long horizontal lines on the sea in the trough. */
function seaLines(ctx: Ctx, t: number, night: number) {
  const r = rng(515);
  for (let i = 0; i < 9; i++) {
    const y = SEA_Y + 22 + i * 18 + i * i * 0.8;
    const x0 = r.range(-60, 200), len = r.range(300, 900);
    const pts: Pt[] = [];
    for (let j = 0; j <= 20; j++) {
      const x = x0 + (len * j) / 20 - (t * 30) % 60;
      pts.push({ x, y: y + Math.sin(x * 0.02 + t * 2 + i) * 3 });
    }
    ctx.fillStyle = rgba(i % 2 ? '#a8cfe0' : FOAM, (0.55 - i * 0.03) * (1 - 0.4 * night));
    ribbon(ctx, pts, (k) => 4 * Math.sin(Math.PI * k));
  }
}

/** A foam claw: a tendril from `base` setting out at `ang` and curling by `curl` (radians over its length). */
function clawPts(base: Pt, ang: number, len: number, curl: number, n = 14): Pt[] {
  const pts: Pt[] = [base];
  let x = base.x, y = base.y, a = ang;
  for (let i = 1; i <= n; i++) {
    const step = (len / n) * (1.25 - (i / n) * 0.6);
    a += (curl / n) * (0.4 + 1.6 * (i / n));
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push({ x, y });
  }
  return pts;
}

interface Claw { pts: Pt[]; w: number }

/** The foam along the crest and the claws off the lip, as polylines with widths. */
export function foamParts(w: WaveShape, t: number): { band: Pt[]; claws: Claw[]; spray: { p: Pt; s: number }[] } {
  const claws: Claw[] = [];
  const pts = w.back;
  const n = pts.length;
  // The crest band runs from a third of the way up the back to the lip's tip.
  const i0 = Math.floor(n * 0.38);
  const band = pts.slice(i0);
  const lip = clamp((w.rise - 0.6) / 0.4);
  const r = rng(9090);
  // Claws along the last part of the back (the lip) and round its tip under it.
  const along: { p: Pt; normal: number; tangent: number; s: number }[] = [];
  const lipPts = [...pts.slice(Math.floor(n * 0.7)), ...w.under.slice(1, 22)];
  for (let i = 0; i < lipPts.length; i += 5) {
    const a = lipPts[Math.max(0, i - 1)], b = lipPts[Math.min(lipPts.length - 1, i + 1)];
    const tangent = Math.atan2(b.y - a.y, b.x - a.x);
    along.push({ p: lipPts[i], normal: tangent + Math.PI / 2, tangent, s: i / lipPts.length });
  }
  for (const { p, normal, tangent, s } of along) {
    // Each cluster: a thick lobe out of the lip, then three or four fingers from its end, curling back.
    const size = (0.55 + 0.75 * Math.sin(Math.PI * Math.min(1, s * 1.2))) * lip;
    if (size <= 0.02) continue;
    const ang = lerp(normal, tangent, 0.6) + wob(t * 1.4 + s * 9) * 0.12;
    const lobe = clawPts(p, ang, 70 * size, 0.4, 6);
    claws.push({ pts: lobe, w: 34 * size });
    const end = lobe[lobe.length - 1];
    const fingers = 3 + Math.floor(r.next() * 2);
    for (let f = 0; f < fingers; f++) {
      const fa = ang + (f - (fingers - 1) / 2) * 0.55 + r.range(-0.15, 0.15);
      const fl = r.range(45, 95) * size * (1 + 0.08 * Math.sin(t * 3 + f + s * 7));
      claws.push({ pts: clawPts(end, fa, fl, -r.range(1.8, 3.0), 12), w: r.range(11, 17) * size });
    }
  }
  // Spray: flecks thrown off the lip, drifting forward and down.
  const spray: { p: Pt; s: number }[] = [];
  const sr = rng(4747);
  for (let i = 0; i < 60; i++) {
    const src = lipPts[Math.floor(sr.next() * lipPts.length)];
    if (!src) continue;
    const life = sr.range(1.2, 2.4), age = ((t + sr.range(0, life)) % life) / life;
    const dx = sr.range(-260, 60), dy = sr.range(-80, 40);
    spray.push({
      p: { x: src.x + dx * age - 30, y: src.y + dy * age + 160 * age * age - 20 },
      s: sr.range(2, 6) * (1 - age * 0.7) * lip,
    });
  }
  return { band, claws, spray };
}

/** The foam on the flat layer: an ink outline round everything first, then the white. */
function foamCrest(ctx: Ctx, w: WaveShape, t: number) {
  const { band, claws, spray } = foamParts(w, t);
  const bandW = (k: number) => 46 * Math.sin(Math.PI * Math.min(1, k * 1.05)) ** 0.7 * clamp(w.rise * 1.5);
  const inward = offset(band, (k) => -bandW(k) * 0.35);
  ctx.fillStyle = LINE;
  ribbon(ctx, inward, (k) => bandW(k) + 10);
  for (const c of claws) ribbon(ctx, c.pts, (k) => (c.w + 9) * (1 - k * 0.85));
  for (const s of spray) if (s.s > 0.5) { ctx.beginPath(); ctx.arc(s.p.x, s.p.y, s.s + 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = FOAM;
  ribbon(ctx, inward, bandW);
  for (const c of claws) ribbon(ctx, c.pts, (k) => c.w * (1 - k * 0.92));
  for (const s of spray) if (s.s > 0.5) { ctx.beginPath(); ctx.arc(s.p.x, s.p.y, s.s, 0, Math.PI * 2); ctx.fill(); }
  // A blue shade line inside the band, as a printer would cut it.
  ctx.fillStyle = rgba('#8fb7cf', 0.8);
  ribbon(ctx, offset(band, (k) => -bandW(k) * 0.55), (k) => bandW(k) * 0.18);
}

/**
 * The wave's light at night (glow layer): a thin teal rim along the crest and the claws. `k` 0..1. The caller has already
 * erased the glow layer under the wave.
 */
export function waveGlow(ctx: Ctx, w: WaveShape, t: number, k: number) {
  if (k <= 0) return;
  const { band, claws } = foamParts(w, t);
  ctx.fillStyle = rgba(TEAL_LIGHT, 0.75 * k);
  ribbon(ctx, offset(band, () => 6), (u) => 6 * Math.sin(Math.PI * u));
  ctx.fillStyle = rgba('#d8fff6', 0.55 * k);
  for (const c of claws) ribbon(ctx, c.pts, (u) => c.w * 0.3 * (1 - u));
}
