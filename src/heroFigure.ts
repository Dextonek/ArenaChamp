import * as THREE from 'three';
import { BODY_MARGIN, HERO_SCALE, Hero, bodyReach, isStaff, type BoneName, type Held } from './effects/weapons/hero';
import type { StatusSet } from './effects/status';
import type { HeroKit, HeroSpell } from './heroes';
import { BodyParts, type BodyAct, type BodyLook } from './raid/bodies/look';
import { RealHero, isRealModel, realClipInfo, type Layer } from './motion/real';
import { clipFigure, clipInfo, gaitInfo, newClipPose, sampleClip, type ClipFigure, type ClipName, type ClipPose } from './motion/clips';
import { traitFor } from './traits';

const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);

/**
 * How a spell is thrown, picked from the spell's own data (`castStyle`):
 * - `thrust`: a skillshot or a lob, the right arm whipped forward.
 * - `point`: a spell on a clicked enemy, the arm pointed at it.
 * - `slam`: a zone called down, both arms up, then down.
 * - `burst`: a spell round the hero, arms flung out.
 * - `raise`: a summon, both arms lifted.
 * - `lunge`: a dash, a low lunge forward.
 * - `swing`: a melee spell, a body-driven slash across.
 * - `channel`: a long self-cast (Opaline's beam), arms held out and trembling.
 */
export type CastStyle = 'thrust' | 'point' | 'slam' | 'burst' | 'raise' | 'lunge' | 'swing' | 'channel';

/** The cast style of `spell` in `slot`, cast on a clicked enemy or not, rooting the hero for `seconds`. */
export function castStyle(spell: HeroSpell, slot: number, onEnemy: boolean, melee: boolean, seconds: number): CastStyle {
  if (spell.dash) return 'lunge';
  if (spell.summon) return 'raise';
  // A long self-cast that controls nothing is a held beam (Opaline's lance); the rest burst out round the hero.
  if (spell.range === 0) return seconds >= 1.6 && !spell.cc ? 'channel' : 'burst';
  if (spell.range <= 3.5) return 'swing';
  if (spell.aim === 'line') return melee && spell.range <= 8 ? 'lunge' : 'thrust';
  if (onEnemy) return 'point';
  return slot === 0 ? 'thrust' : 'slam';
}

/** What the figure's owner tells it every frame besides where it stands. */
export interface FigureState {
  /** The basic attack's swing (`Attacker.motion`). */
  attack?: { wind: number; release: number; melee: boolean };
  /** Its status effects (stun slumps, knock-up flails, root struggles). */
  status?: StatusSet;
  /** Locked solid (Isolde's ice block): the pose freezes, breath included. */
  held?: boolean;
}

/** A pose: [bone, axis, angle] rotations in the figure's own space (X its left, Y up, Z forward). */
type Pose = [BoneName, THREE.Vector3, number][];

/**
 * The cast poses: wind-up, then the strike it snaps into. Angle signs on this rig: a hanging bone (arm, thigh) swings
 * forward with -X; an upright one (chest, head) leans forward with +X; +Z swings a hanging bone toward the figure's
 * left; +Y turns the right shoulder forward.
 */
const CAST: Record<CastStyle, { antic: Pose; strike: Pose; crouch: number }> = {
  thrust: {
    antic: [['chest', AY, -0.45], ['chest', AX, -0.12], ['armR', AX, 0.7], ['foreR', AX, -0.9], ['armL', AX, -0.5], ['head', AY, 0.25]],
    strike: [['pelvis', AY, 0.18], ['chest', AY, 0.4], ['chest', AX, 0.18], ['armR', AX, -1.55], ['foreR', AX, -0.1], ['armL', AX, 0.45], ['head', AY, -0.25]],
    crouch: 0.04,
  },
  point: {
    antic: [['chest', AY, -0.2], ['armR', AX, -0.7], ['foreR', AX, -0.8], ['handR', AX, 0.4]],
    strike: [['chest', AY, 0.22], ['chest', AX, -0.05], ['armR', AX, -1.5], ['foreR', AX, -0.05], ['handR', AX, -0.3], ['armL', AX, 0.2], ['head', AY, -0.2]],
    crouch: 0,
  },
  slam: {
    antic: [['chest', AX, -0.22], ['head', AX, -0.25], ['armR', AX, -2.6], ['armL', AX, -2.6], ['armR', AZ, 0.25], ['armL', AZ, -0.25], ['foreR', AX, -0.3], ['foreL', AX, -0.3]],
    strike: [['chest', AX, 0.42], ['head', AX, 0.2], ['armR', AX, -0.95], ['armL', AX, -0.95], ['armR', AZ, -0.2], ['armL', AZ, 0.2], ['thighL', AX, -0.35], ['thighR', AX, -0.35], ['shinL', AX, 0.65], ['shinR', AX, 0.65]],
    crouch: 0.12,
  },
  burst: {
    antic: [['chest', AX, 0.3], ['head', AX, 0.25], ['armR', AX, -0.9], ['armL', AX, -0.9], ['armR', AZ, 0.6], ['armL', AZ, -0.6], ['foreR', AX, -1.1], ['foreL', AX, -1.1], ['thighL', AX, -0.25], ['thighR', AX, -0.25], ['shinL', AX, 0.5], ['shinR', AX, 0.5]],
    strike: [['chest', AX, -0.22], ['head', AX, -0.2], ['armR', AZ, -1.35], ['armL', AZ, 1.35], ['armR', AX, -0.3], ['armL', AX, -0.3], ['foreR', AX, -0.1], ['foreL', AX, -0.1]],
    crouch: 0.1,
  },
  raise: {
    antic: [['chest', AX, 0.18], ['armR', AX, -0.5], ['armL', AX, -0.5], ['foreR', AX, -1.2], ['foreL', AX, -1.2], ['head', AX, 0.2]],
    strike: [['chest', AX, -0.18], ['head', AX, -0.3], ['armR', AX, -2.1], ['armL', AX, -2.1], ['armR', AZ, -0.45], ['armL', AZ, 0.45], ['foreR', AX, -0.2], ['foreL', AX, -0.2]],
    crouch: 0.03,
  },
  lunge: {
    antic: [['chest', AX, 0.35], ['chest', AY, -0.3], ['armR', AX, 0.8], ['armL', AX, -0.6], ['thighL', AX, -0.4], ['thighR', AX, -0.3], ['shinL', AX, 0.8], ['shinR', AX, 0.7]],
    strike: [['chest', AX, 0.5], ['chest', AY, 0.3], ['armR', AX, -1.4], ['armL', AX, 0.7], ['thighL', AX, -0.75], ['thighR', AX, 0.45], ['shinL', AX, 0.3], ['shinR', AX, 0.35], ['head', AX, -0.3]],
    crouch: 0.14,
  },
  swing: {
    antic: [['pelvis', AY, -0.2], ['chest', AY, -0.6], ['chest', AX, -0.1], ['armR', AX, -1.6], ['armR', AZ, 0.75], ['foreR', AX, -0.7], ['armL', AX, -0.4]],
    strike: [['pelvis', AY, 0.22], ['chest', AY, 0.65], ['chest', AX, 0.28], ['armR', AX, -1.0], ['armR', AZ, -0.65], ['foreR', AX, -0.15], ['armL', AX, 0.4], ['thighL', AX, -0.3], ['shinL', AX, 0.4]],
    crouch: 0.07,
  },
  channel: {
    antic: [['chest', AX, -0.1], ['armR', AX, -0.8], ['armL', AX, -0.8], ['foreR', AX, -0.9], ['foreL', AX, -0.9]],
    strike: [['chest', AX, 0.16], ['armR', AX, -1.45], ['armL', AX, -1.45], ['armR', AZ, 0.18], ['armL', AZ, -0.18], ['foreR', AX, -0.15], ['foreL', AX, -0.15], ['thighL', AX, -0.2], ['shinL', AX, 0.35]],
    crouch: 0.05,
  },
};

/** `CAST` for a hero whose weapon is in the left hand: every pose mirrored left to right. */
const SWAP: Partial<Record<BoneName, BoneName>> = {
  armR: 'armL', armL: 'armR', foreR: 'foreL', foreL: 'foreR', handR: 'handL', handL: 'handR',
  thighR: 'thighL', thighL: 'thighR', shinR: 'shinL', shinL: 'shinR', footR: 'footL', footL: 'footR',
};
const mirrored = (p: Pose): Pose => p.map(([b, ax, v]) => [SWAP[b] ?? b, ax, ax === AX ? v : -v]);
const CAST_L = Object.fromEntries(Object.entries(CAST).map(([k, c]) => [k, { antic: mirrored(c.antic), strike: mirrored(c.strike), crouch: c.crouch }])) as typeof CAST;

/**
 * What kind of item a hand holds (read from the model, `Hero.held`). The clips move the arms of every kind but a
 * one-handed `staff`; how `carry` holds each kind, after how people hold the real things
 * (pipeline/designs/hero-holds.md), is what a staff arm always gets and the others get in a backpedal or a side-step,
 * which the clips do not have:
 * - `staff`: long and upright with its foot near the floor (a staff, a spear, a long axe). Held like a walking staff: the
 *   elbow bent to about a right angle, the forearm level, the tip on the ground beside the foot; walking, it is lifted,
 *   swung forward and planted with the opposite foot. A cast or a shot tips its head toward the target.
 * - `up`: shorter and held up (a sword, a wand, a mirror, a mallet). A melee hero keeps it in a guard: the hilt in front
 *   of the hip, the elbow bent and tucked in, the point at the enemy's face; it is cocked back on a wind-up and brought
 *   down on the strike. A ranged hero holds it up in front, as modelled.
 * - `hang`: it hangs below the hand (a hammer, a greatsword held low, a bucket, claws). In one hand it follows the arm,
 *   which swings less. A two-handed weapon is held low in front in both hands, its head down and forward.
 * - `low`: long and level, held by its end (Hank's axe: the user's drawing, 2026-11-10). One hand, low at the side, the
 *   arm a little out and forward, the head out in front as modelled; walking, the arm swings a little and the weapon
 *   keeps its line. Like a staff its arm is carried, not the stance's; an attack swings it one-handed.
 */
type Hold = 'none' | 'staff' | 'up' | 'hang' | 'low';
const holdOf = (h: Held | null): Hold =>
  !h || h.len + h.raise < 0.38 ? 'none' : isStaff(h) ? 'staff' : h.dir.y > 0.5 ? 'up' : h.dir.y < -0.5 ? 'hang'
    : h.len + h.raise >= 0.9 && h.back < 0.25 ? 'low' : 'none';
/** An arm the carry holds the whole time (its item is not the stance's or the walk's), a cast or an attack aside. */
const carried = (h: Hold) => h === 'staff' || h === 'low';
/** How much of the walk's arm swing a hand keeps with each kind of item in it. */
const CARRY: Record<Hold, number> = { none: 1, hang: 0.55, up: 0.4, staff: 0.12, low: 0.3 };
/**
 * Standing, walking, running, attacks and some casts are an animator's clips, replayed on this rig
 * (`src/motion/clips.ts`: the KayKit Character Animations pack, CC0; pipeline/designs/hero-holds.md says which clip
 * plays when and where the copy leaves the clip on purpose). The game says when a blow lands (the end of the wind-up), so a clip is played against that
 * moment: up to `CLIP_LEAD` seconds of it before its own hit are fitted into the wind-up, and up to `CLIP_TAIL` seconds
 * after it into `STRIKE_RECOVER`.
 */
