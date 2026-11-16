import type { HeroKit } from '../../heroes';
import type { HeroCard } from '../framework/card';
import { S, icons, portrait } from './icons';

/**
 * Cantor, the Last Verse: the card (found by the game by itself, src/heroes/index.ts). The kit as it was in src/kits/bard.ts,
 * its drawings in `icons.ts`; the passive in `trait.ts`, one file a spell in `spells/`, the look parts in `parts.ts`.
 */
const kit: HeroKit = {
  name: 'Cantor',
  title: 'the Last Verse',
  accent: S.body,
  foil: S.foil,
  maxHp: 720,
  portrait,
  spells: [
    {
      key: 'Q', label: 'resounding chord', name: 'Resounding Chord', range: 5, cooldown: 0.5,
      blurb: 'No cooldown. A chord in a 5 m cone: 22, and 9% more for each step of Crescendo. On the beat it adds a step; cast at 5 it hits for 32, silences 0.5 s and the Crescendo starts again. Off the beat: 6 damage and the Crescendo is gone.',
      icon: icons.Q,
    },
    {
      key: 'W', label: 'siren song', name: 'Siren Song', range: 8, cooldown: 0.5, cc: true,
      blurb: 'No cooldown. Spends the Crescendo: a note flies at the enemy (8 m, 10 m/s) and charms them 0.25 s for each step (1.25 s at 5): they walk toward him and cannot act. Off the beat it charms nobody. Cover breaks the note: step behind a pillar as it flies. An enemy that cannot be charmed (a raid boss) is struck instead: 36 for each step.',
      icon: icons.W,
    },
    {
      key: 'E', label: 'rising chorus', name: 'Rising Chorus', range: 0, cooldown: 0.5,
      blurb: 'No cooldown. Spends the Crescendo: a shield of 15 for each step (75 at 5) for 3 s, and +25% speed for 1.5 s. Off the beat it gives nothing.',
      icon: icons.E,
    },
    {
      key: 'R', label: 'duet', name: 'Duet', range: 0, cooldown: 11,
      blurb: 'A ring (6 m) closes round him in 0.8 s and holds 3.4 s: neither of you can leave it. Each beat it pulses for 18 (more with the Crescendo), and his clean spells inside it also silence 0.5 s. On the beat it adds a step. Cannot be cast while the enemy is charmed. Once in 11 s.',
      icon: icons.R,
    },
  ],
};

const card: HeroCard = {
  order: 15,
  kit,
  model: 'models/heroes/bard.glb',
  body: { radius: 0.39, height: 2.38 },
  shop: { kind: 'support', shelf: 0 },
  icons: 'cantor',
  pointers: {
    lore: 'docs/lore/LORE.md, the entry "Cantor | the Last Verse"',
    model: 'blender/heroes/real/bard.py',
    design: 'pipeline/designs/kit-bard.md',
  },
};

export default card;
