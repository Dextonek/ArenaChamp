import type { Beat, Layers, Piece } from '../piece';
import { clamp, easeIn, easeInOut, easeOut, env, lerp, quietScreen, seg, smooth, type Pt, type ScreenParams } from '../core';
import { seal, titleCard, type TitleText } from '../art/paper';
import { POOL, PRUSSIAN, blueSpecks, cam, creamPaper, crown, drop, inkRings, pool, uncam } from '../art/tide/common';
import { SEA_Y, waveFlat, waveGlow, wavePath, waveShape } from '../art/tide/wave';
import { moonFlat, moonGlow, nightFall, stars, type MoonLook } from '../art/tide/moon';
import { rimSpray, seaSurface, whirlFlat, whirlGlow, type Whirl } from '../art/tide/whirl';
import { dragon, headFrame, type DragonPose } from '../art/tide/dragon';
import { flyingDrops, splash, wallMask, wallOfWater, waterLines, wetHalftone } from '../art/tide/crash';

/**
 * Tidebreaker: Kaishin, the Turning Sea. A drop falls into a still pool; its rings raise a great wave in the woodblock
 * manner with the full moon in its hollow; night falls and the moon turns to teal light; the wave falls into the trough,
 * a whirlpool opens and a water dragon rises out of it in a spiral before the moon, roars, and crashes down on the viewer
 * as a wall of water; the paper comes back wet with blue ink, the pool is still again, a last drop, and the seal 潮.
 */

const DURATION = 13.6;

const BEATS: Beat[] = [
  { name: 'The still pool', t0: 0, t1: 1.4 },
  { name: 'The drop', t0: 1.4, t1: 2.4 },
  { name: 'The great wave', t0: 2.4, t1: 4.7 },
  { name: 'The teal moon', t0: 4.7, t1: 5.9 },
  { name: 'The whirlpool', t0: 5.9, t1: 7.3 },
  { name: 'The dragon', t0: 7.3, t1: 9.55 },
  { name: 'The crash', t0: 9.55, t1: 10.7 },
  { name: 'Still water', t0: 10.7, t1: 12.5 },
  { name: 'The seal', t0: 12.5, t1: DURATION },
];

const TITLE: TitleText = {
  kanji: '破潮',
  english: 'TIDEBREAKER',
  move: '海神・逆巻',
  romaji: 'KAISHIN · THE TURNING SEA',
  colors: ['#f4fbff', '#62d6cc', '#1f5aa8'],
};

/** When the first drop lands, and the last. */
const LAND = 1.4;
const LAST = 12.3;
/** The impact frame of the crash. */
const HIT = 9.86;

function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < 2.4) stillPool(L, t, screen);
  else if (t < HIT) sea(L, t, screen);
  else if (t < 10.7) crash(L, t, screen);
  else ending(L, t, screen);
  titleCard(L.glow, seg(t, 0.1, 0.4) * (1 - seg(t, 4.9, 5.2)), t > 4.9, TITLE);
  return screen;
}

/** 0 to 2.4 s: the pool on the paper, a drop gathering and falling, landing (an impact frame), the rings. */
function stillPool(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  creamPaper(L.flat);
  blueSpecks(L.flat, 12, 40, 0.6);
  // The rings swell the pool a little as they spread, and the camera sinks towards it at the end.
  const sink = easeIn(seg(t, 1.9, 2.4));
  cam([L.flat, L.glow], { x: POOL.x, y: POOL.y }, 1 + 0.5 * sink, 0, 0);
  pool(L.flat, 1, t);
  const age = t - LAND;
  inkRings(L.flat, POOL, seg(t, LAND, LAND + 1.1), 1, 5, 1000, POOL.ry / POOL.rx);
  fallingDrop(L, t, 0.15, LAND);
  crown(L.flat, POOL, age);
  // A teal ring of light at the landing.
  ringFlash(L, POOL, seg(t, LAND, LAND + 0.5));
  uncam([L.flat, L.glow]);
  screen.invert = env(t, LAND, LAND + 0.01, LAND + 0.05, LAND + 0.06);
  screen.flash = 0.25 * env(t, LAND, LAND + 0.02, LAND + 0.04, LAND + 0.12);
  screen.aberration = 4 * env(t, LAND, LAND + 0.03, LAND + 0.1, LAND + 0.4);
}

/** The drop: it gathers at the top, falls and lands on the pool at `land`. */
function fallingDrop(L: Layers, t: number, from: number, land: number) {
  if (t >= land || t < from - 0.6) return;
  const hang = seg(t, from - 0.6, from);
  const k = easeIn(seg(t, from, land));
  const y = lerp(70, POOL.y - 24, k);
  // A thin falling line above it, as speed.
  if (k > 0.05) {
    L.flat.fillStyle = 'rgba(13,39,71,0.5)';
    L.flat.fillRect(POOL.x - 1.5, y - 40 - 260 * k, 3, 220 * k);
  }
  drop(L.flat, { x: POOL.x, y }, 14 + 8 * hang, 1 + 0.5 * k);
}