const CLIP_LEAD = 0.5;
/** The wind-up never plays the clip faster than this many times its own speed: a quick attack starts later in the clip. */
const CLIP_RUSH = 1.8;
const CLIP_TAIL = 0.6;
/**
 * After the hit the body recovers over this long (seconds). The game's own `release` pulse lasts 0.18 s, too short for a
 * body to come back in: real cuts take about that long again.
 */
const STRIKE_RECOVER = 0.42;
/** Cast styles played from a clip: `from` and `to` the part of it used (seconds), `loop` for one that runs as long as the cast. */
const CAST_CLIP: Partial<Record<CastStyle, { clip: ClipName; loop?: true }>> = {
  thrust: { clip: 'Ranged_Magic_Shoot' },
  point: { clip: 'Ranged_Magic_Shoot' },
  raise: { clip: 'Ranged_Magic_Raise' },
  channel: { clip: 'Ranged_Magic_Spellcasting', loop: true },
};

/** The walk and the run every hero uses: two loops that start on the same foot, so they blend. */
const WALK: ClipName = 'Walking_A', RUN: ClipName = 'Running_A';
/**
 * The body's share of a clip, and each arm's (0..1): an arm with a staff in its hand keeps its own way of carrying it.
 * `legs` below 1 swings the legs less far; `grip` is how firmly a two-handed weapon's second hand stays on it (as the
 * weapon arm's share when left out: a clip blending in over a stance that already has both hands on keeps them on);
 * `fit`, when set, fits the clip's legs to this hero's (`fitLeg`) with that much of the clip's crouch (1 all of it);
 * `stand` below 1 leaves that much of the legs and of the hips' place to what is under the clip (a hero already walking
 * off while its blow recovers keeps walking); `from` is taken off the hips' place (a clip entered part-way, where its
 * figure has already stepped back, starts where the hero stands).
 */
interface Share { body: number; armR: number; armL: number; legs?: number; grip?: number; stand?: number; from?: THREE.Vector3; fit?: number }
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * The standing clip: the Universal Animation Library's idle (a realistic mannequin, proportions close to our heroes'),
 * since 2026-11-10. The KayKit idle (`Idle_A`) is from a small round figure whose standing pose never fitted. Each clip's
 * own figure (thigh, shin, rest reach, arm hang) comes with it (`clipFigure`).
 */
const STAND: ClipName = 'Idle_Loop';
/** The standing clips (the arms are fitted to the hero's hang, a held-up item stays as modelled). */
const STANDING = new Set<ClipName>(['Idle_A', 'Idle_Loop']);
const fitAxis = new THREE.Vector3(0, 0, 1);

/**
 * Fits a clip's arm to a hero's own body: the clip's figure needs its arms 40° out to clear its sides, our heroes much less,
 * so copied as they are the arms stand out stiffly (a mannequin's A; user, 2026-11-10, on the Heroes stand). A hanging
 * arm is turned in toward the side by the difference, upper arm and forearm together, as much as it hangs down. `rest` is
 * how far this hero's upper arm hangs out at rest (rad). Used for the idle only: the walk and the run swing the arms wide
 * and far back, as the animator made them.
 */
function fitArm(arm: { upper: THREE.Vector3; fore: THREE.Vector3 }, rest: number, side: 'R' | 'L', fig: ClipFigure) {
  const down = Math.min(1, Math.max(0, (-arm.upper.y - 0.1) / 0.4));
  if (down <= 0) return;
  // turning about the forward axis: + takes a left arm out (toward +x), a right arm in
  const a = (rest - fig.armOut) * down * (side === 'L' ? 1 : -1);
  arm.upper.applyAxisAngle(fitAxis, a);
  arm.fore.applyAxisAngle(fitAxis, a);
}

/** Casters who hold their weapons out like a fighter, on guard (their designs): Grandma Ironknit's needles. */
const DUELLISTS = new Set(['Grandma Ironknit']);
/** How far a long held-up item that reaches well below the hand is tipped out from the body (rad): clear of a robe. */
const CLEAR_ROBE = 0.3;

/** How much of the idle's crouch a hero keeps on the Heroes stand (`atEase`). */
const AT_EASE = 0.35;
const fitReach = new THREE.Vector3(), fitKnee = new THREE.Vector3();

/**
 * Fits a clip's leg to a hero's own legs. The clips' figure has a long thigh and a short shin; our heroes' are about equal,
 * so the clip's thigh and shin directions copied as they are put the foot well behind the hip, with the knee jutting
 * forward (legs that look folded under the hero on the Heroes stand). Instead the foot goes where the clip puts it from
 * the hip (in leg lengths, as far in from rest as the clip's), and the knee bends as much as this hero's thigh and shin
 * need for that, the way the clip's knee points. `part` is the thigh's share of the hero's leg; `crouch` below 1 takes
 * the foot in from rest only that much of the way (the hips must then drop as much less: `replay`). Used for standing,
 * walking and running; attacks and casts keep the clip's own legs.
 */
function fitLeg(leg: { thigh: THREE.Vector3; shin: THREE.Vector3 }, part: number, fig: ClipFigure, crouch = 1) {
  const kt = fig.thigh / (fig.thigh + fig.shin);
  const reach = fitReach.copy(leg.thigh).multiplyScalar(kt).addScaledVector(leg.shin, 1 - kt);
  const d0 = reach.length();
  if (d0 < 1e-4) return;
  reach.divideScalar(d0);
  const a = part, b = 1 - part;
  const d = Math.max(Math.abs(a - b) + 0.02, Math.min(0.9995, 1 - (1 - d0 / fig.restReach) * crouch));
  const cos = Math.min(1, (a * a + d * d - b * b) / (2 * a * d)), sin = Math.sqrt(1 - cos * cos);
  // The knee goes the way the clip's does: its thigh away from the hip-to-ankle line (forward when that is too small to read).
  const knee = fitKnee.copy(leg.thigh).addScaledVector(reach, -leg.thigh.dot(reach));
  if (knee.lengthSq() < 1e-6) knee.set(0, 0, 1).addScaledVector(reach, -reach.z);
  knee.normalize();
  leg.thigh.copy(reach).multiplyScalar(cos).addScaledVector(knee, sin);
  leg.shin.copy(reach).multiplyScalar(d).addScaledVector(leg.thigh, -a).normalize();
}
/**
 * How much of the pack's fist guard a bare-handed fighter stands in, over the plain stand. The guard was drawn for a
 * figure with short arms and legs: all of it on a tall hero is a deep lunge with the arms held wide.
 */
const FIST_GUARD = 0.6;

/** Where the second hand grips, along the weapon from the first: lower on a long haft, toward a hammer's head, by a sword's pommel. */
const gripAlong = (held: Held, hold: Hold) =>
  held.back >= 0.2 ? -Math.min(0.3, held.back - 0.05) : hold === 'hang' && held.len < 0.9 ? Math.min(0.22, held.len * 0.35) : -0.1;

/** How far a held-up item tips (radians, forward positive) on a cast's wind-up and on its strike, per style. */
const CAST_TIP: Record<CastStyle, [number, number]> = {
  thrust: [-0.3, 0.9], point: [-0.1, 0.9], slam: [-0.4, 0.8], burst: [0, 0], raise: [0, -0.1], lunge: [-0.3, 1.1], swing: [-0.7, 1.3], channel: [0, 0.8],
};
/** Styles that move both arms: an item in either hand tips with them. */
const BOTH_ARMS: Partial<Record<CastStyle, true>> = { slam: true, burst: true, raise: true, channel: true };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
/** Exponential approach factor for a rate per second. */
const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

/** A bump of 1 at phase 0 (wrapped round the cycle), falling to 0 at ±`hw` radians. */
const pulse = (x: number, hw: number) => {
  const a = Math.atan2(Math.sin(x), Math.cos(x));
  return Math.abs(a) < hw ? Math.cos((a / hw) * Math.PI / 2) ** 2 : 0;
};

/** A damped pendulum per sway chain: pitch (swings forward / back) and roll (side to side). */
interface Spring { p: number; r: number; vp: number; vr: number }

/** How fast the drawn body turns to the walker's facing (per second: about 0.08 s for 90% of a turn). */
const TURN_RATE = 30;

/** Figures painted so pale that the game's bloom turns them into a white glow: drawn darker. */
const MODEL_SHADE: Record<string, number> = { 'models/heroes/ink.glb': 0.62 };

/** A boss's own body has no bones to pose: it has a look instead. */
interface BodyNow {
  look: BodyLook;
  phase: number;
  /** It has enraged: its body glows red. */
  rage: boolean;
}

/**
 * A hero's rigged figure standing in for a capsule figure (the player's caster in hero mode, the opponent in a duel).
 * `setModel(url, at, kit)` swaps the model (cached per url); `follow(...)` every frame places it and poses it,
 * procedurally on the shared rig: breathing, weight shift and fidgets at rest, a speed-scaled walk-to-jog (rolling
 * feet, hip and chest counter-turn, arms swinging with the elbows following through, a level head, momentum on starts
 * and stops; robed heroes take shorter steps), the basic attack's swing, a wind-up / strike / settle per cast style
 * (`cast`), a flinch and a tinted flash when hit (`hit`), slumps and flails under stun and knock-up, a frozen pose
 * in an ice block, and spring-driven hair, sashes and robe tails. `fall` crumples it. Add `group` to the scene.
 * Heavy heroes (high HP) plant wider and sway their chest more; fast ones lean in and run with bent arms; hammer and
 * greatsword heroes swing overhead with both hands.
 */
export class HeroFigure {
  /** The current model has loaded (true when there is none: the capsule stands in). */
  get loaded() {
    return this.real ? this.real.loaded : !this.figure || this.figure.loaded;
  }

  /** Models of the fourth style (a realistic body on the animation pack's own skeleton: `motion/real.ts`), by url. */
  private reals = new Map<string, RealHero>();
  /** The one shown now, if the current model is of that style (`figure` is then null). */
  private real: RealHero | null = null;
  /** Seconds since the last hit, for its flinch clip. */
  private realFlinch = 9;
  private realLayers: Layer[] = [];

