import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { CLOCKWORK, CLOCKWORK_CSS, MagCoil, RailBeam, Sparks, SteamPuffs } from '../../effects/parts/clockwork';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import type { SummonUnit } from '../../effects/summon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { cogTurrets } from './cogTurret';

/**
 * Mag Rail (clockwork kit, R: a multi-origin line ultimate). Rails fire from Ada AND from each of her live Cog Turrets
 * (`cogTurrets`, published by cogTurret.ts), every one aimed at the spot she targeted, so the lines cross on it.
 * First a 0.6 s charge: magnetic coil rings spin up round every muzzle (copper warming to cyan), cyan arcs jump, and a
 * thin glowing aim line is drawn from each origin to the spot while a ring closes in on it, so the enemy can read it and
 * step off every line. Then each origin fires a fast piercing rail through `ctx.projectile` (a hard bright head with a
 * soft ion streak behind it and a thin line left glowing in its wake); hers hits hardest, each turret's is lighter. A
 * hit makes an impact frame (the first one), a star, sparks and a ground refraction, and shakes the camera. A turret
 * that died during the charge fizzles. With no turret up only her rail fires. Network duels have neither summons nor
 * bolts: only the caster's own rail is shown, as the same deterministic visual with no hit. See pipeline/designs/kit-clockwork.md.
 */
export interface MagRailSettings {
  /** Her rail's damage; each turret's rail hits for `turretDamage`. */
  damage: number;
  turretDamage: number;
  loop: boolean;
}

export const defaultMagRail = (): MagRailSettings => ({ damage: 70, turretDamage: 38, loop: false });

// Timeline (seconds).
const CHARGE = 0.6; // coils spin up and the aim lines show; the rails fire at this moment
const SPEED = 45;
const RANGE = 18;
const RADIUS = 0.4;
const MUZZLE = 0.7; // from her feet to the bolt's start (a turret: 0.5)
const FLIGHT = RANGE / SPEED;
const FADE = 0.4; // the afterglow line of a spent rail
const DURATION = CHARGE + FLIGHT + FADE + 0.2;
const MAX_ORIGINS = 3; // her plus up to two turrets (a recast of Cog Turret can briefly leave two)

interface Origin {
  coil: MagCoil;
  aim: RailBeam;
  head: RailBeam;
  trail: RailBeam;
  line: RailBeam;
  star: StarBurst;
  shock: ShockRefraction;
  ring: THREE.Mesh;
  // Per cast.
  used: boolean;
  unit: SummonUnit | null;
  damage: number;
  pos: THREE.Vector3; // feet
  dir: THREE.Vector3;
  muzzle: THREE.Vector3; // at bolt height
  coilAt: THREE.Vector3;
  // Per play.
  fizzle: boolean;
  fired: boolean;
  ended: boolean;
  endT: number;
  bolt: Projectile | null;
  headAt: THREE.Vector3;
  crossed: boolean;
  hitT: number;
  hitAt: THREE.Vector3;
  arcT: number;
}

