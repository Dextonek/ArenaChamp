import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Afterimage, CHRONO, CHRONO_CSS, Dial, Flakes, FrozenMotes, Hand } from '../../effects/parts/chrono';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Twelfth Hour (chrono kit, R: FUSE). Under the normal gameplay camera, no letterbox: the world darkens to
 * green-black and a numeral ring traces the radius-7 circle on the ground, ticking. Behind the point a vast ivory clock
 * dial (7 across, about 4 up, chartreuse numerals) rises facing the camera; its two hands sweep fast toward twelve and slow
 * as they near it, afterimages of the hands trailing, a red second hand ticking, motes drifting and enemies drawn a little
 * toward the centre. At 1.6 the minute hand stops one tick short and every mote freezes; dead beat 1.85..2.0; the last tick
 * (2.0..2.2) brings the hands to twelve and the red second hand flies off the dial and drives into the centre. At 2.2: two
 * impact frames, the ring flashes, twelve chartreuse shock lines race out along the numerals, a red star, ground
 * refraction and the hit (no stun). FUSE: the whole build is stretched so the hand strikes 3.5 s after the cast; walk
 * out of the circle or take it. Then the dial cracks into flakes and fades and the dark lifts. Clean by 5.8 s.
 * See pipeline/designs/kit-chrono.md.
 */
export interface TwelfthHourSettings {
  damage: number;
  loop: boolean;
}

export const defaultTwelfthHour = (): TwelfthHourSettings => ({ damage: 135, loop: false });

// Timeline (seconds).
const MARK_END = 0.4; // darkness in, the numeral ring traced
const RISE_T = 0.3; // the clock starts to rise
const FREEZE_T = 2.9; // the minute hand stops one tick short, every mote freezes
const BEAT_T = 3.15; // dead beat 3.15..3.3
const LAST_T = 3.3; // the last tick, the second hand flies
const HIT_T = 3.5; // FUSE: 3.5 s warning, the strike lands inside the duel's 4.2 s window
const CRACK_T = 3.6;
const FLAKE_T = 3.8;
const FLAKE_END = 4.5;
const FADE_T = 4.1;
const DURATION = 5.8;
const RISE_LEN = 1.3; // the dial climbs in 1.3 s, then hangs
const MORE_MOTES = [1.7, 2.1, 2.5];

const RADIUS = 7;
const CLOCK_R = 3.5;
const CLOCK_Y = 4.0; // the dial's centre at rest (its top stays under y 7.6)
const CLOCK_Y0 = -3.7; // buried below the floor at the start
const CLOCK_BACK = 1.5; // behind the point, away from the caster
const TICK_ONE = (Math.PI * 2) / 60;
const MIN_END = Math.PI * 4 - TICK_ONE; // two turns, one tick short of twelve
const HOUR_END = Math.PI * 2 - 0.16;
const SHOCK_LINES = 12;

