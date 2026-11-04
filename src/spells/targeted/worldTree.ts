import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { GROVE, GROVE_CSS, Bloom, Petals, Pollen, RootRing, SpiralVine, Thorns } from '../../effects/parts/grove';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { pillar } from '../../obstacles';
import { TREE_BURST_S, TREE_LIFE_S, gardenNow, raiseTree, treeActive, treeRecord, type WorldTree } from '../../traits/grove';

/**
 * World Tree (grove kit v5, R: terrain, then a recast). Cast: a giant flower opens in a 3 m ring on the ground (9 m, a soil
 * patch with roots spreading and pollen drifting in, a red circle from `telegraphs`; she is rooted by the engine for the
 * 1.2 s). At 1.2 s (`TREE_BURST_S`) the tree bursts up: a trunk of three twisted vines 6 m tall, five arching branches with a
 * bloom at each tip and a crown bloom on top, leaves, falling petals, a ring, one impact frame. An enemy inside 3 m on live
 * positions is rooted 1 s with a hit (`damage: 0`; a zone hit, so stepping out in the 1.2 s dodges it). It stands 8 s
 * (`TREE_LIFE_S`) as a real obstacle (`ctx.addObstacle`, a pillar of radius 1.0): it blocks walking, sight and bolts for both
 * heroes. While it stands her flowers within 6 m heal 50% more (`src/traits/grove.ts`). Then the vines brown and sink, the
 * blooms shed. The tree is built from `sentFrom` and `point` only (range 9), so both screens make the same one.
 * Recast, Uproot (free, from 1.3 s, aiWait for the CPU): it is told from the first cast with the tree's record in the trait's
 * WeakMap (`treeActive`), not with the instance, because the engine may play the recast on a new instance (hero mode) or on
 * the same one (the CPU reuses one instance per label). The recast removes the obstacle (`ctx.removeObstacle`), draws a 3 m
 * ring of roots with thorn tips breaking the soil for 0.6 s while the tree shudders, then the thorns burst: 60 to everyone
 * within 3 m on live positions (`projectile: true`), and the tree sinks. The effect that owns the tree watches the record's
 * `upAt` and shudders and sinks it itself, so the first cast's look is never cut off by anything but its recast. Clean by 10.2 s.
 * Limit: the recast's targets are the enemies within 3 m of where the recast was aimed (the ground targeting), so aim it at the tree.
 */
export interface WorldTreeSettings {
  /** The root's seconds at the burst. */
  root: number;
  /** The Uproot's thorn damage. */
  thorns: number;
  loop: boolean;
}

export const defaultWorldTree = (): WorldTreeSettings => ({ root: 1.0, thorns: 60, loop: false });

// Timeline (seconds).
const RANGE = 9;
const HIT_R = 3;
const TRUNK_R = 1.0; // the obstacle's radius
const LIFE_END = TREE_BURST_S + TREE_LIFE_S; // 9.2
const DURATION = LIFE_END + 1.0;
const UP_WARN = 0.6; // the Uproot's warning ring
const UP_END = UP_WARN + 1.0;
const TREE_H = 6.4;
const TAU = Math.PI * 2;

