import type { Beat, Layers, Piece } from '../piece';
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, env, lerp, quietScreen, rgba, seg, smooth, wobble, type Pt, type ScreenParams } from '../core';
import { paper, seal, specks, titleCard, type TitleText } from '../art/paper';
import { birdFlat, birdGeometry, birdGlow, birdSilhouette, type BirdPose } from '../art/phoenix/bird';
import {
  HEAP, ashChunks, ashMotes, blackBurst, cracks, emberFlat, emberGlow, goldFeather, heapFlat, heapTop, heatRings, sprout, type HeapAt,
} from '../art/phoenix/ash';
import { darkGround, fireColumn, halo, inkLines, risingEmbers, rushLines, shockRing, sunBurst, sunRays } from '../art/phoenix/fire';

/**
 * Phoenix Rebirth: Kaijin, From the Ashes. The sequence, beat by beat, as a pure function of time.
 *
 * A heap of grey ash on cream paper with one ember in it; the ember breathes and cracks of light run through the ash; the
 * heap bursts, the ground goes black and a firebird of ash rises out of a column of fire; it spreads its wings across the
 * frame and they catch fire feather by feather; it cries (an ink frame) under a halo; it dives at the viewer and becomes a
 * sun; white; back on the paper one golden feather drifts down beside a green sprout in the ash, and the seal.
 */

const DURATION = 13.6;
const BURST = 3.4;
const CRY = 7.2;
const DIVE = 8.1;
const WHITE = 9.4;
const SEAL = 12.1;

const BEATS: Beat[] = [
  { name: 'The ash', t0: 0, t1: 1.4 },
  { name: 'The ember breathes', t0: 1.4, t1: BURST },
  { name: 'The burst', t0: BURST, t1: 3.8 },
  { name: 'The rise', t0: 3.8, t1: 5.25 },
  { name: 'The wings catch', t0: 5.25, t1: CRY },
  { name: 'The cry', t0: CRY, t1: DIVE },
  { name: 'The dive', t0: DIVE, t1: WHITE },
  { name: 'The feather', t0: WHITE, t1: SEAL },
  { name: 'The seal', t0: SEAL, t1: DURATION },
];

const TITLE: TitleText = {
  kanji: '鳳凰', english: 'PHOENIX REBIRTH', move: '灰燼・転生', romaji: 'KAIJIN · FROM THE ASHES', colors: ['#fff1b8', '#ffa632', '#d2281c'],
};

const BIG_HEAP: HeapAt = { x: HEAP.x, y: HEAP.y, s: 1 };
const SMALL_HEAP: HeapAt = { x: 960, y: 930, s: 0.7 };
/** Where the bird's body is while it cries: the halo's centre. */
const PERCH = { x: 960, y: 470 };

function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < BURST) paperBeats(L, t, screen);
  else if (t < DIVE) darkBeats(L, t, screen);
  else if (t < WHITE) dive(L, t, screen);
  else rebirth(L, t, screen);
  // The title, on the flat layer, over the paper; it goes with the burst.
  titleCard(L.flat, seg(t, 0.15, 0.55) * (1 - seg(t, BURST + 0.02, BURST + 0.12)), false, TITLE);
  return screen;
}

/** A push and a shake for both layers round `c`, then moving `c` by (dx, dy). */
function camera(L: Layers, c: Pt, zoom: number, shake = 0, t = 0, dx = 0, dy = 0) {
  const wx = wobble(5)(t * 31) * shake, wy = wobble(9)(t * 27) * shake;
  for (const ctx of [L.flat, L.glow]) {
    ctx.save();
    ctx.translate(c.x + wx + dx, c.y + wy + dy);
    ctx.scale(zoom, zoom);
    ctx.translate(-c.x, -c.y);
  }
}
const uncamera = (L: Layers) => { L.flat.restore(); L.glow.restore(); };

/** The ember's breath, 0 to 1: slow at first, quicker as it wakes. */
const breath = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * 2 * (0.55 * t + 0.11 * t * t));
/** How hot the heap is inside, just before it bursts. */
const heapHeat = (t: number) => easeIn(seg(t, 2.5, BURST));
/** How far the cracks have run from the ember. */
const crackReach = (t: number) => 430 * easeOut(seg(t, 1.45, 3.15));

