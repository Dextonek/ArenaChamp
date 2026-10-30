import * as THREE from 'three';
import type { MinionLook } from './minion';

/**
 * The ink kit (pipeline/designs/kit-ink.md): wet brush calligraphy. Tapered brushstrokes with bristle streaks and a dry
 * tail (`Stroke`), splatter drops (`Splatter`), rice-paper decals where ink bleeds in (`InkBleed`), vermilion seals
 * (`Seal`), a sheet of paper folding itself (`PaperFold`) and the paper-crane unit look (`inkCraneLook`). Everything is
 * pooled, takes world-space positions and has `reset()`. Strokes are sumi black with an indigo rim glow; paper and seals
 * are flat matte colour. Nothing is additive, all materials stay below the bloom threshold.
 */

/** Palette. Numbers for `THREE.Color`, `INK_CSS` for APIs that want a string. `foil` (rice paper) is the pale foil. */
export const INK = {
  core: 0xffffff,
  hot: 0xc8d4ff,
  body: 0x3a5ae8,
  accent: 0xff4a2a,
  dark: 0x0b0a0e,
  foil: 0xefe6d2,
} as const;

export const INK_CSS = {
  core: '#ffffff',
  hot: '#c8d4ff',
  body: '#3a5ae8',
  accent: '#ff4a2a',
  dark: '#0b0a0e',
  foil: '#efe6d2',
} as const;

const MIN = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x: number) => Math.pow(clamp01(x), 2);
const easeInOut = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const hsh = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const col = (hex: number, gain = 1) => new THREE.Color(hex).multiplyScalar(gain);

// ---------------------------------------------------------------------------------------------------------------
// Stroke
// ---------------------------------------------------------------------------------------------------------------

let bristleTex: THREE.CanvasTexture | undefined;

/**
 * R = coverage of the bristles: the middle rows hold ink longest, the outer rows run dry first, each row breaks into
 * dashes before it ends and a few rows are thin gaps all along. G = random blocks, the flakes `dissolve` eats.
 * Along u (0 = where the brush came down, 1 = the dry tail).
 */
