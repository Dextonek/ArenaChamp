import { RING } from '../../../arenas/common';
import type { FloorDef, Spot } from '../def';
import { PLACES, ZONE_COVER, ZONE_R, ZONE_START, canyonZoneArena } from '../zoneCanyon';

/**
 * Floor 3, The Storm Canyon, as data (pipeline/designs/tower-worlds.md, "The five floors"). The zone's drawing and cover are
 * `../zoneCanyon.ts`; this file says who lives in it, what is asked, and how the storm crosses. Offsets (dx, dz) are from the middle of the ring.
 */
const at = (dx: number, dz: number): Spot => ({ x: RING.x + dx, z: RING.z + dz });
const wells = { w1: at(-25, 18.4), w2: at(26, 8.4), w3: at(-22, -9.6) };
const spring = at(7, 36.4);
const water = (n: string, to: Spot, name: string) => ({ verb: 'carry' as const, text: `Carry water from the camp spring to the ${name}`, item: 'water', itemName: 'A jar of water', toName: `the ${name}`, look: 'jar' as const, plain: true, from: spring, to, r: 2.6 });

export const canyon: FloorDef = {
  n: 3,
  id: 'canyon',
  name: 'The Storm Canyon',
  blurb: 'A dry road between red walls, and a wind that crosses it.',
  arena: canyonZoneArena,
  cover: ZONE_COVER,
  ring: ZONE_R,
  start: ZONE_START,
  camp: at(0, 34),
  places: PLACES,
  par: 900,
  shop: { heal: 30, boon: 55, life: 80, hint: 15 },
  law: {
    kind: 'storm',
    name: 'The storm',
    blurb: 'Every 90 seconds a wall of sand crosses the canyon from the north. Inside it you see a few steps and it hurts, unless you stand behind a rock.',
    every: 90, lasts: 40, warn: 8, burn: 0.04, width: 20, shelter: 7, sight: 5,
    wraiths: { kind: 'wraith', n: 2, every: 4, most: 4 },
  },
  enemies: {
    raider: { id: 'raider', name: 'Raider', blurb: 'Strikes up close.', look: 'raider', melee: true, hp: 75, share: 0.026, every: 1.6, speed: 3.3, scale: 1.3, shards: 4, color: '#ff9a6a' },
    slinger: { id: 'slinger', name: 'Slinger', blurb: 'Throws stones from a distance.', look: 'slinger', melee: false, hp: 48, share: 0.022, every: 2.4, speed: 2.7, range: 11, scale: 1.3, shards: 5, color: '#ffd27a' },
    wraith: { id: 'wraith', name: 'Dust wraith', blurb: 'Lives only in the storm.', look: 'wraith', melee: true, hp: 45, share: 0.02, every: 1.4, speed: 3.8, scale: 1.2, shards: 3, color: '#e8d0a0' },
    chief: { id: 'chief', name: 'The Raider Chief', blurb: 'Leads the raiders of the fort.', look: 'chief', melee: true, hp: 400, share: 0.055, every: 1.5, speed: 3.1, scale: 1.8, shards: 30, color: '#ffe08a' },
    mother: { id: 'mother', name: 'The Dune Mother', blurb: 'Walks the canyon and strikes hard.', look: 'mother', melee: true, hp: 560, share: 0.065, every: 2.0, speed: 2.3, scale: 2.2, shards: 40, color: '#ffd060' },
  },
  packs: [
    { id: 'well1', at: at(-25, 19.5), mix: [{ kind: 'raider', n: 2 }, { kind: 'slinger', n: 1 }] },
    { id: 'well2', at: at(26, 9.5), mix: [{ kind: 'slinger', n: 2 }, { kind: 'raider', n: 1 }] },
    { id: 'ridge', at: at(-24, -24), mix: [{ kind: 'slinger', n: 3 }] },
    { id: 'fort', at: at(25, -27), mix: [{ kind: 'raider', n: 2 }], elite: 'chief' },
    { id: 'gate', at: at(0, -33), mix: [{ kind: 'raider', n: 2 }, { kind: 'slinger', n: 1 }] },
    { id: 'mother', at: at(-9, 4), mix: [{ kind: 'mother', n: 1 }], named: { name: 'The Dune Mother', speed: 1.6, patrol: [at(-9, 4), at(9, 4), at(9, -10), at(-9, -10)], bounty: { shards: 40, relic: true } } },
  ],
  people: [
    { id: 'pip', hero: 'Pip', name: 'Pip', role: 'keeper', at: at(-2.6, 36.4), face: 0.4, greet: ['Courier. I carry what is needed, and nothing here has water. Three wells have gone dry, a caravan is waiting, and the raiders hold the gate in the north.'], quests: ['main', 'bounty'] },
    { id: 'kaia', hero: 'Kaia', name: 'Kaia', role: 'giver', at: at(3.6, 36), face: -0.5, greet: ['I watch the storms. Every ninety seconds, one. If you need me, I am the one behind the rock.'], quests: ['kaia-fires', 'kaia-tower'] },
    { id: 'vesper', hero: 'Vesper', name: 'Vesper', role: 'rival', at: at(-30, -4.5), face: 0.9, greet: [], quests: [] },
    { id: 'wick', hero: 'Wick', name: 'Wick', role: 'trader', at: at(-4.6, 33.2), face: 0.6, greet: ['Shards for what you need. Sand is free; everything else costs.'], quests: [] },
  ],
  quests: [
    {
      id: 'main', name: 'Water for the Road', giver: 'pip', main: true,
      intro: ['Fill three jars at the camp spring and pour them into the three wells. Then bring the caravan through the canyon to the far end, and clear the raiders from the gate.'],
      steps: [
        { ...water('w1', wells.w1, 'west well') },
        { ...water('w2', wells.w2, 'east well') },
        { ...water('w3', wells.w3, 'north well') },
        { verb: 'lead', text: 'Lead the caravan from the camp to the far end of the canyon', name: 'The caravan', look: 'cart', speed: 2.2, from: at(12, 35), r: 3, path: [at(0, 22), at(-2, 6), at(0, -12), at(0, -26)] },
        { verb: 'fell', text: 'Clear the raiders from the gate', packs: ['gate'] },
        { verb: 'open', text: 'Go to the raiders’ gate', door: 'lair' },
      ],
      outro: ['The wells are full and the caravan is through. The raiders’ gate stands open, far in the north. Rest first, then go in.'],
      reward: { shards: 60, boon: true },
    },
    {
      id: 'bounty', name: 'The Dune Mother', giver: 'pip',
      intro: ['A hooded woman of sand walks the middle of the canyon. Nobody has crossed it twice. Fell her and the road is quieter.'],
      steps: [{ verb: 'fell-named', text: 'Fell the Dune Mother', pack: 'mother' }],
      outro: ['A relic from the dunes. Keep it.'],
      reward: { shards: 40, relic: true },
    },
    {
      id: 'kaia-fires', name: 'The Watch Fires', giver: 'kaia',
      intro: ['Two watch fires stand cold on the road. Light both, standing by each a moment, and I will see the storm coming.'],
      steps: [{ verb: 'light', text: 'Light the two watch fires', things: [{ id: 'fire1', at: at(-13, 20) }, { id: 'fire2', at: at(15, 12) }], seconds: 2 }],
      outro: ['Now I see it coming. Take this, from the last storm.'],
      reward: { shards: 35, boon: true },
    },
    {
      id: 'kaia-tower', name: 'The Watchtower', giver: 'kaia',
      intro: ['There is a watchtower by the old fort. Reach it and hold it while I take the count. The raiders will not like it.'],
      steps: [
        { verb: 'reach', text: 'Go to the watchtower by the fort', at: at(14, -18), r: 3 },
        { verb: 'hold', text: 'Hold the watchtower', at: at(14, -18), r: 3.6, seconds: 16, waves: { kinds: ['raider', 'raider', 'slinger'], every: 8 } },
      ],
      outro: ['The count is done. Take your share.'],
      reward: { shards: 45, boon: true },
    },
  ],
  caches: [
    { id: 'c1', at: at(-33, 11.9), shards: 25 },
    { id: 'c2', at: at(33, -13.8), shards: 30 },
    { id: 'c3', at: at(-26, -28.7), shards: 20, boon: true },
  ],
  waystones: [
    { id: 'w1', name: 'The camp stone', at: at(-10, 28) },
    { id: 'w2', name: 'The middle stone', at: at(4, 16) },
    { id: 'w3', name: 'The gate stone', at: at(11, -22) },
  ],
  lore: { id: 'lore', name: 'The wind stone', at: at(-11, -31), text: ['The caravans came for the water, and the wind came for the caravans.', 'Only the rocks remember the way, and they will not move for you.'] },
  doors: [
    { id: 'lair', piece: 'ruler', name: 'The raiders’ gate', at: at(0, -44.5), r: 2.2, wall: { ax: RING.x - 3.4, az: RING.z - 41, bx: RING.x + 3.4, bz: RING.z - 41, r: 0.6, height: 3.8 }, locked: 'The gate is barred from the inside. Pip has a quest about the road.' },
    { id: 'trial', piece: 'trial', name: 'The Dust Court', at: at(-27.8, 36.2), r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: at(27.8, 36.5), r: 2.2, needs: { won: 'ruler' }, locked: 'The gate is sealed. Its warden answers only once the Scarab Colossus has fallen.' },
    { id: 'rival', piece: 'rival', name: 'Vesper’s bridge', at: at(-34.5, -10), r: 2, locked: '' },
  ],
  rival: {
    hero: 'Vesper', goal: 'the bridge', mode: 'duel', at: at(-30, -4.5), boon: true,
    lines: ['A climber on my road. I am Vesper. I hold the bridge, and nobody crosses without a word with me. Step through the arch and we talk with our hands. Win, and I fight beside you.'],
  },
};
