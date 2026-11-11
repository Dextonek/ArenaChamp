import { RING } from '../common';
import { ArenaShift, type ShiftZone } from './base';
import { POOL_STYLES, PoolLook, type PoolStep } from './pools';
import { SHARE, SLOW, beyond, stages } from './tables';

/**
 * Where the court's flags sink into the sand: two point-symmetric pairs of pits, one on each wing between the jars and
 * the rock pillars, one beside each start's fallen column. Checked on a grid with the cover of `CANYON_OBSTACLES`:
 * both starts ((0, 13) and (0, 1)) stay at least 1.6 m outside every pit, and at every stage a dry way joins them
 * (past the well, between it and the pits) that is wide enough for the AI, which keeps 0.5 m from a pit's edge.
 */
const SPOTS: [number, number][] = [[5.7, 6.7], [-5.7, 7.3], [-3.1, 2.9], [3.1, 11.1]];
const RADII = [[1.4, 1.4, 1.1, 1.1], [2.0, 2.0, 1.5, 1.5], [2.6, 2.6, 2.0, 2.0]];
/** At the last stage the sand also comes in from the rim (the starts are 6 m from the centre). */
const EDGE = 9.6;

/**
 * Sandstone Canyon, "The sand gives way": four quicksand pits open in the court and widen from stage to stage; at the
 * third the sand also comes in from the rim. Standing in it costs and slows. The floor is cut into dry paths, as in
 * the harbour, instead of the ring simply closing.
 */
export function canyonShift() {
  const pits = (stage: number): ShiftZone[] => SPOTS.map(([x, z], i) => ({ shape: { kind: 'circle', x, z, radius: RADII[stage][i] }, share: SHARE[stage], slow: SLOW }));
  const steps: PoolStep[] = RADII.map((radii, s) => ({ circles: SPOTS.map(([x, z], i) => [x, z, radii[i]]), edge: s === 2 ? EDGE : undefined }));
  return new ArenaShift('The sand gives way', 0xd8a850, '#e8c880', stages(pits(0), pits(1), [...pits(2), beyond(EDGE, 2, SLOW)]), new PoolLook(POOL_STYLES.sand, steps), RING.r);
}
