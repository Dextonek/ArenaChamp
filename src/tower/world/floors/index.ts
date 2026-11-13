import type { FloorDef } from '../def';
import { canyon } from './canyon';
import { harbour } from './harbour';
import { wood } from './wood';

/** The floors that exist, by number. Floors 2 to 5 are each a data file here and a zone drawing (stage 2). */
export const FLOORS: Record<number, FloorDef> = { 1: harbour, 2: wood, 3: canyon };
export const floorDef = (n: number) => FLOORS[n];
