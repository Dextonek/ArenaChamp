import type { HeroKit } from '../heroes';
import { traitFor } from '../traits';

export { Attacker, type AttackOwner } from './attacker';
export { AttackFx, type AttackLook, type MeleeLook, type RangedLook } from './fx';
import type { AttackLook } from './fx';

/**
 * A hero's basic attack (MOBA style): right-click an enemy and the hero walks into range and keeps attacking it until
 * told otherwise. A melee attack is a weapon swing that lands at the end of the wind-up; a ranged attack fires a small
 * homing bolt at the end of the wind-up (it cannot be dodged by stepping aside, unlike a skillshot).
 * Rules: a blinded attacker misses ("MISS"); a stun or knock-up stops attacking; silence and root do not; shields
 * absorb attack damage like any other.
 */
export interface AttackSpec {
  kind: 'melee' | 'ranged';
  /** Reach, centre to centre (m). Ranged attacks also need line of sight. */
  range: number;
  damage: number;
  /** Seconds from one attack to the next (wind-up included). */
  interval: number;
  /** Seconds from the start of the attack to the hit (melee) or the bolt's release (ranged); moving cancels it. */
  windup: number;
  /** Bolt speed (m/s), ranged only. */
  speed: number;
  /** Bolt / slash colour (css); default the kit's accent. */
  color?: string;
  /** The look (fx.ts): a missile shape for ranged, a swing for melee. Default orb / slash. */
  look?: AttackLook;
}

/** Melee: a heavier swing at close range. */
export const MELEE_ATTACK: AttackSpec = { kind: 'melee', range: 2.6, damage: 13, interval: 1.2, windup: 0.3, speed: 0 };
/** Ranged: a lighter bolt from a distance. */
export const RANGED_ATTACK: AttackSpec = { kind: 'ranged', range: 6.5, damage: 10, interval: 1.0, windup: 0.25, speed: 18 };

/** The basic attack of a kit: the melee or ranged default (by `kit.melee`), the hero's own changes (its trait), its colour. */
export function attackFor(kit: HeroKit): AttackSpec {
  const own = traitFor(kit.name)?.attack;
  const base = (own?.kind ?? (kit.melee ? 'melee' : 'ranged')) === 'melee' ? MELEE_ATTACK : RANGED_ATTACK;
  return { ...base, color: kit.accent, ...own };
}
