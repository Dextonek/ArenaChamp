import * as THREE from 'three';

/**
 * The mason kit (pipeline/designs/kit-mason.md): Bram's pillar Gerald and what he leaves behind. Limestone and sand on a
 * dark floor, a pale chalk foil for the edges, a flushed red-brown for his temper and a pale blue drop of sweat for his
 * nerves. Everything is flat toon stone (MeshStandard, flat shaded) or flat unlit colour: nothing glows, nothing blooms.
 * The pooled parts take world-space positions and have a `reset()`; the builders make one object each (`Trait.markLook`).
 */

/** Palette (`MASON_CSS` for APIs that want a string). `foil` is the pale chalk, `dark` the shadow layer. */
export const MASON = {
  core: 0xf6efdc,
  hot: 0xdcc58f,
  body: 0xc9b48a,
  accent: 0xc9b48a,
  stone: 0x9a958c,
  stoneLit: 0xb4afa5,
  stoneDark: 0x5b5853,
  foil: 0xe6e0d0,
  dark: 0x1c1a18,
  fury: 0xb06a58,
  sweat: 0x8fd3ff,
  moss: 0x6f8f5a,
} as const;

export const MASON_CSS = {
  core: '#f6efdc',
  hot: '#dcc58f',
  body: '#c9b48a',
  accent: '#c9b48a',
  stone: '#9a958c',
  stoneLit: '#b4afa5',
  stoneDark: '#5b5853',
  foil: '#e6e0d0',
  dark: '#1c1a18',
  fury: '#b06a58',
  sweat: '#8fd3ff',
  moss: '#6f8f5a',
} as const;

/** Gerald's size: the pillar's height (with its cap) and the radius of the obstacle under it. */
export const GERALD_HEIGHT = 3.5;
export const GERALD_RADIUS = 0.85;

export type GeraldMood = 'bored' | 'alarmed' | 'angry';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const MIN_SCALE = 1e-4;

const stoneMat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true });
const flat = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });
const floorMat = (color: number, opacity: number) => {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
  return m;
};

/** A deterministic wobble so the chunky stone is not a perfect cylinder (same for every pooled copy). */
function wobble(geo: THREE.BufferGeometry, amount: number, seed: number) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amount * Math.sin(y * 3.1 + seed + Math.atan2(z, x) * 3);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

const put = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
};

/**
 * One carved face on the +z side of the pillar (a pale plate, brow, eyes, nose, mouth), its mood drawn in the shapes:
 * bored (half-lidded eyes looking aside, a flat mouth, one brow up), alarmed (wide eyes, tiny pupils, high arched brows, an
 * O mouth, a drop of sweat) or angry (slanted heavy brows, red-flushed stone, a frown with clenched teeth).
 */
