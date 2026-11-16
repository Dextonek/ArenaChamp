import type { HeroKit } from '../../heroes.ts';

/**
 * A hero's card (`src/heroes/<theme>/hero.ts`, docs/pipeline/hero-framework.md): what the menu, the shop, the CPU, the
 * Raid, the Climb and the protocol need at once. Small and without three.js: every card is loaded with the page; a hero's
 * spells and look are in its other files.
 */
export interface HeroCard {
  /**
   * Its place in the roster (`HERO_KITS`): Vesper 0 to Anka 39. The place decides the start hero, the menu ring, the open
   * world's guests and the opponent a seed draws, so a hero keeps it; a new hero takes the next number.
   */
  order: number;
  /** The kit: name, title, colours, HP, portrait, and the four spells' cards (key, label, name, range, cooldown, flags, blurb, icon). */
  kit: HeroKit;
  /** Its rigged figure, a path under public/. */
  model: string;
  /** The size its hits are judged with (`HERO_BODIES` in src/heroes.ts says how it is measured). */
  body: { radius: number; height: number };
  /** Its row in the hero shop. The server keeps its own copy (`HERO_SHOP` in server/protocol.mjs: it cannot read this file); the page checks the two agree. */
  shop: { kind: string; shelf: number };
  /**
   * The stem of its VectorCraft spell icons: `public/icons/spells/<icons>-q.svg` ... (src/icons/vc.ts). A hero of two halves
   * (Pim and Pom) names one stem a half: the kit's, then its `alt`'s.
   */
  icons: string | [string, string];
}

/**
 * Where the rest of a hero lives: its lore entry, its model's build, its design. Exported beside the card
 * (`export const pointers`), not on it: the game imports only the card, so this text stays out of the page's start.
 */
export interface HeroPointers { lore: string; model: string; design: string }
