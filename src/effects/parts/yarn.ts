import * as THREE from 'three';
import type { MinionLook } from './minion';

/**
 * The yarn kit (pipeline/designs/kit-yarn.md): Grandma Ironknit. Warm rose wool, pale horn-coloured needles, a dark wine layer under
 * every bright strand. Flat unlit colour only (no additive glow: wool does not shine). Parts here:
 * `StrandTube` = a thin tube along any list of points, rebuilt each frame (a thread in flight, a strand of wool);
 * `yarnLook` / `yarnLooseLook` / `snipLook` = what a standing line, a line tied to nothing and a cut line look like on the floor
 * (`Trait.markLook`: 1 m along z, feet at y 0, the engine stretches z to the line's length, so the knots undo the stretch);
 * `Needles` = pooled knitting needles, as long as swords, that fly end first; `YarnBalls` = pooled balls of wool;
 * `Fluff` = fibres and lint that fly and fall; `Sweater` = a knitted jumper that is thrown, worn and shrinks;
 * `catLook` = Mr. Biscuit, a big grey cat (a `MinionLook`).
 */

export const YARN = {
  pink: 0xe86a9a,
  hot: 0xff9cc4,
  core: 0xfff0f6,
  foil: 0xc8c0a8,
  wine: 0x7a2a4c,
  ink: 0x2a1020,
  cream: 0xf2e6d0,
  grey: 0x9a9aa6,
} as const;

export const YARN_CSS = {
  pink: '#e86a9a',
  hot: '#ff9cc4',
  core: '#fff0f6',
  foil: '#c8c0a8',
  wine: '#7a2a4c',
  ink: '#2a1020',
  cream: '#f2e6d0',
  grey: '#9a9aa6',
} as const;

const MIN = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);

/** Where a standing line is tied above the floor, and how far its middle sags (m). */
export const LINE_HEIGHT = 0.8;
export const LINE_SAG = 0.2;

/** The height of the line at `k` (0..1 along it): tied at the ends, sagging in the middle. */
export const lineY = (k: number) => LINE_HEIGHT - LINE_SAG * 4 * k * (1 - k);

// ---------------------------------------------------------------------------------------------------------------
// Textures.
// ---------------------------------------------------------------------------------------------------------------

let knitTex: THREE.CanvasTexture | undefined;
let ballTex: THREE.CanvasTexture | undefined;

/** Rows of knitted V stitches in rose wool. */
function knitTexture() {
  if (knitTex) return knitTex;
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e86a9a';
  g.fillRect(0, 0, s, s);
  g.lineCap = 'round';
  g.lineWidth = 4;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * 16 + 8 + (row % 2) * 2, y = row * 16 + 9;
      g.strokeStyle = '#a73b69';
      g.beginPath(); g.moveTo(x - 6, y - 6); g.lineTo(x, y + 5); g.lineTo(x + 6, y - 6); g.stroke();
      g.strokeStyle = '#ff9cc4';
      g.beginPath(); g.moveTo(x - 6, y - 9); g.lineTo(x, y + 2); g.lineTo(x + 6, y - 9); g.stroke();
    }
  }
  knitTex = new THREE.CanvasTexture(c);
  knitTex.wrapS = knitTex.wrapT = THREE.RepeatWrapping;
  knitTex.colorSpace = THREE.SRGBColorSpace;
  return knitTex;
}

/** Wound wool: slanted bands of pink, rose and cream. */
function ballTexture() {
  if (ballTex) return ballTex;
  const w = 128, h = 64, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e86a9a';
  g.fillRect(0, 0, w, h);
  g.lineWidth = 5;
  for (let i = -8; i < 24; i++) {
    g.strokeStyle = i % 3 === 0 ? '#ff9cc4' : i % 3 === 1 ? '#c8487a' : '#e86a9a';
    g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + 40, h); g.stroke();
  }
  g.strokeStyle = '#f2e6d0';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 18); g.lineTo(w, 30); g.stroke();
  ballTex = new THREE.CanvasTexture(c);
  ballTex.colorSpace = THREE.SRGBColorSpace;
  return ballTex;
}

