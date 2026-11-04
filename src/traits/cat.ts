import * as THREE from 'three';
import type { Trait } from './types';
import { DUEL_OBSTACLES, type Obstacle } from '../obstacles';

/** Nine Lives: the lives he has, and the HP of each. */
export const LIVES = 9;
export const LIFE_HP = 60;

/** Scratch (Q): damage, reach (m) and the width of the claw (degrees), and the seconds his next attack stays ready at once. */
export const SCRATCH_DAMAGE = 64;
export const SCRATCH_RANGE = 2.5;
export const SCRATCH_ANGLE = 90;
export const SCRATCH_FREE = 2;

/** Knock It Over (W): damage, stun (s), pot radius (m), spot reach (m), fall time (s), and how near cover must be (m, to its surface). */
export const POT_DAMAGE = 60;
export const POT_STUN = 0.5;
export const POT_RADIUS = 1.5;
export const POT_RANGE = 9;
export const POT_DELAY = 0.7;
export const COVER_REACH = 4;

/** Cat Leap (E): damage, reach (m), landing radius (m), leap time (s), and the seconds he cannot cast after landing. */
export const POUNCE_DAMAGE = 60;
export const POUNCE_RANGE = 7;
export const POUNCE_RADIUS = 1.5;
export const POUNCE_TIME = 0.65;
export const POUNCE_LOCK = 0.4;

/** Land on My Feet (R): seconds it waits, the leap away (m, s) and the attack-speed bonus until it is used. */
export const FEET_SECONDS = 4;
export const FEET_LEAP = 3;
export const FEET_LEAP_TIME = 0.25;
export const FEET_SPEED = 0.3;

/** The life he is on (1..9) at `hp`, and the HP left in it. A full life is 60 left; at exactly 480 HP he is on life 8, full. */
export function lifeOf(hp: number) {
  return Math.max(1, Math.min(LIVES, Math.ceil((hp - 1e-6) / LIFE_HP)));
}
export function roomOf(hp: number) {
  return Math.max(0, hp - (lifeOf(hp) - 1) * LIFE_HP);
}

/** The nearest bit of cover (an obstacle's surface) within `reach` m of (x, z): where it is, how high, and how far. */
export function nearestCover(x: number, z: number, obstacles: readonly Obstacle[], reach = COVER_REACH) {
  let best: { x: number; z: number; height: number; dist: number } | null = null;
  for (const o of obstacles) {
    const dx = o.bx - o.ax, dz = o.bz - o.az, len2 = dx * dx + dz * dz;
    const k = len2 < 1e-9 ? 0 : Math.min(1, Math.max(0, ((x - o.ax) * dx + (z - o.az) * dz) / len2));
    const cx = o.ax + dx * k, cz = o.az + dz * k;
    const dist = Math.hypot(x - cx, z - cz) - o.r;
    if (dist <= reach && (!best || dist < best.dist)) best = { x: cx, z: cz, height: o.height, dist: Math.max(0, dist) };
  }
  return best;
}

/** What Sir Whiskers leaves for the effects (they play on both screens): `leapSeq` counts the Land on My Feet leaps. */
export interface CatBook { leapSeq: number }
export const catBooks = new WeakMap<object, CatBook>();
export function catBookOf(who: object): CatBook {
  let b = catBooks.get(who);
  if (!b) { b = { leapSeq: 0 }; catBooks.set(who, b); }
  return b;
}

const LOST_WORDS = ['MROW', 'HISS', 'NYA', 'MEOW'];

/**
 * Sir Whiskers (assassin, melee). Passive Nine Lives: his bar is nine chunks of 60 and no single hit takes more than the life he is on
 * (`taken`, which runs on his own client: it reads his real HP, so a hit on his last 12 HP of a life takes 12 and the rest is wasted,
 * and the cap follows the life he is on now, not a fixed 60). Many small hits and damage over time cut him apart; a big spell is
 * wasted on him. Cat Leap spends the life he is on (`payHp`, down to the start of that life, so a low life is cheap) and cannot be cast on
 * his last life. Land on My Feet arms for 4 s (shown to both players as a ring, `show('feet')`): the first hit that would cost him a
 * life leaves him 1 HP into it instead (`taken`), the hit's status and knock are dropped and he leaps 3 m away from the enemy
 * (`moveTo`); until then, or until it runs out, his attacks are 30% faster. Scratch readies his attack at once and for 2 s his next
 * attack comes with no wait between the swings (`resetAttack`; the engine has no hook for the wind-up itself).
 *
 * Attack speed: `attack.windup` is fixed by the engine, so +30% is built as a shorter gap after each swing (0.29 s instead of 0.45 s):
 * the swing and the gap together take 0.7 / 1.3 s. The CPU's `aiHold`: Knock It Over only with cover within 4 m of him (`DUEL_OBSTACLES`),
 * Cat Leap only on a life with under 20 HP left (and a life to spare) or at 4 to 7 m with more than 3 lives, Land on My Feet not while it is armed.
 */
