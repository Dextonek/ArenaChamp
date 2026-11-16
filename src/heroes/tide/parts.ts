import * as THREE from 'three';

/**
 * The tide kit (pipeline/designs/kit-tide.md): thick smooth water ribbons with a deep underside, a shallow lighter top
 * and a soft foam gradient on the leading edge, small spinning-off teardrops that land in tiny splash rings, crown-shaped
 * foam splashes and a shallow ripple pool decal. Everything is pooled, takes world-space positions and has a `reset()`.
 * Materials are unlit toon shaders kept below the bloom threshold (~0.86); the white `core` is for tiny highlights only.
 */

/** Palette. Numbers for `THREE.Color`, `TIDE_CSS` for APIs that want a string. `foam` is the pale foil. */
export const TIDE = {
  core: 0xffffff,
  hot: 0xbff2ff,
  body: 0x1f9fd6,
  accent: 0xff9a6a,
  dark: 0x05253a,
  foam: 0xeaf8fb,
} as const;

export const TIDE_CSS = {
  core: '#ffffff',
  hot: '#bff2ff',
  body: '#1f9fd6',
  accent: '#ff9a6a',
  dark: '#05253a',
  foam: '#eaf8fb',
} as const;

const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------------------------------------
// Droplets
// ---------------------------------------------------------------------------------------------------------------

interface Drop { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; tone: number }
interface Ring { live: boolean; pos: THREE.Vector3; age: number; size: number }

const MAX_RINGS = 12;

function teardropGeometry() {
  // Lathe profile, belly at the bottom, the pointed tip on +Y.
  const prof = [[0, -0.5], [0.2, -0.46], [0.34, -0.3], [0.38, -0.1], [0.32, 0.12], [0.2, 0.34], [0.09, 0.56], [0, 0.82]];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 8);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.72 + 0.28 * clamp01((pos.getY(i) + 0.5) / 1.0); // darker belly, lighter tip
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/**
 * Instanced teardrops stretched along their velocity (tip trailing), under gravity. A drop that reaches the floor
 * lands in a tiny foam splash ring (rings capped at 12). `spray(pos, dir, count, speed)` throws a handful,
 * `drop(pos, vel, life, size)` places one. They live up to ~1 s. `frozen` holds them in the air (a dead beat).
 * `update(dt)` each frame. Add `mesh`.
 */
export class Droplets {
  readonly mesh = new THREE.Group();
  /** True: nothing moves (a dead beat). */
  frozen = false;
  gravity = 12;
  /** Floor drops make a splash ring when they land. */
  splash = true;
  private drops: Drop[] = [];
  private rings: Ring[] = [];
  private dMesh: THREE.InstancedMesh;
  private rMesh: THREE.InstancedMesh;
  private aR: THREE.InstancedBufferAttribute;
  private cursor = 0;
  private rCursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private d = new THREE.Vector3();
  private col = new THREE.Color();
  private tones = [new THREE.Color(TIDE.hot).multiplyScalar(0.92), new THREE.Color(TIDE.foam).multiplyScalar(0.9), new THREE.Color(TIDE.body)];

