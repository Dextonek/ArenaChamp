import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { C, icons, portrait } from './icons';

/**
 * Madame Cleaver, the Feastmistress: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/chef.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Madame Cleaver',
  maxHp: 680,
  title: 'the Feastmistress',
  accent: C.core,
  foil: C.red,
  portrait,
  spells: [
    {
      key: 'Q', label: 'thrown cleaver', name: 'Thrown Cleaver', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'She throws her cleaver (9 m): 66 damage. It sticks in the floor where it stops, and a dish plops out there.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'hot soup', name: 'Hot Soup', range: 8, cooldown: 9,
      blurb: 'A huge pot drops at a spot (8 m) and tips over after 1 s: 56 damage and a 1.5 s slow within 2.5 m, and a dish in the middle.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'burnt offering', name: 'Burnt Offering', range: 8, cooldown: 12,
      blurb: 'She lobs a burnt dish to a spot (8 m). Black and smoking: whoever walks over it eats 60 damage and a 0.8 s stun. On her it does nothing.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'dinner is served', name: 'Dinner Is Served', range: 0, cooldown: 24,
      blurb: 'An 8 m table rises in front of her for 5 s: real cover, 150 HP, with three dishes on it. Whoever stands at it for 1 s eats them: +25% damage for 5 s, and for her 50 HP.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 29,
  kit,
  model: 'models/heroes/chef_v3.glb',
  body: { radius: 0.58, height: 2.33 },
  shop: { kind: 'support', shelf: 1 },
  icons: 'madame-cleaver',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Madame Cleaver | the Feastmistress"',
  model: 'blender/heroes/real/chef.py',
  design: 'pipeline/designs/kit-chef.md',
};
