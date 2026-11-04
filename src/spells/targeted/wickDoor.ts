import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { DOOR, DOOR_HEIGHT, Flecks, KeyFlock, flatRing } from '../../effects/parts/door';
import { Gleam } from '../../effects/parts/mirror';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import {
  DOOR_APART, DOOR_LIFE, DOOR_MIN, DOOR_RANGE, DOOR_RISE, bindList, bookOf, newDoor, placedDoors, raiseDoor, syncBolts, type DoorRec,
} from '../../traits/door';

/**
 * Door (door kit v5, W: a door at a spot, two charges). A brass ring and a column of warm light mark a spot (9 m, at least 1.2 m from
 * him) while three keys turn round it; at 0.5 s a real upright door in its frame steps up there and stands for 10 s, a warm glow
 * from its crack, with a brass number on both faces and a service bell on a post beside it. A pair of doors carries the same number
 * (the second door of a pair takes the first's) and a thin brass thread joins them on the floor. Anyone who walks into one leaves by
 * the other, and a bolt that flies in comes out of the other, going the same way: see `doorTrait` in src/traits/door.ts, which owns the
 * doors (a record per door, written on both screens at the cast from `sentFrom` and `point` only, with ids that count the casts) and
 * draws them with `marks`, so the CPU's next cast cannot cut one off. This effect writes the record at `play()`, raises it at the rise
 * (its 40 HP unit on the bell, where `ctx.summon` exists, and the bolt list) and draws the moment: the seed, the keys, the burst, and
 * when the second door makes a pair a brass gleam along the floor and a flash on each door.
 *
 * The second door of a pair is put at least 3 m from the first (pushed along the line away from it). The CPU's cast: with no door
 * standing, the first goes 2.2 m from him toward the enemy (the trait's `aiHold` flags it); the second goes where the CPU aims, at the enemy.
 * The telegraph is the footprint (a 0.9 m circle, impact at the rise): it roots him until then. Clean by 1.8 s.
 * See pipeline/designs/kit-door.md.
 */
export interface WickDoorSettings {
  loop: boolean;
}

export const defaultWickDoor = (): WickDoorSettings => ({ loop: false });

// Timeline (seconds), sizes (m).
const RISE_T = DOOR_RISE;
const DURATION = RISE_T + 1.3;
const FOOT_R = 0.9;
/** How near him the CPU's first door goes. */
const CPU_NEAR = 2.2;
const CPU_FRESH = 250;

