import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BONE, BONE_CSS, BoneDarts, BoneDust, BonePiles, BoneShards, SoulWisps } from '../../effects/parts/bone';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { PILE_KEEP } from '../../traits/bone';

/**
 * Bone Fan (bone kit v5, Q: a fan of skillshots). Mortis flicks his hand and three bone shards fan out in front of him
 * at chest height, each pointing down its own line, 18 degrees apart. A bone pile within 3 m of him (`ctx.deathSpots(8)`, see the trait's
 * Ossuary) lends one more shard (the fan holds six at most): the pile shakes, soulfire stirs on it and a shard flies
 * from it into the fan (the fan widens as it grows, the same 18 degree step). At 0.3 s every shard leaves as its own bolt
 * (`ctx.projectile`, 30 each, radius 0.2, 8 m, 20 m/s: it reaches 6 m at about 0.56 s, never before 0.5 s) and rides it; a
 * hit throws chips, dust and a small ember star, a bolt at the end of its range clatters apart. Clean by 1.3 s.
 * See pipeline/designs/kit-bone.md.
 *
 * Network duels: the context may offer no `projectile` (no bolts fly): the shards then fall apart where they hang.
 */
export interface BoneFanSettings {
  damage: number;
  knock: number;
  /** Degrees between neighbouring shards. */
  step: number;
  loop: boolean;
}

export const defaultBoneFan = (): BoneFanSettings => ({ damage: 44, knock: 1, step: 18, loop: false });

// Timeline (seconds).
const FIRE_T = 0.3; // the shards leave
const DURATION = 1.3;

const RANGE = 8;
const SPEED = 20;
const RADIUS = 0.2;
const BASE_SHARDS = 3;
const MAX_SHARDS = 6;
const PILE_R = 3; // piles this close to him lend a shard
const MUZZLE = 0.8;
const FLIGHT_END = FIRE_T + RANGE / SPEED;

