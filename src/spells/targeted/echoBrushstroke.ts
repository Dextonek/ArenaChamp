import * as THREE from 'three';
import { Emitter } from '../../emitter';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { Brushstroke, brushstrokeModule, type BrushstrokeSettings } from './brushstroke';
import { takeDouble } from './inkDoubleState';

/**
 * Brushstroke with the Ink Double's echo (ink kit, Q). The normal Brushstroke, and when the caster's double from Ink Double
 * (W) still stands the same stroke is fired once more from the double's spot toward the same aim point, a beat later
 * (`ECHO_DELAY`). Two `Brushstroke` instances live in one group; the echo gets a derived `CastContext` (own `from` and
 * `aim`, everything else, the hits and the projectile launcher included, inherited). The double is spent by the cast.
 */
const ECHO_DELAY = 0.12;

export class EchoBrushstroke implements Effect {
  readonly group = new THREE.Group();
  readonly emitters: Emitter[] = [];
  readonly main: Brushstroke;
  readonly echo: Brushstroke;
  /** The double's spot of the last cast, or null when the echo does not fly. */
  echoFrom: THREE.Vector3 | null = null;

  private echoCtx: CastContext | null = null;
  private wait = -1;
  private spot = new THREE.Vector3();

  constructor() {
    this.main = new Brushstroke();
    this.echo = new Brushstroke(this.main.settings);
    this.group.add(this.main.group, this.echo.group);
  }

  get settings(): BrushstrokeSettings {
    return this.main.settings;
  }
  get ctx() {
    return this.main.ctx;
  }
  get shake() {
    return Math.max(this.main.shake, this.echo.shake);
  }
  set shake(v: number) {
    this.main.shake = this.echo.shake = v;
  }
  get playing() {
    return this.main.playing || this.echo.playing || this.wait >= 0;
  }
  set playing(v: boolean) {
    if (!v) {
      this.main.playing = this.echo.playing = false;
      this.wait = -1;
    }
  }

  cast(ctx: CastContext) {
    this.main.cast(ctx);
    const spot = takeDouble(ctx.caster, this.spot);
    this.echoCtx = null;
    this.echoFrom = null;
    if (!spot) return;
    const from = spot.clone();
    const aim = Math.atan2(ctx.point.x - from.x, ctx.point.z - from.z);
    // Derived context: the echo's own origin and yaw, everything else (hit, projectile, targets, ...) from the cast.
    const ec = Object.assign(Object.create(ctx) as CastContext, { from, aim, sentFrom: from });
    this.echoCtx = ec;
    this.echoFrom = from;
    this.echo.cast(ec);
  }

  play() {
    this.main.play();
    if (this.echoCtx) this.wait = ECHO_DELAY;
  }

  update(dt: number) {
    if (this.wait >= 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.wait = -1;
        this.echo.play();
      }
    }
    this.main.update(dt);
    this.echo.update(dt);
  }
}

export const echoBrushstrokeModule: EffectModule = {
  ...brushstrokeModule,
  label: 'brushstroke',
  category: 'hero: ink',
  create: () => new EchoBrushstroke(),
  telegraphs(effect) {
    const e = effect as EchoBrushstroke;
    const out: TelegraphSpec[] = [];
    if (e.main.ctx) out.push({ shape: e.main.line, start: 0, impact: 0.2, until: e.main.flightEnd });
    if (e.echoFrom && e.echo.ctx) out.push({ shape: e.echo.line, start: ECHO_DELAY, impact: 0.2 + ECHO_DELAY, until: e.echo.flightEnd + ECHO_DELAY });
    return out;
  },
  frameCamera(camera, controls, effect) {
    const e = effect as EchoBrushstroke;
    if (e.main.ctx) frameCast(camera, controls, e.main.ctx, 3);
  },
  buildGui(f, effect) {
    brushstrokeModule.buildGui(f, (effect as EchoBrushstroke).main);
  },
};
