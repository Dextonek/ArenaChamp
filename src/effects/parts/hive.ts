import * as THREE from 'three';
import type { MinionLook } from './minion';

/**
 * The hive kit (pipeline/designs/kit-hive.md): honeycomb hexagons and swarms of small insects. Wax-amber cells with dark
 * gaps, black chitin plates with an amber rim, dozens of tiny dark wasps with amber striped abdomens and a flicker of
 * wings, sticky amber honey splashes. Everything is pooled, takes world-space positions and has a `reset()`. Materials
 * are unlit (flat colours, no gloss) and stay below the bloom threshold (~0.86).
 *
 * - `Swarm`       an instanced cloud of wasps: `set` (cloud), `stream`, `dive`, `scatter`, `form` (a fixed silhouette).
 * - `Honeycomb`   hexagon cells that grow cell by cell: `grow` (floor patch or band), `wall` (a ring wall), `dome`
 *                 (chitin plates in a shell round a point), `crumble`.
 * - `HoneySplash` a few amber blobs thrown out under gravity that land as puddles and shrink away.
 * - `ClawSlash`   serrated dark claw crescents with an amber edge and hexagonal flecks (the Q swing).
 * - `waspLook`    the `MinionLook` for summons: a giant hovering wasp (about 0.9 m).
 */

/** Palette. Numbers for `THREE.Color`, `HIVE_CSS` for APIs that want a string. `wax` is the pale foil. */
export const HIVE = {
  core: 0xfffbe0,
  hot: 0xffe08a,
  body: 0xf0b020,
  accent: 0x7aff5a,
  dark: 0x120e06,
  wax: 0xf6e6b0,
} as const;

export const HIVE_CSS = {
  core: '#fffbe0',
  hot: '#ffe08a',
  body: '#f0b020',
  accent: '#7aff5a',
  dark: '#120e06',
  wax: '#f6e6b0',
} as const;

