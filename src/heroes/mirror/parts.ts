import * as THREE from 'three';

/**
 * The mirror kit (pipeline/designs/kit-mirror.md): Silvane, the Vain. Polished silver, pale blue glass and a little violet.
 * `HandMirrors` = pooled real hand mirrors (an oval of glass in a silver rim, a handle) that spin in flight and lie flat on the
 * floor; `StandMirror` = a tall ornate full-length mirror in a silver frame; `Slivers` = small flat flecks of glass that flash
 * once; `Gleam` = camera-facing ribbons with a white core and a pale blue (or violet) edge; `restingMirrorLook` = the mirror
 * and the 1 m catch ring she leaves on the floor (`Trait.markLook`). Everything is pooled, takes world-space positions, has
 * `reset()` where it holds state, and stays under the bloom threshold (no colour above 0.92).
 */

/** Palette. Numbers for `THREE.Color`, `MIRROR_CSS` for APIs that want a string. `foil` (violet) is the pale foil. */
export const MIRROR = {
  core: 0xffffff,
  hot: 0xf4f9ff,
  body: 0xcfe6ff,
  shade: 0x8fa8cc,
  silver: 0xc6cedb,
  steel: 0x7d8aa0,
  violet: 0xd9b8ff,
  dark: 0x121a2e,
  foil: 0xd9b8ff,
} as const;

export const MIRROR_CSS = {
  core: '#ffffff',
  hot: '#f4f9ff',
  body: '#cfe6ff',
  shade: '#8fa8cc',
  silver: '#c6cedb',
  steel: '#7d8aa0',
  violet: '#d9b8ff',
  dark: '#121a2e',
  foil: '#d9b8ff',
} as const;

const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------------------------------------------
// Glass: a shader that flashes when the pane faces the camera and carries a pale streak.
// ---------------------------------------------------------------------------------------------------------------

