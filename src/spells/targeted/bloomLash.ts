import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { GROVE, GROVE_CSS, Bloom, Petals, Pollen, SpiralVine } from '../../effects/parts/grove';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Bloom Lash (grove kit, Q: quick strike): Fenna sweeps her staff and a thick spiral vine bursts from the floor at her
 * feet, coils across the ground to the target and up around it. A flower bursts open on top, a pink star, a burst of
 * petals. The flower sheds, the vine withers and sinks. See pipeline/designs/kit-grove.md.
 */
export interface BloomLashSettings {
  damage: number;
  loop: boolean;
}

export const defaultBloomLash = (): BloomLashSettings => ({ damage: 54, loop: false });

// Timeline (seconds).
const GROW_T = 0.5; // the vine reaches the top of the target
const HIT_T = 0.5;
const SHED_T = 0.9;
const DURATION = 1.6;

const HEAD_H = 2.05; // flower height above the target's feet

export class BloomLash implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BloomLashSettings;
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
  private side = new THREE.Vector3(1, 0, 0);
  private base = new THREE.Vector3(0.7, 0.1, 14);
  private feet = new THREE.Vector3(0, 0, -8);
  private travel = new THREE.Vector3(0, 0, -1);
  private perp = new THREE.Vector3(1, 0, 0);
  private theta0 = 0;
  private top = new THREE.Vector3(0, HEAD_H, -8);

  // Event flags.
  private flags = { impacted: false, shed: false };

  // Parts.
  private vine = new SpiralVine(64, 6, 6);
  private bloom = new Bloom();
  private petals = new Petals(20);
  private pollen = new Pollen(24);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: GROVE.accent, core: 0xfff0f6, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: BloomLashSettings = defaultBloomLash()) {
    this.settings = settings;
    this.screen.impactColor.set(GROVE.bark);
    this.petals.life = 1.0;
    this.group.add(this.vine.mesh, this.bloom.mesh, this.petals.mesh, this.pollen.mesh, this.pop.mesh, this.groundShock.mesh);
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
    this.from.copy(ctx.from).setY(0);
    this.feet.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.base.copy(this.from).addScaledVector(this.side, 0.7).addScaledVector(this.fwd, 0.3).setY(0.1);
    this.travel.set(this.feet.x - this.base.x, 0, this.feet.z - this.base.z);
    if (this.travel.lengthSq() < 1e-4) this.travel.copy(this.fwd);
    this.travel.normalize();
    this.perp.set(this.travel.z, 0, -this.travel.x);
    // The coil around the target starts on the side the vine arrives from.
    this.theta0 = Math.atan2(-this.travel.z, -this.travel.x);
    this.top.copy(this.feet).setY(HEAD_H);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.v1.copy(this.feet).setY(1.2));
  }

  play() {
    this.reset();
    this.playing = true;
    this.vine.growAlong(this.path, 0.2, GROW_T);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.impacted = this.flags.shed = false;
    clearScreenFx(this.screen);
    this.vine.reset();
    this.bloom.reset();
    this.petals.reset();
    this.pollen.reset();
    this.pop.set(this.top, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.vine.update(dt);
    this.bloom.update(dt);
    this.petals.update(dt);
    this.pollen.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.impacted && t >= HIT_T) {
      f.impacted = true;
      this.bloom.open(this.top, 1.2, 0.22);
      this.petals.burst(this.top, 9, 3.6);
      this.pollen.puff(this.top, 8);
      this.shake = 0.12;
      if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 3, from: ctx.from, color: GROVE_CSS.body });
    }
    if (!f.shed && t >= SHED_T) {
      f.shed = true;
      this.bloom.shed(0.5);
      this.vine.wither(0.5, 0.05);
    }

    this.layout();
  }

  /**
   * The vine: a small helix along the ground from her feet to the target (3 turns), then two coils up around the
   * target to head height; the two are blended over u 0.46..0.6.
   */
  private path = (u: number, out: THREE.Vector3) => {
    const w = Math.min(1, u / 0.5);
    const aa = w * 3 * Math.PI * 2;
    const rr = 0.32 * Math.min(1, w * 5);
    const cx = this.base.x + (this.feet.x - this.base.x) * w + this.perp.x * Math.cos(aa) * rr;
    const cz = this.base.z + (this.feet.z - this.base.z) * w + this.perp.z * Math.cos(aa) * rr;
    const cy = 0.1 + (0.42 + Math.sin(aa) * 0.28) * Math.min(1, w * 6);
    const v = Math.min(1, Math.max(0, (u - 0.46) / 0.54));
    const th = this.theta0 + v * 2 * Math.PI * 2;
    const R = 0.66 - 0.12 * v;
    const bx = this.feet.x + Math.cos(th) * R;
    const bz = this.feet.z + Math.sin(th) * R;
    const by = 0.3 + (HEAD_H - 0.25) * Math.pow(v, 0.9);
    const b = smoothstep((u - 0.46) / 0.14);
    return out.set(cx + (bx - cx) * b, cy + (by - cy) * b, cz + (bz - cz) * b);
  };

  private layout() {
    const t = this.time;
    const after = t - HIT_T;

    // --- Hit: one dark impact frame, pink accent star (2 frames), ground refraction, shake. ---
    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.03);
    if (this.flags.impacted) {
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.v1.copy(this.top).setY(HEAD_H + 0.1), 1.0 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 2.0 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.12 * Math.exp(-after * 14);
    }
  }
}

export const bloomLashModule: EffectModule = {
  label: 'bloom lash',
  category: 'hero: grove',
  targeting: { mode: 'enemy' },
  create: () => new BloomLash(),
  telegraphs(effect) {
    const e = effect as BloomLash;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.1, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BloomLash;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as BloomLash).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
