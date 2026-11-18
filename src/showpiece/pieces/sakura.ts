import type { Beat, Layers, Piece } from '../piece';
import { easeInOut, easeOut, env, lerp, quietScreen, seg, smooth, type Ctx, type Pt, type ScreenParams } from '../core';
import { paper, seal, specks } from '../art/paper';
import { speedLines } from '../art/ink';
import { SAKURA, bloomPop, flower, loosePetal } from '../art/sakura/petal';
import { SITES, drawBranch, siteAt } from '../art/sakura/branch';
import {
  MOON, burstLight, frontPetals, petalMask, snowPetals, streamPetals, tornPetals, vortexArms, vortexPetals, windLines, type BladePose,
} from '../art/sakura/petals';
import {
  bladeBody, bladeHilt, clipNight, corona, cutGlow, frontDots, groundWash, moon, nightGround, paperFromCut, paperMoon, slash, swingTrail,
} from '../art/sakura/night';
import { sakuraTitle } from '../art/sakura/title';

/**
 * Sakura Requiem: Sange, a Thousand Petal Blades. A bare cherry branch brushed in sumi across a paper moon; its buds swell
 * and burst into blossom in a wave; the wind tears the petals loose and a curtain of them carries the night in; under the
 * pale full moon the petals gather into a vortex, which narrows into one long blade of blossoms; it swings up and cuts the
 * world in two through the moon; a white frame, the petals burst out of the cut and fall as pink snow on the paper; the
 * branch is bare again but for one blossom, and the seal 桜 is stamped.
 */

const DURATION = 13.6;

const BEATS: Beat[] = [
  { name: 'The branch', t0: 0, t1: 1.3 },
  { name: 'Blossom', t0: 1.3, t1: 3.3 },
  { name: 'The wind', t0: 3.3, t1: 4.95 },
  { name: 'Nightfall', t0: 4.95, t1: 5.7 },
  { name: 'The vortex', t0: 5.7, t1: 8.4 },
  { name: 'The blade', t0: 8.4, t1: 9.2 },
  { name: 'The cut', t0: 9.2, t1: 9.75 },
  { name: 'Petal snow', t0: 9.75, t1: 10.9 },
  { name: 'Requiem', t0: 10.9, t1: 12.4 },
  { name: 'The seal', t0: 12.4, t1: DURATION },
];

/** The wind's bend of the branch: a gust from 3.2 s, swaying, and still again once the night has come. */
const bendAt = (t: number) => 0.05 * smooth(seg(t, 3.2, 3.7)) * (1 + 0.35 * Math.sin(t * 6.5)) * (1 - smooth(seg(t, 5.0, 5.6)));

/** The blade: its guard at the lower left, lying low, then swung up through the moon. */
const GUARD: Pt = { x: 330, y: 880 };
const CUT_ANGLE = Math.atan2(MOON.y - GUARD.y, MOON.x - GUARD.x);
const LOW_ANGLE = CUT_ANGLE + 0.36;
const CUT = { c: { x: MOON.x, y: MOON.y }, angle: CUT_ANGLE };
const bladePose = (t: number): BladePose => ({ g: GUARD, angle: lerp(LOW_ANGLE, CUT_ANGLE, easeInOut(seg(t, 9.05, 9.2))), len: 1300 });

/** The night's front edge: it crosses the frame left to right. */
const frontAt = (t: number) => lerp(-320, 2380, easeInOut(seg(t, 4.95, 5.7)));

/** The one blossom left at the end, and a petal drifting down past it. */
const LAST = SITES.findIndex((s) => s.limb === 2 && s.at > 0.85);
const LAST_FALL = 11.55;

/** Burst time: the white frame's end. */
const BURST = 9.7;

function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < 4.95) paperBeats(L, t, screen);
  else if (t < 5.7) nightfall(L, t, screen);
  else if (t < 9.2) nightBeats(L, t, screen);
  else if (t < 9.75) theCut(L, t, screen);
  else if (t < 10.9) snow(L, t, screen);
  else ending(L, t, screen);
  // The title, outside the camera's drift: from the branch to the wind.
  if (t < 4.95) sakuraTitle(L.flat, seg(t, 0.1, 0.4) * (1 - seg(t, 4.55, 4.8)));
  return screen;
}

/** How open a site's flower is at time t. */
const openAt = (s: (typeof SITES)[number], t: number) =>
  t < s.bud ? 0 : t < s.burst ? 0.55 * seg(t, s.bud, s.burst) : 0.55 + 0.45 * seg(t, s.burst, s.burst + 0.42);

