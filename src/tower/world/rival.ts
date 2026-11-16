import type { FloorDef } from './def';

/**
 * A floor's rival is a hero, and it can be the hero being played (the review of floors 31-50: Lyra met "I am Lyra" on floor 32 and
 * dueled a Lyra). When it is, the floor takes the next hero on a fixed list (the roster's own order, `names`) in its place: its figure,
 * its name in every line of the floor (the rival's words, its door, the boon it gives), its duel. Ids, places, packs and doors stay as
 * they are, so a saved run and the floor's layout do not change.
 */
export function rivalStandIn(rival: string, hero: string, names: readonly string[]): string {
  if (rival !== hero) return rival;
  const at = names.indexOf(rival);
  for (let k = 1; k < names.length; k++) {
    const next = names[(at + k + names.length) % names.length];
    if (next !== hero) return next;
  }
  return rival;
}

/** `text` with the hero's name `from` written as `to` (whole words: `Lyra’s gallery` too, `Lyrae` not). */
export function renamed(text: string, from: string, to: string): string {
  const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(^|[^\\p{L}])${esc}(?![\\p{L}])`, 'gu'), (_all, pre: string) => pre + to);
}

/** Keys whose strings are ids or names of things other than the rival: left as they are. */
const KEEP = new Set(['id', 'giver', 'piece', 'kind', 'look', 'figure', 'item', 'pack', 'packs', 'opens', 'quests', 'tunedAs']);

/** The floor as `hero` meets it: the same object when its rival is another hero. */
export function withRivalFor<T extends FloorDef>(def: T, hero: string, names: readonly string[]): T {
  const from = def.rival?.hero;
  if (!from || from !== hero) return def;
  const to = rivalStandIn(from, hero, names);
  if (to === from) return def;
  const walk = (v: unknown, key: string): unknown => {
    if (typeof v === 'string') return KEEP.has(key) ? v : key === 'hero' ? (v === from ? to : v) : renamed(v, from, to);
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  // The person who is the rival (and only that one: a keeper who borrows the rival's hero stays as it is).
  const people = def.people.map((p) => (p.role === 'rival' && p.hero === from ? (walk(p, '') as typeof p) : p));
  const { people: _p, arena, cover, ...rest } = def;
  return { ...(walk(rest, '') as Omit<T, 'people' | 'arena' | 'cover'>), arena, cover, people } as T;
}
