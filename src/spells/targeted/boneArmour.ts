import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { BONE, BONE_CSS, BoneDarts, BoneDust, BoneShards, RibCage, SoulWisps } from '../../effects/parts/bone';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { boneArmours, type BoneArmourState } from '../../traits/bone';

/**
 * Bone Armour (bone kit v4, E: a self shield that answers). A cage of ribs grows up round Mortis from the floor (0.4 s,
 * radius 1.1, 2 m high) with soulfire in its joints, and a ring of dust and chips marks the moment it closes. The shield
 * itself (30 plus 30 per living skeleton, at most 120, for 4 s) is the trait's (`afterCast`, `src/traits/bone.ts`):
 * this effect only draws it and keeps the ribs standing round him. When the armour breaks (the trait's `boneArmours`
 * record says the damage taken used it up) or at 3.5 s, whichever is first, the ribs fly apart and five of them turn
 * into darts that home in on the enemy: 0.3 s later they hit it for 38 (`projectile: true`, so the duel's zone check
 * lets them through; one hit when the first dart lands) with an ember star, chips and a ground ripple. The cast is
 * 3.5 s old at the latest, inside the duel's 4.2 s window for spell hits. Clean by 4.6 s.
 *
 * Where the trait gives no record (the VFX tool, or the other screen of a network duel) the shards simply fly at 3.5 s.
 * With no enemy near at the cast (`targets` is empty) the ribs only crumble.
 */
export interface BoneArmourSettings {
  /** Damage of the shards when they land. */
  damage: number;
  loop: boolean;
}

export const defaultBoneArmour = (): BoneArmourSettings => ({ damage: 38, loop: false });

// Timeline (seconds).
const GROW_END = 0.45; // the cage is up
const BURST_T = 3.5; // the shards leave at the latest
const MIN_BURST = 0.6; // not earlier than this, even if the shield breaks at once
const FLY = 0.3; // dart flight time
const DURATION = 4.6;

const RADIUS = 8; // the AI casts it when the enemy is inside this minus 0.6
const CAGE_R = 1.1;
const CAGE_H = 2.0;
const DARTS = 5;

