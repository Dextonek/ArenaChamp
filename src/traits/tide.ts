import * as THREE from 'three';
import type { HitOptions } from '../effects/targeting';
import type { Trait } from './types';

/** The tide turns every this many seconds of round time: High tide first, then Low, and so on. */
export const TIDE_PERIOD = 8;
/** Mist Form: seconds she is untouchable. The trait (`taken`) and the effect (`mistForm.ts`) share it. */
export const MIST_SECONDS = 1;
/** Moon's Pull: seconds the tide is held at Low and doubled. The trait reads it through `moonLeft`, the effect writes it. */
export const MOON_SECONDS = 4;

/** Wave Disc: metres the hit moves the enemy (a knock-back at High tide, a pull at Low tide). */
export const DISC_MOVE = 2.5;
/** Coral Spire: metres it shoves the enemy at High tide, and drags it at Low tide. */
export const SPIRE_PUSH = 3;
export const SPIRE_PULL = 2;
/** Moon's Pull doubles her pulls (the engine still caps a pull at 4 m). */
export const MOON_PULL_MUL = 2;

/** True when the tide is High at `time` seconds of round time (the first period is High). */
export const highAt = (time: number) => Math.floor(Math.max(0, time) / TIDE_PERIOD) % 2 === 0;

/**
 * Marin's tide, keyed by her figure. `high` and `live` are written by the trait (`tick` on the screen that owns her
 * trait, `dealt` on whichever screen resolves her hit, which is how the victim's screen of a network duel learns the
 * tide); the effects read it for their looks. `moonLeft` is written by Moon's Pull (`moonPull.ts`: set on play, counted
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
 * Marin (controller). Passive Riptide: the tide turns every 8 s of round time. At High tide her spells push the enemy
 * away; at Low tide they pull it toward her. The tide comes from round time, so the two screens of a network duel agree
 * (up to the latency). `dealt` is the one place that turns a Wave Disc or Coral Spire hit into a push or a pull: the
 * effects always hand it the Low-tide shape (a `pull` toward the source) and it flips it. A push is a `pull` toward a
 * point behind the victim, because a knock-back moves a different distance on a foe (v / 7 m) and on the player hero
 * (0.18 m per unit, at most 8), but a pull is the same metres on both and is synced online.
 * Mist Form: for MIST_SECONDS every hit on her is swallowed (`taken`, which runs on her own client).
 * Moon's Pull: while the effect has `moonLeft` set, the tide is Low and her pulls are doubled.
 * No twist: the tide is the whole rule.
 */
export const tideTrait: Trait = {
  passive: { name: 'Riptide', blurb: 'The tide turns every 8 s. At High tide her spells push the enemy away; at Low tide they pull it toward her.' },
  speed: 4.1,
  attack: { kind: 'ranged', range: 6.5, damage: 10, interval: 0.7, windup: 0.18, speed: 20, look: 'wave' },
  tick(t) {
    const s = tideOf(t.self());
    s.live = true;
    // A new round starts clean: an unfinished Moon's Pull of the last round does not carry over.
    if (t.time < 0.5) s.moonLeft = 0;
    s.high = highAt(t.time) && s.moonLeft <= 0;
    const phase = s.high ? 1 : 2;
    if (t.mem.phase !== phase) {
      t.mem.phase = phase;
      t.say(s.high ? 'HIGH TIDE' : 'LOW TIDE', s.high ? '#eaf8fb' : '#3ab8ea');
    }
  },
  afterCast(t, slot) {
    if (slot === 2) t.mem.mistUntil = t.time + MIST_SECONDS;
  },
  taken(t, hit) {
    if ((t.mem.mistUntil ?? 0) > t.time) hit.blocked = true;
  },
  dealt(t, hit) {
    if (hit.kind !== 'spell' || (hit.slot !== 0 && hit.slot !== 1)) return;
    const s = tideOf(t.self());
    s.live = true;
    const moon = s.moonLeft > 0;
    s.high = highAt(t.time) && !moon;
    const me = t.self().group.position;
    const metres = hit.slot === 0 ? DISC_MOVE : s.high ? SPIRE_PUSH : SPIRE_PULL;
    // The point the hit moves the victim away from (a pull) or toward (a push): the effect's `from` (the bolt's start,
    // the spire's foot), else her.
    shapeMove(hit.opts, s.high, hit.opts.from ?? me, hit.victim.group.position, me, metres * (moon && !s.high ? MOON_PULL_MUL : 1));
  },
  badge(t) {
    const moon = (tideOf(t.self()).moonLeft ?? 0) > 0;
    if (moon) return 'LOW x2';
    return highAt(t.time) ? 'HIGH' : 'LOW';
  },
};
