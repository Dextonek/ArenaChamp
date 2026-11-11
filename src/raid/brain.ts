import { raidTierFactor } from '../../server/protocol.mjs';
import { seeded } from '../arenas/common';
import { seedNumber } from '../arenas/hazards/base';
import { moveTime, type BossCast, type BossDef, type BossMove, type BossWorld, type RaidLink, type RaidSide } from './types';

/** How far a boss walks between two puddles of its trail (m). */
const TRAIL_STEP = 2.4;
/** How far from the middle a tag lands at most (m). */
const LAND_REACH = 6;
/** How far ahead a boss backing away aims (m), how far it keeps from the edge of the floor, and how short a step isn't worth taking. */
const BACK_AIM = 2.5;
const BACK_EDGE = 2;
const BACK_STILL = 0.4;
/** How fast it backs away, as a share of its walk. */
const BACK_PACE = 0.8;
/** The ways it tries, turned from straight away from the hero (radians), nearest first. None of them goes back toward the hero. */
const BACK_TURNS = [0, 0.6, -0.6, 1.2, -1.2, Math.PI / 2, -Math.PI / 2];
/** Enraged, the quiet between moves is this much of what it was. */
const RAGE_GAP = 0.5;

interface Pending {
  at: number;
  move: BossMove;
  step: number;
  seed: number;
  target: RaidSide;
  alone: boolean;
  rim: boolean;
}

/**
 * The boss's mind: who it aims at, which move comes next, where it walks. It runs on one screen and sends its choices
 * as casts, so it is the only part of a fight that reads the heroes. Its rolls come from the seed, so a run can be replayed.
 *
 * A tag team (`BossDef.forms`) has one in the ring, who walks and casts as any boss does and aims at the nearer hero, and one
 * on the rim, who stands still, adds a move now and then and aims at the farther hero. A tag is a cast like any other.
 */
export class BossBrain {
  private rng: () => number;
  private time = 0;
  private wait = 1.2;
  private locked = 0;
  private pause = 0;
  private seq = 0;
  private pending: Pending[] = [];
  private ready = new Map<string, number>();
  private phase = 0;
  private opener: string | null = null;
  private last = '';
  /** When each hero (by side) was last aimed at. */
  private aimedAt: number[] = [];
  private next: RaidSide = 0;
  /** Where the last step of each move was aimed. */
  private aimed = new Map<string, { x: number; z: number; dir: number; flag?: boolean }>();

  /** How much of a move's times are left at this tier. */
  private pace: number;
  /** The moves a higher tier brings in. */
  private extra: string[];
  /** A tag team: who is in the ring, where the other stands, when it next acts, when they next swap. */
  private form = 0;
  private rim: { x: number; z: number } | null = null;
  private rimWait = 0;
  private swapWait = Infinity;
  private trailed = 0;
  /** The move that comes by the clock: when it next comes, and how many times it has come. */
  private timedWait = 0;
  private timedDone = 0;
  /** A stage is on: a kneel ends it, and the boss acts again after the kneel. */
  private staging = false;
  /** How much of the quiet between moves is left: less once enraged. */
  private rage = 1;
  /** The same for an omen (Quickened Court), for the whole fight. */
  quick = 1;
  /** A move holds the floor until then (`BossMove.holds`): only the moves it names begin, and an opener waits. */
  private heldUntil = -Infinity;
  private heldOnly: string[] = [];
  /** The hero a move that `tracks` turns to follow, until its last step. */
  private tracking: RaidSide | null = null;

  constructor(private def: BossDef, private world: BossWorld, private link: RaidLink, seed: string, tier = 1, firstId = 0) {
    this.rng = seeded(seedNumber(`${seed}-brain`));
    this.opener = def.phases[0].opener ?? null;
    this.next = link.side;
    this.seq = firstId;
    this.pace = raidTierFactor(tier);
    this.extra = (def.extra ?? []).slice(0, tier - 1);
    // The first phase's move by the clock waits its `first` too (a later phase's is set as the phase begins).
    this.timedWait = def.phases[0].timed?.first ?? 0;
    if (def.forms) {
      this.rim = def.rimSpots?.[0] ?? null;
      this.rimWait = def.phases[0].rimEvery?.[0] ?? 8;
    }
    // A move on a clock comes first this far into the fight.
    for (const m of Object.values(def.moves)) if (m.due !== undefined) this.ready.set(m.id, m.due * this.pace);
  }

  /** Taking over a fight already on: the phase as it stands, no pause and no opener, and how often the timed move has come. */
  resume(phase: number, form = 0, rim: { x: number; z: number } | null = null, timed = 0) {
    this.timedDone = timed;
    this.phase = phase;
    this.opener = null;
    this.wait = 1;
    this.form = form;
    if (rim) this.rim = rim;
    this.swapWait = this.def.phases[phase].swapEvery ?? Infinity;
    this.timedWait = this.def.phases[phase].timed?.first ?? 0;
  }

