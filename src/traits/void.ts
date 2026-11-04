import type { Obstacle } from '../obstacles';
import { blocksSight } from '../obstacles';
import type { CastContext } from '../effects/targeting';
import type { CastMods, Trait, TraitView } from './types';

/** Deep Gravity: the ring is 2 m + 1 m per level and pulls 0.2 m/s + 0.2 m/s per level (level 1: 3 m, 0.4 m/s; level 4: 6 m, 1.0 m/s). */
export const WELL_LEVEL_MAX = 4;
export const wellRadius = (level: number) => (level > 0 ? 2 + level : 0);
export const wellSpeed = (level: number) => (level > 0 ? 0.2 + 0.2 * level : 0);
/** The pull stops this far from him. */
export const WELL_STOP = 1.5;
/** Phase Step: seconds the rip stays armed, and its extra damage on his basic attack. */
export const RIP_SECONDS = 3;
export const RIP_DAMAGE = 40;
export const RIP_WEAKEN = { kind: 'weaken', amount: 0.2, seconds: 2 } as const;
const BASE_ATTACK = 13;

/**
 * What Oblivion's spells and effects share, per figure (effects play on both screens). Times are `performance.now()` ms.
 * `collapseAt`: when Black Hole was told to collapse (written by `recastAct`, mirrored by `ownChanged`; 0 = not). `ripOffAt`: when
 * the Phase Step rip was spent or ran out. `obstacles`: how his spells read the live obstacles (his passive has no `ctx`).
 */
export interface VoidFx {
  collapseAt: number;
  ripOffAt: number;
  obstacles: (() => readonly Obstacle[]) | null;
}

const voidFxMap = new WeakMap<object, VoidFx>();

export function voidFx(fig: object): VoidFx {
  let f = voidFxMap.get(fig);
  if (!f) { f = { collapseAt: 0, ripOffAt: 0, obstacles: null }; voidFxMap.set(fig, f); }
  return f;
}

/**
 * His spells call this from `cast` (on both screens): the passive's pull then judges cover against the live obstacles. Until
 * one of them has been cast nothing is known, and the pull treats the way as clear.
 */
export function watchCover(ctx: CastContext) {
  const get = ctx.obstacles;
  if (get) voidFx(ctx.caster).obstacles = () => get() ?? [];
}

const ripOn = (t: TraitView) => t.time < (t.mem.ripUntil ?? 0);

function endRip(t: TraitView) {
  t.mem.ripUntil = 0;
  t.show('rip', 0);
  voidFx(t.self()).ripOffAt = performance.now();
}

/** How the ring was drawn last, per figure, so it can grow smoothly and pulse at each level (both screens, read only). */
const ringState = new WeakMap<object, { level: number; since: number; from: number }>();
const shown = (s: { level: number; since: number; from: number }, time: number) => {
  const to = wellRadius(s.level);
  const k = Math.min(1, Math.max(0, (time - s.since) / 0.35));
  return s.from + (to - s.from) * (k * k * (3 - 2 * k));
};

/**
 * Oblivion (juggernaut). Passive Deep Gravity: while he stands still a ring grows round him (`tick` shows the level 0-4 as
 * 'well': 1 at 1 s, up to 4 at 4 s; a step ends it). Level 1 is 3 m and 0.4 m/s, each further level adds 1 m and 0.2 m/s, level 4
 * is 6 m and 1.0 m/s. Walking, there is no ring and no pull. `victimTick` (on the victim's screen) drags an enemy inside the ring
 * toward him, 1.5 m short of him at most, only while he sees it: cover stops it. The cover comes from `voidFx(...).obstacles`,
 * which his spells fill in when they are cast (`watchCover`); before his first cast the way counts as clear. `ring` draws it on
 * both screens, growing smoothly with a pulse at each level and an inner arc counting down to the next one.
 * Q Gravity Slam, W Null Zone: no trait rule. E Phase Step: `afterCast` arms the rip for 3 s (`mem.ripUntil`, shown as 'rip'); his
 * next basic attack in that time is power (13 + 40) / 13 and weakens the enemy 20% for 2 s. R Black Hole: the recast (Collapse, opens
 * 0.3 s late, 4 s window, the CPU never fires it) writes the flag the effect reads (`collapseAt`, mirrored by `ownChanged`).
 */
