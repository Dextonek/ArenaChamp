import type { Beat, Layers, Piece } from '../piece';
import { easeIn, easeInOut, easeOut, env, lerp, quietScreen, ribbon, rng, rgba, seg, smooth, type Ctx, type Pt, type ScreenParams } from '../core';
import { paper, seal, specks } from '../art/paper';
import { jadeTitle } from '../art/jade/title';
import {
  CUTS, JADE, STALKS, bambooPiece, clipSide, cutFace, cutSlide, drawStalk, leafShape, slicedBands, stalkOnCut, stalkSilhouette,
  windAt, windLeaves, windLines,
} from '../art/jade/grove';
import { Track, serpentFlat, serpentGlow, type SerpentPose } from '../art/jade/serpent';
import {
  cutGlint, cutSpray, darkGround, darkStalks, ensoRing, inkBleed, inkDrop, jadeSpeedLines, leafStorm, orbitLeaves, paperReturn,
  shockRing, windSlash,
} from '../art/jade/wind';

/**
 * Jade Serpent: Fujin, the Bamboo Cut. A bamboo grove brushed in sumi ink; the wind rises and a jade serpent glides
 * through the stalks; three wind blades cut the grove; in the green-black dark the serpent coils into a spiral of jade
 * light and lifts its head, and the coil lets go as a storm of leaves at the viewer; back on the paper the cut bamboo
 * falls, green ink drops, and the seal 蛇 is stamped.
 */

const DURATION = 13.6;

const BEATS: Beat[] = [
  { name: 'The grove', t0: 0, t1: 1.5 },
  { name: 'The wind', t0: 1.5, t1: 3.2 },
  { name: 'The serpent', t0: 3.2, t1: 5.4 },
  { name: 'Three cuts', t0: 5.4, t1: 6.95 },
  { name: 'The coil', t0: 6.95, t1: 9.45 },
  { name: 'The release', t0: 9.45, t1: 10.6 },
  { name: 'Fallen bamboo', t0: 10.6, t1: 12.4 },
  { name: 'The seal', t0: 12.4, t1: DURATION },
];

/** The serpent's path through the grove: in from the lower left, weaving, and up out of the top right. */
const GLIDE = Track.of((u) => ({
  x: lerp(-650, 2250, u),
  y: 800 - 160 * u + 120 * Math.sin(u * 8.2 + 0.2) + 30 * Math.sin(u * 19) - 3200 * Math.max(0, u - 0.72) ** 2,
}));

/** The coil's centre, on the dark ground. */
const C: Pt = { x: 890, y: 700 };
const FY = 0.56;

/** The coil's path: down from above the frame, one and three quarter turns inwards, then the neck rising in an S. */
const COIL = (() => {
  const pts: Pt[] = [];
  const R0 = 700, R1 = 170, turns = 1.75, a0 = 0;
  // The tail end comes in on a wide arc from outside the frame, then the turns close in.
  for (let i = 0; i <= 200; i++) {
    const u = i / 200, a = lerp(-1.3 * Math.PI, 0, u), r = lerp(1600, R0, smooth(u));
    pts.push({ x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r * FY });
  }
  for (let i = 1; i <= 900; i++) {
    const u = i / 900, a = a0 + u * turns * Math.PI * 2, r = lerp(R0, R1, u);
    pts.push({ x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r * FY });
  }
  // The neck: it curls up off the inner ring, rises, and bends over so the head looks out to the right.
  let { x, y } = pts[pts.length - 1];
  const RISE = 560;
  for (let i = 1; i <= 80; i++) {
    const u = i / 80;
    const a = -Math.PI / 2 * smooth(seg(u, 0, 0.32)) + (Math.PI / 2 - 0.08) * smooth(seg(u, 0.5, 0.92));
    x += Math.cos(a) * RISE / 80;
    y += Math.sin(a) * RISE / 80;
    pts.push({ x, y });
  }
  return new Track(pts);
})();

/** Draws the frame at time `t` into both layers and says what the screen pass should do. */
function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < 6.95) paperBeats(L, t, screen);
  else if (t < 9.45) coilBeat(L, t, screen);
  else if (t < 10.6) release(L, t, screen);
  else ending(L, t, screen);
  // The title stays from the grove to the first cut.
  jadeTitle(L.flat, seg(t, 0.12, 0.45) * (1 - seg(t, 5.47, 5.62)), false);
  return screen;
}

/** When each stalk is brushed in, and its leaves. */
const growOf = (born: number, t: number) => easeOut(seg(t, born * 1.2, born * 1.2 + 0.62));
const leavesOf = (born: number, t: number) => seg(t, born * 1.2 + 0.4, born * 1.2 + 1.0);

