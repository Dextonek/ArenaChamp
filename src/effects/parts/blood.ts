import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The blood kit (pipeline/designs/blood-kit.md): liquid blood that hardens into crystal, a bone sigil as the pale
 * foil, ground pools and splats. Everything is pooled, takes world-space positions and directions, and has a
 * `reset()`. All materials are normal-blended custom toon shaders with values below the bloom threshold (~0.85)
 * except a few tiny specular dots / tip glints.
 */

/** Palette (art bible row "Blood"). Numbers for `THREE.Color`, `BLOOD_CSS` for APIs that want a string. */
export const BLOOD = {
  core: 0xfff1e6,
  hot: 0xff3b4e,
  body: 0x8c0f22,
  accent: 0xbff4ff,
  dark: 0x140306,
  bone: 0xe9dcc6,
} as const;

export const BLOOD_CSS = {
  core: '#fff1e6',
  hot: '#ff3b4e',
  body: '#8c0f22',
  accent: '#bff4ff',
  dark: '#140306',
  bone: '#e9dcc6',
} as const;

const UP = new THREE.Vector3(0, 1, 0);
const MIN_SCALE = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// ---------------------------------------------------------------------------------------------------------------
// Shared shaders
// ---------------------------------------------------------------------------------------------------------------

/**
 * Vertex stage shared by liquid and crystal: works instanced or not. Instance scale may be non-uniform (stretched
 * drops, long spikes), so the normal is transformed by the inverse-transpose (divide each column by its squared length).
 */
const litVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vView; varying vec3 vBary; varying float vH;
  attribute vec3 aBary;
  void main() {
    #ifdef USE_INSTANCING
      vec4 lp = instanceMatrix * vec4(position, 1.0);
      vec3 c0 = instanceMatrix[0].xyz, c1 = instanceMatrix[1].xyz, c2 = instanceMatrix[2].xyz;
      vec3 ln = c0 * (normal.x / max(dot(c0, c0), 1e-10)) + c1 * (normal.y / max(dot(c1, c1), 1e-10))
              + c2 * (normal.z / max(dot(c2, c2), 1e-10));
    #else
      vec4 lp = vec4(position, 1.0);
      vec3 ln = normal;
    #endif
    vec4 mv = modelViewMatrix * lp;
    vec3 n = normalMatrix * ln;
    vN = n / max(length(n), 1e-6);
    vView = normalize(-mv.xyz);
    vBary = aBary;
    vH = position.y;
    gl_Position = projectionMatrix * mv;
  }`;

const liquidFragment = /* glsl */ `
  uniform vec3 uBody, uDark, uHot, uCore;
  varying vec3 vN; varying vec3 vView; varying vec3 vBary; varying float vH;
  void main() {
    vec3 n = normalize(vN), v = normalize(vView);
    vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
    float ndl = dot(n, L);
    float f = 1.0 - abs(dot(n, v));
    vec3 col = uBody;
    col = mix(col, uDark, step(ndl, 0.0) * 0.5);                 // shadow side: one flat band
    col = mix(col, uHot, step(0.55, ndl) * 0.3);                 // lit side lifts toward the hot red
    if (f > 0.46 && ndl > -0.15) col = uHot;                     // ONE hot rim band on the light side
    if (f > 0.74) col = uDark;                                   // fresnel: the silhouette goes dark
    float spec = dot(n, normalize(L + v));
    if (spec > 0.987 && f < 0.5) col = uCore * 0.92;             // one tiny specular dot
    gl_FragColor = vec4(col, 1.0);
  }`;

const crystalFragment = /* glsl */ `
  uniform vec3 uBody, uDark, uHot, uCore;
  uniform float uGlint, uGlintAt;
  varying vec3 vN; varying vec3 vView; varying vec3 vBary; varying float vH;
  void main() {
    vec3 n = normalize(vN);
    vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
    float ndl = dot(n, L);
    // Flat facets, three flat tones from the dark colour up to a lifted body.
    float band = ndl > 0.45 ? 1.0 : (ndl > 0.0 ? 0.62 : (ndl > -0.4 ? 0.3 : 0.1));
    vec3 col = mix(uDark, uBody, min(band, 1.0));
    col = mix(col, uHot, step(0.99, band) * 0.22);
    // Thin hot edge line from barycentrics (masked diagonals stay at 1 and never draw).
    float e = min(vBary.x, min(vBary.y, vBary.z));
    float w = max(fwidth(e), 1e-4);
    float edge = 1.0 - smoothstep(w * 1.5, w * 2.6, e);
    col = mix(col, uHot, edge);
    // Tip glint, only when asked: the edge line runs hot-white at height uGlintAt.
    float g = uGlint * (1.0 - smoothstep(0.0, 0.16, abs(vH - uGlintAt)));
    col = mix(col, uCore * 0.95, clamp(g * (0.25 + 0.75 * edge), 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }`;

function bloodUniforms() {
  return {
    uBody: { value: new THREE.Color(BLOOD.body) },
    uDark: { value: new THREE.Color(BLOOD.dark) },
    uHot: { value: new THREE.Color(BLOOD.hot) },
    uCore: { value: new THREE.Color(BLOOD.core) },
  };
}

/** Liquid blood: smooth, crimson, dark fresnel rim, one hot rim line, one specular dot. */
function liquidMaterial() {
  return new THREE.ShaderMaterial({ uniforms: bloodUniforms(), vertexShader: litVertex, fragmentShader: liquidFragment });
}

function crystalMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...bloodUniforms(), uGlint: { value: 0 }, uGlintAt: { value: 1 } },
    vertexShader: litVertex,
    fragmentShader: crystalFragment,
  });
}

/** Wet ground decal (pools, splats). Per-instance state `aState` = (spread, dry, seed, alpha) or uniform `uState`. */
function decalMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { ...bloodUniforms(), uTime: { value: 0 }, uState: { value: new THREE.Vector4(0, 0, 0, 0) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec4 vState;
      #ifdef USE_INSTANCING
        attribute vec4 aState;
      #else
        uniform vec4 uState;
      #endif
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING
          vState = aState;
          vec4 p = instanceMatrix * vec4(position, 1.0);
        #else
          vState = uState;
          vec4 p = vec4(position, 1.0);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uCore; uniform float uTime;
      varying vec2 vUv; varying vec4 vState;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p), a = atan(p.y, p.x), sd = vState.z;
        // Lumpy rounded edge; max radius 0.74 * 1.29 stays inside the quad.
        float lump = 1.0 + 0.15 * sin(a * 3.0 + sd * 6.0) + 0.09 * sin(a * 5.0 + sd * 11.0) + 0.05 * sin(a * 9.0 + sd * 3.0);
        float R = 0.74 * vState.x * lump;
        float wet = 1.0 - vState.y;
        float aa = max(fwidth(r), 1e-4);
        float alpha = vState.w * (1.0 - smoothstep(R - aa, R, r));
        if (alpha < 0.004) discard;
        vec3 col = mix(uDark, uBody, 0.5 * wet);
        // Slow ripple ring while wet.
        float rr = R * (0.25 + 0.6 * fract(uTime * 0.35 + sd));
        col = mix(col, uBody, (1.0 - smoothstep(0.0, 0.03, abs(r - rr))) * wet * 0.8);
        // One thin hot rim line on the light side of the edge, only while wet.
        float lit = smoothstep(-0.3, 0.3, dot(p / max(r, 1e-4), vec2(-0.45, 0.65)));
        col = mix(col, uHot, smoothstep(R - 0.05, R - 0.03, r) * lit * wet);
        // One tiny specular dot.
        vec2 sp = (p - vec2(-0.25, 0.3) * R) / vec2(1.0, 0.55);
        col = mix(col, uCore * 0.9, (1.0 - smoothstep(0.02, 0.03, length(sp))) * wet * step(0.05, vState.x));
        gl_FragColor = vec4(col, alpha);
      }`,
  });
}

