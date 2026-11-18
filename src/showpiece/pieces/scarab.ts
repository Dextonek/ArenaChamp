import type { Beat, Layers, Piece } from '../piece';
import { H, W, clamp, easeIn, easeInOut, easeOut, env, lerp, quietScreen, ribbon, rng, rgba, seg, smooth, wobble, type Ctx, type Pt, type ScreenParams } from '../core';
import { seal } from '../art/paper';
import { speedLines } from '../art/ink';
import { beetle, discOf, type BeetlePose } from '../art/scarab/beetle';
import { INK, LAPIS } from '../art/scarab/palette';
import {
  backDune, frontCrest, frontDune, glyphBand, goldDust, goldTwinkles, inkSun, papyrus, papyrusWide, sandBurst, sandOff, sandStream, storm, stormClearGlow,
  stormReveal,
} from '../art/scarab/papyrus';
import { arcPoint, cutDisc, glint, night, pillar, rays, skyPath, stars, sunDisc, sunFire, sunLight, wingedSun, type Arc } from '../art/scarab/sky';
import { clearTitleGlow, scarabTitle } from '../art/scarab/title';

/**
 * Sun Scarab: Nichirin, the Rolling Sun. The sequence, beat by beat, as a pure function of time.
 *
 * A sun drawn as an ink circle on papyrus above a band of glyphs; sand pours in and piles into dunes, and the sun sets into
 * them. A golden scarab rises out of the sand holding the sun up, reborn as a gold disc, and climbs: the papyrus falls
 * away below and the lapis night opens above. At the zenith the sun ignites and opens great feathered wings, rays sweep the
 * sky; the scarab spreads its own wings and the sun falls at the viewer as a pillar of gold light (a white frame, an ink
 * frame). A sandstorm sweeps the papyrus back: the glyph band, the sun with the scarab under it drawn in ink, gold dust
 * settling, and the seal.
 */

const DURATION = 13.8;

/** When things happen. */
const POUR0 = 1.45, POUR1 = 2.95;
const RISE0 = 3.2, RISE1 = 4.6;
const CLIMB0 = 4.6, CLIMB1 = 7.25;
const IGNITE = 7.3;
const SPREAD = 9.0, FALL = 9.15;
const WHITE = 9.5, INKF = 9.57, BEAM = 9.67;
const STORM0 = 10.5, STORM1 = 11.75;
const SEAL = 12.45;

const BEATS: Beat[] = [
  { name: 'The papyrus', t0: 0, t1: POUR0 },
  { name: 'Sand pours', t0: POUR0, t1: RISE0 },
  { name: 'The scarab rises', t0: RISE0, t1: CLIMB0 },
  { name: 'The climb', t0: CLIMB0, t1: CLIMB1 },
  { name: 'The winged sun', t0: CLIMB1, t1: SPREAD },
  { name: 'Wings spread', t0: SPREAD, t1: WHITE },
  { name: 'The pillar', t0: WHITE, t1: STORM0 },
  { name: 'The sandstorm', t0: STORM0, t1: STORM1 },
  { name: 'The seal', t0: STORM1, t1: DURATION },
];

/** The sun drawn on the papyrus at the start (it sets into the dune), and where it is drawn again at the end. */
const SUN0: Pt = { x: 960, y: 360 };
const SUN0_R = 122;
/** The scarab's place on the screen while it climbs and holds the sun at the zenith. */
const HOLD: Pt = { x: 960, y: 690 };
const SCALE = 0.8;
/** How far the scarab climbs (picture units along its arc), and the arc it climbs: a circle to its right. */
const CLIMB = 2500;
const DISC_Y = HOLD.y - 440 * SCALE;
const ARC_R = 1700;
const ARC_C: Pt = { x: HOLD.x + ARC_R, y: DISC_Y };

/** How far the world has turned round the arc's centre at time t. */
const thetaAt = (t: number) => (CLIMB / ARC_R) * easeInOut(seg(t, CLIMB0 - 0.1, CLIMB1));
const arcAt = (t: number): Arc => ({ c: ARC_C, r: ARC_R, theta: thetaAt(t) });

