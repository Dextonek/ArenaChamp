import * as THREE from 'three';
import { clamp01, easeOut, hash, smooth } from '../../../heroes/sheath/partsBig';

export { clamp01, easeOut, hash, smooth };

/**
 * Gallery group 6 (pipeline/designs/gallery-20.md): the pieces of Molten Glass Bloom (a glassblower's gob on a pipe, a bloom of
 * blown petals that cool, shards, a scorch of soot and frost on the floor) and of Charcoal Tempest (a sketched fan, a beam of
 * hatched charcoal strokes, smudges, blots where it hits).
 * Nothing here makes a three.js object when the file is loaded: every piece is a class, made by its look's constructor. No dice:
 * `hash` of an index. Every shader ends with the colour-space and tone-mapping includes, so it matches the basic materials.
 */

const onFloor = <M extends THREE.Material>(m: M): M => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };
const TAIL = /* glsl */ `#include <tonemapping_fragment>\n#include <colorspace_fragment>`;
const GLSL_HASH = /* glsl */ `float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }`;
const GLSL_NOISE = /* glsl */ `
  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h1(i.x + i.y * 57.0), b = h1(i.x + 1.0 + i.y * 57.0), c = h1(i.x + (i.y + 1.0) * 57.0), d = h1(i.x + 1.0 + (i.y + 1.0) * 57.0);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }`;
const FLAT_VERT = /* glsl */ `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** A flat plane on the floor whose local (x, z) is metres from an apex at the origin, running `ahead` along +z and `back` behind it. */
function apexPlane(width: number, ahead: number, back: number): THREE.BufferGeometry {
  const l = ahead + back;
  return new THREE.PlaneGeometry(width, l).rotateX(-Math.PI / 2).translate(0, 0, l / 2 - back);
}

// ---------------------------------------------------------------------------------------------------------------
// Molten glass bloom.
// ---------------------------------------------------------------------------------------------------------------

/** A soft round glow on the floor (additive): the light of the hot glass. */
export class FloorGlow {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(color: string) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uA: { value: 0 }, uCol: { value: new THREE.Color(color) } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform float uA; uniform vec3 uCol;
        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float a = exp(-r * r * 4.0) * (1.0 - smoothstep(0.8, 1.0, r)) * uA;
          gl_FragColor = vec4(uCol, a);
          ${TAIL}
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(x: number, z: number, radius: number, alpha: number) {
    this.mesh.visible = alpha > 0.004;
    this.mesh.position.set(x, 0.04, z);
    this.mesh.scale.setScalar(radius * 2);
    this.mat.uniforms.uA.value = alpha;
  }
}

/**
 * The gob of molten glass on a blowpipe: a lumpy ball (a small hot yellow core, deep orange body, a dark sooty rim) on a thin steel
 * pipe from his hand. `heat` 0..1, `wob` how much the skin wobbles (0 holds it still).
 */
export class GlassGob {
  readonly group = new THREE.Group();
  private gob: THREE.Mesh;
  private pipe: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private hand = new THREE.Vector3();

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uHeat: { value: 1 }, uTime: { value: 0 }, uWob: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uWob; varying vec3 vN; varying vec3 vV;
        void main() {
          vec3 p = position;
          float d = (sin(p.x * 5.0 + uTime * 3.0) + sin(p.y * 6.0 - uTime * 2.4) + sin(p.z * 4.5 + uTime * 2.0)) * 0.04 * uWob;
          p += normal * d;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uHeat; varying vec3 vN; varying vec3 vV;
        void main() {
          float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
          vec3 deep = vec3(0.3, 0.05, 0.01), orange = vec3(0.8, 0.2, 0.03), core = vec3(1.0, 0.5, 0.14);
          vec3 col = mix(deep, orange, smoothstep(0.0, 0.8, uHeat) * (0.5 + 0.5 * f));
          col = mix(col, core, pow(f, 6.0) * uHeat * 0.4);
          col = mix(col, vec3(0.05, 0.025, 0.015), (1.0 - f) * 0.45 * (1.0 - 0.4 * uHeat));
          gl_FragColor = vec4(col, 1.0);
          ${TAIL}
        }`,
    });
    this.gob = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), this.mat);
    this.gob.renderOrder = 6;
    this.gob.frustumCulled = false;
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    this.pipe = new THREE.Mesh(cyl, new THREE.MeshBasicMaterial({ color: '#4a4e58' }));
    this.pipe.frustumCulled = false;
    this.group.add(this.gob, this.pipe);
    this.group.visible = false;
  }

  hide() {
    this.group.visible = false;
  }

  /** The gob at `at`, `radius` m, on a pipe from the hand (at his body `from`, toward `dir`); `pipeOn` 0..1 scales the pipe. */
  set(from: THREE.Vector3, dir: THREE.Vector3, at: THREE.Vector3, radius: number, heat: number, wob: number, time: number, pipeOn: number) {
    this.group.visible = radius > 0.005;
    this.gob.position.copy(at);
    this.gob.scale.setScalar(radius);
    const u = this.mat.uniforms;
    u.uHeat.value = heat; u.uWob.value = wob; u.uTime.value = time;
    this.hand.copy(from).addScaledVector(dir, 0.38).setY(1.0);
    this.pipe.position.copy(this.hand);
    this.pipe.lookAt(at);
    const len = this.hand.distanceTo(at);
    this.pipe.scale.set(0.03, 0.03, Math.max(1e-3, len * pipeOn));
    this.pipe.visible = pipeOn > 0.01;
  }
}

