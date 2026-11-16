import * as THREE from 'three';

/**
 * Phoenix kit parts (Anka, the Firebird; pipeline/designs/kit-phoenix.md). Her signature shape is the long feather with an
 * eye near its tip: a gold shaft, an ember-red vane, a flame-gold tip, a small teal eye in a pale ring. Every spell is made
 * of them. Fire here is feathers and gold, never slag or smoke (that is Brannoc's): no black, no iron, a pale ash foil
 * under every flame, teal only in the eyes.
 *
 * - `featherGeometry(kind)`: one feather, its base at the origin and 1 m long along +y, cambered like a shallow roof so it
 *   reads from above and from the side. Three kinds: `eye` (the signature feather), `flame` (a feather of fire: orange
 *   with a gold heart, a wavy edge, no eye) and `ash` (pale and broken). Flat unlit colours in the vertices, no shader.
 * - `FeatherFlock`: a pool of one kind. Particles: `burst` (thrown out, tumbling, drifting down), `fall` (let go, fluttering
 *   down), `ring` (flying point first outward along the floor) and `dart` (point first from a to b on an arc). `put` draws
 *   one feather for this frame only (call it after `update`): fans, wings, rings of feathers that the spell moves itself.
 * - `FireBird`: the great firebird of the ultimate, drawn from two flocks plus a few flat-coloured body shapes: head with
 *   a three-feather crest, long neck, two wings in rows (red primaries with gold tips, flame coverts) and a train of five
 *   long tail feathers with eyes. `pose` draws it for one frame.
 * - Floor: `disc`, `ring`, `softDisc` (a pool of glow), and the looks the trait draws for the things that outlive a spell:
 *   `emberLook`, `nestLook`, `eggLook`, `ashesLook`, `emberPuffLook` (feet at y 0; the mark engine moves and scales the
 *   root every frame, so they animate their children from `onBeforeRender`).
 * Everything is pooled, takes world-space positions and stays under the bloom threshold (`core` only as pinpoints).
 */
export const PHOENIX = {
  core: 0xfff6d8, hot: 0xffc24a, body: 0xff7b3a, red: 0xc23a22, deep: 0x4c1410, gold: 0xe0a935, teal: 0x2fb8a8, ash: 0xeadcc4, dark: 0x1a0806,
  /** The lit side of an ember-red vane, and the shaded side of pale ash. */
  redLt: 0xde5634, ashDk: 0xb8a78c,
};
export const PHOENIX_CSS = {
  core: '#fff6d8', hot: '#ffc24a', body: '#ff7b3a', red: '#c23a22', deep: '#4c1410', gold: '#e0a935', teal: '#2fb8a8', ash: '#eadcc4', dark: '#1a0806',
  redLt: '#de5634', ashDk: '#b8a78c',
};

const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
/** The face hint of a feather that stands upright: toward the camera's side of the arena (either one: both faces are drawn). */
const FACE_Z = new THREE.Vector3(0, 0, 1);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const smooth = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const tint = (hex: number, k = 1) => new THREE.Color(hex).multiplyScalar(k);

// ---------------------------------------------------------------------------------------------------------------
// Floor: discs, rings, a pool of glow.
// ---------------------------------------------------------------------------------------------------------------

const onFloor = (m: THREE.Material) => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };

export function disc(r: number, color: number, opacity: number, y = 0.02, order = 2): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), onFloor(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  o.position.y = y;
  o.renderOrder = order;
  o.frustumCulled = false;
  return o;
}

export function ring(r: number, color: number, opacity: number, y = 0.03, width = 0.05, order = 3): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.RingGeometry(r - width, r, 56).rotateX(-Math.PI / 2), onFloor(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  o.position.y = y;
  o.renderOrder = order;
  o.frustumCulled = false;
  return o;
}

let poolTex: THREE.CanvasTexture | null = null;
/** A soft round falloff (drawn once on a canvas): full in the middle, clear at the edge. */
function poolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  poolTex = new THREE.CanvasTexture(c);
  return poolTex;
}

/** A pool of glow on the floor: radius `r`, soft at the edge. Normal blending, so pools that overlap never go white. */
export function softDisc(r: number, color: number, opacity: number, y = 0.025, order = 2): THREE.Mesh {
  const o = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2),
    onFloor(new THREE.MeshBasicMaterial({ map: poolTexture(), color, transparent: true, opacity, depthWrite: false })),
  );
  o.position.y = y;
  o.renderOrder = order;
  o.frustumCulled = false;
  return o;
}

// ---------------------------------------------------------------------------------------------------------------
// The feather.
// ---------------------------------------------------------------------------------------------------------------

export type FeatherKind = 'eye' | 'flame' | 'ash';

type V3 = [number, number, number];

/** Flat-coloured triangles gathered into one geometry (each face its own colour, so the bands stay crisp). */
class Soup {
  private pos: number[] = [];
  private col: number[] = [];

  tri(a: V3, b: V3, c: V3, color: THREE.Color) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }

  quad(a: V3, b: V3, c: V3, d: V3, color: THREE.Color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** A flat ellipse in the feather's plane at (cx, cy, z). */
  oval(cx: number, cy: number, z: number, rx: number, ry: number, color: THREE.Color, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2;
      this.tri([cx, cy, z], [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z], [cx + Math.cos(b) * rx, cy + Math.sin(b) * ry, z], color);
    }
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingSphere();
    return geo;
  }
}

