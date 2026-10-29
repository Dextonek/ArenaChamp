import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { STATUS_CAPS, STATUS_KINDS, type StatusKind } from '../../effects/status';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Status test (mechanics): a plain ring flash on the ground and, at 0.4 s, 10 damage plus the chosen status to every
 * enemy still inside the zone. Pick the kind and the seconds in the panel (the engine caps them: stun 1.2, knock-up
 * 0.8, root 1.5, slow 2.5, silence 1.5, blind 2). A tool for checking `HitOptions.status`, not a hero spell.
 */
export interface StatusTestSettings {
  kind: StatusKind;
  seconds: number;
  damage: number;
}

export const defaultStatusTest = (): StatusTestSettings => ({ kind: 'stun', seconds: 1, damage: 10 });

const HIT_T = 0.4;
const DURATION = 0.9;
const RADIUS = 3;

export class StatusTest implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StatusTestSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private point = new THREE.Vector3(0, 0, -8);
  private hit = false;

  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xc8d0e0, transparent: true, opacity: 0, depthWrite: false }),
  );

  constructor(settings: StatusTestSettings = defaultStatusTest()) {
    this.settings = settings;
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
  }

  play() {
    this.time = 0;
    this.hit = false;
    this.playing = true;
    this.ring.visible = true;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.playing = false;
      this.ring.visible = false;
      return;
    }
    const t = this.time;
    if (!this.hit && t >= HIT_T) {
      this.hit = true;
      const ctx = this.ctx;
      const s = this.settings;
      if (ctx) {
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) continue;
          ctx.hit(e, { damage: s.damage, knock: 0, from: this.point, color: '#c8d0e0', status: { kind: s.kind, seconds: s.seconds } });
        }
      }
    }
    // The ring grows to the zone's edge, then thins out.
    const k = Math.min(1, t / HIT_T);
    const out = k * k * (3 - 2 * k);
    this.ring.position.set(this.point.x, 0.07, this.point.z);
    this.ring.scale.setScalar(Math.max(0.01, RADIUS * (0.2 + 0.8 * out)));
    (this.ring.material as THREE.MeshBasicMaterial).opacity = t < HIT_T ? 0.35 + 0.5 * k : 0.85 * Math.max(0, 1 - (t - HIT_T) / (DURATION - HIT_T));
  }
}

export const statusTestModule: EffectModule = {
  label: 'status test',
  category: 'test: mechanics',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new StatusTest(),
  telegraphs(effect) {
    const ctx = (effect as StatusTest).ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: false, strength: 0.2, radius: 0.3, threshold: 0.9 },
  frameCamera(camera, controls, effect) {
    const e = effect as StatusTest;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as StatusTest).settings;
    f.add(s, 'kind', STATUS_KINDS);
    f.add(s, 'seconds', 0.1, 2.5, 0.05).name(`seconds (caps ${Object.entries(STATUS_CAPS).map(([k, v]) => `${k} ${v}`).join(', ')})`);
    f.add(s, 'damage', 0, 100, 1);
  },
};
