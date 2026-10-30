import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { Droplets, SplashCrown, TIDE, TIDE_CSS, WaterPool, WaterRibbon } from '../../effects/parts/tide';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Undertow Dance (tide kit, E: trail dash). Two water ribbons rise and circle her like sashes, waist to shoulder, while
 * she spins, and at 0.1 s she surfs to the aim point (`ctx.moveCaster`, ground mode, range 6) in 0.3 s. Foam pools spread
 * along her path and stay for 3 s as a strip that hurts and slows (1 s) whoever stands in or crosses it, tick after tick.
 * When she lands the sashes flare into a flat spinning ring that splashes the floor and heals her; then they draw back
 * in and fall away as droplets and the strip drains. See pipeline/designs/kit-tide.md.
 */
export interface UndertowDanceSettings {
  /** Damage of each tick of the strip. */
  damage: number;
  /** Slow seconds on each tick (engine cap 2.5). */
  slow: number;
  /** She heals this much when she lands. */
  heal: number;
  loop: boolean;
}

export const defaultUndertowDance = (): UndertowDanceSettings => ({ damage: 4, slow: 1.0, heal: 15, loop: false });

export const UNDERTOW_RANGE = 6;

// Timeline (seconds).
const RISE_END = 0.3; // the sashes are up
const DASH_T = 0.1; // she goes
const DASH_LEN = 0.3;
const LAND_T = DASH_T + DASH_LEN; // she lands: the flare and the heal
const TICKS = [0.7, 1.2, 1.7, 2.2, 2.7, 3.2]; // the strip hurts and slows at these moments
const STRIP_END = 3.4;
const DRAIN_T = 3.0;
const FALL_T = 1.7; // the sashes fall as droplets
const GONE_T = 2.1;
const DURATION = 3.7;
const HALF_W = 1.1; // half the strip width
const FLARE_R = 4; // the landing flare, visual only
const ORBIT_R = 1.4;
const POOLS = 3;