export class WickDoorFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WickDoorSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the door stands, from sentFrom and point (and the doors that stand) only. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private time = 0;
  private risen = false;
  private rec: DoorRec | null = null;
  private pairAt = -1;
  private readonly mate = new THREE.Vector3();
  private starAge = [9, 9];
  private readonly starPos = [new THREE.Vector3(), new THREE.Vector3()];
  private starSize = [2, 1.6];

  private flecks = new Flecks(70);
  private keys = new KeyFlock(3, 0.42);
  private gleam = new Gleam(1);
  private stars = [0, 1].map((i) => new StarBurst({ points: 8, inner: 0.3, color: i ? DOOR.glow : DOOR.hot, core: 0xffffff, additive: false }));
  private shock = new ShockRefraction({ facing: 'ground' });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: DOOR.ink, transparent: true, opacity: 0, depthWrite: false });
  private rim = flatRing(FOOT_R, 0.1, DOOR.brass, 0);
  private column: THREE.Mesh;
  private columnMat = new THREE.MeshBasicMaterial({ color: DOOR.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: WickDoorSettings = defaultWickDoor()) {
    this.settings = settings;
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.rim.mesh.visible = false;
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, DOOR_HEIGHT, 20, 1, true).translate(0, DOOR_HEIGHT / 2, 0), this.columnMat);
    this.column.visible = false;
    this.column.frustumCulled = false;
    this.group.add(this.shade, this.rim.mesh, this.column, this.flecks.mesh, this.keys.group, this.gleam.mesh, this.shock.mesh);
    for (const s of this.stars) this.group.add(s.mesh);
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
    // Both screens must agree on the door: only sentFrom, point and the doors that stand (the book is the same on both).
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = DOOR_MIN; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, DOOR_MIN, DOOR_RANGE);
    const b = bookOf(ctx.caster), live = placedDoors(b);
    // The CPU's first door goes close to him (the trait's aiHold marked this cast).
    if (live.length === 0 && performance.now() - b.cpuAt < CPU_FRESH) len = Math.min(len, CPU_NEAR);
    let x = s.x + dx * len, z = s.z + dz * len;
    // The second door keeps its distance from the first, or the pair is a doorway to the same spot.
    const lone = live[0];
    if (lone && Math.hypot(x - lone.x, z - lone.z) < DOOR_APART) {
      let ax = x - lone.x, az = z - lone.z, al = Math.hypot(ax, az);
      if (al < 1e-3) { ax = dx; az = dz; al = 1; }
      x = lone.x + (ax / al) * DOOR_APART;
      z = lone.z + (az / al) * DOOR_APART;
    }
    this.centre.set(x, 0, z);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The record the trait and the marks read, on both screens. Its cast is kept so the unit can be made later if this effect is cut off.
    const b = bookOf(ctx.caster);
    bindList(b, ctx);
    this.rec = newDoor(b, this.centre.x, this.centre.z, RISE_T, DOOR_LIFE);
    this.rec.ctx = ctx;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.risen = false;
    this.rec = null;
    this.pairAt = -1;
    this.starAge[0] = this.starAge[1] = 9;
    this.flecks.reset();
    this.keys.reset();
    this.gleam.reset();
    this.shock.set(this.centre, 0, 0);
    this.shade.visible = this.rim.mesh.visible = this.column.visible = false;
    this.shadeMat.opacity = this.rim.mat.opacity = this.columnMat.opacity = 0;
    for (let i = 0; i < 2; i++) this.stars[i].set(this.starPos[i], 0, 0);
  }

  private flare(i: number, at: THREE.Vector3, size: number) {
    this.starPos[i].set(at.x, DOOR_HEIGHT * 0.5, at.z);
    this.starSize[i] = size;
    this.starAge[i] = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.flecks.update(dt);
    for (let i = 0; i < 2; i++) {
      this.starAge[i] += dt;
      const sp = StarBurst.pop(this.starAge[i], 0.05, 0.18);
      this.stars[i].set(this.starPos[i], this.starSize[i] * sp.scale + 1e-3, sp.opacity, this.starAge[i] * 4);
    }
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION && !this.flecks.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, C = this.centre;

    // --- The seed: a dark pool, a brass ring that closes in, a column of warm light, three keys turning round it. ---
    if (!this.shade.visible) {
      this.shade.visible = this.rim.mesh.visible = this.column.visible = true;
      this.shade.position.set(C.x, 0.03, C.z);
      this.rim.mesh.position.set(C.x, 0.045, C.z);
      this.column.position.set(C.x, 0, C.z);
    }
    if (!this.risen) {
      const k = smoothstep(t / RISE_T);
      this.shade.scale.setScalar(FOOT_R * (0.6 + 0.5 * k));
      this.shadeMat.opacity = 0.38 * k;
      this.rim.mesh.scale.setScalar(1.5 - 0.5 * k);
      this.rim.mat.opacity = 0.35 + 0.55 * k;
      this.columnMat.opacity = 0.08 + 0.2 * k;
      this.column.scale.set(0.4 + 0.6 * k, 0.3 + 0.7 * k, 0.4 + 0.6 * k);
      for (let i = 0; i < this.keys.size; i++) {
        const a = t * 7 + (i / this.keys.size) * Math.PI * 2, rad = 1.1 - 0.5 * k;
        this.v1.set(C.x + Math.cos(a) * rad, 0.5 + 1.1 * k + 0.12 * Math.sin(t * 9 + i), C.z + Math.sin(a) * rad);
        this.keys.show(i, this.v1, a + Math.PI / 2, t * 14 + i, 0.5 + 0.5 * k);
      }
      if (Math.random() < 0.5) this.flecks.burst(this.v1.set(C.x + (Math.random() - 0.5) * 0.8, 0.1, C.z + (Math.random() - 0.5) * 0.8), 1, 1.0, 0.8, 1.2);
    }
    if (!this.risen && t >= RISE_T) {
      this.risen = true;
      this.rise();
    }
    if (this.risen) {
      const a = t - RISE_T;
      for (let i = 0; i < this.keys.size; i++) {
        // The keys are taken up by the door: they swirl in and are gone.
        const k = smoothstep(a / 0.35), ang = t * 7 + (i / this.keys.size) * Math.PI * 2, rad = 0.6 * (1 - k);
        this.v1.set(C.x + Math.cos(ang) * rad, 1.6 + 0.5 * k, C.z + Math.sin(ang) * rad);
        this.keys.show(i, this.v1, ang + Math.PI / 2, t * 14 + i, 1 - k);
      }
      this.rim.mat.opacity = 0.9 * (1 - smoothstep(a / 0.5)) + 0.25 * (1 - smoothstep((a - 0.5) / 0.6));
      this.shadeMat.opacity = 0.34;
      this.columnMat.opacity = 0.28 * (1 - smoothstep(a / 0.5));
      const gp = THREE.MathUtils.clamp(a / 0.4, 0, 1);
      this.shock.set(C, 0.5 + 2.4 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.22 * Math.exp(-a * 9));
      // A pair: a brass gleam along the floor between the two doors for a moment.
      if (this.pairAt >= 0) {
        const p = t - this.pairAt, k = smoothstep(p / 0.25) * (1 - smoothstep((p - 0.35) / 0.4));
        this.v1.set(C.x, 0.12, C.z);
        this.v2.set(this.mate.x, 0.12, this.mate.z);
        this.gleam.set(this.v1, this.v2, 0.3, k, DOOR.brass, 1);
      }
    }
  }

  /** The door steps up: its unit and the bolt list, a burst, and the flash of a pair. */
  private rise() {
    const ctx = this.ctx, C = this.centre, rec = this.rec;
    if (ctx && rec) {
      raiseDoor(ctx, rec);
      const b = bookOf(ctx.caster);
      const other = placedDoors(b).find((d) => d !== rec);
      if (other) {
        this.pairAt = this.time;
        this.mate.set(other.x, 0, other.z);
        this.flare(1, this.mate, 1.7);
        this.flecks.burst(this.v1.set(other.x, 1.2, other.z), 12, 4, 1.2);
      }
      syncBolts(b);
    }
    this.flare(0, C, 2.2);
    this.flecks.burst(this.v1.set(C.x, 1.1, C.z), 22, 5, 1.3);
    this.flecks.burst(this.v1.set(C.x, 0.2, C.z), 10, 3, 1.0, 0.1);
    this.shake = 0.22;
  }
}

export const wickDoorModule: EffectModule = {
  label: 'wick door',
  category: 'hero: door',
  // The aim point is where the door stands; the radius only sizes the marker.
  targeting: { mode: 'ground', radius: FOOT_R },
  create: () => new WickDoorFx(),
  telegraphs(effect) {
    const e = effect as WickDoorFx;
    if (!e.ctx) return [];
    // The footprint of the door: it roots him until it rises.
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: FOOT_R }, start: 0.04, impact: RISE_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as WickDoorFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as WickDoorFx).settings;
    f.add(s, 'loop');
  },
};
