import * as THREE from 'three';
import { softDotTexture } from '../../effects/common';

/**
 * Shared looks of the arena hazards. Mid-value colours: a screen-long near-white glow would bloom the whole frame.
 * `renderOrder` 1 and up: after the see-through floors, which would otherwise hide what lies on their far half.
 */

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const beamFragment = /* glsl */ `
  uniform vec3 uCore, uGlow;
  uniform float uTime, uOpacity, uLength;
  varying vec2 vUv;
  void main() {
    float d = abs(vUv.y - 0.5) * 2.0;
    // A thin hot core inside a soft glow; heat ripples run down the beam, away from its source.
    float ripple = 0.8 + 0.2 * sin(vUv.x * uLength * 2.4 - uTime * 26.0) * sin(vUv.x * uLength * 0.9 - uTime * 11.0);
    float core = smoothstep(0.26, 0.04, d);
    float glow = pow(max(0.0, 1.0 - d), 2.4) * ripple;
    // Soft ends.
    float ends = smoothstep(0.0, 0.02, vUv.x) * smoothstep(1.0, 0.97, vUv.x);
    vec3 col = uGlow * glow * 0.75 + uCore * core * 0.8;
    gl_FragColor = vec4(col * uOpacity * ends, 1.0);
  }
`;

/** A beam of light between two points, in additive light: facing the camera, or lying flat on the floor. */
export class GlowBeam {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private pos = new Float32Array(12);
  private readonly side = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly toCam = new THREE.Vector3();

  constructor(core: THREE.ColorRepresentation, glow: THREE.ColorRepresentation, private width: number) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: beamVertex, fragmentShader: beamFragment, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {
        uCore: { value: new THREE.Color(core) }, uGlow: { value: new THREE.Color(glow) },
        uTime: { value: 0 }, uOpacity: { value: 0 }, uLength: { value: 1 },
      },
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
  }

  /** Draws from `a` to `b`; `opacity` 0 hides it. */
  set(a: THREE.Vector3, b: THREE.Vector3, camera: THREE.Camera, time: number, opacity: number, width = this.width, flat = false) {
    this.mesh.visible = opacity > 0.001;
    if (!this.mesh.visible) return;
    this.dir.subVectors(b, a);
    const len = this.dir.length();
    if (flat) this.side.set(-this.dir.z, 0, this.dir.x);
    else this.side.crossVectors(this.dir, this.toCam.subVectors(camera.position, a));
    this.side.normalize().multiplyScalar(width / 2);
    const p = this.pos;
    p[0] = a.x - this.side.x; p[1] = a.y - this.side.y; p[2] = a.z - this.side.z;
    p[3] = a.x + this.side.x; p[4] = a.y + this.side.y; p[5] = a.z + this.side.z;
    p[6] = b.x - this.side.x; p[7] = b.y - this.side.y; p[8] = b.z - this.side.z;
    p[9] = b.x + this.side.x; p[10] = b.y + this.side.y; p[11] = b.z + this.side.z;
    (this.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uOpacity.value = opacity;
    u.uLength.value = len;
  }
}

/** A pool of additive sparks with gravity. */
export class Sparks {
  readonly points: THREE.Points;
  private vel: THREE.Vector3[] = [];
  private life: Float32Array;
  private maxLife: Float32Array;
  private tint: THREE.Color[] = [];
  private grav: Float32Array;
  private pos: Float32Array;
  private col: Float32Array;
  private cursor = 0;

  constructor(private count: number, size: number) {
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count).fill(1);
    this.grav = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.vel.push(new THREE.Vector3());
      this.tint.push(new THREE.Color());
      this.pos[i * 3 + 1] = -50;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size, map: softDotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  /** `n` sparks at (x, y, z), flying out at `speed` and up at `rise`. */
  emit(x: number, y: number, z: number, n: number, speed: number, rise: number, life: number, color: THREE.ColorRepresentation, gravity = 9) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor = (this.cursor + 1) % this.count;
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i].set(Math.cos(a) * s, rise * (0.4 + Math.random() * 0.8), Math.sin(a) * s);
      this.life[i] = this.maxLife[i] = life * (0.5 + Math.random() * 0.5);
      this.tint[i].set(color);
      this.grav[i] = gravity;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const v = this.vel[i];
      v.y -= this.grav[i] * dt;
      this.pos[i * 3] += v.x * dt;
      this.pos[i * 3 + 1] = Math.max(0.05, this.pos[i * 3 + 1] + v.y * dt);
      this.pos[i * 3 + 2] += v.z * dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i * 3] = this.tint[i].r * f;
      this.col[i * 3 + 1] = this.tint[i].g * f;
      this.col[i * 3 + 2] = this.tint[i].b * f;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** A pool of soft glows lying on the floor, each fading out: blast marks and the light under a strike. */
export class FloorGlows {
  readonly group = new THREE.Group();
  private items: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; left: number; life: number; peak: number }[] = [];
  private cursor = 0;

  constructor(count: number) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: softDotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat);
      mesh.visible = false;
      mesh.renderOrder = 1;
      this.group.add(mesh);
      this.items.push({ mesh, mat, left: 0, life: 1, peak: 0.5 });
    }
  }

  flash(x: number, z: number, radius: number, color: THREE.ColorRepresentation, life = 0.8, peak = 0.5) {
    const it = this.items[this.cursor = (this.cursor + 1) % this.items.length];
    it.mesh.position.set(x, 0.05, z);
    it.mesh.scale.setScalar(radius);
    it.mat.color.set(color);
    it.left = it.life = life;
    it.peak = peak;
    it.mesh.visible = true;
  }

  update(dt: number) {
    for (const it of this.items) {
      if (it.left <= 0) continue;
      it.left -= dt;
      it.mat.opacity = it.peak * Math.max(0, it.left / it.life);
      if (it.left <= 0) it.mesh.visible = false;
    }
  }
}
