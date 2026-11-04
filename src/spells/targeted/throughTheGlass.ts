import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Gleam, MIRROR, Slivers } from '../../effects/parts/mirror';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { GLASS_BEYOND, GLASS_MAX, GLASS_PLAIN, GLASS_TIME, bookOf } from '../../traits/mirror';

/**
 * Through the Glass (mirror kit v5, E: a dash through her own Stand). With a Vanity Stand standing within 9 m, Silvane steps into it
 * and out of the far side, in line with it, 3 m beyond (at most 9 m from where she stood in all): `ctx.moveCaster`, 0.3 s. The Stand is
 * read from the record the W effect writes on both screens (`bookOf(ctx.caster).stand`, from `sentFrom` and `point`, so they
 * agree). With no Stand (or a broken or distant one) it is a plain 3 m step toward the aim. No damage and no zone: the gain is the
 * position, and the enemy can read it: stand by the mirror and you know where she comes out. It is a dash (`HeroSpell.dash`).
 *
 * It shows as a silver streak into the glass, a flash and slivers at the Stand (a doorway ring on the floor), a violet streak out of
 * it, and a pale star and ring where she lands. Network duels: the other screen has no `moveCaster` (her client streams the step),
 * so the path is drawn from `sentFrom` and the Stand. Clean by 1.0 s. See pipeline/designs/kit-mirror.md.
 */
export interface ThroughTheGlassSettings {
  loop: boolean;
}

export const defaultThroughTheGlass = (): ThroughTheGlassSettings => ({ loop: false });

const DURATION = 1.0;
const MIN_STEP = 1;

