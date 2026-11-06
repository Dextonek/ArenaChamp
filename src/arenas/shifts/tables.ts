import type { TelegraphShape } from '../../effects/telegraph';
import { RING, seeded } from '../common';
import { REACH, seedNumber } from '../hazards/base';
import { ArenaShift, type ShiftStage, type ShiftZone } from './base';

/** The three stages on the fight clock, and what standing in a zone costs at each (share of max HP per 0.8 s). */
const AT = [35, 60, 85];
const SHARE = [0.015, 0.02, 0.03];
/** Seconds of slow a zone that slows gives per tick: a little over the tick, so it holds while the hero stays. */
const SLOW = 0.9;

/** The floor outside radius `r`. */
const beyond = (r: number, stage: number, slow?: number): ShiftZone => ({
  shape: { kind: 'ring', x: RING.x, z: RING.z, inner: r, outer: RING.r }, share: SHARE[stage], slow,
});
/** The floor inside radius `r`. */
const within = (r: number, stage: number): ShiftZone => ({ shape: { kind: 'circle', x: RING.x, z: RING.z, radius: r }, share: SHARE[stage] });
const stages = (...zones: ShiftZone[][]): ShiftStage[] => zones.map((z, i) => ({ at: AT[i], zones: z }));

/** Night Temple: the cover goes first, then sunfire burns the floor outside 6 m. */
export const templeShift = () => new ArenaShift('The temple falls', 0xd08a20, '#ffb050', stages(
  [],
  [],
  [beyond(6, 2)],
));

/** Frostfall Lake: two open water channels that only slow and stay open, then the outer ice sinks. */
export function frostShift(seed: string) {
  const rnd = seeded(seedNumber(`${seed}-shift`));
  const angle = rnd() * Math.PI * 2, offset = 3.6, width = 1.8;
  const half = Math.sqrt(REACH * REACH - offset * offset);
  const along = { x: Math.sin(angle), z: Math.cos(angle) }, across = { x: along.z, z: -along.x };
  const channels = [1, -1].map((side): ShiftZone => {
    const x = RING.x + across.x * offset * side, z = RING.z + across.z * offset * side;
    const shape: TelegraphShape = { kind: 'line', x1: x - along.x * half, z1: z - along.z * half, x2: x + along.x * half, z2: z + along.z * half, width };
    return { shape, slow: SLOW };
  });
  return new ArenaShift('The ice breaks', 0x3aa8d8, '#9fe0ff', stages(
    channels,
    [beyond(9, 1, SLOW), ...channels],
    [beyond(6.5, 2, SLOW), ...channels],
  ));
}

/** Ember Caldera: lava rises from the edge and, later, over the vent, until the fight is on a ring. */
export const calderaShift = () => new ArenaShift('The lava rises', 0xe0601a, '#ff8a40', stages(
  [beyond(10, 0)],
  [beyond(8, 1), within(2, 1)],
  [beyond(6.5, 2), within(2.5, 2)],
));

/** Verdant Glade: new cover first, then thorns close in from the edge. */
export const gladeShift = () => new ArenaShift('The forest closes in', 0x9ac030, '#b6e05a', stages(
  [],
  [beyond(9, 1, SLOW)],
  [beyond(6.5, 2, SLOW)],
));

/** Sky Ruins: the outer ring goes. */
export const skyruinsShift = () => new ArenaShift('The platform breaks up', 0x7a8cff, '#bcd0ff', stages(
  [beyond(10, 0)],
  [beyond(8, 1)],
  [beyond(6.5, 2)],
));
