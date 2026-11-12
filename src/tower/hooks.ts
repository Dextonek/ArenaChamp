import type { GameApi } from '../runtime';
import type { TowerBoons } from './boons';

/**
 * Every place where the Tower reaches into the duel for something the duel has no method for yet. The Tower may not edit the
 * engine files (src/duel.ts, src/heroMode.ts, src/arena.ts) in its first version, so each of these is done from this side in the
 * least bad way, and says what small method the engine should get instead. Search for `TOWER-HOOK` to find them all: three are
 * in this file, one is in boons.ts (the type of a boon's number) and one in floors.ts (an echo's name). Two the duel has since got
 * (2026-11-12): `Duel.hurtHero` for a unit's blow (`bite`) and `startBoss({ hp })` for the health a floor starts with.
 */

/** The kinds of unit a blow comes from, so a fall names what did it. */
export const BITES = ['keeper', 'lampbearer'] as const;
export type Bite = (typeof BITES)[number];

/**
 * A unit of the Tower's (one of a horde) hit this screen's hero for `share` of its max health, through the duel's own
 * `Duel.hurtHero`: what a boss's zone does when it lands. It keeps what a boss's hit keeps (shields, a parry, Warding, the
 * Phoenix Feather), costs more once the fight has enraged and under a twist that makes hits harder (as a zone does), and names the
 * unit as what killed. (Until 2026-11-12 this was a cast of a move with one unseen zone under the hero, the one public way a
 * boss's hit had.)
 */
export function bite(api: GameApi, move: Bite, share: number, from: { x: number; z: number }) {
  const script = api.duel.boss?.script;
  api.duel.hurtHero({ share: share * (script?.rage ?? 1) * (script?.harm ?? 1), from, move });
}

/**
 * The hero's health between floors, after a boon that heals: what the screen shows until the next floor starts. A floor's own
 * start says its health to the duel (`Duel.startBoss({ hp })`); this is `Duel.setPlayerHp`, for the moments in between.
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

/** What Sunlit's shield is worth, as a share of the hero's own max health, and how long it lasts (s): the Raid's Sun Eater's numbers. */
const SUNLIT = { share: 0.1, seconds: 8 };

/**
 * Sunlit: a shield for standing in a gold zone as it lands.
 *
 * TOWER-HOOK: the fight wires this (`BossScript.ateSun`) only in a room with a boss (`!def.hall`), and the Tower's gold circles
 * are mostly in a room with none (Hold out). The fight should wire it whatever the room. Until then the script's own field,
 * which is public, is set after `startBoss` where the fight left it empty.
 */
export function setSunlit(api: GameApi, boons: TowerBoons) {
  const script = api.duel.boss?.script;
  if (!script || script.ateSun || !boons.has('tw-sun')) return;
  script.ateSun = () => {
    // A share of the hero's own max, before Thick Hide, as a boss's hit is.
    if (api.duel.heroHp > 0) api.arena.shieldFigure(api.arena.caster, (SUNLIT.share * api.duel.heroMax) / boons.hpMul(), SUNLIT.seconds, '#ffcf4a');
  };
}
