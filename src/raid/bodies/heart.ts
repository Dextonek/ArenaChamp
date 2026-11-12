import * as THREE from 'three';
import { actBeat, beat, facing, lead, type BodyAct, type BodyLook, type BodyParts } from './look';

/**
 * The Heart of Noon (models/bosses/heart.glb, built by `build_heart()` in blender/bosses/boss_bodies.py): the fallen sun itself.
 * `core` is the molten heart in its crust and holds the `mask` (its face), the `crown` of snapped rays behind it and the three armillary
 * rings `ringA`, `ringB`, `ringC`, each turning about its own tilted axis. The two sun blades `bladeL`, `bladeR` (its hands) and the
 * `shards` round its foot hang free under the root. It never walks: it floats in the middle of its room and turns to whom it looks at.
 *
 * Embers Wake: the seams dim, the rings turning slowly. The Rings Turn: the seams brighter; the rings come down round its foot and lie
 * flat, each turning with its beam over the floor. Noon Falls: the seams blaze, the crown turns, the crust sheds its plates (the
 * Heartbeat's look throws them out over the floor: the crust is one mesh) and each Heartbeat swells it and lets it go.
 */

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v: number) => { const x = clamp(v); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (v: number, a: number, b: number) => ease((v - a) / (b - a));

/** Where the core floats (m): the rings' and the crown's pivot is its middle. */
const CORE_Y = 3.7;
/** The blades' rest places, under the root (m): either side, the point down. */
const BLADE = { x: 3.15, y: 2.9, z: 0.5 };
/**
 * How much of the model's own glow each part keeps: the game's bloom does the rest. The heart is made at 3.0 and the eyes at 5.0 in the
 * Blender file, which hid the whole body from above (the Warden's lesson, docs/architecture/raid.md, "The glow").
 */
const GLOW_CORE = [0.09, 0.13, 0.19];
/** However a cast or a beat swells it, the core never glows more than this many times its phase's own. */
const GLOW_SWELL = 2.2;
const GLOW_MASK = 0.2;
/** Its eyes, white fire: brighter than the rest of the face, small enough not to bloom it away. */
const GLOW_EYES = 1.5;
const GLOW_RING = 0.55;
const GLOW_BLADE = 0.6;

/** Each ring's own axis in the model (glTF, y up): the tilt it was built at in Blender, turned into y up. */
const RING_AXES: Record<RingName, THREE.Vector3> = {
  ringA: new THREE.Vector3(0.1651, 0.309, 0.9366).normalize(),
  ringB: new THREE.Vector3(0.8002, 0.4255, -0.4226).normalize(),
  ringC: new THREE.Vector3(-0.4755, 0.8236, 0.309).normalize(),
};
type RingName = 'ringA' | 'ringB' | 'ringC';
const RINGS: RingName[] = ['ringA', 'ringB', 'ringC'];
/** How fast each turns at rest (rad/s), and how big each lies round its foot when it comes down. */
const RING_SPIN = [0.42, -0.31, 0.24];
const RING_DOWN_SIZE = [1.25, 1.35, 1.45];

/**
 * What the moves on this screen tell the body, frame by frame: the rings as beams (each move's look sets its ring), and the Heartbeat.
 * The moves run on every screen from the same casts, so every screen's body shows the same thing. One fight at a time per page.
 */
export const HEART_LIVE = {
  /** Each ring: how far down round its foot (0..1), the yaw its beam points at in the world, and whether it is lit (0 when locked). */
  rings: [0, 1, 2].map(() => ({ down: 0, yaw: 0, lit: 1 })),
  /** The Heartbeat gathering, 0..1, and seconds since it last struck (large when it hasn't). */
  beat: 0,
  struck: 99,
  /** Hold Still: how full it is before its next beat, 0..1, and seconds since the last one (large when none). */
  fill: 0,
  clench: 99,
  /**
   * Take the Blade: each of its two blades away from its hand. `out`: how far it has left (0 in its hand, 1 away); where it is in
   * the world then (`y` its middle: its point is 2.2 m under that, times `size`); `size`: how big it is drawn; `up`: turned point
   * up, 0..1 (a hero holds it aloft: from the game's steep camera a blade that points down shows only its hilt).
   */
  blades: [0, 1].map(() => ({ out: 0, x: 0, y: 0, z: 0, size: 1, up: 0 })),
};

/** Clears what the moves left: a new fight starts with the rings up. */
export function resetHeartLive() {
  for (const r of HEART_LIVE.rings) Object.assign(r, { down: 0, yaw: 0, lit: 1 });
  HEART_LIVE.beat = 0;
  HEART_LIVE.struck = 99;
  HEART_LIVE.fill = 0;
  HEART_LIVE.clench = 99;
  for (const bl of HEART_LIVE.blades) Object.assign(bl, { out: 0, x: 0, y: 0, z: 0, size: 1, up: 0 });
}

interface Mem { phase: number; kneel: number; spin: number[]; crown: number; beat: number; eyes: THREE.MeshStandardMaterial[] }
const mem = new WeakMap<BodyParts, Mem>();
const Q = new THREE.Quaternion();
const Q2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const one = (a: BodyAct | null) => (a ? [a] : []);

/** Turns a part about an axis of its parent's space, on top of what it already has. */
function spin(p: BodyParts, name: string, axis: THREE.Vector3, angle: number) {
  const n = p.node(name);
  if (n) n.quaternion.premultiply(Q.setFromAxisAngle(axis, angle));
}

/**
 * The gold of its face, crown and rings a little less polished than the Blender file has it: under the game's sun the face, tilted up to
 * the camera, caught the light whole and bloomed white, and the face is the point of the figure.
 */
const MATTE = 0.58;
const MASK_MATTE = 0.78;
const MASK_TONE = 0.7;
function matte(p: BodyParts) {
  for (const name of ['mask', 'crown', 'ringA', 'ringB', 'ringC', 'bladeL', 'bladeR']) {
    p.node(name)?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const std = mat as THREE.MeshStandardMaterial;
        if (!std.isMeshStandardMaterial || std.metalness <= 0.5) continue;
        std.roughness = Math.max(std.roughness, MATTE);
        // The face a shade darker and duller still: it faces the camera and the sun at once.
        if (name === 'mask') {
          std.roughness = Math.max(std.roughness, MASK_MATTE);
          std.metalness = Math.min(std.metalness, 0.6);
          std.color.multiplyScalar(MASK_TONE);
        }
      }
    });
  }
}

