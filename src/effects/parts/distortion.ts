import * as THREE from 'three';

/**
 * Screen distortion (heat haze, shock refraction). Distortion meshes live only on `DISTORT_LAYER`: main.ts renders
 * that layer into a float target as signed screen-space UV offsets (additive, so overlapping fields add up) and a
 * pass bends the frame by them before bloom. Put the mesh in the effect's group like any other part; it is never
 * drawn in the normal pass.
 *
 * Strength is in screen UV units (0.01 = 1% of the screen width). Good ranges: heat haze 0.008-0.02, shock rings
 * 0.015-0.04 at the moment of impact, decaying fast.
 */
export const DISTORT_LAYER = 6;

const vert = /* glsl */ `
  uniform vec3 uCenter;
  varying vec2 vUv;
  varying vec2 vScreen;
  varying vec2 vCenterScreen;
  void main() {
    vUv = uv;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 c = projectionMatrix * viewMatrix * vec4(uCenter, 1.0);
    vScreen = clip.xy / clip.w;
    vCenterScreen = c.xy / c.w;
    gl_Position = clip;
  }
`;

const frag = /* glsl */ `
  uniform float uStrength, uTime, uMode, uRadius, uWidth, uScale, uSpeed;
  varying vec2 vUv;
  varying vec2 vScreen;
  varying vec2 vCenterScreen;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 off = vec2(0.0);
    if (uMode < 0.5) {
      // Shock ring: push pixels outward from the centre (in screen space) inside a band at uRadius.
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p);
      float band = smoothstep(uRadius - uWidth, uRadius, r) * (1.0 - smoothstep(uRadius, uRadius + uWidth * 0.6, r));
      vec2 dir = vScreen - vCenterScreen;
      float dl = length(dir);
      dir = dl > 1e-5 ? dir / dl : vec2(0.0);
      off = dir * band * uStrength;
    } else {
      // Heat haze: two scrolling noise octaves rising upward, faded at the edges and toward the top.
      vec2 q = vUv * uScale;
      float t = uTime * uSpeed;
      float nx = noise(q + vec2(0.0, -t)) + 0.5 * noise(q * 2.3 + vec2(3.1, -t * 1.7));
      float ny = noise(q + vec2(7.3, -t * 1.2)) + 0.5 * noise(q * 2.1 + vec2(1.7, -t * 2.1));
      float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
      off = (vec2(nx, ny) / 1.5 - 0.5) * 2.0 * uStrength * edge;
    }
    gl_FragColor = vec4(off, 0.0, 1.0);
  }
`;

function makeMaterial(mode: 0 | 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uStrength: { value: 0 }, uTime: { value: 0 }, uMode: { value: mode }, uRadius: { value: 0.6 },
      uWidth: { value: 0.25 }, uScale: { value: 4 }, uSpeed: { value: 1.2 }, uCenter: { value: new THREE.Vector3() },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();

/** Turns a plane to face the camera that is rendering it (works inside rotated parent groups). */
function billboard(mesh: THREE.Mesh) {
  mesh.onBeforeRender = (_r, _s, camera) => {
    mesh.parent?.getWorldQuaternion(_pq);
    camera.getWorldQuaternion(_q);
    mesh.quaternion.copy(_pq.invert().multiply(_q));
    mesh.updateMatrixWorld(true);
  };
}

export interface HeatHazeOptions {
  /** World size of the haze quad (width, height). */
  width?: number;
  height?: number;
  /** Noise frequency across the quad (higher = finer ripples). */
  scale?: number;
  /** Rise speed. */
  speed?: number;
}

/**
 * Rising heat shimmer in a camera-facing quad: put it over fire pillars, lava, beams, engines. `set(pos, strength)`
 * places its bottom-centre at `pos`; strength 0 hides it.
 */
export class HeatHaze {
  readonly mesh: THREE.Mesh;
  private mat = makeMaterial(1);
  private h: number;

  constructor(opts: HeatHazeOptions = {}) {
    const w = opts.width ?? 3, h = opts.height ?? 5;
    this.h = h;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), this.mat);
    this.mesh.layers.set(DISTORT_LAYER);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mat.uniforms.uScale.value = opts.scale ?? 4;
    this.mat.uniforms.uSpeed.value = opts.speed ?? 1.2;
    billboard(this.mesh);
  }

  /** Places the haze (bottom-centre at `pos`) with a strength in screen UV units; 0 hides it. */
  set(pos: THREE.Vector3, strength: number, time: number, scale = 1) {
    this.mesh.position.copy(pos);
    this.mesh.scale.setScalar(Math.max(scale, 1e-4));
    this.mat.uniforms.uStrength.value = strength;
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uCenter.value.copy(pos).y += (this.h * scale) / 2;
    this.mesh.visible = strength > 1e-4;
  }
}

export interface ShockRefractionOptions {
  /** Band thickness as a fraction of the radius (0.1-0.4). */
  width?: number;
  /** 'ground' lies flat on the ground (an expanding ground ring); 'camera' faces the camera (an air blast). */
  facing?: 'ground' | 'camera';
}

/**
 * An expanding refraction ring: the classic shockwave bend. `set(center, radius, strength)` each frame; drive the
 * radius outward and the strength down (e.g. strength = 0.03 * (1 - progress)²).
 */
export class ShockRefraction {
  readonly mesh: THREE.Mesh;
  private mat = makeMaterial(0);

  constructor(opts: ShockRefractionOptions = {}) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.layers.set(DISTORT_LAYER);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mat.uniforms.uWidth.value = opts.width ?? 0.25;
    this.mat.uniforms.uRadius.value = 0.8;
    if ((opts.facing ?? 'ground') === 'ground') this.mesh.rotation.x = -Math.PI / 2;
    else billboard(this.mesh);
  }

  /** Centre, outer radius in world units and strength in screen UV units; strength 0 hides it. */
  set(center: THREE.Vector3, radius: number, strength: number) {
    // The quad spans ±1 in local units; the band sits at 0.8 of that, so scale = radius / 0.8.
    this.mesh.position.copy(center);
    this.mesh.position.y = Math.max(center.y, 0.05);
    this.mesh.scale.setScalar(Math.max(radius / 0.8, 1e-4));
    this.mat.uniforms.uStrength.value = strength;
    this.mat.uniforms.uCenter.value.copy(this.mesh.position);
    this.mesh.visible = strength > 1e-4 && radius > 1e-3;
  }
}
