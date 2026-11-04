import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  Droplets, SplashCrown, TIDE, TIDE_CSS, TideCurrent, TideRing, WaterDisc, WaterPool, WaterRibbon,
} from '../../effects/parts/tide';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { DISC_MOVE, tideNow } from '../../traits/tide';

/**
 * Wave Disc (tide kit, Q: a 9 m line skillshot). Marin spins a flat disc of water between her hands and throws it
 * (`ctx.projectile`; the first enemy it touches is hit, dodged by stepping off the line). It does 68 and moves the
 * enemy 2.5 m by the tide: at High tide the hit throws foam outward and knocks the enemy back, at Low tide a water
 * tether draws it in toward her. The move itself is decided in `src/traits/tide.ts` (`dealt`): this effect hands the
 * engine the Low-tide shape (a pull toward the bolt's start) and the trait flips it to a push at High tide. The look
 * (ring at her feet, the disc's colour, the impact) reads the tide through `tideNow`. A miss pops into a foam splash
 * where the disc ends. See pipeline/designs/kit-tide.md.
 */
export interface WaveDiscSettings {
  damage: number;
  /** Metres the hit moves the enemy (engine pull cap 4). */
  move: number;
  loop: boolean;
}

export const defaultWaveDisc = (): WaveDiscSettings => ({ damage: 52, move: DISC_MOVE, loop: false });

// Timeline (seconds). The throw is fixed; the hit (or the miss) moves the rest.
const THROW_T = 0.3; // the disc leaves her hands and the bolt is fired
const RANGE = 9;
const SPEED = 20; // reaches 6 m at 0.6 s
const RADIUS = 0.8;
const FLIGHT_END = THROW_T + RANGE / SPEED;
const TETHER_S = 0.5; // a Low-tide hit: seconds the water tether stays drawn
const DURATION = 2.0;

