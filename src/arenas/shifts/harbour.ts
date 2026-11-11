import { RING } from '../common';
import { ArenaShift, type ShiftZone } from './base';
import { POOL_STYLES, PoolLook, type PoolStep } from './pools';
import { SHARE, SLOW, beyond, stages } from './tables';

/**
 * Where the tide comes up through the quay: two point-symmetric pairs of low spots, beside the middle and between the
 * mooring posts and the cannons, clear of both starts ((0, 13) and (0, 1)) at every stage.
 */
const SPOTS: [number, number][] = [[3.4, 8.2], [-3.4, 5.8], [-6.9, 8.9], [6.9, 5.1]];
const RADII = [[1.6, 1.6, 1.3, 1.3], [2.4, 2.4, 2.0, 2.0], [3.1, 3.1, 2.7, 2.7]];
/** The last stage also brings the sea over the kerb. */
const EDGE = 9.6;

/**
 * Drowned Harbour, "The tide comes in": four pools open in the floor and grow from stage to stage; at the third the sea
 * also comes over the kerb. Standing in the water costs and slows. Unlike the older arenas the ring does not simply
 * close: the floor is cut into dry paths between the pools.
 */
export function harbourShift() {
  const pools = (stage: number): ShiftZone[] => SPOTS.map(([x, z], i) => ({ shape: { kind: 'circle', x, z, radius: RADII[stage][i] }, share: SHARE[stage], slow: SLOW }));
  const steps: PoolStep[] = RADII.map((radii, s) => ({ circles: SPOTS.map(([x, z], i) => [x, z, radii[i]]), edge: s === 2 ? EDGE : undefined }));
  return new ArenaShift('The tide comes in', 0x3aa8d8, '#9fe0ff', stages(pools(0), pools(1), [...pools(2), beyond(EDGE, 2, SLOW)]), new PoolLook(POOL_STYLES.tide, steps), RING.r);
}
