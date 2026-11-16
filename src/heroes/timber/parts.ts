import * as THREE from 'three';

/**
 * The timber kit (pipeline/designs/kit-timber.md): Hank the Lumberjack. Plaid red, wood brown and pine green, with pale
 * sawdust and birch as the foil (it shows on the dark floor and under every dark layer). Chunky stylised pines in three stages
 * (a light sapling, a mid young tree, a tall dark full tree, each with a dark footprint disc at its real obstacle radius), a
 * stump, his one-bit axe, a falling tree 8 m long and 1.6 m wide (the strip it hits), a tumbling thrown tree and axe, sawdust and
 * leaves, a flock of birds, a floating word and the flat shadow strip. Everything is pooled, takes world-space positions and has
 * a `reset()`. Flat unlit colours (nothing additive), so nothing turns into a white blob under bloom.
 */

/** Palette (`TIMBER_CSS` for APIs that want a string). `pale` is the foil: sawdust and birch. */
export const TIMBER = {
  core: 0xfff0d0,
  hot: 0xe8b868,
  body: 0xb5763a,
  accent: 0xc8322e,
  dark: 0x1c120b,
  pine: 0x3f6b3a,
  leaf: 0x7fbf55,
  pale: 0xf1e2c0,
} as const;

export const TIMBER_CSS = {
  core: '#fff0d0',
  hot: '#e8b868',
  body: '#b5763a',
  accent: '#c8322e',
  dark: '#1c120b',
  pine: '#3f6b3a',
  leaf: '#7fbf55',
  pale: '#f1e2c0',
} as const;

const MIN = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// ---------------------------------------------------------------------------------------------------------------
// Shared geometry and flat materials
// ---------------------------------------------------------------------------------------------------------------

const matCache = new Map<number, THREE.MeshBasicMaterial>();
/** One shared opaque flat material per colour (never faded: pooled parts fade by scale). */
const flatMat = (color: number) => {
  let m = matCache.get(color);
  if (!m) { m = new THREE.MeshBasicMaterial({ color }); matCache.set(color, m); }
  return m;
};

const geoCache = new Map<string, THREE.BufferGeometry>();
const cachedGeo = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
};

const coneMesh = (r: number, h: number, y: number, color: number, seg = 8) => {
  const m = new THREE.Mesh(cachedGeo(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0)), flatMat(color));
  m.position.y = y;
  return m;
};

