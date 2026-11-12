import * as THREE from 'three';
import { KeepGate } from '../arenas/noonfall';
import { RING } from '../arenas/common';
import type { BuffKind, StatusKind } from '../effects/status';
import { BossBrain } from './brain';
import { RageAura } from './fxShow';
import { BossHud } from './hud';
import { Track } from './partner';
import { RAID_TWIN, raidHp, raidTierFactor } from '../../server/protocol.mjs';
import { BossScript } from './script';
import { FUSE, QUICK_GAP } from './omens';
import { FLOOD_GAP, FLOOD_HIT, FURY_GAP, FURY_HIT, OTHER_HIT, type Ghost, ghostLink, ghostWorld, twinClip } from './twin';
import { BULWARK, CLOSE_CALL, SUN_EATER, type RunUpgrades } from './upgrades';
import { moveTime, type BossCast, type BossDebuff, type BossDef, type BossWorld, type RaidLink, type TwinSetup } from './types';

/** What each hard control is worth to the stagger gauge, per second of it. Blind counts for little. */
const STAGGER_PER_SECOND: Partial<Record<StatusKind, number>> = { stun: 22, knockup: 26, root: 14, charm: 22, sealed: 22, silence: 12, blind: 8 };
/** Slow works at half length: a boss can't be walked away from for free. */
const SLOW_SHARE = 0.5;
/** A hit's debuffs that count on both screens. The rest (Grounded, say) do nothing to a boss. */
const SHARED_DEBUFFS: readonly BuffKind[] = ['weaken', 'vulnerable'];
/** Enraged, every hit on a hero costs this much more: past it, a fight is meant to be nearly lost. */
const RAGE_HIT = 2;
/** Enraged, the quiet between moves is this much of what it was (the brain's own default). */
const RAGE_GAP = 0.5;
/**
 * A phase that opens with a stage: the boss can't be hurt from the phase's start until the stage's cast comes and says how long. At most
 * this long (s): its pause, a kneel that landed with the phase (the brain waits it out), a message on its way.
 */
const STAGE_WAIT = 12;
const spot = new THREE.Vector3();

/**
 * Twin Flames on this screen (src/raid/twin.ts): both bosses' defs and scripts, which of them is this screen's enemy now, and
 * what the hub says of each. `stageUntil`: when the other's stage ends on this fight's clock, in case it becomes this screen's.
 */
interface Twin {
  half: number;
  halves: number[];
  mine: number;
  defs: [BossDef, BossDef];
  scripts: [BossScript, BossScript];
  ghosts: [Ghost, Ghost];
  hp: [number, number];
  max: [number, number];
  phase: [number, number];
  gauge: [number, number];
  dead: [boolean, boolean];
  furious: number;
  lastId: [number, number];
  stageUntil: [number, number];
  /** The other boss's walk from reports, and the red heat round it when it is furious. */
  track: Track;
  aura: RageAura;
  /** The wall of fire is out though both stand (the pit floods): the other's moves hurt this hero too. */
  open: boolean;
  /** Which of the two called the room's move whose bar is up (The Changing of the Flames), or -1: its look may put words on the bar. */
  roomBar: number;
}

/**
 * One boss fight on this screen: it ties the brain (if this screen runs it), the script, the HUD and the link together.
 * `Duel.startBoss` builds it and calls `update` where a duel calls its AI.
 */
export class BossFight {
  readonly group = new THREE.Group();
  /** The script this screen's hero is judged by. Twin Flames: the script of the boss that is this screen's enemy now. */
  script: BossScript;
  /** The boss this screen fights. Twin Flames: it becomes the other one's when this one falls. */
  def: BossDef;
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
  /** Seconds left of the stage on now, or of a move that holds the floor: its cast bar is its clock, and no other move takes the bar meanwhile. */
  private stageLeft = 0;
  /** Red heat round the boss once it has enraged, and the screen's slow red throb. */
  private aura: RageAura | null = null;
  private throb = 0;
  /** Long Night: the dark round this hero, over the 3D and under the HUD. */
  private night: HTMLDivElement | null = null;
  /** Twin Flames: the two of them on this screen. */
  private twin: Twin | null = null;
  /** How many times this screen has taken a brain over: each new brain rolls on its own. */
  private takes = 0;

