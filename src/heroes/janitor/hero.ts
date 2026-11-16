import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Gus, the Temple Keeper: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/janitor.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Gus',
  maxHp: 700,
  melee: true,
  title: 'the Temple Keeper',
  accent: S.yellow,
  foil: S.deep,
  portrait,
  spells: [
    {
      key: 'Q', label: 'big mop', name: 'Big Mop', range: 3.5, cooldown: 3.5,
      blurb: 'A mop swipe in front of him (3.5 m, 0.3 s): 60 damage, and a strip of wet floor 6 m long. It wipes your rods, flowers and ink along the strip.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'wet floor sign', name: 'Wet Floor Sign', range: 8, cooldown: 0.8, summon: true,
      blurb: 'A folding sign at a spot (8 m) for 6 s, a real obstacle with 40 health. A hero who slides into it takes 40 and is stunned 0.6 s. Two charges, one back every 8 s.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'mop bucket', name: 'Mop Bucket', range: 8, cooldown: 10, aim: 'line',
      blurb: 'He throws the wheeled bucket (8 m, 0.3 s wind-up): 55 damage, and the floor 2.5 m round where it stops is wet.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'flood', name: 'Flood', range: 0, cooldown: 24,
      blurb: 'After a 1 s warning the whole floor within 7 m of him is wet for 5 s. He surfs on it: +35% speed. Stand near cover, which stops a slide, or walk straight lines.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 31,
  kit,
  model: 'models/heroes/janitor_v3.glb',
  body: { radius: 0.55, height: 2.39 },
  shop: { kind: 'controller', shelf: 1 },
  icons: 'gus',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Gus | the Temple Keeper"',
  model: 'blender/heroes/real/janitor.py',
  design: 'pipeline/designs/kit-janitor.md',
};
