import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { F, icons, portrait } from './icons';

/**
 * Isolde, the Winter Warden: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/frost.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Isolde',
  title: 'the Winter Warden',
  accent: F.body,
  foil: F.rime,
  maxHp: 570,
  portrait,
  spells: [
    {
      key: 'Q', label: 'icicle', name: 'Icicle', range: 11, cooldown: 4, aim: 'line',
      blurb: 'Throws a piercing icicle (11 m): 42 and 2 Chill. It sticks in the floor where it ends for 2 s; recast to shatter it: 26 and 1 Chill within 2 m.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'hoarfrost', name: 'Hoarfrost', range: 8, cooldown: 9,
      blurb: 'Frost bites the enemy (8 m, needs sight): 36 and 2 Chill.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'rime armour', name: 'Rime Armour', range: 0, cooldown: 12, buff: { kind: 'armor', amount: 0.4, seconds: 3 },
      blurb: 'For 3 s: +40% armour, and every basic attack that hits her gives the attacker 2 Chill.',
      icon: icons.E,
    },
    {
      key: 'R', label: "winter's shatter", name: "Winter's Shatter", range: 9, cooldown: 22,
      blurb: 'Ultimate. Her fist closes on the enemy (9 m, needs sight). 0.8 s later the Chill shatters: 50 plus 30 per Chill (200 at 5), and the Chill is spent. It fizzles if sight is lost.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 2,
  kit,
  model: 'models/heroes/frost_v2.glb',
  body: { radius: 0.4, height: 2.84 },
  shop: { kind: 'controller', shelf: 0 },
  icons: 'isolde',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Isolde | the Winter Warden"',
    model: 'blender/heroes/real/frost.py',
    design: 'pipeline/designs/kit-frost.md',
  },
};

export default card;
