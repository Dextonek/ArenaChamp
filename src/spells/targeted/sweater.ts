import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Fluff, Sweater, YARN, YARN_CSS } from '../../effects/parts/yarn';
import { stillSees } from '../../effects/channel';
import type { Enemy } from '../../effects/common';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SWEATER_DAMAGE, SWEATER_RADIUS, SWEATER_RANGE, SWEATER_SLOW, SWEATER_WIND, bookOf } from '../../traits/yarn';

/**
 * Sweater (yarn kit v5, E: a thrown gift). A click on the enemy (7 m): Grandma holds up a knitted sweater and throws it, folded and
 * tumbling, along a high arc (0.5 s, `SWEATER_WIND`) at the enemy, who cannot sidestep it (a click spell). A red circle (1 m) on
 * the enemy's feet follows them and shows where it lands. At 0.5 s the spell checks itself: if `stillSees` the enemy (cover between
 * them stops it) and they are within 9 m, the sweater lands on them: slowed 2 s (`ctx.hit`, damage 0, `projectile: true`) and a
 * knitted sweater is drawn on them, visibly tightening, with the words KEEP WARM over their head (the trait's `enemyLabel`, from
 * the book). At 2.5 s it shrinks: 40 damage (`projectile: true`, on their live position: the sweater is on them), a pop of wool, and
 * she says "ooh, it suits you" (the trait's `landed`). Otherwise it falls on the floor and unravels, no hit. Reaching cover within the
 * 0.5 s is the answer; or wait it out and take 40. Clean by 3.4 s. See pipeline/designs/kit-yarn.md.
 */
export interface SweaterSettings {
  damage: number;
  slow: number;
  loop: boolean;
}

export const defaultSweater = (): SweaterSettings => ({ damage: SWEATER_DAMAGE, slow: SWEATER_SLOW, loop: false });

// Timeline (seconds).
const LAND_T = SWEATER_WIND;
const DURATION_TAIL = 0.9;
const FLIGHT_ARC = 1.6;
const WORN_Y = 1.05;
const MIN = 1e-3;