function glassMaterial(sweep = 0) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uBody: { value: new THREE.Color(MIRROR.body) }, uShade: { value: new THREE.Color(MIRROR.shade) },
      uHot: { value: new THREE.Color(MIRROR.hot) }, uViolet: { value: new THREE.Color(MIRROR.violet) },
      uSweep: { value: sweep }, uFlash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main() {
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uShade, uHot, uViolet; uniform float uSweep, uFlash; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main() {
        vec3 view = normalize(cameraPosition - vW);
        float f = abs(dot(normalize(vN), view));
        vec3 c = mix(uShade, uBody, 0.35 + 0.65 * f);
        c = mix(c, uHot, smoothstep(0.78, 1.0, f) * 0.85);
        float d = (vUv.x - 0.5) * 0.9 + (vUv.y - 0.5);
        float streak = smoothstep(0.07, 0.0, abs(fract(d * 1.2 + uSweep) - 0.5) - 0.42) + smoothstep(0.03, 0.0, abs(fract(d * 1.2 + uSweep + 0.12) - 0.5) - 0.47);
        c = mix(c, uHot, clamp(streak, 0.0, 1.0) * 0.7);
        float e = smoothstep(0.55, 0.5, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
        c = mix(c, uViolet, (1.0 - e) * 0.25);
        c = mix(c, vec3(1.0), uFlash);
        gl_FragColor = vec4(min(c * 0.9, vec3(0.92)), 1.0);
      }`,
  });
}

let handGlass: THREE.ShaderMaterial | undefined;
let silverMat: THREE.MeshBasicMaterial | undefined;
let darkMat: THREE.MeshBasicMaterial | undefined;
let violetMat: THREE.MeshBasicMaterial | undefined;
const matSilver = () => (silverMat ??= new THREE.MeshBasicMaterial({ color: MIRROR.silver, side: THREE.DoubleSide }));
const matDark = () => (darkMat ??= new THREE.MeshBasicMaterial({ color: MIRROR.dark, side: THREE.DoubleSide }));
const matViolet = () => (violetMat ??= new THREE.MeshBasicMaterial({ color: MIRROR.violet, side: THREE.DoubleSide }));

const OVAL_X = 0.25;
const OVAL_Y = 0.33;

/** One hand mirror: glass oval in a silver rim over a dark outline, and a handle below it. Faces +Z, handle toward -Y, 0.9 m long. */
function buildHandMirror(): THREE.Group {
  const g = new THREE.Group();
  handGlass ??= glassMaterial(0.1);
  const back = new THREE.Mesh(new THREE.CircleGeometry(1, 28), matDark());
  back.scale.set(OVAL_X * 1.3, OVAL_Y * 1.3, 1);
  back.position.z = -0.012;
  const rim = new THREE.Mesh(new THREE.CircleGeometry(1, 28), matSilver());
  rim.scale.set(OVAL_X * 1.12, OVAL_Y * 1.12, 1);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 28), handGlass);
  glass.scale.set(OVAL_X * 0.92, OVAL_Y * 0.92, 1);
  glass.position.z = 0.006;
  const hullH = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.5, 0.05), matDark());
  hullH.position.set(0, -OVAL_Y - 0.2, 0);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.46, 0.06), matSilver());
  handle.position.set(0, -OVAL_Y - 0.2, 0.002);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), matViolet());
  gem.position.set(0, OVAL_Y * 1.12 + 0.01, 0.01);
  g.add(back, rim, glass, hullH, handle, gem);
  for (const m of g.children) m.frustumCulled = false;
  return g;
}

interface HandItem {
  live: boolean;
  mode: 'fly' | 'rest';
  holder: THREE.Group;
  pos: THREE.Vector3;
  yaw: number;
  spin: number;
  rate: number;
  scale: number;
  age: number;
}

/**
 * Pooled hand mirrors. `place(pos, yaw)` puts one (`yaw`: the way its handle trails / points) and returns its index; `move`,
 * `setScale`, `setSpin`, `setMode` ('fly': tilted and spinning about the vertical so the glass flashes toward the camera;
 * 'rest': lying face up and turning slowly), `hide`. `update(dt)` each frame. Add `mesh`.
 */
export class HandMirrors {
  readonly mesh = new THREE.Group();
  frozen = false;
  private items: HandItem[] = [];
  private cursor = 0;
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private ex = new THREE.Euler();

  constructor(max = 10) {
    for (let i = 0; i < max; i++) {
      const holder = buildHandMirror();
      holder.visible = false;
      this.mesh.add(holder);
      this.items.push({ live: false, mode: 'fly', holder, pos: new THREE.Vector3(), yaw: 0, spin: 0, rate: 16, scale: 1, age: 0 });
    }
  }

  get busy() {
    return this.items.some((c) => c.live);
  }

  place(pos: THREE.Vector3, yaw = 0, scale = 1, rate = 16) {
    let idx = this.items.findIndex((c) => !c.live);
    if (idx < 0) { idx = this.cursor; this.cursor = (this.cursor + 1) % this.items.length; }
    const c = this.items[idx];
    c.live = true;
    c.mode = 'fly';
    c.pos.copy(pos);
    c.yaw = yaw;
    c.scale = scale;
    c.rate = rate;
    c.spin = Math.random() * 6.28;
    c.age = 0;
    this.apply(c);
    return idx;
  }

  move(i: number, pos: THREE.Vector3, yaw?: number) {
    const c = this.items[i];
    c.pos.copy(pos);
    if (yaw !== undefined) c.yaw = yaw;
  }

  setScale(i: number, s: number) {
    this.items[i].scale = s;
  }

  setSpin(i: number, rate: number) {
    this.items[i].rate = rate;
  }

  setMode(i: number, mode: 'fly' | 'rest') {
    this.items[i].mode = mode;
  }

  hide(i: number) {
    const c = this.items[i];
    c.live = false;
    c.holder.visible = false;
  }

  reset() {
    for (const c of this.items) { c.live = false; c.holder.visible = false; }
    this.frozen = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    for (const c of this.items) {
      if (!c.live) continue;
      c.age += d;
      c.spin += c.rate * d;
      this.apply(c);
    }
  }

  private apply(c: HandItem) {
    const h = c.holder;
    h.visible = true;
    const s = Math.max(c.scale, MIN_SCALE);
    h.scale.setScalar(s);
    if (c.mode === 'fly') {
      // The pane leans back 55 degrees from face-up, and the whole mirror turns about the vertical: the glass sweeps past the camera.
      h.position.set(c.pos.x, c.pos.y + 0.08 * Math.sin(c.age * 9), c.pos.z);
      this.qa.setFromAxisAngle(UP, c.spin);
      this.ex.set(-Math.PI * 0.3, 0, 0);
      this.qb.setFromEuler(this.ex);
      h.quaternion.copy(this.qa).multiply(this.qb);
    } else {
      h.position.set(c.pos.x, c.pos.y + 0.07 + 0.02 * Math.sin(c.age * 3), c.pos.z);
      this.qa.setFromAxisAngle(UP, c.yaw + c.age * 0.5);
      this.ex.set(-Math.PI / 2, 0, 0);
      this.qb.setFromEuler(this.ex);
      h.quaternion.copy(this.qa).multiply(this.qb);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The mirror on the floor (Trait.markLook): the glass, a dark layer and the 1 m catch ring.
// ---------------------------------------------------------------------------------------------------------------

/** A hand mirror lying face up with a pale ring of radius `ring` (the catch reach) round it; `tint` colours the rim gem. Feet at y 0. */
export function restingMirrorLook(ring = 1, violet = false): THREE.Object3D {
  const root = new THREE.Group();
  const mirror = buildHandMirror();
  mirror.scale.setScalar(violet ? 0.85 : 1);
  mirror.rotation.x = -Math.PI / 2;
  mirror.rotation.z = violet ? 0.9 : -0.5;
  mirror.position.y = 0.09;
  const shade = new THREE.Mesh(
    new THREE.CircleGeometry(ring, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: MIRROR.dark, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shade.position.y = 0.03;
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(ring * 0.93, ring, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: violet ? MIRROR.violet : MIRROR.hot, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  rim.position.y = 0.05;
  shade.renderOrder = 1;
  rim.renderOrder = 2;
  // Four short pale glints on the ring.
  const glints = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: MIRROR.core }));
    const a = (i / 4) * Math.PI * 2 + 0.4;
    m.position.set(Math.cos(a) * ring, 0.12, Math.sin(a) * ring);
    m.scale.set(1, 1.8, 1);
    glints.add(m);
  }
  root.add(shade, rim, glints, mirror);
  for (const m of root.children) m.frustumCulled = false;
  return root;
}

// ---------------------------------------------------------------------------------------------------------------
// StandMirror: a tall ornate full-length mirror in a silver frame.
// ---------------------------------------------------------------------------------------------------------------

/** Total height of the standing mirror (m): feet to finial. */
export const STAND_HEIGHT = 2.75;
const FRAME_W = 1.14;
const GLASS_W = 0.86;
const BASE_Y = 0.35;
const STRAIGHT = 1.6;

function archShape(w: number, straight: number, baseY: number) {
  const r = w / 2, s = new THREE.Shape();
  s.moveTo(-r, baseY);
  s.lineTo(r, baseY);
  s.lineTo(r, baseY + straight);
  s.absarc(0, baseY + straight, r, 0, Math.PI, false);
  s.lineTo(-r, baseY);
  return s;
}

/**
 * One standing mirror at a time (pooled by the caller: make one per effect): a dark outline, a silver arched frame with a
 * violet gem on top and two feet, and a glass pane with a slow sweep of light. Faces +Z (the camera side) and is glass on
 * both faces. `place(pos)`, `setScale(k)` (grows from the floor), `flinch(k)` (a hit: a short flash), `hide()`. `update(dt)`.
 */
export class StandMirror {
  readonly mesh = new THREE.Group();
  private glass = glassMaterial(0);
  private time = 0;
  private flash = 0;
  private root = new THREE.Group();

  constructor() {
    const outer = archShape(FRAME_W, STRAIGHT, BASE_Y);
    const inner = archShape(GLASS_W, STRAIGHT, BASE_Y + 0.14);
    const frameShape = archShape(FRAME_W, STRAIGHT, BASE_Y);
    frameShape.holes.push(new THREE.Path(inner.getPoints(24).reverse()));
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.1, bevelEnabled: false, curveSegments: 20 }), matSilver());
    frame.position.z = -0.05;
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.14, bevelEnabled: false, curveSegments: 20 }), matDark());
    hull.scale.set(1.09, 1.03, 1);
    hull.position.set(0, -0.015, -0.07);
    const pane = new THREE.Mesh(new THREE.ShapeGeometry(inner, 24), this.glass);
    pane.position.z = 0;
    // The shape's UV runs in metres; the glass shader wants 0..1.
    const uv = pane.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + GLASS_W / 2) / GLASS_W, (uv.getY(i) - (BASE_Y + 0.14)) / (STRAIGHT + GLASS_W / 2));
    const feet: THREE.Mesh[] = [];
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, BASE_Y + 0.05, 0.3), matSilver());
      f.position.set(sx * 0.4, (BASE_Y + 0.05) / 2, 0);
      const fh = new THREE.Mesh(new THREE.BoxGeometry(0.22, BASE_Y + 0.08, 0.36), matDark());
      fh.position.copy(f.position).setY((BASE_Y + 0.08) / 2 - 0.015);
      feet.push(f, fh);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), matViolet());
    gem.position.set(0, BASE_Y + STRAIGHT + FRAME_W / 2 + 0.14, 0);
    gem.scale.set(1, 1.5, 0.6);
    const gemHull = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), matDark());
    gemHull.position.copy(gem.position);
    gemHull.scale.set(1, 1.5, 0.5);
    // Two small scrolls (rings) at the shoulders of the arch.
    const scrolls: THREE.Mesh[] = [];
    for (const sx of [-1, 1]) {
      const sc = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 14), matSilver());
      sc.position.set(sx * (FRAME_W / 2 + 0.08), BASE_Y + STRAIGHT, 0);
      scrolls.push(sc);
    }
    this.root.add(hull, frame, pane, ...feet, gemHull, gem, ...scrolls);
    for (const m of this.root.children) m.frustumCulled = false;
    this.mesh.add(this.root);
    this.mesh.visible = false;
  }

  place(pos: THREE.Vector3) {
    this.mesh.position.set(pos.x, 0, pos.z);
    this.mesh.visible = true;
    this.time = 0;
  }

  setScale(k: number) {
    this.root.scale.set(Math.max(k, MIN_SCALE), Math.max(k, MIN_SCALE), Math.max(k, MIN_SCALE));
  }

  flinch(k = 1) {
    this.flash = Math.max(this.flash, k);
  }

  hide() {
    this.mesh.visible = false;
  }

  update(dt: number) {
    this.time += dt;
    this.flash *= Math.exp(-dt * 12);
    this.glass.uniforms.uSweep.value = -this.time * 0.25;
    this.glass.uniforms.uFlash.value = Math.min(0.9, this.flash);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Slivers
// ---------------------------------------------------------------------------------------------------------------

interface Fleck { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; angle: number; color: THREE.Color }
const FLECK_COLORS = [0xf4f9ff, 0xcfe6ff, 0xc6cedb, 0xd9b8ff];

/**
 * Small flat diamond slivers of glass that flash once and fall: white, pale blue and silver with a few violet ones, each with a
 * dark edge so it reads on a bright floor. `burst(pos, count, speed, size)` (keep it to a handful). Pooled (`max`). Add `mesh`.
 */
export class Slivers {
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
          float v = abs(vUv.x) * 1.2 + abs(vUv.y) * 0.9;
          if (v > 1.0) discard;
          vec3 col = v > 0.7 ? vec3(0.071, 0.102, 0.18) : (vUv.y > 0.0 && vUv.x < 0.1 ? min(vC + 0.1, vec3(0.95)) : vC);
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
      f.color.set(r < 0.2 ? FLECK_COLORS[3] : FLECK_COLORS[Math.floor(Math.random() * 3)]);
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
// Gleam
// ---------------------------------------------------------------------------------------------------------------

interface GleamSlot { live: boolean; a: THREE.Vector3; b: THREE.Vector3; width: number; opacity: number; tint: number; taper: number }

/**
 * Camera-facing ribbons with a white core and a pale blue edge (or one `tint`, for example violet). `set(a, b, width, opacity,
 * tint?, tailTaper?, slot?)` draws a slot from A (the tail) to B; `hide(slot)` / `reset()` clear. Add `mesh`.
 */
export class Gleam {
  readonly mesh: THREE.Mesh;
  private slots: GleamSlot[] = [];
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private oth: Float32Array;
  private side: Float32Array;
  private wid: Float32Array;
  private alp: Float32Array;
  private tnt: Float32Array;
  private along: Float32Array;
  private c = new THREE.Color();

  constructor(max = 8) {
    for (let i = 0; i < max; i++) this.slots.push({ live: false, a: new THREE.Vector3(), b: new THREE.Vector3(), width: 0.4, opacity: 1, tint: -1, taper: 1 });
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
      uniforms: { uBody: { value: new THREE.Color(MIRROR.body).multiplyScalar(0.92) }, uWhite: { value: new THREE.Color(0xfdfeff).multiplyScalar(0.94) } },
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
        uniform vec3 uBody, uWhite; varying float vS; varying float vA; varying vec3 vT; varying float vL;
        void main() {
          float a = abs(vS);
          vec3 col; float op;
          if (a < 0.4) { col = uWhite; op = 1.0; }
          else { col = vT.x >= 0.0 ? vT : uBody; op = 0.7; }
          float fade = smoothstep(0.0, 0.12, vL) * smoothstep(0.0, 0.12, 1.0 - vL);
          gl_FragColor = vec4(col, op * vA * mix(1.0, fade, 0.6));
        }`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
  }

  set(a: THREE.Vector3, b: THREE.Vector3, width = 0.4, opacity = 1, tint?: number, tailTaper = 1, slot = 0) {
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

  hide(slot = 0) {
    this.slots[slot].live = false;
    this.write();
  }

  reset() {
    for (const s of this.slots) s.live = false;
    this.write();
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
