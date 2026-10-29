import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { HeatHaze, ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { FORGE, FORGE_CSS, ChainRing, IronChunks, PulseRing, QuenchSteam, Sparks } from '../../effects/parts/forge';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Bellows Ward (forge kit, E: self aura): the forge in Brannoc's chest flares and a ring of heat haze rises around
 * him. Two loops of heavy molten chain whirl round his waist in opposite directions, throwing sparks, glowing and
 * slowly crusting. Twice (0.9 s, 1.9 s) the chains flare and a ring of heat (ash line, orange band) pushes out to
 * radius 5, hitting every enemy inside. At the end the chains cool black, drop with a clank and shatter into iron
 * chunks. See pipeline/designs/kit-forge.md.
 */
export interface BellowsWardSettings {
  damage: number;
  loop: boolean;
}

export const defaultBellowsWard = (): BellowsWardSettings => ({ damage: 15, loop: false });

// Timeline (seconds).
const CHAINS_T = 0.3; // the chains whirl up
const PULSES = [0.9, 1.9];
const PULSE_LEN = 0.5;
const COOL_T = 2.8; // chains cool and drop
const CLANK_T = 3.0; // they hit the floor and shatter
const DURATION = 3.3;

const RADIUS = 5;
const R1 = 1.6;
const R2 = 2.2;
const LINKS = 16;

export class BellowsWard implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BellowsWardSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private chest = new THREE.Vector3(0, 1.4, 14);

  // Event flags.
  private flags = { pulse0: false, pulse1: false, clank: false, steam: false };
  private sparkTimer = 0;

  // Parts.
  private ring1 = new ChainRing(LINKS);
  private ring2 = new ChainRing(LINKS);
  private sparks = new Sparks(100);
  private chunks = new IronChunks(40);
  private steam = new QuenchSteam(6);
  private pulses = [new PulseRing(), new PulseRing()];
  private flare = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: FORGE.hot, core: FORGE.core, additive: false });
  private haze = new HeatHaze({ width: 5, height: 4, scale: 4 });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BellowsWardSettings = defaultBellowsWard()) {
    this.settings = settings;
    this.steam.life = 0.4;
    this.group.add(
      this.ring1.mesh, this.ring2.mesh, ...this.pulses.map((p) => p.mesh), this.chunks.mesh, this.sparks.mesh,
      this.steam.mesh, this.flare.mesh, this.haze.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PULSES[0];
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.3).setY(1.4);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.chest);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.sparkTimer = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.sparks.reset();
    this.chunks.reset();
    this.steam.reset();
    for (const p of this.pulses) p.reset();
    this.ring1.mesh.visible = false;
    this.ring2.mesh.visible = false;
    this.flare.set(this.chest, 0, 0);
    this.haze.set(this.from, 0, 0);
    this.groundShock.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.sparks.update(dt);
    this.chunks.update(dt);
    this.steam.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;

    // Events: the two heat pulses hit everything inside the radius.
    for (let i = 0; i < PULSES.length; i++) {
      const key = i === 0 ? 'pulse0' : 'pulse1';
      if (!this.flags[key] && t >= PULSES[i]) {
        this.flags[key] = true;
        this.sparks.burst(this.chest, this.v1.set(0, 1, 0), 10, 6, 1.1);
        this.shake = 0.2;
        if (ctx) {
          ctx.targets.forEach((e, k) => {
            const p = ctx.targetPos[k];
            if (p && Math.hypot(p.x - this.from.x, p.z - this.from.z) <= RADIUS) {
              ctx.hit(e, { damage: this.settings.damage, knock: 3, from: ctx.from, color: FORGE_CSS.body });
            }
          });
        }
      }
    }
    if (!this.flags.clank && t >= CLANK_T) {
      this.flags.clank = true;
      for (const R of [R1, R2]) {
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * Math.PI * 2;
          this.chunks.burst(this.v1.set(this.from.x + Math.cos(a) * R, 0.3, this.from.z + Math.sin(a) * R), 1, 3.5, 0.32, 0.25, 0.3, 0.2);
        }
      }
      this.shake = 0.25;
    }
    if (!this.flags.steam && t >= CLANK_T - 0.2) {
      this.flags.steam = true;
      this.steam.puff(this.v1.set(this.from.x + R1, 0.3, this.from.z), 0.5, true);
      this.steam.puff(this.v1.set(this.from.x - R2 * 0.7, 0.3, this.from.z + R2 * 0.7), 0.45);
    }

    // Sparks flung off the whirling chains.
    if (t >= CHAINS_T && t < COOL_T) {
      this.sparkTimer += dt;
      while (this.sparkTimer >= 0.07) {
        this.sparkTimer -= 0.07;
        const second = Math.random() < 0.5;
        const R = second ? R2 : R1;
        const sgn = second ? -1 : 1;
        const a = this.spin(second) + Math.random() * Math.PI * 2;
        this.v1.set(this.from.x + Math.cos(a) * R, this.chainY(second), this.from.z + Math.sin(a) * R);
        this.v2.set(Math.cos(a) * 0.7 - Math.sin(a) * sgn * 0.7, 0.35, Math.sin(a) * 0.7 + Math.cos(a) * sgn * 0.7);
        this.sparks.burst(this.v1, this.v2, 2, 5, 0.4);
      }
    }

    this.layout();
  }

  private spin(second: boolean) {
    const t = Math.min(this.time, COOL_T + 0.2) - CHAINS_T;
    return second ? -2.1 * t : 2.8 * t;
  }

  private chainY(second: boolean) {
    return second ? 1.2 : 1.0;
  }

  private layout() {
    const t = this.time;

    // --- 0..0.3 The chest forge flares; a ring of haze rises around him and holds to the end of the whirl. ---
    const hz = smoothstep(t / 0.3) * (1 - smoothstep((t - COOL_T) / 0.4));
    this.haze.set(this.from, 0.015 * hz, t);
    const fl0 = t < 0.3 ? Math.sin(Math.PI * (t / 0.3)) : 0;
    let flare = fl0;

    // --- Pulses: the chains flare, a ring of heat pushes out to the radius. ---
    let pulseHeat = 0;
    let shock = 0;
    let shockR = 1;
    for (let i = 0; i < PULSES.length; i++) {
      const k = (t - PULSES[i]) / PULSE_LEN;
      const ring = this.pulses[i];
      if (k < 0 || k >= 1) { ring.set(this.from, 0, 0); } else {
        ring.set(this.from, 0.8 + (RADIUS - 0.8) * (1 - Math.pow(1 - k, 3)), 1 - k * k, 0.32);
        shock = Math.max(shock, 0.02 * (1 - k) * (1 - k));
        shockR = 0.8 + (RADIUS - 0.8) * (1 - Math.pow(1 - k, 3));
      }
      const a = t - PULSES[i];
      if (a >= 0) { pulseHeat = Math.max(pulseHeat, Math.exp(-a * 7)); flare = Math.max(flare, Math.exp(-a * 14)); }
    }
    this.groundShock.set(this.from, shockR, shock);
    this.flare.set(this.chest, 0.7 * flare, flare > 0.05 ? 1 : 0, t * 2);

    // --- 0.3..2.8 The chains: two loops, opposite directions, glowing then crusting. ---
    const on = t >= CHAINS_T && t < CLANK_T;
    this.ring1.mesh.visible = on;
    this.ring2.mesh.visible = on;
    if (on) {
      const grow = smoothstep((t - CHAINS_T) / 0.25);
      const drop = smoothstep((t - COOL_T - 0.05) / (CLANK_T - COOL_T - 0.05));
      const base = 0.5 - 0.25 * smoothstep((t - CHAINS_T) / (COOL_T - CHAINS_T));
      const cooled = base * (1 - smoothstep((t - COOL_T) / 0.2));
      const heat = Math.max(cooled, pulseHeat * (t < COOL_T ? 1 : 0));
      for (const second of [false, true]) {
        const ring = second ? this.ring2 : this.ring1;
        const R = (second ? R2 : R1) * (0.35 + 0.65 * grow);
        const y = 0.15 + (this.chainY(second) - 0.15) * (1 - drop * drop);
        ring.place(this.from, R, y, this.spin(second), heat, second ? 0.1 : 0.08);
      }
    }
  }
}

export const bellowsWardModule: EffectModule = {
  label: 'bellows ward',
  category: 'hero: forge',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new BellowsWard(),
  telegraphs(effect) {
    const e = effect as BellowsWard;
    const c = e.ctx?.from;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: PULSES[0] }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BellowsWard;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as BellowsWard).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
