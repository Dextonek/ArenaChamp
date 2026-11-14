import type { FloorDef } from '../def';
import { woodGenArena, woodKeep } from '../woodZone';
import { WOOD_11 } from './woodGrown';

/**
 * Floor 11 (floor 2 until the Climb became 50 floors), The Walking Wood, at five times its old ground (pipeline/designs/tower-50.md, "The new
 * scope": the user chose that the handmade floors grow too). The same place, people, quests, packs, ruler, gatekeeper, rival and law,
 * re-laid on a large outline by the Wood's generator (src/tower/world/gen/wood.ts `makeWoodEleven`) and baked into `woodGrown.ts` by
 * `node pipeline/tools/gen-wood11.ts`. Its fights keep the number they were tuned at (`tunedAs` 2); its set pieces are in pieces/floors.ts.
 * Drawn by woodZone.ts, as the chapter's made floors are. (The 48 m wood it was is in `../zoneWood.ts`, no longer used.)
 */
export const wood: FloorDef = {
  ...WOOD_11.floor,
  arena: woodGenArena('tower-zone-wood', 'The Walking Wood, a zone', WOOD_11.look, woodKeep(WOOD_11.floor)),
  cover: WOOD_11.look.pieces.map((p) => p.o),
};
