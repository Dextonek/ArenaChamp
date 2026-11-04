import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { DustPuffs, FlatRing, GeraldFigure, GERALD_HEIGHT, MASON, StoneChunks } from '../../effects/parts/mason';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { geraldHere, geraldLive, geraldOf, moodNow, raiseGeraldAt, setGeraldMood } from '../../traits/mason';

/**
 * A Good Lean (mason kit, E: a dash to Gerald). Bram runs at Gerald from up to 8 m away (`ctx.moveCaster`, 0.25 s, ease-out)
 * and stops 1.5 m short of him, kicking up a dust trail along the way. He leans in for a hug: a chalk ring and a small star
 * where he lands, and Gerald, who did not ask for this, goes alarmed for a moment and shakes dust and a chip off his top.
 * The 60 point shield for 2 s and the word HUG are the trait's (`afterCast`, `src/traits/mason.ts`), which also refuses the
 * cast without a Gerald in reach. Nothing here hits anyone, so there is no telegraph and no root. Clean by 1.4 s.
 *
 * Network duels: the other screen has no `moveCaster` (his client streams the real path) and draws the dust and the hug
 * where Gerald's record says he is. See pipeline/designs/kit-mason.md.
 */
export interface AGoodLeanSettings {
  loop: boolean;
}

export const defaultAGoodLean = (): AGoodLeanSettings => ({ loop: false });

// Timeline (seconds).
const DASH_T = 0.25;
const DURATION = 1.4;
const STOP = 1.5; // how far short of Gerald he stops
const MAX_REACH = 8;

export class AGoodLeanFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AGoodLeanSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private hugged = false;
  private trailT = 0;
  private armed = false;

  private chunks = new StoneChunks(24);
  private dust = new DustPuffs(40);
  private figure = new GeraldFigure();
  private ring = new FlatRing(MASON.foil);
  private pop = new StarBurst({ points: 6, inner: 0.35, color: MASON.hot, core: MASON.core, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: AGoodLeanSettings = defaultAGoodLean()) {
    this.settings = settings;
    this.group.add(this.chunks.mesh, this.dust.mesh, this.figure.group, this.ring.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return DASH_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fig = ctx.caster;
    const s = ctx.sentFrom ?? ctx.from;
    // The VFX tool runs no trait and no Gerald: stand one 5 m in front of the caster.
    if (!geraldHere(geraldOf(fig)) && !geraldLive(fig)) raiseGeraldAt(fig, ctx, s.x + Math.sin(ctx.aim) * 5, s.z + Math.cos(ctx.aim) * 5);
    const g = geraldOf(fig);
    this.armed = geraldHere(g);
    this.from.copy(s).setY(0);
    this.to.copy(this.from);
    if (!this.armed) return;
    const dx = g.x - s.x, dz = g.z - s.z, d = Math.hypot(dx, dz);
    // Stop 1.5 m short of him, on Bram's side. Too close already: he stays put.
    if (d > STOP + 0.05) this.to.set(g.x - (dx / d) * STOP, 0, g.z - (dz / d) * STOP);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx || !this.armed) return;
    const g = geraldOf(ctx.caster);
    if (Math.hypot(g.x - this.from.x, g.z - this.from.z) > MAX_REACH + 0.5) return;
    ctx.moveCaster?.(this.to, DASH_T);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.hugged = false;
    this.trailT = 0;
    this.chunks.reset();
    this.dust.reset();
    this.ring.set(this.to, 0, 0);
    this.pop.set(this.to, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.chunks.update(dt);
    this.dust.update(dt);
    const ctx = this.ctx;
    if (ctx && !geraldLive(ctx.caster)) {
      const g = geraldOf(ctx.caster);
      if (geraldHere(g)) this.figure.set(g.x, g.z, ctx.aim + Math.PI, moodNow(ctx.caster));
      else this.figure.hide();
    } else this.figure.hide();
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (t >= DURATION && !this.chunks.busy && !this.dust.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    if (!ctx || !this.armed) return;

    // --- The run: dust kicked up along the path, drawn from where he really is now. ---
    if (t < DASH_T + 0.05) {
      this.trailT += dt;
      if (this.trailT >= 0.03) {
        this.trailT = 0;
        const c = ctx.caster.group.position;
        this.v1.set(c.x, 0.1, c.z);
        this.v2.set(this.to.x - this.from.x, 0, this.to.z - this.from.z).normalize();
        this.dust.puff(this.v1, -this.v2.x * 1.4 + (Math.random() - 0.5), 0.5, -this.v2.z * 1.4 + (Math.random() - 0.5), 0.28, 0.55);
      }
      this.shake = 0.08;
    }
    // --- The hug: a ring, a star, and Gerald is not pleased. ---
    if (!this.hugged && t >= DASH_T) {
      this.hugged = true;
      const g = geraldOf(ctx.caster);
      setGeraldMood(ctx.caster, 'alarmed', 1.1);
      this.v1.set(g.x, GERALD_HEIGHT - 0.2, g.z);
      this.chunks.burst(this.v1, 4, 1.4, 1.5, 0.1);
      this.dust.puff(this.v1, 0, -0.2, 0, 0.5, 0.9);
      this.v1.set(g.x, 0, g.z);
      this.dust.ring(this.v1, 6, 0.8, 1.4, 0.32, 0.7);
      this.shake = 0.2;
    }
    if (this.hugged) {
      const a = t - DASH_T;
      const c = ctx.caster.group.position;
      this.v1.set(c.x, 0, c.z);
      const k = smoothstep(a / 0.5);
      this.ring.set(this.v1, 0.6 + 1.2 * k, 0.8 * (1 - k));
      const sp = StarBurst.pop(a, 0.04, 0.14);
      this.pop.set(this.v2.set(c.x, 1.5, c.z), 1.3 * sp.scale, sp.opacity, a * 2);
      this.shake *= Math.exp(-dt * 8);
    }
  }
}

export const aGoodLeanModule: EffectModule = {
  label: 'a good lean',
  category: 'hero: mason',
  // Needs no aim: the dash goes to Gerald, wherever he stands.
  targeting: { mode: 'self', radius: 1 },
  create: () => new AGoodLeanFx(),
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as AGoodLeanFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3.5);
  },
  buildGui(f, effect) {
    f.add((effect as AGoodLeanFx).settings, 'loop');
  },
};