export class WorldTreeFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WorldTreeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** True when the last cast is the Uproot recast. */
  isUproot = false;
  /** Where the tree stands (first cast: from sentFrom and point; recast: from the tree's record). */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private from = new THREE.Vector3(0, 0, 14);

  // First cast timeline.
  private time = 0;
  private treeOn = false;
  private burst = false;
  private bloomed = false;
  private rec: WorldTree | null = null;
  private pendingUp: WorldTree | null = null;
  private shudderAt = -1; // this.time when the tree was seen uprooted
  private sunk = false;
  private rainT = 0;

  // The Uproot's own timeline.
  private upOn = false;
  private upT = 0;
  private upCtx: CastContext | null = null;
  private upDone = false;

  // The tree.
  private treeGroup = new THREE.Group();
  private trunk = [0, 1, 2].map(() => new SpiralVine(40, 6, 4));
  private branches = [0, 1, 2, 3, 4].map(() => new SpiralVine(32, 6, 5));
  private tips: THREE.Vector3[] = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());
  private blooms = [0, 1, 2, 3, 4, 5].map(() => new Bloom());
  private bud = new Bloom();
  private base = new RootRing();
  private warn = new RootRing();
  private thorns = new Thorns(44);
  private petals = new Petals(80);
  private pollen = new Pollen(60);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: GROVE.accent, core: GROVE.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private shockB = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(settings: WorldTreeSettings = defaultWorldTree()) {
    this.settings = settings;
    this.screen.impactColor.set(GROVE.hot);
    this.screen.tint.set(GROVE.dark);
    this.treeGroup.add(...this.trunk.map((v) => v.mesh), ...this.branches.map((v) => v.mesh), ...this.blooms.map((b) => b.mesh));
    this.group.add(
      this.base.mesh, this.warn.mesh, this.bud.mesh, this.thorns.mesh, this.treeGroup, this.petals.mesh, this.pollen.mesh,
      this.pop.mesh, this.shock.mesh, this.shockB.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return this.isUproot ? UP_WARN : TREE_BURST_S;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.pendingUp = treeActive(ctx.caster);
    this.isUproot = !!this.pendingUp;
    if (this.pendingUp) {
      // The Uproot: the tree is where the record says, whichever screen or instance raised it.
      this.centre.set(this.pendingUp.x, 0, this.pendingUp.z);
      return;
    }
    // Both screens must agree on the tree: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.3) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    const d = Math.min(len < 0.3 ? 3 : len, RANGE);
    this.centre.set(s.x + dx * d, 0, s.z + dz * d);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centre).setY(2.5);
  }

  play() {
    if (this.isUproot && this.pendingUp) {
      this.startUproot(this.pendingUp);
      this.pendingUp = null;
      return;
    }
    // A first cast: a clean start (the previous look is over, or this is the editor).
    this.reset();
    this.playing = true;
    this.treeOn = true;
    const ctx = this.ctx;
    this.rec = ctx ? raiseTree(ctx.caster, this.centre.x, this.centre.z) : null;
    this.base.spread(this.centre, HIT_R, 0.9);
    this.bud.open(this.centre, 0.9, TREE_BURST_S);
    this.thorns.place(this.centre, HIT_R);
  }

  private reset() {
    this.time = 0;
    this.treeOn = this.burst = this.bloomed = this.sunk = false;
    this.upOn = this.upDone = false;
    this.upT = 0;
    this.shudderAt = -1;
    this.rainT = 0;
    this.shake = 0;
    this.rec = null;
    this.pendingUp = null;
    this.upCtx = null;
    this.treeGroup.position.set(0, 0, 0);
    clearScreenFx(this.screen);
    this.screen.tint.set(GROVE.dark);
    for (const v of [...this.trunk, ...this.branches]) v.reset();
    for (const b of [...this.blooms, this.bud]) b.reset();
    this.base.reset();
    this.warn.reset();
    this.thorns.reset();
    this.petals.reset();
    this.pollen.reset();
    this.pop.set(this.centre, 0, 0);
    this.shock.set(this.centre, 0, 0);
    this.shockB.set(this.centre, 0, 0);
  }

  /** The tree's obstacle goes, as the Uproot starts (it is removed through whichever cast context holds it). */
  private dropObstacle(rec: WorldTree, ctx: CastContext | null) {
    if (rec.obstacle) (rec.ctx ?? ctx)?.removeObstacle?.(rec.obstacle);
    rec.obstacle = null;
    rec.ctx = null;
  }

  /** The Uproot: the record says uprooted (the heal bonus ends), the obstacle goes, a ring and thorn tips warn for 0.6 s. */
  private startUproot(rec: WorldTree) {
    const ctx = this.ctx;
    rec.upAt = gardenNow(ctx?.caster ?? this);
    this.dropObstacle(rec, ctx);
    this.upCtx = ctx;
    this.upOn = true;
    this.upT = 0;
    this.upDone = false;
    this.playing = true;
    this.warn.spread(this.centre, HIT_R, 0.25);
    this.thorns.place(this.centre, HIT_R);
    this.thorns.reset();
    this.shockB.set(this.centre, 0, 0);
    this.screen.silhouettes = ctx ? [ctx.caster.group, ...ctx.targets.map((e) => e.group)] : [];
    this.screen.focus.copy(this.centre).setY(1.5);
    this.shake = 0.12;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const v of [...this.trunk, ...this.branches]) v.update(dt);
    for (const b of [...this.blooms, this.bud]) b.update(dt);
    this.base.update(dt);
    this.warn.update(dt);
    this.thorns.update(dt);
    this.petals.update(dt);
    this.pollen.update(dt);

    if (this.treeOn) this.updateTree(dt);
    if (this.upOn) this.updateUproot(dt);
    if (!this.treeOn && !this.upOn) this.finish();
  }

  private finish() {
    const loop = this.settings.loop;
    this.playing = false;
    this.shake = 0;
    this.reset();
    if (loop) this.play();
  }

  private updateTree(dt: number) {
    this.time += dt;
    const t = this.time;
    const ctx = this.ctx;
    const rec = this.rec;

    // The record says the Uproot started (this instance or another played it): the tree shudders, then sinks with the burst.
    if (rec && rec.upAt >= 0 && this.shudderAt < 0 && this.burst) this.shudderAt = t;
    if (this.shudderAt >= 0) {
      const a = t - this.shudderAt;
      const k = Math.min(1, a / UP_WARN);
      this.treeGroup.position.set(Math.sin(t * 70) * 0.07 * k, 0, Math.cos(t * 61) * 0.07 * k);
      if (!this.sunk && a >= UP_WARN) this.sink();
      if (a >= UP_WARN + 0.9) { this.treeOn = false; return; }
    }
    if (t >= DURATION) { this.treeOn = false; return; }

    // The ground until the tree comes up: pollen drawn in, a faint rumble.
    if (!this.burst) {
      if (Math.random() < 0.5) this.pollen.drift(this.centre, HIT_R * 0.8, 1, 1.6, 1.0);
      this.shake = Math.max(this.shake * 0.9, 0.04 * smoothstep(t / TREE_BURST_S));
    }
    if (!this.burst && t >= TREE_BURST_S) {
      this.burst = true;
      this.rise(ctx);
    }
    if (this.burst) {
      const a = t - TREE_BURST_S;
      this.screen.impact = impactFrameAt(t, TREE_BURST_S, [1], 0.03);
      const sp = StarBurst.pop(a, 0, 0.04);
      this.pop.set(this.v1.copy(this.centre).setY(1.6), 2.2 * sp.scale + 1e-3, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(a / 0.45, 0, 1);
      this.shock.set(this.centre, 0.5 + 3.8 * gp, 0.045 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.45 * Math.exp(-a * 8));
      // Standing: petals fall from the canopy and pollen hangs in it.
      if (this.shudderAt < 0 && t < LIFE_END) {
        this.rainT -= dt;
        if (this.rainT <= 0) {
          this.rainT = 0.3;
          this.petals.rain(this.v1.copy(this.centre).setY(TREE_H - 1.2), 3.2, 2, 5, 2.4);
          this.pollen.drift(this.centre, 3, 2, 5, 2.4);
        }
      }
      // The blooms open as the branches arrive: one on each branch tip, a crown on top.
      if (!this.bloomed && a >= 0.55) {
        this.bloomed = true;
        this.blooms.forEach((b, i) => {
          if (i < 5) { b.open(this.tips[i], 1.4, 0.7); b.aim(Math.atan2(Math.cos(i * (TAU / 5) + 0.35), Math.sin(i * (TAU / 5) + 0.35)), 0.45); }
          else b.open(this.v1.copy(this.centre).setY(TREE_H + 0.1), 2.0, 0.8);
        });
        this.petals.burst(this.v1.copy(this.centre).setY(TREE_H), 14, 4);
      }
      // The end of its time: the vines brown and sink, the blooms shed.
      if (this.shudderAt < 0 && !this.sunk && t >= LIFE_END) this.sink();
    }
    // The warning of the end: leaves let go as the last second runs out.
    if (this.burst && this.shudderAt < 0 && !this.sunk && t > LIFE_END - 1 && Math.random() < 0.25) {
      this.petals.rain(this.v1.copy(this.centre).setY(TREE_H - 1), 3.2, 1, 5, 1.6);
    }
    this.screen.darken = 0.2 * smoothstep((t - 0.05) / 0.3) * (1 - smoothstep((t - 1.5) / 0.8));
  }

  /** The tree sinks: vines brown and go under the floor, blooms shed, the ground ring fades. */
  private sink() {
    this.sunk = true;
    for (const v of [...this.trunk, ...this.branches]) v.wither(0.6, 0.1 * Math.random());
    for (const b of this.blooms) b.shed(0.6);
    this.base.fade(0.6);
    this.petals.burst(this.v1.copy(this.centre).setY(TREE_H * 0.7), 18, 4);
    this.shake = Math.max(this.shake, 0.25);
  }

  /** The burst at 1.2 s: the root hit on live positions, the obstacle, and the tree shoots up. */
  private rise(ctx: CastContext | null) {
    this.bud.shed(0.4);
    if (ctx) {
      for (const e of ctx.targets) {
        const p = e.group.position;
        if (Math.hypot(p.x - this.centre.x, p.z - this.centre.z) > HIT_R) continue;
        // A zone hit (no `projectile`): judged by the live position inside the circle at the burst.
        ctx.hit(e, { damage: 0, knock: 0, from: this.centre.clone(), color: GROVE_CSS.body, status: { kind: 'root', seconds: this.settings.root } });
      }
      const o = ctx.addObstacle ? ctx.addObstacle(pillar(this.centre.x, this.centre.z, TRUNK_R), TREE_LIFE_S) : null;
      if (this.rec) { this.rec.obstacle = o; this.rec.ctx = o ? ctx : null; }
    }
    // The trunk: three vines twisted round one axis, thick at the foot. The branches arch out from near the top.
    const up = new THREE.Vector3(0, 1, 0);
    this.trunk.forEach((v, i) => v.grow(this.centre, up, TREE_H, 1.6, 0.85, 0.4, { coilRadius: 0.36, phase: i * (TAU / 3) }));
    this.branches.forEach((v, i) => {
      const a = i * (TAU / 5) + 0.35;
      const reach = 2.5 + 0.7 * ((i * 7) % 3) / 2;
      const h0 = TREE_H * 0.55 + 0.35 * i, rise = 1.3 + 0.3 * (i % 2);
      const cx = this.centre.x, cz = this.centre.z;
      const path = (u: number, out: THREE.Vector3) => out.set(
        cx + Math.cos(a) * reach * u + Math.sin(u * 9 + i) * 0.12,
        h0 + rise * (1.6 * u - 0.6 * u * u),
        cz + Math.sin(a) * reach * u + Math.cos(u * 9 + i) * 0.12,
      );
      v.growAlong(path, 0.42, 0.5, 0.25 + 0.05 * i);
      path(1, this.tips[i]);
    });
    this.petals.burst(this.v1.copy(this.centre).setY(1.5), 26, 6.5);
    this.pollen.puff(this.v1.copy(this.centre).setY(1.2), 18);
    this.shake = 0.5;
  }

  private updateUproot(dt: number) {
    this.upT += dt;
    const t = this.upT;
    const ctx = this.upCtx;
    // The warning: thorn tips break the soil, the ring pulses, leaves drop from the shuddering tree.
    this.thorns.peek = Math.min(1, t / (UP_WARN * 0.8));
    const pulse = 0.5 + 0.5 * Math.sin(t * 22);
    this.shockB.set(this.centre, HIT_R * (0.55 + 0.45 * smoothstep(t / UP_WARN)), 0.012 + 0.012 * pulse);
    if (t < UP_WARN && Math.random() < 0.5) this.petals.rain(this.v1.copy(this.centre).setY(TREE_H * 0.8), 2.8, 1, 4, 1.2);
    if (!this.upDone && t >= UP_WARN) {
      this.upDone = true;
      this.warn.fade(0.3);
      this.thorns.burst();
      this.petals.burst(this.v1.copy(this.centre).setY(0.5), 20, 5.5);
      this.pollen.puff(this.v1.copy(this.centre).setY(0.6), 14);
      this.shake = 0.5;
      if (ctx) {
        // `projectile: true`: judged on the live position, so stepping out of the ring after the warning does not matter.
        for (const e of ctx.enemies?.() ?? ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.centre.x, p.z - this.centre.z) > HIT_R) continue;
          ctx.hit(e, { damage: this.settings.thorns, knock: 2, from: this.centre.clone(), color: GROVE_CSS.body, projectile: true });
        }
      }
      // Nothing of the tree here (a new instance played the recast): the ring still shows, the owner's own look is elsewhere.
      if (!this.treeOn) this.shake = 0.3;
    }
    if (this.upDone) {
      const a = t - UP_WARN;
      this.screen.impact = impactFrameAt(t, UP_WARN, [1], 0.03);
      const sp = StarBurst.pop(a, 0, 0.04);
      this.pop.set(this.v1.copy(this.centre).setY(1.2), 1.8 * sp.scale + 1e-3, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(a / 0.35, 0, 1);
      this.shock.set(this.centre, 0.5 + 3.2 * gp, 0.045 * (1 - gp) * (1 - gp));
      this.shockB.set(this.centre, 0, 0);
      this.shake = Math.max(this.shake * 0.9, 0.4 * Math.exp(-a * 9));
    }
    if (t >= UP_END) { this.upOn = false; this.thorns.reset(); }
    void dt;
  }
}

export const worldTreeModule: EffectModule = {
  label: 'world tree',
  category: 'hero: grove',
  // The aim point is where the tree rises; `radius` brings the enemies within reach of it into `ctx.targets`.
  targeting: { mode: 'ground', radius: HIT_R },
  create: () => new WorldTreeFx(),
  telegraphs(effect) {
    const e = effect as WorldTreeFx;
    if (!e.ctx) return [];
    // The circle the tree roots or the thorns hit: the burst is the dodge check, so the circle is the zone.
    if (e.isUproot) return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: HIT_R }, start: 0, impact: UP_WARN }];
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: HIT_R }, start: 0.04, impact: TREE_BURST_S }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as WorldTreeFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 7);
  },
  buildGui(f, effect) {
    const s = (effect as WorldTreeFx).settings;
    f.add(s, 'loop');
    f.add(s, 'root', 0.2, 1.5, 0.1);
    f.add(s, 'thorns', 0, 150, 1);
  },
};

// The record of the last tree, for a look at it from outside (the tool's checks).
export const worldTreeRecord = treeRecord;
