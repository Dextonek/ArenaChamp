import * as THREE from 'three';
import { wetLook } from '../effects/parts/janitor';
import type { GroundMark, Trait, TraitView } from './types';

/** Big Mop (Q): damage, the cone's reach and full angle, wind-up, and the wet strip it leaves (length, width). */
export const MOP_DAMAGE = 56;
export const MOP_REACH = 3.5;
export const MOP_ANGLE = 140;
export const MOP_WIND = 0.3;
export const STRIP_LENGTH = 6;
export const STRIP_WIDTH = 2;

/** Wet floor lasts this long (s) after Big Mop or the bucket; Flood's lasts `FLOOD_LIFE`. */
export const WET_LIFE = 6;

/**
 * The slide. On wet floor an enemy's velocity follows what they press for with this rate (1/s): about 0.25 s to catch up (they turn
 * half as fast) and, once they stop pressing, the glide eases out to nothing over about 0.6 s (0.8 m from a walk). `SLIDE_CAP`:
 * the fastest slide (m/s), so a dash or a knockback does not become a long skate.
 */
export const SLIDE_RATE = 4;
export const SLIDE_CAP = 6;

/** Wet Floor Sign (W): reach, HP, seconds it stands, rise time, what a slide into it does, and the slide speed it needs. */
export const SIGN_RANGE = 8;
export const SIGN_HP = 40;
export const SIGN_LIFE = 6;
export const SIGN_RISE = 0.4;
export const SIGN_DAMAGE = 40;
export const SIGN_STUN = 0.6;
/** The slide's speed toward the sign (m/s) a hero needs to hurt itself on it: sliding counts, walking on dry floor does not. */
export const SIGN_SPEED = 2.5;
export const SIGN_CHARGES = 2;
export const SIGN_EVERY = 8;
export const SIGN_HALF = 0.45;
export const SIGN_R = 0.2;
/** Slide-hits on one sign are at least this far apart (s). */
export const SIGN_GAP = 1;

/** Mop Bucket (E): reach, speed, wind-up, damage, bolt radius, and the wet splash where it stops. */
export const BUCKET_RANGE = 8;
export const BUCKET_SPEED = 16;
export const BUCKET_WIND = 0.3;
export const BUCKET_DAMAGE = 55;
export const BUCKET_RADIUS = 0.4;
export const SPLASH_R = 2.5;

/** Flood (R): radius, warning, seconds it floods, his surf (haste), and what his Q deals meanwhile. */
export const FLOOD_RADIUS = 7;
export const FLOOD_WARN = 1;
export const FLOOD_LIFE = 5;
export const FLOOD_HASTE = 0.35;
export const FLOOD_MOP = 60;

export interface WetPatch {
  kind: 'strip' | 'splash' | 'flood';
  x: number;
  z: number;
  /** Strips only: the heading (atan2(dx, dz)) and the length. A splash or a flood is a disc of radius `r`. */
  yaw: number;
  length: number;
  r: number;
  /** `performance.now()` milliseconds: when it is wet, and when it dries. */
  bornAt: number;
  until: number;
}

export interface SignRecord {
  /** Unique per figure, the same on both screens (casts count). */
  id: number;
  x: number;
  z: number;
  bornAt: number;
  until: number;
  /** Broken or timed out: it no longer stands. */
  gone: boolean;
  /** The victim's screen saw it broken (`victimTick` tells his own client). `told`: that was done. */
  broke: boolean;
  told: boolean;
  /** `performance.now()` of the last slide into it (the effect clangs), and of the last one that hurt (the gap). */
  hitAt: number;
  slideAt: number;
}

/**
 * What Gus leaves behind, per figure (effects play on both screens and the CPU's next cast restarts an effect, so the state lives
 * here and not in an effect). `wet`: the patches of wet floor. `signs`: the signs. `seq`: signs so far (both screens count every one).
 */
export interface JanitorBook { wet: WetPatch[]; signs: SignRecord[]; seq: number }
export const janitorBooks = new WeakMap<object, JanitorBook>();

