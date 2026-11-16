import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { V, icons, portrait } from './icons';

/**
 * Oblivion, the Unmaker: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/void.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Oblivion',
  title: 'the Unmaker',
  accent: V.body,
  foil: V.ash,
  maxHp: 780,
  melee: true,
  portrait,
  spells: [
    {
      key: 'Q', label: 'gravity slam', name: 'Gravity Slam', range: 3, cooldown: 4,
      blurb: 'He slams the ground: 60 within 3 m, and enemies there are dragged 1.5 m toward him.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'null zone', name: 'Null Zone', range: 0, cooldown: 12, cc: true,
      blurb: 'A 3 m sphere of void stays where he cast it for 3 s. Enemies inside cannot cast, and bolts that enter it vanish.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'phase step', name: 'Phase Step', range: 4, cooldown: 14, dash: true,
      blurb: 'He marks a spot within 4 m, then steps through the void to it 0.25 s later. His next basic attack within 3 s rips for +40 and weakens the enemy 20% for 2 s.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'void black hole', name: 'Black Hole', range: 8, cooldown: 24, cc: true, aim: 'line', overCover: true,
      blurb: 'A black hole crawls 8 m down his aim for 4 s, pulling enemies within 5 m. Touching its core deals 105 and stuns 1 s, once. Recast: it collapses at once for 85 within 3 m, after a 0.5 s warning.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 17,
  kit,
  model: 'models/heroes/void_v2.glb',
  body: { radius: 0.63, height: 2.62 },
  shop: { kind: 'vanguard', shelf: 0 },
  icons: 'oblivion',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Oblivion | the Unmaker"',
    model: 'blender/heroes/real/void.py',
    design: 'pipeline/designs/kit-void.md',
  },
};

export default card;
