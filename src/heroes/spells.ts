import type { EffectModule } from '../effects/types';
import { CARD_BY_FOLDER } from './index';

/**
 * The spells of the heroes in folders (`src/heroes/<theme>/fight.ts`, its `spells`), in the roster's order: the game's list
 * of spells (src/spells/targeted/game.ts) adds them. Loaded with the page for now; the design's next step loads a hero's
 * `fight.ts` for the fight it is in (docs/pipeline/hero-framework.md, "The start of the page").
 */
const found = import.meta.glob<EffectModule[]>('./*/fight.ts', { eager: true, import: 'spells' });

export const FOLDER_SPELLS: EffectModule[] = Object.entries(found)
  .map(([path, spells]) => ({ order: CARD_BY_FOLDER[path.split('/')[1]].order, spells }))
  .sort((a, b) => a.order - b.order)
  .flatMap((h) => h.spells);
