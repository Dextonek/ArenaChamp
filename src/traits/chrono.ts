import type { Trait } from './types';

/**
 * Where the last Unwind sent a hero (x, z), keyed by its figure. Kept for the old Unwind spell (`unwind.ts`, which the VFX
 * tool still lists): Tempo's v5 kit no longer casts it.
 */
export const unwindDest = new WeakMap<object, { x: number; z: number }>();

/** Seconds Unwind goes back (the old spell). */
export const UNWIND_BACK = 2.5;
/** Seconds the old Quickstep tempo bonus lasts (the old spell). */
export const QUICKSTEP_SECONDS = 2;

// --- Tempo, the Unwound Hour (kits v5) -------------------------------------------------------------------------

/** The echo: seconds after the first hit, and its share of the damage (normal, and while Stolen Hour runs). */
export const ECHO_DELAY = 1.5;
export const ECHO_SHARE = 0.4;
export const ECHO_STRONG_SHARE = 0.8;
/** Stolen Hour (R landed): how long his echoes are strong, and the haste it gives him. */
export const STOLEN_SECONDS = 4;
export const STOLEN_HASTE = { amount: 0.3, seconds: 4 };
/** Time Skip: how long he is gone, and untouchable. */
export const SKIP_VANISH = 0.6;
/** Tick: seconds a direct hit takes off its cooldown, and how long after the cast that first hit may come. */
export const TICK_REFUND = 1;
const TICK_FIRST_HIT = 1.2;
/** Slow Time: his haste inside the circle. */
export const SLOW_TIME_HASTE = 0.3;

/**
 * What his echoes read, per figure (the effects play on both screens, so each screen keeps its own copy). `until` is a
 * `performance.now()` time in milliseconds: effects have no round clock of their own. Written from his own client
 * (`peerNote`) and, on the other screen, from `ownChanged`; R's effect also writes it at the moment it lands.
 */
export const tempoEcho = new WeakMap<object, { until: number }>();

/** The share of its damage an echo of his has now: 80% while Stolen Hour runs, else 40%. */
export function echoShare(fig: object): number {
  const e = tempoEcho.get(fig);
  return e && performance.now() < e.until ? ECHO_STRONG_SHARE : ECHO_SHARE;
}

export const stolenOn = (fig: object) => echoShare(fig) === ECHO_STRONG_SHARE;

export function startStolen(fig: object, seconds = STOLEN_SECONDS) {
  tempoEcho.set(fig, { until: performance.now() + seconds * 1000 });
}

/**
 * Slow Time's circle (x, z, radius, and the `performance.now()` ms it ends), written by the effect when it is cast. His
 * trait reads it in `tick` on his own client and gives him haste while he stands inside.
 */
export const tempoZone = new WeakMap<object, { x: number; z: number; r: number; until: number }>();

const GOLD = '#ffc83a';

/**
 * Tempo (mage). Passive Echo: every spell he casts plays twice. The echo lives in each spell's effect (Tick, Slow Time,
 * Time Skip and Stolen Hour each repeat their hit 1.5 s after the first, from the same place, at 40% of the damage, 80%
 * while Stolen Hour runs); this trait only keeps the strength (`tempoEcho`) and shows it. Ghost clock hands mark where
 * each echo will come from, on both screens.
 * Q Tick: a direct hit takes 1 s off Q (`landed`, once per cast, stamped in `mem.qCast`; the echo's hit comes later than
 * `TICK_FIRST_HIT` and never counts). W Slow Time: he moves 30% faster inside the circle (`tempoZone`, `tick`). E Time
 * Skip: untouchable for 0.6 s (`mem.skipUntil`, `taken` swallows every hit, and `hold`). R Stolen Hour: starts only if it
 * lands: `dealt` (the victim's screen) tells his own client (`noteOwner`), whose `peerNote` raises the echoes to 80% for
 * 4 s (shown as 'stolen': gold pip and ring on both screens) and gives him haste. It no longer touches the enemy's cooldowns.
 */
