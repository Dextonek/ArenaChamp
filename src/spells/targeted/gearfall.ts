import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { CLOCKWORK, CLOCKWORK_CSS, Chain, Gear, Sparks, SteamPuffs } from '../../effects/parts/clockwork';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Gearfall (clockwork kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens to
 * a warm iron dark and a ring of small gears marks the zone. A colossal gear (radius 6, chunky teeth, dark hub, copper
 * spokes) is lowered tilted from the sky on two chains from a crossbeam, turning slowly with sparks jumping along its
 * rim, pulling enemies in a little. It stops and tilts flat with steam from its hub, everything hangs for a dead beat,
 * then it drops. The impact: two impact frames, a ring of loose cogs and steam bursting outward, a cyan spark ring
 * racing across the zone, the hit and a root. The gear spins down, sinks with steam and breaks into cogs that fade, the
 * light lifts. Clean by 4.5 s. See pipeline/designs/kit-clockwork.md.
 */
export interface GearfallSettings {
  damage: number;
  rootSeconds: number;
  loop: boolean;
}

export const defaultGearfall = (): GearfallSettings => ({ damage: 125, rootSeconds: 1.2, loop: false });

// Timeline (seconds).
const MARK_END = 0.4; // darkness in, the ring of small gears unfolded
const DESC_T = 0.3; // the giant gear appears and descends
const STOP_T = 1.6; // it stops and tilts flat, steam from the hub
const BEAT_T = 1.85; // dead beat 1.85..2.0
const DROP_T = 2.0;
const HIT_T = 2.2;
const SINK_T = 3.0;
const BREAK_T = 3.5; // the gear breaks into cogs
const DURATION = 4.5;

const RADIUS = 7;
const GEAR_R = 6;
const GEAR_THICK = 0.9;
const REST_Y = GEAR_THICK / 2;
const HIGH_Y = 4.9; // gear top (tilted) and crane stay under y 8.5
const HOVER_Y = 3.2;
const TILT = 0.5;
const BEAM_UP = 3.2; // crossbeam height above the gear
const RING_GEARS = 14;

export class Gearfall implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GearfallSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];
  /** Horizontal unit vector from the point toward the caster: the gear leans toward the camera side. */
  private lean = new THREE.Vector3(0, 0, 1);
  private side = new THREE.Vector3(1, 0, 0);

  private flags = { ring: false, giant: false, hit: false, broken: false, folded: false };
  private sparkT = 0;
  private steamT = 0;
  private giantIdx = -1;

  // Parts.
  private ringGears = new Gear(RING_GEARS);
  private giant = new Gear(1);
  private cogs = new Gear(26);
  private sparks = new Sparks(200);
  private steam = new SteamPuffs(64);
  private chains = [new Chain(64), new Chain(64)];
  private crane = new THREE.Group();
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: CLOCKWORK.dark, transparent: true, opacity: 0, depthWrite: false });
  private pop = new StarBurst({ points: 12, inner: 0.3, color: CLOCKWORK.accent, core: 0xf0fffb, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private center = new THREE.Vector3();
  private normal = new THREE.Vector3(0, 1, 0);
  private up = new THREE.Vector3(0, 1, 0);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();

  constructor(settings: GearfallSettings = defaultGearfall()) {
    this.settings = settings;
    this.screen.impactColor.set(CLOCKWORK.hot);
    this.screen.tint.set(CLOCKWORK.dark);
    // The crane: a dark iron crossbeam with copper end blocks.
    const iron = new THREE.MeshBasicMaterial({ color: new THREE.Color(CLOCKWORK.dark).multiplyScalar(2.2) });
    const copper = new THREE.MeshBasicMaterial({ color: new THREE.Color(CLOCKWORK.body).multiplyScalar(0.85) });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.5, 0.6), iron);
    this.crane.add(beam);
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.9), copper);
      cap.position.x = sx * 5.6;
      this.crane.add(cap);
    }
    this.crane.visible = false;
    // The shadow of the gear on the floor: a dark layer under the copper.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.group.add(
      this.shade, this.ringGears.mesh, this.giant.mesh, this.cogs.mesh, this.crane, ...this.chains.map((c) => c.mesh), this.sparks.mesh,
      this.steam.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the impact are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.lean.set(ctx.from.x - this.point.x, 0, ctx.from.z - this.point.z);
    if (this.lean.lengthSq() < 1e-4) this.lean.set(0, 0, 1);
    this.lean.normalize();
    this.side.set(this.lean.z, 0, -this.lean.x);
    this.crane.rotation.y = Math.atan2(-this.side.z, this.side.x);
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(2);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.sparkT = 0;
    this.steamT = 0;
    this.giantIdx = -1;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(CLOCKWORK.dark);
    this.ringGears.reset();
    this.giant.reset();
    this.cogs.reset();
    this.sparks.reset();
    this.steam.reset();
    for (const c of this.chains) c.reset();
    this.crane.visible = false;
    this.shade.visible = false;
    this.shadeMat.opacity = 0;
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  /** The giant gear's height at time `t`: down from the sky, a hover, the drop, the sink. */
  private gearY(t: number) {
    if (t < STOP_T) return HIGH_Y + (HOVER_Y - HIGH_Y) * easeOut((t - DESC_T) / (STOP_T - DESC_T));
    if (t < DROP_T) return HOVER_Y - 0.2 * smoothstep((t - STOP_T) / (BEAT_T - STOP_T));
    if (t < HIT_T) return (HOVER_Y - 0.2) + (REST_Y - (HOVER_Y - 0.2)) * Math.pow((t - DROP_T) / (HIT_T - DROP_T), 2);
    return REST_Y - 0.55 * smoothstep((t - SINK_T) / (BREAK_T + 0.3 - SINK_T));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    const held = this.playing && this.time >= BEAT_T && this.time < DROP_T;
    this.ringGears.frozen = this.giant.frozen = this.cogs.frozen = this.sparks.frozen = this.steam.frozen = held;
    this.ringGears.update(dt);
    this.giant.update(dt);
    this.cogs.update(dt);
    this.sparks.update(dt);
    this.steam.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    // --- 0..0.4: the ring of small gears marks the zone. ---
    if (!f.ring && t >= 0.02) {
      f.ring = true;
      for (let i = 0; i < RING_GEARS; i++) {
        const a = (i / RING_GEARS) * Math.PI * 2 + 0.2;
        this.ringGears.place(this.v1.set(this.point.x + Math.cos(a) * RADIUS, 0.1, this.point.z + Math.sin(a) * RADIUS), this.up, 0.5 + (i % 3) * 0.08, (i % 2 ? -1 : 1) * 3, { thick: 0.13 });
      }
      this.ringGears.assemble(MARK_END);
      this.shade.visible = true;
      this.shade.position.set(this.point.x, 0.03, this.point.z);
      this.shade.scale.setScalar(GEAR_R + 0.4);
    }
    // --- 0.3: the colossal gear starts down. ---
    if (!f.giant && t >= DESC_T) {
      f.giant = true;
      this.giantIdx = this.giant.place(this.v1.set(this.point.x, HIGH_Y, this.point.z), this.up, GEAR_R, 0.9, { teeth: 20, spokes: 6, thick: GEAR_THICK });
      this.giant.assemble(0.3);
      this.crane.visible = true;
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.hit();
    }
    if (f.hit && !f.broken && t >= BREAK_T) {
      f.broken = true;
      this.breakGear();
    }
    if (f.hit && !f.folded && t >= 3.2) {
      f.folded = true;
      this.ringGears.fold(0.5);
    }

    this.layout(dt);
  }

  private hit() {
    const ctx = this.ctx, P = this.point;
    this.sparks.burst(this.v1.set(P.x, 1.0, P.z), 10);
    // A ring of loose cogs bursts outward, with steam.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4, r = 2.4 + Math.random() * 1.2;
      this.v1.set(P.x + Math.cos(a) * r, 0.7, P.z + Math.sin(a) * r);
      this.v2.set(Math.random() - 0.5, 1, Math.random() - 0.5);
      this.cogs.place(this.v1, this.v2, 0.42 + Math.random() * 0.25, 7, { instant: true });
    }
    this.cogs.scatter(7.5, 1.0, P);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3, r = 4.6 + Math.random() * 1.4;
      this.v1.set(P.x + Math.cos(a) * r, 0.3, P.z + Math.sin(a) * r);
      this.steam.puff(this.v1, this.v2.set(Math.cos(a), 0.2, Math.sin(a)), 2);
    }
    // Chains snap loose at the gear: a flash of sparks, the crane draws up.
    for (const sx of [-1, 1]) {
      this.v1.copy(this.point).addScaledVector(this.side, sx * 5.6).setY(REST_Y + 0.5);
      this.sparks.burst(this.v1, 4);
    }
    // Re-check where everyone stands now: enemies who walked out are spared.
    if (ctx) for (const e of ctx.targets) {
      if (this.inside(e)) ctx.hit(e, { damage: this.settings.damage, knock: 0, from: P, color: CLOCKWORK_CSS.body, status: { kind: 'root', seconds: this.settings.rootSeconds } });
    }
  }

  /** The gear breaks into cogs that fade, with steam. */
  private breakGear() {
    const P = this.point;
    if (this.giantIdx >= 0) this.giant.hide(this.giantIdx);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5, r = 1.2 + Math.random() * 4.2;
      this.v1.set(P.x + Math.cos(a) * r, 0.6, P.z + Math.sin(a) * r);
      this.v2.set(Math.random() - 0.5, 1, Math.random() - 0.5);
      this.cogs.place(this.v1, this.v2, 0.4 + Math.random() * 0.3, 5, { instant: true });
    }
    this.cogs.scatter(3.2, 0.8, P);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 4.5;
      this.steam.puff(this.v1.set(P.x + Math.cos(a) * r, 0.4, P.z + Math.sin(a) * r), this.up, 2);
    }
    this.shake = Math.max(this.shake, 0.2);
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  private layout(dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    const after = t - HIT_T;
    const f = this.flags;

    // --- Screen: a warm iron dark, a lift at the landing, lifting away as the gear breaks. Impact frames at the hit. ---
    let dk = 0.55 * smoothstep(t / MARK_END) * (1 - smoothstep((t - 3.4) / 0.8));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The giant gear: down, tilted, to a hover, flat, dropped. ---
    const y = this.gearY(t);
    if (f.giant && !f.broken) {
      const tilt = (TILT + 0.06 * Math.sin(t * 3.1)) * (1 - smoothstep((t - STOP_T) / (BEAT_T - STOP_T)));
      this.normal.copy(this.up).multiplyScalar(Math.cos(tilt)).addScaledVector(this.lean, Math.sin(tilt));
      this.center.set(this.point.x, y, this.point.z);
      this.giant.move(this.giantIdx, this.center, this.normal);
      // Slow turn that winds down after the landing.
      this.giant.setRate(this.giantIdx, 0.9 * (1 - smoothstep(after / 1.0)));
    }

    // --- The crane: a crossbeam above the gear and two chains down to its rim, until the landing. ---
    if (f.giant) {
      const beamY = y + BEAM_UP + (after >= 0.05 ? 16 * easeIn((after - 0.05) / 0.8) : 0);
      this.crane.position.set(this.point.x, beamY, this.point.z);
      this.crane.visible = after < 0.9 && !f.broken;
      for (let i = 0; i < 2; i++) {
        const sx = i === 0 ? -1 : 1;
        if (after >= 0 || !this.crane.visible) { this.chains[i].hide(); continue; }
        // From the rim (on the gear's tilt axis, so it does not spin with the teeth) up to the end block.
        this.v1.copy(this.center).addScaledVector(this.side, sx * 5.6).addScaledVector(this.normal, GEAR_THICK * 0.5 + 0.1);
        this.v2.set(this.point.x + this.side.x * sx * 5.6, beamY - 0.3, this.point.z + this.side.z * sx * 5.6);
        this.chains[i].set(this.v1, this.v2);
      }
    }

    // --- The shadow on the floor grows as the gear comes down and goes when it breaks. ---
    if (f.giant) {
      const near = 1 - Math.min(1, Math.max(0, (y - REST_Y) / (HIGH_Y - REST_Y)));
      const gone = f.broken ? 1 - smoothstep((t - BREAK_T) / 0.4) : 1;
      this.shadeMat.opacity = (0.15 + 0.4 * near) * gone;
    }

    // --- Sparks along the rim while it hangs; steam from the hub as it settles. ---
    if (t >= 0.45 && t < HIT_T && f.giant) {
      this.sparkT += dt;
      while (this.sparkT >= 0.08) {
        this.sparkT -= 0.08;
        const a = Math.random() * Math.PI * 2, b = a + 0.14 + Math.random() * 0.14;
        this.v4.crossVectors(this.normal, this.side).normalize();
        this.v1.copy(this.center).addScaledVector(this.side, Math.cos(a) * GEAR_R).addScaledVector(this.v4, Math.sin(a) * GEAR_R).addScaledVector(this.normal, GEAR_THICK * 0.5);
        this.v2.copy(this.center).addScaledVector(this.side, Math.cos(b) * GEAR_R).addScaledVector(this.v4, Math.sin(b) * GEAR_R).addScaledVector(this.normal, GEAR_THICK * 0.5);
        this.sparks.arc(this.v1, this.v2, 0.12);
      }
    }
    if (t >= STOP_T && t < BEAT_T) {
      this.steamT += dt;
      while (this.steamT >= 0.06) {
        this.steamT -= 0.06;
        this.v1.copy(this.center).addScaledVector(this.normal, GEAR_THICK * 0.5 + 0.2);
        this.steam.puff(this.v1, this.up, 2);
      }
    }
    // Steam seeps from the gear as it sinks.
    if (f.hit && t >= SINK_T && t < BREAK_T) {
      this.steamT += dt;
      while (this.steamT >= 0.07) {
        this.steamT -= 0.07;
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4.5;
        this.steam.puff(this.v1.set(this.point.x + Math.cos(a) * r, 0.7, this.point.z + Math.sin(a) * r), this.up, 1);
      }
    }

    // --- The pull on the enemies: in while the gear comes down, released at the landing. ---
    if (ctx) {
      const pull = 0.4 * smoothstep((t - DESC_T) / (HIT_T - DESC_T)) * (1 - smoothstep(after / 0.3));
      for (const v of this.victims) {
        this.v3.set(this.point.x - v.feet.x, 0, this.point.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    // --- The landing: cyan spark ring racing across the zone, star, ground refraction, shake. ---
    if (f.hit) {
      if (after < 0.4) this.sparks.ring(this.point, 0.6 + (RADIUS - 0.6) * (1 - Math.pow(1 - after / 0.4, 3)), 16, 0.55);
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.5), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(0.75 * Math.exp(-after * 9), f.broken ? 0.2 * Math.exp(-(t - BREAK_T) * 8) : 0);
    }
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeIn = (x: number) => Math.pow(Math.min(1, Math.max(0, x)), 2);

export const gearfallModule: EffectModule = {
  label: 'gearfall',
  category: 'hero: clockwork',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Gearfall(),
  telegraphs(effect) {
    const e = effect as Gearfall;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Gearfall;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as Gearfall).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
    f.add(s, 'rootSeconds', 0, 1.5, 0.1);
  },
};
