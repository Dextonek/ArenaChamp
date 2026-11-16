import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Opaline, the Lightbreaker: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/prism.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Opaline',
  maxHp: 600,
  title: 'the Lightbreaker',
  accent: S.body,
  foil: S.foil,
  portrait,
  spells: [
    {
      key: 'Q', label: 'ricochet light', name: 'Ricochet Light', range: 12, cooldown: 3, aim: 'line', bank: true,
      blurb: 'A bolt of light (12 m) that bounces off up to two walls, pillars or crystals: 64 damage, +25% for each bounce. A hit after bouncing takes 1 s per bounce off this spell.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'crystal pillar', name: 'Crystal', range: 8, cooldown: 12,
      blurb: 'A crystal rises at a spot (8 m) for 6 s, or until 80 damage breaks it. It blocks walking, sight and bolts for both of you, and her bolts bounce off it.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'blinding flare', name: 'Blinding Flare', range: 0, cooldown: 10, cc: true,
      blurb: 'A flash of light (3 m) round her: enemies in it are blinded for 1.5 s and pushed 2 m away.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'shatterlight', name: 'Shatterlight', range: 10, cooldown: 22,
      blurb: 'Click an enemy (10 m, in sight). Six shards ring the spot they stand on and, after 1.2 s, each fires inward through it: 36 damage each, and each bounces once off a wall. Step out of the ring to dodge.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 16,
  kit,
  model: 'models/heroes/prism.glb',
  body: { radius: 0.4, height: 2.46 },
  shop: { kind: 'caster', shelf: 2 },
  icons: 'opaline',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Opaline | the Lightbreaker"',
    model: 'blender/heroes/real/prism.py',
    design: 'pipeline/designs/kit-prism.md',
  },
};

export default card;