  readonly group = new THREE.Group();
  private figures = new Map<string, Hero>();
  private figure: Hero | null = null;
  private heavy = 0;
  private agile = 0;
  private melee = false;
  /** A two-handed overhead attack (hammer, greatsword) instead of alternating slashes. */
  private overhead = false;
  /** The basic attack's look (`Trait.attack.look`): it picks the weapon's strike. */
  private attackLook = '';
  private clock = 0;
  // Motion read from the position (smoothed: a network figure moves in steps).
  private last = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private fwd = 0;
  private side = 0;
  private accF = 0;
  private accS = 0;
  private lastYaw = 0;
  private yawRate = 0;
  /** The facing the body shows: it follows the walker's facing at `TURN_RATE`. */
  private shownYaw = NaN;
  private moving = false;
  private walk = 0;
  private walkPhase = 0;
  private run = 0;
  private dirF = 1;
  private dirS = 0;
  private rock = 0;
  private rockV = 0;
  private armMo = 0;
  private armMoV = 0;
  /** The idle fidget playing (-1 none), its start, and when the next one may start. */
  private fidget = -1;
  private fidgetAt = 0;
  private fidgetNext = 3 + Math.random() * 3;
  private fidgetSide = 1;
  // Layers.
  private castNow: { style: CastStyle; t: number; dur: number; big: boolean } | null = null;
  private attackW = 0;
  /** How much the hero is under way, 0 standing .. 1 moving (eased). */
  private gait = 0;
  /** How much of the hero's going is the run clip, 0 the walk .. 1 the run (eased). */
  private jog = 0;
  /** Where the clips of this frame have put the hips from where they rest (the figure's frame, leg lengths). */
  private hipsOff = new THREE.Vector3();
  private share: Share = { body: 0, armR: 0, armL: 0, legs: 1 };
  /** Standing on the Heroes stand: the plain idle with a shallower crouch, no fist guard (`HeroPreview`). */
  atEase = false;
  /** A caster who holds her weapons out like a fighter (`DUELLISTS`). */
  private duellist = false;

  /**
   * A heavy weapon (a smash or a cleave) in the main hand with the other hand free is carried and swung in both hands.
   * Not a long axe held low by its end (Hank), and on the Heroes stand not one that hangs (Brannoc's hammer, Oblivion's
   * greatsword: their designs have them hang from the right hand).
   */
  private twoHanded(main: Hold, other: Hold) {
    return this.overhead && main !== 'none' && main !== 'low' && other === 'none' && !(this.atEase && main === 'hang');
  }
  private hipsFrom = new THREE.Vector3();
  private swingLeft = false;
  private lastWind = -1;
  private lastRelease = 0;
  /** Seconds since this hero's last hit went out (`STRIKE_RECOVER` and more: none under way). */
  private sinceHit = 9;
  /** How long this hero's wind-up takes (seconds), as last seen. */
  private windSec = 0.3;
  private stunW = 0;
  private liftW = 0;
  private rootW = 0;
  private hitA = 0;
  private hitV = 0;
  private push = new THREE.Vector2();
  private flashV = 0;
  private flashTint = new THREE.Color();
  private springs: Spring[] = [];
  private dying = -1;
  private base = new THREE.Vector3();

  /** True while a model is shown. */
  get active() {
    return !!this.figure || !!this.real;
  }

  private body: BodyNow | null = null;
  private bodyParts = new Map<Hero, BodyParts>();
  /** How red an enraged body glows now, easing in. */
  private rageK = 0;
  /** A boss's body actions (`act`) still playing, with where each lands in the world: a move's steps can overlap. */
  private bodyActs: { name: string; step: number; t: number; dur: number; wx: number; wz: number }[] = [];
  private actSpot = new THREE.Vector3();

  /** A boss's body does `name` (step `step` of it), landing at (x, z) after `seconds`. Its look says what that means. */
  act(name: string, step: number, x: number, z: number, seconds: number) {
    this.bodyActs.push({ name, step, t: 0, dur: Math.max(0.2, seconds), wx: x, wz: z });
    if (this.bodyActs.length > 8) this.bodyActs.shift();
  }

  /** Which phase of its fight a boss's body shows. */
  setBodyPhase(phase: number) {
    if (this.body) this.body.phase = phase;
  }

  /** A boss's body glows red, throbbing: it has enraged. */
  setBodyRage(on: boolean) {
    if (this.body) this.body.rage = on;
  }

  /** Poses a boss's body in place of a hero's walk, flinch and cast. */
  private poseBody(f: Hero, body: BodyNow, dt: number, pos: THREE.Vector3, state: FigureState) {
    this.hitV += (-150 * this.hitA - 15 * this.hitV) * dt;
    this.hitA += this.hitV * dt;
    // A boss strikes at the end of its cast (when its zone lands), then holds and settles: half a second more.
    if (this.castNow && (this.castNow.t += dt) > this.castNow.dur + 0.5) this.castNow = null;
    // An action holds a moment where it landed, then comes back: about 1.2 s after landing it is over.
    for (const a of this.bodyActs) a.t += dt;
    this.bodyActs = this.bodyActs.filter((a) => a.t <= a.dur + 1.2);
    f.root.position.set(pos.x, pos.y, pos.z);
    if (!f.loaded) return;
    const acts: BodyAct[] = [];
    if (this.bodyActs.length) f.root.updateMatrixWorld();
    for (const a of this.bodyActs) {
      const at = f.root.worldToLocal(this.actSpot.set(a.wx, 0, a.wz));
      acts.push({ name: a.name, step: a.step, t: a.t, dur: a.dur, x: at.x, z: at.z, wx: a.wx, wz: a.wz, bx: pos.x, bz: pos.z, yaw: this.shownYaw });
    }
    const act = acts[acts.length - 1] ?? null;
    let parts = this.bodyParts.get(f);
    if (!parts) this.bodyParts.set(f, (parts = new BodyParts(f.root)));
    parts.reset();
    body.look({
      dt, time: this.clock, fwd: this.fwd, side: this.side, speed: this.vel.length(), moving: this.moving, cast: this.castNow,
      hit: this.hitA, kneeling: !!state.status?.stunned, phase: body.phase, fall: this.dying, act, acts,
    }, parts);
    this.rageK += ((body.rage ? 1 : 0) - this.rageK) * Math.min(1, dt * 1.5);
    parts.rage(this.rageK * (0.75 + 0.25 * Math.sin(this.clock * 5)));
  }

  /** Shows the model at `url` (undefined hides the figure), styled after `kit`. Returns whether one is shown. */
  setModel(url: string | undefined, at?: THREE.Vector3, kit?: HeroKit) {
    for (const f of this.figures.values()) f.root.visible = false;
    for (const r of this.reals.values()) r.root.visible = false;
    this.real = null;
    if (kit?.look !== this.body?.look) this.body = kit?.look ? { look: kit.look, phase: this.body?.phase ?? 0, rage: this.body?.rage ?? false } : null;
    this.shownYaw = NaN;
    this.figure = null;
    if (url && isRealModel(url)) {
      let r = this.reals.get(url);
      if (!r) {
        r = new RealHero(url);
        this.reals.set(url, r);
        this.group.add(r.root);
      }
      r.root.visible = true;
      this.real = r;
    } else if (url) {
      let f = this.figures.get(url);
      if (!f) {
        f = new Hero({ url, shade: MODEL_SHADE[url] ?? 0.9, maxEmissive: 1, tintSheen: true });
        this.figures.set(url, f);
        this.group.add(f.root);
      }
      f.root.visible = true;
      this.figure = f;
    }
    if (kit) {
      const trait = traitFor(kit.name);
      this.heavy = Math.min(1, Math.max(0, ((kit.maxHp ?? 600) - 600) / 180));
      this.agile = Math.min(1, Math.max(0, ((trait?.speed ?? 4) - 4.1) / 0.5));
      // A kit's own attack (each of the twins has one) goes before the trait's.
      const attack = kit.attack ?? trait?.attack;
      this.melee = attack?.kind === 'melee';
      this.overhead = this.melee && (attack?.look === 'smash' || attack?.look === 'cleave');
      this.attackLook = attack?.look ?? '';
      this.duellist = DUELLISTS.has(kit.name);
    }
    if (at) this.last.copy(at);
    this.reset();
    return !!this.figure || !!this.real;
  }

  /** Draws the current model this many times a hero's size (a boss). `setModel` keeps each model's own size. */
  setScale(scale: number) {
    this.figure?.root.scale.setScalar((this.body ? 1 : HERO_SCALE) * scale);
    this.real?.root.scale.setScalar(HERO_SCALE * scale);
  }

  /** Starts loading the model at `url` without showing it, so a later `setModel` shows it at once (Pim and Pom's tag). */
  preload(url: string) {
    if (isRealModel(url)) {
      if (this.reals.has(url)) return;
      const r = new RealHero(url);
      r.root.visible = false;
      this.reals.set(url, r);
      this.group.add(r.root);
      return;
    }
    if (this.figures.has(url)) return;
    const f = new Hero({ url, shade: MODEL_SHADE[url] ?? 0.9, maxEmissive: 1, tintSheen: true });
    f.root.visible = false;
    this.figures.set(url, f);
    this.group.add(f.root);
  }

  /** A spell was cast: plays `style`'s wind-up and strike over `seconds` (the cast's own root). */
  cast(style: CastStyle, seconds: number, big = false) {
    // A hero's cast is quick whatever its spell says; a boss's runs the whole cast, so its strike comes when its zone lands.
    this.castNow = { style, t: 0, dur: Math.max(0.35, this.body ? seconds : Math.min(seconds, 2.5)), big };
  }

  /** How veiled the figure should look, 0..1 (`Trait.figureVeil`), easing there. Asked every frame. */
  setVeil(target: number) {
    this.veilNow += (target - this.veilNow) * 0.14;
    if (Math.abs(target - this.veilNow) < 0.01) this.veilNow = target;
    this.figure?.setVeil(this.veilNow);
    this.real?.setVeil(this.veilNow);
  }
  private veilNow = 0;

  /** How much of what stands behind the figure should show through, 0..1, easing there. Asked every frame. */
  setFade(target: number) {
    this.fadeNow += (target - this.fadeNow) * 0.14;
    if (Math.abs(target - this.fadeNow) < 0.01) this.fadeNow = target;
    this.figure?.setFade(this.fadeNow);
    this.real?.setFade(this.fadeNow);
  }
  private fadeNow = 0;

  /** The model shown now (an outline goes round it), if any. */
  get shown(): THREE.Object3D | null {
    return this.figure?.root ?? this.real?.root ?? null;
  }

  /** A hit landed on this hero: a flinch away from `from` and a flash in `tint`; `strength` 0..1. */
  hit(strength: number, tint?: THREE.ColorRepresentation, from?: THREE.Vector3) {
    const s = Math.min(1, Math.max(0, strength));
    this.flashV = Math.max(this.flashV, 0.4 + 0.6 * s);
    this.flashTint.set(tint ?? '#ff8a4a');
    this.realFlinch = 0;
    const f = this.figure;
    if (!f) return;
    let dx = 0, dz = -1;
    if (from) {
      dx = this.last.x - from.x;
      dz = this.last.z - from.z;
      const l = Math.hypot(dx, dz);
      if (l > 1e-3) { dx /= l; dz /= l; } else { dx = 0; dz = -1; }
    }
    // The push in the figure's own frame: forward and left.
    const yaw = f.root.rotation.y, sy = Math.sin(yaw), cy = Math.cos(yaw);
    this.push.set(dx * cy - dz * sy, dx * sy + dz * cy);
    this.hitV += 7 + 9 * s;
    for (const sp of this.springs) { sp.vp += this.push.y * 4 * s; sp.vr -= this.push.x * 4 * s; }
  }

