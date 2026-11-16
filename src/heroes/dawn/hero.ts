import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { D, icons, portrait } from './icons';

/**
 * Auriel, the Dawn Paladin: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/dawn.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Auriel',
  title: 'the Dawn Paladin',
  accent: D.body,
  foil: D.foil,
  maxHp: 550,
  portrait,
  spells: [
    {
      key: 'Q', label: 'first light', name: 'First Light', range: 6, cooldown: 4,
      blurb: 'A wave of light in a 6 m cone: 40. Hitting the enemy gives her a 14 shield for 3 s, but not while Dawnward or Sunrise holds. When that shield ends it bursts for 8 in 3 m.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'dawnward', name: 'Dawnward', range: 0, cooldown: 9,
      blurb: 'A 45 shield for 3 s. While it holds, her basic attacks reach 3 m farther. Press again to pop it now. When it ends it bursts for 27 in 3 m. It cannot be cast while Sunrise holds.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'oathbrand', name: 'Oathbrand', range: 7, cooldown: 11,
      blurb: 'A beam falls on the enemy (7 m) 0.5 s later if she still has sight: 44, and branded for 2.5 s. A burst that catches a branded enemy also stuns them 0.8 s.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'sunrise', name: 'Sunrise', range: 0, cooldown: 24,
      blurb: 'A 130 shield for 5 s, and she floats. Press again to pop it. When it breaks, runs out or is popped, a 5 m ring appears fixed at her spot, closes for 1.6 s and bursts for 80. It does not follow her.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 9,
  kit,
  model: 'models/heroes/dawn_v2.glb',
  body: { radius: 0.47, height: 2.33 },
  shop: { kind: 'support', shelf: 0 },
  icons: 'auriel',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Auriel | the Dawn Paladin"',
    model: 'blender/heroes/real/dawn.py',
    design: 'pipeline/designs/kit-dawn.md',
  },
};

export default card;
