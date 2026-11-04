import * as THREE from 'three';
import { Emitter } from '../../emitter';
import type { Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Puffs, Ripple, SUMO, SUMO_CSS } from '../../effects/parts/sumo';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { sweepHit } from '../../obstacles';
import { CHARGE_DAMAGE, CHARGE_DIST, CHARGE_HOLD, CHARGE_TIME, CHARGE_WIDTH, CHARGE_WIND, bookOf } from '../../traits/sumo';

/**
 * Sumo Charge (sumo kit, E: a run that carries). He drops low (dust scrapes off the floor behind him at 0.1 s and 0.25 s, a red strip
 * lies on the floor from the cast: the telegraph, 6 m long and 2 m wide) and at 0.4 s runs 6 m down the aim in 0.4 s
 * (`ctx.moveCaster`). The first enemy the strip sweeps over (live positions, nearest first) is caught: 40, `knock: 0`, and carried
 * ahead of him, 1.2 m in front (`ctx.carry` every frame) until he stops. A trail of dust rolls behind him, a pale star pops at the
 * catch, a ripple and a hard shake mark the end of the run. Nobody in the strip: he simply runs. The catch opens a push window on his
 * record: a body carried out of his ring in it is a ring-out (`victimTick` in `src/traits/sumo.ts`, on the screen that decides
 * that hero). A wall or pillar on the path shortens the run. Clean by about 2.0 s.
 *
 * Network duels: the cast is replayed on the victim's screen with no `moveCaster` (the real run streams in as moves), so the path comes
 * from `sentFrom` and the aim point alone, eased like the engine's dash; each screen judges and carries only the hero it decides, by its
 * live position. See pipeline/designs/kit-sumo.md.
 */
export interface SumoChargeSettings {
  damage: number;
  loop: boolean;
}

export const defaultSumoCharge = (): SumoChargeSettings => ({ damage: CHARGE_DAMAGE, loop: false });

// Timeline (seconds).
const WIND_T = CHARGE_WIND;
const END_T = WIND_T + CHARGE_TIME;
const DURATION = 2.0;
const CATCH_R = CHARGE_WIDTH / 2;
const BODY = 0.5;
const STEP = 0.3; // largest carry step, so a body cannot tunnel through a wall in one frame

/** The engine's dash easing (`Arena.stepDash`): ease-out cubic. */
const ease = (k: number) => 1 - (1 - k) ** 3;