export const chronoTrait: Trait = {
  passive: {
    name: 'Echo',
    blurb: 'Every spell he casts plays twice: Tick, Slow Time, Time Skip and Stolen Hour each repeat 1.5 s later from the same place at 40% damage (80% in Stolen Hour). Ghost clock hands show where.',
  },
  speed: 4,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'gear' },
  ownLook: { stolen: { color: GOLD, shape: 'mark' } },
  ownChanged(t, name, n) {
    if (name !== 'stolen') return;
    // The other screen: the effects there read the strength from the per-figure record, the ring from `mem`.
    if (n > 0) {
      startStolen(t.self());
      t.mem.stolenUntil = t.time + STOLEN_SECONDS;
    } else {
      tempoEcho.delete(t.self());
      t.mem.stolenUntil = 0;
    }
  },
  peerNote(t, name, n) {
    if (name !== 'stolen' || n <= 0) return;
    // His own client: Stolen Hour landed. A zero first, so a second one still reaches the other screen as a change.
    startStolen(t.self());
    t.mem.stolenUntil = t.time + STOLEN_SECONDS;
    t.show('stolen', 0);
    t.show('stolen', 1);
    t.buff('haste', STOLEN_HASTE.amount, STOLEN_HASTE.seconds);
    t.say('STOLEN HOUR', GOLD);
  },
  ring(t) {
    if (t.own('stolen') <= 0) return null;
    const left = Math.max(0, Math.min(1, ((t.mem.stolenUntil ?? 0) - t.time) / STOLEN_SECONDS));
    return { radius: 1.15, color: GOLD, fill: left, opacity: 0.7 };
  },
  afterCast(t, slot) {
    if (slot === 0) t.mem.qCast = t.time;
    if (slot === 2) {
      // Time Skip: gone for 0.6 s. `taken` swallows the hits, `hold` keeps him where he stood (the effect moves him).
      t.mem.skipUntil = t.time + SKIP_VANISH;
      t.hold(SKIP_VANISH);
    }
  },
  taken(t, hit) {
    if (t.time < (t.mem.skipUntil ?? 0)) hit.blocked = true;
  },
  landed(t, hit) {
    if (hit.kind !== 'spell' || hit.slot !== 0 || !hit.victimIsHero) return;
    const cast = t.mem.qCast;
    if (cast === undefined) return;
    // Only the first hit of a cast: the echo comes 1.5 s later, and one cast refunds once.
    if (t.time - cast > TICK_FIRST_HIT || t.mem.qRefunded === cast) return;
    t.mem.qRefunded = cast;
    t.setCooldown(0, Math.max(0, t.cooldownLeft(0) - TICK_REFUND));
  },
  dealt(t, hit) {
    if (hit.kind !== 'spell' || hit.slot !== 3 || !hit.victimIsHero || hit.blocked) return;
    // Stolen Hour starts on the first hit only (the echo of R is a second hit of the same cast).
    if (hit.cast !== undefined) {
      if (t.mem.c3 === hit.cast) return;
      t.mem.c3 = hit.cast;
    }
    // Online this is the victim's screen: his own client raises the echoes and takes the haste.
    t.noteOwner('stolen', 1);
  },
  tick(t) {
    if (t.mem.stolenUntil && t.time >= t.mem.stolenUntil) {
      t.mem.stolenUntil = 0;
      tempoEcho.delete(t.self());
      t.show('stolen', 0);
    }
    // Slow Time: faster while he stands inside the circle.
    const z = tempoZone.get(t.self());
    if (z && performance.now() < z.until) {
      const p = t.self().group.position;
      if (Math.hypot(p.x - z.x, p.z - z.z) <= z.r) t.buff('haste', SLOW_TIME_HASTE, 0.3);
    }
  },
  badge: (t) => (t.own('stolen') > 0 ? '80%' : '40%'),
};
