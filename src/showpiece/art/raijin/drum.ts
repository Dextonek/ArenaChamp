import { clamp, lerp, ribbon, rng, rgba, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';

/**
 * Raijin's war drum, drawn flat with a heavy outline like the katana: a cream hide with a ring of gold studs and the
 * three-comma tomoe painted on it, an indigo lacquered barrel seen a little from the side with a gold ring handle, and the
 * drumstick (bachi). Also the paper-side ink: the brush ring behind the drum, the ink wheeling in, the shock rings of a
 * strike and the hum of the drum afterwards.
 *
 * The drum's own frame is 100 units to the face's radius; `R` scales it.
 */

export const OUT = '#100c22';
export const GOLD = ['#6e4a0e', '#d9a12c', '#ffe7a0', '#a87a1e'] as const;
export const NIGHT = { deep: '#07061a', night: '#141045', mid: '#262068', lit: '#3d3594', pale: '#8f86e0' };
const SKIN = { light: '#f3e8cc', shadow: '#d6c398', rim: '#b8a074' };
export const TOMOE_INK = '#1f1a56';

/** The three commas of a mitsudomoe in a unit circle, as polygons. `rot` turns them (radians); tails trail behind. */
export function tomoeCommas(rot: number, n = 36, rh = 0.32): Pt[][] {
  const c = 1 - rh, span = 1.9;
  const out: Pt[][] = [];
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * Math.PI * 2) / 3;
    const pts: Pt[] = [];
    for (let j = 0; j <= n; j++) {
      const th = a - (j / n) * span;
      pts.push({ x: Math.cos(th), y: Math.sin(th) });
    }
    for (let j = n; j >= 0; j--) {
      const s = j / n, th = a - s * span;
      const rr = 1 - 2 * rh * Math.max(0, 1 - s ** 1.4) ** 1.8;
      pts.push({ x: Math.cos(th) * rr, y: Math.sin(th) * rr });
    }
    const cx = Math.cos(a) * c, cy = Math.sin(a) * c;
    for (let j = 1; j < n; j++) {
      const ph = a + Math.PI - Math.PI * (j / n);
      pts.push({ x: cx + Math.cos(ph) * rh, y: cy + Math.sin(ph) * rh });
    }
    out.push(pts);
  }
  return out;
}

/** The centre line of one comma (head to tail tip), in the unit circle: for a hot spine along it. */
export function commaSpine(rot: number, i: number, n = 24, rh = 0.32): Pt[] {
  const span = 1.9, a = rot + (i * Math.PI * 2) / 3;
  const pts: Pt[] = [];
  for (let j = 0; j <= n; j++) {
    const s = j / n, th = a - s * span;
    const w = 2 * rh * Math.max(0, 1 - s ** 1.4) ** 1.8;
    const rr = 1 - w / 2;
    pts.push({ x: Math.cos(th) * rr, y: Math.sin(th) * rr });
  }
  return pts;
}

/** A polygon in unit coordinates as a path, at centre (x, y) and radius r, squeezed across by `sx`. */
export function unitPath(ctx: Ctx, pts: Pt[], x: number, y: number, r: number, sx = 1) {
  ctx.beginPath();
  ctx.moveTo(x + pts[0].x * r * sx, y + pts[0].y * r);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(x + pts[i].x * r * sx, y + pts[i].y * r);
  ctx.closePath();
}

const FACE_RX = 86, DEPTH = 56;

function facePath(ctx: Ctx, grow = 0) {
  ctx.beginPath();
  ctx.ellipse(0, 0, FACE_RX + grow, 100 + grow, 0, 0, Math.PI * 2);
}

function barrelPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -100);
  ctx.quadraticCurveTo(DEPTH * 0.5, -118, DEPTH, -97);
  ctx.ellipse(DEPTH, 0, FACE_RX * 0.97, 97, 0, -Math.PI / 2, Math.PI / 2, false);
  ctx.quadraticCurveTo(DEPTH * 0.5, 118, 0, 100);
  ctx.closePath();
}

function stud(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = GOLD[1];
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = GOLD[2];
  ctx.fill();
}

export interface DrumLook {
  /** The tomoe's turn on the face (radians). */
  tomoe?: number;
  /** 0 on paper, 1 deep in the night: the drum is cooled and darkened to sit in the storm. */
  night?: number;
  /** A squash as the stick lands (0 to 1). */
  hit?: number;
  /** Plain: a small drum of the ring (no handle, fewer studs). */
  small?: boolean;
}

