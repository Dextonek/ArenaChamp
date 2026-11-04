import type { Trait, TraitView } from './types';

/** Pim and Pom share one hero: 620 HP in all, 310 each. The resting twin heals this much a second. */
export const HALF = 310;
export const REST_HEAL = 6;
/** A twin who has less than this cannot be tagged in (he would be sent straight back out). */
export const COME_MIN = 15;

/** Tag Out (R): the readable hold, and the cooldown it takes off the next spell of the twin who comes in. */
export const TAG_HOLD = 0.5;
export const TAG_CUT = 2;

/** Pim's Bonk (Q): damage, reach, cone width in degrees, wind-up. */
export const BONK_DAMAGE = 72;
export const BONK_REACH = 3;
export const BONK_ANGLE = 100;
export const BONK_WIND = 0.45;
/** Pim's Charge (W): damage, longest rush, wind-up, rush time, how wide the lane is. */
export const CHARGE_DAMAGE = 56;
export const CHARGE_RANGE = 5;
export const CHARGE_WIND = 0.4;
export const CHARGE_TIME = 0.2;
export const CHARGE_WIDTH = 1.6;
/** Pim's Shield Up (E). */
export const SHIELD_AMOUNT = 50;
export const SHIELD_SECONDS = 2;

/** Pom's Pebble (Q): damage, range, speed, wind-up, bolt radius. */
export const PEBBLE_DAMAGE = 66;
export const PEBBLE_RANGE = 9;
export const PEBBLE_SPEED = 22;
export const PEBBLE_WIND = 0.3;
export const PEBBLE_RADIUS = 0.3;
/** Pom's Snare (W): reach, delay, radius, damage, root seconds. */
export const SNARE_RANGE = 7;
export const SNARE_DELAY = 1.0;
export const SNARE_RADIUS = 2;
export const SNARE_DAMAGE = 30;
export const SNARE_ROOT = 1;
/** Pom's Backflip (E): the hop, its time, the popper's damage, radius and fuse. */
export const FLIP_DISTANCE = 4;
export const FLIP_TIME = 0.3;
export const FLIP_DAMAGE = 40;
export const FLIP_RADIUS = 1.5;
export const FLIP_FUSE = 0.65;

/**
 * Which twin is in, for the effects (they play on both screens and the CPU restarts one effect for each cast, so the state lives
 * here). `twin` 0 is Pim, 1 is Pom. It is refreshed every frame from `ring` (asked on both screens), so a new round, which clears the
 * shown values silently, cannot leave it stale.
 */
export interface TwinBook { twin: number }
export const twinBooks = new WeakMap<object, TwinBook>();
export function twinBookOf(who: object): TwinBook {
  let b = twinBooks.get(who);
  if (!b) { b = { twin: 0 }; twinBooks.set(who, b); }
  return b;
}

const PIM = '#ffb04a', POM = '#6ac8ff';
const PIP = HALF / 5;

/** Each twin's share of the real HP, kept in `mem` on this hero's own client. */
const share = (t: TraitView, twin: number) => (twin ? t.mem.pom : t.mem.pim) ?? HALF;
const setShare = (t: TraitView, twin: number, v: number) => { if (twin) t.mem.pom = v; else t.mem.pim = v; };

/** The twin who comes in brings his half of the kit; the one who steps back is shown only by his pips. */
function bringIn(t: TraitView, twin: number) {
  t.show('twin', twin);
  t.swapKit(twin === 1);
}

/**
 * Pim and Pom (fighter, two halves). One hero, one real HP bar of 620; the trait keeps each twin's share of it (310 each) in `mem` on
 * this hero's own client, and shows both shares to both players as pips (`pimHp`, `pomHp`, one pip per 62 HP, in each twin's colour).
 *
 * The invariant is `pim + pom === t.hp()`, kept by watching the real HP in `tick` and not by the `taken` hook, because `taken` sees a
 * hit before a shield soaks it (Shield Up would drain Pim's share while the real bar did not move). Every drop of the real HP comes off
 * the twin who is in (what is left over past zero comes off the other: the bar really lost it); every rise (the resting twin's heal,
 * or anything else) goes to the twin who rests (what is left over past 310 to the one who is in). The resting twin heals 6 a second:
 * `t.heal` in lumps of at least 2 every half second, which raises the real bar. A twin at 0 is tagged out at once, with no hold and no
 * cooldown, and when both are at 0 the real bar is at 0 and the hero is dead, which the server already says.
 *
 * Tag Out (R, 8 s) holds him still 0.5 s while the other twin pops out of the backpack (the spell's effect, on both screens); then,
 * here and only here, `swapKit` brings in the other half of the kit and `show('twin', n)` tells the other screen (`ownChanged` calls
 * `swapKit` there). The twin who comes in has the cooldown of the next spell to be ready (Q, W or E) cut by 2 s. Cooldowns stay per slot.
 * A new round starts on Pim with both at 310 (`mem` is cleared).
 */
