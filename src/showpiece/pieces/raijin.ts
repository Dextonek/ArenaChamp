import type { Beat, Layers, Piece } from '../piece';
import { bolt, clamp, easeIn, easeInOut, easeOut, easeOutBack, env, lerp, quietScreen, rng, seg, smooth, type Ctx, type Pt, type ScreenParams } from '../core';
import { paper, seal, specks } from '../art/paper';
import { paperFlood, speedLines } from '../art/ink';
import { bachi, brushRing, drum, drumGlow, goldShock, hum, inkShock, inkWheel } from '../art/raijin/drum';
import { CEILING, CEILING_BACK, FLOOR, FLOOR_BACK, cloudBank, nightReveal, nightSky, rain } from '../art/raijin/storm';
import {
  boltStroke, burstAtViewer, downBolt, drawTree, drumRing, drumRingGlow, hotStar, inwardLines, lightningTree, scorch,
  spiralSparks, tomoeFlat, tomoeGlow,
} from '../art/raijin/thunder';
import { raijinTitle } from '../art/raijin/title';

/**
 * Raijin's Verdict: Tenbatsu, Ten Thousand Thunders. The sequence, beat by beat, as a pure function of time.
 *
 * The thunder god's war drum on paper is struck twice; the second blow's shock carries the night out over the paper;
 * storm clouds close in, a tree of lightning splits the sky and strikes the drum; the camera falls into the drum's tomoe,
 * which becomes a great spinning tomoe of lightning in a hoop of drums; it collapses to a point and the last bolt comes
 * down and out at the viewer; the paper floods back, scorched, the drum still humming, and the seal is stamped.
 */

const DURATION = 13.6;

const BEATS: Beat[] = [
  { name: 'The drum', t0: 0, t1: 1.2 },
  { name: 'The strike', t0: 1.2, t1: 2.6 },
  { name: 'The storm', t0: 2.6, t1: 4.3 },
  { name: 'The lightning tree', t0: 4.3, t1: 6.4 },
  { name: 'The tomoe', t0: 6.4, t1: 8.95 },
  { name: 'The verdict', t0: 8.95, t1: 10.0 },
  { name: 'Scorched paper', t0: 10.0, t1: 12.2 },
  { name: 'The seal', t0: 12.2, t1: DURATION },
];

/** The drum on paper (start and end), and in the storm. */
const PAPER_DRUM = { x: 880, y: 560, R: 265 };
const STORM_DRUM = { x: 900, y: 640, R: 190 };
const HIT1 = 1.22, HIT2 = 1.85;
const CENTRE: Pt = { x: 960, y: 540 };
const SEAL_INDIGO = '#2c2a80';

function drumAt(t: number) {
  const k = easeInOut(seg(t, 2.5, 4.3));
  return { x: lerp(PAPER_DRUM.x, STORM_DRUM.x, k), y: lerp(PAPER_DRUM.y, STORM_DRUM.y, k), R: lerp(PAPER_DRUM.R, STORM_DRUM.R, k) };
}

/** How hard the drum is still ringing from the strikes (0 to 1). */
const ring = (t: number) => Math.max(t >= HIT1 ? 0.5 * Math.exp(-(t - HIT1) * 7) : 0, t >= HIT2 ? Math.exp(-(t - HIT2) * 5) : 0);

function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < 2.6) opening(L, t, screen);
  else if (t < 6.42) storm(L, t, screen);
  else if (t < 8.95) theTomoe(L, t, screen);
  else if (t < 10.0) verdict(L, t, screen);
  else ending(L, t, screen);
  if (!(t >= HIT2 && t < HIT2 + 0.07)) raijinTitle(L.glow, Math.min(smooth(seg(t, 0.15, 0.5)), 1 - seg(t, 4.3, 4.55)), t >= 1.9);
  return screen;
}

// ---------------------------------------------------------------------------------------------------------------------
// The stick: keyframes of its grip and angle.