/** Builds a flat-shaded, non-indexed geometry from triangles, with barycentric edge data (see crystalFragment). */
class FacetBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private bary: number[] = [];

  constructor(private centre: THREE.Vector3) {}

  /** `mask`: the vertex opposite a diagonal; the edge opposite it is not drawn. */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, mask?: THREE.Vector3) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(this.centre);
    if (n.dot(mid) < 0) { const t = b; b = c; c = t; n.negate(); }
    n.normalize();
    const vs = [a, b, c];
    const m = mask ? vs.indexOf(mask) : -1;
    for (let i = 0; i < 3; i++) {
      this.pos.push(vs[i].x, vs[i].y, vs[i].z);
      this.nrm.push(n.x, n.y, n.z);
      const w = [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0];
      if (m >= 0) w[m] = 1;
      this.bary.push(w[0], w[1], w[2]);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('aBary', new THREE.Float32BufferAttribute(this.bary, 3));
    return g;
  }
}

/** Long, sharp, slightly curved five-sided spike: base on y = 0 (radius 0.5), tip at y = 1 leaning toward +x. */
function spikeGeometry() {
  const sides = 5;
  const r0: THREE.Vector3[] = [], r1: THREE.Vector3[] = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2 + 0.3;
    r0.push(new THREE.Vector3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5));
    r1.push(new THREE.Vector3(Math.cos(a) * 0.3 + 0.26 * 0.16, 0.4, Math.sin(a) * 0.3));
  }
  const tip = new THREE.Vector3(0.26, 1, 0);
  const fb = new FacetBuilder(new THREE.Vector3(0.05, 0.4, 0));
  for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides;
    fb.tri(r0[k], r0[k2], r1[k2], r0[k2]);
    fb.tri(r0[k], r1[k2], r1[k], r1[k]);
    fb.tri(r1[k], r1[k2], tip);
  }
  return fb.build();
}

/** Small flat tetrahedron for flakes. */
function flakeGeometry() {
  const v = [
    new THREE.Vector3(1, 1, 1), new THREE.Vector3(-1, -1, 1), new THREE.Vector3(-1, 1, -1), new THREE.Vector3(1, -1, -1),
  ].map((p) => p.multiplyScalar(0.5));
  const fb = new FacetBuilder(new THREE.Vector3());
  fb.tri(v[0], v[1], v[2]);
  fb.tri(v[0], v[3], v[1]);
  fb.tri(v[0], v[2], v[3]);
  fb.tri(v[1], v[3], v[2]);
  return fb.build();
}

/** Teardrop along +Y (the pointed tail), smooth normals. Bulb radius 1 at the origin. */
function dropGeometry() {
  const g = new THREE.SphereGeometry(1, 12, 9);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > 0) {
      const shrink = 1 - 0.6 * Math.pow(y, 1.4);
      p.setX(i, p.getX(i) * shrink);
      p.setZ(i, p.getZ(i) * shrink);
      p.setY(i, y + 0.75 * y * y);
    }
  }
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const merged = mergeVertices(g, 1e-4);
  merged.computeVertexNormals();
  merged.setAttribute('aBary', new THREE.Float32BufferAttribute(new Float32Array(merged.attributes.position.count * 3), 3));
  return merged;
}

// ---------------------------------------------------------------------------------------------------------------
// BloodTendril
// ---------------------------------------------------------------------------------------------------------------

export interface BloodTendrilOptions {
  /** Samples along the rope. Default 40. */
  segments?: number;
  /** Sides of the tube. Default 8. */
  sides?: number;
}

