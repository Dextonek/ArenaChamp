import type { Trait } from './types';
import { stormTrait } from './storm';
import { dawnTrait } from './dawn';
import { forgeTrait } from './forge';
import { hiveTrait } from './hive';
import { frostTrait } from './frost';
import { ledgerTrait } from './ledger';
import { weatherTrait } from './weather';
import { FOLDER_TRAITS } from '../heroes/traits';

export { TraitRuntime, type TraitHost } from './runtime';
export * from './types';

/**
 * Each hero's identity layer, by kit name (pipeline/designs/hero-identity.md). Heroes without one play as before. A hero in a
 * folder of its own (src/heroes/<theme>/trait.ts) is found by itself and added at the end.
 */
export const TRAITS: Record<string, Trait> = {
  Kaia: stormTrait,
  Auriel: dawnTrait,
  Brannoc: forgeTrait,
  Sirix: hiveTrait,
  Isolde: frostTrait,
  'Mr. Ledger': ledgerTrait,
  'Barry Cloudsley': weatherTrait,
  ...FOLDER_TRAITS,
};

export function traitFor(kitName: string): Trait | null {
  return TRAITS[kitName] ?? null;
}
