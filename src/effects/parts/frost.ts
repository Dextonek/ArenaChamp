import * as THREE from 'three';

/**
 * The frost kit (pipeline/designs/kit-frost.md): branching rime ferns that grow across the floor and shatter, clear
 * faceted ice crystals with a pale core line, angular shards, a little snow and cones of toon breath mist. Everything
 * is pooled, takes world-space positions and directions, and has a `reset()`. All materials are normal-blended custom
 * toon shaders kept below the bloom threshold (~0.85) except a pinpoint glint on the crystals when asked for.
 */

/** Palette. Numbers for `THREE.Color`, `FROST_CSS` for APIs that want a string. `rime` is the pale foil. */
export const FROST = {
  core: 0xf6fcff,
  hot: 0xc9efff,
  body: 0x4fb4e8,
  accent: 0xff9ec4,
  dark: 0x081626,
  rime: 0xe8f4fa,
} as const;

export const FROST_CSS = {
  core: '#f6fcff',
  hot: '#c9efff',
  body: '#4fb4e8',
  accent: '#ff9ec4',
  dark: '#081626',
  rime: '#e8f4fa',
} as const;

const UP = new THREE.Vector3(0, 1, 0);
const MIN_SCALE = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const smooth = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };

// ---------------------------------------------------------------------------------------------------------------
// Crystal and shard shaders / geometry
// ---------------------------------------------------------------------------------------------------------------

