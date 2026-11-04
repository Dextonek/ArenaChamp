import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { HIVE, HIVE_CSS, Honeycomb, HoneySplash, Swarm } from '../../effects/parts/hive';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Enemy } from '../../effects/common';
import { BARB_SECONDS, LEAP_RANGE, LEAP_WINDOW, STINGER_KNOCK, barbedAt, leapPoison } from '../../traits/hive';

/**
 * Barbed Stinger (hive kit v5, Q: a skillshot, then a leap on the recast). Cast: a few wasps gather at his hand (0.25 s),
 * then a chunky amber stinger with two barbs flies out (20 m/s, 8 m, `ctx.projectile`, radius 0.4) flanked by wasps: 45, and
 * the trait barbs the enemy for 3 s (a stuck stinger hangs on them). It reaches 6 m at 0.55 s: a sidestep beats it. Online the
 * dealer's screen draws the flight on its nominal path (bolts fly on the victim's screen, where the hit is decided).
 * Recast (within 3 s, free, the trait's `recast`): told apart by itself with a clock per caster figure (as crosswind.ts); it
 * acts only if the enemy is barbed (`barbedAt`, written by the trait on both screens) and within 8 m on live positions,
 * else it does nothing (the trait cannot gate a recast). He leaps onto the enemy in 0.3 s (`ctx.moveCaster`, a ribbon of
 * wasps behind him) and lands for 25 in a honeycomb burst, judged on live positions inside the landing circle. If the trait
 * says he spent 2 wasps (`leapPoison`), the enemy is also poisoned: 30 over 3 s as three 10-damage ticks (1, 2, 3 s after
 * the landing; `projectile: true` so the cast's zones do not filter them) with a few wasps over them. The poison makes this
 * recast 3.7 s long, still inside the duel's 4.2 s window for spell hits. Clean by 1.4 s otherwise. The other screen has no
 * `moveCaster` (his client streams the leap): the landing circle is built from the nominal spot.
 */
export interface BarbedStingerSettings {
  damage: number;
  leapDamage: number;
  poison: number;
  /** 'auto' reads the recast clock and the barb; 'sting' / 'leap' force a variant (the tool's play button). */
  mode: 'auto' | 'sting' | 'leap';
  /** Forced leap with poison (the tool). */
  poisoned: boolean;
  loop: boolean;
}

export const defaultBarbedStinger = (): BarbedStingerSettings => ({ damage: 42, leapDamage: 25, poison: 30, mode: 'auto', poisoned: false, loop: false });

// Timeline (seconds).
const RELEASE_T = 0.25;
const SPEED = 20;
const RANGE = 8;
const RADIUS = 0.4;
const MUZZLE = 0.7;
const STING_END = 1.4;
const LEAP_S = 0.3;
const LAND_R = 2.4;
const STOP_SHORT = 1.3;
const TICKS = 3;
const NONE_END = 0.3;
const RECAST_CLOCK = (LEAP_WINDOW + 0.3) * 1000; // ms: a second cast inside this is the recast

type Mode = 'sting' | 'leap' | 'none';

/** When each caster figure last cast Barbed Stinger (ms), and whether that cast was the stinger. */
const lastCast = new WeakMap<object, { at: number; sting: boolean }>();

/** A stinger: an amber spike with two barbs and a dark tail, 1 m long along +Z (tip at +0.6). */
function stingerMesh() {
  const g = new THREE.Group();
  const amber = new THREE.MeshBasicMaterial({ color: HIVE.body });
  const dark = new THREE.MeshBasicMaterial({ color: HIVE.dark });
  const hot = new THREE.MeshBasicMaterial({ color: HIVE.hot });
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.95, 6).rotateX(Math.PI / 2), amber);
  spike.position.z = 0.12;
  const rim = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.98, 6).rotateX(Math.PI / 2), dark);
  rim.position.z = 0.1;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.8, 4).rotateX(Math.PI / 2), hot);
  core.position.z = 0.14;
  g.add(rim, spike, core);
  for (const s of [-1, 1]) {
    const barb = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 4).rotateX(-Math.PI / 2), dark);
    barb.position.set(s * 0.2, 0, -0.05);
    barb.rotation.y = s * 0.5;
    g.add(barb);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.3, 6).rotateX(Math.PI / 2), dark);
  tail.position.z = -0.4;
  g.add(tail);
  return g;
}

