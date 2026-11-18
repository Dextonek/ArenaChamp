import { clamp, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { CUTS, JADE, cutPoint, leafShape, type Cut } from './grove';

/**
 * The wind's light and the dark: the wind slashes (a jade crescent of ink on the paper with a hot core of light), the
 * ink bleeding out of the cuts into a green-black ground, the ground itself, the brushed ring of light round the coil,
 * leaves of light orbiting it, the storm of leaves thrown at the viewer, the paper coming back from the middle in dots,
 * and the green ink drops and wash on the paper at the end.
 */

/** A wind slash along a cut: drawn on over `k`, fading by `fade`. Flat: a jade crescent of ink; glow: its light. */
export function windSlash(flat: Ctx, glow: Ctx, c: Cut, k: number, fade: number) {
  if (k <= 0 || fade >= 1) return;
  const ax = Math.cos(c.a) * c.dir, ay = Math.sin(c.a) * c.dir, p = cutPoint(c);
  const head = lerp(-1250, 1250, clamp(k)), tail = Math.max(-1250, head - 1900 * (0.4 + 0.6 * clamp(k)));
  const a = 1 - clamp(fade);
  const pts: Pt[] = [];
  const nx = -ay, ny = ax;
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, d = lerp(tail, head, u);
    // A slight bow, as a blade of wind.
    const bow = -26 * Math.sin(Math.PI * u) * c.dir;
    pts.push({ x: p.x + ax * d + nx * bow, y: p.y + ay * d + ny * bow });
  }
  const thin = (u: number) => Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)) ** 0.7;
  flat.fillStyle = rgba(JADE.outline, 0.9 * a);
  flat.save();
  ribbon(flat, pts.map((q) => ({ x: q.x - nx * 6 * c.dir, y: q.y - ny * 6 * c.dir })), (u) => (34 * (1 - clamp(fade) * 0.7)) * thin(u));
  flat.fillStyle = rgba('#2a9a64', a);
  ribbon(flat, pts, (u) => 22 * (1 - clamp(fade) * 0.8) * thin(u));
  flat.restore();
  glow.fillStyle = rgba('#3ee598', 0.55 * a);
  ribbon(glow, pts, (u) => 24 * thin(u));
  glow.fillStyle = rgba('#effff6', a);
  ribbon(glow, pts, (u) => 7 * thin(u));
}

