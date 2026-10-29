import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SKY_CSS, SpeedLines, WindCrescent } from '../../effects/parts/sky';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Cyclone Guard (sky kit, E: self shield + pulses). A whirl of crescents and gust ribbons wraps him (radius 1.2 to 1.8)
 * and he takes a 50 point shield for 3 s. At 1.0 s and 2.0 s the whirl flares out to radius 4 as a ring of crescents
 * that hits every enemy inside; from 2.6 s it unwinds into leaves. Clean by 3.2 s. See pipeline/designs/kit-sky.md.
 */
export interface CycloneGuardSettings {
  damage: number;
  shield: number;
  loop: boolean;
}

export const defaultCycloneGuard = (): CycloneGuardSettings => ({ damage: 13, shield: 50, loop: false });

// Timeline (seconds).
const WRAP_END = 0.2; // the whirl is up
const PULSE_1 = 1.0;
const PULSE_2 = 2.0;
const UNWIND_T = 2.6;
const GONE_T = 3.0;
const DURATION = 3.2;
const RADIUS = 4;
const N_CRES = 7;

export class CycloneGuard implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CycloneGuardSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3(0, 0, 14);
  private spinA = 0;
  private pulseAt = [-9, -9];
  private flags = { pulse1: false, pulse2: false };
  private leafTimer = 0;

  // Parts.
  private crescents = new WindCrescent(0, N_CRES);
  private ribbons = [new GustRibbon(36), new GustRibbon(36)];
  private lines = new SpeedLines(20);
  private leaves = new Leaves(32);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch, and the per-frame values the ribbon paths read.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private pm = { phase: 0, spin: 0, flare: 0 };

  constructor(settings: CycloneGuardSettings = defaultCycloneGuard()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    this.group.add(this.crescents.mesh, ...this.ribbons.map((r) => r.mesh), this.lines.mesh, this.leaves.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PULSE_1;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).setY(1.3);
    this.groundShock.set(this.from, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
    // The shield comes up with the whirl.
    this.ctx?.shieldSelf?.(this.settings.shield, 3, SKY_CSS.body);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.spinA = 0;
    this.leafTimer = 0;
    this.pulseAt[0] = this.pulseAt[1] = -9;
    this.flags.pulse1 = this.flags.pulse2 = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(SKY.dark);
    this.crescents.reset();
    for (const r of this.ribbons) r.reset();
    this.lines.reset();
    this.leaves.reset();
    this.groundShock.set(this.from, 0, 0);
  }

  /** A gust ribbon: an arc round him rising from the waist to the shoulder, flat and wide when `flare` is up. */
  private path = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const m = this.pm;
    const a = m.phase + m.spin + u * Math.PI * 1.25;
    const r = (1.25 + 0.5 * u) * (1 + 0.08 * Math.sin(u * 5 + m.spin)) + (RADIUS - 0.5 - 1.5) * m.flare;
    const y = (0.45 + 1.1 * u) * (1 - m.flare) + (0.35 + 0.15 * u) * m.flare;
    return out.set(this.from.x + Math.cos(a) * r, y, this.from.z + Math.sin(a) * r);
  };

  private pulse(index: number) {
    const ctx = this.ctx;
    this.pulseAt[index] = index === 0 ? PULSE_1 : PULSE_2;
    this.shake = 0.15;
    this.lines.burst(this.v1.set(this.from.x, 1.0, this.from.z + 1.2), this.v2.set(0, 0, 1), 6, 1.5);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.random();
      this.v1.set(this.from.x + Math.cos(a) * 2.5, 0.8, this.from.z + Math.sin(a) * 2.5);
      this.leaves.blow(this.v1, this.v2.set(Math.cos(a), 0.2, Math.sin(a)), 2, 5);
    }
    if (!ctx) return;
    // Re-check at the pulse: only enemies still inside the radius are hit.
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.from.x, p.z - this.from.z) > RADIUS) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 2, from: ctx.from, color: SKY_CSS.body });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const r of this.ribbons) r.update(dt);
    this.lines.update(dt);
    this.leaves.update(dt);
    this.crescents.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    if (!f.pulse1 && t >= PULSE_1) { f.pulse1 = true; this.pulse(0); }
    if (!f.pulse2 && t >= PULSE_2) { f.pulse2 = true; this.pulse(1); }

    // 2.6..3.0: the whirl unwinds into leaves.
    if (t >= UNWIND_T && t < GONE_T) {
      this.leafTimer += dt;
      while (this.leafTimer >= 0.07) {
        this.leafTimer -= 0.07;
        const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 0.7;
        this.v1.set(this.from.x + Math.cos(a) * r, 0.7 + Math.random() * 0.9, this.from.z + Math.sin(a) * r);
        this.leaves.blow(this.v1, this.v2.set(-Math.sin(a), 0.5, Math.cos(a)), 1, 3.5);
      }
    }

    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;

    this.screen.darken = 0.14 * smoothstep(t / 0.35) * (1 - smoothstep((t - UNWIND_T) / 0.5));

    // The flare: out in ~0.2 s, held a breath, back in over ~0.3 s. The whirl spins up with it.
    let flare = 0, gr = 0, gs = 0, sh = 0;
    for (const at of this.pulseAt) {
      const s = t - at;
      if (s < 0 || s > 0.75) continue;
      const out = 1 - Math.pow(1 - Math.min(s / 0.22, 1), 3);
      const back = s < 0.3 ? 0 : smoothstep((s - 0.3) / 0.4);
      flare = Math.max(flare, out * (1 - back));
      if (s < 0.4) {
        const k = s / 0.4;
        gr = RADIUS * (1 - Math.pow(1 - k, 3));
        gs = 0.018 * (1 - k) * (1 - k);
      }
      sh = Math.max(sh, 0.15 * Math.exp(-s * 10));
    }
    this.spinA += dt * (4.5 + 7 * flare);
    this.groundShock.set(this.from, Math.max(gr, 0.1), gs);
    this.shake = sh;

    const rise = smoothstep(t / WRAP_END);
    const fall = THREE.MathUtils.clamp((t - UNWIND_T) / (GONE_T - UNWIND_T), 0, 1);

    // Gust ribbons: wrap round him in 0.2 s, circle, then the tail eats them.
    const pm = this.pm;
    pm.spin = this.spinA;
    pm.flare = flare;
    const head = Math.max(rise, 0.02);
    const tail = 0.95 * fall * fall;
    const width = (0.26 + 0.14 * flare) * (1 - 0.4 * fall);
    for (let i = 0; i < 2; i++) {
      pm.phase = i * Math.PI;
      if (t < GONE_T) this.ribbons[i].setFunction(this.path, width, head, tail, t, 1 - fall * fall);
      else this.ribbons[i].hide();
    }

    // Crescents: a whirl at radius 1.2..1.8 that opens into a ring of crescents at the radius on each flare.
    const op = rise * (1 - smoothstep((t - UNWIND_T) / (GONE_T - UNWIND_T)));
    if (op > 0.01) {
      for (let i = 0; i < N_CRES; i++) {
        // Uneven spacing, sizes and heights so the ring does not read as teeth.
        const k = i + 0.35 * Math.sin(i * 2.3);
        const a = this.spinA * (i % 2 ? 1 : 0.8) + (k / N_CRES) * Math.PI * 2;
        // Each crescent is an arc of a circle round him, so the flared ring is made of crescents at the radius.
        const orbit = (1.2 + 0.6 * ((i * 5) % 7) / 6) * (1 - flare) + (RADIUS - 0.4) * flare;
        const arc = (80 + 20 * (i % 3)) * (1 - flare) + (46 + 10 * (i % 3)) * flare;
        const y = 0.55 + 0.9 * (((i * 3) % 5) / 4) * (1 - flare) + 0.3 * flare;
        this.v1.set(this.from.x, y, this.from.z);
        this.crescents.put(this.v1, Math.atan2(Math.cos(a), Math.sin(a)), 0.2 * Math.sin(i * 1.7) + 0.2 * (1 - flare), orbit, arc, 1.1, op, 0.2 + 0.16 * flare, i === 0 && flare > 0.5 ? 1 : 0);
      }
    }
  }
}

export const cycloneGuardModule: EffectModule = {
  label: 'cyclone guard',
  category: 'hero: sky',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new CycloneGuard(),
  telegraphs(effect) {
    const e = effect as CycloneGuard;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: PULSE_1 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CycloneGuard;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as CycloneGuard).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
    f.add(s, 'shield', 0, 150, 5);
  },
};
