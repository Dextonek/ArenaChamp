export declare const PROTOCOL: number;
export declare const RELOAD_TEXT: string;
export declare const RAID_BOSSES: Record<string, { hp: { solo: number; duo: number }; phases: number[]; staggerMax: number; kneel: number; ring: number; partyRing?: number }>;
export declare const RAID_REWARDS: Record<string, Record<string, { hp?: number; stagger?: number; kneel?: boolean; stun?: number; swap?: boolean }>>;
/**
 * Twin Flames: the boss fought as two at once by a party, the HP gaps where one grows furious and calms, and where the second boss's
 * cast ids start. `flood`: the move that puts the wall of fire out for good. `change`: The Changing of the Flames' numbers.
 */
export declare const RAID_TWIN: {
  boss: string; gapOn: number; gapOff: number; ids: number; flood: string;
  change: { warn: number; open: number; mark: number; cross: number; late: number; rest: number };
};
export declare const raidTwin: (id: string, band: number) => boolean;
export declare const RAID_HALL_RING: number;
export declare const RAID_SHRINE_S: number;
export declare const RAID_RUN: string[];
export declare const RAID_PARTY_MAX: number;
export declare const RAID_BANDS: number[];
export declare const raidBand: (n: number) => number;
export declare const raidScale: (band: number) => number;
/** `band`: 1 alone (offline), 2 the duo, then 5, 10, 15, 20, 30, 40. `false` and `true` still mean 1 and 2. */
export declare const raidHp: (id: string, band: number | boolean, tier: number) => number;
export declare const raidStaggerMax: (id: string, band: number) => number;
export declare const raidTierFactor: (tier: number) => number;
export declare const raidRing: (id: string, band: number) => number;
/** The hero shop (pipeline/designs/hero-shop.md): the six kinds of play, every hero's kind and shelf (0: a starter), the numbers. */
export declare const HERO_KINDS: Record<string, { name: string; blurb: string }>;
export declare const HERO_SHOP: Record<string, { kind: string; shelf: number }>;
export declare const SHOP: {
  start: number; shelves: number[]; rotation: number;
  earn: { duel: number; win: number; firstWin: number; boss: number; tier: number };
  minDuelS: number; minBossS: number;
  newest: { hero: string; price: number; until: string };
};
export declare const STARTERS: string[];
/** What a hero costs at `now` (ms): 0 for a starter or an unknown name. */
export declare const heroPrice: (hero: string, now?: number) => number;
/** The ISO week of a moment (ms) in UTC: "2026-W46", when the next begins (ms), and the UTC day. */
export declare const isoWeek: (now?: number) => { id: string; next: number; day: string };
/** The week's six free heroes, from the week's name. */
export declare const shopRotation: (week?: string) => string[];
export declare const RAID_RANKS: { id: string; name: string; from: number }[];
export declare const raidRank: (bosses: number) => { id: string; name: string; from: number } | null;
export declare const BOARD_SIZE: number;
export declare const TOWER_FLOOR_MAX: number;
