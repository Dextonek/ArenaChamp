import * as THREE from 'three';
import type { MinionLook, MinionPalette } from './minion';
import { defaultLook } from './minion';

/**
 * The bone kit (pipeline/designs/kit-bone.md): chunky carved, stacked bone (ivory with dark brown crevices at every
 * joint, slight variation per piece), lit from inside by small unlit teal soulfire wisps with eroding edges, grey-brown
 * dust puffs and a procedural cracked-ground decal with teal light in the cracks. Everything is pooled, takes
 * world-space positions and has a `reset()`. Bone is a toon-banded shader (no gloss); wisps and dust are alpha-cut
 * toon billboards; all colours stay below the bloom threshold (~0.86).
 *
 * - `BoneSpire`    a segmented bone spike (optionally skull-capped) that grows from the ground in steps and crumbles.
 * - `SoulWisps`    pooled teal flame wisps: `attach` (flicker at a spot), `puff` (one-shot rising wisps).
 * - `BoneDust`     grey-brown dust puffs: `burst`, `ring`.
 * - `BoneShards`   bone chips under gravity: `burst`, `ring` (flat outward ring).
 * - `GroundCracks` a cracked circle on the floor with teal light in the cracks.
 * - `BoneLance`    the 2.2 m vertebra spear (Q): assembles from flying bones, then flies as one piece.
 * - `RibCage`      a cage of curved ribs around a point (E): grows in segments, flexes, crumbles.
 * - `BoneHand`     the colossal skeletal hand (R): forearm, palm, four fingers and a thumb, joints lit teal.
 * - `skeletonLook` the `MinionLook` for summons: a small skeleton (melee, with a blade) or an archer (ranged, bow).
 */

/** Palette. Numbers for `THREE.Color`, `BONE_CSS` for APIs that want a string. `bone` is the ivory foil. */
export const BONE = {
  core: 0xf4fffb,
  hot: 0xb8fff0,
  body: 0x3fd8b8,
  accent: 0xff5a3a,
  dark: 0x0a1412,
  bone: 0xece4d0,
} as const;

export const BONE_CSS = {
  core: '#f4fffb',
  hot: '#b8fff0',
  body: '#3fd8b8',
  accent: '#ff5a3a',
  dark: '#0a1412',
  bone: '#ece4d0',
} as const;

const CREVICE = 0x3a291b;
const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeOutBack = (x: number) => {
  const t = clamp01(x) - 1;
  return 1 + 2.2 * t * t * t + 1.2 * t * t;
};
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hsh = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------------------------------------------------------
// Shared bone geometry and material
// ---------------------------------------------------------------------------------------------------------------

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

/** Adds the `aTone` attribute the bone shader reads (1 = ivory, 0 = dark crevice). */
function withTone(geo: THREE.BufferGeometry, tone: (x: number, y: number, z: number) => number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const a = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) a[i] = tone(pos.getX(i), pos.getY(i), pos.getZ(i));
  geo.setAttribute('aTone', new THREE.BufferAttribute(a, 1));
  return geo;
}

/**
 * A knobby bone segment with dark ends, flat-shaded: length 1 along +Y from 0 (or along +Z with `axis: 'z'`),
 * radius 1 at the knobs, `taper` at the top (0.05 gives a pointed claw or spear head), thinner waist in the middle.
 */
export function boneChunkGeometry(sides = 6, taper = 0.8, axis: 'y' | 'z' = 'y') {
  return cached(`chunk${sides}_${taper}_${axis}`, () => {
    const prof: [number, number][] = [[0.001, 0], [0.8, 0], [1, 0.09], [0.86, 0.3], [0.76, 0.5], [0.86, 0.72], [1, 0.91], [0.8, 1], [0.001, 1]];
    const pts = prof.map(([r, y]) => new THREE.Vector2(r * (1 - (1 - taper) * y), y));
    let g: THREE.BufferGeometry = new THREE.LatheGeometry(pts, sides);
    g = g.toNonIndexed();
    g.computeVertexNormals();
    withTone(g, (_x, y) => sstep(0.0, 0.26, y) * sstep(1.0, 0.74, y));
    if (axis === 'z') g.rotateX(Math.PI / 2);
    return g;
  });
}

const boneMats: THREE.ShaderMaterial[] = [];
/** The bone shader. `variant` 0..3 nudges the ivory a little so stacked pieces are never identical. */
export function boneMaterial(variant = 0) {
  const v = ((variant % 4) + 4) % 4;
  let m = boneMats[v];
  if (!m) {
    const tints = [0xd8cfb8, 0xcfc5aa, 0xdfd7c2, 0xc6bb9e];
    m = new THREE.ShaderMaterial({
      uniforms: { uBone: { value: new THREE.Color(tints[v]) }, uCrev: { value: new THREE.Color(CREVICE) } },
      vertexShader: /* glsl */ `
        attribute float aTone; varying vec3 vN; varying vec3 vUp; varying float vTone; varying float vVar;
        void main() {
          mat4 M = mat4(1.0);
          vVar = 0.5;
          #ifdef USE_INSTANCING
            M = instanceMatrix;
            vVar = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453);
          #endif
          vN = normalize(normalMatrix * mat3(M) * normal);
          vUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
          vTone = aTone;
          gl_Position = projectionMatrix * modelViewMatrix * M * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBone, uCrev; varying vec3 vN; varying vec3 vUp; varying float vTone; varying float vVar;
        void main() {
          float u = dot(normalize(vN), normalize(vUp));
          float shade = u > 0.4 ? 1.0 : (u > -0.15 ? 0.78 : 0.6);
          vec3 col = uBone * (0.94 + 0.12 * vVar) * shade;
          col = mix(uCrev * (0.45 + 0.55 * shade), col, smoothstep(0.4, 0.8, vTone));
          gl_FragColor = vec4(min(col, vec3(0.93)), 1.0);
        }`,
    });
    boneMats[v] = m;
  }
  return m;
}

const darkMat = () => cachedMat('dark', () => new THREE.MeshBasicMaterial({ color: BONE.dark }));
const wispMat = () => cachedMat('wisp', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(BONE.hot).multiplyScalar(0.92) }));
const matCache = new Map<string, THREE.Material>();
function cachedMat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

function put(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * A small skull, about 1 wide (cranium radius 0.5), looking along +Z: a flat-shaded cranium, a hanging jaw, two dark
 * sockets with teal eyes. `bone` and `jawMat` are the bone materials, `eye` the unlit teal (shared MeshBasic).
 */
function buildSkull(bone: THREE.Material, jawMat: THREE.Material, eye: THREE.Material) {
  const g = new THREE.Group();
  const cran = put(g, cached('skullCran', () => withTone(new THREE.IcosahedronGeometry(0.5, 1), () => 1)), bone);
  cran.scale.set(1, 0.92, 1.04);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.2, 0.0);
  const jm = put(jaw, boneChunkGeometry(5, 0.6, 'z'), jawMat, 0, -0.16, 0.0);
  jm.scale.set(0.34, 0.14, 0.5);
  g.add(jaw);
  for (const s of [-1, 1]) {
    const sock = put(g, cached('skullBox', () => withTone(new THREE.BoxGeometry(1, 1, 1), () => 1)), darkMat(), s * 0.17, -0.02, 0.43);
    sock.scale.set(0.2, 0.2, 0.12);
    const e = put(g, cached('skullBox', () => withTone(new THREE.BoxGeometry(1, 1, 1), () => 1)), eye, s * 0.17, -0.02, 0.5);
    e.scale.set(0.09, 0.09, 0.06);
  }
  const nose = put(g, cached('skullBox', () => withTone(new THREE.BoxGeometry(1, 1, 1), () => 1)), darkMat(), 0, -0.17, 0.47);
  nose.scale.set(0.07, 0.1, 0.06);
  return { group: g, jaw };
}

