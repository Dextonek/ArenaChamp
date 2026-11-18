import { clamp, rgba, rng, type Ctx } from '../../core';
import { C } from './common';
import { lanternFlat, type LanternPose } from './lantern';
import { GROUND, HORIZON, MOON, VX, gate } from './night';

/**
 * Dawn on the paper: the night's scene again, but as a pale sumi wash (the moon an ink ring, the gate and the path in
 * grey, the lanterns out); and ash drifting down.
 */

/** The landscape at dawn (flat): grey ink on the paper, the procession's lanterns unlit and faded into it. */
export function dawnScene(ctx: Ctx, lanterns: LanternPose[], t: number) {
  // The moon, now only a brushed ink ring, a little open.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba('#5d625e', 0.55);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(MOON.x, MOON.y, MOON.r, -1.2, Math.PI * 1.55);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba('#5d625e', 0.35);
  ctx.beginPath();
  ctx.arc(MOON.x, MOON.y, MOON.r + 16, 0.4, 2.6);
  ctx.stroke();
  ctx.restore();
  gate(ctx, '#7e837e', 0.75);
  // The path: two grey lines to the gate, a few joints.
  ctx.save();
  ctx.strokeStyle = rgba('#6d716c', 0.55);
  ctx.lineWidth = 3;
  const half = 300;
  const y = (s: number) => HORIZON + GROUND * s;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(VX + side * half * 1.15, y(1.15));
    ctx.lineTo(VX + side * half * 0.16, y(0.16));
  }
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba('#6d716c', 0.3);
  for (let z = 1.2; z < 6; z += 0.6) {
    const s = 1 / z;
    ctx.beginPath();
    ctx.moveTo(VX - half * s, y(s));
    ctx.lineTo(VX + half * s, y(s));
    ctx.stroke();
  }
  ctx.restore();
  // The lanterns, out, faded into the wash (far ones first).
  for (let i = lanterns.length - 1; i >= 0; i--) lanternFlat(ctx, { ...lanterns[i], alpha: 0.55 });
  void t;
}

/** Ash drifting down (flat): grey flakes and a few bone-ivory ones, turning as they fall. */
export function ashMotes(ctx: Ctx, t: number, k: number) {
  if (k <= 0) return;
  const r = rng(6161);
  for (let i = 0; i < 60; i++) {
    const x0 = r.range(-40, 1960), sp = r.range(30, 70), off = r.range(0, 1200), sw = r.range(20, 60), ph = r.range(0, 6.28);
    const size = r.next() < 0.75 ? r.range(3.5, 6.5) : r.range(8, 12);
    const bone = r.next() < 0.3;
    const yy = -40 + ((t * sp + off) % 1160);
    const x = x0 + Math.sin(t * 0.9 + ph) * sw;
    const turn = t * 2 + ph;
    ctx.save();
    ctx.translate(x, yy);
    ctx.rotate(turn);
    ctx.scale(1, 0.45 + 0.4 * Math.abs(Math.sin(turn)));
    ctx.fillStyle = rgba(bone ? C.boneShade : '#77746e', clamp(k) * (bone ? 0.95 : 0.6));
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.lineTo(0, -size * 0.6);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size * 0.7);
    ctx.closePath();
    ctx.fill();
    if (bone) {
      ctx.strokeStyle = rgba('#8a7f68', 0.8 * k);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }
}
