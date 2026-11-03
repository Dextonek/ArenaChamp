import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { FORGE, FORGE_CSS, HotStreak, PulseRing, QuenchSteam, SlagPool, Sparks } from '../../effects/parts/forge';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { sweepHit, type Obstacle } from '../../obstacles';

/**
 * Forge Charge (forge kit, R: a charge that carries). Brannoc crouches (sparks, a red strip on the floor), then
 * charges 8 m down the aim (`ctx.moveCaster`, 0.55 s). The first enemy he touches is caught and carried ahead of
 * him (`ctx.carry` every frame, kept 1.15 m in front of him). If the carried body meets a wall or pillar on the way
 * the charge stops there: he slams it into the stone, 110 damage and a 1.2 s stun. Otherwise it is knocked up 0.5 s
 * at the end of the charge (62 damage). A catch itself does 14 damage and roots 0.8 s so the victim does not fight
 * the carry. Nobody in the path: he simply charges 8 m. See pipeline/designs/kit-shapes-v3.md.
 *
 * Network duels: the victim's client decides. The cast is replayed there with no `moveCaster` (the real charge
 * streams in as moves), so everything is computed from the path itself: `ctx.sentFrom ?? ctx.from` and the aim
 * point, eased exactly like the engine's dash, and the catch is judged by the victim's live position against the
 * path. The victim's client carries its own hero, finds the wall by the carry falling short (or by `sweepHit` when
 * the context offers `obstacles`) and applies the stun or knock-up with the hit. If the carry never runs (an older
 * client) the end hit still pulls the victim toward the end of the charge (`pull`, `from` just past it) and applies
 * the knock-up, so the result is sensible. On the caster's screen the other hero is never carried by this side.
 */
export interface ForgeChargeSettings {
  /** Damage at the end of an open charge (with the knock-up). */
  damage: number;
  /** Damage of a wall slam. */
  slamDamage: number;
  /** Damage of the catch. */
  catchDamage: number;
  /** Knock-up seconds at the end (engine cap 0.8). */
  knockUp: number;
  /** Stun seconds of a slam (engine cap 1.2). */
  stun: number;
  loop: boolean;
}

export const defaultForgeCharge = (): ForgeChargeSettings => ({ damage: 62, slamDamage: 110, catchDamage: 14, knockUp: 0.5, stun: 1.2, loop: false });

// Timeline (seconds).
const WIND_T = 0.4; // crouch, then go
const CHARGE_S = 0.55;
const END_T = WIND_T + CHARGE_S;
const DURATION = 2.6;

const DIST = 8; // metres of charge
const HOLD = 1.15; // the carried body rides this far ahead of him
const CATCH_R = 0.85; // lateral reach of the catch (the strip is 1.0 each side)
const BODY = 0.5;
const STEP = 0.3; // largest carry step, so a body cannot tunnel through a wall in one frame
const POOLS = 5;

/** The engine's dash easing (`Arena.stepDash`): ease-out cubic. */
const ease = (k: number) => 1 - (1 - k) ** 3;

/** What `CastContext.obstacles` may look like (a list, or a getter of the live list) once the shared file offers it. */
type WithObstacles = { obstacles?: readonly Obstacle[] | (() => readonly Obstacle[]) };

