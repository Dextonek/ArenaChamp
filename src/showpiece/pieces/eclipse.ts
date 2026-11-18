import type { Beat, Layers, Piece } from '../piece';
import { easeIn, easeInOut, easeOut, env, quietScreen, rgba, seg, smooth, wobble, type Ctx, type ScreenParams } from '../core';
import { paper, seal, specks } from '../art/paper';
import { paperFlood, speedLines } from '../art/ink';
import { eclipseTitle } from '../art/eclipse/title';
import {
  BONE, C, INK, MOON_R, TOTAL, blackDisc, clipNight, corona, diamond, flatCorona, inkSun, moonAt, moonTrail, nightGround, nightHint, orbitArcs, paperLines,
  paperMoon, sunSliver, wipeDots,
} from '../art/eclipse/sky';
import { CHAINS, LOCK, drawChains, ringBurst } from '../art/eclipse/chains';
import { beam, chainShards, inflow, inkLines, iris, settlingShards, sigilRings } from '../art/eclipse/gate';

/**
 * Black Sun Eclipse: Shokkai, the Heaven Gate. The sequence, beat by beat, as a pure function of time.
 *
 * A pale sun brushed in ink on paper; a black moon creeps over it and the night wipes across; the diamond ring, then the
 * corona's thin pale-gold ring and long streamers. Chains of shadow lash out from the black sun and lock in an X; rings of
 * violet sigils turn round it and the black disc opens like an iris, a gate onto magenta-white light; the beam bursts out
 * at the viewer and the chains shatter into black shards; the paper comes back, the sun is a plain ink circle again, a
 * few shards settle, and the seal.
 */

const DURATION = 13.6;

const BEATS: Beat[] = [
  { name: 'The pale sun', t0: 0, t1: 1.9 },
  { name: 'Night falls', t0: 1.9, t1: TOTAL },
  { name: 'The corona', t0: TOTAL, t1: 4.3 },
  { name: 'Chains of shadow', t0: 4.3, t1: 6.5 },
  { name: 'The heaven gate', t0: 6.5, t1: 8.9 },
  { name: 'The beam', t0: 8.9, t1: 9.75 },
  { name: 'Shards fall', t0: 9.75, t1: 11.6 },
  { name: 'The seal', t0: 11.6, t1: DURATION },
];

/** When the gate opens, the white frame, the ink frame, the beam, and the chains breaking. */
const OPEN0 = 7.95, OPEN1 = 8.75;
const WHITE = 8.9, INKF = 8.96, BEAM = 9.1, BREAK = 9.32;
/** The night wiping across. */
const WIPE0 = 1.9, WIPE1 = 2.5;

/** The black sun's heartbeats before the chains lash out. */
const PULSES = [3.4, 3.9];

const wipeAt = (t: number) => easeInOut(seg(t, WIPE0, WIPE1));

function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < TOTAL) paperSun(L, t, screen);
  else if (t < WHITE) nightBeats(L, t, screen);
  else if (t < BEAM) impact(L, t, screen);
  else if (t < 10.6) beamBeat(L, t, screen);
  else ending(L, t, screen);
  // The title, on the flat layer and outside the camera; the glow under it is wiped away so nothing glows through.
  const k = smooth(seg(t, 0.05, 0.28)) * (1 - seg(t, 4.0, 4.3));
  if (k > 0) {
    clearTitleGlow(L.glow, k);
    eclipseTitle(L.flat, k, t >= WIPE0 + 0.4);
  }
  return screen;
}

