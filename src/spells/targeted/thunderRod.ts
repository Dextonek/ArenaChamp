import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { LightningTree, Puddles, Sparks, STORM, STORM_CSS } from '../../effects/parts/storm';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { addRod, removeRod, stormOf } from '../../traits/storm';

/**
 * Thunder Rod (storm kit v5, W: a great rod on the ground, a recast to spend it). Cast at a spot (9 m): she raises the
 * staff, a blue ring (the 3.5 m zone) is drawn on the ground and fills toward 1.2 s, and at 0.25 s a bolt falls and plants a
 * GREAT rod there (`addRod(..., great)`, drawn by the trait's `marks` on both screens: a rod 4.4 m tall; it counts as one of
 * her three rods and stands 3 s). From 1.2 s on, each second (at 1.2 s and 2.2 s: the rod is gone at 3.25 s) it pulses: every
 * enemy within 3.5 m of the spot, on its live position, takes 18 and is slowed 1 s (`status: slow`), a ring of ground forks
 * runs out. The zone is the telegraph (impact 1.2 s: it roots her until then), so leaving it by 1.2 s (3.5 m takes 1.13 s) takes
 * nothing. If the rod is used up or grounded meanwhile (`stormOf(figure).rods` no longer holds it) the pulses stop.
 * Recast, Discharge (the trait's free second cast, from 1.2 s to 3 s after the first, power 1): the effect tells the two casts
 * apart by itself (a second cast of the same caster figure within 3.3 s, a clock per figure, so both screens agree; the `mode`
 * setting forces one) and reads the rod's spot from the per-figure record, not from this instance, because the CPU reuses one
 * instance per label. At 0.25 s a huge bolt falls on the rod, which is removed (`removeRod`) and everyone within 3.5 m at that
 * moment takes 40 once. The rod already gone (grounded, arced away, pushed out by a newer one): it only fizzles. Clean by 3.4 s.
 * Hits are the ordinary zone kind (not `projectile`), judged on live positions against the zone from `telegraphs`.
 */
export interface ThunderRodSettings {
  /** Damage per pulse and of the Discharge. */
  damage: number;
  discharge: number;
  slowSeconds: number;
  /** 'auto' reads the recast clock; 'rod' / 'discharge' force one (the tool's play button). */
  mode: 'auto' | 'rod' | 'discharge';
  loop: boolean;
}

export const defaultThunderRod = (): ThunderRodSettings => ({ damage: 24, discharge: 50, slowSeconds: 1, mode: 'auto', loop: false });

// Timeline (seconds).
const PLANT_T = 0.25;
const TICKS = [1.2, 2.2];
const DURATION = 3.4;
const RADIUS = 3.5;
const AIM_RADIUS = 6; // ctx.targets: the enemies within this of the spot at the cast (the zone is RADIUS)
const RECAST_CLOCK = 3300; // ms: a second cast inside this is the Discharge
const SKY = 11;
const TIP = 5.4;

/** When each caster figure last cast Thunder Rod, and whether that cast was the Discharge. */
const lastCast = new WeakMap<object, { at: number; discharge: boolean }>();

type Circle = Extract<TelegraphShape, { kind: 'circle' }>;

