import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { SAND, SAND_CSS, Dust, SandPool, SandRibbon, SandstoneBlocks } from '../../effects/parts/sand';
import type { Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Enemy } from '../../effects/common';

/**
 * Sand Lash (sand kit, Q: 10 m line skillshot): Sefu sweeps his crook and a ribbon of sand pours up out of the floor at
 * his side, coils once around his arm and, on the crack, snaps down the aim as a whip of sand (`ctx.projectile`: the
 * first enemy it touches is hit, dodged by stepping off the line). On a hit the tip wraps the legs and sets into a
 * sandstone shackle (four carved shards) that roots for 0.8 s, then crumbles to dust; a miss lets the whip sink into the
 * floor where it ended. With no projectile (a network duel on the caster's screen) the whip is a deterministic visual
 * at the same speed. See pipeline/designs/kit-sand.md, kit-shapes-v3.md.
 */
export interface SandLashSettings {
  damage: number;
  /** Root seconds on the hit (engine cap 1.5). */
  root: number;
  loop: boolean;
}

export const defaultSandLash = (): SandLashSettings => ({ damage: 54, root: 0.8, loop: false });

// Timeline (seconds).
const POUR_END_T = 0.2; // the coil is up
const LAUNCH_T = 0.24; // the crack: the whip leaves
const DURATION = 2.1;

const REACH = 10; // from his feet: the kit's range
const MUZZLE = 0.7;
const SPEED = 24;
const RADIUS = 0.45;
const TAIL = 3.6; // length of the whip in flight
const FLIGHT_END = LAUNCH_T + (REACH - MUZZLE) / SPEED;
const SHARDS = 4;
const SHACKLE_LIFE = 0.7; // from the hit to the crumble (the root lasts 0.8 s)

