import type { FloorDef } from '../def';
import { sandsArena, type SandsLook } from '../sandsZone';
import { CANYON_21 } from './canyon-made';

/**
 * Floor 21 (floor 3 until the Climb became 50 floors), The Storm Canyon. Since 2026-11-14 at the Climb's new size (five times the
 * ground, pipeline/designs/tower-50.md): the same place, people, quests, enemies and storm, with every id kept, laid out again on a
 * long canyon by `makeCanyonFloor` (gen/sands.ts) and baked by `pipeline/tools/gen-canyon.ts` into `./canyon-made.ts`; drawn like the
 * Sands chapter's made floors (`../sandsZone.ts`). Its set pieces (the Scarab Colossus, Sefu at the gate, Vesper's duel) are in
 * pieces/floors.ts, unchanged, and it keeps the number it was tuned at (`tunedAs` 3).
 */
export const canyon: FloorDef = {
  ...CANYON_21.floor,
  arena: sandsArena('tower-zone-canyon', 'The Storm Canyon, a zone', CANYON_21.look as unknown as SandsLook),
  cover: CANYON_21.look.pieces.map((p) => p.o),
};