// ---------------------------------------------------------------------------------------------------------------
// StrandTube: a tube along a list of points.
// ---------------------------------------------------------------------------------------------------------------

/**
 * A thin round tube along `segs + 1` points, set with `set(points)` (rebuilt each call: cheap enough for a handful). The tube's
 * frame comes from the point list and the world's up, so it is meant for things that run mostly along the floor. Add `mesh`.
 */
export class StrandTube {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private geo = new THREE.BufferGeometry();
  private t = new THREE.Vector3();
  private s = new THREE.Vector3();
  private u = new THREE.Vector3();

  constructor(private segs: number, private sides: number, color: number, public radius: number, side: THREE.Side = THREE.FrontSide) {
    const rings = segs + 1;
    this.pos = new Float32Array(rings * sides * 3);
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = (i + 1) * sides + j, d = (i + 1) * sides + ((j + 1) % sides);
        idx.push(a, c, b, b, c, d);
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color, side: side === THREE.FrontSide ? THREE.DoubleSide : side }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** `taper(k)` scales the radius along the tube (k 0..1); default 1. */
  set(points: readonly THREE.Vector3[], taper?: (k: number) => number) {
    const n = Math.min(points.length, this.segs + 1);
    for (let i = 0; i < n; i++) {
      const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
      this.t.subVectors(b, a);
      if (this.t.lengthSq() < 1e-10) this.t.set(0, 0, 1);
      this.t.normalize();
      this.s.crossVectors(this.t, UP);
      if (this.s.lengthSq() < 1e-6) this.s.set(1, 0, 0);
      this.s.normalize();
      this.u.crossVectors(this.s, this.t).normalize();
      const r = this.radius * (taper ? Math.max(MIN, taper(i / Math.max(1, n - 1))) : 1);
      for (let j = 0; j < this.sides; j++) {
        const an = (j / this.sides) * Math.PI * 2, cs = Math.cos(an) * r, sn = Math.sin(an) * r;
        const o = (i * this.sides + j) * 3;
        this.pos[o] = p.x + this.s.x * cs + this.u.x * sn;
        this.pos[o + 1] = p.y + this.s.y * cs + this.u.y * sn;
        this.pos[o + 2] = p.z + this.s.z * cs + this.u.z * sn;
      }
    }
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.mesh.visible = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}

/** `n + 1` points along the line from a to b (ground plane) hanging like a line of wool: tied at the ends, sagging between. */
export function strandPoints(a: THREE.Vector3, b: THREE.Vector3, n: number, out: THREE.Vector3[], reach = 1): THREE.Vector3[] {
  while (out.length < n + 1) out.push(new THREE.Vector3());
  out.length = n + 1;
  for (let i = 0; i <= n; i++) {
    const k = i / n, kk = k * reach;
    out[i].set(a.x + (b.x - a.x) * kk, lineY(kk), a.z + (b.z - a.z) * kk);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// What a line looks like on the floor (Trait.markLook).
// ---------------------------------------------------------------------------------------------------------------

/** Keeps `o` from being stretched along z by the mark's length: call with the object, the mark's root and `o`'s own z scale. */
function unstretch(o: THREE.Object3D, root: THREE.Object3D, base = 1) {
  o.onBeforeRender = () => {
    o.scale.z = base / Math.max(1e-3, root.scale.z);
    o.updateMatrix();
    o.matrixWorld.multiplyMatrices(root.matrixWorld, o.matrix);
  };
}

/** Adds `m` to the mark's root at (0, y, z) with its z stretch undone (`onBeforeRender` runs only on meshes, so each piece does it itself). */
function pin(root: THREE.Group, m: THREE.Mesh, y: number, z: number) {
  m.position.set(0, y, z);
  m.frustumCulled = false;
  unstretch(m, root);
  root.add(m);
}

function knot(root: THREE.Group, z: number, y: number) {
  pin(root, new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshBasicMaterial({ color: YARN.ink, side: THREE.BackSide })), y, z);
  pin(root, new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: YARN.pink })), y, z);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 14), new THREE.MeshBasicMaterial({ color: YARN.hot }));
  loop.rotation.set(0.6, 0.9, 0);
  pin(root, loop, y, z);
}

