import { H, W, clamp, rng, rgba, type Ctx } from '../core';

/**
 * The paper side of the clip: the off-white sheet with its fine dot screen, ink strokes, halftone, the title card and
 * the red seal. Japanese text uses the fonts the device has (Yu Mincho on Windows, Hiragino on an iPhone).
 */

export const PAPER = '#ebe8e2';
export const INK = '#151012';
export const RED = '#d0242b';
export const SERIF = '"Noto Serif JP","Yu Mincho","Hiragino Mincho ProN","MS PMincho",serif';

let sheet: HTMLCanvasElement | null = null;

/** The sheet: a soft light in the middle and a fine dot screen, made once. */
function paperSheet() {
  if (sheet) return sheet;
  sheet = document.createElement('canvas');
  sheet.width = W;
  sheet.height = H;
  const c = sheet.getContext('2d')!;
  c.fillStyle = PAPER;
  c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W * 0.5, H * 0.45, 100, W * 0.5, H * 0.5, W * 0.7);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(190,185,175,0.35)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(150,140,130,0.16)';
  for (let y = 3; y < H; y += 7) for (let x = (y / 7) % 2 ? 3 : 6.5; x < W; x += 7) c.fillRect(x, y, 1.6, 1.6);
  return sheet;
}

export function paper(ctx: Ctx, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(paperSheet(), 0, 0, W, H);
  ctx.restore();
}

/**
 * Halftone dots over a region: each dot's size is `size(x, y)` (0 to 1 of the cell), so a soft shape becomes dots that
 * shrink towards its edge.
 */
export function halftone(ctx: Ctx, color: string, cell: number, size: (x: number, y: number) => number, box = { x: 0, y: 0, w: W, h: H }) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let y = box.y + cell / 2; y < box.y + box.h; y += cell) {
    const odd = Math.round((y - box.y) / cell) % 2;
    for (let x = box.x + cell / 2 + (odd ? cell / 2 : 0); x < box.x + box.w; x += cell) {
      const s = clamp(size(x, y));
      if (s < 0.04) continue;
      const r = (cell / 2) * s * 1.15;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

/** A brush stroke along an arc: thick in the middle, thin at both ends, drawn on up to `k` (0 to 1). */
export function brushArc(ctx: Ctx, cx: number, cy: number, r: number, a0: number, a1: number, width: number, k: number, color: string) {
  if (k <= 0) return;
  const n = 28, end = a0 + (a1 - a0) * clamp(k);
  const outer: [number, number][] = [], inner: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = a0 + (end - a0) * u;
    const ww = Math.max(0.6, width * (0.2 + 0.8 * Math.sin(Math.PI * u)) ** 0.8);
    outer.push([cx + Math.cos(a) * (r + ww / 2), cy + Math.sin(a) * (r + ww / 2)]);
    inner.push([cx + Math.cos(a) * (r - ww / 2), cy + Math.sin(a) * (r - ww / 2)]);
  }
  ctx.beginPath();
  ctx.moveTo(outer[0][0], outer[0][1]);
  for (const p of outer) ctx.lineTo(p[0], p[1]);
  for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Ink specks: small round drops scattered from a seed. */
export function specks(ctx: Ctx, seed: number, count: number, alpha: number, box = { x: 0, y: 0, w: W, h: H }, colors = [INK, RED, '#9a9590']) {
  if (alpha <= 0) return;
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = box.x + r.next() * box.w, y = box.y + r.next() * box.h;
    const s = r.next() < 0.85 ? r.range(1.5, 4.5) : r.range(6, 14);
    ctx.fillStyle = rgba(r.pick(colors), alpha * r.range(0.5, 1));
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The title card, top left. `k` 0 to 1 fades it; `dark` draws it for a dark background. */
export function titleCard(ctx: Ctx, k: number, dark: boolean) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.textBaseline = 'alphabetic';
  // The name in kanji: white, outlined in ink, with a hard offset shadow.
  ctx.font = `900 74px ${SERIF}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText('緋鞘', 50, 110);
  ctx.strokeText('緋鞘', 44, 104);
  ctx.fillStyle = '#fbf7ef';
  ctx.fillText('緋鞘', 44, 104);
  // The name in English.
  ctx.font = `800 26px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#e9dccb' : '#3a2416';
  ctx.fillText('SCARLET SHEATH', 46, 156);
  // The move's name on a black brush band.
  ctx.fillStyle = '#0d0a0b';
  ctx.beginPath();
  ctx.moveTo(34, 176);
  ctx.lineTo(474, 172);
  ctx.lineTo(478, 186); ctx.lineTo(470, 190); ctx.lineTo(482, 240); ctx.lineTo(474, 268);
  ctx.lineTo(40, 272);
  ctx.lineTo(30, 252); ctx.lineTo(38, 236); ctx.lineTo(28, 200);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, 196, 0, 256);
  g.addColorStop(0, '#ffd27a');
  g.addColorStop(0.45, '#ff7a2a');
  g.addColorStop(1, '#d92418');
  ctx.font = `900 58px ${SERIF}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#2a0805';
  ctx.strokeText('一閃・斷界', 64, 245);
  ctx.fillStyle = g;
  ctx.fillText('一閃・斷界', 64, 245);
  // Four small squares after the band, the first red.
  ['#e0412e', '#8c8a92', '#8c8a92', '#8c8a92'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(486 + i * 15, 268, 9, 9);
  });
  ctx.font = `700 17px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#9d8f86' : '#57514c';
  ctx.fillText('ISSEN · WORLD SEVER', 48, 306);
  ctx.restore();
}

/** The red seal with the character 斷 carved out in white, stamped in over `k` (0 to 1). */
export function seal(ctx: Ctx, x: number, y: number, size: number, k: number) {
  if (k <= 0) return;
  const r = rng(91);
  const s = 1 + (1 - Math.min(1, k * 1.6)) ** 2 * 0.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.04);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp(k * 3);
  // A square with a rough, chewed edge.
  ctx.beginPath();
  const h = size / 2;
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, j = r.range(-3.5, 3.5);
      const px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
      const nx = ay === by ? 0 : 1, ny = ay === by ? 1 : 0;
      ctx.lineTo(px + nx * j, py + ny * j);
    }
  };
  ctx.moveTo(-h, -h);
  edge(-h, -h, h, -h); edge(h, -h, h, h); edge(h, h, -h, h); edge(-h, h, -h, -h);
  ctx.closePath();
  ctx.fillStyle = '#c51f26';
  ctx.fill();
  // The carved character.
  ctx.fillStyle = '#f6efe6';
  ctx.font = `900 ${Math.round(size * 0.86)}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('斷', 0, size * 0.04);
  // Worn spots in the ink.
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = r.next() < 0.6 ? 'rgba(197,31,38,0.9)' : 'rgba(246,239,230,0.75)';
    ctx.beginPath();
    ctx.arc(r.range(-h, h), r.range(-h, h), r.range(1, 3.2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Splashes thrown out as it lands.
  const sp = rng(17);
  for (let i = 0; i < 16; i++) {
    const a = sp.range(0, Math.PI * 2), d = size * sp.range(0.62, 1.1) * clamp(k * 1.4);
    ctx.fillStyle = rgba(RED, clamp(k * 2) * sp.range(0.6, 1));
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, sp.range(2, i < 3 ? 8 : 5), 0, Math.PI * 2);
    ctx.fill();
  }
}
