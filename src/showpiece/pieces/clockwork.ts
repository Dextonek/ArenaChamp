import type { Beat, Layers, Piece } from '../piece';
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, env, lerp, quietScreen, rgba, rng, seg, smooth, wobble, type Ctx, type ScreenParams } from '../core';
import { seal, specks, titleCard } from '../art/paper';
import { paperFlood, speedLines } from '../art/ink';
import { ALL_STARS, C, GOLD, HOUR, MINUTE, PARCH, R, SEAL, SPECKS, clearTitleGlow, glint, parchment, starPath } from '../art/clockwork/common';
import {
  NEW_STAR, burnChar, burnPath, burnRim, chartGlints, chartRings, chartStars, clipOutsideBurn, compassRose, newStar,
} from '../art/clockwork/chart';
import { PULL0, T_STOP, handAngles, handStars, pullK, skyConstellations, skyPos, spaceGround, starField } from '../art/clockwork/sky';
import {
  ARRIVE, XII, arriveK, clockBody, clockRims, coreStar, cracks, drawShard, flare, flyingShards, handGrow, handLight,
  handSpine, inkRays,
} from '../art/clockwork/clock';

/**
 * Celestial Clockwork: Seikoku, the Stopped Hour. The sequence, beat by beat, as a pure function of time.
 *
 * An old star chart on parchment; its stars light one by one along the lines; the parchment burns away from the compass
 * rose into space and the lines turn to light; brass rings of an armillary clock fly in and lock round the centre; stars
 * are pulled out of the constellations to make the hands, which sweep faster and faster until they meet at the top: time
 * stops (all grey but the gold, one great tick); the clock cracks and bursts into turning brass shards and a cyan-white
 * star flare; the parchment comes back with one new star drawn in, a brass shard on the paper, and the seal.
 */

const DURATION = 13.8;

/** The parchment burning away. */
const BURN0 = 2.72, BURN1 = 3.86;
/** The white frame, the ink frame, the burst (frame edges on thirtieths of a second). */
const WHITE = 8.6, INKF = 8.6 + 2 / 30, BURST = 8.6 + 5 / 30;
/** The paper flooding back, the shard landing, the new star, the seal. */
const FLOOD0 = 9.45, FLOOD1 = 10.1, LAND0 = 9.7, LAND1 = 10.35, STAR0 = 10.55, SEAL0 = 12.25;

const BEATS: Beat[] = [
  { name: 'The star chart', t0: 0, t1: 1.3 },
  { name: 'The stars wake', t0: 1.3, t1: BURN0 },
  { name: 'The chart burns', t0: BURN0, t1: BURN1 },
  { name: 'The clockwork', t0: BURN1, t1: PULL0 },
  { name: 'Hands of stars', t0: PULL0, t1: T_STOP },
  { name: 'The stopped hour', t0: T_STOP, t1: WHITE },
  { name: 'The burst', t0: WHITE, t1: FLOOD1 },
  { name: 'The new star', t0: FLOOD1, t1: SEAL0 },
  { name: 'The seal', t0: SEAL0, t1: DURATION },
];

const burnRad = (t: number) => 1500 * seg(t, BURN0, BURN1) ** 1.3;

function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < BURN0) chartBeat(L, t, screen);
  else if (t < BURN1) burnBeat(L, t, screen);
  else if (t < T_STOP) clockBeat(L, t, screen);
  else if (t < WHITE) stoppedBeat(L, t, screen);
  else if (t < BURST) impact(L, t, screen);
  else if (t < FLOOD1) burstBeat(L, t, screen);
  else ending(L, t, screen);
  // The title, on the flat layer and outside the camera; the glow under it is wiped away so nothing glows through.
  const k = smooth(seg(t, 0.05, 0.3)) * (1 - seg(t, 3.85, 4.15));
  if (k > 0) {
    clearTitleGlow(L.glow, k);
    titleCard(L.flat, k, t > 3.4, {
      kanji: '天時', english: 'CELESTIAL CLOCKWORK', move: '星刻・停止', romaji: 'SEIKOKU · THE STOPPED HOUR',
      colors: ['#fff6da', '#f2c45a', '#9c6a1c'],
    });
  }
  return screen;
}