/** The strand itself, 1 m along z: a dark outline, the rose body, a lighter twist wound round it, a dark shadow on the floor. */
function strand(root: THREE.Group, yAt: (k: number) => number) {
  const n = 28, pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(0, yAt(i / n), i / n - 0.5));
  const outline = new StrandTube(n, 6, YARN.ink, 0.105, THREE.BackSide);
  const body = new StrandTube(n, 6, YARN.pink, 0.078);
  outline.set(pts); body.set(pts);
  // The twist: a thin lighter thread winding round the body.
  const m = 110, twist: THREE.Vector3[] = [];
  for (let i = 0; i <= m; i++) {
    const k = i / m, a = k * 34 * Math.PI * 2, y = yAt(k);
    twist.push(new THREE.Vector3(Math.cos(a) * 0.062, y + Math.sin(a) * 0.062, k - 0.5));
  }
  const thread = new StrandTube(m, 4, YARN.hot, 0.03);
  thread.set(twist);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: YARN.ink, transparent: true, opacity: 0.28, depthWrite: false }));
  shade.position.y = 0.03;
  shade.renderOrder = 2;
  shade.frustumCulled = false;
  root.add(shade, outline.mesh, body.mesh, thread.mesh);
}

/** A standing line, tied at both ends (a knot at each). */
export function yarnLook(): THREE.Object3D {
  const root = new THREE.Group();
  strand(root, lineY);
  knot(root, -0.5, LINE_HEIGHT);
  knot(root, 0.5, LINE_HEIGHT);
  return root;
}

/** A line tied to nothing: a knot at her end, and at the far end the line runs down to a ball of wool lying on the floor. */
export function yarnLooseLook(): THREE.Object3D {
  const root = new THREE.Group();
  const ease = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
  strand(root, (k) => lineY(k) - (lineY(k) - 0.2) * ease((k - 0.72) / 0.28));
  knot(root, -0.5, LINE_HEIGHT);
  pin(root, new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 9), new THREE.MeshBasicMaterial({ color: YARN.ink, side: THREE.BackSide })), 0.22, 0.5);
  pin(root, new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 9), new THREE.MeshBasicMaterial({ map: ballTexture() })), 0.22, 0.5);
  return root;
}

/** A cut line: bits of wool and two curling ends lying along where it was (the mark system shrinks it away). */
export function snipLook(): THREE.Object3D {
  const root = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(0.07);
  const pink = new THREE.MeshBasicMaterial({ color: YARN.pink }), pale = new THREE.MeshBasicMaterial({ color: YARN.hot }), dark = new THREE.MeshBasicMaterial({ color: YARN.wine });
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(geo, i % 5 === 4 ? dark : i % 2 ? pale : pink);
    const w = Math.sin(i * 12.9898) * 0.5;
    m.position.set(w * 0.3, 0.05 + 0.1 * Math.abs(Math.sin(i * 4.1)), -0.5 + (i + 0.5) / 16);
    m.scale.set(1 + Math.abs(w), 0.6, 1.5);
    m.rotation.y = i * 0.9;
    m.frustumCulled = false;
    unstretch(m, root, 1.5);
    root.add(m);
  }
  return root;
}

// ---------------------------------------------------------------------------------------------------------------
// Needles.
// ---------------------------------------------------------------------------------------------------------------

