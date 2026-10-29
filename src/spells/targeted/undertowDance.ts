import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { Droplets, SplashCrown, TIDE, TIDE_CSS, WaterPool, WaterRibbon } from '../../effects/parts/tide';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Undertow Dance (tide kit, E: self aura). Two water ribbons rise and circle her like sashes, waist to shoulder, while
 * she spins. Twice they flare out into a flat spinning ring of water, foam on the leading edge, that sweeps to the
 * radius and splashes every enemy inside; then they draw back in and fall away as droplets. See
 * pipeline/designs/kit-tide.md.
 */
export interface UndertowDanceSettings {
  damage: number;
  loop: boolean;
}

export const defaultUndertowDance = (): UndertowDanceSettings => ({ damage: 13, loop: false });

// Timeline (seconds).
const RISE_END = 0.3; // the sashes are up
const PULSE_1 = 1.0;
const PULSE_2 = 2.0;
const FALL_T = 2.6; // the sashes fall as droplets
const GONE_T = 3.0;
const DURATION = 3.2;
const RADIUS = 5;
const ORBIT_R = 1.4;
const MAX_VIS = 3; // enemies that get their own crown

export class UndertowDance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: UndertowDanceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private from = new THREE.Vector3(0, 0, 14);

  private flags = { pool: false, pulse1: false, pulse2: false, drained: false };
  private pulseAt = [-9, -9];
  private spinA = 0;

  // Parts.
  private pool = new WaterPool();
  private ribbons = [new WaterRibbon(36, 10, 16), new WaterRibbon(36, 10, 16)];
  private drops = new Droplets(30);
  private crown = new SplashCrown();
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch, and the per-frame values the ribbon paths read.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private pm = { phase: 0, spin: 0, flare: 0 };

  constructor(settings: UndertowDanceSettings = defaultUndertowDance()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.hot);
    this.screen.tint.set(TIDE.dark);
    for (const r of this.ribbons) {
      r.shed = 8;
      r.drops.splash = false;
    }
    this.group.add(this.pool.mesh, ...this.ribbons.map((r) => r.mesh), this.crown.mesh, this.drops.mesh, this.groundShock.mesh);
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
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.spinA = 0;
    this.pulseAt[0] = this.pulseAt[1] = -9;
    this.flags.pool = this.flags.pulse1 = this.flags.pulse2 = this.flags.drained = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(TIDE.dark);
    this.pool.reset();
    for (const r of this.ribbons) r.reset();
    this.drops.reset();
    this.crown.reset();
    this.groundShock.set(this.from, 0, 0);
  }

  /** A sash: an arc round her rising waist to shoulder, opening into a flat ring when `flare` is up. */
  private path = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const m = this.pm;
    const span = Math.PI * (1.05 - 0.1 * m.flare); // two sashes nearly close the circle
    const a = m.phase + m.spin + u * span;
    const r = ORBIT_R * (1 + 0.1 * Math.sin(u * 4 + m.spin)) + (RADIUS - 0.5 - ORBIT_R) * m.flare;
    const yOrbit = 0.95 + 0.6 * u + 0.1 * Math.sin(u * 7 + m.spin * 1.5);
    const y = yOrbit + (0.3 + 0.05 * u - yOrbit) * m.flare;
    return out.set(this.from.x + Math.cos(a) * r, y, this.from.z + Math.sin(a) * r);
  };

  private pulse(index: number) {
    const ctx = this.ctx;
    this.pulseAt[index] = index === 0 ? PULSE_1 : PULSE_2;
    this.shake = 0.15;
    if (!ctx) return;
    let shown = 0;
    for (let i = 0; i < ctx.targets.length; i++) {
      const p = ctx.targetPos[i];
      if (!p || Math.hypot(p.x - this.from.x, p.z - this.from.z) > RADIUS) continue;
      if (shown < MAX_VIS) {
        shown++;
        this.crown.burst(this.v1.set(p.x, 0, p.z), 0.7);
        this.drops.spray(this.v2.set(p.x, 0.8, p.z), this.v1.set(0, 1, 0), 5, 4.5);
      }
      ctx.hit(ctx.targets[i], { damage: this.settings.damage, knock: 2, from: ctx.from, color: TIDE_CSS.body });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const r of this.ribbons) r.update(dt);
    this.drops.update(dt);
    this.crown.update(dt);
    this.pool.update(dt);
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

    if (!f.pool && t >= 0.02) {
      f.pool = true;
      this.pool.spread(this.from, 2.0, 0.3);
    }
    if (!f.pulse1 && t >= PULSE_1) { f.pulse1 = true; this.pulse(0); }
    if (!f.pulse2 && t >= PULSE_2) { f.pulse2 = true; this.pulse(1); }
    if (!f.drained && t >= FALL_T) {
      f.drained = true;
      this.pool.drain(0.5);
    }

    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;

    this.screen.darken = 0.18 * smoothstep(t / 0.35) * (1 - smoothstep((t - FALL_T) / 0.5));

    // The flare: out in ~0.2 s, held a breath, back in over ~0.3 s. The ring spins up with it.
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
        gs = 0.02 * (1 - k) * (1 - k);
      }
      sh = Math.max(sh, 0.15 * Math.exp(-s * 10));
    }
    this.spinA += dt * (5.5 + 7 * flare);
    this.groundShock.set(this.from, Math.max(gr, 0.1), gs);
    this.shake = sh;

    // The sashes: rise over 0.3 s, circle, then fall from the tail as droplets.
    const pm = this.pm;
    pm.spin = this.spinA;
    pm.flare = flare;
    const rise = smoothstep(t / RISE_END);
    const fall = THREE.MathUtils.clamp((t - FALL_T) / (GONE_T - FALL_T), 0, 1);
    const head = Math.max(rise, 0.02);
    const tail = 0.95 * fall * fall;
    const width = (0.42 + 0.36 * flare) * (1 - 0.4 * fall);
    for (let i = 0; i < 2; i++) {
      pm.phase = i * Math.PI;
      const r = this.ribbons[i];
      r.shed = t >= FALL_T ? 34 : 8 + 14 * flare;
      if (t < GONE_T) r.setFunction(this.path, width, head, tail, t);
      else r.hide();
    }
  }
}

export const undertowDanceModule: EffectModule = {
  label: 'undertow dance',
  category: 'hero: tide',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new UndertowDance(),
  telegraphs(effect) {
    const e = effect as UndertowDance;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: PULSE_1 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as UndertowDance;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as UndertowDance).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
