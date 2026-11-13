import type { FloorKind } from '../../week';
import type { TowerBoons } from '../../boons';

/**
 * The set pieces behind a floor's doors (pipeline/designs/tower-worlds-pieces.md). The zone enters one through a door and gets
 * an outcome back. These types are declared here and again by the zone (`src/tower/world/doors.ts`); they are to be unified at the merge.
 */
export type PieceKind = 'ruler' | 'gate' | 'trial' | 'rival';

export interface PieceIn {
  floor: number;
  hero: string;
  /** Health as a share 0..1. */
  hp: number;
  boons: TowerBoons;
  /** The rival's hero name, if it was beaten and fights beside you. */
  ally?: string;
  /** 'run' is the autopilot's: no fades, no waits, nothing on the page. */
  mode: 'play' | 'run';
}

export interface PieceOut {
  won: boolean;
  /** Health left as a share 0..1. */
  hp: number;
  seconds: number;
}

/** What `startPiece` hands back. The contract says `void`; a caller may ignore this. */
export interface PieceHandle {
  /**
   * `mode: 'run'`: call between two steps of the simulation, as `TowerRun.pump`: a fight that ended reports its outcome from here. Optional:
   * with no pump the outcome is reported by a microtask, as soon as the code that steps the simulation yields.
   */
  pump(): void;
  /** Ends the piece with no outcome (the player left). */
  cancel(): void;
  /** Whether `done` has been called (or the piece cancelled). */
  readonly over: boolean;
  /** For the tool: what the piece measured. */
  report(): PieceReport;
}

/** What a piece measured, for `_pieceRun`. */
export interface PieceReport {
  by?: string;
  hits: Record<string, number>;
  phase: number;
  kneels: number;
  note: string[];
}

/** One move of a ruler: the Tower's own moves, by name (`ruler.ts` builds each from `use`). */
export type MoveSpec =
  | { use: 'sweep'; name?: string; share: number; cooldown?: number }
  | { use: 'volley'; name?: string; share: number; cooldown?: number }
  | { use: 'stones'; name?: string; share: number; count?: number; radius?: number; light?: boolean; cooldown?: number }
  | { use: 'spokes' | 'halves' | 'stand'; name?: string; share: number; cooldown?: number }
  | { use: 'tide'; name?: string; share: number; near?: boolean; inner?: number; cooldown?: number }
  | { use: 'cleave' | 'lunge' | 'fan'; share: number; cooldown?: number }
  | { use: 'call'; name?: string; count: number; cooldown?: number }
  /** An opener: the sentries stand up (those of a later phase). */
  | { use: 'raise'; name?: string }
  /** The ground rule: the sea (or the storm) comes in, and only the safe ground holds. `warn` seconds of warning, then `seconds` of it. */
  | { use: 'surge'; name?: string; warn: number; seconds: number; cooldown?: number }
  /** The boss goes unhurt, marks where the hero stands, bursts up there and stands open: `guard`, `stones`' mark, `tide`'s near burst, `exposed`. */
  | { use: 'burrow'; name?: string; share: number; under: number; open: number; cooldown?: number };

export interface PhaseSpec {
  name: string;
  /** Starts when the boss's health falls to this share. */
  at: number;
  moves: string[];
  opener?: string;
  timed?: { move: string; first: number; every: number; most: number };
  gap: [number, number];
}

/** A set of small things that stand in the room and are shot at or felled: cannons, roots, crystals, a standard. */
export interface SentriesSpec {
  look: 'cannon' | 'root' | 'crystal' | 'standard';
  /** Where they stand: degrees round the room (0 the south) and how far from its middle. */
  spots: [number, number][];
  hp: number;
  /** They are raised again this many seconds after one falls. */
  again?: number;
  /** What one that falls does to the stagger gauge (points), or `kneel`: it makes the boss kneel at once. */
  fall?: { stagger?: number; kneel?: boolean };
  /** The boss cannot be hurt while any stands; when the last has fallen it stands open for this long (s). */
  guards?: { open: number };
  /** From which phase (0-based) they stand. */
  from?: number;
}

/** Where the sea or the storm cannot hurt: round fixed decks, or round the boss's own shell. */
export type SafeSpec = { decks: { x: number; z: number; r: number }[] } | { shell: number };

export interface RulerDef {
  name: string;
  title: string;
  /** The hero whose model and kit it is drawn from, for now (the guardian's way). */
  stand: string;
  /** A colour laid over its model so the five rulers do not look alike. */
  tint: string;
  /** How many times a hero's size. */
  scale: number;
  /** Its health. */
  hp: number;
  speed: number;
  keepAt?: number;
  /** The stagger gauge and how long a full one makes it kneel (s). */
  stagger: { max: number; kneel: number };
  /** The arena it is fought in: the floor's own. */
  room: string;
  moves: Record<string, MoveSpec>;
  phases: PhaseSpec[];
  sentries?: SentriesSpec;
  /** What a `surge` does: where it is safe, what it costs a second (share of max health), and how much it slows. */
  surge?: { safe: SafeSpec; burn: number; slow?: number; name: string; look: 'sea' | 'storm' };
  /** The room goes dark round the hero in the last phase (a page layer). */
  dark?: { from: number };
  /** What the player should do, in a line for the screen. */
  line: string;
}

export interface GateDef {
  hero: string;
  arena: string;
  /** The CPU's level, 1 Novice to 5 Master (src/cpuLevels.ts). */
  level: number;
  /** The ring's twist: the arena's shift (started `early` seconds in) or its hazard. */
  twist: { kind: 'shift' | 'hazard'; name: string; early?: number };
}

export interface TrialDef {
  kind: Exclude<FloorKind, 'guardian' | 'duel'>;
  /** The weekly Tower's floor it is built at. */
  height: number;
  twist?: 'dark';
}

export interface RivalDef {
  hero: string;
  twist: 'giant' | 'swift' | 'warded';
  line: string;
  /** The weekly Tower's height the duel is built at (default twice the floor's number: a made floor's own, so a number past 10 is not a rival of the 20s). */
  height?: number;
}

export interface PiecesDef {
  floor: number;
  /** How much more a hit costs here than on floor 1 (the ruler's moves, the called guard), and how strong an ally is. A ruler's health is its own number. */
  hard: number;
  ruler: RulerDef;
  gate: GateDef;
  trial: TrialDef;
  /** Floors 1 and 4 are races the zone runs itself. */
  rival?: RivalDef;
  /**
   * A crown floor (every tenth, pipeline/designs/tower-50.md): behind the lair's door is this Raid boss (`raid/bosses.ts`), played alone
   * at the first tier, instead of the ruler (whose name and line still say who it is).
   */
  crown?: 'sun' | 'ash' | 'heart';
}
