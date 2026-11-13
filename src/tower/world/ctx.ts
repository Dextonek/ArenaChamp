import type * as THREE from 'three';
import type { HeroKit } from '../../heroes';
import type { Obstacle } from '../../obstacles';
import type { PlayContext } from '../../raid/types';
import type { GameApi } from '../../runtime';
import type { FloorDef, PackDef, Spot } from './def';
import type { WorldHud } from './hud';
import type { Pack } from './packs';
import type { WorldRun } from './state';

/**
 * What the parts of a zone (quests, law, people, scenery) get of the zone around them: the floor's data, the run, the cast's play
 * context, the hero, the packs, and the few things any of them may do (say, pay, offer a boon, open a door). Made once per
 * `enterZone`; gone with the zone's fight.
 */
export interface ZoneCtx {
  api: GameApi;
  def: FloorDef;
  run: WorldRun;
  p: PlayContext;
  mode: 'play' | 'run';
  kit: HeroKit;
  hud: WorldHud;
  /** Where the hero stands (live). */
  hero: THREE.Vector3;
  packs: Map<string, Pack>;
  /** Seconds the floor has run (the run's clock). */
  now(): number;
  /** The hero's walk speed is the boons' times every source's factor: one place for the flood, the carry and the net. */
  speed(key: string, mul: number): void;
  say(text: string, color: string, at: Spot): void;
  banner(title: string, sub?: string, seconds?: number): void;
  pay(shards: number, at?: Spot): void;
  /** Three boons to choose one of (the autopilot takes one by its policy). */
  offerBoon(label: string): void;
  giveRelic(): void;
  save(): void;
  /** A pack the zone makes while it runs (a wave); awake, never gives up. */
  hunt(def: PackDef): Pack;
  /** The wall of a closed door, or null when it is open. */
  door(id: string): Obstacle | null;
  openDoor(id: string): void;
  /** Wall the heroes' hands are full for: the carry. */
  mute(on: boolean): void;
  /** A hero-side helper (the escort's). */
  group: THREE.Group;
  /** Where something is on the screen, in pixels. */
  project(x: number, y: number, z: number): { x: number; y: number; behind: boolean };
}
