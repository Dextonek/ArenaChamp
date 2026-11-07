import { raidHp } from '../../server/protocol.mjs';
import type { BossCast, BossDef, RaidEvents, RaidLink } from './types';

const NO_EVENTS: RaidEvents = { cast() {}, phase() {}, stagger() {}, kneel() {}, stood() {}, wall() {}, end() {} };

/**
 * A raid on one screen, with no server: it decides on the spot what the hub decides online, and hands it straight back.
 * The fight runs through the same calls either way, so one screen is always tested first.
 */
export class LocalLink implements RaidLink {
  readonly solo = true;
  readonly side = 0;
  readonly brain = true;
  on = NO_EVENTS;
  readonly maxHp: number;
  private hp: number;
  private phase = 0;
  private gauge = 0;
  private kneeling = 0;
  private over = false;

  constructor(private def: BossDef, tier = 1) {
    this.maxHp = raidHp(def.id, false, tier);
    this.hp = this.maxHp;
  }

  cast(c: BossCast) {
    this.on.cast(c);
  }

  damage(amount: number) {
    if (this.over) return;
    this.hp = Math.max(0, this.hp - amount);
    const share = this.hp / this.maxHp;
    const phases = this.def.phases;
    while (this.phase < phases.length - 1 && share <= phases[this.phase + 1].at) this.on.phase(++this.phase);
    if (this.hp <= 0) {
      this.over = true;
      this.on.end('win');
    }
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

  // Nobody else to tell.
  heroHp() {}
  revive() {}
  heroCast() {}
  heroAttack() {}
  heroAlt() {}

  wallSaved(index: number) {
    this.on.wall(index);
  }

  heroDown() {
    if (this.over) return;
    this.over = true;
    this.on.end('lose');
  }

  tick(dt: number) {
    this.kneeling = Math.max(0, this.kneeling - dt);
  }
}
