import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { DOOR, DOOR_CSS, Flecks, Glove, KeyFlock } from '../../effects/parts/door';
import { Gleam } from '../../effects/parts/mirror';
import { boltWidth, type BoltDoor, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath, type Obstacle } from '../../obstacles';
import { KEY_DAMAGE, KEY_RADIUS, KEY_RANGE, KEY_SPEED, KEY_WIND } from '../../traits/door';

/**
 * Key Toss (door kit v5, Q: a skillshot that goes through doors). He draws a brass key out at his white-gloved hand over the 0.3 s
 * wind-up, turning faster, and throws it as a real bolt (`ctx.projectile`: 9 m from him, 22 m/s, radius 0.3): 50 damage and a small
 * knock. The key flies lengthways and turns about its length, so its teeth flash; a brass gleam trails it. It reaches 6 m at 0.57 s.
 *
 * Doors: a bolt that flies into a door comes out of its pair, going the same way (the projectile system's `ctx.doors()`), his own
 * key too, and through all four of the Grand Lobby's. The telegraph shows what the key really does: one line from him to the door,
 * and one from the far door on, each as wide as the bolt really hits (`boltWidth`); the second shows from the moment the key
 * would reach the door. `doorPath` is a pure function of `sentFrom`, the aim, the doors in the list and the obstacles, the same
 * test the projectile system makes, so both screens draw the same line, and where no bolt flies (his own screen online) the key is
 * drawn along it. When the key jumps a door (the real bolt's `doorLock` turns up, or the drawn one passes a door) a bright flash shows on
 * the door it goes in and the door it comes out of. The 0.3 s wind-up roots him. Clean by about 2.5 s.
 * See pipeline/designs/kit-door.md.
 */
export interface KeyTossSettings {
  damage: number;
  knock: number;
}

export const defaultKeyToss = (): KeyTossSettings => ({ damage: KEY_DAMAGE, knock: 1.5 });

// Timeline and numbers.
const MUZZLE = 0.8;
const RADIUS = KEY_RADIUS;
const LINE_W = boltWidth(RADIUS);
const BOLT_Y = 1.1;
const MAX_T = 3.0;
const SPIN = 22;
const KEY_LEN = 0.6;
const FLASHES = 4;
const LEGS_SHOWN = 3;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const MIN = 1e-3;

/** One straight stretch of a key's way. */
export interface KeyLeg { x1: number; z1: number; x2: number; z2: number; len: number }

/**
 * The way a bolt flies from `start` along `dir` for `range` m with these doors and walls: straight to a wall (it stops there) or into the
 * first door whose reach (`r`) it touches, then on from the far door's middle, the same way, with what range it has left (the jump costs
 * none, as in the projectile system). A door it has been through is not entered again.
 */
export function doorPath(start: { x: number; z: number }, dir: { x: number; z: number }, range: number, doors: readonly BoltDoor[], obstacles: readonly Obstacle[]): KeyLeg[] {
  const l = Math.hypot(dir.x, dir.z) || 1, ux = dir.x / l, uz = dir.z / l;
  const legs: KeyLeg[] = [];
  const used = new Set<BoltDoor>();
  let x = start.x, z = start.z, left = range;
  for (let guard = 0; guard < 6 && left > 1e-3; guard++) {
    // Where a wall stops it on this stretch.
    const wall = bankPath({ x, z }, { x: ux, z: uz }, left, 0, obstacles);
    const end = wall[wall.length - 1];
    const reach = Math.hypot(end.x - x, end.z - z);
    // The first door whose reach it enters before that.
    let best: { t: number; d: BoltDoor; inA: boolean } | null = null;
    for (const d of doors) {
      if (used.has(d)) continue;
      for (const inA of [true, false]) {
        // It enters this end's reach and comes out of the other end.
        const wx = (inA ? d.ax : d.bx) - x, wz = (inA ? d.az : d.bz) - z;
        const proj = wx * ux + wz * uz, perp2 = wx * wx + wz * wz - proj * proj;
        if (perp2 > d.r * d.r) continue;
        const half = Math.sqrt(d.r * d.r - perp2);
        const t0 = Math.max(0, proj - half);
        if (proj + half < 0 || t0 > reach) continue;
        if (!best || t0 < best.t) best = { t: t0, d, inA };
      }
    }
    if (!best) {
      legs.push({ x1: x, z1: z, x2: end.x, z2: end.z, len: reach });
      break;
    }
    const ex = x + ux * best.t, ez = z + uz * best.t;
    legs.push({ x1: x, z1: z, x2: ex, z2: ez, len: best.t });
    left -= best.t;
    used.add(best.d);
    // Out of the other door's middle.
    x = best.inA ? best.d.bx : best.d.ax;
    z = best.inA ? best.d.bz : best.d.az;
  }
  return legs;
}

