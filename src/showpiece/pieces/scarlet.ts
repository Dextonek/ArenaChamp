import type { Beat, Layers, Piece } from '../piece';
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, env, lerp, quietScreen, seg, smooth, type Ctx, type Pt, type ScreenParams } from '../core';
import { BLADE, bareSword, katana, scabbard, type Pose } from '../art/katana';
import { paper, seal, specks, titleCard } from '../art/paper';
import {
  RIFT, embers, lensPath, riftBackdrop, riftInside, riftLightning, riftRims, riftSpikes, riftWhiteHot, shards, type RiftShape,
} from '../art/rift';
import { eyeFlat, eyeGlow } from '../art/eye';
import { eye3d, loadEye } from '../art/eye3d';

/** `?eye=2d` shows the drawn eye instead of the 3D one. */
const DRAWN_EYE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('eye') === '2d';
import { darkBurst, inkSwirl, paintedSun, sparks, starFlare, sunFlat, sunGlow } from '../art/sun';
import { clickRing, cutLine, inkRemnants, paperFlood, redStrokes, slashStreak, speedLines, swingTrail } from '../art/ink';

/**
 * Scarlet Sheath: Issen, World Sever. The sequence, beat by beat, as a pure function of time.
 *
 * The beats follow the user's reference clip (2026-11-18): the sword on paper, the draw that bursts into sparks and a red
 * sun, one cut that tears the screen open into a burning eye, the eye's pupil turning into a hole, a second cut that
 * shatters it back to paper, the sword sheathed, and the seal.
 */

const DURATION = 14.6;

const BEATS: Beat[] = [
  { name: 'The sword', t0: 0, t1: 0.35 },
  { name: 'The draw', t0: 0.35, t1: 1.22 },
  { name: 'The red sun', t0: 1.22, t1: 3.0 },
  { name: 'The cut', t0: 3.0, t1: 4.1 },
  { name: 'The rift', t0: 4.1, t1: 5.0 },
  { name: 'The eye', t0: 5.0, t1: 7.6 },
  { name: 'The hole', t0: 7.6, t1: 9.2 },
  { name: 'The second cut', t0: 9.2, t1: 10.45 },
  { name: 'Sheathed', t0: 10.45, t1: 12.6 },
  { name: 'The seal', t0: 12.6, t1: DURATION },
];

/** The sword standing on the paper at the start and at the end. */
const STANDING: Pose = { x: 894, y: 369, angle: 1.21, scale: 0.85 };
/** Lying across the frame for the draw: the scabbard to the lower left, the hilt to the upper right, its mouth by the sun. */
const DRAW: Pose = { x: 470, y: 482, angle: 2.62, scale: 0.95 };
/** The scabbard lying on the paper while the bare sword comes back to it. */
const REST: Pose = { x: 760, y: 742, angle: 2.81, scale: 0.9 };
/** Close on the sheathed sword before it stands up again. */
const CLOSE: Pose = { x: 1180, y: 520, angle: 2.85, scale: 1.55 };

/** The cut's line: the same slash the rift opens along. */
const CUT: Pt = { x: RIFT.cx, y: RIFT.cy };


const lerpPose = (a: Pose, b: Pose, k: number): Pose => ({
  x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), angle: lerp(a.angle, b.angle, k), scale: lerp(a.scale, b.scale, k),
});

/** Draws the frame at time `t` into both layers and says what the screen pass should do. */
function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < 1.22) theDraw(L, t, screen);
  else if (t < 3.0) theSun(L, t, screen);
  else if (t < 4.1) theCut(L, t, screen);
  else if (t < 9.2) eyeBeats(L, t, screen);
  else if (t < 10.45) secondCut(L, t, screen);
  else if (t < 12.6) sheathing(L, t, screen);
  else ending(L, t, screen);
  // The title stays through the draw and the sun, and goes with the cut. On the glow layer it is opaque, so it covers.
  titleCard(L.glow, 1 - seg(t, 3.15, 3.45), t >= 1.1);
  return screen;
}