  constructor(maxDrops = 40) {
    this.dMesh = new THREE.InstancedMesh(teardropGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), maxDrops);
    this.dMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxDrops * 3), 3);
    this.dMesh.frustumCulled = false;
    this.dMesh.count = 0;
    for (let i = 0; i < maxDrops; i++) this.drops.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 0.1, tone: 0 });
    // Splash rings: flat soft foam rings.
    const rg = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.aR = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RINGS * 4), 4).setUsage(THREE.DynamicDrawUsage);
    rg.setAttribute('aS', this.aR);
    this.rMesh = new THREE.InstancedMesh(rg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: { uFoam: { value: new THREE.Color(TIDE.foam).multiplyScalar(0.92) }, uBody: { value: new THREE.Color(TIDE.hot) } },
      vertexShader: /* glsl */ `
        attribute vec4 aS; varying vec2 vUv; varying vec4 vS;
        void main() { vUv = uv; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uFoam, uBody; varying vec2 vUv; varying vec4 vS;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p), t = vS.x;
          float r0 = 0.25 + 0.7 * t;
          float d = abs(r - r0);
          float ring = 1.0 - smoothstep(0.05, 0.16, d);
          float a = ring * (1.0 - t) * 0.9;
          if (a < 0.02) discard;
          gl_FragColor = vec4(mix(uBody, uFoam, smoothstep(0.1, 0.0, d)), a);
        }`,
    }), MAX_RINGS);
    this.rMesh.frustumCulled = false;
    this.rMesh.count = 0;
    this.rMesh.renderOrder = 4;
    for (let i = 0; i < MAX_RINGS; i++) this.rings.push({ live: false, pos: new THREE.Vector3(), age: 0, size: 0.4 });
    this.mesh.add(this.rMesh, this.dMesh);
  }

  /** One drop from `pos` with velocity `vel`, living `life` seconds, `size` wide. */
  drop(pos: THREE.Vector3, vel: THREE.Vector3, life = 0.8, size = 0.12) {
    const dr = this.drops[this.cursor];
    this.cursor = (this.cursor + 1) % this.drops.length;
    dr.live = true;
    dr.pos.copy(pos);
    dr.vel.copy(vel);
    dr.age = 0;
    dr.life = life;
    dr.size = size;
    dr.tone = Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2;
  }

  /** `count` drops thrown from `pos` mostly along `dir` at about `speed`, scattered by about a third of it. */
  spray(pos: THREE.Vector3, dir: THREE.Vector3, count = 6, speed = 5) {
    for (let i = 0; i < count; i++) {
      this.d.copy(dir);
      if (this.d.lengthSq() < 1e-6) this.d.set(0, 1, 0);
      this.d.normalize().multiplyScalar(speed * (0.6 + Math.random() * 0.7));
      this.d.x += (Math.random() - 0.5) * speed * 0.7;
      this.d.y += Math.random() * speed * 0.3;
      this.d.z += (Math.random() - 0.5) * speed * 0.7;
      this.drop(pos, this.d, 0.5 + Math.random() * 0.5, 0.09 + Math.random() * 0.08);
    }
  }

  private ring(pos: THREE.Vector3, size: number) {
    const r = this.rings[this.rCursor];
    this.rCursor = (this.rCursor + 1) % MAX_RINGS;
    r.live = true;
    r.pos.copy(pos);
    r.pos.y = 0;
    r.age = 0;
    r.size = size;
  }

  reset() {
    for (const d of this.drops) d.live = false;
    for (const r of this.rings) r.live = false;
    this.frozen = false;
    this.dMesh.count = 0;
    this.rMesh.count = 0;
  }

  update(dt: number) {
    const dd = this.frozen ? 0 : dt;
    let n = 0;
    for (const dr of this.drops) {
      if (!dr.live) continue;
      dr.age += dd;
      if (dr.age >= dr.life) { dr.live = false; continue; }
      dr.vel.y -= this.gravity * dd;
      dr.pos.addScaledVector(dr.vel, dd);
      if (dr.pos.y < 0.04 && dr.vel.y < 0) {
        dr.live = false;
        if (this.splash) this.ring(dr.pos, 0.3 + Math.random() * 0.25);
        continue;
      }
      const sp = dr.vel.length();
      if (sp > 0.05) this.q.setFromUnitVectors(UP, this.d.copy(dr.vel).multiplyScalar(-1 / sp));
      else this.q.identity();
      const u = dr.age / dr.life;
      const sz = Math.max(dr.size * (1 - sstep(0.7, 1, u) * 0.8), MIN_SCALE);
      this.m.compose(dr.pos, this.q, this.s.set(sz, sz * (1 + Math.min(sp * 0.1, 1.6)), sz));
      this.dMesh.setMatrixAt(n, this.m);
      this.dMesh.setColorAt(n, this.col.copy(this.tones[dr.tone]));
      n++;
    }
    this.dMesh.count = n;
    this.dMesh.instanceMatrix.needsUpdate = true;
    if (this.dMesh.instanceColor) this.dMesh.instanceColor.needsUpdate = true;
    n = 0;
    const ra = this.aR.array as Float32Array;
    for (const r of this.rings) {
      if (!r.live) continue;
      r.age += dd;
      if (r.age >= 0.35) { r.live = false; continue; }
      this.m.compose(this.p.set(r.pos.x, 0.07, r.pos.z), this.q.identity(), this.s.setScalar(Math.max(r.size, MIN_SCALE)));
      this.rMesh.setMatrixAt(n, this.m);
      ra[n * 4] = r.age / 0.35;
      n++;
    }
    this.rMesh.count = n;
    this.rMesh.instanceMatrix.needsUpdate = true;
    this.aR.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// WaterRibbon
// ---------------------------------------------------------------------------------------------------------------

function ribbonMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uDark: { value: new THREE.Color(TIDE.dark) }, uBody: { value: new THREE.Color(TIDE.body) },
      uHot: { value: new THREE.Color(TIDE.hot).multiplyScalar(0.94) }, uFoam: { value: new THREE.Color(TIDE.foam).multiplyScalar(0.92) },
      uTime: { value: 0 }, uFoamLen: { value: 0.2 }, uAlpha: { value: 0.85 },
    },
    vertexShader: /* glsl */ `
      attribute float aLen; varying vec2 vUv; varying float vLen;
      void main() { vUv = uv; vLen = aLen; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uDark, uBody, uHot, uFoam; uniform float uTime, uFoamLen, uAlpha;
      varying vec2 vUv; varying float vLen;
      void main() {
        float ang = vUv.y * 6.2831853;
        float top = sin(ang);            // +1 shallow top, -1 deep underside
        float edge = abs(cos(ang));      // 1 at the rims
        vec3 col = mix(uDark, uBody, smoothstep(-1.0, 0.0, top));
        col = mix(col, uHot, smoothstep(0.25, 1.0, top) * 0.75);
        // Slow flowing bands along the length, soft.
        // Foam: a soft gradient band on the leading edge with a bubbly eroded fringe, plus a faint foam rim.
        float f = smoothstep(1.0 - uFoamLen, 1.0, vLen);
        float nz = 0.5 + 0.5 * sin(vUv.x * 9.0 + top * 4.0) * sin(vUv.x * 4.3 - top * 3.0 + 1.3);
        float foam = smoothstep(0.15, 0.75, f * 1.35 - nz * 0.32);
        foam = max(foam, edge * edge * 0.22 * smoothstep(0.3, 0.9, vLen));
        col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
        float a = mix(uAlpha, 0.95, foam);
        gl_FragColor = vec4(col, a);
      }`,
  });
}

/**
 * A thick smooth water band along a curve: a flattened tube with a deep underside, a lighter top and a soft foam
 * gradient on its head. `setFunction(fn, width, head, tail, time)` draws it along fn(u, out) (u 0..1) between `tail`
 * and `head` (call it every frame; both ends taper); `setPath(points, ...)` does the same along a Catmull-Rom curve.
 * Droplets shed from random points along it while it is visible (`shed` per second, thrown mostly outward from the
 * path): call `update(dt)` every frame. `hide()` / `reset()` hide it. Add `mesh`.
 */
