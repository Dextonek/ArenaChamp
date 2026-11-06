import * as THREE from 'three';
import type { StatusKind } from '../effects/status';
import { BossBrain } from './brain';
import { BossHud } from './hud';
import { BossScript } from './script';
import type { BossCast, BossDef, BossWorld, RaidLink } from './types';

/** What each hard control is worth to the stagger gauge, per second of it. Blind counts for little. */
const STAGGER_PER_SECOND: Partial<Record<StatusKind, number>> = { stun: 22, knockup: 26, root: 14, charm: 22, sealed: 22, silence: 12, blind: 8 };
/** Slow works at half length: a boss can't be walked away from for free. */
const SLOW_SHARE = 0.5;
/** How long a big move leaves it open (s), and what that and kneeling add to the damage it takes. */
export const EXPOSED_TAKEN = 0.5;

/**
 * One boss fight on this screen: it ties the brain (if this screen runs it), the script, the HUD and the link together.
 * `Duel.startBoss` builds it and calls `update` where a duel calls its AI.
 */
export class BossFight {
  readonly group = new THREE.Group();
  readonly script: BossScript;
  private brain: BossBrain | null;
  private over = false;
  /** Which move felled the hero last (the raid tool's report). */
  killedBy = '';
  /** This fight's results so far, for the raid tool. */
  stats = { hits: {} as Record<string, number>, kneels: 0, phases: 0 };

  constructor(readonly def: BossDef, readonly link: RaidLink, private world: BossWorld, seed: string, readonly hud: BossHud) {
    this.script = new BossScript(def, world, link, { flash: (color, strength) => hud.flash(color, strength) });
    this.group.add(this.script.group);
    this.brain = link.brain ? new BossBrain(def, world, link, seed) : null;
    link.on = {
      cast: (c) => this.onCast(c),
      phase: (i) => this.onPhase(i),
      stagger: (v) => hud.setGauge(v / def.staggerMax),
      kneel: (s) => this.onKneel(s),
      stood: (id, part, held) => this.script.stood(id, part, held),
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
    this.hud.cast(move.name, move.charge);
    this.world.enemyCast(!!move.big);
    if (!move.alongside) this.world.pose(move.pose, move.charge, !!move.big);
  }

  private onPhase(i: number) {
    this.stats.phases = i;
    this.brain?.setPhase(i);
    this.world.banner(this.def.phases[i].name, 2.2);
  }

  private onKneel(seconds: number) {
    this.stats.kneels++;
    this.brain?.kneel(seconds);
    this.world.kneel(seconds);
    this.hud.setState('KNEELING', seconds);
    this.world.banner('It kneels', 1.2, '26px');
  }

  /** A big move has ended: it stands open for `seconds` (the move's look calls this through the world). */
  exposedFor(seconds: number) {
    this.hud.setState('EXPOSED', seconds);
  }

  /**
   * A status on the boss, before it lands: hard control doesn't hold it, it fills the gauge. Returns how long the status
   * may run (0: not at all).
   */
  control(kind: StatusKind, seconds: number) {
    if (kind === 'slow') return seconds * SLOW_SHARE;
    const rate = STAGGER_PER_SECOND[kind];
    if (rate) this.link.stagger(rate * seconds);
    return 0;
  }

  /** What really came off the boss's HP on this screen. */
  damaged(amount: number) {
    if (amount > 0) this.link.damage(amount);
  }

  /** This screen's hero fell. */
  heroDown(move: string) {
    this.killedBy = move;
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
    this.hud.setHp(hp, this.link.maxHp);
    this.link.tick(dt);
    if (live && !this.over) this.brain?.update(dt);
    this.script.update(dt, live && !this.over);
  }

  dispose() {
    this.script.dispose();
    this.group.removeFromParent();
    this.hud.hide();
  }
}
