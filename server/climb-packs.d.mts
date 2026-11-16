/** Each Climb floor's packs, [id, home x, home z] (made by pipeline/tools/climb-packs.mjs). */
export declare const CLIMB_PACKS: Record<number, [string, number, number][]>;
/** Each Climb floor's doors, [id, piece, x, z, ring], and the ruler behind its lair as a party fights it (the open world, stage 3). */
export declare const CLIMB_DOORS: Record<number, {
  doors: [string, string, number, number, number][];
  ruler: { hp: number; phases: number[]; staggerMax: number; kneel: number; rewards: Record<string, { stagger?: number; kneel?: boolean }>; crown?: string; tier?: number };
}>;
