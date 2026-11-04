import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { BoltSet, type BoltLook } from '../../effects/parts/bolt';
import { GROVE, GROVE_CSS, Bloom, Petals, Pollen } from '../../effects/parts/grove';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Obstacle } from '../../obstacles';
import { gardenLive, plantFlower } from '../../traits/grove';

/**
 * Seed Shot (grove kit v5, Q: 9 m line skillshot, `ctx.projectile`). A seed swells in Fenna's hand for the 0.25 s wind-up (a
 * cream star, pollen drawn in), then flies down the aim from her feet at 20 m/s (radius 0.35): it reaches 6 m at 0.55 s, so a
 * sidestep after she raises her hand is enough. The first enemy it touches takes 50. A flower grows where the seed stops: on
 * the enemy it hit, or where it ended its flight or struck a wall. The flower is the trait's (`plantFlower` in
 * `src/traits/grove.ts`, drawn there as a ground mark on both screens, 4 at most, 7 s): this effect only adds it at the moment
 * the seed lands, with a burst of petals and pollen. Timeline: wind-up 0-0.25, flight to 0.7, clean by 1.4 s.
 * Network duels: the dealer's screen has no bolt (bolts fly on the victim's screen, where the hit is decided), so there the
 * seed's stop is worked out along the aim (the first enemy or wall in the way, else 9 m) and the flower grows when the seed
 * would have got there. Without a trait (the VFX tool) the effect shows its own bloom for 2.5 s.
 */
export interface SeedShotSettings {
  damage: number;
  loop: boolean;
}

export const defaultSeedShot = (): SeedShotSettings => ({ damage: 64, loop: false });

// Timeline (seconds).
const WIND_T = 0.25; // the seed leaves
const REACH = 9;
const SPEED = 20;
const RADIUS = 0.35;
const FLIGHT_END = WIND_T + REACH / SPEED;
const BODY = 0.5; // an enemy's body radius against a bolt
const DURATION = 1.4;
const LOCAL_BLOOM_S = 2.5;

const LOOK: BoltLook = { core: GROVE_CSS.core, body: GROVE_CSS.accent, rim: GROVE_CSS.dark, size: 0.34, trail: 3, hit: GROVE_CSS.accent };

/** Distance from (px, pz) to an obstacle's centre segment. */
function obstacleDist(o: Obstacle, px: number, pz: number) {
  const dx = o.bx - o.ax, dz = o.bz - o.az, len2 = dx * dx + dz * dz;
  const k = len2 > 0 ? Math.min(1, Math.max(0, ((px - o.ax) * dx + (pz - o.az) * dz) / len2)) : 0;
  return Math.hypot(px - (o.ax + dx * k), pz - (o.az + dz * k));
}

