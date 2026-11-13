import * as THREE from 'three';
import { MAX_UNITS, type SummonUnit } from '../../effects/summon';
import type { GameApi } from '../../runtime';
import type { TowerBoons } from '../boons';
import { leechFrom } from '../hooks';
import type { EnemySpec, PackDef, Spot } from './def';
import { lookOf } from './looks';

/**
 * A pack of a floor's enemies that waits where it stands (stage 0 of the Tower's floors as worlds, built out in stage 1A). The units are
 * the summon system's (`arena.summonFor('opponent')`), which walk to the nearest victim, strike and shoot, and never give up. So what
 * a pack adds is its life around that, all from this side:
 *
 * - **Unborn**: the units do not exist until the hero comes within `show` m of the pack's home (nothing is drawn or stepped).
 *   They go again when the hero is `hide` m away and the pack is asleep (what they lost is kept).
 * - **Asleep**: they stand still. A unit's `rate` is 0 (its swing and shot never come) and its walk speed 0; a melee unit's `goal`
 *   is its own spot, so it does not even walk on the spot. A *named* pack of one walks its patrol instead (its place is read from
 *   the floor's clock, so it is where it should be after any rebuild).
 * - **Awake**: from `wake` m, or a hit on any unit, the whole pack wakes at once: the system's own chase.
 * - **Leashed**: the hero is more than `leash` m from the pack's home: they give up and walk home by the arena's route, at full
 *   speed and striking nothing, and heal. At home they sleep again.
 * - **Cleared**: every unit fell. Stays cleared (the run keeps it).
 *
 * TOWER-HOOK (stand still, go home): the summon system has no unit that waits, and a ranged unit has no `goal`; every unit walks at the
 * nearest victim however far (src/effects/summon.ts `step`). Done from here by `rate` 0 and `opts.speed` 0 and an own walk home. The
 * system should get a unit option for it (`SummonOptions.idle` / `home` / `leash`).
 *
 * TOWER-HOOK (cap): at most `MAX_UNITS` (6) live units a side (summon.ts `spawn`), so a zone's packs are all-or-nothing and share six
 * places. The cap should be an option of `SummonSystem`, not a constant.
 *
 * TOWER-HOOK (patrol): a named enemy that walks a route while it is not hunting is moved by setting `unit.pos` each frame from the
 * route and the clock; the system has no waypoint walk for a unit that is not a hero's summon (`SummonOptions.goal` is melee only and
 * stops about 1 m short of the spot).
 */
export const PACK = { show: 18, hide: 24, wake: 9, leash: 16 } as const;

export type PackState = 'unborn' | 'asleep' | 'awake' | 'leashed' | 'cleared';

interface Slot {
  spec: EnemySpec;
  spot: THREE.Vector3;
  hp: number;
  max: number;
  alive: boolean;
  unit?: SummonUnit;
}

/** What a pack needs from the zone around it. */
export interface PackEnv {
  api: GameApi;
  boons: TowerBoons;
  enemies: Record<string, EnemySpec>;
  /** The floor's number for health: floorNumbers(n).hp. */
  hp: number;
  /** The run's clock (s). */
  now(): number;
  fell(pack: Pack, spec: EnemySpec, at: Spot): void;
  log(text: string): void;
}

export class Pack {
  state: PackState = 'unborn';
  private slots: Slot[];
  readonly seen = { born: 0, woke: 0, leashed: 0, cleared: 0 };
  /** A pack left alone for good by the tool. */
  off = false;
  /** How far the hero may be from home before the pack gives up (m). */
  leashAt: number = PACK.leash;
  /** A pack the zone makes when it needs one (a wave): awake at birth, never gives up. */
  hunter = false;
  /** The route of a patrol, for the named. */
  private patrol: { len: number; cum: number[]; pts: Spot[]; speed: number } | null = null;