/** The scarab's pose through the rise and the climb (the camera keeps it in place while it climbs). */
function climbPose(t: number): BeetlePose {
  const rise = easeOut(seg(t, RISE0, RISE1));
  const walk = seg(t, RISE0, CLIMB1 + 0.2);
  const stop = smooth(seg(t, CLIMB1 - 0.45, CLIMB1));
  return {
    x: HOLD.x,
    y: lerp(H + 560, HOLD.y, rise) + 5 * Math.sin(t * 7) * walk * (1 - stop),
    angle: (0.05 * smooth(seg(t, CLIMB0, CLIMB0 + 0.6)) + 0.02 * Math.sin(t * 5)) * (1 - stop),
    scale: SCALE,
    gait: t * 9,
    stride: 0.16 * walk * (1 - stop),
  };
}

/** The sand thrown up as the scarab breaks out: it widens as it comes. */
const burstWidth = (t: number) => lerp(120, 220, seg(t, 2.95, 3.6));

/** How far the sun has turned: slow enough that its grooves step steadily on film (a fraction of their spacing a frame). */
const roll = (t: number) => (0.15 * (thetaAt(t) * ARC_R + 600 * easeOut(seg(t, RISE0, RISE1)))) / (SCALE * 150) + 0.3 * t;
/** How far the sky turns in one film frame. */
const turnPerFrame = (t: number) => thetaAt(t) - thetaAt(t - 1 / 30);

function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < RISE0) papyrusBeats(L, t, screen);
  else if (t < CLIMB1) riseAndClimb(L, t, screen);
  else if (t < WHITE) zenith(L, t, screen);
  else if (t < BEAM) impact(L, t, screen);
  else if (t < STORM1) pillarBeat(L, t, screen);
  else ending(L, t, screen);
  // The title, on the flat layer, with the glow under it wiped.
  const k = smooth(seg(t, 0.05, 0.3)) * (1 - seg(t, 4.4, 4.75));
  if (k > 0) {
    clearTitleGlow(L.glow, k);
    scarabTitle(L.flat, k, false);
  }
  return screen;
}

// ---------------------------------------------------------------- 0 to 3.2 s: the papyrus, the sand

/** The papyrus world: the sheet, the glyphs, the sun, the dunes (and between the dunes, `middle`). */
function papyrusWorld(ctx: Ctx, t: number, middle?: () => void) {
  const dk = easeInOut(seg(t, POUR0, POUR1 - 0.1));
  papyrus(ctx);
  glyphBand(ctx, easeOut(seg(t, 0.15, 1.3)));
  // The sun is drawn, then sets into the sand.
  const set = easeIn(seg(t, 2.0, 3.0));
  if (set < 1) inkSun(ctx, { x: SUN0.x, y: SUN0.y + 520 * set }, SUN0_R, easeOut(seg(t, 0.2, 0.85)), smooth(seg(t, 0.5, 1.1)));
  backDune(ctx, dk);
  middle?.();
  frontDune(ctx, dk);
}

function papyrusBeats(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  papyrusWorld(L.flat, t);
  sandStream(L.flat, t, env(t, POUR0 - 0.15, POUR0 + 0.1, POUR1 - 0.25, POUR1 + 0.1), easeInOut(seg(t, POUR0, POUR1 - 0.1)));
  // The dune trembles before the scarab breaks out.
  const tremble = seg(t, 2.95, RISE0);
  if (tremble > 0) sandBurst(L.flat, { x: 960, y: frontCrest(960, 1) }, t, 2.95, tremble, burstWidth(t));
}

// ---------------------------------------------------------------- 3.2 to 7.25 s: the rise and the climb

/**
 * Clips to where the papyrus still is, in world units: everything below its top edge (y 0), with a band of dots above it
 * that thin out into the night.
 */
