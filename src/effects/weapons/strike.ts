import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type GUI from 'three/addons/libs/lil-gui.module.min.js';
import type { Emitter } from '../../emitter';
import { createScreenFx } from '../parts';
import { frameCast, yawTo, type CastContext, type HitOptions } from '../targeting';
import type { Enemy } from '../common';
import type { BloomSettings } from '../../presets';
import type { TelegraphSpec } from '../telegraph';
import type { Effect, EffectModule } from '../types';
import type { WeaponAura } from './aura';
import { Hero, type BoneName } from './hero';

/**
 * A weapon attack in the arena (category 'weapon attacks'): the rigged hero takes the arena caster's place, holds
 * the weapon with its looping aura (one of the five `WeaponAura`s, reparented into the hand), dashes to the target,
 * strikes and walks back. Subclasses give the choreography (`poses`) and the hit VFX (`animate`).
 *
 * The arena's capsule caster is hidden while this effect is shown (restored when main hides the effect), and the
 * hero follows it when idle, so play mode (WASD + hotbar) works too.
 */

/** One key pose of the choreography. Angles in radians; missing values are 0. */
export interface Pose {
  /** Seconds after play. */
  t: number;
  /** 0 = at the caster, 1 = at the strike spot in front of the target. */
  dash?: number;
  /** Extra hop height (world units). */
  hop?: number;
  /** Knee bend 0..1. */
  crouch?: number;
  /** Chest: + leans forward. */
  lean?: number;
  /** Chest: + turns to the figure's left. */
  twist?: number;
  /** Right shoulder: raise forward (π/2 = horizontal forward, π = straight up, more = up and back). */
  pitch?: number;
  /** Right shoulder: swing across (+ toward the left, - out to the right). */
  yaw?: number;
  /** Right shoulder: raise out to the side. */
  side?: number;
  /** Right elbow bend (forward). */
  elbow?: number;
  /** Right wrist: cock the weapon up (+) / down (-). */
  cock?: number;
  /** Right wrist: roll about the forearm. */
  roll?: number;
  /** Left arm raised forward (balance / off-hand). */
  left?: number;
}

const KEYS = ['dash', 'hop', 'crouch', 'lean', 'twist', 'pitch', 'yaw', 'side', 'elbow', 'cock', 'roll', 'left'] as const;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const ease = (x: number) => x * x * (3 - 2 * x);

/** Interpolates the key poses at time t (smooth per segment; holds the ends). */
export function samplePose(poses: readonly Pose[], t: number): Required<Pose> {
  const out = { t } as Required<Pose>;
  let i = 0;
  while (i < poses.length - 1 && t > poses[i + 1].t) i++;
  const a = poses[i], b = poses[Math.min(i + 1, poses.length - 1)];
  const f = b.t > a.t ? ease(THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1)) : 0;
  for (const k of KEYS) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * f;
  return out;
}

/** The stance the hero holds the weapon in when not attacking. */
export const IDLE: Pose = { t: 0, pitch: 0.55, elbow: 0.9, cock: 0.2, side: 0.12, left: 0.15 };

export abstract class WeaponStrike implements Effect {
  readonly group = new THREE.Group();
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly hero = new Hero();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;
  /** Total length and the moment the blow lands (seconds after play). */
  abstract readonly duration: number;
  abstract readonly impact: number;
  /** How far in front of the target the hero stops (world units). */
  reach = 2.4;
  /** The choreography, sorted by t, from IDLE back to IDLE. */
  protected abstract readonly poses: Pose[];

  protected time = 0;
  /** Cast geometry: where the hero starts, where it strikes from, the unit direction to the target. */
  protected from = new THREE.Vector3();
  protected spot = new THREE.Vector3();
  protected dir = new THREE.Vector3(0, 0, -1);
  protected yaw = Math.PI;
  /** Own emitters (the aura's are updated by the aura). */
  protected own: Emitter[] = [];
  private hidden: THREE.Object3D[] = [];
  private shown = true;