function carveFace(mood: GeraldMood): THREE.Group {
  const g = new THREE.Group();
  const plateColor = mood === 'angry' ? MASON.fury : mood === 'alarmed' ? MASON.foil : MASON.stoneLit;
  const plate = put(g, new THREE.BoxGeometry(1.15, 1.3, 0.16), stoneMat(plateColor), 0, 2.35, 0.72);
  plate.rotation.z = mood === 'bored' ? 0.03 : 0;
  const Z = 0.82;
  const eyeR = mood === 'alarmed' ? 0.27 : 0.2;
  for (const s of [-1, 1]) {
    const x = s * 0.29;
    // Eye: a chalk disc with a dark ring under it so it reads from far, then the pupil.
    const ring = put(g, new THREE.CircleGeometry(eyeR + 0.05, 20), flat(MASON.dark), x, 2.62, Z);
    ring.castShadow = false;
    const white = put(g, new THREE.CircleGeometry(eyeR, 20), flat(MASON.core), x, 2.62, Z + 0.005);
    white.castShadow = false;
    const pupilR = mood === 'alarmed' ? 0.05 : mood === 'angry' ? 0.1 : 0.09;
    const px = mood === 'bored' ? x + 0.08 : x;
    const pupil = put(g, new THREE.CircleGeometry(pupilR, 14), flat(MASON.dark), px, mood === 'bored' ? 2.58 : 2.62, Z + 0.01);
    pupil.castShadow = false;
    if (mood === 'bored') {
      // The lid: stone over the top half of the eye.
      put(g, new THREE.BoxGeometry(eyeR * 2.5, eyeR * 1.05, 0.05), stoneMat(plateColor), x, 2.62 + eyeR * 0.5, Z + 0.02).castShadow = false;
    }
    // Brow: a heavy stone bar.
    const brow = put(g, new THREE.BoxGeometry(0.46, mood === 'angry' ? 0.14 : 0.1, 0.1), stoneMat(MASON.stoneDark), x, 2.62 + eyeR + 0.14, Z + 0.03);
    if (mood === 'angry') {
      brow.rotation.z = s * -0.5;
      brow.position.y -= 0.12;
    } else if (mood === 'alarmed') {
      brow.rotation.z = s * 0.3;
      brow.position.y += 0.1;
    } else if (s > 0) {
      brow.position.y += 0.08;
      brow.rotation.z = 0.12;
    }
  }
  // Nose: a stone block.
  put(g, new THREE.BoxGeometry(0.2, 0.5, 0.24), stoneMat(MASON.stone), 0, 2.28, Z + 0.06);
  // Mouth.
  if (mood === 'alarmed') {
    const o = put(g, new THREE.CircleGeometry(0.17, 16), flat(MASON.dark), 0, 1.88, Z);
    o.scale.set(0.9, 1.3, 1);
    o.castShadow = false;
  } else if (mood === 'angry') {
    put(g, new THREE.BoxGeometry(0.62, 0.17, 0.06), flat(MASON.dark), 0, 1.9, Z).castShadow = false;
    for (let i = 0; i < 4; i++) put(g, new THREE.BoxGeometry(0.1, 0.1, 0.06), flat(MASON.core), -0.22 + i * 0.147, 1.9, Z + 0.01).castShadow = false;
    for (const s of [-1, 1]) {
      const c = put(g, new THREE.BoxGeometry(0.16, 0.07, 0.06), flat(MASON.dark), s * 0.36, 1.82, Z);
      c.rotation.z = s * 0.7;
      c.castShadow = false;
    }
  } else {
    const m = put(g, new THREE.BoxGeometry(0.5, 0.07, 0.06), flat(MASON.dark), 0, 1.9, Z);
    m.rotation.z = -0.05;
    m.castShadow = false;
    for (const s of [-1, 1]) {
      const c = put(g, new THREE.BoxGeometry(0.12, 0.06, 0.06), flat(MASON.dark), s * 0.28, 1.86, Z);
      c.rotation.z = s * 0.5;
      c.castShadow = false;
    }
  }
  if (mood === 'alarmed') {
    // A drop of sweat running off the temple.
    const d = put(g, new THREE.SphereGeometry(0.09, 10, 8), flat(MASON.sweat), 0.62, 2.78, Z + 0.02);
    d.scale.set(0.8, 1.3, 0.8);
    d.castShadow = false;
    const d2 = put(g, new THREE.SphereGeometry(0.06, 10, 8), flat(MASON.sweat), -0.64, 2.5, Z + 0.02);
    d2.scale.set(0.8, 1.3, 0.8);
    d2.castShadow = false;
  }
  return g;
}

/**
 * Gerald himself: a chunky chipped limestone pillar, `GERALD_HEIGHT` tall, feet at y 0, with a big carved face on the +z side
 * and the same face on the opposite side (so each player's camera sees one of them). A dark disc and a pale rim on the floor
 * under him make him read on a bright floor. The mood is in the face.
 */
