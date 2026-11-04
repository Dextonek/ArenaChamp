import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { AshMotes, Crackle, Rift, Shards, VOID } from '../../effects/parts/void';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { RIP_SECONDS, voidFx, watchCover } from '../../traits/void';

/**
 * Phase Step (void kit v5, E: a short blink). He marks a spot up to 4 m toward the aim (`distance`; a shorter aim gives a
 * shorter step, 1 m at least): a 1 m circle telegraph and a ring of glass cracks close on it for 0.25 s (the whole wind-up, he is
 * rooted until then). At 0.25 s he steps through the void (`moveCaster`, 0.05 s, so there is NO untouchable window and he is
 * hittable the whole time): a standing slit tears open where he stood and zips shut, shards fly from both ends, a cyan star pops
 * where he lands with a ground ripple. No damage. The trait arms a rip for 3 s (`mem.ripUntil`, shown as 'rip'): while it is armed
 * a fist of void (a dark core with a pink edge and cyan flecks) hangs at his right hand, following him, until he spends it on a
 * basic attack or it runs out (`voidFx.ripOffAt`, mirrored on the other screen). Clean by 3.6 s.
 * Network duels: the other screen has no `moveCaster`; the path is drawn from `sentFrom` and the aim.
 */
export interface PhaseStepSettings {
  /** Metres of the step (the aim may shorten it). */
  distance: number;
  loop: boolean;
}

export const defaultPhaseStep = (): PhaseStepSettings => ({ distance: 4, loop: false });

// Timeline (seconds).
const MARK_T = 0.25;
const FIST_FADE = 0.3;
const DURATION = RIP_SECONDS + FIST_FADE + 0.3;
const MIN_STEP = 1;

let fistTex: THREE.CanvasTexture | null = null;

