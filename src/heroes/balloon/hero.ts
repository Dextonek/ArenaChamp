import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Professor Puff, the Aeronaut: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/balloon.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Professor Puff',
  maxHp: 580,
  title: 'the Aeronaut',
  accent: S.body,
  foil: S.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'air hose', name: 'Air Hose', range: 8, cooldown: 3.5, aim: 'line',
      blurb: 'A jet of air (8 m, 22 m/s, 0.3 s wind-up): 60 damage, 3 Air and a 1 m push. Each Air pushes it 8% farther.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'helium bomb', name: 'Helium Bomb', range: 9, cooldown: 9,
      blurb: 'A balloon floats to a spot (9 m) and pops after 1.0 s: 50 damage and 3 Air to everyone within 2.5 m.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'hot air', name: 'Hot Air', range: 9, cooldown: 10,
      blurb: 'He inflates and floats 6 m away from the spot you aim at. Anyone within 2.5 m of where he left is pushed 3 m.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'pop!', name: 'Pop!', range: 9, cooldown: 22,
      blurb: 'A pin flies at you (9 m, 0.6 s, it needs sight when it lands): 60 damage plus 20 per Air, and all your Air goes out in a 3 m shove.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 23,
  kit,
  model: 'models/heroes/balloon_v3.glb',
  body: { radius: 0.54, height: 2.43 },
  shop: { kind: 'caster', shelf: 1 },
  icons: 'professor-puff',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Professor Puff | the Aeronaut"',
  model: 'blender/heroes/real/balloon.py',
  design: 'pipeline/designs/kit-balloon.md',
};
