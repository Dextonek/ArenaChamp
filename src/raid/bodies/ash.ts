import { actBeat, beat, lead, type BodyLook, type BodyParts } from './look';

/**
 * Ash (models/bosses/ash.glb, built by blender/bosses/boss_bodies.py): a hunched magma brute on his knuckles.
 * The `torso` (origin at the hips) holds the `core` and `head`, the two arms (`arm` > `fore` > `fist`) and `legL`,
 * `legR`, and five armour plates (`plateA` to `plateE`, an addition to the design's table) that fall away in turn,
 * so the core shows more. Rotations are about each part's joint: for a part that hangs, a turn about x of a negative
 * angle swings it forward, a positive one back.
 *
 * Each phase the seams burn hotter and plates fall off: Ember steps in (1) loses the front and belly plates, Together
 * (2) the back ones.
 */

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v: number) => { const x = clamp(v); return x * x * (3 - 2 * x); };
const seg = (v: number, a: number, b: number) => ease((v - a) / (b - a));

interface Mem { phase: number; kneel: number; gait: number }
const mem = new WeakMap<BodyParts, Mem>();

/** Where each plate goes when it falls (in the torso's space: x its left, y up its spine, z its front), and when. */
const PLATES: Array<[string, [number, number, number], 1 | 2]> = [
  ['plateA', [1.0, -2.2, 0.8], 1],
  ['plateB', [-1.0, -2.2, 0.8], 1],
  ['plateE', [0, -2.0, 1.0], 1],
  ['plateC', [1.0, -2.2, -0.9], 2],
  ['plateD', [-1.0, -2.2, -0.9], 2],
];

/** The moves this body acts out itself, in place of its cast pose. */
const OWN = new Set(['quake', 'rock']);
/** Cinder Rock: he lets go of the rock this long before it lands (s): it goes up, and comes down on you. */
const ROCK_FLIGHT = 0.55;

