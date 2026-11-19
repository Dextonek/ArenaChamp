import { ASH_AND_EMBER } from './ashEmber';
import { HEART_OF_NOON } from './heart';
import { SUN_WARDEN } from './sunWarden';
import { ECLIPSE_WYRM } from './wyrm';
import type { BossDef } from './types';

/** Every raid boss by the id the hub uses (`RAID_BOSSES` in server/protocol.mjs). */
export const BOSSES: Record<string, BossDef> = { sun: SUN_WARDEN, ash: ASH_AND_EMBER, heart: HEART_OF_NOON, wyrm: ECLIPSE_WYRM };
