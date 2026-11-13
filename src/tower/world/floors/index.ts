import type { FloorDef } from '../def';
import { banners } from './banners';
import { deep } from './deep';
import { canyon } from './canyon';
import { GEN_FLOORS } from './gen';
import { harbour } from './harbour';
import { wood } from './wood';

/**
 * The Climb: 50 floors in five chapters of ten (pipeline/designs/tower-50.md). Each chapter's first floor is handmade (a data file
 * here and a zone drawing), floors 2 to 9 of a chapter are made by the generator and baked (`gen/`), the tenth is a crown.
 */
export const TOP_FLOOR = 50;

/** The five chapters: their floors are `10 * i + 1` to `10 * i + 10`. */
export const CHAPTERS = [
  { id: 'sea', name: 'The Sea' },
  { id: 'wood', name: 'The Wood' },
  { id: 'sands', name: 'The Sands' },
  { id: 'deep', name: 'The Deep' },
  { id: 'war', name: 'The War' },
] as const;

/** The chapter (0-based) a floor is in. */
export const chapterOf = (n: number) => Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor((n - 1) / 10)));
/** Every tenth floor is a crown: a chapter's last, a boss alone. */
export const isCrown = (n: number) => n % 10 === 0;

/**
 * The floors that exist, by number. Floors not yet made are missing: the menu shows them as coming, and "the next floor" skips them
 * (`floorAbove`). The handmade floors were 1 to 5 before the Climb grew to 50 (saves are moved by `state.ts`).
 */
export const FLOORS: Record<number, FloorDef> = {
  1: harbour,
  ...Object.fromEntries(Object.entries(GEN_FLOORS).map(([n, g]) => [Number(n), g.floor])),
  11: wood,
  21: canyon,
  31: deep,
  41: banners,
};
export const floorDef = (n: number) => FLOORS[n];

/** The numbers of the floors that exist, lowest first. */
export const builtFloors = () => Object.keys(FLOORS).map(Number).filter((n) => FLOORS[n]).sort((a, b) => a - b);

/** The next floor above `n` that exists (after 10 comes 11; after 11 comes 21 until 12 is made), or null past the last. */
export function floorAbove(n: number): number | null {
  return builtFloors().find((k) => k > n) ?? null;
}

/** The highest floor that exists at or below `n` (1 if none: floor 1 always exists). */
export function floorAtOrBelow(n: number): number {
  let best = 1;
  for (const k of builtFloors()) if (k <= n) best = k;
  return best;
}
