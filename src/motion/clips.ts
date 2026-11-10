import * as THREE from 'three';
import raw from './kaykit.json?raw';
import rawUal from './ual.json?raw';

/**
 * Animation clips an animator made, replayed on the game's own rig. The clips are from the KayKit Character Animations
 * pack by Kay Lousberg (CC0, `pipeline/assets/kaykit/`); `pipeline/tools/bake-motion.html` reads each one frame by
 * frame and writes `kaykit.json`: not bone rotations of that rig, but what any humanoid rig can follow, in the
 * character's own frame (X its left, Y up, Z forward): how far the hips are from where they rest (in leg lengths), how
 * the hips, chest and head are turned from rest, which way each upper arm, forearm, thigh and shin points, how each foot
 * is turned from rest, and which way the item in each hand points.
 */
interface Baked {
  fps: number;
  stride: number;
  clips: Record<string, { dur: number; hit: number; frames: number[] }>;
  figure?: ClipFigure;
}

/**
 * The figure a clip was made on: its thigh and shin (m), how far its ankle reaches from its hip at rest (in leg lengths) and
 * how far its idle hangs the upper arms out from its sides (rad). The game fits each clip to a hero by these
 * (heroFigure.ts `fitLeg`, `fitArm`; docs/knowledge/retargeting-arms.md).
 */
export interface ClipFigure { thigh: number; shin: number; restReach: number; armOut: number }
/** KayKit's Rig_Medium: small and round, a long thigh and a short shin, knees bent 12° at rest, idle arms 40° out. */
const KAYKIT_FIGURE: ClipFigure = { thigh: 0.227, shin: 0.149, restReach: 0.993, armOut: 0.707 };

// Two packs in one table: KayKit (attacks, casts, the guard and two-handed idles, the old walk and run) and Quaternius'
// Universal Animation Library (pipeline/tools/bake-ual.js): a realistic mannequin whose proportions are close to our
// heroes', used for standing since 2026-11-10 (user: the standing pose and the legs were still wrong).
const KK = JSON.parse(raw) as Baked, UAL = JSON.parse(rawUal) as Baked;
if (KK.fps !== UAL.fps || KK.stride !== UAL.stride) throw new Error('motion packs baked differently');
const DATA: Baked = { fps: KK.fps, stride: KK.stride, clips: { ...KK.clips, ...UAL.clips } };
const FIGURES = new Map<string, ClipFigure>([
  ...Object.keys(KK.clips).map((k) => [k, KAYKIT_FIGURE] as const),
  ...Object.keys(UAL.clips).map((k) => [k, UAL.figure ?? KAYKIT_FIGURE] as const),
]);

/** The figure the clip was made on. */
export function clipFigure(name: ClipName): ClipFigure {
  return FIGURES.get(name) ?? KAYKIT_FIGURE;
}

export type ClipName =
  | 'Melee_1H_Attack_Chop' | 'Melee_1H_Attack_Slice_Diagonal' | 'Melee_1H_Attack_Slice_Horizontal' | 'Melee_1H_Attack_Stab'
  | 'Melee_2H_Attack_Chop' | 'Melee_2H_Attack_Slice' | 'Melee_2H_Attack_Stab' | 'Melee_2H_Idle'
  | 'Melee_Unarmed_Attack_Punch_A' | 'Melee_Unarmed_Idle'
  | 'Ranged_Magic_Raise' | 'Ranged_Magic_Shoot' | 'Ranged_Magic_Spellcasting'
  | 'Hit_A' | 'Hit_B' | 'Idle_A' | 'Running_A' | 'Walking_A'
  // Universal Animation Library
  | 'Idle_Loop' | 'Walk_Loop' | 'Jog_Fwd_Loop' | 'Sprint_Loop' | 'Sword_Idle';

/** One side's arm: where the upper arm and the forearm point, and where the item in the hand points. */
export interface ArmPose { upper: THREE.Vector3; fore: THREE.Vector3; aim: THREE.Vector3 }
/** One side's leg: where the thigh and the shin point, and how the foot is turned from rest. */
export interface LegPose { thigh: THREE.Vector3; shin: THREE.Vector3; foot: THREE.Quaternion }
/** A clip's pose at one moment (see the file comment). */
export interface ClipPose {
  hips: THREE.Vector3;
  qHips: THREE.Quaternion;
  qChest: THREE.Quaternion;
  qHead: THREE.Quaternion;
  arm: { L: ArmPose; R: ArmPose };
  leg: { L: LegPose; R: LegPose };
}

const arm = (): ArmPose => ({ upper: new THREE.Vector3(), fore: new THREE.Vector3(), aim: new THREE.Vector3() });
const leg = (): LegPose => ({ thigh: new THREE.Vector3(), shin: new THREE.Vector3(), foot: new THREE.Quaternion() });
export const newClipPose = (): ClipPose => ({
  hips: new THREE.Vector3(), qHips: new THREE.Quaternion(), qChest: new THREE.Quaternion(), qHead: new THREE.Quaternion(),
  arm: { L: arm(), R: arm() }, leg: { L: leg(), R: leg() },
});

