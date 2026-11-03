import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  BLOOD, BLOOD_CSS, BloodDrops, BloodPool, BloodSigil, BloodTendril, BloodThorns, CrescentArc, ShockRefraction,
  SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Hemolance (blood kit, Q: 8 m line skillshot): a pale cut across the caster's raised palm sprays blood; a tendril of
 * blood pours up out of the hand, coils once above the shoulder and straightens down the aim in front of a
 * small bone sigil. Everything holds for a dead beat, then in two frames the liquid HARDENS into one faceted
 * crystal lance (a core-white glint runs along its edge). The lance flies as a bolt (`ctx.projectile`: the first enemy
 * it touches is hit, dodged by stepping off the line), an impact frame lands and a crown of thorns bursts from the
 * ground where it struck (smaller at max range or a pillar when it missed). After a short hold the crystal shatters
 * into dark flakes, a pool spreads and dries, and on a hit the drops fly home into the caster's chest. The 6 HP heal
 * is the trait's (`landed`, `src/traits/blood.ts`), so it holds in a network duel too. With no projectile (a network
 * duel on the caster's screen) the lance is a deterministic visual at the same speed. See pipeline/designs/hemolance.md,
 * kit-shapes-v3.md.
 */
export interface HemolanceSettings {
  damage: number;
  loop: boolean;
}

