import { RING } from '../../../arenas/common';
import type { EnemySpec, FloorDef, Spot } from '../def';
import { DEEP_COVER, DEEP_PLACES, DEEP_R, SPOTS, deepArena } from '../f45/deep-zone';

/**
 * Floor 4, The Lightless Deep, as data (pipeline/designs/tower-worlds.md, "The five floors"; the mapping on the closed vocabulary is in
 * tower-worlds-build.md). The zone's drawing and cover are `../f45/deep-zone.ts`; the law (`dark`) is `../f45/laws.ts`. Offsets (dx, dz) are
 * from the middle of the ring.
 */
const at = (dx: number, dz: number): Spot => ({ x: RING.x + dx, z: RING.z + dz });
const look = (s: string) => s as EnemySpec['look'];
const P = DEEP_PLACES;

export const deep: FloorDef = {
  n: 4,
  id: 'deep',
  name: 'The Lightless Deep',
  blurb: 'A mine whose crystals went dark. Only what shines can be seen.',
  arena: deepArena,
  cover: DEEP_COVER,
  ring: DEEP_R,
  start: SPOTS.start,
  camp: at(0, 36),
  places: P,
  par: 900,
  shop: { heal: 35, boon: 60, life: 85, hint: 15 },
  law: {
    kind: 'dark',
    name: 'The dark',
    blurb: 'Only crystals give light. Beyond it you see nothing, and the lurkers hunt there. A great shard you carry lights a few steps; a woken crystal lights its hall for good.',
    radius: 8, lit: 18,
    lights: [at(0, 34), at(-6, 37), at(6, 31)],
  },
  enemies: {
    mite: { id: 'mite', name: 'Shard mite', blurb: 'Comes in a swarm. Small and quick.', look: look('mite'), melee: true, hp: 34, share: 0.017, every: 1.1, speed: 4.0, scale: 1.1, shards: 3, color: '#9af0ff' },
    lurker: { id: 'lurker', name: 'Lurker', blurb: 'Waits in the dark and leaps.', look: look('lurker'), melee: true, hp: 80, share: 0.045, every: 3.2, speed: 5.4, scale: 1.2, shards: 7, color: '#d8e8ff' },
    golem: { id: 'golem', name: 'Crystal golem', blurb: 'Slow. Throws a bolt back.', look: look('golem'), melee: false, hp: 240, share: 0.05, every: 3.0, speed: 1.7, range: 9, scale: 1.4, shards: 9, color: '#7ad8ff' },
    thief: { id: 'thief', name: 'The Lantern Thief', blurb: 'Carries the only lamp in the Deep that is not a crystal.', look: look('thief'), melee: true, hp: 430, share: 0.055, every: 1.7, speed: 3.4, scale: 1.5, shards: 30, color: '#ffb84a' },
    pale: { id: 'pale', name: 'The Pale One', blurb: 'Walks the Deep and strikes hard.', look: look('pale'), melee: true, hp: 650, share: 0.07, every: 2.2, speed: 2.6, scale: 1.4, shards: 45, color: '#e6f4ff' },
  },
  packs: [
    { id: 'h1', at: P.hall1, mix: [{ kind: 'mite', n: 3 }, { kind: 'golem', n: 1 }] },
    { id: 'yard', at: at(2, -1), mix: [{ kind: 'lurker', n: 2 }, { kind: 'mite', n: 2 }] },
    { id: 'h2', at: P.hall2, mix: [{ kind: 'lurker', n: 2 }, { kind: 'mite', n: 2 }] },
    { id: 'h3', at: P.hall3, mix: [{ kind: 'lurker', n: 2 }, { kind: 'golem', n: 1 }] },
    { id: 'pools', at: P.pools, mix: [{ kind: 'mite', n: 2 }], elite: 'thief' },
    { id: 'pale', at: at(-12, -6), mix: [{ kind: 'pale', n: 1 }], named: { name: 'The Pale One', speed: 1.5, patrol: [at(-12, -6), at(-6, -13), at(9, -14), at(12, -3), at(-3, 4)], bounty: { shards: 45, relic: true } } },
  ],
  people: [
    { id: 'mabel', hero: 'Mabel', name: 'Mabel', role: 'keeper', at: at(-2.6, 36), face: 0.4, greet: ['Mind the dark, climber. Three great crystals in these halls went out, and with them the way. Carry a great shard to each and they wake. The Prism Mother sits behind the rock fall in the north.'], quests: ['main', 'bounty'] },
    { id: 'isolde', hero: 'Isolde', name: 'Isolde', role: 'giver', at: at(5.5, 33.3), face: -0.5, greet: ['I lost my lantern, and my satchel with it. Without light I am only a cold woman in a cave. Perhaps you can fetch them.'], quests: ['lantern', 'lamp'] },
    { id: 'tempo', hero: 'Tempo', name: 'Tempo', role: 'rival', at: at(4, 24), face: 3.1, greet: [], quests: [] },
    { id: 'ledger', hero: 'Mr. Ledger', name: 'Mr. Ledger', role: 'trader', at: at(-5.5, 39.5), face: 0.6, greet: ['Shards for what you need. Light is dear down here, and I price it so.'], quests: [] },
  ],
  quests: [
    {
      id: 'main', name: 'The Three Crystals', giver: 'mabel', main: true,
      intro: ['Take the great shard from the cradle by my camp to the first crystal, in the west hall. Stay by it and it wakes and lights the hall. Each hall holds the next shard. Wake all three, then the rock fall will let you through.'],
      steps: [
        { verb: 'carry', text: 'Carry the great shard from the camp to the first crystal', item: 'shard', itemName: 'A great shard', toName: 'the first crystal', from: SPOTS.shard1, to: SPOTS.crystal1, r: 2.2 },
        { verb: 'light', text: 'Stay by the first crystal until it wakes', things: [{ id: 'crystal1', at: SPOTS.crystal1 }], seconds: 2 },
        { verb: 'carry', text: 'Carry the next great shard to the second crystal', item: 'shard', itemName: 'A great shard', toName: 'the second crystal', from: SPOTS.shard2, to: SPOTS.crystal2, r: 2.2 },
        { verb: 'light', text: 'Stay by the second crystal until it wakes', things: [{ id: 'crystal2', at: SPOTS.crystal2 }], seconds: 2 },
        { verb: 'carry', text: 'Carry the last great shard to the third crystal', item: 'shard', itemName: 'A great shard', toName: 'the third crystal', from: SPOTS.shard3, to: SPOTS.crystal3, r: 2.2 },
        { verb: 'light', text: 'Stay by the third crystal until it wakes', things: [{ id: 'crystal3', at: SPOTS.crystal3 }], seconds: 2 },
        { verb: 'open', text: 'Go to the rock fall in the north: the halls are lit', door: 'lair' },
      ],
      outro: ['Three halls lit, and you can see the road. The rock fall has moved. The Prism Mother is behind it. Take your time, then go in.'],
      reward: { shards: 60, boon: true },
    },
    {
      id: 'bounty', name: 'The Pale One', giver: 'mabel',
      intro: ['Something pale walks the middle of the Deep, round the cart yard. It does not need light. Fell it and the dark is a little less.'],
      steps: [{ verb: 'fell-named', text: 'Fell the Pale One', pack: 'pale' }],
      outro: ['A relic from the Pale One. Keep it.'],
      reward: { shards: 45, relic: true },
    },
    {
      id: 'lantern', name: 'The Lost Lantern', giver: 'isolde',
      intro: ['My satchel fell at the old shaft in the middle. The thief took my lantern to the glow pools in the east. Bring my light home.'],
      steps: [
        { verb: 'reach', text: 'Find Isolde’s satchel at the old shaft', at: SPOTS.shaft, r: 3 },
        { verb: 'fell', text: 'Take the lantern back from the Lantern Thief at the glow pools', packs: ['pools'] },
      ],
      outro: ['My lantern! The thief is gone and my hands are warm. Take this, from the Deep itself.'],
      reward: { shards: 40, boon: true },
    },
    {
      id: 'lamp', name: 'The Survey Lamp', giver: 'isolde',
      intro: ['The old survey lamp stands in the east of the yard. Hold it while the swarm comes, and the Deep is mapped.'],
      steps: [{ verb: 'hold', text: 'Hold the survey lamp while the swarm comes', at: SPOTS.lamp, r: 3.6, seconds: 18, waves: { kinds: ['mite', 'mite', 'mite'], every: 8 } }],
      outro: ['The lamp burned through. I have it on the map. Take your share.'],
      reward: { shards: 35, boon: true },
    },
  ],
  caches: [
    { id: 'c1', at: SPOTS.cache1, shards: 25 },
    { id: 'c2', at: SPOTS.cache2, shards: 30 },
    { id: 'c3', at: SPOTS.cache3, shards: 20, boon: true },
  ],
  waystones: [
    { id: 'w1', name: 'The first hall stone', at: SPOTS.way1 },
    { id: 'w2', name: 'The yard stone', at: SPOTS.way2 },
    { id: 'w3', name: 'The pools stone', at: SPOTS.way3 },
  ],
  lore: { id: 'lore', name: 'The miners’ stone', at: SPOTS.lore, text: ['The miners lit the crystals to find their way home.', 'When the crystals went out, the miners stayed, and learned to wait in the dark.'] },
  doors: [
    { id: 'lair', piece: 'ruler', name: 'The Prism Mother’s door', at: at(0, -44.5), r: 2.2, wall: { ax: RING.x - 3.4, az: RING.z - 41, bx: RING.x + 3.4, bz: RING.z - 41, r: 0.5, height: 4.4 }, locked: 'Fallen rock blocks the way. Mabel has a quest about the crystals.' },
    { id: 'trial', piece: 'trial', name: 'The Dark Vault', at: SPOTS.trial, r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: SPOTS.gate, r: 2.2, needs: { won: 'ruler' }, locked: 'The gate is sealed. Its warden answers only once the Prism Mother has fallen.' },
  ],
  // Tempo's race: the route is about 48 m, so 0.84 of the hero's 4 m/s (3.36 m/s) is 14 s, as floor 1's.
  rival: {
    hero: 'Tempo', goal: 'the echo well', mode: 'race', at: at(4, 24), to: SPOTS.echo, r: 3, pace: 0.84, boon: true,
    route: [at(4, 24), at(6, 12), at(8, 1), at(10, -8), at(11, -16), SPOTS.echo],
    lines: ['Tempo. I run the Deep in the dark and I never trip. To the echo well in the north: first to stand on it wins. Care to try?'],
  },
};