const PETALS = 21;
const SHARDS_PER = 7;
const SHARDS = PETALS * SHARDS_PER;

interface PetalDef { bearing: number; len: number; wid: number; down: number; roll: number; lift: number; delay: number; shat: number }

/** The half-width profile of a petal along its length u (0..1): pointed at both ends, widest a little past the middle. */
const petalW = (u: number) => Math.pow(Math.max(Math.sin(Math.PI * Math.pow(u, 0.75)), 0), 0.85);

function petalGeometry(): THREE.BufferGeometry {
  const rows = 9;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j < rows; j++) {
    const u = j / (rows - 1), w = petalW(u);
    for (let i = -1; i <= 1; i++) {
      pos.push(i * w * 0.5, u * u + 0.4 * i * i * w, u);
      uv.push((i + 1) / 2, u);
    }
  }
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < 2; i++) {
      const a = j * 3 + i, b = a + 1, c = a + 3, d = a + 4;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * The bloom: 21 petals of blown glass in three layers (long and low, mid, short and raised) fanned over the cone from the gob,
 * hot orange at the base and cooling to clear blue-green with bright edges; then each cracks and bursts into 7 shards that fly,
 * bounce and settle as pale glass chips, with a glint while they tumble. `update(a, ...)`: `a` seconds after the hit.
 */
export class GlassBloom {
  readonly petals: THREE.InstancedMesh;
  readonly shards: THREE.InstancedMesh;
  private defs: PetalDef[] = [];
  private state: THREE.InstancedBufferAttribute;
  private sState: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private qp = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private f = new THREE.Vector3();
  private l = new THREE.Vector3();

  constructor(range: number, half: number) {
    const reach = range - 1.25;
    const layer = (n: number, spread: number, lo: number, hi: number, wid: number, down: number, lift: number, delay: number, seed: number) => {
      for (let i = 0; i < n; i++) {
        const k = n === 1 ? 0 : i / (n - 1) * 2 - 1;
        const h = hash(seed + i * 3.7);
        this.defs.push({
          bearing: k * half * spread + (hash(seed + i * 5.1) - 0.5) * 0.06,
          len: reach * (lo + (hi - lo) * h), wid: wid * (0.85 + 0.3 * hash(seed + i * 1.3)), down: down + (hash(seed + i * 9.1) - 0.5) * 0.05,
          roll: (hash(seed + i * 2.9) - 0.5) * 0.5, lift, delay: delay + 0.04 * hash(seed + i * 6.3),
          shat: 0.7 + 0.2 * hash(seed + i * 8.3),
        });
      }
    };
    layer(7, 0.93, 0.86, 0.98, 1.1, 0.15, 0.55, 0, 11);
    layer(6, 0.75, 0.6, 0.72, 1.2, 0.02, 0.9, 0.05, 41);
    layer(8, 1.0, 0.32, 0.42, 0.8, -0.42, 0.7, 0.1, 71);

    this.state = new THREE.InstancedBufferAttribute(new Float32Array(PETALS * 2), 2);
    this.state.setUsage(THREE.DynamicDrawUsage);
    const pg = petalGeometry();
    pg.setAttribute('aState', this.state);
    const pm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec2 aState; varying vec2 vUv; varying vec2 vS;
        void main() { vUv = uv; vS = aState; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying vec2 vS;
        void main() {
          float across = abs(vUv.x * 2.0 - 1.0), u = vUv.y;
          float eff = clamp(vS.x * (1.15 - 0.7 * u), 0.0, 1.0);
          float edge = smoothstep(0.55, 0.95, across);
          vec3 hot = mix(vec3(0.4, 0.07, 0.015), vec3(0.85, 0.22, 0.04), smoothstep(0.45, 0.95, eff));
          hot = mix(hot, vec3(1.0, 0.5, 0.14), smoothstep(0.92, 1.0, eff) * (1.0 - u));
          vec3 cool = mix(vec3(0.03, 0.27, 0.3), vec3(0.3, 0.85, 0.8), edge);
          vec3 col = mix(cool, hot, smoothstep(0.05, 0.55, eff));
          float streak = smoothstep(0.035, 0.0, abs(vUv.x - 0.3 - 0.12 * u)) * 0.5 * (1.0 - eff);
          float vein = smoothstep(0.03, 0.0, across) * 0.3 * (1.0 - eff);
          col += vec3(0.3, 0.6, 0.58) * (streak + vein);
          col = mix(col, vec3(0.7, 0.95, 0.9), vS.y * 0.6);
          float a = mix(0.3 + 0.62 * edge + 0.5 * streak, 0.95, smoothstep(0.1, 0.6, eff));
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
          ${TAIL}
        }`,
    });
    this.petals = new THREE.InstancedMesh(pg, pm, PETALS);
    this.petals.frustumCulled = false;
    this.petals.renderOrder = 6;
    this.petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.petals.count = 0;

    // a shard: one triangle with barycentric coordinates, so its edges can be bright
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.34, 0.56, 0, -0.1, -0.1, 0, 0.52], 3));
    tri.setAttribute('bary', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
    this.sState = new THREE.InstancedBufferAttribute(new Float32Array(SHARDS * 3), 3);
    this.sState.setUsage(THREE.DynamicDrawUsage);
    tri.setAttribute('aState', this.sState);
    const sm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec3 bary; attribute vec3 aState; varying vec3 vB; varying vec3 vS;
        void main() { vB = bary; vS = aState; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vB; varying vec3 vS;
        void main() {
          float m = min(vB.x, min(vB.y, vB.z));
          float edge = 1.0 - smoothstep(0.0, 0.13, m);
          vec3 body = mix(vec3(0.04, 0.3, 0.34), vec3(0.06, 0.26, 0.5), vS.y);
          vec3 col = mix(body, vec3(0.5, 0.92, 0.88), edge);
          col = mix(col, vec3(0.9, 1.0, 0.97), vS.x * 0.85);
          float a = (0.34 + 0.6 * edge + 0.6 * vS.x) * vS.z;
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
          ${TAIL}
        }`,
    });
    this.shards = new THREE.InstancedMesh(tri, sm, SHARDS);
    this.shards.frustumCulled = false;
    this.shards.renderOrder = 6;
    this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shards.count = 0;
  }

  hide() {
    this.petals.count = 0;
    this.shards.count = 0;
  }

  private gone(mesh: THREE.InstancedMesh, i: number) {
    this.s.setScalar(1e-4);
    this.p.set(0, -9, 0);
    this.m.compose(this.p, this.q.identity(), this.s);
    mesh.setMatrixAt(i, this.m);
  }

  /** `a` seconds after the hit; the bloom's pivot is (ox, oy, oz) and it opens along `yaw`. */
  update(a: number, ox: number, oy: number, oz: number, yaw: number) {
    if (a < 0) { this.hide(); return; }
    this.petals.count = PETALS;
    this.shards.count = SHARDS;
    for (let i = 0; i < PETALS; i++) {
      const d = this.defs[i], k = a - d.delay;
      if (k < 0 || a >= d.shat) { this.gone(this.petals, i); continue; }
      const open = easeOut(k / 0.32);
      this.s.set(d.wid * (0.45 + 0.55 * open), d.lift * open, d.len * open);
      this.e.set(d.down * (1 - 0.3 * open), yaw + d.bearing, d.roll, 'YXZ');
      this.q.setFromEuler(this.e);
      this.p.set(ox, oy, oz);
      this.m.compose(this.p, this.q, this.s);
      this.petals.setMatrixAt(i, this.m);
      this.state.setXY(i, 1 - smooth((k - 0.04) / 0.62), smooth((a - (d.shat - 0.14)) / 0.14));
    }
    this.petals.instanceMatrix.needsUpdate = true;
    this.state.needsUpdate = true;

    for (let i = 0; i < PETALS; i++) {
      const d = this.defs[i];
      const tauP = a - d.shat;
      if (tauP < 0) { for (let j = 0; j < SHARDS_PER; j++) { this.gone(this.shards, i * SHARDS_PER + j); } continue; }
      this.e.set(d.down, yaw + d.bearing, d.roll, 'YXZ');
      this.qp.setFromEuler(this.e);
      this.f.set(0, 0, 1).applyQuaternion(this.qp);
      for (let j = 0; j < SHARDS_PER; j++) {
        const n = i * SHARDS_PER + j, sd = n * 7.31;
        const u = (j + 0.25 + 0.5 * hash(sd + 1)) / SHARDS_PER, w = petalW(u);
        this.l.set((hash(sd + 2) - 0.5) * d.wid * w * 0.8, d.lift * u * u, u * d.len).applyQuaternion(this.qp);
        const x0 = ox + this.l.x, y0 = Math.max(0.1, oy + this.l.y), z0 = oz + this.l.z;
        const ang = hash(sd + 3) * Math.PI * 2, sp = 0.5 + 1.5 * hash(sd + 4), fw = 0.4 + 1.4 * hash(sd + 5);
        const vx = this.f.x * fw + Math.cos(ang) * sp, vz = this.f.z * fw + Math.sin(ang) * sp, vy = 1.2 + 2.2 * hash(sd + 6);
        const t1 = (vy + Math.sqrt(vy * vy + 18 * (y0 - 0.04))) / 9;
        const tau = tauP - 0.05 * hash(sd + 7);
        if (tau < 0) { this.gone(this.shards, n); continue; }
        const dr = (1 - Math.exp(-3 * tau)) / 3;
        let y: number;
        if (tau < t1) y = y0 + vy * tau - 4.5 * tau * tau;
        else { const t2 = tau - t1, v2 = -(vy - 9 * t1) * 0.3; y = Math.max(0.04, 0.04 + v2 * t2 - 4.5 * t2 * t2); }
        const land = tau - t1;
        const fade = 1 - smooth((land - 0.3) / 0.45);
        if (fade <= 0.003) { this.gone(this.shards, n); continue; }
        const spin = 1 - smooth(land / 0.3);
        this.e.set((hash(sd + 8) - 0.5) * 14 * Math.min(tau, t1 + 0.3) * spin, hash(sd + 9) * 6.28 + 6 * (hash(sd + 10) - 0.5) * Math.min(tau, t1 + 0.3), (hash(sd + 11) - 0.5) * 12 * Math.min(tau, t1 + 0.3) * spin, 'YXZ');
        this.q.setFromEuler(this.e);
        const sz = 0.2 + 0.22 * hash(sd + 12);
        this.s.set(sz * (0.8 + 0.6 * hash(sd + 13)), 1, sz * (0.8 + 0.6 * hash(sd + 14)));
        this.p.set(x0 + vx * dr, y, z0 + vz * dr);
        this.m.compose(this.p, this.q, this.s);
        this.shards.setMatrixAt(n, this.m);
        const glint = Math.pow(Math.max(0, Math.sin(tau * 16 + hash(sd + 15) * 30)), 10) * (1 - smooth(land / 0.5));
        this.sState.setXYZ(n, glint, hash(sd + 16), fade);
      }
    }
    this.shards.instanceMatrix.needsUpdate = true;
    this.sState.needsUpdate = true;
  }
}

