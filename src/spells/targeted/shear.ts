import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BaaWords, Crook, Dust, SHEEP, Tufts, WoolBall, shornBodies } from '../../effects/parts/sheep';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import {
  SHEAR_DAMAGE, SHEAR_RADIUS, SHEAR_RANGE, SHEAR_REACH, SHEAR_SPEED, SHEAR_WIND, SHORN_SPEED, bookOf, nearestSheep,
} from '../../traits/sheep';

/**
 * Shear (sheep kit, E: wool for a throw). Bo needs a sheep within 6 m (the trait refuses the cast without one; the CPU holds it
 * back). He grabs the nearest sheep that still has its wool and shears it in one furious stroke: the fleece bursts off it in a
 * cloud of tufts and a loud *baaa*, and the sheep runs on naked, pink and fast (1.5 x speed, bleating) for the rest of its time. The
 * wool streams into his fist over the 0.25 s wind-up and he throws it as a real bolt (`ctx.projectile`: 8 m, 20 m/s, radius 0.3, so
 * it reaches 6 m at 0.55 s) spinning as a ball of wool: 40 damage, and the trait adds 3 Wool to the enemy (`dealt`, slot 2). A
 * sheep that is shorn cannot be shorn again, and the sheep that is shorn still bumps for Wool. With no sheep (a network duel has
 * none on this screen) only the throw plays. The ball is stopped by cover and units as any bolt. Telegraph: one line from Bo, as wide
 * as the bolt really hits (`boltWidth`), impact at the launch. Clean by about 1.4 s. See pipeline/designs/kit-sheep.md.
 */
export interface ShearSettings {
  damage: number;
  knock: number;
}

export const defaultShear = (): ShearSettings => ({ damage: SHEAR_DAMAGE, knock: 1.5 });

const DURATION = 1.4;
const MUZZLE = 0.8;
const LINE_W = boltWidth(SHEAR_RADIUS);
const BOLT_Y = 1.1;

