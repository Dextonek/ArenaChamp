import type { BodyLook, BodyParts, BodyState } from './look';

/**
 * The Sun Warden (models/bosses/warden.glb, built by blender/bosses/boss_bodies.py): a stone sentinel with no legs.
 * `core` holds `mask`, `halo`, `sun` (and `corona` under it, hidden inside the sun until scaled out) and the two
 * `slab` shoulders. The two `fist`s and the ring of `stones` hang free under the root.
 *
 * Awake: the sun dim, the halo still. High Noon: it blazes and the halo turns. Last Light: the slabs break away and
 * orbit, the sun goes black and its corona flares.
 */

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v: number) => { const x = clamp(v); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** `v` from 0 at `a` to 1 at `b`. */
const seg = (v: number, a: number, b: number) => ease((v - a) / (b - a));

/** Rest places (metres, the parent's space: x its left, y up, z its front). */
const FIST = { y: 2.5 };
const SLAB = { x: 0.85, y: 0.75 };
/** How much of the model's own glow the halo and the sun keep: the game's bloom does the rest. */
const GLOW_HALO = 0.42;
const GLOW_SUN = 0.6;
/** The halo ring is tilted this far about x in the model. */
const HALO_TILT = 0.3;

interface Mem { phase: number; kneel: number; spin: number; orbit: number }
const mem = new WeakMap<BodyParts, Mem>();

/** The wind-up and the strike of a cast: `a` swells until 70 % of it, then drops; `k` is the strike, held and then settling. */
function beat(c: NonNullable<BodyState['cast']>) {
  const ta = c.dur * 0.7;
  const a = c.t < ta ? ease(c.t / ta) : Math.max(0, 1 - (c.t - ta) / 0.1);
  const k = c.t < ta ? 0 : c.t < c.dur ? Math.min(1, (c.t - ta) / 0.1) : Math.max(0, 1 - (c.t - c.dur) / 0.3);
  return { a, k };
}

/** The same spin round the ring's own axis, whichever way the ring is tilted. */
function spinHalo(p: BodyParts, angle: number) {
  p.turn('halo', HALO_TILT, 0, 0);
  p.turn('halo', 0, angle, 0);
  p.turn('halo', -HALO_TILT, 0, 0);
}

export const wardenLook: BodyLook = (s, p) => {
  let m = mem.get(p);
  if (!m) mem.set(p, m = { phase: s.phase, kneel: s.kneeling ? 1 : 0, spin: 0, orbit: 0 });
  const dt = Math.min(s.dt, 0.1);
  // Smoothed, so a new phase or a kneel eases in instead of jumping.
  m.phase += (s.phase - m.phase) * Math.min(1, dt * 1.6);
  m.kneel += ((s.kneeling ? 1 : 0) - m.kneel) * Math.min(1, dt * 3);
  const ph = m.phase, kn = m.kneel;
  const blaze = seg(ph, 0, 1), last = seg(ph, 1, 2);
  const t = s.time;
  const fall = Math.max(0, s.fall);
  const alive = 1 - seg(fall, 0, 0.5);

  // Idle: it hovers and breathes, the fists and stones a little out of step.
  const bob = Math.sin(t * 1.4) * 0.14 * (1 - kn * 0.8);
  let coreY = bob, coreLeanX = Math.sin(t * 0.9) * 0.02, coreLeanZ = Math.sin(t * 0.7) * 0.015, coreYaw = 0;
  let fx = 0, fy = Math.sin(t * 1.4 + 1.2) * 0.1, fz = Math.sin(t * 1.1) * 0.06;
  let swx = 0, swz = 0, pitch = 0, slabTilt = 0;
  let stonesY = 0, stonesSpin = 0.3, stonesSize = 1;
  let sunGlow = lerp(0.5, 1.5, blaze) * (1 - last), haloGlow = lerp(0.6, 1.7, blaze) + last * 0.8, maskGlow = lerp(0.8, 1.3, blaze);
  let haloSize = 1, sunSize = 1, spinRate = blaze * 1.3 + last * 1.0;
  sunGlow *= 1 + Math.sin(t * 2.3) * 0.08;

  // Gliding: it tilts into the move and the fists and stones trail behind.
  const lean = clamp(s.fwd / 4, -1, 1), slide = clamp(s.side / 4, -1, 1);
  const glide = clamp(s.speed / 4);
  coreLeanX += lean * 0.2;
  coreLeanZ -= slide * 0.16;
  fz -= lean * 0.6;
  fx -= slide * 0.5;
  coreY += glide * 0.12;
  stonesSpin += glide * 0.5;

  // Casts: wind up, then strike.
  if (s.cast && !s.kneeling) {
    const { a, k } = beat(s.cast);
    const style = s.cast.style;
    if (style === 'swing') {
      // Both fists drawn back to one side, then swept across the front.
      swx = a * 1.5 - k * 2.6;
      swz = -a * 1.2 + k * 2.2;
      fy += a * 0.4;
      coreYaw = a * 0.55 - k * 0.7;
      slabTilt += a * 0.15;
    } else if (style === 'thrust' || style === 'lunge' || style === 'point') {
      // Fists pulled back, the sun gathers, then both punch forward together.
      fx = fx - a * 0.4 - k * 1.2;
      fz += -a * 1.4 + k * 2.8;
      fy += a * 0.2;
      coreLeanX += -a * 0.16 + k * 0.3;
      sunGlow *= 1 + a * 0.8 + k * 0.8;
      sunSize += k * 0.35;
      maskGlow += a * 0.6;
      pitch = -a * 0.2 + k * 0.1;
    } else if (style === 'burst') {
      // Fists drawn in to the chest, then flung wide; the slabs close and fan open, the halo flares.
      fx += -a * 1.2 + k * 2.4;
      fz += a * 0.8;
      fy += a * 0.3;
      slabTilt += -a * 0.25 + k * 0.45;
      coreLeanX += -a * 0.1;
      haloSize += k * 0.2;
      haloGlow += a * 0.6 + k * 1.2;
      stonesSize += k * 0.3;
      stonesSpin += a * 0.8 + k * 1.5;
    } else if (style === 'channel') {
      // Held out and trembling while the light is drawn.
      const hold = ease(s.cast.t / 0.4) * (s.cast.t < s.cast.dur ? 1 : Math.max(0, 1 - (s.cast.t - s.cast.dur) / 0.3));
      fx += hold * 1.0;
      fy += hold * 0.9 + Math.sin(t * 31) * 0.04 * hold;
      fz += hold * 0.2;
      coreY += hold * 0.25;
      sunGlow *= 1 + hold * 0.8;
      haloGlow += hold * 0.9;
      spinRate += hold * 2.4;
      stonesSpin += hold * 1.4;
      stonesY += hold * 0.4;
      slabTilt += hold * 0.3;
    } else {
      // raise, slam: the fists go up over the head, the stones lift, then everything comes down.
      fx += -a * 1.0 + k * 0.3;
      fy += a * 2.6 - k * 3.2;
      fz += -a * 0.2 + k * 1.7;
      pitch = -a * 0.6 + k * 0.5;
      coreLeanX += -a * 0.18 + k * 0.32;
      coreY += a * 0.2 - k * 0.2;
      slabTilt += a * 0.35 - k * 0.2;
      stonesY += a * 0.6 - k * 0.5;
      stonesSpin += a * 0.8;
      stonesSize += k * 0.25;
      haloGlow += a * 0.7 + k * 0.8;
      sunGlow *= 1 + a * 0.5;
    }
  }

  // A hit: a small flinch back and a shudder.
  const h = s.hit;
  coreLeanX -= Math.abs(h) * 0.5;
  coreLeanZ += h * 0.3;
  coreY -= Math.abs(h) * 0.3;
  fz -= Math.abs(h) * 0.6;

  // Kneeling: it settles low, the fists on the floor in front, the slabs fall open and the light goes weak.
  coreY -= kn * 1.1;
  coreLeanX += kn * 0.28;
  fy -= kn * 1.8;
  fz += kn * 0.9;
  fx += kn * 0.2;
  slabTilt -= kn * 1.1;
  stonesY -= kn * 0.5;
  stonesSpin *= 1 - kn * 0.7;
  sunGlow *= 1 - kn * 0.7;
  haloGlow *= 1 - kn * 0.65;
  spinRate *= 1 - kn;
  maskGlow *= 1 - kn * 0.7;

  // Last Light: the slabs break away and orbit.
  m.orbit += dt * (0.9 + last * 0.5);
  const orb = last * (1 - kn * 0.6);
  for (const [name, sg] of [['slabL', 1], ['slabR', -1]] as const) {
    p.turn(name, 0, 0, sg * slabTilt);
    if (orb > 0.001) {
      const th = m.orbit + (sg > 0 ? 0 : Math.PI);
      const rho = 2.2;
      p.move(name, orb * (Math.cos(th) * rho - sg * SLAB.x), orb * (1.0 + Math.sin(th * 2) * 0.3 - SLAB.y), orb * Math.sin(th) * rho);
      p.turn(name, orb * Math.sin(th) * 0.5, orb * th, orb * Math.cos(th) * 0.4);
    }
  }

  // The halo and the sun.
  m.spin += dt * spinRate;
  spinHalo(p, m.spin);
  if (alive > 0.01) {
    // Under the game's bloom a bright halo hides the whole body: it glows at under half of what the model says.
    p.glow('halo', Math.min(1.1, haloGlow * GLOW_HALO) * alive);
    p.glow('sun', sunGlow * GLOW_SUN * alive);
  } else {
    p.glow('halo', 0);
    p.glow('sun', 0);
  }
  p.glow('mask', maskGlow * alive);
  p.size('halo', haloSize);
  p.size('sun', sunSize);
  // The corona is inside the sun until Last Light, when it flares out.
  p.size('corona', 1 + last * 1.6 * alive);
  p.glow('corona', (1 + Math.sin(t * 5) * 0.3 * last) * (0.4 + last * 0.9));

  // Place the parts.
  p.move('core', 0, coreY, 0);
  p.turn('core', coreLeanX + pitch * 0.2, coreYaw + Math.sin(t * 0.5) * 0.03, coreLeanZ);
  const swing = s.cast?.style === 'swing' && !s.kneeling;
  for (const [name, sg] of [['fistL', 1], ['fistR', -1]] as const) {
    const out = swing ? swx : sg * fx;
    p.move(name, out, fy + bob * 0.4, fz + (swing ? swz : 0));
    p.turn(name, pitch, sg * 0.1 * Math.sin(t * 1.3), -sg * lean * 0.1);
  }
  // Fists of the Court: one fist at a time flies up and out, then comes down where the hero stood, and floats back.
  if (s.act?.name === 'fists' && fall <= 0) {
    const name = s.act.step % 2 === 0 ? 'fistL' : 'fistR', u = s.act.t / s.act.dur;
    const out = u < 1 ? ease(u) : 1 - seg(s.act.t - s.act.dur, 0.3, 1.2);
    // Up high halfway, down on the floor at the end, where the zone is.
    const arc = u < 1 ? Math.sin(Math.min(1, u) * Math.PI) * 3.2 : 0;
    p.toward(name, s.act.wx, 0.8, s.act.wz, out, arc);
    p.turn(name, 0.6 * out, 0, 0);
  }
  p.move('stones', 0, stonesY + bob * 0.5, 0);
  p.turn('stones', 0, t * stonesSpin, 0);
  p.size('stones', stonesSize);

  // Falling: the fists drop first, then the slabs, the halo and sun last; the core sinks into the ground.
  if (fall > 0) {
    const fFist = seg(fall, 0, 0.55), fSlab = seg(fall, 0.15, 0.75), fHalo = seg(fall, 0.3, 0.95), fCore = seg(fall, 0.35, 1);
    p.move('core', 0, -2.1 * fCore - 0.2 * fall, 0);
    p.turn('core', 0.3 * fCore, 0.4 * fall, 0.08 * fCore);
    for (const [name, sg] of [['fistL', 1], ['fistR', -1]] as const) {
      p.move(name, sg * (0.9 * fFist), -(FIST.y - 0.55) * fFist, 0.6 * fFist);
      p.turn(name, 0.9 * fFist, sg * 0.5 * fFist, -sg * 0.5 * fFist);
    }
    for (const [name, sg] of [['slabL', 1], ['slabR', -1]] as const) {
      p.move(name, sg * 1.5 * fSlab, -3.2 * fSlab, 0.8 * fSlab);
      p.turn(name, 0.5 * fSlab, sg * 0.6 * fSlab, -sg * 0.9 * fSlab);
    }
    p.move('halo', 0, -3.4 * fHalo, 0.3 * fHalo);
    p.turn('halo', -0.4 * fHalo, 0, 0.25 * fHalo);
    p.move('sun', 0, -3.0 * fHalo, 0);
    p.move('mask', 0, -0.1 * fCore, 0.15 * fCore);
    p.move('stones', 0, -0.7 * fall, 0);
    p.size('stones', 1 + 0.4 * fall);
  }
};
