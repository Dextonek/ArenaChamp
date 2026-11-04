import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { FROST, FROST_CSS, FrostFerns, IceCrystals, IceStreak, Snow } from '../../effects/parts/frost';
import { blocksSight } from '../../obstacles';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import {
  ICICLE_RANGE, ICICLE_SPEED, ICICLE_STAY, ICICLE_WIND, SHATTER_RADIUS, icicles, type IcicleRecord,
} from '../../traits/frost';

/**
 * Icicle (frost kit v5, Q: a piercing skillshot, then Shatter on the recast; `src/traits/frost.ts` is the rules). Cast: she
 * breathes a long icicle into being at her hand (0.3 s wind-up, `ICICLE_WIND`), which then flies down the aim at 22 m/s,
 * 11 m (`ctx.projectile`, piercing, radius 0.35): 52 damage and 2 Chill to everything it touches (the trait adds the Chill).
 * It reaches 6 m at 0.57 s. At the end of its flight, or where cover stopped it, it sticks in the floor and stands there for
 * 2 s: the standing icicle and a pale 2 m ring around it are the trait's ground mark (`marks`, `icicleStandingLook`), drawn on
 * both screens from the `icicles` record this effect writes at the cast. The record's spot is worked out at the cast from
 * `sentFrom` (else `from`) and the aim, stepping the 11 m line with the engine's own sight test (`blocksSight` against
 * `ctx.obstacles()`), so both screens of a network duel agree without a bolt flying on the caster's screen.
 * Recast (the trait's free second cast, `arm` 1.3 s, open to 2.8 s): the effect tells the two apart itself, by a clock per
 * caster figure (a second cast within 3 s of an unshattered first one is the Shatter; the `mode` setting forces one). The
 * standing icicle cracks (a flare, a ring of fern cracks to 2 m), and 0.15 s later bursts: 30 damage and 1 Chill (the trait)
 * to everyone whose live position is within 2 m of the spot (`projectile: true`). If the icicle has already melted (the press
 * is later than 2 s after it stuck: a short flight melts before the window closes) or is gone, the Shatter only puffs snow.
 * Clean by about 1.5 s (the Shatter 1.0). The `icicles` record, not this effect, outlives the cast: the CPU's side reuses
 * one effect for every cast of the label.
 */
export interface IcicleSettings {
  /** The bolt's hit and the Shatter's hit. */
  damage: number;
  shatterDamage: number;
  /** 'auto' reads the recast clock; 'icicle' / 'shatter' force a variant (the tool's play button). */
  mode: 'auto' | 'icicle' | 'shatter';
  loop: boolean;
}

export const defaultIcicle = (): IcicleSettings => ({ damage: 42, shatterDamage: 26, mode: 'auto', loop: false });

// Timeline (seconds).
const SHATTER_T = 0.15; // the standing icicle cracks, then bursts
const TAIL = 0.9; // after the icicle sticks the effect still runs this long (shards, snow)
const SHATTER_DURATION = 1.0;
const FIZZLE_DURATION = 0.6;
const BOLT_RADIUS = 0.35;
const BOLT_Y = 1.1;
const RECAST_CLOCK = 3000; // ms: a cast inside this after an unshattered first cast is the Shatter
const FLY_LEN = 1.1; // the drawn icicle in flight
const STEP = 0.1; // the cast's cover test steps the line this far at a time
const KNOCK = 1;

/** How far down the line from `o` the icicle gets (the engine's own sight test, stepped), at most `ICICLE_RANGE`. */
function reach(o: THREE.Vector3, fwd: THREE.Vector3, obstacles: ReturnType<NonNullable<CastContext['obstacles']>> | undefined) {
  if (!obstacles || obstacles.length === 0) return ICICLE_RANGE;
  const p = new THREE.Vector3();
  for (let s = STEP; s <= ICICLE_RANGE + 1e-6; s += STEP) {
    p.copy(o).addScaledVector(fwd, s);
    if (blocksSight(o, p, obstacles)) return Math.max(0, s - STEP);
  }
  return ICICLE_RANGE;
}

export class Icicle implements Effect {
  readonly group = new THREE.Group();
  readonly settings: IcicleSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** True when the last cast is the Shatter. */
  shatter = false;
  /** The bolt's path (first cast) and the Shatter's ring. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: boltWidth(BOLT_RADIUS) };
  ring: TelegraphShape = { kind: 'circle', x: 0, z: 0, radius: SHATTER_RADIUS };
  /** The Shatter found a standing icicle (else it only puffs). */
  live = false;
  private rec: IcicleRecord | null = null;
  private time = 0;
  private fired = false;
  private arrived = false;
  private burst = false;
  private flight = -1;
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;
  private hitAt = -1;
  private hitPos = new THREE.Vector3();
  private shedT = 0;
  /** Where the first cast starts, the line, how far it gets, and where the icicle sticks / the Shatter bursts. */
  private o = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private len = ICICLE_RANGE;
  private spot = new THREE.Vector3();

