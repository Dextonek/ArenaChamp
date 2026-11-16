import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Silvane, the Mirror Duchess: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/mirror.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Silvane',
  maxHp: 620,
  title: 'the Mirror Duchess',
  accent: S.body,
  foil: S.violet,
  portrait,
  spells: [
    {
      key: 'Q', label: 'hand mirror', name: 'Hand Mirror', range: 10, cooldown: 3, aim: 'line', bank: true,
      blurb: 'A spinning hand mirror (10 m): 64 damage, +25% for each of up to three bounces. A mirror that lands after a bounce lies 2.5 s: walk within 1 m to catch it, and Hand Mirror is ready again.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'vanity stand', name: 'Vanity Stand', range: 8, cooldown: 12,
      blurb: 'A standing mirror at a spot (8 m) for 6 s, or until 60 damage breaks it. It blocks walking, sight and bolts, and her mirrors bounce off it. Whoever breaks it has Bad Luck: 15% less damage for 7 s.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'through the glass', name: 'Through the Glass', range: 9, cooldown: 10, dash: true, escape: true,
      blurb: 'Step into her Stand and out of the far side, up to 9 m in all. With no Stand, a 3 m step toward the aim.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'hall of mirrors', name: 'Hall of Mirrors', range: 0, cooldown: 22,
      blurb: 'She spins and throws eight mirrors outward in a ring (12 m): 60 damage each, bouncing twice. Stand in a gap. Up to four that land can be caught: each cuts 2 s off this spell.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 20,
  kit,
  model: 'models/heroes/mirror_v3.glb',
  body: { radius: 0.57, height: 2.34 },
  shop: { kind: 'caster', shelf: 3 },
  icons: 'silvane',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Silvane | the Mirror Duchess"',
    model: 'blender/heroes/real/mirror.py',
    design: 'pipeline/designs/kit-mirror.md',
  },
};

export default card;
