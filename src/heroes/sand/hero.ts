import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Sefu, the Dune Sovereign: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/sand.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Sefu',
  title: 'the Dune Sovereign',
  accent: S.body,
  foil: S.stone,
  maxHp: 620,
  portrait,
  spells: [
    {
      key: 'Q', label: 'cobra spit', name: 'Cobra Spit', range: 9, cooldown: 5, aim: 'line',
      blurb: 'A cobra rears and spits venom 9 m down the aim: 62 damage and blinded 1.2 s on the first enemy it touches. Half the cooldown back when it hits a Judged enemy. Step off the line to dodge it.',
      icon: icons.Q,
    },
    {
      key: 'W', label: "shepherd's crook", name: "Shepherd's Crook", range: 6, cooldown: 10, cc: true,
      blurb: 'He hooks the crook round an enemy 6 m away (he must see them) and drags them 3 m toward him: 35 damage and slowed 0.5 s. The enemy is Judged for 3 s.',
      icon: icons.W,
    },
    {
      // Range 11 is only the duel AI's reach: it dashes when the enemy is farther than Q reaches; the dash itself is 6 m.
      key: 'E', label: 'scarab stride', name: 'Scarab Stride', range: 11, cooldown: 12, dash: true,
      blurb: 'He skitters 6 m down the aim as a stream of scarabs in 0.5 s, the line shown as he starts. Running through an enemy bites: 30 now, then 30 poison over 2 s. He can still be hit.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'sarcophagus', name: 'Sarcophagus', range: 9, cooldown: 24, cc: true,
      blurb: 'A gold sarcophagus rises at the enemy 9 m away (he must see them). 0.7 s later, if they are still inside its 1.6 m circle, it shuts: sealed 1.2 s, unable to act and unable to be hit. It opens in scarabs: 110 damage and Judged. Step out and it shuts on nothing.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 6,
  kit,
  model: 'models/heroes/sand_v2.glb',
  body: { radius: 0.4, height: 2.86 },
  shop: { kind: 'controller', shelf: 0 },
  icons: 'sefu',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Sefu | the Dune Sovereign"',
    model: 'blender/heroes/real/sand.py',
    design: 'pipeline/designs/kit-sand.md',
  },
};

export default card;
