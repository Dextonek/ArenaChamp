import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Bubbles, Drops, JANITOR, JANITOR_CSS, Ripples, SwipeFan, Words, buildMop } from '../../effects/parts/janitor';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { wipeGround } from '../../traits/ground';
import { MOP_ANGLE, MOP_DAMAGE, MOP_REACH, MOP_WIND, STRIP_LENGTH, WET_LIFE, addWet } from '../../traits/janitor';

/**
 * Big Mop (janitor kit v5, Q: a QUICK swipe, `self` mode; label 'big mop'). Gus draws the mop back over the 0.3 s wind-up (it squeaks:
 * SQUEAK) and swings it across the cone in front of him (3.5 m, 140 degrees: the same shape the telegraph draws), its strings
 * dragging a fan of foamy water along the floor: 45 on every enemy inside it at 0.3 s on live positions (60 while he surfs on
 * Flood: the trait's `castMods` multiplies it). The mop leaves a strip of wet floor 6 m long and 2 m wide straight ahead of him
 * (`addWet`, written on both screens at the swing; it stays wet 6 s, shining, drawn by the trait's `marks`), and wipes the enemy's
 * rods, flowers and ink along that strip (`wipeGround`, on every enemy figure on both screens: only a hero that keeps such things has
 * anything to lose). The cone's apex is `sentFrom` and its heading the caster's facing at the cast, so both screens agree.
 * Telegraph: the cone, impact at the swing (he is rooted 0.3 s). Rhythm tool, 3.5 s. Clean by about 2 s. See pipeline/designs/kit-janitor.md.
 */
export interface BigMopSettings {
  damage: number;
  loop: boolean;
}

export const defaultBigMop = (): BigMopSettings => ({ damage: MOP_DAMAGE, loop: false });