/**
 * The signature shape: a tapered, viscous rope of blood with a round bead at the tip (surface tension). A smooth
 * tube along a curve you set per frame: `setPoints(points)` (Catmull-Rom through them, root first) or
 * `setFunction(fn)` (fn(u, out) for u in 0..1). `reveal(head, tail)` (0..1 of the curve) draws it on from the root
 * and pulls it back in. `update(t)` rebuilds the mesh (t drives the wobble). Add `mesh` to the group.
 */
export class BloodTendril {
  readonly mesh: THREE.Mesh;
  /** Root thickness (world units). */
  width = 0.12;
  /** Visible end of the curve, 0..1. */
  head = 1;
  /** Visible start of the curve, 0..1 (pull the rope in by raising it). */
  tail = 0;
  /** Tip bead radius as a multiple of the root radius; 0 = no bead. Default 1.5. */
  bead = 1.5;
  /** Sideways wobble amplitude (world units); 0 holds it perfectly still. */
  wobble = 0.02;
  private segs: number;
  private sides: number;
  private pts: THREE.Vector3[] = [];
  private fn: ((u: number, out: THREE.Vector3) => THREE.Vector3) | null = null;
  private curve = new THREE.CatmullRomCurve3();
  private geo = new THREE.BufferGeometry();
  private posArr: Float32Array;
  private nrmArr: Float32Array;
  private c: THREE.Vector3[] = [];
  private T: THREE.Vector3[] = [];
  private r: Float32Array;
  private L: Float32Array;
  private N = new THREE.Vector3();
  private B = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private qq = new THREE.Quaternion();

