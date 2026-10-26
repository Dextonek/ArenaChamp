import type * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type GUI from 'three/addons/libs/lil-gui.module.min.js';
import type { Emitter } from '../emitter';
import type { BloomSettings } from '../presets';
import type { TelegraphSpec } from './telegraph';
import type { CastContext, TargetingSpec } from './targeting';
import type { ScreenFx } from './parts/screen';

export type { CastContext, TargetingSpec };

/** A timed set piece (sword fall, meteor shower, ...) that main.ts can play, step and render. */
export interface Effect {
  /** Everything the effect draws; main adds it to the scene and toggles its visibility. */
  readonly group: THREE.Group;
  /** Particle emitters inside `group`; main keeps their point-size scale in sync with the viewport. */
  readonly emitters: Emitter[];
  /** Camera shake for the current frame, in world units (0 = none). */
  shake: number;
  /** Optional full-screen feedback (darken, impact frames, focus lines), read every frame like `shake`. */
  screen?: ScreenFx;
  /** True while the timeline runs. */
  playing: boolean;
  /** Restarts the timeline from the beginning. */
  play(): void;
  /** Advances by `dt` seconds. Must keep emitters updating even when not playing. */
  update(dt: number): void;
  /**
   * Targeted effects only: called right before every play() with who and where to hit (see `targeting.ts`).
   * Store what you need; positions must be read from the context, never from ENEMY_POS / CASTER_POS.
   */
  cast?(ctx: CastContext): void;
}

/** Registry entry for an effect: how to build it, light it, frame it and expose its settings. */
export interface EffectModule {
  /** Shown in the mode dropdown. */
  label: string;
  /** Groups modes in the category dropdown (e.g. 'set pieces', 'paladin', 'iconic'). Default 'set pieces'. */
  category?: string;
  create(): Effect;
  /** Bloom applied when this mode is selected. */
  bloom: BloomSettings;
  /** Puts the camera where the whole effect is visible. */
  frameCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, effect: Effect): void;
  /** Adds the effect's controls to its own folder (play button and camera framing are added by main). */
  buildGui(folder: GUI, effect: Effect): void;
  /**
   * Red ground danger zones ("don't stand in the red"), read on every play from the current settings.
   * Times are seconds after play(). main.ts draws them and tests the player dummy against them.
   */
  telegraphs?(effect: Effect): TelegraphSpec[];
  /**
   * Set on targeted effects: main.ts then shows the shared arena (caster + clickable enemies) and calls
   * `effect.cast()` before every play. The effect must not create its own caster or enemies.
   */
  targeting?: TargetingSpec;
}
