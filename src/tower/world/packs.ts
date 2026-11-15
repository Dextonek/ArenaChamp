import * as THREE from 'three';
import { WORLD_PACKS, packScale } from '../../../server/protocol.mjs';
import type { Enemy } from '../../effects/common';
import type { HitOptions } from '../../effects/targeting';
import { TelegraphLayer, type TelegraphShape } from '../../effects/telegraph';
import type { BrainTools, SummonBrain, SummonOthers, SummonUnit } from '../../effects/summon';
import type { PackReport } from '../../net/world';
import type { GameApi } from '../../runtime';
import type { TowerBoons } from '../boons';
import { leechFrom } from '../hooks';
import type { EnemySpec, PackDef, Spot } from './def';
import { lookOf } from './looks';
import { Glide } from './others';
import { BLOW, PackMind, roleOf } from './tactics';

/**
 * A pack of a floor's enemies that waits where it stands (stage 0 of the Tower's floors as worlds, built out in stage 1A). The units are
 * the summon system's (`arena.summonFor('opponent')`), which walk to the nearest victim, strike and shoot, and never give up. So what
 * a pack adds is its life around that, all from this side:
 *
 * - **Unborn**: the units do not exist until the hero comes within `show` m of the pack's home (nothing is drawn or stepped).
 *   They go again when the hero is `hide` m away and the pack is asleep (what they lost is kept).
 * - **Asleep**: they stand still. A unit's `rate` is 0 (its swing and shot never come) and its walk speed 0; a melee unit's `goal`
 *   is its own spot, so it does not even walk on the spot. A *named* pack of one walks its patrol instead (its place is read from
 *   the floor's clock, so it is where it should be after any rebuild).
 * - **Awake**: from `wake` m, or a hit on any unit, the whole pack wakes at once: the system's own chase.
 * - **Leashed**: the hero is more than `leash` m from the pack's home: they give up and walk home by the arena's route, at full
 *   speed and striking nothing, and heal. At home they sleep again.
 * - **Cleared**: every unit fell. Stays cleared (the run keeps it).
 *
 * **Shared (the open world, stage 2: pipeline/designs/climb-open-world.md).** With a link to the floor's shard (`PackEnv.link`, share.ts)
 * a pack has a `mode`. `local`: this screen's alone, as above (not signed in, alone, or nobody runs it). A pack woken here is claimed;
 * the first to claim it runs it (`owned`): the same pack as above, whose victims are also the other players' heroes in its fight (its
 * blows on them go to their screens), who hears the others' hits, gives up only when no hero is near, and is set for the players in its
 * fight (`scale`: health x (1 + 0.6 (n - 1)), blows x (1 + 0.15 (n - 1)), only ever up, the health lost keeping its share). On the other
 * screens it is a `mirror`: the same units made the same way (`spawn`, `lookOf`: a change of a figure shows on both), with no mind,
 * placed from the owner's reports and played back a little late as the other players are, their red zones drawn from the reports; a
 * hit on one goes to the owner. A kill counts for whoever hit the unit in its last `WORLD_PACKS.hitS` s (`credited`).
 *
 * TOWER-HOOK (stand still, go home): the summon system has no unit that waits, and a ranged unit has no `goal`; every unit walks at the
 * nearest victim however far (src/effects/summon.ts `step`). Done from here by `rate` 0 and `opts.speed` 0 and an own walk home. The
 * system should get a unit option for it (`SummonOptions.idle` / `home` / `leash`).
 *
 * TOWER-HOOK (cap): at most `arena.summons.cap` live units a side (6 unless another player's packs are drawn: share.ts), so a zone's
 * packs are all-or-nothing and share those places.
 *
 * TOWER-HOOK (patrol): a named enemy that walks a route while it is not hunting is moved by setting `unit.pos` each frame from the
 * route and the clock; the system has no waypoint walk for a unit that is not a hero's summon (`SummonOptions.goal` is melee only and
 * stops about 1 m short of the spot).
 */
export const PACK = { show: 18, hide: 24, wake: 9, leash: 16 } as const;

export type PackState = 'unborn' | 'asleep' | 'awake' | 'leashed' | 'cleared';
/** Whose screen runs the pack: this one alone, this one for the shard, or another (this one draws it). */
export type PackMode = 'local' | 'owned' | 'mirror';

/** A copy is drawn while this screen's hero is within this of the pack (m): a little past `hide`, so it does not blink at the edge. */
const MIRROR_HIDE = PACK.hide + 6;
/** The other players' heroes a pack run here fights: those within this of it (m). */
const FIGHT_R = 30;
/** A hit on a copy shows on its bar at once; the owner's word that comes in this soon after (ms) cannot heal it back. */
const PREDICT_MS = 400;

