import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Afterimage, CHRONO, CHRONO_CSS, Dial, FrozenMotes } from '../../effects/parts/chrono';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Stopped Moment (chrono kit, W: a ground zone with a stun). A clock dial (radius 3.5) draws itself on the ground, the
 * numerals appearing one by one (0..0.3); both hands sweep toward twelve with the ticking speeding up (0.3..0.7). At
 * 0.75 they meet and the dial freezes: the ticks stop, motes stop dead in the air, a small red accent, and every enemy
 * inside (positions re-checked now) is hit and stunned; a pale afterimage of each victim stays where it was hit. The
 * frozen frame holds to 1.55, then the motes release and the dial fades. Clean by 2.2 s. See pipeline/designs/kit-chrono.md.
 */
export interface StoppedMomentSettings {
  damage: number;
  stunSeconds: number;
  loop: boolean;
}

export const defaultStoppedMoment = (): StoppedMomentSettings => ({ damage: 35, stunSeconds: 0.8, loop: false });

// Timeline (seconds).
const DRAW_END = 0.3; // the numerals are all drawn
const SWEEP_END = 0.7; // the hands are at twelve
const HIT_T = 0.75;
const RELEASE_T = 1.6;
const DURATION = 2.2;

const RADIUS = 3.5;

export class StoppedMoment implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StoppedMomentSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private point = new THREE.Vector3(0, 0, -8);
  private flags = { dial: false, sweep: false, motes2: false, hit: false, release: false };
  private starAge = -1;

  // Parts.
  private dial = new Dial({ face: 'ring', marks: 'full' });
  private motes = new FrozenMotes();
  private echoes = new Afterimage(3);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: CHRONO.accent, core: 0xfff0e0, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: StoppedMomentSettings = defaultStoppedMoment()) {
    this.settings = settings;
    this.group.add(this.dial.group, this.motes.mesh, this.echoes.group, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.starAge = -1;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.dial.reset();
    this.motes.reset();
    this.echoes.reset();
    this.pop.set(this.point, 0, 0);
  }

  /** Calls `fn` for each enemy standing inside the zone right now (enemies who walked out before the moment stopped are spared). */
  private eachInside(fn: (e: CastContext['targets'][number]) => void) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) fn(e);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.dial.update(dt);
    this.motes.update(dt);
    this.echoes.update(dt);
    if (!this.playing) return;
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

    // --- 0..0.3: the dial draws itself on the ground, numeral by numeral. ---
    if (!f.dial) {
      f.dial = true;
      this.dial.show(this.v1.copy(this.point).setY(0.06), RADIUS, this.up, DRAW_END);
      this.dial.hands[0].setAngle(4.2);
      this.dial.hands[1].setAngle(2.6);
      this.motes.drift(this.point, RADIUS - 0.3, 10);
    }

    // --- 0.3..0.7: both hands sweep toward twelve, ticking faster and faster. ---
    if (!f.sweep && t >= DRAW_END) {
      f.sweep = true;
      this.dial.hands[0].sweep(4.2, Math.PI * 2, SWEEP_END - DRAW_END, 12, 'in');
      this.dial.hands[1].sweep(2.6, Math.PI * 2, SWEEP_END - DRAW_END, 8, 'in');
    }
    if (!f.motes2 && t >= 0.5) {
      f.motes2 = true;
      this.motes.drift(this.point, RADIUS - 0.3, 8);
    }

    // --- 0.75: the hands meet at twelve and the dial freezes. ---
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.dial.freeze();
      this.motes.freeze(this.point, RADIUS - 0.3, 6);
      this.starAge = 0;
      this.shake = Math.max(this.shake, 0.2);
      let n = 0;
      this.eachInside((e) => {
        ctx?.hit(e, { damage: this.settings.damage, knock: 0, color: CHRONO_CSS.body, status: { kind: 'stun', seconds: this.settings.stunSeconds } });
        // A pale echo of the victim stays where it was hit, a step to the side so it reads against the figure.
        if (n < 3) this.echoes.stand(n++, this.v1.set(e.group.position.x + 0.3, 0, e.group.position.z), e.group.rotation.y, 0.4);
      });
    }

    // --- 1.6..2.0: the motes release, the dial and the echoes fade. ---
    if (!f.release && t >= RELEASE_T) {
      f.release = true;
      this.motes.release(0.4);
      this.dial.hide(0.4);
      this.echoes.fade(0.4);
    }

    if (this.starAge >= 0) {
      const sp = StarBurst.pop(this.starAge, 0.03, 0.04);
      this.pop.set(this.v1.copy(this.point).setY(1.4), 1.0 * sp.scale, sp.opacity, 0.2);
      this.starAge += dt;
      if (this.starAge > 0.14) { this.starAge = -1; this.pop.set(this.point, 0, 0); }
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const stoppedMomentModule: EffectModule = {
  label: 'stopped moment',
  category: 'hero: chrono',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new StoppedMoment(),
  telegraphs(effect) {
    const e = effect as StoppedMoment;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as StoppedMoment;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as StoppedMoment).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'stunSeconds', 0, 1.2, 0.1);
  },
};
