import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Wick, the Doorwarden: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/door.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Wick',
  maxHp: 650,
  title: 'the Doorwarden',
  accent: S.brass,
  foil: S.red,
  portrait,
  spells: [
    {
      key: 'Q', label: 'key toss', name: 'Key Toss', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'A brass key (9 m): 88 damage. It flies into a door and out of its pair, going the same way, and through all four doors of the Grand Lobby.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'wick door', name: 'Door', range: 9, cooldown: 0.6,
      blurb: 'Two charges (4 s each). A door at a spot (9 m) for 10 s, 40 HP, two at a time with the same number. Anyone who walks into one leaves by the other, and so does a bolt, whoever shot it.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'door slam', name: 'Slam', range: 0, cooldown: 9, cc: true,
      blurb: 'Both doors slam: 70 damage and a 0.5 s stun on an enemy within 1.5 m of either door, after 0.7 s.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'grand lobby', name: 'Grand Lobby', range: 9, cooldown: 24,
      blurb: 'Four tall doors ring the enemy (3 m, 9 m, in sight) for 4 s. Walking into one sets you down at the far side of the ring, and his Q flies through them all. The gaps are 2 m.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 37,
  kit,
  model: 'models/heroes/door_v3.glb',
  body: { radius: 0.41, height: 2.37 },
  shop: { kind: 'controller', shelf: 3 },
  icons: 'wick',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Wick | the Doorwarden"',
  model: 'blender/heroes/real/door.py',
  design: 'pipeline/designs/kit-door.md',
};
