import { clamp, lerp, ribbon, rng, rgba, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { FOAM, LINE, TEAL, TEAL_LIGHT } from './common';
import { mix } from './wave';

/**
 * The sea seen from above the trough, and the whirlpool that opens in it: bands of darker and lighter blue wound into a
 * spiral (as a woodblock cuts them), foam lines along the arms, a dark throat with teal light coming up out of it.
 * Everything is drawn flat and squashed into perspective (`ry/rx`).
 */

export interface Whirl { x: number; y: number; rx: number; ry: number }

/** The open sea from the horizon down (flat layer): `top` is the horizon's y. `night` 0..1. */
export function seaSurface(ctx: Ctx, top: number, t: number, night: number) {
  const g = ctx.createLinearGradient(0, top, 0, 1080);
  g.addColorStop(0, mix('#3d78a6', '#0f2f52', night));
  g.addColorStop(0.3, mix('#1d4f80', '#0a2342', night));
  g.addColorStop(1, mix('#0f2f57', '#06142a', night));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, 1920, 1080 - top + 4);
  ctx.fillStyle = LINE;
  ctx.fillRect(0, top - 3, 1920, 6);
  // Long lines lying on the water, closer together towards the horizon.
  const r = rng(888);
  for (let i = 0; i < 22; i++) {
    const v = (i + 0.5) / 22, y = top + (1080 - top) * v ** 1.6;
    const x0 = r.range(-200, 1700), len = r.range(200, 700) * (0.4 + v);
    const drift = (t * 40 * (0.3 + v)) % 400;
    const pts: Pt[] = [];
    for (let j = 0; j <= 16; j++) pts.push({ x: x0 + drift - 200 + (len * j) / 16, y: y + Math.sin(j * 0.8 + t * 2 + i) * 2 * v });
    ctx.fillStyle = rgba(i % 3 ? '#7fb0cc' : FOAM, (0.25 + 0.35 * v) * (1 - 0.35 * night));
    ribbon(ctx, pts, (k) => (1.5 + 3.5 * v) * Math.sin(Math.PI * k));
  }
}

/** A point on a spiral arm: angle `a` (radians), at radius fraction `f` (0 centre, 1 rim). */
function armPt(w: Whirl, a: number, f: number): Pt {
  return { x: w.x + Math.cos(a) * w.rx * f, y: w.y + Math.sin(a) * w.ry * f };
}

/**
 * The whirlpool on the flat layer: `k` 0..1 how far it has opened (its size and its turn), `t` time.
 */
export function whirlFlat(ctx: Ctx, w0: Whirl, k: number, t: number) {
  if (k <= 0) return;
  const w = { ...w0, rx: w0.rx * k, ry: w0.ry * k };
  const spin = t * 1.7;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.rx);
  g.addColorStop(0, '#020a14');
  g.addColorStop(0.25, '#06203a');
  g.addColorStop(0.7, '#0c3358');
  g.addColorStop(1, 'rgba(12,51,88,0)');
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.scale(1, w.ry / w.rx);
  ctx.translate(-w.x, -w.y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w.x, w.y, w.rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The arms: each a band that winds in, wide at the rim, thin at the throat.
  const ARMS = 9;
  for (let i = 0; i < ARMS; i++) {
    const a0 = (i / ARMS) * Math.PI * 2 + spin;
    const pts: Pt[] = [];
    for (let j = 0; j <= 40; j++) {
      const f = 1.05 - (j / 40) * 0.95;
      pts.push(armPt(w, a0 + (1 - f) * 4.2, f));
    }
    ctx.fillStyle = rgba(i % 2 ? '#2a6c9c' : '#1a4f7c', 0.85);
    ribbon(ctx, pts, (u) => (56 * k * (1 - u) ** 1.2 + 2) * Math.min(1, u * 5));
    // A foam line along the arm's leading edge.
    ctx.fillStyle = rgba(FOAM, 0.85);
    ribbon(ctx, pts.map((p, j) => ({ x: p.x, y: p.y - 10 * (1 - j / 40) * k })), (u) => 8 * k * (1 - u) ** 1.3 * Math.min(1, u * 4));
    ctx.fillStyle = rgba('#a8d4e6', 0.6);
    ribbon(ctx, pts.map((p, j) => ({ x: p.x, y: p.y + 16 * (1 - j / 40) * k })), (u) => 4 * k * (1 - u) * Math.min(1, u * 4));
  }
  // The throat.
  ctx.beginPath();
  ctx.ellipse(w.x, w.y, w.rx * 0.16, w.ry * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#01060d';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  halftone(ctx, rgba('#0a3050', 0.6), 14, (x, y) => {
    const d = Math.hypot((x - w.x) / w.rx, (y - w.y) / w.ry);
    return d < 1 ? clamp(1 - Math.abs(d - 0.6) * 3) * 0.7 : 0;
  }, { x: w.x - w.rx, y: w.y - w.ry, w: w.rx * 2, h: w.ry * 2 });
  ctx.restore();
}