export class ForgeCharge implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ForgeChargeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Path geometry (ground plane), from sentFrom and point only.
  readonly start = new THREE.Vector3(0, 0, 14);
  private end = new THREE.Vector3(0, 0, 6);
  readonly dir = new THREE.Vector3(0, 0, -1);
  private prevK = 0;

  private flags = { spark1: false, spark2: false, go: false, done: false, ring: false };
  private caught: Enemy | null = null;
  private slammed = false;
  private weak = 0; // consecutive frames the carry fell short
  private endT = END_T;
  private steamAt = -1;
  private steamPos = new THREE.Vector3();
  private popAt = -1;
  private popPos = new THREE.Vector3();
  private slamAt = -1;
  private slamPos = new THREE.Vector3();
  private ringAt = -1;
  private ringPos = new THREE.Vector3();

  // Parts.
  private streak = new HotStreak();
  private sparks = new Sparks(200);
  private pools = Array.from({ length: POOLS }, () => new SlagPool());
  private poolOn = new Array<boolean>(POOLS).fill(false);
  private steam = new QuenchSteam(10);
  private ring = new PulseRing();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: FORGE.accent, core: 0xe8fbff, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();

  constructor(settings: ForgeChargeSettings = defaultForgeCharge()) {
    this.settings = settings;
    this.screen.impactColor.set(FORGE.ash);
    this.steam.life = 0.55;
    this.group.add(
      ...this.pools.map((p) => p.mesh), this.streak.mesh, this.sparks.mesh, this.steam.mesh, this.ring.mesh, this.pop.mesh,
      this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return WIND_T;
  }

  /** Seconds after play() when the charge ends (the telegraph's last moment). */
  get chargeEnd() {
    return this.endT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.start.set(s.x, 0, s.z);
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    // Always the full 8 m along the aim (the point only gives the direction); a wall shortens it when we can see walls.
    this.end.copy(this.start).addScaledVector(this.dir, DIST);
    const obs = this.obstacles(ctx);
    if (obs) {
      const c = sweepHit(this.start, this.end, BODY, obs);
      if (c && c.t > 0) this.end.copy(c.point);
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.start).addScaledVector(this.dir, DIST * 0.5).setY(1);
    this.pools.forEach((p, i) => p.place(this.v1.copy(this.start).addScaledVector(this.dir, 1.2 + (i * (DIST - 1.6)) / (POOLS - 1))));
    this.ring.set(this.end, 0, 0);
    this.pop.set(this.end, 0, 0);
    this.groundShock.set(this.end, 0, 0);
  }

  /** The live obstacles when the context offers them (`CastContext.obstacles`, a shared-file addition), else null. */
  private obstacles(ctx: CastContext): readonly Obstacle[] | null {
    const o = (ctx as unknown as WithObstacles).obstacles;
    const list = typeof o === 'function' ? o() : o;
    return list && list.length ? list : null;
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
    this.slammed = false;
    this.weak = 0;
    this.endT = END_T;
    this.steamAt = -1;
    this.popAt = this.slamAt = this.ringAt = -1;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.sparks.reset();
    for (const p of this.pools) p.reset();
    this.poolOn.fill(false);
    this.steam.reset();
    this.streak.reset();
    this.ring.set(this.end, 0, 0);
    this.pop.set(this.end, 0, 0);
    this.groundShock.set(this.end, 0, 0);
  }

  /** Where he is along the path at charge progress k (0..1), on the ground. */
  private at(k: number, out: THREE.Vector3) {
    return out.copy(this.start).lerp(this.end, ease(k));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.sparks.update(dt);
    for (const p of this.pools) p.update(dt);
    this.steam.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // --- Crouch: sparks scrape off the floor behind him. ---
    if (!f.spark1 && t >= 0.08) { f.spark1 = true; this.sparks.burst(this.v1.copy(this.start).setY(0.15), this.v2.copy(this.dir).multiplyScalar(-1).setY(0.5), 8, 5, 0.8); }
    if (!f.spark2 && t >= 0.25) { f.spark2 = true; this.sparks.burst(this.v1.copy(this.start).setY(0.15), this.v2.copy(this.dir).multiplyScalar(-1).setY(0.5), 10, 6, 0.8); }

    if (!f.go && t >= WIND_T) {
      f.go = true;
      // The real dash (nothing on the other player's screen: the hero streams in as moves); it eases like the maths below.
      const reached = ctx?.moveCaster?.(this.v1.copy(this.end), CHARGE_S);
      if (reached) this.end.copy(reached).setY(0);
      this.sparks.burst(this.v1.copy(this.start).setY(0.2), this.v2.copy(this.dir).multiplyScalar(-1).setY(0.3), 18, 8, 1.0);
      this.shake = 0.2;
    }
    if (f.go && !f.done) this.charge(t);

    // Late steam off the strip.
    if (this.steamAt >= 0 && t >= this.steamAt) {
      this.steamAt = -1;
      this.steam.puff(this.v1.copy(this.steamPos).setY(0.3), 0.45, true);
    }
    this.layout(t);
  }

  /** One frame of the charge: move the path head, catch, carry, find the wall, land the hits. */
  private charge(t: number) {
    const ctx = this.ctx;
    const f = this.flags;
    const k = THREE.MathUtils.clamp((t - WIND_T) / CHARGE_S, 0, 1);
    const prev = this.at(this.prevK, this.v1);
    const cur = this.at(k, this.v2);
    this.prevK = k;

    if (ctx) {
      if (!this.caught) this.tryCatch(ctx, prev, cur, t);
      if (this.caught) this.carry(ctx, cur, t);
    }
    // A bit of slag falls off him all the way.
    if (!f.done) {
      this.sparks.burst(this.v3.copy(cur).setY(0.2), this.v4.copy(this.dir).multiplyScalar(-1).setY(0.6), 2, 4, 0.9);
      this.pools.forEach((p, i) => {
        if (this.poolOn[i]) return;
        const at = 1.2 + (i * (DIST - 1.6)) / (POOLS - 1);
        if (this.v3.copy(cur).sub(this.start).dot(this.dir) < at) return;
        this.poolOn[i] = true;
        p.spread(0.5, 0.15);
        p.cool(0.9, 0.5);
        p.fade(0.4, 1.4);
      });
    }
    if (!f.done && !this.slammed && k >= 1) this.finishOpen(ctx);
  }

  /** The first enemy touching the path swept this frame is caught, nearest to the start first. */
  private tryCatch(ctx: CastContext, a: THREE.Vector3, b: THREE.Vector3, t: number) {
    const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez;
    let best: Enemy | null = null, bestAlong = Infinity;
    for (const e of ctx.targets) {
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
    this.weak = 0;
    const p = best.group.position;
    this.v3.copy(p).setY(1.1);
    this.sparks.burst(this.v3, this.dir, 16, 7, 0.9);
    this.shake = Math.max(this.shake, 0.3);
    ctx.hit(best, {
      damage: this.settings.catchDamage, knock: 0, color: FORGE_CSS.body, from: this.start.clone(),
      status: { kind: 'root', seconds: 0.8 },
    });
    this.popAt = t;
    this.popPos.copy(this.v3);
  }

  /** Keeps the caught body HOLD in front of him; a carry that falls short, or a sweep that touches stone, is the slam. */
  private carry(ctx: CastContext, cur: THREE.Vector3, t: number) {
    const e = this.caught;
    // No carry in this context: the body is not held; the end hit pulls it to the end instead.
    if (!e || this.slammed || !ctx.carry) return;
    const p = e.group.position;
    const want = this.v3.copy(cur).addScaledVector(this.dir, HOLD);
    const delta = this.v4.set(want.x - p.x, 0, want.z - p.z);
    const req = delta.length();
    if (req < 1e-4) return;
    const obs = this.obstacles(ctx);
    let steps = Math.max(1, Math.ceil(req / STEP));
    let wall: { point: THREE.Vector3; normal: THREE.Vector3 } | null = null;
    if (obs) {
      const c = sweepHit(p, this.v1.copy(p).add(delta), BODY, obs);
      // Touching stone and still moving into it. A body resting against a wall and moving away is not a slam.
      if (c && c.normal.x * delta.x + c.normal.z * delta.z < 0) {
        wall = { point: c.surface.clone(), normal: c.normal.clone() };
        const frac = THREE.MathUtils.clamp(c.t, 0, 1);
        delta.multiplyScalar(frac);
        steps = Math.max(1, Math.ceil(delta.length() / STEP));
      }
    }
    const before = p.clone();
    if (ctx.carry && delta.lengthSq() > 1e-8) {
      const part = new THREE.Vector3().copy(delta).divideScalar(steps);
      for (let i = 0; i < steps; i++) ctx.carry(e, part);
    }
    const got = Math.hypot(p.x - before.x, p.z - before.z);
    if (!wall) {
      // The carry fell short of what was asked for two frames running: the body is up against stone (or the ring).
      this.weak = req > 0.12 && got < req * 0.35 ? this.weak + 1 : 0;
      if (this.weak >= 2) wall = { point: p.clone(), normal: this.dir.clone().multiplyScalar(-1) };
    }
    if (wall) this.slam(ctx, e, wall.point, t);
  }

  /** The body meets stone: he stops behind it, it takes the big hit and a stun. */
  private slam(ctx: CastContext, e: Enemy, at: THREE.Vector3, t: number) {
    this.slammed = true;
    this.flags.done = true;
    this.endT = t;
    const p = e.group.position;
    // He stops right behind the body (a charge through the stone would carry him past the wall).
    this.v1.set(p.x - this.dir.x * 1.0, 0, p.z - this.dir.z * 1.0);
    ctx.moveCaster?.(this.v1, 0.08);
    this.steamPos.copy(this.v1).setY(0);
    this.steamAt = t + 0.4;
    ctx.hit(e, {
      damage: this.settings.slamDamage, knock: 0, color: FORGE_CSS.hot, from: at.clone(),
      status: { kind: 'stun', seconds: this.settings.stun },
    });
    this.v3.set(p.x, 1.1, p.z);
    this.sparks.burst(this.v3, this.v2.copy(this.dir).multiplyScalar(-1).setY(0.3), 40, 11, 1.1);
    this.sparks.burst(this.v3, this.v2.set(0, 1, 0), 18, 8, 0.9);
    this.shake = 0.7;
    this.slamAt = t;
    this.slamPos.set(p.x, 0, p.z);
  }

  /** The charge ran its 8 m. A caught body is knocked up at the end (and pulled to it if the carry never ran). */
  private finishOpen(ctx: CastContext | null) {
    const f = this.flags;
    f.done = true;
    this.endT = this.time;
    this.ringAt = this.time;
    this.ringPos.copy(this.end);
    this.sparks.burst(this.v1.copy(this.end).setY(0.2), this.v2.copy(this.dir).setY(0.5), 16, 8, 1.0);
    this.shake = Math.max(this.shake, 0.35);
    this.steamPos.copy(this.end);
    this.steamAt = this.time + 0.4;
    const e = this.caught;
    if (!ctx || !e) return;
    const p = e.group.position;
    this.v1.copy(this.end).addScaledVector(this.dir, HOLD);
    const d = Math.hypot(p.x - this.v1.x, p.z - this.v1.z);
    ctx.hit(e, {
      damage: this.settings.damage, knock: 0, color: FORGE_CSS.hot,
      // `from` just past where the body should be: a pull stops 1 m short of it, so an un-carried victim ends there.
      from: this.v1.clone().addScaledVector(this.dir, 1), pull: Math.min(4, d),
      status: { kind: 'knockup', seconds: this.settings.knockUp },
    });
    this.v3.set(p.x, 1.1, p.z);
    this.sparks.burst(this.v3, this.v2.set(0, 1, 0), 14, 7, 0.8);
  }

  private layout(t: number) {
    const f = this.flags;

    // --- The head of the charge: a hot comet at chest height, with a long tail behind it. ---
    if (f.go && !this.slammed && !f.done) {
      const k = THREE.MathUtils.clamp((t - WIND_T) / CHARGE_S, 0, 1);
      this.at(k, this.v1).setY(1.0);
      const tail = Math.min(3.4, Math.hypot(this.v1.x - this.start.x, this.v1.z - this.start.z) + 0.4);
      this.streak.set(this.v1, this.v2.copy(this.v1).addScaledVector(this.dir, -tail), 0.95, 1);
    } else if (f.go) {
      const o = Math.max(0, 1 - (t - this.endT) / 0.25);
      if (o > 0) {
        this.at(this.slammed ? this.prevK : 1, this.v1).setY(1.0);
        this.streak.set(this.v1, this.v2.copy(this.v1).addScaledVector(this.dir, -2.4), 0.95 * o, o);
      } else this.streak.set(this.v1, this.v1, 0, 0);
    } else {
      this.streak.set(this.v1, this.v1, 0, 0);
    }

    // --- The catch, the end of an open charge, and the slam. ---
    if (this.popAt >= 0) {
      const sp = StarBurst.pop(t - this.popAt, 0, 0.03);
      this.pop.set(this.popPos, 1.1 * sp.scale, sp.opacity, 0.2);
    }
    if (this.ringAt >= 0) {
      const k = THREE.MathUtils.clamp((t - this.ringAt) / 0.5, 0, 1);
      this.ring.set(this.ringPos, 0.4 + 4 * k, 0.9 * (1 - k) * (1 - k), 0.35);
      this.groundShock.set(this.ringPos, 0.5 + 3 * k, 0.03 * (1 - k) * (1 - k));
    }
    if (this.slamAt >= 0) {
      const ak = t - this.slamAt;
      const gp = THREE.MathUtils.clamp(ak / 0.4, 0, 1);
      this.screen.impact = impactFrameAt(t, this.slamAt, [1], 0.04);
      this.ring.set(this.slamPos, 0.4 + 3.4 * gp, 0.9 * (1 - gp) * (1 - gp), 0.35);
      this.groundShock.set(this.slamPos, 0.5 + 3.5 * gp, 0.05 * (1 - gp) * (1 - gp));
      this.pop.set(this.v1.copy(this.slamPos).setY(1.2), 2.0 * StarBurst.pop(ak, 0, 0.04).scale, StarBurst.pop(ak, 0, 0.04).opacity, 0.2);
      this.shake = Math.max(this.shake * 0.9, 0.7 * Math.exp(-ak * 8));
    } else {
      this.shake *= 0.9;
    }
    this.screen.darken = 0.18 * smoothstep((t - 0.1) / 0.3) * (1 - smoothstep((t - (this.endT + 0.4)) / 0.6));
  }
}

export const forgeChargeModule: EffectModule = {
  label: 'forge charge',
  category: 'hero: forge',
  // `ground`: the aim point gives only the direction; the 8 m run is the same wherever it is.
  targeting: { mode: 'ground', radius: DIST + 2 },
  create: () => new ForgeCharge(),
  telegraphs(effect) {
    const e = effect as ForgeCharge;
    if (!e.ctx) return [];
    // The strip runs a little past the 8 m so a body carried at the end (HOLD ahead of him) still stands inside it.
    const x2 = e.start.x + e.dir.x * (DIST + HOLD + 0.6), z2 = e.start.z + e.dir.z * (DIST + HOLD + 0.6);
    return [{
      shape: { kind: 'line', x1: e.start.x, z1: e.start.z, x2, z2, width: 2.0 },
      start: 0.05, impact: WIND_T, until: END_T + 0.1,
    }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ForgeCharge;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ForgeCharge).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'slamDamage', 1, 300, 1);
    f.add(s, 'catchDamage', 0, 60, 1);
    f.add(s, 'knockUp', 0, 0.8, 0.1);
    f.add(s, 'stun', 0, 1.2, 0.1);
  },
};
