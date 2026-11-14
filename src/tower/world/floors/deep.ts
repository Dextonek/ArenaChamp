import { deepArena } from '../deepZone';
import { floorKeep } from '../keep';
import type { FloorDef } from '../def';
import { DEEP_HOME } from './deep-home';

/**
 * Floor 31 (floor 4 until the Climb became 50 floors), The Lightless Deep (pipeline/designs/tower-worlds.md, "The five floors"), grown to
 * five times its old ground on a cave of its own outline (pipeline/designs/tower-50.md, "The new scope": the handmade floors grow too).
 * The same place, people (Mabel, Isolde, Tempo, Mr. Ledger), quests (the three crystals, the Pale One, the lost lantern, the survey lamp),
 * Tempo's race to the echo well, the dark, and the same ids for everything a saved run names; laid out again by the Deep's generator
 * (`gen/deep.ts`, its `home` floor) and baked by `pipeline/tools/gen-deep-home.ts` into `deep-home.ts`. Drawn by `../deepZone.ts`, as the
 * Deep's made floors are. Its set pieces (the Prism Mother, Opaline at the gate, the Dark Vault) are `pieces/floors.ts`'s, unchanged, and
 * it keeps the number it was tuned at (`tunedAs: 4`). The 48 m zone it was is `../f45/deep-zone.ts`, no longer used.
 */
export const deep: FloorDef = {
  ...DEEP_HOME.floor,
  n: 31,
  tunedAs: 4,
  id: 'deep',
  arena: deepArena('tower-zone-deep', 'The Lightless Deep, a zone', DEEP_HOME.look, floorKeep(DEEP_HOME.floor)),
  cover: DEEP_HOME.look.pieces.map((p) => p.o),
};
