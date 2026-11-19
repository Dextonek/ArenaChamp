import * as THREE from 'three';
import { mergeParts } from '../../effects/common';
import { C } from './numbers';

/**
 * Kagen's two big looks share these pieces (Senbon, Thousand Swords and Sekai-giri, World Sever): the katana of the rain, the
 * painted ring, the paper flecks, the cut drawn on the floor and the almond it tears open. Ported from the tool page's
 * 'thousand swords' and 'world sever' (src/spells/targeted/), cut down to a duel and drawn in his colours: cinnabar, rice
 * paper, black lacquer, steel, a little gold.
 * Nothing here makes a three.js object when the file is loaded: every piece is a class, made by its look's constructor. No dice:
 * `hash` of an index. Every shader ends with the colour-space and tone-mapping includes, so it matches the basic materials.
 */
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/** A flat material that does not z-fight the floor. */
const onFloor = <M extends THREE.Material>(m: M): M => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };

const GLSL_HASH = /* glsl */ `float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }`;
const TAIL = /* glsl */ `#include <tonemapping_fragment>\n#include <colorspace_fragment>`;

// ---------------------------------------------------------------------------------------------------------------
// The katana.
// ---------------------------------------------------------------------------------------------------------------

/**
 * One katana, tip at the origin and the body running up +Y (about 2.35 long): a curved blade with a white edge, a gold collar
 * and guard, a lacquer hilt wrapped in rice paper, a short cinnabar cord. Vertex colours.
 */
export function katanaGeometry(): THREE.BufferGeometry {
  const L = 1.6;
  const parts: THREE.BufferGeometry[] = [];
  const pos: number[] = [], col: number[] = [];
  const edge = new THREE.Color(C.steel), face = new THREE.Color('#c3ccd4'), back = new THREE.Color('#8f9aa5');
  const ring = (y: number) => {
    const k = y / L;
    const s = Math.min(1, Math.pow(y / 0.2, 0.7));
    const hw = (0.06 - 0.012 * k) * s, th = 0.018 * s;
    const cx = 0.14 * k * k; // the blade bows a little, as a katana does
    return {
      p: [[cx - hw, y, 0], [cx - hw * 0.2, y, th], [cx + hw, y, th * 0.6], [cx + hw, y, -th * 0.6], [cx - hw * 0.2, y, -th]],
      c: [edge, face, back, back, face],
    };
  };
  const put = (p: number[], c: THREE.Color) => { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); };
  const rings = [0.07, 0.2, 0.55, 0.9, 1.25, L].map(ring);
  for (let i = 0; i < 5; i++) {
    const i2 = (i + 1) % 5, r0 = rings[0];
    put([0, 0, 0], edge); put(r0.p[i], r0.c[i]); put(r0.p[i2], r0.c[i2]);
  }
  for (let j = 0; j < rings.length - 1; j++) {
    const a = rings[j], b = rings[j + 1];
    for (let i = 0; i < 5; i++) {
      const i2 = (i + 1) % 5;
      put(a.p[i], a.c[i]); put(a.p[i2], a.c[i2]); put(b.p[i2], b.c[i2]);
      put(a.p[i], a.c[i]); put(b.p[i2], b.c[i2]); put(b.p[i], b.c[i]);
    }
  }
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  parts.push(blade);

  const part = (g: THREE.BufferGeometry, hex: string, flatZ = 1, x = 0, y = 0, z = 0) => {
    g.scale(1, 1, flatZ);
    g.translate(x, y, z);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    parts.push(g);
  };
  part(new THREE.CylinderGeometry(0.055, 0.062, 0.1, 10), C.gold, 0.55, 0, L - 0.03);
  part(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 16), C.gold, 0.82, 0, L + 0.045);
  const h0 = L + 0.065, hl = 0.62;
  part(new THREE.CylinderGeometry(0.058, 0.05, hl, 8), C.dark, 0.8, 0, h0 + hl / 2);
  for (let i = 0; i < 5; i++) part(new THREE.CylinderGeometry(0.064, 0.064, 0.03, 8), '#5a2210', 0.8, 0, h0 + 0.08 + i * 0.115);
  part(new THREE.CylinderGeometry(0.066, 0.06, 0.05, 10), C.gold, 0.85, 0, h0 + hl + 0.025);
  part(new THREE.BoxGeometry(0.016, 0.26, 0.016), C.accent, 1, 0.078, h0 + hl - 0.14, 0.02);
  part(new THREE.BoxGeometry(0.034, 0.07, 0.034), C.gold, 1, 0.08, h0 + hl - 0.3, 0.02);
  return mergeParts(parts);
}

