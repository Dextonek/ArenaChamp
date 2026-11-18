import { clamp, easeOut, lerp, rng, rgba, seg, type Ctx, type Pt } from '../../core';
import { ALL_STARS, BRASS, BRASS_HI, C, CYAN, GOLD, MINUTE, R, SEPIA, SEPIA_SOFT, SKY, glint, starPath } from './common';

/**
 * The paper side of Celestial Clockwork: the old star chart in sepia ink (astrolabe ring, orbit rings, compass rose,
 * constellations), its stars lighting one by one, the parchment burning away from the centre, and the new star drawn in
 * at the end.
 */

/** When each star of the chart lights (in the flat order of ALL_STARS). */
export const starLitAt = (n: number) => 1.32 + n * 0.046;

/** When each edge of the chart is drawn on (in order, constellation by constellation). */
const EDGES: { a: Pt; b: Pt; n: number; c: number; i: number; j: number }[] = [];
SKY.forEach((con, c) => con.edges.forEach(([i, j]) => EDGES.push({ a: con.stars[i], b: con.stars[j], n: EDGES.length, c, i, j })));
const edgeAt = (n: number) => 0.04 + n * 0.03;

/** The astrolabe ring, its degree ticks, the orbit rings and the faint meridians, drawn on over `k` (flat). */
export function chartRings(ctx: Ctx, k: number, alpha = 1) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  const a0 = -Math.PI / 2, sweep = Math.PI * 2 * easeOut(clamp(k * 1.15));
  // Two great faint arcs across the sheet, like the lines of a sky map.
  ctx.strokeStyle = rgba(SEPIA_SOFT, 0.28);
  ctx.lineWidth = 1.4;
  for (const [cx, cy, r] of [[960, 2200, 1900], [-600, 560, 1700], [2600, 400, 1800]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2 * clamp(k * 1.3));
    ctx.stroke();
  }
  // The astrolabe ring: two circles, a band of degree ticks between.
  ctx.strokeStyle = SEPIA;
  for (const [r, w] of [[R.chart, 4.4], [R.chart - 30, 2.2], [R.chart + 11, 1.6]] as const) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(C.x, C.y, r, a0, a0 + sweep);
    ctx.stroke();
  }
  const n = Math.floor(72 * clamp(k * 1.15));
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / 72) * Math.PI * 2, big = i % 6 === 0;
    const r1 = R.chart - (big ? 30 : 12);
    ctx.lineWidth = big ? 3 : 1.6;
    ctx.beginPath();
    ctx.moveTo(C.x + Math.cos(a) * R.chart, C.y + Math.sin(a) * R.chart);
    ctx.lineTo(C.x + Math.cos(a) * r1, C.y + Math.sin(a) * r1);
    ctx.stroke();
  }
  // Orbit rings, dashed, each with a small planet.
  const orbits: [number, number, number][] = [[330, 0.6, 9], [236, 2.4, 7], [150, 4.1, 5]];
  for (const [r, pa, pr] of orbits) {
    ctx.setLineDash([10, 9]);
    ctx.strokeStyle = rgba(SEPIA, 0.75);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(C.x, C.y, r, a0 + 0.3, a0 + 0.3 + sweep);
    ctx.stroke();
    ctx.setLineDash([]);
    if (k > 0.6) {
      const p = { x: C.x + Math.cos(pa) * r, y: C.y + Math.sin(pa) * r };
      ctx.fillStyle = rgba(SEPIA, clamp((k - 0.6) * 3));
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The cross of meridians through the centre, dashed out to the ring.
  ctx.setLineDash([3, 8]);
  ctx.strokeStyle = rgba(SEPIA, 0.55);
  ctx.lineWidth = 1.2;
  const reach = (R.chart - 30) * easeOut(clamp(k * 1.2));
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, -Math.PI / 4]) {
    ctx.beginPath();
    ctx.moveTo(C.x + Math.cos(a) * 70, C.y + Math.sin(a) * 70);
    ctx.lineTo(C.x + Math.cos(a) * reach, C.y + Math.sin(a) * reach);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/** The compass rose at the centre: eight points, each half filled in sepia (flat). */
export function compassRose(ctx: Ctx, k: number, alpha = 1) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(C.x, C.y);
  const s = easeOut(clamp(k));
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  const point = (a: number, len: number, w: number) => {
    const tip = { x: Math.cos(a) * len, y: Math.sin(a) * len };
    const l = { x: Math.cos(a - Math.PI / 2) * w, y: Math.sin(a - Math.PI / 2) * w };
    // The shaded half, then the outline of the whole point.
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(l.x, l.y); ctx.lineTo(tip.x, tip.y); ctx.closePath();
    ctx.fillStyle = SEPIA;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(l.x, l.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(-l.x, -l.y); ctx.lineTo(0, 0); ctx.closePath();
    ctx.strokeStyle = SEPIA;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + Math.PI / 8 + (i * Math.PI) / 4;
    point(a, 62, 10);
  }
  for (let i = 0; i < 4; i++) point(-Math.PI / 2 + (i * Math.PI) / 2, 118, 18);
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#efe6cc';
  ctx.fill();
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 80, 0, Math.PI * 2);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = SEPIA;
  ctx.fill();
  ctx.restore();
}

