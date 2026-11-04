import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BALLOON, BALLOON_CSS, Balloons, Bubbles, PopWords } from '../../effects/parts/balloon';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { HOSE_DAMAGE, HOSE_PUSH, HOSE_RANGE, HOSE_RADIUS, HOSE_SPEED, HOSE_WIND, KNOCK_PER_M } from '../../traits/balloon';

/**
 * Air Hose (balloon kit v5, Q: a skillshot). Professor Puff pumps a small pink balloon up at the brass nozzle in his hand over the 0.3 s
 * wind-up (it swells, jiggles, and sheds a few bubbles), then lets go: the balloon flies as the bolt (`ctx.projectile`: 8 m from him, 22 m/s,
 * radius 0.35), shrinking as it empties, its string streaming, a stream of soft puffs and soap bubbles behind it. A real balloon rocket, not
 * a glowing ball. It hits the first enemy it touches for 45 with a 1 m push (the trait puts 3 Air on the hit and pushes 8% farther per Air
 * already there): a PFFT, a ring of puffs and bubbles. It reaches 6 m at 0.57 s.
 *
 * Telegraph: one thin line from him, as wide as the bolt really hits (`boltWidth(0.35)`); its `impact` is the launch (0.3 s), so the root on
 * him ends there. Network duels: bolts fly on the victim's screen, so the caster's screen draws the same flight along the same straight line.
 * Clean by about 1.7 s. See pipeline/designs/kit-balloon.md.
 */
export interface AirHoseSettings {
  damage: number;
  /** Push in metres (the engine's knock speed is this times 7). */
  push: number;
}

export const defaultAirHose = (): AirHoseSettings => ({ damage: HOSE_DAMAGE, push: HOSE_PUSH });

