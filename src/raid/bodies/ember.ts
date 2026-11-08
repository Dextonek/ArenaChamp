import { actBeat, beat, lead, type BodyLook, type BodyParts } from './look';

/**
 * Ember (models/bosses/ember.glb, built by blender/bosses/boss_bodies.py): a flame in a burnt mantle, with no legs
 * and no face. A hollow `hood`, the torn `mantle` with glowing edges, the white-hot `core` rising out of the hood and
 * two `lantern`s that orbit her at 1.05 m (the model has them at x = +-1.05, 2.1 m up).
 *
 * The lanterns orbit faster and the flame grows with each phase.
 */

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v: number) => { const x = clamp(v); return x * x * (3 - 2 * x); };
const seg = (v: number, a: number, b: number) => ease((v - a) / (b - a));

/** Where the lanterns rest: out to each side, at this height and distance from her axis. */
const LAMP = { r: 1.05, y: 2.1 };

interface Mem { phase: number; kneel: number; orbit: number }
const mem = new WeakMap<BodyParts, Mem>();

/** The moves this body acts out itself, in place of its cast pose. */
const OWN = new Set(['bombs']);

export const emberLook: BodyLook = (s, p) => {
  let m = mem.get(p);
  if (!m) mem.set(p, m = { phase: s.phase, kneel: s.kneeling ? 1 : 0, orbit: 0 });
  const dt = Math.min(s.dt, 0.1);
  m.phase += (s.phase - m.phase) * Math.min(1, dt * 1.6);
  m.kneel += ((s.kneeling ? 1 : 0) - m.kneel) * Math.min(1, dt * 3);
  const ph = m.phase, kn = m.kneel;
  const t = s.time;
  const fall = Math.max(0, s.fall);
  // A move she acts out herself (below) takes the place of her cast pose. Vent Bombs' steps overlap: one lantern each, left then right.
  const live = !s.kneeling && fall <= 0 ? s.acts : [];
  const bombsA = lead(live, (a) => a.name === 'bombs');
  const cast = s.cast && !s.kneeling && !live.some((a) => OWN.has(a.name)) ? s.cast : null;
  const { a, k } = cast ? beat(cast) : { a: 0, k: 0 };
  const style = cast?.style;

  // The lanterns: an orbit that speeds up with each phase and tightens before a cast.
  let spin = 1.4 + 0.9 * ph;
  let radius = LAMP.r;
  let lampY = 0;
  let lampZ = 0;
  let lampSpread = 0;
  let lampGlow = 1 + Math.sin(t * 5) * 0.1;
  // Idle: she drifts and sways, the flame flickering.
  const bob = Math.sin(t * 1.6) * 0.14 - kn * 0.5;
  let lean = Math.sin(t * 0.9) * 0.025, side = Math.sin(t * 0.7) * 0.025;
  let hoodLean = Math.sin(t * 1.1 + 1) * 0.03, hoodY = 0;
  let flameSize = 1 + 0.2 * ph + Math.sin(t * 7) * 0.03;
  let flameGlow = (1 + Math.sin(t * 9) * 0.1 + Math.sin(t * 5.3) * 0.08) * (1 + 0.3 * ph);
  let edgeGlow = (1 + Math.sin(t * 3 + 2) * 0.12) * (1 + 0.35 * ph);
  let mantleSize = 1;
  let fy = 0;

  // Drifting: she tilts into the move, and the mantle trails behind her.
  const glide = clamp(s.speed / 4);
  lean += clamp(s.fwd / 4, -1, 1) * 0.22;
  side -= clamp(s.side / 4, -1, 1) * 0.18;
  hoodLean -= clamp(s.fwd / 4, -1, 1) * 0.08;
  fy += glide * 0.1;
  edgeGlow *= 1 + glide * 0.3;

  // Casts: wind up, then strike.
  if (cast) {
    if (style === 'thrust') {
      // Draws the lanterns in and back, then throws them forward together.
      radius *= 1 - 0.45 * a;
      lampZ += -0.5 * a + 2.0 * k;
      lean += -0.18 * a + 0.28 * k;
      flameSize += 0.15 * a + 0.2 * k;
      flameGlow += a * 0.8 + k * 1.0;
      lampGlow += a * 0.8 + k * 1.2;
      spin += a * 2;
    } else if (style === 'point') {
      // One lantern held out ahead, pointing and steady; the flame leans toward the mark.
      lampSpread = a;
      lean += 0.12 * a - 0.06 * k;
      hoodLean += 0.18 * a;
      flameGlow += a * 0.6 + k * 1.2;
      lampGlow += a * 1.0 + k * 1.5;
      spin *= 1 - 0.8 * a;
    } else if (style === 'burst') {
      // Everything pulled tight, then flung wide: the lanterns fly out, the mantle flares, the flame leaps.
      radius *= 1 - 0.55 * a + 1.4 * k;
      lampY += -0.2 * a + 0.3 * k;
      mantleSize = 1 - 0.1 * a + 0.2 * k;
      flameSize += -0.2 * a + 0.5 * k;
      flameGlow += a * 0.6 + k * 2.0;
      edgeGlow += a * 0.5 + k * 1.5;
      lampGlow += a * 0.8 + k * 1.5;
      lean += -0.08 * a;
      spin += a * 2 + k * 3;
    } else if (style === 'slam') {
      // Rears up and plunges forward.
      lampY += 0.6 * a - 1.2 * k;
      lampZ += 1.2 * k;
      lean += -0.2 * a + 0.4 * k;
      hoodLean += -0.1 * a + 0.25 * k;
      fy += 0.3 * a - 0.35 * k;
      flameGlow += a * 0.6 + k * 1.2;
    } else {
      // raise (and the rest): the lanterns climb above the hood and wobble, then drop.
      lampY += 1.7 * a - 2.2 * k;
      radius *= 1 - 0.6 * a + 0.5 * k;
      lampZ += 1.0 * k;
      fy += 0.25 * a - 0.2 * k;
      lean += -0.1 * a + 0.2 * k;
      flameSize += 0.25 * a;
      flameGlow += a * 0.8 + k * 0.8;
      lampGlow += a * 1.0 + k * 1.0;
      spin += a * 2;
    }
  }

  // Vent Bombs, each pair: the lanterns lift and the flame gathers, then one lantern is flung toward you as the pair lands (placed below).
  if (bombsA) {
    const { w, s: st, r } = actBeat(bombsA, 0.18, 0.2, 0.5);
    lampY += r * ((1 - st) * w * 1.2 - st * 0.4);
    radius *= 1 - 0.3 * r * (1 - st) * w;
    lean += r * (-0.12 * (1 - st) * w + 0.22 * st);
    flameGlow += r * (w * 0.8 + st * 1.2);
    lampGlow += r * (w * 0.6 + st * 1.5);
  }

  // A hit: she recoils and the flame gutters.
  const h = s.hit;
  lean -= Math.abs(h) * 0.5;
  side += h * 0.4;
  hoodLean -= Math.abs(h) * 0.3;
  flameGlow *= 1 - Math.abs(h) * 1.2;
  fy -= Math.abs(h) * 0.2;

  // Kneeling: she sinks and stoops, the flame low and weak, the lanterns dropped to the floor.
  lean += kn * 0.22;
  hoodLean += kn * 0.5;
  hoodY -= kn * 0.25;
  flameSize *= 1 - kn * 0.3;
  flameGlow *= 1 - kn * 0.65;
  edgeGlow *= 1 - kn * 0.5;
  lampGlow *= 1 - kn * 0.6;
  lampY -= kn * 1.4;
  radius *= 1 + kn * 0.3;
  spin *= 1 - kn * 0.85;

  // Falling: the lanterns go first, then the hood and flame, and the mantle sinks into a heap.
  const fLamp = seg(fall, 0, 0.5), fHood = seg(fall, 0.15, 0.8), fMantle = seg(fall, 0.1, 1);
  const dead = seg(fall, 0.45, 1);
  flameGlow *= 1 - 0.9 * dead;
  edgeGlow *= 1 - 0.8 * dead;
  lampGlow *= 1 - 0.9 * seg(fall, 0.2, 0.8);

  m.orbit += dt * spin;
  const total = bob + fy;
  p.move('mantle', 0, total - 2.3 * fMantle, 0);
  p.turn('mantle', lean + 0.15 * fMantle, 0, side);
  p.size('mantle', Math.max(0, mantleSize * (1 - 0.3 * fMantle)));
  p.move('hood', 0, total + hoodY - 2.2 * fHood, 0.15 * fHood);
  p.turn('hood', lean * 0.8 + hoodLean - 0.7 * fHood, 0, side * 0.8);
  p.move('core', 0, total - 1.7 * fHood, 0);
  p.turn('core', lean * 0.6, 0, side * 0.6 + Math.sin(t * 3.1) * 0.04);
  p.size('core', Math.max(0, flameSize * (1 - 0.9 * dead)));
  // Under the game's bloom the white-hot core hid her hood and mantle: it keeps a third of the model's glow.
  p.glow('core', flameGlow * 0.33);
  p.glow('mantle', edgeGlow);

  for (const [sg, n] of [[1, 'L'], [-1, 'R']] as const) {
    const th = m.orbit + (sg > 0 ? 0 : Math.PI);
    // For a point, the left lantern goes out ahead and the right keeps its slow orbit.
    const held = sg > 0 ? lampSpread : 0;
    const ox = (Math.cos(th) * radius - sg * LAMP.r) * (1 - held) + held * (0.5 - LAMP.r);
    const oz = Math.sin(th) * radius * (1 - held) + held * 2.4;
    const oy = lampY + Math.sin(th * 1.5 + sg) * 0.22 + bob + held * 0.3;
    p.move('lantern' + n, ox + sg * 1.2 * fLamp, oy - 1.7 * fLamp, oz + lampZ + 0.5 * fLamp);
    p.turn('lantern' + n, Math.sin(th) * 0.25, 0, -Math.cos(th) * 0.25);
    p.glow('lantern' + n, lampGlow * (n === 'L' ? 1 + held * 0.8 : 1));
  }

  for (const n of ['L', 'R'] as const) {
    const a = lead(live, (x) => x.name === 'bombs' && (x.step % 2 === 0) === (n === 'L'));
    if (!a) continue;
    const { s: st, r } = actBeat(a, 0.18, 0.2, 0.5);
    p.toward('lantern' + n, a.bx + (a.wx - a.bx) * 0.55, 1.6, a.bz + (a.wz - a.bz) * 0.55, r * st * 0.9, Math.sin(st * Math.PI) * 1.2);
    p.glow('lantern' + n, 1 + 2.5 * r * st);
  }

  // Lantern Toss: the two lanterns fly out and hang either side of where she aimed, burst, then come back.
  if (s.act?.name === 'lanterns' && fall <= 0) {
    // The same spots as the zones: either side of her aim, across the line from her to it.
    const { wx, wz, bx, bz } = s.act, d = Math.hypot(wx - bx, wz - bz) || 1, px = (wz - bz) / d, pz = -(wx - bx) / d, u = s.act.t / s.act.dur;
    const out = u < 1 ? ease(u / 0.45) : 1 - seg(s.act.t - s.act.dur, 0.2, 1.1);
    for (const [sg, n] of [[1, 'L'], [-1, 'R']] as const) {
      p.toward('lantern' + n, wx + px * TOSS * sg, 1.2, wz + pz * TOSS * sg, out, Math.sin(Math.min(1, u / 0.45) * Math.PI) * 1.4);
      p.glow('lantern' + n, 1 + 2.5 * (u < 1 ? ease(u) : out));
    }
  }
};

/** How far either side of her aim the lanterns hang (m). Ember's Lantern Toss in ashEmber.ts uses the same. */
export const TOSS = 3.2;
