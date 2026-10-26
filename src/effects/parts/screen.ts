import * as THREE from 'three';

/**
 * Full-screen feedback an effect can drive every frame, like `shake`: world darkening + colour grade, anime
 * impact frames with flat silhouettes, radial focus / speed lines, exposure beats (anti-flash → whiteout),
 * chromatic-aberration pulses with tinted screen edges, a colour drain that keeps one hue, and a full-screen crack
 * web that can shatter. Put one on the effect as `screen` and set its fields in `update()`; main.ts and the
 * FinishPass read it each rendered frame.
 */
export interface ScreenFx {
  /** 0..1: dims the darks and mids toward `tint` while highlights stay (additive glows keep popping). */
  darken: number;
  /** Multiplier colour for the darkened world, e.g. #3a4a8a for a cold night grade. */
  tint: THREE.Color;
  /**
   * Impact frame, a fully opaque full-screen frame:
   * 0 = off, 1 = dark frame (black screen, silhouettes in `impactColor`),
   * 2 = light frame (`impactColor` screen, black silhouettes),
   * 3 = X-ray card (black screen, silhouettes as an `impactColor` outline with a rib/bone fill),
   * 4 = outline card (`impactColor` screen, silhouettes as a thin black outline only).
   */
  impact: 0 | 1 | 2 | 3 | 4;
  impactColor: THREE.Color;
  /** Objects drawn as flat silhouettes on impact frames (enemies, the caster, a weapon...). */
  silhouettes: THREE.Object3D[];
  /** 0..1: radial anime focus lines converging on `focus`. */
  speedLines: number;
  /** World point the focus lines (and the crack web) centre on. */
  focus: THREE.Vector3;
  speedLineColor: THREE.Color;
  /** Exposure multiplier: 1 normal, ~0.85 for the one-frame anti-flash before a whiteout, > 1 overexposed. */
  exposure: number;
  /** 0..1: mixes the frame toward `whiteColor` (the whiteout / blowout). */
  whiteout: number;
  whiteColor: THREE.Color;
  /** 0..1: chromatic-aberration pulse (RGB split growing toward the edges) plus `edgeTint` on the screen edges. */
  chroma: number;
  edgeTint: THREE.Color;
  /** 0..1: drains colour from the frame except hues close to `keepHue` (Acheron-style monochrome + one colour). */
  desaturate: number;
  keepHue: THREE.Color;
  /** 0..1: a full-screen crack web grows out from `focus` (1 = covers the screen). */
  crack: number;
  /** 0..1: the cracked screen breaks into shards that slide outward and fall, with dark gaps between them. */
  shatter: number;
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
    exposure: 1,
    whiteout: 0,
    whiteColor: new THREE.Color(0xfff6e8),
    chroma: 0,
    edgeTint: new THREE.Color(0xff4a9a),
    desaturate: 0,
    keepHue: new THREE.Color(0xff2a3a),
    crack: 0,
    shatter: 0,
  };
}

/** Back to neutral (call in reset() and when the timeline ends). Keeps colours and silhouettes. */
export function clearScreenFx(fx: ScreenFx) {
  fx.darken = 0;
  fx.impact = 0;
  fx.speedLines = 0;
  fx.exposure = 1;
  fx.whiteout = 0;
  fx.chroma = 0;
  fx.desaturate = 0;
  fx.crack = 0;
  fx.shatter = 0;
}

/**
 * Impact-frame sequencer: which frame mode is showing at time `t` for a sequence that starts at `start`.
 * `pattern` lists the modes in order (default dark then light), each held `frameTime` seconds (default 3 frames
 * at 60 fps); 0 entries are normal frames, so `[2, 0, 2, 0, 2]` with `frameTime` 2/60 is a strobe.
 * Returns 0 before and after.
 */
export function impactFrameAt(
  t: number, start: number, pattern: (0 | 1 | 2 | 3 | 4)[] = [1, 2], frameTime = 0.05,
): 0 | 1 | 2 | 3 | 4 {
  const i = Math.floor((t - start) / frameTime);
  return i >= 0 && i < pattern.length ? pattern[i] : 0;
}

/**
 * Anti-flash → whiteout beat around a flash at time `flash`: one frame darker than normal just before (the
 * "anti-flash"), then a whiteout that holds `hold` seconds and fades over `fade`. Returns `{ exposure, whiteout }`
 * to copy onto the ScreenFx.
 */
export function flashBeat(t: number, flash: number, hold = 0.06, fade = 0.3, antiDepth = 0.15) {
  const dt = t - flash;
  if (dt < -1 / 60 - 1e-4 || dt > hold + fade) return { exposure: 1, whiteout: 0 };
  if (dt < 0) return { exposure: 1 - antiDepth, whiteout: 0 };
  const w = dt <= hold ? 1 : 1 - (dt - hold) / fade;
  return { exposure: 1, whiteout: Math.max(0, w * w) };
}

/** A sharp chromatic pulse at `hit`: jumps to `peak` and decays (pass the result as `chroma`). */
export function chromaPulse(t: number, hit: number, peak = 1, decay = 9) {
  const dt = t - hit;
  return dt < 0 ? 0 : peak * Math.exp(-dt * decay);
}
