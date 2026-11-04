import * as THREE from 'three';
import { setTurretPower } from '../effects/parts/clockwork';
import type { Trait, TraitView } from './types';

/** Overclock: her turrets within this many metres of her shoot 30% faster; in Siege Mode, turrets within `SIEGE_REACH` shoot twice as fast. */
export const OVERCLOCK_R = 5;
export const OVERCLOCK_RATE = 1.3;
export const SIEGE_REACH = 8;
export const SIEGE_RATE = 2;
/** Siege Mode: seconds she is braced (the channel), the armour she gains, and the Q tag's bonus on her turrets' hits. */
export const SIEGE_SECONDS = 6;
export const SIEGE_ARMOR = 0.2;
export const TAG_SECONDS = 3;
export const TAG_BONUS = 1.3;

/**
 * Siege Mode as both screens know it, keyed by her figure. `live` is true while she is braced: the trait sets it on her
 * own client (`afterCast`, cleared by `recastAct`, a break or the clock in `tick`) and, from her `show('siege')`, on the
 * other screen (`ownChanged`); the effect (`siegeMode.ts`) reads it every frame and clears it when a stun or silence
 * breaks the channel. Pack up, a break and the clock all end the same record.
 */
export interface Siege { live: boolean }
export const sieges = new WeakMap<object, Siege>();

export function siegeOf(figure: object): Siege {
  let s = sieges.get(figure);
  if (!s) { s = { live: false }; sieges.set(figure, s); }
  return s;
}

/**
 * Where her live turrets stand, keyed by her figure: the vectors are the units' own positions (live). Refreshed every
 * frame by `ring` (both screens) and `tick`, so Grapple's effect can trace its line against them on either screen.
 */
export const turretSpots = new WeakMap<object, readonly THREE.Vector3[]>();

/**
 * One rule, both screens: Overclock. Online `tick` runs only on her own client, but her turrets on the other screen are
 * the replay of her casts (where the hits on the victim are decided), so this runs from `ring` too, which both screens
 * ask every frame. It sets how fast each turret attacks and tells the turret's look how hard to glow.
 */
function overclock(t: TraitView) {
  const me = t.self().group.position;
  const siege = t.own('siege') > 0;
  turretSpots.set(t.self(), t.units());
  t.unitRate((pos) => {
    const d = Math.hypot(pos.x - me.x, pos.z - me.z);
    const rate = siege && d <= SIEGE_REACH ? SIEGE_RATE : d <= OVERCLOCK_R ? OVERCLOCK_RATE : 1;
    setTurretPower(pos, rate === SIEGE_RATE ? 2 : rate > 1 ? 1 : 0);
    return rate;
  });
}

/** Ends her own Siege Mode on her own client and tells the other screen. */
function endSiege(t: TraitView) {
  t.mem.siegeUntil = 0;
  siegeOf(t.self()).live = false;
  t.show('siege', 0);
}

/**
 * Ada (engineer, ranged attack), kits v5. Passive Overclock: her turrets within 5 m of her shoot 30% faster (`overclock`:
 * `unitRate`); a ring at her feet shows the 5 m (8 m in Siege Mode) and a turret inside it glows. That is the whole rule.
 * Homing Drone (Q) tags the enemy for 3 s (`dealt`, slot 0: one pip over them); a hit from one of her turrets on a tagged
 * enemy deals 30% more. A turret's hit reaches `dealt` as kind 'unit' on her own side and, for the CPU's turrets, through
 * the cast record as kind 'spell' with slot 1 (Deploy Turret deals no damage of its own, so slot 1 is always a turret).
 * Deploy Turret (W) has two charges, one back every 10 s. Siege Mode (R): `afterCast` holds her 6 s with +20% armour and
 * opens `siegeUntil`; Pack up (`recastAct`) frees her at once. A stun or silence ends it too (`tick`, as the effect does).
 * While braced she cannot grapple (`canCast`). The CPU holds Siege Mode until it has a turret up and the enemy is
 * inside the 9 m its rounds reach (`aiHold`).
 */
export const clockworkTrait: Trait = {
  passive: { name: 'Overclock', blurb: 'Her turrets within 5 m of her shoot 30% faster. A ring at her feet shows the 5 m, and a turret inside it glows. In Siege Mode the ring grows to 8 m and those turrets shoot twice as fast.' },
  speed: 3.9,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1, windup: 0.25, speed: 18, look: 'rivet' },
  charges: { slot: 1, count: 2, every: 10 },
  recast: { slot: 3, window: SIEGE_SECONDS, arm: 0.3, name: 'Pack up', replay: false, aiWait: true },
  aiHold(t, slot, dist) {
    // Siege Mode is for standing by her turrets and the rounds reach 9 m: not before a turret is up, not at a distance.
    return slot === 3 && (t.units().length === 0 || dist > 9);
  },
  ring(t) {
    overclock(t);
    const siege = t.own('siege') > 0;
    return { radius: siege ? SIEGE_REACH : OVERCLOCK_R, color: '#d9773a', opacity: siege ? 0.45 : 0.3 };
  },
  ownChanged(t, name, n) {
    // The other screen: her stance. The effect there reads the record; the end comes the same way (show 0).
    if (name === 'siege') siegeOf(t.self()).live = n > 0;
  },
  canCast(t, slot) {
    return slot === 2 && t.own('siege') > 0 ? 'Braced' : null;
  },
  afterCast(t, slot) {
    if (slot !== 3) return;
    t.hold(SIEGE_SECONDS);
    t.buff('armor', SIEGE_ARMOR, SIEGE_SECONDS);
    t.mem.siegeUntil = t.time + SIEGE_SECONDS;
    siegeOf(t.self()).live = true;
    t.show('siege', 1);
  },
  recastAct(t, slot) {
    if (slot !== 3) return;
    t.release();
    endSiege(t);
  },
  tick(t) {
    if (t.time < 0.5) siegeOf(t.self()).live = false;
    overclock(t);
    if (t.own('siege') <= 0) return;
    // The clock, or a stun or silence (the same test as the effect's `channelBroken`): the stance ends.
    const st = t.status(t.self());
    const broken = !!st && (st.stunned || st.has('silence'));
    if (broken || t.time >= (t.mem.siegeUntil ?? 0)) {
      if (broken) t.release();
      endSiege(t);
    }
  },
  dealt(t, hit) {
    if (!hit.victimIsHero) return;
    if (hit.kind === 'spell' && hit.slot === 0) {
      t.addStacks('tag', 1, TAG_SECONDS, 1);
      return;
    }
    const turret = hit.kind === 'unit' || (hit.kind === 'spell' && hit.slot === 1);
    if (turret && t.stacks('tag') > 0) hit.damage *= TAG_BONUS;
  },
};
