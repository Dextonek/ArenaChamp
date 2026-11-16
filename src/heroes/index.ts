import { HERO_SHOP, rTiming } from '../../server/protocol.mjs';
import type { HeroCard } from './framework/card';

/**
 * The heroes that live in a folder of their own, `src/heroes/<theme>/` (docs/pipeline/hero-framework.md): found here by
 * themselves, so no list is edited by hand for them. This file reads only their cards (`hero.ts`: small, no three.js);
 * their passives are found by src/heroes/traits.ts (for src/traits/index.ts) and their spells by src/heroes/spells.ts
 * (for the game's list of spells), so a tool that only wants the roster does not pull in every spell.
 *
 * A glob comes back sorted by folder name; the roster's order is each card's `order` (it decides the start hero, the menu
 * ring, the open world's guests and the opponent a seed draws). src/heroes.ts puts these in among the heroes not moved yet.
 */
const found = import.meta.glob<HeroCard>('./*/hero.ts', { eager: true, import: 'default' });

/** Every folder's card, by its folder (`phoenix`). */
export const CARD_BY_FOLDER: Record<string, HeroCard> = Object.fromEntries(
  Object.entries(found).map(([path, card]) => [path.split('/')[1], card]),
);

/** The folders' cards in the roster's order. */
export const HERO_CARDS: HeroCard[] = Object.values(CARD_BY_FOLDER).sort((a, b) => a.order - b.order);

// The server keeps the shop rows itself (it cannot read these files): say so at once if a card and the server disagree.
if (import.meta.env.DEV) {
  for (const c of HERO_CARDS) {
    const row = HERO_SHOP[c.kit.name];
    if (!row || row.kind !== c.shop.kind || row.shelf !== c.shop.shelf) {
      console.error(`${c.kit.name}: the card's shop row ${JSON.stringify(c.shop)} is not the server's (HERO_SHOP in server/protocol.mjs: ${JSON.stringify(row)})`);
    }
    // The hub drops an R that comes sooner than its gap for the hero: the other screen would never see it.
    const r = c.kit.spells[3], gap = rTiming(c.kit.name).gapMs;
    if (r && r.cooldown * 1000 < gap) console.error(`${c.kit.name}: R comes back after ${r.cooldown} s, but the hub lets an R through only every ${gap / 1000} s (R_TIMING in server/protocol.mjs)`);
  }
}
