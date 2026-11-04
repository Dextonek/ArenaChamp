import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Chips, FloatingWord, RootBurst, TIMBER, TIMBER_CSS, TreeFalls } from '../../effects/parts/timber';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { ToolTrees, plantTree, stageOf, timberNow } from '../../traits/timber';

/**
 * Fast Growth (timber kit v5, W: terrain with a late hit; label 'fast growth'). He slams his axe into the ground and a tree
 * sprouts at a spot up to 6 m away (at least 1.5 m from him), from `sentFrom` and `point` only, so both screens plant the same one.
 * The tree is HIS record (`plantTree` in src/traits/timber.ts: a sapling of 30 HP that blocks nothing, young at 1.2 s with 120 HP
 * and a pillar of radius 0.5, full at 2.5 s with radius 0.7), drawn by the trait's `marks`, so a later cast cannot cut it off; this
 * effect plants it at the cast, on both screens, and draws the moment: soil, leaves, a pale ring at the circle that will be hit.
 * A fourth normal tree makes the oldest fall over harmlessly (drawn here). At 0.7 s an enemy inside 1.5 m of the spot on its LIVE
 * position (`ctx.enemies`, not the list frozen at the cast) takes 40 and a 0.5 s knock-up, and roots burst round the spot.
 * Two charges, 7 s each (the trait's `charges`). The telegraph is that 1.5 m circle with its impact at 0.7 s, so he is rooted until
 * then, as the table says. The CPU holds it within 2 m of the enemy unless Q is ready (`aiHold`). Clean by 1.8 s.
 * See pipeline/designs/kit-timber.md.
 */
export interface FastGrowthSettings {
  damage: number;
  knockup: number;
  loop: boolean;
}

export const defaultFastGrowth = (): FastGrowthSettings => ({ damage: 40, knockup: 0.5, loop: false });

// Timeline (seconds) and reach (m).
const HIT_T = 0.7;
const DURATION = 1.8;
const RANGE = 6;
const MIN_DIST = 1.5;
const HIT_R = 1.5;
const EVICT_FALL = 6;