interface Slot {
  spec: EnemySpec;
  spot: THREE.Vector3;
  hp: number;
  max: number;
  alive: boolean;
  unit?: SummonUnit;
  /** When this screen's hero (or its units) last hit it, and (run here) when another player did (performance.now ms). */
  mineAt: number;
  othersAt: number;
  /** Bolts it fired (run here), and how many of the owner's this copy has drawn (-1: none heard yet). */
  shots: number;
  seenShots: number;
  /** A copy: its places from the owner, the last report of it, its health held down for a moment after a hit here, its blow drawn. */
  glide?: Glide;
  rep?: number[];
  predUntil: number;
  predHp: number;
  swingT: number;
  lastSwing: number;
  /** Where it stood at the last report (run here: whether it walks). */
  lx: number;
  lz: number;
  /** A copy's meshes whose shadow was turned off (given back when it runs here again). */
  shadowless?: THREE.Object3D[];
}

/** What a shared pack needs of the floor's shard (share.ts `PackShare`). */
export interface PackLink {
  /** In a shard now (signed in, connected, the roster came): a pack woken here is claimed. */
  readonly on: boolean;
  /** The hub's table has this pack (a pack a zone makes for itself, a wave, is never shared). */
  knows(id: string): boolean;
  claim(p: Pack): void;
  /** The other players' heroes that are up, where this screen draws them. */
  heroes(): readonly { figure: Enemy; pos: THREE.Vector3 }[];
  isHero(f: Enemy): boolean;
  /** A blow of this screen's pack on another player's hero: its share of that hero's health, before its shields and boons. */
  sendHurt(p: Pack, figure: Enemy, share: number, from: Spot, kind: string, net?: EnemySpec['net']): void;
  /** This screen's hit on a unit of a pack another screen runs (`dmg` against the unit's health before anyone's boons). */
  sendHit(p: Pack, slot: number, dmg: number): void;
  sendClear(p: Pack): void;
  sendRelease(p: Pack): void;
  /** A red zone began on this screen's pack: the next report goes out now, not on the next tick. */
  urgent(): void;
  /** Mirrors of a pack's units may be drawn past the usual cap (another player's packs): the cap now. */
  readonly fakeOwned?: boolean;
}

/** What a pack needs from the zone around it. */
export interface PackEnv {
  api: GameApi;
  boons: TowerBoons;
  enemies: Record<string, EnemySpec>;
  /** The floor's number for health: floorNumbers(n).hp. */
  hp: number;
  /** The run's clock (s). */
  now(): number;
  fell(pack: Pack, spec: EnemySpec, at: Spot): void;
  /** The last unit fell (on any screen); `tookPart`: this screen's hero had a kill of it that counted. */
  cleared?(pack: Pack): void;
  log(text: string): void;
  /** The floor's shard (the open world), or none: a pack alone as it always was. */
  link?: PackLink | null;
}

const NONE: readonly { figure: Enemy; pos: THREE.Vector3 }[] = [];
const AT = new THREE.Vector3();

export class Pack {
  state: PackState = 'unborn';
  private slots: Slot[];
  readonly seen = { born: 0, woke: 0, leashed: 0, cleared: 0 };
  /** A pack left alone for good by the tool. */
  off = false;
  /** How far the hero may be from home before the pack gives up (m). */
  leashAt: number = PACK.leash;
  /** A pack the zone makes when it needs one (a wave): awake at birth, never gives up. */
  hunter = false;
  /** The route of a patrol, for the named. */
  private patrol: { len: number; cum: number[]; pts: Spot[]; speed: number } | null = null;
  /** The patrol's own clock stops while it fights and walks home (else its home walks on mid-fight, and past the leash it gives up and
   * heals: the Sands' probe counted 28 such resets in one try); `paused` is the time it has stood still so far. */
  private paused = 0;
  private stoppedAt: number | null = null;
  /** How it fights together (tactics.ts): one focus, slots round it, turns, each kind's own pattern. */
  readonly mind: PackMind;
  /** Shared: whose screen runs it. */
  mode: PackMode = 'local';
  /** The players it is set for, and what that makes its health and its blows (packScale). */
  n = 1;
  hpMul = 1;
  dmgMul = 1;
  /** This screen's hero had a kill of it that counted (its quests count the pack only then). */
  tookPart = false;
  /** When a claim went out (performance.now ms): no second one while it is answered. */
  private claimedAt = -Infinity;
  /** A copy: where the owner says the pack fights, and when it last said so (performance.now ms). */
  private centre: Spot | null = null;
  private heard = 0;
  /** A copy's red zones, by unit. */
  private zones = new Map<number, { layer: TelegraphLayer; key: string; t: number }>();
  /** Run here for the shard: the other heroes in its fight now (a kept list). */
  private remote: { figure: Enemy; pos: THREE.Vector3 }[] = [];
  /** A copy may be drawn now: the nearest copies within the share's budget are (share.ts `COPY_MAX`). */
  drawOk = true;
  /** How far this screen's hero is from where a copy fights (m), for the budget. */
  get copyDist() {
    const c = this.centre ?? this.home, h = this.env.api.arena.caster.group.position;
    return Math.hypot(h.x - c.x, h.z - c.z);
  }

