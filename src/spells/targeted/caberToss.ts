import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { boltWidth, type Projectile } from '../../effects/projectile';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Birds, Chips, FloatingWord, TIMBER, TIMBER_CSS, ThrownProp, type TreeStage } from '../../effects/parts/timber';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { firstSurface } from '../../obstacles';
import { STAGES, TOSS_DAMAGE, bookOf, reachTree, removeTree, stageIndex, timberNow, type Tree } from '../../traits/timber';

/**
 * Caber Toss (timber kit v5, E: a skillshot; label 'caber toss'). 0.3 s of wind-up, then a bolt of radius 0.9 flies 9 m at 16 m/s
 * (`ctx.projectile`; its telegraph line is `boltWidth(0.9)` wide, what it really hits). With a tree of his within 3 m of him (the
 * nearest one, any stage, a row's too) he rips it out of the ground (it leaves his list at the cast, on both screens, and a stump
 * stays; a full tree sends birds out), swings it over his head in the wind-up and hurls it end over end: it is drawn as a 2.6 m tree
 * tumbling about its middle, a spin that sweeps the 1.3 m circle the bolt's radius and a body really hit. It hits for 30, 60 or 90 by
 * the tree's stage (`TOSS_DAMAGE`) and throws the enemy 6 m/s back, and breaks into chunks, leaves and sawdust where it ends.
 * With no tree in reach he throws his AXE down the same line instead: a huge double axe tumbling, 30 and a knock of 3, a piercing
 * bolt so it keeps flying to where it lands. Where it lands is straight-line maths from `sentFrom` and the aim, stopped by the
 * first cover (`firstSurface`), the same on both screens; it is written to his record (`book.axe`, drawn by the trait's `marks` as
 * an axe in a pale 1.5 m ring) at the cast, and his own client's `afterCast` has already set `mem.noAxe`: Q reads "Fetch your axe"
 * until he is within 1.5 m of it (the trait's `canCast` and `tick`). When the bolt hits the enemy it ends there but the axe still
 * flies to the mark: the caster's screen cannot know. Network duels: the other screen draws the bolt, the caster's own screen draws
 * the toss along the nominal line. Cooldown 9 s. Clean by about 2 s. See pipeline/designs/kit-timber.md.
 */
export interface CaberTossSettings {
  /** Damage of the axe when there is no tree. */
  axeDamage: number;
  loop: boolean;
}

export const defaultCaberToss = (): CaberTossSettings => ({ axeDamage: 30, loop: false });

// Timeline (seconds), reach and size (m).
const WIND_T = 0.3;
const SPEED = 16;
const RANGE = 9;
const RADIUS = 0.9;
const MUZZLE = 0.6;
const TREE_REACH = 3;
const HAND_Y = 2.3;
const FLY_Y = 1.5;
const TUMBLE = 9; // rad/s
const MAX_T = 3;