export function buildGerald(mood: GeraldMood): THREE.Group {
  const g = new THREE.Group();
  const stone = stoneMat(MASON.stone);
  const dark = stoneMat(MASON.stoneDark);
  put(g, wobble(new THREE.CylinderGeometry(0.72, 0.86, 3.1, 8, 4), 0.05, 1.3), stone, 0, 1.75, 0);
  put(g, new THREE.CylinderGeometry(1.0, 1.1, 0.38, 8), dark, 0, 0.19, 0);
  put(g, new THREE.CylinderGeometry(0.98, 0.8, 0.28, 8), dark, 0, 3.36, 0);
  const slab = put(g, new THREE.BoxGeometry(1.7, 0.2, 1.7), stoneMat(MASON.stoneLit), 0.04, 3.58, 0);
  slab.rotation.y = 0.2;
  slab.position.y = 3.4;
  // A chipped corner, a few cracks and a patch of moss: he has been standing a long time.
  const chip = put(g, new THREE.BoxGeometry(0.5, 0.3, 0.5), dark, 0.78, 3.52, 0.55);
  chip.rotation.set(0.4, 0.5, 0.3);
  for (const [x, y, z, rz] of [[0.72, 1.2, 0.2, 0.5], [-0.7, 0.9, -0.3, -0.4], [0.5, 0.7, -0.62, 0.9]] as number[][]) {
    const c = put(g, new THREE.BoxGeometry(0.05, 0.7, 0.05), flat(MASON.dark), x, y, z);
    c.rotation.z = rz;
    c.castShadow = false;
  }
  put(g, new THREE.SphereGeometry(0.2, 8, 6), stoneMat(MASON.moss), -0.55, 3.46, 0.5).scale.set(1.4, 0.5, 1);
  // The faces.
  const front = carveFace(mood);
  const back = front.clone();
  back.rotation.y = Math.PI;
  g.add(front, back);
  // The floor: a dark layer and a pale rim.
  const shade = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28).rotateX(-Math.PI / 2), floorMat(MASON.dark, 0.4));
  shade.position.y = 0.01;
  shade.renderOrder = 1;
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.14, 1.24, 40).rotateX(-Math.PI / 2), floorMat(MASON.foil, 0.7));
  rim.position.y = 0.015;
  rim.renderOrder = 2;
  g.add(shade, rim);
  return g;
}

/** A heap of broken stone about 1.4 m across (a mark): chunks of every size, a dark layer under them. */
export function buildRubble(): THREE.Group {
  const g = new THREE.Group();
  const mats = [stoneMat(MASON.stone), stoneMat(MASON.stoneLit), stoneMat(MASON.stoneDark)];
  const shade = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20).rotateX(-Math.PI / 2), floorMat(MASON.dark, 0.4));
  shade.position.y = 0.01;
  shade.renderOrder = 1;
  g.add(shade);
  const spots: [number, number, number][] = [[0, 0, 0.42], [0.42, 0.18, 0.3], [-0.38, 0.28, 0.34], [0.12, -0.42, 0.28], [-0.3, -0.3, 0.22], [0.55, -0.3, 0.2], [-0.05, 0.5, 0.22]];
  spots.forEach(([x, z, s], i) => {
    const m = put(g, new THREE.DodecahedronGeometry(s, 0), mats[i % 3], x, s * 0.62, z);
    m.rotation.set(i * 1.3, i * 2.1, i * 0.7);
    m.scale.set(1, 0.75, 1);
  });
  return g;
}

/** A puff of stone dust: a few pale lumps (a mark that pops in and shrinks away). */
export function buildDust(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: MASON.foil, roughness: 1, flatShading: true });
  for (const [x, y, z, r] of [[0, 0.5, 0, 0.7], [0.5, 0.35, 0.2, 0.45], [-0.45, 0.4, 0.3, 0.5], [0.1, 0.9, -0.2, 0.45], [-0.2, 0.3, -0.5, 0.4]] as number[][]) {
    put(g, new THREE.IcosahedronGeometry(r, 1), mat, x, y, z).castShadow = false;
  }
  return g;
}

