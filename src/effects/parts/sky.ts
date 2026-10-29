import * as THREE from 'three';

/**
 * The sky kit (pipeline/designs/kit-sky.md): sharp pale wind crescents (flat sickles with a hot leading edge, a mint
 * body and a thin dark inner edge, tapering to needle tips), thin translucent spiral gust ribbons with speed-line
 * streaks, short camera-facing speed lines and a few small tumbling two-tone leaves. Everything is pooled, takes
 * world-space positions and has a `reset()`. Materials are unlit and kept below the bloom threshold (~0.86).
 */

/** Palette. Numbers for `THREE.Color`, `SKY_CSS` for APIs that want a string. `cloud` is the pale foil. */
export const SKY = {
  core: 0xffffff,
  hot: 0xe6fff6,
  body: 0x7fe6c8,
  accent: 0xff8fb0,
  dark: 0x0d2a2a,
  cloud: 0xeef3f6,
} as const;

export const SKY_CSS = {
  core: '#ffffff',
  hot: '#e6fff6',
  body: '#7fe6c8',
  accent: '#ff8fb0',
  dark: '#0d2a2a',
  cloud: '#eef3f6',
} as const;

const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const dim = (hex: number, k = 0.92) => new THREE.Color(hex).multiplyScalar(k);

// ---------------------------------------------------------------------------------------------------------------
// WindCrescent
// ---------------------------------------------------------------------------------------------------------------

const CR_SEGS = 40;

function crescentGeometry() {
  // A strip of (u along the arc, v from the outer leading edge to the inner edge); the shader bends it into a sickle.
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= CR_SEGS; i++) {
    const u = i / CR_SEGS;
    pos.push(u, 0, 0, u, 1, 0);
  }
  for (let i = 0; i < CR_SEGS; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}

interface Slash {
  live: boolean; age: number; life: number; sweep: number; pos: THREE.Vector3; yaw: number; tilt: number;
  radius: number; span: number; width: number; tone: number; spin: number; rise: number;
}

export interface SlashOptions {
  /** Width of the crescent at its middle, world units (default max(0.15, 18% of the radius); never under 0.15). */
  width?: number;
  /** Sweep on from the other end. */
  reverse?: boolean;
  /** 0 = mint, 1 = blossom pink. */
  tone?: number;
  /** Radians per second the crescent turns about its own centre (a whirl). */
  spin?: number;
  /** Metres per second it drifts up. */
  rise?: number;
  /** Seconds the sweep-on takes (default 0.16). */
  sweep?: number;
}

/**
 * Pooled wind crescents: flat unlit sickles (hot leading edge, mint body, thin dark inner edge, needle tips).
 * `slash(center, dir, radius, arcDeg, tilt, seconds, opts)` sweeps one on along its arc, lets it hang and fades it over
 * `seconds`. The arc is centred on `dir` (horizontal heading), bows that way, and is rolled by `tilt` radians about
 * `dir` (0 = flat, pi/2 = standing up in the plane of `dir` and up). Immediate mode for swarms: call `put(...)` every
 * frame AFTER `update(dt)`; puts last one frame. `frozen` holds time (a dead beat). Add `mesh`.
 */
