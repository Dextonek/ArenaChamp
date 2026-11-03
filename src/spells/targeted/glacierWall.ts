import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  FROST, FROST_CSS, FrostBreath, FrostFerns, IceCrystals, RimeSleeves, Snow,
} from '../../effects/parts/frost';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { wall, type Obstacle } from '../../obstacles';

/**
 * Glacier Wall (frost kit, R: a terrain wall). Isolde raises her hands and breathes; a red strip marks the line, then
 * a wall of ice crystals bursts out of the floor across it, 7 m long, perpendicular to the line from her to the aim
 * point (range 10). It is a real obstacle (`ctx.addObstacle`): it blocks walking, sight and bolts for both heroes and
 * the AI for 4 s. Whoever stands on the line when it rises is hit, slowed and shoved out to the nearer side. Near the
 * end the crystals flare and crack, then the wall shatters and the obstacle goes. See pipeline/designs/kit-shapes-v3.md.
 *
 * Both screens of a network duel build the same wall: its geometry comes only from `ctx.sentFrom` and `ctx.point`.
 * Each screen decides the hit on its own hero (the one in `ctx.targets`), judged by the live position.
 */
export interface GlacierWallSettings {
  damage: number;
  /** Slow seconds on the hit (engine cap 2.5). */
  slow: number;
  loop: boolean;
}

export const defaultGlacierWall = (): GlacierWallSettings => ({ damage: 58, slow: 1.5, loop: false });

// Timeline (seconds).
const RISE_T = 0.45; // the wall bursts up, the hit lands
const LIFE = 4; // seconds the obstacle stands
const SHATTER_T = RISE_T + LIFE;
const CRACK_T = SHATTER_T - 0.8;
const DURATION = SHATTER_T + 1.1;

const LENGTH = 7;
const RANGE = 10;
const MIN_DIST = 2.5; // closest the line may rise to her
const THICK = 0.5; // half thickness of the obstacle
const HIT_DIST = 1.0; // from the wall line (the telegraph is 0.2 wider each side)
const CLEAR = THICK + 0.5 + 0.15; // where a shoved body ends, from the line
const BIG = 11;
const SMALL = 10;
const MAX_VIS = 4;

const hash = (i: number) => Math.abs(Math.sin(i * 78.233 + 1.7) * 43758.5453) % 1;

