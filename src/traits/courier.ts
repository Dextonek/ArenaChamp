import * as THREE from 'three';
import type { GroundMark, Trait, TraitView } from './types';
import { DUEL_OBSTACLES } from '../obstacles';
import { carriedLook, dashLook, dropLook, parcelLook } from '../effects/parts/courier';

/** Express Letter (Q): reach, speed, wind-up, bolt radius, damage and the damage each Charge adds. */
export const LETTER_RANGE = 8;
export const LETTER_SPEED = 24;
export const LETTER_WIND = 0.25;
export const LETTER_RADIUS = 0.3;
export const LETTER_DAMAGE = 54;
export const LETTER_PER_CHARGE = 15;

/** Fragile (W): reach, delay before it bursts, radius, damage, slow seconds. */
export const FRAGILE_RANGE = 9;
export const FRAGILE_DELAY = 1.0;
export const FRAGILE_RADIUS = 2.5;
export const FRAGILE_DAMAGE = 66;
export const FRAGILE_SLOW = 1.0;

/** Shortcut (E): the sprint's length (m) and time (s), and the cooldown left when a Charge was spent to refund it. */
export const SHORTCUT_RANGE = 6;
export const SHORTCUT_TIME = 0.3;
export const SHORTCUT_REFUNDED = 0.4;

/** Final Delivery (R): reach to cast, seconds the parcel homes, its speed, burst radius, damage and damage per Charge spent. */
export const FINAL_RANGE = 6;
export const FINAL_TIME = 1.5;
export const FINAL_SPEED = 5;
export const FINAL_RADIUS = 2;
export const FINAL_DAMAGE = 80;
export const FINAL_PER_CHARGE = 40;
/** How near (m, to its surface) the hunted hero must come to cover to sign for the parcel. */
export const SIGN_REACH = 0.7;

/** Sign Here (P): Charges at most, pick-up and drop reach (m), seconds a knocked-loose parcel cannot be picked up again. */
export const MAX_CHARGE = 3;
export const PICK_REACH = 1.3;
export const DROP_REACH = 1.5;
export const LOOSE_GRACE = 1.2;

const ACCENT = '#ffd24a';
const FOIL = '#3a6ac8';

/** The duel ring: centre and radius, and how far in a parcel or drop point may lie. */
const RING_X = 0;
const RING_Z = 7;
const RING_LIMIT = 9.5;
/** A parcel or drop point lies at least this far (m) from the surface of any cover. */
const COVER_GAP = 1.7;

// ---------------------------------------------------------------------------------------------------------------
// Where the parcel and the drop point are: a small seeded formula, so both screens agree.
// ---------------------------------------------------------------------------------------------------------------

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance from (x, z) to the surface of the nearest bit of the duel ring's cover. */
function coverGap(x: number, z: number) {
  let best = Infinity;
  for (const o of DUEL_OBSTACLES) {
    const dx = o.bx - o.ax, dz = o.bz - o.az, len2 = dx * dx + dz * dz;
    const k = len2 < 1e-9 ? 0 : Math.min(1, Math.max(0, ((x - o.ax) * dx + (z - o.az) * dz) / len2));
    best = Math.min(best, Math.hypot(x - (o.ax + dx * k), z - (o.az + dz * k)) - o.r);
  }
  return best;
}

export interface Job { px: number; pz: number; dx: number; dz: number }
let lastJob: { key: number; job: Job } | null = null;

/**
 * The parcel and the drop point of delivery number `n` (0 first), picked from `n` and `seed` (the round second the last delivery was
 * made in, shown by his client as `seed`): inside the ring, out of cover, 6 to 13 m apart. A pure function: both screens get the same.
 */
