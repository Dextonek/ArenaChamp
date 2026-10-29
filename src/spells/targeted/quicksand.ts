import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { SAND_CSS, Dust, GlyphRing, SandPool, SandstoneBlocks } from '../../effects/parts/sand';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Quicksand (sand kit, W: ground zone): a ring of carved glyphs cuts itself into the floor, sand floods inside it and
 * starts to swirl inward, sinking and pulling the enemies in it. Then the swirl snaps tight and sandstone pillars
 * punch up around the edge, leaning inward like closing teeth. They crumble and the sand settles. See
 * pipeline/designs/kit-sand.md.
 */
export interface QuicksandSettings {
  damage: number;
  /** One small tick after the hit. */
  tick: number;
  loop: boolean;
}

export const defaultQuicksand = (): QuicksandSettings => ({ damage: 45, tick: 10, loop: false });

// Timeline (seconds).
const POOL_T = 0.3;
const HIT_T = 0.75;
const TICK_T = 1.3;
const CRUMBLE_T = 1.45;
const DURATION = 2.3;

const RADIUS = 4;
const PILLARS = 7;

export class Quicksand implements Effect {
  readonly group = new THREE.Group();
  readonly settings: QuicksandSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -8);

  // Event flags.
  private flags = { pool: false, impacted: false, ticked: false, crumbled: false, dust2: false };

  // Parts.
  private ring = new GlyphRing();
  private pool = new SandPool();
  private pillars = new SandstoneBlocks(PILLARS + 1);
  private dust = new Dust(10, 40);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: QuicksandSettings = defaultQuicksand()) {
    this.settings = settings;
    this.pillars.dust = this.dust;
    this.pillars.dustEvery = 2;
    this.dust.life = 0.6;
    this.group.add(this.ring.mesh, this.pool.mesh, this.pillars.mesh, this.dust.mesh, this.groundShock.mesh);
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
    this.point.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point);
    this.pool.place(this.point);
    this.ring.set(this.point, RADIUS, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.ring.reset();
    this.pool.reset();
    this.pillars.reset();
    this.dust.reset();
    this.groundShock.set(this.point, 0, 0);
    this.release();
  }

  /** Gives the enemies their position back. */
  private release() {
    const ctx = this.ctx;
    if (ctx) for (const e of ctx.targets) ctx.displace(e, this.v1.set(0, 0, 0));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
    this.pillars.update(dt);
    this.dust.update(dt);
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
    if (!f.pool && t >= POOL_T) {
      f.pool = true;
      this.pool.spread(RADIUS * 0.74, 0.4);
    }
    if (!f.impacted && t >= HIT_T) {
      f.impacted = true;
      this.snap();
      this.eachInside((e) => ctx?.hit(e, { damage: this.settings.damage, knock: 0, from: this.point, color: SAND_CSS.body }));
    }
    if (!f.ticked && t >= TICK_T) {
      f.ticked = true;
      this.eachInside((e) => ctx?.hit(e, { damage: this.settings.tick, knock: 0, from: this.point, color: SAND_CSS.body }));
    }
    if (!f.crumbled && t >= CRUMBLE_T) {
      f.crumbled = true;
      this.pillars.crumble(0.6, 0.3);
      this.pool.settle(0.6, 0);
      this.pool.fade(0.4, 0.55);
      this.shake = Math.max(this.shake, 0.12);
    }
    if (!f.dust2 && t >= 1.7) {
      f.dust2 = true;
      this.dust.fall(this.v1.copy(this.point), RADIUS * 0.8, 10, 2.5, 0.5);
    }

    this.layout();
  }

  private eachInside(fn: (e: CastContext['targets'][number]) => void) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (p && Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) fn(e);
    });
  }

  /** The hit: the swirl snaps tight, pillars punch up around the edge, dust, shake. */
  private snap() {
    this.pool.swirl = 1;
    for (let i = 0; i < PILLARS; i++) {
      const a = (i / PILLARS) * Math.PI * 2 + 0.35 + (Math.random() - 0.5) * 0.25;
      const r = RADIUS * (0.8 + Math.random() * 0.1);
      this.v1.set(this.point.x + Math.cos(a) * r, 0, this.point.z + Math.sin(a) * r);
      const w = 0.8 + Math.random() * 0.5;
      this.v2.set(w, 2.8 + Math.random() * 1.5, w * (0.8 + Math.random() * 0.3));
      this.pillars.raise(this.v1, this.v2, 0.13 + Math.random() * 0.05, Math.random() * 0.05, {
        yaw: a + Math.random() * 0.4, lean: 0.28 + Math.random() * 0.17, leanDir: Math.atan2(-Math.cos(a), -Math.sin(a)), taper: 0.6 + Math.random() * 0.25,
      });
      if (i % 2 === 0) this.dust.puff(this.v1.setY(0.4), 0.8 + Math.random() * 0.3);
    }
    this.shake = 0.4;
  }

  private layout() {
    const t = this.time;
    const after = t - HIT_T;
    const f = this.flags;
    const ctx = this.ctx;

    // --- 0..0.3 the glyph ring carves itself; it flashes turquoise for a few frames at the hit; fades with the sand. ---
    this.ring.reveal = smoothstep(t / 0.3);
    this.ring.opacity = 1 - smoothstep((t - 1.75) / 0.45);
    this.ring.lit = f.impacted && after < 0.05 ? 1 : 0;

    // --- 0.3..0.75 the swirl winds up; 1.4.. it settles. ---
    if (!f.impacted) this.pool.swirl = 0.7 * smoothstep((t - POOL_T) / 0.4);

    // --- Enemies inside sink 0.15 and are pulled 0.4 toward the middle while the sand turns. ---
    if (ctx) {
      const k = smoothstep((t - POOL_T) / 0.45) * (1 - smoothstep((t - 1.3) / 0.45));
      ctx.targets.forEach((e, i) => {
        const p = ctx.targetPos[i];
        if (!p) return;
        const dx = this.point.x - p.x, dz = this.point.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > RADIUS) { ctx.displace(e, this.v1.set(0, 0, 0)); return; }
        const pull = Math.min(0.4 * k, d);
        ctx.displace(e, this.v1.set(d > 1e-4 ? (dx / d) * pull : 0, -0.15 * k, d > 1e-4 ? (dz / d) * pull : 0));
      });
    }

    // --- Hit: ground refraction, shake. ---
    if (f.impacted) {
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(this.point, 1 + 4 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = 0.4 * Math.exp(-after * 9) + (f.crumbled ? 0.12 * Math.exp(-(t - CRUMBLE_T) * 10) : 0);
    }
  }
}

export const quicksandModule: EffectModule = {
  label: 'quicksand',
  category: 'hero: sand',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Quicksand(),
  telegraphs(effect) {
    const e = effect as Quicksand;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Quicksand;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as Quicksand).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'tick', 0, 60, 1);
  },
};
