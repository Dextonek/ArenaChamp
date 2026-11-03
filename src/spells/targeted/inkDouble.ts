import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { INK, InkBleed, Splatter, Stroke } from '../../effects/parts/ink';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { DOUBLE_SECONDS, doubleAlive, placeDouble } from './inkDoubleState';

/**
 * Ink Double (ink kit, W: a retreat that leaves a copy). Shiori slides 4 m straight away from the aim (`ctx.moveCaster`,
 * 0.22 s) in a smear of ink; at her old spot an ink silhouette of her stands up out of a small puddle and stays 3 s
 * (`DOUBLE_SECONDS`), then dissolves into drops. If her next Brushstroke is cast while it stands, that spell fires an
 * echo from the double (see `echoBrushstroke.ts`, through `inkDoubleState.ts`); the double then breaks up at once.
 * No hits of its own. Clean by about 4 s.
 */
export interface InkDoubleSettings {
  back: number;
  seconds: number;
}

export const defaultInkDouble = (): InkDoubleSettings => ({ back: 4, seconds: DOUBLE_SECONDS });

const DASH_T = 0.22;
const RISE = 0.3;
const FADE_T = 0.45;
const SMEAR_Y = 0.9;

export class InkDouble implements Effect {
  readonly group = new THREE.Group();
  readonly settings: InkDoubleSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  ctx: CastContext | null = null;
  /** The double's spot and where the dash ends. */
  readonly spot = new THREE.Vector3();
  readonly land = new THREE.Vector3();
  private time = 0;
  private id = -1;
  private endAt = -1;
  private yaw = 0;
  private smeared = false;

  private figure = new THREE.Group();
  private mats: THREE.MeshBasicMaterial[] = [];
  private base: number[] = [];
  private smear = new Stroke({ taper: 0.7, samples: 12 });
  private puddle = new InkBleed();
  private splat = new Splatter(24);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private path = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(settings: InkDoubleSettings = defaultInkDouble()) {
    this.settings = settings;
    this.buildFigure();
    this.group.add(this.puddle.mesh, this.figure, this.smear.mesh, this.splat.mesh);
    this.reset();
  }

