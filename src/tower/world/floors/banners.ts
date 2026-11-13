import { RING } from '../../../arenas/common';
import type { EnemySpec, FloorDef, PackDef, Spot } from '../def';
import { BANNERS_COVER, BANNERS_R, BANNER_PLACES, SPOTS, bannersArena } from '../f45/banners-zone';

/**
 * Floor 5, The Field of Banners, as data (pipeline/designs/tower-worlds.md, "The five floors"; the mapping on the closed vocabulary is in
 * tower-worlds-build.md). The zone's drawing and cover are `../f45/banners-zone.ts`; the law (`sides`) is `../f45/laws.ts`. Two ghost armies,
 * crimson (`r`) and azure (`b`): each site has a pack of each, and the banner the hero takes in the camp decides which of the two is gone and
 * which hunts. The siege line's guards, the Banner Bearer and the Deserter Knight belong to neither army, so a quest can ask for them whichever
 * banner was taken. Offsets (dx, dz) are from the middle of the ring.
 */
const at = (dx: number, dz: number): Spot => ({ x: RING.x + dx, z: RING.z + dz });
const look = (s: string) => s as EnemySpec['look'];
const P = BANNER_PLACES;

/** One kind of soldier in each army's colours. */
function army(a: 'r' | 'b'): Record<string, EnemySpec> {
  const col = a === 'r' ? '#e86a5a' : '#6a9aff';
  return {
    [`footman-${a}`]: { id: `footman-${a}`, name: a === 'r' ? 'Crimson footman' : 'Azure footman', blurb: 'Strikes up close.', look: look(`footman-${a}`), melee: true, hp: 95, share: 0.028, every: 1.7, speed: 3.1, scale: 1.2, shards: 4, color: col },
    [`bowman-${a}`]: { id: `bowman-${a}`, name: a === 'r' ? 'Crimson bowman' : 'Azure bowman', blurb: 'Shoots from a distance.', look: look(`bowman-${a}`), melee: false, hp: 60, share: 0.024, every: 2.5, speed: 2.8, range: 10, scale: 1.2, shards: 5, color: col },
    [`knight-${a}`]: { id: `knight-${a}`, name: a === 'r' ? 'Crimson knight' : 'Azure knight', blurb: 'Charges, and hits hard.', look: look(`knight-${a}`), melee: true, hp: 190, share: 0.055, every: 3.0, speed: 4.6, scale: 1.3, shards: 8, color: col },
  };
}

/** A site's soldiers for one army: the same mix whichever army it is. */
const site = (id: string, spot: Spot, mix: Record<string, number>): PackDef[] =>
  (['r', 'b'] as const).map((a) => ({ id: `${id}-${a}`, at: spot, mix: Object.entries(mix).map(([k, n]) => ({ kind: `${k}-${a}`, n })) }));

