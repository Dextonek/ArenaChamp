import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Zephyr, the Wind Blade: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/sky.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Zephyr',
  title: 'the Wind Blade',
  accent: S.body,
  foil: S.cloud,
  maxHp: 620,
  melee: true,
  portrait,
  spells: [
    {
      key: 'Q', label: 'crosswind', name: 'Crosswind', range: 3, cooldown: 4,
      blurb: 'A 3 m cross-cut of wind in front of him: 34 damage. Press Q again within 2 s for a 3 m dash-slash through the aim (23 damage), a dash that gives a Gust.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'skyward', name: 'Skyward', range: 5, cooldown: 8, dash: true, cc: true,
      blurb: 'He leaps into the air, untouchable for 0.6 s, and comes down on a spot within 5 m: 34 damage within 1.4 m and a 0.5 s knock-up. The landing circle shows from take-off. A dash: it gives a Gust and resets his basic attack when he lands.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'feather step', name: 'Feather Step', range: 4, cooldown: 7, aim: 'line', overCover: true, dash: true, parry: true,
      blurb: 'A quick 4 m step in any direction. Two charges (one back every 7 s), shown as pips round him. A dash: it gives a Gust and resets his basic attack.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'sky rend', name: 'Sky Rend', range: 7, cooldown: 24,
      blurb: 'Ultimate. Click an enemy within 7 m: he marks them and stands for 0.8 s. If he still sees them within 9 m, he vanishes and cuts from every side: 3 cuts plus 2 per Gust he spends (9 at most), 22 damage each, untouchable while they run. He ends behind them and cannot cast for 0.6 s. If the wind-up fails (cover, or too far) it fizzles and he is free.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 11,
  kit,
  model: 'models/heroes/sky_v2.glb',
  body: { radius: 0.4, height: 2.37 },
  shop: { kind: 'assassin', shelf: 0 },
  icons: 'zephyr',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Zephyr | the Wind Blade"',
    model: 'blender/heroes/real/sky.py',
    design: 'pipeline/designs/kit-sky.md',
  },
};

export default card;