/** A teal ring of light spreading on the pool (glow layer). */
function ringFlash(L: Layers, at: Pt, k: number) {
  if (k <= 0 || k >= 1) return;
  const R = lerp(30, 700, easeOut(k));
  L.glow.beginPath();
  L.glow.ellipse(at.x, at.y, R, R * POOL.ry / POOL.rx, 0, 0, Math.PI * 2);
  L.glow.strokeStyle = `rgba(143,240,224,${0.9 * (1 - k)})`;
  L.glow.lineWidth = 8 * (1 - k) + 2;
  L.glow.stroke();
}

const MOON_WAVE: MoonLook = { x: 715, y: 585, r: 225 };
const MOON_SKY: MoonLook = { x: 960, y: 360, r: 290 };
const WHIRL: Whirl = { x: 960, y: 880, rx: 940, ry: 210 };

/** 2.4 s to the crash: the wave rises on the paper, night, the moon turns teal, the wave falls, the whirlpool, the dragon. */
function sea(L: Layers, t: number, screen: ScreenParams) {
  const night = smooth(seg(t, 4.75, 5.5));
  const tilt = easeInOut(seg(t, 5.95, 7.0));
  screen.vignette = 0.45 * night;
  // The landing pushes in from the pool: the first rings carry on across the sea.
  creamPaper(L.flat);
  nightFall(L.flat, seg(t, 4.7, 5.5));
  stars(L.glow, night * (0.5 + 0.5 * tilt), t);
  const moon: MoonLook = {
    x: lerp(MOON_WAVE.x, MOON_SKY.x, tilt), y: lerp(MOON_WAVE.y, MOON_SKY.y, tilt), r: lerp(MOON_WAVE.r, MOON_SKY.r, tilt),
  };
  const teal = smooth(seg(t, 4.9, 5.6));
  // The lunge: the camera rushes at the dragon's head.
  const lunge = easeIn(seg(t, 9.5, HIT));
  const pose: DragonPose = {
    ax: WHIRL.x, ay: WHIRL.y, emerge: easeInOut(seg(t, 7.2, 9.0)) * 0.97 + 0.03 * seg(t, 9.0, 9.5),
    roar: easeOut(seg(t, 8.95, 9.25)) * (1 - 0.3 * seg(t, 9.3, 9.5)), t, light: 1,
  };
  const hf = headFrame(pose);
  cam([L.flat, L.glow], { x: hf.x, y: hf.y }, 1 + 3.2 * lunge, (960 - hf.x) * lunge, (540 - hf.y) * lunge);
  moonFlat(L.flat, moon, seg(t, 2.9, 3.6), teal);
  moonGlow(L.glow, moon, teal, t);
  // The wave: it rises, then falls into the trough as the camera tilts down onto the sea.
  const rise = easeOut(seg(t, 2.3, 4.3)) * (1 - easeIn(seg(t, 5.9, 6.6)));
  const dy = -260 * tilt;
  // The drop's rings still running out across the water as the wave gathers.
  if (t < 3.4) inkRings(L.flat, { x: 1100, y: SEA_Y + 40 }, seg(t, 2.1, 3.4), 1 - seg(t, 2.9, 3.4), 4, 1500, 0.12);
  if (rise > 0) {
    for (const c of [L.flat, L.glow]) { c.save(); c.translate(0, dy); }
    const w = waveShape(rise, t);
    waveFlat(L.flat, w, t, night);
    L.glow.save();
    L.glow.globalCompositeOperation = 'destination-out';
    wavePath(L.glow, w);
    L.glow.fill();
    L.glow.restore();
    waveGlow(L.glow, w, t, night);
    // The first rings still spreading on the trough as the wave begins.
    for (const c of [L.flat, L.glow]) c.restore();
  }
  // The sea plane, rising into view as the camera tilts down; the whirlpool opening in it.
  if (tilt > 0) {
    const top = lerp(SEA_Y + 200, WHIRL.y - 250, tilt);
    seaSurface(L.flat, top, t, night);
    L.glow.save();
    L.glow.globalCompositeOperation = 'destination-out';
    L.glow.fillRect(0, top, 1920, 1200);
    L.glow.restore();
    const open = easeOut(seg(t, 6.2, 7.3));
    whirlFlat(L.flat, WHIRL, open, t);
    whirlGlow(L.glow, WHIRL, open, t, env(t, 6.9, 7.3, 8.6, 9.3));
    rimSpray(L.flat, { ...WHIRL, rx: WHIRL.rx * open, ry: WHIRL.ry * open }, open * (1 - 0.5 * seg(t, 8.5, 9.5)), t);
  }
  if (t > 7.2) dragon(L.flat, L.glow, pose);
  uncam([L.flat, L.glow]);
  // A flash only into the crash (on the dark, even a small flash greys the whole frame).
  screen.flash = 0.04 * env(t, 4.95, 5.0, 5.05, 5.25) + 0.6 * seg(t, HIT - 0.12, HIT);
  screen.aberration = 1 + 2 * night + 6 * lunge + 3 * env(t, 8.95, 9.0, 9.2, 9.5);
  screen.bloom = 1 + 0.3 * env(t, 8.95, 9.05, 9.3, 9.6);
}

