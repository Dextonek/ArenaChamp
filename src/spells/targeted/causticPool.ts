import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import { ALCHEMY, ALCHEMY_CSS, AcidPool, Fumes, Flask, GlassShards, TransmuteCircle } from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Caustic Pool (alchemy kit, W: lingering pool, 4 s). She throws two flasks at once, one high and one low; both shatter at
 * the point, then a glass-ink alchemical circle flashes on and a pool of acid spreads to fill it, bubbling hard with big
 * bubbles under the enemies and fumes curling up. The enemies sink a little and take an initial hit and four ticks over 4 s, each slowing
 * them. Then the pool drains to a stain and the circle fades. See pipeline/designs/kit-alchemy.md.
 */
export interface CausticPoolSettings {
  damage: number;
  tick: number;
  /** Seconds of slow on the first hit and on every tick. */
  slow: number;
  loop: boolean;
}

export const defaultCausticPool = (): CausticPoolSettings => ({ damage: 30, tick: 7, slow: 1, loop: false });

// Timeline (seconds).
const THROW_T = 0.2;
const SHATTER_A = 0.4;
const SHATTER_B = 0.5;
const HIT_T = 0.6;
const TICKS = [1.2, 2.0, 2.8, 3.6]; // every hit lands inside 4.2 s of the cast
const DRAIN_T = 3.8;
const DURATION = 4.6;
const RADIUS = 4;
const POOL_R = 3.8;
const CIRCLE_R = 4.5;
const SINK = 0.08;