// Timeline (seconds) and shapes.
const HIT_T = MOP_WIND;
const SWING_S = 0.16;
const DURATION = 2.0;
const MOP_SCALE = 1.4;
const WIPE_R = 1.3;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class BigMop implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BigMopSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: MOP_REACH, angle: MOP_ANGLE, dir: 0 };
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private yaw = 0;
  private time = 0;
  private swung = false;
  private squeaked = false;
  private stripDone = 0;

  private mop = buildMop();
  private fan = new SwipeFan(MOP_REACH, MOP_ANGLE);
  private bubbles = new Bubbles(60);
  private drops = new Drops(46);
  private ripples = new Ripples(6);
  private words = new Words(2);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: JANITOR.pale, core: JANITOR.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BigMopSettings = defaultBigMop()) {
    this.settings = settings;
    this.mop.scale.setScalar(MOP_SCALE);
    this.mop.visible = false;
    this.group.add(this.fan.mesh, this.ripples.mesh, this.mop, this.bubbles.mesh, this.drops.mesh, this.words.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the cone and the strip: `sentFrom` for the apex and the caster's facing for the heading
    // (`ctx.aim` is 0 for the CPU, whose context is built without an aim point).
    const s = ctx.sentFrom ?? ctx.from;
    this.yaw = ctx.caster.group.rotation.y;
    this.from.set(s.x, 0, s.z);
    this.fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.cone = { kind: 'cone', x: s.x, z: s.z, radius: MOP_REACH, angle: MOP_ANGLE, dir: this.yaw };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.swung = this.squeaked = false;
    this.stripDone = 0;
    this.mop.visible = false;
    this.fan.reset();
    this.bubbles.reset();
    this.drops.reset();
    this.ripples.reset();
    this.words.reset();
    this.pop.set(this.from, 0, 0);
    this.shock.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.fan.update(dt);
    this.bubbles.update(dt);
    this.drops.update(dt);
    this.ripples.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (t >= DURATION && !this.bubbles.busy && !this.drops.busy && !this.words.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- Wind-up: the mop comes up and back on his right, squeaking. Then the swing: from the right across to the left. ---
    const half = THREE.MathUtils.degToRad(MOP_ANGLE) / 2;
    if (t < HIT_T + SWING_S + 0.25) {
      let a: number, r: number, h: number;
      if (t < HIT_T) {
        const k = easeOut(t / HIT_T);
        a = half * (0.7 + 0.5 * k);
        r = 1.2 + 0.2 * k;
        h = 0.5 + 0.9 * k;
      } else {
        const k = easeOut((t - HIT_T) / SWING_S), back = Math.max(0, (t - HIT_T - SWING_S) / 0.25);
        a = half * 1.2 - (half * 2.4) * k;
        r = 1.4 + 0.9 * k;
        h = 0.14 + 1.0 * back;
        if (back > 0) { a = -half * 1.2 + half * 0.5 * back; r = 2.3 - 0.9 * back; }
      }
      this.placeMop(a, r, h);
    } else this.mop.visible = false;
    if (!this.squeaked && t >= 0.08) {
      this.squeaked = true;
      this.v1.copy(this.from).addScaledVector(this.fwd, 0.6).setY(2.3);
      this.words.show('SQUEAK', this.v1, 0.5, 0.9, JANITOR_CSS.pale);
      this.bubbles.emit(this.v1.set(this.from.x, 1.2, this.from.z), 4, 0.4, 0.12, 0.8);
    }

    if (!this.swung && t >= HIT_T) {
      this.swung = true;
      this.swing();
    }
    if (this.swung) {
      const a = t - HIT_T;
      // The wet front runs down the strip: foam and drops where it is now.
      const len = Math.min(STRIP_LENGTH, a * 18);
      while (this.stripDone < len) {
        this.stripDone += 0.5;
        const d = this.stripDone, side = (Math.random() - 0.5) * 1.6;
        this.v1.set(this.from.x + this.fwd.x * d - this.fwd.z * side, 0.1, this.from.z + this.fwd.z * d + this.fwd.x * side);
        this.bubbles.emit(this.v1, 1, 0.5, 0.15, 1.0);
        if (Math.random() < 0.5) this.drops.burst(this.v1, 2, 1.2, 2.2, 0.06);
      }
      this.shake = Math.max(this.shake * Math.exp(-dt * 10), 0.12 * Math.exp(-a * 14));
      const sp = StarBurst.pop(a, 0, 0.02);
      this.pop.set(this.v1.copy(this.from).addScaledVector(this.fwd, 2.4).setY(0.9), 1.1 * sp.scale, sp.opacity, 0.2);
    }
  }

  /** The mop head at angle `a` (radians off his facing) and distance `r`, `h` m up; the handle runs back to his hand. */
  private placeMop(a: number, r: number, h: number) {
    const ca = Math.cos(a), sa = Math.sin(a);
    // The facing rotated by `a`.
    const dx = this.fwd.x * ca + this.fwd.z * sa, dz = this.fwd.z * ca - this.fwd.x * sa;
    this.mop.visible = true;
    this.mop.position.set(this.from.x + dx * r, h, this.from.z + dz * r);
    this.v2.set(this.from.x + this.fwd.x * 0.3, 1.1, this.from.z + this.fwd.z * 0.3).sub(this.mop.position).normalize();
    this.mop.quaternion.setFromUnitVectors(this.v1.set(0, 1, 0), this.v2);
  }

  /** The swing: the fan, the enemies in the cone, the wet strip, the wipe. */
  private swing() {
    const ctx = this.ctx;
    this.fan.fire(this.from.x, this.from.z, this.yaw, SWING_S);
    this.ripples.fire(this.from.x + this.fwd.x * 1.6, this.from.z + this.fwd.z * 1.6, 0.4, 2.2, 0.35, 0.5, JANITOR.pale, true);
    this.shock.set(this.v1.copy(this.from).addScaledVector(this.fwd, 1.6), 0.5 + 1.6, 0.03);
    // Water flung off the strings along the arc.
    for (let i = 0; i < 6; i++) {
      const a = (i / 5 - 0.5) * THREE.MathUtils.degToRad(MOP_ANGLE) * 0.9;
      this.v1.set(this.from.x + (this.fwd.x * Math.cos(a) + this.fwd.z * Math.sin(a)) * 2.4, 0.3, this.from.z + (this.fwd.z * Math.cos(a) - this.fwd.x * Math.sin(a)) * 2.4);
      this.drops.burst(this.v1, 5, 2.6, 3.4, 0.07, this.fwd);
    }
    this.bubbles.emit(this.v1.copy(this.from).addScaledVector(this.fwd, 1.4).setY(0.2), 10, 1.2, 0.16, 1.2);
    if (!ctx) return;
    // Everyone still inside the cone on their live position is hit.
    const foes = ctx.enemies?.() ?? ctx.targets;
    for (const e of foes) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 2, from: ctx.from, color: JANITOR_CSS.water });
    }
    // The strip: wet for 6 s from now, and the enemy's rods, flowers and ink along it are wiped (both screens do the same).
    const now = performance.now();
    addWet(ctx.caster, {
      kind: 'strip', x: this.from.x, z: this.from.z, yaw: this.yaw, length: STRIP_LENGTH, r: 0, bornAt: now, until: now + WET_LIFE * 1000,
    });
    for (let d = 0.6; d <= STRIP_LENGTH + 0.3; d += WIPE_R) {
      const x = this.from.x + this.fwd.x * d, z = this.from.z + this.fwd.z * d;
      for (const e of foes) wipeGround(e, x, z, WIPE_R);
    }
  }
}

export const bigMopModule: EffectModule = {
  label: 'big mop',
  category: 'hero: janitor',
  // Quick, no aim: the cone is centred on him and the radius is the reach the CPU uses it at.
  targeting: { mode: 'self', radius: MOP_REACH },
  create: () => new BigMop(),
  telegraphs(effect) {
    const e = effect as BigMop;
    if (!e.ctx) return [];
    return [{ shape: e.cone, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BigMop;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as BigMop).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
