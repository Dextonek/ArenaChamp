import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { INK, InkBleed, Seal, Splatter } from '../../effects/parts/ink';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SEAL_ARM, SEAL_R, addSeal, inkLive } from '../../traits/ink';

/**
 * Seal of Binding (ink kit v5, W: a trap). Ground aim, 8 m. A stone vermilion seal drops on the spot and presses a 2 m seal
 * into the ground (it lands at 0.4 s, a splash of ink and a bleed of rice paper under it); it is added to her ink at the cast
 * (`addSeal`, traits/ink.ts, on both screens) and armed 0.5 s after it: a pale ring and a faint dark disc while it dries,
 * then a vermilion ring with a flash. It stays for 6 s (the ground mark draws it, so a later cast of this spell cannot cut it
 * off). An enemy who steps in (within 1 m) is rooted 1 s and Stained and the seal is used up (the trait's `victimTick`). Once
 * armed it counts as a short stroke across its centre for crossings. No damage and no telegraph: the hit is the trait's, the
 * warning is the drying seal itself (0.5 s, the time to step out of 1 m). Clean by 1.4 s (6.6 s in the VFX tool, where no
 * trait draws the ink).
 */
export interface SealOfBindingSettings {
  loop: boolean;
}

export const defaultSealOfBinding = (): SealOfBindingSettings => ({ loop: false });

// Timeline (seconds).
const LAND_T = 0.4;
const FALL_FROM = 3;
const LIVE_END = 1.4;
const TOOL_END = 6.6;
const SEAL_SIZE = 2 * SEAL_R;

export class SealOfBinding implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SealOfBindingSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private len = LIVE_END;
  private spot = new THREE.Vector3();
  private landed = false;
  private armedShown = false;
  private faded = false;

  private seal = new Seal(1);
  private bleed = new InkBleed();
  private splat = new Splatter(24);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: INK.accent, core: 0xffffff, additive: false });
  private armPop = new StarBurst({ points: 12, inner: 0.35, color: INK.accent, core: 0xffffff, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: SealOfBindingSettings = defaultSealOfBinding()) {
    this.settings = settings;
    this.group.add(this.bleed.mesh, this.seal.mesh, this.splat.mesh, this.pop.mesh, this.armPop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return this.len;
  }

  get impactTime() {
    return SEAL_ARM;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.spot.copy(ctx.point).setY(0);
    this.len = inkLive(ctx.caster) ? LIVE_END : TOOL_END;
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // Her ink gets the seal now: it arms `SEAL_ARM` s after the cast, on both screens.
    addSeal(ctx.caster, this.spot.x, this.spot.z);
    this.seal.fall(this.spot, SEAL_SIZE * 0.9, FALL_FROM, LAND_T);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = this.armedShown = this.faded = false;
    this.seal.reset();
    this.bleed.reset();
    this.splat.reset();
    this.pop.set(this.spot, 0, 0);
    this.armPop.set(this.spot, 0, 0);
    this.shock.set(this.spot, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.seal.update(dt);
    this.bleed.update(dt);
    this.splat.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;

    if (!this.landed && t >= LAND_T) {
      this.landed = true;
      this.v1.copy(this.spot);
      this.bleed.spread(this.v1, SEAL_R * 1.15, 0.3, { ink: 0.5 });
      this.v1.setY(0.3);
      this.v2.set(0, 0.3, 0);
      this.splat.fling(this.v1, this.v2, 10, 4, { size: 0.12, spread: 2.2, up: 0.9, life: 0.7 });
      this.shake = 0.18;
    }
    if (this.landed) {
      const a = t - LAND_T;
      const sp = StarBurst.pop(a, 0, 0.1);
      this.pop.set(this.v1.copy(this.spot).setY(0.3), 0.8 * sp.scale, sp.opacity, 0.3);
      this.shake = Math.max(this.shake * Math.exp(-dt * 12), 0);
    }
    // It arms: a vermilion flash and a ring that runs out to the seal's edge.
    if (!this.armedShown && t >= SEAL_ARM) this.armedShown = true;
    if (this.armedShown) {
      const a = t - SEAL_ARM;
      const sp = StarBurst.pop(a, 0.02, 0.15);
      this.armPop.set(this.v1.copy(this.spot).setY(0.35), 1.1 * sp.scale, sp.opacity, a * 2);
      const g = THREE.MathUtils.clamp(a / 0.35, 0, 1);
      this.shock.set(this.spot, 0.3 + SEAL_R * 1.4 * g, 0.03 * (1 - g) * (1 - g));
    }
    // The ground mark takes over the seal's look; the decals fade (in the VFX tool they stay for the seal's 6 s).
    const fadeAt = this.len - 0.5;
    if (!this.faded && t >= (inkLive(this.ctx?.caster ?? this) ? 0.9 : fadeAt)) {
      this.faded = true;
      this.bleed.fade(0.4);
      this.seal.fade(0.4);
    }
    if (t >= this.len) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }
}

export const sealOfBindingModule: EffectModule = {
  label: 'seal of binding',
  category: 'hero: ink',
  targeting: { mode: 'ground', radius: SEAL_R },
  create: () => new SealOfBinding(),
  // No zone: the root is the trait's hit, and the warning is the seal itself drying for 0.5 s.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SealOfBinding;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    f.add((effect as SealOfBinding).settings, 'loop');
  },
};