  /** Places the figure at `pos` facing `yaw` and poses it for this frame. */
  follow(dt: number, pos: THREE.Vector3, yaw: number, state: FigureState = {}) {
    if (this.real) return this.followReal(this.real, dt, pos, yaw, state);
    const f = this.figure;
    if (!f) return;
    this.base.copy(pos);
    // A paused frame (dt 0) only places the figure: the motion estimate divides by dt.
    if (!(dt > 1e-5)) {
      if (this.dying < 0) f.root.position.set(pos.x, f.root.position.y, pos.z);
      return;
    }
    dt = Math.min(dt, 0.05);
    this.clock += dt;
    // Walking starts at once; the body turns very fast but not in one frame, as in League. Only the look: the game
    // reads the facing from the walker.
    if (Number.isNaN(this.shownYaw)) this.shownYaw = yaw;
    else this.shownYaw += Math.atan2(Math.sin(yaw - this.shownYaw), Math.cos(yaw - this.shownYaw)) * ease(dt, TURN_RATE);
    this.track(dt, pos, this.shownYaw);
    f.root.rotation.y = this.shownYaw;
    this.flashV = Math.max(0, this.flashV - dt * 3.2);
    f.setFlash(this.flashV, this.flashTint);
    if (this.body) {
      this.poseBody(f, this.body, dt, pos, state);
      return;
    }
    if (this.dying >= 0) {
      this.applyDeath(f);
      return;
    }
    if (state.held) {
      // Frozen solid: the last pose stays, nothing breathes. The cast that froze it runs out unseen, and hits on the ice
      // leave no flinch to snap out at the thaw.
      f.root.position.set(pos.x, pos.y, pos.z);
      if (this.castNow && (this.castNow.t += dt) > this.castNow.dur + 0.3) this.castNow = null;
      this.hitA = this.hitV = 0;
      return;
    }
    const st = state.status;
    const lifted = (st?.lift ?? 0) > 0;
    const stunned = !!st?.stunned && !lifted;
    const rooted = !!st?.cannotMove && !st.stunned;
    this.stunW += ((stunned ? 1 : 0) - this.stunW) * ease(dt, 10);
    this.liftW += ((lifted ? 1 : 0) - this.liftW) * ease(dt, 12);
    this.rootW += ((rooted ? 1 : 0) - this.rootW) * ease(dt, 10);
    // Hit flinch: a stiff damped spring kicked by `hit`.
    this.hitV += (-150 * this.hitA - 15 * this.hitV) * dt;
    this.hitA += this.hitV * dt;

    // Walk: stride rate and size follow the real speed; turning on the spot shuffles the feet. `run` blends a walk
    // (slowed) into a jog (full speed): longer strides, higher knees, pumping arms, more lean.
    const speed = this.vel.length();
    const shuffle = this.moving ? 0 : Math.min(0.3, Math.abs(this.yawRate) * 0.1);
    this.walk += ((this.moving ? Math.min(1.15, Math.max(0.45, speed / 4)) : shuffle) - this.walk) * ease(dt, 8);
    this.run += (smooth(2.2, 4.6, speed) * (this.moving ? 1 : 0) - this.run) * ease(dt, 5);
    // The walk and the run clips each carry a body at their own speed (in its leg lengths): the two are mixed (`jog`) so
    // that the mix goes at this hero's speed on this hero's legs, and played at their own pace (a little faster or
    // slower only past either end), so the feet slide as little as a mix of a stroll and a sprint allows. Turning on the
    // spot keeps its own shuffle.
    const gw = gaitInfo(WALK), gr = gaitInfo(RUN);
    const legSpeed = speed / Math.max(0.2, f.legLength * f.root.scale.y);
    this.jog += (Math.min(1, Math.max(0, (legSpeed - gw.speed) / (gr.speed - gw.speed))) - this.jog) * ease(dt, 5);
    const pace = 2 * Math.PI * (1 / gw.dur + (1 / gr.dur - 1 / gw.dur) * this.jog);
    const hurry = Math.min(1.5, Math.max(0.6, legSpeed / (gw.speed + (gr.speed - gw.speed) * this.jog)));
    this.walkPhase += dt * (this.moving ? pace * hurry : this.walk > 0.02 ? (4.4 + 1.15 * shuffle * 8) * (1 - 0.15 * this.heavy) : 0);
    // Which way the legs reach, in the figure's frame (forward, left): a backpedal or a side-step.
    const dk = ease(dt, 6), mv = speed > 0.4;
    this.dirF += ((mv ? this.fwd / speed : 1) - this.dirF) * dk;
    this.dirS += ((mv ? this.side / speed : 0) - this.dirS) * dk;
    const w = this.walk, run = this.run, ph = this.walkPhase, s = Math.sin(ph), c = Math.cos(ph);
    // Standing and going forward are the animator's clips; a backpedal and a side-step, which the pack does not have, are
    // the walk built here.
    this.gait += ((this.moving ? 1 : 0) - this.gait) * ease(dt, 8);
    const going = this.gait * smooth(0.2, 0.7, this.dirF);
    // Lowest just after each foot lands, highest as the body passes over the planted foot.
    const bob = (0.035 + 0.035 * run + 0.02 * this.heavy) * w * Math.cos(2 * (ph - 0.25)) * (1 - going);
    // Momentum springs: the chest rocks when the hero starts or stops, and on a stop the arms swing on through.
    const sk = 85, sd = 8;
    // Pushing off and pulling up both pitch the chest forward (a stop overshoots, then settles back).
    this.rockV += (-sk * (this.rock - clamp(Math.abs(this.accF) * (this.accF > 0 ? 0.016 : 0.022), 0.25)) - sd * this.rockV) * dt;
    this.rock += this.rockV * dt;
    this.armMoV += (-sk * (this.armMo - clamp(Math.min(0, this.accF) * 0.035, 0.6)) - sd * this.armMoV) * dt;
    this.armMo += this.armMoV * dt;

    // What the hands hold: it decides which arm casts and strikes, how much each arm swings, and how the item is carried.
    const holdR = holdOf(f.held.R), holdL = holdOf(f.held.L);
    // The weapon hand is the right one unless only the left holds something.
    const lefty = holdR === 'none' && holdL !== 'none';
    const mainHold = lefty ? holdL : holdR;
    let tipR = 0, tipL = 0;
    /** The clip to replay this frame, if any: which, where in it (seconds), how much of the pose is its own, mirrored or not. */
    let play: { clip: ClipName; t: number; w: number; mirror: boolean; loop: boolean } | null = null;
    let enter: THREE.Vector3 | undefined;

    // Cast timeline: wind-up ramps in, the strike snaps over 0.08 s with a little overshoot, then settles out.
    let castW = 0, antic = 0, strike = 0, over = 0, crouch = 0;
    let pose: (typeof CAST)[CastStyle] | null = null;
    const cn = this.castNow;
    if (cn) {
      cn.t += dt;
      const a = Math.min(0.24, cn.dur * 0.35) * (cn.big ? 1.3 : 1);
      castW = cn.t < cn.dur ? 1 : 1 - (cn.t - cn.dur) / 0.3;
      if (castW <= 0) this.castNow = null;
      else {
        pose = (lefty ? CAST_L : CAST)[cn.style];
        antic = smooth(0, a, cn.t);
        strike = Math.min(1, Math.max(0, (cn.t - a) / 0.08));
        over = strike >= 1 ? 0.22 * Math.exp(-(cn.t - a - 0.08) * 7) : 0;
        crouch = pose.crouch * (cn.big ? 1.3 : 1) * castW * Math.max(antic * 0.6, strike);
      }
    }
    // How far a cast has taken the arms from the way they carry things: nothing at its first frame, all of it by the wind-up's end.
    const castTook = castW * Math.max(antic, strike);
    const m = state.attack;
    // A hit has just gone out: the wind-up ended in a release, or a release came with no wind-up (the other player's attack).
    const rel = m?.release ?? 0;
    if (m && rel > 0 && (rel > this.lastRelease + 0.2 || (this.lastWind >= 0 && m.wind < 0))) this.sinceHit = 0;
    else this.sinceHit += dt;
    this.lastRelease = rel;
    const recovering = !!m && this.sinceHit < STRIKE_RECOVER;
    const swinging = !!m && (m.wind >= 0 || m.release > 0 || recovering);
    if (m && m.wind >= 0 && this.lastWind < 0) this.swingLeft = !this.swingLeft;
    // How long this hero's wind-up takes (seconds), read off how fast `wind` climbs.
    if (m && m.wind > this.lastWind && this.lastWind >= 0) this.windSec = Math.min(1, Math.max(0.1, dt / (m.wind - this.lastWind)));
    this.lastWind = m?.wind ?? -1;
    this.attackW += ((swinging ? 1 : 0) - this.attackW) * ease(dt, 18);
    const busy = Math.max(castW, this.attackW, this.stunW, this.liftW);

    f.root.position.set(pos.x, pos.y + bob - crouch - 0.06 * this.stunW, pos.z);
    this.hipsOff.set(0, 0, 0);
    f.resetPose();

    // Rest: breath, the weight on one leg (the other knee eases), a slow look round and now and then a fidget; melee
    // heroes keep their guard up, heavy ones plant wide and breathe slow, agile ones stay light on their toes.
    const t = this.clock, rest = (1 - 0.75 * w) * (1 - busy), still = (1 - Math.min(1, w * 3)) * (1 - busy);
    const breath = Math.sin(t * (1.9 - 0.4 * this.heavy)), shift = Math.sin(t * 0.55);
    const hop = 0.6 * this.agile * still * Math.abs(Math.sin(t * 3.2));
    f.root.position.y += (0.006 * (1 + this.heavy) * breath + 0.014 * hop) * still;
    f.rot('pelvis', AZ, 0.045 * shift * rest);
    f.rot('chest', AX, (0.03 + 0.015 * this.heavy) * breath + 0.06 * this.heavy);
    f.rot('chest', AZ, -0.035 * shift * rest);
    f.rot('head', AY, (0.14 * Math.sin(t * 0.37) + 0.05 * Math.sin(t * 1.13)) * rest);
    f.rot('head', AX, (0.03 * Math.sin(t * 0.71) - 0.015 * breath) * rest);
    f.rot('armL', AZ, (0.05 + 0.02 * breath) * (1 - busy));
    f.rot('armR', AZ, (-0.05 - 0.02 * breath) * (1 - busy));
    if (this.melee) {
      const g = (1 - w * 0.6) * (1 - busy);
      f.rot('armR', AX, -0.3 * g);
      f.rot('foreR', AX, -0.55 * g);
      f.rot('armL', AX, -0.2 * g);
      f.rot('foreL', AX, -0.45 * g);
    }
    f.rot('thighL', AZ, 0.05 * this.heavy);
    f.rot('thighR', AZ, -0.05 * this.heavy);
    const easeL = (Math.max(0, shift) * 0.8 + hop) * still, easeR = (Math.max(0, -shift) * 0.8 + hop) * still;
    f.rot('thighL', AX, -0.07 * easeL);
    f.rot('shinL', AX, 0.16 * easeL);
    f.rot('footL', AX, -0.09 * easeL);
    f.rot('thighR', AX, -0.07 * easeR);
    f.rot('shinR', AX, 0.16 * easeR);
    f.rot('footR', AX, -0.09 * easeR);

    // Walk: the heel lands, the knee takes the weight, the toes push off and the knee lifts through the swing; the hips
    // twist and drop, the chest turns against them and the head stays level; the arms swing against the legs with the
    // elbows following through. Legs reach the way the hero moves (a backpedal, a side-step).
    // A long robe hangs from the thighs and tears open on a long, high-kneed step: robed heroes glide with shorter ones.
    const robe = f.robe, lift = 1 - 0.55 * robe;
    const stride = 0.5 * (1 + 0.25 * this.agile - 0.1 * this.heavy) * (1 + 0.35 * run) * (1 - 0.4 * robe);
    const reachF = stride * this.dirF * w, reachS = 0.5 * stride * this.dirS * w;
    f.rot('pelvis', AY, (0.1 + 0.06 * run) * s * w * this.dirF);
    f.rot('pelvis', AZ, 0.05 * c * w);
    for (const [p, thigh, shin, foot] of [[ph, 'thighL', 'shinL', 'footL'], [ph + Math.PI, 'thighR', 'shinR', 'footR']] as const) {
      const sp = Math.sin(p);
      const knee = w * (0.1 + 0.12 * run + (0.6 + 0.55 * run) * (1 - 0.3 * this.heavy) * lift * Math.max(0, Math.cos(p + 0.2)) ** 1.5
        + (0.14 + 0.1 * run) * lift * pulse(p - Math.PI / 2 - 0.45, 0.5)
        // Under a robe the leading knee stays bent, so the shin hangs inside the hem instead of poking out in front.
        + 0.55 * robe * Math.max(0, sp * this.dirF));
      f.rot(thigh, AX, -reachF * sp);
      // Side-steps: each leg steps out to its own side but never across the other.
      const out = reachS * sp;
      f.rot(thigh, AZ, thigh === 'thighL' ? Math.max(0, out) : Math.min(0, out));
      f.rot(shin, AX, knee);
      // Keep the sole near flat, then toes down at push-off and up at the heel strike.
      f.rot(foot, AX, (reachF * sp - knee) * 0.75 + w * lift * (0.5 * pulse(p + Math.PI / 2 - 0.35, 0.6) - 0.28 * pulse(p - Math.PI / 2 + 0.1, 0.4)));
    }
    const twist = -(0.12 + 0.08 * this.heavy + 0.06 * run) * s * w * this.dirF;
    const lean = (0.05 + 0.12 * run + 0.12 * this.agile) * w * Math.max(0, this.dirF) + this.rock;
    f.rot('chest', AY, twist);
    f.rot('chest', AX, lean - 0.035 * (0.5 + run) * w * Math.cos(2 * (ph - 0.25)));
    f.rot('chest', AZ, clamp(-this.yawRate * 0.05 * w, 0.22) - 0.03 * c * w);
    f.rot('head', AY, -0.6 * twist);
    f.rot('head', AX, -0.5 * lean + 0.025 * w * Math.cos(2 * ph));
    // The acting arm leaves the walk's swing to the cast or the attack; an arm that carries something swings less.
    const freeMain = 1 - Math.max(castW, this.attackW), freeOff = 1 - busy * 0.5;
    const armFree = (lefty ? freeOff : freeMain) * CARRY[holdR], freeL = (lefty ? freeMain : freeOff) * CARRY[holdL];
    const pa = ph - 0.25, sa = Math.sin(pa), swingA = (0.5 + 0.3 * run + 0.1 * this.agile) * w;
    const bend = Math.min(1.35, (0.12 + 0.45 * run + 0.6 * this.agile) * w), mo = this.armMo * (1 - busy);
    f.rot('armL', AX, (swingA * sa + mo) * freeL);
    f.rot('armR', AX, (-swingA * sa + mo) * armFree);
    f.rot('armL', AZ, 0.08 * run * w * freeL);
    f.rot('armR', AZ, -0.08 * run * w * armFree);
    f.rot('foreL', AX, -(bend + 0.35 * w * Math.max(0, -Math.sin(pa - 0.5)) + 0.4 * Math.max(0, -mo)) * freeL);
    f.rot('foreR', AX, -(bend + 0.35 * w * Math.max(0, Math.sin(pa - 0.5)) + 0.4 * Math.max(0, -mo)) * armFree);
    f.rot('handL', AX, 0.18 * w * Math.sin(pa - 1.1) * freeL);
    f.rot('handR', AX, -0.05 * w * Math.sin(pa - 1.1) * armFree);

    // Standing and moving, from the clips: a stance by what the hands hold, then the walk and the run over it by how
    // fast the hero goes. An arm with a staff in its hand keeps the walking-staff carry (`carry`); a two-handed weapon
    // stays across the body while the legs walk. A hand-posed cast or a knock-up takes the arms back.
    const two = this.twoHanded(mainHold, lefty ? holdR : holdL);
    const bare = mainHold === 'none' || holdR === holdL || (mainHold === 'hang' && !two);
    const guard = !two && this.melee && bare;
    // On the Heroes stand (`atEase`) every hero stands in the plain idle, its crouch shallower; a two-handed weapon keeps
    // its idle's arms only, and there is no fist guard.
    const stance: ClipName = two && !this.atEase ? 'Melee_2H_Idle' : STAND;
    const calm = 1 - Math.max(cn && !CAST_CLIP[cn.style] ? castTook : 0, this.liftW);
    const armR = (!carried(holdR) || two ? 1 : 0) * calm, armL = (!carried(holdL) || two ? 1 : 0) * calm;
    const sh = this.share, standing = 1 - this.gait;
    sh.body = standing; sh.armR = (two ? 1 : standing) * armR; sh.armL = (two ? 1 : standing) * armL; sh.legs = 1;
    sh.fit = this.atEase ? AT_EASE : 1;
    this.replay(f, stance, t, sh, lefty, true, holdR, holdL, lefty);
    if (two && this.atEase) {
      const body = sh.body;
      sh.body = 0;
      this.replay(f, 'Melee_2H_Idle', t, sh, lefty, true, holdR, holdL, lefty);
      sh.body = body;
    }
    sh.fit = 1;
    if (guard && !this.atEase) {
      sh.body *= FIST_GUARD; sh.armR *= FIST_GUARD; sh.armL *= FIST_GUARD;
      this.replay(f, 'Melee_Unarmed_Idle', t, sh, lefty, true, holdR, holdL, lefty);
    }
    if (going > 0.01) {
      // a long robe tears open on a long, high-kneed step: under one the legs swing less
      const legs = 1 - 0.45 * f.robe;
      for (const [clip, g, k] of [[WALK, gw, going], [RUN, gr, going * this.jog]] as const) {
        if (k <= 0.01) continue;
        sh.body = k; sh.armR = two ? 0 : k * armR; sh.armL = two ? 0 : k * armL; sh.legs = legs;
        this.replay(f, clip, g.leftFwd + ((ph - Math.PI / 2) / (2 * Math.PI)) * g.dur, sh, false, true, holdR, holdL, lefty);
      }
    }
    // Attacks and casts keep the clip's own legs (a lunge as the animator made it).
    sh.fit = undefined;
    // What the clips do not know: the chest rocking on a start or a stop and leaning into a turn, the slow look round,
    // the fidgets.
    const clips = standing + going;
    f.rot('chest', AX, this.rock * clips);
    f.rot('chest', AZ, clamp(-this.yawRate * 0.05 * w, 0.22) * clips);
    f.rot('head', AY, (0.14 * Math.sin(t * 0.37) + 0.05 * Math.sin(t * 1.13)) * rest * clips);
    this.fidgets(f, t, still);
    // How much of each arm is still its own way of carrying things (all of it for a staff; else only in a backpedal).
    const ownR = 1 - (two ? 1 : clips) * (!carried(holdR) || two ? 1 : 0), ownL = 1 - (two ? 1 : clips) * (!carried(holdL) || two ? 1 : 0);

    // Basic attack: an animator's clip, fitted to the game's timing. Through the wind-up it runs up to its own hit; after
    // the blow has gone out it runs on while the body recovers.
    if (m && this.attackW > 0.01) {
      const clip = this.attackClip(m.melee, mainHold, lefty ? holdR : holdL);
      const info = clipInfo(clip), tail = Math.min(info.dur - info.hit, CLIP_TAIL);
      const lead = Math.min(info.hit, CLIP_LEAD, this.windSec * CLIP_RUSH);
      const at = m.wind >= 0 ? info.hit - lead * (1 - m.wind) : info.hit + tail * Math.min(1, this.sinceHit / STRIKE_RECOVER);
      // A weapon is swung by the hand that holds it; bare hands and claws take turns.
      const mirror = clip === 'Melee_Unarmed_Attack_Punch_A' ? this.swingLeft : lefty;
      play = { clip, t: at, w: this.attackW, mirror, loop: false };
      // The clip is entered part-way, where its figure has already stepped back for the blow: the hero starts from where
      // it stands instead, and is all the way into the clip's lunge as the hit lands.
      const back = sampleClip(clip, info.hit - lead, this.clipPose, mirror).hips;
      this.hipsFrom.set(back.x, 0, back.z).multiplyScalar(m.wind >= 0 ? 1 - smooth(0, 1, m.wind) : 0);
      enter = this.hipsFrom;
    }

    // The cast: a clip for the styles that have one (it wins over an attack still recovering), else the pose below.
    const castClip = cn && castW > 0 ? CAST_CLIP[cn.style] : undefined;
    if (cn && castClip) {
      const info = clipInfo(castClip.clip), a = Math.min(0.24, cn.dur * 0.35) * (cn.big ? 1.3 : 1);
      // the wind-up runs to the clip's own release; after it the clip plays on at its own speed
      const at = castClip.loop ? cn.t : cn.t < a ? info.hit * (cn.t / a) : Math.min(info.dur, info.hit + (cn.t - a));
      play = { clip: castClip.clip, t: at, w: castW * smooth(0, 0.1, cn.t), mirror: lefty, loop: !!castClip.loop };
      enter = undefined;
    }
    if (pose && castW > 0 && !castClip) {
      const amp = (cn!.big ? 1.18 : 1) * castW;
      const tremble = cn!.style === 'channel' ? 0.04 * Math.sin(t * 38) * strike : 0;
      // An arm with a tall staff in its hand reaches less far: the staff's head tips at the target instead.
      const reach = (b: BoneName) => ((b === 'armR' || b === 'foreR') && holdR === 'staff') || ((b === 'armL' || b === 'foreL') && holdL === 'staff') ? 0.65 : 1;
      for (const [b, ax, v] of pose.antic) f.rot(b, ax, v * antic * (1 - strike) * amp * reach(b));
      for (const [b, ax, v] of pose.strike) f.rot(b, ax, (v * (1 + over) + (b.startsWith('arm') ? tremble : 0)) * strike * amp * reach(b));
      const [tipA, tipS] = CAST_TIP[cn!.style];
      const tip = (tipA * antic * (1 - strike) + tipS * strike) * castW, both = !!BOTH_ARMS[cn!.style];
      if (both || !lefty) tipR += tip * (holdR === 'staff' ? 0.55 : 1);
      if (both || lefty) tipL += tip * (holdL === 'staff' ? 0.55 : 1);
    }

    // Stun: slumped, head lolling; knock-up: arms and legs flailing; root: tugging at the ground.
    if (this.stunW > 0.01) {
      const k = this.stunW;
      f.rot('chest', AX, 0.35 * k);
      f.rot('neck', AX, 0.2 * k);
      f.rot('head', AX, 0.25 * k);
      f.rot('head', AZ, 0.18 * Math.sin(t * 4) * k);
      f.rot('head', AY, 0.15 * Math.cos(t * 4) * k);
      f.rot('thighL', AX, -0.15 * k);
      f.rot('thighR', AX, -0.15 * k);
      f.rot('shinL', AX, 0.3 * k);
      f.rot('shinR', AX, 0.3 * k);
    }
    if (this.liftW > 0.01) {
      const k = this.liftW, fl = Math.sin(t * 12);
      f.rot('chest', AX, -0.2 * k);
      f.rot('armL', AZ, (1.0 + 0.4 * fl) * k);
      f.rot('armR', AZ, -(1.0 + 0.4 * Math.sin(t * 12 + 1)) * k);
      f.rot('armL', AX, -0.6 * k);
      f.rot('armR', AX, -0.6 * k);
      f.rot('thighL', AX, -0.6 * k);
      f.rot('thighR', AX, -0.3 * k);
      f.rot('shinL', AX, 1.0 * k);
      f.rot('shinR', AX, 0.8 * k);
    }
    if (this.rootW > 0.01) {
      const k = this.rootW * (1 - castW), tug = Math.sin(t * 7);
      f.rot('pelvis', AY, 0.1 * Math.sin(t * 7 + 1) * k);
      f.rot('chest', AY, 0.2 * tug * k);
      f.rot('chest', AX, 0.12 * k);
      f.rot('armL', AX, 0.3 * tug * k);
      f.rot('armR', AX, -0.3 * tug * k);
    }

    // Flinch: lean with the push, arms thrown up a little.
    if (Math.abs(this.hitA) > 1e-3) {
      const h = this.hitA;
      f.rot('chest', AX, 0.35 * h * this.push.y);
      f.rot('chest', AZ, -0.35 * h * this.push.x);
      f.rot('head', AX, 0.25 * h * this.push.y);
      f.rot('armL', AX, -0.25 * Math.abs(h));
      f.rot('armR', AX, -0.25 * Math.abs(h));
    }

    this.carry(f, holdR, holdL, tipR, tipL, 1 - Math.max(castClip ? 0 : castTook, this.liftW), w, ph, lefty, ownR, ownL);
    if (play) {
      sh.body = sh.armR = sh.armL = play.w * (1 - this.liftW); sh.legs = 1; sh.grip = calm;
      // already walking off: the legs are the walk's
      sh.stand = 1 - this.gait; sh.from = enter;
      this.replay(f, play.clip, play.t, sh, play.mirror, play.loop, holdR, holdL, lefty);
      sh.grip = sh.stand = sh.from = undefined;
    }
    this.played = play;
    this.going = going;
    // the hips' place from the clips, in this figure's own leg lengths, turned to the way it faces
    const hk = f.legLength * f.root.scale.y, hy = f.root.rotation.y, hs = Math.sin(hy), hc = Math.cos(hy), ho = this.hipsOff;
    f.root.position.x += (ho.x * hc + ho.z * hs) * hk;
    f.root.position.y += ho.y * hk;
    f.root.position.z += (-ho.x * hs + ho.z * hc) * hk;

    // Last: no forearm or hand inside the body (a robe, a skirt, a round belly), as the clips' slim figure never had one.
    this.clearBody(f, (1 - Math.max(castW, this.attackW, this.liftW, this.stunW)) * (two ? 0 : 1));
    this.swing(f, dt, w);
  }

