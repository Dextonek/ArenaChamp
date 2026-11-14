import type { ArenaDef } from '../../../../arenas/types';
import type { Chapter, GenFloor } from '../../gen/types';
import { sandsArena, type SandsLook } from '../../sandsZone';
import { warArena, type WarLook } from '../../warZone';
import { seaArena, type SeaLook } from '../../zone';

/**
 * How each chapter's made floor is drawn: its arena, from its baked look (pipeline/designs/tower-50.md). One line a chapter; a chapter
 * that has no builder yet cannot have baked floors.
 */
export const ARENA_OF: Partial<Record<Chapter, (g: GenFloor) => ArenaDef>> = {
  sea: (g) => seaArena(`tower-${g.floor.id}`, g.floor.name, g.look as unknown as SeaLook),
  sands: (g) => sandsArena(`tower-${g.floor.id}`, g.floor.name, g.look as unknown as SandsLook),
  war: (g) => warArena(`tower-${g.floor.id}`, g.floor.name, g.look as unknown as WarLook),
};