/** The point where the blade leaves the scabbard. */
const mouth = (p: Pose): Pt => ({ x: p.x, y: p.y });

/** 0 to 1.22 s: the sword on the paper; ink wheels in, the sword swings down to lie across, the red sun is painted. */
function theDraw(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  paper(L.flat);
  const swing = easeInOut(seg(t, 0.32, 0.86));
  const breathe = Math.sin(t * 2.4) * 0.008 * (1 - swing);
  const pose = lerpPose({ ...STANDING, angle: STANDING.angle + breathe }, DRAW, swing);
  inkSwirl(L.flat, t, seg(t, 0.3, 0.95));
  paintedSun(L.flat, smooth(seg(t, 0.62, 1.0)), easeOut(seg(t, 0.6, 1.02)));
  katana(L.flat, pose, { sway: Math.sin(t * 3) * 0.3 + swing * 0.8, drawn: 60 * easeOut(seg(t, 0.82, 1.05)) });
  const burst = seg(t, 1.0, 1.2);
  darkBurst(L.flat, burst, t);
  sunGlow(L.glow, burst, 1, 0);
  starFlare(L.glow, mouth(pose), smooth(seg(t, 0.78, 1.0)) * 0.7, t);
  sparks(L.glow, t, seg(t, 0.95, 1.2) * 0.8, mouth(pose));
  screen.flash = 0.12 * env(t, 1.0, 1.04, 1.06, 1.14);
}

/** 1.22 to 3.0 s: the dark; the red sun burning, sparks wheeling round it, the star at the sword's mouth. */
function theSun(L: Layers, t: number, screen: ScreenParams) {
  L.flat.fillStyle = '#0b0607';
  L.flat.fillRect(0, 0, 1920, 1080);
  const swell = 1 + 0.04 * seg(t, 1.22, 3.0);
  sunFlat(L.flat, 1, swell);
  katana(L.flat, DRAW, { drawn: 60 + 40 * seg(t, 2.4, 3.0), sway: Math.sin(t * 4) * 0.4 });
  sunGlow(L.glow, 1, swell, 0);
  sparks(L.glow, t, 1, mouth(DRAW));
  const pulse = 0.75 + 0.25 * Math.sin(t * 9) + 0.4 * seg(t, 2.5, 3.0);
  starFlare(L.glow, mouth(DRAW), pulse, t);
  embers(L.glow, t, 0.6, 9, 40);
  screen.vignette = 0.4;
  screen.aberration = 1.5 + 3 * seg(t, 2.6, 3.0);
}

/**
 * 3.0 to 4.1 s: one stroke crosses the sun; a frame of white; the sun burns out and leaves only the cut, a thin line of
 * light on the dark, which then cracks.
 */
function theCut(L: Layers, t: number, screen: ScreenParams) {
  L.flat.fillStyle = '#0b0607';
  L.flat.fillRect(0, 0, 1920, 1080);
  const gone = easeIn(seg(t, 3.18, 3.6));
  const big = 1.06 + 0.12 * easeOut(seg(t, 3.0, 3.2));
  sunFlat(L.flat, 1 - gone, big);
  // The sword is pulled away down to the left as it is drawn.
  const away = easeIn(seg(t, 3.0, 3.5));
  katana(L.flat, { ...DRAW, x: DRAW.x - 520 * away, y: DRAW.y + 420 * away }, { drawn: 100 + 300 * away });
  sunGlow(L.glow, 1 - gone, big, 1 - seg(t, 3.0, 3.3));
  slashStreak(L.glow, CUT, RIFT.angle, seg(t, 3.0, 3.09), seg(t, 3.2, 3.5), 1.3);
  cutLine(L.glow, CUT, RIFT.angle, seg(t, 3.08, 3.2) * (0.85 + 0.15 * Math.sin(t * 30)), 1);
  // The crack: shards along the line and a warm haze, just before it tears open.
  const crack = seg(t, 3.9, 4.1);
  if (crack > 0) {
    const g = L.glow.createRadialGradient(CUT.x, CUT.y, 0, CUT.x, CUT.y, 700);
    g.addColorStop(0, `rgba(255,110,40,${0.35 * crack})`);
    g.addColorStop(1, 'rgba(255,80,20,0)');
    L.glow.fillStyle = g;
    L.glow.fillRect(0, 0, 1920, 1080);
    shards(L.glow, t, crack, 41, 46, { x: CUT.x, y: CUT.y, t0: 3.9 });
  }
  screen.invert = env(t, 3.085, 3.09, 3.13, 3.135);
  screen.flash = 0.5 * env(t, 3.0, 3.06, 3.09, 3.2);
  screen.aberration = 8 * env(t, 3.0, 3.05, 3.15, 3.4) + 1;
  screen.vignette = 0.45;
}

