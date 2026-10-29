import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  FROST, FROST_CSS, FrostBreath, FrostFerns, IceCrystals, RimeSleeves, Snow,
} from '../../effects/parts/frost';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Frostfern Field (frost kit, W: zone). She sweeps a hand low and her breath rolls toward the point; frost ferns race
 * across the floor to the full radius, climbing the enemies inside (they sink a little, held). At the hit the field
 * cracks: 20-26 ice crystals burst up through the ferns, the tallest at the enemies, leaning outward. After a hold the
 * crystals shatter outward and the ferns fade. See pipeline/designs/kit-frost.md.
 */
export interface FrostfernFieldSettings {
  damage: number;
  loop: boolean;
}

export const defaultFrostfernField = (): FrostfernFieldSettings => ({ damage: 56, loop: false });

// Timeline (seconds).
const SWEEP_T = 0.0;
const RACE_T = 0.2; // ferns start to race out
const RACE_END = 0.75;
const HIT_T = 0.8;
const SHATTER_T = 1.5;
const DURATION = 2.3;
const RADIUS = 4.5;
const MAX_VIS = 6; // enemies that get their own rime / crystals
const CRYSTALS = 22;

export class FrostfernField implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FrostfernFieldSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.0, 13);
  private centre = new THREE.Vector3(0, 0, -6);
  private feet: THREE.Vector3[] = [];

  private flags = { breath: false, race: false, snow: false, hit: false, shatter0: false, shatter1: false, stopSnow: false };

  // Parts.
  private breath = new FrostBreath(24);
  private fernsA = new FrostFerns({ variant: 0, maxShards: 36 });
  private fernsB = new FrostFerns({ variant: 1, maxShards: 0 });
  private sleeves = new RimeSleeves(MAX_VIS);
  private snow = new Snow({ max: 40 });
  // Two radial bands so the release can shatter from the centre outward.
  private bands = [0, 1].map(() => new IceCrystals({ maxSpikes: 20, maxShards: 90 }));
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: FROST.accent, core: 0xfff0f6, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private zero = new THREE.Vector3();

  constructor(settings: FrostfernFieldSettings = defaultFrostfernField()) {
    this.settings = settings;
    this.screen.tint.set(FROST.dark);
    for (let i = 0; i < MAX_VIS; i++) this.feet.push(new THREE.Vector3(0, -50, 0));
    this.fernsA.renderOrder = 2;
    this.fernsB.renderOrder = 1;
    for (const b of this.bands) b.shards.gravity = -18;
    this.group.add(
      this.fernsB.mesh, this.fernsA.mesh, this.sleeves.mesh, ...this.bands.map((b) => b.mesh), this.snow.mesh,
      this.breath.mesh, this.groundShock.mesh, this.pop.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.centre.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.5).setY(1.0);
    const n = Math.min(MAX_VIS, ctx.targets.length);
    for (let i = 0; i < MAX_VIS; i++) {
      if (i < n) this.feet[i].copy(ctx.targetPos[i]).setY(0);
      else this.feet[i].set(0, -50, 0);
    }
    this.screen.focus.copy(this.centre);
    this.groundShock.set(this.centre, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(FROST.dark);
    this.breath.reset();
    this.fernsA.reset();
    this.fernsB.reset();
    this.sleeves.clear();
    this.snow.reset();
    for (const b of this.bands) b.reset();
    this.groundShock.set(this.centre, 0, 0);
    this.pop.set(this.centre, 0, 0);
  }

  /** Builds the crystals: a Vogel spiral over the disc, the tallest near the enemies, plus one beside each enemy. */
  private burst() {
    const n = Math.min(MAX_VIS, this.ctx?.targets.length ?? 0);
    const dir = new THREE.Vector3(), base = new THREE.Vector3();
    const place = (x: number, z: number, h: number, lean: number, yaw: number) => {
      const dx = x - this.centre.x, dz = z - this.centre.z, r = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx) + yaw;
      dir.set(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
      base.set(x, 0, z);
      this.bands[r < RADIUS * 0.5 ? 0 : 1].spike(base, dir, h, Math.max(0.42, 0.3 * h), 0.1, (r / RADIUS) * 0.1);
    };
    for (let i = 0; i < CRYSTALS; i++) {
      const r = (RADIUS - 0.4) * Math.sqrt((i + 0.5) / CRYSTALS);
      const a = i * 2.39996 + Math.sin(i * 12.9898) * 0.25;
      const x = this.centre.x + Math.cos(a) * r, z = this.centre.z + Math.sin(a) * r;
      let near = 99;
      for (let k = 0; k < n; k++) near = Math.min(near, Math.hypot(x - this.feet[k].x, z - this.feet[k].z));
      if (near < 0.8) continue; // keep the enemy's own crystal clear
      const hash = Math.abs(Math.sin(i * 78.233) * 43758.5453) % 1;
      const boost = 1 - smoothstep(near / 2.2);
      const h = Math.min(2.2, 0.6 + 0.9 * hash + 0.7 * boost);
      place(x, z, h, 0.15 + 0.25 * (r / RADIUS) + (hash - 0.5) * 0.25, 0);
    }
    // One tall crystal beside every enemy, on the side away from the centre, leaning outward.
    for (let k = 0; k < n; k++) {
      const out = this.v1.subVectors(this.feet[k], this.centre).setY(0);
      if (out.lengthSq() < 1e-3) out.set(Math.cos(k * 2.1), 0, Math.sin(k * 2.1));
      out.normalize();
      place(this.feet[k].x + out.x * 0.85, this.feet[k].z + out.z * 0.85, 2.2, 0.3, 0);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.breath.update(dt);
    this.fernsA.update(dt);
    this.fernsB.update(dt);
    this.snow.update(dt);
    for (const b of this.bands) b.update(dt);
    this.time += dt;
    const ctx = this.ctx;
    if (this.time >= DURATION) {
      if (ctx) for (let i = 0; i < Math.min(MAX_VIS, ctx.targets.length); i++) ctx.displace(ctx.targets[i], this.zero);
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    // Events.
    if (!f.breath && t >= SWEEP_T + 0.02) {
      f.breath = true;
      const d = this.v1.subVectors(this.centre, this.hand).setY(0).normalize().setY(-0.08);
      this.breath.blow(this.hand, d, 3.4, 0.3);
    }
    if (!f.race && t >= RACE_T) {
      f.race = true;
      this.fernsA.grow(this.centre, RADIUS, RACE_END - RACE_T);
      this.fernsB.grow(this.centre, RADIUS * 0.94, RACE_END - RACE_T + 0.05, 0.05);
    }
    if (!f.snow && t >= 0.25) {
      f.snow = true;
      this.snow.swirl(this.centre, 3.6, 16, { y: 0.8, ySpread: 0.8, speed: 2.0, band: 0.7 });
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.burst();
      this.shake = 0.4;
      if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 0, color: FROST_CSS.body });
    }
    if (!f.stopSnow && t >= SHATTER_T) {
      f.stopSnow = true;
      this.snow.stop();
    }
    if (!f.shatter0 && t >= SHATTER_T) {
      f.shatter0 = true;
      this.bands[0].shatter(3, 4.5, 0.3);
      this.fernsA.shatter(0.7);
      this.fernsB.fade(0.7);
    }
    if (!f.shatter1 && t >= SHATTER_T + 0.07) {
      f.shatter1 = true;
      this.bands[1].shatter(3, 4.5, 0.3);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const n = ctx ? Math.min(MAX_VIS, ctx.targets.length) : 0;
    const after = t - HIT_T;

    // --- Screen: the floor darkens a little so the pale ferns read. ---
    this.screen.darken = 0.3 * smoothstep((t - 0.05) / 0.35) * (1 - smoothstep((t - SHATTER_T) / 0.7));

    // --- Enemies: rime climbs from the feet, they sink a little as if held, then come back up. ---
    const hold = smoothstep((t - 0.35) / 0.4) * (1 - smoothstep((t - SHATTER_T) / 0.2));
    const rimeOp = 1 - smoothstep((t - SHATTER_T) / 0.5);
    for (let i = 0; i < MAX_VIS; i++) {
      if (i >= n) { this.sleeves.set(i, this.feet[i], 2.2, 1.0, 0, 0); continue; }
      this.v2.copy(this.feet[i]).setY(-0.05 * hold);
      this.sleeves.set(i, this.v2, 2.2, 1.0, smoothstep((t - 0.35) / 0.45), rimeOp);
      ctx!.displace(ctx!.targets[i], this.v1.set(0, -0.05 * hold, 0));
    }

    // --- The crack: ground refraction, accent glint at the centre, shake. ---
    if (f.hit) {
      const gp = THREE.MathUtils.clamp(after / 0.45, 0, 1);
      this.groundShock.set(this.centre, 1 + 5 * gp, 0.04 * (1 - gp) * (1 - gp));
      const sp = StarBurst.pop(after, 0, 0.02);
      this.pop.set(this.v1.copy(this.centre).setY(0.9), 1.0 * sp.scale, sp.opacity, 0.2);
      this.shake = 0.4 * Math.exp(-after * 9);
    }
  }
}

export const frostfernFieldModule: EffectModule = {
  label: 'frostfern field',
  category: 'hero: frost',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new FrostfernField(),
  telegraphs(effect) {
    const e = effect as FrostfernField;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as FrostfernField;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as FrostfernField).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
