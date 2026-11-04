import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  Birds, Chips, FALL_LENGTH, FALL_WIDTH, FallShadows, FloatingWord, Swipe, TIMBER, TIMBER_CSS, TreeFalls, type TreeStage,
} from '../../effects/parts/timber';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { CHOP_DAMAGE, STAGES, removeTree, stageIndex, timberNow, treesInCone, type Tree } from '../../traits/timber';

/**
 * Axe Swing (timber kit v5, Q: a QUICK cone, `self` mode; label 'axe swing'). He swings his double axe over the 3 m cone in front of
 * him (110 degrees, the same shape that is drawn as a dark fan with a pale rim and a bright edge sweeping across it): 40 on an enemy
 * inside it at 0.15 s, on live positions. Any tree of his that the cone touches (its trunk's nearest point, on his own client's
 * list and on the other screen's through this same effect, from `sentFrom` and the aim) is chopped: it leaves the list, a stump
 * stays, and it falls straight away from him along the line through the tree, TIMBER! A full tree sends birds out. Its shadow shows
 * for 0.6 s as a dark strip with a pale border, 8 m long and 1.6 m wide (the strip's own foliage is no wider), then at 0.75 s the
 * enemies inside that strip, on their live positions, take 30, 60 or 110 by the tree's stage (`CHOP_DAMAGE`) and are thrown along it.
 * At most 3 trees fall from one swing.
 * The root: the telegraph carries the cone (impact 0.15) and each strip with its impact at the SWING, `until` at the landing, so the
 * duel's zone check holds for the fall (a hit lands only inside a recorded shape, and the check has no clock) and he is rooted only for
 * the swing, not through the 0.6 s fall. The CPU's zone dodge leaves line zones alone, so the fall is dodged by the player only.
 * Rhythm tool, 3 s. Clean by about 2 s. See pipeline/designs/kit-timber.md.
 */
export interface AxeSwingSettings {
  damage: number;
  loop: boolean;
}

export const defaultAxeSwing = (): AxeSwingSettings => ({ damage: 46, loop: false });

// Timeline (seconds) and reach (m).
const HIT_T = 0.15;
const FALL_S = 0.6;
const LAND_T = HIT_T + FALL_S;
const CONE_R = 3;
const CONE_A = 110;
const MAX_FALLS = 3;
const DURATION = LAND_T + 1.3;

interface Chop {
  tree: Tree;
  stage: TreeStage;
  dx: number;
  dz: number;
  strip: TelegraphShape;
  fell: boolean;
  landed: boolean;
}