// Timeline and numbers.
const MUZZLE = 0.8;
const LINE_W = boltWidth(HOSE_RADIUS);
const BOLT_Y = 1.1;
const MAX_T = 1.8;
const MIN = 1e-3;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class AirHose implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AirHoseSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The thin line of the bolt. */
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown by the drawn-only bolt (-1: none, -2: done)
  private idx = -1;
  private trailT = 0;
  private landed = false;

  private dir = new THREE.Vector3(0, 0, 1);
  private start = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private lastPos = new THREE.Vector3();

  private balloons = new Balloons(2);
  private bubbles = new Bubbles(70);
  private words = new PopWords(1);
  private star = new StarBurst({ points: 8, inner: 0.3, color: BALLOON.body, core: 0xffffff, additive: false });
  private starAge = 9;
  private starPos = new THREE.Vector3();

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: AirHoseSettings = defaultAirHose()) {
    this.settings = settings;
    this.group.add(this.balloons.mesh, this.bubbles.mesh, this.words.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return HOSE_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line: only sentFrom and the aim point.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    this.specs = [{
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: s.x + dx * HOSE_RANGE, z2: s.z + dz * HOSE_RANGE, width: LINE_W },
      start: 0,
      impact: HOSE_WIND,
      until: HOSE_WIND + (HOSE_RANGE - MUZZLE) / HOSE_SPEED,
    }];
    // His hand: a little ahead of him, right of centre, at hand height.
    this.tip.set(ctx.from.x + dx * 0.7 + dz * 0.3, 1.2, ctx.from.z + dz * 0.7 - dx * 0.3);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.landed = false;
    this.goneAt = -1;
    this.bolt = null;
    this.drawn = -1;
    this.idx = -1;
    this.trailT = 0;
    this.starAge = 9;
    this.balloons.reset();
    this.bubbles.reset();
    this.words.reset();
    this.star.set(this.starPos, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.balloons.update(dt);
    this.bubbles.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: the balloon is pumped up at his hand, shedding a few bubbles. ---
    if (this.idx === -1) {
      this.idx = this.balloons.place(this.tip, 'pink', MIN);
      this.balloons.setBob(this.idx, 0.03);
    }
    if (t < HOSE_WIND && this.idx >= 0) {
      this.balloons.setScale(this.idx, Math.max(0.52 * easeOut(t / HOSE_WIND), MIN));
      this.balloons.move(this.idx, this.tip);
      this.balloons.jiggle(this.idx, 0.12 + 0.12 * (t / HOSE_WIND));
      this.trailT += dt;
      if (this.trailT >= 0.06) {
        this.trailT = 0;
        this.v1.set((Math.random() - 0.5) * 0.8, 0.5, (Math.random() - 0.5) * 0.8);
        this.bubbles.emit(this.tip, this.v1, 0.08, 0.16, 0.6, BALLOON.hot, 0, 2.5, 0.8);
      }
    }

    // --- Fire: a real bolt where there is one; else (a network duel's caster screen) a drawn one along the same line. ---
    if (!this.fired && t >= HOSE_WIND) {
      this.fired = true;
      this.shake = 0.05;
      if (this.idx >= 0) this.balloons.jiggle(this.idx, 0.4);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: HOSE_SPEED, range: HOSE_RANGE - MUZZLE, radius: HOSE_RADIUS,
          hit: { damage: s.damage, knock: s.push * KNOCK_PER_M, color: BALLOON_CSS.body },
        });
        this.bolt.onHit((_target, at) => this.onHit(at));
      } else {
        this.drawn = 0;
      }
    }

    // --- The balloon rides the bolt (or the drawn line), emptying as it goes; puffs and bubbles stream behind. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.lastPos.copy(b.pos); this.ride(b.pos, dt); }
    } else if (this.drawn >= 0) {
      this.drawn += HOSE_SPEED * dt;
      const total = HOSE_RANGE - MUZZLE;
      live = this.drawn < total;
      if (live) {
        this.v1.copy(this.start).addScaledVector(this.dir, this.drawn).setY(BOLT_Y);
        this.lastPos.copy(this.v1);
        this.ride(this.v1, dt);
      } else this.drawn = -2;
    }
    if (this.fired && !live && this.goneAt < 0) {
      this.goneAt = t;
      if (this.idx >= 0) { this.balloons.hide(this.idx); this.idx = -2; }
      // It ran dry with nothing in its way: a last wheeze.
      if (!this.landed) this.burst(this.lastPos, 0.7, 6);
    }

    // --- The hit star: a short pop. ---
    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0.05, 0.16);
    this.star.set(this.starPos, 1.3 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 12);

    if ((this.goneAt >= 0 && t >= this.goneAt + 1.0 && !this.bubbles.busy && !this.words.busy) || t >= MAX_T + 0.4) {
      this.playing = false;
      this.reset();
    }
  }

  /** Moves the balloon to the bolt and lays the trail. */
  private ride(pos: THREE.Vector3, dt: number) {
    const flown = Math.min(1, Math.hypot(pos.x - this.start.x, pos.z - this.start.z) / (HOSE_RANGE - MUZZLE));
    if (this.idx >= 0) {
      this.balloons.move(this.idx, pos);
      this.balloons.setScale(this.idx, 0.52 - 0.22 * flown);
      this.balloons.jiggle(this.idx, 0.3);
      this.balloons.setBob(this.idx, 0.02);
    }
    this.trailT += dt;
    if (this.trailT >= 0.035) {
      this.trailT = 0;
      this.v1.copy(pos).addScaledVector(this.dir, -0.5);
      this.v2.copy(this.dir).multiplyScalar(-1.5).add(this.v1.set((Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2));
      this.v1.copy(pos).addScaledVector(this.dir, -0.45);
      this.bubbles.emit(this.v1, this.v2, 0.3, 0.7, 0.5, BALLOON.hot, 1, 2.5, 0.2);
      if (Math.random() < 0.45) this.bubbles.emit(this.v1, this.v2.multiplyScalar(0.6), 0.1, 0.2, 0.7, BALLOON.hot, 0, 2, 0.8);
    }
  }

  /** A burst of puffs and bubbles at `at`, and a small pop word. */
  private burst(at: THREE.Vector3, size: number, n: number) {
    this.landed = true;
    this.v2.set(at.x, BOLT_Y, at.z);
    this.bubbles.ring(this.v2, n, 3.2, size * 0.6, 0.7, BALLOON.hot, 1);
    this.bubbles.ring(this.v2, Math.ceil(n * 0.7), 2.4, size * 0.3, 0.9, BALLOON.hot, 0);
  }

  /** A hit: PFFT, a ring of puffs and bubbles, a star, a small shake. */
  private onHit(at: THREE.Vector3) {
    this.burst(at, 1.0, 9);
    this.starPos.set(at.x, BOLT_Y, at.z);
    this.starAge = 0;
    this.shake = 0.14;
    this.v1.set(at.x, 2.0, at.z);
    this.words.show('PFFT', this.v1, 0.8, 0.9);
    if (this.idx >= 0) { this.balloons.hide(this.idx); this.idx = -2; }
  }
}

export const airHoseModule: EffectModule = {
  label: 'air hose',
  category: 'hero: balloon',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: HOSE_RADIUS },
  create: () => new AirHose(),
  telegraphs(effect) {
    const e = effect as AirHose;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as AirHose;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as AirHose).settings;
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'push', 0, 6, 0.5);
  },
};
