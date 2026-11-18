import { clamp, lerp, ribbon, rng, rgba, type Ctx } from '../core';

/**
 * The dragon's eye inside the rift: an almond opening with a heavy upper lid, a dark red white of the eye with veins, a
 * burning iris of radial fibres, a slit pupil, and a wet highlight. `open` closes the lids (a blink); `dilate` opens the
 * slit into a round black pupil, and `vortex` turns that pupil into a spinning hole with a ring of light.
 *
 * Drawn in its own frame: x along the eye (corners at -HALF and +HALF), y down.
 */

const HALF = 430;

export interface EyeLook {
  x: number;
  y: number;
  angle: number;
  scale: number;
  /** 1 open, 0 shut. */
  open: number;
  /** 0 a slit, 1 a round pupil. */
  dilate: number;
  /** 0 none, 1 the pupil is a spinning hole with a ring of light. */
  vortex: number;
  /** Where the iris looks, -1 to 1 along the eye. */
  look: number;
  t: number;
  /** 0 to 1: the whole eye fades in. */
  alpha: number;
}

/** The lids' curves at opening `o`: the top one higher and fuller, the bottom one flatter. */
function lidPath(ctx: Ctx, o: number) {
  ctx.beginPath();
  ctx.moveTo(-HALF, 30);
  ctx.bezierCurveTo(-HALF * 0.55, 30 - 230 * o, HALF * 0.4, -40 - 190 * o, HALF, -40);
  ctx.bezierCurveTo(HALF * 0.45, -40 + 170 * o, -HALF * 0.45, 30 + 150 * o, -HALF, 30);
  ctx.closePath();
}

function topLid(ctx: Ctx, o: number) {
  ctx.beginPath();
  ctx.moveTo(-HALF, 30);
  ctx.bezierCurveTo(-HALF * 0.55, 30 - 230 * o, HALF * 0.4, -40 - 190 * o, HALF, -40);
}

function bottomLid(ctx: Ctx, o: number) {
  ctx.beginPath();
  ctx.moveTo(HALF, -40);
  ctx.bezierCurveTo(HALF * 0.45, -40 + 170 * o, -HALF * 0.45, 30 + 150 * o, -HALF, 30);
}

/** The eye on the flat layer. */
export function eyeFlat(ctx: Ctx, e: EyeLook) {
  if (e.alpha <= 0) return;
  const o = Math.max(0.02, e.open);
  ctx.save();
  ctx.globalAlpha = clamp(e.alpha);
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.scale(e.scale, e.scale);

  // A dark socket around the opening.
  ctx.save();
  ctx.scale(1.12, 1.35);
  lidPath(ctx, Math.max(o, 0.6));
  ctx.fillStyle = '#120404';
  ctx.fill();
  ctx.restore();

  lidPath(ctx, o);
  ctx.save();
  ctx.clip();
  // The white of the eye: dark red, lighter towards the iris.
  const ix = -40 + e.look * 80, iy = -10;
  const g = ctx.createRadialGradient(ix, iy, 60, ix, iy, 470);
  g.addColorStop(0, '#6a1c10');
  g.addColorStop(0.5, '#3d0d08');
  g.addColorStop(1, '#170404');
  ctx.fillStyle = g;
  ctx.fillRect(-HALF - 10, -320, HALF * 2 + 20, 640);
  // Veins.
  const vr = rng(404);
  ctx.strokeStyle = 'rgba(190,40,24,0.75)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    let x = vr.sign() * vr.range(200, 400), y = vr.range(-60, 80);
    ctx.lineWidth = vr.range(1.4, 3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (ix - x) * 0.12 + vr.range(-14, 14);
      y += vr.range(-18, 18);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  iris(ctx, ix, iy, e);
  // The upper lid's shadow over the eye.
  const sh = ctx.createLinearGradient(0, -200 * o, 0, -40 * o + 30);
  sh.addColorStop(0, 'rgba(10,2,2,0.85)');
  sh.addColorStop(1, 'rgba(10,2,2,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(-HALF, -320, HALF * 2, 320);
  ctx.restore();

  // The heavy upper lid line and its crease above.
  topLid(ctx, o);
  ctx.strokeStyle = '#080202';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.save();
  ctx.translate(30, -46 * o - 10);
  ctx.scale(0.86, 1);
  topLid(ctx, o * 0.9);
  ctx.strokeStyle = 'rgba(150,30,18,0.8)';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
  bottomLid(ctx, o);
  ctx.strokeStyle = '#140404';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();
}

/** The iris, pupil and highlight, inside the clip of the lids. */
function iris(ctx: Ctx, x: number, y: number, e: EyeLook) {
  const R = 150;
  const g = ctx.createRadialGradient(x, y, 10, x, y, R);
  g.addColorStop(0, '#ffb070');
  g.addColorStop(0.3, '#f0602a');
  g.addColorStop(0.7, '#b0200f');
  g.addColorStop(1, '#4a0804');
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // Fibres: thin light and dark wedges out from the middle.
  const r = rng(77);
  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * Math.PI * 2 + r.range(-0.03, 0.03);
    const r0 = r.range(30, 70), r1 = r.range(95, R - 6), w = r.range(0.015, 0.05);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a - w) * r1, y + Math.sin(a - w) * r1);
    ctx.lineTo(x + Math.cos(a + w) * r1, y + Math.sin(a + w) * r1);
    ctx.closePath();
    ctx.fillStyle = r.next() < 0.5 ? rgba('#ffc890', r.range(0.2, 0.5)) : rgba('#3a0604', r.range(0.3, 0.6));
    ctx.fill();
  }
  // A dark ring at the iris's edge.
  ctx.beginPath();
  ctx.arc(x, y, R - 4, 0, Math.PI * 2);
  ctx.strokeStyle = '#2a0504';
  ctx.lineWidth = 9;
  ctx.stroke();
  // The pupil: a tilted slit that rounds out as it dilates.
  const d = clamp(e.dilate);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.32);
  ctx.beginPath();
  ctx.ellipse(0, 0, lerp(12, 124, d), lerp(134, 124, d), 0, 0, Math.PI * 2);
  ctx.fillStyle = '#050101';
  ctx.fill();
  ctx.restore();
  // Highlights: a curved glint and a dot.
  if (e.vortex < 0.5) {
    ctx.fillStyle = 'rgba(255,250,245,0.95)';
    ctx.beginPath();
    ctx.ellipse(x - 112, y - 52, 13, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 150, y - 60); ctx.lineTo(x - 128, y - 86); ctx.lineTo(x - 136, y - 52); ctx.closePath();
    ctx.fillStyle = 'rgba(255,250,245,0.7)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 10, y + 48, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,250,245,0.85)';
    ctx.fill();
  }
}