export const banners: FloorDef = {
  n: 5,
  id: 'banners',
  name: 'The Field of Banners',
  blurb: 'Two ghost armies still fight here. Take a side.',
  arena: bannersArena,
  cover: BANNERS_COVER,
  ring: BANNERS_R,
  start: SPOTS.start,
  camp: at(0, 36),
  places: P,
  par: 1000,
  shop: { heal: 40, boon: 65, life: 90, hint: 15 },
  law: {
    kind: 'sides',
    name: 'The war',
    blurb: 'Two ghost armies fight for ever. Take a banner in the camp: its soldiers fight beside you and the other army hunts you.',
    banners: [
      { id: 'r', name: 'Crimson Host', color: 0xb03a3a, at: SPOTS.standW, packs: ['a-r', 'b-r', 'c-r', 'd-r'] },
      { id: 'b', name: 'Azure Host', color: 0x3a62c0, at: SPOTS.standE, packs: ['a-b', 'b-b', 'c-b', 'd-b'] },
    ],
  },
  enemies: {
    ...army('r'), ...army('b'),
    ashen: { id: 'ashen', name: 'Ashen soldier', blurb: 'Belongs to neither army.', look: look('ashen'), melee: true, hp: 80, share: 0.026, every: 1.7, speed: 3.0, scale: 1.2, shards: 3, color: '#c0c8d8' },
    bearer: { id: 'bearer', name: 'The Banner Bearer', blurb: 'Carries the dead flag of both.', look: look('bearer'), melee: true, hp: 480, share: 0.06, every: 1.8, speed: 3.0, scale: 1.5, shards: 30, color: '#ffd060' },
    deserter: { id: 'deserter', name: 'The Deserter Knight', blurb: 'Walks the field and strikes hard.', look: look('deserter'), melee: true, hp: 700, share: 0.075, every: 2.2, speed: 2.8, scale: 1.4, shards: 45, color: '#b8d0a0' },
  },
  packs: [
    ...site('a', at(-30, 8), { footman: 2, bowman: 1 }),
    ...site('b', at(31, 10), { footman: 1, bowman: 1, knight: 1 }),
    ...site('c', at(22, -26), { footman: 2, knight: 1 }),
    ...site('d', at(-22, -20), { footman: 1, bowman: 2 }),
    { id: 'siege', at: at(0, -34), mix: [{ kind: 'ashen', n: 3 }], elite: 'bearer' },
    { id: 'deserter', at: at(-16, -10), mix: [{ kind: 'deserter', n: 1 }], named: { name: 'The Deserter Knight', speed: 1.7, patrol: [at(-16, -10), at(-8, -22), at(8, -22), at(15, -12), at(2, -1)], bounty: { shards: 45, relic: true } } },
  ],
  people: [
    { id: 'cantor', hero: 'Cantor', name: 'Cantor', role: 'keeper', at: at(-2.6, 36), face: 0.4, greet: ['Hush. Two armies fought here and never stopped, and I sing for both. Take a banner in the camp: its soldiers will march with you. Then take the standards, hold the hill, and break the siege line in the north. The Marshal waits behind it.'], quests: ['main', 'bounty'] },
    { id: 'whiskers', hero: 'Sir Whiskers', name: 'Sir Whiskers', role: 'giver', at: at(5.5, 33.3), face: -0.5, greet: ['I deserted. A cat of my breeding! Nine lives, and I used the first to run. Do me two small kindnesses and I will call it even.'], quests: ['cloth', 'braziers'] },
    { id: 'brannoc', hero: 'Brannoc', name: 'Brannoc', role: 'giver', at: at(-23, -32), face: 0.2, greet: ['I hold the ground between the lines. Walk through the arch behind me, and we will see which of us the field remembers.'], quests: [] },
    { id: 'cleaver', hero: 'Madame Cleaver', name: 'Madame Cleaver', role: 'trader', at: at(-5.5, 39.5), face: 0.6, greet: ['A cook feeds both armies, and both pay. Shards for what you need.'], quests: [] },
  ],
  quests: [
    {
      id: 'main', name: 'Break the Siege', giver: 'cantor', main: true,
      intro: ['Three standards stand bare on the ridges and the north works. Touch each and it flies your colours. Then hold the hill for a minute while the dead come, and break the siege line in the north.'],
      steps: [
        { verb: 'reach', text: 'Take the west standard', at: SPOTS.standardW, r: 3 },
        { verb: 'reach', text: 'Take the east standard', at: SPOTS.standardE, r: 3 },
        { verb: 'reach', text: 'Take the north standard', at: SPOTS.standardN, r: 3 },
        { verb: 'hold', text: 'Hold the hill for a minute while the dead come', at: SPOTS.hill, r: 4.6, seconds: 60, waves: { kinds: ['ashen', 'ashen', 'ashen'], every: 15 } },
        { verb: 'fell', text: 'Fell the guard of the siege line', packs: ['siege'] },
        { verb: 'open', text: 'Break the siege line: go through the gate in the north', door: 'lair' },
      ],
      outro: ['The siege line is broken. The Last Marshal is behind it, with the guard of both banners. Take your time, then go in.'],
      reward: { shards: 60, boon: true },
    },
    {
      id: 'bounty', name: 'The Deserter Knight', giver: 'cantor',
      intro: ['A knight walks the field alone, between the hill and the wagons. He ran from both banners. Fell him, and let the song close.'],
      steps: [{ verb: 'fell-named', text: 'Fell the Deserter Knight', pack: 'deserter' }],
      outro: ['A relic from a deserter. It is lighter than shame.'],
      reward: { shards: 45, relic: true },
    },
    {
      id: 'cloth', name: 'The White Cloth', giver: 'whiskers',
      intro: ['A white cloth for a truce lies at the burned wagons in the north-west. Bring it to the pavilion by the camp so both armies may see it.'],
      steps: [{ verb: 'carry', text: 'Bring the white cloth from the burned wagons to the camp', item: 'cloth', itemName: 'The white cloth', toName: 'the pavilion', from: SPOTS.cloth, to: SPOTS.tent, r: 2.4 }],
      outro: ['The cloth is hung. For a moment, nobody fights. Take this, from a cat of honour, nearly.'],
      reward: { shards: 40, boon: true },
    },
    {
      id: 'braziers', name: 'Braziers for the Dead', giver: 'whiskers',
      intro: ['Two braziers lie cold on the field, in the east and by the western road. Light them so the dead may see the way home.'],
      steps: [{ verb: 'light', text: 'Light the two braziers', things: [{ id: 'br1', at: SPOTS.brazier1 }, { id: 'br2', at: SPOTS.brazier2 }], seconds: 2 }],
      outro: ['Two fires, and the field is a little warmer. Take your share.'],
      reward: { shards: 35, boon: true },
    },
  ],
  caches: [
    { id: 'c1', at: SPOTS.cache1, shards: 25 },
    { id: 'c2', at: SPOTS.cache2, shards: 30 },
    { id: 'c3', at: SPOTS.cache3, shards: 20, boon: true },
  ],
  waystones: [
    { id: 'w1', name: 'The west road stone', at: SPOTS.way1 },
    { id: 'w2', name: 'The hill stone', at: SPOTS.way2 },
    { id: 'w3', name: 'The east road stone', at: SPOTS.way3 },
  ],
  lore: { id: 'lore', name: 'The soldiers’ stone', at: SPOTS.lore, text: ['Two armies swore to fight until the other fell. Neither has.', 'They fight on, and nobody has told them why.'] },
  doors: [
    { id: 'lair', piece: 'ruler', name: 'The Last Marshal’s gate', at: at(0, -38.4), r: 2.2, wall: { ax: RING.x - 3.4, az: RING.z - 41, bx: RING.x + 3.4, bz: RING.z - 41, r: 0.5, height: 3.8 }, locked: 'The siege line holds. Cantor has a quest about it.' },
    { id: 'trial', piece: 'trial', name: 'The Trench', at: SPOTS.trial, r: 2, locked: '' },
    { id: 'rival', piece: 'rival', name: 'Brannoc’s ground', at: SPOTS.rival, r: 2.2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: SPOTS.gate, r: 2.2, needs: { won: 'ruler' }, locked: 'The gate is sealed. Its warden answers only once the Last Marshal has fallen.' },
  ],
  rival: {
    hero: 'Brannoc', goal: 'between the lines', mode: 'duel', at: at(-23, -32), boon: true,
    lines: ['I hold the ground between the lines. Walk through the arch behind me, and we will see which of us the field remembers.'],
  },
};
