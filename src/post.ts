import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { ScreenFx } from './effects/parts/screen';

/**
 * Final screen pass after tone mapping: vignette, fine grain, and impact feedback driven by camera shake —
 * chromatic aberration that grows with the shake, plus a short exposure flash whenever the shake jumps. Every
 * effect gets this for free through its `shake` value.
 *
 * Effects with a `screen` (ScreenFx) also drive: world darkening + grade, radial focus lines, and anime impact
 * frames (fully opaque frames with flat silhouettes from a mask that main.ts renders into `tMask`).
 */
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tMask: { value: null as THREE.Texture | null },
    uAberration: { value: 0 },
    uFlash: { value: 0 },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.018 },
    uTime: { value: 0 },
    uDarken: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uImpact: { value: 0 },
    uImpactColor: { value: new THREE.Color(1, 1, 1) },
    uLines: { value: 0 },
    uFocus: { value: new THREE.Vector2(0.5, 0.5) },
    uLineColor: { value: new THREE.Color(1, 1, 1) },
    uAspect: { value: 1 },
    uExposure: { value: 1 },
    uWhiteout: { value: 0 },
    uWhiteColor: { value: new THREE.Color(1, 1, 1) },
    uChroma: { value: 0 },
    uEdgeTint: { value: new THREE.Color(1, 0.3, 0.6) },
    uDesat: { value: 0 },
    uKeepHue: { value: new THREE.Color(1, 0, 0) },
    uCrack: { value: 0 },
    uShatter: { value: 0 },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 768) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tMask;
    uniform float uAberration, uFlash, uVignette, uGrain, uTime, uDarken, uImpact, uLines, uAspect;
    uniform float uExposure, uWhiteout, uChroma, uDesat, uCrack, uShatter;
    uniform vec3 uTint, uImpactColor, uLineColor, uWhiteColor, uEdgeTint, uKeepHue;
    uniform vec2 uFocus, uTexel;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    // Anime focus lines: thin wedges converging on uFocus, re-rolled ~16 times a second, clear in the middle.
    float focusLines(vec2 uv) {
      vec2 p = (uv - uFocus) * vec2(uAspect, 1.0);
      float r = length(p);
      float a = atan(p.y, p.x) / 6.28318 + 0.5;
      float cells = 150.0;
      float cell = floor(a * cells);
      float tick = floor(uTime * 16.0);
      float h = hash(vec2(cell, tick));
      float w = fract(a * cells);
      float wedge = smoothstep(0.5, 0.0, abs(w - 0.5) / (0.15 + 0.35 * h)); // thin core per cell
      float inner = 0.18 + 0.35 * hash(vec2(cell, tick + 7.0));
      return step(0.62, h) * wedge * smoothstep(inner, inner + 0.25, r);
    }

    vec2 hash2(vec2 p) {
      return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
    }
    // Voronoi shards around the focus point: x = distance to the nearest edge, yz = cell id.
    vec3 shards(vec2 uv) {
      vec2 p = (uv - uFocus) * vec2(uAspect, 1.0);
      // Polar warp: cells get long and thin away from the centre, like a crack web.
      float r = length(p), a = atan(p.y, p.x);
      vec2 q = vec2(a * 2.2, log(r + 0.03) * 3.5);
      vec2 g = floor(q), f = fract(q);
      float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 c = o + hash2(g + o) * 0.85;
        float dd = length(c - f);
        if (dd < d1) { d2 = d1; d1 = dd; id = g + o; } else if (dd < d2) { d2 = dd; }
      }
      return vec3(d2 - d1, id);
    }
    vec3 hueKeep(vec3 col) {
      // Keep pixels whose chroma direction matches uKeepHue; grey out the rest.
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 c = col - l, k = uKeepHue - dot(uKeepHue, vec3(0.299, 0.587, 0.114));
      float match = smoothstep(0.55, 0.9, dot(normalize(c + 1e-5), normalize(k + 1e-5))) * smoothstep(0.02, 0.12, length(c));
      return mix(col, mix(vec3(l), col, match), uDesat);
    }

    void main() {
      vec2 d = vUv - 0.5;
      vec2 uv = vUv;
      // Screen shatter: each shard slides outward from the focus and drops; gaps between shards go black.
      float gap = 0.0, shardShade = 1.0;
      if (uShatter > 0.001) {
        vec3 s = shards(vUv);
        vec2 rnd = hash2(s.yz);
        vec2 dir = normalize((vUv - uFocus) + (rnd - 0.5) * 0.2 + 1e-4);
        uv -= dir * uShatter * (0.03 + 0.12 * rnd.x) + vec2(0.0, uShatter * uShatter * (0.1 + 0.4 * rnd.y));
        gap = 1.0 - smoothstep(0.0, 0.02 + 0.12 * uShatter, s.x);
        shardShade = 1.0 - uShatter * 0.6 * rnd.y;
      }
      vec2 off = d * (uAberration + uChroma * 0.03);
      vec3 col = vec3(
        texture2D(tDiffuse, uv + off).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - off).b
      );
      col *= shardShade;
      col = mix(col, vec3(0.0), gap * step(0.001, uShatter));
      if (uDesat > 0.001) col = hueKeep(col);
      // World darkening: darks and mids go toward the tint, highlights (glows) stay.
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 graded = col * mix(uTint, vec3(1.0), smoothstep(0.22, 0.6, lum)); // fire / glow mids stay bright
      col = mix(col, graded, uDarken);
      // Impact flash from shake jumps: lift exposure toward warm white for a few frames.
      col += uFlash * (0.18 + 0.35 * col);
      // Exposure beat (anti-flash < 1) and whiteout.
      col *= uExposure;
      col = mix(col, uWhiteColor, uWhiteout);
      // Chromatic pulse also tints the screen edges.
      float edge = smoothstep(0.35, 0.75, length(d * vec2(1.15, 1.0)));
      col = mix(col, uEdgeTint, edge * uChroma * 0.45);
      // Crack web: bright hairline cracks with dark cores, growing outward from the focus.
      if (uCrack > 0.001) {
        vec3 s = shards(vUv);
        float rr = length((vUv - uFocus) * vec2(uAspect, 1.0));
        float reach = smoothstep(uCrack * 1.6, uCrack * 1.6 - 0.15, rr);
        float line = 1.0 - smoothstep(0.0, 0.035, s.x);
        float core = 1.0 - smoothstep(0.0, 0.012, s.x);
        col = mix(col, vec3(1.0), line * reach * 0.85);
        col = mix(col, vec3(0.0), core * reach * 0.9);
      }
      float lines = uLines > 0.001 ? focusLines(vUv) * uLines : 0.0;
      col = mix(col, uLineColor, lines);
      // Anime impact frame: opaque, flat silhouettes from the mask.
      if (uImpact > 0.5 && uImpact < 2.5) {
        float m = texture2D(tMask, vUv).r;
        vec3 fg = uImpact < 1.5 ? uImpactColor : vec3(0.0);
        vec3 bg = uImpact < 1.5 ? vec3(0.0) : uImpactColor;
        col = mix(bg, fg, m);
        float l2 = focusLines(vUv) * max(uLines, 0.6);
        col = mix(col, uImpact < 1.5 ? vec3(1.0) : vec3(0.0), l2 * (1.0 - m));
      } else if (uImpact > 2.5) {
        // X-ray / outline cards: silhouette edge from the mask (min of neighbours), bone stripes inside.
        float m = texture2D(tMask, vUv).r;
        float mn = m;
        for (int k = 0; k < 8; k++) {
          float a = float(k) * 0.785398;
          mn = min(mn, texture2D(tMask, vUv + vec2(cos(a), sin(a)) * uTexel * 3.0).r);
        }
        float outline = clamp((m - mn) * 3.0, 0.0, 1.0);
        if (uImpact < 3.5) {
          // X-ray: black card, outline + ribs and a spine in the impact colour.
          // Ribs: horizontal stripes inside the body; a faint fill so the shape still reads.
          float ribs = step(0.5, fract(vUv.y / (uTexel.y * 5.0))) * 0.6;
          float inner = m * mn * (ribs + 0.12);
          col = uImpactColor * clamp(outline + inner, 0.0, 1.0);
        } else {
          col = mix(uImpactColor, vec3(0.0), outline);
        }
        float l2 = focusLines(vUv) * max(uLines, 0.5);
        col = mix(col, uImpact < 3.5 ? uImpactColor * 0.6 : vec3(0.0), l2 * (1.0 - m) * 0.7);
      } else {
        float v = smoothstep(0.95, 0.25, length(d * vec2(1.15, 1.0)));
        col *= mix(1.0, v, uVignette);
        col += (hash(vUv * 900.0 + uTime) - 0.5) * uGrain;
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class FinishPass {
  readonly pass = new ShaderPass(FinishShader);
  private lastShake = 0;
  private flash = 0;
  private lastTime = performance.now();

  /** Call once per rendered frame with the active effect's shake (world units). */
  update(shake: number) {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    // A sudden rise in shake is an impact: kick the flash. It then decays within ~0.15 s.
    const jump = shake - this.lastShake;
    if (jump > 0.12) this.flash = Math.min(1, this.flash + jump * 1.6);
    this.flash *= Math.exp(-dt * 14);
    this.lastShake = shake;
    const u = this.pass.uniforms;
    u.uAberration.value = Math.min(shake, 1.2) * 0.012;
    u.uFlash.value = this.flash;
    u.uTime.value = (now / 1000) % 100;
  }

  /** Applies the active effect's ScreenFx (or neutral when none). `focusUv` is the focus point in screen uv. */
  setScreen(fx: ScreenFx | undefined, focusUv: THREE.Vector2, mask: THREE.Texture | null, aspect: number) {
    const u = this.pass.uniforms;
    u.uDarken.value = fx?.darken ?? 0;
    if (fx) u.uTint.value.copy(fx.tint);
    u.uImpact.value = fx && mask ? fx.impact : 0;
    if (fx) u.uImpactColor.value.copy(fx.impactColor);
    u.uLines.value = fx?.speedLines ?? 0;
    if (fx) u.uLineColor.value.copy(fx.speedLineColor);
    u.uFocus.value.copy(focusUv);
    u.tMask.value = mask;
    u.uAspect.value = aspect;
    u.uExposure.value = fx?.exposure ?? 1;
    u.uWhiteout.value = fx?.whiteout ?? 0;
    u.uChroma.value = fx?.chroma ?? 0;
    u.uDesat.value = fx?.desaturate ?? 0;
    u.uCrack.value = fx?.crack ?? 0;
    u.uShatter.value = fx?.shatter ?? 0;
    if (fx) {
      u.uWhiteColor.value.copy(fx.whiteColor);
      u.uEdgeTint.value.copy(fx.edgeTint);
      u.uKeepHue.value.copy(fx.keepHue);
    }
    if (mask) u.uTexel.value.set(1 / (mask as THREE.Texture & { image: { width: number } }).image.width, 1 / (mask as THREE.Texture & { image: { height: number } }).image.height);
    // The impact frame replaces the shake flash; don't stack a white lift on top of it.
    if (fx?.impact) u.uFlash.value = 0;
  }
}