export class WaterRibbon {
  readonly mesh = new THREE.Group();
  /** Droplets shed per second while visible (0 = none). */
  shed = 12;
  /** Fraction of the visible length, from the head, that carries the foam crest. */
  get foam() { return this.mat.uniforms.uFoamLen.value as number; }
  set foam(v: number) { this.mat.uniforms.uFoamLen.value = clamp01(v); }
  /** Thickness of the band relative to its width (default 0.3). */
  thickness = 0.3;
  /** Optional width multiplier along the length (0 tail .. 1 head). */
  profile: ((u: number) => number) | null = null;
  readonly drops: Droplets;
  private tube: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private uv: Float32Array;
  private len: Float32Array;
  private segs: number;
  private sides: number;
  private c: THREE.Vector3[] = [];
  private T: THREE.Vector3[] = [];
  private L: Float32Array;
  private B = new THREE.Vector3();
  private N = new THREE.Vector3();
  private prevB = new THREE.Vector3(1, 0, 0);
  private v = new THREE.Vector3();
  private w = new THREE.Vector3();
  private active = false;
  private acc = 0;

  constructor(segments = 30, sides = 10, maxDrops = 20) {
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
    this.pos = new Float32Array(rings * sides * 3);
    this.uv = new Float32Array(rings * sides * 2);
    this.len = new Float32Array(rings * sides);
    this.geo.setIndex(index);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aLen', new THREE.BufferAttribute(this.len, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = ribbonMaterial();
    this.tube = new THREE.Mesh(this.geo, this.mat);
    this.tube.frustumCulled = false;
    this.tube.visible = false;
    this.tube.renderOrder = 6;
    this.drops = new Droplets(maxDrops);
    this.mesh.add(this.tube, this.drops.mesh);
  }

  /** True: the droplets hang (a dead beat). The band itself is driven by whoever calls setFunction. */
  get frozen() { return this.drops.frozen; }
  set frozen(v: boolean) { this.drops.frozen = v; }

  hide() {
    this.tube.visible = false;
    this.active = false;
  }

  setPath(points: THREE.Vector3[], width: number, head = 1, tail = 0, time = 0) {
    const curve = new THREE.CatmullRomCurve3(points);
    this.setFunction((u, out) => curve.getPoint(u, out), width, head, tail, time);
  }

