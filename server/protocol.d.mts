export declare const PROTOCOL: number;
export declare const RELOAD_TEXT: string;
export declare const RAID_BOSSES: Record<string, { hp: { solo: number; duo: number }; phases: number[]; staggerMax: number; kneel: number; ring: number; partyRing?: number }>;
export declare const RAID_REWARDS: Record<string, Record<string, { hp?: number; stagger?: number; kneel?: boolean; stun?: number }>>;
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
