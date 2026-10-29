import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Shield test (mechanics): a pale ring flash at the caster's feet and, at once, a 60 HP shield for 4 s
 * (`ctx.shieldSelf`). The bubble, the bar segment and the break come from the engine, not from this effect.
 * A tool for checking shields, not a hero spell.
 */
export interface ShieldTestSettings {
  amount: number;
  seconds: number;
}

export const defaultShieldTest = (): ShieldTestSettings => ({ amount: 60, seconds: 4 });

const DURATION = 0.6;

export class ShieldTest implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShieldTestSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private at = new THREE.Vector3();

  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0, depthWrite: false }),
  );

  constructor(settings: ShieldTestSettings = defaultShieldTest()) {
    this.settings = settings;
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  get duration() {
    return DURATION;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.at.copy(ctx.from).setY(0);
  }

  play() {
    this.time = 0;
    this.playing = true;
    this.ring.visible = true;
    this.ctx?.shieldSelf?.(this.settings.amount, this.settings.seconds);
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
    const k = this.time / DURATION;
    this.ring.position.set(this.at.x, 0.07, this.at.z);
    this.ring.scale.setScalar(0.8 + 1.6 * (1 - (1 - k) ** 2));
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
  }
}

export const shieldTestModule: EffectModule = {
  label: 'shield test',
  category: 'test: mechanics',
  targeting: { mode: 'self', radius: 4 },
  create: () => new ShieldTest(),
  bloom: { enabled: false, strength: 0.2, radius: 0.3, threshold: 0.9 },
  frameCamera(camera, controls, effect) {
    const e = effect as ShieldTest;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ShieldTest).settings;
    f.add(s, 'amount', 1, 300, 1).name('shield HP');
    f.add(s, 'seconds', 0.5, 10, 0.1);
  },
};
