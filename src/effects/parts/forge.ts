import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The forge kit (pipeline/designs/kit-forge.md): molten slag that cools (white-orange, a black crust growing in from
 * the edges, orange cracks dimming to dull red), heavy smith's iron with hot edges, streak sparks, pale steam and ash
 * as the foil. Everything is pooled, takes world-space positions and has a `reset()`. All materials are custom toon
 * shaders with values below the bloom threshold (~0.85) except a few tiny core dots.
 */

/** Palette (`FORGE_CSS` for APIs that want a string). `ash` is the pale foil. */
export const FORGE = {
  core: 0xfff3d0,
  hot: 0xffb03a,
  body: 0xff5a12,
  accent: 0x6fe0ff,
  dark: 0x120a08,
  ash: 0xcfc6b8,
} as const;

export const FORGE_CSS = {
  core: '#fff3d0',
  hot: '#ffb03a',
  body: '#ff5a12',
  accent: '#6fe0ff',
  dark: '#120a08',
  ash: '#cfc6b8',
} as const;

const DULL = 0x6a1a08; // cracks at full cool
const UP = new THREE.Vector3(0, 1, 0);
const AX = new THREE.Vector3(1, 0, 0);
const MIN_SCALE = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

function forgeUniforms() {
  return {
    uBody: { value: new THREE.Color(FORGE.body) },
    uDark: { value: new THREE.Color(FORGE.dark) },
    uHot: { value: new THREE.Color(FORGE.hot) },
    uCore: { value: new THREE.Color(FORGE.core) },
    uAsh: { value: new THREE.Color(FORGE.ash) },
    uDull: { value: new THREE.Color(DULL) },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Slag shaders
// ---------------------------------------------------------------------------------------------------------------

/** Ground decal: lumpy molten pool with a voronoi crust that grows in from the edge as `cool` rises. */
function slagDecalMaterial(web: boolean) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: {
      ...forgeUniforms(), uCells: { value: 3 }, uWeb: { value: web ? 1 : 0 },
      uState: { value: new THREE.Vector4(0, 0, 0, 0) }, // spread, cool, seed, alpha
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uCore, uAsh, uDull; uniform float uCells, uWeb; uniform vec4 uState;
      varying vec2 vUv;
      vec2 h2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p), a = atan(p.y, p.x), sd = uState.z, cool = uState.y;
        float lump = 1.0 + 0.15 * sin(a * 3.0 + sd * 6.0) + 0.09 * sin(a * 5.0 + sd * 11.0) + 0.05 * sin(a * 9.0 + sd * 3.0);
        float R = (uWeb > 0.5 ? 0.9 * (1.0 + (lump - 1.0) * 0.4) : 0.74 * lump) * uState.x;
        float aa = max(fwidth(r), 1e-4);
        float alpha = uState.w * (1.0 - smoothstep(R - aa, R, r));
        if (alpha < 0.004) discard;
        float rn = r / max(R, 1e-4);
        // Voronoi plates and the crack line between them.
        vec2 q = p * uCells + vec2(sd * 7.0, sd * 3.0);
        vec2 g = floor(q), f = fract(q);
        float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 o = vec2(float(i), float(j));
          vec2 rr = o + h2(g + o) - f;
          float d = dot(rr, rr);
          if (d < d1) { d2 = d1; d1 = d; id = g + o; } else if (d < d2) { d2 = d; }
        }
        float e = sqrt(d2) - sqrt(d1);
        float crack = 1.0 - smoothstep(0.04, 0.13, e);
        float hc = h2(id).x;
        // The crust grows from the edge inward; per-plate noise makes it uneven.
        float crust = uWeb > 0.5 ? 1.0 : step(1.0 - cool * 1.2, hc * 0.45 + rn * 0.55);
        float glow = 1.0 - cool * 0.85;
        vec3 cc = mix(uDull, uBody, smoothstep(0.1, 0.6, glow));
        cc = mix(cc, uHot, smoothstep(0.65, 0.95, glow) * 0.85);
        float m = 1.0 - rn;
        vec3 mol = uBody;
        mol = mix(mol, uHot, step(0.42, m));
        mol = mix(mol, uCore * 0.92, step(0.82, m) * (1.0 - smoothstep(0.0, 0.5, cool)));
        vec3 plate = mix(uDark * 1.35, uAsh * 0.3, hc * 0.55);
        vec3 col = crust > 0.5 ? plate : mol;
        col = mix(col, cc, crack * crust);
        // Ash-grey cooled rim on the edge once it has crusted.
        float rim = smoothstep(0.86, 0.92, rn);
        col = mix(col, uAsh * 0.7, rim * smoothstep(0.1, 0.5, cool) * (uWeb > 0.5 ? 0.0 : 1.0));
        if (uWeb > 0.5) alpha *= mix(0.62, 1.0, crack);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
}

const blobVertex = /* glsl */ `
  attribute float aCool;
  varying vec3 vN; varying vec3 vView; varying float vCool;
  void main() {
    vec4 lp = instanceMatrix * vec4(position, 1.0);
    vec3 c0 = instanceMatrix[0].xyz, c1 = instanceMatrix[1].xyz, c2 = instanceMatrix[2].xyz;
    vec3 ln = c0 * (normal.x / max(dot(c0, c0), 1e-10)) + c1 * (normal.y / max(dot(c1, c1), 1e-10))
            + c2 * (normal.z / max(dot(c2, c2), 1e-10));
    vec4 mv = modelViewMatrix * lp;
    vec3 n = normalMatrix * ln;
    vN = n / max(length(n), 1e-6);
    vView = normalize(-mv.xyz);
    vCool = aCool;
    gl_Position = projectionMatrix * mv;
  }`;

