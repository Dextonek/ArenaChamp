import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { H, icons, portrait } from './icons';

/**
 * Sirix, the Swarm Warden: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/hive.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Sirix',
  title: 'the Swarm Warden',
  accent: H.body,
  foil: H.wax,
  maxHp: 640,
  melee: true,
  portrait,
  spells: [
    {
      key: 'Q', label: 'barbed stinger', name: 'Barbed Stinger', range: 8, cooldown: 6, aim: 'line',
      blurb: 'A stinger flies 8 m: 42, and the barb stays on them for 3 s. Cast it again within 3 s to leap onto the barbed enemy: 25, and with 2 wasps spent it poisons them for 30 over 3 s.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'hive shell', name: 'Hive Shell', range: 0, cooldown: 10, buff: { kind: 'armor', amount: 0.4, seconds: 3 },
      blurb: 'Chitin plates close round him: 40% less damage for 3 s. Each hit he takes spends a wasp, which stings the attacker for 15.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'swarm cloud', name: 'Swarm Cloud', range: 9, cooldown: 9,
      blurb: 'All his wasps fly to a spot 9 m away and hang there for 3 s as a cloud: from 1 s, 7 damage per wasp each second to everyone inside, and blinded. They come back when it ends.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'swarm surge', name: 'Swarm Surge', range: 10, cooldown: 22, aim: 'line',
      blurb: 'Ultimate. He looses every wasp down a 10 m column, 4 m wide: 18 per wasp, shoves 4 m and blinds 1 s. The swarm does not come back: he is a plain fighter afterwards.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 14,
  kit,
  model: 'models/heroes/hive.glb',
  body: { radius: 0.44, height: 2.31 },
  shop: { kind: 'fighter', shelf: 0 },
  icons: 'sirix',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Sirix | the Swarm Warden"',
  model: 'blender/heroes/real/hive.py',
  design: 'pipeline/designs/kit-hive.md',
};
