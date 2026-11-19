import type { EffectModule } from '../../../effects/types';
import { g1Modules } from './g1';
import { g2Modules } from './g2';
import { g3Modules } from './g3';
import { g4Modules } from './g4';
import { g5Modules } from './g5';
import { g6Modules } from './g6';
import { g7Modules } from './g7';
import { g8Modules } from './g8';
import { g9Modules } from './g9';
import { g10Modules } from './g10';

/**
 * The gallery: twenty tool spells in twenty styles and actions, made to the quality of the Scarlet Sheath's (the user,
 * 2026-11-19: "lets make more like this effects do like 20 more spells in like different action and different style but this
 * quality"). Design: pipeline/designs/gallery-20.md. On the tool page only, never in the game. Each group's file lists its own.
 */
export const galleryModules: EffectModule[] = [...g1Modules, ...g2Modules, ...g3Modules, ...g4Modules, ...g5Modules, ...g6Modules, ...g7Modules, ...g8Modules, ...g9Modules, ...g10Modules];
