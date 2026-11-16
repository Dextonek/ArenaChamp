import type { FloorDef, PersonDef } from './def';

/**
 * The Climb's own people (the user, 2026-11-14: "make new models for npc, don't reuse them from heroes"): five a chapter, built in
 * Blender as the heroes are (blender/tower/<chapter>/<name>.py, docs/tower/models/README.md) and drawn from
 * public/models/tower/<id>_v4.glb. In each chapter the keeper is the same person on all ten floors; the quest giver at the camp
 * (`giver`) and the one out in the land (`village`: the generator's `villager`, or the War's `healer`) each have a person of their
 * own, because their lines are theirs (the Sea's camp giver hauls nets, the War's healer mends the wounded); the two traders take
 * turns floor by floor (odd floors the first, even floors the second), so two floors side by side never show the same set.
 * Rivals, gatekeepers and rulers stay heroes: they are fights against a hero by design.
 */
export interface Folk {
  /** The model's file stem (`models/tower/<id>_v4.glb`), `<chapter>_<name>`. */
  id: string;
  chapter: 'sea' | 'wood' | 'sands' | 'deep' | 'war';
  /** The name on cards and marks, and in every line that speaks of them. */
  name: string;
  /** What they are, in a few words (the pictures' caption). */
  title: string;
  slot: 'keeper' | 'giver' | 'village' | 'trader';
  /** The hero whose way of holding the figure borrows (src/motion/real.ts `REAL_STYLE`): Sefu a staff in the left hand, Auriel a shield. */
  stand: string;
}

export const TOWER_FOLK: Folk[] = [
  { id: 'sea_keeper', chapter: 'sea', name: 'The Bell-Warden', title: 'keeper: rings the harbour bell', slot: 'keeper', stand: 'Sefu' },
  { id: 'sea_fisher', chapter: 'sea', name: 'The Net-Father', title: 'quest giver: mends the sea nets', slot: 'giver', stand: 'Sefu' },
  { id: 'sea_lamp', chapter: 'sea', name: 'The Lamp-Bearer', title: 'quest giver: keeps the shore lamps', slot: 'village', stand: 'Sefu' },
  { id: 'sea_trader', chapter: 'sea', name: 'The Tide-Broker', title: 'trader: weighs what the tide gives', slot: 'trader', stand: 'Sefu' },
  { id: 'sea_pedlar', chapter: 'sea', name: 'The Coral-Pedlar', title: 'trader: sells the reef', slot: 'trader', stand: 'Sefu' },

  { id: 'wood_abbess', chapter: 'wood', name: 'The Moss-Abbess', title: 'keeper: her horn keeps the wood asleep', slot: 'keeper', stand: 'Sefu' },
  { id: 'wood_lighter', chapter: 'wood', name: 'The Path-Lighter', title: 'quest giver: lights the spore lamps', slot: 'giver', stand: 'Sefu' },
  { id: 'wood_kiln', chapter: 'wood', name: 'The Kiln-Mother', title: 'quest giver: tends the charcoal fires', slot: 'village', stand: 'Sefu' },
  { id: 'wood_amber', chapter: 'wood', name: 'The Amber-Seller', title: 'trader: sells the wood’s amber', slot: 'trader', stand: 'Sefu' },
  { id: 'wood_charm', chapter: 'wood', name: 'The Charm-Pedlar', title: 'trader: carries the wood’s charms', slot: 'trader', stand: 'Sefu' },

  { id: 'sands_seer', chapter: 'sands', name: 'The Star-Reader', title: 'keeper: reads the storms in the stars', slot: 'keeper', stand: 'Sefu' },
  { id: 'sands_counter', chapter: 'sands', name: 'The Storm-Counter', title: 'quest giver: counts the storms', slot: 'giver', stand: 'Sefu' },
  { id: 'sands_beacon', chapter: 'sands', name: 'The Beacon-Keeper', title: 'quest giver: keeps the watch fires', slot: 'village', stand: 'Sefu' },
  { id: 'sands_silk', chapter: 'sands', name: 'The Silk-Merchant', title: 'trader: the last caravan’s master', slot: 'trader', stand: 'Sefu' },
  { id: 'sands_glass', chapter: 'sands', name: 'The Glass-Seller', title: 'trader: sells lightning glass', slot: 'trader', stand: 'Sefu' },

  { id: 'deep_hermit', chapter: 'deep', name: 'The Echo-Hermit', title: 'keeper: finds the way by echoes', slot: 'keeper', stand: 'Sefu' },
  { id: 'deep_candle', chapter: 'deep', name: 'The Candle-Crowned', title: 'quest giver: keeps the last candles', slot: 'giver', stand: 'Sefu' },
  { id: 'deep_ferry', chapter: 'deep', name: 'The Ferryman', title: 'quest giver: poles the black water', slot: 'village', stand: 'Sefu' },
  { id: 'deep_crystal', chapter: 'deep', name: 'The Crystal-Seller', title: 'trader: sells cut light', slot: 'trader', stand: 'Sefu' },
  { id: 'deep_firefly', chapter: 'deep', name: 'The Firefly-Seller', title: 'trader: sells living light', slot: 'trader', stand: 'Sefu' },

  { id: 'war_herald', chapter: 'war', name: 'The Herald', title: 'keeper: speaks for both banners', slot: 'keeper', stand: 'Sefu' },
  { id: 'war_turncloak', chapter: 'war', name: 'The Turncloak', title: 'quest giver: fought for both banners', slot: 'giver', stand: 'Auriel' },
  { id: 'war_sister', chapter: 'war', name: 'The White Sister', title: 'quest giver: mends the wounded', slot: 'village', stand: 'Sefu' },
  { id: 'war_camp', chapter: 'war', name: 'The Camp-Mother', title: 'trader: feeds both armies', slot: 'trader', stand: 'Sefu' },
  { id: 'war_quarter', chapter: 'war', name: 'The Quartermaster', title: 'trader: keeps the stores', slot: 'trader', stand: 'Sefu' },
];

