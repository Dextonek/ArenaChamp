import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Bubbles, Drops, JANITOR, JANITOR_CSS, Ripples, Words, buildBucket } from '../../effects/parts/janitor';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import {
  BUCKET_DAMAGE, BUCKET_RADIUS, BUCKET_RANGE, BUCKET_SPEED, BUCKET_WIND, SPLASH_R, WET_LIFE, addWet,
} from '../../traits/janitor';

/**
 * Mop Bucket (janitor kit v5, E: a thrown wheeled bucket). Gus swings the bucket up from his side over the 0.3 s wind-up (water
 * slops over the rim) and lets it fly as a real bolt (`ctx.projectile`: 8 m from him, 16 m/s, radius 0.4): it tumbles end over end
 * with its wheels spinning and a trail of drops and soap bubbles behind it. It reaches 6 m at 0.65 s. A hit: 40 damage. Where it stops
 * (on a hero, or at the end of its range, or at cover) it lands with a CLANG, a splash and a ring, and the floor 2.5 m round is wet for
 * 6 s (`addWet`, written on both screens, drawn by the trait's `marks`). The empty bucket lies there a moment and drains.
 *
 * Telegraph: one thin line as wide as the bolt really hits (`boltWidth`), from the cast, ending where cover stops it (`bankPath` with no
 * bounce: a pure function of `sentFrom`, the aim and `ctx.obstacles()`); its `impact` is the launch (0.3 s), so the root on him ends
 * there. Network duels: bolts fly on the victim's screen, so his screen draws the same flight along the same line, and stops it at the
 * enemy it passes within reach of: the splash lands where each screen saw the bucket stop, which can differ a little on his own screen
 * (the wet only ever matters on the victim's, where the bolt is real). Clean by about 2.2 s. See pipeline/designs/kit-janitor.md.
 */
export interface MopBucketSettings {
  damage: number;
  knock: number;
}

export const defaultMopBucket = (): MopBucketSettings => ({ damage: BUCKET_DAMAGE, knock: 1.5 });

// Timeline and numbers.
const MUZZLE = 0.4;
const BOLT_Y = 0.95;
const MAX_T = 2.4;
const LINE_W = boltWidth(BUCKET_RADIUS);
const FLIGHT = BUCKET_RANGE - MUZZLE;
const TUMBLE = 9;
const BODY = 0.5;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const MIN = 1e-3;

