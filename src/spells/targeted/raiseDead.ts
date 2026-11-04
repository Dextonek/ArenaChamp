import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BONE, BONE_CSS, BoneDust, BonePiles, BoneShards, BoneSpire, GroundCracks, SoulWisps, skeletonLook } from '../../effects/parts/bone';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { PILE_KEEP } from '../../traits/bone';

/**
 * Raise Dead (bone kit v4, W: summon, the summoner's core kept). The ground at the spot cracks open with teal light in
 * the cracks. Every bone pile within 4 m of the spot (`ctx.deathSpots(8)`, the trait's Ossuary) stirs and flings its bones
 * at the spot (at most three piles count), and at 0.7 s one skeleton claws out plus one more per pile (`ctx.summon`, at
 * most four, and never past the side's cap of six units), in a burst of dust, chips and bone spires; enemies standing in
 * the hole take a small hit. The spires sink away again; the skeletons live on as units. Clean by 2.0 s.
 * See pipeline/designs/kit-bone.md.
 */
export interface RaiseDeadSettings {
  /** Damage to anyone standing in the hole when it opens. */
  damage: number;
  hp: number;
  seconds: number;
  /** Damage of a skeleton's attack. */
  attack: number;
  loop: boolean;
}

export const defaultRaiseDead = (): RaiseDeadSettings => ({ damage: 15, hp: 40, seconds: 8, attack: 10, loop: false });

// Timeline (seconds).
const CRACK_T = 0.0; // the cracks spread (done by 0.3)
const HIT_T = 0.7; // the skeletons claw out
const SINK_T = 1.35; // the spires crumble
const FADE_T = 1.4; // the cracks fade
const DURATION = 2.0;

const RADIUS = 2.4; // the hole: the telegraph and the hit
const PILE_R = 4; // piles this close to the spot add a skeleton
const MAX_EXTRA = 3;
const SPIRES = 6;

export class RaiseDead implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RaiseDeadSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly point = new THREE.Vector3(0, 0, -8);
  private time = 0;
  private flags = { cracks: false, flung: false, hit: false, sunk: false, faded: false };
  private piles: { x: number; z: number }[] = [];

  private cracks = new GroundCracks();
  private spires = Array.from({ length: SPIRES }, (_, i) => new BoneSpire(i === 1 || i === 4, 5, i));
  private pileMesh = new BonePiles(MAX_EXTRA);
  private chips = new BoneShards(48);
  private wisps = new SoulWisps();
  private dust = new BoneDust();
  private pop = new StarBurst({ points: 8, inner: 0.3, color: BONE.accent, core: 0xfff0e0, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: RaiseDeadSettings = defaultRaiseDead()) {
    this.settings = settings;
    this.group.add(
      this.cracks.mesh, ...this.spires.map((s) => s.mesh), this.pileMesh.mesh, this.dust.mesh, this.chips.mesh, this.wisps.mesh, this.pop.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** How many skeletons this cast raises: one, plus one per pile near the spot (max three extra). */
  get raised() {
    return 1 + Math.min(MAX_EXTRA, this.piles.length);
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.piles = (ctx.deathSpots?.(PILE_KEEP) ?? [])
      .filter((d) => Math.hypot(d.x - this.point.x, d.z - this.point.z) <= PILE_R)
      .sort((a, b) => Math.hypot(a.x - this.point.x, a.z - this.point.z) - Math.hypot(b.x - this.point.x, b.z - this.point.z))
      .slice(0, MAX_EXTRA)
      .map((d) => ({ x: d.x, z: d.z }));
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.cracks.reset();
    for (const s of this.spires) s.reset();
    this.pileMesh.reset();
    this.chips.reset();
    this.wisps.reset();
    this.dust.reset();
    this.pop.set(this.point, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.cracks.update(dt);
    for (const s of this.spires) s.update(dt);
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

    if (!f.cracks && t >= CRACK_T + 0.01) {
      f.cracks = true;
      this.cracks.spread(this.point, RADIUS, 0.35);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.5;
        const r = RADIUS * (0.3 + 0.12 * (i % 3));
        this.wisps.attach(this.v1.set(this.point.x + Math.cos(a) * r, 0.12, this.point.z + Math.sin(a) * r), 2, 0.3, 0.2);
      }
    }
    // The piles that will each raise a skeleton shake and fling their bones at the spot.
    if (this.piles.length && t < HIT_T) this.pileMesh.set(this.piles, Math.min(1, t / 0.15));
    else this.pileMesh.reset();
    if (!f.flung && t >= 0.3) {
      f.flung = true;
      for (const p of this.piles) {
        this.v1.set(p.x, 0.3, p.z);
        for (let i = 0; i < 4; i++) {
          // Bones arc toward the spot: speed and lift picked so they land near it about when the skeletons come out.
          const dx = this.point.x - p.x, dz = this.point.z - p.z;
          const flight = 0.4;
          this.v2.set(dx / flight + (Math.random() - 0.5) * 1.2, 4.5 + Math.random() * 1.5, dz / flight + (Math.random() - 0.5) * 1.2);
          this.chips.shoot(this.v1, this.v2, 0.6, 0.3, 22);
        }
        this.wisps.puff(this.v1, 3, 0.5, 0.2);
      }
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      // Bone spires burst up round the rim of the hole; the skeletons come out in the middle.
      this.spires.forEach((s, i) => {
        const a = (i / SPIRES) * Math.PI * 2 + 0.3 + (i % 3) * 0.12;
        const r = 1.5 + (i % 3) * 0.3;
        this.v1.set(this.point.x + Math.cos(a) * r, 0, this.point.z + Math.sin(a) * r);
        s.grow(this.v1, 1.2 + ((i * 37) % 10) / 10, 0.28, 0.5, a, (i % 3) * 0.03);
      });
      this.dust.burst(this.point, 12, 2.8, 0.5);
      this.dust.ring(this.point, RADIUS, 6, 0.5);
      this.chips.burst(this.v1.set(this.point.x, 0.3, this.point.z), 12, 5, 4.5, 0.36);
      this.wisps.puff(this.point, 6, 1.2, 0.26);
      this.shake = 0.3;
      if (ctx) {
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) {
            ctx.hit(e, { damage: this.settings.damage, knock: 1, from: this.point, color: BONE_CSS.body });
          }
        }
        ctx.summon?.({
          kind: 'melee', at: this.point.clone(), count: this.raised, hp: this.settings.hp, seconds: this.settings.seconds,
          damage: this.settings.attack, attackEvery: 1, color: BONE_CSS.body, look: skeletonLook,
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
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const raiseDeadModule: EffectModule = {
  label: 'raise dead',
  category: 'hero: bone',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new RaiseDead(),
  telegraphs(effect) {
    const e = effect as RaiseDead;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.point.x, z: e.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RaiseDead;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as RaiseDead).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 60, 1);
    f.add(s, 'hp', 10, 200, 5);
    f.add(s, 'seconds', 2, 20, 1);
    f.add(s, 'attack', 1, 40, 1);
  },
};
