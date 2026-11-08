import type * as THREE from 'three';
import type { ArenaDef } from '../arenas/types';
import type { ArenaShift } from '../arenas/shifts/base';
import type { MinionLook } from '../effects/parts/minion';
import type { TelegraphShape } from '../effects/telegraph';
import type { CastStyle } from '../heroFigure';
import type { HeroKit } from '../heroes';
import type { Obstacle } from '../obstacles';

/**
 * The Raid: a boss fight on the duel's vs-CPU path (design: pipeline/designs/duels-and-raid.md; plan and the rules below:
 * pipeline/designs/raid-build.md).
 *
 * 1. A move never reads a hero's position: only the brain does, and it puts the result in a `BossCast`.
 * 2. A move with later steps sends each step as its own cast, so a step can't drift between screens.
 * 3. Each screen decides hits on its own hero only.
 * 4. Everything both screens must agree on goes through the `RaidLink`.
 */

export type RaidSide = 0 | 1;

/** One step of a move, as the brain sends it. Plain JSON: online it goes through the hub to the other screen as it is. */
export interface BossCast {
  /** Unique in this fight. */
  id: number;
  /** The key in `BossDef.moves`. */
  move: string;
  /** Which of the move's steps this is, from 0. */
  step: number;
  /** Where it is aimed. */
  x: number;
  z: number;
  /** Where the boss stood. */
  fx: number;
  fz: number;
  /** Which way it faces (yaw). */
  dir: number;
  /** The move's own rolls: the same on both screens. */
  seed: number;
  /** The hero it aims at. */
  target: RaidSide;
  /** A tag team's boss on the rim casts it, not the one in the ring. */
  rim?: boolean;
  /** A tag: the form that steps into the ring. */
  form?: number;
  /** The brain saw something both screens need to know (Charge hit cover). */
  flag?: boolean;
  /** Only one hero was up when the move began: a move made for two plays its alone version. */
  alone?: boolean;
}

/** What a hero's hit lays on the boss that the other screen needs too: the brain walks it, and each screen takes its hits and deals its own. */
export type BossDebuff = 'slow' | 'weaken' | 'vulnerable';

/** Pale orange: leave. Gold: stand here. */
export type ZoneKind = 'leave' | 'stand';

/** One zone of a played move. Times are seconds after its cast. */
export interface Threat {
  shape: TelegraphShape;
  kind?: ZoneKind;
  /** When it lands. */
  at: number;
  /** When the zone starts to show (default at once). */
  show?: number;
  /** It stays and hurts until then (default it hits once, at `at`). */
  to?: number;
  /** While it stays, how often it hits one hero (s). */
  every?: number;
  /** What it costs, as a share of the hero's max HP. A `stand` zone: what it costs when nobody stands in it. */
  share: number;
  knock?: number;
  /** A hero with cover between it and here is safe. */
  source?: { x: number; z: number };
  /** The screen wall that saved a hero breaks. */
  breaks?: boolean;
  /** An AI notices it this long before it lands (default: its usual look ahead). */
  look?: number;
  /** A zone that moves (Walking Sun): its shape at time `t`. It is not drawn as a telegraph; the move's look draws it. */
  shapeAt?(t: number): TelegraphShape;
  /** A zone no shape can say (the Lava Wave's gap): whether (x, z) is in it at time `t`. The move's look draws it. */
  hits?(x: number, z: number, t: number): boolean;
  /** Parts of one move that report apart (Anchors). */
  part?: number;
  /** A `stand` zone whose cost is shared by the heroes in it; those outside pay nothing, unless nobody is in it. */
  split?: boolean;
  /** A zone that splits: what it costs in all, shared by the heroes in it (default `share`, which is then also what nobody in it costs). */
  soak?: number;
  /** This screen's hero stood in this zone when it landed. */
  inside?: boolean;
  /** The hub has said how many stood in it. */
  settled?: boolean;
  /** Nothing is drawn for it. */
  hidden?: boolean;
  landed?: boolean;
  lastHit?: number;
}

/**
 * A spot a hero can take, by walking onto it or by holding it. One hero gets each and the hub says who, so both screens agree.
 * What players do in a fight besides dodging is made of these (pipeline/designs/raid-noonfall.md).
 */
