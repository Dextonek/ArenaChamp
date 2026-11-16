import type { Trait } from './types';
import { FOLDER_TRAITS } from '../heroes/traits';

export { TraitRuntime, type TraitHost } from './runtime';
export * from './types';

/**
 * Each hero's identity layer, by kit name (pipeline/designs/hero-identity.md): its folder's src/heroes/<theme>/trait.ts,
 * found by itself. Heroes without one play as before.
 */
export const TRAITS: Record<string, Trait> = { ...FOLDER_TRAITS };

export function traitFor(kitName: string): Trait | null {
  return TRAITS[kitName] ?? null;
}
