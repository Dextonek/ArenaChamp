import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { Afterimage, CHRONO, CHRONO_CSS, ECHO_GOLD, EchoClock, Hand } from '../../effects/parts/chrono';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { ECHO_DELAY, echoShare, stolenOn } from '../../traits/chrono';

/**
 * Tick (chrono kit v5, Q: a skillshot, label 'tick bolt'). A 0.25 s wind-up in which a small star swells at his staff; at
 * 0.25 s a spinning clock hand leaves as a bolt (`ctx.projectile`, 20 m/s, 9 m, radius 0.35: it reaches 6 m at about 0.52 s)
 * with two pale afterimages behind it. A hit is `damage` (50). A direct hit also takes 1 s off Q: that is his trait's
 * (`landed`), not this file's. THE ECHO (his passive): at the moment of the cast a ghost clock lies at his feet and a long
 * ghost hand along the aim line, both in his palette (gold while Stolen Hour runs), and stay until the echo fires. 1.5 s
 * after the first release (1.75 s) the clock flashes and a second bolt flies the same line from the same start, a paler
 * hand with a gold-or-ivory ring at the muzzle, for `damage` x the echo share (`echoShare`: 40% = 20, or 80% while Stolen
 * Hour runs). The echo is a second `ctx.projectile`, so stepping off the line works on it too. Online the dealer's screen
 * has no bolts: both hands fly there as drawing only. Clean by 2.45 s. If a cast could restart this effect before the echo
 * has flown (Q's cooldown is 3 s, and a direct hit takes 1 s off it: 2.0 s), the echo bolt's drawing is cut but the bolt
 * itself still flies and hits. See pipeline/designs/kit-chrono.md.
 */
export interface TickBoltSettings {
  /** The first hit; the echo is this x the echo share. */
  damage: number;
  loop: boolean;
}

export const defaultTickBolt = (): TickBoltSettings => ({ damage: 50, loop: false });

// Timeline (seconds).
const RELEASE_T = 0.25;
const ECHO_T = RELEASE_T + ECHO_DELAY;
const SPEED = 20;
const RANGE = 9;
const RADIUS = 0.35;
const MUZZLE = 0.6;
const FLIGHT = RANGE / SPEED;
const DURATION = ECHO_T + FLIGHT + 0.25;
const UP = new THREE.Vector3(0, 1, 0);

/** One flying clock hand: a spinning blade with a short red second hand and two afterimages, riding a bolt (or, with none, a drawing-only flight). */
class TickHand {
  readonly rig = new THREE.Group();
  readonly hand = new Hand(CHRONO.body, 0.05);
  readonly red = new Hand(CHRONO.accent, 0.04);
  readonly ghosts = new Afterimage(2);
  active = false;
  readonly pos = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private from = new THREE.Vector3();
  private bolt: Projectile | null = null;
  private age = 0;
  private roll = 0;
  private fade = -1;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor() {
    this.rig.add(this.hand.group, this.red.group);
    this.reset();
  }

  /** Sends it from `from` along `dir`; `bolt` is the real projectile (null: a drawing-only flight on this screen). */
  launch(from: THREE.Vector3, dir: THREE.Vector3, bolt: Projectile | null, gold: boolean, alpha: number) {
    this.reset();
    this.active = true;
    this.from.copy(from);
    this.pos.copy(from);
    this.dir.copy(dir);
    this.bolt = bolt;
    this.hand.color = gold ? ECHO_GOLD : CHRONO.body;
    this.hand.alpha = alpha;
    this.red.alpha = alpha;
    this.place(0);
    this.ghosts.trail(this.rig, 2, 0.045);
  }

  private place(dt: number) {
    this.roll += dt * 13;
    const d = this.dir;
    this.v1.set(-d.z, 0, d.x);
    this.v2.copy(UP).multiplyScalar(Math.cos(this.roll)).addScaledVector(this.v1, Math.sin(this.roll));
    // The blade's tail sits behind the bolt's point so its tip leads.
    this.v3.set(this.pos.x, BOLT_HEIGHT, this.pos.z).addScaledVector(d, -0.55);
    this.hand.point(this.v3, d, this.v2, 1.3, 0.36);
    this.v2.copy(UP).multiplyScalar(Math.sin(this.roll * 0.7)).addScaledVector(this.v1, Math.cos(this.roll * 0.7));
    this.red.point(this.v3.addScaledVector(d, 0.15), d, this.v2, 0.75, 0.16);
  }

