import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst, ShockRefraction, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SKY_CSS, SpeedLines, WindCrescent, WindWraith } from '../../effects/parts/sky';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Crosswind (sky kit, Q: a cone, then a dash on the recast). Cast: wind gathers on his sword arm (0.25 s, a spiral and a
 * trailing crescent), then two crescents cut across each other into an X over the 3 m cone in front of him (a pink-tinted
 * one reversed), with a star pop, a refraction ring, speed lines and blown leaves; everyone inside the cone is hit.
 * Recast (within 2 s, the trait's free second cast at two thirds power: 28 of 42): a 3 m dash-slash along the aim. He slides
 * the 3 m (`ctx.moveCaster`, 0.18 s) leaving a jade afterimage and a long crescent along the path; everyone in the
 * 1.8 m wide strip is hit at 0.13 s. The effect tells the two apart itself: a second cast of the same caster figure within
 * 2.2 s is the dash (a clock per figure, so the other screen of a network duel, which replays both casts, agrees); the
 * `mode` setting forces one. The gust and the attack reset are the trait's (`src/traits/sky.ts`). Clean by 1.2 s.
 * Network duels: the other screen has no `moveCaster` (his client streams the dash), so the strip is judged on the nominal
 * 3 m path from `sentFrom` and the aim.
 */
export interface CrosswindSettings {
  damage: number;
  /** 'auto' reads the recast clock; 'cone' / 'dash' force a variant (the tool's play button). */
  mode: 'auto' | 'cone' | 'dash';
  loop: boolean;
}

export const defaultCrosswind = (): CrosswindSettings => ({ damage: 42, mode: 'auto', loop: false });

// Timeline (seconds).
const HIT_T = 0.25;
const DURATION = 1.2;
const CONE_ANGLE = 110;
const CONE_RADIUS = 3;
const DASH_LEN = 3;
const DASH_S = 0.18;
const DASH_HIT = 0.13;
const STRIP = 1.8;
const RECAST_CLOCK = 2200; // ms: a second cast inside this is the recast

/** When each caster figure last cast Crosswind, and whether that cast was the dash. */
const lastCast = new WeakMap<object, { at: number; dash: boolean }>();

export class Crosswind implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CrosswindSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** True when the last cast is the dash-slash. */
  dash = false;
  /** The cone of the last cast (from the caster toward the target) and the dash strip. */
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: CONE_RADIUS, angle: CONE_ANGLE, dir: 0 };
  strip: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: DASH_LEN, width: STRIP };
  private time = 0;
  private hit = false;

  // Cast geometry.
  private from = new THREE.Vector3();
  private end = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3(1, 0, 0);

  // Parts.
  private crescents = new WindCrescent(8);
  private gather = new GustRibbon(28);
  private trail = new GustRibbon(28);
  private lines = new SpeedLines(32);
  private leaves = new Leaves(20);
  private wraith = new WindWraith(3);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: SKY.accent, core: 0xfff0f5, additive: false });
  private shock = new ShockRefraction({ facing: 'camera' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: CrosswindSettings = defaultCrosswind()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    this.group.add(
      this.crescents.mesh, this.gather.mesh, this.trail.mesh, this.lines.mesh, this.leaves.mesh, this.wraith.mesh, this.pop.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return this.dash ? DASH_HIT : HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const now = performance.now();
    const prev = lastCast.get(ctx.caster);
    const auto = !!prev && !prev.dash && now - prev.at < RECAST_CLOCK;
    const m = this.settings.mode;
    this.dash = m === 'dash' || (m === 'auto' && auto);
    lastCast.set(ctx.caster, { at: now, dash: this.dash });
    const o = ctx.sentFrom ?? ctx.from;
    this.from.copy(this.dash ? o : ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.right.set(-Math.cos(ctx.aim), 0, Math.sin(ctx.aim));
    this.end.copy(this.from).addScaledVector(this.fwd, DASH_LEN);
    this.cone = { kind: 'cone', x: ctx.from.x, z: ctx.from.z, radius: CONE_RADIUS, angle: CONE_ANGLE, dir: ctx.aim };
    this.strip = { kind: 'line', x1: this.from.x, z1: this.from.z, x2: this.end.x, z2: this.end.z, width: STRIP };
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).addScaledVector(this.fwd, 2).setY(1.1);
  }

  play() {
    this.reset();
    this.playing = true;
    if (this.dash) {
      this.startDash();
      return;
    }
    // 0..0.25: wind gathers on the sword arm, a crescent whirls there so the swing direction reads.
    this.v1.copy(this.from).addScaledVector(this.right, 0.45).addScaledVector(this.fwd, 0.3).setY(0.45);
    this.gather.spiral(this.v1, 0.34, 1.0, 2, 0.4, 0.14);
    this.v1.copy(this.from).addScaledVector(this.right, 0.5).setY(1.2);
    this.crescents.slash(this.v1, this.right, 1.1, 140, 0.5, 0.4, { width: 0.3, spin: -7, sweep: 0.25 });
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hit = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(SKY.dark);
    this.crescents.reset();
    this.gather.reset();
    this.trail.reset();
    this.lines.reset();
    this.leaves.reset();
    this.wraith.reset();
    this.pop.set(this.from, 0, 0);
    this.shock.set(this.from, 0, 0);
  }

  /** The recast: the slide, an afterimage left standing, a long crescent and a ribbon along the path. */
  private startDash() {
    const ctx = this.ctx;
    if (ctx?.moveCaster) this.end.copy(ctx.moveCaster(this.end, DASH_S)).setY(0);
    const s = this.strip as Extract<TelegraphShape, { kind: 'line' }>;
    s.x2 = this.end.x;
    s.z2 = this.end.z;
    this.v1.copy(this.from).setY(0);
    this.wraith.show(this.v1, this.fwd, 0.4, 2, 1.2, 0.75);
    this.v2.lerpVectors(this.from, this.end, 0.5).setY(1.1);
    this.crescents.slash(this.v2, this.fwd, 1.9, 120, 0.25, 0.5, { width: 0.6, sweep: 0.1 });
    this.crescents.slash(this.v2, this.fwd, 1.9, 120, -0.25, 0.5, { width: 0.45, sweep: 0.12, reverse: true, tone: 0.6 });
    this.v3.copy(this.from).setY(0.9);
    this.v2.lerpVectors(this.from, this.end, 0.5).setY(1.3);
    this.trail.along([this.v3.clone(), this.v2.clone(), this.v1.copy(this.end).setY(0.9)], 0.22, 0.4);
    this.v1.copy(this.from).setY(0);
    this.lines.sweep(this.v1, this.end, 12, 2.2);
    this.leaves.blow(this.v2.copy(this.from).setY(0.5), this.right, 5, 4);
    this.shake = 0.08;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crescents.update(dt);
    this.gather.update(dt);
    this.trail.update(dt);
    this.lines.update(dt);
    this.leaves.update(dt);
    this.wraith.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const at = this.dash ? DASH_HIT : HIT_T;

    if (!this.hit && t >= at) {
      this.hit = true;
      if (this.dash) this.slash();
      else this.swing();
    }

    this.screen.impact = this.dash ? 0 : impactFrameAt(t, HIT_T, [1], 0.03);
    if (this.hit) {
      const after = t - at;
      const sp = StarBurst.pop(after, 0, 0.02);
      if (this.dash) this.v1.copy(this.end).addScaledVector(this.fwd, 0.4).setY(1.1);
      else this.v1.copy(this.from).addScaledVector(this.fwd, 2.2).setY(1.15);
      this.pop.set(this.v1, (this.dash ? 0.7 : 1.0) * sp.scale, sp.opacity, 0.2);
      const p = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.shock.set(this.v1, 0.3 + 1.4 * p, 0.045 * (1 - p) * (1 - p));
      this.shake = (this.dash ? 0.1 : 0.16) * Math.exp(-after * 14);
    }
  }

  /** The cross-cut: two crescents sweep the cone from opposite ends, the cone's occupants are hit. */
  private swing() {
    const ctx = this.ctx;
    this.v1.copy(this.from).setY(1.15);
    this.crescents.slash(this.v1, this.fwd, 2.9, 110, 0.85, 0.55, { width: 0.65, sweep: 0.1 });
    this.crescents.slash(this.v1, this.fwd, 2.9, 110, -0.85, 0.55, { width: 0.6, reverse: true, sweep: 0.1, tone: 0.5 });
    this.v2.copy(this.from).addScaledVector(this.fwd, 1.5).setY(1.1);
    this.lines.burst(this.v2, this.fwd, 10, 1.9);
    this.v2.copy(this.from).addScaledVector(this.fwd, 1.5).setY(0.9);
    this.leaves.blow(this.v2, this.fwd, 9, 7);
    if (!ctx) return;
    // Re-check at the swing: everyone still inside the cone is hit.
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 2, from: ctx.from, color: SKY_CSS.body });
    }
  }

  /** The dash-slash lands: everyone in the strip along the path is hit. */
  private slash() {
    const ctx = this.ctx;
    this.v1.copy(this.end).setY(0.5);
    this.leaves.blow(this.v1, this.fwd, 8, 6);
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.strip, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 2.5, from: this.from, color: SKY_CSS.body });
    }
  }
}

export const crosswindModule: EffectModule = {
  label: 'crosswind',
  category: 'hero: sky',
  targeting: { mode: 'enemies', maxTargets: 10 },
  create: () => new Crosswind(),
  telegraphs(effect) {
    const e = effect as Crosswind;
    if (!e.ctx) return [];
    return e.dash ? [{ shape: e.strip, start: 0, impact: DASH_HIT }] : [{ shape: e.cone, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Crosswind;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as Crosswind).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'mode', ['auto', 'cone', 'dash']);
  },
};
