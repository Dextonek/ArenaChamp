import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SpeedLines, WindCrescent, WindWraith } from '../../effects/parts/sky';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { STEP_GRACE } from '../../traits/sky';

/**
 * Feather Step (sky kit, E: a dash, two charges). Zephyr steps up to 4 m toward the aim (`distance` setting; a shorter aim
 * gives a shorter step, 2 m at least) in `STEP_GRACE` (0.2 s, shared with his trait: he is untouchable for exactly that
 * long, enough to slip a bolt). He is gone from where he stood: a pale refraction ring and a ring of speed lines mark the
 * spot, and three jade afterimages of him stand along the path and fade one after another. A thin gust ribbon and a
 * horizontal crescent run the path, feathers and a few pink petals blow back, and where he lands a small star pops with
 * a second ring. No damage and no zone: the gain is the trait's (a Gust and a fresh basic attack). Clean by 1.0 s.
 * Network duels: the other screen has no `moveCaster` (his client streams the step), so the path is drawn from `sentFrom` and
 * the aim.
 */
export interface FeatherStepSettings {
  /** Metres of the step (the aim may shorten it). */
  distance: number;
  loop: boolean;
}

export const defaultFeatherStep = (): FeatherStepSettings => ({ distance: 4, loop: false });

const DURATION = 1.0;
const MIN_STEP = 2;

export class FeatherStep implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FeatherStepSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private arrived = false;

  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private len = 4;

  // Parts.
  private crescents = new WindCrescent(4);
  private ribbon = new GustRibbon(28);
  private lines = new SpeedLines(32);
  private leaves = new Leaves(20);
  private wraith = new WindWraith(4);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: SKY.accent, core: 0xfff0f5, additive: false });
  private ringA = new ShockRefraction({ facing: 'ground' });
  private ringB = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: FeatherStepSettings = defaultFeatherStep()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.group.add(
      this.crescents.mesh, this.ribbon.mesh, this.lines.mesh, this.leaves.mesh, this.wraith.mesh, this.pop.mesh, this.ringA.mesh, this.ringB.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return STEP_GRACE;
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
    // The step: he slides to the spot (the engine clamps it into the ring and out of the walls) and the path is drawn to where he lands.
    if (ctx.moveCaster) this.end.copy(ctx.moveCaster(this.end, STEP_GRACE)).setY(0);
    // Afterimages: one where he stood, two along the path, each a beat later.
    this.wraith.show(this.v1.copy(this.start), this.dir, 0.5, 2, 0.8, 0.8);
    this.wraith.show(this.v1.lerpVectors(this.start, this.end, 0.4), this.dir, 0.4, 2, 0.8, 0.55);
    this.wraith.show(this.v1.lerpVectors(this.start, this.end, 0.75), this.dir, 0.3, 2, 0.8, 0.35);
    // The streak, the crescent along the path and the speed lines.
    this.v1.copy(this.start).setY(0.9);
    this.v2.lerpVectors(this.start, this.end, 0.5).setY(1.2);
    this.ribbon.along([this.v1.clone(), this.v2.clone(), this.v1.copy(this.end).setY(0.9)], 0.2, 0.4);
    this.crescents.slash(this.v2.setY(1.0), this.dir, 1.6, 110, 0.12, 0.45, { width: 0.4, sweep: 0.1, tone: 0.3 });
    this.v1.copy(this.start).setY(0);
    this.lines.sweep(this.v1, this.end, 10, 2.0);
    this.v1.copy(this.start).setY(1.0);
    this.v2.copy(this.dir).negate();
    this.lines.burst(this.v1, this.v2, 6, 1.4);
    this.leaves.blow(this.v1, this.v2, 8, 5);
    this.shake = 0.06;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.arrived = false;
    clearScreenFx(this.screen);
    this.crescents.reset();
    this.ribbon.reset();
    this.lines.reset();
    this.leaves.reset();
    this.wraith.reset();
    this.pop.set(this.end, 0, 0);
    this.ringA.set(this.start, 0, 0);
    this.ringB.set(this.end, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crescents.update(dt);
    this.ribbon.update(dt);
    this.lines.update(dt);
    this.leaves.update(dt);
    this.wraith.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;

    // The ring where he left, growing at once.
    const lp = THREE.MathUtils.clamp(t / 0.35, 0, 1);
    this.ringA.set(this.start, 0.3 + 1.8 * lp, 0.05 * (1 - lp) * (1 - lp));

    if (!this.arrived && t >= STEP_GRACE) {
      this.arrived = true;
      // Where he lands: a pink-tinged leaf puff blown along the step.
      this.v1.copy(this.end).setY(0.6);
      this.leaves.blow(this.v1, this.dir, 6, 4);
      this.shake = 0.1;
    }
    if (this.arrived) {
      const after = t - STEP_GRACE;
      const sp = StarBurst.pop(after, 0, 0.03);
      this.v1.copy(this.end).setY(1.1);
      this.pop.set(this.v1, 0.7 * sp.scale, sp.opacity, 0.2);
      const rp = THREE.MathUtils.clamp(after / 0.35, 0, 1);
      this.ringB.set(this.end, 0.3 + 1.4 * rp, 0.045 * (1 - rp) * (1 - rp));
      this.shake = Math.max(this.shake, 0.1 * Math.exp(-after * 14));
    }
  }
}

export const featherStepModule: EffectModule = {
  label: 'feather step',
  category: 'hero: sky',
  // A step toward the aim, no area: the radius only lets the AI cast it when the target is within reach.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new FeatherStep(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as FeatherStep;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as FeatherStep).settings;
    f.add(s, 'loop');
    f.add(s, 'distance', 2, 8, 0.5);
  },
};