/** Half the vane's width at each height (both 0..1 of the feather's length), per kind. A width of 0 is bare shaft. */
const OUTLINE: Record<FeatherKind, [number, number][]> = {
  eye: [[0, 0], [0.1, 0], [0.17, 0.1], [0.34, 0.155], [0.56, 0.175], [0.74, 0.17], [0.87, 0.12], [1, 0]],
  flame: [[0, 0.03], [0.12, 0.13], [0.28, 0.19], [0.44, 0.15], [0.6, 0.165], [0.76, 0.105], [0.9, 0.06], [1, 0]],
  ash: [[0, 0], [0.1, 0], [0.18, 0.1], [0.36, 0.15], [0.54, 0.16], [0.66, 0.11], [0.76, 0.13], [0.9, 0]],
};

const CAMBER = 0.42;

function buildFeather(kind: FeatherKind): THREE.BufferGeometry {
  const s = new Soup();
  const st = OUTLINE[kind];
  /** The shaft's line: the tip bends back a little. */
  const zc = (v: number) => -0.07 * v * v;
  /** A point of the vane: it falls away from the shaft to both sides (a shallow roof). */
  const P = (x: number, v: number): V3 => [x, v, zc(v) - CAMBER * Math.abs(x)];

  // The vane, one band per stretch and side: the lit side (+x) and the shaded side.
  const lit: THREE.Color[] = [], shade: THREE.Color[] = [], heart: THREE.Color[] = [];
  for (let i = 0; i < st.length - 1; i++) {
    if (kind === 'eye') {
      // ember red, an orange band, a flame-gold tip; darker down at the quill
      const c = i <= 1 ? [tint(PHOENIX.red, 0.75), tint(PHOENIX.red, 0.55)] : i <= 4 ? [tint(PHOENIX.redLt), tint(PHOENIX.red)] : i === 5 ? [tint(PHOENIX.body), tint(PHOENIX.body, 0.8)] : [tint(PHOENIX.hot), tint(PHOENIX.hot, 0.82)];
      lit.push(c[0]);
      shade.push(c[1]);
    } else if (kind === 'flame') {
      // orange outside, a gold heart, a red root
      const c = i === 0 ? [tint(PHOENIX.redLt), tint(PHOENIX.red)] : i <= 4 ? [tint(PHOENIX.body), tint(PHOENIX.body, 0.78)] : [tint(PHOENIX.hot, 0.95), tint(PHOENIX.hot, 0.8)];
      lit.push(c[0]);
      shade.push(c[1]);
      heart.push(i === 0 ? tint(PHOENIX.body) : i <= 4 ? tint(PHOENIX.hot, 0.95) : tint(PHOENIX.core, 0.9));
    } else {
      lit.push(tint(PHOENIX.ash, 0.92));
      shade.push(tint(PHOENIX.ashDk));
    }
  }
  for (let i = 0; i < st.length - 1; i++) {
    const [v0, w0] = st[i], [v1, w1] = st[i + 1];
    if (w0 <= 0 && w1 <= 0) continue;
    for (const side of [-1, 1]) {
      const col = side > 0 ? lit[i] : shade[i];
      if (kind === 'flame') {
        const k = 0.45;
        s.quad(P(0, v0), P(side * w0 * k, v0), P(side * w1 * k, v1), P(0, v1), heart[i]);
        s.quad(P(side * w0 * k, v0), P(side * w0, v0), P(side * w1, v1), P(side * w1 * k, v1), col);
      } else s.quad(P(0, v0), P(side * w0, v0), P(side * w1, v1), P(0, v1), col);
    }
  }

  if (kind !== 'flame') {
    // The shaft: a gold strip on the front and one on the back, thicker at the bare quill.
    const top = kind === 'ash' ? 0.86 : 0.97;
    const gold = tint(PHOENIX.gold, kind === 'ash' ? 0.8 : 1), under = tint(PHOENIX.gold, kind === 'ash' ? 0.6 : 0.72);
    const sw = (v: number) => 0.03 - 0.018 * v;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const v0 = (i / n) * top, v1 = ((i + 1) / n) * top, a = sw(v0), b = sw(v1);
      s.quad([-a, v0, zc(v0) + 0.014], [a, v0, zc(v0) + 0.014], [b, v1, zc(v1) + 0.014], [-b, v1, zc(v1) + 0.014], gold);
      s.quad([-a, v0, zc(v0) - 0.03], [a, v0, zc(v0) - 0.03], [b, v1, zc(v1) - 0.03], [-b, v1, zc(v1) - 0.03], under);
    }
  }

  if (kind === 'eye') {
    // The eye near the tip, on both faces: a pale ring (so the teal reads on red), a teal eye, a gold pupil.
    const ey = 0.7, z = zc(ey);
    const pale = tint(PHOENIX.ash), teal = tint(PHOENIX.teal), pupil = tint(PHOENIX.gold);
    s.oval(0, ey, z + 0.022, 0.086, 0.108, pale);
    s.oval(0, ey, z + 0.03, 0.056, 0.073, teal);
    s.oval(0, ey - 0.01, z + 0.038, 0.022, 0.03, pupil, 8);
    s.oval(0, ey, z - 0.075, 0.086, 0.108, pale);
    s.oval(0, ey, z - 0.083, 0.056, 0.073, teal);
    s.oval(0, ey - 0.01, z - 0.091, 0.022, 0.03, pupil, 8);
  }
  return s.build();
}