  constructor(def: BossDef, readonly link: RaidLink, private world: BossWorld, private seed: string, readonly hud: BossHud, private tier = 1, readonly upgrades: RunUpgrades | null = null, setup: TwinSetup | null = null) {
    this.def = def;
    const extra = { flash: (color: string, strength: number) => hud.flash(color, strength), guard: (s: number) => this.guard(s), label: (text: string) => hud.relabel(text) };
    if (def.twin && setup) {
      // Twin Flames: a script for each of the two. The one for the boss across the wall is a ghost here (src/raid/twin.ts).
      const defs = def.twin.pair(), mine = def.twin.which;
      const ghosts: [Ghost, Ghost] = [{ on: mine !== 0 }, { on: mine !== 1 }];
      const scripts = defs.map((d, w) => {
        const ghost = ghosts[w];
        const s = new BossScript(d, ghostWorld(world, ghost), ghostLink(link, ghost), {
          flash: (color, strength) => { if (!ghost.on) hud.flash(color, strength); },
          guard: (seconds) => { if (!ghost.on) this.guard(seconds); },
          // The bar's words: this screen's own boss's, or the room's move whose bar is up, whoever called it.
          label: (text) => { if (!ghost.on || this.twin?.roomBar === w) hud.relabel(text); },
        }, tier);
        // Its zones stop at the wall of fire while it stands.
        s.clip = () => (world.twin?.wallUp() ? twinClip(d, w) : null);
        return s;
      }) as [BossScript, BossScript];
      const other = defs[1 - mine];
      this.twin = {
        half: setup.half, halves: setup.halves, mine, defs, scripts, ghosts,
        hp: [setup.hp[0], setup.hp[1]], max: [setup.hp[0], setup.hp[1]], phase: [0, 0], gauge: [0, 0], dead: [false, false], furious: -1,
        lastId: [0, RAID_TWIN.ids], stageUntil: [0, 0], track: new Track(), aura: new RageAura(other.body.radius, other.body.height), open: false, roomBar: -1,
      };
      link.which = mine;
      def.twin.sized?.([0, 1].map((h) => setup.halves.filter((x) => x === h).length) as [number, number]);
      this.script = scripts[mine];
      this.group.add(scripts[0].group, scripts[1].group, this.twin.aura.group);
    } else {
      this.script = new BossScript(def, world, link, extra, tier);
      this.group.add(this.script.group);
    }
    this.brain = link.brain ? this.newBrain(this.twin ? `${seed}-${this.twin.mine}` : seed, this.twin ? this.twin.mine * RAID_TWIN.ids : 0) : null;
    this.arm(this.script);
    if (this.omen('night')) {
      this.night = document.createElement('div');
      this.night.className = 'raid-night';
      this.night.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;' +
        'background:radial-gradient(circle at 50% 55%, transparent 0, transparent 17vmin, rgba(2,2,8,0.62) 34vmin, rgba(2,2,8,0.9) 60vmin);';
      document.body.append(this.night);
    }
    this.track = link.brain ? null : new Track();
    if (def.enrage) {
      this.enrageAt = def.enrage * (raidHp(def.id, false, tier) / raidHp(def.id, false, 1)) * (this.omen('fuse') ? FUSE : 1);
      this.aura = new RageAura(def.body.radius, def.body.height);
      this.group.add(this.aura.group);
    }
    link.on = {
      cast: (c) => this.onCast(c),
      hp: (hp, which) => this.onHp(hp, which),
      phase: (i, which) => this.onPhase(i, which),
      stagger: (v, which) => this.onGauge(v, which),
      kneel: (s, which) => this.onKneel(s, which),
      stood: (id, part, count) => this.each((s) => s.stood(id, part, count)),
      done: (id, part, side) => this.each((s) => s.done(id, part, side)),
      addHit: (id, part, amount) => this.each((s) => s.addHit(id, part, amount)),
      // Never one of the room's own walls, whoever says so.
      wall: (i) => { if (!def.place.obstacles[i]?.fixed) world.breakWall(i); },
      end: (r) => this.end(r),
      rage: (which, on) => this.onRage(which, on),
      fell: (which) => this.onFell(which),
      halves: (half, late) => this.onHalves(half, late),
    };
    if (!def.hall) {
      hud.show(def);
      hud.setHp(link.maxHp, link.maxHp);
      if (this.twin) hud.showTwin(this.twin.defs.map((d) => d.name) as [string, string], def.phases.slice(1).map((p) => p.at));
    }
    if (def.gates) {
      const out = def.gates.r ?? (def.place.ring ?? 12) + 1.7, tone = def.id === 'ash' || def.id === 'heart' ? def.id : 'sun';
      const gate = (deg: number, r = out) => {
        const a = THREE.MathUtils.degToRad(deg), x = RING.x + Math.sin(a) * r, z = RING.z + Math.cos(a) * r;
        const g = new KeepGate(x, z, Math.atan2(RING.x - x, RING.z - z), tone);
        this.group.add(g.group);
        return g;
      };
      this.gates = { enter: gate(def.gates.enter), exit: gate(def.gates.exit, def.gates.exitR) };
      this.gates.enter.setOpen(true);
    }
  }