/** The paper scene of the first beats (both layers); the burst draws it too, under the black. */
function paperScene(L: Layers, t: number) {
  const top = heapTop(BIG_HEAP);
  const heat = heapHeat(t);
  const b = breath(t);
  paper(L.flat);
  ashMotes(L.flat, t, 0.85, 5, 46);
  heapFlat(L.flat, BIG_HEAP, heat);
  heatRings(L.flat, top, b, 0.35 + 0.35 * seg(t, 1.0, 2.5) + 0.3 * heat);
  const light = smooth(seg(t, 1.5, 2.4));
  cracks(L.flat, L.glow, BIG_HEAP, crackReach(t), light * (0.75 + 0.25 * b));
  emberFlat(L.flat, top, b);
  emberGlow(L.glow, top, b, 0.55 + 0.45 * seg(t, 1.2, 3.0) + 0.3 * heat);
}

/** 0 to 3.4 s: the heap and its ember on the paper; the ember breathes, cracks of light run through the ash; it heats. */
function paperBeats(L: Layers, t: number, screen: ScreenParams) {
  const heat = heapHeat(t);
  camera(L, { x: 960, y: 760 }, 1 + 0.08 * easeInOut(seg(t, 0, BURST)), 6 * heat, t);
  paperScene(L, t);
  uncamera(L);
  screen.vignette = 0.1 * heat;
  screen.aberration = 3 * heat;
  // A small pulse of light with each breath once it is awake.
  screen.flash = 0.05 * heat * breath(t);
}

/** The bird's pose from the burst to the dive. */
function risePose(t: number): BirdPose {
  const rise = easeOut(seg(t, BURST + 0.12, 5.05));
  const spread = easeInOut(seg(t, 5.25, 6.45));
  const hold = seg(t, CRY + 0.1, CRY + 0.5);
  return {
    x: 960 + 6 * Math.sin(t * 1.3),
    y: lerp(lerp(1500, 520, rise), PERCH.y, spread) + 8 * Math.sin(t * 2.1) * spread,
    s: lerp(lerp(0.66, 0.84, rise), 0.97, spread),
    spread,
    flap: (0.28 * Math.sin(t * 5.5) * (1 - spread) * rise) + 0.3 * Math.sin((t - CRY) * 4.2) * hold,
    lift: lerp(0.1, 0.55, rise) + 0.45 * spread,
    beak: env(t, CRY - 0.08, CRY + 0.02, 7.55, 7.85),
    ignite: lerp(0, 1.22, seg(t, 5.3, 7.12)),
    ember: (0.5 + 0.5 * rise) * (1 - seg(t, 6.6, 7.2)),
    heat: 0,
    t,
  };
}

/**
 * 3.4 to 8.1 s: the black bursts out of the heap with the ash; a column of fire; the firebird, still ash, rises out of it;
 * its wings open across the frame and catch fire feather by feather; the cry (an ink frame), the halo, the shock ring.
 */
function darkBeats(L: Layers, t: number, screen: ScreenParams) {
  const age = t - BURST;
  const burst = easeOut(seg(t, BURST, BURST + 0.2));
  if (t > CRY && t < CRY + 0.1) return inkFrame(L, t, screen);
  const shake = 9 * (1 - seg(t, BURST, BURST + 0.5)) + 7 * (1 - seg(t, CRY + 0.1, CRY + 0.6)) * (t > CRY ? 1 : 0);
  camera(L, { x: 960, y: 600 }, 1 + 0.03 * seg(t, BURST, DIVE), shake, t);
  // The paper with the heap, swallowed by the black from the heap outward.
  if (burst < 1) {
    paperScene(L, BURST);
    L.glow.clearRect(-200, -200, 2400, 1500);
  }
  blackBurst(L.flat, { x: HEAP.x, y: HEAP.y - 100 }, burst, t, (c) => darkGround(c));
  const p = risePose(t);
  const ig = clamp(p.ignite);
  sunRays(L.flat, { x: p.x, y: p.y }, smooth(seg(t, 5.8, CRY)) * 0.6 + 0.4 * seg(t, CRY, CRY + 0.3), t);
  ashChunks(L.flat, L.glow, age, 1 - seg(t, 4.7, 5.4));
  // Behind the bird (glow): embers, the column of fire, the halo.
  risingEmbers(L.glow, t, 0.35 + 0.65 * ig, 77, 70 + Math.round(50 * ig));
  fireColumn(L.glow, { x: HEAP.x, y: 1080 }, t, easeOut(seg(t, BURST, BURST + 0.45)), (1 - 0.7 * smooth(seg(t, 3.85, 4.6)) - 0.3 * seg(t, 4.6, 5.8)) * burst, 0.95);
  shockRing(L.glow, { x: HEAP.x, y: 860 }, seg(t, BURST, BURST + 0.7), 1500);
  halo(L.glow, { x: p.x, y: p.y - 60 }, 430, seg(t, CRY + 0.1, CRY + 0.55), t);
  const g = birdGeometry(p);
  birdFlat(L.flat, g);
  birdGlow(L.glow, g);
  shockRing(L.glow, { x: p.x, y: p.y - 60 }, seg(t, CRY + 0.1, CRY + 0.85), 1500);
  uncamera(L);
  screen.flash = 0.7 * (1 - seg(t, BURST, BURST + 0.1)) ** 2 + 0.35 * (t > CRY ? (1 - seg(t, CRY + 0.1, CRY + 0.22)) ** 2 : 0);
  screen.invert = env(t, BURST + 0.03, BURST + 0.035, BURST + 0.08, BURST + 0.085);
  screen.vignette = 0.4;
  screen.aberration = 1 + 6 * (1 - seg(t, BURST, BURST + 0.5)) + 5 * (t > CRY ? 1 - seg(t, CRY + 0.1, CRY + 0.6) : 0);
  screen.bloom = 1 + 0.35 * env(t, CRY + 0.1, CRY + 0.15, CRY + 0.3, CRY + 0.8);
}