export class ThunderRod implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThunderRodSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** True when the last cast is the Discharge. */
  discharge = false;
  /** The zone of the last cast: 3.5 m round the rod's spot. */
  zone: Circle = { kind: 'circle', x: 0, z: 0, radius: RADIUS };
  private time = 0;
  private spot = new THREE.Vector3();
  private rodId = -1;
  private planted = false;
  private ticked = [false, false];
  private fired = false;
  private ended = false;
  private sparkTimer = 0;
  private armTimer = 0;
  private shockAt = -1;
  private starAt = -1;
  private dried = false;
  private base = new THREE.Vector3();
  private tip = new THREE.Vector3();

  // Parts.
  private tree = new LightningTree(10);
  private sparks = new Sparks(100);
  private puddles = new Puddles();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: STORM.accent, core: 0xfffbe0, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private edge = new THREE.Mesh(
    new THREE.RingGeometry(0.97, 1, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: STORM.hot, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
  );
  private edgeDark = new THREE.Mesh(
    new THREE.RingGeometry(0.93, 1.04, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: STORM.dark, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  );
  private fill = new THREE.Mesh(
    new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: STORM.body, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  );
  private charge = new THREE.Mesh(
    new THREE.SphereGeometry(1, 14, 10),
    new THREE.MeshBasicMaterial({ color: STORM.hot, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  private cloud = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8).scale(1.6, 0.55, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x1d2a40, transparent: true, opacity: 0.92, depthWrite: false }),
  );

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ThunderRodSettings = defaultThunderRod()) {
    this.settings = settings;
    this.screen.impactColor.set(STORM.hot);
    this.screen.tint.set(STORM.dark);
    this.fill.renderOrder = 2;
    this.edgeDark.renderOrder = 3;
    this.edge.renderOrder = 4;
    this.cloud.renderOrder = 5;
    this.group.add(this.puddles.mesh, this.fill, this.edgeDark, this.edge, this.charge, this.cloud, this.tree.mesh, this.sparks.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return this.discharge ? PLANT_T : TICKS[0];
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const now = performance.now();
    const prev = lastCast.get(ctx.caster);
    const auto = !!prev && !prev.discharge && now - prev.at < RECAST_CLOCK;
    const m = this.settings.mode;
    this.discharge = m === 'discharge' || (m === 'auto' && auto);
    lastCast.set(ctx.caster, { at: now, discharge: this.discharge });
    const s = stormOf(ctx.caster);
    if (this.discharge && s.w) {
      // The great rod's spot and id live in the per-figure record, not here.
      this.spot.set(s.w.x, 0, s.w.z);
      this.rodId = s.w.id;
    } else {
      this.spot.copy(ctx.point).setY(0);
      this.rodId = -1;
      if (!this.discharge) s.w = null;
    }
    this.zone = { kind: 'circle', x: this.spot.x, z: this.spot.z, radius: RADIUS };
    const fwd = this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.tip.copy(ctx.from).addScaledVector(fwd, 0.75).setY(1.95);
    this.base.copy(ctx.from).addScaledVector(fwd, 0.45).setY(0.95);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.spot).setY(1.5);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.planted = this.fired = this.ended = this.dried = false;
    this.ticked = [false, false];
    this.sparkTimer = this.armTimer = 0;
    this.shockAt = this.starAt = -1;
    clearScreenFx(this.screen);
    this.tree.reset();
    this.sparks.reset();
    this.puddles.reset();
    this.edge.visible = this.edgeDark.visible = this.fill.visible = this.charge.visible = this.cloud.visible = false;
    this.pop.set(this.spot, 0, 0);
    this.shock.set(this.spot, 0, 0);
  }

  /** True while the great rod of this cast is still standing on this screen. */
  private rodAlive() {
    const ctx = this.ctx;
    return !!ctx && stormOf(ctx.caster).rods.some((r) => r.id === this.rodId);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.tree.update(dt);
    this.sparks.update(dt);
    this.puddles.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    // Sparks crackle along the staff while she raises it.
    if (t < PLANT_T + 0.2) {
      this.sparkTimer += dt;
      while (this.sparkTimer >= 0.05) {
        this.sparkTimer -= 0.05;
        this.sparks.along(this.base, this.tip, 3, 2.4);
      }
    }
    if (this.discharge) this.updateDischarge(t, dt);
    else this.updateRod(t, dt);
    this.layout(t);
    this.shake *= Math.exp(-dt * 10);
  }

  // --- the great rod ------------------------------------------------------------------------------------------------

  private updateRod(t: number, dt: number) {
    const ctx = this.ctx;
    if (!this.planted && t >= PLANT_T) {
      this.planted = true;
      this.skyBolt();
      if (ctx) {
        const rod = addRod(ctx.caster, this.spot.x, this.spot.z, true);
        this.rodId = rod.id;
        stormOf(ctx.caster).w = { id: rod.id, x: this.spot.x, z: this.spot.z };
      }
      this.puddles.wet(this.spot, 1.4);
      this.puddles.ripple(this.spot, 1.8);
      this.sparks.burst(this.v1.copy(this.spot).setY(0.4), 14, 6);
      this.shake = 0.2;
    }
    if (!this.planted || this.ended) return;
    // The rod was used up or grounded: the pulses stop, a small fizz at its foot.
    if (!this.rodAlive()) {
      this.ended = true;
      this.sparks.burst(this.v1.copy(this.spot).setY(0.5), 10, 4);
      return;
    }
    // Crackle: arcs jump from the tip to the rim of the zone while it charges.
    this.armTimer += dt;
    const rate = t < TICKS[0] ? 0.22 : 0.14;
    while (this.armTimer >= rate) {
      this.armTimer -= rate;
      const a = Math.random() * Math.PI * 2, r = RADIUS * (0.7 + Math.random() * 0.3);
      this.v1.set(this.spot.x, TIP, this.spot.z);
      this.v2.set(this.spot.x + Math.cos(a) * r, 0.1, this.spot.z + Math.sin(a) * r);
      this.tree.strike(this.v1, this.v2, 1, 0.07, 0.18, { hold: 0.5, levels: 1 });
    }
    for (let k = 0; k < TICKS.length; k++) {
      if (this.ticked[k] || t < TICKS[k]) continue;
      this.ticked[k] = true;
      this.pulse();
    }
  }

  /** One pulse: forks run out along the floor and everyone inside the zone now is hit. */
  private pulse() {
    const ctx = this.ctx;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      this.v1.set(this.spot.x, 0.4, this.spot.z);
      this.v2.set(this.spot.x + Math.cos(a) * RADIUS, 0.05, this.spot.z + Math.sin(a) * RADIUS);
      this.tree.strike(this.v1, this.v2, 1, 0.12, 0.45, { hold: 0.4, levels: 2 });
    }
    this.v1.set(this.spot.x, TIP, this.spot.z);
    this.v2.set(this.spot.x, 0.3, this.spot.z);
    this.tree.strike(this.v1, this.v2, 2, 0.2, 0.4, { hold: 0.4, levels: 2 });
    this.shockAt = this.time;
    this.starAt = this.time;
    this.puddles.ripple(this.spot, 2.4);
    this.shake = 0.14;
    if (!ctx) return;
    // Everyone in the zone now, not only who was near the aim at the cast.
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.zone, p.x, p.z)) continue;
      ctx.hit(e, {
        damage: this.settings.damage, knock: 0, from: this.spot, color: STORM_CSS.body,
        status: { kind: 'slow', seconds: this.settings.slowSeconds },
      });
    }
  }

  // --- the Discharge --------------------------------------------------------------------------------------------------

  private updateDischarge(t: number, _dt: number) {
    const ctx = this.ctx;
    if (this.fired || t < PLANT_T) return;
    this.fired = true;
    const alive = !!ctx && this.rodId >= 0 && !!removeRod(ctx.caster, this.rodId);
    if (ctx) stormOf(ctx.caster).w = null;
    if (!alive) {
      // The rod is gone: a puff at the spot, no hit.
      this.sparks.burst(this.v1.copy(this.spot).setY(0.5), 10, 4);
      this.ended = true;
      return;
    }
    this.skyBolt();
    // The rod is spent: a ring of forks and a star at its foot, and a heavy one down the pole.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      this.v1.set(this.spot.x, 0.5, this.spot.z);
      this.v2.set(this.spot.x + Math.cos(a) * RADIUS, 0.05, this.spot.z + Math.sin(a) * RADIUS);
      this.tree.strike(this.v1, this.v2, 2, 0.18, 0.6, { hold: 0.4, levels: 2 });
    }
    this.shockAt = t;
    this.starAt = t;
    this.puddles.wet(this.spot, 2.2);
    this.puddles.ripple(this.spot, 2.6);
    this.sparks.burst(this.v1.copy(this.spot).setY(0.6), 24, 8);
    this.shake = 0.4;
    if (!ctx) return;
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.zone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.discharge, knock: 0, from: this.spot, color: STORM_CSS.body });
    }
  }

  /** A thick tree from the cloud down to the rod's foot. */
  private skyBolt() {
    this.v1.set(this.spot.x, SKY, this.spot.z);
    this.v2.set(this.spot.x, 0.2, this.spot.z);
    this.tree.strike(this.v1, this.v2, 4, 0.4, 0.7, { hold: 0.4, levels: 3, groundForks: 2 });
  }

  // --- look -----------------------------------------------------------------------------------------------------------

  private layout(t: number) {
    const rod = !this.discharge;
    const endT = rod ? TICKS[TICKS.length - 1] + 0.4 : PLANT_T + 0.5;
    // The zone ring: it appears at the cast and fills toward the first pulse (the great rod), or flashes (the Discharge).
    const live = rod ? !this.ended : !this.ended && !this.fired;
    this.edge.visible = this.edgeDark.visible = this.fill.visible = live && t < (rod ? DURATION - 0.3 : PLANT_T + 0.1);
    this.edge.position.set(this.spot.x, 0.07, this.spot.z);
    this.edgeDark.position.copy(this.edge.position).setY(0.065);
    this.fill.position.copy(this.edge.position).setY(0.06);
    this.edge.scale.set(RADIUS, 1, RADIUS);
    this.edgeDark.scale.set(RADIUS, 1, RADIUS);
    const prog = rod ? smoothstep((t - 0.1) / (TICKS[0] - 0.1)) : smoothstep(t / PLANT_T);
    this.fill.scale.set(Math.max(1e-3, RADIUS * prog), 1, Math.max(1e-3, RADIUS * prog));
    // The cloud that throws the bolt, over the spot, only while she plants.
    this.cloud.visible = t < PLANT_T + 0.6;
    this.cloud.position.set(this.spot.x, SKY + 0.6, this.spot.z);
    this.cloud.scale.setScalar(Math.max(1e-3, 1.2 * smoothstep(t / 0.2) * (1 - smoothstep((t - PLANT_T - 0.2) / 0.35))));
    // A glow on the tip of the great rod that swells toward each pulse.
    const glow = rod && this.planted && !this.ended && t < endT;
    this.charge.visible = glow;
    if (glow) {
      const prev = TICKS.filter((x) => x <= t).pop() ?? PLANT_T;
      const next = TICKS.find((x) => x > t) ?? prev + 1;
      const k = smoothstep((t - prev) / Math.max(0.1, next - prev));
      this.charge.position.set(this.spot.x, TIP, this.spot.z);
      this.charge.scale.setScalar(0.25 + 0.45 * k + 0.05 * Math.sin(t * 30));
    }
    if (this.starAt >= 0) {
      const sp = StarBurst.pop(t - this.starAt, 0, 0.03);
      this.pop.set(this.v1.copy(this.spot).setY(1.2), (rod ? 1.0 : 1.8) * sp.scale, sp.opacity, 0.2);
    }
    if (this.shockAt >= 0) {
      const p = THREE.MathUtils.clamp((t - this.shockAt) / 0.4, 0, 1);
      this.shock.set(this.spot, 0.4 + (RADIUS - 0.4) * p, 0.04 * (1 - p) * (1 - p));
    }
    if (!this.dried && t >= DURATION - 0.5) {
      this.dried = true;
      this.puddles.dry(0.4);
    }
    this.screen.darken = 0.18 * smoothstep(t / 0.3) * (1 - smoothstep((t - (DURATION - 0.8)) / 0.5));
    this.screen.impact = this.discharge ? impactFrameAt(t, PLANT_T, [1], 0.04) : impactFrameAt(t, PLANT_T, [1], 0.02);
    this.screen.focus.copy(this.spot).setY(1.5);
  }
}

export const thunderRodModule: EffectModule = {
  label: 'thunder rod',
  category: 'hero: storm',
  // Aimed at a spot (9 m). `radius` is the share of the field the cast looks at for targets; the zone is 3.5 m.
  targeting: { mode: 'ground', radius: AIM_RADIUS },
  create: () => new ThunderRod(),
  telegraphs(effect) {
    const e = effect as ThunderRod;
    if (!e.ctx) return [];
    // The great rod: the 3.5 m zone, full at the first pulse, dangerous until the last. The Discharge: the same zone, at 0.25 s.
    return e.discharge
      ? [{ shape: e.zone, start: 0, impact: PLANT_T }]
      : [{ shape: e.zone, start: 0, impact: TICKS[0], until: TICKS[TICKS.length - 1] + 0.1 }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ThunderRod;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as ThunderRod).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 80, 1);
    f.add(s, 'discharge', 1, 120, 1);
    f.add(s, 'slowSeconds', 0, 3, 0.1);
    f.add(s, 'mode', ['auto', 'rod', 'discharge']);
  },
};