export class SweaterFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SweaterSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The circle's centre: where the enemy stood at the cast. */
  readonly mark = new THREE.Vector3();
  private target: Enemy | null = null;
  private from = new THREE.Vector3();
  private time = 0;
  private flags = { landed: false, hit: false, shrunk: false, fell: false };
  private nextCreak = 0;
  private popAt = -1;
  private popPos = new THREE.Vector3();

  private sweater = new Sweater();
  private fluff = new Fluff(60);
  private star = new StarBurst({ points: 10, inner: 0.3, color: YARN.pink, core: YARN.core, additive: false });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: SweaterSettings = defaultSweater()) {
    this.settings = settings;
    this.group.add(this.sweater.group, this.fluff.mesh, this.star.mesh);
    this.reset();
  }

  /** Seconds after the cast when it shrinks. */
  private get shrinkT() {
    return LAND_T + this.settings.slow;
  }

  get duration() {
    return this.shrinkT + DURATION_TAIL;
  }

  get impactTime() {
    return LAND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.mark.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.from.copy(ctx.from).setY(1.4);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags = { landed: false, hit: false, shrunk: false, fell: false };
    this.nextCreak = 0;
    this.popAt = -1;
    this.sweater.hide();
    this.fluff.reset();
    this.star.set(this.mark, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.fluff.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, f = this.flags;
    if (!ctx) return;
    if (t >= this.duration && !this.fluff.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The throw: the folded sweater tumbles along a high arc to the enemy, opening as it comes. The mark follows their feet. ---
    if (t < LAND_T) {
      if (this.target) this.mark.copy(this.target.group.position).setY(0);
      this.v1.copy(this.mark).setY(WORN_Y);
      this.sweater.lob(this.from, this.v1, FLIGHT_ARC, t / LAND_T);
    }

    // --- The landing: it checks itself on the enemy's live feet. ---
    if (!f.landed && t >= LAND_T) {
      f.landed = true;
      const e = this.target;
      const p = e?.group.position;
      // It follows its target (a click spell): only cover between them, or too far a throw, stops it.
      const near = !!p && Math.hypot(p.x - ctx.from.x, p.z - ctx.from.z) <= SWEATER_RANGE + 2;
      const sees = !!p && stillSees(ctx, p);
      if (e && near && sees) {
        f.hit = true;
        bookOf(ctx.caster).sweater = { at: performance.now() };
        // `projectile: true`: it touched them, which is the check (a thrown thing aimed at one hero, as Sky Rend's cuts).
        ctx.hit(e, { damage: 0, knock: 0, color: YARN_CSS.pink, projectile: true, status: { kind: 'slow', seconds: this.settings.slow } });
        this.v1.set(p!.x, WORN_Y, p!.z);
        this.fluff.burst(this.v1, 10, 3, 1);
        this.popAt = t;
        this.popPos.copy(this.v1);
        this.shake = 0.12;
      } else {
        // Missed, or cover in the way: it falls on the floor.
        f.fell = true;
        this.v1.copy(this.mark).setY(0.1);
        this.fluff.burst(this.v1, 6, 2.2, 0.9);
        this.shake = 0.05;
      }
    }

    // --- Worn: it hugs them and tightens a little more every beat, creaking. ---
    if (f.hit && !f.shrunk && this.target) {
      const p = this.target.group.position, u = THREE.MathUtils.clamp((t - LAND_T) / this.settings.slow, 0, 1);
      const fit = 1 - Math.pow(u, 1.4) * 0.95 + Math.sin(t * 22) * 0.025 * u;
      this.v1.set(p.x, WORN_Y, p.z);
      this.sweater.wear(this.v1, this.target.group.rotation.y, fit);
      if (t >= LAND_T + 0.3 && t >= this.nextCreak) {
        this.nextCreak = t + 0.42;
        this.fluff.burst(this.v2.set(p.x, WORN_Y + 0.1, p.z), 2, 1.1, 0.7, 0.3);
      }
    }
    // A sweater that missed lies where it fell for a beat, then unravels.
    if (f.fell && t < LAND_T + 0.7) {
      this.v1.copy(this.mark).setY(0.12);
      this.sweater.wear(this.v1, 0.6, 1, 0.8);
      this.sweater.group.scale.y = 0.3;
    } else if (f.fell) this.sweater.hide();

    // --- The shrink: it squeezes to nothing, 40, a pop of wool. ---
    if (f.hit && !f.shrunk && t >= this.shrinkT) {
      f.shrunk = true;
      const e = this.target;
      const p = e?.group.position;
      this.sweater.hide();
      if (e && p) {
        ctx.hit(e, { damage: this.settings.damage, knock: 0, color: YARN_CSS.pink, projectile: true });
        this.popPos.set(p.x, WORN_Y, p.z);
      }
      this.popAt = t;
      this.fluff.burst(this.popPos, 16, 4.5, 1.3);
      this.shake = 0.3;
    }

    if (this.popAt >= 0) {
      const a = t - this.popAt, sp = StarBurst.pop(a, 0.05, 0.2);
      this.star.set(this.popPos, (f.shrunk ? 2.2 : 1.4) * Math.max(sp.scale, MIN), sp.opacity, a * 3);
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const sweaterModule: EffectModule = {
  label: 'sweater',
  category: 'hero: yarn',
  targeting: { mode: 'enemy' },
  create: () => new SweaterFx(),
  telegraphs(effect) {
    const e = effect as SweaterFx;
    if (!e.ctx) return [];
    // Where it will land: the circle on the enemy's feet at the cast. It roots her until then.
    return [{ shape: { kind: 'circle', x: e.mark.x, z: e.mark.z, radius: SWEATER_RADIUS }, start: 0, impact: SWEATER_WIND }];
  },
  bloom: { enabled: false, strength: 0, radius: 0, threshold: 1 },
  frameCamera(camera, controls, effect) {
    const e = effect as SweaterFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SweaterFx).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'slow', 0.5, 2.5, 0.1);
  },
};