export class FastGrowthFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FastGrowthSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the tree stands, from sentFrom and point only. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  /** The circle that is hit. */
  circle: TelegraphShape = { kind: 'circle', x: 0, z: 0, radius: HIT_R };
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private time = 0;
  private hit = false;

  private chips = new Chips(70);
  private roots = new RootBurst(14);
  private falls = new TreeFalls(2);
  private trees = new ToolTrees();
  private word = new FloatingWord(1);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: TIMBER.hot, core: TIMBER.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private ring: THREE.Mesh;
  private ringMat = new THREE.MeshBasicMaterial({ color: TIMBER.pale, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: TIMBER.dark, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  private v1 = new THREE.Vector3();

  constructor(settings: FastGrowthSettings = defaultFastGrowth()) {
    this.settings = settings;
    // A dark layer under the hit circle and a pale ring on its edge: the circle reads on a bright floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(HIT_R, 48).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(HIT_R - 0.11, HIT_R, 64).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.renderOrder = 2;
    this.ring.visible = false;
    this.group.add(
      this.trees.group, this.shade, this.ring, this.roots.mesh, this.falls.mesh, this.chips.mesh, this.word.mesh, this.pop.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the tree: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = MIN_DIST; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, RANGE);
    this.fwd.set(dx, 0, dz);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
    this.circle = { kind: 'circle', x: this.centre.x, z: this.centre.z, radius: HIT_R };
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx, C = this.centre;
    this.shade.visible = this.ring.visible = true;
    this.shade.position.set(C.x, 0.03, C.z);
    this.ring.position.set(C.x, 0.04, C.z);
    if (ctx) {
      // The tree is planted at the cast, on both screens: the trait draws it and builds its obstacle and HP as it grows.
      const { evicted } = plantTree(ctx.caster, C.x, C.z, ctx);
      if (evicted) {
        // The oldest of his three falls over, away from him, and does nothing.
        const dx = evicted.x - this.from.x, dz = evicted.z - this.from.z, l = Math.hypot(dx, dz) || 1;
        this.falls.start(evicted.x, evicted.z, dx / l, dz / l, stageOf(evicted, timberNow(ctx.caster)), EVICT_FALL, 0.9, true);
      }
    }
    this.chips.burst(this.v1.set(C.x, 0.2, C.z), 9, 3.2, 'chunk', 0.9, 1, 1.0);
    this.chips.burst(this.v1.set(C.x, 0.3, C.z), 12, 3, 'leaf', 1, 1, 1.2);
    this.word.show('GROW!', this.v1.set(C.x, 1.9, C.z), 0.9, 1.1);
    this.shake = 0.12;
  }

  private reset() {
    this.time = 0;
    this.hit = false;
    this.shake = 0;
    this.chips.reset();
    this.roots.reset();
    this.falls.reset();
    this.word.reset();
    this.pop.set(this.centre, 0, 0);
    this.shock.set(this.centre, 0, 0);
    this.shade.visible = this.ring.visible = false;
    this.shadeMat.opacity = this.ringMat.opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (this.ctx) this.trees.update(this.ctx.caster);
    this.chips.update(dt);
    this.roots.update(dt);
    this.falls.update(dt);
    this.word.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, C = this.centre;
    if (t >= DURATION && !this.chips.busy && !this.falls.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The warning: a dark disc and a pale ring on the circle that will be hit, brightening toward the burst. ---
    if (!this.hit) {
      const k = smoothstep(t / HIT_T);
      this.shadeMat.opacity = 0.22 + 0.3 * k;
      this.ringMat.opacity = 0.45 + 0.5 * k * (0.6 + 0.4 * Math.sin(t * 30));
      // A little dirt kicks up from the roots working under the spot.
      if (Math.random() < 0.35) this.chips.burst(this.v1.set(C.x + (Math.random() - 0.5) * 1.6, 0.1, C.z + (Math.random() - 0.5) * 1.6), 1, 1.6, 'chunk', 1, 0.7, 0.7);
      this.shake = Math.max(this.shake * 0.9, 0.05 * k);
    }

    if (!this.hit && t >= HIT_T) {
      this.hit = true;
      this.burst();
    }
    if (this.hit) {
      const a = t - HIT_T;
      const sp = StarBurst.pop(a, 0.05, 0.16);
      this.pop.set(this.v1.set(C.x, 1.3, C.z), 1.5 * sp.scale, sp.opacity, a * 3);
      const p = THREE.MathUtils.clamp(a / 0.35, 0, 1);
      this.shock.set(C, 0.4 + HIT_R * 1.4 * p, 0.04 * (1 - p) * (1 - p));
      this.shadeMat.opacity *= Math.exp(-dt * 5);
      this.ringMat.opacity *= Math.exp(-dt * 6);
      this.shake = Math.max(this.shake * 0.88, 0.3 * Math.exp(-a * 9));
    }
  }

  /** The roots burst: everyone inside the circle on their live position is hit and thrown up. */
  private burst() {
    const ctx = this.ctx, C = this.centre;
    this.roots.fire(C.x, C.z, HIT_R * 0.85);
    this.chips.burst(this.v1.set(C.x, 0.3, C.z), 16, 5, 'chunk', 1, 1, 1.2);
    this.chips.burst(this.v1.set(C.x, 0.5, C.z), 14, 4.5, 'leaf', 1, 1, 1.4);
    this.chips.burst(this.v1.set(C.x, 0.4, C.z), 12, 4, 'saw', 1, 1, 1.2);
    if (!ctx) return;
    // The live positions of every enemy, not the list frozen at the cast: someone who stepped into the circle is hit.
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.circle, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 0, from: C, color: TIMBER_CSS.body, status: { kind: 'knockup', seconds: this.settings.knockup } });
    }
  }
}

export const fastGrowthModule: EffectModule = {
  label: 'fast growth',
  category: 'hero: timber',
  // The aim point is where the tree grows; the radius is the circle that is hit.
  targeting: { mode: 'ground', radius: HIT_R },
  create: () => new FastGrowthFx(),
  telegraphs(effect) {
    const e = effect as FastGrowthFx;
    if (!e.ctx) return [];
    // The circle the roots hit: it roots him until the burst, as the table says.
    return [{ shape: e.circle, start: 0.04, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as FastGrowthFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as FastGrowthFx).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knockup', 0.1, 1.5, 0.05);
  },
};