  /** A new phase: a pause, and what comes next starts over. The moves in the air go on. */
  setPhase(i: number) {
    const phase = this.def.phases[i];
    this.phase = i;
    this.pause = this.def.phasePause;
    this.pending = [];
    this.locked = 0;
    this.wait = 0;
    // A stage still to come stays: one big hit can pass two phases at once.
    this.opener = this.opener && this.def.moves[this.opener]?.stage ? this.opener : phase.opener ?? null;
    this.swapWait = phase.swapEvery ?? Infinity;
    this.timedWait = phase.timed?.first ?? 0;
    if (this.def.forms) {
      this.rimWait = Math.max(this.rimWait, this.def.phasePause + 1);
      // A stage comes first, from whoever is in the ring: the swap can wait for the next phase.
      if (phase.ring !== undefined && phase.ring !== this.form && !this.def.moves[this.opener ?? '']?.stage) this.opener = 'tag';
    }
  }

  /** Kneeling: steps not yet sent are dropped. What already shows still lands. */
  kneel(seconds: number) {
    this.pause = Math.max(this.pause, seconds);
    this.pending = [];
    this.locked = 0;
    // A stage won: the boss acts again once it gets up.
    if (this.staging) {
      this.staging = false;
      this.wait = 0;
    }
  }

  /** A move that holds the floor is in the air, with `seconds` to go (a brain that takes a fight over). */
  hold(seconds: number, only: string[]) {
    this.heldUntil = this.time + seconds;
    this.heldOnly = only;
  }

  /** The next move is this one (a stage the old brain never got to). */
  open(move: string) {
    this.opener = move;
  }

  /** The fight ran past its enrage time: less quiet between moves. */
  enrage() {
    this.rage = RAGE_GAP;
  }

  update(dt: number) {
    this.time += dt;
    for (const p of this.pending.filter((x) => x.at <= this.time)) this.send(p.move, p.step, p.seed, p.move.spread ? this.spreadSide(p.target) : p.target, p.alone, p.rim);
    this.pending = this.pending.filter((x) => x.at > this.time);
    // The one on the rim doesn't kneel, or wait for the one in the ring.
    this.rimStep(dt);
    this.timedStep(dt);
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    this.locked = Math.max(0, this.locked - dt);
    if (this.locked <= 0) this.staging = false;
    this.wait = Math.max(0, this.wait - dt);
    this.swapWait -= dt;
    if (this.locked > 0) {
      const h = this.tracking === null ? null : this.world.heroes().find((x) => x.side === this.tracking && !x.down);
      if (h) {
        const b = this.world.boss();
        this.world.face(Math.atan2(h.x - b.x, h.z - b.z));
      }
      return;
    }
    this.tracking = null;
    const up = this.world.heroes().filter((h) => !h.down);
    if (!up.length) return;
    const boss = this.world.boss();
    const off = (h: { x: number; z: number }) => Math.hypot(h.x - boss.x, h.z - boss.z);
    // A tag team's one in the ring goes for the nearer hero; anyone else for the one it aimed at less recently.
    const target = this.def.forms ? up.reduce((a, b) => (off(b) < off(a) ? b : a)) : up.find((h) => h.side === this.next) ?? up[0];
    const dist = off(target);
    if (this.swapWait <= 0 && this.wait <= 0 && this.def.moves.tag) {
      this.swapWait = this.def.phases[this.phase].swapEvery ?? Infinity;
      this.begin(this.def.moves.tag, target.side);
      return;
    }
    if (this.wait <= 0) {
      const move = this.pick(dist);
      if (move) {
        this.begin(move, target.side);
        return;
      }
    }
    const form = this.def.forms?.[this.form];
    const keep = form?.keepAt ?? this.def.keepAt, speed = form?.speed ?? this.def.speed;
    if (dist > keep) {
      this.world.walk(dt, target.x, target.z, speed);
      // What it leaves behind as it walks.
      this.trailed += speed * dt;
      if (form?.trail && this.trailed >= TRAIL_STEP) {
        this.trailed = 0;
        const m = this.def.moves[form.trail];
        if (m) this.send(m, 0, Math.floor(this.rng() * 2147483647), target.side, up.length < 2, false);
      }
    } else if (dist < (form?.backAt ?? 0)) this.backAway(dt, target, speed);
    else this.world.face(Math.atan2(target.x - boss.x, target.z - boss.z));
  }

