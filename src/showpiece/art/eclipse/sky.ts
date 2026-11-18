import { H, W, clamp, lerp, ribbon, rng, rgba, wobble, type Ctx, type Pt } from '../../core';
import { halftone } from '../paper';

/**
 * Black Sun Eclipse, the sky: the pale sun brushed on paper as an ink circle, the black moon creeping over it, the night
 * wiping across, the diamond ring, and the corona (a thin pale-gold and violet ring with long streamers).
 */

/** The sun's centre, the middle of the frame. */
export const C: Pt = { x: 960, y: 540 };
export const SUN_R = 250;
export const MOON_R = 258;

export const VIOLET = '#7a3fe0';
export const VIOLET_LIGHT = '#b98cff';
export const MAGENTA = '#ff4fc8';
export const GOLD = '#f2dc9a';
export const INK = '#0d0911';
export const BONE = '#f4eee2';

/** Where the moon is at time t: it creeps in from the right, a little high, and covers the sun at TOTAL. */
export const TOTAL = 2.74;
export function moonAt(t: number): Pt {
  const k = clamp(t / TOTAL);
  const d = 600 * (1 - k) ** 1.15;
  const dx = 0.966, dy = -0.259;
  return { x: C.x + dx * d, y: C.y + dy * d };
}

/** The ink circle of the sun, brushed on clockwise from the top up to `k` (flat). One stroke, thick in its middle. */
export function inkSun(ctx: Ctx, k: number, wash: number, alpha = 1) {
  if (wash > 0) {
    // A pale gold wash inside, darker to the edge, with a fine dot screen.
    const g = ctx.createRadialGradient(C.x - 60, C.y - 70, 20, C.x, C.y, SUN_R);
    g.addColorStop(0, rgba('#fbf3d8', 0.9 * wash * alpha));
    g.addColorStop(1, rgba('#ead7a0', 0.75 * wash * alpha));
    ctx.beginPath();
    ctx.arc(C.x, C.y, SUN_R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    halftone(ctx, rgba('#c9a95a', 0.45 * wash * alpha), 12, (x, y) => {
      const d = Math.hypot(x - C.x, y - C.y) / SUN_R;
      return d < 0.97 ? 0.15 + 0.45 * d * d : 0;
    }, { x: C.x - SUN_R, y: C.y - SUN_R, w: SUN_R * 2, h: SUN_R * 2 });
  }
  if (k <= 0) return;
  const a0 = -Math.PI / 2 - 0.25, a1 = a0 + Math.PI * 2 * 1.04 * clamp(k);
  const pts: Pt[] = [];
  for (let i = 0; i <= 90; i++) {
    const a = lerp(a0, a1, i / 90), w = 1 + 0.008 * Math.sin(a * 3 + 1) + 0.004 * Math.sin(a * 9);
    pts.push({ x: C.x + Math.cos(a) * SUN_R * w, y: C.y + Math.sin(a) * SUN_R * w });
  }
  ctx.fillStyle = rgba(INK, alpha);
  ribbon(ctx, pts, (u) => 15 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.12)) ** 0.7));
  // A dry-brush hair line beside it.
  ctx.fillStyle = rgba(INK, 0.5 * alpha);
  ribbon(ctx, pts.map((p) => ({ x: C.x + (p.x - C.x) * 1.035, y: C.y + (p.y - C.y) * 1.035 })),
    (u) => 2.5 * Math.sin(Math.PI * Math.min(1, u * 1.3)) ** 0.5);
}