  private bodyS = new THREE.Vector3();
  private bodyE = new THREE.Vector3();
  private bodyH = new THREE.Vector3();
  private bodyP = new THREE.Vector3();
  private bodyDir = new THREE.Vector3();

  /**
   * Keeps each arm out of the body (docs/knowledge/retargeting-arms.md: the "push the hand out of the body" step of
   * Unreal's spatially aware retargeting, on this hero's own outline instead of capsules). The clips bend the elbows in
   * for a slim figure; on a hero in a flared robe, a skirt or with a round belly the forearm and hand went inside it. Each
   * arm whose forearm or hand is inside `Hero.body` is swung out from the shoulder, upper arm and forearm together, by the
   * least angle that clears it (as much as `weight`: not during an attack or a cast, where the hands go where the blow
   * needs them, nor on a two-handed grip).
   */
  private clearBody(f: Hero, weight: number) {
    const b = f.body;
    if (!b || weight <= 0.01) return;
    for (const side of ['R', 'L'] as const) {
      const upper = f.bone(side === 'R' ? 'armR' : 'armL'), fore = f.bone(side === 'R' ? 'foreR' : 'foreL'), hand = f.bone(side === 'R' ? 'handR' : 'handL');
      if (!upper || !fore || !hand) continue;
      hand.updateWorldMatrix(true, false);
      const S = f.root.worldToLocal(upper.getWorldPosition(this.bodyS));
      const E = f.root.worldToLocal(fore.getWorldPosition(this.bodyE)).sub(S);
      const H = f.root.worldToLocal(hand.getWorldPosition(this.bodyH)).sub(S);
      const out = Math.sign(S.x) || (side === 'R' ? -1 : 1);
      const P = this.bodyP;
      // the middle of the forearm, the wrist and the fingers
      const clear = (a: number) => {
        const c = Math.cos(a * out), s = Math.sin(a * out);
        for (const [k, extra] of [[0.5, 0], [1, 0], [1, 0.08]] as const) {
          P.lerpVectors(E, H, k);
          if (extra) P.addScaledVector(this.bodyDir.copy(H).sub(E).normalize(), extra);
          const x = P.x * c - P.y * s + S.x, y = P.x * s + P.y * c + S.y, z = P.z + S.z;
          if (Math.hypot(x, z) < bodyReach(b, x, y, z) + BODY_MARGIN) return false;
        }
        return true;
      };
      if (clear(0)) continue;
      let a = 0.03;
      while (a < 0.9 && !clear(a)) a += 0.03;
      a *= weight;
      const c = Math.cos(a * out), s = Math.sin(a * out);
      const turn = (v: THREE.Vector3) => v.set(v.x * c - v.y * s, v.x * s + v.y * c, v.z);
      const handDir = turn(H.clone().sub(E)).normalize();
      f.pointBone(side === 'R' ? 'armR' : 'armL', side === 'R' ? 'foreR' : 'foreL', turn(E.clone()).normalize(), 1);
      f.pointBone(side === 'R' ? 'foreR' : 'foreL', side === 'R' ? 'handR' : 'handL', handDir, 1);
    }
  }

