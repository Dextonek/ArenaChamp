import type * as THREE from 'three';
import type { ArenaShift } from '../arenas/shifts/base';
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
}

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
  /** Parts of one move that report apart (Anchors). */
  part?: number;
  /** Nothing is drawn for it. */
  hidden?: boolean;
  landed?: boolean;
  lastHit?: number;
}

/** What a move draws beyond its zones. */
export interface MoveLook {
  /** `t`: seconds since the cast. */
  update?(t: number, dt: number): void;
  /** A threat of this cast lands. */
  land?(th: Threat): void;
  dispose?(): void;
}

export interface PlayedMove {
  threats: Threat[];
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
}

export interface AimContext {
  boss: { x: number; z: number };
  target: { x: number; z: number };
  step: number;
  seed: number;
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
  pose: CastStyle;
  /** Where a step is aimed. Runs on the brain's screen only. */
  aim(c: AimContext): { x: number; z: number; dir: number };
  /** What a cast does. Runs on every screen: it may read the cast and the cover, and never a hero. */
  play(c: BossCast, p: PlayContext): PlayedMove;
}

export interface BossPhase {
  name: string;
  /** Starts when HP falls to this share. The first phase has 1. */
  at: number;
  moves: string[];
  /** The move that opens the phase. */
  opener?: string;
  /** The quiet between moves (s). */
  gap: [number, number];
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  /** Its arena's id. */
  arena: string;
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
  moves: Record<string, BossMove>;
  /** What closes in when the fight runs too long; the offset goes on the clock the shift reads. */
  late?(): { shift: ArenaShift; offset: number };
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
  /** Whether a `stand` zone of cast `id` was held. */
  stood(id: number, part: number, held: boolean): void;
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
  readonly brain: boolean;
  on: RaidEvents;
  /** The brain: a step of a move, to every screen. */
  cast(c: BossCast): void;
  /** This screen's hits took this much off the boss. */
  damage(amount: number): void;
  /** This screen's hero landed control. */
  stagger(points: number): void;
  /** This screen's hero stood in a `stand` zone, or not. */
  stood(id: number, part: number, inside: boolean): void;
  /** A screen wall saved this screen's hero. */
  wallSaved(index: number): void;
  /** This screen's hero fell. */
  heroDown(): void;
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
  pose(style: CastStyle, seconds: number, big: boolean): void;
  /** What watches the enemy's casts (Hemocurse, the Referee's count). */
  enemyCast(big: boolean): void;
  /** This screen's hero. */
  me(): THREE.Vector3;
  /** The heroes the brain may aim at: on one screen just this one. */
  heroes(): { side: RaidSide; x: number; z: number; down: boolean }[];
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