function papyrusClip(ctx: Ctx) {
  ctx.beginPath();
  ctx.rect(-3000, -24, W + 6000, H + 4000);
  const cell = 22;
  for (let y = -260; y < 0; y += cell) {
    const s = clamp((y + 260) / 260);
    const odd = Math.round(y / cell) % 2;
    for (let x = -1500 + (odd ? cell / 2 : cell); x < W + 1500; x += cell) {
      const r = cell * 0.75 * s;
      if (r < 1) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.clip();
}

/** Turns a context into the world's frame for the climb (the world wheels round the arc's centre). */
function worldFrame(ctx: Ctx, a: Arc) {
  ctx.translate(a.c.x, a.c.y);
  ctx.rotate(-a.theta);
  ctx.translate(-a.c.x, -a.c.y);
}

/** The world point under a screen point during the climb. */
const toWorld = (a: Arc, p: Pt) => arcPoint({ ...a, theta: -a.theta }, p);

function riseAndClimb(L: Layers, t: number, screen: ScreenParams) {
  const a = arcAt(t);
  const pose = climbPose(t);
  const disc = discOf(pose);
  const nightK = clamp(a.theta / 0.25);
  // The night, where the world has turned the papyrus away; the stars and the sun's path wheel with it.
  if (a.theta > 0) {
    night(L.flat);
    stars(L.flat, L.glow, t, 1, a, (w) => w.y > -150, turnPerFrame(t));
    skyPath(L.flat, L.glow, a, smooth(seg(t, CLIMB0, CLIMB0 + 0.6)), (w) => w.y > -150, turnPerFrame(t));
  }
  // The papyrus world, turning away below; the scarab between its dunes.
  const world = (body: () => void) => {
    L.flat.save();
    worldFrame(L.flat, a);
    if (a.theta > 0) papyrusClip(L.flat);
    body();
    L.flat.restore();
  };
  // Drawn until it has turned right out of the frame (at the top of the climb).
  const papyrusOn = a.theta < 1.45;
  if (papyrusOn) {
    world(() => {
      L.flat.fillStyle = '#e2d0a6';
      L.flat.fillRect(-3000, -400, W + 6000, H + 4400);
      papyrusWide(L.flat);
      glyphBand(L.flat, 1);
      backDune(L.flat, 1);
    });
  }
  // The scarab and its sun.
  beetle(L.flat, pose);
  sunDisc(L.flat, disc.x, disc.y, disc.r, roll(t), 0.15 * (1 - smooth(seg(t, CLIMB1 - 0.45, CLIMB1))));
  if (papyrusOn) {
    world(() => {
      // Sand pouring off its back while it is still low.
      const off = (1 - seg(t, 4.4, 5.3)) * seg(t, RISE0 + 0.2, RISE0 + 0.5);
      if (off > 0) {
        const edge: Pt[] = [-150, -110, -60, 60, 110, 150].map((x) => toWorld(a, { x: pose.x + x * SCALE, y: pose.y + (Math.abs(x) > 100 ? 40 : 120) * SCALE }));
        sandOff(L.flat, edge, t, off, frontCrest(960, 1) + 20);
      }
      frontDune(L.flat, 1);
      sandBurst(L.flat, { x: 960, y: frontCrest(960, 1) }, t, 2.95, 1 - seg(t, 4.2, 4.6), burstWidth(t));
    });
  }
  // Light: the sun's rim and halo, cut away where the scarab's legs cross it.
  const lightK = seg(t, RISE0 + 0.2, RISE1) * (0.35 + 0.65 * nightK);
  cutDisc(L.glow, disc.x, disc.y, disc.r);
  sunLight(L.glow, disc.x, disc.y, disc.r, lightK, 0.5 + 0.5 * nightK);
  cutBeetle(L.glow, pose);
  // A glint running over the carapace as it comes out.
  const gl = seg(t, 4.15, 4.6);
  if (gl > 0 && gl < 1) glint(L.glow, { x: pose.x - 120 * SCALE + 240 * SCALE * gl, y: pose.y + 40 * SCALE - 140 * SCALE * gl }, 70 * Math.sin(Math.PI * gl), 0.9, '#fff4d0');
  screen.vignette = 0.35 * nightK;
  screen.bloom = 0.8 + 0.3 * nightK;
}

/** Cuts the scarab's shape out of the glow (so light behind it does not paint over it). */
function cutBeetle(ctx: Ctx, pose: BeetlePose) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  beetle(ctx, pose, { mode: 'solid', color: '#000' });
  ctx.restore();
}

// ---------------------------------------------------------------- 7.25 to 9.5 s: the zenith

/** A slow push in round a point, on both layers. */
function camera(L: Layers, c: Pt, zoom: number, shake: number, t: number) {
  const wx = wobble(5)(t * 31) * shake, wy = wobble(9)(t * 29) * shake;
  for (const ctx of [L.flat, L.glow]) {
    ctx.save();
    ctx.translate(c.x + wx, c.y + wy);
    ctx.scale(zoom, zoom);
    ctx.translate(-c.x, -c.y);
  }
}
const uncamera = (L: Layers) => { L.flat.restore(); L.glow.restore(); };

function zenithPose(t: number): BeetlePose {
  return { x: HOLD.x, y: HOLD.y + 3 * Math.sin(t * 2) * seg(t, CLIMB1, CLIMB1 + 0.6), angle: 0, scale: SCALE, spread: easeOut(seg(t, SPREAD, SPREAD + 0.38)), gait: 0, stride: 0 };
}

/** Where the falling sun is: it leaves the scarab's hands, drops behind it and swells towards the viewer. */
function fallingSun(t: number) {
  const home = discOf(zenithPose(t));
  const fall = easeIn(seg(t, FALL, WHITE));
  return { x: home.x, y: lerp(home.y, 520, fall), r: lerp(home.r, 300, fall), fall, home };
}

function zenith(L: Layers, t: number, screen: ScreenParams) {
  const pose = zenithPose(t);
  const { home, fall, ...disc } = fallingSun(t);
  const ign = env(t, IGNITE, IGNITE + 0.06, IGNITE + 0.2, IGNITE + 0.9);
  const unfurl = easeOut(seg(t, IGNITE + 0.12, IGNITE + 0.9));
  const charge = smooth(seg(t, SPREAD, WHITE));
  const a = arcAt(t);
  camera(L, { x: 960, y: 450 }, 1 + 0.05 * seg(t, CLIMB1, SPREAD) + 0.04 * charge, 5 * charge + 6 * ign, t);
  night(L.flat);
  stars(L.flat, L.glow, t, 1 - 0.4 * unfurl, a, undefined, turnPerFrame(t));
  skyPath(L.flat, L.glow, a, 1 - smooth(seg(t, IGNITE, IGNITE + 0.6)), undefined, turnPerFrame(t));
  rays(L.flat, L.glow, home, t, smooth(seg(t, IGNITE, IGNITE + 0.6)) * (1 + 0.5 * charge), 0.1 + (t - IGNITE) * 0.18 + 0.9 * charge * charge);
  wingedSun(L.flat, home, home.r, 760, 165, unfurl);
  sunDisc(L.flat, disc.x, disc.y, disc.r, roll(CLIMB1) + (t - CLIMB1) * 0.6, clamp(ign + charge));
  beetle(L.flat, pose);
  // Light: the halo, the ignition burning the face, a ring thrown out; the wings, the face and the scarab kept clear.
  L.glow.save();
  L.glow.globalCompositeOperation = 'destination-out';
  wingedSun(L.glow, home, home.r, 760, 165, unfurl, 'solid', '#000');
  L.glow.restore();
  cutDisc(L.glow, disc.x, disc.y, disc.r);
  sunLight(L.glow, disc.x, disc.y, disc.r, 1 + 0.2 * fall, 1 + ign + fall);
  sunFire(L.glow, disc.x, disc.y, disc.r, clamp(0.85 * ign + 0.9 * charge));
  const ring = seg(t, IGNITE, IGNITE + 0.8);
  if (ring > 0 && ring < 1) {
    L.glow.beginPath();
    L.glow.arc(home.x, home.y, home.r + 40 + 1100 * easeOut(ring), 0, Math.PI * 2);
    L.glow.strokeStyle = rgba('#ffd27a', 0.7 * (1 - ring));
    L.glow.lineWidth = 14 * (1 - ring) + 2;
    L.glow.stroke();
  }
  cutBeetle(L.glow, pose);
  // Glints at the wing tips as they open.
  for (const m of [1, -1]) glint(L.glow, { x: home.x + m * (home.r * 0.55 + 740 * unfurl), y: home.y - 140 * unfurl }, 60 * env(t, IGNITE + 0.6, IGNITE + 0.85, IGNITE + 0.95, IGNITE + 1.3), 1, '#fff4d0');
  uncamera(L);
  screen.vignette = 0.35;
  screen.bloom = 1.1 + 0.6 * ign + 0.5 * charge;
  screen.aberration = 4 * ign + 5 * charge;
}

// ---------------------------------------------------------------- 9.5 to 9.67 s: the white frame and the ink frame

const PAPER_PALE = '#f3e7c9';

function impact(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  if (t < INKF) {
    L.flat.fillStyle = '#fffaf0';
    L.flat.fillRect(0, 0, W, H);
    screen.flash = 0.3;
    return;
  }
  // The ink frame: the winged sun and the spread scarab in brown-black ink on pale papyrus, the falling sun a lapis disc
  // behind the scarab.
  L.flat.fillStyle = PAPER_PALE;
  L.flat.fillRect(0, 0, W, H);
  inkLines(L.flat, { x: 960, y: 520 }, t);
  const pose = { ...zenithPose(WHITE), scale: SCALE * 1.04 };
  const home = discOf(zenithPose(WHITE));
  wingedSun(L.flat, home, home.r, 860, 170, 1, 'ink', PAPER_PALE, 7);
  L.flat.beginPath();
  L.flat.arc(960, 520, 310, 0, Math.PI * 2);
  L.flat.fillStyle = LAPIS.base;
  L.flat.fill();
  L.flat.lineWidth = 12;
  L.flat.strokeStyle = INK;
  L.flat.stroke();
  beetle(L.flat, pose, { mode: 'ink', color: PAPER_PALE, ow: 9 });
  screen.aberration = 7;
}

/** Ink speed lines rushing in to a point (flat). */
function inkLines(ctx: Ctx, c: Pt, t: number) {
  const r = rng(Math.floor(t * 30) * 7 + 3);
  for (let i = 0; i < 90; i++) {
    const a = r.range(0, Math.PI * 2), r0 = r.range(420, 640), r1 = r0 + r.range(500, 1200);
    const pts: Pt[] = Array.from({ length: 8 }, (_, j) => {
      const d = r0 + ((r1 - r0) * j) / 7;
      return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d };
    });
    const w = r.range(3, 14);
    ctx.fillStyle = INK;
    ribbon(ctx, pts, (u) => w * Math.sin(Math.PI * u) ** 0.6);
  }
}