const featherGeos = new Map<FeatherKind, THREE.BufferGeometry>();
/** One feather (shared, never disposed): base at the origin, 1 m long along +y, its top face toward +z. */
export function featherGeometry(kind: FeatherKind = 'eye') {
  let g = featherGeos.get(kind);
  if (!g) { g = buildFeather(kind); featherGeos.set(kind, g); }
  return g;
}

let featherMat: THREE.MeshBasicMaterial | null = null;
function featherMaterial() {
  featherMat ??= new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return featherMat;
}

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

/**
 * Writes a feather's matrix: its quill at `base`, its length along `dir` (any length), `size` m long, its top face turned as
 * far toward `face` as the direction allows, then rolled `roll` about its length; `wide` widens it.
 */
function setFeather(m: THREE.Matrix4, base: THREE.Vector3, dir: THREE.Vector3, size: number, roll = 0, wide = 1, face: THREE.Vector3 = UP) {
  _y.copy(dir);
  const l = _y.length();
  if (l < 1e-6) _y.set(0, 1, 0);
  else _y.multiplyScalar(1 / l);
  _z.copy(face).addScaledVector(_y, -face.dot(_y));
  if (_z.lengthSq() < 1e-3) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  if (_z.lengthSq() < 1e-3) _z.set(1, 0, 0).addScaledVector(_y, -_y.x);
  _z.normalize();
  if (roll !== 0) _z.applyAxisAngle(_y, roll);
  _x.crossVectors(_y, _z);
  const s = Math.max(size, MIN_SCALE);
  m.makeBasis(_x.multiplyScalar(s * wide), _y.multiplyScalar(s), _z.multiplyScalar(s));
  m.setPosition(base);
  return m;
}

interface Plume {
  live: boolean;
  /** 0: thrown, tumbling and falling. 1: flying point first from `from` to `to`. */
  mode: 0 | 1;
  pos: THREE.Vector3; vel: THREE.Vector3; axis: THREE.Vector3; spin: number; ph: number; flutter: boolean;
  from: THREE.Vector3; to: THREE.Vector3; lift: number; ease: boolean; fadeAt: number;
  age: number; life: number; size: number; wide: number;
}

/**
 * Pooled feathers of one kind. Particles end by themselves (each has a short life and shrinks away); `put` draws one more
 * feather for this frame only and must be called after `update`. `max` holds both. Add `mesh`.
 */
