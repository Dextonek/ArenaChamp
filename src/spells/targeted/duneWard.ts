import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { SAND_CSS, Dust, GlyphRing, SandRibbon, SandWave } from '../../effects/parts/sand';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Dune Ward (sand kit, E: self aura): three sand ribbons rise from the floor and wind around Sefu in a slow spiral
 * above a small glyph ring; the sand shields him (45, 4 s). Twice (1.0 s, 2.0 s) the ribbons flare and a flat ring of
 * flung sand sweeps out to radius 5, hitting and slowing every enemy inside. Then the ribbons set into sandstone and
 * crumble. See pipeline/designs/kit-sand.md.
 */
export interface DuneWardSettings {
  damage: number;
  /** Shield he gains at the cast (held SHIELD_SECONDS). */
  shield: number;
  /** Slow seconds on each ring hit (engine cap 2.5). */
  slow: number;
  loop: boolean;
}

export const defaultDuneWard = (): DuneWardSettings => ({ damage: 13, shield: 45, slow: 1.0, loop: false });

// Timeline (seconds).
const RISE_T = 0.35;
const PULSES = [1.0, 2.0];
const PULSE_LEN = 0.55;
const SHIELD_SECONDS = 4;
const SET_T = 2.6; // the ribbons set into stone
const CRUMBLE_T = 2.8;
const DURATION = 3.2;

const RADIUS = 5;
const RIBBONS = 3;
const RING_R = 1.5;

