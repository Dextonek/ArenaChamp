import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { FORGE, FORGE_CSS, ForgeIron, HotStreak, QuenchSteam, SlagBlobs, SlagPool, Sparks } from '../../effects/parts/forge';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Slag Flick (forge kit, Q: 7 m line skillshot). Brannoc pulls a white-hot gob of slag (a rivet) out of his chest
 * forge, flicks it down the aim line and it flies as a hot streak (`ctx.projectile`, the first enemy it touches is
 * hit, dodged by stepping off the line). It burns in: damage and a short slow. Sparks burst out of the back, a slag
 * splash cools under the target, a puff of steam. If it hits nothing it lands at max range and cools to black. The
 * rivet follows the bolt's handle. See pipeline/designs/kit-forge.md, kit-shapes-v3.md.
 */
export interface SlagFlickSettings {
  damage: number;
  /** Seconds of slow on the hit. */
  slow: number;
  loop: boolean;
}

export const defaultSlagFlick = (): SlagFlickSettings => ({ damage: 40, slow: 1.0, loop: false });

// Timeline (seconds).
const PULL_END_T = 0.25;
const THROW_T = 0.3;
const RANGE = 7;
const SPEED = 26;
const RADIUS = 0.45;
const FLIGHT_END = THROW_T + RANGE / SPEED;
const DURATION = 1.9;

