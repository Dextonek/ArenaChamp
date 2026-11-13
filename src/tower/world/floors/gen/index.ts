import type { FloorDef } from '../../def';
import type { GenFloor } from '../../gen/types';
import type { PiecesDef } from '../../pieces/types';
import { ARENA_OF } from './arenas';
import { BAKED } from './list';

/**
 * The Climb's made floors (pipeline/designs/tower-50.md), baked by `pipeline/tools/gen-floors.ts` into this folder: each as the
 * `FloorDef` the zone runs and the set pieces behind its doors. In the Climb's list at their numbers (`floors/index.ts`); their set
 * pieces are found by `piecesOf` (`pieces/floors.ts`). Each chapter's arena is drawn by its builder in `arenas.ts`.
 */
export function genFloorDef(g: GenFloor): FloorDef {
  const arena = ARENA_OF[g.chapter];
  if (!arena) throw new Error(`floor ${g.n}: no arena builder for the ${g.chapter} chapter (floors/gen/arenas.ts)`);
  return { ...g.floor, arena: arena(g), cover: g.look.pieces.map((p) => p.o) };
}

/** Each made floor by its number: the floor and its set pieces. */
export const GEN_FLOORS: Record<number, { floor: FloorDef; pieces: PiecesDef; baked: GenFloor }> = Object.fromEntries(
  BAKED.map((g) => [g.n, { floor: genFloorDef(g), pieces: g.pieces, baked: g }]),
);