/** The whirlpool's light (glow layer): teal rings sinking into the throat and a column of light rising from it. */
export function whirlGlow(ctx: Ctx, w0: Whirl, k: number, t: number, column: number) {
  if (k <= 0) return;
  const w = { ...w0, rx: w0.rx * k, ry: w0.ry * k };
  // Rings shrinking into the throat, on a loop.
  for (let i = 0; i < 4; i++) {
    const f = 1 - (((t * 0.5 + i / 4) % 1));
    const s = lerp(0.14, 0.75, f);
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, w.rx * s, w.ry * s, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(TEAL_LIGHT, 0.5 * k * (1 - f) * f * 3);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(w.x, w.y, w.rx * 0.16, w.ry * 0.16, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(TEAL, 0.9 * k);
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = rgba('#e8fffa', 0.9 * k);
  ctx.lineWidth = 3;
  ctx.stroke();
  // Glints on the arms.
  const spin = t * 1.7;
  for (let i = 0; i < 9; i++) {
    const a0 = (i / 9) * Math.PI * 2 + spin;
    const pts: Pt[] = [];
    for (let j = 0; j <= 30; j++) {
      const f = 0.9 - (j / 30) * 0.7;
      const p = armPt(w, a0 + (1 - f) * 4.2, f);
      pts.push({ x: p.x, y: p.y - 10 * (1 - j / 30) * k });
    }
    ctx.fillStyle = rgba(TEAL_LIGHT, 0.35 * k);
    ribbon(ctx, pts, (u) => 3 * Math.sin(Math.PI * u));
  }
  // Motes of light rising out of the throat.
  if (column > 0) {
    const r = rng(1717);
    for (let i = 0; i < 60; i++) {
      const life = r.range(1.2, 2.4), age = ((t + r.range(0, life)) % life) / life;
      const x = w.x + r.range(-1, 1) * w.rx * 0.14 * (1 + age * 1.5) + Math.sin(t * 2 + i) * 10;
      const y = w.y - age * r.range(250, 700);
      ctx.fillStyle = rgba(r.next() < 0.7 ? TEAL_LIGHT : '#ffffff', column * Math.sin(Math.PI * age) * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, r.range(1.5, 4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Spray and droplets thrown up round the whirlpool's rim (flat foam flecks), `k` 0..1. */
export function rimSpray(ctx: Ctx, w: Whirl, k: number, t: number, seed = 31) {
  if (k <= 0) return;
  const r = rng(seed);
  for (let i = 0; i < 70; i++) {
    const a = r.range(0, Math.PI * 2) + t * 1.7;
    const life = r.range(0.6, 1.2), age = ((t + r.range(0, life)) % life) / life;
    const p = armPt(w, a, r.range(0.5, 1.0));
    const up = r.range(60, 220) * age - 200 * age * age;
    const s = r.range(2, 6) * (1 - age) * k;
    if (s < 0.6) continue;
    ctx.fillStyle = LINE;
    ctx.beginPath();
    ctx.arc(p.x, p.y - up, s + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FOAM;
    ctx.beginPath();
    ctx.arc(p.x, p.y - up, s, 0, Math.PI * 2);
    ctx.fill();
  }
}
