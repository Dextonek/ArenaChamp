import { clamp, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { NIGHT, TEAL, TEAL_LIGHT, dots, streak } from './common';
import { mix } from './wave';

/**
 * The full moon behind the wave: painted on the paper with one ink stroke round a cream disc, then, as the night falls,
 * a teal disc with a burning rim (the disc on the flat layer, only the rims and a thin halo on the glow layer, so the
 * bloom does not wash the frame).
 */

export interface MoonLook { x: number; y: number; r: number }

/** The moon on the flat layer: `paint` 0..1 the brush stroke round it, `teal` 0..1 its night colour. */
export function moonFlat(ctx: Ctx, m: MoonLook, paint: number, teal: number) {
  if (paint <= 0) return;
  const fill = clamp(paint * 1.4);
  ctx.save();
  ctx.globalAlpha = fill;
  const g = ctx.createRadialGradient(m.x - m.r * 0.25, m.y - m.r * 0.3, m.r * 0.1, m.x, m.y, m.r);
  g.addColorStop(0, mix('#fbf6e6', '#c9fff4', teal));
  g.addColorStop(0.7, mix('#f3ead2', '#45c7b8', teal));
  g.addColorStop(1, mix('#e2d5b6', '#16756f', teal));
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // Faint seas on the moon, in halftone.
  halftone(ctx, rgba(mix('#b9a983', '#0d5a5a', teal), 0.5), 11, (x, y) => {
    const a = Math.hypot(x - (m.x + m.r * 0.25), y - (m.y - m.r * 0.15)) / (m.r * 0.38);
    const b = Math.hypot(x - (m.x - m.r * 0.3), y - (m.y + m.r * 0.35)) / (m.r * 0.3);
    const inside = Math.hypot(x - m.x, y - m.y) < m.r * 0.95 ? 1 : 0;
    return inside * Math.max(0.65 - a * 0.6, 0.55 - b * 0.6, 0);
  }, { x: m.x - m.r, y: m.y - m.r, w: m.r * 2, h: m.r * 2 });
  ctx.restore();
  // The brush stroke round it: one turn from the top, its head a wet blob.
  const a0 = -Math.PI * 0.62, a1 = a0 + Math.PI * 2 * 0.97 * clamp(paint);
  const pts: Pt[] = [];
  for (let i = 0; i <= 90; i++) {
    const a = lerp(a0, a1, i / 90), w = 1 + 0.01 * Math.sin(a * 3 + 1);
    pts.push({ x: m.x + Math.cos(a) * m.r * w, y: m.y + Math.sin(a) * m.r * w });
  }
  ctx.fillStyle = mix('#1b2f4a', '#0a2a33', teal);
  ribbon(ctx, pts, (u) => 15 * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 0.75 + 0.25))));
}

/** The moon's light (glow layer): rim rings, a thin outer halo ring, `k` 0..1. */
export function moonGlow(ctx: Ctx, m: MoonLook, k: number, t: number) {
  if (k <= 0) return;
  for (const [w, c, a] of [[70, '#0e6a6a', 0.3], [30, TEAL, 0.75], [12, TEAL_LIGHT, 0.9], [4, '#f0fffb', 0.95]] as const) {
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(c, a * k);
    ctx.lineWidth = w;
    ctx.stroke();
  }
  // A faint wash inside the disc, so it reads as lit, not as a ring.
  const g = ctx.createRadialGradient(m.x - m.r * 0.2, m.y - m.r * 0.25, 0, m.x, m.y, m.r);
  g.addColorStop(0, rgba('#bff8ec', 0.22 * k));
  g.addColorStop(1, rgba('#2fb3a8', 0.05 * k));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
  ctx.fill();
  // Two thin halo rings and short rays, turning slowly.
  for (const [s, a] of [[1.22, 0.45], [1.45, 0.22]] as const) {
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * s, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(TEAL_LIGHT, a * k);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  const r = rng(61);
  for (let i = 0; i < 28; i++) {
    const a = r.range(0, Math.PI * 2) + t * 0.08, r0 = m.r * r.range(1.08, 1.2), r1 = r0 + m.r * r.range(0.08, 0.35);
    ctx.fillStyle = rgba(TEAL_LIGHT, 0.5 * k * r.range(0.4, 1));
    streak(ctx, { x: m.x + Math.cos(a) * r0, y: m.y + Math.sin(a) * r0 }, { x: m.x + Math.cos(a) * r1, y: m.y + Math.sin(a) * r1 }, 2);
  }
}

const field = wobble(303);

/**
 * The night falling over the paper sky: Prussian dots that grow from the top edge and the corners until they meet
 * (flat layer). `k` 0..1.
 */
export function nightFall(ctx: Ctx, k: number) {
  if (k <= 0) return;
  if (k >= 1) {
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, 1920, 1080);
    return;
  }
  // Where the dots have met, the solid night; at the front, dots.
  const reach = (x: number, y: number) => {
    const fromEdge = Math.min(y + 60, x + 200, 1920 - x + 200) / 700 + 0.12 * field(x * 0.005 + y * 0.003);
    return clamp((k * 1.7 - fromEdge) * 2.6);
  };
  dots(ctx, NIGHT, 22, (x, y) => reach(x, y) * 1.25);
}

/** A few stars in the night sky (glow layer), twinkling. */
export function stars(ctx: Ctx, k: number, t: number) {
  if (k <= 0) return;
  const r = rng(1234);
  for (let i = 0; i < 70; i++) {
    const x = r.range(0, 1920), y = r.range(0, 640), s = r.range(1, 2.6);
    const tw = 0.6 + 0.4 * Math.sin(t * r.range(2, 5) + i);
    ctx.fillStyle = rgba(r.next() < 0.7 ? '#cfeff0' : '#ffe6b0', k * tw * r.range(0.4, 1));
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
}
