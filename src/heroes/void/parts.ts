import * as THREE from 'three';

/**
 * The void kit (pipeline/designs/kit-void.md): torn space. Jagged slits of pure black (unlit, depth-writing, so they really
 * cut the frame) with a hot rift-pink edge on one side and a thin cyan fringe on the other, glass-like cracks on the
 * ground, flat drifting shards of the world with a pale ash rim, and ash motes that fall upward. No spheres, no discs,
 * no swirling. Everything is pooled, takes world-space positions and has a `reset()`. Materials are unlit.
 *
 * - `Rift`     jagged black tears: `open` (flat on the ground), `openStanding` (a vertical slit), `openPath` (any polyline),
 *              `close`, `flare`, `snap`, `place`.
 * - `Shards`   pooled world flakes: `drift` (stream into a point and vanish), `burst` (thrown out, fall, shrink).
 * - `Crackle`  a ground decal of glass cracks (black with pink edges): `grow`, `ring`, `fade`, `invert`.
 * - `AshMotes` small pale motes that rise slowly: `emit`.
 */

/** Palette. Numbers for `THREE.Color`, `VOID_CSS` for APIs that want a string. `ash` is the pale foil. */
export const VOID = {
  core: 0xffffff,
  hot: 0xffc4d4,
  body: 0xff2a55,
  accent: 0x7affff,
  dark: 0x000000,
  ash: 0xd8d4e0,
} as const;

export const VOID_CSS = {
  core: '#ffffff',
  hot: '#ffc4d4',
  body: '#ff2a55',
  accent: '#7affff',
  dark: '#000000',
  ash: '#d8d4e0',
} as const;

const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x: number) => { const t = clamp01(x); return t * t; };
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hsh = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------------------------------------------------------
// Rift
// ---------------------------------------------------------------------------------------------------------------

/**
 * Builds the ribbon of one slit. Rows run along the path; each row has four vertices across: the cyan outer edge (v 0), the
 * left black edge (v 1), the right black edge (v 2) and the pink outer edge (v 3). `aOff` is the offset across the slit
 * in metres at full opening, `aPerp` the across direction; the vertex shader scales the offsets by the opening.
 */
