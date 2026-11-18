import * as THREE from 'three';
import { ShockRefraction, StarBurst } from '../../../effects/parts';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import { Cracks, Puffs, Ripple, SUMO, SUMO_CSS } from '../parts';
import { RING_RADIUS, STOMP_DAMAGE, STOMP_RADIUS, STOMP_SLOW, STOMP_WIND, bookOf } from '../trait';
import { fightNow } from '../../../fightClock';

/**
 * Stomp (sumo kit, W: the ring). A 3 m circle shows round him from the cast (the telegraph). Over the 0.5 s wind-up he settles his
 * weight (small puffs lift off the floor at 0.15 s and 0.32 s, the red circle closes in). At 0.5 s his foot comes down: everyone
 * inside the circle at that moment (live positions) takes 50 and is slowed 1 s (`knock: 0`); seven cracks run out across the floor
 * (dark seams with a red glow), a ring of dust rolls out, a pale star pops at his feet, a refraction ring runs out and the floor
 * shakes. Then the DOHYO is stamped: a red and a pale ripple run out to 5 m and the straw ring takes the floor (`Trait.marks` in
 * `../trait.ts`, drawn from the record this spell writes). Only one ring stands: a new Stomp replaces it. The cracks close from
 * 1.1 s; clean by about 1.7 s. The circle and the ring are centred where he stood at the cast (`sentFrom`), the same on both screens,
 * and both write the same record. See pipeline/designs/kit-sumo.md.
 *
 * On the spell blocks (docs/pipeline/hero-framework.md): a zone round him (a circle), judged once; the ring is the hook.
 */

const HIT_T = STOMP_WIND;
const CLOSE_T = 1.1;

const easeOut = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

class StompLook implements Look<null, 'slow'> {
  private flags = { lift1: false, lift2: false, hit: false, close: false };
  private center = new THREE.Vector3();

  private cracks = new Cracks(7);
  private dust = new Puffs(44);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: SUMO.core, core: SUMO.hot, additive: false });
  private red = new Ripple(SUMO.body, 0.08);
  private pale = new Ripple(SUMO.hot, 0.1);
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(group: THREE.Group) {
    group.add(this.cracks.mesh, this.dust.mesh, this.pop.mesh, this.red.mesh, this.pale.mesh, this.shock.mesh);
  }

  cast(c: Cast<null, 'slow'>) {
    this.center.copy(c.from);
  }

  reset() {
    const f = this.flags;
    f.lift1 = f.lift2 = f.hit = f.close = false;
    this.cracks.reset();
    this.dust.reset();
    this.pop.set(this.center, 0, 0);
    this.red.set(this.center, 0, 0);
    this.pale.set(this.center, 0, 0);
    this.shock.set(this.center, 0, 0);
  }

  /** The old file aged its cracks and dust every frame, playing or not. */
  tick(dt: number) {
    this.cracks.update(dt);
    this.dust.update(dt);
  }

  idle(dt: number) {
    this.tick(dt);
  }

  /** Wind-up: he settles his weight; the dust lifts a little, twice; the red circle closes in on his feet. */
  frame(_c: Cast<null, 'slow'>, t: number) {
    const f = this.flags, c = this.center;
    if (!f.lift1 && t >= 0.15) { f.lift1 = true; this.dust.burst(this.v1.copy(c), 6, 1.6, 0.3, 0.9); }
    if (!f.lift2 && t >= 0.32) { f.lift2 = true; this.dust.burst(this.v1.copy(c), 8, 2.2, 0.38, 1.1); }
    if (t < HIT_T) {
      const k = t / HIT_T;
      this.red.set(c, STOMP_RADIUS * (1 - 0.8 * k * k), 0.55 * k);
    }
  }

  /** 0.5 The foot comes down (before the hits): the cracks, the dust. */
  impacting(cast: Cast<null, 'slow'>) {
    this.flags.hit = true;
    cast.shake = 0.7;
    this.cracks.grow(this.center, STOMP_RADIUS + 0.4, 0.14);
    this.dust.burst(this.v1.copy(this.center), 26, 5.2, 0.7, 0.5);
  }

  after(cast: Cast<null, 'slow'>, t: number) {
    const f = this.flags, c = this.center;
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
      cast.shake = 0.7 * Math.exp(-a * 8);
    }
  }
}

export const stompModule = spell<null, 'slow'>({
  label: 'stomp',
  category: 'hero: sumo',
  // The AI casts it when the enemy is within this radius less 0.6 m (3 m).
  targeting: { mode: 'self', radius: STOMP_RADIUS + 0.6 },
  seconds: 1.7,
  state: () => null,
  rules: {
    windup: HIT_T,
    shape: { kind: 'zone', area: (c) => ({ kind: 'circle', x: c.from.x, z: c.from.z, radius: STOMP_RADIUS }) },
    hit: { damage: STOMP_DAMAGE, knock: 0, color: SUMO_CSS.core, status: { kind: 'slow', seconds: 'slow' } },
    warn: 0,
    on: {
      // The dohyo: one ring at a time, centred where he stood.
      impact: (c) => {
        if (c.ctx) bookOf(c.ctx.caster).ring = { x: c.from.x, z: c.from.z, bornAt: fightNow(), radius: RING_RADIUS };
      },
    },
  },
  // Seconds of slow.
  tune: { slow: [STOMP_SLOW, 0, 3, 0.1] },
  noScreen: true,
  look: StompLook,
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frame: 3,
  maxDamage: 120,
});
