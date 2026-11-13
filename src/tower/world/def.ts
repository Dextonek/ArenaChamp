import type { ArenaDef } from '../../arenas/types';
import type { Obstacle } from '../../obstacles';
import type { PieceKind } from './doors';

/**
 * A floor as data (pipeline/designs/tower-worlds-build.md, "The vocabulary"). Everything the zone's loop needs to run a floor is in
 * a `FloorDef`: the engine code (`game.ts`, `world.ts`, `quests.ts`, `law.ts`, `people.ts`) imports no floor. A second floor is a new
 * file under `floors/` and a zone drawing (`arena`); no new code. `floors/harbour.ts` is floor 1.
 */

export interface Spot { x: number; z: number }
export interface PlaceDef { id: string; name: string; x: number; z: number; r: number; /** Open ground to walk to: the middle of a place can be cover. */ stand: Spot }

/** What a kind of small enemy is: its numbers are shares of the hero's max health at floor 1 (as `TOWER` in floors.ts). */
export interface EnemySpec {
  id: string;
  name: string;
  blurb: string;
  /** A look drawn in code: `looks.ts` (floor 1's) or `looksWild.ts` (floors 2 and 3's). */
  look: string;
  melee: boolean;
  hp: number;
  /** A hit's cost as a share of the hero's max health. */
  share: number;
  every: number;
  speed: number;
  /** Drawn this many times as big (it is the unit's own scale, bars and all). */
  scale?: number;
  range?: number;
  /** Each blow also holds the hero. */
  net?: { kind: 'root' | 'slow'; seconds: number };
  shards: number;
  /** The tint of its bolts and hit numbers. */
  color: string;
}

export interface PackDef {
  id: string;
  /** Where it stands. A named enemy: where it starts (its patrol decides the rest). */
  at: Spot;
  mix: { kind: string; n: number }[];
  /** A name and a patrol: it is a pack of one that walks the route (waypoints, looped) at `speed` m/s while it is not hunting. */
  named?: { name: string; patrol: Spot[]; speed: number; bounty: { shards: number; relic: boolean } };
  /** An elite among them: the pack's first unit is this kind and is bigger. */
  elite?: string;
}

/** A thing a quest step asks, one verb with its place and number (closed list: pipeline/designs/tower-worlds-build.md). */
export type Step =
  | { verb: 'reach'; text: string; at: Spot; r: number }
  | { verb: 'fell'; text: string; packs: string[] }
  | { verb: 'fell-named'; text: string; pack: string }
  | { verb: 'light'; text: string; things: { id: string; at: Spot }[]; seconds: number }
  | { verb: 'hold'; text: string; at: Spot; r: number; seconds: number; waves: { kinds: string[]; every: number } }
  | { verb: 'carry'; text: string; item: string; /** What it is called on the screen, and where it goes. */ itemName: string; toName: string; from: Spot; to: Spot; r: number; /** a door that opens when it is delivered (it is an `open` that the delivery does) */ opens?: string;
      /** How the thing looks, held and lying (default a key); `plain`: nothing is drawn at `to` (the floor's own zone draws what it goes into, a well). */ look?: 'key' | 'jar' | 'bundle'; plain?: boolean }
  | { verb: 'open'; text: string; door: string }
  | { verb: 'lead'; text: string; name: string; from: Spot; path: Spot[]; r: number; /** Its look (`personLook` by default: `wisp`, `cart`) and its walking speed (m/s, default 2.5). */ look?: 'person' | 'wisp' | 'cart'; speed?: number };
export type Verb = Step['verb'];

export interface QuestDef {
  id: string;
  name: string;
  giver: string;
  main?: boolean;
  intro: string[];
  steps: Step[];
  outro: string[];
  reward: { shards: number; boon?: boolean; relic?: boolean };
}