export interface Objective {
  /** Which one of its cast. */
  part: number;
  x: number;
  z: number;
  radius: number;
  /** Seconds a hero must stay in it, hits or not, and not casting (default: at once). */
  hold?: number;
  /** Until when it can be taken, in seconds after the cast (default: as long as the cast lasts). */
  until?: number;
  /** Whether this screen's hero may take it now. */
  can?(): boolean;
  /** Taking it ends the danger it stands in (the altar against Noon): an AI walks through that danger for it. */
  beats?: boolean;
  /** An add: it is taken when the add dies, never by standing, and the move's look reports it. */
  kill?: boolean;
  /** How far this screen's hero has held it, 0..1. */
  held?: number;
  reported?: boolean;
  done?: boolean;
}

/** What a move draws beyond its zones. */
export interface MoveLook {
  /** `t`: seconds since the cast. */
  update?(t: number, dt: number): void;
  /** A threat of this cast lands. */
  land?(th: Threat): void;
  /** A hero took one of its objectives. */
  done?(o: Objective, side: RaidSide): void;
  /** The partner hit add `part` of this cast for `amount`, on its own screen. */
  hurt?(part: number, amount: number): void;
  dispose?(): void;
}

export interface PlayedMove {
  threats: Threat[];
  objectives?: Objective[];
  /** When the script forgets this cast. */
  duration: number;
  look?: MoveLook;
}

/** What a move sees while it plays: the cover, the shared looks, and what a move may do to the room. No heroes. */
export interface PlayContext {
  camera: THREE.Camera;
  group: THREE.Group;
  sparks: { emit(x: number, y: number, z: number, n: number, speed: number, rise: number, life: number, color: THREE.ColorRepresentation, gravity?: number): void };
  glows: { flash(x: number, z: number, radius: number, color: THREE.ColorRepresentation, life?: number, peak?: number): void };
  cover(): readonly Obstacle[];
  /** How far along from a to b (0..1) a ray gets before cover stops it. */
  rayStop(ax: number, az: number, bx: number, bz: number): number;
  /** The wall a ray from a to b hits first takes one hit. */
  crackFirst(ax: number, az: number, bx: number, bz: number): void;
  /** The whole screen lights up (Noon). */
  flash(color: string, strength: number): void;
  /** The boss stands open: it takes more for `seconds`. */
  exposed(seconds: number): void;
  /** The screen's small words. */
  say(text: string, color: string, x: number, z: number): void;
  solo: boolean;
  /** How long a zone shown for `seconds` at tier 1 shows at this tier: shorter each tier, and never under 1 s. */
  shown(seconds: number): number;
  /** A tag team swaps: `form` lands at (x, z), the other goes up to the rim at (rx, rz). */
  tag(form: number, x: number, z: number, rx: number, rz: number): void;
  /** Drags this screen's hero toward (x, z), unless it is already close. */
  dragMe(x: number, z: number, meters: number): void;
  /** Where a hero stands, for a look only (Marked's circle): what counts comes in a later cast. */
  heroAt(side: RaidSide): { x: number; z: number } | null;
  /** Which hero this screen plays. */
  side: RaidSide;
  /** Says what to do, once a fight. */
  hint(text: string): void;
  /** A mechanic was done right: the brain's screen asks, and the hub or the local link pays it once. */
  reward(key: string, id: number): void;
  /** What is still to land of this cast is off, and it ends soon. */
  cancel(id: number): void;
  /** This screen's hero carries something heavy, and walks slower. */
  heavy(on: boolean): void;
  /** A fallen stone stays as cover. */
  addStone(x: number, z: number, radius: number, seconds: number): Obstacle;
  /** The fallen stone that cover stops a ray from a to b at, if that is what stops it. */
  firstStone(ax: number, az: number, bx: number, bz: number): Obstacle | null;
  dropStone(o: Obstacle): void;
  /** What closes in when a fight runs long waits this much longer. */
  delayLate(seconds: number): void;
  /** The boss can't be hurt or held for `seconds` (0: it can again). */
  guard(seconds: number): void;
  /** A boss's add, at the same spot on every screen. */
  spawnAdd(spec: AddSpec): RaidAdd;
  /** This screen's hero hit add `part` of cast `id`: the partner's screen takes it off too. */
  addHit(id: number, part: number, amount: number): void;
  /** Add `part` of cast `id` died on this screen: the first report wins, and every screen hears it (`done`). */
  report(id: number, part: number): void;
  /** The boss's max HP in this raid: an add's HP is a share of it. */
  bossMax: number;
}