/** The cry's impact frame: the bird in ink on the cream paper, a crimson sun behind it, ink lines rushing out. */
function inkFrame(L: Layers, t: number, screen: ScreenParams) {
  const p = risePose(t);
  paper(L.flat);
  inkLines(L.flat, { x: p.x, y: p.y - 60 }, t, '#1a0d08');
  L.flat.fillStyle = '#c51f26';
  L.flat.beginPath();
  L.flat.arc(p.x, p.y - 60, 400, 0, Math.PI * 2);
  L.flat.fill();
  birdSilhouette(L.flat, birdGeometry(p), '#140906', 8);
  screen.vignette = 0;
  screen.aberration = 7;
  screen.bloom = 0.5;
}

/**
 * The dive's pose: from the hover (carried on without a seam), a pull back with the wings raised, then a rush at the
 * viewer, white-hot.
 */
function divePose(t: number) {
  const a = easeInOut(seg(t, DIVE, DIVE + 0.38));
  const rush = easeIn(seg(t, DIVE + 0.32, 8.98));
  const base = risePose(t);
  return {
    pose: {
      ...base, spread: 1 - 0.3 * a, flap: lerp(base.flap, -0.75, a), y: base.y - 30 * a, s: base.s * (1 - 0.07 * a), beak: 0,
      heat: 0.2 * a + 0.8 * rush, ignite: 1.22, ember: 0,
    },
    a,
    rush,
  };
}

/** 8.1 to 9.4 s: the dive. It draws back, rushes at the viewer white-hot, becomes a sun, and the frame goes white. */
function dive(L: Layers, t: number, screen: ScreenParams) {
  const { pose, rush, a } = divePose(t);
  // The hover's slight push, carried over and let go.
  camera(L, { x: 960, y: 600 }, 1 + 0.03 * (1 - a), 0, t);
  darkGround(L.flat);
  sunRays(L.flat, { x: lerp(pose.x, 960, rush), y: lerp(pose.y, 540, rush) }, 1 - rush, t);
  risingEmbers(L.glow, t, 1 - rush, 77, 120);
  halo(L.glow, { x: pose.x, y: pose.y - 60 }, 430 * (1 + 0.5 * rush), 1 - seg(t, DIVE + 0.2, DIVE + 0.5), t);
  const zoom = 1 + 3.2 * rush;
  camera(L, { x: pose.x, y: pose.y }, zoom, 0, t, (960 - pose.x) * rush, (540 - pose.y) * rush);
  const g = birdGeometry(pose);
  birdFlat(L.flat, g);
  birdGlow(L.glow, g);
  uncamera(L);
  uncamera(L);
  rushLines(L.glow, { x: 960, y: 540 }, t, env(t, DIVE + 0.35, DIVE + 0.45, 9.05, 9.25));
  const sun = easeOut(seg(t, 8.6, 9.25));
  sunBurst(L.glow, { x: 960, y: 540 }, lerp(30, 820, sun), seg(t, 8.58, 8.7), t);
  screen.flash = smooth(seg(t, 9.12, 9.32));
  screen.aberration = 1 + 9 * rush;
  screen.vignette = 0.4 * (1 - rush);
  screen.bloom = 1 + 0.4 * rush;
}

