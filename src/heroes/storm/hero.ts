import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Kaia, the Tempest Caller: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/storm.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Kaia',
  title: 'the Tempest Caller',
  maxHp: 580,
  accent: S.body,
  foil: S.rain,
  portrait,
  spells: [
    {
      key: 'Q', label: 'sky strike', name: 'Sky Strike', range: 7, cooldown: 4,
      blurb: 'A strike falls on an enemy in sight (7 m) 0.35 s later: 60, and a rod stands 1.5 m in front of them, toward her. Rods within 5 m of them arc for 18.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'thunder rod', name: 'Thunder Rod', range: 9, cooldown: 9,
      blurb: 'A great rod at a spot (9 m) for 3 s. From 1.2 s, each second: enemies within 3.5 m take 24 and are slowed. Cast again from 1.2 s to fire it once for 50 and end it.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'polarity', name: 'Polarity', range: 8, cooldown: 11, cc: true,
      blurb: 'Magnetises an enemy in sight (8 m): 20, then after 1 s they are yanked 3 m toward her nearest rod (her, with none). Ending within 1 m of the rod: stunned 0.6 s.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'supercell storm', name: 'Supercell', range: 0, cooldown: 24,
      blurb: 'A storm over her for 6 s. Every 0.8 s, if the enemy is within 7 m of her or 3 m of a rod, a bolt marks their spot (1.2 m) and falls 0.6 s later: 32. Rods arc as normal.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 5,
  kit,
  model: 'models/heroes/storm_v2.glb',
  body: { radius: 0.47, height: 3.24 },
  shop: { kind: 'caster', shelf: 0 },
  icons: 'kaia',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Kaia | the Tempest Caller"',
    model: 'blender/heroes/real/storm.py',
    design: 'pipeline/designs/kit-storm.md',
  },
};

export default card;
