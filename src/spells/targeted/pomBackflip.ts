import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Confetti, Dust, Popper, Streaks, ToyRing, ToyWords, TWINS, TWINS_CSS } from '../../effects/parts/twins';
import { frameCast, type CastContext } from '../../effects/targeting';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import { FLIP_DAMAGE, FLIP_DISTANCE, FLIP_FUSE, FLIP_RADIUS, FLIP_TIME } from '../../traits/twins';

/**
 * Backflip (twins kit, Pom's E: a hop and a surprise). Pom hops 4 m toward the aim in 0.3 s (`ctx.moveCaster`: the engine clamps it
 * into the ring and out of cover) with a trail of confetti and pale streaks, a ring of dust where she lands. Where she stood a party
 * popper is left: a blue ball with a yellow band and a lit fuse that blinks faster and faster, inside a 1.5 m circle (the telegraph,
 * shown from the cast). At 0.65 s it goes off: a star, a ring, a burst of confetti and the word POP. Whoever is inside the circle then
 * (their live position) takes 30 and is shoved back. The popper's place is `sentFrom`, so both screens agree. Network duels: the other
 * screen has no `moveCaster` (her client streams the hop), so it draws the path from `sentFrom` and the aim. Clean by about 1.6 s.
 * Built toward the aim, like every dash: the CPU's escape aim already points away from the enemy. See pipeline/designs/kit-twins.md.
 */
export interface PomBackflipSettings {
  damage: number;
  loop: boolean;
}

export const defaultPomBackflip = (): PomBackflipSettings => ({ damage: FLIP_DAMAGE, loop: false });

const DURATION = 1.6;

export class PomBackflip implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PomBackflipSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  circle: TelegraphShape = { kind: 'circle', x: 0, z: 0, radius: FLIP_RADIUS };
  private time = 0;
  private flags = { hopped: false, landed: false, popped: false };
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private lastTrail = 0;

  private popper = new Popper();
  private bits = new Confetti(48);
  private dust = new Dust(16);
  private streaks = new Streaks(16);
  private words = new ToyWords(3);
  private ring = new ToyRing(TWINS.pom, 0.12);
  private ring2 = new ToyRing(TWINS.yellow, 0.08);
  private star = new StarBurst({ points: 10, inner: 0.3, color: TWINS.pom, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: PomBackflipSettings = defaultPomBackflip()) {
    this.settings = settings;
    this.group.add(this.bits.mesh, this.dust.mesh, this.streaks.mesh, this.ring.mesh, this.ring2.mesh, this.popper.mesh, this.words.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FLIP_FUSE;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.start.set(s.x, 0, s.z);
    this.v1.set(ctx.point.x - s.x, 0, ctx.point.z - s.z);
    const d = this.v1.length();
    if (d < 0.3) this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    else this.dir.copy(this.v1).multiplyScalar(1 / d);
    this.end.copy(this.start).addScaledVector(this.dir, FLIP_DISTANCE);
    this.circle = { kind: 'circle', x: this.start.x, z: this.start.z, radius: FLIP_RADIUS };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.hopped = this.flags.landed = this.flags.popped = false;
    this.lastTrail = 0;
    this.bits.reset();
    this.dust.reset();
    this.streaks.reset();
    this.words.reset();
    this.popper.hide();
    this.star.set(this.start, 0, 0);
    this.ring.set(this.start, 0, 0);
    this.ring2.set(this.start, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    this.dust.update(dt);
    this.streaks.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, f = this.flags;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The hop: at once. She is gone from where she stood; confetti and streaks mark the path. ---
    if (!f.hopped) {
      f.hopped = true;
      this.shake = 0.06;
      if (ctx?.moveCaster) this.end.copy(ctx.moveCaster(this.end, FLIP_TIME)).setY(0);
      this.streaks.sweep(this.start, this.end, 10, 1.4, TWINS.pom);
      this.bits.spray(this.v1.copy(this.start).setY(0.8), this.dir, 8, 3, 1.0);
      this.dust.puff(this.v1.copy(this.start).setY(0.2), 0.6, 0xd9c9a8, 0.6);
      this.words.say('WHEE', this.v1.copy(this.start), 1.3, 0.8, TWINS_CSS.pom, 2.0);
    }
    if (t < FLIP_TIME && t - this.lastTrail >= 0.04) {
      this.lastTrail = t;
      const k = t / FLIP_TIME;
      this.v1.lerpVectors(this.start, this.end, k);
      this.bits.pop(this.v2.set(this.v1.x, 0.4 + Math.sin(k * Math.PI) * 1.2, this.v1.z), 2, 1.2, 0.7, [TWINS.pom, TWINS.yellow, 0xffffff]);
    }
    if (!f.landed && t >= FLIP_TIME) {
      f.landed = true;
      this.dust.ring(this.end, 0.7, 5, 0.5, 0xd9c9a8);
      this.bits.pop(this.v1.copy(this.end).setY(0.3), 5, 2.5, 0.8);
    }

    // --- The popper: it pops into place where she stood, blinks faster, then goes off. ---
    if (!f.popped) {
      const grow = Math.min(1, t / 0.15), rate = 14 + 50 * (t / FLIP_FUSE) ** 2;
      this.popper.place(this.start, 1.2 * (1 - (1 - grow) ** 3));
      this.popper.blink(t, rate);
    } else this.popper.hide();
    if (!f.popped && t >= FLIP_FUSE) {
      f.popped = true;
      this.shake = 0.2;
      this.bits.pop(this.v1.copy(this.start).setY(0.5), 22, 6, 1.2);
      this.dust.ring(this.start, FLIP_RADIUS * 0.7, 6, 0.6, 0xd9c9a8);
      this.words.say('POP', this.v1.copy(this.start), 1.7, 0.9, TWINS_CSS.yellow, 1.9);
      if (ctx) this.land(ctx);
    }
    if (f.popped) {
      const a = t - FLIP_FUSE;
      const sp = StarBurst.pop(a, 0.05, 0.18);
      this.star.set(this.v1.set(this.start.x, 0.9, this.start.z), 2.0 * sp.scale, sp.opacity, a * 5);
      const rp = THREE.MathUtils.clamp(a / 0.4, 0, 1);
      this.ring.set(this.start, 0.4 + (FLIP_RADIUS + 0.3) * rp, 0.65 * (1 - rp) * (1 - rp));
      const rq = THREE.MathUtils.clamp((a - 0.08) / 0.4, 0, 1);
      this.ring2.set(this.start, 0.3 + FLIP_RADIUS * rq, 0.5 * (1 - rq) * (1 - rq));
    }
    this.shake *= Math.exp(-dt * 12);
  }

  /** The hits, on live positions inside the popper's circle. */
  private land(ctx: CastContext) {
    const foes = ctx.enemies?.() ?? ctx.targets;
    for (const e of foes) {
      const p = e.group.position;
      if (!insideTelegraph(this.circle, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 3, from: this.v2.copy(this.start), color: TWINS_CSS.pom });
    }
  }
}

export const pomBackflipModule: EffectModule = {
  label: 'backflip',
  category: 'hero: twins',
  // A hop toward the aim: the radius only sizes the aim marker.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new PomBackflip(),
  telegraphs(effect) {
    const e = effect as PomBackflip;
    if (!e.ctx) return [];
    return [{ shape: e.circle, start: 0, impact: FLIP_FUSE }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PomBackflip;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as PomBackflip).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 100, 1);
  },
};
