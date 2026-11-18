import { clamp, easeOut, lerp, ribbon, rng, rgba, type Ctx, type Pt } from '../../core';
import { C, MOON_R } from './sky';
import { tautLinks } from './chains';

/**
 * Black Sun Eclipse, the heaven gate: three rings of violet sigils (abstract glyph strokes, not letters) turning in
 * opposite directions round the black sun, the black disc's iris of polygonal blades opening onto magenta-white light, the
 * beam bursting from it at the viewer, and the chains breaking into black shards.
 */

type Stroke = Pt[];

/** One glyph: two to four strokes in a cell 20 wide (along the ring) and 24 tall (across it). */
function makeGlyph(r: ReturnType<typeof rng>): Stroke[] {
  const out: Stroke[] = [];
  if (r.next() < 0.7) out.push([{ x: r.range(-2, 2), y: -11 }, { x: r.range(-2, 2), y: 11 }]);
  const n = 1 + Math.floor(r.next() * 3);
  for (let i = 0; i < n; i++) {
    const kind = r.next();
    const y = r.range(-9, 9);
    if (kind < 0.3) out.push([{ x: -8, y }, { x: 8, y: y + r.range(-2, 2) }]);
    else if (kind < 0.5) out.push([{ x: -7, y: -10 }, { x: 7, y: -10 }, { x: 7, y: r.range(-2, 8) }]);
    else if (kind < 0.7) {
      const pts: Pt[] = [];
      const cx = r.range(-3, 3), cy = r.range(-5, 5), rr = r.range(4, 7), a0 = r.range(0, 6.28);
      for (let j = 0; j <= 8; j++) { const a = a0 + (j / 8) * Math.PI * 1.3; pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr }); }
      out.push(pts);
    } else if (kind < 0.85) out.push([{ x: -8, y: y - 6 }, { x: 0, y }, { x: 8, y: y - 6 }]);
    else out.push([{ x: r.range(-5, 5), y }, { x: r.range(-5, 5) + 0.5, y: y + 1.5 }]);
  }
  return out;
}

interface Ring { r: number; band: number; n: number; speed: number; color: string; seed: number; t0: number }
export const RINGS: Ring[] = [
  { r: 322, band: 20, n: 44, speed: 0.32, color: '#d9b8ff', seed: 11, t0: 6.5 },
  { r: 404, band: 21, n: 54, speed: -0.24, color: '#ff8fdc', seed: 23, t0: 6.68 },
  { r: 494, band: 23, n: 64, speed: 0.15, color: '#c8a4ff', seed: 37, t0: 6.86 },
];
const GLYPHS = RINGS.map((ring) => {
  const r = rng(ring.seed);
  return Array.from({ length: ring.n }, () => makeGlyph(r));
});

/** How far a ring has turned at time t: slowly, then faster and faster as the gate charges. */
export function ringTurn(ring: Ring, t: number) {
  const dt = Math.max(0, t - 6.3);
  const charge = Math.max(0, t - 7.9);
  return ring.speed * (dt + 2.2 * charge * charge);
}

/**
 * The sigil rings (style 'flat': dark bands under them; 'glow': the lit lines and glyphs; 'ink': black on paper).
 * `k` fades them, `open` widens them as the iris opens.
 */
