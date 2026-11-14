import type { FloorDef } from '../def';
import { HARBOUR } from './gen/harbour-big';
import { genFloorDef } from './gen/index';

/**
 * Floor 1, The Drowned Harbour, grown to the Climb's new size (pipeline/designs/tower-50.md, "The new scope"): five times the old
 * ground, a coast of its own outline. Made by src/tower/world/gen/harbour.ts (the sea's generator dressed as the harbour: its people,
 * quests and words, Old Barnacle, Tam, Zephyr's race) and baked by `node pipeline/tools/gen-floors.ts harbour`. Its set pieces are
 * floor 1's (pieces/floors.ts). The small harbour of 2026-11-12 is in git's history (this file and zone.ts's `PLACES`, `cover`).
 */
export const harbour: FloorDef = genFloorDef(HARBOUR);
