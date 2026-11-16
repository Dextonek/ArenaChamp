import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { A, icons, portrait } from './icons';

/**
 * Vitriol, the Plague Alchemist: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/alchemy.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Vitriol',
  title: 'the Plague Alchemist',
  maxHp: 510,
  accent: A.body,
  foil: A.glass,
  portrait,
  spells: [
    {
      key: 'Q', label: 'toxin dart', name: 'Toxin Dart', range: 9, cooldown: 3, aim: 'line',
      blurb: 'A fast glass dart (9 m): 20, then 25 more over 3 s. Leaves green toxin on the enemy for 4 s. Reaches 6 m in about half a second: step off the line.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'fire vial', name: 'Fire Vial', range: 7, cooldown: 6,
      blurb: 'A vial of fire that cannot miss (7 m, needs sight): 18, then 25 more over 2 s. Leaves orange fire on the enemy for 4 s.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'acid splash', name: 'Acid Splash', range: 4, cooldown: 8,
      blurb: 'A 4 m cone of violet acid in front of her: 40 and a shove back. Leaves violet acid on the enemy for 4 s. Her answer to being rushed.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'homunculus', name: 'Homunculus', range: 10, cooldown: 25, summon: true,
      blurb: 'Ultimate. A little walking bomb (120 HP, 4 m/s) climbs out at her feet with all three reagents in its belly and walks at the enemy. It bursts on the enemy for 55 and sets off every reaction at once. Shoot it down or outrun it.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 4,
  kit,
  model: 'models/heroes/alchemy.glb',
  body: { radius: 0.43, height: 2.37 },
  shop: { kind: 'caster', shelf: 2 },
  icons: 'vitriol',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Vitriol | the Plague Alchemist"',
    model: 'blender/heroes/real/alchemy.py',
    design: 'pipeline/designs/kit-alchemy.md',
  },
};

export default card;