/** The floor after the bloom: a cone of soot (streaked, ragged) with frost-white speckle where the glass lay, and a hot rim at the hit. */
export class FloorScorch {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(range: number, half: number) {
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uHalf: { value: half }, uR: { value: range }, uSoot: { value: 0 }, uFrost: { value: 0 }, uHot: { value: 0 },
        uTeal: { value: new THREE.Color('#9fece0') }, uOrange: { value: new THREE.Color('#ff7a1a') },
      },
      vertexShader: FLAT_VERT,
      fragmentShader: /* glsl */ `
        varying vec2 vP; uniform float uHalf, uR, uSoot, uFrost, uHot; uniform vec3 uTeal, uOrange;
        ${GLSL_HASH}
        ${GLSL_NOISE}
        void main() {
          float r = length(vP), ang = atan(vP.x, vP.y);
          float rag = (h1(floor(ang * 30.0) + 3.0) - 0.5) * 0.25 * smoothstep(0.0, 1.0, r / uR);
          float inside = smoothstep(uHalf + 0.03, uHalf - 0.1, abs(ang) + rag * 0.2) * smoothstep(uR + 0.15, uR - 0.5 + rag * 2.0, r) * smoothstep(0.1, 0.6, r);
          float n = n2(vec2(r * 1.3, ang * 7.0)) * 0.6 + n2(vec2(r * 4.0, ang * 20.0)) * 0.4;
          float str = h1(floor(ang * 44.0)) * 0.5 + 0.5;
          float soot = inside * uSoot * clamp(0.2 + 0.75 * n, 0.0, 1.0) * mix(0.6, 1.0, str);
          vec2 g = vP * 7.0;
          float spk = step(0.9, h1(dot(floor(g), vec2(1.0, 57.0)))) * smoothstep(0.3, 0.05, length(fract(g) - 0.5));
          float frost = inside * uFrost * (spk * 0.9 + 0.1 * n2(vP * 2.0));
          float dS = (uHalf - abs(ang)) * r;
          float rim = exp(-abs(dS) * 7.0) * step(abs(ang), uHalf + 0.05) * step(r, uR) + exp(-abs(uR - r) * 7.0) * step(abs(ang), uHalf);
          vec3 col = vec3(0.03, 0.03, 0.035);
          col = mix(col, uTeal, clamp(frost / (soot + frost + 0.001), 0.0, 1.0));
          col = mix(col, uOrange, clamp(rim * uHot, 0.0, 1.0));
          float a = max(max(soot * 0.8, frost), rim * uHot * 0.8);
          gl_FragColor = vec4(col, a);
          ${TAIL}
        }`,
    }));
    this.mesh = new THREE.Mesh(apexPlane(2 * range * Math.sin(half) + 0.8, range + 0.5, 0.3), this.mat);
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  place(x: number, z: number, yaw: number) {
    this.mesh.position.set(x, 0.03, z);
    this.mesh.rotation.y = yaw;
  }

  set(soot: number, frost: number, hot: number) {
    this.mesh.visible = soot > 0.004 || frost > 0.004 || hot > 0.004;
    const u = this.mat.uniforms;
    u.uSoot.value = soot; u.uFrost.value = frost; u.uHot.value = hot;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Charcoal tempest.
// ---------------------------------------------------------------------------------------------------------------

/**
 * The sketch on the floor: the fan outlined in a pale pencil line with a dark line beside it (drawn from the apex outward, then
 * the arc), a faint hatching inside, three scribbled loops round the hand; and, behind the beam, the swept part of the fan rubbed
 * to charcoal smudge with pale cross-hatching. `draw` 0..2 (sides, then arc), `hush` thins it for the dead beat.
 */
export class FanSketch {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(range: number, half: number) {
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uHalf: { value: half }, uR: { value: range }, uDraw: { value: 0 }, uHatch: { value: 0 }, uSweep: { value: 0 }, uSmudge: { value: 0 },
        uFade: { value: 1 }, uHush: { value: 0 }, uTime: { value: 0 }, uScr: { value: 0 },
        uPaper: { value: new THREE.Color('#ece7da') }, uGraph: { value: new THREE.Color('#6b6b72') }, uChar: { value: new THREE.Color('#0d0d10') },
      },
      vertexShader: FLAT_VERT,
      fragmentShader: /* glsl */ `
        varying vec2 vP; uniform float uHalf, uR, uDraw, uHatch, uSweep, uSmudge, uFade, uHush, uTime, uScr; uniform vec3 uPaper, uGraph, uChar;
        ${GLSL_HASH}
        ${GLSL_NOISE}
        void main() {
          vec2 p = vP;
          float r = length(p), ang = atan(p.x, p.y);
          float b = (ang + uHalf) / (2.0 * uHalf);
          float inFan = step(abs(ang), uHalf) * step(r, uR) * smoothstep(0.2, 0.5, r);
          float wob = (h1(floor(r * 4.0)) - 0.5) * 0.05 + 0.025 * sin(r * 7.0 + 1.0);
          float lw = mix(0.06, 0.022, uHush);
          // the outline: pale pencil with a dark line beside it
          float dSide = (uHalf - abs(ang)) * r;
          float sideOn = step(r, min(uDraw, 1.0) * uR) * step(abs(ang), uHalf + 0.1) * step(0.3, r);
          float side = smoothstep(lw, lw * 0.35, abs(dSide + wob)) * sideOn;
          float side2 = smoothstep(lw * 0.7, lw * 0.2, abs(dSide - 0.1 + wob * 1.7)) * sideOn * 0.55 * step(0.35, h1(floor(r * 5.0) + 9.0));
          float sideDark = smoothstep(lw * 1.6, lw * 0.5, abs(dSide + 0.1 + wob)) * sideOn * step(dSide + wob, 0.0);
          float dArc = uR - r;
          float arcOn = step(b, clamp(uDraw - 1.0, 0.0, 1.0)) * step(abs(ang), uHalf);
          float arc = smoothstep(lw, lw * 0.35, abs(dArc + wob)) * arcOn;
          float arcDark = smoothstep(lw * 1.6, lw * 0.5, abs(dArc - 0.1 + wob)) * arcOn * step(0.0, 0.1 - dArc);
          // the faint hatching of the danger zone (only where the beam has not been)
          float hv = (p.x + p.y) * 1.3;
          float hat = step(abs(fract(hv) - 0.5), 0.045) * step(0.3, h1(floor(hv) + floor(r * 1.5) * 7.0)) * inFan * step(uSweep, b) * uHatch * 0.16 * (1.0 - 0.6 * uHush);
          // the scribbled loops round the hand
          float a2 = atan(p.x, p.y) / 6.28318 + 0.5;
          float scr = 0.0;
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float rk = 0.55 + 0.2 * fk + 0.07 * sin(a2 * 18.8 + fk * 2.0) + 0.04 * (h1(floor(a2 * 40.0) + fk * 13.0) - 0.5);
            float on = step(a2, clamp(uScr * 3.0 - fk, 0.0, 1.0));
            scr = max(scr, smoothstep(lw * 1.1, lw * 0.3, abs(r - rk)) * on);
          }
          scr *= 0.9 * (1.0 - 0.5 * uHush);
          // the swept smudge: rubbed charcoal with pale cross-hatching
          float sw = smoothstep(uSweep, uSweep - 0.02, b) * inFan * step(0.0001, uSweep);
          float cell = floor(ang * 48.0);
          float n = n2(vec2(r * 0.9, ang * 6.0));
          float streak = smoothstep(0.45, 0.9, h1(cell * 1.7)) * (0.35 + 0.65 * n2(vec2(r * 2.0, cell)));
          float smud = clamp(0.4 * n + 0.2 * streak + 0.5, 0.0, 0.92) * sw * uSmudge;
          float h2 = (p.x * 0.9 + p.y) * 2.2 + 0.5 * n2(p * 0.8);
          float cross1 = step(abs(fract(h2) - 0.5), 0.05) * step(0.5, h1(floor(h2) + floor(r * 1.5))) * sw * uSmudge * 0.6;
          float h3 = (p.x * 0.9 - p.y) * 2.6;
          float cross2 = step(abs(fract(h3) - 0.5), 0.05) * step(0.55, h1(floor(h3) * 3.0 + floor(r * 2.0))) * smoothstep(0.55, 0.75, n) * sw * uSmudge * 0.5;
          vec3 smCol = mix(uGraph * (0.55 + 0.55 * n), uChar, clamp(streak * 0.95, 0.0, 1.0));
          vec3 col = smCol;
          float line = max(max(side, side2), arc);
          col = mix(col, uChar, max(sideDark, arcDark) * 0.9);
          col = mix(col, uPaper, clamp(max(max(line, scr), max(cross1 + cross2, hat * 3.0)), 0.0, 1.0));
          float a = max(max(max(smud, max(sideDark, arcDark) * 0.85), max(line * 0.95, scr)), max(cross1 + cross2, hat));
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uFade);
          ${TAIL}
        }`,
    }));
    this.mesh = new THREE.Mesh(apexPlane(2 * range * Math.sin(half) + 1.2, range + 0.4, 1.7), this.mat);
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  place(x: number, z: number, yaw: number) {
    this.mesh.position.set(x, 0.03, z);
    this.mesh.rotation.y = yaw;
  }

  set(time: number, draw: number, hatch: number, sweep: number, smudge: number, fade: number, hush: number, scribble: number) {
    this.mesh.visible = fade > 0.004;
    const u = this.mat.uniforms;
    u.uTime.value = time; u.uDraw.value = draw; u.uHatch.value = hatch; u.uSweep.value = sweep; u.uSmudge.value = smudge;
    u.uFade.value = fade; u.uHush.value = hush; u.uScr.value = scribble;
  }
}

