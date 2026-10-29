import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { SAND, SAND_CSS, Dust, SandPool, SandRibbon, SandstoneBlocks } from '../../effects/parts/sand';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Sand Lash (sand kit, Q: quick strike): Sefu sweeps his crook and a thick ribbon of sand pours out of the floor at
 * his side, arcs over and cracks across to the target like a whip. The tip wraps once around the legs and sets into a
 * sandstone shackle (four carved shards) that crumbles to dust. See pipeline/designs/kit-sand.md.
 */
export interface SandLashSettings {
  damage: number;
  loop: boolean;
}

export const defaultSandLash = (): SandLashSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const POUR_END_T = 0.2;
const HIT_T = 0.5;
const SET_T = 0.62; // the wrap has set into shards
const CRUMBLE_T = 0.9;
const DURATION = 1.6;

const SHARDS = 4;

export class SandLash implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SandLashSettings;
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
  private base = new THREE.Vector3(0.9, 0.05, 14);
  private c1 = new THREE.Vector3();
  private c2 = new THREE.Vector3();
  private feet = new THREE.Vector3(0, 0, -8);
  private hit = new THREE.Vector3(0, 0.7, -8);
  private wobble = 1;

  // Event flags.
  private flags = { puff0: false, impacted: false, set: false, crumbled: false };

  // Parts.
  private whipRibbon = new SandRibbon(30, 8, 20);
  private wrapRibbon = new SandRibbon(28, 8, 4);
  private shards = new SandstoneBlocks(SHARDS + 2);
  private dust = new Dust(6, 24);
  private pool = new SandPool();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: SAND.accent, core: 0xe8fffc, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: SandLashSettings = defaultSandLash()) {
    this.settings = settings;
    this.screen.impactColor.set(SAND.stone);
    this.wrapRibbon.shed = 0;
    this.shards.dust = this.dust;
    this.shards.dustEvery = 2;
    this.dust.life = 0.55;
    this.group.add(
      this.pool.mesh, this.whipRibbon.mesh, this.wrapRibbon.mesh, this.shards.mesh, this.dust.mesh, this.pop.mesh,
      this.groundShock.mesh,
    );
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
    this.base.copy(this.from).addScaledVector(this.side, 0.9).addScaledVector(this.fwd, 0.3).setY(0.05);
    this.hit.copy(this.feet).setY(0.7);
    const dist = this.base.distanceTo(this.hit);
    this.c1.copy(this.base).addScaledVector(this.fwd, dist * 0.22).setY(3.0);
    this.c2.copy(this.hit).addScaledVector(this.fwd, -dist * 0.18).setY(2.2);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.hit);
    this.pool.place(this.feet);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.wobble = 1;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.whipRibbon.reset();
    this.wrapRibbon.reset();
    this.shards.reset();
    this.dust.reset();
    this.pool.reset();
    this.pop.set(this.hit, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.whipRibbon.update(dt);
    this.wrapRibbon.update(dt);
    this.shards.update(dt);
    this.dust.update(dt);
    this.pool.update(dt);
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
    if (!f.puff0 && t >= 0.05) {
      f.puff0 = true;
      this.dust.puff(this.v1.copy(this.base).setY(0.3), 0.6);
    }
    if (!f.impacted && t >= HIT_T) {
      f.impacted = true;
      this.pool.spread(1.3, 0.12);
      this.pool.swirl = 0.45;
      this.pool.settle(0.45, 0.15);
      this.pool.fade(0.3, 0.75);
      this.dust.puff(this.v1.copy(this.feet).setY(0.3), 0.7);
      this.shake = 0.12;
      if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 1, from: ctx.from, color: SAND_CSS.body });
    }
    if (!f.set && t >= SET_T) {
      f.set = true;
      // Four carved shards rise around the legs where the wrap lay.
      for (let i = 0; i < SHARDS; i++) {
        const a = (i / SHARDS) * Math.PI * 2 + 0.6;
        this.v1.set(this.feet.x + Math.cos(a) * 0.6, 0, this.feet.z + Math.sin(a) * 0.6);
        this.v2.set(0.34 + Math.random() * 0.08, 0.85 + Math.random() * 0.3, 0.3 + Math.random() * 0.08);
        this.shards.raise(this.v1, this.v2, 0.1, i * 0.015, { yaw: a, lean: 0.25, leanDir: Math.atan2(-Math.cos(a), -Math.sin(a)), taper: 0.3 });
      }
    }
    if (!f.crumbled && t >= CRUMBLE_T) {
      f.crumbled = true;
      this.shards.crumble(0.4, 0.12);
      this.dust.fall(this.v1.copy(this.feet), 0.7, 8, 1.8, 0.6);
    }

    this.layout();
  }

  /** The whip: a bezier from his side over the target's head to its legs, with a snake wobble that dies at the hit. */
  private whipPath = (u: number, out: THREE.Vector3) => {
    const iu = 1 - u;
    const w0 = iu * iu * iu, w1 = 3 * iu * iu * u, w2 = 3 * iu * u * u, w3 = u * u * u;
    out.set(
      w0 * this.base.x + w1 * this.c1.x + w2 * this.c2.x + w3 * this.hit.x,
      w0 * this.base.y + w1 * this.c1.y + w2 * this.c2.y + w3 * this.hit.y,
      w0 * this.base.z + w1 * this.c1.z + w2 * this.c2.z + w3 * this.hit.z,
    );
    const k = Math.sin(u * Math.PI * 2.5 - this.time * 16) * 0.45 * this.wobble * Math.sin(u * Math.PI);
    out.addScaledVector(this.side, k);
    return out;
  };

  /** One turn of a helix around the target's legs, from the ankles up. */
  private wrapPath = (u: number, out: THREE.Vector3) => {
    const a = this.aimYaw() + u * Math.PI * 2.3;
    const r = 0.62 - 0.1 * u;
    return out.set(this.feet.x + Math.cos(a) * r, 0.12 + u * 0.95, this.feet.z + Math.sin(a) * r);
  };

  private aimYaw() {
    return Math.atan2(this.fwd.x, this.fwd.z) + 0.8;
  }

  private layout() {
    const t = this.time;
    const after = t - HIT_T;

    // --- 0..0.2 pour out of the floor at his side and rise; 0.2..0.5 the lash; 0.55..0.85 the ribbon sinks into the target. ---
    this.wobble = 1 - smoothstep((t - 0.28) / 0.22);
    let head: number;
    if (t < POUR_END_T) head = 0.3 * easeOutQuad(t / POUR_END_T);
    else head = 0.3 + 0.7 * Math.pow(Math.min(1, (t - POUR_END_T) / (HIT_T - POUR_END_T)), 1.7);
    const tail = smoothstep((t - 0.55) / 0.3);
    this.whipRibbon.shed = t < 0.55 ? 30 : 10;
    this.whipRibbon.setFunction(this.whipPath, 0.52 * (1 - 0.2 * smoothstep((t - 0.2) / 0.3)), head, Math.min(tail, head - 0.01), t);

    // --- 0.5..0.62 the tip wraps once around the legs; it sets into stone, then crumbles away after 0.9. ---
    if (t >= HIT_T) {
      const wh = 1 - Math.pow(1 - THREE.MathUtils.clamp(after / 0.12, 0, 1), 2);
      const wt = smoothstep((t - CRUMBLE_T) / 0.25);
      this.wrapRibbon.stone = smoothstep((t - 0.54) / 0.1);
      this.wrapRibbon.setFunction(this.wrapPath, 0.34, wh, Math.min(wt, wh - 0.01), t);
    } else {
      this.wrapRibbon.hide();
    }

    // --- Hit: dark impact frame, turquoise accent star (2 frames), ground refraction, shake. ---
    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.03);
    if (this.flags.impacted) {
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.v1.copy(this.hit).setY(1.0), 1.0 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 2.0 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.12 * Math.exp(-after * 14);
    }
  }
}

const easeOutQuad = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 2;

export const sandLashModule: EffectModule = {
  label: 'sand lash',
  category: 'hero: sand',
  targeting: { mode: 'enemy' },
  create: () => new SandLash(),
  telegraphs(effect) {
    const e = effect as SandLash;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.1, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SandLash;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as SandLash).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
