import { RING } from '../../../arenas/common';
import type { FloorDef, Spot } from '../def';
import { BARRIERS, PLACES, ZONE_R, ZONE_START, ZONE_COVER, woodArena } from '../zoneWood';

/**
 * Floor 2, The Walking Wood, as data (pipeline/designs/tower-worlds.md, "The five floors"). The zone's drawing and cover are
 * `../zoneWood.ts`; this file says who lives in it, what is asked, and how the wood moves. Offsets (dx, dz) are from the middle of the ring.
 */
const at = (dx: number, dz: number): Spot => ({ x: RING.x + dx, z: RING.z + dz });
const heartPath = [at(0, -13), at(0, -26)];

export const wood: FloorDef = {
  n: 2,
  id: 'wood',
  name: 'The Walking Wood',
  blurb: 'A forest that does not stay where you left it.',
  arena: woodArena,
  cover: ZONE_COVER,
  ring: ZONE_R,
  start: ZONE_START,
  camp: at(0, 34),
  places: PLACES,
  par: 840,
  shop: { heal: 30, boon: 55, life: 80, hint: 15 },
  law: {
    kind: 'paths',
    name: 'The wood walks',
    blurb: 'Every two minutes roots close three paths and open three others. A glow marks the ways that are open.',
    every: 120, warn: 8, first: 0, walls: BARRIERS,
  },
  enemies: {
    hound: { id: 'hound', name: 'Bark hound', blurb: 'Fast, and hunts in a pack.', look: 'hound', melee: true, hp: 55, share: 0.02, every: 1.2, speed: 4.6, scale: 1.2, shards: 4, color: '#e0a060' },
    sprite: { id: 'sprite', name: 'Thorn sprite', blurb: 'Floats back and throws thorns.', look: 'sprite', melee: false, hp: 40, share: 0.022, every: 2.2, speed: 2.6, range: 10, scale: 1.55, shards: 5, color: '#ff7aa8' },
    giant: { id: 'giant', name: 'Moss giant', blurb: 'Slow, heavy, hits hard.', look: 'giant', melee: true, hp: 230, share: 0.045, every: 2.6, speed: 1.7, scale: 1.7, shards: 8, color: '#9acd6a' },
    stag: { id: 'stag', name: 'The Stag-Crowned', blurb: 'Guards the glade.', look: 'stag', melee: true, hp: 420, share: 0.055, every: 1.5, speed: 3.4, scale: 1.9, shards: 30, color: '#ffe08a' },
    oak: { id: 'oak', name: 'The Hollow Oak', blurb: 'Walks the old road and strikes hard.', look: 'oak', melee: true, hp: 620, share: 0.065, every: 2.2, speed: 2.0, scale: 2.4, shards: 40, color: '#e0c080' },
    root: { id: 'root', name: 'Feeding root', blurb: 'A root that feeds the Elder Root. It cannot move; it throws thorns.', look: 'root', melee: false, hp: 150, share: 0.03, every: 3, speed: 0, range: 11, scale: 1.6, shards: 10, color: '#c8f080' },
  },
  packs: [
    { id: 'den', at: PLACES.den, mix: [{ kind: 'hound', n: 4 }] },
    { id: 'bramble', at: PLACES.bramble, mix: [{ kind: 'sprite', n: 3 }] },
    { id: 'giants', at: PLACES.giants, mix: [{ kind: 'giant', n: 2 }], elite: 'stag' },
    { id: 'oak', at: at(-4, -4), mix: [{ kind: 'oak', n: 1 }], named: { name: 'The Hollow Oak', speed: 1.6, patrol: [at(-4, -4), at(-4, -19), at(4, -19), at(4, -4)], bounty: { shards: 40, relic: true } } },
    { id: 'root1', at: at(-6.5, -31), mix: [{ kind: 'root', n: 1 }] },
    { id: 'root2', at: at(6.5, -31), mix: [{ kind: 'root', n: 1 }] },
    { id: 'root3', at: at(0, -36), mix: [{ kind: 'root', n: 1 }] },
  ],
  people: [
    { id: 'bo', hero: 'Bo', name: 'Bo', role: 'keeper', at: at(-2.6, 36.4), face: 0.4, greet: ['Careful, climber. The wood walks, and my sheep walk with it. Three wisps are bound in it, and the Elder Root at its heart is hungry.'], quests: ['main', 'bounty'] },
    { id: 'mortis', hero: 'Mortis', name: 'Mortis', role: 'giver', at: at(3.6, 36), face: -0.5, greet: ['I dig. I find. I lose things in the finding. Maybe you can bring them back.'], quests: ['mortis-lamps', 'mortis-spade'] },
    { id: 'nyx', hero: 'Nyx', name: 'Nyx', role: 'rival', at: at(-24.5, -22), face: 0.9, greet: [], quests: [] },
    { id: 'silvane', hero: 'Silvane', name: 'Silvane', role: 'trader', at: at(-4.6, 33.2), face: 0.6, greet: ['Shards for what you need. The wood takes nothing back, so I take shards.'], quests: [] },
  ],
  quests: [
    {
      id: 'main', name: 'The Heart of the Wood', giver: 'bo', main: true,
      intro: ['Free three wisps: stand by each one and it follows you. Lead them to the heart. Then cut the three roots that feed the Elder Root, and its door opens.'],
      steps: [
        { verb: 'lead', text: 'Free the wisp in the hounds’ den and lead it to the heart', name: 'The wisp', look: 'wisp', speed: 3, from: at(-33.5, 6), r: 3, path: heartPath },
        { verb: 'lead', text: 'Free the wisp in the bramble and lead it to the heart', name: 'The wisp', look: 'wisp', speed: 3, from: at(33.5, 6), r: 3, path: heartPath },
        { verb: 'lead', text: 'Free the wisp in the thicket and lead it to the heart', name: 'The wisp', look: 'wisp', speed: 3, from: at(-31, -17), r: 3, path: heartPath },
        { verb: 'fell', text: 'Cut the three roots that feed the Elder Root', packs: ['root1', 'root2', 'root3'] },
        { verb: 'open', text: 'Go to the Elder Root’s door', door: 'lair' },
      ],
      outro: ['The wisps are home, the roots are cut. The Elder Root’s door stands open, far in the north. Rest first, then go in.'],
      reward: { shards: 60, boon: true },
    },
    {
      id: 'bounty', name: 'The Hollow Oak', giver: 'bo',
      intro: ['An oak walks the old road to the heart. Hollow, and a hundred winters old. Fell it and the wood grows calmer.'],
      steps: [{ verb: 'fell-named', text: 'Fell the Hollow Oak', pack: 'oak' }],
      outro: ['A relic from an oak. Keep it.'],
      reward: { shards: 40, relic: true },
    },
    {
      id: 'mortis-lamps', name: 'The Spore Lamps', giver: 'mortis',
      intro: ['Two spore lamps stand on the paths west and east of the camp. Light both, stand by each a moment, and I can see where to dig.'],
      steps: [{ verb: 'light', text: 'Light the two spore lamps', things: [{ id: 'lamp1', at: at(-19, 20.2) }, { id: 'lamp2', at: at(19, 20.2) }], seconds: 2 }],
      outro: ['Now I can see. Take this, it was in the dirt.'],
      reward: { shards: 35, boon: true },
    },
    {
      id: 'mortis-spade', name: 'The Lost Spade', giver: 'mortis',
      intro: ['My spade lies in the bramble, where the thorns took it. Carry it back to the camp fire. A hit and you drop it.'],
      steps: [{ verb: 'carry', text: 'Bring Mortis’s spade from the bramble to the fire', item: 'spade', itemName: 'The spade', toName: 'the camp fire', look: 'bundle', plain: true, from: at(31.5, 8.5), to: at(1.6, 30.6), r: 2.2 }],
      outro: ['My spade! Here, for the trouble.'],
      reward: { shards: 45 },
    },
  ],
  caches: [
    { id: 'c1', at: at(-37, -6), shards: 25 },
    { id: 'c2', at: at(41, 17.2), shards: 30 },
    { id: 'c3', at: at(-12.8, -11.4), shards: 20, boon: true },
  ],
  waystones: [
    { id: 'w1', name: 'The den road stone', at: at(-12.5, 25.5) },
    { id: 'w2', name: 'The bramble road stone', at: at(12.5, 25.5) },
    { id: 'w3', name: 'The thicket stone', at: at(-25, -30.5) },
  ],
  lore: { id: 'lore', name: 'The root stone', at: at(-6, -35), text: ['The wood was a field once. It walked away from the plough and has been walking since.', 'What you take for paths are roots, and what you take for roots are paths.'] },
  doors: [
    { id: 'lair', piece: 'ruler', name: 'The Elder Root’s door', at: at(0, -44.5), r: 2.2, wall: { ax: RING.x - 3.4, az: RING.z - 41, bx: RING.x + 3.4, bz: RING.z - 41, r: 0.5, height: 3.6 }, locked: 'Roots hold the door shut. Bo has a quest about the wisps.' },
    { id: 'trial', piece: 'trial', name: 'The Hollow Stump', at: at(-25.5, 36.5), r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: at(25.5, 37), r: 2.2, needs: { won: 'ruler' }, locked: 'The gate is sealed. Its warden answers only once the Elder Root has fallen.' },
    { id: 'rival', piece: 'rival', name: 'Nyx’s thicket', at: at(-31.5, -26.5), r: 2, locked: '' },
  ],
  rival: {
    hero: 'Nyx', goal: 'the thicket', mode: 'duel', at: at(-24.5, -22), boon: true,
    lines: ['Another climber. I am Nyx, and I hunt in the dark. Walk through the arch behind me and we see who is quicker. Win, and I fight beside you.'],
  },
};
