// The version of the rules two screens must agree on. Both screens work out arenas, hazards and parcels from the same
// seed with no server field, so a tab left open from an older build would see different cover and events from its
// opponent. Raise this by hand whenever a deploy changes those rules or the messages: the hub then tells older tabs to
// reload (hub.mjs, `register`, `login` and `resume` carry `v`). Read by the hub and by src/net/client.ts.
export const PROTOCOL = 11;

/** What an older tab is told. */
export const RELOAD_TEXT = 'A new version is out: reload the page';

/**
 * What the hub must know of each raid boss, because online it keeps these: HP (alone, and for two), the HP shares where
 * its phases begin, the stagger gauge and how long a full one makes it kneel (s), and how far its room reaches (m).
 * The boss's definition in src/raid reads the same numbers.
 */
export const RAID_BOSSES = {
  sun: { hp: { solo: 4300, duo: 8700 }, phases: [0.7, 0.5, 0.35], staggerMax: 100, kneel: 6, ring: 16, partyRing: 46 },
  ash: { hp: { solo: 3300, duo: 7100 }, phases: [0.66, 0.5, 0.33], staggerMax: 110, kneel: 6, ring: 16, partyRing: 30 },
  heart: { hp: { solo: 3300, duo: 7100 }, phases: [0.66, 0.33], staggerMax: 100, kneel: 6, ring: 12, partyRing: 35 },
};

/**
 * What a mechanic earns when a hero does it (pipeline/designs/raid-noonfall.md): a share of the boss's max HP, stagger points, a
 * kneel (as long as a full gauge's, and the gauge empties), or a stun (a kneel this many seconds long that leaves the gauge as it
 * is: Ash's Charge into a pillar, which comes often). The hub pays it online and `LocalLink` alone, once per cast, so two screens
 * never pay it twice.
 */
export const RAID_REWARDS = {
  sun: { noon: { hp: 0.05, kneel: true }, ray: { stagger: 40 }, hour: { kneel: true } },
  ash: { marked: { hp: 0.04, stagger: 40 }, seal: { stagger: 40 }, eruption: { kneel: true }, charge: { stun: 5 }, eruptw: { kneel: true }, erupte: { kneel: true } },
  heart: { lock: { stagger: 40 } },
};

/** What the Shrine, a side door of the hall, costs on the run's time (s; src/raid/paths.ts). */
export const RAID_SHRINE_S = 15;

/**
 * How far a boss's room reaches (m). For two it is the room as it was; a party of more fights in the boss's own party room where it
 * has one (`partyRing`: the Sun Warden's Hall of Noon, the Heart's Sunburst), whatever the band. Both screens and the hub work it out from the band.
 * @param {string} id @param {number} band
 */
export const raidRing = (id, band) => (band > 2 ? RAID_BOSSES[id].partyRing ?? RAID_BOSSES[id].ring : RAID_BOSSES[id].ring);

/**
 * Twin Flames (pipeline/designs/raid-party.md): a party fights Ash and Ember both at once, one on each side of a wall of fire.
 * The hub keeps two HP pools, each half the band's HP, and half the gauge each. Their health must fall together: when their HP
 * shares are more than `gapOn` apart, the one with more grows furious, until they are within `gapOff` again. Boss 0 is Ash
 * (the west half), boss 1 Ember (the east). The second boss's cast ids start at `ids`, so a cast's id says whose it is.
 */
export const RAID_TWIN = { boss: 'ash', gapOn: 0.12, gapOff: 0.06, ids: 1000000 };

/** Whether this boss at this band is fought as two at once. @param {string} id @param {number} band */
export const raidTwin = (id, band) => id === RAID_TWIN.boss && band > 2;

/** How far Noonfall's hall reaches, where a run waits between its fights (m). */
export const RAID_HALL_RING = 13;

/** The bosses of one tier of a run, in order. */
export const RAID_RUN = ['sun', 'ash', 'heart'];

