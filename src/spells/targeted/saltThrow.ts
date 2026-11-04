import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Palm, Puffs, Ripple, SaltGrains, SUMO, SUMO_CSS } from '../../effects/parts/sumo';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SALT_ANGLE, SALT_BLIND, SALT_REACH, SALT_WIND, bookOf, liveRing, shrinkRing } from '../../traits/sumo';

/**
 * Salt Throw (sumo kit, R: the purification). No aim of its own: it goes the way he faces. A 6 m cone, 70 degrees wide, shows in front
 * of him from the cast (the telegraph). He raises a fistful of salt (a big hand, his hand pulled back, 0 - 0.3 s), keeps very still, and at 0.28 s
 * throws it: 140 white crystals fly out in a fan on real arcs, spread over 0.17 s, and land across the cone between 0.55 s and 0.9 s,
 * where they lie glittering and shrink away. At 0.6 s everyone inside the cone at that moment (live positions) is blinded 1.5 s
 * (`status: blind`, no damage, `knock: 0`), a pale star pops, one short impact frame, a pale sheet flashes over the cone. If his ring
 * stands, it loses 2 m of radius for the rest of its life (`shrinkRing`: both screens do it at this moment, hit or not), and a pale ripple
 * runs in from the old rope to the new one. His 30% haste for 4 s comes from his trait (`tick`, 0.6 s after the cast). Clean by about 1.8 s.
 *
 * Network duels: the cone is built from `sentFrom` and the caster's facing, the same on both screens, and both shrink their copy
 * of his ring at the same moment. See pipeline/designs/kit-sumo.md.
 */
export interface SaltThrowSettings {
  /** Seconds of blindness. */
  blind: number;
  loop: boolean;
}

export const defaultSaltThrow = (): SaltThrowSettings => ({ blind: SALT_BLIND, loop: false });

// Timeline (seconds).
const THROW_T = 0.28;
const HIT_T = SALT_WIND;
const DURATION = 1.8;
const HAND_Y = 1.3;
const GRAINS = 140;

const easeOut = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