export class KeyToss implements Effect {
  readonly group = new THREE.Group();
  readonly settings: KeyTossSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** One thin line per leg shown, with its timing. */
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown along the legs by the drawn-only key (-1: none, -2: done)
  private passed = 0;
  private trailT = 0;
  private landed = false;
  private tail = new THREE.Vector3();
  private prevLock: BoltDoor | null = null;

  private dir = new THREE.Vector3(0, 0, 1);
  private start = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  private legs: KeyLeg[] = [];
  private cum: number[] = [];

  private keys = new KeyFlock(1, KEY_LEN);
  private glove = new Glove();
  private gleam = new Gleam(1);
  private flecks = new Flecks(80);
  private stars: StarBurst[] = [];
  private flash = { pos: [] as THREE.Vector3[], age: [] as number[], size: [] as number[], next: 0 };

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: KeyTossSettings = defaultKeyToss()) {
    this.settings = settings;
    this.group.add(this.keys.group, this.glove.group, this.gleam.mesh, this.flecks.mesh);
    for (let i = 0; i < FLASHES; i++) {
      const s = new StarBurst({ points: 8, inner: 0.3, color: i % 2 ? DOOR.glow : DOOR.hot, core: 0xffffff, additive: false });
      this.stars.push(s);
      this.group.add(s.mesh);
      this.flash.pos.push(new THREE.Vector3());
      this.flash.age.push(9);
      this.flash.size.push(1);
    }
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return KEY_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the path: only sentFrom, the aim point, the doors in the list and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    this.legs = doorPath(this.start, this.dir, KEY_RANGE - MUZZLE, ctx.doors?.() ?? [], ctx.obstacles?.() ?? []);
    // The first stretch is drawn from him, not from the muzzle (as every skillshot's line).
    if (this.legs.length) {
      const f = this.legs[0];
      this.legs[0] = { ...f, x1: s.x, z1: s.z, len: f.len + MUZZLE };
    }
    this.cum = [0];
    for (let i = 0; i < this.legs.length; i++) this.cum.push(this.cum[i] + this.legs[i].len);
    this.specs = [];
    for (let i = 0; i < this.legs.length && i < LEGS_SHOWN; i++) {
      const g = this.legs[i];
      const at = KEY_WIND + (this.cum[i] - MUZZLE) / KEY_SPEED, end = KEY_WIND + (this.cum[i + 1] - MUZZLE) / KEY_SPEED;
      this.specs.push({
        shape: { kind: 'line', x1: g.x1, z1: g.z1, x2: g.x2, z2: g.z2, width: LINE_W },
        start: i === 0 ? 0 : Math.max(0, at),
        impact: KEY_WIND,
        until: end,
      });
    }
    // His hand: a little ahead of him, right of centre, at hand height.
    this.hand.set(ctx.from.x + this.dir.x * 0.7 + this.dir.z * 0.3, 1.2, ctx.from.z + this.dir.z * 0.7 - this.dir.x * 0.3);
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
    this.passed = 0;
    this.prevLock = null;
    this.trailT = 0;
    this.keys.reset();
    this.glove.hide();
    this.gleam.reset();
    this.flecks.reset();
    for (let i = 0; i < FLASHES; i++) { this.flash.age[i] = 9; this.stars[i].set(this.flash.pos[i], 0, 0); }
    this.flash.next = 0;
  }

  /** A clear flash: a star and a few brass flecks at `at` (a door, or the end). */
  private flare(at: THREE.Vector3, size: number, flecks: number, y = BOLT_Y) {
    const i = this.flash.next++ % FLASHES;
    this.flash.pos[i].set(at.x, y, at.z);
    this.flash.age[i] = 0;
    this.flash.size[i] = size;
    this.flecks.burst(this.flash.pos[i], flecks, 4, 1.2);
    this.shake = Math.max(this.shake, 0.08);
  }

  /** The point `d` m along the legs (the jump between two costs nothing) and the way it flies there. */
  private pointAt(d: number, out: THREE.Vector3, dirOut: THREE.Vector3) {
    let i = 0;
    while (i < this.legs.length - 1 && d > this.cum[i + 1]) i++;
    const g = this.legs[i], k = THREE.MathUtils.clamp((d - this.cum[i]) / Math.max(1e-4, g.len), 0, 1);
    out.set(g.x1 + (g.x2 - g.x1) * k, BOLT_Y, g.z1 + (g.z2 - g.z1) * k);
    dirOut.set(g.x2 - g.x1, 0, g.z2 - g.z1).normalize();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.flecks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: the key is drawn out at his gloved hand, turning faster. ---
    if (t < KEY_WIND) {
      const k = easeOut(t / KEY_WIND);
      this.glove.place(this.hand, Math.atan2(this.dir.x, this.dir.z), 0.7 + 0.5 * k);
      this.v1.copy(this.hand).addScaledVector(this.dir, 0.12 + 0.18 * k);
      this.keys.show(0, this.v1, Math.atan2(this.dir.x, this.dir.z), t * (8 + 40 * k), Math.max(k, MIN) * 0.9);
      this.trailT += dt;
      if (this.trailT >= 0.06) { this.trailT = 0; this.flecks.burst(this.v1, 1, 0.8, 0.8); }
    }

    // --- Fire. A real bolt where there is one; else (a network duel's caster screen) a drawn key along the same legs. ---
    if (!this.fired && t >= KEY_WIND) {
      this.fired = true;
      this.glove.hide();
      this.shake = 0.05;
      this.lastPos.set(this.start.x, BOLT_Y, this.start.z);
      this.tail.copy(this.lastPos);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: KEY_SPEED, range: KEY_RANGE - MUZZLE, radius: RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: DOOR_CSS.brass },
        });
        const thrown = this.bolt;
        thrown.onHit((_target, at) => { if (this.bolt === thrown) this.onHit(at); });
      } else {
        this.drawn = 0;
      }
    }

    // --- The key rides the bolt (or the drawn path); a gleam trails it; a jump through a door flashes both doors. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.ride(b.pos, b.dir, dt); }
    } else if (this.drawn >= 0) {
      this.drawn += KEY_SPEED * dt;
      const total = this.cum[this.cum.length - 1] - MUZZLE;
      this.pointAt(this.drawn + MUZZLE, this.v1, this.v2);
      while (this.passed < this.legs.length - 1 && this.drawn + MUZZLE >= this.cum[this.passed + 1]) {
        const g = this.legs[this.passed], h = this.legs[this.passed + 1];
        this.flare(this.v1.set(g.x2, 0, g.z2), 2.0, 12);
        this.flare(this.v1.set(h.x1, 0, h.z1), 2.2, 14);
        this.tail.set(h.x1, BOLT_Y, h.z1);
        this.passed++;
      }
      this.pointAt(this.drawn + MUZZLE, this.v1, this.v2);
      live = this.drawn < total;
      if (live) this.ride(this.v1, this.v2, dt); else this.drawn = -2;
    }
    if (this.fired && !live && this.goneAt < 0) {
      this.goneAt = t;
      this.gleam.hide(0);
      this.keys.hide(0);
      // It stops: a little glint where it lands, unless a hit has already made the burst.
      if (!this.landed) { this.landed = true; this.flare(this.lastPos, 1.1, 8); }
    }

    // --- The flashes: a pale star that pops and shrinks. ---
    for (let i = 0; i < FLASHES; i++) {
      this.flash.age[i] += dt;
      const sp = StarBurst.pop(this.flash.age[i], 0.05, 0.16);
      this.stars[i].set(this.flash.pos[i], this.flash.size[i] * sp.scale, sp.opacity, this.flash.age[i] * 4);
    }
    this.shake *= Math.exp(-dt * 12);

    if ((this.goneAt >= 0 && t >= this.goneAt + 0.7 && !this.flecks.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  /** Moves the key to the bolt; the bolt's `doorLock` turning up is a door it went through: flash both ends, start the trail afresh. */
  private ride(pos: THREE.Vector3, dir: THREE.Vector3, dt: number) {
    const lock = this.bolt?.doorLock ?? null;
    if (lock && lock !== this.prevLock) {
      this.flare(this.lastPos, 2.0, 12);
      this.flare(pos, 2.2, 14);
      this.tail.set(pos.x, BOLT_Y, pos.z);
    }
    this.prevLock = lock;
    this.lastPos.set(pos.x, BOLT_Y, pos.z);
    this.v2.set(pos.x, BOLT_Y, pos.z);
    this.keys.show(0, this.v2, Math.atan2(dir.x, dir.z), this.time * SPIN, 1);
    const back = Math.min(1.4, Math.hypot(pos.x - this.tail.x, pos.z - this.tail.z) + 0.05);
    this.v1.copy(this.v2).addScaledVector(dir, -back);
    this.gleam.set(this.v1, this.v2, 0.3, 0.85, DOOR.brass, 0.1, 0);
    this.trailT += dt;
    if (this.trailT >= 0.05) { this.trailT = 0; this.flecks.burst(this.v1.copy(this.v2).addScaledVector(dir, -0.4), 1, 0.8, 0.8); }
  }

  /** A hit: the key bursts into brass. */
  private onHit(at: THREE.Vector3) {
    this.landed = true;
    this.flare(at, 1.5, 18);
    this.shake = 0.14;
    this.gleam.hide(0);
    this.keys.hide(0);
  }
}

export const keyTossModule: EffectModule = {
  label: 'key toss',
  category: 'hero: door',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new KeyToss(),
  telegraphs(effect) {
    const e = effect as KeyToss;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as KeyToss;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as KeyToss).settings;
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
