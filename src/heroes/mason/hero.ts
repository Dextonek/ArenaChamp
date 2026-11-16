import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { M, icons, portrait } from './icons';

/**
 * Bram, the Stonewright: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/mason.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Bram',
  title: 'the Stonewright',
  maxHp: 800,
  melee: true,
  accent: M.body,
  foil: '#6d6a66',
  portrait,
  spells: [
    {
      key: 'Q', label: 'raise gerald', name: 'Raise Gerald', range: 9, cooldown: 6, cc: true,
      blurb: 'Marks a spot (9 m): 0.7 s later Gerald bursts up there, 76 damage and a 0.5 s knock-up to anyone within 1.5 m. He is a real pillar with 220 HP. A new Gerald crumbles the old one.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'the shove', name: 'The Shove', range: 8, cooldown: 7, aim: 'line', overCover: true,
      blurb: 'Needs Gerald within 3 m. He slides 8 m along your aim at 8 m/s: 70 damage to the first enemy he touches, who is carried along. Stopped by a wall with them: stunned 0.9 s.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'a good lean', name: 'A Good Lean', range: 8, cooldown: 11,
      blurb: 'Needs Gerald within 8 m. Dash to him and stop 1.5 m short, with a shield of 60 for 2 s. He did not ask for the hug.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'gerald no', name: 'Gerald, No!', range: 10, cooldown: 24, aim: 'line', overCover: true,
      blurb: 'Needs Gerald. He topples along your aim: a 10 m shadow for 1.0 s, then 150 damage to anyone in it. He breaks into rubble that slows for 3 s, and you have no pillar left.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 21,
  kit,
  model: 'models/heroes/mason_v3.glb',
  body: { radius: 0.59, height: 2.7 },
  shop: { kind: 'fighter', shelf: 0 },
  icons: 'bram',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Bram | the Stonewright"',
    model: 'blender/heroes/real/mason.py',
    design: 'pipeline/designs/kit-mason.md',
  },
};

export default card;
