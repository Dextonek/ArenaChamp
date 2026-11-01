import * as THREE from 'three';
import { Hero, type BoneName } from './effects/weapons/hero';
import type { StatusSet } from './effects/status';
import type { HeroKit, HeroSpell } from './heroes';
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

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
/** Exponential approach factor for a rate per second. */
const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

/** A damped pendulum per sway chain: pitch (swings forward / back) and roll (side to side). */
interface Spring { p: number; r: number; vp: number; vr: number }

/**
 * A hero's rigged figure standing in for a capsule figure (the player's caster in hero mode, the opponent in a duel).
 * `setModel(url, at, kit)` swaps the model (cached per url); `follow(...)` every frame places it and poses it,
 * procedurally on the shared rig: breathing and weight shift at rest, a speed-scaled walk with hip and chest
 * counter-turn, leaning into turns and starts, the basic attack's swing, a wind-up / strike / settle per cast style
 * (`cast`), a flinch and a tinted flash when hit (`hit`), slumps and flails under stun and knock-up, a frozen pose
 * in an ice block, and spring-driven hair, sashes and robe tails. `fall` crumples it. Add `group` to the scene.
 * Heavy heroes (high HP) plant wider and sway their chest more; fast ones lean in and run with bent arms; hammer and
 * greatsword heroes swing overhead with both hands.
 */
