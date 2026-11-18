import type { Beat, Layers, Piece } from '../piece';
import { clamp, easeIn, easeInOut, easeOut, env, lerp, quietScreen, rgba, seg, smooth, wobble, type Ctx, type Pt, type ScreenParams } from '../core';
import { halftone, paper, seal, specks, titleCard, type TitleText } from '../art/paper';
import { C, mix } from '../art/lanterns/common';
import { branch, lanternFlat, lanternGlow, lanternTop, type LanternPose } from '../art/lanterns/lantern';
import { HORIZON, MOON, gate, mist, moon, nightFlood, nightSky, paperMist, stonePath } from '../art/lanterns/night';
import { core, hitodama, rushLines, shockRing, spiralArms, spiralDots } from '../art/lanterns/wisp';
import { PALE_FOX, foxFlat, foxGlow, type FoxPose } from '../art/lanterns/fox';
import { ashMotes, dawnScene } from '../art/lanterns/dawn';

/**
 * Spirit Lanterns: Hyakki Yakō, the Night Procession. The sequence, beat by beat, as a pure function of time.
 *
 * One unlit paper lantern hangs from a black branch on the paper. A spark lights it amber; its light turns ghost-fire
 * cyan, and the night comes in round it: a stone path to a gate under the moon, and along it a procession of lanterns
 * that light one by one into the distance. From each a ghost-fire rises; they gather into a great spiral, the spiral
 * becomes a nine-tailed fox of blue fire, and the fox rushes at the viewer. White; dawn on the paper, every lantern out
 * but one, still amber; ash drifting; the seal.
 */

const DURATION = 13.6;
const SPARK = 1.35;
const LIGHT = 1.78;
const TURN = 2.45;
const NIGHT = 2.75;
const PROC = 3.45;
const WISPS = 5.65;
const SPIRAL = 6.7;
const FOX = 7.9;
const RUSH = 9.3;
const INK = 9.8;
const WHITE = 9.9;
const DAWN = 10.0;
const SEAL = 12.05;

const BEATS: Beat[] = [
  { name: 'The lantern', t0: 0, t1: SPARK },
  { name: 'The spark', t0: SPARK, t1: TURN },
  { name: 'Ghost-fire', t0: TURN, t1: NIGHT },
  { name: 'Night falls', t0: NIGHT, t1: PROC },
  { name: 'The procession', t0: PROC, t1: WISPS },
  { name: 'The spirits rise', t0: WISPS, t1: SPIRAL },
  { name: 'The spiral', t0: SPIRAL, t1: FOX },
  { name: 'The fox', t0: FOX, t1: RUSH },
  { name: 'The rush', t0: RUSH, t1: DAWN },
  { name: 'Dawn', t0: DAWN, t1: SEAL },
  { name: 'The seal', t0: SEAL, t1: DURATION },
];

const TITLE: TitleText = {
  kanji: '霊灯', english: 'SPIRIT LANTERNS', move: '百鬼・夜行', romaji: 'HYAKKI · THE NIGHT PROCESSION',
  colors: ['#eafff9', '#6fe8d0', '#1c9c86'],
};

/** The lantern of the opening: where the nearest lantern of the procession will hang, so the night falls round it. */
const HERO = { x: 1430, y: 540, R: 180 };
const CORD = 190;
/** How far out from the path's middle the rows float, how big their lanterns are and how high (at scale 1). */
const ROW = 700;
const SLOT_R = 118;
const SLOT_Y = 230;
/** The middle of the spirits' spiral: the moon's. The fox's head is a little above it, so the moon rings it. */
const EYE = { x: MOON.x, y: MOON.y };
const FOX_AT = { x: 960, y: 405, s: 100 };

/** The procession: two rows of lanterns floating along the path, near to far; when each lights. */
interface Slot { side: number; s: number; x: number; y: number; R: number; lightAt: number; i: number }
const SLOTS: Slot[] = (() => {
  const out: Slot[] = [];
  // The opening lantern is the first: it hangs from the branch and lights first.
  out.push({ side: 1, s: 1, x: HERO.x, y: HERO.y, R: HERO.R, lightAt: 0, i: 0 });
  for (let j = 0; j < 5; j++) {
    for (const side of [1, -1]) {
      const s = side > 0 ? 1 / (2.0 + j * 0.8) : 1 / (1.3 + j * 0.8);
      out.push({ side, s, x: 960 + side * ROW * s, y: HORIZON + SLOT_Y * s, R: SLOT_R * s, lightAt: 0, i: 0 });
    }
  }
  out.sort((a, b) => b.s - a.s);
  out.forEach((o, i) => { o.i = i; o.lightAt = PROC + 0.15 + (i - 1) * 0.19; });
  return out;
})();
/** When each lantern's spirit leaves it (near ones first). */
const leaveAt = (s: Slot) => WISPS + s.i * 0.075;

