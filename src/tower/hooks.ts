import type * as THREE from 'three';
import type { BossMove } from '../raid/types';
import type { GameApi } from '../runtime';
import type { TowerLink } from './link';

/**
 * Every place where the Tower reaches into the duel for something the duel has no method for yet. The Tower may not edit the
 * engine files (src/duel.ts, src/heroMode.ts, src/arena.ts) in its first version, so each of these is done from this side in the
 * least bad way, and says what small method the engine should get instead. Search for `TOWER-HOOK` to find them all: four are
 * in this file, one is in boons.ts (the type of a boon's number) and one in floors.ts (an echo's name).
 */

let biteSeq = 800000;

/** The ids of the moves a unit's blow is sent as, one for each kind of unit, so a fall names what did it. */
export const BITES = ['keeper', 'lampbearer'] as const;
export type Bite = (typeof BITES)[number];

/**
 * A unit of the Tower's (one of a horde) hit this screen's hero for `share` of its max health.
 *
 * TOWER-HOOK: the duel should offer `Duel.hurtHero(opts: HitOptions)`: its own `hitPlayer` is private, and the units a boss
 * raises (`BossWorld.spawnAdd`) never attack. Until then the blow goes the one public way a boss's hit has: a cast of a move with
 * one unseen zone on the hero that lands at once (`biteMoves`). It keeps what a boss's hit keeps (shields, a parry, Warding, the
 * Phoenix Feather), costs a share of max health as a zone does, and names the unit as what killed. `step: 1`, so the autopilot
 * does not take it for a new move to roll its reaction for.
 */
export function bite(link: TowerLink, move: Bite, share: number, from: { x: number; z: number }, me: THREE.Vector3) {
  link.cast({ id: ++biteSeq, move, step: 1, x: +me.x.toFixed(3), z: +me.z.toFixed(3), fx: from.x, fz: from.z, dir: 0, seed: Math.round(share * 1e5), target: 0 });
}

/** The moves `bite` casts: an unseen circle under the hero that lands at once. They go in every floor's `BossDef.moves`. */
export function biteMoves(): Record<string, BossMove> {
  const out: Record<string, BossMove> = {};
  for (const id of BITES) {
    out[id] = {
      id, name: '', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
      aim: (c) => ({ x: c.target.x, z: c.target.z, dir: 0 }),
      play: (c) => ({ threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 0.45 }, at: 0, share: c.seed / 1e5, hidden: true }], duration: 0.2 }),
    };
  }
  return out;
}

/**
 * Health carries over between floors: the hero starts a floor with `hp`, not with its max.
 *
 * TOWER-HOOK: `Duel.startBoss` should take `hp?: number` (it sets `playerHp = playerMax` itself). `Duel.setPlayerHp` exists
 * for a network duel ("this side's HP as the server counts it") and does what is needed, so it is used here right after
 * `startBoss`; a start option would say what is meant.
 */
export function setHealth(api: GameApi, hp: number) {
  api.duel.setPlayerHp(Math.max(1, Math.min(api.duel.heroMax, Math.round(hp))));
}

/**
 * The Molten Steps twist: a circle that lands leaves fire for a while (what the Raid's Molten Ground omen does).
 *
 * TOWER-HOOK: `Duel.startBoss` should take the floor's twists (or `RunUpgrades` a `molten` flag the fight reads): the fight turns
 * this on only for an omen of the Raid's by its id, and never in a room with no boss. Until then the flag on the fight's script,
 * which is public, is set after `startBoss`.
 */
export function setMolten(api: GameApi) {
  const script = api.duel.boss?.script;
  if (script) script.molten = true;
}

/**
 * A hero's hit on one of the Tower's units healed it (the Thirsting Blade).
 *
 * TOWER-HOOK: `RunUpgrades.leech` and `dealtMul` act only on hits on the boss itself (`Duel.resolve`: `victim === this.foe`), so
 * a boon that heals on damage or adds damage does nothing against a horde. The duel should apply both to the boss's side's units
 * too. Until then the Tower gives its units less health by what the hero's boons add to its damage (src/tower/floors.ts,
 * `raise`), and heals from their hurt here, through the arena's own heal for its caster.
 */
export function leechFrom(api: GameApi, damage: number, share: number) {
  if (share > 0 && damage > 0) api.arena.casterHeal?.(damage * share);
}
