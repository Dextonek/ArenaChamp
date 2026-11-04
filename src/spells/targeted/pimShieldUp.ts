import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Confetti, ToyRing, ToyShield, ToyWords, TWINS, TWINS_CSS } from '../../effects/parts/twins';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SHIELD_AMOUNT, SHIELD_SECONDS } from '../../traits/twins';

/**
 * Shield Up (twins kit, Pim's E: a toy shield). Pim sticks his tongue out and the shield appears in front of him with a pop: a round
 * wooden disc, an orange rim, a yellow star, which bobs and turns a little to face whatever is coming, with three small stars
 * orbiting it. The real shield is the trait's (`afterCast`, `src/traits/twins.ts`: 50 for 2 s, drawn by the engine too): this
 * effect is the toy that goes with it. The word NOPE pops up at the cast; at 1.6 s the toy starts to wobble (the shield is about to end),
 * and at 2.0 s it shrinks away in a last pop of confetti. No damage and no zone. Clean by about 2.5 s. See pipeline/designs/kit-twins.md.
 */
export interface PimShieldUpSettings {
  /** Only shown in the tool: the shield the trait gives. */
  amount: number;
  seconds: number;
  loop: boolean;
}

export const defaultPimShieldUp = (): PimShieldUpSettings => ({ amount: SHIELD_AMOUNT, seconds: SHIELD_SECONDS, loop: false });

const POP = 0.25;
const WARN = 0.4;
const OUT = 0.35;
const DURATION = SHIELD_SECONDS + OUT + 0.4;

const easeBack = (x: number) => {
  const k = Math.min(1, Math.max(0, x)), c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};

export class PimShieldUp implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PimShieldUpSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private popped = false;
  private yaw = 0;
  private from = new THREE.Vector3();

  private shield = new ToyShield();
  private bits = new Confetti(30);
  private words = new ToyWords(2);
  private ring = new ToyRing(TWINS.pim, 0.1);
  private star = new StarBurst({ points: 8, inner: 0.3, color: TWINS.yellow, core: 0xffffff, additive: false });
  private orbit = [0, 1, 2].map((i) => new StarBurst({ points: 4, inner: 0.3, color: i % 2 ? TWINS.pom : TWINS.yellow, core: 0xffffff, additive: false }));

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: PimShieldUpSettings = defaultPimShieldUp()) {
    this.settings = settings;
    this.group.add(this.bits.mesh, this.ring.mesh, this.shield.mesh, this.words.mesh, this.star.mesh, ...this.orbit.map((o) => o.mesh));
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return 0.1;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.yaw = ctx.caster.group.rotation.y;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.popped = false;
    this.bits.reset();
    this.words.reset();
    this.shield.hide();
    this.star.set(this.from, 0, 0);
    this.ring.set(this.from, 0, 0);
    for (const o of this.orbit) o.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, s = this.settings;
    if (t >= DURATION) {
      const loop = s.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    // He walks; the shield walks with him.
    const c = this.ctx?.caster.group.position;
    if (c) this.from.set(c.x, 0, c.z);
    const yaw = this.ctx ? this.ctx.caster.group.rotation.y : this.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), end = s.seconds;

    if (t < end + OUT) {
      // Pops up with an overshoot; shrinks away at the end; wobbles in the last 0.4 s.
      const grow = easeBack(t / POP), fade = 1 - THREE.MathUtils.smoothstep(t, end, end + OUT);
      const warn = t > end - WARN && t < end ? Math.sin(t * 50) * 0.18 : 0;
      this.v1.set(this.from.x + fx * 0.85, 1.15 + Math.sin(t * 5) * 0.05, this.from.z + fz * 0.85);
      this.shield.place(this.v1, yaw, Math.max(0.01, grow * fade * 1.25), warn + Math.sin(t * 3) * 0.05);
      // Three small stars circle it.
      this.orbit.forEach((o, i) => {
        const a = t * 3.2 + (i / 3) * Math.PI * 2, r = 0.75 * grow * fade;
        this.v2.set(this.v1.x + Math.cos(a) * r * 0.9, this.v1.y + Math.sin(a) * r * 0.7, this.v1.z + Math.sin(a) * r * 0.25);
        o.set(this.v2, 0.2 * grow * fade, 1, t * 4 + i);
      });
    }

    if (t < 0.5) {
      // The first pop: a star, a ring on the floor, confetti.
      const sp = StarBurst.pop(t, 0.06, 0.2);
      this.star.set(this.v2.set(this.from.x + fx * 0.85, 1.15, this.from.z + fz * 0.85), 1.6 * sp.scale, sp.opacity, t * 4);
      const rp = THREE.MathUtils.clamp(t / 0.4, 0, 1);
      this.ring.set(this.from, 0.5 + 1.1 * rp, 0.5 * (1 - rp) * (1 - rp));
      if (!this.popped) {
        this.popped = true;
        this.shake = 0.06;
        this.bits.pop(this.v2.set(this.from.x + fx * 0.85, 1.0, this.from.z + fz * 0.85), 8, 3.5, 0.8, [TWINS.pim, TWINS.yellow, 0xffffff]);
        this.words.say('NOPE', this.v2.set(this.from.x, 0, this.from.z), 1.2, 0.8, TWINS_CSS.pim, 2.0);
      }
    }
    if (t >= end && t - dt < end) {
      // It runs out: a last little pop of confetti.
      this.bits.pop(this.v2.set(this.from.x + fx * 0.85, 1.1, this.from.z + fz * 0.85), 10, 4, 0.9);
      this.shake = 0.04;
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const pimShieldUpModule: EffectModule = {
  label: 'shield up',
  category: 'hero: twins',
  // On himself: the radius is how close an enemy must be for the CPU to raise it.
  targeting: { mode: 'self', radius: 4 },
  create: () => new PimShieldUp(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PimShieldUp;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as PimShieldUp).settings;
    f.add(s, 'loop');
    f.add(s, 'seconds', 1, 4, 0.1);
  },
};