export interface PersonDef {
  id: string;
  /** The roster hero whose model stands there. */
  hero: string;
  name: string;
  role: 'keeper' | 'giver' | 'trader' | 'rival';
  at: Spot;
  /** Which way it faces (radians; 0 faces +z, the camera's way). */
  face: number;
  greet: string[];
  quests: string[];
}

export interface CacheDef { id: string; at: Spot; shards: number; boon?: boolean }
export interface WaystoneDef { id: string; name: string; at: Spot }
export interface LoreDef { id: string; name: string; at: Spot; text: string[] }

/** A door in the world. */
export interface DoorDef {
  id: string;
  /** Which set piece it leads to. */
  piece: PieceKind;
  name: string;
  at: Spot;
  r: number;
  /** Closed behind a wall until a quest step opens it (`open`, or a `carry` that `opens` it). */
  wall?: { ax: number; az: number; bx: number; bz: number; r: number; height: number };
  /** What must hold for walking in to start the piece: a quest, a won piece, or nothing. */
  needs?: { quest?: string; won?: PieceKind };
  /** What it says when it is not ready yet. */
  locked: string;
}

export interface Region { x: number; z: number; rx: number; rz: number; rot?: number }

/** One rule of the zone's cast. All five are built (`law.ts`); `tide` is the full one. */
export type LawDef =
  | { kind: 'tide'; name: string; blurb: string; every: number; lasts: number; warn: number; low: Region[]; /** share of max health a second in the flood costs */ burn: number; slow: number }
  | { kind: 'storm'; name: string; blurb: string; every: number; lasts: number; warn: number; /** share of max health a second in the open band */ burn: number; width: number;
      /** How far a rock must be upwind (north) for the hero to be in its lee (m, default 7); how many steps the hero sees inside the band (m, default 5). */ shelter?: number; sight?: number;
      /** Dust wraiths: while the band is over the hero, `n` of `kind` come out of it every `every` s (at most `most` alive); they dissolve when it has passed. */ wraiths?: { kind: string; n: number; every: number; most: number } }
  | { kind: 'dark'; name: string; blurb: string; radius: number; lit: number; lights: Spot[] }
  | { kind: 'paths'; name: string; blurb: string; every: number; /** Seconds of warning before a change (default 0: none). */ warn?: number;
      walls: { a: Spot; b: Spot; r: number; height: number; set: 0 | 1; /** What the way is called in the warning. */ name?: string }[]; /** Which set is up at the start (default 0). */ first?: 0 | 1 }
  | { kind: 'sides'; name: string; blurb: string; banners: { id: string; name: string; color?: number; at: Spot; packs: string[] }[] };

export interface RivalDef {
  hero: string;
  /** What the race runs to, in words ("the lighthouse"). */
  goal: string;
  /** `race`: reach `to` before the runner, in the zone. `duel`: a door to a set piece. */
  mode: 'race' | 'duel';
  /** Where Zephyr stands and talks. */
  at: Spot;
  to?: Spot;
  r?: number;
  route?: Spot[];
  /** The runner's speed against the hero's (1: equal). */
  pace?: number;
  boon: boolean;
  lines: string[];
}

export interface FloorDef {
  n: number;
  id: string;
  name: string;
  blurb: string;
  arena: ArenaDef;
  /** The zone's own cover, without the doors' walls. */
  cover: Obstacle[];
  ring: number;
  start: Spot;
  places: Record<string, PlaceDef>;
  law: LawDef;
  enemies: Record<string, EnemySpec>;
  packs: PackDef[];
  people: PersonDef[];
  quests: QuestDef[];
  caches: CacheDef[];
  waystones: WaystoneDef[];
  lore: LoreDef;
  doors: DoorDef[];
  rival: RivalDef;
  /** Seconds of the floor's clock a cleared floor must be under for its fourth star. */
  par: number;
  /** The trader's wares: prices in shards. */
  shop: { heal: number; boon: number; life: number; hint: number };
  /** The camp, for a waystone-less fall and the trader's range. */
  camp: Spot;
}
