import * as THREE from 'three';

/**
 * The prism kit (pipeline/designs/kit-prism.md): light caught in faceted clear crystals and split into a spectrum.
 * `Crystal` = pooled double-terminated hexagonal shards (lavender glass, flat-shaded bands, a lighter top face, a dark
 * outline hull); `SpectrumBeam` = camera-facing ribbons with a white core and thin parallel red / gold / green / blue
 * bands (or one tint) that can fan out of a prism; `Glitter` = few small flat diamond facets that flash once;
 * `PrismRing` = a ring of small prisms orbiting a centre. Everything is pooled, takes world-space positions, has
 * `reset()`, and stays below the bloom threshold (gain < 1).
 */

/** Palette. Numbers for `THREE.Color`, `PRISM_CSS` for APIs that want a string. `foil` (clear glass) is the pale foil. */
export const PRISM = {
  core: 0xffffff,
  hot: 0xf2eeff,
  body: 0xb8b0ff,
  red: 0xff5a6a,
  gold: 0xffd24a,
  green: 0x5aff9a,
  blue: 0x5ab8ff,
  dark: 0x14102a,
  foil: 0xf0f4ff,
} as const;

export const PRISM_CSS = {
  core: '#ffffff',
  hot: '#f2eeff',
  body: '#b8b0ff',
  red: '#ff5a6a',
  gold: '#ffd24a',
  green: '#5aff9a',
  blue: '#5ab8ff',
  dark: '#14102a',
  foil: '#f0f4ff',
} as const;

/** The four spectrum colours, in the order they appear across a beam. */
export const SPECTRUM = [PRISM.red, PRISM.gold, PRISM.green, PRISM.blue] as const;

const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
const hash = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------------------------------------------------------
// Crystal
// ---------------------------------------------------------------------------------------------------------------

let crystalGeo: THREE.BufferGeometry | undefined;
let crystalMat: THREE.ShaderMaterial | undefined;
let edgeMat: THREE.MeshBasicMaterial | undefined;