/** The faint ring that marks the 3 m round Gerald (his passive): a thin chalk ring and a dark layer inside it. */
export function buildAura(radius: number): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.07, radius, 72).rotateX(-Math.PI / 2), floorMat(MASON.foil, 0.4));
  ring.position.y = 0.012;
  ring.renderOrder = 1;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 56).rotateX(-Math.PI / 2), floorMat(MASON.hot, 0.07));
  fill.position.y = 0.008;
  fill.renderOrder = 1;
  g.add(fill, ring);
  return g;
}

/**
 * A Gerald an effect draws itself: while he tips over in R (the mark is hidden then), and for the VFX tool, where no trait
 * runs and so no mark draws him. Feet at (x, z), turned `yaw`, leaning `tilt` radians forward (0 = upright).
 */
export class GeraldFigure {
  readonly group = new THREE.Group();
  private lean = new THREE.Group();
  private moods: Record<GeraldMood, THREE.Group>;

  constructor() {
    this.moods = { bored: buildGerald('bored'), alarmed: buildGerald('alarmed'), angry: buildGerald('angry') };
    for (const m of Object.values(this.moods)) {
      m.visible = false;
      this.lean.add(m);
    }
    this.group.add(this.lean);
    this.group.visible = false;
  }

  set(x: number, z: number, yaw: number, mood: GeraldMood, tilt = 0) {
    this.group.visible = true;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
    this.lean.rotation.x = tilt;
    for (const k of Object.keys(this.moods) as GeraldMood[]) this.moods[k].visible = k === mood;
  }

  hide() {
    this.group.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Pooled parts
// ---------------------------------------------------------------------------------------------------------------

const DUMMY = new THREE.Object3D();
const CHUNK_COLORS = [MASON.stone, MASON.stoneLit, MASON.stoneDark, MASON.foil].map((c) => new THREE.Color(c));

/** Flying stones: thrown out, they tumble under gravity, bounce once on the floor and shrink away. */
export class StoneChunks {
  readonly mesh: THREE.InstancedMesh;
  private n: number;
  private next = 0;
  private pos: THREE.Vector3[];
  private vel: THREE.Vector3[];
  private spin: THREE.Vector3[];
  private rot: THREE.Vector3[];
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private live = 0;

  constructor(count = 60) {
    this.n = count;
    this.mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), stoneMat(0xffffff), count);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.pos = Array.from({ length: count }, () => new THREE.Vector3());
    this.vel = Array.from({ length: count }, () => new THREE.Vector3());
    this.spin = Array.from({ length: count }, () => new THREE.Vector3());
    this.rot = Array.from({ length: count }, () => new THREE.Vector3());
    this.age = new Float32Array(count).fill(99);
    this.life = new Float32Array(count).fill(1);
    this.size = new Float32Array(count);
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, CHUNK_COLORS[i % CHUNK_COLORS.length]);
    this.reset();
  }

  get busy() {
    return this.live > 0;
  }

  /** Throws `count` stones from `at`: `speed` m/s outward (about `dir` when given, else all round), `up` upward kick. */
  burst(at: THREE.Vector3, count: number, speed: number, up = 4, size = 0.2, dir?: THREE.Vector3, life = 1.3) {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + 0.6 * Math.random());
      this.pos[i].copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.3, (Math.random() - 0.5) * 0.4));
      if (dir) this.vel[i].set(dir.x * s + Math.cos(a) * s * 0.35, up * (0.5 + Math.random() * 0.7), dir.z * s + Math.sin(a) * s * 0.35);
      else this.vel[i].set(Math.cos(a) * s, up * (0.5 + Math.random() * 0.7), Math.sin(a) * s);
      this.spin[i].set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      this.rot[i].set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.age[i] = 0;
      this.life[i] = life * (0.7 + Math.random() * 0.5);
      this.size[i] = size * (0.5 + Math.random());
    }
  }

  update(dt: number) {
    let live = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) continue;
      live++;
      this.age[i] += dt;
      const p = this.pos[i], v = this.vel[i];
      v.y -= 14 * dt;
      p.addScaledVector(v, dt);
      if (p.y < this.size[i] * 0.6) {
        p.y = this.size[i] * 0.6;
        v.y = Math.abs(v.y) > 2 ? -v.y * 0.35 : 0;
        v.x *= 0.6;
        v.z *= 0.6;
      }
      this.rot[i].addScaledVector(this.spin[i], dt);
      const k = this.age[i] / this.life[i];
      const s = this.size[i] * (k > 0.7 ? Math.max(MIN_SCALE, 1 - (k - 0.7) / 0.3) : 1);
      DUMMY.position.copy(p);
      DUMMY.rotation.set(this.rot[i].x, this.rot[i].y, this.rot[i].z);
      DUMMY.scale.setScalar(s);
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(i, DUMMY.matrix);
    }
    if (live > 0 || this.live > 0) this.mesh.instanceMatrix.needsUpdate = true;
    if (live === 0 && this.live > 0) this.hideAll();
    this.live = live;
  }

  private hideAll() {
    DUMMY.scale.setScalar(MIN_SCALE);
    DUMMY.position.set(0, -50, 0);
    DUMMY.updateMatrix();
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, DUMMY.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    this.age.fill(99);
    this.live = 0;
    this.hideAll();
  }
}

