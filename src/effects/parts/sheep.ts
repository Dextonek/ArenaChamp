import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MinionLook, MinionPalette, MinionPose, MinionRig } from './minion';

/**
 * Sheep kit parts (Bo, the angry shepherd): fluffy lumpy wool, a black face and four little black legs, a shepherd's crook of dark
 * wood. The wool is kept mid-tone (about 0.7 of white): the game's bloom turns anything brighter into a white halo, so the cream
 * accent `#f0ead6` belongs to the UI and the words, never to a large area. Pooled or built once:
 *  - `sheepLook`   the `MinionLook` of a summoned sheep (Spare Sheep, the sheep a Crook Whack leaves). It paints the minion's own
 *                  body material as wool and its trim as the black of face and legs, so the arena's hit flash still works. A
 *                  sheared sheep (`shearSheep`) shows a pink, skinny body and trots faster.
 *  - `SheepHerd`   the drawn sheep of a Stampede (they are not summons): one instanced mesh of eight, each bouncing and rocking.
 *  - `Crook`       the crook in Bo's fist: `place` shakes it in fury.
 *  - `BaaWords`    pooled little words (a spawned sheep's *baa*) that float up and fade.
 *  - `WoolBall`    the ball of wool Shear throws; `Tufts`/`Dust` are `Clods`/`Puffs` of the mole kit in wool and dust colours.
 *  - `sheepMarkLook` the little sheep that rides over an enemy who is a sheep (`Trait.markLook`).
 */

export const SHEEP = {
  accent: 0xf0ead6, foil: 0x7a5a3a, wool: 0xb8b2a4, woolShade: 0x9a9486, woolHi: 0xc4beaf, black: 0x1e1a19, skin: 0xd9a89a,
  dust: 0xa89a78, grass: 0x7f8a4a, hay: 0xc9b26a, dark: 0x14110f,
} as const;
export const SHEEP_CSS = {
  accent: '#f0ead6', foil: '#7a5a3a', wool: '#b8b2a4', black: '#1e1a19', skin: '#d9a89a', hay: '#c9b26a', rage: '#e0603a',
} as const;

export { Clods as Tufts, Puffs as Dust } from './mole';

const MIN = 1e-4;
const shared: Record<string, THREE.BufferGeometry> = {};
const geo = (key: string, make: () => THREE.BufferGeometry) => (shared[key] ??= make());

/** Bodies of sheared sheep, by the minion's body material (a pooled figure keeps its material; the look clears it). */
export const shornBodies = new WeakSet<object>();

const LUMPS: [number, number, number, number][] = [
  // x, y, z, radius
  [0.2, 0.55, 0.2, 0.17], [-0.2, 0.55, 0.2, 0.17], [0.23, 0.5, -0.08, 0.18], [-0.23, 0.5, -0.08, 0.18], [0.17, 0.52, -0.3, 0.16],
  [-0.17, 0.52, -0.3, 0.16], [0, 0.7, 0.02, 0.19], [0, 0.64, -0.22, 0.16], [0, 0.62, 0.26, 0.14],
];

