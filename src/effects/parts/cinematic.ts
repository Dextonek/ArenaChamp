import * as THREE from 'three';

/**
 * Cinematic camera an effect can drive every frame, like `shake` and `screen`: while `active`, main.ts renders
 * through this camera (position, look-at target, field of view, roll) instead of the orbit camera, and draws
 * letterbox bars. The orbit camera is restored after each frame, so the user's view comes back when it ends.
 */
export interface Cinematic {
  active: boolean;
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** Vertical field of view in degrees. */
  fov: number;
  /** Camera roll in radians (Dutch angle). */
  roll: number;
  /** 0..1: height of the black letterbox bars, as a fraction of the 2.39:1 bars (1 = full cinema bars). */
  letterbox: number;
}

export function createCinematic(): Cinematic {
  return {
    active: false,
    position: new THREE.Vector3(0, 4, 12),
    target: new THREE.Vector3(0, 1, 0),
    fov: 40,
    roll: 0,
    letterbox: 0,
  };
}

export function clearCinematic(c: Cinematic) {
  c.active = false;
  c.letterbox = 0;
  c.roll = 0;
}

/** One key of a shot list. Positions are world space (build them from the cast context). */
export interface ShotKey {
  /** Time in seconds (effect timeline). Keys must be sorted by `t`. */
  t: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov?: number;
  roll?: number;
  /** Hard cut: jump to this key at `t` instead of blending from the previous one. */
  cut?: boolean;
  /** Easing of the blend from the previous key into this one (default 'inOut'). */
  ease?: 'linear' | 'in' | 'out' | 'inOut';
}

const EASE = {
  linear: (x: number) => x,
  in: (x: number) => x * x * x,
  out: (x: number) => 1 - Math.pow(1 - x, 3),
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
};

/**
 * Samples a shot list at time `t` into `out`. Between two keys the camera blends with the later key's easing,
 * unless that key is a `cut`, in which case the camera holds the earlier key until the cut.
 */
export function sampleShots(keys: readonly ShotKey[], t: number, out: Cinematic) {
  if (!keys.length) return;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  if (!b || b.cut || t <= a.t) {
    out.position.copy(a.position);
    out.target.copy(a.target);
    out.fov = a.fov ?? out.fov;
    out.roll = a.roll ?? 0;
    return;
  }
  const k = EASE[b.ease ?? 'inOut'](THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1));
  out.position.lerpVectors(a.position, b.position, k);
  out.target.lerpVectors(a.target, b.target, k);
  out.fov = THREE.MathUtils.lerp(a.fov ?? out.fov, b.fov ?? a.fov ?? out.fov, k);
  out.roll = THREE.MathUtils.lerp(a.roll ?? 0, b.roll ?? 0, k);
}
