import type { Beat, Layers, Piece } from '../piece';
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, env, lerp, quietScreen, rgba, ribbon, seg, smooth, wobble, type Ctx, type Pt, type ScreenParams } from '../core';
import { paper, seal } from '../art/paper';
import {
  BLADES, CORE, LOTUS, bladeCutout, bladeFlat, bladeGlow, coreGlow, icePad, lotusFlat, lotusLight, lotusInk, mandala, padCutout,
  type BladePose, type LotusState,
} from '../art/frost/lotus';
import {
  FREEZE, FREEZE_AT, SHARDS, crackPath, frostDraw, frostTips, frostTitle, frostTree, frozenGround, mist, nightFlood, nightGround,
  shardMotion, shardPath, shardVisible, snowDust, snowfall, warmSheets, type FrostRoot,
} from '../art/frost/ice';

/**
 * Frost Lotus: Hakka, the Still World. The sequence, beat by beat, as a pure function of time.
 *
 * A closed lotus of ice on paper breathes cold mist; frost creeps across the paper in ink and lights up; the night floods
 * in and the lotus opens petal by petal before turning snowflake mandalas; a ring of ice blades forms, charges and fires,
 * and the world freezes white; the ice cracks and falls away in shards onto snowy paper, the lotus closes, and the seal.
 */

const DURATION = 13.6;

const BEATS: Beat[] = [
  { name: 'The bud', t0: 0, t1: 1.4 },
  { name: 'Frost creeps', t0: 1.4, t1: 3.1 },
  { name: 'Night falls', t0: 3.1, t1: 4.0 },
  { name: 'The lotus opens', t0: 4.0, t1: 6.6 },
  { name: 'The ring of blades', t0: 6.6, t1: 8.56 },
  { name: 'The still world', t0: 8.56, t1: 9.45 },
  { name: 'The cracks', t0: 9.45, t1: 10.0 },
  { name: 'Shatter', t0: 10.0, t1: 11.3 },
  { name: 'Snow on paper', t0: 11.3, t1: 12.5 },
  { name: 'The seal', t0: 12.5, t1: DURATION },
];

const TITLE = { kanji: '氷蓮', english: 'FROST LOTUS', move: '白華・絶界', romaji: 'HAKKA · THE STILL WORLD', colors: ['#ffffff', '#7fe6ff', '#2a62d0'] as [string, string, string] };

/** The frost that creeps across the paper: out along the ground from the pad, and in from the frame's edges. */
const CREEP = frostTree(909, ([
  { x: 690, y: 815, angle: Math.PI + 0.06, len: 760 },
  { x: 1230, y: 815, angle: -0.06, len: 760 },
  { x: 780, y: 850, angle: Math.PI - 0.42, len: 560 },
  { x: 1140, y: 850, angle: 0.42, len: 560 },
  { x: 1940, y: -20, angle: Math.PI - 0.62, len: 720 },
  { x: -20, y: 1100, angle: -0.6, len: 640 },
  { x: 1940, y: 1100, angle: Math.PI + 0.62, len: 640 },
  { x: 1300, y: -20, angle: 1.95, len: 520 },
  { x: -20, y: 560, angle: -0.12, len: 520 },
  { x: 1940, y: 470, angle: Math.PI + 0.1, len: 560 },
  { x: 560, y: 1100, angle: -1.25, len: 360 },
] as FrostRoot[]), 3);

/** Where the frost has grown to on the paper. */
const creepAt = (t: number) => 820 * easeOut(seg(t, 1.25, 3.2));

let warmed = false;

function drawFrame(L: Layers, t: number): ScreenParams {
  if (!warmed) { warmSheets(); frozenPicture(); warmed = true; }
  const screen = quietScreen();
  if (t < 4.0) paperBeats(L, t, screen);
  else if (t < 8.56) nightBeats(L, t, screen);
  else if (t < 10.0) stillWorld(L, t, screen);
  else shatter(L, t, screen);
  // The title stays until the lotus starts to open. On the glow layer it is opaque, so it covers.
  frostTitle(L.glow, 1 - seg(t, 4.1, 4.4), t >= 3.4, TITLE);
  return screen;
}

/** A gentle push and shake for both layers, round the core. */
function camera(L: Layers, zoom: number, shake: number, t: number) {
  const wx = wobble(5)(t * 23) * shake, wy = wobble(9)(t * 21) * shake;
  for (const c of [L.flat, L.glow]) {
    c.save();
    c.translate(CORE.x + wx, CORE.y + wy);
    c.scale(zoom, zoom);
    c.translate(-CORE.x, -CORE.y);
  }
}
const uncamera = (L: Layers) => { L.flat.restore(); L.glow.restore(); };

