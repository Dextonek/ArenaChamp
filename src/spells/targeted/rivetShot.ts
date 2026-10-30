import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { FORGE, FORGE_CSS, ForgeIron, HotStreak, QuenchSteam, SlagBlobs, SlagPool, Sparks } from '../../effects/parts/forge';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Rivet Shot (forge kit, Q: quick strike): Brannoc pulls a white-hot rivet out of his chest forge (sparks), flicks it,
 * and it flies as a short hot streak and punches into the target. Sparks burst out of the back, slag splashes under
 * the target and cools, the rivet drops and cools to black, a puff of cold steam. See pipeline/designs/kit-forge.md.
 */
export interface RivetShotSettings {
  damage: number;
  loop: boolean;
}

export const defaultRivetShot = (): RivetShotSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const PULL_END_T = 0.25;
const HIT_T = 0.45;
const DURATION = 1.7;

export class RivetShot implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RivetShotSettings;
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
  private chest = new THREE.Vector3(0, 1.4, 14);
  private feet = new THREE.Vector3(0, 0, -8);
  private hit = new THREE.Vector3(0, 1.1, -8);
  private dir = new THREE.Vector3(0, 0, -1);

  // Event flags.
  private flags = { spark1: false, spark2: false, impacted: false, steam1: false, steam2: false, steam3: false, poolCool: false };
  private fallY = 0;
  private fallVy = 0;

  // Parts.
  private rivet = ForgeIron.rivet(0.42);
  private streak = new HotStreak();
  private sparks = new Sparks(120);
  private pool = new SlagPool();
  private blobs = new SlagBlobs(8, 6);
  private steam = new QuenchSteam(8);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: FORGE.accent, core: 0xe8fbff, additive: false });
  private flare = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: FORGE.hot, core: FORGE.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: RivetShotSettings = defaultRivetShot()) {
    this.settings = settings;
    this.screen.impactColor.set(FORGE.ash);
    this.blobs.splatCool = 0.4;
    this.blobs.splatFade = 0.2;
    this.steam.life = 0.5;
    this.group.add(
      this.rivet, this.streak.mesh, this.pool.mesh, this.blobs.mesh, this.sparks.mesh, this.steam.mesh, this.pop.mesh,
      this.flare.mesh, this.groundShock.mesh,
    );
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
    this.from.copy(ctx.from);
    this.feet.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.35).setY(1.4);
    this.hit.copy(this.feet).setY(1.1);
    this.dir.subVectors(this.hit, this.chest).normalize();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.hit);
    this.pool.place(this.feet);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fallY = 0;
    this.fallVy = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.sparks.reset();
    this.pool.reset();
    this.blobs.reset();
    this.steam.reset();
    this.streak.reset();
    this.rivet.visible = false;
    this.pop.set(this.hit, 0, 0);
    this.flare.set(this.chest, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.sparks.update(dt);
    this.pool.update(dt);
    this.blobs.update(dt);
    this.steam.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.spark1 && t >= 0.05) {
      f.spark1 = true;
      this.sparks.burst(this.chest, this.v1.copy(this.fwd).setY(0.8), 6, 4.5, 0.8);
    }
    if (!f.spark2 && t >= 0.17) {
      f.spark2 = true;
      this.sparks.burst(this.chest, this.v1.copy(this.fwd).setY(0.8), 6, 4.5, 0.8);
    }
    if (!f.impacted && t >= HIT_T) {
      f.impacted = true;
      this.fallY = this.hit.y;
      this.fallVy = 1.5;
      // Sparks out of the back of the target, slag splash and three blobs.
      this.sparks.burst(this.hit, this.dir, 22, 9, 0.7);
      this.sparks.burst(this.hit, this.v1.set(0, 1, 0), 8, 6, 0.9);
      this.pool.spread(1.0, 0.12);
      this.pool.cool(0.85, 0.15);
      this.pool.fade(0.25, 0.95);
      for (let i = 0; i < 3; i++) {
        this.v1.set((Math.random() - 0.5) * 3, 3 + Math.random() * 0.8, (Math.random() - 0.5) * 3);
        this.blobs.throw(this.hit, this.v1, 0.15 + Math.random() * 0.05);
      }
      this.shake = 0.15;
      if (ctx && ctx.targets[0]) ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 5, from: ctx.from, color: FORGE_CSS.body });
    }
    if (!f.steam1 && t >= 0.7) { f.steam1 = true; this.steam.puff(this.v1.copy(this.feet).setY(0.3), 0.45, true); }
    if (!f.steam2 && t >= 0.85) { f.steam2 = true; this.steam.puff(this.v1.copy(this.feet).add(this.v2.set(0.3, 0.3, 0.1)), 0.4); }
    if (!f.steam3 && t >= 1.0) { f.steam3 = true; this.steam.puff(this.v1.copy(this.feet).add(this.v2.set(-0.25, 0.3, -0.1)), 0.35); }

    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - HIT_T;
    const f = this.flags;

    // --- 0..0.25 Pull: the rivet rises out of the chest forge, white-hot, with a four-point flare. ---
    // --- 0.25..0.45 Flick: it flies at the target on a short hot streak. ---
    if (t < HIT_T) {
      const pu = smoothstep(t / PULL_END_T);
      const start = this.v1.copy(this.chest).addScaledVector(this.fwd, 0.4 * pu).add(this.v2.set(0, 0.2 * pu, 0));
      if (t < PULL_END_T) {
        this.rivet.position.copy(start);
        this.rivet.scale.setScalar(Math.max(0.42 * (0.35 + 0.65 * pu), 1e-4));
        this.streak.set(start, start, 0, 0);
      } else {
        const fu = Math.pow((t - PULL_END_T) / (HIT_T - PULL_END_T), 1.5);
        const p0 = this.v3.copy(this.chest).addScaledVector(this.fwd, 0.4).add(this.v2.set(0, 0.2, 0));
        this.rivet.position.lerpVectors(p0, this.hit, fu);
        this.rivet.scale.setScalar(0.42);
        const trail = Math.min(2.4, this.rivet.position.distanceTo(p0) + 0.3);
        this.streak.set(this.rivet.position, this.v1.copy(this.rivet.position).addScaledVector(this.dir, -trail), 0.24, 1);
        // A few sparks shed along the flight.
        if (Math.random() < Math.min(1, dt * 60 * 0.45)) {
          this.sparks.burst(this.rivet.position, this.v1.copy(this.dir).multiplyScalar(-1).setY(0.4), 1, 3, 0.9);
        }
      }
      this.rivet.visible = true;
      this.rivet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.dir);
      ForgeIron.heat(this.rivet, 1);
      const fl = t < PULL_END_T ? Math.sin(Math.PI * smoothstep(t / PULL_END_T)) : 0;
      this.flare.set(this.v2.copy(this.chest).addScaledVector(this.fwd, 0.15), 0.55 * fl, fl > 0.05 ? 1 : 0, t * 3);
    } else {
      this.flare.set(this.chest, 0, 0);
      this.streak.set(this.hit, this.hit, 0, 0);
      // The rivet drops where it struck, cools to black and sinks at the end.
      this.fallVy -= 14 * dt;
      this.fallY = Math.max(0.14, this.fallY + this.fallVy * dt);
      const sink = smoothstep((t - 1.4) / 0.25);
      this.rivet.position.set(this.hit.x + this.dir.x * 0.5 * Math.min(1, after / 0.25), this.fallY - sink * 0.3, this.hit.z + this.dir.z * 0.5 * Math.min(1, after / 0.25));
      this.rivet.scale.setScalar(Math.max(0.42 * (1 - sink * 0.5), 1e-4));
      ForgeIron.heat(this.rivet, 1 - smoothstep(after / 1.0));
      this.rivet.visible = t < 1.65;
    }

    // --- Hit: dark impact frame, cold accent star (2 frames), ground refraction, shake. ---
    this.screen.impact = impactFrameAt(t, HIT_T, [1], 0.03);
    if (f.impacted) {
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.hit, 1.0 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 2.2 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.15 * Math.exp(-after * 14);
    }
  }
}

export const rivetShotModule: EffectModule = {
  label: 'rivet shot',
  category: 'hero: forge',
  targeting: { mode: 'enemy' },
  create: () => new RivetShot(),
  telegraphs(effect) {
    const e = effect as RivetShot;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.1, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RivetShot;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as RivetShot).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
