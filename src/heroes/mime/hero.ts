import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Mum, the Silent One: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/mime.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Mum',
  title: 'the Silent One',
  maxHp: 620,
  accent: S.chalk,
  foil: S.dark,
  portrait,
  spells: [
    {
      key: 'Q', label: 'invisible ball', name: 'Invisible Ball', range: 9, cooldown: 3.5, aim: 'line', passesOwnWalls: true,
      blurb: 'She throws a ball you cannot see (9 m, 22 m/s, 0.3 s wind-up): 72 damage. Only a chalk line on the floor shows where it goes. It passes her own walls.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'mime wall', name: 'Wall', range: 9, cooldown: 0.6, summon: true,
      blurb: 'Three charges, one back every 3 s. An invisible wall 4 m long at a spot (9 m), solid for both of you for 5 s, with only faint chalk on the floor. One hit of any size breaks it. Three at most.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'rope trick', name: 'Rope Trick', range: 7, cooldown: 11,
      blurb: 'She mimes a rope to you (7 m, 0.5 s, needs sight when it lands): 55 damage and you are pulled 3 m toward her. Cover breaks it.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'the box', name: 'Boxed In', range: 9, cooldown: 22,
      blurb: 'Four walls close round your spot (9 m, sight) after 0.8 s: 3 m wide, standing 3 s. She can shoot in; you cannot get out until you break one. Each takes one hit.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 27,
  kit,
  model: 'models/heroes/mime_v3.glb',
  body: { radius: 0.45, height: 2.49 },
  shop: { kind: 'controller', shelf: 3 },
  icons: 'mum',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Mum | the Silent One"',
    model: 'blender/heroes/real/mime.py',
    design: 'pipeline/designs/kit-mime.md',
  },
};

export default card;