/**
 * 0 to 4.0 s: the bud on its pad of ice on the paper, breathing mist; frost creeps across in navy ink and lights up;
 * the night floods in from the edges as halftone dots.
 */
function paperBeats(L: Layers, t: number, screen: ScreenParams) {
  const night = easeInOut(seg(t, 3.0, 3.85));
  const g = creepAt(t);
  camera(L, 1 + 0.03 * smooth(seg(t, 0, 4.0)), 0, t);
  paper(L.flat);
  mist(L.flat, t, env(t, 0, 0.5, 2.0, 3.0), { x: LOTUS.x, y: LOTUS.y - 10 });
  frostDraw(L.flat, CREEP, g, [6, 3.6, 2.2, 1.4], '#1a2d5e', 0.92);
  nightFlood(L.flat, night, (c) => nightGround(c));
  const bud: LotusState = { open: 0.02 + 0.025 * Math.sin(t * 2.4) };
  icePad(L.flat, LOTUS, 1, night < 0.5);
  lotusFlat(L.flat, bud);
  // The frost lights up, first as a pale line in the ink, then glowing as the night comes.
  const ignite = smooth(seg(t, 2.1, 3.3));
  frostDraw(L.glow, CREEP, g, [14, 8, 5, 3], '#3fb8ff', 0.3 * ignite * (0.4 + 0.6 * night));
  frostDraw(L.glow, CREEP, g, [3.5, 2.2, 1.5, 1], '#e8fbff', 0.95 * ignite);
  frostTips(L.glow, CREEP, g, ignite * (1 - seg(t, 3.1, 3.3)));
  snowfall(L.glow, t, night * 0.8, 61, 70, ['#e6faff', '#9fe6ff']);
  padCutout(L.glow);
  lotusLight(L.glow, bud, night * 0.8, night * 0.7, () => coreGlow(L.glow, CORE, 0.3 * night, t));
  uncamera(L);
  screen.vignette = 0.45 * night;
  screen.flash = 0.08 * env(t, 3.0, 3.06, 3.1, 3.3);
}

/** Opening starts here; each petal follows on its own delay. */
const OPEN = 4.05;
/** The ring of blades: when it forms, when it fires. */
const FORM = 6.6, FIRE = 8.4;
/** The ring's size round the core (an ellipse, to fill the wide frame). */
const RING = { rx: 600, ry: 410 };

function bladeAt(i: number, t: number): BladePose & { launch: number; base: Pt } {
  const f0 = FORM + i * 0.075;
  const rot = 0.22 * (t - FORM) + 0.5 * easeIn(seg(t, 7.6, FIRE));
  const phi = (i / BLADES) * Math.PI * 2 - Math.PI / 2 + rot;
  const launch = FIRE + (i % 3) * 0.035;
  const fly = easeIn(seg(t, launch, launch + 0.2));
  const tighten = 1 - 0.07 * smooth(seg(t, 7.5, FIRE));
  const k = tighten + 2.6 * fly;
  const ex = Math.cos(phi) * RING.rx, ey = Math.sin(phi) * RING.ry;
  return {
    x: CORE.x + ex * k, y: CORE.y + ey * k, angle: Math.atan2(ey, ex), size: 1.25 * easeOutBack(seg(t, f0, f0 + 0.42), 2),
    launch, base: { x: CORE.x + ex * tighten, y: CORE.y + ey * tighten },
  };
}

/**
 * 4.0 to 8.56 s: on the night, the lotus opens petal by petal; two snowflake mandalas turn behind it; a ring of ice blades
 * forms, tightens and charges, and fires outwards.
 */
