import { RING } from '../common';
import { ArenaShift, type ShiftZone } from './base';
import { POOL_STYLES, PoolLook, type PoolStep } from './pools';
import { SHARE, beyond, stages } from './tables';

/**
 * Where the fires start: at the wreckage, two point-symmetric pairs: the inner end of each catapult on the wings and
 * the near side of each supply wagon in the far corners. Both starts ((0, 13) and (0, 1)) stay clear by more than 3 m
 * at every stage, and a dry way joins them through the middle.
 */
const SPOTS: [number, number][] = [[7.0, 8.0], [-7.0, 6.0], [-5.9, 11.3], [5.9, 2.7]];
const RADII = [[1.7, 1.7, 1.5, 1.5], [2.5, 2.5, 2.2, 2.2], [3.1, 3.1, 2.8, 2.8]];
/** The last stage also brings fire in from the rim. */
const EDGE = 9.6;

/**
 * Fallen Battlefield, "The field burns": fire starts at the four wrecks and spreads from stage to stage; at the third it
 * also comes in from the rim. Standing in fire costs a share of max HP and does not slow. As in the harbour the ring
 * does not simply close: the field is cut into ways between the fires.
 */
export function battlefieldShift() {
  const fires = (stage: number): ShiftZone[] => SPOTS.map(([x, z], i) => ({ shape: { kind: 'circle', x, z, radius: RADII[stage][i] }, share: SHARE[stage] }));
  const steps: PoolStep[] = RADII.map((radii, s) => ({ circles: SPOTS.map(([x, z], i) => [x, z, radii[i]]), edge: s === 2 ? EDGE : undefined }));
  return new ArenaShift('The field burns', 0xe07a1a, '#ffa050', stages(fires(0), fires(1), [...fires(2), beyond(EDGE, 2)]), new PoolLook(POOL_STYLES.fire, steps), RING.r);
}
