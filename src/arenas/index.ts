import { calderaArena } from './caldera';
import { frostArena } from './frost';
import { gladeArena } from './glade';
import { skyruinsArena } from './skyruins';
import { templeArena } from './temple';
import type { ArenaDef } from './types';

export type { ArenaDef, ArenaScene, ArenaStage } from './types';
export { DEFAULT_STAGE } from './common';

/** Every duel arena; a duel picks one at random (`pickArena`). The order is fixed: a network match picks by index. */
export const ARENAS: ArenaDef[] = [templeArena, frostArena, calderaArena, gladeArena, skyruinsArena];

/** The arena with this id, else undefined. */
export const arenaById = (id: string) => ARENAS.find((a) => a.id === id);

/**
 * Picks an arena. With a `seed` string (a network match id) both players get the same arena without the server
 * having to choose one; without it the pick is random.
 */
export function pickArena(seed?: string): ArenaDef {
  if (seed === undefined) return ARENAS[Math.floor(Math.random() * ARENAS.length)];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ARENAS[(h >>> 0) % ARENAS.length];
}