  constructor(readonly def: PackDef, private env: PackEnv, cleared = false) {
    const kinds: EnemySpec[] = [];
    if (def.elite) kinds.push(env.enemies[def.elite]);
    for (const m of def.mix) for (let i = 0; i < m.n; i++) kinds.push(env.enemies[m.kind]);
    const n = kinds.length;
    this.slots = kinds.map((spec, i) => {
      const a = (i / n) * Math.PI * 2 + 0.6, r = n === 1 ? 0 : 1.9;
      const hp = this.unitHp(spec);
      return {
        spec, spot: new THREE.Vector3(def.at.x + Math.cos(a) * r, 0, def.at.z + Math.sin(a) * r), hp, max: hp, alive: !cleared,
        mineAt: -Infinity, othersAt: -Infinity, shots: 0, seenShots: -1, predUntil: 0, predHp: 0, swingT: -1, lastSwing: -1, lx: 0, lz: 0,
      };
    });
    if (cleared) { this.state = 'cleared'; this.tookPart = true; }
    if (def.leash) this.leashAt = def.leash;
    const link = env.link;
    this.mind = new PackMind(env.api, () => this.state === 'awake', link ? (f) => link.isHero(f) : undefined);
    if (def.named) {
      const pts = def.named.patrol, cum = [0];
      for (let i = 0; i < pts.length; i++) {
        const b = pts[(i + 1) % pts.length];
        cum.push(cum[i] + Math.hypot(b.x - pts[i].x, b.z - pts[i].z));
      }
      this.patrol = { len: cum[pts.length], cum, pts, speed: def.named.speed };
      this.leashAt = 24;
    }
  }

  /** A unit's full health on this screen: the floor's numbers, lowered by this hero's damage boons (hits on units pass no boon), times the players. */
  private unitHp(spec: EnemySpec) {
    return Math.max(10, Math.round((spec.hp * this.env.hp * this.hpMul) / this.env.boons.dealtMul(false)));
  }

  get id() {
    return this.def.id;
  }
  get total() {
    return this.slots.length;
  }
  get left() {
    return this.slots.filter((s) => s.alive).length;
  }
  get units() {
    return this.slots.flatMap((s) => (s.unit?.alive ? [s.unit] : []));
  }
  /** Where it stands (a patrol: where it walks now). */
  get home(): Spot {
    return this.patrol ? this.patrolAt(this.clock()) : this.def.at;
  }
  /** The patrol's clock: the game's, less the time it stood still fighting. */
  private clock() {
    return (this.stoppedAt ?? this.env.now()) - this.paused;
  }
  private walkOn() {
    if (this.stoppedAt === null) return;
    this.paused += this.env.now() - this.stoppedAt;
    this.stoppedAt = null;
  }
  get patrols() {
    return !!this.patrol;
  }
  /** Which spec a unit is. */
  specOf(u: SummonUnit) {
    return this.slots.find((s) => s.unit === u)?.spec;
  }

  /** Where the patrol is at clock `t` and which way it faces. */
  patrolAt(t: number): Spot & { yaw: number } {
    const pr = this.patrol!, d = (t * pr.speed) % pr.len;
    let i = 0;
    while (i < pr.pts.length - 1 && pr.cum[i + 1] <= d) i++;
    const a = pr.pts[i], b = pr.pts[(i + 1) % pr.pts.length], f = (d - pr.cum[i]) / Math.max(1e-6, pr.cum[i + 1] - pr.cum[i]);
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }

