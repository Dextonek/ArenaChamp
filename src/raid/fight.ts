import * as THREE from 'three';
import type { StatusKind } from '../effects/status';
import { BossBrain } from './brain';
import { BossHud } from './hud';
import { Track } from './partner';
import { raidTierFactor } from '../../server/protocol.mjs';
import { BossScript } from './script';
import type { RunUpgrades } from './upgrades';
import type { BossCast, BossDef, BossWorld, RaidLink } from './types';

/** What each hard control is worth to the stagger gauge, per second of it. Blind counts for little. */
const STAGGER_PER_SECOND: Partial<Record<StatusKind, number>> = { stun: 22, knockup: 26, root: 14, charm: 22, sealed: 22, silence: 12, blind: 8 };
/** Slow works at half length: a boss can't be walked away from for free. */
const SLOW_SHARE = 0.5;

/**
 * One boss fight on this screen: it ties the brain (if this screen runs it), the script, the HUD and the link together.
 * `Duel.startBoss` builds it and calls `update` where a duel calls its AI.
 */
export class BossFight {
  readonly group = new THREE.Group();
  readonly script: BossScript;
  private brain: BossBrain | null;
  /** The boss's walk from reports, when another screen runs its brain. */
  private track: Track | null;
  private over = false;
  /** This screen's hero has fallen. */
  meDown = false;
  /** Which move hit this hero last (the raid tool's report). */
  killedBy = '';
  /** This fight's results so far, for the raid tool. */
  stats = { hits: {} as Record<string, number>, kneels: 0, phases: 0 };

  /** Seconds the boss still stands open or kneels: Opportunist. */
  private openLeft = 0;
  private begun = false;

  constructor(readonly def: BossDef, readonly link: RaidLink, private world: BossWorld, private seed: string, readonly hud: BossHud, private tier = 1, readonly upgrades: RunUpgrades | null = null) {
    this.script = new BossScript(def, world, link, { flash: (color, strength) => hud.flash(color, strength) }, tier);
    this.group.add(this.script.group);
    this.brain = link.brain ? new BossBrain(def, world, link, seed, tier) : null;
    this.track = link.brain ? null : new Track();
    link.on = {
      cast: (c) => this.onCast(c),
      hp: (hp) => world.setBossHp(hp),
      phase: (i) => this.onPhase(i),
      stagger: (v) => hud.setGauge(v / def.staggerMax),
      kneel: (s) => this.onKneel(s),
      stood: (id, part, count) => this.script.stood(id, part, count),
      wall: (i) => world.breakWall(i),
      end: (r) => this.end(r),
    };
    hud.show(def);
    hud.setHp(link.maxHp, link.maxHp);
  }

  private onCast(c: BossCast) {
    const move = this.def.moves[c.move];
    if (!move) return;
    this.script.play(c);
    if (c.step !== 0) return;
    this.hud.cast(move.name, move.charge * raidTierFactor(this.tier));
    this.world.enemyCast(!!move.big);
    if (!move.alongside) this.world.pose(move.pose, move.charge, !!move.big);
  }

  private onPhase(i: number) {
    this.stats.phases = i;
    this.brain?.setPhase(i);
    this.world.banner(this.def.phases[i].name, 2.2);
    this.world.phaseShield();
  }

  private onKneel(seconds: number) {
    this.stats.kneels++;
    this.brain?.kneel(seconds);
    this.world.kneel(seconds);
    this.openLeft = Math.max(this.openLeft, seconds);
    this.hud.setState('KNEELING', seconds);
    this.world.banner('It kneels', 1.2, '26px');
  }

  /** A big move has ended: it stands open for `seconds` (the move's look calls this through the world). */
  exposedFor(seconds: number) {
    this.openLeft = Math.max(this.openLeft, seconds);
    this.hud.setState('EXPOSED', seconds);
  }

  /** It stands open or kneels. */
  get open() {
    return this.openLeft > 0;
  }

  /** The other screen ran the brain and left: this one takes over, at the next move. What is in the air goes on. */
  takeBrain() {
    if (this.brain) return;
    this.link.brain = true;
    this.track = null;
    this.brain = new BossBrain(this.def, this.world, this.link, `${this.seed}-next`, this.tier, 100000);
    this.brain.resume(this.stats.phases);
  }

  /** The boss's walk, reported by the screen that runs its brain. */
  bossMove(x: number, z: number, yaw: number, ts?: number) {
    this.track?.push(x, z, yaw, ts);
  }

  /**
   * A status on the boss, before it lands: hard control doesn't hold it, it fills the gauge. Returns how long the status
   * may run (0: not at all).
   */
  control(kind: StatusKind, seconds: number) {
    if (kind === 'slow') return seconds * SLOW_SHARE;
    const rate = STAGGER_PER_SECOND[kind];
    if (rate) this.link.stagger(rate * seconds * (this.upgrades?.staggerMul ?? 1));
    return 0;
  }

  /** What really came off the boss's HP on this screen. */
  damaged(amount: number) {
    if (amount > 0) this.link.damage(amount);
  }

  /** This screen's hero fell. */
  heroDown() {
    this.meDown = true;
    this.link.heroDown();
  }

  countHit(move: string) {
    this.stats.hits[move] = (this.stats.hits[move] ?? 0) + 1;
    this.killedBy = move;
  }

  private end(result: 'win' | 'lose') {
    if (this.over) return;
    this.over = true;
    this.script.clear();
    this.world.finish(result);
  }

  /** One frame. `live`: the fight is on. */
  update(dt: number, live: boolean, hp: number) {
    this.hud.update(dt);
    this.openLeft = Math.max(0, this.openLeft - dt);
    this.hud.setHp(hp, this.link.maxHp);
    this.link.tick(dt);
    const s = this.track?.sample();
    if (s) this.world.place(s.x, s.z, s.yaw);
    // The first phase begins with the fight.
    if (live && !this.begun) {
      this.begun = true;
      this.world.phaseShield();
    }
    if (live && !this.over) this.brain?.update(dt);
    this.script.update(dt, live && !this.over);
  }

  dispose() {
    this.script.dispose();
    this.group.removeFromParent();
    this.hud.hide();
  }
}