type StickKey = [number, number, number, number]; // time, grip x, grip y, angle
const STICK_LEN = 640;
const HIT_TIP: Pt = { x: PAPER_DRUM.x - 70, y: PAPER_DRUM.y - 90 };
const HIT_ANGLE = 2.3;
const HIT_GRIP: Pt = { x: HIT_TIP.x - Math.cos(HIT_ANGLE) * STICK_LEN, y: HIT_TIP.y - Math.sin(HIT_ANGLE) * STICK_LEN };
const KEYS: StickKey[] = [
  [0.5, 1760, -320, 2.6],
  [0.95, 1360, -70, 2.95],
  [1.12, 1380, -90, 3.05],
  [HIT1, HIT_GRIP.x, HIT_GRIP.y, HIT_ANGLE],
  [1.5, 1340, -60, 2.85],
  [1.72, 1390, -100, 3.12],
  [HIT2, HIT_GRIP.x, HIT_GRIP.y, HIT_ANGLE],
  [2.3, 1800, -360, 2.5],
];

function stickPose(t: number) {
  if (t <= KEYS[0][0]) return { g: { x: KEYS[0][1], y: KEYS[0][2] }, a: KEYS[0][3] };
  for (let i = 1; i < KEYS.length; i++) {
    const [t1, x1, y1, a1] = KEYS[i];
    const [t0, x0, y0, a0] = KEYS[i - 1];
    if (t <= t1) {
      const raw = seg(t, t0, t1);
      // Down onto the drum: accelerating; away from it: easing out.
      const k = t1 === HIT1 || t1 === HIT2 ? easeIn(raw) : easeOut(raw);
      return { g: { x: lerp(x0, x1, k), y: lerp(y0, y1, k) }, a: lerp(a0, a1, k) };
    }
  }
  const last = KEYS[KEYS.length - 1];
  return { g: { x: last[1], y: last[2] }, a: last[3] };
}

const stickTip = (t: number) => {
  const p = stickPose(t);
  return { x: p.g.x + Math.cos(p.a) * STICK_LEN, y: p.g.y + Math.sin(p.a) * STICK_LEN };
};

/** The stick, with an ink smear behind its tip as it comes down. */
function drawStick(ctx: Ctx, t: number) {
  if (t < 0.5 || t > 2.3) return;
  for (const [a, b] of [[1.1, HIT1], [1.7, HIT2]]) {
    const k = env(t, a, a + 0.04, b + 0.02, b + 0.14);
    if (k <= 0) continue;
    const trail: Pt[] = [];
    for (let i = 0; i <= 12; i++) trail.push(stickTip(Math.max(a, Math.min(t, b) - 0.1 + (0.1 * i) / 12)));
    ctx.fillStyle = `rgba(29,24,64,${0.8 * k})`;
    ribbonSafe(ctx, trail, (u) => 30 * u ** 1.4);
  }
  const p = stickPose(t);
  bachi(ctx, p.g, p.a, STICK_LEN);
}