/** The paper side: the paper moon, the branch, its flowers, the wind and its petals, the title. */
function paperScene(L: Layers, t: number) {
  paper(L.flat);
  paperMoon(L.flat, 1);
  const wind = seg(t, 3.2, 3.6);
  windLines(L.flat, t, wind * 0.9);
  streamPetals(L.flat, t, false);
  const bend = bendAt(t);
  drawBranch(L.flat, t, bend, { color: SAKURA.ink, streaks: 1 });
  SITES.forEach((s, si) => {
    const mask = petalMask(si, t);
    if (!mask) return;
    const p = siteAt(s, bend);
    flower(L.flat, { ...s.pose, x: p.x, y: p.y, open: openAt(s, t), petals: mask });
    bloomPop(L.glow, p, s.pose.r * 0.8, seg(t, s.burst, s.burst + 0.22));
  });
  tornPetals(L.flat, t, bendAt);
  streamPetals(L.flat, t, true);
}

/** 0 to 4.95 s: the branch brushed in, the blossoms, the wind. */
function paperBeats(L: Layers, t: number, screen: ScreenParams) {
  // The camera drifts in a little over the paper beats.
  const z = 1 + 0.03 * smooth(seg(t, 0, 4.95));
  for (const c of [L.flat, L.glow]) {
    c.save();
    c.translate(960, 540);
    c.scale(z, z);
    c.translate(-960, -540);
  }
  paperScene(L, t);
  for (const c of [L.flat, L.glow]) c.restore();
  screen.vignette = 0;
  screen.bloom = 0.6;
}

/** The night side: the ground, the moon, the bare branch dark against it, and the vortex (both layers). */
function nightScene(L: Layers, t: number, opts: { blade?: boolean; branch?: number; fade?: number } = {}) {
  nightGround(L.flat);
  moon(L.flat);
  const g = easeOut(seg(t, 5.2, 6.9));
  corona(L.glow, 0.25 + 0.75 * seg(t, 6.0, 8.0), t);
  if ((opts.branch ?? 1) > 0) {
    L.flat.save();
    L.flat.globalAlpha = opts.branch ?? 1;
    drawBranch(L.flat, 99, bendAt(t), { color: '#0b0408', streaks: 0, rim: 0.8 * (opts.branch ?? 1) }, L.glow);
    L.flat.restore();
  }
  const toBlade = seg(t, 8.35, 9.0);
  vortexArms(L.glow, t, g, (0.45 * seg(t, 5.6, 6.6) + 0.45 * seg(t, 7.2, 8.3)) * (1 - seg(t, 8.35, 8.8)));
  const b = bladePose(t);
  if (opts.blade) {
    bladeBody(L.glow, b, easeOut(seg(t, 8.55, 9.0)), t);
  }
  vortexPetals(L.glow, t, g, seg(t, 5.15, 5.9) * (1 - (opts.fade ?? 0)), toBlade, b);
  if (opts.blade) bladeHilt(L.glow, b, seg(t, 8.55, 8.8));
}

/** 4.95 to 5.7 s: the night sweeps in behind a curtain of petals. */
function nightfall(L: Layers, t: number, screen: ScreenParams) {
  paperBeats(L, t, screen);
  const front = frontAt(t);
  for (const c of [L.flat, L.glow]) {
    c.save();
    clipNight(c, front, t);
  }
  // The glow of the paper side does not reach into the night.
  L.glow.clearRect(-10, -10, 1940, 1100);
  nightScene(L, t);
  for (const c of [L.flat, L.glow]) c.restore();
  frontDots(L.flat, front, t);
  frontPetals(L.flat, t, front, 1);
  const k = seg(t, 4.95, 5.7);
  screen.vignette = 0.5 * k;
  screen.bloom = lerp(0.6, 1, k);
}

/** 5.7 to 9.2 s: the vortex round the moon; it narrows into a blade of petals, which swings up. */
function nightBeats(L: Layers, t: number, screen: ScreenParams) {
  const zoom = 1 + 0.06 * smooth(seg(t, 5.7, 8.4)) - 0.04 * easeInOut(seg(t, 8.4, 9.0));
  for (const c of [L.flat, L.glow]) {
    c.save();
    c.translate(MOON.x, MOON.y);
    c.scale(zoom, zoom);
    c.translate(-MOON.x, -MOON.y);
  }
  nightScene(L, t, { blade: t > 8.5, branch: 1 - seg(t, 8.3, 8.7) });
  // The tip's trail as it swings.
  if (t > 9.05) swingTrail(L.glow, bladePose(t), LOW_ANGLE, seg(t, 9.05, 9.12));
  for (const c of [L.flat, L.glow]) c.restore();
  screen.vignette = 0.5;
  screen.bloom = 1 + 0.3 * seg(t, 7.5, 8.4) + 0.3 * seg(t, 8.9, 9.2);
  screen.aberration = 1 + 2 * seg(t, 8.6, 9.2) + 4 * seg(t, 9.12, 9.2);
}

