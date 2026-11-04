import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { COURIER, COURIER_CSS, Flecks, buildLetter } from '../../effects/parts/courier';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import { LETTER_DAMAGE, LETTER_PER_CHARGE, LETTER_RADIUS, LETTER_RANGE, LETTER_SPEED, LETTER_WIND, bookOf } from '../../traits/courier';

/**
 * Express Letter (courier kit v5, Q: a skillshot that grows with his Charges). Pip pulls an airmail envelope out of his enormous bag
 * over the 0.25 s wind-up (it grows in his hand and turns faster) and flicks it as a real bolt (`ctx.projectile`: 8 m from him,
 * 24 m/s, radius 0.3) that FLUTTERS and SPINS about its line of flight, trailing scraps of paper and one translucent after-image per
 * Charge: 35 damage, +15 for each Charge he holds (read from `courierBooks` at the cast, which both screens fill from his shown
 * Charges), and the envelope grows with them. It reaches 6 m at 0.5 s. Where it hits, or where its line ends (8 m, or the first
 * cover), it bursts into paper.
 *
 * Telegraph: one thin line as wide as the bolt really hits (`boltWidth`), from him to where it stops, impact at the launch (0.25 s,
 * which roots him until then). Network duels: bolts fly on the victim's screen, so his own screen draws the same envelope along the
 * same line. Clean by about 2 s. See pipeline/designs/kit-courier.md.
 */
export interface ExpressLetterSettings {
  /** Damage with no Charge, and what each Charge adds. */
  damage: number;
  perCharge: number;
  knock: number;
  loop: boolean;
}

export const defaultExpressLetter = (): ExpressLetterSettings => ({ damage: LETTER_DAMAGE, perCharge: LETTER_PER_CHARGE, knock: 1.5, loop: false });

// Timeline and numbers.
const MUZZLE = 0.8;
const LINE_W = boltWidth(LETTER_RADIUS);
const FLY_Y = 1.2;
const MAX_T = 2.0;
const MAX_GHOSTS = 3;
const MIN = 1e-3;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** A translucent copy of a built object: an after-image. */
function ghostOf(src: THREE.Object3D, opacity: number) {
  const g = src.clone(true);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = new THREE.MeshBasicMaterial({ color: COURIER.cream, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  });
  return g;
}

