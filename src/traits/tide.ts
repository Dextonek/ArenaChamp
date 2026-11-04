import * as THREE from 'three';
import type { HitOptions } from '../effects/targeting';
import type { Trait, TraitView } from './types';

/** The tide turns every this many seconds of round time: High tide first, then Low, and so on. */
export const TIDE_PERIOD = 8;
/** Mist Form: seconds she is untouchable. The trait (`taken`) and the effect (`mistForm.ts`) share it. */
export const MIST_SECONDS = 0.25;
/** Moon's Pull: seconds she channels (the tide is held at Low and her pulls doubled). The trait reads it through `moonLeft`, the effect writes it. */
export const MOON_SECONDS = 3;

/** Wave Disc: metres the hit moves the enemy (a knock-back at High tide, a pull at Low tide). */
export const DISC_MOVE = 2.5;
/** Coral Spire: metres it shoves the enemy at High tide, and drags it at Low tide. */
export const SPIRE_PUSH = 3;
export const SPIRE_PULL = 2;
/** Moon's Pull doubles her pulls (the engine still caps a pull at 4 m). */
export const MOON_PULL_MUL = 2;

/** True when the tide is High at `time` seconds of round time with no flips (the editor's fallback). */
export const highAt = (time: number) => Math.floor(Math.max(0, time) / TIDE_PERIOD) % 2 === 0;

/**
 * The tide of the trait, from `mem` alone (`epoch`: round time of the last flip, 0 at the start; `base`: 1 when the tide
 * was High at the epoch, which is the start). Both screens compute it the same way. The tide turns every TIDE_PERIOD from
 * the epoch.
 */
function turns(m: Record<string, number>, time: number) {
  const epoch = m.epoch ?? 0;
  return Math.floor(Math.max(0, time - epoch) / TIDE_PERIOD);
}
function tideHigh(m: Record<string, number>, time: number) {
  const base = (m.base ?? 1) !== 0;
  return turns(m, time) % 2 === 0 ? base : !base;
}
/** Seconds left to the next turn. */
function turnLeft(m: Record<string, number>, time: number) {
  return Math.max(0, (m.epoch ?? 0) + (turns(m, time) + 1) * TIDE_PERIOD - time);
}
/** Flips the tide at round time `at` (Mist Form's reform). */
function flipTide(m: Record<string, number>, at: number) {
  m.base = tideHigh(m, at) ? 0 : 1;
  m.epoch = at;
}
/** Refreshes `tideOf(figure)` from `mem` (it runs on both screens, so the effects read the same tide on each). */
function syncTide(t: TraitView) {
  const s = tideOf(t.self());
  s.live = true;
  s.high = tideHigh(t.mem, t.time) && s.moonLeft <= 0;
  return s;
}

/**
 * Marin's tide, keyed by her figure. `high` and `live` are written by the trait (`ring`, which runs on both screens
 * every frame, plus `tick` and `dealt`, from the tide in `t.mem`); the effects read it for their looks. `moonLeft` is written by Moon's Pull (`moonPull.ts`: set on play, counted
 * down, cleared on reset) and read by the trait. Without a trait (the editor) `live` stays false and `tideNow` falls
 * back to the wall clock, so the effects still show both tides.
 */
export interface TideState { high: boolean; moonLeft: number; live: boolean }
export const tides = new WeakMap<object, TideState>();

export function tideOf(figure: object): TideState {
  let s = tides.get(figure);
  if (!s) { s = { high: true, moonLeft: 0, live: false }; tides.set(figure, s); }
  return s;
}

/** The tide an effect should draw now: the trait's when it has run, else the wall clock (the editor). Moon's Pull holds Low. */
export function tideNow(figure: object): { high: boolean; moon: boolean; live: boolean } {
  const s = tideOf(figure);
  const moon = s.moonLeft > 0;
  if (s.live) return { high: s.high && !moon, moon, live: true };
  return { high: highAt(performance.now() / 1000) && !moon, moon, live: false };
}


/**
 * Sets `o` to move the victim `metres`: at High tide a push away from `src`, at Low tide a pull toward it. Both are a
 * `pull` (the same metres on a foe and on the player hero, synced online, capped at 4 m by the engine); a push drags
 * the victim toward a point `metres + 1` behind it, because the engine stops a pull 1 m short of its target.
 */
export function shapeMove(
  o: HitOptions, high: boolean, src: THREE.Vector3, victim: THREE.Vector3, caster: THREE.Vector3, metres: number,
) {
  o.knock = 0;
  if (!high) {
    o.pull = Math.min(4, metres);
    o.from = src.clone();
    return;
  }
  let ax = victim.x - src.x, az = victim.z - src.z;
  let l = Math.hypot(ax, az);
  if (l < 1e-3) { ax = victim.x - caster.x; az = victim.z - caster.z; l = Math.hypot(ax, az) || 1; }
  const m = Math.min(4, metres);
  o.pull = m;
  o.from = new THREE.Vector3(victim.x + (ax / l) * (m + 1), 0, victim.z + (az / l) * (m + 1));
}