  constructor(readonly def: PackDef, private env: PackEnv, cleared = false) {
    const kinds: EnemySpec[] = [];
    if (def.elite) kinds.push(env.enemies[def.elite]);
    for (const m of def.mix) for (let i = 0; i < m.n; i++) kinds.push(env.enemies[m.kind]);
    const n = kinds.length, dealt = env.boons.dealtMul(false);
    this.slots = kinds.map((spec, i) => {
      const a = (i / n) * Math.PI * 2 + 0.6, r = n === 1 ? 0 : 1.9;
      const hp = Math.max(10, Math.round((spec.hp * env.hp) / dealt));
      return { spec, spot: new THREE.Vector3(def.at.x + Math.cos(a) * r, 0, def.at.z + Math.sin(a) * r), hp, max: hp, alive: !cleared };
    });
    if (cleared) this.state = 'cleared';
    if (def.named) {
      const pts = def.named.patrol, cum = [0];
      for (let i = 0; i < pts.length; i++) {
        const b = pts[(i + 1) % pts.length];
        cum.push(cum[i] + Math.hypot(b.x - pts[i].x, b.z - pts[i].z));
      }
      this.patrol = { len: cum[pts.length], cum, pts, speed: def.named.speed };
      this.leashAt = 24;
    }
  }

  get id() {
    return this.def.id;
  }
  get total() {
    return this.slots.length;
  }
  get left() {
    return this.slots.filter((s) => s.alive).length;
  }
  get units() {
    return this.slots.flatMap((s) => (s.unit?.alive ? [s.unit] : []));
  }
  /** Where it stands (a patrol: where it walks now). */
  get home(): Spot {
    return this.patrol ? this.patrolAt(this.env.now()) : this.def.at;
  }
  get patrols() {
    return !!this.patrol;
  }
  /** Which spec a unit is. */
  specOf(u: SummonUnit) {
    return this.slots.find((s) => s.unit === u)?.spec;
  }

  /** Where the patrol is at clock `t` and which way it faces. */
  patrolAt(t: number): Spot & { yaw: number } {
    const pr = this.patrol!, d = (t * pr.speed) % pr.len;
    let i = 0;
    while (i < pr.pts.length - 1 && pr.cum[i + 1] <= d) i++;
    const a = pr.pts[i], b = pr.pts[(i + 1) % pr.pts.length], f = (d - pr.cum[i]) / Math.max(1e-6, pr.cum[i + 1] - pr.cum[i]);
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }

  /**
   * The units come to be, if the summon system has room for all of them (it holds at most `MAX_UNITS` a side: 6). `partial`: as many
   * as fit (a wave's, and the tool's).
   */
  spawn(partial = false) {
    const { api, boons } = this.env, arena = api.arena, room = MAX_UNITS - arena.summons.alive('opponent').length;
    const live = this.slots.filter((s) => s.alive).slice(0, partial ? Math.max(0, room) : undefined);
    if (live.length > room || !live.length) return false;
    const at = this.patrol ? this.patrolAt(this.env.now()) : null;
    for (const s of live) {
      const sp = s.spec;
      const look = lookOf(sp);
      if (at) s.spot.set(at.x, 0, at.z);
      const handle = arena.summonFor('opponent', {
        kind: sp.melee ? 'melee' : 'ranged', at: s.spot.clone(), hp: s.hp, seconds: 3600, damage: 30, attackEvery: sp.every, speed: sp.speed, range: sp.range ?? 9, color: sp.color,
        look: sp.scale && sp.scale !== 1 ? (kind, p) => { const l = look(kind, p); l.root.scale.multiplyScalar(sp.scale!); l.barY = (l.barY ?? 1.8) * sp.scale!; return l; } : look,
        // A melee unit asleep or on its way home walks to its own spot (where it stands, it does not walk); awake, the system's chase.
        goal: () => (this.state === 'awake' ? null : s.spot),
      }, (target, opts) => {
        if (target === arena.caster) {
          const script = api.duel.boss?.script;
          api.duel.hurtHero({ share: sp.share * (script?.rage ?? 1) * (script?.harm ?? 1), from: opts?.from ?? s.spot, move: sp.name as never });
          if (sp.net && api.duel.heroHp > 0) arena.applyStatus(arena.caster, sp.net.kind, sp.net.seconds, sp.color);
        } else arena.hit(target, opts);
      });
      const unit = handle.units[0];
      if (!unit) continue;
      s.unit = unit;
      unit.rate = 0;
      unit.opts.speed = 0;
      handle.onHurt((_, damage) => {
        leechFrom(api, damage, boons.leech);
        this.wake('hit');
      });
      handle.onDeath((dead) => {
        // A unit that went away (a pack hidden again) is no death.
        if (!dead.slain) return;
        s.alive = false;
        const where = { x: dead.pos.x, z: dead.pos.z };
        s.unit = undefined;
        this.env.fell(this, sp, where);
        if (!this.left) {
          this.state = 'cleared';
          this.seen.cleared++;
          this.env.log(`${this.id}: cleared`);
        }
      });
    }
    this.state = 'asleep';
    this.seen.born++;
    this.env.log(`${this.id}: appears`);
    if (this.hunter) this.wake('hunts');
    return true;
  }

