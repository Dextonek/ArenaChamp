import { clamp, lerp, ribbon, rng, rgba, type Ctx, type Pt } from '../core';
import { halftone } from './paper';

/**
 * The draw: ink swirling on the paper, the red sun painted with one brush stroke, the burst into the dark, the sun burning
 * there with sparks wheeling round the sword's mouth, and the star of light where the blade leaves the scabbard.
 */

export const SUN = { x: 1060, y: 520, r: 390 };

/** Thin black and red brush arcs wheeling round the centre on the paper (flat layer). `k` 0 to 1 is how far in. */
export function inkSwirl(ctx: Ctx, t: number, k: number) {
  if (k <= 0) return;
  const r = rng(808);
  for (let i = 0; i < 46; i++) {
    const rad = r.range(140, 980), a0 = r.range(0, Math.PI * 2), len = r.range(0.25, 0.7);
    const speed = r.range(1.6, 3.2) * (rad < 500 ? 1.4 : 1);
    const red = r.next() < 0.3;
    const born = r.range(0, 0.6);
    const g = clamp((k - born) / 0.4);
    if (g <= 0) continue;
    const a = a0 + t * speed;
    const pts: Pt[] = [];
    for (let j = 0; j <= 18; j++) {
      const aa = a - len * g * (j / 18);
      const rr = rad * (1 - 0.15 * (j / 18) * g);
      pts.push({ x: SUN.x - 80 + Math.cos(aa) * rr, y: SUN.y + Math.sin(aa) * rr * 0.8 });
    }
    ctx.fillStyle = red ? rgba('#d42a24', 0.9) : rgba('#1b1416', 0.85);
    ribbon(ctx, pts, (u) => (red ? 7 : 4.5) * Math.sin(Math.PI * Math.min(1, u * 1.3 + 0.05)) ** 0.6);
  }
}

/** The red sun painted on the paper: a pink wash with red halftone, and a thick red brush stroke round it (flat layer). */
export function paintedSun(ctx: Ctx, wash: number, stroke: number) {
  if (wash > 0) {
    const g = ctx.createRadialGradient(SUN.x, SUN.y, 40, SUN.x, SUN.y, SUN.r * 1.05);
    g.addColorStop(0, rgba('#f2a49a', 0.55 * wash));
    g.addColorStop(1, rgba('#f2b0a6', 0.25 * wash));
    ctx.beginPath();
    ctx.arc(SUN.x, SUN.y, SUN.r * (0.6 + 0.4 * wash), 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    halftone(ctx, rgba('#d8443a', 0.7 * wash), 12, (x, y) => {
      const d = Math.hypot(x - SUN.x, y - SUN.y) / SUN.r;
      return d < 1.08 ? 0.35 + 0.25 * d : 0;
    }, { x: SUN.x - SUN.r - 40, y: SUN.y - SUN.r - 40, w: SUN.r * 2 + 80, h: SUN.r * 2 + 80 });
  }
  if (stroke > 0) {
    // One stroke clockwise from the top; its head is a fat wet blob.
    const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * 0.92 * clamp(stroke);
    const pts: Pt[] = [];
    for (let i = 0; i <= 80; i++) {
      const a = lerp(a0, a1, i / 80), w = 1 + 0.012 * Math.sin(a * 3 + 1) + 0.006 * Math.sin(a * 11);
      pts.push({ x: SUN.x + Math.cos(a) * SUN.r * w, y: SUN.y + Math.sin(a) * SUN.r * w });
    }
    ctx.fillStyle = '#7a0e0e';
    ribbon(ctx, pts, (u) => 74 * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 0.7 + 0.3))));
    ctx.fillStyle = '#cf2a20';
    ribbon(ctx, pts, (u) => 62 * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 0.7 + 0.3))));
    ctx.fillStyle = '#f0603a';
    ribbon(ctx, pts, (u) => 18 * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 0.7 + 0.3))));
  }
}

/**
 * The burst into the dark: the paper is swallowed from the frame's edges by a spiky black star whose hole shrinks onto
 * the sun (flat layer, over the paper). `k` 0 (none) to 1 (all dark).
 */
