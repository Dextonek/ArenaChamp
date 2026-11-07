import * as THREE from 'three';
import { KeepGate } from '../arenas/noonfall';
import { RING } from '../arenas/common';
import type { BuffKind, StatusKind } from '../effects/status';
import { BossBrain } from './brain';
import { BossHud } from './hud';
import { Track } from './partner';
import { raidTierFactor } from '../../server/protocol.mjs';
import { BossScript } from './script';
import type { RunUpgrades } from './upgrades';
import type { BossCast, BossDebuff, BossDef, BossWorld, RaidLink } from './types';

/** What each hard control is worth to the stagger gauge, per second of it. Blind counts for little. */
const STAGGER_PER_SECOND: Partial<Record<StatusKind, number>> = { stun: 22, knockup: 26, root: 14, charm: 22, sealed: 22, silence: 12, blind: 8 };
/** Slow works at half length: a boss can't be walked away from for free. */
const SLOW_SHARE = 0.5;
/** A hit's debuffs that count on both screens. The rest (Grounded, say) do nothing to a boss. */
const SHARED_DEBUFFS: readonly BuffKind[] = ['weaken', 'vulnerable'];
const spot = new THREE.Vector3();

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
  private ringForm = 0;
  private rimSpot: { x: number; z: number } | null = null;
  /** The gate heroes came in by, lit until the fight starts, and the one out, lit once the boss falls. */
  private gates: { enter: KeepGate; exit: KeepGate } | null = null;
  private clock = 0;

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
      done: (id, part, side) => this.script.done(id, part, side),
      wall: (i) => world.breakWall(i),
      end: (r) => this.end(r),
    };
    if (!def.hall) {
      hud.show(def);
      hud.setHp(link.maxHp, link.maxHp);
    }
    if (def.gates) {
      const r = (def.place.ring ?? 12) + 1.7, tone = def.id === 'ash' ? 'ash' : 'sun';
      const gate = (deg: number) => {
        const a = THREE.MathUtils.degToRad(deg), x = RING.x + Math.sin(a) * r, z = RING.z + Math.cos(a) * r;
        const g = new KeepGate(x, z, Math.atan2(RING.x - x, RING.z - z), tone);
        this.group.add(g.group);
        return g;
      };
      this.gates = { enter: gate(def.gates.enter), exit: gate(def.gates.exit) };
      this.gates.enter.setOpen(true);
    }
  }

  private onCast(c: BossCast) {
    const move = this.def.moves[c.move];
    if (!move) return;
    // A tag team: who is in the ring and who is where, in case this screen has to take the brain over.
    if (c.form !== undefined) {
      this.ringForm = c.form;
      this.rimSpot = { x: c.fx, z: c.fz };
    }
    this.script.play(c);
    if (c.step !== 0 || move.quiet) return;
    this.hud.cast(move.name, move.charge * raidTierFactor(this.tier));
    this.world.enemyCast(!!move.big);
    if (c.rim) this.world.poseRim(move.pose, move.charge, !!move.big);
    else if (!move.alongside) this.world.pose(move.pose, move.charge, !!move.big);
  }

  private onPhase(i: number) {
    this.stats.phases = i;
    this.brain?.setPhase(i);
    this.world.banner(this.def.phases[i].name, 2.2);
    this.world.bodyPhase(i);
    this.world.phaseShield();
    if (this.def.lateAt === i) this.world.lateNow();
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
    this.brain.resume(this.stats.phases, this.ringForm, this.rimSpot);
  }

  /** The boss's walk, reported by the screen that runs its brain. */
  bossMove(x: number, z: number, yaw: number, ts?: number) {
    this.track?.push(x, z, yaw, ts);
  }

  /** A tag: the old walk means nothing now. */
  tagged() {
    if (this.track) this.track = new Track();
  }

  /**
   * A status on the boss, before it lands: hard control doesn't hold it, it fills the gauge. Returns how long the status
   * may run (0: not at all).
   */
  control(kind: StatusKind, seconds: number) {
    if (kind === 'slow') {
      this.link.bossDebuff('slow', 0, seconds * SLOW_SHARE);
      return seconds * SLOW_SHARE;
    }
    const rate = STAGGER_PER_SECOND[kind];
    if (rate) this.link.stagger(rate * seconds * (this.upgrades?.staggerMul ?? 1));
    return 0;
  }

  /** A hit from this screen's hero laid this on the boss. */
  debuffed(kind: BuffKind, amount: number, seconds: number) {
    if (SHARED_DEBUFFS.includes(kind)) this.link.bossDebuff(kind as BossDebuff, amount, seconds);
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
    this.gates?.exit.setOpen(result === 'win');
    this.hud.settle(result === 'win', this.link.maxHp);
    this.world.finish(result);
  }

  /** One frame. `live`: the fight is on. */
  update(dt: number, live: boolean, hp: number) {
    this.hud.update(dt);
    this.clock += dt;
    if (this.gates) {
      if (live) this.gates.enter.setOpen(false);
      this.gates.enter.update(dt, this.clock);
      this.gates.exit.update(dt, this.clock);
    }
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
    this.pointers(live && !this.over && !this.meDown);
  }

  /** Arrows to the gold zones and the fallen partner this hero can't see. */
  private pointers(on: boolean) {
    const list: { x: number; y: number; color: string }[] = [];
    if (on) {
      const add = (at: { x: number; z: number }, color: string) => {
        spot.set(at.x, 0, at.z).project(this.world.camera);
        list.push({ x: spot.x, y: spot.y, color });
      };
      for (const at of this.script.goldSpots()) add(at, '#ffe27a');
      const fallen = this.world.fallenPartner();
      if (fallen) add(fallen, '#8dffb0');
    }
    this.hud.pointTo(list);
  }

  dispose() {
    this.gates?.enter.dispose();
    this.gates?.exit.dispose();
    this.script.dispose();
    this.group.removeFromParent();
    this.hud.hide();
  }
}
