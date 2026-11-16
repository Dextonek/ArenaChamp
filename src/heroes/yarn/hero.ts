import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Grandma Ironknit, the Weaver: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/yarn.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Grandma Ironknit',
  maxHp: 620,
  title: 'the Weaver',
  accent: S.pink,
  foil: S.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'knitting needle', name: 'Knitting Needle', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'A needle as long as a sword (9 m, 22 m/s, 0.3 s wind-up): 62 damage. Step off its line.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'cast on', name: 'Cast On', range: 9, cooldown: 0.6, summon: true,
      blurb: 'Two charges, one back every 6 s. She ties a line of yarn from her to the nearest cover the way you aim (9 m), or 9 m out into nothing. Three at most. Walk across one and you are stuck 0.4 s, then slowed 1 s. One hit cuts it.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'sweater', name: 'Sweater', range: 7, cooldown: 11,
      blurb: 'She throws a sweater on you (7 m, 0.5 s, needs sight when it lands): slowed 2 s, then it shrinks: 50 damage. Reach cover first.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'mr biscuit', name: 'Mr. Biscuit', range: 0, cooldown: 24, summon: true,
      blurb: 'A big grey cat springs out of a ball of wool at her feet: 200 HP, 6 s, 4.5 m/s. He runs at you and sits on you: 25 damage a second and a slow. Shoot him, or lead him off: he stops to play with a cut line.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 33,
  kit,
  model: 'models/heroes/yarn_v3.glb',
  body: { radius: 0.4, height: 2.33 },
  shop: { kind: 'support', shelf: 1 },
  icons: 'grandma-ironknit',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Grandma Ironknit | the Weaver"',
    model: 'blender/heroes/real/yarn.py',
    design: 'pipeline/designs/kit-yarn.md',
  },
};

export default card;
