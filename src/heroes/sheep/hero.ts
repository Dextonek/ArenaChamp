import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Bo, the Ramherd: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/sheep.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Bo',
  title: 'the Ramherd',
  accent: S.accent,
  foil: S.wood,
  maxHp: 640,
  portrait,
  spells: [
    {
      key: 'Q', label: 'crook whack', name: 'Crook Whack', range: 4, cooldown: 3.5,
      blurb: 'He shakes his crook, then whacks a 4 m cone: 58 damage, and a sheep at the feet of whoever he hits. Stay out of 4 m.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'spare sheep', name: 'Spare Sheep', range: 8, cooldown: 8, summon: true,
      blurb: 'Three sheep land at a spot (8 m) for 6 s: 30 HP each. They walk to whoever is nearest, him or you, and each touch adds Wool. Six units a side at most.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'shear', name: 'Shear', range: 8, cooldown: 11, aim: 'line',
      blurb: 'Needs a sheep within 6 m: he shears it, it runs on naked and fast, and he throws the wool (8 m): 50 damage and 3 Wool.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'stampede', name: 'Stampede', range: 12, cooldown: 22,
      blurb: 'Eight sheep run down a 12 m line, 4 m wide, after 0.8 s: 30 each, three hits at most, and each hit adds Wool. Step out of the line.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 35,
  kit,
  model: 'models/heroes/sheep_v3.glb',
  body: { radius: 0.42, height: 2.4 },
  shop: { kind: 'support', shelf: 2 },
  icons: 'bo',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Bo | the Ramherd"',
  model: 'blender/heroes/real/sheep.py',
  design: 'pipeline/designs/kit-sheep.md',
};
