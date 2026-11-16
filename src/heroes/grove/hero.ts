import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { G, icons, portrait } from './icons';

/**
 * Fenna, the Grove Warden: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/grove.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Fenna',
  title: 'the Grove Warden',
  accent: G.body,
  foil: G.bark,
  maxHp: 600,
  portrait,
  spells: [
    {
      key: 'Q', label: 'seed shot', name: 'Seed Shot', range: 9, cooldown: 4, aim: 'line',
      blurb: 'A seed flies 9 m (0.25 s wind-up): 64 damage. A flower grows where it stops, on the enemy or at the end of its flight.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'strangle vine', name: 'Strangle Vine', range: 7, cooldown: 11, cc: true,
      blurb: 'Vines (7 m, needs sight) coil round one enemy: 40 damage and rooted 1.0 s, or 1.4 s within 3 m of a flower.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'pollen glide', name: 'Pollen Glide', range: 6, cooldown: 12, dash: true, escape: true,
      blurb: 'She glides 6 m on a gust of pollen, and a flower grows where she lands. No heal of its own.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'world tree', name: 'World Tree', range: 9, cooldown: 24,
      blurb: 'A tree bursts up at a spot (9 m) after 1.2 s and stands 8 s: it blocks walking and bolts, roots an enemy within 3 m as it sprouts, and her flowers within 6 m heal 4 HP a second each instead of 3. Recast: Uproot, a 3 m burst of thorns after 0.6 s: 60.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 8,
  kit,
  model: 'models/heroes/grove.glb',
  body: { radius: 0.42, height: 2.55 },
  shop: { kind: 'support', shelf: 1 },
  icons: 'fenna',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Fenna | the Grove Warden"',
    model: 'blender/heroes/real/grove.py',
    design: 'pipeline/designs/kit-grove.md',
  },
};

export default card;