export function jobOf(n: number, seed: number): Job {
  const key = n * 1000 + seed;
  if (lastJob && lastJob.key === key) return lastJob.job;
  const rnd = seeded(n * 7919 + seed * 104729 + 12345);
  const spot = () => {
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, r = 1.5 + Math.sqrt(rnd()) * (RING_LIMIT - 1.5);
      const x = RING_X + Math.cos(a) * r, z = RING_Z + Math.sin(a) * r;
      if (coverGap(x, z) >= COVER_GAP) return { x, z };
    }
    return null;
  };
  let job: Job = { px: -6, pz: RING_Z, dx: 6, dz: RING_Z };
  const p = spot();
  if (p) {
    for (let i = 0; i < 40; i++) {
      const d = spot();
      if (!d) break;
      const gap = Math.hypot(d.x - p.x, d.z - p.z);
      if (gap >= 6 && gap <= 13) { job = { px: p.x, pz: p.z, dx: d.x, dz: d.z }; break; }
    }
  }
  lastJob = { key, job };
  return job;
}

// A knocked-loose parcel's spot travels as two small whole numbers (a `show` value is 1..999).
const encodeX = (x: number) => Math.round(x * 10) + 200;
const encodeZ = (z: number) => Math.round(z * 10) + 100;
const decodeX = (n: number) => (n - 200) / 10;
const decodeZ = (n: number) => (n - 100) / 10;

// ---------------------------------------------------------------------------------------------------------------
// What he leaves for the effects (they play on both screens).
// ---------------------------------------------------------------------------------------------------------------

/** A Final Delivery parcel in flight. `x`, `z`: where it is (the effect moves it, on each screen). `t0`: `performance.now()` at the cast. */
export interface FinalRec {
  t0: number;
  x: number;
  z: number;
  state: 'fly' | 'burst' | 'signed';
  /** The Charges it cost, which set its damage. */
  paid: number;
  /** The burst's hit was decided (victim's screen). */
  hitDone: boolean;
}

/**
 * Per figure. `charge`: Charges now. `paid`: Charges the last Final Delivery spent. `spent`: counts Shortcuts that refunded
 * themselves (an effect compares it with what it saw). `fin`: the parcel in flight.
 */
export interface CourierBook { charge: number; paid: number; spent: number; fin: FinalRec | null }
export const courierBooks = new WeakMap<object, CourierBook>();

export function bookOf(who: object): CourierBook {
  let b = courierBooks.get(who);
  if (!b) { b = { charge: 0, paid: 0, spent: 0, fin: null }; courierBooks.set(who, b); }
  return b;
}

/** Copies the shown values into the book (both screens, every frame it is asked). */
function syncBook(t: TraitView) {
  const b = bookOf(t.self());
  b.charge = t.own('charge');
  b.paid = t.own('paid');
  return b;
}

/** Whether (x, z) is within `reach` m of the surface of any cover. */
function nearCover(x: number, z: number, reach: number) {
  return coverGap(x, z) <= reach;
}

/** The enemy's name as the parcel carries it: nothing in a trait or the cast context reads a hero's name, so it is URGENT. */
export const PARCEL_NAME = 'URGENT';

const GOT_WORDS = ['GOT IT!', 'ON MY WAY', 'SPECIAL DELIVERY'];

/** What both screens say when the shown state changes (his own client from `tick`, the other from `ownChanged`). */
function announce(t: TraitView, name: string, n: number) {
  if (name === 'carry' && n === 1) t.say(GOT_WORDS[t.own('deliv') % GOT_WORDS.length], ACCENT);
  else if (name === 'deliv' && n > 0) t.say('DELIVERED', ACCENT);
  else if (name === 'loose' && n === 1) t.say('MY PARCEL!', '#e0503f');
}

/** The spot the parcel is at now when it is not carried: knocked loose, or its place in the job. */
function parcelSpot(t: TraitView, job: Job) {
  return t.own('loose') > 0 ? { x: decodeX(t.own('lx')), z: decodeZ(t.own('lz')) } : { x: job.px, z: job.pz };
}

