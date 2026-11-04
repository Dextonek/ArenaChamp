import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Afterimage, CHRONO, CHRONO_CSS, EchoClock, FrozenMotes } from '../../effects/parts/chrono';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { ECHO_DELAY, SKIP_VANISH, echoShare, stolenOn } from '../../traits/chrono';

/**
 * Time Skip (chrono kit v5, E: a blink, label 'time skip', `dash`). He vanishes for 0.6 s (`SKIP_VANISH`; his trait makes
 * him untouchable and holds him: `taken`, `hold`): his figure is hidden (the same way Sky Rend hides Zephyr, no engine
 * change: `group.visible = false` and `displace` under the floor for a duel opponent's drawn body) and a pale afterimage
 * of him stands where he was, fading, with a few motes. From the moment of the cast a marker lies on the ground at the
 * destination (the aimed spot, at most 6 m away): the red telegraph circle (1.4 m, impact 0.6 s) and, inside it, the
 * ghost clock of his passive, its hands running to twelve at 2.1 s. At 0.6 s he appears there (`ctx.moveCaster(spot,
 * 0.05)`, then the figure shows again) and the spot pulses: every enemy within 1.4 m of it on its LIVE position takes
 * `damage` (35). THE ECHO: at 2.1 s (1.5 s later) the ghost clock flashes and the same spot pulses again, paler and wider
 * on the floor, for `damage` x the echo share (`echoShare`: 40% = 14, or 80% in Stolen Hour; gold hands then). The echo
 * is a `projectile: true` hit (it is past the telegraph, which ends at the arrival): this file re-checks the 1.4 m itself.
 * Network duels: the other screen has no `moveCaster` (his client streams the move), so there he is hidden until 0.65 s
 * and the pulse is centred on the aimed spot. Clean by 2.5 s. E's cooldown is 11 s, so nothing restarts it first. See
 * pipeline/designs/kit-chrono.md.
 */
export interface TimeSkipSettings {
  damage: number;
  loop: boolean;
}

export const defaultTimeSkip = (): TimeSkipSettings => ({ damage: 35, loop: false });

// Timeline (seconds).
const ARRIVE_T = SKIP_VANISH;
const SHOW_T = ARRIVE_T + 0.06;
const ECHO_T = ARRIVE_T + ECHO_DELAY;
const DURATION = ECHO_T + 0.4;
const RADIUS = 1.4;
const MAX_DIST = 6;
const HIDE_Y = -8;
const UP = new THREE.Vector3(0, 1, 0);

