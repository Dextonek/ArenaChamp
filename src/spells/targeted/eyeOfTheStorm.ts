import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  LightningTree, Puddles, RainSheet, Sparks, StormCloud, STORM, STORM_CSS,
} from '../../effects/parts/storm';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Eye of the Storm (storm kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world
 * darkens blue-black and wind-blown rain starts across the whole zone. A vast ring of dark storm cloud forms high over
 * it and turns, with a clear eye in the middle; lightning flickers inside the cloud wall and rain sheets slant around
 * the ring. The eye narrows and the cloud brightens, everything stops for a dead beat, then one colossal lightning
 * tree slams down through the eye onto the point and forks across the floor to every enemy. Then the bolt flickers
 * out, the cloud breaks up and the rain stops. Clean by 4.5 s. See pipeline/designs/kit-storm.md.
 */
export interface EyeOfTheStormSettings {
  damage: number;
  loop: boolean;
}

export const defaultEyeOfTheStorm = (): EyeOfTheStormSettings => ({ damage: 150, loop: false });

// Timeline (seconds).
const LIFT_T = 0.0; // she raises the staff, the world darkens
const FORM_T = 0.3; // the cloud ring starts to form
const TIGHT_T = 1.6; // the eye narrows, the cloud brightens
const BEAT_T = 1.85; // dead beat 1.85..2.0
const STRIKE_T = 2.0; // the colossal tree starts down
const HIT_T = 2.2;
const RAIN_STOP_T = 3.0;
const BREAK_T = 3.1;
const DRY_T = 3.4;
const DURATION = 4.5;

const RADIUS = 5;
const CLOUD_Y = 5.5;
const CLOUD_R = 5.5;
const EYE_R0 = 2.0;
const EYE_R1 = 1.3;
const MAX_VIS = 6; // enemies that get their own ground fork

export class EyeOfTheStorm implements Effect {
  readonly group = new THREE.Group();
  readonly settings: EyeOfTheStormSettings;
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
  private base = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];

  private flags = {
    sparks: false, rain: false, cloud: false, wet: false, strike: false, hit: false, rainStop: false, broken: false, dry: false,
  };
  private sparkTimer = 0;
  private wallTimer = 0.7;
  private kick = 0;

  // Parts.
  private cloud = new StormCloud(110);
  private rainOuter = new RainSheet(220);
  private rainInner = new RainSheet(100);
  private puddles = new Puddles();
  private tree = new LightningTree(24, 3200);
  private sparks = new Sparks(120);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: STORM.accent, core: 0xfffbe0, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private zero = new THREE.Vector3();

  constructor(settings: EyeOfTheStormSettings = defaultEyeOfTheStorm()) {
    this.settings = settings;
    this.screen.impactColor.set(STORM.hot);
    this.screen.tint.set(STORM.dark);
    for (const r of [this.rainOuter, this.rainInner]) {
      r.height = 7;
      r.slant = 0.55;
      r.slantZ = 0.15;
      r.speed = 20;
    }
    this.group.add(
      this.puddles.mesh, this.rainOuter.mesh, this.rainInner.mesh, this.cloud.mesh, this.tree.mesh, this.sparks.mesh,
      this.pop.mesh, this.groundShock.mesh,
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
    this.base.copy(ctx.from).addScaledVector(this.fwd, 0.45).setY(0.95);
    this.tip.copy(ctx.from).addScaledVector(this.fwd, 0.75).setY(1.95);
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(3);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.sparkTimer = 0;
    this.wallTimer = 0.7;
    this.kick = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(STORM.dark);
    this.cloud.reset();
    this.rainOuter.reset();
    this.rainInner.reset();
    this.puddles.reset();
    this.tree.reset();
    this.sparks.reset();
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  /** A small tree flickering inside the cloud wall, hanging from the underside. */
  private wallBolt() {
    const eye = this.cloud.eye, rad = this.cloud.radius;
    const a = Math.random() * Math.PI * 2, r = eye + (rad - eye) * (0.25 + 0.7 * Math.random());
    const x = this.point.x + Math.cos(a) * r, z = this.point.z + Math.sin(a) * r;
    const y0 = CLOUD_Y - 0.15 + this.cloud.heightAt(x, z);
    this.v1.set(x, y0, z);
    this.v2.set(x + (Math.random() - 0.5) * 2, y0 - 1.6 - Math.random() * 1.4, z + (Math.random() - 0.5) * 2);
    this.tree.strike(this.v1, this.v2, 2, 0.14, 0.16 + Math.random() * 0.1, { hold: 0.5, levels: 2 });
    this.kick = 0.7;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const held = this.time >= BEAT_T && this.time < STRIKE_T;
    this.cloud.frozen = held;
    this.rainOuter.frozen = this.rainInner.frozen = held;
    this.puddles.frozen = held;
    this.tree.frozen = held;
    this.cloud.update(dt);
    this.rainOuter.update(dt);
    this.rainInner.update(dt);
    this.puddles.update(dt);
    this.tree.update(dt);
    this.sparks.update(dt);
    this.kick *= Math.exp(-dt * 9);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // She raises the staff: crackle along it.
    if (t >= LIFT_T && t < 0.5) {
      this.sparkTimer += dt;
      while (this.sparkTimer >= 0.05) {
        this.sparkTimer -= 0.05;
        this.sparks.along(this.base, this.tip, 3, 2.6);
      }
    }
    if (!f.rain && t >= 0.1) {
      f.rain = true;
      this.rainOuter.fall(this.point, 7.5, 0, 1, 3.2);
      this.rainInner.fall(this.point, 3.8, 0, 0.45);
    }
    if (!f.cloud && t >= FORM_T) {
      f.cloud = true;
      this.cloud.tiltDir.set(this.from.x - this.point.x, 0, this.from.z - this.point.z).normalize();
      this.cloud.tilt = 0.22;
      this.cloud.gather(this.point, CLOUD_R, CLOUD_Y, 1.3, { eye: EYE_R0, spin: 0.5 });
    }
    if (!f.wet && t >= 0.4) {
      f.wet = true;
      this.puddles.wet(this.point, 6.6);
      this.puddles.wet(this.v1.set(this.point.x + 1.5, 0, this.point.z - 1), 4.2);
      this.puddles.drizzle(this.point, 6.6, 16);
    }
    // Lightning flickers inside the cloud wall.
    if (t >= 0.7 && t < BEAT_T) {
      this.wallTimer -= dt;
      if (this.wallTimer <= 0) {
        this.wallTimer = 0.14 + Math.random() * 0.16;
        this.wallBolt();
      }
    }
    if (!f.strike && t >= STRIKE_T) {
      f.strike = true;
      this.v1.set(this.point.x + 0.3, 8.6, this.point.z);
      this.v2.set(this.point.x, 0.05, this.point.z);
      this.tree.strike(this.v1, this.v2, 7, 0.7, DURATION - 0.1 - STRIKE_T, {
        grow: HIT_T - STRIKE_T, hold: 0.3, groundForks: 8, levels: 3, maxSegments: 320, jag: 0.9,
      });
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.kick = 1;
      // The tree forks out across the floor to every enemy.
      for (let i = 0; i < Math.min(MAX_VIS, this.victims.length); i++) {
        const v = this.victims[i];
        this.v1.set(this.point.x, 0.2, this.point.z);
        this.v2.set(v.feet.x, 0.7, v.feet.z);
        this.tree.strike(this.v1, this.v2, 1, 0.26, 1.4, { hold: 0.3, levels: 2, delay: 0.02 });
        this.puddles.ripple(v.feet, 2.0);
        this.sparks.burst(this.v2, 8, 6);
      }
      this.sparks.burst(this.v1.set(this.point.x, 0.4, this.point.z), 28, 9);
      this.puddles.ripple(this.point, 3.5);
      if (ctx) for (const e of ctx.targets) if (Math.hypot(e.group.position.x - this.point.x, e.group.position.z - this.point.z) <= RADIUS) ctx.hit(e, { damage: this.settings.damage, knock: 6, from: this.point, color: STORM_CSS.body });
    }
    if (!f.rainStop && t >= RAIN_STOP_T) {
      f.rainStop = true;
      this.rainOuter.stop();
      this.rainInner.stop();
    }
    if (!f.broken && t >= BREAK_T) {
      f.broken = true;
      this.cloud.disperse(1.2);
    }
    if (!f.dry && t >= DRY_T) {
      f.dry = true;
      this.puddles.dry(1.0);
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
    const after = t - HIT_T;

    // --- Screen: hard blue-black darken, a lift at the landing, lifting away in the release. Impact frames at the hit. ---
    let dk = 0.65 * smoothstep(t / 0.4) * (1 - smoothstep((t - RAIN_STOP_T) / 1.4));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The storm wheel: the eye narrows and the ring tightens and speeds up before the strike. ---
    const tight = smoothstep((t - TIGHT_T) / (BEAT_T - TIGHT_T));
    this.cloud.eye = EYE_R0 + (EYE_R1 - EYE_R0) * tight;
    this.cloud.radius = CLOUD_R - 0.5 * tight;
    this.cloud.spin = 0.5 + 0.9 * tight;
    const ramp = 0.8 * smoothstep((t - 1.5) / 0.4) * (t < HIT_T ? 1 : 0);
    const hitFlash = after >= 0 ? Math.exp(-after * 2.6) : 0;
    this.cloud.flash = Math.max(this.kick, ramp, hitFlash);

    // --- The landing: star at the centre, ground refraction, shake. ---
    if (f.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.2), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 7 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.8 * Math.exp(-after * 9);
    }
  }
}

export const eyeOfTheStormModule: EffectModule = {
  label: 'eye of the storm',
  category: 'hero: storm',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new EyeOfTheStorm(),
  telegraphs(effect) {
    const e = effect as EyeOfTheStorm;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as EyeOfTheStorm;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as EyeOfTheStorm).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
