import { actBeat, beat, facing, lead, type BodyAct, type BodyLook, type BodyParts } from './look';

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

/** Where an action sends a fist (in the world), how far of the way (`k`), and how high it arcs on the way. */
interface Pose { x: number; y: number; z: number; k: number; up: number }
/** A fist's last pose and the step that set it, so a fist the next step takes over eases across instead of jumping. */
interface FistMem { key: string; at: number; from: Pose | null; last: Pose | null }

interface Mem { phase: number; kneel: number; spin: number; orbit: number; fists: Record<'fistL' | 'fistR', FistMem> }
const mem = new WeakMap<BodyParts, Mem>();

/** The moves this body acts out itself, in place of its cast pose. The Hour Strikes: its call and its bell (the tolls between go on top of whatever he does). */
const OWN = new Set(['sweep', 'pillars', 'order', 'eclipse', 'strikes', 'bell']);
/** Sun Order's wedges fire this far apart, after the first (s; the move's own number, not scaled by tier). */
const ORDER_GAP = 0.8;

/** A step's action as a list of one, or none: so a block below reads it as `act`. */
const one = (a: BodyAct | null) => (a ? [a] : []);
const mix = (a: Pose, b: Pose, k: number): Pose => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k), k: lerp(a.k, b.k, k), up: lerp(a.up, b.up, k) });

/**
 * Where a step of Fists of the Court or Pillar Fall sends its fist. Fists: up high halfway and down on the floor where the zone is.
 * Pillar Fall: up over him, then down toward you as the stone falls on you.
 */
function sentBy(a: BodyAct): Pose {
  if (a.name === 'fists') {
    const u = a.t / a.dur;
    return { x: a.wx, y: 0.8, z: a.wz, k: u < 1 ? ease(u) : 1 - seg(a.t - a.dur, 0.3, 1.2), up: u < 1 ? Math.sin(Math.min(1, u) * Math.PI) * 3.2 : 0 };
  }
  const { w, s: st, r } = actBeat(a, 0.2, 0.25, 0.6);
  const F = facing(a), hx = a.bx + F.fx * 0.4, hz = a.bz + F.fz * 0.4;
  return { x: lerp(hx, lerp(a.bx, a.wx, 0.42), st), y: lerp(5.6, 1.4, st), z: lerp(hz, lerp(a.bz, a.wz, 0.42), st), k: r * (st > 0 ? 1 : w), up: 0 };
}

/** The same spin round the ring's own axis, whichever way the ring is tilted. */
function spinHalo(p: BodyParts, angle: number) {
  p.turn('halo', HALO_TILT, 0, 0);
  p.turn('halo', 0, angle, 0);
  p.turn('halo', -HALO_TILT, 0, 0);
}

