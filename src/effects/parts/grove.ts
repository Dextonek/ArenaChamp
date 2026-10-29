import * as THREE from 'three';

/**
 * The grove kit (pipeline/designs/kit-grove.md): vines that coil in spirals (a lit tube with leaf pairs as two-tone
 * cards) and giant flowers that burst open at their tips (broad cream-and-pink petal cards opening to a cup, a gold
 * pollen core), then shed petals and pollen. Everything is pooled, takes world-space positions and has a `reset()`.
 * All materials are custom toon shaders with values below the bloom threshold (~0.85), pollen is a few soft additive
 * motes at low opacity.
 */

/** Palette (`GROVE_CSS` for APIs that want a string). `bark` is the pale foil (petal insides, pale bark, seed rings). */
export const GROVE = {
  core: 0xfffbe0,
  hot: 0xffe36a,
  body: 0x4caf50,
  accent: 0xff7ab8,
  dark: 0x14260f,
  bark: 0xe8dcc0,
} as const;

export const GROVE_CSS = {
  core: '#fffbe0',
  hot: '#ffe36a',
  body: '#4caf50',
  accent: '#ff7ab8',
  dark: '#14260f',
  bark: '#e8dcc0',
} as const;

const UP = new THREE.Vector3(0, 1, 0);
const MIN_SCALE = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const smooth = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function groveUniforms() {
  return {
    uBody: { value: new THREE.Color(GROVE.body) },
    uDark: { value: new THREE.Color(GROVE.dark) },
    uHot: { value: new THREE.Color(GROVE.hot) },
    uCore: { value: new THREE.Color(GROVE.core) },
    uBark: { value: new THREE.Color(GROVE.bark) },
    uAccent: { value: new THREE.Color(GROVE.accent) },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Petal geometry and material (shared by Bloom and Petals)
// ---------------------------------------------------------------------------------------------------------------

/**
 * One broad petal card: base at the origin, length 1 along +Y, width about 1 along X, cupped across and with the tip
 * curled back outward (+Z is the outside face, the winding makes it the front face).
 */
function petalGeometry(lenSegs = 6, widSegs = 4) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= lenSegs; i++) {
    const v = i / lenSegs;
    const w = 0.5 * Math.pow(Math.max(Math.sin(Math.PI * (0.05 + 0.9 * v)), 0), 0.7) * Math.sqrt(Math.max(1 - Math.pow(v, 6), 0));
    for (let j = 0; j <= widSegs; j++) {
      const s = (j / widSegs) * 2 - 1;
      pos.push(s * w, v, -0.12 * s * s * Math.min(1, v * 3) + 0.16 * v * v * v);
      uv.push(j / widSegs, v);
    }
  }
  for (let i = 0; i < lenSegs; i++) {
    for (let j = 0; j < widSegs; j++) {
      const a = i * (widSegs + 1) + j, b = a + 1, c = a + widSegs + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** Inside face: cream with a gold base, a pink vein and a pink rim. Outside face: pink over a green base. */
function petalMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: groveUniforms(),
    vertexShader: /* glsl */ `
      attribute float aTone;
      varying vec2 vUv; varying float vTone;
      void main() {
        vUv = uv; vTone = aTone;
        gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uBark, uAccent;
      varying vec2 vUv; varying float vTone;
      void main() {
        float side = abs(vUv.x * 2.0 - 1.0);
        float edge = max(side, 1.0 - (1.0 - vUv.y) * 4.0);
        bool rim = edge > 0.84;
        vec3 col;
        if (gl_FrontFacing) {
          // Outside: pink, darker toward the base, a green base.
          col = uAccent * (vUv.y < 0.55 ? 0.66 : 0.86);
          if (vUv.y < 0.2) col = uBody * 0.8;
          if (rim && vUv.y > 0.2) col = uAccent * 1.0;
        } else {
          // Inside: cream foil, gold at the base, a pink centre vein, a pink rim.
          col = uBark * 0.97;
          if (vUv.y < 0.2) col = uHot * 0.86;
          else if (vUv.y < 0.3) col = mix(uBark * 0.97, uHot * 0.86, 0.4);
          if (side < 0.07 && vUv.y > 0.25 && vUv.y < 0.82) col = mix(col, uAccent * 0.9, 0.7);
          if (abs(side - 0.5) < 0.035 && vUv.y > 0.3 && vUv.y < 0.7) col = mix(col, uAccent * 0.85, 0.4);
          if (rim) col = uAccent * 0.95;
        }
        col *= 1.0 - 0.07 * vTone;
        if (edge > 0.97) col = uDark * 2.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function leafMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...groveUniforms(), uWither: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uBark; uniform float uWither;
      varying vec2 vUv;
      void main() {
        float x = vUv.x, y = vUv.y - 0.5;
        float h = 0.5 * pow(max(sin(3.14159265 * pow(x, 0.75)), 0.0), 0.8);
        if (abs(y) > h || x < 0.01) discard;
        vec3 col = y > 0.0 ? uBody * 1.12 : uBody * 0.7;
        if (abs(y) < 0.035) col = uBark * 0.7;
        if (abs(y) > h - 0.05) col = uDark * 2.6;
        col = mix(col, (uDark * 1.6 + uBark * 0.1) * (y > 0.0 ? 1.0 : 0.75), uWither);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// SpiralVine
// ---------------------------------------------------------------------------------------------------------------

type PathFn = (u: number, out: THREE.Vector3) => THREE.Vector3;

export interface GrowOptions {
  /** Radius of the coil around the axis (default 0.35). */
  coilRadius?: number;
  /** Start angle of the coil (radians). */
  phase?: number;
  /** Seconds to wait before it starts to grow. */
  delay?: number;
}

function vineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...groveUniforms(), uWither: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vNv; varying vec2 vUv;
      void main() {
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vNv = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uBark; uniform float uWither;
      varying vec3 vN; varying vec3 vNv; varying vec2 vUv;
      void main() {
        vec3 n = normalize(vN), nv = normalize(vNv);
        float f = 1.0 - abs(nv.z);
        float up = n.y;
        vec3 col = uBody * 0.9;
        col = mix(col, uBody * 1.38, step(0.7, up));
        col = mix(col, uDark * 2.2, smoothstep(0.25, -0.05, up) * 0.8);
        col = mix(col, uDark * 1.6, step(up, -0.35));
        // Node rings across the length, a thin pale spiral line.
        col = mix(col, col * 0.7, step(0.9, fract(vUv.x * 1.8)));
        col = mix(col, uBark * 0.75, step(0.93, fract(vUv.x * 0.9 + vUv.y)) * step(0.0, up) * 0.55);
        vec3 dry = (uDark * 1.6 + uBark * 0.12) * (0.7 + 0.5 * max(up, 0.0));
        col = mix(col, dry, uWither);
        if (f > 0.84) col = uDark * 1.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/**
 * A thick vine that coils in a spiral and carries leaf pairs (flat two-tone cards). `grow(base, dir, length, coils,
 * width, seconds, opts)` grows it along a coiling axis; `growAlong(fn, width, seconds, delay)` grows it along any path
 * fn(u, out), u 0..1 (call it from the spell, it is re-sampled every frame). `wither(seconds, delay)` browns it and
 * sinks it into the floor; it hides itself when done. `pointAt(u, out)` gives a world point on the path (the tip of a
 * grown vine is `pointAt(1)`), `reset()` hides it. Call `update(dt)` every frame. Add `mesh`.
 */
export class SpiralVine {
  readonly mesh = new THREE.Group();
  /** How deep it sinks when withered. */
  sinkDepth = 1.3;
  private tube: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private mat = vineMaterial();
  private leafMat = leafMaterial();
  private leaves: THREE.InstancedMesh;
  private pos: Float32Array;
  private nrm: Float32Array;
  private uv: Float32Array;
  private segs: number;
  private sides: number;
  private maxPairs: number;
  private c: THREE.Vector3[] = [];
  private T: THREE.Vector3[] = [];
  private L: Float32Array;
  private B = new THREE.Vector3();
  private N = new THREE.Vector3();
  private prevB = new THREE.Vector3(1, 0, 0);
  private path: PathFn = (u, out) => out.set(0, u, 0);
  private width = 0.3;
  private headU = 0;
  private growAge = -1;
  private growDur = 0.5;
  private growDelay = 0;
  private witherAge = -1;
  private witherDur = 0.5;
  private witherDelay = 0;
  private wth = 0;
  private live = false;
  private m = new THREE.Matrix4();
  private p0 = new THREE.Vector3();
  private p1 = new THREE.Vector3();
  private tt = new THREE.Vector3();
  private bb = new THREE.Vector3();
  private nn = new THREE.Vector3();
  private dd = new THREE.Vector3();
  private xv = new THREE.Vector3();
  private yv = new THREE.Vector3();
  private zv = new THREE.Vector3();

  constructor(segments = 36, sides = 6, maxLeafPairs = 7) {
    this.segs = segments;
    this.sides = sides;
    this.maxPairs = maxLeafPairs;
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
    this.pos = new Float32Array(rings * sides * 3);
    this.nrm = new Float32Array(rings * sides * 3);
    this.uv = new Float32Array(rings * sides * 2);
    this.geo.setIndex(index);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    this.tube = new THREE.Mesh(this.geo, this.mat);
    this.tube.frustumCulled = false;
    this.tube.visible = false;
    this.mesh.add(this.tube);
    this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), this.leafMat, maxLeafPairs * 2);
    this.leaves.frustumCulled = false;
    this.leaves.count = 0;
    this.mesh.add(this.leaves);
  }

  get head() { return this.headU; }
  get active() { return this.live; }

  /** Grows along a coiling axis from `base` in direction `dir`. */
  grow(base: THREE.Vector3, dir: THREE.Vector3, length: number, coils: number, width: number, seconds = 0.5, opts: GrowOptions = {}) {
    const d = dir.clone().normalize();
    const p1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
    const p2 = new THREE.Vector3().crossVectors(d, p1).normalize();
    const b = base.clone();
    const R = opts.coilRadius ?? 0.35;
    const phase = opts.phase ?? 0;
    this.growAlong((u, out) => {
      const a = phase + coils * Math.PI * 2 * u;
      const env = Math.min(1, u * 5) * (1 - 0.2 * u * u);
      return out.copy(b).addScaledVector(d, length * u)
        .addScaledVector(p1, Math.cos(a) * R * env).addScaledVector(p2, Math.sin(a) * R * env);
    }, width, seconds, opts.delay ?? 0);
  }

  growAlong(fn: PathFn, width: number, seconds = 0.5, delay = 0) {
    this.path = fn;
    this.width = width;
    this.growDur = Math.max(seconds, 1e-3);
    this.growDelay = delay;
    this.growAge = 0;
    this.headU = 0;
    this.witherAge = -1;
    this.wth = 0;
    this.live = true;
    this.mesh.position.y = 0;
    this.mat.uniforms.uWither.value = 0;
    this.leafMat.uniforms.uWither.value = 0;
  }

  /** Browns, shrinks and sinks over `seconds` after `delay`, then hides. */
  wither(seconds = 0.5, delay = 0) {
    this.witherDur = Math.max(seconds, 1e-3);
    this.witherDelay = delay;
    this.witherAge = 0;
  }

  pointAt(u: number, out: THREE.Vector3) {
    this.path(clamp01(u), out);
    out.y += this.mesh.position.y;
    return out;
  }

  reset() {
    this.live = false;
    this.growAge = -1;
    this.witherAge = -1;
    this.headU = 0;
    this.wth = 0;
    this.tube.visible = false;
    this.leaves.count = 0;
    this.mesh.position.y = 0;
  }

  update(dt: number) {
    if (!this.live) return;
    if (this.growAge >= 0) {
      this.growAge += dt;
      const k = clamp01((this.growAge - this.growDelay) / this.growDur);
      this.headU = 1 - (1 - k) * (1 - k);
    }
    if (this.witherAge >= 0) {
      this.witherAge += dt;
      this.wth = smooth((this.witherAge - this.witherDelay) / this.witherDur);
      if (this.wth >= 1) { this.reset(); return; }
      this.mat.uniforms.uWither.value = this.wth;
      this.leafMat.uniforms.uWither.value = this.wth;
      this.mesh.position.y = -this.wth * this.sinkDepth;
    }
    this.rebuild();
  }

  private rebuild() {
    const S = this.segs, sides = this.sides, head = this.headU;
    if (head < 0.012) { this.tube.visible = false; this.leaves.count = 0; return; }
    this.tube.visible = true;
    for (let k = 0; k <= S; k++) this.path(head * (k / S), this.c[k]);
    this.L[0] = 0;
    for (let k = 1; k <= S; k++) this.L[k] = this.L[k - 1] + this.c[k].distanceTo(this.c[k - 1]);
    for (let k = 0; k <= S; k++) {
      this.T[k].subVectors(this.c[Math.min(S, k + 1)], this.c[Math.max(0, k - 1)]);
      if (this.T[k].lengthSq() < 1e-12) this.T[k].set(0, 1, 0);
      this.T[k].normalize();
    }
    const hw = this.width / 2;
    const shrink = 1 - 0.75 * this.wth;
    this.prevB.set(1, 0, 0);
    for (let k = 0; k <= S; k++) {
      const T = this.T[k];
      this.B.crossVectors(T, UP);
      const bl = this.B.length();
      if (bl < 0.2) this.B.copy(this.prevB);
      else { this.B.multiplyScalar(1 / bl); if (this.B.dot(this.prevB) < 0) this.B.negate(); }
      this.N.crossVectors(this.B, T).normalize();
      this.B.crossVectors(T, this.N);
      this.prevB.copy(this.B);
      const u = head * (k / S);
      const flare = 1 + 0.5 * (1 - clamp01(u / 0.12));
      const tip = Math.sqrt(clamp01((1 - k / S) / 0.1));
      const r = Math.max(hw * (1 - 0.3 * u) * flare * tip * shrink, 1e-3);
      for (let j = 0; j < sides; j++) {
        const ang = (j / sides) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const o = (k * sides + j) * 3, vi = k * sides + j;
        const nx = this.B.x * ca + this.N.x * sa, ny = this.B.y * ca + this.N.y * sa, nz = this.B.z * ca + this.N.z * sa;
        this.pos[o] = this.c[k].x + nx * r;
        this.pos[o + 1] = this.c[k].y + ny * r;
        this.pos[o + 2] = this.c[k].z + nz * r;
        this.nrm[o] = nx; this.nrm[o + 1] = ny; this.nrm[o + 2] = nz;
        this.uv[vi * 2] = this.L[k]; this.uv[vi * 2 + 1] = j / sides;
      }
    }
    for (const n of ['position', 'normal', 'uv']) this.geo.attributes[n].needsUpdate = true;

    // Leaf pairs at fixed points along the path; each pops out once the head has passed it.
    let n = 0;
    for (let j = 0; j < this.maxPairs; j++) {
      const uj = 0.06 + 0.9 * ((j + 1) / (this.maxPairs + 1));
      if (uj > head - 0.01) break;
      const g = easeOut((head - uj) / 0.2) * (1 - 0.5 * this.wth);
      if (g < 0.02) continue;
      this.path(uj, this.p0);
      this.path(Math.min(1, uj + 0.012), this.p1);
      this.tt.subVectors(this.p1, this.p0);
      if (this.tt.lengthSq() < 1e-10) this.tt.set(0, 1, 0);
      this.tt.normalize();
      this.bb.crossVectors(this.tt, UP);
      if (this.bb.lengthSq() < 0.04) this.bb.set(1, 0, 0);
      this.bb.normalize().applyAxisAngle(this.tt, j * 2.2);
      this.nn.crossVectors(this.bb, this.tt).normalize();
      const rad = this.width * 0.45;
      const len = Math.max(0.45, this.width * 2.6) * (0.85 + 0.3 * hash(j + 3)) * g;
      for (let sgn = -1; sgn <= 1; sgn += 2) {
        this.dd.set(0, 0, 0).addScaledVector(this.bb, 0.85 * sgn).addScaledVector(this.nn, 0.25).addScaledVector(this.tt, 0.5).normalize();
        this.xv.copy(this.dd).multiplyScalar(len);
        this.yv.copy(this.tt).addScaledVector(this.dd, -this.tt.dot(this.dd)).normalize().multiplyScalar(len * 0.55);
        this.zv.crossVectors(this.dd, this.yv).normalize();
        this.m.makeBasis(this.xv, this.yv, this.zv);
        this.m.setPosition(this.p0.x + this.bb.x * sgn * rad, this.p0.y + this.bb.y * sgn * rad, this.p0.z + this.bb.z * sgn * rad);
        this.leaves.setMatrixAt(n++, this.m);
      }
    }
    this.leaves.count = n;
    this.leaves.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Bloom
// ---------------------------------------------------------------------------------------------------------------

const OUTER = 6;
const INNER = 5;

function coreMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: groveUniforms(),
    vertexShader: /* glsl */ `
      varying vec3 vP;
      void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHot, uDark, uCore, uBark;
      varying vec3 vP;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float r = length(vP.xz);
        vec3 col = r > 0.6 ? uHot * 0.7 : uHot * 0.92;
        vec2 g = floor(vP.xz * 7.0);
        float h = h2(g);
        if (h > 0.78 && r < 0.9) col = uDark * 3.0;
        if (r < 0.1) col = uBark;
        if (r > 0.94) col = uDark * 2.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/**
 * A giant flower: two rings of broad petal cards (6 outer, 5 inner) around a gold pollen core, opening to a cup (never
 * past ~40° from the stem) and closing to a bud. `open(pos, size, seconds)` grows and opens it (size = petal length),
 * `close(seconds)` folds it back to a bud, `shed(seconds)` lets the petals drift down one after another and then hides
 * it, `hide()` / `reset()` remove it. `aim(yaw, lean)` tips the cup toward a ground direction (atan2(dx, dz)); `flatten`
 * (0..1) splays the petals flat for a slam; `kick` (0..1) is a quick scale pulse. `pos` can be moved by the spell.
 * Call `update(dt)` every frame. Add `mesh`.
 */
export class Bloom {
  readonly mesh = new THREE.Group();
  readonly pos = new THREE.Vector3();
  size = 1;
  /** 0..1 extra splay to the ground (a slam); resting open petals stay within ~40°. */
  flatten = 0;
  /** 0..1 quick scale pulse. */
  kick = 0;
  private petalMesh: THREE.InstancedMesh;
  private core: THREE.Mesh;
  private grow = 0;
  private openAmt = 0;
  private openAge = -1;
  private openDur = 0.4;
  private closeAge = -1;
  private closeDur = 0.3;
  private closeFrom = 0;
  private shedAge = -1;
  private shedDur = 0.6;
  private live = false;
  private lean = 0;
  private leanYaw = 0;
  private m = new THREE.Matrix4();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private qc = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private ax = new THREE.Vector3();
  private YA = new THREE.Vector3(0, 1, 0);
  private XA = new THREE.Vector3(1, 0, 0);

  constructor() {
    const geo = petalGeometry(6, 4);
    const tone = new Float32Array(OUTER + INNER);
    for (let i = OUTER; i < OUTER + INNER; i++) tone[i] = 1;
    geo.setAttribute('aTone', new THREE.InstancedBufferAttribute(tone, 1));
    this.petalMesh = new THREE.InstancedMesh(geo, petalMaterial(), OUTER + INNER);
    this.petalMesh.frustumCulled = false;
    this.petalMesh.count = 0;
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), coreMaterial());
    this.core.position.y = 0.05;
    this.core.frustumCulled = false;
    this.mesh.add(this.petalMesh, this.core);
    this.mesh.visible = false;
  }

  get visible() { return this.live; }

  open(pos: THREE.Vector3, size: number, seconds = 0.4) {
    this.pos.copy(pos);
    this.size = size;
    this.openDur = Math.max(seconds, 1e-3);
    this.openAge = 0;
    this.closeAge = -1;
    this.shedAge = -1;
    this.grow = 0;
    this.openAmt = 0;
    this.flatten = 0;
    this.kick = 0;
    this.live = true;
    this.build();
  }

  close(seconds = 0.3) {
    this.closeDur = Math.max(seconds, 1e-3);
    this.closeFrom = this.openAmt;
    this.closeAge = 0;
    this.openAge = -1;
  }

  shed(seconds = 0.6) {
    this.shedDur = Math.max(seconds, 1e-3);
    this.shedAge = 0;
  }

  /** Tips the cup toward a ground direction (`yaw` = atan2(dx, dz)) by `lean` radians. */
  aim(yaw: number, lean: number) {
    this.leanYaw = yaw;
    this.lean = lean;
  }

  hide() {
    this.live = false;
    this.mesh.visible = false;
    this.petalMesh.count = 0;
  }

  reset() {
    this.hide();
    this.openAge = this.closeAge = this.shedAge = -1;
    this.grow = this.openAmt = this.flatten = this.kick = this.lean = 0;
  }

  update(dt: number) {
    if (!this.live) return;
    if (this.openAge >= 0) {
      this.openAge += dt;
      const k = clamp01(this.openAge / this.openDur);
      this.grow = easeOut(k / 0.55);
      this.openAmt = smooth((k - 0.2) / 0.8);
    }
    if (this.closeAge >= 0) {
      this.closeAge += dt;
      this.openAmt = this.closeFrom * (1 - smooth(this.closeAge / this.closeDur));
    }
    if (this.shedAge >= 0) {
      this.shedAge += dt;
      if (this.shedAge >= this.shedDur) { this.hide(); return; }
    }
    this.build();
  }

  private build() {
    const grow = this.grow;
    this.mesh.visible = this.live && grow > 0.004;
    if (!this.mesh.visible) return;
    this.mesh.position.copy(this.pos);
    this.mesh.scale.setScalar(Math.max(this.size * grow * (1 + 0.22 * this.kick), MIN_SCALE));
    this.ax.set(Math.cos(this.leanYaw), 0, -Math.sin(this.leanYaw));
    this.mesh.quaternion.setFromAxisAngle(this.ax, this.lean);
    const total = OUTER + INNER;
    const shedK = this.shedAge >= 0 ? this.shedAge / this.shedDur : -1;
    let n = 0;
    for (let ring = 0; ring < 2; ring++) {
      const cnt = ring === 0 ? OUTER : INNER;
      const len = ring === 0 ? 1 : 0.62;
      const wid = ring === 0 ? 0.62 : 0.55;
      const ro = ring === 0 ? 0.16 : 0.09;
      const closed = ring === 0 ? -0.1 : -0.07;
      const opened = ring === 0 ? 0.66 : 0.38;
      const delayOpen = ring === 0 ? 0 : 0.12;
      for (let i = 0; i < cnt; i++) {
        const ip = ring === 0 ? i : OUTER + i;
        const yaw = (i / cnt) * Math.PI * 2 + (ring === 0 ? 0 : Math.PI / cnt + 0.2) + 0.15 * hash(ip);
        let ang = closed + (opened - closed) * smooth((this.openAmt - delayOpen) / (1 - delayOpen));
        ang += this.flatten * (1.48 - ang);
        let out = ro, down = 0, roll = 0, sc = 1;
        if (shedK >= 0) {
          const prog = clamp01((shedK - (ip / total) * 0.45) / 0.55);
          if (prog > 0) {
            ang += prog * 0.7;
            out += prog * 0.5;
            down = prog * prog * 1.7;
            roll = prog * (ip % 2 ? 2.4 : -2.4);
            sc = 1 - smooth((prog - 0.72) / 0.28);
          }
        }
        this.qa.setFromAxisAngle(this.YA, yaw);
        this.qb.setFromAxisAngle(this.XA, ang);
        this.qc.setFromAxisAngle(this.YA, roll);
        this.qa.multiply(this.qb).multiply(this.qc);
        this.p.set(0, -down, out).applyAxisAngle(this.YA, yaw);
        this.s.set(Math.max(len * wid * sc, MIN_SCALE), Math.max(len * sc, MIN_SCALE), Math.max(len * sc, MIN_SCALE));
        this.m.compose(this.p, this.qa, this.s);
        this.petalMesh.setMatrixAt(n++, this.m);
      }
    }
    this.petalMesh.count = n;
    this.petalMesh.instanceMatrix.needsUpdate = true;
    // The pollen core: shows once the petals part, shrinks away at the end of a shed.
    let cs = 0.26 * clamp01(this.openAmt * 2.2);
    if (shedK >= 0) cs *= 1 - smooth((shedK - 0.7) / 0.3);
    this.core.visible = cs > 0.01;
    this.core.scale.set(Math.max(cs, MIN_SCALE), Math.max(cs * 0.5, MIN_SCALE), Math.max(cs, MIN_SCALE));
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Petals
// ---------------------------------------------------------------------------------------------------------------

interface Petal {
  live: boolean; ballistic: boolean; pos: THREE.Vector3; vel: THREE.Vector3; axis: THREE.Vector3;
  spin: number; age: number; life: number; size: number; ph: number;
}

/**
 * Instanced falling and spinning petals (cream inside, pink outside) with a short life. `burst(pos, count, speed)`
 * throws them out and up, `rain(center, radius, count, height, life)` lets them fall over a disc, `stream(from, to,
 * count, seconds)` flies a short stream that lands at `to`. Cap = `max`, oldest recycled. `update(dt)` every frame.
 * Add `mesh`.
 */
export class Petals {
  readonly mesh: THREE.InstancedMesh;
  /** Burst petal life range (seconds). */
  life = 1.2;
  private petals: Petal[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(max = 40) {
    const geo = petalGeometry(4, 3);
    geo.setAttribute('aTone', new THREE.InstancedBufferAttribute(new Float32Array(max).fill(2), 1));
    this.mesh = new THREE.InstancedMesh(geo, petalMaterial(), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.petals.push({
        live: false, ballistic: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0),
        spin: 0, age: 0, life: 1, size: 0.4, ph: 0,
      });
    }
  }

  private next() {
    const p = this.petals[this.cursor];
    this.cursor = (this.cursor + 1) % this.petals.length;
    p.live = true; p.ballistic = false; p.age = 0; p.ph = Math.random() * 6.28;
    p.axis.randomDirection();
    p.spin = (Math.random() - 0.5) * 12;
    p.size = 0.34 + Math.random() * 0.22;
    return p;
  }

  burst(pos: THREE.Vector3, count: number, speed = 4) {
    for (let i = 0; i < count; i++) {
      const p = this.next();
      const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 0.8;
      const sp = speed * (0.45 + Math.random() * 0.55);
      p.pos.copy(pos);
      p.vel.set(Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * 0.9 + 1, Math.sin(a) * Math.cos(e) * sp);
      p.life = this.life * (0.8 + Math.random() * 0.4);
    }
  }

  rain(center: THREE.Vector3, radius: number, count: number, height = 5, life = 1.5) {
    for (let i = 0; i < count; i++) {
      const p = this.next();
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      p.pos.set(center.x + Math.cos(a) * r, center.y + height * (0.5 + Math.random() * 0.5), center.z + Math.sin(a) * r);
      p.vel.set((Math.random() - 0.5) * 0.8, -(1.2 + Math.random() * 1.2), (Math.random() - 0.5) * 0.8);
      p.life = life * (0.8 + Math.random() * 0.4);
    }
  }

  /** A short stream of petals from `from` that arrives at `to` after `seconds`. */
  stream(from: THREE.Vector3, to: THREE.Vector3, count: number, seconds = 0.25) {
    const g = -6;
    for (let i = 0; i < count; i++) {
      const p = this.next();
      const T = seconds * (0.85 + Math.random() * 0.3);
      p.ballistic = true;
      p.pos.copy(from);
      p.pos.x += (Math.random() - 0.5) * 0.25; p.pos.z += (Math.random() - 0.5) * 0.25;
      p.vel.set(
        (to.x - p.pos.x) / T + (Math.random() - 0.5) * 0.6,
        (to.y - p.pos.y) / T - 0.5 * g * T + (Math.random() - 0.5) * 0.6,
        (to.z - p.pos.z) / T + (Math.random() - 0.5) * 0.6,
      );
      p.life = T;
      p.size = 0.3 + Math.random() * 0.15;
      p.age = -i * 0.025;
    }
  }

  reset() {
    for (const p of this.petals) p.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const p of this.petals) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) { p.live = false; continue; }
      if (p.ballistic) {
        p.vel.y += -6 * dt;
      } else {
        p.vel.y += -3.4 * dt;
        const drag = Math.max(0, 1 - 1.5 * dt);
        p.vel.x *= drag; p.vel.z *= drag;
        if (p.vel.y < -2.2) p.vel.y = -2.2;
        p.pos.x += Math.sin(p.age * 5 + p.ph) * 0.5 * dt;
      }
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.06) { p.pos.y = 0.06; p.vel.set(0, 0, 0); }
      const u = p.age / p.life;
      const sc = p.size * Math.min(1, p.age * 12) * (p.ballistic ? 1 : 1 - smooth((u - 0.7) / 0.3));
      this.q.setFromAxisAngle(p.axis, p.age * p.spin);
      this.m.compose(p.pos, this.q, this.s.set(Math.max(sc * 0.6, MIN_SCALE), Math.max(sc, MIN_SCALE), Math.max(sc, MIN_SCALE)));
      this.mesh.setMatrixAt(k++, this.m);
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Pollen
// ---------------------------------------------------------------------------------------------------------------

interface Mote { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; ph: number; wander: number }

/**
 * Few small soft gold motes (additive at low opacity). `puff(pos, count)` bursts them outward and up, `drift(center,
 * radius, count)` hangs them over a disc and lets them sink slowly. `update(dt)` every frame. Add `mesh`.
 */
export class Pollen {
  readonly mesh: THREE.InstancedMesh;
  private motes: Mote[] = [];
  private cursor = 0;
  private aAlpha: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(max = 48) {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    geo.setAttribute('aAlpha', this.aAlpha);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uHot: { value: new THREE.Color(GROVE.hot) }, uCore: { value: new THREE.Color(GROVE.core) } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying vec2 vP; varying float vA;
        void main() {
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sc = length(instanceMatrix[0].xyz);
          c.xy += position.xy * sc;
          vP = position.xy; vA = aAlpha;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uHot, uCore;
        varying vec2 vP; varying float vA;
        void main() {
          float r = length(vP);
          float a = (1.0 - smoothstep(0.25, 1.0, r)) * vA * 0.5;
          if (a < 0.01) discard;
          vec3 col = r < 0.2 ? uCore * 0.9 : uHot * 0.8;
          gl_FragColor = vec4(col, a);
        }`,
    }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 7;
    for (let i = 0; i < max; i++) {
      this.motes.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 0.1, ph: 0, wander: 0 });
    }
  }

  private next() {
    const p = this.motes[this.cursor];
    this.cursor = (this.cursor + 1) % this.motes.length;
    p.live = true; p.age = 0; p.ph = Math.random() * 6.28;
    p.size = 0.07 + Math.random() * 0.07;
    return p;
  }

  puff(pos: THREE.Vector3, count = 8) {
    for (let i = 0; i < count; i++) {
      const p = this.next();
      const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 1.4;
      p.pos.copy(pos);
      p.vel.set(Math.cos(a) * sp, 0.3 + Math.random() * 1.2, Math.sin(a) * sp);
      p.life = 0.7 + Math.random() * 0.5;
      p.wander = 0.3;
    }
  }

  drift(center: THREE.Vector3, radius: number, count = 10, height = 4, life = 2.2) {
    for (let i = 0; i < count; i++) {
      const p = this.next();
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      p.pos.set(center.x + Math.cos(a) * r, center.y + 0.6 + Math.random() * height, center.z + Math.sin(a) * r);
      p.vel.set(0, -0.25 - Math.random() * 0.3, 0);
      p.life = life * (0.8 + Math.random() * 0.4);
      p.wander = 0.6;
    }
  }

  reset() {
    for (const p of this.motes) p.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const p of this.motes) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) { p.live = false; continue; }
      const drag = Math.max(0, 1 - 1.8 * dt);
      p.vel.x *= drag; p.vel.z *= drag;
      p.vel.y = p.vel.y * drag + (1 - drag) * -0.3;
      p.pos.addScaledVector(p.vel, dt);
      p.pos.x += Math.sin(p.age * 2.2 + p.ph) * p.wander * dt;
      p.pos.z += Math.cos(p.age * 1.9 + p.ph) * p.wander * dt;
      if (p.pos.y < 0.08) { p.live = false; continue; }
      const u = p.age / p.life;
      this.m.compose(p.pos, this.q, this.s.setScalar(Math.max(p.size, MIN_SCALE)));
      this.mesh.setMatrixAt(k, this.m);
      this.aAlpha.setX(k, Math.pow(Math.sin(Math.PI * u), 0.6));
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// RootRing
// ---------------------------------------------------------------------------------------------------------------

/**
 * A ground decal of roots spreading from a point over a dark soil patch with a leafy rim: ten main roots with
 * branches, each root with a dark outline, green body and a pale bark line. `spread(center, radius, seconds)` grows it,
 * `fade(seconds, delay)` fades it out. `update(dt)` every frame. Add `mesh`.
 */
export class RootRing {
  readonly mesh: THREE.Mesh;
  /** Height above the floor. */
  y = 0.05;
  private mat: THREE.ShaderMaterial;
  private spreadDur = 0.4;
  private spreadAge = -1;
  private clock = 0;
  private fadeFrom = -1;
  private fadeDur = 0.5;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { ...groveUniforms(), uReveal: { value: 0 }, uOpacity: { value: 1 }, uSeed: { value: Math.random() * 6 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uDark, uBark; uniform float uReveal, uOpacity, uSeed;
        varying vec2 vUv;
        float h1(float n) { return fract(sin(n * 127.1 + uSeed * 3.7) * 43758.5453); }
        float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);
          const float PI = 3.14159265;
          // Dark soil patch with a leafy, uneven rim.
          float lump = 1.0 + 0.07 * sin(a * 5.0 + uSeed) + 0.04 * sin(a * 11.0 + uSeed * 2.0);
          float R0 = 0.8 * lump * smoothstep(0.0, 0.45, uReveal);
          float soil = 1.0 - smoothstep(R0 - 0.03, R0, r);
          vec3 col = uDark * 1.7;
          float alpha = soil * 0.66;
          if (h2(floor(p * 38.0)) > 0.975) col = uBark * 0.6;
          float tooth = sin(a * 26.0 + uSeed * 4.0);
          if (r > R0 - 0.07 && r < R0 && tooth > 0.35) { col = uBody * 0.8; alpha = 0.9 * step(0.001, uReveal); }
          // Ten main roots, each in its own angular cell, wobbling and tapering to a tip.
          float cw = 2.0 * PI / 10.0;
          float id = floor((a + PI) / cw);
          float ac = (id + 0.5) * cw - PI + (h1(id) - 0.5) * 0.5 * cw + 0.2 * cw * sin(r * 9.0 + id * 2.3);
          float d = r * abs(a - ac);
          float len = 0.62 + 0.36 * h1(id + 7.0);
          float tipR = len * clamp(uReveal * 1.15, 0.0, 1.0);
          float w = mix(0.06, 0.014, clamp(r / len, 0.0, 1.0)) * (0.85 + 0.3 * h1(id + 3.0));
          bool root = d < w && r < tipR && r > 0.03;
          // Fine branches in narrower cells that start partway out.
          float cw2 = 2.0 * PI / 30.0;
          float id2 = floor((a + PI) / cw2);
          float ac2 = (id2 + 0.5) * cw2 - PI + 0.3 * cw2 * sin(r * 14.0 + id2 * 1.7);
          float d2 = r * abs(a - ac2);
          float st = 0.26 + 0.38 * h1(id2 + 11.0);
          float bl = 0.16 + 0.2 * h1(id2 + 5.0);
          float bEnd = st + bl * clamp(uReveal * 1.3 - 0.25, 0.0, 1.0);
          float w2 = 0.013 * (1.0 - clamp((r - st) / bl, 0.0, 1.0) * 0.8);
          bool branch = h1(id2 + 1.0) > 0.5 && r > st && r < bEnd && d2 < w2;
          if (root || branch) {
            float wd = root ? w : w2;
            float dd = root ? d : d2;
            col = uBody * 0.95;
            if (dd > wd * 0.66) col = uDark * 2.4;
            else if (root && dd < wd * 0.22 && fract(r * 9.0 + id) < 0.6) col = uBark * 0.85;
            alpha = 1.0;
          }
          alpha *= uOpacity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    this.mesh.position.y = this.y;
  }

  /** Grows from `center` out to `radius` (world units) over `seconds`; restarts the fade clock. */
  spread(center: THREE.Vector3, radius: number, seconds = 0.4) {
    this.mesh.position.set(center.x, this.y, center.z);
    this.mesh.scale.setScalar(Math.max(radius, MIN_SCALE));
    this.spreadDur = Math.max(seconds, 0.05);
    this.spreadAge = 0;
    this.clock = 0;
    this.fadeFrom = -1;
    this.mat.uniforms.uSeed.value = Math.random() * 6;
    this.mat.uniforms.uOpacity.value = 1;
  }

  fade(seconds = 0.5, delay = 0) {
    this.fadeDur = Math.max(seconds, 0.05);
    this.fadeFrom = this.clock + delay;
  }

  reset() {
    this.spreadAge = -1;
    this.fadeFrom = -1;
    this.mesh.visible = false;
  }

  update(dt: number) {
    if (this.spreadAge < 0) { this.mesh.visible = false; return; }
    this.spreadAge += dt;
    this.clock += dt;
    const alpha = this.fadeFrom < 0 ? 1 : 1 - clamp01((this.clock - this.fadeFrom) / this.fadeDur);
    this.mesh.visible = alpha > 0.004;
    this.mat.uniforms.uReveal.value = easeOut(this.spreadAge / this.spreadDur);
    this.mat.uniforms.uOpacity.value = alpha;
  }
}
