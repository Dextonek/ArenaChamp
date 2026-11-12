import * as THREE from 'three';
import type { Arena } from './arena';
import { Enemy } from './effects/common';
import { TelegraphLayer, insideTelegraph, type TelegraphShape, type TelegraphSpec } from './effects/telegraph';
import { ARC_BEND, BODY_RADIUS, arcPoints } from './effects/projectile';
import { MAX_UNITS, type SummonSide, type SummonStats } from './effects/summon';
import type { CastContext, HitOptions, TargetingSpec } from './effects/targeting';
import { BUFF_COLOR, BUFF_GLYPH, DEBUFFS, StatusSet, type BuffKind, type StatusKind } from './effects/status';
import { HERO_BODIES, type HeroKit, type HeroSpell } from './heroes';
import { HeroFigure, castStyle } from './heroFigure';
import { arenaById, pickArena, type ArenaDef, type ArenaScene, type ArenaStage } from './arenas';
import type { ArenaHazard, HazardHit, HazardTarget, HazardWorld } from './arenas/hazards/base';
import type { ArenaShift, ShiftWorld } from './arenas/shifts/base';
import type { Obstacle } from './obstacles';
import { AttackFx, Attacker, attackFor, type AttackSpec } from './attacks';
import type { HeroMode, Target } from './heroMode';
import { NO_MODS, TraitRuntime, traitFor, type CastMods, type Side, type TraitHit } from './traits';
import { TraitFx, stackColor } from './traits/fx';
import { pillar, stopsAtCover, sweepHit } from './obstacles';
import { TOUCH } from './touch';
import { CPU_BALANCE, type CpuLevel } from './cpuLevels';
import { BossFight } from './raid/fight';
import { BossHud } from './raid/hud';
import { Partner, REVIVE_REACH, REVIVE_TIME } from './raid/partner';
import type { AddSpec, BossDebuff, BossDef, BossHit, BossWorld, RaidAdd, RaidLink, RoomFloor, TwinSetup, TwinWorld } from './raid/types';
import type { RunUpgrades } from './raid/upgrades';

/** What the duel needs from main.ts. */
export interface DuelHost {
  arena: Arena;
  heroMode: HeroMode;
  kits: HeroKit[];
  /** The danger zones of the player's spell that was cast last (main.ts `zones`). */
  playerZones(): TelegraphSpec[];
  /** Plays a targeted effect for another caster (main.ts `castAs`); returns its danger zones. */
  castAs(label: string, ctx: CastContext): TelegraphSpec[];
  targeting(label: string): TargetingSpec | undefined;
  /** Sets the sky, fog and lights for the duel's arena (null = the tool's default stage). */
  setStage?(stage: ArenaStage | null): void;
  /** Ends every spell still on screen (main.ts `clearEffects`): a new round or a left duel starts clean. */
  clearEffects?(): void;
  /** Compiles what is in the scene now, so the first frames of a fight do not stutter. */
  warmUp?(): Promise<unknown>;
  /** The outline: round this object, or off (null). */
  outline?(object: THREE.Object3D | null): void;
}

/**
 * A network duel's link to the server (src/game/match.ts): the local hero's casts go out, and so do the hits and
 * dodges this side takes (each side decides the hits on its own hero, where it really stood at impact).
 */
export interface DuelNet {
  cast(msg: { id: number; slot: number; x: number; z: number; fx: number; fz: number; enemy: boolean; yaw: number; mods?: CastMods; bend?: number }): void;
  /**
   * A hit on this side's hero: `damage` got past its shield, `soaked` is what the shield took. `blocked`: a passive
   * swallowed it whole (ice block, void maw), so the dealer's passives must not count it.
   */
  tookHit(id: number, damage: number, color?: string, soaked?: number, blocked?: boolean): void;
  dodged(id: number): void;
  /** This side's hero released a basic attack at the other hero (`mods`: its power and on-hit extras). */
  attack(id: number, mods?: CastMods): void;
  /** A buff or debuff on this side's hero (shown on the other screen). */
  buff(kind: BuffKind, amount: number, seconds: number): void;
  /** Stacks this side keeps on the other hero changed (the other player's own mechanic, decided here). */
  stacks(name: string, n: number): void;
  /** This side's hero healed itself (the server adds it to the HP it counts). */
  heal(amount: number): void;
  /** This side's hero paid HP for a spell (the server takes it off, never below 1). */
  spend(amount: number): void;
  /** An arena hazard hit this side's hero for `damage` past its shield (the server takes it off; it can KO). */
  hazard(damage: number, color?: string): void;
  /** This side's hero took a status / got a shield: only shown on the other screen. */
  status(kind: StatusKind, seconds: number, color?: string): void;
  shield(amount: number, seconds: number, color?: string): void;
}

/** A cast of the remote hero, as the server relays it. */
export interface PeerCast {
  id: number;
  slot: number;
  /** Aim point (ground spells) or where the target stood (single-target spells). */
  x: number;
  z: number;
  /** Where the caster stood. */
  fx: number;
  fz: number;
  /** Aimed at this side's hero (enemy / enemies spells). */
  enemy: boolean;
  /** Which way the caster faced (spells fired where the hero faces). */
  yaw?: number;
  /** The bend of an arc aim (`CastContext.bend`); absent for every other spell. */
  bend?: number;
  /** The cast's power and extras (src/traits). */
  mods?: CastMods;
}

const RING = { x: 0, z: 7, r: 12 };
const PLAYER_START = new THREE.Vector3(0, 0, 13);
const OPPONENT_START = new THREE.Vector3(0, 0, 1);
const HP = 600; // default max HP (`HeroKit.maxHp` overrides it per side)
// Network duel: the remote hero is drawn this far in the past (ms, two send intervals at 20 Hz) so there is always a
// next report to move toward; a gap longer than PEER_GAP means it stood still; casts snap it beyond PEER_SNAP (m).
const PEER_DELAY = 100;
const PEER_STEP = 50;
const PEER_GAP = 120;
const PEER_SNAP = 3;
/** What a second in a boss room's lava costs a summoned unit standing in it. */
const ROOM_UNIT_HIT = 60;
/** How many partners are drawn in full in a big party; the rest are light stand-ins (pipeline/designs/raid-party.md). */
const PARTY_FULL = 16;
const PARTY_FULL_PHONE = 8;
/** Where a hero of a big party comes in: rows of eight behind the room's first spot, toward the boss, by side. */
function partyStart(first: { x: number; z: number }, side: number) {
  const col = side % 8, row = Math.floor(side / 8);
  return { x: first.x + (col - 3.5) * 1.3, z: first.z - row * 1.3 };
}
const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const PEER_JUMP = 4;
/** A `save` spell (`HeroSpell.save`): cast when the caster's own HP is at or under this share, with the enemy within SAVE_REACH m. */
const SAVE_HP = 0.45;
const SAVE_REACH = 12;
/** An `escape` spell (`HeroSpell.escape`): cast when the enemy hero is this close. */
const ESCAPE_REACH = 3.5;
/** A `parry` spell (`HeroSpell.parry`): raised when an enemy bolt will reach the caster within this many seconds. */
const PARRY_LEAD = 0.6;
/** A `barrier` spell (`HeroSpell.barrier`): raised toward a bolt due within BARRIER_LEAD s that is still BARRIER_GAP m
 * or more away, so the wall (2 m in front of the caster) stands before it arrives. */
const BARRIER_LEAD = 1.0;
const BARRIER_GAP = 2.6;
const NO_GUARD = { parry: false, barrier: false };
// How often the AI answers a hit with its guard (`CpuLevel.guard`), steps off a bolt (`boltDodge`, `boltReaction`) and
// how fast it walks (`speed`) depend on its CPU level (src/cpuLevels.ts); Normal keeps the numbers the kits are
// balanced with (0.6, 0.65, 0.12 s, 3.5 m/s).
/** Breakable walls: hits a wall takes before it falls; an ultimate counts as two. Walls stand again each round. */
const WALL_HP = 5;
/** An area spell hits a wall inside this share of its radius (the edge of a blast only scorches it). */
const WALL_BLAST_REACH = 0.6;
/** How close a line spell's path has to pass a wall (besides its thickness) to hit it. */
const WALL_LINE_PAD = 0.3;
// How often (s) a CPU's walk to a trait's goal is checked, and how long (s) it fights instead when it has stood still short of the goal.
const GOAL_CHECK = 1.5;
const GOAL_REST = 4;
// A bolt's hit lands on a wall after the longest wind-up and the slowest flight of any bolt (Swarm Surge), so no wall falls before its bolt gets there.
const WALL_BOLT_WIND = 0.5;
const WALL_BOLT_SPEED = 12;
const MELEE_GAP = 2; // a melee AI closes to about this distance (m)
const DODGE_RADIUS = 1.6; // a hit of a cast with no drawn shape still lands within this distance of where it aimed
const BOLT_WINDOW = 0.6; // the AI reacts to a bolt that will cross its position within this many seconds (s)
const LEAD_MAX = 3; // a CPU level's lead never puts its aim more than this far (m) ahead of the player
const ZONE_MARGIN = 0.35; // a zone dodge aims this far (m) past the edge of the zone it leaves
const SIGHT_HOLD = 0.5; // having lost sight, an AI keeps walking round the cover this long after it sees again
const STRAFE_LOOK = 0.9; // an AI does not strafe the way that would hide the other side within this far (m)
const HAZARD_LOOK = 1.6; // an AI starts walking when a hazard will reach it within this many seconds
const HAZARD_CLEAR = 3; // and walks to a spot no hazard reaches for this long
const ZONE_LOOK = 0.8; // how far ahead (m) an AI's walk checks for a part of the floor that hurts
const RING_SHRINK = 4; // m/s: how fast a shrinking ring closes and pushes a hero in
const ZONE_FLASH = 0.1; // how strong the red screen flash is on a zone's tick
const HAZARD_SEND_GAP = 0.32; // the hub's HAZARD_GAP_MS, with a little to spare
const HAZARD_MAX = 60; // the hub's most for one hazard hit: more would show damage it does not count
const SUMMON_REACH = 10; // the AI casts a summon spell when the enemy is within this distance (m)
const UNIT_BLOCK = 2.5; // an enemy unit this close is shot at when nothing can be cast at the hero (m)
const BOSS_LOOK = 1.6; // an AI starts walking when a boss's zone will reach it within this many seconds
const BOSS_CLEAR = [3, 1.6, 0.9]; // and walks to a spot clear for this long, or the best it can find (Sun Order leaves nowhere clear for long)
const BOSS_TAKEN = 0.5; // what standing open or kneeling adds to the damage a boss takes
const SHARD_WALK = 0.85; // how fast a hero carrying a sun shard walks
const ADD_LIFE = 120; // a boss's add lasts at most this long (s); its stage removes it sooner
const IMMUNE_SAY = 0.7; // how often IMMUNE shows over a boss that can't be hurt (s)
const COVER_FALL = 0.55; // how long cover a boss breaks takes to fall (s): Ash's pillars
const CLEAR_REACH = 7.2; // how far an AI looks for a spot out of a boss's zones (m)
const STILL_LEAD = 0.36; // an AI stops walking this long before a beat that burns whoever walks: the beat's own window and a few frames (s)
const STILL_DASH = 0.9; // and starts no dash this close to one (s)
const WALK_LOG = 1; // how far back the hero's own walk is kept, for such a beat (s)
const HIDE_REACH = 14.4; // and for one a killing hit can't reach (behind a pillar from Ash's Charge): wherever it is
const HIDE_PAD = 0.5; // a boss's arms reach past its body: it counts as this much wider when it may hide a hero (m)
const HERO_CHEST = 1.2; // the height a hero is seen at, for what may hide it (m)

interface BoltDodge {
  /** The roll came up: this side steps off the bolt's line. */
  react: boolean;
  /** Which side of the line to step to (+1 / -1 along the line's left normal). */
  side: number;
  /** Duel time when it starts to move. */
  at: number;
}

interface EnemyCast {
  /** The remote caster's cast id (network duel). */
  id: number;
  /** The round it was cast in: hits from an earlier round's spells (still playing at a rematch) are ignored. */
  round: number;
  zones: TelegraphSpec[];
  aimed: THREE.Vector3;
  dodgedShown: boolean;
  /** The spell slot and the cast's mods (power, extras) every hit of it carries. */
  slot?: number;
  mods?: CastMods;
  /** Unique per cast on this screen (the AI's casts all have network id 0). */
  seq?: number;
}

/**
 * A 1 vs 1 duel in hero mode: the player's hero against an AI hero of another kit, in a small ring. Both have 600
 * HP. The opponent walks, keeps its distance, strafes and casts its kit's spells on cooldown at the player; its
 * danger zones show before each hit, and a hit only lands if the player is still inside that cast's zones (or
 * close to where it aimed) when it lands, so walking out dodges it. Ends with a victory or defeat card and a
 * rematch. The two kits must differ (one effect instance per spell label).
 */
export class Duel {
  on = false;
  readonly group = new THREE.Group();
  /** 'random', a hero name, or a kit object (a hidden test kit that is not in `host.kits`). */
  opponentChoice: string | HeroKit = 'random';
  /** 'random' or an arena id (src/arenas): the arena of the next AI duel. A network duel picks by its match id. */
  arenaChoice = 'random';
  /** The arena of the current (or last) round. */
  currentArena: ArenaDef | null = null;
  private arenaScene: ArenaScene | null = null;
  /** Breakable arena: each obstacle's hits left (-1 = not breakable, 0 = broken); null for an arena without. */
  private wallHp: number[] | null = null;
  /** Bolts on their way to a wall: the hit is counted at the cast on both screens, and the wall cracks or falls when they get there. */
  private wallHits: { at: number; i: number; o: ArenaDef['obstacles'][number] }[] = [];
  /** The opponent's basic attack (src/attacks): at the hero, or at one of the hero's units. */
  private oppAttack: Attacker;
  private oppAttackFx = new AttackFx();
  private oppAttackSpec!: AttackSpec;

  private opponentKit!: HeroKit;
  private foe: Enemy | null = null;
  private figure = new HeroFigure();
  private zones = new TelegraphLayer();
  private zoneClock = 0;
  private playerHp = HP;
  private playerMax = HP;
  private foeMax = HP;
  private cooldowns = [0, 0, 0, 0];
  private rooted = 0;
  /** The opponent trait's hold set during its cast's rules, applied after the spell's own root (`castSpell`). */
  private holdFloor = 0;
  /** Seconds the opponent's figure stays frozen (its ice block); also online, where only the look is affected. */
  private foeHeld = 0;
  /** The foe figure's hit flash last frame: a jump means a new hit (flinch). */
  private foeFlash = 0;
  private think = 0;
  private opponentAi = { strafe: 1, strafeT: 0, closing: false, routed: false, hiddenT: 0, goalT: 0, goalSeen: false, goalOff: 0, goalFrom: new THREE.Vector3() };
  private playerAi = { strafe: -1, strafeT: 0, closing: false, routed: false, hiddenT: 0, goalT: 0, goalSeen: false, goalOff: 0, goalFrom: new THREE.Vector3() };
  private playerThink = 0;
  /** Skillshot dodges: bolt id -> whether this side reacts, which way, and when it starts moving. */
  private opponentDodge = new Map<number, BoltDodge>();
  private playerDodge = new Map<number, BoltDodge>();
  /** The opponent's CPU level (src/cpuLevels.ts): how fast it walks and casts, how it aims and dodges. The autopilot
   * always plays Normal. */
  cpuLevel: CpuLevel = CPU_BALANCE;
  /** Seconds before the opponent may cast again (its level's `castGap`, rolled after each cast). */
  private castWait = 0;
  /** The player's walk (m/s, smoothed over about 0.2 s): a level's `lead` aims ahead of it. */
  private playerVel = new THREE.Vector3();
  private playerLast: THREE.Vector3 | null = null;
  /** Seconds from cast to hit of each spell the opponent cast (its zones' latest impact): a level's lead goes by it. */
  private landsAfter = new Map<string, number>();
  /** Zone dodges (Hard, Master): the player's cast number -> whether the opponent reacts to it, and from when. */
  private zoneDodges = new Map<number, { react: boolean; at: number }>();
  /** The mouse is on the other hero: it gets a red outline, as in League (the attack cursor is hero mode's). */
  private hoverFoe = false;
  /** Arena hazards (src/arenas/hazards) in play duels and network duels. */
  hazardsOn = true;
  /** Also in 'run' duels. Off by default: balance runs (`_tourney`, `_ladder`) stay comparable. */
  hazardsInRuns = false;
  /** This round's hazard, and the fight clock that drives it (it starts when the fight does, on both screens). */
  private hazard: ArenaHazard | null = null;
  private hazardClock = 0;
  /** The seed of the next round's hazard: the match and round online, anything offline. */
  private hazardSeed = '';
  /** An AI's reaction to the hazard's event: rolled once per event. */
  private hazardRolls = new Map<Enemy, { id: number; react: boolean; at: number }>();
  private hazardWorld: HazardWorld;
  /** Arenas that change (src/arenas/shifts) in play duels and network duels. */
  shiftsOn = true;
  /** Also in 'run' duels. Off by default, like `hazardsInRuns`. */
  shiftsInRuns = false;
  /** For tests: seconds added to the clock the stages read. Set it on both screens before the fight. */
  shiftOffset = 0;
  /** This round's change, on the same fight clock as the hazard. */
  private shift: ArenaShift | null = null;
  private shiftWorld: ShiftWorld;
  /** The radius the walkable ring is shrinking to (Sky Ruins); `arena.bounds` is this round's own copy of `RING`. */
  private ringTo = RING.r;
  /** When this side's hero last reported a hazard online (the hub takes one per 0.3 s, and both kinds can land together). */
  private hazardSentAt = -Infinity;
  /** The boss fight on now (src/raid), and the boss the next `setup` is for. */
  boss: BossFight | null = null;
  private bossDef: BossDef | null = null;
  private bossHud: BossHud | null = null;
  private bossCard: ((result: 'win' | 'lose', seconds: number) => { title: string; text: string; again?: string } | null) | null = null;
  /** A tag team: who is in the ring, the other one's figure and where it stands. */
  private bossForm = 0;
  private rimFigure: HeroFigure | null = null;
  private rimAt = new THREE.Vector3();
  /**
   * Twin Flames (src/raid/twin.ts): the other of the two bosses, a body this screen only draws (`rimFigure`). `enemy`: a figure
   * with no meshes where it stands, for what aims at it (a partner across the wall, replayed). `mine`: which of the two is this
   * screen's enemy now. `fallT`: seconds since one of them fell (-1: both stand).
   */
  private twin: {
    defs: [BossDef, BossDef]; mine: number; half: number; halves: number[]; wall: Obstacle; enemy: Enemy; yaw: number; status: StatusSet; fallT: number; maxHp: number;
  } | null = null;
  /** The clock `late`'s first stage is at. */
  private lateAt = 0;
  /** The other players' heroes in a raid, by side: bodies this screen only draws (src/raid/partner.ts). */
  private party = new Map<number, Partner>();
  /** Seconds to the next look at which partners are drawn in full (the nearest few, in a big party). */
  private liteWait = 0;
  /** The party's list on screen, for a raid of more than two. */
  private partyEl: HTMLDivElement | null = null;
  private partyWait = 0;
  /** Which way the autopilot last stepped out of a boss's zone. */
  private pilotWay = new THREE.Vector3();
  /** How the autopilot plays (the raid tool tries it at different levels). */
  pilotLevel: CpuLevel = CPU_BALANCE;
  /** Duel simulations: the player's hero is driven by the same AI as the opponent. */
  autopilot = false;
  /** 'play': the player against the AI. 'run': AI against AI to watch (the autopilot drives the player's hero). */
  mode: 'play' | 'run' = 'play';
  /** The last finished round (duel simulations read it). */
  result: { player: string; opponent: string; winner: string; seconds: number; playerHp: number; opponentHp: number; playerCasts: number; opponentCasts: number; playerDodges: number; units: Record<string, SummonStats>; boss?: { killedBy: string; hits: Record<string, number>; kneels: number; phase: number } } | null = null;
  private stats = { playerCasts: 0, opponentCasts: 0, playerDodges: 0, opponentDodges: 0 };
  /** The player's recent casts (zones and aim), for the opponent's dodge check. */
  private playerCastsRecent: (EnemyCast & { t: number })[] = [];
  private time = 0;
  private over: 'win' | 'lose' | null = null;
  private overT = 0;
  private savedCount = 6;
  private round = 0;
  /** Network duel: the server link (null in the AI duel), the two player names, and the remote hero's last state. */
  net: DuelNet | null = null;
  private names: [string, string] = ['', ''];
  /** The remote hero's reported positions on this side's clock (ms, oldest first); drawn `PEER_DELAY` behind. */
  private peerTrack: { at: number; x: number; z: number; yaw: number }[] = [];
  /** This side's clock minus the sender's, from the quickest message so far (null: no sender clock yet). */
  private peerClock: number | null = null;
  private hitBypass = false;
  private castSeq = 0;
  /** The id of the other player's last basic attack (its hit report names it). */
  private peerAttackId = 0;
  /** The id of the other player's last cast: a passive's hit reports it (`TraitView.hitEnemy`). */
  private peerCastId = 0;
  /** Stack pips over the heroes and passive bursts (src/traits/fx.ts). */
  private traitFx = new TraitFx();
  /** Healing not yet sent to the server (network duel), and the clock that sends it. */
  private pendingHeal = 0;
  private healClock = 0;
  /** The identity layer of each side (src/traits); rebuilt every round. */
  heroRt: TraitRuntime | null = null;
  oppRt: TraitRuntime | null = null;
  /** The player's casts by the arena's cast number: slot and mods (the hits look them up). */
  private heroCasts = new Map<number, { slot: number; mods: CastMods }>();
  /** The player's last cast (sent with it in a network duel). */
  private heroLast: { slot: number; mods: CastMods } | null = null;
  /** Network ids of the player's casts and attacks: the server's hit reports name them. */
  private netIds = new Map<number, number | 'attack'>();
  private heroAttackMods: CastMods = NO_MODS;
  private oppCastSeq = 0;
  private oppAttackMods: CastMods = NO_MODS;
  /** Hit options already resolved (the arena's `hitMod` leaves them as they are). */
  private resolved = new WeakSet<HitOptions>();
  private countdown = -1;
  /** The fight has not started: the game's loading page and countdown are still to come. */
  private waiting = false;
  /** When the countdown ends (performance.now() ms): wall clock, so a client that stalls (a new arena compiling) still
   * unlocks with the other side instead of seconds later. */
  private countdownEnd = 0;
  private bannerT = 0;

  // HUD.
  private hud: HTMLDivElement;
  private bars: { fill: HTMLDivElement; shield: HTMLDivElement; chunks: HTMLDivElement; text: HTMLDivElement; name: HTMLDivElement; portrait: HTMLCanvasElement; extra: HTMLDivElement }[] = [];
  /** The HUD's two sides and what stands between them: a boss fight has no second duelist. */
  private hudSides: HTMLDivElement[] = [];
  private hudVs!: HTMLDivElement;
  private hudTop = '';
  /** How long this hero has lain fallen in a raid. */
  private downT = 0;
  private card: HTMLDivElement;
  private cardTitle: HTMLDivElement;
  private cardText: HTMLDivElement;
  private flash: HTMLDivElement;
  private banner: HTMLDivElement;
  private rematchButton!: HTMLButtonElement;
  private leaveButton!: HTMLButtonElement;

