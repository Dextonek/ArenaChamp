import { H, W, clamp, lerp, rgba, rng, type Ctx, type Pt } from '../../core';
import { curlSpine, edgePath, ribbonEdges } from './common';

/**
 * The dark side of the phoenix: the black ground with its warm dot screen and rising-sun rays, embers rising, the column
 * of fire the bird rises out of, the halo and shock ring of its cry, and the sun it becomes.
 */

let ground: HTMLCanvasElement | null = null;

/** The black ground: near black, a warm low light in the middle, a fine dark-red dot screen (made once). */
function groundSheet() {
  if (ground) return ground;
  ground = document.createElement('canvas');
  ground.width = W;
  ground.height = H;
  const c = ground.getContext('2d')!;
  c.fillStyle = '#0b0705';
  c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(960, 560, 50, 960, 560, 1100);
  g.addColorStop(0, '#2c120a');
  g.addColorStop(0.55, '#140a07');
  g.addColorStop(1, '#090605');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(120,40,20,0.22)';
  for (let y = 4; y < H; y += 9) for (let x = (y / 9) % 2 ? 4 : 8.5; x < W; x += 9) c.fillRect(x, y, 2.2, 2.2);
  return ground;
}

export function darkGround(ctx: Ctx) {
  ctx.drawImage(groundSheet(), 0, 0, W, H);
}

/** Rising-sun rays behind the bird (flat): wedges a shade lighter than the ground, turning slowly. */
export function sunRays(ctx: Ctx, c: Pt, k: number, t: number, color = '#3a170b') {
  if (k <= 0) return;
  const n = 18, rot = t * 0.05;
  ctx.fillStyle = rgba(color, 0.55 * k);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * Math.PI * 2, a1 = a0 + (Math.PI / n) * 0.9;
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(a0) * 2400, c.y + Math.sin(a0) * 2400);
    ctx.lineTo(c.x + Math.cos(a1) * 2400, c.y + Math.sin(a1) * 2400);
    ctx.closePath();
  }
  ctx.fill();
}

/** Embers rising through the frame (glow), looping; `k` their strength. */
export function risingEmbers(ctx: Ctx, t: number, k: number, seed = 77, count = 90, speed = 1) {
  if (k <= 0) return;
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x0 = r.range(-40, 1960), sp = r.range(90, 260) * speed, off = r.range(0, 1300), sw = r.range(10, 50), ph = r.range(0, 6.28);
    const size = r.next() < 0.85 ? r.range(1.5, 3.5) : r.range(4, 6.5);
    const y = 1160 - ((t * sp + off) % 1300);
    const x = x0 + Math.sin(t * 1.7 + ph) * sw;
    const life = clamp((1160 - y) / 300) * clamp(y / 200);
    const flick = 0.6 + 0.4 * Math.sin(t * 9 + ph * 3);
    ctx.fillStyle = rgba(r.next() < 0.6 ? '#ffb347' : '#ff6a1e', k * life * flick);
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 1.8, Math.sin(t + ph) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The column of fire out of the heap (glow): tall flame tongues, tallest in the middle, `h` their height (0 to 1),
 * `k` their strength.
 */
export function fireColumn(ctx: Ctx, base: Pt, t: number, h: number, k: number, width = 1) {
  if (k <= 0 || h <= 0) return;
  const r = rng(2525);
  const tongues = Array.from({ length: 16 }, (_, i) => {
    const off = r.range(-1, 1);
    return { off, len: r.range(0.55, 1) * (1 - 0.45 * Math.abs(off)), w: r.range(50, 110), ph: r.range(0, 6.28), sp: r.range(5, 9), i };
  }).sort((a, b) => Math.abs(b.off) - Math.abs(a.off));
  for (const [color, wk, ak] of [['#b8280a', 1, 0.45], ['#ff6a1a', 0.6, 0.6], ['#ffb43a', 0.3, 0.6], ['#fff3d0', 0.1, 0.55]] as const) {
    ctx.fillStyle = rgba(color, ak * k);
    for (const q of tongues) {
      const len = 1200 * h * q.len;
      const ph = t * q.sp + q.ph;
      const start = { x: base.x + q.off * 170 * width, y: base.y + 20 };
      const sp = curlSpine(start, -Math.PI / 2 - q.off * 0.12, len, 0, 16, (u) => 0.22 * Math.sin(u * 6 - ph) * u);
      const n = sp.length - 1;
      const e = ribbonEdges(sp, (j) => q.w * width * wk * (1 - j / n) ** 0.85 * (0.85 + 0.15 * Math.sin(ph + j)));
      edgePath(ctx, e.left, e.right);
      ctx.fill();
    }
  }
}

/** The halo behind the crying bird (glow): a double ring of gold, drawn round over `k`. */
export function halo(ctx: Ctx, c: Pt, R: number, k: number, t: number) {
  if (k <= 0) return;
  const end = -Math.PI / 2 + Math.PI * 2 * clamp(k * 1.2);
  ctx.lineCap = 'round';
  for (const [rr, w, color, a] of [[1, 16, '#ff7a1e', 0.35], [1, 6, '#ffc84a', 0.85], [1, 2, '#fff4d8', 0.9], [0.9, 3, '#ffb040', 0.5]] as const) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, R * rr, -Math.PI / 2, end);
    ctx.strokeStyle = rgba(color, a * clamp(k * 2));
    ctx.lineWidth = w;
    ctx.stroke();
  }
  // Small flames standing on the ring, flickering.
  const r = rng(1919);
  for (let i = 0; i < 28; i++) {
    const a = -Math.PI / 2 + (i / 28) * Math.PI * 2;
    if (a > end) continue;
    const fl = 0.6 + 0.4 * Math.sin(t * 11 + i * 2.1);
    const len = r.range(18, 40) * fl;
    const p = { x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R };
    const sp = curlSpine(p, a, len, 0.4 * Math.sin(t * 5 + i), 6);
    const e = ribbonEdges(sp, (j) => 6 * (1 - j / 6));
    edgePath(ctx, e.left, e.right);
    ctx.fillStyle = rgba('#ffb040', 0.75 * clamp(k * 2));
    ctx.fill();
  }
}

