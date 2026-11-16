import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { B, icons, portrait } from './icons';

/**
 * Vesper, the Crimson Countess: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/blood.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Vesper',
  title: 'the Crimson Countess',
  maxHp: 640,
  accent: B.hot,
  foil: B.bone,
  portrait,
  spells: [
    {
      key: 'Q', label: 'lancet', name: 'Lancet', range: 7, cooldown: 0.5,
      blurb: 'Costs the Price. A blood needle (7 m): 30 damage, and it stays in for 3 s. From 0.6 s on, cast again to rip it out: 22 more, half the needle\'s price back, and Lancet is ready again at once. The Rip costs nothing but raises the Price. Only while she sees them within 8 m; a needle left in is lost.',
      icon: icons.Q,
    },
    {
      // The flow itself is 5 m. The duel AI uses it as a getaway (`escape`): away from an enemy who comes within 3.5 m.
      key: 'W', label: 'mist waltz', name: 'Mist Waltz', range: 11, cooldown: 0.5, dash: true, escape: true,
      blurb: 'Costs the Price, no cooldown. She flows 5 m as mist. Her next two basic attacks within 3 s reach 1.5 m farther and deal +18.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'hemocurse', name: 'Hemocurse', range: 7, cooldown: 0.5,
      blurb: 'Costs the Price, no cooldown. A curse (7 m): 25 damage, for 3 s. Each spell the enemy casts costs them 15 HP, and if she is Hungry she heals 20. It breaks at 8 m or without sight.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'sanguine feast', name: 'Sanguine Feast', range: 8, cooldown: 11,
      blurb: 'Costs twice the Price, once in 11 s. She roots herself and drinks (8 m) for 1.6 s: pulses of 15, 15, then 20 plus 15% of their missing HP, and 45 HP back. A stun or silence, cover, or 9 m of distance ends it.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 0,
  kit,
  model: 'models/heroes/blood_v2.glb',
  body: { radius: 0.41, height: 2.35 },
  shop: { kind: 'vanguard', shelf: 2 },
  icons: 'vesper',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Vesper | the Crimson Countess"',
    model: 'blender/heroes/real/blood.py',
    design: 'pipeline/designs/kit-blood.md',
  },
};

export default card;
