import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { CHEF, CHEF_CSS, Chunks, Vapour, buildCleaver } from '../../effects/parts/chef';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import { CLEAVER_DAMAGE, CLEAVER_RADIUS, CLEAVER_RANGE, CLEAVER_SPEED, CLEAVER_WIND, addDish } from '../../traits/chef';

/**
 * Thrown Cleaver (chef kit v5, Q: a skillshot that leaves a dish). Madame Cleaver swings her great steel cleaver up over her
 * shoulder (0.25 s wind-up, it grows in her hand and turns faster) and throws it as a real bolt (`ctx.projectile`: 9 m from her,
 * 20 m/s, radius 0.3) that TUMBLES end over end, with three pale after-images behind it: 50 damage. It reaches 6 m at 0.55 s.
 *
 * Where it stops (the cleaver bites into the floor, quivering, and a dish plops out beside it) comes from a pure path of `sentFrom`,
 * the aim and `ctx.obstacles()` (`bankPath`, no bounces), so both screens of a network duel put the dish at the same spot with the
 * same id: the end of the line (9 m, or the first cover), hit or not. A cleaver that hits somebody tumbles on to that spot as a
 * drawn-only one, so the dish is never short of a place to land: it is food that can be stolen from behind the target. The dish is
 * a fresh dish (`addDish`, `src/traits/chef.ts`) the moment the cleaver stops.
 *
 * Telegraph: one thin line as wide as the bolt really hits (`boltWidth`), from her to where it stops, impact at the launch (0.25 s,
 * which roots her until then). Network duels: bolts fly on the victim's screen, so her own screen draws the same bolt along the
 * same line. Clean by about 2.4 s. See pipeline/designs/kit-chef.md.
 */
export interface ThrownCleaverSettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultThrownCleaver = (): ThrownCleaverSettings => ({ damage: CLEAVER_DAMAGE, knock: 2, loop: false });

// Timeline and numbers.
const MUZZLE = 0.8;
const LINE_W = boltWidth(CLEAVER_RADIUS);
const FLY_Y = 1.25;
const GHOSTS = 3;
const MAX_T = 3.2;
const STUCK_FOR = 1.0;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const MIN = 1e-3;

/** A translucent copy of a built object: an after-image. */
function ghostOf(src: THREE.Object3D, opacity: number) {
  const g = src.clone(true);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = new THREE.MeshBasicMaterial({ color: CHEF.core, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  });
  return g;
}