/** The serpent gliding through the grove. */
function glidePose(t: number): SerpentPose {
  const u = seg(t, 3.15, 5.5);
  const k = u + 0.07 * Math.sin(Math.PI * 2 * u);
  return { track: GLIDE, head: lerp(700, 4500, k), length: 1700, width: 82, flip: 1, t, light: 0.75 };
}

/** 0 to 6.95 s: the grove on the paper, the wind, the serpent, the three cuts, and the ink bleeding out of them. */
function paperBeats(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  paper(L.flat);
  // From the first cut on, the grove holds still (only the cut pieces move).
  const tb = Math.min(t, CUTS[0].t);
  const bend = windAt(tb);
  const wind = seg(t, 1.5, 2.3) * (1 - 0.5 * seg(t, 5.4, 6.0));
  // The camera shakes at each cut.
  let sx = 0, sy = 0;
  for (const c of CUTS) {
    const a = t - c.t;
    if (a <= 0 || a > 0.3) continue;
    const r = rng(Math.floor(t * 60) + Math.round(c.y));
    const amp = 16 * (1 - a / 0.3);
    sx += r.range(-amp, amp);
    sy += r.range(-amp, amp);
  }
  for (const ctx of [L.flat, L.glow]) {
    ctx.save();
    ctx.translate(sx, sy);
  }
  const stalks = (ctx: Ctx, band: number, pick: (s: (typeof STALKS)[number]) => boolean) => {
    for (const s of STALKS) {
      if (!pick(s)) continue;
      drawStalk(ctx, s, bend, tb, growOf(s.born, t), leavesOf(s.born, t));
      // The pale face where this stalk was cut, on the piece below the cut.
      if (band > 0 && t >= CUTS[band - 1].t) {
        const c = CUTS[band - 1];
        cutFace(ctx, stalkOnCut(s, c, bend, tb), s.w, c.a, s.tone === 0 ? 0.5 : 1);
      }
    }
  };
  slicedBands(L.flat, t, (ctx, band) => stalks(ctx, band, (s) => s.tone < 2));
  windLines(L.flat, t, wind);
  slicedBands(L.flat, t, (ctx, band) => stalks(ctx, band, (s) => s.tone === 2 && !s.front));
  // The serpent passes through; it is gone in the first cut's impact frame.
  if (t > 3.1 && t < CUTS[0].t + 0.05) {
    const pose = glidePose(t);
    serpentFlat(L.flat, pose);
    serpentGlow(L.glow, pose);
  }
  slicedBands(L.flat, t, (ctx, band) => stalks(ctx, band, (s) => s.front));
  // The near stalks in front hide the serpent's light behind them.
  L.glow.save();
  L.glow.globalCompositeOperation = 'destination-out';
  L.glow.fillStyle = '#000';
  for (const s of STALKS) if (s.front) stalkSilhouette(L.glow, s, bend, tb);
  L.glow.restore();
  windLeaves(L.flat, t, wind);
  // The three cuts.
  for (const c of CUTS) {
    windSlash(L.flat, L.glow, c, seg(t, c.t - 0.07, c.t + 0.02), seg(t, c.t + 0.06, c.t + 0.42));
    cutGlint(L.glow, c, env(t, c.t + 0.02, c.t + 0.06, c.t + 0.35, c.t + 0.9) * (1 - seg(t, 6.6, 6.9)), cutSlide(c, t));
    cutSpray(L.flat, c, t);
    screen.invert = Math.max(screen.invert, env(t, c.t + 0.03, c.t + 0.031, c.t + 0.075, c.t + 0.076));
    screen.flash = Math.max(screen.flash, 0.3 * env(t, c.t, c.t + 0.02, c.t + 0.03, c.t + 0.08));
    screen.aberration = Math.max(screen.aberration, 6 * env(t, c.t, c.t + 0.03, c.t + 0.1, c.t + 0.3));
  }
  // The ink bleeds out of the cuts and floods the paper green-black.
  const bleed = seg(t, 6.5, 6.95);
  inkBleed(L.flat, bleed);
  for (const ctx of [L.flat, L.glow]) ctx.restore();
  screen.vignette = 0.5 * bleed;
}

/** The serpent coiling: its head travels inwards along the spiral and rises in the middle. */
function coilPose(t: number): SerpentPose {
  const go = easeOut(seg(t, 6.85, 8.75));
  const draw = easeIn(seg(t, 9.15, 9.45));
  return {
    track: COIL, head: lerp(COIL.total - 2700, COIL.total, go) - 40 * draw, length: 4200, width: 92, flip: 1, t, neck: 0.16, belly: 0.45,
    light: 0.6 + 0.3 * seg(t, 7.4, 8.4) + 0.4 * seg(t, 9.0, 9.45),
    aura: smooth(seg(t, 7.2, 8.2)) * (0.6 + 0.4 * seg(t, 9.0, 9.45)),
    glint: env(t, 8.72, 8.82, 8.98, 9.3),
  };
}

