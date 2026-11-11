import * as THREE from 'three';
import { KeepGate } from '../arenas/noonfall';
import { RING } from '../arenas/common';
import type { BuffKind, StatusKind } from '../effects/status';
import { BossBrain } from './brain';
import { RageAura } from './fxShow';
import { BossHud } from './hud';
import { Track } from './partner';
import { raidHp, raidTierFactor } from '../../server/protocol.mjs';
import { BossScript } from './script';
import { FUSE, QUICK_GAP } from './omens';
import { BULWARK, CLOSE_CALL, SUN_EATER, type RunUpgrades } from './upgrades';
import type { BossCast, BossDebuff, BossDef, BossWorld, RaidLink } from './types';

/** What each hard control is worth to the stagger gauge, per second of it. Blind counts for little. */
const STAGGER_PER_SECOND: Partial<Record<StatusKind, number>> = { stun: 22, knockup: 26, root: 14, charm: 22, sealed: 22, silence: 12, blind: 8 };
/** Slow works at half length: a boss can't be walked away from for free. */
const SLOW_SHARE = 0.5;
/** A hit's debuffs that count on both screens. The rest (Grounded, say) do nothing to a boss. */
const SHARED_DEBUFFS: readonly BuffKind[] = ['weaken', 'vulnerable'];
/** Enraged, every hit on a hero costs this much more: past it, a fight is meant to be nearly lost. */
const RAGE_HIT = 2;
/**
 * A phase that opens with a stage: the boss can't be hurt from the phase's start until the stage's cast comes and says how long. At most
 * this long (s): its pause, a kneel that landed with the phase (the brain waits it out), a message on its way.
 */