/** Where the feather comes to rest: lying down the heap's right slope, beside the sprout. */
const REST = { x: 1030, y: 772, ang: 0.56 };

/** The feather's path from the white down to the ash: swaying and rocking, always right of the sprout, slowing to land. */
function featherAt(t: number) {
  const k = seg(t, WHITE + 0.1, 11.45);
  const fall = 1 - (1 - k) ** 1.25;
  const sway = Math.sin(k * Math.PI * 2.6 + 0.4) * (1 - k) ** 0.9;
  return {
    at: { x: lerp(1260, REST.x, smooth(k)) + 130 * sway, y: lerp(-40, REST.y, fall) - 30 * Math.abs(sway) },
    ang: lerp(-0.2, REST.ang, smooth(k)) + 0.5 * Math.sin(k * Math.PI * 2.6 + 1.9) * (1 - k),
    k,
  };
}

/** 9.4 s to the end: the white fades to the paper; a cooled heap; a sprout grows; the golden feather lands; the seal. */
function rebirth(L: Layers, t: number, screen: ScreenParams) {
  camera(L, { x: 960, y: 770 }, 1.34 - 0.06 * easeOut(seg(t, WHITE, 12.5)), 0, t);
  paper(L.flat);
  ashMotes(L.flat, t, 0.6, 9, 28);
  specks(L.flat, 33, 30, 0.7 * seg(t, 10.0, 11.0), { x: 300, y: 300, w: 1320, h: 700 }, ['#d9a03a', '#9a948c', '#b5afa7']);
  heapFlat(L.flat, SMALL_HEAP, 0, true);
  const top = heapTop(SMALL_HEAP);
  sprout(L.flat, { x: top.x - 6, y: top.y + 4 }, easeOut(seg(t, 9.95, 10.9)), easeOutBack(seg(t, 10.45, 11.25), 1.6), t);
  const f = featherAt(t);
  // Where it lands, a small puff of ash.
  const puff = seg(t, 11.42, 12.0);
  if (puff > 0 && puff < 1) {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (i / 11) * Math.PI;
      const d = 30 + 110 * easeOut(puff);
      L.flat.fillStyle = rgba('#8a847d', 0.8 * (1 - puff));
      L.flat.beginPath();
      L.flat.arc(1150 + Math.cos(a) * d * 1.6, 850 + Math.sin(a) * d * 0.4, 4 + 3 * (i % 3), 0, Math.PI * 2);
      L.flat.fill();
    }
  }
  goldFeather(L.flat, f.at, f.ang, 270, 0.22 - 0.16 * f.k);
  // A few gold glints trailing the feather as it falls (glow; small, the paper must not bleach).
  for (let i = 0; i < 6; i++) {
    const back = featherAt(t - 0.08 * (i + 1));
    const a = (1 - i / 6) * (1 - seg(t, 11.2, 11.6)) * seg(t, WHITE + 0.3, WHITE + 0.6);
    if (a <= 0) continue;
    L.glow.fillStyle = rgba('#ffcf6a', 0.7 * a);
    L.glow.beginPath();
    L.glow.arc(back.at.x + Math.cos(back.ang) * 245, back.at.y + Math.sin(back.ang) * 245, 4 - i * 0.4, 0, Math.PI * 2);
    L.glow.fill();
  }
  uncamera(L);
  seal(L.flat, 1500, 430, 210, seg(t, SEAL, SEAL + 0.3), '鳳', '#c51f26');
  screen.vignette = 0;
  screen.flash = 1 - smooth(seg(t, WHITE, 10.0)) + 0.1 * env(t, SEAL, SEAL + 0.05, SEAL + 0.08, SEAL + 0.25);
  screen.aberration = 2 * (1 - seg(t, WHITE, 10.0));
}

const piece: Piece = {
  id: 'phoenix',
  title: 'Phoenix Rebirth',
  subtitle: 'Kaijin · From the Ashes',
  about: 'The last ember in a heap of ash breathes and bursts; a firebird rises, spreads its burning wings, dives as a sun, and leaves one golden feather beside a green sprout.',
  order: 60,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '鳳凰灰燼・転生' },
  draw: drawFrame,
};
export default piece;