const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const SQ3 = Math.sqrt(3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const easeOutBack = (x: number) => {
  const t = clamp01(x) - 1;
  return 1 + 2.2 * t * t * t + 1.2 * t * t;
};
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hsh = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------------------------------------------------------
// Merged, vertex-coloured geometry helpers
// ---------------------------------------------------------------------------------------------------------------

interface ColoredPart { geo: THREE.BufferGeometry; color: number | ((cx: number, cy: number, cz: number) => number); wing?: number }

/** Concatenates parts into one non-indexed geometry with `color` (rgb, linear) and `aWing` (0 body, +-1 wing side). */
function mergeParts(parts: ColoredPart[]) {
  const pos: number[] = [], col: number[] = [], wing: number[] = [];
  const c = new THREE.Color();
  for (const part of parts) {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i += 3) {
      let hex: number;
      if (typeof part.color === 'number') hex = part.color;
      else {
        const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
        hex = part.color(cx, cy, cz);
      }
      c.setHex(hex);
      for (let k = 0; k < 3; k++) {
        pos.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
        col.push(c.r, c.g, c.b);
        wing.push(part.wing ?? 0);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
  return geo;
}

// ---------------------------------------------------------------------------------------------------------------
// Swarm
// ---------------------------------------------------------------------------------------------------------------

/**
 * One wasp, about 1.1 units long along +Z (head at +0.4, stinger at -0.8): a striped amber abdomen, a dark thorax and
 * head with two acid-green eyes, a stinger and two pairs of pale wings that the shader flaps about their roots.
 */
function waspGeometry() {
  const parts: ColoredPart[] = [];
  const ab = new THREE.IcosahedronGeometry(1, 1);
  ab.scale(0.19, 0.18, 0.34);
  ab.translate(0, -0.02, -0.34);
  parts.push({ geo: ab, color: (_x, _y, z) => (Math.floor((z + 0.72) * 7) % 3 !== 0 ? HIVE.body : HIVE.dark) });
  const th = new THREE.IcosahedronGeometry(1, 0);
  th.scale(0.17, 0.16, 0.17);
  th.translate(0, 0.02, 0.0);
  parts.push({ geo: th, color: HIVE.dark });
  const head = new THREE.IcosahedronGeometry(1, 0);
  head.scale(0.13, 0.12, 0.12);
  head.translate(0, 0.0, 0.24);
  parts.push({ geo: head, color: HIVE.dark });
  for (const s of [-1, 1]) {
    const eye = new THREE.OctahedronGeometry(0.06, 0);
    eye.translate(s * 0.08, 0.04, 0.3);
    parts.push({ geo: eye, color: HIVE.accent });
  }
  const sting = new THREE.ConeGeometry(0.05, 0.24, 4);
  sting.rotateX(-Math.PI / 2);
  sting.translate(0, -0.06, -0.8);
  parts.push({ geo: sting, color: HIVE.dark });
  // Wings: two triangles each, root at (+-0.1, 0.13, z0), the shader rotates them about that root.
  for (const side of [-1, 1]) {
    for (const [z0, len, chord] of [[0.06, 0.3, 0.2], [-0.06, 0.22, 0.15]] as const) {
      const w = new THREE.BufferGeometry();
      const r = [side * 0.1, 0.13, z0], lead = [side * (0.1 + len * 0.5), 0.17, z0 + chord * 0.55], tip = [side * (0.1 + len), 0.2, z0 - chord * 0.15], trail = [side * (0.1 + len * 0.5), 0.15, z0 - chord * 0.6];
      w.setAttribute('position', new THREE.Float32BufferAttribute([...r, ...lead, ...tip, ...r, ...tip, ...trail], 3));
      parts.push({ geo: w, color: HIVE.wax, wing: side });
    }
  }
  return mergeParts(parts);
}

interface Wasp {
  pos: THREE.Vector3; dir: THREE.Vector3; vel: THREE.Vector3; seed: number; phase: number; lag: number; rr: number; w: number;
  sc: number; on: boolean;
}

type SwarmMode = 'cloud' | 'stream' | 'dive' | 'scatter' | 'form';

/**
 * An instanced cloud of wasps (unlit, a flicker of wings). Wasps below `count` are in the swarm; the rest are hidden, and
 * a wasp that joins pops in at `spawner(i, out)` (default: near the centre). Modes:
 * - `set(center, radius, count)`  a loose cloud orbiting `center` (change `radius`, `center` or `count` freely each frame).
 * - `stream(from, to, seconds)`   the cloud flies from `from` to `to` as a ribbon (head first, the rest trailing) then
 *                                 settles into a cloud at `to`.
 * - `dive(point, seconds)`        the cloud contracts and flies to `point` and stays there as a tight cloud.
 * - `scatter(seconds, flat, speed)` the wasps fly outward (flat = along the ground, like a ring) and shrink away; after
 *                                 `seconds` the swarm is empty.
 * - `form(fn, count, stiffness)`  each wasp i flies to `fn(i, out)` (return false to hide it): a fixed silhouette.
 * `size` is the wasp length in metres (draw them bigger than life: 0.4 and up). `frozen` holds time (a dead beat).
 * `update(dt)` each frame. Add `mesh`.
 */
export class Swarm {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  readonly center = new THREE.Vector3();
  radius = 1;
  count = 0;
  stiffness = 6;
  size: number;
  spawner: ((i: number, out: THREE.Vector3) => void) | null = null;
  formation: ((i: number, out: THREE.Vector3) => boolean) | null = null;
  private wasps: Wasp[] = [];
  private cap: number;
  private mode: SwarmMode = 'cloud';
  private age = 0;
  private dur = 1;
  private time = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private c0 = new THREE.Vector3();
  private r0 = 1;
  private trail = 0.5;
  private mat: THREE.ShaderMaterial;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private t1 = new THREE.Vector3();
  private t2 = new THREE.Vector3();
  private perp = new THREE.Vector3();

  constructor(max = 40, size = 0.5) {
    this.cap = max;
    this.size = size;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec3 color; attribute float aWing; uniform float uTime;
        varying vec3 vCol; varying float vWing;
        void main() {
          vec3 p = position;
          if (aWing != 0.0) {
            vec3 root = vec3(aWing * 0.1, 0.13, 0.0);
            float ph = float(gl_InstanceID) * 1.7;
            float ang = aWing * (0.3 + 0.7 * sin(uTime * 48.0 + ph));
            vec3 q = p - root;
            float c = cos(ang), s = sin(ang);
            q = vec3(q.x * c - q.y * s, q.x * s + q.y * c, q.z);
            p = root + q;
          }
          vCol = color; vWing = abs(aWing);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vCol; varying float vWing;
        void main() { gl_FragColor = vec4(vCol, mix(1.0, 0.3, vWing)); }`,
    });
    this.mesh = new THREE.InstancedMesh(waspGeometry(), this.mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 8;
    for (let i = 0; i < max; i++) {
      this.wasps.push({
        pos: new THREE.Vector3(), dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), vel: new THREE.Vector3(),
        seed: Math.random(), phase: Math.random() * 6.283, lag: Math.random(), rr: 0.3 + 0.7 * Math.sqrt(Math.random()),
        w: (1.6 + Math.random() * 2.6) * (Math.random() < 0.5 ? -1 : 1), sc: 0, on: false,
      });
    }
  }

  /** A loose orbiting cloud. */
  set(center: THREE.Vector3, radius: number, count: number, spawn: ((i: number, out: THREE.Vector3) => void) | null = null) {
    this.mode = 'cloud';
    this.center.copy(center);
    this.radius = radius;
    this.count = Math.min(count, this.cap);
    this.spawner = spawn;
    this.stiffness = 6;
  }

  stream(from: THREE.Vector3, to: THREE.Vector3, seconds: number, trail = 0.5) {
    this.trail = trail;
    this.mode = 'stream';
    this.from.copy(from);
    this.to.copy(to);
    this.center.copy(from);
    this.age = 0;
    this.dur = Math.max(seconds, 0.05);
    this.stiffness = 14;
  }

  dive(point: THREE.Vector3, seconds: number) {
    this.mode = 'dive';
    this.c0.copy(this.center);
    this.r0 = this.radius;
    this.to.copy(point);
    this.age = 0;
    this.dur = Math.max(seconds, 0.05);
    this.stiffness = 14;
  }

  scatter(seconds: number, flat = false, speed = 5) {
    this.mode = 'scatter';
    this.age = 0;
    this.dur = Math.max(seconds, 0.05);
    for (const w of this.wasps) {
      if (!w.on) continue;
      this.t1.subVectors(w.pos, this.center);
      if (flat) this.t1.y = 0;
      if (this.t1.lengthSq() < 1e-4) this.t1.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      this.t1.normalize().multiplyScalar(speed * (0.6 + 0.8 * Math.random()));
      this.t1.y += flat ? 0.6 + Math.random() * 1.6 : 1 + Math.random() * 2.5;
      w.vel.copy(this.t1);
    }
  }

  form(fn: (i: number, out: THREE.Vector3) => boolean, count: number, stiffness = 7) {
    this.mode = 'form';
    this.formation = fn;
    this.count = Math.min(count, this.cap);
    this.stiffness = stiffness;
  }

  /** True while any wasp is still shown. */
  get busy() {
    return this.wasps.some((w) => w.on);
  }

  reset() {
    for (const w of this.wasps) { w.on = false; w.sc = 0; }
    this.count = 0;
    this.mode = 'cloud';
    this.formation = null;
    this.spawner = null;
    this.frozen = false;
    this.mesh.count = 0;
  }

  /** Where wasp `w` wants to be right now (false: it has no place in this mode). */
  private target(w: Wasp, i: number, out: THREE.Vector3): boolean {
    const t = this.time;
    if (this.mode === 'form') {
      if (!this.formation || !this.formation(i, out)) return false;
      out.x += Math.sin(t * 7 + w.seed * 20) * 0.1;
      out.y += Math.sin(t * 6 + w.seed * 31) * 0.1;
      out.z += Math.cos(t * 7 + w.seed * 13) * 0.1;
      return true;
    }
    if (this.mode === 'stream') {
      const trail = this.trail;
      const head = easeInOut(this.age / this.dur) * (1 + trail);
      const pi = clamp01(head - w.lag * trail);
      out.lerpVectors(this.from, this.to, pi);
      this.perp.set(-(this.to.z - this.from.z), 0, this.to.x - this.from.x);
      if (this.perp.lengthSq() < 1e-6) this.perp.set(1, 0, 0);
      this.perp.normalize();
      const ang = w.phase + t * 16 * Math.sign(w.w);
      const r = this.radius * (0.35 + 0.65 * w.rr);
      out.addScaledVector(this.perp, Math.cos(ang) * r);
      out.y += Math.sin(ang) * r * 0.8 + Math.sin(pi * Math.PI) * 0.7;
      return true;
    }
    // Cloud (and dive, which moves the cloud): a lumpy orbit with noise.
    const R = this.radius;
    const a = w.phase + t * w.w;
    const r = R * w.rr;
    const ny = Math.min(R * 0.6, 1.4);
    out.set(
      this.center.x + Math.cos(a) * r + Math.sin(t * 3 + w.seed * 17) * 0.22 * R,
      this.center.y + Math.sin(a * 1.3 + w.seed * 6) * ny * 0.8 + Math.sin(t * 2.3 + w.seed * 9) * 0.15 * R,
      this.center.z + Math.sin(a) * r + Math.cos(t * 2.7 + w.seed * 5) * 0.22 * R,
    );
    return true;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    this.time += d;
    this.mat.uniforms.uTime.value = this.time;
    if (this.mode !== 'cloud' && this.mode !== 'form') {
      this.age += d;
      if (this.mode === 'stream' && this.age >= this.dur) { this.center.copy(this.to); this.mode = 'cloud'; this.stiffness = 6; }
      else if (this.mode === 'dive') {
        const p = clamp01(this.age / this.dur);
        this.center.lerpVectors(this.c0, this.to, p * p);
        this.radius = this.r0 * (1 - 0.7 * easeInOut(p));
        if (this.age >= this.dur) { this.mode = 'cloud'; this.stiffness = 6; }
      } else if (this.mode === 'scatter' && this.age >= this.dur) {
        for (const w of this.wasps) { w.on = false; w.sc = 0; }
        this.count = 0;
        this.mode = 'cloud';
      }
    }
    const k = 1 - Math.exp(-this.stiffness * d);
    let n = 0;
    for (let i = 0; i < this.cap; i++) {
      const w = this.wasps[i];
      if (this.mode === 'scatter') {
        if (!w.on) continue;
        w.pos.addScaledVector(w.vel, d);
        w.vel.multiplyScalar(Math.exp(-1.4 * d));
        w.vel.y -= 1.5 * d;
        if (w.pos.y < 0.2) { w.pos.y = 0.2; w.vel.y = Math.abs(w.vel.y) * 0.3; }
        w.sc = 1 - sstep(0.45, 1, this.age / this.dur);
        if (w.vel.lengthSq() > 0.04) w.dir.lerp(this.t2.copy(w.vel).normalize(), 0.2).normalize();
      } else {
        let active = i < this.count;
        if (active) active = this.target(w, i, this.t1);
        if (active && !w.on) {
          w.on = true;
          w.sc = 0;
          if (this.spawner) this.spawner(i, w.pos);
          else w.pos.set(this.center.x + (Math.random() - 0.5) * 0.6, this.center.y + (Math.random() - 0.5) * 0.6, this.center.z + (Math.random() - 0.5) * 0.6);
        }
        if (!w.on) continue;
        w.sc += ((active ? 1 : 0) - w.sc) * Math.min(1, 7 * d);
        if (!active && w.sc < 0.02) { w.on = false; w.sc = 0; continue; }
        if (active) {
          this.t2.copy(w.pos);
          w.pos.lerp(this.t1, k);
          this.t2.subVectors(w.pos, this.t2);
          if (d > 0 && this.t2.lengthSq() > 1e-6) w.dir.lerp(this.t2.normalize(), 0.22).normalize();
        }
      }
      if (w.sc < 0.01) continue;
      this.q.setFromUnitVectors(AXIS_Z, w.dir);
      const sz = Math.max(this.size * 1.5 * w.sc * (0.85 + 0.3 * w.seed), MIN_SCALE);
      this.m.compose(w.pos, this.q, this.s.setScalar(sz));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Honeycomb
// ---------------------------------------------------------------------------------------------------------------

export type HoneyStyle = 'wax' | 'chitin';

/**
 * One hexagonal cell of unit circumradius, lying flat (normal +Y, vertices at +-X). 'wax': a dark prism (the gap), a
 * wax-pale frame, an amber face and a darker amber hollow. 'chitin': an amber-rimmed prism, a near-black face, an amber
 * frame line and a lighter chitin centre.
 */
function hexGeometry(style: HoneyStyle) {
  const cyl = () => { const g = new THREE.CylinderGeometry(1, 1, 0.2, 6); g.rotateY(Math.PI / 2); g.translate(0, 0.1, 0); return g; };
  const disc = (r: number, y: number) => { const g = new THREE.CircleGeometry(r, 6); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
  const ring = (a: number, b: number, y: number) => { const g = new THREE.RingGeometry(a, b, 6); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
  const wax = style === 'wax';
  return mergeParts([
    { geo: cyl(), color: wax ? HIVE.dark : 0xc88a10 },
    { geo: disc(wax ? 0.8 : 0.9, 0.204), color: wax ? HIVE.body : 0x1a1409 },
    { geo: ring(wax ? 0.8 : 0.82, wax ? 0.97 : 0.95, 0.208), color: wax ? HIVE.wax : HIVE.body },
    { geo: disc(wax ? 0.46 : 0.5, 0.212), color: wax ? 0x8a5a0c : 0x2c2314 },
  ]);
}

interface Cell { p: THREE.Vector3; q: THREE.Quaternion; sx: number; sy: number; delay: number; off: THREE.Vector3; cd: number }

/**
 * Hexagonal cells that grow in cell by cell (each pops in with a small overshoot, flying in from `off`) and crumble away
 * (cells sink and shrink in a random order). Layouts: `grow(center, radius, seconds, inner)` a flat patch or band on the
 * floor, `wall(center, radius, height, seconds)` a ring wall of standing plates that rises, `dome(center, radius, height,
 * seconds)` loose plates in a shell round a point (use the 'chitin' style). `setCenter` moves the whole thing (cells are
 * stored relative to the centre). `crumble(seconds)` ends it. `update(dt)` each frame, `reset()` hides it. Add `mesh`.
 */
export class Honeycomb {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private cells: Cell[] = [];
  private n = 0;
  private state: 'off' | 'grow' | 'crumble' = 'off';
  private age = 0;
  private dur = 0.5;
  private cAge = -1;
  private cDur = 0.5;
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private qa = new THREE.Quaternion();
  private basis = new THREE.Matrix4();

  constructor(private max = 120, style: HoneyStyle = 'wax') {
    this.mesh = new THREE.InstancedMesh(hexGeometry(style), new THREE.MeshBasicMaterial({ vertexColors: true }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.renderOrder = 3;
    for (let i = 0; i < max; i++) {
      this.cells.push({ p: new THREE.Vector3(), q: new THREE.Quaternion(), sx: 1, sy: 1, delay: 0, off: new THREE.Vector3(), cd: hsh(i * 1.9 + 0.3) });
    }
  }

  setCenter(c: THREE.Vector3) {
    this.mesh.position.set(c.x, 0, c.z);
  }

  get active() {
    return this.state !== 'off';
  }

  private begin(center: THREE.Vector3, seconds: number) {
    this.n = 0;
    this.setCenter(center);
    this.state = 'grow';
    this.age = 0;
    this.cAge = -1;
    this.dur = Math.max(seconds, 0.05);
    this.mesh.visible = true;
  }

  private add(): Cell | null {
    return this.n < this.max ? this.cells[this.n++] : null;
  }

  /** A flat hexagon patch (or, with `inner`, a band) on the floor; cells with cell radius `cell`. Grows outward (patch) or around (band). */
  grow(center: THREE.Vector3, radius: number, seconds = 0.5, inner = 0, cell = 0.55) {
    this.begin(center, seconds);
    const span = Math.ceil(radius / (cell * 1.5)) + 1;
    for (let q = -span; q <= span; q++) {
      for (let r = -span - Math.ceil(span / 2); r <= span + Math.ceil(span / 2); r++) {
        const x = 1.5 * cell * q, z = SQ3 * cell * (r + q / 2);
        const dist = Math.hypot(x, z);
        if (dist > radius || dist < inner) continue;
        const c = this.add();
        if (!c) return;
        c.p.set(x, 0.01, z);
        c.q.identity();
        c.sx = cell * 0.94;
        c.sy = cell * 1.7;
        c.delay = inner > 0 ? (Math.atan2(z, x) + Math.PI) / (Math.PI * 2) * 0.85 + hsh(q * 7 + r) * 0.15 : clamp01(dist / radius) * 0.85 + hsh(q * 7 + r) * 0.15;
        c.off.set(0, 0.5, 0);
      }
    }
  }

  /** A ring wall of standing hexagon plates round `center`, growing upward row by row. */
  wall(center: THREE.Vector3, radius: number, height: number, seconds = 1, cell = 0.5, thick = 1.5) {
    this.begin(center, seconds);
    let cols = Math.round((Math.PI * 2 * radius) / (1.5 * cell));
    if (cols % 2) cols++;
    const rowH = SQ3 * cell;
    for (let q = 0; q < cols; q++) {
      const th = (q / cols) * Math.PI * 2;
      const nx = Math.cos(th), nz = Math.sin(th);
      for (let row = 0; row < 8; row++) {
        const y = cell * 0.87 + row * rowH + (q % 2) * rowH * 0.5;
        if (y - cell * 0.87 > height - rowH * 0.7) break;
        const c = this.add();
        if (!c) return;
        c.p.set(nx * radius, y, nz * radius);
        // Local X along the tangent, local Y outward, local Z up.
        this.basis.makeBasis(this.p.set(-nz, 0, nx), this.s.set(nx, 0, nz), UP);
        c.q.setFromRotationMatrix(this.basis);
        c.sx = cell * 0.94;
        c.sy = cell * thick;
        c.delay = clamp01(y / (height + 0.01)) * 0.7 + hsh(q * 3.7 + row) * 0.3;
        c.off.set(0, -y - 0.6, 0);
      }
    }
  }

  /** Loose plates on a spheroid (radius, height) round `center` that fly in from outside and snap into place. */
  dome(center: THREE.Vector3, radius: number, height: number, seconds = 0.3, count = 26, cell = 0.4) {
    this.begin(center, seconds);
    const cy = height * 0.5;
    for (let i = 0; i < count; i++) {
      const t = -0.55 + 1.5 * ((i + 0.5) / count);
      const ph = i * 2.399963 + 0.5;
      const rr = Math.sqrt(Math.max(1 - Math.min(t, 0.97) * Math.min(t, 0.97), 0.02));
      const x = Math.cos(ph) * radius * rr, z = Math.sin(ph) * radius * rr, y = cy + Math.min(t, 0.97) * cy;
      const c = this.add();
      if (!c) return;
      c.p.set(x, y, z);
      this.p.set(x / (radius * radius), (y - cy) / (cy * cy), z / (radius * radius)).normalize();
      c.q.setFromUnitVectors(UP, this.p);
      c.q.multiply(this.qa.setFromAxisAngle(UP, hsh(i * 2.7) * 1.0));
      c.sx = cell * (0.85 + 0.3 * hsh(i * 1.3));
      c.sy = cell * 0.9;
      c.delay = hsh(i * 5.1 + 2) * 0.85;
      c.off.copy(this.p).multiplyScalar(1.6);
    }
  }

  crumble(seconds = 0.5) {
    if (this.state === 'off') return;
    this.state = 'crumble';
    this.cAge = 0;
    this.cDur = Math.max(seconds, 0.05);
  }

  reset() {
    this.state = 'off';
    this.n = 0;
    this.cAge = -1;
    this.frozen = false;
    this.mesh.visible = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    if (this.state === 'off') return;
    const d = this.frozen ? 0 : dt;
    this.age += d;
    if (this.cAge >= 0) {
      this.cAge += d;
      if (this.cAge >= this.cDur) { this.reset(); return; }
    }
    const u = this.age / this.dur;
    for (let i = 0; i < this.n; i++) {
      const c = this.cells[i];
      const x = (u - c.delay * 0.7) / 0.3;
      const g = easeOutBack(x);
      const e = easeOut(x);
      let cr = 0;
      if (this.cAge >= 0) cr = clamp01((this.cAge - c.cd * this.cDur * 0.5) / (this.cDur * 0.5));
      const vis = Math.max(g * (1 - cr), 0);
      this.p.copy(c.p).addScaledVector(c.off, 1 - e);
      this.p.y -= cr * cr * 0.7;
      this.s.set(Math.max(c.sx * vis, MIN_SCALE), Math.max(c.sy * vis, MIN_SCALE), Math.max(c.sx * vis, MIN_SCALE));
      this.m.compose(this.p, c.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// HoneySplash
// ---------------------------------------------------------------------------------------------------------------

interface Blob { live: boolean; landed: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; tone: number }

/**
 * A few amber blobs thrown out and up that fall, land as flat puddles and shrink away (about 1 s). Flat-shaded, no
 * gloss. `burst(pos, count, speed, size, up)` throws a handful; at most 28 at once. `frozen` holds them. `update(dt)`
 * each frame. Add `mesh`.
 */
export class HoneySplash {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private blobs: Blob[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private tones = [new THREE.Color(HIVE.body), new THREE.Color(HIVE.hot), new THREE.Color(0xc88a10)];

  constructor(max = 28) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.blobs.push({ live: false, landed: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 0.15, tone: 0 });
  }

  burst(pos: THREE.Vector3, count = 8, speed = 4, size = 0.16, up = 3) {
    for (let i = 0; i < count; i++) {
      const b = this.blobs[this.cursor];
      this.cursor = (this.cursor + 1) % this.blobs.length;
      const a = Math.random() * Math.PI * 2, sp = speed * (0.35 + Math.random() * 0.8);
      b.live = true;
      b.landed = false;
      b.pos.set(pos.x, Math.max(pos.y, 0.2), pos.z);
      b.vel.set(Math.cos(a) * sp, up * (0.5 + Math.random() * 0.9), Math.sin(a) * sp);
      b.age = 0;
      b.life = 0.9 + Math.random() * 0.4;
      b.size = size * (0.6 + Math.random() * 0.8);
      b.tone = Math.random() < 0.6 ? 0 : Math.random() < 0.6 ? 1 : 2;
    }
  }

  reset() {
    for (const b of this.blobs) b.live = false;
    this.frozen = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    let n = 0;
    for (const b of this.blobs) {
      if (!b.live) continue;
      b.age += d;
      if (b.age >= b.life) { b.live = false; continue; }
      if (!b.landed) {
        b.vel.y -= 16 * d;
        b.pos.addScaledVector(b.vel, d);
        if (b.pos.y < 0.06 && b.vel.y < 0) { b.pos.y = 0.04; b.landed = true; }
      }
      const u = b.age / b.life;
      const shrink = Math.max(1 - sstep(0.6, 1, u), MIN_SCALE);
      const sx = b.size * (b.landed ? 1.8 : 1) * shrink, sy = b.size * (b.landed ? 0.3 : 1) * shrink;
      this.q.identity();
      this.m.compose(b.pos, this.q, this.s.set(Math.max(sx, MIN_SCALE), Math.max(sy, MIN_SCALE), Math.max(sx, MIN_SCALE)));
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.tones[b.tone]);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// ClawSlash
// ---------------------------------------------------------------------------------------------------------------

interface Claw { live: boolean; age: number; life: number; sweep: number; pos: THREE.Vector3; yaw: number; tilt: number; radius: number; span: number; width: number; spin: number; rise: number }

export interface ClawOptions {
  /** Width of the crescent at its middle, world units (default 20% of the radius; never under 0.2). */
  width?: number;
  /** Sweep on from the other end. */
  reverse?: boolean;
  /** Radians per second the crescent turns about its own centre. */
  spin?: number;
  /** Metres per second it drifts up. */
  rise?: number;
  /** Seconds the sweep-on takes (default 0.14). */
  sweep?: number;
}

/**
 * Pooled claw crescents: flat unlit sickles, near-black with a serrated outer edge, an amber rim and amber hexagonal
 * flecks, a hot glow at the leading end, needle tips. `slash(center, dir, radius, arcDeg, tilt, seconds, opts)` sweeps one
 * on along its arc, lets it hang and fades it over `seconds`. The arc is centred on `dir` (horizontal heading) and rolled
 * by `tilt` radians about it. `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class ClawSlash {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private claws: Claw[] = [];
  private cursor = 0;
  private aS: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(max = 6) {
    const SEG = 40;
    const pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= SEG; i++) { const u = i / SEG; pos.push(u, 0, 0, u, 1, 0); }
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aS', this.aS);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uDark: { value: new THREE.Color(HIVE.dark) }, uBody: { value: new THREE.Color(HIVE.body) },
        uHot: { value: new THREE.Color(HIVE.hot).multiplyScalar(0.92) }, uWax: { value: new THREE.Color(HIVE.wax).multiplyScalar(0.9) },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aS; varying vec2 vUv; varying vec4 vS;
        void main() {
          float u = position.x, v = position.y;
          float a = (u - 0.5) * aS.z;
          float taper = pow(max(sin(3.14159265 * u), 0.0), 0.8);
          float r = 1.0 - v * aS.w * taper;
          vec3 p = vec3(sin(a) * r, 0.0, cos(a) * r);
          vUv = vec2(u, v); vS = aS;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uDark, uBody, uHot, uWax; varying vec2 vUv; varying vec4 vS;
        float hexDist(vec2 p) { p = abs(p); float c = dot(p, normalize(vec2(1.0, 1.73))); return max(c, p.x); }
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          float u = vUv.x, v = vUv.y;
          float head = vS.x;
          float vis = 1.0 - smoothstep(head - 0.07, head, u);
          float behind = clamp(head - u, 0.0, 1.5);
          float a = vS.y * vis * (1.0 - 0.5 * smoothstep(0.35, 1.2, behind));
          if (a < 0.02) discard;
          // Serrated outer edge: a sawtooth cut into the leading side.
          float cut = 0.24 * fract(u * 15.0 + 0.3);
          if (v < cut) discard;
          vec3 col = uDark;
          // Hexagonal flecks in the body.
          vec2 hp = vec2(u * 26.0, v * 4.5);
          vec2 r = vec2(1.0, 1.73); vec2 h = r * 0.5;
          vec2 g1 = mod(hp, r) - h; vec2 g2 = mod(hp - h, r) - h;
          vec2 gv = dot(g1, g1) < dot(g2, g2) ? g1 : g2;
          float id = h21(hp - gv);
          if (id > 0.62 && hexDist(gv) < 0.36 && v > cut + 0.2 && v < 0.85) col = mix(uBody, uWax, id > 0.85 ? 0.5 : 0.0) * 0.9;
          // Amber rim along the serrations, a thin amber line on the inner edge.
          col = mix(col, mix(uBody, uHot, 0.55), 1.0 - smoothstep(cut + 0.08, cut + 0.22, v));
          col = mix(col, uBody * 0.8, smoothstep(0.88, 0.95, v));
          float glow = exp(-(head - u) * 9.0) * step(u, head) * (1.0 - step(1.05, head));
          col = mix(col, uHot, glow * 0.8 * (1.0 - smoothstep(0.55, 0.95, v)));
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 6;
    for (let i = 0; i < max; i++) {
      this.claws.push({ live: false, age: 0, life: 1, sweep: 0.14, pos: new THREE.Vector3(), yaw: 0, tilt: 0, radius: 1, span: 1, width: 0.3, spin: 0, rise: 0 });
    }
  }

  slash(center: THREE.Vector3, dir: THREE.Vector3, radius: number, arcDeg: number, tilt: number, seconds: number, opts: ClawOptions = {}) {
    const c = this.claws[this.cursor];
    this.cursor = (this.cursor + 1) % this.claws.length;
    c.live = true;
    c.age = 0;
    c.life = Math.max(seconds, 0.05);
    c.sweep = Math.min(opts.sweep ?? 0.14, c.life * 0.6);
    c.pos.copy(center);
    c.yaw = Math.atan2(dir.x, dir.z);
    c.tilt = tilt;
    c.radius = Math.max(radius, MIN_SCALE);
    c.span = THREE.MathUtils.degToRad(arcDeg) * (opts.reverse ? -1 : 1);
    c.width = Math.max(opts.width ?? radius * 0.2, 0.2);
    c.spin = opts.spin ?? 0;
    c.rise = opts.rise ?? 0;
  }

  reset() {
    for (const c of this.claws) c.live = false;
    this.frozen = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    const a = this.aS.array as Float32Array;
    let n = 0;
    for (const c of this.claws) {
      if (!c.live) continue;
      c.age += d;
      if (c.age >= c.life) { c.live = false; continue; }
      const u = c.age / c.life;
      this.q.setFromAxisAngle(UP, c.yaw + c.spin * c.age);
      this.qb.setFromAxisAngle(AXIS_Z, c.tilt);
      this.q.multiply(this.qb);
      this.p.copy(c.pos);
      this.p.y += c.rise * c.age;
      const r = c.radius * (1 + 0.05 * u);
      this.m.compose(this.p, this.q, this.s.setScalar(r));
      this.mesh.setMatrixAt(n, this.m);
      a[n * 4] = 1.1 * easeOut(c.age / c.sweep);
      a[n * 4 + 1] = 1 - sstep(0.5, 1, u);
      a[n * 4 + 2] = c.span;
      a[n * 4 + 3] = Math.min(c.width / r, 0.7);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aS.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// waspLook
// ---------------------------------------------------------------------------------------------------------------

let waspShared: { dark: THREE.MeshBasicMaterial; wing: THREE.MeshBasicMaterial; eye: THREE.MeshBasicMaterial; geo: Record<string, THREE.BufferGeometry> } | null = null;
function shared() {
  waspShared ??= {
    dark: new THREE.MeshBasicMaterial({ color: HIVE.dark }),
    wing: new THREE.MeshBasicMaterial({ color: new THREE.Color(HIVE.wax).multiplyScalar(0.92), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    eye: new THREE.MeshBasicMaterial({ color: HIVE.accent }),
    geo: {},
  };
  return waspShared;
}

/**
 * The wasp-soldier look: a giant hovering wasp, about 0.9 m long, for `melee` units. Amber abdomen (the figure's body
 * colour, flashes when hit) with dark stripes and a stinger, a dark thorax and head with big acid-green eyes,
 * mandibles, antennae, dangling legs and two pairs of flickering pale wings. It hovers (the feet height is the hover
 * height, about 0.55), leans forward when it walks and lunges stinger-first on a swing. Other kinds get the same wasp.
 */
export const waspLook: MinionLook = (_kind, p) => {
  const sh = shared();
  const geo = (key: string, make: () => THREE.BufferGeometry) => (sh.geo[key] ??= make());
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    return o;
  };
  /** A back-face hull a little bigger than `src` (the dark toon outline). */
  const hull = (src: THREE.Mesh, k = 1.16) => {
    const o = new THREE.Mesh(src.geometry, p.outline);
    o.position.copy(src.position);
    o.rotation.copy(src.rotation);
    o.scale.copy(src.scale).multiplyScalar(k);
    return o;
  };
  const root = new THREE.Group();
  const fly = new THREE.Group();
  fly.position.y = 0.55;
  root.scale.setScalar(1.45);
  root.add(fly);
  const ico1 = geo('ico1', () => new THREE.IcosahedronGeometry(1, 1));
  const ico0 = geo('ico0', () => new THREE.IcosahedronGeometry(1, 0));

  // Abdomen with dark stripes and a stinger, tilted tail-down.
  const abd = new THREE.Group();
  abd.position.set(0, -0.02, -0.12);
  abd.rotation.x = 0.28;
  const abdomen = mesh(ico1, p.body, 0, 0, -0.26);
  abdomen.scale.set(0.21, 0.2, 0.37);
  abd.add(hull(abdomen), abdomen);
  const ring = geo('ring', () => new THREE.CylinderGeometry(1, 1, 0.075, 10).rotateX(Math.PI / 2));
  [[-0.12, 0.93], [-0.29, 1.0], [-0.46, 0.85]].forEach(([z, f]) => {
    const st = mesh(ring, sh.dark, 0, 0, z);
    st.scale.set(0.215 * f, 0.205 * f, 1);
    abd.add(st);
  });
  const sting = mesh(geo('sting', () => new THREE.ConeGeometry(0.05, 0.26, 5).rotateX(-Math.PI / 2)), p.trim, 0, -0.01, -0.7);
  abd.add(sting);
  fly.add(abd);

  // Thorax and head.
  const thorax = mesh(ico0, sh.dark, 0, 0.02, 0.06);
  thorax.scale.set(0.18, 0.17, 0.18);
  const head = mesh(ico0, p.body, 0, 0.0, 0.29);
  head.scale.set(0.14, 0.13, 0.13);
  fly.add(hull(thorax), hull(head, 1.22), thorax, head);
  for (const s of [-1, 1]) {
    const eye = mesh(geo('eye', () => new THREE.IcosahedronGeometry(0.07, 0)), sh.eye, s * 0.09, 0.04, 0.35);
    fly.add(eye);
    const mand = mesh(geo('mand', () => new THREE.ConeGeometry(0.035, 0.16, 4).rotateX(Math.PI / 2)), sh.dark, s * 0.045, -0.08, 0.4);
    mand.rotation.y = -s * 0.35;
    fly.add(mand);
    const ant = mesh(geo('ant', () => new THREE.BoxGeometry(0.022, 0.022, 0.24)), sh.dark, s * 0.05, 0.12, 0.43);
    ant.rotation.set(-0.5, -s * 0.2, 0);
    fly.add(ant);
  }
  // Legs dangling under the thorax.
  const legGeo = geo('leg', () => new THREE.BoxGeometry(0.03, 0.22, 0.03).translate(0, -0.11, 0));
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    [0.14, 0.04, -0.06].forEach((z, i) => {
      const leg = mesh(legGeo, sh.dark, s * 0.09, -0.08, z);
      leg.rotation.z = s * (0.35 + i * 0.1);
      fly.add(leg);
      legs.push(leg);
    });
  }
  // Two pairs of wings, pivoting at their roots.
  const wingGeo = geo('wing', () => new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0).rotateX(-Math.PI / 2));
  const wings: { g: THREE.Group; side: number; ph: number }[] = [];
  for (const side of [-1, 1]) {
    [[0.08, 0.62, 0.26], [-0.05, 0.46, 0.2]].forEach(([z, len, chord], k) => {
      const g = new THREE.Group();
      g.position.set(side * 0.1, 0.17, z);
      const w = mesh(wingGeo, sh.wing);
      w.scale.set(side * len, 1, chord);
      g.add(w);
      fly.add(g);
      wings.push({ g, side, ph: k * 1.3 });
    });
  }

  return {
    root,
    barY: 1.8,
    animate(_dt, pose) {
      const t = pose.time;
      const flap = 48;
      for (const w of wings) w.g.rotation.z = w.side * (0.3 + 0.65 * Math.sin(t * flap + w.ph + (w.side > 0 ? 0 : 0.4)));
      let pitch = 0.18 * pose.walk, push = 0, curl = 0;
      if (pose.swing >= 0) {
        // Rear back (nose up), then dive stinger-first.
        const s = pose.swing;
        pitch = s < 0.6 ? -0.5 * (s / 0.6) : -0.5 + ((s - 0.6) / 0.4) * 1.5;
        push = s < 0.6 ? -0.05 : -0.05 + ((s - 0.6) / 0.4) * 0.4;
        curl = s < 0.6 ? 0.5 * (s / 0.6) : 0.5 - ((s - 0.6) / 0.4) * 1.0;
      }
      fly.rotation.x = pitch;
      fly.position.y = 0.55 + Math.sin(t * 3.2) * 0.05;
      root.position.z = push;
      abd.rotation.x = 0.28 + curl;
      for (let i = 0; i < legs.length; i++) legs[i].rotation.x = Math.sin(t * 5 + i) * 0.08;
    },
  };
};

// ---------------------------------------------------------------------------------------------------------------
// QueenBody
// ---------------------------------------------------------------------------------------------------------------

/**
 * The solid core of the swarm-queen (the ultimate): a striped amber abdomen, dark chitin thorax and head with green eyes,
 * antennae and a stinger (about 5.5 long in all) and four big translucent amber wings (fore span 4 each side, hind span
 * 2.8), every body part with an amber rim hull. `set(center, axis, wing, normal, fold, flap, k)` poses it: `axis` points
 * tail to head, `wing` is the wing axis, `normal` = axis x wing, `fold` 0 open .. 1 folded back, `flap` a time for the
 * small wing tremble, `k` 0..1 the size pop. `hide()` / `reset()` hide it. Add `mesh`.
 */
export class QueenBody {
  readonly mesh = new THREE.Group();
  private root = new THREE.Group();
  private wings: { g: THREE.Group; side: number; hind: number }[] = [];
  private basis = new THREE.Matrix4();

  constructor() {
    const dark = new THREE.MeshBasicMaterial({ color: HIVE.dark });
    const amber = new THREE.MeshBasicMaterial({ color: HIVE.body });
    const rim = new THREE.MeshBasicMaterial({ color: 0xc88a10, side: THREE.BackSide });
    const eye = new THREE.MeshBasicMaterial({ color: HIVE.accent });
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
    const ico = new THREE.IcosahedronGeometry(1, 2);
    const ball = (m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const a = new THREE.Mesh(ico, m);
      a.position.set(x, y, z);
      a.scale.set(sx, sy, sz);
      const h = new THREE.Mesh(ico, rim);
      h.position.copy(a.position);
      h.scale.set(sx * 1.07, sy * 1.07, sz * 1.07);
      this.root.add(h, a);
    };
    ball(amber, 0, -0.1, -2.0, 0.95, 0.9, 1.75);
    // Dark stripes round the abdomen.
    const ringG = new THREE.CylinderGeometry(1, 1, 0.34, 14).rotateX(Math.PI / 2);
    [[-0.9, 0.9], [-1.6, 1.0], [-2.3, 0.95], [-2.95, 0.74]].forEach(([z, f]) => {
      const st = new THREE.Mesh(ringG, dark);
      st.position.set(0, -0.1, z);
      st.scale.set(0.97 * f, 0.92 * f, 1);
      this.root.add(st);
    });
    const sting = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 6).rotateX(-Math.PI / 2), dark);
    sting.position.set(0, -0.15, -3.95);
    this.root.add(sting);
    ball(dark, 0, 0, 0, 0.85, 0.8, 0.85);
    ball(dark, 0, 0.02, 1.2, 0.55, 0.5, 0.55);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), eye);
      e.position.set(s * 0.3, 0.12, 1.55);
      this.root.add(e);
      const ant = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), dark);
      ant.position.set(s * 0.25, 0.5, 2.0);
      ant.rotation.set(-0.5, -s * 0.25, 0);
      this.root.add(ant);
    }
    const shape = new THREE.Shape();
    shape.absellipse(0.5, 0, 0.5, 0.2, 0, Math.PI * 2, false, 0);
    const wingGeo = new THREE.ShapeGeometry(shape, 24).rotateX(-Math.PI / 2);
    for (const side of [-1, 1]) {
      for (const hind of [0, 1]) {
        const g = new THREE.Group();
        g.position.set(0, 0.55, hind ? -0.3 : 0.45);
        const w = new THREE.Mesh(wingGeo, wingMat);
        w.scale.set(side * (hind ? 2.8 : 4.0), 1, hind ? 1.3 : 1.9);
        g.add(w);
        this.root.add(g);
        this.wings.push({ g, side, hind });
      }
    }
    this.mesh.add(this.root);
    this.mesh.visible = false;
  }

  set(center: THREE.Vector3, axis: THREE.Vector3, wing: THREE.Vector3, normal: THREE.Vector3, fold: number, flap: number, k: number) {
    this.mesh.visible = k > 0.01;
    this.basis.makeBasis(wing, normal, axis);
    this.root.quaternion.setFromRotationMatrix(this.basis);
    this.root.position.copy(center);
    this.root.scale.setScalar(Math.max(k, MIN_SCALE));
    for (const w of this.wings) {
      const sweep = w.hind ? 0.55 : 0.25;
      w.g.rotation.y = w.side * (sweep + fold * (Math.PI / 2 - sweep) * 0.95);
      w.g.rotation.z = w.side * 0.12 * Math.sin(flap * 20 + w.hind * 1.3) * (1 - fold);
    }
  }

  hide() {
    this.mesh.visible = false;
  }

  reset() {
    this.hide();
  }
}
