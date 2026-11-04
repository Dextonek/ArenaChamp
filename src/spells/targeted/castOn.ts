import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Fluff, StrandTube, YARN, YarnBalls, lineY, strandPoints, LINE_HEIGHT } from '../../effects/parts/yarn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { firstSurface } from '../../obstacles';
import { CAST_AHEAD, CAST_RANGE, CAST_RISE, bookOf, makeRoom, newLine, raiseLine, type YarnLine } from '../../traits/yarn';

/**
 * Cast On (yarn kit v5, W: terrain, two charges). Grandma lifts a ball of wool out of her basket (0.15 s), and throws it along the
 * way she aims: it runs out across the floor trailing a sagging strand of rose wool, to the nearest cover in that direction (a
 * pillar or a wall: `firstSurface` against `ctx.obstacles()`) up to 9 m from her, and ties off there with a knot and a puff of
 * wool at 0.4 s. With no cover in that direction the line is tied to nothing: it ends 9 m out in a loose ball of wool lying on the
 * floor, and still works. From the tie it is a real line: it catches an enemy who walks across it (stuck 0.4 s, then slowed 1 s),
 * and one hit of any size cuts it (`raiseLine` in src/traits/yarn.ts says how). Up to three stand; a fourth takes the oldest. The
 * line is drawn by the trait's `marks` on both screens (this effect draws the throw, the strand in flight and the knot's pop).
 * The telegraph is the line it will fill (0.5 m wide, impact at the tie, 0.4 s): it roots her until then. Clean by 1.1 s.
 * See pipeline/designs/kit-yarn.md.
 */
export interface CastOnSettings {
  loop: boolean;
}

export const defaultCastOn = (): CastOnSettings => ({ loop: false });