export const defaultHemolance = (): HemolanceSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const DRAW_T = 0.12;
const POURED_T = 0.2; // tendril fully poured, starts to straighten
const HARDEN_T = 0.35; // after the dead beat 0.29..0.35: liquid becomes crystal
const THROW_T = 0.42;
const DURATION = 1.9;
const LANCE_LEN = 3.0;
const DRAIN_DROPS = 8;
const REACH = 8; // from her feet: the kit's range
const MUZZLE = 0.55;
const SPEED = 30;
const RADIUS = 0.5;
const FLIGHT_END = THROW_T + (REACH - MUZZLE) / SPEED;

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
  private head = new THREE.Vector3(); // the lance's contact point on the ground: live in flight, frozen on landing
  private base = new THREE.Vector3();
  private impT = -1;
  private struck = false;
  private bolt: Projectile | null = null;

  // Event flags.
  private flags = { cutDrops: false, pour1: false, pour2: false, hardened: false, thrown: false, landed: false, pool: false, drain: false, shattered: false, smoke: false, dried: false };
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
    return THROW_T + 0.1;
  }

  /** Seconds until the lance has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.feet.copy(ctx.from).addScaledVector(this.fwd, REACH).setY(0);
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.5);
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.15).setY(1.25);
    this.hit.copy(this.feet).setY(1.1);
    this.dir.copy(this.fwd);
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
    this.bolt = null;
    this.impT = -1;
    this.struck = false;
    this.head.copy(this.hand);
    this.base.copy(this.hand);
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
    // The throw: the lance flies as a bolt (without one, no bolt flies on this screen and the visual runs the same path).
    if (!f.thrown && t >= THROW_T) {
      f.thrown = true;
      if (ctx?.projectile) {
        this.v1.copy(ctx.from).addScaledVector(this.fwd, MUZZLE);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.fwd.clone(), speed: SPEED, range: REACH - MUZZLE, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 4, color: BLOOD_CSS.body },
        });
        this.bolt.onHit((_target, at) => this.land(at, true));
      }
    }
    if (f.thrown && !f.landed) {
      const b = this.bolt;
      if (b) {
        if (b.alive) this.head.set(b.pos.x, 0, b.pos.z);
        else this.land(b.pos, false);
      } else {
        const d = Math.min(REACH - MUZZLE, (t - THROW_T) * SPEED);
        this.head.copy(ctx?.from ?? this.from).addScaledVector(this.fwd, MUZZLE + d).setY(0);
        if (d >= REACH - MUZZLE) this.land(this.head, false);
      }
      // Shed a drop now and then along the throw path.
      this.shedTimer += dt;
      while (this.shedTimer >= 0.015) {
        this.shedTimer -= 0.015;
        this.v1.copy(this.base).addScaledVector(this.dir, Math.random() * LANCE_LEN * 0.6);
        this.v2.set((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
        this.drops.emit(this.v1, this.v2, 0.035 + Math.random() * 0.03);
      }
    }
    if (f.landed) {
      const after = t - this.impT;
      if (!f.pool && after >= 0.05) { f.pool = true; this.pool.spread(this.struck ? 1.4 : 0.9, 0.3); }
      if (!f.drain && after >= 0.15 && this.struck) {
        f.drain = true;
        this.drops.drain(this.hit, (out) => out.copy(this.chest), DRAIN_DROPS, { stagger: 0.025, duration: 0.35, radius: 0.09, spread: 0.35 });
      }
      if (!f.shattered && after >= 0.25) {
        f.shattered = true;
        this.lance.shatter(10, 4.5, 0.4);
        this.crown.shatter(4, 4, 0.4);
      }
      if (!f.smoke && after >= 0.35) { f.smoke = true; this.smoke.trigger(this.v1.copy(this.feet).setY(0.5), 0.9, 0.7); }
      if (!f.dried && after >= 0.4) { f.dried = true; this.pool.dry(0.15, 0.3); this.drops.splats.fadeOutAll(0.4); }
    }

    this.layout(dt);
  }

  /** The lance lands: on a body (`struck`) or at the end of its range / a pillar. */
  private land(at: THREE.Vector3, struck: boolean) {
    const f = this.flags;
    if (f.landed) return;
    f.landed = true;
    this.struck = struck;
    this.impT = this.time;
    this.head.set(at.x, 0, at.z);
    this.feet.copy(this.head);
    this.hit.set(at.x, 1.1, at.z);
    this.screen.focus.copy(this.hit);
    this.pool.place(this.feet);
    this.crown.erupt(this.feet, struck ? 1.3 : 0.8, struck ? 10 : 6, struck ? 1.4 : 0.9, { tilt: 0.45, stagger: 0.1, grow: 0.15 });
    this.drops.spray(this.hit, this.v1.set(0, 1, 0), struck ? 14 : 6, 6, 0.8);
    if (struck) this.shake = 0.35;
  }

  /** The lance's base: it leads the contact point by the lance's length (less 0.25 m of tip), never behind the hand. */
  private placeBase() {
    const along = (this.head.x - this.hand.x) * this.fwd.x + (this.head.z - this.hand.z) * this.fwd.z;
    const k = Math.max(0, along - (LANCE_LEN - 0.25));
    const rise = smoothstep((this.time - THROW_T) / 0.1);
    this.base.copy(this.hand).addScaledVector(this.fwd, k);
    this.base.y = this.hand.y + (BOLT_HEIGHT - this.hand.y) * rise;
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - this.impT;
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
      this.placeBase();
      const base = this.base;
      this.lance.place(this.lanceId, base, this.dir);
      const trail = Math.min(3.2, this.hand.distanceTo(base));
      if (f.thrown && !f.landed && trail > 0.05) {
        const pts = this.streakPts;
        pts[0].copy(base);
        pts[1].copy(base).addScaledVector(this.dir, -trail);
        this.streak.setPoints(pts);
        this.streak.head = 1;
        this.streak.update(t);
      } else {
        this.streak.mesh.visible = false;
      }
    }

    // --- Impact: bone-card impact frame, accent star, ground refraction, shake (a miss only thuds). ---
    this.screen.impact = f.landed && this.struck ? impactFrameAt(t, this.impT, [1], 0.03) : 0;
    if (f.landed && this.struck) {
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
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim strip.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Hemolance(),
  telegraphs(effect) {
    const e = effect as Hemolance;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Armed at the throw, then shown until the lance has passed; a bolt's hit is the dodge check, not the zone.
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * REACH, z2: ctx.from.z + d.z * REACH, width: RADIUS * 2 },
      start: 0.1, impact: THROW_T, until: e.flightEnd,
    }];
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
