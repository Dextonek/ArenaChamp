import type * as THREE from 'three';
import type { Obstacle } from '../obstacles';
import type { ArenaHazard } from './hazards/base';
import type { ArenaShift } from './shifts/base';

/**
 * The look of the world around a duel arena: sky dome, fog and the two scene lights, set by main.ts `setStage`
 * when a duel starts and put back to the default when it ends. Colours are hex numbers.
 */
export interface ArenaStage {
  /** `scene.background` (only seen where the sky dome is hidden). */
  background: number;
  /** Sky dome: zenith, horizon band and the thin glow on the horizon line. */
  zenith: number;
  horizon: number;
  glow: number;
  /** Stars in the sky dome, 0 = none, 1 = the default night. */
  stars: number;
  /** Distance fog colour and range (the default fog eats only the far ground: 48 → 150). */
  fog: number;
  fogNear: number;
  fogFar: number;
  /** Hemisphere light (sky colour, ground colour, intensity). */
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  /** The shadow-casting sun and the cool rim light behind the arena. */
  sun: number;
  sunIntensity: number;
  rim: number;
  rimIntensity: number;
}

/** How a breakable wall looks. */
export type WallState = 'whole' | 'cracked' | 'broken';

/** A built arena: its meshes and an optional per-frame animation (embers, snow, fireflies, drifting clouds). */
export interface ArenaScene {
  group: THREE.Group;
  update?(dt: number, time: number): void;
  /**
   * Breakable cover (`ArenaDef.breakable`): shows wall `index` (into `ArenaDef.obstacles`) whole, cracked or broken
   * into rubble. Called with 'whole' for every wall at the start of each round.
   */
  wallState?(index: number, state: WallState): void;
  /** Arenas that change: cover `index` (into `ArenaDef.obstacles`) topples along yaw `dir`, flat after `seconds`, then breaks up. */
  coverFall?(index: number, dir: number, seconds: number): void;
  /** Arenas that change: the floor beyond radius `r` breaks off and falls, with what stands on it. */
  ringBreak?(r: number): void;
  /** A new round: everything `coverFall` and the like changed is back. */
  resetShift?(): void;
  dispose?(): void;
}

/**
 * One duel arena. Every arena uses the same ring (centre (0, 7), radius 12, starts at (0, 13) and (0, 1)); what
 * changes is the cover layout, the meshes and the stage. Layout rules (see docs/architecture/arenas.md):
 * point-symmetric about (0, 7), the two starts clear for 3 m, nothing flush with the rim, gaps of at least 2 m,
 * no pockets or dead ends, pillar radius ≤ 1.0, wall half-thickness ≤ 0.4.
 */
export interface ArenaDef {
  id: string;
  /** Shown in the countdown banner. */
  name: string;
  obstacles: Obstacle[];
  stage: ArenaStage;
  /** Walls (`kind: 'wall'`) break under spells: see `Duel.blastWalls`. The scene shows it through `wallState`. */
  breakable?: boolean;
  /** Hide the tool's slab floor under the arena (a floating platform over clouds builds its own world). */
  hideGround?: boolean;
  /** The arena's timed event for one round (src/arenas/hazards); both screens of a network duel get the same `seed`. */
  hazard?(seed: string): ArenaHazard;
  /** How the arena changes as one round runs long (src/arenas/shifts); both screens of a network duel get the same `seed`. */
  shift?(seed: string, scene: ArenaScene): ArenaShift;
  /** Builds a fresh copy of the arena's meshes (called each time the arena is picked). */
  build(): ArenaScene;
}
