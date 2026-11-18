import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { H, W, type ScreenParams } from './core';

/**
 * Puts the showpiece's two drawn layers on screen.
 *
 * - **flat**: paper, ink, the sword, the eye's iris: drawn as it is, never bloomed (a bloom over white paper would glow
 *   everywhere).
 * - **glow**: sparks, the slash, the rift's edges, lightning: laid over the flat layer, and it alone feeds the bloom.
 *
 * The 2D canvases do no blurring of their own (`ctx.filter` and `shadowBlur` are slow, and missing on some phones): all
 * glow comes from the graphics card here. The final pass adds the flash, colour fringes, a vignette and a fine grain, and
 * turns linear light back into the screen's colours, so a flat colour comes out exactly as it was drawn.
 */
/** The bloom's base strength (a frame's `bloom` multiplies it). */
const BLOOM = 0.38;

export class Compositor {
  readonly renderer: THREE.WebGLRenderer;
  readonly flat: HTMLCanvasElement;
  readonly glow: HTMLCanvasElement;
  readonly flatCtx: CanvasRenderingContext2D;
  readonly glowCtx: CanvasRenderingContext2D;
  private flatTex: THREE.CanvasTexture;
  private glowTex: THREE.CanvasTexture;
  private bloomComposer: EffectComposer;
  private bloom: UnrealBloomPass;
  private finalScene = new THREE.Scene();
  private finalMat: THREE.ShaderMaterial;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /** The size the layers are drawn at, in real pixels. */
  width = 0;
  height = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
    this.renderer.autoClear = true;
    this.flat = document.createElement('canvas');
    this.glow = document.createElement('canvas');
    this.flatCtx = this.flat.getContext('2d', { alpha: false })!;
    this.glowCtx = this.glow.getContext('2d')!;
    const tex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      return t;
    };
    this.flatTex = tex(this.flat);
    this.glowTex = tex(this.glow);
    this.glowTex.premultiplyAlpha = true;

    // The glow layer alone, on black, then bloomed: the result is glow + its halo.
    const glowScene = new THREE.Scene();
    glowScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tGlow: { value: this.glowTex } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tGlow; varying vec2 vUv; void main(){ vec4 g = texture2D(tGlow, vUv); gl_FragColor = vec4(g.rgb, 1.0); }',
      depthTest: false,
      depthWrite: false,
    })));
    const target = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    this.bloomComposer = new EffectComposer(this.renderer, target);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new RenderPass(glowScene, this.cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), BLOOM, 0, 0);
    // Mostly the near, tight mips: the far ones would fill the whole frame with an orange haze.
    this.bloom.compositeMaterial.uniforms.bloomFactors.value = [1, 0.6, 0.3, 0.12, 0.04];
    this.bloomComposer.addPass(this.bloom);

    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tFlat: { value: this.flatTex },
        tGlow: { value: this.glowTex },
        tBloom: { value: null },
        uFlash: { value: 0 },
        uAberration: { value: 0 },
        uVignette: { value: 0.25 },
        uInvert: { value: 0 },
        uSeed: { value: 0 },
        uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tFlat, tGlow, tBloom;
        uniform float uFlash, uAberration, uVignette, uInvert, uSeed;
        uniform vec2 uTexel;
        varying vec2 vUv;
        vec3 toScreen(vec3 c) {
          c = clamp(c, 0.0, 1.0);
          return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
        }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
        vec3 layers(vec2 uv) {
          vec3 flat_ = texture2D(tFlat, uv).rgb;
          vec4 g = texture2D(tGlow, uv);
          vec3 b = texture2D(tBloom, uv).rgb - g.rgb;   // the halo alone
          return flat_ * (1.0 - g.a) + g.rgb + max(b, 0.0);
        }
        void main() {
          vec2 d = vUv - 0.5;
          vec2 off = d * uAberration * uTexel.x * 2.0;
          vec3 c = layers(vUv);
          if (uAberration > 0.01) c = vec3(layers(vUv + off).r, c.g, layers(vUv - off).b);
          // An impact frame: light and dark swapped, in warm greys (not the colours' opposites).
          float lum = dot(clamp(c, 0.0, 1.0), vec3(0.3, 0.55, 0.15));
          c = mix(c, vec3(1.0, 0.96, 0.9) * (1.0 - lum), uInvert);
          float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.75)));
          c *= mix(1.0, v, uVignette);
          c = mix(c, vec3(1.0, 0.97, 0.92), uFlash);
          vec3 s = toScreen(c);
          s += (hash(vUv * 1000.0) - 0.5) * 0.02;
          gl_FragColor = vec4(s, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.finalScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.finalMat));
  }

  /** Sets the size the layers are drawn at (the picture keeps its 16:9 units); returns the scale from units to pixels. */
  setSize(width: number, height: number) {
    width = Math.round(width);
    height = Math.round(height);
    if (width === this.width && height === this.height) return width / W;
    this.width = width;
    this.height = height;
    for (const c of [this.flat, this.glow]) { c.width = width; c.height = height; }
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.bloomComposer.setSize(width, height);
    this.bloom.resolution.set(width, height);
    this.finalMat.uniforms.uTexel.value.set(1 / width, 1 / height);
    // A new size makes three allocate the textures again.
    this.flatTex.dispose();
    this.glowTex.dispose();
    return width / W;
  }

  /** Both layers cleared and set to draw in picture units (1920 by 1080). */
  begin() {
    const s = this.width / W;
    this.flatCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.flatCtx.globalAlpha = 1;
    this.flatCtx.globalCompositeOperation = 'source-over';
    this.flatCtx.fillStyle = '#000';
    this.flatCtx.fillRect(0, 0, this.width, this.height);
    this.flatCtx.setTransform(s, 0, 0, s, 0, 0);
    this.glowCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.glowCtx.globalAlpha = 1;
    this.glowCtx.globalCompositeOperation = 'source-over';
    this.glowCtx.clearRect(0, 0, this.width, this.height);
    this.glowCtx.setTransform(s, 0, 0, s, 0, 0);
  }

  /** The layers as drawn, onto the screen. */
  present(p: ScreenParams, t: number) {
    this.flatTex.needsUpdate = true;
    this.glowTex.needsUpdate = true;
    this.bloom.strength = BLOOM * p.bloom;
    this.bloomComposer.render();
    const u = this.finalMat.uniforms;
    u.tBloom.value = this.bloomComposer.readBuffer.texture;
    u.uFlash.value = p.flash;
    u.uAberration.value = p.aberration;
    u.uVignette.value = p.vignette;
    u.uInvert.value = p.invert;
    u.uSeed.value = Math.floor(t * 30) % 97;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.finalScene, this.cam);
  }
}