/** A boss's add as a cast asks for it. Its HP is per screen: each screen's hits come off on both, and the first to see it die says so. */
export interface AddSpec {
  x: number;
  z: number;
  hp: number;
  look: MinionLook;
  color: string;
  /** This screen's hero hit it for this much. */
  hurt(amount: number): void;
  /** It died on this screen. */
  died(): void;
}

/** An add on this screen: heroes target it and hit it like any enemy. It never moves and never attacks; its move's later steps do. */
export interface RaidAdd {
  readonly x: number;
  readonly z: number;
  readonly alive: boolean;
  /** The partner's hit, from its own screen: it comes off here too, and goes nowhere else. */
  hurt(amount: number): void;
  /** It died on the other screen first. */
  slay(): void;
  /** Gone without dying: its stage ended. */
  remove(): void;
}

export interface AimContext {
  boss: { x: number; z: number };
  /** The one in the ring, when this is cast from the rim. */
  ring: { x: number; z: number };
  target: { x: number; z: number };
  step: number;
  seed: number;
  /** Where the last step of this move was aimed. */
  prev?: { x: number; z: number; dir: number; flag?: boolean };
  /** How far along from a to b (0..1) a ray gets before cover stops it. */
  rayStop(ax: number, az: number, bx: number, bz: number): number;
}

export interface BossMove {
  id: string;
  /** On the cast bar. */
  name: string;
  /** How long the cast bar fills (s). */
  charge: number;
  /** How long the boss stands still for it (s). A move with `alongside` doesn't stop it. */
  lock: number;
  /** The least time before it comes again (s). */
  cooldown: number;
  /** Only when the target is this close (m). */
  range?: number;
  /** When each step goes, from the move's start. */
  steps?: number[];
  /** It counts as an ultimate for what watches casts. */
  big?: boolean;
  /** Runs while the boss does other moves. */
  alongside?: boolean;
  /** Only with two players. */
  coop?: boolean;
  /** Its later steps come at wherever the target is then: an AI keeps walking through it and starts no long cast. */
  chases?: boolean;
  /** No cast bar and no pose (Burning Trail). */
  quiet?: boolean;
  /** Which form of a tag team it belongs to: a higher tier's extra moves go to the right one. */
  form?: number;
  /**
   * A stage: the boss stands apart and can't be hurt while it lasts (its `charge` and `lock`), and something else must be done.
   * A kneel ends it early, and the boss acts again after the kneel.
   */
  stage?: boolean;
  /** Each later step aims at the hero it aimed at less recently, not all at one. */
  spread?: boolean;
  /** What the boss's own body does for each step (its look knows the name): fists flying out, lanterns thrown. `seconds` until it lands, at tier 1. */
  body?: { name: string; seconds: number };
  /** What only the screen that runs the brain may do: move the boss. Returns seconds it stands still after. */
  act?(world: BossWorld, c: BossCast): number | void;
  pose: CastStyle;
  /** Where a step is aimed. Runs on the brain's screen only. */
  aim(c: AimContext): { x: number; z: number; dir: number; flag?: boolean };
  /** What a cast does. Runs on every screen: it may read the cast and the cover, and never a hero. */
  play(c: BossCast, p: PlayContext): PlayedMove;
}

/** One of a tag team: its look, and what it does in the ring and from the rim. */
export interface BossForm {
  name: string;
  kit(hp: number): HeroKit;
  scale: number;
  body: { radius: number; height: number };
  speed: number;
  keepAt: number;
  /** A hero closer than this (m) and it backs away, between its moves. Slower than a hero, so it can always be caught. */
  backAt?: number;
  moves: string[];
  rimMoves: string[];
  /** The move it leaves behind as it walks (Burning Trail). */
  trail?: string;
}

export interface BossPhase {
  name: string;
  /** Starts when HP falls to this share. The first phase has 1. */
  at: number;
  moves: string[];
  /** A tag team: which form is in the ring. */
  ring?: number;
  /** A tag team: how often the one on the rim adds a move (s). */
  rimEvery?: [number, number];
  /** A tag team: they swap this often (s). */
  swapEvery?: number;
  /** The move that opens the phase. */
  opener?: string;
  /** A move that comes by the clock, on top of the rest: first after this many seconds, then this often, this many times a fight. */
  timed?: { move: string; first: number; every: number; most: number };
  /** The quiet between moves (s). */
  gap: [number, number];
}

