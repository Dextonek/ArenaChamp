import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Big Yoko, the Mountain: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/sumo.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Big Yoko',
  maxHp: 840,
  melee: true,
  title: 'the Mountain',
  accent: S.red,
  foil: S.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'palm strike', name: 'Palm Strike', range: 2.8, cooldown: 3,
      blurb: 'An open palm slaps the way he faces (2.8 m, 0.4 s): 54 damage, and you are shoved 3 m. A shove that takes you out of his ring is a ring-out.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'stomp', name: 'Stomp', range: 0, cooldown: 11,
      blurb: 'He stomps a new ring at his feet (0.5 s): 50 damage and slowed 1 s within 3 m. The ring is 5 m in radius and stands 8 s: a push that takes you out of it is a ring-out.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'sumo charge', name: 'Charge', range: 6, cooldown: 10, dash: true,
      blurb: 'He runs 6 m down the aim (0.4 s wind-up, strip shown): the first enemy on it takes 40 and is carried along ahead of him. If that carries you out of his ring, it is a ring-out.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'salt throw', name: 'Salt Throw', range: 0, cooldown: 22,
      blurb: 'He throws a fistful of salt: a 6 m cone after 0.6 s blinds you for 1.5 s. His ring gets 2 m smaller for the rest of its life, and he is 30% faster for 4 s.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 26,
  kit,
  model: 'models/heroes/sumo_v3.glb',
  body: { radius: 0.76, height: 2.6 },
  shop: { kind: 'vanguard', shelf: 1 },
  icons: 'big-yoko',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Big Yoko | the Mountain"',
  model: 'blender/heroes/real/sumo.py',
  design: 'pipeline/designs/kit-sumo.md',
};