/** One sheep as a single vertex-coloured mesh, feet at y 0, facing +Z, about 0.75 m long: the stampede's and the mark's body. */
function sheepGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Matrix4, color: number) => {
    const o = g.clone().applyMatrix4(m).toNonIndexed();
    const c = new THREE.Color(color), n = o.getAttribute('position').count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    o.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    o.deleteAttribute('uv');
    parts.push(o);
  };
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const at = (x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
  add(ico, at(0, 0.42, 0, 0.3, 0.26, 0.4), SHEEP.wool);
  LUMPS.forEach(([x, y, z, r], i) => add(ico, at(x, y, z, r), i % 3 === 0 ? SHEEP.woolShade : SHEEP.wool));
  add(ico, at(0, 0.5, 0.42, 0.11, 0.13, 0.15), SHEEP.black);
  add(ico, at(0, 0.64, 0.36, 0.08), SHEEP.woolHi);
  add(ico, at(0.13, 0.55, 0.37, 0.05, 0.03, 0.08), SHEEP.black);
  add(ico, at(-0.13, 0.55, 0.37, 0.05, 0.03, 0.08), SHEEP.black);
  add(ico, at(0, 0.5, -0.42, 0.07), SHEEP.woolHi);
  const leg = new THREE.CylinderGeometry(0.035, 0.03, 0.24, 5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(leg, at(sx * 0.14, 0.12, sz * 0.2, 1), SHEEP.black);
  const g = mergeGeometries(parts, false)!;
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// The summoned sheep
// ---------------------------------------------------------------------------------------------------------------

/**
 * The look of a summoned sheep (about 0.7 m long, 0.8 m tall with the head). Wool = the minion's body material, set here to a
 * mid-tone (the arena's palette clamp would make it dark grey), face, ears and legs = its trim, set to near black. The hit flash
 * drives both. `shearSheep` (a spell) puts the sheep's body in `shornBodies`: the fleece vanishes, a pink body trots faster.
 */
export const sheepLook: MinionLook = (_kind, p: MinionPalette): MinionRig => {
  p.body.color.setHex(SHEEP.wool);
  p.trim.color.setHex(SHEEP.black);
  p.outline.color.setHex(SHEEP.dark);
  shornBodies.delete(p.body);
  const skin = new THREE.MeshStandardMaterial({ color: SHEEP.skin, roughness: 0.9, flatShading: true });
  const ico = geo('shIco', () => new THREE.IcosahedronGeometry(1, 1));
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    return o;
  };
  const root = new THREE.Group();
  const fleece = new THREE.Group();
  const core = mesh(ico, p.body, 0, 0.42, 0, 0.3, 0.26, 0.4);
  const hull = new THREE.Mesh(ico, p.outline);
  hull.position.copy(core.position);
  hull.scale.set(0.34, 0.3, 0.45);
  fleece.add(hull, core);
  for (const [x, y, z, r] of LUMPS) fleece.add(mesh(ico, p.body, x, y, z, r));
  fleece.add(mesh(ico, p.body, 0, 0.5, -0.42, 0.07));
  const naked = new THREE.Group();
  naked.add(mesh(ico, skin, 0, 0.4, 0, 0.2, 0.2, 0.34), mesh(ico, skin, 0, 0.5, -0.36, 0.05));
  naked.visible = false;
  // The head pivots at the neck: black face, two ears, cream eyes, a woolly forelock.
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.32);
  head.add(mesh(ico, p.trim, 0, 0, 0.1, 0.11, 0.13, 0.15), mesh(ico, p.trim, 0.14, 0.05, 0.05, 0.05, 0.03, 0.09), mesh(ico, p.trim, -0.14, 0.05, 0.05, 0.05, 0.03, 0.09));
  const forelock = mesh(ico, p.body, 0, 0.14, 0.04, 0.08);
  head.add(forelock);
  for (const s of [-1, 1]) {
    const eye = mesh(geo('shEye', () => new THREE.SphereGeometry(1, 6, 5)), p.eye, s * 0.06, 0.04, 0.23, 0.025);
    eye.castShadow = false;
    head.add(eye);
  }
  const legs: THREE.Group[] = [];
  const legGeo = geo('shLeg', () => new THREE.CylinderGeometry(0.035, 0.03, 0.24, 5).translate(0, -0.12, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * 0.14, 0.24, sz * 0.2);
    g.add(mesh(legGeo, p.trim, 0, 0, 0, 1));
    legs.push(g);
    root.add(g);
  }
  root.add(fleece, naked, head);
  let phase = Math.random() * 6;
  return {
    root,
    barY: 0.98,
    animate(dt, pose: MinionPose) {
      const shorn = shornBodies.has(p.body);
      fleece.visible = !shorn;
      naked.visible = shorn;
      const w = pose.walk;
      phase += dt * (6 + 10 * w + (shorn ? 5 : 0));
      const step = Math.sin(phase);
      root.position.y = Math.abs(step) * (0.06 + (shorn ? 0.03 : 0)) * w + Math.sin(pose.time * 2.4 + phase * 0.1) * 0.01;
      legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? step : -step) * 0.7 * w; });
      let push = 0, dip = 0.05 * w;
      if (pose.swing >= 0) {
        // A head-butt: rear back, then ram.
        const s = pose.swing;
        push = s < 0.55 ? -0.08 * (s / 0.55) : -0.08 + ((s - 0.55) / 0.45) * 0.3;
        dip = s < 0.55 ? -0.2 * (s / 0.55) : -0.2 + ((s - 0.55) / 0.45) * 0.7;
      }
      root.position.z = push;
      head.rotation.x = dip;
      forelock.rotation.z = Math.sin(phase * 0.7) * 0.2;
      if (shorn) root.rotation.z = Math.sin(pose.time * 40) * 0.03;
      else root.rotation.z = 0;
    },
    dispose() {
      skin.dispose();
    },
  };
};