export class CausticPool implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CausticPoolSettings;
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
  private handA = new THREE.Vector3(0, 1.7, 13);
  private handB = new THREE.Vector3(0, 1.1, 13);
  private point = new THREE.Vector3(0, 0, -8);
  private landA = new THREE.Vector3();
  private landB = new THREE.Vector3();
  private inside: { enemy: CastContext['targets'][number]; pos: THREE.Vector3 }[] = [];

  private flags = { a: false, b: false, hit: false, drain: false, sunk: false };
  private ticksDone = 0;
  private bubbleTimer = 0;
  private fumeTimer = 0;

  // Parts.
  private flaskA = new Flask();
  private flaskB = new Flask();
  private shards = new GlassShards({ max: 64 });
  private splashA = new AcidPool(8);
  private splashB = new AcidPool(8);
  private pool = new AcidPool(56);
  private circle = new TransmuteCircle();
  private fumes = new Fumes(8);
  private cleared = false;

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: CausticPoolSettings = defaultCausticPool()) {
    this.settings = settings;
    this.screen.tint.set(ALCHEMY.dark);
    this.pool.boil = 22;
    this.pool.bubbleSize = 0.42;
    this.pool.order = 1;
    for (const s of [this.splashA, this.splashB]) { s.boil = 5; s.bubbleSize = 0.22; s.order = 2; s.y = 0.04; }
    this.circle.hole = 0.3;
    this.group.add(
      this.pool.mesh, this.splashA.mesh, this.splashB.mesh, this.circle.mesh, this.shards.mesh, this.fumes.mesh,
      this.flaskA.mesh, this.flaskB.mesh,
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
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.handA.copy(ctx.from).addScaledVector(this.fwd, 0.5).addScaledVector(this.side, 0.35).setY(1.75);
    this.handB.copy(ctx.from).addScaledVector(this.fwd, 0.5).addScaledVector(this.side, -0.3).setY(1.05);
    this.point.copy(ctx.point).setY(0);
    this.landA.copy(this.point).add(this.v1.set(0.7, 0.25, -0.5));
    this.landB.copy(this.point).add(this.v1.set(-0.8, 0.25, 0.6));
    this.inside.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (p && Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) this.inside.push({ enemy: e, pos: p.clone() });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point);
    this.circle.set(this.point, CIRCLE_R);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.bubbleTimer = 0;
    this.fumeTimer = 0;
    this.ticksDone = 0;
    this.cleared = false;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    for (const f of [this.flaskA, this.flaskB]) f.reset();
    this.shards.reset();
    for (const p of [this.pool, this.splashA, this.splashB]) p.reset();
    this.circle.reset();
    this.circle.hole = 0.3;
    this.fumes.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.shards.update(dt);
    for (const p of [this.pool, this.splashA, this.splashB]) p.update(dt);
    this.fumes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    // Events.
    if (!f.a && t >= SHATTER_A) { f.a = true; this.shatter(this.flaskA, this.landA, this.splashA); }
    if (!f.b && t >= SHATTER_B) { f.b = true; this.shatter(this.flaskB, this.landB, this.splashB); }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.pool.spread(this.point, POOL_R, 0.45);
      this.splashA.drain(0.25);
      this.splashB.drain(0.25);
      this.shake = 0.18;
      this.eachInside(this.settings.damage);
    }
    while (this.ticksDone < TICKS.length && t >= TICKS[this.ticksDone]) { this.ticksDone++; this.eachInside(this.settings.tick); }
    if (!f.drain && t >= DRAIN_T) { f.drain = true; this.pool.drain(0.6); }

    // Big bubbles under the enemies and fumes curling up out of the pool while it boils.
    if (t >= HIT_T + 0.1 && t < DRAIN_T - 0.3) {
      this.bubbleTimer += dt;
      while (this.bubbleTimer >= 0.13) {
        this.bubbleTimer -= 0.13;
        const v = this.inside[Math.floor(Math.random() * this.inside.length)];
        if (v) this.pool.bubbleAt(v.pos.x + (Math.random() - 0.5) * 1.1, v.pos.z + (Math.random() - 0.5) * 1.1, 0.36 + Math.random() * 0.14, 0.6 + Math.random() * 0.4);
      }
      this.fumeTimer += dt;
      while (this.fumeTimer >= 0.22) {
        this.fumeTimer -= 0.22;
        const a = Math.random() * Math.PI * 2, d = POOL_R * 0.8 * Math.sqrt(Math.random());
        this.fumes.puff(this.v2.set(this.point.x + Math.cos(a) * d, 0.1, this.point.z + Math.sin(a) * d), 0.45, undefined, 1.2);
      }
    }

    if (!this.cleared && t >= DURATION - 0.4) { this.cleared = true; this.pool.bubbles.reset(); this.fumes.reset(); }

    this.layout();
  }

  private shatter(flask: Flask, land: THREE.Vector3, splash: AcidPool) {
    flask.mesh.visible = false;
    this.shards.burst(land, 16, 5.5, { size: 0.2, life: 0.55 });
    splash.spread(this.v1.copy(land).setY(0), 1.1, 0.15);
    for (let i = 0; i < 2; i++) {
      splash.bubbleAt(land.x + (Math.random() - 0.5) * 0.9, land.z + (Math.random() - 0.5) * 0.9, 0.2 + Math.random() * 0.1, 0.4 + Math.random() * 0.3);
    }
  }

  /** A hit (damage and slow) on whoever stands in the pool right now: live positions, re-checked every tick. */
  private eachInside(damage: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) {
        ctx.hit(e, { damage, knock: 0, from: this.point, color: ALCHEMY_CSS.body, status: { kind: 'slow', seconds: this.settings.slow } });
      }
    }
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.inside) ctx.displace(v.enemy, this.v1.set(0, 0, 0));
    this.reset();
  }

  private layout() {
    const t = this.time;
    const ctx = this.ctx;

    // --- 0..0.2 Two flasks plucked (one high, one low) and held for a beat; then the lobs. ---
    const grow = smoothstep(t / 0.14);
    const fa = this.flaskA, fb = this.flaskB;
    if (t < SHATTER_A) {
      fa.mesh.visible = true;
      fa.scale = 0.6 * grow;
      fa.slosh(t, 1);
      if (t < THROW_T) { fa.mesh.position.copy(this.handA); fa.mesh.rotation.set(0, 0, 0); }
      else fa.lob(this.handA, this.landA, 5.5, (t - THROW_T) / (SHATTER_A - THROW_T));
    }
    if (t < SHATTER_B) {
      fb.mesh.visible = true;
      fb.scale = 0.6 * grow;
      fb.slosh(t + 1, 1);
      if (t < THROW_T) { fb.mesh.position.copy(this.handB); fb.mesh.rotation.set(0, 0, 0); }
      else fb.lob(this.handB, this.landB, 2.2, (t - THROW_T) / (SHATTER_B - THROW_T));
    }

    // --- 0.6 The circle flashes on; fades with the drain. ---
    this.circle.reveal = smoothstep((t - HIT_T) / 0.12);
    this.circle.opacity = 1 - smoothstep((t - DRAIN_T) / 0.6);
    this.circle.lit = t >= HIT_T ? 6 : 0;

    // --- Enemies sink into the pool and rise as it drains. ---
    if (ctx) {
      const sink = SINK * smoothstep((t - HIT_T) / 0.15) * (1 - smoothstep((t - DRAIN_T) / 0.5));
      for (const v of this.inside) ctx.displace(v.enemy, this.v1.set(0, -sink, 0));
    }
    this.shake = this.flags.hit ? 0.18 * Math.exp(-(t - HIT_T) * 10) : 0;
  }
}

export const causticPoolModule: EffectModule = {
  label: 'caustic pool',
  category: 'hero: alchemy',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new CausticPool(),
  telegraphs(effect) {
    const e = effect as CausticPool;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T, until: TICKS[TICKS.length - 1] + 0.1 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CausticPool;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as CausticPool).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tick', 1, 60, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
