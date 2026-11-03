import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Droplets, SplashCrown, TIDE, TIDE_CSS, WaterPool } from '../../effects/parts/tide';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Bubble Prison (tide kit, W: a slow 9 m bubble skillshot, a control). Marin cups her hands and blows a bubble of water
 * that drifts down the aim line (`ctx.projectile`, 11 m/s, the first enemy it touches is hit, dodged by stepping off
 * the line). It swallows the target: the bubble swells round it and the target floats inside for 0.8 s (knock-up) while
 * it drifts 2 m toward her. Then the bubble pops into a foam crown. A bubble that hits nothing pops at the end of its
 * range. See pipeline/designs/kit-tide.md, kit-shapes-v3.md.
 */
export interface BubblePrisonSettings {
  damage: number;
  /** Seconds the target floats (knock-up, engine cap 0.8). */
  float: number;
  /** Metres the target drifts toward her (engine cap 4). */
  pull: number;
  loop: boolean;
}

export const defaultBubblePrison = (): BubblePrisonSettings => ({ damage: 30, float: 0.8, pull: 2, loop: false });

// Timeline (seconds).
const BLOW_T = 0.32; // the bubble is blown and released
const RANGE = 9;
const SPEED = 11;
const RADIUS = 0.6;
const FLIGHT_END = BLOW_T + RANGE / SPEED;
const SWELL_S = 0.18; // seconds the bubble takes to swell round a target
const DURATION = FLIGHT_END + 1.6;

const SMALL = 0.38; // flying bubble radius
const BIG = 1.05; // prison bubble radius

let sphereGeo: THREE.SphereGeometry | undefined;

/** A soft water bubble: a pale translucent shell, a blue back-face rim and a white glint, radius 1 at scale 1. */
class BubbleMesh {
  readonly group = new THREE.Group();

  constructor() {
    sphereGeo ??= new THREE.SphereGeometry(1, 20, 14);
    const mat = (color: number, opacity: number, side: THREE.Side) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side, depthWrite: false });
    const shell = new THREE.Mesh(sphereGeo, mat(TIDE.hot, 0.2, THREE.FrontSide));
    const rim = new THREE.Mesh(sphereGeo, mat(TIDE.body, 0.4, THREE.BackSide));
    rim.scale.setScalar(1.04);
    const glint = new THREE.Mesh(sphereGeo, mat(TIDE.core, 0.75, THREE.FrontSide));
    glint.scale.set(0.2, 0.12, 0.1);
    glint.position.set(-0.4, 0.55, 0.55);
    glint.rotation.z = 0.5;
    const glint2 = new THREE.Mesh(sphereGeo, mat(TIDE.foam, 0.5, THREE.FrontSide));
    glint2.scale.setScalar(0.06);
    glint2.position.set(0.5, -0.4, 0.5);
    for (const m of [shell, rim, glint, glint2]) m.renderOrder = 6;
    this.group.add(shell, rim, glint, glint2);
    this.group.visible = false;
  }

  /** Centre, radius and a wobble (0..1) that squashes it a little. */
  set(pos: THREE.Vector3, radius: number, wobble = 0, time = 0) {
    if (radius <= 1e-3) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.group.position.copy(pos);
    const w = Math.sin(time * 14) * 0.07 * wobble;
    this.group.scale.set(radius * (1 + w), radius * (1 - w), radius * (1 + w));
  }

  hide() {
    this.group.visible = false;
  }
}

