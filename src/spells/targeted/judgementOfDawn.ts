import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightPanels, Sigil, SunRays, dawnEaseOut, dawnFacing, dawnForward, dawnOrient, type PanelShape,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Judgement of Dawn (dawn kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world goes
 * to a pre-dawn blue and a big sun-wheel sigil draws on. Above the point a colossal sword of hard light, point down,
 * is built from dozens of gold panels clicking in from the edges of the frame; a halo ring forms behind its hilt and
 * sun rays fan from it while the enemies are held. Its core lines brighten to white, dead beat, then it drives straight
 * down into the point: impact frames, a ring of panel shards bursts across the zone, a sky-blue star, sun rays from the
 * impact, ground refraction. The sword stands a moment, shatters into panels that shrink away, the light returns.
 * Clean by 4.5 s. See pipeline/designs/kit-dawn.md.
 */
export interface JudgementOfDawnSettings {
  damage: number;
  loop: boolean;
}

export const defaultJudgementOfDawn = (): JudgementOfDawnSettings => ({ damage: 125, loop: false });

// Timeline (seconds).
const BUILD_A = 0.3;
const BUILD_B = 1.6;
const GLOW_A = 1.6;
const DEAD_A = 1.85;
const DEAD_B = 2.0;
const HIT_T = 2.2;
const SHATTER_T = 3.0;
const DURATION = 4.5;

const RADIUS = 7;
const HOVER_TIP = 2.2; // height of the sword's tip while it hangs
const SCALE = 0.7; // the sword is built ~7 long and scaled by this
const DEBRIS = 28;
const UP = new THREE.Vector3(0, 1, 0);

interface Spec { x: number; y: number; ux: number; uy: number; shape: PanelShape; size: number; wide: number; color: number }

/** The sword's panels in the sword's own plane: x across (right), y up from the tip; (ux, uy) is the panel's own up. */
const SPECS: Spec[] = (() => {
  const s: Spec[] = [];
  const add = (x: number, y: number, ux: number, uy: number, shape: PanelShape, size: number, wide: number, color: number) =>
    s.push({ x, y, ux, uy, shape, size, wide, color });
  // Blade: a pointed tip piece, then five rows of a centre shard and two side shards (all pointing down), edge bevels.
  add(0, 0.8, 0, -1, 'shard', 1.7, 1.2, DAWN.hot);
  for (let r = 0; r < 5; r++) {
    const y = 1.6 + r * 0.86;
    add(0, y, 0, -1, 'shard', 1.14, 1.9, r % 2 === 0 ? DAWN.hot : DAWN.foil);
    add(-0.52, y - 0.05, -0.08, -1, 'shard', 1.02, 1.15, DAWN.body);
    add(0.52, y - 0.05, 0.08, -1, 'shard', 1.02, 1.15, DAWN.body);
  }
  add(-0.86, 2.6, 0, -1, 'shard', 1.5, 0.55, DAWN.foil);
  add(0.86, 2.6, 0, -1, 'shard', 1.5, 0.55, DAWN.foil);
  add(-0.84, 4.0, 0, -1, 'shard', 1.5, 0.55, DAWN.foil);
  add(0.84, 4.0, 0, -1, 'shard', 1.5, 0.55, DAWN.foil);
  // Guard: two long shards pointing out, a hex in the middle and at the ends, two wings rising from it.
  add(-1.1, 5.35, -1, 0, 'shard', 2.1, 1.05, DAWN.body);
  add(1.1, 5.35, 1, 0, 'shard', 2.1, 1.05, DAWN.body);
  add(0, 5.35, 0, 1, 'hex', 0.95, 1, DAWN.foil);
  add(-2.25, 5.35, 0, 1, 'hex', 0.55, 1, DAWN.hot);
  add(2.25, 5.35, 0, 1, 'hex', 0.55, 1, DAWN.hot);
  add(-1.3, 5.75, -0.6, 0.8, 'shard', 1.5, 0.9, DAWN.hot);
  add(1.3, 5.75, 0.6, 0.8, 'shard', 1.5, 0.9, DAWN.hot);
  // Grip and pommel.
  add(0, 5.85, 0, 1, 'hex', 0.5, 0.85, DAWN.body);
  add(0, 6.25, 0, 1, 'hex', 0.5, 0.85, DAWN.hot);
  add(0, 6.65, 0, 1, 'hex', 0.5, 0.85, DAWN.body);
  add(0, 7.15, 0, 1, 'hex', 0.9, 1, DAWN.foil);
  return s;
})();

export class JudgementOfDawn implements Effect {
  readonly group = new THREE.Group();
  readonly settings: JudgementOfDawnSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -6);
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private nrm = new THREE.Vector3(0, 0, 1);
  private base = new THREE.Vector3();
  private haloC = new THREE.Vector3();

  private flags = { asm: false, hit: false, shatter: false };

  // Parts.
  private sigil = new Sigil();
  private sword = new LightPanels(SPECS.length, 6);
  private debris = new LightPanels(DEBRIS, 8);
  private halo = new HaloRing();
  private rays = new SunRays(12, 0.3);
  private impactRays = new SunRays(10, 0.34, DAWN.core);
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();

  constructor(settings: JudgementOfDawnSettings = defaultJudgementOfDawn()) {
    this.settings = settings;
    this.screen.tint.set('#1a2238');
    this.screen.impactColor.set(DAWN.foil);
    this.impactRays.mesh.renderOrder = 4;
    this.group.add(
      this.sigil.mesh, this.rays.mesh, this.impactRays.mesh, this.halo.mesh, this.sword.mesh, this.debris.mesh,
      this.star.mesh, this.groundShock.mesh,
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
    dawnForward(ctx.aim, this.fwd);
    dawnFacing(ctx.aim, this.nrm);
    this.right.crossVectors(UP, this.nrm).normalize();
    this.base.copy(this.point).addScaledVector(this.fwd, 0.3);
    this.rays.face(ctx.aim);
    this.impactRays.face(ctx.aim);
    this.screen.focus.copy(this.point).setY(1.5);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.sword.mesh];
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.asm = f.hit = f.shatter = false;
    clearScreenFx(this.screen);
    this.screen.tint.set('#1a2238');
    this.screen.impactColor.set(DAWN.foil);
    this.sigil.reset();
    this.sword.reset();
    this.debris.reset();
    this.halo.reset();
    this.rays.reset();
    this.impactRays.reset();
    this.star.set(this.point, 1e-3, 0);
    this.groundShock.set(this.point, 0, 0);
    if (this.ctx) for (const e of this.ctx.targets) this.ctx.displace(e, this.v1.set(0, 0, 0));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const beat = this.time >= DEAD_A && this.time < DEAD_B;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    if (!f.asm && t >= BUILD_A) {
      f.asm = true;
      this.layout();
      this.sword.assemble(0.5, BUILD_B - BUILD_A - 0.5, 16);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.75;
      this.burstShards();
      if (ctx) {
        for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 6, from: this.point, color: DAWN_CSS.body });
      }
    }
    if (!f.shatter && t >= SHATTER_T) {
      f.shatter = true;
      this.v1.copy(this.base).setY(4.5);
      this.sword.shatter(6, 1.2, this.v1);
    }

    this.layout();
    if (!beat) {
      this.halo.spin(dt);
      this.sword.update(dt);
      this.debris.update(dt);
    }
  }

  /** A ring of panel shards bursts outward across the whole zone. */
  private burstShards() {
    for (let i = 0; i < DEBRIS; i++) {
      const a = (i / DEBRIS) * Math.PI * 2 + (i % 3) * 0.08;
      this.v2.set(Math.cos(a), 0, Math.sin(a));
      this.v1.copy(this.point).addScaledVector(this.v2, 0.8 + (i % 4) * 0.25).setY(0.35);
      const shard = i % 2 === 0;
      this.v3.copy(this.v2).multiplyScalar(6.5 + (i % 5) * 1.1 + Math.random());
      this.v3.y = 3 + Math.random() * 3;
      this.debris.place(i, this.v1, dawnOrient(UP, this.v2, this.q1), shard ? 1.1 + (i % 3) * 0.25 : 0.55 + (i % 3) * 0.15, shard ? 'shard' : 'hex', shard ? 1.3 : 1,
        i % 4 === 0 ? DAWN.foil : i % 4 === 1 ? DAWN.hot : DAWN.body);
      this.debris.fling(i, this.v3, 1.15 + Math.random() * 0.2, 6);
    }
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = t - HIT_T;
    const out = 1 - smoothstep((t - 3.4) / 0.9);

    // --- Screen: pre-dawn blue, lifts at the end; impact frames [1, 2] at the hit. ---
    this.screen.darken = 0.55 * smoothstep(t / 0.4) * out;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The sigil draws on (0.05..0.55), centre hidden for the sword; fades with the light. ---
    this.sigil.set(this.point, RADIUS);
    this.sigil.hide = 0.12;
    this.sigil.reveal = smoothstep((t - 0.05) / 0.5);
    this.sigil.opacity = 1 - smoothstep((t - 3.4) / 0.8);

    // --- The sword: hangs point down, pulls back a little before the strike, drives down 2.0..2.2. ---
    const pull = 0.3 * smoothstep((t - GLOW_A) / (DEAD_A - GLOW_A));
    const u = THREE.MathUtils.clamp((t - DEAD_B) / (HIT_T - DEAD_B), 0, 1);
    const tipY = HOVER_TIP + pull - (HOVER_TIP + pull - 0.3) * u * u;
    if (t >= BUILD_A && !f.shatter) {
      for (let i = 0; i < SPECS.length; i++) {
        const p = SPECS[i];
        this.v1.copy(this.base).addScaledVector(this.right, p.x * SCALE).setY(tipY + p.y * SCALE);
        this.v2.copy(this.right).multiplyScalar(p.ux).addScaledVector(UP, p.uy);
        dawnOrient(this.nrm, this.v2, this.q1);
        this.sword.place(i, this.v1, this.q1, p.size * SCALE, p.shape, p.wide, p.color);
      }
      this.sword.glow = smoothstep((t - GLOW_A) / (DEAD_A - GLOW_A)) * (1 - smoothstep((t - HIT_T - 0.05) / 0.6));
    }

    // --- The halo ring behind the hilt and the sun rays from it. ---
    this.haloC.copy(this.base).addScaledVector(this.fwd, 0.5).setY(tipY + 6.1 * SCALE);
    const haloIn = smoothstep((t - 0.7) / 0.6);
    this.halo.set(this.haloC, this.nrm, 1.7 * (0.4 + 0.6 * dawnEaseOut((t - 0.7) / 0.6)));
    this.halo.opacity = haloIn * (1 - smoothstep((t - SHATTER_T) / 0.4));
    const rayGrow = dawnEaseOut((t - 0.9) / 0.8);
    this.rays.fan(this.haloC, UP, 12, 6.5, Math.PI, rayGrow);
    this.rays.fade(t < 0.9 ? 0 : (1 - smoothstep((t - HIT_T) / 0.45)) * (0.55 + 0.45 * smoothstep((t - GLOW_A) / 0.25)));

    // --- Enemies are held: pulled 0.4 of the way to the centre, released after the hit. ---
    if (ctx) {
      const k = smoothstep((t - 0.6) / 0.9) * (1 - smoothstep((t - 3.0) / 0.5));
      ctx.targets.forEach((e, i) => {
        const p = ctx.targetPos[i];
        if (p) ctx.displace(e, this.v2.set(this.point.x - p.x, 0, this.point.z - p.z).multiplyScalar(0.4 * k));
      });
    }

    // --- The hit: sun rays from the impact, the sky-blue star, ground refraction 1 -> 12, shake. ---
    if (f.hit) {
      this.v1.copy(this.point).setY(0.6);
      this.impactRays.fan(this.v1, UP, 9, 7, 1.3, dawnEaseOut(after / 0.25));
      this.impactRays.fade(1 - smoothstep(after / 0.9));
      const sp = StarBurst.pop(after, 0.02, 0.05);
      this.star.set(this.v2.copy(this.point).setY(1.6), 2.0 * sp.scale + 1e-3, sp.opacity, 0.15);
      const gp = THREE.MathUtils.clamp(after / 0.55, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.75 * Math.exp(-after * 7);
    } else if (t >= DEAD_B) {
      this.shake = 0.1 * smoothstep((t - DEAD_B) / 0.2);
    }
  }
}

export const judgementOfDawnModule: EffectModule = {
  label: 'judgement of dawn',
  category: 'hero: dawn',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new JudgementOfDawn(),
  telegraphs(effect) {
    const e = effect as JudgementOfDawn;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as JudgementOfDawn;
    if (e.ctx) frameCast(camera, controls, e.ctx, 12);
  },
  buildGui(f, effect) {
    const s = (effect as JudgementOfDawn).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