/** Length of one needle (m): as long as a sword. */
export const NEEDLE_LEN = 1.5;

function buildNeedle() {
  const g = new THREE.Group();
  const foil = new THREE.MeshBasicMaterial({ color: YARN.foil });
  const edge = new THREE.MeshBasicMaterial({ color: YARN.core });
  const ink = new THREE.MeshBasicMaterial({ color: YARN.ink, side: THREE.BackSide });
  const pink = new THREE.MeshBasicMaterial({ color: YARN.pink });
  const shaftLen = NEEDLE_LEN - 0.3;
  const shaftGeo = new THREE.CylinderGeometry(0.045, 0.05, shaftLen, 7).rotateX(Math.PI / 2);
  const tipGeo = new THREE.ConeGeometry(0.045, 0.34, 7).rotateX(Math.PI / 2);
  const knobGeo = new THREE.SphereGeometry(0.1, 8, 7);
  const shaft = new THREE.Mesh(shaftGeo, foil);
  shaft.position.z = -0.1;
  const tip = new THREE.Mesh(tipGeo, foil);
  tip.position.z = shaftLen / 2 - 0.1 + 0.17;
  const knob = new THREE.Mesh(knobGeo, pink);
  knob.position.z = -shaftLen / 2 - 0.1;
  const o1 = new THREE.Mesh(shaftGeo, ink);
  o1.position.copy(shaft.position);
  o1.scale.set(1.8, 1.8, 1.02);
  const o2 = new THREE.Mesh(tipGeo, ink);
  o2.position.copy(tip.position);
  o2.scale.set(1.8, 1.8, 1.02);
  const o3 = new THREE.Mesh(knobGeo, ink);
  o3.position.copy(knob.position);
  o3.scale.setScalar(1.3);
  // A bright edge along the shaft, so the metal catches the eye while it turns.
  const gleam = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, shaftLen * 0.8), edge);
  gleam.position.set(0.026, 0.026, -0.1);
  g.add(o1, o2, o3, shaft, tip, knob, gleam);
  g.visible = false;
  return g;
}

/** A pool of knitting needles. `place(i, pos, yaw, scale, roll)`: the point is toward +z turned by `yaw`; `pitch` tips it up (rad). */
export class Needles {
  readonly mesh = new THREE.Group();
  private items: THREE.Group[] = [];

  constructor(n = 1) {
    for (let i = 0; i < n; i++) {
      const g = buildNeedle();
      this.items.push(g);
      this.mesh.add(g);
    }
  }

  place(i: number, pos: THREE.Vector3, yaw: number, scale = 1, roll = 0, pitch = 0) {
    const g = this.items[i];
    if (!g) return;
    g.visible = scale > MIN;
    g.position.copy(pos);
    g.rotation.set(-pitch, yaw, roll, 'YXZ');
    g.scale.setScalar(Math.max(scale, MIN));
  }

  hide(i: number) {
    if (this.items[i]) this.items[i].visible = false;
  }

