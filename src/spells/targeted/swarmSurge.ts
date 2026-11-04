import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { HIVE, HIVE_CSS, HoneySplash, Swarm } from '../../effects/parts/hive';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { MAX_WASPS, surgeWasps } from '../../traits/hive';
import { shapeMove } from '../../traits/tide';

/**
 * Swarm Surge (hive kit v5, R: a wide skillshot). He braces for 0.5 s while every wasp he holds (the trait spends them all
 * at the cast and nothing refills them: `surgeWasps`, the same on both screens; 6 in the VFX tool) lines up in a 4 m wall
 * in front of him, with a one-frame impact flash at the release. Then the wall flies as a 4 m wide column of wasps down a
 * 10 m line (12 m/s: 6 m at 1.0 s, `ctx.projectile`, radius 2, pierces): everyone it touches takes 18 per wasp (108 at
 * six), is shoved 4 m away from him (`shapeMove` from traits/tide.ts, decided from the victim's live position when the
 * bolt touches them) and blinded for 1 s, with a green star, a ground ring and honey. The 4 m wide line telegraph shows from
 * the cast. At the end of the line the wasps scatter. Online the dealer's screen draws the column on its nominal path
 * (bolts fly on the victim's screen). Clean by 2.0 s. With no wasps it is only the shove and the blind.
 */
export interface SwarmSurgeSettings {
  /** Damage per wasp spent. */
  perWasp: number;
  /** Wasps in the VFX tool (a duel reads the trait's count). */
  wasps: number;
  loop: boolean;
}

export const defaultSwarmSurge = (): SwarmSurgeSettings => ({ perWasp: 18, wasps: MAX_WASPS, loop: false });

// Timeline (seconds).
const RELEASE_T = 0.5;
const SPEED = 12;
const LENGTH = 10;
const WIDTH = 4;
const MUZZLE = 0.6;
const SHOVE = 4;
const BLIND_S = 1;
const END_T = RELEASE_T + LENGTH / SPEED + 0.7;

