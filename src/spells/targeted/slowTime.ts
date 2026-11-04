import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { CHRONO, CHRONO_CSS, Dial, EchoClock, FrozenMotes } from '../../effects/parts/chrono';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { ECHO_DELAY, echoShare, stolenOn, tempoZone } from '../../traits/chrono';

/**
 * Slow Time (chrono kit v5, W: a ground zone, label 'slow time'). A luminous floor dial (3.5 m radius) draws itself in
 * round the chosen spot from the cast (0.4 s) and its hands tick slowly; motes drift up inside it. At 1.2 s time thickens:
 * every enemy inside on its LIVE position takes `damage` (30) and is slowed `slowSeconds` (2 s), a flash on the dial and a
 * small dial on each enemy ticking back once. He moves 30% faster inside the circle for 3 s from the cast: this file writes
 * the circle into `tempoZone` (his trait reads it in `tick`). THE ECHO (his passive): at the moment of the cast a pale ghost
 * clock stands in the middle of the dial, its hands running to twelve at 2.7 s (1.5 s after the hit); gold while Stolen Hour
 * runs. At 2.7 s the clock flashes and the echo hits whoever is inside NOW (live positions again): `damage` x the echo
 * share (`echoShare`: 40% = 12, or 80% in Stolen Hour) and the slow again. The echo's hits are `projectile: true` (it is
 * past the telegraph, which ends at the first hit, so the zone check cannot judge it): this file re-checks the circle itself.
 * The dial fades out at 3.0 s. Clean by 3.3 s. W's cooldown is 9 s, so nothing restarts it first. See
 * pipeline/designs/kit-chrono.md.
 */
export interface SlowTimeSettings {
  damage: number;
  slowSeconds: number;
  loop: boolean;
}

export const defaultSlowTime = (): SlowTimeSettings => ({ damage: 30, slowSeconds: 2, loop: false });

// Timeline (seconds).
const RADIUS = 3.5;
const HIT_T = 1.2;
const ECHO_T = HIT_T + ECHO_DELAY;
const ZONE_LIFE = 3.0;
const DURATION = ZONE_LIFE + 0.35;
const HIT_DIALS = 3;
const UP = new THREE.Vector3(0, 1, 0);

