/**
 * Kagen: his colours and every number of his kit, in one place. The card's tooltips, the spells' rules and the passive read
 * them here: a number changed here changes its tooltip too. Design and the arithmetic of every answer:
 * pipeline/designs/kit-sheath.md (gate 3, agreed 2026-11-19).
 * Rule 4 (docs/pipeline/new-hero.md): a hero walks 4 m/s and reacts in 0.25 s; a circle warns for at least
 * 0.25 + radius / 4 seconds; the ultimate never lands the moment it is cast.
 * The hero workbench (/workbench.html) changes them live, and lists what changed, to copy back here.
 */
export const C = {
  /** Cinnabar: the sash, the sheath, the cuts. */
  accent: '#cf4a1c',
  /** Rice paper: the seals, the foil of every cut. */
  foil: '#ebe8e2',
  /** Black lacquer. */
  dark: '#14100c',
  /** The steel's flash. */
  steel: '#f4f1ea',
  gold: '#e0b45a',
};

/** The walk, the sword, and the passive Scarlet Sheath: cut marks. */
export const P = {
  hp: 640,
  speed: 4.4,
  /** The basic attack: melee reach (m), damage, seconds between blows, wind-up (s). Each blow that lands leaves a mark. */
  reach: 2.6,
  attack: 9,
  interval: 0.85,
  attackWind: 0.25,
  /** Marks: at most, seconds they last after his latest cut, damage each when they open, the slow when all four open. */
  maxMarks: 4,
  markLife: 5,
  markDamage: 24,
  slowSeconds: 1,
};

/** Q, Issen (One Flash): a dash down a lane. Seconds, metres, damage. */
export const Q = { cooldown: 6, range: 6, width: 1.2, windup: 0.45, seconds: 0.15, damage: 32, knock: 0 };
/** W, Noto (The Click): the ring round him (m), its wind-up (s), the parry after the click (s). */
export const W = { cooldown: 7, radius: 3.5, windup: 0.5, parry: 0.4 };
/** E, Senbon (Thousand Swords): reach, the ring, its warning, the waves (seconds after the cast), damage a wave. */
export const E = { cooldown: 11, range: 8, radius: 3, warn: 1.0, waves: [1.0, 1.4, 1.8] as readonly number[], damage: 10, knock: 0 };
/** R, Sekai-giri (World Sever): the line, the still second, damage on the line, what each mark opens for then. */
export const R = { cooldown: 26, range: 12, width: 2.4, windup: 1.3, damage: 110, knock: 2, markDamage: 36 };