  // Parts.
  private crystals = new IceCrystals({ maxSpikes: 8, maxShards: 90 });
  private ferns = new FrostFerns({ variant: 0, maxShards: 24 });
  private streak = new IceStreak();
  private snow = new Snow({ max: 60 });
  private pop = new StarBurst({ points: 8, inner: 0.3, color: FROST.accent, core: FROST.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: IcicleSettings = defaultIcicle()) {
    this.settings = settings;
    this.ferns.renderOrder = 2;
    this.group.add(this.ferns.mesh, this.crystals.mesh, this.streak.mesh, this.snow.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    if (this.shatter) return this.live ? SHATTER_DURATION : FIZZLE_DURATION;
    return ICICLE_WIND + this.len / ICICLE_SPEED + TAIL;
  }

  get impactTime() {
    return this.shatter ? SHATTER_T : ICICLE_WIND;
  }

  /** When the bolt's flight ends (the telegraph's strip stops here). */
  get flightEnd() {
    return ICICLE_WIND + this.len / ICICLE_SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const now = performance.now();
    const prev = icicles.get(ctx.caster);
    const m = this.settings.mode;
    const auto = !!prev && !prev.shattered && now - prev.castAt < RECAST_CLOCK;
    this.shatter = m === 'shatter' || (m === 'auto' && auto);
    this.o.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.len = reach(this.o, this.fwd, ctx.obstacles?.());
    if (this.shatter) {
      // A forced Shatter with no icicle (the tool) bursts where a first cast would have stuck.
      const rec = prev ?? this.fresh(now, true);
      this.live = !rec.gone && now >= rec.bornAt && now < rec.until;
      rec.shattered = true;
      if (this.live) rec.gone = true;
      this.rec = rec;
      this.spot.set(rec.x, 0, rec.z);
      this.ring = { kind: 'circle', x: rec.x, z: rec.z, radius: SHATTER_RADIUS };
    } else {
      this.live = false;
      this.rec = this.fresh(now, false);
      icicles.set(ctx.caster, this.rec);
      this.spot.copy(this.o).addScaledVector(this.fwd, this.len);
      this.line = {
        kind: 'line', x1: this.o.x, z1: this.o.z, x2: this.spot.x, z2: this.spot.z, width: boltWidth(BOLT_RADIUS),
      };
    }
  }

  /** A new record for a first cast: where it sticks and when (the same numbers on both screens). */
  private fresh(now: number, standing: boolean): IcicleRecord {
    const x = this.o.x + this.fwd.x * this.len, z = this.o.z + this.fwd.z * this.len;
    const bornAt = standing ? now - 1 : now + (ICICLE_WIND + this.len / ICICLE_SPEED) * 1000;
    return { x, z, yaw: Math.atan2(this.fwd.x, this.fwd.z), castAt: now, bornAt, until: bornAt + ICICLE_STAY * 1000, shattered: false, gone: false };
  }

  play() {
    this.reset();
    this.playing = true;
    if (this.shatter) {
      this.startShatter();
      return;
    }
    // The icicle forms at her hand and grows through the wind-up.
    this.hand(this.v1);
    this.flight = this.crystals.spike(this.v1, this.fwd, FLY_LEN, 0.26, ICICLE_WIND, 0);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = this.arrived = this.burst = false;
    this.bolt = null;
    this.flight = -1;
    this.hitAt = -1;
    this.shedT = 0;
    this.crystals.reset();
    this.ferns.reset();
    this.snow.reset();
    this.streak.set(this.o, this.o, 0, 0);
    this.pop.set(this.o, 0, 0);
    this.shock.set(this.o, 0, 0);
  }

  /** Her hand: in front of her live position at chest height. */
  private hand(out: THREE.Vector3) {
    const c = this.ctx?.caster.group.position;
    out.set(c ? c.x : this.o.x, 1.25, c ? c.z : this.o.z).addScaledVector(this.fwd, 0.55);
    return out;
  }

  /** The Shatter: the standing icicle cracks and a ring of fern cracks runs out to the 2 m reach. */
  private startShatter() {
    if (!this.live) {
      // Nothing to shatter: a puff of snow at her hand.
      this.hand(this.v1);
      this.snow.scatter(this.v1, 6, 1.4, 0.5);
      return;
    }
    this.v1.copy(this.spot).setY(0);
    this.crystals.spike(this.v1, this.v2.set(0.06, 1, 0.04), 1.5, 0.36, 0, 0);
    this.ferns.grow(this.v1, SHATTER_RADIUS + 0.15, SHATTER_T, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crystals.update(dt);
    this.ferns.update(dt);
    this.snow.update(dt);
    this.time += dt;
    if (this.time >= this.duration) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    if (this.shatter) this.updateShatter(this.time);
    else this.updateBolt(this.time, dt);
    this.drawPop();
    this.shake *= Math.exp(-dt * 12);
  }

  /** The first cast: grow at her hand, fire at 0.3 s, fly, stick. */
  private updateBolt(t: number, dt: number) {
    const ctx = this.ctx;
    if (!this.fired && t < ICICLE_WIND) {
      // Wind-up: the icicle grows at her hand and points down the aim.
      this.hand(this.v1);
      this.crystals.place(this.flight, this.v1, this.fwd);
      return;
    }
    if (!this.fired) {
      this.fired = true;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.o.clone(), dir: this.fwd.clone(), speed: ICICLE_SPEED, range: ICICLE_RANGE, radius: BOLT_RADIUS, pierce: true,
          hit: { damage: this.settings.damage, knock: KNOCK, color: FROST_CSS.hot },
        });
        this.bolt.onHit((_target, at) => this.onHit(at));
      }
      this.shake = 0.1;
    }
    const s = Math.min(this.len, (t - ICICLE_WIND) * ICICLE_SPEED);
    if (!this.arrived) {
      // The drawn icicle straddles the bolt: tip a little ahead, base behind. The line is the same on both screens.
      this.v1.copy(this.o).addScaledVector(this.fwd, s - 0.6).setY(BOLT_Y);
      this.crystals.place(this.flight, this.v1, this.fwd, FLY_LEN);
      this.v2.copy(this.o).addScaledVector(this.fwd, s).setY(BOLT_Y);
      this.v3.copy(this.v2).addScaledVector(this.fwd, -Math.min(2.4, s + 0.4));
      this.streak.set(this.v2, this.v3, 0.2, 0.8);
      this.shedT -= dt;
      if (this.shedT <= 0) {
        this.shedT = 0.05;
        this.snow.scatter(this.v3, 1, 0.8, 0.5);
      }
    }
    if (!this.arrived && s >= this.len - 1e-4) {
      // It sticks: the flying icicle breaks into a few shards and the standing one (the trait's mark) takes its place.
      this.arrived = true;
      this.crystals.shatter(3, 3, 0.35);
      this.streak.set(this.o, this.o, 0, 0);
      this.v1.copy(this.spot).setY(0.2);
      this.snow.scatter(this.v1, 8, 2.2, 0.7);
      this.hitAt = t;
      this.hitPos.copy(this.spot).setY(0.9);
      this.shake = 0.08;
    }
  }