/**
 * Marin (controller). Passive Turning Tide: the tide turns every 8 s of round time, and Mist Form flips it when she
 * reforms. At High tide her spells push the enemy away; at Low tide they pull it toward her. The tide is kept in `t.mem`
 * (`epoch`, `base`, see `tideHigh`), the same on both screens of a network duel: `ring` runs on both every frame and
 * refreshes `tideOf(figure)`; Mist Form's flip is shown as `tideflip` (a rising count) so the other screen flips too
 * (`ownChanged`). `dealt` is the one place that turns a Wave Disc or Coral Spire hit into a push or a pull: the
 * effects always hand it the Low-tide shape (a `pull` toward the source) and it flips it. A push is a `pull` toward a
 * point behind the victim, because a knock-back moves a different distance on a foe (v / 7 m) and on the player hero
 * (0.18 m per unit, at most 8), but a pull is the same metres on both and is synced online.
 * Mist Form: for MIST_SECONDS (0.25 s, the dash) every hit on her is swallowed (`taken`, which runs on her own client).
 * Moon's Pull: a 3 s channel (`hold`); while the effect has `moonLeft` set, the tide is Low and her pulls are doubled.
 * A ring at her feet (always on, both screens) shows the tide and the time left to the next turn.
 * No twist: the tide is the whole rule.
 */
export const tideTrait: Trait = {
  meter: { name: 'TIDE', max: TIDE_PERIOD, value: (t) => Math.ceil(turnLeft(t.mem, t.time)) },
  passive: { name: 'Turning Tide', blurb: 'The tide turns every 8 s, and Mist Form turns it when she reforms. At High tide her spells push the enemy away; at Low tide they pull it toward her. A ring at her feet shows the tide and the time left.' },
  speed: 4.1,
  attack: { kind: 'ranged', range: 6.5, damage: 10, interval: 0.7, windup: 0.18, speed: 20, look: 'wave' },
  ring(t) {
    const s = syncTide(t);
    if (s.moonLeft > 0) return { radius: 1.6, color: '#3ab8ea', fill: Math.min(1, s.moonLeft / MOON_SECONDS) };
    return { radius: 1.6, color: s.high ? '#eaf8fb' : '#3ab8ea', fill: Math.min(1, turnLeft(t.mem, t.time) / TIDE_PERIOD) };
  },
  ownChanged(t, name, n) {
    // Mist Form's reform on the other screen: the tide flips here too.
    if (name === 'tideflip' && n > 0) flipTide(t.mem, t.time);
  },
  tick(t) {
    // A new round starts clean: an unfinished Moon's Pull of the last round does not carry over.
    if (t.time < 0.5) tideOf(t.self()).moonLeft = 0;
    // Mist Form reforms: the tide flips and the other screen is told.
    const at = t.mem.reformAt ?? 0;
    if (at > 0 && t.time >= at) {
      t.mem.reformAt = 0;
      flipTide(t.mem, at);
      t.show('tideflip', t.own('tideflip') + 1);
    }
    const s = syncTide(t);
    const phase = s.high ? 1 : 2;
    if (t.mem.phase !== phase) {
      t.mem.phase = phase;
      t.say(s.high ? 'HIGH TIDE' : 'LOW TIDE', s.high ? '#eaf8fb' : '#3ab8ea');
    }
  },
  afterCast(t, slot) {
    if (slot === 2) {
      t.mem.mistUntil = t.time + MIST_SECONDS;
      // She reforms when the dash ends: the tide flips then.
      t.mem.reformAt = t.time + MIST_SECONDS;
    }
    if (slot === 3) t.hold(MOON_SECONDS);
  },
  taken(t, hit) {
    if ((t.mem.mistUntil ?? 0) > t.time) hit.blocked = true;
  },
  dealt(t, hit) {
    if (hit.kind !== 'spell' || (hit.slot !== 0 && hit.slot !== 1)) return;
    const s = syncTide(t);
    const moon = s.moonLeft > 0;
    const me = t.self().group.position;
    const metres = hit.slot === 0 ? DISC_MOVE : s.high ? SPIRE_PUSH : SPIRE_PULL;
    // The point the hit moves the victim away from (a pull) or toward (a push): the effect's `from` (the bolt's start,
    // the spire's foot), else her.
    shapeMove(hit.opts, s.high, hit.opts.from ?? me, hit.victim.group.position, me, metres * (moon && !s.high ? MOON_PULL_MUL : 1));
  },
  badge(t) {
    if ((tideOf(t.self()).moonLeft ?? 0) > 0) return 'LOW x2';
    return tideHigh(t.mem, t.time) ? 'HIGH' : 'LOW';
  },
};