export class WaveDisc implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WaveDiscSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private hands = new THREE.Vector3(0, 1.2, 13.5);
  private disc = new THREE.Vector3(0, 1.2, 13.5);
  private end = new THREE.Vector3(0, 0, 5);
  private feet = new THREE.Vector3(0, 0, 5);
  private victim: Enemy | null = null;
  private high = true;

  private flags = { fired: false, impacted: false, ended: false, ring2: false };
  private bolt: Projectile | null = null;
  private hitT = -1;
  private missT = -1;

  // Parts.
  private tideRing = new TideRing();
  private discMesh = new WaterDisc();
  private trail = new Droplets(30);
  private crown = new SplashCrown();
  private pool = new WaterPool();
  private current = new TideCurrent(20);
  private tether = new WaterRibbon(24, 8, 14);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: TIDE.accent, core: 0xfff2e8, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor(settings: WaveDiscSettings = defaultWaveDisc()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.hot);
    this.screen.tint.set(TIDE.dark);
    this.tether.shed = 10;
    this.tether.drops.splash = false;
    this.group.add(
      this.pool.mesh, this.tideRing.mesh, this.current.mesh, this.discMesh.mesh, this.tether.mesh, this.crown.mesh,
      this.trail.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return THROW_T;
  }

  /** Seconds until the bolt has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hands.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.25);
    this.end.copy(ctx.from).addScaledVector(this.fwd, RANGE).setY(0);
    this.feet.copy(this.end);
    this.high = tideNow(ctx.caster).high;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.end).setY(1.1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.bolt = null;
    this.victim = null;
    this.hitT = this.missT = -1;
    const f = this.flags;
    f.fired = f.impacted = f.ended = f.ring2 = false;
    clearScreenFx(this.screen);
    this.tideRing.hide();
    this.discMesh.hide();
    this.current.hide();
    this.tether.reset();
    this.tether.hide();
    this.trail.reset();
    this.crown.reset();
    this.pool.reset();
    this.pop.set(this.end, 0, 0);
    this.groundShock.set(this.end, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.tether.update(dt);
    this.trail.update(dt);
    this.crown.update(dt);
    this.pool.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (ctx) this.high = tideNow(ctx.caster).high;

    if (!f.fired && t >= THROW_T) {
      f.fired = true;
      this.shake = 0.06;
      if (ctx?.projectile) {
        const noTrait = !tideNow(ctx.caster).live;
        this.v1.copy(this.from).addScaledVector(this.fwd, 0.6);
        this.bolt = ctx.projectile({
          from: this.v1.clone(), dir: this.fwd.clone(), speed: SPEED, range: RANGE, radius: RADIUS,
          // The Low-tide shape: a pull toward the bolt's start (her), no knock. At High tide the trait's `dealt`
          // turns it into a push of the same length.
          // (Without a trait, the editor, a High-tide hit is pushed by hand in `latch`, so no pull here.)
          hit: { damage: this.settings.damage, knock: 0, pull: noTrait && this.high ? 0 : this.settings.move, color: TIDE_CSS.body },
        });
        this.bolt.onHit((target, at) => this.latch(target, at, this.time));
      }
    }
    if (f.fired && !f.impacted && !f.ended) {
      const b = this.bolt;
      if (b ? !b.alive : t >= FLIGHT_END) {
        // The disc ran out of range (or the bolt died without a body): it pops into foam where it stopped.
        f.ended = true;
        this.missT = t;
        if (b) this.end.set(b.pos.x, 0, b.pos.z);
        else this.end.copy(this.from).addScaledVector(this.fwd, RANGE).setY(0);
        this.feet.copy(this.end);
        this.crown.burst(this.end, 0.8);
        this.pool.spread(this.end, 1.3, 0.2);
        this.trail.spray(this.v1.copy(this.end).setY(0.4), this.v2.set(0, 1, 0), 8, 4);
      }
    }
    if (f.impacted && !f.ring2 && t >= this.hitT + 0.14) {
      f.ring2 = true;
      this.pool.ripple(this.feet);
    }
    this.layout();
  }

  /** The disc touches `target`: foam and the tide's move begin (the damage and the move are the bolt's hit). */
  private latch(target: Enemy, at: THREE.Vector3, t: number) {
    const f = this.flags;
    if (f.impacted) return;
    f.impacted = true;
    this.hitT = t;
    this.victim = target;
    this.feet.set(at.x, 0, at.z);
    const ctx = this.ctx;
    // The bolt's hit has just gone through the trait, so the tide is fresh here.
    const tide = ctx ? tideNow(ctx.caster) : { high: true, live: true };
    this.high = tide.high;
    if (ctx && !tide.live && tide.high) {
      // No trait (the editor): the engine only pulls, so a High-tide push is carried by hand.
      const dx = at.x - ctx.from.x, dz = at.z - ctx.from.z, l = Math.hypot(dx, dz) || 1;
      ctx.carry?.(target, this.v1.set((dx / l) * this.settings.move, 0, (dz / l) * this.settings.move));
    }
    this.screen.focus.set(at.x, 1.1, at.z);
    this.crown.burst(this.feet, this.high ? 1.35 : 0.95);
    this.pool.spread(this.feet, 1.9, 0.25);
    if (this.high) {
      // Foam thrown outward, along the aim.
      this.trail.spray(this.v1.set(at.x, 1.0, at.z), this.v2.copy(this.fwd).setY(0.35), 14, 7.5);
    } else {
      // Drops fly back toward her: the water is drawing the enemy in.
      this.trail.spray(this.v1.set(at.x, 1.0, at.z), this.v2.copy(this.fwd).multiplyScalar(-1).setY(0.3), 12, 6);
    }
    this.shake = 0.2;
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = f.impacted ? t - this.hitT : -1;

    this.screen.darken = 0.14 * smoothstep((t - 0.05) / 0.25) * (1 - smoothstep((t - 0.8) / 0.5));
    this.screen.impact = f.impacted ? impactFrameAt(t, this.hitT, [1], 0.03) : 0;

    // --- The tide ring at her feet: the cast reads it, then it fades with the spell. ---
    if (ctx) {
      const ro = smoothstep(t / 0.2) * (1 - smoothstep((t - 0.9) / 0.5));
      this.tideRing.set(ctx.caster.group.position, this.high, ro, t);
    }

    // --- The disc: forms between her hands, flies, pops. ---
    if (!f.impacted && !f.ended) {
      if (t < THROW_T) {
        const k = smoothstep(t / THROW_T);
        this.disc.copy(this.hands);
        this.discMesh.set(this.disc, 0.25 + 0.75 * k, t, this.high);
      } else {
        if (this.bolt) this.disc.set(this.bolt.pos.x, BOLT_HEIGHT + 0.1, this.bolt.pos.z);
        else this.disc.copy(this.from).addScaledVector(this.fwd, 0.6 + Math.min(RANGE, (t - THROW_T) * SPEED)).setY(BOLT_HEIGHT + 0.1);
        this.discMesh.set(this.disc, 1, t, this.high);
        // A thin line of drops sheds off it.
        if (Math.random() < 0.7) this.trail.drop(this.v1.copy(this.disc), this.v2.set((Math.random() - 0.5) * 1.2, 0.8 + Math.random(), (Math.random() - 0.5) * 1.2), 0.5, 0.09);
      }
    } else {
      this.discMesh.hide();
    }

    // --- The hit: the tide shows what it does to the enemy. ---
    if (f.impacted) {
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.v1.set(this.feet.x, 1.1, this.feet.z), 1.1 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.35, 0, 1);
      this.groundShock.set(this.feet, 0.4 + 2.2 * gp, 0.035 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.88, 0.2 * Math.exp(-after * 12));
      const fade = 1 - smoothstep((after - 0.3) / 0.45);
      const centre = this.victim ? this.v2.copy(this.victim.group.position).setY(0) : this.feet;
      // High: foam streaks fly out from the enemy. Low: blue streaks spiral in toward the enemy as it is drawn.
      this.current.set(centre, 0.35, 2.4, !this.high, 0.9 * fade, after * 1.3, 1.6, 0.9);
      if (!this.high && this.victim && ctx) {
        // A water tether from her hands to the enemy, taut while it is drawn in, then it unravels from her end.
        this.a.set(ctx.caster.group.position.x, 1.2, ctx.caster.group.position.z);
        this.b.set(this.victim.group.position.x, 1.0, this.victim.group.position.z);
        const k = THREE.MathUtils.clamp(after / TETHER_S, 0, 1);
        const head = 1 - Math.pow(1 - THREE.MathUtils.clamp(after / 0.12, 0, 1), 3);
        const tail = 0.97 * k * k * k;
        const wob = (1 - k) * 0.28;
        this.tether.setFunction((u, out) => {
          out.lerpVectors(this.a, this.b, u);
          out.x += Math.sin(u * Math.PI * 3 + t * 14) * wob * Math.sin(u * Math.PI);
          out.y += Math.sin(u * Math.PI) * 0.25;
          return out;
        }, 0.3 * (1 - 0.4 * k), Math.max(head, 0.02), tail, t);
      } else {
        this.tether.hide();
      }
    } else if (f.ended) {
      const ep = THREE.MathUtils.clamp((t - this.missT) / 0.5, 0, 1);
      this.groundShock.set(this.end, 0.3 + 1.2 * ep, 0.02 * (1 - ep) * (1 - ep));
    }
  }
}

export const waveDiscModule: EffectModule = {
  label: 'wave disc',
  category: 'hero: tide',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new WaveDisc(),
  telegraphs(effect) {
    const e = effect as WaveDisc;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    // Armed at the throw, then shown until the bolt has passed; a bolt's hit is the dodge check, not the zone.
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * RANGE, z2: ctx.from.z + d.z * RANGE, width: boltWidth(RADIUS) },
      start: 0.05, impact: THROW_T, until: e.flightEnd,
    }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as WaveDisc;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as WaveDisc).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'move', 0, 4, 0.5);
  },
};
