import type { FloorDef } from '../def';
import type { PiecesDef } from '../pieces/types';
import type { SeaLook } from '../zone';

/**
 * A floor made by the generator (pipeline/designs/tower-50.md), as it is baked into a file under `floors/gen/`: plain data, no code.
 * `floors/gen/index.ts` turns it into a `FloorDef` (its arena drawn from `look`, its cover the look's pieces) and its set pieces.
 */
export interface GenFloor {
  n: number;
  /** The chapter it belongs to; its look and parts come from the chapter's handmade floor. */
  chapter: 'sea';
  /** The seed it was made from (the generator's, not the land's). */
  seed: number;
  look: SeaLook;
  floor: Omit<FloorDef, 'arena' | 'cover'>;
  pieces: PiecesDef;
}