  /** A step away from the target, still facing it, round cover and along the edge of the floor when they are in the way. Cornered, it stands. */
  private backAway(dt: number, target: { x: number; z: number }, speed: number) {
    const boss = this.world.boss(), floor = this.world.floor(), reach = floor.r - BACK_EDGE;
    const away = Math.atan2(boss.x - target.x, boss.z - target.z);
    for (const turn of BACK_TURNS) {
      let x = boss.x + Math.sin(away + turn) * BACK_AIM, z = boss.z + Math.cos(away + turn) * BACK_AIM;
      const dx = x - floor.x, dz = z - floor.z, far = Math.hypot(dx, dz);
      if (far > reach) {
        x = floor.x + (dx / far) * reach;
        z = floor.z + (dz / far) * reach;
      }
      if (Math.hypot(x - boss.x, z - boss.z) <= BACK_STILL || !this.world.canWalk(boss.x, boss.z, x, z)) continue;
      this.world.walk(dt, x, z, speed * BACK_PACE);
      break;
    }
    this.world.face(Math.atan2(target.x - boss.x, target.z - boss.z));
  }

  /** A move that comes by the clock, whatever else the boss is doing. */
  private timedStep(dt: number) {
    const timed = this.def.phases[this.phase].timed;
    if (!timed || this.timedDone >= timed.most) return;
    this.timedWait -= dt;
    if (this.timedWait > 0) return;
    const up = this.world.heroes().filter((h) => !h.down), m = this.def.moves[timed.move];
    if (!up.length || !m) return;
    this.timedWait = timed.every;
    this.timedDone++;
    this.send(m, 0, Math.floor(this.rng() * 2147483647), up[0].side, up.length < 2, false);
  }

  /** What this form can do, in the ring or from the rim, with what a higher tier adds to it. */
  private listOf(ring: boolean) {
    const forms = this.def.forms;
    if (!forms) return [...new Set([...this.def.phases[this.phase].moves, ...this.extra])];
    const who = ring ? this.form : 1 - this.form, form = forms[who];
    return [...new Set([...(ring ? form.moves : form.rimMoves), ...this.extra.filter((id) => this.def.moves[id]?.form === who)])];
  }

  private rimStep(dt: number) {
    if (!this.def.forms || !this.rim) return;
    this.rimWait -= dt;
    if (this.rimWait > 0) return;
    const every = this.def.phases[this.phase].rimEvery ?? [8, 10];
    this.rimWait = (every[0] + this.rng() * (every[1] - every[0])) * this.rage * this.quick;
    const up = this.world.heroes().filter((h) => !h.down);
    if (!up.length) return;
    const list = this.listOf(false).map((id) => this.def.moves[id]).filter((m) => m && (this.ready.get(m.id) ?? 0) <= this.time);
    if (!list.length) return;
    const m = list[Math.floor(this.rng() * list.length)];
    const rim = this.rim, off = (h: { x: number; z: number }) => Math.hypot(h.x - rim.x, h.z - rim.z);
    const target = up.reduce((a, b) => (off(b) > off(a) ? b : a));
    this.ready.set(m.id, this.time + m.cooldown);
    const seed = Math.floor(this.rng() * 2147483647);
    for (const [i, at] of (m.steps ?? [0]).entries()) {
      if (at <= 0) this.send(m, i, seed, target.side, up.length < 2, true);
      else this.pending.push({ at: this.time + at * this.pace, move: m, step: i, seed, target: target.side, alone: up.length < 2, rim: true });
    }
  }

  private pick(dist: number) {
    const { moves } = this.def;
    // A move holds the floor: an opener waits for it to land, except a stage, which calls it off.
    const held = this.time < this.heldUntil;
    if (this.opener && (!held || moves[this.opener]?.stage)) {
      const m = moves[this.opener];
      this.opener = null;
      if (m && !m.coop) return m;
    }
    // A move for two needs two heroes standing, not just two players in the room.
    const two = this.world.heroes().filter((h) => !h.down).length >= 2;
    const open = this.listOf(true)
      .map((id) => moves[id])
      .filter((m) => m && (!m.coop || two) && (this.ready.get(m.id) ?? 0) <= this.time && (m.range === undefined || dist <= m.range))
      .filter((m) => !held || this.heldOnly.includes(m.id));
    // A move on a clock doesn't wait its turn.
    const due = open.find((m) => m.due !== undefined);
    if (due) return due;
    const fresh = open.filter((m) => m.id !== this.last);
    const list = fresh.length ? fresh : open;
    return list.length ? list[Math.floor(this.rng() * list.length)] : null;
  }