export class MopBucket implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MopBucketSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  start = new THREE.Vector3();
  end = new THREE.Vector3();
  dir = new THREE.Vector3(0, 0, 1);
  private from = new THREE.Vector3();
  private time = 0;
  private fired = false;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown by the drawn-only bolt (-1: none, -2: done)
  private goneAt = -1;
  private landed = false;
  private trailT = 0;
  private spin = 0;
  private lastPos = new THREE.Vector3();
  private hand = new THREE.Vector3();

  private bucket = buildBucket();
  private ripples = new Ripples(8);
  private drops = new Drops(90);
  private bubbles = new Bubbles(40);
  private words = new Words(2);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: JANITOR.pale, core: JANITOR.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MopBucketSettings = defaultMopBucket()) {
    this.settings = settings;
    this.bucket.scale.setScalar(1.25);
    this.bucket.visible = false;
    this.group.add(this.bucket, this.ripples.mesh, this.drops.mesh, this.bubbles.mesh, this.words.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return BUCKET_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line: only sentFrom, the aim point and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.from.set(s.x, 0, s.z);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    const path = bankPath(this.start, this.dir, FLIGHT, 0, ctx.obstacles?.() ?? [], 0);
    const e = path[path.length - 1];
    this.end.set(e.x, 0, e.z);
    // His hand: a little ahead of him, right of centre, at hip height.
    this.hand.set(ctx.from.x + dx * 0.7 + dz * 0.5, 0.7, ctx.from.z + dz * 0.7 - dx * 0.5);
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
    this.trailT = 0;
    this.spin = 0;
    this.bucket.visible = false;
    this.ripples.reset();
    this.drops.reset();
    this.bubbles.reset();
    this.words.reset();
    this.pop.set(this.from, 0, 0);
    this.shock.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.ripples.update(dt);
    this.drops.update(dt);
    this.bubbles.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: the bucket comes up at his side, slopping, its wheels turning. ---
    if (!this.fired) {
      const k = easeOut(t / BUCKET_WIND);
      this.bucket.visible = true;
      this.bucket.position.set(this.hand.x, 0.55 + 0.5 * k, this.hand.z);
      this.bucket.rotation.set(-0.5 * k, Math.atan2(this.dir.x, this.dir.z), 0.25 * Math.sin(t * 30));
      this.trailT += dt;
      if (this.trailT >= 0.06) {
        this.trailT = 0;
        this.drops.burst(this.v1.copy(this.bucket.position).setY(this.bucket.position.y + 0.5), 1, 1.4, 2.6, 0.06);
      }
    }

    // --- Fire. A real bolt where there is one; else (a network duel's caster screen) a drawn bolt along the same line. ---
    if (!this.fired && t >= BUCKET_WIND) {
      this.fired = true;
      this.shake = 0.06;
      this.bubbles.emit(this.v1.set(this.start.x, 0.9, this.start.z), 5, 0.4, 0.14, 0.8);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: BUCKET_SPEED, range: FLIGHT, radius: BUCKET_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: JANITOR_CSS.water },
        });
        this.bolt.onHit((_target, at) => this.land(at, true));
      } else {
        this.drawn = 0;
      }
    }

    // --- The bucket rides the bolt (or the drawn path), tumbling; a trail of drops and bubbles behind. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.lastPos.copy(b.pos); this.ride(b.pos, dt); }
    } else if (this.drawn >= 0) {
      this.drawn += BUCKET_SPEED * dt;
      const total = Math.hypot(this.end.x - this.start.x, this.end.z - this.start.z);
      this.v1.set(this.start.x + this.dir.x * Math.min(this.drawn, total), BOLT_Y, this.start.z + this.dir.z * Math.min(this.drawn, total));
      // It stops at the first enemy it reaches (their live position), as the real bolt would.
      let stopped = this.drawn >= total;
      if (!stopped && ctx) {
        for (const e of ctx.enemies?.() ?? ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.v1.x, p.z - this.v1.z) <= BUCKET_RADIUS + BODY) { stopped = true; break; }
        }
      }
      live = !stopped;
      if (live) { this.lastPos.copy(this.v1); this.ride(this.v1, dt); } else { this.lastPos.copy(this.v1); this.drawn = -2; }
    }
    if (this.fired && !live && this.goneAt < 0) {
      this.goneAt = t;
      if (!this.landed) this.land(this.lastPos, false);
    }

    // --- After the landing the empty bucket lies on its side, draining, and shrinks away. ---
    if (this.goneAt >= 0) {
      const a = t - this.goneAt;
      const roll = easeOut(a / 0.3);
      this.bucket.rotation.set(0, this.bucket.rotation.y, Math.PI / 2 * roll);
      this.bucket.position.y = 0.35 * (1 - roll) + 0.38 * roll;
      this.bucket.scale.setScalar(Math.max(MIN, 1.25 * (a < 1.1 ? 1 : 1 - (a - 1.1) / 0.3)));
      if (a < 0.9) {
        this.trailT += dt;
        if (this.trailT >= 0.07) { this.trailT = 0; this.drops.burst(this.v1.copy(this.bucket.position).setY(0.3), 1, 1.0, 1.0, 0.06); }
      }
    }
    this.shake *= Math.exp(-dt * 12);
    if ((this.goneAt >= 0 && t >= this.goneAt + 1.5 && !this.drops.busy && !this.bubbles.busy && !this.words.busy) || t >= MAX_T + 1) {
      this.playing = false;
      this.reset();
    }
  }

  private ride(pos: THREE.Vector3, dt: number) {
    this.spin += TUMBLE * dt;
    this.bucket.visible = true;
    this.bucket.position.set(pos.x, BOLT_Y, pos.z);
    // End over end around the line of flight, its wheels spinning with it.
    this.bucket.rotation.set(this.spin, Math.atan2(this.dir.x, this.dir.z), 0, 'YXZ');
    this.trailT += dt;
    if (this.trailT >= 0.035) {
      this.trailT = 0;
      this.v2.copy(pos).addScaledVector(this.dir, -0.5).setY(BOLT_Y + 0.2);
      this.drops.burst(this.v2, 2, 1.3, 1.8, 0.07, this.dir);
      if (Math.random() < 0.4) this.bubbles.emit(this.v2, 1, 0.2, 0.14, 0.4);
    }
  }

  /** It stops: the clang, the splash, the wet floor. `hit`: on a hero. */
  private land(at: THREE.Vector3, hit: boolean) {
    if (this.landed) return;
    this.landed = true;
    const ctx = this.ctx;
    if (this.goneAt < 0) this.goneAt = this.time;
    const x = at.x, z = at.z;
    this.bucket.position.set(x, 0.4, z);
    this.shake = hit ? 0.2 : 0.14;
    this.ripples.fire(x, z, 0.3, SPLASH_R, 0.6, 0.85, JANITOR.foam, true);
    this.ripples.fire(x, z, 0.2, SPLASH_R * 0.65, 0.45, 0.6, JANITOR.pale);
    this.ripples.fire(x, z, 0.2, SPLASH_R * 1.1, 0.8, 0.4, JANITOR.water);
    this.drops.burst(this.v1.set(x, 0.3, z), 28, 4.2, 5.2, 0.09);
    this.bubbles.emit(this.v1.set(x, 0.1, z), 14, SPLASH_R * 0.5, 0.2, 1.1);
    this.shock.set(this.v1.set(x, 0, z), 0.5 + 2.2, 0.04);
    this.pop.set(this.v1.set(x, 0.9, z), 1.6, 1, 0.2);
    this.v1.set(x, 2.1, z);
    this.words.show('CLANG', this.v1, 0.7, 1.1);
    // The wet floor: 2.5 m round, 6 s from now (both screens write it, each where it saw the bucket stop).
    if (ctx) {
      const now = performance.now();
      addWet(ctx.caster, { kind: 'splash', x, z, yaw: 0, length: 0, r: SPLASH_R, bornAt: now, until: now + WET_LIFE * 1000 });
    }
  }
}

export const mopBucketModule: EffectModule = {
  label: 'mop bucket',
  category: 'hero: janitor',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: BUCKET_RADIUS },
  create: () => new MopBucket(),
  telegraphs(effect) {
    const e = effect as MopBucket;
    if (!e.ctx) return [];
    const s = e.ctx.sentFrom ?? e.ctx.from;
    const spec: TelegraphSpec = { shape: { kind: 'line', x1: s.x, z1: s.z, x2: e.end.x, z2: e.end.z, width: LINE_W }, start: 0, impact: BUCKET_WIND };
    return [spec];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MopBucket;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as MopBucket).settings;
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
