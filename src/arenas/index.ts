import { battlefieldArena } from './battlefield';
import { calderaArena } from './caldera';
import { canyonArena } from './canyon';
import { cavernArena } from './cavern';
import { frostArena } from './frost';
import { gladeArena } from './glade';
import { harbourArena } from './harbour';
import { skyruinsArena } from './skyruins';
import { templeArena } from './temple';
import type { ArenaDef } from './types';

export type { ArenaDef, ArenaScene, ArenaStage } from './types';
export { DEFAULT_STAGE } from './common';

/** Every duel arena; a duel picks one at random (`pickArena`). The order is fixed: a network match picks by index. */
export const ARENAS: ArenaDef[] = [templeArena, frostArena, calderaArena, gladeArena, skyruinsArena];

/**
 * Arenas being made: reachable by id (`duel.arenaChoice`, the tool) but not picked at random and not offered after a
 * lost round, until each has its event and its closing stages. Moving one into `ARENAS` changes which arena a match id
 * gives, so it needs a new `PROTOCOL` with it.
 */
export const NEW_ARENAS: ArenaDef[] = [harbourArena, canyonArena, cavernArena, battlefieldArena];

/** The arena with this id, else undefined. */
export const arenaById = (id: string) => ARENAS.find((a) => a.id === id) ?? NEW_ARENAS.find((a) => a.id === id);

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
