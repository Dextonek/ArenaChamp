import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import { CutShape, CutShards, ShadowPool, ShadowWisps, SHADOW, facing } from '../../effects/parts/shadow';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { NIGHT_SECONDS, watchCover } from '../../traits/shadow';

/**
 * Nightfall (shadow kit, R: a self spell, no hits). For `NIGHT_SECONDS` (5 s) the arena darkens: the effect's screen fx (`screen.darken`
 * to 0.55 over 0.5 s with a deep violet tint, held, then back over 0.5 s; not an overlay) and `reset()` clears it. A pale moon crescent hangs
 * over the arena for the whole time (the pale foil of the kit, so the dark has a light), a black pool with a violet rim and a foil ring
 * spreads round her at the start and a ring of black flakes goes up with it, and slow wisps rise from the pool's edge. Her own rules are
 * the trait's (`src/traits/shadow.ts`): 25% faster (haste), 20% more damage (might), fades 0.8 s after each hit, a brighter ring at her feet,
 * and a 1 s slow at the end. No telegraph (it hits nothing). Clean by 5.5 s. See pipeline/designs/kit-shadow.md.
 */
export interface NightfallSettings {
  darkness: number;
  loop: boolean;
}

export const defaultNightfall = (): NightfallSettings => ({ darkness: 0.55, loop: false });

const RAMP = 0.5;
const DURATION = NIGHT_SECONDS + RAMP;
const POOL_R = 4.5;

export class Nightfall implements Effect {
  readonly group = new THREE.Group();
  readonly settings: NightfallSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private spot = new THREE.Vector3();
  private moonAt = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private emitDebt = 0;
  private shrunk = false;

  // Parts.
  private pool = new ShadowPool();
  private wisps = new ShadowWisps(40);
  private shards = new CutShards(24);
  private moon = new CutShape({ kind: 'crescent', fill: SHADOW.foil, edgeColor: SHADOW.hot, edgeWidth: 0.16, renderOrder: 2 });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private n = new THREE.Vector3();

  constructor(settings: NightfallSettings = defaultNightfall()) {
    this.settings = settings;
    this.screen.tint.set(0x2a1458);
    this.group.add(this.pool.mesh, this.wisps.mesh, this.shards.mesh, this.moon.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return 0.3;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    watchCover(ctx);
    this.spot.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    // The moon hangs ahead of her and high, inside the gameplay frame.
    this.moonAt.copy(this.spot).addScaledVector(this.fwd, 7).setY(7);
    this.screen.focus.copy(this.spot).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
    this.pool.spread(this.spot, POOL_R, 0);
    this.shards.burst(this.v1.copy(this.spot).setY(0.4), POOL_R * 0.7, 18, 4, 3, 0.9);
    this.shake = 0.18;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.emitDebt = 0;
    this.shrunk = false;
    clearScreenFx(this.screen);
    this.pool.reset();
    this.wisps.reset();
    this.shards.reset();
    this.moon.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
    this.wisps.update(dt);
    this.shards.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    this.layout(this.time, dt);
    this.shake *= Math.exp(-dt * 9);
  }

  private layout(t: number, dt: number) {
    // --- The arena darkens: in over 0.5 s, held, out over the last 0.5 s. ---
    const dark = smoothstep(t / RAMP) * (1 - smoothstep((t - NIGHT_SECONDS) / RAMP));
    this.screen.darken = this.settings.darkness * dark;
    this.screen.edgeTint.set(SHADOW.body);
    // --- The pool round her: spreads in 0.5 s, thins away from 1.8 s. ---
    this.pool.spread(this.spot, POOL_R, smoothstep(t / 0.5));
    if (!this.shrunk && t >= 1.8) {
      this.shrunk = true;
      this.pool.shrink(0.8);
    }
    // --- The moon: fades in, hangs, fades out with the dark. ---
    this.moon.place(this.moonAt, facing(this.ctx?.aim ?? 0, this.n), 1.7 + 0.04 * Math.sin(t * 1.5), 0.35);
    this.moon.opacity = 0.92 * dark;
    // --- Slow wisps rise from the pool's edge in the first 3 s. ---
    if (t < 3) {
      this.emitDebt += dt * 9;
      while (this.emitDebt >= 1) {
        this.emitDebt -= 1;
        const a = Math.random() * Math.PI * 2, r = POOL_R * (0.55 + 0.4 * Math.random());
        this.v1.set(this.spot.x + Math.cos(a) * r, 0.1, this.spot.z + Math.sin(a) * r);
        this.v2.set(Math.cos(a + 1.57) * 0.5, 0.7 + Math.random() * 0.5, Math.sin(a + 1.57) * 0.5);
        this.wisps.emit(this.v1, this.v2, 0.3 + Math.random() * 0.3, 1.0 + Math.random() * 0.8);
      }
    }
  }
}

export const nightfallModule: EffectModule = {
  label: 'nightfall',
  category: 'hero: shadow',
  // Self, no hits: the radius only lets the CPU cast it when the enemy is within about 8.4 m (its trait holds it past 8 m).
  targeting: { mode: 'self', radius: 9 },
  create: () => new Nightfall(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Nightfall;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Nightfall).settings;
    f.add(s, 'loop');
    f.add(s, 'darkness', 0.1, 0.9, 0.05);
  },
};
