import * as THREE from 'three';

/**
 * The door kit (pipeline/designs/kit-door.md): Wick, the Doorman. Brass, polished dark wood, a red livery with brass buttons, white
 * gloves and a warm light behind every door. `doorLook` = a real upright door in its frame with a warm glow from the crack, a brass
 * number plate on both faces and two keys turning in the air above it (`Trait.markLook`; a pair carries the same number), with
 * a service bell on a post beside it where the door can be hit; `grand` = the wider red double door of the Grand Lobby;
 * `brokenLook` = planks and brass on the floor; `threadLook` = the brass line between a pair; `lobbyRingLook` = the brass ring
 * the Grand Lobby draws on the floor. `KeyFlock` = pooled brass keys, `Flecks` = brass confetti that flies and falls, `Glove` = a
 * white glove, `glowSpill` / `flatRing` = floor light and rings. Everything takes world-space positions, has `reset()` where it holds
 * state, and keeps every colour under the bloom threshold.
 */

export const DOOR = {
  core: 0xffffff,
  hot: 0xe6c984,
  brass: 0xb08a4a,
  shade: 0x7a5c2c,
  glow: 0xffcf7a,
  wood: 0x5a3321,
  woodLt: 0x7a4a2c,
  woodDk: 0x2c1a10,
  ink: 0x120a06,
  red: 0x6a2a2a,
  redLt: 0x8c3a38,
  glove: 0xf0ebdd,
  foil: 0x6a2a2a,
} as const;

export const DOOR_CSS = {
  core: '#ffffff',
  hot: '#e6c984',
  brass: '#b08a4a',
  shade: '#7a5c2c',
  glow: '#ffcf7a',
  wood: '#5a3321',
  woodLt: '#7a4a2c',
  woodDk: '#2c1a10',
  ink: '#120a06',
  red: '#6a2a2a',
  redLt: '#8c3a38',
  glove: '#f0ebdd',
  foil: '#6a2a2a',
} as const;

/** Measures (m): the clear opening and the height of a door, and a Grand Lobby door's; where the service bell (and the unit that takes the hits) stands. */
export const DOOR_OPEN = 1.0;
export const DOOR_HEIGHT = 2.5;
export const LOBBY_OPEN = 2.0;
export const LOBBY_HEIGHT = 2.8;
export const BELL_X = 1.15;
export const BELL_TOP = 1.05;

const MIN_SCALE = 1e-4;

// ---------------------------------------------------------------------------------------------------------------
// Small shared things: materials, textures.
// ---------------------------------------------------------------------------------------------------------------

const mats = new Map<string, THREE.Material>();
function flatMat(color: number) {
  const k = `f${color}`;
  let m = mats.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color }); mats.set(k, m); }
  return m;
}
function inkBack() {
  let m = mats.get('ink');
  if (!m) { m = new THREE.MeshBasicMaterial({ color: DOOR.ink, side: THREE.BackSide }); mats.set('ink', m); }
  return m;
}

/** Adds `geo` in `color` at (x,y,z) to `parent`, with a dark back-face outline `k` times bigger (0: none). */
function solid(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, k = 1.14) {
  if (k > 0) {
    const o = new THREE.Mesh(geo, inkBack());
    o.position.set(x, y, z);
    o.scale.setScalar(k);
    o.frustumCulled = false;
    parent.add(o);
  }
  const m = new THREE.Mesh(geo, flatMat(color));
  m.position.set(x, y, z);
  m.frustumCulled = false;
  parent.add(m);
  return m;
}

const plates = new Map<number, THREE.CanvasTexture>();
/** A brass number plate: a dark rim, a brass face, the number in dark wood. */
function plateTexture(num: number) {
  let t = plates.get(num);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = DOOR_CSS.ink;
  g.fillRect(0, 0, 128, 128);
  const gr = g.createLinearGradient(0, 0, 128, 128);
  gr.addColorStop(0, DOOR_CSS.hot);
  gr.addColorStop(0.5, DOOR_CSS.brass);
  gr.addColorStop(1, DOOR_CSS.shade);
  g.fillStyle = gr;
  g.fillRect(8, 8, 112, 112);
  g.strokeStyle = DOOR_CSS.woodDk;
  g.lineWidth = 3;
  g.strokeRect(14, 14, 100, 100);
  g.fillStyle = DOOR_CSS.woodDk;
  g.font = 'bold 84px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(num), 64, 68);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  plates.set(num, t);
  return t;
}

