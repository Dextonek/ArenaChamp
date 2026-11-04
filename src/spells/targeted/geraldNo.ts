import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { DustPuffs, GeraldFigure, MASON, MASON_CSS, ShadowStrip, StoneChunks } from '../../effects/parts/mason';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import {
  dropGerald, geraldHere, geraldLive, geraldNow, geraldOf, raiseGeraldAt, setGeraldMood,
} from '../../traits/mason';

/**
 * Gerald, No! (mason kit, R: the pillar topples). Gerald tips over along the aim, away from Bram, and a long dark shadow
 * grows on the floor ahead of him as he goes: 10 m long, 1.6 m wide, from Gerald's spot, shown from the cast for 1.0 s (that
 * is the telegraph, and the hit test uses the very same line). He rocks, leans, speeds up and goes over face first, alarmed
 * all the way. At 1.0 s he crashes: one short impact frame, a shock wave runs the length of the line throwing stones and
 * dust, and whoever is inside the line then (live positions, `insideTelegraph` on the telegraph's own shape) takes 150.
 * He breaks: his obstacle and unit go (no SORRY GERALD: the word of this spell, GERALD, NO!, is the trait's `afterCast`),
 * and rubble lies along the line for 3 s (`RubbleLine` in his record: the trait draws it as marks and slows whoever stands
 * on it, `victimTick`). Bram has no pillar afterwards (`g.alive` false).
 *
 * While he tips this effect draws him (the trait's mark steps aside: `toppling`); if he is broken by damage before the crash
 * (his unit dies) the fall fizzles and nothing is hit: "break Gerald first" is the answer to this spell. Clean by 2.5 s.
 * Both screens use his record for the place and `ctx.aim` for the line. See pipeline/designs/kit-mason.md.
 */
export interface GeraldNoSettings {
  damage: number;
  loop: boolean;
}

export const defaultGeraldNo = (): GeraldNoSettings => ({ damage: 150, loop: false });

// Timeline (seconds).
const FALL_T = 1.0;
const WAVE_T = 0.3; // the shock wave runs the line in this long
const DURATION = 2.5;

const LENGTH = 10;
const WIDTH = 1.6;

