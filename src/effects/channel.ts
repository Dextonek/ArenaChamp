import * as THREE from 'three';
import { blocksSight } from '../obstacles';
import type { CastContext } from './targeting';

/**
 * A channel (Vesper R, Marin R, Ada R): the caster stands rooted while a spell runs, and a stun, silence or knock-up ends
 * it. The trait roots her with `t.hold(seconds)` in `afterCast`; the effect asks `channelBroken` every frame and, when it
 * is true, stops and calls `ctx.releaseCaster`. The statuses are shown on both screens of a network duel, so both end it.
 */
export function channelBroken(ctx: CastContext): boolean {
  const st = ctx.casterStatus?.();
  return !!st && (st.stunned || st.has('silence'));
}

/** True when the caster can still see `target` through the live obstacles (a channel or a drag that needs sight). */
export function stillSees(ctx: CastContext, target: THREE.Vector3): boolean {
  const obstacles = ctx.obstacles?.();
  return !obstacles || !blocksSight(ctx.caster.group.position, target, obstacles);
}

/**
 * A ring at the caster's feet that empties as a channel runs, so both players can read how long is left. Add `mesh` to
 * the effect's group and call `set` every frame.
 */
export class ChannelBar {
  readonly mesh: THREE.Mesh;
  private segments = 72;

  constructor(color: THREE.ColorRepresentation, radius = 1.15) {
    const geo = new THREE.RingGeometry(radius - 0.14, radius, this.segments, 1, 0, Math.PI * 2).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.95 }));
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  /** `left` 1..0 of the channel; 0 hides it. */
  set(at: THREE.Vector3, left: number) {
    this.mesh.visible = left > 0;
    if (!this.mesh.visible) return;
    this.mesh.position.set(at.x, 0.09, at.z);
    this.mesh.geometry.setDrawRange(0, 6 * Math.max(1, Math.round(this.segments * Math.min(1, left))));
  }
}
