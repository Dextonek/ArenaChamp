import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BONE, BONE_CSS, BoneDust, BoneLance, BoneShards, SoulWisps } from '../../effects/parts/bone';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Bone Spear (bone kit, Q: skillshot). A 2.2 m spear of chunky vertebrae assembles from flying bones beside Mortis with
 * soulfire in its joints, then at 0.2 s it leaves as a piercing bolt (`ctx.projectile`); the spear follows the bolt's
 * handle. Every hit throws bone chips, dust and a small ember accent; at max range the spear clatters apart into bones
 * that fade. Clean by 1.5 s. See pipeline/designs/kit-bone.md.
 */
export interface BoneSpearSettings {
  damage: number;
  knock: number;
}

export const defaultBoneSpear = (): BoneSpearSettings => ({ damage: 50, knock: 2 });

// Timeline (seconds).
const FIRE_T = 0.2; // the spear leaves
const DURATION = 1.5;

const RANGE = 11;
const SPEED = 22;
const RADIUS = 0.45;
/** The bolt starts this far in front of the caster's feet (about his hand). */
const MUZZLE = 0.8;
const FLIGHT_END = FIRE_T + RANGE / SPEED;

export class BoneSpear implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BoneSpearSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's line, caster to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private flags = { fired: false, ended: false };
  private bolt: Projectile | null = null;
  private trail = 0;

  // Cast geometry.
  private dir = new THREE.Vector3(0, 0, -1);
  private c0 = new THREE.Vector3(0.5, 1.15, 13);

  // Parts.
  private lance = new BoneLance();
  private shards = new BoneShards(48);
  private wisps = new SoulWisps();
  private dust = new BoneDust();
  private stars = [0, 1].map(() => new StarBurst({ points: 8, inner: 0.3, color: BONE.accent, core: 0xfff0e0, additive: false }));
  private starAge = [-1, -1];
  private starPos = [new THREE.Vector3(), new THREE.Vector3()];
  private starCursor = 0;

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BoneSpearSettings = defaultBoneSpear()) {
    this.settings = settings;
    this.group.add(this.dust.mesh, this.shards.mesh, this.lance.mesh, this.wisps.mesh, ...this.stars.map((s) => s.mesh));
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FIRE_T;
  }

  /** Seconds until the bolt has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const right = this.v1.set(-Math.cos(ctx.aim), 0, Math.sin(ctx.aim));
    // The spear builds beside him, at shoulder height, pointing down the aim line.
    this.c0.copy(ctx.from).addScaledVector(right, 0.55).addScaledVector(this.dir, 0.6).setY(1.2);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.dir.x * RANGE, z2: ctx.from.z + this.dir.z * RANGE,
      width: RADIUS * 2,
    };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.trail = 0;
    this.bolt = null;
    this.flags.fired = this.flags.ended = false;
    this.starAge[0] = this.starAge[1] = -1;
    this.lance.reset();
    this.shards.reset();
    this.wisps.reset();
    this.dust.reset();
    for (const s of this.stars) s.set(this.c0, 0, 0);
  }

  /** A hit: chips, dust and a small ember accent where the spear met the body. */
  private hitFx(at: THREE.Vector3) {
    this.v2.set(at.x, BOLT_HEIGHT, at.z);
    this.shards.burst(this.v2, 7, 4.5, 3, 0.34);
    this.dust.burst(this.v2, 3, 2, 0.4);
    this.wisps.puff(this.v2, 2, 0.3, 0.2);
    this.starPos[this.starCursor].copy(this.v2);
    this.starAge[this.starCursor] = 0;
    this.starCursor = (this.starCursor + 1) % this.stars.length;
    this.shake = Math.max(this.shake, 0.12);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.lance.update(dt);
    this.shards.update(dt);
    this.wisps.update(dt);
    this.dust.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.reset();
      this.playing = false;
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // 0 - 0.2: the bones fly in from around his hand and lock into a spear.
    if (!f.fired && t < FIRE_T) this.lance.assemble(this.c0, this.dir, t / FIRE_T);

    if (!f.fired && t >= FIRE_T) {
      f.fired = true;
      this.wisps.puff(this.c0, 3, 0.4, 0.2);
      // A network duel has no bolts (the context leaves `projectile` out): the spear then just falls apart.
      if (ctx?.projectile) {
        this.v1.copy(ctx.from).addScaledVector(this.dir, MUZZLE);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.dir.clone(), speed: SPEED, range: RANGE, radius: RADIUS, pierce: true,
          hit: { damage: this.settings.damage, knock: this.settings.knock, color: BONE_CSS.body },
        });
        this.bolt.onHit((_target, at) => this.hitFx(at));
      }
    }

    if (f.fired && !f.ended) {
      const b = this.bolt;
      if (b && b.alive) {
        // The spear rides the bolt; the first few hundredths glide in from where it was built.
        const k = Math.min(1, (t - FIRE_T) / 0.08);
        this.v1.set(b.pos.x, BOLT_HEIGHT, b.pos.z);
        this.v1.lerp(this.c0, (1 - k) * (1 - k));
        this.lance.place(this.v1, b.dir.lengthSq() > 1e-6 ? this.v2.copy(b.dir).setY(0).normalize() : this.dir);
        this.trail += dt;
        while (this.trail >= 0.045) {
          this.trail -= 0.045;
          this.wisps.puff(this.v2.copy(this.v1).addScaledVector(this.dir, -1.1), 1, 0.2, 0.16);
        }
      } else if (!b && t >= FIRE_T + 0.1) {
        this.scatter(this.c0);
      } else if (b) {
        // Max range (or a pillar): it clatters apart into bones.
        this.scatter(this.v1.set(b.pos.x, BOLT_HEIGHT, b.pos.z));
      }
    }

    for (let i = 0; i < this.stars.length; i++) {
      if (this.starAge[i] < 0) continue;
      const sp = StarBurst.pop(this.starAge[i], 0.03, 0.04);
      this.stars[i].set(this.starPos[i], 0.95 * sp.scale, sp.opacity, 0.2);
      this.starAge[i] += dt;
      if (this.starAge[i] > 0.14) { this.starAge[i] = -1; this.stars[i].set(this.starPos[i], 0, 0); }
    }
    this.shake *= Math.exp(-dt * 14);
  }

  private scatter(at: THREE.Vector3) {
    this.flags.ended = true;
    this.lance.hide();
    this.shards.burst(at, 10, 3.5, 2.6, 0.4);
    this.dust.burst(at, 4, 1.6, 0.4);
    this.wisps.puff(at, 3, 0.8, 0.2);
  }
}

export const boneSpearModule: EffectModule = {
  label: 'bone spear',
  category: 'hero: bone',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new BoneSpear(),
  telegraphs(effect) {
    const e = effect as BoneSpear;
    if (!e.ctx) return [];
    // Armed at the launch, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
    return [{ shape: e.line, start: 0, impact: FIRE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BoneSpear;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as BoneSpear).settings;
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