  private hide() {
    for (const s of this.slots) {
      if (!s.unit) continue;
      s.hp = s.unit.alive ? s.unit.hp : s.hp;
      if (s.unit.alive) this.env.api.arena.summons.dismiss(s.unit);
      s.unit = undefined;
    }
    this.state = 'unborn';
  }

  /** The whole pack wakes. */
  wake(why: string) {
    if (this.state !== 'asleep' && this.state !== 'leashed') return;
    this.state = 'awake';
    this.seen.woke++;
    for (const u of this.units) {
      u.rate = 1;
      u.opts.speed = this.specOf(u)!.speed;
    }
    this.env.log(`${this.id}: wakes (${why})`);
  }

  /** Gone with the zone's fight: nothing of it is left standing. */
  dispose() {
    for (const s of this.slots) {
      if (s.unit?.alive) this.env.api.arena.summons.dismiss(s.unit);
      s.unit = undefined;
    }
  }

  /** One frame. `hero` is where the hero stands. */
  update(dt: number, hero: THREE.Vector3) {
    if (this.state === 'cleared' || this.off) return;
    const home = this.home;
    const d = Math.hypot(hero.x - home.x, hero.z - home.z);
    if (this.state === 'unborn') {
      if (d < PACK.show) this.spawn();
      return;
    }
    if (this.state === 'asleep') {
      if (d > PACK.hide && !this.hunter) { this.hide(); return; }
      if (this.patrol) {
        // It walks its route: placed from the clock, so it is where it should be after any rebuild.
        const at = this.patrolAt(this.env.now());
        for (const s of this.slots) {
          const u = s.unit;
          if (!u?.alive) continue;
          u.pos.set(at.x, 0, at.z);
          s.spot.set(at.x, 0, at.z);
          u.figure.group.rotation.y = at.yaw;
        }
      }
      if (d < PACK.wake) this.wake('near');
      return;
    }
    if (this.state === 'awake') {
      if (d > this.leashAt && !this.hunter) {
        this.state = 'leashed';
        this.seen.leashed++;
        for (const u of this.units) {
          u.rate = 0;
          u.opts.speed = 0;
        }
        this.env.log(`${this.id}: gives up`);
      }
      return;
    }
    // Leashed: home by the arena's own route, striking nothing.
    const arena = this.env.api.arena;
    let nHome = 0;
    for (const s of this.slots) {
      const u = s.unit;
      if (!u?.alive) continue;
      if (this.patrol) s.spot.set(home.x, 0, home.z);
      const to = Math.hypot(s.spot.x - u.pos.x, s.spot.z - u.pos.z);
      if (to < 0.35) { nHome++; continue; }
      const step = arena.route(u, u.pos, s.spot).point;
      const dx = step.x - u.pos.x, dz = step.z - u.pos.z, len = Math.hypot(dx, dz) || 1;
      const speed = s.spec.speed * 1.25;
      u.pos.x += (dx / len) * Math.min(len, speed * dt);
      u.pos.z += (dz / len) * Math.min(len, speed * dt);
      arena.keepInside(u.pos, 0.5);
      u.figure.group.rotation.y = Math.atan2(dx, dz);
    }
    // They heal on the way.
    for (const s of this.slots) if (s.unit?.alive) s.unit.hp = Math.min(s.unit.max, s.unit.hp + s.unit.max * 0.25 * dt);
    if (nHome === this.units.length) {
      this.state = 'asleep';
      this.env.log(`${this.id}: home`);
    } else if (d < PACK.wake) this.wake('hero came back');
  }
}