/** 6.95 to 9.45 s: the green-black dark; the serpent coils into a spiral of jade light; its head rises; the gold glint. */
function coilBeat(L: Layers, t: number, screen: ScreenParams) {
  darkGround(L.flat, C);
  const zoom = 1 + 0.05 * smooth(seg(t, 6.95, 9.2)) + 0.05 * easeIn(seg(t, 9.15, 9.45));
  for (const ctx of [L.flat, L.glow]) {
    ctx.save();
    ctx.translate(C.x, C.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-C.x, -C.y);
  }
  const light = seg(t, 6.95, 7.4);
  darkStalks(L.flat, L.glow, t, light);
  ensoRing(L.glow, { x: C.x, y: C.y + 40 }, 900, 420, easeInOut(seg(t, 7.3, 8.3)), 0.9 + 0.3 * seg(t, 9.0, 9.45), t);
  const gust = seg(t, 8.8, 9.45);
  // The leaves' phase: time, plus the gust's speed-up integrated (speed 1 + 2 * gust^3 over 0.65 s).
  orbitLeaves(L.glow, C, t, seg(t, 7.1, 7.8), t + 0.325 * gust ** 4, gust);
  const pose = coilPose(t);
  serpentFlat(L.flat, pose);
  serpentGlow(L.glow, pose);
  for (const ctx of [L.flat, L.glow]) ctx.restore();
  // The ink's last edges clearing as the dark begins.
  const clear = 1 - seg(t, 6.95, 7.15);
  if (clear > 0) {
    L.flat.fillStyle = rgba(JADE.ground, clear);
    L.flat.fillRect(0, 0, 1920, 1080);
  }
  screen.vignette = 0.55;
  screen.bloom = 0.9 + 0.4 * seg(t, 9.0, 9.45);
  screen.aberration = 1.2 + 4 * seg(t, 9.15, 9.45);
}

/** Where the storm comes from. */
const STORM: Pt = { x: C.x, y: C.y - 60 };

/**
 * 9.45 to 10.6 s: the coil lets go: a white frame, an impact frame, a ring of wind, speed lines and a storm of jade leaves
 * at the viewer; the paper comes back from the middle out in dots.
 */
function release(L: Layers, t: number, screen: ScreenParams) {
  const age = t - 9.45;
  darkGround(L.flat, C);
  // The serpent is gone in the flash; for a moment its shape stays as a dark ghost.
  const ghost = 1 - seg(t, 9.45, 9.62);
  if (ghost > 0) serpentFlat(L.flat, { ...coilPose(9.45), alpha: ghost });
  paperReturn(L.flat, STORM, easeInOut(seg(t, 9.9, 10.55)), (ctx) => {
    paper(ctx);
    endingScene(ctx, t);
  });
  L.glow.save();
  L.glow.globalAlpha = 1 - seg(t, 10.2, 10.6);
  shockRing(L.glow, STORM, seg(t, 9.46, 10.0), 0.8);
  jadeSpeedLines(L.glow, STORM, t, env(t, 9.47, 9.52, 9.85, 10.2));
  leafStorm(L.glow, STORM, age, 1);
  L.glow.restore();
  screen.flash = 0.92 * env(t, 9.45, 9.46, 9.5, 9.54);
  screen.invert = env(t, 9.53, 9.531, 9.57, 9.571);
  screen.bloom = 1.4 - 0.6 * seg(t, 9.9, 10.5);
  screen.aberration = 8 * env(t, 9.45, 9.5, 9.6, 10.0) + 1;
  screen.vignette = 0.5 * (1 - seg(t, 9.9, 10.5));
}

/** The pieces of the grove's upper bands, falling back onto the paper: [x, rest y, rest angle, length, width, falls at, turns]. */
const PIECES: [number, number, number, number, number, number, number][] = [
  [965, 1022, -0.04, 330, 48, 10.32, 1.1],
  [1365, 1036, 0.06, 200, 42, 10.48, -0.8],
  [612, 968, -1.12, 230, 44, 10.4, 0.6],
  [1668, 1040, 0.1, 160, 38, 10.62, 1.4],
];