export function darkBurst(ctx: Ctx, k: number, t: number) {
  if (k <= 0) return;
  const r = rng(Math.floor(t * 24) + 5);
  const hole = lerp(1500, 0, k ** 0.7);
  ctx.beginPath();
  ctx.rect(-20, -20, 1960, 1120);
  const n = 44;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = hole * (i % 2 ? r.range(0.55, 0.8) : r.range(1, 1.12));
    const x = SUN.x + Math.cos(-a) * rr * 1.25, y = SUN.y + Math.sin(-a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#0b0607';
  ctx.fill('evenodd');
}

/** The sun in the dark (flat layer): a deep red disc with a lighter middle and a fine red screen. */
export function sunFlat(ctx: Ctx, k: number, scale = 1) {
  if (k <= 0) return;
  const R = SUN.r * scale;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  const g = ctx.createRadialGradient(SUN.x - R * 0.2, SUN.y - R * 0.2, 20, SUN.x, SUN.y, R);
  g.addColorStop(0, '#e2503a');
  g.addColorStop(0.7, '#b3220f');
  g.addColorStop(1, '#5a0a06');
  ctx.beginPath();
  ctx.arc(SUN.x, SUN.y, R, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  halftone(ctx, 'rgba(255,140,110,0.22)', 11, (x, y) => (Math.hypot(x - SUN.x, y - SUN.y) < R * 0.98 ? 0.5 : 0),
    { x: SUN.x - R, y: SUN.y - R, w: R * 2, h: R * 2 });
  ctx.restore();
}

/** The sun's burning rim (glow layer). */
export function sunGlow(ctx: Ctx, k: number, scale = 1, hot = 0) {
  if (k <= 0) return;
  const R = SUN.r * scale;
  for (const [w, c, a] of [[90, '#d8300c', 0.25], [46, '#ff5a1e', 0.85], [20, '#ffb070', 0.9], [6 + 14 * hot, '#fff0dc', 0.9]] as const) {
    ctx.beginPath();
    ctx.arc(SUN.x, SUN.y, R, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(c, a * k);
    ctx.lineWidth = w;
    ctx.stroke();
  }
  // A second thin ring just inside, as in a lens.
  ctx.beginPath();
  ctx.arc(SUN.x, SUN.y, R * 0.9, 0, Math.PI * 2);
  ctx.strokeStyle = rgba('#ff8a50', 0.45 * k);
  ctx.lineWidth = 4;
  ctx.stroke();
}

/** Sparks: bright curved streaks wheeling round the sun and thrown off the sword's mouth (glow layer). */
export function sparks(ctx: Ctx, t: number, k: number, from: Pt) {
  if (k <= 0) return;
  const r = rng(515);
  ctx.lineCap = 'round';
  for (let i = 0; i < 110; i++) {
    const life = r.range(0.5, 1.2), off = r.range(0, life), age = ((t + off) % life) / life;
    const orbit = r.next() < 0.55;
    const pts: Pt[] = [];
    if (orbit) {
      // Round the sun, at a radius near its rim.
      const rad = SUN.r * r.range(0.6, 1.5), a0 = r.range(0, 6.28) + t * r.range(1.2, 2.6) * r.sign();
      const len = r.range(0.3, 0.9) * Math.sin(Math.PI * age);
      for (let j = 0; j <= 10; j++) {
        const a = a0 - len * (j / 10);
        pts.push({ x: SUN.x + Math.cos(a) * rad, y: SUN.y + Math.sin(a) * rad });
      }
    } else {
      // Thrown off the mouth along curves.
      const ang = r.range(-Math.PI, Math.PI), bend = r.range(-1.6, 1.6), reach = r.range(250, 900) * (0.2 + age);
      for (let j = 0; j <= 10; j++) {
        const u = 1 - (j / 10) * 0.45;
        const a = ang + bend * u * age;
        pts.push({ x: from.x + Math.cos(a) * reach * u, y: from.y + Math.sin(a) * reach * u });
      }
    }
    const alpha = k * Math.sin(Math.PI * age);
    ctx.fillStyle = rgba(r.next() < 0.6 ? '#ffe2b8' : '#ff8a40', alpha);
    ribbon(ctx, pts, (u) => r.range(2, 4.5) * (1 - u));
  }
}

/** The star of light at the sword's mouth: a hot core, long thin rays and a soft halo (glow layer). */
export function starFlare(ctx: Ctx, at: Pt, k: number, t: number) {
  if (k <= 0) return;
  const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, 120 * k);
  g.addColorStop(0, rgba('#ffffff', k));
  g.addColorStop(0.25, rgba('#ffd8a0', 0.8 * k));
  g.addColorStop(1, rgba('#ff6a20', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(at.x, at.y, 120 * k, 0, Math.PI * 2);
  ctx.fill();
  const r = rng(Math.floor(t * 20));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r.range(-0.2, 0.2), len = (i % 2 ? 140 : 300) * k * r.range(0.7, 1.2);
    const pts = [at, { x: at.x + Math.cos(a) * len, y: at.y + Math.sin(a) * len }];
    ctx.fillStyle = rgba('#fff4e0', 0.9 * k);
    ribbon(ctx, pts, (u) => 7 * (1 - u));
  }
}
