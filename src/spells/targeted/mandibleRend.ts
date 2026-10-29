import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { ClawSlash, HIVE, HIVE_CSS, HoneySplash, Swarm } from '../../effects/parts/hive';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Mandible Rend (hive kit, Q: melee double claw swipe). The claws spread and a few wasps buzz off them; at 0.3 s two
 * crossing serrated claw arcs sweep the 100 degree cone in front of Sirix with honey splashes and a green flash, and
 * everyone still inside the cone is hit and slowed. Clean by 1.2 s. See pipeline/designs/kit-hive.md.
 */
export interface MandibleRendSettings {
  damage: number;
  loop: boolean;
}

export const defaultMandibleRend = (): MandibleRendSettings => ({ damage: 40, loop: false });

// Timeline (seconds).
const HIT_T = 0.3;
const SCATTER_T = 0.6;
const DURATION = 1.2;
const CONE_ANGLE = 100;
const CONE_RADIUS = 3.2;

export class MandibleRend implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MandibleRendSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The cone of the last cast (from the caster toward the target). */
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: CONE_RADIUS, angle: CONE_ANGLE, dir: 0 };
  private time = 0;
  private flags = { hit: false, scatter: false };

  // Cast geometry.
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3(1, 0, 0);

  // Parts.
  private claws = new ClawSlash(6);
  private swarm = new Swarm(24, 0.5);
  private honey = new HoneySplash(16);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: HIVE.accent, core: 0xf4ffe8, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MandibleRendSettings = defaultMandibleRend()) {
    this.settings = settings;
    this.screen.impactColor.set(HIVE.hot);
    this.screen.tint.set(HIVE.dark);
    this.group.add(this.claws.mesh, this.swarm.mesh, this.honey.mesh, this.pop.mesh);
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
    // 0..0.15: the claws spread (a small claw crescent whirls on each hand) and a few wasps buzz off them.
    for (const s of [-1, 1]) {
      this.v1.copy(this.from).addScaledVector(this.right, 0.55 * s).addScaledVector(this.fwd, 0.35).setY(1.15);
      this.claws.slash(this.v1, this.right, 1.25, 130, 0.5 * s, 0.4, { width: 0.34, spin: -8 * s, sweep: 0.22 });
    }
    this.v1.copy(this.from).addScaledVector(this.fwd, 0.6).setY(1.2);
    this.swarm.set(this.v1, 0.6, 9);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.hit = this.flags.scatter = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(HIVE.dark);
    this.claws.reset();
    this.swarm.reset();
    this.honey.reset();
    this.pop.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.claws.update(dt);
    this.swarm.update(dt);
    this.honey.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.swing();
    }
    if (f.hit && !f.scatter && t >= SCATTER_T) {
      f.scatter = true;
      this.swarm.scatter(0.5, false, 3);
    }

    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.03);
    if (f.hit) {
      const after = t - HIT_T;
      const sp = StarBurst.pop(after, 0, 0.02);
      this.v1.copy(this.from).addScaledVector(this.fwd, 2.2).setY(1.1);
      this.pop.set(this.v1, 0.9 * sp.scale, sp.opacity, 0.2);
      this.shake = 0.12 * Math.exp(-after * 14);
    }
  }

  private swing() {
    const ctx = this.ctx;
    // Two crossing serrated claw arcs sweep the cone from opposite ends.
    this.v1.copy(this.from).setY(1.15);
    this.claws.slash(this.v1, this.fwd, 4.2, 110, 0.3, 0.6, { width: 1.0, sweep: 0.12 });
    this.claws.slash(this.v1, this.fwd, 4.2, 110, -0.3, 0.6, { width: 0.92, reverse: true, sweep: 0.12 });
    // The wasps follow the claws through the cone.
    this.swarm.count = 18;
    this.swarm.radius = 0.7;
    this.v1.copy(this.from).setY(1.2);
    this.v2.copy(this.from).addScaledVector(this.fwd, 3.0).setY(1.3);
    this.swarm.stream(this.v1, this.v2, 0.3);
    this.v2.copy(this.from).addScaledVector(this.fwd, 2.2).setY(0.9);
    this.honey.burst(this.v2, 9, 3.6, 0.15, 3.2);
    if (!ctx) return;
    // Re-check at the swing: everyone still inside the cone is hit and slowed.
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 2, from: ctx.from, color: HIVE_CSS.body, status: { kind: 'slow', seconds: 1.0 } });
    }
  }
}

export const mandibleRendModule: EffectModule = {
  label: 'mandible rend',
  category: 'hero: hive',
  targeting: { mode: 'enemies', maxTargets: 10 },
  create: () => new MandibleRend(),
  telegraphs(effect) {
    const e = effect as MandibleRend;
    if (!e.ctx) return [];
    return [{ shape: e.cone, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MandibleRend;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as MandibleRend).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
