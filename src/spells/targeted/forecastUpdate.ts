import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { Pointer, Specks, WEATHER, WEATHER_HEX_OF, cardLook } from '../../effects/parts/weather';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { weatherBooks } from '../../traits/weather';

/**
 * Forecast Update (weather kit, E: no target, no hit of its own). Barry swings his pointer up at the air over his head (0.18 s) and
 * a blank weather card hangs there, a smile in its corner; he taps it at 0.34 s with a crack of sparks, and the card flips to the NEW
 * forecast (read from his trait's book: the cast's Update count has already turned it, on both screens) and holds, swelling a little
 * as it bobs, ringed by a spin of sparks in that weather's colour. It shrinks away at 1.7 s. The rule is the trait's: `afterCast`
 * adds one Update (`show('upd')`), the next change goes to the other weather and, in `afterCast`, it puts Cold Front on a 6 s cooldown (`UPDATE_COST`).
 * No zone, no root. Clean by about 2.1 s. The card needs the book to know the weather by 0.4 s; with none (the tool) it shows Rain.
 * See pipeline/designs/kit-weather.md.
 */
export interface ForecastUpdateSettings {
  loop: boolean;
}

export const defaultForecastUpdate = (): ForecastUpdateSettings => ({ loop: false });

// Timeline (seconds).
const TAP_T = 0.34;
const GONE_T = 1.7;
const DURATION = 2.1;

export class ForecastUpdate implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ForecastUpdateSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private tapped = false;
  private weather = 0;
  private spot = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private cardAt = new THREE.Vector3();
  private cards: THREE.Object3D[] = [cardLook('update', 0), cardLook('update', 1), cardLook('update', 2)];
  private blank = cardLook('next', 1);
  private v1 = new THREE.Vector3();

  private pointer = new Pointer();
  private specks = new Specks(80);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: WEATHER.foil, core: WEATHER.core, additive: false });

  constructor(settings: ForecastUpdateSettings = defaultForecastUpdate()) {
    this.settings = settings;
    this.blank.traverse((o) => { const m = (o as THREE.Sprite).material as THREE.SpriteMaterial | undefined; if (m) m.opacity = 0.55; });
    this.group.add(this.pointer.mesh, this.specks.mesh, this.pop.mesh, this.blank, ...this.cards);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return TAP_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.spot.set(s.x, 0, s.z);
    this.hand.set(s.x + 0.4, 1.3, s.z);
    this.cardAt.set(s.x, 3.3, s.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.tapped = false;
    this.specks.reset();
    this.pointer.aim(this.hand, this.cardAt, 0);
    this.pop.set(this.cardAt, 0, 0);
    this.blank.visible = false;
    for (const c of this.cards) c.visible = false;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.specks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const s = this.spot;
    const out = t > GONE_T ? Math.max(0.001, 1 - smoothstep((t - GONE_T) / 0.4)) : 1;
    const born = smoothstep(t / 0.2);

    // --- The pointer swings up to the card: out (0 - 0.18), a tap at 0.34, then it lowers. ---
    const reach = t < 0.18 ? smoothstep(t / 0.18) : t < 0.5 ? 1 : 1 - smoothstep((t - 0.5) / 0.2);
    this.v1.set(s.x, 3.0 + (t > TAP_T - 0.06 && t < TAP_T + 0.06 ? 0.15 : 0), s.z);
    this.pointer.aim(this.hand, this.v1, reach * 0.95);

    // --- Before the tap: a blank card. At the tap it flips to the new forecast. ---
    this.blank.position.set(s.x, 0, s.z);
    this.blank.scale.setScalar(Math.max(0.001, born * out));
    this.blank.visible = !this.tapped;
    if (!this.tapped && t >= TAP_T) {
      this.tapped = true;
      this.weather = weatherBooks.get(ctx?.caster ?? this)?.fShown ?? 0;
      this.shake = 0.1;
      this.specks.burst(s.x, 3.1, s.z, 28, 5, 0.9, 0.2, WEATHER_HEX_OF[this.weather], 3);
      this.specks.burst(s.x, 3.1, s.z, 10, 4, 0.7, 0.18, WEATHER.core, 1);
    }
    if (this.tapped) {
      const a = t - TAP_T;
      // The new card flips in with a little overshoot, then bobs.
      const flip = Math.min(1, a / 0.16), over = 1 + 0.25 * Math.sin(flip * Math.PI) * (1 - flip * 0.2);
      for (let w = 0; w < 3; w++) this.cards[w].visible = w === this.weather;
      const card = this.cards[this.weather];
      card.position.set(s.x, Math.sin(t * 4) * 0.06, s.z);
      card.scale.set(Math.max(0.001, flip * over * out), Math.max(0.001, over * out), Math.max(0.001, over * out));
      // A spin of sparks in the weather's colour round the card (placed at random on a ring, a few a frame).
      if (a < 1.1 && Math.random() < dt * 30) {
        const an = t * 5 + Math.random();
        this.specks.spawn(s.x + Math.cos(an) * 1.9, 3.3 + Math.sin(an) * 0.9, s.z, Math.cos(an + 1.6) * 0.6, Math.sin(an + 1.6) * 0.6, 0, 0.6, 0.15, WEATHER_HEX_OF[this.weather], 0, 0.5);
      }
      const sp = StarBurst.pop(a, 0.05, 0.2);
      this.pop.set(this.v1.set(s.x + 1.6, 3.9, s.z), 1.3 * sp.scale, sp.opacity, a * 4);
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const forecastUpdateModule: EffectModule = {
  label: 'forecast update',
  category: 'hero: weather',
  // No target: it is cast anywhere (a large radius, so the CPU's reach check for a self spell never holds it back).
  targeting: { mode: 'self', radius: 30 },
  create: () => new ForecastUpdate(),
  // No zone: the change is the trait's, and the cooldown it spends is UPDATE_COST seconds of Cold Front.
  bloom: { enabled: true, strength: 0.25, radius: 0.3, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as ForecastUpdate;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    f.add((effect as ForecastUpdate).settings, 'loop');
  },
};
