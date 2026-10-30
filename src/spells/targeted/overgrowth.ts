import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { GROVE_CSS, Bloom, Petals, Pollen, RootRing, SpiralVine } from '../../effects/parts/grove';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Overgrowth (grove kit, W: enemy root): roots spread under the chosen enemy, spiral vines grow up out of them and coil
 * around it, holding it a little lower. Then every vine bursts into a flower at once, pollen puffs, the ground rings,
 * and the enemy is rooted. If it walked more than 2 m from where it stood at the cast the vines close on nothing. A
 * small second tick follows; the flowers shed, the vines wither and the roots fade. See pipeline/designs/kit-grove.md.
 */
export interface OvergrowthSettings {
  damage: number;
  /** One small tick after the hit. */
  tick: number;
  /** Root seconds on the main hit (engine cap 1.5). */
  root: number;
  loop: boolean;
}

export const defaultOvergrowth = (): OvergrowthSettings => ({ damage: 45, tick: 10, root: 1.2, loop: false });

// Timeline (seconds).
const ROOT_T = 0;
const GROW_T = 0.3; // the vines start to grow (they are up by 0.7)
const HIT_T = 0.75;
const TICK_T = 1.3;
const SHED_T = 1.4;
const DURATION = 2.3;

const RADIUS = 2;
const VINES = 8;

export class Overgrowth implements Effect {
  readonly group = new THREE.Group();
  readonly settings: OvergrowthSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -8);

  // Event flags.
  private flags = { roots: false, grown: false, impacted: false, ticked: false, shed: false };

  // Parts.
  private roots = new RootRing();
  private vines: SpiralVine[] = [];
  private blooms: Bloom[] = [];
  private bloomSize: number[] = [];
  private petals = new Petals(24);
  private pollen = new Pollen(40);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: OvergrowthSettings = defaultOvergrowth()) {
    this.settings = settings;
    this.petals.life = 1.0;
    for (let i = 0; i < VINES; i++) {
      this.vines.push(new SpiralVine(30, 6, 5));
      this.blooms.push(new Bloom());
      this.bloomSize.push(0.8);
    }
    this.group.add(
      this.roots.mesh, ...this.vines.map((v) => v.mesh), ...this.blooms.map((b) => b.mesh), this.petals.mesh, this.pollen.mesh,
      this.groundShock.mesh,
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
    this.point.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.roots.reset();
    for (const v of this.vines) v.reset();
    for (const b of this.blooms) b.reset();
    this.petals.reset();
    this.pollen.reset();
    this.groundShock.set(this.point, 0, 0);
    this.release();
  }

  /** Gives the enemies their position back. */
  private release() {
    const ctx = this.ctx;
    if (ctx) for (const e of ctx.targets) ctx.displace(e, this.v1.set(0, 0, 0));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.roots.update(dt);
    for (const v of this.vines) v.update(dt);
    for (const b of this.blooms) b.update(dt);
    this.petals.update(dt);
    this.pollen.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.roots && t >= ROOT_T) {
      f.roots = true;
      this.roots.spread(this.point, RADIUS, 0.35);
    }
    if (!f.grown && t >= GROW_T) {
      f.grown = true;
      this.growVines();
    }
    if (!f.impacted && t >= HIT_T) {
      f.impacted = true;
      this.bloomAll();
      this.eachInside((e) => ctx?.hit(e, {
        damage: this.settings.damage, knock: 0, from: this.point, color: GROVE_CSS.body, status: { kind: 'root', seconds: this.settings.root },
      }));
    }
    if (!f.ticked && t >= TICK_T) {
      f.ticked = true;
      this.eachInside((e) => ctx?.hit(e, { damage: this.settings.tick, knock: 0, from: this.point, color: GROVE_CSS.body }));
    }
    if (!f.shed && t >= SHED_T) {
      f.shed = true;
      this.blooms.forEach((b, i) => b.shed(0.6 + (i % 3) * 0.05));
      this.vines.forEach((v, i) => v.wither(0.6, (i % 4) * 0.04));
      this.roots.fade(0.5, 0.1);
    }

    this.layout();
  }

  private eachInside(fn: (e: CastContext['targets'][number]) => void) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) if (this.inside(e)) fn(e);
  }

  /** True while `e` stands within the vines' reach right now (live position, so a walker escapes). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  /** Up to four vines coil around the enemies inside; the rest stand in a ring around the zone. */
  private growVines() {
    const ctx = this.ctx;
    let n = 0;
    if (ctx) {
      for (let i = 0; i < ctx.targets.length && n < 4; i++) {
        const p = ctx.targets[i].group.position;
        if (!this.inside(ctx.targets[i])) continue;
        this.v1.set(p.x, 0.05, p.z);
        this.vines[n].grow(this.v1, this.v2.set(0, 1, 0), 2.3, 2.4, 0.3, 0.34, { coilRadius: 0.62, phase: Math.random() * 6, delay: n * 0.02 });
        this.bloomSize[n] = 0.95;
        n++;
      }
    }
    const fill = VINES - n;
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < fill; k++) {
      const a = a0 + (k / fill) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const r = 0.9 + Math.random() * 1.1;
      this.v1.set(this.point.x + Math.cos(a) * r, 0.05, this.point.z + Math.sin(a) * r);
      this.vines[n + k].grow(this.v1, this.v2.set(0, 1, 0), 1.8 + Math.random() * 1.2, 2, 0.26, 0.32, {
        coilRadius: 0.32, phase: Math.random() * 6, delay: 0.03 + Math.random() * 0.04,
      });
      this.bloomSize[n + k] = 0.7 + Math.random() * 0.15;
    }
  }

  /** The hit: every vine bursts into a flower at once, pollen, petals, ground ring, shake. */
  private bloomAll() {
    this.vines.forEach((v, i) => {
      if (!v.active) return;
      v.pointAt(1, this.v1);
      this.v1.y += 0.1;
      this.blooms[i].open(this.v1, this.bloomSize[i], 0.3);
      if (i % 2 === 0) this.pollen.puff(this.v1, 4);
    });
    this.v1.copy(this.point).setY(1.2);
    this.petals.burst(this.v1, 10, 4.5);
    this.shake = 0.35;
  }

  private layout() {
    const t = this.time;
    const after = t - HIT_T;
    const ctx = this.ctx;

    // --- Enemies inside are held 0.1 lower while the vines coil (0.3..), released as they wither. ---
    if (ctx) {
      const k = smoothstep((t - GROW_T) / 0.45) * (1 - smoothstep((t - SHED_T) / 0.3));
      for (const e of ctx.targets) {
        if (!this.inside(e)) { ctx.displace(e, this.v1.set(0, 0, 0)); continue; }
        ctx.displace(e, this.v1.set(0, -0.1 * k, 0));
      }
    }

    // --- Hit: ground refraction, shake. ---
    if (this.flags.impacted) {
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(this.point, 1 + 4 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = 0.35 * Math.exp(-after * 9);
    }
  }
}

export const overgrowthModule: EffectModule = {
  label: 'overgrowth',
  category: 'hero: grove',
  // On the enemy: the vines grow where it stands at the cast.
  targeting: { mode: 'enemy' },
  create: () => new Overgrowth(),
  telegraphs(effect) {
    const e = effect as Overgrowth;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Overgrowth;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as Overgrowth).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'tick', 0, 60, 1);
    f.add(s, 'root', 0, 1.5, 0.1);
  },
};