export function sigilRings(ctx: Ctx, t: number, style: 'flat' | 'glow' | 'ink', k: number, open = 0) {
  if (k <= 0) return;
  RINGS.forEach((ring, ri) => {
    const draw = clamp((t - ring.t0) / 0.55);
    if (draw <= 0) return;
    const R = ring.r * (1 + 0.1 * open * (ri + 1) / 3);
    const turn = ringTurn(ring, t);
    const a0 = -Math.PI / 2 + turn * 0.3;
    const inner = R - ring.band, outer = R + ring.band;
    if (style === 'flat') {
      ctx.beginPath();
      ctx.arc(C.x, C.y, outer + 4, a0, a0 + Math.PI * 2 * draw);
      ctx.arc(C.x, C.y, inner - 4, a0 + Math.PI * 2 * draw, a0, true);
      ctx.closePath();
      ctx.fillStyle = rgba('#0c0618', 0.82 * k);
      ctx.fill();
      return;
    }
    const col = style === 'ink' ? '#0d0911' : ring.color;
    const alpha = style === 'ink' ? 1 : k;
    // The band's two lines, drawn on round.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [rr, w] of [[outer, 2.6], [inner, 1.8]] as const) {
      ctx.beginPath();
      ctx.arc(C.x, C.y, rr, a0, a0 + Math.PI * 2 * draw);
      ctx.strokeStyle = rgba(col, 0.85 * alpha);
      ctx.lineWidth = style === 'ink' ? w * 1.6 : w;
      ctx.stroke();
    }
    // The glyphs, appearing in order round the ring.
    ctx.strokeStyle = rgba(col, 0.95 * alpha);
    ctx.lineWidth = style === 'ink' ? 3.6 : 2.6;
    const glyphs = GLYPHS[ri];
    const scale = (ring.band * 2 - 8) / 24;
    for (let g = 0; g < glyphs.length; g++) {
      if (g / glyphs.length > draw) break;
      const a = turn + (g / glyphs.length) * Math.PI * 2;
      ctx.save();
      ctx.translate(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R);
      ctx.rotate(a + Math.PI / 2);
      ctx.scale(scale, scale);
      ctx.beginPath();
      for (const s of glyphs[g]) {
        ctx.moveTo(s[0].x, s[0].y);
        for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
      }
      ctx.restore();
      ctx.stroke();
    }
    // Small ticks just outside the band.
    ctx.lineWidth = style === 'ink' ? 2.4 : 1.5;
    ctx.strokeStyle = rgba(col, 0.6 * alpha);
    ctx.beginPath();
    for (let i = 0; i < 24 * draw; i++) {
      const a = -turn * 0.5 + (i / 24) * Math.PI * 2;
      const r0 = outer + 8, r1 = outer + (i % 3 === 0 ? 22 : 14);
      ctx.moveTo(C.x + Math.cos(a) * r0, C.y + Math.sin(a) * r0);
      ctx.lineTo(C.x + Math.cos(a) * r1, C.y + Math.sin(a) * r1);
    }
    ctx.stroke();
  });
}

const BLADES = 8;

/** The iris's hole (a regular polygon) and its blades' seams for an opening `h` (0 to 1) at time t. */
function irisShape(h: number, t: number) {
  const R = MOON_R - 2;
  const hr = lerp(5, R * 0.74, h);
  const phi = 0.4 + 1.1 * h + 0.08 * t;
  const v: Pt[] = [];
  for (let j = 0; j < BLADES; j++) {
    const a = phi + (j / BLADES) * Math.PI * 2;
    v.push({ x: C.x + Math.cos(a) * hr, y: C.y + Math.sin(a) * hr });
  }
  // Each seam runs along a hole edge (v[j] to v[j+1]) and on to the rim.
  const ends = v.map((p, j) => {
    const q = v[(j + 1) % BLADES];
    let dx = q.x - p.x, dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const ox = p.x - C.x, oy = p.y - C.y;
    const b = ox * dx + oy * dy, c = ox * ox + oy * oy - R * R;
    const s = -b + Math.sqrt(Math.max(0, b * b - c));
    return { x: p.x + dx * s, y: p.y + dy * s };
  });
  return { R, v, ends, phi };
}

/** The hole's path. */
function holePath(ctx: Ctx, v: Pt[]) {
  ctx.moveTo(v[0].x, v[0].y);
  for (let j = 1; j < v.length; j++) ctx.lineTo(v[j].x, v[j].y);
  ctx.closePath();
}

/**
 * The iris (the black disc as a gate of blades). 'flat': shaded blades with violet seams and the hole's light; 'glow': the
 * seams' glint and the hole's light; 'ink': black blades on paper; 'cut': the blades as opaque black on the glow layer.
 * `seams` (0 to 1) shows the blade lines; `h` opens the hole.
 */
