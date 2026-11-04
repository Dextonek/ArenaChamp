import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { INK, INK_CSS, InkBleed, Seal, Splatter, Stroke } from '../../effects/parts/ink';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { type InkStroke, removeStrokes, strokesNear } from '../../traits/ink';

/**
 * The Last Character (ink kit v5, R: a zone and a payoff on her ink). Ground aim, 9 m. She writes one great character, 4 m
 * wide, on the ground over 1.0 s (rice paper unrolls, five wet strokes are painted in one after another: the 2 m circle is
 * the telegraph and it roots her while she writes). At 1.0 s, judged on live positions (`ctx.enemies`): an enemy inside the
 * 2 m circle takes 30 and is rooted 1 s; and for every live armed stroke of hers within 0.8 m of that enemy at that moment,
 * 3 at most, a further 40. It is one hit with the sum (30 + 40 per stroke); an enemy outside the circle but standing on her ink
 * takes only the stroke part, as a `projectile: true` hit (no root), so the strokes pay off even when they stand outside the
 * character. The strokes that were counted vanish (`removeStrokes`, both screens). One short impact frame (a single light
 * frame, ink on paper), a vermilion seal stamps the middle, ink and a ring burst out. Clean by 2.4 s. Strokes only count
 * (an armed seal is a stroke for crossings, not here).
 */
export interface TheLastCharacterSettings {
  damage: number;
  strokeDamage: number;
  rootSeconds: number;
  loop: boolean;
}

export const defaultTheLastCharacter = (): TheLastCharacterSettings => ({ damage: 40, strokeDamage: 50, rootSeconds: 1, loop: false });

// Timeline (seconds).
const WRITE_T = 1.0;
const END_T = 2.4;
const RADIUS = 2;
const STROKE_R = 0.8;
const MAX_STROKES = 3;
const INK_Y = 0.07;
const WIDTH = 0.6;

/** The character (a stylised "eternal" shape, 4 m wide): each stroke is its points (x, z from the centre), the second it starts and how long it takes. */
const STROKES: { pts: [number, number][]; at: number; dur: number }[] = [
  { pts: [[-0.3, -1.75], [0, -1.6], [0.3, -1.45]], at: 0, dur: 0.2 },
  { pts: [[-1.9, -0.95], [0, -0.85], [1.9, -0.7]], at: 0.1, dur: 0.3 },
  { pts: [[0, -1.5], [0, 0.4], [0, 1.2], [-0.45, 1.75]], at: 0.35, dur: 0.35 },
  { pts: [[-0.1, -0.3], [-0.8, 0.5], [-1.7, 1.4]], at: 0.55, dur: 0.3 },
  { pts: [[0.1, -0.25], [0.85, 0.6], [1.7, 1.55]], at: 0.7, dur: 0.3 },
];

