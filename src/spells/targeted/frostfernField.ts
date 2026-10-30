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
 * Frostfern Field (frost kit, W: line). She sweeps a hand low and her breath rolls down the aim line; frost ferns race
 * out of her feet in three patches along a 9 m strip, climbing the enemies in it (they sink a little, held). At the hit
 * the strip cracks: ice crystals burst up through the ferns, the tallest at the enemies, leaning outward, and whoever is
 * still in the strip is rooted. After a hold the crystals shatter outward and the ferns fade. See
 * pipeline/designs/kit-frost.md.
 */
export interface FrostfernFieldSettings {
  damage: number;
  /** Root seconds on the hit (engine cap 1.5). */
  root: number;
  loop: boolean;
}

export const defaultFrostfernField = (): FrostfernFieldSettings => ({ damage: 62, root: 1.2, loop: false });

// Timeline (seconds).
const SWEEP_T = 0.0;
const RACE_T = 0.2; // ferns start to race out
const HIT_T = 0.9;
const SHATTER_T = 1.6;
const DURATION = 2.4;
const LENGTH = 9; // the strip runs this far from her feet along the aim
const HALF_W = 1.3; // half the strip width (the hit and the telegraph)
const RADIUS = LENGTH / 2; // spread scale of the strip patterns
const PATCHES = 3;
const PATCH_R = 1.9;
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
  private fernsA = Array.from({ length: PATCHES }, () => new FrostFerns({ variant: 0, maxShards: 14 }));
  private fernsB = Array.from({ length: PATCHES }, () => new FrostFerns({ variant: 1, maxShards: 0 }));
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
  /** How many enemies stand in the strip at the cast (they get their own rime), and which. */
  private vis = 0;
  private visTargets: CastContext['targets'][number][] = [];

  /** True when ground point p lies inside the strip (live or cast-time, as the caller passes). */
  private inStrip(p: THREE.Vector3) {
    const dx = p.x - this.from.x, dz = p.z - this.from.z;
    const along = dx * this.fwd.x + dz * this.fwd.z;
    const side = dx * this.fwd.z - dz * this.fwd.x;
    return along >= -0.5 && along <= LENGTH && Math.abs(side) <= HALF_W + 0.2;
  }

  /** Centre of fern patch i along the strip. */
  private patchAt(i: number, out: THREE.Vector3) {
    const s = 1.8 + i * ((LENGTH - 3.6) / (PATCHES - 1));
    return out.copy(this.from).addScaledVector(this.fwd, s).setY(0);
  }

  constructor(settings: FrostfernFieldSettings = defaultFrostfernField()) {
    this.settings = settings;
    this.screen.tint.set(FROST.dark);
    for (let i = 0; i < MAX_VIS; i++) this.feet.push(new THREE.Vector3(0, -50, 0));
    for (const a of this.fernsA) a.renderOrder = 2;
    for (const b of this.fernsB) b.renderOrder = 1;
    for (const b of this.bands) b.shards.gravity = -18;
    this.group.add(
      ...this.fernsB.map((f) => f.mesh), ...this.fernsA.map((f) => f.mesh), this.sleeves.mesh, ...this.bands.map((b) => b.mesh), this.snow.mesh,
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
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.centre.copy(ctx.from).addScaledVector(this.fwd, LENGTH * 0.5).setY(0);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.5).setY(1.0);
    // Only the enemies in the strip get rime and crystals; the others are parked out of sight.
    let n = 0;
    this.visTargets = [];
    for (let i = 0; i < ctx.targets.length && n < MAX_VIS; i++) {
      if (!this.inStrip(ctx.targetPos[i])) continue;
      this.feet[n++].copy(ctx.targetPos[i]).setY(0);
      this.visTargets.push(ctx.targets[i]);
    }
    this.vis = n;
    for (let i = n; i < MAX_VIS; i++) this.feet[i].set(0, -50, 0);
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
    for (const a of this.fernsA) a.reset();
    for (const b of this.fernsB) b.reset();
    this.sleeves.clear();
    this.snow.reset();
    for (const b of this.bands) b.reset();
    this.groundShock.set(this.centre, 0, 0);
    this.pop.set(this.centre, 0, 0);
  }

  /** Builds the crystals: a Vogel spiral over the disc, the tallest near the enemies, plus one beside each enemy. */
  private burst() {
    const n = this.vis;
    const dir = new THREE.Vector3(), base = new THREE.Vector3();
    const place = (x: number, z: number, h: number, lean: number, yaw: number) => {
      const dx = x - this.centre.x, dz = z - this.centre.z, r = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx) + yaw;
      dir.set(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
      base.set(x, 0, z);
      this.bands[r < RADIUS * 0.5 ? 0 : 1].spike(base, dir, h, Math.max(0.42, 0.3 * h), 0.1, (r / RADIUS) * 0.1);
    };
    // Crystals scattered over the strip: along it in order, lateral spread alternating about the axis.
    const side = this.v2.set(this.fwd.z, 0, -this.fwd.x);
    for (let i = 0; i < CRYSTALS; i++) {
      const s = 0.8 + (LENGTH - 1.4) * ((i + 0.5) / CRYSTALS);
      const hash = Math.abs(Math.sin(i * 78.233) * 43758.5453) % 1;
      const lat = (i % 2 ? 1 : -1) * (0.15 + 0.85 * hash) * (HALF_W - 0.2);
      const x = this.from.x + this.fwd.x * s + side.x * lat, z = this.from.z + this.fwd.z * s + side.z * lat;
      let near = 99;
      for (let k = 0; k < n; k++) near = Math.min(near, Math.hypot(x - this.feet[k].x, z - this.feet[k].z));
      if (near < 0.8) continue; // keep the enemy own crystal clear
      const boost = 1 - smoothstep(near / 2.2);
      const h = Math.min(2.2, 0.6 + 0.9 * hash + 0.7 * boost);
      place(x, z, h, 0.15 + 0.25 * Math.abs(lat) / HALF_W + (hash - 0.5) * 0.25, 0);
    }
    // One tall crystal beside every enemy, on the side away from the strip axis, leaning outward.
    for (let k = 0; k < n; k++) {
      const dx = this.feet[k].x - this.from.x, dz = this.feet[k].z - this.from.z;
      const lat = dx * side.x + dz * side.z;
      const sgn = lat >= 0 ? 1 : -1;
      place(this.feet[k].x + side.x * sgn * 0.85, this.feet[k].z + side.z * sgn * 0.85, 2.2, 0.3, 0);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.breath.update(dt);
    for (const a of this.fernsA) a.update(dt);
    for (const b of this.fernsB) b.update(dt);
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
      // The ferns race out of her feet: three patches along the strip, one after the other.
      for (let i = 0; i < PATCHES; i++) {
        this.patchAt(i, this.v1);
        this.fernsA[i].grow(this.v1, PATCH_R, 0.3, i * 0.15);
        this.fernsB[i].grow(this.v1, PATCH_R * 0.94, 0.35, i * 0.15 + 0.05);
      }
    }
    if (!f.snow && t >= 0.25) {
      f.snow = true;
      this.snow.swirl(this.centre, 3.6, 16, { y: 0.8, ySpread: 0.8, speed: 2.0, band: 0.7 });
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.burst();
      this.shake = 0.4;
      // Live positions: whoever stepped out of the strip before the crack is spared.
      if (ctx) {
        for (const e of ctx.targets) {
          if (this.inStrip(e.group.position)) {
            ctx.hit(e, { damage: this.settings.damage, knock: 0, color: FROST_CSS.body, status: { kind: 'root', seconds: this.settings.root } });
          }
        }
      }
    }
    if (!f.stopSnow && t >= SHATTER_T) {
      f.stopSnow = true;
      this.snow.stop();
    }
    if (!f.shatter0 && t >= SHATTER_T) {
      f.shatter0 = true;
      this.bands[0].shatter(3, 4.5, 0.3);
      for (const a of this.fernsA) a.shatter(0.7);
      for (const b of this.fernsB) b.fade(0.7);
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
    const n = this.vis;
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
      ctx!.displace(this.visTargets[i], this.v1.set(0, -0.05 * hold, 0));
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
  // A line from her along the aim: radius is the strip half width for the aim marker.
  targeting: { mode: 'ground', radius: HALF_W },
  create: () => new FrostfernField(),
  telegraphs(effect) {
    const e = effect as FrostfernField;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * LENGTH, z2: ctx.from.z + d.z * LENGTH, width: HALF_W * 2 },
      start: 0, impact: HIT_T,
    }];
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
    f.add(s, 'root', 0, 1.5, 0.1);
  },
};