export class ThrownCleaver implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThrownCleaverSettings;
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
  private bolt: Projectile | null = null;
  private hitAt = new THREE.Vector3();
  private hitT = -9;
  private flightEnd = 0;

  private dir = new THREE.Vector3(0, 0, 1);
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dishAt = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private len = 0;

  private holder = new THREE.Group();
  private spin = new THREE.Group();
  private cleaver = buildCleaver(1.15);
  private ghosts: THREE.Object3D[] = [];
  private vapour = new Vapour(40);
  private crumbs = new Chunks(24);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: CHEF.core, core: 0xffffff, additive: false });
  private hitStar = new StarBurst({ points: 8, inner: 0.3, color: CHEF.foil, core: CHEF.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CHEF.core, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private v1 = new THREE.Vector3();

  constructor(settings: ThrownCleaverSettings = defaultThrownCleaver()) {
    this.settings = settings;
    this.spin.add(this.cleaver);
    this.holder.add(this.spin);
    this.group.add(this.holder, this.vapour.mesh, this.crumbs.mesh, this.pop.mesh, this.hitStar.mesh, this.shock.mesh, this.ring);
    for (let i = 0; i < GHOSTS; i++) {
      const gh = ghostOf(this.cleaver, 0.28 - i * 0.07);
      gh.visible = false;
      this.ghosts.push(gh);
      this.group.add(gh);
    }
    this.ring.renderOrder = 3;
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return CLEAVER_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the spot: only sentFrom, the aim point and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= l; dz /= l; }
    this.dir.set(dx, 0, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    const path = bankPath(this.start, this.dir, CLEAVER_RANGE - MUZZLE, 0, ctx.obstacles?.() ?? [], 0);
    const e = path[path.length - 1];
    this.end.set(e.x, 0, e.z);
    this.len = Math.hypot(e.x - this.start.x, e.z - this.start.z);
    // A quarter metre short of cover it stopped at, so the dish can be reached.
    const blocked = this.len < CLEAVER_RANGE - MUZZLE - 0.01;
    this.dishAt.copy(this.end).addScaledVector(this.dir, blocked ? -0.3 : 0);
    this.flightEnd = CLEAVER_WIND + this.len / CLEAVER_SPEED;
    this.specs = [{
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: e.x, z2: e.z, width: LINE_W },
      start: 0,
      impact: CLEAVER_WIND,
      until: this.flightEnd,
    }];
    // Her hand: over her right shoulder.
    this.hand.set(ctx.from.x - this.dir.z * 0.35 + this.dir.x * 0.2, 1.9, ctx.from.z + this.dir.x * 0.35 + this.dir.z * 0.2);
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
    this.holder.visible = false;
    for (const g of this.ghosts) g.visible = false;
    this.vapour.reset();
    this.crumbs.reset();
    this.pop.set(this.end, 0, 0);
    this.hitStar.set(this.end, 0, 0);
    this.shock.set(this.end, 0, 0);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.vapour.update(dt);
    this.crumbs.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;
    const yaw = Math.atan2(this.dir.x, this.dir.z);

    // --- Wind-up: the cleaver is swung up over her shoulder, growing and turning faster. ---
    if (t < CLEAVER_WIND) {
      const k = t / CLEAVER_WIND;
      this.holder.visible = true;
      this.holder.position.copy(this.hand);
      this.holder.rotation.y = yaw;
      this.holder.scale.setScalar(Math.max(easeOut(k), MIN));
      this.spin.rotation.x = -1.2 + 2.2 * easeOut(k);
    }

    // --- Fire: a real bolt where there is one; the cleaver we draw rides the same line either way. ---
    if (!this.fired && t >= CLEAVER_WIND) {
      this.fired = true;
      this.shake = 0.06;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: CLEAVER_SPEED, range: CLEAVER_RANGE - MUZZLE, radius: CLEAVER_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: CHEF_CSS.core },
        });
        this.bolt.onHit((_target, at) => {
          this.hitAt.set(at.x, FLY_Y, at.z);
          this.hitT = this.time;
          this.hitStar.set(this.hitAt, 1.6, 1, 0);
          this.crumbs.burst(this.hitAt, 8, [CHEF.steel, CHEF.core, CHEF.foil], 3, 3, 0.09);
          this.shake = 0.14;
        });
      }
      this.vapour.burst(this.v1.set(this.start.x, 1.3, this.start.z), 4, CHEF.core, 0.6, 1.2, 0.3, 0.6);
    }

    // --- Flight: tumbling end over end, with after-images; then it bites into the floor. ---
    if (this.fired && t >= CLEAVER_WIND && !this.landed) {
      const d = Math.min(this.len, CLEAVER_SPEED * (t - CLEAVER_WIND));
      this.holder.visible = true;
      this.holder.scale.setScalar(1);
      this.holder.rotation.y = yaw;
      this.holder.position.set(this.start.x + this.dir.x * d, FLY_Y, this.start.z + this.dir.z * d);
      this.spin.rotation.x = 26 * (t - CLEAVER_WIND) + 1;
      for (let i = 0; i < GHOSTS; i++) {
        const g = this.ghosts[i], back = (i + 1) * 0.55;
        g.visible = d > back * 0.6;
        g.position.set(this.start.x + this.dir.x * Math.max(0, d - back), FLY_Y, this.start.z + this.dir.z * Math.max(0, d - back));
        g.rotation.y = yaw;
        g.rotation.order = 'YXZ';
        g.rotation.x = this.spin.rotation.x - (i + 1) * 0.85;
      }
      if (d >= this.len) this.land();
    }

    // --- Stuck in the floor: it quivers, then drops away. ---
    if (this.landed) {
      const a = t - this.landT;
      for (const g of this.ghosts) g.visible = false;
      this.holder.rotation.y = yaw;
      this.spin.rotation.x = Math.PI / 2 + 0.22 * Math.sin(a * 36) * Math.exp(-a * 4);
      const out = a > STUCK_FOR ? Math.max(0, 1 - (a - STUCK_FOR) / 0.25) : 1;
      this.holder.scale.setScalar(Math.max(out, MIN));
      this.holder.visible = out > 0.01;
      const k = Math.min(1, a / 0.35);
      this.pop.set(this.v1.set(this.dishAt.x, 0.5, this.dishAt.z), 2.2 * StarBurst.pop(a, 0.04, 0.16).scale, StarBurst.pop(a, 0.04, 0.16).opacity, a * 3);
      this.shock.set(this.dishAt, 0.4 + 2.6 * k, 0.04 * (1 - k) * (1 - k));
      this.ring.position.set(this.dishAt.x, 0.07, this.dishAt.z);
      this.ring.scale.setScalar(0.4 + 1.6 * k);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    }
    // A hit's star pops and goes.
    if (this.hitT > 0) {
      const a = t - this.hitT, p = StarBurst.pop(a, 0.04, 0.18);
      this.hitStar.set(this.hitAt, 1.6 * p.scale, p.opacity, a * 4);
    }
    this.shake *= Math.exp(-dt * 12);

    if (t >= MAX_T || (this.landed && t >= this.landT + STUCK_FOR + 0.4 && !this.vapour.busy && !this.crumbs.busy)) {
      const loop = s.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  /** The cleaver stops: it bites into the floor and a dish plops out beside it. */
  private land() {
    this.landed = true;
    this.landT = this.time;
    this.holder.position.set(this.end.x, 0.5, this.end.z);
    this.shake = Math.max(this.shake, 0.18);
    this.vapour.burst(this.v1.set(this.dishAt.x, 0.3, this.dishAt.z), 9, CHEF.core, 1.8, 1.6, 0.45, 1.2);
    this.crumbs.burst(this.v1.set(this.dishAt.x, 0.4, this.dishAt.z), 10, [CHEF.roast, CHEF.leaf, CHEF.core, CHEF.foil], 3.2, 4.5, 0.1);
    if (this.ctx) addDish(this.ctx.caster, this.dishAt.x, this.dishAt.z, false);
  }
}

export const thrownCleaverModule: EffectModule = {
  label: 'thrown cleaver',
  category: 'hero: chef',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: CLEAVER_RADIUS },
  create: () => new ThrownCleaver(),
  telegraphs(effect) {
    const e = effect as ThrownCleaver;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ThrownCleaver;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ThrownCleaver).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