/**
 * 4.1 to 9.2 s: the tear bursts open white-hot, settles to burning edges, the eye looks out, blinks, and its pupil becomes
 * a hole. `glowK` fades every glowing part (for the way back to paper).
 */
function eyeBeats(L: Layers, t: number, screen: ScreenParams, glowK = 1) {
  const opening = easeOut(seg(t, 4.1, 4.75));
  const whiteHot = 1 - seg(t, 4.25, 4.95);
  const rift: RiftShape = { ...RIFT, open: lerp(6, RIFT.open, opening) * (1 + 0.012 * Math.sin(t * 3)) };
  const blink = 1 - env(t, 7.08, 7.22, 7.3, 7.55);
  const eye = {
    x: 925, y: 470, angle: -0.24, scale: 1.08 + 0.04 * seg(t, 5, 9.2),
    open: easeOut(seg(t, 4.6, 5.3)) * blink,
    dilate: easeInOut(seg(t, 7.6, 8.05)),
    vortex: smooth(seg(t, 7.8, 8.3)),
    look: -0.5 - 0.25 * smooth(seg(t, 5.6, 6.2)) + 0.25 * smooth(seg(t, 6.6, 7.0)) + 0.75 * smooth(seg(t, 7.5, 8.0)),
    t,
    alpha: smooth(seg(t, 4.55, 5.1)),
  };
  // The camera leans in on the eye as its pupil opens.
  const zoom = 1 + 0.42 * easeInOut(seg(t, 7.6, 8.5)) + 0.05 * seg(t, 8.5, 9.4);
  for (const c of [L.flat, L.glow]) {
    c.save();
    c.translate(eye.x, eye.y);
    c.scale(zoom, zoom);
    c.translate(-eye.x, -eye.y);
  }
  riftBackdrop(L.flat, rift, 0.4 + 0.6 * opening);
  riftInside(L.flat, rift, t, 1);
  if (DRAWN_EYE) {
    L.flat.save();
    lensClip(L.flat, rift, t);
    eyeFlat(L.flat, eye);
    L.flat.restore();
  } else {
    // The 3D eye, clipped to the tear on both layers (its glow too).
    for (const c of [L.flat, L.glow]) {
      c.save();
      lensClip(c, rift, t);
    }
    eye3d(L, { ...eye, alpha: eye.alpha * (glowK > 0 ? 1 : 1) });
    for (const c of [L.flat, L.glow]) c.restore();
  }
  if (glowK > 0) {
    L.glow.save();
    lensClip(L.glow, rift, t);
    if (DRAWN_EYE) eyeGlow(L.glow, { ...eye, alpha: eye.alpha * glowK });
    L.glow.restore();
    riftWhiteHot(L.glow, rift, t, whiteHot * 0.95 * glowK);
    riftSpikes(L.glow, rift, t, seg(t, 4.1, 4.35), seg(t, 4.5, 5.0));
    riftRims(L.glow, rift, t, glowK, whiteHot * 0.9);
    riftLightning(L.glow, rift, t, (0.6 + 0.4 * opening) * glowK);
  }
  for (const c of [L.flat, L.glow]) c.restore();
  embers(L.glow, t, 0.8 * glowK, 5, 60);
  shards(L.glow, t, clamp(1.2 - seg(t, 5.5, 7)) * glowK, 41, 46, { x: CUT.x, y: CUT.y, t0: 3.9 });
  shards(L.glow, t, 0.9 * glowK, 42, 14);
  screen.bloom = 1 + whiteHot * 0.8;
  screen.flash = 0.6 * (1 - seg(t, 4.1, 4.3));
  screen.aberration = 6 * whiteHot + 1.5;
  screen.vignette = 0.45;
}