let glowTex: THREE.CanvasTexture | null = null;
/** What stands behind the door: a warm room, brighter low down. */
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 100, 4, 32, 100, 96);
  r.addColorStop(0, '#ffe6a8');
  r.addColorStop(0.4, '#f0b45c');
  r.addColorStop(1, '#8a4f1c');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

let spillTex: THREE.CanvasTexture | null = null;
/** A soft warm pool of light for the floor (white at the door, clear at the edge). */
function spillTexture() {
  if (spillTex) return spillTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 0, 2, 32, 0, 62);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  spillTex = new THREE.CanvasTexture(c);
  return spillTex;
}

/** A pool of warm light on the floor in front of (`side` 1) or behind (-1) a door at the origin, `w` wide, `d` deep. */
export function glowSpill(w: number, d: number, opacity: number, side = 1): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(0, 0.035, side * d * 0.5),
    new THREE.MeshBasicMaterial({ map: spillTexture(), color: DOOR.glow, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  m.renderOrder = 2;
  m.frustumCulled = false;
  return m;
}

/** A flat ring on the floor: `radius` out to `radius - width`. */
export function flatRing(radius: number, width: number, color: number, opacity: number) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.01, radius - width), radius, 64).rotateX(-Math.PI / 2), mat);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return { mesh, mat };
}

// ---------------------------------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------------------------------

/** One brass key along +z, `len` long: a round bow at the back, a shaft, a two-toothed bit. It turns about its own length. */
export function buildKey(len = 0.5): THREE.Group {
  const g = new THREE.Group();
  const bow = new THREE.TorusGeometry(len * 0.17, len * 0.05, 6, 14);
  solid(g, bow, DOOR.hot, 0, 0, -len * 0.4, 1.25);
  solid(g, new THREE.CylinderGeometry(len * 0.03, len * 0.03, len * 0.7, 6).rotateX(Math.PI / 2), DOOR.brass, 0, 0, len * 0.05, 1.6);
  const tooth = new THREE.BoxGeometry(len * 0.16, len * 0.07, len * 0.08);
  solid(g, tooth, DOOR.hot, len * 0.08, 0, len * 0.38, 1.3);
  solid(g, tooth, DOOR.brass, len * 0.08, 0, len * 0.25, 1.3);
  for (const c of g.children) c.frustumCulled = false;
  return g;
}

/** Pooled brass keys: `show(i, pos, yaw, roll, scale)` puts one up (its length along `yaw`, turned `roll` about it), `hide(i)`. Add `group`. */
export class KeyFlock {
  readonly group = new THREE.Group();
  private keys: THREE.Group[] = [];

  constructor(count = 4, len = 0.5) {
    for (let i = 0; i < count; i++) {
      const k = buildKey(len);
      k.visible = false;
      this.keys.push(k);
      this.group.add(k);
    }
  }

  get size() {
    return this.keys.length;
  }

  show(i: number, pos: THREE.Vector3, yaw: number, roll: number, scale = 1) {
    const k = this.keys[i];
    k.visible = scale > MIN_SCALE;
    k.position.copy(pos);
    k.rotation.set(0, yaw, 0, 'YXZ');
    k.rotateZ(roll);
    k.scale.setScalar(Math.max(scale, MIN_SCALE));
  }

  /** Tips key `i` end over end instead (a key thrown up and falling): `pitch` about the sideways axis. */
  tumble(i: number, pos: THREE.Vector3, yaw: number, pitch: number, scale = 1) {
    const k = this.keys[i];
    k.visible = scale > MIN_SCALE;
    k.position.copy(pos);
    k.rotation.set(pitch, yaw, 0, 'YXZ');
    k.scale.setScalar(Math.max(scale, MIN_SCALE));
  }

  hide(i: number) {
    this.keys[i].visible = false;
  }