function bristleTexture() {
  if (bristleTex) return bristleTex;
  const W = 512, H = 64;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const dry: number[] = [], gap: boolean[] = [];
  let bundle = 0.7;
  for (let r = 0; r < H; r++) {
    if (r % 3 === 0) bundle = 0.3 + 0.7 * Math.pow(hsh(r * 1.7 + 3), 0.8);
    const mid = Math.sin(Math.PI * (r + 0.5) / H);
    // Only the last third of the length dries out; the body of the stroke stays solid ink.
    dry.push(THREE.MathUtils.clamp((0.62 + 0.38 * bundle + (hsh(r * 9.1) - 0.5) * 0.08) * (0.86 + 0.14 * mid), 0.5, 1.05));
    gap.push(hsh(r * 3.3 + 1) > 0.86 && r > 6 && r < H - 6);
  }
  for (let r = 0; r < H; r++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, d = dry[r];
      let cov = 0;
      if (u < d - 0.1) cov = gap[r] && u > 0.15 ? 0.5 : 1;
      else if (u < d + 0.1) cov = hsh(Math.floor(x / 6) * 1.3 + r * 7.7) > (u - (d - 0.1)) / 0.2 ? 1 : 0;
      else if (u < d + 0.2 && hsh(x * 3.1 + r * 5.7) > 0.985) cov = 1;
      const i = (r * W + x) * 4;
      img.data[i] = Math.round(cov * 255);
      img.data[i + 1] = Math.round(hsh(Math.floor(x / 6) * 7.1 + Math.floor(r / 2) * 3.7) * 255);
      img.data[i + 2] = 0;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  bristleTex = new THREE.CanvasTexture(c);
  bristleTex.wrapS = bristleTex.wrapT = THREE.ClampToEdgeWrapping;
  return bristleTex;
}

export interface StrokeOptions {
  /** The ribbon lies in the world (width perpendicular to the path, on the ground or a horizontal plane) instead of facing the camera. */
  flat?: boolean;
  /** Vertices along the path (default 32). */
  samples?: number;
  /** Ink colour (default sumi black) and rim glow colour (default indigo). */
  body?: number;
  rim?: number;
  /** 0 = solid ink .. 1 = full bristle streaks and a dry tail (default 1). */
  bristle?: number;
  /** 0 = constant width .. 1 = fat start tapering to a point (default 1). */
  taper?: number;
  /** renderOrder (default 8; ground strokes use 4 so seals sit on top). */
  order?: number;
}

/**
 * A brushstroke ribbon along a path: fat where the brush came down (path start) and tapering to a dry-brush tail (path
 * end), sumi black with bristle streaks, a wet highlight and a thin indigo rim glow (>= 0.04 wide). `paint` draws it in
 * over time (the head advances, the tail dries as it ends); `set` places it directly (a flying stroke, ordered head
 * first); `dissolve` breaks it into flakes that fade, tail first; `stand` lifts a flat ribbon into a wall. Add `mesh`;
 * call `update(dt)` every frame.
 */
export class Stroke {
  readonly mesh: THREE.Mesh;
  alpha = 1;
  private geo = new THREE.BufferGeometry();
  private S: number;
  private pos: Float32Array;
  private nxt: Float32Array;
  private side: Float32Array;
  private aS: Float32Array;
  private aW: Float32Array;
  private pts: THREE.Vector3[] = [];
  private n = 0;
  private width = 0.4;
  private head = 1;
  private paintT = -1;
  private paintDur = 1;
  private flake = 0;
  private flakeDur = 0;
  private seed = Math.random() * 10;
  private taper: number;
  private mat: THREE.ShaderMaterial;
  private tmp: THREE.Vector3[] = [];

  constructor(opts: StrokeOptions = {}) {
    const S = (this.S = opts.samples ?? 32);
    this.taper = opts.taper ?? 1;
    const nv = S * 2;
    this.pos = new Float32Array(nv * 3);
    this.nxt = new Float32Array(nv * 3);
    this.side = new Float32Array(nv);
    this.aS = new Float32Array(nv);
    this.aW = new Float32Array(nv);
    for (let k = 0; k < S; k++) this.tmp.push(new THREE.Vector3());
    const idx: number[] = [];
    for (let k = 0; k < S - 1; k++) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    const dyn = (arr: Float32Array, size: number) => new THREE.BufferAttribute(arr, size).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', dyn(this.pos, 3));
    this.geo.setAttribute('aNext', dyn(this.nxt, 3));
    this.geo.setAttribute('aSide', dyn(this.side, 1));
    this.geo.setAttribute('aS', dyn(this.aS, 1));
    this.geo.setAttribute('aW', dyn(this.aW, 1));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uTex: { value: bristleTexture() },
        uBody: { value: col(opts.body ?? INK.dark) }, uRim: { value: col(opts.rim ?? INK.body, 0.95) }, uHot: { value: col(INK.hot, 0.9) },
        uAlpha: { value: 1 }, uFlake: { value: 0 }, uBristle: { value: opts.bristle ?? 1 },
        uFlat: { value: opts.flat ? 1 : 0 }, uStand: { value: 0 }, uRise: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aNext; attribute float aSide; attribute float aS; attribute float aW;
        uniform float uFlat, uStand, uRise;
        varying float vSide; varying float vS; varying float vHalf;
        void main() {
          vSide = aSide; vS = aS; vHalf = aW;
          if (uFlat > 0.5) {
            vec3 d = aNext - position;
            float l = length(d);
            d = l > 1e-5 ? d / l : vec3(1.0, 0.0, 0.0);
            vec3 perp = normalize(cross(d, vec3(0.0, 1.0, 0.0)) + vec3(1e-5, 0.0, 0.0));
            vec3 p = position + perp * aSide * aW * (1.0 - uStand)
              + vec3(0.0, 1.0, 0.0) * (aSide * 0.5 + 0.5) * aW * 2.0 * uRise * uStand;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          } else {
            vec4 c = modelViewMatrix * vec4(position, 1.0);
            vec4 n = modelViewMatrix * vec4(aNext, 1.0);
            vec2 d = n.xy - c.xy;
            float l = length(d);
            d = l > 1e-5 ? d / l : vec2(1.0, 0.0);
            c.xy += vec2(-d.y, d.x) * aSide * aW;
            gl_Position = projectionMatrix * c;
          }
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; uniform vec3 uBody, uRim, uHot;
        uniform float uAlpha, uFlake, uBristle;
        varying float vSide; varying float vS; varying float vHalf;
        void main() {
          vec4 t = texture2D(uTex, vec2(clamp(vS, 0.0, 1.0), vSide * 0.5 + 0.5));
          float cov = mix(1.0, t.r, uBristle);
          float th = clamp(uFlake * 1.35 - (1.0 - vS) * 0.35, 0.0, 1.0);
          float keep = step(th, t.g);
          float aside = abs(vSide);
          float edge = 1.0 - smoothstep(0.86, 1.0, aside);
          float rimW = clamp(0.06 / max(vHalf, 0.02), 0.1, 0.55);
          float rim = smoothstep(1.0 - rimW * 1.5, 1.0 - rimW * 0.2, aside);
          vec3 c = mix(uBody, uRim, rim * 0.92);
          float hl = exp(-pow((vSide + 0.38) / 0.07, 2.0)) * 0.3 * cov * (1.0 - vS);
          c = mix(c, uHot, hl);
          float a = cov * keep * edge * uAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(c, a);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.order ?? 8;
    this.mesh.visible = false;
  }

  /** True while it is drawn or still painting. */
  get busy() {
    return this.mesh.visible || this.paintT >= 0;
  }

  /** True while `paint` is still advancing. */
  get painting() {
    return this.paintT >= 0;
  }

  /** Stores the path. `smooth` runs a Catmull-Rom curve through the points (use it for hand-placed paths). */
  private setPath(points: THREE.Vector3[], width: number, smooth: boolean) {
    this.width = width;
    if (smooth && points.length >= 3) {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => p.clone()), false, 'centripetal');
      this.pts = curve.getPoints(31);
      this.n = this.pts.length;
      return;
    }
    this.n = points.length;
    while (this.pts.length < this.n) this.pts.push(new THREE.Vector3());
    for (let i = 0; i < this.n; i++) this.pts[i].copy(points[i]);
  }

  /** Draws the stroke in along `points` over `seconds` (the head advances; the fat start comes first, the dry tail last). */
  paint(points: THREE.Vector3[], width: number, seconds: number) {
    this.setPath(points, width, true);
    this.head = 0;
    this.paintT = 0;
    this.paintDur = Math.max(seconds, 1e-3);
    this.flake = 0;
    this.flakeDur = 0;
    this.alpha = 1;
    this.setStand(0);
  }

  /** Places the stroke directly: `head` is the drawn fraction of the path. Path order: fat end first. */
  set(points: THREE.Vector3[], width: number, head = 1) {
    this.setPath(points, width, false);
    this.paintT = -1;
    this.head = clamp01(head);
  }

  /** Breaks it into flakes that fade, tail first, over `seconds`. */
  dissolve(seconds: number) {
    this.flakeDur = Math.max(seconds, 1e-3);
  }

  /** Lifts a flat ribbon into a wall: 0 lies on the ground, 1 stands, its height `rise` x twice its half width. */
  setStand(k: number, rise = 1) {
    this.mat.uniforms.uStand.value = clamp01(k);
    this.mat.uniforms.uRise.value = rise;
  }

  /** The point at fraction `u` of the path. */
  at(u: number, out: THREE.Vector3) {
    if (this.n < 1) return out.set(0, 0, 0);
    if (this.n < 2) return out.copy(this.pts[0]);
    const f = clamp01(u) * (this.n - 1), i = Math.min(Math.floor(f), this.n - 2);
    return out.lerpVectors(this.pts[i], this.pts[i + 1], f - i);
  }

  /** Where the brush is now (the painted head). */
  tip(out: THREE.Vector3) {
    return this.at(this.head, out);
  }

  reset() {
    this.n = 0;
    this.head = 1;
    this.paintT = -1;
    this.flake = 0;
    this.flakeDur = 0;
    this.alpha = 1;
    this.setStand(0);
    this.hide();
  }

  private hide() {
    this.mesh.visible = false;
    this.geo.setDrawRange(0, 0);
  }

  /** Width profile along the path (0..1): pressed in, fat, then tapering to the dry tail, never uniform. */
  private profile(s: number) {
    const t = this.taper;
    const press = 1 - t * 0.45 * (1 - clamp01(s / 0.09));
    const down = clamp01((s - 0.14) / 0.86);
    const body = 1 - t * 0.93 * Math.pow(down, 1.15);
    const wobble = 1 + 0.13 * Math.sin(s * 13 + this.seed) + 0.07 * Math.sin(s * 29 + this.seed * 1.7);
    return press * body * wobble;
  }

  update(dt: number) {
    if (this.paintT >= 0) {
      this.paintT += dt;
      const k = clamp01(this.paintT / this.paintDur);
      this.head = k * (2 - k);
      if (k >= 1) this.paintT = -1;
    }
    if (this.flakeDur > 0) {
      this.flake = Math.min(1, this.flake + dt / this.flakeDur);
      if (this.flake >= 1) {
        this.flakeDur = 0;
        this.n = 0;
        this.hide();
        return;
      }
    }
    if (this.n < 2 || this.head < 0.02 || this.alpha <= 0.002) {
      this.hide();
      return;
    }
    this.mesh.visible = true;
    this.mat.uniforms.uAlpha.value = this.alpha * (1 - this.flake * this.flake * this.flake);
    this.mat.uniforms.uFlake.value = this.flake;
    const S = this.S, head = this.head;
    for (let k = 0; k < S; k++) this.at(head * (k / (S - 1)), this.tmp[k]);
    for (let k = 0; k < S; k++) {
      const p = this.tmp[k], s = head * (k / (S - 1));
      let w = this.width * 0.5 * this.profile(s);
      if (head < 0.999) w *= Math.sqrt(clamp01((S - 1 - k) / 1.5 + 0.2));
      const nx = k < S - 1 ? this.tmp[k + 1] : null;
      for (let q = 0; q < 2; q++) {
        const v = k * 2 + q, o = v * 3;
        this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z;
        if (nx) { this.nxt[o] = nx.x; this.nxt[o + 1] = nx.y; this.nxt[o + 2] = nx.z; }
        else {
          const b = this.tmp[k - 1];
          this.nxt[o] = 2 * p.x - b.x; this.nxt[o + 1] = 2 * p.y - b.y; this.nxt[o + 2] = 2 * p.z - b.z;
        }
        this.side[v] = q === 0 ? -1 : 1;
        this.aS[v] = s;
        this.aW[v] = Math.max(w, 0.004);
      }
    }
    this.geo.setDrawRange(0, (S - 1) * 6);
    for (const nm of ['position', 'aNext', 'aSide', 'aS', 'aW']) this.geo.attributes[nm].needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Splatter
// ---------------------------------------------------------------------------------------------------------------

const DROP_GRAVITY = 11;
const LAND_Y = 0.06;
const LAND_LIFE = 0.35;

export interface FlingOptions {
  /** Drop radius (default 0.1, each varies). */
  size?: number;
  /** Sideways scatter, radians-ish (default 0.7). */
  spread?: number;
  /** Extra upward kick 0..2 (default 1). */
  up?: number;
  /** Flat shard (a flake of dried stroke) instead of a teardrop streak. */
  shard?: boolean;
  /** Gravity in m/s^2 (default 11; low values make flakes drift). */
  gravity?: number;
  /** Seconds a drop may stay airborne (default 0.9). */
  life?: number;
}

/**
 * Ink drops flung from a point: small sumi blobs (some wet indigo-black) on ballistic arcs that land as a flat splat
 * and vanish after a third of a second. `fling` takes free slots; a full pool skips the rest. Add `mesh`.
 */
export class Splatter {
  readonly mesh: THREE.InstancedMesh;
  private p: Float32Array;
  private v: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private grav: Float32Array;
  private thin: Uint8Array;
  private dirq = new THREE.Vector3();
  private zAxis = new THREE.Vector3(0, 0, 1);
  private st: Uint8Array; // 0 free, 1 airborne, 2 landed
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s3 = new THREE.Vector3();
  private p3 = new THREE.Vector3();
  private rr = 0;
  private active = 0;

  constructor(private cap = 24) {
    this.p = new Float32Array(cap * 3);
    this.v = new Float32Array(cap * 3);
    this.age = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.size = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.thin = new Uint8Array(cap);
    this.st = new Uint8Array(cap);
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1).scale(0.5, 0.5, 2.0), new THREE.MeshBasicMaterial({ color: 0xffffff }), cap);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const sumi = col(INK.dark), wet = col(0x1c2a78);
    for (let i = 0; i < cap; i++) this.mesh.setColorAt(i, i % 4 === 0 ? wet : sumi);
    this.mesh.visible = false;
    this.reset();
  }

  get busy() {
    return this.active > 0;
  }

  /** Flings `count` drops from `pos` along `dir` (3D, need not be unit) at about `speed` m/s. */
  fling(pos: THREE.Vector3, dir: THREE.Vector3, count: number, speed: number, o: FlingOptions = {}) {
    const spread = o.spread ?? 0.7, up = o.up ?? 1;
    const hl = Math.hypot(dir.x, dir.z) || 1;
    for (let n = 0; n < count; n++) {
      let i = -1;
      for (let j = 0; j < this.cap; j++) {
        const c = (this.rr + j) % this.cap;
        if (this.st[c] === 0) { i = c; break; }
      }
      if (i < 0) return;
      this.rr = (i + 1) % this.cap;
      const ang = (Math.random() - 0.5) * 2 * spread;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const hx = (dir.x * ca - dir.z * sa) / hl, hz = (dir.x * sa + dir.z * ca) / hl;
      const sp = speed * (0.55 + Math.random() * 0.7);
      this.p[i * 3] = pos.x; this.p[i * 3 + 1] = Math.max(pos.y, LAND_Y); this.p[i * 3 + 2] = pos.z;
      this.v[i * 3] = hx * sp;
      this.v[i * 3 + 1] = dir.y * sp + speed * 0.35 * up * Math.random() + speed * 0.1;
      this.v[i * 3 + 2] = hz * sp;
      this.age[i] = 0;
      this.life[i] = o.life ?? 0.9;
      this.grav[i] = o.gravity ?? DROP_GRAVITY;
      this.thin[i] = o.shard ? 1 : 0;
      this.size[i] = (o.size ?? 0.1) * (0.6 + Math.random() * 0.8);
      this.st[i] = 1;
      this.active++;
    }
    this.mesh.visible = true;
  }

  reset() {
    this.st.fill(0);
    this.active = 0;
    for (let i = 0; i < this.cap; i++) this.write(i, 0, -5, 0, MIN, MIN);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  }

  private write(i: number, x: number, y: number, z: number, sx: number, sy: number, vx = 0, vy = 0, vz = 1) {
    this.p3.set(x, y, z);
    this.s3.set(Math.max(sx, MIN), Math.max(sy, MIN), Math.max(sx, MIN));
    this.dirq.set(vx, vy, vz);
    if (this.dirq.lengthSq() > 1e-6) this.q.setFromUnitVectors(this.zAxis, this.dirq.normalize());
    this.m.compose(this.p3, this.q, this.s3);
    this.mesh.setMatrixAt(i, this.m);
  }

  update(dt: number) {
    if (this.active <= 0) return;
    for (let i = 0; i < this.cap; i++) {
      const s = this.st[i];
      if (s === 0) continue;
      this.age[i] += dt;
      const a = this.age[i], o = i * 3, sz = this.size[i];
      if (s === 1) {
        this.v[o + 1] -= this.grav[i] * dt;
        this.p[o] += this.v[o] * dt; this.p[o + 1] += this.v[o + 1] * dt; this.p[o + 2] += this.v[o + 2] * dt;
        const L = this.life[i];
        if (this.p[o + 1] <= LAND_Y) {
          this.p[o + 1] = LAND_Y;
          this.st[i] = 2;
          this.age[i] = 0;
        } else if (a > L) {
          this.st[i] = 0;
          this.active--;
          this.write(i, 0, -5, 0, MIN, MIN);
          continue;
        }
        const k = 1 - clamp01((a - L * 0.75) / (L * 0.25));
        this.write(i, this.p[o], this.p[o + 1], this.p[o + 2], sz * k, sz * k * (this.thin[i] ? 0.3 : 1), this.v[o], this.v[o + 1], this.v[o + 2]);
      } else {
        if (a > LAND_LIFE) {
          this.st[i] = 0;
          this.active--;
          this.write(i, 0, -5, 0, MIN, MIN);
          continue;
        }
        const k = 1 - clamp01(a / LAND_LIFE);
        this.write(i, this.p[o], LAND_Y, this.p[o + 2], sz * 1.1 * k, sz * 0.12, this.v[o], 0, this.v[o + 2]);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.active <= 0) this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// InkBleed
// ---------------------------------------------------------------------------------------------------------------

export interface SpreadOptions {
  /** 0 = rice paper only, 1 = ink bleeds into it (default 1). */
  ink?: number;
  /** The paper unrolls across the disc along `yaw` instead of growing outward from the centre. */
  unroll?: boolean;
  yaw?: number;
  /** Height above the floor (default 0.04). */
  y?: number;
}

/**
 * A ground decal where ink spreads into rice paper: a pale fibrous disc with a torn edge grows first, then a dark pool
 * bleeds into it with a feathered indigo edge. With `unroll` the sheet rolls out across the disc like a scroll.
 * `spread(center, radius, seconds, opts)` plays it in, `fade(seconds)` takes it away. Add `mesh`.
 */
export class InkBleed {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private age = -1;
  private dur = 1;
  private inkAmount = 1;
  private fadeT = -1;
  private fadeDur = 1;

  constructor(order = 2, gain = 0.94) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uPaper: { value: 0 }, uInk: { value: 0 }, uAlpha: { value: 1 }, uUnroll: { value: 0 }, uDir: { value: new THREE.Vector2(1, 0) },
        uSeed: { value: Math.random() * 20 },
        uFoil: { value: col(INK.foil, gain) }, uDark: { value: col(INK.dark) }, uIndigo: { value: col(INK.body, 0.9) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() {
          vP = position.xz * 1.12;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uPaper, uInk, uAlpha, uUnroll, uSeed; uniform vec2 uDir; uniform vec3 uFoil, uDark, uIndigo;
        varying vec2 vP;
        float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vn(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
        void main() {
          float r = length(vP);
          float n = fbm(vP * 3.5 + uSeed);
          float edgeR = r + (n - 0.5) * 0.22;
          float rad = uUnroll > 0.5 ? 0.98 : mix(0.0, 0.98, uPaper);
          float disc = (1.0 - smoothstep(rad - 0.07, rad, edgeR)) * step(0.001, uPaper);
          float sweep = 1.0;
          if (uUnroll > 0.5) {
            float x = dot(vP, uDir) + (n - 0.5) * 0.18;
            float front = mix(-1.2, 1.2, uPaper);
            sweep = 1.0 - smoothstep(front - 0.05, front + 0.02, x);
          }
          float fiber = 0.94 + 0.06 * vn(vP * 40.0) + 0.03 * vn(vec2(vP.x * 60.0, vP.y * 4.0) + uSeed);
          vec3 c = uFoil * fiber;
          c *= 1.0 - 0.14 * smoothstep(rad - 0.1, rad - 0.01, edgeR);
          float ir = uInk * 0.86;
          float ie = r + (fbm(vP * 5.5 + uSeed * 1.7 + 9.0) - 0.5) * 0.42 * (0.4 + uInk);
          float inkM = (1.0 - smoothstep(ir - 0.12, ir, ie)) * step(0.002, uInk);
          float dens = 0.62 + 0.38 * fbm(vP * 9.0 + 3.0);
          float band = smoothstep(ir - 0.22, ir - 0.04, ie) * (1.0 - smoothstep(ir - 0.04, ir, ie));
          vec3 inkC = mix(uDark, uIndigo * 0.7, band * 0.8);
          c = mix(c, inkC, inkM * dens);
          float a = disc * sweep * uAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(c, a);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = order;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get busy() {
    return this.mesh.visible;
  }

  /** Plays the decal in over `seconds`: paper first (the first ~60%), ink bleeding in from ~30% on. */
  spread(center: THREE.Vector3, radius: number, seconds: number, o: SpreadOptions = {}) {
    this.mesh.position.set(center.x, o.y ?? 0.04, center.z);
    this.mesh.scale.setScalar(radius * 1.12);
    this.inkAmount = o.ink ?? 1;
    const u = this.mat.uniforms;
    u.uUnroll.value = o.unroll ? 1 : 0;
    u.uDir.value.set(Math.sin(o.yaw ?? 0), Math.cos(o.yaw ?? 0));
    u.uSeed.value = Math.random() * 20;
    u.uAlpha.value = 1;
    u.uPaper.value = 0;
    u.uInk.value = 0;
    this.age = 0;
    this.dur = Math.max(seconds, 1e-3);
    this.fadeT = -1;
    this.mesh.visible = true;
  }

  fade(seconds: number) {
    this.fadeT = 0;
    this.fadeDur = Math.max(seconds, 1e-3);
  }

  reset() {
    this.age = -1;
    this.fadeT = -1;
    this.mesh.visible = false;
  }

  update(dt: number) {
    if (!this.mesh.visible) return;
    const u = this.mat.uniforms;
    if (this.age >= 0) {
      this.age += dt;
      const t = this.age / this.dur;
      const paperEnd = this.inkAmount > 0 ? 0.6 : 1;
      u.uPaper.value = easeOut(t / paperEnd);
      u.uInk.value = this.inkAmount * easeOut((t - 0.3) / 0.7);
    }
    if (this.fadeT >= 0) {
      this.fadeT += dt;
      const k = clamp01(this.fadeT / this.fadeDur);
      u.uAlpha.value = 1 - k;
      if (k >= 1) this.reset();
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Seal
// ---------------------------------------------------------------------------------------------------------------

let sealTex: THREE.CanvasTexture | undefined;

/** A square vermilion stamp with a pale, slightly ragged border and a carved glyph (a field cut in four) with chipped edges. */
function sealTexture() {
  if (sealTex) return sealTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const j = (r: number) => (hsh(r) - 0.5) * 7;
  g.fillStyle = INK_CSS.foil;
  g.beginPath();
  g.moveTo(8 + j(1), 8 + j(2));
  g.lineTo(S - 8 + j(3), 8 + j(4));
  g.lineTo(S - 8 + j(5), S - 8 + j(6));
  g.lineTo(8 + j(7), S - 8 + j(8));
  g.closePath();
  g.fill();
  g.fillStyle = INK_CSS.accent;
  g.beginPath();
  g.moveTo(26 + j(9), 26 + j(10));
  g.lineTo(S - 26 + j(11), 26 + j(12));
  g.lineTo(S - 26 + j(13), S - 26 + j(14));
  g.lineTo(26 + j(15), S - 26 + j(16));
  g.closePath();
  g.fill();
  g.strokeStyle = INK_CSS.foil;
  g.lineWidth = 15;
  g.lineCap = 'butt';
  g.strokeRect(72, 70, 112, 112);
  g.beginPath();
  g.moveTo(128, 50); g.lineTo(128, 206);
  g.moveTo(72, 126); g.lineTo(184, 126);
  g.stroke();
  for (let i = 0; i < 70; i++) {
    g.fillStyle = hsh(i * 2.3) < 0.55 ? INK_CSS.accent : INK_CSS.foil;
    g.fillRect(34 + hsh(i * 5.1) * (S - 76), 34 + hsh(i * 7.9) * (S - 76), 3 + hsh(i * 3.3) * 5, 3 + hsh(i * 9.7) * 4);
  }
  sealTex = new THREE.CanvasTexture(c);
  sealTex.colorSpace = THREE.SRGBColorSpace;
  return sealTex;
}

interface SealSlot {
  g: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  handle: THREE.Group;
  mode: 0 | 1 | 2;
  age: number;
  size: number;
  fromY: number;
  dur: number;
  fade: number;
  fadeDur: number;
}

const SEAL_Y = 0.12;

/**
 * A vermilion seal flat on the ground: `stamp` presses it in (a quick punch), `fall` drops a big one from above with its
 * stone handle and presses it on landing. `cap` seals can be out at once. `fade` takes them all away. Add `mesh`.
 */
export class Seal {
  readonly mesh = new THREE.Group();
  private slots: SealSlot[] = [];
  private next = 0;

  constructor(cap = 1, order = 6) {
    const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // The stone: carved vermilion faces on its four sides, a dark top; unlit, under the bloom threshold.
    const stone = new THREE.BoxGeometry(0.7, 0.5, 0.7).translate(0, 0.27, 0);
    const side = new THREE.MeshBasicMaterial({ map: sealTexture(), alphaTest: 0.5, color: col(0xffffff, 0.85) });
    const top = new THREE.MeshBasicMaterial({ color: col(0x3a1410) });
    const stoneMats = [side, side, top, top, side, side];
    for (let i = 0; i < cap; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: sealTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const face = new THREE.Mesh(quad, mat);
      face.renderOrder = order;
      const handle = new THREE.Group();
      handle.add(new THREE.Mesh(stone, stoneMats));
      handle.visible = false;
      const g = new THREE.Group();
      g.add(face, handle);
      g.visible = false;
      this.mesh.add(g);
      this.slots.push({ g, mat, handle, mode: 0, age: 0, size: 1, fromY: 0, dur: 0, fade: 0, fadeDur: 0 });
    }
  }

  get busy() {
    return this.slots.some((s) => s.mode !== 0);
  }

  private take(center: THREE.Vector3, size: number, mode: 1 | 2) {
    const s = this.slots[this.next++ % this.slots.length];
    s.mode = mode;
    s.age = 0;
    s.size = size;
    s.fade = 0;
    s.fadeDur = 0;
    s.g.visible = true;
    s.g.position.set(center.x, SEAL_Y, center.z);
    s.g.rotation.y = (hsh(center.x * 7.3 + center.z * 3.1 + this.next) - 0.5) * 0.35;
    s.g.scale.setScalar(size);
    s.handle.visible = false;
    s.mat.opacity = 0;
    return s;
  }

  /** Presses a seal of `size` metres onto the ground at `center`. */
  stamp(center: THREE.Vector3, size: number) {
    this.take(center, size, 1);
  }

  /** Drops a seal from `fromY` metres up onto `center`, landing after `seconds`. */
  fall(center: THREE.Vector3, size: number, fromY: number, seconds: number) {
    const s = this.take(center, size, 2);
    s.fromY = fromY;
    s.dur = Math.max(seconds, 1e-3);
    s.handle.visible = true;
    s.mat.opacity = 1;
    s.g.position.y = fromY;
  }

  fade(seconds: number) {
    for (const s of this.slots) if (s.mode !== 0) { s.fade = 0; s.fadeDur = Math.max(seconds, 1e-3); }
  }

  reset() {
    for (const s of this.slots) { s.mode = 0; s.g.visible = false; s.handle.visible = false; }
    this.next = 0;
  }

  update(dt: number) {
    for (const s of this.slots) {
      if (s.mode === 0) continue;
      s.age += dt;
      let op = 1, sc = s.size;
      if (s.mode === 1) {
        const k = clamp01(s.age / 0.09);
        sc = s.size * (1.3 - 0.3 * easeOut(k));
        op = k;
      } else if (s.age < s.dur) {
        s.g.position.y = s.fromY + (SEAL_Y - s.fromY) * easeIn(s.age / s.dur);
      } else {
        s.g.position.y = SEAL_Y;
        s.handle.visible = false;
        sc = s.size * (1 + 0.12 * Math.exp(-(s.age - s.dur) * 14));
      }
      if (s.fadeDur > 0) {
        s.fade += dt;
        op *= 1 - clamp01(s.fade / s.fadeDur);
        if (s.fade >= s.fadeDur) { s.mode = 0; s.g.visible = false; s.handle.visible = false; continue; }
      }
      s.g.scale.setScalar(Math.max(sc, MIN));
      s.mat.opacity = op;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// PaperFold
// ---------------------------------------------------------------------------------------------------------------

interface FoldUnit { root: THREE.Group; wl: THREE.Group; wr: THREE.Group; neck: THREE.Mesh; size: number; yaw: number }

/**
 * Sheets of rice paper that unfold in the air and fold themselves into cranes: a diamond of two halves that rise like
 * wings while a neck pops up. `show(i, pos, size, yaw)` then `set(i, k)` with k 0..1 (the first half unfolds and
 * floats up, the second half folds). `hide(i)` when the real units take over. Add `mesh`.
 */
export class PaperFold {
  readonly mesh = new THREE.Group();
  private units: FoldUnit[] = [];

  constructor(cap = 2) {
    const half = new THREE.BufferGeometry();
    half.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.5, 0, 0, 0.5, 0.5, 0, 0], 3));
    half.setIndex([0, 1, 2]);
    half.computeVertexNormals();
    const neckGeo = new THREE.ConeGeometry(0.06, 0.5, 4).translate(0, 0.25, 0);
    const mat = new THREE.MeshLambertMaterial({ color: col(INK.foil, 0.92), side: THREE.DoubleSide });
    const tipMat = new THREE.MeshBasicMaterial({ color: INK.dark, side: THREE.DoubleSide });
    const tip = new THREE.BufferGeometry();
    tip.setAttribute('position', new THREE.Float32BufferAttribute([0.2, 0.003, -0.3, 0.2, 0.003, 0.3, 0.5, 0.003, 0], 3));
    tip.setIndex([0, 1, 2]);
    for (let i = 0; i < cap; i++) {
      const root = new THREE.Group();
      const wr = new THREE.Group(), wl = new THREE.Group();
      wr.add(new THREE.Mesh(half, mat), new THREE.Mesh(tip, tipMat));
      wl.add(new THREE.Mesh(half, mat), new THREE.Mesh(tip, tipMat));
      wl.scale.x = -1;
      const neck = new THREE.Mesh(neckGeo, mat);
      neck.position.set(0, 0.04, 0.28);
      neck.rotation.x = 0.8;
      root.add(wr, wl, neck);
      root.visible = false;
      this.mesh.add(root);
      this.units.push({ root, wl, wr, neck, size: 1, yaw: 0 });
    }
  }

  show(i: number, pos: THREE.Vector3, size: number, yaw: number) {
    const u = this.units[i];
    if (!u) return;
    u.size = size;
    u.yaw = yaw;
    u.root.position.copy(pos);
    u.root.visible = true;
    this.set(i, 0);
  }

  set(i: number, k: number) {
    const u = this.units[i];
    if (!u) return;
    const unfold = easeOut(k / 0.5), fold = easeInOut((k - 0.4) / 0.6);
    u.root.scale.setScalar(Math.max(u.size * (0.2 + 0.8 * unfold), MIN));
    u.root.rotation.y = u.yaw + (1 - unfold) * 1.6;
    u.root.position.y = 0.8 + 0.3 * unfold;
    u.wr.rotation.z = fold * 1.1;
    u.wl.rotation.z = -fold * 1.1;
    u.neck.scale.setScalar(Math.max(easeOut((k - 0.7) / 0.3), MIN));
  }

  hide(i: number) {
    if (this.units[i]) this.units[i].root.visible = false;
  }

  reset() {
    for (const u of this.units) u.root.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// inkCraneLook
// ---------------------------------------------------------------------------------------------------------------

let craneShared: { dark: THREE.MeshBasicMaterial; red: THREE.MeshBasicMaterial; geo: Record<string, THREE.BufferGeometry> } | null = null;

/** A wing: a long two-sided triangle on the +x side (pivot at the shoulder) and its ink-brushed outer tip. */
function wingGeometries() {
  const A = [0, 0, 0.16], B = [0, 0, -0.18], C = [0.46, 0.02, -0.06];
  const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  const paper = new THREE.BufferGeometry();
  paper.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...A, ...C, ...B], 3));
  paper.computeVertexNormals();
  const A2 = lerp(A, C, 0.3), B2 = lerp(B, C, 0.3);
  const up = (p: number[], y: number) => [p[0], p[1] + y, p[2]];
  const tip = new THREE.BufferGeometry();
  tip.setAttribute('position', new THREE.Float32BufferAttribute([...up(A2, 0.004), ...up(B2, 0.004), ...up(C, 0.004), ...up(A2, -0.004), ...up(C, -0.004), ...up(B2, -0.004)], 3));
  return { paper, tip };
}

/**
 * The ink-crane look for `ranged` summons: a folded paper crane, about 0.8 m across, rice-paper body (flat-shaded, the
 * figure's body material, so it flashes when hit) with ink-brushed wing tips, a dark beak and a vermilion dot on the
 * crown. It hovers and bobs, flaps its wings, leans forward when it walks and dips its head when it shoots (a short
 * ink flick leaves the beak). Other kinds get the same crane.
 */
export const inkCraneLook: MinionLook = (_kind, p) => {
  craneShared ??= {
    dark: new THREE.MeshBasicMaterial({ color: INK.dark, side: THREE.DoubleSide }),
    red: new THREE.MeshBasicMaterial({ color: col(INK.accent, 0.95) }),
    geo: {},
  };
  const sh = craneShared;
  const geo = (key: string, make: () => THREE.BufferGeometry) => (sh.geo[key] ??= make());
  p.body.color.set(INK.foil).multiplyScalar(0.92);
  p.body.roughness = 0.9;
  p.trim.color.set(0x1a1a2e);
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    return o;
  };
  const root = new THREE.Group();
  const fly = new THREE.Group();
  fly.position.y = 1.0;
  root.scale.setScalar(1.3);
  root.add(fly);

  // Body (a folded diamond), tail, neck, head, beak, crown dot.
  const body = mesh(geo('body', () => new THREE.OctahedronGeometry(1, 0)), p.body, 0, 0.02, -0.02);
  body.scale.set(0.09, 0.1, 0.27);
  const tail = mesh(geo('tail', () => new THREE.ConeGeometry(0.05, 0.32, 4).rotateX(-Math.PI / 2)), p.body, 0, 0.07, -0.3);
  tail.rotation.x = 0.35;
  const hullM = (src: THREE.Mesh, k: number) => { const h = new THREE.Mesh(src.geometry, p.outline); h.position.copy(src.position); h.rotation.copy(src.rotation); h.scale.copy(src.scale).multiplyScalar(k); return h; };
  fly.add(hullM(body, 1.14), hullM(tail, 1.25), body, tail);
  const head = new THREE.Group();
  head.position.set(0, 0.05, 0.2);
  const neck = mesh(geo('neck', () => new THREE.ConeGeometry(0.045, 0.3, 4)), p.body, 0, 0.12, 0.09);
  neck.rotation.x = 0.65;
  const skull = mesh(geo('skull', () => new THREE.OctahedronGeometry(0.05, 0)), p.body, 0, 0.26, 0.2);
  const beak = mesh(geo('beak', () => new THREE.ConeGeometry(0.02, 0.17, 3).rotateX(Math.PI / 2)), p.trim, 0, 0.25, 0.31);
  const dot = mesh(geo('dot', () => new THREE.SphereGeometry(0.03, 6, 4)), sh.red, 0, 0.31, 0.19);
  const flick = mesh(geo('flick', () => new THREE.ConeGeometry(0.022, 0.3, 4).rotateX(Math.PI / 2)), sh.dark, 0, 0.25, 0.5);
  flick.visible = false;
  head.add(neck, skull, beak, dot, flick);
  fly.add(head);

  // Wings.
  const wg = geo('wingPaper', () => wingGeometries().paper);
  const wt = geo('wingTip', () => wingGeometries().tip);
  const wings = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * 0.06, 0.08, 0.02);
    g.scale.x = s;
    g.add(mesh(wg, p.body), mesh(wt, sh.dark));
    fly.add(g);
    return { g, s };
  });
  const phase = Math.random() * 6;
  return {
    root,
    barY: 2.0,
    animate(_dt, pose) {
      const w = pose.walk, t = pose.time;
      fly.position.y = 1.0 + Math.sin(t * 2.6 + phase) * 0.05;
      fly.rotation.x = 0.14 * w;
      const flap = Math.sin(t * 7.5 + phase) * (0.5 + 0.2 * w);
      for (const wg2 of wings) wg2.g.rotation.z = wg2.s * (0.32 + flap);
      head.rotation.x = pose.shot * 0.55;
      tail.rotation.x = 0.35 + pose.shot * 0.2;
      flick.visible = pose.shot > 0.35;
      flick.scale.z = 0.4 + (pose.shot - 0.35) * 2;
    },
  };
};