export function iris(ctx: Ctx, t: number, h: number, seams: number, style: 'flat' | 'glow' | 'ink' | 'cut', light = 1) {
  const { R, v, ends } = irisShape(h, t);
  if (style === 'flat' || style === 'ink' || style === 'cut') {
    ctx.beginPath();
    ctx.arc(C.x, C.y, R, 0, Math.PI * 2);
    holePath(ctx, v);
    ctx.fillStyle = style === 'cut' ? '#06030a' : style === 'ink' ? '#0d0911' : '#08050d';
    ctx.fill('evenodd');
  }
  if (style === 'flat' && seams > 0) {
    // Every other blade a shade lighter: a cel-shaded fan.
    for (let j = 0; j < BLADES; j += 2) {
      const a = v[(j + 1) % BLADES], b = v[(j + 2) % BLADES], e1 = ends[(j + 1) % BLADES], e0 = ends[j];
      const ang1 = Math.atan2(e1.y - C.y, e1.x - C.x), ang0 = Math.atan2(e0.y - C.y, e0.x - C.x);
      let d = ang0 - ang1;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d <= -Math.PI) d += Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(e1.x, e1.y);
      ctx.arc(C.x, C.y, R, ang1, ang0, d < 0);
      ctx.closePath();
      ctx.fillStyle = rgba('#1b0f30', seams);
      ctx.fill();
    }
  }
  if (style !== 'cut' && seams > 0) {
    ctx.beginPath();
    for (let j = 0; j < BLADES; j++) {
      ctx.moveTo(v[j].x, v[j].y);
      ctx.lineTo(ends[j].x, ends[j].y);
    }
    if (style === 'flat') { ctx.strokeStyle = rgba('#7b48d8', seams); ctx.lineWidth = 3; }
    else if (style === 'glow') { ctx.strokeStyle = rgba('#c9a2ff', 0.55 * seams); ctx.lineWidth = 1.6; }
    else { ctx.strokeStyle = '#f4eee2'; ctx.lineWidth = 3; }
    ctx.stroke();
  }
  // The light in the hole.
  if (h > 0.02 && light > 0 && (style === 'flat' || style === 'glow')) {
    const hr = Math.hypot(v[0].x - C.x, v[0].y - C.y);
    const g = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, hr);
    if (style === 'flat') {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, '#ffc4f0');
      g.addColorStop(1, '#c0279a');
    } else {
      g.addColorStop(0, rgba('#ffffff', light));
      g.addColorStop(0.5, rgba('#ffb0ea', 0.7 * light));
      g.addColorStop(1, rgba('#ff3fbf', 0.35 * light));
    }
    ctx.beginPath();
    holePath(ctx, v);
    ctx.fillStyle = g;
    ctx.fill();
    if (style === 'glow') {
      ctx.beginPath();
      holePath(ctx, v);
      ctx.strokeStyle = rgba('#ffd6f6', 0.9 * light);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

/** Light pulled in towards the gate as it charges (glow): thin violet and magenta streaks sliding inwards. */
export function inflow(ctx: Ctx, t: number, k: number) {
  if (k <= 0) return;
  for (let i = 0; i < 70; i++) {
    const r = rng(i * 53 + 9);
    const life = r.range(0.35, 0.6), age = ((t + r.range(0, life)) % life) / life;
    const a = r.range(0, Math.PI * 2);
    const d0 = lerp(1100, 330, age), len = r.range(80, 220) * (0.5 + age);
    const pts: Pt[] = [];
    for (let j = 0; j <= 6; j++) {
      const d = d0 + len * (j / 6);
      pts.push({ x: C.x + Math.cos(a) * d, y: C.y + Math.sin(a) * d });
    }
    ctx.fillStyle = rgba(r.next() < 0.5 ? '#c79bff' : '#ff7fd6', 0.7 * k * Math.sin(Math.PI * age));
    ribbon(ctx, pts, (u) => r.range(1.5, 3.5) * Math.sin(Math.PI * u));
  }
}

/** An octagon round the sun, turned like the gate's hole. */
function octagon(ctx: Ctx, r: number, phi: number) {
  ctx.moveTo(C.x + Math.cos(phi) * r, C.y + Math.sin(phi) * r);
  for (let j = 1; j < BLADES; j++) {
    const a = phi + (j / BLADES) * Math.PI * 2;
    ctx.lineTo(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/**
 * The beam at the viewer (glow): the gate's octagon of light growing towards the camera with hard cel edges (white, a
 * magenta band, a violet line), magenta octagons riding out inside it like a tunnel, and rays. `k` 0 to 1 over its life.
 */
export function beam(ctx: Ctx, t: number, k: number, fade: number) {
  if (k <= 0 || fade >= 1) return;
  const a = 1 - fade;
  const phi = irisShape(1, t).phi;
  const rc = lerp(MOON_R * 0.74, 540, easeOut(clamp(k * 2.2))) * (1 - 0.3 * fade);
  // A soft magenta haze just round it.
  const g = ctx.createRadialGradient(C.x, C.y, rc * 0.9, C.x, C.y, rc * 1.7);
  g.addColorStop(0, rgba('#ff4fc8', 0.35 * a));
  g.addColorStop(1, rgba('#7a3fe0', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(C.x, C.y, rc * 1.7, 0, Math.PI * 2);
  ctx.fill();
  // Rays out of its edge, flickering every few frames.
  const slot = Math.floor(t * 20);
  for (let i = 0; i < 30; i++) {
    const r = rng(i * 41 + slot * 977);
    if (r.next() < 0.3) continue;
    const ang = r.range(0, Math.PI * 2), r0 = rc * r.range(0.95, 1.1), r1 = r0 + r.range(250, 800);
    const pts: Pt[] = [];
    for (let j = 0; j <= 8; j++) {
      const d = lerp(r0, r1, j / 8);
      pts.push({ x: C.x + Math.cos(ang) * d, y: C.y + Math.sin(ang) * d });
    }
    ctx.fillStyle = rgba(r.next() < 0.5 ? '#ffffff' : '#ff8fe0', 0.75 * a);
    ribbon(ctx, pts, (u) => r.range(3, 10) * Math.sin(Math.PI * u));
  }
  // The octagon: violet line, magenta band, white heart.
  ctx.beginPath();
  octagon(ctx, rc * 1.14, phi);
  ctx.strokeStyle = rgba('#b46cff', 0.8 * a);
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  octagon(ctx, rc * 1.07, phi);
  ctx.fillStyle = rgba('#ff4fc8', 0.9 * a);
  ctx.fill();
  ctx.beginPath();
  octagon(ctx, rc, phi);
  const core = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, rc);
  core.addColorStop(0, rgba('#ffffff', a));
  core.addColorStop(0.5, rgba('#fff0fa', a));
  core.addColorStop(1, rgba('#ff9ee2', a));
  ctx.fillStyle = core;
  ctx.fill();
  // The tunnel: magenta octagons riding out from the middle.
  for (let i = 0; i < 5; i++) {
    const u = (t * 2.4 + i / 5) % 1;
    ctx.beginPath();
    octagon(ctx, rc * u ** 1.6, phi);
    ctx.strokeStyle = rgba('#b0168a', 0.85 * a * Math.min(1, u * 3));
    ctx.lineWidth = 3 + 12 * u;
    ctx.stroke();
  }
}

/** Black ink speed lines out from the gate (the ink frame): wedges on paper. */
export function inkLines(ctx: Ctx, t: number, color: string) {
  const slot = Math.floor(t * 30);
  for (let i = 0; i < 80; i++) {
    const r = rng(i * 13 + slot * 7919);
    const a = r.range(0, Math.PI * 2), r0 = r.range(560, 760), r1 = r0 + r.range(400, 1100);
    const pts: Pt[] = [];
    for (let j = 0; j <= 6; j++) {
      const d = lerp(r0, r1, j / 6);
      pts.push({ x: C.x + Math.cos(a) * d, y: C.y + Math.sin(a) * d });
    }
    ctx.fillStyle = color;
    ribbon(ctx, pts, (u) => r.range(3, 12) * Math.sin(Math.PI * u) ** 0.7);
  }
}

/** A shard of a broken link. */
interface Shard { at: Pt; dir: Pt; speed: number; spin: number; rot: number; pts: Pt[]; delay: number }

let SHARDS: Shard[] | null = null;
function shardsOf(): Shard[] {
  if (SHARDS) return SHARDS;
  const r = rng(5150);
  SHARDS = [];
  for (const l of tautLinks()) {
    for (let k = 0; k < 3; k++) {
      const n = r.next() < 0.5 ? 3 : 4, size = r.range(24, 46);
      const pts: Pt[] = [];
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + r.range(-0.4, 0.4);
        pts.push({ x: Math.cos(a) * size * r.range(0.6, 1.3), y: Math.sin(a) * size * r.range(0.4, 1) });
      }
      const ox = l.x - C.x, oy = l.y - C.y, d = Math.hypot(ox, oy) || 1;
      const spread = r.range(-0.35, 0.35);
      const dx = ox / d, dy = oy / d;
      SHARDS.push({
        at: { x: l.x + r.range(-14, 14), y: l.y + r.range(-14, 14) },
        dir: { x: dx * Math.cos(spread) - dy * Math.sin(spread), y: dx * Math.sin(spread) + dy * Math.cos(spread) },
        speed: r.range(260, 820),
        spin: r.range(-9, 9),
        rot: r.range(0, 6.28),
        pts,
        delay: Math.max(0, d - 250) * 0.00018,
      });
    }
  }
  return SHARDS;
}

/**
 * The chains breaking into black shards from time t0, flying out at the viewer (they grow as they come). 'cut' draws them
 * opaque on the glow layer (in front of the beam), 'glow' adds a violet glint to their edges.
 */
export function chainShards(ctx: Ctx, t: number, t0: number, style: 'cut' | 'glow' | 'flat') {
  for (const s of shardsOf()) {
    const dt = t - t0 - s.delay;
    if (dt < 0) continue;
    if (dt > 0.9) continue;
    const go = dt * (1 + 1.4 * dt);
    const x = s.at.x + s.dir.x * s.speed * go, y = s.at.y + s.dir.y * s.speed * go;
    if (x < -150 || x > 2070 || y < -150 || y > 1230) continue;
    const sc = 1 + 2.2 * dt;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.rot + s.spin * dt);
    ctx.scale(sc, sc);
    ctx.beginPath();
    ctx.moveTo(s.pts[0].x, s.pts[0].y);
    for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
    ctx.closePath();
    if (style === 'glow') {
      ctx.strokeStyle = rgba('#d0a8ff', 0.85 * (1 - dt / 0.9));
      ctx.lineWidth = 1.6 / sc;
      ctx.stroke();
    } else {
      ctx.fillStyle = style === 'cut' ? '#06030a' : '#0a0710';
      ctx.fill();
      if (style === 'flat') {
        ctx.strokeStyle = '#8e5cf0';
        ctx.lineWidth = 2 / sc;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** The shards that come down onto the paper afterwards and settle round the sun. */
interface Settle { from: Pt; to: Pt; rot0: number; rot1: number; t0: number; dur: number; pts: Pt[]; size: number }
const SETTLE: Settle[] = (() => {
  const r = rng(8080);
  const rest: Pt[] = [
    { x: 640, y: 860 }, { x: 735, y: 905 }, { x: 1180, y: 880 }, { x: 1290, y: 835 }, { x: 1060, y: 930 },
    { x: 560, y: 790 }, { x: 860, y: 950 }, { x: 1420, y: 910 }, { x: 470, y: 920 }, { x: 1530, y: 860 },
  ];
  return rest.map((to, i) => {
    const n = r.next() < 0.5 ? 3 : 4, size = r.range(14, 30) * (i < 4 ? 1.3 : 1);
    const pts: Pt[] = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + r.range(-0.4, 0.4);
      pts.push({ x: Math.cos(a) * r.range(0.6, 1.3), y: Math.sin(a) * r.range(0.35, 0.9) });
    }
    return {
      from: { x: to.x + r.range(-260, 260), y: r.range(-160, 200) },
      to, rot0: r.range(0, 6.28), rot1: r.range(-0.6, 0.6), t0: 9.95 + r.range(0, 0.7), dur: r.range(0.9, 1.3), pts, size,
    };
  });
})();

/** The shards drifting down and coming to rest on the paper (flat): black, a thin violet edge, a soft grey shadow. */
export function settlingShards(ctx: Ctx, t: number, alpha = 1) {
  for (const s of SETTLE) {
    const k = clamp((t - s.t0) / s.dur);
    if (k <= 0) continue;
    const e = 1 - (1 - k) ** 3;
    const x = lerp(s.from.x, s.to.x, e) + Math.sin(k * Math.PI * 2) * 30 * (1 - k);
    const y = lerp(s.from.y, s.to.y, e);
    const rot = lerp(s.rot0 + 4, s.rot1, e);
    const shade = clamp((k - 0.6) / 0.4);
    if (shade > 0) {
      ctx.fillStyle = rgba('#3a3040', 0.18 * shade * alpha);
      ctx.beginPath();
      ctx.ellipse(s.to.x + 6, s.to.y + s.size * 0.5, s.size * 1.1, s.size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s.size, s.size);
    ctx.beginPath();
    ctx.moveTo(s.pts[0].x, s.pts[0].y);
    for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
    ctx.closePath();
    ctx.fillStyle = rgba('#0d0911', alpha);
    ctx.fill();
    ctx.strokeStyle = rgba('#7b48d8', 0.9 * alpha);
    ctx.lineWidth = 2 / s.size;
    ctx.stroke();
    ctx.restore();
  }
}
