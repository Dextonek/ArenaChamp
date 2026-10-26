import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type GUI from 'three/addons/libs/lil-gui.module.min.js';
import { Emitter, defaultSettings, type EmitterSettings } from '../../emitter';
import { smoothstep } from '../common';
import { createScreenFx } from '../parts';
import type { BloomSettings } from '../../presets';
import type { Effect, EffectModule } from '../types';
import { WeaponModel, type WeaponModelOptions } from './kit';
import { SOCKETS, type WeaponId } from './sockets';

/**
 * Base class for a weapon's idle "enchant" aura (category 'weapons'). The weapon stands at the origin of `rig`
 * (grip at 0, head up +Y, face +Z). On play it ignites over `activation` seconds, then loops forever with period
 * `period`: subclasses build their layers into `rig` and animate them in `animate()`.
 *
 * Loop rules: drive everything periodic from `loopT` (0..period) with whole cycles per period, so frame t and
 * t + period look identical. Hide parts with `visible = false`, never with a zero scale.
 */
export abstract class WeaponAura implements Effect {
  readonly group = new THREE.Group();
  /** The weapon's own space; everything attaches here. */
  readonly rig = new THREE.Group();
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly model: WeaponModel;
  shake = 0;
  playing = false;
  /** Slow turn of the whole weapon (turns per loop; 0 = still). */
  turntable = 0;
  /** Overall intensity multiplier for the subclass to use. */
  intensity = 1;
  protected time = 0;

  constructor(readonly id: WeaponId, readonly period = 4, readonly activation = 0.8, model: WeaponModelOptions = {}) {
    this.model = new WeaponModel(id, model);
    this.rig.add(this.model.group);
    this.group.add(this.rig);
    this.screen.tint.set(0x30183a);
  }

  /** An emitter in weapon space (scaled for a ~1 m weapon), registered with main. */
  protected emitter(s: Partial<EmitterSettings>): Emitter {
    const e = new Emitter({
      ...defaultSettings(),
      maxParticles: 300, rate: 0, lifetime: 1.2, shape: 'point', shapeSize: 0, speed: 0.1, spread: 180,
      gravity: 0, drag: 0.8, sizeStart: 0.03, sizeEnd: 0.005, ...s,
    });
    this.rig.add(e.points);
    this.emitters.push(e);
    return e;
  }

  play() {
    this.time = 0;
    this.playing = true;
    for (const e of this.emitters) e.clear();
    this.reset();
  }

  update(dt: number) {
    if (this.playing) this.time += dt;
    const t = this.time;
    // the ignition ramp (0 → 1 over `activation`), then the loop
    const ramp = smoothstep(Math.min(1, t / this.activation));
    const loopT = t % this.period;
    this.screen.darken = 0.75 * ramp;
    this.rig.rotation.y = this.turntable ? (t / this.period) * this.turntable * Math.PI * 2 : 0;
    this.animate(t, loopT, ramp, dt);
    for (const e of this.emitters) e.update(dt);
  }

  /** Called on every play (clear one-shot state). */
  protected reset() {}

  /** t = seconds since play, loopT = t mod period, ramp = 0..1 ignition. */
  protected abstract animate(t: number, loopT: number, ramp: number, dt: number): void;
}

export interface WeaponModuleOptions {
  bloom?: BloomSettings;
  /** Extra controls for the weapon's folder. */
  gui?: (folder: GUI, effect: WeaponAura) => void;
}

/** The registry entry for a weapon aura: category 'weapons', front camera framed on the weapon. */
export function weaponModule(label: string, id: WeaponId, create: () => WeaponAura, opts: WeaponModuleOptions = {}): EffectModule {
  return {
    label,
    category: 'weapons',
    create,
    bloom: opts.bloom ?? { enabled: true, strength: 0.75, radius: 0.55, threshold: 0.82 },
    frameCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
      const s = SOCKETS[id];
      const dist = s.radius / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 1.1;
      controls.target.copy(s.centre);
      camera.position.set(s.centre.x - dist * 0.12, s.centre.y + dist * 0.08, s.centre.z + dist);
    },
    buildGui(folder: GUI, effect: Effect) {
      const e = effect as WeaponAura;
      folder.add(e, 'intensity', 0, 2, 0.05);
      folder.add(e, 'turntable', 0, 1, 0.25).name('turntable (turns / loop)');
      opts.gui?.(folder, e);
    },
  };
}
