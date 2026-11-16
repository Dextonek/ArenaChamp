import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Shiori, the Last Brush: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/ink.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Shiori',
  title: 'the Last Brush',
  accent: S.body,
  foil: S.foil,
  maxHp: 600,
  portrait,
  spells: [
    {
      key: 'Q', label: 'ink lash', name: 'Ink Lash', range: 9, cooldown: 4, aim: 'line',
      blurb: 'A lash of ink (9 m): 66, and a stroke along its path that stays 5 s. Standing on ink slows and Stains. Where strokes cross, a point bursts for 40.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'seal of binding', name: 'Seal of Binding', range: 8, cooldown: 10,
      blurb: 'Stamps a 2 m seal (8 m), armed after 0.5 s, for 6 s. An enemy who steps in is rooted 1 s and Stained. Once armed it counts as a stroke for crossings.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'flowing script', name: 'Flowing Script', range: 6, cooldown: 11, dash: true, escape: true,
      blurb: 'Glides 6 m and paints a stroke along her path. Do not follow her down the line.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'the last character', name: 'The Last Character', range: 9, cooldown: 22, cc: true,
      blurb: 'Ultimate. Writes one great character (9 m, 4 m wide) in 1.0 s: 40 and rooted 1 s inside it. Every stroke of hers under the enemy erupts for 50, 3 at most, and vanishes.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 18,
  kit,
  model: 'models/heroes/ink.glb',
  body: { radius: 0.43, height: 2.3 },
  shop: { kind: 'support', shelf: 3 },
  icons: 'shiori',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Shiori | the Last Brush"',
    model: 'blender/heroes/real/ink.py',
    design: 'pipeline/designs/kit-ink.md',
  },
};

export default card;