function drawFrame(L: Layers, t: number): ScreenParams {
  const screen = quietScreen();
  if (t < NIGHT) paperBeats(L, t, screen);
  else if (t < RUSH) nightBeats(L, t, screen);
  else if (t < INK) rush(L, t, screen);
  else if (t < WHITE) inkFrame(L, t, screen);
  else if (t < DAWN) whiteFrame(L, screen);
  else dawn(L, t, screen);
  // The title, on the flat layer; it fades as the night comes.
  titleCard(L.flat, seg(t, 0.15, 0.55) * (1 - seg(t, NIGHT + 0.25, NIGHT + 0.55)), t > NIGHT + 0.2, TITLE);
  return screen;
}

/** The opening lantern's pose at time t. */
function heroPose(t: number): LanternPose {
  const swing = 0.035 * Math.sin(t * 1.5) + 0.02 * Math.sin(t * 2.7 + 1);
  const light = easeOut(seg(t, LIGHT, LIGHT + 0.3)) * (1 - smooth(seg(t, leaveAt(SLOTS[0]), leaveAt(SLOTS[0]) + 0.45)));
  return {
    ...HERO, swing, cord: CORD, light, hue: smooth(seg(t, TURN, TURN + 0.16)), night: smooth(seg(t, NIGHT + 0.1, NIGHT + 0.6)),
    kanji: '霊', tag: true, t,
  };
}

/** The spark's path: drifting down from the upper right, wavering, into the lantern's top. */
function sparkAt(t: number): Pt {
  const k = seg(t, SPARK - 0.55, LIGHT);
  const top = lanternTop(heroPose(t));
  const w = wobble(12)(t * 3);
  return {
    x: lerp(1780, top.x, easeInOut(k)) + 60 * w * (1 - k),
    y: lerp(-40, top.y + 20, easeIn(k) * 0.4 + easeInOut(k) * 0.6),
  };
}

/** 0 to 2.75 s: the paper, the branch, the lantern; the spark lights it amber; its light turns cyan. */
function paperBeats(L: Layers, t: number, screen: ScreenParams) {
  screen.vignette = 0;
  paperScene(L, t);
}

function paperScene(L: Layers, t: number, withHero = true) {
  const p = heroPose(t);
  paper(L.flat);
  paperMist(L.flat, t, 1);
  specks(L.flat, 44, 40, 0.7, undefined, [C.ink, '#8a8780', '#5d6a66']);
  branch(L.flat, { x: p.x, y: p.y - p.R * 0.9 - CORD });
  litHalo(L.flat, p, 1);
  if (withHero) {
    lanternFlat(L.flat, p);
    lanternGlow(L.glow, p, 0.15);
  }
  // The spark.
  if (t > SPARK - 0.55 && t < LIGHT + 0.02) {
    for (let i = 0; i < 10; i++) {
      const q = sparkAt(t - i * 0.025);
      L.glow.fillStyle = rgba(i === 0 ? '#fff6dc' : C.amber, (1 - i / 10) * 0.9);
      L.glow.beginPath();
      L.glow.arc(q.x, q.y, 9 - i * 0.7, 0, Math.PI * 2);
      L.glow.fill();
    }
  }
  // The light catching: a ring out from the lantern, amber; then the ripple as it turns cyan.
  ring(L.glow, p, seg(t, LIGHT, LIGHT + 0.5), C.amber, 1);
  ring(L.glow, p, seg(t, TURN, TURN + 0.55), C.fire, 1.2);
}

/** A ring opening out from a lantern (glow). */
function ring(ctx: Ctx, p: LanternPose, k: number, color: string, size: number) {
  if (k <= 0 || k >= 1) return;
  const R = p.R * (1.1 + 1.6 * size * easeOut(k));
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, R, R * 0.92, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(color, 0.8 * (1 - k) ** 1.5);
  ctx.lineWidth = 3 + 8 * (1 - k);
  ctx.stroke();
}

