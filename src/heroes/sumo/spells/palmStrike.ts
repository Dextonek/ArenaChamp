import * as THREE from 'three';
import { ShockRefraction, StarBurst } from '../../../effects/parts';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import { Palm, Puffs, Ripple, SUMO, SUMO_CSS } from '../parts';
import { PALM_DAMAGE, PALM_PUSH, PALM_PUSH_TIME, PALM_REACH, PALM_WIDTH, PALM_WIND, bookOf } from '../trait';

/**
 * Palm Strike (sumo kit, Q: a slap you can feel). No aim of its own: it goes the way he faces. A 2.8 m by 2 m strip shows in front
 * of him from the cast (the telegraph). Over the 0.4 s wind-up a huge open hand fades in beside him and is drawn back, growing; at 0.4 s
 * it is thrown forward in one beat, and everyone inside the strip at that moment (live positions) takes 54 and is shoved 3 m along
 * his facing over 0.22 s (`ctx.carry`, `knock: 0`). The hit has a pale star, a ground ripple and refraction ring, a roll of dust
 * and a hard shake. The shove opens a push window on his record (`bookOf(...).pushUntil`): a body carried out of his ring in it
 * is a ring-out (`victimTick` in `../trait.ts`, on the screen that decides that hero). Clean by about 1.3 s.
 *
 * Network duels: the strip is built from `sentFrom` and the caster's facing, the same on both screens; the carry moves only the hero
 * that screen decides (`ctx.carry` does nothing to the other player's figure), judged by its live position. See pipeline/designs/kit-sumo.md.
 *
 * On the spell blocks (docs/pipeline/hero-framework.md): a zone in front of him (a strip, his facing), judged once; the shove
 * (a carry over 0.22 s) and the push window are the hooks.
 */

/** The shove of this cast: how long and how far it has carried. */
interface Shove { pushing: boolean; age: number; pushed: number; step: THREE.Vector3 }

const HIT_T = PALM_WIND;
const THROW_T = 0.07;
const HAND_Y = 1.25;

const easeOut = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

class PalmLook implements Look<Shove, 'push'> {
  private hit = false;
  private yaw = 0;
  private dir = new THREE.Vector3(0, 0, 1);
  private back = new THREE.Vector3();
  private front = new THREE.Vector3();

