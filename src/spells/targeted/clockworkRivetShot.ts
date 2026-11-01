import * as THREE from 'three';
import { Emitter } from '../../emitter';
import type { Enemy } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { CLOCKWORK, CLOCKWORK_CSS, Gear, Rivet, Sparks, Spring } from '../../effects/parts/clockwork';
import type { Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Rivet Shot (clockwork kit, Q: a skillshot whose rivet sticks; file and label are prefixed because the forge kit owns 'rivet shot').
 * Her wrist launcher's brass spring winds up with a few cyan
 * sparks, then at 0.2 it lets go: a spinning copper rivet flies along the aim line (`ctx.projectile`, no ricochet) with a
 * cyan spark trail. The first hit throws a few small cogs and a spark burst with a two-frame cyan star, slows the enemy,
 * and the rivet STICKS in it: a small blinking copper light and a spinning gear follow the victim for 1.0 s, then it
 * pops with a spark burst for a second hit of 60% damage (`projectile: true`, it cannot be dodged; skipped if the
 * victim is gone). The visual follows the projectile handle. Clean by about 2.5 s.
 * See pipeline/designs/kit-clockwork.md.
 */
export interface RivetShotSettings {
  damage: number;
  knock: number;
  slowSeconds: number;
}

/** Seconds the rivet stays stuck before it pops, and the pop's share of the damage. */
const STICK_T = 1.0;
const POP_FRAC = 0.25;

export const defaultClockworkRivetShot = (): RivetShotSettings => ({ damage: 58, knock: 1, slowSeconds: 1.5 });

const WINDUP = 0.2;
const SPEED = 24;
const RANGE = 12;
const RADIUS = 0.4;
/** The firing point is this far in front of the caster's feet (about her hand). */
const MUZZLE = 0.8;
const SETTLE = 0.35; // seconds the sparks and cogs need after the rivet is gone

export class ClockworkRivetShot implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RivetShotSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's line, caster to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private spin = 0;
  private trailT = 0;
  private sparkT = 0;
  private starAge = 9;
  /** The enemy the rivet is stuck in, and when it pops (effect time). */
  private victim: Enemy | null = null;
  private popAt = -1;
  private blink = 0;

  private dir = new THREE.Vector3(0, 0, 1);
  private wrist = new THREE.Vector3();
  private tip = new THREE.Vector3();

  private rivet = new Rivet();
  private spring = new Spring(6);
  private sparks = new Sparks(40);
  private cogs = new Gear(12);
  private star = new StarBurst({ points: 8, inner: 0.3, color: CLOCKWORK.accent, core: 0xf0fffb, additive: false });
  private starPos = new THREE.Vector3();
  private tick = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshBasicMaterial({ color: CLOCKWORK.body, transparent: true, depthWrite: false }),
  );
  private tickGear = new Gear(1);
  private tickGearOn = false;

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: RivetShotSettings = defaultClockworkRivetShot()) {
    this.settings = settings;
    this.group.add(this.spring.mesh, this.rivet.mesh, this.cogs.mesh, this.sparks.mesh, this.star.mesh, this.tick, this.tickGear.mesh);
    this.tick.visible = false;
    this.reset();
  }

  get duration() {
    return 1.5;
  }

  /** Seconds until the rivet has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return WINDUP + RANGE / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.dir.x * RANGE, z2: ctx.from.z + this.dir.z * RANGE,
      width: RADIUS * 2,
    };
    // The launcher sits on her right wrist, a little ahead and at hand height.
    this.wrist.set(ctx.from.x + this.dir.x * 0.25 + this.dir.z * 0.3, 1.05, ctx.from.z + this.dir.z * 0.25 - this.dir.x * 0.3);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.goneAt = -1;
    this.bolt = null;
    this.spin = 0;
    this.trailT = 0;
    this.sparkT = 0;
    this.starAge = 9;
    this.victim = null;
    this.popAt = -1;
    this.blink = 0;
    this.tick.visible = false;
    this.tickGear.reset();
    this.tickGearOn = false;
    this.rivet.reset();
    this.spring.reset();
    this.sparks.reset();
    this.cogs.reset();
    this.star.set(this.starPos, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.sparks.update(dt);
    this.cogs.update(dt);
    this.tickGear.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Windup: the spring winds up and sparks jump along it; at 0.2 it lets go. ---
    if (t < WINDUP + 0.15) {
      const k = Math.min(t / WINDUP, 1);
      this.tip.copy(this.wrist).addScaledVector(this.dir, 0.55);
      this.spring.set(this.wrist, this.tip, 5, 0.16);
      let stretch = 1 - 0.55 * easeIn(k);
      if (t >= WINDUP) stretch = 1 + 0.7 * Math.sin(Math.min((t - WINDUP) / 0.15, 1) * Math.PI);
      this.spring.stretch(stretch);
      if (t < WINDUP) {
        this.sparkT += dt;
        if (this.sparkT >= 0.05) {
          this.sparkT = 0;
          this.v1.copy(this.wrist).addScaledVector(this.dir, Math.random() * 0.4).setY(1.05 + Math.random() * 0.15);
          this.v2.copy(this.v1).addScaledVector(this.dir, 0.25).setY(this.v1.y + (Math.random() - 0.5) * 0.3);
          this.sparks.arc(this.v1, this.v2, 0.1);
        }
      }
    } else this.spring.hide();

    // --- Fire. A network duel has no bolts (the context leaves `projectile` out): the spell then shows only the windup. ---
    if (!this.fired && t >= WINDUP) {
      this.fired = true;
      if (ctx?.projectile) {
        const from = this.v1.copy(ctx.from).addScaledVector(this.dir, MUZZLE);
        this.bolt = ctx.projectile({
          from, dir: this.dir.clone(), speed: SPEED, range: RANGE, radius: RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: CLOCKWORK_CSS.body, status: { kind: 'slow', seconds: s.slowSeconds } },
        });
        this.bolt.onHit((target, at) => this.onHit(target, at));
        this.shake = 0.05;
      } else this.goneAt = t;
    }

    // --- The rivet follows the handle; a spark trail streams behind it. ---
    const b = this.bolt;
    if (b) {
      if (b.alive) {
        this.spin += dt * 24;
        this.rivet.place(b.pos, b.dir, this.spin);
        this.trailT += dt;
        while (this.trailT >= 0.035) {
          this.trailT -= 0.035;
          this.v1.copy(b.pos).addScaledVector(b.dir, -0.35);
          this.v2.copy(b.pos).addScaledVector(b.dir, -(0.9 + Math.random() * 0.5));
          this.v2.x += (Math.random() - 0.5) * 0.25;
          this.v2.y += (Math.random() - 0.5) * 0.25;
          this.v2.z += (Math.random() - 0.5) * 0.25;
          this.sparks.arc(this.v1, this.v2, 0.12 + Math.random() * 0.06);
        }
      } else {
        this.rivet.hide();
        if (this.goneAt < 0) this.goneAt = t;
      }
    }

    // --- Stuck: a blinking copper light and a small gear follow the victim until the rivet pops. ---
    const v = this.victim;
    if (v) {
      const vp = v.group.position;
      if (!v.group.visible || !v.group.parent) {
        // The victim is gone: the rivet falls away without a second hit.
        this.victim = null;
        this.tick.visible = false;
        this.tickGear.reset();
        this.tickGearOn = false;
      } else if (t < this.popAt) {
        this.blink += dt * (6 + 14 * (1 - (this.popAt - t) / STICK_T));
        this.tick.visible = true;
        this.tick.position.set(vp.x, 1.55, vp.z);
        const mat = this.tick.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.sin(this.blink) > 0 ? 1 : 0.15;
        this.tick.scale.setScalar(1 + 0.4 * (Math.sin(this.blink) > 0 ? 1 : 0));
        if (this.tickGearOn) {
          this.v2.set(vp.x, 1.2, vp.z);
          this.tickGear.move(0, this.v2);
        }
      } else {
        this.victim = null;
        this.tick.visible = false;
        this.tickGear.reset();
        this.tickGearOn = false;
        this.pop(v);
      }
    }

    // --- The hit accent: a small cyan star for two frames. ---
    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0, 0.03);
    this.star.set(this.starPos, 0.9 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 12);

    if (this.goneAt >= 0 && t >= this.goneAt + SETTLE && !this.cogs.busy && !this.victim) {
      this.playing = false;
      this.reset();
    } else if (t >= 4) {
      this.playing = false;
      this.reset();
    }
  }

  /** The rivet pops: sparks burst off the victim and the second hit lands (it is attached, so it cannot be dodged). */
  private pop(v: Enemy) {
    const p = v.group.position;
    this.starPos.set(p.x, 1.2, p.z);
    this.sparks.burst(this.starPos, 12);
    this.starAge = 0;
    this.shake = 0.1;
    this.ctx?.hit(v, { damage: Math.round(this.settings.damage * POP_FRAC), knock: 0, color: CLOCKWORK_CSS.body, projectile: true });
  }

  /** A hit: a few small cogs fly off, cyan sparks burst, the star pops, and the rivet sticks in the victim. */
  private onHit(target: Enemy, at: THREE.Vector3) {
    this.victim = target;
    this.popAt = this.time + STICK_T;
    this.blink = 0;
    this.tickGear.reset();
    this.tickGear.place(this.v1.set(at.x, 1.2, at.z), this.dir, 0.22, 9, { instant: true });
    this.tickGearOn = true;
    this.starPos.set(at.x, 1.1, at.z);
    this.starAge = 0;
    this.sparks.burst(this.starPos, 6);
    this.shake = 0.12;
    for (let i = 0; i < 4; i++) {
      this.v2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      this.cogs.place(this.starPos, this.v2, 0.22 + Math.random() * 0.08, 8, { instant: true });
    }
    this.cogs.scatter(4.5, 0.7, this.starPos);
  }
}

const easeIn = (x: number) => x * x;

export const clockworkRivetShotModule: EffectModule = {
  label: 'clockwork rivet shot',
  category: 'hero: clockwork',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new ClockworkRivetShot(),
  telegraphs(effect) {
    const e = effect as ClockworkRivetShot;
    if (!e.ctx) return [];
    // Armed at the launch, then shown until the rivet has passed; a bolt's hit is the dodge check, not the zone.
    return [{ shape: e.line, start: 0, impact: WINDUP, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ClockworkRivetShot;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ClockworkRivetShot).settings;
    f.add(s, 'damage', 0, 100, 1);
    f.add(s, 'knock', 0, 8, 0.5);
    f.add(s, 'slowSeconds', 0, 2.5, 0.1);
  },
};