  setFunction(fn: (u: number, out: THREE.Vector3) => THREE.Vector3, width: number, head = 1, tail = 0, time = 0) {
    if (head - tail < 1e-3 || width < 1e-3) { this.hide(); return; }
    this.tube.visible = true;
    this.active = true;
    this.mat.uniforms.uTime.value = time;
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
    const hw = width / 2, hh = width * this.thickness * 0.5;
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
      // Full width soon after the tail, a blunter rounded head, a gentle swell along the middle.
      const tp = Math.sqrt(clamp01(this.L[k] / (hw * 1.8))) * Math.pow(clamp01((total - this.L[k]) / (hw * 0.9)), 0.4);
      const sw = (0.92 + 0.08 * Math.sin(this.L[k] * 1.3 + time * 4)) * Math.max(tp, 0);
      const pf = this.profile ? this.profile(this.L[k] / total) : 1;
      const rw = Math.max(hw * sw * pf, 1e-3), rh = Math.max(hh * sw * pf, 1e-3);
      for (let j = 0; j < sides; j++) {
        const ang = (j / sides) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const o = (k * sides + j) * 3, vi = k * sides + j;
        this.pos[o] = this.c[k].x + this.B.x * ca * rw + this.N.x * sa * rh;
        this.pos[o + 1] = this.c[k].y + this.B.y * ca * rw + this.N.y * sa * rh;
        this.pos[o + 2] = this.c[k].z + this.B.z * ca * rw + this.N.z * sa * rh;
        this.uv[vi * 2] = this.L[k]; this.uv[vi * 2 + 1] = j / sides;
        this.len[vi] = this.L[k] / total;
      }
    }
    for (const n of ['position', 'uv', 'aLen']) this.geo.attributes[n].needsUpdate = true;
  }

  reset() {
    this.hide();
    this.acc = 0;
    this.drops.reset();
  }

  update(dt: number) {
    if (this.active && this.shed > 0 && !this.drops.frozen) {
      this.acc += dt * this.shed;
      while (this.acc >= 1) {
        this.acc -= 1;
        // Mostly from the leading half, where the curls throw water.
        const k = Math.max(1, Math.min(this.segs - 1, Math.floor(this.segs * (1 - Math.pow(Math.random(), 1.6) * 0.8))));
        this.v.copy(this.c[k]);
        this.w.copy(this.T[k]).multiplyScalar(1.5);
        this.w.x += (Math.random() - 0.5) * 3;
        this.w.y += 1.2 + Math.random() * 2;
        this.w.z += (Math.random() - 0.5) * 3;
        this.drops.drop(this.v, this.w, 0.45 + Math.random() * 0.4, 0.08 + Math.random() * 0.07);
      }
    }
    this.drops.update(dt);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SplashCrown
// ---------------------------------------------------------------------------------------------------------------

function crownGeometry() {
  // Two rings of foam spikes (outer tall and varied, inner short) plus a flat foam ring on the floor.
  const pos: number[] = [], tt: number[] = [], flat: number[] = [], idx: number[] = [];
  const hsh = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const addSpike = (a0: number, a1: number, r0: number, h: number, flare: number, lean: number) => {
    // A blunt rounded finger: rows narrowing along a circular profile, a single soft tip.
    const am = (a0 + a1) / 2, hw = (a1 - a0) / 2, rows = [0, 0.5, 0.8, 0.95];
    const b = pos.length / 3;
    for (const y of rows) {
      const w = Math.sqrt(Math.max(1 - y * y, 0)) * hw;
      const rr = r0 * (1 + (flare - 1) * y);
      const ang = lean * y;
      pos.push(Math.cos(am - w + ang) * rr, y * h, Math.sin(am - w + ang) * rr, Math.cos(am + w + ang) * rr, y * h, Math.sin(am + w + ang) * rr);
      tt.push(y, y); flat.push(0, 0);
    }
    pos.push(Math.cos(am + lean) * r0 * flare, h, Math.sin(am + lean) * r0 * flare);
    tt.push(1); flat.push(0);
    for (let i = 0; i < rows.length - 1; i++) {
      const q = b + i * 2;
      idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
    }
    const q = b + (rows.length - 1) * 2;
    idx.push(q, q + 1, q + 2);
  };
  const nOut = 15;
  let a = 0;
  for (let i = 0; i < nOut; i++) {
    const wdt = (Math.PI * 2 / nOut) * (0.8 + hsh(i) * 0.5);
    addSpike(a, a + wdt * 1.15, 0.95, 0.75 + hsh(i + 7) * 0.75, 1.18 + hsh(i + 3) * 0.2, 0.05);
    a += wdt;
  }
  const nIn = 10;
  for (let i = 0; i < nIn; i++) {
    const a0 = (i / nIn) * Math.PI * 2 + 0.2;
    addSpike(a0, a0 + 0.55, 0.62, 0.45 + hsh(i + 20) * 0.45, 1.1, -0.04);
  }
  // Flat foam ring r 0.7..1.35.
  const M = 28;
  const b0 = pos.length / 3;
  for (let i = 0; i <= M; i++) {
    const an = (i / M) * Math.PI * 2;
    pos.push(Math.cos(an) * 0.45, 0.01, Math.sin(an) * 0.45, Math.cos(an) * 0.82, 0.01, Math.sin(an) * 0.82);
    tt.push(0, 0.5); flat.push(1, 1);
  }
  for (let i = 0; i < M; i++) {
    const a1 = b0 + i * 2;
    idx.push(a1, a1 + 1, a1 + 2, a1 + 1, a1 + 3, a1 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  geo.setAttribute('aFlat', new THREE.Float32BufferAttribute(flat, 1));
  geo.setIndex(idx);
  return geo;
}

const MAX_CROWNS = 3;

interface Crown { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; live: boolean; age: number; size: number; life: number }

/**
 * A crown-shaped foam splash on the floor: a ring of pointed foam spikes (two rows, uneven) over a flat foam ring,
 * body-blue at the base and white at the tips. `burst(pos, size)` (size = radius, about 1 for a person; pos.y lifts it,
 * e.g. a collar on a water column) shoots it up in
 * ~0.2 s and lets it sink and fade over `life` (default 0.8 s). Up to 3 at once. `frozen` holds time.
 * `update(dt)` each frame. Add `mesh`.
 */
export class SplashCrown {
  readonly mesh = new THREE.Group();
  frozen = false;
  /** Seconds a crown lives (default 0.8). */
  life = 0.8;
  private crowns: Crown[] = [];
  private cursor = 0;

  constructor() {
    const geo = crownGeometry();
    for (let i = 0; i < MAX_CROWNS; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
        uniforms: {
          uRise: { value: 0 }, uFade: { value: 1 }, uSize: { value: 1 },
          uBody: { value: new THREE.Color(TIDE.body) }, uHot: { value: new THREE.Color(TIDE.hot).multiplyScalar(0.94) },
          uFoam: { value: new THREE.Color(TIDE.foam).multiplyScalar(0.92) },
        },
        vertexShader: /* glsl */ `
          attribute float aT; attribute float aFlat; uniform float uRise, uSize; varying float vT; varying float vFlat;
          void main() {
            vT = aT; vFlat = aFlat;
            vec3 p = position;
            p.xz *= uSize * (0.35 + 0.65 * uRise);
            p.y *= uSize * uRise;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uFade; uniform vec3 uBody, uHot, uFoam; varying float vT; varying float vFlat;
          void main() {
            vec3 col = mix(uBody, uHot, smoothstep(0.25, 0.75, vT) * 0.7);
            col = mix(col, uFoam, smoothstep(0.78, 0.98, vT));
            float a = 0.8 * uFade;
            if (vFlat > 0.5) { col = mix(uBody, uHot, 0.65); a = 0.45 * uFade; }
            gl_FragColor = vec4(col, a);
          }`,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 7;
      this.mesh.add(mesh);
      this.crowns.push({ mesh, mat, live: false, age: 0, size: 1, life: 0.8 });
    }
  }

  burst(pos: THREE.Vector3, size = 1, life = this.life) {
    const c = this.crowns[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_CROWNS;
    c.live = true;
    c.age = 0;
    c.size = size;
    c.life = life;
    c.mesh.position.set(pos.x, pos.y + 0.03, pos.z);
    c.mesh.rotation.y = Math.random() * 6.28;
    c.mesh.visible = true;
  }

  reset() {
    for (const c of this.crowns) { c.live = false; c.mesh.visible = false; }
    this.frozen = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    for (const c of this.crowns) {
      if (!c.live) continue;
      c.age += d;
      if (c.age >= c.life) { c.live = false; c.mesh.visible = false; continue; }
      const u = c.age / c.life;
      const rise = easeOut(c.age / 0.2) * (1 - sstep(0.35, 1, u) * 0.75);
      c.mat.uniforms.uRise.value = Math.max(rise, MIN_SCALE);
      c.mat.uniforms.uSize.value = c.size;
      c.mat.uniforms.uFade.value = 1 - sstep(0.5, 1, u);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// WaterPool
// ---------------------------------------------------------------------------------------------------------------

const MAX_PRIPPLES = 6;

/**
 * A shallow ripple pool decal on the floor: an irregular dark-rimmed disc of body-blue water with a soft foam edge,
 * slow rings drifting outward and extra ripples on demand. `spread(center, radius, seconds)` grows it from the middle,
 * `ripple(pos)` drops one ring at a point (cap 6), `drain(seconds)` shrinks and fades it, `reset()` clears it.
 * `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class WaterPool {
  readonly mesh: THREE.Mesh;
  frozen = false;
  private mat: THREE.ShaderMaterial;
  private center = new THREE.Vector3();
  private radius = 1;
  private grow = 0;
  private growDur = 0.3;
  private drainAge = -1;
  private drainDur = 0.6;
  private live = false;
  private time = 0;
  private rip: THREE.Vector3[] = [];
  private ripAge: number[] = [];
  private rCursor = 0;

  constructor() {
    for (let i = 0; i < MAX_PRIPPLES; i++) { this.rip.push(new THREE.Vector3()); this.ripAge.push(-1); }
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {
        uDark: { value: new THREE.Color(TIDE.dark) }, uBody: { value: new THREE.Color(TIDE.body) },
        uHot: { value: new THREE.Color(TIDE.hot).multiplyScalar(0.94) }, uFoam: { value: new THREE.Color(TIDE.foam).multiplyScalar(0.92) },
        uCenter: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uFade: { value: 1 }, uTime: { value: 0 },
        uRip: { value: Array.from({ length: MAX_PRIPPLES }, () => new THREE.Vector3(0, 0, -1)) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vW;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uDark, uBody, uHot, uFoam; uniform vec2 uCenter; uniform float uRadius, uFade, uTime;
        uniform vec3 uRip[${MAX_PRIPPLES}]; varying vec2 vW;
        void main() {
          vec2 p = vW - uCenter;
          float r = length(p) / max(uRadius, 1e-3), a = atan(p.y, p.x);
          float lim = 0.92 + 0.05 * sin(a * 3.0 + 1.0) + 0.03 * sin(a * 7.0 + 2.0);
          float m = 1.0 - smoothstep(lim - 0.06, lim, r);
          if (m < 0.01) discard;
          vec3 col = mix(uBody * 0.85, uDark, smoothstep(0.5, 0.95, r) * 0.7);       // darker toward the rim
          // Slow rings drifting outward.
          float ring = sin(r * 12.0 - uTime * 2.4);
          col = mix(col, uHot, smoothstep(0.86, 1.0, ring) * 0.16 * (1.0 - smoothstep(0.7, 1.0, r)));
          // Extra ripples: one thin foam ring each.
          float rr = 0.0;
          for (int i = 0; i < ${MAX_PRIPPLES}; i++) {
            vec3 q = uRip[i];
            if (q.z < 0.0) continue;
            float d = abs(length(vW - q.xy) - (0.1 + 0.85 * q.z) * uRadius);
            rr = max(rr, (1.0 - smoothstep(0.02, 0.14, d)) * (1.0 - q.z));
          }
          col = mix(col, uFoam, rr * 0.8);
          // Soft foam rim.
          col = mix(col, uFoam, smoothstep(lim - 0.1, lim - 0.03, r) * 0.75);
          gl_FragColor = vec4(col, m * 0.72 * uFade);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
  }

  /** Grows the pool from the middle to `radius` around `center` over `seconds`. */
  spread(center: THREE.Vector3, radius: number, seconds = 0.3) {
    this.center.copy(center);
    this.radius = radius;
    this.grow = 0;
    this.growDur = Math.max(seconds, 0.05);
    this.drainAge = -1;
    this.live = true;
    this.mesh.visible = true;
    this.mesh.position.set(center.x, 0.04, center.z);
    this.mat.uniforms.uCenter.value.set(center.x, center.z);
  }

  /** One ring dropped at `pos` (a ground point). */
  ripple(pos: THREE.Vector3) {
    this.rip[this.rCursor].set(pos.x, pos.z, 0);
    this.ripAge[this.rCursor] = 0;
    this.rCursor = (this.rCursor + 1) % MAX_PRIPPLES;
  }

  /** Shrinks and fades the pool away over `seconds`. */
  drain(seconds = 0.6) {
    if (!this.live) return;
    this.drainAge = 0;
    this.drainDur = Math.max(seconds, 0.05);
  }

  reset() {
    this.live = false;
    this.mesh.visible = false;
    this.drainAge = -1;
    this.frozen = false;
    this.ripAge.fill(-1);
    this.mat.uniforms.uRip.value.forEach((v: THREE.Vector3) => v.set(0, 0, -1));
  }

  update(dt: number) {
    if (!this.live) return;
    const d = this.frozen ? 0 : dt;
    this.time += d;
    this.grow += d;
    if (this.drainAge >= 0) this.drainAge += d;
    const g = easeOut(this.grow / this.growDur);
    const k = this.drainAge < 0 ? 0 : clamp01(this.drainAge / this.drainDur);
    if (k >= 1) { this.live = false; this.mesh.visible = false; return; }
    const rad = Math.max(this.radius * (0.15 + 0.85 * g) * (1 - 0.25 * k), MIN_SCALE);
    this.mesh.scale.set(rad * 1.15, 1, rad * 1.15);
    this.mat.uniforms.uRadius.value = rad;
    this.mat.uniforms.uFade.value = 1 - k * k;
    this.mat.uniforms.uTime.value = this.time;
    const arr = this.mat.uniforms.uRip.value as THREE.Vector3[];
    for (let i = 0; i < MAX_PRIPPLES; i++) {
      if (this.ripAge[i] < 0) continue;
      this.ripAge[i] += d;
      const u = this.ripAge[i] / 0.7;
      if (u >= 1) { this.ripAge[i] = -1; arr[i].set(0, 0, -1); continue; }
      arr[i].set(this.rip[i].x, this.rip[i].y, u);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SerpentHead
// ---------------------------------------------------------------------------------------------------------------

/**
 * The head of the water serpent (the ultimate): a smooth toon skull and snout, a hinged lower jaw, a mane of foam
 * spikes swept back along the neck and two pale eye glints. Water-shaded (dark underside, body flanks, pale top, no
 * gloss). `place(pos, dir, scale, open)` puts it at `pos` looking along `dir` with the mouth `open` radians;
 * `hide()` / `reset()` hide it. Local frame: +Z forward, +Y up, about 2.4 long at scale 1. Add `mesh`.
 */
export class SerpentHead {
  readonly mesh = new THREE.Group();
  private jaw = new THREE.Group();
  private target = new THREE.Vector3();

  constructor() {
    const water = new THREE.ShaderMaterial({
      uniforms: {
        uDark: { value: new THREE.Color(TIDE.dark) }, uBody: { value: new THREE.Color(TIDE.body) },
        uHot: { value: new THREE.Color(TIDE.hot).multiplyScalar(0.9) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vUp;
        void main() {
          vN = normalize(normalMatrix * normal);
          vUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uDark, uBody, uHot; varying vec3 vN; varying vec3 vUp;
        void main() {
          float u = dot(normalize(vN), normalize(vUp));
          vec3 col = mix(uDark, uBody, smoothstep(-0.85, 0.05, u));
          col = mix(col, uHot, smoothstep(0.3, 0.95, u) * 0.8);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const ell = (sx: number, sy: number, sz: number, x: number, y: number, z: number, parent: THREE.Object3D) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), water);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    ell(0.68, 0.58, 1.2, 0, 0, 0, this.mesh); // skull
    ell(0.48, 0.36, 1.33, 0, -0.08, 1.4, this.mesh); // upper snout
    this.jaw.position.set(0, -0.32, 0.1);
    ell(0.44, 0.19, 1.4, 0, 0, 1.3, this.jaw); // lower jaw, hinged at the back
    this.mesh.add(this.jaw);
    // Mane: foam spikes swept back over the skull and neck, uneven.
    const mane = new THREE.ShaderMaterial({
      uniforms: {
        uBody: { value: new THREE.Color(TIDE.body) }, uFoam: { value: new THREE.Color(TIDE.foam).multiplyScalar(0.92) },
      },
      vertexShader: /* glsl */ `
        varying float vY;
        void main() { vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uFoam; varying float vY;
        void main() { gl_FragColor = vec4(mix(uBody, uFoam, smoothstep(0.78, 0.97, vY)), 1.0); }`,
    });
    const hs = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
    const tipDir = new THREE.Vector3();
    for (let i = 0; i < 7; i++) {
      const h = 0.4 + hs(i + 1) * 0.45, rad = 0.15 + hs(i + 9) * 0.08;
      const side = (hs(i + 30) - 0.5) * 0.4;
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.2, rad, h, 8), mane);
      const base = new THREE.Vector3(side, 0.5 - i * 0.04, 0.2 - i * 0.18);
      tipDir.set(side * 0.4, 0.05 + hs(i + 50) * 0.12, -1).normalize();
      cone.position.copy(base).addScaledVector(tipDir, h / 2);
      cone.quaternion.setFromUnitVectors(UP, tipDir);
      this.mesh.add(cone);
    }
    // Eye glints: pinpoint pale spheres, one each side.
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(TIDE.foam).multiplyScalar(0.92) });
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), eyeMat);
      e.scale.set(1, 0.8, 1.5);
      e.position.set(sx * 0.44, 0.2, 0.7);
      this.mesh.add(e);
    }
    this.mesh.visible = false;
    this.mesh.renderOrder = 8;
  }

  place(pos: THREE.Vector3, dir: THREE.Vector3, scale = 1, open = 0) {
    this.mesh.visible = true;
    this.mesh.position.copy(pos);
    this.mesh.scale.setScalar(Math.max(scale, MIN_SCALE));
    this.mesh.lookAt(this.target.copy(pos).add(dir));
    this.jaw.rotation.x = open;
  }

  hide() {
    this.mesh.visible = false;
  }

  reset() {
    this.hide();
    this.jaw.rotation.x = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Marin's v4 kit: the tide ring, the current streaks, the water disc, the coral spire and the moon halo
// ---------------------------------------------------------------------------------------------------------------

const hash1 = (i: number) => Math.abs(Math.sin(i * 78.233 + 1.7) * 43758.5453) % 1;
const frac = (x: number) => x - Math.floor(x);

function flatMat(color: number, opacity = 1, additive = false) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/**
 * The tide ring at her feet: a thin rim with eight chevrons that march OUTWARD in pale foam at High tide and INWARD in
 * deep blue at Low tide. `set(pos, high, opacity, time, radius)` each frame; opacity 0 hides it. Add `mesh`.
 */
export class TideRing {
  readonly mesh = new THREE.Group();
  private rim: THREE.Mesh;
  private chevrons: THREE.Mesh[] = [];
  private static readonly N = 8;

  constructor() {
    const rg = new THREE.RingGeometry(0.94, 1, 56);
    rg.rotateX(-Math.PI / 2);
    this.rim = new THREE.Mesh(rg, flatMat(TIDE.hot, 0));
    this.mesh.add(this.rim);
    const cs = new THREE.Shape();
    cs.moveTo(0.17, 0);
    cs.lineTo(-0.1, 0.12);
    cs.lineTo(-0.03, 0);
    cs.lineTo(-0.1, -0.12);
    cs.closePath();
    const cg = new THREE.ShapeGeometry(cs);
    cg.rotateX(-Math.PI / 2);
    for (let i = 0; i < TideRing.N; i++) {
      const m = new THREE.Mesh(cg, flatMat(TIDE.foam, 0));
      this.chevrons.push(m);
      this.mesh.add(m);
    }
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  set(pos: THREE.Vector3, high: boolean, opacity: number, time: number, radius = 1.2) {
    this.mesh.visible = opacity > 0.01;
    if (!this.mesh.visible) return;
    this.mesh.position.set(pos.x, 0.05, pos.z);
    this.rim.scale.setScalar(radius);
    const rm = this.rim.material as THREE.MeshBasicMaterial;
    rm.color.setHex(high ? TIDE.hot : TIDE.body);
    rm.opacity = 0.5 * opacity;
    const n = TideRing.N;
    for (let i = 0; i < n; i++) {
      const u = frac(time * 0.75 + i / n);
      const a = (i / n) * Math.PI * 2;
      const r = radius * (high ? 0.7 + 0.55 * u : 1.25 - 0.55 * u);
      const m = this.chevrons[i];
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.rotation.y = high ? -a : -a + Math.PI;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.setHex(high ? TIDE.foam : TIDE.body);
      mat.opacity = 0.95 * Math.sin(Math.PI * u) * opacity;
    }
  }

  hide() {
    this.mesh.visible = false;
  }
}

/**
 * Flowing streaks on the floor round a centre: darts of foam that fly OUTWARD (High tide) or darts of blue that spiral
 * INWARD (Low tide), each fading in and out along its run. `set(center, rMin, rMax, inward, strength, time)` each
 * frame; strength 0 hides it. Add `mesh`.
 */
export class TideCurrent {
  readonly mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private col = new THREE.Color();
  private n: number;

  constructor(n = 24) {
    this.n = n;
    const sh = new THREE.Shape();
    sh.moveTo(0.5, 0);
    sh.lineTo(-0.5, 0.16);
    sh.lineTo(-0.35, 0);
    sh.lineTo(-0.5, -0.16);
    sh.closePath();
    const g = new THREE.ShapeGeometry(sh);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.InstancedMesh(g, m, n);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, this.col.setRGB(0, 0, 0));
  }

  set(center: THREE.Vector3, rMin: number, rMax: number, inward: boolean, strength: number, time: number, speed = 0.9, len = 0.8) {
    this.mesh.visible = strength > 0.01;
    if (!this.mesh.visible) return;
    const base = inward ? 0x3ab8ea : TIDE.foam;
    for (let i = 0; i < this.n; i++) {
      const u = frac(time * speed * (0.8 + 0.4 * hash1(i + 11)) + hash1(i));
      const a0 = hash1(i + 3) * Math.PI * 2;
      const a = inward ? a0 + u * 0.8 : a0;
      const r = inward ? rMax + (rMin - rMax) * u : rMin + (rMax - rMin) * u;
      this.dummy.position.set(center.x + Math.cos(a) * r, 0.06 + i * 0.0004, center.z + Math.sin(a) * r);
      // Outward darts point away from the centre; inward ones point at it, bent along the spiral.
      this.dummy.rotation.set(0, inward ? -a + Math.PI - 0.5 : -a, 0);
      this.dummy.scale.set(len * (0.6 + 0.8 * hash1(i + 7)), 1, 0.8 + 0.6 * hash1(i + 5));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.col.setHex(base).multiplyScalar(Math.sin(Math.PI * u) * strength);
      this.mesh.setColorAt(i, this.col);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}

/**
 * A spinning disc of water: a flat lens with a dark underside, a lighter top, a foam rim and three foam arms that spin
 * round it. It rolls a little on its edge as it flies. `set(pos, scale, spin, high)`; scale 0 hides it. Add `mesh`.
 */
export class WaterDisc {
  readonly mesh = new THREE.Group();
  private spinner = new THREE.Group();
  private rim: THREE.Mesh;
  private arms: THREE.Mesh[] = [];
  private top: THREE.Mesh;

  constructor() {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 28), flatMat(TIDE.body, 0.92));
    const under = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.28, 0.1, 28), flatMat(TIDE.dark, 0.9));
    under.position.y = -0.08;
    const tg = new THREE.CircleGeometry(0.42, 28);
    tg.rotateX(-Math.PI / 2);
    this.top = new THREE.Mesh(tg, flatMat(TIDE.hot, 0.85));
    this.top.position.y = 0.045;
    const rg = new THREE.TorusGeometry(0.5, 0.045, 6, 36);
    rg.rotateX(Math.PI / 2);
    this.rim = new THREE.Mesh(rg, flatMat(TIDE.foam, 1));
    this.spinner.add(under, body, this.top, this.rim);
    for (let i = 0; i < 3; i++) {
      const ag = new THREE.RingGeometry(0.12, 0.4, 14, 1, (i * Math.PI * 2) / 3, 1.9);
      ag.rotateX(-Math.PI / 2);
      const arm = new THREE.Mesh(ag, flatMat(TIDE.foam, 0.95));
      arm.position.y = 0.055;
      this.arms.push(arm);
      this.spinner.add(arm);
    }
    this.mesh.add(this.spinner);
    this.mesh.visible = false;
  }

  set(pos: THREE.Vector3, scale: number, spin: number, high: boolean) {
    this.mesh.visible = scale > 0.02;
    if (!this.mesh.visible) return;
    this.mesh.position.copy(pos);
    this.mesh.scale.setScalar(scale);
    this.spinner.rotation.y = spin * 18;
    this.mesh.rotation.x = 0.3 + Math.sin(spin * 9) * 0.06;
    (this.rim.material as THREE.MeshBasicMaterial).color.setHex(high ? TIDE.foam : TIDE.hot);
    (this.top.material as THREE.MeshBasicMaterial).color.setHex(high ? TIDE.hot : 0x6fd0f2);
    for (const a of this.arms) (a.material as THREE.MeshBasicMaterial).color.setHex(high ? TIDE.foam : 0x3ab8ea);
  }

  hide() {
    this.mesh.visible = false;
  }
}

const CORAL_DEEP = new THREE.Color(0x8c3a4b);
const CORAL_MID = new THREE.Color(TIDE.accent);
const CORAL_TIP = new THREE.Color(0xffe6d6);

/** A tapered coral spike (base on y = 0) with vertex colours: deep red at the foot, coral, then a pale tip. */
function coralSpike(rBot: number, rTop: number, h: number, seg: number) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 3);
  g.translate(0, h / 2, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = clamp01(pos.getY(i) / h);
    if (k < 0.55) c.copy(CORAL_DEEP).lerp(CORAL_MID, k / 0.55);
    else c.copy(CORAL_MID).lerp(CORAL_TIP, (k - 0.55) / 0.45);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * A coral pillar: a tall central spike and seven leaning branches round a foam collar with a few sea-glass beads.
 * `grow(k)` raises it (0..1, with a small overshoot), `sink(k)` lowers it again, `opacity` fades it; the base stays
 * on the floor at the mesh's position. Add `mesh`.
 */
export class CoralSpire {
  readonly mesh = new THREE.Group();
  private pillar = new THREE.Group();
  private mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true });
  private collar: THREE.Mesh;
  private beads: THREE.Mesh[] = [];

  constructor() {
    this.pillar.add(new THREE.Mesh(coralSpike(0.8, 0.14, 4.0, 7), this.mat));
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const h = 1.3 + 1.0 * hash1(i + 2);
      const b = new THREE.Mesh(coralSpike(0.26 + 0.08 * hash1(i), 0.06, h, 6), this.mat);
      const tilt = 0.45 + 0.3 * hash1(i + 9);
      const dx = Math.cos(a), dz = Math.sin(a);
      b.position.set(dx * 0.5, 0.1 + i * 0.3, dz * 0.5);
      b.rotation.z = -tilt * dx;
      b.rotation.x = tilt * dz;
      this.pillar.add(b);
    }
    const cg = new THREE.TorusGeometry(0.95, 0.13, 6, 28);
    cg.rotateX(Math.PI / 2);
    this.collar = new THREE.Mesh(cg, flatMat(TIDE.foam, 0.95));
    this.collar.position.y = 0.08;
    for (let i = 0; i < 5; i++) {
      const bead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 + 0.05 * hash1(i), 0), flatMat(TIDE.hot, 0.8));
      const a = i * 1.3 + 0.4;
      bead.position.set(Math.cos(a) * 1.05, 0.14, Math.sin(a) * 1.05);
      this.beads.push(bead);
    }
    this.mesh.add(this.pillar, this.collar, ...this.beads);
    this.reset();
  }

  /** Rise progress 0..1: the pillar shoots up with a small overshoot and the collar splashes out. */
  grow(k: number) {
    const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // ease-out-back
    const h = Math.max(1e-3, k <= 0 ? 0 : e);
    const w = 0.35 + 0.65 * clamp01(k * 1.4);
    this.pillar.scale.set(w, h, w);
    this.collar.scale.setScalar(0.4 + 0.6 * easeOut(k));
    this.mesh.visible = k > 0;
  }

  /** Crumble progress 0..1: sinks into the floor and shrinks. */
  sink(k: number) {
    this.pillar.scale.set(1 - 0.3 * k, Math.max(1e-3, 1 - k * k), 1 - 0.3 * k);
    this.opacity = 1 - sstep(0.6, 1, k);
  }

  set opacity(v: number) {
    this.mat.opacity = v;
    (this.collar.material as THREE.MeshBasicMaterial).opacity = 0.95 * v;
    for (const b of this.beads) (b.material as THREE.MeshBasicMaterial).opacity = 0.8 * v;
    this.mesh.visible = v > 0.01;
  }

  /** Brightens the foot foam (a flare when it cracks). */
  flare(v: number) {
    (this.collar.material as THREE.MeshBasicMaterial).color.setHex(TIDE.foam).lerp(new THREE.Color(TIDE.accent), clamp01(v));
  }

  reset() {
    this.pillar.scale.set(0.35, 1e-3, 0.35);
    this.mat.opacity = 1;
    this.flare(0);
    this.mesh.visible = false;
  }
}

/** A pale moon disc over her head with a ring of orbiting sea-glass beads. `set(pos, size, opacity, time)`; opacity 0 hides it. */
export class MoonHalo {
  readonly mesh = new THREE.Group();
  private disc: THREE.Mesh;
  private ring: THREE.Mesh;
  private beads: THREE.Mesh[] = [];

  constructor() {
    const dg = new THREE.CircleGeometry(0.62, 32);
    dg.rotateX(-Math.PI / 2);
    this.disc = new THREE.Mesh(dg, flatMat(TIDE.foam, 0.85));
    const rg = new THREE.RingGeometry(0.78, 0.9, 40);
    rg.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(rg, flatMat(TIDE.hot, 0.7));
    // The crescent: a dark bite out of the disc.
    const bg = new THREE.CircleGeometry(0.5, 28);
    bg.rotateX(-Math.PI / 2);
    const bite = new THREE.Mesh(bg, flatMat(TIDE.dark, 0.85));
    bite.position.set(0.24, 0.01, -0.12);
    this.mesh.add(this.disc, bite, this.ring);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), flatMat(TIDE.hot, 0.9));
      this.beads.push(b);
      this.mesh.add(b);
    }
    this.mesh.visible = false;
  }

  set(pos: THREE.Vector3, size: number, opacity: number, time: number) {
    this.mesh.visible = opacity > 0.01 && size > 0.01;
    if (!this.mesh.visible) return;
    this.mesh.position.set(pos.x, pos.y + Math.sin(time * 2.2) * 0.06, pos.z);
    this.mesh.scale.setScalar(size);
    this.mesh.rotation.x = 0.35;
    this.mesh.rotation.y = time * 0.5;
    for (const o of [this.disc, this.ring]) (o.material as THREE.MeshBasicMaterial).opacity = (o === this.disc ? 0.85 : 0.7) * opacity;
    this.beads.forEach((b, i) => {
      const a = time * 1.6 + (i / this.beads.length) * Math.PI * 2;
      b.position.set(Math.cos(a) * 1.05, Math.sin(a * 2) * 0.1, Math.sin(a) * 1.05);
      (b.material as THREE.MeshBasicMaterial).opacity = 0.9 * opacity;
    });
  }

  hide() {
    this.mesh.visible = false;
  }
}
