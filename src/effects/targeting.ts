import * as THREE from 'three';
import type { Enemy } from './common';
import { frameArena } from './common';
import type { StatusKind } from './status';
import type { Projectile, ProjectileOptions } from './projectile';
import type { Summon, SummonOptions } from './summon';

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
  /**
   * Metres the hit drags the target toward `from` (default the caster), stopping 1 m short of it (at most 4 m).
   * Use `knock: 0` with it (the default knock is 4). Summoned units and network duels ignore it.
   */
  pull?: number;
  /**
   * A status effect on top of the damage (stun, root, slow, silence, blind, knock-up). Capped, refreshed and
   * stun-immune as in `status.ts`; a dodged or filtered hit gives none. Network duels ignore it.
   */
  status?: { kind: StatusKind; seconds: number };
  /**
   * Set by the engine on a skillshot's hit (`CastContext.projectile`): the bolt physically touched the target, which
   * is already the dodge check, so the duel's zone filters let it through. Spells do not set it.
   */
  projectile?: true;
  /**
   * Set by a basic attack (src/attacks): it homes in on its target, so like a bolt it skips the duel's zone checks.
   * Spells do not set it.
   */
  attack?: true;
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
  /**
   * Gives the caster a shield of `amount` HP for `seconds` (the player hero, a duel opponent or an arena foe): it
   * absorbs damage before HP, then breaks ("SHIELD BROKEN") or expires. Casting again keeps the larger one.
   * `color` (css, optional) tints the bubble and the bar segment. Network duels ignore it.
   */
  shieldSelf?(amount: number, seconds: number, color?: string): void;
  /** Heals the caster by `amount` (capped at max HP) with a green floating number. */
  healSelf?(amount: number): void;
  /**
   * Slides the caster to `to` over `seconds` with an ease-out; nothing else moves it meanwhile (hero mode ignores
   * click-move, the duel AI holds still). `to` is clamped to the duel ring; returns the spot it will really reach.
   * Call it at the cast moment; re-check enemy positions against the returned spot when the dash lands.
   */
  moveCaster?(to: THREE.Vector3, seconds: number): THREE.Vector3;
  /**
   * Fires a skillshot (see `projectile.ts`): a bolt that flies from `from` along `dir` and hits the first enemy it
   * touches, dodged by stepping off the line. The arena ticks it; follow the returned handle (`pos`, `dir`, `alive`,
   * `children`, `onHit`) to draw it. Call it at the cast moment. Network duels leave it undefined (no bolt flies).
   */
  projectile?(opts: ProjectileOptions): Projectile;
  /**
   * Summons small units for the caster's side (see `summon.ts`): `melee` ones walk up and hit, `ranged` ones keep their
   * distance and shoot dodgeable bolts, a `turret` stands and shoots. The arena owns and ticks them; follow the returned
   * handle (`units`, `alive`, `onDeath`) for extra visuals. Units can be hit by spells and bolts (they are in `targets`,
   * and `liveFoes()` lists them) but never count as the duel's enemy hero. At most 6 per side. Call it at the cast
   * moment. Network duels leave it undefined.
   */
  summon?(opts: SummonOptions): Summon;
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