function nightBeats(L: Layers, t: number, screen: ScreenParams) {
  const charge = smooth(seg(t, 7.5, FIRE));
  const zoom = 1.03 + 0.05 * easeInOut(seg(t, 4.0, 7.4)) - 0.08 * easeOut(seg(t, FIRE, 8.56));
  camera(L, zoom, 5 * charge * (1 - seg(t, FIRE, 8.5)), t);
  nightGround(L.flat);
  icePad(L.flat, LOTUS, 1, false);
  const s: LotusState = { t, t0: OPEN };
  lotusFlat(L.flat, s);
  const blades = Array.from({ length: BLADES }, (_, i) => bladeAt(i, t));
  for (const b of blades) bladeFlat(L.flat, b);

  // Glow, from the back: the last of the frost, the mandalas, snow, then the lotus's own light and the blades.
  // The paper's frost, still lit, dims to a faint trace (it carries on from the paper beats' two passes).
  const dim = 1 - 0.85 * smooth(seg(t, 4.0, 5.2));
  frostDraw(L.glow, CREEP, creepAt(t), [14, 8, 5, 3], '#3fb8ff', 0.3 * dim);
  frostDraw(L.glow, CREEP, creepAt(t), [3.5, 2.2, 1.5, 1], '#e8fbff', 0.95 * dim);
  const m1 = easeOut(seg(t, 4.5, 5.9)), m2 = easeOut(seg(t, 5.1, 6.4));
  const turn = t - 4.5;
  mandala(L.glow, CORE, 560 * (0.9 + 0.1 * m1), 0.12 * turn + 0.4 * charge, m1, '#6fd8ff', 0.42 + 0.25 * charge, 3.2);
  mandala(L.glow, CORE, 350 * (0.9 + 0.1 * m2), -0.2 * turn - 0.6 * charge, m2, '#b9a8ff', 0.32 + 0.2 * charge, 2.4);
  // The magic ring that joins the blades.
  const ringK = seg(t, FORM, FORM + 0.9) * (1 - seg(t, FIRE, FIRE + 0.1));
  if (ringK > 0) {
    const tight = 1 - 0.07 * smooth(seg(t, 7.5, FIRE));
    L.glow.beginPath();
    L.glow.ellipse(CORE.x, CORE.y, RING.rx * tight, RING.ry * tight, 0, 0, Math.PI * 2);
    L.glow.strokeStyle = rgba('#8feaff', (0.35 + 0.4 * charge) * ringK);
    L.glow.lineWidth = 2.5 + 3 * charge;
    L.glow.stroke();
  }
  snowfall(L.glow, t, 0.8, 61, 70, ['#e6faff', '#9fe6ff']);
  padCutout(L.glow);
  const coreK = 0.35 + 0.45 * easeOut(seg(t, 4.6, 6.4)) + 0.5 * charge + 0.6 * env(t, FIRE, FIRE + 0.04, FIRE + 0.08, 8.56);
  lotusLight(L.glow, s, 0.85, 0.55 + 0.45 * seg(t, 4.5, 6.4) + 0.3 * charge, () => coreGlow(L.glow, CORE, coreK, t));
  for (const b of blades) {
    bladeCutout(L.glow, b);
    // A glint as each blade forms.
    const f0 = FORM + blades.indexOf(b) * 0.075;
    const glint = env(t, f0, f0 + 0.04, f0 + 0.1, f0 + 0.4);
    if (glint > 0) starGlint(L.glow, { x: b.x, y: b.y }, glint, 90);
    bladeGlow(L.glow, b, 0.5 + 0.5 * charge);
    // Streaks behind the blades as they fly.
    const fly = seg(t, b.launch, b.launch + 0.2);
    if (fly > 0) {
      L.glow.fillStyle = rgba('#7fe6ff', 0.5);
      ribbon(L.glow, [b.base, { x: b.x, y: b.y }], (u) => 26 * u);
      L.glow.fillStyle = rgba('#ffffff', 0.9);
      ribbon(L.glow, [b.base, { x: b.x, y: b.y }], (u) => 8 * u);
    }
  }
  uncamera(L);
  screen.vignette = 0.45;
  screen.aberration = 0.4 + 4.5 * charge + 4 * seg(t, FIRE, 8.56);
  screen.bloom = 1 + 0.3 * charge;
}

/** A four-pointed glint (glow). */
function starGlint(ctx: Ctx, at: Pt, k: number, size: number) {
  ctx.fillStyle = rgba('#ffffff', clamp(k));
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const L = size * k, w = 4 * k;
    ctx.beginPath();
    ctx.moveTo(at.x - dx * L, at.y - dy * L);
    ctx.lineTo(at.x + dy * w, at.y - dx * w);
    ctx.lineTo(at.x + dx * L, at.y + dy * L);
    ctx.lineTo(at.x - dy * w, at.y + dx * w);
    ctx.closePath();
    ctx.fill();
  }
}

/** The frozen lotus, as it stands under the ice. */
const FROZEN_LOTUS: LotusState = { open: 1, frost: 1 };
/** How opaque the ice is once it has covered the frame. */
const ICE_ALPHA = 0.62;