export class SwarmSurge implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SwarmSurgeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: WIDTH };
  private time = 0;
  private count = MAX_WASPS;
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private side = new THREE.Vector3(1, 0, 0);
  private tip = new THREE.Vector3();
  private fired = false;
  private ended = false;
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;
  private hitAt = -1;
  private hitPos = new THREE.Vector3();
  private shove = {} as HitOptions;

  private swarm = new Swarm(40, 0.42);
  private honey = new HoneySplash(24);
  private pop = new StarBurst({ points: 12, inner: 0.28, color: HIVE.accent, core: 0xf4ffe8, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();

  constructor(settings: SwarmSurgeSettings = defaultSwarmSurge()) {
    this.settings = settings;
    this.screen.impactColor.set(HIVE.hot);
    this.screen.tint.set(HIVE.dark);
    this.group.add(this.swarm.mesh, this.honey.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return END_T;
  }

  get impactTime() {
    return RELEASE_T;
  }

  get flightEnd() {
    return RELEASE_T + LENGTH / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.line = {
      kind: 'line', x1: this.from.x, z1: this.from.z, x2: this.from.x + this.fwd.x * LENGTH, z2: this.from.z + this.fwd.z * LENGTH, width: WIDTH,
    };
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).addScaledVector(this.fwd, 3).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
    // The trait spent the wasps just before this and wrote how many (the tool: its own setting).
    const n = this.ctx ? surgeWasps.get(this.ctx.caster) : undefined;
    this.count = Math.max(0, Math.min(MAX_WASPS, n ?? this.settings.wasps));
    // 0..0.5: the wasps line up in a wall across the line, in front of him.
    const shown = this.shown();
    this.swarm.size = 0.42;
    this.swarm.form((i, out) => {
      const u = shown > 1 ? i / (shown - 1) : 0.5;
      out.copy(this.from).addScaledVector(this.fwd, 1.3).addScaledVector(this.side, (u - 0.5) * (WIDTH - 0.5));
      out.y = 0.9 + 0.7 * Math.abs(Math.sin(i * 2.3)) + 0.3 * (i % 3);
      return true;
    }, shown, 9);
  }

  private shown() {
    return Math.min(40, Math.max(10, this.count * 6));
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = this.ended = false;
    this.bolt = null;
    this.hitAt = -1;
    clearScreenFx(this.screen);
    this.screen.tint.set(HIVE.dark);
    this.swarm.reset();
    this.honey.reset();
    this.pop.set(this.from, 0, 0);
    this.shock.set(this.from, 0, 0);
  }

  /** The push for the hit the bolt is about to make: from the caster's start, on the enemy nearest the bolt (live). */
  private push() {
    const ctx = this.ctx, bolt = this.bolt;
    let vx = this.tip.x + this.fwd.x, vz = this.tip.z + this.fwd.z, best = 3;
    if (ctx && bolt) {
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const d = Math.hypot(e.group.position.x - bolt.pos.x, e.group.position.z - bolt.pos.z);
        if (d < best) { best = d; vx = e.group.position.x; vz = e.group.position.z; }
      }
    }
    shapeMove(this.shove, true, this.from, this.v1.set(vx, 0, vz), this.from, SHOVE);
    return this.shove;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.swarm.update(dt);
    this.honey.update(dt);
    this.time += dt;
    if (this.time >= END_T) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time, ctx = this.ctx;

    if (!this.fired && t >= RELEASE_T) {
      this.fired = true;
      this.tip.copy(this.from).addScaledVector(this.fwd, MUZZLE);
      this.shake = 0.2;
      if (ctx?.projectile) {
        // The shove is decided when the bolt touches the enemy: getters read the enemy's live position then.
        const hit: HitOptions = { damage: this.settings.perWasp * this.count, knock: 0, color: HIVE_CSS.body, status: { kind: 'blind', seconds: BLIND_S } };
        Object.defineProperty(hit, 'pull', { enumerable: true, get: () => this.push().pull });
        Object.defineProperty(hit, 'from', { enumerable: true, get: () => this.push().from });
        this.bolt = ctx.projectile({
          from: this.tip.clone(), dir: this.fwd.clone(), speed: SPEED, range: LENGTH - MUZZLE, radius: WIDTH / 2, pierce: true, hit,
        });
        this.bolt.onHit((_target, at) => this.onHit(at));
      }
    }
    // The wall's one impact frame at the release.
    this.screen.impact = impactFrameAt(t, RELEASE_T, [1], 0.03);

    if (this.fired && !this.ended) {
      if (this.bolt) this.tip.set(this.bolt.pos.x, 0, this.bolt.pos.z);
      else this.tip.copy(this.from).addScaledVector(this.fwd, Math.min(LENGTH, MUZZLE + SPEED * (t - RELEASE_T)));
      const done = this.bolt ? !this.bolt.alive : this.tip.distanceTo(this.from) >= LENGTH;
      if (done) {
        this.ended = true;
        this.swarm.scatter(0.6, true, 4);
      } else {
        this.v1.set(this.tip.x, 1.2, this.tip.z);
        this.swarm.set(this.v1, WIDTH / 2 - 0.2, this.shown());
      }
    }

    if (this.hitAt >= 0) {
      const a = t - this.hitAt;
      const sp = StarBurst.pop(a, 0.02, 0.05);
      this.pop.set(this.v1.set(this.hitPos.x, 1.2, this.hitPos.z), 1.8 * sp.scale, sp.opacity, 0.3);
      const g = THREE.MathUtils.clamp(a / 0.4, 0, 1);
      this.shock.set(this.v1.set(this.hitPos.x, 0, this.hitPos.z), 0.5 + 2.8 * g, 0.03 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * 0.9, 0.25 * Math.exp(-a * 10));
    }
  }

  private onHit(at: THREE.Vector3) {
    this.hitAt = this.time;
    this.hitPos.copy(at);
    this.honey.burst(this.v1.set(at.x, 1.1, at.z), 10, 4.5, 0.16, 3.4);
  }
}

export const swarmSurgeModule: EffectModule = {
  label: 'swarm surge',
  category: 'hero: hive',
  targeting: { mode: 'ground', radius: 1 },
  create: () => new SwarmSurge(),
  telegraphs(effect) {
    const e = effect as SwarmSurge;
    if (!e.ctx) return [];
    return [{ shape: e.line, start: 0, impact: RELEASE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SwarmSurge;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SwarmSurge).settings;
    f.add(s, 'loop');
    f.add(s, 'perWasp', 1, 30, 1);
    f.add(s, 'wasps', 0, MAX_WASPS, 1);
  },
};
