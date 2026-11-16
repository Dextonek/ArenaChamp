import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { K, icons, portrait } from './icons';

/**
 * Pip, the Wingfoot: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/courier.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Pip',
  maxHp: 620,
  title: 'the Wingfoot',
  accent: K.accent,
  foil: K.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'express letter', name: 'Express Letter', range: 8, cooldown: 3, aim: 'line',
      blurb: 'A letter flicked at the aim (8 m): 58 damage, +15 for each Charge he holds. He keeps them.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'fragile', name: 'Fragile', range: 9, cooldown: 9,
      blurb: 'A parcel thrown at a spot (9 m). After 1 s it bursts, 2.5 m wide: 72 damage and a 1 s slow. Walk out of the ring.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'shortcut', name: 'Shortcut', range: 6, cooldown: 9, dash: true, escape: true,
      blurb: 'A sprint of up to 6 m. With a Charge he spends one and Shortcut is ready again almost at once.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'final delivery', name: 'Final Delivery', range: 6, cooldown: 24,
      blurb: 'Spends all his Charges. A parcel with your name hunts you for 1.5 s (5 m/s), then bursts: 80, +40 per Charge, within 2 m. Touch cover first and you sign for it: it goes back.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 30,
  kit,
  model: 'models/heroes/courier_v3.glb',
  body: { radius: 0.39, height: 2.36 },
  shop: { kind: 'assassin', shelf: 1 },
  icons: 'pip',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Pip | the Wingfoot"',
    model: 'blender/heroes/real/courier.py',
    design: 'pipeline/designs/kit-courier.md',
  },
};

export default card;
