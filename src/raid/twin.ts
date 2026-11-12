import { RAID_BOSSES, RAID_REWARDS, RAID_TWIN, raidHp, raidScale, raidStaggerMax } from '../../server/protocol.mjs';

/** The Changing of the Flames on one screen (`TwinLocalLink`): the call in the air. */
interface LocalChange { id: number; until: number; crossed: boolean }
import type { TelegraphClip } from '../effects/telegraph';
import type { BossCast, BossDef, BossWorld, RaidEvents, RaidLink } from './types';

/**
 * Twin Flames (pipeline/designs/raid-party.md): a party fights Ash and Ember both at once, one on each side of a wall of fire.
 *
 * How one screen plays two bosses without the engine knowing: each boss has its own `BossScript`. The script of the boss on this
 * hero's side is the real one. The other boss's script runs behind a **ghost** world and link: it draws every zone and look of
 * the other fight, cut off at the wall, but this hero stands in none of them, is hit by none, takes no spot of theirs and
 * reports nothing, and none of their side effects (a stage's guard, a hint, a drag, a flash) reach this screen's own fight. When
 * this screen's boss falls, the other's script stops being a ghost and its boss becomes this screen's enemy (`BossFight`).
 */

/** A furious one (the other is too far ahead, or it is the last): every hit of its costs this much more, and this much of the quiet between its moves is left. */
export const FURY_HIT = 1.5;
export const FURY_GAP = 0.6;

/** Once the pit floods (the wall of fire out, both still standing) each of the two hits this much harder, and this much of the quiet between its moves is left. */
export const FLOOD_HIT = 1.25;
export const FLOOD_GAP = 0.8;

/**
 * Whether a script is a ghost now. One object per script, switched by the fight. `open`: the wall of fire is out though both
 * stand (the pit floods): a ghost's zones then hit this hero, its adds and spots are this hero's to take, and its gold zones
 * count it. It is still not this screen's enemy: it runs no brain here, pays no reward, and nothing of it acts on this screen's boss.
 */
export interface Ghost { on: boolean; open?: boolean }

/** The line boss `which`'s zones are cut off at while the wall of fire stands: its own side of it. */
export function twinClip(def: BossDef, which: number): TelegraphClip {
  const n = which ? 1 : -1;
  return { nx: n, nz: 0, d: -n * (def.twin?.wall.ax ?? 0) };
}

/** The world as the other boss's script sees it: this hero is not there, and nothing of theirs acts on this screen. */
export function ghostWorld(world: BossWorld, ghost: Ghost): BossWorld {
  /** Across the wall of fire: this hero is not there. */
  const away = () => ghost.on && !ghost.open;
  return {
    ...world,
    down: () => away() || world.down(),
    hitMe: (h) => { if (!away()) world.hitMe(h); },
    units: () => (away() ? [] : world.units()),
    carryMe: (dx, dz) => { if (!away()) world.carryMe(dx, dz); },
    hint: (text) => { if (!away()) world.hint(text); },
    heavy: (on) => { if (!away()) world.heavy(on); },
    mute: (on) => { if (!away()) world.mute(on); },
    shake: (amount) => { if (!away()) world.shake(amount); },
    // What a move does to its own boss never reaches this screen's.
    exposed: (seconds) => { if (!ghost.on) world.exposed(seconds); },
  };
}

/** The link as the other boss's script sees it: it says nothing to anyone, and runs no brain. */
export function ghostLink(link: RaidLink, ghost: Ghost): RaidLink {
  const quiet = () => {};
  const away = () => ghost.on && !ghost.open;
  return {
    solo: link.solo,
    side: link.side,
    maxHp: link.maxHp,
    get brain() { return !ghost.on && link.brain; },
    set brain(_v: boolean) { /* the fight sets it on the real link */ },
    on: link.on,
    cast: quiet, damage: quiet, stagger: quiet, heroDown: quiet, heroHp: quiet, revive: quiet, bossDebuff: quiet, heroAlt: quiet, heroCast: quiet, heroAttack: quiet, tick: quiet,
    stood: (id, part, inside) => { if (!away()) link.stood(id, part, inside); },
    objective: (id, part) => { if (!away()) link.objective(id, part); },
    reward: (key, id) => { if (!ghost.on) link.reward(key, id); },
    addHit: (id, part, amount) => { if (!away()) link.addHit(id, part, amount); },
    wallSaved: (index) => { if (!away()) link.wallSaved(index); },
  };
}

const NO_EVENTS: RaidEvents = { cast() {}, phase() {}, stagger() {}, kneel() {}, stood() {}, done() {}, wall() {}, end() {} };

interface Pool { hp: number; max: number; phase: number; gauge: number; kneeling: number; dead: boolean }

/**
 * Twin Flames on one screen, with no server: it keeps the two HP pools and decides what the hub decides (server/hub.mjs), so
 * the fight can be checked and looked at without a party (`_raidTwin` in pipeline/tools/raid-check.js). This screen's hero is in
 * one half and runs its boss's brain; the other boss has no brain here and stands where it is. `hurt` and `control` stand in
 * for what the other half of the party does.
 */
export class TwinLocalLink implements RaidLink {
  readonly solo = false;
  readonly side = 0;
  brain = true;
  on = NO_EVENTS;
  readonly maxHp: number;
  readonly staggerMax: number;
  /** The boss this screen's hits and control go to. */
  which: number;
  readonly pools: [Pool, Pool];
  /** Who is furious now, or -1. */
  fury = -1;
  private over = false;
  private paid = new Set<string>();
  private clock = 0;
  /** The Changing of the Flames in the air: this screen's hero is the one marked. */
  private change: LocalChange | null = null;

