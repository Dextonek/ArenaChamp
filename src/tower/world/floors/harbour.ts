import { RING } from '../../../arenas/common';
import type { FloorDef, Spot } from '../def';
import { PLACES, TIDE_LOW, ZONE_COVER, ZONE_R, ZONE_START, zoneArena } from '../zone';

/**
 * Floor 1, The Drowned Harbour, as data (pipeline/designs/tower-worlds.md). The zone's drawing and cover are `../zone.ts`; this file
 * says who lives in it, what is asked, what the tide does. Offsets (dx, dz) are from the middle of the ring.
 */
const at = (dx: number, dz: number): Spot => ({ x: RING.x + dx, z: RING.z + dz });

export const harbour: FloorDef = {
  n: 1,
  id: 'harbour',
  name: 'The Drowned Harbour',
  blurb: 'A quay the sea took back, and keeps taking.',
  arena: zoneArena,
  cover: ZONE_COVER,
  ring: ZONE_R,
  start: ZONE_START,
  camp: at(0, 36),
  places: PLACES,
  par: 780,
  shop: { heal: 30, boon: 55, life: 80, hint: 15 },
  law: {
    kind: 'tide',
    name: 'The tide',
    blurb: 'Every 80 seconds the sea comes in for 15: the low ground floods, slows and hurts. Quays and decks stay dry.',
    every: 80, lasts: 15, warn: 7, burn: 0.02, slow: 0.6,
    low: TIDE_LOW, // the same seven as before; the zone's ground draws them as tidal flats
  },
  enemies: {
    docker: { id: 'docker', name: 'Drowned docker', blurb: 'Strikes up close.', look: 'docker', melee: true, hp: 70, share: 0.024, every: 1.8, speed: 3.2, scale: 1.3, shards: 4, color: '#7fd0c0' },
    netter: { id: 'netter', name: 'Net caster', blurb: 'Throws a net: you are rooted a moment.', look: 'netter', melee: false, hp: 50, share: 0.02, every: 2.8, speed: 2.8, range: 9, scale: 1.3, net: { kind: 'root', seconds: 0.8 }, shards: 5, color: '#9fe0a0' },
    crab: { id: 'crab', name: 'Brine crab', blurb: 'Slow and armoured.', look: 'crab', melee: true, hp: 170, share: 0.035, every: 2.4, speed: 1.9, scale: 1.4, shards: 7, color: '#e08a70' },
    mate: { id: 'mate', name: 'The Harbourmaster’s Mate', blurb: 'Guards the wreck.', look: 'mate', melee: true, hp: 360, share: 0.05, every: 1.6, speed: 3.0, scale: 1.9, shards: 30, color: '#ffd27a' },
    barnacle: { id: 'barnacle', name: 'Old Barnacle', blurb: 'Walks the quay and strikes hard.', look: 'barnacle', melee: true, hp: 520, share: 0.06, every: 2.0, speed: 2.6, scale: 2.3, shards: 40, color: '#c8e0a0' },
  },
  packs: [
    { id: 'market', at: PLACES.market, mix: [{ kind: 'docker', n: 2 }, { kind: 'netter', n: 1 }, { kind: 'crab', n: 1 }] },
    { id: 'wreck', at: PLACES.wreck, mix: [{ kind: 'docker', n: 2 }], elite: 'mate' },
    { id: 'caves', at: { x: PLACES.caves.x, z: PLACES.caves.z + 0.5 }, mix: [{ kind: 'docker', n: 2 }, { kind: 'netter', n: 2 }, { kind: 'crab', n: 1 }] },
    { id: 'barnacle', at: at(-14, -12), mix: [{ kind: 'barnacle', n: 1 }], named: { name: 'Old Barnacle', speed: 1.6, patrol: [at(-14, -12), at(10, -14), at(14, 2), at(-11, 0)], bounty: { shards: 40, relic: true } } },
  ],
  people: [
    { id: 'gus', hero: 'Gus', name: 'Gus', role: 'keeper', at: at(-2.6, 36), face: 0.4, greet: ['Another climber. The tide took the last ones, and the market is overrun. The Drowned Captain sits in his lair to the north, behind a chain only the captain’s key will lift.'], quests: ['main', 'bounty'] },
    { id: 'anka', hero: 'Anka', name: 'Anka', role: 'giver', at: at(5.5, 33.3), face: -0.5, greet: ['The sea washed me up here. I keep losing things to it. Perhaps you can fetch them.'], quests: ['anka-net', 'anka-tam'] },
    { id: 'zephyr', hero: 'Zephyr', name: 'Zephyr', role: 'rival', at: at(4, 24), face: 3.1, greet: [], quests: [] },
    { id: 'pip', hero: 'Pip', name: 'Pip', role: 'trader', at: at(-5.5, 39.5), face: 0.6, greet: ['Shards for what you need. Prices are fixed; the sea does not haggle either.'], quests: [] },
  ],
  quests: [
    {
      id: 'main', name: 'The Captain’s Key', giver: 'gus', main: true,
      intro: ['Three things. Clear the fish market, where they gather. Then light the lighthouse so the boats know the harbour lives. Last, the captain’s key lies in the wreck: bring it to the winch by the camp.'],
      steps: [
        { verb: 'fell', text: 'Clear the fish market', packs: ['market'] },
        { verb: 'light', text: 'Light the lighthouse', things: [{ id: 'lighthouse', at: at(24, -19) }], seconds: 2 },
        { verb: 'carry', text: 'Bring the captain’s key from the wreck to the winch', item: 'key', itemName: 'The captain’s key', toName: 'the winch', from: at(26, 8.5), to: at(13.5, 38.5), r: 2.2, opens: 'lair' },
      ],
      outro: ['The chain falls. The Drowned Captain’s door stands open, far in the north. Take your time, then go in.'],
      reward: { shards: 60, boon: true },
    },
    {
      id: 'bounty', name: 'Old Barnacle', giver: 'gus',
      intro: ['Old Barnacle walks the quay in the middle of the harbour. A hundred tides on him. Fell him and the sea quietens a little.'],
      steps: [{ verb: 'fell-named', text: 'Fell Old Barnacle', pack: 'barnacle' }],
      outro: ['A relic from a barnacle. Keep it.'],
      reward: { shards: 40, relic: true },
    },
    {
      id: 'anka-net', name: 'The Net Lines', giver: 'anka',
      intro: ['My boat lies at the old slip in the west. My net lines are hauled from a spot far in the north: hold the place while I do.'],
      steps: [
        { verb: 'reach', text: 'Find Anka’s boat at the old slip', at: at(-30, -9), r: 3 },
        { verb: 'hold', text: 'Hold the net spot while the lines come in', at: at(4, -24), r: 3.6, seconds: 18, waves: { kinds: ['docker', 'docker', 'docker'], every: 9 } },
      ],
      outro: ['The lines are in. Take this, from the sea’s own pockets.'],
      reward: { shards: 35, boon: true },
    },
    {
      id: 'anka-tam', name: 'Tam the Net-Mender', giver: 'anka',
      intro: ['Tam mends nets in the caves. He will not come out alone. Walk him back to the camp; stand close and he follows the road.'],
      steps: [{ verb: 'lead', text: 'Lead Tam from the caves to the camp', name: 'Tam', from: at(-17, -24), r: 2.5, path: [at(-22, -24), at(-27, -12), at(-29, -1), at(-27.5, 3.5), at(-17, 10), at(-10, 20.5), at(0, 27), at(0, 31)] }],
      outro: ['Tam is home. He pays in what he has.'],
      reward: { shards: 45 },
    },
  ],
  caches: [
    { id: 'c1', at: at(-41, 14), shards: 25 },
    { id: 'c2', at: at(40, -3), shards: 30 },
    { id: 'c3', at: at(-8, -37.5), shards: 20, boon: true },
  ],
  waystones: [
    { id: 'w1', name: 'The market stone', at: at(-19, 6) },
    { id: 'w2', name: 'The wreck stone', at: at(19, 12.5) },
    { id: 'w3', name: 'The lighthouse stone', at: at(14, -22) },
  ],
  lore: { id: 'lore', name: 'The tide stone', at: at(36, 30), text: ['The sea came in once and kept what it liked.', 'Those who swore to the harbour still stand watch, drowned, at their posts.'] },
  doors: [
    { id: 'lair', piece: 'ruler', name: 'The Drowned Captain’s lair', at: at(0, -44.5), r: 2.2, wall: { ax: RING.x - 3.4, az: RING.z - 41, bx: RING.x + 3.4, bz: RING.z - 41, r: 0.5, height: 3.6 }, locked: 'A chain holds the lair shut. Gus has a quest about a key.' },
    { id: 'trial', piece: 'trial', name: 'The Flooded Vault', at: at(-36, 24), r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: at(-15, 40), r: 2.2, needs: { won: 'ruler' }, locked: 'The gate is sealed. Its warden answers only once the Drowned Captain has fallen.' },
  ],
  // The runner's pace: the route is 50.4 m, so 0.84 of the hero's 4 m/s (3.36 m/s) is 15 s. A hero that goes straight from the card is at the
  // lighthouse (within 3 m) in 9.4 s, and a thumb on a phone with the cover in the way in about 12: it wins by 3 s or so. One that stops to
  // fight, or goes round by a cache, is later than 15 s and loses. (It was 0.5 at first: 25 s, and nobody could lose.)
  rival: {
    hero: 'Zephyr', goal: 'the lighthouse', mode: 'race', at: at(4, 24), to: at(24, -19), r: 3, pace: 0.84, boon: true,
    route: [at(4, 24), at(10, 16), at(10, 2), at(12, -6), at(17, -14), at(23.5, -17.8), at(24, -19)],
    lines: ['Another climber? I am Zephyr, and I am faster. To the lighthouse and back: whoever touches the foot first. Care to try?'],
  },
};
