import { bolt, clamp, easeOut, lerp, ribbon, rng, rgba, seg, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { BRASS, BRASS_DK, BRASS_HI, BRASS_SH, C, CYAN, GOLD, HOUR, MINUTE, OUTLINE, R, polar } from './common';
import { T_STOP, handAngles, starPos } from './sky';
import { HAND_FROM } from './common';

/**
 * The brass clock: a toothed gear ring, a ring of hour marks (Roman-numeral strokes, drawn, not written), an armillary of
 * spinning rings round a hub, the two hands' brass spines, the shards it breaks into, the cyan-white flare, and the ink
 * version of all of it for the impact frame. Brass is drawn flat and cel-shaded (lit from the upper left); only thin
 * rims of light go on the glow layer.
 */

/** When each ring arrives (it flies in, turning, and locks with a click). */
export const ARRIVE = { gear: 3.88, tick: 4.22, armil: 4.58, hub: 4.88 };
const LAND = 0.5;

/** A ring's arrival: 0 to 1, and the click's ring of light (0 to 1 over the click). */
export const arriveK = (t0: number, t: number) => easeOut(seg(t, t0, t0 + LAND));
export const clickK = (t0: number, t: number) => seg(t, t0 + LAND - 0.02, t0 + LAND + 0.4);

export interface RingPose { k: number; rot: number; scale: number }

/** Where every ring is at time t (frozen after T_STOP). */
export function clockPose(t: number) {
  const tf = Math.min(t, T_STOP);
  const fly = (t0: number, spin: number, from = 1.6): RingPose => {
    const k = arriveK(t0, t);
    return { k, rot: (1 - k) * spin, scale: lerp(from, 1, k) };
  };
  const gear = fly(ARRIVE.gear, 1.4);
  gear.rot += 0.16 * (tf - ARRIVE.gear);
  // The hour ring stays upright, with a small jolt on each tick (every half second).
  const tick = fly(ARRIVE.tick, -1.6);
  const ph = (tf * 2) % 1;
  tick.rot += 0.012 * Math.exp(-ph * 9) * Math.sin(ph * 40);
  const armil = fly(ARRIVE.armil, 2.2, 0.4);
  const hub = fly(ARRIVE.hub, 0, 0.2);
  return { gear, tick, armil, hub, tf };
}

/** Light comes from the upper left: x + y below this (times the radius) is lit, above `SHADE` is in shadow. */
const SHADE = 0.12, LIT = -0.72;

/** The band between r0 and r1 over angles a0..a1 (a full ring when a1 - a0 is a full turn), with gear teeth if asked. */
export function bandPath(ctx: Ctx, r0: number, r1: number, a0 = 0, a1 = Math.PI * 2, teeth = 0, toothH = 0, rot = 0) {
  const full = a1 - a0 >= Math.PI * 2 - 1e-6;
  ctx.beginPath();
  const outer: Pt[] = [];
  if (teeth > 0) {
    const per = (Math.PI * 2) / teeth;
    const i0 = Math.floor((a0 - rot) / per) - 1, i1 = Math.ceil((a1 - rot) / per) + 1;
    for (let i = i0; i <= i1; i++) {
      for (const [u, h] of [[0, 0], [0.18, 0], [0.32, 1], [0.62, 1], [0.76, 0]] as const) {
        const a = rot + (i + u) * per;
        if (a < a0 || a > a1) continue;
        outer.push({ x: Math.cos(a) * (r1 + toothH * h), y: Math.sin(a) * (r1 + toothH * h) });
      }
    }
    if (!full) {
      outer.unshift({ x: Math.cos(a0) * r1, y: Math.sin(a0) * r1 });
      outer.push({ x: Math.cos(a1) * r1, y: Math.sin(a1) * r1 });
    }
  } else {
    const n = Math.max(6, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 120));
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      outer.push({ x: Math.cos(a) * r1, y: Math.sin(a) * r1 });
    }
  }
  outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  const n = Math.max(6, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 120));
  if (full) {
    ctx.closePath();
    ctx.moveTo(r0, 0);
    for (let i = n; i >= 0; i--) ctx.lineTo(Math.cos((i / n) * Math.PI * 2) * r0, Math.sin((i / n) * Math.PI * 2) * r0);
  } else {
    for (let i = n; i >= 0; i--) {
      const a = lerp(a0, a1, i / n);
      ctx.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
    }
  }
  ctx.closePath();
}