/**
 * The beam: a ribbon of hatched charcoal strokes that runs from the hand out to the range and is turned by the look as it sweeps.
 * A broad ragged black stroke with pale hatch marks across it, a bright paper core, a jagged paper edge on the leading side and
 * a rubbed dust on the trailing side; the lines are redrawn twelve times a second so they boil like a hand-drawn animation.
 */
export class BeamStrokes {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(range: number) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uR: { value: range }, uLen: { value: 0 }, uTime: { value: 0 }, uA: { value: 1 },
        uPaper: { value: new THREE.Color('#f2eee2') }, uGraph: { value: new THREE.Color('#77777e') }, uChar: { value: new THREE.Color('#0b0b0d') },
      },
      vertexShader: FLAT_VERT,
      fragmentShader: /* glsl */ `
        varying vec2 vP; uniform float uR, uLen, uTime, uA; uniform vec3 uPaper, uGraph, uChar;
        ${GLSL_HASH}
        ${GLSL_NOISE}
        void main() {
          float x = vP.x, y = vP.y;
          float tick = floor(uTime * 12.0);
          float on = step(y, uLen) * step(0.3, y) * smoothstep(0.3, 0.9, y);
          float tip = smoothstep(uR, uR - 0.9 - 0.4 * h1(tick), y);
          float hw = 0.68 + 0.14 * n2(vec2(y * 1.3, tick * 0.7));
          float cx = x + 0.04 * sin(y * 3.0 + tick);
          float body = smoothstep(hw + 0.05, hw - 0.1, abs(cx)) * on * tip;
          float dry = step(0.08, h1(floor(y * 7.0) + floor((x + 1.0) * 5.0) * 31.0 + tick * 3.0));
          float hv = y * 2.6 + x * 2.0 + h1(tick) * 0.5 + 0.45 * n2(vec2(y * 0.9, x * 1.5 + tick));
          float hatch = step(abs(fract(hv) - 0.5), 0.085) * step(0.5, h1(floor(hv) * 3.0 + tick)) * body;
          float core = smoothstep(0.14 + 0.03 * h1(floor(y * 4.0) + tick), 0.02, abs(x - 0.12)) * on * tip * (0.55 + 0.45 * step(0.2, h1(floor(y * 9.0) + tick * 5.0)));
          float lead = smoothstep(0.1, 0.0, abs(x - hw + 0.04)) * step(0.2, h1(floor(y * 11.0) + tick * 2.0)) * on * tip;
          float dust = smoothstep(0.0, 0.5, -x - hw * 0.3) * (1.0 - smoothstep(hw, hw + 0.55, -x)) * n2(vec2(y * 2.5, x * 3.0 + tick)) * on * tip * 0.5;
          vec3 col = mix(uChar, uGraph, dust * 1.2);
          col = mix(col, uPaper, clamp(max(max(hatch * 0.85, core), lead), 0.0, 1.0));
          float a = max(max(body * dry * 0.95, dust), max(core, lead * 0.9));
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uA);
          ${TAIL}
        }`,
    });
    this.mesh = new THREE.Mesh(apexPlane(3.2, range + 0.3, 0), this.mat);
    this.mesh.renderOrder = 5;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** At (x, z), turned to `yaw`, `reach` m drawn (0..range), `alpha` 0..1. */
  set(x: number, z: number, yaw: number, reach: number, alpha: number, time: number) {
    this.mesh.visible = alpha > 0.004 && reach > 0.2;
    this.mesh.position.set(x, 0.08, z);
    this.mesh.rotation.y = yaw;
    const u = this.mat.uniforms;
    u.uLen.value = reach; u.uA.value = alpha; u.uTime.value = time;
  }
}

