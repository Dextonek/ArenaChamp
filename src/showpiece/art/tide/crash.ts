import { clamp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { BLUE, FOAM, INDIGO, LINE, PRUSSIAN, streak } from './common';

/**
 * The crash: the water closes over the viewer from every side as a ring of foam claws, droplets fly at the camera, white
 * speed lines; then the paper comes back wet, with blue ink splashes and halftone where the water was.
 */

const ring = wobble(6060);

/** A claw finger from `base`, heading `ang`, curling by `curl` over its length. */
function finger(base: Pt, ang: number, len: number, curl: number, n = 12): Pt[] {
  const pts: Pt[] = [base];
  let x = base.x, y = base.y, a = ang;
  for (let i = 1; i <= n; i++) {
    a += (curl / n) * (0.3 + 1.7 * (i / n));
    const step = (len / n) * (1.2 - 0.5 * (i / n));
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push({ x, y });
  }
  return pts;
}

/** The wall's lower edge at x: bowed down in the middle (it leans at the camera) and rolling. */
function wallEdge(x: number, y: number, t: number) {
  const u = (x - 960) / 960;
  return y + 150 * (1 - u * u) + 26 * ring(x * 0.004 + t * 2.5) + 10 * Math.sin(x * 0.02 + t * 9);
}

/** The region the wall covers, claws and all (for erasing the glow layer under it). */
export function wallMask(ctx: Ctx, y: number, t: number) {
  ctx.beginPath();
  ctx.moveTo(-60, -60);
  for (let x = -60; x <= 1980; x += 24) ctx.lineTo(x, wallEdge(x, y, t) + 240);
  ctx.lineTo(1980, -60);
  ctx.closePath();
}

/**
 * A wall of water falling over the camera (flat layer): a Prussian mass from the top of the frame down to its edge at
 * `y`, striped with lighter lines that follow the edge, a heavy foam band along it and big foam claws hanging off it,
 * curling, with spray below. Then, behind it at `foamY`, the white foam that fills the frame.
 */
export function wallOfWater(ctx: Ctx, y: number, foamY: number, t: number) {
  const xs: number[] = [];
  for (let x = -60; x <= 1980; x += 24) xs.push(x);
  const edge = xs.map((x) => ({ x, y: wallEdge(x, y, t) }));
  // The water.
  ctx.beginPath();
  ctx.moveTo(-60, -60);
  for (const p of edge) ctx.lineTo(p.x, p.y);
  ctx.lineTo(1980, -60);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - 900, 0, y + 150);
  g.addColorStop(0, '#071a33');
  g.addColorStop(0.6, '#123f6e');
  g.addColorStop(1, '#2a6aa0');
  ctx.fillStyle = g;
  ctx.fill();
  // Lines following the edge, further apart away from it.
  for (let i = 1; i <= 9; i++) {
    const d = i * 46 + i * i * 9;
    const pts = xs.map((x) => ({ x, y: wallEdge(x, y, t) - d + 12 * Math.sin(x * 0.006 + i) }));
    ctx.fillStyle = rgba(i < 3 ? '#cfe6ee' : '#7fb0cc', 0.55 - i * 0.04);
    ribbon(ctx, pts, (u) => (i < 3 ? 7 : 5) * Math.sin(Math.PI * u) ** 0.4);
  }
  // Claws hanging off the edge, and the foam band over their roots.
  const r = rng(9393);
  const claws: { pts: Pt[]; w: number }[] = [];
  for (let x = -40; x <= 1960; x += r.range(90, 170)) {
    const bx = x + r.range(-20, 20), by = wallEdge(bx, y, t) + 10;
    const size = r.next() < 0.3 ? r.range(1.4, 1.9) : r.range(0.7, 1.15);
    const lobe = finger({ x: bx, y: by }, Math.PI / 2 + r.range(-0.3, 0.3), 90 * size, r.sign() * 0.5, 6);
    claws.push({ pts: lobe, w: 56 * size });
    const end = lobe[lobe.length - 1];
    for (let f = 0; f < 4; f++) {
      const fa = Math.PI / 2 + (f - 1.5) * 0.5 + r.range(-0.15, 0.15);
      claws.push({ pts: finger(end, fa, r.range(80, 150) * size, (f < 2 ? -1 : 1) * r.range(2.2, 3.2)), w: r.range(18, 26) * size });
    }
  }
  ctx.fillStyle = LINE;
  for (const c of claws) ribbon(ctx, c.pts, (u) => (c.w + 10) * (1 - u * 0.85));
  ribbon(ctx, edge, () => 84);
  ctx.fillStyle = FOAM;
  for (const c of claws) ribbon(ctx, c.pts, (u) => c.w * (1 - u * 0.92));
  ribbon(ctx, edge, () => 66);
  ctx.fillStyle = rgba('#8fb7cf', 0.9);
  ribbon(ctx, edge.map((p) => ({ x: p.x, y: p.y - 14 })), () => 8);
  // Spray below the edge.
  const sp = rng(Math.floor(t * 30) + 11);
  for (let i = 0; i < 60; i++) {
    const x = sp.range(-20, 1940), yy = wallEdge(x, y, t) + sp.range(60, 420), s = sp.range(3, 11);
    ctx.fillStyle = LINE;
    ctx.beginPath();
    ctx.arc(x, yy, s + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FOAM;
    ctx.beginPath();
    ctx.arc(x, yy, s, 0, Math.PI * 2);
    ctx.fill();
  }
  // The foam behind it, filling the frame from the top.
  if (foamY > -200) {
    const fe = xs.map((x) => ({ x, y: wallEdge(x, foamY, t + 0.7) }));
    ctx.beginPath();
    ctx.moveTo(-60, -60);
    for (const p of fe) ctx.lineTo(p.x, p.y);
    ctx.lineTo(1980, -60);
    ctx.closePath();
    ctx.fillStyle = FOAM;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const sr = rng(Math.floor(t * 24) + 77);
    for (let i = 0; i < 50; i++) {
      const x = sr.range(0, 1920), y0 = sr.range(-100, foamY + 100);
      ctx.fillStyle = rgba(sr.next() < 0.5 ? '#9cc6dc' : '#c9dfe8', sr.range(0.4, 0.9));
      streak(ctx, { x, y: y0 }, { x: x + sr.range(-20, 20), y: y0 + sr.range(120, 380) }, sr.range(2, 6));
    }
    ctx.restore();
    ctx.fillStyle = LINE;
    ribbon(ctx, fe, () => 10);
  }
}

/** Droplets flying at the camera from the centre, growing as they come (flat layer: blue drops with an ink edge). */
export function flyingDrops(ctx: Ctx, c: Pt, age: number, k: number) {
  if (k <= 0 || age < 0) return;
  const r = rng(8181);
  for (let i = 0; i < 46; i++) {
    const a = r.range(0, Math.PI * 2), sp = r.range(0.5, 1.4), delay = r.range(0, 0.25), s0 = r.range(6, 16);
    const blue = r.next() < 0.5;
    const g = Math.max(0, age - delay);
    if (g <= 0) continue;
    const d = 2200 * (g * sp) ** 1.6;
    const s = s0 * (1 + 10 * (g * sp) ** 2);
    const x = c.x + Math.cos(a) * d * 1.2, y = c.y + Math.sin(a) * d * 0.8;
    if (x < -s * 3 || x > 1920 + s * 3 || y < -s * 3 || y > 1080 + s * 3) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.globalAlpha = k;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.8, s, 0, 0, Math.PI * 2);
    ctx.fillStyle = LINE;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.8 - 5, s - 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = blue ? BLUE : INDIGO;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.5, -s * 0.35, s * 0.45, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = FOAM;
    ctx.fill();
    ctx.restore();
  }
}