  update(dt: number) {
    this.ghosts.update(dt);
    if (!this.active) return;
    let alive: boolean;
    if (this.bolt) {
      this.pos.copy(this.bolt.pos);
      this.dir.copy(this.bolt.dir);
      alive = this.bolt.alive;
    } else {
      this.age += dt;
      const dist = Math.min(RANGE - MUZZLE, SPEED * this.age);
      this.pos.copy(this.from).addScaledVector(this.dir, dist);
      alive = dist < RANGE - MUZZLE;
    }
    if (!alive && this.fade < 0) {
      this.fade = 0;
      this.ghosts.fade(0.15);
    }
    if (this.fade >= 0) {
      this.fade += dt;
      const k = 1 - Math.min(1, this.fade / 0.12);
      this.hand.alpha = this.red.alpha = k;
      if (k <= 0) {
        this.active = false;
        this.hand.hide();
        this.red.hide();
        return;
      }
    }
    this.place(dt);
  }

  reset() {
    this.active = false;
    this.bolt = null;
    this.age = 0;
    this.roll = 0;
    this.fade = -1;
    this.hand.hide();
    this.red.hide();
    this.hand.alpha = this.red.alpha = 1;
    this.ghosts.reset();
  }
}

export class TickBolt implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TickBoltSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: boltWidth(RADIUS) };
  private time = 0;
  private fired = false;
  private echoed = false;
  private fwd = new THREE.Vector3(0, 0, 1);
  /** Where the bolts start (the same for the echo), and where the ghost clock lies. */
  private shotFrom = new THREE.Vector3();
  private origin = new THREE.Vector3();
  private gold = false;
  private hitAt = [-1, -1];
  private hitPos = [new THREE.Vector3(), new THREE.Vector3()];

  // Parts.
  private first = new TickHand();
  private echo = new TickHand();
  private clock = new EchoClock(9);
  private ghostHand = new Hand(CHRONO.body, 0.05);
  private nock = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: CHRONO.hot, core: CHRONO.core, additive: false });
  private echoNock = new StarBurst({ points: 8, inner: 0.3, color: CHRONO.foil, core: CHRONO.core, additive: false });
  private pops = [0, 1].map((i) => new StarBurst({ points: 8, inner: 0.3, color: i ? CHRONO.foil : CHRONO.accent, core: CHRONO.core, additive: false }));
  private ring = new ShockRefraction({ facing: 'ground' });
  private echoRing = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: TickBoltSettings = defaultTickBolt()) {
    this.settings = settings;
    this.group.add(
      this.clock.group, this.ghostHand.group, this.first.rig, this.first.ghosts.group, this.echo.rig, this.echo.ghosts.group,
      this.nock.mesh, this.echoNock.mesh, ...this.pops.map((p) => p.mesh), this.ring.mesh, this.echoRing.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return RELEASE_T;
  }

  /** The first bolt's last moment, for the telegraph. */
  get flightEnd() {
    return RELEASE_T + FLIGHT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.shotFrom.copy(ctx.from).setY(0).addScaledVector(this.fwd, MUZZLE);
    this.origin.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.fwd.x * RANGE, z2: ctx.from.z + this.fwd.z * RANGE,
      width: boltWidth(RADIUS),
    };
  }

  play() {
    this.reset();
    this.playing = true;
    // The ghost: a clock at his feet and a long hand along the line, from the moment of the cast until the echo.
    this.gold = !!this.ctx && stolenOn(this.ctx.caster);
    this.clock.gold(this.gold);
    this.clock.show(this.v1.copy(this.origin).setY(0.06), 1.0, UP, ECHO_T);
    this.ghostHand.orient(this.v1.set(this.fwd.x, 0, this.fwd.z), UP);
    this.ghostHand.color = this.gold ? ECHO_GOLD : CHRONO.body;
    this.paintGhostHand(0);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = this.echoed = false;
    this.hitAt[0] = this.hitAt[1] = -1;
    this.first.reset();
    this.echo.reset();
    this.clock.reset();
    this.ghostHand.hide();
    for (const p of this.pops) p.set(this.origin, 1e-3, 0);
    this.nock.set(this.origin, 1e-3, 0);
    this.echoNock.set(this.origin, 1e-3, 0);
    this.ring.set(this.origin, 0, 0);
    this.echoRing.set(this.origin, 0, 0);
  }

  /** The ghost hand lies on the line from his feet to full range; it pulses, and brightens before the echo fires. */
  private paintGhostHand(t: number) {
    const left = ECHO_T - t;
    const pulse = 0.5 + 0.5 * Math.sin(t * 9);
    this.ghostHand.alpha = 0.3 + 0.1 * pulse + (left < 0.3 ? 0.4 * (1 - Math.max(0, left) / 0.3) : 0);
    this.v2.copy(this.origin).setY(0.07);
    this.ghostHand.point(this.v2, this.fwd, UP, RANGE, 0.9);
  }

  /** Fires one bolt from the cast's start along the line; with no `ctx.projectile` on this screen it is drawing only. */
  private shoot(h: TickHand, damage: number, slot: 0 | 1, alpha: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    let bolt: Projectile | null = null;
    if (ctx.projectile) {
      bolt = ctx.projectile({
        from: this.shotFrom.clone(), dir: this.fwd.clone(), speed: SPEED, range: RANGE - MUZZLE, radius: RADIUS,
        hit: { damage, knock: 0.4, color: CHRONO_CSS.body },
      });
      bolt.onHit((_target, at) => {
        this.hitAt[slot] = this.time;
        this.hitPos[slot].set(at.x, BOLT_HEIGHT, at.z);
        this.shake = Math.max(this.shake, slot ? 0.08 : 0.16);
      });
    }
    h.launch(this.shotFrom, this.fwd, bolt, this.gold && slot === 1, alpha);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.first.update(dt);
    this.echo.update(dt);
    this.clock.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    const ctx = this.ctx;

    // --- The wind-up: a star swells at the staff. ---
    const swell = t < RELEASE_T ? smoothstep(t / RELEASE_T) : 0;
    const flash = StarBurst.pop(t - RELEASE_T, 0, 0.04);
    this.v1.copy(this.origin).addScaledVector(this.fwd, 0.55).setY(1.3);
    this.nock.set(this.v1, 0.3 * swell + 0.8 * flash.scale + 1e-3, swell * 0.9 + flash.opacity, t * 4);

    if (!this.fired && t >= RELEASE_T) {
      this.fired = true;
      this.shoot(this.first, this.settings.damage, 0, 1);
      this.ring.set(this.v1.copy(this.origin).addScaledVector(this.fwd, 0.5), 0.5, 0.03);
    }

    // --- The echo: the clock flashes and a second bolt flies the same line from the same start. ---
    if (!this.echoed && t >= ECHO_T) {
      this.echoed = true;
      this.gold = !!ctx && stolenOn(ctx.caster);
      this.clock.gold(this.gold);
      this.clock.fire();
      this.shoot(this.echo, Math.round(this.settings.damage * (ctx ? echoShare(ctx.caster) : 0.4)), 1, 0.8);
      this.shake = Math.max(this.shake, 0.1);
    }
    if (t >= ECHO_T) {
      const a = t - ECHO_T;
      this.ghostHand.alpha = Math.max(0, 1 - a / 0.2);
      if (a > 0.2) this.ghostHand.hide();
      else this.paintGhostHand(ECHO_T);
      const sp = StarBurst.pop(a, 0.03, 0.12);
      this.v1.copy(this.origin).addScaledVector(this.fwd, 0.55).setY(1.3);
      this.echoNock.set(this.v1, 1.2 * sp.scale + 1e-3, sp.opacity, 0.5);
      const g = smoothstep(a / 0.35);
      this.echoRing.set(this.v2.copy(this.origin), 0.5 + 2.2 * g, 0.04 * (1 - g) * (1 - g));
    } else this.paintGhostHand(t);

    // --- Hit stars. ---
    for (let i = 0; i < 2; i++) {
      if (this.hitAt[i] < 0) continue;
      const age = t - this.hitAt[i];
      const sp = StarBurst.pop(age, 0.02, 0.06);
      this.pops[i].set(this.hitPos[i], (i ? 0.8 : 1.1) * sp.scale + 1e-3, sp.opacity, 0.3);
    }

    this.shake *= Math.exp(-dt * 12);
    if (t >= DURATION && !this.first.active && !this.echo.active) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
    }
  }
}

export const tickBoltModule: EffectModule = {
  label: 'tick bolt',
  category: 'hero: chrono',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new TickBolt(),
  telegraphs(effect) {
    const e = effect as TickBolt;
    if (!e.ctx) return [];
    // The first bolt only: the echo is a bolt too (its touch is the dodge check) and the ghost hand marks its line.
    return [{ shape: e.line, start: 0, impact: RELEASE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TickBolt;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as TickBolt).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
