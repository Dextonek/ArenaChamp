import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import {
  Afterimage, CutFlash, CutShape, CutShards, SHADOW_CSS, ShadowPool, facing,
} from '../../effects/parts/shadow';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { shadowDaggers, type ShadowDagger } from '../../traits/shadow';

/**
 * Shadow Swap (shadow kit, W: a dagger she can swap to). Nyx flicks a flat black dagger with a violet edge down the aim
 * (`ctx.projectile`, 22 m/s, radius 0.45, range 11) and stepped ghosts of it trail behind. On an enemy it cuts (damage,
 * a mint flash, a small shadow pool under it). Missing, it stops at max range and stays stuck there, on a small pool,
 * until 3 s after the cast, then fades. The trait's recast (`replay: false`, 3 s window, `src/traits/shadow.ts`) swaps her
 * to the dagger; this effect publishes the dagger's position every frame in `shadowDaggers` (keyed by her figure; `hit`
 * tells the trait it ended on an enemy, so she lands 1.2 m short and the enemy never moves) and, when the recast marks
 * it `taken`, draws a trail of her figures from where she left to the dagger, bursts shards there and removes the
 * dagger. With no projectile (a network duel) the dagger is a deterministic visual at 22 m/s from the cast point, which is
 * also what the trait swaps to. Clean by 3.4 s.
 */
export interface ShadowSwapSettings {
  damage: number;
  loop: boolean;
}

export const defaultShadowSwap = (): ShadowSwapSettings => ({ damage: 35, loop: false });

// Timeline (seconds).
const FIRE_T = 0.12;
const HOVER_END = 3.0; // the recast window closes
const DURATION = 3.4;
const SWAP_T = 0.3; // the trail of figures from her old spot to the dagger

export const DAGGER_RANGE = 11;
const SPEED = 22;
const RADIUS = 0.45;
const MUZZLE = 0.9;
const FLIGHT_END = FIRE_T + DAGGER_RANGE / SPEED;
const GHOSTS = 3;
const UP = new THREE.Vector3(0, 1, 0);

