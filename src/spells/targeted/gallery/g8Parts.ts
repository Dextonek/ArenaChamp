import * as THREE from 'three';
import { mergeParts } from '../../../effects/common';
import { Flecks, clamp01, easeOut, hash, smooth } from '../../../heroes/sheath/partsBig';

/**
 * Gallery group 8 (coral bastion, gargoyle swoop): the pieces the two share. Nothing here makes a three.js object when the file
 * is loaded: every piece is a class or a function called from a look's constructor. No dice: `hash` of an index.
 */
export { Flecks, clamp01, easeOut, hash, smooth };

const TAIL = /* glsl */ `#include <tonemapping_fragment>\n#include <colorspace_fragment>`;
const SUN = new THREE.Vector3(0.35, 0.85, 0.4).normalize();

export interface PaintOptions {
  seed?: number;
  /** Per-face brightness jitter (0.1 = plus or minus 5 percent). */
  vary?: number;
  /** Moss or lichen on the faces that look up. */
  lichen?: THREE.Color | null;
  /** Keep the geometry's own (smooth) normals instead of flat faces. */
  smooth?: boolean;
  /** Shade both sides alike (a thin panel). */
  both?: boolean;
}

/**
 * Bakes a light into vertex colours (these looks use basic materials): a sun from above and aside, darker undersides, a jitter
 * per face and optional lichen. Returns a non-indexed geometry with only position, normal and color.
 */
export function paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PaintOptions = {}): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  if (!o.smooth || !g.attributes.normal) g.computeVertexNormals();
  const base = new THREE.Color(color), c = new THREE.Color();
  const seed = o.seed ?? 0, vary = o.vary ?? 0.12;
  const n = g.attributes.position.count, nor = g.attributes.normal, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const face = Math.floor(i / 3);
    const dot = nor.getX(i) * SUN.x + nor.getY(i) * SUN.y + nor.getZ(i) * SUN.z;
    let k = 0.5 + 0.5 * (o.both ? Math.abs(dot) : Math.max(0, dot));
    if (!o.both && nor.getY(i) < -0.3) k *= 0.8;
    k *= 1 + (hash(seed + face * 1.7) - 0.5) * vary;
    c.copy(base);
    if (o.lichen && nor.getY(i) > 0.55 && hash(seed * 3.3 + face * 3.7) > 0.7) c.lerp(o.lichen, 0.75);
    out[i * 3] = c.r * k; out[i * 3 + 1] = c.g * k; out[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** Several painted pieces as one geometry (flat faces; all must come from `paint`). */
export function joinParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeParts(parts);
}

