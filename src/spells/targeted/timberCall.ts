import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  Birds, Chips, FALL_WIDTH, FallShadows, FloatingWord, Swipe, TIMBER, TIMBER_CSS, TREE_HEIGHT, TreeFalls,
} from '../../effects/parts/timber';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import {
  ROW_FULL, ROW_LIFE, ToolTrees, bookOf, plantTree, removeTree, rowOpen, startRow, timberNow, type Row, type Tree,
} from '../../traits/timber';

/**
 * TIMBER! (timber kit v5, R: terrain, then a recast; label 'timber call', shown name "TIMBER!"). Cast: he roars and five trees burst up
 * in a row along the aim, 2 m apart from 2 m to 10 m in front of him, a wave of one tree every 0.1 s: each is a sapling for 0.2 s,
 * young (real cover, radius 0.5) 0.25 s after it starts and full (radius 0.7) at 0.5 s, the last at 1.1 s. A rumble, soil, leaves, a
 * flock of birds out of every tree as it fills. They are HIS trees for this cast only (the trait's `plantTree` with a row number): they
 * do not count toward the cap of 3, and they have no HP unit (MAX_UNITS is 6 a side and the three normal trees may stand); they are
 * cover until they fall. The row is a record per figure (`startRow`), told from an instance by the record, not by the effect, because
 * the CPU reuses one effect per label.
 * Recast (free, from 1.0 s to 4 s after the cast, a second cast of this label told by that record, the trait's `recast` with `replay`):
 * he swings at the first tree (a fan over his 3 m cone, one short impact frame) and they fall like dominoes along the row, one every
 * 0.15 s from 0.25 s, each away from him along the row, 0.6 s to fall: a dark shadow strip with a pale border shows for each fall, 5 m
 * long and 1.6 m wide (its foliage is no wider). When a tree lands, an enemy inside its strip on its LIVE position takes 90 and is
 * thrown along it; one enemy takes 3 hits at most. Strips are 5 m long so that a point on the row lies in at most three at once. The
 * word TIMBER! floats huge over the row; the birds go up again. Without the recast the trees stand until 7.3 s and then fall over
 * harmlessly (a slow fall, no hit), 8 s in all; the trait removes any that are left at 8.5 s.
 * The telegraph is empty on the cast (nothing hits) and, on the recast, each strip with its impact at the swing and `until` at its
 * landing: the duel's zone check holds for the whole run and he is not rooted through the dominoes. The CPU fires the recast only with
 * the enemy within 2.5 m of the row (`aiHold`). Clean by about 3 s after the recast. See pipeline/designs/kit-timber.md.
 */
export interface TimberCallSettings {
  damage: number;
  /** 'auto' reads the row's record; 'plant' / 'swing' force a variant (the tool's play button). */
  mode: 'auto' | 'plant' | 'swing';
  loop: boolean;
}

export const defaultTimberCall = (): TimberCallSettings => ({ damage: 90, mode: 'auto', loop: false });

// Row (m, s).
const COUNT = 5;
const FIRST = 2;
const SPACING = 2;
const BORN_AT = 0.2;
const BORN_STEP = 0.1;
const FELL_AT = 7.3;
const HARMLESS_FALL = 0.9;
const PLANT_END = FELL_AT + HARMLESS_FALL + 1.1;
// The swing: the swing, the gap between falls, the fall, the strip and how many hits one enemy can take.
const SWING_T = 0.25;
const STEP = 0.15;
const FALL_S = 0.6;
const STRIP_L = 5;
const MAX_HITS = 3;
const SWING_END = SWING_T + (COUNT - 1) * STEP + FALL_S + 2.2;

interface Domino {
  tree: Tree;
  strip: TelegraphShape;
  fell: boolean;
  landed: boolean;
}