  /** One of this tier's omens holds (./omens.ts). Both screens roll the same ones. */
  private omen(id: Parameters<RunUpgrades['omen']>[0]) {
    return !this.def.hall && !!this.upgrades?.omen(id);
  }

  /** What acts on this screen's hero through the zones: this tier's omens and the gold upgrades. On the script it is judged by. */
  private arm(script: BossScript) {
    const { def, upgrades, world } = this;
    script.harm = upgrades?.harmMul ?? 1;
    script.molten = this.omen('molten');
    if (!def.hall && upgrades?.has('closecall')) script.closeCall = () => world.nearMiss(CLOSE_CALL.seconds);
    if (!def.hall && upgrades?.has('suneater')) script.ateSun = () => world.shieldMe(SUN_EATER, 8, '#ffcf4a');
  }

  /**
   * A brain for this screen's boss. Twin Flames: while both stand it sees only the heroes of its own half (a hero the hub has no
   * half for counts as of it): across the wall of fire nobody is in reach, and once the pit floods each twin still goes for its
   * own team, so Ash's Charge fixes on a hero who has his pillars near. With the wall out and nobody of its half standing, it
   * goes for whoever is. Once one of the two has fallen the other sees everyone.
   */
  private newBrain(seed: string, firstId: number) {
    const t = this.twin, world = this.world;
    const own = () => {
      const all = world.heroes();
      if (!t || t.dead[0] || t.dead[1]) return all;
      const half = all.filter((h) => (t.halves[h.side] ?? t.mine) === t.mine);
      return world.twin?.wallUp() || half.some((h) => !h.down) ? half : all;
    };
    const mine: BossWorld = t ? { ...world, heroes: own } : world;
    const brain = new BossBrain(this.def, mine, this.link, seed, this.tier, firstId);
    if (this.omen('quick')) brain.quick = QUICK_GAP;
    return brain;
  }

  /**
   * The scripts this screen's hero must mind: its own boss's, and in Twin Flames the other's too once the wall of fire is out
   * (the pit floods). An AI keeps out of the zones of all of them (`danger`, `wary`, `stillIn`). What it goes and does, it does for
   * its own boss only (`objectiveGoal`, `standGoal`, `mustHide`): the other twin's vents and gold zones are its own team's, and
   * bots that crossed the room for them left their own fight and stood in one spot for the next thing to land. A person may still
   * take them.
   */
  private get minds(): BossScript[] {
    const t = this.twin;
    return t && t.open && !t.dead[1 - t.mine] ? [this.script, t.scripts[1 - t.mine]] : [this.script];
  }