  /** The clip a hero's basic attack plays: by what it holds and how the attack looks. */
  private attackClip(melee: boolean, main: Hold, other: Hold): ClipName {
    if (!melee) return 'Ranged_Magic_Shoot';
    const look = this.attackLook, two = this.twoHanded(main, other);
    // a long axe held low by its end is swung in one hand
    if (main === 'low') return 'Melee_1H_Attack_Chop';
    // bare hands, two alike (two sets of claws), or something that only hangs from the hand
    if (main === 'none' || main === other || (main === 'hang' && !two && look !== 'sweep')) return 'Melee_Unarmed_Attack_Punch_A';
    if (look === 'smash') return 'Melee_2H_Attack_Chop';
    if (look === 'cleave') return main === 'staff' ? 'Melee_2H_Attack_Chop' : 'Melee_2H_Attack_Slice';
    if (look === 'sweep') return main === 'staff' ? 'Melee_2H_Attack_Slice' : 'Melee_1H_Attack_Slice_Horizontal';
    // one held-up blade: a fencer's stab for the cat, a chop and a diagonal slice in turn for the rest
    if (look === 'claw') return 'Melee_1H_Attack_Stab';
    return this.swingLeft ? 'Melee_1H_Attack_Slice_Diagonal' : 'Melee_1H_Attack_Chop';
  }

  /** The clip replayed in the last frame, if any (for `pipeline/tools/motion-check.js`). */
  played: { clip: ClipName; t: number; w: number; mirror: boolean; loop: boolean } | null = null;
  /** How much of the last frame was the walk and run clips, 0..1 (for the same tool). */
  going = 0;
  private clipPose: ClipPose = newClipPose();
  private clipAim = new THREE.Vector3();

  /**
   * Replays one moment of a clip on the figure, over the pose it has: the hips' place and turn, the chest, the head and
   * the legs by `share.body` 0..1, each arm and where its item points by `share.armR` / `share.armL` (a caster's tall
   * staff only goes part of the way: it tips toward where a wand would point; something that hangs from the hand
   * keeps hanging). `share.legs` below 1 swings the legs less far. A two-handed weapon keeps its second hand on the haft.
   */
  private replay(f: Hero, clip: ClipName, t: number, share: Share, mirror: boolean, loop: boolean, holdR: Hold, holdL: Hold, lefty: boolean) {
    const w = share.body;
    if (w <= 0.001 && share.armR <= 0.001 && share.armL <= 0.001) return;
    const P = sampleClip(clip, t, this.clipPose, mirror, loop), legs = share.legs ?? 1, wl = w * (share.stand ?? 1);
    const fig = clipFigure(clip);
    if (share.from) P.hips.sub(share.from);
    // A shallower crouch lowers the hips less, as much less as the knees bend less (`fitLeg`), so the feet stay down.
    if (share.fit !== undefined && share.fit < 1) P.hips.y *= share.fit;
    this.hipsOff.lerp(P.hips, wl);
    f.turnBone('pelvis', P.qHips, w);
    f.turnBone('chest', P.qChest, w);
    f.turnBone('head', P.qHead, w);
    for (const side of ['L', 'R'] as const) {
      const wa = side === 'R' ? share.armR : share.armL, leg = P.leg[side];
      // standing only: the walk and the run swing the arms wide on purpose (as the animator made them)
      if (share.fit !== undefined && STANDING.has(clip)) fitArm(P.arm[side], f.armOut[side], side, fig);
      f.pointBone(`arm${side}`, `fore${side}`, P.arm[side].upper, wa);
      f.pointBone(`fore${side}`, `hand${side}`, P.arm[side].fore, wa);
      if (legs < 1) {
        leg.thigh.lerp(DOWN, 1 - legs).normalize();
        leg.shin.lerp(DOWN, 1 - legs).normalize();
      }
      if (share.fit !== undefined) fitLeg(leg, f.thighPart, fig, share.fit);
      f.pointBone(`thigh${side}`, `shin${side}`, leg.thigh, wl);
      f.pointBone(`shin${side}`, `foot${side}`, leg.shin, wl);
      f.turnBone(`foot${side}`, leg.foot, wl);
    }
    const main = lefty ? 'L' : 'R', other = lefty ? 'R' : 'L', melee = clip.startsWith('Melee_') && !clip.includes('Unarmed');
    for (const side of [main, other] as const) {
      const hold = side === 'R' ? holdR : holdL, held = f.held[side], wa = side === 'R' ? share.armR : share.armL;
      if (!held || hold === 'none' || wa <= 0.001) continue;
      const two = side === main && this.twoHanded(hold, side === 'R' ? holdL : holdR);
      // what hangs from a hand goes with the arm, unless it is the weapon being swung
      if (hold === 'hang' && !(side === main && melee)) continue;
      const aim = this.clipAim.copy(P.arm[side].aim);
      // a caster's tall staff only tips toward the target; swung as a weapon (a long axe, a halberd) it goes all the way
      if (hold === 'staff' && !melee) aim.lerpVectors(held.dir, aim, 0.6).normalize();
      // a long axe held low keeps its line unless it is being swung
      if (hold === 'low' && !melee) aim.copy(held.dir);
      // Standing, walking and running are clips of a figure with empty hands: their hand points an item level and straight
      // ahead, which is no way to hold one. An item held up stays as modelled for a caster (a scepter, a wand, a mirror),
      // and in a guard for a fighter, its point raised toward the enemy's face (the `up` carry).
      if (hold === 'up' && !two && (STANDING.has(clip) || clip === WALK || clip === RUN)) {
        if (this.melee || this.duellist) aim.set(side === 'R' ? 0.16 : -0.16, 0.74, 0.65).normalize();
        else {
          aim.copy(held.dir);
          // one that reaches well below the hand (Shiori's brush) is tipped out, or its lower end sinks into a robe
          // (out is the side the hand hangs on: some models have their right hand on +x)
          if (held.back > 0.4) aim.applyAxisAngle(fitAxis, Math.sign(f.arm[side]?.hand.x || (side === 'R' ? -1 : 1)) * CLEAR_ROBE);
        }
      }
      f.steadyHand(side, wa, 0, aim);
      if (!two) continue;
      // The second hand goes on the weapon. A clip's two arms meet on its own figure's weapon, not on this one's (other
      // arms, other shoulders, another grip), so: on a haft, the nearest place along it to where the clip has the hand;
      // on a hilt, next to the first hand. Out of the second arm's reach, both hands come in toward its shoulder.
      const at = f.handAt(side, this.carryT), off = f.handAt(other, this.carryAt).sub(at);
      let along = gripAlong(held, hold);
      if (held.back >= 0.2) {
        along = Math.min(held.len * 0.5, Math.max(-(held.back - 0.05), off.dot(aim)));
        if (Math.abs(along) < 0.14) along = along < 0 ? -0.14 : 0.14;
      }
      at.addScaledVector(aim, along);
      const pull = f.shoulderAt(other, this.carryAim).sub(at), far = pull.length(), reach = 0.96 * (f.arm[other]?.length ?? far);
      if (far > reach) {
        pull.multiplyScalar(1 - reach / far);
        f.reachHand(side, f.handAt(side, this.carryAt).add(pull), wa, true);
        f.steadyHand(side, wa, 0, aim);
        at.add(pull);
      }
      f.reachHand(other, at, share.grip ?? wa, true);
    }
  }

