import type { BossCast, BossDef, RaidEvents, RaidLink } from '../raid/types';

const NO_EVENTS: RaidEvents = { cast() {}, phase() {}, stagger() {}, kneel() {}, stood() {}, done() {}, wall() {}, end() {} };

/** What a mechanic done right earns on a floor (the Raid keeps its own in `RAID_REWARDS`; the Tower's floors bring theirs). */
export interface FloorReward { kneel?: boolean; stun?: number; stagger?: number; hp?: number }

/**
 * A Tower floor on one screen, with no server: what `LocalLink` is to a raid alone. It differs in three ways. Its max HP is the
 * floor's own number (a raid's comes from the server's table by the boss's id). A fall does not end the fight by itself: the climb
 * decides whether a life is left (`fell`). And a floor with nothing to hit (a horde, a room to cross, a time to hold out) ends
 * when the floor says so (`win`), with its bar moved by `spend`.
 */
export class TowerLink implements RaidLink {
  readonly solo = true;
  readonly side = 0;
  brain: boolean;
  on = NO_EVENTS;
  readonly maxHp: number;
  private hp: number;
  private phase = 0;
  private gauge = 0;
  private kneeling = 0;
  over = false;
  private paid = new Set<string>();
  /** This screen's hero fell: the climb takes a life and starts the floor again, or ends here. */
  fell: () => void = () => {};

  constructor(private def: BossDef, maxHp: number, private rewards: Record<string, FloorReward> = {}, brain = true) {
    this.maxHp = Math.max(1, Math.round(maxHp));
    this.hp = this.maxHp;
    this.brain = brain;
  }

  /** How much of the floor's bar is left, 0..1. */
  get left() {
    return this.hp / this.maxHp;
  }

  cast(c: BossCast) {
    this.on.cast(c);
  }

  damage(amount: number) {
    if (this.over) return;
    this.hp = Math.max(0, this.hp - amount);
    const share = this.hp / this.maxHp, phases = this.def.phases;
    while (this.phase < phases.length - 1 && share <= phases[this.phase + 1].at) this.on.phase(++this.phase);
    if (this.hp <= 0) this.win();
  }

  /** The floor's bar goes down by something that was no hit on the boss (one of the horde fell): the bar on screen follows. */
  spend(amount: number) {
    this.damage(amount);
    if (!this.over) this.on.hp?.(this.hp);
  }

  /** The floor's goal is done. */
  win() {
    if (this.over) return;
    this.over = true;
    this.on.end('win');
  }

  /** The climb is over: no life is left. */
  lose() {
    if (this.over) return;
    this.over = true;
    this.on.end('lose');
  }

  stagger(points: number) {
    if (this.kneeling > 0 || this.over) return;
    this.gauge += points;
    if (this.gauge >= this.def.staggerMax) {
      this.gauge = 0;
      this.kneeling = this.def.kneel;
      this.on.kneel(this.def.kneel);
    }
    this.on.stagger(this.gauge);
  }

  stood(id: number, part: number, inside: boolean) {
    this.on.stood(id, part, inside ? 1 : 0);
  }

  objective(id: number, part: number) {
    this.on.done(id, part, 0);
  }

  reward(key: string, id: number) {
    const r = this.rewards[key], once = `${id}:${key}`;
    if (!r || this.paid.has(once) || this.over) return;
    this.paid.add(once);
    if (r.hp) {
      this.damage(this.maxHp * r.hp);
      this.on.hp?.(this.hp);
    }
    if (this.over) return;
    if (r.kneel) {
      this.gauge = 0;
      this.kneeling = this.def.kneel;
      this.on.kneel(this.def.kneel);
      this.on.stagger(0);
    } else if (r.stun) {
      this.kneeling = Math.max(this.kneeling, r.stun);
      this.on.kneel(r.stun);
    } else if (r.stagger) this.stagger(r.stagger);
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
    if (!this.over) this.fell();
  }

  tick(dt: number) {
    this.kneeling = Math.max(0, this.kneeling - dt);
  }
}