/** The moon on the paper: an ink disc with a violet rim and a halftone crescent of violet on its lit side (flat). */
export function paperMoon(ctx: Ctx, at: Pt, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(at.x, at.y, MOON_R, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  // A crescent of violet dots on the side away from the sun's light (the trailing side).
  halftone(ctx, rgba('#5b2fb0', 0.85), 11, (x, y) => {
    const d = Math.hypot(x - at.x, y - at.y) / MOON_R;
    if (d > 0.95) return 0;
    const side = ((x - at.x) * 0.966 + (y - at.y) * -0.259) / MOON_R;
    return clamp((side - 0.2) * 1.6) * clamp((d - 0.45) * 2.2);
  }, { x: at.x - MOON_R, y: at.y - MOON_R, w: MOON_R * 2, h: MOON_R * 2 });
  ctx.beginPath();
  ctx.arc(at.x, at.y, MOON_R - 7, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(VIOLET, 0.9);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/** Thin ink streaks trailing behind the creeping moon (flat), along the way it came. */
export function moonTrail(ctx: Ctx, at: Pt, k: number) {
  if (k <= 0) return;
  const dx = 0.966, dy = -0.259, nx = -dy, ny = dx;
  const r = rng(616);
  for (let i = 0; i < 7; i++) {
    const off = r.range(-0.85, 0.85) * MOON_R, len = r.range(180, 420) * k;
    const back = Math.sqrt(Math.max(0, MOON_R * MOON_R - off * off)) - 10;
    const pts: Pt[] = [];
    for (let j = 0; j <= 10; j++) {
      const d = back + len * (j / 10);
      pts.push({ x: at.x + dx * d + nx * off, y: at.y + dy * d + ny * off });
    }
    ctx.fillStyle = rgba(i % 3 === 0 ? '#5b2fb0' : INK, 0.8);
    ribbon(ctx, pts, (u) => r.range(2.5, 6) * (1 - u) ** 1.3);
  }
}

/** Long, thin ink lines across the paper (flat): the sky's horizon, as a brush would leave them. */
export function paperLines(ctx: Ctx, k: number) {
  if (k <= 0) return;
  const lines: [number, number, number, number, string][] = [
    // y at left, y at right, width, start x fraction, colour
    [742, 708, 5, 0, INK],
    [760, 728, 2, 0.1, '#5b2fb0'],
    [330, 300, 2.2, 0.35, INK],
  ];
  for (const [y0, y1, w, s0, c] of lines) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const u = lerp(s0, 1, (i / 40) * clamp(k)), x = lerp(-40, 1960, u);
      pts.push({ x, y: lerp(y0, y1, u) + Math.sin(Math.PI * u) * 18 });
    }
    ctx.fillStyle = rgba(c, 0.85);
    ribbon(ctx, pts, (u) => w * Math.sin(Math.PI * Math.min(1, u * 1.04)) ** 0.4);
  }
}

/** Thin ink orbits round the sun on the paper (flat), drawn on by `k` and turning slowly: an astronomer's drawing. */
export function orbitArcs(ctx: Ctx, t: number, k: number) {
  if (k <= 0) return;
  const arcs: [number, number, number, number, string][] = [
    // radius, start angle, length, width, colour
    [318, 2.2, 1.5, 3.2, INK],
    [352, -0.6, 0.9, 2, '#5b2fb0'],
    [430, 3.4, 1.9, 4.5, INK],
    [470, 0.5, 0.7, 2, INK],
    [560, 1.4, 1.2, 2.4, '#5b2fb0'],
    [640, 4.2, 1.0, 3, INK],
  ];
  arcs.forEach(([r, a0, len, w, c], i) => {
    const g = clamp(k * 1.6 - i * 0.12);
    if (g <= 0) return;
    const turn = (i % 2 ? -1 : 1) * 0.05 * t;
    const pts: Pt[] = [];
    for (let j = 0; j <= 30; j++) {
      const a = a0 + turn + len * g * (j / 30);
      pts.push({ x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r * 0.97 });
    }
    ctx.fillStyle = rgba(c, 0.85);
    ribbon(ctx, pts, (u) => w * Math.sin(Math.PI * u) ** 0.6);
  });
}

/** The night's first hint on the paper (flat): violet dots gathering on the side the moon comes from. */
export function nightHint(ctx: Ctx, k: number) {
  if (k <= 0) return;
  halftone(ctx, rgba('#5b2fb0', 0.5), 16, (x, y) => (clamp((x - 1250) / 650) * 0.75 - Math.abs(y - 420) / 1400) * k,
    { x: 1200, y: 0, w: 720, h: H });
}

let night: HTMLCanvasElement | null = null;

/** The night: deep violet, lighter round the sun, a dot screen thickening to the edges, faint stars. Made once. */
export function nightSheet() {
  if (night) return night;
  night = document.createElement('canvas');
  night.width = W;
  night.height = H;
  const c = night.getContext('2d')!;
  const g = c.createRadialGradient(C.x, C.y, 120, C.x, C.y, 1150);
  g.addColorStop(0, '#3a1a6e');
  g.addColorStop(0.45, '#26114c');
  g.addColorStop(1, '#130828');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // Dots, larger to the edges.
  halftone(c, 'rgba(10,4,22,0.55)', 14, (x, y) => {
    const d = Math.hypot((x - C.x) / 1.2, y - C.y) / 820;
    return clamp((d - 0.35) * 1.2) * 0.9;
  });
  halftone(c, 'rgba(140,90,230,0.10)', 7, (x, y) => (Math.hypot(x - C.x, y - C.y) < 700 ? 0.45 : 0.3));
  // Faint concentric rings round the sun.
  for (const [r, a] of [[420, 0.10], [560, 0.07], [720, 0.05]] as const) {
    c.beginPath();
    c.arc(C.x, C.y, r, 0, Math.PI * 2);
    c.strokeStyle = `rgba(170,120,255,${a})`;
    c.lineWidth = 2;
    c.stroke();
  }
  const r = rng(404);
  for (let i = 0; i < 140; i++) {
    const x = r.next() * W, y = r.next() * H;
    if (Math.hypot(x - C.x, y - C.y) < 330) continue;
    c.fillStyle = r.next() < 0.7 ? 'rgba(236,224,255,0.55)' : 'rgba(242,220,154,0.5)';
    c.beginPath();
    c.arc(x, y, r.range(0.8, 2.4), 0, Math.PI * 2);
    c.fill();
  }
  return night;
}

export function nightGround(ctx: Ctx) {
  ctx.drawImage(nightSheet(), 0, 0, W, H);
}

/** The violet halftone corona on the night (flat): dots round the disc, shrinking outwards. */
export function flatCorona(ctx: Ctx, k: number, reach = 300) {
  if (k <= 0) return;
  const R = MOON_R;
  halftone(ctx, rgba('#8a55e8', 0.6 * k), 12, (x, y) => {
    const d = Math.hypot(x - C.x, y - C.y);
    if (d < R) return 0;
    return (1 - (d - R) / (reach * k)) * 0.95;
  }, { x: C.x - R - reach, y: C.y - R - reach, w: (R + reach) * 2, h: (R + reach) * 2 });
}

/** The black disc of the eclipsed sun (flat, or on glow to cut the light out). */
export function blackDisc(ctx: Ctx, r = MOON_R, color = '#07040b') {
  ctx.beginPath();
  ctx.arc(C.x, C.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

interface Streamer { a: number; len: number; bend: number; w: number; gold: boolean; seed: number }
const STREAMERS: Streamer[] = (() => {
  const r = rng(733);
  const out: Streamer[] = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r.range(-0.12, 0.12);
    // The long ones lie roughly along a tilted axis, like a real corona's streamers.
    const axis = Math.abs(Math.cos(a - 0.35));
    out.push({ a, len: r.range(120, 260) + 420 * axis ** 3 * r.range(0.6, 1.1), bend: r.range(-0.22, 0.22), w: r.range(8, 22), gold: r.next() < 0.55, seed: i * 31 + 7 });
  }
  return out;
})();
const hair = (() => {
  const r = rng(919);
  return Array.from({ length: 160 }, () => ({ a: r.range(0, Math.PI * 2), len: r.range(25, 150), gold: r.next() < 0.6 }));
})();

/**
 * The corona (glow): a thin hot ring at the disc's edge, violet haze, fine hair lines, and long streamers curving out.
 * `k` brings it in, `grow` the streamers' reach, `hot` a white-hot moment at totality.
 */
export function corona(ctx: Ctx, t: number, k: number, grow: number, hot = 0) {
  if (k <= 0) return;
  const R = MOON_R;
  // Streamers: a wide faint violet pass, then a fine pale one.
  for (const s of STREAMERS) {
    const w = wobble(s.seed);
    const len = s.len * grow * (0.94 + 0.06 * w(t * 0.9));
    if (len < 8) continue;
    const pts: Pt[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, rr = R + len * u;
      const a = s.a + s.bend * u * u + 0.02 * w(t * 1.3 + u * 2) * u;
      pts.push({ x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr });
    }
    ctx.fillStyle = rgba(s.gold ? '#9c6cff' : '#b44be0', 0.22 * k);
    ribbon(ctx, pts, (u) => s.w * 2.2 * (1 - u) ** 1.2);
    ctx.fillStyle = rgba(s.gold ? GOLD : '#d6b8ff', 0.55 * k);
    ribbon(ctx, pts, (u) => s.w * 0.45 * (1 - u) ** 1.6);
  }
  // Fine hair lines.
  ctx.lineWidth = 1.3;
  for (const h of hair) {
    const len = h.len * grow;
    ctx.beginPath();
    ctx.moveTo(C.x + Math.cos(h.a) * (R + 2), C.y + Math.sin(h.a) * (R + 2));
    ctx.lineTo(C.x + Math.cos(h.a) * (R + len), C.y + Math.sin(h.a) * (R + len));
    ctx.strokeStyle = rgba(h.gold ? GOLD : VIOLET_LIGHT, 0.32 * k);
    ctx.stroke();
  }
  // The ring.
  for (const [w, c, a] of [[34 + 30 * hot, '#7a3fe0', 0.28], [12 + 10 * hot, '#e8cf86', 0.55], [3.5 + 6 * hot, '#fff8e6', 0.95]] as const) {
    ctx.beginPath();
    ctx.arc(C.x, C.y, R + 2, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(c, a * k);
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

/** The night's edge sweeping across from right to left at progress p (0 to 1): its x at height y. */
const edgeWob = wobble(55), edgeWob2 = wobble(81);
export function wipeEdge(p: number, y: number) {
  const x0 = lerp(2250, -520, p);
  return x0 + (y - 540) * 0.32 + 34 * edgeWob(y * 0.012) + 16 * edgeWob2(y * 0.05);
}

/** Clips `ctx` to the night side of the wipe (right of the edge). */
export function clipNight(ctx: Ctx, p: number) {
  ctx.beginPath();
  ctx.moveTo(2100, -40);
  for (let y = -40; y <= 1120; y += 20) ctx.lineTo(wipeEdge(p, y), y);
  ctx.lineTo(2100, 1120);
  ctx.closePath();
  ctx.clip();
}

/** The dots ahead of the night's edge (flat): growing towards it, in the night's colour. */
export function wipeDots(ctx: Ctx, p: number) {
  if (p <= 0 || p >= 1) return;
  halftone(ctx, '#1d0d3a', 18, (x, y) => {
    const d = wipeEdge(p, y) - x;
    return d < 0 ? 0 : 1 - d / 170;
  });
}

/** The sliver of sun left beside the moon (glow): pale gold, cut by the moon's disc. */
export function sunSliver(ctx: Ctx, moon: Pt, k: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(C.x, C.y, SUN_R + 3, 0, Math.PI * 2);
  ctx.arc(moon.x, moon.y, MOON_R, 0, Math.PI * 2, true);
  ctx.fillStyle = rgba('#fff3d0', 0.95 * k);
  ctx.fill('evenodd');
  ctx.restore();
}

/** The diamond ring: one bead of light on the rim where the sun's last sliver is, with long thin rays (glow). */
export function diamond(ctx: Ctx, k: number, t: number) {
  if (k <= 0) return;
  // The last point of the sun: on its rim, away from where the moon came from.
  const at = { x: C.x - 0.966 * SUN_R, y: C.y + 0.259 * SUN_R };
  const R = 150 * k;
  const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, R);
  g.addColorStop(0, rgba('#ffffff', k));
  g.addColorStop(0.3, rgba('#fff0c8', 0.75 * k));
  g.addColorStop(1, rgba('#c890ff', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(at.x, at.y, R, 0, Math.PI * 2);
  ctx.fill();
  const r = rng(Math.floor(t * 24) + 3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2 + r.range(-0.05, 0.05), len = (i % 2 ? 160 : 430) * k * r.range(0.85, 1.1);
    const pts: Pt[] = [];
    for (let j = 0; j <= 6; j++) pts.push({ x: at.x + Math.cos(a) * len * (j / 6), y: at.y + Math.sin(a) * len * (j / 6) });
    ctx.fillStyle = rgba('#fff6e4', 0.9 * k);
    ribbon(ctx, pts, (u) => 6 * (1 - u));
  }
}