  private begin(m: BossMove, side: RaidSide) {
    const gap = this.def.phases[this.phase].gap;
    this.ready.set(m.id, this.time + m.cooldown);
    this.aimedAt[side] = this.time;
    if (!m.alongside) {
      this.last = m.id;
      this.locked = m.lock * this.pace;
      this.wait = this.locked + (gap[0] + this.rng() * (gap[1] - gap[0])) * this.rage * this.quick;
    }
    if (m.stage) {
      this.staging = true;
      this.heldUntil = -Infinity;
    }
    if (m.holds) this.hold(moveTime(m, this.pace), m.holds.only);
    this.tracking = m.tracks ? side : null;
    const seed = Math.floor(this.rng() * 2147483647);
    const alone = this.world.heroes().filter((h) => !h.down).length < 2;
    if (m === this.def.moves.tag) {
      this.sendTag(m, seed, side, alone);
      this.next = this.chooseNext();
      return;
    }
    for (const [i, at] of (m.steps ?? [0]).entries()) {
      if (at <= 0) this.send(m, i, seed, side, alone, false);
      else this.pending.push({ at: this.time + at * this.pace, move: m, step: i, seed, target: side, alone, rim: false });
    }
    this.next = this.chooseNext();
  }

  /** The one on the rim lands near the fight, and the one in the ring goes up to another spot on the rim. */
  private sendTag(m: BossMove, seed: number, side: RaidSide, alone: boolean) {
    const spots = this.def.rimSpots ?? [];
    const others = spots.filter((s) => s !== this.rim);
    const spot = others[Math.floor(this.rng() * others.length)] ?? this.rim ?? { x: 0, z: 0 };
    const hero = this.world.heroes().find((h) => h.side === side) ?? { x: 0, z: 7 };
    // Toward the target from the middle, but not on top of it: the zone shows, and they can walk out.
    const dx = hero.x, dz = hero.z - 7, d = Math.hypot(dx, dz) || 1, k = Math.min(LAND_REACH, d * 0.6) / d;
    const x = dx * k, z = 7 + dz * k;
    const form = 1 - this.form;
    this.form = form;
    this.rim = spot;
    this.link.cast({
      id: ++this.seq, move: m.id, step: 0, x: +x.toFixed(3), z: +z.toFixed(3), fx: spot.x, fz: spot.z, dir: 0, seed, target: side, alone, form,
    });
  }

  /** A later step of a move that spreads: the standing hero it aimed at less recently. */
  private spreadSide(fallback: RaidSide): RaidSide {
    const up = this.world.heroes().filter((h) => !h.down).map((h) => h.side);
    if (up.length < 2) return up[0] ?? fallback;
    const side = this.chooseNext();
    this.aimedAt[side] = this.time;
    return side;
  }

  /** A move aimed at "you" takes the hero it aimed at less recently, and a seeded coin when level. */
  private chooseNext(): RaidSide {
    if (this.link.solo) return this.link.side;
    // Of the heroes standing (any number in a party), the one aimed at least recently; a seeded draw among those level.
    const up = this.world.heroes().filter((h) => !h.down).map((h) => h.side);
    if (!up.length) return this.link.side;
    const when = (side: number) => this.aimedAt[side] ?? -Infinity;
    const least = Math.min(...up.map(when));
    const level = up.filter((side) => when(side) === least).sort((a, b) => a - b);
    return level.length === 1 ? level[0] : level[Math.floor(this.rng() * level.length)];
  }

  private send(m: BossMove, step: number, seed: number, side: RaidSide, alone: boolean, rim: boolean) {
    const boss = rim && this.rim ? this.rim : this.world.boss(), ring = this.world.boss();
    const hero = this.world.heroes().find((h) => h.side === side) ?? { x: boss.x, z: boss.z };
    const aim = m.aim({
      boss: { x: boss.x, z: boss.z }, ring: { x: ring.x, z: ring.z }, target: { x: hero.x, z: hero.z }, step, seed, prev: step > 0 ? this.aimed.get(m.id) : undefined,
      rayStop: (ax, az, bx, bz) => this.world.rayStop(ax, az, bx, bz),
      cover: () => this.world.cover(),
    });
    this.aimed.set(m.id, aim);
    if (!m.alongside && !rim) this.world.face(aim.dir);
    // Its last step is off: it stops turning after its target.
    if (m.tracks && step === (m.steps?.length ?? 1) - 1) this.tracking = null;
    const cast: BossCast = {
      id: ++this.seq, move: m.id, step, x: +aim.x.toFixed(3), z: +aim.z.toFixed(3), fx: +boss.x.toFixed(3), fz: +boss.z.toFixed(3),
      dir: +aim.dir.toFixed(4), seed, target: side, alone, rim: rim || undefined, flag: aim.flag,
    };
    this.link.cast(cast);
    const still = m.act?.(this.world, cast);
    if (still) this.pause = Math.max(this.pause, still);
  }

  /** Who is in the ring and where the other stands, for a screen taking over. */
  get forms() {
    return { form: this.form, rim: this.rim };
  }
}