/** The light of a lit lantern on the paper, carried in flat colour: a halftone halo round it. */
function litHalo(ctx: Ctx, p: LanternPose, k: number) {
  const a = clamp(p.light) * k;
  if (a <= 0) return;
  const col = mix(mix('#e8a24a', '#3fbfa6', p.hue), '#c9c4b8', 0.8 * Math.sin(Math.PI * clamp(p.hue)));
  const R = p.R;
  halftone(ctx, rgba(col, 0.75), 13, (x, y) => {
    const d = Math.hypot(x - p.x, (y - p.y) / 0.92) / R;
    if (d < 1) return 0;
    return (1 - (d - 1) / 1.1) * 0.9 * a;
  }, { x: p.x - R * 2.2, y: p.y - R * 2.1, w: R * 4.4, h: R * 4.2 });
}

/**
 * 2.75 to 9.3 s: the night comes in round the lantern; the procession lights one by one; the spirits rise out of the
 * lanterns into a spiral before the moon, and the spiral bursts into the fox.
 */
function nightBeats(L: Layers, t: number, screen: ScreenParams) {
  const flood = easeInOut(seg(t, NIGHT, PROC));
  const hp = heroPose(t);
  if (flood < 1) paperScene(L, t, false);
  nightFlood(L.flat, flood, { x: hp.x, y: hp.y }, (ctx) => nightScene(ctx, L.glow, t, flood >= 1));
  lanternFlat(L.flat, hp);
  lanternGlow(L.glow, hp, 0.15 + 0.85 * flood);
  if (t > WISPS) spirits(L, t);
  screen.vignette = 0.35 * flood;
  screen.bloom = 1 + 0.3 * env(t, FOX - 0.3, FOX, FOX + 0.1, FOX + 0.6);
  screen.aberration = 1 + 5 * env(t, FOX - 0.1, FOX, FOX + 0.05, FOX + 0.5);
}

/** The night scene (flat), and the procession's light on `glow` once the night is fully in. */
function nightScene(ctx: Ctx, glow: Ctx, t: number, lights: boolean) {
  nightSky(ctx);
  moon(ctx, 1);
  mist(ctx, t, 1, [{ y: 590, h: 50, a: 0.3, v: 8 }, { y: 470, h: 26, a: 0.2, v: -5 }]);
  gate(ctx, '#020807');
  stonePath(ctx);
  for (let i = SLOTS.length - 1; i >= 1; i--) {
    const s = SLOTS[i];
    if (i === 5) mist(ctx, t, 1, [{ y: 620, h: 34, a: 0.3, v: 12 }]);
    const p = slotPose(s, t);
    lanternFlat(ctx, p);
    if (lights) lanternGlow(glow, p, 1);
  }
  mist(ctx, t, 1, [{ y: 800, h: 70, a: 0.25, v: -14 }, { y: 950, h: 90, a: 0.2, v: 10 }]);
  const hp = heroPose(t);
  branch(ctx, { x: hp.x, y: hp.y - hp.R * 0.9 - CORD }, 1, '#010303');
}

/** A procession lantern's pose: bobbing a little, lit at its time, going dark as its spirit leaves. */
function slotPose(s: Slot, t: number): LanternPose {
  const w = wobble(100 + s.i);
  const out = smooth(seg(t, leaveAt(s), leaveAt(s) + 0.45));
  return {
    x: s.x, y: s.y + 10 * s.s * w(t * 0.8), R: s.R, swing: 0.04 * w(t * 0.6 + 3), cord: 0,
    light: easeOut(seg(t, s.lightAt, s.lightAt + 0.25)) * (1 - out), hue: 1, night: 1, kanji: s.R > 60 ? '霊' : '', tag: s.R > 50, t,
  };
}

/** Where a lantern's spirit is at time t (null before it leaves), and how far it has joined the spiral. */
function wispAt(s: Slot, t: number): { at: Pt; join: number } | null {
  const L0 = leaveAt(s);
  const tau = t - L0;
  if (tau < 0) return null;
  const start = s.i === 0 ? lanternTop(heroPose(L0)) : lanternTop(slotPose(s, L0));
  const sway = wobble(300 + s.i);
  const rise = (u: number) => ({ x: start.x + 50 * sway(u * 2.5) * Math.min(1, u), y: start.y - 420 * easeOut(seg(u, 0, 1.3)) * (0.6 + 0.4 * s.s) });
  // The orbit: round the eye, faster and tighter as the fox nears, flattened for the perspective.
  const spin = (u: number) => 1.9 * u + 0.75 * u * u;
  const meet = rise(0.75);
  const a0 = Math.atan2((meet.y - EYE.y) / 0.62, meet.x - EYE.x) - spin(0.75);
  const r0 = clamp(Math.hypot(meet.x - EYE.x, (meet.y - EYE.y) / 0.62), 380, 760);
  const end = FOX - 0.08 - L0;
  const r = lerp(r0, 30, easeIn(seg(tau, 0.4, end)) ** 0.8);
  const a = a0 + spin(tau);
  const orbit = { x: EYE.x + Math.cos(a) * r, y: EYE.y + Math.sin(a) * r * 0.62 };
  const join = smooth(seg(tau, 0.2, 1.25));
  const q = rise(tau);
  return { at: { x: lerp(q.x, orbit.x, join), y: lerp(q.y, orbit.y, join) }, join };
}