/** What of the eye glows: the iris's heat, and the lower lid's lit rim (glow layer). */
export function eyeGlow(ctx: Ctx, e: EyeLook) {
  if (e.alpha <= 0) return;
  const o = Math.max(0.02, e.open);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.scale(e.scale, e.scale);
  const ix = -40 + e.look * 80, iy = -10;
  ctx.save();
  lidPath(ctx, o);
  ctx.clip();
  const g = ctx.createRadialGradient(ix, iy, 40, ix, iy, 170);
  g.addColorStop(0, rgba('#ff9a50', 0.0));
  g.addColorStop(0.6, rgba('#ff6a28', 0.22 * e.alpha));
  g.addColorStop(1, rgba('#ff3a10', 0));
  ctx.fillStyle = g;
  ctx.fillRect(ix - 180, iy - 180, 360, 360);
  if (e.vortex > 0) vortex(ctx, ix, iy, e);
  ctx.restore();
  bottomLid(ctx, o);
  ctx.strokeStyle = rgba('#ff6a2a', 0.85 * e.alpha);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/** The pupil as a hole: a ring of light, and curved blades of light spiralling in (glow layer, in the eye's frame). */
function vortex(ctx: Ctx, x: number, y: number, e: EyeLook) {
  const k = clamp(e.vortex), R = lerp(84, 124, k);
  ctx.save();
  ctx.translate(x, y);
  // The ring.
  for (const [w, c, a] of [[30, '#ff6a24', 0.45], [14, '#ffc890', 0.9], [5, '#fff6e8', 1]] as const) {
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(c, a * k);
    ctx.lineWidth = w;
    ctx.stroke();
  }
  // Blades: curved, thick in the middle, turning inwards as they go round.
  const r = rng(303), spin = e.t * 2.6;
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2 + spin + r.range(-0.15, 0.15);
    const r0 = R * r.range(0.82, 0.95), r1 = R * r.range(0.12, 0.3), sweep = r.range(1.1, 1.7);
    const pts = [];
    for (let j = 0; j <= 16; j++) {
      const u = j / 16, rad = lerp(r0, r1, u ** 0.8), a = a0 + sweep * u;
      pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
    }
    ctx.fillStyle = rgba(r.next() < 0.75 ? '#fff0dc' : '#ffb070', 0.85 * k);
    ribbon(ctx, pts, (u) => r.range(5, 9) * Math.sin(Math.PI * u) ** 0.7);
  }
  // Speed lines out from the ring, flickering.
  const slot = Math.floor(e.t * 15);
  for (let i = 0; i < 46; i++) {
    const q = rng(i * 131 + slot * 7);
    if (q.next() > 0.55) continue;
    const a = (i / 46) * Math.PI * 2 + q.range(-0.05, 0.05);
    const r0 = R * q.range(1.1, 1.3), r1 = R * q.range(1.6, 2.6);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.strokeStyle = rgba(q.next() < 0.5 ? '#ffd6a8' : '#ff7a3a', 0.6 * k);
    ctx.lineWidth = q.range(1, 2.4);
    ctx.stroke();
  }
  // Sparks falling in.
  for (let i = 0; i < 40; i++) {
    const life = (e.t * r.range(0.3, 0.7) + r.next()) % 1;
    const rad = R * 0.9 * (1 - life), a = r.range(0, 6.28) + e.t * 2 + life * 3;
    ctx.fillStyle = rgba(r.next() < 0.6 ? '#ff7a3a' : '#ffe0b0', k * Math.sin(Math.PI * life));
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad, r.range(2, 5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
