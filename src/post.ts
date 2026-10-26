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
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tMask;
    uniform float uAberration, uFlash, uVignette, uGrain, uTime, uDarken, uImpact, uLines, uAspect;
    uniform vec3 uTint, uImpactColor, uLineColor;
    uniform vec2 uFocus;
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

    void main() {
      vec2 d = vUv - 0.5;
      vec2 off = d * uAberration;
      vec3 col = vec3(
        texture2D(tDiffuse, vUv + off).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - off).b
      );
      // World darkening: darks and mids go toward the tint, highlights (glows) stay.
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 graded = col * mix(uTint, vec3(1.0), smoothstep(0.22, 0.6, lum)); // fire / glow mids stay bright
      col = mix(col, graded, uDarken);
      // Impact flash from shake jumps: lift exposure toward warm white for a few frames.
      col += uFlash * (0.18 + 0.35 * col);
      float lines = uLines > 0.001 ? focusLines(vUv) * uLines : 0.0;
      col = mix(col, uLineColor, lines);
      // Anime impact frame: opaque, flat silhouettes from the mask.
      if (uImpact > 0.5) {
        float m = texture2D(tMask, vUv).r;
        vec3 fg = uImpact < 1.5 ? uImpactColor : vec3(0.0);
        vec3 bg = uImpact < 1.5 ? vec3(0.0) : uImpactColor;
        col = mix(bg, fg, m);
        float l2 = focusLines(vUv) * max(uLines, 0.6);
        col = mix(col, uImpact < 1.5 ? vec3(1.0) : vec3(0.0), l2 * (1.0 - m));
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
    // The impact frame replaces the shake flash; don't stack a white lift on top of it.
    if (fx?.impact) u.uFlash.value = 0;
  }
}
