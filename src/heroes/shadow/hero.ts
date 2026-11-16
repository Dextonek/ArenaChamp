import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Nyx, the Umbral Stalker: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/shadow.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Nyx',
  maxHp: 680,
  melee: true,
  title: 'the Umbral Stalker',
  accent: S.hot,
  foil: S.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'umbral cut', name: 'Umbral Cut', range: 2.5, cooldown: 4,
      blurb: 'Click an enemy within 2.5 m. After 0.35 s a dagger strike lands on where it stands (within 3.2 m): 58, 93 from behind (its back 120 degrees).',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'smoke veil', name: 'Smoke Veil', range: 0, cooldown: 12,
      blurb: 'A 3 m cloud of dark smoke at her feet for 3 s. Inside it she counts as faded even mid-fight, and an enemy inside is blinded.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'shadow double', name: 'Shadow Double', range: 4, cooldown: 10, dash: true, summon: true,
      blurb: 'She darts 4 m, through cover if it is in the way. A shadow copy (40 HP, 2.5 s, 15 per 0.9 s) stays where she stood and walks at the enemy.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'nightfall', name: 'Nightfall', range: 0, cooldown: 24,
      blurb: 'For 5 s the arena darkens. She moves 25% faster and deals 20% more, and fades again 0.8 s after each hit she lands. When it ends she is slowed for 1 s.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 7,
  kit,
  model: 'models/heroes/shadow.glb',
  body: { radius: 0.4, height: 2.32 },
  shop: { kind: 'assassin', shelf: 0 },
  icons: 'nyx',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Nyx | the Umbral Stalker"',
  model: 'blender/heroes/real/shadow.py',
  design: 'pipeline/designs/kit-shadow.md',
};
