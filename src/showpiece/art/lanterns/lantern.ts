import { clamp, lerp, rgba, rng, wobble, type Ctx, type Pt } from '../../core';
import { SERIF } from '../paper';
import { C, mix } from './common';

/**
 * The paper lantern (chōchin): a round ribbed body of paper, a black cap and base, a big character painted on its face,
 * a paper tag on a string. One drawing for every state it is in: unlit on the paper, unlit in the night (a dark
 * silhouette), lit amber, lit with ghost-fire cyan, or between.
 *
 * `lanternFlat` draws the lantern itself (flat layer); `lanternGlow` lays its light over it (glow layer): a soft light
 * inside the paper and, at night, a halo round it.
 */

export interface LanternPose {
  /** The body's middle and its radius (half its width). */
  x: number;
  y: number;
  R: number;
  /** The swing, radians, round the top of its cord. */
  swing: number;
  /** The cord's length above the cap (0: none). */
  cord: number;
  /** How lit it is (0 to 1), and the light's colour (0 amber, 1 ghost-fire cyan). */
  light: number;
  hue: number;
  /** 0: in daylight on the paper; 1: in the night (unlit, it is a dark silhouette). */
  night: number;
  /** The character painted on its face ('' for none). */
  kanji: string;
  /** Draw the paper tag. */
  tag: boolean;
  /** The flicker's time. */
  t: number;
  /** A fade for the whole lantern (0 to 1). */
  alpha?: number;
}

type Pal = { base: string; shade: string; core: string; rib: string; line: string; word: string };
const DAY: Pal = { base: '#ece4d0', shade: '#c6b897', core: '#f6f0e2', rib: '#8f7d5e', line: C.ink, word: '#1b1714' };
const NIGHT: Pal = { base: '#13312e', shade: '#0b201e', core: '#173a36', rib: '#244b46', line: '#020606', word: '#0b1f1d' };
const AMBER: Pal = { base: '#ffd68a', shade: '#ee9a42', core: '#fff3cf', rib: '#b2601e', line: '#3a1a06', word: '#3a1606' };
const WHITE: Pal = { base: '#fffaf0', shade: '#d8ecea', core: '#ffffff', rib: '#9aa8a4', line: '#1a1a18', word: '#2a2a28' };
const CYAN: Pal = { base: '#9ff3e0', shade: '#2fae98', core: '#e6fff9', rib: '#137566', line: '#03201d', word: '#05332e' };

function palette(p: LanternPose): Pal {
  const out = {} as Pal;
  for (const k of Object.keys(DAY) as (keyof Pal)[]) {
    const unlit = mix(DAY[k], NIGHT[k], p.night);
    // Amber to cyan through a white-hot instant, never through a muddy olive.
    const lit = mix(mix(AMBER[k], CYAN[k], p.hue), WHITE[k], 0.85 * Math.sin(Math.PI * clamp(p.hue)));
    out[k] = mix(unlit, lit, clamp(p.light));
  }
  return out;
}

/** Into the lantern's own frame: its body's middle at (0, 0), swung round the top of its cord. */
function enter(ctx: Ctx, p: LanternPose) {
  const ry = p.R * 0.9;
  ctx.save();
  ctx.translate(p.x, p.y - ry - p.cord);
  ctx.rotate(p.swing);
  ctx.translate(0, ry + p.cord);
}

/** The flame's small flicker inside (0.85 to 1). */
const flick = (p: LanternPose) => 0.9 + 0.1 * wobble(Math.round(p.R * 13))(p.t * 6);

function bodyPath(ctx: Ctx, R: number, scale = 1, dx = 0, dy = 0) {
  ctx.beginPath();
  ctx.ellipse(dx, dy, R * scale, R * 0.9 * scale, 0, 0, Math.PI * 2);
}