export class TwelfthHour implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TwelfthHourSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];
  /** Horizontal unit vector from the point toward the caster (the clock faces along it). */
  private lean = new THREE.Vector3(0, 0, 1);
  private clockPos = new THREE.Vector3();

  private flags = {
    ring: false, clock: false, sweep: false, motes1: false, motes2: false, motes3: false, freeze: false, last: false,
    flight: false, hit: false, crack: false, fade: false,
  };
  private flakeT = 0;
  private ringTickOn = false;
  private moteMore = 0;

  // Parts.
  private ring = new Dial({ face: 'ring', marks: 'band', hands: false, spinFace: true, order: 6 });
  private clock = new Dial({ face: 'ivory', marks: 'full', order: 9 });
  private red = new Hand(CHRONO.accent, 0.09);
  private shocks = Array.from({ length: SHOCK_LINES }, () => new Hand(CHRONO.body, 0.07));
  private trailHands = new Afterimage(3);
  private trailRed = new Afterimage(2);
  private motes = new FrozenMotes();
  private flakes = new Flakes(4);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: CHRONO.accent, core: 0xfff0e0, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private redAngle = 0;

  // Scratch.
  private center = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private ground = new THREE.Vector3(0, 0, -1);
  private hp = new THREE.Vector3(0, 0, 0.03);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: TwelfthHourSettings = defaultTwelfthHour()) {
    this.settings = settings;
    this.screen.impactColor.set(CHRONO.hot);
    this.screen.tint.set(CHRONO.dark);
    for (const h of this.shocks) h.orient(this.ground, this.up);
    this.group.add(
      this.ring.group, this.clock.group, this.red.group, ...this.shocks.map((h) => h.group), this.trailHands.group,
      this.trailRed.group, this.motes.mesh, this.flakes.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** Calls `fn` for each enemy standing inside the zone right now (enemies who walked out before the strike are spared). */
  private eachInside(fn: (e: CastContext['targets'][number]) => void) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) fn(e);
    }
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.lean.set(ctx.from.x - this.point.x, 0, ctx.from.z - this.point.z);
    if (this.lean.lengthSq() < 1e-4) this.lean.set(0, 0, 1);
    this.lean.normalize();
    this.clockPos.copy(this.point).addScaledVector(this.lean, -CLOCK_BACK);
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(2);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flakeT = 0;
    this.redAngle = 0;
    this.ringTickOn = false;
    this.moteMore = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(CHRONO.dark);
    this.ring.reset();
    this.clock.reset();
    this.red.hide();
    this.red.alpha = 1;
    for (const h of this.shocks) { h.hide(); h.alpha = 1; }
    this.trailHands.reset();
    this.trailRed.reset();
    this.motes.reset();
    this.flakes.reset();
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  /** The clock's centre height at time `t`. */
  private clockY(t: number) {
    return CLOCK_Y0 + (CLOCK_Y - CLOCK_Y0) * easeOut((t - RISE_T) / RISE_LEN);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.ring.update(dt);
    this.clock.update(dt);
    this.red.update(dt);
    for (const h of this.shocks) h.update(dt);
    this.trailHands.update(dt);
    this.trailRed.update(dt);
    this.motes.update(dt);
    this.flakes.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    // --- 0..0.4: a numeral ring traces the radius-7 circle on the ground, over a dark layer. ---
    if (!f.ring) {
      f.ring = true;
      this.ring.show(this.v1.copy(this.point).setY(0.05), RADIUS, this.up, MARK_END);
    }
    // The ring ticks round while the clock builds, and stops with the minute hand.
    if (t >= 0.3 && t < FREEZE_T && !this.ringTickOn) {
      this.ringTickOn = true;
      this.ring.tick(7);
    }
    if (t >= FREEZE_T && this.ringTickOn) {
      this.ringTickOn = false;
      this.ring.tick(0);
    }

    // --- 0.3: the clock rises behind the point; its hands sweep fast toward twelve, slowing near it. ---
    if (!f.clock && t >= RISE_T) {
      f.clock = true;
      this.v1.set(this.clockPos.x, CLOCK_Y0, this.clockPos.z);
      this.clock.show(this.v1, CLOCK_R, this.lean, 0.9);
      this.clock.hands[0].set(this.hp, 0.4, 0.86, 0.16);
      this.clock.hands[1].set(this.hp, 1.0, 0.6, 0.22);
      this.clock.hands[0].sweep(0.4, MIN_END, FREEZE_T - RISE_T, 0, 'out');
      this.clock.hands[1].sweep(1.0, HOUR_END, FREEZE_T - RISE_T, 0, 'out');
      this.trailHands.trail(this.clock.hands[0].group, 3, 0.05);
      // The red second hand ticks on the dial, in its plane.
      this.red.orient(this.up, this.lean);
    }
    this.center.set(this.clockPos.x, this.clockY(t), this.clockPos.z);
    if (f.clock && t < FADE_T + 1.1) {
      this.v1.copy(this.center);
      // The dial shudders as it cracks.
      if (t >= CRACK_T) {
        const k = Math.exp(-(t - CRACK_T) * 2.5) * 0.06;
        this.v1.x += (Math.random() - 0.5) * k * 2;
        this.v1.y += (Math.random() - 0.5) * k * 2;
      }
      if (this.clock.on) this.clock.place(this.v1, CLOCK_R);
    }
    // Red second hand: ticks round the dial until the dead beat, then flies.
    if (f.clock && !f.flight && t < LAST_T) {
      if (t < FREEZE_T) this.redAngle = Math.floor(t * (6 + 12 * smoothstep(t / FREEZE_T))) * 0.55;
      this.v2.copy(this.center).addScaledVector(this.lean, 0.14);
      this.red.set(this.v2, this.redAngle, CLOCK_R * 0.9, 0.2);
    }

    // --- Motes drift while the clock runs, and stop dead at 1.6. ---
    if (!f.motes1 && t >= 0.45) { f.motes1 = true; this.motes.drift(this.point, RADIUS - 0.5, 14); }
    if (!f.motes2 && t >= 0.9) { f.motes2 = true; this.motes.drift(this.point, RADIUS - 0.5, 14); }
    if (!f.motes3 && t >= 1.3) { f.motes3 = true; this.motes.drift(this.point, RADIUS - 0.5, 12); }
    // The fuse is long: more motes drift in while the clock hangs.
    while (this.moteMore < MORE_MOTES.length && t >= MORE_MOTES[this.moteMore]) {
      this.moteMore++;
      this.motes.drift(this.point, RADIUS - 0.5, 10);
    }
    if (!f.freeze && t >= FREEZE_T) {
      f.freeze = true;
      this.motes.freeze(this.point, RADIUS - 0.5, 4);
      this.trailHands.fade(0.2);
    }

    // --- 2.0..2.2: the last tick. The hands meet at twelve and the red second hand flies off the dial into the centre. ---
    if (!f.last && t >= LAST_T) {
      f.last = true;
      this.clock.hands[0].sweep(MIN_END, Math.PI * 4, HIT_T - LAST_T, 0, 'in');
      this.clock.hands[1].sweep(HOUR_END, Math.PI * 2, HIT_T - LAST_T, 0, 'in');
      this.trailRed.trail(this.red.group, 2, 0.025);
    }
    if (f.last && !f.hit) {
      f.flight = true;
      const k = easeIn((t - LAST_T) / (HIT_T - LAST_T));
      const len = CLOCK_R * 0.9;
      // From the dial's middle to the point on the ground; the blade's tip leads.
      this.v1.copy(this.point).setY(0.25);
      this.v2.subVectors(this.v1, this.center);
      const d = this.v3.copy(this.v2).normalize();
      this.v2.copy(this.center).addScaledVector(this.v1.sub(this.center), k).addScaledVector(d, -len * (1 - k * 0.3));
      this.red.point(this.v2, d, this.lean, len, 0.3);
    }

    // --- 2.2: the strike. ---
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.red.hide();
      this.trailRed.fade(0.15);
      this.ring.flash(1.4);
      this.motes.release(0.7);
      this.shake = Math.max(this.shake, 0.7);
      this.hit();
    }
    const after = t - HIT_T;
    if (f.hit) {
      // Twelve shock lines race out along the numerals.
      const kk = after / 0.4;
      this.shocks.forEach((h, i) => {
        if (kk >= 1) { h.hide(); return; }
        const head = (RADIUS + 0.4) * easeOut(after / 0.3);
        const len = Math.min(2.6, head);
        this.v1.set(this.point.x, 0.14, this.point.z);
        const a = (i / SHOCK_LINES) * Math.PI * 2;
        this.v2.copy(this.v1).add(this.v3.set(Math.sin(a), 0, -Math.cos(a)).multiplyScalar(head - len));
        h.alpha = 1 - smoothstep((after - 0.15) / 0.25);
        h.set(this.v2, a, len, 0.5 - 0.2 * (i % 3) / 2);
      });
    }

    // --- Cracks, then flakes fall from the dial and it fades. ---
    if (!f.crack && t >= CRACK_T) f.crack = true;
    if (f.crack) this.clock.crack(smoothstep((t - CRACK_T) / 0.3));
    if (t >= FLAKE_T && t < FLAKE_END) {
      this.flakeT += dt;
      while (this.flakeT >= 0.025) {
        this.flakeT -= 0.025;
        this.dialPoint(this.v1);
        this.v2.set((Math.random() - 0.5) * 1.6, 0.2 + Math.random() * 0.8, (Math.random() - 0.5) * 1.6).addScaledVector(this.lean, 0.3 + Math.random() * 0.8);
        this.flakes.emit(this.v1, this.v2, 0.38, 1.0);
      }
    }
    if (!f.fade && t >= FADE_T) {
      f.fade = true;
      this.clock.hide(1.0);
      this.ring.hide(0.8);
    }

    this.layout(dt);
  }

  /** A random point on the clock face, in `out`. */
  private dialPoint(out: THREE.Vector3) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * CLOCK_R * 0.95;
    // The face's "three" direction is up x lean.
    this.v3.crossVectors(this.up, this.lean);
    return out.copy(this.center).addScaledVector(this.v3, Math.cos(a) * r).addScaledVector(this.up, Math.sin(a) * r);
  }

  private hit() {
    const ctx = this.ctx, P = this.point;
    this.eachInside((e) => ctx?.hit(e, { damage: this.settings.damage, knock: 3, from: P, color: CHRONO_CSS.body }));
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  private layout(dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    const after = t - HIT_T;
    const f = this.flags;

    // --- Screen: green-black dark, a lift at the strike, lifting away as the dial fades. Impact frames at the hit. ---
    let dk = 0.55 * smoothstep(t / MARK_END) * (1 - smoothstep((t - FADE_T) / 0.9));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The pull on the enemies: in while the clock runs, held through the dead beat, released at the strike. ---
    if (ctx) {
      const pull = 0.4 * smoothstep((Math.min(t, BEAT_T) - RISE_T) / (BEAT_T - RISE_T)) * (1 - smoothstep(after / 0.3));
      for (const v of this.victims) {
        this.v3.set(this.point.x - v.feet.x, 0, this.point.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    // --- The strike: red star at the centre, ground refraction, shake. ---
    if (f.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.5), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * Math.exp(-dt * 9), 0.7 * Math.exp(-after * 9));
    } else this.shake *= Math.exp(-dt * 12);
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeIn = (x: number) => Math.pow(Math.min(1, Math.max(0, x)), 2);

export const twelfthHourModule: EffectModule = {
  label: 'twelfth hour',
  category: 'hero: chrono',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new TwelfthHour(),
  telegraphs(effect) {
    const e = effect as TwelfthHour;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TwelfthHour;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as TwelfthHour).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