/** White and teal speed lines out from a centre, flickering (glow layer). */
export function waterLines(ctx: Ctx, c: Pt, t: number, k: number, inner = 200) {
  if (k <= 0) return;
  const slot = Math.floor(t * 24);
  for (let i = 0; i < 70; i++) {
    const r = rng(i * 41 + slot * 977);
    if (r.next() > 0.55) continue;
    const a = r.range(0, Math.PI * 2), r0 = inner + r.range(0, 400), r1 = r0 + r.range(300, 1000);
    ctx.fillStyle = rgba(r.next() < 0.6 ? '#ffffff' : '#9ff2e6', 0.8 * k);
    streak(ctx, { x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0 }, { x: c.x + Math.cos(a) * r1, y: c.y + Math.sin(a) * r1 }, r.range(1.5, 4.5));
  }
}

/**
 * One blue ink splatter (flat layer): a round blob with soft lobes, a few thrown arms that end in round heads, scattered
 * drops on one side, and a drip. `k` 0..1 grows it in.
 */
export function splash(ctx: Ctx, at: Pt, size: number, seed: number, k: number, color = PRUSSIAN) {
  if (k <= 0) return;
  const r = rng(seed);
  const g = clamp(k * 1.6);
  const throwA = r.range(0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  const n = 48;
  const ph = [r.range(0, 6), r.range(0, 6), r.range(0, 6)];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = size * g * (0.82 + 0.1 * Math.sin(a * 3 + ph[0]) + 0.07 * Math.sin(a * 7 + ph[1]) + 0.04 * Math.sin(a * 13 + ph[2]));
    const x = at.x + Math.cos(a) * rr, y = at.y + Math.sin(a) * rr * 0.85;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // Thin spikes all round, of uneven length, some ending in a small drop.
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + r.range(-0.2, 0.2);
    const toward = Math.cos(a - throwA) * 0.5 + 0.5;
    const l = size * r.range(0.95, 1.25 + 0.9 * toward) * g, hw = size * r.range(0.04, 0.09);
    const tip = { x: at.x + Math.cos(a) * l, y: at.y + Math.sin(a) * l * 0.85 };
    ribbon(ctx, [{ x: at.x + Math.cos(a) * size * 0.6, y: at.y + Math.sin(a) * size * 0.5 }, tip], (u) => hw * 2 * (1 - u) ** 0.8);
    if (r.next() < 0.5) {
      ctx.beginPath();
      ctx.arc(tip.x + Math.cos(a) * hw * 3, tip.y + Math.sin(a) * hw * 3, hw * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Drops scattered beyond, on the thrown side.
  for (let i = 0; i < 16; i++) {
    const a = throwA + r.range(-1.4, 1.4), d = size * r.range(1.6, 3.4) * clamp(k * 1.3);
    ctx.beginPath();
    ctx.arc(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d * 0.85, r.range(2, size * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
  // A drip running down.
  const x = at.x + r.range(-0.4, 0.4) * size, len = size * r.range(0.5, 1.2) * clamp(k * 1.2 - 0.2);
  if (len > 0) {
    ribbon(ctx, [{ x, y: at.y + size * 0.5 }, { x, y: at.y + size * 0.7 + len }], (u) => size * 0.09 * (1 - u * 0.3));
    ctx.beginPath();
    ctx.arc(x, at.y + size * 0.7 + len, size * 0.065, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Wet halftone: blue dot clusters over the paper, shrinking away as `k` falls (flat layer). */
export function wetHalftone(ctx: Ctx, k: number, seed = 71) {
  if (k <= 0) return;
  const r = rng(seed);
  for (let i = 0; i < 6; i++) {
    const cx = r.range(200, 1720), cy = r.range(140, 640), rx = r.range(140, 260), ry = r.range(50, 100);
    halftone(ctx, rgba(i % 3 ? BLUE : PRUSSIAN, 0.6), 14, (x, y) => {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      return (1 - d) * 1.2 * k;
    }, { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 });
  }
}