/** Two crossed streak quads, head at y = 0 and tail at y = 1 (a falling blade's trail): white steel to cinnabar. Instanced. */
export function streakMesh(count: number): THREE.InstancedMesh {
  const a = new THREE.PlaneGeometry(1, 1);
  a.translate(0, 0.5, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const geo = mergeParts([a, b]);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uHead: { value: new THREE.Color(C.steel) }, uTail: { value: new THREE.Color(C.accent) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform vec3 uHead; uniform vec3 uTail;
      void main() {
        float across = abs(vUv.x * 2.0 - 1.0);
        float v = vUv.y;
        float a = pow(1.0 - v, 1.5) * pow(1.0 - across, 1.3) * 0.5;
        gl_FragColor = vec4(mix(uHead, uTail, smoothstep(0.0, 0.7, v)), a);
        ${TAIL}
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return mesh;
}

/** A small flat star on the floor (a steel flash where a blade bites): instanced, one age per instance (0 fresh .. 1 gone). */
export class FloorFlashes {
  readonly mesh: THREE.InstancedMesh;
  private age: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private e = new THREE.Euler();

  constructor(private max: number) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.age = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1);
    geo.setAttribute('aAge', this.age);
    const mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSteel: { value: new THREE.Color(C.steel) }, uCin: { value: new THREE.Color(C.accent) } },
      vertexShader: /* glsl */ `
        attribute float aAge; varying vec2 vUv; varying float vAge;
        void main() { vUv = uv; vAge = aAge; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vAge; uniform vec3 uSteel; uniform vec3 uCin;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p), ang = atan(p.y, p.x);
          float rays = pow(abs(cos(ang * 4.0)), 6.0);
          float ring = smoothstep(0.08, 0.0, abs(r - 0.18 - vAge * 0.55)) * (1.0 - vAge);
          float a = (exp(-r * 7.0) * 0.55 + rays * exp(-r * 3.2) * 0.45 + ring * 0.5) * (1.0 - vAge) * (1.0 - vAge) * step(vAge, 0.999);
          gl_FragColor = vec4(mix(uSteel, uCin, smoothstep(0.1, 0.9, r)), min(a, 0.4));
          ${TAIL}
        }`,
    }));
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  clear() {
    this.mesh.count = 0;
  }

  /** Instance i: at (x, z), `size` m wide, `age` 0..1, turned by `rot`. */
  set(i: number, x: number, z: number, size: number, age: number, rot: number) {
    if (i >= this.max) return;
    this.mesh.count = Math.max(this.mesh.count, i + 1);
    this.e.set(0, rot, 0);
    this.q.setFromEuler(this.e);
    this.p.set(x, 0.05, z);
    this.s.setScalar(size);
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(i, this.m);
    this.age.setX(i, age);
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.age.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The brush ring (Senbon).
// ---------------------------------------------------------------------------------------------------------------

/** Half the side of the ring's plane, in metres, and its radius painted in the texture (the rules' ring is 3 m). */
const RING_HALF = 3.3;

function brushTexture(radius: number): THREE.CanvasTexture {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const px = S / 2 / RING_HALF; // pixels a metre
  const mid = S / 2;
  const R = radius * px;
  // a faint wash of cinnabar inside the ring
  g.fillStyle = 'rgba(207,74,28,0.07)';
  g.beginPath();
  g.arc(mid, mid, R * 0.97, 0, Math.PI * 2);
  g.fill();
  // the stroke: one turn of a brush, pressed hard at the start and lifting toward the end
  const N = 220;
  const width = (k: number) => R * (0.12 + 0.07 * Math.pow(1 - k, 0.8) + 0.02 * Math.sin(k * 23) + 0.015 * (hash(k * 91) - 0.5));
  const mid0 = (k: number) => R * 0.9 + R * 0.012 * Math.sin(k * 9 + 1) + R * 0.008 * (hash(k * 57) - 0.5);
  g.fillStyle = C.accent;
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const k = i / N, a = k * Math.PI * 2, r = mid0(k) + width(k) / 2;
    g[i ? 'lineTo' : 'moveTo'](mid + Math.cos(a) * r, mid + Math.sin(a) * r);
  }
  for (let i = N; i >= 0; i--) {
    const k = i / N, a = k * Math.PI * 2, r = mid0(k) - width(k) / 2;
    g.lineTo(mid + Math.cos(a) * r, mid + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  // dry-brush streaks: darker and lighter bristle lines along the stroke, thinning out toward its end
  for (let i = 0; i < 70; i++) {
    const k0 = hash(i * 3.1) * 0.85, k1 = Math.min(1, k0 + 0.1 + 0.4 * hash(i * 5.7));
    const off = (hash(i * 7.3) - 0.5) * 0.9;
    g.strokeStyle = i % 3 === 0 ? 'rgba(20,16,12,0.35)' : i % 3 === 1 ? 'rgba(235,232,226,0.28)' : 'rgba(150,50,16,0.5)';
    g.lineWidth = 1 + hash(i * 1.7) * 2;
    g.beginPath();
    for (let j = 0; j <= 24; j++) {
      const k = k0 + (k1 - k0) * (j / 24), a = k * Math.PI * 2, r = mid0(k) + off * width(k) * 0.5;
      g[j ? 'lineTo' : 'moveTo'](mid + Math.cos(a) * r, mid + Math.sin(a) * r);
    }
    g.stroke();
  }
  // the end of the stroke breaks into bristles (gaps cut out)
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    const k0 = 0.62 + 0.36 * hash(i * 2.3), k1 = Math.min(1, k0 + 0.1 + 0.2 * hash(i * 4.1));
    g.strokeStyle = `rgba(0,0,0,${0.5 + 0.5 * hash(i * 6.1)})`;
    g.lineWidth = 1 + hash(i * 8.3) * 2.2;
    g.beginPath();
    const off = (hash(i * 9.7) - 0.5) * 0.8;
    for (let j = 0; j <= 14; j++) {
      const k = k0 + (k1 - k0) * (j / 14), a = k * Math.PI * 2, r = mid0(k) + off * width(k);
      g[j ? 'lineTo' : 'moveTo'](mid + Math.cos(a) * r, mid + Math.sin(a) * r);
    }
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  // the rice-paper rim: a fine line just outside the stroke, broken here and there, and a fainter one inside
  g.strokeStyle = C.foil;
  g.lineCap = 'round';
  for (let s = 0; s < 2; s++) {
    g.lineWidth = s ? 2 : 3.4;
    g.globalAlpha = s ? 0.5 : 0.85;
    const r = s ? R * 0.74 : R * 1.0;
    for (let i = 0; i < 30; i++) {
      const a0 = (i / 30) * Math.PI * 2 + 0.02, a1 = a0 + (Math.PI * 2 / 30) * (0.55 + 0.4 * hash(i * 3.3 + s * 11));
      g.beginPath();
      g.arc(mid, mid, r, a0, a1);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  // where the brush touched down: a blob and flicked drops
  g.fillStyle = C.accent;
  g.beginPath();
  g.arc(mid + R * 0.9 + R * 0.01, mid, R * 0.1, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 12; i++) {
    const a = (hash(i * 2.9) - 0.5) * 0.5, d = R * (0.8 + 0.25 * hash(i * 4.9));
    g.beginPath();
    g.arc(mid + Math.cos(a) * d, mid + Math.sin(a) * d, 1.5 + 3 * hash(i * 6.3), 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The ring painted on the floor by one brush stroke (`reveal` 0..1 round it), with a flash of rice paper (`flash`). */
export class BrushRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(radius: number) {
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uMap: { value: brushTexture(radius) }, uReveal: { value: 0 }, uAlpha: { value: 1 }, uFlash: { value: 0 },
        uPaper: { value: new THREE.Color(C.foil) },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform sampler2D uMap; uniform float uReveal; uniform float uAlpha; uniform float uFlash; uniform vec3 uPaper;
        void main() {
          vec2 p = vUv - 0.5;
          float ang = fract(atan(-p.y, p.x) / 6.28318530718);
          float seen = smoothstep(uReveal, uReveal - 0.03, ang) * step(0.0005, uReveal) + step(0.999, uReveal);
          vec4 t = texture2D(uMap, vUv);
          vec3 col = mix(t.rgb, uPaper, uFlash * 0.3);
          gl_FragColor = vec4(col, t.a * clamp(seen, 0.0, 1.0) * uAlpha);
          ${TAIL}
        }`,
    }));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(RING_HALF * 2, RING_HALF * 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(x: number, z: number, reveal: number, alpha: number, flash: number) {
    this.mesh.visible = alpha > 0.003 && reveal > 0.001;
    this.mesh.position.set(x, 0.035, z);
    const u = this.mat.uniforms;
    u.uReveal.value = reveal;
    u.uAlpha.value = alpha;
    u.uFlash.value = flash;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Paper flecks.
// ---------------------------------------------------------------------------------------------------------------

function flakeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(5, 8); g.lineTo(24, 4); g.lineTo(27, 22); g.lineTo(9, 27);
  g.closePath();
  g.fill();
  return new THREE.CanvasTexture(c);
}

/** A pool of small flakes (paper, steel, cinnabar): thrown with `burst`, they fall with a drag, settle and fade. */
export class Flecks {
  readonly mesh: THREE.Points;
  private pos: Float32Array;
  private colA: THREE.BufferAttribute;
  private posA: THREE.BufferAttribute;
  private rgb: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private age: Float32Array;
  private grav: Float32Array;
  private head = 0;
  private seed = 0;

  constructor(private max: number, size = 0.2) {
    this.pos = new Float32Array(max * 3);
    const col = new Float32Array(max * 4);
    this.rgb = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max).fill(1);
    this.grav = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(this.pos, 3);
    this.colA = new THREE.BufferAttribute(col, 4);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    this.colA.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posA);
    geo.setAttribute('color', this.colA);
    this.mesh = new THREE.Points(geo, new THREE.PointsMaterial({
      size, map: flakeTexture(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, alphaTest: 0.02,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.clear();
  }

  clear() {
    this.head = 0;
    this.seed = 0;
    this.age.fill(1);
    this.life.fill(1);
    for (let i = 0; i < this.max; i++) { this.pos[i * 3 + 1] = -50; this.colA.setW(i, 0); }
    this.posA.needsUpdate = this.colA.needsUpdate = true;
  }

  /** `n` flakes from (x, y, z): `speed` m/s outward, `up` m/s upward, falling at `grav` (negative: rising embers) for `life` s. */
  burst(x: number, y: number, z: number, n: number, speed: number, up: number, color: THREE.Color, life: number, grav = 7) {
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      const s = this.seed++;
      const a = hash(s * 1.37 + 1) * Math.PI * 2, sp = speed * (0.35 + 0.65 * hash(s * 2.11 + 3));
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * sp; this.vel[i * 3 + 1] = up * (0.5 + 0.7 * hash(s * 3.7 + 5)); this.vel[i * 3 + 2] = Math.sin(a) * sp;
      const shade = 0.82 + 0.18 * hash(s * 5.3);
      this.rgb[i * 3] = color.r * shade; this.rgb[i * 3 + 1] = color.g * shade; this.rgb[i * 3 + 2] = color.b * shade;
      this.life[i] = life * (0.7 + 0.5 * hash(s * 7.9 + 2));
      this.age[i] = 0;
      this.grav[i] = grav;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      const a = this.age[i];
      if (a >= 1) continue;
      const b = i * 3;
      this.age[i] = a + dt / this.life[i];
      if (this.age[i] >= 1) { this.pos[b + 1] = -50; this.colA.setW(i, 0); continue; }
      const drag = Math.exp(-2.2 * dt);
      this.vel[b] *= drag; this.vel[b + 2] *= drag;
      this.vel[b + 1] = this.vel[b + 1] * Math.exp(-0.8 * dt) - this.grav[i] * dt;
      this.pos[b] += this.vel[b] * dt;
      this.pos[b + 1] += this.vel[b + 1] * dt;
      this.pos[b + 2] += this.vel[b + 2] * dt;
      if (this.pos[b + 1] < 0.04) { this.pos[b + 1] = 0.04; this.vel[b] *= 0.4; this.vel[b + 1] = 0; this.vel[b + 2] *= 0.4; }
      const f = this.age[i], fade = f < 0.1 ? f / 0.1 : 1 - smooth((f - 0.55) / 0.45);
      this.colA.setXYZW(i, this.rgb[b], this.rgb[b + 1], this.rgb[b + 2], fade);
    }
    this.posA.needsUpdate = this.colA.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The cut (Sekai-giri).
// ---------------------------------------------------------------------------------------------------------------

/** A flat ribbon along a line: `width` across, `length` along, centred, uv.y = 1 at its local -z end (`u = 1 - uv.y` runs from his feet). */
function ribbon(width: number, length: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2);
}

/**
 * The cut drawn on the floor before it tears: a fine rice-paper line down the middle with cinnabar edges on the lane's two
 * sides (dry-brush gaps), a faint wash between, a brush head that runs to the far end (`reach` 0..1), a slow pulse and a
 * light that travels the line. `hush` (0..1) is the dead beat: the pulse stops and the line thins to a hair. Plus a dark wash
 * round it, so the grey world closes in on the line.
 */
export class CutLine {
  readonly group = new THREE.Group();
  private line: THREE.Mesh;
  private wash: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private washMat: THREE.MeshBasicMaterial;

  constructor(private length: number, width: number) {
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uReach: { value: 0 }, uAlpha: { value: 1 }, uPulse: { value: 0 }, uHush: { value: 0 }, uTime: { value: 0 },
        uLen: { value: length }, uHalf: { value: width / 2 },
        uPaper: { value: new THREE.Color(C.foil) }, uCin: { value: new THREE.Color(C.accent) },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform float uReach, uAlpha, uPulse, uHush, uTime, uLen, uHalf; uniform vec3 uPaper, uCin;
        ${GLSL_HASH}
        void main() {
          float u = 1.0 - vUv.y;
          float x = (vUv.x - 0.5) * uHalf * 2.0;
          float drawn = smoothstep(uReach, uReach - 0.05, u) * step(0.0005, uReach);
          float head = exp(-pow((u - uReach) * uLen / 0.5, 2.0)) * step(u, uReach + 0.01);
          float wob = (h1(floor(u * uLen * 7.0)) - 0.5) * 0.02;
          float lw = mix(0.055, 0.025, u) * (1.0 - 0.45 * uHush);
          float glint = exp(-pow((fract(uTime * 0.45) * 1.15 - u) * uLen / 1.3, 2.0)) * (1.0 - uHush);
          float core = smoothstep(lw * (1.0 + glint * 0.8), lw * 0.35, abs(x + wob));
          float ed = abs(abs(x) - (uHalf - 0.07));
          float dry = step(0.2, h1(floor(u * uLen * 9.0) + (x > 0.0 ? 17.0 : 3.0)));
          float edge = smoothstep(0.05, 0.016, ed) * mix(0.5, 1.0, dry) * (0.7 + 0.3 * uPulse + 0.2 * uHush);
          float ink = smoothstep(0.07, 0.02, abs(abs(x) - (uHalf - 0.2))) * 0.55;
          float wash = (0.05 + 0.07 * uPulse) * smoothstep(uHalf, uHalf - 0.25, abs(x)) * (1.0 - uHush);
          vec3 col = mix(uCin, uPaper, clamp(core + head * 0.5, 0.0, 1.0));
          col = mix(vec3(0.078, 0.063, 0.047), col, max(core, edge));
          float a = max(max(max(core * 0.95, edge * 0.9), ink), max(wash, head * 0.5 * smoothstep(uHalf, 0.0, abs(x)))) * drawn * uAlpha;
          gl_FragColor = vec4(col, a);
          ${TAIL}
        }`,
    }));
    this.line = new THREE.Mesh(ribbon(width, length), this.mat);
    this.line.renderOrder = 3;
    this.line.frustumCulled = false;
    // the dark wash round the line: clearest near it, darker away from it
    this.washMat = onFloor(new THREE.MeshBasicMaterial({ color: C.dark, transparent: true, opacity: 0, depthWrite: false, map: washTexture() }));
    this.wash = new THREE.Mesh(new THREE.PlaneGeometry(width + 9, length + 5).rotateX(-Math.PI / 2), this.washMat);
    this.wash.renderOrder = 1;
    this.wash.frustumCulled = false;
    this.group.add(this.wash, this.line);
    this.group.visible = false;
  }

  /** Lays it from (x, z) along `yaw` (the aim's atan2(x, z)). */
  place(x: number, z: number, dirX: number, dirZ: number) {
    this.group.position.set(x + dirX * this.length / 2, 0.03, z + dirZ * this.length / 2);
    this.group.rotation.y = Math.atan2(dirX, dirZ);
  }

  set(time: number, reach: number, alpha: number, pulse: number, hush: number, wash: number) {
    this.group.visible = alpha > 0.003 || wash > 0.003;
    const u = this.mat.uniforms;
    u.uReach.value = reach; u.uAlpha.value = alpha; u.uPulse.value = pulse; u.uHush.value = hush; u.uTime.value = time;
    this.line.visible = alpha > 0.003;
    this.washMat.opacity = wash;
  }
}

function washTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d')!;
  // across (x): clear in the middle, dark toward the sides; along (y): fades at both ends
  const gx = g.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(255,255,255,1)');
  gx.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  gx.addColorStop(0.5, 'rgba(255,255,255,0)');
  gx.addColorStop(0.7, 'rgba(255,255,255,0.7)');
  gx.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gx;
  g.fillRect(0, 0, 64, 128);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, 128);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.16, 'rgba(0,0,0,1)');
  gy.addColorStop(0.84, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy;
  g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The line torn open: a burning almond along its whole length at once, black ink inside, a cinnabar edge that burns with a
 * hair of rice paper on the lip, a ragged flicker. `open` 0..1 is its width (pointed at both ends), `fade` 0..1 dims it, and a
 * strip of steel light (`shock`, half-width in metres) runs out from it at the tear.
 */
export class Tear {
  readonly group = new THREE.Group();
  private almond: THREE.Mesh;
  private strip: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private stripMat: THREE.ShaderMaterial;

  constructor(length: number, maxHalf: number) {
    const across = maxHalf * 2 + 0.6;
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uOpen: { value: 0 }, uFade: { value: 1 }, uTime: { value: 0 }, uHalf: { value: maxHalf }, uAcross: { value: across },
        uPaper: { value: new THREE.Color(C.foil) }, uCin: { value: new THREE.Color(C.accent) }, uInk: { value: new THREE.Color(C.dark) },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform float uOpen, uFade, uTime, uHalf, uAcross; uniform vec3 uPaper, uCin, uInk;
        ${GLSL_HASH}
        void main() {
          float u = 1.0 - vUv.y;
          float x = (vUv.x - 0.5) * uAcross;
          float env = pow(max(sin(3.14159265 * u), 0.0), 0.6);
          float rag = (h1(floor(u * 46.0)) - 0.5) * 0.16 + 0.05 * sin(u * 70.0 + uTime * 18.0);
          float hw = uOpen * uHalf * env * (1.0 + rag);
          float d = abs(x) - hw;
          float inside = smoothstep(0.025, -0.025, d) * step(0.001, uOpen);
          float depth = clamp(-d / max(hw, 0.05), 0.0, 1.0);
          float burn = exp(-max(d, 0.0) * 6.0) * step(0.001, uOpen) * (0.7 + 0.3 * sin(u * 31.0 + uTime * 24.0));
          vec3 ink = uInk + 0.03 * h1(floor(u * 24.0) + floor(abs(x) * 6.0));
          vec3 col = mix(uCin, ink, smoothstep(0.0, 0.5, depth) * 0.9);
          col = mix(col, uPaper, smoothstep(0.07, 0.0, -d) * inside * 0.85);
          float a = max(inside, burn * 0.5 * smoothstep(0.0, 0.12, hw)) * uFade;
          gl_FragColor = vec4(col, a);
          ${TAIL}
        }`,
    }));
    this.almond = new THREE.Mesh(ribbon(across, length), this.mat);
    this.almond.renderOrder = 4;
    this.almond.frustumCulled = false;
    this.stripMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uHalf: { value: 0.1 }, uA: { value: 0 }, uAcross: { value: 6 }, uSteel: { value: new THREE.Color(C.steel) } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform float uHalf, uA, uAcross; uniform vec3 uSteel;
        void main() {
          float x = abs(vUv.x - 0.5) * uAcross, u = 1.0 - vUv.y;
          float a = 1.0 - smoothstep(0.0, uHalf, x);
          float ends = smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.95, u);
          gl_FragColor = vec4(uSteel, a * a * ends * uA);
          ${TAIL}
        }`,
    });
    this.strip = new THREE.Mesh(ribbon(6, length), this.stripMat);
    this.strip.position.y = 0.01;
    this.strip.renderOrder = 5;
    this.strip.frustumCulled = false;
    this.group.add(this.almond, this.strip);
    this.group.visible = false;
  }

  place(x: number, z: number, dirX: number, dirZ: number, length: number) {
    this.group.position.set(x + dirX * length / 2, 0.04, z + dirZ * length / 2);
    this.group.rotation.y = Math.atan2(dirX, dirZ);
  }

  set(time: number, open: number, fade: number, shockHalf: number, shockA: number) {
    this.group.visible = fade > 0.003 || shockA > 0.003;
    const u = this.mat.uniforms;
    u.uOpen.value = open; u.uFade.value = fade; u.uTime.value = time;
    this.almond.visible = open > 0.001 && fade > 0.003;
    this.stripMat.uniforms.uHalf.value = Math.max(shockHalf, 1e-3);
    this.stripMat.uniforms.uA.value = shockA;
    this.strip.visible = shockA > 0.003;
  }
}

