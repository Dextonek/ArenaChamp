import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { COURIER, COURIER_CSS, Flecks, buildParcel, wordSprite } from '../../effects/parts/courier';
import { insideTelegraph, type TelegraphShape, type TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FRAGILE_DAMAGE, FRAGILE_DELAY, FRAGILE_RADIUS, FRAGILE_RANGE, FRAGILE_SLOW } from '../../traits/courier';

/**
 * Fragile (courier kit v5, W: a circle with a parcel in the middle). Pip hurls a brown-paper parcel (0.45 s, a high spinning arc) at a
 * spot (9 m from him, at least 1.5 m): it lands with a bounce and a puff of paper, a red ring and a shadow marking the circle. It
 * sits there ticking and rattling harder and harder, its string quivering. At 1.0 s it bursts: the paper flies, FRAGILE stickers
 * scatter outward and flutter down, and DELIVERED pops over the spot.
 *
 * The hit: at 1.0 s every enemy whose LIVE position is inside the 2.5 m circle (the module's telegraph, the real shape) takes 50 and
 * is slowed 1 s. A walker (0.25 s to react plus 0.63 s to cross 2.5 m) just leaves it. Clean by 2.6 s. The spot comes from
 * `sentFrom` and the aim only, so both screens of a network duel agree. See pipeline/designs/kit-courier.md.
 */
export interface FragileSettings {
  damage: number;
  slow: number;
  loop: boolean;
}

export const defaultFragile = (): FragileSettings => ({ damage: FRAGILE_DAMAGE, slow: FRAGILE_SLOW, loop: false });

// Timeline (seconds).
const FLY_T = 0.45;
const BURST_T = FRAGILE_DELAY;
const END_T = 2.6;
const ARC = 3.2;
const MIN_DIST = 1.5;
const MIN = 1e-3;

