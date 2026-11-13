import type { PiecesDef } from './types';

/**
 * The five floors' set pieces as data (pipeline/designs/tower-worlds-pieces.md): for each, its ruler, its gatekeeper's duel, its trial
 * room and its rival. A ruler is only the moves of the plan's "Ruler moves" list (`ruler.ts` builds each `use` from the Tower's
 * moves), on a hero's model for now. `hard` multiplies the health and what a hit costs, floor by floor.
 */

/** The decks of the harbour's ruler room: the middle, and two small ones at the stern and the bow (the ring is 12 m round (0, 7)). */
const DECKS = [{ x: 0, z: 7, r: 3.7 }, { x: 0, z: 14.6, r: 2.3 }, { x: 0, z: -0.6, r: 2.3 }];

export const PIECES: PiecesDef[] = [
  {
    floor: 1, hard: 1,
    ruler: {
      name: 'The Drowned Captain', title: 'Anchor, cannon and tide', stand: 'Bram', tint: '#2f8a96', scale: 2.2, hp: 2800, speed: 2.0, stagger: { max: 100, kneel: 5 },
      room: 'harbour',
      moves: {
        anchor: { use: 'sweep', name: 'Anchor Sweep', share: 0.045, cooldown: 9 },
        cannons: { use: 'volley', name: 'Cannon Volley', share: 0.085, cooldown: 5 },
        cleave: { use: 'cleave', share: 0.12 },
        lunge: { use: 'lunge', share: 0.12 },
        raise: { use: 'raise', name: 'The Wreck Opens Fire' },
        tide: { use: 'surge', name: 'The Tide Comes In', warn: 2.6, seconds: 11, cooldown: 28 },
      },
      phases: [
        { name: 'The Captain wakes', at: 1, moves: ['anchor', 'cleave', 'lunge'], gap: [1.4, 2.2] },
        { name: 'The wreck opens fire', at: 0.66, opener: 'raise', moves: ['anchor', 'cannons', 'cleave', 'lunge'], gap: [1.3, 2.1] },
        { name: 'He calls the tide', at: 0.5, opener: 'tide', moves: ['anchor', 'cannons', 'cleave', 'lunge'], timed: { move: 'tide', first: 24, every: 26, most: 99 }, gap: [1.1, 1.8] },
      ],
      sentries: { look: 'cannon', spots: [[68, 9.6], [292, 9.6]], hp: 150, again: 22, fall: { stagger: 45 }, from: 1 },
      surge: { safe: { decks: DECKS }, burn: 0.06, slow: 0.35, name: 'The tide', look: 'sea' },
      line: 'Stand on the deck when the tide comes in',
    },
    gate: { hero: 'Marin', arena: 'harbour', level: 3, twist: { kind: 'shift', name: 'The tide comes in', early: 29 } },
    trial: { kind: 'gauntlet', height: 2 },
  },
  {
    floor: 2, hard: 1.12,
    ruler: {
      name: 'The Elder Root', title: 'The heart of the wood', stand: 'Hank', tint: '#4f8a3a', scale: 2.7, hp: 3200, speed: 0, stagger: { max: 100, kneel: 5 },
      room: 'glade',
      moves: {
        thorns: { use: 'volley', name: 'Thorn Volley', share: 0.085, cooldown: 4.5 },
        walls: { use: 'stones', name: 'Walls of Roots', share: 0.05, count: 3, radius: 1.7, cooldown: 7 },
        quake: { use: 'halves', name: 'The Wood Tilts', share: 0.09, cooldown: 12 },
        rake: { use: 'spokes', name: 'Root Spokes', share: 0.1, cooldown: 14 },
      },
      phases: [
        { name: 'The heart wakes', at: 1, moves: ['thorns', 'walls'], gap: [1.8, 2.8] },
        { name: 'The roots close in', at: 0.66, moves: ['thorns', 'walls', 'quake'], gap: [1.6, 2.4] },
        { name: 'The wood walks', at: 0.33, moves: ['thorns', 'walls', 'quake', 'rake'], gap: [1.3, 2] },
      ],
      sentries: { look: 'root', spots: [[60, 8.4], [180, 8.8], [300, 8.4]], hp: 100, again: 34, fall: { stagger: 30 }, guards: { open: 9 } },
      line: 'Cut the roots that feed it; it stands open when none is left',
    },
    gate: { hero: 'Fenna', arena: 'glade', level: 4, twist: { kind: 'shift', name: 'Roots rise as cover', early: 29 } },
    trial: { kind: 'break', height: 4 },
    rival: { hero: 'Nyx', twist: 'swift', line: 'Nyx waits in the thicket' },
  },
  {
    floor: 3, hard: 1.25,
    ruler: {
      name: 'The Scarab Colossus', title: 'Under the sand', stand: 'Sirix', tint: '#c0904a', scale: 2.5, hp: 3400, speed: 2.1, stagger: { max: 100, kneel: 5 },
      room: 'canyon',
      moves: {
        burrow: { use: 'burrow', name: 'It Burrows', share: 0.14, under: 2.6, open: 4.5, cooldown: 13 },
        cleave: { use: 'cleave', share: 0.16 },
        lunge: { use: 'lunge', share: 0.16 },
        marks: { use: 'stones', name: 'Marked Sand', share: 0.1, count: 3, cooldown: 6 },
        storm: { use: 'surge', name: 'The Storm', warn: 2.4, seconds: 9, cooldown: 26 },
      },
      phases: [
        { name: 'It stirs', at: 1, moves: ['burrow', 'cleave', 'lunge'], gap: [1.5, 2.3] },
        { name: 'The sand is marked', at: 0.6, moves: ['burrow', 'cleave', 'lunge', 'marks'], gap: [1.3, 2.1] },
        { name: 'It calls the storm', at: 0.3, opener: 'storm', moves: ['burrow', 'cleave', 'lunge', 'marks'], timed: { move: 'storm', first: 22, every: 24, most: 99 }, gap: [1.2, 1.9] },
      ],
      surge: { safe: { shell: 4.4 }, burn: 0.05, name: 'The storm', look: 'storm' },
      line: 'It goes under the sand and comes up where you stood',
    },
    gate: { hero: 'Sefu', arena: 'canyon', level: 3, twist: { kind: 'hazard', name: 'A storm crosses' } },
    trial: { kind: 'hold', height: 6 },
    rival: { hero: 'Vesper', twist: 'giant', line: 'Vesper holds the bridge' },
  },
  {
    floor: 4, hard: 1.4,
    ruler: {
      name: 'The Prism Mother', title: 'Beams in the dark', stand: 'Auriel', tint: '#7a62c8', scale: 2.6, hp: 3600, speed: 0, stagger: { max: 100, kneel: 5 },
      room: 'cavern',
      moves: {
        beams: { use: 'volley', name: 'Prism Beams', share: 0.06, cooldown: 4 },
        fan: { use: 'fan', share: 0.05 },
        stars: { use: 'stones', name: 'Falling Light', share: 0.06, light: true, count: 3, cooldown: 6 },
        rake: { use: 'spokes', name: 'Turning Light', share: 0.1, cooldown: 14 },
      },
      phases: [
        { name: 'The crystals wake', at: 1, moves: ['beams', 'fan'], gap: [1.6, 2.4] },
        { name: 'The beams turn', at: 0.66, moves: ['beams', 'fan', 'stars'], gap: [1.4, 2.2] },
        { name: 'The light goes out', at: 0.33, moves: ['beams', 'fan', 'stars', 'rake'], gap: [1.2, 1.9] },
      ],
      sentries: { look: 'crystal', spots: [[45, 8.8], [135, 8.8], [225, 8.8], [315, 8.8]], hp: 150, fall: { stagger: 30 } },
      dark: { from: 2 },
      line: 'Break a crystal to leave a gap with no beam in it',
    },
    gate: { hero: 'Opaline', arena: 'cavern', level: 3, twist: { kind: 'shift', name: 'The roof gives way', early: 29 } },
    trial: { kind: 'gauntlet', height: 8, twist: 'dark' },
  },
  {
    floor: 5, hard: 1.55,
    ruler: {
      name: 'The Last Marshal', title: 'The guard of both banners', stand: 'Zephyr', tint: '#8a8a96', scale: 2.4, hp: 3800, speed: 2.3, stagger: { max: 100, kneel: 5 },
      room: 'battlefield',
      moves: {
        guard: { use: 'call', name: 'The Guard Marches', count: 2, cooldown: 24 },
        cleave: { use: 'cleave', share: 0.08 },
        lunge: { use: 'lunge', share: 0.08 },
        rake: { use: 'spokes', name: 'The Line Burns', share: 0.08, cooldown: 14 },
      },
      phases: [
        { name: 'The Marshal wakes', at: 1, moves: ['cleave', 'lunge'], gap: [1.4, 2.2] },
        { name: 'The guard marches', at: 0.66, opener: 'guard', moves: ['guard', 'cleave', 'lunge'], gap: [1.3, 2.1] },
        { name: 'Alone on a horse of smoke', at: 0.33, moves: ['cleave', 'lunge', 'rake'], gap: [0.9, 1.5] },
      ],
      sentries: { look: 'standard', spots: [[180, 8.6]], hp: 220, fall: { kneel: true }, from: 0 },
      line: 'Fell the standard and his guard kneels',
    },
    gate: { hero: 'Oblivion', arena: 'battlefield', level: 4, twist: { kind: 'hazard', name: 'Arrows fall on a line' } },
    trial: { kind: 'horde', height: 10 },
    rival: { hero: 'Brannoc', twist: 'warded', line: 'Brannoc stands between the lines' },
  },
];

/** The set pieces of floor `n` (1..5). */
export const piecesOf = (n: number) => PIECES[n - 1];