export class SumoCharge implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SumoChargeSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly start = new THREE.Vector3();
  readonly dir = new THREE.Vector3(0, 0, 1);
  private end = new THREE.Vector3();
  private time = 0;
  private prevK = 0;
  private flags = { s1: false, s2: false, go: false, done: false };
  private caught: Enemy | null = null;
  private popAt = -1;
  private popPos = new THREE.Vector3();
  private endAt = -1;
  private trailT = 0;

  private dust = new Puffs(50);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: SUMO.core, core: SUMO.hot, additive: false });
  private ripple = new Ripple(SUMO.hot, 0.1);
  private shock = new ShockRefraction({ facing: 'ground' });
  private strip: THREE.Mesh;
  private stripCore: THREE.Mesh;

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: SumoChargeSettings = defaultSumoCharge()) {
    this.settings = settings;
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    this.strip = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: SUMO.body, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.stripCore = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: SUMO.hot, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.strip.renderOrder = this.stripCore.renderOrder = 3;
    this.group.add(this.strip, this.stripCore, this.dust.mesh, this.pop.mesh, this.ripple.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return WIND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.start.set(s.x, 0, s.z);
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.end.copy(this.start).addScaledVector(this.dir, CHARGE_DIST);
    const obs = ctx.obstacles?.();
    if (obs && obs.length) {
      const c = sweepHit(this.start, this.end, BODY, obs);
      if (c && c.t > 0) this.end.copy(c.point).setY(0);
    }
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.prevK = 0;
    this.caught = null;
    this.popAt = this.endAt = -1;
    this.trailT = 0;
    const f = this.flags;
    f.s1 = f.s2 = f.go = f.done = false;
    this.dust.reset();
    this.pop.set(this.start, 0, 0);
    this.ripple.set(this.start, 0, 0);
    this.shock.set(this.start, 0, 0);
    this.setStrip(0, 0, 0);
  }

  /** The red strip on the floor from `start` along the aim: `len` m long at `opacity`; the pale core is its middle third. */
  private setStrip(len: number, opacity: number, fill: number) {
    for (const [m, w, o] of [[this.strip, CHARGE_WIDTH, opacity * 0.42], [this.stripCore, CHARGE_WIDTH * 0.3, opacity * fill * 0.6]] as const) {
      m.visible = o > 0.01 && len > 0.01;
      m.position.set(this.start.x, 0.05, this.start.z);
      m.rotation.y = Math.atan2(this.dir.x, this.dir.z);
      m.scale.set(w, 1, Math.max(len, 1e-3));
      (m.material as THREE.MeshBasicMaterial).opacity = o;
    }
  }

  /** Where he is along the path at charge progress k (0..1). */
  private at(k: number, out: THREE.Vector3) {
    return out.copy(this.start).lerp(this.end, ease(k));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.dust.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, ctx = this.ctx;
    const back = this.v3.copy(this.dir).multiplyScalar(-1);
    const plen = this.start.distanceTo(this.end);

    // --- Crouch: dust scrapes off the floor behind him; the strip fills. ---
    if (!f.s1 && t >= 0.1) { f.s1 = true; this.dust.burst(this.v1.copy(this.start), 6, 2.4, 0.4, 0.5, 1.2, Math.atan2(back.x, back.z)); }
    if (!f.s2 && t >= 0.25) { f.s2 = true; this.dust.burst(this.v1.copy(this.start), 8, 3, 0.45, 0.6, 1.2, Math.atan2(back.x, back.z)); }

    if (!f.go && t >= WIND_T) {
      f.go = true;
      // The real run (nothing on the other player's screen: the hero streams in as moves); it eases like the maths below.
      const reached = ctx?.moveCaster?.(this.v1.copy(this.end), CHARGE_TIME);
      if (reached) this.end.copy(reached).setY(0);
      this.dust.burst(this.v1.copy(this.start), 14, 4.2, 0.6, 0.6, 1.4, Math.atan2(back.x, back.z));
      this.shake = 0.25;
    }
    if (f.go && !f.done) this.run(t);

    // The strip: laid on the floor from the cast, brighter as he gathers, gone a moment after the run.
    const fill = Math.min(1, t / WIND_T);
    const gone = f.done ? Math.max(0, 1 - (t - this.endAt) / 0.5) : 1;
    this.setStrip(plen + 0.2, Math.min(1, t / 0.08) * gone, fill);

    if (this.popAt >= 0) {
      const sp = StarBurst.pop(t - this.popAt, 0.02, 0.14);
      this.pop.set(this.popPos, 2.0 * sp.scale, sp.opacity, 0.2);
    }
    if (this.endAt >= 0) {
      const k = Math.min(1, (t - this.endAt) / 0.4), e = 1 - (1 - k) * (1 - k);
      this.ripple.set(this.end, 0.4 + 2.6 * e, 0.8 * (1 - k));
      this.shock.set(this.end, 0.5 + 2.8 * e, 0.05 * (1 - k) * (1 - k));
      this.shake = Math.max(this.shake * 0.9, 0.5 * Math.exp(-(t - this.endAt) * 8));
    } else this.shake *= 0.9;
  }

  /** One frame of the run: move the head along the path, catch, carry, lay the dust trail, end. */
  private run(t: number) {
    const ctx = this.ctx, f = this.flags;
    const k = THREE.MathUtils.clamp((t - WIND_T) / CHARGE_TIME, 0, 1);
    const prev = this.at(this.prevK, this.v1);
    const cur = this.at(k, this.v2);
    this.prevK = k;
    if (ctx) {
      if (!this.caught) this.tryCatch(ctx, prev, cur, t);
      if (this.caught) this.carry(ctx, cur);
    }
    // A roll of dust behind him all the way.
    this.trailT += k > 0 ? 1 : 0;
    if (this.trailT % 2 === 0) this.dust.burst(this.v3.copy(cur), 2, 2.2, 0.5, 0.4, 1.6, Math.atan2(this.dir.x, this.dir.z) + Math.PI);
    if (k >= 1 && !f.done) {
      f.done = true;
      this.endAt = t;
      this.dust.burst(this.v3.copy(this.end), 12, 4.5, 0.65, 0.5, 2.4, Math.atan2(this.dir.x, this.dir.z));
      this.shake = Math.max(this.shake, 0.4);
    }
  }

  /** The first enemy touching the path swept this frame is caught, nearest to the start first. */
  private tryCatch(ctx: CastContext, a: THREE.Vector3, b: THREE.Vector3, t: number) {
    const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez;
    let best: Enemy | null = null, bestAlong = Infinity;
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      const u = l2 > 1e-9 ? THREE.MathUtils.clamp(((p.x - a.x) * ex + (p.z - a.z) * ez) / l2, 0, 1) : 0;
      if (Math.hypot(p.x - (a.x + ex * u), p.z - (a.z + ez * u)) > CATCH_R) continue;
      const along = (p.x - this.start.x) * this.dir.x + (p.z - this.start.z) * this.dir.z;
      if (along < -0.3 || along >= bestAlong) continue;
      best = e;
      bestAlong = along;
    }
    if (!best) return;
    this.caught = best;
    this.popPos.set(best.group.position.x, 1.1, best.group.position.z);
    this.popAt = t;
    this.shake = Math.max(this.shake, 0.5);
    this.dust.burst(this.v3.copy(best.group.position), 8, 3.5, 0.5, 0.6);
    ctx.hit(best, { damage: this.settings.damage, knock: 0, color: SUMO_CSS.core, from: this.start.clone() });
    // A shove of his is under way until he stops: a body carried out of his ring inside this window is a ring-out.
    bookOf(ctx.caster).pushUntil = performance.now() + (Math.max(0, END_T - t) + 0.3) * 1000;
  }

  /** Keeps the caught body `CHARGE_HOLD` in front of him, in small steps so it cannot tunnel through stone. */
  private carry(ctx: CastContext, cur: THREE.Vector3) {
    const e = this.caught;
    if (!e || !ctx.carry) return;
    const p = e.group.position;
    const dx = cur.x + this.dir.x * CHARGE_HOLD - p.x, dz = cur.z + this.dir.z * CHARGE_HOLD - p.z;
    const req = Math.hypot(dx, dz);
    if (req < 1e-4) return;
    const steps = Math.max(1, Math.ceil(req / STEP));
    const part = this.v3.set(dx / steps, 0, dz / steps);
    for (let i = 0; i < steps; i++) ctx.carry(e, part);
  }
}

export const sumoChargeModule: EffectModule = {
  label: 'sumo charge',
  category: 'hero: sumo',
  // `ground`: the aim point gives only the direction; the 6 m run is the same wherever it is.
  targeting: { mode: 'ground', radius: CHARGE_DIST + 2 },
  create: () => new SumoCharge(),
  telegraphs(effect) {
    const e = effect as SumoCharge;
    if (!e.ctx) return [];
    // The strip runs a little past the 6 m so a body carried at the end (`CHARGE_HOLD` ahead of him) still stands inside it.
    const x2 = e.start.x + e.dir.x * (CHARGE_DIST + CHARGE_HOLD + 0.6), z2 = e.start.z + e.dir.z * (CHARGE_DIST + CHARGE_HOLD + 0.6);
    return [{ shape: { kind: 'line', x1: e.start.x, z1: e.start.z, x2, z2, width: CHARGE_WIDTH }, start: 0.05, impact: WIND_T, until: END_T + 0.1 }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as SumoCharge;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as SumoCharge).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
  },
};