  /** A pierced body: a spray of flakes and shards where the bolt was. */
  private onHit(at: THREE.Vector3) {
    this.v1.set(at.x, BOLT_Y, at.z);
    this.snow.scatter(this.v1, 8, 2.6, 0.6);
    this.crystals.shards.burst(this.v1, 6, 4, 0.4, 0.16);
    this.hitAt = this.time;
    this.hitPos.copy(this.v1);
    this.shake = 0.14;
  }

  /** The Shatter: the standing icicle cracks, then bursts and hits everyone within 2 m of the spot. */
  private updateShatter(t: number) {
    if (!this.live) return;
    this.crystals.flare = smoothstep(t / SHATTER_T);
    if (this.burst || t < SHATTER_T) return;
    this.burst = true;
    this.crystals.flare = 0;
    this.crystals.shatter(12, 6, 0.5);
    this.ferns.shatter(0.5);
    this.v1.copy(this.spot).setY(0.8);
    this.crystals.shards.burst(this.v1, 22, 6, 0.5, 0.22);
    this.snow.scatter(this.v1, 20, 4, 0.9);
    this.hitAt = t;
    this.hitPos.copy(this.v1);
    this.shake = 0.28;
    const ctx = this.ctx;
    if (!ctx) return;
    // Live positions at the moment of the burst: whoever stands within 2 m of the spot is hit.
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.spot.x, p.z - this.spot.z) > SHATTER_RADIUS) continue;
      ctx.hit(e, { damage: this.settings.shatterDamage, knock: 0.6, from: this.spot.clone(), color: FROST_CSS.hot, projectile: true });
    }
  }

  private drawPop() {
    if (this.hitAt < 0) return;
    const a = this.time - this.hitAt;
    const sp = StarBurst.pop(a, 0.0, 0.04);
    this.pop.set(this.hitPos, 0.8 * sp.scale + 1e-3, sp.opacity, 0.3);
    const k = THREE.MathUtils.clamp(a / 0.3, 0, 1);
    this.v1.set(this.hitPos.x, 0, this.hitPos.z);
    this.shock.set(this.v1, 0.3 + 1.2 * k, 0.025 * (1 - k) * (1 - k));
  }
}

export const icicleModule: EffectModule = {
  label: 'icicle',
  category: 'hero: frost',
  // A skillshot (the hero aims a line); the radius is how near the aim point an enemy must be to be in `targets` for the
  // Shatter, which hits whoever is within 2 m of the standing icicle.
  targeting: { mode: 'ground', radius: 8 },
  create: () => new Icicle(),
  telegraphs(effect) {
    const e = effect as Icicle;
    if (!e.ctx) return [];
    if (e.shatter) return e.live ? [{ shape: e.ring, start: 0, impact: SHATTER_T }] : [];
    return [{ shape: e.line, start: 0, impact: ICICLE_WIND, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Icicle;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Icicle).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'shatterDamage', 1, 100, 1);
    f.add(s, 'mode', ['auto', 'icicle', 'shatter']);
  },
};