/** Clips to the rift's lens, a little inside its burning edge. */
function lensClip(ctx: Ctx, rift: RiftShape, t: number) {
  lensPath(ctx, { ...rift, open: rift.open * 0.97 }, t);
  ctx.clip();
}

/**
 * 9.2 to 10.45 s: a second stroke crosses the eye; the frame splits along it with white speed lines; then the paper floods
 * back in as halftone dots and the bare sword falls through.
 */
function secondCut(L: Layers, t: number, screen: ScreenParams) {
  const flood = easeInOut(seg(t, 9.75, 10.45));
  const split = easeOut(seg(t, 9.24, 9.5)) * 22;
  const ax = Math.cos(RIFT.angle), ay = Math.sin(RIFT.angle), nx = -ay, ny = ax;
  const c = { x: CUT.x - nx * 20, y: CUT.y - ny * 20 };
  // The eye's frame as two halves sliding apart along the cut.
  for (const side of [-1, 1]) {
    for (const ctx of [L.flat, L.glow]) {
      ctx.save();
      ctx.beginPath();
      const far = 3000;
      ctx.moveTo(c.x - ax * far, c.y - ay * far);
      ctx.lineTo(c.x + ax * far, c.y + ay * far);
      ctx.lineTo(c.x + ax * far + nx * side * far, c.y + ay * far + ny * side * far);
      ctx.lineTo(c.x - ax * far + nx * side * far, c.y - ay * far + ny * side * far);
      ctx.closePath();
      ctx.clip();
      ctx.translate(ax * split * side * 0.6 + nx * split * side, ay * split * side * 0.6 + ny * split * side);
    }
    eyeBeats(L, Math.min(t, 9.35), screen, 1 - smooth(seg(t, 9.72, 10.05)));
    for (const ctx of [L.flat, L.glow]) ctx.restore();
  }
  slashStreak(L.glow, c, RIFT.angle, seg(t, 9.2, 9.27), seg(t, 9.35, 9.7), 1.1);
  cutLine(L.glow, c, RIFT.angle, env(t, 9.25, 9.3, 9.7, 9.85), 1.4);
  speedLines(L.glow, { x: 925, y: 470 }, t, env(t, 9.24, 9.3, 9.6, 9.8));
  // Back to paper.
  paperFlood(L.flat, flood, (ctx) => {
    paper(ctx);
    redStrokes(ctx, seg(t, 9.85, 10.3), t);
  });
  inkRemnants(L.flat, env(t, 9.8, 10.0, 10.2, 10.9) * flood);
  // The bare sword falls through, turning.
  if (t > 9.85) swingSword(L, t);
  screen.flash = 0.55 * env(t, 9.2, 9.23, 9.26, 9.34);
  screen.invert = env(t, 9.255, 9.26, 9.29, 9.295);
  screen.aberration = 6 * env(t, 9.2, 9.25, 9.4, 9.8) + 1;
  screen.vignette = 0.45 * (1 - flood);
  screen.bloom = 1 - 0.5 * flood;
}

/** Where the bare sword's guard must be so that its blade points into the scabbard's mouth, tip first. */
const LINE_UP = { x: REST.x - Math.cos(REST.angle) * BLADE * REST.scale, y: REST.y - Math.sin(REST.angle) * BLADE * REST.scale };

/** The bare sword's path: it falls in from the top right and swings round to point at the scabbard's mouth. */
function swordPath(t: number): Pose {
  const k = easeInOut(seg(t, 9.85, 10.95));
  return {
    x: lerp(1060, LINE_UP.x, k) + Math.sin(k * Math.PI) * 120,
    y: lerp(-80, LINE_UP.y, k) + Math.sin(k * Math.PI) * 80,
    angle: lerp(1.25, REST.angle, easeOutBack(k, 1.2)),
    scale: REST.scale,
  };
}

