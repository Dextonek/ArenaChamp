import * as THREE from 'three';

/**
 * Full-screen feedback an effect can drive every frame, like `shake`: world darkening + colour grade, anime
 * impact frames with flat silhouettes, and radial focus / speed lines. Put one on the effect as `screen` and
 * set its fields in `update()`; main.ts and the FinishPass read it each rendered frame.
 */
export interface ScreenFx {
  /** 0..1: dims the darks and mids toward `tint` while highlights stay (additive glows keep popping). */
  darken: number;
  /** Multiplier colour for the darkened world, e.g. #3a4a8a for a cold night grade. */
  tint: THREE.Color;
  /**
   * Impact frame, a fully opaque full-screen frame:
   * 0 = off, 1 = dark frame (black screen, silhouettes in `impactColor`),
   * 2 = light frame (`impactColor` screen, black silhouettes).
   */
  impact: 0 | 1 | 2;
  impactColor: THREE.Color;
  /** Objects drawn as flat silhouettes on impact frames (enemies, the caster, a weapon...). */
  silhouettes: THREE.Object3D[];
  /** 0..1: radial anime focus lines converging on `focus`. */
  speedLines: number;
  /** World point the focus lines converge on. */
  focus: THREE.Vector3;
  speedLineColor: THREE.Color;
}

export function createScreenFx(): ScreenFx {
  return {
    darken: 0,
    tint: new THREE.Color(0x40508a),
    impact: 0,
    impactColor: new THREE.Color(0xffffff),
    silhouettes: [],
    speedLines: 0,
    focus: new THREE.Vector3(),
    speedLineColor: new THREE.Color(0xffffff),
  };
}

/** Back to neutral (call in reset()). Keeps colours and silhouettes. */
export function clearScreenFx(fx: ScreenFx) {
  fx.darken = 0;
  fx.impact = 0;
  fx.speedLines = 0;
}

/**
 * Impact-frame sequencer: which frame mode is showing at time `t` for a sequence that starts at `start`.
 * `pattern` lists the modes in order (default dark then light), each held `frameTime` seconds (default 3 frames
 * at 60 fps); 0 entries are normal frames, so `[2, 0, 2, 0, 2]` with `frameTime` 2/60 is a strobe.
 * Returns 0 before and after.
 */
export function impactFrameAt(t: number, start: number, pattern: (0 | 1 | 2)[] = [1, 2], frameTime = 0.05): 0 | 1 | 2 {
  const i = Math.floor((t - start) / frameTime);
  return i >= 0 && i < pattern.length ? pattern[i] : 0;
}
