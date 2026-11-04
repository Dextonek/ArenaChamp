import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { GROVE, GROVE_CSS, Bloom, Petals, Pollen, RootRing, SpiralVine } from '../../effects/parts/grove';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { NEAR_FLOWER_R, flowersOf } from '../../traits/grove';

/**
 * Strangle Vine (grove kit v5, W: a targeted root, `projectile` hit). A click on the enemy (7 m, line of sight checked by the
 * engine at the cast) with a 0.5 s wind-up: two vines run along the ground from her feet toward the enemy and a red circle
 * marks it (she is rooted by the engine until it lands). At 0.5 s the vines are on the enemy: 30 damage and rooted 1.0 s, or
 * 1.4 s if the enemy is within 3 m of one of her flowers at that moment (`NEAR_FLOWER_R`, her list in `src/traits/grove.ts`).
 * The hit is `projectile: true`: the target cannot walk out of it once it has landed; the answer is range (7 m) and sight at
 * the cast. Six vines of different reach, thickness and coil spiral up the figure with an irregular outline (re-sampled every
 * frame on the enemy's live feet, so they follow it), a root ring at its feet shows the hold, and when the root was lengthened
 * by a flower two pink blooms open on the vines. They wither when the root ends. No flower is planted. Clean by about 2.6 s.
 */
export interface StrangleVineSettings {
  damage: number;
  /** Root seconds, and the seconds when the enemy is within 3 m of a flower. */
  root: number;
  rootNear: number;
  loop: boolean;
}

export const defaultStrangleVine = (): StrangleVineSettings => ({ damage: 30, root: 1.0, rootNear: 1.4, loop: false });

// Timeline (seconds).
const LAND_T = 0.5;
const WITHER_S = 0.45;
const MARK_R = 1.0; // the red circle on the enemy

const TAU = Math.PI * 2;

/** One clinging vine's shape: coil radius, height, turns, phase and width. Different on each, so the outline is ragged. */
const COILS: { r: number; h: number; n: number; ph: number; w: number }[] = [
  { r: 0.42, h: 2.2, n: 3.0, ph: 0, w: 0.2 },
  { r: 0.34, h: 1.7, n: 2.2, ph: 2.1, w: 0.17 },
  { r: 0.5, h: 2.5, n: 2.6, ph: 4.2, w: 0.24 },
  { r: 0.3, h: 1.3, n: 3.6, ph: 1.1, w: 0.15 },
  { r: 0.46, h: 1.9, n: 1.9, ph: 3.2, w: 0.19 },
  { r: 0.36, h: 2.4, n: 3.3, ph: 5.3, w: 0.16 },
];

