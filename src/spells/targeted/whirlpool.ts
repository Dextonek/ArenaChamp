import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { Droplets, SplashCrown, TIDE, TIDE_CSS, WaterPool, WaterRibbon } from '../../effects/parts/tide';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Whirlpool (tide kit, W: ground zone). A shallow pool spreads at the point; three water ribbons rise out of it and
 * spiral round the centre faster and faster, drawing the enemies in. Then the spiral snaps up into a tall water column
 * with a foam collar that splashes outward (the hit), a last tick as it collapses, and the water falls back into the
 * pool, which drains. See pipeline/designs/kit-tide.md.
 */
export interface WhirlpoolSettings {
  damage: number;
  /** Second, small tick as the column collapses. */
  tick: number;
  loop: boolean;
}

export const defaultWhirlpool = (): WhirlpoolSettings => ({ damage: 45, tick: 10, loop: false });

// Timeline (seconds).
const POOL_T = 0.0; // the pool spreads
const SPIRAL_T = 0.3; // ribbons rise and spiral
const HIT_T = 0.75; // the spiral snaps up into the column
const TICK_T = 1.3; // the column collapses
const RELEASE_T = 1.4; // the pull lets go, the water falls back
const GONE_T = 2.1; // ribbons gone
const DURATION = 2.3;

const RADIUS = 4;
const COLUMN_H = 2.5;
const PULL = 0.5;
const COUNT = 3;