/** Molten blob: white-orange, dark fresnel rim, one tiny core dot; crusts to dark with `aCool`. */
function slagBlobMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: forgeUniforms(),
    vertexShader: blobVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uCore, uAsh, uDull;
      varying vec3 vN; varying vec3 vView; varying float vCool;
      void main() {
        vec3 n = normalize(vN), v = normalize(vView);
        vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
        float ndl = dot(n, L);
        float f = 1.0 - abs(dot(n, v));
        vec3 col = uBody;
        col = mix(col, uHot, step(0.15, ndl));
        col = mix(col, uBody * 0.8, step(ndl, -0.3));
        float spec = dot(n, normalize(L + v));
        if (spec > 0.985 && f < 0.5) col = mix(col, uCore * 0.92, 1.0 - vCool);
        vec3 crust = mix(uDark * 1.3, uAsh * 0.3, step(0.25, ndl));
        col = mix(col, crust, smoothstep(0.15, 0.75, vCool));
        if (f > 0.72) col = mix(uDark, uDull, 1.0 - vCool);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// SlagPool
// ---------------------------------------------------------------------------------------------------------------

export interface SlagPoolOptions {
  /** Crack-web mode: no molten fill, dark translucent plates with glowing cracks across the whole disc. */
  web?: boolean;
  /** Approximate plate size in world units (default 0.9; web 1.3). */
  plate?: number;
}

/**
 * A ground decal of molten slag with a lumpy edge. `place(center)`, `spread(radius, seconds)` makes it flow out,
 * `cool(seconds, delay)` grows the black crust inward and dims the cracks to dull red, `fade(seconds, delay)` fades it
 * out. `update(dt)` every frame. Add `mesh` to the group. Web mode is the crack web of the ultimate.
 */
export class SlagPool {
  readonly mesh: THREE.Mesh;
  /** Height above the floor. */
  y = 0.04;
  private mat: THREE.ShaderMaterial;
  private web: boolean;
  private plate: number;
  private spreadDur = 0.4;
  private spreadAge = -1;
  private clock = 0;
  private coolFrom = -1;
  private coolDur = 1;
  private fadeFrom = -1;
  private fadeDur = 0.6;
  private seed = Math.random() * 6.28;

  constructor(opts: SlagPoolOptions = {}) {
    this.web = !!opts.web;
    this.plate = opts.plate ?? (this.web ? 1.3 : 0.9);
    this.mat = slagDecalMaterial(this.web);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = this.web ? 3 : 2;
    this.mesh.position.y = this.y;
  }

  place(center: THREE.Vector3) {
    this.mesh.position.set(center.x, this.y, center.z);
  }

  /** Flows out to `radius` (world units) over `seconds`; restarts the cool and fade clocks. */
  spread(radius: number, seconds = 0.4) {
    this.spreadDur = Math.max(seconds, 0.05);
    this.spreadAge = 0;
    this.clock = 0;
    this.coolFrom = -1;
    this.fadeFrom = -1;
    this.seed = Math.random() * 6.28;
    const half = radius / (this.web ? 0.9 : 0.74);
    this.mesh.scale.setScalar(Math.max(half, MIN_SCALE));
    this.mat.uniforms.uCells.value = Math.max(1.4, half / this.plate);
  }

  /** Crust grows over `seconds`, starting `delay` seconds from now. */
  cool(seconds = 1, delay = 0) {
    this.coolDur = Math.max(seconds, 0.05);
    this.coolFrom = this.clock + delay;
  }

  /** Fades out over `seconds`, starting `delay` seconds from now. */
  fade(seconds = 0.6, delay = 0) {
    this.fadeDur = Math.max(seconds, 0.05);
    this.fadeFrom = this.clock + delay;
  }

  /** Current cool amount 0..1. */
  get coolness() {
    return this.coolFrom < 0 ? 0 : clamp01((this.clock - this.coolFrom) / this.coolDur);
  }

  reset() {
    this.spreadAge = -1;
    this.coolFrom = -1;
    this.fadeFrom = -1;
    this.mesh.visible = false;
  }

  update(dt: number) {
    if (this.spreadAge < 0) { this.mesh.visible = false; return; }
    this.spreadAge += dt;
    this.clock += dt;
    const spread = easeOut(this.spreadAge / this.spreadDur);
    const alpha = this.fadeFrom < 0 ? 1 : 1 - clamp01((this.clock - this.fadeFrom) / this.fadeDur);
    this.mesh.visible = alpha > 0.004;
    (this.mat.uniforms.uState.value as THREE.Vector4).set(Math.max(spread, 0.01), this.coolness, this.seed, alpha);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SlagBlobs
// ---------------------------------------------------------------------------------------------------------------

interface Blob { live: boolean; pos: THREE.Vector3; prev: THREE.Vector3; vel: THREE.Vector3; size: number; age: number }

/**
 * Thrown molten blobs (instanced spheres stretched along their velocity). `throw(pos, vel, size)`; they fall with
 * gravity and, on landing, become a small `SlagPool` splat (cap ~10, oldest recycled) that cools and fades by itself.
 * `update(dt)` every frame. Add `mesh` (blobs and splats) to the group.
 */
export class SlagBlobs {
  readonly mesh = new THREE.Group();
  gravity = -16;
  groundY = 0;
  /** Splat lifetime: cools for `splatCool` s, fades over `splatFade` s after that. */
  splatCool = 0.9;
  splatFade = 0.4;
  private inst: THREE.InstancedMesh;
  private cool: THREE.InstancedBufferAttribute;
  private blobs: Blob[] = [];
  private splats: SlagPool[] = [];
  private cursor = 0;
  private sCursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private d = new THREE.Vector3();

  constructor(maxBlobs = 24, maxSplats = 10) {
    this.inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), slagBlobMaterial(), maxBlobs);
    this.cool = new THREE.InstancedBufferAttribute(new Float32Array(maxBlobs), 1);
    this.cool.setUsage(THREE.DynamicDrawUsage);
    this.inst.geometry.setAttribute('aCool', this.cool);
    this.inst.frustumCulled = false;
    this.inst.count = 0;
    this.mesh.add(this.inst);
    for (let i = 0; i < maxBlobs; i++) {
      this.blobs.push({ live: false, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), size: 0.2, age: 0 });
    }
    for (let i = 0; i < maxSplats; i++) {
      const p = new SlagPool({ plate: 0.45 });
      this.splats.push(p);
      this.mesh.add(p.mesh);
    }
  }

  /** One blob of radius `size` from `pos` with velocity `vel`. */
  throw(pos: THREE.Vector3, vel: THREE.Vector3, size = 0.22) {
    const b = this.blobs[this.cursor];
    this.cursor = (this.cursor + 1) % this.blobs.length;
    b.live = true; b.pos.copy(pos); b.prev.copy(pos); b.vel.copy(vel); b.size = size; b.age = 0;
  }

  reset() {
    for (const b of this.blobs) b.live = false;
    this.inst.count = 0;
    for (const p of this.splats) p.reset();
  }

  update(dt: number) {
    for (const p of this.splats) p.update(dt);
    let k = 0;
    for (const b of this.blobs) {
      if (!b.live) continue;
      b.age += dt;
      b.prev.copy(b.pos);
      b.vel.y += this.gravity * dt;
      b.pos.addScaledVector(b.vel, dt);
      if ((b.pos.y <= this.groundY + b.size * 0.4 && b.vel.y < 0) || b.age > 3) {
        b.live = false;
        const p = this.splats[this.sCursor];
        this.sCursor = (this.sCursor + 1) % this.splats.length;
        p.place(b.pos);
        p.spread(b.size * (2.4 + Math.random() * 1.2), 0.1);
        p.cool(this.splatCool, 0.15);
        p.fade(this.splatFade, 0.15 + this.splatCool);
        continue;
      }
      this.d.subVectors(b.pos, b.prev);
      const speed = this.d.length() / Math.max(dt, 1e-4);
      if (speed > 1e-3) this.q.setFromUnitVectors(UP, this.d.multiplyScalar(1 / (speed * Math.max(dt, 1e-4))));
      else this.q.identity();
      const stretch = 1 + Math.min(1.1, speed * 0.05);
      this.m.compose(b.pos, this.q, this.s.set(Math.max(b.size, MIN_SCALE), Math.max(b.size * stretch, MIN_SCALE), Math.max(b.size, MIN_SCALE)));
      this.inst.setMatrixAt(k, this.m);
      this.cool.setX(k, Math.min(0.55, b.age * 0.45));
      k++;
    }
    this.inst.count = k;
    this.inst.instanceMatrix.needsUpdate = true;
    this.cool.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SlagStreams
// ---------------------------------------------------------------------------------------------------------------

/** Molten rope: dark crust plates over glowing cracks, the leading end still molten. */
function ropeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...forgeUniforms(), uCool: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aLen;
      varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying float vL;
      void main() {
        vUv = uv; vL = aLen;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uCore, uAsh, uDull; uniform float uCool;
      varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying float vL;
      vec2 h2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }
      void main() {
        vec3 n = normalize(vN), v = normalize(vView);
        float ndl = dot(n, normalize(vec3(-0.45, 0.65, 0.6)));
        float f = 1.0 - abs(dot(n, v));
        vec2 q = vec2(vUv.x * 1.5, vUv.y * 3.0);
        vec2 g = floor(q), fr = fract(q);
        float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 o = vec2(float(i), float(j));
          vec2 rr = o + h2(g + o) - fr;
          float d = dot(rr, rr);
          if (d < d1) { d2 = d1; d1 = d; id = g + o; } else if (d < d2) { d2 = d; }
        }
        float crack = 1.0 - smoothstep(0.06, 0.18, sqrt(d2) - sqrt(d1));
        float hc = h2(id).x;
        vec3 plate = mix(uDark * 1.4, uAsh * 0.3, hc * 0.5);
        plate *= ndl > 0.3 ? 1.3 : 1.0;
        vec3 cc = mix(uBody, uHot, step(0.55, hc) * 0.7);
        cc = mix(cc, uDull, uCool * 0.8);
        vec3 col = mix(plate, cc, crack);
        float molten = smoothstep(0.8, 0.92, vL) * (1.0 - uCool);
        col = mix(col, mix(uBody, uHot, step(0.2, ndl)), molten);
        if (f > 0.8) col = uDark;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/**
 * Continuous molten ropes: a lumpy tube along a path you set per frame, dark crust plates over glowing cracks, the
 * leading end molten. `set(i, fn, head, tail, radius, cool, time)` draws stream i along fn(u, out) (u 0..1) between
 * `tail` and `head`; `hide(i)` hides it. Add `mesh` (a group) to the effect's group.
 */
export class SlagStreams {
  readonly mesh = new THREE.Group();
  private tubes: {
    mesh: THREE.Mesh; mat: THREE.ShaderMaterial; pos: Float32Array; nrm: Float32Array; uv: Float32Array; len: Float32Array;
    geo: THREE.BufferGeometry;
  }[] = [];
  private segs: number;
  private sides: number;
  private c: THREE.Vector3[] = [];
  private T: THREE.Vector3[] = [];
  private L: Float32Array;
  private N = new THREE.Vector3();
  private B = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private qq = new THREE.Quaternion();

  constructor(streams = 6, segments = 28, sides = 7) {
    this.segs = segments;
    this.sides = sides;
    const rings = segments + 1;
    this.L = new Float32Array(rings);
    for (let i = 0; i < rings; i++) { this.c.push(new THREE.Vector3()); this.T.push(new THREE.Vector3()); }
    const index: number[] = [];
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = a + sides, d = b + sides;
        index.push(a, c, b, b, c, d);
      }
    }
    for (let s = 0; s < streams; s++) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(rings * sides * 3), nrm = new Float32Array(rings * sides * 3);
      const uv = new Float32Array(rings * sides * 2), len = new Float32Array(rings * sides);
      geo.setIndex(index);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aLen', new THREE.BufferAttribute(len, 1).setUsage(THREE.DynamicDrawUsage));
      const mat = ropeMaterial();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.mesh.add(mesh);
      this.tubes.push({ mesh, mat, pos, nrm, uv, len, geo });
    }
  }

  hide(i: number) {
    if (this.tubes[i]) this.tubes[i].mesh.visible = false;
  }

  set(i: number, fn: (u: number, out: THREE.Vector3) => THREE.Vector3, head: number, tail: number, radius: number, cool: number, time = 0) {
    const tb = this.tubes[i];
    if (!tb) return;
    if (head - tail < 1e-3) { tb.mesh.visible = false; return; }
    tb.mesh.visible = true;
    tb.mat.uniforms.uCool.value = cool;
    const S = this.segs, sides = this.sides;
    for (let k = 0; k <= S; k++) fn(tail + (head - tail) * (k / S), this.c[k]);
    this.L[0] = 0;
    for (let k = 1; k <= S; k++) this.L[k] = this.L[k - 1] + this.c[k].distanceTo(this.c[k - 1]);
    const total = Math.max(this.L[S], 1e-4);
    for (let k = 0; k <= S; k++) {
      this.T[k].subVectors(this.c[Math.min(S, k + 1)], this.c[Math.max(0, k - 1)]);
      if (this.T[k].lengthSq() < 1e-12) this.T[k].set(0, 1, 0);
      this.T[k].normalize();
    }
    const t0 = this.T[0];
    this.tmp.set(Math.abs(t0.x) < 0.8 ? 1 : 0, 0, Math.abs(t0.x) < 0.8 ? 0 : 1);
    this.N.crossVectors(t0, this.tmp).normalize();
    for (let k = 0; k <= S; k++) {
      if (k > 0) { this.qq.setFromUnitVectors(this.T[k - 1], this.T[k]); this.N.applyQuaternion(this.qq).normalize(); }
      this.B.crossVectors(this.T[k], this.N);
      let r = radius * (0.88 + 0.2 * Math.sin(k * 0.8 + i * 1.3 + time * 6));
      r *= Math.sqrt(clamp01(this.L[k] / radius)) * Math.sqrt(clamp01((total - this.L[k]) / (radius * 0.8)));
      r = Math.max(r, 1e-3);
      for (let j = 0; j < sides; j++) {
        const ang = (j / sides) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const rx = this.N.x * ca + this.B.x * sa, ry = this.N.y * ca + this.B.y * sa, rz = this.N.z * ca + this.B.z * sa;
        const o = (k * sides + j) * 3, vi = k * sides + j;
        tb.pos[o] = this.c[k].x + rx * r; tb.pos[o + 1] = this.c[k].y + ry * r; tb.pos[o + 2] = this.c[k].z + rz * r;
        tb.nrm[o] = rx; tb.nrm[o + 1] = ry; tb.nrm[o + 2] = rz;
        tb.uv[vi * 2] = this.L[k]; tb.uv[vi * 2 + 1] = j / sides;
        tb.len[vi] = this.L[k] / total;
      }
    }
    for (const n of ['position', 'normal', 'uv', 'aLen']) tb.geo.attributes[n].needsUpdate = true;
  }

  reset() {
    for (const t of this.tubes) t.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Sparks
// ---------------------------------------------------------------------------------------------------------------

interface Spark { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; w: number }

/**
 * Short streak sparks (instanced thin bars stretched along the velocity), gravity, life ~0.4 s. `burst(pos, dir,
 * count, speed, spread)` throws a cone of them. Colour runs core -> hot -> body with age. Add `mesh` to the group.
 */
export class Sparks {
  readonly mesh: THREE.InstancedMesh;
  gravity = -16;
  /** Seconds of life (each spark gets 0.75..1.25 of it). */
  life = 0.45;
  private sparks: Spark[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  private cCore = new THREE.Color(FORGE.core);
  private cHot = new THREE.Color(FORGE.hot);
  private cBody = new THREE.Color(FORGE.body);
  private d = new THREE.Vector3();

  constructor(max = 160) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.sparks.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.4, w: 0.07 });
  }

  /** A cone of `count` sparks from `pos` around `dir` within `spread` radians at about `speed`. */
  burst(pos: THREE.Vector3, dir: THREE.Vector3, count: number, speed = 8, spread = 0.6) {
    const axis = this.d.copy(dir).normalize();
    const u = new THREE.Vector3(Math.abs(axis.y) < 0.9 ? 0 : 1, Math.abs(axis.y) < 0.9 ? 1 : 0, 0).cross(axis).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u);
    for (let i = 0; i < count; i++) {
      const sp = this.sparks[this.cursor];
      this.cursor = (this.cursor + 1) % this.sparks.length;
      const a = Math.random() * Math.PI * 2, c = Math.sqrt(Math.random()) * spread;
      sp.vel.copy(axis).multiplyScalar(Math.cos(c)).addScaledVector(u, Math.sin(c) * Math.cos(a)).addScaledVector(v, Math.sin(c) * Math.sin(a))
        .multiplyScalar(speed * (0.55 + Math.random() * 0.8));
      sp.pos.copy(pos);
      sp.age = 0;
      sp.life = this.life * (0.75 + Math.random() * 0.5);
      sp.w = 0.06 + Math.random() * 0.04;
      sp.live = true;
    }
  }

  reset() {
    for (const sp of this.sparks) sp.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const sp of this.sparks) {
      if (!sp.live) continue;
      sp.age += dt;
      if (sp.age >= sp.life || sp.pos.y < 0.02) { sp.live = false; continue; }
      sp.vel.y += this.gravity * dt;
      sp.pos.addScaledVector(sp.vel, dt);
      const speed = sp.vel.length();
      const u = sp.age / sp.life;
      this.q.setFromUnitVectors(AX, this.d.copy(sp.vel).multiplyScalar(1 / Math.max(speed, 1e-4)));
      const shrink = 1 - Math.pow(clamp01((u - 0.6) / 0.4), 2);
      const len = Math.min(0.9, Math.max(0.22, speed * 0.04)) * shrink;
      this.m.compose(sp.pos, this.q, this.s.set(Math.max(len, MIN_SCALE), Math.max(sp.w * shrink, MIN_SCALE), Math.max(sp.w * shrink, MIN_SCALE)));
      this.mesh.setMatrixAt(k, this.m);
      if (u < 0.25) this.c.copy(this.cCore); else if (u < 0.6) this.c.copy(this.cHot); else this.c.copy(this.cBody);
      this.mesh.setColorAt(k, this.c);
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Iron
// ---------------------------------------------------------------------------------------------------------------

/** Iron: three flat tones, ash-grey cooled rim on the lit silhouette, forged edge lines that glow with the heat. */
function ironMaterial(heat = 0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...forgeUniforms(), uHeat: { value: heat },
      uShade: { value: new THREE.Color(0x1f1b19) }, uIron: { value: new THREE.Color(0x38322e) }, uLit: { value: new THREE.Color(0x5a524b) },
    },
    vertexShader: /* glsl */ `
      uniform float uHeat;
      attribute vec3 aBary;
      #ifdef USE_INSTANCING
        attribute float aHeat;
      #endif
      varying vec3 vN; varying vec3 vView; varying vec3 vBary; varying float vHeat;
      void main() {
        #ifdef USE_INSTANCING
          vec4 lp = instanceMatrix * vec4(position, 1.0);
          vec3 c0 = instanceMatrix[0].xyz, c1 = instanceMatrix[1].xyz, c2 = instanceMatrix[2].xyz;
          vec3 ln = c0 * (normal.x / max(dot(c0, c0), 1e-10)) + c1 * (normal.y / max(dot(c1, c1), 1e-10))
                  + c2 * (normal.z / max(dot(c2, c2), 1e-10));
          vHeat = aHeat;
        #else
          vec4 lp = vec4(position, 1.0);
          vec3 ln = normal;
          vHeat = uHeat;
        #endif
        vec4 mv = modelViewMatrix * lp;
        vec3 n = normalMatrix * ln;
        vN = n / max(length(n), 1e-6);
        vView = normalize(-mv.xyz);
        vBary = aBary;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uCore, uAsh, uShade, uIron, uLit;
      varying vec3 vN; varying vec3 vView; varying vec3 vBary; varying float vHeat;
      void main() {
        vec3 n = normalize(vN), v = normalize(vView);
        vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
        float ndl = dot(n, L);
        float f = 1.0 - abs(dot(n, v));
        vec3 col = ndl > 0.45 ? uLit : (ndl > -0.1 ? uIron : uShade);
        if (f > 0.7 && ndl > -0.2) col = mix(col, uAsh * 0.78, 0.85);          // cooled-iron rim: the pale foil
        float eh = sqrt(clamp(vHeat, 0.0, 1.0));                                // edges keep their heat longest
        float body = vHeat * vHeat;
        vec3 glowCol = mix(uBody, uHot, step(0.4, ndl) * 0.8 + 0.2 * body);
        col = mix(col, glowCol, body * 0.85);
        float e = min(vBary.x, min(vBary.y, vBary.z));
        float w = max(fwidth(e), 1e-4);
        float edge = 1.0 - smoothstep(w * 1.4, w * 2.5, e);
        vec3 edgeCol = mix(uAsh * 0.82, mix(uBody, uHot, step(0.7, eh)), smoothstep(0.05, 0.35, eh));
        col = mix(col, edgeCol, edge * (0.55 + 0.45 * eh));
        if (vHeat > 0.92) col = mix(col, uCore * 0.92, edge * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Non-indexed box with barycentrics whose diagonal is masked, so only the real edges draw. */
function barBox(w: number, h: number, d: number, x = 0, y = 0, z = 0, taper?: { axis: 'x' | 'y' | 'z'; k: number }) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (taper) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const hi = taper.axis === 'x' ? p.getX(i) > 0 : taper.axis === 'y' ? p.getY(i) > 0 : p.getZ(i) > 0;
      if (!hi) continue;
      if (taper.axis !== 'x') p.setX(i, p.getX(i) * taper.k);
      if (taper.axis !== 'y') p.setY(i, p.getY(i) * taper.k);
      if (taper.axis !== 'z') p.setZ(i, p.getZ(i) * taper.k);
    }
  }
  const ng = g.toNonIndexed();
  ng.deleteAttribute('uv');
  ng.computeVertexNormals();
  const n = ng.attributes.position.count;
  const bary = new Float32Array(n * 3);
  for (let t = 0; t < n / 3; t++) {
    const mask = t % 2 === 0 ? 0 : 1; // BoxGeometry faces: (a,b,d) then (b,c,d); the diagonal is opposite a, then c
    for (let i = 0; i < 3; i++) {
      const w3 = [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0];
      w3[mask] = 1;
      bary.set(w3, (t * 3 + i) * 3);
    }
  }
  ng.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
  ng.translate(x, y, z);
  return ng;
}

/** Smooth indexed geometry without drawn edge lines (cylinders, links). */
function smoothGeo(g: THREE.BufferGeometry) {
  g.deleteAttribute('uv');
  g.setAttribute('aBary', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}

let hammerGeo: THREE.BufferGeometry | null = null;
let anvilGeo: THREE.BufferGeometry | null = null;
let rivetGeo: THREE.BufferGeometry | null = null;
let linkGeo: THREE.BufferGeometry | null = null;
let chunkGeo: THREE.BufferGeometry | null = null;

/** Head underside centred on the origin, long axis X (1.3), handle up +Y to 2.3. */
function getHammerGeo() {
  return (hammerGeo ??= mergeGeometries([
    barBox(1.3, 0.6, 0.6, 0, 0.3, 0),
    barBox(0.16, 0.7, 0.7, -0.58, 0.3, 0),
    barBox(0.16, 0.7, 0.7, 0.58, 0.3, 0),
    barBox(0.17, 1.7, 0.17, 0, 1.45, 0),
    barBox(0.26, 0.2, 0.26, 0, 2.3, 0),
  ])!);
}

/** Base on y = 0, face up at y = 0.93, horn toward +X (x up to 1.0), heel toward -X. */
function getAnvilGeo() {
  return (anvilGeo ??= mergeGeometries([
    barBox(0.95, 0.22, 0.58, 0, 0.11, 0),
    barBox(0.52, 0.5, 0.36, 0, 0.47, 0, { axis: 'y', k: 0.9 }),
    barBox(1.1, 0.26, 0.52, 0, 0.8, 0),
    barBox(0.5, 0.2, 0.5, 0.8, 0.83, 0, { axis: 'x', k: 0.35 }),
    barBox(0.22, 0.17, 0.4, -0.66, 0.845, 0),
  ])!);
}

/** Axis +Y, point at the top (y 0.75), flat head at the bottom (y -0.6). */
function getRivetGeo() {
  const head = smoothGeo(new THREE.CylinderGeometry(0.5, 0.46, 0.2, 8).translate(0, -0.5, 0));
  const shaft = smoothGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.95, 8).translate(0, 0.0, 0));
  const tip = smoothGeo(new THREE.CylinderGeometry(0.03, 0.22, 0.28, 8).translate(0, 0.61, 0));
  return (rivetGeo ??= mergeGeometries([head, shaft, tip])!);
}

/** An oval chain link, long axis X (0.7 long, 0.4 wide, tube 0.18 thick). */
function getLinkGeo() {
  return (linkGeo ??= smoothGeo(new THREE.TorusGeometry(0.2, 0.09, 6, 12).scale(1.45, 1, 1)));
}

function getChunkGeo() {
  return (chunkGeo ??= barBox(1, 1, 1));
}

export type IronMesh = THREE.Mesh;

/**
 * Builders for the heavy objects. Each returns a fresh mesh (own material, so own heat). Dark iron, ash-grey rim,
 * forged edge lines that glow with the heat (0 cold .. 1 white-orange); `ForgeIron.heat(mesh, h)` sets it.
 * hammer: head underside centred on the origin, head along X (1.3 * scale), handle up. anvil: base on y = 0, horn
 * toward +X, ~1.75 * scale long. rivet: tip toward +Y, head at the back, ~1.35 * scale long. chainLink: long axis X.
 */
export const ForgeIron = {
  hammer(scale = 1): IronMesh { return ForgeIron.make(getHammerGeo(), scale); },
  anvil(scale = 1): IronMesh { return ForgeIron.make(getAnvilGeo(), scale); },
  rivet(scale = 1): IronMesh { return ForgeIron.make(getRivetGeo(), scale); },
  chainLink(): IronMesh { return ForgeIron.make(getLinkGeo(), 1); },
  make(geo: THREE.BufferGeometry, scale: number): IronMesh {
    const m = new THREE.Mesh(geo, ironMaterial());
    m.scale.setScalar(Math.max(scale, MIN_SCALE));
    m.frustumCulled = false;
    return m;
  },
  heat(mesh: IronMesh, h: number) {
    (mesh.material as THREE.ShaderMaterial).uniforms.uHeat.value = clamp01(h);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// IronChunks
// ---------------------------------------------------------------------------------------------------------------

interface Chunk {
  live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; axis: THREE.Vector3; angle: number; spin: number;
  size: THREE.Vector3; age: number; life: number; heat: number; cool: number;
}

/**
 * Broken iron: instanced dark chunks that burst out, bounce, rest, cool from `heat` to black and sink into the floor
 * in the last third of their life. `burst(center, count, speed, size, heat, life)`; `update(dt)` each frame.
 */
export class IronChunks {
  readonly mesh: THREE.InstancedMesh;
  gravity = -18;
  private heatAttr: THREE.InstancedBufferAttribute;
  private chunks: Chunk[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(max = 80) {
    const geo = getChunkGeo().clone();
    this.heatAttr = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.heatAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aHeat', this.heatAttr);
    this.mesh = new THREE.InstancedMesh(geo, ironMaterial(), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.chunks.push({
        live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), angle: 0, spin: 0,
        size: new THREE.Vector3(0.3, 0.3, 0.3), age: 0, life: 1, heat: 0, cool: 1,
      });
    }
  }

  burst(center: THREE.Vector3, count: number, speed = 5, size = 0.35, heat = 0.7, life = 1.2, spreadXZ = 0.5) {
    for (let i = 0; i < count; i++) {
      const c = this.chunks[this.cursor];
      this.cursor = (this.cursor + 1) % this.chunks.length;
      c.live = true;
      c.pos.copy(center);
      c.pos.x += (Math.random() - 0.5) * spreadXZ * 2;
      c.pos.z += (Math.random() - 0.5) * spreadXZ * 2;
      c.vel.set(Math.random() - 0.5, 0.3 + Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
      c.axis.randomDirection();
      c.angle = Math.random() * 6;
      c.spin = (Math.random() - 0.5) * 12;
      const k = size * (0.6 + Math.random() * 0.8);
      c.size.set(k * (0.8 + Math.random() * 0.8), k * (0.6 + Math.random() * 0.6), k * (0.8 + Math.random() * 0.6));
      c.age = 0;
      c.life = life * (0.85 + Math.random() * 0.3);
      c.heat = heat;
      c.cool = Math.max(0.3, life * 0.6);
    }
  }

  reset() {
    for (const c of this.chunks) c.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const c of this.chunks) {
      if (!c.live) continue;
      c.age += dt;
      if (c.age >= c.life) { c.live = false; continue; }
      const half = c.size.y * 0.5;
      c.vel.y += this.gravity * dt;
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y < half) {
        c.pos.y = half;
        if (c.vel.y < -1.5) c.vel.y *= -0.3; else c.vel.y = 0;
        c.vel.x *= 0.6; c.vel.z *= 0.6; c.spin *= 0.5;
      }
      c.angle += c.spin * dt;
      this.q.setFromAxisAngle(c.axis, c.angle);
      const u = c.age / c.life;
      const sink = clamp01((u - 0.62) / 0.38);
      const y = c.pos.y - sink * c.size.y * 1.4;
      this.m.compose(
        this.p.set(c.pos.x, y, c.pos.z), this.q,
        this.s.set(Math.max(c.size.x, MIN_SCALE), Math.max(c.size.y, MIN_SCALE), Math.max(c.size.z, MIN_SCALE)),
      );
      this.mesh.setMatrixAt(k, this.m);
      this.heatAttr.setX(k, c.heat * (1 - clamp01(c.age / c.cool)));
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.heatAttr.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// ChainRing
// ---------------------------------------------------------------------------------------------------------------

/** Chain link: slag look. Dark crust plates over cracks that glow with the per-instance heat, a few plates molten when hot. */
function chainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: forgeUniforms(),
    vertexShader: /* glsl */ `
      attribute float aHeat;
      varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying float vHeat; varying float vSeed;
      void main() {
        vec4 lp = instanceMatrix * vec4(position, 1.0);
        vec3 c0 = instanceMatrix[0].xyz, c1 = instanceMatrix[1].xyz, c2 = instanceMatrix[2].xyz;
        vec3 ln = c0 * (normal.x / max(dot(c0, c0), 1e-10)) + c1 * (normal.y / max(dot(c1, c1), 1e-10))
                + c2 * (normal.z / max(dot(c2, c2), 1e-10));
        vec4 mv = modelViewMatrix * lp;
        vec3 n = normalMatrix * ln;
        vN = n / max(length(n), 1e-6);
        vView = normalize(-mv.xyz);
        vUv = uv; vHeat = aHeat;
        vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9, 78.2))) * 43758.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uCore, uAsh, uDull;
      varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying float vHeat; varying float vSeed;
      vec2 h2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }
      void main() {
        vec3 n = normalize(vN), v = normalize(vView);
        float ndl = dot(n, normalize(vec3(-0.45, 0.65, 0.6)));
        float f = 1.0 - abs(dot(n, v));
        vec2 q = vec2(vUv.x * 6.0 + vSeed * 9.0, vUv.y * 2.4);
        vec2 g = floor(q), fr = fract(q);
        float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 o = vec2(float(i), float(j));
          vec2 rr = o + h2(g + o) - fr;
          float d = dot(rr, rr);
          if (d < d1) { d2 = d1; d1 = d; id = g + o; } else if (d < d2) { d2 = d; }
        }
        float crack = 1.0 - smoothstep(0.07, 0.2, sqrt(d2) - sqrt(d1));
        float hc = h2(id).x;
        float heat = clamp(vHeat, 0.0, 1.0);
        vec3 plate = mix(uDark * 1.4, uAsh * 0.3, hc * 0.45);
        plate *= ndl > 0.3 ? 1.35 : (ndl > -0.1 ? 1.0 : 0.8);
        vec3 cc = mix(uDull, uBody, smoothstep(0.1, 0.55, heat));
        cc = mix(cc, uHot, smoothstep(0.7, 1.0, heat) * 0.85);
        vec3 col = mix(plate, cc, crack);
        // At the pulses a few plates melt through.
        float molten = step(hc, (heat - 0.7) * 2.5);
        col = mix(col, mix(uBody, uHot, step(0.2, ndl)), molten);
        if (f > 0.74) col = mix(uAsh * 0.7, uDark, step(0.88, f));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/**
 * One loop of heavy chain links around a vertical axis (instanced, alternating link planes). `place(center, radius,
 * y, spin, heat, wobble)` lays every link out for this frame (call it every frame); `wobble` adds a vertical sway.
 * Link size follows the radius so the links always overlap. Add `mesh` to the group.
 */
