import type { Enemy } from '../effects/common';
import type { Trait } from './types';

/**
 * How far Starfall Arrow was drawn, keyed by Lyra's figure. `castMods` (slot 0) writes it; the effect
 * (`src/spells/targeted/starfallArrow.ts`) reads it at `cast()` for the range and the pierce, since the charge
 * reaches nothing else. Absent on the other screen of a network duel (its trait never runs the cast rules): the
 * effect then flies the full draw, and the damage is still right because it travels as the cast's power.
 */
export interface LyraDraw { charge: number }
export const lyraDraws = new WeakMap<object, LyraDraw>();

/**
 * Meteor Mark's state, keyed by her figure: the marked enemy, and the damage she dealt it since the mark landed.
 * The effect (`src/spells/targeted/meteorMark.ts`) opens it at `play()` and closes it just before the strike; the
 * trait's `dealt` tallies into it. `tracked` is set by `tick`: where it stays false (the other screen of a network
 * duel) the effect strikes for the flat base damage.
 */
export interface LyraMark { live: boolean; target: Enemy; tally: number; tracked: boolean }
export const lyraMarks = new WeakMap<object, LyraMark>();

/** Far Sight: no bonus within NEAR m, the full bonus from FAR m, a straight ramp between. */
export const FAR_NEAR = 4;
export const FAR_FAR = 10;
export const FAR_BONUS = 0.3;
export const farSight = (d: number) => FAR_BONUS * Math.min(1, Math.max(0, (d - FAR_NEAR) / (FAR_FAR - FAR_NEAR)));

/** Twin Stars lasts this long; the second arrow of each basic attack deals this share. */
export const TWIN_SECONDS = 5;
export const TWIN_SHARE = 0.5;

/**
 * Lyra (marksman). Passive Far Sight: every hit of hers deals up to +30% the farther the victim is (0% within 4 m,
 * a straight ramp to +30% at 10 m). Starfall Arrow charges while aimed (1 s: range 9 to 14 m, damage 39 to 78, a
 * full draw pierces, and a full-draw hit takes 3 s off Pinning Arrow); Twin Stars makes her basic attacks echo for 5 s at 50%; Pinning Arrow and Meteor Mark need no rule
 * here. The Meteor adds 25% of what she dealt the marked enemy meanwhile.
 * The refund: castMods notes a full draw in `t.mem.fullDraw` (the cast's number, so two casts never mix); `landed` (her own
 * client, so it works online too) cuts Pinning Arrow's cooldown by 3 s once per cast.
 */
export const astralTrait: Trait = {
  passive: { name: 'Far Sight', blurb: 'Her damage rises with distance: +0% within 4 m, up to +30% at 10 m or more. A full-draw Starfall Arrow that hits takes 3 s off Pinning Arrow.' },
  speed: 4.0,
  attack: { kind: 'ranged', range: 8.5, damage: 12, interval: 1.4, windup: 0.32, speed: 24, look: 'arrow' },
  hold: { slot: 0, seconds: 1 },
  castMods(t, slot, charge) {
    if (slot !== 0) return {};
    // The effect's base damage is the full draw (78); a loose string is half of it (39).
    lyraDraws.set(t.self(), { charge });
    if (charge >= 0.99) {
      t.say('FULL DRAW', '#ffe08a');
      t.mem.fullDraw = 1;
    } else t.mem.fullDraw = 0;
    return { power: 0.5 + 0.5 * charge };
  },
  afterCast(t, slot) {
    if (slot === 1) {
      t.mem.twinUntil = t.time + TWIN_SECONDS;
      t.say('TWIN STARS', '#7ff3ff');
    }
  },
  attackEcho: (t) => ((t.mem.twinUntil ?? 0) > t.time ? TWIN_SHARE : 0),
  dealt(t, hit) {
    const me = t.self().group.position, v = hit.victim.group.position;
    const bonus = farSight(Math.hypot(me.x - v.x, me.z - v.z));
    if (bonus > 0) hit.damage *= 1 + bonus;
    // Meteor Mark's tally: what she deals the marked enemy (after Far Sight).
    const mark = lyraMarks.get(t.self());
    if (mark && mark.live && hit.victim === mark.target) mark.tally += hit.damage;
  },
  landed(t, hit) {
    // A full-draw Starfall Arrow that hit refunds 3 s of Pinning Arrow, once per cast (a piercing arrow can hit twice).
    if (hit.kind !== 'spell' || hit.slot !== 0 || !t.mem.fullDraw) return;
    t.mem.fullDraw = 0;
    t.setCooldown(2, Math.max(0, t.cooldownLeft(2) - 3));
  },
  tick(t) {
    const mark = lyraMarks.get(t.self());
    if (mark) mark.tracked = true;
  },
  badge(t) {
    const e = t.enemy();
    if (!e) return '';
    const me = t.self().group.position, v = e.group.position;
    const pct = Math.round(farSight(Math.hypot(me.x - v.x, me.z - v.z)) * 100);
    return pct > 0 ? `+${pct}%` : '';
  },
};