// ---------------------------------------------------------------- 9.67 to 11.75 s: the pillar, the sandstorm

function pillarBeat(L: Layers, t: number, screen: ScreenParams) {
  const k = seg(t, BEAM, 10.6);
  const front = lerp(-500, W + 600, easeInOut(seg(t, STORM0, STORM1)));
  const push = easeOut(k);
  const pose: BeetlePose = { ...zenithPose(WHITE), scale: SCALE * (1.06 + 0.12 * push), y: HOLD.y + 20 + 30 * push };
  const sunC = { x: 960, y: 520 };
  const sunR = lerp(330, 380, push);
  camera(L, { x: 960, y: 540 }, 1, 14 * (1 - seg(t, BEAM, 10.4)), t);
  night(L.flat);
  L.flat.fillStyle = 'rgba(3,5,18,0.5)';
  L.flat.fillRect(-100, -100, W + 200, H + 200);
  rays(L.flat, L.glow, sunC, t, 1.2 - 0.5 * k, 2 + t * 0.6);
  // The pillar and the burning sun at its heart.
  const w = lerp(160, 560, easeOut(seg(t, BEAM, 9.95))) * (1 - 0.2 * seg(t, 10.2, 10.9));
  pillar(L.glow, 960, t, 1 - 0.3 * seg(t, 10.3, 11), w);
  sunLight(L.glow, sunC.x, sunC.y, sunR, 1, 2);
  sunFire(L.glow, sunC.x, sunC.y, sunR, 1);
  // The scarab black against it, with a rim of light round its edge.
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    beetle(L.glow, { ...pose, x: pose.x + Math.cos(ang) * 6, y: pose.y + Math.sin(ang) * 6 }, { mode: 'solid', color: '#ffe4a0' });
  }
  beetle(L.glow, pose, { mode: 'solid', color: '#0a0d24' });
  // Gold dust bursting out at the camera.
  const r = rng(61);
  for (let i = 0; i < 140; i++) {
    const ang = r.range(0, Math.PI * 2), v = r.range(0.4, 1.4), born = BEAM + r.range(0, 0.7);
    const age = t - born;
    if (age < 0) continue;
    const d = 80 * Math.exp(age * 3.2 * v);
    if (d > 1400) continue;
    const p = { x: sunC.x + Math.cos(ang) * d, y: sunC.y + Math.sin(ang) * d * 0.8 };
    L.glow.fillStyle = rgba(r.next() < 0.5 ? '#ffd27a' : '#fff4d0', 0.9);
    L.glow.beginPath();
    L.glow.arc(p.x, p.y, 2 + d * 0.012, 0, Math.PI * 2);
    L.glow.fill();
  }
  speedLines(L.glow, sunC, t, env(t, BEAM, BEAM + 0.05, 10.0, 10.4));
  uncamera(L);
  // The sandstorm sweeps the papyrus back in from the left.
  if (t > STORM0) {
    const sk = env(t, STORM0, STORM0 + 0.15, STORM1 - 0.25, STORM1);
    stormReveal(L.flat, front, (ctx) => endScene(ctx, t));
    stormClearGlow(L.glow, front);
    storm(L.flat, front, t, sk);
  }
  screen.vignette = 0.35 * (1 - seg(t, STORM0, STORM1));
  screen.bloom = 1 - 0.3 * k + 0.3 * seg(t, STORM0, STORM1);
  screen.aberration = 7 * (1 - seg(t, BEAM, 10.2)) + 1 - seg(t, STORM0, STORM1);
}