  /**
   * The units come to be, if the summon system has room for all of them (it holds at most `arena.summons.cap` a side: 6). `partial`: as
   * many as fit (a wave's, and the tool's).
   */
  spawn(partial = false) {
    const { api, boons } = this.env, arena = api.arena, room = arena.summons.cap - arena.summons.alive('opponent').length;
    const live = this.slots.filter((s) => s.alive).slice(0, partial ? Math.max(0, room) : undefined);
    if (live.length > room || !live.length) return false;
    const at = this.patrol ? this.patrolAt(this.clock()) : null;
    const link = this.env.link;
    for (const [i, s] of live.entries()) {
      const sp = s.spec, slot = this.slots.indexOf(s);
      const look = lookOf(sp);
      if (at) s.spot.set(at.x, 0, at.z);
      // `globalThis.__noTactics = true` before a pack appears: it fights as before (for the A/B).
      const mind = roleOf(sp) && !(globalThis as { __noTactics?: boolean }).__noTactics ? this.mind.brain : undefined;
      const handle = arena.summonFor('opponent', {
        kind: sp.melee ? 'melee' : 'ranged', at: s.spot.clone(), hp: s.hp, seconds: 3600, damage: BLOW, attackEvery: sp.every, speed: sp.speed, range: sp.range ?? 9, color: sp.color,
        look: sp.scale && sp.scale !== 1 ? (kind, p) => { const l = look(kind, p); l.root.scale.multiplyScalar(sp.scale!); l.barY = (l.barY ?? 1.8) * sp.scale!; return l; } : look,
        // A melee unit asleep or on its way home walks to its own spot (where it stands, it does not walk); awake, the system's chase.
        goal: () => (this.state === 'awake' ? null : s.spot),
        // Shared: one brain that is the pack's mind while it runs here and the owner's reports while it is a copy.
        brain: link ? this.sharedBrain(s, mind) : mind,
        others: link ? this.othersOf(s) : undefined,
      }, (target, opts) => {
        if (target === arena.caster) {
          const script = api.duel.boss?.script;
          // A special's blow is bigger than the kind's own (tactics.ts): its `damage` against the plain blow's.
          const size = (opts?.damage ?? BLOW) / BLOW;
          api.duel.hurtHero({ share: sp.share * size * (script?.rage ?? 1) * (script?.harm ?? 1) * this.dmgMul, from: opts?.from ?? s.spot, move: sp.name as never });
          if (sp.net && api.duel.heroHp > 0) arena.applyStatus(arena.caster, sp.net.kind, sp.net.seconds, sp.color);
        } else arena.hit(target, opts);
      });
      const unit = handle.units[0];
      if (!unit) continue;
      s.unit = unit;
      this.mind.add(unit, sp, i);
      unit.rate = 0;
      unit.opts.speed = 0;
      handle.onHurt((u, damage) => {
        leechFrom(api, damage, boons.leech);
        s.mineAt = performance.now();
        if (this.mode === 'mirror') {
          // A hit on a copy goes to the screen that runs the unit, against its health before this hero's boons.
          link?.sendHit(this, slot, damage * boons.dealtMul(false));
          s.predUntil = s.mineAt + PREDICT_MS;
          s.predHp = u.hp;
          return;
        }
        this.wake('hit');
      });
      handle.onDeath((dead) => {
        this.mind.forget(dead);
        // A unit that went away (a pack hidden again) is no death.
        if (!dead.slain) return;
        s.alive = false;
        const where = { x: dead.pos.x, z: dead.pos.z };
        s.unit = undefined;
        s.shadowless = undefined;
        this.dropZone(slot);
        if (this.credited(s)) {
          this.tookPart = true;
          this.env.fell(this, sp, where);
        }
        if (!this.left) this.clearNow();
      });
      if (this.mode === 'mirror') this.copy(s, unit);
    }
    this.state = 'asleep';
    this.seen.born++;
    this.env.log(`${this.id}: appears`);
    if (this.mode === 'mirror') this.state = 'awake';
    else if (this.hunter) this.wake('hunts');
    return true;
  }

  /** Every unit has fallen (here, or on the screen that runs it). */
  private clearNow() {
    this.state = 'cleared';
    this.seen.cleared++;
    this.env.log(`${this.id}: cleared${this.mode === 'local' ? '' : this.tookPart ? ' (counted here)' : ' (not counted here: no hit in its last seconds)'}`);
    if (this.mode === 'owned') this.env.link?.sendClear(this);
    this.mode = 'local';
    this.dropZones();
    this.env.cleared?.(this);
  }

  /** Whether a unit's fall counts for this screen's hero: alone, always; shared, when its hero hit it in its last seconds. */
  private credited(s: Slot) {
    const t = performance.now(), win = WORLD_PACKS.hitS * 1000;
    if (this.mode === 'local') return true;
    // The screen that runs it: also when nobody else hit it lately (its own hazards, its own units: as alone).
    if (this.mode === 'owned') return t - s.mineAt <= win || !(t - s.othersAt <= win);
    return t - s.mineAt <= win;
  }

  private hide() {
    this.mind.calm();
    this.dropZones();
    for (const s of this.slots) {
      if (!s.unit) continue;
      s.hp = s.unit.alive ? s.unit.hp : s.hp;
      if (s.unit.alive) this.env.api.arena.summons.dismiss(s.unit);
      s.unit = undefined;
      s.shadowless = undefined;
    }
    this.state = 'unborn';
  }

  /** The whole pack wakes. Shared: it is claimed, and runs here alone until the hub says whose it is. */
  wake(why: string) {
    if (this.state !== 'asleep' && this.state !== 'leashed') return;
    this.state = 'awake';
    this.seen.woke++;
    if (this.patrol && this.stoppedAt === null) this.stoppedAt = this.env.now();
    for (const u of this.units) {
      u.rate = 1;
      u.opts.speed = this.specOf(u)!.speed;
    }
    this.env.log(`${this.id}: wakes (${why})`);
    const link = this.env.link;
    if (this.mode === 'local' && !this.hunter && link) {
      if (link.fakeOwned) this.mode = 'owned';
      else if (link.on && link.knows(this.id) && performance.now() - this.claimedAt > 3000) {
        this.claimedAt = performance.now();
        link.claim(this);
      }
    }
  }