  /** A sumi-black silhouette: robe, shoulders, head, long hair and the great brush; an indigo outline shell behind. */
  private buildFigure() {
    const mk = (hex: number, opacity: number, back = false) => {
      const m = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity, depthWrite: false, side: back ? THREE.BackSide : THREE.FrontSide });
      this.mats.push(m);
      this.base.push(opacity);
      return m;
    };
    const dark = mk(INK.dark, 0.94), rim = mk(INK.body, 0.8, true), red = mk(INK.accent, 0.9);
    const parts: [THREE.BufferGeometry, number][] = [
      [new THREE.CylinderGeometry(0.2, 0.46, 1.25, 14), 0.65],
      [new THREE.SphereGeometry(0.3, 12, 8), 1.4],
      [new THREE.SphereGeometry(0.2, 12, 10), 1.72],
    ];
    for (const [geo, y] of parts) {
      const body = new THREE.Mesh(geo, dark);
      body.position.y = y;
      body.renderOrder = 8;
      const shell = new THREE.Mesh(geo, rim);
      shell.position.y = y;
      shell.scale.setScalar(1.12);
      shell.renderOrder = 7;
      this.figure.add(shell, body);
    }
    const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.05, 1.0, 8), dark);
    hair.position.set(0, 1.25, -0.2);
    hair.renderOrder = 8;
    const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6), dark);
    brush.position.set(0.3, 1.2, -0.25);
    brush.rotation.z = -0.35;
    brush.renderOrder = 8;
    const stamp = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), red);
    stamp.position.set(0, 1.0, 0.36);
    stamp.renderOrder = 9;
    this.figure.add(hair, brush, stamp);
    this.figure.visible = false;
  }

  get duration() {
    return this.settings.seconds + FADE_T + 0.4;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.spot.copy(ctx.sentFrom ?? ctx.from).setY(0);
    // Away from the aim: the aim is toward the cursor / the enemy.
    this.land.set(this.spot.x - Math.sin(ctx.aim) * this.settings.back, 0, this.spot.z - Math.cos(ctx.aim) * this.settings.back);
    this.yaw = ctx.aim;
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The dash first; the engine may clamp the landing into the ring.
    if (ctx.moveCaster) this.land.copy(ctx.moveCaster(this.land.clone(), DASH_T)).setY(0);
    this.id = placeDouble(ctx.caster, this.spot, this.settings.seconds);
    this.figure.position.copy(this.spot);
    this.figure.rotation.y = this.yaw;
    this.figure.visible = true;
    this.puddle.spread(this.spot, 0.9, 0.3, { ink: 1 });
    this.v1.set(0, 0.2, 0);
    this.splat.fling(this.v2.copy(this.spot).setY(0.3), this.v1, 5, 3, { size: 0.1, spread: 1.6 });
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.endAt = -1;
    this.smeared = false;
    this.id = -1;
    this.figure.visible = false;
    this.figure.scale.set(1, 0.01, 1);
    this.mats.forEach((m, i) => (m.opacity = this.base[i]));
    this.smear.reset();
    this.puddle.reset();
    this.splat.reset();
  }

  /** The double ends (used by a Brushstroke, or out of time): drops fly off it and it sags away. */
  private breakUp() {
    if (this.endAt >= 0) return;
    this.endAt = this.time;
    this.puddle.fade(0.5);
    for (let k = 0; k < 8; k++) {
      this.v1.set(this.spot.x + (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 1.5, this.spot.z + (Math.random() - 0.5) * 0.5);
      this.v2.set(Math.random() - 0.5, 0.3, Math.random() - 0.5);
      this.splat.fling(this.v1, this.v2, 1, 2.5, { size: 0.12, spread: 0.6, up: 0.4, life: 0.8 });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smear.update(dt);
    this.puddle.update(dt);
    this.splat.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;

    // The smear along the dash, painted once.
    if (!this.smeared) {
      this.smeared = true;
      this.path[0].set(this.spot.x, SMEAR_Y, this.spot.z);
      this.path[2].set(this.land.x, SMEAR_Y, this.land.z);
      this.path[1].lerpVectors(this.path[0], this.path[2], 0.5);
      this.smear.paint(this.path, 0.9, DASH_T);
      this.smear.dissolve(0.5);
    }

    // The double rises out of the puddle, stands, and breaks up when spent or when its time is up.
    if (this.endAt < 0 && (!doubleAlive(this.id) || t >= this.settings.seconds)) this.breakUp();
    if (this.endAt < 0) {
      const k = Math.min(1, t / RISE);
      const wob = 1 + 0.015 * Math.sin(t * 4);
      this.figure.scale.set(wob, 0.01 + 0.99 * (1 - Math.pow(1 - k, 3)), wob);
    } else {
      const k = Math.min(1, (t - this.endAt) / FADE_T);
      this.mats.forEach((m, i) => (m.opacity = this.base[i] * (1 - k)));
      this.figure.scale.set(1 + 0.25 * k, 1 - 0.4 * k, 1 + 0.25 * k);
      if (k >= 1) this.figure.visible = false;
    }
    const idle = !this.splat.busy && !this.puddle.busy && !this.smear.busy;
    if ((this.endAt >= 0 && t >= this.endAt + FADE_T + 0.1 && idle) || t > this.settings.seconds + 2) {
      this.playing = false;
      this.reset();
    }
  }
}

export const inkDoubleModule: EffectModule = {
  label: 'ink double',
  category: 'hero: ink',
  // The aim point only gives the direction to retreat from.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new InkDouble(),
  bloom: { enabled: true, strength: 0.25, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as InkDouble;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as InkDouble).settings;
    f.add(s, 'back', 1, 8, 0.5);
    f.add(s, 'seconds', 1, 6, 0.5);
  },
};
