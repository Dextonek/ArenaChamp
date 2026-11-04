import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Cracks, Puffs, Ripple, SUMO, SUMO_CSS } from '../../effects/parts/sumo';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { RING_RADIUS, STOMP_DAMAGE, STOMP_RADIUS, STOMP_SLOW, STOMP_WIND, bookOf } from '../../traits/sumo';

/**
 * Stomp (sumo kit, W: the ring). A 3 m circle shows round him from the cast (the telegraph). Over the 0.5 s wind-up he settles his
 * weight (small puffs lift off the floor at 0.15 s and 0.32 s, the red circle closes in). At 0.5 s his foot comes down: everyone
 * inside the circle at that moment (live positions) takes 40 and is slowed 1 s (`knock: 0`); seven cracks run out across the floor
 * (dark seams with a red glow), a ring of dust rolls out, a pale star pops at his feet, a refraction ring runs out and the floor
 * shakes. Then the DOHYO is stamped: a red and a pale ripple run out to 5 m and the straw ring takes the floor (`Trait.marks` in
 * `src/traits/sumo.ts`, drawn from the record this effect writes). Only one ring stands: a new Stomp replaces it. The cracks close from
 * 1.1 s; clean by about 1.7 s. The circle and the ring are centred where he stood at the cast (`sentFrom`), the same on both screens,
 * and both write the same record. See pipeline/designs/kit-sumo.md.
 */
export interface StompSettings {
  damage: number;
  /** Seconds of slow. */
  slow: number;
  loop: boolean;
}

export const defaultStomp = (): StompSettings => ({ damage: STOMP_DAMAGE, slow: STOMP_SLOW, loop: false });

// Timeline (seconds).
const HIT_T = STOMP_WIND;
const CLOSE_T = 1.1;
const DURATION = 1.7;

const easeOut = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

export class Stomp implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StompSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly circle: Extract<TelegraphShape, { kind: 'circle' }> = { kind: 'circle', x: 0, z: 0, radius: STOMP_RADIUS };
  private time = 0;
  private flags = { lift1: false, lift2: false, hit: false, close: false };
  private center = new THREE.Vector3();

  private cracks = new Cracks(7);
  private dust = new Puffs(44);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: SUMO.core, core: SUMO.hot, additive: false });
  private red = new Ripple(SUMO.body, 0.08);
  private pale = new Ripple(SUMO.hot, 0.1);
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(settings: StompSettings = defaultStomp()) {
    this.settings = settings;
    this.group.add(this.cracks.mesh, this.dust.mesh, this.pop.mesh, this.red.mesh, this.pale.mesh, this.shock.mesh);
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
    this.center.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.circle.x = this.center.x;
    this.circle.z = this.center.z;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.lift1 = f.lift2 = f.hit = f.close = false;
    this.cracks.reset();
    this.dust.reset();
    this.pop.set(this.center, 0, 0);
    this.red.set(this.center, 0, 0);
    this.pale.set(this.center, 0, 0);
    this.shock.set(this.center, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.cracks.update(dt);
    this.dust.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, ctx = this.ctx, c = this.center;

    // --- Wind-up: he settles his weight; the dust lifts a little, twice. ---
    if (!f.lift1 && t >= 0.15) { f.lift1 = true; this.dust.burst(this.v1.copy(c), 6, 1.6, 0.3, 0.9); }
    if (!f.lift2 && t >= 0.32) { f.lift2 = true; this.dust.burst(this.v1.copy(c), 8, 2.2, 0.38, 1.1); }
    if (t < HIT_T) {
      // The red circle closes in on his feet as the weight comes down.
      const k = t / HIT_T;
      this.red.set(c, STOMP_RADIUS * (1 - 0.8 * k * k), 0.55 * k);
    }

    // --- 0.5 The foot comes down: the hit, the cracks, the dust, the ring. ---
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.7;
      this.cracks.grow(c, STOMP_RADIUS + 0.4, 0.14);
      this.dust.burst(this.v1.copy(c), 26, 5.2, 0.7, 0.5);
      if (ctx) {
        // Everyone inside the circle now, wherever the cast was aimed (live positions).
        for (const e of ctx.enemies?.() ?? ctx.targets) {
          const p = e.group.position;
          if (!insideTelegraph(this.circle, p.x, p.z)) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 0, color: SUMO_CSS.core, from: c.clone(), status: { kind: 'slow', seconds: this.settings.slow } });
        }
        // The dohyo: one ring at a time, centred where he stood.
        bookOf(ctx.caster).ring = { x: c.x, z: c.z, bornAt: performance.now(), radius: RING_RADIUS };
      }
    }
    if (f.hit && !f.close && t >= CLOSE_T) {
      f.close = true;
      this.cracks.fade(0.5);
    }

    if (f.hit) {
      const a = t - HIT_T;
      const sp = StarBurst.pop(a, 0.03, 0.16);
      this.pop.set(this.v1.copy(c).setY(0.9), 2.6 * sp.scale, sp.opacity, a * 3);
      // Two ripples run out to the rope: red first, then pale behind it.
      const rp = easeOut(a / 0.4), pp = easeOut((a - 0.06) / 0.4);
      this.red.set(c, 0.4 + (RING_RADIUS - 0.4) * rp, 0.85 * (1 - rp * rp));
      this.pale.set(c, 0.3 + (RING_RADIUS - 0.5) * pp, 0.75 * (1 - pp * pp));
      const gp = easeOut(a / 0.45);
      this.shock.set(c, 0.6 + (STOMP_RADIUS + 0.6) * gp, 0.06 * (1 - gp) * (1 - gp));
      this.shake = 0.7 * Math.exp(-a * 8);
    }
  }
}

export const stompModule: EffectModule = {
  label: 'stomp',
  category: 'hero: sumo',
  // The AI casts it when the enemy is within this radius less 0.6 m (3 m).
  targeting: { mode: 'self', radius: STOMP_RADIUS + 0.6 },
  create: () => new Stomp(),
  telegraphs(effect) {
    const e = effect as Stomp;
    return e.ctx ? [{ shape: e.circle, start: 0, impact: HIT_T }] : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as Stomp;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Stomp).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
    f.add(s, 'slow', 0, 3, 0.1);
  },
};
