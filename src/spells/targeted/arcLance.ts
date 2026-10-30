import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { LightningTree, Puddles, Sparks, STORM, STORM_CSS } from '../../effects/parts/storm';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { TelegraphSpec } from '../../effects/telegraph';

/**
 * Arc Lance (storm kit, Q: single target). She points the hooked staff and sparks crackle along it; a horizontal
 * lightning tree jumps from the staff tip to the target and splits into the ground at its feet. The target flashes, a
 * yellow star pops, ripples and three small ground forks spread, then the bolt flickers out in steps. A second
 * enemy (a unit) within 6 m of the target gets a chained tree for half damage. See
 * pipeline/designs/kit-storm.md.
 */
export interface ArcLanceSettings {
  damage: number;
  /** Share of the damage the chained second target takes. */
  chain: number;
  loop: boolean;
}

export const defaultArcLance = (): ArcLanceSettings => ({ damage: 56, chain: 0.5, loop: false });
const CHAIN_RANGE = 6;

// Timeline (seconds).
const POINT_T = 0.0;
const IMPACT_T = 0.45;
const OUT_T = 1.4; // the bolt is gone
const DURATION = 1.5;

export class ArcLance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ArcLanceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private tip = new THREE.Vector3(0, 1.9, 13);
  private base = new THREE.Vector3(0, 1.0, 14);
  private feet = new THREE.Vector3(0, 0, -8);
  private hit = new THREE.Vector3(0, 1.1, -8);
  /** Feet of the chained second target (null = no chain). */
  private feet2: THREE.Vector3 | null = null;

  private flags = { ripple2: false, impacted: false, dried: false };
  private sparkTimer = 0;

  // Parts.
  private tree = new LightningTree(6);
  private sparks = new Sparks(80);
  private puddles = new Puddles();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: STORM.accent, core: 0xfffbe0, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ArcLanceSettings = defaultArcLance()) {
    this.settings = settings;
    this.screen.impactColor.set(STORM.hot);
    this.screen.tint.set(STORM.dark);
    this.group.add(this.puddles.mesh, this.tree.mesh, this.sparks.mesh, this.pop.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return IMPACT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.feet.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.tip.copy(ctx.from).addScaledVector(this.fwd, 0.75).setY(1.95);
    this.base.copy(ctx.from).addScaledVector(this.fwd, 0.45).setY(0.95);
    this.hit.copy(this.feet).setY(1.1);
    const p2 = ctx.targetPos[1];
    this.feet2 = p2 && Math.hypot(p2.x - this.feet.x, p2.z - this.feet.z) <= CHAIN_RANGE ? p2.clone().setY(0) : null;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.hit);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.sparkTimer = 0;
    this.flags.ripple2 = this.flags.impacted = this.flags.dried = false;
    clearScreenFx(this.screen);
    this.tree.reset();
    this.sparks.reset();
    this.puddles.reset();
    this.pop.set(this.hit, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.tree.update(dt);
    this.sparks.update(dt);
    this.puddles.update(dt);
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

    // Sparks crackle along the staff while she points it, then fade with the bolt.
    if (t >= POINT_T + 0.02 && t < IMPACT_T + 0.35) {
      this.sparkTimer += dt;
      const rate = t < IMPACT_T ? 0.045 : 0.08;
      while (this.sparkTimer >= rate) {
        this.sparkTimer -= rate;
        this.sparks.along(this.base, this.tip, t < IMPACT_T ? 3 : 1, 2.4);
      }
    }

    if (!f.impacted && t >= IMPACT_T) {
      f.impacted = true;
      const life = OUT_T - IMPACT_T;
      // The horizontal tree, tip to target, forking at the far end.
      this.tree.strike(this.tip, this.hit, 4, 0.24, life, { hold: 0.4, levels: 3 });
      // Three small forks from the target's feet into the ground.
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random();
        const r = 1.0 + Math.random() * 0.9;
        this.v1.set(this.feet.x, 0.5, this.feet.z);
        this.v2.set(this.feet.x + Math.cos(a) * r, 0.05, this.feet.z + Math.sin(a) * r);
        this.tree.strike(this.v1, this.v2, 1, 0.1, life * (0.45 + 0.1 * i), { hold: 0.4, levels: 2 });
      }
      this.sparks.burst(this.hit, 12, 6);
      if (this.feet2) {
        this.v1.copy(this.hit);
        this.v2.copy(this.feet2).setY(1.1);
        this.tree.strike(this.v1, this.v2, 3, 0.16, life, { hold: 0.4, levels: 2 });
        this.sparks.burst(this.v2, 8, 5);
        if (ctx && ctx.targets[1]) ctx.hit(ctx.targets[1], { damage: Math.round(this.settings.damage * this.settings.chain), knock: 1, from: this.hit, color: STORM_CSS.body });
      }
      this.puddles.wet(this.feet, 1.5);
      this.puddles.ripple(this.feet, 1.5);
      this.shake = 0.2;
      if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 2, from: ctx.from, color: STORM_CSS.body });
    }
    if (f.impacted && !f.ripple2 && t >= IMPACT_T + 0.12) {
      f.ripple2 = true;
      this.puddles.ripple(this.feet, 2.3);
    }
    if (f.impacted && !f.dried && t >= OUT_T - 0.4) {
      f.dried = true;
      this.puddles.dry(0.4);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const after = t - IMPACT_T;

    // A faint cold darken so the bolt reads.
    this.screen.darken = 0.22 * smoothstep((t - 0.1) / 0.3) * (1 - smoothstep((t - 0.9) / 0.5));
    this.screen.impact = impactFrameAt(t, IMPACT_T, [1], 0.03);

    if (this.flags.impacted) {
      const sp = StarBurst.pop(after, 0, 0.02);
      this.pop.set(this.hit, 1.0 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 1.8 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.2 * Math.exp(-after * 14);
    }
  }
}

export const arcLanceModule: EffectModule = {
  label: 'arc lance',
  category: 'hero: storm',
  targeting: { mode: 'enemies', maxTargets: 2 },
  create: () => new ArcLance(),
  telegraphs(effect) {
    const e = effect as ArcLance;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    const out: TelegraphSpec[] = [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.1, impact: IMPACT_T }];
    const p2 = ctx.targetPos[1];
    if (p2 && Math.hypot(p2.x - c.x, p2.z - c.z) <= CHAIN_RANGE) out.push({ shape: { kind: 'line', x1: c.x, z1: c.z, x2: p2.x, z2: p2.z, width: 1.4 }, start: 0.1, impact: IMPACT_T });
    return out;
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ArcLance;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as ArcLance).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'chain', 0, 1, 0.05);
  },
};
