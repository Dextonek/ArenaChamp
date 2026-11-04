import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { LightningTree, Puddles, RainSheet, Sparks, STORM, STORM_CSS, StormCloud } from '../../effects/parts/storm';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { nearestRod } from '../../traits/storm';

/**
 * Supercell (storm kit v5, R: a storm over her, label 'supercell storm' because the old cinematic Supercell keeps 'supercell').
 * Self cast. A dark flat-bottomed storm cloud gathers over her in 0.5 s (one short impact frame) and FOLLOWS HER live position
 * for 6 s, with a thin rain under it and lightning flickering inside. Every 0.8 s (at 0.8, 1.6 ... 4.8 s, six checks) each
 * enemy in the cast's list is tested on its LIVE position: within 7 m of her, or within 3 m of one of her rods
 * (`nearestRod`). If so a bolt marks the spot it stands on: a 1.2 m circle shown for 0.6 s (drawn by this effect: it is a moving
 * mark, so it is not in `telegraphs`), and when the 0.6 s are over a bolt falls there and hits 30 if the enemy is still within 1.2
 * m of the mark (`projectile: true`, so the engine does no zone check: the effect's own circle test is the dodge, and the hit
 * always passes the duel's zone and age filters). Rods arc as normal on each hit (the trait's `dealt`). The storm's pip 'storm' is
 * the trait's. Keep moving: 1.2 m takes 0.55 s with a 0.25 s reaction, inside the 0.6 s. Targeting is `self` with radius 14 so
 * the enemy hero is in the cast's list even when it is not within 7 m at the start (the CPU holds R until it is: `aiHold`).
 * Clean by 6.6 s.
 */
export interface SupercellStormSettings {
  damage: number;
  loop: boolean;
}

export const defaultSupercellStorm = (): SupercellStormSettings => ({ damage: 32, loop: false });

// Timeline (seconds).
const GATHER_T = 0.5;
const STORM_END = 6.0;
const DURATION = 6.6;
const EVERY = 0.8;
const CHECKS = 6; // 0.8 .. 4.8: the last bolt has fallen by 5.4 s
const MARK_T = 0.6;
const MARK_R = 1.2;
const NEAR_HER = 7;
const NEAR_ROD = 3;
const CLOUD_H = 5.6;
const SKY = 12;
const RADIUS = 14;

interface Pending { x: number; z: number; born: number; target: CastContext['targets'][number]; fell: boolean }

interface MarkView { group: THREE.Group; fill: THREE.Mesh; ring: THREE.Mesh }

const discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const ringGeo = new THREE.RingGeometry(0.84, 1, 40).rotateX(-Math.PI / 2);

function markView(): MarkView {
  const group = new THREE.Group();
  const under = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: STORM.dark, transparent: true, opacity: 0.45, depthWrite: false }));
  const fill = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: STORM.body, transparent: true, opacity: 0.42, depthWrite: false }));
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: STORM.hot, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.16, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: STORM.dark, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
  under.renderOrder = 2;
  fill.renderOrder = 3;
  rim.renderOrder = 3;
  ring.renderOrder = 4;
  under.position.y = 0.05;
  fill.position.y = 0.06;
  rim.position.y = 0.065;
  ring.position.y = 0.07;
  group.add(under, fill, rim, ring);
  group.visible = false;
  return { group, fill, ring };
}

