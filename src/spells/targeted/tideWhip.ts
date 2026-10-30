import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Droplets, SplashCrown, TIDE, TIDE_CSS, WaterPool, WaterRibbon } from '../../effects/parts/tide';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Tide Whip (tide kit, Q: hook). She spins and a thick water ribbon unrolls from her wrist in a curl, then
 * lashes out to the target like a whip, wraps around it once and drags it 3 m toward her, bursting into a foam crown
 * with a coral pop. The ribbon then falls as droplets and the pool drains. See pipeline/designs/kit-tide.md.
 */
export interface TideWhipSettings {
  damage: number;
  /** Metres the hit drags the target toward her (engine cap 4). */
  pull: number;
  loop: boolean;
}

export const defaultTideWhip = (): TideWhipSettings => ({ damage: 50, pull: 3, loop: false });

// Timeline (seconds).
const CAST_T = 0.0;
const WRAP_END_T = 0.72; // the ribbon has closed its turn around the target
const IMPACT_T = 0.45; // the whip reaches the target
const FALL_T = 0.75; // the ribbon starts to fall apart
const OUT_T = 1.2; // the ribbon is gone
const DURATION = 1.5;

const WIDTH = 0.5;
const WRAP_R = 0.65;

export class TideWhip implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TideWhipSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private wrist = new THREE.Vector3(0.45, 1.1, 13.8);
  private feet = new THREE.Vector3(0, 0, -8);
  private hit = new THREE.Vector3(0, 1.0, -8);
  private p0 = new THREE.Vector3();
  private side = new THREE.Vector3(1, 0, 0);
  private ang0 = 0;
  private split = 0.7;

  private flags = { impacted: false, drained: false, ring2: false };

  // Parts.
  private ribbon = new WaterRibbon(32, 10, 28);
  private drops = new Droplets(36);
  private crown = new SplashCrown();
  private pool = new WaterPool();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: TIDE.accent, core: 0xfff2e8, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: TideWhipSettings = defaultTideWhip()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.hot);
    this.screen.tint.set(TIDE.dark);
    this.ribbon.shed = 16;
    this.ribbon.drops.splash = false; // the hit spray carries the splash rings
    this.group.add(this.pool.mesh, this.ribbon.mesh, this.crown.mesh, this.drops.mesh, this.pop.mesh, this.groundShock.mesh);
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
    const fwd = this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const right = this.v2.set(-Math.cos(ctx.aim), 0, Math.sin(ctx.aim));
    this.wrist.copy(ctx.from).addScaledVector(right, 0.45).addScaledVector(fwd, 0.25).setY(1.1);
    this.hit.copy(this.feet).setY(1.0);
    // The line ends on the near side of the wrap; the wrap is a helix of 1.15 turns around the target.
    this.ang0 = Math.atan2(ctx.from.z - this.feet.z, ctx.from.x - this.feet.x);
    this.p0.set(this.feet.x + Math.cos(this.ang0) * WRAP_R, 0.45, this.feet.z + Math.sin(this.ang0) * WRAP_R);
    const lineLen = this.wrist.distanceTo(this.p0) * 1.12;
    this.split = lineLen / (lineLen + 4.2);
    this.side.set(-(this.p0.z - this.wrist.z), 0, this.p0.x - this.wrist.x).normalize();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.hit);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.impacted = this.flags.drained = this.flags.ring2 = false;
    clearScreenFx(this.screen);
    this.ribbon.reset();
    this.drops.reset();
    this.crown.reset();
    this.pool.reset();
    this.pop.set(this.hit, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  /** The whip path: a curling S from the wrist to the target's near side, then one turn up around the target. */
  private path = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const a = this.split;
    if (u < a) {
      const w = u / a;
      out.lerpVectors(this.wrist, this.p0, w);
      const wave = Math.sin(w * Math.PI * 2) * 0.9 * (1 - 0.5 * w);
      out.addScaledVector(this.side, wave);
      out.y += Math.sin(w * Math.PI) * 1.0;
      // The first curl at the wrist.
      if (w < 0.14) {
        const phi = (w / 0.14) * Math.PI * 2;
        const e = Math.sin((w / 0.14) * Math.PI);
        out.addScaledVector(this.side, Math.sin(phi) * 0.4 * e);
        out.y += (1 - Math.cos(phi)) * 0.3 * e;
      }
      return out;
    }
    const s = (u - a) / (1 - a);
    const ang = this.ang0 + s * Math.PI * 2 * 1.15;
    const r = WRAP_R * (1 - 0.12 * s);
    return out.set(this.feet.x + Math.cos(ang) * r, 0.45 + s * 1.2, this.feet.z + Math.sin(ang) * r);
  };

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.ribbon.update(dt);
    this.drops.update(dt);
    this.crown.update(dt);
    this.pool.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.impacted && t >= IMPACT_T) {
      f.impacted = true;
      this.crown.burst(this.feet, 1.05);
      this.pool.spread(this.feet, 1.8, 0.25);
      this.drops.spray(this.v1.copy(this.hit), this.v2.set(0, 1, 0), 10, 5.5);
      this.shake = 0.18;
      if (ctx && ctx.targets[0]) {
        ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 0, pull: this.settings.pull, from: ctx.from, color: TIDE_CSS.body });
      }
    }
    if (f.impacted && !f.ring2 && t >= IMPACT_T + 0.12) {
      f.ring2 = true;
      this.pool.ripple(this.feet);
    }
    if (f.impacted && !f.drained && t >= 0.7) {
      f.drained = true;
      this.pool.drain(0.7);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const after = t - IMPACT_T;

    this.screen.darken = 0.16 * smoothstep((t - 0.1) / 0.3) * (1 - smoothstep((t - 0.9) / 0.5));
    this.screen.impact = impactFrameAt(t, IMPACT_T, [1], 0.03);

    // The ribbon: unrolls and lashes to the target by the hit, closes its wrap, then falls apart from the tail.
    const a = this.split;
    const run = THREE.MathUtils.clamp((t - CAST_T) / (IMPACT_T - CAST_T), 0, 1);
    const eio = run < 0.5 ? 4 * run * run * run : 1 - Math.pow(-2 * run + 2, 3) / 2;
    let head = a * eio;
    if (t >= IMPACT_T) head = a + (1 - a) * (1 - Math.pow(1 - THREE.MathUtils.clamp((t - IMPACT_T) / (WRAP_END_T - IMPACT_T), 0, 1), 3));
    const fall = THREE.MathUtils.clamp((t - FALL_T) / (OUT_T - FALL_T), 0, 1);
    const tail = 0.97 * fall * fall;
    const width = WIDTH * (1 - 0.45 * fall);
    this.ribbon.shed = t >= FALL_T ? 40 : 16;
    this.ribbon.setFunction(this.path, width, Math.max(head, 0.02), tail, t);
    if (t >= OUT_T) this.ribbon.hide();

    if (this.flags.impacted) {
      const sp = StarBurst.pop(after, 0, 0.02);
      this.pop.set(this.hit, 0.9 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 1.8 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = 0.18 * Math.exp(-after * 14);
    }
  }
}

export const tideWhipModule: EffectModule = {
  label: 'tide whip',
  category: 'hero: tide',
  targeting: { mode: 'enemy' },
  create: () => new TideWhip(),
  telegraphs(effect) {
    const e = effect as TideWhip;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.1, impact: IMPACT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TideWhip;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as TideWhip).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'pull', 0, 4, 0.5);
  },
};