/** A ring of light opening out from the cry (glow): `k` 0 to 1 over its life. */
export function shockRing(ctx: Ctx, c: Pt, k: number, reach = 1300) {
  if (k <= 0 || k >= 1) return;
  const R = lerp(120, reach, Math.sqrt(k));
  const a = (1 - k) ** 1.5;
  for (const [w, color, al] of [[60 * (1 - k) + 6, '#ff7a1e', 0.35], [14 * (1 - k) + 2, '#ffe2a0', 0.9]] as const) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R, R * 0.82, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(color, al * a);
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

/** The sun (glow): a white-hot disc, gold rims, long turning rays and a level streak; `R` its size, `k` its strength. */
export function sunBurst(ctx: Ctx, c: Pt, R: number, k: number, t: number) {
  if (k <= 0) return;
  // Rays first, behind the disc.
  const r = rng(6060);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + t * 0.6 + r.range(-0.08, 0.08);
    const len = R * r.range(1.6, 3.2), w = R * r.range(0.04, 0.09);
    ctx.fillStyle = rgba(i % 2 ? '#ffd27a' : '#fff4dc', 0.75 * k);
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(a + Math.PI / 2) * w, c.y + Math.sin(a + Math.PI / 2) * w);
    ctx.lineTo(c.x + Math.cos(a) * len, c.y + Math.sin(a) * len);
    ctx.lineTo(c.x + Math.cos(a - Math.PI / 2) * w, c.y + Math.sin(a - Math.PI / 2) * w);
    ctx.closePath();
    ctx.fill();
  }
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R * 1.5);
  g.addColorStop(0, rgba('#ffffff', k));
  g.addColorStop(0.6, rgba('#fff4d8', k));
  g.addColorStop(0.67, rgba('#ffc24a', 0.95 * k));
  g.addColorStop(0.75, rgba('#ff6a1a', 0.5 * k));
  g.addColorStop(1, rgba('#ff4a10', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, R * 1.5, 0, Math.PI * 2);
  ctx.fill();
  // A level streak across the frame, as through a lens.
  const sg = ctx.createLinearGradient(0, 0, W, 0);
  sg.addColorStop(0, rgba('#ffb040', 0));
  sg.addColorStop(0.5, rgba('#fff4dc', 0.9 * k));
  sg.addColorStop(1, rgba('#ffb040', 0));
  ctx.fillStyle = sg;
  ctx.fillRect(0, c.y - 5 - R * 0.02, W, 10 + R * 0.04);
}

/** Lines rushing in towards a centre (glow): the dive. */
export function rushLines(ctx: Ctx, c: Pt, t: number, k: number, color = '#fff4dc') {
  if (k <= 0) return;
  const slot = Math.floor(t * 30);
  for (let i = 0; i < 70; i++) {
    const r = rng(i * 53 + slot * 977);
    if (r.next() > 0.55) continue;
    const a = r.range(0, Math.PI * 2), r0 = r.range(330, 600), r1 = r0 + r.range(400, 1100);
    const pts = Array.from({ length: 9 }, (_, j) => {
      const d = r0 + ((r1 - r0) * j) / 8;
      return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.8 };
    });
    ctx.fillStyle = rgba(r.next() < 0.7 ? color : '#ffb040', 0.85 * k);
    const e = ribbonEdges(pts, (j) => r.range(1.5, 4.5) * Math.sin((Math.PI * j) / 8));
    edgePath(ctx, e.left, e.right);
    ctx.fill();
  }
}

/** Ink lines rushing out from a centre (flat): the impact frame on paper. */
export function inkLines(ctx: Ctx, c: Pt, t: number, color: string) {
  const slot = Math.floor(t * 30);
  ctx.fillStyle = color;
  for (let i = 0; i < 80; i++) {
    const r = rng(i * 71 + slot * 131);
    const a = r.range(0, Math.PI * 2), r0 = r.range(420, 640), r1 = r0 + r.range(500, 1200);
    const pts = Array.from({ length: 9 }, (_, j) => {
      const d = r0 + ((r1 - r0) * j) / 8;
      return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d };
    });
    const e = ribbonEdges(pts, (j) => r.range(2, 7) * Math.sin((Math.PI * j) / 8));
    edgePath(ctx, e.left, e.right);
    ctx.fill();
  }
}