/** 9.2 to 9.75 s: the slash through the moon, an impact frame, the frame split in two, and a white frame. */
function theCut(L: Layers, t: number, screen: ScreenParams) {
  const split = easeOut(seg(t, 9.235, 9.5)) * 34;
  const ax = Math.cos(CUT.angle), ay = Math.sin(CUT.angle), nx = -ay, ny = ax;
  const c = CUT.c;
  const blade = t < 9.25;
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
      ctx.translate(ax * split * side * 0.7 + nx * split * side, ay * split * side * 0.7 + ny * split * side);
    }
    nightScene(L, Math.min(t, 9.2), { blade, branch: 0, fade: seg(t, 9.25, 9.45) });
    for (const ctx of [L.flat, L.glow]) ctx.restore();
  }
  slash(L.glow, c, CUT.angle, seg(t, 9.19, 9.25), seg(t, 9.32, 9.6), 1.2);
  cutGlow(L.glow, c, CUT.angle, env(t, 9.24, 9.28, 9.5, 9.62), 1.3);
  speedLines(L.glow, c, t, env(t, 9.24, 9.28, 9.5, 9.62));
  screen.invert = env(t, 9.222, 9.226, 9.27, 9.274);
  screen.flash = Math.max(0.55 * env(t, 9.19, 9.2, 9.21, 9.3), env(t, 9.54, 9.59, 9.71, 9.76));
  screen.aberration = 7 * env(t, 9.2, 9.24, 9.4, 9.6) + 1;
  screen.vignette = 0.5;
  screen.bloom = 1.4;
}

/** The paper side at the end: the paper moon, the bare branch, the last blossom, the snow, petals on the ground. */
function endingScene(ctx: Ctx, glow: Ctx | null, t: number) {
  paper(ctx);
  paperMoon(ctx, 0.55);
  groundWash(ctx, seg(t, 10.1, 12.2));
  drawBranch(ctx, 99, 0, { color: SAKURA.ink, streaks: 1 });
  // The last blossom: it opens again on the bare branch, and lets one petal go.
  const s = SITES[LAST];
  const p = siteAt(s, 0);
  const sway = 0.06 * Math.sin(t * 1.7);
  flower(ctx, { ...s.pose, r: s.pose.r * 1.6, tilt: 0.85, rot: s.pose.rot + sway, x: p.x, y: p.y, open: 0.55 + 0.45 * seg(t, 10.35, 10.85) });
  if (glow) bloomPop(glow, p, s.pose.r, seg(t, 10.55, 10.8));
  if (t > LAST_FALL) {
    const a = t - LAST_FALL;
    const y = Math.min(p.y + 10 + 95 * a + 6 * a * a, 1032);
    const rest = y >= 1032 ? 1 : 0;
    const x = p.x + 60 * a + 50 * Math.sin(a * 1.6) * (1 - rest);
    loosePetal(ctx, { x, y }, rest ? 0.3 : -1.2 + 1.3 * Math.sin(a * 1.4), s.pose.r * 1.5, rest ? 0.4 : Math.cos(a * 2.2 + 0.4));
  }
  snowPetals(ctx, t - BURST, CUT);
  specks(ctx, 61, 18, 0.45, { x: 60, y: 60, w: 1800, h: 900 }, [SAKURA.plum, SAKURA.deep, SAKURA.mid]);
}

/** 9.75 to 10.9 s: out of the white the petals burst from the cut and fall; the paper comes back out of the cut line. */
function snow(L: Layers, t: number, screen: ScreenParams) {
  const age = t - BURST;
  nightGround(L.flat);
  const back = easeInOut(seg(t, 9.95, 10.75));
  paperFromCut(L.flat, CUT.c, CUT.angle, back, (ctx) => endingScene(ctx, null, t));
  burstLight(L.glow, age, CUT, 1 - smooth(seg(t, 10.05, 10.75)));
  cutGlow(L.glow, CUT.c, CUT.angle, 1 - seg(t, 9.72, 10.0), 1.6);
  screen.vignette = 0.5 * (1 - back);
  screen.bloom = lerp(1.3, 0.6, back);
  screen.aberration = 3 * (1 - seg(t, 9.75, 10.1)) + 0.5;
}

/** 10.9 s to the end: the paper, the bare branch with its one blossom, the snow settling, and the seal. */
function ending(L: Layers, t: number, screen: ScreenParams) {
  endingScene(L.flat, L.glow, t);
  seal(L.flat, 1700, 800, 190, seg(t, 12.55, 12.85), '桜', SAKURA.plum);
  screen.flash = 0.1 * env(t, 12.55, 12.6, 12.62, 12.8);
  screen.vignette = 0;
  screen.bloom = 0.6;
}

const piece: Piece = {
  id: 'sakura',
  title: 'Sakura Requiem',
  subtitle: 'Sange · A Thousand Petal Blades',
  about: 'A cherry branch brushed in ink blossoms; the wind tears its petals loose, and under the full moon they gather into a vortex and a blade of blossoms that cuts the world in two, then fall as pink snow.',
  order: 80,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '桜花散華・千刃' },
  draw: drawFrame,
};
export default piece;
