import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { HIVE, HIVE_CSS, Honeycomb, HoneySplash, Swarm, waspLook } from '../../effects/parts/hive';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Swarm Leap (hive kit, W: dash + summon). The swarm lifts off Sirix's back in a cloud; at 0.1 s he leaps to the point
 * in 0.25 s (`ctx.moveCaster`) with the swarm streaming behind him as a ribbon. At 0.4 s a honeycomb bursts under him at
 * the real landing spot with honey splashes, everyone within 2.5 is hit, and two wasp soldiers peel off the swarm
 * (`ctx.summon`). The honeycomb crumbles and the swarm thins out; clean by 1.6 s (the wasps live on as units).
 * See pipeline/designs/kit-hive.md.
 */
export interface SwarmLeapSettings {
  damage: number;
  loop: boolean;
}

export const defaultSwarmLeap = (): SwarmLeapSettings => ({ damage: 30, loop: false });

export const SWARM_LEAP_RANGE = 8;

// Timeline (seconds).
const LIFT_T = 0.0; // the swarm lifts off his back
const DASH_T = 0.1; // he goes
const DASH_LEN = 0.25;
const HIT_T = 0.4;
const SCATTER_T = 0.85;
const CRUMBLE_T = 1.1;
const DURATION = 1.6;
const RADIUS = 2.5;

export class SwarmLeap implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SwarmLeapSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the leap ends: the aimed spot until the dash starts, then where the engine really lands him. */
  readonly land = new THREE.Vector3();
  /** Where the leap starts and the spot it was aimed at (clamped to range). */
  readonly start = new THREE.Vector3();
  readonly want = new THREE.Vector3();
  private time = 0;
  private flags = { lift: false, dash: false, hit: false, scatter: false, crumble: false };

  // Parts.
  private swarm = new Swarm(64, 0.5);
  private comb = new Honeycomb(40, 'wax');
  private honey = new HoneySplash(20);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: HIVE.accent, core: 0xf4ffe8, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: SwarmLeapSettings = defaultSwarmLeap()) {
    this.settings = settings;
    this.screen.impactColor.set(HIVE.hot);
    this.screen.tint.set(HIVE.dark);
    this.group.add(this.comb.mesh, this.swarm.mesh, this.honey.mesh, this.pop.mesh, this.groundShock.mesh);
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
    // Aim point limited to the spell's range; the engine may clamp it again to the ring when the leap starts.
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    if (this.v1.length() > SWARM_LEAP_RANGE) this.v1.setLength(SWARM_LEAP_RANGE);
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
    const f = this.flags;
    f.lift = f.dash = f.hit = f.scatter = f.crumble = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(HIVE.dark);
    this.swarm.reset();
    this.comb.reset();
    this.honey.reset();
    this.pop.set(this.want, 0, 0);
    this.groundShock.set(this.want, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.swarm.update(dt);
    this.comb.update(dt);
    this.honey.update(dt);
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

    // 0..0.1: the swarm lifts off his back in a cloud.
    if (!f.lift && t >= LIFT_T) {
      f.lift = true;
      this.v1.copy(this.start).setY(1.3);
      this.swarm.set(this.v1, 0.9, 64, (_i, out) => out.set(this.start.x + (Math.random() - 0.5) * 0.6, 1.1 + Math.random() * 0.5, this.start.z + (Math.random() - 0.5) * 0.6));
    }

    // 0.1..0.35: the leap, the swarm streaming behind him as a ribbon.
    if (!f.dash && t >= DASH_T) {
      f.dash = true;
      this.land.copy(ctx?.moveCaster ? ctx.moveCaster(this.want, DASH_LEN) : this.want).setY(0);
      this.v1.copy(this.start).setY(1.3);
      this.v2.copy(this.land).setY(1.3);
      this.swarm.radius = 0.6;
      this.swarm.stream(this.v1, this.v2, 0.45, 0.9);
    }

    // 0.4: the honeycomb bursts under him at the real landing spot.
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.comb.grow(this.land, RADIUS, 0.25, 0, 0.5);
      this.honey.burst(this.v1.copy(this.land).setY(0.3), 10, 4.2, 0.16, 3.6);
      this.shake = 0.18;
      if (ctx) {
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.land.x, p.z - this.land.z) > RADIUS) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 3, from: this.land, color: HIVE_CSS.body });
        }
        // Two wasp soldiers peel off the swarm.
        ctx.summon?.({
          kind: 'melee', at: this.land.clone(), count: 2, hp: 40, seconds: 6, damage: 6, attackEvery: 1, color: HIVE_CSS.body, look: waspLook,
        });
      }
    }
    if (f.hit && !f.scatter && t >= SCATTER_T) {
      f.scatter = true;
      this.swarm.scatter(0.55, false, 3.5);
    }
    if (f.hit && !f.crumble && t >= CRUMBLE_T) {
      f.crumble = true;
      this.comb.crumble(0.4);
    }

    if (f.hit) {
      const after = t - HIT_T;
      const sp = StarBurst.pop(after, 0, 0.02);
      this.pop.set(this.v1.copy(this.land).setY(1.0), 0.8 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.35, 0, 1);
      this.groundShock.set(this.land, 0.4 + 2.2 * gp, 0.025 * (1 - gp) * (1 - gp));
      this.shake = 0.18 * Math.exp(-after * 12);
    }
  }
}

export const swarmLeapModule: EffectModule = {
  label: 'swarm leap',
  category: 'hero: hive',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SwarmLeap(),
  telegraphs(effect) {
    const e = effect as SwarmLeap;
    if (!e.ctx) return [];
    return [
      { shape: { kind: 'line', x1: e.start.x, z1: e.start.z, x2: e.want.x, z2: e.want.z, width: 1.4 }, start: 0, impact: HIT_T },
      { shape: { kind: 'circle', x: e.want.x, z: e.want.z, radius: RADIUS }, start: 0, impact: HIT_T },
    ];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SwarmLeap;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as SwarmLeap).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
