import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { ASTRAL, ConstellationLines, StarChart, StarPoints } from '../../effects/parts/astral';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Twin Stars (astral kit, W: self buff, 4 s). The effect is only the look: the rule (basic attacks echo at 50%, the
 * trait's `attackEcho`, and +20% speed from the kit's `buff`) runs in the trait and the duel. A parchment chart draws
 * on under her and a ring of refraction opens; two four-point stars spiral out of her hands and orbit her chest on a
 * tilted ring, joined by a gold line that turns with them and flares every 1.4 s. While she moves, small stars are
 * left behind her feet and fall (the haste). The orbit fades over the last 0.45 s: a clean, short snap. The chart and
 * the stars follow her live position. See pipeline/designs/kit-astral.md.
 */
export interface TwinStarsSettings {
  seconds: number;
  loop: boolean;
}

export const defaultTwinStars = (): TwinStarsSettings => ({ seconds: 5, loop: false });

const IN_T = 0.5;
const FADE_T = 0.45;
const RADIUS = 0.95;
const OMEGA = 2.6;

export class TwinStars implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TwinStarsSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  ctx: CastContext | null = null;
  private time = 0;
  private lastX = 0;
  private lastZ = 0;
  private dropT = 0;

  private chart = new StarChart({ color: ASTRAL.foil });
  private lines = new ConstellationLines({ maxLines: 2 });
  private stars = new StarPoints({ max: 20 });
  private orbs = [0, 1].map(() => new StarBurst({ points: 4, inner: 0.22, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false }));
  private flare = new StarBurst({ points: 10, inner: 0.3, color: ASTRAL.accent, core: ASTRAL.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private lineId = -1;
  private p = [new THREE.Vector3(), new THREE.Vector3()];
  private feet = new THREE.Vector3();
  private v1 = new THREE.Vector3();

  constructor(settings: TwinStarsSettings = defaultTwinStars()) {
    this.settings = settings;
    this.lines.widthScale = 1.3;
    this.group.add(this.chart.mesh, this.lines.mesh, this.stars.mesh, this.flare.mesh, this.shock.mesh, ...this.orbs.map((o) => o.mesh));
    this.reset();
  }

  get duration() {
    return this.settings.seconds + 0.2;
  }

  get impactTime() {
    return IN_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.feet.copy(ctx.from).setY(0);
  }

  play() {
    this.reset();
    this.playing = true;
    if (this.ctx) {
      this.lastX = this.ctx.caster.group.position.x;
      this.lastZ = this.ctx.caster.group.position.z;
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.dropT = 0;
    this.lineId = -1;
    clearScreenFx(this.screen);
    this.chart.reset();
    this.lines.reset();
    this.stars.reset();
    this.flare.set(this.feet, 0, 0);
    this.shock.set(this.feet, 0, 0);
    for (const o of this.orbs) o.set(this.feet, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.stars.update(dt);
    this.lines.update(dt);
    this.time += dt;
    const t = this.time, total = this.settings.seconds;
    const me = this.ctx?.caster.group.position ?? this.feet;
    this.feet.set(me.x, 0, me.z);

    const born = smoothstep(t / IN_T);
    const out = 1 - smoothstep((t - (total - FADE_T)) / FADE_T);
    const a = born * out;

    // --- The chart under her, and the opening ring. ---
    this.chart.set(this.feet, 1.7);
    this.chart.reveal = smoothstep(t / 0.35);
    this.chart.opacity = 0.85 * out;
    this.chart.spin = t * 0.8;
    const g = smoothstep(t / 0.45);
    this.shock.set(this.feet, 0.5 + 3 * g, 0.03 * (1 - g) * (1 - g));
    const fp = StarBurst.pop(t - 0.05, 0.03, 0.06);
    this.flare.set(this.v1.set(me.x, 1.3, me.z), 1.3 * fp.scale, fp.opacity, 0.2);

    // --- The twins: they spiral out from her hands, then orbit on a tilted ring a half turn apart. ---
    const spiral = RADIUS * (0.35 + 0.65 * born);
    for (let i = 0; i < 2; i++) {
      const ang = t * OMEGA + i * Math.PI;
      this.p[i].set(
        me.x + Math.cos(ang) * spiral,
        1.3 + Math.sin(ang) * 0.38 * born + 0.06 * Math.sin(t * 5 + i),
        me.z + Math.sin(ang) * spiral * 0.9,
      );
      const pulse = 1 + 0.15 * Math.sin(t * 9 + i * 2);
      this.orbs[i].set(this.p[i], 0.42 * pulse * a, a, t * 2 + i);
    }
    // The line between them: drawn once they are out, it follows; a flare every 1.4 s.
    if (this.lineId < 0 && t > 0.15) this.lineId = this.lines.connect(this.p[0], this.p[1], 0.2);
    if (this.lineId >= 0) this.lines.move(this.lineId, this.p[0], this.p[1]);
    this.lines.opacity = out;
    const beat = (t % 1.4) / 1.4;
    if (t > IN_T && beat < 0.06) {
      const bp = beat / 0.06;
      this.v1.addVectors(this.p[0], this.p[1]).multiplyScalar(0.5);
      this.flare.set(this.v1, 0.7 * Math.sin(bp * Math.PI), 0.9, 0);
    }

    // --- Haste: stars left behind her feet while she moves. ---
    this.dropT -= dt;
    const moved = Math.hypot(me.x - this.lastX, me.z - this.lastZ);
    if (this.dropT <= 0 && moved > 0.08 && out > 0.3 && t > 0.2) {
      this.dropT = 0.22;
      this.v1.set(me.x, 0.35 + Math.random() * 0.5, me.z);
      const i = this.stars.add(this.v1, 0.22);
      this.stars.fall(i, undefined, 0.5);
    }
    this.lastX = me.x;
    this.lastZ = me.z;

    if (t >= total + 0.2) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }
}

export const twinStarsModule: EffectModule = {
  label: 'twin stars',
  category: 'hero: astral',
  // Self: the duel AI casts it when the enemy is within radius - 0.6, so 9 means "at attack range".
  targeting: { mode: 'self', radius: 9 },
  create: () => new TwinStars(),
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TwinStars;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as TwinStars).settings;
    f.add(s, 'loop');
    f.add(s, 'seconds', 1, 8, 0.5);
  },
};
