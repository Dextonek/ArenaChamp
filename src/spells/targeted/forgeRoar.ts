import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { AshFlakes, ChainRing, FORGE, ForgeIron, PulseRing, QuenchSteam, Sparks } from '../../effects/parts/forge';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SLAM_SECONDS, fxOf } from '../../traits/forge';

/**
 * Forge Roar (forge kit v5, W: a self buff that arms a slam). He roars and heat rolls off him: at 0.3 s a ground ring of
 * heat and a refraction ring sweep out to 2.4 m, a cold-tinted star pops at his chest, sparks fly up and ash drifts down,
 * and a loop of chain links closes round his waist and turns slowly for the whole 3 s of the armour (+30%, the kit's
 * `buff`). The slam itself is the trait's (`src/traits/forge.ts`: his next basic attack, +35 damage and a 0.5 s knock-up):
 * this effect draws it armed. A white-hot hammer rides on his shoulder, following him live, until the slam is spent or the
 * 3 s run out (the trait writes `forgeFx.slamOffAt`, mirrored on the other screen); then it cools to black in 0.25 s with a
 * puff of steam. It deals no damage and has no telegraph. No speed anywhere. Clean by 3.5 s.
 * See pipeline/designs/kit-forge.md.
 */
export interface ForgeRoarSettings {
  loop: boolean;
}

export const defaultForgeRoar = (): ForgeRoarSettings => ({ loop: false });

// Timeline (seconds).
const ROAR_T = 0.3;
const ARMOUR_S = SLAM_SECONDS;
const COOL_S = 0.25;
const DURATION = ARMOUR_S + 0.6;
const RADIUS = 4; // the AI casts it when the enemy is inside this minus 0.6

export class ForgeRoar implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ForgeRoarSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private startMs = 0;
  private roared = false;
  /** Seconds (effect time) when the slam ended, or -1. */
  private offAt = -1;
  private center = new THREE.Vector3();

  private hammer = ForgeIron.hammer(0.85);
  private belt = new ChainRing(14);
  private ring = new PulseRing();
  private sparks = new Sparks(90);
  private ash = new AshFlakes(40);
  private steam = new QuenchSteam(10);
  private star = new StarBurst({ points: 8, inner: 0.3, color: FORGE.accent, core: FORGE.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ForgeRoarSettings = defaultForgeRoar()) {
    this.settings = settings;
    this.steam.life = 0.5;
    this.group.add(this.belt.mesh, this.hammer, this.ring.mesh, this.sparks.mesh, this.ash.mesh, this.steam.mesh, this.star.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return ROAR_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.from).setY(0);
  }

  play() {
    this.reset();
    this.playing = true;
    this.startMs = performance.now();
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.roared = false;
    this.offAt = -1;
    this.hammer.visible = false;
    this.belt.mesh.visible = false;
    this.ring.reset();
    this.sparks.reset();
    this.ash.reset();
    this.steam.reset();
    this.star.set(this.center, 0, 0);
    this.shock.set(this.center, 0, 0);
  }

  /** He walks; everything walks with him. */
  private follow() {
    const c = this.ctx?.caster.group.position;
    if (c) this.center.set(c.x, 0, c.z);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.sparks.update(dt);
    this.ash.update(dt);
    this.steam.update(dt);
    this.time += dt;
    const t = this.time;
    this.follow();

    // The slam ends when the trait says so (spent on an attack, or run out), else at the armour's end.
    const ctx = this.ctx;
    if (this.offAt < 0 && this.roared) {
      const spent = ctx ? fxOf(ctx.caster).slamOffAt >= this.startMs : false;
      if (spent || t >= ROAR_T + ARMOUR_S) {
        this.offAt = t;
        this.sparks.burst(this.v1.copy(this.hammer.position), this.v2.set(0, 1, 0), spent ? 12 : 4, 5, 1.2);
        this.steam.puff(this.v1.copy(this.hammer.position), 0.4);
      }
    }

    if (!this.roared && t >= ROAR_T) {
      this.roared = true;
      this.shake = 0.25;
      this.v1.copy(this.center).setY(1.25);
      this.sparks.burst(this.v1, this.v2.set(0, 1, 0), 24, 8, 1.1);
      this.ash.fall(this.center, 2.2, 14, 4, 1.4);
    }

    if (this.roared) {
      const a = t - ROAR_T;
      const sp = StarBurst.pop(a, 0.02, 0.06);
      this.star.set(this.v1.copy(this.center).setY(1.3), 1.2 * sp.scale, sp.opacity, 0.2);
      const g = smoothstep(a / 0.35);
      this.ring.set(this.center, 0.4 + 2.0 * g, 1 - g * g, 0.3);
      this.shock.set(this.center, 0.4 + 2.0 * g, 0.03 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * Math.exp(-dt * 10), 0);
    }

    // The chain belt: closes round his waist at the roar, turns slowly, loosens at the armour's end.
    if (this.roared && t < ROAR_T + ARMOUR_S + 0.25) {
      const a = t - ROAR_T;
      const close = smoothstep(a / 0.25);
      const end = smoothstep((a - ARMOUR_S) / 0.25);
      this.belt.mesh.visible = true;
      const heat = 0.9 * (1 - smoothstep(a / ARMOUR_S)) + 0.15;
      this.belt.place(this.center, (0.4 + 0.55 * close) * (1 - end * 0.9) + 0.02, 0.95, a * 1.6, heat, 0.04);
    } else {
      this.belt.mesh.visible = false;
    }

    // The slam hammer on his shoulder.
    if (this.roared) {
      const c = this.center;
      const yaw = ctx?.caster.group.rotation.y ?? 0;
      const rise = smoothstep((t - ROAR_T) / 0.2);
      this.hammer.visible = rise > 0.01 && (this.offAt < 0 || t < this.offAt + COOL_S);
      this.hammer.position.set(c.x + Math.cos(yaw) * 0.6, 1.8 * rise + 0.1, c.z - Math.sin(yaw) * 0.6);
      this.hammer.rotation.set(0, yaw + 0.5, -0.7);
      const cool = this.offAt < 0 ? 0 : smoothstep((t - this.offAt) / COOL_S);
      ForgeIron.heat(this.hammer, 0.6 + 0.4 * Math.sin(t * 9) * (1 - cool) + 0.4 - cool);
      if (this.offAt < 0 && Math.random() < 0.18) this.sparks.burst(this.v1.copy(this.hammer.position).setY(2.0), this.v2.set(0, 1, 0), 1, 3, 1.4);
    }

    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
    }
  }
}

export const forgeRoarModule: EffectModule = {
  label: 'forge roar',
  category: 'hero: forge',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new ForgeRoar(),
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ForgeRoar;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    f.add((effect as ForgeRoar).settings, 'loop');
  },
};
