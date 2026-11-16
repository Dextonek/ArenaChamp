import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { icons, portrait } from './icons';

/**
 * Mabel, the Deepdelver: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/mole.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Mabel',
  maxHp: 680,
  melee: true,
  title: 'the Deepdelver',
  accent: '#8a6a4a',
  foil: '#ffcf5a',
  portrait,
  spells: [
    {
      key: 'Q', label: 'mole claw', name: 'Claw', range: 2.5, cooldown: 3,
      blurb: 'A swipe of her digging claws, 2.5 m in front of her: 68 damage.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'mole dig', name: 'Dig', range: 6, cooldown: 7,
      blurb: 'A hole at a spot (6 m), opening after 0.7 s, 1.5 m in radius. It stays 8 s, three at most. Whoever walks in falls: rooted 0.8 s, then slowed. She walks across her own.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'mole tunnel', name: 'Mole Run', range: 7.2, cooldown: 10, dash: true,
      blurb: 'She dives (0.3 s) and tunnels up to 7.2 m in 1.2 s, 40% faster than she walks, a mound on the surface showing where. Nothing can hit her and she cannot cast. She pops up: 60 and a 0.5 s knock-up within 1.5 m.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'sinkhole', name: 'Sinkhole', range: 9, cooldown: 24,
      blurb: 'The ground drops under the enemy: a pit 4 m in radius at their spot (9 m, sight needed), 1.3 s warning. Whoever is inside takes 115 and is rooted 1 s.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 32,
  kit,
  model: 'models/heroes/mole_v3.glb',
  body: { radius: 0.5, height: 2.33 },
  shop: { kind: 'assassin', shelf: 1 },
  icons: 'mabel',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Mabel | the Deepdelver"',
    model: 'blender/heroes/real/mole.py',
    design: 'pipeline/designs/kit-mole.md',
  },
};

export default card;