export function bookOf(who: object): JanitorBook {
  let b = janitorBooks.get(who);
  if (!b) { b = { wet: [], signs: [], seq: 0 }; janitorBooks.set(who, b); }
  return b;
}

/** Writes a patch (both screens, from the effect that lands it), dropping dry ones. */
export function addWet(who: object, p: WetPatch) {
  const b = bookOf(who), now = performance.now();
  b.wet = b.wet.filter((w) => now < w.until);
  if (b.wet.length >= 24) b.wet.shift();
  b.wet.push(p);
}

/** Is the floor at (x, z) wet now? A strip is a rectangle (`length` along `yaw`, `STRIP_WIDTH` across), the others discs. */
export function isWet(b: JanitorBook, x: number, z: number, now = performance.now()): boolean {
  for (const w of b.wet) {
    if (now < w.bornAt || now >= w.until) continue;
    const dx = x - w.x, dz = z - w.z;
    if (w.kind === 'strip') {
      const s = Math.sin(w.yaw), c = Math.cos(w.yaw);
      const along = dx * s + dz * c, across = dx * c - dz * s;
      if (along >= 0 && along <= w.length && Math.abs(across) <= STRIP_WIDTH / 2) return true;
    } else if (Math.hypot(dx, dz) <= w.r) return true;
  }
  return false;
}

const SIGH = '*sigh*';

function floodRunning(t: TraitView) {
  return t.mem.floodOn === 1;
}

/**
 * Gus, the janitor (controller, melee). Passive Wet Floor: what he mops stays wet for 6 s, shining (`wet` in `janitorBooks`, written by
 * Big Mop, the bucket and Flood on BOTH screens at the moment they land, drawn by `marks`). On wet floor the enemy keeps sliding the
 * way they were going and turns half as fast; he alone does not slide. His mop also wipes the enemy's rods, flowers and ink along its
 * strip (`wipeGround`, in the effect). A hero who slides into a Wet Floor Sign at 2.5 m/s or more takes 40 and is stunned 0.6 s.
 *
 * Where each rule runs. The slide is `victimTick` (the screen that decides the enemy's position: the only screen offline, the victim's
 * online): it measures the enemy's OWN step each frame (their position now minus where they stood after last frame's carry), turns it
 * into a velocity, and while the floor under them is wet it keeps a momentum `v` that follows that velocity at `SLIDE_RATE`. The carry
 * that makes up the difference (`v - own`, times dt) goes through `t.carryEnemy`, so a hero pressing steadily is not faster at all,
 * only slower to turn and slower to stop, and cover still stops them. Off the wet floor `v` is just their own step. A sign hit needs
 * the slide's speed toward the sign to be `SIGN_SPEED` or more: walking on dry floor at 4 m/s never hurts. Flood: `afterCast` notes the
 * cast, `tick` starts the surf (haste 35%) when the water comes (1 s), `castMods` makes his Q hit for 60 meanwhile; a ring at his
 * feet shows the surf on both screens. The CPU: see `aiHold` and `aiGoal`.
 */