function clearTitleGlow(ctx: Ctx, k: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(240, 150, 120, 240, 150, 560);
  g.addColorStop(0, `rgba(0,0,0,${k})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 820, 720);
  ctx.restore();
}

/** A gentle push and shake for both layers, round the sun. */
function camera(L: Layers, zoom: number, shake: number, t: number) {
  const wx = wobble(5)(t * 31) * shake, wy = wobble(9)(t * 29) * shake;
  for (const c of [L.flat, L.glow]) {
    c.save();
    c.translate(C.x + wx, C.y + wy);
    c.scale(zoom, zoom);
    c.translate(-C.x, -C.y);
  }
}
const uncamera = (L: Layers) => { L.flat.restore(); L.glow.restore(); };

/**
 * 0 to 2.74 s: the pale sun is brushed on the paper in one ink stroke; the black moon creeps in from the right and over
 * it; the night wipes across the paper behind the moon, and the last bead of sun flares as the diamond ring.
 */
function paperSun(L: Layers, t: number, screen: ScreenParams) {
  const p = wipeAt(t);
  camera(L, 1 + 0.025 * seg(t, 0, TOTAL), 0, t);
  paper(L.flat);
  paperLines(L.flat, easeOut(seg(t, 0, 0.7)));
  nightHint(L.flat, smooth(seg(t, 0.2, 1.9)));
  orbitArcs(L.flat, t, easeOut(seg(t, 0, 0.9)));
  specks(L.flat, 71, 40, 0.8, undefined, [INK, '#5b2fb0', '#9a9590']);
  inkSun(L.flat, easeOut(seg(t, 0, 0.3)), smooth(seg(t, 0.1, 0.5)));
  const moon = moonAt(t);
  moonTrail(L.flat, moon, 1 - 0.6 * seg(t, 1.6, 2.4));
  paperMoon(L.flat, moon);
  if (p > 0) {
    wipeDots(L.flat, p);
    L.flat.save();
    clipNight(L.flat, p);
    nightGround(L.flat);
    L.flat.beginPath();
    L.flat.arc(moon.x, moon.y, MOON_R, 0, Math.PI * 2);
    L.flat.fillStyle = '#07040b';
    L.flat.fill();
    L.flat.restore();
    L.glow.save();
    clipNight(L.glow, p);
    sunSliver(L.glow, moon, 1);
    diamond(L.glow, env(t, 2.4, 2.62, 2.68, 2.82), t);
    L.glow.restore();
  }
  uncamera(L);
  screen.vignette = 0.4 * p;
  screen.bloom = 1 + 0.4 * env(t, 2.4, 2.6, 2.7, 2.82);
}

/** The gate's opening (0 to 1) at time t. */
const openAt = (t: number) => easeInOut(seg(t, OPEN0, OPEN1));

/**
 * 2.74 to 8.9 s, on the night: totality and the corona; the chains lash out and lock in an X (an ink frame at the lock);
 * the sigil rings draw on and turn; the black disc's blades show and open like an iris; light pours in as it charges.
 */
function nightBeats(L: Layers, t: number, screen: ScreenParams) {
  if (t >= LOCK && t < LOCK + 0.07) { lockFrame(L, t, screen); return; }
  const h = openAt(t);
  const charge = smooth(seg(t, 8.1, 8.88));
  const lockShake = 12 * env(t, LOCK + 0.07, LOCK + 0.08, LOCK + 0.12, LOCK + 0.45);
  const beat = PULSES.reduce((m, p) => Math.max(m, env(t, p, p + 0.04, p + 0.08, p + 0.35)), 0);
  camera(L, 1.025 + 0.03 * seg(t, TOTAL, 6.5) + 0.014 * beat + 0.06 * easeIn(seg(t, 7.8, 8.9)), lockShake + 5 * charge, t);
  const ringsK = smooth(seg(t, 6.45, 6.9));
  const seams = smooth(seg(t, 6.9, 7.6));
  // Flat: night, the corona's dots, the rings' dark bands, the chains, the disc.
  nightGround(L.flat);
  flatCorona(L.flat, smooth(seg(t, TOTAL, 3.4)) * (1 - 0.6 * ringsK));
  sigilRings(L.flat, t, 'flat', ringsK, h);
  drawChains(L.flat, t, 'flat', 1 - seg(t, LOCK, LOCK + 0.8));
  blackDisc(L.flat);
  if (seams > 0 || h > 0) iris(L.flat, t, h, seams, 'flat');
  // Glow: the corona and the diamond ring, the chains' glints, the disc cut out, the rings, the gate's light.
  const coronaK = smooth(seg(t, TOTAL - 0.02, TOTAL + 0.08)) * (1 - 0.5 * ringsK);
  corona(L.glow, t, coronaK, easeOut(seg(t, TOTAL, 3.9)) * (1 + 0.06 * beat), env(t, TOTAL, TOTAL + 0.03, TOTAL + 0.08, 3.2) + 0.5 * beat);
  // The black sun's two heartbeats before the chains: rings of violet light thrown out.
  for (const p of PULSES) {
    const pk = seg(t, p, p + 0.7);
    if (pk <= 0 || pk >= 1) continue;
    L.glow.beginPath();
    L.glow.arc(C.x, C.y, MOON_R + 16 + 760 * easeOut(pk), 0, Math.PI * 2);
    L.glow.strokeStyle = rgba('#b98cff', 0.55 * (1 - pk));
    L.glow.lineWidth = 9 * (1 - pk) + 1;
    L.glow.stroke();
  }
  diamond(L.glow, env(t, 2.4, 2.62, 2.68, 2.82), t);
  drawChains(L.glow, t, 'glow');
  blackDisc(L.glow);
  if (seams > 0 || h > 0) iris(L.glow, t, h, seams, 'glow', 0.8 + 0.4 * charge);
  sigilRings(L.glow, t, 'glow', ringsK * (0.8 + 0.4 * charge), h);
  inflow(L.glow, t, charge);
  // The lock: a ring of violet light round the sun and bursts where the chains bite.
  const after = seg(t, LOCK + 0.07, LOCK + 0.6);
  if (after > 0 && after < 1) {
    L.glow.beginPath();
    L.glow.arc(C.x, C.y, MOON_R + 30 + 700 * Math.sqrt(after), 0, Math.PI * 2);
    L.glow.strokeStyle = rgba('#c49bff', 0.7 * (1 - after));
    L.glow.lineWidth = 10 * (1 - after) + 2;
    L.glow.stroke();
    for (const ch of CHAINS) {
      ringBurst(L.glow, { x: C.x + Math.cos(ch.angle) * MOON_R, y: C.y + Math.sin(ch.angle) * MOON_R }, after, 0.8);
    }
  }
  uncamera(L);
  screen.vignette = 0.3;
  screen.bloom = 1 + 0.5 * env(t, TOTAL, TOTAL + 0.04, TOTAL + 0.1, 3.3) + 0.4 * charge;
  screen.flash = 0.6 * env(t, TOTAL, TOTAL + 0.005, TOTAL + 0.03, TOTAL + 0.045);
  screen.aberration = 1 + 5 * env(t, LOCK + 0.07, LOCK + 0.08, LOCK + 0.15, LOCK + 0.5) + 4 * charge;
}

/** The lock's impact frame: everything in ink on bone paper, with speed lines. */
function lockFrame(L: Layers, t: number, screen: ScreenParams) {
  L.flat.fillStyle = BONE;
  L.flat.fillRect(0, 0, 1920, 1080);
  inkLines(L.flat, t, INK);
  drawChains(L.flat, LOCK + 0.1, 'ink');
  blackDisc(L.flat, MOON_R + 6, INK);
  L.flat.beginPath();
  L.flat.arc(C.x, C.y, MOON_R + 22, 0, Math.PI * 2);
  L.flat.strokeStyle = '#e0389e';
  L.flat.lineWidth = 6;
  L.flat.stroke();
  screen.vignette = 0;
  screen.aberration = 6;
}

/** 8.9 to 9.1 s: a white frame, then an ink frame of the opened gate. */
function impact(L: Layers, t: number, screen: ScreenParams) {
  if (t < INKF) {
    L.flat.fillStyle = '#fff4fb';
    L.flat.fillRect(0, 0, 1920, 1080);
    screen.flash = 0.3;
    screen.vignette = 0;
    return;
  }
  L.flat.fillStyle = BONE;
  L.flat.fillRect(0, 0, 1920, 1080);
  inkLines(L.flat, t, INK);
  sigilRings(L.flat, 8.9, 'ink', 1, 1);
  drawChains(L.flat, 8.9, 'ink');
  iris(L.flat, 8.9, 1, 1, 'ink');
  // The one colour in the ink frame: the gate's hole in magenta.
  L.flat.save();
  L.flat.beginPath();
  L.flat.arc(C.x, C.y, MOON_R * 0.74, 0, Math.PI * 2);
  L.flat.clip();
  L.flat.globalCompositeOperation = 'multiply';
  L.flat.fillStyle = '#e0389e';
  L.flat.fillRect(C.x - MOON_R, C.y - MOON_R, MOON_R * 2, MOON_R * 2);
  L.flat.restore();
  screen.vignette = 0;
  screen.aberration = 7;
}

/** The paper as it comes back: the sheet, the lines, the sun brushed again, the shards coming down. */
function paperScene(ctx: Ctx, t: number) {
  paper(ctx);
  paperLines(ctx, 1);
  orbitArcs(ctx, t, easeOut(seg(t, 10.3, 11.2)));
  specks(ctx, 71, 40, 0.8, undefined, [INK, '#5b2fb0', '#9a9590']);
  inkSun(ctx, easeOut(seg(t, 10.0, 10.55)), smooth(seg(t, 10.3, 11.0)));
  settlingShards(ctx, t);
}

/**
 * 9.1 to 10.6 s: the beam bursts out of the gate at the viewer; the chains stand black against it, then break into shards
 * that fly out at the camera; the paper floods back in as dots and the sun is brushed again.
 */
function beamBeat(L: Layers, t: number, screen: ScreenParams) {
  const flood = easeInOut(seg(t, 9.7, 10.45));
  const glowK = 1 - smooth(seg(t, 9.6, 10.1));
  const k = seg(t, BEAM, 9.8);
  camera(L, 1.09 - 0.06 * easeOut(seg(t, BEAM, 9.7)), 9 * (1 - seg(t, BEAM, 9.7)), t);
  nightGround(L.flat);
  L.flat.fillStyle = 'rgba(5,2,10,0.45)';
  L.flat.fillRect(-200, -200, 2320, 1480);
  sigilRings(L.flat, t, 'flat', 1 - seg(t, BEAM, 9.4), 1);
  iris(L.flat, t, 1, 1, 'flat');
  beam(L.glow, t, k, 1 - glowK);
  speedLines(L.glow, C, t, env(t, BEAM, BEAM + 0.05, 9.45, 9.7));
  if (t < BREAK) drawChains(L.glow, 8.9, 'cut');
  else {
    chainShards(L.glow, t, BREAK, 'cut');
    chainShards(L.glow, t, BREAK, 'glow');
  }
  uncamera(L);
  paperFlood(L.flat, flood, (c) => paperScene(c, t));
  screen.bloom = 0.85 - 0.35 * flood;
  screen.vignette = 0.35 * (1 - flood);
  screen.aberration = 8 * (1 - seg(t, BEAM, 9.7)) + 1;
}

/** 10.6 s to the end: the paper, the sun as a plain ink circle, the shards settling, and the seal. */
function ending(L: Layers, t: number, screen: ScreenParams) {
  camera(L, 1 + 0.012 * seg(t, 10.6, 13.6), 0, t);
  paperScene(L.flat, t);
  uncamera(L);
  seal(L.flat, 1400, 700, 200, seg(t, 12.3, 12.6), '蝕', '#4a1f86');
  screen.vignette = 0;
  screen.flash = 0.12 * env(t, 12.3, 12.35, 12.37, 12.55);
}

const piece: Piece = {
  id: 'eclipse',
  title: 'Black Sun Eclipse',
  subtitle: 'Shokkai · The Heaven Gate',
  about: 'A pale ink sun on paper is eclipsed by a black moon; chains of shadow lock it in an X, it opens as a gate of sigils and fires a beam, and the paper comes back.',
  order: 70,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '黒陽蝕界・天門' },
  draw: drawFrame,
};
export default piece;