export class Shear implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShearSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  spec: TelegraphSpec | null = null;
  private time = 0;
  private fired = false;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown by the drawn-only ball (-1: none, -2: done)
  private ended = false;
  private yaw = 0;
  private sheepAt = new THREE.Vector3();
  private hasSheep = false;
  private dir = new THREE.Vector3(0, 0, 1);
  private start = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private trailT = 0;
  private splatT = -1;
  private splatAt = new THREE.Vector3();

  private crook = new Crook();
  private ball = new WoolBall();
  private streak = new WoolBall();
  private tufts = new Tufts(60);
  private dust = new Dust(10);
  private words = new BaaWords(3);
  private star = new StarBurst({ points: 10, inner: 0.3, color: SHEEP.hay, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ShearSettings = defaultShear()) {
    this.settings = settings;
    this.group.add(this.tufts.mesh, this.dust.mesh, this.crook.mesh, this.ball.mesh, this.streak.mesh, this.words.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SHEAR_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.yaw = Math.atan2(dx, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    this.hand.set(s.x + dx * 0.5 + dz * 0.35, 1.2, s.z + dz * 0.5 - dx * 0.35);
    this.spec = {
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: s.x + dx * SHEAR_RANGE, z2: s.z + dz * SHEAR_RANGE, width: LINE_W },
      start: 0,
      impact: SHEAR_WIND,
      until: SHEAR_WIND + SHEAR_RANGE / SHEAR_SPEED,
    };
  }

  play() {
    this.reset();
    this.playing = true;
    this.shearOne();
  }

  /** Shears the nearest sheep that has its wool (the screen that has the flock): it runs on naked and fast. */
  private shearOne() {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = ctx.sentFrom ?? ctx.from;
    const u = nearestSheep(bookOf(ctx.caster), this.v1.set(s.x, 0, s.z), SHEAR_REACH);
    if (!u) return;
    shornBodies.add(u.figure.palette.body);
    u.opts.speed *= SHORN_SPEED;
    this.hasSheep = true;
    this.sheepAt.set(u.pos.x, 0, u.pos.z);
    this.v2.set(u.pos.x, 0.5, u.pos.z);
    this.tufts.burst(this.v2, 22, 5, 1.0);
    this.dust.ring(this.v1.set(u.pos.x, 0, u.pos.z), 0.5, 4, 0.5, SHEEP.dust);
    this.words.say(u.pos, 1.5, 1.3);
    this.shake = 0.1;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.bolt = null;
    this.drawn = -1;
    this.ended = false;
    this.hasSheep = false;
    this.trailT = 0;
    this.splatT = -1;
    this.tufts.reset();
    this.dust.reset();
    this.words.reset();
    this.crook.hide();
    this.ball.mesh.visible = false;
    this.streak.mesh.visible = false;
    this.star.set(this.hand, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.tufts.update(dt);
    this.dust.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;
    if (t >= DURATION) {
      this.playing = false;
      this.reset();
      return;
    }

    // --- Wind-up: the crook is shaken; the sheared wool streams from the sheep into his fist as a growing ball. ---
    if (t < SHEAR_WIND) {
      const k = t / SHEAR_WIND;
      this.crook.place(this.v1.set(this.hand.x - this.dir.z * 0.3, 1.2, this.hand.z + this.dir.x * 0.3), this.yaw, -0.4 + Math.sin(t * 60) * 0.1, Math.sin(t * 50) * 0.3);
      if (this.hasSheep) {
        this.streak.mesh.visible = true;
        this.streak.mesh.position.lerpVectors(this.v2.set(this.sheepAt.x, 0.7, this.sheepAt.z), this.hand, 1 - (1 - k) ** 2);
        this.streak.mesh.position.y += Math.sin(k * Math.PI) * 0.6;
        this.streak.mesh.scale.setScalar(0.5 + 0.5 * k);
        this.streak.spin(t);
      } else {
        this.ball.mesh.visible = true;
        this.ball.mesh.position.copy(this.hand);
        this.ball.mesh.scale.setScalar(0.4 + 0.6 * k);
        this.ball.spin(t);
      }
    }

    // --- The throw: a real bolt, or (a network duel's caster screen) a drawn one on the same line. ---
    if (!this.fired && t >= SHEAR_WIND) {
      this.fired = true;
      this.crook.hide();
      this.streak.mesh.visible = false;
      this.shake = Math.max(this.shake, 0.07);
      this.ball.mesh.visible = true;
      this.ball.mesh.scale.setScalar(1);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: SHEAR_SPEED, range: SHEAR_RANGE - MUZZLE, radius: SHEAR_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: '#c9b26a' },
        });
        const thrown = this.bolt;
        thrown.onHit((_target, at) => { if (this.bolt === thrown) this.splat(at); });
      } else {
        this.drawn = 0;
      }
    }

    // --- The ball rides the bolt, spinning, shedding tufts. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) this.ride(b.pos, dt);
    } else if (this.drawn >= 0) {
      this.drawn += SHEAR_SPEED * dt;
      live = this.drawn < SHEAR_RANGE - MUZZLE;
      if (live) this.ride(this.v1.copy(this.start).addScaledVector(this.dir, this.drawn), dt);
      else this.drawn = -2;
    }
    if (this.fired && !live && !this.ended) {
      this.ended = true;
      if (this.ball.mesh.visible) this.splat(this.v1.copy(this.ball.mesh.position));
    }
    if (this.fired && !this.ended) this.ball.spin(t);
    if (this.splatT >= 0) {
      const sp = StarBurst.pop(t - this.splatT, 0.03, 0.14);
      this.star.set(this.splatAt, 1.4 * sp.scale, sp.opacity, (t - this.splatT) * 5);
    }
    this.shake *= Math.exp(-dt * 12);
  }

  private ride(pos: THREE.Vector3, dt: number) {
    this.ball.mesh.visible = true;
    this.ball.mesh.position.set(pos.x, BOLT_Y, pos.z);
    this.trailT += dt;
    if (this.trailT >= 0.045) {
      this.trailT = 0;
      this.tufts.throw(this.v2.set(pos.x, BOLT_Y, pos.z), new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8, (Math.random() - 0.5) * 1.2), 0.1, 0.6);
    }
  }

  /** The ball bursts into tufts where it lands. */
  private splat(at: THREE.Vector3) {
    this.ended = true;
    this.ball.mesh.visible = false;
    this.v2.set(at.x, BOLT_Y, at.z);
    this.tufts.burst(this.v2, 18, 5.5, 1.1);
    this.splatAt.copy(this.v2);
    this.splatT = this.time;
    this.shake = 0.12;
  }
}

export const shearModule: EffectModule = {
  label: 'shear',
  category: 'hero: sheep',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: SHEAR_RADIUS },
  create: () => new Shear(),
  telegraphs(effect) {
    const e = effect as Shear;
    return e.ctx && e.spec ? [e.spec] : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Shear;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Shear).settings;
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
