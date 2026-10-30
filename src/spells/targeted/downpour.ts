import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  LightningTree, Puddles, RainSheet, Sparks, StormCloud, STORM, STORM_CSS,
} from '../../effects/parts/storm';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Downpour (storm kit, W: zone). A dark storm cloud gathers high over the point while slanting rain falls inside the
 * circle and ripples spread on the wet floor. At the hit three lightning trees strike down out of the cloud at once,
 * into the enemies inside (else random spots); the cloud underside flashes and the ground forks. One more bolt hits
 * the centre a beat later. Then the rain thins, the cloud breaks up and the floor dries. See
 * pipeline/designs/kit-storm.md.
 */
export interface DownpourSettings {
  /** Damage of the first volley; the centre bolt does `damage2`. */
  damage: number;
  damage2: number;
  /** Seconds of slow on the first volley's hit. */
  slow: number;
  loop: boolean;
}

export const defaultDownpour = (): DownpourSettings => ({ damage: 40, damage2: 15, slow: 1, loop: false });

// Timeline (seconds).
const GATHER_T = 0.0;
const GATHER_END = 0.4;
const HIT_T = 0.7;
const CENTRE_T = 1.3;
const THIN_T = 1.4;
const DURATION = 2.3;
const RADIUS = 4;
const CLOUD_Y = 5;

export class Downpour implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DownpourSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private base = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private centre = new THREE.Vector3(0, 0, -6);
  private spots: THREE.Vector3[] = [];

  private flags = { sparks: false, gather: false, rain: false, wet: false, hit: false, centre: false, thin: false };
  private sparkTimer = 0;
  private pulseAt = [-9, -9];

  // Parts.
  private cloud = new StormCloud(60);
  private rain = new RainSheet(150);
  private puddles = new Puddles();
  private tree = new LightningTree(8);
  private sparks = new Sparks(80);

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: DownpourSettings = defaultDownpour()) {
    this.settings = settings;
    this.screen.tint.set(STORM.dark);
    this.rain.height = CLOUD_Y + 0.5;
    this.rain.slant = 0.3;
    this.group.add(this.puddles.mesh, this.rain.mesh, this.cloud.mesh, this.tree.mesh, this.sparks.mesh);
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
    this.from.copy(ctx.from).setY(0);
    this.centre.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.base.copy(ctx.from).addScaledVector(this.fwd, 0.45).setY(0.95);
    this.tip.copy(ctx.from).addScaledVector(this.fwd, 0.75).setY(1.95);
    // Three strike spots: enemies inside first, the rest random inside the circle.
    this.spots.length = 0;
    ctx.targets.forEach((_, i) => {
      const p = ctx.targetPos[i];
      if (p && this.spots.length < 3 && Math.hypot(p.x - this.centre.x, p.z - this.centre.z) <= RADIUS) this.spots.push(p.clone().setY(0));
    });
    let k = 0;
    while (this.spots.length < 3) {
      const a = (k++ / 3) * Math.PI * 2 + Math.random() * 1.2, r = (0.35 + Math.random() * 0.5) * RADIUS;
      this.spots.push(new THREE.Vector3(this.centre.x + Math.cos(a) * r, 0, this.centre.z + Math.sin(a) * r));
    }
    this.screen.focus.copy(this.centre).setY(2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.sparkTimer = 0;
    this.pulseAt[0] = this.pulseAt[1] = -9;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(STORM.dark);
    this.cloud.reset();
    this.rain.reset();
    this.puddles.reset();
    this.tree.reset();
    this.sparks.reset();
  }

  /** One bolt from the cloud underside down to `to`, with forks into the ground, ripples and sparks. */
  private bolt(to: THREE.Vector3, width: number) {
    this.v1.set(to.x + (Math.random() - 0.5) * 0.8, CLOUD_Y - 0.1, to.z + (Math.random() - 0.5) * 0.8);
    this.v2.set(to.x, 0.05, to.z);
    this.tree.strike(this.v1, this.v2, 4, width, 0.6, { hold: 0.4, groundForks: 3, grow: 0.06, levels: 2, jag: 1.4 });
    this.puddles.ripple(this.v2, 1.9);
    this.sparks.burst(this.v1.set(to.x, 0.5, to.z), 8, 5);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.cloud.update(dt);
    this.rain.update(dt);
    this.puddles.update(dt);
    this.tree.update(dt);
    this.sparks.update(dt);
    this.time += dt;
    const ctx = this.ctx;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    // She raises the staff: crackle along it.
    if (t < 0.45) {
      this.sparkTimer += dt;
      while (this.sparkTimer >= 0.06) {
        this.sparkTimer -= 0.06;
        this.sparks.along(this.base, this.tip, 2, 2.4);
      }
    }
    if (!f.gather && t >= GATHER_T + 0.02) {
      f.gather = true;
      this.cloud.gather(this.centre, RADIUS, CLOUD_Y, GATHER_END - GATHER_T);
    }
    if (!f.rain && t >= 0.15) {
      f.rain = true;
      this.rain.fall(this.centre, RADIUS, 0, 0.85);
      this.puddles.drizzle(this.centre, RADIUS - 0.4, 12);
    }
    if (!f.wet && t >= 0.3) {
      f.wet = true;
      this.puddles.wet(this.centre, RADIUS * 0.95);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.pulseAt[0] = HIT_T;
      for (const s of this.spots) this.bolt(s, 0.25);
      this.shake = 0.35;
      if (ctx) {
        // Re-check at impact: whoever stands in the circle now.
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.centre.x, p.z - this.centre.z) <= RADIUS) {
            ctx.hit(e, { damage: this.settings.damage, knock: 0, color: STORM_CSS.body, status: { kind: 'slow', seconds: this.settings.slow } });
          }
        }
      }
    }
    if (!f.centre && t >= CENTRE_T) {
      f.centre = true;
      this.pulseAt[1] = CENTRE_T;
      this.bolt(this.centre, 0.3);
      this.shake = 0.25;
      if (ctx) {
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.centre.x, p.z - this.centre.z) <= RADIUS) {
            ctx.hit(e, { damage: this.settings.damage2, knock: 0, color: STORM_CSS.body });
          }
        }
      }
    }
    if (!f.thin && t >= THIN_T) {
      f.thin = true;
      this.rain.stop();
      this.cloud.disperse(0.7);
      this.puddles.dry(0.7);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;

    // Cold darken so the pale rain and the blue bolts read.
    this.screen.darken = 0.35 * smoothstep((t - 0.05) / 0.35) * (1 - smoothstep((t - THIN_T) / 0.8));

    // The cloud underside flashes with each volley.
    let flash = 0;
    for (const at of this.pulseAt) {
      const k = (t - at) / 0.35;
      if (k >= 0 && k < 1) flash = Math.max(flash, (1 - k) * (1 - k));
    }
    this.cloud.flash = flash;

    let sh = 0;
    for (const [i, at] of this.pulseAt.entries()) if (t >= at) sh = Math.max(sh, (i === 0 ? 0.35 : 0.25) * Math.exp(-(t - at) * 12));
    this.shake = sh;
  }
}

export const downpourModule: EffectModule = {
  label: 'downpour',
  category: 'hero: storm',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Downpour(),
  telegraphs(effect) {
    const e = effect as Downpour;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Downpour;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as Downpour).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'damage2', 0, 60, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
