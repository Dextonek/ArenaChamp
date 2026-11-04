import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { BARD, BARD_CSS, GLYPH, Notes, SoundRings, Stave } from '../../effects/parts/bard';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { cantorTuned } from '../../traits/bard';

/**
 * Resounding Chord (bard kit v5, Q: a quick cone, no aim). Cantor turns toward the nearest enemy (the engine has turned
 * him by the cast: `ctx.aim`) and strikes a chord: three staves fan out of his hands through a 90 degree cone, 5 m long,
 * with notes riding them outward, and a sound ring leaves his feet. At 0.4 s everyone inside the cone (judged on the live
 * position) takes 45 (the cone is the cast's telegraph, so the duel's zone filter holds). In tune (`cantorTuned`, written by
 * his trait at the cast) the chord is gold, hits 30% harder (the trait's power) and also silences 0.5 s. Cooldown 3 s (2 s
 * in tune). Clean by 1.3 s.
 * Network duels: both screens replay the cast; only the victim's screen's hit counts.
 */
export interface ResoundingChordSettings {
  damage: number;
  loop: boolean;
}

export const defaultResoundingChord = (): ResoundingChordSettings => ({ damage: 52, loop: false });

// Timeline (seconds).
const HIT_T = 0.4;
const DURATION = 1.3;
const CONE_R = 5;
const CONE_ANGLE = 90;
const SILENCE_S = 0.5;
const FAN = [-0.6, 0, 0.6]; // radians off the aim
const HAND = 1.25;

export class ResoundingChord implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ResoundingChordSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The cone of the last cast (from the caster, along the aim). */
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: CONE_R, angle: CONE_ANGLE, dir: 0 };
  private time = 0;
  private tuned = false;
  private flags = { sung: false, hit: false };
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);

  // Parts.
  private staves = FAN.map(() => new Stave(40));
  private notes = new Notes(24);
  private rings = new SoundRings(5);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: BARD.accent, core: BARD.core, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private path: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(settings: ResoundingChordSettings = defaultResoundingChord()) {
    this.settings = settings;
    this.group.add(...this.staves.map((s) => s.mesh), this.notes.mesh, this.rings.mesh, this.pop.mesh);
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
    this.tuned = !!cantorTuned.get(ctx.caster);
    this.from.copy(ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.cone = { kind: 'cone', x: ctx.from.x, z: ctx.from.z, radius: CONE_R, angle: CONE_ANGLE, dir: ctx.aim };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.sung = this.flags.hit = false;
    for (const s of this.staves) s.reset();
    this.notes.reset();
    this.rings.reset();
    this.pop.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
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
    const f = this.flags;

    if (!f.sung && t >= 0.08) {
      f.sung = true;
      this.sing();
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.strike();
    }
    this.layout(t);
    for (const s of this.staves) s.update(dt);
    this.notes.update(dt);
    this.rings.update(dt);
    this.shake *= Math.exp(-dt * 12);
  }

  /** The chord starts: three staves fan out, notes ride them, a ring leaves his feet. */
  private sing() {
    this.staves.forEach((s, i) => {
      const a = (this.ctx?.aim ?? 0) + FAN[i];
      this.v1.set(Math.sin(a), 0, Math.cos(a));
      for (let k = 0; k < this.path.length; k++) {
        const d = HAND + (CONE_R - HAND) * (k / (this.path.length - 1));
        this.path[k].set(this.from.x + this.v1.x * d, 1.05 + 0.18 * Math.sin(k * 1.4 + i), this.from.z + this.v1.z * d);
      }
      s.setPath(this.path, 0.1, 0, 0);
      s.wave(0.12);
      for (let n = 0; n < 2; n++) this.notes.ride(s, 0.1 + n * 0.3, [GLYPH.quarter, GLYPH.beamed, GLYPH.eighth][(i + n) % 3], { size: 0.7, gold: this.tuned, du: 1.1, lift: 0.25, life: 0.9 });
    });
    this.rings.pulse(this.v2.copy(this.from).setY(0.08), CONE_R * 0.7, 0.5, undefined, { r0: 0.6, width: 0.2, tone: this.tuned ? 'gold' : 'rose' });
  }

  /** The cone is judged on the live positions at 0.4 s. */
  private strike() {
    const ctx = this.ctx;
    this.shake = 0.14;
    this.v1.copy(this.from).addScaledVector(this.fwd, 2.4).setY(1.1);
    this.rings.pulse(this.v2.copy(this.from).addScaledVector(this.fwd, 1.2).setY(0.1), CONE_R * 0.55, 0.45, undefined, { r0: 0.8, width: 0.22, tone: this.tuned ? 'gold' : 'rose' });
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, {
        damage: this.settings.damage, knock: 0, from: ctx.from, color: BARD_CSS.body,
        ...(this.tuned ? { status: { kind: 'silence' as const, seconds: SILENCE_S } } : {}),
      });
      this.notes.emit(this.v2.set(p.x, 1.3, p.z), this.v1.set(0, 2, 0), 4, 0.7, { size: 0.5, gold: this.tuned, spread: 1.6 });
    }
  }

  private layout(t: number) {
    // The staves stream out to the cone's tip by the hit, then their tails follow and they fade.
    const head = smoothstep((t - 0.08) / (HIT_T - 0.08));
    const tail = smoothstep((t - HIT_T) / 0.5);
    for (const s of this.staves) {
      s.setRange(head, tail);
      s.alpha = 1 - smoothstep((t - 0.9) / 0.4);
    }
    if (this.flags.hit) {
      const sp = StarBurst.pop(t - HIT_T, 0, 0.03);
      this.v1.copy(this.from).addScaledVector(this.fwd, 2.6).setY(1.1);
      this.pop.set(this.v1, 1.0 * sp.scale, sp.opacity, 0.2);
    }
  }
}

export const resoundingChordModule: EffectModule = {
  label: 'resounding chord',
  category: 'hero: bard',
  // QUICK: self mode, the engine has turned him toward the nearest enemy; the radius is the reach the CPU casts at (+0.6 m).
  targeting: { mode: 'self', radius: CONE_R + 0.6 },
  create: () => new ResoundingChord(),
  telegraphs(effect) {
    const e = effect as ResoundingChord;
    if (!e.ctx) return [];
    return [{ shape: e.cone, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ResoundingChord;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as ResoundingChord).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
