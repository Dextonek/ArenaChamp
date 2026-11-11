import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { FeatherFlock, PHOENIX, PHOENIX_CSS, disc, nestLook } from '../../effects/parts/phoenix';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Obstacle } from '../../obstacles';
import { QUILL_DAMAGE, QUILL_RADIUS, QUILL_RANGE, QUILL_SPEED, QUILL_WIND, STAMP_R, emberLive, layEmber } from '../../traits/phoenix';

/**
 * Ember Quill (phoenix kit, Q: 10 m line skillshot, `ctx.projectile`). Anka flicks her fan (0.3 s wind-up) and a feather
 * flies down the aim at 22 m/s (radius 0.3): it reaches 6 m at 0.57 s, so a sidestep after the flick is enough. The first
 * enemy it touches takes 58. Where the quill stops (in the enemy it hit, at the end of its flight, or at a wall) it stays in
 * the floor as an EMBER and becomes her nest: the trait's (`layEmber` in src/traits/phoenix.ts, drawn there on both screens).
 * Network duels: the dealer's screen has no bolt (bolts fly on the victim's screen, where the hit is decided), so there the
 * quill's stop is worked out along the aim (the first enemy or wall in the way, else 10 m), as Fenna's Seed Shot does, and
 * the feather is flown along the aim to that spot.
 *
 * The look. The flick: a fan of seven feathers opens at her left hand, cocked back, and snaps forward at the release with a
 * small gold glint. The quill: one long feather with its eye, flying point first, four feathers of flame and a short
 * streak of flame behind it, shedding sparks of flame feathers. The landing: it swings upright and plants in the floor in a
 * small burst of feather sparks, a gold flash on the floor and a ring of force. The ember it leaves is the trait's.
 * Timeline: wind-up 0-0.3, flight to 0.75, the landing burst gone 0.5 s after it lands, clean by 1.3 s.
 * Without a trait (the VFX tool) the effect shows its own feather in the floor for 2 s (and lasts that much longer).
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
// The look only.
const LOCAL_EMBER_S = 2; // how long the effect's own feather stands, where no trait draws the ember
const QUILL_LEN = 1.5;
const FLY_Y = 1.0;
const FAN = 7;
const UP = new THREE.Vector3(0, 1, 0);
const PLANTED = new THREE.Vector3(0.9, 1, 0.12); // how the ember's feather leans (the parts file's LEAN)

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

  // The look.
  private endT = DURATION;
  private left = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 1.4, 14);
  private landPos = new THREE.Vector3();
  private quillBase = new THREE.Vector3();
  private shed = 0;
  private localAt = -1;
  private plumes = new FeatherFlock('eye', 40);
  private flames = new FeatherFlock('flame', 90);
  private streak = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 0, -1], 3)),
    new THREE.MeshBasicMaterial({ color: PHOENIX.body, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  );
  private flash = disc(1, PHOENIX.hot, 0, 0.04);
  private glint = new StarBurst({ points: 6, inner: 0.3, color: PHOENIX.hot, core: PHOENIX.core, additive: false });
  private pop = new StarBurst({ points: 9, inner: 0.3, color: PHOENIX.body, core: PHOENIX.hot, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  /** The effect's own feather in the floor, where no trait draws the ember (the VFX tool). */
  private local = nestLook(STAMP_R);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: EmberQuillSettings = defaultEmberQuill()) {
    this.settings = settings;
    this.streak.frustumCulled = false;
    this.streak.renderOrder = 3;
    this.group.add(this.flash, this.streak, this.plumes.mesh, this.flames.mesh, this.glint.mesh, this.pop.mesh, this.shock.mesh, this.local);
    this.reset();
  }

  get duration() {
    return this.endT;
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
    // The look: her left hand, where the fan is.
    this.left.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(this.from).addScaledVector(this.fwd, 0.45).addScaledVector(this.left, 0.3).setY(1.4);
    this.quillBase.copy(this.hand);
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
    this.endT = DURATION;
    this.shed = 0;
    this.localAt = -1;
    this.plumes.reset();
    this.flames.reset();
    this.flash.visible = this.streak.visible = this.local.visible = false;
    this.glint.set(this.hand, 0, 0);
    this.pop.set(this.landPos, 0, 0);
    this.shock.set(this.landPos, 0, 0);
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
    // The look: a small burst of feather sparks where it plants.
    this.landPos.set(x, 0, z);
    this.flash.position.set(x, 0.04, z);
    this.flash.visible = true;
    this.flames.burst(this.v1.set(x, 0.35, z), 10, 3.4, 0.42, 0.45);
    this.plumes.burst(this.v1, 3, 2.6, 0.45, 0.5);
    if (!this.ctx || !emberLive(this.ctx.caster)) {
      // No trait draws the ember here (the VFX tool): the effect shows a feather of its own, and lasts that much longer.
      this.localAt = this.time;
      this.endT = Math.max(this.endT, this.time + LOCAL_EMBER_S + 0.05);
      this.local.position.set(x, 0, z);
    }
  }

  /**
   * The flick of the fan: seven feathers open at her hand like a hand of cards held toward the aim (its face up, so it reads
   * from the camera wherever she aims), drawn back and raised as they open, then snapped forward and down at the release.
   */
  private drawFan(t: number) {
    if (t >= WIND_T + 0.14) return;
    const open = t < WIND_T ? 1 - (1 - t / WIND_T) ** 3 : 1;
    const snap = t < WIND_T ? 0 : smoothstep((t - WIND_T) / 0.07);
    const gone = t < WIND_T ? 1 : 1 - smoothstep((t - WIND_T - 0.04) / 0.1);
    // how far the fan is raised above level, and where its pivot is: drawn back, then thrust forward
    const lift = 0.12 + 0.5 * open * (1 - snap);
    const pivot = this.quillBase.copy(this.hand).addScaledVector(this.fwd, 0.45 * snap - 0.25 * open * (1 - snap));
    const axis = this.v1.copy(this.fwd).multiplyScalar(Math.cos(lift)).addScaledVector(UP, Math.sin(lift));
    const face = this.v2.copy(UP).multiplyScalar(Math.cos(lift)).addScaledVector(this.fwd, -Math.sin(lift));
    const half = 0.95 * (0.15 + 0.85 * open);
    for (let i = 0; i < FAN; i++) {
      const th = (i / (FAN - 1) - 0.5) * 2 * half;
      const dir = this.v3.copy(axis).multiplyScalar(Math.cos(th)).addScaledVector(this.left, Math.sin(th));
      const mid = 1 - Math.abs(i - (FAN - 1) / 2) / ((FAN - 1) / 2);
      this.plumes.put(pivot, dir, (0.72 + 0.16 * mid) * (0.45 + 0.55 * open) * gone, 0, 1.2, face);
    }
  }

  /** The quill in flight with its tip near (x, z), flying along `dir`: one long feather, flames and a streak behind it, sparks shed. */
  private drawQuill(x: number, z: number, dir: THREE.Vector3, dt: number, t: number) {
    const d = this.v1.set(dir.x, 0, dir.z);
    if (d.lengthSq() < 1e-8) d.copy(this.fwd);
    d.normalize();
    const flown = Math.hypot(x - this.from.x, z - this.from.z);
    const len = Math.min(QUILL_LEN, 0.5 + flown);
    const base = this.quillBase.set(x, FLY_Y, z).addScaledVector(d, 0.25 - len);
    this.plumes.put(base, d, len, Math.sin(t * 38) * 0.14, 1.25);
    // feathers of flame behind it, smaller and smaller, weaving a little
    for (let i = 0; i < 4; i++) {
      const back = 0.3 + i * 0.5, size = 0.95 - i * 0.17;
      if (back + size > flown + 0.6) break;
      const sway = Math.sin(t * 30 + i * 1.9) * 0.07 * (i + 1);
      this.v2.copy(base).addScaledVector(d, -back).setY(FLY_Y - 0.04 * i);
      this.v2.x += d.z * sway;
      this.v2.z -= d.x * sway;
      this.flames.put(this.v2, d, size, i % 2 ? 0.5 : -0.5, 1.2);
    }
    // a short streak of flame under them
    this.streak.visible = true;
    this.streak.position.copy(base).setY(FLY_Y - 0.08);
    this.streak.rotation.y = Math.atan2(d.x, d.z);
    this.streak.scale.set(0.24, 1, Math.max(0.01, Math.min(2.4, flown)));
    this.shed += dt;
    while (this.shed > 0.04) {
      this.shed -= 0.04;
      this.flames.fall(this.v2.copy(base).addScaledVector(d, -0.4), 1, 0.12, 0.3, 0.3);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.plumes.update(dt);
    this.flames.update(dt);
    this.time += dt;
    if (this.time >= this.endT) {
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

    // The look from here on. The flick of the fan, and a small gold glint as the quill leaves it.
    this.drawFan(t);
    const g = StarBurst.pop(t - WIND_T, 0, 0.05);
    this.glint.set(this.v1.copy(this.hand).addScaledVector(this.fwd, 0.5), 0.55 * g.scale + 1e-3, g.opacity, t * 5);

    // The quill in flight: on the bolt, or, where no bolt flies on this screen, along the aim to where it will stop.
    this.streak.visible = false;
    if (this.bolt && this.bolt.alive) this.drawQuill(this.bolt.pos.x, this.bolt.pos.z, this.bolt.dir, dt, t);
    else if (this.nominalAt >= 0 && !this.laid) {
      const d = (t - WIND_T) * SPEED;
      this.drawQuill(this.from.x + this.fwd.x * d, this.from.z + this.fwd.z * d, this.fwd, dt, t);
    }

    if (this.landAt >= 0) {
      const a = t - this.landAt;
      // it swings upright and plants (the ember that stays is the trait's)
      if (a < 0.1) {
        const k = smoothstep(a / 0.1);
        this.v1.copy(this.quillBase).lerp(this.landPos, k);
        this.v2.copy(this.fwd).lerp(PLANTED, k);
        this.plumes.put(this.v1, this.v2, QUILL_LEN + 0.3 * k, 0, 1.2);
      }
      (this.flash.material as THREE.MeshBasicMaterial).opacity = 0.6 * Math.exp(-a * 9);
      this.flash.scale.setScalar(0.45 + a * 2.2);
      this.flash.visible = a < 0.6;
      const hp = StarBurst.pop(a, 0.03, 0.08);
      this.pop.set(this.v1.set(this.landPos.x, 0.5, this.landPos.z), 0.9 * hp.scale + 1e-3, hp.opacity, 0.4);
      const sg = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.shock.set(this.landPos, 0.3 + 1.3 * sg, 0.03 * (1 - sg) * (1 - sg));
      this.shake = Math.max(this.shake * 0.9, 0.1 * Math.exp(-a * 14));
    } else this.shake *= 0.9;

    if (this.localAt >= 0) {
      const a = t - this.localAt, left = LOCAL_EMBER_S - a;
      this.local.visible = left > 0;
      this.local.scale.setScalar(Math.max(left < 0.3 ? left / 0.3 : Math.min(1, 0.4 + a * 3), 1e-4));
    }
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