const CHAPTER_IDS = ['sea', 'wood', 'sands', 'deep', 'war'] as const;
const folkOf = (chapter: Folk['chapter'], slot: Folk['slot']) => TOWER_FOLK.filter((f) => f.chapter === chapter && f.slot === slot);

/** Which of a floor's people is which figure: the floor's number picks it, so it is fixed per floor. Null for a rival. */
export function folkFor(n: number, p: Pick<PersonDef, 'id' | 'role'>, givers: string[]): Folk | null {
  const chapter = CHAPTER_IDS[Math.min(4, Math.max(0, Math.floor((n - 1) / 10)))];
  if (p.role === 'rival') return null;
  if (p.role === 'keeper') return folkOf(chapter, 'keeper')[0];
  if (p.role === 'trader') {
    const t = folkOf(chapter, 'trader');
    return t[(n + 1) % 2];
  }
  // The first giver of the floor is the camp's, the second the land's (the generator's `giver` and `villager` or `healer`).
  return folkOf(chapter, givers.indexOf(p.id) <= 0 ? 'giver' : 'village')[0];
}

/**
 * Greetings written for a hero that the figure would not say (floor 41's deserter was a cat with nine lives): the figure's own, by
 * floor and person id. Every other line only has the name changed.
 */
const LINES: Record<number, Record<string, string[]>> = {
  1: { anka: ['The sea keeps what it takes. Perhaps you can take some of it back.'] },
  11: {
    bo: ['Careful, climber. The wood walks, and only my horn keeps it from walking over us. Three wisps are bound in it, and the Elder Root at its heart is hungry.'],
    mortis: ['I lose things in this wood, and the wood keeps them. Maybe you can bring them back.'],
  },
  21: { pip: ['Another climber. Three wells have gone dry, a caravan is waiting, and the raiders hold the gate in the north. The stars say you will carry what is needed.'] },
  // Isolde's line ("a cold woman in a cave") from under a crown of lit candles.
  31: { isolde: ['I lost my lantern, and my satchel with it. My candles light my own face and nothing more. Perhaps you can fetch them.'] },
  41: {
    cantor: ['Hush. Two armies fought here and never stopped, and I speak for both. Take a banner in the camp: its soldiers will march with you. Then take the standards, hold the hill, and break the siege line in the north. The Marshal waits behind it.'],
    whiskers: ['I deserted. Both banners, one after the other, and neither noticed. Do me two small kindnesses and I will call it even.'],
  },
};