export class TimeSkip implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TimeSkipSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The marker (the aimed spot, within 6 m), and the spot he really reached (the pulse's centre). */
  readonly dest = new THREE.Vector3();
  private land = new THREE.Vector3();
  private start = new THREE.Vector3();
  private time = 0;
  private flags = { vanish: false, arrive: false, shown: false, echo: false };
  private hidden = false;
  private ringAt = [-1, -1];
  private ringPos = new THREE.Vector3();

  // Parts.
  private clock = new EchoClock(9);
  private ghost = new Afterimage(2);
  private motes = new FrozenMotes();
  private pops = [0, 1].map((i) => new StarBurst({ points: 8, inner: 0.3, color: i ? CHRONO.foil : CHRONO.body, core: CHRONO.core, additive: false }));
  private popAt = [-1, -1];
  private ringA = new ShockRefraction({ facing: 'ground' });
  private ringB = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: TimeSkipSettings = defaultTimeSkip()) {
    this.settings = settings;
    this.group.add(this.clock.group, this.ghost.group, this.motes.mesh, ...this.pops.map((p) => p.mesh), this.ringA.mesh, this.ringB.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return ARRIVE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    // The marker: the aimed spot, at most 6 m from him.
    const dx = ctx.point.x - ctx.from.x, dz = ctx.point.z - ctx.from.z;
    const d = Math.hypot(dx, dz), k = d > MAX_DIST ? MAX_DIST / d : 1;
    this.dest.set(ctx.from.x + dx * k, 0, ctx.from.z + dz * k);
    this.land.copy(this.dest);
  }

  play() {
    this.reset();
    this.playing = true;
    const strong = !!this.ctx && stolenOn(this.ctx.caster);
    // The ghost clock lies in the marker from the cast until the echo.
    this.clock.gold(strong);
    this.clock.show(this.v1.copy(this.dest).setY(0.06), RADIUS, UP, ECHO_T);
  }

  /** Hides his figure (and sinks a duel opponent's under the floor: the duel draws that body separately). */
  private hide() {
    const ctx = this.ctx;
    if (!ctx || this.hidden) return;
    this.hidden = true;
    ctx.caster.group.visible = false;
    ctx.displace(ctx.caster, this.v2.set(0, HIDE_Y, 0));
  }

  private show() {
    const ctx = this.ctx;
    if (!ctx || !this.hidden) return;
    this.hidden = false;
    ctx.caster.group.visible = true;
    ctx.displace(ctx.caster, this.v2.set(0, 0, 0));
  }

  private reset() {
    this.show();
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.vanish = f.arrive = f.shown = f.echo = false;
    this.ringAt[0] = this.ringAt[1] = -1;
    this.popAt[0] = this.popAt[1] = -1;
    this.clock.reset();
    this.ghost.reset();
    this.motes.reset();
    for (const p of this.pops) p.set(this.dest, 1e-3, 0);
    this.ringA.set(this.dest, 0, 0);
    this.ringB.set(this.dest, 0, 0);
  }

  /** The pulse: every enemy within 1.4 m of the spot, on its live position. `echo`: the second one, at the echo share. */
  private pulse(echo: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    const damage = echo ? Math.round(this.settings.damage * echoShare(ctx.caster)) : this.settings.damage;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.land.x, p.z - this.land.z) > RADIUS) continue;
      ctx.hit(e, {
        damage, knock: 0.5, from: this.land, color: CHRONO_CSS.body,
        // The arrival is judged by the telegraph; the echo is past it, so the 1.4 m was re-checked here.
        ...(echo ? { projectile: true as const } : {}),
      });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.clock.update(dt);
    this.ghost.update(dt);
    this.motes.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    // --- The vanish: his figure is gone, a pale afterimage stands where he was and fades; a few motes hang there. ---
    if (!f.vanish) {
      f.vanish = true;
      this.hide();
      this.ghost.stand(0, this.start, ctx ? ctx.caster.group.rotation.y : 0, 0.5);
      this.ghost.fade(ARRIVE_T);
      this.motes.freeze(this.v1.copy(this.start), 0.9, 8);
      this.ringA.set(this.start, 0.4, 0.04);
      this.ringAt[0] = t;
      this.ringPos.copy(this.start);
    }

    // --- The arrival: he is on the marker and it pulses. ---
    if (!f.arrive && t >= ARRIVE_T) {
      f.arrive = true;
      if (ctx?.moveCaster) this.land.copy(ctx.moveCaster(this.dest, 0.05)).setY(0);
      else this.land.copy(this.dest);
      this.clock.place(this.v1.copy(this.land).setY(0.06));
      this.motes.release(0.5);
      this.popAt[0] = t;
      this.ringAt[1] = t;
      this.shake = 0.22;
      this.pulse(false);
    }
    if (!f.shown && t >= SHOW_T) {
      f.shown = true;
      this.show();
    }

    // --- The echo: the ghost clock flashes and the same spot pulses again. ---
    if (!f.echo && t >= ECHO_T) {
      f.echo = true;
      this.clock.gold(!!ctx && stolenOn(ctx.caster));
      this.clock.fire();
      this.popAt[1] = t;
      this.ringAt[0] = t;
      this.ringPos.copy(this.land);
      this.shake = Math.max(this.shake, 0.12);
      this.pulse(true);
    }

    // Rings: the vanish ring (small, at the start) and the echo ring share ringA; the arrival's ring is ringB. The echo's is wider and thinner.
    if (this.ringAt[0] >= 0) {
      const a = t - this.ringAt[0], g = smoothstep(a / 0.4), echo = a >= 0 && f.echo;
      if (g >= 1) { this.ringAt[0] = -1; this.ringA.set(this.ringPos, 0, 0); }
      else this.ringA.set(this.ringPos, (echo ? 0.5 + 2.4 * g : 0.4 + 1.2 * g), (echo ? 0.03 : 0.04) * (1 - g) * (1 - g));
    }
    if (this.ringAt[1] >= 0) {
      const g = smoothstep((t - this.ringAt[1]) / 0.35);
      if (g >= 1) { this.ringAt[1] = -1; this.ringB.set(this.land, 0, 0); }
      else this.ringB.set(this.land, 0.4 + 1.6 * g, 0.05 * (1 - g) * (1 - g));
    }
    for (let i = 0; i < 2; i++) {
      if (this.popAt[i] < 0) continue;
      const sp = StarBurst.pop(t - this.popAt[i], 0.03, 0.12);
      this.pops[i].set(this.v1.copy(this.land).setY(1.0), (i ? 1.3 : 1.8) * sp.scale + 1e-3, sp.opacity, 0.3 + i);
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

export const timeSkipModule: EffectModule = {
  label: 'time skip',
  category: 'hero: chrono',
  // Aimed at the spot he returns to; `radius` sizes the aim marker (the pulse).
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new TimeSkip(),
  telegraphs(effect) {
    const e = effect as TimeSkip;
    if (!e.ctx) return [];
    // The marker: where he returns, counting down to 0.6 s. The echo re-checks the same circle itself (projectile hit).
    return [{ shape: { kind: 'circle', x: e.dest.x, z: e.dest.z, radius: RADIUS }, start: 0, impact: ARRIVE_T, until: ARRIVE_T + 0.1 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TimeSkip;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as TimeSkip).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
