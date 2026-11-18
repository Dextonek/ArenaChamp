import { clamp, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { SITES, siteAt } from './branch';
import { SAKURA, lightPetal, loosePetal } from './petal';

/**
 * Every loose petal of the piece, each a pure function of time built from constants made once per petal (so no petal
 * ever jumps between frames): the petals the wind tears off the flowers, the streams crossing the frame, the curtain of
 * petals that carries the night in, the vortex round the moon, the blade they become, and the burst that falls as snow.
 */

/** The moon, and the vortex's centre. */
export const MOON = { x: 980, y: 470, r: 230 };

const frac = (v: number) => v - Math.floor(v);

/* ------------------------------------------------------------------ the wind */

export interface Torn {
  site: number;
  petal: number;
  /** When it tears loose. */
  td: number;
  vx: number;
  lift: number;
  ph: number;
  spin: number;
  flip: number;
}

/** One entry per petal of every flower: when the wind takes it, and how it flies. */
export const TORN: Torn[] = (() => {
  const r = rng(5151);
  const out: Torn[] = [];
  SITES.forEach((s, si) => {
    const x = siteAt(s, 0).x;
    for (let j = 0; j < 5; j++) {
      out.push({
        site: si, petal: j, td: 3.35 + 0.75 * (x / 1920) + r.range(0, 0.85), vx: r.range(500, 1000), lift: r.range(-60, 220),
        ph: r.range(0, 6.28), spin: r.range(-5, 5), flip: r.range(3, 7),
      });
    }
  });
  return out;
})();

/** Which petals a site's flower still has at time t (a bit mask). */
export function petalMask(si: number, t: number) {
  let m = 0;
  for (let j = 0; j < 5; j++) if (t < TORN[si * 5 + j].td) m |= 1 << j;
  return m;
}

/** A flying petal's place at age `a` from `p0`. */
function windPath(p0: Pt, a: number, vx: number, lift: number, ph: number): Pt {
  const x = p0.x + vx * a + 380 * a * a;
  const y = p0.y - lift * a + 70 * Math.sin(a * 2.4 + ph) * Math.min(1, a * 2) + 55 * Math.sin(x * 0.0032 + ph) * Math.min(1, a);
  return { x, y };
}

/** The petals torn off the flowers, flying downwind (flat). `bend` is the branch's bend when each tore. */
export function tornPetals(ctx: Ctx, t: number, bendAt: (t: number) => number) {
  for (const p of TORN) {
    const a = t - p.td;
    if (a < 0 || a > 3) continue;
    const s = SITES[p.site];
    const c = siteAt(s, bendAt(p.td));
    const ang = s.pose.rot - Math.PI / 2 + p.petal * ((Math.PI * 2) / 5);
    const p0 = { x: c.x + Math.cos(ang) * s.pose.r * 0.5, y: c.y + Math.sin(ang) * s.pose.r * 0.5 * s.pose.tilt };
    const q = windPath(p0, a, p.vx, p.lift, p.ph);
    if (q.x > 2050 || q.y < -100 || q.y > 1180) continue;
    loosePetal(ctx, q, ang + p.spin * a, s.pose.r * 0.95, Math.cos(p.flip * a * Math.min(1, a * 3) + p.ph * 0.2));
  }
}

interface Drift {
  tb: number;
  y0: number;
  vx: number;
  lift: number;
  size: number;
  ph: number;
  spin: number;
  flip: number;
}

/** Petals blown in from beyond the frame on the left: the stream. */
const STREAM: Drift[] = (() => {
  const r = rng(6262);
  return Array.from({ length: 150 }, () => {
    const near = r.next() < 0.08;
    return {
      tb: r.range(3.25, 5.4), y0: r.range(-60, 1160), vx: r.range(900, 1500), lift: r.range(-40, 200),
      size: near ? r.range(90, 130) : r.range(24, 58), ph: r.range(0, 6.28), spin: r.range(-4, 4), flip: r.range(3, 7),
    };
  });
})();

/** The stream of petals crossing the frame, `k` its strength (flat). Big near ones are drawn by `near`. */
export function streamPetals(ctx: Ctx, t: number, near: boolean) {
  for (const p of STREAM) {
    if ((p.size > 80) !== near) continue;
    const a = t - p.tb;
    if (a < 0) continue;
    const q = windPath({ x: -150, y: p.y0 }, a, p.vx * (p.size > 80 ? 1.4 : 1), p.lift, p.ph);
    if (q.x > 2100 || q.y < -150 || q.y > 1230) continue;
    loosePetal(ctx, q, p.ph + p.spin * a, p.size, Math.cos(p.flip * a + p.ph));
  }
}

/** Thin brushed lines of wind streaming right (flat). */
export function windLines(ctx: Ctx, t: number, k: number) {
  if (k <= 0) return;
  const r = rng(7373);
  for (let i = 0; i < 16; i++) {
    const y0 = r.range(80, 1040), len = r.range(500, 1000), speed = r.range(2200, 3200), off = r.range(0, 3400);
    const head = ((t * speed + off) % 3400) - 500;
    const pts: Pt[] = [];
    for (let j = 0; j <= 24; j++) {
      const x = head - len + (len * j) / 24;
      pts.push({ x, y: y0 + 26 * Math.sin(x * 0.004 + i) - (x - head) * 0.04 });
    }
    ctx.fillStyle = rgba(r.next() < 0.3 ? SAKURA.deep : '#6d5462', (0.18 + r.range(0, 0.22)) * k);
    ribbon(ctx, pts, (u) => r.range(2, 4.5) * Math.sin(Math.PI * u) * u);
  }
}

/* ------------------------------------------------------------- the night's curtain */

const FRONT = (() => {
  const r = rng(8484);
  return Array.from({ length: 190 }, () => ({
    dx: -Math.abs(r.range(0, 1) ** 1.5 * 380) + r.range(-30, 150), y: r.range(-60, 1140), size: r.range(26, 74),
    ph: r.range(0, 6.28), spin: r.range(-6, 6), flip: r.range(4, 9), wob: r.range(20, 70),
  }));
})();

/** The curtain of petals riding the night's front edge at x = `front` (flat). */
export function frontPetals(ctx: Ctx, t: number, front: number, k: number) {
  if (k <= 0) return;
  for (const p of FRONT) {
    const x = front + p.dx + p.wob * Math.sin(t * 3 + p.ph), y = p.y + p.wob * Math.cos(t * 2.4 + p.ph) - 60 * t;
    const yy = ((y % 1260) + 1260) % 1260 - 90;
    if (x < -120 || x > 2040) continue;
    loosePetal(ctx, { x, y: yy }, p.ph + p.spin * t, p.size * k, Math.cos(p.flip * t + p.ph), { dusk: clamp(-p.dx / 380) * 0.6 });
  }
}

/* ------------------------------------------------------------------ the vortex */

const VORTEX = (() => {
  const r = rng(9595);
  return Array.from({ length: 260 }, (_, i) => {
    const arm = i % 3;
    return {
      a0: (arm * Math.PI * 2) / 3 + r.range(-0.45, 0.45) * (r.next() < 0.7 ? 0.5 : 2), ph: r.range(0, 1), rate: r.range(0.75, 1.25),
      size: r.range(34, 62), rim: r.next() < 0.4, spin: r.range(-3, 3), flip: r.range(2, 5), jit: r.range(-1, 1),
      s0: r.range(0, 1), side: r.range(-1, 1),
    };
  });
})();

/** The vortex's squash (it is a disc seen a little from above). */
const SY = 0.8;
const TURNS = 1.25;

/** The vortex's clock: its turning so far, speeding up as it gathers (closed form, so it never jumps). */
export function vortexClock(t: number) {
  const a = Math.max(0, t - 5.2);
  const s = clamp((t - 6.2) / 2.2);
  return 0.32 * a + 0.55 * (2.2 * s ** 3) / 3 + 0.55 * Math.max(0, t - 8.4);
}

/** The outer and inner radius of the vortex, as it gathers in over `g` (0 to 1). */
function radii(g: number) {
  return { out: lerp(1700, 900, g), inn: (MOON.r * 1.22) / SY };
}

/** A vortex petal's place, angle and how far in it is (0 out, 1 in). */
function vortexAt(i: number, t: number, g: number) {
  const v = VORTEX[i];
  const clock = vortexClock(t);
  const p = frac(v.ph + clock * 0.45 * v.rate);
  const { out, inn } = radii(g);
  const r = lerp(out, inn, p ** 0.75) * (1 + 0.05 * v.jit);
  const th = v.a0 + TURNS * Math.PI * 2 * p + clock * 0.7;
  return {
    pos: { x: MOON.x + Math.cos(th) * r, y: MOON.y + Math.sin(th) * r * SY },
    ang: th + Math.PI / 2 + 0.5,
    p,
  };
}

const ARM_DRY = Array.from({ length: 18 }, (_, i) => wobble(4400 + i));

/** The spiral arms: brushed bands of light the petals ride on (glow). */
export function vortexArms(ctx: Ctx, t: number, g: number, k: number) {
  if (k <= 0) return;
  const clock = vortexClock(t);
  const { out, inn } = radii(g);
  const r = rng(1212);
  for (let arm = 0; arm < 3; arm++) {
    for (let b = 0; b < 6; b++) {
      const off = (b - 2.5) * 0.045 + r.range(-0.02, 0.02), wid = r.range(3, 10), bright = b === 2 || b === 3;
      const pts: Pt[] = [];
      for (let j = 0; j <= 90; j++) {
        const p = j / 90, rr = lerp(out, inn, p ** 0.75);
        const th = (arm * Math.PI * 2) / 3 + off + TURNS * Math.PI * 2 * p + clock * 0.7;
        pts.push({ x: MOON.x + Math.cos(th) * rr, y: MOON.y + Math.sin(th) * rr * SY });
      }
      ctx.fillStyle = rgba(bright ? '#ffd0e2' : r.next() < 0.5 ? SAKURA.glow : '#c8427a', k * (bright ? 0.3 : r.range(0.16, 0.32)));
      // Dry brush: each streak breaks up along its length, and the breaks travel with the turning.
      const dry = ARM_DRY[arm * 6 + b];
      ribbon(ctx, pts, (u) => wid * Math.sin(Math.PI * u) ** 0.7 * (0.4 + 0.6 * u) * clamp(0.35 + 1.6 * dry(u * 7 - clock * 0.8)));
    }
  }
}

/** The blade, in picture units: its guard, the angle it lies at, its length. */
export interface BladePose {
  g: Pt;
  angle: number;
  len: number;
}

/** The point at `s` (0 the guard, 1 the tip) along the blade, with its slight curve, and the blade's half width there. */
export function bladeAt(b: BladePose, s: number) {
  const ax = Math.cos(b.angle), ay = Math.sin(b.angle), nx = ay, ny = -ax;
  const bow = 60 * Math.sin(Math.PI * s * 0.9);
  const d = s * b.len;
  return {
    p: { x: b.g.x + ax * d + nx * bow, y: b.g.y + ay * d + ny * bow },
    half: 44 * (s < 0.72 ? 1 - 0.25 * s : (1 - 0.25 * 0.72) * Math.max(0, 1 - (s - 0.72) / 0.28) ** 0.8),
    a: b.angle - 0.14 * Math.cos(Math.PI * s * 0.9),
    n: { x: nx, y: ny },
  };
}

/**
 * The vortex's petals (glow): light petals and dark ones rimmed in pink, riding the spiral inwards; `g` how far it has
 * gathered, `k` their strength, and `toBlade` (0 to 1) how far they have flown onto the blade `b`.
 */
export function vortexPetals(ctx: Ctx, t: number, g: number, k: number, toBlade = 0, b?: BladePose) {
  if (k <= 0) return;
  for (let i = 0; i < VORTEX.length; i++) {
    const v = VORTEX[i];
    const at = vortexAt(i, t, g);
    let { pos, ang } = at;
    // In at the rim, out as they reach the moon's corona.
    let alpha = k * clamp(at.p * 8) * clamp((1 - at.p) * 6);
    let size = v.size * lerp(1.25, 0.7, at.p);
    if (toBlade > 0 && b) {
      // Each petal takes its place along the blade, and flows towards its tip.
      const m = clamp(toBlade * 1.25 - v.s0 * 0.25);
      const s = frac(v.s0 + t * 0.35);
      const q = bladeAt(b, s);
      const target = { x: q.p.x + q.n.x * q.half * v.side * 0.55, y: q.p.y + q.n.y * q.half * v.side * 0.55 };
      const e = m * m * (3 - 2 * m);
      pos = { x: lerp(pos.x, target.x, e), y: lerp(pos.y, target.y, e) };
      ang = lerp(ang, q.a + v.side * 0.12, e);
      alpha = lerp(alpha, k * clamp(s * 12) * clamp((1 - s) * 5) * (v.rim ? 0.8 : 0.6), e);
      size = lerp(size, (10 + q.half * 0.6) * (0.85 + 0.3 * Math.abs(v.jit)), e);
    }
    if (alpha <= 0.01) continue;
    const flip = Math.cos(v.flip * t + v.ph * 6);
    if (v.rim) loosePetal(ctx, pos, ang + v.spin * 0.2, size * 1.1, flip, { alpha: clamp(alpha * 1.4), dusk: 0.3, line: 2 });
    else lightPetal(ctx, pos, ang + v.spin * 0.2, size, flip, alpha, 0.7);
  }
}


/* ---------------------------------------------------------------- the burst and the snow */

interface Flake {
  /** Where on the cut it starts (along the line, from its middle). */
  s: number;
  side: number;
  v: number;
  va: number;
  fall: number;
  size: number;
  ph: number;
  spin: number;
  flip: number;
  land: number;
  delay: number;
  /** 0: from the cut; 1: falling in from above later. */
  late: boolean;
  x0: number;
}

const FLAKES: Flake[] = (() => {
  const r = rng(3737);
  const out: Flake[] = [];
  for (let i = 0; i < 210; i++) {
    const near = r.next() < 0.05;
    const side = r.sign();
    // The cut rises to the right, so `side` 1 throws down and -1 up; fewer go far up, or they would still be falling at the end.
    out.push({
      s: r.range(-1, 1) ** 3 * 0.4 + r.range(-0.6, 0.6), side, v: r.range(300, 1900) * (near ? 1.4 : 1) * (side < 0 ? 0.6 : 1), va: r.range(-400, 400),
      fall: r.range(130, 230) * (near ? 2.2 : 1), size: near ? r.range(80, 110) : r.range(18, 44), ph: r.range(0, 6.28), spin: r.range(-4, 4),
      flip: r.range(2, 5), land: near ? 1400 : 1068 - r.range(0, 1) ** 1.6 * 100, delay: r.range(0, 0.12), late: false, x0: 0,
    });
  }
  for (let i = 0; i < 26; i++) {
    out.push({
      s: 0, side: 1, v: 0, va: 0, fall: r.range(80, 130), size: r.range(18, 36), ph: r.range(0, 6.28), spin: r.range(-3, 3),
      flip: r.range(1.5, 4), land: 1068 - r.range(0, 1) ** 1.6 * 100, delay: r.range(0.6, 2.4), late: true, x0: r.range(-50, 1970),
    });
  }
  return out;
})();

/** A flake's place, angle and flip at time `age` since the burst; `rest` is 1 once it has landed. */
function flakeAt(f: Flake, age: number, cut: { c: Pt; angle: number }) {
  const a = age - f.delay;
  if (a < 0) return null;
  let x: number, y: number;
  if (f.late) {
    x = f.x0 + 50 * Math.sin(a * 1.3 + f.ph);
    y = -60 + f.fall * a;
  } else {
    const ax = Math.cos(cut.angle), ay = Math.sin(cut.angle), nx = -ay, ny = ax;
    const ox = cut.c.x + ax * f.s * 1150, oy = cut.c.y + ay * f.s * 1150;
    const k = 2.6, d = (1 - Math.exp(-k * a)) / k;
    x = ox + (nx * f.side * f.v + ax * f.va) * d + 45 * Math.sin(a * 1.7 + f.ph) * Math.min(1, a);
    y = oy + (ny * f.side * f.v + ay * f.va) * d + f.fall * a + 30 * a * a;
  }
  const near = f.land - y;
  const rest = clamp(1 - near / 40);
  y = Math.min(y, f.land);
  // Landed, it lies nearly flat on the ground, seen from the side: it turns the short way round to its rest.
  const spin = f.ph + f.spin * a, restAng = 0.5 * Math.sin(f.ph * 3);
  const diff = restAng - spin, wrapped = diff - Math.PI * 2 * Math.round(diff / (Math.PI * 2));
  const ang = spin + wrapped * rest;
  const flip = lerp(Math.cos(f.flip * a + f.ph), 0.2 + 0.3 * frac(f.ph * 7.3), rest);
  return { p: { x, y }, ang, flip, rest };
}

/** The burst of light petals out of the cut (glow), fading by `k`. */
export function burstLight(ctx: Ctx, age: number, cut: { c: Pt; angle: number }, k: number) {
  if (k <= 0) return;
  for (const f of FLAKES) {
    if (f.late) continue;
    const q = flakeAt(f, age, cut);
    if (!q || q.p.x < -150 || q.p.x > 2070 || q.p.y < -150) continue;
    // Streaks behind the fast ones.
    const sp = Math.exp(-2.6 * Math.max(0, age - f.delay));
    if (sp > 0.2) {
      const ax = Math.cos(cut.angle), ay = Math.sin(cut.angle);
      const back = Math.min(220, f.v * 0.25) * sp;
      ctx.fillStyle = rgba('#ffb6d2', 0.4 * k * sp);
      ribbon(ctx, [{ x: q.p.x + ay * f.side * back, y: q.p.y - ax * f.side * back }, q.p], (u) => Math.max(1, f.size * 0.18) * u);
    }
    lightPetal(ctx, q.p, q.ang, f.size, q.flip, k);
  }
}

/** The same petals as cel-shaded petals falling as snow and settling on the ground (flat). */
export function snowPetals(ctx: Ctx, age: number, cut: { c: Pt; angle: number }, k = 1) {
  if (k <= 0) return;
  for (const f of FLAKES) {
    const q = flakeAt(f, age, cut);
    if (!q || q.p.x < -150 || q.p.x > 2070 || q.p.y < -150) continue;
    loosePetal(ctx, q.p, q.ang, f.size * (f.size > 80 ? 1 : 0.9), q.flip, { alpha: k });
  }
}
