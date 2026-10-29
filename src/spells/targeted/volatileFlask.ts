import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { ALCHEMY, ALCHEMY_CSS, AcidPool, Fumes, Flask, GlassShards } from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Volatile Flask (alchemy kit, Q: quick lob). She plucks a flask from her coat, lobs it in a high spinning arc with a
 * thin fume trail and it shatters on the target: glass shards, an acid splash with bubbles, a magenta reaction spark,
 * a fume puff. One burn tick, then the splash drains to a stain. See pipeline/designs/kit-alchemy.md.
 */
export interface VolatileFlaskSettings {
  damage: number;
  burn: number;
  loop: boolean;
}

export const defaultVolatileFlask = (): VolatileFlaskSettings => ({ damage: 45, burn: 12, loop: false });

// Timeline (seconds).
const THROW_T = 0.2;
const HIT_T = 0.55;
const TICK_T = 1.2;
const DURATION = 1.8;
const FLASK_SCALE = 1.6;

export class VolatileFlask implements Effect {
  readonly group = new THREE.Group();
  readonly settings: VolatileFlaskSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private fwd = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 1.4, 13);
  private feet = new THREE.Vector3(0, 0, -8);
  private hit = new THREE.Vector3(0, 1.1, -8);

  private flags = { hit: false, tick: false, drain: false };
  private trailTimer = 0;

  // Parts.
  private flask = new Flask();
  private shards = new GlassShards({ max: 40 });
  private pool = new AcidPool(24);
  private fumes = new Fumes(8);
  private spark = new StarBurst({ points: 8, inner: 0.3, color: ALCHEMY.accent, core: ALCHEMY.core, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: VolatileFlaskSettings = defaultVolatileFlask()) {
    this.settings = settings;
    this.screen.tint.set(ALCHEMY.dark);
    this.pool.boil = 7;
    this.pool.bubbleSize = 0.28;
    this.group.add(this.pool.mesh, this.shards.mesh, this.fumes.mesh, this.flask.mesh, this.spark.mesh);
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
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).addScaledVector(this.side, 0.35).setY(1.35);
    this.feet.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.hit.copy(this.feet).setY(1.1);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.hit);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.trailTimer = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.flask.reset();
    this.shards.reset();
    this.pool.reset();
    this.fumes.reset();
    this.spark.set(this.hit, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.shards.update(dt);
    this.pool.update(dt);
    this.fumes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.reset();
      this.playing = false;
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.flask.mesh.visible = false;
      this.shards.burst(this.hit, 8, 6.5, { size: 0.3, life: 0.6 });
      this.pool.spread(this.feet, 1.8, 0.2);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random(), d = 0.3 + Math.random() * 0.55;
        this.pool.bubbleAt(this.feet.x + Math.cos(a) * d, this.feet.z + Math.sin(a) * d, 0.2 + Math.random() * 0.14, 0.5 + Math.random() * 0.4);
      }
      this.fumes.puff(this.v1.copy(this.feet).setY(0.3), 0.4, undefined, 1.2);
      this.shake = 0.25;
      if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 1, from: ctx.from, color: ALCHEMY_CSS.body });
    }
    if (!f.tick && t >= TICK_T) {
      f.tick = true;
      this.pool.drain(0.6);
      this.fumes.puff(this.v1.copy(this.feet).setY(0.3), 0.3, undefined, 1.2);
      if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.burn, knock: 0, from: ctx.from, color: ALCHEMY_CSS.body });
    }

    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const fl = this.flask;

    // --- 0..0.2 Pluck: the flask appears in her hand, liquid sloshing. 0.2..0.55 lob in a high spinning arc. ---
    if (t < HIT_T) {
      fl.mesh.visible = true;
      fl.scale = FLASK_SCALE * easeOut(t / 0.14);
      fl.slosh(t, 1);
      if (t < THROW_T) {
        fl.mesh.position.copy(this.hand);
        fl.mesh.rotation.set(0, 0, Math.sin(t * 20) * 0.1);
      } else {
        fl.lob(this.hand, this.hit, 3.4, (t - THROW_T) / (HIT_T - THROW_T));
        this.trailTimer += dt;
        while (this.trailTimer >= 0.05) {
          this.trailTimer -= 0.05;
          this.fumes.puff(fl.mesh.position, 0.14, undefined, 0.5);
        }
      }
    }

    // --- Hit: the magenta reaction spark for two frames. ---
    if (this.flags.hit) {
      const sp = StarBurst.pop(t - HIT_T, 0, 0.02);
      this.spark.set(this.v1.copy(this.hit), 1.0 * sp.scale, sp.opacity, 0.2);
      this.shake = 0.25 * Math.exp(-(t - HIT_T) * 14);
    }
  }
}

function easeOut(x: number) {
  const k = Math.min(1, Math.max(0, x));
  return 1 - Math.pow(1 - k, 3);
}

export const volatileFlaskModule: EffectModule = {
  label: 'volatile flask',
  category: 'hero: alchemy',
  targeting: { mode: 'enemy' },
  create: () => new VolatileFlask(),
  telegraphs(effect) {
    const e = effect as VolatileFlask;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 1.8 }, start: 0.1, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as VolatileFlask;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as VolatileFlask).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'burn', 1, 60, 1);
  },
};
