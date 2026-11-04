import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  CoralSpire as CoralMesh, Droplets, SplashCrown, TIDE, TIDE_CSS, TideCurrent, TideRing, WaterPool,
} from '../../effects/parts/tide';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { pillar, type Obstacle } from '../../obstacles';
import { SPIRE_PULL, SPIRE_PUSH, shapeMove, tideNow } from '../../traits/tide';

/**
 * Coral Spire (tide kit, W: terrain). A ring of the tide's current marks a spot (8 m): foam streaks run outward at High
 * tide, blue streaks draw inward at Low tide. After 0.9 s a coral pillar bursts out of the floor there and stands for
 * 5 s as a real obstacle (`ctx.addObstacle`, a pillar of radius 0.8): it blocks walking, sight and bolts for both heroes
 * and the AI. As it rises, the enemy within 2.5 m of it is hit (55) and moved by the tide: at High tide shoved 3 m away,
 * at Low tide dragged 2 m toward it. The move is decided in `src/traits/tide.ts` (`dealt`); this effect hands the
 * engine the Low-tide shape (a `pull` toward the spire) and the trait flips it. Near the end the coral cracks and
 * flares, then sinks and the obstacle goes. See pipeline/designs/kit-tide.md.
 *
 * Both screens of a network duel build the same pillar: its place comes only from `ctx.sentFrom` and `ctx.point`. Each
 * screen decides the hit on its own hero, judged by the live position.
 */
export interface CoralSpireSettings {
  damage: number;
  loop: boolean;
}

export const defaultCoralSpire = (): CoralSpireSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const RISE_T = 0.9; // the pillar bursts up, the hit lands (the telegraph counts down to it)
const LIFE = 5; // seconds the obstacle stands, counted from the rise
const SHATTER_T = RISE_T + LIFE;
const CRACK_T = SHATTER_T - 0.9;
const DURATION = SHATTER_T + 0.8;

const RANGE = 8;
const MIN_DIST = 2.0; // closest the spire may rise to her
const HIT_R = 2.5; // the enemy within this of the spire is hit and moved
const OBSTACLE_R = 0.8;

