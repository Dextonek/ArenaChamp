import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { GROVE, Bloom, Petals, Pollen, SpiralVine } from '../../effects/parts/grove';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { gardenLive, plantFlower } from '../../traits/grove';

/**
 * Pollen Glide (grove kit v5, E: a dash, `dash: true`). Fenna glides up to 6 m toward the aim (`distance` setting; a shorter aim
 * gives a shorter glide, 2 m at least) in 0.3 s (`ctx.moveCaster`, clamped into the ring and out of the walls), on a gust of
 * gold pollen: a puff and a pale ring where she lifted off, a flat spiral vine that grows along the path and withers behind her,
 * a stream of petals and a trail of motes. Where she lands a flower grows (`plantFlower` in `src/traits/grove.ts`, drawn there
 * as a ground mark on both screens) with a burst of petals, pollen and a ring. No damage, no zone, no heal: the gain is the
 * flower and the distance. Clean by 1.3 s.
 * Network duels: the other screen has no `moveCaster` (her client streams the glide), so there the path and the flower use
 * the nominal 6 m from `sentFrom` along the aim. Without a trait (the VFX tool) the effect shows its own bloom for 2.5 s.
 */
export interface PollenGlideSettings {
  /** Metres of the glide (the aim may shorten it). */
  distance: number;
  loop: boolean;
}

export const defaultPollenGlide = (): PollenGlideSettings => ({ distance: 6, loop: false });

// Timeline (seconds).
const GLIDE_S = 0.3;
const DURATION = 1.3;
const MIN_STEP = 2;
const LOCAL_BLOOM_S = 2.5;

export class PollenGlide implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PollenGlideSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private endT = DURATION;
  private arrived = false;
  private localAt = -1;
  private localShed = false;

  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private len = 6;

  private trail = new SpiralVine(30, 6, 3);
  private bloom = new Bloom();
  private petals = new Petals(40);
  private pollen = new Pollen(48);
  private lift = new StarBurst({ points: 6, inner: 0.25, color: GROVE.hot, core: GROVE.core, additive: false });
  private pop = new StarBurst({ points: 8, inner: 0.3, color: GROVE.accent, core: GROVE.core, additive: false });
  private ringA = new ShockRefraction({ facing: 'ground' });
  private ringB = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: PollenGlideSettings = defaultPollenGlide()) {
    this.settings = settings;
    this.screen.impactColor.set(GROVE.hot);
    this.group.add(this.trail.mesh, this.bloom.mesh, this.petals.mesh, this.pollen.mesh, this.lift.mesh, this.pop.mesh, this.ringA.mesh, this.ringB.mesh);
    this.reset();
  }

  get duration() {
    return this.endT;
  }

  get impactTime() {
    return GLIDE_S;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    const d = this.v1.length();
    if (d < 0.3) this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    else this.dir.copy(this.v1).multiplyScalar(1 / d);
    this.len = d < 0.3 ? this.settings.distance : THREE.MathUtils.clamp(d, MIN_STEP, this.settings.distance);
    this.end.copy(this.start).addScaledVector(this.dir, this.len);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The glide: she slides to the spot (the engine clamps it into the ring and out of the walls); the path is drawn to where she lands.
    if (ctx.moveCaster) this.end.copy(ctx.moveCaster(this.end, GLIDE_S)).setY(0);
    const a = this.start.clone(), b = this.end.clone();
    const side = new THREE.Vector3(-this.dir.z, 0, this.dir.x);
    // A flat spiral vine along the path, growing as she goes and withering behind her.
    this.trail.growAlong((u, out) => out.lerpVectors(a, b, u).addScaledVector(side, Math.sin(u * 14) * 0.28).setY(0.18 + 0.12 * Math.cos(u * 14)), 0.22, GLIDE_S);
    this.trail.wither(0.5, GLIDE_S + 0.1);
    // Lift-off: a gold star, a puff of pollen and a petal stream along the glide.
    this.pollen.puff(this.v1.copy(this.start).setY(0.7), 12);
    this.petals.stream(this.v1.copy(this.start).setY(1.0), this.v2.copy(this.end).setY(0.5), 12, GLIDE_S);
    for (let i = 1; i <= 4; i++) this.pollen.puff(this.v1.lerpVectors(this.start, this.end, i / 5).setY(0.8), 4);
    this.shake = 0.06;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.endT = DURATION;
    this.arrived = false;
    this.localAt = -1;
    this.localShed = false;
    clearScreenFx(this.screen);
    this.trail.reset();
    this.bloom.reset();
    this.petals.reset();
    this.pollen.reset();
    this.lift.set(this.start, 0, 0);
    this.pop.set(this.end, 0, 0);
    this.ringA.set(this.start, 0, 0);
    this.ringB.set(this.end, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.trail.update(dt);
    this.bloom.update(dt);
    this.petals.update(dt);
    this.pollen.update(dt);
    this.time += dt;
    if (this.time >= this.endT) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;

    // The ring where she left, growing at once, and the lift-off star.
    const lp = THREE.MathUtils.clamp(t / 0.35, 0, 1);
    this.ringA.set(this.start, 0.3 + 1.8 * lp, 0.05 * (1 - lp) * (1 - lp));
    const lf = StarBurst.pop(t, 0, 0.05);
    this.lift.set(this.v1.copy(this.start).setY(1.0), 0.8 * lf.scale + 1e-3, lf.opacity, 0.2);

    if (!this.arrived && t >= GLIDE_S) {
      this.arrived = true;
      this.land();
    }
    if (this.arrived) {
      const after = t - GLIDE_S;
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.v1.copy(this.end).setY(1.1), 0.8 * sp.scale + 1e-3, sp.opacity, 0.2);
      const rp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.ringB.set(this.end, 0.3 + 1.6 * rp, 0.045 * (1 - rp) * (1 - rp));
      this.shake = Math.max(this.shake * 0.9, 0.1 * Math.exp(-after * 14));
    } else this.shake *= 0.9;

    if (this.localAt >= 0 && !this.localShed && t >= this.localAt + LOCAL_BLOOM_S) {
      this.localShed = true;
      this.bloom.shed(0.6);
    }
  }

  /** She lands: the flower grows where she stands (the trait's list, both screens) with petals, pollen and a ring. */
  private land() {
    const ctx = this.ctx;
    if (ctx) plantFlower(ctx.caster, this.end.x, this.end.z);
    this.petals.burst(this.v1.copy(this.end).setY(0.4), 10, 3.4);
    this.pollen.puff(this.v1.copy(this.end).setY(0.6), 12);
    if (!ctx || !gardenLive(ctx.caster)) {
      // No trait draws the flower here (the VFX tool): show a bloom of our own.
      this.localAt = this.time;
      this.endT = Math.max(this.endT, this.time + LOCAL_BLOOM_S + 0.7);
      this.bloom.open(this.v1.copy(this.end).setY(0), 0.85, 0.45);
    }
  }
}

export const pollenGlideModule: EffectModule = {
  label: 'pollen glide',
  category: 'hero: grove',
  // A glide toward the aim, no area: the radius only lets the AI cast it when the target is within reach.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new PollenGlide(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PollenGlide;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as PollenGlide).settings;
    f.add(s, 'loop');
    f.add(s, 'distance', 2, 8, 0.5);
  },
};
