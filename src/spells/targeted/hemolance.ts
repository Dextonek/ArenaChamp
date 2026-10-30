import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  BLOOD, BLOOD_CSS, BloodDrops, BloodPool, BloodSigil, BloodTendril, BloodThorns, CrescentArc, ShockRefraction,
  SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Hemolance (blood kit, Q: quick strike): a pale cut across the caster's raised palm sprays blood; a tendril of
 * blood pours up out of the hand, coils once above the shoulder and straightens toward the enemy in front of a
 * small bone sigil. Everything holds for a dead beat, then in two frames the liquid HARDENS into one faceted
 * crystal lance (a core-white glint runs along its edge). The lance flies, impales the enemy, an impact frame lands
 * and a crown of thorns bursts from the ground. After a short hold the crystal shatters into dark flakes, a pool
 * spreads and dries, and the drops fly home into the caster's chest. See pipeline/designs/hemolance.md.
 */
export interface HemolanceSettings {
  damage: number;
  loop: boolean;
}

export const defaultHemolance = (): HemolanceSettings => ({ damage: 47, loop: false });

// Timeline (seconds).
const DRAW_T = 0.12;
const POURED_T = 0.2; // tendril fully poured, starts to straighten
const HARDEN_T = 0.35; // after the dead beat 0.29..0.35: liquid becomes crystal
const THROW_T = 0.42;
const IMPACT_T = 0.55;
const SHATTER_T = 0.8;
const DRAIN_T = 0.7;
const DURATION = 1.6;
const LANCE_LEN = 3.0;
const DRAIN_DROPS = 8;