export class SaltThrow implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SaltThrowSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly cone: Extract<TelegraphShape, { kind: 'cone' }> = { kind: 'cone', x: 0, z: 0, radius: SALT_REACH, angle: SALT_ANGLE, dir: 0 };
  private time = 0;
  private flags = { throw: false, hit: false };
  private yaw = 0;
  private dir = new THREE.Vector3(0, 0, 1);
  private center = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private shrink: { x: number; z: number; from: number; to: number } | null = null;

  private grains = new SaltGrains(GRAINS);
  private dust = new Puffs(16);
  private palm = new Palm();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: SUMO.core, core: SUMO.hot, additive: false });
  private glint = new StarBurst({ points: 4, inner: 0.2, color: SUMO.hot, core: 0xffffff, additive: false });
  private ripple = new Ripple(SUMO.hot, 0.1);
  private sheet: THREE.Mesh;

  private v1 = new THREE.Vector3();

  constructor(settings: SaltThrowSettings = defaultSaltThrow()) {
    this.settings = settings;
    this.screen.impactColor.set(SUMO.hot);
    const half = THREE.MathUtils.degToRad(SALT_ANGLE) / 2;
    this.sheet = new THREE.Mesh(
      new THREE.CircleGeometry(SALT_REACH, 40, -Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: SUMO.hot, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.sheet.renderOrder = 3;
    this.sheet.visible = false;
    this.group.add(this.sheet, this.grains.mesh, this.dust.mesh, this.palm.mesh, this.pop.mesh, this.glint.mesh, this.ripple.mesh);
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
    const s = ctx.sentFrom ?? ctx.from;
    // A quick spell goes the way he faces (`ctx.aim` is 0 for the CPU).
    this.yaw = ctx.caster.group.rotation.y;
    this.dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.center.set(s.x, 0, s.z);
    this.cone.x = s.x;
    this.cone.z = s.z;
    this.cone.dir = this.yaw;
    this.hand.set(s.x + this.dir.x * 0.7 + this.dir.z * 0.4, HAND_Y, s.z + this.dir.z * 0.7 - this.dir.x * 0.4);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center).addScaledVector(this.dir, 3).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.throw = this.flags.hit = false;
    this.shrink = null;
    clearScreenFx(this.screen);
    this.grains.reset();
    this.dust.reset();
    this.palm.set(this.hand, this.yaw, 0, 0);
    this.pop.set(this.hand, 0, 0);
    this.glint.set(this.hand, 0, 0);
    this.ripple.set(this.center, 0, 0);
    this.sheet.visible = false;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.dust.update(dt);
    this.grains.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, ctx = this.ctx;

    // --- The fistful: his hand rises and is drawn back, very slowly; then it is thrown. ---
    if (t < THROW_T) {
      const k = easeOut(t / THROW_T);
      this.v1.copy(this.hand).addScaledVector(this.dir, -0.4 * k);
      this.v1.y += 0.25 * k;
      this.palm.set(this.v1, this.yaw, 0.55 + 0.2 * k, Math.min(1, t / 0.12));
    } else if (t < THROW_T + 0.35) {
      const k = easeOut((t - THROW_T) / 0.1);
      this.v1.copy(this.hand).addScaledVector(this.dir, -0.4 + 1.3 * k);
      this.v1.y += 0.25 - 0.3 * k;
      this.palm.set(this.v1, this.yaw, 0.75, 1 - Math.max(0, (t - THROW_T - 0.15) / 0.2));
    } else this.palm.set(this.v1, this.yaw, 0, 0);

    // --- 0.28 The throw: a fan of crystals on real arcs. ---
    if (!f.throw && t >= THROW_T) {
      f.throw = true;
      this.v1.copy(this.hand).addScaledVector(this.dir, 0.5);
      this.grains.fan(this.v1, this.yaw, THREE.MathUtils.degToRad(SALT_ANGLE) * 0.95, SALT_REACH - 0.3, GRAINS, 0, 0.17, 0.3);
      this.dust.burst(this.v1.setY(0.2), 5, 1.8, 0.3, 0.5, 1.2, this.yaw);
      this.shake = 0.12;
    }

    // --- 0.6 The salt arrives: blind, the ring closes. ---
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.3;
      if (ctx) {
        for (const e of ctx.enemies?.() ?? ctx.targets) {
          const p = e.group.position;
          if (!insideTelegraph(this.cone, p.x, p.z)) continue;
          ctx.hit(e, { damage: 0, knock: 0, color: SUMO_CSS.core, from: this.center.clone(), status: { kind: 'blind', seconds: this.settings.blind } });
        }
        // His ring (if it stands) loses 2 m for the rest of its life, on both screens.
        const book = bookOf(ctx.caster), ring = liveRing(book);
        if (ring) {
          const from = ring.radius;
          shrinkRing(book);
          this.shrink = { x: ring.x, z: ring.z, from, to: ring.radius };
        }
      }
    }
    if (f.hit) {
      const a = t - HIT_T;
      this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.04);
      const sp = StarBurst.pop(a, 0.03, 0.2);
      this.pop.set(this.v1.copy(this.center).addScaledVector(this.dir, 3.2).setY(1.3), 2.8 * sp.scale, sp.opacity, a * 2);
      // A few glints where the salt lies.
      const gp = StarBurst.pop((a - 0.15) % 0.5, 0, 0.18);
      this.glint.set(this.v1.copy(this.center).addScaledVector(this.dir, 2 + (Math.floor((a - 0.15) / 0.5) % 3) * 1.4).setY(0.5), 0.8 * gp.scale, a > 0.15 && a < 1.0 ? gp.opacity : 0, a * 5);
      this.sheet.visible = a < 0.5;
      this.sheet.position.set(this.center.x, 0.06, this.center.z);
      this.sheet.rotation.y = this.yaw;
      (this.sheet.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.max(0, 1 - a / 0.5);
      if (this.shrink) {
        const k = easeOut(a / 0.45);
        this.v1.set(this.shrink.x, 0, this.shrink.z);
        this.ripple.set(this.v1, this.shrink.from + (this.shrink.to - this.shrink.from) * k, 0.8 * (1 - k * k));
      }
      this.shake = 0.3 * Math.exp(-a * 9);
    }
  }
}

export const saltThrowModule: EffectModule = {
  label: 'salt throw',
  category: 'hero: sumo',
  // The AI casts it when the enemy is within this radius less 0.6 m (6 m).
  targeting: { mode: 'self', radius: SALT_REACH + 0.6 },
  create: () => new SaltThrow(),
  telegraphs(effect) {
    const e = effect as SaltThrow;
    return e.ctx ? [{ shape: e.cone, start: 0, impact: HIT_T }] : [];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as SaltThrow;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SaltThrow).settings;
    f.add(s, 'loop');
    f.add(s, 'blind', 0, 3, 0.1);
  },
};