/** The lower-right half-plane x + y > c (path only). */
function halfPlane(ctx: Ctx, c: number, lower = true) {
  const s = lower ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(c / 2 + 3000, c / 2 - 3000);
  ctx.lineTo(c / 2 - 3000, c / 2 + 3000);
  ctx.lineTo(c / 2 - 3000 + s * 5000, c / 2 + 3000 + s * 5000);
  ctx.lineTo(c / 2 + 3000 + s * 5000, c / 2 - 3000 + s * 5000);
  ctx.closePath();
}

type Look = 'brass' | 'ink';

/**
 * A cel-shaded brass band, in the ring's frame (the caller has moved to the centre and scaled). The band's shape turns
 * with `rot`; its light stays put. `ink` draws it as a solid ink silhouette for the impact frame.
 */
export function brassBand(ctx: Ctx, r0: number, r1: number, opts: { rot?: number; teeth?: number; toothH?: number; a0?: number; a1?: number; look?: Look; dots?: boolean } = {}) {
  const { rot = 0, teeth = 0, toothH = 0, a0 = 0, a1 = Math.PI * 2, look = 'brass' } = opts;
  const path = () => bandPath(ctx, r0, r1, a0 + rot, a1 + rot, teeth, toothH, rot);
  if (look === 'ink') {
    path();
    ctx.fillStyle = '#120f24';
    ctx.fill('evenodd');
    return;
  }
  path();
  ctx.fillStyle = BRASS;
  ctx.fill('evenodd');
  ctx.save();
  path();
  ctx.clip('evenodd');
  const ro = r1 + toothH;
  halfPlane(ctx, SHADE * ro * 1.41);
  ctx.fillStyle = BRASS_SH;
  ctx.fill();
  halfPlane(ctx, LIT * ro * 1.41, false);
  ctx.fillStyle = BRASS_HI;
  ctx.fill();
  if (opts.dots) {
    halftone(ctx, rgba(BRASS_DK, 0.55), 9, (x, y) => ((x + y) / 1.41 - SHADE * ro) / (ro * 0.9) + 0.15,
      { x: -ro * 0.1, y: -ro * 0.1, w: ro * 1.1, h: ro * 1.1 });
  }
  // Engraved lines just inside both edges.
  ctx.strokeStyle = rgba(BRASS_DK, 0.55);
  ctx.lineWidth = 1.6;
  for (const r of [r0 + 7, r1 - 7]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, a0 + rot, a1 + rot);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  path();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** One hour mark as strokes: I, V and X shapes between two thin bars (in the mark's own frame, up = outward). */
function numeral(ctx: Ctx, text: string, h: number) {
  const wOf = (c: string) => (c === 'I' ? 0.32 : 0.62) * h;
  const gap = 0.12 * h;
  const total = [...text].reduce((s, c) => s + wOf(c), 0) + gap * (text.length - 1);
  let x = -total / 2;
  const y0 = -h / 2, y1 = h / 2;
  ctx.beginPath();
  for (const c of text) {
    const w = wOf(c);
    if (c === 'I') { ctx.moveTo(x + w / 2, y0); ctx.lineTo(x + w / 2, y1); }
    if (c === 'V') { ctx.moveTo(x, y0); ctx.lineTo(x + w / 2, y1); ctx.lineTo(x + w, y0); }
    if (c === 'X') { ctx.moveTo(x, y0); ctx.lineTo(x + w, y1); ctx.moveTo(x + w, y0); ctx.lineTo(x, y1); }
    x += w + gap;
  }
  ctx.moveTo(-total / 2 - 3, y0); ctx.lineTo(total / 2 + 3, y0);
  ctx.moveTo(-total / 2 - 3, y1); ctx.lineTo(total / 2 + 3, y1);
}

/** The hour ring's marks (minute ticks and the twelve numerals), engraved (in the ring's frame). */
export function hourMarks(ctx: Ctx, rot: number, look: Look = 'brass', range?: [number, number]) {
  const inRange = (a: number) => !range || [a, a + Math.PI * 2, a - Math.PI * 2].some((b) => b >= range[0] + 0.04 && b <= range[1] - 0.04);
  const mid = (R.tickIn + R.tickOut) / 2;
  ctx.save();
  ctx.lineCap = 'round';
  // Minute ticks along the outer edge.
  ctx.strokeStyle = look === 'ink' ? '#e8e0c8' : OUTLINE;
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = -Math.PI / 2 + (i / 60) * Math.PI * 2;
    if (!inRange(a)) continue;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a + rot) * (R.tickOut - 6), Math.sin(a + rot) * (R.tickOut - 6));
    ctx.lineTo(Math.cos(a + rot) * (R.tickOut - 15), Math.sin(a + rot) * (R.tickOut - 15));
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    if (!inRange(a)) continue;
    ctx.save();
    ctx.translate(Math.cos(a + rot) * (mid - 4), Math.sin(a + rot) * (mid - 4));
    ctx.rotate(a + rot + Math.PI / 2);
    numeral(ctx, ROMAN[i], 26);
    if (look === 'brass') {
      ctx.strokeStyle = rgba(BRASS_HI, 0.9);
      ctx.lineWidth = 2;
      ctx.translate(-1, 1.5);
      ctx.stroke();
      ctx.translate(1, -1.5);
    }
    ctx.strokeStyle = look === 'ink' ? '#e8e0c8' : OUTLINE;
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** The gear ring's round holes, engraved (in its frame). */
function gearHoles(ctx: Ctx, rot: number) {
  const r = (R.gearIn + R.gearOut) / 2;
  for (let i = 0; i < 16; i++) {
    const a = rot + (i / 16) * Math.PI * 2, p = { x: Math.cos(a) * r, y: Math.sin(a) * r };
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = BRASS_DK;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x + 1.5, p.y + 1.5, 8, Math.PI * 1.05, Math.PI * 1.45);
    ctx.strokeStyle = BRASS_HI;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** An armillary ring seen at a slant: an ellipse with radius r, squashed by cos(phase), tilted (in the centre's frame). */
function armilRing(ctx: Ctx, r: number, phase: number, tilt: number, look: Look) {
  const ry = Math.max(2, r * Math.abs(Math.cos(phase)));
  ctx.beginPath();
  ctx.ellipse(0, 0, r, ry, tilt, 0, Math.PI * 2);
  if (look === 'ink') {
    ctx.strokeStyle = '#120f24';
    ctx.lineWidth = 16;
    ctx.stroke();
    return;
  }
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 17;
  ctx.stroke();
  ctx.strokeStyle = BRASS_SH;
  ctx.lineWidth = 11;
  ctx.stroke();
  // The lit half of the ellipse.
  ctx.beginPath();
  ctx.ellipse(0, 0, r, ry, tilt, Math.PI * 0.95, Math.PI * 1.95);
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 11;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, r - 2, Math.max(1, ry - 2), tilt, Math.PI * 1.1, Math.PI * 1.6);
  ctx.strokeStyle = BRASS_HI;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** The armillary: an equator ring with degree ticks, and two rings turning on their axes (in the centre's frame). */
function armillary(ctx: Ctx, tf: number, rot: number, look: Look) {
  armilRing(ctx, R.armil - 30, 0.9 + tf * 1.6, 0.5 + rot, look);
  armilRing(ctx, R.armil - 60, 2.4 - tf * 2.1, -0.9 + rot * 0.6, look);
  brassBand(ctx, R.armil - 12, R.armil + 12, { rot, look });
  if (look === 'brass') {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 48; i++) {
      const a = rot + (i / 48) * Math.PI * 2, l = i % 4 === 0 ? 14 : 7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R.armil + 11), Math.sin(a) * (R.armil + 11));
      ctx.lineTo(Math.cos(a) * (R.armil + 11 - l), Math.sin(a) * (R.armil + 11 - l));
      ctx.stroke();
    }
  }
}

/** The hub at the centre: a brass boss with a dark socket for the core star (in the centre's frame). */
function hub(ctx: Ctx, look: Look) {
  brassBand(ctx, 22, R.hub, { teeth: 14, toothH: 9, rot: 0.1, look });
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fillStyle = look === 'ink' ? '#e8e0c8' : '#0a0a18';
  ctx.fill();
  ctx.strokeStyle = look === 'ink' ? '#120f24' : OUTLINE;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** The whole clock body (not the hands), on the flat layer. */
export function clockBody(ctx: Ctx, t: number, look: Look = 'brass', poseT = t) {
  const P = clockPose(poseT);
  const ring = (p: RingPose, draw: (rot: number) => void) => {
    if (p.k <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(p.k * 2.5);
    ctx.translate(C.x, C.y);
    ctx.scale(p.scale, p.scale);
    draw(p.rot);
    ctx.restore();
  };
  ring(P.armil, (rot) => armillary(ctx, P.tf, rot, look));
  ring(P.tick, (rot) => {
    brassBand(ctx, R.tickIn, R.tickOut, { rot, look, dots: true });
    hourMarks(ctx, rot, look);
  });
  ring(P.gear, (rot) => {
    brassBand(ctx, R.gearIn, R.gearOut, { rot, teeth: 48, toothH: R.teeth - R.gearOut, look, dots: true });
    if (look === 'brass') gearHoles(ctx, rot);
  });
  ring(P.hub, () => hub(ctx, look));
}

/** Thin rims of light along the rings' lit edges and the clicks as each ring locks (glow). */
export function clockRims(ctx: Ctx, t: number, k = 1, color = GOLD) {
  const P = clockPose(t);
  ctx.save();
  ctx.lineCap = 'round';
  for (const [p, r] of [[P.gear, R.teeth + 2], [P.tick, R.tickOut + 1], [P.armil, R.armil + 13]] as const) {
    if (p.k <= 0) continue;
    ctx.beginPath();
    ctx.arc(C.x, C.y, r * p.scale, Math.PI * 0.95, Math.PI * 1.55);
    ctx.strokeStyle = rgba(color, 0.55 * k * p.k);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
  for (const [t0, r] of [[ARRIVE.gear, R.teeth], [ARRIVE.tick, R.tickOut], [ARRIVE.armil, R.armil], [ARRIVE.hub, R.hub + 10]] as const) {
    const c = clickK(t0, t);
    if (c <= 0 || c >= 1) continue;
    ctx.beginPath();
    ctx.arc(C.x, C.y, r + 160 * easeOut(c), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(color, 0.6 * (1 - c) * k);
    ctx.lineWidth = 6 * (1 - c) + 1;
    ctx.stroke();
    // A small spray of sparks round the ring.
    const sp = rng(Math.round(t0 * 100));
    for (let i = 0; i < 18; i++) {
      const a = sp.range(0, Math.PI * 2), d = r + 10 + 120 * easeOut(c) * sp.range(0.5, 1.2);
      ctx.fillStyle = rgba('#ffe6a8', (1 - c) * k);
      ctx.beginPath();
      ctx.arc(C.x + Math.cos(a) * d, C.y + Math.sin(a) * d, 2.4 * (1 - c) + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The core star in the hub: cyan-white, pulsing (glow). `white` turns it to plain white-gold (time stopped). */
export function coreStar(ctx: Ctx, t: number, k: number, white = 0, boost = 0) {
  if (k <= 0) return;
  const pulse = 1 + 0.12 * Math.sin(t * 7) + boost;
  const col = white > 0.5 ? '#ffe7b0' : CYAN;
  const R0 = 70 * pulse * k;
  const g = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, R0);
  g.addColorStop(0, rgba('#ffffff', 0.95 * k));
  g.addColorStop(0.25, rgba(col, 0.7 * k));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(C.x, C.y, R0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.9 * k);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + t * 0.4, l = (i % 2 ? 70 : 110) * pulse * k;
    ribbon(ctx, [C, polar(a, l * 0.5), polar(a, l)], (u) => 7 * (1 - u));
  }
}

/** A hand's brass spine (flat): a slender blade with an open lozenge near its tip and a round counterweight. */
export function handSpine(ctx: Ctx, angle: number, len: number, grow: number, look: Look = 'brass') {
  if (grow <= 0) return;
  const L = len * grow;
  ctx.save();
  ctx.translate(C.x, C.y);
  ctx.rotate(angle);
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-40, -8);
    ctx.lineTo(L * 0.68, -4.5);
    ctx.lineTo(L * 0.79, -19);
    ctx.lineTo(L * 0.9, -4);
    ctx.lineTo(L + 18, 0);
    ctx.lineTo(L * 0.9, 4);
    ctx.lineTo(L * 0.79, 19);
    ctx.lineTo(L * 0.68, 4.5);
    ctx.lineTo(-40, 8);
    ctx.closePath();
    ctx.moveTo(-40 + 17, 0);
    ctx.arc(-40, 0, 17, 0, Math.PI * 2);
  };
  shape();
  ctx.fillStyle = look === 'ink' ? '#120f24' : BRASS;
  ctx.fill('nonzero');
  if (look === 'brass') {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // The lozenge's open middle and the spine's lit edge.
    ctx.beginPath();
    ctx.moveTo(L * 0.73, 0); ctx.lineTo(L * 0.79, -9); ctx.lineTo(L * 0.85, 0); ctx.lineTo(L * 0.79, 9); ctx.closePath();
    ctx.fillStyle = BRASS_DK;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-24, -4.5); ctx.lineTo(L * 0.66, -2.4);
    ctx.strokeStyle = BRASS_HI;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();
}

/** How far each hand has gathered its stars (0 to 1): the share of its stars that have arrived. */
export function handGrow(hand: 'h' | 'm', t: number, pull: (n: number, t: number) => number) {
  let s = 0, n = 0;
  HAND_FROM.forEach((h, i) => { if (h.hand === hand) { s += pull(i, t); n++; } });
  return s / n;
}

/** The hands' lines of light between their stars, and the trail of light they leave as they sweep (glow). */
export function handLight(ctx: Ctx, t: number, pull: (n: number, t: number) => number, k = 1, color = '#ffe9bc') {
  const ang = handAngles(t);
  for (const hand of ['h', 'm'] as const) {
    const ids = HAND_FROM.map((h, i) => ({ h, i })).filter((x) => x.h.hand === hand);
    const pts = ids.map((x) => starPos(x.h.c, x.h.i, t));
    const from: Pt = C;
    [from, ...pts].forEach((p, j, all) => {
      if (j === 0) return;
      const q = all[j - 1];
      const a = k * (j === 1 ? pull(ids[0].i, t) : Math.min(pull(ids[j - 1].i, t), pull(ids[j - 2].i, t)));
      if (a <= 0) return;
      for (const [w, col, al] of [[8, GOLD, 0.2], [2.2, color, 0.85]] as const) {
        ctx.strokeStyle = rgba(col, al * a);
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
    });
    // The trail: arcs of light behind the stars while the hand moves fast.
    if (t < T_STOP) {
      const sp = hand === 'm' ? ang.speed : ang.speed * 0.32;
      const trail = Math.min(2.4, sp * 0.07);
      if (trail > 0.05) {
        const a1 = ang[hand], slots = (hand === 'h' ? HOUR : MINUTE).slots;
        for (const [d] of slots) {
          for (const [frac, al, w] of [[1, 0.16, 5], [0.45, 0.32, 3]] as const) {
            ctx.beginPath();
            ctx.arc(C.x, C.y, d, a1 - trail * frac, a1);
            ctx.strokeStyle = rgba(GOLD, al * k);
            ctx.lineWidth = w;
            ctx.stroke();
          }
        }
      }
    }
  }
}

/** A shard of the broken clock: a piece of one ring's band. */
export interface Shard { ring: 'gear' | 'tick' | 'armil'; r0: number; r1: number; a0: number; a1: number; z: number; spin: number }

function cutRing(ring: Shard['ring'], r0: number, r1: number, n: number, seed: number): Shard[] {
  const r = rng(seed), cuts: number[] = [];
  for (let i = 0; i < n; i++) cuts.push(-Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2 + r.range(-0.12, 0.12));
  return cuts.map((a0, i) => ({
    ring, r0, r1, a0, a1: i + 1 < n ? cuts[i + 1] : cuts[0] + Math.PI * 2, z: r.range(0.45, 1.7), spin: r.range(1.5, 5) * r.sign(),
  }));
}

export const SHARDS: Shard[] = [
  ...cutRing('gear', R.gearIn, R.gearOut, 11, 501),
  ...cutRing('tick', R.tickIn, R.tickOut, 9, 502),
  ...cutRing('armil', R.armil - 12, R.armil + 12, 7, 503),
];

/** The cracks along the shards' edges, spreading as `k` grows (glow). */
export function cracks(ctx: Ctx, t: number, k: number, color = '#fff0c0') {
  if (k <= 0) return;
  const P = clockPose(t);
  ctx.save();
  SHARDS.forEach((s, i) => {
    const kk = clamp(k * 1.6 - (i % 7) * 0.09);
    if (kk <= 0) return;
    const rot = s.ring === 'gear' ? P.gear.rot : s.ring === 'tick' ? P.tick.rot : P.armil.rot;
    const a = s.a0 + rot, r1 = s.r1 + (s.ring === 'gear' ? R.teeth - R.gearOut : 0);
    const pts = bolt(rng(900 + i), polar(a, s.r0 - 4), polar(a, lerp(s.r0, r1 + 6, kk)), 9, 3);
    ctx.lineJoin = 'round';
    for (const [w, col, al] of [[7, GOLD, 0.3], [2.4, color, 1]] as const) {
      ctx.strokeStyle = rgba(col, al * kk);
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
  });
  ctx.restore();
}

/** A shard's resting centre (in the picture), for its ring's pose at the moment time stopped. */
function shardHome(s: Shard, rot: number): Pt {
  return polar((s.a0 + s.a1) / 2 + rot, (s.r0 + s.r1) / 2);
}

/** One shard drawn at a pose: its centre moved to `at`, turned by `spin`, scaled (flat). */
export function drawShard(ctx: Ctx, s: Shard, ringRot: number, at: Pt, spin: number, scale: number, look: Look = 'brass') {
  const home = shardHome(s, ringRot);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);
  ctx.translate(-(home.x - C.x), -(home.y - C.y));
  // In the clock's frame from here: the band's own light turns with the shard, so shade it by its turn.
  const teeth = s.ring === 'gear' ? 48 : 0, toothH = s.ring === 'gear' ? R.teeth - R.gearOut : 0;
  const path = () => bandPath(ctx, s.r0, s.r1, s.a0 + ringRot, s.a1 + ringRot, teeth, toothH, ringRot);
  path();
  if (look === 'ink') {
    ctx.fillStyle = '#120f24';
    ctx.fill();
  } else {
    ctx.fillStyle = BRASS;
    ctx.fill();
    const shade = 0.5 + 0.5 * Math.sin(spin + (s.a0 + s.a1) / 2);
    ctx.fillStyle = rgba(BRASS_SH, 0.85 * shade);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.arc(0, 0, s.r1 - 3, s.a0 + ringRot, s.a1 + ringRot);
    ctx.strokeStyle = rgba(BRASS_HI, 1 - shade * 0.7);
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();
    if (s.ring === 'tick') hourMarks(ctx, ringRot, 'brass', [s.a0, s.a1]);
    path();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.4 / Math.max(1, scale * 0.6);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/** The burst: every shard flying out at the viewer, turning, `u` seconds after it broke (flat). */
export function flyingShards(ctx: Ctx, u: number, look: Look = 'brass') {
  const P = clockPose(T_STOP);
  // Far ones first, so the big ones flying at the viewer pass in front.
  const order = SHARDS.map((s, i) => ({ s, i })).sort((a, b) => a.s.z - b.s.z);
  for (const { s, i } of order) {
    const rot = s.ring === 'gear' ? P.gear.rot : s.ring === 'tick' ? P.tick.rot : P.armil.rot;
    const home = shardHome(s, rot);
    const f = 1 + 1.9 * u * s.z + 1.6 * u * u * s.z;
    const at = { x: C.x + (home.x - C.x) * f, y: C.y + (home.y - C.y) * f + 60 * u * u };
    const scale = 1 + 1.25 * u * s.z * s.z;
    if (Math.abs(at.x - C.x) > 1500 * scale || Math.abs(at.y - C.y) > 1100 * scale) continue;
    drawShard(ctx, s, rot, at, s.spin * u * (0.6 + 0.4 * (i % 3)), scale, look);
  }
}

/** The cyan-white star flare bursting at the viewer, `u` seconds after the break (glow). */
export function flare(ctx: Ctx, u: number, k = 1) {
  if (k <= 0 || u < 0) return;
  const grow = easeOut(seg(u, 0, 0.22)), fade = (1 - seg(u, 0.25, 1.15)) * k;
  if (fade <= 0) return;
  const R0 = 380 * grow;
  const g = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, R0);
  g.addColorStop(0, rgba('#ffffff', 0.95 * fade));
  g.addColorStop(0.18, rgba('#e8fdff', 0.8 * fade));
  g.addColorStop(0.5, rgba(CYAN, 0.28 * fade));
  g.addColorStop(1, rgba(CYAN, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(C.x, C.y, R0, 0, Math.PI * 2);
  ctx.fill();
  // The long horizontal streak and a shorter upright one.
  for (const [rx, ry, al] of [[1250 * grow, 16, 0.75], [20, 520 * grow, 0.4]] as const) {
    const s = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, Math.max(rx, ry));
    s.addColorStop(0, rgba('#ffffff', al * fade));
    s.addColorStop(0.4, rgba(CYAN, al * 0.6 * fade));
    s.addColorStop(1, rgba(CYAN, 0));
    ctx.fillStyle = s;
    ctx.beginPath();
    ctx.ellipse(C.x, C.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rays.
  const r = rng(61);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r.range(-0.1, 0.1) + u * 0.25, len = r.range(500, 1200) * grow;
    ctx.fillStyle = rgba(i % 2 ? '#ffffff' : CYAN, 0.55 * fade);
    ribbon(ctx, [polar(a, 30), polar(a, len * 0.4), polar(a, len)], (v) => 12 * (1 - v));
  }
  // The shock ring.
  const sk = seg(u, 0, 0.9);
  if (sk < 1) {
    ctx.beginPath();
    ctx.arc(C.x, C.y, 80 + 1500 * easeOut(sk), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(CYAN, 0.7 * (1 - sk));
    ctx.lineWidth = 16 * (1 - sk) + 2;
    ctx.stroke();
  }
}

/** The ink speed lines of the impact frame, out from the centre (flat). */
export function inkRays(ctx: Ctx, seed: number, color: string) {
  const r = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < 90; i++) {
    const a = r.range(0, Math.PI * 2), r0 = r.range(480, 700), r1 = r0 + r.range(300, 900);
    ribbon(ctx, Array.from({ length: 7 }, (_, j) => polar(a, lerp(r0, r1, j / 6))), (v) => r.range(3, 12) * Math.sin(Math.PI * v));
  }
}

/** The shard of the hour ring with XII on it, as it lies on the paper at the end. */
export const XII: Shard = { ring: 'tick', r0: R.tickIn, r1: R.tickOut, a0: -Math.PI / 2 - 0.27, a1: -Math.PI / 2 + 0.23, z: 1, spin: 0 };