export class BoneFan implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BoneFanSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** How many shards this cast throws, and the fan's centre line (for the telegraph). */
  count = BASE_SHARDS;
  readonly origin = new THREE.Vector3(0, 0, 0);
  aim = 0;
  private time = 0;
  private fired = false;
  private dirs: THREE.Vector3[] = [];
  private bolts: (Projectile | null)[] = [];
  private ended: boolean[] = [];
  private piles: { x: number; z: number }[] = [];
  private lent = 0; // how many of the shards come from piles
  private hand = new THREE.Vector3(0, 1.3, 0);

  private darts = new BoneDarts(MAX_SHARDS);
  private pileMesh = new BonePiles(MAX_SHARDS);
  private chips = new BoneShards(48);
  private wisps = new SoulWisps();
  private dust = new BoneDust();
  private stars = [0, 1, 2].map(() => new StarBurst({ points: 8, inner: 0.3, color: BONE.accent, core: 0xfff0e0, additive: false }));
  private starAge = [-1, -1, -1];
  private starPos = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private starCursor = 0;

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: BoneFanSettings = defaultBoneFan()) {
    this.settings = settings;
    this.group.add(this.pileMesh.mesh, this.darts.mesh, this.chips.mesh, this.dust.mesh, this.wisps.mesh, ...this.stars.map((s) => s.mesh));
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FIRE_T;
  }

  /** Seconds until the last bolt has flown its range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  /** The shards' lines for the telegraph: each bolt's start (at the muzzle) and direction, exactly as they fly. */
  get lines() {
    return this.dirs.map((d) => ({ x: this.origin.x + d.x * MUZZLE, z: this.origin.z + d.z * MUZZLE, dx: d.x, dz: d.z }));
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.aim = ctx.aim;
    this.origin.copy(ctx.from).setY(0);
    this.piles = (ctx.deathSpots?.(PILE_KEEP) ?? []).filter((d) => Math.hypot(d.x - ctx.from.x, d.z - ctx.from.z) <= PILE_R).map((d) => ({ x: d.x, z: d.z }));
    // Nearest piles lend their shard first.
    this.piles.sort((a, b) => Math.hypot(a.x - ctx.from.x, a.z - ctx.from.z) - Math.hypot(b.x - ctx.from.x, b.z - ctx.from.z));
    this.lent = Math.min(MAX_SHARDS - BASE_SHARDS, this.piles.length);
    this.count = BASE_SHARDS + this.lent;
    const right = this.v1.set(-Math.cos(ctx.aim), 0, Math.sin(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.v2.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim)), 0.5).addScaledVector(right, 0.25).setY(1.3);
    this.dirs = [];
    for (let i = 0; i < this.count; i++) {
      const a = ctx.aim + THREE.MathUtils.degToRad((i - (this.count - 1) / 2) * this.settings.step);
      this.dirs.push(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
    }
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.bolts = [];
    this.ended = [];
    this.starAge.fill(-1);
    this.darts.reset();
    this.pileMesh.reset();
    this.chips.reset();
    this.wisps.reset();
    this.dust.reset();
    for (const s of this.stars) s.set(this.hand, 0, 0);
  }

  /** Which fan slots are the pile-lent ones: the outermost, alternating sides. */
  private isLent(i: number) {
    if (this.lent <= 0) return -1;
    const order: number[] = [];
    for (let k = 0; k < this.count; k++) order.push(k % 2 === 0 ? Math.floor(k / 2) : this.count - 1 - Math.floor(k / 2));
    const rank = order.indexOf(i);
    return rank >= 0 && rank < this.lent ? rank : -1;
  }

  private hitFx(at: THREE.Vector3) {
    this.v3.set(at.x, BOLT_HEIGHT, at.z);
    this.chips.burst(this.v3, 6, 4.2, 3, 0.3);
    this.dust.burst(this.v3, 2, 1.8, 0.35);
    this.wisps.puff(this.v3, 1, 0.3, 0.18);
    this.starPos[this.starCursor].copy(this.v3);
    this.starAge[this.starCursor] = 0;
    this.starCursor = (this.starCursor + 1) % this.stars.length;
    this.shake = Math.max(this.shake, 0.1);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.chips.update(dt);
    this.wisps.update(dt);
    this.dust.update(dt);
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

    // --- Anticipation: the piles stir and the shards gather into a fan at his hand. ---
    if (t < FIRE_T + 0.15 && this.piles.length) {
      this.pileMesh.set(this.piles, Math.min(1, t / 0.12));
      if (t < FIRE_T && Math.random() < dt * 14) {
        const p = this.piles[Math.floor(Math.random() * Math.min(this.piles.length, Math.max(this.lent, 1)))];
        this.wisps.puff(this.v1.set(p.x, 0.1, p.z), 1, 0.3, 0.16);
      }
    } else this.pileMesh.reset();

    if (!this.fired) {
      const gather = Math.min(1, t / FIRE_T);
      const e = 1 - (1 - gather) ** 3;
      for (let i = 0; i < this.count; i++) {
        const rank = this.isLent(i);
        const dir = this.dirs[i];
        // Slot: spread a little ahead of the hand along its own line, growing as it settles.
        const slot = this.v1.copy(this.hand).addScaledVector(dir, 0.15 + 0.45 * e);
        let size = 0.3 + 0.7 * e;
        if (rank >= 0) {
          // A pile's shard flies in from the heap on an arc.
          const p = this.piles[rank];
          const k = Math.min(1, gather * 1.15);
          const ke = 1 - (1 - k) ** 2;
          slot.set(
            THREE.MathUtils.lerp(p.x, slot.x, ke),
            THREE.MathUtils.lerp(0.25, slot.y, ke) + Math.sin(ke * Math.PI) * 0.5,
            THREE.MathUtils.lerp(p.z, slot.z, ke),
          );
          size = 0.4 + 0.6 * ke;
        }
        this.darts.set(i, slot, dir, size);
      }
    }

    if (!this.fired && t >= FIRE_T) {
      this.fired = true;
      this.wisps.puff(this.hand, 3, 0.4, 0.2);
      this.shake = 0.12;
      for (let i = 0; i < this.count; i++) {
        let b: Projectile | null = null;
        if (ctx?.projectile) {
          this.v1.copy(ctx.from).addScaledVector(this.dirs[i], MUZZLE);
          b = ctx.projectile({
            from: this.v1.clone(), dir: this.dirs[i].clone(), speed: SPEED, range: RANGE, radius: RADIUS,
            hit: { damage: this.settings.damage, knock: this.settings.knock, color: BONE_CSS.body },
          });
          b.onHit((_target, at) => this.hitFx(at));
        }
        this.bolts[i] = b;
        this.ended[i] = false;
      }
    }

    if (this.fired) {
      for (let i = 0; i < this.count; i++) {
        if (this.ended[i]) continue;
        const b = this.bolts[i];
        if (b && b.alive) {
          this.v1.set(b.pos.x, BOLT_HEIGHT, b.pos.z);
          // The first hundredths glide in from the hand.
          const k = Math.min(1, (t - FIRE_T) / 0.07);
          this.v1.lerp(this.v2.copy(this.hand), (1 - k) * (1 - k));
          this.darts.set(i, this.v1, b.dir.lengthSq() > 1e-6 ? this.v2.copy(b.dir).setY(0) : this.dirs[i], 1);
          if (Math.random() < dt * 20) this.wisps.puff(this.v2.copy(this.v1).addScaledVector(this.dirs[i], -0.5), 1, 0.15, 0.14);
        } else if (t >= FIRE_T + 0.08) {
          this.ended[i] = true;
          this.darts.hide(i);
          this.v1.set(b ? b.pos.x : this.hand.x, BOLT_HEIGHT, b ? b.pos.z : this.hand.z);
          this.chips.burst(this.v1, 4, 2.6, 2, 0.3);
          this.dust.burst(this.v1, 1, 1.2, 0.3);
        }
      }
    }

    for (let i = 0; i < this.stars.length; i++) {
      if (this.starAge[i] < 0) continue;
      const sp = StarBurst.pop(this.starAge[i], 0.03, 0.04);
      this.stars[i].set(this.starPos[i], 0.85 * sp.scale, sp.opacity, 0.2);
      this.starAge[i] += dt;
      if (this.starAge[i] > 0.14) { this.starAge[i] = -1; this.stars[i].set(this.starPos[i], 0, 0); }
    }
    this.shake *= Math.exp(-dt * 14);
  }
}

export const boneFanModule: EffectModule = {
  label: 'bone fan',
  category: 'hero: bone',
  // A skillshot is aimed at a spot; `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new BoneFan(),
  telegraphs(effect) {
    const e = effect as BoneFan;
    if (!e.ctx) return [];
    // One line per shard, exactly where its bolt flies, armed at the launch and shown until the last bolt has passed (a
    // bolt's hit is the dodge check).
    return e.lines.map((l) => ({
      shape: { kind: 'line' as const, x1: l.x, z1: l.z, x2: l.x + l.dx * RANGE, z2: l.z + l.dz * RANGE, width: RADIUS * 2 },
      start: 0, impact: FIRE_T, until: e.flightEnd,
    }));
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BoneFan;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as BoneFan).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 100, 1);
    f.add(s, 'knock', 0, 8, 0.5);
    f.add(s, 'step', 3, 24, 1);
  },
};
