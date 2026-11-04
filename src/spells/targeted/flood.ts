import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Bubbles, Drops, JANITOR, JANITOR_CSS, Ripples, Words } from '../../effects/parts/janitor';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FLOOD_LIFE, FLOOD_RADIUS, FLOOD_WARN, addWet } from '../../traits/janitor';

/**
 * Flood (janitor kit v5, R: the whole floor wet, `self` mode, label 'flood'). Gus pulls the plug of a pipe somewhere: for a second
 * the floor round him gurgles (the 1 s warning: bubbles well up across the 7 m disc, rings of water run in toward him, GLUG, and the
 * red telegraph shows the disc), then at 1.0 s a wave bursts out from his feet to the edge of the disc, a geyser of water leaps, and
 * the whole disc is wet for 5 s (`addWet`, a disc written on both screens at that moment, drawn by the trait's `marks`). The effect
 * deals no damage. He surfs on it: the trait gives him haste 35% (`afterCast`/`tick`) and his Q deals 60 (`castMods`) for those
 * 5 s, and a ring at his feet shows the surf on both screens; here spray and bubbles follow him wherever he goes. When it is over the
 * water drains away in a spiral of rings. The disc's centre is `sentFrom`, so both screens agree. The telegraph is the disc, impact
 * at the flood (he is rooted for the warning, which is the price of the spell and the moment a player reads: leave before it floods).
 * Clean by about 7 s. See pipeline/designs/kit-janitor.md.
 */
export interface FloodSettings {
  loop: boolean;
}

export const defaultFlood = (): FloodSettings => ({ loop: false });

