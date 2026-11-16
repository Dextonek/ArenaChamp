import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { F, icons, portrait } from './icons';

/**
 * Brannoc, the Ashen Smith: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/forge.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Brannoc',
  title: 'the Ashen Smith',
  maxHp: 780,
  melee: true,
  accent: F.body,
  foil: F.ash,
  portrait,
  spells: [
    {
      key: 'Q', label: 'chain hammer', name: 'Chain Hammer', range: 9, cooldown: 0.5, cc: true, aim: 'line',
      blurb: 'No cooldown, +40 Heat. Hurls a hammer on a chain 9 m down the aim: 19 damage cold, 39 white-hot, drags the first enemy it touches 4 m to him and slows them 1 s.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'forge roar', name: 'Forge Roar', range: 0, cooldown: 0.5,
      buff: { kind: 'armor', amount: 0.3, seconds: 3 },
      blurb: 'No cooldown, +30 Heat. For 3 s: +30% armour, and his next basic attack is a slam: +30 damage and a 0.5 s knock-up.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'red-hot rivet', name: 'Red-Hot Rivet', range: 6, cooldown: 0.5,
      blurb: 'No cooldown, +30 Heat. Flicks a rivet at an enemy in sight (6 m), which burns on for 2 s: 20 damage in all cold, 43 white-hot.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'molten core', name: 'Quench', range: 6, cooldown: 11, anytime: true,
      blurb: 'Spends all his Heat. He plants himself, a 3 m ring shows for 0.6 s, then it bursts for 30 plus 0.5 per point of Heat (80 at white heat) and throws them back. From white heat it also stuns 0.75 s. The only way out of white heat. Once in 11 s.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 1,
  kit,
  model: 'models/heroes/forge_v2.glb',
  body: { radius: 0.58, height: 2.35 },
  shop: { kind: 'vanguard', shelf: 0 },
  icons: 'brannoc',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Brannoc | the Ashen Smith"',
  model: 'blender/heroes/real/forge.py',
  design: 'pipeline/designs/kit-forge.md',
};
