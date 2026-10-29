import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  Afterimage, CutFlash, CutShape, CutShards, SHADOW, SHADOW_CSS, ShadowPool, facing, forward, shadowEaseOut,
} from '../../effects/parts/shadow';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Umbral Blink (shadow kit, Q: single-target dash strike). A black figure cut-out peels off Nyx, blinks to the target
 * in four stepped jumps (a trail of fading figures) and two crossed blade cut-outs slash through the target: mint cut,
 * a small shadow pool, one impact frame. The cut-outs then shatter into flat black shards and the pool shrinks. See
 * pipeline/designs/kit-shadow.md.
 */
export interface UmbralBlinkSettings {
  damage: number;
  loop: boolean;
}

export const defaultUmbralBlink = (): UmbralBlinkSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const PEEL_END = 0.15;
const DASH_END = 0.4; // the clone has arrived
const SLASH_T = 0.4; // blades start to slide in
const HIT_T = 0.45;
const SHATTER_T = 0.62;
const SHRINK_T = 1.1;
const DURATION = 1.5;
const STEPS = 4;
const CHEST_Y = 1.15;
const BLADE_ROT = 0.72;

export class UmbralBlink implements Effect {
  readonly group = new THREE.Group();
  readonly settings: UmbralBlinkSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private nrm = new THREE.Vector3(0, 0, 1);
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private chest = new THREE.Vector3(0, CHEST_Y, -6);

  private flags = { hit: false, shatter: false, shrink: false };

  // Parts.
  private clone = new CutShape({ kind: 'figure' });
  private trailFx = new Afterimage(STEPS);
  private blades = [new CutShape({ kind: 'blade', renderOrder: 6 }), new CutShape({ kind: 'blade', renderOrder: 6 })];
  private cuts = [new CutFlash(), new CutFlash()];
  private pool = new ShadowPool();
  private shards = new CutShards(24);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: UmbralBlinkSettings = defaultUmbralBlink()) {
    this.settings = settings;
    this.screen.tint.set(SHADOW.dark);
    this.screen.impactColor.set(SHADOW.foil);
    this.trailFx.size = 2.3;
    this.group.add(
      this.pool.mesh, this.trailFx.mesh, this.clone.mesh, ...this.blades.map((b) => b.mesh), this.shards.mesh,
      ...this.cuts.map((c) => c.mesh), this.groundShock.mesh,
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
    this.from.copy(ctx.from).setY(0);
    forward(ctx.aim, this.fwd);
    facing(ctx.aim, this.nrm);
    this.right.crossVectors(new THREE.Vector3(0, 1, 0), this.nrm).normalize();
    const tp = ctx.targetPos[0] ?? ctx.point;
    this.start.copy(this.from).addScaledVector(this.right, 0.9).setY(0.06);
    this.end.copy(tp).addScaledVector(this.fwd, -1.1).setY(0.06);
    this.chest.set(tp.x, CHEST_Y, tp.z);
    this.trailFx.face(ctx.aim);
    for (const c of this.cuts) c.face(ctx.aim);
    this.screen.focus.copy(this.chest);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.clone.mesh, ...this.blades.map((b) => b.mesh)];
    this.groundShock.set(tp, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.hit = f.shatter = f.shrink = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(SHADOW.foil);
    this.clone.reset();
    this.trailFx.reset();
    for (const b of this.blades) b.reset();
    for (const c of this.cuts) c.reset();
    this.pool.reset();
    this.shards.reset();
    this.groundShock.set(this.chest, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
    this.shards.update(dt);
    for (const c of this.cuts) c.update(dt);
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

    // Events.
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.25;
      for (let i = 0; i < 2; i++) {
        const a = i === 0 ? BLADE_ROT : -BLADE_ROT;
        this.v1.copy(this.right).multiplyScalar(Math.cos(a)).addScaledVector(this.v2.set(0, 1, 0), Math.sin(a));
        this.cuts[i].cut(this.chest, this.v1, 2.3);
      }
      if (ctx && ctx.targets[0]) {
        ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 2, from: ctx.from, color: SHADOW_CSS.hot });
      }
    }
    if (!f.shatter && t >= SHATTER_T) {
      f.shatter = true;
      this.shards.burst(this.chest, 1.0, 14, 3.4, 3.2, 0.8);
    }
    if (!f.shrink && t >= SHRINK_T) {
      f.shrink = true;
      this.pool.shrink(0.3);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const gone = t >= SHATTER_T;

    // --- 0..0.15 The figure peels off Nyx; 0.15..0.4 it blinks along the path in four stepped jumps. ---
    const peel = shadowEaseOut(t / PEEL_END);
    const s = (t - PEEL_END) / (DASH_END - PEEL_END);
    const step = Math.floor(THREE.MathUtils.clamp(s, 0, 1) * STEPS + 1e-6) / STEPS;
    this.v1.lerpVectors(this.start, this.end, step);
    if (t < PEEL_END) this.v2.lerpVectors(this.from, this.start, peel).setY(0.06);
    else this.v2.copy(this.v1);
    this.clone.place(this.v2, this.nrm, 2.3, 0);
    this.clone.opacity = gone ? 0 : smoothstep(t / 0.1);
    this.trailFx.trail(this.start, this.end, STEPS, t < PEEL_END ? 0 : s);

    // --- 0.4..0.62 Two crossed blades slide through the target and hold. ---
    const u = (t - SLASH_T) / 0.1;
    for (let i = 0; i < 2; i++) {
      const a = i === 0 ? BLADE_ROT : -BLADE_ROT;
      const off = -1.8 + 2.2 * shadowEaseOut(u);
      this.v1.copy(this.chest)
        .addScaledVector(this.right, Math.cos(a) * off)
        .addScaledVector(this.v2.set(0, 1, 0), Math.sin(a) * off);
      this.blades[i].place(this.v1, this.nrm, 3.7, a);
      this.blades[i].opacity = t >= SLASH_T && !gone ? 1 : 0;
    }

    // --- The small pool under the target: black over a pale foil, so the cut-outs read on the dark floor. ---
    if (this.ctx) {
      const tp = this.ctx.targetPos[0] ?? this.ctx.point;
      this.pool.spread(this.v1.set(tp.x, 0, tp.z), 1.9, smoothstep((t - 0.42) / 0.16));
    }

    // --- Impact frame (one frame), ground refraction and shake. ---
    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.03);
    if (this.flags.hit) {
      const after = t - HIT_T;
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      const tp = this.ctx?.targetPos[0] ?? this.ctx?.point ?? this.chest;
      this.groundShock.set(this.v1.set(tp.x, 0, tp.z), 0.5 + 3 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.25 * Math.exp(-after * 10);
    }
  }
}

export const umbralBlinkModule: EffectModule = {
  label: 'umbral blink',
  category: 'hero: shadow',
  targeting: { mode: 'enemy' },
  create: () => new UmbralBlink(),
  telegraphs(effect) {
    const e = effect as UmbralBlink;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.05, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as UmbralBlink;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as UmbralBlink).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