/**
 * The crash (HIT to 10.7 s): an impact frame, then the water closes over the viewer as a ring of foam claws while drops
 * fly at the camera and white lines streak out; the foam fills the frame and the wet paper comes back through it.
 */
function crash(L: Layers, t: number, screen: ScreenParams) {
  const c = { x: 960, y: 540 };
  const back = smooth(seg(t, 10.42, 10.7));
  // Under the wall: deep water rushing past, lines and drops flying at the camera.
  const g = L.flat.createRadialGradient(c.x, c.y, 0, c.x, c.y, 1100);
  g.addColorStop(0, '#2a7aa0');
  g.addColorStop(0.35, '#0f3d66');
  g.addColorStop(1, PRUSSIAN);
  L.flat.fillStyle = g;
  L.flat.fillRect(0, 0, 1920, 1080);
  waterLines(L.glow, c, t, 1 - seg(t, 10.1, 10.3), 120);
  flyingDrops(L.flat, c, t - HIT + 0.08, 1);
  // The wall falls from the top, the foam after it.
  const wallY = lerp(-160, 1250, easeIn(seg(t, HIT, 10.3)) * 0.6 + 0.4 * seg(t, HIT, 10.3));
  const foamY = lerp(-500, 1350, seg(t, 10.12, 10.45));
  wallOfWater(L.flat, wallY, foamY, t);
  // The glow is hidden under the wall.
  L.glow.save();
  L.glow.globalCompositeOperation = 'destination-out';
  wallMask(L.glow, wallY, t);
  L.glow.fill();
  L.glow.restore();
  // The paper comes back through the foam, wet.
  if (back > 0) {
    L.flat.save();
    L.flat.globalAlpha = back;
    creamPaper(L.flat);
    L.flat.restore();
    wetPaper(L.flat, t, back);
  }
  screen.invert = env(t, HIT, HIT + 0.01, HIT + 0.06, HIT + 0.07);
  screen.flash = 0.9 * (1 - seg(t, HIT, HIT + 0.07)) + 0.15 * env(t, 10.25, 10.32, 10.36, 10.5);
  screen.aberration = 8 * (1 - seg(t, HIT, 10.3)) + 1;
  screen.vignette = 0.4 * (1 - back);
  screen.bloom = 1.2 - 0.5 * back;
}

/** The splashes and wet halftone left on the paper after the crash (flat layer); `k` brings them in. */
function wetPaper(ctx: CanvasRenderingContext2D, t: number, k: number) {
  const grow = clamp((t - 10.3) / 0.35);
  wetHalftone(ctx, k * (1 - seg(t, 10.6, 11.4)));
  const fade = 1 - 0.35 * seg(t, 11.5, 13);
  ctx.save();
  ctx.globalAlpha = fade;
  splash(ctx, { x: 400, y: 300 }, 80, 11, grow);
  splash(ctx, { x: 1170, y: 160 }, 34, 23, grow * 0.95, '#1f5a8c');
  splash(ctx, { x: 1740, y: 690 }, 72, 37, grow);
  splash(ctx, { x: 210, y: 700 }, 44, 41, grow * 0.9, '#1f5a8c');
  splash(ctx, { x: 760, y: 120 }, 26, 53, grow * 0.8);
  ctx.restore();
  blueSpecks(ctx, 99, 70, 0.8 * k * fade);
}

/** 10.7 s to the end: the paper, the pool still again, a last drop and its ring, and the seal. */
function ending(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  creamPaper(L.flat);
  wetPaper(L.flat, t, 1);
  pool(L.flat, smooth(seg(t, 10.7, 11.3)), t);
  fallingDrop(L, t, 11.55, LAST);
  inkRings(L.flat, POOL, seg(t, LAST, LAST + 1.2), 0.85, 3, 700, POOL.ry / POOL.rx);
  ringFlash(L, POOL, seg(t, LAST, LAST + 0.6));
  seal(L.flat, 1590, 340, 190, seg(t, 12.6, 12.9), '潮', '#1d4677');
  screen.flash = 0.1 * env(t, 12.6, 12.65, 12.68, 12.85);
}

const piece: Piece = {
  id: 'tide',
  title: 'Tidebreaker',
  subtitle: 'Kaishin · The Turning Sea',
  about: 'A drop in a still pool raises a great wave under a teal moon; a water dragon spirals out of the whirlpool and crashes down as a wall of water.',
  order: 30,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '破潮海神・逆巻' },
  draw: drawFrame,
};
export default piece;

