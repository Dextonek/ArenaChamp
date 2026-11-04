import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { HIVE, HIVE_CSS, Honeycomb, HoneySplash, Swarm } from '../../effects/parts/hive';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { CLOUD_SECONDS, MAX_WASPS, cloudWasps } from '../../traits/hive';

/**
 * Swarm Cloud (hive kit v5, E: a zone). Every wasp he holds (the trait spends them at the cast: `cloudWasps`, the same on
 * both screens; 6 in the VFX tool) streams from him to the spot (9 m, clamped) as a ribbon over 0.7 s and hangs there as a
 * 2.5 m cloud of wasps for 3 s over a wax honeycomb floor with a dark gap layer. The circle telegraph shows from the
 * cast and its impact is 1.0 s (he is rooted until then). Ticks at 1.0, 2.0 and 3.0 s (the end): each re-checks every
 * enemy's live position against the circle and hits it for 7 per wasp (`ctx.hit`, 42 at six) and blinds it for 1 s. When
 * it ends the wasps stream back to him at 3.0 s (the trait gives them back then, up to 6). Clean by 3.6 s, inside the
 * duel's 4.2 s window for spell hits. Cloud size on screen is 3 wasps per count (at least 3) so it reads at gameplay distance.
 */
export interface SwarmCloudSettings {
  /** Damage per wasp per tick. */
  perWasp: number;
  /** Wasps in the VFX tool (a duel reads the trait's count). */
  wasps: number;
  loop: boolean;
}

export const defaultSwarmCloud = (): SwarmCloudSettings => ({ perWasp: 7, wasps: MAX_WASPS, loop: false });

export const SWARM_CLOUD_RANGE = 9;

// Timeline (seconds).
const FLY_T = 0.7;
const FIRST_TICK = 1.0;
const END_T = CLOUD_SECONDS;
const RETURN_S = 0.45;
const DURATION = END_T + RETURN_S + 0.2;
const RADIUS = 2.5;
const BLIND_S = 1;