export const janitorTrait: Trait = {
  passive: {
    name: 'Wet Floor',
    blurb: 'What he mops stays wet and shining for 6 s. On it you keep sliding the way you were going and turn half as fast; he never slides. His mop wipes your rods, flowers and ink along its strip. Slide into his sign at speed: 40 and a 0.6 s stun.',
  },
  twist: {
    name: 'Where to Mop',
    blurb: 'Mop in your way, or where he wants you to end. The wet shows, and a slide is fast, so you can use it too: slide on purpose, or walk round the shine.',
  },
  speed: 3.9,
  attack: { kind: 'melee', range: 2.8, damage: 18, interval: 1.3, windup: 0.35, speed: 0, look: 'sweep' },
  charges: { slot: 1, count: SIGN_CHARGES, every: SIGN_EVERY },

  // The CPU swings the mop only within reach; the sign only with the enemy on wet floor, within 8 m, and none of his standing;
  // the bucket from 2.5 to 7.5 m; the flood only with the enemy within 5.5 m and no flood running.
  aiHold(t, slot, dist) {
    const e = t.enemy(), b = janitorBooks.get(t.self());
    if (slot === 0) return dist > MOP_REACH - 0.2;
    if (slot === 1) {
      const now = performance.now();
      const wet = !!e && !!b && isWet(b, e.group.position.x, e.group.position.z, now);
      const standing = !!b && b.signs.some((s) => !s.gone && now < s.until);
      return dist > SIGN_RANGE || !wet || standing;
    }
    if (slot === 2) return dist < 2.5 || dist > BUCKET_RANGE - 0.5;
    if (slot === 3) return dist > 5.5 || floodRunning(t);
    return false;
  },

  // With one of his signs standing and the enemy on wet floor, the CPU gets round to the far side of the enemy, so the way away
  // from him runs onto the sign.
  aiGoal(t) {
    const e = t.enemy(), b = janitorBooks.get(t.self());
    if (!e || !b) return null;
    const now = performance.now(), p = e.group.position;
    if (!isWet(b, p.x, p.z, now)) return null;
    const s = b.signs.find((k) => !k.gone && now >= k.bornAt && now < k.until);
    if (!s) return null;
    const dx = p.x - s.x, dz = p.z - s.z, l = Math.hypot(dx, dz);
    if (l < 0.5 || l > 7) return null;
    return { x: p.x + (dx / l) * 2.2, z: p.z + (dz / l) * 2.2 };
  },

  castMods(t, slot) {
    // Flood: his Q is 60 while he surfs.
    if (slot === 0 && floodRunning(t) && t.time < t.mem.floodAt + FLOOD_WARN + FLOOD_LIFE) return { power: FLOOD_MOP / MOP_DAMAGE };
    return {};
  },

  afterCast(t, slot) {
    if (slot !== 3) return;
    t.mem.floodAt = t.time;
    t.mem.floodOn = 0;
    t.say(SIGH, '#ffd23a');
  },

  tick(t) {
    const m = t.mem;
    if (!(m.floodAt > 0) && m.floodOn !== 1) return;
    if (m.floodOn !== 1 && m.floodAt > 0 && t.time >= m.floodAt + FLOOD_WARN) {
      // The water is here: he surfs for the rest of the flood.
      m.floodOn = 1;
      t.buff('haste', FLOOD_HASTE, FLOOD_LIFE);
      t.show('flood', 1);
    } else if (m.floodOn === 1 && t.time >= m.floodAt + FLOOD_WARN + FLOOD_LIFE) {
      m.floodOn = 0;
      m.floodAt = 0;
      t.show('flood', 0);
    }
  },

  landed(t, hit) {
    // A tired sigh now and then; his own screen only, so it may use chance.
    if (hit.kind === 'spell' && hit.slot === 0 && hit.victimIsHero && t.time - (t.mem.sighAt ?? -99) > 10 && Math.random() < 0.25) {
      t.mem.sighAt = t.time;
      t.say(SIGH, '#ffd23a');
    }
  },

  ring(t) {
    return t.own('flood') > 0 ? { radius: 1.15, color: '#74c0ea', opacity: 0.55 } : null;
  },

  marks(t) {
    const b = janitorBooks.get(t.self());
    if (!b || b.wet.length === 0) return [];
    const now = performance.now(), out: GroundMark[] = [];
    for (const w of b.wet) {
      if (now < w.bornAt || now >= w.until) continue;
      const age = (now - w.bornAt) / 1000, life = (w.until - w.bornAt) / 1000;
      if (w.kind === 'strip') out.push({ x: w.x, z: w.z, kind: 'strip', age, life, yaw: w.yaw, length: w.length });
      else out.push({ x: w.x, z: w.z, kind: w.kind, age, life });
    }
    return out;
  },
  markLook: {
    strip: () => wetLook('strip'),
    splash: () => wetLook('splash', SPLASH_R),
    flood: () => wetLook('flood', FLOOD_RADIUS),
  },

  /** The slide, and a sign's hit on a sliding enemy, on the screen that decides the enemy's position. */
  victimTick(t, dt) {
    const e = t.enemy();
    if (!e) return;
    const p = e.group.position, m = t.mem, b = janitorBooks.get(t.self());
    if (!(m.has > 0) || !(dt > 0) || dt > 0.25) { m.has = 1; m.lx = p.x; m.lz = p.z; m.vx = 0; m.vz = 0; return; }
    // Signs that were broken on this screen: his own client must drop them too.
    if (b) for (const s of b.signs) if (s.broke && !s.told) { s.told = true; t.noteOwner('signbroke', s.id); }
    // Their own step this frame, as a velocity (m.lx is where they stood after last frame's carry).
    let ox = (p.x - m.lx) / dt, oz = (p.z - m.lz) / dt;
    const os = Math.hypot(ox, oz);
    if (os > SLIDE_CAP) { ox = (ox / os) * SLIDE_CAP; oz = (oz / os) * SLIDE_CAP; }
    const now = performance.now();
    const wet = !!b && isWet(b, p.x, p.z, now) && !t.status(e)?.cannotMove;
    if (!wet) {
      // Dry floor: what they do is what they do, and the momentum is just their step.
      m.vx = ox;
      m.vz = oz;
    } else {
      const k = Math.min(1, dt * SLIDE_RATE);
      m.vx += (ox - m.vx) * k;
      m.vz += (oz - m.vz) * k;
      const vs = Math.hypot(m.vx, m.vz);
      if (vs > SLIDE_CAP) { m.vx = (m.vx / vs) * SLIDE_CAP; m.vz = (m.vz / vs) * SLIDE_CAP; }
      if (b && vs >= SIGN_SPEED) slideIntoSign(t, b, p, now);
      // The difference between the glide and their own step is the carry: a hero pressing steadily gets none.
      t.carryEnemy((m.vx - ox) * dt, (m.vz - oz) * dt);
    }
    m.lx = p.x;
    m.lz = p.z;
  },

  peerNote(t, name, n) {
    const s = janitorBooks.get(t.self())?.signs.find((k) => k.id === n);
    if (!s) return;
    if (name === 'signbroke') s.gone = true;
    else if (name === 'signhit') s.hitAt = performance.now();
  },
  ownChanged() { /* the surf is read through `own('flood')` */ },

  badge(t) {
    const b = janitorBooks.get(t.self());
    if (!b || b.wet.length === 0) return '';
    const now = performance.now(), n = b.wet.filter((w) => now >= w.bornAt && now < w.until).length;
    return n > 0 ? String(n) : '';
  },
};