/** The drum at (x, y), its face `R` across the middle (flat layer). */
export function drum(ctx: Ctx, x: number, y: number, R: number, look: DrumLook = {}) {
  const night = look.night ?? 0, hit = look.hit ?? 0, small = !!look.small;
  const s = R / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (1 + 0.035 * hit), s * (1 - 0.05 * hit));
  ctx.lineJoin = 'round';
  // The barrel: indigo lacquer in hard cel bands, a gold rim of studs at its back.
  barrelPath(ctx);
  const g = ctx.createLinearGradient(FACE_RX * 0.9, 0, DEPTH + FACE_RX, 0);
  for (const [k, c] of [[0, '#2a236e'], [0.28, '#2a236e'], [0.28, '#4a40a8'], [0.46, '#4a40a8'], [0.46, '#221c5c'], [0.8, '#221c5c'], [0.8, '#130f3a'], [1, '#130f3a']] as const) g.addColorStop(k, c);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  if (night > 0) {
    ctx.fillStyle = rgba('#0c0a2e', 0.4 * night);
    ctx.fill();
  }
  // Gold bands round the barrel near each rim.
  ctx.save();
  barrelPath(ctx);
  ctx.clip();
  for (const off of [14, DEPTH - 8]) {
    ctx.beginPath();
    ctx.ellipse(off, 0, FACE_RX * 0.99, 104, 0, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = GOLD[1];
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }
  ctx.restore();
  if (!small) {
    for (let i = 0; i < 9; i++) {
      const ph = lerp(-1.25, 1.25, i / 8);
      stud(ctx, DEPTH + FACE_RX * 0.97 * Math.cos(ph) - 5, 92 * Math.sin(ph), 3.2);
    }
    // The ring handle on the barrel's side.
    const hx = FACE_RX + 24, hy = -4;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 10); ctx.lineTo(hx + 7, hy); ctx.lineTo(hx, hy + 10); ctx.lineTo(hx - 7, hy); ctx.closePath();
    ctx.fillStyle = GOLD[1];
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(hx + 2, hy + 20, 8, 17, 0.12, 0, Math.PI * 2);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = GOLD[1];
    ctx.lineWidth = 3.4;
    ctx.stroke();
  }
  // The hide: cream, a cel shadow along its lower right with halftone, the lapped edge, the studs.
  facePath(ctx, 2);
  ctx.fillStyle = OUT;
  ctx.fill();
  ctx.save();
  facePath(ctx);
  ctx.clip();
  ctx.fillStyle = SKIN.shadow;
  ctx.fillRect(-120, -120, 240, 240);
  ctx.beginPath();
  ctx.ellipse(-9, -11, FACE_RX * 0.97, 97, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN.light;
  ctx.fill();
  const cell = Math.max(5, 9 / s);
  halftone(ctx, rgba('#a48a5c', 0.55), cell, (px, py) => {
    const e = Math.hypot((px + 9) / (FACE_RX * 0.97), (py + 11) / 97);
    return (e - 0.8) * 3.2;
  }, { x: -100, y: -110, w: 200, h: 220 });
  ctx.restore();
  // The tomoe, painted.
  const commas = tomoeCommas(look.tomoe ?? -0.6);
  for (const c of commas) {
    unitPath(ctx, c, 0, 0, 56, FACE_RX / 100);
    ctx.fillStyle = TOMOE_INK;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
  // The hide lapped over the rim, then the studs.
  facePath(ctx, -6);
  ctx.lineWidth = 11;
  ctx.strokeStyle = SKIN.rim;
  ctx.stroke();
  facePath(ctx, -12);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = rgba(OUT, 0.6);
  ctx.stroke();
  const n = small ? 14 : 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    stud(ctx, Math.cos(a) * (FACE_RX - 6), Math.sin(a) * 94, small ? 4.6 : 3.6);
  }
  facePath(ctx);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // Cooled for the night: an indigo veil over the drum, lighter on the face.
  if (night > 0) {
    facePath(ctx, 2);
    ctx.fillStyle = rgba('#1c1660', 0.16 * night);
    ctx.fill();
  }
  ctx.restore();
}