function riftGeometry(points: THREE.Vector3[], facings: THREE.Vector3[], width: number, seed: number, wedge = false) {
  // Resample to rows about 0.3 m apart (8..40 rows).
  const seg: number[] = [0];
  for (let i = 1; i < points.length; i++) seg.push(seg[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = Math.max(seg[seg.length - 1], 1e-3);
  const rows = Math.min(40, Math.max(8, Math.round(total / 0.3)));
  const at = (u: number, out: THREE.Vector3, fout: THREE.Vector3) => {
    const d = u * total;
    let j = 1;
    while (j < seg.length - 1 && seg[j] < d) j++;
    const a = seg[j - 1], b = seg[j], f = b > a ? clamp01((d - a) / (b - a)) : 0;
    out.lerpVectors(points[j - 1], points[j], f);
    fout.lerpVectors(facings[Math.min(j - 1, facings.length - 1)], facings[Math.min(j, facings.length - 1)], f);
  };
  const cw = Math.max(0.07, width * 0.14), pw = Math.max(0.11, width * 0.25);
  const pos: number[] = [], perpA: number[] = [], off: number[] = [], aU: number[] = [], aV: number[] = [], wob: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Vector3(), f = new THREE.Vector3(), c2 = new THREE.Vector3(), f2 = new THREE.Vector3();
  const t = new THREE.Vector3(), perp = new THREE.Vector3();
  for (let i = 0; i < rows; i++) {
    const u = i / (rows - 1);
    at(u, c, f);
    at(Math.min(u + 0.02, 1), c2, f2);
    t.subVectors(c2, c);
    if (t.lengthSq() < 1e-8) { at(Math.max(u - 0.02, 0), c2, f2); t.subVectors(c, c2); }
    t.normalize();
    perp.crossVectors(t, f);
    if (perp.lengthSq() < 1e-6) perp.set(-t.z, 0, t.x);
    perp.normalize();
    // A vertical wall: keep the pink edge on top.
    if (Math.abs(perp.y) > 0.7 && perp.y < 0) perp.negate();
    const taper = wedge ? Math.pow(Math.max(1 - u, 0.02), 0.6) * Math.min(1, 0.55 + u * 8) : Math.pow(Math.max(Math.sin(Math.PI * u), 0), 0.55);
    const wv = 0.78 + 0.4 * Math.sin(u * 7 + seed) + 0.2 * (hsh(i * 1.7 + seed) - 0.5);
    const hw = width * 0.5 * taper * wv;
    const h1 = hsh(i * 3.1 + seed * 1.3), h2 = hsh(i * 5.3 + seed * 2.1 + 7), h3 = hsh(i * 7.7 + seed + 3), h4 = hsh(i * 2.9 + seed * 3.7 + 11);
    const L = -hw * (0.7 + 0.6 * h1), R = hw * (0.7 + 0.6 * h2);
    const spike = i % 2 ? 1.3 : 0.82;
    const edgeK = 0.35 + 0.65 * taper;
    const cyanOut = L - cw * edgeK * (0.75 + 0.5 * h3) * (i % 3 === 0 ? 1.35 : 0.85);
    const pinkOut = R + pw * edgeK * (0.75 + 0.5 * h4) * spike;
    const w = (hsh(i * 4.4 + seed) - 0.5) * Math.min(0.2, width * 0.25 + 0.05) * taper;
    for (const [o, v] of [[cyanOut, 0], [L, 1], [R, 2], [pinkOut, 3]] as const) {
      pos.push(c.x, c.y, c.z);
      perpA.push(perp.x, perp.y, perp.z);
      off.push(o);
      aU.push(u);
      aV.push(v);
      wob.push(w);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    const a = i * 4, b = (i + 1) * 4;
    for (let k = 0; k < 3; k++) idx.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aPerp', new THREE.Float32BufferAttribute(perpA, 3));
  geo.setAttribute('aOff', new THREE.Float32BufferAttribute(off, 1));
  geo.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1));
  geo.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1));
  geo.setAttribute('aWob', new THREE.Float32BufferAttribute(wob, 1));
  geo.setIndex(idx);
  return geo;
}

interface RiftSlot {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  live: boolean;
  age: number;
  openDur: number;
  sweepDur: number;
  closeAt: number;
  closeDur: number;
  flare0: number;
  flareDur: number;
  flareAge: number;
  tautAge: number;
  wide: number;
}

export interface RiftOptions {
  /** Seconds the slit is revealed along its length, from the first point to the last (default: all at once). */
  sweep?: number;
  /** Seconds to wait before it starts to open. */
  delay?: number;
  /** Widest at the first point, tapering to a point at the last (a tendril). */
  wedge?: boolean;
  /** Jag seed (default random). */
  seed?: number;
}

/**
 * Pooled jagged tears. Each slot is a ribbon with four bands across: a thin cyan fringe on one side, the pure black cut
 * (unlit, `depthWrite` on), a hot rift-pink band on the other side. The outline is jagged and the width varies along the
 * slit. A slot opens (the width eases out), can be revealed along its length (`sweep`), flares (cyan and hot flash),
 * snaps taut and zips shut from both ends. `open*` returns the slot index. `place(i, pos)` moves a slot's mesh (paths
 * built around the origin can then orbit). `frozen` holds time; `flicker` makes the cyan fringe flicker. `update(dt)` each
 * frame. Add `mesh`.
 */
