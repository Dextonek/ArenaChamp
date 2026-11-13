import type { FloorDef } from '../def';
import { banners } from './banners';
import { deep } from './deep';
import { harbour } from './harbour';

/** The floors that exist, by number. Floors 2 to 5 are each a data file here and a zone drawing (stage 2). */
export const FLOORS: Record<number, FloorDef> = { 1: harbour, 4: deep, 5: banners };
export const floorDef = (n: number) => FLOORS[n];