/** The frozen frame's flat picture under the ice: night, pad, the frosted lotus. */
function frozenScene(ctx: Ctx) {
  nightGround(ctx);
  icePad(ctx, LOTUS, 1, false);
  lotusFlat(ctx, FROZEN_LOTUS);
}

let frozenPic: HTMLCanvasElement | null = null;

/**
 * The finished frozen frame (night, pad, frosted lotus, ice), made once: every shard draws its piece of it, rather than
 * drawing the lotus again for each shard. It never depends on time.
 */
function frozenPicture() {
  if (frozenPic) return frozenPic;
  frozenPic = document.createElement('canvas');
  frozenPic.width = 1920;
  frozenPic.height = 1080;
  const c = frozenPic.getContext('2d')!;
  frozenScene(c);
  frozenGround(c, ICE_ALPHA);
  return frozenPic;
}

/** Where the freeze has reached (along the frost's branches). */
const freezeAt = (t: number) => 1500 * easeOut(seg(t, 8.58, 9.25));

/**
 * 8.56 to 10.0 s: a white impact frame, an ink frame of the lotus in navy on white, and the world freezes over from the
 * core: frost races to the frame's edges and a sheet of ice covers everything. Then it cracks.
 */
function stillWorld(L: Layers, t: number, screen: ScreenParams) {
  const g = freezeAt(t);
  if (t < 8.63) {
    // The white frame.
    L.flat.fillStyle = '#f2fbff';
    L.flat.fillRect(0, 0, 1920, 1080);
    screen.flash = 0.25;
    screen.vignette = 0;
    return;
  }
  if (t < 8.73) {
    // The ink frame: the lotus and the first frost in navy on white, speed lines round it.
    L.flat.fillStyle = '#eef8ff';
    L.flat.fillRect(0, 0, 1920, 1080);
    radialLines(L.flat, t, '#0a1636');
    frostDraw(L.flat, FREEZE, g + 200, [7, 4, 2.4], '#0a1636', 1);
    lotusInk(L.flat, FROZEN_LOTUS, '#0a1636', '#eef8ff');
    screen.vignette = 0;
    screen.aberration = 6;
    return;
  }
  frozenScene(L.flat);
  // The ice spreads from the core with the frost.
  L.flat.save();
  L.flat.beginPath();
  L.flat.ellipse(FREEZE_AT.x, FREEZE_AT.y, g * 1.15, g * 0.9, 0, 0, Math.PI * 2);
  L.flat.clip();
  frozenGround(L.flat, ICE_ALPHA);
  L.flat.restore();
  // The frost racing out, bright, then settling to faint glints.
  const settle = (1 - 0.8 * seg(t, 8.85, 9.45)) * (1 - seg(t, 9.6, 9.97));
  frostDraw(L.glow, FREEZE, g, [14, 8, 4], '#47c4ff', 0.22 * settle);
  frostDraw(L.glow, FREEZE, g, [3.5, 2.2, 1.3], '#ffffff', 0.9 * settle);
  frostTips(L.glow, FREEZE, g, 1 - seg(t, 9.1, 9.3), 2);
  // A last pulse of the core under the ice.
  coreGlow(L.glow, CORE, 0.6 * (1 - seg(t, 8.7, 9.5)), t);
  cracks(L, t, 9.45);
  screen.vignette = 0.12;
  screen.aberration = 4 * (1 - seg(t, 8.7, 9.2)) + 2 * env(t, 9.45, 9.5, 9.6, 9.9);
  screen.flash = 0.35 * (1 - seg(t, 8.7, 8.85)) + 0.12 * env(t, 9.45, 9.48, 9.52, 9.65);
}

/** The cracks grown from the core from time `t0` (flat navy lines with a white glint on the glow layer). */
function cracks(L: Layers, t: number, t0: number) {
  const reach = 1700 * easeOut(seg(t, t0, t0 + 0.45));
  if (reach <= 0) return;
  for (const [ctx, color, w] of [[L.flat, '#0b2150', 5], [L.glow, '#7fe6ff', 8], [L.glow, '#ffffff', 2.2]] as const) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    crackPath(ctx, reach);
    ctx.strokeStyle = color === '#7fe6ff' ? rgba(color, 0.4) : color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  }
}