  /** Whether (x, z) is hit, or will be within `within` seconds, by anything this hero must mind. */
  danger(x: number, z: number, within: number) {
    return this.minds.some((s) => s.danger(x, z, within));
  }

  /** A warning of a killing hit shows, from this screen's own boss. */
  get mustHide() {
    return this.script.mustHide;
  }

  /** Whether (x, z) is out of reach of every killing hit a warning shows now. */
  hidden(x: number, z: number) {
    return this.script.hidden(x, z);
  }

  /** A move is coming after whoever it aims at. */
  get wary() {
    return this.minds.some((s) => s.wary);
  }

  /** Counts the casts so far: an AI rolls its reaction once per cast. */
  get eventId() {
    return this.minds.reduce((n, s) => n + s.eventId, 0);
  }

  /** Seconds until the next beat that burns whoever walks, or Infinity. */
  get stillIn() {
    return Math.min(...this.minds.map((s) => s.stillIn));
  }

  /** The nearest spot an AI should go and take, if one shows. */
  objectiveGoal(x: number, z: number) {
    return this.script.objectiveGoal(x, z);
  }

  /** The gold zone an AI should go and stand in, if one shows. */
  standGoal(x: number, z: number) {
    return this.script.standGoal(x, z);
  }

  /** Every script of this fight: one, or Twin Flames' two. */
  private each(fn: (s: BossScript) => void) {
    if (this.twin) this.twin.scripts.forEach(fn);
    else fn(this.script);
  }

  private onCast(c: BossCast) {
    const t = this.twin, w = t ? (c.which === 0 || c.which === 1 ? c.which : t.mine) : 0;
    const def = t ? t.defs[w] : this.def, move = def.moves[c.move];
    if (!move) return;
    if (t) {
      // A cast of one that has fallen was still on its way.
      if (t.dead[w]) return;
      t.lastId[w] = Math.max(t.lastId[w], c.id);
      if (w !== t.mine) return this.otherCast(t, w, c);
    }
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
    // The pose's strike lands with the move: its time is the cast bar's, shorter at a higher tier.
    const charge = moveTime(move, raidTierFactor(this.tier));
    // A stage keeps the cast bar, and so does a move that holds the floor: the bar is its clock.
    if (move.stage || move.holds) this.stageLeft = charge;
    if (move.stage || move.holds || this.stageLeft <= 0) this.hud.cast(move.name, charge);
    // A move of the whole room: its name as a banner too.
    if (move.room) {
      if (t) t.roomBar = w;
      this.world.banner(move.name, 2.6, '26px');
    }
    this.world.enemyCast(!!move.big);
    if (c.rim) this.world.poseRim(move.pose, charge, !!move.big);
    // A move that holds the floor acts itself out, at its call and as it lands: he does other moves in between.
    else if (!move.alongside && !move.holds) this.world.pose(move.pose, charge, !!move.big);
  }

  /** Twin Flames: a cast of the boss across the wall. Its script plays it as a look, and its body acts it out where it stands. */
  private otherCast(t: Twin, w: number, c: BossCast) {
    const move = t.defs[w].moves[c.move], pace = raidTierFactor(this.tier);
    // A move of the whole room is this hero's too, whichever of the two calls it: it plays in this screen's own script.
    (move.room ? this.script : t.scripts[w]).play(c);
    if (move.body) this.world.actRim(move.body.name, c.step, c.x, c.z, move.body.seconds * pace);
    if (c.step !== 0 || move.quiet) return;
    // A move of the whole room is every screen's to see: its name on the cast bar and as a banner, and the bar stays its own.
    if (move.room && this.stageLeft <= 0) {
      const charge = moveTime(move, pace);
      t.roomBar = w;
      this.stageLeft = charge;
      this.hud.cast(move.name, charge);
      this.world.banner(move.name, 2.6, '26px');
    }
    // Its stage: until when it can't be hurt, should it become this screen's enemy meanwhile.
    if (move.stage) t.stageUntil[w] = this.clock + move.charge * pace + 0.5;
    if (!move.alongside) this.world.poseRim(move.pose, move.charge * pace, !!move.big);
  }