export class BubblePrison implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BubblePrisonSettings;
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
  private hands = new THREE.Vector3(0, 1.1, 13.5);
  private feet = new THREE.Vector3(0, 0, 6);
  private center = new THREE.Vector3(0, 1.1, 6);

  private flags = { fired: false, ended: false, popped: false, shed: false };
  private bolt: Projectile | null = null;
  private victim: Enemy | null = null;
  /** Time of the hit (-1 until then) and of the pop (-1 until then). */
  private hitT = -1;
  private popT = -1;

  // Parts.
  private bubble = new BubbleMesh();
  private drops = new Droplets(40);
  private crown = new SplashCrown();
  private pool = new WaterPool();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: TIDE.accent, core: 0xfff2e8, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BubblePrisonSettings = defaultBubblePrison()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.hot);
    this.screen.tint.set(TIDE.dark);
    this.group.add(this.pool.mesh, this.bubble.group, this.crown.mesh, this.drops.mesh, this.pop.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return BLOW_T;
  }

  /** Seconds until the bubble has drifted its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hands.copy(ctx.from).addScaledVector(this.fwd, 0.6).setY(1.15);
    this.feet.copy(ctx.from).addScaledVector(this.fwd, RANGE).setY(0);
    this.center.copy(this.feet).setY(BOLT_HEIGHT);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center);
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
    this.hitT = this.popT = -1;
    const f = this.flags;
    f.fired = f.ended = f.popped = f.shed = false;
    clearScreenFx(this.screen);
    this.bubble.hide();
    this.drops.reset();
    this.crown.reset();
    this.pool.reset();
    this.pop.set(this.center, 0, 0);
    this.groundShock.set(this.feet, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
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

    if (!f.fired && t >= BLOW_T) {
      f.fired = true;
      // Without `projectile` (no bolt flies) the bubble just drifts to max range and pops.
      if (ctx?.projectile) {
        this.v1.copy(this.from).addScaledVector(this.fwd, 0.6);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.fwd.clone(), speed: SPEED, range: RANGE, radius: RADIUS,
          // Floats for the knock-up and drifts toward the bolt's start (the caster): the knock stays off.
          hit: {
            damage: this.settings.damage, knock: 0, pull: this.settings.pull, color: TIDE_CSS.body,
            status: { kind: 'knockup', seconds: this.settings.float },
          },
        });
        this.bolt.onHit((target, at) => this.swallow(target, at, this.time));
      }
    }
    if (f.fired && this.hitT < 0 && !f.ended) {
      const b = this.bolt;
      if (b ? !b.alive : t >= FLIGHT_END) {
        // The bubble ended in the open (or on a pillar): it pops where it stopped.
        f.ended = true;
        if (b) this.center.set(b.pos.x, BOLT_HEIGHT, b.pos.z);
        else this.center.copy(this.hands).addScaledVector(this.fwd, RANGE).setY(BOLT_HEIGHT);
        this.feet.set(this.center.x, 0, this.center.z);
        this.burst(t, 0.7);
      }
    }
    if (this.hitT >= 0 && !f.popped && t >= this.hitT + this.settings.float) this.burst(t, 1.1);

    this.layout(t);
  }

  /** The bubble swells round `target` and the hit lands (damage, knock-up and drift are the bolt's hit). */
  private swallow(target: Enemy, at: THREE.Vector3, t: number) {
    if (this.hitT >= 0) return;
    this.hitT = t;
    this.victim = target;
    this.feet.set(at.x, 0, at.z);
    this.center.set(at.x, BOLT_HEIGHT, at.z);
    this.screen.focus.copy(this.center);
    this.pool.spread(this.feet, 1.4, 0.2);
    this.drops.spray(this.v1.copy(this.center), this.v2.set(0, 1, 0), 8, 4);
    this.shake = 0.1;
  }

  /** The pop: foam crown, spray, a ring on the floor. */
  private burst(t: number, size: number) {
    const f = this.flags;
    if (f.popped) return;
    f.popped = true;
    this.popT = t;
    if (this.victim) this.feet.set(this.victim.group.position.x, 0, this.victim.group.position.z);
    this.crown.burst(this.feet, size);
    this.pool.ripple(this.feet);
    this.pool.drain(0.6);
    this.drops.spray(this.v1.copy(this.center), this.v2.set(0, 1, 0), 14, 6);
    this.shake = Math.max(this.shake, 0.12);
  }

  private layout(t: number) {
    const f = this.flags;
    const after = this.popT >= 0 ? t - this.popT : -1;

    this.screen.impact = this.hitT >= 0 ? impactFrameAt(t, this.hitT, [1], 0.03) : 0;

    if (after >= 0) {
      this.bubble.hide();
    } else if (this.hitT >= 0 && this.victim) {
      // The prison: it swells round the target and rides it up and in.
      const p = this.victim.group.position;
      this.center.set(p.x, p.y + BOLT_HEIGHT, p.z);
      const k = smoothstep((t - this.hitT) / SWELL_S);
      this.bubble.set(this.center, SMALL + (BIG - SMALL) * k, 1, t);
      this.pop.set(this.center, 0, 0);
    } else if (t < BLOW_T) {
      // Blown: the bubble swells between her cupped hands.
      this.bubble.set(this.hands, SMALL * smoothstep(t / BLOW_T), 0.5, t);
    } else if (!f.ended) {
      // Drifting, wobbling, shedding a droplet now and then.
      const b = this.bolt;
      if (b) this.center.set(b.pos.x, BOLT_HEIGHT + Math.sin(t * 6) * 0.06, b.pos.z);
      else this.center.copy(this.hands).addScaledVector(this.fwd, Math.min(RANGE, (t - BLOW_T) * SPEED)).setY(BOLT_HEIGHT);
      this.bubble.set(this.center, SMALL, 1, t);
      if (Math.random() < 0.18) {
        this.v1.copy(this.fwd).multiplyScalar(-0.5).setY(0.4);
        this.drops.drop(this.center, this.v1, 0.5, 0.08);
      }
    } else {
      this.bubble.hide();
    }

    if (after >= 0) {
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.center, (this.hitT >= 0 ? 1.1 : 0.7) * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.3, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 1.6 * gp, 0.025 * (1 - gp) * (1 - gp));
      this.shake = 0.12 * Math.exp(-after * 14);
    }
  }
}

export const bubblePrisonModule: EffectModule = {
  label: 'bubble prison',
  category: 'hero: tide',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new BubblePrison(),
  telegraphs(effect) {
    const e = effect as BubblePrison;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Armed at the blow, then shown until the bubble has passed; a bolt's hit is the dodge check, not the zone.
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * RANGE, z2: ctx.from.z + d.z * RANGE, width: RADIUS * 2 },
      start: 0.1, impact: BLOW_T, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BubblePrison;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as BubblePrison).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'float', 0.2, 0.8, 0.1);
    f.add(s, 'pull', 0, 4, 0.5);
  },
};