export class Hemolance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HemolanceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 1.5, 13);
  private chest = new THREE.Vector3(0, 1.25, 14);
  private feet = new THREE.Vector3(0, 0, -8);
  private hit = new THREE.Vector3(0, 1.1, -8);
  private dir = new THREE.Vector3(0, 0, -1);
  private lanceEnd = new THREE.Vector3();

  // Event flags.
  private flags = { cutDrops: false, pour1: false, pour2: false, hardened: false, impacted: false, pool: false, drain: false, shattered: false, smoke: false, dried: false };
  private shedTimer = 0;
  private arrivals: number[] = [];
  private lanceId = -1;

  // Parts.
  private cutPivot = new THREE.Group();
  private cut = new CrescentArc({ radius: 0.3, width: 0.11, sweep: Math.PI * 1.9, style: 'toon', edge: BLOOD.bone, mid: BLOOD.bone, outer: BLOOD.body });
  private tendril = new BloodTendril({ segments: 44 });
  private streak = new BloodTendril({ segments: 8 });
  private sigil = new BloodSigil({ color: 0xf2dcb4 });
  private lance = new BloodThorns({ maxSpikes: 2, maxFlakes: 40 });
  private crown = new BloodThorns({ maxSpikes: 12, maxFlakes: 64 });
  private drops = new BloodDrops({ maxSplats: 8 });
  private pool = new BloodPool();
  private smoke = new SmokeBall({ maxBalls: 2, color: BLOOD.dark, rim: 0x2a0a10, flake: BLOOD_CSS.dark });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: BLOOD.accent, core: BLOOD.accent, additive: false });
  private chestPulse = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: BLOOD.hot, core: BLOOD.bone, additive: false });
  private handShock = new ShockRefraction({ facing: 'camera' });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();

  constructor(settings: HemolanceSettings = defaultHemolance()) {
    this.settings = settings;
    this.screen.impactColor.set(BLOOD.bone);

    // The cut: a bone toon crescent on a camera-facing pivot (the arc lives in its local XY plane).
    this.cut.mesh.rotation.z = 0.6;
    this.cutPivot.add(this.cut.mesh);
    this.cut.mesh.onBeforeRender = (_r, _s, camera) => {
      this.cutPivot.parent?.getWorldQuaternion(this.qa);
      camera.getWorldQuaternion(this.qb);
      this.cutPivot.quaternion.copy(this.qa.invert().multiply(this.qb));
      this.cutPivot.updateMatrixWorld(true);
    };

    this.tendril.width = 0.2;
    this.tendril.bead = 1.6;
    this.streak.width = 0.16;
    this.streak.bead = 0;
    this.streak.wobble = 0;
    this.tendril.setFunction((u, out) => this.coilPath(u, out));

    this.drops.splatScale = 0.5;
    this.drops.splats.life = 1.4;
    this.smoke.hold = 0.15;
    this.smoke.emitter.settings.lifetime = 0.45;
    this.emitters.push(this.smoke.emitter);
    this.drops.onArrive = () => this.arrivals.push(this.time);

    this.group.add(
      this.cutPivot, this.tendril.mesh, this.streak.mesh, this.sigil.mesh, this.lance.mesh, this.crown.mesh,
      this.pool.mesh, this.drops.mesh, this.smoke.mesh, this.smoke.emitter.points, this.pop.mesh, this.chestPulse.mesh,
      this.handShock.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return IMPACT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.feet.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.5);
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.15).setY(1.25);
    this.hit.copy(this.feet).setY(1.1);
    this.dir.subVectors(this.hit, this.hand).normalize();
    // The lance ends with its tip a little past the hit point.
    this.lanceEnd.copy(this.hit).addScaledVector(this.dir, 0.25 - LANCE_LEN);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.hit);
    this.pool.place(this.feet);
    this.sigil.set(
      this.v1.copy(this.hand).addScaledVector(this.fwd, 0.8).addScaledVector(this.side, 0.25).setY(this.hand.y + 0.1),
      this.v2.copy(this.fwd).setY(0.1), 0.9,
    );
    this.cutPivot.position.copy(this.hand);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.shedTimer = 0;
    this.arrivals.length = 0;
    this.lanceId = -1;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.smoke.clear();
    this.drops.reset();
    this.lance.reset();
    this.crown.reset();
    this.pool.reset();
    this.sigil.reset();
    this.tendril.reset();
    this.streak.reset();
    this.cut.opacity = 0;
    this.pop.set(this.hit, 0, 0);
    this.chestPulse.set(this.chest, 0, 0);
    this.handShock.set(this.hand, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
    this.layout(0);
  }

  /** The tendril's rest curve for u in 0..1: a stem up out of the hand, one helical loop above the shoulder, a short tail. */
  private coilPath(u: number, out: THREE.Vector3) {
    const h = this.hand;
    // Straight lance line for the straightening blend.
    const sx = h.x + this.dir.x * LANCE_LEN * u, sy = h.y + this.dir.y * LANCE_LEN * u, sz = h.z + this.dir.z * LANCE_LEN * u;
    let cx: number, cy: number, cz: number;
    const stem = 0.35, loopEnd = 0.85;
    if (u < stem) {
      const k = u / stem;
      cx = h.x + this.side.x * Math.sin(k * 2) * 0.05; cy = h.y + 0.7 * k; cz = h.z + this.side.z * Math.sin(k * 2) * 0.05;
    } else if (u < loopEnd) {
      const phi = ((u - stem) / (loopEnd - stem)) * Math.PI * 2;
      const r = 0.34, lat = 0.28 * (phi / (Math.PI * 2) - 0.5);
      const cyc = h.y + 0.7 + r;
      const f = Math.sin(phi) * r, up = -Math.cos(phi) * r;
      cx = h.x + this.fwd.x * f + this.side.x * lat; cy = cyc + up; cz = h.z + this.fwd.z * f + this.side.z * lat;
    } else {
      const k = (u - loopEnd) / (1 - loopEnd);
      const lat = 0.14;
      cx = h.x + this.fwd.x * 0.3 * k + this.side.x * lat; cy = h.y + 0.7 + 0.1 * k; cz = h.z + this.fwd.z * 0.3 * k + this.side.z * lat;
    }
    const k = smoothstep((this.time - POURED_T) / (0.29 - POURED_T));
    return out.set(cx + (sx - cx) * k, cy + (sy - cy) * k, cz + (sz - cz) * k);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.drops.update(dt);
    this.lance.update(dt);
    this.crown.update(dt);
    this.pool.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.cutDrops && t >= 0.03) {
      f.cutDrops = true;
      this.drops.spray(this.hand, this.v1.copy(this.fwd).multiplyScalar(0.5).setY(1), 6, 3.2, 0.7);
    }
    if (!f.pour1 && t >= 0.17) { f.pour1 = true; this.drops.spray(this.hand, this.v1.set(0, 1, 0), 2, 1.5, 0.5); }
    if (!f.pour2 && t >= 0.23) { f.pour2 = true; this.drops.spray(this.hand, this.v1.set(0, 1, 0), 2, 1.5, 0.5); }
    if (!f.hardened && t >= HARDEN_T) {
      f.hardened = true;
      this.lanceId = this.lance.spike(this.hand, this.dir, LANCE_LEN, 0.34, 0, 0);
    }
    // Shed a drop now and then along the throw path.
    if (t >= THROW_T && t < IMPACT_T) {
      this.shedTimer += dt;
      while (this.shedTimer >= 0.015) {
        this.shedTimer -= 0.015;
        this.v1.copy(this.lanceBase(t)).addScaledVector(this.dir, Math.random() * LANCE_LEN * 0.6);
        this.v2.set((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
        this.drops.emit(this.v1, this.v2, 0.035 + Math.random() * 0.03);
      }
    }
    if (!f.impacted && t >= IMPACT_T) {
      f.impacted = true;
      this.crown.erupt(this.feet, 1.3, 10, 1.4, { tilt: 0.45, stagger: 0.1, grow: 0.15 });
      this.drops.spray(this.hit, this.v1.set(0, 1, 0), 14, 6, 0.8);
      this.shake = 0.35;
      if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 4, from: ctx.from, color: BLOOD_CSS.body });
    }
    if (!f.pool && t >= 0.6) { f.pool = true; this.pool.spread(1.4, 0.3); }
    if (!f.drain && t >= DRAIN_T) {
      f.drain = true;
      this.drops.drain(this.hit, (out) => out.copy(this.chest), DRAIN_DROPS, { stagger: 0.025, duration: 0.35, radius: 0.09, spread: 0.35 });
    }
    if (!f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.lance.shatter(10, 4.5, 0.4);
      this.crown.shatter(4, 4, 0.4);
    }
    if (!f.smoke && t >= 0.9) { f.smoke = true; this.smoke.trigger(this.v1.copy(this.feet).setY(0.5), 0.9, 0.7); }
    if (!f.dried && t >= 0.95) { f.dried = true; this.pool.dry(0.15, 0.3); this.drops.splats.fadeOutAll(0.4); }

    this.layout(dt);
  }

  /** Lance base position at time t during the throw (accelerating). */
  private lanceBase(t: number) {
    const u = THREE.MathUtils.clamp((t - THROW_T) / (IMPACT_T - THROW_T), 0, 1);
    return this.v3.lerpVectors(this.hand, this.lanceEnd, Math.pow(u, 1.6));
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - IMPACT_T;
    const f = this.flags;

    // --- 0..0.35 The cut: a bone crescent slashes across the raised palm. ---
    const cutOn = t < DRAW_T;
    this.cutPivot.position.copy(this.hand);
    this.cut.head = 1.2 * smoothstep(t / 0.09);
    this.cut.length = 0.6;
    this.cut.time = t;
    this.cut.erosion = smoothstep((t - 0.07) / 0.05);
    this.cut.opacity = cutOn ? 1 : 0;

    // --- 0.35..1.1 Draw: the tendril pours up, coils, straightens; the bone sigil draws on behind it. ---
    this.tendril.head = f.hardened ? 0 : 1 - Math.pow(1 - THREE.MathUtils.clamp((t - DRAW_T) / (POURED_T - DRAW_T), 0, 1), 3);
    this.tendril.tail = 0;
    this.tendril.wobble = t < 0.29 ? 0.02 : 0; // the dead beat: dead still
    if (t >= DRAW_T && !f.hardened) this.tendril.update(t);
    else this.tendril.mesh.visible = false;
    this.sigil.reveal = smoothstep((t - DRAW_T) / 0.15);
    this.sigil.opacity = 1 - smoothstep((t - HARDEN_T) / 0.15);

    // --- 1.10 Harden: a core glint runs along the lance edge for two frames; a small camera-facing refraction. ---
    const hk = t - HARDEN_T;
    this.lance.glint = hk >= 0 && hk < 1 / 30 ? 1 : 0;
    this.lance.glintAt = THREE.MathUtils.clamp(hk / (1 / 30), 0, 1);
    const hs = THREE.MathUtils.clamp(hk / 0.15, 0, 1);
    this.handShock.set(this.hand, 0.2 + 1.0 * hs, hk >= 0 ? 0.03 * (1 - hs) * (1 - hs) : 0);

    // --- 1.18..1.4 Throw: the lance flies, a dark-red streak trails it. ---
    if (this.lanceId >= 0) {
      const base = this.lanceBase(t);
      this.lance.place(this.lanceId, base, this.dir);
      const flown = Math.min(1, Math.max(0, (t - THROW_T) / (IMPACT_T - THROW_T)));
      const trail = Math.min(3.2, this.hand.distanceTo(base));
      const sOn = t >= THROW_T && flown > 0;
      if (sOn) {
        const pts = this.streakPts;
        pts[0].copy(base);
        pts[1].copy(base).addScaledVector(this.dir, -trail);
        this.streak.setPoints(pts);
        this.streak.head = 1 - THREE.MathUtils.clamp(after / 0.08, 0, 1);
        this.streak.update(t);
      } else {
        this.streak.mesh.visible = false;
      }
    }

    // --- 1.4 Impact: bone-card impact frame, accent star, ground refraction, shake. ---
    this.screen.impact = impactFrameAt(t, IMPACT_T, [1], 0.03);
    if (f.impacted) {
      const sp = StarBurst.pop(after - 0.03, 0, 0.015);
      this.pop.set(this.hit, 1.1 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 2.6 * gp, 0.035 * (1 - gp) * (1 - gp));
      this.shake = 0.35 * Math.exp(-after * 14);
    }

    // --- Drain: a tiny crimson pulse at the chest for every drop that arrives. ---
    let ps = 0;
    for (const ta of this.arrivals) ps = Math.max(ps, StarBurst.pop(t - ta, 0.0, 0.07).scale);
    this.chestPulse.set(this.chest, 0.55 * ps, ps > 0 ? 1 : 0, 0);
  }

  private streakPts = [new THREE.Vector3(), new THREE.Vector3()];
}

export const hemolanceModule: EffectModule = {
  label: 'hemolance',
  category: 'hero: blood',
  targeting: { mode: 'enemy' },
  create: () => new Hemolance(),
  telegraphs(effect) {
    const e = effect as Hemolance;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.1, impact: IMPACT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Hemolance;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as Hemolance).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