/** The paper side at the end: the stumps of the grove, the cut pieces falling and settling, drifting leaves, green ink. */
function endingScene(ctx: Ctx, t: number) {
  const bend = windAt(CUTS[0].t);
  const last = CUTS[2];
  // A faint wash of the far grove, as if seen through mist.
  ctx.save();
  ctx.globalAlpha = 0.3;
  for (const s of STALKS) if (s.tone === 0) drawStalk(ctx, s, bend * 0.4, t, 1, 1);
  ctx.restore();
  // The stumps of the near stalks: everything below the last cut stayed where it was.
  ctx.save();
  clipSide(ctx, last, 1);
  for (const s of STALKS) if (s.tone === 2) drawStalk(ctx, s, bend, CUTS[0].t, 1, 0);
  ctx.restore();
  for (const s of STALKS) if (s.tone === 2) cutFace(ctx, stalkOnCut(s, last, bend, CUTS[0].t), s.w, last.a);
  // The ground: the stumps' feet fade into a grey ink wash.
  const g = ctx.createLinearGradient(0, 930, 0, 1080);
  g.addColorStop(0, 'rgba(235,232,226,0)');
  g.addColorStop(1, 'rgba(228,226,219,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 930, 1920, 150);
  const gr = rng(4545);
  for (let i = 0; i < 5; i++) {
    const y = gr.range(1010, 1060), x0 = gr.range(-100, 700), len = gr.range(700, 1300);
    ctx.fillStyle = rgba('#8d8f88', gr.range(0.12, 0.22));
    ribbon(ctx, [{ x: x0, y }, { x: x0 + len / 2, y: y - 6 }, { x: x0 + len, y: y + 2 }], (u) => gr.range(6, 14) * Math.sin(Math.PI * u) ** 0.5);
  }
  // Green ink drops land.
  inkDrop(ctx, 790, 640, 30, seg(t, 10.75, 11.4), 51);
  inkDrop(ctx, 1140, 470, 15, seg(t, 11.05, 11.6), 52);
  inkDrop(ctx, 420, 430, 11, seg(t, 11.35, 11.8), 53, JADE.mid);
  // The cut pieces fall and settle, with a small bounce.
  for (const [x, y, a, len, w, tf, turns] of PIECES) {
    const k = seg(t, tf, tf + 0.5);
    if (k <= 0) continue;
    const after = Math.max(0, t - tf - 0.5);
    const bounce = 26 * Math.exp(-after * 7) * Math.abs(Math.sin(after * 15));
    const py = lerp(-180, y, k * k) - bounce;
    const ang = lerp(a + turns * Math.PI, a, easeOut(k)) + 0.05 * Math.exp(-after * 6) * Math.sin(after * 18);
    if (Math.abs(a) < 0.5) {
      // A soft grey shadow on the paper under a piece that lies down.
      ctx.fillStyle = rgba('#6e706a', 0.2 * k * k);
      ctx.beginPath();
      ctx.ellipse(x, y + w * 0.55, len * 0.52, 8, a, 0, Math.PI * 2);
      ctx.fill();
    }
    bambooPiece(ctx, x, py, ang, len, w, 0.6);
  }
  // Leaves drifting down.
  const r = rng(1414);
  for (let i = 0; i < 9; i++) {
    const t0 = r.range(10.2, 12.2), x0 = r.range(200, 1750), fall = r.range(90, 150), len = r.range(60, 100);
    const age = t - t0;
    if (age < 0) continue;
    const y = -80 + age * fall;
    if (y > 990) continue;
    const x = x0 + 70 * Math.sin(age * 1.6 + i);
    ctx.fillStyle = rgba(r.next() < 0.45 ? JADE.ink : '#1c201d', 0.88);
    leafShape(ctx, x, y, 0.4 * Math.sin(age * 1.6 + i) + 0.5 + i, len, len * 0.17 * (0.4 + 0.6 * Math.abs(Math.cos(age * 2 + i))), 0.12);
  }
  specks(ctx, 29, 30, 0.7, { x: 0, y: 0, w: 1920, h: 1000 }, [JADE.ink, '#1b1f1c', '#9a9a92']);
}

/** 10.6 s to the end: the paper, the settled grove, and the seal. */
function ending(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  paper(L.flat);
  endingScene(L.flat, t);
  seal(L.flat, 1560, 420, 190, seg(t, 12.55, 12.85), '蛇', '#1d5a3a');
  screen.flash = 0.1 * env(t, 12.55, 12.6, 12.62, 12.8);
}

const piece: Piece = {
  id: 'jade',
  title: 'Jade Serpent',
  subtitle: 'Fujin · The Bamboo Cut',
  about: 'A jade serpent glides through a bamboo grove brushed in ink; three blades of wind cut the grove, it coils into a spiral of jade light in the dark and lets go as a storm of leaves.',
  order: 50,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '翠蛇風刃・竹斬' },
  draw: drawFrame,
};
export default piece;