/** A soft round dot texture (glow, `ring` false) or a bubble (a bright rim round a clear middle). */
export function dotTexture(ring: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  if (ring) {
    gr.addColorStop(0, 'rgba(255,255,255,0.08)');
    gr.addColorStop(0.62, 'rgba(255,255,255,0.18)');
    gr.addColorStop(0.82, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Flecks drawn as round bubbles instead of flakes. */
export function bubbleFlecks(max: number, size: number): Flecks {
  const f = new Flecks(max, size);
  const m = f.mesh.material as THREE.PointsMaterial;
  m.map?.dispose();
  m.map = dotTexture(true);
  m.needsUpdate = true;
  return f;
}

/** Chips of stone or shell: thrown with `burst`, they fall, bounce, settle and shrink away. */
export class Chips {
  readonly mesh: THREE.InstancedMesh;
  private pos: Float32Array;
  private vel: Float32Array;
  private ang: Float32Array;
  private spin: Float32Array;
  private size: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private head = 0;
  private seed = 0;
  private top = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private max: number, palette: string[]) {
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.ang = new Float32Array(max * 3);
    this.spin = new Float32Array(max * 3);
    this.size = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1);
    this.life = new Float32Array(max).fill(1);
    const geo = paint(new THREE.IcosahedronGeometry(0.5, 0), '#ffffff', { vary: 0.25 });
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }), max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.Color();
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, col.set(palette[i % palette.length]).multiplyScalar(0.82 + 0.3 * hash(i * 2.3)));
    this.clear();
  }

  clear() {
    this.head = 0;
    this.seed = 0;
    this.top = 0;
    this.age.fill(1);
    this.mesh.count = 0;
  }

  /**
   * `n` chips from (x, y, z), thrown with (vx, vy, vz) plus `spread` m/s at random, `size` m (a little jitter, flat or long),
   * for `life` s; they rest on the floor from about 0.4 of their life and shrink at the end.
   */
  burst(x: number, y: number, z: number, n: number, vx: number, vy: number, vz: number, spread: number, size: number, life: number) {
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      this.top = Math.max(this.top, i + 1);
      const s = this.seed++, b = i * 3;
      const a = hash(s * 1.37 + 5) * Math.PI * 2, r = spread * (0.3 + 0.7 * hash(s * 2.11 + 3));
      this.pos[b] = x + (hash(s * 4.1) - 0.5) * 0.2; this.pos[b + 1] = y; this.pos[b + 2] = z + (hash(s * 4.9) - 0.5) * 0.2;
      this.vel[b] = vx + Math.cos(a) * r; this.vel[b + 1] = vy + spread * 0.7 * hash(s * 3.7 + 1); this.vel[b + 2] = vz + Math.sin(a) * r;
      this.ang[b] = hash(s * 5.1) * 6.28; this.ang[b + 1] = hash(s * 5.9) * 6.28; this.ang[b + 2] = hash(s * 6.7) * 6.28;
      this.spin[b] = (hash(s * 7.3) - 0.5) * 14; this.spin[b + 1] = (hash(s * 8.3) - 0.5) * 14; this.spin[b + 2] = (hash(s * 9.1) - 0.5) * 14;
      const sz = size * (0.55 + 0.9 * hash(s * 10.7 + 2));
      this.size[b] = sz * (0.8 + 0.5 * hash(s * 11.3)); this.size[b + 1] = sz * (0.55 + 0.5 * hash(s * 12.1)); this.size[b + 2] = sz * (0.8 + 0.5 * hash(s * 13.9));
      this.life[i] = life * (0.75 + 0.5 * hash(s * 14.3));
      this.age[i] = 0;
    }
    this.mesh.count = this.top;
  }

  update(dt: number) {
    for (let i = 0; i < this.top; i++) {
      const b = i * 3, a = this.age[i];
      if (a >= 1) {
        this.s.setScalar(1e-4);
        this.p.set(0, -50, 0);
        this.m.compose(this.p, this.q.identity(), this.s);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      this.age[i] = Math.min(1, a + dt / this.life[i]);
      const f = this.age[i], fade = 1 - smooth((f - 0.72) / 0.28);
      this.vel[b + 1] -= 11 * dt;
      this.pos[b] += this.vel[b] * dt; this.pos[b + 1] += this.vel[b + 1] * dt; this.pos[b + 2] += this.vel[b + 2] * dt;
      const floor = this.size[b + 1] * 0.4 * fade;
      let live = 1;
      if (this.pos[b + 1] < floor) {
        this.pos[b + 1] = floor;
        if (this.vel[b + 1] < -1.2) this.vel[b + 1] *= -0.28; else this.vel[b + 1] = 0;
        this.vel[b] *= 0.62; this.vel[b + 2] *= 0.62;
        live = 0.25;
      }
      this.ang[b] += this.spin[b] * dt * live; this.ang[b + 1] += this.spin[b + 1] * dt * live; this.ang[b + 2] += this.spin[b + 2] * dt * live;
      this.e.set(this.ang[b], this.ang[b + 1], this.ang[b + 2]);
      this.q.setFromEuler(this.e);
      this.p.set(this.pos[b], this.pos[b + 1], this.pos[b + 2]);
      this.s.set(Math.max(this.size[b] * fade, 1e-4), Math.max(this.size[b + 1] * fade, 1e-4), Math.max(this.size[b + 2] * fade, 1e-4));
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export interface FloorColors {
  dark: string;
  acc: string;
  pale: string;
  hot: string;
  sand?: string;
}

/**
 * The lane drawn on the floor, a flat strip from the caster along the aim. Mode 0: sea water, a dark teal wash with caustic
 * light and a foam edge, turning to rippled sand (`sand` 0..1). Mode 1: gothic tracery, a chain of pointed lancet arches in
 * thin lines that light up in candle gold behind a front (`lit` 0..1 of the length). `reach` (0..1) draws it from the caster
 * outward, `hush` (0..1) is the dead beat.
 */
export class LaneFloor {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor(private length: number, width: number, mode: 0 | 1, cols: FloorColors) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {
        uLen: { value: length }, uHalf: { value: width / 2 }, uReach: { value: 0 }, uAlpha: { value: 1 }, uLit: { value: 0 },
        uHush: { value: 0 }, uTime: { value: 0 }, uSand: { value: 0 }, uMode: { value: mode },
        uDark: { value: new THREE.Color(cols.dark) }, uAcc: { value: new THREE.Color(cols.acc) }, uPale: { value: new THREE.Color(cols.pale) },
        uHot: { value: new THREE.Color(cols.hot) }, uSandCol: { value: new THREE.Color(cols.sand ?? cols.pale) },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uLen, uHalf, uReach, uAlpha, uLit, uHush, uTime, uSand, uMode;
        uniform vec3 uDark, uAcc, uPale, uHot, uSandCol;
        float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
        void main() {
          float u = 1.0 - vUv.y;
          float x = (vUv.x - 0.5) * uHalf * 2.0;
          float zl = u * uLen;
          float drawn = smoothstep(uReach, uReach - 0.04, u) * step(0.0005, uReach);
          float head = exp(-pow((u - uReach) * uLen / 0.45, 2.0)) * step(u, uReach + 0.01);
          float side = smoothstep(uHalf, uHalf - 0.22, abs(x));
          vec3 col; float a;
          if (uMode < 0.5) {
            float t = uTime;
            float p1 = sin(x * 4.0 + t * 1.2 + sin(zl * 2.7 + t) * 1.4);
            float p2 = sin(zl * 4.4 - t * 0.9 + sin(x * 3.1 - t * 1.3) * 1.4);
            float caus = smoothstep(0.34, 0.0, abs(p1 + p2)) * (1.0 - 0.75 * uHush);
            float ed = abs(abs(x) - (uHalf - 0.07));
            float dry = step(0.22, h1(floor(zl * 8.0) + (x > 0.0 ? 17.0 : 3.0)));
            float edge = smoothstep(0.05, 0.015, ed) * dry;
            col = mix(uDark, uPale, clamp(caus * 0.8 + edge, 0.0, 1.0));
            col = mix(col, uAcc, 0.14 * side * (1.0 - caus));
            a = max(0.52 * side, max(caus * 0.65 * side, edge * 0.85));
            a = max(a, head * 0.4 * side);
            float rip = 0.5 + 0.5 * sin(zl * 9.0 + x * 3.0 * sin(zl * 1.7));
            vec3 sc = uSandCol * (0.72 + 0.28 * rip);
            col = mix(col, sc, uSand);
            a = mix(a, side * 0.9, uSand);
          } else {
            float w = uHalf * 0.82;
            float P = w * 1.732 + 0.32;
            float y = mod(zl, P);
            float inCell = step(y, w * 1.732);
            float d = abs(length(vec2(abs(x) + w, y)) - 2.0 * w);
            float arch = smoothstep(0.05, 0.014, d) * inCell * step(abs(x), w);
            float w2 = w * 0.5;
            float d2 = abs(length(vec2(abs(x) + w2, y - 0.1)) - 2.0 * w2);
            float arch2 = smoothstep(0.04, 0.011, d2) * step(y, 0.1 + w2 * 1.732) * step(0.1, y) * step(abs(x), w2);
            float ctr = smoothstep(0.022, 0.006, abs(x)) * 0.7;
            float lines = max(arch, max(arch2 * 0.9, ctr));
            float lit = smoothstep(uLit, uLit - 0.1, u) * step(0.001, uLit);
            float near = exp(-max(uLit - u, 0.0) * uLen / 1.1) * step(u, uLit);
            col = mix(uPale * 0.62, uAcc, lit);
            col = mix(col, uHot, clamp(near * 0.9, 0.0, 1.0));
            col = mix(uDark, col, clamp(lines * 1.4, 0.0, 1.0));
            float wash = 0.42 * side * (1.0 - 0.3 * uHush);
            a = max(wash, lines * (0.5 + 0.5 * lit) * (1.0 - 0.45 * uHush));
            a = max(a, near * 0.28 * side);
          }
          gl_FragColor = vec4(col, a * drawn * uAlpha);
          ${TAIL}
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.group.visible = false;
  }

  /** Lays it from (x, z) along (dirX, dirZ). */
  place(x: number, z: number, dirX: number, dirZ: number) {
    this.group.position.set(x + dirX * this.length / 2, 0.03, z + dirZ * this.length / 2);
    this.group.rotation.y = Math.atan2(dirX, dirZ);
  }

  set(time: number, reach: number, alpha: number, hush: number, lit: number, sand: number) {
    this.group.visible = alpha > 0.003 && reach > 0.001;
    const u = this.mat.uniforms;
    u.uTime.value = time; u.uReach.value = reach; u.uAlpha.value = alpha; u.uHush.value = hush; u.uLit.value = lit; u.uSand.value = sand;
  }
}