/** A slide into a standing sign: 40 and a stun, the slide ends, the sign clangs. Only the slide toward it counts. */
function slideIntoSign(t: TraitView, b: JanitorBook, p: THREE.Vector3, now: number) {
  const m = t.mem, vs = Math.hypot(m.vx, m.vz);
  for (const s of b.signs) {
    if (s.gone || now < s.bornAt || now >= s.until || now - s.slideAt < SIGN_GAP * 1000) continue;
    const qx = Math.min(s.x + SIGN_HALF, Math.max(s.x - SIGN_HALF, p.x)), dx = qx - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz);
    // The body (0.5 m) and the sign's own thickness, and a little give: the engine holds them just outside that.
    if (d > SIGN_R + 0.5 + 0.35) continue;
    const toward = d < 1e-3 ? vs : (m.vx * dx + m.vz * dz) / d;
    if (toward < SIGN_SPEED) continue;
    s.slideAt = s.hitAt = now;
    m.vx = m.vz = 0;
    t.hitEnemy({ damage: SIGN_DAMAGE, knock: 0, from: new THREE.Vector3(s.x, 0, s.z), color: '#ffd23a', status: { kind: 'stun', seconds: SIGN_STUN } });
    t.noteOwner('signhit', s.id);
    return;
  }
}