export class CoralSpireFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CoralSpireSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  /** Where the spire rises, from sentFrom and point only. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private from = new THREE.Vector3(0, 0, 14);
  private high = true;

  private flags = { pool: false, risen: false, crack1: false, crack2: false, crack3: false, shatter: false };
  private obstacle: Obstacle | null = null;
  private obstacleCtx: CastContext | null = null;
  private hitT = -1;
  private shatterT = -1;

  // Parts.
  private spotRing = new TideRing();
  private feetRing = new TideRing();
  private spire = new CoralMesh();
  private pool = new WaterPool();
  private crown = new SplashCrown();
  private drops = new Droplets(40);
  private current = new TideCurrent(22);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: TIDE.accent, core: 0xfff2e8, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: CoralSpireSettings = defaultCoralSpire()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.accent);
    this.screen.tint.set(TIDE.dark);
    this.group.add(
      this.pool.mesh, this.spotRing.mesh, this.feetRing.mesh, this.current.mesh, this.spire.mesh, this.crown.mesh,
      this.drops.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return RISE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the pillar: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = MIN_DIST; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, RANGE);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
    this.high = tideNow(ctx.caster).high;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.spire.mesh];
    this.screen.focus.copy(this.centre).setY(1.6);
    this.spire.mesh.position.copy(this.centre);
    this.groundShock.set(this.centre, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private dropObstacle() {
    if (this.obstacle) this.obstacleCtx?.removeObstacle?.(this.obstacle);
    this.obstacle = null;
    this.obstacleCtx = null;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hitT = this.shatterT = -1;
    this.dropObstacle();
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.spotRing.hide();
    this.feetRing.hide();
    this.spire.reset();
    this.pool.reset();
    this.crown.reset();
    this.drops.reset();
    this.current.hide();
    this.pop.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
    this.crown.update(dt);
    this.drops.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.risen) {
      // Until it rises the ring shows the tide as it is now; the hit takes the tide of the rise.
      if (ctx) this.high = tideNow(ctx.caster).high;
      if (!f.pool && t >= 0.04) { f.pool = true; this.pool.spread(this.centre, HIT_R * 0.9, 0.45); }
    }
    if (!f.risen && t >= RISE_T) {
      f.risen = true;
      this.hitT = t;
      this.rise(ctx);
    }
    if (f.risen && !f.shatter) {
      // Cracking: the foot flares coral in pulses and sheds splinters of water, faster toward the end.
      const crackK = smoothstep((t - CRACK_T) / (SHATTER_T - CRACK_T));
      this.spire.flare(crackK > 0 ? crackK * (0.5 + 0.5 * Math.sin(t * (14 + 22 * crackK))) : 0);
      const beats: [keyof typeof f, number][] = [['crack1', CRACK_T], ['crack2', CRACK_T + 0.3], ['crack3', CRACK_T + 0.6]];
      for (const [k, at] of beats) {
        if (f[k] || t < at) continue;
        f[k] = true;
        this.drops.spray(this.v1.copy(this.centre).setY(1.8 + Math.random() * 1.2), this.v2.set(0, 1, 0), 6, 3.5);
        this.shake = Math.max(this.shake, 0.1);
      }
    }
    if (f.risen && !f.shatter && t >= SHATTER_T) {
      f.shatter = true;
      this.shatterT = t;
      this.dropObstacle();
      this.crown.burst(this.centre, 1.6);
      this.drops.spray(this.v1.copy(this.centre).setY(1.2), this.v2.set(0, 1, 0), 18, 5.5);
      this.shake = 0.3;
    }
    this.layout();
  }

  /** The pillar comes up: the hit on whoever stands within reach, then the obstacle and the burst. */
  private rise(ctx: CastContext | null) {
    if (ctx) {
      // Whoever stands within reach is hit now (live position, so a body that stepped away is spared), with the
      // Low-tide shape (pulled toward the spire): the trait flips it to a push at High tide. Without a trait (the
      // editor) the effect shapes the hit itself.
      const before = tideNow(ctx.caster);
      ctx.targets.forEach((e) => {
        const p = e.group.position;
        if (Math.hypot(p.x - this.centre.x, p.z - this.centre.z) > HIT_R) return;
        const opts: HitOptions = { damage: this.settings.damage, knock: 0, pull: SPIRE_PULL, from: this.centre.clone(), color: TIDE_CSS.body };
        if (!before.live) shapeMove(opts, before.high, this.centre, p, ctx.from, before.high ? SPIRE_PUSH : SPIRE_PULL);
        ctx.hit(e, opts);
      });
      // The hit has been through the trait: its tide is the one that moved them.
      this.high = tideNow(ctx.caster).high;
      const o = pillar(this.centre.x, this.centre.z, OBSTACLE_R);
      this.obstacle = ctx.addObstacle ? ctx.addObstacle(o, LIFE) : null;
      this.obstacleCtx = this.obstacle ? ctx : null;
    }
    this.crown.burst(this.centre, 1.9);
    this.drops.spray(this.v1.copy(this.centre).setY(0.8), this.v2.set(0, 1, 0), 16, 6);
    this.shake = 0.4;
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = f.risen ? t - this.hitT : -1;

    this.screen.darken = 0.22 * smoothstep((t - 0.05) / 0.3) * (1 - smoothstep((t - 1.2) / 0.6))
      + 0.1 * (f.shatter ? 1 - smoothstep((t - this.shatterT) / 0.5) : 0);
    this.screen.impact = f.risen ? impactFrameAt(t, this.hitT, [1], 0.03) : 0;

    // --- The tide ring at her feet and the current round the spot. ---
    if (ctx) this.feetRing.set(ctx.caster.group.position, this.high, smoothstep(t / 0.2) * (1 - smoothstep((t - 0.7) / 0.4)), t);
    if (!f.risen) {
      const k = smoothstep((t - 0.04) / 0.3);
      this.spotRing.set(this.centre, this.high, k, t, HIT_R);
      this.current.set(this.centre, 0.5, HIT_R, !this.high, 0.55 * k, t, 1.1, 0.7);
      this.spire.grow(0);
    } else {
      // Rising: the ring flashes once and fades; the streaks burst through the people it caught.
      const ringFade = 1 - smoothstep((after - 0.15) / 0.5);
      this.spotRing.set(this.centre, this.high, ringFade, t, HIT_R);
      this.current.set(this.centre, 0.5, HIT_R, !this.high, 0.9 * (1 - smoothstep((after - 0.2) / 0.5)), after * 1.4, 2.0, 0.9);
      const k = THREE.MathUtils.clamp(after / 0.22, 0, 1);
      if (!f.shatter) this.spire.grow(k);
      else this.spire.sink(THREE.MathUtils.clamp((t - this.shatterT) / 0.5, 0, 1));

      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.v1.copy(this.centre).setY(1.5), 1.7 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(this.centre, 0.5 + 3.5 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.4 * Math.exp(-after * 9));
      // Standing: a drip of drops off the coral now and then.
      if (!f.shatter && after > 0.5 && Math.random() < 0.04) {
        this.drops.drop(this.v1.copy(this.centre).setY(2 + Math.random() * 1.5), this.v2.set((Math.random() - 0.5) * 0.8, -1, (Math.random() - 0.5) * 0.8), 0.6, 0.08);
      }
    }
  }
}

export const coralSpireModule: EffectModule = {
  label: 'coral spire',
  category: 'hero: tide',
  // The aim point is where the coral rises; `radius` brings the enemies within reach of it into `ctx.targets`.
  targeting: { mode: 'ground', radius: HIT_R },
  create: () => new CoralSpireFx(),
  telegraphs(effect) {
    const e = effect as CoralSpireFx;
    if (!e.ctx) return [];
    // The circle the coral shoves or drags: the rise is the dodge check, so the circle is the zone.
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: HIT_R }, start: 0.04, impact: RISE_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CoralSpireFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as CoralSpireFx).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 100, 1);
  },
};
