import type * as THREE from 'three';

/**
 * Shared state between Ink Double (W) and Brushstroke (Q) of the ink kit. W leaves a double at the caster's old spot for
 * `DOUBLE_SECONDS`; the Brushstroke effect asks `takeDouble` when it is cast and, if the same caster's double still
 * stands, fires an echo from it. Module level because a trait hook cannot start a second projectile and effects are
 * rebuilt freely: both screens of a network duel replay W and Q, so both end with the same state. Keyed by the caster's
 * figure, so a mirror match (two Shioris) does not mix them up.
 */
export const DOUBLE_SECONDS = 3;

export const inkDouble = {
  /** Bumps on every new double; the W effect compares it to know when its own double was spent or replaced. */
  id: 0,
  caster: null as object | null,
  x: 0,
  z: 0,
  until: 0,
  /** The double was used by a Brushstroke (id of the double that was spent). */
  usedId: -1,
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** Leaves a double for `caster` at (x, z). Returns its id. */
export function placeDouble(caster: object, spot: THREE.Vector3, seconds = DOUBLE_SECONDS): number {
  inkDouble.id++;
  inkDouble.caster = caster;
  inkDouble.x = spot.x;
  inkDouble.z = spot.z;
  inkDouble.until = now() + seconds;
  return inkDouble.id;
}

/** True while `id` is the live double. */
export function doubleAlive(id: number): boolean {
  return inkDouble.id === id && inkDouble.usedId !== id && now() < inkDouble.until;
}

/** Spends the caster's double (if any) and returns its spot, else null. */
export function takeDouble(caster: object, out: THREE.Vector3): THREE.Vector3 | null {
  if (inkDouble.caster !== caster || !doubleAlive(inkDouble.id)) return null;
  inkDouble.usedId = inkDouble.id;
  return out.set(inkDouble.x, 0, inkDouble.z);
}

/** Forgets any double (a round reset, the effect's own clean-up). */
export function clearDouble() {
  inkDouble.caster = null;
  inkDouble.until = 0;
}
