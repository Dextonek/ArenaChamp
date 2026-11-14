import type { Chapter, GenFloor } from './types';
import { makeSandsFloor } from './sands.ts';
import { makeSeaFloor } from './sea.ts';
import { makeWarFloor } from './war.ts';

/**
 * Each chapter's generator (pipeline/designs/tower-50.md), for `pipeline/tools/gen-floors.ts`: floor `n` of the chapter, from a seed
 * offset `attempt`. One line a chapter. Runs under `node` too: imports with their `.ts` ending, no runtime imports beyond the generators.
 */
export const GENERATORS: Partial<Record<Chapter, (o: { n: number; attempt?: number }) => GenFloor>> = {
  sea: makeSeaFloor,
  sands: makeSandsFloor,
  war: makeWarFloor,
};
