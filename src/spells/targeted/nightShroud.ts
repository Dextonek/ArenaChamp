import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import type { Projectile } from '../../effects/projectile';
import {
  Afterimage, CutFlash, CutShape, SHADOW_CSS, ShadowPool, facing, forward, shadowEaseOut,
} from '../../effects/parts/shadow';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Night Shroud (shadow kit, E: QUICK fan, no aim). A shadow pool spreads under Nyx and three figure cut-outs (clones)
 * rise in front of her. At 0.2 s they fly out as three skillshots (`ctx.projectile`) fanned 25 degrees apart along
 * where she faces (her yaw at cast, not the click), each leaving a stepped afterimage trail; a bolt that hits flashes
 * a mint cut, a bolt that misses fades at the end of its range. Then the pool shrinks. See
 * pipeline/designs/kit-shadow.md.
 */
export interface NightShroudSettings {
  damage: number;
  loop: boolean;
}

export const defaultNightShroud = (): NightShroudSettings => ({ damage: 22, loop: false });

// Timeline (seconds).
const RISE_END = 0.2;
const FIRE_T = 0.2;
const DURATION = 1.8;
const RADIUS = 8; // self mode: the AI fires it when the enemy is inside RADIUS - 0.6
const RANGE = 9;
const SPEED = 18;
const BOLT_RADIUS = 0.45;
const FAN_DEG = 25;
const CLONES = 3;
const CLONE_H = 2.1;
const UP = new THREE.Vector3(0, 1, 0);

export class NightShroud implements Effect {
  readonly group = new THREE.Group();
  readonly settings: NightShroudSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  private from = new THREE.Vector3(0, 0, 14);
  private nrm = new THREE.Vector3(0, 0, 1);
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  /** The unit direction of each of the three bolts, set at cast from the caster's facing. */
  readonly dirs = Array.from({ length: CLONES }, () => new THREE.Vector3(0, 0, 1));

  private flags = { fired: false };
  private bolts: Projectile[] = [];
  /** Where each clone last stood, and when it vanished (-1 = still flying). */
  private last = Array.from({ length: CLONES }, () => new THREE.Vector3());
  private goneAt: number[] = [-1, -1, -1];
  private shrunk = false;

  // Parts.
  private pool = new ShadowPool();
  private clones = Array.from({ length: CLONES }, () => new CutShape({ kind: 'figure', renderOrder: 4 }));
  private trails = Array.from({ length: CLONES }, () => new Afterimage(3));
  private cuts = Array.from({ length: CLONES }, () => new CutFlash());
  private origin = Array.from({ length: CLONES }, () => new THREE.Vector3());

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: NightShroudSettings = defaultNightShroud()) {
    this.settings = settings;
    for (const tr of this.trails) { tr.size = CLONE_H * 1.05; tr.fadeLen = 1.1; }
    this.group.add(this.pool.mesh, ...this.trails.map((a) => a.mesh), ...this.clones.map((c) => c.mesh), ...this.cuts.map((c) => c.mesh));
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FIRE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    // QUICK: no aim. The direction is where Nyx faces right now.
    const yaw = ctx.caster.group.rotation.y;
    facing(yaw, this.nrm);
    forward(yaw, this.fwd);
    this.right.crossVectors(UP, this.nrm).normalize();
    for (let i = 0; i < CLONES; i++) {
      const a = THREE.MathUtils.degToRad((i - 1) * FAN_DEG);
      this.dirs[i].set(Math.sin(yaw + a), 0, Math.cos(yaw + a));
      this.origin[i].copy(this.from).addScaledVector(this.dirs[i], 1.1).setY(0.06);
    }
    for (const a of this.trails) a.face(yaw);
    for (const c of this.cuts) c.face(yaw);
    this.screen.focus.copy(this.from).setY(1.3);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.fired = false;
    this.bolts = [];
    this.goneAt = [-1, -1, -1];
    this.shrunk = false;
    clearScreenFx(this.screen);
    this.pool.reset();
    for (const c of this.clones) c.reset();
    for (const a of this.trails) a.reset();
    for (const c of this.cuts) c.reset();
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

    if (!f.fired && t >= FIRE_T) {
      f.fired = true;
      this.shake = 0.1;
      // A network duel has no bolts (the context leaves `projectile` out): the clones then just fade where they rose.
      if (ctx?.projectile) {
        for (let i = 0; i < CLONES; i++) {
          const b = ctx.projectile({
            from: this.origin[i].clone(), dir: this.dirs[i].clone(), speed: SPEED, range: RANGE, radius: BOLT_RADIUS,
            hit: { damage: this.settings.damage, knock: 1, color: SHADOW_CSS.hot },
          });
          b.onHit((_target, at) => {
            this.cuts[i].cut(this.v1.set(at.x, 1.1, at.z), this.v2.copy(this.right).multiplyScalar(0.8).addScaledVector(UP, 0.6 * (i % 2 ? -1 : 1)), 1.7);
            this.shake = 0.14;
          });
          this.bolts[i] = b;
        }
      }
    }
    if (!this.shrunk && t >= DURATION - 0.7) {
      this.shrunk = true;
      this.pool.shrink(0.5);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const rise = shadowEaseOut(t / RISE_END);

    this.pool.spread(this.from, 2, smoothstep(t / RISE_END));

    for (let i = 0; i < CLONES; i++) {
      const c = this.clones[i];
      const b = this.bolts[i];
      this.v1.copy(this.origin[i]);
      if (this.flags.fired) {
        if (b && b.alive) {
          this.v1.set(b.pos.x, 0.06, b.pos.z);
          this.last[i].copy(this.v1);
          this.trails[i].trail(this.origin[i], this.v1, 3, 1);
        } else {
          if (this.goneAt[i] < 0) {
            this.goneAt[i] = t;
            if (!b) this.last[i].copy(this.origin[i]);
          }
          this.v1.copy(this.last[i]);
        }
      }
      const gone = this.goneAt[i] >= 0 ? (t - this.goneAt[i]) / 0.15 : 0;
      c.place(this.v1, this.nrm, CLONE_H * Math.max(rise, 0.02), 0, this.fwd);
      c.opacity = 1 - smoothstep(gone);
      if (gone >= 1) this.trails[i].reset();
    }
    this.shake *= 0.85;
  }
}

export const nightShroudModule: EffectModule = {
  label: 'night shroud',
  category: 'hero: shadow',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new NightShroud(),
  telegraphs(effect) {
    const e = effect as NightShroud;
    const c = e.ctx?.from;
    if (!c) return [];
    return e.dirs.map((d) => ({
      shape: { kind: 'line' as const, x1: c.x, z1: c.z, x2: c.x + d.x * RANGE, z2: c.z + d.z * RANGE, width: 0.9 },
      start: 0,
      impact: FIRE_T,
    }));
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as NightShroud;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as NightShroud).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
