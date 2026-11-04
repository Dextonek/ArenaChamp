import * as THREE from 'three';
import { Emitter } from '../../emitter';
import type { Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Palm, Puffs, Ripple, SUMO, SUMO_CSS } from '../../effects/parts/sumo';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { PALM_DAMAGE, PALM_PUSH, PALM_PUSH_TIME, PALM_REACH, PALM_WIDTH, PALM_WIND, bookOf } from '../../traits/sumo';

/**
 * Palm Strike (sumo kit, Q: a slap you can feel). No aim of its own: it goes the way he faces. A 2.8 m by 2 m strip shows in front
 * of him from the cast (the telegraph). Over the 0.4 s wind-up a huge open hand fades in beside him and is drawn back, growing; at 0.4 s
 * it is thrown forward in one beat, and everyone inside the strip at that moment (live positions) takes 40 and is shoved 3 m along
 * his facing over 0.22 s (`ctx.carry`, `knock: 0`). The hit has a pale star, a ground ripple and refraction ring, a roll of dust
 * and a hard shake. The shove opens a push window on his record (`bookOf(...).pushUntil`): a body carried out of his ring in it
 * is a ring-out (`victimTick` in `src/traits/sumo.ts`, on the screen that decides that hero). Clean by about 1.3 s.
 *
 * Network duels: the strip is built from `sentFrom` and the caster's facing, the same on both screens; the carry moves only the hero
 * that screen decides (`ctx.carry` does nothing to the other player's figure), judged by its live position. See pipeline/designs/kit-sumo.md.
 */
export interface PalmStrikeSettings {
  damage: number;
  /** Metres the hit shoves along his facing. */
  push: number;
  loop: boolean;
}

export const defaultPalmStrike = (): PalmStrikeSettings => ({ damage: PALM_DAMAGE, push: PALM_PUSH, loop: false });

// Timeline (seconds).
const HIT_T = PALM_WIND;
const THROW_T = 0.07;
const DURATION = 1.3;
const HAND_Y = 1.25;

const easeOut = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

export class PalmStrike implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PalmStrikeSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly strip: Extract<TelegraphShape, { kind: 'line' }> = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: PALM_REACH, width: PALM_WIDTH };
  private time = 0;
  private hit = false;
  private yaw = 0;
  private start = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private back = new THREE.Vector3();
  private front = new THREE.Vector3();
  private caught: Enemy[] = [];
  private pushAge = 0;
  private pushed = 0;
  private pushing = false;

  private palm = new Palm();
  private dust = new Puffs(24);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: SUMO.core, core: SUMO.hot, additive: false });
  private ripple = new Ripple(SUMO.hot, 0.12);
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(settings: PalmStrikeSettings = defaultPalmStrike()) {
    this.settings = settings;
    this.group.add(this.palm.mesh, this.dust.mesh, this.pop.mesh, this.ripple.mesh, this.shock.mesh);
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
    const s = ctx.sentFrom ?? ctx.from;
    // A quick spell goes the way he faces (`ctx.aim` is 0 for the CPU).
    this.yaw = ctx.caster.group.rotation.y;
    this.dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.start.set(s.x, 0, s.z);
    const st = this.strip;
    st.x1 = s.x;
    st.z1 = s.z;
    st.x2 = s.x + this.dir.x * PALM_REACH;
    st.z2 = s.z + this.dir.z * PALM_REACH;
    // The hand starts beside him, right of centre, is drawn back, then thrown to the end of the strip.
    this.back.set(s.x + this.dir.z * 0.55 - this.dir.x * 0.1, HAND_Y, s.z - this.dir.x * 0.55 - this.dir.z * 0.1);
    this.front.set(s.x + this.dir.x * (PALM_REACH - 0.6), HAND_Y, s.z + this.dir.z * (PALM_REACH - 0.6));
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hit = false;
    this.caught = [];
    this.pushing = false;
    this.pushAge = 0;
    this.pushed = 0;
    this.palm.set(this.back, this.yaw, 0, 0);
    this.dust.reset();
    this.pop.set(this.front, 0, 0);
    this.ripple.set(this.front, 0, 0);
    this.shock.set(this.front, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
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
    const t = this.time, ctx = this.ctx;

    // --- Wind-up: the hand fades in, is drawn back and grows; then it is thrown. ---
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

    // --- 0.4 The slap: everyone inside the strip now (live positions) is hit and shoved. ---
    if (!this.hit && t >= HIT_T) {
      this.hit = true;
      this.shake = 0.5;
      this.v1.copy(this.front).setY(0.1).addScaledVector(this.dir, 0.4);
      this.dust.burst(this.v1, 11, 4.2, 0.55, 0.6, 2.2, this.yaw);
      if (ctx) {
        for (const e of ctx.enemies?.() ?? ctx.targets) {
          const p = e.group.position;
          if (!insideTelegraph(this.strip, p.x, p.z)) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 0, color: SUMO_CSS.core, from: this.start.clone() });
          this.caught.push(e);
        }
        if (this.caught.length) {
          this.pushing = true;
          // A shove of his is under way: a body carried out of his ring inside this window is a ring-out.
          bookOf(ctx.caster).pushUntil = performance.now() + (PALM_PUSH_TIME + 0.2) * 1000;
        }
      }
    }
    if (this.pushing && ctx?.carry) {
      this.pushAge += dt;
      const d = this.settings.push * easeOut(this.pushAge / PALM_PUSH_TIME), step = d - this.pushed;
      this.pushed = d;
      for (const e of this.caught) ctx.carry(e, this.v1.set(this.dir.x * step, 0, this.dir.z * step));
      if (this.pushAge >= PALM_PUSH_TIME) this.pushing = false;
    }

    if (this.hit) {
      const a = t - HIT_T;
      const sp = StarBurst.pop(a, 0.03, 0.14);
      this.pop.set(this.v1.copy(this.front).setY(HAND_Y).addScaledVector(this.dir, 0.5), 2.2 * sp.scale, sp.opacity, a * 3);
      const gp = easeOut(a / 0.4);
      this.ripple.set(this.v1.copy(this.front).addScaledVector(this.dir, 0.4), 0.4 + 2.2 * gp, 0.8 * (1 - gp));
      this.shock.set(this.v1.copy(this.front).setY(0), 0.5 + 2.4 * gp, 0.05 * (1 - gp) * (1 - gp));
      this.shake = 0.5 * Math.exp(-a * 10);
    }
  }
}

export const palmStrikeModule: EffectModule = {
  label: 'palm strike',
  category: 'hero: sumo',
  // The AI casts it when the enemy is within this radius less 0.6 m (2.8 m).
  targeting: { mode: 'self', radius: PALM_REACH + 0.6 },
  create: () => new PalmStrike(),
  telegraphs(effect) {
    const e = effect as PalmStrike;
    return e.ctx ? [{ shape: e.strip, start: 0, impact: HIT_T, until: HIT_T + 0.1 }] : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as PalmStrike;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as PalmStrike).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
    f.add(s, 'push', 0, 6, 0.1);
  },
};