/** Quest words written for the hero who gave them, as the figure says them: by floor and quest id. */
const QUEST_LINES: Record<number, Record<string, { intro?: string[]; outro?: string[] }>> = {
  11: { 'mortis-lamps': { intro: ['Two spore lamps stand in the glades west and east of the camp. Light both, stand by each a moment, and I can see where the paths have gone.'] } },
  41: { cloth: { outro: ['The cloth is hung. For a moment, nobody fights. Take this, from a soldier of honour, nearly.'] } },
};

/** `The Bell-Warden` at a sentence's start, `the Bell-Warden` inside one. */
function placed(name: string, start: boolean) {
  return start || !name.startsWith('The ') ? name : `the ${name.slice(4)}`;
}

/** Keys whose strings name a hero or an id and are never words a player reads as this floor's people. */
const KEEP = new Set(['id', 'hero', 'stand', 'giver', 'piece', 'kind', 'look', 'figure', 'arena', 'item', 'pack', 'packs', 'opens', 'quests', 'tunedAs']);

/**
 * The floor with its people drawn as the Climb's own: each person (not the rival) gets `figure`, and a person named after a hero takes
 * the figure's name, on its card and mark and in every line of the floor that names it (quests, doors, lore, the rival's lines). Ids
 * stay as they are (saved runs name them), and so do the rival, the gatekeeper and the ruler.
 */
export function withFolk<T extends FloorDef>(n: number, def: T): T {
  // The rival stays a hero, and so does a person who is the rival's hero standing by its arch (floor 41's Brannoc holds the ground
  // between the lines as a person with no quests, and the duel is with him).
  const stays = (p: PersonDef) => p.role === 'rival' || p.hero === def.rival?.hero;
  const givers = def.people.filter((p) => p.role === 'giver' && !stays(p)).map((p) => p.id);
  const renames: [string, string][] = [];
  const people = def.people.map((p) => {
    const f = stays(p) ? null : folkFor(n, p, givers);
    if (!f) return p;
    if (p.name !== f.name) renames.push([p.name, f.name]);
    const own = LINES[n]?.[p.id];
    return { ...p, name: f.name, figure: f.id, ...(own ? { greet: own } : {}) };
  });
  const ql = QUEST_LINES[n];
  const quests = ql ? def.quests.map((q) => (ql[q.id] ? { ...q, ...ql[q.id] } : q)) : def.quests;
  if (!renames.length) return { ...def, quests, people };
  // Longest first, so `Mr. Ledger` goes before a shorter name inside it.
  renames.sort((a, b) => b[0].length - a[0].length);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\p{L}])(${renames.map(([a]) => esc(a)).join('|')})(?![\\p{L}])`, 'gu');
  const to = new Map(renames);
  const say = (s: string) => s.replace(re, (all, pre: string, name: string, at: number) => {
    const before = s.slice(0, at + pre.length).trimEnd();
    const start = before === '' || /[.!?:“"]$/.test(before);
    return pre + placed(to.get(name)!, start);
  });
  const walk = (v: unknown, key: string): unknown => {
    if (typeof v === 'string') return KEEP.has(key) ? v : say(v);
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  const { people: _, arena, ...rest } = { ...def, quests };
  return { ...(walk(rest, '') as Omit<T, 'people' | 'arena'>), arena, people: people.map((p) => (p.figure ? { ...p, greet: p.greet.map(say) } : walk(p, '') as PersonDef)) } as T;
}
