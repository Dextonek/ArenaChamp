import * as THREE from 'three';
import type { Enemy } from './common';
import type { HitOptions } from './targeting';
import type { Projectile, ProjectileOptions } from './projectile';
import { BoltSet, type BoltLook } from './parts/bolt';
import { MinionPool, type MinionFx, type MinionLook, type MinionPose } from './parts/minion';

/**
 * Summons (pipeline/designs/mechanics.md section 2). A spell calls `CastContext.summon` and gets a handle; the arena owns
 * the little units and ticks them (`SummonSystem`, `arena.summons`). They fight for the caster's side:
 *
 * - `melee`   walks to the nearest enemy (unit or hero) and hits it in melee after a short swing.
 * - `ranged`  keeps about 6 m away and fires small bolts through the projectile system, so they can be dodged.
 * - `turret`  stands still and fires the same bolts at whatever comes into range.
 *
 * A unit has its own HP and dies at 0 HP or when its `seconds` run out, in a small puff. At most 6 live per side.
 * Spell hits and bolts can hit enemy units (`arena.liveFoes()` lists them, and `ctx.hit` takes a unit's figure), but a
 * unit is never the duel's enemy hero. Unit damage on a hero goes through the world's `hit`, which for a duel is the
 * same path as any spell hit (shield, status). Network duels leave `summon` undefined. `kind` decides behaviour only;
 * the look is a `MinionLook` (`parts/minion.ts`), pluggable per summon.
 */
export type SummonKind = 'melee' | 'ranged' | 'turret';

/** Whose side a unit fights on: the player's hero, or the duel opponent. */
export type SummonSide = 'hero' | 'opponent';

export interface SummonOptions {
  kind: SummonKind;
  /** Where they appear (ground plane; a ring of `count` units is spread round it). */
  at: THREE.Vector3;
  /** How many (default 1). Units over the per-side cap of 6 are not made. */
  count?: number;
  /** HP of each unit. */
  hp: number;
  /** Seconds a unit lives. */
  seconds: number;
  /** Damage of one attack. */
  damage: number;
  /** Seconds between attacks. */
  attackEvery: number;
  /** Shooting range (ranged 9, turret 8); ignored by melee. */
  range?: number;
  /** Walking speed in m/s (melee 3.6, ranged 3); ignored by a turret. */
  speed?: number;
  /** The summoner's colour (css): tints the figure, the bolts and the hit numbers. */
  color?: string;
  /** How the units look (default: `defaultLook`). */
  look?: MinionLook;
}

/** One summoned unit. `figure` is an `Enemy`, so it is a valid `ctx.hit` target. */
export class SummonUnit {
  readonly pos: THREE.Vector3;
  hp: number;
  readonly max: number;
  /** Seconds left to live. */
  left: number;
  /** Seconds since death (-1 = alive). */
  dead = -1;
  /** True when HP ran out; false when the time ran out. Set at death. */
  slain = false;
  age = 0;
  cd: number;
  /** Melee swing progress 0..1 (-1 = not swinging) and who it is aimed at. */
  swing = -1;
  swingAt: Enemy | null = null;
  shot = 0;
  flash = 0;
  readonly flashTint = new THREE.Color();
  readonly knock = new THREE.Vector3();
  /** What the arena targets (selection, chains): the figure and where it stands (live). */
  readonly body: { figure: Enemy; home: THREE.Vector3 };

  /** @internal */
  constructor(
    readonly figure: MinionFx,
    readonly summon: Summon,
    readonly kind: SummonKind,
    readonly side: SummonSide,
    readonly opts: Required<Pick<SummonOptions, 'damage' | 'attackEvery' | 'range' | 'speed' | 'color'>>,
    hp: number,
    seconds: number,
  ) {
    this.pos = figure.group.position;
    this.hp = this.max = hp;
    this.left = seconds;
    this.cd = 0.5;
    this.body = { figure, home: this.pos };
  }

  get alive() {
    return this.dead < 0;
  }
}

/** The handle a spell keeps: its units, whether any is alive, and a death hook. */
export class Summon {
  readonly units: SummonUnit[] = [];
  private deaths: ((unit: SummonUnit) => void)[] = [];

