import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Afterimage, CHRONO, CHRONO_CSS, Dial, Hand } from '../../effects/parts/chrono';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Second Hand (chrono kit, Q: BOOMERANG). A small dial flicks open at Tempo's staff tip and the red second hand snaps
 * off it (0..0.2). At 0.2 it leaves as a piercing bolt (`ctx.projectile`) that flies 10 m, hangs a beat and spins back
 * to where he stands (a second piercing bolt), hitting every enemy once on each leg: a spinning red clock hand with a chartreuse
 * counter-hand, two pale afterimages trailing. Every hit slows the target and flashes a tiny dial (radius 0.6) on it that
 * ticks backward once, with a small red accent. When it is back the hands fade. Clean by 2.2 s. See pipeline/designs/kit-chrono.md.
 */
export interface SecondHandSettings {
  damage: number;
  knock: number;
  slowSeconds: number;
}

/** `damage` is per leg (an enemy hit on both legs takes it twice). */
export const defaultSecondHand = (): SecondHandSettings => ({ damage: 35, knock: 1, slowSeconds: 1.0 });

// Timeline (seconds).
const FIRE_T = 0.2; // the second hand leaves
const DURATION = 2.2;
const HANG = 0.15; // the hand hangs at the far end before it turns back

const RANGE = 10;
const SPEED = 22;
const RADIUS = 0.45;
/** The bolt starts this far in front of the caster's feet (about his staff). */
const MUZZLE = 0.8;
const FLIGHT_END = FIRE_T + (2 * RANGE) / SPEED + HANG;
const SPIN = 14; // rad/s
const HIT_DIALS = 3;