export class SwarmCloud implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SwarmCloudSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly circle: Extract<TelegraphShape, { kind: 'circle' }> = { kind: 'circle', x: 0, z: 0, radius: RADIUS };
  private time = 0;
  private flags = { fly: false, back: false, gone: false };
  private ticks = 0;
  private count = MAX_WASPS;
  private from = new THREE.Vector3();
  private spot = new THREE.Vector3();
  private starAt = -1;

  private swarm = new Swarm(24, 0.34);
  private floor = new Honeycomb(80, 'wax');
  private honey = new HoneySplash(16);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: HIVE.accent, core: 0xf4ffe8, additive: false });
  private ring = new ShockRefraction({ facing: 'ground' });
  private shade = new THREE.Mesh(
    new THREE.CircleGeometry(RADIUS, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: HIVE.dark, transparent: true, depthWrite: false, opacity: 0 }),
  );

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: SwarmCloudSettings = defaultSwarmCloud()) {
    this.settings = settings;
    this.shade.renderOrder = 1;
    this.shade.position.y = 0.02;
    this.group.add(this.shade, this.floor.mesh, this.swarm.mesh, this.honey.mesh, this.pop.mesh, this.ring.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FIRST_TICK;
  }

  get endTime() {
    return END_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    // The spot, limited to the spell's range.
    this.v1.set(ctx.point.x - this.from.x, 0, ctx.point.z - this.from.z);
    if (this.v1.length() > SWARM_CLOUD_RANGE) this.v1.setLength(SWARM_CLOUD_RANGE);
    this.spot.copy(this.from).add(this.v1);
    this.circle.x = this.spot.x;
    this.circle.z = this.spot.z;
  }

  play() {
    this.reset();
    this.playing = true;
    // The trait spent the wasps just before this and wrote how many (the tool: its own setting).
    const n = this.ctx ? cloudWasps.get(this.ctx.caster) : undefined;
    this.count = Math.max(0, Math.min(MAX_WASPS, n ?? this.settings.wasps));
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.ticks = 0;
    this.starAt = -1;
    this.flags.fly = this.flags.back = this.flags.gone = false;
    this.swarm.reset();
    this.floor.reset();
    this.honey.reset();
    this.shade.visible = false;
    ((this.shade.material) as THREE.MeshBasicMaterial).opacity = 0;
    this.pop.set(this.spot, 0, 0);
    this.ring.set(this.spot, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.swarm.update(dt);
    this.floor.update(dt);
    this.honey.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time, ctx = this.ctx, f = this.flags;
    const shown = Math.min(24, Math.max(3, this.count * 3));

    // 0..0.7: the wasps leave him for the spot as a ribbon, and the honeycomb floor grows there.
    if (!f.fly) {
      f.fly = true;
      this.v1.copy(this.from).setY(1.3);
      this.v2.copy(this.spot).setY(1.2);
      this.swarm.radius = RADIUS * 0.8;
      this.swarm.set(this.v1, 0.6, shown, (_i, out) => out.set(this.from.x + (Math.random() - 0.5) * 0.6, 1.1 + Math.random() * 0.5, this.from.z + (Math.random() - 0.5) * 0.6));
      this.swarm.stream(this.v1, this.v2, FLY_T, 0.8);
      this.floor.grow(this.spot, RADIUS - 0.1, 0.6, 0, 0.5);
      this.shade.visible = true;
      this.shade.position.set(this.spot.x, 0.02, this.spot.z);
    }
    const shadeOp = (this.shade.material as THREE.MeshBasicMaterial);
    shadeOp.opacity = 0.45 * Math.min(1, t / FLY_T) * (t < END_T ? 1 : Math.max(0, 1 - (t - END_T) / 0.3));
    if (t >= FLY_T && t < END_T) {
      // The cloud hangs over the spot, a little restless; it is a flat disc-like swarm.
      this.v1.set(this.spot.x, 1.2, this.spot.z);
      this.swarm.set(this.v1, RADIUS * 0.8, shown);
    }

    // Ticks: 7 per wasp to everyone inside, live positions, and blind.
    if (ctx && this.ticks < 3 && t >= FIRST_TICK + this.ticks) {
      this.ticks++;
      this.starAt = t;
      this.shake = 0.1;
      const dmg = this.settings.perWasp * this.count;
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const p = e.group.position;
        if (!insideTelegraph(this.circle, p.x, p.z)) continue;
        ctx.hit(e, { damage: dmg, knock: 0, color: HIVE_CSS.body, status: { kind: 'blind', seconds: BLIND_S } });
        this.honey.burst(this.v1.set(p.x, 1.2, p.z), 3, 1.8, 0.1, 1.6);
      }
    }
    if (this.starAt >= 0) {
      const a = t - this.starAt;
      const sp = StarBurst.pop(a, 0, 0.02);
      this.pop.set(this.v1.set(this.spot.x, 1.4, this.spot.z), 1.0 * sp.scale, sp.opacity, 0.2);
      const g = THREE.MathUtils.clamp(a / 0.35, 0, 1);
      this.ring.set(this.spot, 0.6 + (RADIUS - 0.4) * g, 0.02 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * 0.9, 0.1 * Math.exp(-a * 12));
    }

    // 3.0: the cloud ends and the wasps fly back to him (the trait gives them back now).
    if (!f.back && t >= END_T) {
      f.back = true;
      this.floor.crumble(0.4);
      this.v1.set(this.spot.x, 1.2, this.spot.z);
      const c = ctx?.caster.group.position;
      this.v2.set(c ? c.x : this.from.x, 1.3, c ? c.z : this.from.z);
      this.swarm.set(this.v1, RADIUS * 0.6, shown);
      this.swarm.stream(this.v1, this.v2, RETURN_S, 0.5);
    }
    if (f.back && !f.gone && t >= END_T + RETURN_S) {
      f.gone = true;
      this.swarm.scatter(0.25, false, 1.5);
    }
  }
}

export const swarmCloudModule: EffectModule = {
  label: 'swarm cloud',
  category: 'hero: hive',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SwarmCloud(),
  telegraphs(effect) {
    const e = effect as SwarmCloud;
    if (!e.ctx) return [];
    return [{ shape: e.circle, start: 0, impact: FIRST_TICK, until: e.endTime }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SwarmCloud;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as SwarmCloud).settings;
    f.add(s, 'loop');
    f.add(s, 'perWasp', 1, 20, 1);
    f.add(s, 'wasps', 0, MAX_WASPS, 1);
  },
};