  /** @internal */
  constructor(readonly world: SummonWorld) {}

  /** True while at least one of its units lives. */
  get alive() {
    return this.units.some((u) => u.alive);
  }

  /** Calls `cb` for every unit of this summon that dies (`unit.slain`: by damage, else the time ran out). */
  onDeath(cb: (unit: SummonUnit) => void) {
    this.deaths.push(cb);
    return this;
  }

  /** @internal */
  died(u: SummonUnit) {
    for (const cb of this.deaths) cb(u);
  }
}

/** What a side's units fight with; the arena builds one per side (and per duel cast context). */
export interface SummonWorld {
  side: SummonSide;
  /** The enemies the units can attack right now (the other side's hero and units), with where they stand. */
  victims(): { figure: Enemy; pos: THREE.Vector3 }[];
  /** Delivers a unit's hit (`projectile: true` is set: no zone check, the touch is the dodge check). */
  hit(target: Enemy, opts: HitOptions): void;
  /** Starts a bolt for a unit. */
  fire(opts: ProjectileOptions): Projectile;
}

/** The arena services the units need. */
export interface SummonEnv {
  camera: THREE.Camera;
  /** A floating label over `at` (damage numbers). */
  say(text: string, color: string, at: THREE.Vector3, scale?: number): void;
  /** Keeps a spot inside the ring and out of the obstacles. */
  place(p: THREE.Vector3): void;
  /** A walking direction that slides round obstacles. */
  slide(from: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3;
  /** True when no obstacle stands between the two spots. */
  sees(a: THREE.Vector3, b: THREE.Vector3): boolean;
}

export interface SummonStats {
  /** Units made. */
  spawned: number;
  /** Damage their attacks landed (melee swings that connected, bolts that touched). */
  dealt: number;
  /** HP the units lost to hits. */
  taken: number;
  /** Units that died of damage / of time. */
  slain: number;
  expired: number;
}

/** Most units alive per side. */
export const MAX_UNITS = 6;

const MELEE_REACH = 1.4;
const SWING_TIME = 0.3;
const RANGED_KEEP = 6;
const BOLT_SPEED = 14;
const SEPARATION = 0.75;

export class SummonSystem {
  /** Every unit, alive or in its death puff. */
  readonly units: SummonUnit[] = [];
  stats: Record<string, SummonStats> = {};
  private pool: MinionPool;
  private bolts: BoltSet;
  private looks = new Map<string, BoltLook>();

  constructor(parent: THREE.Group, private env: SummonEnv) {
    this.pool = new MinionPool(parent);
    this.bolts = new BoltSet(parent);
  }

  /** The units of a side that are alive. */
  alive(side: SummonSide): SummonUnit[] {
    return this.units.filter((u) => u.side === side && u.alive);
  }

  /** The unit whose figure this is, if any. */
  unitOf(figure: Enemy): SummonUnit | undefined {
    return this.units.find((u) => u.figure === figure);
  }

  /** Makes the units. Honors the per-side cap; the handle's `units` holds the ones really made. */
  spawn(world: SummonWorld, o: SummonOptions): Summon {
    const handle = new Summon(world);
    const room = Math.max(0, MAX_UNITS - this.alive(world.side).length);
    const n = Math.min(Math.max(1, Math.round(o.count ?? 1)), room);
    const color = o.color ?? '#b8c4d8';
    const opts = { damage: o.damage, attackEvery: o.attackEvery, color, range: o.range ?? (o.kind === 'turret' ? 8 : 9), speed: o.speed ?? (o.kind === 'melee' ? 3.6 : 3) };
    const near = world.victims()[0];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 2;
      const r = n === 1 ? 0 : 0.7 + n * 0.1;
      const p = new THREE.Vector3(o.at.x + Math.cos(a) * r, 0, o.at.z + Math.sin(a) * r);
      this.env.place(p);
      const fx = this.pool.acquire();
      fx.setup(o.kind, color, world.side === 'hero', o.look);
      fx.group.position.copy(p);
      if (near) fx.group.rotation.y = Math.atan2(near.pos.x - p.x, near.pos.z - p.z);
      const u = new SummonUnit(fx, handle, o.kind, world.side, opts, o.hp, o.seconds);
      u.cd = 0.5 + i * 0.12;
      handle.units.push(u);
      this.units.push(u);
      this.tally(world.side).spawned++;
    }
    return handle;
  }

