/**
 * The engine channel (pipeline/designs/heroes20-engine.md, "The engine channel"): the engine's own messages between the two
 * screens of a network duel, carried by the `stacks` relay the hub already has, so the hub needs no change. A message is
 * `stacks('#' + key + data, n)`: the hub cuts the name to 16 characters and holds `n` to a whole number 0..999. Data is
 * written in base 36: a coordinate in two characters (0.1 m over -64..+64 m), a clock in three (0.01 s up to 466 s), a small
 * count in one. A side is written as the sender sees it: `S` the sender's hero, `R` the receiver's.
 */

export const PREFIX = '#';
export const NAME_MAX = 16;

const pad = (s: string, n: number) => (s.length >= n ? s.slice(-n) : '0'.repeat(n - s.length) + s);

/** A coordinate (m) in two base-36 characters, 0.1 m steps over -64..+64. */
export const encPos = (v: number) => pad(Math.max(0, Math.min(1295, Math.round((v + 64) * 10))).toString(36), 2);
export const decPos = (s: string) => parseInt(s, 36) / 10 - 64;

/** A clock (s) in three base-36 characters, 0.01 s steps up to 466 s. */
export const encTime = (t: number) => pad(Math.max(0, Math.min(46655, Math.round(t * 100))).toString(36), 3);
export const decTime = (s: string) => parseInt(s, 36) / 100;

/** A count 0..35 in one character. */
export const encDigit = (n: number) => Math.max(0, Math.min(35, Math.round(n))).toString(36);
export const decDigit = (s: string) => parseInt(s, 36);

/** A message's name, checked to fit the hub's cut. */
export function msgName(key: string, data: string) {
  const name = PREFIX + key + data;
  if (name.length > NAME_MAX) throw new Error(`engine message too long: ${name}`);
  return name;
}

/** A value 0..999 as the hub holds it. */
export const msgN = (n: number) => Math.max(0, Math.min(999, Math.round(n)));
