import type { Trait } from '../traits/types';
import { rTiming } from '../../server/protocol.mjs';
import { CARD_BY_FOLDER } from './index';

/** The passives of the heroes in folders (`src/heroes/<theme>/trait.ts`, its default export), by hero name: src/traits/index.ts adds them to `TRAITS`. */
const found = import.meta.glob<Trait>('./*/trait.ts', { eager: true, import: 'default' });

export const FOLDER_TRAITS: Record<string, Trait> = Object.fromEntries(
  Object.entries(found).map(([path, trait]) => [CARD_BY_FOLDER[path.split('/')[1]].kit.name, trait]),
);

// A recast of R that plays an effect is a second R cast for the hub, let through only within its `recastMs` of the first.
if (import.meta.env.DEV) {
  for (const [name, trait] of Object.entries(FOLDER_TRAITS)) {
    const specs = trait.recast ? (Array.isArray(trait.recast) ? trait.recast : [trait.recast]) : [];
    const late = specs.find((r) => r.slot === 3 && r.replay !== false && r.window * 1000 > rTiming(name).recastMs);
    if (late) console.error(`${name}: R's recast is open ${late.window} s, but the hub lets it through only within ${rTiming(name).recastMs / 1000} s (R_TIMING in server/protocol.mjs)`);
  }
}
