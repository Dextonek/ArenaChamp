import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Referee Whistler, the Arbiter: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/referee.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Referee Whistler',
  maxHp: 620,
  title: 'the Arbiter',
  accent: S.core,
  foil: S.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'whistle blast', name: 'Whistle Blast', range: 8, cooldown: 3.5, aim: 'line',
      blurb: 'A ring of sound (8 m, 0.3 s wind-up): 78 damage. Sidestep it.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'no running', name: 'No Running', range: 7, cooldown: 9,
      blurb: 'A rule for the enemy in sight within 7 m: no dashes, blinks or leaps for 3 s. Break it and you get a yellow card.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'no casting', name: 'No Casting', range: 7, cooldown: 13,
      blurb: 'A rule for the enemy in sight within 7 m: no spells, only basic attacks, for 2 s. Cast anyway and the spell goes off, with a yellow card.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'show the card', name: 'Show the Card', range: 9, cooldown: 24,
      blurb: 'He points at a spot (9 m, 0.6 s): a yellow card to whoever he still sees there, and HANDS OFF for 3 s: hit him and you get another. Two yellows are a red: 90 damage and silenced 1.5 s.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 28,
  kit,
  model: 'models/heroes/referee_v3.glb',
  body: { radius: 0.44, height: 2.33 },
  shop: { kind: 'controller', shelf: 2 },
  icons: 'referee-whistler',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Referee Whistler | the Arbiter"',
  model: 'blender/heroes/real/referee.py',
  design: 'pipeline/designs/kit-referee.md',
};
