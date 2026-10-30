import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  CutFlash, CutShape, SHADOW_CSS, ShadowHands, ShadowPool, facing, forward, shadowEaseOut, shadowEaseOutBack,
} from '../../effects/parts/shadow';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Grasp of the Deep (shadow kit, W: self burst, r 3, silences 1.0 s). A shadow pool with a pale foil disc spreads round
 * Nyx; flat black hands rise out of it around and under the enemies with their fingers spread. At the hit they close and pull the enemies
 * down a little, a ring of upright blade cut-outs snaps up around the edge and the ground rings. A small tick follows.
 * Then the hands sink, the blades fall flat and fade and the pool shrinks. See pipeline/designs/kit-shadow.md.
 */
export interface GraspOfTheDeepSettings {
  damage: number;
  tick: number;
  silence: number;
  loop: boolean;
}

export const defaultGraspOfTheDeep = (): GraspOfTheDeepSettings => ({ damage: 40, tick: 10, silence: 1, loop: false });

// Timeline (seconds).
const SPREAD_END = 0.3;
const RISE_END = 0.7;
const HIT_T = 0.75;
const TICK_T = 1.3;
const SINK_A = 1.4;
const SINK_B = 2.1;
const DURATION = 2.3;
const RADIUS = 3;
const BLADES = 10;
const HANDS = 7;
const HAND_H = 3.3;
const PULL_DOWN = 0.2;

