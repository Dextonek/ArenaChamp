import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Ada, the Artificer: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/clockwork.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Ada',
  title: 'the Artificer',
  accent: S.body,
  foil: S.foil,
  maxHp: 550,
  portrait,
  spells: [
    {
      key: 'Q', label: 'homing drone', name: 'Homing Drone', range: 8, cooldown: 4,
      blurb: 'Click an enemy within 8 m. A drone flies out and always hits: 45. It tags them for 3 s, and her turrets deal 30% more to a tagged enemy. Needs sight.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'deploy turret', name: 'Deploy Turret', range: 8, cooldown: 10, summon: true,
      blurb: 'Two charges, one back every 10 s. A turret at a spot within 8 m for 8 s: 80 HP, 9 damage every 1.4 s, range 8. Within 5 m of her it shoots 30% faster and glows.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'grapple hook', name: 'Grapple', range: 9, cooldown: 10, aim: 'line',
      blurb: 'A hook (9 m, 0.25 s wind-up). On an enemy: 30 and slowed 1 s, she stays put. On a wall, pillar or her own turret she reels herself to it. It cannot pull the enemy.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'siege mode', name: 'Siege Mode', range: 9, cooldown: 24,
      blurb: 'She braces for 6 s, rooted, +20% armour. Turrets within 8 m of her fire twice as fast, and she fires heavy rounds (23 every 0.8 s) at an enemy within 9 m she can see. A stun, silence or knock-up ends it. Recast: pack up.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 13,
  kit,
  model: 'models/heroes/clockwork.glb',
  body: { radius: 0.39, height: 2.29 },
  shop: { kind: 'support', shelf: 3 },
  icons: 'ada',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Ada | the Artificer"',
    model: 'blender/heroes/real/clockwork.py',
    design: 'pipeline/designs/kit-clockwork.md',
  },
};

export default card;
