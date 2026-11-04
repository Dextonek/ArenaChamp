import type { Trait } from './types';

/** Seconds Skyward keeps him airborne and untouchable: take-off to touchdown (the effect lands on this beat). */
export const SKYWARD_AIR = 0.6;
/** Seconds Feather Step takes (the slide). He is not untouchable during it. */
export const STEP_TIME = 0.2;
/** Sky Rend: the wind-up (he stands, the enemy is marked), then one cut every `REND_CUT` s. */
export const REND_WIND = 0.8;
export const REND_CUT = 0.16;
/** Cuts: 3 plus 2 per Gust spent, 9 at most. */
export const REND_MIN_CUTS = 3;
export const REND_GUST_CUTS = 2;
export const REND_MAX_CUTS = 9;
/** Past this distance (m) at the end of the wind-up the spell fizzles. */
export const REND_REACH = 9;
/** Seconds the step out behind the enemy keeps him untouchable after the last cut, and the lock on his casts after he is out. */
export const REND_OUT = 0.15;
export const REND_LOCK = 0.6;
/** Seconds a Gust lasts (every dash refreshes it), and the most he can hold. */
export const GUST_SECONDS = 4;
export const GUST_MAX = 3;
/** Extra damage and reach (m) of the basic attack that spends a Gust. */
export const GUST_DAMAGE = 20;
export const GUST_REACH = 1;

const BASE_ATTACK = 10;

/** Cuts of the Sky Rend cast by a figure (written at the cast, on both screens); the effect reads it. None (the VFX tool): 9. */
export const skyRendCuts = new WeakMap<object, number>();
/** Set by the effect when a Sky Rend fizzles (no sight or too far at the end of the wind-up): no untouchable window, no lock. */
export const skyRendFizzled = new WeakMap<object, boolean>();

/** Gusts he holds now: his own counter with a deadline (the stacks API is for stacks on the enemy). */
function gusts(t: { time: number; mem: Record<string, number> }) {
  return t.time < (t.mem.gustUntil ?? 0) ? t.mem.gust ?? 0 : 0;
}

/**
 * Zephyr (assassin). Passive Following Wind: every dash (Crosswind's recast, Skyward, Feather Step) gives him a Gust (3 at
 * most, 4 s, each dash refreshes the time) and resets his basic attack. A basic attack spends one Gust for +20 damage and 1 m
 * more reach. The counter is `mem.gust` with the deadline `mem.gustUntil`; the attack is scaled in `attackMods` (power
 * (10 + 20) / 10: it runs once as the attack is released, so that is where the Gust is spent) and the reach is
 * `attackReach` while one is banked. Gusts and Feather Step's charges are shown to both players (`show`, `ownLook`).
 * Crosswind (Q) can be cast again within 2 s as a 3 m dash-slash (25 of 38 damage).
 * Untouchable windows are in `taken`: Skyward 0.6 s from the cast, and Sky Rend only while the cuts run (from 0.8 s after
 * the cast to the last cut plus `REND_OUT`; a fizzled Sky Rend cancels it through `skyRendFizzled`). Feather Step has none
 * and has 2 charges (7 s each).
 * Sky Rend (R) spends every Gust at the cast: 3 + 2 per Gust cuts, 9 at most (`skyRendCuts`, shown as 'cuts' so the other
 * screen's effect knows the count). He is held through the wind-up and the cuts (`hold`, freed if it fizzles), and after
 * he is out he cannot cast for `REND_LOCK` s (`canCast`). Skyward's reset comes at touchdown (`tick`), the other dashes
 * reset at the cast.
 */
