import type { GroundMark, Trait } from './types';
import { dohyoLook } from '../effects/parts/sumo';

/** Dohyo (passive): the ring's radius, how long it stands, how much Salt Throw takes off it, and the least it can shrink to (m, s). */
export const RING_RADIUS = 5;
export const RING_LIFE = 8;
export const RING_SHRINK = 2;
export const RING_MIN = 1;
/** The radii the ring can have (5, 3, 1): one ground look each. A shrunk ring swaps look, so the drawn edge is the real one. */
export const RING_SIZES = [5, 3, 1];
/** The ring is drawn this long after its last rule second, shrinking away: it closes, it does not just vanish. */
export const RING_FADE = 1;
/** A ring-out: the bonus damage and the stun (s); the word stays over the enemy this long (s). */
export const RING_OUT_DAMAGE = 80;
export const RING_OUT_STUN = 0.5;
const WORD_SECONDS = 1.4;

/** Palm Strike (Q): reach, line width, damage, the shove (m) and how long the shove takes (s), wind-up. */
export const PALM_REACH = 2.8;
export const PALM_WIDTH = 2.0;
export const PALM_DAMAGE = 54;
export const PALM_PUSH = 3;
export const PALM_PUSH_TIME = 0.22;
export const PALM_WIND = 0.4;

/** Stomp (W): wind-up, radius, damage, slow seconds. */
export const STOMP_WIND = 0.5;
export const STOMP_RADIUS = 3;
export const STOMP_DAMAGE = 50;
export const STOMP_SLOW = 1;

/** Charge (E): wind-up, run, run time, line width, damage, how far ahead of him the caught body rides. */
export const CHARGE_WIND = 0.4;
export const CHARGE_DIST = 6;
export const CHARGE_TIME = 0.4;
export const CHARGE_WIDTH = 2.0;
export const CHARGE_DAMAGE = 40;
export const CHARGE_HOLD = 1.2;

/** Salt Throw (R): wind-up, reach, cone width (degrees), blind seconds, and his haste after (amount, seconds). */
export const SALT_WIND = 0.6;
export const SALT_REACH = 6;
export const SALT_ANGLE = 70;
export const SALT_BLIND = 1.5;
export const SALT_HASTE = 0.3;
export const SALT_HASTE_SECONDS = 4;

/** The ring on the floor: where, when it was stomped (`performance.now()` ms), its radius now. */
export interface Dohyo { x: number; z: number; bornAt: number; radius: number }

/**
 * What Big Yoko leaves behind, per figure (the effects play on both screens, so they and the trait share it here).
 * `ring`: the one ring (Stomp writes it when it lands, Salt Throw shrinks it, on both screens). `pushUntil`: a shove of his
 * (Palm Strike, Charge) is carrying the enemy until then (`performance.now()` ms): only inside it can a ring-out happen.
 * `ringOutAt`: when the last ring-out was decided, for the word over the enemy. `clock`: the trait's round clock, to notice a new round.
 */
export interface SumoBook { ring: Dohyo | null; pushUntil: number; ringOutAt: number; clock: number }
export const sumoBooks = new WeakMap<object, SumoBook>();

export function bookOf(who: object): SumoBook {
  let b = sumoBooks.get(who);
  if (!b) { b = { ring: null, pushUntil: 0, ringOutAt: 0, clock: 0 }; sumoBooks.set(who, b); }
  return b;
}

/** A round restarted (the trait's clock went back): the old ring is gone. */
function sync(b: SumoBook, clock: number) {
  if (clock < b.clock - 0.5) { b.ring = null; b.pushUntil = 0; b.ringOutAt = 0; }
  b.clock = clock;
}

/** The ring as a rule while it stands, else null. */
export function liveRing(b: SumoBook | undefined, now = performance.now()): Dohyo | null {
  const r = b?.ring;
  return r && now >= r.bornAt && now < r.bornAt + RING_LIFE * 1000 ? r : null;
}

/** Salt Throw: the ring (if up) loses 2 m of radius for the rest of its life, never below `RING_MIN`. */
export function shrinkRing(b: SumoBook, now = performance.now()) {
  const r = liveRing(b, now);
  if (r) r.radius = Math.max(RING_MIN, r.radius - RING_SHRINK);
}

/** The ground look of a ring of radius `radius`: the nearest of `RING_SIZES`. */
const kindOf = (radius: number) => `dohyo${RING_SIZES.reduce((a, s) => (Math.abs(s - radius) < Math.abs(a - radius) ? s : a), RING_SIZES[0])}`;

const CALM = ['hm.', 'good.', 'breathe.', 'ah.'];

/**
 * Big Yoko (tank, melee). Passive Dohyo: his Stomp stamps one straw-rope ring on the floor, 5 m radius, for 8 s. A push of his
 * (Palm Strike, Charge) that carries the enemy from inside the ring to outside it is a ring-out: +80 damage and stunned 0.5 s.
 * Salt Throw shrinks the ring by 2 m for the rest of its life and makes him 30% faster for 4 s.
 *
 * Where each rule runs. The ring is a `sumoBooks` record the Stomp effect writes on BOTH screens when it lands (from `sentFrom`),
 * so both draw it (`marks`) and the CPU can read it. A push moves the enemy through `ctx.carry` in the spell's effect, which does
 * something only on the screen that decides that hero (offline always, online the victim's), and the effect also opens a push window
 * (`pushUntil`). `victimTick` runs on that same screen: it watches the enemy cross the rope inside the window and then makes
 * the bonus hit with `hitEnemy`, a 'trait' hit that no hook of his answers (he has no `dealt`), so it can never trigger itself. It tells
 * his own client with `noteOwner('ringout')` so the word over the enemy (`enemyLabel`, read on both screens) shows there too.
 */