export class ChainRing {
  readonly mesh: THREE.InstancedMesh;
  private n: number;
  private heatAttr: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private qr = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private tan = new THREE.Vector3();
  private rad = new THREE.Vector3();
  private z = new THREE.Vector3();

  constructor(count = 16) {
    this.n = count;
    const geo = new THREE.TorusGeometry(0.2, 0.09, 6, 12).scale(1.45, 1, 1);
    this.heatAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    this.heatAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aHeat', this.heatAttr);
    this.mesh = new THREE.InstancedMesh(geo, chainMaterial(), count);
    this.mesh.frustumCulled = false;
  }

  /** World position of link i for the last `place` is not stored; use `linkPos` for spark spawns. */
  linkPos(i: number, center: THREE.Vector3, radius: number, y: number, spin: number, out: THREE.Vector3) {
    const a = spin + (i / this.n) * Math.PI * 2;
    return out.set(center.x + Math.cos(a) * radius, y, center.z + Math.sin(a) * radius);
  }

  place(center: THREE.Vector3, radius: number, y: number, spin: number, heat: number, wobble = 0) {
    const spacing = (Math.PI * 2 * radius) / this.n;
    const ls = Math.max(0.2, spacing / 0.62);
    for (let i = 0; i < this.n; i++) {
      const a = spin + (i / this.n) * Math.PI * 2;
      this.rad.set(Math.cos(a), 0, Math.sin(a));
      this.tan.set(-Math.sin(a), 0, Math.cos(a));
      this.z.crossVectors(this.tan, UP);
      this.m.makeBasis(this.tan, UP, this.z);
      this.q.setFromRotationMatrix(this.m);
      if (i % 2 === 1) this.q.multiply(this.qr.setFromAxisAngle(AX, Math.PI / 2));
      this.p.set(center.x + this.rad.x * radius, y + Math.sin(a * 2 + spin) * wobble, center.z + this.rad.z * radius);
      this.m.compose(this.p, this.q, this.s.setScalar(ls));
      this.mesh.setMatrixAt(i, this.m);
      this.heatAttr.setX(i, heat);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.heatAttr.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// QuenchSteam and AshFlakes (the pale foil)
// ---------------------------------------------------------------------------------------------------------------

interface Puff { live: boolean; pos: THREE.Vector3; size: number; age: number; life: number; accent: number; seed: number }

/**
 * Small toon steam wisps (camera-facing, ash foil colour, a hint of the cold accent when `accent` is set): a lumpy
 * two-tone puff whose edge erodes into holes as it rises and thins. `puff(pos, size, accent)`; keep `life` short so
 * they are gone by the end of the spell. Add `mesh` to the group.
 */
export class QuenchSteam {
  readonly mesh: THREE.InstancedMesh;
  life = 0.6;
  private puffs: Puff[] = [];
  private cursor = 0;
  private aAlpha: THREE.InstancedBufferAttribute;
  private aTint: THREE.InstancedBufferAttribute;
  private aAge: THREE.InstancedBufferAttribute;
  private aSeed: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(max = 24) {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aTint = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aAge = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aSeed = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aTint', this.aTint);
    geo.setAttribute('aAge', this.aAge);
    geo.setAttribute('aSeed', this.aSeed);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uAsh: { value: new THREE.Color(FORGE.ash) }, uAccent: { value: new THREE.Color(FORGE.accent) } },
      vertexShader: /* glsl */ `
        attribute float aAlpha; attribute float aTint; attribute float aAge; attribute float aSeed;
        varying vec2 vP; varying float vA; varying float vT; varying float vAge; varying float vSeed;
        void main() {
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sc = length(instanceMatrix[0].xyz);
          c.xy += position.xy * sc;
          vP = position.xy; vA = aAlpha; vT = aTint; vAge = aAge; vSeed = aSeed;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uAsh, uAccent;
        varying vec2 vP; varying float vA; varying float vT; varying float vAge; varying float vSeed;
        void main() {
          float r = length(vP), a = atan(vP.y, vP.x);
          float wob = 1.0 + 0.22 * sin(a * 3.0 + vSeed) + 0.12 * sin(a * 5.0 + vSeed * 2.3);
          float R = 0.72 * wob * (1.0 - 0.25 * vAge);
          float edge = 1.0 - smoothstep(R - 0.05, R, r);
          // Holes eat the puff as it ages: it thins instead of fading as a ball.
          float n = 0.5 + 0.5 * sin(vP.x * 6.0 + vSeed * 3.0) * sin(vP.y * 5.0 - vSeed * 1.7 + vAge * 2.0);
          float hole = step(vAge * 0.85 - 0.1, n);
          float o = edge * hole * vA;
          if (o < 0.02) discard;
          vec3 col = r < R * 0.5 ? uAsh * 0.97 : uAsh * 0.74;
          col = mix(col, uAccent * 0.9, vT * 0.55);
          gl_FragColor = vec4(col, o * 0.85);
        }`,
    }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.puffs.push({ live: false, pos: new THREE.Vector3(), size: 0.4, age: 0, life: 0.6, accent: 0, seed: 0 });
  }

  puff(pos: THREE.Vector3, size = 0.5, accent = false) {
    const p = this.puffs[this.cursor];
    this.cursor = (this.cursor + 1) % this.puffs.length;
    p.live = true; p.pos.copy(pos); p.size = size * 0.6; p.age = 0; p.life = this.life * (0.85 + Math.random() * 0.3);
    p.accent = accent ? 1 : 0; p.seed = Math.random() * 6.28;
  }

  reset() {
    for (const p of this.puffs) p.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const pf of this.puffs) {
      if (!pf.live) continue;
      pf.age += dt;
      if (pf.age >= pf.life) { pf.live = false; continue; }
      const u = pf.age / pf.life;
      this.p.set(pf.pos.x + Math.sin(pf.age * 3 + pf.seed) * 0.1 * u, pf.pos.y + pf.age * 1.3, pf.pos.z);
      this.m.compose(this.p, this.q, this.s.setScalar(Math.max(pf.size * (0.7 + 0.6 * easeOut(u)), MIN_SCALE)));
      this.mesh.setMatrixAt(k, this.m);
      this.aAlpha.setX(k, Math.min(1, u * 8) * (1 - Math.pow(u, 3)));
      this.aTint.setX(k, pf.accent * (1 - clamp01(u * 3)));
      this.aAge.setX(k, u);
      this.aSeed.setX(k, pf.seed);
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aTint.needsUpdate = true;
    this.aAge.needsUpdate = true;
    this.aSeed.needsUpdate = true;
  }
}

interface Flake { live: boolean; pos: THREE.Vector3; vy: number; ph: number; age: number; life: number; size: number; angle: number }

/** Falling ash: small dull-grey flakes drifting down. `fall(center, radius, count, height, life)`. */
export class AshFlakes {
  readonly mesh: THREE.InstancedMesh;
  private flakes: Flake[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(max = 80) {
    const tet = new THREE.TetrahedronGeometry(0.5);
    this.mesh = new THREE.InstancedMesh(tet, new THREE.MeshBasicMaterial(), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.flakes.push({ live: false, pos: new THREE.Vector3(), vy: -2, ph: 0, age: 0, life: 1, size: 0.1, angle: 0 });
  }

  fall(center: THREE.Vector3, radius: number, count: number, height = 6, life = 1.6) {
    for (let i = 0; i < count; i++) {
      const f = this.flakes[this.cursor];
      this.cursor = (this.cursor + 1) % this.flakes.length;
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      f.live = true;
      f.pos.set(center.x + Math.cos(a) * r, center.y + height * (0.5 + Math.random() * 0.5), center.z + Math.sin(a) * r);
      f.vy = -(2.2 + Math.random() * 2);
      f.ph = Math.random() * 6.28;
      f.age = 0;
      f.life = life * (0.8 + Math.random() * 0.4);
      f.size = 0.1 + Math.random() * 0.12;
    }
  }

  reset() {
    for (const f of this.flakes) f.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const f of this.flakes) {
      if (!f.live) continue;
      f.age += dt;
      if (f.age >= f.life || f.pos.y < 0.05) { f.live = false; continue; }
      f.pos.y += f.vy * dt;
      f.pos.x += Math.sin(f.age * 2.5 + f.ph) * 0.5 * dt;
      f.angle += dt * 3;
      const u = f.age / f.life;
      const fade = 1 - Math.pow(clamp01((u - 0.7) / 0.3), 2);
      this.q.setFromAxisAngle(UP, f.angle);
      this.m.compose(f.pos, this.q, this.s.setScalar(Math.max(f.size * fade, MIN_SCALE)));
      this.mesh.setMatrixAt(k, this.m);
      this.mesh.setColorAt(k, this.c.setHex(FORGE.ash).multiplyScalar(0.55 + 0.25 * Math.sin(f.ph)));
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// HotStreak
// ---------------------------------------------------------------------------------------------------------------

/**
 * A short fat comet trail (cone, wide at the head): `set(head, tail, width, alpha)`. Core-white at the head through
 * hot to body-orange, fading to nothing at the tail. Add `mesh` to the group.
 */
export class HotStreak {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private q = new THREE.Quaternion();
  private d = new THREE.Vector3();

  constructor() {
    // Cone along +Y from y = -0.5 (tail, thin) to y = 0.5 (head, wide).
    const g = new THREE.CylinderGeometry(0.5, 0.08, 1, 8, 1, true);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uBody: { value: new THREE.Color(FORGE.body) }, uHot: { value: new THREE.Color(FORGE.hot) },
        uCore: { value: new THREE.Color(FORGE.core) }, uAlpha: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying float vU;
        void main() { vU = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uHot, uCore; uniform float uAlpha; varying float vU;
        void main() {
          vec3 col = uBody;
          col = mix(col, uHot, step(0.35, vU));
          col = mix(col, uCore * 0.92, step(0.88, vU));
          gl_FragColor = vec4(col, uAlpha * smoothstep(0.0, 0.45, vU));
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(head: THREE.Vector3, tail: THREE.Vector3, width: number, alpha = 1) {
    this.d.subVectors(head, tail);
    const len = this.d.length();
    this.mesh.visible = alpha > 0.004 && len > 1e-3 && width > 1e-4;
    if (!this.mesh.visible) return;
    this.mesh.position.addVectors(head, tail).multiplyScalar(0.5);
    this.mesh.quaternion.copy(this.q.setFromUnitVectors(UP, this.d.multiplyScalar(1 / len)));
    this.mesh.scale.set(width, len, width);
    this.mat.uniforms.uAlpha.value = alpha;
  }

  reset() {
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// ForgeSigil and PulseRing (ground rings)
// ---------------------------------------------------------------------------------------------------------------

function drawForgeSigil(inner: boolean): HTMLCanvasElement {
  const S = 1024, C = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const ASH = '#ff0000', RUNE = '#00ff00'; // red channel = ash strokes, green channel = glowing runes
  let seed = 19;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const polar = (r: number, a: number): [number, number] => [C + Math.cos(a) * r, C + Math.sin(a) * r];
  const circle = (r: number, lw: number, col: string) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };

  circle(494, 6, ASH);
  circle(448, 18, ASH);
  // Square teeth on the heavy ring, like a gear / anvil face.
  g.fillStyle = ASH;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2, [x, y] = polar(470, a);
    g.save(); g.translate(x, y); g.rotate(a); g.fillRect(-18, -20, 36, 40); g.restore();
  }
  circle(410, 5, ASH);
  circle(330, 5, ASH);
  // The rune band: chunky angular glyphs in the glowing colour.
  g.strokeStyle = RUNE;
  g.lineWidth = 11;
  const runes = 34;
  for (let i = 0; i < runes; i++) {
    const a = ((i + 0.5) / runes) * Math.PI * 2;
    g.beginPath();
    const n = 2 + Math.floor(rnd() * 3);
    let [px, py] = polar(342 + rnd() * 12, a + (rnd() - 0.5) * 0.04);
    g.moveTo(px, py);
    for (let s = 0; s < n; s++) {
      [px, py] = polar(345 + rnd() * 55, a + (rnd() - 0.5) * 0.07);
      g.lineTo(px, py);
    }
    g.stroke();
  }
  if (inner) {
    circle(250, 9, ASH);
    // An anvil silhouette at the centre (hidden under the pool / hammer).
    g.fillStyle = ASH;
    g.beginPath();
    g.moveTo(C - 150, C - 40); g.lineTo(C + 70, C - 40); g.lineTo(C + 170, C - 10); g.lineTo(C + 70, C + 20);
    g.lineTo(C + 40, C + 20); g.lineTo(C + 60, C + 100); g.lineTo(C + 110, C + 100); g.lineTo(C + 110, C + 140);
    g.lineTo(C - 110, C + 140); g.lineTo(C - 110, C + 100); g.lineTo(C - 60, C + 100); g.lineTo(C - 40, C + 20);
    g.lineTo(C - 150, C + 20); g.closePath(); g.fill();
    g.strokeStyle = RUNE; g.lineWidth = 9;
    g.beginPath(); g.moveTo(C - 70, C - 10); g.lineTo(C + 90, C - 10); g.stroke();
  }
  return cv;
}

const sigilTextures: [THREE.CanvasTexture | null, THREE.CanvasTexture | null] = [null, null];

export interface ForgeSigilOptions {
  /** Draw the anvil silhouette and inner ring in the middle. Default false (open middle). */
  inner?: boolean;
}

/**
 * The forge sigil: a canvas-drawn ground ring (ash-grey toothed rings, glowing orange runes, optionally an anvil in
 * the middle), normal-blended. `set(center, radius, spin)` lays it on the ground; `reveal` 0..1 draws it on as a
 * sweep around the circle, `opacity` fades it, `glow` 0..1 brightens the runes. Add `mesh` to the group.
 */
export class ForgeSigil {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private _reveal = 0;
  private _opacity = 1;

  constructor(opts: ForgeSigilOptions = {}) {
    const si = opts.inner ? 1 : 0;
    let tex = sigilTextures[si];
    if (!tex) {
      tex = new THREE.CanvasTexture(drawForgeSigil(si === 1));
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = 8;
      sigilTextures[si] = tex;
    }
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      uniforms: {
        uMap: { value: tex }, uAsh: { value: new THREE.Color(FORGE.ash) }, uHot: { value: new THREE.Color(FORGE.hot) },
        uBody: { value: new THREE.Color(FORGE.body) }, uReveal: { value: 0 }, uOpacity: { value: 1 }, uGlow: { value: 0.5 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uAsh, uHot, uBody; uniform float uReveal, uOpacity, uGlow;
        varying vec2 vUv;
        void main() {
          vec4 t = texture2D(uMap, vUv);
          vec2 p = vUv - 0.5;
          float sweep = fract(atan(p.x, -p.y) / 6.28318530718);
          float m = 1.0 - smoothstep(uReveal * 1.02 - 0.012, uReveal * 1.02, sweep);
          float o = t.a * m * uOpacity;
          if (o < 0.004) discard;
          vec3 rune = mix(uBody, uHot, uGlow) * 0.95;
          vec3 col = t.g > 0.5 ? rune : uAsh * 0.9;
          gl_FragColor = vec4(col, o);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 1;
  }

  get reveal() { return this._reveal; }
  set reveal(v: number) { this._reveal = v; this.mat.uniforms.uReveal.value = v; this.sync(); }
  get opacity() { return this._opacity; }
  set opacity(v: number) { this._opacity = v; this.mat.uniforms.uOpacity.value = v; this.sync(); }
  get glow() { return this.mat.uniforms.uGlow.value as number; }
  set glow(v: number) { this.mat.uniforms.uGlow.value = v; }

  private sync() {
    this.mesh.visible = this._reveal > 0.002 && this._opacity > 0.004;
  }

  set(center: THREE.Vector3, radius: number, spin = 0) {
    this.mesh.position.set(center.x, 0.05, center.z);
    this.mesh.rotation.y = spin;
    this.mesh.scale.setScalar(Math.max(radius, MIN_SCALE));
  }

  reset() {
    this.reveal = 0;
    this.opacity = 1;
    this.glow = 0.5;
  }
}

/**
 * An expanding ground ring of heat: an ash-grey leading line with an orange band trailing behind it. `set(center,
 * radius, opacity, thickness)` each frame (radius = the leading edge); opacity 0 hides it. Add `mesh` to the group.
 */
export class PulseRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private maxR = 1;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      uniforms: {
        uAsh: { value: new THREE.Color(FORGE.ash) }, uHot: { value: new THREE.Color(FORGE.hot) }, uBody: { value: new THREE.Color(FORGE.body) },
        uRadius: { value: 1 }, uThick: { value: 0.3 }, uOpacity: { value: 0 }, uScale: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uAsh, uHot, uBody; uniform float uRadius, uThick, uOpacity, uScale;
        varying vec2 vUv;
        void main() {
          float r = length(vUv * 2.0 - 1.0) * uScale;
          float d = uRadius - r;                       // > 0 behind the front
          if (d < -0.02 || d > uThick * 3.2) discard;
          vec3 col; float a = uOpacity;
          if (d < uThick * 0.45) col = uAsh * 0.95;                       // the leading line
          else if (d < uThick * 1.6) col = mix(uBody, uHot, 0.6);
          else { col = uBody * 0.85; a *= 0.55; }
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 4;
  }

  set(center: THREE.Vector3, radius: number, opacity: number, thickness = 0.3) {
    this.mesh.visible = opacity > 0.004 && radius > 1e-3;
    if (!this.mesh.visible) return;
    this.maxR = radius + thickness * 1.2;
    this.mesh.position.set(center.x, 0.06, center.z);
    this.mesh.scale.setScalar(this.maxR);
    this.mat.uniforms.uScale.value = this.maxR;
    this.mat.uniforms.uRadius.value = radius;
    this.mat.uniforms.uThick.value = thickness;
    this.mat.uniforms.uOpacity.value = opacity;
  }

  reset() {
    this.mesh.visible = false;
  }
}