  reset() {
    for (const g of this.items) g.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Balls of wool.
// ---------------------------------------------------------------------------------------------------------------

/** A pool of balls of wool with a dark outline. `place(i, pos, scale, rx, ry)`. */
export class YarnBalls {
  readonly mesh = new THREE.Group();
  private items: THREE.Group[] = [];

  constructor(n = 1) {
    const geo = new THREE.SphereGeometry(1, 14, 10);
    const tex = ballTexture();
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      g.add(
        new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: YARN.ink, side: THREE.BackSide })),
        new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex })),
      );
      g.children[0].scale.setScalar(1.14);
      g.visible = false;
      this.items.push(g);
      this.mesh.add(g);
    }
  }

  place(i: number, pos: THREE.Vector3, scale: number, rx = 0, ry = 0) {
    const g = this.items[i];
    if (!g) return;
    g.visible = scale > MIN;
    g.position.copy(pos);
    g.rotation.set(rx, ry, 0);
    g.scale.setScalar(Math.max(scale, MIN));
  }

  hide(i: number) {
    if (this.items[i]) this.items[i].visible = false;
  }

  reset() {
    for (const g of this.items) g.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Fluff.
// ---------------------------------------------------------------------------------------------------------------

interface Bit { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; spin: number; angle: number; color: THREE.Color }

const FLUFF_COLORS = [YARN.pink, YARN.hot, YARN.cream, YARN.wine];

/** Small bits of wool that fly, tumble and settle. `burst(pos, count, speed, size, up)`, `update(dt)`, `busy`, `reset()`. Add `mesh`. */
export class Fluff {
  readonly mesh: THREE.InstancedMesh;
  private bits: Bit[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(private max = 60) {
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.bits.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.6, size: 0.08, spin: 0, angle: 0, color: new THREE.Color() });
  }

  get busy() {
    return this.bits.some((b) => b.live);
  }

  reset() {
    for (const b of this.bits) b.live = false;
    this.mesh.count = 0;
  }

  burst(pos: THREE.Vector3, count = 8, speed = 3, size = 1, up = 0.6) {
    for (let i = 0; i < count; i++) {
      const b = this.bits[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      b.live = true;
      b.pos.copy(pos);
      b.vel.set(Math.cos(a), up * (0.4 + Math.random()), Math.sin(a)).normalize().multiplyScalar(sp);
      b.age = 0;
      b.life = 0.5 + Math.random() * 0.5;
      b.size = (0.05 + Math.random() * 0.06) * size;
      b.spin = (Math.random() - 0.5) * 12;
      b.angle = Math.random() * 6.28;
      b.color.set(FLUFF_COLORS[Math.floor(Math.random() * FLUFF_COLORS.length)]);
    }
  }

  update(dt: number) {
    let n = 0;
    for (const b of this.bits) {
      if (!b.live) continue;
      b.age += dt;
      if (b.age >= b.life) { b.live = false; continue; }
      b.vel.multiplyScalar(Math.max(0, 1 - 2.6 * dt));
      b.vel.y -= 4.5 * dt;
      b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y < 0.05) { b.pos.y = 0.05; b.vel.y = 0; }
      const u = b.age / b.life, k = u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9;
      this.e.set(b.angle + b.age * b.spin, b.angle * 0.6 + b.age * b.spin * 0.5, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(b.pos, this.q, this.s.set(b.size * k * 1.5, b.size * k * 0.7, b.size * k).addScalar(MIN));
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.c.copy(b.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    void this.v;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The sweater.
// ---------------------------------------------------------------------------------------------------------------

/**
 * A knitted jumper about 0.9 m across: a body, two sleeves, a ribbed hem and neck, a cream stripe, a dark outline. It is thrown
 * (`lob`), worn (`wear`) and tightens (`fit`, 1 loose to 0 as small as it gets). Faces +z. Add `group`.
 */
export class Sweater {
  readonly group = new THREE.Group();
  private pose = new THREE.Group();
  private body: THREE.Mesh;
  private sleeves: THREE.Mesh[] = [];

  constructor() {
    const knit = knitTexture();
    const mat = new THREE.MeshBasicMaterial({ map: knit });
    const ribMat = new THREE.MeshBasicMaterial({ color: YARN.wine });
    const creamMat = new THREE.MeshBasicMaterial({ color: YARN.cream });
    const ink = new THREE.MeshBasicMaterial({ color: YARN.ink, side: THREE.BackSide });
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.46, 0.8, 12).scale(1, 1, 0.72);
    this.body = new THREE.Mesh(bodyGeo, mat);
    const bodyOut = new THREE.Mesh(bodyGeo, ink);
    bodyOut.scale.set(1.12, 1.07, 1.12);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 12).scale(1, 1, 0.72), ribMat);
    hem.position.y = -0.42;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.45, 0.1, 12).scale(1, 1, 0.72), creamMat);
    stripe.position.y = 0.05;
    const neck = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 6, 14).rotateX(Math.PI / 2), ribMat);
    neck.position.y = 0.4;
    this.pose.add(bodyOut, this.body, hem, stripe, neck);
    const sleeveGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.62, 8);
    for (const s of [-1, 1]) {
      const sl = new THREE.Mesh(sleeveGeo, mat);
      sl.position.set(s * 0.52, 0.08, 0);
      sl.rotation.z = s * 1.0;
      const out = new THREE.Mesh(sleeveGeo, ink);
      out.scale.setScalar(1.18);
      sl.add(out);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8), ribMat);
      cuff.position.y = -0.34;
      sl.add(cuff);
      this.sleeves.push(sl);
      this.pose.add(sl);
    }
    this.group.add(this.pose);
    this.group.visible = false;
  }

  /** Placed at `pos` facing `yaw`, `fit` 1 (loose) to 0 (squeezed): the body narrows and the sleeves pull in. `squeeze` wobbles it. */
  wear(pos: THREE.Vector3, yaw: number, fit: number, size = 1) {
    const f = THREE.MathUtils.clamp(fit, 0, 1);
    this.group.visible = true;
    this.group.position.copy(pos);
    this.group.rotation.set(0, yaw, 0);
    this.pose.rotation.set(0, 0, 0);
    const wide = 0.62 + 0.9 * f, tall = 0.7 + 0.3 * f;
    this.pose.scale.set(wide * size, tall * size, wide * size);
    for (const [i, s] of this.sleeves.entries()) {
      const side = i === 0 ? -1 : 1;
      s.position.x = side * (0.34 + 0.18 * f);
      s.rotation.z = side * (0.45 + 0.55 * f);
    }
  }

  /** Thrown: tumbling along an arc from `a` to `b`, `k` 0..1, folded small and opening as it nears. */
  lob(a: THREE.Vector3, b: THREE.Vector3, arc: number, k: number, size = 1) {
    const u = THREE.MathUtils.clamp(k, 0, 1);
    this.group.visible = true;
    this.group.position.lerpVectors(a, b, u);
    this.group.position.y += arc * 4 * u * (1 - u);
    this.group.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z), 0);
    this.pose.rotation.set(u * 9, 0, u * 3);
    const w = (0.35 + 0.6 * u) * size;
    this.pose.scale.set(w, w, w);
    for (const [i, s] of this.sleeves.entries()) {
      const side = i === 0 ? -1 : 1;
      s.position.x = side * 0.5;
      s.rotation.z = side * 1.0;
    }
  }

  hide() {
    this.group.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Mr. Biscuit.
// ---------------------------------------------------------------------------------------------------------------

/** Shared with the spell: the cat sits and bats at a loose end while `playing`. */
export interface CatState { playing: boolean }

const catGeo: Record<string, THREE.BufferGeometry> = {};
const cg = (key: string, make: () => THREE.BufferGeometry) => (catGeo[key] ??= make());

/**
 * Mr. Biscuit: a big grey cat, about a metre long and a metre high at the ears, with a wide body, a round head, two pointed
 * ears, green-yellow eyes, whiskers, four legs and a long tail that curls up and sways. It walks, pounces (the melee swing)
 * and, while `state.playing`, sits with its head down and bats at the floor. Body and head take the hit flash (`palette.body`),
 * belly, cheeks and paws the lighter `palette.trim`.
 */
export function catLook(state: CatState = { playing: false }): MinionLook {
  return (_kind, p) => {
    const root = new THREE.Group();
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd8e04a });
    const slitMat = new THREE.MeshBasicMaterial({ color: YARN.ink });
    const noseMat = new THREE.MeshBasicMaterial({ color: YARN.pink });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x55555f });
    const whiskerMat = new THREE.MeshBasicMaterial({ color: 0xf4f0e8 });
    const own = [eyeMat, slitMat, noseMat, stripeMat, whiskerMat];
    const sph = cg('sph', () => new THREE.SphereGeometry(1, 12, 9));
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      o.castShadow = true;
      return o;
    };
    const hull = (o: THREE.Mesh, k = 1.12) => {
      const h = new THREE.Mesh(o.geometry, p.outline);
      h.position.copy(o.position);
      h.scale.copy(o.scale).multiplyScalar(k);
      h.rotation.copy(o.rotation);
      return h;
    };

    // Body: a wide, long barrel with a pale chest and three dark tabby stripes across the back.
    const bodyG = new THREE.Group();
    bodyG.position.y = 0.5;
    const body = mk(sph, p.body, 0, 0, 0, 0.44, 0.38, 0.66);
    const chest = mk(sph, p.trim, 0, -0.06, 0.3, 0.3, 0.28, 0.3);
    bodyG.add(hull(body), body, chest);
    for (let i = 0; i < 3; i++) {
      const st = mk(cg('stripe', () => new THREE.BoxGeometry(0.62, 0.03, 0.08)), stripeMat, 0, 0.35 - Math.abs(i - 1) * 0.04, -0.2 + i * 0.2);
      st.scale.x = 1 - Math.abs(i - 1) * 0.12;
      st.castShadow = false;
      bodyG.add(st);
    }

    // Head: round, with cheeks, two pointed ears, eyes with slit pupils, a pink nose and whiskers.
    const head = new THREE.Group();
    head.position.set(0, 0.34, 0.6);
    const skull = mk(sph, p.body, 0, 0, 0, 0.3, 0.26, 0.27);
    head.add(hull(skull, 1.14), skull);
    const earGeo = cg('ear', () => new THREE.ConeGeometry(0.11, 0.24, 4));
    for (const s of [-1, 1]) {
      const ear = mk(earGeo, p.body, s * 0.18, 0.26, -0.02);
      ear.rotation.z = -s * 0.28;
      ear.rotation.y = Math.PI / 4;
      const inner = mk(cg('earIn', () => new THREE.ConeGeometry(0.06, 0.15, 4)), noseMat, s * 0.18, 0.24, 0.02);
      inner.rotation.copy(ear.rotation);
      inner.castShadow = false;
      const cheek = mk(sph, p.trim, s * 0.15, -0.08, 0.14, 0.13, 0.11, 0.12);
      const eye = mk(cg('eye', () => new THREE.SphereGeometry(0.052, 8, 6)), eyeMat, s * 0.12, 0.05, 0.22);
      eye.castShadow = false;
      const slit = mk(cg('slit', () => new THREE.BoxGeometry(0.014, 0.07, 0.01)), slitMat, s * 0.12, 0.05, 0.268);
      slit.castShadow = false;
      head.add(hull(ear, 1.25), ear, inner, cheek, eye, slit);
      for (let w = 0; w < 3; w++) {
        const wh = mk(cg('whisker', () => new THREE.BoxGeometry(0.34, 0.008, 0.008)), whiskerMat, s * 0.26, -0.05 - w * 0.03, 0.2);
        wh.rotation.z = s * (0.18 - w * 0.18);
        wh.rotation.y = -s * 0.25;
        wh.castShadow = false;
        head.add(wh);
      }
    }
    const nose = mk(cg('nose', () => new THREE.OctahedronGeometry(0.04, 0)), noseMat, 0, -0.04, 0.26, 1.2, 0.8, 0.8);
    nose.castShadow = false;
    head.add(nose);

    // Legs (front pair, back pair) with pale paws.
    const legGeo = cg('leg', () => new THREE.CylinderGeometry(0.075, 0.09, 0.4, 7).translate(0, -0.2, 0));
    const pawGeo = cg('paw', () => new THREE.SphereGeometry(0.1, 8, 6));
    const legs = [[-0.22, 0.4], [0.22, 0.4], [-0.22, -0.4], [0.22, -0.4]].map(([x, z]) => {
      const g = new THREE.Group();
      g.position.set(x, 0.4, z);
      const leg = mk(legGeo, p.body, 0, 0, 0);
      const paw = mk(pawGeo, p.trim, 0, -0.4, 0.03, 1, 0.7, 1.25);
      g.add(hull(leg, 1.18), leg, paw);
      root.add(g);
      return g;
    });

    // The tail: five joints that curl up and sway.
    const tail = new THREE.Group();
    tail.position.set(0, 0.62, -0.62);
    tail.rotation.x = -0.95;
    const joints: THREE.Group[] = [];
    let parent: THREE.Object3D = tail;
    for (let i = 0; i < 5; i++) {
      const j = new THREE.Group();
      j.position.y = i === 0 ? 0 : 0.2;
      const seg = mk(cg('tailSeg', () => new THREE.CylinderGeometry(0.05, 0.07, 0.24, 6).translate(0, 0.1, 0)), i === 4 ? p.trim : p.body, 0, 0, 0, 1 - i * 0.05, 1, 1 - i * 0.05);
      j.add(hull(seg, 1.2), seg);
      parent.add(j);
      parent = j;
      joints.push(j);
    }

    root.add(bodyG, head, tail);
    root.scale.setScalar(1.15);

    let phase = Math.random() * 6;
    let sit = 0;
    return {
      root,
      barY: 1.45,
      animate(dt, pose) {
        const w = pose.walk;
        phase += dt * (6 + 10 * w);
        const step = Math.sin(phase);
        const pounce = pose.swing >= 0 ? Math.sin(Math.min(1, pose.swing) * Math.PI) : 0;
        const want = state.playing || pose.swing >= 0 ? 1 : 0;
        sit += (want - sit) * Math.min(1, dt * 9);
        // The body bobs as it runs, and drops onto its haunches when it sits.
        bodyG.position.y = 0.5 + Math.abs(step) * 0.06 * w - 0.14 * sit + pounce * 0.12;
        bodyG.rotation.x = -0.25 * sit - pounce * 0.35;
        legs[0].rotation.x = step * 0.8 * w;
        legs[1].rotation.x = -step * 0.8 * w;
        legs[2].rotation.x = -step * 0.8 * w;
        legs[3].rotation.x = step * 0.8 * w;
        // Playing: the near front paw bats at the floor; pouncing: both front paws reach forward.
        if (state.playing) legs[1].rotation.x = -0.9 + Math.sin(pose.time * 16) * 0.55;
        if (pose.swing >= 0) { legs[0].rotation.x = -1.2 * pounce; legs[1].rotation.x = -1.2 * pounce; }
        root.position.z = pounce * 0.35;
        head.position.y = 0.34 - 0.1 * sit * (state.playing ? 1 : 0.4);
        head.rotation.x = (state.playing ? 0.55 : 0.18 * sit) + Math.sin(pose.time * 2.2) * 0.04 + pounce * 0.3;
        head.rotation.z = state.playing ? Math.sin(pose.time * 9) * 0.12 : 0;
        // The tail: curls up, sways, and flicks fast while it plays.
        const flick = state.playing ? 2.4 : 1;
        tail.rotation.x = -0.95 + 0.25 * sit;
        tail.rotation.z = Math.sin(pose.time * 2.4 * flick) * 0.35;
        joints.forEach((j, i) => {
          j.rotation.x = 0.38 + Math.sin(pose.time * 3 * flick - i * 0.7) * 0.16;
          j.rotation.z = Math.sin(pose.time * 2.4 * flick - i * 0.5) * 0.2;
        });
        legs[2].position.y = legs[3].position.y = 0.4 - 0.12 * sit;
      },
      dispose() {
        for (const m of own) m.dispose();
      },
    };
  };
}
