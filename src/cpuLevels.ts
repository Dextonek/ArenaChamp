/**
 * CPU difficulty for the duel's AI opponent (src/duel.ts). The game's "Play vs CPU" screen (src/game/cpu.ts) and the
 * VFX tool's duel panel pick one; `Duel.cpuLevel` holds it.
 *
 * Five levels for players, and CPU_BALANCE, the AI the kits are balanced against, which the autopilot (the player's hero
 * in AI-vs-AI runs) always plays.
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
  /** Its spells' cooldowns are multiplied by this (lower levels get theirs back later, Hard and Master sooner). */
  cooldown: number;
  /** The damage it deals is multiplied by this. */
  damage: number;
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

/**
 * The levels a player picks. They sit below the balance AI (`CPU_BALANCE`) on purpose: a person reacts slower than the
 * autopilot, and the user found the old levels too hard (2026-11-04). Hard is about the old Normal, Master a little under
 * the old Hard. `damage` is the one lever beyond play skill, along with the cooldowns.
 */
export const CPU_LEVELS: CpuLevel[] = [
  {
    id: 1, name: 'Novice', blurb: 'Walks slowly, casts rarely, misses a lot and hits softly. Never dodges.',
    speed: 2.7, castGap: [2.6, 4], cooldown: 1.3, damage: 0.7, aimError: 2.6, lead: 0, boltDodge: 0, boltReaction: 0.5,
    zoneDodge: 0, zoneReaction: 0, hazardDodge: 0.5, guard: 0, ultHp: 0.25, ultTime: 60,
  },
  {
    id: 2, name: 'Easy', blurb: 'Slow to cast and often off target. Rarely steps aside from a skillshot.',
    speed: 3.0, castGap: [1.4, 2.4], cooldown: 1.15, damage: 0.8, aimError: 1.6, lead: 0, boltDodge: 0.15, boltReaction: 0.35,
    zoneDodge: 0, zoneReaction: 0, hazardDodge: 0.65, guard: 0.15, ultHp: 0.35, ultTime: 40,
  },
  {
    id: 3, name: 'Normal', blurb: 'Takes a moment between spells and dodges some skillshots.',
    speed: 3.3, castGap: [0.6, 1.2], cooldown: 1.05, damage: 0.9, aimError: 0.6, lead: 0, boltDodge: 0.4, boltReaction: 0.2,
    zoneDodge: 0, zoneReaction: 0, hazardDodge: 0.8, guard: 0.35, ultHp: 0.45, ultTime: 28,
  },
  {
    id: 4, name: 'Hard', blurb: 'Casts as soon as it can, aims where you are walking and dodges often.',
    speed: 3.6, castGap: [0.2, 0.5], cooldown: 0.95, damage: 1, aimError: 0, lead: 0.3, boltDodge: 0.6, boltReaction: 0.15,
    zoneDodge: 0.3, zoneReaction: 0.3, hazardDodge: 0.9, guard: 0.6, ultHp: 0.55, ultTime: 20,
  },
  {
    id: 5, name: 'Master', blurb: 'Nearly as fast as you, spells back sooner, leads its shots and dodges most of yours.',
    speed: 3.9, castGap: [0, 0], cooldown: 0.85, damage: 1, aimError: 0, lead: 0.8, boltDodge: 0.8, boltReaction: 0.1,
    zoneDodge: 0.65, zoneReaction: 0.2, hazardDodge: 1, guard: 0.8, ultHp: 0.6, ultTime: 14,
  },
];

/**
 * The AI every kit is balanced against, and the autopilot's level: the duel's original constants, none of the extra rules
 * (no cast gap, aim error, lead or zone dodge). Not offered to players. `_tourney` and `_balance` run at this.
 */
export const CPU_BALANCE: CpuLevel = {
  id: 0, name: 'Balance', blurb: 'The AI the kits are balanced against.',
  speed: 3.5, castGap: [0, 0], cooldown: 1, damage: 1, aimError: 0, lead: 0, boltDodge: 0.65, boltReaction: 0.12,
  zoneDodge: 0, zoneReaction: 0, hazardDodge: 0.9, guard: 0.6, ultHp: 0.55, ultTime: 20,
};

/** Level 3, the default a player starts on. */
export const CPU_NORMAL = CPU_LEVELS[2];

/** The level with this id (1-5), or Normal. */
export function cpuLevel(id: number): CpuLevel {
  return CPU_LEVELS.find((l) => l.id === id) ?? CPU_NORMAL;
}