/** The drum's light (glow layer): its studs and tomoe edges lit gold, `k` 0 to 1; `hot` fills the tomoe with light. */
export function drumGlow(ctx: Ctx, x: number, y: number, R: number, k: number, t: number, look: DrumLook = {}, hot = 0) {
  if (k <= 0) return;
  const s = R / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const n = look.small ? 14 : 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const flick = 0.6 + 0.4 * Math.sin(t * 13 + i * 2.3);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (FACE_RX - 6), Math.sin(a) * 94, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#ffd860', k * flick);
    ctx.fill();
  }
  ctx.lineJoin = 'round';
  for (const c of tomoeCommas(look.tomoe ?? -0.6)) {
    unitPath(ctx, c, 0, 0, 56, FACE_RX / 100);
    if (hot > 0) {
      ctx.fillStyle = rgba('#b89cff', 0.55 * hot * k);
      ctx.fill();
    }
    ctx.strokeStyle = rgba('#ffcf4a', 0.9 * k);
    ctx.lineWidth = 3 / Math.max(0.4, s);
    ctx.stroke();
  }
  ctx.restore();
}

/** The drumstick: a tapered lacquered rod from its grip at `g` towards `angle`, `len` long (flat layer). */
export function bachi(ctx: Ctx, g: Pt, angle: number, len: number) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(angle);
  ctx.lineJoin = 'round';
  const w0 = 36, w1 = 26;
  const rod = () => {
    ctx.beginPath();
    ctx.moveTo(0, -w0 / 2);
    ctx.lineTo(len - w1 / 2, -w1 / 2);
    ctx.arc(len - w1 / 2, 0, w1 / 2, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(0, w0 / 2);
    ctx.closePath();
  };
  rod();
  const gr = ctx.createLinearGradient(0, -w0 / 2, 0, w0 / 2);
  for (const [k, c] of [[0, '#3a2414'], [0.2, '#3a2414'], [0.2, '#8a5a32'], [0.38, '#8a5a32'], [0.38, '#5a361c'], [1, '#2a170c']] as const) gr.addColorStop(k, c);
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // Gold ferrules and an indigo wrap at the grip.
  ctx.save();
  rod();
  ctx.clip();
  ctx.fillStyle = '#231c5e';
  ctx.fillRect(0, -30, 150, 60);
  ctx.strokeStyle = rgba('#6a5ec8', 0.7);
  ctx.lineWidth = 3;
  for (let x = 10; x < 150; x += 16) {
    ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + 12, 20); ctx.stroke();
  }
  for (const x of [150, 162, len - 70]) {
    ctx.fillStyle = OUT;
    ctx.fillRect(x - 2, -30, 14, 60);
    ctx.fillStyle = GOLD[1];
    ctx.fillRect(x, -30, 10, 60);
    ctx.fillStyle = GOLD[2];
    ctx.fillRect(x + 2, -30, 3, 60);
  }
  ctx.restore();
  rod();
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  // A violet cord from the end.
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.quadraticCurveTo(-40, 30, -60, 90);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#6a48d8';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

/** A thick brush ring painted round (cx, cy) clockwise from the top, drawn on up to `k` (flat layer, on paper). */
export function brushRing(ctx: Ctx, cx: number, cy: number, r: number, k: number, width: number, color: string, seed = 3) {
  if (k <= 0) return;
  const a0 = -Math.PI / 2 - 0.3, a1 = a0 + Math.PI * 2 * 0.94 * clamp(k);
  const pts: Pt[] = [];
  for (let i = 0; i <= 90; i++) {
    const a = lerp(a0, a1, i / 90);
    const w = 1 + 0.015 * Math.sin(a * 3 + seed) + 0.008 * Math.sin(a * 9 + seed * 2);
    pts.push({ x: cx + Math.cos(a) * r * w, y: cy + Math.sin(a) * r * w });
  }
  const prof = (u: number) => 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 0.8 + 0.2)) ** 0.7;
  ctx.fillStyle = color;
  ribbon(ctx, pts, (u) => width * prof(u));
  // Dry-brush streaks: paper showing through in thin lines along the stroke.
  const rr = rng(seed * 31 + 7);
  for (let j = 0; j < 7; j++) {
    const off = rr.range(-0.4, 0.4) * width, u0 = rr.range(0.25, 0.7), u1 = Math.min(1, u0 + rr.range(0.15, 0.35));
    const sub: Pt[] = [];
    for (let i = 0; i <= 30; i++) {
      const u = lerp(u0, u1, i / 30);
      if (u > clamp(k) * 0.999) break;
      const a = lerp(a0, a0 + Math.PI * 2 * 0.94, u);
      sub.push({ x: cx + Math.cos(a) * (r + off * prof(u)), y: cy + Math.sin(a) * (r + off * prof(u)) });
    }
    if (sub.length < 2) continue;
    ctx.fillStyle = rgba('#ebe8e2', 0.55);
    ribbon(ctx, sub, (u) => rr.range(1.5, 3.5) * Math.sin(Math.PI * u));
  }
}