export class SlowTime implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SlowTimeSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The circle's centre (y = 0). */
  readonly point = new THREE.Vector3();
  private time = 0;
  private flags = { hit: false, echo: false, fading: false, urgent: false };
  private hitAge = new Array<number>(HIT_DIALS).fill(-1);
  private hitStep = new Array<boolean>(HIT_DIALS).fill(false);
  private hitCursor = 0;
  private flashAt = [-1, -1];

  // Parts.
  private dial = new Dial({ face: 'ring', marks: 'full', order: 8 });
  private clock = new EchoClock(10);
  private motes = new FrozenMotes();
  private hitDials = Array.from({ length: HIT_DIALS }, () => new Dial({ face: 'dark', marks: 'ticks', order: 11 }));
  private pops = [0, 1].map((i) => new StarBurst({ points: 8, inner: 0.3, color: i ? CHRONO.foil : CHRONO.body, core: CHRONO.core, additive: false }));
  private popAt = [-1, -1];
  private popPos = [new THREE.Vector3(), new THREE.Vector3()];
  private ring = new ShockRefraction({ facing: 'ground' });
  private facing = new THREE.Vector3(0, 0.25, 1).normalize();

  private v1 = new THREE.Vector3();

  constructor(settings: SlowTimeSettings = defaultSlowTime()) {
    this.settings = settings;
    this.group.add(
      this.dial.group, this.clock.group, this.motes.mesh, ...this.hitDials.map((d) => d.group), ...this.pops.map((p) => p.mesh), this.ring.mesh,
    );
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
    this.point.copy(ctx.point).setY(0);
    // His trait reads the circle (on his own client) to give him haste while he stands in it.
    tempoZone.set(ctx.caster, { x: this.point.x, z: this.point.z, r: RADIUS, until: performance.now() + ZONE_LIFE * 1000 });
  }

  play() {
    this.reset();
    this.playing = true;
    const strong = !!this.ctx && stolenOn(this.ctx.caster);
    this.dial.show(this.v1.copy(this.point).setY(0.05), RADIUS, UP, 0.4);
    this.dial.tick(2);
    this.dial.tint.set(strong ? 0xffe28a : 0xffffff);
    // The ghost clock: in the middle of the dial from the cast until the echo.
    this.clock.gold(strong);
    this.clock.show(this.v1.copy(this.point).setY(0.09), 1.3, UP, ECHO_T);
    this.motes.drift(this.v1.copy(this.point), RADIUS * 0.85, 12);
    this.facing.set(0, 0.25, 1).normalize();
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.hit = f.echo = f.fading = f.urgent = false;
    this.hitAge.fill(-1);
    this.hitStep.fill(false);
    this.popAt[0] = this.popAt[1] = -1;
    this.flashAt[0] = this.flashAt[1] = -1;
    this.dial.reset();
    this.clock.reset();
    this.motes.reset();
    for (const d of this.hitDials) d.reset();
    for (const p of this.pops) p.set(this.point, 1e-3, 0);
    this.ring.set(this.point, 0, 0);
  }

  /** True while `e` stands inside the circle right now (live position, so a walker escapes). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  /** The pulse: every enemy inside takes `damage` and the slow. `echo`: the second one, at the echo share. */
  private pulse(echo: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    const damage = echo ? Math.round(this.settings.damage * echoShare(ctx.caster)) : this.settings.damage;
    for (const e of ctx.targets) {
      if (!this.inside(e)) continue;
      ctx.hit(e, {
        damage, knock: 0, from: this.point, color: CHRONO_CSS.body, status: { kind: 'slow', seconds: this.settings.slowSeconds },
        // The first hit is judged by the telegraph; the echo is past it, so the circle was re-checked here.
        ...(echo ? { projectile: true as const } : {}),
      });
      this.hitFx(e.group.position);
    }
  }

  /** A small dial on the enemy that ticks backward once. */
  private hitFx(at: THREE.Vector3) {
    const i = this.hitCursor;
    this.hitCursor = (this.hitCursor + 1) % HIT_DIALS;
    this.hitDials[i].show(this.v1.set(at.x, 1.2, at.z), 0.7, this.facing, 0.08);
    this.hitAge[i] = 0;
    this.hitStep[i] = false;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.dial.update(dt);
    this.clock.update(dt);
    this.motes.update(dt);
    for (const d of this.hitDials) d.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    if (!f.urgent && t >= 0.8) {
      f.urgent = true;
      this.dial.tick(7);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.dial.tick(2);
      this.dial.flash(1);
      this.dial.tickBack();
      this.motes.freeze(this.v1.copy(this.point), RADIUS * 0.9, 12);
      this.popAt[0] = t;
      this.popPos[0].copy(this.point).setY(0.9);
      this.flashAt[0] = t;
      this.shake = 0.2;
      this.pulse(false);
    }
    if (!f.echo && t >= ECHO_T) {
      f.echo = true;
      const strong = !!ctx && stolenOn(ctx.caster);
      this.clock.gold(strong);
      this.clock.fire();
      this.dial.tint.set(strong ? 0xffe28a : 0xffffff);
      this.dial.flash(1);
      this.dial.tickBack();
      this.motes.freeze(this.v1.copy(this.point), RADIUS * 0.9, 8);
      this.popAt[1] = t;
      this.popPos[1].copy(this.point).setY(0.9);
      this.flashAt[1] = t;
      this.shake = 0.12;
      this.pulse(true);
    }
    if (!f.fading && t >= ZONE_LIFE) {
      f.fading = true;
      this.dial.hide(0.35);
      this.motes.release(0.35);
    }

    // The ground rings: the first is chartreuse and wide, the echo's is paler and a beat smaller, so the two events read apart.
    for (let i = 0; i < 2; i++) {
      if (this.flashAt[i] < 0) continue;
      const g = smoothstep((t - this.flashAt[i]) / 0.45);
      if (g >= 1) { this.flashAt[i] = -1; this.ring.set(this.point, 0, 0); continue; }
      this.ring.set(this.point, (i ? 0.6 : 0.8) * RADIUS * (0.3 + 0.7 * g), (i ? 0.03 : 0.045) * (1 - g) * (1 - g));
    }
    for (let i = 0; i < 2; i++) {
      if (this.popAt[i] < 0) continue;
      const sp = StarBurst.pop(t - this.popAt[i], 0.03, 0.14);
      this.pops[i].set(this.popPos[i], (i ? 1.4 : 2.0) * sp.scale + 1e-3, sp.opacity, 0.3 + i);
    }
    for (let i = 0; i < HIT_DIALS; i++) {
      if (this.hitAge[i] < 0) continue;
      this.hitAge[i] += dt;
      if (!this.hitStep[i] && this.hitAge[i] >= 0.12) {
        this.hitStep[i] = true;
        this.hitDials[i].tickBack();
      }
      if (this.hitAge[i] >= 0.5) {
        this.hitDials[i].hide(0.25);
        this.hitAge[i] = -1;
      }
    }

    this.shake *= Math.exp(-dt * 12);
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
    }
  }
}

export const slowTimeModule: EffectModule = {
  label: 'slow time',
  category: 'hero: chrono',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SlowTime(),
  telegraphs(effect) {
    const e = effect as SlowTime;
    if (!e.ctx) return [];
    // The first hit's circle only: the echo re-checks the same circle itself (projectile hit), and the ghost clock marks it.
    return [{ shape: { kind: 'circle', x: e.point.x, z: e.point.z, radius: RADIUS }, start: 0, impact: HIT_T, until: HIT_T + 0.1 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SlowTime;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SlowTime).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'slowSeconds', 0, 3, 0.1);
  },
};
