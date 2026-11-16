/**
 * Anka's numbers, once: the four spells, the embers and her second life. The card (`hero.ts`) writes its blurbs from
 * them, the spells hit with them, the passive (`trait.ts`) keeps its embers by them. Change a number here and the tooltip
 * changes with it. Design: pipeline/designs/kit-phoenix.md; measured at gate 5 (docs/catalog/heroes/phoenix.md).
 */

export const EMBER_LIFE = 12;
export const MAX_EMBERS = 3;
export const STAMP_R = 1;
/** Seconds an enemy must stand on an ember to stamp it out, and the seconds a new ember is too hot to stamp at all. */
export const STAMP_S = 1.0;
export const EMBER_FRESH = 1.0;

/** Ember Quill (Q): damage, reach (m), speed (m/s), wind-up (s), the bolt's radius (m). */
export const QUILL_DAMAGE = 54;
export const QUILL_RANGE = 10;
export const QUILL_SPEED = 22;
export const QUILL_WIND = 0.3;
export const QUILL_RADIUS = 0.3;

/** Fan the Flames (W): the wait (s), each ring's radius (m), damage (once per cast, however many rings). */
export const FLARE_WIND = 0.8;
export const FLARE_RADIUS = 2.2;
export const FLARE_DAMAGE = 54;

/** Ember Flight (E): reach to the ember (m), seconds before she leaves, seconds in the air, the landing's radius and damage. */
export const FLIGHT_RANGE = 12;
export const FLIGHT_GO = 0.25;
export const FLIGHT_AIR = 0.45;
export const FLIGHT_RADIUS = 1.8;
export const FLIGHT_DAMAGE = 40;

/** Firebird (R): the wind-up (s), the lane's length and width (m), seconds in the air, damage. */
export const BIRD_WIND = 1.0;
export const BIRD_LENGTH = 12;
export const BIRD_WIDTH = 3;
export const BIRD_AIR = 0.5;
export const BIRD_DAMAGE = 120;

/** Ashborn: seconds as ash, the share of her HP she rises with, the flare's radius, damage and push. */
export const ASH_SECONDS = 1.2;
export const RISE_SHARE = 0.25;
export const RISE_RADIUS = 2.2;
export const RISE_DAMAGE = 40;
export const RISE_KNOCK = 8;