/** Shards of the world: flat chips of floor (dark slab, pale edge, a few cinnabar) that drift up from the slit and turn. */
export class Shards {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private n: number) {
    // an irregular quad as two triangles, one corner pulled out: a chip of slab
    const v = [-0.5, 0, -0.32, 0.46, 0, -0.4, 0.5, 0, 0.36, -0.28, 0, 0.5];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const pal = ['#3b3733', '#57524b', '#2a2622', '#6a645a', C.foil, C.accent];
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const r = hash(i * 4.4 + 9);
      col.set(r < 0.07 ? pal[4] : r < 0.17 ? pal[5] : pal[(i * 7) % 4]);
      this.mesh.setColorAt(i, col);
    }
    this.mesh.count = 0;
  }

  hide() {
    this.mesh.count = 0;
  }

  /**
   * `a` seconds after the tear. Shard i starts along the line at `from + dir * u * length` (a little off its middle), rises,
   * drifts sideways (`left`) and turns, and is gone by about 1.2 s.
   */
  update(a: number, fx: number, fz: number, dx: number, dz: number, length: number) {
    if (a < 0 || a > 1.4) { this.mesh.count = 0; return; }
    this.mesh.count = this.n;
    const lx = dz, lz = -dx;
    for (let i = 0; i < this.n; i++) {
      const u = hash(i * 1.9 + 1), side = hash(i * 2.7 + 2) < 0.5 ? -1 : 1;
      const tau = a - 0.1 * hash(i * 3.3 + 4);
      if (tau < 0) { this.s.setScalar(1e-4); this.p.set(0, -9, 0); this.m.compose(this.p, this.q.identity(), this.s); this.mesh.setMatrixAt(i, this.m); continue; }
      const vy = 1.3 + 2.4 * hash(i * 5.1 + 3), drift = side * (0.5 + 1.3 * hash(i * 6.1 + 5));
      const y = 0.1 + vy * tau - 1.5 * tau * tau;
      const off = (hash(i * 7.7 + 6) - 0.5) * 0.5 + drift * tau;
      this.p.set(fx + dx * u * length + lx * off, Math.max(y, 0.04), fz + dz * u * length + lz * off);
      this.e.set(tau * (2 + 3 * hash(i * 8.1)), tau * (2 + 4 * hash(i * 9.1)), tau * 3 * (hash(i * 10.1) - 0.5) + hash(i));
      this.q.setFromEuler(this.e);
      const size = (0.18 + 0.3 * hash(i * 11.3)) * smooth(tau / 0.08) * (1 - smooth((tau - 0.7) / 0.5));
      this.s.setScalar(Math.max(size, 1e-4));
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
