import { bolt, clamp, lerp, polyline, ribbon, rng, rgba, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { commaSpine, drum, drumGlow, GOLD, OUT, tomoeCommas, unitPath } from './drum';

/**
 * The thunder: lightning as gold and violet strokes with a white core, the tree of lightning that crawls across the sky,
 * the great spinning tomoe of lightning ringed by drums, the last bolt coming at the viewer, and the scorch it leaves on
 * the paper.
 */

type Palette = 'gold' | 'violet';

/** A bolt's three strokes: a wide violet halo, a gold (or violet) body, a white core (glow layer). */
export function boltStroke(ctx: Ctx, pts: Pt[], w: number, k: number, pal: Palette = 'gold') {
  if (k <= 0 || pts.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  polyline(ctx, pts);
  ctx.strokeStyle = rgba('#5b2fe0', 0.32 * k);
  ctx.lineWidth = w * 7;
  ctx.stroke();
  ctx.strokeStyle = rgba(pal === 'gold' ? '#ffbe2e' : '#a77dff', 0.9 * k);
  ctx.lineWidth = w * 2.6;
  ctx.stroke();
  ctx.strokeStyle = rgba(pal === 'gold' ? '#fffbe6' : '#f4eeff', k);
  ctx.lineWidth = w;
  ctx.stroke();
}

/** The same points shaken a little on a fast clock, so a standing bolt crackles but keeps its shape. */
export function crackle(pts: Pt[], t: number, amp: number, seed: number, rate = 24): Pt[] {
  const r = rng(seed * 131 + Math.floor(t * rate) * 977);
  return pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : { x: p.x + r.range(-amp, amp), y: p.y + r.range(-amp, amp) }));
}

export interface Branch { pts: Pt[]; u0: number; u1: number; w: number; pal: Palette }

/** A tree of lightning from `a` to `b`: a trunk and branches, each knowing when along the growth it starts and ends. */
export function lightningTree(seed: number, a: Pt, b: Pt, count = 10): Branch[] {
  const r = rng(seed);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const trunk = bolt(r, a, b, dist * 0.2, 6);
  const out: Branch[] = [{ pts: trunk, u0: 0, u1: 1, w: 4.2, pal: 'gold' }];
  const N = trunk.length - 1;
  for (let i = 0; i < count; i++) {
    const j = Math.floor(r.range(0.1, 0.8) * N);
    const p = trunk[j], q = trunk[Math.min(N, j + 2)];
    const dir = Math.atan2(q.y - p.y, q.x - p.x) + r.sign() * r.range(0.45, 1.15);
    const len = dist * r.range(0.25, 0.6) * (1 - 0.4 * (j / N));
    const end = { x: p.x + Math.cos(dir) * len, y: p.y + Math.sin(dir) * len };
    const pts = bolt(r, p, end, len * 0.28, 5);
    const u0 = j / N, u1 = u0 + (len / dist) * 0.9;
    const pal: Palette = r.next() < 0.4 ? 'violet' : 'gold';
    out.push({ pts, u0, u1, w: r.range(1.8, 2.6), pal });
    // Twigs off the branch.
    for (let k = 0; k < 2; k++) {
      const jj = Math.floor(r.range(0.25, 0.75) * (pts.length - 1));
      const pp = pts[jj];
      const d2 = dir + r.sign() * r.range(0.4, 1.0), l2 = len * r.range(0.25, 0.45);
      const e2 = { x: pp.x + Math.cos(d2) * l2, y: pp.y + Math.sin(d2) * l2 };
      const v0 = u0 + (u1 - u0) * (jj / (pts.length - 1));
      out.push({ pts: bolt(r, pp, e2, l2 * 0.3, 4), u0: v0, u1: v0 + (l2 / dist) * 0.9, w: r.range(1.1, 1.6), pal });
    }
  }
  return out;
}