export class SandLash implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SandLashSettings;
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
  private side = new THREE.Vector3(1, 0, 0);
  private base = new THREE.Vector3(0.7, 0.05, 14); // the foot of the coil, at his side
  private muzzle = new THREE.Vector3(0, 1.2, 14);
  private head = new THREE.Vector3(); // the whip's tip: live in flight, frozen on landing
  private feet = new THREE.Vector3(0, 0, -8);
  private hit = new THREE.Vector3(0, 0.8, -8);
  private bolt: Projectile | null = null;
  private impT = -1;
  private struck = false;
  private wobble = 1;

  // Event flags.
  private flags = { puff0: false, thrown: false, landed: false, set: false, crumbled: false };

  // Parts.
  private coil = new SandRibbon(26, 8, 14);
  private whip = new SandRibbon(30, 8, 22);
  private wrapRibbon = new SandRibbon(28, 8, 4);
  private shards = new SandstoneBlocks(SHARDS + 2);
  private dust = new Dust(8, 26);
  private pool = new SandPool();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: SAND.accent, core: 0xe8fffc, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: SandLashSettings = defaultSandLash()) {
    this.settings = settings;
    this.screen.impactColor.set(SAND.stone);
    this.wrapRibbon.shed = 0;
    this.shards.dust = this.dust;
    this.shards.dustEvery = 2;
    this.dust.life = 0.55;
    this.group.add(
      this.pool.mesh, this.coil.mesh, this.whip.mesh, this.wrapRibbon.mesh, this.shards.mesh, this.dust.mesh, this.pop.mesh,
      this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FLIGHT_END;
  }

  /** Seconds after play() when the whip has flown its full reach (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.base.copy(this.from).addScaledVector(this.side, 0.8).addScaledVector(this.fwd, 0.1).setY(0.05);
    this.muzzle.copy(this.from).addScaledVector(this.fwd, MUZZLE).setY(1.2);
    this.feet.copy(this.from).addScaledVector(this.fwd, REACH);
    this.hit.copy(this.feet).setY(0.8);
    this.head.copy(this.muzzle);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).addScaledVector(this.fwd, REACH * 0.5).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.wobble = 1;
    this.bolt = null;
    this.impT = -1;
    this.struck = false;
    this.head.copy(this.muzzle);
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.coil.reset();
    this.whip.reset();
    this.wrapRibbon.reset();
    this.shards.reset();
    this.dust.reset();
    this.pool.reset();
    this.pop.set(this.hit, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.coil.update(dt);
    this.whip.update(dt);
    this.wrapRibbon.update(dt);
    this.shards.update(dt);
    this.dust.update(dt);
    this.pool.update(dt);
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

    if (!f.puff0 && t >= 0.05) {
      f.puff0 = true;
      this.dust.puff(this.v1.copy(this.base).setY(0.3), 0.6);
      this.pool.place(this.base);
      this.pool.swirl = 0.4;
      this.pool.spread(0.8, 0.15);
      this.pool.settle(0.2, 0.1);
      this.pool.fade(0.2, 0.3);
    }

    // The crack: the whip leaves as a bolt (or as a pure visual when the context has none).
    if (!f.thrown && t >= LAUNCH_T) {
      f.thrown = true;
      this.dust.puff(this.v1.copy(this.muzzle).setY(0.5), 0.5);
      if (ctx?.projectile) {
        this.v1.copy(this.from).addScaledVector(this.fwd, MUZZLE);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.fwd.clone(), speed: SPEED, range: REACH - MUZZLE, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 1, color: SAND_CSS.body, status: { kind: 'root', seconds: this.settings.root } },
        });
        this.bolt.onHit((target, at) => this.land(at, target));
      }
    }
    if (f.thrown && !f.landed) {
      const b = this.bolt;
      if (b) {
        if (b.alive) this.head.set(b.pos.x, 1.15, b.pos.z);
        else this.land(b.pos, null);
      } else {
        const d = Math.min(REACH - MUZZLE, (t - LAUNCH_T) * SPEED);
        this.head.copy(this.from).addScaledVector(this.fwd, MUZZLE + d).setY(1.15);
        if (d >= REACH - MUZZLE) this.land(this.head, null);
      }
    }

    // The tip wraps the legs and sets into stone; the shackle crumbles when the root is over.
    if (this.impT >= 0 && this.struck) {
      const after = t - this.impT;
      if (!f.set && after >= 0.12) {
        f.set = true;
        for (let i = 0; i < SHARDS; i++) {
          const a = (i / SHARDS) * Math.PI * 2 + 0.6;
          this.v1.set(this.feet.x + Math.cos(a) * 0.6, 0, this.feet.z + Math.sin(a) * 0.6);
          this.v2.set(0.34 + Math.random() * 0.08, 0.85 + Math.random() * 0.3, 0.3 + Math.random() * 0.08);
          this.shards.raise(this.v1, this.v2, 0.1, i * 0.015, { yaw: a, lean: 0.25, leanDir: Math.atan2(-Math.cos(a), -Math.sin(a)), taper: 0.3 });
        }
      }
      if (!f.crumbled && after >= SHACKLE_LIFE) {
        f.crumbled = true;
        this.shards.crumble(0.4, 0.12);
        this.dust.fall(this.v1.copy(this.feet), 0.7, 8, 1.8, 0.6);
      }
    }

    this.layout();
  }

  /** The whip has ended: on `victim` (a hit) or in the floor (a miss). */
  private land(at: THREE.Vector3, victim: Enemy | null) {
    if (this.flags.landed) return;
    this.flags.landed = true;
    this.impT = this.time;
    this.struck = !!victim;
    this.feet.set(at.x, 0, at.z);
    if (victim) this.feet.set(victim.group.position.x, 0, victim.group.position.z);
    this.hit.copy(this.feet).setY(this.struck ? 0.8 : 0.3);
    this.head.copy(this.hit);
    this.pool.place(this.feet);
    this.pool.swirl = this.struck ? 0.45 : 0.2;
    this.pool.spread(this.struck ? 1.3 : 0.7, 0.12);
    this.pool.settle(0.45, 0.15);
    this.pool.fade(0.3, 0.75);
    this.dust.puff(this.v1.copy(this.feet).setY(0.3), this.struck ? 0.7 : 0.45);
    this.shake = this.struck ? 0.14 : 0.04;
  }

  /** The coil: a helix that rises out of the floor at his side and winds once round the raised arm. */
  private coilPath = (u: number, out: THREE.Vector3) => {
    const a = u * Math.PI * 3.2;
    const r = 0.36 * (1 - 0.35 * u);
    return out.copy(this.base)
      .addScaledVector(this.side, Math.cos(a) * r - 0.1)
      .addScaledVector(this.fwd, Math.sin(a) * r)
      .setY(0.06 + u * 1.25);
  };

  /** The whip: a line from the muzzle to the tip with a snake wobble that dies when it lands. */
  private whipPath = (u: number, out: THREE.Vector3) => {
    out.lerpVectors(this.muzzle, this.head, u);
    const k = Math.sin(u * Math.PI * 2.5 - this.time * 18) * 0.28 * this.wobble * Math.sin(u * Math.PI);
    out.addScaledVector(this.side, k);
    out.y += Math.sin(u * Math.PI) * 0.12;
    return out;
  };

  /** One turn of a helix around the target's legs, from the ankles up. */
  private wrapPath = (u: number, out: THREE.Vector3) => {
    const a = Math.atan2(this.fwd.x, this.fwd.z) + 0.8 + u * Math.PI * 2.3;
    const r = 0.62 - 0.1 * u;
    return out.set(this.feet.x + Math.cos(a) * r, 0.12 + u * 0.95, this.feet.z + Math.sin(a) * r);
  };

  private layout() {
    const t = this.time;
    const f = this.flags;

    // --- Anticipation: the coil pours up and winds, then unwinds into the whip on the crack. ---
    const pour = Math.min(1, t / POUR_END_T);
    const unwind = smoothstep((t - LAUNCH_T) / 0.12);
    this.coil.shed = t < LAUNCH_T ? 26 : 6;
    this.coil.setFunction(this.coilPath, 0.3, 1 - Math.pow(1 - pour, 2), Math.min(unwind, 0.98), t);

    // --- Flight: the tip leads, a 3.6 m body trails; after landing the tail catches up and the ribbon sinks. ---
    if (f.thrown) {
      this.v1.copy(this.head).sub(this.muzzle);
      const dist = Math.max(this.v1.length(), 0.01);
      let tail = Math.max(0, 1 - TAIL / dist);
      if (f.landed) tail = Math.max(tail, smoothstep((t - this.impT - 0.1) / 0.3));
      this.wobble = f.landed ? Math.max(0, 1 - (t - this.impT) / 0.2) : 1;
      this.whip.shed = f.landed ? 10 : 30;
      this.whip.setFunction(this.whipPath, 0.46, 1, Math.min(tail, 0.985), t);
    }

    // --- The wrap sets into stone after the hit, then fades with the shackle. ---
    if (f.landed && this.struck) {
      const after = t - this.impT;
      const wh = 1 - Math.pow(1 - THREE.MathUtils.clamp(after / 0.12, 0, 1), 2);
      const wt = smoothstep((t - this.impT - SHACKLE_LIFE) / 0.25);
      this.wrapRibbon.stone = smoothstep((after - 0.04) / 0.1);
      this.wrapRibbon.setFunction(this.wrapPath, 0.34, wh, Math.min(wt, wh - 0.01), t);
      this.screen.impact = impactFrameAt(t, this.impT, [1], 0.03);
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.v1.copy(this.hit).setY(1.0), 1.0 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 2.0 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.14 * Math.exp(-after * 14));
    } else {
      this.wrapRibbon.hide();
      this.shake *= 0.9;
    }
  }
}

export const sandLashModule: EffectModule = {
  label: 'sand lash',
  category: 'hero: sand',
  // A skillshot: the aim point only gives the direction (the whip flies its 10 m wherever the cursor is).
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SandLash(),
  telegraphs(effect) {
    const e = effect as SandLash;
    const ctx = e.ctx;
    if (!ctx) return [];
    const from = ctx.sentFrom ?? ctx.from;
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Shown from the coil, armed at the crack, until the whip has flown; a bolt's hit is the dodge check, not the zone.
    return [{
      shape: { kind: 'line', x1: from.x, z1: from.z, x2: from.x + d.x * REACH, z2: from.z + d.z * REACH, width: RADIUS * 2 },
      start: 0.05, impact: LAUNCH_T, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SandLash;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as SandLash).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'root', 0, 1.5, 0.1);
  },
};