export class SupercellStorm implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SupercellStormSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private checked = 0;
  private pending: Pending[] = [];
  private flags = { dispersed: false };
  private sparkTimer = 0;
  private innerTimer = 0;
  private starAt = -1;
  private starPos = new THREE.Vector3();
  private shockAt = -1;
  private shockPos = new THREE.Vector3();
  private base = new THREE.Vector3();
  private tip = new THREE.Vector3();

  // Parts. The cloud and the rain are children of `rig`, which follows her.
  private rig = new THREE.Group();
  private cloud = new StormCloud(80);
  private rain = new RainSheet(110);
  private tree = new LightningTree(10);
  private sparks = new Sparks(100);
  private puddles = new Puddles();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: STORM.accent, core: 0xfffbe0, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private views: MarkView[] = Array.from({ length: 6 }, markView);

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private zero = new THREE.Vector3();

  constructor(settings: SupercellStormSettings = defaultSupercellStorm()) {
    this.settings = settings;
    this.screen.impactColor.set(STORM.hot);
    this.screen.tint.set(STORM.dark);
    this.rain.height = CLOUD_H - 0.4;
    this.rig.add(this.rain.mesh, this.cloud.mesh);
    this.group.add(this.rig, this.puddles.mesh, ...this.views.map((v) => v.group), this.tree.mesh, this.sparks.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return GATHER_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fwd = this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.tip.copy(ctx.from).addScaledVector(fwd, 0.75).setY(1.95);
    this.base.copy(ctx.from).addScaledVector(fwd, 0.45).setY(0.95);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(ctx.from).setY(1.5);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (ctx) this.rig.position.copy(ctx.caster.group.position).setY(0);
    this.cloud.gather(this.zero, 2.6, CLOUD_H, GATHER_T);
    this.rain.fall(this.zero, 2.3, 0, 0.5);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.checked = 0;
    this.pending.length = 0;
    this.flags.dispersed = false;
    this.sparkTimer = this.innerTimer = 0;
    this.starAt = this.shockAt = -1;
    clearScreenFx(this.screen);
    this.cloud.reset();
    this.rain.reset();
    this.tree.reset();
    this.sparks.reset();
    this.puddles.reset();
    for (const v of this.views) v.group.visible = false;
    this.pop.set(this.zero, 0, 0);
    this.shock.set(this.zero, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.cloud.update(dt);
    this.rain.update(dt);
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
    const ctx = this.ctx;
    if (ctx) this.rig.position.copy(ctx.caster.group.position).setY(0);

    // Sparks along the staff while the cloud gathers.
    if (t < GATHER_T) {
      this.sparkTimer += dt;
      while (this.sparkTimer >= 0.05) {
        this.sparkTimer -= 0.05;
        this.sparks.along(this.base, this.tip, 2, 2.4);
      }
    }
    // Lightning flickers inside the cloud now and then.
    if (t >= GATHER_T && t < STORM_END) {
      this.innerTimer += dt;
      if (this.innerTimer >= 0.45) {
        this.innerTimer = 0.1 * Math.random();
        const p = ctx ? ctx.caster.group.position : this.zero;
        const a = Math.random() * Math.PI * 2;
        this.v1.set(p.x + Math.cos(a) * 1.6, CLOUD_H + 0.6, p.z + Math.sin(a) * 1.6);
        this.v2.set(p.x + Math.cos(a + 1.2) * 2.4, CLOUD_H + 0.3, p.z + Math.sin(a + 1.2) * 2.4);
        this.tree.strike(this.v1, this.v2, 2, 0.12, 0.18, { hold: 0.5, levels: 2 });
        this.cloud.flash = Math.max(this.cloud.flash, 0.7);
      }
    }
    this.cloud.flash *= Math.exp(-dt * 9);

    // The checks: every 0.8 s, mark whoever is in reach.
    while (this.checked < CHECKS && t >= EVERY * (this.checked + 1)) {
      this.checked++;
      this.check();
    }
    // The bolts: each mark falls MARK_T after it was made.
    for (const p of this.pending) {
      if (!p.fell && t >= p.born + MARK_T) {
        p.fell = true;
        this.fall(p);
      }
    }
    this.pending = this.pending.filter((p) => !p.fell || t < p.born + MARK_T + 0.05);

    if (!this.flags.dispersed && t >= STORM_END) {
      this.flags.dispersed = true;
      this.cloud.disperse(0.5);
      this.rain.stop();
      this.puddles.dry(0.5);
    }
    this.layout(t);
  }

  /** Marks every enemy in reach (live positions): within 7 m of her, or within 3 m of a rod. */
  private check() {
    const ctx = this.ctx;
    if (!ctx) return;
    const me = ctx.caster.group.position;
    for (const e of ctx.targets) {
      const p = e.group.position;
      const near = Math.hypot(p.x - me.x, p.z - me.z) <= NEAR_HER || !!nearestRod(ctx.caster, p.x, p.z, NEAR_ROD);
      if (!near) continue;
      this.pending.push({ x: p.x, z: p.z, born: this.time, target: e, fell: false });
    }
  }

  /** The bolt falls on a mark: it hits if the enemy is still within the circle. */
  private fall(p: Pending) {
    const ctx = this.ctx;
    this.v1.set(p.x, SKY, p.z);
    this.v2.set(p.x, 0.1, p.z);
    this.tree.strike(this.v1, this.v2, 4, 0.32, 0.5, { hold: 0.4, levels: 3, groundForks: 1 });
    this.sparks.burst(this.v2, 12, 6);
    this.puddles.wet(this.v2, 1.4);
    this.puddles.ripple(this.v2, 1.6);
    this.starAt = this.time;
    this.starPos.set(p.x, 1.1, p.z);
    this.shockAt = this.time;
    this.shockPos.set(p.x, 0, p.z);
    this.shake = 0.18;
    this.cloud.flash = 1;
    if (!ctx) return;
    const q = p.target.group.position;
    if (Math.hypot(q.x - p.x, q.z - p.z) > MARK_R) return;
    this.v1.set(p.x, 0, p.z);
    ctx.hit(p.target, { damage: this.settings.damage, knock: 0, from: this.v1.clone(), color: STORM_CSS.body, projectile: true });
  }

  private layout(t: number) {
    // The circles: each shows for MARK_T, its fill grows to the edge as the bolt nears.
    const live = this.pending.filter((p) => !p.fell);
    this.views.forEach((v, i) => {
      const p = live[i];
      v.group.visible = !!p;
      if (!p) return;
      const k = THREE.MathUtils.clamp((t - p.born) / MARK_T, 0, 1);
      v.group.position.set(p.x, 0, p.z);
      v.group.scale.set(MARK_R, 1, MARK_R);
      v.fill.scale.set(Math.max(1e-3, k), 1, Math.max(1e-3, k));
      (v.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.3 * Math.sin(t * 30);
    });
    if (this.starAt >= 0) {
      const sp = StarBurst.pop(t - this.starAt, 0, 0.03);
      this.pop.set(this.starPos, 1.0 * sp.scale, sp.opacity, 0.2);
    }
    if (this.shockAt >= 0) {
      const p = THREE.MathUtils.clamp((t - this.shockAt) / 0.3, 0, 1);
      this.shock.set(this.shockPos, 0.4 + 1.4 * p, 0.03 * (1 - p) * (1 - p));
    }
    this.screen.darken = 0.22 * smoothstep(t / GATHER_T) * (1 - smoothstep((t - (STORM_END - 0.3)) / 0.6));
    this.screen.impact = impactFrameAt(t, GATHER_T, [1], 0.04);
    this.screen.focus.copy(this.ctx ? this.ctx.caster.group.position : this.zero).setY(1.5);
    this.shake *= 0.9;
  }
}

export const supercellStormModule: EffectModule = {
  label: 'supercell storm',
  category: 'hero: storm',
  // Self cast; `radius` puts the enemy hero in the cast's list from afar (the bolts only start within 7 m of her or 3 m of a rod).
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new SupercellStorm(),
  // Every hit is `projectile`; the 1.2 m circles are moving marks drawn by the effect, so there is no cast-time zone.
  telegraphs() {
    return [];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.45, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SupercellStorm;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as SupercellStorm).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
  },
};