  constructor(opts: BloodTendrilOptions = {}) {
    this.segs = opts.segments ?? 40;
    this.sides = opts.sides ?? 8;
    const rings = this.segs + 1;
    this.posArr = new Float32Array(rings * this.sides * 3);
    this.nrmArr = new Float32Array(rings * this.sides * 3);
    this.r = new Float32Array(rings);
    this.L = new Float32Array(rings);
    for (let i = 0; i < rings; i++) { this.c.push(new THREE.Vector3()); this.T.push(new THREE.Vector3()); }
    const index: number[] = [];
    for (let i = 0; i < this.segs; i++) {
      for (let j = 0; j < this.sides; j++) {
        const a = i * this.sides + j, b = i * this.sides + ((j + 1) % this.sides);
        const c = a + this.sides, d = b + this.sides;
        index.push(a, c, b, b, c, d);
      }
    }
    this.geo.setIndex(index);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nrmArr, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aBary', new THREE.BufferAttribute(new Float32Array(rings * this.sides * 3), 3));
    this.mesh = new THREE.Mesh(this.geo, liquidMaterial());
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Sets the curve through world-space points, root first (read again at every update, so you may mutate them). */
  setPoints(points: THREE.Vector3[]) {
    this.pts = points;
    this.fn = null;
  }

  /** Sets the curve as a function of u in 0..1 (root to tip). */
  setFunction(fn: (u: number, out: THREE.Vector3) => THREE.Vector3) {
    this.fn = fn;
  }

  /** Hides it and restores the defaults for head / tail. */
  reset() {
    this.head = 1;
    this.tail = 0;
    this.mesh.visible = false;
  }

  /** Rebuilds the tube for the current path and reveal. `t` is the effect time (wobble phase). */
  update(t: number) {
    const span = this.head - this.tail;
    if (span < 1e-3 || (!this.fn && this.pts.length < 2)) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const S = this.segs;
    if (!this.fn) this.curve.points = this.pts;
    // Sample the visible part of the curve.
    for (let i = 0; i <= S; i++) {
      const s = i / S;
      const u = this.tail + span * s;
      if (this.fn) this.fn(u, this.c[i]);
      else this.curve.getPoint(Math.min(1, Math.max(0, u)), this.c[i]);
    }
    this.L[0] = 0;
    for (let i = 1; i <= S; i++) this.L[i] = this.L[i - 1] + this.c[i].distanceTo(this.c[i - 1]);
    const total = Math.max(this.L[S], 1e-4);
    // Wobble: a travelling helical offset, zero at both ends. Applied after the tangents so the frames stay smooth.
    for (let i = 0; i <= S; i++) {
      const a = Math.max(0, i - 1), b = Math.min(S, i + 1);
      this.T[i].subVectors(this.c[b], this.c[a]);
      if (this.T[i].lengthSq() < 1e-12) this.T[i].set(0, 1, 0);
      this.T[i].normalize();
    }
    // Radius profile: tapered body, round root cap, round bead at the tip.
    const half = this.width / 2;
    const beadR = half * this.bead;
    for (let i = 0; i <= S; i++) {
      const s = i / S;
      const dTip = total - this.L[i];
      const dRoot = this.L[i];
      let rad = half * (1 - 0.45 * s);
      rad *= Math.sqrt(clamp01(dRoot / Math.max(half, 1e-4)));
      if (beadR > 1e-4) {
        rad *= clamp01(dTip / beadR);
        const sph = dTip < 2 * beadR ? Math.sqrt(Math.max(0, beadR * beadR - (beadR - dTip) * (beadR - dTip))) : 0;
        rad = Math.max(rad, sph);
      } else {
        rad *= Math.sqrt(clamp01(dTip / Math.max(half, 1e-4)));
      }
      this.r[i] = rad;
    }
    // Parallel-transport frames.
    const t0 = this.T[0];
    this.tmp.set(Math.abs(t0.x) < 0.8 ? 1 : 0, Math.abs(t0.x) < 0.8 ? 0 : 1, 0);
    this.N.crossVectors(t0, this.tmp).normalize();
    for (let i = 0; i <= S; i++) {
      if (i > 0) {
        this.qq.setFromUnitVectors(this.T[i - 1], this.T[i]);
        this.N.applyQuaternion(this.qq).normalize();
      }
      this.B.crossVectors(this.T[i], this.N);
      const s = i / S;
      const wob = this.wobble * Math.sin(Math.PI * s);
      const ph = s * 13 - t * 9;
      const ox = this.N.x * Math.cos(ph) * wob + this.B.x * Math.sin(ph) * wob;
      const oy = this.N.y * Math.cos(ph) * wob + this.B.y * Math.sin(ph) * wob;
      const oz = this.N.z * Math.cos(ph) * wob + this.B.z * Math.sin(ph) * wob;
      const cx = this.c[i].x + ox, cy = this.c[i].y + oy, cz = this.c[i].z + oz;
      const a = Math.max(0, i - 1), b = Math.min(S, i + 1);
      const dr = (this.r[b] - this.r[a]) / Math.max(this.L[b] - this.L[a], 1e-5);
      for (let j = 0; j < this.sides; j++) {
        const ang = (j / this.sides) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const rx = this.N.x * ca + this.B.x * sa, ry = this.N.y * ca + this.B.y * sa, rz = this.N.z * ca + this.B.z * sa;
        const o = (i * this.sides + j) * 3;
        this.posArr[o] = cx + rx * this.r[i];
        this.posArr[o + 1] = cy + ry * this.r[i];
        this.posArr[o + 2] = cz + rz * this.r[i];
        // Tilt the normal along the tangent by the radius slope so the tip bead and the taper shade round.
        let nx = rx - this.T[i].x * dr, ny = ry - this.T[i].y * dr, nz = rz - this.T[i].z * dr;
        const nl = Math.max(Math.hypot(nx, ny, nz), 1e-6);
        nx /= nl; ny /= nl; nz /= nl;
        this.nrmArr[o] = nx; this.nrmArr[o + 1] = ny; this.nrmArr[o + 2] = nz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Ground decals: BloodSplats (pooled, used by BloodDrops) and BloodPool (one big pool)
// ---------------------------------------------------------------------------------------------------------------

function decalGeometry() {
  return new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
}

interface Splat { pos: THREE.Vector3; size: number; age: number; seed: number; live: boolean; life: number }

/**
 * A pool of small wet splats on the ground (instanced decals). They spread in a few frames, dry to the dark colour
 * and fade. BloodDrops adds one on every ground hit; `add` is public for hand-placed ones.
 */
export class BloodSplats {
  readonly mesh: THREE.InstancedMesh;
  /** Seconds of life: spread 0.12 s, wet until `dryAt`, then dry and fade out by `life`. */
  life = 3;
  dryAt = 1.0;
  /** Height above the floor. */
  y = 0.03;
  private splats: Splat[] = [];
  private cursor = 0;
  private state: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private mat = decalMaterial();
  private time = 0;

  constructor(max = 40) {
    const geo = decalGeometry();
    this.state = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.state.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aState', this.state);
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.splats.push({ pos: new THREE.Vector3(), size: 0, age: 0, seed: 0, live: false, life: 3 });
  }

  /** Puts a splat of world radius `size` at the x / z of `pos`. The oldest is recycled when the pool is full. */
  add(pos: THREE.Vector3, size: number) {
    const sp = this.splats[this.cursor];
    this.cursor = (this.cursor + 1) % this.splats.length;
    sp.pos.set(pos.x, this.y, pos.z);
    sp.size = Math.max(size, MIN_SCALE);
    sp.age = 0;
    sp.seed = Math.random() * 6.28;
    sp.life = this.life;
    sp.live = true;
  }

  /** Makes every live splat fade out within `seconds` from now. */
  fadeOutAll(seconds: number) {
    for (const sp of this.splats) if (sp.live) sp.life = Math.min(sp.life, sp.age + Math.max(seconds, 0.05));
  }

  reset() {
    for (const sp of this.splats) sp.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
    let k = 0;
    const arr = this.state.array as Float32Array;
    for (const sp of this.splats) {
      if (!sp.live) continue;
      sp.age += dt;
      if (sp.age >= sp.life) { sp.live = false; continue; }
      const spread = easeOut(sp.age / 0.12);
      const dry = clamp01((sp.age - this.dryAt) / 0.8);
      const alpha = 1 - clamp01((sp.age - (sp.life - Math.min(0.7, sp.life))) / Math.min(0.7, sp.life));
      const scale = Math.max(sp.size / 0.74, MIN_SCALE);
      this.m.compose(sp.pos, this.q, this.s.set(scale, 1, scale));
      this.mesh.setMatrixAt(k, this.m);
      arr[k * 4] = Math.max(spread, 0.01); arr[k * 4 + 1] = dry; arr[k * 4 + 2] = sp.seed; arr[k * 4 + 3] = alpha;
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.state.needsUpdate = true;
  }
}

/**
 * A big dark wet pool on the ground with a lumpy, rounded edge. `place(center)`, `spread(radius, seconds)` makes it
 * flow outward (a slow ripple runs while it is wet), `dry(dryTime, fadeTime)` darkens it to near-black and fades it
 * out. `update(dt)` every frame. Add `mesh` to the group.
 */
export class BloodPool {
  readonly mesh: THREE.Mesh;
  /** Height above the floor. */
  y = 0.035;
  private mat = decalMaterial();
  private spreadDur = 0.5;
  private spreadAge = -1;
  private dryDur = 0.8;
  private fadeDur = 0.8;
  private dryAge = -1;
  private time = 0;
  private seed = Math.random() * 6.28;

  constructor() {
    this.mesh = new THREE.Mesh(decalGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.position.y = this.y;
  }

  /** Centres the pool at the x / z of `center`. */
  place(center: THREE.Vector3) {
    this.mesh.position.set(center.x, this.y, center.z);
  }

  /** Starts the pool flowing out to `radius` (world units) over `seconds`. */
  spread(radius: number, seconds = 0.6) {
    this.spreadDur = Math.max(seconds, 0.05);
    this.spreadAge = 0;
    this.dryAge = -1;
    this.seed = Math.random() * 6.28;
    this.mesh.scale.setScalar(Math.max(radius / 0.74, MIN_SCALE));
  }

  /** Darkens it to near-black over `dryTime`, then fades it out over `fadeTime`. */
  dry(dryTime = 0.8, fadeTime = 0.8) {
    this.dryDur = Math.max(dryTime, 0.05);
    this.fadeDur = Math.max(fadeTime, 0.05);
    this.dryAge = 0;
  }

  reset() {
    this.spreadAge = -1;
    this.dryAge = -1;
    this.mesh.visible = false;
  }

  update(dt: number) {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
    if (this.spreadAge < 0) { this.mesh.visible = false; return; }
    this.spreadAge += dt;
    if (this.dryAge >= 0) this.dryAge += dt;
    const spread = easeOut(this.spreadAge / this.spreadDur);
    // The edge keeps creeping a little after the main spread.
    const creep = 1 + 0.04 * clamp01(this.spreadAge / (this.spreadDur + 3));
    const dry = this.dryAge < 0 ? 0 : clamp01(this.dryAge / this.dryDur);
    const alpha = this.dryAge < 0 ? 1 : 1 - clamp01((this.dryAge - this.dryDur) / this.fadeDur);
    this.mesh.visible = alpha > 0.004;
    (this.mat.uniforms.uState.value as THREE.Vector4).set(Math.max(spread * creep, 0.01), dry, this.seed, alpha);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// BloodDrops
// ---------------------------------------------------------------------------------------------------------------

interface Drop {
  mode: 0 | 1 | 2; // dead, ballistic, draining
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  r: number;
  age: number;
  life: number;
  from: THREE.Vector3;
  toFn: ((out: THREE.Vector3) => THREE.Vector3) | null;
  dur: number;
  lift: number;
  side: THREE.Vector3;
}

export interface BloodDropsOptions {
  /** Max drops alive at once. Default 96. */
  maxDrops?: number;
  /** Max ground splats alive at once. Default 40. */
  maxSplats?: number;
}

/**
 * Pooled blood teardrops, stretched along their velocity, falling with gravity and leaving a splat on the ground.
 * `spray` throws a fan of them, `emit` a single one, `drain` makes drops lift off a point and arc home to a moving
 * target (the life-drain motif); they pop on arrival and call `onArrive`. `update(dt)` each frame. Add `mesh` (a
 * group holding the drops and the splats) to the effect's group.
 */
export class BloodDrops {
  readonly mesh = new THREE.Group();
  readonly splats: BloodSplats;
  /** World gravity (negative = down). */
  gravity = -14;
  /** Ground height; drops that fall below it splat. */
  groundY = 0;
  /** Multiplier on ground splat size. Default 1. */
  splatScale = 1;
  /** Called with the arrival point whenever a draining drop arrives. */
  onArrive: ((pos: THREE.Vector3) => void) | null = null;
  private inst: THREE.InstancedMesh;
  private drops: Drop[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private d = new THREE.Vector3();
  private tgt = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(opts: BloodDropsOptions = {}) {
    const max = opts.maxDrops ?? 96;
    this.splats = new BloodSplats(opts.maxSplats ?? 40);
    this.inst = new THREE.InstancedMesh(dropGeometry(), liquidMaterial(), max);
    this.inst.frustumCulled = false;
    this.inst.count = 0;
    this.mesh.add(this.splats.mesh, this.inst);
    for (let i = 0; i < max; i++) {
      this.drops.push({
        mode: 0, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.06, age: 0,
        life: 3, from: new THREE.Vector3(), toFn: null, dur: 0.6, lift: 0, side: new THREE.Vector3(),
      });
    }
  }

  private take(): Drop {
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[(this.cursor + i) % this.drops.length];
      if (d.mode === 0) { this.cursor = (this.cursor + i + 1) % this.drops.length; return d; }
    }
    const d = this.drops[this.cursor];
    this.cursor = (this.cursor + 1) % this.drops.length;
    return d;
  }

  /** One ballistic drop at `pos` with velocity `vel` (world units / s) and bulb radius `radius`. */
  emit(pos: THREE.Vector3, vel: THREE.Vector3, radius = 0.06, life = 3) {
    const d = this.take();
    d.mode = 1; d.pos.copy(pos); d.prev.copy(pos); d.vel.copy(vel); d.r = radius; d.age = 0; d.life = life; d.toFn = null;
  }

  /** A fan of `count` drops from `pos`, around direction `dir`, within `spread` radians, at about `speed`. */
  spray(pos: THREE.Vector3, dir: THREE.Vector3, count: number, speed: number, spread = 0.4) {
    const axis = this.d.copy(dir).normalize();
    const u = new THREE.Vector3(Math.abs(axis.y) < 0.9 ? 0 : 1, Math.abs(axis.y) < 0.9 ? 1 : 0, 0).cross(axis).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, c = Math.sqrt(Math.random()) * spread;
      const vel = axis.clone().multiplyScalar(Math.cos(c))
        .addScaledVector(u, Math.sin(c) * Math.cos(a)).addScaledVector(v, Math.sin(c) * Math.sin(a))
        .multiplyScalar(speed * (0.65 + Math.random() * 0.7));
      this.emit(pos, vel, 0.04 + Math.random() * 0.05);
    }
  }

  /**
   * `count` drops lift off near `from` and arc home to `toFn(out)` (called every frame, so the target may move),
   * one after another: drop i leaves at `delay + i * stagger`, flies `duration` seconds, pops on arrival.
   */
  drain(
    from: THREE.Vector3, toFn: (out: THREE.Vector3) => THREE.Vector3, count: number,
    opts: { delay?: number; stagger?: number; duration?: number; radius?: number; spread?: number } = {},
  ) {
    const { delay = 0, stagger = 0.06, duration = 0.6, radius = 0.06, spread = 0.3 } = opts;
    for (let i = 0; i < count; i++) {
      const d = this.take();
      d.mode = 2;
      d.from.set(from.x + (Math.random() - 0.5) * 2 * spread, from.y + (Math.random() - 0.5) * spread, from.z + (Math.random() - 0.5) * 2 * spread);
      d.pos.copy(d.from); d.prev.copy(d.from); d.vel.set(0, 0, 0);
      d.toFn = toFn;
      d.age = -(delay + i * stagger);
      d.dur = duration * (0.9 + Math.random() * 0.2);
      d.r = radius * (0.8 + Math.random() * 0.4);
      d.lift = 0.6 + Math.random() * 0.9;
      d.side.set(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(1.2);
    }
  }

  reset() {
    for (const d of this.drops) d.mode = 0;
    this.inst.count = 0;
    this.splats.reset();
  }

  update(dt: number) {
    this.splats.update(dt);
    let k = 0;
    for (const d of this.drops) {
      if (d.mode === 0) continue;
      d.age += dt;
      let scale = d.r;
      if (d.mode === 1) {
        d.prev.copy(d.pos);
        d.vel.y += this.gravity * dt;
        d.pos.addScaledVector(d.vel, dt);
        if (d.pos.y <= this.groundY + 0.02 && d.vel.y < 0) {
          this.splats.add(d.pos, d.r * (4 + Math.random() * 3) * this.splatScale);
          d.mode = 0;
          continue;
        }
        if (d.age >= d.life) { d.mode = 0; continue; }
      } else {
        if (d.age < 0) continue; // waiting its turn
        const u = Math.min(1, d.age / d.dur);
        d.toFn!(this.tgt);
        const e = u * u * (3 - 2 * u);
        d.prev.copy(d.pos);
        const arc = Math.sin(Math.PI * u);
        this.p.lerpVectors(d.from, this.tgt, e);
        this.p.y += d.lift * arc;
        this.p.addScaledVector(d.side, arc);
        d.pos.copy(this.p);
        // Bulge out of the source, shrink as it pops into the target.
        scale = d.r * Math.min(1, d.age / 0.1) * (1 - Math.pow(Math.max(0, (u - 0.85) / 0.15), 2));
        if (u >= 1) {
          d.mode = 0;
          this.onArrive?.(this.tgt);
          continue;
        }
      }
      // Tail (+Y of the teardrop) trails against the motion; stretch with speed.
      this.d.subVectors(d.pos, d.prev);
      const speed = this.d.length() / Math.max(dt, 1e-4);
      if (speed > 1e-3) this.q.setFromUnitVectors(UP, this.d.multiplyScalar(-1 / (speed * Math.max(dt, 1e-4))));
      else this.q.identity();
      const stretch = d.mode === 2 ? 1 + Math.min(3, speed * 0.15) : 1 + Math.min(1.6, speed * 0.07);
      const sc = Math.max(scale, MIN_SCALE);
      this.m.compose(d.pos, this.q, this.s.set(sc, Math.max(sc * stretch, MIN_SCALE), sc));
      this.inst.setMatrixAt(k++, this.m);
    }
    this.inst.count = k;
    this.inst.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// BloodThorns
// ---------------------------------------------------------------------------------------------------------------

interface Spike {
  alive: boolean;
  base: THREE.Vector3;
  q: THREE.Quaternion;
  len: number;
  w: number;
  age: number; // negative = still waiting
  grow: number;
}

interface Flake {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  axis: THREE.Vector3;
  angle: number;
  spin: number;
  age: number;
  life: number;
  size: number;
}

export interface BloodThornsOptions {
  /** Max spikes alive at once. Default 48. */
  maxSpikes?: number;
  /** Max flakes alive at once. Default 192. */
  maxFlakes?: number;
}

/**
 * Blood that hardened: instanced crystal spikes (flat facets, dark crimson body, thin hot edge line). `erupt` grows a
 * ring (or a filled disc) of them out of the ground with a staggered start; `spike` makes one arbitrary spike (the
 * lance) and returns a handle for `place`. `shatter` turns every spike into dark flakes. The tip glint is off unless
 * you drive `glint` (0..1) and `glintAt` (0 base .. 1 tip): the edge line runs core-white at that height. `update(dt)`
 * each frame. Add `mesh` (spikes and flakes) to the group.
 */
export class BloodThorns {
  readonly mesh = new THREE.Group();
  /** Gravity for the flakes. */
  gravity = -12;
  private spikeMat = crystalMaterial();
  private spikes: Spike[] = [];
  private flakes: Flake[] = [];
  private spikeMesh: THREE.InstancedMesh;
  private flakeMesh: THREE.InstancedMesh;
  private sCursor = 0;
  private fCursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(opts: BloodThornsOptions = {}) {
    const maxS = opts.maxSpikes ?? 48, maxF = opts.maxFlakes ?? 192;
    this.spikeMesh = new THREE.InstancedMesh(spikeGeometry(), this.spikeMat, maxS);
    this.flakeMesh = new THREE.InstancedMesh(flakeGeometry(), crystalMaterial(), maxF);
    for (const im of [this.spikeMesh, this.flakeMesh]) { im.frustumCulled = false; im.count = 0; this.mesh.add(im); }
    for (let i = 0; i < maxS; i++) {
      this.spikes.push({ alive: false, base: new THREE.Vector3(), q: new THREE.Quaternion(), len: 1, w: 0.2, age: 0, grow: 0.18 });
    }
    for (let i = 0; i < maxF; i++) {
      this.flakes.push({
        alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0),
        angle: 0, spin: 0, age: 0, life: 1, size: 0.1,
      });
    }
  }

  /** Tip glint amount 0..1 (0 = off). */
  get glint() { return this.spikeMat.uniforms.uGlint.value as number; }
  set glint(v: number) { this.spikeMat.uniforms.uGlint.value = v; }
  /** Height of the glint along the spikes, 0 base .. 1 tip. */
  get glintAt() { return this.spikeMat.uniforms.uGlintAt.value as number; }
  set glintAt(v: number) { this.spikeMat.uniforms.uGlintAt.value = v; }

  /**
   * One spike from `base` pointing along `dir`, `length` long and `width` across its base. It grows out over `grow`
   * seconds after `delay` (grow 0 = there at once). Returns a handle for `place`.
   */
  spike(base: THREE.Vector3, dir: THREE.Vector3, length: number, width: number, grow = 0.18, delay = 0): number {
    const idx = this.sCursor;
    this.sCursor = (this.sCursor + 1) % this.spikes.length;
    const sp = this.spikes[idx];
    sp.alive = true;
    sp.base.copy(base);
    sp.q.setFromUnitVectors(UP, this.p.copy(dir).normalize());
    sp.len = length; sp.w = width; sp.grow = grow; sp.age = -delay;
    return idx;
  }

  /** Moves / re-aims a spike made by `spike` (the lance in flight). Pass `length` to change it. */
  place(handle: number, base: THREE.Vector3, dir: THREE.Vector3, length?: number) {
    const sp = this.spikes[handle];
    if (!sp) return;
    sp.base.copy(base);
    sp.q.setFromUnitVectors(UP, this.p.copy(dir).normalize());
    if (length !== undefined) sp.len = length;
  }

  /**
   * A ring of `count` spikes of about `height` at `radius` around `center` (ground), leaning outward. Options:
   * `width` base width (default 0.2 * height), `tilt` outward lean in radians (default 0.35), `stagger` the window in
   * seconds over which they start (default 0.12), `grow` seconds to full height (default 0.18), `fill` scatters them
   * over the whole disc instead of a ring.
   */
  erupt(
    center: THREE.Vector3, radius: number, count: number, height: number,
    opts: { width?: number; tilt?: number; stagger?: number; grow?: number; fill?: boolean } = {},
  ) {
    const { tilt = 0.35, stagger = 0.12, grow = 0.18, fill = false } = opts;
    const phase = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3(), base = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = phase + (i + (Math.random() - 0.5) * 0.5) / count * Math.PI * 2;
      const rad = fill ? radius * Math.sqrt(Math.random()) : radius * (0.92 + 0.16 * Math.random());
      base.set(center.x + Math.cos(a) * rad, center.y, center.z + Math.sin(a) * rad);
      const lean = fill ? (Math.random() - 0.5) * 2 * tilt : tilt * (0.7 + Math.random() * 0.6);
      dir.set(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
      const h = height * (i % 2 === 0 ? 1 : 0.7) * (0.85 + Math.random() * 0.3);
      this.spike(base, dir, h, opts.width ?? h * 0.2, grow, Math.random() * stagger);
    }
  }

  /** Breaks every spike into `perSpike` dark flakes that burst out and fall; they live `life` to 1.7 × `life` s. */
  shatter(perSpike = 4, speed = 4, life = 0.7) {
    for (const sp of this.spikes) {
      if (!sp.alive) continue;
      sp.alive = false;
      if (sp.age < 0) continue;
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(sp.q);
      for (let i = 0; i < perSpike; i++) {
        const f = this.flakes[this.fCursor];
        this.fCursor = (this.fCursor + 1) % this.flakes.length;
        f.alive = true;
        const along = Math.random() * sp.len * Math.min(1, sp.age / Math.max(sp.grow, 1e-3));
        f.pos.copy(sp.base).addScaledVector(axis, along);
        f.vel.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
        f.vel.y += speed * 0.4;
        f.axis.randomDirection();
        f.angle = Math.random() * 6;
        f.spin = (Math.random() - 0.5) * 18;
        f.age = 0;
        f.life = life * (1 + Math.random() * 0.7);
        f.size = Math.min(0.2, 0.05 + sp.len * 0.06) * (0.7 + Math.random() * 0.6);
      }
    }
  }

  reset() {
    for (const sp of this.spikes) sp.alive = false;
    for (const f of this.flakes) f.alive = false;
    this.spikeMesh.count = 0;
    this.flakeMesh.count = 0;
    this.glint = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const sp of this.spikes) {
      if (!sp.alive) continue;
      sp.age += dt;
      if (sp.age < 0) continue;
      const e = sp.grow <= 0 ? 1 : easeOut(sp.age / sp.grow);
      const y = Math.max(sp.len * e, MIN_SCALE), xz = Math.max(sp.w * (0.35 + 0.65 * e), MIN_SCALE);
      this.m.compose(sp.base, sp.q, this.s.set(xz, y, xz));
      this.spikeMesh.setMatrixAt(k++, this.m);
    }
    this.spikeMesh.count = k;
    this.spikeMesh.instanceMatrix.needsUpdate = true;

    let n = 0;
    for (const f of this.flakes) {
      if (!f.alive) continue;
      f.age += dt;
      if (f.age >= f.life) { f.alive = false; continue; }
      f.vel.y += this.gravity * dt;
      f.pos.addScaledVector(f.vel, dt);
      if (f.pos.y < 0.03) { f.pos.y = 0.03; f.vel.multiplyScalar(0.2); f.vel.y = 0; f.spin *= 0.3; }
      f.angle += f.spin * dt;
      this.q.setFromAxisAngle(f.axis, f.angle);
      const shrink = 1 - Math.pow(clamp01((f.age / f.life - 0.55) / 0.45), 2);
      this.m.compose(f.pos, this.q, this.s.setScalar(Math.max(f.size * shrink, MIN_SCALE)));
      this.flakeMesh.setMatrixAt(n++, this.m);
    }
    this.flakeMesh.count = n;
    this.flakeMesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// BloodSigil
// ---------------------------------------------------------------------------------------------------------------

function drawSigil(inner: boolean): HTMLCanvasElement {
  const S = 1024, C = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const polar = (r: number, a: number): [number, number] => [C + Math.cos(a) * r, C + Math.sin(a) * r];
  const circle = (r: number, lw: number) => { g.lineWidth = lw; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };

  // One sharp outer line.
  circle(494, 6);
  // The thorned circle: a heavy ring with alternating long and short thorns pointing outward.
  circle(440, 15);
  const thorns = 24;
  for (let i = 0; i < thorns; i++) {
    const a = (i / thorns) * Math.PI * 2, long = i % 2 === 0;
    const [x0, y0] = polar(438, a - 0.045), [x1, y1] = polar(438, a + 0.045), [tx, ty] = polar(long ? 486 : 466, a + 0.02);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(tx, ty); g.lineTo(x1, y1); g.closePath(); g.fill();
  }
  // One script band between two thin rings: short rune strokes.
  circle(412, 5);
  circle(336, 5);
  g.lineWidth = 7;
  const runes = 52;
  for (let i = 0; i < runes; i++) {
    const a = ((i + 0.5) / runes) * Math.PI * 2;
    const strokes = 2 + Math.floor(rnd() * 2);
    g.beginPath();
    for (let s = 0; s < strokes; s++) {
      const r0 = 346 + rnd() * 30, r1 = 372 + rnd() * 34, da0 = (rnd() - 0.5) * 0.045, da1 = (rnd() - 0.5) * 0.045;
      const [x0, y0] = polar(r0, a + da0), [x1, y1] = polar(r1, a + da1);
      g.moveTo(x0, y0); g.lineTo(x1, y1);
    }
    g.stroke();
  }
  circle(300, 9);
  // Two inward fang crescents, opposite each other, tips toward the centre.
  for (let f = 0; inner && f < 2; f++) {
    const a = f * Math.PI + Math.PI / 2;
    const p1 = polar(300, a - 0.34), p2 = polar(300, a + 0.34), tip = polar(96, a + 0.16);
    const c1 = polar(205, a - 0.36), c2 = polar(235, a + 0.02);
    g.beginPath();
    g.moveTo(p1[0], p1[1]);
    g.quadraticCurveTo(c1[0], c1[1], tip[0], tip[1]);
    g.quadraticCurveTo(c2[0], c2[1], p2[0], p2[1]);
    g.closePath();
    g.fill();
  }
  // A small mark at the centre.
  if (inner) {
    circle(26, 8);
    g.beginPath(); g.arc(C, C, 7, 0, Math.PI * 2); g.fill();
  }
  return cv;
}

const sigilTextures: [THREE.CanvasTexture | null, THREE.CanvasTexture | null] = [null, null];

export interface BloodSigilOptions {
  /** Colour of the strokes. Default bone `BLOOD.bone`. */
  color?: THREE.ColorRepresentation;
  /** Draw the inner fang crescents and the centre mark. Default true; false leaves the middle open. */
  inner?: boolean;
}

/**
 * The bone sigil: a canvas-drawn crest (thorned circle, two inward fang crescents, one script band, one sharp outer
 * line) in pale bone, not glowing, normal-blended. `set(center, normal, radius, spin)` places it: normal (0,1,0)
 * lies it on the ground, a horizontal normal stands it up facing that way. `reveal` 0..1 draws it on as a sweep around
 * the circle (starting at the top), `opacity` 0..1 is the fade. Add `mesh` to the group.
 */
export class BloodSigil {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private qz = new THREE.Quaternion();
  private _reveal = 0;
  private _opacity = 1;

  constructor(opts: BloodSigilOptions = {}) {
    const si = opts.inner === false ? 1 : 0;
    let sigilTexture = sigilTextures[si];
    if (!sigilTexture) {
      sigilTexture = new THREE.CanvasTexture(drawSigil(si === 0));
      sigilTexture.colorSpace = THREE.SRGBColorSpace;
      sigilTexture.anisotropy = 8;
      sigilTextures[si] = sigilTexture;
    }
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {
        uMap: { value: sigilTexture }, uColor: { value: new THREE.Color(opts.color ?? BLOOD.bone) },
        uReveal: { value: 0 }, uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; uniform float uReveal, uOpacity;
        varying vec2 vUv;
        void main() {
          float a = texture2D(uMap, vUv).a;
          vec2 p = vUv - 0.5;
          float sweep = fract(atan(p.x, p.y) / 6.28318530718);   // 0 at the top, clockwise
          float m = 1.0 - smoothstep(uReveal * 1.02 - 0.012, uReveal * 1.02, sweep);
          float o = a * m * uOpacity;
          if (o < 0.004) discard;
          gl_FragColor = vec4(uColor, o);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Draw-on progress 0..1. */
  get reveal() { return this._reveal; }
  set reveal(v: number) { this._reveal = v; this.mat.uniforms.uReveal.value = v; this.sync(); }
  /** Fade 0..1 (1 = fully visible). */
  get opacity() { return this._opacity; }
  set opacity(v: number) { this._opacity = v; this.mat.uniforms.uOpacity.value = v; this.sync(); }

  private sync() {
    this.mesh.visible = this._reveal > 0.002 && this._opacity > 0.004;
  }

  /** Places the crest: `normal` is the direction the face points (need not be normalised), `spin` turns it in its plane. */
  set(center: THREE.Vector3, normal: THREE.Vector3, radius: number, spin = 0) {
    this.mesh.position.copy(center);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
    this.mesh.quaternion.multiply(this.qz.setFromAxisAngle(new THREE.Vector3(0, 0, 1), spin));
    this.mesh.scale.setScalar(Math.max(radius, MIN_SCALE));
  }

  reset() {
    this.reveal = 0;
    this.opacity = 1;
  }
}