export class BarbedStinger implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BarbedStingerSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  mode: Mode = 'sting';
  /** The stinger's path, and the leap's landing circle. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: boltWidth(RADIUS) };
  circle: TelegraphShape = { kind: 'circle', x: 0, z: 0, radius: LAND_R };
  private time = 0;
  private len = STING_END;

  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private hand = new THREE.Vector3();
  private land = new THREE.Vector3();
  private fired = false;
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;
  private tip = new THREE.Vector3();
  private stopped = false;
  private castMs = 0;
  /** The enemy the leap goes to (and poisons), and the stuck barb's holder. */
  private victim: Enemy | null = null;
  private barbOn = -1;
  private flags = { leap: false, hit: false };
  private ticks = 0;
  private poison = false;
  private hitAt = -1;

  private stinger = stingerMesh();
  private stuck = stingerMesh();
  private swarm = new Swarm(20, 0.36);
  private cloud = new Swarm(12, 0.3);
  private comb = new Honeycomb(40, 'wax');
  private honey = new HoneySplash(18);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: HIVE.accent, core: 0xf4ffe8, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BarbedStingerSettings = defaultBarbedStinger()) {
    this.settings = settings;
    this.stuck.scale.setScalar(0.7);
    this.group.add(this.comb.mesh, this.swarm.mesh, this.cloud.mesh, this.honey.mesh, this.stinger, this.stuck, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return this.len;
  }

  get impactTime() {
    return this.mode === 'leap' ? LEAP_S : RELEASE_T;
  }

  get flightEnd() {
    return RELEASE_T + RANGE / SPEED;
  }

  /** The enemy nearest the cast on live positions within `reach`, hero or unit. */
  private nearest(ctx: CastContext, reach: number): Enemy | null {
    let best: Enemy | null = null, bd = reach;
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const d = Math.hypot(e.group.position.x - this.from.x, e.group.position.z - this.from.z);
      if (d <= bd) { bd = d; best = e; }
    }
    return best;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const now = performance.now();
    this.castMs = now;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    const prev = lastCast.get(ctx.caster);
    const open = !!prev && prev.sting && now - prev.at < RECAST_CLOCK;
    const barbed = (barbedAt.get(ctx.caster) ?? 0) > (prev?.at ?? 0);
    const m = this.settings.mode;
    this.victim = null;
    this.poison = false;
    if (m === 'sting' || (m === 'auto' && !open)) this.mode = 'sting';
    else {
      // The recast: only on a barbed enemy within 8 m (forced leaps skip the barb).
      this.victim = m === 'leap' || barbed ? this.nearest(ctx, LEAP_RANGE + 0.6) : null;
      this.mode = this.victim ? 'leap' : 'none';
      this.poison = this.mode === 'leap' && (m === 'leap' ? this.settings.poisoned : !!leapPoison.get(ctx.caster));
    }
    lastCast.set(ctx.caster, { at: now, sting: this.mode === 'sting' });

    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.mode === 'leap' && this.victim) {
      const p = this.victim.group.position;
      this.v1.set(p.x - this.from.x, 0, p.z - this.from.z);
      const d = this.v1.length();
      this.fwd.copy(this.v1).divideScalar(d || 1);
      this.land.copy(this.from).addScaledVector(this.fwd, Math.max(0, d - STOP_SHORT));
      this.circle = { kind: 'circle', x: this.land.x, z: this.land.z, radius: LAND_R };
    }
    this.hand.copy(this.from).addScaledVector(this.fwd, 0.5).setY(1.2);
    this.line = {
      kind: 'line', x1: this.from.x, z1: this.from.z, x2: this.from.x + this.fwd.x * RANGE, z2: this.from.z + this.fwd.z * RANGE, width: boltWidth(RADIUS),
    };
    this.len = this.mode === 'sting' ? STING_END : this.mode === 'none' ? NONE_END : this.poison ? LEAP_S + TICKS + 0.4 : 1.0;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = this.stopped = false;
    this.bolt = null;
    this.barbOn = -1;
    this.flags.leap = this.flags.hit = false;
    this.ticks = 0;
    this.hitAt = -1;
    this.stinger.visible = false;
    this.stuck.visible = false;
    this.swarm.reset();
    this.cloud.reset();
    this.comb.reset();
    this.honey.reset();
    this.pop.set(this.hand, 0, 0);
    this.shock.set(this.hand, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.swarm.update(dt);
    this.cloud.update(dt);
    this.comb.update(dt);
    this.honey.update(dt);
    this.time += dt;
    if (this.time >= this.len) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    if (this.mode === 'sting') this.updateSting();
    else if (this.mode === 'leap') this.updateLeap();
  }

  // ---- the stinger ----

  private updateSting() {
    const t = this.time, ctx = this.ctx;
    // 0..0.25: wasps gather at his hand.
    if (t < RELEASE_T) {
      this.swarm.set(this.hand, 0.45, 8);
    } else if (!this.fired) {
      this.fired = true;
      this.swarm.scatter(0.4, false, 2.5);
      this.tip.copy(this.from).addScaledVector(this.fwd, MUZZLE);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.tip.clone(), dir: this.fwd.clone(), speed: SPEED, range: RANGE - MUZZLE, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: STINGER_KNOCK, color: HIVE_CSS.body },
        });
        this.bolt.onHit((target, at) => this.onSting(target, at));
      }
    }
    if (this.fired && !this.stopped) {
      const live = this.bolt?.alive ?? true;
      if (this.bolt) this.tip.set(this.bolt.pos.x, 0, this.bolt.pos.z);
      else this.tip.copy(this.from).addScaledVector(this.fwd, Math.min(RANGE, MUZZLE + SPEED * (t - RELEASE_T)));
      if (!live || (!this.bolt && this.tip.distanceTo(this.from) >= RANGE)) {
        this.stopped = true;
        this.stinger.visible = false;
        this.cloud.scatter(0.4, false, 3);
      } else {
        this.stinger.visible = true;
        this.stinger.position.set(this.tip.x, 1.15, this.tip.z);
        this.stinger.rotation.y = Math.atan2(this.fwd.x, this.fwd.z);
        this.v1.set(this.tip.x, 1.15, this.tip.z);
        this.cloud.set(this.v1, 0.5, 6);
      }
    }
    // The barb is on them (the trait wrote it on both screens, or the bolt hit here): a stinger hangs on the enemy.
    if (this.barbOn < 0 && this.fired && (barbedAt.get(this.ctx?.caster ?? this) ?? 0) > this.castMs) {
      this.barbOn = t;
      this.victim = this.nearestTo(this.tip);
    }
    this.layoutBarb();
    this.layoutPop();
  }

  private nearestTo(p: THREE.Vector3): Enemy | null {
    let best: Enemy | null = null, bd = 3;
    for (const e of this.ctx?.enemies?.() ?? this.ctx?.targets ?? []) {
      const d = Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private onSting(target: Enemy, at: THREE.Vector3) {
    this.hitAt = this.time;
    this.v1.set(at.x, 1.1, at.z);
    this.honey.burst(this.v1, 6, 3.5, 0.14, 3);
    this.shake = 0.14;
    this.victim = target;
    this.barbOn = this.time;
  }

  private layoutBarb() {
    const v = this.victim;
    if (this.barbOn < 0 || !v) { this.stuck.visible = false; return; }
    const a = this.time - this.barbOn;
    if (a >= BARB_SECONDS) { this.stuck.visible = false; return; }
    const p = v.group.position;
    this.stuck.visible = true;
    // The stinger sticks out of their back, tip in, and shakes a little.
    this.stuck.position.set(p.x, 1.25 + Math.sin(a * 11) * 0.03, p.z);
    this.stuck.rotation.set(0.5, Math.atan2(this.fwd.x, this.fwd.z) + Math.PI, 0);
  }

  private layoutPop() {
    if (this.hitAt < 0) return;
    const a = this.time - this.hitAt;
    const sp = StarBurst.pop(a, 0, 0.02);
    this.pop.set(this.v1.set(this.tip.x, 1.15, this.tip.z), 0.8 * sp.scale, sp.opacity, 0.2);
    const g = THREE.MathUtils.clamp(a / 0.3, 0, 1);
    this.shock.set(this.v2.set(this.tip.x, 0, this.tip.z), 0.3 + 1.2 * g, 0.02 * (1 - g) * (1 - g));
    this.shake = 0.14 * Math.exp(-a * 12);
  }

  // ---- the leap ----

  private updateLeap() {
    const t = this.time, ctx = this.ctx, f = this.flags;
    if (!f.leap) {
      f.leap = true;
      if (ctx?.moveCaster) this.land.copy(ctx.moveCaster(this.land, LEAP_S)).setY(0);
      const c = this.circle as Extract<TelegraphShape, { kind: 'circle' }>;
      c.x = this.land.x;
      c.z = this.land.z;
      this.v1.copy(this.from).setY(1.2);
      this.v2.copy(this.land).setY(1.2);
      this.swarm.radius = 0.5;
      this.swarm.set(this.v1, 0.5, 14);
      this.swarm.stream(this.v1, this.v2, LEAP_S + 0.1, 0.9);
    }
    if (!f.hit && t >= LEAP_S) {
      f.hit = true;
      this.comb.grow(this.land, 1.7, 0.2, 0, 0.45);
      this.honey.burst(this.v1.copy(this.land).setY(0.3), 8, 4, 0.15, 3.4);
      this.shake = 0.2;
      this.hitAt = t;
      if (ctx) {
        // Live positions at the landing: everyone inside the circle takes it.
        for (const e of ctx.enemies?.() ?? ctx.targets) {
          const p = e.group.position;
          if (!insideTelegraph(this.circle, p.x, p.z)) continue;
          ctx.hit(e, { damage: this.settings.leapDamage, knock: 2, from: this.land, color: HIVE_CSS.body });
        }
      }
    }
    if (f.hit) {
      const a = t - LEAP_S;
      const sp = StarBurst.pop(a, 0, 0.02);
      this.pop.set(this.v1.copy(this.land).addScaledVector(this.fwd, 0.9).setY(1.1), 0.8 * sp.scale, sp.opacity, 0.2);
      const g = THREE.MathUtils.clamp(a / 0.35, 0, 1);
      this.shock.set(this.land, 0.4 + 2.0 * g, 0.025 * (1 - g) * (1 - g));
      this.shake = 0.2 * Math.exp(-a * 12);
      if (a > 0.8 && !this.poison) this.swarm.scatter(0.4, false, 3);
      this.poisonTicks(a);
    }
  }

  /** The poison: a few wasps hang over the enemy and three small ticks land at 1, 2 and 3 s. */
  private poisonTicks(a: number) {
    const v = this.victim;
    if (!this.poison || !v) return;
    const p = v.group.position;
    if (a < TICKS + 0.05) {
      this.v1.set(p.x, 1.4, p.z);
      this.cloud.set(this.v1, 0.6, 5);
    } else if (this.ticks >= TICKS) this.cloud.scatter(0.35, false, 2.5);
    if (this.ticks < TICKS && a >= this.ticks + 1) {
      this.ticks++;
      this.ctx?.hit(v, { damage: this.settings.poison / TICKS, knock: 0, projectile: true, color: HIVE_CSS.accent });
      this.honey.burst(this.v1.set(p.x, 1.2, p.z), 3, 1.6, 0.1, 1.5);
    }
  }
}

export const barbedStingerModule: EffectModule = {
  label: 'barbed stinger',
  category: 'hero: hive',
  targeting: { mode: 'ground', radius: 1 },
  create: () => new BarbedStinger(),
  telegraphs(effect) {
    const e = effect as BarbedStinger;
    if (!e.ctx) return [];
    if (e.mode === 'leap') return [{ shape: e.circle, start: 0, impact: LEAP_S }];
    if (e.mode === 'none') return [];
    return [{ shape: e.line, start: 0, impact: RELEASE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BarbedStinger;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as BarbedStinger).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'leapDamage', 1, 100, 1);
    f.add(s, 'poison', 0, 90, 1);
    f.add(s, 'mode', ['auto', 'sting', 'leap']);
    f.add(s, 'poisoned');
  },
};