export class Fragile implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FragileSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The circle: where the parcel lands, from sentFrom and point only. */
  readonly centre = new THREE.Vector3(0, 0, 5);
  readonly circle: TelegraphShape = { kind: 'circle', x: 0, z: 5, radius: FRAGILE_RADIUS };
  private time = 0;
  private flags = { landed: false, burst: false };
  private hand = new THREE.Vector3();
  private tickT = 0;

  private parcel = buildParcel('FRAGILE');
  private pivot = new THREE.Group();
  private bits = new Flecks(80);
  private stickers = new Flecks(14, true);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: COURIER.paper, core: 0xffffff, additive: false });
  private flash = new StarBurst({ points: 8, inner: 0.3, color: COURIER.accent, core: COURIER.cream, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private word = wordSprite('DELIVERED', COURIER_CSS.dark, COURIER_CSS.accent, 2.6);
  private shade = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COURIER.dark, transparent: true, opacity: 0, depthWrite: false }),
  );
  private seed = new THREE.Mesh(
    new THREE.RingGeometry(0.93, 1, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COURIER.red, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private dust = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COURIER.paper, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private v1 = new THREE.Vector3();

  constructor(settings: FragileSettings = defaultFragile()) {
    this.settings = settings;
    this.shade.renderOrder = 1;
    this.seed.renderOrder = 2;
    this.dust.renderOrder = 3;
    this.pivot.add(this.parcel);
    this.parcel.scale.setScalar(1.4);
    this.group.add(this.shade, this.seed, this.dust, this.pivot, this.bits.mesh, this.stickers.mesh, this.pop.mesh, this.flash.mesh, this.shock.mesh, this.word);
    this.reset();
  }

  get duration() {
    return END_T;
  }

  get impactTime() {
    return BURST_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the circle: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = MIN_DIST; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, FRAGILE_RANGE);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
    Object.assign(this.circle, { x: this.centre.x, z: this.centre.z });
    this.hand.set(ctx.from.x + dx * 0.4, 1.3, ctx.from.z + dz * 0.4);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.landed = this.flags.burst = false;
    this.tickT = 0;
    this.pivot.visible = false;
    this.pivot.rotation.set(0, 0, 0);
    this.bits.reset();
    this.stickers.reset();
    this.pop.set(this.centre, 0, 0);
    this.flash.set(this.centre, 0, 0);
    this.shock.set(this.centre, 0, 0);
    this.word.visible = false;
    this.shade.visible = this.seed.visible = this.dust.visible = false;
    for (const m of [this.shade, this.seed, this.dust]) (m.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    this.stickers.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, f = this.flags, C = this.centre;
    if (t >= END_T && !this.bits.busy && !this.stickers.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The seed: a red ring closes on the spot and a shadow grows under the parcel. ---
    if (!this.shade.visible) {
      this.shade.visible = this.seed.visible = true;
      this.shade.position.set(C.x, 0.03, C.z);
      this.seed.position.set(C.x, 0.04, C.z);
    }
    if (t < BURST_T) {
      const k = smoothstep(t / BURST_T);
      this.shade.scale.setScalar(FRAGILE_RADIUS * (0.25 + 0.75 * k));
      (this.shade.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.22 * k;
      this.seed.scale.setScalar(FRAGILE_RADIUS * (1.5 - 0.5 * k));
      (this.seed.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.55 * k;
    }

    // --- The parcel: a high spinning arc, a bounce, then it rattles harder and harder. ---
    this.pivot.visible = !f.burst;
    if (t < FLY_T) {
      const k = t / FLY_T;
      this.pivot.position.set(
        this.hand.x + (C.x - this.hand.x) * k,
        this.hand.y * (1 - k) + ARC * Math.sin(Math.PI * k) * (1 - 0.3 * k),
        this.hand.z + (C.z - this.hand.z) * k,
      );
      this.pivot.rotation.set(k * 9, k * 5, k * 3);
      this.parcel.position.y = -0.3;
      this.pivot.scale.setScalar(Math.max(MIN, 0.4 + 0.6 * smoothstep(k * 2)));
    } else if (!f.burst) {
      if (!f.landed) {
        f.landed = true;
        this.shake = 0.3;
        this.bits.burst(this.v1.set(C.x, 0.2, C.z), 14, [COURIER.paper, COURIER.cream, COURIER.brown], 3.2, 2.2, 0.16);
        const dust = this.dust;
        dust.visible = true;
        dust.position.set(C.x, 0.05, C.z);
      }
      const a = t - FLY_T, k = Math.min(1, a / (BURST_T - FLY_T));
      const bounce = 0.35 * Math.exp(-a * 11) * Math.abs(Math.cos(a * 18));
      this.pivot.position.set(C.x, bounce, C.z);
      this.pivot.scale.setScalar(1);
      // It rattles: tilts side to side faster as it nears the burst.
      this.pivot.rotation.set(Math.sin(a * (22 + 30 * k) + 1) * 0.12 * k * k, a * 0.4, Math.sin(a * (25 + 34 * k)) * 0.22 * k * k);
      this.parcel.position.y = 0;
      this.tickT += dt;
      if (this.tickT >= 0.12 - 0.07 * k) {
        this.tickT = 0;
        this.bits.burst(this.v1.set(C.x + (Math.random() - 0.5) * 0.8, 0.9, C.z + (Math.random() - 0.5) * 0.8), 1, [COURIER.paper, COURIER.string], 0.9 + k * 1.5, 1.2, 0.1, 0.8);
      }
    }
    if (f.landed) {
      const a = t - FLY_T, d = this.dust.material as THREE.MeshBasicMaterial;
      this.dust.scale.setScalar(Math.max(MIN, 0.5 + 0.9 * smoothstep(a / 0.3)));
      d.opacity = t < BURST_T ? 0.55 * (1 - smoothstep(a / 0.5)) : d.opacity;
    }

    // --- The burst: the paper flies, stickers scatter, the hit is decided on live positions. ---
    if (!f.burst && t >= BURST_T) this.burst();
    if (f.burst) {
      const a = t - BURST_T, p = StarBurst.pop(a, 0.03, 0.2), g = Math.min(1, a / 0.3);
      this.flash.set(this.v1.set(C.x, 1.2, C.z), 4.6 * p.scale, p.opacity, a * 2);
      this.pop.set(this.v1.set(C.x, 0.6, C.z), 2.4 * p.scale, p.opacity, -a * 3);
      this.shock.set(C, 0.5 + FRAGILE_RADIUS * 1.6 * g, 0.05 * (1 - g) * (1 - g));
      (this.shade.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - smoothstep(a / 0.5));
      (this.seed.material as THREE.MeshBasicMaterial).opacity *= Math.exp(-dt * 8);
      const d = this.dust.material as THREE.MeshBasicMaterial;
      this.dust.scale.setScalar(Math.max(MIN, FRAGILE_RADIUS * (0.3 + 0.7 * g)));
      d.opacity = 0.7 * (1 - smoothstep((a - 0.1) / 0.8));
      // DELIVERED pops over the spot, rises a little and goes.
      const w = Math.min(1, a / 0.12), out = 1 - smoothstep((a - 0.8) / 0.4);
      this.word.visible = out > 0.02;
      this.word.position.set(C.x, 2.3 + 0.5 * smoothstep(a / 0.9), C.z);
      this.word.scale.set(2.6 * Math.max(MIN, w * out), 0.87 * Math.max(MIN, w * out), 1);
    }
    this.shake *= Math.exp(-dt * 9);
  }

  private burst() {
    const f = this.flags, C = this.centre, ctx = this.ctx;
    f.burst = true;
    this.shake = 0.7;
    this.pivot.visible = false;
    this.bits.burst(this.v1.set(C.x, 0.8, C.z), 40, [COURIER.paper, COURIER.cream, COURIER.brown, COURIER.string, COURIER.brownDark], 7, 6, 0.2, 1.6);
    this.stickers.burst(this.v1.set(C.x, 0.9, C.z), 12, [COURIER.red], 6, 5, 0.5, 1.8);
    if (ctx) {
      // Everyone inside the circle now, wherever the cast was aimed (live positions).
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const p = e.group.position;
        if (!insideTelegraph(this.circle, p.x, p.z)) continue;
        ctx.hit(e, { damage: this.settings.damage, knock: 3, color: COURIER_CSS.accent, from: C.clone(), status: { kind: 'slow', seconds: this.settings.slow } });
      }
    }
  }
}

export const fragileModule: EffectModule = {
  label: 'fragile',
  category: 'hero: courier',
  // The aim point is where the parcel lands; the radius sizes the marker.
  targeting: { mode: 'ground', radius: FRAGILE_RADIUS },
  create: () => new Fragile(),
  telegraphs(effect) {
    const e = effect as Fragile;
    if (!e.ctx) return [];
    return [{ shape: e.circle, start: 0.04, impact: BURST_T } satisfies TelegraphSpec];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Fragile;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Fragile).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'slow', 0, 4, 0.1);
  },
};