// Timeline (seconds).
const LIFT_T = 0.15;
const TIE_T = CAST_RISE;
const DURATION = 1.1;
const TELE_W = 0.5;
const SEGS = 22;
const MIN = 1e-3;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class CastOnFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CastOnSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The line's two ends, from sentFrom and point only. */
  readonly a = new THREE.Vector3();
  readonly b = new THREE.Vector3(0, 0, 1);
  private tied = false;
  private dir = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private done = false;
  private rec: YarnLine | null = null;
  private pts: THREE.Vector3[] = [];

  private balls = new YarnBalls(1);
  private strand = new StrandTube(SEGS, 5, YARN.pink, 0.07);
  private outline = new StrandTube(SEGS, 5, YARN.ink, 0.1);
  private fluff = new Fluff(50);
  private star = new StarBurst({ points: 8, inner: 0.3, color: YARN.pink, core: YARN.core, additive: false });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: CastOnSettings = defaultCastOn()) {
    this.settings = settings;
    this.group.add(this.outline.mesh, this.strand.mesh, this.balls.mesh, this.fluff.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return TIE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line: only sentFrom, the aim point and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.3) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.a.set(s.x + dx * CAST_AHEAD, 0, s.z + dz * CAST_AHEAD);
    const reach = CAST_RANGE - CAST_AHEAD;
    const end = { x: this.a.x + dx * reach, z: this.a.z + dz * reach };
    const hit = firstSurface(this.a, end, ctx.obstacles?.() ?? []);
    this.tied = !!hit;
    const l = Math.max(0.5, hit ? reach * hit.t : reach);
    this.b.set(this.a.x + dx * l, 0, this.a.z + dz * l);
  }

  /** True when the line is tied to cover (false: it ends 9 m out, tied to nothing). */
  get isTied() {
    return this.tied;
  }

  play() {
    this.reset();
    this.playing = true;
    // The record, on both screens: the trait draws it from the tie.
    const ctx = this.ctx;
    if (ctx) this.rec = newLine(bookOf(ctx.caster), this.a.x, this.a.z, this.b.x, this.b.z, this.tied);
  }

  private reset() {
    // A cast that was cut off before the tie leaves nothing behind.
    if (this.rec && !this.rec.raised) this.rec.gone = true;
    this.rec = null;
    this.time = 0;
    this.shake = 0;
    this.done = false;
    this.balls.reset();
    this.strand.hide();
    this.outline.hide();
    this.fluff.reset();
    this.star.set(this.a, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.fluff.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (!ctx) return;
    if (t >= DURATION && !this.fluff.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    if (!this.done) {
      const c = ctx.from, px = -this.dir.z, pz = this.dir.x;
      if (t < LIFT_T) {
        // The ball comes up out of the basket at her hip, growing.
        const k = easeOut(t / LIFT_T);
        this.v1.set(c.x + px * 0.45 + this.dir.x * 0.2, 0.5 + 0.55 * k, c.z + pz * 0.45 + this.dir.z * 0.2);
        this.balls.place(0, this.v1, Math.max(0.22 * k, MIN), t * 9, t * 6);
      } else {
        // It runs out along the line, the strand paying out behind it and sagging as it goes.
        const u = THREE.MathUtils.clamp((t - LIFT_T) / (TIE_T - LIFT_T), 0, 1), k = easeOut(u);
        strandPoints(this.a, this.b, SEGS, this.pts, k);
        this.pts[0].y = Math.min(this.pts[0].y, LINE_HEIGHT);
        this.outline.set(this.pts);
        this.strand.set(this.pts);
        const tip = this.pts[SEGS];
        this.v1.set(tip.x, 0.25 + (lineY(k) - 0.25) * u * 0.6 + Math.sin(u * Math.PI) * 0.25, tip.z);
        this.balls.place(0, this.v1, 0.22 * (1 - 0.35 * u), t * 20, t * 9);
        if (Math.random() < 0.5) this.fluff.burst(this.v2.copy(this.v1), 1, 0.9, 0.6, 0.2);
      }
    }

    // --- The tie: a knot pops, a puff of wool; from here the trait's mark is the line. ---
    if (!this.done && t >= TIE_T) {
      this.done = true;
      if (this.rec) {
        makeRoom(bookOf(ctx.caster), this.rec);
        raiseLine(ctx, this.rec);
      }
      this.balls.hide(0);
      this.star.set(this.v1.set(this.b.x, LINE_HEIGHT, this.b.z), 0, 0);
      this.fluff.burst(this.v1, 10, 3, 1);
      this.fluff.burst(this.v2.set(this.a.x, LINE_HEIGHT, this.a.z), 5, 2, 0.8);
      this.shake = 0.1;
    }
    if (this.done) {
      const age = t - TIE_T;
      // The strand stays drawn a moment while the mark pops in over it, then the mark alone is the line.
      if (age > 0.12) { this.strand.hide(); this.outline.hide(); }
      const sp = StarBurst.pop(age, 0.05, 0.2);
      this.star.set(this.v1.set(this.b.x, LINE_HEIGHT, this.b.z), 1.6 * Math.max(sp.scale, MIN), sp.opacity, age * 3);
      this.shake *= Math.exp(-dt * 10);
    }
  }
}

export const castOnModule: EffectModule = {
  label: 'cast on',
  category: 'hero: yarn',
  // The aim point only gives the direction; the line runs to the nearest cover that way or 9 m out.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new CastOnFx(),
  telegraphs(effect) {
    const e = effect as CastOnFx;
    if (!e.ctx) return [];
    // The line it will fill: it roots her until it is tied.
    return [{ shape: { kind: 'line', x1: e.a.x, z1: e.a.z, x2: e.b.x, z2: e.b.z, width: TELE_W }, start: 0.04, impact: TIE_T }];
  },
  bloom: { enabled: false, strength: 0, radius: 0, threshold: 1 },
  frameCamera(camera, controls, effect) {
    const e = effect as CastOnFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    f.add((effect as CastOnFx).settings, 'loop');
  },
};
