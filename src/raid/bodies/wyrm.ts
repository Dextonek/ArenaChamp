import * as THREE from 'three';
import { actBeat, beat, lead, type BodyLook, type BodyParts } from './look';

/**
 * The Eclipse Wyrm (models/bosses/wyrm.glb, built by blender/bosses/boss_wyrm.py): a four-legged dragon of rigid parts, facing +z.
 * `torso` (origin at its middle) holds the four legs (`legBL`, `legBR`, `legFL`, `legFR`, pivots at the hips), the neck chain `neck1`
 * to `neck4` > `head` > `jaw` and `crown` (the black eclipse disc), the tail chain `tail1` to `tail5` and the wings `wingL` > `wingTipL`,
 * `wingR` > `wingTipR`. x is its left. Rotations are about each part's joint: for a part that hangs, a turn about x of a negative angle
 * swings it forward; for the neck (which rises from the shoulders) a positive one bows it forward and down, a negative one lifts the head
 * back and up; about y a positive turn takes a part that points forward (the head) to its left, and the tail (which points back) to its right.
 * The wings rest half-folded up and back; a wing's `up` rolls it about z (its tip up), `sweep` yaws it forward.
 */

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v: number) => { const x = clamp(v); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (v: number, a: number, b: number) => ease((v - a) / (b - a));

/**
 * What the fight's moves tell the body, frame by frame: it hovers while Shadows Stand (the stage) is on, and its crown disc is away
 * while The Eclipse Rolls has it out on the floor. One fight at a time per page.
 */
export const WYRM_LIVE = {
  hover: false,
  disc: true,
  /**
   * Shadow Breath's sweep, set each frame by its move (a body action is kept only 1.2 s past its impact, and the sweep lasts longer):
   * how far through it is (0 to 1, more while it fades), or -1; and the side it starts on, +1 its left.
   */
  sweep: -1,
  side: 1,
};

/** Clears what the moves left: a new fight starts on the ground with its crown on. */
export function resetWyrmLive() {
  WYRM_LIVE.hover = false;
  WYRM_LIVE.disc = true;
  WYRM_LIVE.sweep = -1;
  WYRM_LIVE.side = 1;
}

interface Mem { phase: number; kneel: number; gait: number; hover: number; disc: number }
const mem = new WeakMap<BodyParts, Mem>();

/** The moves whose body act takes the place of the cast pose (Tearfall's `rain` adds its head to the cast's rearing instead). */
const OWN = new Set(['rake', 'tail', 'breath', 'gust', 'roll']);
/** How high it hovers (m), and how long the breath's sweep takes over its front (s). */
const HOVER_Y = 3;
const BREATH_SWEEP = 1.6;
/** Where the hind legs hang from the torso's middle (m behind it): a rear-up drops the hips by this much times the sine of the tilt. */
const HIP_BACK = 1.65;
/**
 * How much of the model's own glow each part keeps: the sun disc and the tail's blade are made at 2.2, and under the game's bloom a
 * bright glow hides the body from above (docs/architecture/raid.md, "The glow").
 */
const GLOW_BODY = 0.14;
const GLOW_EYES = 0.42;

/**
 * Once, as the model is first posed: its glow material (the sun disc, the eyes, the tail's blade) has a near-white base colour, and the
 * bone plates of its throat and belly are pale, and its gold breastplate is a near mirror, so when it rears up and its chest faces the
 * camera they went to a white block under the bloom. The glow keeps its light but its base colour is dimmed, the bone is toned down a
 * little and the gold made rougher. Materials are the model's own, shared
 * by this figure only.
 */
function toneDown(p: BodyParts) {
  const seen = new Set<THREE.Material>();
  p.node('torso')?.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const std = mat as THREE.MeshStandardMaterial;
      // Once per material: a model's materials may be shared by every figure loaded from it, fight after fight.
      if (!std.isMeshStandardMaterial || seen.has(std) || std.userData.wyrmToned) continue;
      seen.add(std);
      std.userData.wyrmToned = true;
      if (std.name === 'wyrm_glow') std.color.multiplyScalar(0.3);
      else if (std.name === 'wyrm_bone') { std.color.multiplyScalar(0.72); std.roughness = Math.max(std.roughness, 0.8); }
      else if (std.name === 'wyrm_gold') { std.roughness = Math.max(std.roughness, 0.62); std.metalness = Math.min(std.metalness, 0.5); }
    }
  });
}

