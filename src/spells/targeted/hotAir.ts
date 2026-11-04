import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { BALLOON, BALLOON_CSS, Balloons, Bubbles, PopWords } from '../../effects/parts/balloon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { HOT_FLOAT, HOT_GLIDE, HOT_PUSH, HOT_RADIUS, HOT_WIND, KNOCK_PER_M } from '../../traits/balloon';

/**
 * Hot Air (balloon kit v5, E: a float away). Professor Puff pumps himself up: over the 0.4 s wind-up a bunch of three big shiny balloons
 * (pink, foil, sky) swells over his head on strings (they jiggle, bubbles are sucked in toward him, the word BLOAT floats up) while a ring marks
 * the 2.5 m circle round him. At 0.4 s the air lets go: a refraction ring, a star and a ring of puffs, and anyone inside 2.5 m of where he stood
 * (the enemy's live position then) is pushed 3 m (no damage). Then he floats 6 m AWAY from the aimed spot (`ctx.moveCaster`, 0.7 s, a little
 * lifted off the ground, the balloons riding above him and leaning back). A pale foil ring on the floor shows where he will come down, from
 * 0.2 s on. He lands, the balloons let go and drift up and away, shrinking. A mage who just spent his escape is out of position: nothing else
 * is granted.
 *
 * The landing spot comes from `sentFrom`, the aim point and the float length alone, so both screens draw the same ring; the balloons follow the
 * live figure. Clean by 2.4 s. See pipeline/designs/kit-balloon.md.
 */
export interface HotAirSettings {
  /** Metres he floats. */
  distance: number;
  /** Push in metres on whoever is within the circle where he left. */
  push: number;
}

export const defaultHotAir = (): HotAirSettings => ({ distance: HOT_FLOAT, push: HOT_PUSH });

// Timeline (seconds).
const DURATION = 2.4;
const LIFT = 0.9;
const BUNCH: { dx: number; dy: number; dz: number; tint: 'pink' | 'foil' | 'sky'; s: number }[] = [
  { dx: 0, dy: 2.7, dz: 0, tint: 'pink', s: 1.0 },
  { dx: -0.6, dy: 2.35, dz: 0.15, tint: 'foil', s: 0.75 },
  { dx: 0.6, dy: 2.25, dz: -0.15, tint: 'sky', s: 0.7 },
];

