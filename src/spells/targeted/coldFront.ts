import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { GustHead, Specks, WEATHER, WEATHER_CSS_OF, WEATHER_HEX_OF } from '../../effects/parts/weather';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { COLD_DAMAGE, COLD_KNOCK, COLD_RADIUS, COLD_RANGE, COLD_SPEED, COLD_WIND, weatherOf, type Weather } from '../../traits/weather';

/**
 * Cold Front (weather kit, Q: a gust). Barry sweeps his pointer and a gust forms at his hand over the 0.25 s wind-up (three helices
 * wound round a white puff, spinning) and leaves as a real bolt (`ctx.projectile`: 9 m from him, 20 m/s, radius 0.4): 50 damage. It
 * reaches 6 m at 0.55 s. What flies with it is the weather of the moment (read from his trait's book at the cast): in Rain blue drops
 * fall off it, in Sun it sheds gold sparkles, in Wind it throws leaves. The rule is the trait's, in `dealt` (src/traits/weather.ts),
 * where the hit is decided: in Rain it slows the target for 1.5 s, in Wind it knocks them further. A hit bursts into the weather's
 * colour; a miss fades where its range ends.
 *
 * Telegraph: one thin line as wide as the bolt really hits (`boltWidth`), from the cast; its `impact` is the launch (0.25 s), so the
 * root on him ends there. Network duels: bolts fly on the victim's screen, so the caster's screen draws the same flight along the
 * same line. Clean by about 1.8 s. See pipeline/designs/kit-weather.md.
 */
export interface ColdFrontSettings {
  damage: number;
  knock: number;
}

export const defaultColdFront = (): ColdFrontSettings => ({ damage: COLD_DAMAGE, knock: COLD_KNOCK });

