import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { INK, INK_CSS, InkBleed, Seal, Splatter, Stroke } from '../../effects/parts/ink';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Ink Snare (ink kit, W: a ground root). 0-0.35: ink bleeds across the zone, rice paper first, then a dark pool soaking
 * into it. 0.35-0.65: four quick strokes scribble themselves across the pool. At 0.7 the ink rises in short grasping
 * strokes around each foot, a seal stamps the centre with a vermilion star, and everyone still inside is hit and rooted.
 * 1.0-2.0: the strokes dry and flake, the pool fades. Clean by 2.2 s. See pipeline/designs/kit-ink.md.
 */
export interface InkSnareSettings {
  damage: number;
  rootSeconds: number;
  loop: boolean;
}

export const defaultInkSnare = (): InkSnareSettings => ({ damage: 35, rootSeconds: 1.0, loop: false });

// Timeline (seconds).
const SPREAD_T = 0.35;
const SCRIBBLE_T = 0.35;
const SCRIBBLE_GAP = 0.06;
const SCRIBBLE_DUR = 0.13;
const HIT_T = 0.7;
const GRASP_RISE = 0.12;
const DRY_T = 1.0;
const DURATION = 2.2;

const RADIUS = 3.5;
const RANGE = 10;
const GRASPS = 9;
const GRASP_H = 3; // wall height = half width x 2 x this
const GROUND = 0.1;

/** The scribble: four strokes crossing the pool, as (x, z) offsets from its centre. */
const SCRIBBLES: { w: number; pts: [number, number][] }[] = [
  { w: 0.62, pts: [[-2.7, -0.7], [-0.8, 0.5], [0.9, -0.4], [2.7, 0.6]] },
  { w: 0.55, pts: [[-0.7, 2.7], [0.2, 1.0], [-0.3, -1.0], [0.6, -2.7]] },
  { w: 0.66, pts: [[-2.1, 2.1], [-0.6, 0.7], [0.7, -0.6], [2.1, -2.2]] },
  { w: 0.5, pts: [[2.2, 1.9], [0.7, 0.6], [-0.7, -0.7], [-2.2, -2.0]] },
];

export class InkSnare implements Effect {
  readonly group = new THREE.Group();
  readonly settings: InkSnareSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private point = new THREE.Vector3(0, 0, -8);
  private flags = { spread: false, hit: false, dry: false };
  private started = [false, false, false, false];
  private ended = [false, false, false, false];
  private graspN = 0;
  private starAge = 9;
  private graspT = -1;

  private bleed = new InkBleed();
  private scribbles = SCRIBBLES.map(() => new Stroke({ flat: true, order: 4 }));
  private grasps = Array.from({ length: GRASPS }, () => new Stroke({ flat: true, order: 4, samples: 14 }));
  private splat = new Splatter(24);
  private seal = new Seal(1);
  private star = new StarBurst({ points: 10, inner: 0.3, color: INK.accent, core: 0xffffff, additive: false });
  private starPos = new THREE.Vector3();

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private path: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(settings: InkSnareSettings = defaultInkSnare()) {
    this.settings = settings;
    this.group.add(
      this.bleed.mesh, ...this.scribbles.map((s) => s.mesh), ...this.grasps.map((s) => s.mesh), this.seal.mesh, this.splat.mesh, this.star.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the grab are spared). */
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
    this.flags.spread = this.flags.hit = this.flags.dry = false;
    this.started.fill(false);
    this.ended.fill(false);
    this.graspN = 0;
    this.graspT = -1;
    this.starAge = 9;
    this.bleed.reset();
    for (const s of this.scribbles) s.reset();
    for (const s of this.grasps) s.reset();
    this.splat.reset();
    this.seal.reset();
    this.star.set(this.starPos, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bleed.update(dt);
    for (const s of this.scribbles) s.update(dt);
    for (const s of this.grasps) s.update(dt);
    this.splat.update(dt);
    this.seal.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.playing = false;
      this.reset();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, P = this.point;

    // --- 0..0.35: paper first, then ink bleeding into it. ---
    if (!f.spread) {
      f.spread = true;
      this.bleed.spread(P, RADIUS, SPREAD_T);
    }

    // --- 0.35..0.65: four quick strokes scribble across the pool, a drop flung off each end. ---
    SCRIBBLES.forEach((sc, i) => {
      if (!this.started[i] && t >= SCRIBBLE_T + i * SCRIBBLE_GAP) {
        this.started[i] = true;
        sc.pts.forEach(([x, z], k) => this.path[k].set(P.x + x, GROUND, P.z + z));
        this.scribbles[i].paint(this.path, sc.w, SCRIBBLE_DUR);
      }
      if (this.started[i] && !this.ended[i] && t >= SCRIBBLE_T + i * SCRIBBLE_GAP + SCRIBBLE_DUR) {
        this.ended[i] = true;
        const end = this.scribbles[i].at(1, this.v1), before = this.scribbles[i].at(0.9, this.v2);
        this.v2.subVectors(end, before).setY(0.35);
        this.splat.fling(this.v1.setY(0.2), this.v2, 2, 3.5, { size: 0.09, spread: 0.5, life: 0.6 });
      }
    });

    // --- 0.7: the ink rises in grasping strokes round each foot; the seal stamps; everyone inside is hit and rooted. ---
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.impact();
    }
    if (this.graspT >= 0) {
      this.graspT += dt;
      const k = easeOut(this.graspT / GRASP_RISE);
      for (let i = 0; i < this.graspN; i++) this.grasps[i].setStand(k, GRASP_H);
    }
    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0, 0.03);
    this.star.set(this.starPos, 1.0 * sp.scale, sp.opacity, this.starAge * 3);
    this.shake *= Math.exp(-dt * 10);

