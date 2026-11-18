import * as THREE from 'three';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../../effects/parts';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import { Palm, Puffs, Ripple, SaltGrains, SUMO, SUMO_CSS } from '../parts';
import { SALT_ANGLE, SALT_BLIND, SALT_REACH, SALT_WIND, bookOf, liveRing, shrinkRing } from '../trait';

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
 *
 * On the spell blocks (docs/pipeline/hero-framework.md): a zone in front of him (a cone, his facing), judged once; the ring's
 * shrink is the hook.
 */

/** The ring's shrink this cast (for the ripple): where, from and to what radius. */
interface Salt { shrink: { x: number; z: number; from: number; to: number } | null }

const THROW_T = 0.28;
const HIT_T = SALT_WIND;
const HAND_Y = 1.3;
const GRAINS = 140;

const easeOut = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

class SaltLook implements Look<Salt, 'blind'> {
  readonly screen = createScreenFx();
  private thrown = false;
  private hit = false;
  private yaw = 0;
  private dir = new THREE.Vector3(0, 0, 1);
  private center = new THREE.Vector3();
  private hand = new THREE.Vector3();

  private grains = new SaltGrains(GRAINS);
  private dust = new Puffs(16);
  private palm = new Palm();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: SUMO.core, core: SUMO.hot, additive: false });
  private glint = new StarBurst({ points: 4, inner: 0.2, color: SUMO.hot, core: 0xffffff, additive: false });
  private ripple = new Ripple(SUMO.hot, 0.1);
  private sheet: THREE.Mesh;

  private v1 = new THREE.Vector3();

  constructor(group: THREE.Group) {
    this.screen.impactColor.set(SUMO.hot);
    const half = THREE.MathUtils.degToRad(SALT_ANGLE) / 2;
    this.sheet = new THREE.Mesh(
      new THREE.CircleGeometry(SALT_REACH, 40, -Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: SUMO.hot, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.sheet.renderOrder = 3;
    this.sheet.visible = false;
    group.add(this.sheet, this.grains.mesh, this.dust.mesh, this.palm.mesh, this.pop.mesh, this.glint.mesh, this.ripple.mesh);
  }

  cast(c: Cast<Salt, 'blind'>) {
    const ctx = c.ctx!, s = c.from;
    this.yaw = c.yaw;
    this.dir.copy(c.dir);
    this.center.copy(s);
    this.hand.set(s.x + this.dir.x * 0.7 + this.dir.z * 0.4, HAND_Y, s.z + this.dir.z * 0.7 - this.dir.x * 0.4);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center).addScaledVector(this.dir, 3).setY(1);
  }

  reset(c: Cast<Salt, 'blind'>) {
    this.thrown = this.hit = false;
    c.state.shrink = null;
    clearScreenFx(this.screen);
    this.grains.reset();
    this.dust.reset();
    this.palm.set(this.hand, this.yaw, 0, 0);
    this.pop.set(this.hand, 0, 0);
    this.glint.set(this.hand, 0, 0);
    this.ripple.set(this.center, 0, 0);
    this.sheet.visible = false;
  }

  /** The old file aged its dust and grains every frame, playing or not. */
  tick(dt: number) {
    this.dust.update(dt);
    this.grains.update(dt);
  }

  idle(dt: number) {
    this.tick(dt);
  }

  frame(c: Cast<Salt, 'blind'>, t: number) {
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
    if (!this.thrown && t >= THROW_T) {
      this.thrown = true;
      this.v1.copy(this.hand).addScaledVector(this.dir, 0.5);
      this.grains.fan(this.v1, this.yaw, THREE.MathUtils.degToRad(SALT_ANGLE) * 0.95, SALT_REACH - 0.3, GRAINS, 0, 0.17, 0.3);
      this.dust.burst(this.v1.setY(0.2), 5, 1.8, 0.3, 0.5, 1.2, this.yaw);
      c.shake = 0.12;
    }
  }

  /** 0.6 The salt arrives (before the blind). */
  impacting(c: Cast<Salt, 'blind'>) {
    this.hit = true;
    c.shake = 0.3;
  }

  after(c: Cast<Salt, 'blind'>, t: number) {
    if (!this.hit) return;
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
    const shrink = c.state.shrink;
    if (shrink) {
      const k = easeOut(a / 0.45);
      this.v1.set(shrink.x, 0, shrink.z);
      this.ripple.set(this.v1, shrink.from + (shrink.to - shrink.from) * k, 0.8 * (1 - k * k));
    }
    c.shake = 0.3 * Math.exp(-a * 9);
  }
}

export const saltThrowModule = spell<Salt, 'blind'>({
  label: 'salt throw',
  category: 'hero: sumo',
  // The AI casts it when the enemy is within this radius less 0.6 m (6 m).
  targeting: { mode: 'self', radius: SALT_REACH + 0.6 },
  seconds: 1.8,
  state: () => ({ shrink: null }),
  rules: {
    windup: HIT_T,
    facing: true,
    shape: { kind: 'zone', area: (c) => ({ kind: 'cone', x: c.from.x, z: c.from.z, radius: SALT_REACH, angle: SALT_ANGLE, dir: c.yaw }) },
    hit: { damage: 0, knock: 0, color: SUMO_CSS.core, status: { kind: 'blind', seconds: 'blind' } },
    warn: 0,
    on: {
      // His ring (if it stands) loses 2 m for the rest of its life, on both screens, hit or not.
      impact: (c) => {
        if (!c.ctx) return;
        const book = bookOf(c.ctx.caster), ring = liveRing(book);
        if (ring) {
          const from = ring.radius;
          shrinkRing(book);
          c.state.shrink = { x: ring.x, z: ring.z, from, to: ring.radius };
        }
      },
    },
  },
  // Seconds of blindness.
  tune: { blind: [SALT_BLIND, 0, 3, 0.1] },
  noDamage: true,
  look: SaltLook,
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.88 },
  frame: 3,
  maxDamage: 0,
});