export interface BossDef {
  id: string;
  /** Not a boss: Noonfall's hall, on the same path, with no bars, no spells and nothing to fight (src/raid/hall.ts). */
  hall?: boolean;
  name: string;
  title: string;
  /** Its own room: not one of the duel arenas, so no duel picks it. */
  place: ArenaDef;
  /** Where it and the heroes start. `heroes`: alone, then side 0 and side 1 of a raid for two. */
  starts: { boss: { x: number; z: number }; heroes: [{ x: number; z: number }, { x: number; z: number }, { x: number; z: number }] };
  kit(hp: number): HeroKit;
  hp: { solo: number; duo: number };
  /** How much bigger than a hero its model is drawn. */
  scale: number;
  body: { radius: number; height: number };
  /** Walk speed (m/s). */
  speed: number;
  /** It stops walking this close to its target (m). */
  keepAt: number;
  /** The stagger gauge's size, and how long a full one makes it kneel (s). */
  staggerMax: number;
  kneel: number;
  /** The pause and banner when a phase begins (s). */
  phasePause: number;
  phases: BossPhase[];
  /** A higher tier brings these moves in from the first phase on, one a tier. */
  extra?: string[];
  /** A tag team: one HP bar, one in the ring at a time, the other on the rim. */
  forms?: BossForm[];
  /** Noonfall's gates in this room, by where they stand round its rim (degrees: 0 the south, where heroes come in). */
  gates?: { enter: number; exit: number };
  /** Where the one on the rim can stand. */
  rimSpots?: { x: number; z: number }[];
  /** The phase that starts `late` at once, whatever the clock says. */
  lateAt?: number;
  /** Seconds into the fight it enrages: its hits cost more and its moves come faster. The timer shows under its bar. */
  enrage?: number;
  moves: Record<string, BossMove>;
  /** What closes in when the fight runs too long; the offset goes on the clock the shift reads. */
  late?(): { shift: ArenaShift; offset: number; startsAt?: number };
}

/** A hit on this screen's hero. */
export interface BossHit {
  share: number;
  knock?: number;
  from: { x: number; z: number };
  move: string;
  big?: boolean;
}

/** What the link tells a screen. */
export interface RaidEvents {
  cast(c: BossCast): void;
  /** The boss's HP from whoever keeps it (a local link needs none). */
  hp?(hp: number): void;
  phase(i: number): void;
  stagger(value: number): void;
  kneel(seconds: number): void;
  /** How many heroes stood in a `stand` zone of cast `id` when it landed. */
  stood(id: number, part: number, count: number): void;
  /** A hero took an objective of cast `id`. */
  done(id: number, part: number, side: RaidSide): void;
  /** The partner hit add `part` of cast `id` for `amount` on its screen. */
  addHit?(id: number, part: number, amount: number): void;
  /** A screen wall falls. */
  wall(index: number): void;
  end(result: 'win' | 'lose'): void;
}

/**
 * What a screen tells the rest of the raid. The local link decides everything on the spot and hands it straight back;
 * the network one goes through the hub.
 */
export interface RaidLink {
  readonly solo: boolean;
  /** Which hero this screen plays. */
  readonly side: RaidSide;
  /** This screen runs the boss's brain. */
  brain: boolean;
  on: RaidEvents;
  /** The brain: a step of a move, to every screen. */
  cast(c: BossCast): void;
  /** This screen's hits took this much off the boss. */
  damage(amount: number): void;
  /** This screen's hero landed control. */
  stagger(points: number): void;
  /** This screen's hero stood in a `stand` zone, or not. */
  stood(id: number, part: number, inside: boolean): void;
  /** This screen's hero took an objective of cast `id`. */
  objective(id: number, part: number): void;
  /** A mechanic of cast `id` was done right: `key` in `RAID_REWARDS`. Only the screen that runs the brain says so. */
  reward(key: string, id: number): void;
  /** This screen's hero hit add `part` of cast `id`: the partner's screen takes it off too. */
  addHit(id: number, part: number, amount: number): void;
  /** A screen wall saved this screen's hero. */
  wallSaved(index: number): void;
  /** This screen's hero fell. */
  heroDown(): void;
  /** This screen's hero's HP now, for the partner's bar. */
  heroHp(hp: number): void;
  /** This screen's hero got the fallen partner up. */
  revive(): void;
  /** This screen's hero slowed or debuffed the boss: the other screen gets it too. */
  bossDebuff(kind: BossDebuff, amount: number, seconds: number): void;
  /** A two-kit hero on this screen brought in its other half. */
  heroAlt(alt: boolean): void;
  /** This screen's hero cast, or released an attack: the partner's screen replays it. */
  heroCast(m: Record<string, unknown>): void;
  heroAttack(id: number, mods: unknown): void;
  tick(dt: number): void;
  /** The boss's max HP in this raid. */
  readonly maxHp: number;
}

