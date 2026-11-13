import type { FloorDef } from '../def';
import { harbour } from './harbour';

/** The floors that exist, by number. Floors 2 to 5 are each a data file here and a zone drawing (stage 2). */
export const FLOORS: Record<number, FloorDef> = { 1: harbour };
export const floorDef = (n: number) => FLOORS[n];