// ---------------------------------------------------------------------------------------------------------------
// The stampede's sheep
// ---------------------------------------------------------------------------------------------------------------

/**
 * Pooled drawn sheep (one instanced mesh for the bodies, one for the dark outline). `set(i, x, z, yaw, hop, rock)`: `hop` metres
 * off the ground (the bounce), `rock` a roll in radians; `hide(i)` parks it. Call `update()` once a frame after the `set`s.
 */
export class SheepHerd {
  readonly mesh = new THREE.Group();
  private body: THREE.InstancedMesh;
  private hull: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private zero = new THREE.Vector3(0, -50, 0);

  constructor(readonly count = 8, private size = 1.15) {
    const g = geo('shHerd', sheepGeometry);
    this.body = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }), count);
    this.hull = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: SHEEP.dark, side: THREE.BackSide }), count);
    for (const im of [this.body, this.hull]) { im.frustumCulled = false; this.mesh.add(im); }
    for (let i = 0; i < count; i++) this.hide(i);
    this.update();
  }

  set(i: number, x: number, z: number, yaw: number, hop = 0, rock = 0, scale = 1) {
    this.e.set(Math.abs(rock) * 0.5, yaw, rock, 'YXZ');
    this.q.setFromEuler(this.e);
    this.p.set(x, hop, z);
    const k = this.size * scale;
    this.body.setMatrixAt(i, this.m.compose(this.p, this.q, this.s.set(k, k, k)));
    // The outline is a back-face copy a touch bigger, lifted so it grows round the body and not away from the feet.
    this.hull.setMatrixAt(i, this.m.compose(this.p.set(x, hop - 0.02 * k, z), this.q, this.s.set(k * 1.08, k * 1.08, k * 1.08)));
  }

  hide(i: number) {
    this.m.compose(this.zero, this.q.identity(), this.s.set(MIN, MIN, MIN));
    this.body.setMatrixAt(i, this.m);
    this.hull.setMatrixAt(i, this.m);
  }

  update() {
    this.body.instanceMatrix.needsUpdate = true;
    this.hull.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------------------------------

/**
 * Bo's crook: a long staff of dark wood with a pale curled hook, gripped at its middle (the origin). `place(pos, yaw, pitch, roll)`:
 * `pitch` leans it forward (radians), `roll` tilts it sideways; shaking it is the caller's `roll` wobbling.
 */
export class Crook {
  readonly mesh = new THREE.Group();
  private inner = new THREE.Group();

  constructor() {
    const wood = new THREE.MeshBasicMaterial({ color: SHEEP.foil });
    const dark = new THREE.MeshBasicMaterial({ color: SHEEP.dark, side: THREE.BackSide });
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 6), wood);
    const out = new THREE.Mesh(staff.geometry, dark);
    out.scale.set(1.5, 1.01, 1.5);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.034, 5, 12, Math.PI * 1.25), wood);
    hook.position.set(0.2, 0.95, 0);
    hook.rotation.z = Math.PI * 0.5;
    const hookOut = new THREE.Mesh(hook.geometry, dark);
    hookOut.position.copy(hook.position);
    hookOut.rotation.copy(hook.rotation);
    hookOut.scale.setScalar(1.35);
    this.inner.add(staff, out, hook, hookOut);
    this.inner.position.y = 0.5;
    this.mesh.add(this.inner);
    this.mesh.visible = false;
  }

  place(pos: THREE.Vector3, yaw: number, pitch: number, roll: number) {
    this.mesh.visible = true;
    this.mesh.position.copy(pos);
    this.mesh.rotation.set(pitch, yaw, roll, 'YXZ');
  }

  hide() {
    this.mesh.visible = false;
  }
}

/** The ball of wool Shear throws: a lump of lumps, spinning. Place it with `mesh.position`; `spin` turns it. */
export class WoolBall {
  readonly mesh = new THREE.Group();

