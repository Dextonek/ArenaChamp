export declare const PROTOCOL: number;
export declare const RELOAD_TEXT: string;
export declare const RAID_BOSSES: Record<string, { hp: { solo: number; duo: number }; phases: number[]; staggerMax: number; kneel: number; ring: number }>;
export declare const RAID_REWARDS: Record<string, Record<string, { hp?: number; stagger?: number; kneel?: boolean; stun?: number }>>;
export declare const RAID_HALL_RING: number;
export declare const RAID_RUN: string[];
export declare const raidHp: (id: string, duo: boolean, tier: number) => number;
export declare const raidTierFactor: (tier: number) => number;
