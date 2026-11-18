/**
 * Kagen: its colours and every number of its kit, in one place (a DRAFT made by pipeline/tools/new-hero.py, 2026-11-18).
 * The card's tooltips, the spells' rules and the passive read them here: a number changed here changes its tooltip too.
 * Rule 4 (docs/pipeline/new-hero.md): a hero walks 4 m/s and reacts in 0.25 s; a circle warns for at least
 * 0.25 + radius / 4 seconds; a bolt reaches 6 m no sooner than 0.5 s; the ultimate never lands the moment it is cast.
 * The hero workbench (/workbench.html) changes them live, and lists what changed, to copy back here.
 */
export const C = { accent: '#cf4a1c', foil: '#ebe8e2', dark: '#14100c' };

/** The passive and the walk: Its Passive. */
export const P = { speed: 4 };

/** Q, First Spell (bolt): seconds, metres, damage. */
export const Q = { cooldown: 4, range: 10, windup: 0.25, speed: 20, radius: 0.3, damage: 52, knock: 1 };
/** W, Second Spell (circle): seconds, metres, damage. */
export const W = { cooldown: 10, range: 9, windup: 0, delay: 0.8, radius: 2.2, damage: 50, knock: 2 };
/** E, Third Spell (dash): seconds, metres, damage. */
export const E = { cooldown: 12, range: 6, width: 1.6, windup: 0.3, seconds: 0.4, damage: 40, knock: 2 };
/** R, Ultimate (circle): seconds, metres, damage. */
export const R = { cooldown: 24, range: 10, windup: 0, delay: 1.2, radius: 3.5, damage: 120, knock: 2 };