export class AxeSwing implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AxeSwingSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: CONE_R, angle: CONE_A, dir: 0 };
  /** The trees this swing chops, found at the cast, with the strip each one falls along. */
  chops: Chop[] = [];
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private swung = false;
  private landed = false;
  private wordDone = false;

  private swipe = new Swipe();
  private falls = new TreeFalls(3);
  private shadows = new FallShadows(3);
  private chips = new Chips(110);
  private birds = new Birds(24);
  private word = new FloatingWord(2);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: TIMBER.hot, core: TIMBER.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: AxeSwingSettings = defaultAxeSwing()) {
    this.settings = settings;
    this.screen.impactColor.set(TIMBER.pale);
    this.screen.tint.set(TIMBER.dark);
    this.group.add(this.shadows.mesh, this.swipe.mesh, this.falls.mesh, this.chips.mesh, this.birds.mesh, this.word.mesh, this.pop.mesh, this.shock.mesh);
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
    // Both screens must agree on the cone and on which trees it touches: `sentFrom` for the apex. A QUICK spell's direction is the
    // caster's facing at the cast (`ctx.aim` is 0 for the CPU, whose context is built without an aim point).
    const s = ctx.sentFrom ?? ctx.from;
    const yaw = ctx.caster.group.rotation.y;
    this.from.set(s.x, 0, s.z);
    this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.cone = { kind: 'cone', x: s.x, z: s.z, radius: CONE_R, angle: CONE_A, dir: yaw };
    this.chops = treesInCone(ctx.caster, this.cone as Extract<TelegraphShape, { kind: 'cone' }>).slice(0, MAX_FALLS).map((tree) => {
      // It falls straight away from him, along the line from him through the tree.
      let dx = tree.x - s.x, dz = tree.z - s.z;
      const l = Math.hypot(dx, dz);
      if (l < 0.05) { dx = this.fwd.x; dz = this.fwd.z; } else { dx /= l; dz /= l; }
      return {
        tree, stage: STAGES[stageIndex(tree, timberNow(ctx.caster))], dx, dz, fell: false, landed: false,
        strip: { kind: 'line', x1: tree.x, z1: tree.z, x2: tree.x + dx * FALL_LENGTH, z2: tree.z + dz * FALL_LENGTH, width: FALL_WIDTH },
      };
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).addScaledVector(this.fwd, 2).setY(1.1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.swung = this.landed = this.wordDone = false;
    for (const c of this.chops) c.fell = c.landed = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(TIMBER.dark);
    this.swipe.reset();
    this.falls.reset();
    this.shadows.reset();
    this.chips.reset();
    this.birds.reset();
    this.word.reset();
    this.pop.set(this.from, 0, 0);
    this.shock.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.swipe.update(dt);
    this.falls.update(dt);
    this.shadows.update(dt);
    this.chips.update(dt);
    this.birds.update(dt);
    this.word.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (t >= DURATION && !this.falls.busy && !this.chips.busy && !this.birds.busy && !this.word.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    if (!this.swung && t >= HIT_T) {
      this.swung = true;
      this.swing();
    }
    if (this.swung && !this.landed && t >= LAND_T) {
      this.landed = true;
      this.land();
    }
    this.screen.impact = this.chops.some((c) => c.fell) ? impactFrameAt(t, HIT_T, [1], 0.03) : 0;
    if (this.swung) {
      const a = t - HIT_T;
      const sp = StarBurst.pop(a, 0, 0.02);
      this.v1.copy(this.from).addScaledVector(this.fwd, 2.2).setY(1.1);
      this.pop.set(this.v1, 1.0 * sp.scale, sp.opacity, 0.2);
      this.shake = Math.max(this.shake * Math.exp(-dt * 10), 0.14 * Math.exp(-a * 14));
    }
    if (this.landed) this.shake = Math.max(this.shake, 0.3 * Math.exp(-(t - LAND_T) * 8));
  }

  /** The swing: the fan, the enemies in the cone, and every chopped tree starts to fall. */
  private swing() {
    const ctx = this.ctx;
    this.swipe.fire(this.from.x, this.from.z, Math.atan2(this.fwd.x, this.fwd.z), CONE_R, CONE_A);
    this.v1.copy(this.from).addScaledVector(this.fwd, 1.6).setY(0.9);
    this.chips.burst(this.v1, 8, 4, 'saw', 0.6, 1, 0.9);
    if (!ctx) return;
    // Everyone still inside the cone on their live position is hit.
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 2, from: ctx.from, color: TIMBER_CSS.body });
    }
    for (const c of this.chops) {
      // A tree broken or torn up since the cast is already gone: nothing falls.
      if (!removeTree(ctx.caster, c.tree)) continue;
      c.fell = true;
      const T = c.tree;
      this.falls.start(T.x, T.z, c.dx, c.dz, c.stage, FALL_LENGTH, FALL_S);
      this.shadows.show(T.x, T.z, c.dx, c.dz, FALL_LENGTH, FALL_WIDTH, FALL_S);
      this.chips.burst(this.v1.set(T.x, 0.8, T.z), 16, 4.5, 'saw', 0.9, 1, 1.2);
      this.chips.burst(this.v1.set(T.x, 1.4, T.z), 9, 3.5, 'leaf', 0.9, 1, 1.4);
      this.chips.burst(this.v1.set(T.x, 0.5, T.z), 5, 4, 'chunk', 0.9, 1, 1.1);
      // A full tree sends its birds out.
      if (c.stage === 'full') this.birds.launch(this.v1.set(T.x, 5.4, T.z), 8, 6);
      if (!this.wordDone) {
        this.wordDone = true;
        this.word.show('TIMBER!', this.v1.set(T.x, 3.4, T.z), c.stage === 'full' ? 1.7 : 1.3, 1.5);
      }
    }
  }

  /** The trees land: everyone inside a strip on their live position is hit and thrown along it. */
  private land() {
    const ctx = this.ctx;
    for (const c of this.chops) {
      if (!c.fell) continue;
      const T = c.tree, big = STAGES.indexOf(c.stage);
      for (let i = 1; i <= 3; i++) {
        const k = (i / 3) * FALL_LENGTH;
        this.chips.burst(this.v1.set(T.x + c.dx * k, 0.2, T.z + c.dz * k), 8 + big * 3, 4.2, 'saw', 0.5, 1, 1.0);
      }
      this.chips.burst(this.v1.set(T.x + c.dx * FALL_LENGTH * 0.8, 0.5, T.z + c.dz * FALL_LENGTH * 0.8), 8, 4, 'leaf', 0.8, 1, 1.2);
      this.v2.set(T.x + c.dx * FALL_LENGTH * 0.55, 0, T.z + c.dz * FALL_LENGTH * 0.55);
      this.shock.set(this.v2, 0.5 + 1.8, 0.03);
      if (!ctx) continue;
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const p = e.group.position;
        if (!insideTelegraph(c.strip, p.x, p.z)) continue;
        ctx.hit(e, { damage: CHOP_DAMAGE[big], knock: 5, from: this.v1.set(T.x, 0, T.z), color: TIMBER_CSS.body });
      }
      c.landed = true;
    }
  }
}

export const axeSwingModule: EffectModule = {
  label: 'axe swing',
  category: 'hero: timber',
  // Quick, no aim: the cone is centred on him and the radius is the reach the CPU uses it at.
  targeting: { mode: 'self', radius: CONE_R },
  create: () => new AxeSwing(),
  telegraphs(effect) {
    const e = effect as AxeSwing;
    if (!e.ctx) return [];
    // The cone, and the strip of each tree it chops: their impact is the swing, so he is not rooted through the fall.
    return [
      { shape: e.cone, start: 0, impact: HIT_T },
      ...e.chops.map((c) => ({ shape: c.strip, start: 0.02, impact: HIT_T, until: LAND_T })),
    ];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as AxeSwing;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as AxeSwing).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