export class ThroughTheGlass implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThroughTheGlassSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private entered = false;
  private arrived = false;
  private viaStand = false;

  private start = new THREE.Vector3();
  private door = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);

  private gleam = new Gleam(4);
  private slivers = new Slivers(80);
  private doorStar = new StarBurst({ points: 8, inner: 0.3, color: MIRROR.body, core: 0xffffff, additive: false });
  private exitStar = new StarBurst({ points: 8, inner: 0.3, color: MIRROR.violet, core: 0xffffff, additive: false });
  private ringA = new ShockRefraction({ facing: 'ground' });
  private ringB = new ShockRefraction({ facing: 'ground' });
  private ringC = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ThroughTheGlassSettings = defaultThroughTheGlass()) {
    this.settings = settings;
    this.group.add(this.gleam.mesh, this.slivers.mesh, this.doorStar.mesh, this.exitStar.mesh, this.ringA.mesh, this.ringB.mesh, this.ringC.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return GLASS_TIME;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    const st = bookOf(ctx.caster).stand, now = performance.now();
    const dStand = st ? Math.hypot(st.x - this.start.x, st.z - this.start.z) : Infinity;
    this.viaStand = !!st && !st.gone && now >= st.bornAt - 100 && now < st.until && dStand <= GLASS_MAX;
    if (this.viaStand && st) {
      this.door.set(st.x, 0, st.z);
      if (dStand > 0.3) this.dir.set((st.x - this.start.x) / dStand, 0, (st.z - this.start.z) / dStand);
      else this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
      this.end.copy(this.start).addScaledVector(this.dir, Math.min(GLASS_MAX, dStand + GLASS_BEYOND));
    } else {
      this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
      const d = this.v1.length();
      if (d < 0.3) this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
      else this.dir.copy(this.v1).multiplyScalar(1 / d);
      this.door.copy(this.start).addScaledVector(this.dir, MIN_STEP * 0.4);
      this.end.copy(this.start).addScaledVector(this.dir, GLASS_PLAIN);
    }
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The step: she slides to the spot (the engine clamps it into the ring and out of the walls; a wall on the line is passed).
    if (ctx.moveCaster) this.end.copy(ctx.moveCaster(this.end, GLASS_TIME)).setY(0);
    // The streak into the glass, and out of it.
    this.v1.copy(this.start).setY(1.0);
    this.v2.copy(this.door).setY(1.2);
    this.gleam.set(this.v1, this.v2, 0.5, 0.9, undefined, 0.2, 0);
    this.v1.copy(this.start).setY(0.5);
    this.v2.copy(this.door).setY(0.7);
    this.gleam.set(this.v1, this.v2, 0.3, 0.7, undefined, 0.2, 1);
    this.slivers.burst(this.v1.copy(this.start).setY(1.0), 8, 3.5);
    this.shake = 0.06;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.entered = this.arrived = false;
    this.gleam.reset();
    this.slivers.reset();
    this.doorStar.set(this.door, 0, 0);
    this.exitStar.set(this.end, 0, 0);
    this.ringA.set(this.start, 0, 0);
    this.ringB.set(this.door, 0, 0);
    this.ringC.set(this.end, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.slivers.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time, half = GLASS_TIME * 0.5;

    // The ring where she left.
    const lp = THREE.MathUtils.clamp(t / 0.35, 0, 1);
    this.ringA.set(this.start, 0.3 + 1.6 * lp, 0.05 * (1 - lp) * (1 - lp));
    // The streak into the glass fades; the one out of it draws on arrival.
    const fadeIn = 1 - THREE.MathUtils.clamp(t / 0.4, 0, 1);
    this.v1.copy(this.start).setY(1.0);
    this.v2.copy(this.door).setY(1.2);
    this.gleam.set(this.v1, this.v2, 0.5, 0.9 * fadeIn, undefined, 0.2, 0);

    // Into the glass: a flash and slivers at the door.
    if (!this.entered && t >= half) {
      this.entered = true;
      this.slivers.burst(this.v1.copy(this.door).setY(1.3), 18, 5, 1.4);
      this.shake = 0.12;
    }
    if (this.entered) {
      const after = t - half;
      const sp = StarBurst.pop(after, 0.03, 0.16);
      this.doorStar.set(this.v1.copy(this.door).setY(1.3), 1.9 * sp.scale, sp.opacity, after * 4);
      const rp = THREE.MathUtils.clamp(after / 0.35, 0, 1);
      this.ringB.set(this.door, 0.3 + 1.2 * rp, 0.045 * (1 - rp) * (1 - rp));
    }
    // Out of the far side: a violet streak, a star and a ring where she lands.
    if (!this.arrived && t >= GLASS_TIME) {
      this.arrived = true;
      this.slivers.burst(this.v1.copy(this.end).setY(1.0), 12, 4, 1.2);
      this.shake = Math.max(this.shake, 0.1);
    }
    if (this.arrived) {
      const after = t - GLASS_TIME;
      const sp = StarBurst.pop(after, 0, 0.03);
      this.exitStar.set(this.v1.copy(this.end).setY(1.1), 1.1 * sp.scale, sp.opacity, 0.2);
      const rp = THREE.MathUtils.clamp(after / 0.35, 0, 1);
      this.ringC.set(this.end, 0.3 + 1.4 * rp, 0.045 * (1 - rp) * (1 - rp));
      this.v1.copy(this.door).setY(1.1);
      this.v2.copy(this.end).setY(1.0);
      this.gleam.set(this.v1, this.v2, 0.45, 0.85 * (1 - THREE.MathUtils.clamp(after / 0.35, 0, 1)), MIRROR.violet, 0.2, 2);
      this.shake = Math.max(this.shake * 0.9, 0.1 * Math.exp(-after * 14));
    }
    this.shake *= Math.exp(-dt * 8);
  }
}

export const throughTheGlassModule: EffectModule = {
  label: 'through the glass',
  category: 'hero: mirror',
  // A step toward the aim (or through the Stand), no area: the radius only lets the AI cast it when the target is within reach.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new ThroughTheGlass(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ThroughTheGlass;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    f.add((effect as ThroughTheGlass).settings, 'loop');
  },
};