export class TimberCallFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TimberCallSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** True when the last cast is the swing (the recast). */
  swing = false;
  /** The trees of the swing, each with its strip (found at the cast from the row's record). */
  dominoes: Domino[] = [];
  private row: Row | null = null;
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private spots: THREE.Vector3[] = [];
  private time = 0;
  private swung = false;
  private felled = false;
  private born: boolean[] = [];
  private full: boolean[] = [];
  private hits = new Map<object, number>();

  private trees = new ToolTrees();
  private swipe = new Swipe();
  private falls = new TreeFalls(COUNT);
  private shadows = new FallShadows(COUNT);
  private chips = new Chips(160);
  private birds = new Birds(44);
  private word = new FloatingWord(2);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: TIMBER.hot, core: TIMBER.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private shockB = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: TimberCallSettings = defaultTimberCall()) {
    this.settings = settings;
    this.screen.impactColor.set(TIMBER.pale);
    this.screen.tint.set(TIMBER.dark);
    this.group.add(
      this.trees.group, this.shadows.mesh, this.swipe.mesh, this.falls.mesh, this.chips.mesh, this.birds.mesh, this.word.mesh, this.pop.mesh,
      this.shock.mesh, this.shockB.mesh,
    );
    this.reset();
  }

  get duration() {
    return this.swing ? SWING_END : PLANT_END;
  }

  get impactTime() {
    return this.swing ? SWING_T : 0.4;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the row: sentFrom and the aim (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const row = rowOpen(ctx.caster, timberNow(ctx.caster));
    const m = this.settings.mode;
    this.swing = m === 'swing' || (m === 'auto' && !!row);
    this.dominoes = [];
    this.row = null;
    if (this.swing) {
      // The recast: told from the first cast by the row's record. The trees fall along the row, away from him.
      this.row = row ?? bookOf(ctx.caster).row;
      const r = this.row;
      if (r) {
        this.fwd.set(r.dx, 0, r.dz);
        this.dominoes = r.trees.filter((t) => t.alive).map((tree) => ({
          tree, fell: false, landed: false,
          strip: { kind: 'line', x1: tree.x, z1: tree.z, x2: tree.x + r.dx * STRIP_L, z2: tree.z + r.dz * STRIP_L, width: FALL_WIDTH },
        }));
      }
    } else {
      this.spots = Array.from({ length: COUNT }, (_, i) => new THREE.Vector3(s.x + this.fwd.x * (FIRST + SPACING * i), 0, s.z + this.fwd.z * (FIRST + SPACING * i)));
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).addScaledVector(this.fwd, 2).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (this.swing) {
      if (this.row && ctx) this.row.swung = timberNow(ctx.caster);
      this.shake = 0.1;
      return;
    }
    if (ctx) {
      // The row: five trees, the later ones starting 0.1 s after each other, standing for 8 s unless they are felled.
      const row = startRow(ctx.caster, this.fwd.x, this.fwd.z);
      const until = timberNow(ctx.caster) + ROW_LIFE;
      this.spots.forEach((p, i) => {
        row.trees.push(plantTree(ctx.caster, p.x, p.z, ctx, { row: row.no, delay: BORN_AT + BORN_STEP * i, until }).tree);
      });
      this.row = row;
    }
    // He roars: a ring at his feet and a rumble that runs down the row.
    this.shock.set(this.from, 0.5, 0.05);
    this.word.show('TIMBER...', this.v1.copy(this.from).setY(3.1), 1.3, 1.4);
    this.shake = 0.2;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.swung = this.felled = false;
    this.born = this.spots.map(() => false);
    this.full = this.spots.map(() => false);
    this.hits.clear();
    for (const d of this.dominoes) d.fell = d.landed = false;
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
    this.shockB.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (this.ctx) this.trees.update(this.ctx.caster);
    this.swipe.update(dt);
    this.falls.update(dt);
    this.shadows.update(dt);
    this.chips.update(dt);
    this.birds.update(dt);
    this.word.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    const end = this.swing ? SWING_END : PLANT_END;
    if (t >= end && !this.falls.busy && !this.chips.busy && !this.birds.busy && !this.word.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    if (this.swing) this.updateSwing(dt, t);
    else this.updatePlant(dt, t);
  }

  /** The cast: each tree bursts up in its turn, birds go out of it as it fills, and an unfelled row falls over at the end. */
  private updatePlant(dt: number, t: number) {
    const ctx = this.ctx;
    // A rumble that builds while the wave runs down the row.
    this.shake = Math.max(this.shake * Math.exp(-dt * 6), t < 1.2 ? 0.1 + 0.1 * Math.sin(t * 40) ** 2 : 0);
    this.spots.forEach((p, i) => {
      const at = BORN_AT + BORN_STEP * i;
      if (!this.born[i] && t >= at) {
        this.born[i] = true;
        this.chips.burst(this.v1.set(p.x, 0.3, p.z), 12, 4.5, 'chunk', 0.9, 1, 1.1);
        this.chips.burst(this.v1.set(p.x, 0.6, p.z), 8, 3.5, 'saw', 0.9, 1, 1.0);
        this.shock.set(this.v2.copy(p), 0.5, 0.025);
      }
      if (!this.full[i] && t >= at + ROW_FULL) {
        this.full[i] = true;
        this.chips.burst(this.v1.set(p.x, 3.5, p.z), 10, 4, 'leaf', 0.8, 1, 1.5);
        // Birds everywhere: a flock out of every tree as it fills.
        this.birds.launch(this.v1.set(p.x, TREE_HEIGHT.full * 0.75, p.z), 8, 6.5);
        this.shake = Math.max(this.shake, 0.22);
      }
    });
    if (!this.felled && t >= FELL_AT) {
      this.felled = true;
      if (!ctx || !this.row) return;
      // Nobody swung: the ones still standing fall over slowly and harmlessly, away from him.
      for (const tree of this.row.trees) {
        if (!removeTree(ctx.caster, tree)) continue;
        this.falls.start(tree.x, tree.z, this.fwd.x, this.fwd.z, 'full', STRIP_L, HARMLESS_FALL, true);
        this.chips.burst(this.v1.set(tree.x, 3, tree.z), 6, 3, 'leaf', 0.8, 1, 1.2);
      }
    }
  }

  /** The recast: the swing, then each tree starts to fall in turn and lands 0.6 s later. */
  private updateSwing(dt: number, t: number) {
    const ctx = this.ctx;
    this.screen.impact = impactFrameAt(t, SWING_T, [1], 0.04);
    if (!this.swung && t >= SWING_T) {
      this.swung = true;
      this.v1.copy(this.from);
      this.swipe.fire(this.from.x, this.from.z, Math.atan2(this.fwd.x, this.fwd.z), 3, 110);
      this.chips.burst(this.v1.set(this.from.x + this.fwd.x * 1.8, 0.8, this.from.z + this.fwd.z * 1.8), 22, 5.5, 'saw', 0.7, 1.2, 1.2);
      // The word, huge, over the middle of the row; birds go up out of every tree.
      const mid = this.dominoes[Math.floor(this.dominoes.length / 2)]?.tree;
      const wx = mid ? mid.x : this.from.x + this.fwd.x * 6, wz = mid ? mid.z : this.from.z + this.fwd.z * 6;
      this.word.show('TIMBER!', this.v1.set(wx, 4.6, wz), 3.4, 2.8);
      for (const d of this.dominoes) this.birds.launch(this.v1.set(d.tree.x, 5, d.tree.z), 6, 7);
      this.shake = 0.5;
    }
    if (this.swung) {
      const a = t - SWING_T;
      const sp = StarBurst.pop(a, 0, 0.03);
      this.pop.set(this.v1.copy(this.from).addScaledVector(this.fwd, 2).setY(1.2), 1.6 * sp.scale, sp.opacity, 0.2);
      this.shake = Math.max(this.shake * Math.exp(-dt * 6), 0);
    }
    this.dominoes.forEach((d, i) => {
      const startAt = SWING_T + i * STEP;
      if (!d.fell && t >= startAt) {
        d.fell = true;
        const T = d.tree;
        // A tree broken since the cast does not fall: the row has a gap.
        if (ctx && !removeTree(ctx.caster, T)) { d.landed = true; return; }
        this.falls.start(T.x, T.z, this.fwd.x, this.fwd.z, 'full', STRIP_L, FALL_S);
        this.shadows.show(T.x, T.z, this.fwd.x, this.fwd.z, STRIP_L, FALL_WIDTH, FALL_S);
        this.chips.burst(this.v1.set(T.x, 1.2, T.z), 10, 4, 'saw', 0.9, 1, 1.1);
        this.chips.burst(this.v1.set(T.x, 2.5, T.z), 8, 3.5, 'leaf', 0.9, 1, 1.3);
      }
      if (d.fell && !d.landed && t >= startAt + FALL_S) {
        d.landed = true;
        this.land(d);
      }
    });
    if (t > SWING_T) this.shake = Math.max(this.shake, 0.18 * (this.dominoes.some((d) => d.fell && !d.landed) ? 1 : 0));
  }

  /** One tree lands: dust along its strip, and everyone inside it on their live position is hit (3 hits on one enemy at most). */
  private land(d: Domino) {
    const ctx = this.ctx, T = d.tree;
    for (let i = 1; i <= 3; i++) {
      const k = (i / 3) * STRIP_L;
      this.chips.burst(this.v1.set(T.x + this.fwd.x * k, 0.2, T.z + this.fwd.z * k), 7, 4.2, 'saw', 0.5, 1, 1.0);
    }
    this.v2.set(T.x + this.fwd.x * STRIP_L * 0.6, 0, T.z + this.fwd.z * STRIP_L * 0.6);
    this.shockB.set(this.v2, 1.6, 0.03);
    this.shake = Math.max(this.shake, 0.28);
    if (!ctx) return;
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(d.strip, p.x, p.z)) continue;
      const n = this.hits.get(e) ?? 0;
      if (n >= MAX_HITS) continue;
      this.hits.set(e, n + 1);
      ctx.hit(e, { damage: this.settings.damage, knock: 4, from: this.v1.set(T.x, 0, T.z), color: TIMBER_CSS.body });
    }
  }
}

export const timberCallModule: EffectModule = {
  label: 'timber call',
  category: 'hero: timber',
  // The aim only gives the row's direction; the recast is aimed anywhere.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new TimberCallFx(),
  telegraphs(effect) {
    const e = effect as TimberCallFx;
    if (!e.ctx || !e.swing) return [];
    // The recast: each strip with its impact at the swing and `until` at its landing, so the zone check holds for the whole run.
    return e.dominoes.map((d, i) => ({ shape: d.strip, start: 0.02, impact: SWING_T, until: SWING_T + i * STEP + FALL_S }));
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TimberCallFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as TimberCallFx).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'mode', ['auto', 'plant', 'swing']);
  },
};
