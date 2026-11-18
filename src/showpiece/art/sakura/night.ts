import { clamp, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';
import { MOON, bladeAt, type BladePose } from './petals';
import { SAKURA, flower } from './petal';

/**
 * The night and the cut: the plum-black ground under a pale full moon (and its paper twin, a disc of pink dots), the
 * night's ragged front, the blade's body of light and its guard, the swing, the slash, and the paper coming back out
 * of the cut line in dots.
 */

/** The paper moon: a disc of cherry halftone dots behind the branch (flat). */
export function paperMoon(ctx: Ctx, k: number) {
  if (k <= 0) return;
  const { x, y, r } = MOON;
  halftone(ctx, rgba('#f0a0bd', 0.6 * k), 13, (px, py) => {
    const d = Math.hypot(px - x, py - y) / r;
    return d < 1 ? 0.3 + 0.45 * (1 - d) ** 0.6 : 0;
  }, { x: x - r, y: y - r, w: r * 2, h: r * 2 });
  // A thin brushed ring round it.
  ctx.beginPath();
  ctx.arc(x, y, r + 8, -2.4, 3.3);
  ctx.strokeStyle = rgba('#d9577f', 0.35 * k);
  ctx.lineWidth = 2;
  ctx.stroke();
}

let ground: HTMLCanvasElement | null = null;

/** The night's ground: plum-black, lit round the moon, with a fine screen of dots (flat). Made once. */
export function nightGround(ctx: Ctx) {
  if (!ground) {
    ground = document.createElement('canvas');
    ground.width = 1920;
    ground.height = 1080;
    const g0 = ground.getContext('2d')!;
    g0.fillStyle = SAKURA.night;
    g0.fillRect(0, 0, 1920, 1080);
    const g = g0.createRadialGradient(MOON.x, MOON.y, MOON.r * 0.8, MOON.x, MOON.y, 1250);
    g.addColorStop(0, rgba('#4a1838', 0.95));
    g.addColorStop(0.35, rgba('#2a0c20', 0.8));
    g.addColorStop(1, rgba('#0a0307', 0));
    g0.fillStyle = g;
    g0.fillRect(0, 0, 1920, 1080);
    halftone(g0, rgba('#5c2048', 0.55), 14, (x, y) => {
      const d = Math.hypot((x - MOON.x) / 1000, (y - MOON.y) / 640);
      return d < 1 ? 0.55 * (1 - d) + 0.08 : 0;
    }, { x: MOON.x - 1000, y: MOON.y - 640, w: 2000, h: 1280 });
    // Long low clouds, darker, across the bottom.
    const r = rng(2020);
    for (let i = 0; i < 5; i++) {
      const y = r.range(820, 1060), x0 = r.range(-200, 900), len = r.range(900, 1500);
      g0.fillStyle = rgba('#0b0306', r.range(0.4, 0.7));
      ribbon(g0, [{ x: x0, y }, { x: x0 + len / 2, y: y - 18 }, { x: x0 + len, y: y + 4 }], (u) => r.range(30, 60) * Math.sin(Math.PI * u) ** 0.5);
    }
  }
  ctx.drawImage(ground, 0, 0, 1920, 1080);
}

let moonSheet: HTMLCanvasElement | null = null;

/** The pale full moon (flat): cream, a little below the paper's white, with soft grey-pink seas and a cel-shaded edge. */
export function moon(ctx: Ctx, alpha = 1) {
  if (alpha <= 0) return;
  if (!moonSheet) {
    const R = MOON.r, S = R * 2 + 8;
    moonSheet = document.createElement('canvas');
    moonSheet.width = S;
    moonSheet.height = S;
    const c = moonSheet.getContext('2d')!;
    c.translate(S / 2, S / 2);
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.fillStyle = '#efe3d8';
    c.fill();
    c.save();
    c.clip();
    // The seas.
    const r = rng(3030);
    // The seas: faint patches strung along one diagonal (never two by two, which would read as a face), and a few
    // small craters.
    for (let i = 0; i < 14; i++) {
      const u = i / 13, cx = lerp(-R * 0.55, R * 0.5, u) + r.range(-30, 30), cy = lerp(-R * 0.35, R * 0.15, u) + 50 * Math.sin(u * 5) + r.range(-25, 25);
      c.fillStyle = rgba('#c8adb8', 0.22);
      c.beginPath();
      c.arc(cx, cy, r.range(18, 46) * (1 - 0.4 * Math.abs(u - 0.4)), 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 6; i++) {
      const cx = r.range(-R * 0.7, R * 0.6), cy = r.range(-R * 0.7, R * 0.6), cr = r.range(5, 14);
      c.beginPath();
      c.arc(cx, cy, cr, 0, Math.PI * 2);
      c.strokeStyle = rgba('#b8949f', 0.35);
      c.lineWidth = 1.5;
      c.stroke();
    }
    // The cel shadow: a crescent on the lower right, in pink dots then solid.
    c.beginPath();
    c.arc(-R * 0.16, -R * 0.16, R * 1.02, 0, Math.PI * 2);
    c.rect(R * 2, -R * 2, -R * 4, R * 4);
    c.fillStyle = '#d9c2c6';
    c.fill('evenodd');
    halftone(c, rgba('#c99aac', 0.6), 9, (x, y) => {
      const d = Math.hypot(x + R * 0.16, y + R * 0.16) / (R * 1.02);
      return clamp((d - 0.78) * 4);
    }, { x: -R, y: -R, w: R * 2, h: R * 2 });
    c.restore();
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.strokeStyle = '#7a4a62';
    c.lineWidth = 3;
    c.stroke();
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(moonSheet, MOON.x - moonSheet.width / 2, MOON.y - moonSheet.height / 2);
  ctx.restore();
}

/** The moon's corona (glow): a soft ring of pink light that brightens as the vortex feeds it. */
export function corona(ctx: Ctx, k: number, t: number) {
  if (k <= 0) return;
  const { x, y, r } = MOON;
  for (const [w, col, al, rr] of [[60, '#ff5f9e', 0.1, 1.15], [16, '#ff8fbd', 0.3, 1.05], [3.5, '#fff1f7', 0.75, 1.015]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r * rr, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(col, al * k * (0.9 + 0.1 * Math.sin(t * 7)));
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

const edgeA = wobble(4141), edgeB = wobble(4343);

/** The night's front edge at height y (its x), for a front at `front`. */
export const frontEdge = (front: number, y: number, t: number) => front + 90 * edgeA(y * 0.006 + t * 0.8) + 45 * edgeB(y * 0.017 - t);

/** Clips to the night's side of the front (left of it). */
export function clipNight(ctx: Ctx, front: number, t: number) {
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  for (let y = -10; y <= 1090; y += 20) ctx.lineTo(frontEdge(front, y, t), y);
  ctx.lineTo(-10, 1090);
  ctx.closePath();
  ctx.clip();
}

/** Dots of plum-black ahead of the front, soaking into the paper (flat). */
export function frontDots(ctx: Ctx, front: number, t: number) {
  halftone(ctx, SAKURA.night, 18, (x, y) => {
    const d = x - frontEdge(front, y, t);
    return 1 - d / 150;
  }, { x: front - 160, y: 0, w: 320, h: 1080 });
}

/** The blade's body of light (glow): a long curved tapered blade, pink haze round a white-hot core. */
export function bladeBody(ctx: Ctx, b: BladePose, k: number, t: number) {
  if (k <= 0) return;
  const pts: Pt[] = [], half: number[] = [];
  const reach = clamp(k * 1.3);
  for (let i = 0; i <= 60; i++) {
    const q = bladeAt(b, (i / 60) * reach);
    pts.push(q.p);
    half.push(q.half);
  }
  const hw = (u: number) => half[Math.round(u * 60)];
  const pulse = 0.92 + 0.08 * Math.sin(t * 23);
  // Soft haze in tapering layers (one wide flat band would read as a slab).
  for (const [m, al] of [[3.2, 0.08], [2.4, 0.12], [1.7, 0.2]] as const) {
    ctx.fillStyle = rgba('#ff4f93', al * k);
    ribbon(ctx, pts, (u) => hw(u) * m * Math.min(1, u * 12));
  }
  ctx.fillStyle = rgba('#ff86b6', 0.7 * k);
  ribbon(ctx, pts, (u) => hw(u) * 1.25);
  ctx.fillStyle = rgba('#ffd6e6', 0.95 * k);
  ribbon(ctx, pts, (u) => hw(u) * 0.7 * pulse);
  ctx.fillStyle = rgba('#ffffff', k);
  // The edge: the white-hot line on the blade's cutting side.
  ribbon(ctx, pts.map((p, i) => {
    const q = bladeAt(b, (i / 60) * reach);
    return { x: p.x - q.n.x * half[i] * 0.45, y: p.y - q.n.y * half[i] * 0.45 };
  }), (u) => hw(u) * 0.22);
}

/** The hilt and the guard: a plum-black grip wrapped in pink, and a cherry blossom for a guard (glow, opaque). */
export function bladeHilt(ctx: Ctx, b: BladePose, k: number) {
  if (k <= 0) return;
  const ax = Math.cos(b.angle), ay = Math.sin(b.angle);
  ctx.save();
  ctx.globalAlpha = clamp(k);
  const end = { x: b.g.x - ax * 230, y: b.g.y - ay * 230 };
  ctx.fillStyle = '#ffb3cf';
  ribbon(ctx, [end, b.g], () => 40);
  ctx.fillStyle = '#26091a';
  ribbon(ctx, [end, b.g], () => 32);
  // The wrap: pink diamonds along the grip.
  ctx.fillStyle = '#ff9cc4';
  for (let i = 1; i < 7; i++) {
    const c = { x: lerp(end.x, b.g.x, i / 7), y: lerp(end.y, b.g.y, i / 7) };
    ctx.beginPath();
    ctx.moveTo(c.x + ax * 13, c.y + ay * 13);
    ctx.lineTo(c.x - ay * 12, c.y + ax * 12);
    ctx.lineTo(c.x - ax * 13, c.y - ay * 13);
    ctx.lineTo(c.x + ay * 12, c.y - ax * 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // The guard: a full cherry blossom, face on.
  ctx.save();
  ctx.globalAlpha = clamp(k);
  flower(ctx, { x: b.g.x, y: b.g.y, r: 74, rot: b.angle + 0.3, tilt: 0.5, tiltAt: b.angle, open: 1 });
  ctx.restore();
}

/**
 * The swing's smear (glow): thin arcs of pink light fanned out behind the blade between its old angle and its new one,
 * brighter and longer towards the tip, each tapering away behind (anime smear lines, not a flat wedge).
 */
export function swingTrail(ctx: Ctx, b: BladePose, from: number, k: number) {
  if (k <= 0) return;
  const span = b.angle - from;
  const r = rng(6464);
  // The soft body of the smear over the outer half of the blade, fading away behind it.
  const reach = Math.sign(span || -1) * Math.max(Math.abs(span) * 1.3, 0.5) * 0.8 * k;
  const n = 24;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = b.angle - reach * (1 - i / n);
    ctx.lineTo(b.g.x + Math.cos(a) * b.len * 1.0, b.g.y + Math.sin(a) * b.len * 1.0);
  }
  for (let i = n; i >= 0; i--) {
    const a = b.angle - reach * (1 - i / n) * 0.7;
    ctx.lineTo(b.g.x + Math.cos(a) * b.len * 0.5, b.g.y + Math.sin(a) * b.len * 0.5);
  }
  ctx.closePath();
  const ta = b.angle - reach, ux = Math.cos(b.angle) * b.len * 0.85, tx = Math.cos(ta) * b.len * 0.85;
  const g = ctx.createLinearGradient(b.g.x + tx, b.g.y + Math.sin(ta) * b.len * 0.85, b.g.x + ux, b.g.y + Math.sin(b.angle) * b.len * 0.85);
  g.addColorStop(0, rgba('#ff4f93', 0));
  g.addColorStop(1, rgba('#ff86b6', 0.32 * k));
  ctx.fillStyle = g;
  ctx.fill();
  for (let i = 0; i < 18; i++) {
    const u = Math.sqrt(i / 17), rad = b.len * lerp(0.35, 1.02, u) + r.range(-12, 12);
    // Exaggerated: the smear reaches further back than the blade has actually gone.
    const back = Math.sign(span || -1) * Math.max(Math.abs(span) * 1.3, 0.5) * lerp(0.45, 1, u) * r.range(0.75, 1.05) * k;
    const pts: Pt[] = [];
    for (let j = 0; j <= 24; j++) {
      const a = b.angle - back * (1 - j / 24);
      pts.push({ x: b.g.x + Math.cos(a) * rad, y: b.g.y + Math.sin(a) * rad });
    }
    ctx.fillStyle = rgba(r.next() < 0.3 ? '#ffffff' : r.next() < 0.6 ? '#ffb3cf' : SAKURA.glow, lerp(0.25, 0.8, u) * k);
    const w = r.range(2, 6) * lerp(0.6, 1.4, u);
    ribbon(ctx, pts, (v) => w * v ** 1.2);
  }
}

/** The slash: a streak of white-pink light across the whole frame along the cut (glow). */
export function slash(ctx: Ctx, c: Pt, angle: number, k: number, fade: number, width = 1) {
  if (k <= 0 || fade >= 1) return;
  const ax = Math.cos(angle), ay = Math.sin(angle);
  const to = lerp(-1500, 1500, clamp(k)), from = Math.max(-1500, to - 2200);
  const pts: Pt[] = [];
  for (let i = 0; i <= 30; i++) {
    const d = lerp(from, to, i / 30);
    pts.push({ x: c.x + ax * d, y: c.y + ay * d });
  }
  const a = 1 - clamp(fade);
  const w = (u: number) => Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)) ** 0.5 * width;
  ctx.fillStyle = rgba('#ff3f88', 0.45 * a);
  ribbon(ctx, pts, (u) => 90 * w(u));
  ctx.fillStyle = rgba('#ffa6c8', 0.9 * a);
  ribbon(ctx, pts, (u) => 36 * w(u));
  ctx.fillStyle = rgba('#ffffff', a);
  ribbon(ctx, pts, (u) => 12 * w(u));
}

/** A thin glowing line along the cut (glow). */
export function cutGlow(ctx: Ctx, c: Pt, angle: number, k: number, width = 1) {
  if (k <= 0) return;
  const ax = Math.cos(angle), ay = Math.sin(angle);
  for (const [w, col, al] of [[26, '#e02f74', 0.35], [8, '#ff7fb2', 0.9], [2.5, '#fff1f7', 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(c.x - ax * 1600, c.y - ay * 1600);
    ctx.lineTo(c.x + ax * 1600, c.y + ay * 1600);
    ctx.strokeStyle = rgba(col, al * k);
    ctx.lineWidth = w * width;
    ctx.stroke();
  }
}

const reachA = wobble(5858), reachB = wobble(5959);

/** The paper coming back over the night outward from the cut line, as dots that grow until they meet (flat). */
export function paperFromCut(ctx: Ctx, c: Pt, angle: number, p: number, image: (ctx: Ctx) => void) {
  if (p <= 0) return;
  const nx = -Math.sin(angle), ny = Math.cos(angle);
  ctx.save();
  ctx.beginPath();
  const cell = 22;
  for (let y = cell / 2; y < 1080 + cell; y += cell) {
    const odd = Math.round(y / cell) % 2;
    for (let x = odd ? cell : cell / 2; x < 1920 + cell; x += cell) {
      const d = Math.abs((x - c.x) * nx + (y - c.y) * ny) / 760 + 0.08 * reachA(x * 0.004) + 0.06 * reachB(x * 0.011 + y * 0.007);
      const s = clamp((p * 1.8 - d) * 3.5);
      if (s < 0.04) continue;
      const r = cell * 0.75 * s;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.clip();
  image(ctx);
  ctx.restore();
}

/** A drift of fallen petals' pink shadow along the bottom of the paper (flat), growing over `k`. */
export function groundWash(ctx: Ctx, k: number) {
  if (k <= 0) return;
  halftone(ctx, rgba('#f0a0bd', 0.5 * k), 12, (x, y) => {
    const h = 1000 + 30 * Math.sin(x * 0.004) + 18 * Math.sin(x * 0.013 + 1);
    return clamp((y - h) / 60) * 0.8;
  }, { x: 0, y: 940, w: 1920, h: 140 });
}