export class WindCrescent {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private slashes: Slash[] = [];
  private cursor = 0;
  private cap: number;
  private n = 0;
  private aS: THREE.InstancedBufferAttribute;
  private aT: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(maxSlashes = 10, maxPuts = 0) {
    this.cap = maxSlashes + maxPuts;
    const geo = crescentGeometry();
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aT = new THREE.InstancedBufferAttribute(new Float32Array(this.cap), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aS', this.aS);
    geo.setAttribute('aTone', this.aT);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uCore: { value: dim(SKY.core, 0.95) }, uHot: { value: dim(SKY.hot) }, uBody: { value: new THREE.Color(SKY.body) },
        uAccent: { value: new THREE.Color(SKY.accent) }, uDark: { value: new THREE.Color(SKY.dark) },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aS; attribute float aTone;
        varying vec2 vUv; varying vec4 vS; varying float vTone;
        void main() {
          float u = position.x, v = position.y;
          float a = (u - 0.5) * aS.z;
          float taper = pow(max(sin(3.14159265 * u), 0.0), 0.8);
          float r = 1.0 - v * aS.w * taper;
          vec3 p = vec3(sin(a) * r, 0.0, cos(a) * r);
          vUv = vec2(u, v); vS = aS; vTone = aTone;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore, uHot, uBody, uAccent, uDark;
        varying vec2 vUv; varying vec4 vS; varying float vTone;
        void main() {
          float u = vUv.x, v = vUv.y;
          float head = vS.x;
          float vis = 1.0 - smoothstep(head - 0.07, head, u);
          float behind = clamp(head - u, 0.0, 1.5);
          float a = vS.y * vis * (1.0 - 0.5 * smoothstep(0.35, 1.2, behind));
          if (a < 0.02) discard;
          vec3 col = mix(uHot, uBody, smoothstep(0.08, 0.5, v));
          col = mix(col, uAccent, vTone * smoothstep(0.1, 0.35, v));
          col = mix(col, uDark, smoothstep(0.8, 0.95, v));
          float glow = exp(-(head - u) * 9.0) * step(u, head) * (1.0 - step(1.05, head));
          col = mix(col, uCore, glow * 0.7 * (1.0 - smoothstep(0.5, 0.9, v)));
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 6;
    for (let i = 0; i < maxSlashes; i++) {
      this.slashes.push({
        live: false, age: 0, life: 1, sweep: 0.16, pos: new THREE.Vector3(), yaw: 0, tilt: 0, radius: 1, span: 1, width: 0.2,
        tone: 0, spin: 0, rise: 0,
      });
    }
  }

  /** One sweeping slash (see the class note). `dir` is a heading; only its horizontal part counts. */
  slash(center: THREE.Vector3, dir: THREE.Vector3, radius: number, arcDeg: number, tilt: number, seconds: number, opts: SlashOptions = {}) {
    const s = this.slashes[this.cursor];
    this.cursor = (this.cursor + 1) % this.slashes.length;
    s.live = true;
    s.age = 0;
    s.life = Math.max(seconds, 0.05);
    s.sweep = Math.min(opts.sweep ?? 0.16, s.life * 0.6);
    s.pos.copy(center);
    s.yaw = Math.atan2(dir.x, dir.z);
    s.tilt = tilt;
    s.radius = Math.max(radius, MIN_SCALE);
    s.span = THREE.MathUtils.degToRad(arcDeg) * (opts.reverse ? -1 : 1);
    s.width = Math.max(opts.width ?? radius * 0.18, 0.15);
    s.tone = opts.tone ?? 0;
    s.spin = opts.spin ?? 0;
    s.rise = opts.rise ?? 0;
  }

  /**
   * Immediate mode: draws one crescent this frame only. `yaw` is the heading (atan2(x, z)) the arc bows toward, `head` how
   * much of the arc has swept on (0..1.1), `opacity` 0..1, `width` its middle width in world units.
   */
  put(pos: THREE.Vector3, yaw: number, tilt: number, radius: number, arcDeg: number, head = 1.1, opacity = 1, width?: number, tone = 0) {
    if (this.n >= this.cap || opacity < 0.01) return;
    this.write(this.n++, pos, yaw, tilt, radius, THREE.MathUtils.degToRad(arcDeg), head, opacity, width ?? radius * 0.18, tone);
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aS.needsUpdate = true;
    this.aT.needsUpdate = true;
  }

  private write(i: number, pos: THREE.Vector3, yaw: number, tilt: number, radius: number, span: number, head: number, op: number, width: number, tone: number) {
    this.q.setFromAxisAngle(UP, yaw);
    this.qb.setFromAxisAngle(AXIS_Z, tilt);
    this.q.multiply(this.qb);
    const r = Math.max(radius, MIN_SCALE);
    this.m.compose(pos, this.q, this.s.setScalar(r));
    this.mesh.setMatrixAt(i, this.m);
    const a = this.aS.array as Float32Array;
    a[i * 4] = head;
    a[i * 4 + 1] = op;
    a[i * 4 + 2] = span;
    a[i * 4 + 3] = Math.min(Math.max(width, 0.15) / r, 0.7);
    (this.aT.array as Float32Array)[i] = tone;
  }

  reset() {
    for (const s of this.slashes) s.live = false;
    this.frozen = false;
    this.n = 0;
    this.mesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    this.n = 0;
    for (const s of this.slashes) {
      if (!s.live) continue;
      s.age += d;
      if (s.age >= s.life) { s.live = false; continue; }
      const u = s.age / s.life;
      const head = 1.1 * easeOut(s.age / s.sweep);
      const op = 1 - sstep(0.5, 1, u);
      this.p.copy(s.pos);
      this.p.y += s.rise * s.age;
      this.write(this.n++, this.p, s.yaw + s.spin * s.age, s.tilt, s.radius * (1 + 0.06 * u), s.span, head, op, s.width, s.tone);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aS.needsUpdate = true;
    this.aT.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// GustRibbon
// ---------------------------------------------------------------------------------------------------------------

/**
 * A thin translucent wind ribbon along a curve: a camera-facing strip (mint body, hot centre line, faint dark rim) with
 * speed-line streaks flowing along it and a bright head. `setFunction(fn, width, head, tail, time, opacity)` draws it
 * along fn(u, out) (u 0..1) between `tail` and `head` (call it every frame; both ends taper to needle points; width
 * is kept at 0.08 or more). `spiral(center, radius, height, turns, seconds)` and `along(points, width, seconds)` run a
 * self-driven version: it grows on, then the tail eats it and it fades over `seconds`. `update(dt)` each frame,
 * `hide()` / `reset()` hide it, `frozen` holds a timed ribbon. Add `mesh`.
 */
export class GustRibbon {
  readonly mesh: THREE.Mesh;
  frozen = false;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.ShaderMaterial;
  private pos: Float32Array;
  private tan: Float32Array;
  private uv: Float32Array;
  private side: Float32Array;
  private segs: number;
  private c: THREE.Vector3[] = [];
  private t = new THREE.Vector3();
  private timed: ((u: number, out: THREE.Vector3) => THREE.Vector3) | null = null;
  private timedWidth = 0.2;
  private age = 0;
  private dur = 1;

  constructor(segments = 40) {
    this.segs = segments;
    const rings = segments + 1;
    for (let i = 0; i < rings; i++) this.c.push(new THREE.Vector3());
    this.pos = new Float32Array(rings * 2 * 3);
    this.tan = new Float32Array(rings * 2 * 3);
    this.uv = new Float32Array(rings * 2 * 2);
    this.side = new Float32Array(rings * 2);
    const index: number[] = [];
    for (let i = 0; i < segments; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(index);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aTan', new THREE.BufferAttribute(this.tan, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSide', new THREE.BufferAttribute(this.side, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uBody: { value: new THREE.Color(SKY.body) }, uHot: { value: dim(SKY.hot) }, uDark: { value: new THREE.Color(SKY.dark) },
        uCloud: { value: dim(SKY.cloud) }, uOp: { value: 1 }, uTime: { value: 0 }, uLen: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aTan; attribute float aSide; varying vec2 vUv;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 T = normalize(mat3(modelMatrix) * aTan + vec3(1e-6));
          vec3 V = cameraPosition - wp.xyz;
          vec3 S = normalize(cross(T, V) + vec3(1e-6));
          wp.xyz += S * aSide;
          vUv = uv;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody, uHot, uDark, uCloud; uniform float uOp, uTime, uLen; varying vec2 vUv;
        void main() {
          float u = vUv.x, v = vUv.y;
          float c = 1.0 - abs(v * 2.0 - 1.0);
          float streak = smoothstep(0.35, 0.9, sin(v * 22.0 + sin(u * uLen * 0.9 - uTime * 6.0) * 1.6 + u * uLen * 1.7));
          vec3 col = mix(uBody, uHot, smoothstep(0.3, 1.0, c));
          col = mix(col, uCloud, streak * 0.45);
          col = mix(col, uDark, smoothstep(0.32, 0.0, c) * 0.6);
          float head = smoothstep(0.85, 1.0, u);
          col = mix(col, uHot, head * 0.6);
          float a = (smoothstep(0.0, 0.3, c) * (0.55 + 0.3 * streak) + head * 0.15) * uOp;
          if (a < 0.02) discard;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;
  }

  hide() {
    this.mesh.visible = false;
    this.timed = null;
  }

  setFunction(fn: (u: number, out: THREE.Vector3) => THREE.Vector3, width: number, head = 1, tail = 0, time = 0, opacity = 1) {
    if (head - tail < 1e-3 || width < 1e-3 || opacity < 0.01) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const S = this.segs;
    const hw = Math.max(width, 0.08) / 2;
    let len = 0;
    for (let k = 0; k <= S; k++) {
      fn(tail + (head - tail) * (k / S), this.c[k]);
      if (k > 0) len += this.c[k].distanceTo(this.c[k - 1]);
    }
    for (let k = 0; k <= S; k++) {
      this.t.subVectors(this.c[Math.min(S, k + 1)], this.c[Math.max(0, k - 1)]);
      if (this.t.lengthSq() < 1e-12) this.t.set(0, 1, 0);
      this.t.normalize();
      const w = hw * Math.pow(Math.max(Math.sin(Math.PI * (k / S)), 0), 0.6);
      for (let j = 0; j < 2; j++) {
        const vi = k * 2 + j;
        this.pos[vi * 3] = this.c[k].x; this.pos[vi * 3 + 1] = this.c[k].y; this.pos[vi * 3 + 2] = this.c[k].z;
        this.tan[vi * 3] = this.t.x; this.tan[vi * 3 + 1] = this.t.y; this.tan[vi * 3 + 2] = this.t.z;
        this.uv[vi * 2] = k / S; this.uv[vi * 2 + 1] = j;
        this.side[vi] = j === 0 ? -w : w;
      }
    }
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uLen.value = len;
    this.mat.uniforms.uOp.value = opacity;
    for (const n of ['position', 'aTan', 'uv', 'aSide']) this.geo.attributes[n].needsUpdate = true;
  }

  /** A self-driven ribbon spiralling up round a vertical axis at `center` (center.y is the base). */
  spiral(center: THREE.Vector3, radius: number, height: number, turns: number, seconds: number, width = 0.24) {
    const c = center.clone();
    const a0 = Math.random() * Math.PI * 2;
    this.start((u, out) => {
      const a = a0 + u * turns * Math.PI * 2 + this.age * 4;
      const r = radius * (1 - 0.35 * u);
      return out.set(c.x + Math.cos(a) * r, c.y + u * height, c.z + Math.sin(a) * r);
    }, width, seconds);
  }

  /** A self-driven ribbon along a smooth curve through `points`. */
  along(points: THREE.Vector3[], width: number, seconds: number) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => p.clone()));
    this.start((u, out) => curve.getPoint(u, out), width, seconds);
  }

  private start(fn: (u: number, out: THREE.Vector3) => THREE.Vector3, width: number, seconds: number) {
    this.timed = fn;
    this.timedWidth = width;
    this.age = 0;
    this.dur = Math.max(seconds, 0.05);
    this.draw();
  }

  private draw() {
    if (!this.timed) return;
    const k = this.age / this.dur;
    const head = easeOut(k / 0.45);
    const tail = 0.96 * Math.pow(sstep(0.5, 1, k), 1.3);
    this.setFunction(this.timed, this.timedWidth * (1 - 0.3 * sstep(0.5, 1, k)), Math.max(head, 0.02), tail, this.age, 1 - sstep(0.7, 1, k));
  }

  reset() {
    this.hide();
    this.frozen = false;
  }

  update(dt: number) {
    if (!this.timed) return;
    if (!this.frozen) this.age += dt;
    if (this.age >= this.dur) { this.hide(); return; }
    this.draw();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SpeedLines
// ---------------------------------------------------------------------------------------------------------------

interface Streak { live: boolean; age: number; life: number; start: THREE.Vector3; dir: THREE.Vector3; speed: number; len: number; thick: number }

/**
 * Short camera-facing wind streaks that fly along a direction (pale tail, hot head, 0.08 or more wide). `burst(pos, dir,
 * count, length)` throws a fan of them forward from `pos`; `sweep(a, b, count, length)` lays them along the segment
 * a to b, flying toward b (a dash). Life 0.25 to 0.5 s. `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class SpeedLines {
  readonly mesh: THREE.Mesh;
  frozen = false;
  private streaks: Streak[] = [];
  private cursor = 0;
  private geo = new THREE.InstancedBufferGeometry();
  private aH: THREE.InstancedBufferAttribute;
  private aT: THREE.InstancedBufferAttribute;
  private h = new THREE.Vector3();
  private v = new THREE.Vector3();
  private w = new THREE.Vector3();
  private perp = new THREE.Vector3();

  constructor(max = 48) {
    const base = new Float32Array([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0]);
    this.geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    this.geo.setIndex([0, 1, 2, 1, 3, 2]);
    this.aH = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aT = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aH', this.aH);
    this.geo.setAttribute('aT', this.aT);
    this.geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uCloud: { value: dim(SKY.cloud) }, uHot: { value: dim(SKY.hot) }, uBody: { value: new THREE.Color(SKY.body) } },
      vertexShader: /* glsl */ `
        attribute vec4 aH; attribute vec4 aT; varying vec2 vUv; varying float vOp;
        void main() {
          float x = position.x, y = position.y;
          vec3 P = mix(aT.xyz, aH.xyz, x);
          vec3 T = normalize(aH.xyz - aT.xyz + vec3(1e-5));
          vec3 V = cameraPosition - P;
          vec3 S = normalize(cross(T, V) + vec3(1e-6));
          P += S * y * aH.w * mix(0.15, 1.0, smoothstep(0.0, 0.8, x));
          vUv = vec2(x, y); vOp = aT.w;
          gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCloud, uHot, uBody; varying vec2 vUv; varying float vOp;
        void main() {
          float a = vOp * pow(vUv.x, 0.7) * (1.0 - smoothstep(0.55, 1.0, abs(vUv.y)));
          if (a < 0.02) discard;
          vec3 col = mix(uBody, uCloud, smoothstep(0.0, 0.5, vUv.x));
          col = mix(col, uHot, smoothstep(0.7, 1.0, vUv.x));
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 7;
    for (let i = 0; i < max; i++) this.streaks.push({ live: false, age: 0, life: 0.3, start: new THREE.Vector3(), dir: new THREE.Vector3(), speed: 18, len: 1, thick: 0.05 });
  }

  private spawn(start: THREE.Vector3, dir: THREE.Vector3, speed: number, len: number, life: number, thick: number) {
    const s = this.streaks[this.cursor];
    this.cursor = (this.cursor + 1) % this.streaks.length;
    s.live = true;
    s.age = 0;
    s.life = life;
    s.start.copy(start);
    s.dir.copy(dir);
    s.speed = speed;
    s.len = len;
    s.thick = thick;
  }

  burst(pos: THREE.Vector3, dir: THREE.Vector3, count = 8, length = 1.6) {
    this.v.copy(dir).setY(dir.y).normalize();
    if (this.v.lengthSq() < 1e-6) this.v.set(0, 0, 1);
    this.perp.set(-this.v.z, 0, this.v.x);
    for (let i = 0; i < count; i++) {
      this.w.copy(pos)
        .addScaledVector(this.perp, (Math.random() - 0.5) * length * 0.9)
        .addScaledVector(UP, (Math.random() - 0.5) * length * 0.5);
      this.h.copy(this.v).addScaledVector(this.perp, (Math.random() - 0.5) * 0.35).addScaledVector(UP, (Math.random() - 0.5) * 0.15).normalize();
      this.spawn(this.w, this.h, 14 + Math.random() * 10, length * (0.5 + Math.random() * 0.8), 0.25 + Math.random() * 0.2, 0.045 + Math.random() * 0.03);
    }
  }

  sweep(a: THREE.Vector3, b: THREE.Vector3, count = 10, length = 2, minLife = 0.28) {
    this.v.subVectors(b, a);
    const total = this.v.length();
    if (total < 1e-3) return;
    this.v.multiplyScalar(1 / total);
    this.perp.set(-this.v.z, 0, this.v.x);
    for (let i = 0; i < count; i++) {
      this.w.copy(a)
        .addScaledVector(this.v, Math.random() * total)
        .addScaledVector(this.perp, (Math.random() - 0.5) * 1.8);
      this.w.y = 0.25 + Math.random() * 1.2;
      this.spawn(this.w, this.v, 16 + Math.random() * 10, length * (0.5 + Math.random() * 0.8), minLife + Math.random() * 0.22, 0.045 + Math.random() * 0.03);
    }
  }

  reset() {
    for (const s of this.streaks) s.live = false;
    this.frozen = false;
    this.geo.instanceCount = 0;
    this.mesh.visible = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    const ah = this.aH.array as Float32Array, at = this.aT.array as Float32Array;
    let n = 0;
    for (const s of this.streaks) {
      if (!s.live) continue;
      s.age += d;
      if (s.age >= s.life) { s.live = false; continue; }
      const u = s.age / s.life;
      this.h.copy(s.start).addScaledVector(s.dir, s.speed * s.age);
      const len = s.len * Math.min(1, 0.2 + s.age * 12);
      ah[n * 4] = this.h.x; ah[n * 4 + 1] = this.h.y; ah[n * 4 + 2] = this.h.z; ah[n * 4 + 3] = s.thick;
      this.h.addScaledVector(s.dir, -len);
      at[n * 4] = this.h.x; at[n * 4 + 1] = this.h.y; at[n * 4 + 2] = this.h.z; at[n * 4 + 3] = 1 - sstep(0.45, 1, u);
      n++;
    }
    this.geo.instanceCount = n;
    this.mesh.visible = n > 0;
    this.aH.needsUpdate = true;
    this.aT.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------------------------------------------

interface Leaf { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; axis: THREE.Vector3; spin: number; ang: number; age: number; life: number; size: number; tone: number; phase: number }

function leafGeometry() {
  // A pointed kite lying flat, its two halves in two tones (vertex colour, multiplied by the instance tint).
  const tail = [0, 0, -0.5], tip = [0, 0, 0.5], right = [0.27, 0, -0.04], left = [-0.27, 0, -0.04];
  const pos = [...tail, ...right, ...tip, ...tail, ...tip, ...left];
  const col = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0.58, 0.58, 0.58, 0.58, 0.58, 0.58, 0.58, 0.58, 0.58];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/**
 * Few small tumbling two-tone leaf cards (mint, pink, cloud) carried by the wind: they drift along their velocity, slow
 * down, flutter and fall lightly, and shrink away at the end of their life (about 1 s). `blow(pos, dir, count, speed)`
 * throws a handful mostly along `dir`; `spawn(pos, vel, life, size)` places one. `frozen` holds time. `update(dt)` each
 * frame. Add `mesh`.
 */
export class Leaves {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private leaves: Leaf[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private d = new THREE.Vector3();
  private col = new THREE.Color();
  private tones = [dim(SKY.body), dim(SKY.accent), dim(SKY.cloud), dim(SKY.body, 0.8)];

  constructor(max = 40) {
    this.mesh = new THREE.InstancedMesh(leafGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.leaves.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(0, 1, 0), spin: 4, ang: 0, age: 0, life: 1, size: 0.18, tone: 0, phase: 0 });
    }
  }

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, life = 1, size = 0.18) {
    const l = this.leaves[this.cursor];
    this.cursor = (this.cursor + 1) % this.leaves.length;
    l.live = true;
    l.pos.copy(pos);
    l.vel.copy(vel);
    l.axis.set(Math.random() - 0.5, Math.random() + 0.2, Math.random() - 0.5).normalize();
    l.spin = (4 + Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1);
    l.ang = Math.random() * 6.28;
    l.age = 0;
    l.life = life;
    l.size = size;
    l.tone = Math.random() < 0.55 ? 0 : Math.random() < 0.5 ? 1 : Math.random() < 0.6 ? 2 : 3;
    l.phase = Math.random() * 6.28;
  }

  blow(pos: THREE.Vector3, dir: THREE.Vector3, count = 6, speed = 6) {
    for (let i = 0; i < count; i++) {
      this.d.copy(dir);
      if (this.d.lengthSq() < 1e-6) this.d.set(0, 1, 0);
      this.d.normalize().multiplyScalar(speed * (0.55 + Math.random() * 0.8));
      this.d.x += (Math.random() - 0.5) * speed * 0.45;
      this.d.y += Math.random() * speed * 0.25;
      this.d.z += (Math.random() - 0.5) * speed * 0.45;
      this.spawn(pos, this.d, 0.6 + Math.random() * 0.4, 0.13 + Math.random() * 0.1);
    }
  }

  reset() {
    for (const l of this.leaves) l.live = false;
    this.frozen = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    let n = 0;
    for (const l of this.leaves) {
      if (!l.live) continue;
      l.age += d;
      if (l.age >= l.life) { l.live = false; continue; }
      l.vel.multiplyScalar(Math.max(0, 1 - 1.8 * d));
      l.vel.y -= 2.2 * d;
      l.vel.x += Math.sin(l.age * 7 + l.phase) * 1.4 * d;
      l.vel.z += Math.cos(l.age * 6 + l.phase) * 1.4 * d;
      l.pos.addScaledVector(l.vel, d);
      if (l.pos.y < 0.05) { l.pos.y = 0.05; l.vel.y = 0; l.vel.multiplyScalar(0.85); }
      l.ang += l.spin * d;
      this.q.setFromAxisAngle(l.axis, l.ang);
      const u = l.age / l.life;
      const sz = Math.max(l.size * (1 - sstep(0.7, 1, u)), MIN_SCALE);
      this.m.compose(l.pos, this.q, this.s.set(sz * 0.8, sz, sz * 1.3));
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.col.copy(this.tones[l.tone]));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