// ---------------------------------------------------------------------------------------------------------------
// BoneSpire
// ---------------------------------------------------------------------------------------------------------------

interface SpireSeg { holder: THREE.Group; h: number; r: number; y0: number; jx: number; jz: number }

/**
 * A segmented bone spike that grows from the ground in steps (each segment pops up in turn, the last is a pointed
 * claw, or a small skull when `skull`). `grow(pos, height, seconds, lean, leanAngle)` starts it at `pos` (ground),
 * leaning `lean` m at the top toward the ground angle `leanAngle`; `crumble(seconds)` shrinks it from the top and sinks
 * it. `update(dt)` each frame, `reset()` hides it. Add `mesh`. Use 5 segments by default.
 */
export class BoneSpire {
  readonly mesh = new THREE.Group();
  frozen = false;
  private segs: SpireSeg[] = [];
  private skullGroup: THREE.Group | null = null;
  private skullJaw: THREE.Group | null = null;
  private state: 'off' | 'grow' | 'hold' | 'crumble' = 'off';
  private age = 0;
  private dur = 0.4;
  private height = 2;
  private lean = 0;
  private dirX = 1;
  private dirZ = 0;
  private time = 0;

  constructor(private skull = false, private n = 5, variant = 0) {
    const seed = variant * 3.1 + 1.7;
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      const holder = new THREE.Group();
      const geo = last && !skull ? boneChunkGeometry(5, 0.04) : boneChunkGeometry(6, 0.8);
      const m = new THREE.Mesh(geo, boneMaterial(variant + i));
      holder.add(m);
      holder.rotation.y = hsh(seed + i) * 6.28;
      this.mesh.add(holder);
      this.segs.push({ holder, h: 1, r: 1, y0: 0, jx: (hsh(seed + i * 2.3) - 0.5) * 0.07, jz: (hsh(seed + i * 4.1) - 0.5) * 0.07 });
    }
    if (skull) {
      const s = buildSkull(boneMaterial(variant + 2), boneMaterial(variant + 1), wispMat());
      this.skullGroup = s.group;
      this.skullJaw = s.jaw;
      this.mesh.add(s.group);
    }
    this.mesh.visible = false;
  }

  /** Starts the spike at `pos` (ground), `height` tall, taking `seconds` to grow; `delay` waits first. */
  grow(pos: THREE.Vector3, height: number, seconds = 0.4, lean = 0, leanAngle = Math.random() * 6.28, delay = 0) {
    this.mesh.position.set(pos.x, 0, pos.z);
    this.height = height;
    this.dur = Math.max(seconds, 0.05);
    this.lean = lean;
    this.dirX = Math.cos(leanAngle);
    this.dirZ = Math.sin(leanAngle);
    this.age = -delay;
    this.state = 'grow';
    const n = this.n;
    const body = this.skull ? n : n - 1;
    const base = THREE.MathUtils.clamp(height * 0.11, 0.14, 0.42);
    // Segment heights vary; the tip (a claw) is a bit taller than a body segment.
    const w: number[] = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = (0.8 + hsh(pos.x * 3.1 + i * 1.7 + pos.z) * 0.4) * (i === n - 1 && !this.skull ? 1.5 : 1);
      w.push(v);
      sum += v;
    }
    const total = this.skull ? height * 0.8 : height;
    let y = 0;
    for (let i = 0; i < n; i++) {
      const s = this.segs[i];
      s.h = (w[i] / sum) * total;
      s.r = base * (1 - 0.62 * (i / Math.max(body, 1)));
      s.y0 = y;
      y += s.h * 0.94;
    }
    this.mesh.visible = true;
    this.apply();
  }

  /** Shrinks the spike from the top down and sinks it over `seconds`. */
  crumble(seconds = 0.5, delay = 0) {
    if (this.state === 'off') return;
    this.dur = Math.max(seconds, 0.05);
    this.age = -delay;
    this.state = 'crumble';
  }

  reset() {
    this.state = 'off';
    this.mesh.visible = false;
  }

  get active() {
    return this.state !== 'off';
  }

  update(dt: number) {
    if (this.state === 'off' || this.frozen) return;
    this.age += dt;
    this.time += dt;
    if (this.state === 'crumble' && this.age >= this.dur) { this.reset(); return; }
    if (this.state === 'grow' && this.age >= this.dur) this.state = 'hold';
    this.apply();
  }

  private apply() {
    const n = this.n;
    const u = this.state === 'grow' || this.state === 'hold' ? clamp01(this.age / this.dur) : 1;
    const c = this.state === 'crumble' ? clamp01(this.age / this.dur) : 0;
    let topY = 0, topX = 0, topZ = 0, topR = 0.2, topVis = 0;
    for (let i = 0; i < n; i++) {
      const s = this.segs[i];
      const start = (i / n) * 0.72;
      const g = this.state === 'grow' || this.state === 'hold' ? easeOutBack((u - start) / 0.28) : 1;
      // Crumble: the top goes first, each segment sinks into the one below.
      const cr = clamp01(c * 1.7 - (i / n) * 0.7);
      const sc = Math.max(g * (1 - cr * cr), MIN_SCALE);
      const f = this.height > 0 ? s.y0 / this.height : 0;
      const off = this.lean * Math.pow(f, 1.5);
      s.holder.position.set(this.dirX * off + s.jx, s.y0 - cr * s.h * 0.5, this.dirZ * off + s.jz);
      s.holder.scale.set(Math.max(s.r * (0.7 + 0.3 * Math.min(g, 1)) * (1 - cr * 0.3), MIN_SCALE), Math.max(s.h * sc, MIN_SCALE), Math.max(s.r * (0.7 + 0.3 * Math.min(g, 1)) * (1 - cr * 0.3), MIN_SCALE));
      s.holder.visible = sc > 0.002;
      if (sc > 0.05) { topY = s.y0 + s.h * sc - cr * s.h * 0.5; topX = this.dirX * off + s.jx; topZ = this.dirZ * off + s.jz; topR = s.r; topVis = sc; }
    }
    if (this.skullGroup && this.skullJaw) {
      const sk = this.skullGroup;
      const k = Math.max(topR * 2.6 * Math.min(topVis, 1), MIN_SCALE);
      sk.position.set(topX, topY + k * 0.35, topZ);
      sk.scale.setScalar(k);
      sk.rotation.y = this.dirX * 0.4 + Math.sin(this.time * 2 + this.dirZ) * 0.15;
      sk.rotation.x = -0.15;
      this.skullJaw.rotation.x = 0.1 + 0.08 * Math.sin(this.time * 6 + this.dirX * 4);
      sk.visible = topVis > 0.05;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Billboard pools: SoulWisps and BoneDust
// ---------------------------------------------------------------------------------------------------------------

interface Blob {
  live: boolean; persist: boolean; pos: THREE.Vector3; vel: THREE.Vector3; anchor: THREE.Vector3; spread: number;
  age: number; life: number; size: number; seed: number;
}

const NOISE_GLSL = /* glsl */ `
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

const BILLBOARD_VERT = /* glsl */ `
  attribute vec4 aS; varying vec2 vUv; varying vec4 vS;
  void main() {
    vUv = uv; vS = aS;
    vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
    c.xy += position.xy * vec2(sx, sy);
    gl_Position = projectionMatrix * c;
  }`;

class BlobPool {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  gravity = 0;
  drag = 1.5;
  rise = 0;
  /** 'flame' wisps are taller than wide; 'dust' puffs grow as they age. */
  private flame: boolean;
  private blobs: Blob[] = [];
  private aS: THREE.InstancedBufferAttribute;
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(max: number, flame: boolean) {
    this.flame = flame;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aS', this.aS);
    const mat = new THREE.ShaderMaterial({
      uniforms: flame
        ? { uCore: { value: new THREE.Color(BONE.core).multiplyScalar(0.9) }, uHot: { value: new THREE.Color(BONE.hot).multiplyScalar(0.92) }, uBody: { value: new THREE.Color(BONE.body) } }
        : { uBase: { value: new THREE.Color(0x7a6e5e) }, uLight: { value: new THREE.Color(0xa89c88) } },
      vertexShader: BILLBOARD_VERT,
      fragmentShader: flame
        ? /* glsl */ `
          uniform vec3 uCore, uHot, uBody; varying vec2 vUv; varying vec4 vS;
          ${NOISE_GLSL}
          void main() {
            float age = vS.x, seed = vS.y;
            vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y);
            p.x += sin(p.y * 5.0 + seed * 6.28 + age * 7.0) * 0.14 * p.y;
            float w = (1.0 - pow(p.y, 1.25)) * (0.5 + 0.5 * smoothstep(0.0, 0.3, p.y));
            float edge = clamp((w * 0.9 - abs(p.x)) / max(w * 0.9, 0.05), 0.0, 1.0);
            float n = vnoise(vec2(p.x * 3.0 + seed * 10.0, p.y * 4.0 - age * 3.0));
            float keep = edge * 0.85 + n * 0.5 - age * 0.95 - p.y * 0.12;
            if (edge <= 0.0 || keep < 0.12) discard;
            vec3 col = mix(uBody, uHot, smoothstep(0.4, 0.8, edge + (1.0 - p.y) * 0.25 - age * 0.2));
            col = mix(col, uCore, smoothstep(0.7, 1.0, edge * (1.0 - p.y) + 0.2 - age * 0.3));
            if (keep < 0.24) col = uBody * 0.5;
            gl_FragColor = vec4(col, 1.0);
          }`
        : /* glsl */ `
          uniform vec3 uBase, uLight; varying vec2 vUv; varying vec4 vS;
          ${NOISE_GLSL}
          void main() {
            float age = vS.x, seed = vS.y;
            vec2 p = vUv * 2.0 - 1.0;
            float r = length(p);
            float n = vnoise(p * 2.4 + seed * 9.0);
            float edge = 0.8 + (n - 0.5) * 0.55 - age * 0.55;
            if (r > edge) discard;
            float sh = p.y * 0.6 - p.x * 0.35 + (n - 0.5) * 0.5;
            vec3 col = sh > 0.12 ? uLight : uBase;
            if (r > edge - 0.12) col *= 0.78;
            gl_FragColor = vec4(col, 1.0);
          }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.blobs.push({
        live: false, persist: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), anchor: new THREE.Vector3(), spread: 0,
        age: 0, life: 1, size: 0.2, seed: Math.random(),
      });
    }
  }

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, life: number, size: number, persist = false, spread = 0) {
    const b = this.blobs[this.cursor];
    this.cursor = (this.cursor + 1) % this.blobs.length;
    b.live = true;
    b.persist = persist;
    b.pos.copy(pos);
    b.anchor.copy(pos);
    b.vel.copy(vel);
    b.spread = spread;
    b.age = 0;
    b.life = life;
    b.size = size;
    b.seed = Math.random();
    return b;
  }

  release() {
    for (const b of this.blobs) b.persist = false;
  }

  reset() {
    for (const b of this.blobs) { b.live = false; b.persist = false; }
    this.frozen = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    const ra = this.aS.array as Float32Array;
    let n = 0;
    for (const b of this.blobs) {
      if (!b.live) continue;
      b.age += d;
      if (b.age >= b.life) {
        if (b.persist) {
          // A flickering wisp: it burns out and a new one lights at the anchor.
          b.age = 0;
          b.life = 0.45 + Math.random() * 0.45;
          b.seed = Math.random();
          b.size *= 0.9 + Math.random() * 0.2;
          b.pos.set(b.anchor.x + (Math.random() - 0.5) * b.spread, b.anchor.y + (Math.random() - 0.5) * b.spread * 0.6, b.anchor.z + (Math.random() - 0.5) * b.spread);
          b.vel.set((Math.random() - 0.5) * 0.15, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.15);
        } else { b.live = false; continue; }
      }
      b.vel.y += (this.rise - this.gravity) * d;
      b.vel.multiplyScalar(Math.max(0, 1 - this.drag * d));
      b.pos.addScaledVector(b.vel, d);
      const u = b.age / b.life;
      let sx: number, sy: number;
      if (this.flame) {
        const pop = Math.min(1, b.age / 0.08);
        sx = b.size * pop * (1 - 0.35 * u);
        sy = sx * 1.7;
      } else {
        sx = sy = b.size * (0.55 + 0.9 * easeOut(u));
      }
      this.m.compose(b.pos, this.q.identity(), this.s.set(Math.max(sx, MIN_SCALE), Math.max(sy, MIN_SCALE), 1));
      this.mesh.setMatrixAt(n, this.m);
      ra[n * 4] = u;
      ra[n * 4 + 1] = b.seed;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aS.needsUpdate = true;
  }
}

