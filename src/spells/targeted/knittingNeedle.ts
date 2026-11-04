import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Fluff, Needles, StrandTube, YARN } from '../../effects/parts/yarn';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { firstSurface } from '../../obstacles';
import { NEEDLE_DAMAGE, NEEDLE_RADIUS, NEEDLE_RANGE, NEEDLE_SPEED, NEEDLE_WIND } from '../../traits/yarn';
import { YARN_CSS } from '../../effects/parts/yarn';

/**
 * Knitting Needle (yarn kit v5, Q: the plain skillshot). Grandma pulls a needle as long as a sword out of her bun and holds it up
 * over the 0.3 s wind-up (it grows out of her hand, a loose strand of rose wool trailing from its knob), then throws it as a real
 * bolt (`ctx.projectile`: 9 m from her, 22 m/s, radius 0.3) end first, turning on its own axis, a wavy thread of wool behind it:
 * 50 damage. It reaches 6 m at 0.57 s. A needle that hits pops in a pink star and a puff of wool; one that finds nothing, or a
 * wall, sticks where it stops and quivers for a moment before it fades. The telegraph is the real bolt's line, `boltWidth`
 * wide, from her to the first cover or 9 m, shown from the cast (its impact is the throw, 0.3 s, so it roots her until then).
 * Network duels: the bolt flies on the victim's screen; the caster's screen draws the same needle along the same line (the aim
 * and `ctx.obstacles()` only). Clean by about 1.8 s. See pipeline/designs/kit-yarn.md.
 */
export interface KnittingNeedleSettings {
  damage: number;
  knock: number;
}

export const defaultKnittingNeedle = (): KnittingNeedleSettings => ({ damage: NEEDLE_DAMAGE, knock: 1.5 });

// Timeline and numbers.
const MUZZLE = 0.8;
const LINE_W = boltWidth(NEEDLE_RADIUS);
const BOLT_Y = 1.1;
const MAX_T = 1.8;
const STICK = 0.5;
const TAIL = 2.2;
const TAIL_SEGS = 14;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const MIN = 1e-3;

export class KnittingNeedle implements Effect {
  readonly group = new THREE.Group();
  readonly settings: KnittingNeedleSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's real line (her feet to the first cover or 9 m), with its timing. */
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown by the drawn-only needle (-1: none, -2: done)
  private hitAt = -1;
  private len = NEEDLE_RANGE - MUZZLE;

  private dir = new THREE.Vector3(0, 0, 1);
  private yaw = 0;
  private start = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  private pts: THREE.Vector3[] = [];

