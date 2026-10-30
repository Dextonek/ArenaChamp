import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  SAND, SAND_CSS, Dust, GlyphRing, SandPool, SandRibbon, SandWave, SandstoneBlocks,
} from '../../effects/parts/sand';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Tomb of Kings (sand kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens
 * warm, a big glyph ring carves into the floor, the ground turns to swirling sand and sand ribbons spiral up from the
 * ring and stack a stepped sandstone pyramid layer by layer. A glyph on its face lights turquoise, a dead beat, then
 * the pyramid implodes into the vortex: impact frames, a ring of carved shards bursts across the zone, a sand
 * shockwave sweeps out. The shards crumble to dust, the sand settles, the ring fades, the darkness lifts. Clean by
 * 4.5 s. See pipeline/designs/kit-sand.md.
 */
export interface TombOfKingsSettings {
  damage: number;
  /** Stun seconds at the implosion (engine cap 1.2). */
  stun: number;
  loop: boolean;
}

export const defaultTombOfKings = (): TombOfKingsSettings => ({ damage: 110, stun: 1.0, loop: false });

// Timeline (seconds).
const POOL_T = 0.3;
const BUILD_T = 0.3; // the pyramid starts to stack (layer k starts at BUILD_T + 0.2 + 0.14 k)
const LIT_T = 1.6; // the glyph lights
const DEAD_A = 1.85; // dead beat: everything stops
const DEAD_B = 2.0; // the pyramid implodes
const HIT_T = 2.2;
const DURATION = 4.5;

const RADIUS = 7;
const TIERS = 6;
const RIBBONS = 6;
const SHARDS = 16;

export class TombOfKings implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TombOfKingsSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -8);
  private fwd = new THREE.Vector3(0, 0, -1);
  private crook = new THREE.Vector3(0, 0.4, 14);
  private aim = 0;
  /** Time with the dead beat cut out, so grain scroll and spin freeze with the sand. */
  private st = 0;

  // Event flags.
  private flags = { pool: false, build: false, implode: false, impacted: false, fall: [false, false, false] };

  // Parts.
  private ring = new GlyphRing();
  private pool = new SandPool();
  private blocks = new SandstoneBlocks(TIERS + SHARDS + 4);
  private ribbons: SandRibbon[] = [];
  private wave = new SandWave();
  private dust = new Dust(12, 70);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: SAND.accent, core: 0xe8fffc, additive: false });
  private armFlare = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: SAND.hot, core: SAND.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: TombOfKingsSettings = defaultTombOfKings()) {
    this.settings = settings;
    this.screen.impactColor.set(SAND.stone);
    this.screen.tint.set(0x2a1a0c);
    this.blocks.dust = this.dust;
    this.blocks.dustEvery = 2;
    this.dust.life = 0.7;
    for (let i = 0; i < RIBBONS; i++) {
      const r = new SandRibbon(34, 8, 14);
      r.shed = 18;
      this.ribbons.push(r);
    }
    this.group.add(
      this.ring.mesh, this.pool.mesh, ...this.ribbons.map((r) => r.mesh), this.blocks.mesh, this.wave.mesh, this.dust.mesh,
      this.pop.mesh, this.armFlare.mesh, this.groundShock.mesh,
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
    this.point.copy(ctx.point).setY(0);
    this.aim = ctx.aim;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.crook.copy(ctx.from).addScaledVector(this.fwd, 0.5).setY(0.4);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.blocks.mesh];
    this.screen.focus.copy(this.v1.copy(this.point).setY(2));
    this.pool.place(this.point);
    this.ring.set(this.point, RADIUS, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.st = 0;
    this.shake = 0;
    this.flags.pool = this.flags.build = this.flags.implode = this.flags.impacted = false;
    this.flags.fall.fill(false);
    clearScreenFx(this.screen);
    this.ring.reset();
    this.pool.reset();
    this.blocks.reset();
    for (const r of this.ribbons) r.reset();
    this.wave.reset();
    this.dust.reset();
    this.pop.set(this.point, 0, 0);
    this.armFlare.set(this.crook, 0, 0);
    this.groundShock.set(this.point, 0, 0);
    const ctx = this.ctx;
    if (ctx) for (const e of ctx.targets) ctx.displace(e, this.v1.set(0, 0, 0));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const frozen = this.time >= DEAD_A && this.time < DEAD_B;
    if (!frozen) {
      for (const r of this.ribbons) r.update(dt);
      this.blocks.update(dt);
      this.dust.update(dt);
      this.pool.update(dt);
    }
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
    this.st = t < DEAD_A ? t : t < DEAD_B ? DEAD_A : t - (DEAD_B - DEAD_A);

    // Events.
    if (!f.pool && t >= POOL_T) {
      f.pool = true;
      this.pool.spread(RADIUS * 0.74, 0.5);
    }
    if (!f.build && t >= BUILD_T) {
      f.build = true;
      this.build();
    }
    if (!f.implode && t >= DEAD_B) {
      f.implode = true;
      this.blocks.collapse(0.2, 0);
      this.pool.swirl = 1;
    }
    if (!f.impacted && t >= HIT_T) {
      f.impacted = true;
      this.land();
      if (ctx) {
        for (const e of ctx.targets) {
          const p = e.group.position; // live position: whoever walked out of the zone is spared
          if (Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) {
            ctx.hit(e, {
              damage: this.settings.damage, knock: 6, from: this.point, color: SAND_CSS.body, status: { kind: 'stun', seconds: this.settings.stun },
            });
          }
        }
      }
    }
    [2.4, 2.7, 3.0].forEach((ta, i) => {
      if (!f.fall[i] && t >= ta) { f.fall[i] = true; this.dust.fall(this.point, 6.2, 18, 6, 1.4); }
    });

    this.layout();
  }

  /** The stepped pyramid: six slabs that telescope out of the floor one after the other. */
  private build() {
    for (let k = 0; k < TIERS; k++) {
      const w = 7.0 - k * 1.1;
      this.v1.set(this.point.x, k * 1.0, this.point.z);
      this.v2.set(w, 1.05, w);
      this.blocks.raise(this.v1, this.v2, 0.4, 0.2 + k * 0.14, { yaw: this.aim, taper: 0.9 });
    }
  }

  /** The hit: shards across the zone, shock wave, dust, pool settles. */
  private land() {
    for (let j = 0; j < SHARDS; j++) {
      const a = (j / SHARDS) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const target = 1.8 + Math.random() * 4.6;
      const vy = 7 + Math.random() * 4;
      const flight = (2 * vy) / 18 + 0.05;
      const sp = target / flight;
      this.v1.set(this.point.x + Math.cos(a) * 1.5, 0.6, this.point.z + Math.sin(a) * 1.5);
      this.v2.set(Math.cos(a) * sp, vy, Math.sin(a) * sp);
      const h = 0.9 + Math.random() * 0.7;
      this.blocks.throwShard(this.v1, this.v2, new THREE.Vector3(0.42 + Math.random() * 0.2, h, 0.38 + Math.random() * 0.15), 2.0, 0.8);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const r = 2 + Math.random() * 4;
      this.dust.puff(this.v1.set(this.point.x + Math.cos(a) * r, 0.4, this.point.z + Math.sin(a) * r), 1.0 + Math.random() * 0.4);
    }
    this.pool.settle(0.9, 0.2);
    this.pool.fade(0.6, 1.1);
    this.shake = 0.75;
  }

  /** Ribbon i: from the ring's edge, up and inward in a spiral to above the pyramid's top. */
  private ribbonPath(i: number, u: number, out: THREE.Vector3) {
    const a = (i / RIBBONS) * Math.PI * 2 + 0.3 + this.st * 0.5 + u * Math.PI * 1.7;
    const r = 6.2 * Math.pow(1 - u, 1.15) + 0.5;
    return out.set(this.point.x + Math.cos(a) * r, 0.2 + 5.6 * Math.pow(u, 0.9), this.point.z + Math.sin(a) * r);
  }

  private layout() {
    const t = this.time;
    const after = t - HIT_T;
    const f = this.flags;
    const ctx = this.ctx;

    // --- Screen: warm darken, a lift at the hit and toward the end; the impact frames. ---
    let dk = 0.55 * smoothstep(t / 0.4) * (1 - smoothstep((t - 3.4) / 0.9));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The big glyph ring carves itself in (0..0.5), glints turquoise at the hit, fades at the end. ---
    this.ring.reveal = smoothstep(t / 0.5);
    this.ring.opacity = 1 - smoothstep((t - 3.3) / 0.9);
    this.ring.lit = f.impacted && after < 0.05 ? 1 : 0;

    // --- Planting the crook: a hot flare in the first 0.4 s. ---
    const af = t < 0.4 ? Math.sin(Math.PI * (t / 0.4)) : 0;
    this.armFlare.set(this.crook, 0.9 * af, af > 0.05 ? 1 : 0, t * 2);

    // --- The floor turns to swirling sand; the swirl tightens until the dead beat. ---
    if (!f.implode && !f.impacted) this.pool.swirl = 0.3 + 0.6 * smoothstep((t - POOL_T) / 1.3);

    // --- Ribbons spiral up from the ring edge (0.3..), then are absorbed into the pyramid (0.9..1.5). ---
    for (let i = 0; i < RIBBONS; i++) {
      const d = i * 0.05;
      const head = 1 - Math.pow(1 - THREE.MathUtils.clamp((t - POOL_T - d) / 0.9, 0, 1), 3);
      const tail = smoothstep((t - 0.9 - d) / 0.6);
      const rb = this.ribbons[i];
      if (t >= 1.55 || head <= 0.001) { rb.hide(); continue; }
      rb.setFunction((u, out) => this.ribbonPath(i, u, out), 0.55, head, Math.min(tail, head - 0.01), this.st + i * 0.6);
    }

    // --- The pyramid's glyphs light turquoise (1.6..1.85) and stay lit through the dead beat. ---
    this.blocks.lit = t < HIT_T ? smoothstep((t - LIT_T) / 0.2) : 0;

    // --- Enemies are pulled 0.6 toward the middle until the hit. ---
    if (ctx) {
      const k = t < HIT_T ? smoothstep((t - POOL_T) / 1.3) : 0;
      ctx.targets.forEach((e, i) => {
        const p = ctx.targetPos[i];
        if (!p) return;
        const dx = this.point.x - p.x, dz = this.point.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > RADIUS || d < 1e-4) { ctx.displace(e, this.v1.set(0, 0, 0)); return; }
        const pull = Math.min(0.6 * k, d);
        ctx.displace(e, this.v1.set((dx / d) * pull, 0, (dz / d) * pull));
      });
    }

    // --- Hit: accent star (3 frames), sand shock wave, ground refraction, shake. ---
    if (f.impacted) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.4), 2 * sp.scale, sp.opacity, 0.2);
      const wk = after / 0.6;
      if (wk < 1) this.wave.set(this.point, 1 + (RADIUS - 1) * (1 - Math.pow(1 - wk, 3)), 1 - wk * wk * 0.5, 0.7);
      else this.wave.set(this.point, 0, 0);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.75 * Math.exp(-after * 9);
    }
  }
}

export const tombOfKingsModule: EffectModule = {
  label: 'tomb of kings',
  category: 'hero: sand',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new TombOfKings(),
  telegraphs(effect) {
    const e = effect as TombOfKings;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TombOfKings;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as TombOfKings).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
    f.add(s, 'stun', 0, 1.2, 0.1);
  },
};
