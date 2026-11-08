// The version of the rules two screens must agree on. Both screens work out arenas, hazards and parcels from the same
// seed with no server field, so a tab left open from an older build would see different cover and events from its
// opponent. Raise this by hand whenever a deploy changes those rules or the messages: the hub then tells older tabs to
// reload (hub.mjs, `register`, `login` and `resume` carry `v`). Read by the hub and by src/net/client.ts.
export const PROTOCOL = 5;

/** What an older tab is told. */
export const RELOAD_TEXT = 'A new version is out: reload the page';

/**
 * What the hub must know of each raid boss, because online it keeps these: HP (alone, and for two), the HP shares where
 * its phases begin, the stagger gauge and how long a full one makes it kneel (s), and how far its room reaches (m).
 * The boss's definition in src/raid reads the same numbers.
 */
export const RAID_BOSSES = {
  sun: { hp: { solo: 3200, duo: 6500 }, phases: [0.7, 0.5, 0.35], staggerMax: 100, kneel: 6, ring: 16 },
  ash: { hp: { solo: 3000, duo: 7000 }, phases: [0.66, 0.5, 0.33], staggerMax: 110, kneel: 6, ring: 16 },
};

/**
 * What a mechanic earns when a hero does it (pipeline/designs/raid-noonfall.md): a share of the boss's max HP, stagger points, or
 * a kneel. The hub pays it online and `LocalLink` alone, once per cast, so two screens never pay it twice.
 */
export const RAID_REWARDS = {
  sun: { noon: { hp: 0.05, kneel: true }, ray: { stagger: 40 }, hour: { kneel: true } },
  ash: { marked: { hp: 0.04, stagger: 40 }, seal: { stagger: 40 }, eruption: { kneel: true } },
};

/** How far Noonfall's hall reaches, where a run waits between its fights (m). */
export const RAID_HALL_RING = 13;

/** The bosses of one tier of a run, in order. */
export const RAID_RUN = ['sun', 'ash'];

/** A boss's HP in a raid: each tier adds 15 %. @param {string} id @param {boolean} duo @param {number} tier */
export const raidHp = (id, duo, tier) => Math.round(RAID_BOSSES[id].hp[duo ? 'duo' : 'solo'] * 1.15 ** (tier - 1));

/** How much of a move's shown time is left at a tier: each tier takes 10 % off. @param {number} tier */
export const raidTierFactor = (tier) => 0.9 ** (tier - 1);
