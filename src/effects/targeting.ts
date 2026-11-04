import * as THREE from 'three';
import type { Enemy } from './common';
import { frameArena } from './common';
import type { BuffKind, StatusKind, StatusSet } from './status';
import type { BoltWall, BoltWallOptions, Projectile, ProjectileOptions } from './projectile';
import type { DeathSpot, Summon, SummonOptions } from './summon';
import type { Obstacle } from '../obstacles';

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
  /** A debuff (or buff) on the target on top of the damage (see `BuffKind` in status.ts). A dodged hit gives none. */
  debuff?: { kind: BuffKind; amount: number; seconds: number };
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
  /** Damage the victim's passive swallowed whole (the duel: shown as soaked on the other screen). */
  blocked?: number;
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
  /**
   * Every enemy alive now, wherever the cast was aimed (`targets` only holds those near the aim): for a recast whose hit is
   * decided somewhere else, such as an icicle in the ground or a tree. Judge them on their live positions.
   */
  enemies?(): Enemy[];
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
  /** The caster's statuses now, on both screens: a channel reads them each frame (see `channelBroken` in effects/channel.ts). */
  casterStatus?(): StatusSet | undefined;
  /** Frees the caster from its cast's root or a trait's hold early (a broken channel). Online only its own client does anything. */
  releaseCaster?(): void;
  /**
   * Slides the caster to `to` over `seconds` with an ease-out; nothing else moves it meanwhile (hero mode ignores
   * click-move, the duel AI holds still). `to` is clamped to the duel ring; returns the spot it will really reach.
   * Call it at the cast moment; re-check enemy positions against the returned spot when the dash lands.
   */
  moveCaster?(to: THREE.Vector3, seconds: number): THREE.Vector3;
  /** The door pairs bolts pass through (Wick): push yours when it stands, remove it when it ends. A new round clears them. */
  doors?(): import('./projectile').BoltDoor[];
  /**
   * Fires a skillshot (see `projectile.ts`): a bolt that flies from `from` along `dir` and hits the first enemy it
   * touches, dodged by stepping off the line. The arena ticks it; follow the returned handle (`pos`, `dir`, `alive`,
   * `children`, `onHit`) to draw it. Call it at the cast moment. Network duels leave it undefined (no bolt flies).
   */
  projectile?(opts: ProjectileOptions): Projectile;
  /**
   * Raises a wall of wind (see `BoltWallOptions` in projectile.ts): a segment that destroys the other side's bolts
   * which cross it, with an `onBlock` callback for the puff. It blocks neither walking nor sight nor this side's own
   * bolts, and homing basic attacks (hits, not bolts) pass. The returned handle's `end()` removes it early; a new
   * round clears it. Build the segment from `sentFrom` and `point` only, so both screens agree. In a network duel each
   * screen simulates only the bolts that fly at its own hero, so the wall stops the enemy's bolts on the screen of the
   * hero who raised it (where those hits are decided). Undefined outside the arena.
   */
  boltWall?(opts: BoltWallOptions): BoltWall;
  /**
   * The bend of an arc aim (`HeroSpell.aim: 'arc'`): the total turn of the bolt's heading in radians, signed as in
   * `arcShot` (projectile.ts). 0 (or undefined) is a straight shot. The spell passes it to `arcShot(from, point, bend,
   * speed)` for the launch direction, curve and range. The bend travels with the cast in a network duel.
   */
  readonly bend?: number;
  /**
   * Where the caster stood on the screen that cast, at cast time. Equals `from` on the caster's own screen; on the
   * other screen of a network duel `from` is where the hero is drawn (a little behind), so anything both screens must
   * agree on (a wall's position) is built from `sentFrom` and `point`.
   */
  readonly sentFrom?: THREE.Vector3;
  /**
   * Adds a temporary wall or pillar (an `Obstacle`, see obstacles.ts) for `seconds`: it blocks walking, line of sight
   * and bolts for both heroes and the duel AI, then is removed. Returns the obstacle; `removeObstacle` ends it early,
   * by identity. A new round clears them all. A hero standing where it appears is pushed out when it next moves. The
   * effect draws the wall's look itself. Build the obstacle from `sentFrom` and `point` only, so both screens of a
   * network duel make the same wall. Undefined outside a duel.
   */
  addObstacle?(o: Obstacle, seconds: number): Obstacle;
  /**
   * Closes a ring for `seconds`: anyone inside it cannot walk or dash out, and it is no wall to anyone outside (Cantor's
   * Duet). Built from `sentFrom` so both screens agree; each keeps its own hero in. The effect draws the ring. A new round
   * clears it.
   */
  confine?(x: number, z: number, r: number, seconds: number): void;
  removeObstacle?(o: Obstacle): void;
  /** The live obstacles now (walls, pillars, temporary ones): for an effect that sweeps a path against them. */
  obstacles?(): readonly Obstacle[];
  /**
   * Moves `target` by `delta` (ground plane) now, kept inside the ring and out of the obstacles: a carry. Call it every
   * frame with that frame's step (a charge that drags the enemy along). Unlike `displace` the new spot sticks. Only a
   * side moves its own figures: offline it moves the enemy hero and the arena foes; in a network duel it moves only
   * this side's own hero (the victim's client applies it when the cast is replayed there) and does nothing to the
   * other player's figure, which follows the position its own client streams. Decide the catch with the target's
   * live position (`target.group.position`) so each screen judges its own hero.
   */
  carry?(target: Enemy, delta: THREE.Vector3): void;
  /**
   * Summons small units for the caster's side (see `summon.ts`): `melee` ones walk up and hit, `ranged` ones keep their
   * distance and shoot dodgeable bolts, a `turret` stands and shoots. The arena owns and ticks them; follow the returned
   * handle (`units`, `alive`, `onDeath`) for extra visuals. Units can be hit by spells and bolts (they are in `targets`,
   * and `liveFoes()` lists them) but never count as the duel's enemy hero. At most 6 per side. Call it at the cast
   * moment. Network duels leave it undefined.
   */
  summon?(opts: SummonOptions): Summon;
  /**
   * Where summoned units (of either side, `side` says whose) were slain by damage within the last `maxAge` seconds
   * (at most 30), oldest first: `{ x, z, age, side }`, `age` in seconds since the death. Units that ran out of time
   * leave nothing. Cleared every round. Mortis's bone piles. Network duels: only the deaths of units this screen
   * simulates (the player's own); the other player's units are not seen here.
   */
  deathSpots?(maxAge: number): DeathSpot[];
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