/**
 * Pip, the last courier (skirmisher). Passive Sign Here: a parcel lies on the arena and the drop point is shown (both are big marks
 * on the floor with a beam of light, and a line of marching dashes runs from the parcel to the drop). He walks into the parcel to
 * carry it, and carries it to the drop point: a delivery, +1 Charge (3 at most), and the next parcel and drop appear. A hit on
 * him while he carries knocks it loose: it lies where he was and he can pick it up again after 1.2 s. Charges are his: Express
 * Letter deals +15 per Charge, Shortcut can spend one to be ready again, Final Delivery spends all of them for +40 each.
 *
 * Where each rule runs. The job (parcel, drop) is `jobOf(deliveries, seed)`, pure, and both screens read the same two shown numbers
 * (`deliv`, `seed`), so they draw the same marks (`marks`) without a message for the places. Carrying, picking up and delivering are
 * decided in `tick` on his own client and shown with `show` (`carry`, `loose` with its place in `lx` and `lz`, `deliv`, `seed`,
 * `charge`); a hit that knocks it loose is `taken`, also his own client. The effects read `courierBooks`, filled from the shown values
 * on both screens. Final Delivery's parcel is a `FinalRec` the effect moves on both screens, homing on the enemy's position (known on
 * both); the burst and the signature (cover touched first) are decided in `victimTick`, where the enemy hero's hits are decided.
 * The CPU: `aiGoal` walks it to the parcel and then the drop when the enemy is not within 4 m; `aiHold` keeps R for 1+ Charge and E
 * (which would spend one) while it has Charges and the enemy is not close.
 */