const cylMesh = (rTop: number, rBot: number, h: number, y: number, color: number, seg = 8) => {
  const m = new THREE.Mesh(cachedGeo(`cyl:${rTop}:${rBot}:${h}:${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg).translate(0, h / 2, 0)), flatMat(color));
  m.position.y = y;
  return m;
};

/** A flat disc or ring on the floor (a decal): polygon offset so it sits over the floor and under the tree. */
function decal(inner: number, outer: number, color: number, opacity: number, y: number, order = 2) {
  const geo = inner > 0 ? new THREE.RingGeometry(inner, outer, 40) : new THREE.CircleGeometry(outer, 40);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(geo.rotateX(-Math.PI / 2), mat);
  m.position.y = y;
  m.renderOrder = order;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Standing trees, the stump, the axe on the ground (the trait draws them with `marks`)
// ---------------------------------------------------------------------------------------------------------------

export type TreeStage = 'sapling' | 'young' | 'full';

/** The standing height of each stage (m), for the fall (a tree grows to its full length as it topples) and the HP bar. */
export const TREE_HEIGHT: Record<TreeStage, number> = { sapling: 1.5, young: 4.2, full: 7.3 };

interface TreeSpec { trunkR: number; trunkH: number; tiers: [number, number, number][]; foot: number; ring: boolean; colors: number[]; skirt: number }

const SPECS: Record<TreeStage, TreeSpec> = {
  // radius, base height, height of each tier. `foot` is the real obstacle radius (a sapling blocks nothing).
  sapling: { trunkR: 0.09, trunkH: 0.9, tiers: [[0.58, 0.4, 0.85], [0.4, 0.95, 0.7]], foot: 0.42, ring: false, colors: [0x7fbf55, 0x97d26a], skirt: 0x3f6b3a },
  young: { trunkR: 0.26, trunkH: 1.5, tiers: [[1.3, 0.8, 1.6], [1.0, 1.8, 1.5], [0.66, 2.8, 1.4]], foot: 0.5, ring: true, colors: [0x3f6b3a, 0x4f8442, 0x65a04c], skirt: 0x23421f },
  full: { trunkR: 0.42, trunkH: 2.3, tiers: [[1.75, 1.1, 2.1], [1.45, 2.5, 2.0], [1.12, 3.8, 1.9], [0.78, 5.1, 1.7], [0.42, 6.2, 1.2]], foot: 0.7, ring: true, colors: [0x2f5a30, 0x3f6b3a, 0x4f8442, 0x5f9a4a, 0x7fbf55], skirt: 0x16301a },
};

/** A standing tree of a stage: feet at y 0. Chunky pines: a dark skirt under each tier, lighter toward the top. */
export function buildTree(stage: TreeStage): THREE.Group {
  const s = SPECS[stage];
  const g = new THREE.Group();
  g.add(decal(0, s.foot, TIMBER.dark, 0.6, 0.01));
  if (s.ring) g.add(decal(s.foot - 0.07, s.foot, TIMBER.pale, 0.75, 0.02, 3));
  g.add(cylMesh(s.trunkR * 0.78, s.trunkR, s.trunkH, 0, TIMBER.body));
  if (stage !== 'sapling') g.add(cylMesh(s.trunkR * 1.05, s.trunkR * 1.35, 0.3, 0, 0x6a4426));
  s.tiers.forEach(([r, y, h], i) => {
    g.add(coneMesh(r * 1.07, h * 0.92, y - 0.14, s.skirt));
    g.add(coneMesh(r, h, y, s.colors[Math.min(i, s.colors.length - 1)]));
  });
  return g;
}

/** A stump: a short wide trunk with a pale cut top and a few chips. */
export function buildStump(): THREE.Group {
  const g = new THREE.Group();
  g.add(decal(0, 0.7, TIMBER.dark, 0.45, 0.01));
  g.add(cylMesh(0.44, 0.55, 0.5, 0, TIMBER.body));
  const top = new THREE.Mesh(cachedGeo('stumpTop', () => new THREE.CircleGeometry(0.43, 16).rotateX(-Math.PI / 2)), flatMat(TIMBER.hot));
  top.position.y = 0.51;
  g.add(top);
  const rings = new THREE.Mesh(cachedGeo('stumpRing', () => new THREE.RingGeometry(0.2, 0.27, 16).rotateX(-Math.PI / 2)), flatMat(TIMBER.body));
  rings.position.y = 0.515;
  g.add(rings);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + 0.4;
    const chip = new THREE.Mesh(cachedGeo('chip', () => new THREE.BoxGeometry(0.26, 0.07, 0.12)), flatMat(i % 2 ? TIMBER.pale : TIMBER.hot));
    chip.position.set(Math.sin(a) * 0.78, 0.05, Math.cos(a) * 0.78);
    chip.rotation.y = a * 2;
    g.add(chip);
  }
  return g;
}

/**
 * The head of Hank's axe (one bit, as on his model since 2026-11-10): a flat shape in the x/y plane, the haft along y
 * through the eye at the origin, a short poll toward -x and the blade flaring out to its curved edge toward +x, 0.1 m thick.
 */
function axeHeadGeo(span: number): THREE.BufferGeometry {
  return cachedGeo(`axeHead1:${span}`, () => {
    const k = span / 0.75;
    const sh = new THREE.Shape();
    const pts: [number, number][] = [[-0.16, 0.13], [0.1, 0.13], [0.5, 0.42], [0.7, 0.36], [0.78, 0.12], [0.8, -0.08], [0.74, -0.3], [0.55, -0.48], [0.38, -0.36], [0.1, -0.13], [-0.16, -0.13]];
    pts.forEach(([x, y], i) => (i ? sh.lineTo(x * k, y * k) : sh.moveTo(x * k, y * k)));
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.1 * k, bevelEnabled: false }).translate(0, 0, -0.05 * k);
  });
}

/** Hank's axe: a haft along y (`len`) with its one-bit head at the top. Pale steel, dark haft, a red grip. */
export function buildAxe(len: number, span: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cylMesh(0.06 * len / 1.4, 0.07 * len / 1.4, len, 0, 0x5a3a1c, 6));
  g.add(cylMesh(0.075 * len / 1.4, 0.075 * len / 1.4, len * 0.22, 0, TIMBER.accent, 6));
  const head = new THREE.Mesh(axeHeadGeo(span), flatMat(TIMBER.pale));
  head.position.y = len * 0.9;
  g.add(head);
  const rim = new THREE.Mesh(axeHeadGeo(span * 1.1), flatMat(0x3a3430));
  rim.position.y = len * 0.9;
  rim.scale.z = 0.5;
  g.add(rim);
  return g;
}

/** Hank's axe stuck in the ground where it landed, leaning a little, in a pale 1.5 m ring: the reach to pick it up. */
export function buildAxeMark(reach: number): THREE.Group {
  const g = new THREE.Group();
  g.add(decal(reach - 0.09, reach, TIMBER.pale, 0.8, 0.02, 3));
  g.add(decal(0, reach, TIMBER.accent, 0.12, 0.015));
  const axe = buildAxe(1.6, 0.8);
  axe.rotation.z = 0.2;
  g.add(axe);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Falling trees and their shadow strips
// ---------------------------------------------------------------------------------------------------------------

/** The strip a falling tree hits: its length, and its width (the foliage never goes past it). */
export const FALL_LENGTH = 8;
export const FALL_WIDTH = 1.6;

const FALL_SCALE: Record<TreeStage, number> = { sapling: 0.5, young: 0.78, full: 1 };

/** A tree lying along +y, `length` long (the base at y 0): a tapered trunk and whorls of foliage no wider than the strip. */
function buildFallTree(length: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cylMesh(0.12, 0.42, length, 0, TIMBER.body));
  const n = 6;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const y = length * (0.3 + 0.62 * k);
    const r = 0.75 * (1 - 0.55 * k);
    const h = length * 0.17;
    g.add(coneMesh(r * 1.06, h * 0.92, y - 0.1, 0x23421f));
    g.add(coneMesh(r, h, y, [0x2f5a30, 0x3f6b3a, 0x4f8442, 0x5f9a4a, 0x6aa348, 0x7fbf55][i]));
  }
  return g;
}

interface Fall {
  pivot: THREE.Group;
  tree: THREE.Group;
  active: boolean;
  t: number;
  fall: number;
  stage: TreeStage;
  length: number;
  harmless: boolean;
  axis: THREE.Vector3;
}

/**
 * Trees toppling: each pivots on its base along a direction with an accelerating fall (`fall` seconds), bounces once, lies for
 * 0.7 s and sinks. It grows from the standing tree's height to its full 8 m length as it goes over (cartoon: the strip it hits is
 * what is drawn). `harmless`: a slower, lighter fall with no bounce (the oldest tree when a fourth is planted, an unfelled row).
 */
export class TreeFalls {
  readonly mesh = new THREE.Group();
  private pool: Fall[] = [];

  constructor(size = 8, private baseLength = FALL_LENGTH) {
    for (let i = 0; i < size; i++) {
      const pivot = new THREE.Group();
      const tree = buildFallTree(baseLength);
      pivot.add(tree);
      pivot.visible = false;
      this.mesh.add(pivot);
      this.pool.push({ pivot, tree, active: false, t: 0, fall: 0.6, stage: 'full', length: baseLength, harmless: false, axis: new THREE.Vector3(1, 0, 0) });
    }
  }

  get busy() {
    return this.pool.some((f) => f.active);
  }

  /** Starts a fall from the base (x, z) toward the unit direction (dx, dz): `length` m long, `fall` seconds to hit the floor. */
  start(x: number, z: number, dx: number, dz: number, stage: TreeStage, length: number, fall: number, harmless = false) {
    const f = this.pool.find((p) => !p.active) ?? this.pool.reduce((a, b) => (a.t > b.t ? a : b));
    f.active = true;
    f.t = 0;
    f.fall = fall;
    f.stage = stage;
    f.length = length;
    f.harmless = harmless;
    f.axis.set(dz, 0, -dx);
    f.pivot.position.set(x, 0.42 * FALL_SCALE[stage], z);
    f.pivot.visible = true;
    f.tree.scale.set(FALL_SCALE[stage], MIN + TREE_HEIGHT[stage] / this.baseLength, FALL_SCALE[stage]);
    f.pivot.quaternion.identity();
  }

  update(dt: number) {
    for (const f of this.pool) {
      if (!f.active) continue;
      f.t += dt;
      const lie = 0.7, sink = 0.35;
      const total = f.fall + lie + sink;
      if (f.t >= total) { f.active = false; f.pivot.visible = false; continue; }
      const k = clamp01(f.t / f.fall);
      let ang = (Math.PI / 2) * Math.pow(k, f.harmless ? 1.6 : 2.3);
      // One small bounce as it lands.
      if (!f.harmless && f.t > f.fall) ang -= 0.07 * Math.sin(clamp01((f.t - f.fall) / 0.22) * Math.PI);
      f.pivot.quaternion.setFromAxisAngle(f.axis, ang);
      // It stretches from its standing height to the full length in the first part of the fall.
      const grow = easeOut(f.t / (f.fall * 0.45));
      const sy = (TREE_HEIGHT[f.stage] + (f.length - TREE_HEIGHT[f.stage]) * grow) / this.baseLength;
      let shrink = 1;
      if (f.t > f.fall + lie) shrink = Math.max(MIN, 1 - (f.t - f.fall - lie) / sink);
      const w = FALL_SCALE[f.stage];
      f.tree.scale.set(w * shrink, Math.max(MIN, sy * shrink), w * shrink);
    }
  }

  reset() {
    for (const f of this.pool) { f.active = false; f.pivot.visible = false; }
  }
}

/**
 * The shadow of a tree about to land: a flat dark strip with a pale border (so it reads on a dark floor), growing darker as the
 * fall nears its end, then gone with the landing. Drawn exactly where the hit is checked: `length` along the direction from the
 * base, `width` across.
 */
export class FallShadows {
  readonly mesh = new THREE.Group();
  private pool: { dark: THREE.Mesh; pale: THREE.Mesh; darkMat: THREE.MeshBasicMaterial; paleMat: THREE.MeshBasicMaterial; t: number; life: number; active: boolean }[] = [];

  constructor(size = 8) {
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    for (let i = 0; i < size; i++) {
      const mk = (color: number, order: number) => {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
        const m = new THREE.Mesh(plane, mat);
        m.renderOrder = order;
        m.visible = false;
        this.mesh.add(m);
        return { m, mat };
      };
      const pale = mk(TIMBER.pale, 2), dark = mk(TIMBER.dark, 3);
      this.pool.push({ dark: dark.m, pale: pale.m, darkMat: dark.mat, paleMat: pale.mat, t: 0, life: 0.6, active: false });
    }
  }

  get busy() {
    return this.pool.some((s) => s.active);
  }

  show(x: number, z: number, dx: number, dz: number, length: number, width: number, life: number) {
    const s = this.pool.find((p) => !p.active) ?? this.pool[0];
    s.active = true;
    s.t = 0;
    s.life = life;
    const yaw = Math.atan2(dx, dz);
    for (const [m, pad] of [[s.pale, 0.28], [s.dark, 0]] as const) {
      m.visible = true;
      m.position.set(x, 0.03, z);
      m.rotation.y = yaw;
      m.scale.set(width + pad, 1, length + pad);
    }
    // The pale border sits a little behind the base so the strip's start is clear too.
    s.pale.position.set(x - dx * 0.14, 0.03, z - dz * 0.14);
  }

  update(dt: number) {
    for (const s of this.pool) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t >= s.life + 0.12) { s.active = false; s.dark.visible = s.pale.visible = false; continue; }
      const k = clamp01(s.t / s.life);
      const fade = s.t > s.life ? 1 - (s.t - s.life) / 0.12 : 1;
      s.darkMat.opacity = (0.28 + 0.4 * k * k) * fade;
      s.paleMat.opacity = (0.45 + 0.3 * Math.sin(s.t * 22) * 0.5) * fade;
    }
  }

  reset() {
    for (const s of this.pool) { s.active = false; s.dark.visible = s.pale.visible = false; }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The thrown tree (caber) and the thrown axe
// ---------------------------------------------------------------------------------------------------------------

/**
 * One tumbling thing for Caber Toss: a tree about 2.6 m long (trunk, a crown, a root ball) or his big axe, spinning end over
 * end about its middle. A spin that sweeps a 1.3 m circle is what the bolt's 0.9 m radius plus a body really hits.
 */
export class ThrownProp {
  readonly mesh = new THREE.Group();
  private spin = new THREE.Group();
  private caber = new THREE.Group();
  private axe = buildAxe(2.1, 1.2);
  private angle = 0;
  private dirYaw = 0;

  constructor() {
    this.caber.add(cylMesh(0.14, 0.26, 2.6, -1.3, TIMBER.body));
    const root = new THREE.Mesh(cachedGeo('rootBall', () => new THREE.IcosahedronGeometry(0.55, 0)), flatMat(0x6a4426));
    root.position.y = -1.25;
    root.scale.set(1, 0.7, 1);
    this.caber.add(root);
    [[1.15, 0.2, 0.8, 0x2f5a30], [0.9, 0.85, 0.7, 0x3f6b3a], [0.58, 1.3, 0.6, 0x5f9a4a]].forEach(([r, y, h, c]) => {
      this.caber.add(coneMesh(r * 1.08, h * 0.9, y - 0.1, 0x16301a));
      this.caber.add(coneMesh(r, h, y, c));
    });
    this.axe.position.y = -1.05;
    this.spin.add(this.caber, this.axe);
    this.mesh.add(this.spin);
    this.mesh.visible = false;
  }

  /** Shows the tree (`stage` sizes its crown) or the axe. */
  setKind(kind: 'tree' | 'axe', stage: TreeStage = 'full') {
    this.caber.visible = kind === 'tree';
    this.axe.visible = kind === 'axe';
    const s = FALL_SCALE[stage] * 0.4 + 0.6;
    this.caber.scale.set(s, 1, s);
    this.mesh.visible = true;
  }

  /** Puts it at `pos` (a point 1.4 m up is typical), flying along the yaw, `angle` radians through its tumble. */
  place(pos: THREE.Vector3, yaw: number, angle: number) {
    this.mesh.position.copy(pos);
    this.dirYaw = yaw;
    this.angle = angle;
    this.mesh.rotation.y = this.dirYaw;
    this.spin.rotation.set(this.angle, 0, 0);
  }

  hide() {
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Chips: sawdust, leaves and chunks of wood
// ---------------------------------------------------------------------------------------------------------------

export type ChipKind = 'saw' | 'leaf' | 'chunk';
const CHIP_COLORS: Record<ChipKind, number[]> = {
  saw: [TIMBER.pale, TIMBER.hot, TIMBER.core],
  leaf: [0x7fbf55, 0x5f9a4a, 0x3f6b3a],
  chunk: [TIMBER.body, 0x6a4426, TIMBER.hot],
};

/** Tumbling flakes under gravity that lie on the floor a moment and shrink away. One instanced mesh. */
export class Chips {
  readonly mesh: THREE.InstancedMesh;
  private pos: THREE.Vector3[] = [];
  private vel: THREE.Vector3[] = [];
  private rot: THREE.Vector3[] = [];
  private spin: THREE.Vector3[] = [];
  private life: Float32Array;
  private age: Float32Array;
  private size: Float32Array;
  private dummy = new THREE.Object3D();
  private next = 0;
  private live = 0;
  private color = new THREE.Color();

  constructor(private max = 120) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.05, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.mesh.frustumCulled = false;
    this.life = new Float32Array(max);
    this.age = new Float32Array(max).fill(1e3);
    this.size = new Float32Array(max);
    for (let i = 0; i < max; i++) {
      this.pos.push(new THREE.Vector3());
      this.vel.push(new THREE.Vector3());
      this.rot.push(new THREE.Vector3());
      this.spin.push(new THREE.Vector3());
      this.mesh.setColorAt(i, this.color.set(TIMBER.pale));
      this.hideOne(i);
    }
  }

  get busy() {
    return this.live > 0;
  }

  private hideOne(i: number) {
    this.dummy.position.set(0, -50, 0);
    this.dummy.scale.setScalar(MIN);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  /** `n` flakes of a kind from `at`: out at `speed` with a random direction (flat when `up` is small), size relative to 1. */
  burst(at: THREE.Vector3, n: number, speed: number, kind: ChipKind = 'saw', up = 0.7, size = 1, life = 1.3) {
    const cols = CHIP_COLORS[kind];
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.pos[i].copy(at);
      this.vel[i].set(Math.cos(a) * s, (0.3 + Math.random()) * speed * up + 1.2, Math.sin(a) * s);
      this.rot[i].set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.spin[i].set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      this.life[i] = life * (0.7 + Math.random() * 0.6);
      this.age[i] = 0;
      this.size[i] = size * (kind === 'chunk' ? 1.5 : kind === 'leaf' ? 1.1 : 0.8) * (0.7 + Math.random() * 0.7);
      this.mesh.setColorAt(i, this.color.set(cols[k % cols.length]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.hideOne(i); this.mesh.instanceMatrix.needsUpdate = true; continue; }
      live++;
      const p = this.pos[i], v = this.vel[i];
      if (p.y > 0.04) {
        v.y -= 15 * dt;
        p.addScaledVector(v, dt);
        this.rot[i].addScaledVector(this.spin[i], dt);
      }
      if (p.y <= 0.04) { p.y = 0.04; v.multiplyScalar(Math.exp(-8 * dt)); p.x += v.x * dt; p.z += v.z * dt; }
      const left = this.life[i] - this.age[i];
      const k = Math.max(MIN, Math.min(1, left / 0.35));
      this.dummy.position.copy(p);
      this.dummy.rotation.set(p.y > 0.05 ? this.rot[i].x : 0, this.rot[i].y, p.y > 0.05 ? this.rot[i].z : 0);
      this.dummy.scale.setScalar(Math.max(MIN, this.size[i] * k));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.live = live;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    this.age.fill(1e3);
    this.live = 0;
    for (let i = 0; i < this.max; i++) this.hideOne(i);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Birds
// ---------------------------------------------------------------------------------------------------------------

interface Bird {
  g: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  life: number;
  flap: number;
  active: boolean;
}

/**
 * A flock that bursts out of a tree: each bird a dark body with two chunky wings that flap, a pale wing edge, flying out and up
 * on an arc and shrinking away. Wings are about 0.7 m across, so they read at gameplay distance.
 */
export class Birds {
  readonly mesh = new THREE.Group();
  private pool: Bird[] = [];

  constructor(size = 40) {
    const wingGeo = cachedGeo('wing', () => {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0.12); sh.lineTo(0.42, 0.04); sh.lineTo(0.3, -0.2); sh.lineTo(0, -0.12); sh.closePath();
      return new THREE.ShapeGeometry(sh);
    });
    const bodyGeo = cachedGeo('birdBody', () => new THREE.ConeGeometry(0.1, 0.34, 5).rotateX(Math.PI / 2));
    const dark = new THREE.MeshBasicMaterial({ color: 0x24160f, side: THREE.DoubleSide });
    const edge = new THREE.MeshBasicMaterial({ color: TIMBER.pale, side: THREE.DoubleSide });
    for (let i = 0; i < size; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, dark);
      const wingL = new THREE.Mesh(wingGeo, i % 3 === 0 ? edge : dark);
      const wingR = new THREE.Mesh(wingGeo, i % 3 === 0 ? edge : dark);
      wingL.rotation.x = wingR.rotation.x = -Math.PI / 2;
      wingR.scale.x = -1;
      g.add(body, wingL, wingR);
      g.visible = false;
      this.mesh.add(g);
      this.pool.push({ g, wingL, wingR, vel: new THREE.Vector3(), age: 0, life: 2.4, flap: 12, active: false });
    }
  }

  get busy() {
    return this.pool.some((b) => b.active);
  }

  /** `n` birds from `at`, thrown out at about `speed` m/s (they rise as they go). */
  launch(at: THREE.Vector3, n: number, speed = 6) {
    for (let k = 0; k < n; k++) {
      const b = this.pool.find((p) => !p.active);
      if (!b) return;
      const a = Math.random() * Math.PI * 2, s = speed * (0.6 + Math.random() * 0.7);
      b.active = true;
      b.age = 0;
      b.life = 2 + Math.random() * 0.9;
      b.flap = 10 + Math.random() * 6;
      b.vel.set(Math.cos(a) * s, 2.2 + Math.random() * 2.5, Math.sin(a) * s);
      b.g.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2));
      b.g.visible = true;
    }
  }

  update(dt: number) {
    for (const b of this.pool) {
      if (!b.active) continue;
      b.age += dt;
      if (b.age >= b.life) { b.active = false; b.g.visible = false; continue; }
      b.vel.multiplyScalar(Math.exp(-0.5 * dt));
      b.vel.y += 1.6 * dt;
      b.g.position.addScaledVector(b.vel, dt);
      b.g.rotation.y = Math.atan2(b.vel.x, b.vel.z);
      const f = Math.sin(b.age * b.flap * Math.PI) * 0.9;
      b.wingL.rotation.y = f;
      b.wingR.rotation.y = -f;
      const left = b.life - b.age;
      b.g.scale.setScalar(Math.max(MIN, Math.min(1, left / 0.5)) * 1.2);
    }
  }

  reset() {
    for (const b of this.pool) { b.active = false; b.g.visible = false; }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The floating word
// ---------------------------------------------------------------------------------------------------------------

interface Word { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; t: number; life: number; size: number; base: THREE.Vector3; aspect: number; active: boolean }

/**
 * A word floating up from a spot: big outlined letters (cream with a dark outline and a red shadow), popping in with an overshoot,
 * drifting up, wobbling a little and fading in its last quarter. `size` is the letters' height in metres.
 */
export class FloatingWord {
  readonly mesh = new THREE.Group();
  private pool: Word[] = [];

  constructor(size = 3) {
    for (let i = 0; i < size; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 20;
      sprite.visible = false;
      this.mesh.add(sprite);
      this.pool.push({ sprite, mat, canvas, tex, t: 0, life: 1, size: 1, base: new THREE.Vector3(), aspect: 4, active: false });
    }
  }

  get busy() {
    return this.pool.some((w) => w.active);
  }

  show(text: string, at: THREE.Vector3, size: number, life: number) {
    const w = this.pool.find((p) => !p.active) ?? this.pool[0];
    const g = w.canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w.canvas.width, w.canvas.height);
    g.font = '900 170px Impact, "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const cx = w.canvas.width / 2, cy = w.canvas.height / 2 + 6;
    g.strokeStyle = TIMBER_CSS.accent;
    g.lineWidth = 34;
    g.strokeText(text, cx + 7, cy + 9);
    g.strokeStyle = TIMBER_CSS.dark;
    g.lineWidth = 30;
    g.strokeText(text, cx, cy);
    g.fillStyle = TIMBER_CSS.core;
    g.fillText(text, cx, cy);
    // The lower half of the letters is wood-gold, so the word reads as a cut log.
    g.save();
    g.beginPath();
    g.rect(0, cy + 12, w.canvas.width, 200);
    g.clip();
    g.fillStyle = TIMBER_CSS.hot;
    g.fillText(text, cx, cy);
    g.restore();
    w.tex.needsUpdate = true;
    w.active = true;
    w.t = 0;
    w.life = life;
    w.size = size;
    w.aspect = w.canvas.width / w.canvas.height;
    w.base.copy(at);
    w.sprite.visible = true;
  }

  update(dt: number) {
    for (const w of this.pool) {
      if (!w.active) continue;
      w.t += dt;
      if (w.t >= w.life) { w.active = false; w.sprite.visible = false; continue; }
      const k = w.t / w.life;
      const pop = w.t < 0.2 ? 1 + 2.4 * (w.t / 0.2 - 1) ** 3 + 1.4 * (w.t / 0.2 - 1) ** 2 : 1;
      const s = w.size * Math.max(MIN, pop);
      w.sprite.scale.set(s * w.aspect, s, 1);
      w.sprite.position.set(w.base.x, w.base.y + k * 1.4 * w.size * 0.5, w.base.z);
      w.mat.rotation = Math.sin(w.t * 5) * 0.045;
      w.mat.opacity = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    }
  }

  reset() {
    for (const w of this.pool) { w.active = false; w.sprite.visible = false; }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The axe swing and the roots
// ---------------------------------------------------------------------------------------------------------------

/**
 * The swing of a heavy axe over a flat cone: a dark fan with a pale rim that fades quickly, and a bright leading edge that sweeps
 * across its angle. `fire(at, yaw, radius, angleDeg)` once at the hit; the fan is exactly the cone that is hit.
 */
export class Swipe {
  readonly mesh = new THREE.Group();
  private fan: THREE.Mesh;
  private rim: THREE.Mesh;
  private edge: THREE.Mesh;
  private fanMat = new THREE.MeshBasicMaterial({ color: TIMBER.dark, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  private rimMat = new THREE.MeshBasicMaterial({ color: TIMBER.pale, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  private edgeMat = new THREE.MeshBasicMaterial({ color: TIMBER.core, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  private t = 99;
  private life = 0.26;
  private half = 0;

  constructor() {
    this.fan = new THREE.Mesh(new THREE.BufferGeometry(), this.fanMat);
    this.rim = new THREE.Mesh(new THREE.BufferGeometry(), this.rimMat);
    this.edge = new THREE.Mesh(new THREE.BufferGeometry(), this.edgeMat);
    for (const m of [this.fan, this.rim, this.edge]) { m.visible = false; this.mesh.add(m); }
    this.fan.renderOrder = 4;
    this.rim.renderOrder = 5;
    this.edge.renderOrder = 6;
  }

  fire(x: number, z: number, yaw: number, radius: number, angleDeg: number) {
    const half = THREE.MathUtils.degToRad(angleDeg) / 2;
    this.half = half;
    // Ring segments centred on +z: thetaStart is measured from +x, so the segment runs (pi/2 - half) .. (pi/2 + half).
    const seg = (inner: number, outer: number, from: number, len: number) => new THREE.RingGeometry(inner, outer, 28, 1, Math.PI / 2 - from, len).rotateX(Math.PI / 2);
    this.fan.geometry.dispose();
    this.rim.geometry.dispose();
    this.edge.geometry.dispose();
    this.fan.geometry = seg(0.4, radius, half, half * 2);
    this.rim.geometry = seg(radius - 0.25, radius, half, half * 2);
    this.edge.geometry = seg(0.5, radius, 0.1, 0.2);
    for (const m of [this.fan, this.rim, this.edge]) {
      m.visible = true;
      m.position.set(x, 0.9, z);
      m.rotation.y = yaw;
    }
    this.t = 0;
  }

  update(dt: number) {
    if (this.t > this.life) return;
    this.t += dt;
    if (this.t > this.life) { for (const m of [this.fan, this.rim, this.edge]) m.visible = false; return; }
    const k = this.t / this.life;
    this.fanMat.opacity = 0.5 * (1 - k);
    this.rimMat.opacity = 0.9 * (1 - k * k);
    // The leading edge goes from one side of the cone to the other in the first 60% of the swing.
    const sweep = clamp01(k / 0.6);
    this.edge.rotation.y = this.fan.rotation.y + this.half * (1 - 2 * easeOut(sweep)) * -1;
    this.edgeMat.opacity = sweep < 1 ? 0.95 : 0;
  }

  reset() {
    this.t = 99;
    for (const m of [this.fan, this.rim, this.edge]) m.visible = false;
  }
}

/** A ring of brown root spikes that burst out of the ground, hold, and sink: the circle a tree's growth hits. */
export class RootBurst {
  readonly mesh = new THREE.Group();
  private spikes: { m: THREE.Mesh; t: number; delay: number; h: number; active: boolean }[] = [];

  constructor(size = 14) {
    for (let i = 0; i < size; i++) {
      const m = new THREE.Mesh(cachedGeo('rootSpike', () => new THREE.ConeGeometry(0.2, 1, 6).translate(0, 0.5, 0)), flatMat(i % 3 === 0 ? TIMBER.hot : i % 2 ? TIMBER.body : 0x6a4426));
      m.visible = false;
      this.mesh.add(m);
      this.spikes.push({ m, t: 0, delay: 0, h: 1, active: false });
    }
  }

  get busy() {
    return this.spikes.some((s) => s.active);
  }

  fire(x: number, z: number, radius: number) {
    const n = this.spikes.length;
    this.spikes.forEach((s, i) => {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const r = radius * (0.55 + 0.45 * ((i * 7) % 5) / 4);
      s.m.position.set(x + Math.sin(a) * r, 0, z + Math.cos(a) * r);
      s.m.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
      s.h = 0.9 + Math.random() * 0.8;
      s.t = 0;
      s.delay = Math.random() * 0.08;
      s.active = true;
      s.m.visible = true;
      s.m.scale.set(1, MIN, 1);
    });
  }

  update(dt: number) {
    for (const s of this.spikes) {
      if (!s.active) continue;
      s.t += dt;
      const a = s.t - s.delay;
      if (a < 0) continue;
      if (a >= 0.75) { s.active = false; s.m.visible = false; continue; }
      const up = easeOut(a / 0.1);
      const down = a > 0.45 ? 1 - clamp01((a - 0.45) / 0.3) : 1;
      s.m.scale.set(1, Math.max(MIN, s.h * up * down), 1);
    }
  }

  reset() {
    for (const s of this.spikes) { s.active = false; s.m.visible = false; }
  }
}
