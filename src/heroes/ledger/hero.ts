import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { L, icons, portrait } from './icons';

/**
 * Mr. Ledger, the Tithe-Keeper: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/ledger.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Mr. Ledger',
  maxHp: 600,
  title: 'the Tithe-Keeper',
  accent: L.gold,
  foil: L.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'invoice', name: 'Invoice', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'A paper flies (9 m): 72 damage that goes on the target\'s tab instead of hurting now. The tab comes due 3 s after the last charge, at +40%.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'late fee', name: 'Late Fee', range: 9, cooldown: 9,
      blurb: 'At a spot (9 m), after 1 s: a notice lands on a 2.5 m circle. 62 damage on the tab, and slowed 1.5 s.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'call it in', name: 'Call It In', range: 0, cooldown: 8,
      blurb: 'The ledger is slammed shut: the tab on the enemy comes due now, without the interest. Needs no target, and a tab to call.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'foreclosure', name: 'Foreclosure', range: 9, cooldown: 24,
      blurb: 'A huge stamp falls at a spot (9 m) in 0.8 s. Seen in the 2.2 m circle, the target pays their whole tab now at +60%, and takes 20% more from him for 3 s. Cover saves them.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 25,
  kit,
  model: 'models/heroes/ledger_v3.glb',
  body: { radius: 0.42, height: 2.4 },
  shop: { kind: 'controller', shelf: 2 },
  icons: 'mr-ledger',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Mr. Ledger | the Tithe-Keeper"',
  model: 'blender/heroes/real/ledger.py',
  design: 'pipeline/designs/kit-ledger.md',
};