/** The lantern (flat layer). */
export function lanternFlat(ctx: Ctx, p: LanternPose) {
  const a = p.alpha ?? 1;
  if (a <= 0) return;
  const R = p.R, ry = R * 0.9;
  const pal = palette(p);
  enter(ctx, p);
  ctx.globalAlpha = a;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // The cord up to whatever it hangs from.
  if (p.cord > 0) {
    ctx.beginPath();
    ctx.moveTo(0, -ry - R * 0.22);
    ctx.lineTo(0, -ry - p.cord);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(1.5, R * 0.025);
    ctx.stroke();
  }
  // The paper body: the shade, then the lit face over it (a crescent of shade is left on the lower left).
  ctx.save();
  bodyPath(ctx, R);
  ctx.clip();
  ctx.fillStyle = pal.shade;
  ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
  ctx.fillStyle = pal.base;
  bodyPath(ctx, R, 0.9, R * 0.1, -R * 0.06);
  ctx.fill();
  // The bright core: a soft cel step, larger when lit.
  const lit = clamp(p.light);
  ctx.fillStyle = rgba(pal.core, 0.35 + 0.55 * lit);
  bodyPath(ctx, R, 0.42 + 0.2 * lit, R * 0.16, -R * 0.12);
  ctx.fill();
  // The ribs: curves round the body.
  ctx.strokeStyle = pal.rib;
  ctx.lineWidth = Math.max(1, R * 0.018);
  for (let k = -5; k <= 5; k++) {
    const y = ry * (k / 6);
    const w = R * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2));
    ctx.beginPath();
    ctx.ellipse(0, y, w, w * 0.11, 0, 0.05, Math.PI - 0.05);
    ctx.stroke();
  }
  // The painted character.
  if (p.kanji && R > 30) {
    ctx.font = `900 ${Math.round(R * 0.95)}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(pal.word, 0.88);
    ctx.save();
    ctx.scale(1, 1.08);
    ctx.fillText(p.kanji, R * 0.02, R * 0.04);
    ctx.restore();
  }
  ctx.restore();
  // The outline.
  bodyPath(ctx, R);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = Math.max(1.5, R * 0.035);
  ctx.stroke();
  // Cap and base: black lacquer bands, a thin lighter rim.
  const band = (y0: number, h: number, hw: number) => {
    ctx.fillStyle = mix('#0c0c0c', '#020606', p.night);
    ctx.beginPath();
    ctx.rect(-hw, y0, hw * 2, h);
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(1, R * 0.02);
    ctx.stroke();
    ctx.fillStyle = rgba(mix('#5a5650', '#2a4844', p.night), 0.9);
    ctx.fillRect(-hw * 0.92, y0 + h * 0.18, hw * 1.84, Math.max(1, h * 0.14));
  };
  band(-ry - R * 0.08, R * 0.2, R * 0.5);
  band(ry - R * 0.1, R * 0.17, R * 0.44);
  // The little ring the cord ties to.
  ctx.beginPath();
  ctx.arc(0, -ry - R * 0.14, R * 0.07, Math.PI, 0);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = Math.max(1, R * 0.03);
  ctx.stroke();
  if (p.tag) tag(ctx, p, pal);
  ctx.restore();
}

/** The paper tag on its string below the base, swinging a little behind the lantern. */
function tag(ctx: Ctx, p: LanternPose, pal: Pal) {
  const R = p.R, ry = R * 0.9;
  ctx.save();
  ctx.translate(0, ry + R * 0.07);
  ctx.rotate(-p.swing * 0.8 + 0.03 * Math.sin(p.t * 2.3));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, R * 0.32);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = Math.max(1, R * 0.018);
  ctx.stroke();
  const w = R * 0.3, h = R * 0.86, y0 = R * 0.32;
  ctx.beginPath();
  ctx.moveTo(-w / 2, y0);
  ctx.lineTo(w / 2, y0);
  ctx.lineTo(w / 2, y0 + h);
  ctx.lineTo(w * 0.1, y0 + h - w * 0.18);
  ctx.lineTo(-w / 2, y0 + h);
  ctx.closePath();
  ctx.fillStyle = mix(mix('#efe7d4', '#163633', p.night), mix('#ffe6b0', '#b9f7e9', p.hue), clamp(p.light) * 0.5);
  ctx.fill();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = Math.max(1, R * 0.02);
  ctx.stroke();
  // A short line of brush marks for writing, and a red-brown dot (the shrine's mark).
  ctx.strokeStyle = rgba(pal.word, 0.8);
  ctx.lineWidth = Math.max(1, R * 0.03);
  const r = rng(808);
  for (let i = 0; i < 4; i++) {
    const yy = y0 + h * (0.18 + i * 0.16);
    ctx.beginPath();
    ctx.moveTo(-w * r.range(0.12, 0.25), yy);
    ctx.lineTo(w * r.range(0.1, 0.25), yy + r.range(-2, 2));
    ctx.stroke();
  }
  ctx.restore();
}

/** The lantern's light (glow layer): inside its paper, and a halo round it (`halo` 0 on the paper, 1 at night). */
export function lanternGlow(ctx: Ctx, p: LanternPose, halo: number) {
  const k = clamp(p.light) * (p.alpha ?? 1);
  if (k <= 0) return;
  const R = p.R;
  const f = flick(p);
  const mid = 0.85 * Math.sin(Math.PI * clamp(p.hue));
  const col = mix(mix(C.amber, C.fire, p.hue), '#ffffff', mid), pale = mix(mix(C.amberPale, C.firePale, p.hue), '#ffffff', mid);
  enter(ctx, p);
  halo *= 0.35 + 0.65 * clamp(R / 160);
  const small = R < 45;
  if (halo > 0 && !small) {
    const g = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 2.6);
    g.addColorStop(0, rgba(col, 0.32 * k * halo * f));
    g.addColorStop(0.4, rgba(col, 0.1 * k * halo * f));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  bodyPath(ctx, R, 0.97);
  ctx.clip();
  const g = ctx.createRadialGradient(R * 0.1, R * 0.05, 0, 0, 0, R);
  g.addColorStop(0, rgba('#ffffff', 0.55 * k * f));
  g.addColorStop(0.3, rgba(pale, 0.42 * k * f));
  g.addColorStop(0.75, rgba(col, 0.18 * k));
  g.addColorStop(1, rgba(col, 0.05 * k));
  ctx.fillStyle = g;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  // Light spilling from the open top and bottom.
  if (!small) for (const [y, s] of [[-R * 0.98, -1], [R * 0.95, 1]] as const) {
    const lg = ctx.createRadialGradient(0, y, 0, 0, y, R * 0.55);
    lg.addColorStop(0, rgba(pale, 0.5 * k * f));
    lg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.ellipse(0, y + s * R * 0.08, R * 0.5, R * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Where a lantern's top opening is on screen (a wisp rises from it). */
export function lanternTop(p: LanternPose): Pt {
  const ry = p.R * 0.9;
  const px = p.x, py = p.y - ry - p.cord;
  const d = ry + p.cord - ry - p.R * 0.1;
  return { x: px - Math.sin(p.swing) * d, y: py + Math.cos(p.swing) * d };
}

/**
 * The black branch the lantern hangs from (flat): a brushed ink limb in from the top left, with two twigs and a few
 * dry leaves. `from` shifts it (the lantern's cord top must stay on it).
 */
export function branch(ctx: Ctx, hang: Pt, alpha = 1, color = C.ink) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  // The limb: a tapered brush stroke in from the right edge, through the hanging point, thinning to the left.
  const pts: Pt[] = [];
  const x0 = 1990, x1 = hang.x - 430;
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const x = lerp(x0, x1, u);
    const y = hang.y - 4 - 120 * (1 - u) ** 2 + 22 * Math.sin(u * 7) * (1 - u) + 60 * u ** 2.2;
    pts.push({ x, y });
  }
  limb(ctx, pts, (u) => 40 * (1 - u) ** 0.8 + 3);
  // Twigs.
  const twig = (at: number, ang: number, len: number, w: number) => {
    const p0 = pts[Math.round(at * 40)];
    const tw: Pt[] = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      tw.push({ x: p0.x + Math.cos(ang + 0.4 * u) * len * u, y: p0.y + Math.sin(ang + 0.4 * u) * len * u });
    }
    limb(ctx, tw, (u) => w * (1 - u) + 1.2);
  };
  twig(0.18, -2.3, 190, 13);
  twig(0.55, -2.0, 150, 9);
  twig(0.7, 2.3, 120, 7);
  twig(0.86, -2.6, 110, 5);
  twig(0.3, 2.2, 90, 9);
  // A few dry leaves, hanging.
  const r = rng(3131);
  for (let i = 0; i < 6; i++) {
    const p0 = pts[Math.round(r.range(0.3, 0.95) * 40)];
    const ang = r.range(1.2, 2.2), len = r.range(26, 44);
    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** A tapered limb along `pts` with a little brush roughness. */
function limb(ctx: Ctx, pts: Pt[], w: (u: number) => number) {
  const n = pts.length - 1;
  const left: Pt[] = [], right: Pt[] = [];
  const rough = wobble(pts.length * 13 + Math.round(pts[0].x));
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const u = i / n, ww = w(u) / 2 * (1 + 0.12 * rough(u * 9));
    left.push({ x: pts[i].x + nx * ww, y: pts[i].y + ny * ww });
    right.push({ x: pts[i].x - nx * ww * 0.85, y: pts[i].y - ny * ww * 0.85 });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}
