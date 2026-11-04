import type { GroundMark, Trait } from './types';
import { pitLook } from '../effects/parts/mole';

/** Claw (Q): reach (m), the cone's full width (degrees), damage, wind-up (s). */
export const CLAW_REACH = 2.5;
export const CLAW_ANGLE = 120;
export const CLAW_DAMAGE = 68;
export const CLAW_WIND = 0.4;

/** Dig (W): reach, the hole's radius (m), seconds until it opens. */
export const DIG_RANGE = 6;
export const DIG_RADIUS = 1.5;
export const DIG_DELAY = 0.7;

/** Dig Site (passive): how long a hole lasts (s), how many stand at once, and what falling in does. */
export const HOLE_LIFE = 8;
export const HOLE_MAX = 3;
export const FALL_ROOT = 0.8;
/**
 * The design says -15% speed for 2 s after the root. The engine has no slow-by-amount (the `slow` status is always -40%), so the
 * same walking time is lost with `slow`: 15% of 2 s = 0.3 s = 40% of 0.75 s. Given with the root, so it starts as the root ends.
 */
export const FALL_SLOW = 0.75;

/** Mole Run (E): the dive, the time underground, her speed bonus, the farthest she can go (m), the pop-up's reach, damage and knock-up. */
export const TUNNEL_DIVE = 0.3;
export const TUNNEL_UNDER = 1.2;
export const TUNNEL_SPEED = 1.4;
export const MOLE_SPEED = 4.3;
export const TUNNEL_MAX = MOLE_SPEED * TUNNEL_SPEED * TUNNEL_UNDER;
export const TUNNEL_MIN = 2;
export const TUNNEL_RADIUS = 1.5;
export const TUNNEL_DAMAGE = 60;
export const TUNNEL_KNOCKUP = 0.5;

/** Sinkhole (R): reach, the pit's radius, the warning, the root and the damage. */
export const SINK_RANGE = 9;
export const SINK_RADIUS = 4;
export const SINK_DELAY = 1.3;
export const SINK_ROOT = 1;
export const SINK_DAMAGE = 115;

/** One hole she has dug. `bornAt` / `until`: `performance.now()` ms. `in`: the enemy stands in it now (the visit has been counted). */
export interface Hole { x: number; z: number; bornAt: number; until: number; in: boolean }

/**
 * Her holes, per figure. The spells write them on BOTH screens at the moment a hole opens (the effects play on both and the CPU's
 * next cast of the same spell restarts the effect, so the list lives here); `marks` draws them and `victimTick` reads them.
 */
export const moleHoles = new WeakMap<object, Hole[]>();

/** The holes standing now (expired ones are dropped). */
export function liveHoles(who: object, now = performance.now()): Hole[] {
  const list = moleHoles.get(who);
  if (!list) return [];
  const live = list.filter((h) => now < h.until);
  if (live.length !== list.length) moleHoles.set(who, live);
  return live;
}

/** Opens a hole at (x, z) now. A fourth hole closes the oldest. */
export function openHole(who: object, x: number, z: number, now = performance.now()): Hole {
  const list = liveHoles(who, now);
  const h: Hole = { x, z, bornAt: now, until: now + HOLE_LIFE * 1000, in: false };
  list.push(h);
  while (list.length > HOLE_MAX) list.shift();
  moleHoles.set(who, list);
  return h;
}

const WORDS_DIG = ['DIG DIG', 'HEE HEE', 'DIG, DIG!'];

/**
 * Mabel, the mole (assassin, melee). Passive Dig Site: the holes she digs (Dig, 3 at most, 8 s each) are real pits. Anyone who walks into one
 * falls: rooted 0.8 s, then slowed while they climb out (see `FALL_SLOW`). Once per visit: they must leave before it can take them again.
 * She walks across hers. Only someone who walks in falls: a hole that opens under a hero gives them the Dig telegraph (0.7 s) first, and
 * then the same rule, so one still standing in it when it opens falls.
 *
 * Where each rule runs. The holes are `moleHoles` records the effects write on both screens at the moment a hole opens, drawn by `marks`.
 * Falling in is `victimTick`, which runs where the enemy's position and hits are decided (the victim's screen online, the only screen
 * offline). Mole Run: the effect plays the dive and the mound on both screens; here `afterCast` notes the cast time (her own client),
 * `tick` shows `down` for the 1.2 s she is underground (`figureHidden` reads it on both screens, so her figure is not drawn) and seals her
 * for that time: `sealed` is the status that swallows every hit on her and also stops her casting and attacking. It does not stop
 * `ctx.moveCaster`'s slide, which is how she moves, so she tunnels while sealed. The sealed lock leaves her 0.5 s immune to stuns after.
 * The CPU (`aiHold`): W when the enemy is within 6 m and no hole is within 2 m of them; E when they are 3 to 9 m away; R within 9 m.
 */
