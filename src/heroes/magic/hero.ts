import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { M, icons, portrait } from './icons';

/**
 * The Great Zambini, the Illusionist: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/magic.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'The Great Zambini',
  maxHp: 570,
  title: 'the Illusionist',
  accent: M.violet,
  foil: M.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'card spray', name: 'Card Spray', range: 8, cooldown: 3.5, aim: 'line',
      blurb: 'Three playing cards in a 24 degree fan (8 m): 26 damage each. Close up they are a wall; past 5 m stand in a gap.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'sawn in half', name: 'Sawn in Half', range: 8, cooldown: 10, aim: 'line',
      blurb: 'A saw blade slides at you (8 m, 18 m/s): 60 damage and slowed 1.5 s.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'hat trick', name: 'The Hat Trick', range: 0, cooldown: 13,
      blurb: 'Three hats shuffle at his feet for 1.5 s and he vanishes under one. Hit the right hat and he pops out stunned 1 s; a wrong one gives confetti. At 1.5 s he appears at his hat. An area spell hits all three.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'grand finale', name: 'The Grand Finale', range: 9, cooldown: 24,
      blurb: 'He vanishes. Three hats ring the enemy (radius 3 m) for 1.2 s, then swords fly from all three toward the centre: 30 each, stopped by walls. He steps out of one. Step out of the ring.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 36,
  kit,
  model: 'models/heroes/magic_v3.glb',
  body: { radius: 0.45, height: 2.51 },
  shop: { kind: 'assassin', shelf: 3 },
  icons: 'the-great-zambini',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "The Great Zambini | the Illusionist"',
  model: 'blender/heroes/real/magic.py',
  design: 'pipeline/designs/kit-magic.md',
};
