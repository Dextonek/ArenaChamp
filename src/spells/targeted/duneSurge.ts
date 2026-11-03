import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { SAND, SAND_CSS, Dust, SandPool, SandRibbon, SandWave, SandstoneBlocks } from '../../effects/parts/sand';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import { sweepHit } from '../../obstacles';

/**
 * Dune Surge (sand kit, R: a wave that carries). Sefu stamps his crook and the ground in front of him heaves into a
 * wall of sand (0.6 s, with a long 3.6 m lane marked on the floor). Then a wave 3 m wide rolls 12 m down the aim at
 * 11 m/s. The first enemy it reaches is lifted onto the crest (`ctx.carry` every frame, the way `forgeCharge.ts`
 * does) and ridden to the end (14 damage on the catch); anything else it passes takes 16 damage and is thrown forward.
 * At the end the wave crashes: 78 damage and a 1.3 s root, with the root set into a ring of sandstone that crumbles
 * when it ends. If the carried body is stopped by a wall or pillar the wave crashes there instead. Nobody caught: the
 * wave simply breaks at 12 m.
 *
 * Network duels: the victim's client decides. The cast is replayed there from `sentFrom` and the aim point alone, and
 * each client judges and carries its own hero by its live position against the lane (`ctx.carry` moves only this
 * side's own hero). Status and carries are not relayed, so on the caster's screen the other player's figure is not
 * moved by this side. See pipeline/designs/kit-shapes-v3.md.
 */
export interface DuneSurgeSettings {
  /** Damage of the crash at the end. */
  damage: number;
  /** Damage of the catch. */
  catchDamage: number;
  /** Damage to anything else the wave passes. */
  passDamage: number;
  /** Root seconds of the crash (engine cap 1.5). */
  root: number;
  loop: boolean;
}

export const defaultDuneSurge = (): DuneSurgeSettings => ({ damage: 92, catchDamage: 14, passDamage: 16, root: 1.3, loop: false });

// Timeline (seconds).
const WIND_T = 0.6; // the heave; the wave sets off
const DURATION = 3.9;

const LEN = 12; // metres the wave rolls
const SPEED = 11; // m/s
const S0 = 0.6; // the crest starts this far in front of him
const WIDTH = 3.0; // visual width
const HALF = 1.5; // catch half-width
const LANE_W = 3.6; // the telegraph, a little wider than the wave so a body at the edge still lands
const BEHIND = 1.0; // a body this far behind the crest is still inside the wave
const AHEAD = 0.6;
const STEP = 0.3; // largest carry step
const PILLARS = 5;

