import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { boltWidth, type Projectile } from '../../effects/projectile';
import { Confetti, PebbleBolt, Slingshot, Streaks, ToyWords, TWINS, TWINS_CSS } from '../../effects/parts/twins';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import { PEBBLE_DAMAGE, PEBBLE_RADIUS, PEBBLE_RANGE, PEBBLE_SPEED, PEBBLE_WIND } from '../../traits/twins';

/**
 * Pebble (twins kit, Pom's Q: a slingshot). Pom holds the slingshot out and pulls the band back over the 0.3 s wind-up (a little
 * shake as it stretches), then lets go: a grey pebble flies as a real bolt (`ctx.projectile`: 9 m from her, 22 m/s, radius 0.3), tumbling,
 * with a few pale streaks behind it. It reaches 6 m at 0.57 s. A hit gives 45, a star, confetti and the word PING; a miss ends in a
 * small puff where it stops (at 9 m or at cover). Telegraph: one thin line as wide as the bolt really hits (`boltWidth`), shown from
 * the cast to the end of its flight; the impact is the release (0.3 s), so the root on her ends there. Network duels: bolts fly on the
 * victim's screen, so the caster's screen draws the same pebble along the same line. Clean by about 1.8 s. See pipeline/designs/kit-twins.md.
 */
export interface PomPebbleSettings {
  damage: number;
  knock: number;
}

export const defaultPomPebble = (): PomPebbleSettings => ({ damage: PEBBLE_DAMAGE, knock: 2 });

const MUZZLE = 0.8;
const LINE_W = boltWidth(PEBBLE_RADIUS);
const BOLT_Y = 1.1;
const MAX_T = 2.4;
const SPIN = 14;

export class PomPebble implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PomPebbleSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private drawn = -1;
  private trailT = 0;
  private yaw = 0;
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private tip = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  private len = PEBBLE_RANGE - MUZZLE;
  private ended = false;

  private sling = new Slingshot();
  private pebble = new PebbleBolt();
  private streaks = new Streaks(16);
  private bits = new Confetti(24);
  private words = new ToyWords(2);
  private star = new StarBurst({ points: 8, inner: 0.3, color: TWINS.pom, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: PomPebbleSettings = defaultPomPebble()) {
    this.settings = settings;
    this.group.add(this.sling.mesh, this.pebble.mesh, this.streaks.mesh, this.bits.mesh, this.words.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return PEBBLE_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens agree on the line: only sentFrom, the aim and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= l; dz /= l; }
    this.dir.set(dx, 0, dz);
    this.yaw = Math.atan2(dx, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    const path = bankPath(this.start, this.dir, PEBBLE_RANGE - MUZZLE, 0, ctx.obstacles?.() ?? [], 0);
    const e = path[path.length - 1];
    this.end.set(e.x, 0, e.z);
    this.len = Math.hypot(e.x - this.start.x, e.z - this.start.z);
    const flight = PEBBLE_WIND + (this.len + MUZZLE) / PEBBLE_SPEED;
    this.specs = [{
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: e.x, z2: e.z, width: LINE_W },
      start: 0,
      impact: PEBBLE_WIND,
      until: flight,
    }];
    this.tip.set(s.x + dx * 0.7 + dz * 0.3, 1.15, s.z + dz * 0.7 - dx * 0.3);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.ended = false;
    this.goneAt = -1;
    this.bolt = null;
    this.drawn = -1;
    this.trailT = 0;
    this.streaks.reset();
    this.bits.reset();
    this.words.reset();
    this.sling.hide();
    this.pebble.mesh.visible = false;
    this.star.set(this.end, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.streaks.update(dt);
    this.bits.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: the slingshot is held out and the band is pulled back, trembling. ---
    if (t < PEBBLE_WIND + 0.2) {
      const k = Math.min(1, t / PEBBLE_WIND);
      this.sling.place(this.tip, this.yaw, t < PEBBLE_WIND ? Math.sin(t * 55) * 0.05 * k : 0);
      this.sling.draw(t < PEBBLE_WIND ? k : Math.max(0, 1 - (t - PEBBLE_WIND) / 0.06));
      this.sling.loaded(t < PEBBLE_WIND);
    } else this.sling.hide();

    // --- Release. A real bolt where there is one; else (a network duel's caster screen) a drawn one along the same line. ---
    if (!this.fired && t >= PEBBLE_WIND) {
      this.fired = true;
      this.shake = 0.04;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: PEBBLE_SPEED, range: PEBBLE_RANGE - MUZZLE, radius: PEBBLE_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: TWINS_CSS.pom },
        });
        const thrown = this.bolt;
        thrown.onHit((_target, at) => { if (this.bolt === thrown) this.onHit(at); });
      } else {
        this.drawn = 0;
      }
    }

    // --- The pebble rides the bolt (or the drawn line), tumbling, with a few streaks behind it. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.lastPos.copy(b.pos); this.ride(b.pos, b.dir, dt); }
    } else if (this.drawn >= 0) {
      this.drawn += PEBBLE_SPEED * dt;
      live = this.drawn < this.len;
      if (live) {
        this.v1.set(this.start.x + this.dir.x * this.drawn, BOLT_Y, this.start.z + this.dir.z * this.drawn);
        this.lastPos.copy(this.v1);
        this.ride(this.v1, this.dir, dt);
      } else this.drawn = -2;
    }
    if (this.fired && !live && this.goneAt < 0) {
      this.goneAt = t;
      this.pebble.mesh.visible = false;
      // A miss ends in a small puff where it stops.
      if (!this.ended) this.land(0.8, 5);
    }
    if (this.goneAt >= 0) {
      const a = t - this.goneAt;
      const sp = StarBurst.pop(a, 0.03, 0.14);
      this.star.set(this.v1.set(this.lastPos.x, BOLT_Y, this.lastPos.z), (this.ended ? 1.5 : 0.7) * sp.scale, sp.opacity, a * 6);
    }
    this.shake *= Math.exp(-dt * 12);
    if ((this.goneAt >= 0 && t >= this.goneAt + 0.8) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  private ride(pos: THREE.Vector3, dir: THREE.Vector3, dt: number) {
    this.pebble.mesh.visible = true;
    this.pebble.mesh.position.copy(pos);
    this.pebble.spin(this.time * SPIN);
    this.trailT += dt;
    if (this.trailT >= 0.05) {
      this.trailT = 0;
      this.streaks.burst(this.v2.copy(pos).addScaledVector(dir, -0.3), this.v1.copy(dir).negate(), 1, 0.7, 0xffffff, 1.5, 0.15);
    }
  }

  private land(size: number, count: number) {
    this.v2.set(this.lastPos.x, 0.5, this.lastPos.z);
    this.bits.pop(this.v2, count, 3, size, [TWINS.pom, TWINS.stone, 0xffffff]);
  }

  /** A hit: a star, confetti and PING. */
  private onHit(at: THREE.Vector3) {
    this.ended = true;
    this.lastPos.copy(at);
    this.land(1, 12);
    this.shake = 0.1;
    this.words.say('PING', this.v1.set(at.x, 0, at.z), 1.3, 0.8, TWINS_CSS.pom, 1.9);
  }
}

export const pomPebbleModule: EffectModule = {
  label: 'pebble',
  category: 'hero: twins',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: PEBBLE_RADIUS },
  create: () => new PomPebble(),
  telegraphs(effect) {
    const e = effect as PomPebble;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PomPebble;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as PomPebble).settings;
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