/** The most seats a raid's lobby holds (pipeline/designs/raid-party.md). */
export const RAID_PARTY_MAX = 40;

/** The sizes a boss is tuned for: a party fights at the smallest that holds everyone present when the fight starts. */
export const RAID_BANDS = [2, 5, 10, 15, 20, 30, 40];

/** The band for `n` players: 1-2 → 2, 3-5 → 5, 6-10 → 10, 11-15 → 15, 16-20 → 20, 21-30 → 30, 31-40 → 40. @param {number} n */
export const raidBand = (n) => RAID_BANDS.find((b) => n <= b) ?? RAID_PARTY_MAX;

/**
 * How much bigger than the duo's a band's numbers are (boss HP, the stagger gauge, what a mechanic puts on the gauge): band / 2.
 * Bands 1 (alone, offline) and 2 are 1.
 * @param {number} band
 */
export const raidScale = (band) => Math.max(2, band) / 2;

/**
 * A boss's HP in a raid: the duo's HP times band / 2, and each tier adds 15 %. Band 2 is the duo's HP as it always was. Band 1 is
 * alone, offline, with its own HP. `false` and `true` are the older way to say 1 and 2.
 * @param {string} id @param {number | boolean} band @param {number} tier
 */
export const raidHp = (id, band, tier) => {
  const n = band === true ? 2 : band === false ? 1 : band, hp = RAID_BOSSES[id].hp;
  return Math.round((n < 2 ? hp.solo : hp.duo * raidScale(n)) * 1.15 ** (tier - 1));
};

/** The stagger gauge's size at a band: `staggerMax` times band / 2. @param {string} id @param {number} band */
export const raidStaggerMax = (id, band) => RAID_BOSSES[id].staggerMax * raidScale(band);

/** How much of a move's shown time is left at a tier: each tier takes 10 % off. @param {number} tier */
export const raidTierFactor = (tier) => 0.9 ** (tier - 1);

// --- the hero shop (pipeline/designs/hero-shop.md) ---------------------------------------------------------------
// Heroes are bought with obols, a currency earned only where the hub counts: online duels and raids with others. The hub
// decides who may play what; the page reads the same table to draw locks and prices. No real money anywhere.

/** The six kinds of play, for the shop's filter and the starters (two of each). */
export const HERO_KINDS = {
  vanguard: { name: 'Vanguard', blurb: 'Stands in front and takes the blows' },
  fighter: { name: 'Fighter', blurb: 'Trades blows up close' },
  assassin: { name: 'Assassin', blurb: 'In, a kill, and out' },
  caster: { name: 'Caster', blurb: 'Mages and marksmen: damage from range' },
  controller: { name: 'Controller', blurb: 'Holds the foe where it stands' },
  support: { name: 'Support', blurb: 'Shields, heals and summons' },
};

/**
 * Every hero: its kind of play and its shelf. Shelf 0 is a starter (free for everyone, for good); 1, 2 and 3 are the three
 * prices (`SHOP.shelves`), by how hard the hero is to play well. A hero missing from here cannot be played online while
 * the shop is on: add a new hero's row with its kit (the page logs an error for a kit without one).
 */