function swingSword(L: Layers, t: number) {
  const pose = swordPath(t);
  // The red trail: where the tip has been over the last fifth of a second.
  const trail: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const p = swordPath(Math.max(9.85, t - 0.2 + (0.2 * i) / 12));
    trail.push({ x: p.x + Math.cos(p.angle) * BLADE * p.scale, y: p.y + Math.sin(p.angle) * BLADE * p.scale });
  }
  swingTrail(L.flat, trail, 1 - seg(t, 10.8, 11.0));
  bareSword(L.flat, pose);
}

/**
 * 10.45 to 12.6 s: the paper again; red strokes where the cut went; the bare sword swings round and slides home into its
 * scabbard; a flash along the line, the ring of it clicking home, and the camera closes on the sheathed sword.
 */
function sheathing(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  paper(L.flat);
  redStrokes(L.flat, 1 - 0.7 * seg(t, 11.6, 12.2), t);
  specks(L.flat, 21, 70, 0.9 * (1 - 0.5 * seg(t, 11.8, 12.6)));
  inkRemnants(L.flat, env(t, 9.8, 10.0, 10.2, 10.9));
  const home = easeIn(seg(t, 10.95, 11.32));
  const close = easeInOut(seg(t, 11.72, 12.15));
  const pose = lerpPose(REST, { ...CLOSE, angle: CLOSE.angle + 0.03 * Math.sin(t * 2) }, close);
  if (t < 10.95) {
    scabbard(L.flat, REST, { sway: Math.sin(t * 3) * 0.4 });
    swingSword(L, t);
  } else {
    // Sliding home: in the scabbard's frame the guard is BLADE units back from the mouth, and comes to it.
    katana(L.flat, pose, { drawn: BLADE * (1 - home), sway: Math.sin(t * 2.5) * 0.4, glint: seg(t, 11.32, 11.7) * 1.2 - 0.1 });
  }
  // The flash along the line as it clicks home, and the ring.
  const flare = env(t, 11.3, 11.36, 11.45, 11.7);
  if (flare > 0) slashStreak(L.glow, { x: REST.x - 300 * Math.cos(REST.angle), y: REST.y - 300 * Math.sin(REST.angle) }, REST.angle + Math.PI, 1, 1 - flare, 1.4);
  clickRing(L.flat, { x: REST.x, y: REST.y }, seg(t, 11.36, 11.95));
  screen.flash = 0.2 * env(t, 11.3, 11.34, 11.38, 11.5);
}

/** 12.6 s to the end: the sword stands upright again and the seal is stamped. */
function ending(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  paper(L.flat);
  const up = easeInOut(seg(t, 12.6, 13.0));
  const pose = lerpPose({ ...CLOSE, angle: CLOSE.angle + 0.03 * Math.sin(t * 2) }, STANDING, up);
  pose.angle = lerp(CLOSE.angle + 0.03 * Math.sin(t * 2), STANDING.angle + 0.06 * (1 - seg(t, 13.0, 13.4)), up);
  katana(L.flat, pose, { sway: Math.sin(t * 2.2) * 0.35 * (1 - seg(t, 13, 14.6)) });
  specks(L.flat, 8, 26, 0.9 * (1 - 0.4 * seg(t, 12.6, 14.6)));
  seal(L.flat, 1285, 700, 210, seg(t, 13.15, 13.45));
  screen.flash = 0.12 * env(t, 13.15, 13.2, 13.22, 13.4);
}

const piece: Piece = {
  id: 'scarlet',
  title: 'Scarlet Sheath',
  subtitle: 'Issen · World Sever',
  about: 'A katana on paper is drawn, cuts the world open onto a burning eye, and is sheathed again. After the user’s reference clip.',
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '緋鞘一閃・斷界封' },
  preload: () => loadEye(),
  draw: drawFrame,
};
export default piece;