export class GlacierWall implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GlacierWallSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Wall geometry (ground plane), computed in cast() from sentFrom and point only.
  readonly a = new THREE.Vector3();
  readonly b = new THREE.Vector3();
  private centre = new THREE.Vector3(0, 0, 4);
  /** Unit direction from her toward the wall, and the unit along the wall. */
  private d = new THREE.Vector3(0, 0, -1);
  private perp = new THREE.Vector3(1, 0, 0);
  private from = new THREE.Vector3(0, 0, 14);
  private chest = new THREE.Vector3(0, 1.25, 14);

  private flags = { breath: false, rise: false, crack1: false, crack2: false, crack3: false, shatter: false };
  private obstacle: Obstacle | null = null;
  private obstacleCtx: CastContext | null = null;
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];
  private hitT = -1;

  // Parts.
  private breath = new FrostBreath(14);
  private wallIce = new IceCrystals({ maxSpikes: BIG + SMALL + 4, maxShards: 220 });
  private ferns = [0, 1, 2].map((i) => new FrostFerns({ variant: i % 2, maxShards: i === 1 ? 24 : 0 }));
  private sleeves = new RimeSleeves(MAX_VIS);
  private snow = new Snow({ max: 60 });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: FROST.accent, core: 0xfff0f6, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private zero = new THREE.Vector3();

  constructor(settings: GlacierWallSettings = defaultGlacierWall()) {
    this.settings = settings;
    this.screen.impactColor.set(FROST.rime);
    this.screen.tint.set(FROST.dark);
    this.ferns.forEach((f, i) => { f.renderOrder = 1 + (i % 2); });
    this.snow.size = 1.2;
    this.group.add(
      ...this.ferns.map((f) => f.mesh), this.sleeves.mesh, this.wallIce.mesh, this.snow.mesh, this.breath.mesh,
      this.pop.mesh, this.groundShock.mesh,
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
    // Both screens must agree on the wall: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = 4; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, RANGE);
    this.d.set(dx, 0, dz);
    this.perp.set(-dz, 0, dx);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
    this.a.copy(this.centre).addScaledVector(this.perp, -LENGTH / 2);
    this.b.copy(this.centre).addScaledVector(this.perp, LENGTH / 2);
    this.chest.set(ctx.from.x, 1.25, ctx.from.z).addScaledVector(this.d, 0.15);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.wallIce.mesh];
    this.screen.focus.copy(this.centre).setY(1.5);
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
    this.hitT = -1;
    this.victims.length = 0;
    this.dropObstacle();
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(FROST.dark);
    this.breath.reset();
    this.wallIce.reset();
    this.wallIce.flare = 0;
    for (const f of this.ferns) f.reset();
    this.sleeves.clear();
    this.snow.reset();
    this.pop.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
  }

  /** Distance from a ground point to the wall line, the side it is on (+1 / -1 along `d`) and its offset along `d`. */
  private against(p: THREE.Vector3) {
    const ex = this.b.x - this.a.x, ez = this.b.z - this.a.z, l2 = ex * ex + ez * ez;
    const t = THREE.MathUtils.clamp(((p.x - this.a.x) * ex + (p.z - this.a.z) * ez) / l2, 0, 1);
    const cx = this.a.x + ex * t, cz = this.a.z + ez * t;
    const off = (p.x - cx) * this.d.x + (p.z - cz) * this.d.z;
    return { dist: Math.hypot(p.x - cx, p.z - cz), off };
  }

  private buildWall() {
    const base = this.v1, dir = this.v2;
    // Tall front line, leaning a little to alternate sides, then a shorter second row staggered in front.
    for (let i = 0; i < BIG; i++) {
      const s = (i / (BIG - 1) - 0.5) * (LENGTH - 0.5);
      const lean = (i % 2 ? 1 : -1) * (0.12 + 0.12 * hash(i));
      base.copy(this.centre).addScaledVector(this.perp, s);
      dir.set(0, 1, 0).addScaledVector(this.d, lean).addScaledVector(this.perp, (hash(i + 9) - 0.5) * 0.2).normalize();
      this.wallIce.spike(base, dir, 2.7 + 0.8 * hash(i + 3), 0.95, 0.24, Math.abs(s) / LENGTH * 0.22);
    }
    for (let i = 0; i < SMALL; i++) {
      const s = ((i + 0.5) / SMALL - 0.5) * (LENGTH - 0.3);
      const side = i % 2 ? 1 : -1;
      base.copy(this.centre).addScaledVector(this.perp, s).addScaledVector(this.d, side * 0.5);
      dir.set(0, 1, 0).addScaledVector(this.d, side * 0.4).normalize();
      this.wallIce.spike(base, dir, 1.3 + 0.7 * hash(i + 21), 0.7, 0.2, 0.04 + Math.abs(s) / LENGTH * 0.2);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.breath.update(dt);
    this.wallIce.update(dt);
    for (const f of this.ferns) f.update(dt);
    this.snow.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.finish();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.breath && t >= 0.02) {
      f.breath = true;
      this.breath.blow(this.chest, this.v1.copy(this.d).setY(0.2), 1.2, 0.25);
    }
    if (!f.rise && t >= RISE_T) {
      f.rise = true;
      this.hitT = t;
      this.rise(ctx);
    }
    if (f.rise && !f.shatter) {
      // Cracking: the crystals flare pale in pulses and shed splinters, faster toward the end.
      const crackK = smoothstep((t - CRACK_T) / (SHATTER_T - CRACK_T));
      this.wallIce.flare = crackK > 0 ? 0.75 * crackK * (0.5 + 0.5 * Math.sin(t * (14 + 22 * crackK))) : 0;
      const beats: [keyof typeof f, number][] = [['crack1', CRACK_T], ['crack2', CRACK_T + 0.3], ['crack3', CRACK_T + 0.55]];
      for (const [k, at] of beats) {
        if (f[k] || t < at) continue;
        f[k] = true;
        for (let n = 0; n < 5; n++) {
          this.v1.copy(this.centre).addScaledVector(this.perp, (Math.random() - 0.5) * LENGTH).setY(1.2 + Math.random() * 2);
          this.wallIce.shards.burst(this.v1, 4, 2.5, 0.35, 0.14);
        }
        this.shake = Math.max(this.shake, 0.12);
      }
    }
    if (!f.shatter && t >= SHATTER_T) {
      f.shatter = true;
      this.dropObstacle();
      this.wallIce.flare = 0;
      this.wallIce.shatter(5, 5.5, 0.35);
      for (const fe of this.ferns) fe.shatter(0.8);
      this.sleeves.clear();
      this.snow.fall(this.centre, 3.8, 24, 5, 1.3);
      this.shake = 0.35;
    }
    this.layout();
  }

  /** The wall comes up: the obstacle, the crystals, and the hit on whoever stands on the line. */
  private rise(ctx: CastContext | null) {
    const feet = this.centre;
    this.buildWall();
    this.ferns[0].grow(this.v1.copy(feet).addScaledVector(this.perp, -2.4), 2.2, 0.4);
    this.ferns[1].grow(feet, 2.4, 0.4, 0.04);
    this.ferns[2].grow(this.v1.copy(feet).addScaledVector(this.perp, 2.4), 2.2, 0.4, 0.08);
    this.snow.scatter(this.v1.copy(feet).setY(1.2), 24, 2.4, 0.8);
    this.shake = 0.45;
    this.victims.length = 0;
    if (ctx) {
      // Whoever stands on the line is hit now (live position, so a body that stepped off is spared), then shoved out
      // to the nearer side by a carry (it sticks), before the wall exists.
      ctx.targets.forEach((e) => {
        const p = e.group.position;
        const { dist, off } = this.against(p);
        if (dist > HIT_DIST) return;
        const side = Math.abs(off) < 0.05 ? 1 : Math.sign(off);
        ctx.hit(e, {
          damage: this.settings.damage, knock: ctx.carry ? 0 : 6, color: FROST_CSS.body,
          from: p.clone().addScaledVector(this.d, -side), status: { kind: 'slow', seconds: this.settings.slow },
        });
        ctx.carry?.(e, new THREE.Vector3().copy(this.d).multiplyScalar(side * CLEAR - off));
        if (this.victims.length < MAX_VIS) this.victims.push({ enemy: e, feet: p.clone().setY(0) });
      });
      const o = { ...wall(this.a.x, this.a.z, this.b.x, this.b.z), r: THICK, height: 3.2 };
      this.obstacle = ctx.addObstacle ? ctx.addObstacle(o, LIFE) : null;
      this.obstacleCtx = this.obstacle ? ctx : null;
    }
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    this.reset();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const after = f.rise ? t - this.hitT : -1;

    // --- The impact: dark frame, accent star over the middle, ground shock along the wall. ---
    this.screen.darken = 0.3 * smoothstep((t - 0.1) / 0.3) * (1 - smoothstep((t - SHATTER_T) / 0.8));
    this.screen.impact = f.rise ? impactFrameAt(t, this.hitT, [1], 0.03) : 0;
    if (f.rise) {
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.v1.copy(this.centre).setY(1.4), 1.6 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(this.centre, 0.5 + 4 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.45 * Math.exp(-after * 9));
    }

    // --- Rime climbs whoever was caught on the line, and fades before the wall goes. ---
    const rimeOp = f.rise ? 1 - smoothstep((t - (RISE_T + 2.0)) / 0.8) : 0;
    for (let i = 0; i < MAX_VIS; i++) {
      const v = this.victims[i];
      if (!v) { this.sleeves.set(i, this.zero, 2.2, 1.0, 0, 0); continue; }
      this.sleeves.set(i, this.v1.copy(v.enemy.group.position).setY(0), 2.2, 1.0, smoothstep(after / 0.3), rimeOp);
    }
  }
}

export const glacierWallModule: EffectModule = {
  label: 'glacier wall',
  category: 'hero: frost',
  // The aim point is the middle of the wall; `radius` brings every enemy along its 7 m into `ctx.targets`.
  targeting: { mode: 'ground', radius: LENGTH / 2 + 0.5 },
  create: () => new GlacierWall(),
  telegraphs(effect) {
    const e = effect as GlacierWall;
    if (!e.ctx) return [];
    // The line the wall rises on; the hit is the dodge check at the rise, so the strip is the zone.
    return [{
      shape: { kind: 'line', x1: e.a.x, z1: e.a.z, x2: e.b.x, z2: e.b.z, width: (HIT_DIST + 0.2) * 2 },
      start: 0.05, impact: RISE_T,
    }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GlacierWall;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as GlacierWall).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
