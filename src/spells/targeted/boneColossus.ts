import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BONE, BONE_CSS, BoneDust, BoneShards, BoneSpire, GroundCracks, SoulWisps, colossusLook } from '../../effects/parts/bone';
import type { SummonUnit } from '../../effects/summon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Bone Colossus (bone kit, R: the ultimate, one big summon). The ground at the aimed spot trembles, the world dims to a
 * teal-black and cracks with teal light spread over it; a ring of bone spires shoves up round the rim. At 0.75 s it
 * splits: dust, bone chips, soulfire, an impact frame, a ground shockwave and a hit on whoever stands on the spot
 * (`ctx.hit`), and one giant skeleton (`ctx.summon`, `colossusLook`: 2.5x, horned, with a bone club) climbs out of the
 * hole. It then fights as a unit: every swing of its club cracks the ground in front of it and throws a dust ring, every
 * few steps shake the floor a little. When it dies (slain or out of time) it falls apart into a burst of bones and
 * soulfire. The damage is the unit's own attack (not `ctx.hit`). Without `ctx.summon` (network duels) only the look
 * plays and the effect ends at 2.6 s; with a colossus it follows the unit and ends 1.6 s after its death (12 s at most).
 * See pipeline/designs/kit-bone.md.
 */
export interface BoneColossusSettings {
  /** Damage of the climb-out burst on the spot (the colossus's own club damage is `COLOSSUS.damage`). */
  damage: number;
  loop: boolean;
}

export const defaultBoneColossus = (): BoneColossusSettings => ({ damage: 25, loop: false });

/** The summon's numbers (also quoted in the kit's blurb). */
export const COLOSSUS = { hp: 280, damage: 28, attackEvery: 1.5, speed: 2.6, seconds: 8 } as const;

// Timeline (seconds).
const HIT_T = 0.75; // the ground splits, the colossus climbs out
const SPIRE_T = 0.35; // the rim spires shove up
const SINK_T = 1.9; // the rim spires sink
const NO_SUMMON_END = 2.6;
const MAX_END = 12;
const AFTER_DEATH = 1.6;

const RADIUS = 2.6; // the climb-out burst
const CRACK_R = 3.6;
const SPIRES = 8;
const SLAM_CRACKS = 3;
const STEP_EVERY = 0.62;

