import type { Enemy } from '../effects/common';
import type { Trait } from './types';

/**
 * Radiant Parry's state (keyed by Auriel's figure): the trait opens it at the cast (`live`), `taken` closes it on the
 * first hit inside the window (`parried`; `fromUnit` when a summoned unit threw it, which parries without the stun; `enemy` is the enemy hero, whom the stun goes to), and
 * the effect reads it every frame to play the flash and deliver the stun. Kept in `taken` (not in the effect) because
 * that hook runs on whichever screen resolves the hits on her. Only the screen that runs her trait sees a parry: the
 * other screen of a network duel gets no hit reports, so there the stance always fades as a whiff.
 */
export interface DawnParry { live: boolean; parried: boolean; fromUnit: boolean; enemy?: Enemy | null }
export const dawnParries = new WeakMap<object, DawnParry>();

/** Seconds of the sun-shield stance (Radiant Parry); the effect keeps running past it to deliver the stun. */
export const PARRY_SECONDS = 0.6;
/** Seconds Dawn Descent keeps her airborne and untouchable: take-off to touchdown. */
export const DESCENT_AIR = 1.0;

/**
 * Auriel (support). Passive Aegis: every shield she makes is 30% stronger, and for 3 s after a shield spell her hits
 * deal +25% (adapted: a trait cannot see her shield, so it is a timed might after Radiant Spear or Dawn Descent).
 * Twist Recast W: Aegis Wall can be cast once more within 3 s as a Slam, free, at 60% damage.
 * Radiant Parry (E): for 0.6 s the first hit on her is swallowed whole (the effect then stuns the enemy). Dawn Descent
 * (R): she is untouchable while she is airborne (1 s).
 */
export const dawnTrait: Trait = {
  passive: { name: 'Aegis', blurb: 'Her shields are 30% stronger, and for 3 seconds after a shield spell her hits deal 25% more damage.' },
  twist: { name: 'Slam', blurb: 'After Aegis Wall, press W again within 3 seconds to slam it down early: free, at 60% damage.' },
  speed: 3.9,
  attack: { kind: 'ranged', range: 5.5, damage: 8, interval: 0.7, windup: 0.18, speed: 20, look: 'spear' },
  shieldMul: 1.3,
  recast: { slot: 1, window: 3, name: 'Slam', power: 0.6 },
  afterCast(t, slot) {
    if (slot === 2) {
      dawnParries.set(t.self(), { live: true, parried: false, fromUnit: false, enemy: t.enemy() });
      t.mem.parryUntil = t.time + PARRY_SECONDS;
    }
    if (slot === 3) t.mem.airUntil = t.time + DESCENT_AIR;
    if (slot === 0 || slot === 3) {
      // Dawn Descent's shield comes at touchdown, so its might runs from the landing.
      const secs = slot === 3 ? 3 + DESCENT_AIR : 3;
      t.buff('might', 0.25, secs);
      t.mem.mightUntil = t.time + secs;
    }
  },
  taken(t, hit) {
    // Airborne: nothing touches her.
    if (t.time < (t.mem.airUntil ?? 0)) {
      hit.blocked = true;
      if (t.time >= (t.mem.saidAt ?? 0)) { t.mem.saidAt = t.time + 0.5; t.say('UNTOUCHABLE', '#ffe7a0'); }
      return;
    }
    // Sun-shield stance: the first hit is parried and the window closes.
    if (t.time >= (t.mem.parryUntil ?? 0)) return;
    const p = dawnParries.get(t.self());
    if (!p || !p.live || p.parried) return;
    p.parried = true;
    p.fromUnit = hit.kind === 'unit';
    t.mem.parryUntil = 0;
    hit.blocked = true;
    t.say('PARRIED', '#fffdf2');
  },
  badge: (t) => (t.time < (t.mem.mightUntil ?? 0) ? '+25%' : ''),
};
