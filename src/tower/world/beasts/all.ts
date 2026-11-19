import type { MinionLook } from '../../../effects/parts/minion';
import { escortLook } from '../looksWild';
import { beastLook, type BeastDef } from '.';
import { HOUND } from './hound';

/**
 * The beasts and spirits drawn from a model, by the enemy spec's `look` (or an escort's look id). A look not here stays drawn in code.
 * The user, 2026-11-19: "Yes, do them all" (docs/tower/beasts/README.md).
 */
export const BEASTS: Record<string, BeastDef> = {
  hound: HOUND,
};

/** The look of one who is led in a quest (the wisp, the caravan cart): its model where it has one, else its code look. */
export function escortModelLook(id: string, speed: number): MinionLook {
  const code = escortLook(id), beast = BEASTS[id];
  return beast && !(globalThis as { __codeFoes?: boolean }).__codeFoes ? beastLook(beast, code, { speed }) : code;
}