export const wardenLook: BodyLook = (s, p) => {
  let m = mem.get(p);
  if (!m) {
    const fist = (): FistMem => ({ key: '', at: 0, from: null, last: null });
    mem.set(p, m = { phase: s.phase, kneel: s.kneeling ? 1 : 0, spin: 0, orbit: 0, fists: { fistL: fist(), fistR: fist() } });
  }
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

  // A move it acts out itself (below) takes the place of its cast pose. A move's steps overlap: each block reads the step to show.
  const live = !s.kneeling && fall <= 0 ? s.acts : [];
  const own = live.some((a) => OWN.has(a.name));
  const sweepA = lead(live, (a) => a.name === 'sweep'), pillarsA = lead(live, (a) => a.name === 'pillars');
  const orderA = lead(live, (a) => a.name === 'order', ORDER_GAP * 3 + 0.4), eclipseA = lead(live, (a) => a.name === 'eclipse');
  const callA = lead(live, (a) => a.name === 'strikes', 0.6), tollA = lead(live, (a) => a.name === 'toll', 0.6), bellA = lead(live, (a) => a.name === 'bell', 0.6);
  let punchL = 0, punchR = 0;

  // Casts: wind up, then strike as the zone lands.
  if (s.cast && !s.kneeling && !own) {
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

  // Sweep: drawn round to his right, then the fists swing across the cone in front as it lands (placed below); the body turns with them.
  for (const act of one(sweepA)) {
    const { w, s: st, r } = actBeat(act, 0.22, 0.2, 0.6);
    coreYaw = r * ((1 - st) * w * -0.5 + st * 0.45);
    coreLeanX += r * (st * 0.22 - (1 - st) * w * 0.08);
    slabTilt += r * w * 0.15;
  }
  // Pillar Fall: a fist goes up over him and comes down toward you as the stone falls (placed below); he leans into it.
  for (const act of one(pillarsA)) {
    const { w, s: st, r } = actBeat(act, 0.2, 0.25, 0.6);
    coreLeanX += r * ((1 - st) * w * -0.14 + st * 0.26);
    stonesY += r * w * 0.4;
    stonesSpin += r * w * 0.9;
    haloGlow += r * (w * 0.5 + st * 0.6);
  }
  // Sun Order: the fists up at his shoulders and the halo turning, then a punch out to one side and the other as each wedge fires.
  for (const act of one(orderA)) {
    const { w, r } = actBeat(act, 0.18, ORDER_GAP * 3 + 0.3, 0.6);
    const ready = w * r;
    fy += 1.1 * ready;
    fx += 0.4 * ready;
    haloGlow += ready * 0.9;
    spinRate += ready * 2.2;
    for (let i = 0; i < 4; i++) {
      const at = act.dur + i * ORDER_GAP, u = act.t - at;
      const pulse = u < -0.15 ? 0 : u < 0 ? (u + 0.15) / 0.15 : Math.max(0, 1 - u / 0.35);
      if (i % 2 === 0) punchL = Math.max(punchL, pulse);
      else punchR = Math.max(punchR, pulse);
    }
    coreYaw += (punchL - punchR) * 0.3;
    sunGlow *= 1 + (punchL + punchR) * 0.6;
  }
  // Eclipse, step by step: near him, the fists come down beside him; far from him, they are flung out wide.
  for (const act of one(eclipseA)) {
    const { w, s: st, r } = actBeat(act, 0.18, 0.2, 0.5);
    const wind = (1 - st) * w;
    if (act.step === 1) {
      fx += r * (-1.0 * wind + 2.6 * st);
      fz += r * 0.6 * wind;
      fy += r * (0.4 * wind + 0.3 * st);
      slabTilt += r * (-0.25 * wind + 0.5 * st);
      haloSize += r * 0.3 * st;
      haloGlow += r * (0.6 * w + 1.2 * st);
      stonesSize += r * 0.4 * st;
      stonesSpin += r * 1.5 * st;
    } else {
      fy += r * (2.2 * wind - 1.7 * st);
      fx += r * (-0.3 * wind + 1.0 * st);
      fz += r * 0.6 * st;
      coreY += r * (0.3 * wind - 0.35 * st);
      coreLeanX += r * 0.25 * st;
      stonesSize += r * 0.3 * st;
      haloGlow += r * (0.5 * w + 0.8 * st);
    }
  }

  // The Hour Strikes, the call: he rises, the fists go up and wide and the halo swells; then both fists are thrown down the arm he calls
  // (placed below). He stands still for it.
  for (const act of one(callA)) {
    const { w, s: st, r } = actBeat(act, 0.5, 0.5, 0.8);
    const wind = (1 - st) * w * r;
    fy += 2.6 * wind;
    fx += 1.2 * wind;
    coreY += r * (0.45 * w - 0.15 * st);
    coreLeanX += r * (-0.14 * (1 - st) * w + 0.26 * st);
    pitch = r * (-0.5 * (1 - st) * w + 0.3 * st);
    slabTilt += r * 0.35 * w;
    haloSize += r * (0.3 * w + 0.15 * st);
    haloGlow += r * (0.9 * w + 1.0 * st);
    spinRate += r * 3.2 * w;
    sunGlow *= 1 + r * (0.6 * w + 0.8 * st);
    stonesY += r * 0.7 * w;
    stonesSpin += r * 1.6 * w;
  }
  // A toll on the way to the bell: the halo and the sun swell for a moment and the stones jump, whatever else he is doing.
  for (const act of one(tollA)) {
    const u = act.t - act.dur, pulse = u < -0.3 ? 0 : u < 0 ? (u + 0.3) / 0.3 : Math.max(0, 1 - u / 0.6);
    haloSize += 0.22 * pulse;
    haloGlow += 1.3 * pulse;
    sunGlow *= 1 + 0.9 * pulse;
    stonesY += 0.35 * pulse;
    stonesSize += 0.15 * pulse;
  }
  // The bell: the fists up and apart over his head, then struck together as it lands; the halo flares and the stones fly out.
  for (const act of one(bellA)) {
    const { w, s: st, r } = actBeat(act, 0.22, 0.3, 0.7);
    fy += r * (2.9 * w + 0.3 * st);
    fx += r * (1.5 * (1 - st) * w - 1.0 * st);
    fz += r * 0.3 * st;
    pitch = r * -0.4 * w;
    coreY += r * (0.35 * w - 0.25 * st);
    slabTilt += r * (0.3 * w - 0.4 * st);
    haloSize += r * 0.5 * st;
    haloGlow += r * (0.6 * w + 1.8 * st);
    sunGlow *= 1 + r * (0.5 * w + 1.2 * st);
    stonesSize += r * 0.5 * st;
    stonesSpin += r * (1.2 * w + 2.5 * st);
    stonesY += r * 0.6 * w;
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
  const swing = s.cast?.style === 'swing' && !s.kneeling && !own;
  for (const [name, sg] of [['fistL', 1], ['fistR', -1]] as const) {
    const out = swing ? swx : sg * fx + (sg > 0 ? punchL : -punchR) * 1.7;
    p.move(name, out, fy + bob * 0.4, fz + (swing ? swz : 0));
    p.turn(name, pitch, sg * 0.1 * Math.sin(t * 1.3), -sg * lean * 0.1);
  }
  // Stone Sweep: both fists from behind his right, swung across the cone in front of him to his left as it lands.
  for (const act of one(sweepA)) {
    const { w, s: st, r } = actBeat(act, 0.22, 0.2, 0.6);
    const F = facing(act), th = lerp(-1.75, 1.25, st), R = lerp(2.3, 3.6, st), y = lerp(2.3, 1.2, st);
    for (const [name, off] of [['fistL', 0.18], ['fistR', -0.18]] as const) {
      const an = th + off;
      p.toward(name, act.bx + R * (Math.cos(an) * F.fx + Math.sin(an) * F.lx), y, act.bz + R * (Math.cos(an) * F.fz + Math.sin(an) * F.lz), r * (st > 0 ? 1 : w));
    }
  }
  // The Hour Strikes, the call: both fists thrown out toward the arm he calls, side by side, and held there.
  for (const act of one(callA)) {
    const { s: st, r } = actBeat(act, 0.5, 0.5, 0.8);
    if (st > 0) {
      const dx = act.wx - act.bx, dz = act.wz - act.bz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
      for (const [name, off] of [['fistL', 0.9], ['fistR', -0.9]] as const) {
        p.toward(name, act.bx + ux * 4.2 + uz * off, 2.6, act.bz + uz * 4.2 - ux * off, st * r);
      }
    }
  }
  // Fists of the Court and Pillar Fall send one fist a step, left then right, and the steps overlap: each fist shows the step that
  // strikes with it, and eases across to the next one instead of jumping.
  for (const name of ['fistL', 'fistR'] as const) {
    const a = lead(live, (x) => (x.name === 'fists' || x.name === 'pillars') && (x.step % 2 === 0) === (name === 'fistL'));
    const fm = m.fists[name], key = a ? `${a.name}${a.step}` : '';
    if (key !== fm.key) {
      fm.from = fm.last ? { ...fm.last } : null;
      fm.at = t;
      fm.key = key;
    }
    const to = a ? sentBy(a) : fm.last ? { ...fm.last, k: 0, up: 0 } : null;
    if (!to) continue;
    const pose = fm.from ? mix(fm.from, to, seg(t - fm.at, 0, 0.3)) : to;
    fm.last = pose;
    if (pose.k <= 0.001) continue;
    p.toward(name, pose.x, pose.y, pose.z, pose.k, pose.up);
    p.turn(name, 0.6 * pose.k, 0, 0);
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
