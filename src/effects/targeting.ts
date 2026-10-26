import * as THREE from 'three';
import type { Enemy } from './common';
import { frameArena } from './common';

/**
 * Targeting for effects that aim at enemies the user picks in the shared arena (`src/arena.ts`).
 *
 * - `enemy`   one target: the clicked enemy, else the nearest one to the caster.
 * - `enemies` several: the shift-clicked ones, else a nearest-neighbour chain from the primary target
 *             (good for chain lightning and multi-shots). `maxTargets` caps it.
 * - `ground`  a spot: the clicked ground point, else the primary target's feet. `targets` are the enemies
 *             within `radius` of it.
 * - `self`    centred on the caster; `targets` are the enemies within `radius` of the caster.
 */
export type TargetMode = 'enemy' | 'enemies' | 'ground' | 'self';

export interface TargetingSpec {
  mode: TargetMode;
  /** `enemies` mode: how many to hit at most (default 5). */
  maxTargets?: number;
  /** `ground` / `self` mode: area radius that decides which enemies are inside (default 5). */
  radius?: number;
}

export interface HitOptions {
  /** Damage number shown and taken off the enemy's HP (default 10–20 random). */
  damage?: number;
  /** Knockback speed away from `from` (default 4; 0 = flinch in place). */
  knock?: number;
  /** Knockback source point (default: the caster). */
  from?: THREE.Vector3;
  /** Damage-number colour (default warm white). */
  color?: string;
}

/** Everything a targeted effect gets before each play(). Snapshot positions; the figures may move during play. */
export interface CastContext {
  /** The shared caster figure. Owned by the arena: animate it, but never add it to your group. */
  readonly caster: Enemy;
  /** Caster feet position at cast time. */
  readonly from: THREE.Vector3;
  /** Yaw from the caster toward `point` (telegraph `dir` convention: atan2(dx, dz)). */
  readonly aim: number;
  /** The enemies to hit, primary first (chain order for `enemies`). May be empty for `ground` / `self`. */
  readonly targets: readonly Enemy[];
  /** Feet position of each target at cast time, same order as `targets`. */
  readonly targetPos: readonly THREE.Vector3[];
  /** Ground aim point (y = 0): clicked spot, else the primary target, else in front of the caster. */
  readonly point: THREE.Vector3;
  /**
   * Hit reaction for one enemy: flash, knockback, floating damage number, HP loss (death at 0 HP).
   * Call it once per hit at the impact moment. Do not call `setFlash` on arena enemies yourself.
   */
  hit(target: Enemy, opts?: HitOptions): void;
  /** Extra offset the arena adds to an enemy's position (lift, pull, ...). Reset on every cast. */
  displace(target: Enemy, offset: THREE.Vector3): void;
}

/** Yaw (telegraph `dir`) from a to b on the ground plane: 0 = toward +Z. */
export function yawTo(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Side-view camera (frameArena) that keeps the caster, every target and the aim point in view. */
export function frameCast(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3 },
  ctx: CastContext,
  height = 0,
) {
  const box = new THREE.Box3().setFromPoints([ctx.from, ctx.point, ...ctx.targetPos]);
  box.expandByScalar(3);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  center.y = Math.max(1.5, height * 0.35);
  center.z += size.z * 0.2; // frameArena shifts the target toward -Z by 0.45 r; keep the caster in shot
  frameArena(camera, controls, center, Math.max(9, Math.hypot(size.x, size.z) * 0.55, height * 0.55));
}
