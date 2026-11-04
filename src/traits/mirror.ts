import type { GroundMark, Trait, TraitView } from './types';
import { restingMirrorLook } from '../effects/parts/mirror';

/** Hand Mirror (Q): damage, range, speed, wind-up, bounces, and the extra reach each bounce gives. */
export const HAND_DAMAGE = 52;
export const HAND_RANGE = 10;
export const HAND_SPEED = 22;
export const HAND_WIND = 0.3;
export const HAND_BOUNCES = 3;
export const BANK_BONUS = 0.25;
export const BANK_RANGE = 2;

/** Vanity Stand (W): reach, HP, seconds it stands, and Bad Luck (the share of damage it takes off, and for how long). */
export const STAND_RANGE = 8;
export const STAND_HP = 60;
export const STAND_LIFE = 6;
export const STAND_RISE = 0.5;
export const LUCK_AMOUNT = 0.15;
export const LUCK_SECONDS = 7;
/** The engine caps one application of a buff at `BUFF_MAX_SECONDS` (6 s): the last second is a second application. */
export const LUCK_FIRST = 6;

/** Through the Glass (E): the longest step out of a Stand, the step with none, and its time. */
export const GLASS_MAX = 9;
export const GLASS_BEYOND = 3;
export const GLASS_PLAIN = 3;
export const GLASS_TIME = 0.3;

/** Hall of Mirrors (R): mirrors, damage, wind-up, speed, range, bounces; and the seconds a caught floor mirror cuts. */
export const HALL_COUNT = 8;
export const HALL_DAMAGE = 40;
export const HALL_WIND = 0.6;
export const HALL_SPEED = 16;
export const HALL_RANGE = 12;
export const HALL_BOUNCES = 2;
export const HALL_CUT = 2;
export const HALL_LANDED = 4;

/** A mirror lying on the floor can be caught from this near (m), and lies for this long (s). */
export const CATCH_RADIUS = 1;
export const REST_SECONDS = 2.5;

export interface MirrorMark {
  /** Unique per figure, the same on both screens (cast number x 16 + spoke): the catch message names it. */
  id: number;
  x: number;
  z: number;
  kind: 'hand' | 'hall';
  /** `performance.now()` milliseconds: when it lands, and when it is gone. */
  bornAt: number;
  until: number;
  yaw: number;
  /** Caught, or its bolt hit someone. */
  gone: boolean;
}

export interface StandRecord {
  x: number;
  z: number;
  bornAt: number;
  until: number;
  /** Broken (by damage), or about to be: neither a step nor a bounce may use it. */
  gone: boolean;
  /** The victim's screen saw it break: Bad Luck is due there. `luckAt`: when (`t.time`) it was first applied; `luckDone`: the 7th second was added. */
  broke: boolean;
  luckAt: number;
  luckDone: boolean;
}

/**
 * What Silvane leaves behind, per figure (the effects play on both screens and the CPU's side reuses one effect for every
 * cast, so the state lives here and not in an effect). `seq`: Q and R casts so far (both screens count every one). `marks`:
 * the mirrors on the floor. `stand`: the last Vanity Stand. `qHitAt`: when her last Hand Mirror hit (`landed`, own client).
 */
export interface MirrorBook { seq: number; marks: MirrorMark[]; stand: StandRecord | null; qHitAt: number }
export const mirrorBooks = new WeakMap<object, MirrorBook>();

export function bookOf(who: object): MirrorBook {
  let b = mirrorBooks.get(who);
  if (!b) { b = { seq: 0, marks: [], stand: null, qHitAt: 0 }; mirrorBooks.set(who, b); }
  return b;
}

/** Drops marks that are gone or past their time. */
export function sweepMarks(b: MirrorBook, now = performance.now()) {
  b.marks = b.marks.filter((m) => !m.gone && now < m.until);
}

const CATCH_WORDS = ['GORGEOUS', 'STUNNING', 'DARLING'];
const VAIN_WORDS = ['FLAWLESS', 'NO NOTES', 'RADIANT', 'STILL GORGEOUS'];

/**
 * Silvane (marksman). Passive Fairest of All: each bounce of her bolts adds 25% damage and 2 m of range (the projectile system's
 * `reflectBonus`, set by her spells). A mirror that ends its flight on the floor after a bounce lies there for 2.5 s and she can
 * walk over it (within 1 m) to catch it: a caught Hand Mirror ends Hand Mirror's cooldown, gives 20% speed for 2 s and a short
 * pose ("GORGEOUS"); a caught Hall of Mirrors mirror (4 at most) cuts 2 s off Hall of Mirrors.
 *
 * Where each rule runs. The floor mirrors are `mirrorBooks` records the spells write on BOTH screens at the cast, from `sentFrom`,
 * the aim and `ctx.obstacles()` (a pure `bankPath`), with ids that count casts, so both screens agree and both draw them (`marks`).
 * Catching is decided in `tick` on her own client: it reads her position, clears the mark, does the rewards (`setCooldown`,
 * `buff`, `hold` are all her own client's) and tells the other screen with `show('caught', id)`, where `ownChanged` clears the
 * same mark. Bad Luck: the Stand's unit lives on the screen where the cast is played against the breaker (the victim's screen
 * online, the only screen offline), so its `onDeath` sets `stand.broke` there and `victimTick`, which runs on that same screen,
 * applies `weaken` 15% to the enemy hero with `hitEnemy` (damage 0): the screen that decides the breaker's damage is the one
 * that must know. It also tells her own client with `noteOwner('broke')` (`peerNote`) so her Stand is gone there too.
 */