/** A thin line of light left along a cut, fading (glow). */
export function cutGlint(ctx: Ctx, c: Cut, k: number, slide: Pt) {
  if (k <= 0) return;
  const ax = Math.cos(c.a), ay = Math.sin(c.a), p = cutPoint(c);
  for (const [w, col, al] of [[14, '#1fbf73', 0.35], [3, '#d8ffe9', 0.95]] as const) {
    ctx.beginPath();
    ctx.moveTo(p.x - ax * 1400 + slide.x * 0.5, p.y - ay * 1400 + slide.y * 0.5);
    ctx.lineTo(p.x + ax * 1400 + slide.x * 0.5, p.y + ay * 1400 + slide.y * 0.5);
    ctx.strokeStyle = rgba(col, al * k);
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

/** Bits of leaf and bamboo sprayed along a cut as it lands (flat). */
export function cutSpray(ctx: Ctx, c: Cut, t: number) {
  const age = t - c.t;
  if (age < 0 || age > 1.2) return;
  const r = rng(Math.round(c.y));
  const ax = Math.cos(c.a), ay = Math.sin(c.a), p = cutPoint(c);
  for (let i = 0; i < 26; i++) {
    const d = r.range(-1000, 1000), v = r.range(150, 520), ang = c.a + r.range(-0.9, 0.9) + (r.next() < 0.5 ? Math.PI : 0);
    const x = p.x + ax * d + Math.cos(ang) * v * age, y = p.y + ay * d + Math.sin(ang) * v * age + 260 * age * age;
    const fade = 1 - clamp(age / 1.2);
    ctx.fillStyle = rgba(r.next() < 0.45 ? JADE.ink : '#1b1f1c', 0.9 * fade);
    leafShape(ctx, x, y, ang + age * r.range(-8, 8), r.range(22, 52), r.range(4, 9), 0.1);
  }
}

const edge = wobble(5150), edge2 = wobble(6262);

/** Green-black ink bleeding out from the three cuts until it covers the paper (flat). */
export function inkBleed(ctx: Ctx, k: number) {
  if (k <= 0) return;
  const reach = 10 + 640 * k ** 1.6;
  const h = (ci: number, d: number, side: number) =>
    reach * (1 + 0.3 * edge(d * 0.004 + ci * 3 + side) + 0.15 * edge2(d * 0.013 - ci + side * 2));
  // The solid ink, a little inside its edge.
  ctx.fillStyle = JADE.ground;
  for (const [ci, c] of CUTS.entries()) {
    const ax = Math.cos(c.a), ay = Math.sin(c.a), nx = -ay, ny = ax, p = cutPoint(c);
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const d = lerp(-1300, 1300, i / 120), o = h(ci, d, 0) * 0.82;
      const x = p.x + ax * d + nx * o, y = p.y + ay * d + ny * o;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = 120; i >= 0; i--) {
      const d = lerp(-1300, 1300, i / 120), o = -h(ci, d, 1) * 0.82;
      ctx.lineTo(p.x + ax * d + nx * o, p.y + ay * d + ny * o);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Its edge as halftone dots that shrink outwards, as ink soaking into the paper.
  halftone(ctx, JADE.ground, 18, (x, y) => {
    let best = 0;
    for (const [ci, c] of CUTS.entries()) {
      const ax = Math.cos(c.a), ay = Math.sin(c.a), p = cutPoint(c);
      const dx = x - p.x, dy = y - p.y, along = dx * ax + dy * ay, across = -dx * ay + dy * ax;
      const lim = h(ci, along, across > 0 ? 0 : 1);
      best = Math.max(best, (lim * 1.12 - Math.abs(across)) / (lim * 0.3 + 6));
    }
    return best;
  });
}

const grounds = new Map<string, HTMLCanvasElement>();

/**
 * The ground of the dark beats: green-black, lighter in the middle, a fine screen of dots and a dotted pool under the
 * coil (flat). It never changes, so it is drawn once for each centre and kept.
 */
export function darkGround(ctx: Ctx, c: Pt) {
  const key = `${c.x},${c.y}`;
  let sheet = grounds.get(key);
  if (!sheet) {
    sheet = document.createElement('canvas');
    sheet.width = 1920;
    sheet.height = 1080;
    const g0 = sheet.getContext('2d')!;
    g0.fillStyle = JADE.ground;
    g0.fillRect(0, 0, 1920, 1080);
    const g = g0.createRadialGradient(c.x, c.y, 50, c.x, c.y, 1100);
    g.addColorStop(0, rgba('#12301f', 0.95));
    g.addColorStop(0.55, rgba('#0a1d13', 0.6));
    g.addColorStop(1, rgba('#040a07', 0));
    g0.fillStyle = g;
    g0.fillRect(0, 0, 1920, 1080);
    halftone(g0, rgba('#1d4430', 0.55), 14, (x, y) => {
      const d = Math.hypot((x - c.x) / 900, (y - c.y) / 520);
      return d < 1 ? 0.5 * (1 - d) + 0.12 : 0;
    }, { x: c.x - 900, y: c.y - 520, w: 1800, h: 1040 });
    grounds.set(key, sheet);
  }
  ctx.drawImage(sheet, 0, 0, 1920, 1080);
}

/** Tall dark stalks at the frame's sides in the dark beats, rimmed by the jade light (flat, with their rims on glow). */
export function darkStalks(flat: Ctx, glow: Ctx, t: number, light: number) {
  const r = rng(8080);
  for (let i = 0; i < 6; i++) {
    const left = i < 3;
    const x = left ? r.range(30, 330) : r.range(1590, 1890), w = r.range(30, 56), sway = Math.sin(t * 1.3 + i) * 10;
    const pts: Pt[] = [];
    for (let j = 0; j <= 12; j++) {
      const y = lerp(1120, -60, j / 12);
      pts.push({ x: x + sway * ((1120 - y) / 1180) ** 2, y });
    }
    flat.fillStyle = '#0a1a11';
    ribbon(flat, pts, () => w);
    flat.fillStyle = '#081510';
    for (let y = 1000 - r.range(0, 150); y > 0; y -= r.range(150, 210)) flat.fillRect(x - w * 0.62, y, w * 1.24, 5);
    // A rim of light on the side towards the middle.
    glow.fillStyle = rgba('#2bd585', 0.35 * light);
    ribbon(glow, pts.map((p) => ({ x: p.x + (left ? 1 : -1) * w * 0.46, y: p.y })), () => 2.5);
  }
}

/**
 * The ring of light round the coil, brushed on in one sweep (glow): an open ellipse on the ground with the bristles'
 * streaks, a gap where the brush lifted. `k` 0 to 1 is how far round it has gone.
 */
export function ensoRing(ctx: Ctx, c: Pt, rx: number, ry: number, k: number, alpha: number, t: number) {
  if (k <= 0 || alpha <= 0) return;
  const a0 = -2.3, sweep = Math.PI * 2 * 0.88 * clamp(k);
  const r = rng(616);
  // The brush's body: a soft wide band, heavy where it starts.
  const band: Pt[] = [];
  for (let i = 0; i <= 120; i++) {
    const a = a0 + sweep * (i / 120);
    band.push({ x: c.x + Math.cos(a) * rx, y: c.y + Math.sin(a) * ry });
  }
  ctx.fillStyle = rgba('#138a4e', 0.3 * alpha);
  ribbon(ctx, band, (u) => 90 * (1 - 0.6 * u) * Math.min(1, u * 20));
  // Its bristles: streaks that break up as the brush runs dry.
  for (let b = 0; b < 14; b++) {
    const o = (b - 6.5) * 6.5 + r.range(-3, 3), start = r.range(0, 0.05), end = 1 - r.range(0, 0.22) * (Math.abs(b - 6.5) / 6.5);
    const dry = wobble(700 + b), wid = r.range(2.5, 8);
    const pts: Pt[] = [];
    for (let i = 0; i <= 120; i++) {
      const u = lerp(start, end, i / 120), a = a0 + sweep * u;
      const wob = 1 + 0.012 * Math.sin(a * 3 + 1) + 0.006 * Math.sin(t * 2 + a * 5);
      pts.push({ x: c.x + Math.cos(a) * (rx + o) * wob, y: c.y + Math.sin(a) * (ry + o * 0.7) * wob });
    }
    const bright = b === 6 || b === 7;
    ctx.fillStyle = rgba(bright ? '#d6ffe8' : r.next() < 0.5 ? '#46e8a0' : '#1fa862', alpha * (bright ? 0.9 : r.range(0.4, 0.8)));
    ribbon(ctx, pts, (u) => {
      const breaks = clamp(0.6 + 2.2 * dry(u * 9) - u * 1.4 * (Math.abs(b - 6.5) / 6.5));
      return (bright ? 7 : wid) * (1 - 0.6 * u) * Math.min(1, u * 15) * breaks;
    });
  }
}

/**
 * Leaves of light orbiting the coil on the ground (glow). `phase` is the wind's travel so far (time, sped up as it
 * gathers: integrated by the caller, so the leaves never jump); `gust` (0 to 1) draws streaks behind them.
 */
export function orbitLeaves(ctx: Ctx, c: Pt, t: number, k: number, phase: number, gust: number) {
  if (k <= 0) return;
  const r = rng(2323);
  for (let i = 0; i < 70; i++) {
    const rad = r.range(250, 950), a0 = r.range(0, 6.28), w = r.range(0.6, 1.2) * (500 / rad) ** 0.5, lift = r.range(0, 260);
    const len = r.range(22, 50), bright = r.next() < 0.4;
    const a = a0 + phase * w;
    const x = c.x + Math.cos(a) * rad, y = c.y + Math.sin(a) * rad * 0.48 - lift;
    ctx.fillStyle = rgba(bright ? '#c8ffe0' : '#3ad48a', k * (bright ? 0.9 : 0.6) * (0.6 + 0.4 * Math.sin(t * 3 + i)));
    leafShape(ctx, x, y, a + Math.PI / 2 + Math.sin(t * 4 + i) * 0.5, len, len * 0.2, 0.1);
    if (gust > 0) {
      // A streak behind it along its orbit.
      const pts: Pt[] = [];
      for (let j = 0; j <= 8; j++) {
        const aa = a - (j / 8) * 0.5 * gust;
        pts.push({ x: c.x + Math.cos(aa) * rad, y: c.y + Math.sin(aa) * rad * 0.48 - lift });
      }
      ctx.fillStyle = rgba('#5cf0a4', 0.4 * k * gust);
      ribbon(ctx, pts, (u) => 3 * (1 - u));
    }
  }
}

/**
 * The storm of leaves thrown at the viewer from `c` (glow): leaves of jade light and dark leaves rimmed in mint fly out,
 * growing as they come close, with streaks behind them. `age` is seconds since the release.
 */
export function leafStorm(ctx: Ctx, c: Pt, age: number, k: number) {
  if (k <= 0 || age < 0) return;
  const r = rng(9191);
  for (let i = 0; i < 240; i++) {
    const ang = r.range(0, Math.PI * 2), delay = r.range(0, 0.35), speed = r.range(1.2, 2.6);
    const a = age - delay;
    if (a <= 0) continue;
    // Perspective: it comes at the camera, so it spreads and grows faster and faster.
    const z = Math.max(0.06, 1 - a * speed * 0.9);
    const dist = (r.range(70, 280) / z) * (1 + a * 0.8);
    const x = c.x + Math.cos(ang) * dist * 1.25, y = c.y + Math.sin(ang) * dist;
    if (x < -400 || x > 2320 || y < -400 || y > 1480) continue;
    const size = r.range(26, 60) / z ** 0.8;
    const spin = ang + a * r.range(-6, 6);
    const kind = r.next();
    const fade = k * clamp(1 - (1 - z) * 0.25);
    // The streak behind it, towards the centre.
    const back = Math.min(dist * 0.5, 160 + size);
    ctx.fillStyle = rgba('#7af5b8', 0.35 * fade);
    ribbon(ctx, [{ x: x - Math.cos(ang) * back * 1.25, y: y - Math.sin(ang) * back }, { x, y }], (u) => Math.max(1, size * 0.12) * u);
    if (kind < 0.3) {
      // A dark leaf with a mint rim: it hides what is behind it.
      ctx.fillStyle = rgba('#a6ffd2', fade);
      leafShape(ctx, x, y, spin, size * 1.06, size * 0.27, 0.12);
      ctx.fillStyle = rgba('#0b2a1b', fade);
      leafShape(ctx, x + Math.cos(spin) * 3, y + Math.sin(spin) * 3, spin, size * 0.98, size * 0.2, 0.12);
    } else {
      ctx.fillStyle = rgba(kind < 0.75 ? '#38d98d' : '#e6fff1', fade * 0.95);
      leafShape(ctx, x, y, spin, size, size * 0.22, 0.12);
    }
  }
}

/** Jade-white speed lines out from a centre, flickering (glow). */
export function jadeSpeedLines(ctx: Ctx, c: Pt, t: number, k: number) {
  if (k <= 0) return;
  const slot = Math.floor(t * 24);
  for (let i = 0; i < 70; i++) {
    const r = rng(i * 41 + slot * 1013);
    if (r.next() > 0.55) continue;
    const a = r.range(0, Math.PI * 2), r0 = r.range(240, 520), r1 = r0 + r.range(400, 1100);
    const pts = [{ x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0 }, { x: c.x + Math.cos(a) * r1, y: c.y + Math.sin(a) * r1 }];
    ctx.fillStyle = rgba(r.next() < 0.6 ? '#ffffff' : '#9cf7c8', 0.85 * k);
    ribbon(ctx, pts, (u) => r.range(2, 7) * Math.sin(Math.PI * u));
  }
}

/** A ring of wind blasting outward from a centre (glow). */
export function shockRing(ctx: Ctx, c: Pt, k: number, alpha: number) {
  if (k <= 0 || k >= 1 || alpha <= 0) return;
  const R = lerp(120, 1500, k ** 0.7), a = (1 - k) * alpha;
  for (const [w, col, al] of [[60 * (1 - k) + 10, '#2bd585', 0.35], [14 * (1 - k) + 3, '#e6fff1', 0.9]] as const) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R * 1.2, R * 0.75, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(col, al * a);
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

const reach1 = wobble(7171), reach2 = wobble(7272);

/**
 * The paper coming back over the dark from the middle outwards, as dots that grow until they meet (flat): the storm
 * blows the dark away from where the coil was.
 */
export function paperReturn(ctx: Ctx, c: Pt, p: number, paperImage: (ctx: Ctx) => void) {
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath();
  const cell = 22;
  for (let y = cell / 2; y < 1080 + cell; y += cell) {
    const odd = Math.round(y / cell) % 2;
    for (let x = odd ? cell : cell / 2; x < 1920 + cell; x += cell) {
      const ang = Math.atan2(y - c.y, x - c.x);
      const d = Math.hypot((x - c.x) / 1.25, y - c.y) / 1050 + 0.07 * reach1(ang * 3) + 0.06 * reach2(x * 0.01 + y * 0.008);
      const s = clamp((p * 1.5 - d) * 3.5);
      if (s < 0.04) continue;
      const r = cell * 0.75 * s;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.clip();
  paperImage(ctx);
  ctx.restore();
}

/** A green ink drop landing on the paper: a round blot with a soft wash spreading round it, splashes and drops thrown out (flat). */
export function inkDrop(ctx: Ctx, x: number, y: number, size: number, k: number, seed: number, color = JADE.ink) {
  if (k <= 0) return;
  const r = rng(seed);
  const grow = clamp(k * 2.5), wash = 1 - (1 - clamp(k)) ** 3;
  // The wash: pale green soaking out into the paper, with a ragged edge.
  const R = size * (1.5 + 2.0 * wash);
  ctx.fillStyle = rgba('#8cc4a0', 0.2 * wash);
  blob(ctx, x, y, R, r.range(0, 100), 0.16);
  ctx.fillStyle = rgba('#6aae84', 0.16 * wash);
  blob(ctx, x + size * 0.2, y - size * 0.1, R * 0.62, r.range(0, 100), 0.2);
  // The blot.
  ctx.fillStyle = rgba(color, 0.95);
  blob(ctx, x, y, size * (0.55 + 0.45 * Math.sqrt(grow)), r.range(0, 100), 0.12);
  // A crown of small drops round it, drawn out along the way they flew.
  for (let i = 0; i < 9; i++) {
    const a = r.range(0, Math.PI * 2), d = size * r.range(1.15, 1.9) * Math.sqrt(grow), l = size * r.range(0.2, 0.42);
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, l * grow, l * 0.45 * grow, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // Drops thrown further.
  for (let i = 0; i < 8; i++) {
    const a = r.range(0, Math.PI * 2), d = size * r.range(2.2, 3.6) * Math.sqrt(grow), s = r.range(1.5, 4.5);
    ctx.fillStyle = rgba(r.next() < 0.6 ? color : JADE.mid, 0.9);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s * Math.min(1, grow * 1.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

function blob(ctx: Ctx, x: number, y: number, R: number, seed: number, rough: number) {
  const w1 = wobble(Math.round(seed * 1000));
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2, rr = R * (1 + rough * w1(a * 1.6));
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