export const voidTrait: Trait = {
  passive: {
    name: 'Deep Gravity',
    blurb: 'While he stands still a ring grows round him: 3 m and 0.4 m/s after 1 s, then +1 m and +0.2 m/s each second up to 6 m and 1.0 m/s. It drags in any enemy he can see. One step ends it.',
  },
  ownLook: {
    rip: { color: '#ff2a55', shape: 'mark' },
  },
  ownChanged(t, name, n) {
    const fx = voidFx(t.self());
    if (name === 'rip') fx.ripOffAt = n > 0 ? 0 : performance.now();
    if (name === 'collapse') fx.collapseAt = n > 0 ? performance.now() : 0;
  },
  speed: 3.8,
  attack: { kind: 'melee', range: 2.6, damage: BASE_ATTACK, interval: 1.2, windup: 0.3, speed: 0, look: 'cleave' },
  recast: { slot: 3, window: 4, arm: 0.3, name: 'Collapse', replay: false, aiWait: true },
  tick(t) {
    const level = t.still < 1 ? 0 : Math.min(WELL_LEVEL_MAX, Math.floor(t.still));
    t.show('well', level);
    if (t.mem.ripUntil && !ripOn(t)) endRip(t);
  },
  victimTick(t, dt) {
    const level = t.own('well');
    if (level <= 0) return;
    const e = t.enemy();
    if (!e) return;
    const me = t.self().group.position, p = e.group.position;
    const dx = me.x - p.x, dz = me.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > wellRadius(level) || d <= WELL_STOP) return;
    // Cover stops it: he must see the enemy (no obstacle list yet: clear).
    const obstacles = voidFx(t.self()).obstacles?.();
    if (obstacles && blocksSight(me, p, obstacles)) return;
    const step = Math.min(wellSpeed(level) * dt, d - WELL_STOP);
    t.carryEnemy((dx / d) * step, (dz / d) * step);
  },
  ring(t) {
    const level = t.own('well');
    const fig = t.self();
    let s = ringState.get(fig);
    if (!s || s.since > t.time) { s = { level: 0, since: t.time, from: 0 }; ringState.set(fig, s); }
    if (s.level !== level) {
      const now = shown(s, t.time);
      s.from = level > 0 ? Math.max(now, 1.2) : 0;
      s.level = level;
      s.since = t.time;
    }
    if (level <= 0) return null;
    const age = t.time - s.since;
    const pulse = Math.exp(-age * 4.5);
    return {
      radius: shown(s, t.time),
      color: level >= 3 ? '#ff2a55' : '#ffc4d4',
      opacity: 0.38 + 0.5 * pulse + 0.06 * Math.sin(t.time * 2.4),
      fill: level < WELL_LEVEL_MAX ? Math.max(0, 1 - age) : undefined,
    };
  },
  badge: (t) => (t.own('well') > 0 ? `${wellRadius(t.own('well'))} m` : ''),
  afterCast(t, slot) {
    if (slot === 2) {
      t.mem.ripUntil = t.time + RIP_SECONDS;
      voidFx(t.self()).ripOffAt = 0;
      t.show('rip', 1);
    }
    if (slot === 3) {
      // A new Black Hole: the last collapse is over.
      voidFx(t.self()).collapseAt = 0;
      t.show('collapse', 0);
    }
  },
  recastAct(t, slot) {
    if (slot !== 3) return;
    voidFx(t.self()).collapseAt = performance.now();
    t.show('collapse', 0);
    t.show('collapse', 1);
    t.say('COLLAPSE', '#ff2a55');
  },
  attackMods(t) {
    const m: Partial<CastMods> = {};
    if (ripOn(t)) {
      endRip(t);
      m.power = (BASE_ATTACK + RIP_DAMAGE) / BASE_ATTACK;
      m.debuff = { ...RIP_WEAKEN };
      t.say('RIP', '#ff2a55');
    }
    return m;
  },
};