  private carryT = new THREE.Vector3();
  private carryAim = new THREE.Vector3();
  private carryAt = new THREE.Vector3();

  /**
   * The hands carry what they hold the way people do (see `Hold`): `free` 0..1 is how much the arms are their own (not
   * taken by a hand-posed cast or a knock-up), `ownR` / `ownL` how much of each is not a clip's. The arms are bent to put each hand in its place, then the hand is turned
   * so the item points where it should, tipped by `tipR` / `tipL` (a hand-posed cast's doing). A clip (`replay`) goes
   * over this.
   */
  private carry(f: Hero, holdR: Hold, holdL: Hold, tipR: number, tipL: number, freeAll: number, w: number, ph: number, lefty: boolean, ownR: number, ownL: number) {
    const main = lefty ? 'L' : 'R', other = lefty ? 'R' : 'L';
    const mainHold = lefty ? holdL : holdR, otherHold = lefty ? holdR : holdL;
    // A hammer, a greatsword, a long axe: the free hand goes on the haft too.
    const both = this.twoHanded(mainHold, otherHold);
    const steady = 1 - this.liftW, T = this.carryT;
    for (const side of [main, other] as const) {
      const hold = side === 'R' ? holdR : holdL, held = f.held[side], arm = f.arm[side];
      // an arm the clips move is theirs: only what is left of it is carried here
      const own = side === 'R' ? ownR : ownL, free = freeAll * own;
      if (!held || !arm || hold === 'none' || free <= 0.001) continue;
      const sx = side === 'R' ? -1 : 1, L = arm.length, two = both && side === main;
      let tip = side === 'R' ? tipR : tipL, aim: THREE.Vector3 | undefined, hang = false;
      T.copy(arm.hand);
      if (hold === 'staff') {
        // Furthest forward as the opposite foot lands; lifted on the way there, on the ground on the way back.
        // (Frames of a man walking with a pole: it leans back as it is planted ahead and forward as he passes it.)
        const p = side === 'R' ? ph : ph + Math.PI;
        T.x += sx * 0.05 * L;
        T.y += held.raise + 0.14 * L * w * Math.max(0, Math.cos(p));
        T.z += (0.3 + 0.3 * w * Math.sin(p)) * L;
        tip -= 0.28 * w * Math.sin(p);
      } else if (hold === 'up' && (this.melee || two)) {
        // A guard: the hilt in front of the hip, the point up and forward at the enemy, a little toward the middle.
        T.x -= sx * (two ? 0.3 : 0.12) * L;
        T.y += (0.36 + 0.03 * w * Math.sin(2 * ph)) * L;
        T.z += 0.42 * L;
        aim = this.carryAim.set(-sx * 0.16, 0.74, 0.65);
        tip *= 0.6;
      } else if (hold === 'up') {
        // Held up in front as modelled (a wand, a mirror, a scepter), the elbow bent.
        T.y += (0.28 + 0.02 * w * Math.sin(2 * ph)) * L;
        T.z += 0.3 * L;
        tip += 0.12;
      } else if (hold === 'low') {
        // Low at the side by the haft's end, the arm a little out and forward, swinging a little with the walk; the
        // weapon keeps its line (as modelled: forward and out, the head a little higher than the hand).
        const p = side === 'R' ? ph : ph + Math.PI;
        T.x += sx * 0.22 * L;
        T.y += 0.1 * L;
        T.z += (0.1 + 0.14 * w * Math.sin(p)) * L;
      } else if (two) {
        // Low in front in both hands, the head down and forward.
        T.set(sx * 0.14 * L, arm.hand.y + 0.14 * L, 0.5 * L);
        aim = this.carryAim.set(-sx * 0.1, -0.74, 0.66);
        hang = true;
      } else continue;
      f.reachHand(side, T, free);
      // A low two-handed weapon goes with the arms when they are not its own; anything held up keeps its line.
      f.steadyHand(side, hang ? free : steady * own, hang ? 0 : tip, aim);
      if (!two) continue;
      const dir = this.carryAt.copy(aim ?? held.dir).normalize().applyAxisAngle(AX, hang ? 0 : tip);
      const at = f.handAt(side, T);
      at.addScaledVector(dir, gripAlong(held, hold));
      f.reachHand(other, at, free);
    }
  }

  /**
   * Standing still, every few seconds the hero fidgets: a look over the shoulder, a shoulder roll, or a shake of one
   * hand (a weapon hand turns its weapon). `still` 0..1 fades it out the moment the hero moves or acts.
   */
  private fidgets(f: Hero, t: number, still: number) {
    if (this.fidget < 0) {
      if (still < 0.95 || t < this.fidgetNext) return;
      this.fidget = Math.floor(Math.random() * 3);
      this.fidgetAt = t;
      this.fidgetSide = Math.random() < 0.5 ? -1 : 1;
    }
    const u = (t - this.fidgetAt) / 1.7;
    if (u >= 1 || still < 0.3) {
      this.fidget = -1;
      this.fidgetNext = t + 4 + Math.random() * 5;
      return;
    }
    const e = Math.sin(Math.PI * u) ** 2 * still, sd = this.fidgetSide;
    if (this.fidget === 0) {
      f.rot('pelvis', AY, 0.06 * sd * e);
      f.rot('chest', AY, 0.22 * sd * e);
      f.rot('head', AY, 0.55 * sd * e);
      f.rot('head', AX, -0.06 * e);
    } else if (this.fidget === 1) {
      const roll = Math.sin(Math.PI * 2 * u);
      f.rot('chest', AX, -0.1 * e);
      f.rot('armL', AZ, (0.12 + 0.08 * roll) * e);
      f.rot('armR', AZ, (-0.12 + 0.08 * roll) * e);
      f.rot('head', AZ, 0.18 * sd * roll * e);
    } else {
      const L = sd > 0;
      f.rot(L ? 'armL' : 'armR', AX, -0.35 * e);
      f.rot(L ? 'foreL' : 'foreR', AX, -0.95 * e);
      f.rot(L ? 'handL' : 'handR', AX, 0.45 * Math.sin(t * 8) * e);
      f.rot('head', AY, (L ? 0.2 : -0.2) * e);
      f.rot('head', AX, 0.12 * e);
    }
  }

  /** Hair, sashes and robe tails: each chain a damped pendulum driven by the figure's acceleration and turns. */
  private swing(f: Hero, dt: number, w: number) {
    const chains = f.sway;
    while (this.springs.length < chains.length) this.springs.push({ p: 0, r: 0, vp: 0, vr: 0 });
    const n = dt > 1 / 50 ? 2 : 1, h = dt / n;
    const biasP = clamp(0.045 * this.fwd, 0.45), biasR = clamp(-0.04 * this.side - 0.08 * this.yawRate, 0.4);
    const bounce = w * Math.sin(2 * this.walkPhase) * 4;
    const breeze = 0.03 * Math.sin(this.clock * 0.9);
    for (let i = 0; i < chains.length; i++) {
      const sp = this.springs[i];
      const k = 55 + (i % 3) * 6, d = 5.5;
      for (let j = 0; j < n; j++) {
        sp.vp += (-k * (sp.p - biasP - breeze) - d * sp.vp + clamp(this.accF * 0.06, 1.2) + bounce) * h;
        sp.vr += (-k * (sp.r - biasR) - d * sp.vr - clamp(this.accS * 0.06, 1.2)) * h;
        sp.p = clamp(sp.p + sp.vp * h, 0.55);
        sp.r = clamp(sp.r + sp.vr * h, 0.55);
      }
      const links = chains[i].links;
      for (let l = 0; l < links.length; l++) {
        const share = l === 0 ? 0.55 : l === 1 ? 0.35 : 0.25;
        f.rotBone(links[l], AX, sp.p * share);
        f.rotBone(links[l], AZ, sp.r * share);
      }
    }
  }