export class TheLastCharacter implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TheLastCharacterSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  circle: TelegraphShape = { kind: 'circle', x: 0, z: 0, radius: RADIUS };
  private time = 0;
  private spot = new THREE.Vector3();
  private started: boolean[] = STROKES.map(() => false);
  private struck = false;
  private gone = false;
  /** The time each counted stroke erupted (a star at it); 9 s ago = none. */
  private eruptTime = [-9, -9, -9];

  private paper = new InkBleed();
  private strokes = STROKES.map(() => new Stroke({ flat: true, order: 7, taper: 0.6 }));
  private seal = new Seal(1);
  private splat = new Splatter(40);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: INK.accent, core: 0xffffff, additive: false });
  private erupt = [0, 1, 2].map(() => new StarBurst({ points: 8, inner: 0.3, color: INK.body, core: 0xffffff, additive: false }));
  private eruptAt = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: TheLastCharacterSettings = defaultTheLastCharacter()) {
    this.settings = settings;
    this.screen.impactColor.set(INK.foil);
    this.group.add(this.paper.mesh, ...this.strokes.map((s) => s.mesh), this.seal.mesh, this.splat.mesh, this.pop.mesh, ...this.erupt.map((s) => s.mesh), this.shock.mesh);
    this.reset();
  }

  get duration() {
    return END_T;
  }

  get impactTime() {
    return WRITE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.spot.copy(ctx.point).setY(0);
    this.circle = { kind: 'circle', x: this.spot.x, z: this.spot.z, radius: RADIUS };
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
  }

  play() {
    this.reset();
    this.playing = true;
    // Rice paper rolls out under the whole character as she starts to write.
    this.paper.spread(this.v1.copy(this.spot), 2.3, 0.45, { ink: 0, unroll: true, yaw: 0 });
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.struck = this.gone = false;
    this.eruptTime = [-9, -9, -9];
    this.started = STROKES.map(() => false);
    clearScreenFx(this.screen);
    this.paper.reset();
    for (const s of this.strokes) s.reset();
    this.seal.reset();
    this.splat.reset();
    this.pop.set(this.spot, 0, 0);
    this.erupt.forEach((s) => s.set(this.spot, 0, 0));
    this.shock.set(this.spot, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.paper.update(dt);
    for (const s of this.strokes) s.update(dt);
    this.seal.update(dt);
    this.splat.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;

    // --- 0..1.0: the character is written, stroke by stroke. ---
    STROKES.forEach((def, i) => {
      if (this.started[i] || t < def.at) return;
      this.started[i] = true;
      const pts = def.pts.map(([x, z]) => new THREE.Vector3(this.spot.x + x, INK_Y, this.spot.z + z));
      this.strokes[i].paint(pts, WIDTH, def.dur);
      this.v1.copy(pts[0]).setY(0.5);
      this.v2.set(0, 0.5, 0);
      this.splat.fling(this.v1, this.v2, 3, 3, { size: 0.1, spread: 1.0, up: 0.6, life: 0.6 });
    });

    // --- 1.0: the impact, with one short light frame. ---
    if (!this.struck && t >= WRITE_T) {
      this.struck = true;
      this.strike();
    }
    this.screen.impact = impactFrameAt(t, WRITE_T, [2], 0.06);

    if (this.struck) {
      const a = t - WRITE_T;
      const sp = StarBurst.pop(a, 0.02, 0.2);
      this.pop.set(this.v1.copy(this.spot).setY(1.0), 2.2 * sp.scale, sp.opacity, 0.2);
      const g = THREE.MathUtils.clamp(a / 0.45, 0, 1);
      this.shock.set(this.spot, 0.5 + 2.4 * g, 0.04 * (1 - g) * (1 - g));
      this.shake *= Math.exp(-dt * 8);
      this.erupt.forEach((s, i) => {
        const ep = StarBurst.pop(t - this.eruptTime[i], 0.02, 0.15);
        s.set(this.eruptAt[i], 1.3 * ep.scale, ep.opacity, 0.3);
      });
      if (!this.gone && a >= 0.35) {
        // The ink dries out and flakes away, the paper and the seal fade.
        this.gone = true;
        for (const s of this.strokes) s.dissolve(0.8);
        this.paper.fade(0.7);
        this.seal.fade(0.7);
      }
    }

    if (t >= END_T) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  /** The hit, on live positions: inside the circle 30 + root; 40 per live stroke within 0.8 m of the enemy (3 at most), inside or not. */
  private strike() {
    const ctx = this.ctx, s = this.settings;
    const used = new Set<InkStroke>();
    if (ctx) {
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const p = e.group.position;
        const inside = Math.hypot(p.x - this.spot.x, p.z - this.spot.z) <= RADIUS;
        const near = strokesNear(ctx.caster, p.x, p.z, STROKE_R, MAX_STROKES);
        if (!inside && !near.length) continue;
        const opts: HitOptions = {
          damage: Math.round((inside ? s.damage : 0) + s.strokeDamage * near.length), knock: 0, from: this.spot.clone(), color: INK_CSS.hot,
        };
        // Outside the circle only the strokes pay: a bolt-style hit, so the cast's zones let it through (and it roots nothing).
        if (inside) opts.status = { kind: 'root', seconds: s.rootSeconds };
        else opts.projectile = true;
        ctx.hit(e, opts);
        near.forEach((n) => used.add(n));
      }
      removeStrokes(ctx.caster, [...used]);
    }
    // The counted strokes erupt where they lay.
    [...used].slice(0, 3).forEach((u, i) => {
      this.eruptAt[i].set((u.ax + u.bx) / 2, 0.8, (u.az + u.bz) / 2);
      this.eruptTime[i] = this.time;
      this.v2.set(0, 1, 0);
      this.splat.fling(this.v1.copy(this.eruptAt[i]).setY(0.3), this.v2, 8, 5, { size: 0.13, spread: 1.0, up: 1.2, life: 0.8 });
    });
    // The seal stamps the middle of the character, ink bursts out.
    this.seal.stamp(this.v1.copy(this.spot), 1.6);
    this.v2.set(0, 1, 0);
    this.splat.fling(this.v1.copy(this.spot).setY(0.4), this.v2, 14, 6, { size: 0.16, spread: 2.4, up: 1.4, life: 0.9 });
    this.shake = 0.7;
  }
}

export const theLastCharacterModule: EffectModule = {
  label: 'the last character',
  category: 'hero: ink',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new TheLastCharacter(),
  telegraphs(effect) {
    const e = effect as TheLastCharacter;
    if (!e.ctx) return [];
    // The hit's own zone: inside it the full hit, and it roots her while she writes. The stroke part outside it is a projectile hit.
    return [{ shape: e.circle, start: 0, impact: WRITE_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TheLastCharacter;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as TheLastCharacter).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'strokeDamage', 0, 100, 1);
    f.add(s, 'rootSeconds', 0, 2, 0.1);
  },
};