/** Puffs of stone dust: pale lumps that swell fast, drift up and shrink away. No transparency, so nothing turns into a blob. */
export class DustPuffs {
  readonly mesh: THREE.InstancedMesh;
  private n: number;
  private next = 0;
  private pos: THREE.Vector3[];
  private vel: THREE.Vector3[];
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private live = 0;

  constructor(count = 40) {
    this.n = count;
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: MASON.foil, roughness: 1, flatShading: true }),
      count,
    );
    this.mesh.frustumCulled = false;
    this.pos = Array.from({ length: count }, () => new THREE.Vector3());
    this.vel = Array.from({ length: count }, () => new THREE.Vector3());
    this.age = new Float32Array(count).fill(99);
    this.life = new Float32Array(count).fill(1);
    this.size = new Float32Array(count);
    this.reset();
  }

  get busy() {
    return this.live > 0;
  }

  /** A ring of `count` puffs round `at` thrown outward at `speed`, each `size` big. */
  ring(at: THREE.Vector3, count: number, radius: number, speed: number, size = 0.35, life = 0.8) {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + Math.random() * 0.4;
      this.one(this.pos[this.next].set(at.x + Math.cos(a) * radius, at.y + 0.15, at.z + Math.sin(a) * radius), Math.cos(a) * speed, 0.5 + Math.random(), Math.sin(a) * speed, size, life);
    }
  }

  /** One puff at `at` drifting with (vx, vy, vz). */
  puff(at: THREE.Vector3, vx: number, vy: number, vz: number, size = 0.35, life = 0.8) {
    this.pos[this.next].copy(at);
    this.one(this.pos[this.next], vx, vy, vz, size, life);
  }

  private one(_at: THREE.Vector3, vx: number, vy: number, vz: number, size: number, life: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.vel[i].set(vx, vy, vz);
    this.age[i] = 0;
    this.life[i] = life * (0.75 + Math.random() * 0.5);
    this.size[i] = size * (0.7 + Math.random() * 0.6);
  }

  update(dt: number) {
    let live = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) continue;
      live++;
      this.age[i] += dt;
      this.pos[i].addScaledVector(this.vel[i], dt);
      this.vel[i].multiplyScalar(Math.exp(-dt * 2.5));
      const k = this.age[i] / this.life[i];
      // Swells in the first quarter, then shrinks away.
      const s = this.size[i] * (k < 0.25 ? 0.3 + 2.8 * k : Math.max(MIN_SCALE, 1 - (k - 0.25) / 0.75));
      DUMMY.position.copy(this.pos[i]);
      DUMMY.rotation.set(0, 0, 0);
      DUMMY.scale.setScalar(Math.max(MIN_SCALE, s));
      DUMMY.updateMatrix();
      this.mesh.setMatrixAt(i, DUMMY.matrix);
    }
    if (live > 0 || this.live > 0) this.mesh.instanceMatrix.needsUpdate = true;
    if (live === 0 && this.live > 0) this.hideAll();
    this.live = live;
  }

  private hideAll() {
    DUMMY.scale.setScalar(MIN_SCALE);
    DUMMY.position.set(0, -50, 0);
    DUMMY.updateMatrix();
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, DUMMY.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    this.age.fill(99);
    this.live = 0;
    this.hideAll();
  }
}