export class StrangleVine implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StrangleVineSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private landed = false;
  private withered = false;
  private rootS = 1.0;
  private boosted = false;

  private start = new THREE.Vector3();
  private foe = new THREE.Vector3();

  private reach = [new SpiralVine(30, 6, 3), new SpiralVine(30, 6, 3)];
  private coils = COILS.map(() => new SpiralVine(30, 6, 3));
  private blooms = [new Bloom(), new Bloom()];
  private roots = new RootRing();
  private petals = new Petals(30);
  private pollen = new Pollen(30);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: GROVE.accent, core: GROVE.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(settings: StrangleVineSettings = defaultStrangleVine()) {
    this.settings = settings;
    this.screen.impactColor.set(GROVE.hot);
    this.screen.tint.set(GROVE.dark);
    this.group.add(
      this.roots.mesh, ...this.reach.map((v) => v.mesh), ...this.coils.map((v) => v.mesh), ...this.blooms.map((b) => b.mesh),
      this.petals.mesh, this.pollen.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return LAND_T + this.settings.rootNear + WITHER_S + 0.6;
  }

  get impactTime() {
    return LAND_T;
  }

  /** The enemy's live feet, for the red circle. */
  get markAt() {
    return this.foe;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.foe.copy(this.target ? this.target.group.position : ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.foe).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
    // The wind-up: two vines run along the ground from her feet to the enemy, wavering, arriving as the hit lands.
    this.reach.forEach((v, i) => {
      const side = i ? -1 : 1;
      v.growAlong((u, out) => {
        const wob = Math.sin(u * 9 + i * 2) * 0.35 * Math.sin(u * Math.PI) * side;
        const dx = this.foe.x - this.start.x, dz = this.foe.z - this.start.z, len = Math.hypot(dx, dz) || 1;
        return out.set(this.start.x + dx * u - (dz / len) * wob, 0.12 + 0.1 * Math.sin(u * 5 + i), this.start.z + dz * u + (dx / len) * wob);
      }, 0.2, LAND_T * 0.9, 0.04 * i);
    });
    this.pollen.puff(this.v1.copy(this.start).setY(0.5), 6);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = this.withered = this.boosted = false;
    this.rootS = this.settings.root;
    clearScreenFx(this.screen);
    this.screen.tint.set(GROVE.dark);
    for (const v of [...this.reach, ...this.coils]) v.reset();
    for (const b of this.blooms) b.reset();
    this.roots.reset();
    this.petals.reset();
    this.pollen.reset();
    this.pop.set(this.foe, 0, 0);
    this.groundShock.set(this.foe, 0, 0);
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const v of [...this.reach, ...this.coils]) v.update(dt);
    this.roots.update(dt);
    this.petals.update(dt);
    this.pollen.update(dt);
    this.time += dt;
    this.liveFoe();
    if (this.time >= this.duration) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;

    if (!this.landed && t >= LAND_T) {
      this.landed = true;
      this.land();
    }
    if (this.landed) {
      const a = t - LAND_T;
      // The root ends: the vines brown and sink, the blooms shed.
      if (!this.withered && a >= this.rootS) {
        this.withered = true;
        for (const v of this.coils) v.wither(WITHER_S, 0.05 * Math.random());
        for (const v of this.reach) v.wither(WITHER_S);
        this.blooms.forEach((b) => b.shed(0.5));
        this.roots.fade(0.4);
        this.petals.burst(this.v1.copy(this.foe).setY(1), 8, 2.6);
      }
      const hp = StarBurst.pop(a, 0.02, 0.05);
      this.pop.set(this.v1.copy(this.foe).setY(1.3), 1.0 * hp.scale + 1e-3, hp.opacity, 0.3);
      const g = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.groundShock.set(this.v1.set(this.foe.x, 0, this.foe.z), 0.4 + 1.5 * g, 0.03 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * 0.9, 0.16 * Math.exp(-a * 12));
      // The blooms ride on the vines, wherever the enemy is.
      this.blooms.forEach((b, i) => b.pos.set(this.foe.x + (i ? 0.34 : -0.34), 1.45 + 0.35 * i, this.foe.z + (i ? -0.12 : 0.12)));
      this.blooms.forEach((b) => b.update(dt));
    } else {
      this.shake *= 0.9;
    }
    this.screen.darken = 0.12 * smoothstep(t / 0.3) * (1 - smoothstep((t - 1.2) / 0.6));
  }

  /** The vines close: the hit (live position), the coils up the figure, the root ring, and the longer root near a flower. */
  private land() {
    const ctx = this.ctx;
    this.boosted = false;
    if (ctx && this.target) {
      const p = this.target.group.position;
      this.boosted = flowersOf(ctx.caster).some((f) => Math.hypot(p.x - f.x, p.z - f.z) <= NEAR_FLOWER_R);
      this.rootS = this.boosted ? this.settings.rootNear : this.settings.root;
      // `projectile: true`: judged by the live position, it cannot be walked out of once it has landed.
      ctx.hit(this.target, {
        damage: this.settings.damage, knock: 0, color: GROVE_CSS.body, projectile: true,
        status: { kind: 'root', seconds: this.rootS },
      });
    } else {
      this.rootS = this.settings.root;
    }
    COILS.forEach((c, i) => {
      this.coils[i].growAlong((u, out) => {
        const a = c.ph + c.n * TAU * u;
        const env = Math.min(1, u * 6);
        const r = c.r * (0.8 + 0.3 * Math.sin(u * 7 + c.ph)) * env;
        return out.set(this.foe.x + Math.cos(a) * r, 0.05 + c.h * u, this.foe.z + Math.sin(a) * r);
      }, c.w, 0.3, 0.025 * i);
    });
    this.roots.spread(this.v1.copy(this.foe), 1.5, 0.3);
    this.petals.burst(this.v1.copy(this.foe).setY(0.8), 8, 3);
    this.pollen.puff(this.v1.copy(this.foe).setY(1.0), 8);
    if (this.boosted) this.blooms.forEach((b, i) => b.open(this.v1.set(this.foe.x, 1.45 + 0.35 * i, this.foe.z), 0.5, 0.4));
    this.shake = 0.16;
  }
}

export const strangleVineModule: EffectModule = {
  label: 'strangle vine',
  category: 'hero: grove',
  // Click an enemy: the hit always lands (`projectile`) once the 0.5 s wind-up holds; the wind-up is the warning.
  targeting: { mode: 'enemy' },
  create: () => new StrangleVine(),
  telegraphs(effect) {
    const e = effect as StrangleVine;
    if (!e.ctx) return [];
    // The mark on the enemy for the wind-up, read live at the cast.
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as StrangleVine;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as StrangleVine).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
    f.add(s, 'root', 0.2, 1.5, 0.1);
    f.add(s, 'rootNear', 0.2, 1.5, 0.1);
  },
};