export class DuneSurge implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DuneSurgeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Lane geometry (ground plane), from sentFrom and point only.
  readonly start = new THREE.Vector3(0, 0, 14);
  readonly dir = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private endAlong = S0 + LEN;
  /** The telegraph's shape: one object, mutated when a wall shortens the lane. */
  readonly lane: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: LANE_W };

  // Run state.
  private flags = { sand0: false, go: false, crashed: false, set: false, crumbled: false };
  private cc = S0; // the crest's distance along the lane
  private prevCc = S0;
  private caught: Enemy | null = null;
  private passed = new Set<Enemy>();
  private weak = 0;
  private crashT = -1;
  private crashPos = new THREE.Vector3();
  private lastPuff = 0;

  // Parts.
  private crest = [new SandRibbon(30, 8, 26), new SandRibbon(28, 8, 12), new SandRibbon(26, 8, 8)];
  private churn = new SandPool();
  private dust = new Dust(16, 70);
  private blocks = new SandstoneBlocks(PILLARS + 10);
  private ring = new SandWave();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: SAND.accent, core: 0xe8fffc, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: DuneSurgeSettings = defaultDuneSurge()) {
    this.settings = settings;
    this.screen.impactColor.set(SAND.stone);
    this.blocks.dust = this.dust;
    this.blocks.dustEvery = 2;
    this.dust.life = 0.6;
    this.group.add(
      this.churn.mesh, ...this.crest.map((c) => c.mesh), this.blocks.mesh, this.dust.mesh, this.ring.mesh, this.pop.mesh,
      this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return WIND_T + (this.endAlong - S0) / SPEED;
  }

  /** Seconds after play() when the wave has rolled its whole lane (the telegraph's last moment). */
  get runEnd() {
    return WIND_T + (this.endAlong - S0) / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    let dx = ctx.point.x - this.start.x, dz = ctx.point.z - this.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.side.set(dz, 0, -dx);
    // Always the full 12 m along the aim (the point only gives the direction); a wall shortens it.
    this.endAlong = S0 + LEN;
    const obs = ctx.obstacles?.();
    if (obs && obs.length) {
      this.v1.copy(this.start).addScaledVector(this.dir, S0 + LEN + 0.8);
      const c = sweepHit(this.start, this.v1, 0.8, obs);
      if (c && c.t > 0) this.endAlong = THREE.MathUtils.clamp(this.v2.copy(c.point).sub(this.start).dot(this.dir), S0 + 1, S0 + LEN);
    }
    this.syncLane();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.start).addScaledVector(this.dir, 6).setY(1);
    this.ring.set(this.start, 0, 0);
    this.pop.set(this.start, 0, 0);
    this.groundShock.set(this.start, 0, 0);
  }

  private syncLane() {
    const l = this.lane as { x1: number; z1: number; x2: number; z2: number };
    l.x1 = this.start.x;
    l.z1 = this.start.z;
    // A little past the end so a body carried to the crash (at the end, not past it) stands inside.
    l.x2 = this.start.x + this.dir.x * (this.endAlong + 0.8);
    l.z2 = this.start.z + this.dir.z * (this.endAlong + 0.8);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.cc = this.prevCc = S0;
    this.caught = null;
    this.passed.clear();
    this.weak = 0;
    this.crashT = -1;
    this.lastPuff = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    for (const c of this.crest) c.reset();
    this.churn.reset();
    this.dust.reset();
    this.blocks.reset();
    this.ring.reset();
    this.pop.set(this.start, 0, 0);
    this.groundShock.set(this.start, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const c of this.crest) c.update(dt);
    this.churn.update(dt);
    this.dust.update(dt);
    this.blocks.update(dt);
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

    // --- The heave: the floor churns in front of him and the sand piles up. ---
    if (!f.sand0 && t >= 0.05) {
      f.sand0 = true;
      this.churn.place(this.v1.copy(this.start).addScaledVector(this.dir, S0 + 0.3));
      this.churn.swirl = 0.7;
      this.churn.spread(1.7, 0.4);
      this.dust.puff(this.v1.copy(this.start).addScaledVector(this.dir, S0).setY(0.3), 0.8);
    }
    if (!f.go && t >= WIND_T) {
      f.go = true;
      this.shake = 0.25;
      this.dust.puff(this.v1.copy(this.start).addScaledVector(this.dir, S0).setY(0.4), 1.0);
    }
    if (f.go && !f.crashed) this.roll(ctx, t);

    if (f.crashed && !f.set && t >= this.crashT + 0.12) {
      f.set = true;
      this.raisePillars();
    }
    if (f.crashed && !f.crumbled && t >= this.crashT + this.settings.root) {
      f.crumbled = true;
      this.blocks.crumble(0.45, 0.15);
      this.dust.fall(this.v1.copy(this.crashPos), 1.0, 10, 2, 0.7);
    }
    this.layout(t);
  }

  /** One frame of the run: move the crest, catch, push, carry, find the wall, crash at the end. */
  private roll(ctx: CastContext | null, t: number) {
    this.prevCc = this.cc;
    this.cc = Math.min(this.endAlong, S0 + (t - WIND_T) * SPEED);

    if (t - this.lastPuff >= 0.05) {
      this.lastPuff = t;
      this.v1.copy(this.start).addScaledVector(this.dir, this.cc - 0.4).addScaledVector(this.side, (Math.random() - 0.5) * WIDTH).setY(0.3);
      this.dust.puff(this.v1, 0.5);
    }

    if (ctx) {
      this.sweep(ctx);
      if (this.caught) this.carry(ctx);
    }
    if (!this.flags.crashed && this.cc >= this.endAlong) this.crash(ctx, t);
  }

  /** Distance along the lane and sideways of a figure's feet. */
  private along(p: THREE.Vector3, out: { a: number; lat: number }) {
    const rx = p.x - this.start.x, rz = p.z - this.start.z;
    out.a = rx * this.dir.x + rz * this.dir.z;
    out.lat = Math.abs(rx * this.side.x + rz * this.side.z);
    return out;
  }

  /** Who is inside the wave this frame: the first one is caught, the rest are hit and thrown ahead. */
  private sweep(ctx: CastContext) {
    const pos = { a: 0, lat: 0 };
    const inside: { e: Enemy; a: number }[] = [];
    for (const e of ctx.targets) {
      if (e === this.caught || this.passed.has(e)) continue;
      this.along(e.group.position, pos);
      if (pos.lat > HALF + 0.2 || pos.a < this.prevCc - BEHIND || pos.a > this.cc + AHEAD || pos.a < 0) continue;
      inside.push({ e, a: pos.a });
    }
    inside.sort((x, y) => x.a - y.a);
    for (const { e } of inside) {
      const p = e.group.position;
      this.passed.add(e);
      if (!this.caught) {
        this.caught = e;
        this.weak = 0;
        ctx.hit(e, {
          damage: this.settings.catchDamage, knock: 0, color: SAND_CSS.hot, from: this.start.clone(), projectile: true,
        });
        this.v3.set(p.x, 1.1, p.z);
        this.dust.puff(this.v3, 0.8);
        this.popAt(this.v3, 1.0);
        this.shake = Math.max(this.shake, 0.25);
      } else {
        // Thrown forward off the crest.
        ctx.hit(e, {
          damage: this.settings.passDamage, knock: 7, color: SAND_CSS.body, projectile: true,
          from: this.v3.set(p.x - this.dir.x * 2, 0, p.z - this.dir.z * 2).clone(),
        });
        this.dust.puff(this.v3.set(p.x, 0.8, p.z), 0.6);
      }
    }
  }

  private popAt(at: THREE.Vector3, size: number) {
    this.popPos.copy(at);
    this.popSize = size;
    this.popStart = this.time;
  }
  private popPos = new THREE.Vector3();
  private popSize = 0;
  private popStart = -1;

  /** Keeps the caught body on the crest; a carry that falls short means stone in the way, and the wave breaks there. */
  private carry(ctx: CastContext) {
    const e = this.caught;
    if (!e || !ctx.carry) return;
    const p = e.group.position;
    const a = this.along(p, { a: 0, lat: 0 }).a;
    const gap = THREE.MathUtils.clamp(this.cc - a, -0.15, 0.7);
    if (gap < 0.02 && gap > -0.02) return;
    const req = Math.abs(gap);
    const steps = Math.max(1, Math.ceil(req / STEP));
    const before = this.v2.copy(p);
    const part = this.v1.copy(this.dir).multiplyScalar(gap / steps);
    for (let i = 0; i < steps; i++) ctx.carry(e, part);
    const got = Math.hypot(p.x - before.x, p.z - before.z);
    this.weak = req > 0.08 && got < req * 0.35 ? this.weak + 1 : 0;
    if (this.weak >= 2 && !this.flags.crashed) {
      // The body is up against stone (or the ring): the wave breaks here.
      this.endAlong = this.cc;
      this.syncLane();
      this.crash(ctx, this.time);
    }
  }

  /** The wave breaks: the big hit and the root on what it carried, a ring, a burst, shards. */
  private crash(ctx: CastContext | null, t: number) {
    const f = this.flags;
    f.crashed = true;
    this.crashT = t;
    const e = this.caught;
    if (e) this.crashPos.set(e.group.position.x, 0, e.group.position.z);
    else this.crashPos.copy(this.start).addScaledVector(this.dir, this.cc);
    const at = this.crashPos;
    if (ctx && e) {
      ctx.hit(e, {
        damage: this.settings.damage, knock: 0, color: SAND_CSS.hot, projectile: true,
        from: this.v1.copy(at).addScaledVector(this.dir, -1).clone(),
        status: { kind: 'root', seconds: this.settings.root },
      });
    }
    this.dust.puff(this.v1.copy(at).setY(0.5), 1.3);
    this.dust.fall(this.v1.copy(at), 2.0, 40, 3.6, 1.0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.v1.set(at.x + Math.cos(a) * 0.6, 0.3, at.z + Math.sin(a) * 0.6);
      this.v2.set(Math.cos(a) * (3 + Math.random() * 2) + this.dir.x * 3, 4 + Math.random() * 3, Math.sin(a) * (3 + Math.random() * 2) + this.dir.z * 3);
      this.blocks.throwShard(this.v1, this.v2, this.v3.set(0.16, 0.36, 0.14), 1.5, 0.4);
    }
    this.churn.fade(0.4, 0.2);
    this.shake = 0.7;
  }

  private raisePillars() {
    const at = this.crashPos;
    for (let i = 0; i < PILLARS; i++) {
      const a = (i / PILLARS) * Math.PI * 2 + 0.4;
      this.v1.set(at.x + Math.cos(a) * 0.75, 0, at.z + Math.sin(a) * 0.75);
      this.v2.set(0.4 + Math.random() * 0.08, 1.0 + Math.random() * 0.4, 0.34 + Math.random() * 0.08);
      this.blocks.raise(this.v1, this.v2, 0.1, i * 0.02, { yaw: a, lean: 0.22, leanDir: Math.atan2(-Math.cos(a), -Math.sin(a)), taper: 0.3 });
    }
  }

  /** One ridge of the wave: an arch across the lane, `back` metres behind the crest, `h` high. */
  private ridge(back: number, h: number, fwdCurl: number) {
    return (u: number, out: THREE.Vector3) => {
      const sn = Math.sin(u * Math.PI);
      const lat = (u - 0.5) * WIDTH * (1 - 0.06 * back);
      const grow = this.heave();
      const along = this.cc - back + fwdCurl * sn * sn * grow + 0.08 * Math.sin(u * 9 - this.time * 12);
      return out.copy(this.start).addScaledVector(this.dir, along).addScaledVector(this.side, lat).setY(0.12 + h * grow * Math.pow(sn, 0.75));
    };
  }

  /** 0..1 how built-up the wave is: grows during the heave, collapses after the crash. */
  private heave() {
    const t = this.time;
    const up = smoothstep(t / WIND_T);
    if (this.crashT < 0) return up;
    return up * (1 - smoothstep((t - this.crashT) / 0.35));
  }

  private layout(t: number) {
    const f = this.flags;

    // --- The wave: three stacked ridges, the crest curling forward; the churn runs under it. ---
    const grow = this.heave();
    const crests = [{ back: 0, h: 1.55, curl: 0.5, w: 0.8 }, { back: 0.9, h: 1.2, curl: 0.25, w: 0.85 }, { back: 1.8, h: 0.85, curl: 0.1, w: 0.8 }];
    this.crest.forEach((r, i) => {
      const c = crests[i];
      if (grow < 0.02) { r.hide(); return; }
      r.shed = f.crashed ? 0 : 26;
      r.setFunction(this.ridge(c.back, c.h, c.curl), c.w * (0.4 + 0.6 * grow), 1, 0, t);
    });
    if (f.sand0 && this.crashT < 0) {
      this.churn.place(this.v1.copy(this.start).addScaledVector(this.dir, this.cc - 0.6));
    }

    // --- The catch pop. ---
    if (this.popStart >= 0) {
      const sp = StarBurst.pop(t - this.popStart, 0, 0.03);
      this.pop.set(this.popPos, this.popSize * sp.scale, sp.opacity, 0.2);
    }

    // --- The crash: impact frame, big star, ring, refraction, shake. ---
    if (this.crashT >= 0) {
      const ak = t - this.crashT;
      this.screen.impact = impactFrameAt(t, this.crashT, this.caught ? [1, 2] : [1], 0.04);
      const sp = StarBurst.pop(ak, 0, 0.04);
      this.pop.set(this.v1.copy(this.crashPos).setY(1.2), 2.2 * sp.scale, sp.opacity, 0.2);
      const rk = THREE.MathUtils.clamp(ak / 0.5, 0, 1);
      this.ring.set(this.crashPos, 0.4 + 3.2 * rk, 0.95 * (1 - rk) * (1 - rk), 0.35);
      this.groundShock.set(this.crashPos, 0.5 + 3.6 * rk, 0.05 * (1 - rk) * (1 - rk));
      this.shake = Math.max(this.shake * 0.9, 0.7 * Math.exp(-ak * 8));
    } else {
      this.shake *= 0.92;
    }
    this.screen.darken = 0.15 * smoothstep((t - 0.1) / 0.3) * (1 - smoothstep((t - (this.crashT >= 0 ? this.crashT : this.runEnd) - 0.3) / 0.6));
  }
}

export const duneSurgeModule: EffectModule = {
  label: 'dune surge',
  category: 'hero: sand',
  // `ground`: the aim point gives only the direction; the 12 m run is the same wherever it is.
  targeting: { mode: 'ground', radius: 16 },
  create: () => new DuneSurge(),
  telegraphs(effect) {
    const e = effect as DuneSurge;
    if (!e.ctx) return [];
    // The whole lane from the start of the heave until the wave has rolled it (a wall can only shorten it).
    return [{ shape: e.lane, start: 0.05, impact: WIND_T, until: e.runEnd + 0.1 }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as DuneSurge;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as DuneSurge).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 250, 1);
    f.add(s, 'catchDamage', 0, 60, 1);
    f.add(s, 'passDamage', 0, 80, 1);
    f.add(s, 'root', 0, 1.5, 0.1);
  },
};