/** A star of dark cracks on the floor round a point (Raise Gerald's warning, the crash). */
export class FloorCracks {
  readonly mesh = new THREE.Group();
  private mat = floorMat(MASON.dark, 0);
  private lines: THREE.Mesh[] = [];

  constructor(count = 9) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 2) * 0.25;
      const len = 0.9 + (i % 3) * 0.4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1 + (i % 2) * 0.05, len).rotateX(-Math.PI / 2).translate(0, 0, len / 2), this.mat);
      m.rotation.y = a;
      m.renderOrder = 3;
      this.lines.push(m);
      this.mesh.add(m);
    }
    this.mesh.visible = false;
  }

  /** `r` scales the star (1 = about 1.4 m), `opacity` <= 0 hides it. */
  set(at: THREE.Vector3, r: number, opacity: number) {
    this.mesh.visible = opacity > 0.01 && r > 1e-3;
    this.mesh.position.set(at.x, 0.03, at.z);
    this.mesh.scale.setScalar(Math.max(r, MIN_SCALE));
    this.mat.opacity = clamp01(opacity);
  }
}

/** A flat ring or disc on the floor, with its own colour and opacity. */
export class FlatRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;

  constructor(color: number = MASON.foil, inner = 0.88) {
    this.mat = floorMat(color, 0);
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(inner, 1, 56).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }

  set(at: THREE.Vector3, r: number, opacity: number) {
    this.mesh.visible = opacity > 0.01 && r > 1e-3;
    this.mesh.position.set(at.x, 0.05, at.z);
    this.mesh.scale.setScalar(Math.max(r, MIN_SCALE));
    this.mat.opacity = clamp01(opacity);
  }
}

/**
 * A long dark shadow lying on the floor (Gerald's R: the shadow of the pillar as it tips), with a pale chalk edge so it reads
 * on a dark floor. It runs from `(x, z)` along `(dx, dz)`, `len` long and `width` wide.
 */
export class ShadowStrip {
  readonly mesh = new THREE.Group();
  private body: THREE.Mesh;
  private bodyMat = floorMat(MASON.dark, 0);
  private edgeMat = floorMat(MASON.foil, 0);

  constructor() {
    this.body = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), this.bodyMat);
    this.body.renderOrder = 2;
    this.mesh.add(this.body);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1).rotateX(-Math.PI / 2).translate(s * 0.5, 0, 0.5), this.edgeMat);
      e.renderOrder = 3;
      this.mesh.add(e);
    }
    this.mesh.visible = false;
  }

  set(x: number, z: number, dx: number, dz: number, len: number, width: number, opacity: number) {
    this.mesh.visible = opacity > 0.01 && len > 1e-3;
    this.mesh.position.set(x, 0.04, z);
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.mesh.scale.set(width, 1, Math.max(len, MIN_SCALE));
    this.bodyMat.opacity = clamp01(opacity) * 0.55;
    this.edgeMat.opacity = clamp01(opacity) * 0.8;
  }

  reset() {
    this.mesh.visible = false;
  }
}
