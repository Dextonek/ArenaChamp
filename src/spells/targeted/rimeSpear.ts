import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  FROST, FROST_CSS, FrostBreath, FrostFerns, IceCrystals, IceStreak, RimeSleeves, Snow,
} from '../../effects/parts/frost';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Rime Spear (frost kit, Q: single target). She breathes on her open hand, a long ice javelin grows in it, she throws
 * it and it pierces the enemy. Frost ferns spread out of the ground under the target and climb its body as rime; six
 * small crystals burst up around it. Then the spear and the crystals shatter and the ferns fade. See
 * pipeline/designs/kit-frost.md.
 */
export interface RimeSpearSettings {
  damage: number;
  loop: boolean;
}

export const defaultRimeSpear = (): RimeSpearSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const GROW_T = 0.05; // the javelin starts to grow in her hand
const THROW_T = 0.3;
const IMPACT_T = 0.5;
const SHATTER_T = 0.8;
const DURATION = 1.7;
const SPEAR_LEN = 3;

export class RimeSpear implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RimeSpearSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.5, 13);
  private feet = new THREE.Vector3(0, 0, -8);
  private hit = new THREE.Vector3(0, 1.1, -8);
  private dir = new THREE.Vector3(0, 0, -1);
  private spearEnd = new THREE.Vector3();

  private flags = { breath: false, grown: false, impacted: false, shattered: false };
  private spearId = -1;
  private snowTimer = 0;

  // Parts.
  private breath = new FrostBreath(16);
  private spear = new IceCrystals({ maxSpikes: 2, maxShards: 48 });
  private ring = new IceCrystals({ maxSpikes: 8, maxShards: 40 });
  private streak = new IceStreak();
  private snow = new Snow({ max: 30 });
  private ferns = new FrostFerns({ variant: 0, maxShards: 28 });
  private fernsB = new FrostFerns({ variant: 1, maxShards: 0 });
  private sleeves = new RimeSleeves(1);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: FROST.accent, core: 0xfff0f6, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: RimeSpearSettings = defaultRimeSpear()) {
    this.settings = settings;
    this.screen.impactColor.set(FROST.rime);
    this.screen.tint.set(FROST.dark);
    this.ferns.renderOrder = 2;
    this.fernsB.renderOrder = 1;
    this.group.add(
      this.fernsB.mesh, this.ferns.mesh, this.sleeves.mesh, this.ring.mesh, this.spear.mesh, this.streak.mesh, this.snow.mesh,
      this.breath.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return IMPACT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.feet.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.5);
    this.hit.copy(this.feet).setY(1.1);
    this.dir.subVectors(this.hit, this.hand).normalize();
    // The javelin ends with its tip a little past the hit point.
    this.spearEnd.copy(this.hit).addScaledVector(this.dir, 0.25 - SPEAR_LEN);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.spear.mesh];
    this.screen.focus.copy(this.hit);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.snowTimer = 0;
    this.spearId = -1;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.breath.reset();
    this.spear.reset();
    this.ring.reset();
    this.snow.reset();
    this.ferns.reset();
    this.fernsB.reset();
    this.sleeves.clear();
    this.streak.set(this.hit, this.hand, 0, 0);
    this.pop.set(this.hit, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  /** Javelin base position at time t during the throw (accelerating). */
  private spearBase(t: number, out: THREE.Vector3) {
    const u = THREE.MathUtils.clamp((t - THROW_T) / (IMPACT_T - THROW_T), 0, 1);
    return out.lerpVectors(this.hand, this.spearEnd, Math.pow(u, 1.5));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.breath.update(dt);
    this.spear.update(dt);
    this.ring.update(dt);
    this.snow.update(dt);
    this.ferns.update(dt);
    this.fernsB.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.breath && t >= 0.02) {
      f.breath = true;
      this.breath.blow(this.v1.copy(this.hand).addScaledVector(this.fwd, -0.1), this.v2.copy(this.fwd).setY(0.15), 1.0, 0.18);
    }
    if (!f.grown && t >= GROW_T) {
      f.grown = true;
      this.spearId = this.spear.spike(this.hand, this.dir, SPEAR_LEN, 0.28, 0.25, 0);
    }
    // A few snowflakes shed behind the javelin in flight.
    if (t >= THROW_T && t < IMPACT_T) {
      this.snowTimer += dt;
      while (this.snowTimer >= 0.035) {
        this.snowTimer -= 0.035;
        this.snow.scatter(this.v1.copy(this.spearBase(t, this.v3)).addScaledVector(this.dir, Math.random() * 1.5), 1, 1.2, 0.7);
      }
    }
    if (!f.impacted && t >= IMPACT_T) {
      f.impacted = true;
      this.ferns.grow(this.feet, 2.2, 0.35);
      this.fernsB.grow(this.feet, 2.0, 0.35, 0.03);
      this.ring.cluster(this.feet, 0.95, 6, 0.95, { ring: true, tilt: 0.4, stagger: 0.06, grow: 0.1 });
      this.shake = 0.25;
      if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 2, from: ctx.from, color: FROST_CSS.body });
    }
    if (!f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.spear.shatter(12, 5, 0.3);
      this.ring.shatter(4, 4, 0.28);
      this.ferns.fade(0.8);
      this.fernsB.fade(0.8);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const after = t - IMPACT_T;
    const f = this.flags;

    // --- 0.05..0.5 The javelin grows in her hand, then flies; a pale streak trails it. ---
    if (this.spearId >= 0 && !f.shattered) {
      const base = this.spearBase(t, this.v1);
      this.spear.place(this.spearId, base, this.dir);
      const trail = Math.min(3.4, this.hand.distanceTo(base));
      const flown = t >= THROW_T;
      const op = flown ? 0.85 * (1 - THREE.MathUtils.clamp(after / 0.08, 0, 1)) : 0;
      this.streak.set(this.v2.copy(base).addScaledVector(this.dir, 0.3), this.v3.copy(base).addScaledVector(this.dir, -trail), 0.22, op);
    } else {
      this.streak.set(this.hit, this.hand, 0, 0);
    }

    this.screen.darken = 0.25 * smoothstep((t - 0.2) / 0.3) * (1 - smoothstep((t - SHATTER_T) / 0.8));

    // --- Impact: a pinpoint glint runs the javelin's edge for two frames, accent star, ground refraction, shake. ---
    const gk = after;
    this.spear.glint = gk >= 0 && gk < 1 / 30 ? 1 : 0;
    this.spear.glintAt = 0.35 + 0.6 * THREE.MathUtils.clamp(gk / (1 / 30), 0, 1);
    this.screen.impact = impactFrameAt(t, IMPACT_T, [1], 0.03);
    if (f.impacted) {
      const sp = StarBurst.pop(after, 0, 0.02);
      this.pop.set(this.hit, 1.0 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 2.2 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.25 * Math.exp(-after * 14);
    }

    // --- Rime climbs the body from the feet, then fades with the ferns. ---
    const climb = smoothstep(after / 0.3);
    const rimeOp = f.impacted ? 1 - smoothstep((t - SHATTER_T) / 0.6) : 0;
    this.sleeves.set(0, this.feet, 2.2, 1.0, f.impacted ? climb : 0, rimeOp);
  }
}

export const rimeSpearModule: EffectModule = {
  label: 'rime spear',
  category: 'hero: frost',
  targeting: { mode: 'enemy' },
  create: () => new RimeSpear(),
  telegraphs(effect) {
    const e = effect as RimeSpear;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.1, impact: IMPACT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RimeSpear;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as RimeSpear).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
