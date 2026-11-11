import type { NetClient } from '../net/client';
import type { BossCast, BossDebuff, RaidEvents, RaidLink, RaidSide } from './types';

const NO_EVENTS: RaidEvents = { cast() {}, phase() {}, stagger() {}, kneel() {}, stood() {}, done() {}, wall() {}, end() {} };
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
  private boss: number | undefined;

  constructor(private net: NetClient, readonly side: RaidSide, readonly maxHp: number, public brain: boolean, readonly staggerMax?: number) {}

  /**
   * Twin Flames: the boss this screen's hits, control, rewards and brain are for. It changes when that one falls; what was still
   * to be sent of hits on the fallen one is dropped. Undefined for any other fight: its messages stay as they always were.
   */
  get which() {
    return this.boss;
  }

  set which(v: number | undefined) {
    if (v !== this.boss) this.pending = 0;
    this.boss = v;
  }

  cast(c: BossCast) {
    const out = this.boss === undefined ? c : { ...c, which: this.boss };
    this.net.send({ t: 'boss_cast', ...out });
    this.on.cast(out);
  }

  damage(amount: number) {
    this.pending += amount;
  }

  stagger(points: number) {
    this.net.send({ t: 'boss_stagger', points, which: this.boss });
  }

  stood(id: number, part: number, inside: boolean) {
    this.net.send({ t: 'boss_stood', id, part, inside });
  }

  objective(id: number, part: number) {
    this.net.send({ t: 'boss_obj', id, part });
  }

  reward(key: string, id: number) {
    this.net.send({ t: 'boss_reward', key, id, which: this.boss });
  }

  addHit(id: number, part: number, amount: number) {
    this.net.send({ t: 'boss_add', id, part, amount: Math.round(amount) });
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

  revive(side: RaidSide) {
    this.net.send({ t: 'revive', side });
  }

  heroAlt(alt: boolean) {
    this.net.send({ t: 'raid_form', alt });
  }

  bossDebuff(kind: BossDebuff, amount: number, seconds: number) {
    this.net.send({ t: 'boss_debuff', kind, amount, seconds, which: this.boss });
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
      this.net.send({ t: 'boss_damage', amount: Math.round(this.pending), which: this.boss });
      this.pending = 0;
      this.clock = 0;
    }
  }
}
