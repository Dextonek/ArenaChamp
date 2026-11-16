import { HERO_SHOP } from '../../server/protocol.mjs';
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

/**
 * Whether this page shows the heroes still going through their gates (`draft: true` on the card, docs/pipeline/new-hero.md):
 * the hero workbench always does (its page, `/workbench.html`, or the tool page `/` opened with `?bench`; not the game's page); on the dev server, any
 * page opened with `?drafts=1` (the simulator's `--drafts`). Everywhere else a draft is not in the game: not on the roster, in
 * the shop, among the CPU's picks or in the Codex.
 */
const query = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const path = typeof location !== 'undefined' ? location.pathname : '';
export const SHOW_DRAFTS: boolean = !!query
  && (/\/workbench(\.html)?$/.test(path) || (/^\/(index\.html)?$/.test(path) && query.has('bench'))
    || (!!import.meta.env.DEV && query.has('drafts')));

const all = Object.entries(found).map(([path, card]) => [path.split('/')[1], card] as const);
const released = all.filter(([, c]) => !c.draft);
/** A draft shown here takes the next free place after the released heroes (in the order its card asks for, then its folder's). */
const drafts = SHOW_DRAFTS
  ? all.filter(([, c]) => c.draft).sort(([fa, a], [fb, b]) => a.order - b.order || (fa < fb ? -1 : 1))
    .map(([f, c], i) => [f, { ...c, order: released.length + i }] as const)
  : [];

/** Every folder's card, by its folder (`phoenix`): the released heroes, and the drafts where they are shown (`SHOW_DRAFTS`). */
export const CARD_BY_FOLDER: Record<string, HeroCard> = Object.fromEntries([...released, ...drafts]);

/** The folders of the drafts shown here (the workbench marks them). */
export const DRAFT_FOLDERS: string[] = drafts.map(([f]) => f);

/** The folders' cards in the roster's order. */
export const HERO_CARDS: HeroCard[] = Object.values(CARD_BY_FOLDER).sort((a, b) => a.order - b.order);

// The server keeps the shop rows itself (it cannot read these files): say so at once if a card and the server disagree.
if (import.meta.env.DEV) {
  for (const c of HERO_CARDS) {
    if (c.draft) continue; // the server learns a hero's shop row at its release (gate 6)
    const row = HERO_SHOP[c.kit.name];
    if (!row || row.kind !== c.shop.kind || row.shelf !== c.shop.shelf) {
      console.error(`${c.kit.name}: the card's shop row ${JSON.stringify(c.shop)} is not the server's (HERO_SHOP in server/protocol.mjs: ${JSON.stringify(row)})`);
    }
  }
}