export const catTrait: Trait = {
  meter: { name: 'LIVES', max: LIVES, value: (t) => t.own('lives') },
  passive: {
    name: 'Nine Lives',
    blurb: 'His bar is nine lives of 60 HP. No single hit takes more than the life he is on: the rest of a big hit is wasted. Many small hits and damage over time are what cut him apart.',
  },
  twist: {
    name: 'Spend a life',
    blurb: 'On a full life, attack. On a low one, spend it: Cat Leap costs the life he is on and Land on My Feet saves the next one.',
  },
  speed: 4.5,
  attack: { kind: 'melee', range: 2, damage: 15, interval: 0.7, windup: 0.25, look: 'claw' },
  ownLook: {
    claw: { color: '#f4e6c8', shape: 'mark' },
    feet: { color: '#e8a13a', shape: 'gem' },
  },
  aiHold(t, slot, dist) {
    const me = t.self().group.position;
    const hp = t.hp(), life = lifeOf(hp);
    if (slot === 1) return !nearestCover(me.x, me.z, DUEL_OBSTACLES);
    if (slot === 2) {
      if (life <= 1 || dist > POUNCE_RANGE + 1.5) return true;
      const lowLife = roomOf(hp) < 20;
      const gap = dist >= 4 && dist <= POUNCE_RANGE && life > 3;
      return !(lowLife || gap);
    }
    if (slot === 3) return t.own('feet') > 0;
    return false;
  },
  canCast(t, slot) {
    if (t.time < (t.mem.lockUntil ?? 0)) return 'Landing';
    if (slot === 2 && lifeOf(t.hp()) <= 1) return 'Last life';
    return null;
  },
  afterCast(t, slot) {
    if (slot === 0) {
      t.mem.clawUntil = t.time + SCRATCH_FREE;
      t.show('claw', 1);
      t.resetAttack();
    } else if (slot === 2) {
      // The life he is on is spent: down to where that life began (at least 1 HP is left, the engine's own floor).
      const spent = roomOf(t.hp());
      t.payHp(spent);
      t.say('MROW  ♥ -1', '#ff9eb4');
      t.mem.landAt = t.time + POUNCE_TIME;
      t.mem.lockUntil = t.time + POUNCE_TIME + POUNCE_LOCK;
    } else if (slot === 3) {
      t.mem.feetUntil = t.time + FEET_SECONDS;
      t.mem.atkAt = 0;
      t.show('feet', 1);
    }
  },
  attackMods(t) {
    t.mem.atkAt = t.time;
    if ((t.mem.clawUntil ?? 0) > 0) {
      // The ready attack Scratch left is the one that goes now.
      t.mem.clawUntil = 0;
      t.show('claw', 0);
    }
    return {};
  },
  taken(t, hit) {
    if (hit.blocked || hit.damage <= 0) return;
    const hp = t.hp(), room = roomOf(hp);
    const loses = hit.damage >= room - 1e-6;
    // Nine Lives: no hit takes more than the life he is on.
    if (hit.damage > room) hit.damage = room;
    if (!loses || t.own('feet') <= 0) return;
    // Land on My Feet: the life is not lost; he keeps 1 HP of it, the hit's push and statuses are dropped and he leaps away.
    hit.damage = Math.max(0, room - 1);
    delete hit.opts.status;
    delete hit.opts.debuff;
    hit.opts.knock = 0;
    hit.opts.pull = 0;
    t.mem.feetUntil = 0;
    t.show('feet', 0);
    const seq = t.own('leap') + 1;
    catBookOf(t.self()).leapSeq = seq;
    t.show('leap', seq);
    const me = t.self().group.position, foe = t.enemy()?.group.position;
    let dx = foe ? me.x - foe.x : 0, dz = foe ? me.z - foe.z : -1;
    const l = Math.hypot(dx, dz);
    if (l < 0.05) { dx = 0; dz = -1; } else { dx /= l; dz /= l; }
    t.moveTo(new THREE.Vector3(me.x + dx * FEET_LEAP, 0, me.z + dz * FEET_LEAP), FEET_LEAP_TIME);
    t.say('LANDED ON MY FEET', '#e8a13a');
  },
  tick(t) {
    const hp = t.hp(), life = lifeOf(hp);
    t.show('lives', life);
    // A life gone: a word, once.
    const seen = t.mem.lifeSeen ?? 0;
    if (seen > 0 && life < seen) t.say(`${LOST_WORDS[life % LOST_WORDS.length]}  ♥ ${life}`, '#f4e6c8');
    t.mem.lifeSeen = life;
    if ((t.mem.clawUntil ?? 0) > 0 && t.time > t.mem.clawUntil) {
      t.mem.clawUntil = 0;
      t.show('claw', 0);
    }
    if ((t.mem.landAt ?? 0) > 0 && t.time >= t.mem.landAt) {
      t.mem.landAt = 0;
      t.hold(POUNCE_LOCK);
    }
    if (t.own('feet') > 0) {
      if (t.time >= (t.mem.feetUntil ?? 0)) t.show('feet', 0);
      // +30% attack speed: the gap after a swing is shorter (the swing's own wait is the engine's).
      const swung = t.mem.atkAt ?? 0;
      if (swung > 0 && t.time >= swung + 0.29) {
        t.mem.atkAt = 0;
        t.resetAttack();
      }
    }
  },
  ring(t) {
    if (t.own('feet') <= 0) return null;
    return { radius: 1.15, color: '#e8a13a', opacity: 0.55 + 0.3 * Math.sin(t.time * 8) };
  },
  ownChanged(t, name, n) {
    if (name === 'leap') catBookOf(t.self()).leapSeq = n;
  },
  badge(t) {
    const n = t.own('lives');
    return n > 0 ? String(n) : '';
  },
};
