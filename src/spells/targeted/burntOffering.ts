import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { CHEF, Chunks, Vapour, buildBurntPlate } from '../../effects/parts/chef';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { BURNT_FLIGHT, BURNT_RANGE, addDish } from '../../traits/chef';

/**
 * Burnt Offering (chef kit v5, E: bait). Madame Cleaver spins a blackened plate out of her hand in a high arc (8 m at the most, at
 * least 2 m, 0.55 s in the air): a charred plate with black lumps and red embers on it, trailing dark smoke and sparks. It lands
 * with a clatter (a red ring runs out over the floor, black smoke, embers) and stays: a burnt dish on the floor (`addDish`, burnt),
 * black and smoking with a red ember ring, for 8 s like any dish, on both screens.
 *
 * It does nothing when it lands. Whoever walks over it eats it: the enemy takes 60 and is stunned 0.8 s (decided in `victimTick`,
 * `src/traits/chef.ts`); on Madame Cleaver it does nothing and the dish stays. The spot comes only from `sentFrom` and `point`, so both
 * screens put it in the same place with the same id. The telegraph is the dish's footprint (a 0.9 m circle, the eating reach, impact
 * at the landing), a warning that costs her the 0.55 s root. Clean by 1.7 s. See pipeline/designs/kit-chef.md.
 */
export interface BurntOfferingSettings {
  loop: boolean;
}

export const defaultBurntOffering = (): BurntOfferingSettings => ({ loop: false });

// Timeline and numbers.
const LAND_T = BURNT_FLIGHT;
const END_T = 1.7;
const MIN_DIST = 2;
const APEX = 2.6;
const FOOT_R = 0.9;
const MIN = 1e-3;

export class BurntOffering implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BurntOfferingSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the plate lands, from sentFrom and point only. */
  readonly centre = new THREE.Vector3(0, 0, 6);
  private time = 0;
  private landed = false;
  private trailT = 0;
  private from = new THREE.Vector3();

  private plate = buildBurntPlate();
  private spin = new THREE.Group();
  private smoke = new Vapour(60);
  private embers = new Chunks(40);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: CHEF.foil, core: CHEF.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CHEF.foil, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private scorch = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CHEF.black, transparent: true, depthWrite: false, opacity: 0 }),
  );
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BurntOfferingSettings = defaultBurntOffering()) {
    this.settings = settings;
    this.spin.add(this.plate);
    this.ring.renderOrder = 3;
    this.scorch.renderOrder = 1;
    this.group.add(this.scorch, this.ring, this.spin, this.smoke.mesh, this.embers.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return END_T;
  }

  get impactTime() {
    return LAND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the spot: only sentFrom and point.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = MIN_DIST; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, BURNT_RANGE);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
    this.from.set(ctx.from.x + dx * 0.5, 1.5, ctx.from.z + dz * 0.5);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = false;
    this.trailT = 0;
    this.spin.visible = false;
    this.smoke.reset();
    this.embers.reset();
    this.pop.set(this.centre, 0, 0);
    this.shock.set(this.centre, 0, 0);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.scorch.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smoke.update(dt);
    this.embers.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, C = this.centre;
    if (t >= END_T && !this.smoke.busy && !this.embers.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- Flight: a high arc, the plate turning, smoke and sparks behind it. ---
    if (t < LAND_T) {
      const k = t / LAND_T;
      this.spin.visible = true;
      this.v1.set(this.from.x + (C.x - this.from.x) * k, this.from.y * (1 - k) + 0.3 * k + APEX * 4 * k * (1 - k), this.from.z + (C.z - this.from.z) * k);
      this.spin.position.copy(this.v1);
      this.spin.scale.setScalar(Math.max(MIN, Math.min(1, t / 0.08)) * 1.1);
      this.spin.rotation.set(0.5 * Math.sin(t * 9), t * 14, 0.4 * Math.cos(t * 7));
      this.trailT += dt;
      if (this.trailT >= 0.03) {
        this.trailT = 0;
        this.smoke.burst(this.v1, 1, CHEF.smoke, 0.5, 0.5, 0.42, 0.8);
        this.embers.burst(this.v2.copy(this.v1), 1, [CHEF.foil, CHEF.tomato], 0.8, 0.8, 0.07);
      }
      // The spot it comes down on: a dark mark and a red ring, so the landing is read before it happens.
      const sm = this.scorch.material as THREE.MeshBasicMaterial;
      this.scorch.position.set(C.x, 0.03, C.z);
      this.scorch.scale.setScalar(FOOT_R * (0.4 + 0.5 * k));
      sm.opacity = 0.35 * k;
    } else if (!this.landed) {
      this.landed = true;
      this.land();
    }

    // --- The landing: it bounces once and lies still. ---
    if (this.landed) {
      const a = t - LAND_T;
      const bounce = 0.55 * Math.exp(-a * 8) * Math.abs(Math.sin(a * 16));
      this.spin.visible = a < 0.55;
      this.spin.position.set(C.x, 0.02 + bounce, C.z);
      this.spin.rotation.set(0.3 * Math.exp(-a * 7) * Math.sin(a * 22), a * 10 * Math.exp(-a * 5), 0);
      const k = Math.min(1, a / 0.4);
      this.ring.position.set(C.x, 0.07, C.z);
      this.ring.scale.setScalar(0.5 + 2.4 * k);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      this.shock.set(C, 0.4 + 3 * k, 0.04 * (1 - k) * (1 - k));
      const p = StarBurst.pop(a, 0.04, 0.2);
      this.pop.set(this.v1.set(C.x, 0.5, C.z), 2.4 * p.scale, p.opacity, a * 3);
      const sm = this.scorch.material as THREE.MeshBasicMaterial;
      sm.opacity = 0.35 * (1 - Math.min(1, a / 0.3));
    }
    this.shake *= Math.exp(-dt * 10);
  }

  /** The plate lands: a clatter, a ring, black smoke and embers; and the burnt dish is on the floor, on both screens. */
  private land() {
    const C = this.centre;
    this.shake = 0.28;
    this.smoke.burst(this.v1.set(C.x, 0.3, C.z), 14, CHEF.smoke, 1.8, 2.2, 0.7, 1.3);
    this.smoke.burst(this.v1.set(C.x, 0.3, C.z), 6, CHEF.black, 1.2, 1.4, 0.55, 1.2);
    this.embers.burst(this.v1.set(C.x, 0.3, C.z), 14, [CHEF.foil, CHEF.tomato, CHEF.black], 3.6, 4.5, 0.09);
    if (this.ctx) addDish(this.ctx.caster, C.x, C.z, true);
  }
}

export const burntOfferingModule: EffectModule = {
  label: 'burnt offering',
  category: 'hero: chef',
  // The aim point is where the plate lands; the radius sizes the marker.
  targeting: { mode: 'ground', radius: FOOT_R },
  create: () => new BurntOffering(),
  telegraphs(effect) {
    const e = effect as BurntOffering;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: FOOT_R }, start: 0.04, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BurntOffering;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    f.add((effect as BurntOffering).settings, 'loop');
  },
};
