import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { DustPuffs, GeraldFigure, GERALD_RADIUS, MASON, MASON_CSS, ShadowStrip, StoneChunks } from '../../effects/parts/mason';
import { boltWidth } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { contains, firstSurface, type Obstacle } from '../../obstacles';
import {
  geraldHere, geraldLive, geraldOf, moodNow, raiseGeraldAt, setGeraldMood, standGerald,
} from '../../traits/mason';

/**
 * The Shove (mason kit, W: Gerald as a battering ram). Bram plants his feet and puts his shoulder to Gerald (a 0.3 s wind-up:
 * dust at both their feet, Gerald goes alarmed). The line he will slide along is on the floor from the cast: it starts at
 * Gerald's spot, runs along the aim (so the player decides) up to 8 m, and is `boltWidth(1.0)` wide, cut short where a
 * wall or pillar would stop him (`firstSurface` against the other obstacles, each grown by Gerald's radius, and the ring).
 * At 0.3 s Gerald slides at 8 m/s: his obstacle and his look go with him (the obstacle list is rebuilt when one is added
 * or removed, so a live one is not moved: it is removed at the start and a new one stands at the end spot; his unit keeps
 * his HP the whole way and is held on him). The first time an enemy stands within 1.3 m of him (live position, once per
 * enemy) it takes 60 (`projectile: true`) and is carried along with him (`ctx.carry`) until he stops. If he stops on a
 * wall, pillar or the ring's edge with someone carried, they are stunned 0.9 s, with a big thud and Gerald furious; a
 * full 8 m slide ends with a small thump. A dark scrape trails behind him. Clean by about 2.3 s.
 *
 * Network duels: both screens slide the same Gerald (the place comes from his record, the line from `ctx.aim`); each judges
 * the touch and the carry on its own hero (`ctx.carry` moves only the own hero there). Without Gerald near, nothing slides.
 * See pipeline/designs/kit-mason.md.
 */
export interface TheShoveSettings {
  damage: number;
  stunSeconds: number;
  loop: boolean;
}

export const defaultTheShove = (): TheShoveSettings => ({ damage: 70, stunSeconds: 0.9, loop: false });

// Timeline (seconds).
const WIND_T = 0.3;
const SPEED = 8;
const REACH = 8;
const BODY_R = 1.0; // the radius `boltWidth` is told (the line's width = what he really touches)
const TOUCH_R = 1.3;
const RING_X = 0;
const RING_Z = 7;
const RING_R = 11.2;
const AFTER = 1.0;

/** True when (dx, dz) points away from the obstacle's nearest spot to (x, z). */
function awayFrom(o: Obstacle, x: number, z: number, dir: THREE.Vector3) {
  const ex = o.bx - o.ax, ez = o.bz - o.az, l2 = ex * ex + ez * ez;
  const k = l2 > 0 ? Math.min(1, Math.max(0, ((x - o.ax) * ex + (z - o.az) * ez) / l2)) : 0;
  return (x - (o.ax + ex * k)) * dir.x + (z - (o.az + ez * k)) * dir.z > 0.05;
}

