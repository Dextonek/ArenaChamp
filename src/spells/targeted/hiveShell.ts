import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { HIVE, Honeycomb, HoneySplash, Swarm } from '../../effects/parts/hive';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SHELL_SECONDS, shellStings } from '../../traits/hive';

/**
 * Hive Shell (hive kit v5, W: a self shell). Black chitin hexagon plates fly in and snap into a dome round Sirix (0.35 s,
 * radius 1.5, 2.4 m high, 34 plates) with a ground ring and honey drops, and stand with him (they follow his steps) for
 * 3 s, then crumble. The +40% armour is the kit's `buff`; the stings are the trait's (`src/traits/hive.ts`): each hit he
 * takes while it runs spends a wasp and sends it at the attacker for 15. This effect only draws the shell and, every time
 * the trait's count of stings rises (`shellStings`, the same on both screens), sends a few wasps from the dome to the
 * enemy with a green star where they land. Clean by 3.5 s. Nothing here hits or needs a telegraph.
 */
export interface HiveShellSettings {
  loop: boolean;
}

export const defaultHiveShell = (): HiveShellSettings => ({ loop: false });

// Timeline (seconds).
const GROW_T = 0.35;
const DURATION = SHELL_SECONDS + 0.5;
const RADIUS = 1.5;
const HEIGHT = 2.4;
const STING_FLY = 0.3;

export class HiveShell implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HiveShellSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { grown: false, crumble: false };
  private center = new THREE.Vector3();
  private seen = 0;
  private starAt = -1;
  private starPos = new THREE.Vector3();

  private dome = new Honeycomb(48, 'chitin');
  private honey = new HoneySplash(14);
  private stings = new Swarm(10, 0.32);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: HIVE.accent, core: 0xf4ffe8, additive: false });
  private ring = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: HiveShellSettings = defaultHiveShell()) {
    this.settings = settings;
    this.group.add(this.dome.mesh, this.honey.mesh, this.stings.mesh, this.pop.mesh, this.ring.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return GROW_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.from).setY(0);
  }

  play() {
    this.reset();
    this.playing = true;
    this.seen = this.ctx ? shellStings.get(this.ctx.caster) ?? 0 : 0;
    this.dome.dome(this.center, RADIUS, HEIGHT, GROW_T, 34, 0.42);
    this.honey.burst(this.v1.copy(this.center).setY(0.3), 6, 3, 0.13, 2.5);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.grown = this.flags.crumble = false;
    this.starAt = -1;
    this.dome.reset();
    this.honey.reset();
    this.stings.reset();
    this.pop.set(this.center, 0, 0);
    this.ring.set(this.center, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.dome.update(dt);
    this.honey.update(dt);
    this.stings.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time, ctx = this.ctx;
    // He walks; the dome walks with him.
    const c = ctx?.caster.group.position;
    if (c) {
      this.center.set(c.x, 0, c.z);
      this.dome.setCenter(this.center);
    }
    if (!this.flags.grown && t >= GROW_T) {
      this.flags.grown = true;
      this.shake = 0.12;
    }
    const g = THREE.MathUtils.clamp(t / 0.4, 0, 1);
    this.ring.set(this.center, 0.5 + 1.6 * g, 0.02 * (1 - g) * (1 - g));
    if (!this.flags.crumble && t >= SHELL_SECONDS) {
      this.flags.crumble = true;
      this.dome.crumble(0.45);
    }

    // A sting: the trait's count rose, so a few wasps leave the dome for the enemy.
    const n = ctx ? shellStings.get(ctx.caster) ?? 0 : 0;
    if (ctx && n > this.seen && t < SHELL_SECONDS) {
      this.seen = n;
      let foe: THREE.Vector3 | null = null, bd = Infinity;
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const d = Math.hypot(e.group.position.x - this.center.x, e.group.position.z - this.center.z);
        if (d < bd) { bd = d; foe = e.group.position; }
      }
      if (foe) {
        this.v1.set(this.center.x, 1.3, this.center.z);
        this.v2.set(foe.x, 1.2, foe.z);
        this.stings.radius = 0.35;
        this.stings.set(this.v1, 0.35, 4);
        this.stings.stream(this.v1, this.v2, STING_FLY, 0.6);
        this.starAt = t + STING_FLY;
        this.starPos.copy(this.v2);
      }
    }
    if (this.starAt >= 0 && t - this.starAt > 0.3) {
      this.stings.scatter(0.3, false, 2);
      this.pop.set(this.starPos, 0, 0);
      this.starAt = -1;
    }
    if (this.starAt >= 0) {
      const sp = StarBurst.pop(t - this.starAt, 0, 0.02);
      this.pop.set(this.starPos, 0.7 * sp.scale, sp.opacity, 0.2);
    }
  }
}

export const hiveShellModule: EffectModule = {
  label: 'hive shell',
  category: 'hero: hive',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new HiveShell(),
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as HiveShell;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    f.add((effect as HiveShell).settings, 'loop');
  },
};
