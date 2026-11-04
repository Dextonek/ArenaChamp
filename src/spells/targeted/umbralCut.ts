import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import { CutFlash, CutShape, CutShards, ShadowPool, SHADOW, SHADOW_CSS } from '../../effects/parts/shadow';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { CUT_BACK, CUT_BEHIND, CUT_REACH, CUT_WIND, watchCover } from '../../traits/shadow';
import { isBehind } from '../../traits/types';

/**
 * Umbral Cut (shadow kit, Q: a targeted dagger strike, `projectile` hit). A click on the enemy (2.5 m, sight checked by the engine
 * at the cast) starts a `CUT_WIND` (0.35 s) wind-up in which she stands (the telegraph roots her): a black pool with a violet rim and a
 * pale foil ring marks the enemy on both screens and follows it, and a dagger cut-out lies on the floor from her to it. At 0.35 s the
 * strike lands on the enemy's LIVE position if it is within `CUT_REACH` (3.2 m) of her: `damage` (50), times `CUT_BEHIND` (1.7) when she is behind it
 * (the back 120 degrees of its facing, `isBehind` with `CUT_BACK`; its facing follows its walk, so a step toward her turns it). The
 * bonus is decided here, at the hit, on the screen that resolves it, and `damage` is passed in the hit. Out of reach: a puff and no hit.
 * A hit shows a hot violet crescent with a mint core (two crossed ones from behind) and black shards. Clean by 1.0 s. The trait's veil
 * bonus (power, silence) comes as mods with the cast. See pipeline/designs/kit-shadow.md.
 */
export interface UmbralCutSettings {
  damage: number;
  loop: boolean;
}

export const defaultUmbralCut = (): UmbralCutSettings => ({ damage: 50, loop: false });

const DURATION = 1.0;
const MARK_R = 1.1;
const UP = new THREE.Vector3(0, 1, 0);

export class UmbralCut implements Effect {
  readonly group = new THREE.Group();
  readonly settings: UmbralCutSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private struck = false;
  private foe = new THREE.Vector3();
  private start = new THREE.Vector3();

  // Parts.
  private mark = new ShadowPool();
  private line = new CutShape({ kind: 'blade', edgeWidth: 0.12, renderOrder: 3 });
  private flashA = new CutFlash();
  private flashB = new CutFlash();
  private shards = new CutShards(24);

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private n = new THREE.Vector3();

  constructor(settings: UmbralCutSettings = defaultUmbralCut()) {
    this.settings = settings;
    this.screen.impactColor.set(SHADOW.hot);
    this.screen.tint.set(SHADOW.dark);
    this.group.add(this.mark.mesh, this.line.mesh, this.flashA.mesh, this.flashB.mesh, this.shards.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return CUT_WIND;
  }

  /** The enemy's live feet, for the mark and the telegraph. */
  get markAt() {
    return this.foe;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    watchCover(ctx);
    this.target = ctx.targets[0] ?? null;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.foe.copy(this.target ? this.target.group.position : ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.foe).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.struck = false;
    clearScreenFx(this.screen);
    this.mark.reset();
    this.line.reset();
    this.flashA.reset();
    this.flashB.reset();
    this.shards.reset();
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.mark.update(dt);
    this.flashA.update(dt);
    this.flashB.update(dt);
    this.shards.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    this.liveFoe();
    if (!this.struck && t >= CUT_WIND) {
      this.struck = true;
      this.strike();
    }
    this.layout(t);
    this.shake *= Math.exp(-dt * 10);
  }

  /** Where she stands now: her live figure, else the cast spot. */
  private me(out: THREE.Vector3) {
    const c = this.ctx;
    return out.copy(c ? c.caster.group.position : this.start).setY(0);
  }

  /** The strike: decided on the enemy's live position, more from behind. */
  private strike() {
    const ctx = this.ctx;
    const me = this.me(this.v1);
    const aim = ctx?.aim ?? 0;
    this.mark.shrink(0.25);
    this.flashA.face(aim);
    this.flashB.face(aim);
    if (!ctx || !this.target || Math.hypot(this.foe.x - me.x, this.foe.z - me.z) > CUT_REACH) {
      // Out of reach: the dagger finds nothing, a small puff of shards at her side.
      this.v2.copy(me).setY(1.0);
      this.shards.burst(this.v2, 0.6, 4, 2.5, 2, 0.6);
      return;
    }
    const behind = isBehind(me, this.target.group.position, this.target.group.rotation.y, CUT_BACK);
    this.v2.copy(this.foe).setY(1.2);
    // The crescent stands toward the camera: its stroke runs up and to the side (a second one crosses it from behind).
    const sx = -Math.cos(aim) * 0.7, sz = Math.sin(aim) * 0.7;
    this.flashA.cut(this.v2, this.n.set(sx, 0.8, sz), behind ? 2.0 : 1.5);
    if (behind) this.flashB.cut(this.v2, this.n.set(-sx, 0.8, -sz), 2.0);
    this.shards.burst(this.v2, 0.5, behind ? 16 : 9, 5, 3.5, 0.9);
    this.shake = behind ? 0.3 : 0.16;
    // `projectile: true`: judged on the live position, the touch is the check. The hit says how much it is.
    ctx.hit(this.target, {
      damage: this.settings.damage * (behind ? CUT_BEHIND : 1), knock: behind ? 1.4 : 0.6, from: me.clone(),
      color: behind ? SHADOW_CSS.accent : SHADOW_CSS.hot, projectile: true,
    });
  }

  private layout(t: number) {
    const wind = t < CUT_WIND;
    // --- The mark: a black pool with a violet rim and a pale foil ring, on the enemy's live spot through the wind-up. ---
    if (wind) {
      this.mark.spread(this.foe, MARK_R, smoothstep(t / 0.15));
      this.mark.opacity = 0.8 + 0.2 * Math.sin(t * 30);
    }
    // --- The dagger on the floor from her to the enemy, growing in. ---
    const me = this.me(this.v1);
    const dx = this.foe.x - me.x, dz = this.foe.z - me.z, len = Math.hypot(dx, dz);
    if (wind && len > 0.2) {
      const k = smoothstep(t / 0.2);
      const size = Math.min(len, CUT_REACH) * k;
      this.v2.set(me.x + (dx / len) * size * 0.5, 0.07, me.z + (dz / len) * size * 0.5);
      this.line.opacity = 0.95;
      this.line.place(this.v2, UP, Math.max(size, 0.3), Math.atan2(-dz, dx));
    } else this.line.opacity = 0;
    this.screen.edgeTint.set(SHADOW.body);
  }
}

export const umbralCutModule: EffectModule = {
  label: 'umbral cut',
  category: 'hero: shadow',
  // Click an enemy: a 0.35 s wind-up, then one dagger strike that always lands (`projectile`) if it is within 3.2 m; from behind it is doubled.
  targeting: { mode: 'enemy' },
  create: () => new UmbralCut(),
  telegraphs(effect) {
    const e = effect as UmbralCut;
    if (!e.ctx) return [];
    // The mark on the enemy for the wind-up, read live.
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: CUT_WIND }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as UmbralCut;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as UmbralCut).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
  },
};