export class SecondHand implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SecondHandSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's line, caster to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private flags = { opened: false, fired: false, ended: false };
  private bolt: Projectile | null = null;
  /** Boomerang leg: 0 out, 1 hanging at the far end, 2 back. */
  private leg: 0 | 1 | 2 = 0;
  private hangT = 0;
  private turn = new THREE.Vector3();
  private spin = 0;
  private endT = -1;

  // Cast geometry.
  private dir = new THREE.Vector3(0, 0, -1);
  private c0 = new THREE.Vector3(0.5, 1.15, 13);
  private facing = new THREE.Vector3(0, 0.25, 1).normalize();

  // Parts.
  private tip = new Dial({ face: 'dark', marks: 'ticks', hands: false, order: 9 });
  private red = new Hand(CHRONO.accent, 0.05);
  private lime = new Hand(CHRONO.body, 0.05);
  private rig = new THREE.Group();
  private ghosts = new Afterimage(2);
  private hitDials = Array.from({ length: HIT_DIALS }, () => new Dial({ face: 'dark', marks: 'ticks', order: 9 }));
  private hitAge = new Array<number>(HIT_DIALS).fill(-1);
  private hitStep = new Array<boolean>(HIT_DIALS).fill(false);
  private hitCursor = 0;
  private stars = [0, 1].map(() => new StarBurst({ points: 8, inner: 0.3, color: CHRONO.accent, core: 0xfff0e0, additive: false }));
  private starAge = [-1, -1];
  private starPos = [new THREE.Vector3(), new THREE.Vector3()];
  private starCursor = 0;

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private ground = new THREE.Vector3(0, 0, -1);

  constructor(settings: SecondHandSettings = defaultSecondHand()) {
    this.settings = settings;
    this.rig.add(this.lime.group, this.red.group);
    this.group.add(
      this.tip.group, this.rig, this.ghosts.group, ...this.hitDials.map((d) => d.group), ...this.stars.map((s) => s.mesh),
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FIRE_T;
  }

  /** Seconds until the bolt has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const right = this.v1.set(-Math.cos(ctx.aim), 0, Math.sin(ctx.aim));
    // The dial opens at the staff tip beside him, at shoulder height.
    this.c0.copy(ctx.from).addScaledVector(right, 0.55).addScaledVector(this.dir, 0.6).setY(1.3);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.dir.x * RANGE, z2: ctx.from.z + this.dir.z * RANGE,
      width: RADIUS * 2,
    };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.spin = 0;
    this.endT = -1;
    this.bolt = null;
    this.leg = 0;
    this.hangT = 0;
    this.flags.opened = this.flags.fired = this.flags.ended = false;
    this.hitAge.fill(-1);
    this.hitStep.fill(false);
    this.starAge[0] = this.starAge[1] = -1;
    this.tip.reset();
    this.red.hide();
    this.lime.hide();
    this.red.alpha = this.lime.alpha = 1;
    this.ghosts.reset();
    for (const d of this.hitDials) d.reset();
    for (const s of this.stars) s.set(this.c0, 0, 0);
  }

  /** Fires one leg of the boomerang from `from` along `dir` for `range` metres, piercing; each enemy is hit once per leg. */
  private launch(from: THREE.Vector3, dir: THREE.Vector3, range: number): Projectile | null {
    const ctx = this.ctx;
    if (!ctx?.projectile) return null;
    const p = ctx.projectile({
      from: from.clone().setY(0), dir: dir.clone(), speed: SPEED, range, radius: RADIUS, pierce: true,
      hit: {
        damage: this.settings.damage, knock: this.settings.knock, color: CHRONO_CSS.body,
        status: { kind: 'slow', seconds: this.settings.slowSeconds },
      },
    });
    p.onHit((_target, at) => this.hitFx(at));
    return p;
  }

  private finishFlight() {
    this.flags.ended = true;
    this.endT = 0;
    this.ghosts.fade(0.2);
  }

  /** A hit: a tiny dial on the target that ticks backward once, and a small red accent. */
  private hitFx(at: THREE.Vector3) {
    this.v2.set(at.x, 1.2, at.z);
    const i = this.hitCursor;
    this.hitCursor = (this.hitCursor + 1) % HIT_DIALS;
    this.hitDials[i].show(this.v2, 0.6, this.facing, 0.08);
    this.hitAge[i] = 0;
    this.hitStep[i] = false;
    this.starPos[this.starCursor].set(at.x, BOLT_HEIGHT, at.z);
    this.starAge[this.starCursor] = 0;
    this.starCursor = (this.starCursor + 1) % this.stars.length;
    this.shake = Math.max(this.shake, 0.12);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.tip.update(dt);
    this.red.update(dt);
    this.lime.update(dt);
    this.ghosts.update(dt);
    for (const d of this.hitDials) d.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.reset();
      this.playing = false;
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // --- 0..0.2: a small dial flicks open at the staff tip and the red second hand snaps off it. ---
    if (!f.opened) {
      f.opened = true;
      this.tip.show(this.c0, 0.55, this.facing, 0.1);
      this.red.orient(this.up, this.facing);
      this.v1.copy(this.c0).addScaledVector(this.facing, 0.05);
      this.red.set(this.v1, -1.6, 0.8, 0.16);
      this.red.sweep(-1.6, 0.1, FIRE_T - 0.02, 0, 'out');
      this.red.color = CHRONO.accent;
    }

    if (!f.fired && t >= FIRE_T) {
      f.fired = true;
      this.tip.hide(0.15);
      this.red.stop();
      // The hand lies flat now and spins on the bolt. A network duel has no bolts (the context leaves `projectile` out).
      this.red.orient(this.ground, this.up);
      this.lime.orient(this.ground, this.up);
      this.v1.copy(this.c0).setY(BOLT_HEIGHT);
      this.red.set(this.v1, this.spin, 1.3, 0.34);
      this.lime.set(this.v1, this.spin + 2.4, 0.85, 0.26);
      this.ghosts.trail(this.rig, 2, 0.045);
      if (ctx?.projectile) {
        this.v1.copy(ctx.from).addScaledVector(this.dir, MUZZLE);
        this.bolt = this.launch(this.v1, this.dir, RANGE);
      }
    }

    if (f.fired && !f.ended) {
      const b = this.bolt;
      this.spin += dt * SPIN;
      if (this.leg === 1) {
        // Hanging at the far end: the hand keeps spinning in place, then the return bolt leaves for the caster.
        this.hangT += dt;
        this.v1.copy(this.turn);
        this.red.set(this.v1, this.spin, 1.3, 0.34);
        this.lime.set(this.v1, this.spin + 2.4, 0.85, 0.26);
        if (this.hangT >= HANG) {
          const home = ctx?.caster.group.position;
          const dx = home ? home.x - this.turn.x : 0, dz = home ? home.z - this.turn.z : 0;
          const dist = Math.hypot(dx, dz);
          if (ctx?.projectile && dist > 1) {
            this.v2.set(dx / dist, 0, dz / dist);
            this.bolt = this.launch(this.turn, this.v2, dist);
            this.leg = 2;
          } else {
            this.leg = 2;
            this.bolt = null;
            this.finishFlight();
          }
        }
      } else if (b && b.alive) {
        // The hand rides the bolt; the first few hundredths glide in from the staff tip.
        const k = Math.min(1, (t - FIRE_T) / 0.08);
        this.v1.set(b.pos.x, BOLT_HEIGHT, b.pos.z);
        this.v1.lerp(this.c0, (1 - k) * (1 - k));
        this.red.set(this.v1, this.spin, 1.3, 0.34);
        this.lime.set(this.v1, this.spin + 2.4, 0.85, 0.26);
        this.rig.visible = true;
      } else if (b && this.leg === 0) {
        // Max range (or a pillar): the hand turns on the spot after a short hang.
        this.leg = 1;
        this.hangT = 0;
        this.turn.set(b.pos.x, BOLT_HEIGHT, b.pos.z);
      } else if (b || t >= FIRE_T + 0.1) {
        // Back at the caster: the hands slow, fade and are gone.
        this.finishFlight();
      }
    }
    if (f.ended && this.endT >= 0) {
      this.endT += dt;
      const k = 1 - Math.min(1, this.endT / 0.18);
      this.spin += dt * SPIN * k * 0.5;
      this.red.alpha = this.lime.alpha = k;
      this.red.setAngle(this.spin);
      this.lime.setAngle(this.spin + 2.4);
      if (k <= 0) {
        this.red.hide();
        this.lime.hide();
        this.endT = -1;
      }
    }

    // --- Hit dials: open, tick backward once, fade. ---
    for (let i = 0; i < HIT_DIALS; i++) {
      if (this.hitAge[i] < 0) continue;
      this.hitAge[i] += dt;
      if (!this.hitStep[i] && this.hitAge[i] >= 0.12) {
        this.hitStep[i] = true;
        this.hitDials[i].tickBack();
      }
      if (this.hitAge[i] >= 0.4) {
        this.hitDials[i].hide(0.2);
        this.hitAge[i] = -1;
      }
    }

    for (let i = 0; i < this.stars.length; i++) {
      if (this.starAge[i] < 0) continue;
      const sp = StarBurst.pop(this.starAge[i], 0.03, 0.04);
      this.stars[i].set(this.starPos[i], 0.95 * sp.scale, sp.opacity, 0.2);
      this.starAge[i] += dt;
      if (this.starAge[i] > 0.14) { this.starAge[i] = -1; this.stars[i].set(this.starPos[i], 0, 0); }
    }
    this.shake *= Math.exp(-dt * 14);
  }
}

export const secondHandModule: EffectModule = {
  label: 'second hand',
  category: 'hero: chrono',
  // A boomerang is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SecondHand(),
  telegraphs(effect) {
    const e = effect as SecondHand;
    if (!e.ctx) return [];
    // Armed at the launch, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
    return [{ shape: e.line, start: 0, impact: FIRE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SecondHand;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SecondHand).settings;
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
    f.add(s, 'slowSeconds', 0, 2.5, 0.1);
  },
};