export class SeedShot implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SeedShotSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private endT = DURATION;

  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.3, 13);
  private fired = false;
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;
  private hitAt = -1;
  private hitPos = new THREE.Vector3();
  private planted = false;
  /** With no bolt on this screen: when the seed would stop, and where. */
  private nominalAt = -1;
  private nominal = new THREE.Vector3();
  private localAt = -1;
  private localShed = false;

  private bolts = new BoltSet(this.group);
  private bloom = new Bloom();
  private petals = new Petals(30);
  private pollen = new Pollen(30);
  private swell = new StarBurst({ points: 6, inner: 0.25, color: GROVE.accent, core: GROVE.core, additive: false });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: GROVE.accent, core: GROVE.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(settings: SeedShotSettings = defaultSeedShot()) {
    this.settings = settings;
    this.screen.impactColor.set(GROVE.hot);
    this.group.add(this.bloom.mesh, this.petals.mesh, this.pollen.mesh, this.swell.mesh, this.pop.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return this.endT;
  }

  get impactTime() {
    return WIND_T;
  }

  /** Seconds after play() when the seed has flown its full reach (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(this.from).addScaledVector(this.fwd, 0.55).setY(1.3);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).addScaledVector(this.fwd, REACH * 0.5).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.endT = DURATION;
    this.fired = false;
    this.bolt = null;
    this.hitAt = -1;
    this.planted = false;
    this.nominalAt = -1;
    this.localAt = -1;
    this.localShed = false;
    clearScreenFx(this.screen);
    this.bolts.clear();
    this.bloom.reset();
    this.petals.reset();
    this.pollen.reset();
    this.swell.set(this.hand, 0, 0);
    this.pop.set(this.hitPos, 0, 0);
    this.groundShock.set(this.hitPos, 0, 0);
  }

  /** How far along the aim the seed gets before an enemy's body or a wall stops it (no bolt on this screen). */
  private nominalStop(ctx: CastContext) {
    let best = REACH;
    for (const e of ctx.targets) {
      const dx = e.group.position.x - this.from.x, dz = e.group.position.z - this.from.z;
      const along = dx * this.fwd.x + dz * this.fwd.z;
      const perp = Math.abs(dx * this.fwd.z - dz * this.fwd.x);
      if (along < 0 || perp > RADIUS + BODY) continue;
      best = Math.min(best, Math.max(0, along - Math.sqrt(Math.max(0, (RADIUS + BODY) ** 2 - perp * perp))));
    }
    const walls = ctx.obstacles?.() ?? [];
    for (let d = 0; d < best; d += 0.2) {
      const px = this.from.x + this.fwd.x * d, pz = this.from.z + this.fwd.z * d;
      if (walls.some((o) => obstacleDist(o, px, pz) <= o.r + RADIUS)) { best = Math.max(0, d - 0.2); break; }
    }
    return best;
  }

  /** The seed lands at (x, z): the flower grows (the trait's list, both screens) with a burst of petals and pollen. */
  private land(x: number, z: number) {
    if (this.planted) return;
    this.planted = true;
    const ctx = this.ctx;
    if (ctx) plantFlower(ctx.caster, x, z);
    this.v1.set(x, 0.3, z);
    this.petals.burst(this.v1, 9, 3.2);
    this.pollen.puff(this.v1, 10);
    if (!ctx || !gardenLive(ctx.caster)) {
      // No trait draws the flower here (the VFX tool): show a bloom of our own.
      this.localAt = this.time;
      this.endT = Math.max(this.endT, this.time + LOCAL_BLOOM_S + 0.7);
      this.bloom.open(this.v1.set(x, 0, z), 0.85, 0.45);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.bolts.update(dt);
    this.bloom.update(dt);
    this.petals.update(dt);
    this.pollen.update(dt);
    this.time += dt;
    if (this.time >= this.endT) {
      const loop = this.settings.loop;
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;

    // The wind-up: a cream star swells in her hand and pollen is drawn in; at the release it flashes out.
    const swell = t < WIND_T ? smoothstep(t / WIND_T) : 0;
    const flash = StarBurst.pop(t - WIND_T, 0, 0.04);
    this.swell.set(this.hand, 0.28 * swell + 0.7 * flash.scale + 1e-3, swell * 0.9 + flash.opacity, t * 4);
    if (t < WIND_T && Math.random() < 0.5) this.pollen.puff(this.v1.copy(this.hand).setY(1.1), 1);

    if (!this.fired && t >= WIND_T) {
      this.fired = true;
      this.shake = 0.08;
      this.petals.burst(this.v1.copy(this.hand), 5, 3);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.from.clone(), dir: this.fwd.clone(), speed: SPEED, range: REACH, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 1, color: GROVE_CSS.body },
        });
        this.bolts.follow(this.bolt, LOOK);
        this.bolt.onHit((target, at) => {
          this.hitAt = this.time;
          this.hitPos.set(target.group.position.x, 1.2, target.group.position.z);
          this.land(at.x, at.z);
        });
      } else if (ctx) {
        const d = this.nominalStop(ctx);
        this.nominal.copy(this.from).addScaledVector(this.fwd, d);
        this.nominalAt = WIND_T + d / SPEED;
      }
    }
    // A miss: the seed ended its flight (or struck a wall) with no hit; the flower grows a step short of where it died.
    if (this.bolt && !this.bolt.alive && this.hitAt < 0 && !this.planted) {
      this.land(this.bolt.pos.x - this.fwd.x * 0.2, this.bolt.pos.z - this.fwd.z * 0.2);
    }
    if (this.nominalAt >= 0 && t >= this.nominalAt && !this.planted) this.land(this.nominal.x, this.nominal.z);

    if (this.hitAt >= 0) {
      const a = t - this.hitAt;
      const hp = StarBurst.pop(a, 0.02, 0.06);
      this.pop.set(this.hitPos, 1.1 * hp.scale + 1e-3, hp.opacity, 0.3);
      const g = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.groundShock.set(this.v1.set(this.hitPos.x, 0, this.hitPos.z), 0.4 + 1.6 * g, 0.03 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * 0.9, 0.14 * Math.exp(-a * 14));
    } else this.shake *= 0.9;

    if (this.localAt >= 0 && !this.localShed && t >= this.localAt + LOCAL_BLOOM_S) {
      this.localShed = true;
      this.bloom.shed(0.6);
    }
  }
}

export const seedShotModule: EffectModule = {
  label: 'seed shot',
  category: 'hero: grove',
  // A skillshot: the aim point only gives the direction (the seed flies its 9 m wherever the cursor is).
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SeedShot(),
  telegraphs(effect) {
    const e = effect as SeedShot;
    const ctx = e.ctx;
    if (!ctx) return [];
    const from = ctx.sentFrom ?? ctx.from;
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Shown from the raised hand, armed at the release, until the seed has flown; the bolt's hit is the dodge check.
    return [{
      shape: { kind: 'line', x1: from.x, z1: from.z, x2: from.x + d.x * REACH, z2: from.z + d.z * REACH, width: boltWidth(RADIUS) },
      start: 0.02, impact: WIND_T, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SeedShot;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as SeedShot).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