export class UndertowDance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: UndertowDanceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the dash starts, the spot it was aimed at (clamped to range) and where the engine really lands her. */
  readonly start = new THREE.Vector3();
  readonly want = new THREE.Vector3();
  readonly land = new THREE.Vector3();
  private time = 0;
  private flags = { dash: false, land: false, tick: [false, false, false, false, false, false], drained: false };
  private poolsDone = [false, false, false];
  private poolCount = 1;
  private poolR = 1.2;
  private spinA = 0;

  // Parts.
  private pools = Array.from({ length: POOLS }, () => new WaterPool());
  private ribbons = [new WaterRibbon(36, 10, 16), new WaterRibbon(36, 10, 16)];
  private drops = new Droplets(30);
  private crown = new SplashCrown();
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch, and the per-frame values the ribbon paths read.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private centre = new THREE.Vector3();
  private pm = { phase: 0, spin: 0, flare: 0 };

  constructor(settings: UndertowDanceSettings = defaultUndertowDance()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.hot);
    this.screen.tint.set(TIDE.dark);
    for (const r of this.ribbons) {
      r.shed = 8;
      r.drops.splash = false;
    }
    this.group.add(...this.pools.map((p) => p.mesh), ...this.ribbons.map((r) => r.mesh), this.crown.mesh, this.drops.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LAND_T;
  }

  /** The strip stays drawn until here. */
  get stripEnd() {
    return STRIP_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.start.copy(ctx.from).setY(0);
    // Aim point limited to the spell range; the engine may clamp it again to the ring when the dash starts.
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    if (this.v1.length() < 1) this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.v1.length() > UNDERTOW_RANGE) this.v1.setLength(UNDERTOW_RANGE);
    this.want.copy(this.start).add(this.v1);
    this.land.copy(this.want);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.want).setY(1.2);
    this.groundShock.set(this.want, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.spinA = 0;
    this.flags.dash = this.flags.land = this.flags.drained = false;
    this.flags.tick.fill(false);
    this.poolsDone.fill(false);
    clearScreenFx(this.screen);
    this.screen.tint.set(TIDE.dark);
    for (const p of this.pools) p.reset();
    for (const r of this.ribbons) r.reset();
    this.drops.reset();
    this.crown.reset();
    this.groundShock.set(this.want, 0, 0);
  }

  /** True when ground point p lies on the strip (within HALF_W of the path from start to land). */
  private onStrip(p: THREE.Vector3) {
    const sx = this.start.x, sz = this.start.z;
    const dx = this.land.x - sx, dz = this.land.z - sz;
    const l2 = dx * dx + dz * dz;
    const k = l2 < 1e-4 ? 0 : THREE.MathUtils.clamp(((p.x - sx) * dx + (p.z - sz) * dz) / l2, 0, 1);
    return Math.hypot(p.x - (sx + dx * k), p.z - (sz + dz * k)) <= HALF_W;
  }

  /** A sash: an arc round her rising waist to shoulder, opening into a flat ring when `flare` is up. */
  private path = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const m = this.pm;
    const span = Math.PI * (1.05 - 0.1 * m.flare); // two sashes nearly close the circle
    const a = m.phase + m.spin + u * span;
    const r = ORBIT_R * (1 + 0.1 * Math.sin(u * 4 + m.spin)) + (FLARE_R - 0.5 - ORBIT_R) * m.flare;
    const yOrbit = 0.95 + 0.6 * u + 0.1 * Math.sin(u * 7 + m.spin * 1.5);
    const y = yOrbit + (0.3 + 0.05 * u - yOrbit) * m.flare;
    return out.set(this.centre.x + Math.cos(a) * r, y, this.centre.z + Math.sin(a) * r);
  };

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const r of this.ribbons) r.update(dt);
    this.drops.update(dt);
    this.crown.update(dt);
    for (const p of this.pools) p.update(dt);
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
    const ctx = this.ctx;

    // 0.1: she surfs to the aim; the strip's length and pools follow the real landing spot.
    if (!f.dash && t >= DASH_T) {
      f.dash = true;
      this.land.copy(ctx?.moveCaster ? ctx.moveCaster(this.want, DASH_LEN) : this.want).setY(0);
      const len = this.v1.subVectors(this.land, this.start).length();
      this.poolCount = THREE.MathUtils.clamp(Math.ceil(len / 2), 1, POOLS);
      this.poolR = THREE.MathUtils.clamp((len / this.poolCount) * 0.6, 1.1, 1.6);
      this.drops.spray(this.v2.copy(this.start).setY(0.6), this.v1.set(0, 1, 0), 8, 4.5);
    }
    // The foam pools open one after another along her path as she passes.
    if (f.dash) {
      for (let i = 0; i < this.poolCount; i++) {
        if (this.poolsDone[i] || t < DASH_T + ((i + 0.5) / this.poolCount) * DASH_LEN) continue;
        this.poolsDone[i] = true;
        this.v1.lerpVectors(this.start, this.land, (i + 0.5) / this.poolCount).setY(0);
        this.pools[i].spread(this.v1, this.poolR, 0.35);
      }
    }
    // 0.4: she lands: the flare, the heal.
    if (!f.land && t >= LAND_T) {
      f.land = true;
      this.shake = 0.15;
      this.crown.burst(this.v1.copy(this.land).setY(0), 1.4);
      this.drops.spray(this.v2.copy(this.land).setY(0.8), this.v1.set(0, 1, 0), 8, 4.5);
      this.groundShock.set(this.land, 0.1, 0);
      ctx?.healSelf?.(this.settings.heal);
    }
    // The strip hurts and slows whoever is on it right now (live positions).
    for (let i = 0; i < TICKS.length; i++) {
      if (f.tick[i] || t < TICKS[i]) continue;
      f.tick[i] = true;
      if (!ctx) continue;
      for (const e of ctx.targets) {
        if (!this.onStrip(e.group.position)) continue;
        this.drops.spray(this.v2.set(e.group.position.x, 0.4, e.group.position.z), this.v1.set(0, 1, 0), 3, 3);
        ctx.hit(e, { damage: this.settings.damage, knock: 0, from: this.start, color: TIDE_CSS.body, status: { kind: 'slow', seconds: this.settings.slow } });
      }
    }
    if (!f.drained && t >= DRAIN_T) {
      f.drained = true;
      for (const p of this.pools) p.drain(0.5);
    }

    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const cp = this.ctx?.caster.group.position;
    // The sashes ride with her, so they follow the dash.
    if (cp) this.centre.set(cp.x, 0, cp.z); else this.centre.copy(this.start);

    this.screen.darken = 0.18 * smoothstep(t / 0.35) * (1 - smoothstep((t - FALL_T) / 0.5));

    // The flare at the landing: out in ~0.2 s, held a breath, back in over ~0.3 s. The ring spins up with it.
    let flare = 0, gr = 0, gs = 0, sh = 0;
    const s = t - LAND_T;
    if (s >= 0 && s <= 0.75) {
      const out = 1 - Math.pow(1 - Math.min(s / 0.22, 1), 3);
      const back = s < 0.3 ? 0 : smoothstep((s - 0.3) / 0.4);
      flare = out * (1 - back);
      if (s < 0.4) {
        const k = s / 0.4;
        gr = FLARE_R * (1 - Math.pow(1 - k, 3));
        gs = 0.02 * (1 - k) * (1 - k);
      }
      sh = 0.15 * Math.exp(-s * 10);
    }
    this.spinA += dt * (5.5 + 7 * flare);
    if (this.flags.land) this.groundShock.set(this.land, Math.max(gr, 0.1), gs);
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
  // A trail dash: she surfs to the aim point (ground mode, like the sky kit's dash).
  targeting: { mode: 'ground', radius: HALF_W },
  create: () => new UndertowDance(),
  telegraphs(effect) {
    const e = effect as UndertowDance;
    if (!e.ctx) return [];
    // The strip she leaves: armed when she lands, drawn until it drains.
    return [{
      shape: { kind: 'line', x1: e.start.x, z1: e.start.z, x2: e.want.x, z2: e.want.z, width: HALF_W * 2 },
      start: 0, impact: LAND_T, until: e.stripEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as UndertowDance;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as UndertowDance).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 30, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
    f.add(s, 'heal', 0, 100, 1);
  },
};