/** The spirits: ghost-fires rising out of the lanterns, gathering into the spiral, the knot of light, the burst, the fox. */
function spirits(L: Layers, t: number) {
  const gather = smooth(seg(t, SPIRAL - 0.3, SPIRAL + 0.5)) * (1 - seg(t, FOX, FOX + 0.15));
  const R = lerp(620, 260, easeIn(seg(t, SPIRAL, FOX)));
  spiralDots(L.flat, EYE, R * 1.2, gather * 0.9);
  spiralArms(L.glow, EYE, t, gather * 0.8, R);
  if (t < FOX + 0.05) {
    for (const s of SLOTS) {
      const w = wispAt(s, t);
      if (!w) continue;
      const path: Pt[] = [];
      for (let j = 0; j <= 14; j++) {
        const q = wispAt(s, Math.max(leaveAt(s), t - j * 0.03));
        if (q) path.push(q.at);
      }
      const size = lerp(12 + 24 * s.s, 32, w.join) * (1 - easeIn(seg(t, FOX - 0.35, FOX)) * 0.6);
      hitodama(L.glow, path, size, t, s.i, 1 - seg(t, FOX, FOX + 0.05));
    }
  }
  // The fox, out of the knot of light the spiral closes to; the moon's rim lit behind it.
  const p = foxPose(t);
  moonRim(L.glow, p.form);
  foxFlat(L.flat, p);
  foxGlow(L.glow, p);
  const knot = easeIn(seg(t, FOX - 0.55, FOX)) * (1 - seg(t, FOX + 0.05, FOX + 0.5));
  core(L.glow, EYE, lerp(40, 330, easeIn(seg(t, FOX - 0.55, FOX + 0.1))), knot);
  shockRing(L.glow, EYE, seg(t, FOX, FOX + 0.75), 1500);
}