export class HotAir implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HotAirSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where he stood at the cast (the push circle). */
  readonly origin = new THREE.Vector3();
  private time = 0;
  private flags = { wordSaid: false, burst: false, moved: false, landed: false };
  private ids: number[] = [];
  private landedAt = -1;
  private suckT = 0;
  private lift = 0;

  private dir = new THREE.Vector3(0, 0, -1);
  private landing = new THREE.Vector3();

  private balloons = new Balloons(3);
  private bubbles = new Bubbles(90);
  private words = new PopWords(1);
  private star = new StarBurst({ points: 10, inner: 0.3, color: BALLOON.body, core: 0xffffff, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private landRing = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: BALLOON.foil, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private landDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: BALLOON.dark, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private pushRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: BALLOON.hot, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );

  private lifter = new THREE.Vector3();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: HotAirSettings = defaultHotAir()) {
    this.settings = settings;
    this.landDisc.renderOrder = 1;
    this.landRing.renderOrder = 2;
    this.pushRing.renderOrder = 2;
    this.screen.tint.set(BALLOON.dark);
    this.group.add(this.landDisc, this.landRing, this.pushRing, this.balloons.mesh, this.bubbles.mesh, this.words.mesh, this.star.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HOT_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.origin.set(s.x, 0, s.z);
    // He floats away from the aimed spot: pointing at the danger backs him off it.
    let dx = s.x - ctx.point.x, dz = s.z - ctx.point.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.3) { dx = -Math.sin(ctx.aim); dz = -Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.landing.set(s.x + dx * this.settings.distance, 0, s.z + dz * this.settings.distance);
    this.screen.silhouettes = [ctx.caster.group];
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private setLift(y: number) {
    this.lift = y;
    this.ctx?.displace(this.ctx.caster, this.lifter.set(0, y, 0));
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landedAt = -1;
    this.suckT = 0;
    const f = this.flags;
    f.wordSaid = f.burst = f.moved = f.landed = false;
    this.ids = [];
    if (this.lift !== 0) this.setLift(0);
    clearScreenFx(this.screen);
    this.screen.tint.set(BALLOON.dark);
    this.balloons.reset();
    this.bubbles.reset();
    this.words.reset();
    this.star.set(this.origin, 0, 0);
    this.shock.set(this.origin, 0, 0);
    (this.landRing.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.landDisc.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.pushRing.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.balloons.update(dt);
    this.bubbles.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.playing = false;
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time, ctx = this.ctx, f = this.flags;
    const body = ctx ? ctx.caster.group.position : this.origin;

    // --- Wind-up: the bunch is pumped up over his head; air is sucked in toward him; BLOAT. ---
    if (this.ids.length === 0) {
      for (const b of BUNCH) this.ids.push(this.balloons.place(this.v1.set(body.x + b.dx, body.y + b.dy, body.z + b.dz), b.tint, MIN_S));
    }
    if (!f.wordSaid && t >= 0.05) {
      f.wordSaid = true;
      this.v1.set(body.x, 3.9, body.z);
      this.words.show('BLOAT', this.v1, 1.2, 1.0);
    }
    if (t < HOT_WIND) {
      this.suckT += dt;
      if (this.suckT >= 0.045) {
        this.suckT = 0;
        const a = Math.random() * 6.28, r = HOT_RADIUS * (0.8 + Math.random() * 0.2);
        this.v1.set(body.x + Math.cos(a) * r, 0.5 + Math.random() * 1.6, body.z + Math.sin(a) * r);
        this.v2.set(body.x - this.v1.x, 1.4 - this.v1.y, body.z - this.v1.z).multiplyScalar(2.2);
        this.bubbles.emit(this.v1, this.v2, 0.18, 0.06, 0.45, BALLOON.hot, 0, 0, 0);
      }
    }

    // --- The landing ring, from 0.2 s: where he will come down. ---
    const lr = this.landRing.material as THREE.MeshBasicMaterial, ld = this.landDisc.material as THREE.MeshBasicMaterial;
    if (t >= 0.2 && !f.landed) {
      const k = smoothstep((t - 0.2) / 0.2);
      this.landRing.position.set(this.landing.x, 0.07, this.landing.z);
      this.landRing.scale.setScalar(0.9 * (1.15 - 0.15 * k) + 0.05 * Math.sin(t * 14));
      lr.opacity = 0.9 * k;
      this.landDisc.position.set(this.landing.x, 0.06, this.landing.z);
      this.landDisc.scale.setScalar(0.9);
      ld.opacity = 0.28 * k;
    } else if (f.landed) {
      const a = t - this.landedAt;
      lr.opacity = 0.9 * (1 - smoothstep(a / 0.4));
      ld.opacity = 0.28 * (1 - smoothstep(a / 0.4));
    }

    // --- 0.4 The air lets go where he stood: a push, a ring, a star, puffs. ---
    if (!f.burst && t >= HOT_WIND) {
      f.burst = true;
      this.letGo(ctx);
    }
    if (f.burst) {
      const a = t - HOT_WIND;
      const sp = StarBurst.pop(a, 0.04, 0.16);
      this.v1.set(this.origin.x, 1.2, this.origin.z);
      this.star.set(this.v1, 2.4 * sp.scale, sp.opacity, a * 2);
      const g = smoothstep(a / 0.4);
      this.shock.set(this.v2.set(this.origin.x, 0, this.origin.z), 0.5 + HOT_RADIUS * g, 0.05 * (1 - g) * (1 - g));
      const pr = this.pushRing.material as THREE.MeshBasicMaterial;
      this.pushRing.position.set(this.origin.x, 0.08, this.origin.z);
      this.pushRing.scale.setScalar(0.4 + (HOT_RADIUS - 0.4) * g);
      pr.opacity = 0.8 * (1 - g);
    }

    // --- The glide: he floats away, a little lifted; the balloons ride above and lean back. ---
    if (f.burst && !f.moved) {
      f.moved = true;
      if (ctx?.moveCaster) this.landing.copy(ctx.moveCaster(this.landing, HOT_GLIDE)).setY(0);
    }
    if (f.moved && !f.landed) {
      const a = t - HOT_WIND, k = Math.min(1, a / HOT_GLIDE);
      this.setLift(LIFT * smoothstep(a / 0.18) * (1 - smoothstep((a - (HOT_GLIDE - 0.22)) / 0.22)));
      if (k >= 1) {
        f.landed = true;
        this.landedAt = t;
        this.setLift(0);
        this.touchdown();
      }
    }

    // --- The bunch: it swells over the wind-up, rides above him, and after landing drifts up and away, shrinking. ---
    if (this.ids.length) {
      const lead = f.moved && !f.landed ? 0.35 : 0;
      for (let i = 0; i < this.ids.length; i++) {
        const b = BUNCH[i];
        if (f.landed) {
          const a = t - this.landedAt;
          const k = smoothstep(a / 0.9);
          this.v1.set(body.x + b.dx * (1 + k), body.y + b.dy + 0.2 + k * (3 + i), body.z + b.dz * (1 + k) + k * (i - 1));
          this.balloons.move(this.ids[i], this.v1);
          this.balloons.setScale(this.ids[i], Math.max(MIN_S, b.s * (1 - 0.9 * smoothstep((a - 0.1) / 0.8))));
        } else {
          const swell = smoothstep((t - i * 0.04) / (HOT_WIND - 0.05));
          this.v1.set(body.x + b.dx - this.dir.x * lead, body.y + b.dy + this.lift * 0.5, body.z + b.dz - this.dir.z * lead);
          this.balloons.move(this.ids[i], this.v1);
          this.balloons.setScale(this.ids[i], Math.max(MIN_S, b.s * swell));
          this.balloons.jiggle(this.ids[i], t < HOT_WIND ? 0.1 + 0.2 * swell : 0.08);
        }
      }
    }
    this.shake *= Math.exp(-dt * 10);
  }

  /** The air lets go where he stood: push whoever is inside now (no damage), and the burst. */
  private letGo(ctx: CastContext | null) {
    const o = this.origin;
    if (ctx) {
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const p = e.group.position;
        if (Math.hypot(p.x - o.x, p.z - o.z) <= HOT_RADIUS) {
          ctx.hit(e, { damage: 0, knock: this.settings.push * KNOCK_PER_M, from: this.v2.set(o.x, 0, o.z).clone(), color: BALLOON_CSS.hot });
        }
      }
    }
    this.v1.set(o.x, 1.0, o.z);
    this.bubbles.ring(this.v1, 12, 5.5, 0.9, 0.7, BALLOON.hot, 1);
    this.bubbles.ring(this.v1, 8, 4, 0.35, 0.9, BALLOON.hot, 0);
    this.shake = 0.18;
  }

  /** He comes down: a ring of puffs and bubbles at the landing spot. */
  private touchdown() {
    this.v1.set(this.landing.x, 0.4, this.landing.z);
    this.bubbles.ring(this.v1, 8, 3, 0.7, 0.6, BALLOON.hot, 1);
    this.bubbles.ring(this.v1, 6, 2.4, 0.3, 0.8, BALLOON.hot, 0);
    this.shake = Math.max(this.shake, 0.1);
  }
}

const MIN_S = 1e-3;

export const hotAirModule: EffectModule = {
  label: 'hot air',
  category: 'hero: balloon',
  targeting: { mode: 'ground', radius: HOT_RADIUS },
  create: () => new HotAir(),
  telegraphs(effect) {
    const e = effect as HotAir;
    if (!e.ctx) return [];
    // The circle round him where the air lets go: the push is the only hit. The landing is drawn by the effect (it hits nothing).
    return [{ shape: { kind: 'circle', x: e.origin.x, z: e.origin.z, radius: HOT_RADIUS }, start: 0, impact: HOT_WIND }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as HotAir;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as HotAir).settings;
    f.add(s, 'distance', 2, 9, 0.5);
    f.add(s, 'push', 0, 6, 0.5);
  },
};