export class BoneArmour implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BoneArmourSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { grown: false, burst: false, landed: false };
  private burstT = -1;
  private state: BoneArmourState | null = null;
  private center = new THREE.Vector3();
  private starAt = -1;
  private starPos = new THREE.Vector3();
  private dartFrom: THREE.Vector3[] = Array.from({ length: DARTS }, () => new THREE.Vector3());
  private dartSkew: number[] = [];
  private aimAt = new THREE.Vector3();
  private dir = new THREE.Vector3();

  private cage = new RibCage();
  private darts = new BoneDarts(DARTS);
  private chips = new BoneShards(56);
  private wisps = new SoulWisps();
  private dust = new BoneDust();
  private star = new StarBurst({ points: 8, inner: 0.3, color: BONE.accent, core: 0xfff0e0, additive: false });
  private ripple = new ShockRefraction({ facing: 'ground' });
  private spots: [number, number][] = [[0, 0.5], [2, 0.72], [3, 0.38], [5, 0.8], [6, 0.55], [7, 0.3]];

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BoneArmourSettings = defaultBoneArmour()) {
    this.settings = settings;
    this.group.add(this.cage.mesh, this.darts.mesh, this.dust.mesh, this.chips.mesh, this.wisps.mesh, this.star.mesh, this.ripple.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return 0.3;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.from).setY(0);
  }

  play() {
    this.reset();
    this.playing = true;
    // The trait opened its record in `afterCast`, just before this.
    this.state = this.ctx ? boneArmours.get(this.ctx.caster) ?? null : null;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.burstT = -1;
    this.starAt = -1;
    this.state = null;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.cage.reset();
    this.darts.reset();
    this.chips.reset();
    this.wisps.reset();
    this.dust.reset();
    this.star.set(this.center, 0, 0);
    this.ripple.set(this.center, 0, 0);
  }

  /** He walks; the cage walks with him. */
  private follow() {
    const c = this.ctx?.caster.group.position;
    if (c) this.center.set(c.x, 0, c.z);
  }

  /** The darts leave: five ribs break off and fly, curving, at the enemy's chest (its live position). */
  private launch(t: number) {
    const f = this.flags;
    f.burst = true;
    this.burstT = t;
    this.wisps.release();
    this.dust.ring(this.center, CAGE_R + 0.4, 6, 0.5);
    this.chips.ring(this.center, 8, CAGE_R + 0.6, 0.4, 1.0, 0.32);
    this.shake = 0.3;
    this.dartSkew = [];
    for (let i = 0; i < DARTS; i++) {
      this.cage.pointAt(i, 0.35 + 0.1 * (i % 3), 0, this.dartFrom[i]);
      this.dartSkew.push((i - (DARTS - 1) / 2) * 0.55);
    }
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
    const f = this.flags;
    this.follow();

    // --- The cage grows round him; the soulfire lights in its joints. ---
    if (!f.grown && t >= GROW_END) {
      f.grown = true;
      for (const [rib, s] of this.spots) {
        this.cage.pointAt(rib, s, 0, this.v1);
        this.wisps.attach(this.v1, 2, 0.15, 0.2);
      }
      this.dust.ring(this.center, CAGE_R, 6, 0.4);
      this.chips.ring(this.center, 8, CAGE_R + 0.4, 0.35, 0.6, 0.3);
      this.shake = 0.18;
    }

    // --- When: the shield breaks, or 3.5 s. ---
    if (!f.burst && t >= MIN_BURST && ((this.state?.broke ?? false) || t >= BURST_T)) this.launch(t);

    this.layout(t, dt);

    // --- The darts land together: the hit, the star, the ripple. ---
    if (f.burst && !f.landed && t >= this.burstT + FLY) {
      f.landed = true;
      const e = ctx?.targets[0];
      if (ctx && e) {
        ctx.hit(e, { damage: this.settings.damage, knock: 2, from: ctx.caster.group.position, color: BONE_CSS.body, projectile: true });
        this.v1.set(e.group.position.x, 1.1, e.group.position.z);
        this.chips.burst(this.v1, 10, 5, 3.5, 0.32);
        this.dust.burst(this.v1, 3, 2, 0.4);
        this.wisps.puff(this.v1, 3, 0.5, 0.2);
      }
      this.starAt = t;
      this.starPos.copy(this.aimAt);
      this.shake = Math.max(this.shake, 0.3);
    }
    if (this.starAt >= 0) {
      const a = t - this.starAt;
      const sp = StarBurst.pop(a, 0.03, 0.05);
      this.star.set(this.starPos, 1.2 * sp.scale, sp.opacity, 0.2);
      const k = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.ripple.set(this.v2.copy(this.starPos).setY(0), 0.4 + 2 * k, 0.03 * (1 - k) * (1 - k));
    }
    this.shake *= Math.exp(-dt * 12);
  }

  private layout(t: number, dt: number) {
    const f = this.flags;
    const grow = THREE.MathUtils.clamp(t / GROW_END, 0, 1);
    // Anticipation: the shield is about to give; a slow rise of flex, a fast shiver in the last 0.4 s before the 3.5 s mark.
    let flex = f.grown ? 0.06 * Math.sin(t * 5) : 0;
    if (!f.burst && t > BURST_T - 0.5) flex += 0.1 * Math.sin(t * 40);
    const crumbleStart = f.burst ? this.burstT : Infinity;
    const crumble = f.burst ? THREE.MathUtils.clamp((t - crumbleStart) / 0.45, 0, 1) : 0;
    if (!f.burst || crumble < 1) this.cage.set(this.center, CAGE_R, CAGE_H, grow, flex, crumble, t * 0.3);
    else this.cage.hide();

    // Wisps keep to the ribs: re-attach every so often so they ride him as he walks.
    if (f.grown && !f.burst && Math.random() < dt * 2.5) {
      const [rib, s] = this.spots[Math.floor(Math.random() * this.spots.length)];
      this.cage.pointAt(rib, s, flex, this.v1);
      this.wisps.puff(this.v1, 1, 0.1, 0.14);
    }

    // The darts home in on the enemy's chest on a curve.
    if (f.burst && !f.landed) {
      const e = this.ctx?.targets[0];
      if (e) this.aimAt.set(e.group.position.x, 1.2, e.group.position.z);
      else this.aimAt.copy(this.center).setY(1.2).add(this.v2.set(0, 0, 3));
      const k = THREE.MathUtils.clamp((t - this.burstT) / FLY, 0, 1);
      const ke = smoothstep(k);
      for (let i = 0; i < DARTS; i++) {
        const from = this.dartFrom[i];
        this.v1.lerpVectors(from, this.aimAt, ke);
        // Each dart arcs out sideways and up, then closes.
        const bow = Math.sin(ke * Math.PI);
        this.v2.copy(this.aimAt).sub(from).setY(0).normalize();
        this.v1.x += -this.v2.z * this.dartSkew[i] * bow;
        this.v1.z += this.v2.x * this.dartSkew[i] * bow;
        this.v1.y += bow * (0.4 + 0.2 * (i % 2));
        // Point along the flight: from the spot a moment ago to this one (toward the aim at the start).
        this.dir.copy(this.aimAt).sub(this.v1);
        this.darts.set(i, this.v1, this.dir, 0.8);
        if (Math.random() < dt * 25) this.wisps.puff(this.v1, 1, 0.1, 0.12);
      }
    } else if (f.landed) {
      this.darts.reset();
    }
  }
}

export const boneArmourModule: EffectModule = {
  label: 'bone armour',
  category: 'hero: bone',
  // Centred on the caster; `radius` is how close the enemy must be for the duel AI to cast it (this minus 0.6).
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new BoneArmour(),
  // No zone: the shards are homing hits (`projectile: true`).
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BoneArmour;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as BoneArmour).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 100, 1);
  },
};
