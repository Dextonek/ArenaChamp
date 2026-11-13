import * as THREE from 'three';
import { MAX_UNITS, type SummonUnit } from '../../effects/summon';
import type { GameApi } from '../../runtime';
import { TOWER } from '../floors';
import { bite, type Bite } from '../hooks';
import { keeperLook } from '../looks';

/**
 * A pack of the Tower's keepers that waits where it stands (stage 0 of the Tower's floors as worlds). The units are the summon
 * system's (`arena.summonFor('opponent')`), which walk to the nearest victim, strike and shoot, and never give up. So what a pack
 * adds is its life around that, all from this side:
 *
 * - **Unborn**: the units do not exist until the hero comes within `show` m of the pack's home (nothing is drawn or stepped).
 *   They go again when the hero is `hide` m away and the pack is asleep (what they lost is kept).
 * - **Asleep**: they stand still. A unit's `rate` is 0 (its swing and shot never come) and its walk speed 0; a melee unit's
 *   `goal` is its own spot, so it does not even walk on the spot.
 * - **Awake**: from `wake` m, or a hit on any unit, the whole pack wakes at once: the system's own chase.
 * - **Leashed**: the hero is more than `leash` m from the pack's home: they give up and walk home by the arena's route, at full
 *   speed and striking nothing, and heal. At home they sleep again.
 * - **Cleared**: every unit fell. Stays cleared.
 *
 * TOWER-HOOK (stand still, go home): the summon system has no unit that waits, and a ranged unit has no `goal`; every unit walks at the
 * nearest victim however far (src/effects/summon.ts `step`). Done from here by `rate` 0 and `opts.speed` 0 and an own walk home. The
 * system should get a unit option for it (`SummonOptions.idle` / `home` / `leash`).
 *
 * TOWER-HOOK (cap): at most `MAX_UNITS` (6) live units a side (summon.ts `spawn`), so a zone's packs are all-or-nothing and share six
 * places. The cap should be an option of `SummonSystem`, not a constant.
 */
export const PACK = { show: 18, hide: 24, wake: 9, leash: 16 } as const;

export type PackState = 'unborn' | 'asleep' | 'awake' | 'leashed' | 'cleared';

interface Slot {
  who: Bite;
  spot: THREE.Vector3;
  /** Health to be born with: what the unit had when it went away. */
  hp: number;
  max: number;
  alive: boolean;
  unit?: SummonUnit;
}

export class Pack {
  state: PackState = 'unborn';
  private slots: Slot[];
  /** Seconds since the pack last moved (for the tool's stuck check). */
  readonly seen = { born: 0, woke: 0, leashed: 0, cleared: 0 };
  /** A pack left alone for good by the tool, to test what a bare zone costs. */
  off = false;
  /** How far the hero may be from home before the pack gives up (m): the tool raises it to keep a fight going. */
  leashAt: number = PACK.leash;

  constructor(
    private api: GameApi,
    readonly id: string,
    readonly home: { x: number; z: number },
    kinds: Bite[],
    private hooks: { fell(pack: Pack): void; log(text: string): void },
    numbers = { hp: 1 },
  ) {
    this.slots = kinds.map((who, i) => {
      const a = (i / kinds.length) * Math.PI * 2 + 0.6, r = kinds.length === 1 ? 0 : 1.9;
      const hp = Math.max(10, Math.round(TOWER[who].hp * numbers.hp));
      return { who, spot: new THREE.Vector3(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r), hp, max: hp, alive: true };
    });
  }

  get total() {
    return this.slots.length;
  }
  get left() {
    return this.slots.filter((s) => s.alive).length;
  }
  /** Every unit that exists now. */
  get units() {
    return this.slots.flatMap((s) => (s.unit?.alive ? [s.unit] : []));
  }

