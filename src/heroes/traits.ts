import type { Trait } from '../traits/types';
import { CARD_BY_FOLDER } from './index';

/** The passives of the heroes in folders (`src/heroes/<theme>/trait.ts`, its default export), by hero name: src/traits/index.ts adds them to `TRAITS`. */
const found = import.meta.glob<Trait>('./*/trait.ts', { eager: true, import: 'default' });

export const FOLDER_TRAITS: Record<string, Trait> = Object.fromEntries(
  Object.entries(found).map(([path, trait]) => [CARD_BY_FOLDER[path.split('/')[1]].kit.name, trait]),
);
