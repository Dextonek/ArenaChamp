import type { FloorDef } from '../def';
import { warArena, type WarLook } from '../warZone';
import { BANNERS_41 } from './banners-made';

/**
 * Floor 41 (floor 5 until the Climb became 50 floors), The Field of Banners. Since 2026-11-14 at the Climb's new size (five times the
 * ground, pipeline/designs/tower-50.md): the same place, people, quests, enemies and law (`sides`: two ghost armies, crimson `r` and
 * azure `b`; each site has a pack of each, and the banner the hero takes in the camp decides which is gone and which hunts), with
 * every id kept, laid out again on a broad field by `makeBannersFloor` (gen/war.ts) and baked by `pipeline/tools/gen-banners.ts` into
 * `./banners-made.ts`; drawn like the War chapter's made floors (`../warZone.ts`). Its set pieces (the Last Marshal, Oblivion at the
 * gate, Brannoc's duel) are in pieces/floors.ts, unchanged, and it keeps the number it was tuned at (`tunedAs` 5). The small floor's
 * drawing, `../f45/banners-zone.ts`, is no longer used by it.
 */
export const banners: FloorDef = {
  ...BANNERS_41.floor,
  arena: warArena('tower-zone-banners', 'The Field of Banners, a zone', BANNERS_41.look as unknown as WarLook),
  cover: BANNERS_41.look.pieces.map((p) => p.o),
};