// ---------------------------------------------------------------- 11.75 s to the end: the papyrus again, the seal

/** The scarab drawn in ink under the gilded sun, at the end. */
const END_POSE: BeetlePose = { x: 960, y: 640, angle: 0, scale: 0.62 };

function endScene(ctx: Ctx, t: number) {
  papyrus(ctx);
  glyphBand(ctx, 1);
  beetle(ctx, END_POSE, { mode: 'ink', color: '#f0e3c3', ow: 8, inlay: LAPIS.base, inlay2: '#2fbfae' });
  const d = discOf(END_POSE);
  inkSun(ctx, d, d.r, 1, 1, 1);
  goldDust(ctx, t, STORM0 + 0.4, 1);
}

function ending(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  endScene(L.flat, t);
  goldTwinkles(L.glow, t, STORM0 + 0.4, smooth(seg(t, STORM1, STORM1 + 0.8)));
  seal(L.flat, 1490, 640, 190, seg(t, SEAL, SEAL + 0.3), '陽', '#1f3a8a');
}

const piece: Piece = {
  id: 'scarab',
  title: 'Sun Scarab',
  subtitle: 'Nichirin · The Rolling Sun',
  about: 'A sun drawn on papyrus sets into the sand; a golden scarab rises and rolls it up into the lapis night, where it opens great wings and falls as a pillar of gold light.',
  order: 100,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '聖甲日輪・転生陽' },
  draw: drawFrame,
};
export default piece;
