/**
 * CPU difficulty for the duel's AI opponent (src/duel.ts). The game's "Play vs CPU" screen (src/game/cpu.ts) and the
 * VFX tool's duel panel pick one; `Duel.cpuLevel` holds it.
 *
 * Level 3, Normal, is the AI every kit is balanced against: its numbers are the duel's original constants and it runs
 * none of the extra rules (no cast gap, aim error, lead or zone dodge), so `_tourney` results stay comparable. The
 * autopilot (the player's hero in AI-vs-AI runs) always plays Normal.
 */
export interface CpuLevel {
  /** 1 (Novice) to 5 (Master). */
  id: number;
  name: string;
  /** One line for the level picker. */
  blurb: string;
  /** Walk speed (m/s) for a hero of base speed 4 (the player walks 4). */
  speed: number;
  /** Seconds it waits after a cast before the next one, rolled between the two (it still walks and attacks). */
  castGap: [number, number];
  /** Its spells' cooldowns are multiplied by this (Hard and Master get theirs back sooner). */
  cooldown: number;
  /** Ground casts land up to this far (m) off the spot it aims at. */
  aimError: number;
  /** Ground casts aim ahead of the player's walk by this share of the spell's time to land: 1 where the player will
   * be when it lands, 0.5 half way there, 0 at its feet. */
  lead: number;
  /** Chance to step off a skillshot's line, and the seconds before it starts moving. */
  boltDodge: number;
  boltReaction: number;
  /** Chance to walk out of the player's area zones before they land (0: never), and the seconds before it moves. */
  zoneDodge: number;
  zoneReaction: number;
  /** Chance to walk out of an arena hazard's event (rolled once per event; it starts `boltReaction` + 0.1 s later). */
  hazardDodge: number;
  /** Chance that a ready parry or bolt wall answers a hit on its way. */
  guard: number;
  /** The ultimate waits until the player is under this HP share or the round is this many seconds old. */
  ultHp: number;
  ultTime: number;
}

export const CPU_LEVELS: CpuLevel[] = [
  {
    id: 1, name: 'Novice', blurb: 'Walks slowly, casts rarely and misses a lot. Never dodges.',
    speed: 2.9, castGap: [2.2, 3.4], cooldown: 1, aimError: 2.2, lead: 0, boltDodge: 0, boltReaction: 0.5,
    zoneDodge: 0, zoneReaction: 0, hazardDodge: 0.6, guard: 0, ultHp: 0.3, ultTime: 45,
  },
  {
    id: 2, name: 'Easy', blurb: 'Slow to cast and often off target. Steps aside from a skillshot now and then.',
    speed: 3.2, castGap: [0.9, 1.8], cooldown: 1, aimError: 1.2, lead: 0, boltDodge: 0.3, boltReaction: 0.3,
    zoneDodge: 0, zoneReaction: 0, hazardDodge: 0.75, guard: 0.25, ultHp: 0.45, ultTime: 30,
  },
  {
    id: 3, name: 'Normal', blurb: 'Casts every spell as soon as it is ready and dodges some skillshots.',
    speed: 3.5, castGap: [0, 0], cooldown: 1, aimError: 0, lead: 0, boltDodge: 0.65, boltReaction: 0.12,
    zoneDodge: 0, zoneReaction: 0, hazardDodge: 0.9, guard: 0.6, ultHp: 0.55, ultTime: 20,
  },
  {
    id: 4, name: 'Hard', blurb: 'Faster, spells back 15% sooner, aims where you are walking and leaves some of your zones.',
    speed: 3.85, castGap: [0, 0], cooldown: 0.85, aimError: 0, lead: 0.5, boltDodge: 0.8, boltReaction: 0.1,
    zoneDodge: 0.45, zoneReaction: 0.25, hazardDodge: 0.95, guard: 0.8, ultHp: 0.6, ultTime: 16,
  },
  {
    id: 5, name: 'Master', blurb: 'As fast as you, spells back 20% sooner, leads every shot and dodges most of yours.',
    speed: 4, castGap: [0, 0], cooldown: 0.8, aimError: 0, lead: 1, boltDodge: 0.9, boltReaction: 0.07,
    zoneDodge: 0.8, zoneReaction: 0.15, hazardDodge: 1, guard: 0.9, ultHp: 0.65, ultTime: 12,
  },
];

/** Level 3, the AI the kits are balanced against (and the autopilot's level). */
export const CPU_NORMAL = CPU_LEVELS[2];

/** The level with this id (1-5), or Normal. */
export function cpuLevel(id: number): CpuLevel {
  return CPU_LEVELS.find((l) => l.id === id) ?? CPU_NORMAL;
}
