import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Mortis, the Ossuary Lord: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/bone.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Mortis',
  title: 'the Ossuary Lord',
  accent: S.body,
  foil: S.bone,
  maxHp: 450,
  portrait,
  spells: [
    {
      key: 'Q', label: 'bone fan', name: 'Bone Fan', range: 8, cooldown: 5, aim: 'line',
      blurb: 'Flicks three thin bone shards in a fan, 18 degrees apart (31 each, 8 m). Every bone pile within 3 m of him throws one more (six at most), and the fan widens. Stand between two shards past 5 m.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'raise dead', name: 'Raise Dead', range: 9, cooldown: 9, summon: true,
      blurb: 'A skeleton claws out of the ground at the spot, and one more for every bone pile within 4 m of it (three more at most).',
      icon: icons.W,
    },
    {
      key: 'E', label: 'bone armour', name: 'Bone Armour', range: 0, cooldown: 14,
      blurb: 'A cage of ribs closes round him: a shield of 30, plus 30 per living skeleton (120 at most), for 4 s. When it breaks, or at 3.5 s, its shards fly at the enemy for 38. Recast (from 0.3 s, within 4 s): Shatter it now and the shards fly at once.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'grave grasp', name: 'Grave Grasp', range: 9, cooldown: 22, cc: true,
      blurb: 'Ultimate. Click the enemy (needs line of sight): a hand rises where it stood, a 1.6 m ring shown for 0.7 s. If it is still inside, the hand drags it 4 m toward him (55 damage), roots it for 1 s, and two skeletons claw out beside it (28 damage more). If it stepped out, the hand closes on nothing.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 12,
  kit,
  model: 'models/heroes/bone.glb',
  body: { radius: 0.44, height: 2.51 },
  shop: { kind: 'support', shelf: 2 },
  icons: 'mortis',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Mortis | the Ossuary Lord"',
  model: 'blender/heroes/real/bone.py',
  design: 'pipeline/designs/kit-bone.md',
};
