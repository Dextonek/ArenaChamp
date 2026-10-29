import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  CutFlash, CutShape, CutShards, SHADOW, SHADOW_CSS, ShadowHands, ShadowPool, facing, forward, shadowEaseOut,
} from '../../effects/parts/shadow';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Eclipse Execution (shadow kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: Nyx raises a
 * dagger and the world goes dark. A shadow pool covers the whole zone, shadow hands rise across it and hold the
 * enemies while a pale moon rises behind the zone and a black disc slides across it into an eclipse (a thin violet
 * ring of light at its rim). A giant black crescent blade forms out of the eclipse and tilts back; dead beat; then it
 * sweeps down through the zone in one stroke. Impact frames on the pale moon card, a long mint cut, ground
 * refraction. The crescent shatters into flat black shards, the hands sink, the eclipse slides off and the light
 * returns. Clean by 4.5 s. See pipeline/designs/kit-shadow.md.
 */
export interface EclipseExecutionSettings {
  damage: number;
  loop: boolean;
}

export const defaultEclipseExecution = (): EclipseExecutionSettings => ({ damage: 125, loop: false });

// Timeline (seconds).
const FORM_A = 1.5;
const FORM_B = 1.85;
const DEAD_A = 1.85;
const DEAD_B = 2.0;
const SWEEP_END = 2.2;
const HIT_T = 2.2;
const SHATTER_T = 2.35;
const DURATION = 4.5;

const RADIUS = 7;
const MOON_R = 4.0;
const MOON_Y = 6.6;
const MOON_BACK = 5; // behind the point, away from the caster
const BLADE_SIZE = 6.1; // crescent chord = 2 x size ~ 12 wide
const READY_Y = 7.4;
const READY_BACK = 1.5;
const READY_PITCH = 0.35;
const HANDS = 8;
const UP = new THREE.Vector3(0, 1, 0);

export class EclipseExecution implements Effect {
  readonly group = new THREE.Group();
  readonly settings: EclipseExecutionSettings;
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
  private point = new THREE.Vector3(0, 0, -6);
  private hand = new THREE.Vector3(0, 2.2, 13);
  private moonC = new THREE.Vector3();
  private ready = new THREE.Vector3();
  private land = new THREE.Vector3();
  private anchors: THREE.Vector3[] = [];

  private flags = { hit: false, shatter: false, shrink: false };

  // Parts.
  private pool = new ShadowPool();
  private dagger = new CutShape({ kind: 'blade', renderOrder: 9 });
  private moon = new CutShape({ kind: 'disc', fill: SHADOW.foil, renderOrder: 2 });
  private disc = new CutShape({ kind: 'disc', renderOrder: 3, edgeWidth: 0.2 });
  private hands = new ShadowHands(HANDS + 2);
  private crescent = new CutShape({ kind: 'crescent', renderOrder: 10, edgeWidth: 0.24 });
  private shards = new CutShards(40);
  private longCut = new CutFlash();
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: EclipseExecutionSettings = defaultEclipseExecution()) {
    this.settings = settings;
    this.screen.tint.set(SHADOW.dark);
    this.screen.impactColor.set(SHADOW.foil);
    this.moon.edge = 0;
    this.group.add(
      this.pool.mesh, this.moon.mesh, this.disc.mesh, this.hands.mesh, this.dagger.mesh, this.crescent.mesh,
      this.shards.mesh, this.longCut.mesh, this.groundShock.mesh,
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
    this.point.copy(ctx.point).setY(0);
    forward(ctx.aim, this.fwd);
    facing(ctx.aim, this.nrm);
    this.right.crossVectors(UP, this.nrm).normalize();
    this.hand.copy(this.from).addScaledVector(this.fwd, 0.45).setY(2.2);
    this.moonC.copy(this.point).addScaledVector(this.fwd, MOON_BACK).setY(MOON_Y);
    this.ready.copy(this.point).addScaledVector(this.fwd, READY_BACK).setY(READY_Y);
    this.land.copy(this.point).addScaledVector(this.fwd, -0.5).setY(0.35);
    this.hands.face(ctx.aim);
    this.longCut.face(ctx.aim);
    this.anchors.length = 0;
    for (let i = 0; i < ctx.targetPos.length && i < 4; i++) this.anchors.push(new THREE.Vector3(ctx.targetPos[i].x, 0, ctx.targetPos[i].z));
    for (let k = 0; k < 6; k++) {
      const a = k * 1.047 + 0.4;
      this.anchors.push(new THREE.Vector3(this.point.x + Math.cos(a) * 4.6, 0, this.point.z + Math.sin(a) * 4.6));
    }
    this.screen.focus.copy(this.point).setY(1.5);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.crescent.mesh];
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
    f.hit = f.shatter = f.shrink = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(SHADOW.dark);
    this.screen.impactColor.set(SHADOW.foil);
    this.pool.reset();
    this.dagger.reset();
    this.moon.reset();
    this.moon.edge = 0;
    this.disc.reset();
    this.hands.reset();
    this.crescent.reset();
    this.shards.reset();
    this.longCut.reset();
    this.groundShock.set(this.point, 0, 0);
    if (this.ctx) for (const e of this.ctx.targets) this.ctx.displace(e, this.v1.set(0, 0, 0));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const beat = this.time >= DEAD_A && this.time < DEAD_B;
    if (!beat) {
      this.pool.update(dt);
      this.shards.update(dt);
      this.longCut.update(dt);
    }
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
      this.shake = 0.75;
      this.longCut.cut(this.v1.copy(this.point).setY(1.3), this.right, 6.8);
      if (ctx) {
        for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 6, from: this.point, color: SHADOW_CSS.hot });
      }
    }
    if (!f.shatter && t >= SHATTER_T) {
      f.shatter = true;
      this.shards.burst(this.v1.copy(this.point).setY(0.4), 5.6, 40, 5.5, 4.5, 1.6);
    }
    if (!f.shrink && t >= 3.5) {
      f.shrink = true;
      this.pool.shrink(1.0);
    }

    this.layout();
  }

  /** Normal of the crescent plane at pitch p: 0 = standing toward the camera, pi/2 = lying flat face up. */
  private bladeNormal(p: number, out: THREE.Vector3) {
    return out.copy(this.nrm).multiplyScalar(Math.cos(p)).addScaledVector(UP, Math.sin(p));
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = t - HIT_T;
    const out = 1 - smoothstep((t - 3.6) / 0.9);

    // --- Screen: the world darkens hard, then the impact frames on the pale moon card. ---
    this.screen.darken = 0.75 * smoothstep(t / 0.4) * out;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The dagger Nyx raises (0..0.4), gone by 1.2. ---
    this.v1.copy(this.hand).y += 0.35 * shadowEaseOut(t / 0.4);
    this.dagger.place(this.v1, this.nrm, 1.7, Math.PI / 2 - 0.22);
    this.dagger.opacity = smoothstep(t / 0.15) * (1 - smoothstep((t - 0.9) / 0.3));

    // --- Pool over the whole zone with its pale foil. ---
    this.pool.spread(this.point, RADIUS, smoothstep(t / 0.5));

    // --- The moon rises behind the zone; the black disc slides across it into an eclipse and later off again. ---
    const rise = smoothstep((t - 0.3) / 0.7);
    this.v1.copy(this.moonC).y = THREE.MathUtils.lerp(MOON_Y - 3.4, MOON_Y, rise);
    this.moon.place(this.v1, this.nrm, MOON_R, 0);
    this.moon.opacity = smoothstep((t - 0.3) / 0.4) * (1 - smoothstep((t - 3.4) / 0.8));
    const enter = smoothstep((t - 0.5) / 1.0), leave = smoothstep((t - 2.6) / 1.0);
    const off = -9.5 + 9.2 * enter + 9.8 * leave;
    this.v1.copy(this.moonC).y = THREE.MathUtils.lerp(MOON_Y - 3.4, MOON_Y, rise);
    this.v1.addScaledVector(this.right, off).addScaledVector(this.nrm, 0.15);
    this.disc.place(this.v1, this.nrm, MOON_R * 0.965, 0);
    this.disc.opacity = smoothstep((t - 0.45) / 0.15) * (1 - smoothstep((t - 3.5) / 0.4));

    // --- Hands rise across the pool (0.3..1.3), close on the enemies, sink (2.6..3.4). ---
    const hs = Math.min(smoothstep((t - 0.3) / 1.0), 1 - smoothstep((t - 2.6) / 0.8));
    const close = smoothstep((t - 1.2) / 0.3) * (1 - smoothstep((t - 2.6) / 0.3));
    if (t >= 0.3) this.hands.grab(this.anchors, HANDS, 3.6, hs, close);

    // --- The crescent: forms out of the eclipse, tilts back, dead beat, sweeps down in one stroke, shatters. ---
    if (t >= FORM_A && t < SHATTER_T) {
      const form = shadowEaseOut((t - FORM_A) / (FORM_B - FORM_A));
      const sweepU = THREE.MathUtils.clamp((t - DEAD_B) / (SWEEP_END - DEAD_B), 0, 1);
      const sw = sweepU * sweepU;
      this.v1.copy(this.moonC).addScaledVector(this.nrm, 0.3);
      this.v1.lerp(this.ready, form);
      this.v1.lerp(this.land, sw);
      const pitch = READY_PITCH * form + (Math.PI / 2 - 0.03 - READY_PITCH) * sw;
      const size = BLADE_SIZE * (0.2 + 0.8 * form) * (1 + 0.08 * sw);
      this.crescent.place(this.v1, this.bladeNormal(pitch, this.v2), size, Math.PI / 2, this.fwd);
      this.crescent.opacity = smoothstep((t - FORM_A) / 0.1);
    } else {
      this.crescent.opacity = 0;
    }

    // --- Enemies are held: pulled 0.4 of the way to the centre while the hands grip, released later. ---
    if (ctx) {
      const k = smoothstep((t - 0.6) / 0.9) * (1 - smoothstep((t - 3.0) / 0.5));
      ctx.targets.forEach((e, i) => {
        const p = ctx.targetPos[i];
        if (p) ctx.displace(e, this.v2.set(this.point.x - p.x, 0, this.point.z - p.z).multiplyScalar(0.4 * k));
      });
    }

    // --- The hit: ground refraction 1 -> 12, shake. ---
    if (f.hit) {
      const gp = THREE.MathUtils.clamp(after / 0.55, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.75 * Math.exp(-after * 7);
    } else if (t >= DEAD_B) {
      this.shake = 0.1 * smoothstep((t - DEAD_B) / 0.2);
    }
  }
}

export const eclipseExecutionModule: EffectModule = {
  label: 'eclipse execution',
  category: 'hero: shadow',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new EclipseExecution(),
  telegraphs(effect) {
    const e = effect as EclipseExecution;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as EclipseExecution;
    if (e.ctx) frameCast(camera, controls, e.ctx, 12);
  },
  buildGui(f, effect) {
    const s = (effect as EclipseExecution).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