export const moleTrait: Trait = {
  meter: { name: 'HOLES', max: HOLE_MAX, value: (t) => liveHoles(t.self()).length },
  passive: {
    name: 'Dig Site',
    blurb: 'Holes she digs last 8 s (3 at most). Anyone who walks in falls: rooted 0.8 s, then slowed while they climb out. She walks across hers.',
  },
  twist: {
    name: 'Down and Up',
    blurb: 'Underground she is safe, but she can only come up once, and her mound shows where. She cannot cast down there.',
  },
  speed: MOLE_SPEED,
  attack: { kind: 'melee', range: 2.2, damage: 18, interval: 0.9, windup: 0.25, look: 'claw' },

  aiHold(t, slot, dist) {
    const e = t.enemy();
    if (slot === 1) {
      if (!e || dist > 6) return true;
      const p = e.group.position;
      return liveHoles(t.self()).some((h) => Math.hypot(h.x - p.x, h.z - p.z) <= 2);
    }
    if (slot === 2) return !(dist >= 3 && dist <= 9);
    if (slot === 3) return dist > 9;
    return false;
  },

  canCast(t, slot) {
    if (slot !== 2 && 'diveAt' in t.mem) {
      const e = t.time - t.mem.diveAt;
      if (e >= 0 && e < TUNNEL_DIVE + TUNNEL_UNDER) return 'Underground';
    }
    return null;
  },

  afterCast(t, slot) {
    if (slot === 2) {
      t.mem.diveAt = t.time;
      t.mem.sealed = 0;
      t.say('BRB!', '#ffcf5a');
    } else if (slot === 1 && Math.random() < 0.5) {
      t.say(WORDS_DIG[Math.floor(Math.random() * WORDS_DIG.length)], '#ffcf5a');
    } else if (slot === 3) {
      t.say('WATCH YOUR STEP!', '#ffcf5a');
    }
  },

  /** Her own client: `down` is shown for the 1.2 s after the 0.3 s dive; she is sealed for the same time. */
  tick(t) {
    if (!('diveAt' in t.mem)) return;
    const e = t.time - t.mem.diveAt;
    const down = e >= TUNNEL_DIVE && e < TUNNEL_DIVE + TUNNEL_UNDER;
    if (down) {
      if (t.own('down') === 0) t.show('down', 1);
      if (!t.mem.sealed) {
        const r = t.status(t.self())?.apply('sealed', Math.min(TUNNEL_UNDER, TUNNEL_DIVE + TUNNEL_UNDER - e + 0.02));
        if (r && r !== 'immune') t.mem.sealed = 1;
      }
    } else if (t.own('down') !== 0) {
      t.show('down', 0);
      if (e >= TUNNEL_DIVE + TUNNEL_UNDER) t.say('HELLO!', '#ffcf5a');
    }
  },

  /** Underground: the figure is not drawn (both screens). The mound is the effect's. */
  figureHidden(t) {
    return t.own('down') > 0;
  },

  /** Falling in: where the enemy is decided. */
  victimTick(t) {
    const e = t.enemy();
    if (!e) return;
    const p = e.group.position;
    for (const h of liveHoles(t.self())) {
      const d = Math.hypot(p.x - h.x, p.z - h.z);
      if (d <= DIG_RADIUS && !h.in) {
        h.in = true;
        t.hitEnemy({ damage: 0, knock: 0, color: '#a98258', status: { kind: 'root', seconds: FALL_ROOT } });
        t.hitEnemy({ damage: 0, knock: 0, color: '#a98258', status: { kind: 'slow', seconds: FALL_ROOT + FALL_SLOW } });
        t.say('MIND THE HOLE!', '#ffcf5a');
      } else if (d > DIG_RADIUS + 0.4) h.in = false;
    }
  },

  marks(t) {
    const now = performance.now(), out: GroundMark[] = [];
    for (const h of liveHoles(t.self(), now)) out.push({ x: h.x, z: h.z, kind: 'hole', age: (now - h.bornAt) / 1000, life: HOLE_LIFE });
    return out;
  },
  markLook: {
    hole: () => pitLook(DIG_RADIUS),
  },

  badge(t) {
    const n = liveHoles(t.self()).length;
    return n > 0 ? String(n) : '';
  },
};
