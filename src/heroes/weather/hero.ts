import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { W, icons, portrait } from './icons';

/**
 * Barry Cloudsley, the Sky Augur: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/weather.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Barry Cloudsley',
  maxHp: 610,
  title: 'the Sky Augur',
  accent: W.sky,
  foil: W.sun,
  portrait,
  spells: [
    {
      key: 'Q', label: 'cold front', name: 'Cold Front', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'A gust (9 m): 64 damage. In Rain it slows for 1.5 s. In Wind it knocks the target back further.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'lightning risk', name: 'Lightning Risk', range: 9, cooldown: 9,
      blurb: 'A cloud marks a spot (9 m): after 0.8 s lightning strikes it, 64 damage within 1.5 m.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'forecast update', name: 'Forecast Update', range: 0, cooldown: 12,
      blurb: 'The forecast changes now, to the other weather. It costs a Cold Front cooldown of 6 s. Cannot be cast in the last 0.6 s before a change.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'severe warning', name: 'Severe Warning', range: 9, cooldown: 24,
      blurb: 'A tornado at a spot (9 m): after a 1 s warning it walks at the enemy at 2.5 m/s for 4 s, 25 damage a second within 2 m. Walk away: you are faster.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 34,
  kit,
  model: 'models/heroes/weather_v3.glb',
  body: { radius: 0.46, height: 3.06 },
  shop: { kind: 'caster', shelf: 1 },
  icons: 'barry-cloudsley',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Barry Cloudsley | the Sky Augur"',
    model: 'blender/heroes/real/weather.py',
    design: 'pipeline/designs/kit-weather.md',
  },
};

export default card;
