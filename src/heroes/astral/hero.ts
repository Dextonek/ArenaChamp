import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { A, icons, portrait } from './icons';

/**
 * Lyra, the Star Archer: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/astral.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Lyra',
  maxHp: 520,
  title: 'the Star Archer',
  accent: A.hot,
  foil: A.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'starfall arrow', name: 'Starfall Arrow', range: 14, cooldown: 4, aim: 'line',
      blurb: 'Hold to draw for up to 1 s: the range grows from 9 to 14 m and the damage from 29 to 58. At full draw the arrow pierces, and a full-draw hit takes 3 s off Pinning Arrow.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'twin stars', name: 'Twin Stars', range: 0, cooldown: 14,
      buff: { kind: 'haste', amount: 0.2, seconds: 5 },
      blurb: 'For 5 s her basic attacks loose two arrows, the second at half damage, and she moves 20% faster.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'pinning arrow', name: 'Pinning Arrow', range: 9, cooldown: 9, aim: 'line', cc: true,
      blurb: 'An arrow (9 m, 0.3 s wind-up): 35. Within 1.5 m of a wall or pillar the enemy is pinned (rooted 1.5 s); anywhere else they are 40% slower for 1.5 s.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'meteor mark', name: 'Meteor Mark', range: 14, cooldown: 24,
      blurb: 'Ultimate. A star locks onto the enemy (14 m) and follows for 1.5 s, then fixes on their spot; 0.9 s later a meteor strikes it (1.8 m): 120 plus 25% of what she dealt meanwhile.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 3,
  kit,
  model: 'models/heroes/astral.glb',
  body: { radius: 0.38, height: 2.38 },
  shop: { kind: 'caster', shelf: 0 },
  icons: 'lyra',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Lyra | the Star Archer"',
    model: 'blender/heroes/real/astral.py',
    design: 'pipeline/designs/kit-astral.md',
  },
};

export default card;