/** Ink and gold brush arcs wheeling in round a centre (flat layer, paper). `k` 0 to 1 is how far in. */
export function inkWheel(ctx: Ctx, c: Pt, t: number, k: number, seed = 404) {
  if (k <= 0) return;
  const r = rng(seed);
  for (let i = 0; i < 40; i++) {
    const rad = r.range(330, 1000), a0 = r.range(0, Math.PI * 2), len = r.range(0.2, 0.6);
    const speed = r.range(1.2, 2.6) * (rad < 600 ? 1.3 : 1);
    const gold = r.next() < 0.28;
    const born = r.range(0, 0.6);
    const g = clamp((k - born) / 0.4);
    if (g <= 0) continue;
    const a = a0 - t * speed;
    const pts: Pt[] = [];
    for (let j = 0; j <= 18; j++) {
      const aa = a + len * g * (j / 18);
      const rr = rad * (1 - 0.12 * (j / 18) * g);
      pts.push({ x: c.x + Math.cos(aa) * rr, y: c.y + Math.sin(aa) * rr * 0.82 });
    }
    ctx.fillStyle = gold ? rgba('#c08a1c', 0.9) : rgba('#1d1840', 0.85);
    ribbon(ctx, pts, (u) => (gold ? 6 : 4.5) * Math.sin(Math.PI * Math.min(1, u * 1.3 + 0.05)) ** 0.6);
  }
}

/** The shock of a strike on paper: a broken ink ring opening out and thin rings after it (flat layer). */
export function inkShock(ctx: Ctx, c: Pt, k: number, size: number, seed: number) {
  if (k <= 0 || k >= 1) return;
  const R = lerp(size * 0.3, size, Math.sqrt(k)), a = 1 - k;
  const r = rng(seed);
  // The thick ring in pieces, thinning as it goes.
  for (let p = 0; p < 7; p++) {
    const a0 = r.range(0, Math.PI * 2), len = r.range(0.5, 1.2);
    const pts: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const aa = a0 + len * (i / 20);
      pts.push({ x: c.x + Math.cos(aa) * R, y: c.y + Math.sin(aa) * R * 0.92 });
    }
    ctx.fillStyle = rgba('#1a1638', 0.9 * a);
    ribbon(ctx, pts, (u) => 22 * a * Math.sin(Math.PI * u) ** 0.5);
  }
  for (const f of [0.82, 0.68]) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R * f, R * f * 0.92, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba('#1a1638', 0.6 * a);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // Fine radial strokes.
  for (let i = 0; i < 26; i++) {
    const ang = r.range(0, Math.PI * 2), r0 = R * r.range(1.02, 1.1), r1 = r0 + R * r.range(0.08, 0.25);
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(ang) * r0, c.y + Math.sin(ang) * r0 * 0.92);
    ctx.lineTo(c.x + Math.cos(ang) * r1, c.y + Math.sin(ang) * r1 * 0.92);
    ctx.strokeStyle = rgba(i % 4 === 0 ? '#c08a1c' : '#1a1638', 0.7 * a);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** A gold ring of light opening out (glow layer). */
export function goldShock(ctx: Ctx, c: Pt, k: number, size: number, color = '#ffc840') {
  if (k <= 0 || k >= 1) return;
  const R = lerp(size * 0.3, size, Math.sqrt(k)), a = (1 - k) ** 1.5;
  for (const [w, al] of [[16, 0.25], [5, 0.9]] as const) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R, R * 0.92, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(color, al * a);
    ctx.lineWidth = w * (0.4 + 0.6 * a);
    ctx.stroke();
  }
}

/** The hum of the drum: pairs of thin arcs either side, moving out and fading (flat layer). */
export function hum(ctx: Ctx, c: Pt, R: number, t: number, k: number) {
  if (k <= 0) return;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const ph = (t * 1.6 + i / 4) % 1;
    const rad = R * (1.22 + ph * 0.9);
    const a = k * Math.sin(Math.PI * ph) ** 1.2;
    for (const side of [0, Math.PI]) {
      const pts: Pt[] = [];
      for (let j = 0; j <= 16; j++) {
        const aa = side - 0.42 + (0.84 * j) / 16;
        pts.push({ x: c.x + Math.cos(aa) * rad * 0.9, y: c.y + Math.sin(aa) * rad });
      }
      ctx.fillStyle = rgba('#1d1840', 0.85 * a);
      ribbon(ctx, pts, (u) => 6.5 * Math.sin(Math.PI * u) ** 0.6);
    }
  }
}

