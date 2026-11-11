import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { PHOENIX, PHOENIX_CSS } from '../../effects/parts/phoenix';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Enemy } from '../../effects/common';
import { BIRD_AIR, BIRD_DAMAGE, BIRD_LENGTH, BIRD_WIDTH, BIRD_WIND, layEmber } from '../../traits/phoenix';

/**
 * Firebird (phoenix kit, R: the ultimate). Anka spreads wings of fire for 1.0 s, rooted, while the lane shows: 12 m along
 * the aim from her feet, 3 m wide. Then she crosses it as a great firebird in 0.5 s (`ctx.moveCaster`) and lands at its far
 * end (or where the ring or a wall stops her). Everyone the bird's front passes inside the lane, on their LIVE position,
 * takes 120, once. An ember is left where she took off and becomes her nest (`layEmber`, both screens), so Ember Flight can
 * take her back. The lane is the telegraph (impact 1.0 s, until 1.5 s) and the hit shape: 1.5 m to the side takes 0.63 s
 * with a reaction, and she warns 1.0 s. Under the gameplay camera, no cinematic. Clean by 2.4 s.
 * Network duels: the other screen has no `moveCaster` (her client streams the move); the lane is built from `sentFrom`.
 *
 * PLACEHOLDER LOOK (gate 4, first step): two growing wing plates, a lane strip and a bird-shaped wedge.
 */
export interface FirebirdSettings {
  damage: number;
  loop: boolean;
}

export const defaultFirebird = (): FirebirdSettings => ({ damage: BIRD_DAMAGE, loop: false });

const GO_T = BIRD_WIND;
const END_T = GO_T + BIRD_AIR;
const DURATION = END_T + 0.9;

export class Firebird implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FirebirdSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly from = new THREE.Vector3();
  readonly dir = new THREE.Vector3(0, 0, -1);
  private end = new THREE.Vector3();
  private reach = BIRD_LENGTH;
  private time = 0;
  private gone = false;
  private struck = new Set<Enemy>();

  private lane = new THREE.Mesh(new THREE.PlaneGeometry(BIRD_WIDTH, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PHOENIX.body, transparent: true, opacity: 0, depthWrite: false }));
  private bird = new THREE.Group();
  private wings: THREE.Mesh[] = [];

  constructor(settings: FirebirdSettings = defaultFirebird()) {
    this.settings = settings;
    this.lane.renderOrder = 2;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: PHOENIX.hot }));
    this.bird.add(body);
    for (const s of [1, -1]) {
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4).rotateZ((-s * Math.PI) / 2), new THREE.MeshBasicMaterial({ color: PHOENIX.body }));
      w.scale.set(1, 0.18, 1);
      w.position.set(s * 1.7, 0.1, -0.4);
      this.wings.push(w);
      this.bird.add(w);
    }
    this.group.add(this.lane, this.bird);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return GO_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.end.copy(this.from).addScaledVector(this.dir, BIRD_LENGTH);
    this.reach = BIRD_LENGTH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.gone = false;
    this.struck.clear();
    this.lane.visible = this.bird.visible = false;
  }

  private takeOff() {
    const ctx = this.ctx;
    if (!ctx) return;
    // The ember where she took off: her nest, and the way back.
    layEmber(ctx.caster, this.from.x, this.from.z);
    if (ctx.moveCaster) {
      this.end.copy(ctx.moveCaster(this.end, BIRD_AIR)).setY(0);
      this.reach = Math.max(0.5, this.end.distanceTo(this.from));
    }
    this.shake = 0.3;
  }

  /** The bird's front is `front` m along the lane: everyone it has passed inside the lane is struck, once. */
  private sweep(front: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const en of ctx.enemies?.() ?? ctx.targets) {
      if (this.struck.has(en)) continue;
      const dx = en.group.position.x - this.from.x, dz = en.group.position.z - this.from.z;
      const along = dx * this.dir.x + dz * this.dir.z;
      const perp = Math.abs(dx * this.dir.z - dz * this.dir.x);
      if (along < 0 || along > Math.min(front, BIRD_LENGTH) || perp > BIRD_WIDTH / 2) continue;
      this.struck.add(en);
      ctx.hit(en, { damage: this.settings.damage, knock: 5, from: this.from.clone(), color: PHOENIX_CSS.body });
      this.shake = 0.5;
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const mat = this.lane.material as THREE.MeshBasicMaterial;
    // the lane on the floor
    this.lane.visible = t < END_T + 0.3;
    this.lane.position.copy(this.from).addScaledVector(this.dir, BIRD_LENGTH / 2).setY(0.03);
    this.lane.rotation.y = yaw;
    this.lane.scale.set(1, 1, BIRD_LENGTH);
    mat.opacity = t < GO_T ? 0.12 + 0.25 * (t / GO_T) : 0.37 * Math.max(0, 1 - (t - GO_T) / (BIRD_AIR + 0.3));

    if (!this.gone && t >= GO_T) {
      this.gone = true;
      this.takeOff();
    }
    this.bird.visible = t < END_T + 0.25;
    this.bird.rotation.y = yaw;
    if (t < GO_T) {
      // the wind-up: the wings spread over her
      const k = t / GO_T;
      this.bird.position.copy(this.from).setY(1.6 + 0.8 * k);
      this.bird.scale.setScalar(0.25 + 0.75 * k);
    } else {
      const k = Math.min(1, (t - GO_T) / BIRD_AIR);
      const front = k * this.reach;
      this.bird.position.copy(this.from).addScaledVector(this.dir, front).setY(2.4 - 0.6 * k);
      this.bird.scale.setScalar(1 + 0.35 * Math.sin(Math.PI * k));
      if (t <= END_T + 0.05) this.sweep(front + 1.2);
    }
    for (const w of this.wings) w.rotation.x = Math.sin(t * 14) * 0.25;
    this.shake *= 0.88;
  }
}

export const firebirdModule: EffectModule = {
  label: 'firebird',
  category: 'hero: phoenix',
  // A line: the aim point only gives the direction (she crosses the 12 m wherever the cursor is).
  targeting: { mode: 'ground', radius: BIRD_WIDTH / 2 },
  create: () => new Firebird(),
  telegraphs(effect) {
    const e = effect as Firebird;
    if (!e.ctx) return [];
    const a = e.from, d = e.dir;
    // The real shape: the lane. She is rooted until she takes off.
    return [{
      shape: { kind: 'line', x1: a.x, z1: a.z, x2: a.x + d.x * BIRD_LENGTH, z2: a.z + d.z * BIRD_LENGTH, width: BIRD_WIDTH },
      start: 0.04, impact: GO_T, until: END_T,
    }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.45, threshold: 0.84 },
  frameCamera(camera, controls, effect) {
    const e = effect as Firebird;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as Firebird).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