const STAGE_WAIT = 12;
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
  /** How often this phase's timed move has come, for a screen that takes the brain over. */
  private timedSeen = 0;
  /** Seconds of fight so far, from its first live frame: the enrage timer. */
  private fought = 0;
  private enraged = false;
  /** When it enrages (s): `BossDef.enrage`, later at a higher tier by as much as its HP grows, so the check stays the same. */
  private enrageAt = 0;
  /** Seconds the boss still can't be hurt or held: a stage is on. */
  private guardLeft = 0;
  /** The stage this phase opens with, until its cast comes: a screen that takes the brain over opens with it too. */
  private stageDue: string | null = null;
  /** Seconds left of the stage on now: its cast bar is its clock, and no other move takes the bar meanwhile. */
  private stageLeft = 0;
  /** Red heat round the boss once it has enraged, and the screen's slow red throb. */
  private aura: RageAura | null = null;
  private throb = 0;
  /** Long Night: the dark round this hero, over the 3D and under the HUD. */
  private night: HTMLDivElement | null = null;

  constructor(readonly def: BossDef, readonly link: RaidLink, private world: BossWorld, private seed: string, readonly hud: BossHud, private tier = 1, readonly upgrades: RunUpgrades | null = null) {
    this.script = new BossScript(def, world, link, { flash: (color, strength) => hud.flash(color, strength), guard: (s) => this.guard(s) }, tier);
    this.group.add(this.script.group);
    this.brain = link.brain ? new BossBrain(def, world, link, seed, tier) : null;
    // This tier's omens (./omens.ts). Both screens roll the same ones.
    const omen = (id: Parameters<RunUpgrades['omen']>[0]) => !def.hall && !!upgrades?.omen(id);
    if (this.brain && omen('quick')) this.brain.quick = QUICK_GAP;
    this.script.harm = upgrades?.harmMul ?? 1;
    this.script.molten = omen('molten');
    // The gold upgrades that act through the zones.
    if (!def.hall && upgrades?.has('closecall')) this.script.closeCall = () => world.nearMiss(CLOSE_CALL.seconds);
    if (!def.hall && upgrades?.has('suneater')) this.script.ateSun = () => world.shieldMe(SUN_EATER, 8, '#ffcf4a');
    if (omen('night')) {
      this.night = document.createElement('div');
      this.night.className = 'raid-night';
      this.night.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;' +
        'background:radial-gradient(circle at 50% 55%, transparent 0, transparent 17vmin, rgba(2,2,8,0.62) 34vmin, rgba(2,2,8,0.9) 60vmin);';
      document.body.append(this.night);
    }
    this.track = link.brain ? null : new Track();
    if (def.enrage) {
      this.enrageAt = def.enrage * (raidHp(def.id, false, tier) / raidHp(def.id, false, 1)) * (omen('fuse') ? FUSE : 1);
      this.aura = new RageAura(def.body.radius, def.body.height);
      this.group.add(this.aura.group);
    }
    link.on = {
      cast: (c) => this.onCast(c),
      hp: (hp) => world.setBossHp(hp),
      phase: (i) => this.onPhase(i),
      stagger: (v) => hud.setGauge(v / def.staggerMax),
      kneel: (s) => this.onKneel(s),
      stood: (id, part, count) => this.script.stood(id, part, count),
      done: (id, part, side) => this.script.done(id, part, side),
      addHit: (id, part, amount) => this.script.addHit(id, part, amount),
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
    if (c.move === this.def.phases[this.stats.phases]?.timed?.move && c.step === 0) this.timedSeen++;
    if (move.stage && c.step === 0) this.stageDue = null;
    // The body acts the move out, the one on the rim too: what it does lands with the zone.
    if (move.body) {
      const seconds = move.body.seconds * raidTierFactor(this.tier);
      if (c.rim) this.world.actRim(move.body.name, c.step, c.x, c.z, seconds);
      else this.world.act(move.body.name, c.step, c.x, c.z, seconds);
    }
    if (c.step !== 0 || move.quiet) return;
    if (move.stage) this.stageLeft = move.charge * raidTierFactor(this.tier);
    if (move.stage || this.stageLeft <= 0) this.hud.cast(move.name, move.charge * raidTierFactor(this.tier));
    this.world.enemyCast(!!move.big);
    // The pose's strike lands with the move: its time is the cast bar's, shorter at a higher tier.
    const charge = move.charge * raidTierFactor(this.tier);
    if (c.rim) this.world.poseRim(move.pose, charge, !!move.big);
    else if (!move.alongside) this.world.pose(move.pose, charge, !!move.big);
  }

  private onPhase(i: number) {
    this.stats.phases = i;
    this.brain?.setPhase(i);
    this.world.banner(this.def.phases[i].name, 2.2);
    this.world.bodyPhase(i);
    this.world.phaseShield();
    // A stage opens this phase: from now on nothing hurts the boss, until the stage's own cast takes over.
    const opener = this.def.phases[i].opener;
    if (opener && this.def.moves[opener]?.stage) {
      this.stageDue = opener;
      this.guard(STAGE_WAIT);
    }
    if (this.def.lateAt === i) this.world.lateNow();
  }

  private onKneel(seconds: number) {
    this.stats.kneels++;
    this.brain?.kneel(seconds);
    this.world.kneel(seconds);
    this.openLeft = Math.max(this.openLeft, seconds);
    this.hud.setState('KNEELING', seconds);
    if (this.upgrades?.has('bulwark') && !this.meDown) this.world.shieldMe(BULWARK, 10, '#7ab8ff');
    this.world.banner('It kneels', 1.2, '26px');
  }

  /** A big move has ended: it stands open for `seconds` (the move's look calls this through the world). */
  exposedFor(seconds: number) {
    this.openLeft = Math.max(this.openLeft, seconds);
    this.hud.setState('EXPOSED', seconds);
  }

  /** The boss can't be hurt or held for `seconds`; 0 ends it, and a stage's cast bar still filling with it. */
  guard(seconds: number) {
    this.guardLeft = Math.max(0, seconds);
    this.world.guard(this.guardLeft > 0);
    if (this.guardLeft > 0) return;
    if (this.stageLeft > 0) this.hud.stopCast();
    this.stageLeft = 0;
  }

  /** The fight ran past its enrage time: every hit costs more, and the moves come faster. */
  private enrage() {
    this.enraged = true;
    this.script.rage = RAGE_HIT;
    this.brain?.enrage();
    this.hud.setRage(0);
    this.world.banner('ENRAGED', 2.2);
    this.world.bodyRage(true);
    // It goes up: a red blast off it, over the whole floor.
    const b = this.world.boss(), show = this.script.show;
    show.ring(b.x, b.z, { radius: 18, life: 1.3, color: 0xff3018, width: 1.2 });
    show.column(b.x, b.z, { radius: this.def.body.radius * 1.6, height: this.def.body.height * 2.6, life: 1.4, color: 0xff3a1e });
    show.burst(b.x, this.def.body.height * 0.6, b.z, 60, 7, 3, 1, 0xff5a2a);
    this.hud.flash('rgba(255,40,16,0.9)', 0.45);
    this.world.shake(0.16);
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
    if (!this.def.hall && this.upgrades?.omen('quick')) this.brain.quick = QUICK_GAP;
    this.brain.resume(this.stats.phases, this.ringForm, this.rimSpot, this.timedSeen);
    if (this.enraged) this.brain.enrage();
    if (this.stageDue) this.brain.open(this.stageDue);
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
    if (this.guardLeft > 0) return 0;
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
    this.guard(0);
    this.world.bodyRage(false);
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
    this.stageLeft = Math.max(0, this.stageLeft - dt);
    if (this.guardLeft > 0) {
      this.guardLeft -= dt;
      if (this.guardLeft <= 0) this.guard(0);
    }
    this.hud.setHp(hp, this.link.maxHp);
    if (this.def.pillars) {
      const cover = this.world.cover();
      this.hud.setPillars(this.def.pillars.filter((o) => cover.includes(o)).length, this.def.pillars.length);
    }
    this.link.tick(dt);
    const s = this.track?.sample();
    if (s) this.world.place(s.x, s.z, s.yaw);
    // The first phase begins with the fight.
    if (live && !this.begun) {
      this.begun = true;
      this.world.phaseShield();
    }
    if (live && !this.over) {
      if (this.enrageAt) {
        this.fought += dt;
        const left = this.enrageAt - this.fought;
        if (left <= 0 && !this.enraged) this.enrage();
        else if (!this.enraged) this.hud.setRage(left);
      }
      this.brain?.update(dt);
    }
    if (this.aura) {
      const b = this.world.boss();
      this.aura.update(dt, b.x, b.z, this.enraged && !this.over);
    }
    // Enraged, the screen throbs a little red, slowly.
    if (this.enraged && !this.over && (this.throb -= dt) <= 0) {
      this.throb = 2.4;
      this.hud.flash('rgba(255,24,8,0.8)', 0.1);
    }
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
    // A fight left before its end (the Leave button): the next boss on this figure doesn't start red.
    this.world.bodyRage(false);
    this.night?.remove();
    this.aura?.dispose();
    this.gates?.enter.dispose();
    this.gates?.exit.dispose();
    this.script.dispose();
    this.group.removeFromParent();
    this.hud.hide();
  }
}
