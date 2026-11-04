import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import { CutShards, ShadowPool, ShadowWisps, SHADOW, SHADOW_CSS } from '../../effects/parts/shadow';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SMOKE_RADIUS, SMOKE_SECONDS, shadowSmoke, watchCover } from '../../traits/shadow';

/**
 * Smoke Veil (shadow kit, W: a fixed smoke cloud, `self` mode, `projectile` hits). A 3 m (`SMOKE_RADIUS`) cloud of small dark-purple toon
 * wisps with eroding edges rises at her feet and stays where she cast it for 3 s (`SMOKE_SECONDS`): it does not follow her. A black
 * pool with a violet rim and a pale foil ring lies under it so it reads on the dark floor; the pool is the telegraph (0.3 s) and the
 * edge of the zone. While she stands inside, her trait counts her as faded (this effect writes the cloud, spot and end time, into
 * `shadowSmoke` on both screens). Every 0.4 s from 0.3 s on, each enemy whose LIVE position is inside the cloud is hit for 0 and blinded
 * 0.5 s (`projectile: true`), so a blind ends 0.5 s after the enemy leaves it and an enemy outside is never hit. The cloud thins away
 * in its last 0.4 s; clean by 3.5 s. See pipeline/designs/kit-shadow.md.
 */
export interface SmokeVeilSettings {
  blindSeconds: number;
  loop: boolean;
}

export const defaultSmokeVeil = (): SmokeVeilSettings => ({ blindSeconds: 0.5, loop: false });

const FIRST = 0.3; // the cloud has formed, the first blind check
const EVERY = 0.4;
const DURATION = SMOKE_SECONDS + 0.5;

export class SmokeVeil implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SmokeVeilSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private spot = new THREE.Vector3();
  private nextTick = FIRST;
  private emitDebt = 0;
  private faded = false;

  // Parts.
  private pool = new ShadowPool();
  private wisps = new ShadowWisps(90);
  private shards = new CutShards(16);

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: SmokeVeilSettings = defaultSmokeVeil()) {
    this.settings = settings;
    this.screen.tint.set(SHADOW.dark);
    this.group.add(this.pool.mesh, this.wisps.mesh, this.shards.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FIRST;
  }

  /** Where the cloud stands (fixed). */
  get at() {
    return this.spot;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    watchCover(ctx);
    this.spot.copy(ctx.sentFrom ?? ctx.from).setY(0);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (ctx) shadowSmoke.set(ctx.caster, { x: this.spot.x, z: this.spot.z, r: SMOKE_RADIUS, until: performance.now() + SMOKE_SECONDS * 1000 });
    this.pool.spread(this.spot, SMOKE_RADIUS, 0);
    // The cloud goes up with a puff of black flakes.
    this.shards.burst(this.v1.copy(this.spot).setY(0.4), SMOKE_RADIUS * 0.6, 8, 3, 2, 0.7);
    this.shake = 0.08;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.nextTick = FIRST;
    this.emitDebt = 0;
    this.faded = false;
    clearScreenFx(this.screen);
    this.pool.reset();
    this.wisps.reset();
    this.shards.reset();
    const ctx = this.ctx;
    const s = ctx ? shadowSmoke.get(ctx.caster) : undefined;
    if (s && s.x === this.spot.x && s.z === this.spot.z) s.until = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
    this.wisps.update(dt);
    this.shards.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    this.layout(t, dt);
    while (this.nextTick <= Math.min(t, SMOKE_SECONDS)) {
      this.blind();
      this.nextTick += EVERY;
    }
    this.shake *= Math.exp(-dt * 10);
  }

  /** Every enemy inside the cloud NOW (live positions) is blinded: a status with no damage. */
  private blind() {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.spot.x, p.z - this.spot.z) > SMOKE_RADIUS) continue;
      ctx.hit(e, {
        damage: 0, knock: 0, from: this.spot.clone(), color: SHADOW_CSS.foil, projectile: true,
        status: { kind: 'blind', seconds: this.settings.blindSeconds },
      });
    }
  }

  private layout(t: number, dt: number) {
    // The pool grows in over the telegraph and thins away at the end.
    this.pool.spread(this.spot, SMOKE_RADIUS, smoothstep(t / FIRST));
    if (!this.faded && t >= SMOKE_SECONDS) {
      this.faded = true;
      this.pool.shrink(0.45);
    }
    // Wisps: small, many, rising and curling inside the 3 m; none are made in the last 0.4 s.
    if (t < SMOKE_SECONDS - 0.4) {
      this.emitDebt += dt * 26;
      while (this.emitDebt >= 1) {
        this.emitDebt -= 1;
        const a = Math.random() * Math.PI * 2, r = SMOKE_RADIUS * 0.92 * Math.sqrt(Math.random());
        this.v1.set(this.spot.x + Math.cos(a) * r, 0.12 + Math.random() * 0.35, this.spot.z + Math.sin(a) * r);
        // A slow swirl round the centre plus a lift.
        this.v2.set(-Math.sin(a) * 0.7, 0.55 + Math.random() * 0.5, Math.cos(a) * 0.7);
        this.wisps.emit(this.v1, this.v2, 0.32 + Math.random() * 0.34, 1.0 + Math.random() * 0.7);
      }
    }
  }
}

export const smokeVeilModule: EffectModule = {
  label: 'smoke veil',
  category: 'hero: shadow',
  // Self: the cloud stands where she cast it; enemies inside (live) are blinded every 0.4 s. The CPU casts it when the enemy is within about 2.4 m.
  targeting: { mode: 'self', radius: SMOKE_RADIUS },
  create: () => new SmokeVeil(),
  telegraphs(effect) {
    const e = effect as SmokeVeil;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.at.x, z: e.at.z, radius: SMOKE_RADIUS }, start: 0, impact: FIRST }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SmokeVeil;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as SmokeVeil).settings;
    f.add(s, 'loop');
    f.add(s, 'blindSeconds', 0.2, 1.5, 0.1);
  },
};
