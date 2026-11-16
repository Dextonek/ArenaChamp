import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { K, icons, portrait } from './icons';

/**
 * Hank, the Moss Hewer: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/timber.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Hank',
  title: 'the Moss Hewer',
  maxHp: 780,
  melee: true,
  accent: K.wood,
  foil: K.pine,
  portrait,
  spells: [
    {
      key: 'Q', label: 'axe swing', name: 'Axe Swing', range: 3, cooldown: 3,
      blurb: 'A quick 3 m swing in front of him: 60. Any tree of his that the swing touches falls away from him along a strip 8 m long and 1.6 m wide, shown for 0.6 s: 30, 60 or 110 by its size. A stump stays.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'fast growth', name: 'Fast Growth', range: 6, cooldown: 7, cc: true,
      blurb: 'Grows a tree at a spot up to 6 m away. After 0.7 s anything within 1.5 m of it takes 50 and is knocked up 0.5 s. A sapling has 30 HP and blocks nothing; young at 1.2 s (120 HP, real cover); full at 2.5 s. Two charges.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'caber toss', name: 'Caber Toss', range: 9, cooldown: 9, aim: 'line',
      blurb: 'Rips up the nearest tree within 3 m and hurls it 9 m end over end: 30, 60 or 90 by its size, and a knock-back. With no tree he throws his axe for 30, and Q is gone until he walks to where it landed.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'timber call', name: 'TIMBER!', range: 10, cooldown: 24, aim: 'line', overCover: true,
      blurb: 'Five trees grow in a row along the aim, 2 m apart: real cover. Recast within 4 s: he swings and they fall like dominoes along the row, 90 on whoever lies in the way (3 hits at most). Without it they fall harmlessly after 8 s.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 22,
  kit,
  model: 'models/heroes/timber_v3.glb',
  body: { radius: 0.61, height: 2.69 },
  shop: { kind: 'fighter', shelf: 1 },
  icons: 'hank',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Hank | the Moss Hewer"',
    model: 'blender/heroes/real/timber.py',
    design: 'pipeline/designs/kit-timber.md',
  },
};

export default card;
