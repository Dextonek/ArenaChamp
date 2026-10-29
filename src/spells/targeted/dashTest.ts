import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Dash test (mechanics): the caster slides to the aimed point in 0.25 s (`ctx.moveCaster`, ease-out, clamped to the
 * ring) and, as it lands, hits every enemy within 2.5 m of the landing spot for 20 with a small knock. A pale streak
 * marks the path and a ring the landing. A tool for checking dashes, not a hero spell.
 */
export interface DashTestSettings {
  damage: number;
  knock: number;
}

export const defaultDashTest = (): DashTestSettings => ({ damage: 20, knock: 2 });

export const DASH_TEST_RANGE = 8;
const DASH_T = 0.25;
const DURATION = 0.7;
const RADIUS = 2.5;

export class DashTest implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DashTestSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the dash really ends (clamped to range and the ring). */
  readonly land = new THREE.Vector3();
  private start = new THREE.Vector3();
  private time = 0;
  private hit = false;

  private trail = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xc8d8ec, transparent: true, opacity: 0, depthWrite: false }),
  );
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xe6eef8, transparent: true, opacity: 0, depthWrite: false }),
  );

  constructor(settings: DashTestSettings = defaultDashTest()) {
    this.settings = settings;
    this.trail.visible = this.ring.visible = false;
    this.group.add(this.trail, this.ring);
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return DASH_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
  }

  play() {
    this.time = 0;
    this.hit = false;
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // Aim point limited to the spell's range, then the engine slides the caster there (it may clamp it again).
    this.start.copy(ctx.from).setY(0);
    const d = new THREE.Vector3(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    if (d.length() > DASH_TEST_RANGE) d.setLength(DASH_TEST_RANGE);
    const want = this.start.clone().add(d);
    this.land.copy(ctx.moveCaster ? ctx.moveCaster(want, DASH_T) : want).setY(0);
    this.trail.visible = this.ring.visible = true;
    const len = Math.max(0.01, this.start.distanceTo(this.land));
    this.trail.position.set((this.start.x + this.land.x) / 2, 0.06, (this.start.z + this.land.z) / 2);
    this.trail.rotation.y = Math.atan2(this.land.x - this.start.x, this.land.z - this.start.z);
    this.trail.scale.set(1.1, 1, len);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.playing = false;
      this.trail.visible = this.ring.visible = false;
      return;
    }
    const t = this.time;
    if (!this.hit && t >= DASH_T) {
      this.hit = true;
      const ctx = this.ctx;
      if (ctx) {
        // Re-check at the landing: only enemies still within reach of the spot get hit.
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.land.x, p.z - this.land.z) > RADIUS) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: this.land, color: '#dfe8f4' });
        }
      }
    }
    (this.trail.material as THREE.MeshBasicMaterial).opacity = 0.45 * Math.max(0, 1 - t / 0.4);
    const k = Math.max(0, (t - DASH_T) / (DURATION - DASH_T));
    this.ring.position.set(this.land.x, 0.07, this.land.z);
    this.ring.scale.setScalar(t < DASH_T ? 0.01 : RADIUS * (0.3 + 0.7 * Math.min(1, k * 4)));
    (this.ring.material as THREE.MeshBasicMaterial).opacity = t < DASH_T ? 0 : 0.85 * (1 - k);
  }
}

export const dashTestModule: EffectModule = {
  label: 'dash test',
  category: 'test: mechanics',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new DashTest(),
  telegraphs(effect) {
    const e = effect as DashTest;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.land.x, z: e.land.z, radius: RADIUS }, start: 0, impact: DASH_T }];
  },
  bloom: { enabled: false, strength: 0.2, radius: 0.3, threshold: 0.9 },
  frameCamera(camera, controls, effect) {
    const e = effect as DashTest;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as DashTest).settings;
    f.add(s, 'damage', 0, 100, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