/** The fist of void: a dark core, a pink edge, cyan flecks. */
function fistTexture(): THREE.CanvasTexture {
  if (fistTex) return fistTex;
  const S = 128, c = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (g) {
    const halo = g.createRadialGradient(c, c, c * 0.3, c, c, c);
    halo.addColorStop(0, 'rgba(255,42,85,0.9)');
    halo.addColorStop(0.55, 'rgba(255,42,85,0.35)');
    halo.addColorStop(1, 'rgba(255,42,85,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#7affff';
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.3, r = c * (0.5 + 0.08 * (i % 3));
      g.beginPath();
      g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#000000';
    g.beginPath();
    g.arc(c, c, c * 0.42, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffc4d4';
    g.lineWidth = 3;
    g.stroke();
  }
  fistTex = new THREE.CanvasTexture(cv);
  fistTex.colorSpace = THREE.SRGBColorSpace;
  return fistTex;
}

export class PhaseStep implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PhaseStepSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The mark at the destination. */
  readonly mark: Extract<TelegraphShape, { kind: 'circle' }> = { kind: 'circle', x: 0, z: 0, radius: 1 };
  private time = 0;
  private startMs = 0;
  private flags = { mark: false, step: false };
  private fistOff = -1;
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private len = 4;

  private crackle = new Crackle();
  private rift = new Rift(2);
  private shards = new Shards(12);
  private motes = new AshMotes(24);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: VOID.accent, core: VOID.core, additive: false });
  private ringA = new ShockRefraction({ facing: 'ground' });
  private ringB = new ShockRefraction({ facing: 'ground' });
  private fist = new THREE.Sprite(new THREE.SpriteMaterial({ map: fistTexture(), transparent: true, depthWrite: false }));

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: PhaseStepSettings = defaultPhaseStep()) {
    this.settings = settings;
    this.screen.impactColor.set(VOID.hot);
    this.fist.renderOrder = 9;
    this.fist.visible = false;
    this.group.add(this.crackle.mesh, this.rift.mesh, this.shards.mesh, this.motes.mesh, this.pop.mesh, this.ringA.mesh, this.ringB.mesh, this.fist);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return MARK_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    watchCover(ctx);
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    const d = this.v1.length();
    if (d < 0.3) this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    else this.dir.copy(this.v1).multiplyScalar(1 / d);
    this.len = d < 0.3 ? this.settings.distance : THREE.MathUtils.clamp(d, MIN_STEP, this.settings.distance);
    this.end.copy(this.start).addScaledVector(this.dir, this.len);
    this.mark.x = this.end.x;
    this.mark.z = this.end.z;
    this.screen.silhouettes = [ctx.caster.group];
  }

  play() {
    this.reset();
    this.playing = true;
    this.startMs = performance.now();
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.mark = this.flags.step = false;
    this.fistOff = -1;
    clearScreenFx(this.screen);
    this.crackle.reset();
    this.rift.reset();
    this.shards.reset();
    this.motes.reset();
    this.fist.visible = false;
    this.pop.set(this.end, 0, 0);
    this.ringA.set(this.start, 0, 0);
    this.ringB.set(this.end, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crackle.update(dt);
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
    const t = this.time, ctx = this.ctx;
    const f = this.flags;

    // 0..0.25: the mark closes on the destination.
    if (!f.mark) {
      f.mark = true;
      this.crackle.width = 0.3;
      this.crackle.ring(this.end, 1, MARK_T);
      this.crackle.grow(this.end, 1, MARK_T);
      this.motes.emit(this.v1.copy(this.end).setY(0), 0.8, 3);
    }

    // 0.25: the step. He is gone from where he stood; the slit zips shut behind him.
    if (!f.step && t >= MARK_T) {
      f.step = true;
      this.shake = 0.18;
      if (ctx?.moveCaster) this.end.copy(ctx.moveCaster(this.end, 0.05)).setY(0);
      this.rift.openStanding(this.v1.set(this.start.x, 0.05, this.start.z), 2.6, this.v2.set(-this.dir.x, 0, -this.dir.z), 0.7, 0.12, { seed: 4 });
      this.rift.close(0.3, -1, 0.2);
      this.rift.flare(1, 0.25);
      this.shards.burst(this.v1.set(this.start.x, 0.7, this.start.z), 5, 4, 0.3);
      this.shards.burst(this.v1.set(this.end.x, 0.7, this.end.z), 5, 4, 0.3);
      this.crackle.fade(0.4);
    }
    if (f.step) {
      const a = t - MARK_T;
      const lp = smoothstep(a / 0.35);
      this.ringA.set(this.start, 0.3 + 1.8 * lp, 0.05 * (1 - lp) * (1 - lp));
      const sp = StarBurst.pop(a, 0, 0.05);
      this.pop.set(this.v1.set(this.end.x, 1.1, this.end.z), 0.9 * sp.scale, sp.opacity, 0.2);
      const rp = smoothstep(a / 0.35);
      this.ringB.set(this.end, 0.3 + 1.4 * rp, 0.045 * (1 - rp) * (1 - rp));
      this.shake = Math.max(this.shake * Math.exp(-dt * 8), 0);
    }

    // The fist of void at his right hand while the rip is armed (both screens: the flag is mirrored).
    if (ctx && f.step) {
      const fx = voidFx(ctx.caster);
      const spent = fx.ripOffAt >= this.startMs;
      const armed = t - MARK_T < RIP_SECONDS && !spent;
      const ramp = smoothstep((t - MARK_T) / 0.2);
      if (!armed && this.fistOff < 0) this.fistOff = t;
      const fade = this.fistOff < 0 ? 1 : 1 - smoothstep((t - this.fistOff) / FIST_FADE);
      const p = ctx.caster.group.position, yaw = ctx.caster.group.rotation.y;
      this.fist.visible = ramp * fade > 0.01;
      this.fist.position.set(p.x + Math.sin(yaw) * 0.55 + Math.cos(yaw) * 0.5, 1.2, p.z + Math.cos(yaw) * 0.55 - Math.sin(yaw) * 0.5);
      const pulse = 1 + 0.12 * Math.sin(t * 9);
      this.fist.scale.setScalar(Math.max(0.9 * ramp * fade * pulse, 1e-4));
      this.fist.material.opacity = fade;
    }
  }

}

export const phaseStepModule: EffectModule = {
  label: 'phase step',
  category: 'hero: void',
  // A step toward the aim, no area: the radius only lets the AI cast it when the target is within reach.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new PhaseStep(),
  telegraphs(effect) {
    const e = effect as PhaseStep;
    if (!e.ctx) return [];
    return [{ shape: e.mark, start: 0, impact: MARK_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PhaseStep;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as PhaseStep).settings;
    f.add(s, 'loop');
    f.add(s, 'distance', 1, 8, 0.5);
  },
};
