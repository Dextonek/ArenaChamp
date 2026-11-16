import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Tempo, the Unwound Hour: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/chrono.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Tempo',
  title: 'the Unwound Hour',
  maxHp: 580,
  accent: S.body,
  foil: S.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'tick bolt', name: 'Tick', range: 9, cooldown: 3, aim: 'line',
      blurb: 'A spinning clock hand (9 m, 50). A direct hit takes 1 s off Tick. Echo: the same line again 1.5 s later, from where he stood, for 20.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'slow time', name: 'Slow Time', range: 9, cooldown: 9,
      blurb: 'Time thickens in a 3.5 m circle (9 m): after 1.2 s enemies inside take 30 and are slowed 2 s. He moves 30% faster inside for 3 s. Echo 1.5 s later: 12 and the slow again.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'time skip', name: 'Time Skip', range: 6, cooldown: 11, dash: true,
      blurb: 'He vanishes for 0.6 s (untouchable) and returns on the marker 6 m away with a pulse of 35. Echo 1.5 s later at the same spot: 14.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'stolen hour', name: 'Stolen Hour', range: 8, cooldown: 24,
      blurb: 'A clock face forms over an enemy (8 m); after 0.8 s, if he still sees them: 70 and slowed 2 s, and for 4 s his echoes hit at 80% and he moves 30% faster. Echo: 28.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 19,
  kit,
  model: 'models/heroes/chrono.glb',
  body: { radius: 0.41, height: 2.46 },
  shop: { kind: 'caster', shelf: 2 },
  icons: 'tempo',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Tempo | the Unwound Hour"',
    model: 'blender/heroes/real/chrono.py',
    design: 'pipeline/designs/kit-chrono.md',
  },
};

export default card;