/** How lit a star is at time t: 0 unlit, rising to 1 as it lights. */
export const litK = (n: number, t: number) => easeOut(seg(t, starLitAt(n), starLitAt(n) + 0.14));

/** The constellations in sepia ink, the lines drawn on in order; stars inked gold as they light (flat). */
export function chartStars(ctx: Ctx, t: number, opts: { lines?: number; lit?: boolean } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const e of EDGES) {
    const k = opts.lines ?? easeOut(seg(t, edgeAt(e.n), edgeAt(e.n) + 0.32));
    if (k <= 0) continue;
    // Shortened at both ends so the line stops short of the star rings.
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, l = Math.hypot(dx, dy);
    const s = 14 / l, f = lerp(s, 1 - s, k);
    ctx.strokeStyle = rgba(SEPIA, 0.9);
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(e.a.x + dx * s, e.a.y + dy * s);
    ctx.lineTo(e.a.x + dx * f, e.a.y + dy * f);
    ctx.stroke();
  }
  for (const s of ALL_STARS) {
    const appear = opts.lines ?? clamp(seg(t, 0.04 + s.n * 0.024, 0.2 + s.n * 0.024));
    if (appear <= 0) continue;
    const lit = opts.lit ? 1 : litK(s.n, t);
    const big = s.i === 0 ? 1.25 : 1;
    // Unlit: a small sepia ring with a dot; lit: a gold four-point star with a sepia outline and a wash round it.
    ctx.globalAlpha = appear;
    if (lit > 0) {
      const wash = ctx.createRadialGradient(s.p.x, s.p.y, 0, s.p.x, s.p.y, 46 * big);
      wash.addColorStop(0, rgba(GOLD, 0.42 * lit));
      wash.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.arc(s.p.x, s.p.y, 46 * big, 0, Math.PI * 2);
      ctx.fill();
      starPath(ctx, s.p, (10 + 12 * lit) * big, 0.3);
      ctx.fillStyle = BRASS;
      ctx.fill();
      ctx.strokeStyle = SEPIA;
      ctx.lineWidth = 2;
      ctx.stroke();
      starPath(ctx, { x: s.p.x - 1.5, y: s.p.y - 1.5 }, (5 + 6 * lit) * big, 0.3);
      ctx.fillStyle = BRASS_HI;
      ctx.fill();
    }
    if (lit < 1) {
      ctx.globalAlpha = appear * (1 - lit);
      ctx.strokeStyle = SEPIA;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(s.p.x, s.p.y, 11 * big, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = SEPIA;
      ctx.beginPath();
      ctx.arc(s.p.x, s.p.y, 4.5 * big, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The small flare each star throws as it lights, settling to a faint glint (glow; kept small over the paper). */
export function chartGlints(ctx: Ctx, t: number, k = 1) {
  for (const s of ALL_STARS) {
    const t0 = starLitAt(s.n);
    if (t < t0) continue;
    const pop = Math.exp(-(t - t0) * 7);
    glint(ctx, s.p, (5 + 22 * pop) * (s.i === 0 ? 1.2 : 1), (0.35 + 0.65 * pop) * k, '#ffd27a', 0.2);
  }
  // A thin spark running along each line toward the star it is about to light.
  for (const con of SKY) {
    con.edges.forEach(([i, j]) => {
      const nj = ALL_STARS.find((s) => s.p === con.stars[j])!.n;
      const t1 = starLitAt(nj), u = seg(t, t1 - 0.12, t1);
      if (u <= 0 || u >= 1) return;
      const a = con.stars[i], b = con.stars[j];
      const p = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
      glint(ctx, p, 7, 0.8 * k, '#ffe3a0');
    });
  }
}

/** The ragged edge of the hole burning out from the centre, radius `rad` (adds a subpath; the caller begins the path). */
export function burnPath(ctx: Ctx, rad: number, t: number) {
  const r = rng(321);
  const parts = [3, 5, 7, 11, 17, 23].map((f, i) => ({ f, p: r.range(0, 6.283), a: 0.09 / (1 + i * 0.6), w: r.range(-0.6, 0.6) }));
  const n = 160;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob = parts.reduce((s, q) => s + q.a * Math.sin(q.f * a + q.p + q.w * t), 0);
    const d = Math.max(0, rad * (1 + wob));
    const x = C.x + Math.cos(a) * d, y = C.y + Math.sin(a) * d;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** Clips to everything outside the burning hole (where the parchment still is). */
export function clipOutsideBurn(ctx: Ctx, rad: number, t: number) {
  ctx.beginPath();
  ctx.rect(-400, -400, 2720, 1880);
  burnPath(ctx, rad, t);
  ctx.clip('evenodd');
}

/** The charred band just outside the hole (flat; call inside clipOutsideBurn). */
export function burnChar(ctx: Ctx, rad: number, t: number) {
  if (rad <= 0) return;
  ctx.save();
  ctx.lineJoin = 'round';
  for (const [w, col] of [[120, 'rgba(120,78,34,0.28)'], [60, 'rgba(78,44,16,0.6)'], [22, '#1c1007']] as const) {
    ctx.beginPath();
    burnPath(ctx, rad, t);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.restore();
}

/** The burning rim and embers lifting off it (glow). */
export function burnRim(ctx: Ctx, rad: number, t: number, k = 1) {
  if (rad <= 0 || k <= 0) return;
  ctx.save();
  ctx.lineJoin = 'round';
  for (const [w, col, a] of [[18, '#ff6a1a', 0.45], [8, '#ffae4a', 0.9], [2.5, '#fff1d0', 1]] as const) {
    ctx.beginPath();
    burnPath(ctx, rad, t);
    ctx.strokeStyle = rgba(col, a * k);
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.restore();
  const r = rng(77);
  for (let i = 0; i < 90; i++) {
    const a = r.range(0, Math.PI * 2), life = r.range(0.35, 0.8), age = ((t + r.range(0, life)) % life) / life;
    const d = rad * (1 + 0.04 * Math.sin(a * 7)) + 6 + age * r.range(30, 110);
    const p = { x: C.x + Math.cos(a) * d, y: C.y + Math.sin(a) * d - age * 30 };
    ctx.fillStyle = rgba(r.next() < 0.5 ? '#ffd27a' : '#ff8a30', k * (1 - age) * 0.9);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r.range(1.5, 3.5) * (1 - age * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Where the new star is drawn in at the end: at the top of the ring, where the hands met. */
export const NEW_STAR: Pt = { x: C.x, y: C.y - MINUTE.len + 4 };

/** The new star inked onto the chart (flat), with its line joined to the constellation above, and its cyan heart. */
export function newStar(ctx: Ctx, k: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  // Dashed lines out to the two inner stars of the crown above: the new star closes the constellation.
  const line = clamp(seg(k, 0.35, 1));
  if (line > 0) {
    ctx.setLineDash([7, 8]);
    ctx.strokeStyle = rgba(SEPIA, 0.9);
    ctx.lineWidth = 2.4;
    for (const to of [SKY[5].stars[1], SKY[5].stars[2]]) {
      const dx = to.x - NEW_STAR.x, dy = to.y - NEW_STAR.y, l = Math.hypot(dx, dy);
      const a = 46 / l, b = lerp(a, 1 - 16 / l, line);
      ctx.beginPath();
      ctx.moveTo(NEW_STAR.x + dx * a, NEW_STAR.y + dy * a);
      ctx.lineTo(NEW_STAR.x + dx * b, NEW_STAR.y + dy * b);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // A fine circle round it, drawn on.
  const ring = easeOut(seg(k, 0, 0.5));
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(NEW_STAR.x, NEW_STAR.y, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring);
  ctx.stroke();
  const s = easeOut(seg(k, 0.15, 0.55));
  if (s > 0) {
    starPath(ctx, NEW_STAR, 36 * s, 0.26);
    ctx.fillStyle = BRASS;
    ctx.fill();
    ctx.strokeStyle = SEPIA;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    starPath(ctx, { x: NEW_STAR.x - 2, y: NEW_STAR.y - 2 }, 18 * s, 0.26);
    ctx.fillStyle = BRASS_HI;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(NEW_STAR.x, NEW_STAR.y, 6 * s, 0, Math.PI * 2);
    ctx.fillStyle = CYAN;
    ctx.fill();
  }
  ctx.restore();
}