export class MagRail implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MagRailSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impT = -1;
  private origins: Origin[] = [];
  private spot = new THREE.Vector3(0, 0, -8);
  private sparks = new Sparks(70);
  private steam = new SteamPuffs(12);
  private events: { at: THREE.Vector3; i: number }[] = [];

  private up = new THREE.Vector3(0, 1, 0);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MagRailSettings = defaultMagRail()) {
    this.settings = settings;
    this.screen.impactColor.set(CLOCKWORK.foil);
    for (let i = 0; i < MAX_ORIGINS; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: CLOCKWORK.accent, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.visible = false;
      const o: Origin = {
        coil: new MagCoil(), aim: new RailBeam(CLOCKWORK.accent), head: new RailBeam(0xffffff), trail: new RailBeam(CLOCKWORK.accent, true),
        line: new RailBeam(CLOCKWORK.accent),
        star: new StarBurst({ points: 8, inner: 0.3, color: CLOCKWORK.accent, core: 0xffffff, additive: false }),
        shock: new ShockRefraction({ facing: 'ground' }), ring,
        used: false, unit: null, damage: 0, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), muzzle: new THREE.Vector3(),
        coilAt: new THREE.Vector3(), fizzle: false, fired: false, ended: false, endT: 0, bolt: null, headAt: new THREE.Vector3(),
        crossed: false, hitT: -1, hitAt: new THREE.Vector3(), arcT: 0,
      };
      this.origins.push(o);
      this.group.add(o.coil.mesh, o.aim.mesh, o.line.mesh, o.trail.mesh, o.head.mesh, o.star.mesh, o.shock.mesh, ring);
    }
    this.group.add(this.sparks.mesh, this.steam.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return CHARGE;
  }

  /** Seconds from the cast until the rails have flown their range (the telegraph's last moment). */
  get flightEnd() {
    return CHARGE + FLIGHT;
  }

  /** Where each rail starts (feet) and which way it goes, for the telegraph. Empty before the first cast. */
  lines() {
    return this.origins.filter((o) => o.used).map((o) => ({ x: o.pos.x, z: o.pos.z, dx: o.dir.x, dz: o.dir.z }));
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.spot.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.spot).setY(1.1);
    for (const o of this.origins) { o.used = false; o.unit = null; }
    // Hers first, then each of her live turrets (those are the units still alive at cast time).
    const units: SummonUnit[] = [];
    for (const s of cogTurrets.get(ctx.caster) ?? []) for (const u of s.units) if (u.alive) units.push(u);
    const set = (o: Origin, from: THREE.Vector3, unit: SummonUnit | null, damage: number, fallback: THREE.Vector3 | null) => {
      o.used = true;
      o.unit = unit;
      o.damage = damage;
      o.pos.copy(from).setY(0);
      o.dir.set(this.spot.x - from.x, 0, this.spot.z - from.z);
      if (o.dir.lengthSq() < 0.36 && fallback) o.dir.copy(fallback);
      if (o.dir.lengthSq() < 1e-6) o.dir.set(0, 0, 1);
      o.dir.normalize();
      const m = unit ? 0.5 : MUZZLE;
      o.muzzle.copy(o.pos).addScaledVector(o.dir, m).setY(BOLT_HEIGHT);
      o.coilAt.copy(o.pos).addScaledVector(o.dir, m - 0.35).setY(BOLT_HEIGHT);
    };
    const aimDir = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    set(this.origins[0], ctx.from, null, this.settings.damage, aimDir);
    for (let i = 0; i < Math.min(units.length, MAX_ORIGINS - 1); i++) {
      set(this.origins[i + 1], units[i].pos, units[i], this.settings.turretDamage, aimDir);
    }
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.impT = -1;
    this.events.length = 0;
    clearScreenFx(this.screen);
    this.sparks.reset();
    this.steam.reset();
    for (const o of this.origins) {
      o.fizzle = o.fired = o.ended = o.crossed = false;
      o.endT = 0;
      o.bolt = null;
      o.hitT = -1;
      o.arcT = 0;
      o.headAt.copy(o.muzzle);
      o.coil.reset();
      o.aim.hide(); o.head.hide(); o.trail.hide(); o.line.hide();
      o.ring.visible = false;
      o.star.set(o.hitAt, 0, 0);
      o.shock.set(o.hitAt, 0, 0);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.sparks.update(dt);
    this.steam.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      this.reset();
      return;
    }
    const t = this.time, ctx = this.ctx, P = this.spot;

    for (const o of this.origins) {
      if (!o.used) continue;
      const k = Math.min(1, t / CHARGE);

      // --- Charge: coils spin up, arcs jump, the aim line shows and the ring closes on the spot. ---
      if (t < CHARGE) {
        if (o.unit && !o.unit.alive) o.fizzle = true;
        o.arcT += dt;
        if (o.arcT >= 0.14 - 0.09 * k) {
          o.arcT = 0;
          this.v1.set((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7).add(o.coilAt);
          this.sparks.arc(o.coilAt, this.v1, 0.12);
        }
        if (o.fizzle) {
          o.coil.set(o.coilAt, o.dir, 0.2, 0, dt, 0.4);
          o.aim.hide();
          o.ring.visible = false;
          continue;
        }
        const flick = 0.75 + 0.25 * Math.sin(t * 90);
        const late = t > CHARGE - 0.1 ? 1 : 0;
        o.coil.set(o.coilAt, o.dir, k, late, dt);
        o.aim.set(o.muzzle, this.v1.set(P.x, BOLT_HEIGHT, P.z), 0.05 + 0.05 * late, (0.15 + 0.6 * k) * flick + 0.25 * late);
        o.ring.visible = true;
        o.ring.position.set(P.x, 0.07, P.z);
        o.ring.scale.setScalar(1.9 - 1.3 * k);
        (o.ring.material as THREE.MeshBasicMaterial).opacity = (0.25 + 0.5 * k) * (o.damage === this.settings.damage ? 1 : 0.6);
        // Arcs between her coil and the turrets' coils: the grid charging.
        if (o !== this.origins[0] && Math.random() < dt * (4 + 14 * k)) this.sparks.arc(this.origins[0].coilAt, o.coilAt, 0.12);
        continue;
      }

      // --- Fire. ---
      o.aim.hide();
      o.ring.visible = false;
      if (!o.fired) {
        o.fired = true;
        if (o.fizzle || (o.unit && !o.unit.alive)) {
          o.ended = true;
          o.endT = t;
          this.sparks.burst(o.coilAt, 4);
          o.coil.reset();
          continue;
        }
        o.headAt.copy(o.muzzle);
        this.sparks.burst(o.muzzle, 7);
        this.steam.puff(o.muzzle, this.up, 2);
        this.shake = Math.max(this.shake, o.unit ? 0.1 : 0.2);
        if (ctx?.projectile) {
          o.bolt = ctx.projectile({
            from: this.v1.copy(o.pos).addScaledVector(o.dir, o.unit ? 0.5 : MUZZLE).clone(), dir: o.dir.clone(), speed: SPEED, range: RANGE, radius: RADIUS, pierce: true,
            hit: { damage: o.damage, knock: o.unit ? 1.5 : 2.5, color: CLOCKWORK_CSS.accent },
          });
          const i = this.origins.indexOf(o);
          o.bolt.onHit((_target, at) => this.events.push({ at: at.clone(), i }));
        }
      }
      const after = t - CHARGE;
      o.coil.set(o.coilAt, o.dir, 1, Math.max(0, 1 - after / 0.12), dt, Math.max(0, 1 - after / 0.3));
      if (!o.ended) {
        let d: number;
        if (o.bolt) {
          o.headAt.set(o.bolt.pos.x, BOLT_HEIGHT, o.bolt.pos.z);
          d = this.v1.subVectors(o.headAt, o.muzzle).dot(o.dir);
          if (!o.bolt.alive) { o.ended = true; o.endT = t; }
        } else {
          d = Math.min(RANGE, after * SPEED);
          o.headAt.copy(o.muzzle).addScaledVector(o.dir, d);
          if (d >= RANGE) { o.ended = true; o.endT = t; }
        }
        // The rails cross on the spot: a small flash where this one passes it.
        if (!o.crossed && this.v2.subVectors(P, o.muzzle).dot(o.dir) <= d) {
          o.crossed = true;
          this.sparks.burst(this.v1.set(P.x, BOLT_HEIGHT, P.z), 3);
        }
      }

      // The beams: a hard bright head, an ion streak behind it and a thin line left glowing, fading after the end.
      const gone = o.ended ? Math.min(1, (t - o.endT) / FADE) : 0;
      const tail = this.v1.copy(o.headAt).addScaledVector(o.dir, -2.4);
      if (tail.clone().sub(o.muzzle).dot(o.dir) < 0) tail.copy(o.muzzle);
      o.head.set(tail, o.headAt, 0.2, o.ended ? 0 : 1);
      const streak = this.v2.copy(o.headAt).addScaledVector(o.dir, -8);
      if (streak.clone().sub(o.muzzle).dot(o.dir) < 0) streak.copy(o.muzzle);
      o.trail.set(streak, o.headAt, 0.42, 0.7 * (1 - gone) * (1 - gone));
      o.line.set(o.muzzle, o.headAt, 0.07, 0.8 * (1 - gone) * (1 - gone));
    }

    // Hits that landed since the last frame: star, sparks, ground refraction; the first one gets the impact frame.
    for (const e of this.events) {
      const o = this.origins[e.i];
      o.hitT = t;
      o.hitAt.set(e.at.x, 1.1, e.at.z);
      this.sparks.burst(o.hitAt, 6);
      this.sparks.ring(this.v1.set(e.at.x, 0, e.at.z), 1.2, 8, 0.2);
      if (this.impT < 0) { this.impT = t; this.screen.focus.copy(o.hitAt); }
      this.shake = Math.max(this.shake, o.unit ? 0.25 : 0.4);
    }
    this.events.length = 0;
    for (const o of this.origins) {
      if (!o.used || o.hitT < 0) continue;
      const a = t - o.hitT;
      const sp = StarBurst.pop(a - 0.02, 0.02, 0.12);
      o.star.set(o.hitAt, 1.2 * sp.scale, sp.opacity, 0.2);
      const gp = Math.min(1, a / 0.3);
      o.shock.set(this.v1.set(o.hitAt.x, 0, o.hitAt.z), 0.4 + 2.2 * gp, 0.03 * (1 - gp) * (1 - gp));
    }
    this.screen.impact = this.impT >= 0 ? impactFrameAt(t, this.impT, [1], 0.03) : 0;
    this.shake *= Math.exp(-dt * 12);
  }
}

export const magRailModule: EffectModule = {
  label: 'mag rail',
  category: 'hero: clockwork',
  // A skillshot is aimed at a spot (the targeted enemy's feet or the ground point); `radius` only sizes the aim strip.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new MagRail(),
  telegraphs(effect) {
    const e = effect as MagRail;
    if (!e.ctx) return [];
    // One thin line per origin, armed from the charge until the rails have passed; the rail's hit is the dodge check.
    return e.lines().map((l) => ({
      shape: { kind: 'line' as const, x1: l.x, z1: l.z, x2: l.x + l.dx * RANGE, z2: l.z + l.dz * RANGE, width: RADIUS * 2 },
      start: 0.05, impact: CHARGE, until: e.flightEnd,
    }));
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MagRail;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as MagRail).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'turretDamage', 1, 100, 1);
  },
};