  /**
   * The units come to be, if the summon system has room for all of them (it holds at most `MAX_UNITS` a side: 6). `partial`: as many
   * as fit (the tool's, to have as many units as the system allows fighting at once).
   */
  spawn(partial = false) {
    const arena = this.api.arena, room = MAX_UNITS - arena.summons.alive('opponent').length;
    const live = this.slots.filter((s) => s.alive).slice(0, partial ? Math.max(0, room) : undefined);
    if (live.length > room || !live.length) return false;
    for (const s of live) {
      const u = TOWER[s.who];
      const handle = arena.summonFor('opponent', {
        kind: s.who === 'keeper' ? 'melee' : 'ranged', at: s.spot.clone(), hp: s.hp, seconds: 3600, damage: 30, attackEvery: u.every, speed: u.speed, range: 9, color: '#e0a050', look: keeperLook,
        // A melee unit asleep or on its way home walks to its own spot (where it stands, it does not walk); awake, the system's chase.
        goal: () => (this.state === 'awake' ? null : s.spot),
      }, (target, opts) => {
        if (target === arena.caster) bite(this.api, s.who, u.share, opts?.from ?? s.spot);
        else arena.hit(target, opts);
      });
      const unit = handle.units[0];
      if (!unit) continue;
      s.unit = unit;
      unit.rate = 0;
      unit.opts.speed = 0;
      handle.onHurt(() => this.wake('hit'));
      handle.onDeath((dead) => {
        // A unit that went away (a pack hidden again) is no death.
        if (!dead.slain) return;
        s.alive = false;
        s.unit = undefined;
        this.hooks.fell(this);
        if (!this.left) {
          this.state = 'cleared';
          this.seen.cleared++;
          this.hooks.log(`${this.id}: cleared`);
        }
      });
    }
    this.state = 'asleep';
    this.seen.born++;
    this.hooks.log(`${this.id}: appears`);
    return true;
  }

  private hide() {
    for (const s of this.slots) {
      if (!s.unit) continue;
      s.hp = s.unit.alive ? s.unit.hp : s.hp;
      if (s.unit.alive) this.api.arena.summons.dismiss(s.unit);
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
      u.opts.speed = TOWER[this.slots.find((s) => s.unit === u)!.who].speed;
    }
    this.hooks.log(`${this.id}: wakes (${why})`);
  }

  /** Gone with the zone's fight: nothing of it is left standing. */
  dispose() {
    for (const s of this.slots) {
      if (s.unit?.alive) this.api.arena.summons.dismiss(s.unit);
      s.unit = undefined;
    }
  }

  /** One frame. `hero` is where the hero stands. */
  update(dt: number, hero: THREE.Vector3) {
    if (this.state === 'cleared' || this.off) return;
    const d = Math.hypot(hero.x - this.home.x, hero.z - this.home.z);
    if (this.state === 'unborn') {
      if (d < PACK.show) this.spawn();
      return;
    }
    if (this.state === 'asleep') {
      if (d > PACK.hide) this.hide();
      else if (d < PACK.wake) this.wake('near');
      return;
    }
    if (this.state === 'awake') {
      if (d > this.leashAt) {
        this.state = 'leashed';
        this.seen.leashed++;
        for (const u of this.units) {
          u.rate = 0;
          u.opts.speed = 0;
        }
        this.hooks.log(`${this.id}: gives up`);
      }
      return;
    }
    // Leashed: home by the arena's own route, striking nothing.
    const arena = this.api.arena;
    let home = 0;
    for (const s of this.slots) {
      const u = s.unit;
      if (!u?.alive) continue;
      const to = Math.hypot(s.spot.x - u.pos.x, s.spot.z - u.pos.z);
      if (to < 0.35) { home++; continue; }
      const step = arena.route(u, u.pos, s.spot).point;
      const dx = step.x - u.pos.x, dz = step.z - u.pos.z, len = Math.hypot(dx, dz) || 1;
      const speed = TOWER[s.who].speed * 1.25;
      u.pos.x += (dx / len) * Math.min(len, speed * dt);
      u.pos.z += (dz / len) * Math.min(len, speed * dt);
      arena.keepInside(u.pos, 0.5);
      u.figure.group.rotation.y = Math.atan2(dx, dz);
    }
    // They heal on the way.
    for (const s of this.slots) if (s.unit?.alive) s.unit.hp = Math.min(s.unit.max, s.unit.hp + s.unit.max * 0.25 * dt);
    if (home === this.units.length) {
      this.state = 'asleep';
      this.hooks.log(`${this.id}: home`);
    } else if (d < PACK.wake) this.wake('hero came back');
  }
}