export const sumoTrait: Trait = {
  meter: { name: 'RING', max: RING_LIFE, value: (t) => { const r = liveRing(sumoBooks.get(t.self())); return r ? Math.ceil((r.bornAt + RING_LIFE * 1000 - performance.now()) / 1000) : 0; } },
  passive: {
    name: 'Dohyo',
    blurb: 'His Stomp stamps a straw-rope ring on the floor, 5 m wide, for 8 s. A push of his that carries you from inside it to outside is a ring-out: +80 damage and stunned 0.5 s. Salt Throw shrinks it by 2 m.',
  },
  twist: {
    name: 'The Edge',
    blurb: 'The push counts only when it crosses the rope. Stand out of the ring, or fight in the middle and walk away before he gets behind you.',
  },
  speed: 3.6,
  attack: { kind: 'melee', range: 2.4, damage: 20, interval: 1.2, windup: 0.35, speed: 0, look: 'smash' },

  // The CPU, a ring up and the enemy inside it: it walks to the spot on the far side of the enemy from the rope, so a shove goes out over it.
  aiGoal(t) {
    const b = sumoBooks.get(t.self()), ring = liveRing(b), e = t.enemy();
    if (!ring || !e) return null;
    const me = t.self().group.position, ep = e.group.position;
    let ux = ep.x - ring.x, uz = ep.z - ring.z;
    const d = Math.hypot(ux, uz);
    if (d > ring.radius - 0.3) return null;
    if (d < 0.6) { ux = ep.x - me.x; uz = ep.z - me.z; }
    const l = Math.hypot(ux, uz) || 1;
    const goal = { x: ep.x - (ux / l) * 1.8, z: ep.z - (uz / l) * 1.8 };
    return Math.hypot(goal.x - me.x, goal.z - me.z) < 0.4 ? null : goal;
  },

  // W when there is no ring, or the enemy is outside it and within 3 m; R only with the enemy within 6 m. The rest as usual.
  aiHold(t, slot, dist) {
    if (slot === 1) {
      const ring = liveRing(sumoBooks.get(t.self())), e = t.enemy();
      if (!ring) return false;
      if (!e) return true;
      const ep = e.group.position;
      return !(Math.hypot(ep.x - ring.x, ep.z - ring.z) > ring.radius && dist <= 3);
    }
    if (slot === 3) return dist > SALT_REACH;
    return false;
  },

  marks(t) {
    const b = sumoBooks.get(t.self());
    if (!b) return [];
    sync(b, t.time);
    const r = b.ring;
    if (!r) return [];
    const now = performance.now();
    if (now < r.bornAt || now >= r.bornAt + (RING_LIFE + RING_FADE) * 1000) return [];
    const m: GroundMark = { x: r.x, z: r.z, kind: kindOf(r.radius), age: (now - r.bornAt) / 1000, life: RING_LIFE + RING_FADE };
    return [m];
  },
  markLook: Object.fromEntries(RING_SIZES.map((s) => [`dohyo${s}`, () => dohyoLook(s)])),

  enemyLabel(t) {
    const b = sumoBooks.get(t.self());
    return b && b.ringOutAt > 0 && performance.now() - b.ringOutAt < WORD_SECONDS * 1000 ? { text: 'RING OUT', color: '#e63a3a' } : null;
  },

  afterCast(t, slot) {
    if (slot === 3) t.mem.saltAt = t.time;
    // He stays calm: a quiet word now and then.
    if (slot === 1) t.say(CALM[Math.floor(t.time) % CALM.length], '#f4ead0');
  },

  // His own client: the haste comes when the salt has left his hand, not at the button.
  tick(t) {
    const at = t.mem.saltAt ?? 0;
    if (at > 0 && t.time >= at + SALT_WIND) {
      t.mem.saltAt = 0;
      t.buff('haste', SALT_HASTE, SALT_HASTE_SECONDS);
    }
  },

  // The screen that decides the enemy: a shove carried it over the rope.
  victimTick(t) {
    const b = sumoBooks.get(t.self()), e = t.enemy();
    if (!b) return;
    sync(b, t.time);
    const now = performance.now(), ring = liveRing(b, now);
    if (!ring || !e) { t.mem.wasIn = 0; return; }
    const p = e.group.position;
    const inside = Math.hypot(p.x - ring.x, p.z - ring.z) <= ring.radius ? 1 : 0;
    if (b.pushUntil > now && t.mem.wasIn === 1 && inside === 0) {
      b.pushUntil = 0;
      b.ringOutAt = now;
      t.hitEnemy({ damage: RING_OUT_DAMAGE, knock: 0, color: '#e63a3a', status: { kind: 'stun', seconds: RING_OUT_STUN } });
      t.noteOwner('ringout', 1);
    }
    t.mem.wasIn = inside;
  },

  peerNote(t, name) {
    if (name === 'ringout') bookOf(t.self()).ringOutAt = performance.now();
  },

  badge(t) {
    const r = liveRing(sumoBooks.get(t.self()));
    return r ? String(Math.ceil((r.bornAt + RING_LIFE * 1000 - performance.now()) / 1000)) : '';
  },
};