export class DuneWard implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DuneWardSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);

  // Event flags.
  private flags = { pulse: [false, false], edge: [false, false], crumbled: false };
  private flare = 0;
  private spin = 0;

  // Parts.
  private ribbons: SandRibbon[] = [];
  private ring = new GlyphRing();
  private waves = [new SandWave(), new SandWave()];
  private dust = new Dust(12, 50);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: DuneWardSettings = defaultDuneWard()) {
    this.settings = settings;
    this.dust.life = 0.55;
    for (let i = 0; i < RIBBONS; i++) {
      const r = new SandRibbon(30, 8, 12);
      r.shed = 16;
      this.ribbons.push(r);
    }
    this.group.add(
      this.ring.mesh, ...this.waves.map((w) => w.mesh), ...this.ribbons.map((r) => r.mesh), this.dust.mesh, this.groundShock.mesh,
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
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.v1.copy(this.from).setY(1.2));
    this.ring.set(this.from, RING_R, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private shielded = false;

  private reset() {
    this.shielded = false;
    this.time = 0;
    this.shake = 0;
    this.flare = 0;
    this.spin = 0;
    this.flags.pulse.fill(false);
    this.flags.edge.fill(false);
    this.flags.crumbled = false;
    clearScreenFx(this.screen);
    this.ring.reset();
    for (const r of this.ribbons) r.reset();
    for (const w of this.waves) w.reset();
    this.dust.reset();
    this.groundShock.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const r of this.ribbons) r.update(dt);
    this.dust.update(dt);
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
    const f = this.flags;

    if (!this.shielded) {
      this.shielded = true;
      ctx?.shieldSelf?.(this.settings.shield, SHIELD_SECONDS, SAND_CSS.body);
    }
    // Events: the two sand pulses hit everything inside the radius; dust blows up at the ring edge a beat later.
    for (let i = 0; i < PULSES.length; i++) {
      if (!f.pulse[i] && t >= PULSES[i]) {
        f.pulse[i] = true;
        this.shake = 0.2;
        if (ctx) {
          for (const e of ctx.targets) {
            const p = e.group.position; // live position: whoever stepped out is spared
            if (Math.hypot(p.x - this.from.x, p.z - this.from.z) <= RADIUS) {
              ctx.hit(e, {
                damage: this.settings.damage, knock: 2, from: ctx.from, color: SAND_CSS.body, status: { kind: 'slow', seconds: this.settings.slow },
              });
            }
          }
        }
      }
      if (!f.edge[i] && t >= PULSES[i] + 0.3) {
        f.edge[i] = true;
        for (let k = 0; k < 4; k++) {
          const a = (k + Math.random()) / 4 * Math.PI * 2;
          this.dust.puff(this.v1.set(this.from.x + Math.cos(a) * 4.3, 0.3, this.from.z + Math.sin(a) * 4.3), 0.55 + Math.random() * 0.2);
        }
      }
    }
    if (!f.crumbled && t >= CRUMBLE_T) {
      f.crumbled = true;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.5;
        this.dust.puff(this.v1.set(this.from.x + Math.cos(a) * 1.5, 0.6 + (k % 2) * 0.7, this.from.z + Math.sin(a) * 1.5), 0.6);
      }
      this.dust.fall(this.from, 1.8, 12, 2.6, 0.5);
    }

    this.layout(dt);
  }

  /** Ribbon i: a slow helix from the floor to head height at radius 1.2..1.8, bulging outward on a flare. */
  private helix(i: number, u: number, out: THREE.Vector3) {
    const a = (i / RIBBONS) * Math.PI * 2 + this.spin + u * Math.PI * 2 * 1.15;
    const r = 1.2 + 0.45 * Math.sin(Math.PI * u) + 0.1 * i + 0.9 * this.flare * Math.sin(Math.PI * u);
    return out.set(this.from.x + Math.cos(a) * r, 0.15 + 2.0 * u + 0.12 * Math.sin(u * 9 + i), this.from.z + Math.sin(a) * r);
  }

  private layout(dt: number) {
    const t = this.time;
    this.spin += dt * (t < CRUMBLE_T ? 1.9 : 0.6);

    // --- Pulses: the ribbons flare out, a ring of flung sand sweeps to the radius. ---
    let flare = 0;
    let shock = 0;
    let shockR = 1;
    for (let i = 0; i < PULSES.length; i++) {
      const k = (t - PULSES[i]) / PULSE_LEN;
      const wave = this.waves[i];
      if (k < 0 || k >= 1) { wave.set(this.from, 0, 0); } else {
        const e = 1 - Math.pow(1 - k, 3);
        const r = 0.9 + (RADIUS - 0.9) * e;
        wave.set(this.from, r, 1 - k * k * 0.6, 0.4);
        shock = Math.max(shock, 0.02 * (1 - k) * (1 - k));
        shockR = r;
      }
      const a = t - PULSES[i];
      if (a >= 0) flare = Math.max(flare, Math.exp(-a * 8));
    }
    this.flare = flare;
    this.groundShock.set(this.from, shockR, shock);

    // --- The glyph ring under him: carves on, glints turquoise for 3 frames at each pulse, fades before the end. ---
    this.ring.reveal = smoothstep(t / RISE_T);
    this.ring.opacity = 1 - smoothstep((t - SET_T) / 0.4);
    this.ring.lit = PULSES.some((p) => t >= p && t < p + 0.05) ? 1 : 0;

    // --- 0..0.35 the ribbons rise; 2.6 they set into stone; 2.8..3.05 they crumble away from the tail. ---
    const head = 1 - Math.pow(1 - THREE.MathUtils.clamp(t / RISE_T, 0, 1), 3);
    const tail = smoothstep((t - CRUMBLE_T) / 0.25);
    for (let i = 0; i < RIBBONS; i++) {
      const rb = this.ribbons[i];
      rb.stone = smoothstep((t - SET_T) / 0.2);
      rb.shed = t < SET_T ? 16 : 0;
      rb.setFunction((u, out) => this.helix(i, u, out), 0.34, head, Math.min(tail, head - 0.01), t + i * 0.7);
    }
  }
}

export const duneWardModule: EffectModule = {
  label: 'dune ward',
  category: 'hero: sand',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new DuneWard(),
  telegraphs(effect) {
    const e = effect as DuneWard;
    const c = e.ctx?.from;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: PULSES[0] }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as DuneWard;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as DuneWard).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
    f.add(s, 'shield', 0, 120, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
