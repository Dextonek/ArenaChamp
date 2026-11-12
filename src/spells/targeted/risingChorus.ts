import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { BARD, GLYPH, Lyre, Notes, SoundRings, Stave } from '../../effects/parts/bard';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { BEAT, CHORUS_SECONDS, cantorClock } from '../../traits/bard';

/**
 * Rising Chorus (bard kit v5, E: a self buff with a look). A golden lyre rises behind him and two staves wind round his body
 * with notes riding them; for the 3 s the chorus runs (`CHORUS_SECONDS`)
 * a gold sound ring leaves his feet on every beat (the trait's `cantorClock`, so it pulses with the ring under him; every
 * 0.75 s where there is no trait) and the lyre strums. It deals no damage and has no hit. What it gives is the trait's
 * (src/traits/bard.ts): cast on the beat it spends his Crescendo for a shield of 15 a step (3 s) and +25% speed for 1.5 s;
 * off the beat it gives nothing. The look follows him on his live position and fades at 3 s. No cooldown. Clean by 3.5 s.
 * Network duels: both screens play the look; it changes no state.
 */
export interface RisingChorusSettings {
  loop: boolean;
}

export const defaultRisingChorus = (): RisingChorusSettings => ({ loop: false });

// Timeline (seconds).
const RISE_T = 0.35;
const END_T = CHORUS_SECONDS;
const DURATION = END_T + 0.5;
const ORBIT = 1.25;
const POINTS = 22;

export class RisingChorus implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RisingChorusSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { rose: false, end: false };
  private lastBeat = 0;
  private fallback = 0;
  private me = new THREE.Vector3();

  // Parts.
  private staves = [new Stave(60), new Stave(60)];
  private notes = new Notes(24);
  private rings = new SoundRings(5);
  private lyre = new Lyre();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: BARD.accent, core: BARD.core, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private pts = Array.from({ length: POINTS }, () => new THREE.Vector3());

  constructor(settings: RisingChorusSettings = defaultRisingChorus()) {
    this.settings = settings;
    this.group.add(...this.staves.map((s) => s.mesh), this.notes.mesh, this.rings.mesh, this.lyre.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return RISE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.me.copy(ctx.from).setY(0);
  }

  play() {
    this.reset();
    this.playing = true;
    this.follow();
    this.lastBeat = this.beatNow();
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fallback = 0;
    this.flags.rose = this.flags.end = false;
    for (const s of this.staves) s.reset();
    this.notes.reset();
    this.rings.reset();
    this.lyre.reset();
    this.pop.set(this.me, 0, 0);
  }

  private follow() {
    if (this.ctx) this.me.copy(this.ctx.caster.group.position).setY(0);
  }

  /** The beat count now: the trait's round clock where there is one, else one every 0.75 s of this effect. */
  private beatNow() {
    const clock = this.ctx ? cantorClock.get(this.ctx.caster) : undefined;
    return clock !== undefined ? Math.floor(clock / BEAT) : Math.floor(this.fallback / 0.75);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    this.fallback += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    this.follow();

    if (!this.flags.rose && t >= RISE_T * 0.5) {
      this.flags.rose = true;
      this.rise();
    }
    if (this.flags.rose && t < END_T) {
      const b = this.beatNow();
      if (b !== this.lastBeat) {
        this.lastBeat = b;
        this.beat();
      }
    }
    if (!this.flags.end && t >= END_T) {
      this.flags.end = true;
      this.notes.scatter(this.me, 5, 1.0);
      this.lyre.hide();
    }
    this.layout(t);
    for (const s of this.staves) s.update(dt);
    this.notes.update(dt);
    this.rings.update(dt);
    this.lyre.update(dt);
    this.shake *= Math.exp(-dt * 10);
  }

  /** The chorus opens: a ring, a pop, the lyre behind him, notes on the staves. */
  private rise() {
    this.rings.pulse(this.v1.copy(this.me).setY(0.1), 3.2, 0.55, undefined, { r0: 0.8, width: 0.24, tone: 'gold' });
    this.shake = 0.1;
    this.staves.forEach((s, i) => {
      this.orbit(s, i, 0);
      for (let n = 0; n < 3; n++) this.notes.ride(s, (n + 0.5) / 3, [GLYPH.quarter, GLYPH.eighth, GLYPH.beamed][(n + i) % 3], { size: 0.62, gold: i === 1, du: 0.16 * (i ? -1 : 1), lift: 0.22, wrap: true });
    });
    this.lyre.show(this.v1.set(this.me.x, 0.1, this.me.z - 0.9), 1.5, 0);
    this.lyre.shimmer(14);
  }

  /** A gold ring on the beat, and the strings ring. */
  private beat() {
    this.rings.pulse(this.v1.copy(this.me).setY(0.1), 2.2, 0.4, undefined, { r0: 0.9, width: 0.18, tone: 'gold' });
    this.lyre.strum(0.8);
  }

  /** Winds stave `i` round his body (a closed loop) at its height, turned by `spin`. */
  private orbit(s: Stave, i: number, spin: number) {
    for (let k = 0; k < POINTS; k++) {
      const a = (k / (POINTS - 1)) * Math.PI * 2 + spin * (i ? -1 : 1);
      this.pts[k].set(this.me.x + Math.cos(a) * ORBIT, (i ? 1.45 : 0.55) + 0.15 * Math.sin(a * 2 + i), this.me.z + Math.sin(a) * ORBIT);
    }
    s.setPath(this.pts, 0.09, 1, 0);
    s.wave(0.06);
  }

  private layout(t: number) {
    const k = smoothstep((t - RISE_T * 0.5) / RISE_T) * (1 - smoothstep((t - END_T) / 0.4));
    this.staves.forEach((s, i) => {
      if (this.flags.rose) this.orbit(s, i, t * 1.4);
      s.alpha = k;
    });
    if (this.flags.rose && !this.flags.end) {
      this.lyre.place(this.v1.set(this.me.x, 0.1, this.me.z - 0.9), 1.5, 0);
      const sp = StarBurst.pop(t - RISE_T * 0.5, 0, 0.03);
      this.pop.set(this.v1.set(this.me.x, 1.4, this.me.z), 1.0 * sp.scale, sp.opacity, 0.2);
    }
  }
}

export const risingChorusModule: EffectModule = {
  label: 'rising chorus',
  category: 'hero: bard',
  // SELF: a buff with a look. The radius only sets the reach the CPU casts it at (radius - 0.6 m).
  targeting: { mode: 'self', radius: 7 },
  create: () => new RisingChorus(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RisingChorus;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    f.add((effect as RisingChorus).settings, 'loop');
  },
};