/** Poses both wings: `up` rolls each about z (tip up), `sweep` yaws it forward, `tip` bends the outer wing up; `dl`, `dr` add to each side's roll. */
function wings(p: BodyParts, up: number, sweep: number, tip: number, dl: number, dr: number) {
  p.turn('wingL', 0, -sweep, up + dl);
  p.turn('wingR', 0, sweep, -(up + dr));
  p.turn('wingTipL', 0, 0, tip);
  p.turn('wingTipR', 0, 0, -tip);
}

export const wyrmLook: BodyLook = (s, p) => {
  let m = mem.get(p);
  if (!m) {
    mem.set(p, m = { phase: s.phase, kneel: s.kneeling ? 1 : 0, gait: 0, hover: WYRM_LIVE.hover ? 1 : 0, disc: 1 });
    toneDown(p);
  }
  const dt = Math.min(s.dt, 0.1);
  m.phase += (s.phase - m.phase) * Math.min(1, dt * 1.6);
  m.kneel += ((s.kneeling ? 1 : 0) - m.kneel) * Math.min(1, dt * 2.5);
  m.hover = clamp(m.hover + (WYRM_LIVE.hover && !s.kneeling ? dt / 1.3 : -dt / 0.9));
  m.disc = WYRM_LIVE.disc ? Math.min(1, m.disc + dt / 0.3) : 0;
  const ph = m.phase, kn = m.kneel, hv = ease(m.hover);
  const t = s.time;
  const fall = Math.max(0, s.fall);
  const live = !s.kneeling && fall <= 0 ? s.acts : [];

  const rakeA = lead(live, (a) => a.name === 'rake');
  const tailA = lead(live, (a) => a.name === 'tail');
  const breathA = lead(live, (a) => a.name === 'breath');
  const gustA = lead(live, (a) => a.name === 'gust');
  const rollA = lead(live, (a) => a.name === 'roll');
  const rainA = lead(live, (a) => a.name === 'rain');
  const cast = s.cast && !s.kneeling && fall <= 0 && !live.some((a) => OWN.has(a.name)) ? s.cast : null;
  const { a, k } = cast ? beat(cast) : { a: 0, k: 0 };
  const style = cast?.style;

  // Walking: diagonal pairs (FL with BR, FR with BL), the body rolling a little over the planted feet.
  const amp = clamp(s.speed / 2.2);
  m.gait += dt * s.speed * 1.45;
  const w = Math.sin(m.gait), wc = Math.cos(m.gait);
  const breath = Math.sin(t * 1.2);

  let torsoY = breath * 0.06 - amp * 0.1 * w * w;
  let torsoZ = 0;
  let pitch = 0.01 * breath + amp * 0.02 * wc;
  let yaw = amp * 0.05 * w;
  let roll = 0.012 * Math.sin(t * 0.7) - amp * 0.035 * w;
  let rear = 0;
  // The neck and head: total bow (positive forward and down) and swing to its left, spread over the four segments.
  let nPitch = 0.05 * breath, nYaw = 0, hPitch = 0, hYaw = 0, jaw = 0.02 + 0.02 * breath;
  let swayK = 1;
  // The tail: each segment's turn about y (to its right) and about x (up), and the spread of the whole.
  let tYaw = 0, tUp = 0;
  // The wings: spread 0 folded to 1 wide, extra flap, and a forward sweep on top.
  let spread = 0, flap = 0, wSweep = 0, wTip = 0;
  let legSwing = 0.45 * amp, tuck = 0;
  let glowK = GLOW_BODY * (1 + 0.14 * ph);
  let eyeK = GLOW_EYES * (1 + 0.2 * ph);
  let rakeUp = 0, rakeAcross = 0;

  // Casts by style: `a` winds up over the bar, `k` strikes as the zone lands.
  if (cast) {
    if (style === 'raise') {
      // Wingshade, Tearfall: rears up on the hind legs, the neck up, both wings spread wide and high, then it comes down.
      rear += 0.7 * a * (1 - 0.6 * k) - 0.1 * k;
      nPitch += -0.7 * a + 0.9 * k;
      hPitch += -0.2 * a + 0.2 * k;
      spread += a * 1.1 * (1 - 0.5 * k);
      wTip += 0.2 * a;
      torsoY += -0.35 * k;
      jaw += 0.5 * a * (1 - k);
      // Reared up, its chest's sun disc faces the camera, and under the bloom it went to a white block: it dims as it rears.
      glowK *= 1 - 0.55 * a;
    } else if (style === 'channel') {
      // Holding it: while it hovers, wings beating; on the ground it crouches and spreads its wings with the glow gathering.
      const hold = ease(cast.t / 0.5) * (cast.t < cast.dur ? 1 : Math.max(0, 1 - (cast.t - cast.dur) / 0.3));
      if (!WYRM_LIVE.hover) {
        torsoY += -0.25 * hold;
        spread += 0.8 * hold;
        nPitch += -0.3 * hold;
      } else {
        nPitch += -0.2 * hold;
      }
      glowK += 0.2 * hold;
      eyeK *= 1 + 0.5 * hold;
    } else {
      // Any other: a short rear and strike.
      rear += 0.32 * a * (1 - k);
      nPitch += -0.45 * a + 0.75 * k;
      hPitch += 0.15 * k;
      spread += 0.4 * a * (1 - k);
      torsoY += -0.18 * k;
      jaw += 0.35 * a * (1 - k) + 0.2 * k;
      glowK += 0.1 * a + 0.08 * k;
    }
  }

  // Claw Rake: the right foreleg rears high and rakes down and forward across the front, the head pulled back.
  if (rakeA) {
    const { w: aw, s: st, r } = actBeat(rakeA, 0.2, 0.3, 0.6);
    const wind = (1 - st) * aw;
    rakeUp = r * (wind * 1.9 + st * 0.5);
    rakeAcross = r * (-0.55 * wind + 0.6 * st);
    rear += r * 0.18 * wind;
    roll += r * (0.1 * wind - 0.14 * st);
    yaw += r * (0.12 * wind - 0.22 * st);
    nPitch += r * (-0.45 * wind + 0.55 * st);
    hPitch += r * (-0.2 * wind + 0.2 * st);
    torsoY += r * (0.12 * wind - 0.22 * st);
    jaw += r * 0.3 * st;
    spread += r * 0.25 * wind;
    glowK += r * 0.1 * st;
  }

  // Tail Sweep: the tail draws round away from the target and sweeps hard round to the other side at the impact, the body twisting with it.
  if (tailA) {
    const { w: aw, s: st, r } = actBeat(tailA, 0.25, 0.3, 0.7);
    const sd = tailA.x >= 0 ? 1 : -1;
    // Positive turns the tail to its right: away from a target on its left.
    const draw = aw * (1 - st), sweep = st;
    tYaw += r * sd * (0.34 * draw - 0.42 * sweep);
    tUp += r * 0.04 * sweep;
    yaw += r * sd * (0.16 * draw - 0.22 * sweep);
    roll += r * sd * (-0.05 * draw + 0.08 * sweep);
    nYaw += r * sd * (0.2 * draw - 0.3 * sweep);
    hYaw += r * sd * (0.1 * draw - 0.1 * sweep);
    nPitch += r * 0.1 * st;
    torsoY += -0.1 * r * st;
    spread += r * 0.15 * draw;
  }

  // Shadow Breath: the jaw wide, then the head swings across its front over the sweep, low and forward, starting on the target's side.
  // The wind-up comes from its body action; the sweep itself from the move (`WYRM_LIVE.sweep`).
  const sweeping = WYRM_LIVE.sweep >= 0 && !s.kneeling && fall <= 0;
  if ((breathA && breathA.t < breathA.dur) || sweeping) {
    const sd = sweeping ? WYRM_LIVE.side : breathA!.x >= 0 ? 1 : -1;
    const wind = sweeping ? 1 : actBeat(breathA!, 0.3, 0.1, 0.5).w;
    const u = sweeping ? clamp(WYRM_LIVE.sweep) : 0;
    const open = !sweeping ? wind : WYRM_LIVE.sweep <= 1 ? 1 : 1 - clamp((WYRM_LIVE.sweep - 1) * BREATH_SWEEP / 0.4);
    const swing = !sweeping ? wind : 1 - 2 * ease(u);
    const hold = open;
    jaw += 0.75 * hold;
    nYaw += sd * 0.95 * swing * hold;
    hYaw += sd * 0.2 * swing * hold;
    nPitch += (0.65 + 0.15 * Math.sin(u * Math.PI)) * hold;
    hPitch += -0.15 * hold;
    yaw += sd * 0.1 * swing * hold;
    pitch += 0.05 * hold;
    torsoY += -0.15 * hold;
    spread += 0.2 * hold;
    glowK += 0.12 * hold;
    eyeK *= 1 + 0.4 * hold;
  }

  // Wing Gust: both wings beat forward and down at the impact, the body pushed back a little.
  if (gustA) {
    const { w: aw, s: st, r } = actBeat(gustA, 0.22, 0.3, 0.6);
    const wind = (1 - st) * aw;
    spread += r * (0.95 * wind - 0.5 * st);
    wSweep += r * (-0.2 * wind + 0.95 * st);
    wTip += r * (0.3 * wind - 0.9 * st);
    rear += r * 0.28 * wind;
    torsoZ += -0.4 * r * st;
    torsoY += r * (0.1 * wind - 0.15 * st);
    pitch += r * 0.05 * st;
    nPitch += r * (-0.3 * wind + 0.2 * st);
  }

  // The Eclipse Rolls: the head bows and flings forward at the impact; the disc leaves its brow (WYRM_LIVE.disc).
  if (rollA) {
    const { w: aw, s: st, r } = actBeat(rollA, 0.18, 0.35, 0.6);
    const wind = (1 - st) * aw;
    nPitch += r * (-0.4 * wind + 0.95 * st);
    hPitch += r * (-0.3 * wind + 0.55 * st);
    pitch += r * (-0.04 * wind + 0.1 * st);
    torsoY += r * (0.12 * wind - 0.2 * st);
    torsoZ += 0.2 * r * st;
    jaw += r * 0.3 * st;
    spread += r * 0.3 * wind;
    glowK += r * 0.15 * st;
  }

  // Tearfall: the head up to the Tear, the jaw open, then snapping down at each step's impact (three steps, their winds overlapping).
  if (rainA || live.some((x) => x.name === 'rain')) {
    let up = 0;
    for (const x of live) if (x.name === 'rain') up = Math.max(up, actBeat(x, 0.2, 0.25, 0.5).w * actBeat(x, 0.2, 0.25, 0.5).r);
    let snap = 0;
    if (rainA) { const b = actBeat(rainA, 0.2, 0.25, 0.5); snap = b.s * b.r; }
    nPitch += -0.75 * up + 1.15 * snap * (up > 0 ? 1 : 0);
    hPitch += -0.3 * up + 0.4 * snap;
    jaw += 0.7 * up * (1 - 0.8 * snap);
    rear += 0.22 * up * (1 - snap);
    spread += 0.3 * up;
    glowK += 0.12 * up;
  }

  // A hit: it rocks back, the neck whips and the glow flares.
  const h = s.hit, ah = Math.abs(h);
  pitch -= ah * 0.14;
  roll += h * 0.14;
  torsoY -= ah * 0.1;
  nPitch -= ah * 0.45;
  nYaw += h * 0.5;
  hPitch -= ah * 0.2;
  jaw += ah * 0.4;
  glowK += ah * 1.5;
  eyeK += ah * 1.2;

  // Hovering (the stage): lifted off, the legs hanging, the wings beating steadily, the tail trailing.
  if (hv > 0) {
    const beatW = Math.sin(t * 4.4);
    torsoY += HOVER_Y * hv + 0.12 * Math.sin(t * 1.4) * hv;
    pitch += -0.1 * hv;
    spread += 0.75 * hv;
    flap += 0.5 * hv * beatW;
    wTip += -0.3 * hv * Math.cos(t * 4.4);
    nPitch += -0.2 * hv;
    tuck += hv;
    legSwing *= 1 - hv;
    tYaw += 0.06 * hv * Math.sin(t * 1.1);
    tUp += 0.1 * hv;
    roll += 0.02 * hv * Math.sin(t * 2.2);
  }

  // Kneeling: belly down on the floor, the legs folded under, the neck low, the wings drooping half open, the eyes brighter.
  torsoY -= kn * 1.0;
  tUp += kn * 0.35;
  pitch += kn * 0.05;
  nPitch += kn * 0.55;
  hPitch += kn * 0.25;
  spread += kn * (0.3 - spread) * 0.6;
  flap -= kn * 0.2;
  tuck += kn * 1.4;
  jaw += kn * 0.12;
  glowK += kn * 0.06;
  eyeK *= 1 + kn * 0.6;
  swayK = 1 - 0.5 * kn;

  // Falling: it collapses onto its side, the neck and tail limp, the wings sprawled, the glow going out.
  const down = seg(fall, 0, 0.7), limp = seg(fall, 0.1, 1);
  torsoY -= 0.95 * down;
  tUp += 0.3 * down;
  roll += 0.75 * down;
  pitch += 0.1 * limp;
  nPitch += 0.5 * limp;
  hPitch += 0.35 * limp;
  nYaw += 0.4 * limp;
  tYaw += 0.15 * limp;
  tuck += 1.2 * limp;
  jaw += 0.3 * limp;
  const dead = seg(fall, 0.5, 1);
  glowK *= 1 - 0.9 * dead;
  eyeK *= 1 - 0.95 * dead;

  // The body.
  const rr = Math.max(0, rear);
  const tilt = pitch - rr;
  p.move('torso', 0, torsoY + HIP_BACK * Math.sin(rr), torsoZ);
  p.turn('torso', tilt, yaw, roll);

  // The neck: swaying slowly, the pitch and swing spread along its four segments, the head after them.
  for (let i = 1; i <= 4; i++) {
    const ph2 = t * 0.5 - i * 0.7;
    const sway = swayK * (1 - 0.5 * hv);
    p.turn('neck' + i, nPitch / 4 + 0.035 * sway * Math.sin(t * 0.8 - i * 0.6), nYaw / 4 + (0.09 + 0.02 * i) * sway * Math.sin(ph2), 0);
  }
  p.turn('head', hPitch + 0.03 * Math.sin(t * 0.9 + 1), hYaw - 0.1 * swayK * Math.sin(t * 0.5 - 3.5), 0);
  p.turn('jaw', Math.max(0, jaw), 0, 0);

  // The tail: the tip curling more than the root; Tail Sweep's turn spread over the chain.
  for (let i = 1; i <= 5; i++) {
    const idle = (0.04 + 0.035 * i) * Math.sin(t * 0.9 - i * 0.8) * (1 - 0.6 * kn);
    // When it rears up (or the torso tilts nose-up any way) the tail would swing down through the floor: its root turns back up by the
    // tilt, so the tail stays along the floor behind it.
    const level = i === 1 ? Math.max(0, -tilt) * 1.05 : i === 2 ? Math.max(0, -tilt) * 0.15 : 0;
    p.turn('tail' + i, tUp / 5 + level + (i === 5 ? 0.06 * Math.sin(t * 1.6) : 0), tYaw + idle, 0);
  }

  // The wings: folded and twitching at rest, spread by the casts, beating when it hovers, sprawled when it falls.
  const spr = clamp(spread, -0.3, 1.3);
  const twL = Math.pow(Math.max(0, Math.sin(t * 1.7 + 0.5)), 14) * 0.1, twR = Math.pow(Math.max(0, Math.sin(t * 1.3 + 2)), 14) * 0.1;
  // Lying on its side the top wing droops and the under one is lifted back out of the floor, both spread across the roof.
  const droop = kn * -0.4;
  wings(p, lerp(-0.2, 0.75, spr) + flap + droop + 0.02 * Math.sin(t * 0.6) + 0.3 * limp, lerp(-0.3, 0.5, spr) + wSweep, lerp(-0.45, 0.45, spr) + wTip, twL + 1.0 * down, twR + 1.0 * down);

  // The legs: diagonal pairs, folded under when it kneels, hanging when it hovers; the hind legs stay upright when the body rears.
  for (const [n, front, sd, ph3] of [['legFL', 1, 1, 0], ['legFR', 1, -1, Math.PI], ['legBL', 0, 1, Math.PI], ['legBR', 0, -1, 0]] as const) {
    const g = m.gait + ph3, swing = Math.sin(g), lift = Math.max(0, -Math.cos(g));
    let x = legSwing * swing - tilt * (front ? 0.35 : 1);
    if (front) x += -1.6 * rr - 0.55 * tuck;
    else x += 0.5 * tuck;
    let z = 0, y = 0.28 * amp * lift * (1 - hv);
    if (n === 'legFR') { x += -rakeUp; z += rakeAcross; y += 0.15 * rakeUp; }
    z += sd * 0.05 * tuck + sd * -0.04 * hv;
    p.turn(n, x, 0, z);
    p.move(n, 0, y, 0);
    // The rigid legs hang from a body that crouches: each is lifted just enough to stand on the floor (as Ash's are).
    p.keepAbove(n);
  }

  // The crown: the eclipse disc, away while it rolls on the floor, growing back over 0.3 s when it returns.
  p.size('crown', ease(m.disc));

  // The glow: the sun disc and the tail's blade at one level, the eyes at their own; under the bloom it stays low.
  p.glow('torso', glowK);
  p.glow('head', eyeK * (1 + Math.sin(t * 2.4) * 0.08));
  p.glow('tail5', glowK * (1 + Math.sin(t * 2) * 0.1));
};