export class CaberToss implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CaberTossSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: boltWidth(RADIUS) };
  /** What this cast throws: a tree of his (found at the cast) or the axe. */
  private tree: Tree | null = null;
  private stage: TreeStage = 'full';
  private damage = 0;
  /** How far along the line (m) the toss flies on its own: stopped by the first cover. */
  private reach = RANGE;
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private yaw = 0;
  private time = 0;
  private fired = false;
  private crashed = false;
  private crashAt = -1;
  private bolt: Projectile | null = null;
  private hitPos: THREE.Vector3 | null = null;
  private base = new THREE.Vector3();

  private prop = new ThrownProp();
  private chips = new Chips(110);
  private birds = new Birds(14);
  private word = new FloatingWord(1);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: TIMBER.hot, core: TIMBER.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: CaberTossSettings = defaultCaberToss()) {
    this.settings = settings;
    this.group.add(this.prop.mesh, this.chips.mesh, this.birds.mesh, this.word.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return WIND_T;
  }

  get flightEnd() {
    return WIND_T + RANGE / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line, the tree and the axe's mark: sentFrom and the aim.
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.yaw = Math.atan2(this.fwd.x, this.fwd.z);
    this.line = {
      kind: 'line', x1: s.x, z1: s.z, x2: s.x + this.fwd.x * RANGE, z2: s.z + this.fwd.z * RANGE, width: boltWidth(RADIUS),
    };
    this.tree = reachTree(ctx.caster, s.x, s.z, TREE_REACH);
    this.stage = this.tree ? STAGES[stageIndex(this.tree, timberNow(ctx.caster))] : 'full';
    this.damage = this.tree ? TOSS_DAMAGE[STAGES.indexOf(this.stage)] : this.settings.axeDamage;
    // Where the toss ends on its own: the first cover on the straight line (the same on both screens).
    const end = { x: s.x + this.fwd.x * RANGE, z: s.z + this.fwd.z * RANGE };
    const hit = firstSurface({ x: s.x, z: s.z }, end, ctx.obstacles?.() ?? []);
    this.reach = hit ? Math.max(0.5, RANGE * hit.t - 0.3) : RANGE;
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.tree) {
      // The rip: the tree leaves his list now, a stump stays, soil and leaves fly, and the tree rises to his hands.
      const T = this.tree;
      this.base.set(T.x, 0.4, T.z);
      removeTree(ctx.caster, T);
      this.chips.burst(this.v1.set(T.x, 0.3, T.z), 12, 4, 'chunk', 0.9, 1, 1.1);
      this.chips.burst(this.v1.set(T.x, 0.8, T.z), 12, 3.5, 'leaf', 0.9, 1, 1.3);
      if (this.stage === 'full') this.birds.launch(this.v1.set(T.x, 5.2, T.z), 7, 6);
      this.prop.setKind('tree', this.stage);
      this.shake = 0.18;
    } else {
      // The axe lands where the line ends; he gets Q back within 1.5 m of it. Written on both screens (the mark is drawn on both).
      const x = this.from.x + this.fwd.x * this.reach, z = this.from.z + this.fwd.z * this.reach;
      bookOf(ctx.caster).axe = { x, z, landAt: timberNow(ctx.caster) + WIND_T + this.reach / SPEED };
      this.prop.setKind('axe');
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = this.crashed = false;
    this.crashAt = -1;
    this.bolt = null;
    this.hitPos = null;
    this.prop.hide();
    this.chips.reset();
    this.birds.reset();
    this.word.reset();
    this.pop.set(this.from, 0, 0);
    this.shock.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.chips.update(dt);
    this.birds.update(dt);
    this.word.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;

    if (!this.fired && t >= WIND_T) {
      this.fired = true;
      this.release(ctx);
    }
    this.layout(t);

    if (this.crashAt >= 0) {
      const a = t - this.crashAt;
      const sp = StarBurst.pop(a, 0.02, 0.1);
      this.pop.set(this.v1.set(this.v2.x, 1.2, this.v2.z), (this.tree ? 1.5 : 1.0) * sp.scale, sp.opacity, a * 3);
      const p = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.shock.set(this.v2, 0.4 + (this.tree ? 2.2 : 1.4) * p, 0.035 * (1 - p) * (1 - p));
      this.shake = Math.max(this.shake * Math.exp(-dt * 9), (this.tree ? 0.3 : 0.18) * Math.exp(-a * 9));
    }
    if ((this.crashed && t >= this.crashAt + 1.0 && !this.chips.busy && !this.birds.busy && !this.word.busy) || t >= MAX_T) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  /** The release: the bolt (where the engine flies one) and the word. */
  private release(ctx: CastContext | null) {
    this.v1.copy(this.from).addScaledVector(this.fwd, 0.4).setY(HAND_Y);
    this.word.show(this.tree ? 'HUP!' : 'HYAH!', this.v1, 1.0, 0.9);
    if (!ctx?.projectile) return;
    const hit: HitOptions = { damage: this.damage, knock: this.tree ? 6 : 3, color: TIMBER_CSS.body };
    this.bolt = ctx.projectile({
      from: ctx.from.clone().addScaledVector(this.fwd, MUZZLE), dir: this.fwd.clone(), speed: SPEED, range: RANGE - MUZZLE,
      radius: RADIUS, hit, pierce: !this.tree,
    });
    this.bolt.onHit((_target, at) => { this.hitPos = at.clone(); });
  }

  /** The thrown thing: in the hands during the wind-up, then on the bolt (or on the nominal line where the engine flies none). */
  private layout(t: number) {
    if (this.crashed) return;
    const yaw = this.yaw;
    if (t < WIND_T) {
      const k = smoothstep(t / WIND_T);
      if (this.tree) {
        // Torn up and swung over his head.
        this.v1.set(this.base.x, this.base.y + 0.5, this.base.z).lerp(this.v2.copy(this.from).addScaledVector(this.fwd, 0.3).setY(HAND_Y), k);
        this.prop.place(this.v1, yaw, -0.6 + k * 0.5);
      } else {
        // The axe is drawn back over his shoulder.
        this.v1.copy(this.from).addScaledVector(this.fwd, -0.2).setY(HAND_Y - 0.3);
        this.prop.place(this.v1, yaw, -k * 1.9);
      }
      return;
    }
    const a = t - WIND_T;
    const bolt = this.bolt;
    if (bolt) {
      if (!bolt.alive) { this.crash(this.hitPos ?? bolt.pos); return; }
      this.v1.set(bolt.pos.x, FLY_Y, bolt.pos.z);
    } else {
      const d = MUZZLE + a * SPEED;
      if (d >= this.reach) { this.v2.copy(this.from).addScaledVector(this.fwd, this.reach); this.crash(this.v2); return; }
      this.v1.copy(this.from).addScaledVector(this.fwd, d).setY(FLY_Y);
    }
    this.prop.place(this.v1, yaw, a * TUMBLE);
  }

  /** It ends: the tree bursts into chunks, leaves and sawdust; the axe sticks in the ground. */
  private crash(at: THREE.Vector3) {
    this.crashed = true;
    this.crashAt = this.time;
    this.v2.set(at.x, 0, at.z);
    this.prop.hide();
    if (this.tree) {
      this.chips.burst(this.v1.set(at.x, 1, at.z), 22, 6, 'chunk', 0.9, 1.1, 1.3);
      this.chips.burst(this.v1.set(at.x, 1.2, at.z), 18, 5, 'leaf', 0.9, 1, 1.5);
      this.chips.burst(this.v1.set(at.x, 0.8, at.z), 18, 5, 'saw', 0.9, 1, 1.3);
    } else {
      this.chips.burst(this.v1.set(at.x, 0.4, at.z), 14, 3.5, 'saw', 0.8, 1, 1.0);
    }
  }
}

export const caberTossModule: EffectModule = {
  label: 'caber toss',
  category: 'hero: timber',
  targeting: { mode: 'ground', radius: 1 },
  create: () => new CaberToss(),
  telegraphs(effect) {
    const e = effect as CaberToss;
    if (!e.ctx) return [];
    return [{ shape: e.line, start: 0, impact: WIND_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CaberToss;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as CaberToss).settings;
    f.add(s, 'loop');
    f.add(s, 'axeDamage', 1, 150, 1);
  },
};
