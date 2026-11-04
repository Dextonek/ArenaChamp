import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Lightning, Pointer, Specks, ThunderCloud, WEATHER } from '../../effects/parts/weather';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { BOLT_DAMAGE, BOLT_DELAY, BOLT_RADIUS } from '../../traits/weather';

/**
 * Lightning Risk (weather kit, W: a strike that lands). Barry points at the spot (9 m) with his pointer and a storm cloud with a
 * wide grin rolls in 5.5 m above it, swelling over the first half second and rumbling (it shakes, its face goes darker). A pale
 * yellow ring marks the 1.5 m circle on the ground and sparks crackle round its edge. At 0.8 s the bolt comes down: a jagged
 * white-hot strike from the cloud to the floor, a flash on the ground, a refraction ring and a star. Whoever stands in the circle
 * at that moment (their live position, judged then) takes 45. The cloud lingers a moment and drifts off, still smiling. Clean by about
 * 2.0 s. Telegraph: the circle, impact at 0.8 s (he is rooted until then). See pipeline/designs/kit-weather.md.
 */
export interface LightningRiskSettings {
  damage: number;
  loop: boolean;
}

export const defaultLightningRisk = (): LightningRiskSettings => ({ damage: BOLT_DAMAGE, loop: false });

// Timeline (seconds).
const GONE_T = 1.6;
const DURATION = 2.0;
const SKY = 5.5;

export class LightningRisk implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LightningRiskSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly spot = new THREE.Vector3();
  private time = 0;
  private struck = false;
  private hand = new THREE.Vector3();
  private cloudAt = new THREE.Vector3();
  private v1 = new THREE.Vector3();

  private cloud = new ThunderCloud(true);
  private bolt = new Lightning();
  private pointer = new Pointer();
  private specks = new Specks(70);
  private star = new StarBurst({ points: 10, inner: 0.3, color: WEATHER.foil, core: WEATHER.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(BOLT_RADIUS - 0.1, BOLT_RADIUS, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: WEATHER.foil, transparent: true, depthWrite: false, opacity: 0 }),
  );
  private flash = new THREE.Mesh(
    new THREE.CircleGeometry(BOLT_RADIUS, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, depthWrite: false, opacity: 0 }),
  );

  constructor(settings: LightningRiskSettings = defaultLightningRisk()) {
    this.settings = settings;
    this.ring.renderOrder = 1;
    this.flash.renderOrder = 2;
    this.group.add(this.ring, this.flash, this.cloud.mesh, this.bolt.mesh, this.pointer.mesh, this.specks.mesh, this.star.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return BOLT_DELAY;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.spot.copy(ctx.point).setY(0);
    const s = ctx.sentFrom ?? ctx.from;
    this.hand.set(s.x, 1.3, s.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.struck = false;
    this.cloud.place(this.cloudAt, 0, 0);
    this.bolt.fade(0);
    this.pointer.aim(this.hand, this.spot, 0);
    this.specks.reset();
    this.star.set(this.spot, 0, 0);
    this.shock.set(this.spot, 0, 0);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.flash.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.specks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, p = this.spot;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The pointer sweeps out to the spot (0 - 0.3), holds, and goes back. ---
    const pe = t < 0.3 ? smoothstep(t / 0.3) : t < 0.9 ? 1 : 1 - smoothstep((t - 0.9) / 0.25);
    this.pointer.aim(this.hand, this.v1.set(p.x, 0.3, p.z), Math.min(0.92, pe));

    // --- The ring marks the circle; the cloud rolls in, swells and rumbles, grin and all. ---
    const rm = this.ring.material as THREE.MeshBasicMaterial;
    this.ring.position.set(p.x, 0.06, p.z);
    rm.opacity = t < BOLT_DELAY ? 0.35 + 0.5 * smoothstep(t / 0.4) : 0.9 * (1 - smoothstep((t - BOLT_DELAY) / 0.4));
    const grow = smoothstep((t - 0.05) / 0.5);
    const rumble = t < BOLT_DELAY ? Math.sin(t * 60) * 0.06 * smoothstep((t - 0.3) / 0.4) : 0;
    const out = t > GONE_T - 0.3 ? 1 - smoothstep((t - (GONE_T - 0.3)) / 0.3) : 1;
    this.cloudAt.set(p.x + rumble + (t > BOLT_DELAY ? (t - BOLT_DELAY) * 0.4 : 0), SKY + Math.sin(t * 3) * 0.1, p.z);
    this.cloud.place(this.cloudAt, 3.6 * grow, grow * out);
    // Sparks crackle round the edge of the circle as it charges.
    if (t < BOLT_DELAY && Math.random() < dt * 40 * smoothstep(t / BOLT_DELAY)) {
      const a = Math.random() * Math.PI * 2;
      this.specks.spawn(p.x + Math.cos(a) * BOLT_RADIUS, 0.1, p.z + Math.sin(a) * BOLT_RADIUS, 0, 1.6, 0, 0.35, 0.14, WEATHER.foil, 2, 1);
    }

    // --- 0.8 The strike: the hit is decided by the live positions against the fixed spot. ---
    if (!this.struck && t >= BOLT_DELAY) {
      this.struck = true;
      this.strike(ctx);
    }
    if (this.struck) {
      const a = t - BOLT_DELAY;
      this.bolt.fade(a < 0.06 ? 1 : Math.max(0, 1 - (a - 0.06) / 0.3) * (Math.sin(a * 90) > -0.4 ? 1 : 0.4));
      const fm = this.flash.material as THREE.MeshBasicMaterial;
      this.flash.position.set(p.x, 0.07, p.z);
      fm.opacity = 0.7 * Math.exp(-a * 7);
      const g = smoothstep(a / 0.45);
      this.shock.set(this.v1.set(p.x, 0, p.z), 0.5 + 4 * g, 0.05 * (1 - g) * (1 - g));
      const sp = StarBurst.pop(a, 0.05, 0.2);
      this.star.set(this.v1.set(p.x, 1.2, p.z), 3.4 * sp.scale, sp.opacity, a * 3);
    }
    this.shake *= Math.exp(-dt * 9);
  }

  private strike(ctx: CastContext | null) {
    const p = this.spot;
    if (ctx) {
      // Re-check at impact: whoever stands in the circle now.
      for (const e of ctx.targets) {
        const q = e.group.position;
        if (Math.hypot(q.x - p.x, q.z - p.z) <= BOLT_RADIUS) {
          ctx.hit(e, { damage: this.settings.damage, knock: 3, from: p, color: '#f4e65a' });
        }
      }
    }
    this.bolt.strike(p.x, p.z, SKY - 0.3);
    this.shake = 0.4;
    this.specks.burst(p.x, 0.3, p.z, 26, 6, 0.8, 0.17, WEATHER.foil, 8);
    this.specks.burst(p.x, 0.2, p.z, 14, 5, 0.7, 0.2, WEATHER.core, 4, true);
  }
}

export const lightningRiskModule: EffectModule = {
  label: 'lightning risk',
  category: 'hero: weather',
  targeting: { mode: 'ground', radius: BOLT_RADIUS },
  create: () => new LightningRisk(),
  telegraphs(effect) {
    const e = effect as LightningRisk;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.ctx.point.x, z: e.ctx.point.z, radius: BOLT_RADIUS }, start: 0, impact: BOLT_DELAY }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as LightningRisk;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as LightningRisk).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 200, 1);
  },
};