/** A thin ring of ghost-fire round the moon's edge (glow). */
function moonRim(ctx: Ctx, k: number) {
  if (k <= 0) return;
  for (const [w, color, a] of [[14, C.fireDeep, 0.35], [4, C.fire, 0.7], [1.5, C.firePale, 0.9]] as const) {
    ctx.beginPath();
    ctx.arc(MOON.x, MOON.y, MOON.r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(color, a * k);
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

function foxPose(t: number): FoxPose {
  const breathe = Math.sin((t - FOX) * 2.2);
  return {
    ...FOX_AT, y: FOX_AT.y + 6 * breathe, s: FOX_AT.s * (1 + 0.01 * breathe),
    form: easeOut(seg(t, FOX - 0.02, FOX + 0.7)),
    eyes: easeOut(seg(t, 8.75, 8.9)),
    spread: 0,
    t,
  };
}

/** The fox's pose in the rush: a breath back, then at the viewer, its tails sweeping wide. */
function rushPose(t: number): FoxPose {
  const back = easeInOut(seg(t, RUSH, RUSH + 0.16)) * (1 - seg(t, RUSH + 0.16, RUSH + 0.3));
  const go = easeIn(seg(t, RUSH + 0.14, INK));
  const z = 1 - 0.06 * back + 0.8 * go;
  const c = RUSH_C;
  const base = foxPose(Math.min(t, INK));
  return { ...base, x: c.x + (base.x - c.x) * z, y: c.y + (base.y - c.y) * z + 60 * go, s: base.s * z, spread: go };
}
const RUSH_C = { x: FOX_AT.x, y: FOX_AT.y - 20 };

/** 9.3 to 9.8 s: the fox draws back a breath, then rushes at the viewer; lines rush out. */
function rush(L: Layers, t: number, screen: ScreenParams) {
  nightScene(L.flat, L.glow, t, true);
  lanternFlat(L.flat, heroPose(t));
  const go = easeIn(seg(t, RUSH + 0.14, INK));
  // The night darkens behind it as it comes.
  L.flat.fillStyle = rgba('#010606', 0.55 * go);
  L.flat.fillRect(0, 0, 1920, 1080);
  moonRim(L.glow, 1 - go);
  const p = rushPose(t);
  foxFlat(L.flat, p);
  foxGlow(L.glow, p);
  rushLines(L.glow, RUSH_C, t, env(t, RUSH + 0.15, RUSH + 0.25, INK - 0.03, INK));
  screen.vignette = 0.35 + 0.1 * go;
  screen.aberration = 1 + 8 * go;
  screen.bloom = 1 + 0.3 * go;
}

/** 9.8 s: the impact frame: the fox at the end of its rush, light and dark swapped, ink lines rushing out. */
function inkFrame(L: Layers, t: number, screen: ScreenParams) {
  nightScene(L.flat, L.glow, t, true);
  L.flat.fillStyle = rgba('#010606', 0.55);
  L.flat.fillRect(0, 0, 1920, 1080);
  lanternFlat(L.flat, heroPose(t));
  const p = rushPose(INK);
  foxFlat(L.flat, p, PALE_FOX);
  foxGlow(L.glow, p);
  rushLines(L.glow, RUSH_C, t, 1);
  screen.invert = 1;
  screen.vignette = 0;
  screen.aberration = 7;
  screen.bloom = 0.4;
}

/** 9.93 s: white. */
function whiteFrame(L: Layers, screen: ScreenParams) {
  L.flat.fillStyle = '#fffdf8';
  L.flat.fillRect(0, 0, 1920, 1080);
  screen.flash = 1;
  screen.vignette = 0;
}

/** 10 s to the end: dawn on the paper; every lantern out but the first, still amber; ash drifting; the seal. */
function dawn(L: Layers, t: number, screen: ScreenParams) {
  const p: LanternPose = { ...heroPose(t), light: 1, hue: 0, night: 0 };
  // A slow drift in towards the lantern.
  const z = 1.06 - 0.06 * easeOut(seg(t, DAWN, DURATION));
  for (const c of [L.flat, L.glow]) {
    c.save();
    c.translate(HERO.x, HERO.y);
    c.scale(z, z);
    c.translate(-HERO.x, -HERO.y);
  }
  paper(L.flat);
  paperMist(L.flat, t, 1);
  dawnScene(L.flat, SLOTS.slice(1).map((s) => ({ ...slotPose(s, t), light: 0, night: 0, kanji: '', tag: false })), t);
  branch(L.flat, { x: p.x, y: p.y - p.R * 0.9 - CORD });
  litHalo(L.flat, p, 0.8);
  lanternFlat(L.flat, p);
  lanternGlow(L.glow, p, 0.12);
  // One small spirit lingers: it slips out of the lantern's top and drifts up and away.
  const k = seg(t, 10.7, 12.4);
  if (k > 0 && k < 1) {
    const top = lanternTop(p);
    const at = (u: number) => ({ x: top.x - 520 * u + 30 * Math.sin(u * 9), y: top.y - 60 * u - 200 * u * u + 20 * Math.sin(u * 6) });
    const path: Pt[] = [];
    for (let j = 0; j <= 10; j++) path.push(at(Math.max(0, smooth(k) - j * 0.02)));
    hitodama(L.glow, path, 11 * (1 - 0.5 * k), t, 3, Math.sin(Math.PI * k) * 0.9);
  }
  for (const c of [L.flat, L.glow]) c.restore();
  ashMotes(L.flat, t, 1);
  seal(L.flat, 330, 330, 190, seg(t, SEAL, SEAL + 0.3), '魂', C.seal);
  screen.vignette = 0;
  screen.flash = 1 - smooth(seg(t, DAWN, DAWN + 0.6));
  screen.aberration = 2 * (1 - seg(t, DAWN, DAWN + 0.6));
}

const piece: Piece = {
  id: 'lanterns',
  title: 'Spirit Lanterns',
  subtitle: 'Hyakki · The Night Procession',
  about: 'One paper lantern catches a spark; its light turns to ghost-fire, a procession of lanterns lights into the night, and their spirits rise into a fox of blue fire that rushes at the viewer.',
  order: 110,
  duration: DURATION,
  beats: BEATS,
  fonts: { family: 'Noto Serif JP', weight: 900, text: '霊灯百鬼・夜行魂' },
  draw: drawFrame,
};
export default piece;