export class FeatherFlock {
  readonly mesh: THREE.InstancedMesh;
  private plumes: Plume[] = [];
  private cursor = 0;
  private n = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private d = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(kind: FeatherKind = 'eye', private max = 60) {
    this.mesh = new THREE.InstancedMesh(featherGeometry(kind), featherMaterial(), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.plumes.push({
        live: false, mode: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), spin: 0, ph: 0, flutter: false,
        from: new THREE.Vector3(), to: new THREE.Vector3(), lift: 0, ease: false, fadeAt: 0.85, age: 0, life: 1, size: 0.5, wide: 1,
      });
    }
  }

  /** True while a particle is still in the air. */
  get busy() {
    return this.plumes.some((p) => p.live);
  }

  private next() {
    const p = this.plumes[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.live = true;
    p.mode = 0;
    p.age = 0;
    p.flutter = false;
    p.wide = 1;
    p.ph = Math.random() * 6.28;
    p.axis.randomDirection();
    p.spin = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 7);
    return p;
  }

  /** `count` feathers thrown out and up from `pos` at about `speed` m/s; they tumble, drift down and shrink away within `life` s. */
  burst(pos: THREE.Vector3, count: number, speed = 3, size = 0.5, life = 0.6, up = 0.6) {
    for (let i = 0; i < count; i++) {
      const p = this.next();
      const a = Math.random() * Math.PI * 2, e = 0.1 + Math.random() * 0.9, sp = speed * (0.45 + Math.random() * 0.55);
      p.pos.copy(pos);
      p.vel.set(Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * 0.8 + up * speed * 0.5, Math.sin(a) * Math.cos(e) * sp);
      p.life = life * (0.75 + Math.random() * 0.25);
      p.size = size * (0.7 + Math.random() * 0.5);
    }
  }

  /** `count` loose feathers let go within `spread` m of `pos`: they flutter down for `life` s. `drift` is a shared sideways speed. */
  fall(pos: THREE.Vector3, count: number, spread = 0.5, size = 0.5, life = 0.6, drift?: THREE.Vector3) {
    for (let i = 0; i < count; i++) {
      const p = this.next();
      p.flutter = true;
      p.pos.set(pos.x + (Math.random() - 0.5) * 2 * spread, pos.y + (Math.random() - 0.5) * spread, pos.z + (Math.random() - 0.5) * 2 * spread);
      p.vel.set((Math.random() - 0.5) * 1.2, 0.4 - Math.random() * 1.2, (Math.random() - 0.5) * 1.2);
      if (drift) p.vel.addScaledVector(drift, 0.25 + Math.random() * 0.2);
      p.life = life * (0.7 + Math.random() * 0.3);
      p.size = size * (0.7 + Math.random() * 0.5);
      p.spin *= 0.5;
    }
  }

  /**
   * A ring of `count` feathers that fly point first outward along the floor from radius `r0`, slowing, so that their tips
   * end at radius `r1` after `seconds`; they shrink away over the last half.
   */
  ring(center: THREE.Vector3, count: number, r0: number, r1: number, seconds: number, size = 0.6, y = 0.12, phase = 0) {
    for (let i = 0; i < count; i++) {
      const p = this.next();
      const a = phase + ((i + (Math.random() - 0.5) * 0.5) / count) * Math.PI * 2;
      const sz = size * (0.75 + Math.random() * 0.45);
      const far = Math.max(r0 + 0.05, r1 - sz) * (0.82 + Math.random() * 0.18);
      p.mode = 1;
      p.from.set(center.x + Math.cos(a) * r0, y, center.z + Math.sin(a) * r0);
      p.to.set(center.x + Math.cos(a) * far, y + Math.random() * 0.25, center.z + Math.sin(a) * far);
      p.lift = 0.15 + Math.random() * 0.3;
      p.ease = true;
      p.fadeAt = 0.5;
      p.life = seconds * (0.85 + Math.random() * 0.3);
      p.size = sz;
      p.wide = 1.15;
    }
  }

  /**
   * One feather flying point first from `from` to `to` in `seconds`, over an arc `lift` m high, after `delay` s. `ease`: fast
   * at first and slowing in, as a hero's dash goes (so a streak of them keeps up with her).
   */
  dart(from: THREE.Vector3, to: THREE.Vector3, seconds: number, size = 0.6, lift = 0, delay = 0, fadeAt = 0.85, ease = false) {
    const p = this.next();
    p.mode = 1;
    p.from.copy(from);
    p.to.copy(to);
    p.lift = lift;
    p.ease = ease;
    p.fadeAt = fadeAt;
    p.life = Math.max(seconds, 0.02);
    p.size = size;
    p.age = -delay;
  }

  /**
   * Draws one feather for this frame only (call it after `update`): its quill at `base`, its length along `dir`, `size` m
   * long, its top face turned toward `face` (up, if left out), rolled `roll` about its length.
   */
  put(base: THREE.Vector3, dir: THREE.Vector3, size: number, roll = 0, wide = 1, face: THREE.Vector3 = UP) {
    if (this.n >= this.max || size <= MIN_SCALE) return;
    this.mesh.setMatrixAt(this.n++, setFeather(this.m, base, dir, size, roll, wide, face));
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    for (const p of this.plumes) p.live = false;
    this.n = 0;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let k = 0;
    for (const p of this.plumes) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) { p.live = false; continue; }
      const u = p.age / p.life;
      if (p.mode === 1) {
        const e = p.ease ? easeOut(u) : u;
        this.p.lerpVectors(p.from, p.to, e);
        this.p.y += p.lift * 4 * e * (1 - e);
        this.d.subVectors(p.to, p.from);
        this.d.y += p.lift * 4 * (1 - 2 * e);
        const sc = p.size * Math.min(1, 0.35 + p.age * 16) * (1 - smooth((u - p.fadeAt) / (1 - p.fadeAt)));
        this.mesh.setMatrixAt(k++, setFeather(this.m, this.p, this.d, sc, 0, p.wide));
        continue;
      }
      if (p.flutter) {
        p.vel.y += -4 * dt;
        if (p.vel.y < -1.8) p.vel.y = -1.8;
        p.pos.x += Math.sin(p.age * 6 + p.ph) * 0.7 * dt;
        p.pos.z += Math.cos(p.age * 5 + p.ph) * 0.7 * dt;
      } else p.vel.y += -7 * dt;
      const drag = Math.max(0, 1 - 2 * dt);
      p.vel.x *= drag;
      p.vel.z *= drag;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.06) { p.pos.y = 0.06; p.vel.set(0, 0, 0); p.spin = 0; }
      const sc = p.size * Math.min(1, 0.3 + p.age * 14) * (1 - smooth((u - 0.6) / 0.4));
      this.q.setFromAxisAngle(p.axis, p.ph + p.age * p.spin);
      this.m.compose(p.pos, this.q, this.s.setScalar(Math.max(sc, MIN_SCALE)));
      this.mesh.setMatrixAt(k++, this.m);
    }
    this.n = k;
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The great firebird (the ultimate).
// ---------------------------------------------------------------------------------------------------------------

export interface FireBirdPose {
  /** Its size: 1 is about 6.5 m from wing tip to wing tip and 6 m from beak to the end of the train. */
  scale: number;
  /** 0..1: the wings folded back along the body, or spread wide. */
  spread: number;
  /** The wings' lift in radians: about 0.9 raised high over the back, 0 level, -0.4 struck down. */
  flap: number;
  /** A clock for the sway of the neck and the train. */
  time: number;
  /** 0..1: how grown its feathers are (it forms out of small feathers, and shrinks away the same way). */
  grow?: number;
}