export class GeraldNoFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GeraldNoSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: LENGTH, width: WIDTH };
  /** True when there is a Gerald to topple (the telegraph is empty otherwise). */
  armed = false;
  private time = 0;
  private start = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private epoch = -1;
  private crashed = false;
  private fizzled = false;
  private waveS = 0;
  private crashAt = -1;

  private shadow = new ShadowStrip();
  private chunks = new StoneChunks(90);
  private dust = new DustPuffs(60);
  private figure = new GeraldFigure();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: MASON.hot, core: MASON.core, additive: false });
  private waves = [new ShockRefraction({ facing: 'ground' }), new ShockRefraction({ facing: 'ground' }), new ShockRefraction({ facing: 'ground' })];

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: GeraldNoSettings = defaultGeraldNo()) {
    this.settings = settings;
    this.screen.impactColor.set(MASON.hot);
    this.screen.tint.set(MASON.dark);
    this.group.add(this.shadow.mesh, this.chunks.mesh, this.dust.mesh, this.figure.group, this.pop.mesh, ...this.waves.map((w) => w.mesh));
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FALL_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fig = ctx.caster;
    const f = ctx.sentFrom ?? ctx.from;
    // The VFX tool runs no trait and no Gerald: stand one 2.5 m in front of the caster.
    if (!geraldHere(geraldOf(fig)) && !geraldLive(fig)) raiseGeraldAt(fig, ctx, f.x + Math.sin(ctx.aim) * 2.5, f.z + Math.cos(ctx.aim) * 2.5);
    const g = geraldOf(fig);
    this.armed = geraldHere(g);
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.start.set(g.x, 0, g.z);
    this.line = {
      kind: 'line', x1: g.x, z1: g.z, x2: g.x + this.dir.x * LENGTH, z2: g.z + this.dir.z * LENGTH, width: WIDTH,
    };
    this.screen.focus.set(g.x + this.dir.x * LENGTH * 0.5, 0.8, g.z + this.dir.z * LENGTH * 0.5);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx || !this.armed) return;
    const g = geraldOf(ctx.caster);
    this.epoch = g.epoch;
    // He is the effect's to draw while he tips; nobody can use him meanwhile.
    g.toppling = true;
    g.moving = true;
    setGeraldMood(ctx.caster, 'alarmed', FALL_T + 0.5);
  }

  /** A restart while he still tips (a new round, say): he is let go of; the record is the trait's to reset. */
  private reset() {
    this.time = 0;
    this.shake = 0;
    this.crashed = this.fizzled = false;
    this.waveS = 0;
    this.crashAt = -1;
    this.epoch = -1;
    this.figure.hide();
    this.shadow.reset();
    this.chunks.reset();
    this.dust.reset();
    for (const w of this.waves) w.set(this.start, 0, 0);
    this.pop.set(this.start, 0, 0);
    clearScreenFx(this.screen);
    this.screen.impactColor.set(MASON.hot);
    this.screen.tint.set(MASON.dark);
  }

  /** Something ended this Gerald (a break, a new round) while he tipped. */
  private stale() {
    const ctx = this.ctx;
    if (!ctx) return true;
    const g = geraldOf(ctx.caster);
    return g.epoch !== this.epoch || !g.alive;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.chunks.update(dt);
    this.dust.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    const ctx = this.ctx;
    if (t >= DURATION && !this.chunks.busy && !this.dust.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    if (!ctx || !this.armed) {
      if (t >= FALL_T) { this.playing = false; this.reset(); }
      return;
    }
    if (!this.crashed && !this.fizzled && this.stale()) this.fizzle(ctx);
    if (this.fizzled) return;

    if (!this.crashed) {
      const g = geraldOf(ctx.caster);
      const u = THREE.MathUtils.clamp(t / FALL_T, 0, 1);
      // He rocks on his base first, then leans over faster and faster, and goes down face first.
      const rock = u < 0.3 ? 0.07 * Math.sin(t * 34) * (u / 0.3) : 0;
      const tilt = u < 0.3 ? rock : (Math.PI / 2) * Math.pow((u - 0.3) / 0.7, 2.2) * 0.985;
      this.figure.set(g.x, g.z, Math.atan2(this.dir.x, this.dir.z), 'alarmed', tilt);
      // The shadow grows from his foot as the pillar leans: its length follows the lean.
      const lean = Math.min(1, Math.max(0, tilt / (Math.PI / 2)));
      this.shadow.set(this.start.x, this.start.z, this.dir.x, this.dir.z, LENGTH * Math.max(0.12, lean), WIDTH, 0.35 + 0.65 * u);
      this.screen.darken = 0.2 * smoothstep(t / 0.5) * (1 - smoothstep((t - FALL_T) / 0.5));
      this.shake = 0.04 + 0.2 * u * u;
      if (u > 0.3 && Math.random() < 0.6) {
        this.v1.set(this.start.x - this.dir.x * 0.3 + (Math.random() - 0.5) * 0.8, 0.1, this.start.z - this.dir.z * 0.3 + (Math.random() - 0.5) * 0.8);
        this.dust.puff(this.v1, 0, 0.6, 0, 0.2, 0.5);
      }
      if (t >= FALL_T) this.crash(ctx);
    } else {
      this.afterCrash(dt);
    }
  }

  /** Broken by damage before the crash: he is gone, nothing falls. */
  private fizzle(ctx: CastContext) {
    this.fizzled = true;
    this.figure.hide();
    this.shadow.reset();
    clearScreenFx(this.screen);
    const g = geraldOf(ctx.caster);
    g.toppling = false;
    this.playing = false;
  }

  /** The crash: the hit, the break, the rubble. */
  private crash(ctx: CastContext) {
    this.crashed = true;
    this.crashAt = this.time;
    this.figure.hide();
    // Everyone inside the line now, on live positions, by the telegraph's own test.
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (insideTelegraph(this.line, p.x, p.z)) ctx.hit(e, { damage: this.settings.damage, knock: 0, from: this.start, color: MASON_CSS.body });
    }
    // He breaks: no obstacle, no unit, no heap of his own (the rubble line is his), no word.
    const g = geraldOf(ctx.caster);
    const born = geraldNow(ctx.caster);
    dropGerald(ctx.caster, false);
    g.lines.push({ ax: this.start.x, az: this.start.z, bx: this.start.x + this.dir.x * LENGTH, bz: this.start.z + this.dir.z * LENGTH, born });
    this.shake = 1.0;
    this.shadow.set(this.start.x, this.start.z, this.dir.x, this.dir.z, LENGTH, WIDTH, 1);
    this.v1.set(this.start.x + this.dir.x * 1.8, 1.6, this.start.z + this.dir.z * 1.8);
    this.pop.set(this.v1, 4.2, 1, 0);
  }

  private afterCrash(dt: number) {
    const a = this.time - this.crashAt;
    // One short impact frame.
    this.screen.impact = impactFrameAt(a, 0, [1, 2], 0.04);
    this.screen.darken = 0;
    // The wave runs the line, throwing stones and dust where it passes.
    const to = Math.min(LENGTH, (a / WAVE_T) * LENGTH);
    while (this.waveS < to) {
      this.waveS = Math.min(to, this.waveS + 1.25);
      const s = this.waveS;
      this.v1.set(this.start.x + this.dir.x * s, 0.3, this.start.z + this.dir.z * s);
      this.chunks.burst(this.v1, 9, 4.5, 6.5, 0.22, undefined, 1.4);
      this.dust.ring(this.v1.setY(0), 5, 0.5, 2.2, 0.45, 0.9);
      if (this.waveS >= LENGTH) break;
    }
    for (let i = 0; i < this.waves.length; i++) {
      const k = THREE.MathUtils.clamp((a - i * 0.1) / 0.45, 0, 1);
      const at = this.v2.set(this.start.x + this.dir.x * (i * 3.5 + 1.5), 0, this.start.z + this.dir.z * (i * 3.5 + 1.5));
      this.waves[i].set(at, 0.6 + 3.2 * k, a > i * 0.1 ? 0.05 * (1 - k) * (1 - k) : 0);
    }
    const sp = StarBurst.pop(a, 0.05, 0.2);
    this.pop.set(this.v1.set(this.start.x + this.dir.x * 1.8, 1.6, this.start.z + this.dir.z * 1.8), 4.2 * sp.scale, sp.opacity, a * 2);
    // The shadow fades; the rubble the trait draws takes over.
    this.shadow.set(this.start.x, this.start.z, this.dir.x, this.dir.z, LENGTH, WIDTH, 1 - smoothstep((a - 0.1) / 0.6));
    this.shake = Math.max(this.shake * Math.exp(-dt * 6), 0);
  }
}

export const geraldNoModule: EffectModule = {
  label: 'gerald no',
  category: 'hero: mason',
  // Aimed along a line from Bram: the fall takes the aim's direction.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new GeraldNoFx(),
  telegraphs(effect) {
    const e = effect as GeraldNoFx;
    if (!e.ctx || !e.armed) return [];
    return [{ shape: e.line, start: 0, impact: FALL_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as GeraldNoFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3.5);
  },
  buildGui(f, effect) {
    const s = (effect as GeraldNoFx).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 400, 1);
  },
};