/**
 * Pooled teal soulfire wisps: small unlit teardrop flames with eroding, wobbling edges (a hot core, a teal body, a dark
 * teal rim), never spheres. `attach(pos, count, spread)` lights wisps that keep flickering at a spot until `release()`;
 * `puff(pos, count, spread)` throws a one-shot handful that rises and burns out. `frozen` holds them (a dead beat).
 * `update(dt)` each frame. Add `mesh`.
 */
export class SoulWisps {
  private pool = new BlobPool(56, true);
  private v = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor() {
    this.pool.rise = 0.3;
    this.pool.drag = 1.2;
  }

  get mesh() {
    return this.pool.mesh;
  }

  get frozen() {
    return this.pool.frozen;
  }

  set frozen(v: boolean) {
    this.pool.frozen = v;
  }

  attach(pos: THREE.Vector3, count = 3, spread = 0.2, size = 0.22) {
    for (let i = 0; i < count; i++) {
      this.p.set(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread * 0.6, pos.z + (Math.random() - 0.5) * spread);
      this.v.set((Math.random() - 0.5) * 0.15, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.15);
      const b = this.pool.spawn(this.p, this.v, 0.3 + Math.random() * 0.5, size * (0.8 + Math.random() * 0.4), true, spread);
      b.anchor.copy(pos);
    }
  }

  puff(pos: THREE.Vector3, count = 6, spread = 0.6, size = 0.26) {
    for (let i = 0; i < count; i++) {
      this.p.set(pos.x + (Math.random() - 0.5) * spread, pos.y + Math.random() * 0.2, pos.z + (Math.random() - 0.5) * spread);
      this.v.set((Math.random() - 0.5) * 1.4, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 1.4);
      this.pool.spawn(this.p, this.v, 0.5 + Math.random() * 0.4, size * (0.7 + Math.random() * 0.6));
    }
  }