  /** The boss's HP from whoever keeps it. Twin Flames: of one of the two. */
  private onHp(hp: number, which?: number) {
    const t = this.twin;
    if (t && (which === 0 || which === 1)) {
      t.hp[which] = hp;
      if (which !== t.mine) return;
    }
    this.world.setBossHp(hp);
  }

  private onGauge(value: number, which?: number) {
    const t = this.twin;
    if (t && (which === 0 || which === 1)) {
      t.gauge[which] = value;
      if (which !== t.mine) return;
    }
    this.hud.setGauge(value / (this.link.staggerMax ?? this.def.staggerMax));
  }

  private onPhase(i: number, which?: number) {
    const t = this.twin;
    if (t && (which === 0 || which === 1)) {
      t.phase[which] = i;
      // Either of the two in its last phase: the lava rises for the whole room.
      if (this.def.lateAt === i) this.world.lateNow();
      if (which !== t.mine) {
        this.world.twin?.phase(i);
        if (t.defs[which].moves[t.defs[which].phases[i]?.opener ?? '']?.stage) t.stageUntil[which] = this.clock + STAGE_WAIT;
        return;
      }
    }
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
      // The stage calls off a move that held the floor and the bar (The Hour Strikes), on every screen as the phase turns.
      if (this.script.yieldFloor()) this.hud.stopCast();
      this.stageLeft = 0;
    }
    if (this.def.lateAt === i) this.world.lateNow();
  }

  private onKneel(seconds: number, which?: number) {
    const t = this.twin;
    if (t && (which === 0 || which === 1) && which !== t.mine) {
      // The one across the wall kneels: its stage, if one was on, is over.
      t.stageUntil[which] = 0;
      this.world.twin?.kneel(seconds);
      return;
    }
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
    this.rageNow();
    this.hud.setRage(0);
    this.world.banner('ENRAGED', 2.2);
    // It goes up: a red blast off it, over the whole floor.
    this.rageBlast(this.world.boss(), this.def, 1);
    this.hud.flash('rgba(255,40,16,0.9)', 0.45);
    this.world.shake(0.16);
  }

  /** A red blast off a boss that has just enraged or grown furious. */
  private rageBlast(b: { x: number; z: number }, def: BossDef, size: number) {
    const show = this.script.show;
    show.ring(b.x, b.z, { radius: 18 * size, life: 1.3, color: 0xff3018, width: 1.2 });
    show.column(b.x, b.z, { radius: def.body.radius * 1.6, height: def.body.height * 2.6 * size, life: 1.4, color: 0xff3a1e });
    show.burst(b.x, def.body.height * 0.6, b.z, 60, 7, 3, 1, 0xff5a2a);
  }

  /**
   * How angry this screen's boss is now, on the script, the brain and its body. Enraged by the clock: the fight's own rule. Twin
   * Flames: furious, when the hub says so (the other is too far ahead, or it is the last one): milder, and it can pass. The
   * stronger of the two counts, never both together.
   */
  private rageNow() {
    const t = this.twin, fury = !!t && t.furious === t.mine, flood = !!t && t.open && !t.dead[0] && !t.dead[1];
    this.script.rage = Math.max(this.enraged ? RAGE_HIT : 1, fury ? FURY_HIT : 1, flood ? FLOOD_HIT : 1);
    // The other's moves hurt this hero too once the wall is out: as angry as it is on its own screens, at `OTHER_HIT` of that.
    if (t && flood) t.scripts[1 - t.mine].rage = OTHER_HIT * Math.max(this.enraged ? RAGE_HIT : 1, t.furious === 1 - t.mine ? FURY_HIT : 1, FLOOD_HIT);
    const gap = Math.min(this.enraged ? RAGE_GAP : 1, fury ? FURY_GAP : 1, flood ? FLOOD_GAP : 1);
    if (gap < 1) this.brain?.enrage(gap);
    else this.brain?.calm();
    this.world.bodyRage(this.enraged || fury);
    if (t) this.world.twin?.rage(!t.dead[1 - t.mine] && (this.enraged || t.furious === 1 - t.mine));
  }

  /** Twin Flames: boss `which` grows furious, or calms. */
  private onRage(which: number, on: boolean) {
    const t = this.twin;
    if (!t || (which !== 0 && which !== 1)) return;
    const was = t.furious;
    t.furious = on ? which : t.furious === which ? -1 : t.furious;
    this.rageNow();
    if (!on || was === which || this.over) return;
    // Every screen is told: the half that is ahead has to wait for the other.
    const mine = which === t.mine, other = t.defs[1 - which].name;
    this.world.banner(t.dead[1 - which] ? `${t.defs[which].name} is furious` : `${t.defs[which].name} grows furious: ${other} is too far ahead`, 2.6, '22px');
    this.rageBlast(mine ? this.world.boss() : this.world.twin?.at() ?? this.world.boss(), t.defs[which], 0.6);
    if (mine) {
      this.hud.flash('rgba(255,40,16,0.9)', 0.3);
      this.world.shake(0.1);
    }
  }

  /**
   * Twin Flames: boss `which` fell. Its moves stop, the wall of fire goes out, and the other is furious to its end. If the fallen
   * one was this screen's enemy, the other takes its place: its script is a ghost no longer, and this screen's hits go to it.
   */
  private onFell(which: number) {
    const t = this.twin;
    if (!t || (which !== 0 && which !== 1) || t.dead[which]) return;
    const live = 1 - which;
    t.dead[which] = true;
    t.hp[which] = 0;
    t.scripts[which].clear();
    if (t.furious === which) t.furious = -1;
    // Both down: the end comes by itself.
    if (t.dead[live]) return;
    const switched = which === t.mine;
    if (switched) {
      // A brain of the fallen one has nothing left to run. The other's walk, heard so far for its drawn body, is this boss's now.
      this.brain = null;
      this.link.brain = false;
      this.track = t.track;
      t.track = new Track();
      t.mine = live;
      this.link.which = live;
      this.def = t.defs[live];
      t.ghosts[live].on = false;
      this.script = t.scripts[live];
      this.arm(this.script);
      this.stats.phases = t.phase[live];
      this.timedSeen = 0;
      this.stageDue = null;
      // The bar's words were the fallen one's.
      this.hud.stopCast();
      this.hud.setState('', 0);
      this.hud.setGauge(t.gauge[live] / (this.link.staggerMax ?? this.def.staggerMax));
      this.openLeft = 0;
    }
    this.world.twin?.fell(which, t.hp[live]);
    if (switched) {
      this.world.bodyPhase(t.phase[live]);
      // In its stage, it still can't be hurt: the stage goes on to its end.
      this.guard(Math.max(0, t.stageUntil[live] - this.clock));
    }
    this.rageNow();
    this.world.banner(`${t.defs[which].name} has fallen: the wall of fire goes out`, 2.8, '24px');
    this.hud.flash('rgba(255,170,90,0.8)', 0.3);
  }

  /**
   * Twin Flames, The Changing of the Flames: the hub dealt the halves again. A screen whose own half changed fights the other boss
   * from now on; one the gates shut on is dragged through the fire, and burns.
   */
  private onHalves(half: number[], late: number[]) {
    const t = this.twin, side = this.link.side;
    if (!t) return;
    // In place: the duel reads the same list.
    for (let i = 0; i < half.length; i++) t.halves[i] = half[i];
    const mine = half[side];
    if ((mine !== 0 && mine !== 1) || t.dead[0] || t.dead[1]) return;
    if (mine !== t.mine) this.swapTo(mine);
    if (!late.includes(side) || this.meDown) return;
    const wall = this.def.twin?.wall, me = this.world.me();
    this.world.banner('The gates shut on you: dragged through the fire', 2.4, '22px');
    this.hud.flash('rgba(255,90,30,0.85)', 0.4);
    this.world.hitMe({ share: RAID_TWIN.change.late, from: { x: wall?.ax ?? me.x, z: me.z }, move: 'change', big: true });
  }

  /** This screen's enemy becomes boss `live` while both stand: its script is the real one here now, and the other's a ghost. */
  private swapTo(live: number) {
    const t = this.twin!, old = t.mine;
    // A stage of the one left behind goes on without this screen; one of the new enemy's holds here now.
    if (this.guardLeft > 0) t.stageUntil[old] = this.clock + this.guardLeft;
    // A brain of the one left behind is another screen's now (the hub says whose); the walks heard of each change places.
    this.brain = null;
    this.link.brain = false;
    const heard = t.track;
    t.track = new Track();
    this.track = heard;
    t.mine = t.half = live;
    this.link.which = live;
    this.def = t.defs[live];
    t.ghosts[live].on = false;
    t.ghosts[old].on = true;
    this.script = t.scripts[live];
    this.arm(this.script);
    this.stats.phases = t.phase[live];
    this.timedSeen = 0;
    this.stageDue = null;
    this.hud.setState('', 0);
    this.hud.setGauge(t.gauge[live] / (this.link.staggerMax ?? this.def.staggerMax));
    this.openLeft = 0;
    this.world.twin?.swap(t.hp[live]);
    this.world.bodyPhase(t.phase[live]);
    this.world.twin?.phase(t.phase[old]);
    this.guardLeft = 0;
    this.world.guard(false);
    const left = t.stageUntil[live] - this.clock;
    if (left > 0) this.guard(left);
    this.rageNow();
    this.world.banner(`You cross to ${this.def.name}`, 2.2, '24px');
  }

  /** Twin Flames, for the tools: which boss is this screen's enemy, and what is known of both. */
  get twins() {
    const t = this.twin;
    return t ? { half: t.half, mine: t.mine, hp: [...t.hp], max: [...t.max], phase: [...t.phase], furious: t.furious, dead: [...t.dead], open: t.open, halves: [...t.halves] } : null;
  }

  /** Twin Flames: which of the two is this screen's enemy now, or undefined. */
  get which() {
    return this.twin?.mine;
  }

  /** It stands open or kneels. */
  get open() {
    return this.openLeft > 0;
  }

  /**
   * The other screen ran the brain and left: this one takes over, at the next move. What is in the air goes on. Twin Flames:
   * `which` names the boss, and only its own side's screens can run it.
   */
  takeBrain(which?: number) {
    const t = this.twin;
    if (this.brain || (t && which !== undefined && which !== t.mine)) return;
    this.link.brain = true;
    this.track = null;
    this.takes++;
    // Twin Flames: ids go on from the last one heard of this boss, inside its own range.
    this.brain = this.newBrain(t ? `${this.seed}-${t.mine}-next${this.takes}` : `${this.seed}-next`, t ? t.lastId[t.mine] + 1000 : 100000);
    this.brain.resume(this.stats.phases, this.ringForm, this.rimSpot, this.timedSeen);
    this.rageNow();
    if (this.stageDue) this.brain.open(this.stageDue);
    // A move that holds the floor is in the air: the new brain keeps to it too.
    const held = this.script.held;
    if (held) this.brain.hold(held.left, held.only);
  }

  /** The hub gave the brain to another screen (this one went quiet): this one follows reports again. What is in the air goes on. */
  dropBrain(which?: number) {
    const t = this.twin;
    if (!this.brain || (t && which !== undefined && which !== t.mine)) return;
    this.brain = null;
    this.link.brain = false;
    this.track = new Track();
  }

  /** The boss's walk, reported by the screen that runs its brain. Twin Flames: `which` of the two. */
  bossMove(x: number, z: number, yaw: number, ts?: number, which?: number) {
    const t = this.twin;
    if (t && which !== undefined && which !== t.mine) t.track.push(x, z, yaw, ts);
    else this.track?.push(x, z, yaw, ts);
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
    this.each((s) => s.clear());
    this.guard(0);
    this.world.bodyRage(false);
    this.world.twin?.rage(false);
    this.gates?.exit.setOpen(result === 'win');
    this.hud.settle(result === 'win', this.link.maxHp);
    if (this.twin && result === 'win') {
      this.twin.hp = [0, 0];
      this.hud.setTwin({ ...this.twin, hp: [0, 0], dead: [true, true], furious: -1 });
    }
    this.world.finish(result);
  }

  /** One frame. `live`: the fight is on. */
  update(dt: number, live: boolean, hp: number) {
    const t = this.twin;
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
    if (t && !this.over) {
      // This screen's own boss as its hits have left it; the other as the hub says.
      t.hp[t.mine] = hp;
      this.hud.setTwin(t);
      // The pit floods: the wall of fire is out for good, and from now on both of them hurt this hero.
      if (!t.open && this.def.twin?.open?.()) {
        t.open = true;
        for (const g of t.ghosts) g.open = true;
        this.rageNow();
        if (!t.dead[0] && !t.dead[1]) this.world.banner('The wall of fire goes out: the pit floods', 2.8, '24px');
        this.hud.flash('rgba(255,170,90,0.8)', 0.3);
      }
    } else if (!t) this.hud.setHp(hp, this.link.maxHp);
    if (this.def.pillars) {
      const cover = this.world.cover();
      this.hud.setPillars(this.def.pillars.filter((o) => cover.includes(o)).length, this.def.pillars.length);
    } else this.hud.setPillars(0, 0);
    this.link.tick(dt);
    const s = this.track?.sample();
    if (s) this.world.place(s.x, s.z, s.yaw);
    const s2 = t && !t.dead[1 - t.mine] ? t.track.sample() : null;
    if (s2) this.world.twin?.place(s2.x, s2.z, s2.yaw);
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
    const hot = this.enraged || (!!t && t.furious === t.mine);
    if (this.aura) {
      const b = this.world.boss();
      this.aura.update(dt, b.x, b.z, hot && !this.over);
    }
    if (t) {
      const b = this.world.twin?.at() ?? this.world.boss(), o = 1 - t.mine;
      t.aura.update(dt, b.x, b.z, !t.dead[o] && (this.enraged || t.furious === o) && !this.over);
    }
    // Enraged, the screen throbs a little red, slowly.
    if (hot && !this.over && (this.throb -= dt) <= 0) {
      this.throb = 2.4;
      this.hud.flash('rgba(255,24,8,0.8)', this.enraged ? 0.1 : 0.06);
    }
    this.each((sc) => sc.update(dt, live && !this.over));
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
      for (const s of this.minds) for (const at of s.goldSpots()) add(at, '#ffe27a');
      // In a party's wide room the boss itself can be out of sight.
      if ((this.def.place.ring ?? 0) > 18) add(this.world.boss(), '#ff8a4a');
      const fallen = this.world.fallenPartner();
      if (fallen) add(fallen, '#8dffb0');
    }
    this.hud.pointTo(list);
  }

  dispose() {
    // A fight left before its end (the Leave button): the next boss on this figure doesn't start red.
    this.world.bodyRage(false);
    this.world.twin?.rage(false);
    this.night?.remove();
    this.aura?.dispose();
    this.twin?.aura.dispose();
    this.gates?.enter.dispose();
    this.gates?.exit.dispose();
    this.each((s) => s.dispose());
    this.group.removeFromParent();
    this.hud.hide();
  }
}
