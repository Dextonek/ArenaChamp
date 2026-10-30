import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SKY_CSS, SpeedLines, WindCrescent } from '../../effects/parts/sky';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Gale Edge (sky kit, Q: melee swing). Wind gathers round his sword arm in a short spiral, then at 0.3 s two crossing
 * pale crescents sweep the 100 degree cone in front of him with speed lines, a blossom-pink flash and a few leaves
 * blown forward; everyone still inside the cone is hit. Clean by 1.2 s. See pipeline/designs/kit-sky.md.
 */
export interface GaleEdgeSettings {
  damage: number;
  loop: boolean;
}

export const defaultGaleEdge = (): GaleEdgeSettings => ({ damage: 44, loop: false });

// Timeline (seconds).
const HIT_T = 0.3;
const DURATION = 1.2;
const CONE_ANGLE = 100;
const CONE_RADIUS = 3.2;

export class GaleEdge implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GaleEdgeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The cone of the last cast (from the caster toward the target). */
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: CONE_RADIUS, angle: CONE_ANGLE, dir: 0 };
  private time = 0;
  private hit = false;

  // Cast geometry.
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3(1, 0, 0);

  // Parts.
  private crescents = new WindCrescent(6);
  private gather = new GustRibbon(28);
  private lines = new SpeedLines(24);
  private leaves = new Leaves(16);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: SKY.accent, core: 0xfff0f5, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: GaleEdgeSettings = defaultGaleEdge()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    this.group.add(this.crescents.mesh, this.gather.mesh, this.lines.mesh, this.leaves.mesh, this.pop.mesh);
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
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.right.set(-Math.cos(ctx.aim), 0, Math.sin(ctx.aim));
    this.cone = { kind: 'cone', x: ctx.from.x, z: ctx.from.z, radius: CONE_RADIUS, angle: CONE_ANGLE, dir: ctx.aim };
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).addScaledVector(this.fwd, 2).setY(1.1);
  }

  play() {
    this.reset();
    this.playing = true;
    // 0..0.15: wind gathers on the sword arm.
    this.v1.copy(this.from).addScaledVector(this.right, 0.45).addScaledVector(this.fwd, 0.3).setY(0.45);
    this.gather.spiral(this.v1, 0.34, 1.0, 2, 0.4, 0.14);
    // A short crescent trail whirling on the sword arm so the swing direction reads.
    this.v1.copy(this.from).addScaledVector(this.right, 0.5).setY(1.2);
    this.crescents.slash(this.v1, this.right, 1.1, 140, 0.5, 0.4, { width: 0.3, spin: -7, sweep: 0.25 });
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hit = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(SKY.dark);
    this.crescents.reset();
    this.gather.reset();
    this.lines.reset();
    this.leaves.reset();
    this.pop.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crescents.update(dt);
    this.gather.update(dt);
    this.lines.update(dt);
    this.leaves.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;

    if (!this.hit && t >= HIT_T) {
      this.hit = true;
      this.swing();
    }

    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.03);
    if (this.hit) {
      const after = t - HIT_T;
      const sp = StarBurst.pop(after, 0, 0.02);
      this.v1.copy(this.from).addScaledVector(this.fwd, 2.3).setY(1.1);
      this.pop.set(this.v1, 0.8 * sp.scale, sp.opacity, 0.2);
      this.shake = 0.12 * Math.exp(-after * 14);
    }
  }

  private swing() {
    const ctx = this.ctx;
    // Two crossing crescents sweep the cone from opposite ends.
    this.v1.copy(this.from).setY(1.15);
    this.crescents.slash(this.v1, this.fwd, 3.0, 110, 0.3, 0.55, { width: 0.65, sweep: 0.12 });
    this.crescents.slash(this.v1, this.fwd, 3.0, 110, -0.3, 0.55, { width: 0.6, reverse: true, sweep: 0.12 });
    this.v2.copy(this.from).addScaledVector(this.fwd, 1.4).setY(1.1);
    this.lines.burst(this.v2, this.fwd, 9, 1.8);
    this.v2.copy(this.from).addScaledVector(this.fwd, 1.5).setY(0.9);
    this.leaves.blow(this.v2, this.fwd, 8, 7);
    if (!ctx) return;
    // Re-check at the swing: everyone still inside the cone is hit.
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 2, from: ctx.from, color: SKY_CSS.body });
    }
  }
}

export const galeEdgeModule: EffectModule = {
  label: 'gale edge',
  category: 'hero: sky',
  targeting: { mode: 'enemies', maxTargets: 10 },
  create: () => new GaleEdge(),
  telegraphs(effect) {
    const e = effect as GaleEdge;
    if (!e.ctx) return [];
    return [{ shape: e.cone, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GaleEdge;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as GaleEdge).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