export class ExpressLetter implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ExpressLetterSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The thin line of the bolt. */
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private landed = false;
  private landT = 0;
  private charges = 0;
  private bolt: Projectile | null = null;
  private hitAt = new THREE.Vector3();
  private hitT = -9;
  private trailT = 0;

  private dir = new THREE.Vector3(0, 0, 1);
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private len = 0;
  private flightEnd = 0;

  private holder = new THREE.Group();
  private spin = new THREE.Group();
  private letter = buildLetter();
  private ghosts: THREE.Object3D[] = [];
  private bits = new Flecks(48);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: COURIER.accent, core: 0xffffff, additive: false });
  private hitStar = new StarBurst({ points: 8, inner: 0.3, color: COURIER.blueLight, core: COURIER.cream, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();

  constructor(settings: ExpressLetterSettings = defaultExpressLetter()) {
    this.settings = settings;
    this.spin.add(this.letter);
    this.holder.add(this.spin);
    this.group.add(this.holder, this.bits.mesh, this.pop.mesh, this.hitStar.mesh, this.shock.mesh);
    for (let i = 0; i < MAX_GHOSTS; i++) {
      const gh = ghostOf(this.letter, 0.3 - i * 0.07);
      gh.visible = false;
      this.ghosts.push(gh);
      this.group.add(gh);
    }
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return LETTER_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line: only sentFrom, the aim point and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= l; dz /= l; }
    this.dir.set(dx, 0, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    const path = bankPath(this.start, this.dir, LETTER_RANGE - MUZZLE, 0, ctx.obstacles?.() ?? [], 0);
    const e = path[path.length - 1];
    this.end.set(e.x, 0, e.z);
    this.len = Math.hypot(e.x - this.start.x, e.z - this.start.z);
    this.flightEnd = LETTER_WIND + this.len / LETTER_SPEED;
    this.charges = Math.min(3, bookOf(ctx.caster).charge);
    this.specs = [{
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: e.x, z2: e.z, width: LINE_W },
      start: 0,
      impact: LETTER_WIND,
      until: this.flightEnd,
    }];
    // His hand: out to the right, at the height of the bag's flap.
    this.hand.set(ctx.from.x + this.dir.z * 0.45 + this.dir.x * 0.3, 1.1, ctx.from.z - this.dir.x * 0.45 + this.dir.z * 0.3);
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
    this.landT = 0;
    this.bolt = null;
    this.hitT = -9;
    this.trailT = 0;
    this.holder.visible = false;
    for (const g of this.ghosts) g.visible = false;
    this.bits.reset();
    this.pop.set(this.end, 0, 0);
    this.hitStar.set(this.end, 0, 0);
    this.shock.set(this.end, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;
    const yaw = Math.atan2(this.dir.x, this.dir.z) - Math.PI / 2;
    const grow = 1 + 0.14 * this.charges;

    // --- Wind-up: the envelope is drawn out at his hand, growing and turning faster. ---
    if (t < LETTER_WIND) {
      const k = t / LETTER_WIND;
      this.holder.visible = true;
      this.holder.position.copy(this.hand);
      this.holder.rotation.y = yaw;
      this.holder.scale.setScalar(Math.max(easeOut(k) * grow, MIN));
      this.spin.rotation.x = 6 * t * (1 + 3 * k);
      this.spin.rotation.z = 0.3 * Math.sin(t * 30);
      this.trailT += dt;
      if (this.trailT >= 0.06) { this.trailT = 0; this.bits.burst(this.hand, 1, [COURIER.cream], 0.8, 0.8, 0.12); }
    }

    // --- Fire: a real bolt where there is one; the envelope we draw rides the same line either way. ---
    if (!this.fired && t >= LETTER_WIND) {
      this.fired = true;
      this.shake = 0.05;
      const damage = Math.round(s.damage + s.perCharge * this.charges);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: LETTER_SPEED, range: LETTER_RANGE - MUZZLE, radius: LETTER_RADIUS,
          hit: { damage, knock: s.knock, color: COURIER_CSS.accent },
        });
        this.bolt.onHit((_target, at) => this.onHit(at));
      }
      this.bits.burst(this.v1.set(this.start.x, 1.2, this.start.z), 6, [COURIER.cream, COURIER.foil, COURIER.paper], 2, 1.5, 0.14);
    }

    // --- Flight: it flutters and spins about its line, with after-images and a trail of scraps. ---
    if (this.fired && !this.landed) {
      const a = t - LETTER_WIND, d = Math.min(this.len, LETTER_SPEED * a);
      this.holder.visible = true;
      this.holder.scale.setScalar(grow);
      this.holder.rotation.y = yaw;
      this.holder.position.set(this.start.x + this.dir.x * d, FLY_Y + 0.07 * Math.sin(a * 36), this.start.z + this.dir.z * d);
      this.spin.rotation.x = 40 * a + 1;
      this.spin.rotation.z = 0.35 * Math.sin(a * 46);
      for (let i = 0; i < MAX_GHOSTS; i++) {
        const g = this.ghosts[i], back = (i + 1) * 0.6;
        g.visible = i < Math.max(1, this.charges) && d > back * 0.6;
        const dd = Math.max(0, d - back);
        g.position.set(this.start.x + this.dir.x * dd, FLY_Y + 0.07 * Math.sin((a - back / LETTER_SPEED) * 36), this.start.z + this.dir.z * dd);
        g.rotation.set(0, yaw, 0);
        g.scale.setScalar(grow * (1 - i * 0.08));
        g.rotateX(this.spin.rotation.x - (i + 1) * 0.9);
      }
      this.trailT += dt;
      if (this.trailT >= 0.035) {
        this.trailT = 0;
        this.bits.burst(this.v1.copy(this.holder.position).addScaledVector(this.dir, -0.5), 1, [COURIER.cream, COURIER.paper, COURIER.foil], 0.9, 0.6, 0.1, 0.8);
      }
      if (d >= this.len || (this.bolt && !this.bolt.alive)) this.land(this.holder.position);
    }

    // --- Where it ends: a puff of paper, and a ring on the floor like a postmark. ---
    if (this.landed) {
      const a = t - this.landT, k = Math.min(1, a / 0.4);
      this.shock.set(this.v1.set(this.hitAt.x, 0, this.hitAt.z), 0.4 + 2.2 * k, 0.04 * (1 - k) * (1 - k));
      const p = StarBurst.pop(a, 0.03, 0.15);
      this.pop.set(this.hitAt, 0.9 * p.scale, p.opacity, a * 3);
    }
    if (this.hitT > 0) {
      const a = t - this.hitT, p = StarBurst.pop(a, 0.04, 0.18);
      this.hitStar.set(this.hitAt, (1.2 + 0.3 * this.charges) * p.scale, p.opacity, a * 4);
    }
    this.shake *= Math.exp(-dt * 12);

    if (t >= MAX_T || (this.landed && t >= this.landT + 0.9 && !this.bits.busy)) {
      const loop = s.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  /** The envelope hit someone: a star and a shower of paper, bigger with each Charge. */
  private onHit(at: THREE.Vector3) {
    this.hitAt.set(at.x, FLY_Y, at.z);
    this.hitT = this.time;
    this.hitStar.set(this.hitAt, 1.2, 1, 0);
    this.shake = 0.12 + 0.03 * this.charges;
    this.bits.burst(this.hitAt, 12 + 4 * this.charges, [COURIER.cream, COURIER.foil, COURIER.red, COURIER.accent], 4.5, 3.5, 0.17);
  }

  /** The envelope ends its flight (its line ran out, or it hit): it is gone in a puff. */
  private land(at: THREE.Vector3) {
    this.landed = true;
    this.landT = this.time;
    if (this.hitT < 0) this.hitAt.set(at.x, FLY_Y, at.z);
    this.holder.visible = false;
    for (const g of this.ghosts) g.visible = false;
    this.bits.burst(this.hitAt, this.hitT > 0 ? 4 : 9, [COURIER.cream, COURIER.paper, COURIER.foil], 2.4, 2, 0.15);
    this.shake = Math.max(this.shake, 0.06);
  }
}

export const expressLetterModule: EffectModule = {
  label: 'express letter',
  category: 'hero: courier',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: LETTER_RADIUS },
  create: () => new ExpressLetter(),
  telegraphs(effect) {
    const e = effect as ExpressLetter;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ExpressLetter;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ExpressLetter).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'perCharge', 0, 60, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