export const HERO_SHOP = {
  // Vanguard
  Brannoc: { kind: 'vanguard', shelf: 0 },
  Oblivion: { kind: 'vanguard', shelf: 0 },
  'Big Yoko': { kind: 'vanguard', shelf: 1 },
  Vesper: { kind: 'vanguard', shelf: 2 },
  // Fighter
  Sirix: { kind: 'fighter', shelf: 0 },
  Bram: { kind: 'fighter', shelf: 0 },
  Hank: { kind: 'fighter', shelf: 1 },
  'Pim and Pom': { kind: 'fighter', shelf: 3 },
  // Assassin
  Nyx: { kind: 'assassin', shelf: 0 },
  Zephyr: { kind: 'assassin', shelf: 0 },
  Pip: { kind: 'assassin', shelf: 1 },
  Mabel: { kind: 'assassin', shelf: 1 },
  'Sir Whiskers': { kind: 'assassin', shelf: 2 },
  'The Great Zambini': { kind: 'assassin', shelf: 3 },
  // Caster
  Kaia: { kind: 'caster', shelf: 0 },
  Lyra: { kind: 'caster', shelf: 0 },
  'Professor Puff': { kind: 'caster', shelf: 1 },
  'Barry Cloudsley': { kind: 'caster', shelf: 1 },
  Vitriol: { kind: 'caster', shelf: 2 },
  Tempo: { kind: 'caster', shelf: 2 },
  Opaline: { kind: 'caster', shelf: 2 },
  Silvane: { kind: 'caster', shelf: 3 },
  Anka: { kind: 'caster', shelf: 3 },
  // Controller
  Isolde: { kind: 'controller', shelf: 0 },
  Sefu: { kind: 'controller', shelf: 0 },
  Gus: { kind: 'controller', shelf: 1 },
  Marin: { kind: 'controller', shelf: 2 },
  'Mr. Ledger': { kind: 'controller', shelf: 2 },
  'Referee Whistler': { kind: 'controller', shelf: 2 },
  Mum: { kind: 'controller', shelf: 3 },
  Wick: { kind: 'controller', shelf: 3 },
  // Support
  Cantor: { kind: 'support', shelf: 0 },
  Auriel: { kind: 'support', shelf: 0 },
  Fenna: { kind: 'support', shelf: 1 },
  'Madame Cleaver': { kind: 'support', shelf: 1 },
  'Grandma Ironknit': { kind: 'support', shelf: 1 },
  Mortis: { kind: 'support', shelf: 2 },
  Bo: { kind: 'support', shelf: 2 },
  Shiori: { kind: 'support', shelf: 3 },
  Ada: { kind: 'support', shelf: 3 },
};

/**
 * The shop's numbers. `start`: what a new account begins with. `earn`: an online duel played, a win on top, the first win of
 * the server's UTC day on top of that; a raid boss beaten with others, and a whole tier cleared with others on top.
 * `minDuelS`: a duel shorter than this pays nobody (a foe who leaves at once, two tabs trading quick wins). `minBossS`: a
 * boss that falls faster than this pays nothing and counts for no rank or board (nobody beats one that fast by playing; the
 * hub takes a screen's word for its damage). `newest`: the newest hero costs `price` until that UTC day, then its shelf.
 */
export const SHOP = {
  start: 900,
  shelves: [600, 900, 1200],
  rotation: 6,
  earn: { duel: 40, win: 40, firstWin: 120, boss: 60, tier: 150 },
  minDuelS: 30,
  minBossS: 20,
  newest: { hero: 'Anka', price: 1500, until: '2026-12-10' },
};

/** The starter roster: free for everyone, with or without an account. */
export const STARTERS = Object.keys(HERO_SHOP).filter((h) => HERO_SHOP[h].shelf === 0);

/** What a hero costs now (0: a starter, or a name the table does not know). @param {string} hero @param {number} [now] ms */
export const heroPrice = (hero, now = Date.now()) => {
  const row = Object.hasOwn(HERO_SHOP, hero) ? HERO_SHOP[hero] : null;
  if (!row || !row.shelf) return 0;
  const n = SHOP.newest;
  if (n.hero === hero && new Date(now).toISOString().slice(0, 10) < n.until) return n.price;
  return SHOP.shelves[row.shelf - 1];
};

const WEEK_MS = 7 * 86400000;
/** 1970-01-05, the first Monday: weeks are counted from it. */
const FIRST_MONDAY = 4 * 86400000;

/**
 * The ISO week of a moment, in UTC: its name ("2026-W46"; the same as src/tower/week.ts makes, which the Tower's seed comes
 * from), when the next one begins (ms), and the UTC day ("2026-11-12").
 * @param {number} [now] ms
 */
