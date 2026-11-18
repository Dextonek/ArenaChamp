import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { icons, portrait } from './icons';

/**
 * Sir Whiskers, the Lynx Duelist: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/cat.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Sir Whiskers',
  maxHp: 540,
  hpChunks: 9,
  melee: true,
  title: 'the Lynx Duelist',
  accent: '#e8a13a',
  foil: '#f4e6c8',
  portrait,
  spells: [
    {
      key: 'Q', label: 'scratch', name: 'Scratch', range: 2.5, cooldown: 3,
      blurb: 'A 2.5 m claw in front of him: 64 damage. His next attack within 2 s is ready at once.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'knock it over', name: 'Knock It Over', range: 9, cooldown: 9, cc: true,
      blurb: 'With cover within 4 m of him, a pot falls on the spot at 9 m after 0.7 s (1.5 m): 60 damage and a 0.5 s stun. In the open it does nothing.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'pounce', name: 'Cat Leap', range: 7, cooldown: 8, dash: true,
      blurb: 'Spends the life he is on: leaps 7 m onto you for 60 damage, then cannot cast for 0.4 s. Not on his last life.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'land on my feet', name: 'Land on My Feet', range: 0, cooldown: 24, save: true,
      blurb: 'For 4 s, the next life he would lose is not lost: he lands on his feet and leaps 3 m away. His attacks are 30% faster until then.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 24,
  kit,
  model: 'models/heroes/cat_v3.glb',
  body: { radius: 0.49, height: 2.33 },
  shop: { kind: 'assassin', shelf: 2 },
  icons: 'sir-whiskers',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Sir Whiskers | the Lynx Duelist"',
  model: 'blender/heroes/real/cat.py',
  design: 'pipeline/designs/kit-cat.md',
};
