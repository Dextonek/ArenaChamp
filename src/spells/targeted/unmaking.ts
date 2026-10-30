import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { AshMotes, Crackle, Rift, Shards, VOID, VOID_CSS } from '../../effects/parts/void';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Unmaking (void kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens to black
 * and a crack line traces the radius-5 circle; the ground inside cracks like glass from the centre out, plates of ground
 * drift inward and a vast vertical rift (about 6 tall) opens above the point and widens while shards and ash stream into
 * it and the enemies are drawn in. At 1.6 s the rift goes still and its edges flicker cyan; dead beat 1.85..2.0. At 2.0 s
 * the rift slams shut and the cracked disc inverts for two frames (the floor plates go black with pink edges). At 2.2 s
 * impact frames, the plates shatter outward as shards, a cyan star, the ground refraction, and the hit. The shards fall
 * and fade, the cracks heal and the darkness lifts; clean by 4.5 s. See pipeline/designs/kit-void.md.
 */
export interface UnmakingSettings {
  damage: number;
  loop: boolean;
}

export const defaultUnmaking = (): UnmakingSettings => ({ damage: 120, loop: false });

// Timeline (seconds).
const RING_T = 0; // the outline circle is traced 0..0.4
const CRACK_T = 0.3; // the ground cracks from the centre out, the rift opens
const PLATE_T = 0.5; // plates of ground lift and drift inward
const FLICKER_T = 1.6;
const BEAT_T = 1.85; // dead beat 1.85..2.0
const SLAM_T = 2.0;
const INVERT_T = 2.1; // two frames
const INVERT_END = 2.17;
const HIT_T = 2.2;
const HEAL_T = 2.5;
const DURATION = 4.5;

const RADIUS = 5;
const RIFT_H = 6;
const RIFT_BASE = 0.3;

const sstep = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));

export class Unmaking implements Effect {
  readonly group = new THREE.Group();
  readonly settings: UnmakingSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private ashClock = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private from0 = new THREE.Vector3();
  private face = new THREE.Vector3(0, 0, 1);
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];
  private flags = { ring: false, crack: false, plates: false, flicker: false, slam: false, heal: false, hit: false };

  // Parts.
  private crackle = new Crackle();
  private rift = new Rift(2);
  private shards = new Shards(14);
  private motes = new AshMotes(40);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: VOID.accent, core: VOID.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: UnmakingSettings = defaultUnmaking()) {
    this.settings = settings;
    this.screen.impactColor.set(VOID.hot);
    this.screen.tint.set(VOID.dark);
    this.group.add(this.crackle.mesh, this.rift.mesh, this.shards.mesh, this.motes.mesh, this.pop.mesh, this.groundShock.mesh);
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
    this.from0.copy(ctx.from).setY(0);
    // The vast rift stands flat toward the gameplay camera (behind the caster).
    this.face.set(this.from0.x - this.point.x, 0, this.from0.z - this.point.z);
    if (this.face.lengthSq() < 1e-4) this.face.set(-Math.sin(ctx.aim), 0, -Math.cos(ctx.aim));
    this.face.normalize();
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
    this.ashClock = 0;
    this.shake = 0;
    const f = this.flags;
    f.ring = f.crack = f.plates = f.flicker = f.slam = f.heal = f.hit = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(VOID.dark);
    this.crackle.reset();
    this.rift.reset();
    this.shards.reset();
    this.motes.reset();
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const held = this.time >= BEAT_T && this.time < SLAM_T;
    this.crackle.frozen = held;
    this.rift.frozen = held;
    this.shards.frozen = held;
    this.motes.frozen = held;
    this.crackle.update(dt);
    this.rift.update(dt);
    this.shards.update(dt);
    this.motes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // 0..0.4: a crack line traces the circle.
    if (!f.ring && t >= RING_T) {
      f.ring = true;
      this.crackle.width = 0.6;
      this.crackle.ring(this.point, RADIUS, 0.4);
    }
    // 0.3..1.6: the ground cracks from the centre out; the vast rift opens above the point.
    if (!f.crack && t >= CRACK_T) {
      f.crack = true;
      this.crackle.grow(this.point, RADIUS, 1.3);
      this.rift.openStanding(this.v1.set(this.point.x, RIFT_BASE, this.point.z), RIFT_H, this.face, 1.2, 1.3, { sweep: 0.5, seed: 17 });
    }
    // Plates of ground lift and drift inward into the rift.
    if (!f.plates && t >= PLATE_T) {
      f.plates = true;
      this.v2.copy(this.point).setY(0.1);
      this.v3.copy(this.point).setY(3.2);
      this.shards.drift(this.v2, this.v3, 12, 1.3, RADIUS - 1, 0.8);
    }
    // Shards-dust and ash stream in while it builds.
    if (!held && t >= CRACK_T && t < SLAM_T) {
      this.ashClock += dt;
      if (this.ashClock >= 0.12) {
        this.ashClock = 0;
        const a = Math.random() * Math.PI * 2;
        this.v1.set(this.point.x + Math.cos(a) * (RADIUS - 1.2), 0, this.point.z + Math.sin(a) * (RADIUS - 1.2));
        this.motes.emit(this.v1, 1.2, 2);
      }
    }
    // 1.6..1.85: the rift goes still and its edges flicker cyan.
    if (!f.flicker && t >= FLICKER_T) {
      f.flicker = true;
      this.rift.flicker = true;
    }
    // 2.0: the rift slams shut.
    if (!f.slam && t >= SLAM_T) {
      f.slam = true;
      this.rift.flicker = false;
      this.rift.close(0.2);
    }

    // Draw the enemies in while the rift builds, released at the landing.
    if (ctx) {
      const after0 = t - HIT_T;
      const pull = 0.6 * sstep(CRACK_T, 1.6, t) * (1 - smoothstep(after0 / 0.3));
      for (const v of this.victims) {
        this.v3.set(this.point.x - v.feet.x, 0, this.point.z - v.feet.z);
        const dist = this.v3.length();
        if (dist > 1e-3) this.v3.multiplyScalar(Math.min(pull, dist) / dist);
        ctx.displace(v.enemy, this.v3);
      }
    }

    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.crackle.invert(false);
      this.shards.burst(this.v1.set(this.point.x, 0.4, this.point.z), 12, 9, 0.55);
      this.shake = 0.75;
      if (ctx) {
        for (const e of ctx.targets) {
          if (!this.inside(e)) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 0, pull: 4, from: this.point, color: VOID_CSS.body, status: { kind: 'silence', seconds: 1.5 } });
        }
      }
    }
    if (f.hit && !f.heal && t >= HEAL_T) {
      f.heal = true;
      this.crackle.fade(1.6);
    }

    this.layout();
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  private layout() {
    const t = this.time;
    const after = t - HIT_T;

    // Screen: black, lifting away after the heal; impact frames at the hit.
    let dk = 0.55 * smoothstep(t / 0.4) * (1 - smoothstep((t - 3.4) / 1.0));
    if (after >= 0) dk *= 1 - 0.25 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // The cracked disc inverts for two frames just before the hit.
    if (!this.flags.hit) this.crackle.invert(t >= INVERT_T && t < INVERT_END);

    // The landing: cyan star at the centre, ground refraction, shake.
    if (this.flags.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.set(this.point.x, 1.2, this.point.z), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 7 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.75 * Math.exp(-after * 9);
    }
  }
}

export const unmakingModule: EffectModule = {
  label: 'unmaking',
  category: 'hero: void',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Unmaking(),
  telegraphs(effect) {
    const e = effect as Unmaking;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Unmaking;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as Unmaking).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