export const ashLook: BodyLook = (s, p) => {
  let m = mem.get(p);
  if (!m) mem.set(p, m = { phase: s.phase, kneel: s.kneeling ? 1 : 0, gait: 0 });
  const dt = Math.min(s.dt, 0.1);
  m.phase += (s.phase - m.phase) * Math.min(1, dt * 1.6);
  m.kneel += ((s.kneeling ? 1 : 0) - m.kneel) * Math.min(1, dt * 3);
  const ph = m.phase, kn = m.kneel;
  const t = s.time;
  const fall = Math.max(0, s.fall);
  // A move he acts out himself (below) takes the place of his cast pose. Cinder Rock's two throws overlap, one arm each.
  const live = !s.kneeling && fall <= 0 ? s.acts : [];
  const quakeA = lead(live, (a) => a.name === 'quake');
  const cast = s.cast && !s.kneeling && !live.some((a) => OWN.has(a.name)) ? s.cast : null;
  const { a, k } = cast ? beat(cast) : { a: 0, k: 0 };
  const style = cast?.style;

  // Walking: a knuckle-walk, the fists planted in turn, the body dipping heavily on each one.
  const glide = clamp(s.speed / 3);
  const running = style === 'lunge' ? k : 0;
  m.gait += dt * (1.1 * s.speed + running * 8);
  const amp = Math.max(glide, running);
  const w = Math.sin(m.gait), lift = Math.cos(m.gait);
  const breath = Math.sin(t * 1.3);

  let torsoY = breath * 0.05 - amp * 0.22 * w * w;
  let lean = 0.02 * breath + amp * 0.12;
  let twist = w * 0.12 * amp, roll = 0.02 * Math.sin(t * 0.7) - w * 0.04 * amp;
  let armL = -0.5 * w * amp + Math.sin(t * 0.8) * 0.03, armR = 0.5 * w * amp - Math.sin(t * 0.8) * 0.03;
  let foreL = -0.6 * Math.max(0, lift) * amp, foreR = -0.6 * Math.max(0, -lift) * amp;
  let legL = 0.45 * w * amp, legR = -0.45 * w * amp, legY = 0;
  let head = -0.05 * amp + 0.03 * breath;
  let coreGlow = (1 + Math.sin(t * 2) * 0.12) * (1 + ph * 0.3);
  let seamGlow = 1 + ph * 0.45;
  const shiftX = w * 0.25 * amp;

  // Casts: wind up, then strike.
  if (cast) {
    if (style === 'lunge') {
      // Down low, the arms swept back; then he is off.
      torsoY += -0.8 * a;
      lean += 0.5 * a + 0.35 * k;
      armL += 0.9 * a;
      armR += 0.9 * a;
      legL += 0.4 * a;
      legR += 0.4 * a;
      head -= 0.3 * a;
      coreGlow += a * 0.9 + k * 0.6;
    } else if (style === 'channel') {
      // Hunched over the floor, the fists pressed in and trembling, the core burning.
      const hold = ease(cast.t / 0.4) * (cast.t < cast.dur ? 1 : Math.max(0, 1 - (cast.t - cast.dur) / 0.3));
      torsoY += -0.5 * hold + Math.sin(t * 28) * 0.03 * hold;
      lean += 0.4 * hold;
      armL += -0.4 * hold;
      armR += -0.4 * hold;
      foreL += 0.3 * hold;
      foreR += 0.3 * hold;
      head -= 0.3 * hold;
      coreGlow += hold * 0.9;
      seamGlow += hold * 0.6;
    } else if (style === 'raise' || style === 'point') {
      // Both arms up cradling a rock, the back arched; then thrown.
      armL += -2.5 * a - 0.5 * k;
      armR += -2.5 * a - 0.5 * k;
      foreL += -0.6 * a;
      foreR += -0.6 * a;
      torsoY += 0.3 * a - 0.25 * k;
      lean += -0.3 * a + 0.4 * k;
      head += -0.2 * a;
      coreGlow += a * 1.0 + k * 0.5;
      seamGlow += a * 0.5;
    } else {
      // slam (and the rest): reared up with both fists overhead, then brought down on the floor.
      armL += -2.3 * a + 0.3 * k;
      armR += -2.3 * a + 0.3 * k;
      foreL += -0.3 * a - 0.2 * k;
      foreR += -0.3 * a - 0.2 * k;
      legL += 0.2 * a;
      legR += 0.2 * a;
      torsoY += 0.4 * a - 0.55 * k;
      lean += -0.35 * a + 0.5 * k;
      head += -0.2 * a + 0.3 * k;
      coreGlow += a * 1.2 + k * 0.8;
      seamGlow += a * 0.6 + k * 0.5;
    }
  }

  // Knuckle Quake: reared up with both fists overhead, then thrown down far out in front, so the cracks run from his fists to you.
  if (quakeA) {
    const { w, s: st, r } = actBeat(quakeA, 0.2, 0.3, 0.6);
    const wind = (1 - st) * w;
    armL += r * (-2.4 * wind - 1.0 * st);
    armR += r * (-2.4 * wind - 1.0 * st);
    foreL += r * (-0.3 * wind - 0.5 * st);
    foreR += r * (-0.3 * wind - 0.5 * st);
    legL += r * 0.25 * wind;
    legR += r * 0.25 * wind;
    torsoY += r * (0.45 * wind - 0.45 * st);
    lean += r * (-0.4 * wind + 0.85 * st);
    head += r * (-0.25 * wind + 0.35 * st);
    coreGlow += r * (1.2 * wind + 0.9 * st);
    seamGlow += r * (0.6 * wind + 0.6 * st);
  }
  // Cinder Rock (from the rim): one arm back over his head with the rock, then thrown up high; it comes down on you. One arm, then the other.
  for (const act of live) {
    if (act.name !== 'rock') continue;
    const tr = Math.max(0.3, act.dur - ROCK_FLIGHT), u = act.t - tr;
    const wind = u < 0 ? ease(act.t / tr) : Math.max(0, 1 - u / 0.12);
    const toss = u < 0 ? 0 : u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.35) / 0.6);
    const sg = act.step % 2 === 0 ? -1 : 1;
    const arm = -2.7 * wind - 1.3 * toss, fore = -0.8 * wind;
    if (sg < 0) { armR += arm; foreR += fore; armL += 0.2 * wind; } else { armL += arm; foreL += fore; armR += 0.2 * wind; }
    twist += sg * (0.35 * wind - 0.3 * toss);
    lean += -0.25 * wind + 0.35 * toss;
    torsoY += 0.15 * wind;
    coreGlow += wind * 0.8 + toss * 0.5;
  }

  // A hit: he rocks back and the core flares.
  const h = s.hit;
  lean -= Math.abs(h) * 0.4;
  roll += h * 0.2;
  torsoY -= Math.abs(h) * 0.15;
  coreGlow += Math.abs(h) * 3;

  // Kneeling: down on his knees, the fists drawn up, the front plates opened wide and the core bare.
  torsoY -= kn * 1.15;
  lean += kn * 0.4;
  armL -= kn * 0.25;
  armR -= kn * 0.25;
  foreL -= kn * 0.9;
  foreR -= kn * 0.9;
  legL += kn * 0.7;
  legR += kn * 0.7;
  legY -= kn * 0.7;
  head += kn * 0.3;
  coreGlow += kn * 0.7;
  seamGlow += kn * 0.3;

  // Falling: he folds forward onto his knuckles, the arms and legs give way and every plate drops off.
  const down = seg(fall, 0, 0.65), flop = seg(fall, 0.1, 1);
  torsoY -= 1.55 * down;
  lean += 0.65 * down;
  roll += 0.15 * flop;
  armL -= 0.7 * flop;
  armR -= 0.7 * flop;
  foreL -= 0.9 * flop;
  foreR -= 0.9 * flop;
  legL += 0.7 * flop;
  legR += 0.7 * flop;
  legY -= 0.9 * flop;
  head += 0.6 * flop;
  const dead = seg(fall, 0.5, 1);
  coreGlow *= 1 - 0.85 * dead;
  seamGlow *= 1 - 0.7 * dead;

  p.move('torso', shiftX, torsoY, 0);
  p.turn('torso', lean, twist, roll);
  p.turn('head', head, -twist * 0.8, 0);
  p.move('head', 0, -0.3 * flop, 0.2 * flop);
  for (const [sg, n, arm, fore] of [[1, 'L', armL, foreL], [-1, 'R', armR, foreR]] as const) {
    p.turn('arm' + n, arm, 0, -sg * (0.03 + 0.25 * flop));
    p.turn('fore' + n, fore, 0, 0);
    p.move('arm' + n, sg * 0.9 * flop, -0.8 * flop, 0);
    p.move('fist' + n, 0, -0.4 * flop, 0);
  }
  for (const [sg, n, leg] of [[1, 'L', legL], [-1, 'R', legR]] as const) {
    p.turn('leg' + n, leg, 0, 0);
    p.move('leg' + n, sg * 0.4 * flop, legY, 0);
  }

  // Plates fall away by phase, and all of them when he falls; they spread open while he kneels.
  for (const [name, d, from] of PLATES) {
    const f = Math.max(from === 1 ? seg(ph, 0.05, 1) : seg(ph, 1.05, 2), seg(fall, 0.1, 0.8));
    const open = kn * (from === 1 ? 1 : 0.4);
    p.move(name, d[0] * f + Math.sign(d[0]) * 0.5 * open, d[1] * f * f + 0.3 * open, d[2] * f + Math.sign(d[2]) * 0.4 * open);
    p.turn(name, -0.9 * f * Math.sign(d[2]) * 0.5, 0, -Math.sign(d[0]) * 0.8 * f);
    p.size(name, Math.max(0, 1 - f * f * 1.02));
  }

  // The seams burn hotter each phase, and the core more.
  // Under the game's bloom a bright core is all that shows from above: it keeps under half of the model's glow.
  p.glow('torso', seamGlow * 0.7);
  p.glow('core', coreGlow * 0.38);
  p.glow('head', seamGlow * 0.7 * (1 + Math.sin(t * 3) * 0.1));
};