/** Draws a tree grown to `g` (0 to 1 along the trunk), at brightness `k`, crackling with `t` (glow layer). */
export function drawTree(ctx: Ctx, tree: Branch[], g: number, k: number, t: number, seed = 1) {
  if (k <= 0 || g <= 0) return;
  tree.forEach((br, i) => {
    const f = clamp((g - br.u0) / (br.u1 - br.u0));
    if (f <= 0) return;
    const n = br.pts.length - 1, m = f * n, whole = Math.floor(m);
    const pts = br.pts.slice(0, whole + 1);
    if (whole < n) {
      const a = br.pts[whole], b = br.pts[whole + 1], u = m - whole;
      pts.push({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });
    }
    const live = crackle(pts, t, 3 + br.w, seed * 17 + i);
    // A branch fades a little at its far end and flickers on its own.
    const fl = 0.75 + 0.25 * rng(i * 71 + Math.floor(t * 18) * 13).next();
    boltStroke(ctx, live, br.w, k * (i === 0 ? 1 : fl), br.pal);
    // The growing tip burns white.
    if (f < 1) {
      const tip = pts[pts.length - 1];
      const gr = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 40 + br.w * 8);
      gr.addColorStop(0, rgba('#ffffff', k));
      gr.addColorStop(1, rgba('#a77dff', 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 40 + br.w * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** The great tomoe's bodies (flat layer): deep violet commas, lighter towards the head, with an ink outline. */
export function tomoeFlat(ctx: Ctx, c: Pt, R: number, rot: number, k: number) {
  if (k <= 0 || R < 2) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.lineJoin = 'round';
  // A dark disc under it, ringed, so the commas read against the haze.
  ctx.beginPath();
  ctx.arc(c.x, c.y, R * 1.12, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0824';
  ctx.fill();
  ctx.lineWidth = Math.max(2, R * 0.025);
  ctx.strokeStyle = '#3d3594';
  ctx.stroke();
  halftone(ctx, rgba('#3a2f8c', 0.7), 13, (x, y) => { const d = Math.hypot(x - c.x, y - c.y) / (R * 1.1); return d < 1 ? d * d * 0.9 : 0; }, { x: c.x - R * 1.15, y: c.y - R * 1.15, w: R * 2.3, h: R * 2.3 });
  tomoeCommas(rot).forEach((pts, i) => {
    unitPath(ctx, pts, c.x, c.y, R);
    const a = rot + (i * Math.PI * 2) / 3;
    const hx = c.x + Math.cos(a) * R * 0.64, hy = c.y + Math.sin(a) * R * 0.64;
    const g = ctx.createRadialGradient(hx, hy, R * 0.05, hx, hy, R * 1.3);
    g.addColorStop(0, '#8d6cff');
    g.addColorStop(0.35, '#5a3ad8');
    g.addColorStop(1, '#24157a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(2, R * 0.03);
    ctx.strokeStyle = OUT;
    ctx.stroke();
  });
  ctx.restore();
}

/** The great tomoe's lightning (glow layer): crackling gold edges, a white-hot spine and a hot heart in each head. */
export function tomoeGlow(ctx: Ctx, c: Pt, R: number, rot: number, k: number, t: number) {
  if (k <= 0 || R < 2) return;
  const w = Math.max(0.6, R / 300);
  tomoeCommas(rot, 30).forEach((pts, i) => {
    const sc = pts.map((p) => ({ x: c.x + p.x * R, y: c.y + p.y * R }));
    sc.push(sc[0]);
    boltStroke(ctx, crackle(sc, t, 5 * w, 50 + i, 20), 1.6 * w, k * 0.9, 'gold');
    const sp = commaSpine(rot, i).map((p) => ({ x: c.x + p.x * R, y: c.y + p.y * R }));
    ctx.fillStyle = rgba('#d9c8ff', 0.75 * k);
    ribbon(ctx, sp, (u) => 26 * w * (1 - u) ** 1.2);
    ctx.fillStyle = rgba('#ffffff', 0.95 * k);
    ribbon(ctx, sp, (u) => 9 * w * (1 - u) ** 1.2);
  });
  // Short arcs jumping off the rim.
  const slot = Math.floor(t * 16);
  for (let i = 0; i < 9; i++) {
    const r = rng(i * 433 + slot * 71);
    if (r.next() > 0.6) continue;
    const a = r.range(0, Math.PI * 2), r0 = R * 1.0, r1 = R * r.range(1.15, 1.45);
    const p = { x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0 };
    const q = { x: c.x + Math.cos(a + r.range(-0.3, 0.3)) * r1, y: c.y + Math.sin(a + r.range(-0.3, 0.3)) * r1 };
    boltStroke(ctx, bolt(r, p, q, R * 0.08, 4), 1.1 * w, k * 0.85, 'violet');
  }
}

/** Where drum `i` of the ring of `n` sits. */
export function ringDrum(c: Pt, rad: number, rot: number, i: number, n: number): Pt {
  const a = rot + (i / n) * Math.PI * 2;
  return { x: c.x + Math.cos(a) * rad, y: c.y + Math.sin(a) * rad * 0.94 };
}

/** Raijin's hoop of drums (flat layer): a lacquered hoop with gold edges and small drums round it. */
export function drumRing(ctx: Ctx, c: Pt, rad: number, rot: number, dR: number, k: number, n = 8) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rad, rad * 0.94, 0, 0, Math.PI * 2);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 22;
  ctx.stroke();
  ctx.strokeStyle = '#2a236e';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.strokeStyle = GOLD[1];
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const p = ringDrum(c, rad, rot, i, n);
    drum(ctx, p.x, p.y, dR, { small: true, tomoe: -rot * 2 + i, night: 0.35 });
  }
  ctx.restore();
}

/** The ring's light (glow layer): studs lit and arcs jumping from drum to drum. */
export function drumRingGlow(ctx: Ctx, c: Pt, rad: number, rot: number, dR: number, k: number, t: number, n = 8) {
  if (k <= 0) return;
  for (let i = 0; i < n; i++) {
    const p = ringDrum(c, rad, rot, i, n);
    drumGlow(ctx, p.x, p.y, dR, k * 0.8, t, { small: true, tomoe: -rot * 2 + i });
    const r = rng(i * 59 + Math.floor(t * 12) * 31);
    if (r.next() < 0.45) {
      const q = ringDrum(c, rad, rot, i + 1, n);
      const a = { x: p.x + (q.x - p.x) * 0.12, y: p.y + (q.y - p.y) * 0.12 };
      const b = { x: p.x + (q.x - p.x) * 0.88, y: p.y + (q.y - p.y) * 0.88 };
      boltStroke(ctx, bolt(r, a, b, 40, 5), 1.3, k * r.range(0.6, 1), r.next() < 0.5 ? 'gold' : 'violet');
    }
  }
}

/** Sparks spiralling in to a centre (glow layer). */
export function spiralSparks(ctx: Ctx, c: Pt, t: number, k: number, from = 900) {
  if (k <= 0) return;
  const r = rng(812);
  for (let i = 0; i < 50; i++) {
    const life = r.range(0.7, 1.4), off = r.range(0, life), age = ((t + off) % life) / life;
    const a0 = r.range(0, Math.PI * 2), spin = r.range(2.2, 3.6);
    const pts: Pt[] = [];
    for (let j = 0; j <= 10; j++) {
      const aa = age - j * 0.0025;
      if (aa < 0) break;
      const rad = from * (1 - aa) ** 1.3 * r.range(0.8, 1.1);
      const a = a0 + spin * aa * 3;
      pts.push({ x: c.x + Math.cos(a) * rad, y: c.y + Math.sin(a) * rad * 0.94 });
    }
    if (pts.length < 2) continue;
    ctx.fillStyle = rgba(r.next() < 0.6 ? '#ffe39a' : '#b99cff', k * Math.sin(Math.PI * age));
    ribbon(ctx, pts, (u) => r.range(2, 4) * (1 - u));
  }
}

/** Lines rushing in towards a centre (glow layer): the charge before the strike. */
export function inwardLines(ctx: Ctx, c: Pt, t: number, k: number) {
  if (k <= 0) return;
  const slot = Math.floor(t * 24);
  for (let i = 0; i < 70; i++) {
    const r = rng(i * 41 + slot * 1013);
    if (r.next() > 0.55) continue;
    const a = r.range(0, Math.PI * 2), r1 = r.range(700, 1300), r0 = r1 - r.range(250, 600);
    const pts = [{ x: c.x + Math.cos(a) * r1, y: c.y + Math.sin(a) * r1 }, { x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0 }];
    ctx.fillStyle = rgba(r.next() < 0.7 ? '#e6dcff' : '#ffd36a', 0.75 * k);
    ribbon(ctx, pts, (u) => r.range(2, 5) * Math.sin(Math.PI * u));
  }
}

/** A hot star at `c` (glow layer): a small white core and thin rays. */
export function hotStar(ctx: Ctx, c: Pt, k: number, t: number, size = 1) {
  if (k <= 0) return;
  const R = 110 * size * k;
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
  g.addColorStop(0, rgba('#ffffff', k));
  g.addColorStop(0.3, rgba('#e2d4ff', 0.8 * k));
  g.addColorStop(1, rgba('#6a3cff', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
  ctx.fill();
  const r = rng(Math.floor(t * 20) + 3);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r.range(-0.15, 0.15), len = (i % 2 ? 160 : 360) * size * k * r.range(0.7, 1.2);
    ctx.fillStyle = rgba(i % 3 ? '#fff6dc' : '#d6c4ff', 0.9 * k);
    ribbon(ctx, [c, { x: c.x + Math.cos(a) * len, y: c.y + Math.sin(a) * len }], (u) => 6 * size * (1 - u));
  }
}

/** The last bolt straight down from the top of the frame onto `c`, grown to `g` (glow layer). */
export function downBolt(ctx: Ctx, c: Pt, g: number, k: number, t: number) {
  if (k <= 0 || g <= 0) return;
  const r = rng(4242);
  const full = bolt(r, { x: c.x + 60, y: -80 }, c, 120, 6);
  const n = Math.max(2, Math.ceil(full.length * clamp(g)));
  const pts = crackle(full.slice(0, n), t, 4, 9);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  polyline(ctx, pts);
  ctx.strokeStyle = rgba('#5b2fe0', 0.4 * k);
  ctx.lineWidth = 70;
  ctx.stroke();
  ctx.strokeStyle = rgba('#ffc23a', 0.95 * k);
  ctx.lineWidth = 26;
  ctx.stroke();
  ctx.strokeStyle = rgba('#ffffff', k);
  ctx.lineWidth = 10;
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const j = Math.floor(r.range(0.15, 0.85) * (pts.length - 1));
    const p = pts[j];
    const a = Math.PI / 2 + r.sign() * r.range(0.5, 1.2), l = r.range(120, 300);
    boltStroke(ctx, bolt(r, p, { x: p.x + Math.cos(a) * l, y: p.y + Math.sin(a) * l }, l * 0.3, 4), 2, k, 'violet');
  }
}

/**
 * Bolts bursting out of `c` at the viewer (glow layer): they widen as they come out, as if close to the lens.
 * `g` grows them out (0 to 1), `k` is their brightness.
 */
export function burstAtViewer(ctx: Ctx, c: Pt, g: number, k: number, t: number) {
  if (k <= 0 || g <= 0) return;
  const n = 14;
  const reach = lerp(150, 1500, clamp(g) ** 0.6);
  for (let i = 0; i < n; i++) {
    const r = rng(700 + i);
    const a = (i / n) * Math.PI * 2 + r.range(-0.18, 0.18);
    const far = reach * r.range(0.75, 1.1);
    const pts = crackle(bolt(r, { x: c.x + Math.cos(a) * 40, y: c.y + Math.sin(a) * 40 }, { x: c.x + Math.cos(a) * far, y: c.y + Math.sin(a) * far }, far * 0.12, 5), t, 6, i, 20);
    const wide = (u: number) => 1 + u * u * 1.2;
    ctx.fillStyle = rgba('#5b2fe0', 0.35 * k);
    ribbon(ctx, pts, (u) => 22 * wide(u) * 3);
    ctx.fillStyle = rgba(i % 2 ? '#ffc23a' : '#a77dff', 0.9 * k);
    ribbon(ctx, pts, (u) => 22 * wide(u));
    ctx.fillStyle = rgba('#ffffff', k);
    ribbon(ctx, pts, (u) => 8 * wide(u));
  }
}

/** Scorch marks burnt into the paper round `c` (flat layer): branching burns like frozen lightning, and charred dots. */
export function scorch(ctx: Ctx, c: Pt, R: number, k: number, seed = 1313) {
  if (k <= 0) return;
  const r = rng(seed);
  // Charred dots in a ring round the drum, thinning outward.
  halftone(ctx, rgba('#3a2a22', 0.55 * k), 15, (x, y) => {
    const d = Math.hypot((x - c.x) / 1.15, y - c.y) / R;
    return d < 1.05 ? 0 : (1 - (d - 1.05) / 0.9) * 0.7 + 0.1 * Math.sin(x * 0.05 + y * 0.03);
  }, { x: c.x - R * 2.6, y: c.y - R * 2.2, w: R * 5.2, h: R * 4.4 });
  // Burns where the bolts went: jagged, tapering, with a brown singe round each and a twig or two.
  const burn = (pts: Pt[], w: number) => {
    ctx.fillStyle = rgba('#8a5a2a', 0.2 * k);
    ribbon(ctx, pts, (u) => w * 3.4 * (1 - u * 0.7));
    ctx.fillStyle = rgba('#1e1410', 0.9 * k);
    ribbon(ctx, pts, (u) => w * (1 - u * 0.9));
  };
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r.range(-0.18, 0.18);
    const r0 = R * 1.02, r1 = R * r.range(1.7, 2.7);
    const p = { x: c.x + Math.cos(a) * r0 * 1.1, y: c.y + Math.sin(a) * r0 };
    const q = { x: c.x + Math.cos(a) * r1 * 1.1, y: c.y + Math.sin(a) * r1 };
    const pts = bolt(r, p, q, (r1 - r0) * 0.16, 5);
    burn(pts, r.range(7, 11));
    for (let j = 0; j < 2; j++) {
      const from = pts[Math.floor(r.range(0.3, 0.7) * (pts.length - 1))];
      const b = a + r.sign() * r.range(0.4, 0.9), l = (r1 - r0) * r.range(0.25, 0.45);
      burn(bolt(r, from, { x: from.x + Math.cos(b) * l, y: from.y + Math.sin(b) * l }, l * 0.25, 4), r.range(3, 5));
    }
  }
}