export class TheShoveFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TheShoveSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: boltWidth(BODY_R) };
  /** True when there is a Gerald to shove (the telegraph is empty otherwise). */
  armed = false;
  private time = 0;
  private start = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private len = 0;
  private stopped = false;
  private epoch = -1;
  private slid = false;
  private sliding = false;
  private landed = false;
  private s = 0;
  private hitSet = new Set<Enemy>();
  private trailT = 0;
  private thudAt = -1;

  private scrape = new ShadowStrip();
  private chunks = new StoneChunks(48);
  private dust = new DustPuffs(40);
  private figure = new GeraldFigure();
  private pop = new StarBurst({ points: 8, inner: 0.3, color: MASON.hot, core: MASON.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: TheShoveSettings = defaultTheShove()) {
    this.settings = settings;
    this.group.add(this.scrape.mesh, this.chunks.mesh, this.dust.mesh, this.figure.group, this.pop.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return WIND_T + this.len / SPEED + AFTER;
  }

  get impactTime() {
    return WIND_T;
  }

  /** When he stops (the telegraph's `until`). */
  get slideEnd() {
    return WIND_T + this.len / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fig = ctx.caster;
    // The VFX tool runs no trait and no Gerald: stand one 2 m in front of the caster.
    if (!geraldHere(geraldOf(fig)) && !geraldLive(fig)) {
      const f = ctx.sentFrom ?? ctx.from;
      raiseGeraldAt(fig, ctx, f.x + Math.sin(ctx.aim) * 2.2, f.z + Math.cos(ctx.aim) * 2.2);
    }
    const g = geraldOf(fig);
    this.armed = geraldHere(g);
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.start.set(g.x, 0, g.z);
    this.len = 0;
    this.stopped = false;
    if (this.armed) {
      // How far he can go: 8 m, shortened by the first surface (every other obstacle grown by his radius) and by the ring.
      const grown = (ctx.obstacles?.() ?? []).filter((o) => o !== g.obstacle).map((o) => ({ ...o, r: o.r + GERALD_RADIUS }))
        // Standing right beside a wall is no block when the slide leads away from it.
        .filter((o) => !(contains(o, g.x, g.z) && awayFrom(o, g.x, g.z, this.dir)));
      const far = { x: g.x + this.dir.x * REACH, z: g.z + this.dir.z * REACH };
      const hit = firstSurface({ x: g.x, z: g.z }, far, grown);
      let len = hit ? hit.t * REACH : REACH;
      for (let d = 0; d <= len; d += 0.1) {
        if (Math.hypot(g.x + this.dir.x * d - RING_X, g.z + this.dir.z * d - RING_Z) > RING_R) { len = Math.max(0, d - 0.1); break; }
      }
      this.len = Math.max(len, 0.05);
      this.stopped = len < REACH - 0.05;
    }
    this.line = {
      kind: 'line', x1: this.start.x, z1: this.start.z, x2: this.start.x + this.dir.x * this.len, z2: this.start.z + this.dir.z * this.len,
      width: boltWidth(BODY_R),
    };
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx || !this.armed) return;
    const g = geraldOf(ctx.caster);
    this.epoch = g.epoch;
    g.moving = true;
    setGeraldMood(ctx.caster, 'alarmed', this.slideEnd + 0.3);
  }

  /** A restart (or an end) while he is mid-slide: he stands where he is, as a real obstacle again. */
  private reset() {
    this.settle();
    this.time = 0;
    this.shake = 0;
    this.slid = this.sliding = this.landed = false;
    this.s = 0;
    this.trailT = 0;
    this.thudAt = -1;
    this.hitSet.clear();
    this.scrape.reset();
    this.chunks.reset();
    this.dust.reset();
    this.pop.set(this.start, 0, 0);
    this.groundShock.set(this.start, 0, 0);
  }

  /** Puts him down where he is if a slide was cut off (and nothing else has taken him meanwhile). */
  private settle() {
    const ctx = this.ctx;
    if (!ctx || !this.sliding || this.stale()) { this.sliding = false; return; }
    const g = geraldOf(ctx.caster);
    standGerald(ctx.caster, ctx, g.x, g.z);
    g.moving = false;
    this.sliding = false;
  }

  /** Something ended this Gerald (a break, a new Gerald, a new round) while the effect ran. */
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
    const ctx = this.ctx;
    if (ctx && !geraldLive(ctx.caster)) {
      const g = geraldOf(ctx.caster);
      if (geraldHere(g)) this.figure.set(g.x, g.z, ctx.aim + Math.PI, moodNow(ctx.caster));
      else this.figure.hide();
    } else this.figure.hide();
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (!ctx || !this.armed) {
      if (t >= WIND_T + 0.5) { this.playing = false; this.reset(); }
      return;
    }
    if (t >= this.duration && !this.chunks.busy && !this.dust.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    if (this.epoch >= 0 && this.stale() && (this.sliding || !this.landed)) {
      // Gerald broke (or went) mid-shove: nothing left to slide. The stones already thrown finish their fall.
      this.sliding = false;
      this.playing = false;
      this.scrape.reset();
      return;
    }

    // --- The wind-up: Bram digs in. Dust at both their feet, stones jump. ---
    if (t < WIND_T) {
      const k = t / WIND_T;
      this.shake = 0.05 + 0.12 * k;
      this.trailT += dt;
      if (this.trailT >= 0.06) {
        this.trailT = 0;
        const c = ctx.caster.group.position;
        this.v1.set(c.x, 0.1, c.z);
        this.dust.puff(this.v1, -this.dir.x * 1.2, 0.5, -this.dir.z * 1.2, 0.2, 0.5);
        this.v2.set(this.start.x - this.dir.x * 0.9, 0.1, this.start.z - this.dir.z * 0.9);
        this.dust.puff(this.v2, -this.dir.x * 1.5, 0.6, -this.dir.z * 1.5, 0.28, 0.6);
      }
    }

    // --- The slide: his obstacle comes off, he goes, the unit and the look with him. ---
    if (!this.slid && t >= WIND_T) {
      this.slid = true;
      this.sliding = true;
      const g = geraldOf(ctx.caster);
      if (g.obstacle) ctx.removeObstacle?.(g.obstacle);
      g.obstacle = null;
      this.shake = 0.3;
      this.v1.set(this.start.x, 0.3, this.start.z);
      this.chunks.burst(this.v1, 8, 3, 3, 0.16, this.v2.copy(this.dir).negate());
    }
    if (this.sliding) this.slide(dt, ctx);
    if (this.thudAt >= 0) {
      const a = t - this.thudAt;
      const sp = StarBurst.pop(a, 0.04, 0.16);
      const g = geraldOf(ctx.caster);
      this.pop.set(this.v1.set(g.x, 1.8, g.z), 3.2 * sp.scale, sp.opacity, a * 2);
      const k = THREE.MathUtils.clamp(a / 0.4, 0, 1);
      this.groundShock.set(this.v2.set(g.x, 0, g.z), 0.6 + 3.6 * k, 0.05 * (1 - k) * (1 - k));
    }
    this.shake *= Math.exp(-dt * 7);
    // The scrape fades after he stops.
    if (this.slid) {
      const a = Math.max(0, t - this.slideEnd);
      const w = 1.1;
      this.scrape.set(this.start.x, this.start.z, this.dir.x, this.dir.z, this.s, w, 1 - smoothstep(a / 0.9));
    }
  }

  private slide(dt: number, ctx: CastContext) {
    const g = geraldOf(ctx.caster);
    const prev = this.s;
    this.s = Math.min(this.len, this.s + SPEED * dt);
    const step = this.s - prev;
    g.x = this.start.x + this.dir.x * this.s;
    g.z = this.start.z + this.dir.z * this.s;
    // The touch, on live positions: once per enemy, then carried with him.
    const opts: HitOptions = { damage: this.settings.damage, knock: 0, from: this.v1.set(g.x, 0, g.z), color: MASON_CSS.body, projectile: true };
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      if (!this.hitSet.has(e)) {
        const p = e.group.position;
        if (Math.hypot(p.x - g.x, p.z - g.z) > TOUCH_R) continue;
        this.hitSet.add(e);
        ctx.hit(e, opts);
        this.v2.set(p.x, 1.2, p.z);
        this.chunks.burst(this.v2, 6, 3, 3, 0.14);
        this.shake = Math.max(this.shake, 0.3);
      }
      ctx.carry?.(e, this.v2.set(this.dir.x * step, 0, this.dir.z * step));
    }
    // Dust kicked up behind him.
    this.trailT += dt;
    if (this.trailT >= 0.05) {
      this.trailT = 0;
      this.v2.set(g.x - this.dir.x * 0.5, 0.1, g.z - this.dir.z * 0.5);
      this.dust.puff(this.v2, -this.dir.x * 0.8 + (Math.random() - 0.5), 0.5, -this.dir.z * 0.8 + (Math.random() - 0.5), 0.3, 0.6);
    }
    this.shake = Math.max(this.shake, 0.1);
    if (this.s >= this.len) this.land(ctx, g);
  }

  /** He stops: a new obstacle at the spot, and a thud (a big one with someone carried and a surface in the way). */
  private land(ctx: CastContext, g: ReturnType<typeof geraldOf>) {
    this.sliding = false;
    this.landed = true;
    standGerald(ctx.caster, ctx, g.x, g.z);
    g.moving = false;
    const slammed = this.stopped && this.hitSet.size > 0;
    this.v1.set(g.x, 0.2, g.z);
    this.dust.ring(this.v1.setY(0), slammed ? 12 : 7, 0.9, slammed ? 3.4 : 2, slammed ? 0.5 : 0.35, 0.9);
    this.chunks.burst(this.v1.setY(0.4), slammed ? 20 : 8, slammed ? 5.5 : 3, slammed ? 6 : 3, slammed ? 0.22 : 0.16);
    if (this.stopped) {
      this.thudAt = this.time;
      this.shake = slammed ? 0.75 : 0.4;
      // He hurt himself: furious for a moment.
      setGeraldMood(ctx.caster, 'angry', 1.0);
    } else {
      this.shake = 0.2;
      setGeraldMood(ctx.caster, 'alarmed', 0.4);
    }
    if (slammed) {
      for (const e of this.hitSet) ctx.hit(e, { damage: 0, knock: 0, from: this.v1.set(g.x, 0, g.z), color: MASON_CSS.body, projectile: true, status: { kind: 'stun', seconds: this.settings.stunSeconds } });
    }
  }
}

export const theShoveModule: EffectModule = {
  label: 'the shove',
  category: 'hero: mason',
  // Aimed along a line from Bram: Gerald's slide takes the aim's direction.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new TheShoveFx(),
  telegraphs(effect) {
    const e = effect as TheShoveFx;
    if (!e.ctx || !e.armed) return [];
    return [{ shape: e.line, start: 0, impact: WIND_T, until: e.slideEnd }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as TheShoveFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3.5);
  },
  buildGui(f, effect) {
    const s = (effect as TheShoveFx).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'stunSeconds', 0, 2, 0.1);
  },
};