// Timeline and numbers.
const MUZZLE = 0.8;
const BOLT_Y = 1.1;
const MAX_T = 2.2;
const LINE_W = boltWidth(COLD_RADIUS);
const FLIGHT = COLD_RANGE - MUZZLE;
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class ColdFront implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ColdFrontSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  start = new THREE.Vector3();
  dir = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private fired = false;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown by the drawn-only bolt (-1: none, -2: done)
  private goneAt = -1;
  private weather: Weather = 0;
  private trailT = 0;
  private tip = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  private starAt = new THREE.Vector3();
  private starAge = 9;

  private head = new GustHead();
  private specks = new Specks(90);
  private star = new StarBurst({ points: 8, inner: 0.35, color: WEATHER.accent, core: WEATHER.core, additive: false });
  private v1 = new THREE.Vector3();

  constructor(settings: ColdFrontSettings = defaultColdFront()) {
    this.settings = settings;
    this.group.add(this.head.mesh, this.specks.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return COLD_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line: only sentFrom and the aim point.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    this.tip.set(ctx.from.x + dx * 0.8, 1.3, ctx.from.z + dz * 0.8);
  }

  play() {
    this.reset();
    this.playing = true;
    if (this.ctx) this.weather = weatherOf(this.ctx.caster);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.bolt = null;
    this.drawn = -1;
    this.goneAt = -1;
    this.trailT = 0;
    this.starAge = 9;
    this.head.hide();
    this.specks.reset();
    this.star.set(this.starAt, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.specks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;
    const hex = WEATHER_HEX_OF[this.weather];

    // --- Wind-up: the gust forms at his hand, growing and spinning. ---
    if (!this.fired) {
      const k = easeOut(t / COLD_WIND);
      this.head.place(this.tip, this.dir.x, this.dir.z, t, k, hex);
      this.trailT += dt;
      if (this.trailT >= 0.05) { this.trailT = 0; this.shed(this.tip, 0.5); }
    }

    // --- Fire. A real bolt where there is one; else (a network duel's caster screen) a drawn bolt along the same line. ---
    if (!this.fired && t >= COLD_WIND) {
      this.fired = true;
      this.shake = 0.06;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: COLD_SPEED, range: FLIGHT, radius: COLD_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: WEATHER_CSS_OF[this.weather] },
        });
        this.bolt.onHit((_target, at) => this.land(at, true));
      } else {
        this.drawn = 0;
      }
    }

    // --- The head rides the bolt (or the drawn line), shedding the weather's own specks. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.lastPos.copy(b.pos); this.ride(b.pos, dt, hex); }
    } else if (this.drawn >= 0) {
      this.drawn += COLD_SPEED * dt;
      live = this.drawn < FLIGHT;
      if (live) {
        this.v1.set(this.start.x + this.dir.x * this.drawn, BOLT_Y, this.start.z + this.dir.z * this.drawn);
        this.lastPos.copy(this.v1);
        this.ride(this.v1, dt, hex);
      } else this.drawn = -2;
    }
    if (this.fired && !live && this.goneAt < 0) {
      this.goneAt = t;
      this.head.hide();
      if (this.starAge > 8) this.land(this.lastPos, false);
    }

    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0.05, 0.18);
    this.star.set(this.starAt, 1.8 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 12);

    if ((this.goneAt >= 0 && t >= this.goneAt + 0.9 && !this.specks.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  private ride(pos: THREE.Vector3, dt: number, hex: number) {
    this.head.place(pos, this.dir.x, this.dir.z, this.time, 1, hex);
    this.trailT += dt;
    if (this.trailT >= 0.03) { this.trailT = 0; this.shed(pos, 1); }
  }

  /** One of the weather's own specks off the gust: a drop, a sparkle or a leaf. */
  private shed(at: THREE.Vector3, k: number) {
    const jx = (Math.random() - 0.5) * 0.6, jz = (Math.random() - 0.5) * 0.6;
    if (this.weather === 0) this.specks.spawn(at.x + jx, at.y + 0.2, at.z + jz, -this.dir.x * 2, 0.5, -this.dir.z * 2, 0.7, 0.16 * k, 0x9fdcff, 9, 0.4);
    else if (this.weather === 1) this.specks.spawn(at.x + jx, at.y + 0.1, at.z + jz, jx, 0.8, jz, 0.8, 0.14 * k, WEATHER.sun, -0.5, 1.5);
    else this.specks.spawn(at.x + jx, at.y, at.z + jz, -this.dir.x * 4 + jx * 2, 0.6, -this.dir.z * 4 + jz * 2, 0.9, 0.17 * k, Math.random() < 0.5 ? 0x8fbf6a : 0xd08a3c, 1, 0.8);
  }

  /** The gust ends: a pop in the weather's colour (bigger on a hit). */
  private land(at: THREE.Vector3, hit: boolean) {
    this.starAt.set(at.x, BOLT_Y, at.z);
    this.starAge = 0;
    this.specks.burst(at.x, BOLT_Y, at.z, hit ? 22 : 8, hit ? 5 : 2.5, 0.8, 0.18, WEATHER_HEX_OF[this.weather], 5);
    this.shake = hit ? 0.14 : 0.04;
    this.head.hide();
    this.goneAt = this.goneAt < 0 ? this.time : this.goneAt;
  }
}

export const coldFrontModule: EffectModule = {
  label: 'cold front',
  category: 'hero: weather',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: COLD_RADIUS },
  create: () => new ColdFront(),
  telegraphs(effect) {
    const e = effect as ColdFront;
    if (!e.ctx) return [];
    const s = e.ctx.sentFrom ?? e.ctx.from;
    const spec: TelegraphSpec = {
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: s.x + e.dir.x * COLD_RANGE, z2: s.z + e.dir.z * COLD_RANGE, width: LINE_W },
      start: 0,
      impact: COLD_WIND,
      until: COLD_WIND + FLIGHT / COLD_SPEED,
    };
    return [spec];
  },
  bloom: { enabled: true, strength: 0.25, radius: 0.3, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as ColdFront;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ColdFront).settings;
    f.add(s, 'damage', 0, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
