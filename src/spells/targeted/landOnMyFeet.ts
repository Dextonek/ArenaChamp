import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { ArcTrail, CAT, CatWord, Halo, PawPrints, Specks } from '../../effects/parts/cat';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FEET_LEAP_TIME, FEET_SECONDS, catBookOf } from '../../traits/cat';

/**
 * Land on My Feet (cat kit v5, R: the next life is not lost; label 'land on my feet'). A short flourish at the cast: he twirls, a
 * cream ring with six amber gems opens round his waist, sparkles spiral up, a star pops at his chest and the word NINE LIVES floats.
 * The ring then follows him for the 4 s the trait keeps it armed (the trait draws a pulsing ring at his feet as well,
 * `Trait.ring`, so a player who looks away from this effect still sees it). If a hit would take a life, the trait (src/traits/cat.ts)
 * saves it and leaps him 3 m away, and counts the leap in `catBooks`: this effect sees the count change (on both screens), ends the
 * ring in a burst of fur and sparks where he stood, and 0.25 s later, when he has landed, draws the streak from there to
 * where he is, with four paw prints and the word FEET. No damage and no zone: it is a defence, and the telegraph list is empty. If
 * it runs out unused the ring shrinks away. Clean by about 4.6 s. See pipeline/designs/kit-cat.md.
 */
export interface LandOnMyFeetSettings {
  loop: boolean;
}

export const defaultLandOnMyFeet = (): LandOnMyFeetSettings => ({ loop: false });

const FLOURISH = 0.4;
const DURATION = FEET_SECONDS + 0.6;
const HALO_R = 1.05;

export class LandOnMyFeet implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LandOnMyFeetSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private seq0 = 0;
  private leapT = -1;
  private landedT = false;
  private sparkleT = 0;
  private lastPos = new THREE.Vector3();
  private from = new THREE.Vector3();

  private halo = new Halo(6);
  private arc = new ArcTrail();
  private specks = new Specks(70);
  private word = new CatWord(2);
  private prints = new PawPrints(4);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: CAT.body, core: CAT.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();

  constructor(settings: LandOnMyFeetSettings = defaultLandOnMyFeet()) {
    this.settings = settings;
    this.group.add(this.halo.mesh, this.arc.mesh, this.prints.mesh, this.specks.mesh, this.word.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FLOURISH;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    this.seq0 = catBookOf(ctx.caster).leapSeq;
    const p = ctx.caster.group.position;
    this.lastPos.set(p.x, 0, p.z);
    // The flourish: a ring of dust, sparkles thrown up, the word.
    this.specks.ring(this.v1.set(p.x, 0.15, p.z), 10, 3, 0.6, [CAT.foil, CAT.body], 0.11);
    this.specks.burst(this.v1.set(p.x, 0.6, p.z), 14, 2.6, 0.9, [CAT.core, CAT.body, CAT.foil], 0.09, 1.5, 3);
    this.word.show('NINE LIVES', this.v1.set(p.x, 2.9, p.z), 1.0, 1.2);
    this.shake = 0.05;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.leapT = -1;
    this.landedT = false;
    this.sparkleT = 0;
    this.halo.set(this.lastPos, 1e-3, 0, 0);
    this.arc.reset();
    this.specks.reset();
    this.word.reset();
    this.prints.reset();
    this.pop.set(this.lastPos, 0, 0);
    this.shock.set(this.lastPos, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.arc.update(dt);
    this.specks.update(dt);
    this.word.update(dt);
    this.prints.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    const over = this.leapT >= 0 ? t >= this.leapT + 1.4 : t >= DURATION;
    if (over && !this.arc.busy && !this.specks.busy && !this.word.busy && !this.prints.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    if (!ctx) return;
    const body = ctx.caster.group.position;

    // --- A hit would have cost a life: the trait counted a leap. ---
    if (this.leapT < 0 && catBookOf(ctx.caster).leapSeq !== this.seq0) {
      this.leapT = t;
      this.from.copy(this.lastPos);
      this.specks.burst(this.v1.set(this.from.x, 1.0, this.from.z), 16, 4.2, 0.6, [CAT.body, CAT.core, CAT.foil], 0.1, 1, 8);
      this.shock.set(this.v1.set(this.from.x, 0, this.from.z), 1.6, 0.04);
      this.shake = 0.18;
    }
    if (this.leapT < 0) this.lastPos.set(body.x, 0, body.z);

    // --- The ring and its gems follow him while it waits; it shrinks away when it runs out or is used. ---
    let k = 0;
    if (this.leapT < 0) {
      const open = Math.min(1, t / FLOURISH);
      const closing = Math.max(0, (t - (FEET_SECONDS - 0.4)) / 0.4);
      k = open * (1 - closing);
    } else {
      k = Math.max(0, 1 - (t - this.leapT) / 0.2);
    }
    this.halo.set(this.v1.set(body.x, 0.85, body.z), HALO_R * (0.5 + 0.5 * k), t * 3.2, k);
    if (this.leapT < 0 && t > FLOURISH) {
      this.sparkleT += dt;
      if (this.sparkleT >= 0.3) {
        this.sparkleT = 0;
        this.specks.burst(this.v1.set(body.x, 0.4, body.z), 2, 1.2, 0.7, [CAT.core, CAT.body], 0.07, 1.6, 2);
      }
    }
    if (t < FLOURISH + 0.2) {
      const sp = StarBurst.pop(t, 0, 0.04);
      this.pop.set(this.v1.set(body.x, 1.2, body.z), 1.0 * sp.scale, sp.opacity, 0.2);
    }

    // --- He has landed 3 m away: the streak from where he stood, prints, FEET. ---
    if (this.leapT >= 0 && !this.landedT && t >= this.leapT + FEET_LEAP_TIME) {
      this.landedT = true;
      this.arc.fly(this.from, this.v1.set(body.x, 0, body.z), 1.1, 0.3);
      this.specks.ring(this.v1.set(body.x, 0.15, body.z), 12, 3.8, 0.6, [CAT.foil, CAT.body], 0.12);
      this.word.show('FEET', this.v1.set(body.x, 2.6, body.z), 1.2, 1.0);
      const yaw = Math.atan2(body.x - this.from.x, body.z - this.from.z);
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 0.3 : -0.3, back = 1.2 - i * 0.3;
        const dx = Math.sin(yaw), dz = Math.cos(yaw);
        this.prints.stamp(this.v1.set(body.x - dx * back - dz * side, 0, body.z - dz * back + dx * side), yaw, 0.85);
      }
      this.shake = 0.14;
    }
    this.shake *= Math.exp(-dt * 9);
  }
}

export const landOnMyFeetModule: EffectModule = {
  label: 'land on my feet',
  category: 'hero: cat',
  // A self buff, no area: the radius only lets the CPU cast it.
  targeting: { mode: 'self', radius: 1 },
  create: () => new LandOnMyFeet(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as LandOnMyFeet;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    f.add((effect as LandOnMyFeet).settings, 'loop');
  },
};
