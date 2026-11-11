// The version of the rules two screens must agree on. Both screens work out arenas, hazards and parcels from the same
// seed with no server field, so a tab left open from an older build would see different cover and events from its
// opponent. Raise this by hand whenever a deploy changes those rules or the messages: the hub then tells older tabs to
// reload (hub.mjs, `register`, `login` and `resume` carry `v`). Read by the hub and by src/net/client.ts.
export const PROTOCOL = 8;

/** What an older tab is told. */
export const RELOAD_TEXT = 'A new version is out: reload the page';

/**
 * What the hub must know of each raid boss, because online it keeps these: HP (alone, and for two), the HP shares where
 * its phases begin, the stagger gauge and how long a full one makes it kneel (s), and how far its room reaches (m).
 * The boss's definition in src/raid reads the same numbers.
 */
export const RAID_BOSSES = {
  sun: { hp: { solo: 4300, duo: 8700 }, phases: [0.7, 0.5, 0.35], staggerMax: 100, kneel: 6, ring: 16, partyRing: 46 },
  ash: { hp: { solo: 3300, duo: 7100 }, phases: [0.66, 0.5, 0.33], staggerMax: 110, kneel: 6, ring: 16 },
  heart: { hp: { solo: 3300, duo: 7100 }, phases: [0.66, 0.33], staggerMax: 100, kneel: 6, ring: 12 },
};

/**
 * What a mechanic earns when a hero does it (pipeline/designs/raid-noonfall.md): a share of the boss's max HP, stagger points, a
 * kneel (as long as a full gauge's, and the gauge empties), or a stun (a kneel this many seconds long that leaves the gauge as it
 * is: Ash's Charge into a pillar, which comes often). The hub pays it online and `LocalLink` alone, once per cast, so two screens
 * never pay it twice.
 */
export const RAID_REWARDS = {
  sun: { noon: { hp: 0.05, kneel: true }, ray: { stagger: 40 }, hour: { kneel: true } },
  ash: { marked: { hp: 0.04, stagger: 40 }, seal: { stagger: 40 }, eruption: { kneel: true }, charge: { stun: 5 } },
  heart: { lock: { stagger: 40 } },
};

/** What the Shrine, a side door of the hall, costs on the run's time (s; src/raid/paths.ts). */
export const RAID_SHRINE_S = 15;

/**
 * How far a boss's room reaches (m). For two it is the room as it was; a party of more fights in the boss's own party room where it
 * has one (`partyRing`: the Sun Warden's Hall of Noon), whatever the band. Both screens and the hub work it out from the band.
 * @param {string} id @param {number} band
 */
export const raidRing = (id, band) => (band > 2 ? RAID_BOSSES[id].partyRing ?? RAID_BOSSES[id].ring : RAID_BOSSES[id].ring);

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