  /** A hit on a unit: flash, knockback, damage number, HP; it dies at 0 HP. */
  hurt(u: SummonUnit, opts: HitOptions) {
    if (!u.alive) return;
    const dmg = Math.round(opts.damage ?? THREE.MathUtils.randFloat(10, 20));
    this.tally(u.side).taken += Math.min(dmg, u.hp);
    u.hp -= dmg;
    u.flash = 1;
    u.flashTint.set(opts.color ?? '#ff8a4a');
    const knock = Math.min(opts.knock ?? 4, 6);
    if (knock > 0 && opts.from) {
      const away = new THREE.Vector3(u.pos.x - opts.from.x, 0, u.pos.z - opts.from.z);
      if (away.lengthSq() > 1e-4) u.knock.addScaledVector(away.normalize(), knock * 0.7);
    }
    this.env.say(String(dmg), opts.color ?? '#fff1dc', u.pos.clone().setY(-1.2), 0.85);
    if (u.hp <= 0) this.kill(u, true);
  }

  update(dt: number) {
    for (const u of this.units) this.step(u, dt);
    this.separate();
    this.bolts.update(dt);
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.dead >= 0 && u.figure.settled) {
        this.pool.release(u.figure);
        this.units.splice(i, 1);
      }
    }
  }

  /** Drops every unit and bolt (a new round, a new pack). */
  clear() {
    for (const u of this.units) {
      u.dead = Math.max(u.dead, 0);
      this.pool.release(u.figure);
    }
    this.units.length = 0;
    this.bolts.clear();
  }

  resetStats() {
    this.stats = {};
  }

  private tally(side: SummonSide): SummonStats {
    return (this.stats[side] ??= { spawned: 0, dealt: 0, taken: 0, slain: 0, expired: 0 });
  }

  private kill(u: SummonUnit, slain: boolean) {
    if (!u.alive) return;
    u.dead = 0;
    u.slain = slain;
    u.hp = Math.max(0, u.hp);
    u.figure.setFlash(0);
    u.figure.die();
    this.tally(u.side)[slain ? 'slain' : 'expired']++;
    u.summon.died(u);
  }

  private step(u: SummonUnit, dt: number) {
    const fx = u.figure, pos = u.pos;
    const pose: MinionPose = { time: u.age, walk: 0, swing: u.swing, shot: u.shot };
    if (!u.alive) {
      u.dead += dt;
      fx.update(dt, pose, 0, this.env.camera);
      return;
    }
    u.age += dt;
    u.left -= dt;
    if (u.left <= 0) {
      this.kill(u, false);
      fx.update(0, pose, 0, this.env.camera);
      return;
    }
    if (u.knock.lengthSq() > 1e-5) {
      pos.addScaledVector(u.knock, dt);
      u.knock.multiplyScalar(Math.exp(-dt * 7));
      this.env.place(pos);
    }
    u.flash *= Math.exp(-dt * 7);
    if (u.flash > 0.002) fx.setFlash(u.flash, u.flashTint);
    else if (u.flash > 0) { u.flash = 0; fx.setFlash(0); }
    u.cd = Math.max(0, u.cd - dt);
    u.shot = Math.max(0, u.shot - dt * 4);

    const w = u.summon.world;
    let tgt: { figure: Enemy; pos: THREE.Vector3 } | null = null, td = Infinity;
    for (const v of w.victims()) {
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z);
      if (d < td) { td = d; tgt = v; }
    }
    let walk = 0;
    if (u.swing >= 0) {
      // Mid-swing: stand and strike when it lands, if the target is still close.
      u.swing += dt / SWING_TIME;
      if (u.swing >= 1) {
        u.swing = -1;
        const v = w.victims().find((x) => x.figure === u.swingAt);
        if (v && Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) <= MELEE_REACH + 0.5) {
          this.tally(u.side).dealt += u.opts.damage;
          w.hit(v.figure, { damage: u.opts.damage, knock: 2, from: pos.clone(), color: u.opts.color, projectile: true });
        }
      }
    } else if (tgt) {
      const dx = tgt.pos.x - pos.x, dz = tgt.pos.z - pos.z;
      this.turn(fx, Math.atan2(dx, dz), dt);
      const dir = new THREE.Vector3(dx, 0, dz).divideScalar(Math.max(td, 1e-3));
      if (u.kind === 'melee') {
        if (td > MELEE_REACH) walk = this.walk(u, dir, 1, dt);
        else if (u.cd <= 0) {
          u.swing = 0;
          u.swingAt = tgt.figure;
          u.cd = u.opts.attackEvery;
        }
      } else {
        const sees = this.env.sees(pos, tgt.pos);
        if (u.kind === 'ranged') {
          if (td > RANGED_KEEP + 1 || (!sees && td > 2)) walk = this.walk(u, dir, 1, dt);
          else if (td < RANGED_KEEP - 1.5) walk = this.walk(u, dir, -1, dt);
        }
        if (u.cd <= 0 && td <= u.opts.range && sees) this.shoot(u, w, tgt.pos);
      }
    }
    pose.walk = walk;
    pose.swing = u.swing;
    pose.shot = u.shot;
    fx.update(dt, pose, u.hp / u.max, this.env.camera);
  }

  /** Walks `sign` (+1 toward, -1 away) along `dir`; returns the walk amount for the animation. */
  private walk(u: SummonUnit, dir: THREE.Vector3, sign: number, dt: number) {
    const d = this.env.slide(u.pos, dir.clone().multiplyScalar(sign));
    u.pos.addScaledVector(d, u.opts.speed * dt);
    this.env.place(u.pos);
    return 1;
  }

  private turn(fx: MinionFx, yaw: number, dt: number) {
    const r = fx.group.rotation;
    const d = Math.atan2(Math.sin(yaw - r.y), Math.cos(yaw - r.y));
    r.y += d * (1 - Math.exp(-dt * 14));
  }

  private shoot(u: SummonUnit, w: SummonWorld, at: THREE.Vector3) {
    const dir = new THREE.Vector3(at.x - u.pos.x, 0, at.z - u.pos.z).normalize();
    const proj = w.fire({
      from: u.pos.clone().addScaledVector(dir, 0.45), dir, speed: BOLT_SPEED, range: u.opts.range + 2, radius: 0.22,
      hit: { damage: u.opts.damage, knock: 0, color: u.opts.color },
    });
    const stats = this.tally(u.side), damage = u.opts.damage;
    proj.onHit(() => { stats.dealt += damage; });
    this.bolts.follow(proj, this.boltLook(u.opts.color));
    u.cd = u.opts.attackEvery;
    u.shot = 1;
  }

  /** Units do not stack on one spot. A turret never moves: the other one steps aside. */
  private separate() {
    const live = this.units.filter((u) => u.alive);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
        if (d >= SEPARATION) continue;
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        // Share the push, unless one of the two is a turret (it takes none, the other takes all).
        const shareA = a.kind === 'turret' ? 0 : b.kind === 'turret' ? 1 : 0.5;
        const push = SEPARATION - d;
        a.pos.x -= nx * push * shareA; a.pos.z -= nz * push * shareA;
        b.pos.x += nx * push * (1 - shareA); b.pos.z += nz * push * (1 - shareA);
        if (shareA > 0) this.env.place(a.pos);
        if (shareA < 1) this.env.place(b.pos);
      }
    }
  }

  private boltLook(color: string): BoltLook {
    let look = this.looks.get(color);
    if (!look) {
      const c = new THREE.Color(color), hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      const tint = (s: number, l: number) => `#${new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * s), l).getHexString()}`;
      look = { core: tint(0.7, 0.82), body: tint(1, 0.58), rim: tint(0.8, 0.12), size: 0.13, trail: 1.1, hit: tint(1, 0.6) };
      this.looks.set(color, look);
    }
    return look;
  }
}