/** A gentle push and shake for both layers, round the clock's centre. */
function camera(L: Layers, zoom: number, shake: number, t: number) {
  const wx = wobble(15)(t * 31) * shake, wy = wobble(19)(t * 29) * shake;
  for (const c of [L.flat, L.glow]) {
    c.save();
    c.translate(C.x + wx, C.y + wy);
    c.scale(zoom, zoom);
    c.translate(-C.x, -C.y);
  }
}
const uncamera = (L: Layers) => { L.flat.restore(); L.glow.restore(); };

/** The chart as it is on the paper, every line drawn (flat). */
function chartFull(ctx: Ctx, t: number, lit: boolean) {
  parchment(ctx);
  chartRings(ctx, 1);
  compassRose(ctx, 1);
  chartStars(ctx, t, { lines: 1, lit });
  specks(ctx, 33, 50, 0.55, undefined, SPECKS);
}

/**
 * 0 to 2.72 s: the star chart is inked on the parchment (rings, compass rose, constellations); then its stars light one
 * by one along the lines, and the compass rose begins to smoulder.
 */
function chartBeat(L: Layers, t: number, screen: ScreenParams) {
  camera(L, 1 + 0.025 * smooth(seg(t, 0, BURN0)), 0, t);
  parchment(L.flat);
  specks(L.flat, 33, 50, 0.55 * seg(t, 0, 0.6), undefined, SPECKS);
  chartRings(L.flat, seg(t, 0, 1.15));
  compassRose(L.flat, seg(t, 0.05, 0.6));
  chartStars(L.flat, t);
  chartGlints(L.glow, t, 0.8);
  smoulder(L, t);
  uncamera(L);
  screen.vignette = 0;
  screen.bloom = 0.8;
}

/** The compass rose's centre catching fire just before the burn (glow, plus scorch on flat). */
function smoulder(L: Layers, t: number) {
  const k = seg(t, 2.3, BURN0 + 0.05);
  if (k <= 0) return;
  const g = L.flat.createRadialGradient(C.x, C.y, 0, C.x, C.y, 140 * k);
  g.addColorStop(0, `rgba(40,20,6,${0.85 * k})`);
  g.addColorStop(0.5, `rgba(110,64,24,${0.4 * k})`);
  g.addColorStop(1, 'rgba(110,64,24,0)');
  L.flat.fillStyle = g;
  L.flat.beginPath();
  L.flat.arc(C.x, C.y, 140 * k, 0, Math.PI * 2);
  L.flat.fill();
  glint(L.glow, C, 26 * k * (1 + 0.15 * Math.sin(t * 30)), k, '#ff9a3a', t * 2);
}

