import type { Ctx, ScreenParams } from './core';

/**
 * A showpiece: one short animated special move, drawn as a pure function of time.
 *
 * Each piece is one file in `pieces/` whose default export is a `Piece`; the page finds them by itself
 * (`import.meta.glob`), so a new piece needs no line anywhere else. Its art goes in `art/` (shared helpers) or
 * `art/<id>/` (its own). See docs/architecture/showpiece.md.
 */

export interface Beat {
  name: string;
  t0: number;
  t1: number;
}

/** The two layers a frame is drawn into, both in picture units (1920 by 1080). */
export interface Layers {
  /** Drawn as it is, never bloomed: backgrounds, paper, ink, figures. */
  flat: Ctx;
  /** Laid over the flat layer (with its alpha), and the only thing that blooms: light, fire, sparks, lightning. */
  glow: Ctx;
}

export interface Piece {
  /** Short, lower case: the page's address uses it (`/showpiece?piece=<id>`). */
  id: string;
  title: string;
  subtitle: string;
  /** One sentence for the page. */
  about: string;
  /** Its order among the pieces (lower first). */
  order?: number;
  duration: number;
  beats: Beat[];
  /**
   * A web font for the few characters the piece writes, loaded from Google Fonts with only those characters (a few
   * kilobytes). Without it the device's own fonts are used.
   */
  fonts?: { family: string; weight: number; text: string };
  /** Draws the frame at time t (0 to duration) into both layers; says what the screen pass should do. */
  draw(L: Layers, t: number): ScreenParams;
}