/** Navy speed lines out from the core (the ink frame). */
function radialLines(ctx: Ctx, t: number, color: string) {
  const slot = Math.floor(t * 30);
  let s = slot * 7919;
  const rnd = () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
  ctx.fillStyle = color;
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r0 = 380 + rnd() * 300, r1 = r0 + 400 + rnd() * 900;
    ribbon(ctx, [{ x: CORE.x + Math.cos(a) * r0, y: CORE.y + Math.sin(a) * r0 }, { x: CORE.x + Math.cos(a) * r1, y: CORE.y + Math.sin(a) * r1 }],
      (u) => (3 + rnd() * 6) * Math.sin(Math.PI * u));
  }
}

/** The paper after the ice: snow dusting it, snow falling, the lotus closing on its pad, and at the end the seal. */
function snowyPaper(L: Layers, t: number) {
  paper(L.flat);
  snowDust(L.flat, smooth(seg(t, 10.1, 11.6)));
  // The bud breathes its cold mist again.
  mist(L.flat, t - 11.2, 0.7 * env(t, 11.2, 12.0, 13.0, 13.6), { x: LOTUS.x, y: LOTUS.y - 10 });
  const close = easeInOut(seg(t, 10.5, 11.9));
  const bud: LotusState = { open: lerp(0.5, 0.02, close) + 0.02 * Math.sin(t * 2.4) * close };
  icePad(L.flat, LOTUS, 1, true);
  lotusFlat(L.flat, bud);
  snowfall(L.flat, t, 1, 83, 90, ['#4f78ae', '#8fa9c9', '#2b4a80']);
  seal(L.flat, 1420, 600, 200, seg(t, 12.55, 12.85), '氷', '#1f3d8c');
}

/** 10.0 s to the end: the ice breaks into shards that fall away and show the snowy paper beneath. */
function shatter(L: Layers, t: number, screen: ScreenParams) {
  snowyPaper(L, t);
  const dt = t - 10.0;
  for (const s of SHARDS) {
    const m = shardMotion(s, dt);
    if (!shardVisible(s, m)) continue;
    for (const ctx of [L.flat, L.glow]) {
      ctx.save();
      ctx.translate(s.c.x + m.x, s.c.y + m.y);
      ctx.rotate(m.angle);
      ctx.translate(-s.c.x, -s.c.y);
    }
    // The frozen picture inside the shard, and a light catching it as it turns.
    L.flat.save();
    shardPath(L.flat, s);
    L.flat.clip();
    // Beyond the frame's edges the shard has no picture of its own: the ice's colour there.
    L.flat.fillStyle = '#527c9e';
    L.flat.fillRect(s.c.x - 2000, s.c.y - 2000, 4000, 4000);
    L.flat.drawImage(frozenPicture(), 0, 0, 1920, 1080);
    const lit = Math.max(0, Math.sin(m.angle * 1.4 + s.tilt)) * clamp(m.d * 6);
    if (lit > 0) {
      L.flat.fillStyle = rgba('#ffffff', 0.45 * lit);
      L.flat.fillRect(s.c.x - 900, s.c.y - 900, 1800, 1800);
    }
    L.flat.restore();
    L.flat.lineJoin = 'round';
    shardPath(L.flat, s);
    L.flat.strokeStyle = '#0b2150';
    L.flat.lineWidth = 4;
    L.flat.stroke();
    shardPath(L.glow, s);
    L.glow.strokeStyle = rgba('#e8fbff', 0.85);
    L.glow.lineWidth = 2;
    L.glow.stroke();
    L.flat.restore();
    L.glow.restore();
  }
  // Fine ice dust glittering as the shards go.
  snowfall(L.glow, t, seg(t, 10.0, 10.15) * (1 - seg(t, 10.6, 11.4)), 97, 120, ['#ffffff', '#c8f2ff']);
  const left = seg(t, 10.9, 11.3);
  screen.vignette = 0.12 * (1 - left);
  screen.flash = 0.18 * env(t, 10.0, 10.02, 10.05, 10.2) + 0.1 * env(t, 12.55, 12.6, 12.62, 12.8);
  screen.aberration = 3 * (1 - seg(t, 10.0, 10.6));
}

const piece: Piece = {
  id: 'frost',
  title: 'Frost Lotus',
  subtitle: 'Hakka · The Still World',
  about: 'A lotus of ice on paper opens on a frozen night, fires a ring of blades, freezes the world white, and it shatters back to snowy paper.',
  order: 40,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '氷蓮白華・絶界' },
  draw: drawFrame,
};
export default piece;