/** The chart's rings left behind as faint lines of light in the hole (glow). */
function ghostRings(ctx: Ctx, k: number) {
  if (k <= 0) return;
  ctx.save();
  for (const [r, a, dash] of [[R.chart, 0.5, 0], [R.chart - 30, 0.3, 0], [330, 0.3, 1], [236, 0.3, 1], [150, 0.3, 1]] as const) {
    ctx.setLineDash(dash ? [10, 9] : []);
    ctx.beginPath();
    ctx.arc(C.x, C.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(GOLD, a * k);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** 2.72 to 3.86 s: the parchment burns away from the centre; inside the hole, space and the constellations as light. */
function burnBeat(L: Layers, t: number, screen: ScreenParams) {
  const rad = burnRad(t);
  camera(L, 1.025 - 0.025 * easeInOut(seg(t, BURN0, BURN1)), 4 * (1 - seg(t, BURN0, BURN1)), t);
  // Inside: the night, its stars and the constellations as light.
  spaceGround(L.flat);
  starField(L.flat, t, 1);
  L.glow.save();
  L.glow.beginPath();
  burnPath(L.glow, rad * 0.98, t);
  L.glow.clip();
  skyConstellations(L.flat, L.glow, t, 1);
  ghostRings(L.glow, 1);
  coreStar(L.glow, t, 0.6 * seg(t, BURN0, BURN0 + 0.3));
  L.glow.restore();
  // Outside: the parchment still, charred along the edge.
  L.flat.save();
  clipOutsideBurn(L.flat, rad, t);
  chartFull(L.flat, t, false);
  burnChar(L.flat, rad, t);
  L.flat.restore();
  L.glow.save();
  clipOutsideBurn(L.glow, rad, t);
  chartGlints(L.glow, t, 0.6);
  L.glow.restore();
  burnRim(L.glow, rad, t, 1 - seg(t, BURN1 - 0.15, BURN1));
  uncamera(L);
  const open = seg(t, BURN0, BURN1);
  screen.vignette = 0.35 * open;
  screen.bloom = 0.8 + 0.3 * open;
  screen.aberration = 1.5 * open;
}

/** The hands at time t: brass spines (flat) and their stars and light (glow). */
function hands(L: Layers, t: number, mono = 0) {
  const ang = handAngles(t);
  handSpine(L.flat, ang.h, HOUR.len, handGrow('h', t, pullK));
  handSpine(L.flat, ang.m, MINUTE.len, handGrow('m', t, pullK));
  handLight(L.glow, t, pullK, 1, mono > 0.5 ? '#ffe2a0' : '#fff1d0');
  handStars(L.flat, L.glow, t, 1, mono);
}

/**
 * 3.86 to 7.4 s: the brass rings fly in and lock one by one; stars are pulled out of the constellations into two hands,
 * which sweep round faster and faster towards the top.
 */
function clockBeat(L: Layers, t: number, screen: ScreenParams) {
  const clicks = [ARRIVE.gear, ARRIVE.tick, ARRIVE.armil, ARRIVE.hub].reduce((m, a) => Math.max(m, env(t, a + 0.48, a + 0.5, a + 0.53, a + 0.75)), 0);
  const race = easeIn(seg(t, 5.9, T_STOP));
  camera(L, 1 + 0.05 * race + 0.01 * clicks, 6 * clicks + 3 * race, t);
  spaceGround(L.flat);
  starField(L.flat, t, 1);
  ghostRings(L.glow, 1 - seg(t, BURN1, 4.5));
  skyConstellations(L.flat, L.glow, t, 1);
  clockBody(L.flat, t);
  clockRims(L.glow, t);
  coreStar(L.glow, t, arriveK(ARRIVE.hub, t), 0, 0.3 * race);
  hands(L, t);
  uncamera(L);
  screen.vignette = 0.35;
  screen.bloom = 1 + 0.25 * race;
  screen.aberration = 1 + 2 * clicks + 3 * race;
}

/**
 * 7.4 to 8.6 s: the hands meet at the top and time stops. One great tick; then everything holds still, grey but for the
 * gold; cracks run through the rings and the core's colour comes back, cyan, just before it breaks.
 */
function stoppedBeat(L: Layers, t: number, screen: ScreenParams) {
  const hit = env(t, T_STOP, T_STOP + 0.02, T_STOP + 0.06, T_STOP + 0.3);
  const tremble = seg(t, 8.05, WHITE);
  camera(L, 1.05 + 0.025 * easeOut(seg(t, T_STOP, T_STOP + 0.12)) + 0.02 * tremble, 16 * hit + 5 * tremble, t);
  const ts = T_STOP;
  spaceGround(L.flat, 1);
  starField(L.flat, ts, 1, 1);
  skyConstellations(L.flat, L.glow, ts, 1, 1);
  clockBody(L.flat, ts);
  // The great tick: a ring of gold thrown out from the meeting point, which stops where it is, mid-air.
  const ringR = 140 + 820 * easeOut(seg(t, T_STOP, T_STOP + 0.24));
  const top = { x: C.x, y: C.y - MINUTE.len };
  L.glow.beginPath();
  L.glow.arc(C.x, C.y, ringR, 0, Math.PI * 2);
  L.glow.strokeStyle = rgba(GOLD, 0.55 + 0.4 * hit);
  L.glow.lineWidth = 4 + 10 * hit;
  L.glow.stroke();
  frozenRays(L.glow, 0.5 + 0.5 * hit);
  clockRims(L.glow, ts, 1.2);
  hands({ flat: L.flat, glow: L.glow }, ts, 1);
  glint(L.glow, top, 40 + 30 * hit, 1, GOLD, 0);
  frozenDust(L.glow);
  cracks(L.glow, ts, seg(t, 8.0, 8.5));
  const back = seg(t, 8.25, WHITE);
  coreStar(L.glow, ts, 1, back < 0.05 ? 1 : 0, 0.2 + 1.6 * back);
  uncamera(L);
  screen.vignette = 0.5;
  screen.bloom = 1 + 0.4 * hit;
  screen.aberration = 0;
}

/** Thin gold lines frozen out from the clock, the tick's speed lines held still (glow). */
function frozenRays(ctx: Ctx, k: number) {
  const r = rng(707);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const a = r.range(0, Math.PI * 2), r0 = r.range(500, 640), r1 = r0 + r.range(160, 520);
    ctx.strokeStyle = rgba(GOLD, k * r.range(0.25, 0.55));
    ctx.lineWidth = r.range(1.2, 3);
    ctx.beginPath();
    ctx.moveTo(C.x + Math.cos(a) * r0, C.y + Math.sin(a) * r0);
    ctx.lineTo(C.x + Math.cos(a) * r1, C.y + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Specks of gold dust hanging still in the air (glow). */
function frozenDust(ctx: Ctx) {
  const r = rng(313);
  for (let i = 0; i < 70; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(120, 900);
    ctx.fillStyle = rgba('#ffe2a0', r.range(0.4, 0.9));
    ctx.beginPath();
    ctx.arc(C.x + Math.cos(a) * d, C.y + Math.sin(a) * d * 0.9, r.range(1.2, 3.2), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 8.6 to 8.77 s: a white frame, then an ink frame: the bursting clock in ink on the parchment, the star as black light. */
function impact(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  if (t < INKF) {
    L.flat.fillStyle = '#fffaf0';
    L.flat.fillRect(0, 0, 1920, 1080);
    return;
  }
  parchment(L.flat);
  inkRays(L.flat, 88, '#120f24');
  flyingShards(L.flat, 0.05, 'ink');
  const ang = handAngles(T_STOP);
  handSpine(L.flat, ang.m, MINUTE.len * 1.1, 1, 'ink');
  L.flat.fillStyle = '#120f24';
  starPath(L.flat, C, 330, 0.13);
  L.flat.fill();
  starPath(L.flat, C, 150, 0.13, Math.PI / 4);
  L.flat.fill();
  L.flat.beginPath();
  L.flat.arc(C.x, C.y, 44, 0, Math.PI * 2);
  L.flat.fillStyle = PARCH;
  L.flat.fill();
  screen.aberration = 7;
}

/** Every chart star, flying out from the clock as a streak of light, `u` seconds after the break (glow). */
function starStreaks(ctx: Ctx, u: number, k: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of ALL_STARS) {
    const p = skyPos(s.p, T_STOP);
    const f0 = 1 + 1.2 * u, f1 = 1 + 1.2 * Math.max(0, u - 0.12);
    const a = { x: C.x + (p.x - C.x) * f1, y: C.y + (p.y - C.y) * f1 }, b = { x: C.x + (p.x - C.x) * f0, y: C.y + (p.y - C.y) * f0 };
    ctx.strokeStyle = rgba('#e6fbff', 0.8 * k);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}

/**
 * 8.77 to 10.1 s: the clock bursts: brass shards fly out at the viewer, turning, in front of a cyan-white star flare and
 * speed lines; then the parchment floods back in as dots and one shard falls onto it.
 */
function burstBeat(L: Layers, t: number, screen: ScreenParams) {
  // Already in motion on its first frame: the ink frame showed the clock breaking.
  const u = t - INKF;
  const flood = easeInOut(seg(t, FLOOD0, FLOOD1));
  const glowK = 1 - smooth(seg(t, FLOOD0 - 0.1, FLOOD1 - 0.2));
  camera(L, 1.1 - 0.08 * easeOut(seg(u, 0, 0.8)), 12 * (1 - seg(u, 0, 0.7)), t);
  spaceGround(L.flat);
  starField(L.flat, T_STOP, 1 - seg(u, 0, 0.4));
  flyingShards(L.flat, u);
  flare(L.glow, u, glowK);
  starStreaks(L.glow, u, (1 - seg(u, 0.3, 0.8)) * glowK);
  speedLines(L.glow, C, t, env(u, 0, 0.04, 0.45, 0.75) * glowK);
  // The shards stand in front of the light: cut them out of the glow layer.
  L.glow.save();
  L.glow.globalCompositeOperation = 'destination-out';
  flyingShards(L.glow, u, 'ink');
  L.glow.restore();
  uncamera(L);
  paperFlood(L.flat, flood, (c) => paperScene(c, t));
  if (t > LAND0) landingShard(L.flat, t);
  screen.vignette = 0.4 * (1 - flood);
  screen.bloom = (1.3 - 0.4 * seg(u, 0, 0.8)) * (1 - 0.3 * flood);
  screen.aberration = 7 * (1 - seg(u, 0, 0.7)) + 1;
}

/** The parchment at the end: the chart, every star lit, the new star being drawn in (flat). */
function paperScene(ctx: Ctx, t: number) {
  chartFull(ctx, t, true);
  newStar(ctx, seg(t, STAR0, STAR0 + 0.8));
}

/** The XII shard falling onto the paper, turning, and settling with its shadow (flat). */
function landingShard(ctx: Ctx, t: number) {
  const k = seg(t, LAND0, LAND1), e = easeOutBack(k, 1.1);
  const rest = { x: 650, y: 850 };
  const at = { x: lerp(C.x + 260, rest.x, easeOut(k)), y: lerp(C.y - 220, rest.y, e) };
  const scale = lerp(3.6, 1.75, easeOut(k));
  const spin = lerp(2.8, -0.42, easeOut(k));
  const sh = 6 + 30 * (1 - easeOut(k));
  ctx.save();
  ctx.globalAlpha = 0.28 * clamp(k * 2);
  drawShard(ctx, XII, 0, { x: at.x + sh, y: at.y + sh * 1.2 }, spin, scale, 'ink');
  ctx.restore();
  drawShard(ctx, XII, 0, at, spin, scale);
}

/** 10.1 s to the end: the chart on parchment, the new star drawn in where the hands met, the shard, and the seal. */
function ending(L: Layers, t: number, screen: ScreenParams) {
  camera(L, 1 + 0.015 * seg(t, FLOOD1, DURATION), 0, t);
  paperScene(L.flat, t);
  landingShard(L.flat, t);
  const s = seg(t, STAR0 + 0.2, STAR0 + 0.6);
  if (s > 0) glint(L.glow, NEW_STAR, 8 + 18 * Math.exp(-(t - STAR0 - 0.4) * 5), 0.7 * s, '#bff6ff', 0.3);
  uncamera(L);
  seal(L.flat, 1560, 790, 190, seg(t, SEAL0, SEAL0 + 0.3), '刻', SEAL);
  screen.vignette = 0;
  screen.bloom = 0.7;
}

const piece: Piece = {
  id: 'clockwork',
  title: 'Celestial Clockwork',
  subtitle: 'Seikoku · The Stopped Hour',
  about: 'An old star chart burns away into space; brass rings and hands of stars make a clock that sweeps to the top, stops time, and bursts into shards and a star.',
  order: 90,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '天時星刻・停止' },
  draw: drawFrame,
};
export default piece;
