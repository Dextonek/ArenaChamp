import type { HeroKit } from '../../heroes';
import type { HeroCard, HeroPointers } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Marin, the Tide Dancer: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/tide.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Marin',
  title: 'the Tide Dancer',
  accent: S.body,
  foil: S.foam,
  maxHp: 610,
  portrait,
  spells: [
    {
      key: 'Q', label: 'wave disc', name: 'Wave Disc', range: 9, cooldown: 4, aim: 'line',
      blurb: 'Throws a spinning disc of water 9 m down the aim (0.3 s wind-up, fast): 52 damage. High tide: it knocks the enemy back 2.5 m. Low tide: it pulls the enemy 2.5 m toward her.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'coral spire', name: 'Coral Spire', range: 8, cooldown: 9,
      blurb: 'A coral pillar rises at a spot (8 m) after 0.9 s and stands for 5 s as a real obstacle. As it rises, the enemy within 2.5 m is hit for 44: High tide shoves it 3 m away, Low tide drags it 2 m to the pillar.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'mist form', name: 'Mist Form', range: 6, cooldown: 10, dash: true, parry: true,
      blurb: 'She turns to water and flows up to 6 m to the aim, through the enemy if it is in the way: untouchable for the 0.25 s of the run. She reforms at the end spot in a splash (40 damage within 3 m) and the tide flips.',
      icon: icons.E,
    },
    {
      key: 'R', label: "moon's pull", name: "Moon's Pull", range: 12, cooldown: 22,
      blurb: "Ultimate. She roots herself under a moon for 3 s (a stun, silence or knock-up ends it). The tide is held at Low and her pulls are doubled; an enemy within 12 m she can see is dragged toward her at 2.4 m/s for 24 damage a second, and a 110 tide crash lands if it is within 2.5 m when the moon sets.",
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 10,
  kit,
  model: 'models/heroes/tide.glb',
  body: { radius: 0.43, height: 2.29 },
  shop: { kind: 'controller', shelf: 2 },
  icons: 'marin',
};

export default card;

/** Where the rest of the hero lives (for people and tools; the game does not load it). */
export const pointers: HeroPointers = {
  lore: 'docs/lore/LORE.md, the entry "Marin | the Tide Dancer"',
  model: 'blender/heroes/real/tide.py',
  design: 'pipeline/designs/kit-tide.md',
};