/** Vertex stage for instanced facets: instance scale may be non-uniform, so the normal uses the inverse-transpose. */
const litVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vBary; varying vec2 vFace; varying float vH;
  attribute vec3 aBary; attribute vec2 aFace;
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
    vBary = aBary;
    vFace = aFace;
    vH = position.y;
    gl_Position = projectionMatrix * mv;
  }`;

const crystalFragment = /* glsl */ `
  uniform vec3 uBody, uDark, uHot, uCore, uRime;
  uniform float uGlint, uGlintAt, uFlare, uBase;
  varying vec3 vN; varying vec3 vBary; varying vec2 vFace; varying float vH;
  void main() {
    vec3 n = normalize(vN);
    vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
    float ndl = dot(n, L);
    // Flat facets: four flat tones from the dark colour up to a lifted body.
    float band = ndl > 0.45 ? 1.0 : (ndl > 0.0 ? 0.66 : (ndl > -0.4 ? 0.36 : 0.14));
    vec3 col = mix(uDark, uBody, band);
    col = mix(col, uHot, step(0.99, band) * 0.4);
    // The body darkens toward the base (crystals only).
    col = mix(uDark, col, mix(1.0, smoothstep(0.0, 0.5, vH), uBase));
    // Thin pale core line along the long axis, in the middle of every facet.
    float cl = 1.0 - smoothstep(0.05, 0.13, abs(vFace.x));
    cl *= smoothstep(0.08, 0.4, vH) * (1.0 - smoothstep(0.8, 0.98, vH)) * uBase;
    col = mix(col, uRime * 0.9, cl * 0.8 * step(0.2, band));
    // Thin pale edge line from barycentrics (masked diagonals stay at 1 and never draw).
    float e = min(vBary.x, min(vBary.y, vBary.z));
    float w = max(fwidth(e), 1e-4);
    float edge = 1.0 - smoothstep(w * 1.4, w * 2.4, e);
    col = mix(col, uHot, edge * 0.85);
    // Flare: the whole crystal goes pale rime for a beat.
    col = mix(col, uRime * 0.86, clamp(uFlare, 0.0, 1.0) * (0.55 + 0.3 * band));
    // Pinpoint glint, only when asked: the edge line runs hot-white at height uGlintAt.
    float g = uGlint * (1.0 - smoothstep(0.0, 0.14, abs(vH - uGlintAt)));
    col = mix(col, uCore * 0.95, clamp(g * (0.25 + 0.75 * edge), 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }`;

function crystalMaterial(base: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBody: { value: new THREE.Color(FROST.body) },
      uDark: { value: new THREE.Color(FROST.dark) },
      uHot: { value: new THREE.Color(FROST.hot) },
      uCore: { value: new THREE.Color(FROST.core) },
      uRime: { value: new THREE.Color(FROST.rime) },
      uGlint: { value: 0 }, uGlintAt: { value: 1 }, uFlare: { value: 0 }, uBase: { value: base ? 1 : 0 },
    },
    vertexShader: litVertex,
    fragmentShader: crystalFragment,
  });
}

/** Builds a flat-shaded, non-indexed geometry from triangles, with barycentric edge data and a across-facet coordinate. */
class FacetBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private bary: number[] = [];
  private face: number[] = [];

  constructor(private centre: THREE.Vector3) {}

  /** `mask`: the vertex opposite a diagonal (that edge is not drawn). `fa/fb/fc`: across-facet coordinate -1..1 per vertex. */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, fa: number, fb: number, fc: number, mask?: THREE.Vector3) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(this.centre);
    let fs = [fa, fb, fc];
    if (n.dot(mid) < 0) { const t = b; b = c; c = t; n.negate(); fs = [fa, fc, fb]; }
    n.normalize();
    const vs = [a, b, c];
    const m = mask ? vs.indexOf(mask) : -1;
    for (let i = 0; i < 3; i++) {
      this.pos.push(vs[i].x, vs[i].y, vs[i].z);
      this.nrm.push(n.x, n.y, n.z);
      const w = [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0];
      if (m >= 0) w[m] = 1;
      this.bary.push(w[0], w[1], w[2]);
      this.face.push(fs[i], 0);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('aBary', new THREE.Float32BufferAttribute(this.bary, 3));
    g.setAttribute('aFace', new THREE.Float32BufferAttribute(this.face, 2));
    return g;
  }
}

let crystalGeo: THREE.BufferGeometry | null = null;
let shardGeo: THREE.BufferGeometry | null = null;

/** Hexagonal ice crystal: base on y = 0 (radius 0.5), a straight shaft to y = 0.62, a pointed head at y = 1 leaning toward +x. */
function crystalGeometry() {
  if (crystalGeo) return crystalGeo;
  const sides = 6;
  const r0: THREE.Vector3[] = [], r1: THREE.Vector3[] = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2 + 0.2;
    r0.push(new THREE.Vector3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5));
    r1.push(new THREE.Vector3(Math.cos(a) * 0.46 + 0.05, 0.62, Math.sin(a) * 0.46));
  }
  const tip = new THREE.Vector3(0.12, 1, 0);
  const fb = new FacetBuilder(new THREE.Vector3(0.03, 0.45, 0));
  for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides;
    fb.tri(r0[k], r0[k2], r1[k2], -1, 1, 1, r0[k2]);
    fb.tri(r0[k], r1[k2], r1[k], -1, 1, -1, r1[k]);
    fb.tri(r1[k], r1[k2], tip, -1, 1, 0);
  }
  crystalGeo = fb.build();
  return crystalGeo;
}

/** Small angular shard: an elongated tetrahedron, centred, about 1 long. */
function shardGeometry() {
  if (shardGeo) return shardGeo;
  const v = [
    new THREE.Vector3(0.04, 0.6, 0), new THREE.Vector3(-0.22, -0.4, 0.12), new THREE.Vector3(0.22, -0.3, 0.16),
    new THREE.Vector3(0.0, -0.35, -0.24),
  ];
  const fb = new FacetBuilder(new THREE.Vector3(0, -0.1, 0));
  fb.tri(v[0], v[1], v[2], 1, 1, 1);
  fb.tri(v[0], v[2], v[3], 1, 1, 1);
  fb.tri(v[0], v[3], v[1], 1, 1, 1);
  fb.tri(v[1], v[3], v[2], 1, 1, 1);
  shardGeo = fb.build();
  return shardGeo;
}

// ---------------------------------------------------------------------------------------------------------------
// IceShards
// ---------------------------------------------------------------------------------------------------------------

interface Shard {
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

/**
 * Small angular ice shards with gravity and spin. `emit` throws one, `burst` a spray from a point. They shrink out
 * over their last third. `update(dt)` each frame. Add `mesh` to the group.
 */
export class IceShards {
  readonly mesh: THREE.InstancedMesh;
  /** World gravity (negative = down). */
  gravity = -14;
  private shards: Shard[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(max = 96) {
    this.mesh = new THREE.InstancedMesh(shardGeometry(), crystalMaterial(false), Math.max(1, max));
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < Math.max(1, max); i++) {
      this.shards.push({
        alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0),
        angle: 0, spin: 0, age: 0, life: 1, size: 0.15,
      });
    }
  }

  /** One shard at `pos` with velocity `vel`, `size` long, living `life` seconds. */
  emit(pos: THREE.Vector3, vel: THREE.Vector3, size = 0.18, life = 0.6) {
    const f = this.shards[this.cursor];
    this.cursor = (this.cursor + 1) % this.shards.length;
    f.alive = true;
    f.pos.copy(pos);
    f.vel.copy(vel);
    f.axis.randomDirection();
    f.angle = Math.random() * 6;
    f.spin = (Math.random() - 0.5) * 20;
    f.age = 0;
    f.life = life;
    f.size = size;
  }

  /** `count` shards from `pos`, thrown outward and up at about `speed`, `size` long, living `life` to 1.6 × `life` s. */
  burst(pos: THREE.Vector3, count: number, speed = 4, life = 0.5, size = 0.18) {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
      v.y += speed * 0.4;
      this.emit(pos, v, size * (0.7 + Math.random() * 0.6), life * (1 + Math.random() * 0.6));
    }
  }

  reset() {
    for (const f of this.shards) f.alive = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let n = 0;
    for (const f of this.shards) {
      if (!f.alive) continue;
      f.age += dt;
      if (f.age >= f.life) { f.alive = false; continue; }
      f.vel.y += this.gravity * dt;
      f.pos.addScaledVector(f.vel, dt);
      if (f.pos.y < 0.03) { f.pos.y = 0.03; f.vel.multiplyScalar(0.2); f.vel.y = 0; f.spin *= 0.3; }
      f.angle += f.spin * dt;
      this.q.setFromAxisAngle(f.axis, f.angle);
      const shrink = 1 - Math.pow(clamp01((f.age / f.life - 0.6) / 0.4), 2);
      this.m.compose(f.pos, this.q, this.s.setScalar(Math.max(f.size * shrink, MIN_SCALE)));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// IceCrystals
// ---------------------------------------------------------------------------------------------------------------

interface Crystal {
  alive: boolean;
  base: THREE.Vector3;
  q: THREE.Quaternion;
  len: number;
  w: number;
  age: number; // negative = still waiting
  grow: number;
  fromTip: boolean;
}

export interface IceCrystalsOptions {
  /** Max crystals alive at once. Default 48. */
  maxSpikes?: number;
  /** Max shards alive at once (from `shatter`). Default 160. */
  maxShards?: number;
}

/**
 * Clear blue ice crystals: instanced hexagonal prisms with a pointed head, flat facets darkening to the dark colour at
 * the base and a thin pale core line along the long axis. `spike` makes one (the javelin, a plate of armour, a hanging
 * crown tooth), `cluster` a ring or a filled disc of them leaning outward. `shatter` turns every crystal into shards
 * (`shards`, in the same group). `flare` (0..1) turns them pale for a beat; `glint` / `glintAt` draw a pinpoint on the
 * edge line (off unless driven). `update(dt)` each frame. Add `mesh` (crystals and shards) to the group.
 */
export class IceCrystals {
  readonly mesh = new THREE.Group();
  readonly shards: IceShards;
  private mat = crystalMaterial(true);
  private spikes: Crystal[] = [];
  private spikeMesh: THREE.InstancedMesh;
  private cursor = 0;
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private ax = new THREE.Vector3();

  constructor(opts: IceCrystalsOptions = {}) {
    const maxS = opts.maxSpikes ?? 48;
    this.shards = new IceShards(opts.maxShards ?? 160);
    this.spikeMesh = new THREE.InstancedMesh(crystalGeometry(), this.mat, maxS);
    this.spikeMesh.frustumCulled = false;
    this.spikeMesh.count = 0;
    this.mesh.add(this.spikeMesh, this.shards.mesh);
    for (let i = 0; i < maxS; i++) {
      this.spikes.push({ alive: false, base: new THREE.Vector3(), q: new THREE.Quaternion(), len: 1, w: 0.3, age: 0, grow: 0.18, fromTip: false });
    }
  }

  get flare() { return this.mat.uniforms.uFlare.value as number; }
  set flare(v: number) { this.mat.uniforms.uFlare.value = v; }
  get glint() { return this.mat.uniforms.uGlint.value as number; }
  set glint(v: number) { this.mat.uniforms.uGlint.value = v; }
  /** Height of the glint along the crystals, 0 base .. 1 tip. */
  get glintAt() { return this.mat.uniforms.uGlintAt.value as number; }
  set glintAt(v: number) { this.mat.uniforms.uGlintAt.value = v; }

  /**
   * One crystal from `base` pointing along `dir`, `length` long and `width` across its base. It grows over `grow` seconds
   * after `delay` (grow 0 = there at once). `fromTip`: the tip stays put and the crystal grows out of it toward the
   * base (a crown tooth forming in the air). Returns a handle for `place`.
   */
  spike(base: THREE.Vector3, dir: THREE.Vector3, length: number, width: number, grow = 0.18, delay = 0, fromTip = false): number {
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % this.spikes.length;
    const sp = this.spikes[idx];
    sp.alive = true;
    sp.base.copy(base);
    sp.q.setFromUnitVectors(UP, this.p.copy(dir).normalize());
    sp.len = length; sp.w = width; sp.grow = grow; sp.age = -delay; sp.fromTip = fromTip;
    return idx;
  }

  /** Moves / re-aims a crystal made by `spike` (the javelin in flight, a crown tooth driving down). */
  place(handle: number, base: THREE.Vector3, dir: THREE.Vector3, length?: number) {
    const sp = this.spikes[handle];
    if (!sp) return;
    sp.base.copy(base);
    sp.q.setFromUnitVectors(UP, this.p.copy(dir).normalize());
    if (length !== undefined) sp.len = length;
  }

  /**
   * `count` crystals of about `height` within `radius` of `center` (a Vogel-spiral disc, or a ring with `ring`), leaning
   * outward. Options: `width` base width (default max(0.3, 0.3 * height)), `tilt` outward lean in radians (default 0.3),
   * `stagger` window in seconds over which they start (default 0.1), `grow` seconds to full height (default 0.14).
   */
  cluster(
    center: THREE.Vector3, radius: number, count: number, height: number,
    opts: { ring?: boolean; width?: number; tilt?: number; stagger?: number; grow?: number } = {},
  ) {
    const { ring = false, tilt = 0.3, stagger = 0.1, grow = 0.14 } = opts;
    const phase = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3(), base = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = ring ? phase + (i + (Math.random() - 0.5) * 0.6) / count * Math.PI * 2 : phase + i * 2.39996;
      const rad = ring ? radius * (0.8 + 0.4 * Math.random()) : radius * Math.sqrt((i + 0.5) / count);
      base.set(center.x + Math.cos(a) * rad, center.y, center.z + Math.sin(a) * rad);
      const lean = tilt * (0.5 + Math.random());
      dir.set(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
      const h = height * (0.6 + 0.4 * Math.random());
      this.spike(base, dir, h, opts.width ?? Math.max(0.3, 0.3 * h), grow, Math.random() * stagger);
    }
  }

  /** World position of the visible base of a crystal (differs from `base` for `fromTip` crystals while they grow). */
  private visibleBase(sp: Crystal, out: THREE.Vector3) {
    out.copy(sp.base);
    if (sp.fromTip) {
      const e = sp.grow <= 0 ? 1 : easeOut(sp.age / sp.grow);
      this.ax.set(0, 1, 0).applyQuaternion(sp.q);
      out.addScaledVector(this.ax, sp.len * (1 - e));
    }
    return out;
  }

  /** Breaks every crystal into `perCrystal` shards that burst out and fall; they live `life` to 1.7 × `life` s. */
  shatter(perCrystal = 5, speed = 4, life = 0.4) {
    const pos = new THREE.Vector3(), vel = new THREE.Vector3(), axis = new THREE.Vector3(), b = new THREE.Vector3();
    for (const sp of this.spikes) {
      if (!sp.alive) continue;
      sp.alive = false;
      if (sp.age < 0) continue;
      const e = sp.grow <= 0 ? 1 : easeOut(sp.age / sp.grow);
      this.visibleBase(sp, b);
      axis.set(0, 1, 0).applyQuaternion(sp.q);
      for (let i = 0; i < perCrystal; i++) {
        pos.copy(b).addScaledVector(axis, Math.random() * sp.len * e);
        vel.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
        vel.y += speed * 0.4;
        const size = Math.min(0.34, 0.1 + sp.len * 0.05) * (0.7 + Math.random() * 0.6);
        this.shards.emit(pos, vel, size, life * (1 + Math.random() * 0.7));
      }
    }
  }

  reset() {
    for (const sp of this.spikes) sp.alive = false;
    this.spikeMesh.count = 0;
    this.shards.reset();
    this.flare = 0;
    this.glint = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const sp of this.spikes) {
      if (!sp.alive) continue;
      sp.age += dt;
      if (sp.age < 0) continue;
      const e = sp.grow <= 0 ? 1 : easeOut(sp.age / sp.grow);
      const y = Math.max(sp.len * e, MIN_SCALE), xz = Math.max(sp.w * (0.4 + 0.6 * e), MIN_SCALE);
      this.visibleBase(sp, this.p);
      this.m.compose(this.p, sp.q, this.s.set(xz, y, xz));
      this.spikeMesh.setMatrixAt(k++, this.m);
    }
    this.spikeMesh.count = k;
    this.spikeMesh.instanceMatrix.needsUpdate = true;
    this.shards.update(dt);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// FrostFerns: the branching rime decal
// ---------------------------------------------------------------------------------------------------------------

interface FernArt { tex: THREE.CanvasTexture; pts: Float32Array }
const fernArts: (FernArt | null)[] = [null, null];
const FERN_R = 0.957; // radius of the drawing as a fraction of the quad half-size

/**
 * Draws the fern map. R = arrival time of the growth front (0 at the seed, 1 at the longest branch tip, measured along
 * the branch), A = coverage. Arm 0 points along +x exactly so the sleeves can sample it. Branch lengths and spacing
 * are random (no regular comb); side branches shrink toward the arm tip like a fern frond.
 */
function drawFern(variant: number): FernArt {
  const S = 1024, C = S / 2, R = C * FERN_R;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  let seed = 13 + variant * 37;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const maxD = R * 1.22;
  const pts: number[] = [];
  const seg = (x0: number, y0: number, x1: number, y1: number, d: number, w: number) => {
    const v = Math.round(clamp01(d / maxD) * 255);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  };
  const widths = [[15, 4], [8, 2.6], [4.5, 1.6]];
  const branch = (x: number, y: number, ang: number, len: number, d0: number, depth: number) => {
    const step = 13;
    const n = Math.max(2, Math.ceil(len / step));
    const [w0, w1] = widths[depth];
    let cx = x, cy = y, a = ang;
    const curve = (rnd() - 0.5) * (depth === 0 ? 0.03 : 0.07);
    let nextSide = depth === 0 ? 24 + rnd() * 16 : 15 + rnd() * 9;
    let travelled = 0;
    let flip = rnd() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      a += curve + (rnd() - 0.5) * 0.05;
      const nx = cx + Math.cos(a) * step, ny = cy + Math.sin(a) * step;
      const d = d0 + (i + 1) * step;
      seg(cx, cy, nx, ny, d, w0 + (w1 - w0) * k);
      cx = nx; cy = ny; travelled += step;
      if (depth < 2) pts.push((cx - C) / C, (cy - C) / C);
      if (depth < 2 && travelled >= nextSide && k < 0.92) {
        travelled = 0;
        nextSide = depth === 0 ? 24 + rnd() * 18 : 15 + rnd() * 10;
        const rem = 1 - k;
        const sides = rnd() < 0.3 ? [flip, -flip] : [flip];
        flip = -flip;
        for (const sd of sides) {
          const sl = depth === 0 ? len * 0.4 * Math.pow(rem, 0.75) * (0.65 + 0.7 * rnd()) : len * 0.5 * Math.pow(rem, 0.6) * (0.6 + 0.7 * rnd());
          if (sl < (depth === 0 ? 24 : 12)) continue;
          branch(cx, cy, a + sd * (0.85 + 0.3 * rnd()), sl, d, depth + 1);
        }
      }
    }
  };
  const arms = 9;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + (i === 0 ? 0 : (rnd() - 0.5) * 0.35);
    branch(C, C, a, R * (i === 0 ? 0.95 : 0.55 + 0.4 * rnd()), 0, 0);
  }
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.5) / 5) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    branch(C, C, a, R * (0.2 + 0.18 * rnd()), 0, 1);
  }
  g.fillStyle = 'rgb(0,0,0)';
  g.beginPath(); g.arc(C, C, 28, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  return { tex, pts: new Float32Array(pts) };
}

function fernArt(variant: number): FernArt {
  const i = variant % fernArts.length;
  let art = fernArts[i];
  if (!art) { art = drawFern(i); fernArts[i] = art; }
  return art;
}

export interface FrostFernsOptions {
  /** Which of the two drawn fern patterns to use (0 or 1). Default 0. */
  variant?: number;
  /** Shards available to `shatter`; 0 = none (cheap decals that only fade). Default 36. */
  maxShards?: number;
}

/**
 * A ground decal of branching rime. `grow(center, radius, seconds, delay)` grows it outward along the branches (the
 * front is a real arrival time along each branch, with a brighter growing tip and a thin frost veil behind it);
 * `shatter(fadeSeconds)` turns it into angular shards and fades it; `fade(seconds)` fades it out. `update(dt)` each
 * frame. Add `mesh` to the group. Pale rime on a dark outline: keep the floor darkened under it.
 */
export class FrostFerns {
  readonly mesh = new THREE.Group();
  /** Height above the floor. */
  y = 0.04;
  private decal: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private shards: IceShards | null;
  private art: FernArt;
  private center = new THREE.Vector3();
  private _radius = 1;
  private yaw = 0;
  private running = false;
  private growAge = 0;
  private growDur = 0.5;
  private fadeAge = -1;
  private fadeDur = 0.5;
  private v = new THREE.Vector3();

  constructor(opts: FrostFernsOptions = {}) {
    this.art = fernArt(opts.variant ?? 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {
        uMap: { value: this.art.tex },
        uRime: { value: new THREE.Color(FROST.rime) }, uHot: { value: new THREE.Color(FROST.hot) },
        uDark: { value: new THREE.Color(FROST.dark) }, uBody: { value: new THREE.Color(FROST.body) },
        uGrow: { value: 0 }, uAlpha: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uRime, uHot, uDark, uBody; uniform float uGrow, uAlpha;
        varying vec2 vUv;
        float cov(vec2 uv) {
          vec4 c = texture2D(uMap, uv);
          return c.a * (1.0 - smoothstep(uGrow - 0.025, uGrow, c.r));
        }
        void main() {
          vec4 c = texture2D(uMap, vUv);
          float f = cov(vUv);
          float o = 0.0055;
          float sh = max(max(cov(vUv + vec2(o, 0.0)), cov(vUv - vec2(o, 0.0))), max(cov(vUv + vec2(0.0, o)), cov(vUv - vec2(0.0, o))));
          vec2 p = vUv * 2.0 - 1.0;
          float rad = length(p) / ${FERN_R.toFixed(3)};
          float veil = 0.13 * (1.0 - smoothstep(0.5, 0.98, rad)) * (1.0 - smoothstep(uGrow * 0.9 - 0.06, uGrow * 0.9, rad));
          float front = 1.0 - smoothstep(0.0, 0.07, uGrow - c.r);
          vec3 col = uRime * 0.86;
          col = mix(col, uBody * 1.2, (1.0 - c.r) * 0.16);
          col = mix(col, uHot * 0.95, front * 0.9);
          float onFern = smoothstep(0.15, 0.7, f);
          vec3 outC = mix(col, uDark, (1.0 - onFern) * step(0.01, sh));
          float outA = max(max(f, sh * 0.6), veil) * uAlpha;
          if (outA < 0.004) discard;
          gl_FragColor = vec4(outC, outA);
        }`,
    });
    this.decal = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.decal.frustumCulled = false;
    this.decal.visible = false;
    const ms = opts.maxShards ?? 36;
    this.shards = ms > 0 ? new IceShards(ms) : null;
    this.mesh.add(this.decal);
    if (this.shards) this.mesh.add(this.shards.mesh);
  }

  set renderOrder(v: number) { this.decal.renderOrder = v; }
  get radius() { return this._radius; }
  /** True while anything of it is still visible. */
  get active() { return this.running; }

  /** Starts the rime growing out from `center` to `radius` (world units) over `seconds`, after `delay`. Restarts if running. */
  grow(center: THREE.Vector3, radius: number, seconds = 0.5, delay = 0) {
    this.center.copy(center);
    this._radius = Math.max(radius, MIN_SCALE);
    this.yaw = Math.random() * Math.PI * 2;
    this.growDur = Math.max(seconds, 0.05);
    this.growAge = -delay;
    this.running = true;
    this.fadeAge = -1;
    this.mat.uniforms.uAlpha.value = 1;
    this.mat.uniforms.uGrow.value = 0;
    this.decal.position.set(center.x, this.y, center.z);
    this.decal.rotation.y = this.yaw;
    this.decal.scale.setScalar(this._radius / FERN_R);
  }

  /** Fades it out within `seconds` from now. */
  fade(seconds = 0.5) {
    if (!this.running) return;
    this.fadeDur = Math.max(seconds, 0.05);
    this.fadeAge = 0;
  }

  /** Hands the rime off to angular shards thrown up from along the branches, and fades the decal over `fadeSeconds`. */
  shatter(fadeSeconds = 0.5) {
    if (this.shards && this.decal.visible) {
      const n = Math.round(THREE.MathUtils.clamp(this._radius * 7, 10, 34));
      const pts = this.art.pts;
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const grown = clamp01(this.growAge / this.growDur);
      for (let i = 0; i < n; i++) {
        const k = Math.floor(Math.random() * (pts.length / 2)) * 2;
        const lx = pts[k] * this._radius / FERN_R, lz = pts[k + 1] * this._radius / FERN_R;
        // Skip points the front has not reached (the arrival time grows with the radius).
        if (Math.hypot(pts[k], pts[k + 1]) > grown * 1.05 + 0.05) continue;
        this.v.set(this.center.x + lx * c + lz * s, 0.08, this.center.z - lx * s + lz * c);
        const out = new THREE.Vector3(this.v.x - this.center.x, 0, this.v.z - this.center.z).normalize().multiplyScalar(2.2 + Math.random() * 2);
        out.y = 2 + Math.random() * 2.5;
        this.shards.emit(this.v, out, 0.14 + Math.random() * 0.12, 0.35 + Math.random() * 0.3);
      }
    }
    this.fade(fadeSeconds);
  }

  reset() {
    this.running = false;
    this.fadeAge = -1;
    this.decal.visible = false;
    this.shards?.reset();
  }

  update(dt: number) {
    this.shards?.update(dt);
    if (!this.running) return;
    this.growAge += dt;
    if (this.fadeAge >= 0) this.fadeAge += dt;
    const p = clamp01(this.growAge / this.growDur);
    const alpha = this.fadeAge < 0 ? 1 : 1 - clamp01(this.fadeAge / this.fadeDur);
    this.mat.uniforms.uGrow.value = (1 - (1 - p) * (1 - p)) * 1.06;
    this.mat.uniforms.uAlpha.value = alpha * alpha;
    this.decal.visible = this.growAge > 0 && alpha > 0.01;
    if (this.fadeAge >= 0 && alpha <= 0.01) { this.running = false; this.fadeAge = -1; this.decal.visible = false; }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// RimeSleeves: rime climbing a body
// ---------------------------------------------------------------------------------------------------------------

/**
 * Rime that climbs up a figure: open pale cylinders, one per figure, with frost veining sampled from the fern map and a
 * brighter growing front. `set(i, feet, height, radius, grow, opacity)` each frame (grow 0..1 climbs from the feet);
 * `clear()` hides all. Add `mesh` to the group.
 */
export class RimeSleeves {
  readonly mesh = new THREE.Group();
  private sleeves: THREE.Mesh[] = [];
  private mats: THREE.ShaderMaterial[] = [];

  constructor(max = 6) {
    // A tube that follows the robe's silhouette (flared hem, narrow waist, shoulders, hood), height 1 = 2.2 units.
    const prof: [number, number][] = [
      [0, 0.64], [0.08, 0.6], [0.25, 0.5], [0.43, 0.4], [0.52, 0.38], [0.64, 0.44], [0.71, 0.5], [0.77, 0.46],
      [0.84, 0.3], [0.92, 0.25], [1, 0.2],
    ];
    const SEG = 18, ROWS = 20;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= ROWS; j++) {
      const v = j / ROWS;
      let r = prof[prof.length - 1][1];
      for (let k = 0; k < prof.length - 1; k++) {
        if (v <= prof[k + 1][0]) { const u = (v - prof[k][0]) / (prof[k + 1][0] - prof[k][0]); r = prof[k][1] + (prof[k + 1][1] - prof[k][1]) * u; break; }
      }
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        pos.push(Math.cos(a) * r * 1.08, v, Math.sin(a) * r * 1.08);
        uv.push(i / SEG, v);
      }
    }
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < SEG; i++) {
      const a = j * (SEG + 1) + i, b = a + SEG + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const tex = fernArt(1).tex;
    for (let i = 0; i < max; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: {
          uMap: { value: tex }, uRime: { value: new THREE.Color(FROST.rime) }, uHot: { value: new THREE.Color(FROST.hot) },
          uBody: { value: new THREE.Color(FROST.body) }, uGrow: { value: 0 }, uAlpha: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform vec3 uRime, uHot, uBody; uniform float uGrow, uAlpha;
          varying vec2 vUv;
          void main() {
            float m = abs(fract(vUv.x * 3.0) * 2.0 - 1.0);               // mirrored, so the seams match
            vec2 tc = vec2(0.5 + 0.47 * vUv.y, 0.5 + (m - 0.5) * 0.4);   // along the +x arm of the fern map
            vec4 c = texture2D(uMap, tc);
            // Jagged climbing edge: saw teeth of uneven height plus the fern arrival time.
            float cell = floor(vUv.x * 18.0);
            float tooth = fract(sin(cell * 12.9898) * 43758.5453);
            float saw = abs(fract(vUv.x * 18.0) - 0.5) * 2.0;
            float jag = c.r * 0.2 + tooth * 0.16 + saw * 0.1;
            float edge = vUv.y * 0.8 + jag;
            float reach = 1.0 - smoothstep(uGrow - 0.03, uGrow, edge);
            float veil = 0.1 * reach;
            veil += 0.22 * (1.0 - smoothstep(0.0, 0.18, vUv.y)) * reach;   // heavier at the hem
            float vein = smoothstep(0.1, 0.5, c.a) * reach;
            float front = 1.0 - smoothstep(0.0, 0.1, uGrow - edge);
            vec3 col = mix(uRime * 0.86, uBody * 1.1, (1.0 - vUv.y) * 0.22);
            col = mix(col, uHot * 0.95, front * reach);
            float a = max(veil, vein) * uAlpha;
            if (a < 0.004) discard;
            gl_FragColor = vec4(col, a);
          }`,
      });
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      m.visible = false;
      this.sleeves.push(m);
      this.mats.push(mat);
      this.mesh.add(m);
    }
  }

  set(i: number, feet: THREE.Vector3, height: number, radius: number, grow: number, opacity: number) {
    const m = this.sleeves[i];
    if (!m) return;
    m.visible = grow > 0.002 && opacity > 0.004;
    m.position.copy(feet);
    m.scale.set(Math.max(radius, MIN_SCALE), Math.max(height, MIN_SCALE), Math.max(radius, MIN_SCALE));
    this.mats[i].uniforms.uGrow.value = grow * 1.1;
    this.mats[i].uniforms.uAlpha.value = opacity;
  }

  clear() {
    for (const m of this.sleeves) m.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// RimeRing and IceStreak
// ---------------------------------------------------------------------------------------------------------------

/**
 * A rime ring racing across the floor: a pale band with a bright leading edge and a trail that fades inward.
 * `set(center, radius, width, opacity)` each frame (radius is the leading edge); opacity 0 hides it.
 */
export class RimeRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  /** Height above the floor. */
  y = 0.07;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      uniforms: {
        uR: { value: 1 }, uW: { value: 0.5 }, uHalf: { value: 1 }, uA: { value: 1 },
        uRime: { value: new THREE.Color(FROST.rime) }, uHot: { value: new THREE.Color(FROST.hot) },
        uBody: { value: new THREE.Color(FROST.body) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uR, uW, uHalf, uA; uniform vec3 uRime, uHot, uBody;
        varying vec2 vUv;
        void main() {
          float d = length(vUv * 2.0 - 1.0) * uHalf;
          float t = (uR - d) / max(uW, 1e-3);
          if (t < 0.0 || t > 1.0) discard;
          vec3 col = t < 0.14 ? uHot * 0.95 : (t < 0.55 ? uRime * 0.86 : uBody);
          float a = uA * (1.0 - t * t) * 0.9;
          if (a < 0.004) discard;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(center: THREE.Vector3, radius: number, width: number, opacity: number) {
    this.mesh.visible = opacity > 0.004 && radius > 1e-3;
    const half = radius + 0.2;
    this.mesh.position.set(center.x, this.y, center.z);
    this.mesh.scale.setScalar(half);
    this.mat.uniforms.uR.value = radius;
    this.mat.uniforms.uW.value = width;
    this.mat.uniforms.uHalf.value = half;
    this.mat.uniforms.uA.value = opacity;
  }
}

/**
 * A pale tapered streak (a thrown javelin's wake): a six-sided cone, wide at the head and pointed at the tail, flat
 * rime colour. `set(head, tail, width, opacity)`; opacity 0 hides it.
 */
export class IceStreak {
  readonly mesh: THREE.Mesh;
  private mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(FROST.hot).multiplyScalar(0.92), transparent: true, depthWrite: false });
  private q = new THREE.Quaternion();
  private d = new THREE.Vector3();

  constructor() {
    const geo = new THREE.CylinderGeometry(0.5, 0, 1, 6, 1, true).translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(head: THREE.Vector3, tail: THREE.Vector3, width: number, opacity: number) {
    this.d.subVectors(head, tail);
    const len = this.d.length();
    this.mesh.visible = opacity > 0.004 && len > 1e-3;
    if (!this.mesh.visible) return;
    this.mesh.position.copy(tail);
    this.mesh.quaternion.copy(this.q.setFromUnitVectors(UP, this.d.multiplyScalar(1 / len)));
    this.mesh.scale.set(Math.max(width, MIN_SCALE), len, Math.max(width, MIN_SCALE));
    this.mat.opacity = opacity;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Camera-facing billboards for Snow and FrostBreath
// ---------------------------------------------------------------------------------------------------------------

/** Instanced camera-facing quads. Per instance: translation in the matrix, `aS` = (size, alpha, seed, spin). */
class Billboards {
  readonly mesh: THREE.InstancedMesh;
  private aS: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private n = 0;

  constructor(private max: number, fragment: string, uniforms: Record<string, THREE.IUniform>) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aS.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aS', this.aS);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms,
      vertexShader: /* glsl */ `
        attribute vec4 aS; varying vec2 vUv; varying vec4 vS;
        void main() {
          vUv = uv; vS = aS;
          vec4 c = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
          float cs = cos(aS.w), sn = sin(aS.w);
          vec2 q = mat2(cs, sn, -sn, cs) * position.xy;
          c.xy += q * aS.x;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: fragment,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  begin() { this.n = 0; }

  push(pos: THREE.Vector3, size: number, alpha: number, seed: number, spin = 0) {
    if (this.n >= this.max) return;
    this.m.makeTranslation(pos.x, pos.y, pos.z);
    this.mesh.setMatrixAt(this.n, this.m);
    const a = this.aS.array as Float32Array;
    a[this.n * 4] = size; a[this.n * 4 + 1] = alpha; a[this.n * 4 + 2] = seed; a[this.n * 4 + 3] = spin;
    this.n++;
  }

  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aS.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Snow
// ---------------------------------------------------------------------------------------------------------------

interface Flake {
  mode: 0 | 1 | 2 | 3; // off, swirl, fall, scatter
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  cx: number; cz: number; y: number;
  r: number; ang: number; w: number; shrink: number; bob: number;
  age: number; life: number; size: number; seed: number;
}

export interface SnowOptions {
  /** Max flakes alive at once. Default 120. */
  max?: number;
}

/**
 * A small pool of snowflakes: soft six-pointed flakes in rime white with a dark rim, normal-blended so they read on the
 * floor. `swirl` orbits them around a point (a blizzard band, optionally drawing inward), `fall` drops them over an
 * area, `scatter` throws a few from a point and lets them drift. `stop()` fades every flake out in 0.3 s. Set
 * `frozen` to hold time still (a dead beat). `size` multiplies the flake size. `update(dt)` each frame. Add `mesh`.
 */
export class Snow {
  readonly mesh: THREE.InstancedMesh;
  /** True: nothing moves or ages (flakes hang in the air). */
  frozen = false;
  /** Multiplier on the flake size (default 1; about 0.12 world units across). */
  size = 1;
  private flakes: Flake[] = [];
  private cursor = 0;
  private bb: Billboards;
  private p = new THREE.Vector3();

  constructor(opts: SnowOptions = {}) {
    const max = opts.max ?? 120;
    this.bb = new Billboards(max, /* glsl */ `
      uniform vec3 uRime, uDark;
      varying vec2 vUv; varying vec4 vS;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p), a = atan(p.y, p.x);
        float lim = 0.72 + 0.28 * cos(6.0 * (a + vS.z * 6.0));
        float k = r / lim;
        if (k > 1.0) discard;
        vec3 col = k > 0.7 ? uDark * 1.5 : uRime * 0.92;
        float al = vS.y * (1.0 - smoothstep(0.9, 1.0, k));
        if (al < 0.004) discard;
        gl_FragColor = vec4(col, al);
      }`, {
      uRime: { value: new THREE.Color(FROST.rime) }, uDark: { value: new THREE.Color(FROST.dark) },
    });
    this.mesh = this.bb.mesh;
    for (let i = 0; i < max; i++) {
      this.flakes.push({
        mode: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), cx: 0, cz: 0, y: 0, r: 1, ang: 0, w: 1, shrink: 0, bob: 0,
        age: 0, life: 1, size: 0.12, seed: 0,
      });
    }
  }

  private take(): Flake {
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[(this.cursor + i) % this.flakes.length];
      if (f.mode === 0) { this.cursor = (this.cursor + i + 1) % this.flakes.length; return f; }
    }
    const f = this.flakes[this.cursor];
    this.cursor = (this.cursor + 1) % this.flakes.length;
    return f;
  }

  /**
   * `count` flakes orbiting `center` between `radius * (1 - band)` and `radius`, at height `y` (+ `ySpread`). Options:
   * `speed` tangential speed (default 2.2), `band` radial spread 0..1 (default 0.4), `shrink` fraction of the radius lost
   * per second (default 0), `life` seconds (default until `stop`).
   */
  swirl(center: THREE.Vector3, radius: number, count: number, opts: { y?: number; ySpread?: number; speed?: number; band?: number; shrink?: number; life?: number } = {}) {
    const { y = 1.4, ySpread = 1.2, speed = 2.2, band = 0.4, shrink = 0, life = 99 } = opts;
    for (let i = 0; i < count; i++) {
      const f = this.take();
      f.mode = 1;
      f.cx = center.x; f.cz = center.z;
      f.r = radius * (1 - band * Math.random());
      f.ang = Math.random() * Math.PI * 2;
      f.w = (speed / f.r) * (0.8 + Math.random() * 0.4);
      f.y = y + (Math.random() - 0.5) * ySpread;
      f.shrink = shrink; f.bob = 0.15;
      f.age = -Math.random() * 0.25; f.life = life;
      f.size = 0.09 + Math.random() * 0.08; f.seed = Math.random();
    }
  }

  /** `count` flakes sifting down over a disc of `radius` around `center`, starting at random heights up to `height`. */
  fall(center: THREE.Vector3, radius: number, count: number, height = 6, speed = 1.2) {
    for (let i = 0; i < count; i++) {
      const f = this.take();
      f.mode = 2;
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      f.pos.set(center.x + Math.cos(a) * r, 0.4 + Math.random() * height, center.z + Math.sin(a) * r);
      f.vel.set(0, -speed * (0.7 + Math.random() * 0.6), 0);
      f.age = -Math.random() * 0.3; f.life = 99;
      f.size = 0.09 + Math.random() * 0.08; f.seed = Math.random();
    }
  }

  /** `count` flakes thrown out of `pos` at about `speed`; they slow, drift down and fade over `life` seconds. */
  scatter(pos: THREE.Vector3, count: number, speed = 1.5, life = 0.7) {
    for (let i = 0; i < count; i++) {
      const f = this.take();
      f.mode = 3;
      f.pos.copy(pos);
      f.vel.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      f.age = 0; f.life = life * (0.8 + Math.random() * 0.5);
      f.size = 0.09 + Math.random() * 0.07; f.seed = Math.random();
    }
  }

  /** Fades every flake out within 0.3 s. */
  stop() {
    for (const f of this.flakes) if (f.mode !== 0) f.life = Math.min(f.life, Math.max(f.age, 0) + 0.3);
  }

  reset() {
    for (const f of this.flakes) f.mode = 0;
    this.frozen = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    this.bb.begin();
    for (const f of this.flakes) {
      if (f.mode === 0) continue;
      f.age += d;
      if (f.age >= f.life) { f.mode = 0; continue; }
      if (f.age < 0) continue;
      if (f.mode === 1) {
        const r = Math.max(0.3, f.r * (1 - f.shrink * f.age));
        const a = f.ang + f.w * f.age * (f.r / r);
        this.p.set(f.cx + Math.cos(a) * r, f.y + Math.sin(f.age * 1.6 + f.seed * 6) * f.bob, f.cz + Math.sin(a) * r);
      } else if (f.mode === 2) {
        f.pos.addScaledVector(f.vel, d);
        f.pos.x += Math.sin(f.age * 2 + f.seed * 6) * 0.35 * d;
        if (f.pos.y < 0.06) { f.mode = 0; continue; }
        this.p.copy(f.pos);
      } else {
        f.vel.multiplyScalar(Math.max(0, 1 - 2.4 * d));
        f.vel.y -= 0.6 * d;
        f.pos.addScaledVector(f.vel, d);
        this.p.copy(f.pos);
      }
      const fin = clamp01(f.age / 0.15), fout = clamp01((f.life - f.age) / 0.3);
      this.bb.push(this.p, f.size * this.size, 0.95 * fin * fout, f.seed, f.seed * 3 + f.age * 0.8);
    }
    this.bb.end();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// FrostBreath
// ---------------------------------------------------------------------------------------------------------------

interface Puff {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  s0: number;
  s1: number;
  seed: number;
}

interface BlowJob {
  from: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
  seconds: number;
  t: number;
  spawned: number;
  total: number;
}

/**
 * A pale cone of toon mist puffs from a point along a direction: `blow(from, dir, length, seconds)` releases puffs
 * over `seconds` that billow out to about `length`, growing and fading. Flat two-tone lumpy discs with a blue rim
 * (camera-facing). `update(dt)` each frame. Add `mesh`.
 */
export class FrostBreath {
  readonly mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private jobs: BlowJob[] = [];
  private cursor = 0;
  private bb: Billboards;
  private side = new THREE.Vector3();
  private up2 = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(max = 40) {
    this.bb = new Billboards(max, /* glsl */ `
      uniform vec3 uPale, uMid, uRim;
      varying vec2 vUv; varying vec4 vS;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p), a = atan(p.y, p.x);
        float lim = 0.78 + 0.1 * sin(a * 3.0 + vS.z * 6.0) + 0.06 * sin(a * 5.0 + vS.z * 11.0);
        float k = r / lim;
        if (k > 1.0) discard;
        vec3 col = uPale * 0.86;
        col = mix(col, uMid, step(0.12, dot(p / max(r, 1e-4), normalize(vec2(0.5, -0.8))) * k));
        col = mix(col, uRim, step(0.86, k));
        float al = vS.y;
        if (al < 0.004) discard;
        gl_FragColor = vec4(col, al);
      }`, {
      uPale: { value: new THREE.Color(FROST.hot) }, uMid: { value: new THREE.Color(0x8cc8ee) }, uRim: { value: new THREE.Color(0x2a6a96) },
    });
    this.mesh = this.bb.mesh;
    for (let i = 0; i < max; i++) {
      this.puffs.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.5, s0: 0.1, s1: 0.4, seed: 0 });
    }
  }

  /** Releases a cone of puffs from `from` along `dir`, reaching about `length` world units, over `seconds`. */
  blow(from: THREE.Vector3, dir: THREE.Vector3, length: number, seconds = 0.25) {
    this.jobs.push({
      from: from.clone(), dir: dir.clone().normalize(), length, seconds: Math.max(seconds, 0.02), t: 0, spawned: 0,
      total: Math.round(THREE.MathUtils.clamp(8 + length * 3, 8, 18)),
    });
  }

  private spawn(job: BlowJob) {
    const p = this.puffs[this.cursor];
    this.cursor = (this.cursor + 1) % this.puffs.length;
    this.side.set(-job.dir.z, 0, job.dir.x);
    if (this.side.lengthSq() < 1e-4) this.side.set(1, 0, 0);
    this.side.normalize();
    this.up2.crossVectors(job.dir, this.side).normalize();
    const life = 0.45 + Math.random() * 0.15;
    const spread = 0.26;
    const sa = (Math.random() - 0.5) * 2 * spread, ua = (Math.random() - 0.5) * 2 * spread;
    p.alive = true;
    p.pos.copy(job.from);
    p.vel.copy(job.dir).multiplyScalar((job.length / life) * (0.65 + Math.random() * 0.4))
      .addScaledVector(this.side, sa * job.length / life).addScaledVector(this.up2, ua * job.length / life);
    p.vel.y += 0.25;
    p.age = 0; p.life = life;
    p.s0 = 0.1 + Math.random() * 0.05;
    p.s1 = 0.3 + job.length * 0.1 + Math.random() * 0.1;
    p.seed = Math.random();
  }

  reset() {
    for (const p of this.puffs) p.alive = false;
    this.jobs.length = 0;
    this.mesh.count = 0;
  }

  update(dt: number) {
    for (let j = this.jobs.length - 1; j >= 0; j--) {
      const job = this.jobs[j];
      job.t += dt;
      const want = Math.min(job.total, Math.ceil((job.t / job.seconds) * job.total));
      while (job.spawned < want) { this.spawn(job); job.spawned++; }
      if (job.spawned >= job.total) this.jobs.splice(j, 1);
    }
    this.bb.begin();
    for (const p of this.puffs) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; continue; }
      p.vel.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
      p.pos.addScaledVector(p.vel, dt);
      const u = p.age / p.life;
      const size = p.s0 + (p.s1 - p.s0) * easeOut(u);
      const alpha = 0.8 * clamp01(p.age / 0.05) * (1 - smooth((u - 0.45) / 0.55));
      this.bb.push(this.v.copy(p.pos), size, alpha, p.seed, p.seed * 6);
    }
    this.bb.end();
  }
}
