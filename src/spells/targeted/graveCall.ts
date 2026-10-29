import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BONE, BONE_CSS, BoneDust, BoneShards, BoneSpire, GroundCracks, SoulWisps, skeletonLook } from '../../effects/parts/bone';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Grave Call (bone kit, W: ground zone, summon). The ground cracks in a circle with teal light in the cracks and wisps
 * flickering out of them; at 0.6 s two skeletons claw out of the ground (`ctx.summon`) in a burst of dust, chips and
 * bone spires (two capped with skulls), hurting the enemies inside. The spires sink away again; the skeletons live on
 * as units. Clean by 2.0 s. See pipeline/designs/kit-bone.md.
 */
export interface GraveCallSettings {
  damage: number;
  loop: boolean;
}

export const defaultGraveCall = (): GraveCallSettings => ({ damage: 15, loop: false });

// Timeline (seconds).
const CRACK_T = 0.0; // the cracks spread (done by 0.3)
const HIT_T = 0.6; // the skeletons claw out
const SINK_T = 1.25; // the spires crumble
const FADE_T = 1.3; // the cracks fade
const DURATION = 2.0;

const RADIUS = 3;
const SPIRES = 8;

export class GraveCall implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GraveCallSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private point = new THREE.Vector3(0, 0, -8);
  private flags = { cracks: false, hit: false, sunk: false, faded: false };

  // Parts.
  private cracks = new GroundCracks();
  private spires = Array.from({ length: SPIRES }, (_, i) => new BoneSpire(i === 2 || i === 6, 5, i));
  private shards = new BoneShards(40);
  private wisps = new SoulWisps();
  private dust = new BoneDust();
  private pop = new StarBurst({ points: 8, inner: 0.3, color: BONE.accent, core: 0xfff0e0, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: GraveCallSettings = defaultGraveCall()) {
    this.settings = settings;
    this.group.add(this.cracks.mesh, ...this.spires.map((s) => s.mesh), this.dust.mesh, this.shards.mesh, this.wisps.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the impact are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.cracks = this.flags.hit = this.flags.sunk = this.flags.faded = false;
    this.cracks.reset();
    for (const s of this.spires) s.reset();
    this.shards.reset();
    this.wisps.reset();
    this.dust.reset();
    this.pop.set(this.point, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.cracks.update(dt);
    for (const s of this.spires) s.update(dt);
    this.shards.update(dt);
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

    if (!f.cracks && t >= CRACK_T + 0.01) {
      f.cracks = true;
      this.cracks.spread(this.point, RADIUS, 0.3);
      // Soulfire flickers out of the cracks.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.5;
        const r = RADIUS * (0.3 + 0.12 * (i % 3));
        this.wisps.attach(this.v1.set(this.point.x + Math.cos(a) * r, 0.12, this.point.z + Math.sin(a) * r), 2, 0.3, 0.2);
      }
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      // Bone spires burst up round the rim of the hole; the skeletons come out in the middle.
      this.spires.forEach((s, i) => {
        const a = (i / SPIRES) * Math.PI * 2 + 0.3 + (i % 3) * 0.12;
        const r = 1.55 + (i % 4) * 0.35;
        this.v1.set(this.point.x + Math.cos(a) * r, 0, this.point.z + Math.sin(a) * r);
        s.grow(this.v1, 1.3 + ((i * 37) % 10) / 10, 0.28, 0.5, a, (i % 3) * 0.03);
      });
      this.dust.burst(this.point, 12, 2.8, 0.5);
      this.dust.ring(this.point, RADIUS, 6, 0.5);
      this.shards.burst(this.v1.set(this.point.x, 0.3, this.point.z), 12, 5, 4.5, 0.36);
      this.wisps.puff(this.point, 6, 1.2, 0.26);
      this.shake = 0.3;
      if (ctx) {
        for (const e of ctx.targets) if (this.inside(e)) ctx.hit(e, { damage: this.settings.damage, knock: 1, from: this.point, color: BONE_CSS.body });
        ctx.summon?.({
          kind: 'melee', at: this.point.clone(), count: 2, hp: 40, seconds: 6, damage: 6, attackEvery: 1, color: BONE_CSS.body, look: skeletonLook,
        });
      }
    }
    if (f.hit && !f.sunk && t >= SINK_T) {
      f.sunk = true;
      this.spires.forEach((s, i) => s.crumble(0.45, (i % 4) * 0.04));
      this.wisps.release();
      this.dust.burst(this.v1.set(this.point.x, 0, this.point.z), 4, 1.4, 0.4);
    }
    if (!f.faded && t >= FADE_T) {
      f.faded = true;
      this.cracks.fade(0.6);
    }

    if (f.hit) {
      const after = t - HIT_T;
      const sp = StarBurst.pop(after, 0.03, 0.05);
      this.pop.set(this.v1.set(this.point.x, 0.9, this.point.z), 1.1 * sp.scale, sp.opacity, 0.2);
      this.shake = Math.max(this.shake * Math.exp(-dt * 12), 0);
    }
  }
}

export const graveCallModule: EffectModule = {
  label: 'grave call',
  category: 'hero: bone',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new GraveCall(),
  telegraphs(effect) {
    const e = effect as GraveCall;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GraveCall;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as GraveCall).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 100, 1);
  },
};
