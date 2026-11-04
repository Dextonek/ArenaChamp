import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { INK, Splatter, Stroke } from '../../effects/parts/ink';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { addStroke, inkLive } from '../../traits/ink';

/**
 * Flowing Script (ink kit v5, E: a dash that paints). Ground aim, 6 m. She glides 6 m toward the aim in 0.25 s
 * (`ctx.moveCaster`, which clamps it into the ring and out of the walls) and paints a stroke along her path: a wet ribbon
 * is painted in over the glide, ink flicks off behind her, a ring marks where she left and a small seal-red star where she
 * lands. At the landing the stroke is added to her ink (`addStroke`, traits/ink.ts, on both screens): it lies on the
 * ground for 5 s, slows and Stains whoever stands on it, and makes a crossing where it cuts an older stroke or an armed
 * seal. No damage. Do not follow her down the line. The other screen has no `moveCaster` (her client streams the glide):
 * the stroke runs to the nominal end there. Clean by 1.0 s (5.4 s in the VFX tool, where no trait draws the ink).
 */
export interface FlowingScriptSettings {
  /** Metres of the glide. */
  distance: number;
  loop: boolean;
}

export const defaultFlowingScript = (): FlowingScriptSettings => ({ distance: 6, loop: false });

const STEP_TIME = 0.25;
const LIVE_END = 1.0;
const TOOL_END = 5.4;
const RIBBON_W = 0.7;
const RIBBON_Y = 0.07;

export class FlowingScript implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FlowingScriptSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private len = LIVE_END;
  private arrived = false;
  private dissolveAt = -1;

  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);

  private ribbon = new Stroke({ flat: true, order: 7, taper: 0.7 });
  private splat = new Splatter(32);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: INK.accent, core: 0xffffff, additive: false });
  private ringA = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private path: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(settings: FlowingScriptSettings = defaultFlowingScript()) {
    this.settings = settings;
    this.group.add(this.ribbon.mesh, this.splat.mesh, this.pop.mesh, this.ringA.mesh);
    this.reset();
  }

  get duration() {
    return this.len;
  }

  get impactTime() {
    return STEP_TIME;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    if (this.v1.lengthSq() < 0.09) this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    else this.dir.copy(this.v1).normalize();
    this.end.copy(this.start).addScaledVector(this.dir, this.settings.distance);
    this.len = inkLive(ctx.caster) ? LIVE_END : TOOL_END;
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The glide: she slides to the spot (the engine clamps it into the ring and out of the walls) and the stroke runs to where she lands.
    if (ctx.moveCaster) this.end.copy(ctx.moveCaster(this.end, STEP_TIME)).setY(0);
    this.path[0].set(this.start.x, RIBBON_Y, this.start.z);
    this.path[1].lerpVectors(this.start, this.end, 0.5).setY(RIBBON_Y);
    this.path[2].set(this.end.x, RIBBON_Y, this.end.z);
    this.ribbon.paint(this.path, RIBBON_W, STEP_TIME);
    this.v1.copy(this.start).setY(1.0);
    this.v2.copy(this.dir).negate().setY(0.3);
    this.splat.fling(this.v1, this.v2, 8, 4, { size: 0.12, spread: 0.8, up: 0.6, life: 0.7 });
    this.shake = 0.06;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.arrived = false;
    this.dissolveAt = -1;
    this.ribbon.reset();
    this.splat.reset();
    this.pop.set(this.end, 0, 0);
    this.ringA.set(this.start, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.ribbon.update(dt);
    this.splat.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;

    // The ring where she left, growing at once.
    const lp = THREE.MathUtils.clamp(t / 0.35, 0, 1);
    this.ringA.set(this.start, 0.3 + 1.6 * lp, 0.045 * (1 - lp) * (1 - lp));

    // Ink flicks off her heels as she goes.
    if (t < STEP_TIME && Math.random() < dt * 40) {
      const k = Math.min(1, t / STEP_TIME);
      this.v1.lerpVectors(this.start, this.end, k).setY(0.5);
      this.v2.set(-this.dir.z + (Math.random() - 0.5), 0.6, this.dir.x + (Math.random() - 0.5));
      this.splat.fling(this.v1, this.v2, 1, 2.5, { size: 0.09, spread: 0.6, up: 0.5, life: 0.6 });
    }

    if (!this.arrived && t >= STEP_TIME) {
      this.arrived = true;
      // The stroke lands in her ink: along her path, both screens.
      if (ctx) addStroke(ctx.caster, this.start.x, this.start.z, this.end.x, this.end.z);
      // The ground mark takes over from the ribbon; in the VFX tool (no trait draws the ink) the ribbon stays 5 s.
      this.dissolveAt = ctx && inkLive(ctx.caster) ? t + 0.1 : this.len - 0.6;
      this.v1.copy(this.end).setY(0.3);
      this.v2.copy(this.dir).setY(0.4);
      this.splat.fling(this.v1, this.v2, 6, 4, { size: 0.12, spread: 0.9, up: 0.7, life: 0.7 });
      this.shake = 0.1;
    }
    if (this.arrived) {
      const a = t - STEP_TIME;
      const sp = StarBurst.pop(a, 0, 0.06);
      this.pop.set(this.v1.copy(this.end).setY(0.9), 0.7 * sp.scale, sp.opacity, 0.2);
      this.shake = Math.max(this.shake * Math.exp(-dt * 12), 0);
    }
    if (this.dissolveAt >= 0 && t >= this.dissolveAt) {
      this.dissolveAt = -1;
      this.ribbon.dissolve(0.5);
    }
    if (t >= this.len) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }
}

export const flowingScriptModule: EffectModule = {
  label: 'flowing script',
  category: 'hero: ink',
  // A glide toward the aim, no area: the radius only lets the AI cast it when the target is within reach.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new FlowingScript(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as FlowingScript;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as FlowingScript).settings;
    f.add(s, 'loop');
    f.add(s, 'distance', 2, 8, 0.5);
  },
};