  constructor(private host: DuelHost) {
    this.group.add(this.zones.group, this.figure.group, this.oppAttackFx.group, this.traitFx.group);
    const arena = host.arena;
    this.oppAttack = new Attacker({
      arena,
      fx: this.oppAttackFx,
      self: () => this.foe!,
      spec: () => this.oppAttackSpec,
      land: (target, opts) => {
        const o = this.resolve('opponent', target, opts, this.oppAttackMods, 'attack');
        if (target === arena.caster) this.damagePlayer(o, this.net ? this.peerAttackId : undefined);
        else arena.hit(target, o);
      },
      posOf: (target) => target === arena.caster ? arena.caster.group.position
        : arena.summons.alive('hero').find((u) => u.figure === target)?.pos ?? null,
      released: (_target, echo) => {
        // An echo's second hit reuses the first one's mods (its damage share is in the hit itself).
        if (!echo && !this.net && this.oppRt && this.foe) this.oppAttackMods = this.oppRt.attack(arena.statusOf(this.foe)?.dealtMul ?? 1);
      },
      reach: () => (this.net ? 0 : this.oppRt?.attackReach() ?? 0),
      echo: () => (this.net ? 0 : this.oppRt?.attackEcho() ?? 0),
    });
    host.heroMode.onHover = (enemy) => { this.hoverFoe = !!enemy && enemy === this.foe; };
    this.hazardWorld = {
      camera: arena.camera,
      obstacles: () => arena.obstacles ?? [],
      targets: () => this.hazardTargets(),
      hit: (target, hit) => this.hazardHit(target, hit),
    };
    this.shiftWorld = {
      ...this.hazardWorld,
      crack: (i) => {
        // A wall the spells already broke stays broken.
        const o = this.currentArena?.obstacles[i];
        if (o?.kind === 'wall' && arena.obstacles?.includes(o)) this.arenaScene?.wallState?.(i, 'cracked');
      },
      remove: (i) => this.removeCover(i),
      topple: (i, dir, seconds) => this.arenaScene?.coverFall?.(i, dir, seconds),
      add: (cover) => this.addCover(cover),
      ring: (r) => { this.ringTo = r; },
    };
    this.group.visible = false;
    this.hud = this.buildHud();
    this.card = document.createElement('div');
    this.card.style.cssText =
      'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:9;display:none;flex-direction:column;' +
      'align-items:center;gap:10px;padding:22px 34px;border-radius:14px;background:rgba(8,6,10,0.92);' +
      'border:1px solid #6a5a3a;box-shadow:0 10px 40px rgba(0,0,0,0.7);font:600 13px ui-sans-serif,system-ui;color:#e9dcc6;';
    this.cardTitle = document.createElement('div');
    this.cardTitle.style.cssText = 'font:700 34px ui-serif,Georgia,serif;letter-spacing:3px;';
    this.cardText = document.createElement('div');
    this.cardText.style.cssText = 'opacity:0.8;';
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:10px;margin-top:6px;';
    const button = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      if (label === 'Rematch') this.rematchButton = b;
      else this.leaveButton = b;
      b.textContent = label;
      b.style.cssText =
        'padding:7px 16px;border-radius:7px;border:1px solid #8a7a52;background:#1e1a14;color:#f2e6c8;' +
        'font:600 13px ui-sans-serif,system-ui;cursor:pointer;';
      b.addEventListener('click', fn);
      buttons.appendChild(b);
    };
    button('Rematch', () => (this.onRematch ? this.onRematch() : this.start()));
    button('Leave duel', () => this.onLeave?.());
    this.card.append(this.cardTitle, this.cardText, buttons);
    this.flash = document.createElement('div');
    this.flash.style.cssText =
      'position:fixed;inset:0;z-index:8;pointer-events:none;opacity:0;' +
      'box-shadow:inset 0 0 120px 30px rgba(220,30,40,0.85);';
    this.banner = document.createElement('div');
    this.banner.style.cssText =
      'position:fixed;left:50%;top:30%;transform:translate(-50%,-50%);z-index:9;pointer-events:none;display:none;' +
      `font:800 ${TOUCH || innerWidth < 760 ? 34 : 54}px ui-serif,Georgia,serif;letter-spacing:4px;color:#ffd27a;text-shadow:0 4px 18px #000;` +
      'text-align:center;max-width:92vw;';
    document.body.append(this.card, this.flash, this.banner);
  }

  /** What "Leave duel" does: the tool turns the duel off and syncs its panel, the game goes back to its menu. */
  onLeave?: () => void;
  /** What "Rematch" does, when the game wants its own loading page first (default: start again at once). */
  onRematch?: () => void;
  /**
   * `start('play')` holds the fight until `countdownFrom`: the game shows its loading page first. The VFX tool leaves it off,
   * and AI-vs-AI runs never wait.
   */
  holdStart = false;
  /** A round is over ('win': the player won). The game's CPU match records a beaten level (src/game/cpu.ts). */
  onFinish?: (result: 'win' | 'lose') => void;

  /**
   * Console recipe, N AI fights with kit objects on either side (`vfx.testKits.melee` is a kit object):
   *   const v = vfx, K = v.testKits.melee; let w = 0;
   *   for (let i = 0; i < 10; i++) {
   *     v.heroMode.setKit(K);               // player side: a kit object (or v.heroPickCtrl.setValue('Lyra') for a hero)
   *     v.duel.opponentChoice = 'Lyra';     // opponent side: a hero name or a kit object
   *     v.duel.start('run');                // not v.setDuel(): it overwrites opponentChoice with the panel's string
   *     while (!v.duel.result) v.step(1 / 60);
   *     w += v.duel.result.winner === K.name;
   *   }
   */

  /** Starts (or restarts) a round against `opponentChoice`, never the player's own kit. */
  start(mode: 'play' | 'run' = this.mode) {
    this.endBoss();
    this.mode = mode;
    this.net = null;
    const arena = this.host.arena, hm = this.host.heroMode;
    const run = mode === 'run';
    this.autopilot = run;
    hm.spectate = run;
    hm.focus = run ? new THREE.Vector3(RING.x, 0, RING.z) : null;
    const player = hm.currentKit;
    const others = this.host.kits.filter((k) => k.name !== player.name);
    const choice = this.opponentChoice;
    const picked = typeof choice === 'string' ? others.find((k) => k.name === choice) : choice;
    this.opponentKit = picked ?? others[Math.floor(Math.random() * others.length)];
    this.hazardSeed = String(Math.random());
    this.setup(PLAYER_START, OPPONENT_START, arenaById(this.arenaChoice) ?? pickArena());
    this.waiting = !run && this.holdStart;
    if (this.waiting) hm.locked = true;
    else if (!run) this.showBanner(this.currentArena!.name, 1.6);
    arena.hitFilter = (target, opts, cast) => this.opponentHit(target, opts, cast);
    arena.casterHeal = (amount) => this.healPlayer(amount);
    arena.casterShield = null;
    hm.onCast = (_label, slot, target) => {
      this.recordPlayerCast();
      this.playerBlast(slot, target);
    };
  }

  /**
   * Starts a network duel against another player (src/game/match.ts): `opponent` is the other player's hero, `side`
   * 0 starts at the +Z end (like the AI duel), side 1 at the -Z end with the camera turned round. The hero stays
   * locked until `countdownFrom` runs out; the remote hero moves and casts from `peerMove` / `peerCast`.
   */
  startNet(o: { opponent: HeroKit; side: 0 | 1; names: [string, string]; net: DuelNet; arena?: string; arenaId?: string }) {
    this.endBoss();
    const arena = this.host.arena, hm = this.host.heroMode;
    this.mode = 'play';
    this.autopilot = false;
    hm.spectate = false;
    hm.focus = null;
    this.opponentKit = o.opponent;
    const [mine, theirs] = o.side === 0 ? [PLAYER_START, OPPONENT_START] : [OPPONENT_START, PLAYER_START];
    // `arena` is the round's seed: it picks the arena unless `arenaId` names one (a round's loser chose it), and it
    // drives the arena's events either way, so both screens stay on one schedule.
    this.hazardSeed = o.arena ?? '';
    this.setup(mine, theirs, (o.arenaId ? arenaById(o.arenaId) : undefined) ?? pickArena(o.arena));
    this.net = o.net;
    this.names = o.names;
    this.peerTrack = [];
    this.peerClock = null;
    this.castSeq = 0;
    this.waiting = true;
    this.think = Infinity; // no AI: the other player drives the opponent
    hm.flipCamera = o.side === 1;
    hm.snapCameraNow();
    hm.locked = true;
    // Hits on the remote hero only count when its own client reports them (`peerHit`); carries leave it alone too.
    arena.hitFilter = (target) => target !== this.foe || this.hitBypass;
    arena.remoteFigure = this.foe;
    hm.onCast = (_label, slot, target) => {
      this.sendCast(slot, target);
      this.playerBlast(slot, target);
    };
    // Heals and shields on this side's hero: the server counts the heal; the shield is shown on the other screen.
    arena.casterHeal = (amount) => this.healPlayer(amount);
    arena.casterShield = (amount, seconds, color) => this.net?.shield(amount, seconds, color);
    this.rematchButton.style.display = 'none';
    this.leaveButton.textContent = 'Back to menu';
    this.renderHud();
  }

  /**
   * Starts a boss fight (src/raid): this side's hero against `def`, on the vs-CPU path. The boss is `Duel.foe` and
   * `Duel.figure`, so spells land on it and traits see it as the enemy; `BossFight` takes the AI's place.
   */
  startBoss(o: {
    def: BossDef; link: RaidLink; seed: string; mode?: 'play' | 'run'; name?: string; partner?: { kit: HeroKit; name: string }; tier?: number; upgrades?: RunUpgrades;
    /** A raid of more than two: every other player's hero by its side (a raid for two may give `partner` instead). */
    party?: { side: number; kit: HeroKit; name: string }[];
    /** How many the boss is tuned for (the band): its room is as wide as that needs. 2 when not given. */
    band?: number;
    /** Twin Flames: `def` is this screen's of the two bosses (`BossDef.twin`), and this says who is in which half. */
    twin?: TwinSetup;
    /** What the result card says, or null for no card: the run goes on by itself. */
    card?: (result: 'win' | 'lose', seconds: number) => { title: string; text: string; again?: string } | null;
    /** The health the hero starts with (the Tower: what it left the last floor with), never more than its max in this fight. Full when not given. */
    hp?: number;
  }) {
    this.endBoss();
    o.def.resize?.(o.band ?? 2);
    this.bossCard = o.card ?? null;
    const mode = o.mode ?? 'play', run = mode === 'run';
    const arena = this.host.arena, hm = this.host.heroMode;
    this.mode = mode;
    this.net = null;
    this.autopilot = run;
    hm.spectate = run;
    hm.focus = run ? new THREE.Vector3(RING.x, 0, RING.z) : null;
    this.cpuLevel = CPU_BALANCE;
    this.opponentKit = o.def.kit(o.link.maxHp);
    this.hazardSeed = o.seed;
    this.bossDef = o.def;
    const { boss: from, heroes } = o.def.starts;
    const others = o.party ?? (o.partner ? [{ side: 1 - o.link.side, ...o.partner }] : []);
    const big = others.length > 1;
    // Twin Flames: each half comes in on its own side of the wall of fire, in rows, in the order of the seats.
    const tw = o.def.twin && o.twin ? { ...o.twin, def: o.def.twin } : null;
    const twinStart = (side: number) => {
      const half = tw!.halves[side] === 1 || (tw!.halves[side] === undefined && tw!.half === 1) ? 1 : 0;
      return tw!.def.heroStart(half, tw!.halves.slice(0, side).filter((h) => h === half).length);
    };
    const start = tw ? twinStart(o.link.side) : big ? o.def.partySpot?.(o.link.side) ?? partyStart(heroes[0], o.link.side) : heroes[o.link.solo ? 0 : o.link.side + 1];
    this.setup(new THREE.Vector3(start.x, 0, start.z), new THREE.Vector3(from.x, 0, from.z), o.def.place);
    const foe = this.foe;
    if (!foe) throw new Error('A boss fight with no boss');
    foe.body = { ...o.def.body };
    arena.pinned = foe;
    arena.foeFloor = 1;
    arena.onFoeDamage = (target, dealt) => { if (target === foe) this.boss?.damaged(dealt); };
    arena.onFoeDebuff = (target, kind, amount, seconds) => { if (target === foe) this.boss?.debuffed(kind, amount, seconds); };
    arena.statusGate = (target, kind, seconds) => (target === foe && this.boss ? this.boss.control(kind, seconds) : seconds);
    this.bossHud ??= new BossHud();
    this.figure.setBodyPhase(0);
    this.hinted.clear();
    if (tw) {
      // The other of the two, across the wall: drawn only. Nothing of this hero's can hit it until the one here has fallen.
      const defs = tw.def.pair(), mine = tw.def.which, other = defs[1 - mine], at = other.starts.boss;
      const enemy = new Enemy({ bare: true });
      enemy.body = null;
      enemy.group.position.set(at.x, 0, at.z);
      this.twin = { defs, mine, half: mine, halves: tw.halves, wall: tw.def.wall, enemy, yaw: 0, status: new StatusSet(), fallT: -1, maxHp: o.link.maxHp };
      this.rimAt.set(at.x, 0, at.z);
      this.rimFigure ??= new HeroFigure();
      this.group.add(this.rimFigure.group);
      const kit = other.kit(tw.hp[1 - mine]);
      this.rimFigure.setModel(kit.model, this.rimAt, kit);
      this.rimFigure.setScale(other.scale);
      this.rimFigure.setBodyPhase(0);
      this.rimFigure.stand();
      this.rimFigure.preload(this.opponentKit.model ?? '');
      this.figure.preload(kit.model ?? '');
    }
    this.boss = new BossFight(o.def, o.link, this.bossWorld(), o.seed, this.bossHud, o.tier ?? 1, o.upgrades ?? null, tw);
    this.group.add(this.boss.group);
    // The run's upgrades: one more layer on the hero, for this fight.
    const up = o.upgrades;
    up?.newFight();
    if (up) {
      this.playerMax = Math.round(this.playerMax * up.hpMul());
      this.playerHp = this.playerMax;
      hm.speedBonus = up.speedMul;
      if (up.has('ricochet')) arena.heroBolt = (po) => ({ ...po, reflect: (po.reflect ?? 0) + 1, reflectBonus: po.reflectBonus ?? 0 });
    }
    const late = o.def.late?.();
    if (late) {
      this.shift = late.shift;
      this.shiftOffset = late.offset;
      this.lateAt = late.startsAt ?? 0;
      this.group.add(late.shift.group);
    }
    // A tag team: the other one on the rim, drawn only. Nothing can hit it.
    const forms = o.def.forms;
    this.bossForm = 0;
    if (forms) {
      const spot = o.def.rimSpots?.[0] ?? { x: 0, z: -7 };
      this.rimAt.set(spot.x, 0, spot.z);
      this.rimFigure ??= new HeroFigure();
      this.group.add(this.rimFigure.group);
      const other = forms[1].kit(o.link.maxHp);
      this.rimFigure.setModel(other.model, this.rimAt, other);
      this.rimFigure.setScale(forms[1].scale);
      this.rimFigure.setBodyPhase(0);
      this.rimFigure.stand();
      this.rimFigure.preload(forms[0].kit(o.link.maxHp).model ?? '');
      this.figure.preload(other.model ?? '');
    }
    // Noonfall's hall: only walking, and no bars.
    if (o.def.hall) hm.setWalkOnly(true);
    // A phone held upright sees about 14 m across a floor of 32: it starts from as far back as the camera goes.
    if (!run && TOUCH && hm.portrait && this.zoomBefore === null) this.zoomBefore = hm.setZoom(1.7);
    this.names = [o.name ?? '', others.length === 1 ? others[0].name : ''];
    for (const m of others) {
      const at = tw ? twinStart(m.side) : big ? o.def.partySpot?.(m.side) ?? partyStart(heroes[0], m.side) : heroes[o.link.side === 0 ? 2 : 1];
      const p = new Partner(m.kit, m.name, new THREE.Vector3(at.x, 0, at.z), arena, () => this.foeFor(m.side));
      this.party.set(m.side, p);
      this.group.add(p.group);
    }
    this.liteWait = 0;
    // The boss's bar and cast bar take the top: this hero's own bar goes to a corner under them, the partner's below it.
    // On a phone the hero panel holds the left corner, so they go under the Leave button. A bigger party gets a list instead.
    this.hudSides[1].style.display = others.length === 1 ? '' : 'none';
    if (big) this.showParty();
    this.hudVs.style.display = 'none';
    this.hud.style.flexDirection = 'column';
    this.hud.style.alignItems = 'flex-start';
    const small = TOUCH || innerWidth < 760;
    this.hud.style.top = `calc(${small ? 94 : 86}px + env(safe-area-inset-top, 0px))`;
    this.hud.style.left = small ? 'auto' : '12px';
    this.hud.style.right = small ? '6px' : 'auto';
    this.hud.style.transform = 'none';
    this.waiting = !run && this.holdStart;
    if (this.waiting) hm.locked = true;
    arena.hitFilter = (target, opts, cast) => {
      // A stage: the boss can't be hurt, its adds can.
      if (target === this.foe && this.bossGuard) {
        this.immune(target);
        return false;
      }
      return this.opponentHit(target, opts, cast);
    };
    arena.casterHeal = (amount) => this.healPlayer(amount);
    arena.casterShield = null;
    hm.onCast = (_label, slot, target) => {
      this.recordPlayerCast();
      this.playerBlast(slot, target);
      this.raidCast(slot, target);
    };
    if (o.hp !== undefined) this.playerHp = Math.max(1, Math.min(this.playerMax, Math.round(o.hp)));
    this.renderHud();
    if (o.def.hall) this.hud.style.display = 'none';
  }

  /** A hero stands in Noonfall's hall, between fights. */
  get inHall() {
    return !!this.bossDef?.hall;
  }

  /** This hero cast in a raid for two: the partner's screen replays it. */
  private raidCast(slot: number, target: Target) {
    const link = this.boss?.link;
    if (!link || link.solo) return;
    const me = this.host.arena.caster.group.position;
    const p = 'enemy' in target ? target.enemy.group.position : target.point;
    const bend = this.host.heroMode.castBend;
    link.heroCast({ id: ++this.castSeq, slot, x: p.x, z: p.z, fx: me.x, fz: me.z, enemy: 'enemy' in target, yaw: +this.host.arena.caster.group.rotation.y.toFixed(3), bend: bend ? +bend.toFixed(3) : undefined });
  }

  /** Twin Flames: the wall of fire still stands. */
  private twinWall() {
    return !!this.twin && !!this.host.arena.obstacles?.includes(this.twin.wall);
  }

  /** Whether this screen's hero can get to (x, z): in Twin Flames, while the wall of fire stands, only what is in its own half. */
  private reachable(at: { x: number; z: number }) {
    const t = this.twin;
    if (!t || !this.twinWall()) return true;
    return (at.x < t.wall.ax) === (t.half === 0);
  }

  /**
   * Twin Flames: nothing takes a hero through the wall of fire while it stands. A walk and a blow stop at it as at any cover; a
   * dash, a blink or a leap aimed across it would not (the engine lets those pass cover), so each frame a hero found on the
   * wrong side, or in the fire, is put back at the wall's face in its own half.
   */
  private holdHalf() {
    const t = this.twin;
    if (!t || !this.twinWall()) return;
    const me = this.host.arena.caster.group.position, side = t.half === 0 ? -1 : 1, face = t.wall.ax + side * (t.wall.r + BODY_RADIUS);
    if ((me.x - face) * side < 0) this.shove(() => { me.x = face; });
  }

  /** The enemy a partner's replayed spells and attacks aim at: this screen's boss, or in Twin Flames the one on that partner's side of the wall. */
  private foeFor(side: number): Enemy | null {
    const t = this.twin;
    // While both stand each hero has its own of the two, wall of fire or not (the pit floods: the wall is out, and both still stand).
    return t && t.fallT < 0 && (t.halves[side] ?? t.mine) !== t.mine ? t.enemy : this.foe;
  }

  /** The fallen partner nearest this hero that can still get up, if any. */
  private fallenNear() {
    const me = this.host.arena.caster.group.position;
    let best: Partner | null = null, bd = Infinity;
    for (const p of this.party.values()) {
      if (!p.down || p.left || p.revivesLeft <= 0 || !this.reachable(p.pos)) continue;
      const d = flat(p.pos, me);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /**
   * The fallen partner an AI goes to get up: the nearest one, if this hero is the nearest of those standing to it. In a party
   * everyone walking to one fallen hero, and casting nothing there, is a crowd in one spot for whatever lands next.
   */
  private fallenMine() {
    const p = this.fallenNear();
    if (!p) return null;
    const mine = flat(p.pos, this.host.arena.caster.group.position);
    for (const q of this.party.values()) if (q !== p && !q.down && !q.left && this.reachable(q.pos) && flat(q.pos, p.pos) < mine) return null;
    return p;
  }

  /** The one partner of a raid for two: its bar takes the opponent's place. */
  private get partner() {
    return this.party.size === 1 ? this.party.values().next().value ?? null : null;
  }

  /** A partner's reported position (src/raid/partner.ts). */
  partnerMove(side: number, x: number, z: number, yaw: number, ts?: number) {
    this.party.get(side)?.track.push(x, z, yaw, ts);
  }

  /**
   * The partner cast a spell: it plays here from the partner's figure, aimed at the boss or the spot it chose, and nothing
   * in it counts. Hits, statuses, carries, units and what touches this screen's hero are all left out, because its own
   * screen decides them. Temporary walls and broken walls stay, so boss rays stop at the same cover on both screens.
   */
  partnerCast(side: number, m: PeerCast) {
    const p = this.party.get(side), foe = this.foeFor(side), arena = this.host.arena;
    if (!this.on || this.over || !p || !foe) return;
    const spell = p.kit.spells[m.slot];
    const spec = spell && this.host.targeting(spell.label);
    if (!spec) return;
    const told = new THREE.Vector3(m.fx, 0, m.fz);
    if (p.pos.distanceTo(told) > PEER_SNAP) p.pos.copy(told);
    // The game keeps one effect per spell: a replay of a spell this screen's own hero has would cut its own cast short, hits
    // and all. Then only the pose shows. A far stand-in shows nothing at all (its replay would cost a phone for no one).
    const own = this.host.heroMode.currentKit, base = own.base ?? own;
    const mine = [...base.spells, ...(base.alt?.spells ?? [])].some((s) => s.label === spell.label);
    if (mine || p.lite) {
      if (!p.lite) p.figure.cast(castStyle(spell, m.slot, m.enemy, attackFor(p.kit).kind === 'melee', 0.6), 0.6, m.slot === 3);
      return;
    }
    const from = p.pos.clone().setY(0);
    const at = foe.group.position;
    const point = spec.mode === 'self' ? from.clone() : m.enemy ? at.clone().setY(0) : new THREE.Vector3(m.x, 0, m.z);
    const targets = spec.mode === 'self' ? (flat(from, at) <= (spec.radius ?? 5) ? [foe] : []) : [foe];
    const ctx = arena.contextFor({
      caster: p.enemy,
      from,
      point,
      targets,
      enemy: foe,
      aim: spec.mode === 'self' && m.yaw !== undefined ? m.yaw : undefined,
      sentFrom: told,
      bend: m.bend ?? 0,
      targetPos: targets.map((t) => t.group.position.clone()),
      hit: () => {},
    });
    ctx.shieldSelf = ctx.healSelf = ctx.moveCaster = undefined;
    ctx.summon = undefined;
    ctx.carry = undefined;
    ctx.confine = undefined;
    ctx.boltWall = undefined;
    ctx.displace = () => {};
    ctx.enemies = () => [foe];
    const zones = this.host.castAs(spell.label, ctx);
    const impact = zones.length ? Math.max(...zones.map((z) => z.impact)) : 0.5;
    const hold = Math.min(impact, 2.5);
    p.figure.cast(castStyle(spell, m.slot, m.enemy, attackFor(p.kit).kind === 'melee', hold), hold, m.slot === 3);
    this.blastWalls(told, spec.mode === 'self' ? told.clone() : new THREE.Vector3(m.x, 0, m.z), spec, spell, m.slot);
  }

  /** The partner's hero slowed or debuffed the boss: it counts here too, and goes no further. `which`: Twin Flames, on which of the two. */
  bossDebuff(kind: BossDebuff, amount: number, seconds: number, which?: number) {
    const foe = this.foe, arena = this.host.arena;
    if (!this.boss || !foe || (which !== undefined && this.boss.which !== undefined && which !== this.boss.which)) return;
    if (kind !== 'slow') {
      arena.applyBuff(foe, kind, amount, seconds);
      return;
    }
    // The gate has already shortened this slow on the partner's screen, and would pass it back.
    const gate = arena.statusGate;
    arena.statusGate = null;
    arena.applyStatus(foe, 'slow', seconds);
    arena.statusGate = gate;
  }

  /** A partner released a basic attack at the boss: only the look. */
  partnerAttack(side: number) {
    const p = this.party.get(side), foe = this.foeFor(side);
    if (foe && !this.over && p && !p.lite) p.attacker.releaseNow(foe);
  }

  /** A two-kit partner brought in its other half. */
  partnerForm(side: number, alt: boolean) {
    this.party.get(side)?.useForm(alt);
  }

  /** A partner's HP, from its own screen. */
  partnerHp(side: number, hp: number, max: number) {
    const p = this.party.get(side);
    if (!p) return;
    p.hp = hp;
    p.max = max;
  }

  /** A hero fell in a raid. This screen's own fall was its own news. */
  raidDown(side: number) {
    if (this.boss && side !== this.boss.link.side) this.party.get(side)?.fall();
  }

  /** A hero got up. If it is this screen's, it can move again. */
  raidRevived(side: number, hp: number, left: number) {
    const fight = this.boss, hm = this.host.heroMode, arena = this.host.arena;
    if (!fight) return;
    if (side !== fight.link.side) {
      const p = this.party.get(side);
      p?.rise(hp, left);
      if (p) arena.say('UP!', '#ffe27a', p.pos, 1.2);
      return;
    }
    if (!fight.meDown) return;
    fight.meDown = false;
    this.playerHp = hp;
    hm.locked = false;
    hm.standHero();
    arena.say('UP!', '#ffe27a', arena.caster.group.position, 1.2);
  }

  /** A partner left: the boss goes on without it. */
  partnerLeft(side: number) {
    const p = this.party.get(side);
    if (!p) return;
    p.left = true;
    p.down = true;
    this.clearPartnerMarks(side);
    if (this.party.size === 1) this.hudSides[1].style.display = 'none';
  }

  private clearPartnerMarks(side?: number) {
    for (const s of side === undefined ? [...this.party.keys()] : [side]) {
      this.traitFx.plate(`partner${s}`, null, 0, null);
      this.traitFx.label(`partner${s}`, null, 0, null);
      this.traitFx.ring(`partner${s}`, null, null);
    }
  }

  /** The list of a big party on screen: each hero's name and HP, the fallen greyed. */
  private showParty() {
    if (!this.partyEl) {
      this.partyEl = document.createElement('div');
      this.partyEl.className = 'raid-party';
      const small = TOUCH || innerWidth < 760;
      this.partyEl.style.cssText = `position:fixed;z-index:6;pointer-events:none;left:${small ? 'auto' : '12px'};right:${small ? '6px' : 'auto'};` +
        `top:calc(${small ? 150 : 150}px + env(safe-area-inset-top, 0px));display:flex;flex-direction:column;gap:2px;font:600 ${small ? 9 : 11}px ui-sans-serif,system-ui;color:#e9e4d6;`;
      document.body.append(this.partyEl);
    }
    this.partyEl.style.display = '';
    this.partyWait = 0;
  }

  /** The list's rows: the nearest first; on a phone at most 8, then how many more. */
  private renderParty() {
    const el = this.partyEl;
    if (!el || this.party.size < 2) return;
    const me = this.host.arena.caster.group.position;
    const list = [...this.party.values()].filter((p) => !p.left).sort((a, b) => flat(a.pos, me) - flat(b.pos, me));
    const cap = TOUCH || innerWidth < 760 ? 8 : 14;
    const rows = list.slice(0, cap).map((p) => {
      const w = p.down ? 0 : Math.max(0, Math.min(100, (100 * p.hp) / (p.max || 1)));
      return `<div style="display:flex;align-items:center;gap:5px;opacity:${p.down ? 0.45 : 1}"><span style="width:7px;height:7px;border-radius:50%;background:${p.kit.accent}"></span>` +
        `<span style="width:${TOUCH ? 62 : 92}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)}</span>` +
        `<span style="width:${TOUCH ? 38 : 56}px;height:5px;border-radius:3px;background:#0009;overflow:hidden"><span style="display:block;height:100%;width:${w}%;background:${p.down ? '#777' : '#6fd88a'}"></span></span></div>`;
    });
    if (list.length > cap) rows.push(`<div style="opacity:0.7">+${list.length - cap} more</div>`);
    const up = list.filter((p) => !p.down).length;
    el.innerHTML = `<div style="opacity:0.75;margin-bottom:1px">Party: ${up + (this.playerHp > 0 ? 1 : 0)} of ${list.length + 1} up</div>` + rows.join('');
  }

  /** A boss that stands between the camera and a hero on this screen lets the hero show through. */
  private bossFade(cam: THREE.Camera) {
    const foe = this.foe, forms = this.bossDef?.forms;
    this.figure.setFade(this.boss && foe?.body && this.hidesHero(cam, foe.group.position, foe.body) ? 1 : 0);
    const t = this.twin;
    if (this.boss && t) this.rimFigure?.setFade(this.hidesHero(cam, t.enemy.group.position, t.defs[1 - t.mine].body) ? 1 : 0);
    else if (this.boss && forms) this.rimFigure?.setFade(this.hidesHero(cam, this.rimAt, forms[1 - this.bossForm].body) ? 1 : 0);
  }

  /** Whether a body at `at` stands in the line of sight from the camera to this hero or the partner. */
  private hidesHero(cam: THREE.Camera, at: { x: number; z: number }, body: { radius: number; height: number }) {
    const c = cam.position;
    const hides = (hero: { x: number; z: number }) => {
      const dx = hero.x - c.x, dz = hero.z - c.z;
      // Where along the line the body is: 0 at the camera, 1 at the hero. Past the hero it hides nothing.
      const t = ((at.x - c.x) * dx + (at.z - c.z) * dz) / (dx * dx + dz * dz || 1);
      if (t <= 0 || t >= 1) return false;
      return Math.hypot(c.x + dx * t - at.x, c.z + dz * t - at.z) < body.radius + HIDE_PAD && c.y + (HERO_CHEST - c.y) * t < body.height;
    };
    if (hides(this.host.arena.caster.group.position)) return true;
    for (const p of this.party.values()) if (!p.left && !p.lite && hides(p.pos)) return true;
    return false;
  }

  /** The tag team's one on the rim: it looks at the middle, and at nothing else. */
  private rimStep(dt: number) {
    const t = this.twin;
    if (t && this.rimFigure) {
      // Twin Flames: the other boss walks where its brain's screen says, kneels when the hub says, and lies where it fell.
      t.status.update(dt);
      this.rimFigure.follow(dt, t.enemy.group.position, t.yaw, { status: t.status });
      if (t.fallT >= 0) this.rimFigure.fall(Math.min(1, (t.fallT += dt) / 0.6));
      return;
    }
    if (this.rimFigure && this.bossDef?.forms) this.rimFigure.follow(dt, this.rimAt, Math.atan2(RING.x - this.rimAt.x, RING.z - this.rimAt.z), {});
  }

  /** Twin Flames: the other boss on this screen, and what happens here when one of the two falls. */
  private twinWorld(): TwinWorld {
    return {
      at: () => this.twin?.enemy.group.position ?? this.rimAt,
      place: (x, z, yaw) => {
        const t = this.twin;
        if (!t || t.fallT >= 0) return;
        t.enemy.group.position.set(x, 0, z);
        t.yaw = yaw;
      },
      phase: (i) => this.rimFigure?.setBodyPhase(i),
      rage: (on) => this.rimFigure?.setBodyRage(on),
      kneel: (seconds) => this.twin?.status.hold(seconds),
      wallUp: () => this.twinWall(),
      fell: (dead, hp) => this.twinFell(dead, hp),
      swap: (hp) => this.twinSwap(hp),
    };
  }

  /**
   * The Changing of the Flames: this screen's hero is dealt into the other half while both of the two stand. The other boss becomes
   * the enemy here (its model, its spot, its HP), and the one it fought becomes the body that is only drawn. The hero is held in
   * its new half from the next frame on (`holdHalf` puts it through the wall of fire if it has not walked through a gate).
   */
  private twinSwap(hp: number) {
    const t = this.twin, foe = this.foe, arena = this.host.arena;
    if (!t || !foe || t.fallT >= 0) return;
    const next = t.defs[1 - t.mine], last = t.defs[t.mine];
    const from = foe.group.position.clone(), to = t.enemy.group.position.clone(), yaw = foe.group.rotation.y;
    t.mine = t.half = 1 - t.mine;
    this.bossDef = next;
    const kit = next.kit(t.maxHp);
    this.opponentKit = kit;
    this.oppAttackSpec = attackFor(kit);
    this.figure.setModel(kit.model, to, kit);
    this.figure.setScale(next.scale);
    foe.body = { ...next.body };
    arena.clearStatuses(foe);
    arena.placeFoe(foe, to);
    foe.group.rotation.y = t.yaw;
    arena.setHp(foe, Math.max(1, hp));
    this.foeHeld = 0;
    t.enemy.group.position.copy(from);
    t.yaw = yaw;
    const other = last.kit(t.maxHp);
    this.rimFigure?.setModel(other.model, from, other);
    this.rimFigure?.setScale(last.scale);
    this.rimFigure?.stand();
    t.status = new StatusSet();
  }

  /**
   * One of Twin Flames' two fell: the wall of fire goes out. If it was this screen's enemy, the other takes its place as the enemy
   * here (its model, its spot, its HP), and the fallen one becomes the body that is only drawn, lying where it stood.
   */
  private twinFell(dead: number, hp: number) {
    const t = this.twin, foe = this.foe, arena = this.host.arena;
    if (!t || !foe || t.fallT >= 0) return;
    if (this.currentArena) this.removeCover(this.currentArena.obstacles.indexOf(t.wall));
    if (dead === t.mine) {
      const next = t.defs[1 - dead], last = t.defs[dead];
      const from = foe.group.position.clone(), to = t.enemy.group.position.clone(), yaw = foe.group.rotation.y;
      t.mine = 1 - dead;
      this.bossDef = next;
      const kit = next.kit(t.maxHp);
      this.opponentKit = kit;
      this.oppAttackSpec = attackFor(kit);
      this.figure.setModel(kit.model, to, kit);
      this.figure.setScale(next.scale);
      foe.body = { ...next.body };
      arena.clearStatuses(foe);
      arena.moveFoe(foe, to.clone().sub(from));
      foe.group.rotation.y = t.yaw;
      arena.setHp(foe, Math.max(1, hp));
      this.foeHeld = 0;
      t.enemy.group.position.copy(from);
      t.yaw = yaw;
      const fallen = last.kit(t.maxHp);
      this.rimFigure?.setModel(fallen.model, from, fallen);
      this.rimFigure?.setScale(last.scale);
      this.rimFigure?.setBodyRage(false);
    }
    t.fallT = 0;
    t.status = new StatusSet();
  }

  /** The partners' bars and names over their heads, and whether this hero is getting one up. */
  private partnerStep(dt: number, cam: THREE.Camera) {
    const fight = this.boss, arena = this.host.arena;
    if (!fight || !this.party.size) return;
    const me = arena.caster.group.position;
    // A big party: the nearest few in full, the rest as light stand-ins (pipeline/designs/raid-party.md), looked at twice a second.
    if ((this.liteWait -= dt) <= 0) {
      this.liteWait = 0.5;
      const full = TOUCH ? PARTY_FULL_PHONE : PARTY_FULL;
      const near = [...this.party.values()].filter((p) => !p.left).sort((a, b) => flat(a.pos, me) - flat(b.pos, me));
      near.forEach((p, i) => p.setLite(i >= full));
    }
    if (this.partyEl && (this.partyWait -= dt) <= 0) {
      this.partyWait = 0.25;
      this.renderParty();
    }
    let reviving = false;
    for (const [side, p] of this.party) {
      p.update(dt);
      if (p.left) continue;
      // In a big party the bars over every head hid the fight: only the names stay there, and the list has everyone's HP.
      const key = `partner${side}`, shown = p.down || p.lite ? null : p.pos, big = this.party.size > 1;
      const y = plateHeight(p.enemy);
      const top = big ? y : this.traitFx.plate(key, shown, y, shown ? { hp: p.hp, max: p.max, mine: true, shield: 0, chunks: p.kit.hpChunks ?? 0, meter: null } : null, cam);
      // In a big party a stand-in's name shows only when it is down: a fallen hero must be found.
      const label = p.down ? (p.revivesLeft > 0 ? { text: `${p.name}: stand here`, color: '#ffe27a' } : { text: p.name, color: '#a8a0a0' }) : p.lite ? null : { text: p.name, color: '#a8e0b0' };
      this.traitFx.label(key, label ? p.pos : null, p.lite ? 1.9 : top + 0.4, label);
      this.traitFx.ring(key, big ? null : shown, { radius: 0.9, color: p.kit.accent, opacity: 0.55 });
      if (!p.down || p.revivesLeft <= 0 || reviving) {
        if (!p.down) p.revive = 0;
        continue;
      }
      // Hits don't stop it, casting does. One at a time.
      const near = !fight.meDown && flat(me, p.pos) <= REVIVE_REACH && !this.host.heroMode.isRooted;
      p.revive = near ? p.revive + dt : Math.max(0, p.revive - dt);
      if (near) reviving = true;
      if (p.revive >= REVIVE_TIME) {
        p.revive = 0;
        fight.link.revive(side);
      }
    }
  }

  /** A tag team swaps: the one on the rim lands at (x, z), the one in the ring goes up to the rim at (rx, rz). */
  private bossTag(form: number, x: number, z: number, rx: number, rz: number) {
    const fight = this.boss, forms = this.bossDef?.forms, foe = this.foe, arena = this.host.arena;
    if (!fight || !forms || !foe || form === this.bossForm) return;
    const maxHp = fight.link.maxHp, next = forms[form], last = forms[this.bossForm];
    this.bossForm = form;
    const kit = next.kit(maxHp);
    this.opponentKit = kit;
    this.oppAttackSpec = attackFor(kit);
    this.figure.setModel(kit.model, foe.group.position, kit);
    this.figure.setScale(next.scale);
    foe.body = { ...next.body };
    fight.tagged();
    arena.moveFoe(foe, new THREE.Vector3(x - foe.group.position.x, 0, z - foe.group.position.z));
    this.rimAt.set(rx, 0, rz);
    const up = last.kit(maxHp);
    this.rimFigure?.setModel(up.model, this.rimAt, up);
    this.rimFigure?.setScale(last.scale);
    this.showBanner(`${next.name} steps in`, 1.2, '26px');
  }

  /** Fresh Start: a shield as each phase begins. */
  private freshShield() {
    const share = this.boss?.upgrades?.phaseShield ?? 0;
    if (share > 0 && this.playerHp > 0) this.host.arena.shieldFigure(this.host.arena.caster, share * this.playerMax, 20, '#ffe27a');
  }

  /** The boss's figure, for what streams its walk (src/raid/coop.ts). */
  get bossFigure() {
    return this.boss ? this.foe : null;
  }

  /** This hero's HP now. */
  get heroHp() {
    return this.playerHp;
  }

  /** The fight on this screen has ended. */
  get isOver() {
    return !!this.over;
  }

  /** The result card waits on someone: it says so and its button goes. `done`: the run has ended, so it says that instead. */
  waitingOn(text: string, done = false) {
    this.rematchButton.style.display = 'none';
    this.cardText.textContent = done ? text : `${this.cardText.textContent} ${text}.`;
  }

  /** This hero's max HP now, with what the run's upgrades add. */
  get heroMax() {
    return this.playerMax;
  }

  /** What a boss's share of HP is a share of: the hero's own max, so what an upgrade adds to it really takes more hits to lose. */
  private get hitBase() {
    const up = this.boss?.upgrades;
    return up ? this.playerMax / up.hpMul() : this.playerMax;
  }

  /** New words on the result card, with its buttons as they are. */
  cardLine(text: string) {
    this.cardText.textContent = text;
  }

  /** The result card is up. */
  get cardShown() {
    return this.card.style.display === 'flex';
  }

  /** What a boss fight may do to the duel. */
  private bossWorld(): BossWorld {
    const arena = this.host.arena;
    const foe = this.foe!;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    return {
      camera: arena.camera,
      boss: () => foe.group.position,
      walk: (dt, x, z, speed) => {
        const at = foe.group.position;
        const move = this.goalStep(this.opponentAi, at, { x, z });
        if (move.lengthSq() > 0) arena.moveFoe(foe, move.multiplyScalar(speed * (arena.statusOf(foe)?.speedMul ?? 1) * dt), !this.opponentAi.routed);
      },
      face: (yaw) => { foe.group.rotation.y = yaw; },
      floor: () => arena.aiBounds ?? arena.bounds ?? { x: RING.x, z: RING.z, r: RING.r },
      canWalk: (ax, az, bx, bz) => arena.aiPathClear(a.set(ax, 0, az), b.set(bx, 0, bz)),
      pose: (style, seconds, big) => this.figure.cast(style, seconds, big),
      act: (name, step, x, z, seconds) => this.figure.act(name, step, x, z, seconds),
      actRim: (name, step, x, z, seconds) => this.rimFigure?.act(name, step, x, z, seconds),
      poseRim: (style, seconds, big) => this.rimFigure?.cast(style, seconds, big),
      tag: (form, x, z, rx, rz) => this.bossTag(form, x, z, rx, rz),
      dash: (x, z, seconds) => { arena.moveFigure(foe, new THREE.Vector3(x, 0, z), seconds); },
      carryMe: (dx, dz) => this.shove(() => arena.carryFigure(arena.caster, new THREE.Vector3(dx, 0, dz))),
      lateNow: () => { this.shiftOffset = Math.max(this.shiftOffset, this.lateAt - this.hazardClock); },
      delayLate: (seconds) => { this.shiftOffset -= seconds; },
      bodyPhase: (i) => {
        this.figure.setBodyPhase(i);
        // A tag team shares its phases; Twin Flames' other boss has its own (`TwinWorld.phase`).
        if (!this.twin) this.rimFigure?.setBodyPhase(i);
      },
      hint: (text) => {
        if (this.hinted.has(text) || this.mode !== 'play') return;
        this.hinted.add(text);
        this.showBanner(text, 2.8, '22px');
      },
      busy: () => this.host.heroMode.isRooted,
      heavy: (on) => { this.host.heroMode.speedBonus = (this.boss?.upgrades?.speedMul ?? 1) * (on && (this.boss?.upgrades?.shardSlows ?? true) ? SHARD_WALK : 1); },
      mute: (on) => { this.host.heroMode.castLock = on; },
      shieldMe: (share, seconds, color) => {
        if (this.playerHp > 0) arena.shieldFigure(arena.caster, share * this.hitBase, seconds, color);
      },
      nearMiss: (seconds) => {
        if (this.playerHp <= 0) return;
        const hm = this.host.heroMode;
        for (let i = 0; i < 4; i++) hm.setCooldown(i, hm.cooldownOf(i) - seconds);
        arena.say('CLOSE CALL', '#ffcf4a', arena.caster.group.position, 1.2);
      },
      addStone: (x, z, radius, seconds) => {
        // A stone raised under the hero pushes it out: no walk of its own.
        let o!: Obstacle;
        this.shove(() => { o = arena.addObstacle({ ...pillar(x, z, radius), height: 2.4 }, seconds); });
        this.stones.add(o);
        return o;
      },
      firstStone: (ax, az, bx, bz) => {
        const o = sweepHit(a.set(ax, 0, az), b.set(bx, 0, bz), 0, arena.obstacles ?? [])?.obstacle;
        return o && this.stones.has(o) ? o : null;
      },
      dropStone: (o) => arena.removeObstacle(o),
      enemyCast: (big) => { if (this.heroRt) this.heroRt.trait?.enemyCast?.(this.heroRt, big ? 3 : 0); },
      place: (x, z, yaw) => {
        const p = foe.group.position;
        const move = new THREE.Vector3(x - p.x, 0, z - p.z);
        if (move.lengthSq() > 1e-8) arena.moveFoe(foe, move);
        foe.group.rotation.y = yaw;
      },
      setBossHp: (hp) => arena.setHp(foe, Math.max(1, hp)),
      guard: (on) => {
        this.bossGuard = on;
        arena.untargetable = on ? foe : null;
      },
      shake: (amount) => { if (this.mode === 'play') this.host.heroMode.hitShake = Math.max(this.host.heroMode.hitShake, amount); },
      bodyRage: (on) => {
        this.figure.setBodyRage(on);
        if (!this.twin) this.rimFigure?.setBodyRage(on);
      },
      twin: this.twin ? this.twinWorld() : undefined,
      spawnAdd: (spec) => this.spawnAdd(spec),
      phaseShield: () => this.freshShield(),
      me: () => arena.caster.group.position,
      down: () => this.playerHp <= 0,
      walked: (seconds) => {
        let d = 0;
        for (const w of this.walkLog) if (w.t > this.walkClock - seconds) d += w.d;
        return d;
      },
      heroes: () => {
        const me = arena.caster.group.position, side = this.boss?.link.side ?? 0;
        const list = [{ side, x: me.x, z: me.z, down: this.playerHp <= 0 }];
        for (const [s, p] of this.party) if (!p.left) list.push({ side: s, x: p.pos.x, z: p.pos.z, down: p.down });
        return list;
      },
      hitMe: (h) => this.hurtHero(h),
      fallenPartner: () => {
        const p = this.fallenNear();
        return p ? { x: p.pos.x, z: p.pos.z } : null;
      },
      units: () => arena.summons.alive('hero').map((u) => ({ figure: u.figure, pos: u.pos })),
      hitUnit: (figure, damage) => {
        this.hitBypass = true;
        arena.hit(figure as Enemy, { damage, knock: 0, color: '#ffb050' });
        this.hitBypass = false;
      },
      cover: () => arena.obstacles ?? [],
      sees: (ax, az, bx, bz) => arena.lineOfSight(a.set(ax, 0, az), b.set(bx, 0, bz)),
      rayStop: (ax, az, bx, bz) => arena.coverStop({ x: ax, z: az }, { x: bx, z: bz }),
      firstWall: (ax, az, bx, bz) => {
        const def = this.currentArena, standing = arena.obstacles;
        if (!def || !standing) return -1;
        const o = sweepHit(a.set(ax, 0, az), b.set(bx, 0, bz), 0, standing)?.obstacle;
        return o?.kind === 'wall' ? def.obstacles.indexOf(o) : -1;
      },
      crackWall: (i) => {
        const o = this.currentArena?.obstacles[i];
        if (!o || !this.wallHp || this.wallHp[i] <= 0) return;
        this.wallHp[i]--;
        this.wallHit(i, o);
      },
      breakWall: (i) => this.removeCover(i),
      breakCover: (i, dir) => {
        if (!this.host.arena.obstacles?.includes(this.currentArena?.obstacles[i] as Obstacle)) return;
        this.removeCover(i);
        this.arenaScene?.coverFall?.(i, dir, COVER_FALL);
      },
      exposed: (seconds) => {
        arena.applyBuff(foe, 'vulnerable', BOSS_TAKEN, seconds);
        this.boss?.exposedFor(seconds);
      },
      kneel: (seconds) => {
        arena.statusOf(foe)?.hold(seconds);
        arena.applyBuff(foe, 'vulnerable', BOSS_TAKEN, seconds);
      },
      banner: (text, seconds, size) => { if (this.mode === 'play') this.showBanner(text, seconds, size); },
      say: (text, color, x, z) => arena.say(text, color, new THREE.Vector3(x, 1.5, z), 1.1),
      finish: (result) => this.finish(result === 'win' ? 'win' : 'lose'),
    };
  }

  /**
   * A hit of the boss's side on this screen's hero, for a share of its max health: what a boss's zone does when it lands, for
   * whatever else of a fight strikes the hero (the Tower's units). It keeps what a boss's hit keeps: shields, a parry, Warding, the
   * run's upgrades; `move` is what the result names as the killer.
   */
  hurtHero(h: BossHit) {
    const arena = this.host.arena, foe = this.foe;
    if (this.playerHp <= 0 || !this.boss || !foe) return;
    this.boss.countHit(h.move);
    if (h.lethal) {
      // No shield or toughness holds it: only what nothing can touch (Sealed) is spared, and Stubborn's one save.
      if (arena.statusOf(arena.caster)?.sealed) return;
      const shield = arena.shieldOf(arena.caster)?.amount ?? 0;
      this.damagePlayer({ damage: this.playerHp + shield + 1, knock: h.knock ?? 0, color: '#ff5a3a', from: new THREE.Vector3(h.from.x, 0, h.from.z) });
      if (this.playerHp <= 0) arena.say('CRUSHED', '#ff7a4a', arena.caster.group.position, 1.6);
      return;
    }
    // A weakened boss deals less, as a weakened hero does.
    const dealt = arena.statusOf(foe)?.dealtMul ?? 1;
    const mods = dealt !== 1 ? { ...NO_MODS, power: dealt } : NO_MODS;
    const opts: HitOptions = { damage: h.share * this.hitBase, knock: (h.knock ?? 0) * (this.boss.upgrades?.knockMul ?? 1), color: '#ffb050', from: new THREE.Vector3(h.from.x, 0, h.from.z) };
    this.damagePlayer(this.resolve('opponent', arena.caster, opts, mods, 'spell', h.big ? 3 : 0, ++this.oppCastSeq));
  }

  /** A boss room's own floor that hurts, as it is this frame (`BossDef.floor`: the Twin Forge's lava), or null. */
  private roomFloor: RoomFloor | null = null;
  /** Seconds until the room's floor may burn this screen's hero again, and its units. */
  private burnWait = 0;

  /**
   * A boss room whose own floor hurts for good (`BossDef.floor`): an AI plans its walk round it, a boss backing away stays on what
   * is left of it, and it burns this screen's hero and its units once a second while they stand in it. Asked of the room each
   * frame, not of a boss's script: it burns whoever of two bosses still lives.
   */
  private roomStep(dt: number) {
    const arena = this.host.arena, floor = this.boss ? this.bossDef?.floor?.() ?? null : null;
    this.roomFloor = floor;
    if (!floor) return;
    arena.aiCover = [...(this.shift?.aiCover ?? []), ...floor.cover];
    if (floor.bounds) arena.aiBounds = { x: RING.x, z: RING.z, r: floor.bounds };
    else if (!this.shift) arena.aiBounds = null;
    this.burnWait = Math.max(0, this.burnWait - dt);
    if (this.over || this.countdown >= 0 || this.burnWait > 0) return;
    const me = arena.caster.group.position, share = this.playerHp > 0 ? floor.burn(me.x, me.z) : 0;
    const units = arena.summons.alive('hero').filter((u) => floor.burn(u.pos.x, u.pos.z) > 0);
    if (share <= 0 && !units.length) return;
    this.burnWait = 1;
    if (share > 0) this.hurtHero({ share: share * (this.boss?.script.harm ?? 1), from: { x: me.x, z: me.z }, move: floor.name });
    for (const u of units) {
      this.hitBypass = true;
      arena.hit(u.figure, { damage: ROOM_UNIT_HIT, knock: 0, color: '#ffb050' });
      this.hitBypass = false;
    }
  }

  /** The words a boss fight has already said once. */
  private hinted = new Set<string>();
  /** A stage is on: the boss can't be hurt, and its adds are the target. */
  private bossGuard = false;
  private immuneAt = -Infinity;

  /** A boss's add on this screen: a unit on the boss's side that never moves and never shoots. Its move's later steps do the shooting. */
  private spawnAdd(spec: AddSpec): RaidAdd {
    const summons = this.host.arena.summons;
    const handle = this.host.arena.summonFor('opponent', {
      kind: 'turret', at: new THREE.Vector3(spec.x, 0, spec.z), hp: spec.hp, seconds: ADD_LIFE, damage: 0, attackEvery: ADD_LIFE, range: 0,
      color: spec.color, look: spec.look, still: true,
    }, () => {});
    const u = handle.units[0];
    if (!u) return { x: spec.x, z: spec.z, alive: false, hurt() {}, slay() {}, remove() {} };
    handle.onHurt((_, damage) => spec.hurt(damage)).onDeath((x) => { if (x.slain) spec.died(); });
    return {
      x: u.pos.x,
      z: u.pos.z,
      get alive() { return u.alive; },
      hurt: (amount) => summons.hurt(u, { damage: amount, knock: 0, color: '#d8c8a8' }, true),
      slay: () => summons.slay(u),
      remove: () => summons.dismiss(u),
    };
  }

  /** A hit on the boss while it can't be hurt: IMMUNE over it, now and then. */
  private immune(target: Enemy) {
    if (this.time - this.immuneAt < IMMUNE_SAY) return;
    this.immuneAt = this.time;
    this.host.arena.say('IMMUNE', '#9a93a6', target.group.position.clone().add(new THREE.Vector3(0, 2.4, 0)), 1);
  }
  /** Fallen stones standing as cover: a boss's ray breaks on them. */
  private stones = new WeakSet<Obstacle>();

  /**
   * How far this screen's hero went each frame by its own walk or dash, for a boss's beat that burns whoever walks
   * (`BossWorld.walked`). What a blow, a pull, a carry or a stone raised under it moved it (`shove`) is taken off first.
   */
  private walkLog: { t: number; d: number }[] = [];
  private walkFrom = new THREE.Vector3();
  private walkClock = 0;
  private shoved = new THREE.Vector3();

  /** Runs `fn`, and keeps what it moved this screen's hero out of the hero's own walk. */
  private shove(fn: () => void) {
    const me = this.host.arena.caster.group.position, x = me.x, z = me.z;
    fn();
    this.shoved.x += me.x - x;
    this.shoved.z += me.z - z;
  }

  /** One frame of the hero's own walk, before the boss's zones land. */
  private logWalk(dt: number, me: THREE.Vector3) {
    this.walkClock += dt;
    this.walkLog.push({ t: this.walkClock, d: Math.hypot(me.x - this.walkFrom.x - this.shoved.x, me.z - this.walkFrom.z - this.shoved.z) });
    while (this.walkLog.length && this.walkLog[0].t <= this.walkClock - WALK_LOG) this.walkLog.shift();
    this.walkFrom.copy(me);
    this.shoved.set(0, 0, 0);
  }

  /** The camera's distance before a boss fight moved it. */
  private zoomBefore: number | null = null;

  /** A boss fight is over and its hooks come off. */
  private endBoss() {
    if (!this.boss && !this.bossDef) return;
    const arena = this.host.arena;
    this.boss?.dispose();
    this.boss = null;
    this.twin = null;
    this.bossDef = null;
    this.bossCard = null;
    this.shiftOffset = 0;
    this.host.heroMode.speedBonus = 1;
    this.host.heroMode.cooldownRate = 1;
    this.host.heroMode.castLock = false;
    this.host.heroMode.setWalkOnly(false);
    if (this.zoomBefore !== null) {
      this.host.heroMode.setZoom(this.zoomBefore);
      this.zoomBefore = null;
    }
    arena.heroBolt = null;
    this.clearPartnerMarks();
    for (const p of this.party.values()) p.dispose();
    this.party.clear();
    if (this.partyEl) this.partyEl.style.display = 'none';
    this.rimFigure?.setModel(undefined);
    this.rimFigure?.group.removeFromParent();
    arena.pinned = null;
    arena.foeFloor = 0;
    arena.onFoeDamage = null;
    arena.onFoeDebuff = null;
    arena.statusGate = null;
    this.hudSides[1].style.display = this.hudVs.style.display = '';
    this.hud.style.flexDirection = 'row';
    this.hud.style.alignItems = 'center';
    this.hud.style.top = this.hudTop;
    this.hud.style.left = '50%';
    this.hud.style.right = 'auto';
    this.hud.style.transform = 'translateX(-50%)';
    this.rematchButton.textContent = 'Rematch';
    this.leaveButton.textContent = 'Leave duel';
  }

  /** Common round setup: the ring, one foe at `theirs` under the opponent's figure, the hero at `mine`. */
  private setup(mine: THREE.Vector3, theirs: THREE.Vector3, def: ArenaDef) {
    const arena = this.host.arena, hm = this.host.heroMode;
    this.host.clearEffects?.();
    // A two-kit hero starts each round on its first half, with the other half's model ready.
    if (hm.currentKit.base) hm.setKit(hm.currentKit.base);
    if (this.opponentKit.base) this.opponentKit = this.opponentKit.base;
    if (hm.currentKit.alt?.model) hm.preloadFigure(hm.currentKit.alt.model);
    if (this.opponentKit.alt?.model) this.figure.preload(this.opponentKit.alt.model);
    this.useArena(def);
    this.arenaScene?.resetShift?.();
    this.hazard?.dispose();
    // A boss is the room's event: the arena's own stay out of its fight.
    this.hazard = !this.bossDef && this.hazardsOn && (this.mode === 'play' || this.hazardsInRuns) ? def.hazard?.(this.hazardSeed) ?? null : null;
    if (this.hazard) this.group.add(this.hazard.group);
    this.shift?.dispose();
    this.shift = !this.bossDef && this.shiftsOn && (this.mode === 'play' || this.shiftsInRuns) ? (this.arenaScene && def.shift?.(this.hazardSeed, this.arenaScene)) ?? null : null;
    if (this.shift) this.group.add(this.shift.group);
    this.hazardClock = 0;
    this.hazardSentAt = -Infinity;
    this.hazardRolls.clear();
    this.oppAttackSpec = attackFor(this.opponentKit);
    this.oppAttack.reset();
    this.oppAttackFx.clear();
    arena.foeBars = false; // the hero bars over each head take its place
    hm.attacksEnabled = true;
    if (!this.on) this.savedCount = arena.count;
    this.on = true;
    this.playerMax = hm.currentKit.maxHp ?? HP;
    this.foeMax = this.opponentKit.maxHp ?? HP;
    arena.maxHp = this.foeMax;
    arena.respawnAfter = Infinity;
    arena.bounds = { ...RING, r: def.ring ?? RING.r };
    this.ringTo = arena.bounds.r;
    // A copy: temporary obstacles (`CastContext.addObstacle`) and broken walls change the list, never the arena definition.
    arena.clearTempObstacles();
    arena.obstacles = def.obstacles.slice();
    arena.remoteFigure = null;
    this.resetWalls(def);
    arena.setCount(1);
    this.foe = arena.liveFoes()[0]?.figure ?? null;
    if (this.foe) arena.placeFoe(this.foe, theirs);
    // Each hero is hit at the size of its own model.
    arena.caster.body = HERO_BODIES[hm.currentKit.name] ?? null;
    arena.caster.group.scale.setScalar(1);
    if (this.foe) {
      this.foe.body = HERO_BODIES[this.opponentKit.name] ?? null;
      this.foe.group.scale.setScalar(1);
    }
    arena.caster.setHome(mine);
    arena.caster.reset();
    arena.caster.group.rotation.y = Math.atan2(theirs.x - mine.x, theirs.z - mine.z);
    arena.clearSelection();

    if (this.foe) {
      for (const c of this.foe.group.children) c.visible = false;
      this.foe.group.rotation.y = Math.atan2(mine.x - theirs.x, mine.z - theirs.z);
    }
    this.figure.setModel(this.opponentKit.model, theirs, this.opponentKit);
    this.figure.setScale(this.bossDef?.scale ?? 1);
    this.foeHeld = 0;
    this.figure.stand();
    this.setupTraits();
    hm.locked = false;
    hm.resetRound();
    this.playerHp = this.playerMax;
    this.round++;
    arena.projectiles.clear();
    arena.summons.resetStats();
    this.opponentDodge.clear();
    this.playerDodge.clear();
    this.zoneDodges.clear();
    this.castWait = 0;
    this.playerVel.set(0, 0, 0);
    this.playerLast = null;
    this.cooldowns.fill(0);
    this.rooted = 0;
    this.think = 1.2; // a beat before the opponent moves
    this.playerThink = 1.2;
    this.stats = { playerCasts: 0, opponentCasts: 0, playerDodges: 0, opponentDodges: 0 };
    this.result = null;
    this.playerCastsRecent = [];
    this.time = 0;
    for (const st of [this.opponentAi, this.playerAi]) { st.goalT = 0; st.goalSeen = false; st.goalOff = 0; }
    this.over = null;
    this.overT = 0;
    this.zones.set([]);
    this.group.visible = true;
    this.hud.style.display = 'flex';
    this.card.style.display = 'none';
    this.banner.style.display = 'none';
    this.countdown = -1;
    this.renderHud();
  }

  /** The identity layer for this round: a runtime per side, the hero's cast rules and the hit pipeline. */
  private setupTraits() {
    const arena = this.host.arena, hm = this.host.heroMode;
    const me = hm.currentKit, them = this.opponentKit;
    this.heroRt = new TraitRuntime('hero', traitFor(me.name), {
      self: () => arena.caster,
      enemy: () => this.foe,
      status: (f) => arena.statusOf(f),
      cover: () => arena.obstacles ?? [],
      arenaCover: () => this.currentArena?.obstacles ?? [],
      arenaRing: () => this.ringTo,
      hp: () => this.playerHp,
      maxHp: () => this.playerMax,
      time: () => this.time,
      say: (text, color, at) => arena.say(text, color, at, 1),
      heal: (amount) => { arena.healFigure(arena.caster, amount); },
      healEnemy: (amount) => { if (!this.net && !this.boss && this.foe) arena.healFigure(this.foe, amount); },
      buff: (kind, amount, seconds) => { arena.applyBuff(arena.caster, kind, amount, seconds); },
      setCooldown: (slot, sec) => hm.setCooldown(slot, sec),
      cooldownLeft: (slot) => hm.cooldownOf(slot),
      burst: (at, big, stack) => this.traitFx.burst(at, (stack && stackColor(stack)) || me.accent, big),
      payHp: (amount) => {
        const paid = Math.min(amount, this.playerHp - 1);
        if (paid <= 0) return;
        this.playerHp -= paid;
        arena.say(`-${Math.round(paid)}`, '#c0304a', arena.caster.group.position, 0.9);
        this.net?.spend(Math.round(paid));
      },
      shield: (amount, seconds) => arena.shieldFigure(arena.caster, amount, seconds),
      unitDeaths: () => Object.values(arena.summons.stats).reduce((a, st) => a + st.slain, 0),
      units: () => arena.summons.alive('hero').map((u) => u.pos),
      resetAttack: () => hm.resetAttack(),
      // The hero's units live on this screen (online too: the other screen does not see a passive's units).
      summon: (so) => arena.summonFor('hero', so),
      deathSpots: (maxAge) => arena.deathSpots(maxAge),
      hold: (seconds) => hm.holdStill(seconds),
      moveTo: (p, seconds) => { arena.moveFigure(arena.caster, p, seconds); },
      stateChanged: (name, n) => this.net?.stacks(`@${name}`, n),
      clearShield: () => {
        arena.clearShield(arena.caster);
        this.net?.shield(0, 0);
      },
      release: () => hm.release(),
      shieldAmount: () => arena.shieldOf(arena.caster)?.amount ?? 0,
      unitRate: (rate) => { for (const u of arena.summons.alive('hero')) u.rate = rate(u.pos); },
      note: (name, n) => { if (this.heroRt) this.heroRt.trait?.peerNote?.(this.heroRt, name, n); },
      // Online the victim's screen decides a hit on it: nothing to do here.
      hitEnemy: (opts) => {
        if (this.net || !this.foe || this.over) return;
        arena.hit(this.foe, this.resolve('hero', this.foe, opts, NO_MODS, 'trait'));
      },
      carryEnemy: (dx, dz) => {
        if (this.net || !this.foe || arena.pinned === this.foe) return;
        arena.moveFoe(this.foe, new THREE.Vector3(dx, 0, dz), true);
      },
      carrySelf: (dx, dz) => {
        const me = arena.caster.group.position;
        me.x += dx;
        me.z += dz;
        arena.keepInside(me);
      },
      swapKit: (alt) => {
        const kit = alt ? me.alt ?? me : me;
        if (kit === hm.currentKit) return;
        hm.swapKit(kit);
        this.boss?.link.heroAlt(alt);
      },
    });
    this.oppRt = new TraitRuntime('opponent', traitFor(them.name), {
      self: () => this.foe ?? arena.caster,
      enemy: () => arena.caster,
      status: (f) => arena.statusOf(f),
      cover: () => arena.obstacles ?? [],
      arenaCover: () => this.currentArena?.obstacles ?? [],
      arenaRing: () => this.ringTo,
      hp: () => (this.foe ? arena.hpOf(this.foe) : 0),
      maxHp: () => this.foeMax,
      time: () => this.time,
      say: (text, color, at) => arena.say(text, color, at, 1),
      // Online the other player's own client heals and buffs its hero; here only offline.
      heal: (amount) => { if (!this.net && this.foe) arena.healFigure(this.foe, amount); },
      healEnemy: (amount) => { arena.healFigure(arena.caster, amount); },
      buff: (kind, amount, seconds) => { if (!this.net && this.foe) arena.applyBuff(this.foe, kind, amount, seconds); },
      setCooldown: (slot, sec) => { this.cooldowns[slot] = Math.max(0, sec); },
      cooldownLeft: (slot) => this.cooldowns[slot],
      burst: (at, big, stack) => this.traitFx.burst(at, (stack && stackColor(stack)) || them.accent, big),
      payHp: (amount) => {
        if (this.net || !this.foe) return;
        const hp = arena.hpOf(this.foe);
        if (hp > 1) arena.setHp(this.foe, Math.max(1, hp - amount));
      },
      shield: (amount, seconds) => { if (!this.net && this.foe) arena.shieldFigure(this.foe, amount, seconds); },
      unitDeaths: () => Object.values(arena.summons.stats).reduce((a, st) => a + st.slain, 0),
      units: () => arena.summons.alive('opponent').map((u) => u.pos),
      resetAttack: () => { if (!this.net) this.oppAttack.ready(); },
      // Online the other player's own client raises its units (the cast replay plays them here); a passive's would double.
      summon: (so) => {
        if (this.net || !this.foe) return null;
        const rec: EnemyCast = { id: 0, round: this.round, zones: [], aimed: this.foe.group.position.clone(), dodgedShown: false, mods: NO_MODS, seq: ++this.oppCastSeq };
        return arena.summonFor('opponent', so, (target, opts) => (target === arena.caster ? this.hitPlayer(rec, opts) : this.hitUnit(rec, target, opts)));
      },
      deathSpots: (maxAge) => arena.deathSpots(maxAge),
      // Online the other player's own client holds its hero still.
      hold: (seconds) => {
        this.foeHeld = Math.max(this.foeHeld, seconds);
        if (!this.net) this.holdFloor = Math.max(this.holdFloor, seconds);
      },
      // Online the other player's own client moves its hero; its moves arrive as positions (a big jump snaps, see `peerMove`).
      moveTo: (p, seconds) => { if (!this.net && this.foe) arena.moveFigure(this.foe, p, seconds); },
      // Online: the other player's stacks on this hero are decided here; its own screen learns them.
      stacksChanged: (name, n) => this.net?.stacks(name, n),
      // Online the other player's own client ends its shield and its hold, and they reach this screen.
      clearShield: () => { if (!this.net && this.foe) arena.clearShield(this.foe); },
      release: () => {
        if (this.net) return;
        this.rooted = 0;
        this.foeHeld = 0;
      },
      shieldAmount: () => (this.foe ? arena.shieldOf(this.foe)?.amount ?? 0 : 0),
      unitRate: (rate) => { for (const u of arena.summons.alive('opponent')) u.rate = rate(u.pos); },
      // Online this screen resolved a hit its own client must hear about.
      note: (name, n) => {
        if (this.net) this.net.stacks(`!${name}`, n);
        else if (this.oppRt) this.oppRt.trait?.peerNote?.(this.oppRt, name, n);
      },
      // The hero is on this screen, online too. The server wants a recent cast of the other side to pin the hit on.
      hitEnemy: (opts) => {
        if (this.over || !this.on) return;
        this.damagePlayer(this.resolve('opponent', arena.caster, opts, NO_MODS, 'trait'), this.net ? this.peerCastId : undefined);
      },
      carryEnemy: (dx, dz) => {
        const me = arena.caster.group.position;
        me.x += dx;
        me.z += dz;
        arena.keepInside(me);
      },
      // Online this side's own client moves it; its moves arrive here.
      carrySelf: (dx, dz) => {
        if (this.net || !this.foe) return;
        arena.moveFoe(this.foe, new THREE.Vector3(dx, 0, dz), true);
      },
      swapKit: (alt) => {
        const kit = alt ? them.alt ?? them : them;
        if (kit === this.opponentKit) return;
        this.opponentKit = kit;
        this.oppAttackSpec = attackFor(kit);
        this.figure.setModel(kit.model, this.foe?.group.position, kit);
      },
    });
    // The channel of a cast (src/effects/channel.ts) ends the root of whoever cast it.
    arena.releaseFigure = (who) => (who === arena.caster ? this.heroRt : this.oppRt)?.release();
    this.heroCasts.clear();
    this.netIds.clear();
    this.heroLast = null;
    this.heroAttackMods = this.oppAttackMods = NO_MODS;
    hm.traits = this.heroRt;
    hm.castRules = (slot, base, charge) => {
      const spell = hm.currentKit.spells[slot];
      const r = this.heroRt!.cast(slot, base, charge, hm.status.dealtMul, spell.debuff);
      if (this.oppRt) this.oppRt.trait?.enemyCast?.(this.oppRt, slot);
      if (spell.buff) arena.applyBuff(arena.caster, spell.buff.kind, spell.buff.amount, spell.buff.seconds);
      // The arena numbers the cast when the effect plays, right after this.
      this.heroCasts.set(arena.castSeq + 1, { slot, mods: r.mods });
      if (this.heroCasts.size > 40) this.heroCasts.delete(this.heroCasts.keys().next().value!);
      this.heroLast = { slot, mods: r.mods };
      return r.cooldown * (this.boss?.upgrades?.cooldownMul(slot) ?? 1);
    };
    // Online an echo against the other hero is not a second message (the server drops attacks 0.5 s apart): the hit
    // carries it as extra power instead.
    hm.skipEcho = (target) => !!this.net && target === this.foe;
    hm.onAttack = (target, echo) => {
      if (echo) return;
      this.heroAttackMods = this.heroRt!.attack(hm.status.dealtMul);
      // Basic attacks at the other hero go to its client, which plays them and reports the hit. Attacks on units stay local.
      if (this.net && target === this.foe) {
        const id = ++this.castSeq;
        this.netIds.set(id, 'attack');
        const fold = 1 + this.heroRt!.attackEcho();
        this.net.attack(id, fold > 1 ? { ...this.heroAttackMods, power: this.heroAttackMods.power * fold } : this.heroAttackMods);
      }
      // In a raid for two the partner's screen plays the look.
      if (this.boss && !this.boss.link.solo && target === this.foe) this.boss.link.heroAttack(++this.castSeq, undefined);
    };
    // The player's hits (spells, bolts, units, attacks) on the opponent and its units get the cast's power, buffs and
    // passives here; the opponent's hits are resolved in hitPlayer / hitUnit / its attacker.
    arena.hitMod = (target, opts, cast) => {
      // The server's confirmed hit on the other hero (`peerHit`) only draws: the other screen already resolved it.
      if (this.resolved.has(opts) || this.hitBypass) return opts;
      if (target !== this.foe && arena.summons.unitOf(target)?.side !== 'opponent') return opts;
      const rec = cast !== undefined ? this.heroCasts.get(cast) : undefined;
      if (opts.attack) return this.resolve('hero', target, opts, this.heroAttackMods, 'attack');
      return this.resolve('hero', target, opts, rec?.mods ?? NO_MODS, rec ? 'spell' : 'unit', rec?.slot, cast);
    };
    arena.casterBuff = (kind, amount, seconds) => this.net?.buff(kind, amount, seconds);
    // Shields a hero makes are scaled by its trait (Auriel's Aegis).
    arena.shieldScale = (target) => (target === arena.caster ? this.heroRt?.trait?.shieldMul : target === this.foe ? this.oppRt?.trait?.shieldMul : undefined) ?? 1;
    this.pendingHeal = 0;
  }

  /**
   * One hit through the identity layer: the cast's power, the victim's armor / vulnerable, the dealer's and the
   * victim's passives, the cast's status / debuff / knock extras. Returns a resolved copy. The dealer learns that it
   * landed (resources, heals) unless it is the other player's side online (its own client counts that).
   */
  private resolve(dealer: Side, victim: Enemy, opts: HitOptions, mods: CastMods, kind: 'spell' | 'attack' | 'unit' | 'trait', slot?: number, cast?: number): HitOptions {
    if (this.resolved.has(opts)) return opts;
    const arena = this.host.arena;
    const dRt = dealer === 'hero' ? this.heroRt : this.oppRt;
    const victimIsHero = victim === this.foe || victim === arena.caster;
    const vRt = !victimIsHero ? null : dealer === 'hero' ? this.oppRt : this.heroRt;
    const hit: TraitHit = { kind, slot, cast, mods, damage: (opts.damage ?? 15) * mods.power, opts: { ...opts } as HitOptions, victim, victimIsHero };
    if (victimIsHero) hit.damage *= arena.statusOf(victim)?.takenMul ?? 1;
    // A raid's upgrades on this hero's hits on the boss.
    const up = this.boss?.upgrades;
    if (up && dealer === 'hero' && victim === this.foe) {
      hit.damage *= up.dealtMul(this.boss!.open);
      if (up.leech > 0) this.healPlayer(hit.damage * up.leech);
    }
    // The CPU level's own lever (never online: the other side is a person).
    if (dealer === 'opponent' && !this.net) hit.damage *= this.cpuLevel.damage;
    // Sealed (Sefu's sarcophagus): nothing reaches the figure, from either side.
    if (victimIsHero && arena.statusOf(victim)?.sealed) hit.blocked = true;
    dRt?.dealt(hit);
    vRt?.taken(hit);
    // A hook may replace the options object: read it back.
    const o = hit.opts;
    if (hit.blocked) {
      // Swallowed whole: nothing lands, and the dealer gains nothing from it.
      const swallowed = Math.round(hit.damage);
      delete o.status; delete o.debuff; delete o.knock; delete o.pull;
      o.damage = 0;
      o.blocked = swallowed;
      this.resolved.add(o);
      return o;
    }
    if (victimIsHero && mods.status && !o.status) o.status = mods.status;
    if (mods.debuff && !o.debuff) o.debuff = mods.debuff;
    if (mods.knock) o.knock = (o.knock ?? 0) + mods.knock;
    o.damage = Math.round(hit.damage);
    this.resolved.add(o);
    if (dealer === 'hero' || !this.net) dRt?.landed({ kind, slot, damage: o.damage, victimIsHero });
    return o;
  }

  /** The AI's walk speed for a kit: the hero's own speed scaled to the CPU level's pace. */
  private aiSpeed(kit: HeroKit, lv: CpuLevel) {
    const bonus = kit === this.host.heroMode.currentKit ? this.host.heroMode.speedBonus : 1;
    return lv.speed * bonus * (traitFor(kit.name)?.speed ?? 4) / 4;
  }

  /** The CPU level that drives `who`: the opponent plays `cpuLevel`, the autopilot always plays Normal. */
  private levelOf(who: Enemy) {
    return who === this.foe ? this.cpuLevel : this.pilotLevel;
  }

  stop() {
    if (!this.on) return;
    const arena = this.host.arena;
    this.endBoss();
    this.on = false;
    this.round++;
    this.host.clearEffects?.();
    this.host.outline?.(null);
    this.hazard?.dispose();
    this.hazard = null;
    this.shift?.dispose();
    this.shift = null;
    arena.aiCover = [];
    arena.aiBounds = null;
    arena.projectiles.clear();
    arena.hitFilter = null;
    arena.untargetable = null;
    this.bossGuard = false;
    arena.hitMod = null;
    arena.casterHeal = null;
    arena.casterShield = null;
    arena.casterBuff = null;
    arena.shieldScale = null;
    this.traitFx.clear();
    this.host.heroMode.traits = null;
    this.host.heroMode.castRules = undefined;
    this.heroRt = this.oppRt = null;
    this.host.heroMode.onCast = undefined;
    this.host.heroMode.onAttack = undefined;
    this.host.heroMode.skipEcho = undefined;
    arena.maxHp = 100;
    arena.respawnAfter = 4;
    arena.bounds = null;
    arena.clearTempObstacles();
    arena.obstacles = null;
    arena.remoteFigure = null;
    this.host.setStage?.(null);
    arena.showGround(true);
    arena.setCount(this.savedCount);
    arena.caster.setHome(PLAYER_START.clone().setZ(14));
    arena.caster.reset();
    arena.foeBars = true;
    this.traitFx.plate('hero', null, 0, null);
    this.traitFx.plate('foe', null, 0, null);
    this.figure.setModel(undefined);
    this.oppAttack.reset();
    this.oppAttackFx.clear();
    this.host.heroMode.attacksEnabled = true;
    this.foe = null;
    this.zones.set([]);
    this.group.visible = false;
    this.hud.style.display = 'none';
    this.card.style.display = 'none';
    this.host.heroMode.locked = false;
    this.host.heroMode.spectate = false;
    this.host.heroMode.focus = null;
    this.host.heroMode.flipCamera = false;
    this.autopilot = false;
    this.net = null;
    this.banner.style.display = 'none';
    this.rematchButton.style.display = '';
    this.leaveButton.textContent = 'Leave duel';
    this.host.heroMode.resetRound();
  }

  // --- network duel ---------------------------------------------------------------------------------------

  /**
   * Resolves when both heroes' figures have loaded and the arena's materials are compiled, so the fight does not start on a
   * stutter, or after `maxMs` whatever is left: a slow model must not hold a match up. The figures are drawn even when
   * this resolves early.
   */
  async whenReady(maxMs = 12000) {
    const end = performance.now() + maxMs;
    const figures = async () => {
      while (performance.now() < end && !(this.host.heroMode.figureLoaded && this.figure.loaded && [...this.party.values()].every((p) => p.lite || p.figure.loaded) && (this.rimFigure?.loaded ?? true))) await new Promise((ok) => setTimeout(ok, 60));
    };
    await figures();
    await Promise.race([this.host.warmUp?.() ?? Promise.resolve(), new Promise((ok) => setTimeout(ok, Math.max(0, end - performance.now())))]);
  }

  /** The countdown before the fight: the hero is locked (and an AI waits) until it runs out. */
  countdownFrom(seconds: number) {
    this.countdown = seconds;
    this.countdownEnd = performance.now() + seconds * 1000;
    this.host.heroMode.locked = true;
    this.banner.style.fontSize = '';
  }

  /**
   * The remote hero's position and facing (sent 20 times a second while it moves). `ts` is the sender's clock: the
   * sample is placed at the moment it was true, so uneven delivery does not make the hero stutter.
   */
  peerMove(x: number, z: number, yaw: number, ts?: number) {
    const now = performance.now();
    let at = now;
    if (ts !== undefined) {
      this.peerClock = this.peerClock === null ? now - ts : Math.min(this.peerClock, now - ts);
      at = ts + this.peerClock;
    }
    const track = this.peerTrack, last = track[track.length - 1];
    // A jump of more than PEER_JUMP in one report (a blink, a rewind, a charge's end) is not a walk: drop the old track
    // so the hero snaps to the new spot instead of gliding across the ring.
    if (last && Math.hypot(x - last.x, z - last.z) > PEER_JUMP) track.length = 0;
    else if (last) {
      at = Math.max(at, last.at + 1);
      // It stood still (nothing is sent then): hold the old spot until just before this sample instead of gliding.
      if (at - last.at > PEER_GAP) track.push({ ...last, at: at - PEER_STEP });
    }
    track.push({ at, x, z, yaw });
    while (track.length > 2 && track[1].at < now - 1000) track.shift();
  }

  /** The remote hero cast a spell: play it here at this side's hero, with this side's dodge check. */
  peerCast(m: PeerCast) {
    if (!this.on || !this.net || this.over || !this.foe) return;
    const spell = this.opponentKit.spells[m.slot];
    const spec = spell && this.host.targeting(spell.label);
    if (!spec) return;
    this.peerCastId = m.id;
    this.heroRt?.trait?.enemyCast?.(this.heroRt, m.slot);
    const arena = this.host.arena, foe = this.foe;
    // Cast from where the hero is drawn (a little behind its own screen, see netFollow) so it does not jump; only the
    // look depends on it, hits are decided by the side that takes them. Far off (a lost update): snap to its spot.
    const from = foe.group.position.clone().setY(0);
    const told = new THREE.Vector3(m.fx, 0, m.fz);
    if (from.distanceTo(told) > PEER_SNAP) {
      arena.moveFoe(foe, told.clone().sub(from));
      from.copy(told);
    }
    const me = arena.caster.group.position;
    const point = spec.mode === 'self' ? from.clone() : m.enemy ? me.clone() : new THREE.Vector3(m.x, 0, m.z);
    this.castSpell(m.slot, foe, from, me, spec, point, m.id, undefined, m.yaw, m.mods ?? NO_MODS, { bend: m.bend, sentFrom: told });
    // Walls: from where the other side says it cast (the same numbers it used), so both screens break the same walls.
    // (the aim point the sender used too: its view of this hero, not where this hero really is)
    this.blastWalls(told, spec.mode === 'self' ? told.clone() : new THREE.Vector3(m.x, 0, m.z), spec, spell, m.slot);
  }

  /** The remote side took a hit from this side's spell (its own client decided): number, flash, HP from the server. */
  peerHit(damage: number, hp: number, color?: string, soaked = 0, id?: number, blocked = false) {
    if (!this.foe || !this.on) return;
    if (blocked) {
      // The other hero's passive swallowed it whole: nothing landed, and this side's trait gains nothing.
      this.host.arena.say('BLOCKED', '#bfeaff', this.foe.group.position, 1.1);
      this.host.arena.setHp(this.foe, hp);
      return;
    }
    // This side's hit landed on the other hero: its trait learns it (combo points, heals from damage).
    const what = id !== undefined ? this.netIds.get(id) : undefined;
    if (what !== undefined && this.heroRt) {
      this.heroRt.landed(what === 'attack' ? { kind: 'attack', damage, victimIsHero: true } : { kind: 'spell', slot: what, damage, victimIsHero: true });
    }
    this.hitBypass = true;
    // The shield drawn here takes `soaked` (it was given by `peerShield`); past it the shield broke on the other side.
    this.host.arena.hit(this.foe, { damage: damage + soaked, knock: 0, color });
    this.hitBypass = false;
    if (damage > 0) this.host.arena.clearShield(this.foe);
    this.host.arena.setHp(this.foe, hp);
  }

  /** The other player released a basic attack at this side's hero: it flies (or swings) here and lands on this hero. */
  peerAttack(id: number, mods?: CastMods) {
    if (!this.foe || !this.on || this.over) return;
    this.peerAttackId = id;
    this.oppAttackMods = mods ?? NO_MODS;
    this.oppAttack.releaseNow(this.host.arena.caster);
  }

  /** The other hero paid HP (its HP as the server counts it). */
  peerSpend(amount: number, hp: number) {
    if (!this.foe || !this.on) return;
    this.host.arena.say(`-${amount}`, '#c0304a', this.foe.group.position, 0.9);
    this.host.arena.setHp(this.foe, hp);
  }

  /** The other hero healed itself (its HP as the server counts it). */
  peerHeal(amount: number, hp: number) {
    if (!this.foe || !this.on) return;
    this.host.arena.say(`+${amount}`, '#7dffb0', this.foe.group.position, 1);
    this.host.arena.setHp(this.foe, hp);
  }

  /** The other hero took a status on its own screen: the same word and tint here. */
  peerStatus(kind: StatusKind, seconds: number, color?: string) {
    if (this.foe && this.on) this.host.arena.applyStatus(this.foe, kind, seconds, color);
  }

  /** A buff or debuff on the other hero (its own screen decided it): the same icon and word here. */
  peerBuff(kind: BuffKind, amount: number, seconds: number) {
    if (this.foe && this.on) this.host.arena.applyBuff(this.foe, kind, amount, seconds);
  }

  /**
   * A stacks message. `name` alone: the other screen decided this side's stacks on the other hero (e.g. Vitriol's toxin
   * on it). `@name`: the other hero's own shown state (`TraitView.show`). `!name`: a note for this hero's own trait
   * (`TraitView.noteOwner`). The prefixes need no change on the server, which relays any short name.
   */
  peerStacks(name: string, n: number) {
    if (name[0] === '@') this.oppRt?.setOwn(name.slice(1), n);
    else if (name[0] === '!') { if (this.heroRt) this.heroRt.trait?.peerNote?.(this.heroRt, name.slice(1), n); }
    else this.heroRt?.setStacks(name, n);
  }

  /** The other hero's resource (sent with its moves). */
  peerResource(value: number) {
    if (this.oppRt) this.oppRt.res = value;
  }

  /** The other hero got a shield: the bubble here (hits on it are counted on that side). */
  peerShield(amount: number, seconds: number, color?: string) {
    if (!this.foe || !this.on) return;
    // Zero: the other hero ended its shield.
    if (amount <= 0) this.host.arena.clearShield(this.foe);
    else this.host.arena.shieldFigure(this.foe, amount, seconds, color);
  }

  peerDodged() {
    if (this.foe && this.on) this.host.arena.say('DODGED', '#7dffb0', this.foe.group.position, 1.2);
  }

  /** This side's HP as the server counts it. */
  setPlayerHp(hp: number) {
    this.playerHp = hp;
  }

  /** The server ended the match: the victory or defeat card with `text`. */
  netEnd(result: 'win' | 'loss', text: string) {
    if (!this.on) return;
    this.countdown = -1;
    this.banner.style.display = 'none';
    if (!this.over) this.finish(result === 'win' ? 'win' : 'lose');
    this.cardText.textContent = text;
  }

  /** The server ended a round but not the match: the hero stops and `text` says who took it; `startNet` runs the next. */
  netRoundEnd(text: string) {
    if (!this.on) return;
    this.countdown = -1;
    this.host.heroMode.locked = true;
    this.host.arena.projectiles.clear();
    this.showBanner(text, 999);
    this.banner.style.fontSize = '30px';
  }

  private sendCast(slot: number, target: Target) {
    const me = this.host.arena.caster.group.position;
    const p = 'enemy' in target ? target.enemy.group.position : target.point;
    const yaw = +this.host.arena.caster.group.rotation.y.toFixed(3);
    const id = ++this.castSeq;
    this.netIds.set(id, slot);
    if (this.netIds.size > 60) this.netIds.delete(this.netIds.keys().next().value!);
    const mods = this.heroLast?.slot === slot ? this.heroLast.mods : undefined;
    const bend = this.host.heroMode.castBend;
    this.net?.cast({ id, slot, x: p.x, z: p.z, fx: me.x, fz: me.z, enemy: 'enemy' in target, yaw, mods, bend: bend ? +bend.toFixed(3) : undefined });
  }

  /**
   * The remote hero is drawn `PEER_DELAY` ms in the past, between the two reports around that moment, so it moves
   * smoothly at an even speed; past the newest report it holds still instead of guessing.
   */
  private netFollow(dt: number, foe: Enemy, at: THREE.Vector3) {
    this.rooted = Math.max(0, this.rooted - dt);
    const track = this.peerTrack;
    if (!track.length) return;
    const t = performance.now() - PEER_DELAY;
    let i = 0;
    while (i < track.length - 1 && track[i + 1].at <= t) i++;
    const a = track[i], b = track[Math.min(i + 1, track.length - 1)];
    const k = b.at > a.at ? THREE.MathUtils.clamp((t - a.at) / (b.at - a.at), 0, 1) : 1;
    const d = new THREE.Vector3(a.x + (b.x - a.x) * k - at.x, 0, a.z + (b.z - a.z) * k - at.z);
    if (d.lengthSq() > 1e-8) this.host.arena.moveFoe(foe, d);
    const turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    foe.group.rotation.y = a.yaw + turn * k;
  }

  private showBanner(text: string, seconds: number, fontSize = '') {
    this.banner.textContent = text;
    this.banner.style.fontSize = fontSize;
    this.banner.style.display = 'block';
    this.banner.style.opacity = '1';
    this.bannerT = seconds;
  }

  private updateBanner(dt: number) {
    if (this.countdown > 0) {
      this.countdown = (this.countdownEnd - performance.now()) / 1000;
      if (this.countdown <= 0) {
        this.countdown = -1;
        this.waiting = false;
        // No opening beat after a countdown: the fight is on for both.
        if (!this.net) this.think = 0;
        this.host.heroMode.locked = false;
        this.showBanner('DUEL!', 0.9);
      } else if (this.banner.textContent !== String(Math.ceil(this.countdown))) {
        this.showBanner(String(Math.ceil(this.countdown)), 999);
      }
      return;
    }
    if (this.banner.style.display === 'none') return;
    this.bannerT -= dt;
    this.banner.style.opacity = String(Math.min(1, Math.max(0, this.bannerT * 2.5)));
    if (this.bannerT <= 0) this.banner.style.display = 'none';
  }

  update(dt: number) {
    if (!this.on) return;
    const arena = this.host.arena, hm = this.host.heroMode;
    const me = arena.caster.group.position;
    // The round's clock starts with the fight, on both screens.
    if (!this.waiting) this.time += dt;
    if (this.wallHits.length) this.landWallHits();
    this.arenaScene?.update?.(dt, this.time);
    this.oppAttack.update(dt);
    this.oppAttackFx.update(dt);
    this.traitFx.update(dt);
    const cam = this.host.arena.camera;
    // Over each head, from the bottom: what the other hero keeps on this one, this hero's bars, this hero's own pips, a word.
    const heroBarY = plateHeight(arena.caster), foeBarY = plateHeight(this.foe);
    const heroTop = this.traitFx.plate('hero', this.heroRt?.hiddenNow() ? null : arena.caster.group.position, heroBarY, this.plateFor(hm.currentKit, this.playerHp, this.playerMax, arena.caster, this.heroRt, false, true), cam);
    // A boss has its own bar at the top of the screen.
    const foeTop = this.traitFx.plate('foe', !this.foe || this.boss || this.oppRt?.hiddenNow() ? null : this.foe.group.position, foeBarY, this.foe && !this.boss ? this.plateFor(this.opponentKit, arena.hpOf(this.foe), this.foeMax, this.foe, this.oppRt, !!this.net, false) : null, cam);
    this.traitFx.pips('foe', this.foe?.group.position ?? null, this.heroRt?.allStacks() ?? [], cam, this.host.heroMode.currentKit.accent, foeBarY - 0.32);
    this.traitFx.pips('hero', this.host.arena.caster.group.position, this.oppRt?.allStacks() ?? [], cam, this.opponentKit.accent, heroBarY - 0.32);
    // Each hero's own state, visible to both players: pips above any stacks, a ring at the feet, marks on the ground.
    this.traitFx.pips('foeOwn', this.foe?.group.position ?? null, this.oppRt?.allOwn() ?? [], cam, this.opponentKit.accent, foeTop + 0.3);
    this.traitFx.pips('heroOwn', this.host.arena.caster.group.position, this.heroRt?.allOwn() ?? [], cam, this.host.heroMode.currentKit.accent, heroTop + 0.3);
    this.figure.setVeil(this.oppRt?.veilNow() ?? 0);
    this.bossFade(cam);
    hm.setFigureVeil(this.heroRt?.veilNow() ?? 0);
    if (this.figure.shown) this.figure.shown.visible = !this.oppRt?.hiddenNow();
    hm.setFigureHidden(!!this.heroRt?.hiddenNow());
    // What each hero's passive does to the other's size, and the word it keeps over the other's head.
    if (!this.boss) this.sizeFigure(this.foe, this.heroRt?.enemyScaleNow() ?? 1, this.opponentKit, dt);
    this.sizeFigure(arena.caster, this.oppRt?.enemyScaleNow() ?? 1, hm.currentKit, dt);
    this.traitFx.label('foe', this.foe?.group.position ?? null, foeTop + 0.7, this.heroRt?.enemyLabelNow() ?? null);
    this.traitFx.label('hero', arena.caster.group.position, heroTop + 0.7, this.oppRt?.enemyLabelNow() ?? null);
    this.traitFx.ring('foe', this.foe?.group.position ?? null, this.oppRt?.ringNow() ?? null);
    this.traitFx.ring('hero', this.host.arena.caster.group.position, this.heroRt?.ringNow() ?? null);
    this.traitFx.marks('foe', this.oppRt?.marksNow() ?? [], this.oppRt?.trait?.markLook);
    this.traitFx.marks('hero', this.heroRt?.marksNow() ?? [], this.heroRt?.trait?.markLook);
    this.zoneClock += dt;
    this.zones.update(this.zoneClock);
    this.flash.style.opacity = String(Math.max(0, Number(this.flash.style.opacity || 0) - dt * 2.5));
    this.updateBanner(dt);
    this.host.outline?.(this.hoverFoe && !this.over ? this.figure.shown : null);
    if (this.hazard || this.shift) {
      // The fight clock runs only while heroes can act: not in the countdown, not after the round.
      const live = !this.over && this.countdown < 0 && !hm.locked;
      // A fallen hero's clock goes on: both screens of a raid must reach each stage together.
      if (live || (this.boss?.meDown && !this.over && this.countdown < 0)) this.hazardClock += dt;
      if (this.hazard?.update(dt, this.hazardClock, live, this.hazardWorld) && this.mode === 'play') this.showBanner(this.hazard.warning, 1.1, '26px');
      const stage = this.shift?.update(dt, this.hazardClock + this.shiftOffset, live, this.shiftWorld);
      if (stage && this.mode === 'play') this.showBanner(stage, 1.8, '26px');
      this.host.arena.aiCover = this.shift?.aiCover ?? [];
      this.host.arena.aiBounds = this.shift?.aiBounds ?? null;
      this.shrinkRing(dt);
    }
    this.roomStep(dt);

    const foe = this.foe;
    const foePos = foe ? foe.group.position : OPPONENT_START;
    if (foe) {
      // A new hit on the opponent (its capsule flash jumped): the figure flinches away from the player and flashes.
      const fl = this.host.arena.flashOf(foe);
      if (fl && fl.v > this.foeFlash + 0.2) this.figure.hit(fl.v >= 1 ? 0.7 : 0.15, fl.tint, this.host.arena.caster.group.position);
      this.foeFlash = fl?.v ?? 0;
      this.foeHeld = Math.max(0, this.foeHeld - dt);
      this.figure.follow(dt, foePos, foe.group.rotation.y, { attack: this.oppAttack.motion, status: this.host.arena.statusOf(foe), held: this.foeHeld > 0 });
    }

    if (this.over) {
      this.overT += dt;
      if (this.over === 'lose') hm.fallHero(this.overT / 0.6);
      else {
        this.figure.fall(this.overT / 0.6);
        // One HP bar: a tag team falls together. Of Twin Flames, the first to fall already lies there (`rimStep`).
        if (!this.twin) this.rimFigure?.fall(this.overT / 0.6);
      }
      this.rimStep(dt);
      return;
    }
    this.healClock += dt;
    if (this.healClock >= 0.5) {
      this.healClock = 0;
      if (this.pendingHeal >= 1 && this.net) { this.net.heal(Math.round(this.pendingHeal)); this.pendingHeal = 0; }
    }
    if (this.countdown < 0 && !this.host.heroMode.locked) {
      this.heroRt?.tick(dt);
      if (this.net) this.oppRt?.tickClocks(dt);
      else this.oppRt?.tick(dt);
      // A hero's rule that acts on the enemy runs where that enemy is decided (`Trait.victimTick`).
      if (this.oppRt) this.oppRt.trait?.victimTick?.(this.oppRt, dt);
      if (!this.net && this.heroRt) this.heroRt.trait?.victimTick?.(this.heroRt, dt);
    }
    // Network duel: the server declares the winner (`netEnd`); the opponent is the other player.
    if (this.net) {
      if (foe) this.netFollow(dt, foe, foePos);
      this.renderHud();
      return;
    }
    // A boss fight: the link says when it is over, not the HP on this screen.
    if (this.boss) {
      const fight = this.boss, live = !this.waiting && this.countdown < 0;
      this.holdHalf();
      this.logWalk(dt, me);
      fight.update(dt, live, foe ? arena.hpOf(foe) : 0);
      this.host.heroMode.cooldownRate = fight.upgrades?.cooldownRate(fight.open) ?? 1;
      this.partnerStep(dt, cam);
      this.rimStep(dt);
      if (this.boss && !this.over) {
        if (this.playerHp <= 0) {
          // It lies where it fell until a partner gets it up. Alone, the link ends the fight here.
          if (!fight.meDown) {
            this.downT = 0;
            hm.locked = true;
            fight.heroDown();
          }
          this.downT += dt;
          if (!this.over) hm.fallHero(Math.min(1, this.downT / 0.6));
        } else if (live && this.autopilot && foe) this.pilot(dt, foe, foePos, me);
      }
      if (this.boss) this.renderHud();
      return;
    }
    if (!foe || arena.hpOf(foe) <= 0) return this.finish('win');
    if (this.playerHp <= 0) return this.finish('lose');

    // The player's walk, smoothed over about 0.2 s: a CPU level with a `lead` aims where the player is heading.
    if (this.playerLast && dt > 0) {
      const k = Math.min(1, dt / 0.2);
      this.playerVel.x += ((me.x - this.playerLast.x) / dt - this.playerVel.x) * k;
      this.playerVel.z += ((me.z - this.playerLast.z) / dt - this.playerVel.z) * k;
    }
    (this.playerLast ??= new THREE.Vector3()).copy(me);
    if (this.waiting) {
      this.renderHud();
      return;
    }
    this.ai(dt, foe, foePos, me);
    if (this.autopilot) this.pilot(dt, foe, foePos, me);
    this.renderHud();
  }

  // --- the opponent ---------------------------------------------------------------------------------------

  private ai(dt: number, foe: Enemy, at: THREE.Vector3, me: THREE.Vector3) {
    for (let i = 0; i < 4; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    this.rooted = Math.max(0, this.rooted - dt);
    this.think = Math.max(0, this.think - dt);
    this.castWait = Math.max(0, this.castWait - dt);
    const lv = this.cpuLevel;
    // Statuses on the opponent: stun / knock-up = no move, no cast; root = no move; slow = x0.6; silence = no cast.
    const st = this.host.arena.statusOf(foe);
    // Charmed: it walks to the hero and does nothing else.
    if (st?.charmed && !this.host.arena.isDashing(foe)) {
      const d = new THREE.Vector3(me.x - at.x, 0, me.z - at.z), len = d.length();
      if (len > 1.2) this.host.arena.moveFoe(foe, d.multiplyScalar(this.aiSpeed(this.opponentKit, this.cpuLevel) * st.speedMul * dt / len), true);
      this.face(foe, me);
      return;
    }
    if (st?.stunned || this.host.arena.isDashing(foe)) return;
    if (this.rooted > 0 || this.think > 0) {
      this.face(foe, me);
      return;
    }
    // A hit on its way: a ready parry or bolt wall answers it (cast below, before anything else); otherwise step off a
    // skillshot's line before casting or walking on (if the roll says so).
    const hm = this.host.heroMode;
    const guard = this.guards(foe, at, hm.attackWinding && flat(at, me) <= hm.attackRange + 0.5);
    const guarding = !st?.cannotCast && this.castWait <= 0 && this.guarded(this.opponentKit, guard, (i) => this.cooldowns[i] <= 0);
    const side = st?.cannotMove || guarding ? null : this.dodgeBolt(this.opponentDodge, foe, at);
    if (side) {
      this.host.arena.moveFoe(foe, side.multiplyScalar(this.aiSpeed(this.opponentKit, lv) * (st?.speedMul ?? 1) * dt), true);
      this.face(foe, me);
      return;
    }
    // Hard and Master also walk out of the player's area zones before they land (Normal never does).
    const out = st?.cannotMove || lv.zoneDodge <= 0 ? null : this.dodgeZones(at, me);
    if (out) {
      this.host.arena.moveFoe(foe, out.multiplyScalar(this.aiSpeed(this.opponentKit, lv) * (st?.speedMul ?? 1) * dt), true);
      this.face(foe, me);
      return;
    }
    // Every level walks out of an arena hazard's zones (the roll decides whether it notices in time).
    const clear = st?.cannotMove ? null : this.hazardStep(foe, at, me);
    if (clear) {
      this.host.arena.moveFoe(foe, clear.multiplyScalar(this.aiSpeed(this.opponentKit, lv) * (st?.speedMul ?? 1) * dt), true);
      this.face(foe, me);
      return;
    }
    const sees = this.host.arena.lineOfSight(at, me);
    // A lower level waits a moment after each cast (`castGap`); it still walks and attacks meanwhile.
    if (!st?.cannotCast && this.castWait <= 0) {
      const mine = this.host.heroMode.status;
      // A unit of the hero's that stands in the way is shot at first; otherwise the hero.
      const full = this.host.arena.summons.alive('opponent').length >= MAX_UNITS;
      // An open recast counts as ready (the AI fires its free second cast when it is in reach).
      const ward = this.ward(this.heroRt);
      const opens = (i: number) => !!this.oppRt?.canRecast(i) && !this.oppRt.recastOf(i)?.aiWait;
      const aiHolds = (i: number) => !!this.oppRt?.trait?.aiHold?.(this.oppRt, i, flat(at, me));
      const cooling = (i: number) => (ward > 0 && (ward > 1 || i !== 0)) || aiHolds(i) || (!opens(i) && (this.cooldowns[i] > 0 || !!this.oppRt?.blocked(i)));
      const held = mine.stunned || mine.has('root');
      // The hero first; a unit only when nothing can be cast at the hero (out of range or sight) and a unit is within 2.5 m.
      let pick = this.pickSpell(this.opponentKit, cooling, flat(at, me), this.playerHp / this.playerMax, sees, held, flat(at, me), full, this.host.arena.hpOf(foe) / this.foeMax, guard, lv);
      let unit: ReturnType<Duel['blocker']> = null;
      if (!pick && (unit = this.blocker('hero', at, me))) {
        pick = this.pickSpell(this.opponentKit, cooling, flat(at, unit.pos), this.playerHp / this.playerMax,
          this.host.arena.lineOfSight(at, unit.pos), held, flat(at, me), full, this.host.arena.hpOf(foe) / this.foeMax, guard, lv);
      }
      if (pick) {
        this.castSpell(pick.i, foe, at, me, pick.spec, this.opponentKit.spells[pick.i].summon ? this.summonSpot(at, me) : undefined, 0, unit?.figure);
        if (lv.castGap[1] > 0) this.castWait = lv.castGap[0] + Math.random() * (lv.castGap[1] - lv.castGap[0]);
        return;
      }
    }
    // Basic attack: nothing to cast, the hero in reach. Stands still through the wind-up.
    if (this.oppAttack.winding || (this.rooted <= 0 && this.oppAttack.inRange(at, me) && this.oppAttack.start(this.host.arena.caster))) {
      return;
    }
    if (st?.cannotMove) {
      this.face(foe, me);
      return;
    }
    // Something of the hero's that this CPU should walk to or away from (`Trait.enemyGoal`) beats its usual steering.
    const goal = this.reachableGoal(this.opponentAi, at, (this.oppRt && this.oppRt.trait?.aiGoal?.(this.oppRt)) ?? this.heroRt?.trait?.enemyGoal?.(this.heroRt), dt);
    const move = this.offZones(at, goal ? this.goalStep(this.opponentAi, at, goal) : this.steer(this.opponentAi, this.opponentKit, at, me, dt, !sees, 'hero', this.oppAttack.range));
    // A planned route already clears the cover: no wall slide on it.
    if (move.lengthSq() > 0) {
      this.host.arena.moveFoe(foe, move.multiplyScalar(this.aiSpeed(this.opponentKit, lv) * (st?.speedMul ?? 1) * dt), !this.opponentAi.routed);
      // A CPU looks where it walks, as a person's hero does, so its back can be reached (Nyx's Umbral Cut). It faces the hero to cast.
      const want = Math.atan2(move.x, move.z), now = foe.group.rotation.y;
      foe.group.rotation.y = now + Math.atan2(Math.sin(want - now), Math.cos(want - now)) * Math.min(1, dt * 12);
    } else this.face(foe, me);
  }

  /**
   * The spell to cast now, if any: the first ready one in the order R, E, W, Q that is in reach. R waits until the
   * other side is under the level's `ultHp` or the round is `ultTime` s old (Normal: 55%, 20 s); E (self) waits until
   * the other side is inside its radius.
   * Without line of sight (`sees` false: a pillar or wall between them) only self spells can go.
   * A crowd-control spell (`cc`: stun or root) goes first when it is in reach, unless the other side is held already
   * (`otherHeld`).
   * `d` is the distance to what it shoots at (the hero, or a unit in the way); `dHero` the distance to the hero, which a
   * summon spell goes by (ready and the hero within `SUMMON_REACH`, unless `full`: the side has the most units).
   * A parry or a bolt wall (`HeroSpell.parry` / `barrier`) goes only when `guard` says a hit is on its way, and then first.
   */
  private pickSpell(kit: HeroKit, cooling: (i: number) => boolean, d: number, otherHp: number, sees: boolean, otherHeld = false, dHero = d, full = false, ownHp = 1, guard = NO_GUARD, lv = CPU_BALANCE) {
    const ready = (i: number) => {
      if (cooling(i)) return null;
      const spell = kit.spells[i];
      const spec = this.host.targeting(spell.label);
      if (!spec) return null;
      if (spell.anytime) return { i, spec };
      if (spell.summon) return full || dHero > SUMMON_REACH ? null : { i, spec };
      // A last stand waits for the caster's own HP, not the enemy's.
      if (spell.save) return ownHp <= SAVE_HP && dHero <= SAVE_REACH ? { i, spec } : null;
      if (spell.escape) return dHero <= ESCAPE_REACH ? { i, spec } : null;
      // A parry or a bolt wall answers a hit on its way (its own range does not matter). One that is also a dash (a
      // dodge step) still closes gaps by the dash rule below; otherwise it waits for the hit.
      if (spell.parry || spell.barrier) {
        if ((spell.parry && guard.parry) || (spell.barrier && guard.barrier)) return { i, spec };
        if (!spell.dash) return null;
      }
      const reach = spec.mode === 'self' ? (spec.radius ?? 5) - 0.6 : spell.range;
      if (d > reach || (spec.mode !== 'self' && !sees)) return null;
      // A gap closer only when the target is out of Q's range (it would waste the dash otherwise). An ultimate that leaps
      // in (Dawn Descent lands with a stun) goes in its own range like any spell.
      if (spell.dash && i !== 3 && d <= kit.spells[0].range + 0.5) return null;
      if (i === 3 && otherHp > lv.ultHp && this.time < lv.ultTime) return null;
      return { i, spec };
    };
    if (guard.parry || guard.barrier) {
      for (const i of [3, 2, 1, 0]) {
        const pick = this.guarded(kit, guard, () => true, i) ? ready(i) : null;
        if (pick) return pick;
      }
    }
    if (!otherHeld) {
      for (const i of [3, 2, 1, 0]) {
        const pick = kit.spells[i].cc ? ready(i) : null;
        if (pick) return pick;
      }
    }
    for (const i of [3, 2, 1, 0]) {
      const pick = ready(i);
      if (pick) return pick;
    }
    return null;
  }

  /**
   * A trait's goal for this CPU, unless it has stood still short of it: the spot is where it cannot stand (under a wall a spell
   * raised), or a rule keeps turning it back. It then fights for a while: two CPUs each waiting on a goal would wait for ever.
   */
  private reachableGoal(st: { goalT: number; goalSeen: boolean; goalOff: number; goalFrom: THREE.Vector3 }, at: THREE.Vector3, goal: { x: number; z: number } | null | undefined, dt: number) {
    // A goal in a part of the floor that hurts is dropped: a person may pay to fetch it, a CPU does not.
    if (goal && ((this.shift && !this.shift.safe(goal.x, goal.z)) || this.roomFloor?.safe(goal.x, goal.z) === false)) goal = null;
    st.goalOff = Math.max(0, st.goalOff - dt);
    if (st.goalOff > 0) return null;
    st.goalT += dt;
    st.goalSeen ||= !!goal;
    if (st.goalT >= GOAL_CHECK) {
      const still = st.goalSeen && flat(at, st.goalFrom) < 0.3 && (!goal || Math.hypot(at.x - goal.x, at.z - goal.z) > 0.5);
      st.goalT = 0;
      st.goalSeen = false;
      st.goalFrom.copy(at);
      if (still) { st.goalOff = GOAL_REST; return null; }
    }
    return goal ?? null;
  }

  /** A step toward a trait's own goal (`aiGoal`, `enemyGoal`): straight when it can, else on the planned way round the cover. */
  private goalStep(st: { routed?: boolean }, at: THREE.Vector3, goal: { x: number; z: number }) {
    const to = new THREE.Vector3(goal.x, 0, goal.z);
    st.routed = !this.host.arena.aiPathClear(at, to);
    const p = st.routed ? this.host.arena.aiRoute(st, at, to).point : to;
    return new THREE.Vector3(p.x - at.x, 0, p.z - at.z).normalize();
  }

  /**
   * A unit move: hold ~70% of Q's range from `other`, strafe around it, flip the strafe every 1.5–3.5 s. `blocked`
   * (no line of sight): close in to half that distance, so the strafe comes round the cover. A melee kit closes to
   * about 2 m instead, never backs off, strafes only a little, and so keeps chasing a target that retreats.
   */
  private steer(st: { strafe: number; strafeT: number; closing?: boolean; routed?: boolean; hiddenT?: number }, kit: HeroKit, at: THREE.Vector3, other: THREE.Vector3, dt: number, blocked = false, foeSide?: SummonSide, reach = Infinity) {
    const d = flat(at, other);
    const melee = !!kit.melee;
    // Sight lost: it stays "hidden" a moment after it comes back, or the strafe would walk it behind the corner again and
    // it would dance there, one step round, one step back.
    st.hiddenT = blocked ? SIGHT_HOLD : Math.max(0, (st.hiddenT ?? 0) - dt);
    blocked = st.hiddenT > 0;
    // A ranged kit holds ~70% of Q's range, but no farther than its basic attack reaches (`reach`).
    const want = melee ? Math.min(MELEE_GAP, reach - 0.4) : Math.min(kit.spells[0].range * (blocked ? 0.35 : 0.7), reach - 0.6);
    const to = new THREE.Vector3(other.x - at.x, 0, other.z - at.z);
    to.divideScalar(Math.max(to.length(), 1e-3));
    st.strafeT -= dt;
    if (st.strafeT <= 0) { st.strafe = -st.strafe; st.strafeT = 1.5 + Math.random() * 2; }
    const move = new THREE.Vector3();
    // Closing in starts past the far edge of the band and goes on to its near edge: one exact distance would flip it
    // between walking in and strafing on every frame.
    const band = melee ? 0.3 : 1;
    // Thin cover lets two bodies stand within 1.5 m across it: with no sight yet, that is no place to stop.
    if (d > want + band || (blocked && (d > 1.5 || !this.host.arena.lineOfSight(at, other)))) st.closing = true;
    else if (d <= want + band * 0.4 || blocked) st.closing = false;
    const closing = !!st.closing;
    // Cover in the way: the planned way round it (src/nav.ts), without the strafe, which would walk it off the route.
    st.routed = closing && !this.host.arena.aiPathClear(at, other);
    if (st.routed) {
      const p = this.host.arena.aiRoute(st, at, other).point;
      move.set(p.x - at.x, 0, p.z - at.z);
    } else {
      if (closing) move.add(to);
      else if (!melee && d < want - 2) move.sub(to);
      // Strafe the way that keeps the other side in sight; if neither does, not at all.
      const arena = this.host.arena;
      const seesFrom = (side: number) => arena.lineOfSight(new THREE.Vector3(at.x - to.z * side * STRAFE_LOOK, 0, at.z + to.x * side * STRAFE_LOOK), other);
      if (!seesFrom(st.strafe) && seesFrom(-st.strafe)) { st.strafe = -st.strafe; st.strafeT = 1.5 + Math.random() * 2; }
      if (seesFrom(st.strafe)) move.addScaledVector(new THREE.Vector3(-to.z, 0, to.x), (melee ? 0.3 : 0.8) * st.strafe);
    }
    // Step away from enemy melee units in contact, so they do not hit for free.
    if (foeSide && !melee) {
      for (const u of this.host.arena.summons.alive(foeSide)) {
        const ud = flat(u.pos, at);
        if (u.kind === 'melee' && ud < 2.4) move.add(new THREE.Vector3(at.x - u.pos.x, 0, at.z - u.pos.z).divideScalar(Math.max(ud, 0.2)).multiplyScalar(1.6));
      }
    }
    return move.lengthSq() > 0 ? move.normalize() : move;
  }

  /**
   * What the AI holds its spells for: 2 while the other hero sits in an ice block (nothing lands), 1 while its void maw
   * is open (only Q goes in, as bait), else 0.
   */
  private ward(rt: TraitRuntime | null) {
    if (!rt) return 0;
    if (rt.time < (rt.mem.iceUntil ?? 0)) return 2;
    return rt.mem.mawCast === -1 && rt.time < (rt.mem.mawUntil ?? 0) ? 1 : 0;
  }

  /** Autopilot: the player's hero fights with the same rules as the opponent (for duel simulations). */
  private pilot(dt: number, foe: Enemy, at: THREE.Vector3, me: THREE.Vector3) {
    const hm = this.host.heroMode;
    // A stage: the boss can't be hurt, and the nearest of its adds is the one to go for.
    if (this.bossGuard) {
      let bd = Infinity;
      for (const u of this.host.arena.summons.alive('opponent')) {
        // Twin Flames: the other half's adds are across the wall.
        if (!this.reachable(u.pos)) continue;
        const d = flat(me, u.pos);
        if (d < bd) { bd = d; foe = u.figure; at = u.pos; }
      }
    }
    this.playerThink = Math.max(0, this.playerThink - dt);
    // The autopilot obeys the player's statuses like the opponent's AI does.
    const st = hm.status;
    if (hm.isRooted || this.playerThink > 0 || st.stunned || this.host.arena.isDashing(this.host.arena.caster)) return;
    // A beat that burns whoever walks (the Heart's Hold Still): it stands for it as if it could not move, and goes on casting.
    const beat = this.boss?.stillIn ?? Infinity;
    const held = st.cannotMove || beat < STILL_LEAD;
    const kit = hm.currentKit;
    const guard = this.guards(this.host.arena.caster, me, this.oppAttack.winding && this.oppAttack.inRange(at, me));
    const guarding = !st.cannotCast && this.guarded(kit, guard, (i) => hm.ready(i));
    const side = held || guarding ? null : this.dodgeBolt(this.playerDodge, this.host.arena.caster, me);
    if (side) {
      this.host.arena.walk(side.multiplyScalar(this.aiSpeed(hm.currentKit, CPU_BALANCE) * st.speedMul * dt));
      return;
    }
    // A spot that ends the danger it stands in (a shard to the altar against Noon) is worth walking through that danger for.
    const beats = held ? null : this.boss?.objectiveGoal(me.x, me.z);
    if (beats?.beats) {
      const step = this.goalStep(this.playerAi, me, beats);
      this.host.arena.walk(step.multiplyScalar(this.aiSpeed(kit, CPU_BALANCE) * st.speedMul * dt), Infinity, !this.playerAi.routed);
      return;
    }
    const clear = held ? null : this.hazardStep(this.host.arena.caster, me, at);
    if (clear) {
      this.host.arena.walk(clear.multiplyScalar(this.aiSpeed(kit, CPU_BALANCE) * st.speedMul * dt));
      return;
    }
    // A boss's gold zone: go and stand in it, against every habit. A fallen partner comes next: stand by it, and cast nothing.
    const fallen = this.fallenMine()?.pos ?? null;
    const script = this.boss;
    // Hidden from a killing hit still to come (behind a pillar from Ash's Charge): it stays there, and casts nothing, until it has passed.
    if (script?.mustHide && script.hidden(me.x, me.z)) return;
    // A spot to take waits while something is about to land on it: a person steps back in once it has.
    const objective = script?.objectiveGoal(me.x, me.z);
    const safe = objective && !script!.danger(objective.x, objective.z, BOSS_LOOK) ? objective : null;
    const spot = held ? null : safe ?? script?.standGoal(me.x, me.z) ?? fallen;
    // Not into a room's lava for it.
    const stand = spot && this.roomFloor?.safe(spot.x, spot.z) === false ? null : spot;
    if (stand) {
      if (Math.hypot(stand.x - me.x, stand.z - me.z) > 0.8) {
        const step = this.goalStep(this.playerAi, me, stand);
        this.host.arena.walk(step.multiplyScalar(this.aiSpeed(kit, CPU_BALANCE) * st.speedMul * dt), Infinity, !this.playerAi.routed);
      }
      return;
    }
    if (this.inHall) return;
    const sees = this.host.arena.lineOfSight(me, at);
    const theirs = this.host.arena.statusOf(foe);
    if (!st.cannotCast && !this.boss?.wary) {
      const full = this.host.arena.summons.alive('hero').length >= MAX_UNITS;
      const ward = this.ward(this.oppRt);
      const waits = (i: number) => (!!this.heroRt?.canRecast(i) && !!this.heroRt.recastOf(i)?.aiWait) || !!this.heroRt?.trait?.aiHold?.(this.heroRt, i, flat(me, at));
      // A dash is a walk: none so close to a beat that it would still be going.
      const cooling = (i: number) => (ward > 0 && (ward > 1 || i !== 0)) || !hm.ready(i) || waits(i) || (beat < STILL_DASH && !!kit.spells[i].dash);
      const foeHeld = !!theirs && (theirs.stunned || theirs.has('root'));
      const foeHp = this.host.arena.hpOf(foe) / this.foeMax;
      // The hero first; a unit only when nothing can be cast at the hero and a unit is within 2.5 m.
      let pick = this.pickSpell(kit, cooling, flat(me, at), foeHp, sees, foeHeld, flat(me, at), full, this.playerHp / this.playerMax, guard);
      let unit: ReturnType<Duel['blocker']> = null;
      if (!pick && (unit = this.blocker('opponent', me, at))) {
        pick = this.pickSpell(kit, cooling, flat(me, unit.pos), foeHp, this.host.arena.lineOfSight(me, unit.pos), foeHeld, flat(me, at), full, this.playerHp / this.playerMax, guard);
      }
      const tpos = unit ? unit.pos : at;
      if (pick) {
        const spell = kit.spells[pick.i];
        const target = pick.spec.mode === 'enemy' || pick.spec.mode === 'enemies' ? { enemy: unit?.figure ?? foe }
          : {
            point: pick.spec.mode === 'self' ? me.clone() : spell.summon ? this.summonSpot(me, at) : spell.escape ? fleeAim(me, at, spell.range) : spell.dash ? dashAim(me, at, spell.range)
              : unit ? tpos.clone() : bestSpot(at, pick.spec.radius ?? 5, this.host.arena.summons.alive('opponent').map((u) => u.pos)),
          };
        if (hm.autoCast(pick.i, target)) { this.stats.playerCasts++; return; }
      }
    }
    // Basic attack: nothing to cast, the opponent in reach. Stands still through the wind-up.
    if (hm.attackWinding || hm.autoAttack(foe)) return;
    if (held) return;
    const goal = this.reachableGoal(this.playerAi, me, (this.heroRt && this.heroRt.trait?.aiGoal?.(this.heroRt)) ?? this.oppRt?.trait?.enemyGoal?.(this.oppRt), dt);
    const move = this.offZones(me, goal ? this.goalStep(this.playerAi, me, goal) : this.steer(this.playerAi, kit, me, at, dt, !sees, 'opponent', hm.attackRange));
    if (move.lengthSq() > 0) this.host.arena.walk(move.multiplyScalar(this.aiSpeed(kit, CPU_BALANCE) * st.speedMul * dt), Infinity, !this.playerAi.routed);
  }

  /**
   * Skillshot dodge for an AI-driven figure `who` standing at `at`: returns a unit step across the line of the first
   * bolt that will cross its position within `BOLT_WINDOW`, or null. Each bolt is rolled once (the CPU level's
   * `boltDodge`) when it first threatens, and a successful roll starts moving `boltReaction` later, so a dodge is
   * imperfect.
   */
  /**
   * What a hit on its way calls for: `parry` when an enemy bolt on `who`'s line arrives within PARRY_LEAD s, or `swing`
   * (the enemy's basic attack is winding up in reach); `barrier` when a bolt arrives within BARRIER_LEAD s but is still
   * BARRIER_GAP m out, so a wall in front of `who` stands before it.
   */
  private guardRolls = new WeakMap<Enemy, { on: boolean; pass: boolean }>();

  private guards(who: Enemy, at: THREE.Vector3, swing: boolean) {
    let parry = swing, barrier = false;
    for (const t of this.host.arena.projectiles.threats(who)) {
      const rx = at.x - t.pos.x, rz = at.z - t.pos.z;
      const ahead = rx * t.dir.x + rz * t.dir.z;
      const lateral = -rx * t.dir.z + rz * t.dir.x;
      const need = t.radius + BODY_RADIUS + 0.15;
      if (ahead < -need || ahead > t.rangeLeft + need || Math.abs(lateral) > need) continue;
      const eta = ahead / t.speed;
      if (eta <= PARRY_LEAD) parry = true;
      if (eta <= BARRIER_LEAD && ahead >= BARRIER_GAP) barrier = true;
    }
    // One roll per threat: it holds while the threat lasts, a new one rolls again.
    let roll = this.guardRolls.get(who);
    if (!roll) this.guardRolls.set(who, (roll = { on: false, pass: false }));
    const any = parry || barrier;
    if (any && !roll.on) roll.pass = Math.random() < this.levelOf(who).guard;
    roll.on = any;
    return any && roll.pass ? { parry, barrier } : NO_GUARD;
  }

  /** Whether `kit` has a parry or a bolt wall (slot `only`, else any) that `guard` calls for and `ready` allows. */
  private guarded(kit: HeroKit, guard: { parry: boolean; barrier: boolean }, ready: (i: number) => boolean, only?: number) {
    return kit.spells.some((s, i) => (only === undefined || i === only) && ((s.parry && guard.parry) || (s.barrier && guard.barrier)) && ready(i));
  }

  private dodgeBolt(memory: Map<number, BoltDodge>, who: Enemy, at: THREE.Vector3): THREE.Vector3 | null {
    const threats = this.host.arena.projectiles.threats(who);
    const ids = new Set(threats.map((t) => t.id));
    for (const id of memory.keys()) if (!ids.has(id)) memory.delete(id);
    let step: THREE.Vector3 | null = null;
    for (const t of threats) {
      const rx = at.x - t.pos.x, rz = at.z - t.pos.z;
      const ahead = rx * t.dir.x + rz * t.dir.z;
      const lateral = -rx * t.dir.z + rz * t.dir.x;
      const need = t.radius + BODY_RADIUS + 0.15;
      if (ahead < -need || ahead > t.rangeLeft + need || ahead / t.speed > BOLT_WINDOW || Math.abs(lateral) > need) {
        // Not a threat (yet): a decided dodge stays decided while it is still ahead and close to the line.
        if (ahead < -need) memory.delete(t.id);
        continue;
      }
      let m = memory.get(t.id);
      if (!m) {
        const lv = this.levelOf(who);
        m = { react: Math.random() < lv.boltDodge, side: lateral >= 0 ? 1 : -1, at: this.time + lv.boltReaction };
        memory.set(t.id, m);
      }
      if (m.react && this.time >= m.at && !step) step = new THREE.Vector3(-t.dir.z * m.side, 0, t.dir.x * m.side);
    }
    return step;
  }

  /**
   * The CPU's zone dodge (Hard, Master): when the opponent stands in an area zone of the player's that shows and has not
   * landed yet, or within DODGE_RADIUS of where that cast aimed (either one lands the hit, see `opponentHit`), it walks
   * to the nearest open spot clear of all of them, keeping its distance to the player. Each cast is rolled once
   * (`zoneDodge`) and a dodge starts `zoneReaction` s after the cast. Line zones are left to the bolt dodge (they are
   * skillshots). Returns a unit step, or null.
   */
  private dodgeZones(at: THREE.Vector3, me: THREE.Vector3): THREE.Vector3 | null {
    const lv = this.cpuLevel, now = this.time;
    const pending = (c: EnemyCast & { t: number }) =>
      c.zones.filter((z) => z.shape.kind !== 'line' && now - c.t >= z.start && now - c.t < (z.until ?? z.impact));
    const live = this.playerCastsRecent
      .filter((c) => c.round === this.round)
      .map((c) => {
        const zones = pending(c);
        return { c, zones };
      })
      .filter((l) => l.zones.length);
    for (const id of this.zoneDodges.keys()) if (!live.some((l) => l.c.id === id)) this.zoneDodges.delete(id);
    const hits = (l: (typeof live)[number], x: number, z: number) =>
      l.zones.some((zn) => insideTelegraph(grownShape(zn.shape, ZONE_MARGIN), x, z));
    let go = false;
    for (const l of live) {
      if (!hits(l, at.x, at.z)) continue;
      let m = this.zoneDodges.get(l.c.id);
      if (!m) this.zoneDodges.set(l.c.id, (m = { react: Math.random() < lv.zoneDodge, at: l.c.t + lv.zoneReaction }));
      if (m.react && now >= m.at) go = true;
    }
    if (!go) return null;
    return this.escapeStep(at, me, (x, z) => live.some((l) => hits(l, x, z)));
  }

  /** An AI's step out of the arena hazard's coming hit, if it reacts to this event (`CpuLevel.hazardDodge`), or null. */
  private hazardStep(who: Enemy, at: THREE.Vector3, other: THREE.Vector3) {
    if (this.boss) return this.bossStep(who, at, other);
    const hz = this.hazard, shift = this.shift;
    // A part of the floor that stays changed will not pass by itself: every level walks out, with nothing to roll.
    if (shift && !shift.safe(at.x, at.z)) {
      const out = this.escapeStep(at, other, (x, z) => !shift.safe(x, z) || !!hz?.danger(x, z, HAZARD_CLEAR));
      if (out) return out;
    }
    if (!hz?.active || !hz.danger(at.x, at.z, HAZARD_LOOK)) return null;
    let roll = this.hazardRolls.get(who);
    if (!roll || roll.id !== hz.eventId) {
      const lv = this.levelOf(who);
      roll = { id: hz.eventId, react: Math.random() < lv.hazardDodge, at: this.hazardClock + lv.boltReaction + 0.1 };
      this.hazardRolls.set(who, roll);
    }
    if (!roll.react || this.hazardClock < roll.at) return null;
    return this.escapeStep(at, other, (x, z) => hz.danger(x, z, HAZARD_CLEAR) || !!(shift && !shift.safe(x, z)));
  }

  /** An AI's step out of a boss's zones, if it reacts to this cast (rolled once a cast, like an arena event), or null. */
  private bossStep(who: Enemy, at: THREE.Vector3, other: THREE.Vector3) {
    const script = this.boss!, shift = this.shift, floor = this.roomFloor;
    // The parts of the floor that hurt for good (what closes in, a room's lava): out of them first, whatever else shows.
    const hurts = (x: number, z: number) => !!(shift && !shift.safe(x, z)) || floor?.safe(x, z) === false;
    if (hurts(at.x, at.z)) {
      const out = this.escapeStep(at, other, hurts);
      if (out) return out;
      // No dry spot near (the flood came over it far from its edge): toward what the room says is left.
      if (floor?.refuge && floor.safe(at.x, at.z) === false) return this.goalStep(this.playerAi, at, floor.refuge);
    }
    if (!script.danger(at.x, at.z, BOSS_LOOK)) return null;
    let roll = this.hazardRolls.get(who);
    if (!roll || roll.id !== script.eventId) {
      const lv = this.levelOf(who);
      roll = { id: script.eventId, react: Math.random() < lv.hazardDodge, at: this.time + lv.boltReaction + 0.1 };
      this.hazardRolls.set(who, roll);
    }
    // A person who has seen a zone doesn't start a long cast in it: it stands and takes the moment to read it. A warning of a
    // killing hit nobody lets pass.
    const hide = script.mustHide;
    if (!roll.react && !hide) return null;
    if (this.time < roll.at) return new THREE.Vector3();
    for (const within of BOSS_CLEAR) {
      const spot = this.escapeSpot(at, other, (x, z) => script.danger(x, z, within) || hurts(x, z), this.pilotWay, hide ? HIDE_REACH : CLEAR_REACH);
      // On the planned way round cover: a straight step can wedge between two pieces of it.
      if (spot) {
        const step = this.goalStep(this.playerAi, at, spot);
        this.pilotWay.copy(step);
        return step;
      }
    }
    return null;
  }

  /** An AI's unit step, kept out of the parts of the floor that hurt: it slides along the edge, or waits. */
  private offZones(at: THREE.Vector3, move: THREE.Vector3) {
    const shift = this.shift, floor = this.roomFloor;
    if ((!shift && !floor) || move.lengthSq() === 0) return move;
    // Standing in a room's lava already, any step is as good: it is on its way out.
    const inIt = floor?.safe(at.x, at.z) === false;
    const clear = (m: THREE.Vector3) => (!shift || shift.safe(at.x + m.x * ZONE_LOOK, at.z + m.z * ZONE_LOOK)) && (inIt || floor?.safe(at.x + m.x * ZONE_LOOK, at.z + m.z * ZONE_LOOK) !== false);
    if (clear(move)) return move;
    const side = new THREE.Vector3(-move.z, 0, move.x);
    if (clear(side)) return move.copy(side);
    side.negate();
    return clear(side) ? move.copy(side) : move.set(0, 0, 0);
  }

  /** A unit step toward the nearest open spot that is not `unsafe`, keeping the distance to `me`, or null. */
  private escapeStep(at: THREE.Vector3, me: THREE.Vector3, unsafe: (x: number, z: number) => boolean) {
    return this.escapeSpot(at, me, unsafe)?.sub(at).setY(0).normalize() ?? null;
  }

  /**
   * The nearest open spot that is not `unsafe`, keeping the distance to `me`, or null. `reach` past the usual: hiding from a killing
   * hit, any spot will do, even one only reached round cover (the walk goes round).
   */
  private escapeSpot(at: THREE.Vector3, me: THREE.Vector3, unsafe: (x: number, z: number) => boolean, way?: THREE.Vector3, reach = CLEAR_REACH) {
    const keep = flat(at, me);
    const obstacles = this.host.arena.obstacles ?? [];
    const open = (x: number, z: number) =>
      Math.hypot(x - RING.x, z - RING.z) <= (this.currentArena?.ring ?? RING.r) - 0.8 && obstacles.every((o) => capsuleDist(x, z, o) > o.r + BODY_RADIUS)
      && this.reachable({ x, z });
    // Rings of 16 spots, nearest first; on each ring the spot that keeps the distance to the player best, by a free path. Hiding, 48:
    // the floor behind a pillar far from the boss is a strip 2 m wide, which 16 spots on a wide ring step over.
    const n = reach > CLEAR_REACH ? 48 : 16;
    for (let r = 0.6; r <= reach; r += 0.6) {
      const spots: { p: THREE.Vector3; score: number }[] = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
        if (!open(x, z) || unsafe(x, z)) continue;
        const p = new THREE.Vector3(x, 0, z);
        // Going a way already: better to keep going than to double back.
        const on = way && way.lengthSq() > 0 ? ((x - at.x) * way.x + (z - at.z) * way.z) / r : 0;
        spots.push({ p, score: Math.abs(flat(p, me) - keep) - on * 3 });
      }
      spots.sort((a, b) => a.score - b.score);
      const free = spots.find((s) => obstacles.every((o) => pathDist(at, s.p, o) > o.r + BODY_RADIUS * 0.5));
      if (free) return free.p;
      if (reach > CLEAR_REACH && spots.length) return spots[0].p;
    }
    return null;
  }

  /**
   * A CPU level's lead plus its aim error for a ground cast of `label`; zero at Normal. The lead is a share of the
   * spell's own time to land (seen on its last cast, 0.5 s before that), so a quick spell is never aimed past the player.
   */
  private aimSlip(label: string) {
    const lv = this.cpuLevel, off = new THREE.Vector3();
    const lead = lv.lead * (this.landsAfter.get(label) ?? 0.5);
    if (lead > 0) off.set(this.playerVel.x, 0, this.playerVel.z).multiplyScalar(lead).clampLength(0, LEAD_MAX);
    if (lv.aimError > 0) {
      const a = Math.random() * Math.PI * 2, r = lv.aimError * Math.sqrt(Math.random());
      off.x += Math.cos(a) * r;
      off.z += Math.sin(a) * r;
    }
    return off;
  }

  /**
   * The opponent casts slot `i` from `at` at the player (`aim`: a network duel's aim point or a summon's spot, else the
   * player's feet). `unit`: a unit of the hero's it shoots at instead (one in the way). The hero's units inside an area
   * (or next in a chain) are targets too; the zones decide at impact who is hit.
   */
  private castSpell(i: number, foe: Enemy, at: THREE.Vector3, me: THREE.Vector3, spec: TargetingSpec, aim?: THREE.Vector3, id = 0, unit?: Enemy, yaw?: number, netMods?: CastMods, netCast?: { bend?: number; sentFrom?: THREE.Vector3 }) {
    const arena = this.host.arena;
    const spell = this.opponentKit.spells[i];
    // A recast that only acts (`recast.replay: false`): the trait's rules run (its `recastAct` moves the hero), nothing plays.
    if (!this.net && this.oppRt?.canRecast(i) && this.oppRt.recastOf(i)?.replay === false) {
      this.oppRt.cast(i, spell.cooldown, 1, arena.statusOf(foe)?.dealtMul ?? 1, spell.debuff);
      this.rooted = Math.max(this.rooted, this.holdFloor);
      this.holdFloor = 0;
      this.stats.opponentCasts++;
      return;
    }
    const player = arena.caster;
    const focus = unit ? unit.group.position : me;
    const inside = (p: THREE.Vector3, r: number) => flat(p, me) <= r;
    const minions = arena.summons.alive('hero');
    let point: THREE.Vector3, targets: Enemy[] = [];
    // Blind: the aim point is rolled off the player now, so the telegraph is drawn at the offset spot (self spells aren't aimed).
    const miss = spec.mode !== 'self' && arena.statusOf(foe)?.blind ? arena.blindOffset() : null;
    if (spec.mode === 'self') {
      point = at.clone();
      if (inside(at, spec.radius ?? 5)) targets = [player];
      for (const u of minions) if (flat(u.pos, at) <= (spec.radius ?? 5)) targets.push(u.figure);
    } else {
      // An area spell picks the spot that also catches the most of the hero's units while still covering the hero.
      point = (aim ?? (spell.escape ? fleeAim(at, focus, spell.range) : spell.dash ? dashAim(at, focus, spell.range)
        : spec.mode === 'ground' && !unit ? bestSpot(me, spec.radius ?? 5, minions.map((u) => u.pos)) : focus)).clone();
      if (miss) point.add(miss);
      // The CPU level's lead and aim error on its own ground cast at the hero (Normal: neither). Targeted spells home.
      if (!this.net && !aim && !unit && !spell.dash && spec.mode === 'ground') point.add(this.aimSlip(spell.label));
      targets = [unit ?? player];
      const extra = minions.filter((u) => u.figure !== unit);
      if (spec.mode === 'ground') for (const u of extra) if (flat(u.pos, point) <= (spec.radius ?? 5)) targets.push(u.figure);
      if (spec.mode === 'enemies') {
        for (const u of extra.sort((a, b) => flat(a.pos, focus) - flat(b.pos, focus))) {
          if (targets.length < (spec.maxTargets ?? 5) && flat(u.pos, focus) <= 8) targets.push(u.figure);
        }
      }
    }
    // The AI's cast breaks walls here; a network cast does it in `peerCast` with the sender's own numbers.
    if (!this.net) this.blastWalls(at, point, spec, spell, i);
    this.face(foe, focus);
    // A network cast faces where the other player's hero faced (spells fired straight ahead go that way).
    if (yaw !== undefined && spec.mode === 'self') foe.group.rotation.y = yaw;
    // The AI's cast runs the opponent's trait rules here (power, cooldown, spending); a network cast brings its mods.
    let cooldown = spell.cooldown, mods = netMods ?? NO_MODS;
    if (!netMods && this.oppRt) {
      const r = this.oppRt.cast(i, spell.cooldown, 1, arena.statusOf(foe)?.dealtMul ?? 1, spell.debuff);
      mods = r.mods;
      cooldown = r.cooldown;
      if (this.heroRt) this.heroRt.trait?.enemyCast?.(this.heroRt, i);
      if (spell.buff) arena.applyBuff(foe, spell.buff.kind, spell.buff.amount, spell.buff.seconds);
    }
    // An arc aim: the AI bends it round cover when the straight line is blocked; a network cast brings the sender's bend.
    const bend = netCast ? netCast.bend ?? 0 : spell.aim === 'arc' && spec.mode !== 'self' ? this.aiBend(at, point) : 0;
    const record: EnemyCast = { id, round: this.round, zones: [], aimed: point.clone(), dodgedShown: false, slot: i, mods, seq: ++this.oppCastSeq };
    const ctx = arena.contextFor({
      caster: foe,
      from: at,
      point,
      targets,
      enemy: player,
      // A spell cast straight ahead goes the way its caster faces: a network cast brings the sender's facing, and the computer's
      // opponent faces its target (it used to fire such spells due north wherever the hero stood: Cantor's chord, Auriel's First Light).
      aim: spec.mode !== 'self' ? undefined : this.net ? yaw : foe.group.rotation.y,
      sentFrom: netCast?.sentFrom,
      bend,
      targetPos: targets.map((t) => {
        const p = t === player ? me.clone() : t.group.position.clone();
        return miss && spec.mode !== 'ground' ? p.add(miss) : p;
      }),
      hit: (target, opts) => (target === player ? this.hitPlayer(record, opts) : this.hitUnit(record, target, opts)),
    });
    // A network duel: the other player's own client moves its hero (dashes come in as moves) and reports its heals and
    // shields, so those are off here. Its bolts and units are played here, where they hit this side's hero.
    if (this.net) {
      ctx.shieldSelf = ctx.healSelf = ctx.moveCaster = undefined;
    }
    record.zones = this.host.castAs(spell.label, ctx);
    this.zones.set(record.zones);
    this.zoneClock = 0;
    const impact = record.zones.length ? Math.max(...record.zones.map((z) => z.impact)) : 0.5;
    this.landsAfter.set(spell.label, impact);
    // A trait's hold (Isolde's ice block) is a floor under the spell's own root.
    this.rooted = Math.max(Math.min(impact, 2.5), this.holdFloor);
    this.holdFloor = 0;
    this.figure.cast(castStyle(spell, i, spec.mode === 'enemy', this.oppAttack.motion.melee, this.rooted), this.rooted, i === 3);
    // The CPU level's cooldown factor (Normal 1) on the AI's own casts.
    if (cooldown >= 0) this.cooldowns[i] = this.net ? cooldown : cooldown * this.cpuLevel.cooldown;
    this.stats.opponentCasts++;
  }

  /** The bend for the AI's arc shot from `at` to `point`: straight when the line is clear, else the side whose arc is. */
  private aiBend(at: THREE.Vector3, point: THREE.Vector3) {
    const arena = this.host.arena;
    const clear = (b: number) => {
      const pts = arcPoints(at, point, b, 12);
      return pts.every((p, k) => k === 0 || arena.lineOfSight(pts[k - 1], p));
    };
    if (clear(0)) return 0;
    for (const b of [ARC_BEND, -ARC_BEND]) if (clear(b)) return b;
    return 0;
  }

  /** An enemy spell's hit on the player: lands only if the player is still in its zones (or near where it aimed). */
  /**
   * The hit box of a cast: inside a drawn shape if it has any, so a player never takes a hit from outside what was shown. Only a cast
   * with no drawn shape falls back on the distance from where it aimed.
   */
  private inCastReach(c: { zones: { shape: TelegraphShape }[]; aimed: THREE.Vector3 }, p: THREE.Vector3, pad = 0) {
    if (c.zones.length) return c.zones.some((z) => insideTelegraph(pad > 0 ? grownShape(z.shape, pad) : z.shape, p.x, p.z));
    return flat(p, c.aimed) <= DODGE_RADIUS + pad;
  }

  private hitPlayer(c: EnemyCast, opts: HitOptions = {}) {
    if (this.over || c.round !== this.round || !this.on) return;
    const arena = this.host.arena;
    const me = arena.caster.group.position;
    // A skillshot already touched the hero: that was the dodge check, so the zones do not decide.
    if (!opts.projectile && !this.inCastReach(c, me)) {
      if (!c.dodgedShown) {
        c.dodgedShown = true;
        this.stats.playerDodges++;
        arena.say('DODGED', '#7dffb0', me, 1.2);
        this.net?.dodged(c.id);
      }
      return;
    }
    this.damagePlayer(this.resolve('opponent', arena.caster, opts, c.mods ?? NO_MODS, 'spell', c.slot, c.seq), c.id);
  }

  /**
   * Damage, knockback, pull and status on the player hero, after the dodge check (`hitPlayer`), or at once for the
   * opponent's basic attack (it homes in: no dodge). `castId` tells the server which cast it was (network duel).
   */
  private damagePlayer(opts: HitOptions, castId?: number) {
    if (this.over || !this.on) return;
    const arena = this.host.arena;
    const me = arena.caster.group.position;
    if (opts.blocked !== undefined) {
      // A passive swallowed it (ice block, mantle): the other screen shows it as soaked.
      if (castId !== undefined) this.net?.tookHit(castId, 0, opts.color, opts.blocked, true);
      return;
    }
    const dmg = Math.round(opts.damage ?? 15);
    // A shield on the hero takes the damage first; the server is told what got past it.
    const left = arena.absorb(arena.caster, dmg);
    if (castId !== undefined) this.net?.tookHit(castId, left, opts.color, dmg - left);
    this.playerHp = Math.max(0, this.playerHp - left);
    // Phoenix Heart and Stubborn: once a fight each, a killing hit leaves 40 % HP, or 1.
    const saved = this.playerHp <= 0 ? this.boss?.upgrades?.trySave() ?? 0 : 0;
    if (saved > 0) {
      this.playerHp = Math.round(this.playerMax * saved);
      arena.say('PHOENIX HEART', '#ffcf4a', me, 1.4);
    } else if (saved < 0) {
      this.playerHp = 1;
      arena.say('STUBBORN', '#ffe27a', me, 1.3);
    }
    this.host.heroMode.figureHit(left, opts.color, opts.from ?? this.foe?.group.position);
    if (left > 0) {
      arena.say(String(left), opts.color ?? '#ff6a6a', me, left >= 40 ? 1.5 : 1);
      this.flash.style.opacity = String(Math.min(1, 0.35 + left / 120));
    }
    const knock = Math.min(opts.knock ?? 0, 8);
    if (knock > 0) {
      const from = opts.from ?? this.foe?.group.position ?? me;
      const away = new THREE.Vector3(me.x - from.x, 0, me.z - from.z);
      if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
      this.shove(() => {
        me.addScaledVector(away.normalize(), knock * 0.18);
        arena.keepInside(me);
      });
    }
    if (opts.pull && opts.pull > 0) {
      const from = opts.from ?? this.foe?.group.position ?? me;
      const to = new THREE.Vector3(from.x - me.x, 0, from.z - me.z);
      const m = Math.min(opts.pull, 4, Math.max(0, to.length() - 1));
      this.shove(() => {
        if (m > 0) me.addScaledVector(to.normalize(), m);
        arena.keepInside(me);
      });
    }
    if (opts.debuff) this.host.arena.applyBuff(arena.caster, opts.debuff.kind, opts.debuff.amount, opts.debuff.seconds);
    // A status on this hero is enforced here; the other screen only shows it.
    if (opts.status && this.host.heroMode.applyStatus(opts.status.kind, opts.status.seconds, opts.color)) {
      this.net?.status(opts.status.kind, opts.status.seconds, opts.color);
    }
  }

  /**
   * An enemy spell's hit on one of the hero's summoned units: lands inside the cast's zones or near where it aimed
   * (units do not dodge), or at once for a bolt or a unit's own attack (`opts.projectile`: the touch was the check).
   */
  private hitUnit(c: EnemyCast, target: Enemy, opts: HitOptions = {}) {
    if (this.over || c.round !== this.round || !this.on) return;
    const p = target.group.position;
    if (opts.projectile || this.inCastReach(c, p)) {
      this.host.arena.hit(target, this.resolve('opponent', target, opts, c.mods ?? NO_MODS, 'spell', c.slot, c.seq));
    }
  }

  /** What a hazard can hit on this screen: this side's hero, the units here and, offline, the opponent. */
  private hazardTargets(): HazardTarget[] {
    const arena = this.host.arena;
    const list: HazardTarget[] = [{ key: arena.caster, pos: arena.caster.group.position }];
    if (this.foe && !this.net && !this.boss) list.push({ key: this.foe, pos: this.foe.group.position });
    for (const side of ['hero', 'opponent'] as const) {
      for (const u of arena.summons.alive(side)) list.push({ key: u.figure, pos: u.pos });
    }
    return list;
  }

  /** A hazard's hit: not a spell, so no trait hooks and no credit. This side's hero reports its own damage online. */
  private hazardHit(target: HazardTarget, hit: HazardHit) {
    const arena = this.host.arena, isHero = target.key === arena.caster;
    const max = isHero ? this.hitBase : target.key === this.foe ? this.foeMax : HP;
    const damage = Math.min(HAZARD_MAX, hit.damage + (hit.share ?? 0) * max);
    if (damage <= 0) {
      // Only slows (a water channel): no number, no flinch.
      if (!hit.slow) return;
      if (!isHero) arena.applyStatus(target.key as Enemy, 'slow', hit.slow, hit.color);
      else if (this.host.heroMode.applyStatus('slow', hit.slow, hit.color)) this.net?.status('slow', hit.slow, hit.color);
      return;
    }
    const opts: HitOptions = { damage, knock: 0, color: hit.color, from: hit.from };
    if (hit.slow) opts.status = { kind: 'slow', seconds: hit.slow };
    if (isHero) {
      // Online the hub would drop a second hazard this soon, and the two screens would count different HP.
      if (this.net && this.time - this.hazardSentAt < HAZARD_SEND_GAP) return;
      const before = this.playerHp, flashed = Number(this.flash.style.opacity || 0);
      this.damagePlayer(opts);
      // A zone hits again and again: the red flash stays faint, or the whole screen would strobe.
      if (hit.share) this.flash.style.opacity = String(Math.max(flashed, ZONE_FLASH));
      const took = before - this.playerHp;
      if (took > 0) {
        this.hazardSentAt = this.time;
        this.net?.hazard(took, hit.color);
      }
      return;
    }
    this.hitBypass = true;
    arena.hit(target.key as Enemy, opts);
    this.hitBypass = false;
  }

  /** The nearest alive unit of `side` within `UNIT_BLOCK` of `from` and closer than the hero at `other`, if any. */
  private blocker(side: SummonSide, from: THREE.Vector3, other: THREE.Vector3) {
    const limit = Math.min(UNIT_BLOCK, flat(from, other));
    let best: ReturnType<Arena['summons']['alive']>[number] | null = null, bd = limit;
    for (const u of this.host.arena.summons.alive(side)) {
      const d = flat(u.pos, from);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  /** Where a summon spell puts its units: 3 m from `from` toward `toward`. */
  private summonSpot(from: THREE.Vector3, toward: THREE.Vector3) {
    const d = new THREE.Vector3(toward.x - from.x, 0, toward.z - from.z);
    d.divideScalar(Math.max(d.length(), 1e-3));
    return this.host.arena.keepInside(from.clone().setY(0).addScaledVector(d, 3), 0.8);
  }

  /** A heal on the player hero (`arena.casterHeal`): HP up to the cap; returns what was added. */
  private healPlayer(amount: number) {
    // Blood Pact: nothing heals this hero in the raid.
    if (this.boss && !(this.boss.upgrades?.healable ?? true)) return 0;
    const healed = Math.max(0, Math.min(amount, this.playerMax - this.playerHp));
    this.playerHp += healed;
    // Online the server counts HP: heals are sent in batches (`flushHeal`, twice a second), within its caps.
    if (healed > 0 && this.net) this.pendingHeal += healed;
    return healed;
  }

  /** The player just cast: remember its zones and where it aimed (the opponent's position at the cast). */
  // --- cover a stage changes ----------------------------------------------------------------------------------

  /** A stage takes arena cover `i` away: it is out of the list and takes no more hits. */
  private removeCover(i: number) {
    const arena = this.host.arena, o = this.currentArena?.obstacles[i];
    if (!o) return;
    if (this.wallHp) this.wallHp[i] = 0;
    this.wallHits = this.wallHits.filter((h) => h.i !== i);
    if (!arena.obstacles?.includes(o)) return;
    if (o.kind === 'wall') this.arenaScene?.wallState?.(i, 'broken');
    arena.obstacles = arena.obstacles.filter((x) => x !== o);
  }

  /** The ring closes on `ringTo` at walking pace or so, and takes along whoever is beyond it: each screen its own hero, and the units here. */
  private shrinkRing(dt: number) {
    const arena = this.host.arena, b = arena.bounds;
    if (!b || b.r <= this.ringTo) return;
    b.r = Math.max(this.ringTo, b.r - RING_SHRINK * dt);
    arena.keepInside(arena.caster.group.position);
    if (!this.net && this.foe) arena.moveFoe(this.foe, new THREE.Vector3(), true);
    for (const side of ['hero', 'opponent'] as const) {
      for (const u of arena.summons.alive(side)) arena.keepInside(u.pos);
    }
  }

  /** A stage raises new cover: whoever stands there is pushed out, each screen its own hero. */
  private addCover(cover: Obstacle[]) {
    const arena = this.host.arena;
    arena.obstacles = [...(arena.obstacles ?? []), ...cover];
    arena.keepInside(arena.caster.group.position);
    if (!this.net && this.foe) arena.moveFoe(this.foe, new THREE.Vector3(), true);
  }

  // --- breakable walls ---------------------------------------------------------------------------------------

  /** Stands every wall of a breakable arena up again (each round). The obstacle list is a copy: broken walls leave it. */
  private resetWalls(def: ArenaDef) {
    this.wallHits = [];
    this.wallHp = def.breakable ? def.obstacles.map((o) => (o.kind === 'wall' && !o.fixed ? WALL_HP : -1)) : null;
    if (!this.wallHp) return;
    this.host.arena.obstacles = def.obstacles.slice();
    def.obstacles.forEach((o, i) => { if (o.kind === 'wall') this.arenaScene?.wallState?.(i, 'whole'); });
  }

  /** This side's hero cast slot `slot` at `target`: the walls it hits take damage. */
  private playerBlast(slot: number, target: Target) {
    const spell = this.host.heroMode.currentKit.spells[slot];
    const spec = spell && this.host.targeting(spell.label);
    if (!spec) return;
    const from = this.host.arena.caster.group.position.clone().setY(0);
    const point = spec.mode === 'self' ? from.clone() : ('enemy' in target ? target.enemy.group.position : target.point).clone().setY(0);
    this.blastWalls(from, point, spec, spell, slot);
  }

  /**
   * A spell cast from `from` at `point` hits the walls inside its area (ground and self spells: the wall within the
   * radius) or across its path (line spells). Single-target spells need a clear line, so they never hit a wall. Both
   * players' screens run this with the same numbers (the network cast message), so they break the same walls.
   */
  private blastWalls(from: THREE.Vector3, point: THREE.Vector3, spec: TargetingSpec, spell: HeroSpell, slot: number) {
    const hp = this.wallHp, def = this.currentArena;
    // A bank shot needs its walls, so it leaves them standing.
    if (!hp || !def || spell.bank) return;
    const dmg = slot === 3 ? 2 : 1;
    const line = spell.aim === 'line';
    if (!line && spec.mode !== 'ground' && spec.mode !== 'self') return;
    const r = spec.radius ?? 5;
    // A bolt flies its whole range along the aim and stops at the first of the arena's own cover still standing (not a wall a spell raised).
    const aim = Math.hypot(point.x - from.x, point.z - from.z) || 1;
    const bolt = line && stopsAtCover(spell) ? new THREE.Vector3(from.x + ((point.x - from.x) / aim) * spell.range, 0, from.z + ((point.z - from.z) / aim) * spell.range) : null;
    const standing = this.host.arena.obstacles;
    const hit = bolt && sweepHit(from, bolt, 0, def.obstacles.filter((o) => standing?.includes(o)));
    const struck = hit?.obstacle;
    def.obstacles.forEach((o, i) => {
      if (hp[i] <= 0) return;
      const near = bolt ? o === struck : line ? pathDist(from, point, o) <= o.r + WALL_LINE_PAD : capsuleDist(point.x, point.z, o) <= o.r + r * WALL_BLAST_REACH;
      if (!near) return;
      hp[i] = Math.max(0, hp[i] - dmg);
      // The bolt's strip ends at this wall, so the bolt has to find it standing.
      if (hit) this.wallHits.push({ at: this.time + WALL_BOLT_WIND + (hit.t * spell.range) / WALL_BOLT_SPEED, i, o });
      else this.wallHit(i, o);
    });
  }

  /** A hit lands on wall `i`: it cracks, or falls when it has no hits left and no bolt is still on its way to it. */
  private wallHit(i: number, o: ArenaDef['obstacles'][number]) {
    const arena = this.host.arena;
    if (!arena.obstacles?.includes(o)) return;
    if ((this.wallHp?.[i] ?? 0) > 0 || this.wallHits.some((h) => h.i === i)) {
      this.arenaScene?.wallState?.(i, 'cracked');
      return;
    }
    this.arenaScene?.wallState?.(i, 'broken');
    arena.obstacles = arena.obstacles.filter((x) => x !== o);
  }

  private landWallHits() {
    const due = this.wallHits.filter((h) => h.at <= this.time);
    if (!due.length) return;
    this.wallHits = this.wallHits.filter((h) => h.at > this.time);
    for (const h of due) this.wallHit(h.i, h.o);
  }

  private recordPlayerCast() {
    if (!this.foe) return;
    // `id` is the arena's cast number: the hits of that cast carry it to `opponentHit`.
    this.playerCastsRecent.push({ id: this.host.arena.castSeq, round: this.round, zones: this.host.playerZones(), aimed: this.foe.group.position.clone(), dodgedShown: false, t: this.time });
    this.playerCastsRecent = this.playerCastsRecent.filter((c) => this.time - c.t < 4.5);
  }

  /**
   * The player's hit on the opponent lands only if the opponent is still inside THAT cast's zones (or near where it
   * aimed), as `hitPlayer` does for the opponent's casts. `cast` is the arena's cast number from the hit's context.
   */
  private opponentHit(target: Enemy, opts: HitOptions, cast?: number) {
    if (!this.on || opts.projectile || opts.attack) return true;
    // The opponent's summoned units are checked against the zones like the opponent is (the hero's own units are not).
    if (target !== this.foe && this.host.arena.summons.unitOf(target)?.side !== 'opponent') return true;
    const p = target.group.position;
    const c = this.playerCastsRecent.find((r) => r.id === cast && this.time - r.t < 4.5);
    if (!c) return true;
    // A boss is wide: a zone that touches any of it counts.
    const lands = this.inCastReach(c, p, this.boss && target === this.foe ? target.body?.radius ?? 0 : 0);
    if (!lands && target === this.foe) {
      if (!c.dodgedShown) {
        c.dodgedShown = true;
        this.stats.opponentDodges++;
        this.host.arena.say('DODGED', '#7dffb0', p, 1.2);
      }
    }
    return lands;
  }

  /** What the bars over a hero's head show now. Null once it has fallen. */
  private plateFor(kit: HeroKit, hp: number, max: number, who: Enemy, rt: TraitRuntime | null | undefined, remote: boolean, mine: boolean) {
    if (hp <= 0) return null;
    const m = rt?.meterNow(remote);
    return {
      hp, max, mine,
      shield: this.host.arena.shieldOf(who)?.amount ?? 0,
      chunks: kit.hpChunks ?? 0,
      meter: m ? { name: m.name, value: m.value, max: m.max, color: m.color ?? kit.accent } : null,
    };
  }

  /** Eases a hero's figure to `scale` (`Trait.enemyScale`); its hit size follows, so a swollen hero is easier to hit. */
  private sizeFigure(who: Enemy | null | undefined, scale: number, kit: HeroKit, dt: number) {
    if (!who) return;
    const now = who.group.scale.x;
    if (now === scale) return;
    const k = Math.abs(scale - now) < 0.004 ? scale : now + (scale - now) * Math.min(1, dt * 8);
    who.group.scale.setScalar(k);
    const base = HERO_BODIES[kit.name];
    who.body = base ? { radius: base.radius * k, height: base.height * k } : null;
  }

  private face(foe: Enemy, me: THREE.Vector3) {
    const p = foe.group.position;
    foe.group.rotation.y = Math.atan2(me.x - p.x, me.z - p.z);
  }

  private finish(result: 'win' | 'lose') {
    this.result = {
      player: this.host.heroMode.currentKit.name, opponent: this.opponentKit.name,
      winner: result === 'win' ? this.host.heroMode.currentKit.name : this.opponentKit.name,
      seconds: +this.time.toFixed(1), playerHp: this.playerHp, opponentHp: this.foe ? this.host.arena.hpOf(this.foe) : 0,
      ...this.stats,
      units: structuredClone(this.host.arena.summons.stats),
      boss: this.boss ? { killedBy: this.boss.killedBy, hits: { ...this.boss.stats.hits }, kneels: this.boss.stats.kneels, phase: this.boss.stats.phases } : undefined,
    };
    this.over = result;
    this.overT = 0;
    this.host.heroMode.locked = true;
    this.zones.set([]);
    const me = this.host.heroMode.currentKit, them = this.opponentKit;
    const winner = result === 'win' ? me : them, loser = result === 'win' ? them : me;
    this.onFinish?.(result);
    if (this.boss) {
      const time = `${Math.floor(this.time / 60)}:${String(Math.floor(this.time % 60)).padStart(2, '0')}`;
      const left = this.foe ? Math.ceil((this.host.arena.hpOf(this.foe) / this.foeMax) * 100) : 0;
      const told = this.bossCard ? this.bossCard(result, this.time) : undefined;
      this.renderHud();
      // A boss beaten with more to come: no card, the run goes on by itself.
      if (told === null) {
        this.showBanner(`${them.name} falls`, 2, '30px');
        return;
      }
      this.cardTitle.textContent = told?.title ?? (result === 'win' ? 'RAID CLEARED' : 'DEFEATED');
      this.cardTitle.style.color = result === 'win' ? '#ffd27a' : '#ff6a6a';
      this.cardText.textContent = told?.text ?? (result === 'win' ? `${them.name} falls after ${time}.` : `${me.name} falls after ${time}. ${them.name} has ${left}% left.`);
      this.rematchButton.textContent = told?.again ?? 'Try again';
      // Without a next step (a raid for two that has ended) there is only Leave.
      this.rematchButton.style.display = told ? (told.again ? '' : 'none') : this.boss.link.solo ? '' : 'none';
      this.leaveButton.textContent = 'Leave';
      this.card.style.display = 'flex';
      return;
    }
    if (this.mode === 'run') {
      this.cardTitle.textContent = `${winner.name.toUpperCase()} WINS`;
      this.cardTitle.style.color = winner.accent;
      this.cardText.textContent = `${loser.name} falls after ${this.time.toFixed(1)} s · ${winner.name} keeps ${Math.ceil(result === 'win' ? this.playerHp : this.foe ? this.host.arena.hpOf(this.foe) : 0)} HP.`;
      this.card.style.display = 'flex';
      this.renderHud();
      return;
    }
    this.cardTitle.textContent = result === 'win' ? 'VICTORY' : 'DEFEAT';
    this.cardTitle.style.color = result === 'win' ? '#ffd27a' : '#ff6a6a';
    const lv = this.cpuLevel.name;
    this.cardText.textContent = result === 'win' ? `${them.name} (${lv}) falls.` : `${me.name} falls to ${them.name} (${lv}).`;
    this.card.style.display = 'flex';
    this.renderHud();
  }

  // --- arena and HUD ---------------------------------------------------------------------------------------

  /** Swaps in an arena: its meshes (the old ones are freed), its sky and lights. The same arena is kept as is. */
  private useArena(def: ArenaDef) {
    if (this.currentArena !== def || !this.arenaScene) {
      if (this.arenaScene) {
        this.group.remove(this.arenaScene.group);
        this.arenaScene.dispose?.();
      }
      this.arenaScene = def.build();
      this.group.add(this.arenaScene.group);
      this.currentArena = def;
    }
    this.host.setStage?.(def.stage);
    this.host.arena.showGround(!def.hideGround);
  }

  private buildHud() {
    const root = document.createElement('div');
    // A phone: smaller portraits and bars that share the screen width (two 220 px bars don't fit 375 px).
    const small = TOUCH || innerWidth < 760;
    root.style.cssText =
      `position:fixed;left:50%;top:calc(${small ? 6 : 14}px + env(safe-area-inset-top, 0px));transform:translateX(-50%);z-index:6;` +
      `display:none;align-items:center;gap:${small ? 8 : 18}px;padding:${small ? '5px 8px' : '8px 14px'};` +
      'border-radius:12px;background:rgba(8,6,10,0.82);border:1px solid #3a3242;max-width:calc(100vw - 12px);box-sizing:border-box;' +
      'font:600 12px ui-sans-serif,system-ui;color:#e9dcc6;user-select:none;';
    const side = (right: boolean) => {
      const box = document.createElement('div');
      box.style.cssText = `display:flex;align-items:center;gap:${small ? 6 : 10}px;flex-direction:${right ? 'row-reverse' : 'row'};min-width:0;`;
      const portrait = document.createElement('canvas');
      portrait.width = portrait.height = 64;
      portrait.style.cssText = `width:${small ? 30 : 42}px;height:${small ? 30 : 42}px;border-radius:50%;border:2px solid #8a7a52;flex:none;`;
      const col = document.createElement('div');
      col.style.cssText = `display:flex;flex-direction:column;gap:${small ? 3 : 4}px;align-items:${right ? 'flex-end' : 'flex-start'};min-width:0;`;
      const name = document.createElement('div');
      name.style.cssText = `font:700 ${small ? 11 : 13}px ui-serif,Georgia,serif;max-width:${small ? '28vw' : 'none'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
      const barBg = document.createElement('div');
      barBg.style.cssText = `position:relative;width:${small ? 'min(220px, 28vw)' : '220px'};height:12px;border-radius:6px;background:#2a1a1e;overflow:hidden;`;
      const fill = document.createElement('div');
      fill.style.cssText = `position:absolute;top:0;bottom:0;${right ? 'right' : 'left'}:0;width:100%;border-radius:6px;transition:width 0.15s;`;
      const shield = document.createElement('div');
      shield.style.cssText = 'position:absolute;top:0;bottom:0;display:none;border-radius:6px;opacity:0.85;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.7);';
      const chunks = document.createElement('div');
      chunks.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      const text = document.createElement('div');
      text.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 10px ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 2px #000;';
      barBg.append(fill, shield, chunks, text);
      // Under the bar: the resource, buffs / debuffs and the stacks the other hero keeps on this one.
      const extra = document.createElement('div');
      extra.style.cssText = `display:flex;gap:4px;align-items:center;min-height:14px;flex-direction:${right ? 'row-reverse' : 'row'};font:600 10px ui-sans-serif,system-ui;`;
      col.append(name, barBg, extra);
      box.append(portrait, col);
      this.bars.push({ fill, shield, chunks, text, name, portrait, extra });
      this.hudSides.push(box);
      return box;
    };
    const vs = document.createElement('div');
    vs.textContent = 'VS';
    vs.style.cssText = `font:800 ${small ? 12 : 16}px ui-serif,Georgia,serif;color:#c9a24a;letter-spacing:2px;`;
    this.hudVs = vs;
    this.hudTop = root.style.top;
    root.append(side(false), vs, side(true));
    document.body.appendChild(root);
    return root;
  }

  private renderHud() {
    const me = this.host.heroMode.currentKit, them = this.opponentKit;
    const foeHp = this.foe ? this.host.arena.hpOf(this.foe) : 0;
    const arena = this.host.arena;
    const partner = this.partner;
    const rows: [HeroKit, number, number, ReturnType<Arena['shieldOf']>][] = [
      [me, this.playerHp, this.playerMax, arena.shieldOf(arena.caster)],
      partner ? [partner.kit, partner.hp, partner.max, null] : [them, foeHp, this.foeMax, this.foe ? arena.shieldOf(this.foe) : null],
    ];
    rows.forEach(([kit, hp, max, shield], i) => {
      const b = this.bars[i];
      // Offline the opponent shows its CPU level (in a run duel the player's hero is an AI too).
      const label = this.net || partner ? `${kit.name} · ${this.names[i]}` : i === 1 ? `${kit.name} · ${this.cpuLevel.name}` : this.mode === 'run' ? `${kit.name} · AI` : `${kit.name} · you`;
      if (b.name.textContent !== label) {
        b.name.textContent = label;
        const g = b.portrait.getContext('2d')!;
        g.clearRect(0, 0, 64, 64);
        kit.portrait(g, 64);
        b.fill.style.background = `linear-gradient(180deg, ${kit.accent}, color-mix(in srgb, ${kit.accent} 55%, #000))`;
        // A bar cut into lives (Sir Whiskers).
        const n = kit.hpChunks ?? 0;
        b.chunks.style.background = n > 1 ? `repeating-linear-gradient(90deg, transparent 0 calc(${100 / n}% - 2px), rgba(0,0,0,0.75) calc(${100 / n}% - 2px) ${100 / n}%)` : 'none';
      }
      b.fill.style.width = `${Math.max(0, (hp / max) * 100)}%`;
      // A shield is a pale segment after the HP (a strong one is pushed back inside the bar).
      const sh = shield ? Math.min(1, shield.amount / max) : 0;
      b.shield.style.display = sh > 0 ? '' : 'none';
      if (sh > 0) {
        b.shield.style[i === 1 ? 'right' : 'left'] = `${Math.min(Math.max(0, hp / max), 1 - sh) * 100}%`;
        b.shield.style.width = `${sh * 100}%`;
        b.shield.style.background = `color-mix(in srgb, ${shield!.color || '#ffffff'} 30%, #eef6ff)`;
      }
      b.text.textContent = `${Math.ceil(hp)} / ${max}` + (shield ? `  +${Math.ceil(shield.amount)}` : '');
      // The partner's own meters and buffs stay on its own screen: this one has only its HP.
      if (i === 1 && partner) {
        if (b.extra.dataset.html) { b.extra.dataset.html = ''; b.extra.innerHTML = ''; }
        return;
      }
      const rt = i === 0 ? this.heroRt : this.oppRt, other = i === 0 ? this.oppRt : this.heroRt;
      const fig = i === 0 ? arena.caster : this.foe;
      const parts: string[] = [];
      // The same meter as over the head: its name, a bar, and the count.
      const meter = rt?.meterNow(i === 1 && !!this.net);
      if (meter) {
        const mc = meter.color ?? kit.accent;
        parts.push(`<div title="${meter.name}" style="position:relative;flex:0 0 44px;height:7px;border-radius:4px;background:#0009;overflow:hidden">` +
          `<div style="position:absolute;inset:0 auto 0 0;width:${(100 * meter.value) / meter.max}%;background:${mc}"></div></div>` +
          `<span style="color:${mc};white-space:nowrap">${meter.name} ${Math.round(meter.value)}/${meter.max}</span>`);
      }
      const res = rt?.trait?.resource;
      if (res && rt) {
        parts.push(`<div title="${res.name}" style="position:relative;width:60px;height:7px;border-radius:4px;background:#0009;overflow:hidden">` +
          `<div style="position:absolute;inset:0 auto 0 0;width:${(100 * rt.res) / res.max}%;background:${res.color}"></div></div>` +
          `<span style="color:${res.color}">${res.name} ${Math.round(rt.res)}</span>`);
      }
      for (const bf of (fig && arena.statusOf(fig)?.activeBuffs()) || []) {
        const bad = DEBUFFS.includes(bf.kind);
        parts.push(`<span title="${bf.kind} ${Math.round(bf.amount * 100)}%" style="padding:0 3px;border-radius:3px;border:1px solid ${BUFF_COLOR[bf.kind]};` +
          `color:${BUFF_COLOR[bf.kind]};background:${bad ? '#3a0a14' : '#0a2a1e'}">${BUFF_GLYPH[bf.kind]} ${Math.ceil(bf.left)}</span>`);
      }
      for (const st of other?.allStacks() ?? []) parts.push(`<span style="color:#ffd7a0">${st.name} ×${st.n}</span>`);
      const html = parts.join('');
      if (b.extra.dataset.html !== html) { b.extra.dataset.html = html; b.extra.innerHTML = html; }
    });
  }
}

/** Where a dash from `from` toward `to` should end: about 1.8 m short of the target, within the spell's range. */
/** Where an AI's getaway (`HeroSpell.escape`) goes: straight away from `to`, as far as the spell reaches. */
function fleeAim(from: THREE.Vector3, to: THREE.Vector3, range: number) {
  const dir = new THREE.Vector3(from.x - to.x, 0, from.z - to.z).normalize();
  return from.clone().setY(0).addScaledVector(dir, range);
}

/** Where a hero's bars sit over its head, clear of the tallest of them. */
function plateHeight(who: Enemy | null | undefined) {
  return Math.max(2.75, (who?.body?.height ?? 0) + 0.2);
}

function dashAim(from: THREE.Vector3, to: THREE.Vector3, range: number) {
  const d = Math.max(0, flat(from, to) - 1.8);
  const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
  return from.clone().setY(0).addScaledVector(dir, Math.min(d, range));
}

/**
 * Where to aim an area of radius `r` at a hero standing at `hero`: the hero's own spot, or a spot between the hero and
 * one of the `units` that still covers the hero and catches more of them.
 */
function bestSpot(hero: THREE.Vector3, r: number, units: THREE.Vector3[]) {
  const count = (p: THREE.Vector3) => units.filter((u) => flat(u, p) <= r).length;
  let best = hero.clone().setY(0), bestN = count(best);
  if (r < 1.5) return best;
  for (const u of units) {
    for (const c of [hero.clone().lerp(u, 0.5), u.clone()]) {
      c.y = 0;
      if (flat(c, hero) > r - 1) continue;
      const n = count(c);
      if (n > bestN) { best = c.clone(); bestN = n; }
    }
  }
  return best;
}

/** A zone grown by `pad` m on every side (a cone only along its radius): the zone dodge keeps that margin. */
function grownShape(s: TelegraphShape, pad: number): TelegraphShape {
  switch (s.kind) {
    case 'circle': return { ...s, radius: s.radius + pad };
    case 'ring': return { ...s, inner: Math.max(0, s.inner - pad), outer: s.outer + pad };
    case 'cone': return { ...s, radius: s.radius + pad };
    case 'line': return { ...s, width: s.width + 2 * pad };
  }
}

/** Ground-plane distance from (x, z) to an obstacle's segment. */
function capsuleDist(x: number, z: number, o: ArenaDef['obstacles'][number]) {
  const dx = o.bx - o.ax, dz = o.bz - o.az, len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - o.ax) * dx + (z - o.az) * dz) / len2)) : 0;
  return Math.hypot(x - (o.ax + dx * t), z - (o.az + dz * t));
}

/** Closest ground-plane distance between the path from `a` to `b` and an obstacle's segment (sampled along the path). */
function pathDist(a: THREE.Vector3, b: THREE.Vector3, o: ArenaDef['obstacles'][number]) {
  let best = Infinity;
  for (let k = 0; k <= 32; k++) {
    const t = k / 32;
    best = Math.min(best, capsuleDist(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, o));
  }
  return best;
}

function flat(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