/** The duel, as a boss fight sees it (`Duel.startBoss`). */
export interface BossWorld {
  camera: THREE.Camera;
  /** The boss's spot and walk. */
  boss(): THREE.Vector3;
  walk(dt: number, x: number, z: number, speed: number): void;
  face(yaw: number): void;
  /** The floor that doesn't hurt: how far out a boss backing away may go. */
  floor(): { x: number; z: number; r: number };
  /** Whether a boss can walk straight from a to b, past the cover. */
  canWalk(ax: number, az: number, bx: number, bz: number): boolean;
  pose(style: CastStyle, seconds: number, big: boolean): void;
  /** The same for the one on the rim. */
  poseRim(style: CastStyle, seconds: number, big: boolean): void;
  /** The boss's body does a move's `act`, step `step`, landing at (x, z) after `seconds`. */
  act(name: string, step: number, x: number, z: number, seconds: number): void;
  /** A tag team swaps (see `PlayContext.tag`). */
  tag(form: number, x: number, z: number, rx: number, rz: number): void;
  /** The boss rushes to (x, z). Only the screen that runs the brain calls it. */
  dash(x: number, z: number, seconds: number): void;
  /** This screen's hero is carried by this much. */
  carryMe(dx: number, dz: number): void;
  /** What closes in when a fight runs long starts now. */
  lateNow(): void;
  /** It waits this much longer. */
  delayLate(seconds: number): void;
  /** The look of this phase on the boss's body. */
  bodyPhase(i: number): void;
  /** Says what to do, once a fight. */
  hint(text: string): void;
  /** This screen's hero is casting: it can't hold a spot. */
  busy(): boolean;
  /** This screen's hero carries something heavy, and walks slower. */
  heavy(on: boolean): void;
  addStone(x: number, z: number, radius: number, seconds: number): Obstacle;
  firstStone(ax: number, az: number, bx: number, bz: number): Obstacle | null;
  dropStone(o: Obstacle): void;
  /** The boss can't be hurt: hits on it show IMMUNE, and spells aim past it. */
  guard(on: boolean): void;
  /** A boss's add on this screen. */
  spawnAdd(spec: AddSpec): RaidAdd;
  /** What watches the enemy's casts (Hemocurse, the Referee's count). */
  enemyCast(big: boolean): void;
  /** The boss's walk from reports, on the screen that doesn't run its brain. */
  place(x: number, z: number, yaw: number): void;
  /** The boss's HP from whoever keeps it. */
  setBossHp(hp: number): void;
  /** A phase begins: Fresh Start's shield. */
  phaseShield(): void;
  /** This screen's hero. */
  me(): THREE.Vector3;
  /** It has fallen: nothing can hit it, and it stands in no zone. */
  down(): boolean;
  /** The heroes the brain may aim at: on one screen just this one. */
  heroes(): { side: RaidSide; x: number; z: number; down: boolean }[];
  /** Where the partner lies, while this hero can still get it up. */
  fallenPartner(): { x: number; z: number } | null;
  hitMe(h: BossHit): void;
  /** What a zone costs a summoned unit standing in it. */
  units(): { figure: object; pos: THREE.Vector3 }[];
  hitUnit(figure: object, damage: number): void;
  cover(): readonly Obstacle[];
  sees(ax: number, az: number, bx: number, bz: number): boolean;
  rayStop(ax: number, az: number, bx: number, bz: number): number;
  /** The first of the arena's walls on the way from a to b: its index in the arena's list, or -1. */
  firstWall(ax: number, az: number, bx: number, bz: number): number;
  crackWall(index: number): void;
  breakWall(index: number): void;
  exposed(seconds: number): void;
  kneel(seconds: number): void;
  banner(text: string, seconds: number, size?: string): void;
  say(text: string, color: string, x: number, z: number): void;
  finish(result: 'win' | 'lose'): void;
}