    // --- 1.0..2.0: the strokes dry and flake, the pool fades. ---
    if (!f.dry && t >= DRY_T) {
      f.dry = true;
      this.scribbles.forEach((s, i) => s.dissolve(0.8 + i * 0.07));
      for (let i = 0; i < this.graspN; i++) this.grasps[i].dissolve(0.6);
      this.bleed.fade(1.0);
      this.seal.fade(0.8);
    }
  }

  private impact() {
    const ctx = this.ctx, P = this.point, s = this.settings;
    this.shake = 0.15;
    this.starPos.set(P.x, 0.9, P.z);
    this.starAge = 0;
    this.seal.stamp(P, 1.5);
    const feet: THREE.Vector3[] = [];
    if (ctx) {
      for (const e of ctx.targets) {
        if (!this.inside(e)) continue;
        feet.push(e.group.position.clone());
        ctx.hit(e, { damage: s.damage, knock: 0, from: P, color: INK_CSS.hot, status: { kind: 'root', seconds: s.rootSeconds } });
      }
    }
    // Nobody inside: the ink still grabs at the air round the seal.
    if (feet.length === 0) feet.push(this.v1.set(P.x + 1.1, 0, P.z - 0.6).clone());
    let n = 0;
    for (const foot of feet) {
      for (let g = 0; g < 3 && n < GRASPS; g++, n++) {
        const a0 = (g / 3) * Math.PI * 2 + n * 0.9, r = 0.55 + 0.12 * ((n * 7) % 3);
        for (let k = 0; k < 4; k++) {
          const a = a0 + (k / 3) * 1.25;
          this.path[k].set(foot.x + Math.cos(a) * r, GROUND, foot.z + Math.sin(a) * r);
        }
        this.grasps[n].paint(this.path, 0.5, 0.01);
        this.grasps[n].setStand(0, GRASP_H);
        this.v2.set(Math.cos(a0 + 0.6), 0.6, Math.sin(a0 + 0.6));
        this.splat.fling(this.v1.set(foot.x, 0.2, foot.z), this.v2, 1, 3, { size: 0.08, spread: 0.4, life: 0.5 });
      }
    }
    this.graspN = n;
    this.graspT = 0;
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const inkSnareModule: EffectModule = {
  label: 'ink snare',
  category: 'hero: ink',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new InkSnare(),
  telegraphs(effect) {
    const e = effect as InkSnare;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as InkSnare;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as InkSnare).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 150, 1);
    f.add(s, 'rootSeconds', 0, 1.5, 0.1);
  },
};

export const INK_SNARE_RANGE = RANGE;