export class ShadowSwap implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShadowSwapSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The dagger's path, muzzle to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private flags = { fired: false, ended: false, popped: false, swapped: false, gone: false };
  private swapAt = 0;
  private bolt: Projectile | null = null;
  private owner: object | null = null;
  private dagger: ShadowDagger = { x: 0, z: 0, hit: false, taken: false, fromX: 0, fromZ: 0 };
  private dir = new THREE.Vector3(0, 0, -1);
  private muzzle = new THREE.Vector3();
  private nrm = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3(1, 0, 0);
  private roll = 0;

  private blade = new CutShape({ kind: 'blade', renderOrder: 6 });
  private ghosts = Array.from({ length: GHOSTS }, () => new CutShape({ kind: 'blade', renderOrder: 5, edgeWidth: 0.08 }));
  private pool = new ShadowPool();
  private cut = new CutFlash();
  private shards = new CutShards(24);
  private trail = new Afterimage(5);

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: ShadowSwapSettings = defaultShadowSwap()) {
    this.settings = settings;
    this.group.add(this.pool.mesh, this.trail.mesh, ...this.ghosts.map((g) => g.mesh), this.blade.mesh, this.shards.mesh, this.cut.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FIRE_T;
  }

  /** Seconds until the dagger has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.muzzle.copy(ctx.from).addScaledVector(this.dir, MUZZLE).setY(0);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.dir.x * (MUZZLE + DAGGER_RANGE), z2: ctx.from.z + this.dir.z * (MUZZLE + DAGGER_RANGE),
      width: RADIUS * 2,
    };
    facing(ctx.aim, this.nrm);
    this.right.crossVectors(UP, this.nrm).normalize();
    this.cut.face(ctx.aim);
    this.trail.face(ctx.aim);
    this.roll = ctx.aim - Math.PI / 2; // lies flat with its tip along the aim
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // Publish the dagger at once: it is at the muzzle until it flies (a recast before that swaps a metre).
    this.owner = ctx.caster;
    this.dagger = { x: this.muzzle.x, z: this.muzzle.z, hit: false, taken: false, fromX: 0, fromZ: 0 };
    shadowDaggers.set(this.owner, this.dagger);
  }

  private reset() {
    if (this.owner && shadowDaggers.get(this.owner) === this.dagger) shadowDaggers.delete(this.owner);
    this.owner = null;
    this.time = 0;
    this.shake = 0;
    this.bolt = null;
    this.swapAt = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.blade.reset();
    for (const g of this.ghosts) g.reset();
    this.pool.reset();
    this.cut.reset();
    this.shards.reset();
    this.trail.reset();
  }

  /** The cut where the dagger ended: a flash, shards and (on an enemy) a small shadow pool. */
  private pop(at: THREE.Vector3, withPool: boolean) {
    this.cut.cut(this.v3.set(at.x, BOLT_HEIGHT, at.z), this.v2.copy(this.right).multiplyScalar(0.7).addScaledVector(UP, 0.7), 1.1);
    this.shards.burst(this.v3.set(at.x, 0.5, at.z), 1.1, 8, 3.5, 3, 0.9);
    if (withPool) this.pool.spread(this.v3.set(at.x, 0, at.z), 1.2, 1);
    this.shake = Math.max(this.shake, 0.15);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
    this.shards.update(dt);
    this.cut.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;
    const d = this.dagger;

    if (!f.fired && t >= FIRE_T) {
      f.fired = true;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.muzzle.clone(), dir: this.dir.clone(), speed: SPEED, range: DAGGER_RANGE, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 1.5, color: SHADOW_CSS.hot },
        });
        this.bolt.onHit((_target, at) => {
          d.hit = true;
          d.x = at.x;
          d.z = at.z;
          f.popped = true;
          this.pop(at, true);
        });
      }
    }

    // --- Where the dagger is now: the bolt's position, else the deterministic path from the cast. ---
    if (f.fired && !f.ended && !f.gone) {
      const b = this.bolt;
      if (b) {
        if (b.alive) {
          d.x = b.pos.x;
          d.z = b.pos.z;
        } else {
          f.ended = true;
        }
      } else {
        const run = Math.min(DAGGER_RANGE, (t - FIRE_T) * SPEED);
        d.x = this.muzzle.x + this.dir.x * run;
        d.z = this.muzzle.z + this.dir.z * run;
        if (run >= DAGGER_RANGE) f.ended = true;
      }
      // It stopped short of max range on nothing (a wall) or reached it: stuck in the floor on a small pool.
      if (f.ended && !f.popped) {
        f.popped = true;
        this.pop(this.v1.set(d.x, 0, d.z), true);
      }
    }

    // --- The recast swapped her to the dagger: a trail of figures from where she left, a pop, the dagger is spent. ---
    if (d.taken && !f.swapped) {
      f.swapped = true;
      this.swapAt = t;
      this.pop(this.v1.set(d.x, 0, d.z), false);
      this.shards.burst(this.v3.set(d.fromX, 0.8, d.fromZ), 1.0, 10, 4, 3, 0.9);
      f.gone = true;
    }
    if (f.swapped) {
      const s = Math.min(1, (t - this.swapAt) / SWAP_T);
      this.trail.trail(this.v1.set(d.fromX, 0.05, d.fromZ), this.v2.set(d.x, 0.05, d.z), 4, s);
    }

    // --- The dagger itself: flat, tip along the aim, with stepped ghosts behind it while it flies. ---
    const live = f.fired && !f.gone;
    const fade = t > HOVER_END - 0.3 ? Math.max(0, (HOVER_END - t) / 0.3) : 1;
    const flying = live && !f.ended && !(f.popped && d.hit);
    const shown = live && !(f.popped && d.hit);
    if (shown) {
      this.v1.set(d.x, BOLT_HEIGHT * 0.75, d.z);
      this.blade.place(this.v1, UP, 1.7, this.roll);
      this.blade.opacity = fade;
    } else this.blade.opacity = 0;
    for (let k = 0; k < GHOSTS; k++) {
      const g = this.ghosts[k];
      if (!flying) { g.opacity = 0; continue; }
      const back = (k + 1) * 0.8;
      this.v1.set(d.x - this.dir.x * back, BOLT_HEIGHT * 0.75, d.z - this.dir.z * back);
      g.place(this.v1, UP, 1.5 - k * 0.15, this.roll);
      g.opacity = 0.55 / (k + 1);
    }
    this.pool.opacity = live ? fade : 0;
    this.shake *= Math.exp(-dt * 12);
  }
}

export const shadowSwapModule: EffectModule = {
  label: 'shadow swap',
  category: 'hero: shadow',
  // Aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new ShadowSwap(),
  telegraphs(effect) {
    const e = effect as ShadowSwap;
    if (!e.ctx) return [];
    // A fast skillshot: dodged by stepping off the line while it travels.
    return [{ shape: e.line, start: 0, impact: FIRE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as ShadowSwap;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as ShadowSwap).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};

