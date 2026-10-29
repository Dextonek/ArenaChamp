import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  FROST, FROST_CSS, FrostBreath, FrostFerns, IceCrystals, RimeSleeves, Snow,
} from '../../effects/parts/frost';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Winter's Crown (frost kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens
 * cold and frost ferns spread over the whole zone (the warning). A ring of huge ice crystals forms upside down in the
 * sky over it, growing from the tips, with heavy snow swirling into the ring while the enemies are rimed and held.
 * The crown turns and tightens, everything stops for a dead beat, then it drives down: the crystals stab into the
 * ground in a ring and a forest of crystals erupts across the zone. After a hold everything shatters from the centre
 * outward. Clean by 4.5 s. See pipeline/designs/kit-frost.md.
 */
export interface WintersCrownSettings {
  damage: number;
  loop: boolean;
}

export const defaultWintersCrown = (): WintersCrownSettings => ({ damage: 125, loop: false });

// Timeline (seconds).
const LIFT_T = 0.0; // hands go up, the world darkens
const FORM_T = 0.3; // crown starts to form
const TURN_T = 1.5; // crown turns and tightens
const BEAT_T = 1.85; // dead beat 1.85..2.0
const DRIVE_T = 2.0;
const HIT_T = 2.3;
const SHATTER_T = 3.3;
const DURATION = 4.5;

const RADIUS = 7;
const TEETH = 11;
const TIP_Y = 4; // height of the tooth tips over the point while the crown hangs
const TILT = 0.22; // how far the teeth lean inward toward their tips
const TIP_R0 = 3.2; // tip ring radius while forming
const TIP_R1 = 2.7; // tip ring radius when tightened (and where the teeth stab down)
const MAX_VIS = 8; // enemies that get their own rime
const FOREST = 48;

const c01 = (x: number) => Math.min(1, Math.max(0, x));
const hash = (i: number) => Math.abs(Math.sin(i * 78.233 + 1.7) * 43758.5453) % 1;

interface Tooth { id: number; len: number; tipY0: number; angle: number }

