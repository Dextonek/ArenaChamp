import { SUN_WARDEN } from './sunWarden';
import type { BossDef } from './types';

/** Every raid boss by the id the hub uses (`RAID_BOSSES` in server/protocol.mjs). */
export const BOSSES: Record<string, BossDef> = { sun: SUN_WARDEN };
