import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { BoltSet, type BoltLook } from '../../effects/parts/bolt';
import { PHOENIX, PHOENIX_CSS, disc } from '../../effects/parts/phoenix';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Obstacle } from '../../obstacles';
import { QUILL_DAMAGE, QUILL_RADIUS, QUILL_RANGE, QUILL_SPEED, QUILL_WIND, layEmber } from '../../traits/phoenix';

/**
 * Ember Quill (phoenix kit, Q: 10 m line skillshot, `ctx.projectile`). Anka flicks her fan (0.3 s wind-up) and a feather
 * flies down the aim at 22 m/s (radius 0.3): it reaches 6 m at 0.57 s, so a sidestep after the flick is enough. The first
 * enemy it touches takes 58. Where the quill stops (in the enemy it hit, at the end of its flight, or at a wall) it stays in
 * the floor as an EMBER and becomes her nest: the trait's (`layEmber` in src/traits/phoenix.ts, drawn there on both screens).
 * Timeline: wind-up 0-0.3, flight to 0.75, clean by 1.3 s.
 * Network duels: the dealer's screen has no bolt (bolts fly on the victim's screen, where the hit is decided), so there the
 * quill's stop is worked out along the aim (the first enemy or wall in the way, else 10 m), as Fenna's Seed Shot does.
 *
 * PLACEHOLDER LOOK (gate 4, first step): the engine's own bolt and a flash on the floor.
 */
export interface EmberQuillSettings {
  damage: number;
  loop: boolean;
}

export const defaultEmberQuill = (): EmberQuillSettings => ({ damage: QUILL_DAMAGE, loop: false });

const WIND_T = QUILL_WIND;
const REACH = QUILL_RANGE;
const SPEED = QUILL_SPEED;
const RADIUS = QUILL_RADIUS;
const FLIGHT_END = WIND_T + REACH / SPEED;
const BODY = 0.5; // an enemy's body radius against a bolt
const DURATION = 1.3;

const LOOK: BoltLook = { core: PHOENIX_CSS.core, body: PHOENIX_CSS.body, rim: PHOENIX_CSS.deep, size: 0.32, trail: 3, hit: PHOENIX_CSS.hot };

/** Distance from (px, pz) to an obstacle's centre segment. */
function obstacleDist(o: Obstacle, px: number, pz: number) {
  const dx = o.bx - o.ax, dz = o.bz - o.az, len2 = dx * dx + dz * dz;
  const k = len2 > 0 ? Math.min(1, Math.max(0, ((px - o.ax) * dx + (pz - o.az) * dz) / len2)) : 0;
  return Math.hypot(px - (o.ax + dx * k), pz - (o.az + dz * k));
}

export class EmberQuill implements Effect {
  readonly group = new THREE.Group();
  readonly settings: EmberQuillSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private fired = false;
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;
  private hit = false;
  private laid = false;
  /** With no bolt on this screen: when the quill would stop, and where. */
  private nominalAt = -1;
  private nominal = new THREE.Vector3();
  private landAt = -1;

  private bolts = new BoltSet(this.group);
  private flash = disc(0.9, PHOENIX.hot, 0, 0.04);

  constructor(settings: EmberQuillSettings = defaultEmberQuill()) {
    this.settings = settings;
    this.group.add(this.flash);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return WIND_T;
  }

  /** Seconds after play() when the quill has flown its full reach (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.bolt = null;
    this.hit = false;
    this.laid = false;
    this.nominalAt = -1;
    this.landAt = -1;
    this.bolts.clear();
    this.flash.visible = false;
  }

  /** How far along the aim the quill gets before an enemy's body or a wall stops it (no bolt on this screen). */
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

  /** The quill stops at (x, z): the ember is laid (the trait's list, both screens). */
  private land(x: number, z: number) {
    if (this.laid) return;
    this.laid = true;
    if (this.ctx) layEmber(this.ctx.caster, x, z);
    this.landAt = this.time;
    this.flash.position.set(x, 0.04, z);
    this.flash.visible = true;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.bolts.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;

    if (!this.fired && t >= WIND_T) {
      this.fired = true;
      this.shake = 0.06;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.from.clone(), dir: this.fwd.clone(), speed: SPEED, range: REACH, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 1, color: PHOENIX_CSS.body },
        });
        this.bolts.follow(this.bolt, LOOK);
        this.bolt.onHit((_target, at) => {
          this.hit = true;
          this.land(at.x, at.z);
        });
      } else if (ctx) {
        const d = this.nominalStop(ctx);
        this.nominal.copy(this.from).addScaledVector(this.fwd, d);
        this.nominalAt = WIND_T + d / SPEED;
      }
    }
    // A miss: the quill ended its flight (or struck a wall) with no hit; it stands a step short of where it died.
    if (this.bolt && !this.bolt.alive && !this.hit && !this.laid) {
      this.land(this.bolt.pos.x - this.fwd.x * 0.2, this.bolt.pos.z - this.fwd.z * 0.2);
    }
    if (this.nominalAt >= 0 && t >= this.nominalAt && !this.laid) this.land(this.nominal.x, this.nominal.z);

    if (this.landAt >= 0) {
      const a = t - this.landAt;
      (this.flash.material as THREE.MeshBasicMaterial).opacity = 0.7 * Math.exp(-a * 9);
      this.flash.scale.setScalar(0.5 + a * 3);
    }
    this.shake *= 0.9;
  }
}

export const emberQuillModule: EffectModule = {
  label: 'ember quill',
  category: 'hero: phoenix',
  // A skillshot: the aim point only gives the direction (the quill flies its 10 m wherever the cursor is).
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new EmberQuill(),
  telegraphs(effect) {
    const e = effect as EmberQuill;
    const ctx = e.ctx;
    if (!ctx) return [];
    const from = ctx.sentFrom ?? ctx.from;
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Shown from the flick, armed at the release, until the quill has flown; the bolt's hit is the dodge check.
    return [{
      shape: { kind: 'line', x1: from.x, z1: from.z, x2: from.x + d.x * REACH, z2: from.z + d.z * REACH, width: boltWidth(RADIUS) },
      start: 0.02, impact: WIND_T, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as EmberQuill;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as EmberQuill).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