/** Where the bird's shapes sit in its own space (x to its left, y up, z forward): the body, the chest, four beads of neck. */
const BIRD_BLOBS: { p: V3; r: V3; color: number; k?: number }[] = [
  { p: [0, 0, 0.05], r: [0.4, 0.34, 0.92], color: PHOENIX.body },
  { p: [0, 0.03, 0.58], r: [0.33, 0.3, 0.46], color: PHOENIX.hot, k: 0.9 },
  { p: [0, 0.2, 0.9], r: [0.26, 0.25, 0.3], color: PHOENIX.body },
  { p: [0, 0.42, 1.18], r: [0.23, 0.23, 0.27], color: PHOENIX.body, k: 0.9 },
  { p: [0, 0.6, 1.45], r: [0.2, 0.2, 0.25], color: PHOENIX.redLt },
  { p: [0, 0.72, 1.7], r: [0.19, 0.19, 0.24], color: PHOENIX.redLt },
  // the head, the beak, and an eye on each side: a pale ring and a teal eye
  { p: [0, 0.8, 1.96], r: [0.25, 0.23, 0.31], color: PHOENIX.red },
  { p: [0, 0.75, 2.3], r: [0.085, 0.075, 0.25], color: PHOENIX.gold },
  { p: [0.19, 0.88, 2.04], r: [0.07, 0.085, 0.095], color: PHOENIX.ash },
  { p: [-0.19, 0.88, 2.04], r: [0.07, 0.085, 0.095], color: PHOENIX.ash },
  { p: [0.225, 0.89, 2.05], r: [0.05, 0.058, 0.064], color: PHOENIX.teal },
  { p: [-0.225, 0.89, 2.05], r: [0.05, 0.058, 0.064], color: PHOENIX.teal },
];
/** How far the bird's beak is ahead of its middle, at scale 1 (the spell keeps the beak on the hit's front). */
export const BIRD_HEAD = 2.5;

/**
 * The great firebird. Its body, neck and head are a few flat-coloured shapes (`mesh`); every feather is drawn into the two
 * flocks the spell hands to `pose` (so they share its pools): call `pose` once a frame, after the flocks' `update`.
 * `hide()` takes the body away; the feathers end with the frame.
 */