  private palm = new Palm();
  private dust = new Puffs(24);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: SUMO.core, core: SUMO.hot, additive: false });
  private ripple = new Ripple(SUMO.hot, 0.12);
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(group: THREE.Group) {
    group.add(this.palm.mesh, this.dust.mesh, this.pop.mesh, this.ripple.mesh, this.shock.mesh);
  }

  /** The hand starts beside him, right of centre, is drawn back, then thrown to the end of the strip. */
  cast(c: Cast<Shove, 'push'>) {
    const s = c.from;
    this.yaw = c.yaw;
    this.dir.copy(c.dir);
    this.back.set(s.x + this.dir.z * 0.55 - this.dir.x * 0.1, HAND_Y, s.z - this.dir.x * 0.55 - this.dir.z * 0.1);
    this.front.set(s.x + this.dir.x * (PALM_REACH - 0.6), HAND_Y, s.z + this.dir.z * (PALM_REACH - 0.6));
  }

  reset() {
    this.hit = false;
    this.palm.set(this.back, this.yaw, 0, 0);
    this.dust.reset();
    this.pop.set(this.front, 0, 0);
    this.ripple.set(this.front, 0, 0);
    this.shock.set(this.front, 0, 0);
  }

  /** The old file aged its dust every frame, playing or not. */
  tick(dt: number) {
    this.dust.update(dt);
  }

  idle(dt: number) {
    this.tick(dt);
  }

  /** Wind-up: the hand fades in, is drawn back and grows; then it is thrown. */
  frame(_c: Cast<Shove, 'push'>, t: number) {
    if (t < HIT_T - THROW_T) {
      const k = easeOut(t / (HIT_T - THROW_T));
      this.v1.copy(this.back).addScaledVector(this.dir, -0.45 * k);
      this.palm.set(this.v1, this.yaw, 0.7 + 0.5 * k, Math.min(1, t / 0.12));
    } else if (t < HIT_T + 0.3) {
      const k = easeOut((t - (HIT_T - THROW_T)) / THROW_T);
      this.v1.copy(this.back).addScaledVector(this.dir, -0.45).lerp(this.front, k);
      const out = Math.max(0, (t - HIT_T - 0.12) / 0.18);
      this.palm.set(this.v1, this.yaw, 1.2 + 0.5 * k, 1 - out);
    } else {
      this.palm.set(this.v1, this.yaw, 0, 0);
    }
  }

  /** 0.4 The slap (before the hits): a hard shake and a roll of dust. */
  impacting(c: Cast<Shove, 'push'>) {
    this.hit = true;
    c.shake = 0.5;
    this.v1.copy(this.front).setY(0.1).addScaledVector(this.dir, 0.4);
    this.dust.burst(this.v1, 11, 4.2, 0.55, 0.6, 2.2, this.yaw);
  }

  after(c: Cast<Shove, 'push'>, t: number) {
    if (!this.hit) return;
    const a = t - HIT_T;
    const sp = StarBurst.pop(a, 0.03, 0.14);
    this.pop.set(this.v1.copy(this.front).setY(HAND_Y).addScaledVector(this.dir, 0.5), 2.2 * sp.scale, sp.opacity, a * 3);
    const gp = easeOut(a / 0.4);
    this.ripple.set(this.v1.copy(this.front).addScaledVector(this.dir, 0.4), 0.4 + 2.2 * gp, 0.8 * (1 - gp));
    this.shock.set(this.v1.copy(this.front).setY(0), 0.5 + 2.4 * gp, 0.05 * (1 - gp) * (1 - gp));
    c.shake = 0.5 * Math.exp(-a * 10);
  }
}

export const palmStrikeModule = spell<Shove, 'push'>({
  label: 'palm strike',
  category: 'hero: sumo',
  // The AI casts it when the enemy is within this radius less 0.6 m (2.8 m).
  targeting: { mode: 'self', radius: PALM_REACH + 0.6 },
  seconds: 1.3,
  state: () => ({ pushing: false, age: 0, pushed: 0, step: new THREE.Vector3() }),
  rules: {
    windup: HIT_T,
    facing: true,
    shape: {
      kind: 'zone',
      area: (c) => ({ kind: 'line', x1: c.from.x, z1: c.from.z, x2: c.from.x + c.dir.x * PALM_REACH, z2: c.from.z + c.dir.z * PALM_REACH, width: PALM_WIDTH }),
      until: 0.1,
    },
    hit: { damage: PALM_DAMAGE, knock: 0, color: SUMO_CSS.core },
    warn: 0,
    on: {
      // A shove of his is under way: a body carried out of his ring inside this window is a ring-out.
      impact: (c) => {
        const s = c.state;
        s.pushing = false;
        s.age = s.pushed = 0;
        if (c.ctx && c.caught.length) {
          s.pushing = true;
          bookOf(c.ctx.caster).pushUntil = performance.now() + (PALM_PUSH_TIME + 0.2) * 1000;
        }
      },
      // Everyone it caught is shoved `push` m along his facing over 0.22 s.
      frame: (c, _t, dt) => {
        const s = c.state, ctx = c.ctx;
        if (!s.pushing || !ctx?.carry) return;
        s.age += dt;
        const d = c.num('push') * easeOut(s.age / PALM_PUSH_TIME), step = d - s.pushed;
        s.pushed = d;
        for (const e of c.caught) ctx.carry(e, s.step.set(c.dir.x * step, 0, c.dir.z * step));
        if (s.age >= PALM_PUSH_TIME) s.pushing = false;
      },
    },
  },
  // Metres the hit shoves along his facing.
  tune: { push: [PALM_PUSH, 0, 6, 0.1] },
  look: PalmLook,
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frame: 2,
  maxDamage: 120,
});