  reset() {
    for (const k of this.keys) k.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Flecks: brass confetti.
// ---------------------------------------------------------------------------------------------------------------

interface Fleck { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; spin: number; color: THREE.Color }
const FLECK_COLORS = [0xe6c984, 0xb08a4a, 0xf0ebdd, 0xb08a4a, 0x8c3a38];

/**
 * Small brass diamonds, white glove flecks and a few red ones, that fly out and fall. `burst(pos, count, speed, size, up)` (keep it to a
 * handful at a time). Pooled (`max`). Add `mesh`.
 */
export class Flecks {
  readonly mesh: THREE.InstancedMesh;
  frozen = false;
  private flecks: Fleck[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private e = new THREE.Euler();

  constructor(private max = 80) {
    const geo = new THREE.OctahedronGeometry(1).scale(1, 1.5, 0.6);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) {
      this.flecks.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.5, size: 0.1, spin: 0, color: new THREE.Color() });
      this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
  }

  get busy() {
    return this.flecks.some((f) => f.live);
  }

  burst(pos: THREE.Vector3, count = 6, speed = 3, size = 1, up = 0.4) {
    for (let i = 0; i < count; i++) {
      const f = this.flecks[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      f.live = true;
      f.pos.copy(pos);
      const a = Math.random() * Math.PI * 2, u = up + Math.random() * 0.8, sp = speed * (0.4 + Math.random() * 0.8);
      f.vel.set(Math.cos(a), u, Math.sin(a)).normalize().multiplyScalar(sp);
      f.age = 0;
      f.life = 0.35 + Math.random() * 0.45;
      f.size = (0.045 + Math.random() * 0.05) * size;
      f.spin = Math.random() * 6.28;
      f.color.set(FLECK_COLORS[Math.floor(Math.random() * FLECK_COLORS.length)]);
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
    for (const f of this.flecks) {
      if (!f.live) continue;
      f.age += dd;
      if (f.age >= f.life) { f.live = false; continue; }
      f.vel.multiplyScalar(Math.max(0, 1 - 2.2 * dd));
      f.vel.y -= 6 * dd;
      f.pos.addScaledVector(f.vel, dd);
      if (f.pos.y < 0.05) { f.pos.y = 0.05; f.vel.y = 0; }
      const u = f.age / f.life, k = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
      this.e.set(f.spin + f.age * 6, f.spin * 2 + f.age * 4, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(f.pos, this.q, this.s.setScalar(Math.max(f.size * k, MIN_SCALE)));
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, f.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Glove: a white glove with a red cuff.
// ---------------------------------------------------------------------------------------------------------------

/** A small white glove (pointing +z) with a dark outline and a red cuff, for the hands that hold a key. `place(pos, yaw, scale)`, `hide()`. Add `group`. */
export class Glove {
  readonly group = new THREE.Group();

  constructor() {
    const inner = new THREE.Group();
    solid(inner, new THREE.SphereGeometry(0.1, 10, 8), DOOR.glove, 0, 0, 0, 1.22);
    for (let i = 0; i < 3; i++) solid(inner, new THREE.SphereGeometry(0.048, 8, 6), DOOR.glove, (i - 1) * 0.06, 0.02, 0.105, 1.3);
    solid(inner, new THREE.SphereGeometry(0.045, 8, 6), DOOR.glove, 0.1, -0.02, 0.04, 1.3);
    solid(inner, new THREE.CylinderGeometry(0.085, 0.085, 0.07, 10).rotateX(Math.PI / 2), DOOR.red, 0, 0, -0.1, 1.2);
    this.group.add(inner);
    this.group.visible = false;
  }

  place(pos: THREE.Vector3, yaw: number, scale = 1) {
    this.group.visible = scale > MIN_SCALE;
    this.group.position.copy(pos);
    this.group.rotation.set(0, yaw, 0);
    this.group.scale.setScalar(Math.max(scale, MIN_SCALE));
  }

  hide() {
    this.group.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The door itself (Trait.markLook).
// ---------------------------------------------------------------------------------------------------------------

export interface DoorLookOptions {
  /** The brass number on both faces (a pair has the same one); none on a Grand Lobby door. */
  num?: number;
  /** 0..1: how warm the light behind the door and on the floor is (a door still waiting for its pair is dim). */
  glow?: number;
  /** The wide red double door of the Grand Lobby. */
  grand?: boolean;
  /** A service bell on a post beside it: the part a hit finds (a pair's doors, not the lobby's). */
  bell?: boolean;
}

/** Spins a door's keys and bobs them: attached to the first key's first mesh (a group is not asked to render). */
function keepKeys(keys: THREE.Group[], phase: number) {
  const first = keys[0].children[0] as THREE.Mesh;
  first.onBeforeRender = () => {
    const t = performance.now() / 1000;
    keys.forEach((k, i) => {
      const a = t * 0.9 + phase + (i / keys.length) * Math.PI * 2;
      k.position.set(Math.cos(a) * 0.55, 0.0 + Math.sin(t * 1.7 + i * 2.1 + phase) * 0.06, Math.sin(a) * 0.3);
      k.rotation.set(0, a + Math.PI / 2, 0, 'YXZ');
      k.rotateZ(t * 3.2 + i * 1.7);
    });
  };
}

/**
 * A real upright door in its frame, standing on the floor and facing +z (and, as it is the same on the back, readable from the
 * other camera): dark wood posts with brass strips, a brass cornice with a finial, a leaf of polished panels hung ajar so that warm
 * light shows from the crack and pools on the floor, a brass handle, a brass number plate on both faces, two keys turning above it,
 * and (`bell`) a service bell on a post at `BELL_X`. Feet at y 0.
 */
export function doorLook(o: DoorLookOptions = {}): THREE.Object3D {
  const grand = !!o.grand, glow = THREE.MathUtils.clamp(o.glow ?? 1, 0, 1);
  const open = grand ? LOBBY_OPEN : DOOR_OPEN, H = grand ? LOBBY_HEIGHT : DOOR_HEIGHT;
  const root = new THREE.Group();

  // The floor: a dark pool under the frame, a brass sill, warm light in front and behind.
  const shade = new THREE.Mesh(
    new THREE.CircleGeometry(open * 0.95, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: DOOR.ink, transparent: true, opacity: 0.34, depthWrite: false }),
  );
  shade.position.y = 0.03;
  shade.renderOrder = 1;
  shade.frustumCulled = false;
  root.add(shade);
  root.add(glowSpill(open * 1.7, 1.9, 0.5 * glow, 1), glowSpill(open * 1.3, 1.1, 0.25 * glow, -1));
  solid(root, new THREE.BoxGeometry(open + 0.5, 0.05, 0.42), DOOR.brass, 0, 0.025, 0, 1.0);

  // The warm room behind: a pane in the opening, dimmed when the door waits for its pair.
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(open, H - 0.22),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color().setScalar(0.4 + 0.6 * glow), side: THREE.DoubleSide }),
  );
  back.position.set(0, (H - 0.22) / 2 + 0.05, -0.03);
  back.frustumCulled = false;
  root.add(back);

  // The frame: two posts with a brass strip on the inner edge, a lintel, a brass cornice and a finial.
  const postX = open / 2 + 0.09;
  for (const sx of [-1, 1]) {
    solid(root, new THREE.BoxGeometry(0.18, H, 0.26), DOOR.woodDk, sx * postX, H / 2, 0);
    solid(root, new THREE.BoxGeometry(0.03, H - 0.2, 0.28), DOOR.brass, sx * (open / 2 + 0.005), (H - 0.2) / 2 + 0.05, 0, 0);
  }
  solid(root, new THREE.BoxGeometry(open + 0.4, 0.2, 0.28), DOOR.woodDk, 0, H - 0.1, 0);
  solid(root, new THREE.BoxGeometry(open + 0.56, 0.08, 0.34), DOOR.brass, 0, H + 0.04, 0, 1.2);
  solid(root, new THREE.SphereGeometry(0.075, 8, 6), DOOR.hot, 0, H + 0.14, 0, 1.3);
  if (grand) {
    for (const sx of [-1, 1]) solid(root, new THREE.SphereGeometry(0.06, 8, 6), DOOR.hot, sx * (open / 2 + 0.09), H + 0.1, 0, 1.3);
  }

  // The leaf (or two): hung ajar on its hinge, so a gap of warm light shows at the free edge. Panels on both faces.
  const leafH = H - 0.3, leafColor = grand ? DOOR.red : DOOR.wood, panelColor = grand ? DOOR.redLt : DOOR.woodLt;
  const leafW = grand ? open / 2 - 0.01 : open - 0.02, swing = grand ? 0.36 : 0.5;
  const leaves = grand ? [-1, 1] : [-1];
  for (const side of leaves) {
    const hinge = new THREE.Group();
    hinge.position.set(side * (open / 2 - 0.005), 0.05, 0.02);
    hinge.rotation.y = side * swing;
    const dir = -side; // the leaf runs from its hinge toward the middle (or toward +x for the single leaf)
    solid(hinge, new THREE.BoxGeometry(leafW, leafH, 0.07), leafColor, dir * leafW / 2, leafH / 2, 0, 1.0);
    for (const face of [-1, 1]) {
      for (const cx of [0.27, 0.73]) {
        solid(hinge, new THREE.BoxGeometry(leafW * 0.38, leafH * 0.3, 0.02), panelColor, dir * leafW * cx, leafH * 0.26, face * 0.045, 0);
        if (grand || cx < 0.5 || !o.num) solid(hinge, new THREE.BoxGeometry(leafW * 0.38, leafH * 0.3, 0.02), panelColor, dir * leafW * cx, leafH * 0.64, face * 0.045, 0);
      }
      // The handle: a brass bar and knob at the free edge.
      solid(hinge, new THREE.SphereGeometry(0.06, 8, 6), DOOR.hot, dir * (leafW - 0.12), leafH * 0.44, face * 0.1, 1.25);
      solid(hinge, new THREE.BoxGeometry(0.1, 0.05, 0.03), DOOR.brass, dir * (leafW - 0.12), leafH * 0.44 - 0.12, face * 0.06, 1.2);
      if (o.num !== undefined && !grand) {
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: plateTexture(o.num) }));
        plate.position.set(dir * leafW * 0.62, leafH * 0.7, face * 0.062);
        if (face < 0) plate.rotation.y = Math.PI;
        plate.frustumCulled = false;
        plate.renderOrder = 3;
        hinge.add(plate);
      }
    }
    if (grand) {
      // A brass crest on each leaf: a diamond and a ring.
      for (const face of [-1, 1]) {
        solid(hinge, new THREE.OctahedronGeometry(0.17).scale(0.8, 1.2, 0.2), DOOR.hot, dir * leafW * 0.5, leafH * 0.66, face * 0.075, 1.15);
        solid(hinge, new THREE.TorusGeometry(0.09, 0.025, 6, 12), DOOR.brass, dir * leafW * 0.5, leafH * 0.66, face * 0.09, 1.3);
      }
    }
    root.add(hinge);
  }

  // Two keys turning in the air above it.
  const keys: THREE.Group[] = [];
  const keyPivot = new THREE.Group();
  keyPivot.position.set(0, H + 0.62, 0);
  for (let i = 0; i < 2; i++) {
    const k = buildKey(grand ? 0.46 : 0.4);
    keys.push(k);
    keyPivot.add(k);
  }
  keepKeys(keys, grand ? 1.3 : 0);
  root.add(keyPivot);

  if (o.bell) {
    // A service bell on a short post: it is what a hit finds, and where the 40 HP bar stands.
    const bell = new THREE.Group();
    bell.position.set(BELL_X, 0, 0);
    solid(bell, new THREE.CylinderGeometry(0.2, 0.24, 0.07, 14), DOOR.woodDk, 0, 0.035, 0, 1.0);
    solid(bell, new THREE.CylinderGeometry(0.05, 0.07, 0.5, 8), DOOR.wood, 0, 0.3, 0, 1.15);
    solid(bell, new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), DOOR.brass, 0, 0.58, 0, 1.12);
    solid(bell, new THREE.TorusGeometry(0.22, 0.03, 6, 16).rotateX(Math.PI / 2), DOOR.hot, 0, 0.58, 0, 1.1);
    solid(bell, new THREE.SphereGeometry(0.05, 8, 6), DOOR.hot, 0, 0.82, 0, 1.3);
    solid(bell, new THREE.BoxGeometry(0.12, 0.04, 0.04), DOOR.red, 0.1, 0.9, 0, 1.2);
    root.add(bell);
  }
  return root;
}

/** The look of a pair's door: its number, and whether the other half stands (the glow). */
export const pairDoorLook = (num: number, paired: boolean) => () => doorLook({ num, glow: paired ? 1 : 0.35, bell: true });

/** The red double door of the Grand Lobby. */
export const grandDoorLook = () => doorLook({ grand: true, glow: 1 });

/** A door that broke: planks, brass bits and the bell on its side, on the floor (the mark system shrinks it away). */
export function brokenLook(): THREE.Object3D {
  const root = new THREE.Group();
  const wobble = (i: number) => Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 4.1414) * 0.5;
  for (let i = 0; i < 7; i++) {
    const m = solid(root, new THREE.BoxGeometry(0.1 + Math.abs(wobble(i)) * 0.06, 0.04, 0.5 + Math.abs(wobble(i + 3)) * 0.4), i % 3 === 2 ? DOOR.woodLt : DOOR.wood, wobble(i + 1) * 0.55, 0.04 + (i % 2) * 0.04, wobble(i + 6) * 0.3, 1.2);
    m.rotation.y = wobble(i + 8) * 1.6;
  }
  for (let i = 0; i < 8; i++) {
    const m = solid(root, new THREE.OctahedronGeometry(0.05), i % 2 ? DOOR.hot : DOOR.brass, wobble(i + 11) * 0.7, 0.06, wobble(i + 4) * 0.45, 1.3);
    m.scale.set(1, 0.6, 1.4);
    m.rotation.y = i;
  }
  solid(root, new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.56), DOOR.brass, 0.45, 0.2, 0.3, 1.12).rotation.z = 1.5;
  return root;
}