  private needles = new Needles(1);
  private tail = new StrandTube(TAIL_SEGS, 5, YARN.pink, 0.05);
  private fluff = new Fluff(40);
  private star = new StarBurst({ points: 8, inner: 0.3, color: YARN.pink, core: YARN.core, additive: false });
  private starAt = -1;
  private starPos = new THREE.Vector3();

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: KnittingNeedleSettings = defaultKnittingNeedle()) {
    this.settings = settings;
    this.group.add(this.needles.mesh, this.tail.mesh, this.fluff.mesh, this.star.mesh);
    for (let i = 0; i <= TAIL_SEGS; i++) this.pts.push(new THREE.Vector3());
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return NEEDLE_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line: only sentFrom, the aim point and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.yaw = Math.atan2(dx, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    const reach = NEEDLE_RANGE - MUZZLE;
    const end = { x: this.start.x + dx * reach, z: this.start.z + dz * reach };
    const hit = firstSurface(this.start, end, ctx.obstacles?.() ?? []);
    this.len = hit ? reach * hit.t : reach;
    const total = MUZZLE + this.len;
    this.specs = [{
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: s.x + dx * total, z2: s.z + dz * total, width: LINE_W },
      start: 0,
      impact: NEEDLE_WIND,
      until: NEEDLE_WIND + total / NEEDLE_SPEED,
    }];
    // Her hand: a little ahead of her, right of centre, at hand height.
    this.tip.set(ctx.from.x + dx * 0.7 + dz * 0.3, 1.25, ctx.from.z + dz * 0.7 - dx * 0.3);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.goneAt = -1;
    this.bolt = null;
    this.drawn = -1;
    this.hitAt = -1;
    this.starAt = -1;
    this.needles.reset();
    this.tail.hide();
    this.fluff.reset();
    this.star.set(this.starPos, 0, 0);
  }

  /** The thread of wool behind the needle: from its knob back `TAIL` m along its path, waving. */
  private thread(at: THREE.Vector3, k: number) {
    const back = TAIL * k;
    for (let i = 0; i <= TAIL_SEGS; i++) {
      const u = i / TAIL_SEGS, d = u * back;
      const wave = Math.sin(this.time * 18 - u * 9) * 0.12 * u;
      this.pts[i].set(
        at.x - this.dir.x * (0.75 + d) + this.dir.z * wave,
        at.y + Math.sin(this.time * 14 - u * 7) * 0.08 * u - u * u * 0.25,
        at.z - this.dir.z * (0.75 + d) - this.dir.x * wave,
      );
    }
    this.tail.set(this.pts, (x) => 1 - 0.7 * x);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.fluff.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: the needle grows out of her hand, tilted up, a thread trailing from its knob. ---
    if (t < NEEDLE_WIND) {
      const k = easeOut(t / NEEDLE_WIND);
      this.v1.copy(this.tip);
      this.v1.y += (1 - k) * 0.35;
      this.needles.place(0, this.v1, this.yaw, Math.max(k, MIN), t * 10, 0.35 * (1 - k));
      this.thread(this.v1, 0.35 + 0.4 * k);
    }

    // --- Throw. A real bolt where there is one; else (a network duel's caster screen) a drawn needle along the same line. ---
    if (!this.fired && t >= NEEDLE_WIND) {
      this.fired = true;
      this.shake = 0.05;
      this.fluff.burst(this.v1.copy(this.tip), 5, 2.2, 0.8);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: NEEDLE_SPEED, range: NEEDLE_RANGE - MUZZLE, radius: NEEDLE_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: YARN_CSS.pink },
        });
        this.bolt.onHit((_target, at) => this.onHit(at));
      } else {
        this.drawn = 0;
      }
    }

    // --- The needle rides the bolt (or the drawn path), end first, turning; the thread streams behind it. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.lastPos.copy(b.pos); this.ride(this.lastPos, 1); }
    } else if (this.drawn >= 0) {
      this.drawn += NEEDLE_SPEED * dt;
      live = this.drawn < this.len;
      if (live) { this.lastPos.copy(this.start).addScaledVector(this.dir, this.drawn); this.ride(this.lastPos, 1); } else this.drawn = -2;
    }
    if (this.fired && !live && this.goneAt < 0) {
      this.goneAt = t;
      if (this.hitAt < 0) this.land();
    }
    // A needle that found nothing sticks, quivers and fades; one that hit is gone.
    if (this.goneAt >= 0 && this.hitAt < 0) {
      const a = t - this.goneAt, k = Math.min(1, a / STICK);
      this.v1.set(this.lastPos.x, BOLT_Y - 0.25 * Math.min(1, a * 8), this.lastPos.z);
      this.needles.place(0, this.v1, this.yaw, Math.max(1 - k * k, MIN), Math.sin(a * 60) * 0.12 * (1 - k), 0.2);
      this.tail.hide();
    }

    if (this.starAt >= 0) {
      const a = t - this.starAt, sp = StarBurst.pop(a, 0.05, 0.16);
      this.star.set(this.starPos, 1.5 * sp.scale, sp.opacity, a * 4);
    }
    this.shake *= Math.exp(-dt * 12);

    if ((this.goneAt >= 0 && t >= this.goneAt + STICK + 0.2 && !this.fluff.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  private ride(pos: THREE.Vector3, k: number) {
    this.v1.set(pos.x, BOLT_Y, pos.z);
    this.needles.place(0, this.v1, this.yaw, k, this.time * 14);
    this.thread(this.v1, 1);
    if (Math.random() < 0.35) this.fluff.burst(this.v2.copy(this.v1).addScaledVector(this.dir, -0.9), 1, 0.8, 0.6);
  }

  /** It stops without a hit: a small star and a puff where it sticks. */
  private land() {
    this.flare(this.lastPos, 0.9, 5);
  }

  private flare(at: THREE.Vector3, size: number, bits: number) {
    this.starPos.set(at.x, BOLT_Y, at.z);
    this.starAt = this.time;
    this.fluff.burst(this.starPos, bits, 3.4, 1);
    this.shake = Math.max(this.shake, size > 1 ? 0.12 : 0.06);
  }

  /** A hit: the needle pops in a pink star and a puff of wool. */
  private onHit(at: THREE.Vector3) {
    this.hitAt = this.time;
    this.flare(at, 1.4, 12);
    this.needles.hide(0);
    this.tail.hide();
  }
}

export const knittingNeedleModule: EffectModule = {
  label: 'knitting needle',
  category: 'hero: yarn',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: NEEDLE_RADIUS },
  create: () => new KnittingNeedle(),
  telegraphs(effect) {
    const e = effect as KnittingNeedle;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: false, strength: 0, radius: 0, threshold: 1 },
  frameCamera(camera, controls, effect) {
    const e = effect as KnittingNeedle;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as KnittingNeedle).settings;
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
