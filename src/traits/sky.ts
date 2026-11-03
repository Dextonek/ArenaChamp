import type { Trait } from './types';

/** Seconds Skyward keeps him airborne and untouchable: take-off to touchdown (the effect lands on this beat). */
export const SKYWARD_AIR = 0.8;
/** Seconds Feather Step leaves him untouchable (the length of the step). */
export const STEP_GRACE = 0.2;
/** Seconds Sky Rend keeps him untouchable: the wind-up, the six strikes and the step out behind the enemy. */
export const REND_AIR = 1.6;
/** Seconds a Gust lasts (every dash refreshes it), and the most he can hold. */
export const GUST_SECONDS = 4;
export const GUST_MAX = 3;
/** Extra damage and reach (m) of the basic attack that spends a Gust. */
export const GUST_DAMAGE = 25;
export const GUST_REACH = 1;

const BASE_ATTACK = 10;

/** Gusts he holds now: his own counter with a deadline (the stacks API is for stacks on the enemy). */
function gusts(t: { time: number; mem: Record<string, number> }) {
  return t.time < (t.mem.gustUntil ?? 0) ? t.mem.gust ?? 0 : 0;
}

/**
 * Zephyr (assassin). Passive Tailwind: every dash (Crosswind's recast, Skyward, Feather Step) gives him a Gust (3 at most,
 * 4 s, each dash refreshes the time) and resets his basic attack. A basic attack spends one Gust for +25 damage and 1 m
 * more reach. The counter is `mem.gust` with the deadline `mem.gustUntil`; the attack is scaled in `attackMods` (power
 * (10 + 25) / 10: it runs once as the attack is released, so that is where the Gust is spent) and the reach is
 * `attackReach` while one is banked. Crosswind (Q) can be cast again within 2 s as a 3 m dash-slash (28 of 42 damage).
 * Untouchable windows are in `taken`: Skyward 0.8 s, Feather Step 0.2 s, Sky Rend 1.6 s. Feather Step has 2 charges (7 s
 * each). Sky Rend's hits do double on a knocked-up enemy (`dealt`; Skyward's landing knocks up, so W into R combos).
 * Skyward's reset comes at touchdown (`tick`), the other dashes reset at the cast.
 */
export const skyTrait: Trait = {
  passive: { name: 'Tailwind', blurb: 'Every dash gives him a Gust (3 at most, 4 s) and resets his basic attack. His basic attack spends a Gust for +25 damage and 1 m more reach.' },
  speed: 4.6,
  attack: { kind: 'melee', range: 2.4, damage: BASE_ATTACK, interval: 0.9, windup: 0.22, speed: 0, look: 'sweep' },
  charges: { slot: 2, count: 2, every: 7 },
  recast: { slot: 0, window: 2, name: 'Dash-slash', power: 2 / 3 },
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
      t.mem.stepUntil = t.time + STEP_GRACE;
      t.resetAttack();
    }
    if (slot === 3) t.mem.rendUntil = t.time + REND_AIR;
  },
  tick(t) {
    // Skyward's attack reset comes when he lands.
    if (t.mem.landAt && t.time >= t.mem.landAt) {
      t.mem.landAt = 0;
      t.resetAttack();
    }
  },
  taken(t, hit) {
    if (t.time >= Math.max(t.mem.airUntil ?? 0, t.mem.stepUntil ?? 0, t.mem.rendUntil ?? 0)) return;
    // In the wind: nothing touches him.
    hit.blocked = true;
    if (t.time >= (t.mem.saidAt ?? 0)) { t.mem.saidAt = t.time + 0.5; t.say('UNTOUCHABLE', '#7fe6c8'); }
  },
  dealt(t, hit) {
    // Sky Rend on an airborne (knocked-up) enemy: double.
    if (hit.kind !== 'spell' || hit.slot !== 3 || !t.status(hit.victim)?.has('knockup')) return;
    hit.damage *= 2;
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