  constructor() {
    const g = geo('shIco', () => new THREE.IcosahedronGeometry(1, 1));
    const wool = new THREE.MeshBasicMaterial({ color: SHEEP.wool });
    const shade = new THREE.MeshBasicMaterial({ color: SHEEP.woolShade });
    const dark = new THREE.MeshBasicMaterial({ color: SHEEP.dark, side: THREE.BackSide });
    const core = new THREE.Mesh(g, wool);
    core.scale.setScalar(0.26);
    const outline = new THREE.Mesh(g, dark);
    outline.scale.setScalar(0.37);
    this.mesh.add(outline, core);
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(g, i % 2 ? shade : wool);
      const a = (i / 6) * Math.PI * 2;
      l.position.set(Math.cos(a) * 0.2, Math.sin(a * 2) * 0.15, Math.sin(a) * 0.2);
      l.scale.setScalar(0.14);
      this.mesh.add(l);
    }
    this.mesh.visible = false;
  }

  spin(t: number) {
    this.mesh.rotation.set(t * 9, t * 13, t * 5);
  }
}

let baaTex: THREE.CanvasTexture | undefined;
const wordTexture = (text: string) => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.font = 'italic 800 62px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 12;
  g.strokeStyle = SHEEP_CSS.black;
  g.strokeText(text, 128, 50, 230);
  g.fillStyle = SHEEP_CSS.accent;
  g.fillText(text, 128, 50, 230);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Pooled little words ("baa") that pop up where a sheep appears, drift up and fade. Add `mesh`. */
export class BaaWords {
  readonly mesh = new THREE.Group();
  private items: { s: THREE.Sprite; age: number; life: number; base: number; live: boolean }[] = [];
  private cursor = 0;

  constructor(max = 6) {
    baaTex ??= wordTexture('baa');
    for (let i = 0; i < max; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: baaTex, transparent: true, depthTest: false, depthWrite: false }));
      s.visible = false;
      s.renderOrder = 8;
      this.mesh.add(s);
      this.items.push({ s, age: 0, life: 1, base: 1, live: false });
    }
  }

  /** A word over `at`. `size`: its width in metres. */
  say(at: THREE.Vector3, size = 1.0, life = 1.0) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    it.live = true;
    it.age = 0;
    it.life = life;
    it.base = size;
    it.s.visible = true;
    it.s.position.set(at.x + (Math.random() - 0.5) * 0.4, 1.35, at.z);
  }

  update(dt: number) {
    for (const it of this.items) {
      if (!it.live) continue;
      it.age += dt;
      if (it.age >= it.life) { it.live = false; it.s.visible = false; continue; }
      const k = it.age / it.life, pop = Math.min(1, it.age / 0.12);
      const w = it.base * (0.6 + 0.4 * (1 - (1 - pop) ** 3));
      it.s.scale.set(w, w * 0.375, 1);
      it.s.position.y += dt * 0.7;
      (it.s.material as THREE.SpriteMaterial).opacity = 1 - Math.max(0, (k - 0.55) / 0.45);
    }
  }

  reset() {
    for (const it of this.items) { it.live = false; it.s.visible = false; }
  }
}

/**
 * The mark over an enemy who is a sheep (`Trait.markLook`, feet at y 0): a ring of wool round their feet and a little sheep floating
 * over their head, bobbing. The word BAA is the trait's `enemyLabel`.
 */
export function sheepMarkLook(): THREE.Object3D {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.2, 6, 14).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: SHEEP.wool }),
  );
  ring.position.y = 0.2;
  const ringOut = new THREE.Mesh(ring.geometry, new THREE.MeshBasicMaterial({ color: SHEEP.dark, side: THREE.BackSide }));
  ringOut.position.y = 0.2;
  ringOut.scale.set(1.08, 1.12, 1.08);
  const body = new THREE.Mesh(geo('shHerd', sheepGeometry), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const out = new THREE.Mesh(body.geometry, new THREE.MeshBasicMaterial({ color: SHEEP.dark, side: THREE.BackSide }));
  const holder = new THREE.Group();
  holder.add(out, body);
  out.scale.setScalar(1.08);
  holder.scale.setScalar(0.9);
  holder.position.y = 1.65;
  const start = performance.now();
  // A group is never rendered itself, so the bob hangs on the body mesh.
  body.onBeforeRender = () => {
    const t = (performance.now() - start) / 1000;
    holder.position.y = 1.65 + Math.sin(t * 6) * 0.07;
    holder.rotation.y = Math.sin(t * 3) * 0.5;
  };
  g.add(ringOut, ring, holder);
  return g;
}
