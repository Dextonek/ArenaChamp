import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SKY_CSS, SpeedLines, WindCrescent } from '../../effects/parts/sky';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Tailwind Rush (sky kit, W: dash). A gust ribbon trails from his feet toward the point; at 0.1 s he slides there in
 * 0.25 s (`ctx.moveCaster`) behind a streak of speed lines and one long crescent along the path, arriving in a burst of
 * leaves. At 0.4 s a spiral gust at the real landing spot lifts everyone within 2.5 (knock-up). Clean by 1.6 s.
 * See pipeline/designs/kit-sky.md.
 */
export interface TailwindRushSettings {
  damage: number;
  loop: boolean;
}

export const defaultTailwindRush = (): TailwindRushSettings => ({ damage: 45, loop: false });

export const TAILWIND_RANGE = 8;

// Timeline (seconds).
const TRAIL_T = 0.0; // the ribbon trails from his feet
const DASH_T = 0.1; // he goes
const DASH_LEN = 0.25;
const HIT_T = 0.4;
const DURATION = 1.6;
const RADIUS = 2.5;

export class TailwindRush implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TailwindRushSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the dash ends: the aimed spot until the dash starts, then where the engine really lands him. */
  readonly land = new THREE.Vector3();
  /** Where the dash starts and the spot it was aimed at (clamped to range). */
  readonly start = new THREE.Vector3();
  readonly want = new THREE.Vector3();
  private time = 0;
  private flags = { trail: false, dash: false, hit: false };

  // Parts.
  private trail = new GustRibbon(32);
  private lift = new GustRibbon(40);
  private lift2 = new GustRibbon(40);
  private crescents = new WindCrescent(4);
  private lines = new SpeedLines(28);
  private leaves = new Leaves(40);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: SKY.accent, core: 0xfff0f5, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: TailwindRushSettings = defaultTailwindRush()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    this.group.add(
      this.trail.mesh, this.lift.mesh, this.lift2.mesh, this.crescents.mesh, this.lines.mesh, this.leaves.mesh, this.pop.mesh, this.groundShock.mesh,
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
    this.start.copy(ctx.from).setY(0);
    // Aim point limited to the spell's range; the engine may clamp it again to the ring when the dash starts.
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    if (this.v1.length() > TAILWIND_RANGE) this.v1.setLength(TAILWIND_RANGE);
    this.want.copy(this.start).add(this.v1);
    this.land.copy(this.want);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.want).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.trail = this.flags.dash = this.flags.hit = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(SKY.dark);
    this.trail.reset();
    this.lift.reset();
    this.lift2.reset();
    this.crescents.reset();
    this.lines.reset();
    this.leaves.reset();
    this.pop.set(this.want, 0, 0);
    this.groundShock.set(this.want, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.trail.update(dt);
    this.lift.update(dt);
    this.lift2.update(dt);
    this.crescents.update(dt);
    this.lines.update(dt);
    this.leaves.update(dt);
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

    // 0..0.1: a gust ribbon trails from his feet toward the point.
    if (!f.trail && t >= TRAIL_T) {
      f.trail = true;
      const mid = this.v1.lerpVectors(this.start, this.want, 0.5).setY(0.55);
      mid.x += (this.want.z - this.start.z) * 0.05;
      this.trail.along([this.v2.copy(this.start).setY(0.25), mid.clone(), this.v3.copy(this.want).setY(0.3)], 0.4, 0.8);
    }

    // 0.1..0.35: the dash, with speed lines and one long crescent along the path.
    if (!f.dash && t >= DASH_T) {
      f.dash = true;
      this.land.copy(ctx?.moveCaster ? ctx.moveCaster(this.want, DASH_LEN) : this.want).setY(0);
      this.dashFx();
    }

    // 0.4: the spiral gust at the real landing spot.
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.v1.copy(this.land).setY(0);
      this.lift.spiral(this.v1, 2.4, 2.5, 2.2, 0.8, 0.38);
      this.lift2.spiral(this.v1, 2.0, 2.5, 1.8, 0.8, 0.32);
      this.leaves.blow(this.v2.copy(this.land).setY(0.5), this.v3.set(0, 1, 0), 16, 8);
      this.shake = 0.14;
      if (ctx) {
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.land.x, p.z - this.land.z) > RADIUS) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 0, from: this.land, color: SKY_CSS.body, status: { kind: 'knockup', seconds: 0.4 } });
        }
      }
    }

    if (f.hit) {
      const after = t - HIT_T;
      const sp = StarBurst.pop(after, 0, 0.02);
      this.pop.set(this.v1.copy(this.land).setY(1.1), 0.7 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.35, 0, 1);
      this.groundShock.set(this.land, 0.4 + 2.2 * gp, 0.025 * (1 - gp) * (1 - gp));
      this.shake = 0.14 * Math.exp(-after * 12);
    }
  }

  private dashFx() {
    this.v1.copy(this.start).setY(0.9);
    this.v2.copy(this.land).setY(0.9);
    this.lines.sweep(this.v1, this.v2, 20, 2.6, 0.35);
    const dx = this.land.x - this.start.x, dz = this.land.z - this.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.6) return;
    // One long flat crescent whose chord lies along the path, bowing to the left of it.
    const arc = 70;
    const R = len / (2 * Math.sin(THREE.MathUtils.degToRad(arc / 2)));
    const bow = this.v3.set(-dz / len, 0, dx / len);
    this.v1.set((this.start.x + this.land.x) / 2, 0.85, (this.start.z + this.land.z) / 2).addScaledVector(bow, -R * Math.cos(THREE.MathUtils.degToRad(arc / 2)));
    this.crescents.slash(this.v1, bow, R, arc, 0.18, 0.9, { width: Math.min(0.8, 0.3 + len * 0.05), sweep: DASH_LEN });
  }
}

export const tailwindRushModule: EffectModule = {
  label: 'tailwind rush',
  category: 'hero: sky',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new TailwindRush(),
  telegraphs(effect) {
    const e = effect as TailwindRush;
    if (!e.ctx) return [];
    return [
      { shape: { kind: 'line', x1: e.start.x, z1: e.start.z, x2: e.want.x, z2: e.want.z, width: 1.4 }, start: 0, impact: HIT_T },
      { shape: { kind: 'circle', x: e.want.x, z: e.want.z, radius: RADIUS }, start: 0, impact: HIT_T },
    ];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TailwindRush;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as TailwindRush).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