export const isoWeek = (now = Date.now()) => {
  const monday = FIRST_MONDAY + Math.floor((now - FIRST_MONDAY) / WEEK_MS) * WEEK_MS;
  // A week belongs to the year its Thursday is in, and week 1 is the one with January 4th.
  const year = new Date(monday + 3 * 86400000).getUTCFullYear();
  const jan4 = Date.UTC(year, 0, 4);
  const first = FIRST_MONDAY + Math.floor((jan4 - FIRST_MONDAY) / WEEK_MS) * WEEK_MS;
  const week = 1 + Math.round((monday - first) / WEEK_MS);
  return { id: `${year}-W${String(week).padStart(2, '0')}`, next: monday + WEEK_MS, day: new Date(now).toISOString().slice(0, 10) };
};

/** How many weeks after the first Monday of 1970 a week begins, from its name. @param {string} id "2026-W46" */
const weekIndex = (id) => {
  const m = /^(\d{4})-W(\d{2})$/.exec(id);
  if (!m) return 0;
  const jan4 = Date.UTC(Number(m[1]), 0, 4);
  return Math.floor((jan4 - FIRST_MONDAY) / WEEK_MS) + Number(m[2]) - 1;
};

/** A small seeded generator (mulberry32) from a string. @param {string} text */
const seededRandom = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Weeks in one turn of the rotation: 14 weeks of six are 84 places, three for each of the 28 heroes that are not starters. */
const ROTATION_WEEKS = 14;

/**
 * The week's free heroes: six, never a starter, the same for everyone, from the week's name alone. The heroes that are not
 * starters are shuffled once for each 14 weeks (by that span's number), and each week takes the next six along the shuffle,
 * round and round. So no two weeks in a row share a hero, and every hero is free three weeks in fourteen.
 * @param {string} [week] "2026-W46"; this week when left out
 */
export const shopRotation = (week = isoWeek().id) => {
  const n = SHOP.rotation, index = weekIndex(week), span = Math.floor(index / ROTATION_WEEKS);
  /** The shuffle of one span. @param {number} s */
  const shuffled = (s) => {
    const pool = Object.keys(HERO_SHOP).filter((h) => HERO_SHOP[h].shelf > 0), random = seededRandom(`rotation:${s}`);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  };
  /** The six of week `w` of a span, along its shuffle. @param {string[]} pool @param {number} w */
  const six = (pool, w) => Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[((w * n) % pool.length + i) % pool.length]);
  const pool = shuffled(span);
  // Where one span meets the next: a hero of the span before's last week steps back out of this span's first week. (The
  // last week's own six lie at the far end of its shuffle, which this never moves.)
  const before = six(shuffled(span - 1), ROTATION_WEEKS - 1);
  for (let i = 0; i < n && pool.length >= 3 * n; i++) {
    if (!before.includes(pool[i])) continue;
    const j = pool.findIndex((h, k) => k >= n && !before.includes(h));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return six(pool, ((index % ROTATION_WEEKS) + ROTATION_WEEKS) % ROTATION_WEEKS);
};

// --- the Raid's rewards (pipeline/designs/raid-next.html, option E) ---------------------------------------------

/** Raid ranks, from the most bosses beaten in one run with others. */
export const RAID_RANKS = [
  { id: 'ember', name: 'Ember', from: 1 },
  { id: 'ash', name: 'Ash', from: 3 },
  { id: 'noon', name: 'Noon', from: 6 },
  { id: 'eclipse', name: 'Eclipse', from: 9 },
];

/** The rank for that many bosses, or null for none. @param {number} bosses */
export const raidRank = (bosses) => RAID_RANKS.findLast((r) => bosses >= r.from) ?? null;

/** How many rows each of the week's boards keeps. */
export const BOARD_SIZE = 20;

/** The highest floor a Tower report may name: far past what anyone climbs. */
export const TOWER_FLOOR_MAX = 500;