  /** Gone with the zone's fight: nothing of it is left standing. */
  dispose() {
    this.mind.calm();
    this.dropZones();
    for (const s of this.slots) {
      if (s.unit?.alive) this.env.api.arena.summons.dismiss(s.unit);
      s.unit = undefined;
    }
  }

  // --- shared (the open world) ---------------------------------------------------------------------------------------------------------

  /** The brain of a shared pack's unit: its kind's mind (or the plain nearest victim) while it runs here, the owner's word as a copy. */
  private sharedBrain(s: Slot, mind: SummonBrain | undefined): SummonBrain {
    return {
      pick: (u, victims) => {
        if (this.mode === 'mirror') return null;
        if (mind?.pick) return mind.pick(u, victims);
        let best: { figure: Enemy; pos: THREE.Vector3 } | null = null, bd = Infinity;
        for (const v of victims) {
          const d = Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z);
          if (d < bd) { bd = d; best = v; }
        }
        return best;
      },
      act: (u, tgt, dist, dt, tools) => (this.mode === 'mirror' ? this.copyAct(s, u, dt, tools) : mind?.act ? mind.act(u, tgt, dist, dt, tools) : null),
    };
  }

  /** The other players' heroes a unit run here may strike, and where its blows on them go. */
  private othersOf(s: Slot): SummonOthers {
    const link = this.env.link!;
    return {
      victims: () => (this.mode === 'owned' ? this.remote : NONE) as { figure: Enemy; pos: THREE.Vector3 }[],
      has: (f) => link.isHero(f),
      hit: (target: Enemy, h: HitOptions) => {
        if (this.mode !== 'owned') return;
        const size = (h.damage ?? BLOW) / BLOW;
        link.sendHurt(this, target, s.spec.share * size * this.dmgMul, h.from ?? s.spot, s.spec.name, s.spec.net);
      },
      fired: () => { s.shots++; },
    };
  }

  /** Who runs it now (the hub's word): `me`, nobody (0), or another screen (its id). */
  setOwner(owner: 'me' | number, n: number) {
    if (this.hunter) return;
    this.scale(n);
    if (owner === 'me') {
      if (this.mode === 'owned') return;
      const was = this.mode;
      this.mode = 'owned';
      if (this.state === 'cleared' || this.state === 'unborn' || !this.units.length) {
        // Handed on while its units are not drawn here (far, or past the copies' budget): they come where the owner last had them.
        if (this.state === 'cleared') for (const s of this.slots) s.alive = true;
        this.state = 'unborn';
        if (!this.spawn()) { this.mode = 'local'; this.env.link?.sendRelease(this); return; }
        for (const s of this.slots) if (s.unit?.alive && s.rep) s.unit.pos.set(s.rep[0], 0, s.rep[1]);
      }
      for (const s of this.slots) {
        const u = s.unit;
        if (!u?.alive) continue;
        this.uncopy(s, u);
        if (s.rep) {
          // It goes on from the owner's last word: its health's share, its bolts' count.
          u.max = this.unitHp(s.spec);
          u.hp = Math.max(1, Math.min(u.max, (s.rep[3] / Math.max(1, s.rep[4])) * u.max));
          s.shots = s.rep[8] ?? s.shots;
        }
      }
      this.dropZones();
      if (this.state !== 'awake') { this.state = 'asleep'; this.wake('handed on'); }
      for (const u of this.units) { u.rate = 1; u.opts.speed = this.specOf(u)!.speed; }
      this.env.log(`${this.id}: runs here now (${was === 'mirror' ? 'handed on' : 'woke it'}), set for ${this.n}`);
      return;
    }
    if (owner === 0) {
      if (this.mode === 'local') return;
      this.mode = 'local';
      this.mind.calm();
      this.dropZones();
      for (const s of this.slots) if (s.unit) this.uncopy(s, s.unit);
      if (this.state === 'cleared') return;
      if (!this.units.length) { this.state = 'unborn'; return; }
      // Nobody runs it any more: it gives up here, walks home and heals.
      this.state = 'leashed';
      for (const u of this.units) { u.rate = 0; u.opts.speed = 0; }
      this.env.log(`${this.id}: nobody runs it now: home`);
      return;
    }
    if (this.mode === 'mirror') return;
    // Another screen runs it: this one draws it.
    this.mode = 'mirror';
    this.mind.calm();
    if (this.state === 'cleared') {
      // Cleared in this run, but back in the world (someone else's fight).
      for (const s of this.slots) s.alive = true;
      this.state = 'unborn';
    }
    for (const s of this.slots) if (s.unit?.alive) this.copy(s, s.unit);
    if (this.state !== 'unborn') this.state = 'awake';
    this.env.log(`${this.id}: drawn here, run by ${owner}, set for ${this.n}`);
  }

  /** A unit as a copy: no mind, no walk of its own, never falls here; placed from the owner's reports from where it stands now. */
  private copy(s: Slot, u: SummonUnit) {
    u.mirror = true;
    // A copy casts no shadow (as the other players' figures do not): its figure is the same, the frame cheaper.
    if (!s.shadowless) {
      const off: THREE.Object3D[] = [];
      u.figure.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.castShadow) { o.castShadow = false; off.push(o); } });
      s.shadowless = off;
    }
    u.rate = 0;
    u.opts.speed = 0;
    (s.glide ??= new Glide()).reset(u.pos.x, u.pos.z, u.figure.group.rotation.y);
    s.seenShots = s.rep ? s.rep[8] : -1;
    s.swingT = -1;
    if (s.rep) { u.max = Math.max(1, s.rep[4]); u.hp = Math.max(1, Math.min(u.max, s.rep[3])); }
  }

  /** A copy that runs here again: its own unit, with its shadow. */
  private uncopy(s: Slot, u: SummonUnit) {
    u.mirror = false;
    for (const o of s.shadowless ?? []) o.castShadow = true;
    s.shadowless = undefined;
  }

  /** More players in its fight (the hub's word): its health and blows grow, never shrink, and the health lost keeps its share. */
  scale(n: number) {
    if (!(n > this.n)) return;
    this.n = n;
    const k = packScale(n);
    this.hpMul = k.hp;
    this.dmgMul = k.dmg;
    for (const s of this.slots) {
      const max = this.unitHp(s.spec);
      s.hp = Math.round((s.hp / Math.max(1, s.max)) * max);
      s.max = max;
      const u = s.unit;
      if (!u?.alive || this.mode === 'mirror') continue;
      u.hp = (u.hp / Math.max(1, u.max)) * max;
      u.max = max;
    }
    this.env.log(`${this.id}: set for ${n} players: health x${k.hp.toFixed(2)}, blows x${k.dmg.toFixed(2)}`);
  }

  /** Another player hit one of its units (run here): it is taken off as that hit, against this screen's health for it. */
  remoteHit(slot: number, dmg: number) {
    const s = this.slots[slot], u = s?.unit;
    if (this.mode !== 'owned' || !u?.alive) return;
    s.othersAt = performance.now();
    this.env.api.arena.summons.hurt(u, { damage: dmg / this.env.boons.dealtMul(false), knock: 0, color: '#ffe4b8' }, true);
  }

  /** The shard says it is cleared (by another screen's fight, or before this one came). */
  shardCleared() {
    if (this.state === 'cleared') return;
    const arena = this.env.api.arena;
    if (this.mode === 'mirror') {
      // Its last units fall here as they fell there (each counts if this hero hit it lately).
      for (const s of this.slots) if (s.unit?.alive) arena.summons.slay(s.unit);
      // (A slain unit's fall may have cleared it already.)
      if ((this.state as PackState) !== 'cleared') { for (const s of this.slots) s.alive = false; this.clearNow(); }
      return;
    }
    // Not fought here: it is gone, and counts for nobody here.
    this.dispose();
    for (const s of this.slots) s.alive = false;
    this.mode = 'local';
    this.state = 'cleared';
    this.env.log(`${this.id}: cleared by others`);
  }

  /** Back in the world after a while (the hub's word): whole, asleep at home, for one player again. Its quests stay done. */
  respawn() {
    if (this.state !== 'cleared' || this.hunter) return;
    this.dispose();
    this.mode = 'local';
    this.n = 1;
    this.hpMul = this.dmgMul = 1;
    this.tookPart = false;
    this.claimedAt = -Infinity;
    for (const s of this.slots) {
      s.max = s.hp = this.unitHp(s.spec);
      s.alive = true;
      s.mineAt = s.othersAt = -Infinity;
      s.rep = undefined;
    }
    this.state = 'unborn';
    this.env.log(`${this.id}: back`);
  }

  /** A report of the pack from the screen that runs it (a copy only). */
  apply(r: PackReport) {
    if (this.mode !== 'mirror') return;
    this.centre = { x: r.x, z: r.z };
    this.heard = performance.now();
    if (r.n) this.scale(r.n);
    const arena = this.env.api.arena;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i], v = r.u[i];
      if (!v) {
        if (s.unit?.alive) arena.summons.slay(s.unit);
        else s.alive = false;
        continue;
      }
      if (this.state === 'cleared') continue;
      s.alive = true;
      if (s.seenShots < 0) s.seenShots = v[8] ?? 0;
      // A new blow: one that began since the last report.
      if (v[6] >= 0 && (s.lastSwing < 0 || v[6] < s.lastSwing)) s.swingT = v[6];
      s.lastSwing = v[6];
      s.rep = v;
      (s.glide ??= new Glide()).push(v[0], v[1], v[2], r.ts);
      const u = s.unit;
      if (u?.alive) {
        u.max = Math.max(1, v[4]);
        const hp = Math.max(1, Math.min(u.max, v[3]));
        u.hp = this.heard < s.predUntil ? Math.min(s.predHp, hp) : hp;
      }
    }
    // Its red zones: one a unit at most, drawn as the pack's own are.
    const seen = new Set<number>();
    for (const z of r.zn ?? []) {
      const slot = z[0], shape: TelegraphShape = z[1] === 0 ? { kind: 'circle', x: z[2], z: z[3], radius: z[4] } : { kind: 'line', x1: z[2], z1: z[3], x2: z[4], z2: z[5], width: z[6] };
      const key = z.slice(1, 7).join(',');
      seen.add(slot);
      const had = this.zones.get(slot);
      if (had && had.key === key) continue;
      if (had) this.dropZone(slot);
      const layer = new TelegraphLayer();
      layer.set([{ shape, start: 0, impact: z[8] }]);
      layer.group.position.y = 0.04;
      layer.group.name = 'tactics-zone';
      arena.group.add(layer.group);
      this.zones.set(slot, { layer, key, t: z[7] });
      layer.update(z[7]);
    }
    for (const slot of [...this.zones.keys()]) if (!seen.has(slot)) this.dropZone(slot);
  }

  private dropZone(slot: number) {
    const z = this.zones.get(slot);
    if (!z) return;
    z.layer.set([]);
    z.layer.group.removeFromParent();
    this.zones.delete(slot);
  }

  private dropZones() {
    for (const slot of [...this.zones.keys()]) this.dropZone(slot);
  }

  /** A copy's frame: placed where the owner had it a moment ago, its blows and bolts drawn as the owner's report says. */
  private copyAct(s: Slot, u: SummonUnit, dt: number, tools: BrainTools) {
    u.left = 3600;
    let walk = 0;
    if (s.glide?.sample(AT)) {
      const moved = Math.hypot(AT.x - u.pos.x, AT.z - u.pos.z);
      walk = dt > 0 && moved / dt > 0.4 ? 1 : 0;
      u.pos.set(AT.x, 0, AT.z);
      u.figure.group.rotation.y = AT.y;
    }
    const v = s.rep;
    if (v && v[8] > s.seenShots) {
      // Its bolts, as looks (they strike nothing here: summon.ts `mirror`); three at once were a fan.
      const k = Math.min(3, v[8] - s.seenShots), yaw = u.figure.group.rotation.y;
      s.seenShots = v[8];
      for (let j = 0; j < k; j++) {
        const a = yaw + (k === 3 ? (j - 1) * 0.26 : 0);
        tools.shoot(new THREE.Vector3(u.pos.x + Math.sin(a) * 8, 0, u.pos.z + Math.cos(a) * 8));
      }
    }
    if (s.swingT >= 0) {
      s.swingT += dt / 0.3;
      if (s.swingT >= 1) s.swingT = -1;
    }
    return { walk, swing: s.swingT >= 0 ? s.swingT : undefined, pose: v && v[7] >= 0 ? v[7] : undefined };
  }

  private zonesWere = 0;
  /** A red zone began since the last frame on this screen's pack for the shard (its report goes out at once). */
  zoneBegan() {
    if (this.mode !== 'owned') return false;
    let n = 0;
    for (const s of this.slots) if (s.unit?.alive && this.mind.zoneOf(s.unit)) n++;
    const began = n > this.zonesWere;
    this.zonesWere = n;
    return began;
  }

  /** The pack as this screen reports it to the others (run here), or null when there is nothing to say. */
  report(ts: number): PackReport | null {
    if (this.mode !== 'owned' || this.state === 'cleared') return null;
    let cx = 0, cz = 0, n = 0;
    const r3 = (v: number) => Math.round(v * 1000) / 1000, r2 = (v: number) => Math.round(v * 100) / 100;
    const u = this.slots.map((s) => {
      const x = s.unit;
      if (!s.alive) return 0 as const;
      // Alive but not drawn here (a moment after a hand-over): where it stands by the last word, never as fallen.
      if (!x?.alive) return [r3(s.spot.x), r3(s.spot.z), 0, Math.round(s.hp), Math.round(s.max), 0, -1, -1, s.shots];
      cx += x.pos.x; cz += x.pos.z; n++;
      const walk = Math.hypot(x.pos.x - s.lx, x.pos.z - s.lz) > 0.05 ? 1 : 0;
      s.lx = x.pos.x; s.lz = x.pos.z;
      return [r3(x.pos.x), r3(x.pos.z), r2(x.figure.group.rotation.y), Math.round(x.hp), Math.round(x.max), walk, r2(x.swing), r2(this.mind.windup(x)), s.shots];
    });
    const zn: number[][] = [];
    this.slots.forEach((s, i) => {
      const z = s.unit?.alive ? this.mind.zoneOf(s.unit) : null;
      if (!z) return;
      const sh = z.shape;
      if (sh.kind === 'circle') zn.push([i, 0, r3(sh.x), r3(sh.z), r3(sh.radius), 0, 0, r2(z.t), z.impact]);
      else if (sh.kind === 'line') zn.push([i, 1, r3(sh.x1), r3(sh.z1), r3(sh.x2), r3(sh.z2), r3(sh.width), r2(z.t), z.impact]);
    });
    const home = this.home;
    return { id: this.id, x: r3(n ? cx / n : home.x), z: r3(n ? cz / n : home.z), ts: Math.round(ts), u, zn };
  }

  /** The nearest hero to a spot: this screen's (`d`) or, run here for the shard, another in the fight. */
  private nearest(at: Spot, d: number) {
    if (this.mode !== 'owned') return d;
    for (const v of this.remote) d = Math.min(d, Math.hypot(v.pos.x - at.x, v.pos.z - at.z));
    return d;
  }

  /** One frame. `hero` is where the hero stands. */
  update(dt: number, hero: THREE.Vector3) {
    if (this.state === 'cleared' || this.off) return;
    if (this.mode === 'mirror') { this.copyUpdate(dt, hero); return; }
    if (this.mode === 'owned') {
      // The other heroes in its fight: those near its home or its units.
      this.remote.length = 0;
      const c = this.units[0]?.pos ?? this.home;
      for (const v of this.env.link?.heroes() ?? NONE) if (Math.hypot(v.pos.x - c.x, v.pos.z - c.z) < FIGHT_R) this.remote.push(v);
    }
    const home = this.home;
    const d = this.nearest(home, Math.hypot(hero.x - home.x, hero.z - home.z));
    if (this.state === 'unborn') {
      if (d < PACK.show) this.spawn();
      return;
    }
    if (this.state === 'asleep') {
      // Asleep at home: nobody runs it for the shard any more.
      if (this.mode === 'owned') { this.mode = 'local'; this.env.link?.sendRelease(this); }
      if (d > PACK.hide && !this.hunter) { this.hide(); return; }
      if (this.patrol) {
        // It walks its route: placed from its clock, so it is where it should be after any rebuild.
        const at = this.patrolAt(this.clock());
        for (const s of this.slots) {
          const u = s.unit;
          if (!u?.alive) continue;
          u.pos.set(at.x, 0, at.z);
          s.spot.set(at.x, 0, at.z);
          u.figure.group.rotation.y = at.yaw;
        }
      }
      if (d < PACK.wake) this.wake('near');
      return;
    }
    if (this.state === 'awake') {
      this.mind.tick(dt);
      if (d > this.leashAt && !this.hunter) {
        this.state = 'leashed';
        this.seen.leashed++;
        this.mind.calm();
        for (const u of this.units) {
          u.rate = 0;
          u.opts.speed = 0;
        }
        this.env.log(`${this.id}: gives up`);
      }
      return;
    }
    // Leashed: home by the arena's own route, striking nothing.
    const arena = this.env.api.arena;
    let nHome = 0;
    for (const s of this.slots) {
      const u = s.unit;
      if (!u?.alive) continue;
      if (this.patrol) s.spot.set(home.x, 0, home.z);
      const to = Math.hypot(s.spot.x - u.pos.x, s.spot.z - u.pos.z);
      if (to < 0.35) { nHome++; continue; }
      const step = arena.route(u, u.pos, s.spot).point;
      const dx = step.x - u.pos.x, dz = step.z - u.pos.z, len = Math.hypot(dx, dz) || 1;
      const speed = s.spec.speed * 1.25;
      u.pos.x += (dx / len) * Math.min(len, speed * dt);
      u.pos.z += (dz / len) * Math.min(len, speed * dt);
      arena.keepInside(u.pos, 0.5);
      u.figure.group.rotation.y = Math.atan2(dx, dz);
    }
    // They heal on the way.
    for (const s of this.slots) if (s.unit?.alive) s.unit.hp = Math.min(s.unit.max, s.unit.hp + s.unit.max * 0.25 * dt);
    if (nHome === this.units.length) {
      this.state = 'asleep';
      this.walkOn();
      this.env.log(`${this.id}: home`);
    } else if (d < PACK.wake) this.wake('hero came back');
  }

  /** A copy's frame: its units come when this hero is near where the owner says it fights (or its home), and go when it is far. */
  private copyUpdate(dt: number, hero: THREE.Vector3) {
    for (const z of this.zones.values()) z.layer.update((z.t += dt));
    const home = this.home, c = this.centre ?? home;
    const d = Math.min(Math.hypot(hero.x - c.x, hero.z - c.z), Math.hypot(hero.x - home.x, hero.z - home.z));
    const drawn = this.units.length > 0;
    if (!drawn && this.drawOk && this.state !== 'cleared' && this.left && d < PACK.show && this.centre) {
      this.state = 'unborn';
      if (this.spawn(true)) {
        // They come where the owner has them (the reports go on from there).
        for (const s of this.slots) if (s.unit?.alive && s.rep) { s.glide!.reset(s.rep[0], s.rep[1], s.rep[2]); s.unit.pos.set(s.rep[0], 0, s.rep[1]); }
      }
    } else if (drawn && (d > MIRROR_HIDE || !this.drawOk)) {
      this.hide();
      this.state = 'awake';
    }
  }
}