/** A hexagonal crystal along local Y: tips at y = +-1, the six-sided waist at y = +-0.55, radius 1. Flat-shaded. */
function crystalGeometry() {
  if (crystalGeo) return crystalGeo;
  const pos: number[] = [];
  const ring = (i: number, y: number) => {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    return [Math.cos(a), y, Math.sin(a)] as const;
  };
  const tri = (a: readonly number[], b: readonly number[], c: readonly number[]) => pos.push(...a, ...b, ...c);
  const top = [0, 1, 0] as const, bot = [0, -1, 0] as const;
  for (let i = 0; i < 6; i++) {
    const a0 = ring(i, 0.55), a1 = ring(i + 1, 0.55), b0 = ring(i, -0.55), b1 = ring(i + 1, -0.55);
    tri(top, a1, a0);
    tri(a0, a1, b0);
    tri(a1, b1, b0);
    tri(bot, b0, b1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals(); // non-indexed: every face keeps its own flat normal
  crystalGeo = geo;
  return geo;
}

function crystalMaterial() {
  crystalMat ??= new THREE.ShaderMaterial({
    uniforms: {
      uHot: { value: new THREE.Color(0xe4e0ff) }, uLit: { value: new THREE.Color(0xb8b0ff) },
      uMid: { value: new THREE.Color(0x978ce6) }, uShade: { value: new THREE.Color(0x7a70c8) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      void main() {
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHot, uLit, uMid, uShade; varying vec3 vN;
      void main() {
        float nl = dot(normalize(vN), normalize(vec3(-0.35, 0.8, 0.5)));
        vec3 c = nl > 0.8 ? uHot : (nl > 0.3 ? uLit : (nl > -0.25 ? uMid : uShade));
        gl_FragColor = vec4(c * 0.85, 1.0);
      }`,
  });
  return crystalMat;
}

type CrystalMode = 'idle' | 'loose';

interface CrystalItem {
  live: boolean;
  mode: CrystalMode;
  body: THREE.Mesh;
  edge: THREE.Mesh;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
  width: number;
  flat: number;
  roll: number;
  rate: number;
  scale: number;
  vel: THREE.Vector3;
  axis: THREE.Vector3;
  tumble: number;
  age: number;
  life: number;
  quat: THREE.Quaternion;
}

export interface CrystalOptions {
  /** Thickness ratio of the short side (1 = hexagonal, 0.2 = a flat mirror pane). */
  flat?: number;
  /** Starting roll about its long axis (radians). */
  roll?: number;
  /** Spin about its long axis (rad/s); default `Crystal.spin`. */
  spin?: number;
  /** Size multiplier (grow it from 0 for a forming crystal). */
  scale?: number;
}

/**
 * Pooled faceted crystal shards: lavender glass with a lighter top face and a dark `#14102a` outline hull, flat-shaded,
 * never smooth. `place(pos, dir, length, width, opts)` puts one (`dir` is its long axis, `length` tip to tip, `width` the
 * diameter) and returns its index; `move`, `setSize`, `setScale`, `setRoll`, `setSpin`, `hide` drive it. `spin` is the
 * default turning speed about the axis. `shatter(speed, life, origin)` turns every live crystal into loose shards that
 * fly out, tumble, bounce and shrink away. `frozen` holds time. `update(dt)` each frame. Add `mesh`.
 */
export class Crystal {
  readonly mesh = new THREE.Group();
  frozen = false;
  spin = 1.2;
  gravity = 12;
  private items: CrystalItem[] = [];
  private cursor = 0;
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private v = new THREE.Vector3();

  constructor(max = 12) {
    const geo = crystalGeometry();
    edgeMat ??= new THREE.MeshBasicMaterial({ color: PRISM.dark, side: THREE.BackSide });
    for (let i = 0; i < max; i++) {
      const body = new THREE.Mesh(geo, crystalMaterial());
      const edge = new THREE.Mesh(geo, edgeMat);
      for (const m of [body, edge]) { m.visible = false; m.frustumCulled = false; this.mesh.add(m); }
      this.items.push({
        live: false, mode: 'idle', body, edge, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0), length: 1, width: 0.4, flat: 1,
        roll: 0, rate: 0, scale: 1, vel: new THREE.Vector3(), axis: new THREE.Vector3(0, 1, 0), tumble: 0, age: 0, life: 1, quat: new THREE.Quaternion(),
      });
    }
  }

  get busy() {
    return this.items.some((c) => c.live);
  }

  place(pos: THREE.Vector3, dir: THREE.Vector3, length: number, width: number, o: CrystalOptions = {}) {
    let idx = this.items.findIndex((c) => !c.live);
    if (idx < 0) { idx = this.cursor; this.cursor = (this.cursor + 1) % this.items.length; }
    const c = this.items[idx];
    c.live = true;
    c.mode = 'idle';
    c.pos.copy(pos);
    c.dir.copy(dir.lengthSq() > 1e-8 ? dir : UP).normalize();
    c.length = length;
    c.width = width;
    c.flat = o.flat ?? 1;
    c.roll = o.roll ?? Math.random() * 6.28;
    c.rate = o.spin ?? this.spin;
    c.scale = o.scale ?? 1;
    this.apply(c);
    return idx;
  }

  move(i: number, pos: THREE.Vector3, dir?: THREE.Vector3) {
    const c = this.items[i];
    c.pos.copy(pos);
    if (dir && dir.lengthSq() > 1e-8) c.dir.copy(dir).normalize();
  }

  setSize(i: number, length: number, width: number) {
    const c = this.items[i];
    c.length = length;
    c.width = width;
  }

  setScale(i: number, s: number) {
    this.items[i].scale = s;
  }

  setRoll(i: number, roll: number) {
    this.items[i].roll = roll;
  }

  setSpin(i: number, rate: number) {
    this.items[i].rate = rate;
  }

  hide(i: number) {
    const c = this.items[i];
    c.live = false;
    c.body.visible = c.edge.visible = false;
  }

  /** Every idle crystal becomes loose shards: flung away from `origin` (default the middle of them), tumbling, shrinking away over `life`. */
  shatter(speed = 5, life = 0.8, origin?: THREE.Vector3) {
    const act = this.items.filter((c) => c.live && c.mode === 'idle');
    if (!act.length) return;
    const o = origin ?? this.v.set(0, 0, 0);
    if (!origin) { for (const c of act) o.add(c.pos); o.multiplyScalar(1 / act.length); }
    for (const c of act) {
      this.orient(c);
      c.mode = 'loose';
      c.age = 0;
      c.life = life * (0.8 + Math.random() * 0.4);
      const dx = c.pos.x - o.x, dz = c.pos.z - o.z, l = Math.hypot(dx, dz);
      const a = l > 0.05 ? Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.7 : Math.random() * 6.28;
      const sp = speed * (0.6 + Math.random() * 0.7);
      c.vel.set(Math.cos(a) * sp, speed * (0.4 + Math.random() * 0.6), Math.sin(a) * sp);
      c.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      c.tumble = (7 + Math.random() * 7) * (Math.random() < 0.5 ? -1 : 1);
    }
  }

  reset() {
    for (const c of this.items) { c.live = false; c.body.visible = c.edge.visible = false; }
    this.frozen = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    for (const c of this.items) {
      if (!c.live) continue;
      if (c.mode === 'loose') {
        c.age += d;
        if (c.age >= c.life) { c.live = false; c.body.visible = c.edge.visible = false; continue; }
        c.vel.y -= this.gravity * d;
        c.pos.addScaledVector(c.vel, d);
        const floor = c.width * 0.4;
        if (c.pos.y < floor) {
          c.pos.y = floor;
          if (c.vel.y < 0) c.vel.y = -c.vel.y * 0.3;
          c.vel.x *= 0.7;
          c.vel.z *= 0.7;
        }
        this.qb.setFromAxisAngle(c.axis, c.tumble * d);
        c.quat.premultiply(this.qb);
        const u = c.age / c.life;
        this.place3(c, u < 0.6 ? 1 : 1 - Math.pow((u - 0.6) / 0.4, 2));
      } else {
        c.roll += c.rate * d;
        this.apply(c);
      }
    }
  }

  private orient(c: CrystalItem) {
    this.qa.setFromUnitVectors(UP, c.dir);
    this.qb.setFromAxisAngle(UP, c.roll);
    c.quat.copy(this.qa).multiply(this.qb);
  }

  private apply(c: CrystalItem) {
    this.orient(c);
    this.place3(c, 1);
  }

  private place3(c: CrystalItem, k: number) {
    const s = Math.max(c.scale * k, MIN_SCALE);
    const sy = Math.max(c.length * 0.5 * s, MIN_SCALE), sx = Math.max(c.width * 0.5 * s, MIN_SCALE), sz = Math.max(sx * c.flat, MIN_SCALE);
    c.body.position.copy(c.pos);
    c.body.quaternion.copy(c.quat);
    c.body.scale.set(sx, sy, sz);
    c.body.visible = true;
    // The dark outline hull: a little fatter on the sides, a little longer, behind the faces.
    c.edge.position.copy(c.pos);
    c.edge.quaternion.copy(c.quat);
    c.edge.scale.set(sx * 1.16 + 0.01, sy * 1.06 + 0.01, sz * 1.16 + 0.01);
    c.edge.visible = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SpectrumBeam
// ---------------------------------------------------------------------------------------------------------------

interface BeamSlot { live: boolean; a: THREE.Vector3; b: THREE.Vector3; width: number; opacity: number; tint: number; taper: number }

/**
 * Camera-facing beams with a white core and, either side of it, thin parallel bands of red, gold (one side) and green,
 * blue (the other), a little fainter than the core; or, with a `tint`, one coloured band either side. `set(a, b, width,
 * opacity, tint?, tailTaper?)` draws slot 0 (or `slot`) from A (the tail) to B; `width` is the full width in metres (each
 * band is about a fifth of it, so use >= 0.4 for bands that read). `split(fanDeg, count, length?, width?, opacity?)`
 * fans slots 1..count out from the end of slot 0, continuing its direction, spread sideways over `fanDeg`; `fan(origin,
 * dir, axis, ...)` is the general form (rotate about any axis). `hide(slot)` / `reset()` clear. Add `mesh`.
 */
export class SpectrumBeam {
  readonly mesh: THREE.Mesh;
  frozen = false;
  private slots: BeamSlot[] = [];
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private oth: Float32Array;
  private side: Float32Array;
  private wid: Float32Array;
  private alp: Float32Array;
  private tnt: Float32Array;
  private along: Float32Array;
  private q = new THREE.Quaternion();
  private d = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(max = 8) {
    for (let i = 0; i < max; i++) this.slots.push({ live: false, a: new THREE.Vector3(), b: new THREE.Vector3(), width: 0.5, opacity: 1, tint: -1, taper: 1 });
    const nv = max * 4;
    this.pos = new Float32Array(nv * 3);
    this.oth = new Float32Array(nv * 3);
    this.side = new Float32Array(nv);
    this.wid = new Float32Array(nv);
    this.alp = new Float32Array(nv);
    this.tnt = new Float32Array(nv * 3);
    this.along = new Float32Array(nv);
    const idx: number[] = [];
    for (let n = 0; n < max; n++) { const a = n * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    const dyn = (arr: Float32Array, size: number) => new THREE.BufferAttribute(arr, size).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', dyn(this.pos, 3));
    this.geo.setAttribute('aOther', dyn(this.oth, 3));
    this.geo.setAttribute('aSide', dyn(this.side, 1));
    this.geo.setAttribute('aW', dyn(this.wid, 1));
    this.geo.setAttribute('aA', dyn(this.alp, 1));
    this.geo.setAttribute('aTint', dyn(this.tnt, 3));
    this.geo.setAttribute('aAlong', dyn(this.along, 1));
    this.geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uRed: { value: new THREE.Color(PRISM.red).multiplyScalar(0.92) }, uGold: { value: new THREE.Color(PRISM.gold).multiplyScalar(0.92) },
        uGreen: { value: new THREE.Color(PRISM.green).multiplyScalar(0.92) }, uBlue: { value: new THREE.Color(PRISM.blue).multiplyScalar(0.92) },
        uWhite: { value: new THREE.Color(0xfdfcff).multiplyScalar(0.94) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aOther; attribute float aSide; attribute float aW; attribute float aA; attribute vec3 aTint; attribute float aAlong;
        varying float vS; varying float vA; varying vec3 vT; varying float vL;
        void main() {
          vec4 c = modelViewMatrix * vec4(position, 1.0);
          vec4 n = modelViewMatrix * vec4(aOther, 1.0);
          vec2 d = n.xy - c.xy;
          float l = length(d);
          d = l > 1e-5 ? d / l : vec2(1.0, 0.0);
          c.xy += vec2(-d.y, d.x) * aSide * aW * 0.5;
          vS = aSide; vA = aA; vT = aTint; vL = aAlong;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uRed, uGold, uGreen, uBlue, uWhite; varying float vS; varying float vA; varying vec3 vT; varying float vL;
        void main() {
          float s = vS, a = abs(s);
          vec3 col; float op;
          if (a < 0.3) { col = uWhite; op = 1.0; }
          else {
            op = 0.62;
            if (vT.x >= 0.0) col = a < 0.62 ? mix(vT, uWhite, 0.35) : vT;
            else if (s < 0.0) col = a < 0.62 ? uGold : uRed;
            else col = a < 0.62 ? uGreen : uBlue;
          }
          float fade = smoothstep(0.0, 0.12, vL) * smoothstep(0.0, 0.12, 1.0 - vL);
          gl_FragColor = vec4(col, op * vA * mix(1.0, fade, 0.6));
        }`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
  }

  set(a: THREE.Vector3, b: THREE.Vector3, width = 0.5, opacity = 1, tint?: number, tailTaper = 1, slot = 0) {
    const s = this.slots[slot];
    s.live = opacity > 0.003 && width > 1e-3;
    s.a.copy(a);
    s.b.copy(b);
    s.width = width;
    s.opacity = opacity;
    s.tint = tint ?? -1;
    s.taper = tailTaper;
    this.write();
  }

  /** The general fan: `count` beams from `origin`, spread over `fanDeg` about `axis`, around `dir`, each `length` long. Fills slots 1..count. */
  fan(origin: THREE.Vector3, dir: THREE.Vector3, axis: THREE.Vector3, fanDeg: number, count: number, length: number, width: number, opacity: number, tints?: readonly number[]) {
    for (let i = 0; i < count; i++) {
      const u = count > 1 ? i / (count - 1) - 0.5 : 0;
      this.q.setFromAxisAngle(axis, THREE.MathUtils.degToRad(fanDeg) * u);
      this.d.copy(dir).normalize().applyQuaternion(this.q).multiplyScalar(length);
      const s = this.slots[i + 1];
      if (!s) break;
      s.live = opacity > 0.003;
      s.a.copy(origin);
      s.b.copy(origin).add(this.d);
      s.width = width;
      s.opacity = opacity;
      s.tint = tints ? tints[i % tints.length] : -1;
      s.taper = 0.7;
    }
    this.write();
  }

  /** Fans slots 1..count out of the end of slot 0, continuing its direction, spread sideways over `fanDeg`. */
  split(fanDeg: number, count: number, length?: number, width?: number, opacity?: number, tints?: readonly number[]) {
    const s0 = this.slots[0];
    this.d.subVectors(s0.b, s0.a);
    const l0 = this.d.length();
    if (l0 < 1e-3) return;
    const dir = this.d.clone().multiplyScalar(1 / l0);
    // Sideways = about the vertical for a mostly horizontal beam, otherwise about the horizontal normal.
    const axis = Math.abs(dir.y) < 0.7 ? UP.clone() : new THREE.Vector3(dir.z, 0, -dir.x).normalize();
    this.fan(s0.b, dir, axis, fanDeg, count, length ?? l0, width ?? s0.width * 0.7, opacity ?? s0.opacity, tints);
  }

  hide(slot = 0) {
    this.slots[slot].live = false;
    this.write();
  }

  reset() {
    for (const s of this.slots) s.live = false;
    this.write();
    this.frozen = false;
  }

  private write() {
    let n = 0;
    for (const s of this.slots) {
      if (!s.live) continue;
      this.c.set(s.tint >= 0 ? s.tint : 0xffffff);
      for (let k = 0; k < 4; k++) {
        const v = n * 4 + k, o = v * 3, end = k >> 1, sd = k & 1 ? 1 : -1;
        const p = end ? s.b : s.a, q = end ? s.a : s.b;
        this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z;
        this.oth[o] = q.x; this.oth[o + 1] = q.y; this.oth[o + 2] = q.z;
        this.side[v] = sd;
        this.wid[v] = s.width * (end ? 1 : s.taper);
        this.alp[v] = s.opacity;
        this.tnt[o] = s.tint >= 0 ? this.c.r : -1; this.tnt[o + 1] = this.c.g; this.tnt[o + 2] = this.c.b;
        this.along[v] = end;
      }
      n++;
    }
    this.geo.setDrawRange(0, n * 6);
    for (const nm of ['position', 'aOther', 'aSide', 'aW', 'aA', 'aTint', 'aAlong']) this.geo.attributes[nm].needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Glitter
// ---------------------------------------------------------------------------------------------------------------

interface Fleck { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; angle: number; color: THREE.Color }

/**
 * Small flat diamond facets that flash once and fall: mostly white and lavender, a few spectrum colours, each with a dark
 * edge so it reads on a bright floor. `burst(pos, count, speed)` throws `count` flecks out of a point (keep it to
 * a handful). Camera-facing, ~0.1 to 0.2 across, each living 0.3 to 0.7 s. Pooled (`max`). `update(dt)` each frame. Add `mesh`.
 */
export class Glitter {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private flecks: Fleck[] = [];
  private cursor = 0;
  private aP: THREE.InstancedBufferAttribute;
  private aC: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(private max = 80) {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAng', this.aP);
    geo.setAttribute('aCol', this.aC);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aAng; attribute vec3 aCol; varying vec2 vUv; varying vec3 vC;
        void main() {
          float ca = cos(aAng), sa = sin(aAng);
          vUv = vec2(position.x * ca - position.y * sa, position.x * sa + position.y * ca);
          vC = aCol;
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float s = length(instanceMatrix[0].xyz);
          c.xy += position.xy * s;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vC;
        void main() {
          float v = abs(vUv.x) * 1.45 + abs(vUv.y) * 0.8;
          if (v > 1.0) discard;
          vec3 col = v > 0.7 ? vec3(0.078, 0.063, 0.165) : (vUv.y > 0.0 && vUv.x < 0.1 ? min(vC * 1.0 + 0.12, vec3(0.95)) : vC);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.flecks.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.5, size: 0.14, angle: 0, color: new THREE.Color() });
  }

  get busy() {
    return this.flecks.some((f) => f.live);
  }

  burst(pos: THREE.Vector3, count = 6, speed = 3, size = 1) {
    for (let i = 0; i < count; i++) {
      const f = this.flecks[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      f.live = true;
      f.pos.copy(pos);
      const a = Math.random() * Math.PI * 2, up = 0.2 + Math.random() * 0.9, sp = speed * (0.4 + Math.random() * 0.8);
      f.vel.set(Math.cos(a), up, Math.sin(a)).normalize().multiplyScalar(sp);
      f.age = 0;
      f.life = 0.3 + Math.random() * 0.4;
      f.size = (0.1 + Math.random() * 0.1) * size;
      f.angle = Math.random() * 6.28;
      const r = Math.random();
      if (r < 0.3) f.color.set(SPECTRUM[Math.floor(Math.random() * 4)]);
      else f.color.set(r < 0.65 ? 0xf6f3ff : PRISM.body);
    }
  }

  reset() {
    for (const f of this.flecks) f.live = false;
    this.mesh.count = 0;
    this.frozen = false;
  }

  update(dt: number) {
    const dd = this.frozen ? 0 : dt;
    let n = 0;
    const ang = this.aP.array as Float32Array, col = this.aC.array as Float32Array;
    for (const f of this.flecks) {
      if (!f.live) continue;
      f.age += dd;
      if (f.age >= f.life) { f.live = false; continue; }
      f.vel.multiplyScalar(Math.max(0, 1 - 2.4 * dd));
      f.vel.y -= 5 * dd;
      f.pos.addScaledVector(f.vel, dd);
      if (f.pos.y < 0.05) { f.pos.y = 0.05; f.vel.y = 0; }
      const u = f.age / f.life;
      // Flash once: a fast pop to full size, then it shrinks away.
      const k = u < 0.18 ? u / 0.18 : 1 - (u - 0.18) / 0.82;
      this.m.compose(f.pos, this.q.identity(), this.s.setScalar(Math.max(f.size * k, MIN_SCALE)));
      this.mesh.setMatrixAt(n, this.m);
      ang[n] = f.angle + u * 2;
      col[n * 3] = f.color.r * 0.92; col[n * 3 + 1] = f.color.g * 0.92; col[n * 3 + 2] = f.color.b * 0.92;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aP.needsUpdate = true;
    this.aC.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// PrismRing
// ---------------------------------------------------------------------------------------------------------------

/**
 * A ring of small floating prisms that orbits a centre, bobbing a little. `set(center, radius, count, spin, size)` each
 * frame (`spin` in rad/s, `size` the prism length, width 0.4 of it); `scale(k)` grows or shrinks them all (0 hides);
 * `shatter(speed, life)` flings them off as loose shards; `hide()` / `reset()`. `update(dt)` each frame. Add `mesh`.
 */
export class PrismRing {
  readonly mesh = new THREE.Group();
  frozen = false;
  private crystals: Crystal;
  private idx: number[] = [];
  private angle = Math.random() * 6.28;
  private spin = 0;
  private k = 1;
  private v = new THREE.Vector3();
  private c = new THREE.Vector3();
  private radius = 1;
  private count = 0;
  private size = 0.4;
  private time = 0;

  constructor(private max = 10) {
    this.crystals = new Crystal(max);
    this.crystals.spin = 2.2;
    this.mesh.add(this.crystals.mesh);
  }

  get busy() {
    return this.crystals.busy;
  }

  set(center: THREE.Vector3, radius: number, count: number, spin: number, size = 0.4) {
    this.c.copy(center);
    this.radius = radius;
    this.count = Math.min(count, this.max);
    this.spin = spin;
    this.size = size;
    this.layout();
  }

  scale(k: number) {
    this.k = k;
    this.layout();
  }

  shatter(speed = 4, life = 0.8) {
    this.crystals.shatter(speed, life, this.c);
    this.idx.length = 0;
    this.count = 0;
  }

  hide() {
    for (const i of this.idx) this.crystals.hide(i);
    this.idx.length = 0;
    this.count = 0;
  }

  reset() {
    this.crystals.reset();
    this.idx.length = 0;
    this.count = 0;
    this.k = 1;
    this.time = 0;
    this.frozen = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    this.crystals.frozen = this.frozen;
    this.angle += this.spin * d;
    this.time += d;
    this.crystals.update(dt);
    if (this.count > 0) this.layout();
  }

  private layout() {
    // Grow or trim the live set to `count`, then place each prism round the ring (alternating sizes and heights).
    while (this.idx.length > this.count) this.crystals.hide(this.idx.pop() as number);
    while (this.idx.length < this.count) this.idx.push(this.crystals.place(this.c, UP, this.size, this.size * 0.4));
    for (let i = 0; i < this.idx.length; i++) {
      const a = this.angle + (i / this.count) * Math.PI * 2;
      const bob = Math.sin(this.time * 2 + i * 1.7) * 0.18 + (i % 2 ? 0.18 : -0.1);
      this.v.set(this.c.x + Math.cos(a) * this.radius, this.c.y + bob, this.c.z + Math.sin(a) * this.radius);
      this.crystals.move(this.idx[i], this.v);
      const sz = this.size * (0.85 + 0.3 * hash(i * 3.1));
      this.crystals.setSize(this.idx[i], sz, sz * 0.4);
      this.crystals.setScale(this.idx[i], Math.max(this.k, MIN_SCALE));
    }
  }
}