export class GraspOfTheDeep implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GraspOfTheDeepSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -6);
  private nrm = new THREE.Vector3(0, 0, 1);
  private fwd = new THREE.Vector3(0, 0, -1);
  private anchors: THREE.Vector3[] = [];
  private bladePos: THREE.Vector3[] = [];
  private bladeSize: number[] = [];
  private bladeLean: number[] = [];

  private flags = { hit: false, tick: false, shrink: false };

  // Parts.
  private pool = new ShadowPool();
  private hands = new ShadowHands(HANDS + 2);
  private blades = Array.from({ length: BLADES }, () => new CutShape({ kind: 'blade', renderOrder: 5, edgeWidth: 0.12 }));
  private cuts = [0, 1, 2].map(() => new CutFlash());
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: GraspOfTheDeepSettings = defaultGraspOfTheDeep()) {
    this.settings = settings;
    for (let i = 0; i < BLADES; i++) {
      this.bladePos.push(new THREE.Vector3());
      this.bladeSize.push(2);
      this.bladeLean.push(0);
    }
    this.group.add(this.pool.mesh, this.hands.mesh, ...this.blades.map((b) => b.mesh), ...this.cuts.map((c) => c.mesh), this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the impact are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.from).setY(0); // self mode: the hands rise round Nyx herself
    facing(ctx.aim, this.nrm);
    forward(ctx.aim, this.fwd);
    this.hands.face(ctx.aim);
    for (const c of this.cuts) c.face(ctx.aim);
    this.anchors.length = 0;
    for (let i = 0; i < ctx.targetPos.length && i < 4; i++) this.anchors.push(this.v1.set(ctx.targetPos[i].x, 0, ctx.targetPos[i].z).clone());
    this.anchors.push(this.point.clone());
    for (let i = 0; i < BLADES; i++) {
      const a = (i / BLADES) * Math.PI * 2 + 0.3 + ((i * 3) % 4) * 0.05;
      const r = RADIUS * (0.93 + 0.06 * ((i * 7) % 3) / 2);
      this.bladePos[i].set(this.point.x + Math.cos(a) * r, 0, this.point.z + Math.sin(a) * r);
      this.bladeSize[i] = 1.9 + 0.9 * ((i * 5) % 4) / 3;
      this.bladeLean[i] = (((i * 7) % 5) - 2) * 0.1;
    }
    this.screen.focus.copy(this.point).setY(1.2);
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
    f.hit = f.tick = f.shrink = false;
    clearScreenFx(this.screen);
    this.pool.reset();
    this.hands.reset();
    for (const b of this.blades) b.reset();
    for (const c of this.cuts) c.reset();
    this.groundShock.set(this.point, 0, 0);
    if (this.ctx) for (const e of this.ctx.targets) this.ctx.displace(e, this.v1.set(0, 0, 0));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
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
      this.shake = 0.35;
      if (ctx) {
        ctx.targets.forEach((e, i) => {
          if (this.inside(e)) ctx.hit(e, { damage: this.settings.damage, knock: 0, color: SHADOW_CSS.hot, status: { kind: 'silence', seconds: this.settings.silence } });
          const p = ctx.targetPos[i];
          if (p && i < this.cuts.length) this.cuts[i].cut(this.v1.set(p.x, 1.2, p.z), this.v2.set(Math.cos(0.5 + i), Math.sin(0.5 + i), 0), 1.9);
        });
      }
    }
    if (!f.tick && t >= TICK_T) {
      f.tick = true;
      if (ctx) for (const e of ctx.targets) if (this.inside(e)) ctx.hit(e, { damage: this.settings.tick, knock: 0, color: SHADOW_CSS.hot });
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = t - HIT_T;

    // --- Pool: spreads in 0.3 s, shrinks away with the sinking hands. ---
    this.pool.spread(this.point, RADIUS, smoothstep(t / SPREAD_END));
    if (!f.shrink && t >= 1.7) { f.shrink = true; this.pool.shrink(0.5); }

    // --- Hands rise 0.3..0.7, close at the hit, sink 1.4..2.1. ---
    const rise = smoothstep((t - SPREAD_END) / (RISE_END - SPREAD_END));
    const sink = 1 - smoothstep((t - SINK_A) / (SINK_B - SINK_A));
    const close = smoothstep(after / 0.1) * (1 - smoothstep((t - SINK_A) / 0.3));
    if (t >= SPREAD_END) this.hands.grab(this.anchors, HANDS, HAND_H, Math.min(rise, sink), f.hit ? close : 0);

    // --- Ring of blade cut-outs snaps up at the hit (2 frames each, staggered), falls flat and fades later. ---
    for (let i = 0; i < BLADES; i++) {
      const b = this.blades[i];
      const up = f.hit ? shadowEaseOutBack((after - i * 0.008) / 0.1) : 0;
      const fall = smoothstep((t - 1.45 - i * 0.015) / 0.3);
      const size = this.bladeSize[i];
      if (up <= 0.001) { b.opacity = 0; continue; }
      // Normal blends from facing the camera (standing) to up (lying flat).
      this.v1.copy(this.nrm).multiplyScalar(Math.cos(fall * Math.PI * 0.5)).addScaledVector(this.v2.set(0, 1, 0), Math.sin(fall * Math.PI * 0.5));
      this.v3.copy(this.bladePos[i]);
      this.v3.y = size * 0.5 * up * (1 - fall) + 0.08 * fall;
      b.place(this.v3, this.v1, size * Math.max(up, 0.05), Math.PI / 2 + this.bladeLean[i], this.fwd);
      b.opacity = 1 - smoothstep((t - 1.75 - i * 0.012) / 0.35);
    }

    // --- Enemies are pulled down a little while the hands hold them. ---
    if (ctx && f.hit) {
      const k = shadowEaseOut(after / 0.12) * (1 - smoothstep((t - SINK_A) / 0.3));
      for (const e of ctx.targets) ctx.displace(e, this.v1.set(0, -PULL_DOWN * k, 0));
    }

    // --- Ground refraction 1 -> 5, shake. ---
    if (f.hit) {
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(this.point, 1 + 4 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = 0.35 * Math.exp(-after * 9);
    }
  }
}

export const graspOfTheDeepModule: EffectModule = {
  label: 'grasp of the deep',
  category: 'hero: shadow',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new GraspOfTheDeep(),
  telegraphs(effect) {
    const e = effect as GraspOfTheDeep;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as GraspOfTheDeep;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as GraspOfTheDeep).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tick', 0, 60, 1);
    f.add(s, 'silence', 0, 1.5, 0.1);
  },
};