  release() {
    this.pool.release();
  }

  reset() {
    this.pool.reset();
  }

  update(dt: number) {
    this.pool.update(dt);
  }
}

/**
 * Small grey-brown dust puffs with eroding edges and a lighter top-left (two-tone toon, no soft blobs). `burst(pos,
 * count, speed, size)` throws a handful outward and up that slow down and fade, `ring(center, radius, count, size)`
 * sends puffs outward from a circle. `frozen` holds them. `update(dt)` each frame. Add `mesh`.
 */
export class BoneDust {
  private pool = new BlobPool(48, false);
  private v = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor() {
    this.pool.drag = 2.4;
  }

  get mesh() {
    return this.pool.mesh;
  }

  get frozen() {
    return this.pool.frozen;
  }

  set frozen(v: boolean) {
    this.pool.frozen = v;
  }

  burst(pos: THREE.Vector3, count = 6, speed = 2.2, size = 0.45) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      this.p.set(pos.x + Math.cos(a) * 0.15, Math.max(pos.y, 0) + 0.1, pos.z + Math.sin(a) * 0.15);
      this.v.set(Math.cos(a) * sp, 0.4 + Math.random() * 1.1, Math.sin(a) * sp);
      this.pool.spawn(this.p, this.v, 0.55 + Math.random() * 0.4, size * (0.7 + Math.random() * 0.7));
    }
  }

  ring(center: THREE.Vector3, radius: number, count = 12, size = 0.6) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4, r = radius * (0.1 + Math.random() * 0.25);
      this.p.set(center.x + Math.cos(a) * r, 0.15, center.z + Math.sin(a) * r);
      const sp = (radius * 0.85) / 0.5;
      this.v.set(Math.cos(a) * sp, 0.3 + Math.random() * 0.8, Math.sin(a) * sp);
      this.pool.spawn(this.p, this.v, 0.5 + Math.random() * 0.35, size * (0.7 + Math.random() * 0.6));
    }
  }

  reset() {
    this.pool.reset();
  }

  update(dt: number) {
    this.pool.update(dt);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// BoneShards
// ---------------------------------------------------------------------------------------------------------------

interface Shard {
  live: boolean; rest: boolean; pos: THREE.Vector3; vel: THREE.Vector3; axis: THREE.Vector3; ang: number; spin: number;
  age: number; life: number; size: number; g: number;
}

/**
 * Bone chips: small pointed ivory shards (dark ends) that tumble under gravity, bounce once on the floor and shrink
 * away in their last third. `burst(pos, count, speed, up, size)` throws them out and up, `ring(center, count, radius,
 * seconds, y, size)` fires a flat ring that reaches `radius` in `seconds`. Up to 56 at once. `frozen` holds them.
 * `update(dt)` each frame. Add `mesh`.
 */
export class BoneShards {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private shards: Shard[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(max = 56) {
    const geo = cached('shard', () => boneChunkGeometry(4, 0.3).clone().translate(0, -0.5, 0));
    this.mesh = new THREE.InstancedMesh(geo, boneMaterial(0), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.shards.push({ live: false, rest: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), ang: 0, spin: 0, age: 0, life: 1, size: 0.3, g: 14 });
    }
  }

  shoot(pos: THREE.Vector3, vel: THREE.Vector3, life = 0.9, size = 0.3, g = 14) {
    const sh = this.shards[this.cursor];
    this.cursor = (this.cursor + 1) % this.shards.length;
    sh.live = true;
    sh.rest = false;
    sh.pos.copy(pos);
    sh.vel.copy(vel);
    sh.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    sh.ang = Math.random() * 6.28;
    sh.spin = (Math.random() - 0.5) * 16;
    sh.age = 0;
    sh.life = life;
    sh.size = size;
    sh.g = g;
  }

  burst(pos: THREE.Vector3, count = 8, speed = 4.5, up = 3, size = 0.34) {
    const v = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      v.set(Math.cos(a) * sp, up * (0.5 + Math.random() * 0.8), Math.sin(a) * sp);
      p.set(pos.x, pos.y > 0.2 ? pos.y : 0.3, pos.z);
      this.shoot(p, v, 0.7 + Math.random() * 0.5, size * (0.6 + Math.random() * 0.8));
    }
  }

  ring(center: THREE.Vector3, count = 14, radius = 4, seconds = 0.45, y = 0.9, size = 0.38) {
    const v = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const sp = (radius / seconds) * (0.9 + Math.random() * 0.2);
      v.set(Math.cos(a) * sp, 0.4 + Math.random() * 0.8, Math.sin(a) * sp);
      p.set(center.x + Math.cos(a) * 0.8, y + (Math.random() - 0.5) * 0.4, center.z + Math.sin(a) * 0.8);
      this.shoot(p, v, seconds + 0.4, size * (0.7 + Math.random() * 0.6), 4);
    }
  }

  reset() {
    for (const sh of this.shards) sh.live = false;
    this.frozen = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    let n = 0;
    for (const sh of this.shards) {
      if (!sh.live) continue;
      sh.age += d;
      if (sh.age >= sh.life) { sh.live = false; continue; }
      if (!sh.rest) {
        sh.vel.y -= sh.g * d;
        sh.pos.addScaledVector(sh.vel, d);
        sh.ang += sh.spin * d;
        if (sh.pos.y < 0.06 && sh.vel.y < 0) {
          sh.pos.y = 0.06;
          if (Math.abs(sh.vel.y) > 2.2) { sh.vel.multiplyScalar(0.45); sh.vel.y = -sh.vel.y * 0.7; } else { sh.rest = true; sh.spin = 0; }
        }
      }
      const u = sh.age / sh.life;
      const k = Math.max(sh.size * (1 - sstep(0.66, 1, u)), MIN_SCALE);
      this.q.setFromAxisAngle(sh.axis, sh.ang);
      this.m.compose(sh.pos, this.q, this.s.set(k * 0.55, k * 1.5, k * 0.55));
      this.mesh.setMatrixAt(n, this.m);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// GroundCracks
// ---------------------------------------------------------------------------------------------------------------

/**
 * A cracked circle on the floor: voronoi cracks (angular, thinning toward the rim) with a dark edge, an ivory dust band
 * and teal light in the middle of every crack that pulses, over a faint dark scorch, closed by a ring crack at the
 * radius. `spread(center, radius, seconds)` grows it from the middle, `fade(seconds)` fades it out, `reset()` hides
 * it. `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class GroundCracks {
  readonly mesh: THREE.Mesh;
  frozen = false;
  private mat: THREE.ShaderMaterial;
  private live = false;
  private age = 0;
  private dur = 0.3;
  private fadeAge = -1;
  private fadeDur = 0.5;
  private time = 0;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      uniforms: {
        uCenter: { value: new THREE.Vector2() }, uRadius: { value: 3 }, uSpread: { value: 0 }, uFade: { value: 1 }, uTime: { value: 0 },
        uScale: { value: 1 }, uDark: { value: new THREE.Color(BONE.dark) }, uTeal: { value: new THREE.Color(BONE.body) },
        uHot: { value: new THREE.Color(BONE.hot).multiplyScalar(0.92) }, uBone: { value: new THREE.Color(BONE.bone).multiplyScalar(0.62) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vW;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform vec2 uCenter; uniform float uRadius, uSpread, uFade, uTime, uScale;
        uniform vec3 uDark, uTeal, uHot, uBone; varying vec2 vW;
        vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
        vec4 voro(vec2 x) {
          vec2 n = floor(x), f = fract(x); float F1 = 8.0, F2 = 8.0; float i1 = 0.0, i2 = 0.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j)); vec2 o = hash2(n + g); vec2 r = g + o - f; float d = dot(r, r);
            if (d < F1) { F2 = F1; i2 = i1; F1 = d; i1 = o.x; } else if (d < F2) { F2 = d; i2 = o.x; }
          }
          return vec4(sqrt(F1), sqrt(F2), i1, i2);
        }
        void main() {
          vec2 q = vW - uCenter;
          float rr = length(q) / uRadius, ang = atan(q.y, q.x);
          float reach = uSpread * (1.0 + 0.1 * sin(ang * 3.0 + 2.0) + 0.06 * sin(ang * 7.0));
          float m = 1.0 - smoothstep(reach - 0.07, reach, rr);
          if (m < 0.01) discard;
          vec4 v = voro(q * uScale + 3.7);
          float d = (v.y - v.x) * 0.5 / uScale;
          // Only some edges are cracks, fewer toward the rim.
          float eh = fract((v.z + v.w) * 7.31 + (v.z * v.w) * 3.7);
          float keep = step(eh, 0.92 - 0.62 * clamp(rr, 0.0, 1.0));
          float sc = uRadius > 5.0 ? 1.6 : 1.0;
          float w = mix(0.1, 0.035, clamp(rr, 0.0, 1.0)) * sc;
          // The ring crack that closes the circle.
          float dr = abs(rr - 0.95) * uRadius * 0.9;
          float dk = mix(1.0e3, d, keep);
          dk = min(dk, dr * 1.4);
          float dark = 1.0 - smoothstep(w * 0.8, w * 1.3, dk);
          float teal = 1.0 - smoothstep(w * 0.12, w * 0.25, dk);
          float pulse = 0.82 + 0.18 * sin(uTime * 5.0 + v.z * 9.0);
          vec3 col = uDark;
          col = mix(col, mix(uTeal, uHot, smoothstep(w * 0.06, 0.0, dk) * 0.7) * pulse, teal);
          float fill = 0.16 * (1.0 - smoothstep(0.6, 1.0, rr));
          float a = max(max(dark * 0.8, teal), fill);
          if (a < 0.02) discard;
          gl_FragColor = vec4(col, a * m * uFade);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
  }

  spread(center: THREE.Vector3, radius: number, seconds = 0.3) {
    this.live = true;
    this.age = 0;
    this.dur = Math.max(seconds, 0.05);
    this.fadeAge = -1;
    this.mesh.visible = true;
    this.mesh.position.set(center.x, 0.035, center.z);
    this.mesh.scale.set(radius * 1.12, 1, radius * 1.12);
    this.mat.uniforms.uCenter.value.set(center.x, center.z);
    this.mat.uniforms.uRadius.value = radius;
    this.mat.uniforms.uScale.value = 3.4 / radius;
    this.mat.uniforms.uSpread.value = 0.01;
    this.mat.uniforms.uFade.value = 1;
  }

  fade(seconds = 0.5) {
    if (!this.live) return;
    this.fadeAge = 0;
    this.fadeDur = Math.max(seconds, 0.05);
  }

  reset() {
    this.live = false;
    this.mesh.visible = false;
    this.fadeAge = -1;
    this.frozen = false;
  }

  update(dt: number) {
    if (!this.live) return;
    const d = this.frozen ? 0 : dt;
    this.age += d;
    this.time += d;
    if (this.fadeAge >= 0) this.fadeAge += d;
    const k = this.fadeAge < 0 ? 0 : clamp01(this.fadeAge / this.fadeDur);
    if (k >= 1) { this.live = false; this.mesh.visible = false; return; }
    this.mat.uniforms.uSpread.value = Math.max(easeOut(this.age / this.dur), 0.01);
    this.mat.uniforms.uFade.value = 1 - k * k;
    this.mat.uniforms.uTime.value = this.time;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// BoneLance
// ---------------------------------------------------------------------------------------------------------------

interface LancePiece { g: THREE.Group; pos: THREE.Vector3; off: THREE.Vector3; rot: THREE.Vector3; delay: number }

/**
 * The bone spear (Q): five chunky vertebrae with transverse spikes and a pointed head, 2.2 long along +Z, with teal
 * soulfire in the gaps between them. `assemble(center, dir, k)` (k 0..1) flies the pieces in from around `center` into
 * place; `place(center, dir)` puts the finished spear there; `hide()` / `reset()` hide it; `update(dt)` flickers the
 * joints. Add `mesh`.
 */
export class BoneLance {
  readonly mesh = new THREE.Group();
  private root = new THREE.Group();
  private pieces: LancePiece[] = [];
  private glows: THREE.Mesh[] = [];
  private time = 0;
  private target = new THREE.Vector3();
  private k = 1;

  constructor() {
    const starts = [-1.1, -0.76, -0.42, -0.08, 0.26], radii = [0.17, 0.16, 0.15, 0.14, 0.13];
    for (let i = 0; i < 6; i++) {
      const head = i === 5;
      const g = new THREE.Group();
      const len = head ? 0.5 : 0.3, z0 = head ? 0.6 : starts[i], r = head ? 0.17 : radii[i];
      const m = put(g, head ? boneChunkGeometry(5, 0.04, 'z') : boneChunkGeometry(6, 0.85, 'z'), boneMaterial(i));
      m.scale.set(r, r, len);
      if (i >= 1 && i <= 3) {
        // Transverse spikes, alternating sideways and up.
        for (const s of [-1, 1]) {
          const w = put(g, boneChunkGeometry(4, 0.12, 'z'), boneMaterial(i + 1));
          w.scale.set(0.05, 0.05, 0.26);
          w.position.set(0, 0, len * 0.5);
          if (i % 2) w.rotation.y = s * Math.PI * 0.5;
          else w.rotation.x = -s * Math.PI * 0.5;
        }
      }
      const pos = new THREE.Vector3(0, 0, z0);
      g.position.copy(pos);
      this.root.add(g);
      const a = hsh(i * 3.3 + 0.7) * 6.28;
      this.pieces.push({
        g, pos, off: new THREE.Vector3(Math.cos(a) * (0.9 + hsh(i) * 0.8), 0.5 + hsh(i + 9) * 1.1, Math.sin(a) * (0.9 + hsh(i + 4) * 0.8)),
        rot: new THREE.Vector3(hsh(i + 2) * 5, hsh(i + 5) * 5, hsh(i + 8) * 5), delay: i * 0.09,
      });
    }
    // Soulfire in the joints.
    for (let i = 0; i < 5; i++) {
      const z = i === 4 ? 0.58 : starts[i + 1] - 0.02;
      const gm = put(this.root, cached('lanceGlow', () => new THREE.OctahedronGeometry(0.1, 0)), wispMat(), 0, 0, z + (i === 4 ? 0 : 0.0));
      gm.scale.set(1, 1, 0.7);
      this.glows.push(gm);
    }
    this.mesh.add(this.root);
    this.mesh.visible = false;
  }

  /** Flies the pieces in around `center`, `k` 0 (scattered) to 1 (built). The spear points along `dir`. */
  assemble(center: THREE.Vector3, dir: THREE.Vector3, k: number) {
    this.k = k;
    this.mesh.visible = true;
    this.root.position.copy(center);
    this.root.lookAt(this.target.copy(center).add(dir));
    for (const p of this.pieces) {
      const e = easeOut((k - p.delay) / 0.55);
      p.g.position.set(p.pos.x + p.off.x * (1 - e), p.pos.y + p.off.y * (1 - e), p.pos.z + p.off.z * (1 - e));
      p.g.rotation.set(p.rot.x * (1 - e), p.rot.y * (1 - e), p.rot.z * (1 - e));
      p.g.scale.setScalar(Math.max(0.2 + 0.8 * e, MIN_SCALE));
    }
    this.flicker();
  }

  place(center: THREE.Vector3, dir: THREE.Vector3) {
    this.assemble(center, dir, 1.5);
  }

  hide() {
    this.mesh.visible = false;
  }

  reset() {
    this.hide();
    this.time = 0;
  }

  update(dt: number) {
    this.time += dt;
    if (this.mesh.visible) this.flicker();
  }

  private flicker() {
    const built = clamp01((this.k - 0.35) / 0.4);
    this.glows.forEach((gm, i) => {
      const s = built * (0.8 + 0.35 * Math.sin(this.time * 14 + i * 2.1) + 0.15 * Math.sin(this.time * 31 + i));
      gm.scale.set(Math.max(s, MIN_SCALE), Math.max(s, MIN_SCALE), Math.max(s * 0.7, MIN_SCALE));
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// RibCage
// ---------------------------------------------------------------------------------------------------------------

/**
 * A dome of curved ribs standing in a ring around `center` (the ossuary ward): each rib is a chain of knobby bone
 * segments that grows up from the floor in turn, bends outward when `flex` rises and crumbles from the top.
 * `set(center, radius, height, grow, flex, crumble, spin)` poses it every frame (grow, flex, crumble 0..1; spin in
 * radians), `pointAt(rib, s, flex, out)` gives a point on a rib for attaching wisps. `hide()` / `reset()` hide it. Add `mesh`.
 */
export class RibCage {
  readonly mesh: THREE.InstancedMesh;
  readonly ribs = 8;
  readonly segs = 7;
  private center = new THREE.Vector3();
  private radius = 1.4;
  private height = 2.3;
  private spin = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private t = new THREE.Vector3();

  constructor() {
    this.mesh = new THREE.InstancedMesh(boneChunkGeometry(6, 0.75), boneMaterial(0), this.ribs * this.segs);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  pointAt(rib: number, s: number, flex: number, out: THREE.Vector3) {
    const th = s * Math.PI * 0.5 * 0.93;
    const a = (rib / this.ribs) * Math.PI * 2 + this.spin + s * 0.35 + (hsh(rib * 1.7) - 0.5) * 0.08;
    const r = this.radius * Math.cos(th) * (1 + flex * 0.38 * Math.sin(Math.min(s, 1) * Math.PI)) + 0.04;
    const y = this.height * Math.pow(Math.sin(th), 0.85) * (1 - 0.04 * flex);
    return out.set(this.center.x + Math.cos(a) * r, y, this.center.z + Math.sin(a) * r);
  }

  set(center: THREE.Vector3, radius: number, height: number, grow: number, flex: number, crumble: number, spin = 0) {
    this.center.copy(center).setY(0);
    this.radius = radius;
    this.height = height;
    this.spin = spin;
    this.mesh.visible = true;
    let n = 0;
    for (let j = 0; j < this.ribs; j++) {
      const rj = 0.8 + hsh(j * 2.1 + 0.3) * 0.5;
      for (let k = 0; k < this.segs; k++) {
        const s0 = k / this.segs, s1 = (k + 1) / this.segs;
        const g = easeOutBack((grow - s0 * 0.8 - (j % 3) * 0.03) / 0.22);
        const cr = clamp01(crumble * 1.6 - (1 - s0) * 0.6 - hsh(j + k * 0.3) * 0.15);
        const vis = Math.max(g * (1 - cr * cr), 0);
        if (vis < 0.01) continue;
        this.pointAt(j, s0, flex, this.a);
        this.pointAt(j, s1, flex, this.b);
        this.t.subVectors(this.b, this.a);
        const len = this.t.length();
        this.t.multiplyScalar(1 / Math.max(len, 1e-4));
        this.q.setFromUnitVectors(UP, this.t);
        const rad = 0.105 * rj * (1 - 0.5 * s0) * (0.9 + 0.2 * hsh(k * 3.7 + j));
        this.a.addScaledVector(this.t, -len * 0.06);
        this.a.y -= cr * 0.6;
        this.m.compose(this.a, this.q, this.s.set(Math.max(rad * vis, MIN_SCALE), Math.max(len * 1.14 * vis, MIN_SCALE), Math.max(rad * vis * 0.8, MIN_SCALE)));
        this.mesh.setMatrixAt(n++, this.m);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
    this.mesh.count = 0;
  }

  reset() {
    this.hide();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// BoneHand
// ---------------------------------------------------------------------------------------------------------------

interface Finger { root: THREE.Group; joints: THREE.Group[]; k: number[]; yaw: number }

/**
 * The colossal skeletal hand (the ultimate): a forearm of two stacked bone chains rising out of the ground at `base`, a
 * palm of four knuckle bones and a plate, four three-bone fingers (pointed claw tips) and a two-bone thumb, soulfire in
 * every joint. About 5 long fingers and a 2 wide palm at scale 1.
 * `place(base, wrist, face, pitch, curl, spread, time)`: `base` is where the forearm leaves the floor, `wrist` the
 * wrist joint, `face` the unit ground direction the fingers point, `pitch` radians the hand tips down (0 = flat, palm
 * down; 1.4 = fingers straight down), `curl` 0 open .. 1 fist, `spread` 0..1 fans the fingers, `time` flickers the
 * joints. `hide()` / `reset()` hide it. Add `mesh`.
 */
export class BoneHand {
  readonly mesh = new THREE.Group();
  private hand = new THREE.Group();
  private fingers: Finger[] = [];
  private thumb: Finger;
  private glows: THREE.Mesh[] = [];
  private fore: THREE.Mesh[] = [];
  private foreGlow: THREE.Mesh[] = [];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpT = new THREE.Vector3();
  private tmpS = new THREE.Vector3();

  constructor() {
    this.hand.rotation.order = 'YXZ';
    const glowGeo = cached('handGlow', () => new THREE.OctahedronGeometry(1, 0));
    const addGlow = (parent: THREE.Object3D, z: number, r: number) => {
      const gm = put(parent, glowGeo, wispMat(), 0, 0, z);
      gm.scale.setScalar(r);
      this.glows.push(gm);
    };
    // Palm: a plate, four knuckle bones and wrist bones.
    const plate = put(this.hand, boneChunkGeometry(4, 1, 'z'), boneMaterial(2), 0, 0.1, 0.1);
    plate.scale.set(1.0, 0.16, 1.8);
    const xs = [-0.66, -0.22, 0.22, 0.66];
    const lens = [0.95, 1.05, 1.0, 0.85];
    xs.forEach((x, i) => {
      const k = put(this.hand, boneChunkGeometry(6, 0.85, 'z'), boneMaterial(i), x, 0.12, -0.05);
      k.scale.set(0.2, 0.2, 1.95);
      const v = (j: number) => 1 + 0.16 * Math.sin(i * 2.3 + j * 3.1);
      const f = this.makeFinger(x, 1.9 + (i % 2) * 0.06, [2.0 * lens[i] * v(0), 1.7 * lens[i] * v(1), 1.3 * lens[i] * v(2)], [0.2 + 0.01 * i, 0.17, 0.14], [0.92 + 0.06 * i, 1.12, 0.9 + 0.05 * i], i, addGlow);
      // A rounded knuckle on the back of each finger root: together they make the ridge of the fist.
      const kn = put(this.hand, cached('knuckle', () => withTone(new THREE.IcosahedronGeometry(1, 0), () => 1)), boneMaterial(i + 2), x, 0.16, 1.95);
      kn.scale.set(0.3, 0.28, 0.3);
      this.fingers.push(f);
    });
    for (let i = 0; i < 3; i++) {
      const c = put(this.hand, boneChunkGeometry(5, 0.9), boneMaterial(i + 1), -0.5 + i * 0.5, 0.05, -0.28);
      c.scale.set(0.3, 0.45, 0.3);
      c.rotation.x = Math.PI / 2;
    }
    this.thumb = this.makeFinger(-1.0, 0.5, [1.6, 1.25], [0.23, 0.18], [0.9, 1.0], 5, addGlow);
    // Wrist bones: a row of rounded carpals between the palm and the forearm.
    for (let i = 0; i < 5; i++) {
      const cp = put(this.hand, cached('knuckle', () => withTone(new THREE.IcosahedronGeometry(1, 0), () => 1)), boneMaterial(i), -0.62 + i * 0.31, 0.0 + (i % 2) * 0.06, -0.5 - (i % 3) * 0.1);
      cp.scale.set(0.3, 0.26, 0.3);
    }
    addGlow(this.hand, 0, 0.17);
    this.mesh.add(this.hand);
    // The forearm: a thick bone (4 segments) and a thinner one beside it, glows at the joints of the thick one.
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(boneChunkGeometry(6, 0.88), boneMaterial(i));
      this.fore.push(m);
      this.mesh.add(m);
    }
    for (let i = 0; i < 3; i++) {
      const gm = new THREE.Mesh(glowGeo, wispMat());
      this.foreGlow.push(gm);
      this.mesh.add(gm);
    }
    this.mesh.visible = false;
  }

  private makeFinger(x: number, z: number, lens: number[], radii: number[], ks: number[], seed: number, addGlow: (p: THREE.Object3D, z: number, r: number) => void): Finger {
    const root = new THREE.Group();
    root.position.set(x, 0.12, z);
    this.hand.add(root);
    const joints: THREE.Group[] = [];
    let parent: THREE.Object3D = root;
    lens.forEach((len, i) => {
      const j = new THREE.Group();
      if (i > 0) j.position.z = lens[i - 1];
      parent.add(j);
      const last = i === lens.length - 1;
      const m = put(j, last ? boneChunkGeometry(5, 0.1, 'z') : boneChunkGeometry(6, 0.82, 'z'), boneMaterial(seed + i));
      m.scale.set(radii[i], radii[i], len);
      addGlow(j, 0.04, radii[i] * 0.55);
      joints.push(j);
      parent = j;
    });
    return { root, joints, k: ks, yaw: 0 };
  }

  place(base: THREE.Vector3, wrist: THREE.Vector3, face: THREE.Vector3, pitch: number, curl: number, spread: number, time = 0, scale = 1) {
    this.mesh.visible = true;
    this.hand.scale.setScalar(scale);
    this.hand.position.copy(wrist);
    this.hand.rotation.set(pitch, Math.atan2(face.x, face.z), 0);
    const c = Math.max(0, curl);
    this.fingers.forEach((f, i) => {
      f.root.rotation.y = (i - 1.5) * (0.17 * spread - 0.06 * c);
      f.joints.forEach((j, n) => { j.rotation.x = c * 1.4 * f.k[n] - (1 - c) * 0.06 * n; });
    });
    // The thumb folds across the front of the curled fingers.
    this.thumb.root.position.set(-1.0 + 0.2 * c, 0.12 - 1.1 * c, 0.5 + 1.5 * c);
    this.thumb.root.rotation.set(0, -0.75 + c * 2.0 - spread * 0.2, 0);
    this.thumb.joints.forEach((j, n) => { j.rotation.x = c * 0.35 * this.thumb.k[n]; });
    this.glows.forEach((g, i) => {
      const s = g.userData.r ?? (g.userData.r = g.scale.x);
      g.scale.setScalar(Math.max(s * (0.82 + 0.3 * Math.sin(time * 9 + i * 1.7)), MIN_SCALE));
    });
    // Forearm: two chains from the floor to the wrist, slightly bowed.
    const side = this.tmpS.set(face.z, 0, -face.x).normalize();
    for (let chain = 0; chain < 2; chain++) {
      const off = (chain === 0 ? 0 : 0.78) * scale;
      const rad = (chain === 0 ? 0.52 : 0.3) * scale;
      for (let i = 0; i < 4; i++) {
        const u0 = i / 4, u1 = (i + 1) / 4;
        this.armPoint(base, wrist, side, off, u0, this.tmpA);
        this.armPoint(base, wrist, side, off, u1, this.tmpB);
        this.tmpT.subVectors(this.tmpB, this.tmpA);
        const len = this.tmpT.length();
        this.tmpT.multiplyScalar(1 / Math.max(len, 1e-4));
        const m = this.fore[chain * 4 + i];
        m.position.copy(this.tmpA).addScaledVector(this.tmpT, -len * 0.05);
        m.quaternion.setFromUnitVectors(UP, this.tmpT);
        m.scale.set(rad * (1 - 0.18 * u0), Math.max(len * 1.1, MIN_SCALE), rad * (1 - 0.18 * u0));
      }
    }
    for (let i = 0; i < 3; i++) {
      this.armPoint(base, wrist, side, 0, (i + 1) / 4, this.foreGlow[i].position);
      this.foreGlow[i].scale.setScalar(Math.max(0.3 * (0.85 + 0.25 * Math.sin(time * 8 + i * 2)), MIN_SCALE));
    }
  }

  private armPoint(base: THREE.Vector3, wrist: THREE.Vector3, side: THREE.Vector3, off: number, u: number, out: THREE.Vector3) {
    out.lerpVectors(base, wrist, u);
    out.addScaledVector(side, off * (0.4 + 0.6 * u));
    out.y += Math.sin(u * Math.PI) * 0.35;
    return out;
  }

  hide() {
    this.mesh.visible = false;
  }

  reset() {
    this.hide();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Skeleton look for summons
// ---------------------------------------------------------------------------------------------------------------

/**
 * The summons' look (`SummonOptions.look`): a small skeleton about 0.9 high, facing +Z: skull with teal eyes and a loose
 * jaw, a spine with four rib arcs and a soulfire glow inside the cage, pelvis, jointed legs and arms. A `melee` unit
 * carries a blade (swings on `pose.swing`), a `ranged` unit holds a bow in its left hand and draws with the right
 * (kicks on `pose.shot`). The body material is repainted ivory and the outline dark brown, so the arena's hit flash
 * still works; the eyes use the palette's unlit eye material (set teal).
 */
export const skeletonLook: MinionLook = (kind, p: MinionPalette) => {
  if (kind === 'turret') return defaultLook(kind, p);
  p.body.color.set(0xd8cfb8);
  p.trim.color.set(0xa89c80);
  p.eye.color.set(BONE.hot).multiplyScalar(0.92);
  p.outline.color.set(0x1a0f08);
  const root = new THREE.Group();
  const boxGeo = () => cached('skelBox', () => new THREE.BoxGeometry(1, 1, 1));
  const down = (parent: THREE.Object3D, w: number, len: number, mat: THREE.Material, d = 5, z = 0) => {
    const m = put(parent, boneChunkGeometry(d, 0.82), mat, 0, 0, z);
    m.rotation.x = Math.PI;
    m.scale.set(w, len, w);
    m.castShadow = true;
    return m;
  };
  // Pelvis and spine.
  const pel = put(root, boneChunkGeometry(6, 0.9), p.body, 0.11, 0.4, 0);
  pel.rotation.z = Math.PI / 2;
  pel.scale.set(0.06, 0.22, 0.07);
  const spine = put(root, boneChunkGeometry(6, 0.8), p.body, 0, 0.42, -0.05);
  spine.scale.set(0.03, 0.34, 0.03);
  // Rib arcs (open at the back).
  const ribY = [0.52, 0.58, 0.64, 0.7], ribR = [0.1, 0.13, 0.135, 0.11];
  ribY.forEach((y, i) => {
    const arc = Math.PI * 1.3;
    const g = cached(`skelRib${i}`, () => new THREE.TorusGeometry(1, 0.11, 4, 10, arc).rotateZ(Math.PI / 2 - arc / 2).rotateX(Math.PI / 2));
    const rib = put(root, g, p.body, 0, y, -0.02);
    rib.scale.set(ribR[i], ribR[i], ribR[i] * 0.78);
  });
  const stern = put(root, boneChunkGeometry(4, 0.8), p.trim, 0, 0.46, 0.085);
  stern.scale.set(0.022, 0.26, 0.018);
  // Soulfire inside the cage.
  const heart = put(root, cached('skelHeart', () => new THREE.OctahedronGeometry(0.045, 0)), p.eye, 0, 0.6, 0.02);
  // Skull.
  const sk = buildSkull(p.body, p.trim, p.eye);
  sk.group.position.set(0, 0.84, 0.01);
  sk.group.scale.setScalar(0.3);
  root.add(sk.group);
  const hull = new THREE.Mesh(cached('skullCran', () => withTone(new THREE.IcosahedronGeometry(0.5, 1), () => 1)), p.outline);
  hull.position.copy(sk.group.position);
  hull.scale.set(0.3 * 1.16, 0.3 * 0.92 * 1.16, 0.3 * 1.04 * 1.16);
  root.add(hull);
  // Legs: hip -> thigh -> knee -> shin -> foot.
  const legs: { hip: THREE.Group; knee: THREE.Group }[] = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.09, 0.4, 0);
    down(hip, 0.035, 0.2, p.body);
    const knee = new THREE.Group();
    knee.position.y = -0.2;
    down(knee, 0.03, 0.2, p.body);
    const foot = put(knee, boneChunkGeometry(4, 0.6, 'z'), p.trim, 0, -0.2, -0.03);
    foot.scale.set(0.045, 0.03, 0.14);
    hip.add(knee);
    root.add(hip);
    return { hip, knee };
  });
  // Arms: shoulder -> upper -> elbow -> forearm.
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(s * 0.19, 0.74, 0);
    down(sh, 0.028, 0.17, p.body);
    const el = new THREE.Group();
    el.position.y = -0.17;
    down(el, 0.024, 0.17, p.body);
    const hand = put(el, boxGeo(), p.trim, 0, -0.18, 0);
    hand.scale.set(0.05, 0.05, 0.04);
    sh.add(el);
    root.add(sh);
    return { sh, el };
  });
  let bowGroup: THREE.Group | null = null;
  if (kind === 'melee') {
    const blade = put(arms[1].el, boxGeo(), p.trim, 0, -0.19, 0.2);
    blade.scale.set(0.035, 0.05, 0.4);
    const guard = put(arms[1].el, boxGeo(), p.body, 0, -0.19, 0.02);
    guard.scale.set(0.14, 0.035, 0.035);
  } else {
    bowGroup = new THREE.Group();
    bowGroup.position.set(-0.19, 0.74, 0.34);
    const arc = Math.PI;
    const g = cached('skelBow', () => new THREE.TorusGeometry(0.22, 0.014, 4, 12, arc).rotateZ(-Math.PI / 2).rotateY(-Math.PI / 2));
    put(bowGroup, g, p.trim, 0, 0, -0.0);
    const str = put(bowGroup, boxGeo(), p.eye, 0, 0, 0);
    str.scale.set(0.006, 0.44, 0.006);
    root.add(bowGroup);
  }
  let phase = Math.random() * 6;
  return {
    root,
    animate(dt, pose) {
      const w = pose.walk;
      phase += dt * (5 + 9 * w);
      const step = Math.sin(phase);
      root.position.y = Math.abs(step) * 0.04 * w + Math.sin(pose.time * 3 + phase * 0.1) * 0.008;
      legs[0].hip.rotation.x = step * 0.8 * w;
      legs[1].hip.rotation.x = -step * 0.8 * w;
      legs[0].knee.rotation.x = Math.max(0, -step) * 0.9 * w;
      legs[1].knee.rotation.x = Math.max(0, step) * 0.9 * w;
      let lean = 0.06 * w, push = 0;
      if (kind === 'melee') {
        arms[0].sh.rotation.x = -step * 0.7 * w;
        let r = step * 0.7 * w;
        arms[1].el.rotation.x = -0.3;
        if (pose.swing >= 0) {
          const s = pose.swing;
          r = s < 0.6 ? 2.1 * (s / 0.6) : 2.1 - ((s - 0.6) / 0.4) * 3.5;
          lean = s < 0.6 ? -0.18 * (s / 0.6) : -0.18 + ((s - 0.6) / 0.4) * 0.6;
          push = s < 0.6 ? 0 : ((s - 0.6) / 0.4) * 0.3;
          arms[1].el.rotation.x = -0.3 - (s < 0.6 ? 0 : 0.8);
        } else if (pose.shot > 0) r = -1.2 * pose.shot;
        arms[1].sh.rotation.x = r;
        sk.jaw.rotation.x = 0.1 + (pose.swing >= 0 ? 0.35 : 0.08 * Math.abs(Math.sin(pose.time * 7)));
      } else {
        // Left arm out holding the bow, right arm drawing; the shot kicks the right hand forward.
        arms[0].sh.rotation.x = -1.5;
        arms[0].el.rotation.x = 0;
        arms[1].sh.rotation.x = -1.0 + pose.shot * 0.6;
        arms[1].el.rotation.x = -1.5 + pose.shot * 0.8;
        lean = -0.05 + 0.04 * w;
        sk.jaw.rotation.x = 0.08 + 0.3 * pose.shot;
      }
      root.rotation.x = lean;
      root.position.z = push;
      const pulse = 1 + Math.sin(pose.time * 6) * 0.2 + pose.shot * 0.7;
      heart.scale.setScalar(pulse);
      sk.group.rotation.y = Math.sin(pose.time * 1.7) * 0.12;
      if (bowGroup) bowGroup.rotation.x = Math.sin(pose.time * 2) * 0.03;
    },
  };
};
