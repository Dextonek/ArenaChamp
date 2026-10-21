import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Final screen pass after tone mapping: vignette, fine grain, and impact feedback driven by camera shake —
 * chromatic aberration that grows with the shake, plus a short exposure flash ("impact frame") whenever the
 * shake jumps. Every effect gets this for free through its `shake` value.
 */
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAberration: { value: 0 },
    uFlash: { value: 0 },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.018 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAberration, uFlash, uVignette, uGrain, uTime;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      vec2 off = d * uAberration;
      vec3 col = vec3(
        texture2D(tDiffuse, vUv + off).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - off).b
      );
      // Impact frame: lift exposure toward warm white for a few frames.
      col += uFlash * (0.18 + 0.35 * col);
      float v = smoothstep(0.95, 0.25, length(d * vec2(1.15, 1.0)));
      col *= mix(1.0, v, uVignette);
      col += (hash(vUv * 900.0 + uTime) - 0.5) * uGrain;
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
}