export class SlagFlick implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SlagFlickSettings;
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
  private feet = new THREE.Vector3(0, 0, 7);
  private hit = new THREE.Vector3(0, 1.1, 7);

  private flags = { spark1: false, spark2: false, fired: false, landed: false, impacted: false, steam1: false, steam2: false };
  private bolt: Projectile | null = null;
  private landT = -1;
  private fallY = 0;
  private fallVy = 0;

  // Parts.
  private rivet = ForgeIron.rivet(0.46);
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
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: SlagFlickSettings = defaultSlagFlick()) {
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
    return THROW_T;
  }

  /** Seconds until the bolt has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.35).setY(1.4);
    this.feet.copy(ctx.from).addScaledVector(this.fwd, RANGE).setY(0);
    this.hit.copy(this.feet).setY(1.1);
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
    this.bolt = null;
    this.landT = -1;
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
      const loop = this.settings.loop;
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.spark1 && t >= 0.05) {
      f.spark1 = true;
      this.sparks.burst(this.chest, this.v1.copy(this.fwd).setY(0.8), 6, 4.5, 0.8);
    }
    if (!f.spark2 && t >= 0.17) {
      f.spark2 = true;
      this.sparks.burst(this.chest, this.v1.copy(this.fwd).setY(0.8), 6, 4.5, 0.8);
    }
    if (!f.fired && t >= THROW_T) {
      f.fired = true;
      // Without `projectile` (no bolt flies) the gob just lands at max range.
      if (ctx?.projectile) {
        this.v1.copy(ctx.from).addScaledVector(this.fwd, 0.55);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.fwd.clone(), speed: SPEED, range: RANGE, radius: RADIUS,
          hit: {
            damage: this.settings.damage, knock: 3, color: FORGE_CSS.body,
            status: { kind: 'slow', seconds: this.settings.slow },
          },
        });
        this.bolt.onHit((_target, at) => this.land(at, t, true));
      }
    }
    if (f.fired && !f.landed) {
      const b = this.bolt;
      if (b ? !b.alive : t >= FLIGHT_END) this.land(b ? b.pos : this.feet, t, false);
    }
    if (f.landed && !f.steam1 && t >= this.landT + 0.35) { f.steam1 = true; this.steam.puff(this.v1.copy(this.feet).setY(0.3), 0.45, true); }
    if (f.landed && !f.steam2 && t >= this.landT + 0.55) { f.steam2 = true; this.steam.puff(this.v1.copy(this.feet).add(this.v2.set(0.3, 0.3, 0.1)), 0.38); }

    this.layout(dt);
  }

  /** The gob lands: on a body (`struck`) or at the end of its range / a pillar. */
  private land(at: THREE.Vector3, t: number, struck: boolean) {
    const f = this.flags;
    if (f.landed) return;
    f.landed = true;
    this.landT = t;
    this.feet.set(at.x, 0, at.z);
    this.hit.set(at.x, 1.1, at.z);
    this.screen.focus.copy(this.hit);
    this.pool.place(this.feet);
    this.fallY = this.hit.y;
    this.fallVy = 1.5;
    this.sparks.burst(this.hit, this.v1.copy(this.fwd), struck ? 22 : 10, 9, 0.7);
    this.sparks.burst(this.hit, this.v1.set(0, 1, 0), struck ? 8 : 4, 6, 0.9);
    this.pool.spread(struck ? 1.0 : 0.7, 0.12);
    this.pool.cool(0.85, 0.15);
    this.pool.fade(0.25, 0.95);
    for (let i = 0; i < 3; i++) {
      this.v1.set((Math.random() - 0.5) * 3, 3 + Math.random() * 0.8, (Math.random() - 0.5) * 3);
      this.blobs.throw(this.hit, this.v1, 0.15 + Math.random() * 0.05);
    }
    if (struck) { f.impacted = true; this.shake = 0.15; }
  }

  private layout(dt: number) {
    const t = this.time;
    const f = this.flags;
    const after = f.landed ? t - this.landT : -1;
    const b = this.bolt;

    if (!f.landed) {
      if (t < THROW_T) {
        // --- Pull: the gob rises out of the chest forge, white-hot, with a four-point flare. ---
        const pu = smoothstep(t / PULL_END_T);
        const start = this.v1.copy(this.chest).addScaledVector(this.fwd, 0.4 * pu).add(this.v2.set(0, 0.2 * pu, 0));
        this.rivet.position.copy(start);
        this.rivet.scale.setScalar(Math.max(0.46 * (0.35 + 0.65 * pu), 1e-4));
        this.streak.set(start, start, 0, 0);
        const fl = t < PULL_END_T ? Math.sin(Math.PI * smoothstep(t / PULL_END_T)) : 0;
        this.flare.set(this.v2.copy(this.chest).addScaledVector(this.fwd, 0.15), 0.55 * fl, fl > 0.05 ? 1 : 0, t * 3);
      } else {
        // --- Flight: it rides the bolt (or the straight line without one), a hot streak behind. ---
        this.flare.set(this.chest, 0, 0);
        const k = Math.min(1, (t - THROW_T) / 0.05);
        const head = this.v3;
        if (b) head.set(b.pos.x, BOLT_HEIGHT, b.pos.z);
        else head.copy(this.chest).addScaledVector(this.fwd, Math.min(RANGE, (t - THROW_T) * SPEED));
        head.lerp(this.v1.copy(this.chest).addScaledVector(this.fwd, 0.4), (1 - k) * (1 - k));
        this.rivet.position.copy(head);
        this.rivet.scale.setScalar(0.46);
        const trail = Math.min(2.6, head.distanceTo(this.chest) + 0.3);
        this.streak.set(head, this.v2.copy(head).addScaledVector(this.fwd, -trail), 0.26, 1);
        if (Math.random() < Math.min(1, dt * 60 * 0.5)) {
          this.sparks.burst(head, this.v2.copy(this.fwd).multiplyScalar(-1).setY(0.4), 1, 3, 0.9);
        }
      }
      this.rivet.visible = true;
      this.rivet.quaternion.setFromUnitVectors(this.up, this.fwd);
      ForgeIron.heat(this.rivet, 1);
    } else {
      this.flare.set(this.chest, 0, 0);
      this.streak.set(this.hit, this.hit, 0, 0);
      // It drops where it landed, cools to black and sinks at the end.
      this.fallVy -= 14 * dt;
      this.fallY = Math.max(0.14, this.fallY + this.fallVy * dt);
      const sink = smoothstep((after - 1.0) / 0.25);
      const slide = 0.5 * Math.min(1, after / 0.25);
      this.rivet.position.set(this.hit.x + this.fwd.x * slide, this.fallY - sink * 0.3, this.hit.z + this.fwd.z * slide);
      this.rivet.scale.setScalar(Math.max(0.46 * (1 - sink * 0.5), 1e-4));
      ForgeIron.heat(this.rivet, 1 - smoothstep(after / 1.0));
      this.rivet.visible = after < 1.25;
    }

    // --- Hit: dark impact frame, cold accent star (2 frames), ground refraction, shake. ---
    this.screen.impact = f.impacted ? impactFrameAt(t, this.landT, [1], 0.03) : 0;
    if (f.landed) {
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.hit, (f.impacted ? 1.0 : 0.5) * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 2.2 * gp, (f.impacted ? 0.03 : 0.012) * (1 - gp) * (1 - gp));
      this.shake = (f.impacted ? 0.15 : 0.05) * Math.exp(-after * 14);
    }
  }
}

export const slagFlickModule: EffectModule = {
  label: 'slag flick',
  category: 'hero: forge',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SlagFlick(),
  telegraphs(effect) {
    const e = effect as SlagFlick;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Armed at the throw, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * RANGE, z2: ctx.from.z + d.z * RANGE, width: RADIUS * 2 },
      start: 0.1, impact: THROW_T, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SlagFlick;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as SlagFlick).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