  constructor(readonly aura: WeaponAura) {
    this.hero.grip.add(aura.rig);
    this.group.add(this.hero.root, this.hero.grip);
    this.emitters.push(...aura.emitters);
    // main only toggles group.visible when it switches modes: use that to give the capsule caster back
    let vis = true;
    Object.defineProperty(this.group, 'visible', {
      get: () => vis,
      set: (v: boolean) => { vis = v; if (!v) this.showCapsule(); },
    });
  }

  protected addEmitter(e: Emitter) {
    this.group.add(e.points);
    this.emitters.push(e);
    this.own.push(e);
    return e;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
  }

  play() {
    this.time = 0;
    this.playing = true;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) {
      this.from.copy(ctx.from);
      const target = ctx.targetPos[0] ?? ctx.point;
      this.dir.copy(target).sub(this.from).setY(0);
      const d = this.dir.length();
      if (d > 1e-4) this.dir.divideScalar(d); else this.dir.set(0, 0, -1);
      this.yaw = yawTo(this.from, target);
      this.spot.copy(this.from).addScaledVector(this.dir, Math.max(0, d - this.reach));
    }
    for (const e of this.own) e.clear();
    this.aura.play();
    this.reset();
  }

  update(dt: number) {
    if (this.playing) {
      this.time += dt;
      if (this.time > this.duration) this.playing = false;
    }
    this.hideCapsule();
    this.aura.update(dt);
    this.screen.darken = 0;

    // pose: the choreography while playing, else the idle stance where the caster stands
    const h = this.hero;
    h.resetPose();
    const t = this.time;
    const p = this.playing ? samplePose(this.poses, t) : { ...samplePose([IDLE], 0) };
    if (this.playing) {
      h.root.position.copy(this.from).lerp(this.spot, p.dash);
      h.root.rotation.set(0, this.yaw, 0);
    } else if (this.ctx) {
      h.root.position.copy(this.ctx.caster.group.position).setY(0);
      h.root.rotation.set(0, this.ctx.caster.group.rotation.y, 0);
    }
    h.root.position.y = p.hop - 0.25 * p.crouch;
    this.applyPose(p);
    h.updateGrip();
    this.animate(t, dt);
    for (const e of this.own) e.update(dt);
  }

  private applyPose(p: Required<Pose>) {
    const h = this.hero;
    h.rot('thighR', X, -0.9 * p.crouch);
    h.rot('thighL', X, -0.5 * p.crouch);
    h.rot('shinR', X, 1.2 * p.crouch);
    h.rot('shinL', X, 0.9 * p.crouch);
    h.rot('chest', Y, p.twist);
    h.rot('chest', X, p.lean);
    h.rot('armR', Z, -p.side);
    h.rot('armR', X, -p.pitch);
    h.rot('armR', Y, p.yaw);
    this.bend('foreR', -p.elbow, 'armR');
    this.bend('handR', p.cock, 'foreR');
    if (p.roll) this.bendAxis('handR', p.roll, 'foreR');
    h.rot('armL', X, -p.left);
    h.rot('armL', Z, 0.15);
    this.bend('foreL', -0.6 - 0.4 * p.left, 'armL');
  }

  /** Hinge a bone about its parent's sideways axis (the elbow / wrist hinge follows the arm). */
  private bend(name: BoneName, angle: number, parent: BoneName) {
    const pb = this.hero.bone(parent);
    if (!pb) return;
    const q = pb.getWorldQuaternion(new THREE.Quaternion()).premultiply(this.hero.root.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.hero.rot(name, X.clone().applyQuaternion(q), angle);
  }

  /** Roll a bone about its parent's long axis. */
  private bendAxis(name: BoneName, angle: number, parent: BoneName) {
    const pb = this.hero.bone(parent);
    if (!pb) return;
    const q = pb.getWorldQuaternion(new THREE.Quaternion()).premultiply(this.hero.root.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.hero.rot(name, Y.clone().applyQuaternion(q), angle);
  }

  /** Hit every enemy within `radius` of `at` (or just `targets` if given) — call once at the impact. */
  protected hitAround(at: THREE.Vector3, radius: number, opts: HitOptions = {}, only?: readonly Enemy[]) {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const list = only ?? ctx.targets;
    let n = 0;
    list.forEach((e) => {
      const p = e.group.position;
      if (only || Math.hypot(p.x - at.x, p.z - at.z) <= radius) {
        ctx.hit(e, { from: this.hero.root.position, ...opts });
        n++;
      }
    });
    return n;
  }

  /** The weapon's tip / a socket in world space (weapon-space point → world). */
  protected weaponPoint(local: THREE.Vector3, out = new THREE.Vector3()) {
    this.hero.grip.updateMatrixWorld(true);
    return out.copy(local).applyMatrix4(this.hero.grip.matrixWorld);
  }

  private hideCapsule() {
    const caster = this.ctx?.caster;
    if (!caster || !this.shown && this.hidden.length) return;
    this.hidden = caster.group.children.filter((c) => c.visible && c !== this.hero.root);
    for (const c of this.hidden) c.visible = false;
    this.shown = false;
  }

  private showCapsule() {
    for (const c of this.hidden) c.visible = true;
    this.hidden = [];
    this.shown = true;
  }

  /** Called on every play (clear one-shot flags). */
  protected reset() {}

  /** Hit VFX and hits; t = seconds since play. */
  protected abstract animate(t: number, dt: number): void;
}

export interface StrikeModuleOptions {
  mode?: 'enemy' | 'enemies';
  maxTargets?: number;
  /** Telegraph: a cone (melee arc) or circle (slam) at the strike spot, `radius` world units. */
  zone?: { kind: 'cone' | 'circle'; radius: number; /** cone width, degrees (default 110) */ angle?: number };
  bloom?: BloomSettings;
  gui?: (folder: GUI, effect: WeaponStrike) => void;
}

/** Registry entry for a weapon attack: targeted, category 'weapon attacks', framed on caster and target. */
export function strikeModule(label: string, create: () => WeaponStrike, opts: StrikeModuleOptions = {}): EffectModule {
  return {
    label,
    category: 'weapon attacks',
    targeting: { mode: opts.mode ?? 'enemy', maxTargets: opts.maxTargets },
    create,
    bloom: opts.bloom ?? { enabled: true, strength: 0.7, radius: 0.5, threshold: 0.82 },
    telegraphs(effect: Effect): TelegraphSpec[] {
      const e = effect as WeaponStrike;
      const ctx = e.ctx;
      if (!ctx) return [];
      const target = ctx.targetPos[0] ?? ctx.point;
      const from = ctx.from.clone();
      const dir = target.clone().sub(from).setY(0);
      const d = dir.length();
      if (d > 1e-4) dir.divideScalar(d);
      const spot = from.addScaledVector(dir, Math.max(0, d - e.reach));
      const z = opts.zone ?? { kind: 'cone', radius: e.reach + 1.5, angle: 110 };
      const shape = z.kind === 'circle'
        ? { kind: 'circle' as const, x: target.x, z: target.z, radius: z.radius }
        : { kind: 'cone' as const, x: spot.x, z: spot.z, radius: z.radius, dir: yawTo(spot, target), angle: z.angle ?? 110 };
      return [{ shape, start: Math.max(0, e.impact - 0.6), impact: e.impact }];
    },
    frameCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, effect: Effect) {
      const e = effect as WeaponStrike;
      const ctx = e.ctx;
      if (!ctx) return;
      const target = ctx.targetPos[0] ?? ctx.point;
      const dir = target.clone().sub(ctx.from).setY(0);
      const d = dir.length();
      // ranged attacks (the fan) keep the arena's wide view; melee gets a close three-quarter view of the duel
      if (e.reach > 100 || d < 1e-3) { frameCast(camera, controls, ctx, 4); return; }
      dir.divideScalar(d);
      const spot = ctx.from.clone().addScaledVector(dir, Math.max(0, d - e.reach));
      const centre = spot.clone().lerp(target, 0.5).setY(1.4);
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      controls.target.copy(centre);
      camera.position.copy(centre).addScaledVector(side, 8).addScaledVector(dir, -4).setY(4.2);
    },
    buildGui(folder: GUI, effect: Effect) {
      opts.gui?.(folder, effect as WeaponStrike);
    },
  };
}