export class FireBird {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private cos = 1;
  private sin = 0;
  private size = 1;

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), BIRD_BLOBS.length);
    this.mesh.frustumCulled = false;
    BIRD_BLOBS.forEach((b, i) => this.mesh.setColorAt(i, tint(b.color, b.k ?? 1)));
    this.mesh.visible = false;
  }

  hide() {
    this.mesh.visible = false;
  }

  /** The bird's own (x, y, z) as a world point. */
  private at(x: number, y: number, z: number, out: THREE.Vector3) {
    const s = this.size;
    return out.set(this.pos.x + s * (x * this.cos + z * this.sin), this.pos.y + s * y, this.pos.z + s * (-x * this.sin + z * this.cos));
  }

  /** The bird's own direction as a world direction. */
  private way(x: number, y: number, z: number, out: THREE.Vector3) {
    return out.set(x * this.cos + z * this.sin, y, -x * this.sin + z * this.cos);
  }

  /**
   * Draws the bird for this frame with its middle at `pos`, flying toward `yaw` (atan2(dx, dz)). The red feathers with eyes
   * go into `plumes`, the feathers of flame into `flames`.
   */
  pose(plumes: FeatherFlock, flames: FeatherFlock, pos: THREE.Vector3, yaw: number, o: FireBirdPose) {
    const grow = clamp01(o.grow ?? 1), S = Math.max(o.scale, MIN_SCALE), t = o.time;
    this.pos.copy(pos);
    this.cos = Math.cos(yaw);
    this.sin = Math.sin(yaw);
    this.size = S;
    const fs = S * grow; // a feather's size factor

    // The body, the neck (it sways a little) and the head.
    this.mesh.visible = grow > 0.02;
    this.q.setFromAxisAngle(UP, yaw);
    const nod = Math.sin(t * 9) * 0.05, sway = Math.sin(t * 5) * 0.06;
    BIRD_BLOBS.forEach((bl, i) => {
      const h = Math.max(0, bl.p[2] - 0.6); // how far up the neck
      this.at(bl.p[0] + sway * h, bl.p[1] + nod * h, bl.p[2], this.a);
      const g = Math.max(grow, MIN_SCALE) * S;
      this.m.compose(this.a, this.q, this.s.set(bl.r[0] * g, bl.r[1] * g, bl.r[2] * g));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;

    // The crest: three feathers swept back from the crown.
    for (let i = -1; i <= 1; i++) {
      this.at(i * 0.07 + sway * 1.4, 0.98 + nod * 1.4, 1.9, this.a);
      plumes.put(this.a, this.way(i * 0.42, 0.8 - Math.abs(i) * 0.12, -0.62, this.dir), (0.95 - Math.abs(i) * 0.15) * fs, 0, 1.1);
    }
    // The breast: short flames laid back over the body, so it is no smooth ball.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.at(Math.cos(a) * 0.2, Math.sin(a) * 0.17 + 0.03, 0.72, this.a);
      flames.put(this.a, this.way(Math.cos(a) * 0.5, Math.sin(a) * 0.45, -1, this.dir), 1.0 * fs, 0, 1.25, this.way(Math.cos(a), Math.sin(a) + 0.4, 0.2, this.b));
    }

    // The wings: a bone from the shoulder, red primaries with gold tips along it, flame coverts over their roots.
    const lift = o.flap, ce = Math.cos(lift), se = Math.sin(lift);
    const sweep = 1.25 - 1.13 * clamp01(o.spread);
    const len = 2.3 * (0.45 + 0.55 * clamp01(o.spread));
    for (const sd of [1, -1]) {
      const bx = sd * ce * Math.cos(sweep), by = se, bz = -ce * Math.sin(sweep);
      for (let j = 0; j < 9; j++) {
        const f = (j + 1) / 9, out = Math.pow(f, 1.6);
        // the inner feathers point back along the body, the outer ones follow the bone
        this.at(sd * 0.34 + bx * len * f, 0.16 + by * len * f, 0.3 + bz * len * f, this.a);
        this.way(bx * out + sd * 0.12 * (1 - out), by * out - 0.05, bz * out - (1 - out * 0.8), this.dir);
        plumes.put(this.a, this.dir, (1.05 + 0.75 * Math.sin(Math.PI * (0.15 + 0.75 * f))) * (0.92 + 0.16 * hash(j + 3)) * fs, sd * 0.2, 1.2);
      }
      for (let j = 0; j < 7; j++) {
        const f = ((j + 0.5) / 7) * 0.82, out = Math.pow(f, 1.6);
        this.at(sd * 0.3 + bx * len * f, 0.24 + by * len * f, 0.42 + bz * len * f, this.a);
        this.way(bx * out + sd * 0.1 * (1 - out), by * out + 0.02, bz * out - (1 - out * 0.8), this.dir);
        flames.put(this.a, this.dir, (0.8 + 0.3 * hash(j + 11)) * fs, sd * 0.2, 1.3);
      }
    }

    // The train: five long tail feathers with eyes, fanned and swaying, and short flames over their roots.
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.24 + Math.sin(t * 8 + i * 1.3) * 0.07;
      this.at(i * 0.08, -0.02, -0.75, this.a);
      plumes.put(this.a, this.way(Math.sin(a), -0.1 + Math.sin(t * 7 + i) * 0.05, -Math.cos(a), this.dir), (3.0 - Math.abs(i) * 0.38) * fs, i * 0.14, 0.8);
    }
    for (let i = -2; i <= 1; i++) {
      const a = (i + 0.5) * 0.3;
      this.at((i + 0.5) * 0.12, 0.1, -0.6, this.a);
      flames.put(this.a, this.way(Math.sin(a), 0.02, -Math.cos(a), this.dir), 1.15 * fs, 0, 1.2);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// What the trait draws on the floor (Trait.markLook): embers, the nest, the egg, the ashes, the puffs.
// ---------------------------------------------------------------------------------------------------------------

interface Placed { base: V3; dir: V3; size: number; roll?: number; wide?: number; face?: THREE.Vector3 }

const _m = new THREE.Matrix4(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

/** A fixed bunch of feathers of one kind (one draw call). */
function featherBunch(kind: FeatherKind, list: Placed[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(featherGeometry(kind), featherMaterial(), list.length);
  list.forEach((f, i) => mesh.setMatrixAt(i, setFeather(_m, _b.set(f.base[0], f.base[1], f.base[2]), _d.set(f.dir[0], f.dir[1], f.dir[2]), f.size, f.roll ?? 0, f.wide ?? 1, f.face ?? UP)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** How a feather stuck in the floor leans: well over to one side, so the game's steep camera sees its face and its length. */
const LEAN: V3 = [0.9, 1, 0.12];

/**
 * A feather standing in the floor, leaning: two crossed cards, one with its face up and one across it, so it reads from
 * above and from either side of the arena.
 */
function standing(x: number, z: number, size: number, wide = 1): Placed[] {
  return [
    { base: [x, 0, z], dir: LEAN, size, wide },
    { base: [x, 0, z], dir: LEAN, size, wide: wide * 0.85, roll: Math.PI / 2 },
  ];
}

/**
 * Runs `tick` just before any of the look's meshes is drawn. The mark engine owns the root (its place, turn and size, every
 * frame) and has no update hook, so a look moves its children here; the world matrices are redone at once, so nothing lags.
 */
function animate(root: THREE.Object3D, tick: () => void) {
  const hook = () => { tick(); root.updateMatrixWorld(true); };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.onBeforeRender = hook;
    mesh.frustumCulled = false;
  });
}

const opacityOf = (m: THREE.Mesh) => m.material as THREE.MeshBasicMaterial;

/** A feather standing in the floor, `h` tall (two crossed cards): the kit's signature, for anything that wants one. */
export function quill(h = 1, kind: FeatherKind = 'eye'): THREE.Group {
  const g = new THREE.Group();
  g.add(featherBunch(kind, standing(0, 0, h, 1.1)));
  return g;
}

/** The small flames at a feather's foot: `n` of them in a ring of radius `r`, leaning outward. */
function footFlames(n: number, r: number, size: number, lean: number, turn = 0): Placed[] {
  const out: Placed[] = [];
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2 + (hash(i + n) - 0.5) * 0.5;
    const c = Math.cos(a), s = Math.sin(a);
    out.push({ base: [c * r, 0.02, s * r], dir: [c * lean, 1, s * lean], size: size * (0.8 + 0.45 * hash(i * 3 + n)), wide: 1.25, face: new THREE.Vector3(c, 0.5, s) });
  }
  return out;
}

/**
 * An ember on the floor: one feather standing in the floor in a small pool of glow, two small flames at its foot, and the
 * pale ash ring an enemy must stand in to stamp it out (`stampR`).
 */
export function emberLook(stampR: number): THREE.Object3D {
  const g = new THREE.Group();
  const glow = softDisc(0.72, PHOENIX.body, 0.55, 0.03, 2);
  const heart = disc(0.2, PHOENIX.hot, 0.6, 0.035, 3);
  const flames = featherBunch('flame', footFlames(3, 0.16, 0.34, 0.5, 0.7));
  g.add(
    disc(stampR, PHOENIX.ash, 0.07, 0.012, 1), disc(0.62, PHOENIX.deep, 0.4, 0.018, 1), glow, heart,
    ring(stampR, PHOENIX.ash, 0.62, 0.035, 0.08),
    featherBunch('eye', standing(0, 0, 1.3, 1.15)), flames,
  );
  const ph = Math.random() * 6.28;
  animate(g, () => {
    const t = performance.now() / 1000 + ph;
    flames.scale.y = 1 + 0.16 * Math.sin(t * 11);
    flames.rotation.y = Math.sin(t * 2.3) * 0.35;
    opacityOf(glow).opacity = 0.5 + 0.1 * Math.sin(t * 7);
  });
  return g;
}

/**
 * The nest: the newest ember, the one her second life hangs on. The same feather but taller, in a wider pool, wearing a
 * crown of flame feathers, and its stamp ring is gold and doubled, so both players see at once which ember it is.
 */
export function nestLook(stampR: number): THREE.Object3D {
  const g = new THREE.Group();
  const glow = softDisc(0.95, PHOENIX.hot, 0.5, 0.03, 2);
  const heart = disc(0.3, PHOENIX.hot, 0.65, 0.035, 3);
  const crown = featherBunch('flame', footFlames(6, 0.32, 0.6, 0.5));
  g.add(
    disc(stampR, PHOENIX.gold, 0.08, 0.012, 1), disc(0.8, PHOENIX.deep, 0.4, 0.018, 1), glow, heart,
    ring(stampR, PHOENIX.gold, 0.9, 0.035, 0.1), ring(stampR - 0.17, PHOENIX.gold, 0.5, 0.035, 0.06),
    featherBunch('eye', standing(0, 0, 1.8, 1.15)), crown,
  );
  const ph = Math.random() * 6.28;
  animate(g, () => {
    const t = performance.now() / 1000 + ph;
    crown.scale.y = 1 + 0.14 * Math.sin(t * 9);
    crown.rotation.y = t * 0.8;
    opacityOf(glow).opacity = 0.46 + 0.1 * Math.sin(t * 6);
  });
  return g;
}

/** The egg's shell: the lower part of a ball of ash with a broken, toothed rim, and cracks of light running down it. */
function eggShell(): THREE.Group {
  const g = new THREE.Group();
  const R = 0.56, TOP = 0.62;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 18, 10, 0, Math.PI * 2, TOP, Math.PI - TOP), new THREE.MeshBasicMaterial({ color: PHOENIX.ash, side: THREE.DoubleSide }));
  const on = (theta: number, phi: number, r: number): V3 => [Math.sin(theta) * Math.cos(phi) * r, Math.cos(theta) * r, Math.sin(theta) * Math.sin(phi) * r];
  // the broken rim: uneven teeth of shell
  const teeth = new Soup();
  const pale = tint(PHOENIX.ash), dim = tint(PHOENIX.ashDk);
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2 + (hash(i) - 0.5) * 0.3;
    teeth.tri(on(TOP, a0, R), on(TOP, a1, R), on(TOP - 0.24 - 0.2 * hash(i + 4), am, R * 1.01), i % 2 ? pale : dim);
  }
  // cracks of light from the rim down the sides
  const cracks = new Soup();
  const light = tint(PHOENIX.hot);
  for (let c = 0; c < 5; c++) {
    const phi0 = (c / 5) * Math.PI * 2 + 0.4, steps = 4, end = 1.7 + 0.5 * hash(c + 2);
    let prevL: V3 | null = null, prevR: V3 | null = null;
    for (let i = 0; i <= steps; i++) {
      const th = TOP + ((end - TOP) * i) / steps;
      const phi = phi0 + (i % 2 ? 0.2 : -0.14) * (0.6 + hash(c * 7 + i));
      const hw = (0.05 - 0.036 * (i / steps)) / Math.max(0.3, Math.sin(th));
      const L = on(th, phi - hw, R * 1.025), Rr = on(th, phi + hw, R * 1.025);
      if (prevL && prevR) cracks.quad(prevL, prevR, Rr, L, light);
      prevL = L;
      prevR = Rr;
    }
  }
  const plain = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  g.add(shell, new THREE.Mesh(teeth.build(), plain), new THREE.Mesh(cracks.build(), plain));
  return g;
}

/**
 * The egg she rises from, at the nest, while she is ash: a glowing egg of fire inside a broken shell of ash with cracks of
 * light, sitting in the nest's crown. Round it lies the ring her rising flare will fill (`flareR`), which fills as the egg
 * ripens (about 1.2 s); the fire beats faster the nearer she is.
 */
export function eggLook(flareR: number): THREE.Object3D {
  const g = new THREE.Group();
  const fill = disc(flareR, PHOENIX.body, 0.2, 0.022, 2);
  const glow = softDisc(1.25, PHOENIX.hot, 0.5, 0.03, 2);
  g.add(
    disc(flareR, PHOENIX.body, 0.13, 0.014, 1), fill, glow,
    ring(flareR + 0.08, PHOENIX.ash, 0.35, 0.03, 0.05), ring(flareR, PHOENIX.hot, 0.9, 0.04, 0.1),
    featherBunch('flame', footFlames(7, 0.46, 0.55, 1.1)),
  );
  const egg = new THREE.Group();
  egg.position.y = 0.63;
  egg.scale.set(0.8, 1.15, 0.8);
  const fire = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: tint(PHOENIX.hot, 0.92) }));
  const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(PHOENIX.hot).lerp(new THREE.Color(PHOENIX.core), 0.5) }));
  yolk.position.y = 0.36;
  const shell = eggShell();
  egg.add(fire, yolk, shell);
  g.add(egg);
  // How long this egg has lain: the mark engine pops a new mark in over its first 0.2 s (scale 0.4 to 1), which sets the clock.
  let born = performance.now() / 1000;
  animate(g, () => {
    const now = performance.now() / 1000, k = g.scale.x;
    if (k < 0.995) born = now - Math.max(0, (k - 0.4) / 3);
    const p = clamp01((now - born) / 1.2);
    const beat = Math.sin((now - born) * (7 + 16 * p));
    fire.scale.setScalar(1 + 0.045 * beat);
    yolk.scale.setScalar(0.7 + 0.4 * p + 0.1 * beat);
    shell.scale.setScalar(1 + 0.02 * p);
    fill.scale.setScalar(Math.max(0.12 + 0.88 * p, MIN_SCALE));
    opacityOf(glow).opacity = 0.35 + 0.3 * p + 0.08 * beat;
  });
  return g;
}