export class HeroFigure {
  readonly group = new THREE.Group();
  private figures = new Map<string, Hero>();
  private figure: Hero | null = null;
  private heavy = 0;
  private agile = 0;
  private melee = false;
  /** A two-handed overhead attack (hammer, greatsword) instead of alternating slashes. */
  private overhead = false;
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
  private moving = false;
  private walk = 0;
  private walkPhase = 0;
  // Layers.
  private castNow: { style: CastStyle; t: number; dur: number; big: boolean } | null = null;
  private attackW = 0;
  private swingLeft = false;
  private lastWind = -1;
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
    return !!this.figure;
  }

  /** Shows the model at `url` (undefined hides the figure), styled after `kit`. Returns whether one is shown. */
  setModel(url: string | undefined, at?: THREE.Vector3, kit?: HeroKit) {
    for (const f of this.figures.values()) f.root.visible = false;
    this.figure = null;
    if (url) {
      let f = this.figures.get(url);
      if (!f) {
        f = new Hero({ url, shade: 0.9, maxEmissive: 1, tintSheen: true });
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
      this.melee = trait?.attack?.kind === 'melee';
      this.overhead = this.melee && (trait?.attack?.look === 'smash' || trait?.attack?.look === 'cleave');
    }
    if (at) this.last.copy(at);
    this.reset();
    return !!this.figure;
  }

  /** A spell was cast: plays `style`'s wind-up and strike over `seconds` (the cast's own root). */
  cast(style: CastStyle, seconds: number, big = false) {
    this.castNow = { style, t: 0, dur: Math.max(0.35, Math.min(seconds, 2.5)), big };
  }

  /** A hit landed on this hero: a flinch away from `from` and a flash in `tint`; `strength` 0..1. */
  hit(strength: number, tint?: THREE.ColorRepresentation, from?: THREE.Vector3) {
    const s = Math.min(1, Math.max(0, strength));
    this.flashV = Math.max(this.flashV, 0.4 + 0.6 * s);
    this.flashTint.set(tint ?? '#ff8a4a');
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
    this.track(dt, pos, yaw);
    f.root.rotation.y = yaw;
    this.flashV = Math.max(0, this.flashV - dt * 3.2);
    f.setFlash(this.flashV, this.flashTint);
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

    // Walk: stride rate and size follow the real speed.
    const speed = this.vel.length();
    this.walk += ((this.moving ? Math.min(1.15, Math.max(0.45, speed / 4)) : 0) - this.walk) * ease(dt, 8);
    this.walkPhase += dt * (4.4 + 1.15 * speed) * (1 - 0.15 * this.heavy) * (this.walk > 0.02 ? 1 : 0);
    const w = this.walk, s = Math.sin(this.walkPhase), c = Math.cos(this.walkPhase);
    const bob = (Math.abs(s) * (0.05 + 0.03 * this.heavy)) * w;

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
        pose = CAST[cn.style];
        antic = smooth(0, a, cn.t);
        strike = Math.min(1, Math.max(0, (cn.t - a) / 0.08));
        over = strike >= 1 ? 0.22 * Math.exp(-(cn.t - a - 0.08) * 7) : 0;
        crouch = pose.crouch * (cn.big ? 1.3 : 1) * castW * Math.max(antic * 0.6, strike);
      }
    }
    const m = state.attack;
    const swinging = !!m && (m.wind >= 0 || m.release > 0);
    if (m && m.wind >= 0 && this.lastWind < 0) this.swingLeft = !this.swingLeft;
    this.lastWind = m?.wind ?? -1;
    this.attackW += ((swinging ? 1 : 0) - this.attackW) * ease(dt, 18);
    const busy = Math.max(castW, this.attackW, this.stunW, this.liftW);

    f.root.position.set(pos.x, pos.y + bob - crouch - 0.06 * this.stunW, pos.z);
    f.resetPose();

    // Rest: breath, weight shift, a slow look round; melee heroes keep their guard up, heavy ones plant wide.
    const t = this.clock, breath = Math.sin(t * 1.9), shift = Math.sin(t * 0.55), rest = (1 - 0.75 * w) * (1 - busy);
    f.rot('pelvis', AZ, 0.035 * shift * rest);
    f.rot('chest', AX, 0.025 * breath + 0.06 * this.heavy);
    f.rot('chest', AZ, -0.03 * shift * rest);
    f.rot('head', AY, (0.14 * Math.sin(t * 0.37) + 0.05 * Math.sin(t * 1.13)) * rest);
    f.rot('head', AX, 0.03 * Math.sin(t * 0.71) * rest);
    f.rot('armL', AZ, (0.05 + 0.015 * breath) * (1 - busy));
    f.rot('armR', AZ, (-0.05 - 0.015 * breath) * (1 - busy));
    if (this.melee) {
      const g = (1 - w * 0.6) * (1 - busy);
      f.rot('armR', AX, -0.3 * g);
      f.rot('foreR', AX, -0.55 * g);
      f.rot('armL', AX, -0.2 * g);
      f.rot('foreL', AX, -0.45 * g);
    }
    f.rot('thighL', AZ, 0.05 * this.heavy);
    f.rot('thighR', AZ, -0.05 * this.heavy);

    // Walk: legs, hip twist, chest counter-turn, arm swing; fast heroes lean in and pump bent arms.
    const stride = 0.55 * (1 + 0.25 * this.agile - 0.1 * this.heavy);
    f.rot('pelvis', AY, 0.12 * s * w);
    f.rot('pelvis', AZ, 0.04 * c * w);
    f.rot('thighL', AX, -stride * s * w);
    f.rot('thighR', AX, stride * s * w);
    f.rot('shinL', AX, (0.15 + 0.75 * Math.max(0, Math.sin(this.walkPhase + 0.5))) * w);
    f.rot('shinR', AX, (0.15 + 0.75 * Math.max(0, -Math.sin(this.walkPhase + 0.5))) * w);
    f.rot('chest', AY, -(0.14 + 0.08 * this.heavy) * s * w);
    f.rot('chest', AX, (0.06 + 0.14 * this.agile) * w + clamp(this.accF * 0.025, 0.2));
    f.rot('chest', AZ, clamp(-this.yawRate * 0.05 * w, 0.22));
    f.rot('head', AY, 0.1 * s * w);
    const armFree = 1 - Math.max(castW, this.attackW);
    f.rot('armL', AX, 0.45 * s * w * (1 - busy * 0.5));
    f.rot('armR', AX, -0.45 * s * w * armFree);
    f.rot('foreL', AX, -0.75 * this.agile * w);
    f.rot('foreR', AX, -0.75 * this.agile * w * armFree);

    // Basic attack: melee slashes alternate arms (heavy heroes swing overhead); ranged ones flick and recoil.
    if (m && this.attackW > 0.01) {
      const k = m.wind >= 0 ? smooth(0, 1, m.wind) : 0, r = Math.max(0, m.release), aw = this.attackW;
      if (m.melee && this.overhead) {
        f.rot('chest', AX, (-0.25 * k + 0.45 * r) * aw);
        f.rot('armR', AX, (-2.5 * k - 0.7 * r) * aw);
        f.rot('armL', AX, (-2.5 * k - 0.7 * r) * aw);
        f.rot('foreR', AX, -0.4 * k * aw);
        f.rot('foreL', AX, -0.4 * k * aw);
      } else if (m.melee) {
        const L = this.swingLeft, sg = L ? -1 : 1;
        f.rot('chest', AY, sg * (-0.45 * k + 0.5 * r) * aw);
        f.rot('chest', AX, (-0.08 * k + 0.22 * r) * aw);
        f.rot(L ? 'armL' : 'armR', AX, (-1.7 * k - 0.9 * r) * aw);
        f.rot(L ? 'armL' : 'armR', AZ, sg * (0.55 * k - 0.45 * r) * aw);
        f.rot(L ? 'foreL' : 'foreR', AX, -0.6 * k * aw);
      } else {
        f.rot('chest', AY, (-0.25 * k + 0.2 * r) * aw);
        f.rot('chest', AX, -0.08 * r * aw);
        f.rot('armR', AX, (-1.2 * k - 1.55 * r * (1 - k)) * aw);
        f.rot('foreR', AX, -0.45 * k * aw);
      }
    }

    // The cast pose.
    if (pose && castW > 0) {
      const amp = (cn!.big ? 1.18 : 1) * castW;
      const tremble = cn!.style === 'channel' ? 0.04 * Math.sin(t * 38) * strike : 0;
      for (const [b, ax, v] of pose.antic) f.rot(b, ax, v * antic * (1 - strike) * amp);
      for (const [b, ax, v] of pose.strike) f.rot(b, ax, (v * (1 + over) + (b.startsWith('arm') ? tremble : 0)) * strike * amp);
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

    this.swing(f, dt, w);
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

  /** Falls over (a defeated hero) over `t` 0..1: the knees give, the chest folds, then it tips forward. */
  fall(t: number) {
    this.dying = Math.max(0, t);
    if (this.figure) this.applyDeath(this.figure);
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
    this.stunW = this.liftW = this.rootW = this.attackW = 0;
    this.vel.set(0, 0, 0);
    this.accF = this.accS = this.fwd = this.side = this.yawRate = 0;
    this.moving = false;
    this.walk = this.walkPhase = 0;
    for (const sp of this.springs) sp.p = sp.r = sp.vp = sp.vr = 0;
    this.springs.length = 0;
    if (this.figure) {
      this.figure.root.rotation.x = 0;
      this.figure.setFlash(0);
    }
  }
}