  constructor(private def: BossDef, readonly band = 10, half = 0, tier = 1) {
    this.maxHp = Math.round(raidHp(def.id, band, tier) / 2);
    this.staggerMax = raidStaggerMax(def.id, band) / 2;
    this.which = half;
    const pool = (): Pool => ({ hp: this.maxHp, max: this.maxHp, phase: 0, gauge: 0, kneeling: 0, dead: false });
    this.pools = [pool(), pool()];
  }

  /** What a twin fight is told when it starts, as the hub's `raid_stage` says it. */
  get setup() {
    return { half: this.which, halves: [this.which], hp: [this.maxHp, this.maxHp] as [number, number] };
  }

  cast(c: BossCast) {
    this.on.cast(c.which === undefined ? { ...c, which: this.which } : c);
  }

  damage(amount: number) {
    this.hurt(this.which, amount);
  }

  /** This much comes off boss `which`: its phases, who is furious, its fall, and the win when both are dead. */
  hurt(which: number, amount: number) {
    const p = this.pools[which];
    if (this.over || p.dead) return;
    p.hp = Math.max(0, p.hp - amount);
    const phases = RAID_BOSSES[this.def.id as keyof typeof RAID_BOSSES].phases;
    while (p.phase < phases.length && p.hp / p.max <= phases[p.phase]) this.on.phase(++p.phase, which);
    this.on.hp?.(p.hp, which);
    if (p.hp <= 0) {
      p.dead = true;
      this.on.fell?.(which);
      if (this.pools[1 - which].dead) {
        this.over = true;
        this.on.end('win');
        return;
      }
      // The other is this screen's enemy now.
      this.which = 1 - which;
    }
    this.furyNow();
  }

  private furyNow() {
    const [a, b] = this.pools, gap = a.hp / a.max - b.hp / b.max;
    let fury = this.fury;
    if (a.dead || b.dead) fury = a.dead ? 1 : 0;
    else if (Math.abs(gap) > RAID_TWIN.gapOn) fury = gap > 0 ? 0 : 1;
    else if (Math.abs(gap) <= RAID_TWIN.gapOff || (fury >= 0 && (gap > 0 ? 0 : 1) !== fury)) fury = -1;
    if (fury === this.fury) return;
    if (this.fury >= 0) this.on.rage?.(this.fury, false);
    this.fury = fury;
    if (fury >= 0) this.on.rage?.(fury, true);
  }

  stagger(points: number) {
    this.control(this.which, points);
  }

  /** Points on boss `which`'s gauge: a full one kneels. */
  control(which: number, points: number) {
    const p = this.pools[which];
    if (p.kneeling > 0 || this.over || p.dead) return;
    p.gauge += points;
    if (p.gauge >= this.staggerMax) {
      p.gauge = 0;
      p.kneeling = this.def.kneel;
      this.on.kneel(this.def.kneel, which);
    }
    this.on.stagger(p.gauge, which);
  }

  stood(id: number, part: number, inside: boolean) {
    this.on.stood(id, part, inside ? 1 : 0);
  }

  objective(id: number, part: number) {
    const ch = this.change, C = RAID_TWIN.change;
    // The Changing of the Flames: who is marked is the hub's to say, and this hero crosses once, while the gates are open.
    if (ch && id === ch.id && part >= C.mark && (part !== C.cross + this.side || ch.crossed || this.clock > ch.until)) return;
    this.on.done(id, part, 0);
    if (ch && id === ch.id && part === C.cross + this.side) this.deal(false);
  }

  /** This screen's hero is dealt into the other half, as the hub deals a seat. `late`: the gates shut on it. */
  private deal(late: boolean) {
    const ch = this.change;
    if (!ch || ch.crossed || this.over || this.pools[0].dead || this.pools[1].dead) return;
    ch.crossed = true;
    this.on.halves?.([1 - this.which], late ? [this.side] : []);
  }

  reward(key: string, id: number) {
    const table = RAID_REWARDS[this.def.id as keyof typeof RAID_REWARDS] as Record<string, { hp?: number; stagger?: number; kneel?: boolean; stun?: number; swap?: boolean }>;
    const r = table?.[key], once = `${id}:${key}`, which = this.which, p = this.pools[which];
    if (!r || this.paid.has(once) || this.over) return;
    this.paid.add(once);
    if (r.swap) {
      // The hub marks every second hero of a half: of one screen's one hero, that one.
      const C = RAID_TWIN.change;
      if (this.change && this.clock < this.change.until + C.rest) return;
      this.change = { id, until: this.clock + C.warn + C.open, crossed: false };
      this.on.done(id, C.mark + this.side, this.side);
      return;
    }
    if (r.hp) this.hurt(which, p.max * r.hp);
    if (this.over || p.dead) return;
    if (r.kneel) {
      p.gauge = 0;
      p.kneeling = this.def.kneel;
      this.on.kneel(this.def.kneel, which);
      this.on.stagger(0, which);
    } else if (r.stun) {
      p.kneeling = Math.max(p.kneeling, r.stun);
      this.on.kneel(r.stun, which);
    } else if (r.stagger) this.control(which, (r.stagger * raidScale(this.band)) / 2);
  }

  // Nobody else to tell.
  addHit() {}
  heroHp() {}
  revive() {}
  heroCast() {}
  heroAttack() {}
  heroAlt() {}
  bossDebuff() {}

  wallSaved(index: number) {
    this.on.wall(index);
  }

  heroDown() {
    if (this.over) return;
    this.over = true;
    this.on.end('lose');
  }

  tick(dt: number) {
    this.clock += dt;
    for (const p of this.pools) p.kneeling = Math.max(0, p.kneeling - dt);
    // The gates shut on a marked hero that did not cross.
    if (this.change && !this.change.crossed && this.clock > this.change.until + 0.3) this.deal(true);
  }
}