export const twinsTrait: Trait = {
  meter: { name: 'REST', max: HALF, value: (t) => share(t, t.own('twin') ? 0 : 1) },
  passive: {
    name: 'Tag Team',
    blurb: 'One hero, two twins on one bar of 620 HP: 310 each. Damage comes off the twin who is in; at 0 he is tagged out at once. The twin who rests heals 6 HP a second. Tag Out takes 0.5 s, and the twin who comes in has his next spell 2 s sooner.',
  },
  twist: {
    name: 'Who is in?',
    blurb: 'Pim fights up close, Pom from a distance, and each has a spell the other wants. Hit the tag: it holds them still for 0.5 s.',
  },
  speed: 4.2,
  ownLook: {
    pimHp: { color: PIM, shape: 'gem' },
    pomHp: { color: POM, shape: 'gem' },
  },
  // Asked every frame on both screens: it keeps the book the effects read, and draws nothing.
  ring(t) {
    twinBookOf(t.self()).twin = t.own('twin') ? 1 : 0;
    return null;
  },
  canCast(t, slot) {
    const m = t.mem;
    if (m.tagAt !== undefined && t.time < m.tagAt + TAG_HOLD) return 'Tagging';
    if (slot === 3 && share(t, t.own('twin') ? 0 : 1) < COME_MIN) return 'Out cold';
    return null;
  },
  afterCast(t, slot) {
    if (slot === 3) {
      t.hold(TAG_HOLD);
      t.mem.tagAt = t.time;
    } else if (slot === 2 && !t.own('twin')) {
      t.shield(SHIELD_AMOUNT, SHIELD_SECONDS);
    }
  },
  tick(t, dt) {
    const hp = t.hp(), m = t.mem;
    if (hp <= 0) return;
    if (!m.init) {
      m.init = 1;
      m.pim = m.pom = hp / 2;
      m.lastHp = hp;
      m.healAcc = 0;
    }
    const inn = t.own('twin') ? 1 : 0, rest = 1 - inn;

    // The real bar moved: put the change on the right twin.
    const d = hp - m.lastHp;
    m.lastHp = hp;
    if (d < 0) {
      const left = share(t, inn) + d;
      setShare(t, inn, Math.max(0, left));
      if (left < 0) setShare(t, rest, Math.max(0, share(t, rest) + left));
    } else if (d > 0) {
      const room = HALF - share(t, rest);
      const to = Math.min(d, room);
      setShare(t, rest, share(t, rest) + to);
      setShare(t, inn, Math.min(HALF, share(t, inn) + d - to));
    }

    // The resting twin heals; the heal raises the real bar and the next frame's change lands on him.
    if (share(t, rest) < HALF && hp < t.maxHp()) {
      m.healAcc += REST_HEAL * dt;
      if (m.healAcc >= 2) {
        t.heal(Math.min(m.healAcc, HALF - share(t, rest)));
        m.healAcc = 0;
      }
    } else m.healAcc = 0;

    // The tag: the hold is over, or the twin who is in is down.
    if (m.tagAt !== undefined && t.time >= m.tagAt + TAG_HOLD) {
      delete m.tagAt;
      if (share(t, rest) > 0) {
        bringIn(t, rest);
        // The cooldown of the next spell to be ready (Q, W or E) comes 2 s sooner.
        let next = -1, least = Infinity;
        for (let i = 0; i < 3; i++) {
          const left = t.cooldownLeft(i);
          if (left > 0.05 && left < least) { least = left; next = i; }
        }
        if (next >= 0) t.setCooldown(next, Math.max(0, least - TAG_CUT));
      }
    } else if (share(t, inn) <= 0.01 && share(t, rest) > 0.01) {
      delete m.tagAt;
      bringIn(t, rest);
      t.show('forced', ((m.forcedN = (m.forcedN ?? 0) % 90 + 1)));
      t.say('TAG!', rest ? POM : PIM);
    }

    // Both shares, to both players: a pip per 62 HP, at least one while a twin has any.
    t.show('pimHp', share(t, 0) > 0.5 ? Math.ceil(share(t, 0) / PIP - 1e-6) : 0);
    t.show('pomHp', share(t, 1) > 0.5 ? Math.ceil(share(t, 1) / PIP - 1e-6) : 0);
  },
  ownChanged(t, name, n) {
    if (name === 'twin') t.swapKit(n === 1);
    else if (name === 'forced') t.say('TAG!', t.own('twin') ? POM : PIM);
  },
  badge(t) {
    const m = t.mem;
    if (!m.init) return '';
    return String(Math.round(share(t, t.own('twin') ? 0 : 1)));
  },
  /**
   * The CPU's Tag Out: when the twin in is under 35% of his share and the other has more, when the enemy is past 6 m and Pim is in,
   * or when the enemy is within 3 m and Pom is in. Shield Up only with the enemy close.
   */
  aiHold(t, slot, dist) {
    const inn = t.own('twin') ? 1 : 0;
    if (slot === 2) return inn === 0 && dist > 4.5;
    if (slot !== 3) return false;
    const mine = share(t, inn), other = share(t, 1 - inn);
    if (t.mem.tagAt !== undefined || other < COME_MIN) return true;
    const hurt = mine < 0.35 * HALF && other > mine;
    const wrongRange = (inn === 0 && dist > 6) || (inn === 1 && dist < 3);
    return !(hurt || wrongRange);
  },
};