export const heartLook: BodyLook = (s, p) => {
  let m = mem.get(p);
  if (!m) {
    mem.set(p, m = { phase: s.phase, kneel: s.kneeling ? 1 : 0, spin: [0, 0, 0], crown: 0, beat: 0, eyes: [] });
    matte(p);
    p.node('mask')?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (mat.name.endsWith('eyes')) m!.eyes.push(mat as THREE.MeshStandardMaterial);
    });
  }
  const dt = Math.min(s.dt, 0.1);
  m.phase += (s.phase - m.phase) * Math.min(1, dt * 1.6);
  m.kneel += ((s.kneeling ? 1 : 0) - m.kneel) * Math.min(1, dt * 3);
  const ph = m.phase, kn = m.kneel, t = s.time;
  const fall = Math.max(0, s.fall), alive = 1 - seg(fall, 0, 0.5);
  const burn = seg(ph, 0, 1), noon = seg(ph, 1, 2);

  // The Heartbeat: it swells as it gathers, quicker near the end, and lets go when it strikes.
  const gather = HEART_LIVE.beat;
  m.beat += dt * (1.2 + gather * 6);
  const thump = gather > 0 ? Math.pow(Math.max(0, Math.sin(m.beat * Math.PI)), 6) * (0.3 + 0.7 * gather) : 0;
  const strike = Math.max(0, 1 - HEART_LIVE.struck / 0.6);
  // Hold Still: it fills as the floor's light runs in to it, and on the beat it clenches hard and lets go.
  const fill = ease(HEART_LIVE.fill), since = HEART_LIVE.clench;
  const clench = since < 0.07 ? since / 0.07 : Math.max(0, 1 - (since - 0.07) / 0.45);

  // Idle: it floats and breathes, the blades and the shards a little out of step.
  const bob = Math.sin(t * 1.1) * 0.12 * (1 - kn * 0.8);
  let coreY = bob, leanX = Math.sin(t * 0.7) * 0.02, leanZ = Math.sin(t * 0.55) * 0.015, coreYaw = 0, coreSize = 1 + thump * 0.06 + strike * 0.1 + fill * 0.07 - clench * 0.16;
  let bx = 0, by = Math.sin(t * 1.1 + 1.3) * 0.15, bz = Math.sin(t * 0.8) * 0.08, bladeTilt = 0;
  let coreGlow = lerp(GLOW_CORE[0], GLOW_CORE[1], burn) + (GLOW_CORE[2] - GLOW_CORE[1]) * noon;
  coreGlow *= 1 + Math.sin(t * 1.9) * 0.06 + thump * 0.9 + strike * 1.2 + fill * 0.35 + clench * 1.1;
  let maskGlow = 1, ringGlow = 1 + burn * 0.3, crownSpin = 0.05 + noon * 0.25, shardsOut = 1 + noon * 0.35, shardsY = 0;

  const live = !s.kneeling && fall <= 0 ? s.acts : [];
  const sweepA = lead(live, (a) => a.name === 'sweep');

  // Casts: wind up over the cast bar, strike as the zone lands.
  if (s.cast && !s.kneeling && !sweepA) {
    const { a, k } = beat(s.cast);
    const style = s.cast.style;
    maskGlow += a * 1.2 + k * 0.6;
    if (style === 'burst') {
      // Solar Flare and the Crown of Rays: it draws in, the blades fold to it, then everything flares out.
      coreSize += a * -0.05 + k * 0.12;
      bx += -a * 1.4 + k * 1.6;
      by += a * 0.6;
      coreGlow *= 1 + a * 0.8 + k * 1.4;
      crownSpin += a * 2.5;
      shardsOut += k * 0.5;
      leanX += -a * 0.08;
    } else if (style === 'channel') {
      // Held out, trembling, while the rings come down or the beat gathers.
      const hold = ease(s.cast.t / 0.5) * (s.cast.t < s.cast.dur ? 1 : Math.max(0, 1 - (s.cast.t - s.cast.dur) / 0.3));
      bx += hold * 0.9;
      by += hold * 1.1 + Math.sin(t * 29) * 0.04 * hold;
      coreY += hold * 0.3;
      coreGlow *= 1 + hold * 0.5;
      ringGlow += hold * 0.8;
      shardsY += hold * 0.5;
    } else {
      // raise and the rest: the blades up over it, then down.
      by += a * 2.4 - k * 2.6;
      bz += -a * 0.3 + k * 1.4;
      bladeTilt += -a * 0.4 + k * 0.7;
      leanX += -a * 0.12 + k * 0.2;
      coreGlow *= 1 + a * 0.5;
    }
  }

  // A hit: a small flinch and a flicker.
  const h = s.hit;
  leanX -= Math.abs(h) * 0.4;
  leanZ += h * 0.25;
  coreY -= Math.abs(h) * 0.25;

  // Kneeling: it sinks low, the blades point-down in the floor beside it, the light goes weak.
  coreY -= kn * 1.4;
  leanX += kn * 0.22;
  by -= kn * 1.6;
  bx += kn * 0.3;
  coreGlow *= 1 - kn * 0.6;
  ringGlow *= 1 - kn * 0.6;
  maskGlow *= 1 - kn * 0.7;
  crownSpin *= 1 - kn;
  shardsY -= kn * 0.6;

  coreGlow = Math.min(coreGlow, (lerp(GLOW_CORE[0], GLOW_CORE[1], burn) + (GLOW_CORE[2] - GLOW_CORE[1]) * noon) * GLOW_SWELL);

  // Place the core and the face.
  p.move('core', 0, coreY, 0);
  p.turn('core', leanX, coreYaw + Math.sin(t * 0.4) * 0.04, leanZ);
  p.size('core', coreSize);
  p.size('mask', 1 / coreSize);
  p.size('crown', 1 / coreSize);

  // The crown turns a little about its own front, faster in the last phase.
  m.crown += dt * crownSpin;
  p.turn('crown', 0, 0, Math.sin(m.crown) * (0.08 + noon * 0.12) + noon * m.crown * 0.15);

  // The rings: each turns about its own axis. Brought down by The Rings Turn, it lies flat round the heart's foot and turns with its beam.
  RINGS.forEach((name, i) => {
    const live = HEART_LIVE.rings[i];
    const down = ease(live.down) * alive;
    m!.spin[i] += dt * RING_SPIN[i] * (1 + burn * 0.6) * (1 - kn * 0.8) * (1 - down);
    const n = p.node(name);
    if (!n) return;
    if (down > 0.001) {
      // Flat: its axis turned up, then turned with the beam, and set down round the foot of the heart (the core's own space).
      Q2.setFromUnitVectors(RING_AXES[name], UP);
      n.quaternion.slerp(Q2, down);
      n.quaternion.premultiply(Q.setFromAxisAngle(UP, down * live.yaw));
      n.position.y -= down * (CORE_Y + coreY - 0.5 - i * 0.18);
      p.size(name, lerp(1, RING_DOWN_SIZE[i], down) / coreSize);
    } else {
      spin(p, name, RING_AXES[name], m!.spin[i]);
      p.size(name, 1 / coreSize);
    }
  });

  // The blades: its hands, either side, rocking a little.
  for (const [name, sg] of [['bladeL', 1], ['bladeR', -1]] as const) {
    p.move(name, sg * bx, by + bob * 0.5, bz);
    p.turn(name, bladeTilt, 0, sg * (0.05 * Math.sin(t * 0.9 + sg) + kn * 0.25));
  }
  // Blade Sweep: both blades drawn round to its right, then swung across the arc in front as it lands.
  for (const act of one(sweepA)) {
    const { w, s: st, r } = actBeat(act, 0.22, 0.2, 0.6);
    const F = facing(act), th = lerp(-1.8, 1.3, st), R = lerp(3, 4.4, st), y = lerp(2.8, 1.3, st);
    for (const [name, off] of [['bladeL', 0.16], ['bladeR', -0.16]] as const) {
      const an = th + off;
      p.toward(name, act.bx + R * (Math.cos(an) * F.fx + Math.sin(an) * F.lx), y, act.bz + R * (Math.cos(an) * F.fz + Math.sin(an) * F.lz), r * (st > 0 ? 1 : w));
      p.turn(name, r * (0.4 + st * 0.9), 0, 0);
    }
  }
  // Blade Fall: one blade a step, left then right, up over the hero and down point-first where the line lands.
  for (const name of ['bladeL', 'bladeR'] as const) {
    const a = lead(live, (x) => x.name === 'fall' && (x.step % 2 === 0) === (name === 'bladeL'));
    if (!a) continue;
    const { w, s: st, r } = actBeat(a, 0.2, 0.35, 0.7);
    const k = r * (st > 0 ? 1 : w);
    p.toward(name, a.wx, lerp(5.5, 1.6, st), a.wz, k, (1 - st) * w * 1.5);
    p.turn(name, 0, 0, (name === 'bladeL' ? 1 : -1) * 0.15 * (1 - st) * k);
  }

  // Take the Blade: a blade it threw out stands point-down in the floor, or hangs over the hero who took it.
  (['bladeL', 'bladeR'] as const).forEach((name, i) => {
    const bl = HEART_LIVE.blades[i];
    if (bl.out <= 0.001 || fall > 0) return;
    p.toward(name, bl.x, bl.y, bl.z, ease(bl.out));
    p.size(name, lerp(1, bl.size, ease(bl.out)));
    if (bl.up > 0) p.turn(name, Math.PI * ease(bl.up) * ease(bl.out), 0, 0);
  });

  // The shards drift round its foot, wider and higher as it burns.
  p.move('shards', 0, shardsY + bob * 0.4, 0);
  p.turn('shards', 0, t * 0.22, 0);
  p.size('shards', shardsOut);

  // Its light, low under the bloom. The rings dim when locked.
  p.glow('core', coreGlow * alive);
  p.glow('mask', GLOW_MASK * maskGlow * alive);
  for (const e of m.eyes) e.emissiveIntensity = GLOW_EYES * Math.min(2, maskGlow) * alive;
  p.glow('crown', (0.5 + noon * 0.4 + strike) * alive);
  RINGS.forEach((name, i) => p.glow(name, GLOW_RING * ringGlow * (0.25 + 0.75 * HEART_LIVE.rings[i].lit) * (1 + HEART_LIVE.rings[i].down * 0.6) * alive));
  // A blade out of its hand burns brighter: it is there to be taken.
  p.glow('bladeL', GLOW_BLADE * (1 + 1.6 * HEART_LIVE.blades[0].out) * alive);
  p.glow('bladeR', GLOW_BLADE * (1 + 1.6 * HEART_LIVE.blades[1].out) * alive);

  // Falling: the blades drop first and topple, the rings fall and lie on the floor, the crown sinks, the heart goes dark into the floor.
  if (fall > 0) {
    const fBlade = seg(fall, 0, 0.5), fRing = seg(fall, 0.1, 0.7), fCore = seg(fall, 0.3, 1);
    for (const [name, sg] of [['bladeL', 1], ['bladeR', -1]] as const) {
      p.move(name, sg * 0.8 * fBlade, -(BLADE.y - 0.6) * fBlade, 0.4 * fBlade);
      p.turn(name, 0.2 * fBlade, 0, sg * 1.35 * fBlade);
    }
    RINGS.forEach((name, i) => {
      const n = p.node(name);
      if (!n) return;
      Q2.setFromUnitVectors(RING_AXES[name], UP);
      n.quaternion.slerp(Q2, fRing);
      n.position.y -= fRing * (CORE_Y - 0.25 - i * 0.06);
    });
    p.move('core', 0, -2.2 * fCore, 0);
    p.turn('core', 0.25 * fCore, 0.3 * fall, 0.1 * fCore);
    p.move('crown', 0, -0.4 * fCore, -0.3 * fCore);
    p.move('shards', 0, -0.9 * fall, 0);
    p.glow('core', coreGlow * (1 - fCore * 0.9));
  }
};