/** The brass thread between the two doors of a pair, on the floor (`length` stretches it along z). */
export function threadLook(): THREE.Object3D {
  const root = new THREE.Group();
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const strip = (w: number, len: number, z: number, color: number, opacity: number, y: number, order: number) => {
    const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.scale.set(w, 1, len);
    m.position.set(0, y, z);
    m.renderOrder = order;
    m.frustumCulled = false;
    return m;
  };
  root.add(strip(0.2, 1, 0, DOOR.ink, 0.2, 0.03, 2));
  root.add(strip(0.045, 1, 0, DOOR.brass, 0.55, 0.04, 3));
  // Dashes of brighter brass along it, stretched with the length.
  for (let i = 0; i < 5; i++) root.add(strip(0.07, 0.06, -0.5 + (i + 0.5) / 5, DOOR.hot, 0.7, 0.045, 4));
  return root;
}

/** The Grand Lobby's floor ring: a dark band, a brass ring and a tick at each of the four doors. Radius `r`. */
export function lobbyRingLook(r: number, doors: number): THREE.Object3D {
  const root = new THREE.Group();
  const under = flatRing(r + 0.14, 0.34, DOOR.ink, 0.3);
  const band = flatRing(r + 0.04, 0.08, DOOR.brass, 0.75);
  const inner = flatRing(r - 1.1, 0.04, DOOR.hot, 0.35);
  under.mesh.position.y = 0.03;
  band.mesh.position.y = 0.045;
  inner.mesh.position.y = 0.045;
  band.mesh.renderOrder = 3;
  inner.mesh.renderOrder = 3;
  root.add(under.mesh, band.mesh, inner.mesh);
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (let i = 0; i < doors * 3; i++) {
    const a = (i / (doors * 3)) * Math.PI * 2 + Math.PI / 4;
    const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ color: DOOR.hot, transparent: true, opacity: 0.7, depthWrite: false }));
    m.scale.set(0.1, 1, 0.34);
    m.position.set(Math.sin(a) * r, 0.05, Math.cos(a) * r);
    m.rotation.y = a;
    m.renderOrder = 4;
    m.frustumCulled = false;
    root.add(m);
  }
  return root;
}

/** Where a point on a door's face is, for effects that draw round a door: the middle of its opening. */
export const doorMid = (x: number, z: number, height = DOOR_HEIGHT * 0.45, out = new THREE.Vector3()) => out.set(x, height, z);
