import type { EffectModule } from '../../effects/types';
import { burrowModule } from './burrow';
import { FOLDER_SPELLS } from '../../heroes/spells';

/**
 * The spells the game can play (src/game/main.ts registers these): every hero's, and the few a Raid boss or a Climb floor
 * casts by label (a ruler's 'burrow'). The tool page plays these and its showcases (index.ts, \`targetedModules\`).
 *
 * Kept out on purpose (docs/pipeline/hero-framework.md, "The start of the page"): the tool page's showcases, the spells of
 * heroes' earlier kits, and the test spells (src/kits/test.ts, a tool-page kit): no kit, passive, boss, floor or kept spell
 * names or imports them, so they were only weight in the game's first download. A spell a hero gets goes in its folder
 * (src/heroes/<theme>/fight.ts); one a boss or a floor casts by label goes here.
 */
export const gameModules: EffectModule[] = [
  burrowModule,
  // the heroes in folders of their own (src/heroes/<theme>/fight.ts)
  ...FOLDER_SPELLS,
];
