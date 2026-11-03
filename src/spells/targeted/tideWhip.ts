import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Droplets, SplashCrown, TIDE, TIDE_CSS, WaterPool, WaterRibbon } from '../../effects/parts/tide';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Tide Whip (tide kit, Q: a 10 m line skillshot hook). She spins and a thick water ribbon unrolls from her wrist and
 * lashes down the aim line (`ctx.projectile`, the first enemy it touches is hit, dodged by stepping off the line). On a
 * hit the ribbon wraps the target once and drags it 3.5 m toward her (`pull`, the bolt's start is the pull point),
 * bursting into a foam crown with a coral pop. A miss snaps the ribbon back. It then falls as droplets and the pool
 * drains. See pipeline/designs/kit-tide.md, kit-shapes-v3.md.
 */
export interface TideWhipSettings {
  damage: number;
  /** Metres the hit drags the target toward her (engine cap 4). */
  pull: number;
  loop: boolean;
}

export const defaultTideWhip = (): TideWhipSettings => ({ damage: 55, pull: 3.5, loop: false });

// Timeline (seconds). The throw is fixed; the hit (or the miss) moves the rest.
const THROW_T = 0.22; // the ribbon lashes out and the bolt is fired
const RANGE = 10;
const SPEED = 30;
const RADIUS = 0.5;
const FLIGHT_END = THROW_T + RANGE / SPEED;
const WRAP_S = 0.27; // seconds the ribbon takes to close its turn around the target
const FALL_S = 0.3; // after the hit the ribbon starts to fall apart
const OUT_S = 0.75; // after the hit the ribbon is gone
const RETRACT_S = 0.3; // a miss: seconds the ribbon takes to snap back
const DURATION = 2.1;

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
  private fwd = new THREE.Vector3(0, 0, -1);
  private tip = new THREE.Vector3();
  private victim: Enemy | null = null;
  private p0 = new THREE.Vector3();
  private side = new THREE.Vector3(1, 0, 0);
  private ang0 = 0;
  private split = 0.7;

  private flags = { fired: false, impacted: false, ended: false, drained: false, ring2: false };
  private bolt: Projectile | null = null;
  /** Time of the hit / of the miss (-1 until then). */
  private hitT = -1;
  private missT = -1;
  private wrapping = false;

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
    const right = this.v2.set(-Math.cos(ctx.aim), 0, Math.sin(ctx.aim));
    this.wrist.copy(ctx.from).addScaledVector(right, 0.45).addScaledVector(this.fwd, 0.25).setY(1.1);
    this.feet.copy(ctx.from).addScaledVector(this.fwd, RANGE).setY(0);
    this.hit.copy(this.feet).setY(1.0);
    this.tip.copy(this.wrist);
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
    this.bolt = null;
    this.victim = null;
    this.hitT = this.missT = -1;
    this.wrapping = false;
    const f = this.flags;
    f.fired = f.impacted = f.ended = f.drained = f.ring2 = false;
    clearScreenFx(this.screen);
    this.ribbon.reset();
    this.drops.reset();
    this.crown.reset();
    this.pool.reset();
    this.pop.set(this.hit, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  /** Fixes the wrap geometry to the target's live position: the line ends on its near side, then one turn up around it. */
  private aimWrap(at: THREE.Vector3) {
    this.feet.set(at.x, 0, at.z);
    this.hit.set(at.x, 1.0, at.z);
    // The wrap is a helix of 1.15 turns around the target.
    this.ang0 = Math.atan2(this.from.z - this.feet.z, this.from.x - this.feet.x);
    this.p0.set(this.feet.x + Math.cos(this.ang0) * WRAP_R, 0.45, this.feet.z + Math.sin(this.ang0) * WRAP_R);
    const lineLen = this.wrist.distanceTo(this.p0) * 1.12;
    this.split = lineLen / (lineLen + 4.2);
    this.side.set(-(this.p0.z - this.wrist.z), 0, this.p0.x - this.wrist.x).normalize();
  }

  /**
   * The ribbon's path. In flight (and on a miss) a curling S from the wrist to the bolt's head; after a hit the same
   * curl to the target's near side, then one turn up around the target.
   */
  private path = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    if (!this.wrapping) {
      out.lerpVectors(this.wrist, this.tip, u);
      const len = this.wrist.distanceTo(this.tip);
      out.addScaledVector(this.side, Math.sin(u * Math.PI * 2) * Math.min(0.9, len * 0.12) * (1 - 0.5 * u));
      out.y += Math.sin(u * Math.PI) * Math.min(0.8, len * 0.08);
      return out;
    }
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

    if (!f.fired && t >= THROW_T) {
      f.fired = true;
      // Without `projectile` (no bolt flies) the ribbon just lashes to max range and snaps back.
      if (ctx?.projectile) {
        this.v1.copy(this.from).addScaledVector(this.fwd, 0.55);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.fwd.clone(), speed: SPEED, range: RANGE, radius: RADIUS,
          // The engine pulls toward the bolt's start (the caster) and the knock stays off, so it is a clean drag.
          hit: { damage: this.settings.damage, knock: 0, pull: this.settings.pull, color: TIDE_CSS.body },
        });
        this.bolt.onHit((target, at) => this.latch(target, at, this.time));
      }
    }
    if (f.fired && !f.impacted && !f.ended) {
      const b = this.bolt;
      if (b ? !b.alive : t >= FLIGHT_END) {
        // The bolt ended without a body: the ribbon snaps back from where it stopped.
        f.ended = true;
        this.missT = t;
        if (b) this.tip.set(b.pos.x, BOLT_HEIGHT, b.pos.z);
        else this.tip.copy(this.wrist).addScaledVector(this.fwd, RANGE);
        this.drops.spray(this.v1.copy(this.tip).setY(0.3), this.v2.set(0, 1, 0), 5, 3);
      }
    }
    if (f.impacted && !f.ring2 && t >= this.hitT + 0.12) {
      f.ring2 = true;
      this.pool.ripple(this.feet);
    }
    if (f.impacted && !f.drained && t >= this.hitT + 0.45) {
      f.drained = true;
      this.pool.drain(0.7);
    }

    this.layout();
  }

  /** The hook catches `target`: foam crown, spray and the wrap begin (the damage and the pull are the bolt's hit). */
  private latch(target: Enemy, at: THREE.Vector3, t: number) {
    const f = this.flags;
    if (f.impacted) return;
    f.impacted = true;
    this.hitT = t;
    this.victim = target;
    this.wrapping = true;
    this.aimWrap(at);
    this.screen.focus.copy(this.hit);
    this.crown.burst(this.feet, 1.05);
    this.pool.spread(this.feet, 1.8, 0.25);
    this.drops.spray(this.v1.copy(this.hit), this.v2.set(0, 1, 0), 10, 5.5);
    this.shake = 0.18;
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const after = f.impacted ? t - this.hitT : -1;

    this.screen.darken = 0.16 * smoothstep((t - 0.1) / 0.3) * (1 - smoothstep((t - 0.9) / 0.5));
    this.screen.impact = f.impacted ? impactFrameAt(t, this.hitT, [1], 0.03) : 0;

    // Before the throw she spins and a curl of water unrolls from the wrist; in flight the ribbon runs from the wrist
    // to the bolt's head (the straight line without a bolt).
    if (!f.impacted && !f.ended) {
      if (t < THROW_T) {
        const pu = smoothstep(t / THROW_T);
        this.tip.copy(this.wrist).addScaledVector(this.fwd, 0.9 * pu).add(this.v1.set(0, 0.15 * pu, 0));
      } else if (this.bolt) {
        this.tip.set(this.bolt.pos.x, BOLT_HEIGHT, this.bolt.pos.z);
      } else {
        this.tip.copy(this.wrist).addScaledVector(this.fwd, Math.min(RANGE, (t - THROW_T) * SPEED));
      }
    }

    if (f.impacted && this.victim) {
      // The wrap follows the target as it is dragged in.
      this.aimWrap(this.victim.group.position);
    } else {
      this.side.set(-(this.tip.z - this.wrist.z), 0, this.tip.x - this.wrist.x);
      if (this.side.lengthSq() < 1e-6) this.side.set(1, 0, 0);
      this.side.normalize();
    }

    let head = t < THROW_T ? smoothstep(t / THROW_T) : 1;
    let tail = 0;
    let width = WIDTH;
    let gone = false;
    if (f.impacted) {
      // The line reaches the target, closes its wrap, then the ribbon falls apart from the tail.
      const a = this.split;
      head = a + (1 - a) * (1 - Math.pow(1 - THREE.MathUtils.clamp(after / WRAP_S, 0, 1), 3));
      const fall = THREE.MathUtils.clamp((after - FALL_S) / (OUT_S - FALL_S), 0, 1);
      tail = 0.97 * fall * fall;
      width = WIDTH * (1 - 0.45 * fall);
      this.ribbon.shed = after >= FALL_S ? 40 : 16;
      gone = after >= OUT_S;
    } else if (f.ended) {
      const back = THREE.MathUtils.clamp((t - this.missT) / RETRACT_S, 0, 1);
      tail = 0.97 * back * back;
      width = WIDTH * (1 - 0.4 * back);
      gone = back >= 1;
    }
    if (gone) this.ribbon.hide();
    else this.ribbon.setFunction(this.path, width, Math.max(head, 0.02), tail, t);

    if (f.impacted) {
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
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new TideWhip(),
  telegraphs(effect) {
    const e = effect as TideWhip;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Armed at the throw, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * RANGE, z2: ctx.from.z + d.z * RANGE, width: RADIUS * 2 },
      start: 0.1, impact: THROW_T, until: e.flightEnd,
    }];
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