export class Rift {
  readonly mesh = new THREE.Group();
  frozen = false;
  flicker = false;
  private slots: RiftSlot[] = [];
  private cursor = 0;
  private time = 0;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor(max = 6, overlay = false) {
    const vertex = /* glsl */ `
      attribute vec3 aPerp; attribute float aOff; attribute float aU; attribute float aV; attribute float aWob;
      uniform float uOpen, uZip, uSweep, uWide, uTaut;
      varying float vV;
      void main() {
        float k = uOpen * uWide;
        float edge = min(aU, 1.0 - aU);
        float ze = uZip * 0.5;
        k *= mix(1.0, smoothstep(ze, ze + 0.14, edge), step(0.0001, uZip));
        k *= 1.0 - smoothstep(uSweep - 0.12, uSweep, aU);
        vec3 p = position + aPerp * (aOff * k + aWob * k * (1.0 - uTaut));
        vV = aV;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`;
    const fragment = /* glsl */ `
      uniform vec3 uCyan, uPink, uHot; uniform float uFlare, uTime, uFlicker;
      varying float vV;
      void main() {
        float fl = clamp(uFlare + uFlicker * step(0.5, fract(uTime * 17.0)), 0.0, 1.0);
        vec3 col;
        if (vV < 1.0) {
          col = uCyan * (0.58 + 0.42 * fl);
          col = mix(col, vec3(1.0), 0.35 * fl * smoothstep(0.0, 0.5, vV));
        } else if (vV < 2.0) {
          col = vec3(0.0);
        } else {
          float t = vV - 2.0;
          col = mix(uPink, uHot, smoothstep(0.6, 1.0, t));
          col = mix(col, uHot, 0.7 * fl);
        }
        gl_FragColor = vec4(col, 1.0);
      }`;
    for (let i = 0; i < max; i++) {
      const mat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide, depthWrite: true, transparent: overlay, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        uniforms: {
          uOpen: { value: 0 }, uZip: { value: 0 }, uSweep: { value: 1.2 }, uWide: { value: 1 }, uTaut: { value: 0 },
          uFlare: { value: 0 }, uTime: { value: 0 }, uFlicker: { value: 0 },
          uCyan: { value: new THREE.Color(VOID.accent) }, uPink: { value: new THREE.Color(VOID.body) }, uHot: { value: new THREE.Color(VOID.hot) },
        },
        vertexShader: vertex, fragmentShader: fragment,
      });
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = overlay ? 21 : 4;
      this.mesh.add(mesh);
      this.slots.push({ mesh, mat, live: false, age: 0, openDur: 0.3, sweepDur: 0, closeAt: -1, closeDur: 0.3, flare0: 0, flareDur: 0.2, flareAge: 9, tautAge: -1, wide: 1 });
    }
  }

  /** A slit lying on the ground, `length` long, centred on `center`, along `dir` (horizontal). */
  open(center: THREE.Vector3, dir: THREE.Vector3, length: number, width: number, seconds: number, opts: RiftOptions = {}) {
    const d = this.a.set(dir.x, 0, dir.z);
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    d.normalize();
    const n = 5;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5;
      pts.push(new THREE.Vector3(center.x + d.x * length * u - d.z * Math.sin(u * 5) * length * 0.04, 0.03, center.z + d.z * length * u + d.x * Math.sin(u * 5) * length * 0.04));
    }
    return this.openPath(pts, UP, width, seconds, opts);
  }

  /** A vertical slit from `base` up `height`, its flat side facing `facing` (usually toward the camera). */
  openStanding(base: THREE.Vector3, height: number, facing: THREE.Vector3, width: number, seconds: number, opts: RiftOptions = {}) {
    const pts: THREE.Vector3[] = [];
    const f = this.b.set(facing.x, 0, facing.z);
    if (f.lengthSq() < 1e-6) f.set(0, 0, 1);
    f.normalize();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const lean = Math.sin(u * 4 + (opts.seed ?? 0)) * 0.06 * height;
      pts.push(new THREE.Vector3(base.x - f.z * lean, base.y + height * u, base.z + f.x * lean));
    }
    return this.openPath(pts, f, width, seconds, opts);
  }

  /** A slit along any polyline. `facing` is the surface normal (one vector, or one per point). Returns the slot index. */
  openPath(points: THREE.Vector3[], facing: THREE.Vector3 | THREE.Vector3[], width: number, seconds: number, opts: RiftOptions = {}) {
    let slot = -1;
    for (let k = 0; k < this.slots.length; k++) {
      const j = (this.cursor + k) % this.slots.length;
      if (!this.slots[j].live) { slot = j; break; }
    }
    if (slot < 0) slot = this.cursor;
    this.cursor = (slot + 1) % this.slots.length;
    const s = this.slots[slot];
    const faces = Array.isArray(facing) ? facing : [facing];
    s.mesh.geometry.dispose();
    s.mesh.geometry = riftGeometry(points, faces, Math.max(width, 0.05), opts.seed ?? Math.random() * 40, opts.wedge ?? false);
    s.mesh.position.set(0, 0, 0);
    s.mesh.visible = true;
    s.live = true;
    s.age = -(opts.delay ?? 0);
    s.openDur = Math.max(seconds, 0.05);
    s.sweepDur = opts.sweep ?? 0;
    s.closeAt = -1;
    s.flare0 = 0;
    s.flareAge = 9;
    s.tautAge = -1;
    s.wide = 1;
    s.mat.uniforms.uOpen.value = 0;
    s.mat.uniforms.uZip.value = 0;
    s.mat.uniforms.uTaut.value = 0;
    s.mat.uniforms.uWide.value = 1;
    s.mat.uniforms.uSweep.value = s.sweepDur > 0 ? 0 : 1.2;
    return slot;
  }

  /** Moves one slot's mesh to `pos` (paths built around the origin can then orbit). */
  place(index: number, pos: THREE.Vector3) {
    this.slots[index]?.mesh.position.copy(pos);
  }

  /** Multiplies the opening of one slot (the vast ultimate rift widens). */
  setWide(index: number, k: number) {
    const s = this.slots[index];
    if (s) s.wide = k;
  }

  /** Zips slot `index` (or every slot with -1) shut from both ends over `seconds`, after `delay`. */
  close(seconds: number, index = -1, delay = 0) {
    this.slots.forEach((s, i) => {
      if (!s.live || (index >= 0 && i !== index)) return;
      s.closeAt = s.age + delay;
      s.closeDur = Math.max(seconds, 0.05);
    });
  }

  /** A cyan and hot flash on one slot (or all with -1) that decays over `seconds`. */
  flare(amount = 1, seconds = 0.2, index = -1) {
    this.slots.forEach((s, i) => {
      if (!s.live || (index >= 0 && i !== index)) return;
      s.flare0 = amount;
      s.flareDur = Math.max(seconds, 0.03);
      s.flareAge = 0;
    });
  }

  /** The wobble of a slit straightens out over 0.12 s (the tendrils snap taut). */
  snap(index = -1) {
    this.slots.forEach((s, i) => {
      if (!s.live || (index >= 0 && i !== index)) return;
      s.tautAge = 0;
    });
  }

  get busy() {
    return this.slots.some((s) => s.live);
  }

  reset() {
    for (const s of this.slots) {
      s.live = false;
      s.mesh.visible = false;
      s.mesh.position.set(0, 0, 0);
    }
    this.frozen = false;
    this.flicker = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    this.time += d;
    for (const s of this.slots) {
      if (!s.live) continue;
      s.age += d;
      const u = s.mat.uniforms;
      u.uTime.value = this.time;
      u.uFlicker.value = this.flicker ? 1 : 0;
      if (s.age < 0) { s.mesh.visible = false; continue; }
      s.mesh.visible = true;
      const p = clamp01(s.age / s.openDur);
      u.uOpen.value = Math.max(easeOut(p) * (1 + 0.1 * Math.sin(p * Math.PI)), MIN_SCALE);
      u.uWide.value = s.wide;
      if (s.sweepDur > 0) u.uSweep.value = 1.2 * clamp01(s.age / s.sweepDur);
      if (s.closeAt >= 0) {
        const z = clamp01((s.age - s.closeAt) / s.closeDur);
        u.uZip.value = easeIn(z);
        if (z >= 1) { s.live = false; s.mesh.visible = false; continue; }
      }
      if (s.flareAge < s.flareDur) {
        s.flareAge += d;
        u.uFlare.value = s.flare0 * clamp01(1 - s.flareAge / s.flareDur);
      } else u.uFlare.value = 0;
      if (s.tautAge >= 0) {
        s.tautAge += d;
        u.uTaut.value = clamp01(s.tautAge / 0.12);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Shards
// ---------------------------------------------------------------------------------------------------------------

/**
 * One flake of the world: an irregular flat polygon (unit radius in XY). A pale ash rim polygon behind, two dark
 * grey faces in front (one slightly lighter, a cheap toon facet).
 */
function shardGeometry() {
  const n = 6;
  const ring: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (hsh(i * 3.3) - 0.5) * 0.5;
    const r = 0.55 + 0.45 * hsh(i * 1.9 + 4);
    ring.push([Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.8]);
  }
  const pos: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  const tri = (a: [number, number], b: [number, number], cc: [number, number], z: number, hex: number) => {
    c.setHex(hex);
    for (const p of [a, b, cc]) { pos.push(p[0], p[1], z); col.push(c.r, c.g, c.b); }
  };
  const o: [number, number] = [0.05, -0.03];
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    tri(o, a, b, -0.02, VOID.ash);
    const sa: [number, number] = [a[0] * 0.74, a[1] * 0.74], sb: [number, number] = [b[0] * 0.74, b[1] * 0.74];
    tri([o[0] * 0.74, o[1] * 0.74], sa, sb, 0.02, i % 2 ? 0x3a3840 : 0x2a2830);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

interface Shard {
  live: boolean;
  mode: 0 | 1;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  q: THREE.Quaternion;
  axis: THREE.Vector3;
  spin: number;
}

/**
 * Pooled flat flakes of the world (dark grey faces, a pale ash rim, tumbling). `drift(from, to, count, seconds, spread,
 * size)` streams them from round `from` into `to` where they shrink away; `burst(pos, count, speed, size)` throws them
 * out, they fall and shrink (about 1 s). Keep to 12 or fewer per spell. `frozen` holds time. `update(dt)` each frame. Add
 * `mesh`.
 */
export class Shards {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private shards: Shard[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private dq = new THREE.Quaternion();

  constructor(max = 14) {
    this.mesh = new THREE.InstancedMesh(shardGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 5;
    for (let i = 0; i < max; i++) {
      this.shards.push({
        live: false, mode: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(),
        age: 0, life: 1, size: 0.3, q: new THREE.Quaternion(), axis: new THREE.Vector3(0, 1, 0), spin: 3,
      });
    }
  }

  private take() {
    const sh = this.shards[this.cursor];
    this.cursor = (this.cursor + 1) % this.shards.length;
    sh.live = true;
    sh.age = 0;
    sh.q.setFromEuler(new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
    sh.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    sh.spin = (2 + Math.random() * 4) * (Math.random() < 0.5 ? -1 : 1);
    return sh;
  }

  drift(from: THREE.Vector3, to: THREE.Vector3, count: number, seconds: number, spread = 0.3, size = 0.3) {
    for (let i = 0; i < count; i++) {
      const sh = this.take();
      const a = Math.random() * Math.PI * 2, r = spread * Math.sqrt(Math.random());
      sh.mode = 0;
      sh.from.set(from.x + Math.cos(a) * r, Math.max(from.y, 0.1) + Math.random() * 0.3, from.z + Math.sin(a) * r);
      sh.to.copy(to);
      sh.pos.copy(sh.from);
      sh.life = Math.max(seconds, 0.1) * (0.8 + Math.random() * 0.3);
      sh.size = size * (0.6 + Math.random() * 0.6);
    }
  }

  burst(pos: THREE.Vector3, count: number, speed = 4, size = 0.25) {
    for (let i = 0; i < count; i++) {
      const sh = this.take();
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.7);
      sh.mode = 1;
      sh.pos.set(pos.x, Math.max(pos.y, 0.15), pos.z);
      sh.vel.set(Math.cos(a) * sp, speed * (0.3 + Math.random() * 0.5), Math.sin(a) * sp);
      sh.life = 0.9 + Math.random() * 0.4;
      sh.size = size * (0.6 + Math.random() * 0.7);
    }
  }

  get busy() {
    return this.shards.some((s) => s.live);
  }

  reset() {
    for (const s of this.shards) s.live = false;
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
      const u = sh.age / sh.life;
      let k = 1;
      if (sh.mode === 0) {
        const e = easeIn(u * 0.85 + 0.15 * u * u) ;
        sh.pos.lerpVectors(sh.from, sh.to, e);
        sh.pos.y += Math.sin(Math.PI * u) * 0.45;
        k = 1 - sstep(0.7, 1, u);
      } else {
        sh.vel.y -= 14 * d;
        sh.vel.x *= Math.exp(-0.8 * d);
        sh.vel.z *= Math.exp(-0.8 * d);
        sh.pos.addScaledVector(sh.vel, d);
        if (sh.pos.y < 0.06) { sh.pos.y = 0.06; sh.vel.y = Math.abs(sh.vel.y) * 0.25; sh.vel.x *= 0.7; sh.vel.z *= 0.7; }
        k = 1 - sstep(0.55, 1, u);
      }
      this.dq.setFromAxisAngle(sh.axis, sh.spin * d);
      sh.q.premultiply(this.dq);
      const sz = Math.max(sh.size * k, MIN_SCALE);
      this.m.compose(this.p.copy(sh.pos), sh.q, this.s.setScalar(sz));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Crackle
// ---------------------------------------------------------------------------------------------------------------

/** Seeded random in [0, 1). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The crack network at unit radius: about 11 radial cracks with wobble and one or two branches each, two broken rings of
 * web between them, and a full outline ring (kind 1). Each polyline becomes a ribbon of two vertices per point.
 */
function crackGeometry() {
  const r = rng(7);
  const pos: number[] = [], perpA: number[] = [], aV: number[] = [], aT: number[] = [], aR: number[] = [], aA: number[] = [], aK: number[] = [];
  const idx: number[] = [];
  let base = 0;
  const ribbon = (pts: [number, number][], taper0: number, taper1: number, kind: number) => {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1];
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      const u = i / (n - 1);
      for (const v of [-1, 1]) {
        pos.push(p[0], 0.025, p[1]);
        perpA.push(-tz, 0, tx);
        aV.push(v);
        aT.push(taper0 + (taper1 - taper0) * u);
        aR.push(Math.hypot(p[0], p[1]));
        aA.push(kind === 1 ? u : -1);
        aK.push(kind);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2, b = a + 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    base += n * 2;
  };
  const N = 11;
  const ang: number[] = [];
  for (let i = 0; i < N; i++) ang.push((i + (r() - 0.5) * 0.6) * (Math.PI * 2 / N));
  for (let i = 0; i < N; i++) {
    const R = 0.8 + r() * 0.2;
    const steps = 9;
    let a = ang[i];
    const pts: [number, number][] = [];
    for (let k = 0; k <= steps; k++) {
      const rr = (k / steps) * R;
      a += (r() - 0.5) * 0.09;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    ribbon(pts, 0, 1, 0);
    const nb = 1 + (r() < 0.6 ? 1 : 0);
    for (let q = 0; q < nb; q++) {
      const j = 2 + Math.floor(r() * 4);
      const side = r() < 0.5 ? -1 : 1;
      let ba = Math.atan2(pts[j][1], pts[j][0]) + side * (0.5 + r() * 0.4);
      const len = 0.18 + r() * 0.17;
      const bp: [number, number][] = [];
      for (let k = 0; k <= 4; k++) {
        ba += (r() - 0.5) * 0.18;
        bp.push([pts[j][0] + Math.cos(ba) * len * (k / 4), pts[j][1] + Math.sin(ba) * len * (k / 4)]);
      }
      ribbon(bp, 0.4, 1, 0);
    }
  }
  for (const ringR of [0.36, 0.66]) {
    for (let i = 0; i < N; i++) {
      if (r() < 0.4) continue;
      const a0 = ang[i], a1 = ang[(i + 1) % N] + (i === N - 1 ? Math.PI * 2 : 0);
      const pts: [number, number][] = [];
      for (let k = 0; k <= 4; k++) {
        const a = a0 + (a1 - a0) * (k / 4), rr = ringR * (1 + (r() - 0.5) * 0.12);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      ribbon(pts, 0.5, 0.5, 0);
    }
  }
  const rim: [number, number][] = [];
  const M = 72;
  for (let k = 0; k <= M; k++) {
    const a = (k / M) * Math.PI * 2, rr = k === M ? Math.hypot(rim[0][0], rim[0][1]) : 0.985 + (r() - 0.5) * 0.03;
    rim.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  ribbon(rim, 0.25, 0.25, 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aPerp', new THREE.Float32BufferAttribute(perpA, 3));
  geo.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  geo.setAttribute('aR', new THREE.Float32BufferAttribute(aR, 1));
  geo.setAttribute('aA', new THREE.Float32BufferAttribute(aA, 1));
  geo.setAttribute('aK', new THREE.Float32BufferAttribute(aK, 1));
  geo.setIndex(idx);
  return geo;
}

/**
 * A ground decal of glass-like cracks that radiate from a point (the cracks are black with pink edges, 0.3 to 0.55 wide, a
 * little thinner toward the tips). `grow(center, radius, seconds)` runs the cracks out from the centre, `ring(center,
 * radius, seconds)` traces the outline circle round the radius, `fade(seconds)` heals them (outer cracks first),
 * `invert(true)` fills the whole disc black under the cracks (the floor plates go black with pink edges), `invert(false)`
 * removes it. `width` is the crack width at the base in metres. `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class Crackle {
  readonly mesh = new THREE.Group();
  frozen = false;
  width = 0.5;
  private cracks: THREE.Mesh;
  private disc: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private growAge = -1;
  private growDur = 1;
  private ringAge = -1;
  private ringDur = 1;
  private fadeAge = -1;
  private fadeDur = 1;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: {
        uRadius: { value: 1 }, uWidth: { value: 0.5 }, uGrow: { value: 0 }, uFade: { value: 0 }, uRing: { value: 0 },
        uPink: { value: new THREE.Color(VOID.body) }, uHot: { value: new THREE.Color(VOID.hot) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aPerp; attribute float aV; attribute float aT; attribute float aR; attribute float aA; attribute float aK;
        uniform float uRadius, uWidth, uGrow, uFade, uRing;
        varying float vV;
        void main() {
          float k = aK > 0.5 ? 1.0 - smoothstep(uRing - 0.05, uRing, aA) : 1.0 - smoothstep(uGrow - 0.14, uGrow, aR);
          float kf = 1.0 - smoothstep(0.0, 1.0, uFade * 1.5 - (1.0 - aR) * 0.5);
          float w = uWidth * mix(1.0, 0.55, aT) * mix(0.55, 1.0, smoothstep(0.0, 0.3, aR)) * k * kf;
          vec3 p = position * vec3(uRadius, 1.0, uRadius) + aPerp * aV * 0.5 * w;
          vV = aV;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uPink, uHot; varying float vV;
        void main() {
          float a = abs(vV);
          vec3 col = vec3(0.0);
          if (a > 0.4) col = mix(uPink, uHot, smoothstep(0.82, 1.0, a));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.cracks = new THREE.Mesh(crackGeometry(), this.mat);
    this.cracks.frustumCulled = false;
    this.cracks.renderOrder = 20;
    // The black disc for the inverted frames, with a jagged rim.
    const dg = new THREE.CircleGeometry(1, 48);
    dg.rotateX(-Math.PI / 2);
    const dp = dg.attributes.position as THREE.BufferAttribute;
    for (let i = 1; i < dp.count; i++) {
      const k = 1 + (hsh(i * 2.3) - 0.5) * 0.1;
      dp.setX(i, dp.getX(i) * k);
      dp.setZ(i, dp.getZ(i) * k);
    }
    this.disc = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: VOID.dark, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    this.disc.position.y = 0.02;
    this.disc.renderOrder = 19;
    this.disc.visible = false;
    this.cracks.visible = false;
    this.mesh.add(this.disc, this.cracks);
  }

  private place(center: THREE.Vector3, radius: number) {
    this.mesh.position.set(center.x, 0, center.z);
    this.mat.uniforms.uRadius.value = radius;
    this.disc.scale.set(radius, 1, radius);
    this.cracks.visible = true;
  }

  /** The cracks run out from the centre to `radius` over `seconds`. */
  grow(center: THREE.Vector3, radius: number, seconds = 0.5) {
    this.place(center, radius);
    this.growAge = 0;
    this.growDur = Math.max(seconds, 0.05);
    this.fadeAge = -1;
    this.mat.uniforms.uFade.value = 0;
  }

  /** A crack line traces the circle of `radius` round `center` over `seconds`. */
  ring(center: THREE.Vector3, radius: number, seconds = 0.4) {
    this.place(center, radius);
    this.ringAge = 0;
    this.ringDur = Math.max(seconds, 0.05);
    this.fadeAge = -1;
    this.mat.uniforms.uFade.value = 0;
  }

  /** The cracks heal over `seconds` (outer ones first). */
  fade(seconds = 0.8) {
    this.fadeAge = 0;
    this.fadeDur = Math.max(seconds, 0.05);
  }

  invert(on: boolean) {
    this.disc.visible = on;
  }

  get active() {
    return this.cracks.visible;
  }

  reset() {
    this.growAge = this.ringAge = this.fadeAge = -1;
    this.frozen = false;
    this.cracks.visible = false;
    this.disc.visible = false;
    const u = this.mat.uniforms;
    u.uGrow.value = 0;
    u.uRing.value = 0;
    u.uFade.value = 0;
  }

  update(dt: number) {
    if (!this.cracks.visible) return;
    const d = this.frozen ? 0 : dt;
    const u = this.mat.uniforms;
    u.uWidth.value = this.width;
    if (this.growAge >= 0) {
      this.growAge += d;
      u.uGrow.value = easeOut(this.growAge / this.growDur) * 1.15;
    } else u.uGrow.value = 0;
    if (this.ringAge >= 0) {
      this.ringAge += d;
      u.uRing.value = clamp01(this.ringAge / this.ringDur) * 1.1;
    } else u.uRing.value = 0;
    if (this.fadeAge >= 0) {
      this.fadeAge += d;
      u.uFade.value = clamp01(this.fadeAge / this.fadeDur);
      if (this.fadeAge >= this.fadeDur) this.reset();
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// AshMotes
// ---------------------------------------------------------------------------------------------------------------

interface Mote { live: boolean; pos: THREE.Vector3; vy: number; ph: number; age: number; life: number; size: number; tone: number }

/**
 * Small pale motes (flat ash diamonds, a few pink) that rise slowly, sway a little and shrink out in about 1.5 to 2.2 s.
 * `emit(center, radius, count)` spawns them on the ground disc round `center`. At most 48 at once. `frozen` holds
 * time. `update(dt)` each frame. Add `mesh`.
 */
export class AshMotes {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private motes: Mote[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private tones = [new THREE.Color(VOID.ash), new THREE.Color(VOID.ash), new THREE.Color(VOID.hot), new THREE.Color(VOID.body)];

  constructor(max = 48) {
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 7;
    for (let i = 0; i < max; i++) this.motes.push({ live: false, pos: new THREE.Vector3(), vy: 1, ph: 0, age: 0, life: 1.5, size: 0.08, tone: 0 });
  }

  emit(center: THREE.Vector3, radius: number, count: number) {
    for (let i = 0; i < count; i++) {
      const mo = this.motes[this.cursor];
      this.cursor = (this.cursor + 1) % this.motes.length;
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      mo.live = true;
      mo.pos.set(center.x + Math.cos(a) * r, Math.max(center.y, 0.05) + Math.random() * 0.4, center.z + Math.sin(a) * r);
      mo.vy = 0.5 + Math.random() * 0.8;
      mo.ph = Math.random() * 6.28;
      mo.age = 0;
      mo.life = 1.5 + Math.random() * 0.7;
      mo.size = 0.06 + Math.random() * 0.07;
      mo.tone = Math.floor(Math.random() * 4);
    }
  }

  get busy() {
    return this.motes.some((m) => m.live);
  }

  reset() {
    for (const m of this.motes) m.live = false;
    this.frozen = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    let n = 0;
    for (const mo of this.motes) {
      if (!mo.live) continue;
      mo.age += d;
      if (mo.age >= mo.life) { mo.live = false; continue; }
      mo.pos.y += mo.vy * d;
      const u = mo.age / mo.life;
      const sway = Math.sin(mo.age * 2.5 + mo.ph) * 0.25 * d;
      mo.pos.x += sway;
      const k = Math.min(sstep(0, 0.12, u), 1 - sstep(0.6, 1, u));
      const sz = Math.max(mo.size * k, MIN_SCALE);
      this.q.setFromAxisAngle(UP, mo.ph + mo.age);
      this.m.compose(mo.pos, this.q, this.s.set(sz, sz * 1.7, sz * 0.5));
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.tones[mo.tone]);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