  /** Velocity, acceleration and turn rate in the figure's own frame, smoothed; jumps (respawn, snap) reset them. */
  private track(dt: number, pos: THREE.Vector3, yaw: number) {
    const dx = pos.x - this.last.x, dz = pos.z - this.last.z;
    if (dx * dx + dz * dz > 9) {
      this.vel.set(0, 0, 0);
      this.last.copy(pos);
      this.lastYaw = yaw;
      return;
    }
    const k = ease(dt, 14);
    this.vel.x += (dx / dt - this.vel.x) * k;
    this.vel.z += (dz / dt - this.vel.z) * k;
    this.last.copy(pos);
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const fwd = this.vel.x * sy + this.vel.z * cy, side = this.vel.x * cy - this.vel.z * sy;
    const ka = ease(dt, 8);
    this.accF += (clamp((fwd - this.fwd) / dt, 40) - this.accF) * ka;
    this.accS += (clamp((side - this.side) / dt, 40) - this.accS) * ka;
    this.fwd = fwd;
    this.side = side;
    let dy = yaw - this.lastYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.lastYaw = yaw;
    this.yawRate += (clamp(dy / dt, 12) - this.yawRate) * ease(dt, 10);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.7) this.moving = true;
    else if (speed < 0.3) this.moving = false;
  }

  // ---- heroes of the fourth style: the animation pack's clips, as they are --------------------------------------------

  private poseDeath(r: RealHero) {
    r.root.position.copy(this.base);
    if (r.loaded) r.pose([{ clip: 'Death01', t: Math.min(1, this.dying) * realClipInfo('Death01').dur * 0.92, legs: 1, torso: 1, armR: 1, armL: 1 }]);
  }

  /** The clip a real hero's basic attack plays. */
  private realAttackClip(melee: boolean) {
    if (!melee) return 'Spell_Simple_Shoot';
    if (this.overhead) return 'Sword_Attack';
    return this.swingLeft ? 'Sword_Regular_B' : 'Sword_Regular_A';
  }

  /**
   * `follow` for a hero of the fourth style (`motion/real.ts`). The game says the same things as to the older figures
   * (where it stands, its attack's wind-up and release, its casts, its statuses); here they choose clips of the
   * Universal Animation Library and the moment in each, and nothing is posed by hand. Standing, walking, jogging and
   * sprinting blend by speed on one stride; a blow or a cast takes the arms and chest, and the legs too when the hero
   * stands; a hit, a stun, a knock-up and the fall are clips over that.
   */
  private followReal(r: RealHero, dt: number, pos: THREE.Vector3, yaw: number, state: FigureState) {
    this.base.copy(pos);
    // A paused frame (dt 0) only places the figure: the motion estimate divides by dt.
    if (!(dt > 1e-5)) {
      if (this.dying < 0) r.root.position.set(pos.x, pos.y, pos.z);
      return;
    }
    dt = Math.min(dt, 0.05);
    this.clock += dt;
    if (Number.isNaN(this.shownYaw)) this.shownYaw = yaw;
    else this.shownYaw += Math.atan2(Math.sin(yaw - this.shownYaw), Math.cos(yaw - this.shownYaw)) * ease(dt, TURN_RATE);
    this.track(dt, pos, this.shownYaw);
    r.root.rotation.y = this.shownYaw;
    r.root.position.set(pos.x, pos.y, pos.z);
    this.flashV = Math.max(0, this.flashV - dt * 3.2);
    r.setFlash(this.flashV, this.flashTint);
    if (!r.loaded) return;
    if (this.dying >= 0) return this.poseDeath(r);
    if (state.held) {
      // Frozen solid: the last pose stays.
      if (this.castNow && (this.castNow.t += dt) > this.castNow.dur + 0.3) this.castNow = null;
      return;
    }
    const st = state.status;
    const lifted = (st?.lift ?? 0) > 0, stunned = !!st?.stunned && !lifted;
    this.stunW += ((stunned ? 1 : 0) - this.stunW) * ease(dt, 10);
    this.liftW += ((lifted ? 1 : 0) - this.liftW) * ease(dt, 12);

    // One stride for the walk, the jog and the sprint: which of them, by how fast the hero goes on its own legs.
    const speed = this.vel.length(), legSpeed = speed / Math.max(0.2, r.legLength * r.root.scale.y);
    this.gait += ((this.moving ? 1 : 0) - this.gait) * ease(dt, 8);
    const gw = gaitInfo('Walk_Loop'), gj = gaitInfo('Jog_Fwd_Loop'), gs = gaitInfo('Sprint_Loop');
    const want = legSpeed <= gj.speed ? Math.max(0, (legSpeed - gw.speed) / (gj.speed - gw.speed)) : 1 + Math.min(1, (legSpeed - gj.speed) / (gs.speed - gj.speed));
    this.jog += (want - this.jog) * ease(dt, 5);
    const g = this.jog, wWalk = Math.max(0, 1 - g), wSprint = Math.max(0, g - 1), wJog = 1 - wWalk - wSprint;
    const dur = wWalk * gw.dur + wJog * gj.dur + wSprint * gs.dur, carried = wWalk * gw.speed + wJog * gj.speed + wSprint * gs.speed;
    const hurry = Math.min(1.5, Math.max(0.6, legSpeed / Math.max(0.1, carried)));
    // backing off: the same stride, run backward
    const mv = speed > 0.4;
    this.dirF += ((mv ? this.fwd / speed : 1) - this.dirF) * ease(dt, 6);
    if (this.moving) this.walkPhase += (dt * hurry * (this.dirF < -0.25 ? -1 : 1)) / dur;
    const ph = this.walkPhase;

    const layers = this.realLayers;
    layers.length = 0;
    const all = (clip: string, t: number, loop: boolean, w: number) => { if (w > 0.001) layers.push({ clip, t, loop, legs: w, torso: w, armR: w, armL: w }); };
    /** A clip over what is there: it takes `upper` of the chest and arms and `legs` of the legs. */
    const over = (clip: string, t: number, loop: boolean, upper: number, legs: number) => {
      if (upper <= 0.001 && legs <= 0.001) return;
      for (const l of layers) {
        l.legs = (l.legs ?? 0) * (1 - legs);
        l.torso = (l.torso ?? 0) * (1 - upper);
        l.armR = (l.armR ?? 0) * (1 - upper);
        l.armL = (l.armL ?? 0) * (1 - upper);
      }
      layers.push({ clip, t, loop, legs, torso: upper, armR: upper, armL: upper });
    };
    all('Idle_Loop', this.clock, true, 1 - this.gait);
    all('Walk_Loop', gw.leftFwd + ph * gw.dur, true, this.gait * wWalk);
    all('Jog_Fwd_Loop', gj.leftFwd + ph * gj.dur, true, this.gait * wJog);
    all('Sprint_Loop', gs.leftFwd + ph * gs.dur, true, this.gait * wSprint);

    // a hit: a short flinch of the chest and arms
    this.realFlinch += dt;
    const fl = realClipInfo('Hit_Chest');
    if (this.realFlinch < fl.dur) over('Hit_Chest', this.realFlinch, false, 0.8 * (1 - this.realFlinch / fl.dur), 0);

    // the basic attack, fitted to the game's timing as on the older figures: up to its hit through the wind-up, on after it
    const m = state.attack, rel = m?.release ?? 0;
    if (m && rel > 0 && (rel > this.lastRelease + 0.2 || (this.lastWind >= 0 && m.wind < 0))) this.sinceHit = 0;
    else this.sinceHit += dt;
    this.lastRelease = rel;
    const swinging = !!m && (m.wind >= 0 || m.release > 0 || this.sinceHit < STRIKE_RECOVER);
    if (m && m.wind >= 0 && this.lastWind < 0) this.swingLeft = !this.swingLeft;
    if (m && m.wind > this.lastWind && this.lastWind >= 0) this.windSec = Math.min(1, Math.max(0.1, dt / (m.wind - this.lastWind)));
    this.lastWind = m?.wind ?? -1;
    this.attackW += ((swinging ? 1 : 0) - this.attackW) * ease(dt, 18);
    if (m && this.attackW > 0.01) {
      const clip = this.realAttackClip(m.melee), info = realClipInfo(clip);
      const tail = Math.min(info.dur - info.hit, CLIP_TAIL), lead = Math.min(info.hit, CLIP_LEAD, this.windSec * CLIP_RUSH);
      const at = m.wind >= 0 ? info.hit - lead * (1 - m.wind) : info.hit + tail * Math.min(1, this.sinceHit / STRIKE_RECOVER);
      over(clip, at, false, this.attackW, this.attackW * (1 - this.gait));
    }

    // a cast
    const cn = this.castNow;
    if (cn) {
      cn.t += dt;
      const castW = cn.t < cn.dur ? 1 : 1 - (cn.t - cn.dur) / 0.3;
      if (castW <= 0) this.castNow = null;
      else {
        const loop = cn.style === 'raise' || cn.style === 'channel';
        const clip = loop ? 'Spell_Simple_Idle_Loop' : cn.style === 'slam' ? 'Jump_Land' : cn.style === 'lunge' ? 'Sword_Dash' : cn.style === 'swing' ? 'Sword_Regular_C' : 'Spell_Simple_Shoot';
        const info = realClipInfo(clip), a = Math.min(0.24, cn.dur * 0.35) * (cn.big ? 1.3 : 1);
        const t = loop ? cn.t : cn.t < a ? info.hit * (cn.t / a) : Math.min(info.dur, info.hit + (cn.t - a));
        const w = castW * smooth(0, 0.1, cn.t);
        over(clip, t, loop, w, w * (1 - this.gait));
      }
    }
    if (this.stunW > 0.01) over('Zombie_Idle_Loop', this.clock, true, this.stunW, this.stunW);
    if (this.liftW > 0.01) over('Jump_Loop', this.clock, true, this.liftW, this.liftW);
    r.pose(layers);
  }

  /** Falls over (a defeated hero) over `t` 0..1: the knees give, the chest folds, then it tips forward. */
  fall(t: number) {
    this.dying = Math.max(0, t);
    if (this.real) this.poseDeath(this.real);
    if (this.figure && !this.body) this.applyDeath(this.figure);
  }

  private applyDeath(f: Hero) {
    const t = this.dying, buckle = smooth(0, 0.45, t), tip = smooth(0.3, 1, t);
    f.root.position.set(this.base.x, this.base.y - 0.28 * buckle * (1 - tip), this.base.z);
    f.root.rotation.x = 1.3 * tip;
    if (!f.loaded) return;
    f.resetPose();
    f.rot('pelvis', AX, 0.2 * buckle);
    f.rot('chest', AX, 0.45 * buckle);
    f.rot('head', AX, 0.3 * buckle);
    f.rot('thighL', AX, -0.9 * buckle);
    f.rot('thighR', AX, -0.75 * buckle);
    f.rot('shinL', AX, 1.5 * buckle);
    f.rot('shinR', AX, 1.3 * buckle);
    f.rot('armL', AZ, 0.25 * tip);
    f.rot('armR', AZ, -0.35 * tip);
    f.rot('armL', AX, -0.4 * tip);
    f.rot('armR', AX, -0.2 * tip);
  }

  /** Stands the figure back up (after `fall`) and drops every running pose. */
  stand() {
    this.reset();
    if (this.figure) this.figure.root.rotation.x = 0;
  }

  private reset() {
    this.dying = -1;
    this.castNow = null;
    this.hitA = this.hitV = 0;
    this.flashV = 0;
    this.stunW = this.liftW = this.rootW = this.attackW = this.gait = 0;
    this.sinceHit = 9;
    this.lastRelease = 0;
    this.vel.set(0, 0, 0);
    this.accF = this.accS = this.fwd = this.side = this.yawRate = 0;
    this.moving = false;
    this.walk = this.walkPhase = this.run = this.dirS = 0;
    this.dirF = 1;
    this.rock = this.rockV = this.armMo = this.armMoV = 0;
    this.fidget = -1;
    for (const sp of this.springs) sp.p = sp.r = sp.vp = sp.vr = 0;
    this.springs.length = 0;
    if (this.figure) {
      this.figure.root.rotation.x = 0;
      this.figure.setFlash(0);
    }
  }
}