export class BoneColossus implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BoneColossusSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private endAt = NO_SUMMON_END;
  private point = new THREE.Vector3(0, 0, -8);

  private flags = { cracks: false, spires: false, hit: false, sunk: false, faded: false };
  private unit: SummonUnit | null = null;
  private prevSwing = -1;
  private stepClock = 0;
  private last = new THREE.Vector3();
  private collapseAt = -1;
  private collapsePos = new THREE.Vector3();
  private slamFade: number[] = [];
  private slamNext = 0;

  // Parts.
  private cracks = new GroundCracks();
  private slamCracks = Array.from({ length: SLAM_CRACKS }, () => new GroundCracks());
  private spires = Array.from({ length: SPIRES }, (_, i) => new BoneSpire(i % 3 === 1, 5, i));
  private shards = new BoneShards(56);
  private wisps = new SoulWisps();
  private dust = new BoneDust();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: BONE.accent, core: 0xfff0e0, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private slamShock = new ShockRefraction({ facing: 'ground' });
  private slamAt = new THREE.Vector3();
  private slamT = -1;

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BoneColossusSettings = defaultBoneColossus()) {
    this.settings = settings;
    this.screen.impactColor.set(BONE.hot);
    this.screen.tint.set(BONE.dark);
    this.group.add(
      this.cracks.mesh, ...this.slamCracks.map((c) => c.mesh), ...this.spires.map((s) => s.mesh), this.dust.mesh, this.shards.mesh,
      this.wisps.mesh, this.pop.mesh, this.groundShock.mesh, this.slamShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return this.endAt;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(1.5);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.endAt = NO_SUMMON_END;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.unit = null;
    this.prevSwing = -1;
    this.stepClock = 0;
    this.collapseAt = -1;
    this.slamFade.length = 0;
    this.slamNext = 0;
    this.slamT = -1;
    clearScreenFx(this.screen);
    this.screen.tint.set(BONE.dark);
    this.cracks.reset();
    for (const c of this.slamCracks) c.reset();
    for (const s of this.spires) s.reset();
    this.shards.reset();
    this.wisps.reset();
    this.dust.reset();
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
    this.slamShock.set(this.point, 0, 0);
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    this.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.cracks.update(dt);
    for (const c of this.slamCracks) c.update(dt);
    for (const s of this.spires) s.update(dt);
    this.shards.update(dt);
    this.wisps.update(dt);
    this.dust.update(dt);
    this.time += dt;
    if (this.time >= this.endAt) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    if (!f.cracks && t >= 0.02) {
      f.cracks = true;
      this.cracks.spread(this.point, CRACK_R, 0.55);
      // Soulfire flickers out of the cracks.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5, r = CRACK_R * (0.25 + 0.14 * (i % 3));
        this.wisps.attach(this.v1.set(this.point.x + Math.cos(a) * r, 0.12, this.point.z + Math.sin(a) * r), 1, 0.3, 0.22);
      }
    }
    if (!f.spires && t >= SPIRE_T) {
      f.spires = true;
      // Rim spires shove up round the hole while it trembles.
      this.spires.forEach((s, i) => {
        const a = (i / SPIRES) * Math.PI * 2 + 0.3, r = 2.0 + (i % 2) * 0.35;
        this.v1.set(this.point.x + Math.cos(a) * r, 0, this.point.z + Math.sin(a) * r);
        s.grow(this.v1, 1.2 + ((i * 37) % 10) / 10, 0.3, 0.5, a + Math.PI, i * 0.025);
      });
      this.dust.burst(this.v1.set(this.point.x, 0, this.point.z), 5, 1.8, 0.45);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.burst();
    }
    if (f.hit && !f.sunk && t >= SINK_T) {
      f.sunk = true;
      this.spires.forEach((s, i) => s.crumble(0.5, (i % 4) * 0.05));
    }
    if (!f.faded && t >= SINK_T + 0.3) {
      f.faded = true;
      this.cracks.fade(0.9);
      this.wisps.release();
    }

    this.follow(dt);
    this.layout(dt);
    // Slam cracks fade a moment after they open.
    for (let i = 0; i < this.slamFade.length; i++) {
      if (this.slamFade[i] >= 0 && t >= this.slamFade[i]) {
        this.slamCracks[i].fade(0.6);
        this.slamFade[i] = -1;
      }
    }
  }

  /** The split: the burst, the hit on the spot, the colossus. */
  private burst() {
    const ctx = this.ctx;
    this.dust.ring(this.point, CRACK_R, 12, 0.8);
    this.dust.burst(this.point, 10, 3.2, 0.6);
    this.shards.burst(this.v1.set(this.point.x, 0.4, this.point.z), 26, 7, 6.5, 0.46);
    this.wisps.puff(this.point, 8, 1.4, 0.32);
    if (!ctx) return;
    for (let i = 0; i < ctx.targets.length; i++) {
      const e = ctx.targets[i], p = ctx.targetPos[i] ?? e.group.position;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) {
        ctx.hit(e, { damage: this.settings.damage, knock: 4, from: this.point, color: BONE_CSS.body });
      }
    }
    const handle = ctx.summon?.({
      kind: 'melee', at: this.point.clone(), count: 1, hp: COLOSSUS.hp, seconds: COLOSSUS.seconds, damage: COLOSSUS.damage,
      attackEvery: COLOSSUS.attackEvery, speed: COLOSSUS.speed, color: BONE_CSS.body, look: colossusLook,
    });
    const unit = handle?.units[0];
    if (!handle || !unit) return;
    this.unit = unit;
    this.last.copy(unit.pos);
    this.endAt = MAX_END;
    // The collapse is queued here and played in update(), so it stays on the effect's clock.
    handle.onDeath((u) => {
      if (u !== this.unit) return;
      this.collapsePos.copy(u.pos);
      this.collapseAt = this.time;
    });
  }

  /** What the colossus does to the ground: slam cracks, footsteps, the collapse. */
  private follow(dt: number) {
    const u = this.unit;
    if (u && u.alive) {
      // A swing that has just landed: crack the ground in front of him.
      if (this.prevSwing >= 0 && u.swing < 0) this.slam(u);
      this.prevSwing = u.swing;
      // Heavy steps while he walks.
      const moved = Math.hypot(u.pos.x - this.last.x, u.pos.z - this.last.z);
      this.last.copy(u.pos);
      if (moved > 1e-4 && this.time > HIT_T + 0.9) {
        this.stepClock += dt;
        if (this.stepClock >= STEP_EVERY) {
          this.stepClock = 0;
          this.dust.burst(this.v1.set(u.pos.x, 0, u.pos.z), 2, 1.2, 0.38);
          this.shake = Math.max(this.shake, 0.07);
        }
      }
    }
    if (this.collapseAt >= 0) {
      this.collapse();
      this.collapseAt = -2;
      this.unit = null;
      this.endAt = Math.min(this.endAt, this.time + AFTER_DEATH);
    }
  }

  private slam(u: SummonUnit) {
    const yaw = u.figure.group.rotation.y;
    this.slamAt.set(u.pos.x + Math.sin(yaw) * 1.7, 0, u.pos.z + Math.cos(yaw) * 1.7);
    this.slamT = this.time;
    const i = this.slamNext;
    this.slamNext = (i + 1) % SLAM_CRACKS;
    this.slamCracks[i].spread(this.slamAt, 2.1, 0.12);
    this.slamFade[i] = this.time + 0.5;
    this.dust.ring(this.slamAt, 2.2, 7, 0.5);
    this.shards.burst(this.v1.set(this.slamAt.x, 0.3, this.slamAt.z), 8, 4.5, 4, 0.32);
    this.wisps.puff(this.slamAt, 2, 0.8, 0.24);
    this.shake = Math.max(this.shake, 0.4);
  }

  /** The colossus falls apart into bones. */
  private collapse() {
    const p = this.collapsePos;
    this.v1.set(p.x, 1.4, p.z);
    this.shards.burst(this.v1, 24, 5.5, 5, 0.5);
    this.shards.ring(this.v2.set(p.x, 0, p.z), 14, 3.2, 0.4, 0.5, 0.4);
    this.dust.burst(this.v2.set(p.x, 0, p.z), 12, 3, 0.65);
    this.dust.ring(p, 3, 8, 0.7);
    this.wisps.puff(this.v1.set(p.x, 0.8, p.z), 10, 1.6, 0.34);
    this.pop.set(this.v1.set(p.x, 1.4, p.z), 0, 0);
    this.shake = Math.max(this.shake, 0.55);
    this.slamAt.copy(p);
    this.slamT = this.time;
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - HIT_T;

    // --- Screen: the world dims while the ground trembles, lifts at the split. Impact frames at the split and the fall. ---
    const dim = 0.4 * smoothstep(t / 0.6) * (1 - smoothstep((t - SINK_T) / 1.2));
    this.screen.darken = after >= 0 ? dim * (1 - 0.35 * Math.exp(-after * 8)) : dim;
    let imp: 0 | 1 | 2 | 3 | 4 = impactFrameAt(t, HIT_T, [1, 2], 0.04);
    if (imp === 0 && this.collapseAt === -2) imp = impactFrameAt(t, this.slamT, [1], 0.03);
    this.screen.impact = imp;

    // --- The ground trembles before the split. ---
    if (t < HIT_T) this.shake = Math.max(this.shake, 0.05 + 0.14 * smoothstep(t / HIT_T));

    // --- The split: ember star, ground shockwave, shake. ---
    if (this.flags.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.1), 2.2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 8 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(0.8 * Math.exp(-after * 8), this.shake * Math.exp(-dt * 9));
    }
    // --- Slams and the fall: a smaller ring each time. ---
    if (this.slamT >= 0) {
      const sp = THREE.MathUtils.clamp((t - this.slamT) / 0.4, 0, 1);
      this.slamShock.set(this.slamAt, 0.8 + 4 * sp, 0.05 * (1 - sp) * (1 - sp));
      if (sp >= 1) this.slamT = -1;
    }
    if (!this.flags.hit) this.shake *= Math.exp(-dt * 4);
    else this.shake = Math.max(this.shake * Math.exp(-dt * 6), 0);
  }
}

export const boneColossusModule: EffectModule = {
  label: 'bone colossus',
  category: 'hero: bone',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new BoneColossus(),
  telegraphs(effect) {
    const e = effect as BoneColossus;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BoneColossus;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as BoneColossus).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 100, 1);
  },
};