/** The pile of ash where she fell: pale ash on the floor, a low heap, and a few of her feathers lying loose on it. */
export function ashesLook(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(0.85, PHOENIX.ash, 0.28, 0.014, 1), softDisc(0.95, PHOENIX.ash, 0.4, 0.02, 2));
  const heap = (x: number, z: number, r: number, color: THREE.Color) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, 0.02, z);
    m.scale.y = 0.55;
    m.frustumCulled = false;
    g.add(m);
  };
  heap(0, 0, 0.42, tint(PHOENIX.ash, 0.95));
  heap(0.3, 0.14, 0.24, tint(PHOENIX.ashDk));
  heap(-0.24, -0.18, 0.22, tint(PHOENIX.ash, 0.85));
  g.add(
    featherBunch('ash', [
      { base: [0.15, 0.2, -0.1], dir: [0.9, 0.12, 0.5], size: 0.75, wide: 1.2 },
      { base: [-0.5, 0.06, 0.35], dir: [0.3, 0.05, 1], size: 0.6, wide: 1.2 },
    ]),
    featherBunch('eye', [
      { base: [-0.1, 0.22, 0.05], dir: [-0.8, 0.14, 0.6], size: 0.85, wide: 1.15 },
      { base: [0.55, 0.06, -0.4], dir: [-0.5, 0.04, -0.9], size: 0.6, wide: 1.15 },
    ]),
  );
  return g;
}

