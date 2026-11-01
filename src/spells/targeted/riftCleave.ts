import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { AshMotes, Rift, Shards, VOID, VOID_CSS } from '../../effects/parts/void';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Rift Cleave (void kit, Q: melee greatsword sweep). The blade draws back with a few ash motes; at 0.3 s one wide crescent
 * sweep leaves a tear standing in the air along the arc (a black slit with a pink edge on top and a cyan fringe below),
 * shards burst and are drawn into it, a cyan accent flashes, and everyone still inside the 110 degree cone is hit and
 * pulled 1.5 m toward him (no knock-back). From
 * 0.5 s the rift zips shut from both ends. Clean by 1.2 s. See pipeline/designs/kit-void.md.
 */
export interface RiftCleaveSettings {
  damage: number;
  loop: boolean;
}

export const defaultRiftCleave = (): RiftCleaveSettings => ({ damage: 53, loop: false });

// Timeline (seconds).
const HIT_T = 0.3;
const CLOSE_T = 0.5;
const DURATION = 1.2;
const CONE_ANGLE = 110;
const CONE_RADIUS = 3.2;
const ARC_R = 2.5; // the blade's path
const ARC_Y = 1.25;

export class RiftCleave implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RiftCleaveSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The cone of the last cast (from the caster toward the target). */
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: CONE_RADIUS, angle: CONE_ANGLE, dir: 0 };
  private time = 0;
  private flags = { hit: false, close: false };

  // Cast geometry.
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);

  // Parts.
  private rift = new Rift(2);
  private shards = new Shards(12);
  private motes = new AshMotes(24);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: VOID.accent, core: VOID.core, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: RiftCleaveSettings = defaultRiftCleave()) {
    this.settings = settings;
    this.screen.impactColor.set(VOID.hot);
    this.screen.tint.set(VOID.dark);
    this.group.add(this.rift.mesh, this.shards.mesh, this.motes.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.cone = { kind: 'cone', x: ctx.from.x, z: ctx.from.z, radius: CONE_RADIUS, angle: CONE_ANGLE, dir: ctx.aim };
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).addScaledVector(this.fwd, 2).setY(1.1);
  }

  play() {
    this.reset();
    this.playing = true;
    // 0..0.15: the blade draws back; a few motes lift off the ground behind him.
    this.v1.copy(this.from).addScaledVector(this.fwd, -0.4);
    this.motes.emit(this.v1, 0.9, 6);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.hit = this.flags.close = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(VOID.dark);
    this.rift.reset();
    this.shards.reset();
    this.motes.reset();
    this.pop.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.rift.update(dt);
    this.shards.update(dt);
    this.motes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.swing();
    }
    if (f.hit && !f.close && t >= CLOSE_T) {
      f.close = true;
      this.rift.close(0.5);
    }

    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.03);
    if (f.hit) {
      const after = t - HIT_T;
      const sp = StarBurst.pop(after, 0, 0.02);
      this.v1.copy(this.from).addScaledVector(this.fwd, ARC_R).setY(ARC_Y);
      this.pop.set(this.v1, 1.0 * sp.scale, sp.opacity, 0.2);
      // The cyan fringe shows for the first two or three frames, then settles.
      this.shake = 0.14 * Math.exp(-after * 14);
    }
  }

  private swing() {
    const ctx = this.ctx;
    // One wide crescent: the tear opens along the blade's path, revealed from one end to the other.
    const pts: THREE.Vector3[] = [];
    const faces: THREE.Vector3[] = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = ctx ? ctx.aim : 0;
      const th = a + THREE.MathUtils.degToRad(CONE_ANGLE * 0.5) * (1 - (2 * i) / (n - 1)) * 0.95;
      const dx = Math.sin(th), dz = Math.cos(th);
      pts.push(new THREE.Vector3(this.from.x + dx * ARC_R, ARC_Y, this.from.z + dz * ARC_R));
      faces.push(new THREE.Vector3(dx, 0, dz));
    }
    this.rift.openPath(pts, faces, 1.15, 0.22, { sweep: 0.14, seed: 3 });
    this.rift.flare(1, 0.1);
    // Shards burst from the middle of the tear and some of the floor is drawn into it.
    this.v1.copy(this.from).addScaledVector(this.fwd, ARC_R).setY(ARC_Y);
    this.shards.burst(this.v1, 5, 4.2, 0.24);
    this.v2.copy(this.from).addScaledVector(this.fwd, ARC_R - 0.4).setY(0.1);
    this.shards.drift(this.v2, this.v1, 6, 0.55, 1.6, 0.22);
    this.motes.emit(this.v2, 1.6, 8);
    if (!ctx) return;
    // Re-check at the swing: everyone still inside the cone is hit.
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 0, pull: 1.5, from: ctx.from, color: VOID_CSS.body });
    }
  }
}

export const riftCleaveModule: EffectModule = {
  label: 'rift cleave',
  category: 'hero: void',
  targeting: { mode: 'enemies', maxTargets: 10 },
  create: () => new RiftCleave(),
  telegraphs(effect) {
    const e = effect as RiftCleave;
    if (!e.ctx) return [];
    return [{ shape: e.cone, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RiftCleave;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as RiftCleave).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