export const mirrorTrait: Trait = {
  passive: {
    name: 'Fairest of All',
    blurb: 'Each bounce of her bolts adds 25% damage and 2 m of range. A mirror that comes to rest on the floor after a bounce stays 2.5 s: she catches it by walking within 1 m. A caught Hand Mirror is ready again and she is 20% faster for 2 s; a caught Hall of Mirrors mirror cuts 2 s off Hall of Mirrors.',
  },
  twist: {
    name: 'Catch',
    blurb: 'Every thrown mirror asks whether to walk to the catch. Hit her on the catch: you can see where she must walk.',
  },
  speed: 4.1,
  attack: { kind: 'ranged', range: 7.5, damage: 14, interval: 1.2, windup: 0.3, speed: 22, look: 'prism' },
  marks(t) {
    const b = mirrorBooks.get(t.self());
    if (!b || b.marks.length === 0) return [];
    const now = performance.now(), out: GroundMark[] = [];
    for (const m of b.marks) {
      if (m.gone || now < m.bornAt || now >= m.until) continue;
      out.push({ x: m.x, z: m.z, kind: m.kind, age: (now - m.bornAt) / 1000, life: REST_SECONDS, yaw: m.yaw });
    }
    return out;
  },
  markLook: {
    hand: () => restingMirrorLook(CATCH_RADIUS, false),
    hall: () => restingMirrorLook(CATCH_RADIUS, true),
  },
  tick(t) {
    const b = mirrorBooks.get(t.self());
    if (!b || b.marks.length === 0) return;
    const now = performance.now(), p = t.self().group.position;
    for (const m of b.marks) {
      if (m.gone || now < m.bornAt || now >= m.until) continue;
      if (Math.hypot(p.x - m.x, p.z - m.z) > CATCH_RADIUS) continue;
      m.gone = true;
      catchMirror(t, m);
      t.show('caught', m.id);
    }
    sweepMarks(b, now);
  },
  ownChanged(t, name, n) {
    if (name !== 'caught') return;
    const b = mirrorBooks.get(t.self());
    const m = b?.marks.find((k) => k.id === n);
    if (m) m.gone = true;
  },
  landed(t, hit) {
    if (hit.kind === 'spell' && hit.slot === 0 && hit.victimIsHero) bookOf(t.self()).qHitAt = performance.now();
    // A rare word of self-praise; her own screen only, so it may use chance.
    if (hit.victimIsHero && hit.damage > 0 && t.time - (t.mem.vainAt ?? -99) > 8 && Math.random() < 0.12) {
      t.mem.vainAt = t.time;
      t.say(VAIN_WORDS[Math.floor(Math.random() * VAIN_WORDS.length)], '#d9b8ff');
    }
  },
  /** Bad Luck on whoever broke the Stand: runs where the breaker's damage is decided. */
  victimTick(t) {
    const st = mirrorBooks.get(t.self())?.stand;
    if (!st || !st.broke) return;
    if (!st.luckDone && st.luckAt === 0) {
      st.luckAt = t.time;
      t.hitEnemy({ damage: 0, knock: 0, color: '#a89ab8', debuff: { kind: 'weaken', amount: LUCK_AMOUNT, seconds: LUCK_FIRST } });
      t.noteOwner('broke', 1);
      t.say('SEVEN YEARS BAD LUCK', '#d9b8ff');
    } else if (!st.luckDone && st.luckAt > 0 && t.time >= st.luckAt + LUCK_FIRST - 0.4) {
      st.luckDone = true;
      t.hitEnemy({ damage: 0, knock: 0, color: '#a89ab8', debuff: { kind: 'weaken', amount: LUCK_AMOUNT, seconds: LUCK_SECONDS - LUCK_FIRST + 0.4 } });
    }
  },
  peerNote(t, name) {
    if (name !== 'broke') return;
    const st = mirrorBooks.get(t.self())?.stand;
    if (st) st.gone = true;
  },
  badge(t) {
    const b = mirrorBooks.get(t.self());
    if (!b) return '';
    const now = performance.now(), n = b.marks.filter((m) => !m.gone && now >= m.bornAt && now < m.until).length;
    return n > 0 ? String(n) : '';
  },
};

/** The rewards of a catch (her own client). */
function catchMirror(t: TraitView, m: MirrorMark) {
  if (m.kind === 'hand') {
    t.setCooldown(0, 0);
    t.buff('haste', 0.2, 2);
    t.hold(0.25);
    t.say(CATCH_WORDS[Math.floor(Math.random() * CATCH_WORDS.length)], '#cfe6ff');
  } else {
    t.setCooldown(3, Math.max(0, t.cooldownLeft(3) - HALL_CUT));
    t.say(`DARLING -${HALL_CUT}s`, '#d9b8ff');
  }
}