/**
 * The moment the blow lands in each attack clip (seconds). The baker's own guess (the item's tip furthest forward) is right
 * for chops and stabs; a level slice passes the front mid-swing, so those are set from the frames by eye.
 */
const HIT: Partial<Record<ClipName, number>> = {
  Melee_1H_Attack_Slice_Diagonal: 0.4,
  Melee_1H_Attack_Slice_Horizontal: 0.5,
  Melee_2H_Attack_Slice: 0.43,
  Ranged_Magic_Shoot: 0.33,
};

/** A clip's length and the moment its blow lands (seconds). */
export function clipInfo(name: ClipName) {
  const c = DATA.clips[name];
  return { dur: c.dur, hit: HIT[name] ?? c.hit };
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3();

/**
 * The clip's pose at `t` seconds (clamped to the clip, or wrapped round it with `loop`), into `out`. `mirror` swaps left
 * and right: the same move for a hero whose weapon is in the other hand.
 */
export function sampleClip(name: ClipName, t: number, out: ClipPose, mirror = false, loop = false) {
  const c = DATA.clips[name], n = c.frames.length / DATA.stride, f = c.frames, S = DATA.stride;
  let x = t * DATA.fps;
  if (loop) x = ((x % (n - 1)) + (n - 1)) % (n - 1);
  else x = Math.min(n - 1, Math.max(0, x));
  const i = Math.min(n - 2, Math.floor(x)), u = x - i, a = i * S, b = a + S;
  const vec = (o: number, into: THREE.Vector3, unit = true) => {
    va.set(f[a + o], f[a + o + 1], f[a + o + 2]);
    vb.set(f[b + o], f[b + o + 1], f[b + o + 2]);
    into.lerpVectors(va, vb, u);
    if (mirror) into.x = -into.x;
    return unit ? into.normalize() : into;
  };
  const quat = (o: number, into: THREE.Quaternion) => {
    qa.set(f[a + o], f[a + o + 1], f[a + o + 2], f[a + o + 3]);
    qb.set(f[b + o], f[b + o + 1], f[b + o + 2], f[b + o + 3]);
    into.slerpQuaternions(qa, qb, u);
    // mirrored in the plane between left and right: the turn about X stays, the turns about Y and Z flip
    if (mirror) into.set(into.x, -into.y, -into.z, into.w);
    return into;
  };
  vec(0, out.hips, false);
  quat(3, out.qHips);
  quat(7, out.qChest);
  quat(11, out.qHead);
  // left then right in the data; mirrored, each side takes the other's
  const [first, second] = mirror ? (['R', 'L'] as const) : (['L', 'R'] as const);
  for (const [side, o] of [[first, 15], [second, 24]] as const) {
    vec(o, out.arm[side].upper);
    vec(o + 3, out.arm[side].fore);
    vec(o + 6, out.arm[side].aim);
  }
  for (const [side, o] of [[first, 33], [second, 43]] as const) {
    vec(o, out.leg[side].thigh);
    vec(o + 3, out.leg[side].shin);
    quat(o + 6, out.leg[side].foot);
  }
  return out;
}

const gaits = new Map<ClipName, { dur: number; speed: number; leftFwd: number }>();

/**
 * For a walk or a run that loops on the spot: how long one round is (seconds), how fast it would carry the body (leg
 * lengths a second: how fast the foot on the ground goes back under the hips) and the moment the left foot is furthest
 * forward (seconds). A figure that moves at `speed` of its own leg lengths while the clip plays does not slide its feet.
 */
export function gaitInfo(name: ClipName) {
  let g = gaits.get(name);
  if (g) return g;
  const c = DATA.clips[name], S = DATA.stride, f = c.frames, n = f.length / S;
  // a foot, in leg lengths (thigh and shin taken as equal): [forward of its hip, height]
  const foot = (i: number, o: number) => [0.5 * (f[i * S + o + 2] + f[i * S + o + 5]), 0.5 * (f[i * S + o + 1] + f[i * S + o + 4]) + f[i * S + 1]];
  let low = 1e9, far = -1e9, leftFwd = 0;
  for (let i = 0; i < n; i++) {
    low = Math.min(low, foot(i, 33)[1], foot(i, 43)[1]);
    if (foot(i, 33)[0] > far) { far = foot(i, 33)[0]; leftFwd = i / DATA.fps; }
  }
  // on the ground: within a tenth of a leg of the lowest a foot gets
  let back = 0, frames = 0;
  for (let i = 0; i < n - 1; i++) for (const o of [33, 43]) {
    const a = foot(i, o), b = foot(i + 1, o);
    if (a[1] > low + 0.1 || b[1] > low + 0.1) continue;
    back += (a[0] - b[0]) * DATA.fps;
    frames++;
  }
  g = { dur: (n - 1) / DATA.fps, speed: frames ? back / frames : 1, leftFwd };
  gaits.set(name, g);
  return g;
}
