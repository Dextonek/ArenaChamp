import type { TelegraphShape } from '../../effects/telegraph';
import { wall, type Obstacle } from '../../obstacles';
import { RING, seeded } from '../common';
import { REACH, seedNumber } from '../hazards/base';
import type { ArenaScene } from '../types';
import { ArenaShift, type ShiftStage, type ShiftStrike, type ShiftZone } from './base';
import { ZoneFloor } from './floor';
import { RootLook } from './roots';
import { SkyBreakLook } from './skybreak';

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

/** How long a toppled column's line is and how wide (m), and what being under one costs. */
const COLUMN_FALL = 4.4;
const COLUMN_WIDTH = 1.5;
const COLUMN_HIT = 45;

/**
 * Night Temple: the four screen walls crack and fall; the six side columns topple along a shown line, in point-symmetric
 * pairs, roughly at the middle, and hit where they land; then sunfire burns the floor outside 6 m.
 */
export function templeShift(seed: string, cover: readonly Obstacle[]) {
  const rnd = seeded(seedNumber(`${seed}-shift`));
  const list = stages([], [], [beyond(6, 2)]);
  list[0].breaks = cover.flatMap((o, i) => (o.kind === 'wall' ? [i] : []));
  const columns = cover.flatMap((o, i) => (o.kind === 'pillar' && o.height >= 2 ? [{ o, index: i }] : []));
  const topples: { index: number; dir: number }[] = [], strikes: ShiftStrike[] = [];
  const fall = (o: Obstacle, index: number, dir: number) => {
    topples.push({ index, dir });
    strikes.push({ damage: COLUMN_HIT, shape: { kind: 'line', x1: o.ax, z1: o.az, x2: o.ax + Math.sin(dir) * COLUMN_FALL, z2: o.az + Math.cos(dir) * COLUMN_FALL, width: COLUMN_WIDTH } });
  };
  for (const { o, index } of columns) {
    if (topples.some((t) => t.index === index)) continue;
    const twin = columns.find((c) => c.o.ax === -o.ax && Math.abs(c.o.az + o.az - 2 * RING.z) < 1e-6);
    const dir = Math.atan2(RING.x - o.ax, RING.z - o.az) + (rnd() - 0.5) * 0.7;
    fall(o, index, dir);
    if (twin && twin.index !== index) fall(twin.o, twin.index, dir + Math.PI);
  }
  list[1].topples = topples;
  list[1].strikes = strikes;
  return new ArenaShift('The temple falls', 0xd08a20, '#ffb050', list, new ZoneFloor('sun', [{}, {}, { edge: 6 }]));
}

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
  ), new ZoneFloor('water', [{ channels: true }, { edge: 9, channels: true }, { edge: 6.5, channels: true }], { normal: across, offset, half: width / 2 }));
}

/** Ember Caldera: lava rises from the edge and, later, over the vent, until the fight is on a ring. */
export const calderaShift = () => new ArenaShift('The lava rises', 0xe0601a, '#ff8a40', stages(
  [beyond(10, 0)],
  [beyond(8, 1), within(2, 1)],
  [beyond(6.5, 2), within(2.5, 2)],
), new ZoneFloor('lava', [{ edge: 10 }, { edge: 8, vent: 2 }, { edge: 6.5, vent: 2.5 }]));

/**
 * Where the glade's roots rise: two point-symmetric pairs in the gaps of `GLADE_OBSTACLES`, at least about 2 m from the
 * cover there and from each other. They are low: the camera looks over them, and every obstacle blocks sight fully.
 */
const ROOT_WALLS: Obstacle[] = [
  { ...wall(-1, 3.1, -3, 2), r: 0.4, height: 1.1 },
  { ...wall(1, 10.9, 3, 12), r: 0.4, height: 1.1 },
  { ...wall(4.4, 14.2, 6.6, 13), r: 0.4, height: 1.1 },
  { ...wall(-4.4, -0.2, -6.6, 1), r: 0.4, height: 1.1 },
];

/** Verdant Glade: roots raise new cover first, then thorns close in from the edge. */
export function gladeShift() {
  const list = stages([], [beyond(9, 1, SLOW)], [beyond(6.5, 2, SLOW)]);
  list[0].adds = ROOT_WALLS;
  list[0].marks = ROOT_WALLS.map((o): TelegraphShape => ({ kind: 'line', x1: o.ax, z1: o.az, x2: o.bx, z2: o.bz, width: o.r * 2 + 0.2 }));
  return new ArenaShift('The forest closes in', 0x9ac030, '#b6e05a', list, new ZoneFloor('thorn', [{}, { edge: 9 }, { edge: 6.5 }], undefined, new RootLook(ROOT_WALLS)));
}

/** The radius Sky Ruins' floor breaks to at each stage. */
export const SKY_RADII = [10, 8, 6.5];

/**
 * Sky Ruins: the outer ring really goes. The floor beyond each radius breaks off and falls, with the cover standing on
 * it, and the walkable ring shrinks with it, so a hero there is pushed in. The zones only count for the moment that takes.
 * `cover` is `SKYRUINS_OBSTACLES`: what stands on the falling part goes with it.
 */
export function skyruinsShift(scene: ArenaScene, cover: readonly Obstacle[]) {
  const radii = SKY_RADII;
  const list = stages([beyond(10, 0)], [beyond(8, 1)], [beyond(6.5, 2)]);
  const reach = (o: Obstacle) => Math.hypot((o.ax + o.bx) / 2 - RING.x, (o.az + o.bz) / 2 - RING.z);
  list.forEach((stage, i) => {
    stage.ring = radii[i];
    const outer = i ? radii[i - 1] : Infinity;
    stage.breaks = cover.flatMap((o, k) => (reach(o) > radii[i] && reach(o) <= outer ? [k] : []));
  });
  return new ArenaShift('The platform breaks up', 0x7a8cff, '#bcd0ff', list, new SkyBreakLook(scene, radii));
}
