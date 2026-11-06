import type { NetClient } from '../net/client';
import type { BossCast, RaidEvents, RaidLink, RaidSide } from './types';

const NO_EVENTS: RaidEvents = { cast() {}, phase() {}, stagger() {}, kneel() {}, stood() {}, wall() {}, end() {} };
/** This screen's hits on the boss go out at most this often (s), added up. */
const DAMAGE_GAP = 0.1;

/**
 * A raid for two: what the local link decides on the spot, the hub decides here. A cast goes to the other screen and also
 * plays on this one at once, because this screen's brain chose it. Everything else comes back from the hub.
 */
export class NetLink implements RaidLink {
  readonly solo = false;
  on = NO_EVENTS;
  private pending = 0;
  private clock = 0;

  constructor(private net: NetClient, readonly side: RaidSide, readonly maxHp: number, public brain: boolean) {}

  cast(c: BossCast) {
    this.net.send({ t: 'boss_cast', ...c });
    this.on.cast(c);
  }

  damage(amount: number) {
    this.pending += amount;
  }

  stagger(points: number) {
    this.net.send({ t: 'boss_stagger', points });
  }

  stood(id: number, part: number, inside: boolean) {
    this.net.send({ t: 'boss_stood', id, part, inside });
  }

  wallSaved(index: number) {
    this.net.send({ t: 'boss_wall', index });
  }

  heroDown() {
    this.net.send({ t: 'hero_down' });
  }

  heroHp(hp: number) {
    this.net.send({ t: 'raid_hp', hp: Math.round(hp) });
  }

  revive() {
    this.net.send({ t: 'revive' });
  }

  heroCast(m: Record<string, unknown>) {
    this.net.send({ t: 'cast', ...m });
  }

  heroAttack(id: number, mods: unknown) {
    this.net.send({ t: 'attack', id, mods });
  }

  tick(dt: number) {
    this.clock += dt;
    if (this.pending >= 1 && this.clock >= DAMAGE_GAP) {
      this.net.send({ t: 'boss_damage', amount: Math.round(this.pending) });
      this.pending = 0;
      this.clock = 0;
    }
  }
}