function ribbonSafe(ctx: Ctx, pts: Pt[], w: (u: number) => number) {
  // Skip if the trail has collapsed to a point.
  const d = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
  if (d < 4) return;
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const ww = w(i / (pts.length - 1)) / 2;
    left.push({ x: pts[i].x + nx * ww, y: pts[i].y + ny * ww });
    right.push({ x: pts[i].x - nx * ww, y: pts[i].y - ny * ww });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------------------------------------------------

/** The paper with the brush ring behind the drum and the ink wheeling in. */
function paperScene(ctx: Ctx, t: number) {
  paper(ctx);
  const d = PAPER_DRUM;
  const wash = smooth(seg(t, 0.35, 0.9));
  if (wash > 0) {
    const g = ctx.createRadialGradient(d.x + 40, d.y, 60, d.x + 40, d.y, 430);
    g.addColorStop(0, `rgba(160,150,220,${0.35 * wash})`);
    g.addColorStop(1, `rgba(170,160,220,${0.12 * wash})`);
    ctx.beginPath();
    ctx.arc(d.x + 40, d.y, 420, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
  inkWheel(ctx, { x: d.x + 40, y: d.y }, t, seg(t, 0.0, 0.8));
  brushRing(ctx, d.x + 40, d.y, 425, easeOut(seg(t, 0.3, 0.85)), 70, '#1d1846', 5);
  specks(ctx, 404, 50, 0.8, undefined, ['#1d1846', '#c08a1c', '#9a95a8']);
}

/** 0 to 2.6 s: the drum on paper, two strikes; the second's shock carries the night out over the paper. */
function opening(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  paperScene(L.flat, t);
  const d = drumAt(t);
  const shake = ring(t);
  const jx = Math.sin(t * 95) * 9 * shake, jy = Math.cos(t * 83) * 5 * shake;
  // The ink shock rings of each strike.
  inkShock(L.flat, { x: d.x + 40, y: d.y }, seg(t, HIT1, HIT1 + 0.6), 620, 11);
  inkShock(L.flat, { x: d.x + 40, y: d.y }, seg(t, HIT2, HIT2 + 0.5), 900, 23);
  // The night behind the second shock.
  const front = t >= HIT2 ? lerp(240, 1750, easeOut(seg(t, HIT2 + 0.02, 2.6))) : 0;
  const nightK = seg(t, HIT2, 2.6);
  nightReveal(L.flat, { x: d.x + 40, y: d.y }, front, (ctx) => {
    nightSky(ctx, 1, { x: d.x + 40, y: d.y });
    cloudBank(ctx, CEILING_BACK, lerp(-260, -120, nightK), t * 12);
    cloudBank(ctx, FLOOR_BACK, lerp(1360, 1220, nightK), -t * 10);
  });
  drum(L.flat, d.x + jx, d.y + jy, d.R, { hit: 0.9 * env(t, HIT1 - 0.01, HIT1, HIT1 + 0.03, HIT1 + 0.12) + env(t, HIT2 - 0.01, HIT2, HIT2 + 0.04, HIT2 + 0.16), night: 0.5 * nightK });
  drawStick(L.flat, t);
  // On the night side: a gold shock front and the drum's studs lighting up.
  if (front > 0) {
    goldShock(L.glow, { x: d.x + 40, y: d.y }, clamp(seg(t, HIT2, 2.6) * 0.98), 1750);
    drumGlow(L.glow, d.x + jx, d.y + jy, d.R, 0.8 * nightK, t);
  }
  // The second strike's impact frame: the flat picture as a grey negative, the light gone.
  if (t >= HIT2 && t < HIT2 + 0.07) negative(L);
  screen.flash = 0.18 * env(t, HIT1, HIT1 + 0.02, HIT1 + 0.04, HIT1 + 0.12) + 0.3 * env(t, HIT2 + 0.065, HIT2 + 0.07, HIT2 + 0.1, HIT2 + 0.25);
  screen.aberration = 5 * Math.max(env(t, HIT1, HIT1 + 0.02, HIT1 + 0.06, HIT1 + 0.25) * 0.6, env(t, HIT2, HIT2 + 0.02, HIT2 + 0.1, HIT2 + 0.4));
  screen.vignette = 0.45 * nightK;
}

/** An impact frame on paper: the flat layer turned to a grey negative (paper black, ink white) and the glow cleared. */
function negative(L: Layers) {
  const c = L.flat;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'saturation';
  c.fillStyle = '#808080';
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  c.globalCompositeOperation = 'difference';
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  c.restore();
  const g = L.glow;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.restore();
}

// ---------------------------------------------------------------------------------------------------------------------

const TREE_HIT = 4.62;
const TREE = lightningTree(7, { x: 1440, y: -60 }, { x: STORM_DRUM.x - 30, y: STORM_DRUM.y - STORM_DRUM.R + 30 }, 9);
const TREE2 = lightningTree(29, { x: 260, y: -60 }, { x: 520, y: 980 }, 6);

/** The tree's brightness: the first strike, then two re-strikes, then gone. */
function treeLight(t: number) {
  const strike = (a: number, h: number) => (t < a ? 0 : h * Math.exp(-(t - a) * 6));
  const base = t < TREE_HIT ? 0.8 * seg(t, 4.3, TREE_HIT) : 0.45;
  return clamp(Math.max(base, strike(TREE_HIT, 1), strike(5.15, 1), strike(5.55, 0.9)) * (1 - seg(t, 5.95, 6.3)));
}

/** In-cloud flickers before the tree. */
function flicker(t: number) {
  let k = 0;
  for (const [a, h] of [[3.25, 0.6], [3.62, 0.9], [3.9, 0.5], [4.12, 1]] as const) if (t >= a) k = Math.max(k, h * Math.exp(-(t - a) * 9));
  return k;
}

/** 2.6 to 6.4 s: clouds close in, the drum floats in the storm, the lightning tree strikes it; the camera falls in. */
function storm(L: Layers, t: number, screen: ScreenParams) {
  const d = drumAt(t);
  const fall = easeIn(seg(t, 5.95, 6.42));
  const zoom = 1 + 7 * fall;
  // The fall into the drum: both layers scaled round the drum's face.
  for (const c of [L.flat, L.glow]) {
    c.save();
    c.translate(d.x, d.y);
    c.scale(zoom, zoom);
    c.translate(-d.x, -d.y);
  }
  const light = treeLight(t), fl = flicker(t);
  const lit = Math.max(fl, t >= TREE_HIT ? light : 0);
  nightSky(L.flat, 1, { x: d.x + 40, y: d.y });
  if (lit > 0) {
    L.flat.fillStyle = `rgba(150,130,240,${0.22 * lit})`;
    L.flat.fillRect(-100, -100, 2120, 1280);
  }
  const roll = easeOut(seg(t, 2.6, 3.9));
  cloudBank(L.flat, CEILING_BACK, lerp(-120, 230, roll), t * 12, lit * 0.6);
  cloudBank(L.flat, FLOOR_BACK, lerp(1220, 860, roll), -t * 10, lit * 0.6);
  rain(L.flat, t, seg(t, 2.9, 3.6) * 0.8);
  // The tree, behind the front banks.
  const g1 = easeOut(seg(t, 4.3, TREE_HIT));
  const g2 = easeOut(seg(t, 4.72, 5.05));
  if (light > 0) {
    drawTree(L.glow, TREE, g1, light, t, 1);
    drawTree(L.glow, TREE2, g2, light * 0.85, t, 2);
  }
  cloudBank(L.flat, CEILING, lerp(-320, 120, easeOut(seg(t, 2.6, 4.0))), -t * 18, lit);
  cloudBank(L.flat, FLOOR, lerp(1420, 990, easeOut(seg(t, 2.7, 4.1))), t * 16, lit);
  // Bolts flickering inside the clouds before the tree.
  if (fl > 0.05) {
    const r = rng(Math.floor(t * 30) * 7 + 3);
    for (let i = 0; i < 2; i++) {
      const a = { x: r.range(200, 1700), y: r.range(20, 110) };
      const b = { x: a.x + r.range(-260, 260), y: a.y + r.range(40, 120) };
      boltStroke(L.glow, bolt(r, a, b, 60, 4), 1.2, fl * 0.8, 'violet');
    }
  }
  // The drum, cooled in the night; struck, it drinks the light.
  const charged = seg(t, TREE_HIT, 5.4);
  const tom = -0.6 + 1.2 * easeIn(seg(t, 5.0, 6.42)) + 0.4 * seg(t, 5.0, 6.42);
  const sh = t > TREE_HIT ? 6 * Math.exp(-(t - TREE_HIT) * 4) : 0;
  const jx = Math.sin(t * 90) * sh, jy = Math.cos(t * 77) * sh;
  drum(L.flat, d.x + jx, d.y + jy, d.R, { night: lerp(0.5, 1, smooth(seg(t, 2.6, 3.3))) * (1 - 0.4 * charged), tomoe: tom });
  drumGlow(L.glow, d.x + jx, d.y + jy, d.R, Math.max(0.8 - 0.2 * seg(t, 2.6, 3.3), charged), t, { tomoe: tom }, smooth(seg(t, 5.1, 6.2)));
  for (const c of [L.flat, L.glow]) c.restore();
  if (t >= TREE_HIT && t < TREE_HIT + 0.4) {
    // A short hot ring round the strike point on the drum.
    goldShock(L.glow, { x: STORM_DRUM.x - 30, y: STORM_DRUM.y - STORM_DRUM.R + 30 }, seg(t, TREE_HIT, TREE_HIT + 0.4), 360, '#cbb6ff');
  }
  screen.flash = 0.35 * env(t, TREE_HIT + 0.065, TREE_HIT + 0.07, TREE_HIT + 0.1, TREE_HIT + 0.25) + 0.9 * smooth(seg(t, 6.25, 6.42)) + 0.12 * fl;
  screen.invert = env(t, TREE_HIT - 0.005, TREE_HIT, TREE_HIT + 0.06, TREE_HIT + 0.07);
  screen.aberration = 1 + 5 * env(t, TREE_HIT, TREE_HIT + 0.03, TREE_HIT + 0.1, TREE_HIT + 0.5) + 6 * fall;
  screen.vignette = 0.45;
  screen.bloom = 1 + 0.3 * light;
}

// ---------------------------------------------------------------------------------------------------------------------

/** The great tomoe's turn: slow at first, ever faster. */
const spin = (t: number) => {
  const u = Math.max(0, t - 6.4);
  return -0.6 + 1.4 * u + 0.8 * u * u + 6 * easeIn(seg(t, 8.3, 9.08));
};
const tomoeR = (t: number) => 300 * easeOutBack(seg(t, 6.4, 6.9), 1.4) * (1 - 0.22 * easeInOut(seg(t, 8.3, 8.9))) * (1 - easeIn(seg(t, 8.95, 9.08)));
const hoopR = (t: number) => lerp(1300, 455, easeOut(seg(t, 6.5, 7.15))) - 90 * easeInOut(seg(t, 8.3, 8.95)) - 200 * easeIn(seg(t, 8.95, 9.1));

/** The tomoe scene's background: the night with the haze on the centre, cloud banks at top and bottom. */
function tomoeBackdrop(ctx: Ctx, t: number, k = 1) {
  nightSky(ctx, k, CENTRE);
  cloudBank(ctx, CEILING_BACK, 40, t * 40, 0.2);
  cloudBank(ctx, FLOOR_BACK, 1060, -t * 40, 0.2);
  cloudBank(ctx, CEILING, -60, -t * 70, 0.1);
  cloudBank(ctx, FLOOR, 1150, t * 70, 0.1);
}

/** 6.4 to 8.95 s: the great tomoe of lightning, spinning ever faster in a hoop of drums. */
function theTomoe(L: Layers, t: number, screen: ScreenParams) {
  tomoeBackdrop(L.flat, t);
  const R = tomoeR(t), rot = spin(t), hoop = hoopR(t), hoopRot = -0.35 * (t - 6.4) - 0.8 * easeIn(seg(t, 8.3, 8.95));
  const ringK = seg(t, 6.5, 6.8);
  drumRing(L.flat, CENTRE, hoop, hoopRot, 72, ringK);
  tomoeFlat(L.flat, CENTRE, R, rot, 1);
  drumRingGlow(L.glow, CENTRE, hoop, hoopRot, 72, ringK * seg(t, 6.9, 7.3), t);
  tomoeGlow(L.glow, CENTRE, R, rot, 0.8 + 0.2 * Math.sin(t * 20), t);
  spiralSparks(L.glow, CENTRE, t, seg(t, 6.9, 7.4), 950);
  inwardLines(L.glow, CENTRE, t, seg(t, 8.3, 8.6));
  hotStar(L.glow, CENTRE, 0.35 + 0.25 * seg(t, 8.3, 8.95), t, 0.6);
  screen.flash = 0.9 * (1 - smooth(seg(t, 6.42, 6.56)));
  screen.aberration = 1.5 + 4 * seg(t, 8.3, 8.95);
  screen.vignette = 0.5;
  screen.bloom = 1;
}

// ---------------------------------------------------------------------------------------------------------------------

/** The drum's tomoe at the end, still swaying from the blow. */
const endTomoe = (t: number) => 1.0 + 0.4 * Math.exp(-Math.max(0, t - 9.9) * 1.6) * Math.sin(t * 3);

/** The burnt paper the bolt leaves: scorch round the drum, the drum humming. */
function scorchedPaper(ctx: Ctx, t: number) {
  paper(ctx);
  ctx.save();
  pushIn(ctx, t);
  const d = PAPER_DRUM;
  const k = 1 - 0.3 * seg(t, 11.0, 13.6);
  scorch(ctx, { x: d.x + 30, y: d.y }, d.R * 1.08, k);
  specks(ctx, 77, 60, 0.85 * k, undefined, ['#1e1410', '#1d1846', '#c08a1c', '#9a95a8']);
  const shake = Math.exp(-Math.max(0, t - 9.9) * 1.6);
  hum(ctx, { x: d.x + 40, y: d.y }, d.R, t, 0.4 + 0.6 * shake);
  drum(ctx, d.x + Math.sin(t * 70) * 3 * shake, d.y + Math.cos(t * 61) * 2 * shake, d.R, { tomoe: endTomoe(t) });
  ash(ctx, t);
  ctx.restore();
}

/** The slow push in on the drum after the strike (the caller saves and restores). */
function pushIn(ctx: Ctx, t: number) {
  const z = 1 + 0.07 * smooth(seg(t, 9.8, 13.6));
  const d = PAPER_DRUM;
  ctx.translate(d.x + 40, d.y);
  ctx.scale(z, z);
  ctx.translate(-d.x - 40, -d.y);
}

/** Flakes of burnt paper and gold drifting up from round the drum (flat layer). */
function ash(ctx: Ctx, t: number) {
  const r = rng(2024);
  const u = Math.max(0, t - 9.8);
  for (let i = 0; i < 34; i++) {
    const a = r.range(0, Math.PI * 2), rad = PAPER_DRUM.R * r.range(1.1, 2.2);
    const x = PAPER_DRUM.x + 40 + Math.cos(a) * rad * 1.2 + Math.sin(u * r.range(0.8, 1.6) + i) * 14;
    const y = PAPER_DRUM.y + Math.sin(a) * rad - u * r.range(18, 46);
    const al = clamp(u * 2) * (1 - seg(t, 12.6 + r.range(0, 0.8), 13.6));
    const s = r.range(2.5, 6);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(u * r.range(-2, 2) + a);
    ctx.fillStyle = i % 3 === 0 ? `rgba(192,138,28,${0.9 * al})` : `rgba(30,20,16,${0.75 * al})`;
    ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9);
    ctx.restore();
  }
}

/** 8.95 to 10 s: the tomoe collapses to a point; the last bolt comes down and bursts out at the viewer; the paper. */
function verdict(L: Layers, t: number, screen: ScreenParams) {
  const hit = 9.13;
  const sh = t > hit ? 26 * Math.exp(-(t - hit) * 4.5) : 0;
  const sx = Math.sin(t * 97) * sh, sy = Math.cos(t * 83) * sh;
  for (const c of [L.flat, L.glow]) { c.save(); c.translate(sx, sy); }
  if (t < hit) {
    tomoeBackdrop(L.flat, t, 1 - 0.6 * seg(t, 8.95, hit));
    const R = tomoeR(t), rot = spin(t), hoop = hoopR(t), hoopRot = -0.35 * (t - 6.4) - 0.8;
    drumRing(L.flat, CENTRE, hoop, hoopRot, 72 * (1 - 0.4 * seg(t, 8.95, hit)), 1 - seg(t, 9.0, hit));
    tomoeFlat(L.flat, CENTRE, R, rot, 1);
    tomoeGlow(L.glow, CENTRE, R, rot, 1, t);
    drumRingGlow(L.glow, CENTRE, hoop, hoopRot, 72 * (1 - 0.4 * seg(t, 8.95, hit)), 1 - seg(t, 8.95, 9.08), t);
    spiralSparks(L.glow, CENTRE, t, 1 - seg(t, 8.95, 9.05), 950);
    inwardLines(L.glow, CENTRE, t, 1);
  } else {
    // After the hit: a violet-white heart fading out to the indigo.
    const glow = 1 - seg(t, hit, 9.9);
    const g = L.flat.createRadialGradient(CENTRE.x, CENTRE.y, 20, CENTRE.x, CENTRE.y, 1200);
    g.addColorStop(0, lerpColor([200, 186, 255], [40, 30, 110], 1 - glow));
    g.addColorStop(0.35, lerpColor([90, 64, 210], [24, 18, 70], 1 - glow));
    g.addColorStop(1, '#080620');
    L.flat.fillStyle = g;
    L.flat.fillRect(-100, -100, 2120, 1280);
    burstAtViewer(L.glow, CENTRE, seg(t, hit, 9.45), (1 - smooth(seg(t, 9.55, 9.95))) * (1 - easeInOut(seg(t, 9.6, 10.0))), t);
    speedLines(L.glow, CENTRE, t, env(t, hit, hit + 0.04, 9.6, 9.85));
  }
  if (t < hit) hotStar(L.glow, CENTRE, lerp(0.6, 1.2, easeIn(seg(t, 8.95, hit))), t, lerp(0.6, 1, seg(t, 8.95, hit)));
  else hotStar(L.glow, CENTRE, 1.4 * (1 - seg(t, hit, 9.5)), t, 1);
  downBolt(L.glow, CENTRE, seg(t, 9.04, hit), 1 - seg(t, 9.3, 9.5), t);
  for (const c of [L.flat, L.glow]) c.restore();
  // The paper floods back, burnt.
  const flood = easeInOut(seg(t, 9.6, 10.0));
  // The shared flood's dot grid never quite reaches the left edge: once it is nearly done, the paper whole.
  if (flood > 0.97) scorchedPaper(L.flat, t);
  else paperFlood(L.flat, flood, (ctx) => scorchedPaper(ctx, t));
  screen.invert = env(t, hit - 0.005, hit, hit + 0.09, hit + 0.1);
  screen.flash = 0.75 * env(t, hit + 0.09, hit + 0.1, hit + 0.13, hit + 0.4);
  screen.aberration = t < hit ? lerp(5.5, 10.5, seg(t, 8.95, hit)) : 1.5 + 9 * (1 - seg(t, hit + 0.2, 9.8));
  screen.vignette = 0.5 * (1 - flood);
  screen.bloom = 1.15 - 0.6 * flood;
}

function lerpColor(a: number[], b: number[], k: number) {
  return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
}

// ---------------------------------------------------------------------------------------------------------------------

/** 10 s to the end: the scorched paper, the drum humming, the seal. */
function ending(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  scorchedPaper(L.flat, t);
  const d = PAPER_DRUM;
  L.glow.save();
  pushIn(L.glow, t);
  drumGlow(L.glow, d.x, d.y, d.R, 0.5 * env(t, 10.0, 10.3, 10.5, 11.3), t, { tomoe: endTomoe(t) });
  L.glow.restore();
  seal(L.flat, 1590, 870, 180, seg(t, 12.35, 12.62), '雷', SEAL_INDIGO);
  screen.flash = 0.12 * env(t, 12.35, 12.4, 12.42, 12.6);
}

const piece: Piece = {
  id: 'raijin',
  title: 'Raijin’s Verdict',
  subtitle: 'Tenbatsu · Ten Thousand Thunders',
  about: 'The thunder god’s war drum is struck; the storm closes in, a tree of lightning strikes the drum, a great tomoe of lightning spins up and the last bolt comes down at the viewer.',
  order: 20,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '雷鼓天罰・万' },
  draw: drawFrame,
};
export default piece;