// Timeline (seconds).
const FLOOD_T = FLOOD_WARN;
const END_T = FLOOD_T + FLOOD_LIFE;
const DURATION = END_T + 1.2;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class Flood implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FloodSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly centre = new THREE.Vector3(0, 0, 4);
  private time = 0;
  private flooded = false;
  private drained = false;
  private welled = 0;
  private ringT = 0;
  private sprayT = 0;
  private glug = false;

  private ripples = new Ripples(18);
  private drops = new Drops(110);
  private bubbles = new Bubbles(90);
  private words = new Words(2);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: JANITOR.pale, core: JANITOR.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();

  constructor(settings: FloodSettings = defaultFlood()) {
    this.settings = settings;
    this.group.add(this.ripples.mesh, this.drops.mesh, this.bubbles.mesh, this.words.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FLOOD_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the disc: only sentFrom.
    const s = ctx.sentFrom ?? ctx.from;
    this.centre.set(s.x, 0, s.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flooded = this.drained = this.glug = false;
    this.welled = this.ringT = this.sprayT = 0;
    this.ripples.reset();
    this.drops.reset();
    this.bubbles.reset();
    this.words.reset();
    this.pop.set(this.centre, 0, 0);
    this.shock.set(this.centre, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.ripples.update(dt);
    this.drops.update(dt);
    this.bubbles.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, C = this.centre, ctx = this.ctx;
    if (t >= DURATION && !this.drops.busy && !this.bubbles.busy && !this.words.busy && !this.ripples.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The warning: the floor gurgles. Bubbles well up across the disc, thicker toward the flood; rings of water run inward. ---
    if (t < FLOOD_T) {
      const k = t / FLOOD_T;
      this.welled += dt * (18 + 70 * k * k);
      while (this.welled >= 1) {
        this.welled -= 1;
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * FLOOD_RADIUS;
        this.v1.set(C.x + Math.cos(a) * d, 0.05, C.z + Math.sin(a) * d);
        this.bubbles.emit(this.v1, 1, 0.1, 0.15, 0.7);
        if (Math.random() < 0.3) this.drops.burst(this.v1, 1, 0.8, 2.4, 0.05);
      }
      this.ringT += dt;
      if (this.ringT >= 0.3) {
        this.ringT = 0;
        this.ripples.fire(C.x, C.z, FLOOD_RADIUS, 0.8, 0.5, 0.5, JANITOR.pale);
      }
      // The rim of the disc: a pale ring that grows brighter toward the flood.
      if (Math.random() < 0.5) this.ripples.fire(C.x, C.z, FLOOD_RADIUS * 0.98, FLOOD_RADIUS, 0.12, 0.25 + 0.5 * k, JANITOR.foam);
      this.shake = Math.max(this.shake, 0.03 + 0.05 * k);
      if (!this.glug && t >= 0.25) {
        this.glug = true;
        this.v1.set(C.x, 2.6, C.z);
        this.words.show('GLUG', this.v1, 0.7, 0.9, JANITOR_CSS.pale);
      }
    }

    // --- The flood: a wave from his feet to the edge, a geyser, the words. ---
    if (!this.flooded && t >= FLOOD_T) {
      this.flooded = true;
      if (ctx) {
        const now = performance.now();
        addWet(ctx.caster, { kind: 'flood', x: C.x, z: C.z, yaw: 0, length: 0, r: FLOOD_RADIUS, bornAt: now, until: now + FLOOD_LIFE * 1000 });
      }
      this.ripples.fire(C.x, C.z, 0.5, FLOOD_RADIUS, 0.55, 0.9, JANITOR.foam, true);
      this.ripples.fire(C.x, C.z, 0.3, FLOOD_RADIUS * 0.8, 0.7, 0.6, JANITOR.pale);
      this.ripples.fire(C.x, C.z, 0.2, FLOOD_RADIUS * 1.05, 0.8, 0.5, JANITOR.water);
      this.drops.burst(this.v1.set(C.x, 0.2, C.z), 40, 4.5, 8.5, 0.12);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        this.drops.burst(this.v1.set(C.x + Math.cos(a) * 1.4, 0.2, C.z + Math.sin(a) * 1.4), 3, 3.4, 4.5, 0.08);
      }
      this.bubbles.emit(this.v1.set(C.x, 0.2, C.z), 30, FLOOD_RADIUS * 0.8, 0.22, 1.4);
      this.shock.set(C, 0.5 + 4, 0.05);
      this.pop.set(this.v1.set(C.x, 1.2, C.z), 2.6, 1, 0.2);
      this.words.show('WET FLOOR', this.v1.set(C.x, 3.0, C.z), 1.1, 1.8);
      this.shake = 0.4;
    }
    if (this.flooded) {
      const a = t - FLOOD_T;
      const sp = StarBurst.pop(a, 0.05, 0.2);
      this.pop.set(this.v1.set(C.x, 1.2, C.z), 2.6 * sp.scale, sp.opacity, a * 3);
      this.shock.set(C, 0.5 + 6.5 * easeOut(a / 0.6), 0.04 * Math.max(0, 1 - a / 0.6));
      this.shake = Math.max(this.shake * Math.exp(-dt * 8), 0.4 * Math.exp(-a * 7));
      // While it lasts: whitecaps along the rim and spray, and spray at his feet wherever he surfs.
      if (t < END_T) {
        this.sprayT += dt;
        if (this.sprayT >= 0.07) {
          this.sprayT = 0;
          const ang = Math.random() * Math.PI * 2;
          this.v1.set(C.x + Math.cos(ang) * FLOOD_RADIUS * 0.96, 0.05, C.z + Math.sin(ang) * FLOOD_RADIUS * 0.96);
          this.bubbles.emit(this.v1, 1, 0.3, 0.2, 0.5);
          if (Math.random() < 0.5) this.drops.burst(this.v1, 1, 0.8, 2.6, 0.06);
          if (ctx) {
            const p = ctx.caster.group.position;
            this.v1.set(p.x, 0.15, p.z);
            this.drops.burst(this.v1, 2, 1.6, 2.4, 0.06);
            if (Math.random() < 0.5) this.bubbles.emit(this.v1, 1, 0.5, 0.15, 0.8);
          }
        }
      }
    }

    // --- Draining: rings run in toward the middle, the last bubbles pop. ---
    if (!this.drained && t >= END_T) {
      this.drained = true;
      this.ripples.fire(C.x, C.z, FLOOD_RADIUS, 0.6, 0.9, 0.6, JANITOR.pale, true);
      this.ripples.fire(C.x, C.z, FLOOD_RADIUS * 0.7, 0.3, 0.8, 0.5, JANITOR.foam);
      this.bubbles.emit(this.v1.set(C.x, 0.1, C.z), 12, 2.0, 0.18, 0.8);
    }
  }
}

export const floodModule: EffectModule = {
  label: 'flood',
  category: 'hero: janitor',
  // Self-cast: the disc is centred on him and the radius is the reach the CPU judges it by.
  targeting: { mode: 'self', radius: FLOOD_RADIUS },
  create: () => new Flood(),
  telegraphs(effect) {
    const e = effect as Flood;
    if (!e.ctx) return [];
    // The disc that will flood: it roots him for the warning second.
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: FLOOD_RADIUS }, start: 0.04, impact: FLOOD_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Flood;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Flood).settings;
    f.add(s, 'loop');
  },
};