export class WintersCrown implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WintersCrownSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private chest = new THREE.Vector3(0, 1.25, 14);
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];

  private flags = {
    lift: false, ferns: false, crown: false, snowHigh: false, snowLow: false, beat: false, hit: false, snowFall: false,
    shatter: [false, false, false, false], fernFade: false, snowStop: false,
  };
  private teeth: Tooth[] = [];

  // Parts.
  private breath = new FrostBreath(12);
  private fernsA = new FrostFerns({ variant: 0, maxShards: 40 });
  private fernsB = new FrostFerns({ variant: 1, maxShards: 0 });
  private sleeves = new RimeSleeves(MAX_VIS);
  private crown = new IceCrystals({ maxSpikes: TEETH + 1, maxShards: 110 });
  // The forest is split in three radial bands so the release can shatter from the centre outward.
  private bands = [0, 1, 2].map(() => new IceCrystals({ maxSpikes: 40, maxShards: 90 }));
  private snow = new Snow({ max: 130 });
  private pop = new StarBurst({ points: 12, inner: 0.3, color: FROST.accent, core: 0xfff0f6, additive: false });
  private groundRing = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private zero = new THREE.Vector3();

  constructor(settings: WintersCrownSettings = defaultWintersCrown()) {
    this.settings = settings;
    this.screen.impactColor.set(FROST.rime);
    this.screen.tint.set(FROST.dark);
    this.fernsA.renderOrder = 2;
    this.fernsB.renderOrder = 1;
    for (const b of this.bands) b.shards.gravity = -18;
    this.snow.size = 1.5;
    this.group.add(
      this.fernsB.mesh, this.fernsA.mesh, this.sleeves.mesh, ...this.bands.map((b) => b.mesh), this.crown.mesh,
      this.snow.mesh, this.breath.mesh, this.pop.mesh, this.groundRing.mesh,
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
    this.point.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.15).setY(1.25);
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p || this.victims.length >= MAX_VIS) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.crown.mesh];
    this.screen.focus.copy(this.point).setY(3);
    this.groundRing.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.teeth.length = 0;
    const f = this.flags;
    f.lift = f.ferns = f.crown = f.snowHigh = f.snowLow = f.beat = f.hit = f.snowFall = f.fernFade = f.snowStop = false;
    f.shatter = [false, false, false, false];
    clearScreenFx(this.screen);
    this.screen.tint.set(FROST.dark);
    this.breath.reset();
    this.fernsA.reset();
    this.fernsB.reset();
    this.sleeves.clear();
    this.crown.reset();
    for (const b of this.bands) b.reset();
    this.snow.reset();
    this.pop.set(this.point, 0, 0);
    this.groundRing.set(this.point, 0, 0);
  }

  /** Pose of tooth i at time t: base position and direction (points down and inward). */
  private pose(tooth: Tooth, t: number, base: THREE.Vector3, dir: THREE.Vector3) {
    const turn = 0.6 * smoothstep((t - TURN_T) / (BEAT_T - TURN_T)) + 0.15 * smoothstep((t - FORM_T) / 1.2);
    const tighten = smoothstep((t - TURN_T) / 0.4);
    const tipR = TIP_R0 + (TIP_R1 - TIP_R0) * tighten;
    const drive = Math.pow(c01((t - DRIVE_T) / (HIT_T - DRIVE_T)), 2.2);
    const tipY = tooth.tipY0 - (tooth.tipY0 + 0.2) * drive;
    const a = tooth.angle + turn;
    const ca = Math.cos(a), sa = Math.sin(a);
    const baseR = tipR + tooth.len * Math.sin(TILT);
    base.set(this.point.x + ca * baseR, tipY + tooth.len * Math.cos(TILT), this.point.z + sa * baseR);
    dir.set(-ca * Math.sin(TILT), -Math.cos(TILT), -sa * Math.sin(TILT));
  }

  private buildCrown() {
    const base = this.v1, dir = this.v2;
    for (let i = 0; i < TEETH; i++) {
      const len = 5.2 + 1.2 * hash(i);
      const tooth: Tooth = { id: -1, len, tipY0: TIP_Y + (hash(i + 40) - 0.5) * 0.8, angle: (i / TEETH) * Math.PI * 2 + 0.3 };
      this.pose(tooth, FORM_T, base, dir);
      tooth.id = this.crown.spike(base, dir, len, len * 0.2, 0.5, i * 0.07, true);
      this.teeth.push(tooth);
    }
  }

  /** The landing: a forest of crystals across the zone, the tallest around the enemies. */
  private buildForest() {
    const base = this.v1, dir = this.v2;
    const place = (x: number, z: number, h: number, w: number, lean: number) => {
      const dx = x - this.point.x, dz = z - this.point.z, r = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx);
      dir.set(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
      base.set(x, 0, z);
      const band = r < RADIUS * 0.34 ? 0 : r < RADIUS * 0.67 ? 1 : 2;
      this.bands[band].spike(base, dir, h, w, 0.12, (r / RADIUS) * 0.2);
    };
    for (let i = 0; i < FOREST; i++) {
      const r = (RADIUS - 0.3) * Math.sqrt((i + 0.5) / FOREST);
      const a = i * 2.39996 + Math.sin(i * 12.9898) * 0.25;
      const x = this.point.x + Math.cos(a) * r, z = this.point.z + Math.sin(a) * r;
      // Keep the crown's stab points and the enemies' own crystals clear.
      let skip = Math.abs(r - TIP_R1) < 0.5 && teethNear(this.teeth, this.point, x, z, 1.0);
      for (const v of this.victims) if (Math.hypot(x - v.feet.x, z - v.feet.z) < 0.8) skip = true;
      if (skip) continue;
      const hh = hash(i);
      let near = 99;
      for (const v of this.victims) near = Math.min(near, Math.hypot(x - v.feet.x, z - v.feet.z));
      const boost = 1 - smoothstep(near / 2.2);
      let h = (3.2 - 1.6 * (r / RADIUS)) * (0.6 + 0.6 * hh) + 0.6 * boost;
      h = THREE.MathUtils.clamp(h, 1.2, 3.6);
      place(x, z, h, Math.max(0.5, 0.3 * h), 0.15 + 0.25 * (r / RADIUS) + (hh - 0.5) * 0.25);
    }
    // A tall crystal beside every enemy, on the side away from the centre.
    this.victims.forEach((v, k) => {
      const out = this.v3.subVectors(v.feet, this.point).setY(0);
      if (out.lengthSq() < 1e-3) out.set(Math.cos(k * 2.1), 0, Math.sin(k * 2.1));
      out.normalize();
      place(v.feet.x + out.x * 0.9, v.feet.z + out.z * 0.9, 4.2, 0.95, 0.28);
    });
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const held = this.time >= BEAT_T && this.time < DRIVE_T;
    this.breath.update(dt);
    this.fernsA.update(dt);
    this.fernsB.update(dt);
    this.snow.frozen = held;
    this.snow.update(dt);
    this.crown.update(dt);
    for (const b of this.bands) b.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.lift && t >= LIFT_T + 0.02) {
      f.lift = true;
      this.breath.blow(this.chest, this.v1.set(0, 1, 0).addScaledVector(this.fwd, 0.4), 1.4, 0.3);
    }
    if (!f.ferns && t >= 0.05) {
      f.ferns = true;
      this.fernsA.grow(this.point, RADIUS, 0.9);
      this.fernsB.grow(this.point, RADIUS * 0.9, 0.9, 0.1);
    }
    if (!f.crown && t >= FORM_T) {
      f.crown = true;
      this.buildCrown();
    }
    if (!f.snowHigh && t >= FORM_T) {
      f.snowHigh = true;
      this.snow.swirl(this.v1.copy(this.point), 4.2, 58, { y: 6, ySpread: 3.5, speed: 2.2, band: 0.6, shrink: 0.08 });
    }
    if (!f.snowLow && t >= 0.5) {
      f.snowLow = true;
      this.snow.swirl(this.v1.copy(this.point), 5.8, 24, { y: 1.5, ySpread: 1.4, speed: 2.4, band: 0.7 });
    }
    if (!f.snowStop && t >= HIT_T) {
      f.snowStop = true;
      this.snow.stop();
    }
    if (!f.snowFall && t >= HIT_T + 0.1) {
      f.snowFall = true;
      this.snow.fall(this.point, RADIUS, 46, 11, 1.4);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.buildForest();
      if (ctx) for (const v of this.victims) ctx.hit(v.enemy, { damage: this.settings.damage, knock: 4, from: this.point, color: FROST_CSS.body });
    }
    if (!f.fernFade && t >= SHATTER_T) {
      f.fernFade = true;
      this.fernsA.shatter(0.9);
      this.fernsB.fade(0.9);
    }
    const bandAt = [SHATTER_T, SHATTER_T + 0.12, SHATTER_T + 0.24, SHATTER_T + 0.38];
    for (let b = 0; b < 4; b++) {
      if (!f.shatter[b] && t >= bandAt[b]) {
        f.shatter[b] = true;
        if (b < 3) this.bands[b].shatter(3, 5, 0.3);
        else { this.crown.shatter(8, 5, 0.3); this.snow.stop(); }
      }
    }

    this.layout();
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.zero);
    this.reset();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = t - HIT_T;

    // --- Screen: hard cold darken, a lift at the landing, lifting in the release. Impact frames at the hit. ---
    let dk = 0.6 * smoothstep(t / 0.4) * (1 - smoothstep((t - SHATTER_T) / 1.0));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The crown: the teeth follow their pose (turn, tighten, drive down). ---
    if (f.crown && !f.shatter[3]) {
      for (const tooth of this.teeth) {
        this.pose(tooth, t, this.v1, this.v2);
        this.crown.place(tooth.id, this.v1, this.v2);
      }
    }

    // --- Enemies: rimed from 0.4, held (sink) from 0.5, released with the shatter. ---
    const sink = 0.1 * smoothstep((t - 0.5) / 0.5) * (1 - smoothstep((t - SHATTER_T) / 0.3));
    const rimeOp = 1 - smoothstep((t - SHATTER_T) / 0.6);
    for (let i = 0; i < MAX_VIS; i++) {
      const v = this.victims[i];
      if (!v) { this.sleeves.set(i, this.zero, 2.2, 1.0, 0, 0); continue; }
      this.sleeves.set(i, this.v1.copy(v.feet).setY(-sink), 2.2, 1.0, smoothstep((t - 0.4) / 0.9), rimeOp);
      ctx?.displace(v.enemy, this.v2.set(0, -sink, 0));
    }

    // --- The landing: ground refraction, accent star at the centre, shake. ---
    if (f.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.2), 2 * sp.scale, sp.opacity, 0.2);
      const gp = c01(after / 0.5);
      this.groundRing.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.75 * Math.exp(-after * 9);
    }
  }
}

/** True if (x, z) lies within `r` of the ground point where any tooth will stab down. */
function teethNear(teeth: Tooth[], centre: THREE.Vector3, x: number, z: number, r: number) {
  const turn = 0.75;
  for (const tooth of teeth) {
    const a = tooth.angle + turn;
    if (Math.hypot(x - (centre.x + Math.cos(a) * TIP_R1), z - (centre.z + Math.sin(a) * TIP_R1)) < r) return true;
  }
  return false;
}

export const wintersCrownModule: EffectModule = {
  label: "winter's crown",
  category: 'hero: frost',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new WintersCrown(),
  telegraphs(effect) {
    const e = effect as WintersCrown;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as WintersCrown;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as WintersCrown).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