export const skyTrait: Trait = {
  passive: { name: 'Following Wind', blurb: 'Every dash gives him a Gust (3 at most, 4 s, shown as pips round him) and resets his basic attack. His basic attack spends a Gust for +20 damage and 1 m more reach. Sky Rend spends all his Gusts for 2 more cuts each.' },
  ownLook: {
    gust: { color: '#7fe6c8', shape: 'gem' },
    step: { color: '#e8fff6', shape: 'flake' },
  },
  ownChanged(t, name, n) {
    // The other screen: the cast that follows reads the count from here.
    if (name === 'cuts' && n > 0) skyRendCuts.set(t.self(), n);
  },
  speed: 4.6,
  attack: { kind: 'melee', range: 2.4, damage: BASE_ATTACK, interval: 0.9, windup: 0.22, speed: 0, look: 'sweep' },
  charges: { slot: 2, count: 2, every: 7 },
  recast: { slot: 0, window: 2, name: 'Dash-slash', power: 2 / 3 },
  canCast(t) {
    if (t.time < (t.mem.rendLock ?? 0) && !skyRendFizzled.get(t.self())) return 'Still in the wind';
    return null;
  },
  attackMods(t) {
    const n = gusts(t);
    if (n <= 0) return {};
    t.mem.gust = n - 1;
    t.say('GUST STRIKE', '#7fe6c8');
    return { power: 1 + GUST_DAMAGE / BASE_ATTACK };
  },
  attackReach: (t) => (gusts(t) > 0 ? GUST_REACH : 0),
  recastAct(t, slot) {
    if (slot !== 0) return;
    gain(t);
    t.resetAttack();
  },
  afterCast(t, slot) {
    if (slot === 1) {
      gain(t);
      t.mem.airUntil = t.time + SKYWARD_AIR;
      t.mem.landAt = t.time + SKYWARD_AIR;
    }
    if (slot === 2) {
      gain(t);
      t.resetAttack();
    }
    if (slot === 3) {
      // Every Gust goes into the cuts.
      const cuts = Math.min(REND_MAX_CUTS, REND_MIN_CUTS + REND_GUST_CUTS * gusts(t));
      t.mem.gust = 0;
      skyRendCuts.set(t.self(), cuts);
      skyRendFizzled.delete(t.self());
      t.show('cuts', cuts);
      t.mem.rendFrom = t.time + REND_WIND;
      t.mem.rendUntil = t.mem.rendFrom + cuts * REND_CUT + REND_OUT;
      t.mem.rendLock = t.mem.rendUntil + REND_LOCK;
      t.mem.rendFreed = 0;
      t.hold(t.mem.rendUntil - t.time);
    }
  },
  tick(t) {
    // Skyward's attack reset comes when he lands.
    if (t.mem.landAt && t.time >= t.mem.landAt) {
      t.mem.landAt = 0;
      t.resetAttack();
    }
    // A fizzled Sky Rend frees him at once.
    if (t.mem.rendUntil && !t.mem.rendFreed && skyRendFizzled.get(t.self())) {
      t.mem.rendFreed = 1;
      t.release();
    }
    t.show('gust', gusts(t));
    t.show('step', t.ammo);
  },
  taken(t, hit) {
    const rend = t.time >= (t.mem.rendFrom ?? 0) && t.time < (t.mem.rendUntil ?? 0) && !skyRendFizzled.get(t.self());
    if (!rend && t.time >= (t.mem.airUntil ?? 0)) return;
    // In the wind: nothing touches him.
    hit.blocked = true;
    if (t.time >= (t.mem.saidAt ?? 0)) { t.mem.saidAt = t.time + 0.5; t.say('UNTOUCHABLE', '#7fe6c8'); }
  },
  badge(t) {
    const n = gusts(t);
    return n > 0 ? `${n}` : '';
  },
};

function gain(t: { time: number; mem: Record<string, number>; say(text: string, color?: string): void }) {
  const n = Math.min(GUST_MAX, gusts(t) + 1);
  t.mem.gust = n;
  t.mem.gustUntil = t.time + GUST_SECONDS;
  t.say(n > 1 ? `GUST x${n}` : 'GUST', '#7fe6c8');
}