export class Whirlpool implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WhirlpoolSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];

  private flags = { pool: false, hit: false, tick: false, drained: false };
  private spinA = 0;

  // Parts.
  private pool = new WaterPool();
  private ribbons = Array.from({ length: COUNT }, () => new WaterRibbon(32, 10, 14));
  private drops = new Droplets(36);
  private crown = new SplashCrown();
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch, and the per-frame values the ribbon paths read.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private pm = { phase: 0, spin: 0, shrink: 0, rise: 1, morph: 0, fall: 0 };

  constructor(settings: WhirlpoolSettings = defaultWhirlpool()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.hot);
    this.screen.tint.set(TIDE.dark);
    for (const r of this.ribbons) {
      r.shed = 9;
      r.drops.splash = false;
    }
    this.group.add(this.pool.mesh, ...this.ribbons.map((r) => r.mesh), this.crown.mesh, this.drops.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the impact are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(1.2);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.spinA = 0;
    this.flags.pool = this.flags.hit = this.flags.tick = this.flags.drained = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(TIDE.dark);
    this.pool.reset();
    for (const r of this.ribbons) r.reset();
    this.drops.reset();
    this.crown.reset();
    this.groundShock.set(this.point, 0, 0);
  }

  /** One ribbon: a spiral from the pool's rim in to the centre and up, morphing into a vertical column helix. */
  private path = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const m = this.pm;
    // Spiral: from the outer rim (low) to near the centre (higher).
    const sr = (3.4 - 2.5 * u) * (1 - 0.18 * m.shrink);
    const sa = m.phase + m.spin + u * Math.PI * 2.2;
    const sy = 0.15 + u * 1.6 * m.rise;
    // Column: a tight helix going straight up.
    const cr = 0.85 + 0.15 * Math.sin(u * 5 + m.phase);
    const ca = m.phase + m.spin + u * Math.PI * 3;
    const cy = 0.1 + u * COLUMN_H * m.rise;
    let r = sr + (cr - sr) * m.morph;
    const a = sa + (ca - sa) * m.morph;
    let y = sy + (cy - sy) * m.morph;
    // Falling back: the column slumps and spreads.
    r *= 1 + 2.4 * m.fall;
    y *= 1 - 0.85 * m.fall;
    return out.set(this.point.x + Math.cos(a) * r, y, this.point.z + Math.sin(a) * r);
  };

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const r of this.ribbons) r.update(dt);
    this.drops.update(dt);
    this.crown.update(dt);
    this.pool.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.pool && t >= POOL_T + 0.01) {
      f.pool = true;
      this.pool.spread(this.point, RADIUS, 0.3);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.crown.burst(this.point, 2.4);
      this.crown.burst(this.v1.set(this.point.x, COLUMN_H - 0.2, this.point.z), 1.0);
      this.pool.ripple(this.point);
      this.drops.spray(this.v1.set(this.point.x, 1.0, this.point.z), this.v2.set(0, 1, 0), 16, 7);
      this.shake = 0.35;
      if (ctx) for (const v of this.victims) if (this.inside(v.enemy)) ctx.hit(v.enemy, { damage: this.settings.damage, knock: 0, from: this.point, color: TIDE_CSS.body });
    }
    if (f.hit && !f.tick && t >= TICK_T) {
      f.tick = true;
      this.drops.spray(this.v1.set(this.point.x, 1.6, this.point.z), this.v2.set(0, 1, 0), 10, 4.5);
      this.pool.ripple(this.v1.set(this.point.x + 0.8, 0, this.point.z - 0.5));
      this.shake = Math.max(this.shake, 0.12);
      if (ctx) for (const v of this.victims) if (this.inside(v.enemy)) ctx.hit(v.enemy, { damage: this.settings.tick, knock: 0, from: this.point, color: TIDE_CSS.body });
    }
    if (!f.drained && t >= RELEASE_T + 0.1) {
      f.drained = true;
      this.pool.drain(0.8);
    }

    this.layout(dt);
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  private layout(dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    const after = t - HIT_T;

    this.screen.darken = 0.2 * smoothstep((t - 0.05) / 0.3) * (1 - smoothstep((t - 1.5) / 0.6));

    // The ribbons: they rise from the pool, speed up, snap into the column at the hit, then slump.
    const k = THREE.MathUtils.clamp((t - SPIRAL_T) / (HIT_T - SPIRAL_T), 0, 1);
    this.spinA += dt * (2.0 + 12 * k * k) * (t < GONE_T ? 1 : 0.3);
    const pm = this.pm;
    pm.spin = this.spinA;
    pm.shrink = k;
    pm.rise = smoothstep((t - SPIRAL_T) / 0.2);
    pm.morph = t < HIT_T ? 0 : 1 - Math.pow(1 - THREE.MathUtils.clamp((t - HIT_T) / 0.18, 0, 1), 3);
    pm.fall = smoothstep((t - TICK_T) / (GONE_T - TICK_T));
    const width = 0.55 * (1 - 0.5 * pm.fall);
    const tail = 0.9 * pm.fall * pm.fall;
    const head = Math.max(smoothstep((t - SPIRAL_T) / 0.25), 0);
    for (let i = 0; i < COUNT; i++) {
      pm.phase = (i / COUNT) * Math.PI * 2;
      const r = this.ribbons[i];
      if (t < GONE_T && head > 0.01) r.setFunction(this.path, width, head, tail, t);
      else r.hide();
    }

    // The pull on the enemies: in during the spiral, held under the column, released as the water falls back.
    if (ctx) {
      const pull = PULL * smoothstep((t - SPIRAL_T) / (HIT_T - SPIRAL_T)) * (1 - smoothstep((t - RELEASE_T) / 0.35));
      for (const v of this.victims) {
        this.v3.set(this.point.x - v.feet.x, 0, this.point.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    if (this.flags.hit) {
      const gp = THREE.MathUtils.clamp(after / 0.45, 0, 1);
      this.groundShock.set(this.point, 1 + 4 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = Math.max(0.35 * Math.exp(-after * 10), this.flags.tick ? 0.12 * Math.exp(-(t - TICK_T) * 12) : 0);
    }
  }
}

export const whirlpoolModule: EffectModule = {
  label: 'whirlpool',
  category: 'hero: tide',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Whirlpool(),
  telegraphs(effect) {
    const e = effect as Whirlpool;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Whirlpool;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as Whirlpool).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tick', 0, 50, 1);
  },
};