export const courierTrait: Trait = {
  passive: {
    name: 'Sign Here',
    blurb: 'A parcel lies on the arena and the drop point is shown. Carry one to the other: +1 Charge, 3 at most. A hit on him while he carries knocks the parcel loose where he stood.',
  },
  twist: {
    name: 'Charges',
    blurb: 'Express Letter hits harder for each Charge, Shortcut can spend one to be ready again, Final Delivery spends all. You can read his route, and stand on the drop point.',
  },
  speed: 4.7,
  attack: { kind: 'ranged', range: 5, damage: 11, interval: 0.8, windup: 0.2, speed: 20, look: 'orb' },
  ownLook: {
    charge: { color: ACCENT, shape: 'gem' },
    carry: { color: FOIL, shape: 'mark' },
  },

  // The CPU playing him: walk to the parcel, then to the drop, unless the enemy is within 4 m.
  aiGoal(t) {
    if (t.enemyDistance() < 4) return null;
    const job = jobOf(t.own('deliv'), t.own('seed'));
    if (t.own('carry') > 0) return { x: job.dx, z: job.dz };
    return parcelSpot(t, job);
  },

  // R only with a Charge to spend; E (which spends one) only without Charges, or to get away.
  aiHold(t, slot, dist) {
    const c = t.own('charge');
    if (slot === 3) return c < 1;
    if (slot === 2) return c >= 1 && dist >= 3.5;
    return false;
  },

  // The parcel, the drop point and the route, on both screens.
  marks(t) {
    syncBook(t);
    const job = jobOf(t.own('deliv'), t.own('seed'));
    const age = Math.max(0, t.time - t.own('seed'));
    const out: GroundMark[] = [{ x: job.dx, z: job.dz, kind: 'drop', age, life: 1e6 }];
    let ax: number, az: number;
    if (t.own('carry') > 0) {
      const p = t.self().group.position;
      ax = p.x; az = p.z;
      out.push({ x: ax, z: az, kind: 'carried', age: 5, life: 1e6 });
    } else {
      const s = parcelSpot(t, job);
      ax = s.x; az = s.z;
      out.push({ x: ax, z: az, kind: 'parcel', age: t.own('loose') > 0 ? 5 : age, life: 1e6 });
    }
    // Marching dashes from the parcel to the drop: 1.2 m apart, sliding toward the drop.
    const dx = job.dx - ax, dz = job.dz - az, d = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    if (d > 3) {
      const step = 1.2, shift = (t.time * 1.4) % step;
      for (let s = 1.2 + shift; s < d - 1.2 && out.length < 24; s += step) {
        out.push({ x: ax + (dx / d) * s, z: az + (dz / d) * s, kind: 'dash', age: 5, life: 1e6, yaw });
      }
    }
    return out;
  },
  markLook: {
    parcel: () => parcelLook(),
    drop: () => dropLook(),
    carried: () => carriedLook(),
    dash: () => dashLook(),
  },

  // His own client: Shortcut spends a Charge to be ready again; Final Delivery spends them all.
  cooldown(t, slot, base) {
    if (slot === 2 && t.own('charge') >= 1) { t.mem.refund = 1; return SHORTCUT_REFUNDED; }
    return base;
  },
  afterCast(t, slot) {
    const b = bookOf(t.self());
    if (slot === 2 && t.mem.refund === 1) {
      t.mem.refund = 0;
      b.charge = Math.max(0, t.own('charge') - 1);
      b.spent = (b.spent % 900) + 1;
      t.show('spent', b.spent);
      t.show('charge', b.charge);
    } else if (slot === 3) {
      b.paid = Math.min(MAX_CHARGE, t.own('charge'));
      b.charge = 0;
      t.show('paid', b.paid);
      t.show('charge', 0);
    }
  },

  // His own client: pick the parcel up, deliver it.
  tick(t) {
    const b = syncBook(t);
    const p = t.self().group.position;
    const n = t.own('deliv'), job = jobOf(n, t.own('seed'));
    if (t.own('carry') > 0) {
      if (Math.hypot(p.x - job.dx, p.z - job.dz) > DROP_REACH) return;
      b.charge = Math.min(MAX_CHARGE, t.own('charge') + 1);
      t.show('seed', (Math.floor(t.time) % 997) + 1);
      t.show('deliv', (n % 900) + 1);
      t.show('carry', 0);
      t.show('charge', b.charge);
      announce(t, 'deliv', n + 1);
      return;
    }
    const s = parcelSpot(t, job), loose = t.own('loose') > 0;
    if (Math.hypot(p.x - s.x, p.z - s.z) > PICK_REACH) return;
    if (loose && t.time - (t.mem.dropAt ?? -99) < LOOSE_GRACE) return;
    t.show('loose', 0);
    t.show('carry', 1);
    announce(t, 'carry', 1);
  },

  // His own client: a hit while he carries knocks the parcel loose where he stands.
  taken(t, hit) {
    if (t.own('carry') < 1 || hit.blocked || hit.damage <= 0) return;
    const p = t.self().group.position;
    t.mem.dropAt = t.time;
    t.show('lx', encodeX(p.x));
    t.show('lz', encodeZ(p.z));
    t.show('loose', 1);
    t.show('carry', 0);
    announce(t, 'loose', 1);
  },

  // The other screen learns what his client showed.
  ownChanged(t, name, n) {
    const b = syncBook(t);
    if (name === 'spent') b.spent = n;
    announce(t, name, n);
  },

  // The screen that decides the enemy hero's hits: the signature, and the burst of a Final Delivery.
  victimTick(t) {
    const f = courierBooks.get(t.self())?.fin, e = t.enemy();
    // A parcel whose effect stopped (a new round) is no rule any more.
    if (!f || !e || performance.now() - f.t0 > (FINAL_TIME + 2) * 1000) return;
    const p = e.group.position;
    if (f.state === 'fly') {
      if (nearCover(p.x, p.z, SIGN_REACH)) {
        f.state = 'signed';
        t.noteOwner('signed', 1);
        t.say('SIGNED!', ACCENT);
      }
    } else if (f.state === 'burst' && !f.hitDone) {
      f.hitDone = true;
      if (Math.hypot(p.x - f.x, p.z - f.z) <= FINAL_RADIUS) {
        t.hitEnemy({
          damage: FINAL_DAMAGE + FINAL_PER_CHARGE * f.paid, knock: 4, color: ACCENT, from: new THREE.Vector3(f.x, 0, f.z),
        });
      }
    }
  },

  // His own client: the enemy signed for the parcel.
  peerNote(t, name) {
    if (name !== 'signed') return;
    const f = courierBooks.get(t.self())?.fin;
    if (f && f.state === 'fly') f.state = 'signed';
  },

  badge(t) {
    const c = t.own('charge');
    return c > 0 ? String(c) : '';
  },
};
