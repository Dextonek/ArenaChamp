import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { DustPuffs, FloorCracks, FlatRing, GeraldFigure, MASON, MASON_CSS, StoneChunks } from '../../effects/parts/mason';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { geraldHere, geraldLive, geraldOf, moodNow, raiseGeraldAt } from '../../traits/mason';

/**
 * Raise Gerald (mason kit, Q: a fixed circle that bursts). A circle 1.5 m across marks a spot (9 m): dark cracks spread over
 * the floor, a pale ring tightens, dust and small stones hop out of the cracks and the ground trembles. At 0.7 s Gerald, a
 * 3.5 m limestone pillar with a face, bursts up out of the floor there: whoever is inside the circle then (judged on live
 * positions, `ctx.enemies`) takes `damage` (50) and a 0.5 s knock-up. He arrives alarmed (a drop of sweat), then settles
 * into boredom. Any older Gerald crumbles into a heap of rubble, without a word.
 *
 * Gerald himself is the record in `src/traits/mason.ts` (`raiseGeraldAt`): a real obstacle, a hidden 220 HP unit, drawn by
 * the trait's marks, so a later cast cannot cut him off: nothing here owns him, and `reset()` leaves him alone. His place
 * comes from `ctx.sentFrom` and `ctx.point` only, so both screens of a network duel build the same Gerald (without
 * `ctx.summon` there he has no HP and cannot be broken). The VFX tool runs no trait, so there this effect draws him.
 * The telegraph is the circle, impact 0.7 s: it roots Bram until then. Clean by 2.0 s. See pipeline/designs/kit-mason.md.
 */
export interface RaiseGeraldSettings {
  damage: number;
  /** Knock-up seconds (engine cap 0.8). */
  knockUp: number;
  loop: boolean;
}

export const defaultRaiseGerald = (): RaiseGeraldSettings => ({ damage: 50, knockUp: 0.5, loop: false });

// Timeline (seconds).
const RISE_T = 0.7;
const DURATION = 2.0;

const RANGE = 9;
const MIN_DIST = 1.2;
const HIT_R = 1.5;

export class RaiseGeraldFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RaiseGeraldSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where Gerald comes up, from sentFrom and point only. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private time = 0;
  private risen = false;
  private tremorT = 0;
  private hitAt = -1;

  private cracks = new FloorCracks(11);
  private ring = new FlatRing(MASON.foil);
  private chunks = new StoneChunks(48);
  private dust = new DustPuffs(36);
  private figure = new GeraldFigure();
  private pop = new StarBurst({ points: 8, inner: 0.3, color: MASON.hot, core: MASON.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(settings: RaiseGeraldSettings = defaultRaiseGerald()) {
    this.settings = settings;
    this.group.add(
      this.cracks.mesh, this.ring.mesh, this.chunks.mesh, this.dust.mesh, this.figure.group, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return RISE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on Gerald: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = MIN_DIST; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, RANGE);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  /** Not Gerald: he outlives this effect, and the CPU's next cast restarts it while he stands. */
  private reset() {
    this.time = 0;
    this.shake = 0;
    this.risen = false;
    this.tremorT = 0;
    this.hitAt = -1;
    this.cracks.set(this.centre, 0, 0);
    this.ring.set(this.centre, 0, 0);
    this.chunks.reset();
    this.dust.reset();
    this.pop.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.chunks.update(dt);
    this.dust.update(dt);
    this.drawFallback();
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, C = this.centre;
    if (t >= DURATION && !this.chunks.busy && !this.dust.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The warning: the floor cracks, a ring tightens, the ground trembles and dust hops out. ---
    if (t < RISE_T) {
      const k = smoothstep(t / RISE_T);
      this.cracks.set(C, 0.5 + 1.0 * k, 0.35 + 0.55 * k);
      this.ring.set(C, HIT_R * (1.25 - 0.25 * k), 0.25 + 0.5 * k);
      this.shake = 0.05 + 0.1 * k;
      this.tremorT += dt;
      if (this.tremorT >= 0.11) {
        this.tremorT = 0;
        const a = Math.random() * Math.PI * 2, r = Math.random() * HIT_R * 0.9;
        this.v1.set(C.x + Math.cos(a) * r, 0.1, C.z + Math.sin(a) * r);
        this.dust.puff(this.v1, 0, 0.8, 0, 0.22, 0.6);
        if (k > 0.45 && Math.random() < 0.7) this.chunks.burst(this.v1, 1, 1.6, 3, 0.13);
      }
    } else {
      const age = t - RISE_T;
      this.cracks.set(C, 1.5 + 0.3 * smoothstep(age / 0.3), 0.9 * (1 - smoothstep((age - 0.4) / 1.0)));
      this.ring.set(C, HIT_R * (1 + 0.5 * smoothstep(age / 0.35)), 0.8 * (1 - smoothstep(age / 0.45)));
    }
    if (!this.risen && t >= RISE_T) {
      this.risen = true;
      this.hitAt = t;
      this.rise();
    }
    if (this.risen) {
      const age = t - this.hitAt;
      const sp = StarBurst.pop(age, 0.05, 0.18);
      this.pop.set(this.v1.set(C.x, 1.8, C.z), 2.6 * sp.scale, sp.opacity, age * 2);
      const g = THREE.MathUtils.clamp(age / 0.45, 0, 1);
      this.groundShock.set(C, 0.6 + 3.4 * g, 0.045 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * 0.9, 0.4 * Math.exp(-age * 9));
    }
  }

  /** Gerald comes up: the record (obstacle, unit), the hit, the burst of stone and dust. */
  private rise() {
    const ctx = this.ctx, C = this.centre;
    if (ctx) {
      raiseGeraldAt(ctx.caster, ctx, C.x, C.z);
      const s = this.settings;
      const opts: HitOptions = { damage: s.damage, knock: 0, from: C, color: MASON_CSS.body, status: { kind: 'knockup', seconds: s.knockUp } };
      // Live positions at the moment of the burst: whoever stepped out of the circle is spared.
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const p = e.group.position;
        if (Math.hypot(p.x - C.x, p.z - C.z) <= HIT_R) ctx.hit(e, opts);
      }
    }
    this.v1.set(C.x, 0.3, C.z);
    this.chunks.burst(this.v1, 22, 5, 7, 0.22);
    this.dust.ring(this.v1.setY(0), 12, 0.9, 3.2, 0.5, 0.9);
    this.dust.puff(this.v1.set(C.x, 2.2, C.z), 0, 1.2, 0, 0.6, 1.0);
    this.shake = 0.4;
  }

  /** The VFX tool runs no trait, so no mark draws him: this effect does. */
  private drawFallback() {
    const ctx = this.ctx;
    if (!ctx || geraldLive(ctx.caster)) { this.figure.hide(); return; }
    const g = geraldOf(ctx.caster);
    if (geraldHere(g)) this.figure.set(g.x, g.z, ctx.aim + Math.PI, moodNow(ctx.caster));
    else this.figure.hide();
  }
}

export const raiseGeraldModule: EffectModule = {
  label: 'raise gerald',
  category: 'hero: mason',
  // The aim point is where Gerald comes up; the radius only sizes the marker.
  targeting: { mode: 'ground', radius: HIT_R },
  create: () => new RaiseGeraldFx(),
  telegraphs(effect) {
    const e = effect as RaiseGeraldFx;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: HIT_R }, start: 0.04, impact: RISE_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as RaiseGeraldFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3.5);
  },
  buildGui(f, effect) {
    const s = (effect as RaiseGeraldFx).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'knockUp', 0, 0.8, 0.1);
  },
};
