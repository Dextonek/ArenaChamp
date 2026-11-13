import type { FloorDef } from '../def';
import type { PiecesDef } from '../pieces/types';
import type { Piece } from '../zone';

/** The five chapters of the Climb (pipeline/designs/tower-50.md): floors 1-10, 11-20, 21-30, 31-40, 41-50. */
export type Chapter = 'sea' | 'wood' | 'sands' | 'deep' | 'war';
export const CHAPTER_OF = (n: number): Chapter => (['sea', 'wood', 'sands', 'deep', 'war'] as const)[Math.min(4, Math.floor((n - 1) / 10))];

/**
 * What every chapter's zone is drawn from: its walkable outline (radii round the middle, gen/core.ts `makeOutline`) and its cover with
 * looks (the outline's invisible walls among them, look `edge`). A chapter adds what its own drawing needs (the sea: `SeaLook` in
 * zone.ts); the chapter's arena builder (floors/gen/arenas.ts) reads it.
 */
export interface ChapterLook {
  rim: number[];
  pieces: Piece[];
  [more: string]: unknown;
}

/**
 * A floor made by the generator, as it is baked into a file under `floors/gen/`: plain data, no code. `floors/gen/index.ts` turns it
 * into a `FloorDef` (its arena drawn by its chapter's builder from `look`, its cover the look's pieces) and its set pieces.
 */
export interface GenFloor {
  n: number;
  /** The chapter it belongs to; its look and parts come from the chapter's handmade floor. */
  chapter: Chapter;
  /** The seed it was made from (the generator's, not the land's). */
  seed: number;
  look: ChapterLook;
  floor: Omit<FloorDef, 'arena' | 'cover'>;
  pieces: PiecesDef;
}