/** The mark engine draws a puff at its life left (0.6 s, the trait's PUFF_LIFE) down to 0.05: that scale is its clock. */
const PUFF_FROM = 0.6, PUFF_TO = 0.05;

/**
 * An ember that went out. Stamped: a pale puff of ash, the feather broken in two, small ash feathers flung out low. Burnt
 * (flared, flown to, or she rose): a quick ring of small flame feathers bursting outward round a short gold flash.
 * The mark engine shrinks the look over its 0.6 s; the look reads its age from that and undoes the shrinking.
 */
export function emberPuffLook(burnt: boolean): THREE.Object3D {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const flash = disc(1, burnt ? PHOENIX.hot : PHOENIX.ash, 0.5, 0.02, 2);
  const N = burnt ? 9 : 6;
  const bits = new THREE.InstancedMesh(featherGeometry(burnt ? 'flame' : 'ash'), featherMaterial(), N + (burnt ? 0 : 2));
  bits.frustumCulled = false;
  inner.add(flash, bits);
  const m = new THREE.Matrix4(), base = new THREE.Vector3(), dir = new THREE.Vector3();
  const tick = () => {
    const k = Math.max(root.scale.x, PUFF_TO);
    const u = clamp01((PUFF_FROM - k) / (PUFF_FROM - PUFF_TO));
    inner.scale.setScalar(1 / k);
    const out = easeOut(u * 1.3), gone = 1 - smooth((u - 0.5) / 0.5);
    flash.scale.setScalar(burnt ? 0.35 + 0.6 * out : 0.5 + 0.6 * out);
    opacityOf(flash).opacity = burnt ? 0.6 * (1 - u) * (1 - u) : 0.5 * (1 - u);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + hash(i) * 0.5, c = Math.cos(a), s = Math.sin(a);
      const r = burnt ? 0.2 + 0.7 * out : 0.25 + 0.6 * out;
      base.set(c * r, burnt ? 0.1 : 0.1 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.2)), s * r);
      dir.set(c, burnt ? 0.3 : 0.5 - u, s);
      bits.setMatrixAt(i, setFeather(m, base, dir, (burnt ? 0.5 : 0.36) * (0.8 + 0.4 * hash(i + 5)) * gone, 0, 1.25));
    }
    if (!burnt) {
      // the feather, broken in two, falling apart
      for (let i = 0; i < 2; i++) {
        const sd = i ? 1 : -1;
        base.set(sd * 0.12 * out, 0.12 + 0.3 * (1 - out), 0);
        dir.set(sd * (0.5 + 0.5 * out), 0.9 * (1 - out) + 0.1, 0.25 * sd);
        bits.setMatrixAt(N + i, setFeather(m, base, dir, 0.6 * gone, 0, 1.2, FACE_Z));
      }
    }
    bits.instanceMatrix.needsUpdate = true;
  };
  // Once now: the feathers' places reach the screen a frame after they are set, so a new copy must not start untouched.
  tick();
  animate(root, tick);
  return root;
}