/** Blots where the beam struck someone: a ragged charcoal blot with spatter, crossed by pale scribbled strokes, and a pale ring at the hit. */
export class Blots {
  readonly mesh: THREE.InstancedMesh;
  private age: THREE.InstancedBufferAttribute;
  private seed: THREE.InstancedBufferAttribute;
  private t0: number[] = [];
  private mat: THREE.ShaderMaterial;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private e = new THREE.Euler();

  constructor(private max: number) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.age = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(9), 1);
    this.seed = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.age.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAge', this.age);
    geo.setAttribute('aSeed', this.seed);
    this.mat = onFloor(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uFade: { value: 1 }, uPaper: { value: new THREE.Color('#f2eee2') }, uChar: { value: new THREE.Color('#0b0b0d') }, uGraph: { value: new THREE.Color('#6b6b72') } },
      vertexShader: /* glsl */ `
        attribute float aAge; attribute float aSeed; varying vec2 vUv; varying float vAge; varying float vSeed;
        void main() { vUv = uv; vAge = aAge; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vAge; varying float vSeed; uniform float uFade; uniform vec3 uPaper, uChar, uGraph;
        ${GLSL_HASH}
        ${GLSL_NOISE}
        float eo(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - x, 3.0); }
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p), ang = atan(p.y, p.x);
          float grow = eo(vAge / 0.14);
          float rr = 0.58 * grow * (0.8 + 0.4 * n2(vec2(cos(ang), sin(ang)) * 2.5 + vSeed * 13.0));
          float body = smoothstep(rr, rr - 0.08, r);
          vec2 f = fract(p * 9.0) - 0.5;
          float sp = smoothstep(0.3, 0.1, length(f)) * step(0.88, h1(dot(floor(p * 9.0), vec2(1.0, 57.0)) + vSeed * 31.0)) * step(r, 0.92 * grow) * step(rr * 0.9, r);
          float g2 = eo((vAge - 0.05) / 0.18);
          float scrib = 0.0;
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float aa = 0.5 + fk * 1.05 + vSeed * 3.0;
            vec2 d = vec2(cos(aa), sin(aa)), nr = vec2(-d.y, d.x);
            float dist = abs(dot(p, nr) + 0.06 * sin(dot(p, d) * 7.0 + vSeed * 9.0 + fk));
            scrib = max(scrib, smoothstep(0.06, 0.02, dist) * step(abs(dot(p, d)), 0.74 * g2));
          }
          float ring = smoothstep(0.07, 0.0, abs(r - 0.95 * eo(vAge / 0.2))) * (1.0 - clamp(vAge / 0.2, 0.0, 1.0));
          float halo = smoothstep(rr + 0.3, rr, r) * 0.75 * step(0.01, grow);
          vec3 col = mix(uGraph * (0.6 + 0.5 * n2(p * 4.0 + vSeed * 7.0)), uChar, body);
          col = mix(col, uPaper, clamp(max(scrib, ring), 0.0, 1.0));
          float a = max(max(max(body * 0.96, halo), sp * 0.85), max(scrib * 0.92, ring * 0.85));
          gl_FragColor = vec4(col, a * uFade * step(0.0, vAge));
          ${TAIL}
        }`,
    }));
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
  }

  clear() {
    this.mesh.count = 0;
    this.t0.length = 0;
    this.mat.uniforms.uFade.value = 1;
  }

  /** A blot at (x, z), struck at time `t`, `size` m wide. */
  add(x: number, z: number, t: number, size: number) {
    const i = this.t0.length;
    if (i >= this.max) return;
    this.t0.push(t);
    this.e.set(0, hash(i * 5.3 + x) * 6.28, 0);
    this.q.setFromEuler(this.e);
    this.p.set(x, 0.06, z);
    this.s.setScalar(size);
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(i, this.m);
    this.seed.setX(i, hash(i * 7.7 + z));
    this.mesh.count = i + 1;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.seed.needsUpdate = true;
  }

  update(t: number, fade: number) {
    for (let i = 0; i < this.t0.length; i++) this.age.setX(i, t - this.t0[i]);
    this.age.needsUpdate = true;
    this.mat.uniforms.uFade.value = fade;
  }
}

/** A short stick of charcoal in his hand, pointing along the beam: black, with a paper-white band. */
export class CharcoalStick {
  readonly group = new THREE.Group();

  constructor() {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.5), new THREE.MeshBasicMaterial({ color: '#232326' }));
    body.position.z = 0.25;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.078, 0.07), new THREE.MeshBasicMaterial({ color: '#efe9dc' }));
    band.position.z = 0.08;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#efe9dc' }));
    tip.position.z = 0.52;
    this.group.add(body, band, tip);
    this.group.visible = false;
  }

  set(x: number, z: number, yaw: number, on: boolean) {
    this.group.visible = on;
    this.group.position.set(x + Math.sin(yaw) * 0.32, 1.0, z + Math.cos(yaw) * 0.32);
    this.group.rotation.y = yaw;
  }
}
