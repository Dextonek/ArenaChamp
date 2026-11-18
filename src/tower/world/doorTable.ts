import type { FloorDef } from './def';
import { piecesOf } from './pieces/floors';

/**
 * A floor's doors and the ruler behind its lair as the hub keeps them for the open world's stage 3 (doors together,
 * pipeline/designs/climb-open-world.md): written into `server/climb-packs.mjs` by `node pipeline/tools/climb-packs.mjs`, and read on the
 * dev server by `together.ts` to warn when the table is older than the floor.
 *
 * `doors`: `[id, piece, x, z, ring]` (places to the decimetre). `ruler`: its health, the shares of health its phases after the first
 * start at, its stagger gauge and kneel, what a felled sentry earns (`rewards.sentry`), and for a crown floor the Raid boss and tier
 * behind the lair instead (the hub then takes that boss's own rules). A floor without set pieces of its own plays the highest floor's
 * below it, as `startPiece` does.
 */
export interface DoorRows {
  doors: [string, string, number, number, number][];
  ruler: { hp: number; phases: number[]; staggerMax: number; kneel: number; rewards: Record<string, { stagger?: number; kneel?: boolean }>; crown?: string; tier?: number };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The pieces a floor plays: its own, or the highest floor's below it that has them (`startPiece`). */
export function piecesFor(n: number) {
  let floor = Math.max(1, Math.round(n));
  while (floor > 1 && !piecesOf(floor)) floor--;
  return piecesOf(floor);
}

export function doorRows(floor: FloorDef): DoorRows {
  const doors = floor.doors.map((d): [string, string, number, number, number] => [d.id, d.piece, r1(d.at.x), r1(d.at.z), r1(d.r)]);
  const p = piecesFor(floor.n);
  if (!p) return { doors, ruler: { hp: 0, phases: [], staggerMax: 100, kneel: 5, rewards: {} } };
  const r = p.ruler, rewards: DoorRows['ruler']['rewards'] = {};
  const fall = r.sentries?.fall;
  if (fall) rewards.sentry = { ...(fall.stagger ? { stagger: fall.stagger } : {}), ...(fall.kneel ? { kneel: true } : {}) };
  const ruler: DoorRows['ruler'] = { hp: Math.round(r.hp), phases: r.phases.slice(1).map((ph) => ph.at), staggerMax: r.stagger.max, kneel: r.stagger.kneel, rewards };
  if (p.crown) { ruler.crown = p.crown; ruler.tier = p.crownTier ?? 1; }
  return { doors, ruler };
}
