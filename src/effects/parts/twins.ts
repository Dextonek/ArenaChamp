import * as THREE from 'three';
import { Clods } from './mole';

/**
 * Twins kit parts (Pim and Pom): two small, bright, cheerful children, so everything is toy-shop: a wooden sword, a slingshot and
 * its pebble, a rope net, a round toy shield, a party popper, confetti, stars and big comic words. Flat toon colours with a dark
 * outline hull under each solid. The big areas stay mid-tone (below about 0.72 of white: the game's bloom turns brighter areas
 * into a white halo); the bright accents `#ffb04a` (Pim) and `#6ac8ff` (Pom) belong to small things, words and the UI.
 *  - `ToyWords`   pooled comic words (BONK, TAG!, MY TURN) that pop, drift up and fade.
 *  - `Confetti`   chunky coloured bits that fall and bounce (`Clods` with a toy palette). `Dust` is `Puffs` of the mole kit.
 *  - `Streaks`    short speed streaks along a heading, in any colour.   `ToyRing` a flat ring on the ground that grows and fades.
 *  - `WoodSword`  Pim's sword, `place(pos, yaw, pitch, roll)`.   `Slingshot` Pom's: `draw(k)` pulls the band back with a pebble.
 *  - `PebbleBolt` the stone in flight.   `RopeNet`   the net of Snare.   `ToyShield` Pim's round shield with a star.
 *  - `TwinPuppet` the twin who rides in the backpack (`kind` 0 Pim, 1 Pom), popping out for a tag.   `Popper` what Backflip leaves.
 */

export const TWINS = {
  pim: 0xffb04a, pom: 0x6ac8ff, pimMid: 0xd98c34, pomMid: 0x3f9fd6, wood: 0xb07a40, woodDark: 0x6b4423, rope: 0xb89a62, stone: 0x8a8478,
  skin: 0xe8b899, glove: 0xe6e2d4, yellow: 0xffd24a, pink: 0xff7aa8, green: 0x7ed87e, dark: 0x1a1424, steel: 0x8fa2b8,
} as const;
export const TWINS_CSS = {
  pim: '#ffb04a', pom: '#6ac8ff', pimMid: '#d98c34', pomMid: '#3f9fd6', wood: '#b07a40', woodDark: '#6b4423', rope: '#b89a62',
  yellow: '#ffd24a', pink: '#ff7aa8', green: '#7ed87e', dark: '#1a1424', steel: '#8fa2b8', skin: '#e8b899',
} as const;
/** The bits of confetti. */
export const CONFETTI = [TWINS.pim, TWINS.pom, TWINS.yellow, TWINS.pink, TWINS.green];

export { Puffs as Dust } from './mole';

const MIN = 1e-4;
/** Sets a position and returns the object. */
const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => { o.position.set(x, y, z); return o; };
const smooth = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const shared: Record<string, THREE.BufferGeometry> = {};
const geo = (key: string, make: () => THREE.BufferGeometry) => (shared[key] ??= make());
const hullMat = () => new THREE.MeshBasicMaterial({ color: TWINS.dark, side: THREE.BackSide });

/** A solid with a dark outline hull behind it (a toon look): returns the group; `k` is how much bigger the hull is. */
export function toon(g: THREE.BufferGeometry, color: number, k = 1.12): THREE.Group {
  const grp = new THREE.Group();
  const hull = new THREE.Mesh(g, hullMat());
  hull.scale.setScalar(k);
  grp.add(hull, new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color })));
  return grp;
}

/** A flat five-point (or `n`-point) star lying in the XY plane, outer radius 1. */
function starGeometry(n = 5, inner = 0.45): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? inner : 1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

// ---------------------------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------------------------

const wordCache = new Map<string, THREE.CanvasTexture>();
function wordTexture(text: string, color: string) {
  const key = `${text}|${color}`;
  let t = wordCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 112;
  const g = c.getContext('2d')!;
  g.font = '900 70px "Trebuchet MS", "Arial Rounded MT Bold", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 16;
  g.strokeStyle = TWINS_CSS.dark;
  g.strokeText(text, 160, 58, 296);
  g.fillStyle = color;
  g.fillText(text, 160, 58, 296);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  wordCache.set(key, t);
  return t;
}

/** Pooled comic words that pop in (a little overshoot), drift up and fade. `say(text, at, size, life, color)`; add `mesh`. */
export class ToyWords {
  readonly mesh = new THREE.Group();
  private items: { s: THREE.Sprite; age: number; life: number; base: number; live: boolean; y: number; tilt: number }[] = [];
  private cursor = 0;

  constructor(max = 5) {
    const first = wordTexture('BONK', TWINS_CSS.yellow);
    for (let i = 0; i < max; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: first, transparent: true, depthTest: false, depthWrite: false }));
      s.visible = false;
      s.renderOrder = 8;
      this.mesh.add(s);
      this.items.push({ s, age: 0, life: 1, base: 1, live: false, y: 1, tilt: 0 });
    }
  }

  /** A word over `at` (feet position), `height` metres up; `size` is its width in metres. */
  say(text: string, at: THREE.Vector3, size = 1.5, life = 0.9, color: string = TWINS_CSS.yellow, height = 1.9) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    it.live = true;
    it.age = 0;
    it.life = life;
    it.base = size;
    it.y = height;
    it.tilt = (Math.random() - 0.5) * 0.3;
    const m = it.s.material as THREE.SpriteMaterial;
    m.map = wordTexture(text, color);
    m.rotation = it.tilt;
    it.s.visible = true;
    it.s.position.set(at.x, height, at.z);
  }

  update(dt: number) {
    for (const it of this.items) {
      if (!it.live) continue;
      it.age += dt;
      if (it.age >= it.life) { it.live = false; it.s.visible = false; continue; }
      const k = it.age / it.life, pop = Math.min(1, it.age / 0.14);
      // Overshoot: 0.5 -> 1.15 -> 1.
      const w = it.base * (pop < 1 ? 0.5 + 0.65 * smooth(pop) : 1.15 - 0.15 * smooth((it.age - 0.14) / 0.12));
      it.s.scale.set(w, w * 0.35, 1);
      it.s.position.y += dt * 0.55;
      (it.s.material as THREE.SpriteMaterial).opacity = 1 - Math.max(0, (k - 0.6) / 0.4);
    }
  }

  reset() {
    for (const it of this.items) { it.live = false; it.s.visible = false; }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Bits: confetti, streaks, rings
// ---------------------------------------------------------------------------------------------------------------

/** Chunky toy confetti: `pop(pos, count, speed, size, colors)` throws bits in every direction; they fall, bounce and shrink away. */
export class Confetti extends Clods {
  pop(pos: THREE.Vector3, count = 10, speed = 4, size = 1, colors: readonly number[] = CONFETTI) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.45 + Math.random() * 0.7);
      this.throw(
        pos, new THREE.Vector3(Math.cos(a) * sp, 2.4 + Math.random() * 3.2, Math.sin(a) * sp),
        (0.1 + Math.random() * 0.1) * size, 0.7 + Math.random() * 0.6, colors[Math.floor(Math.random() * colors.length)],
      );
    }
  }

  /** A fan of bits along a heading. */
  spray(pos: THREE.Vector3, dir: THREE.Vector3, count = 8, speed = 5, spread = 0.6, size = 1, colors: readonly number[] = CONFETTI) {
    const base = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * spread * 2, sp = speed * (0.5 + Math.random() * 0.7);
      this.throw(
        pos, new THREE.Vector3(Math.sin(a) * sp, 1.8 + Math.random() * 2.4, Math.cos(a) * sp),
        (0.1 + Math.random() * 0.1) * size, 0.6 + Math.random() * 0.5, colors[Math.floor(Math.random() * colors.length)],
      );
    }
  }
}

interface Streak { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; len: number; color: THREE.Color }

/** Short speed streaks that fly along a heading and shrink: `burst` a fan from a point, `sweep` along a segment toward its end. */
export class Streaks {
  readonly mesh: THREE.InstancedMesh;
  private items: Streak[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private d = new THREE.Vector3();
  private zero = new THREE.Vector3(0, -50, 0);
  private fwd = new THREE.Vector3(0, 0, 1);

  constructor(private max = 30) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < max; i++) {
      this.items.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.3, len: 1, color: new THREE.Color() });
      this.mesh.setColorAt(i, new THREE.Color(0xffffff));
    }
    this.update(0);
  }

  private add(pos: THREE.Vector3, vel: THREE.Vector3, len: number, life: number, color: number) {
    const k = this.items[this.cursor], i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    k.live = true;
    k.pos.copy(pos);
    k.vel.copy(vel);
    k.age = 0;
    k.life = life;
    k.len = len;
    this.mesh.setColorAt(i, k.color.set(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  burst(pos: THREE.Vector3, dir: THREE.Vector3, count = 6, length = 1.2, color: number = TWINS.yellow, speed = 7, spread = 0.7) {
    const base = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * spread * 2, sp = speed * (0.6 + Math.random() * 0.6);
      this.add(this.d.set(pos.x, pos.y + (Math.random() - 0.5) * 0.5, pos.z), new THREE.Vector3(Math.sin(a) * sp, 0, Math.cos(a) * sp), length * (0.6 + Math.random() * 0.6), 0.28 + Math.random() * 0.15, color);
    }
  }

  sweep(a: THREE.Vector3, b: THREE.Vector3, count = 8, length = 1.4, color: number = TWINS.yellow) {
    const dir = new THREE.Vector3().subVectors(b, a).setY(0);
    const dist = dir.length() || 1;
    dir.multiplyScalar(1 / dist);
    for (let i = 0; i < count; i++) {
      const k = Math.random(), side = (Math.random() - 0.5) * 1.4;
      this.add(
        this.d.set(a.x + dir.x * dist * k - dir.z * side, 0.2 + Math.random() * 1.2, a.z + dir.z * dist * k + dir.x * side),
        new THREE.Vector3(dir.x * 9, 0, dir.z * 9), length * (0.6 + Math.random() * 0.6), 0.25 + Math.random() * 0.15, color,
      );
    }
  }

  reset() {
    for (const k of this.items) k.live = false;
    this.update(0);
  }

  update(dt: number) {
    for (let i = 0; i < this.items.length; i++) {
      const k = this.items[i];
      if (k.live) { k.age += dt; if (k.age >= k.life) k.live = false; }
      if (!k.live) { this.m.compose(this.zero, this.q.identity(), this.s.set(MIN, MIN, MIN)); this.mesh.setMatrixAt(i, this.m); continue; }
      k.pos.addScaledVector(k.vel, dt);
      const sh = 1 - smooth((k.age / k.life - 0.3) / 0.7);
      this.d.copy(k.vel).normalize();
      this.q.setFromUnitVectors(this.fwd, this.d);
      this.mesh.setMatrixAt(i, this.m.compose(k.pos, this.q, this.s.set(0.07, 0.04, Math.max(MIN, k.len * sh))));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** A flat ring on the ground: `set(center, radius, opacity)` each frame (radius 0 or opacity 0 hides it); `color` is its material colour. */
export class ToyRing {
  readonly mesh: THREE.Mesh;

  constructor(color: number = TWINS.yellow, width = 0.1) {
    const g = geo(`ring${width}`, () => new THREE.RingGeometry(1 - width, 1, 44).rotateX(-Math.PI / 2));
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get color(): THREE.Color {
    return (this.mesh.material as THREE.MeshBasicMaterial).color;
  }

  set(center: THREE.Vector3, radius: number, opacity: number) {
    this.mesh.visible = radius > 1e-3 && opacity > 0.01;
    this.mesh.position.set(center.x, 0.07, center.z);
    this.mesh.scale.set(Math.max(radius, MIN), 1, Math.max(radius, MIN));
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------------------------------

/**
 * Pim's wooden sword: a flat plank blade with a round tip, a crossguard, an orange grip and a pommel, about 1.1 m, the grip at the
 * origin and the blade along +Z. `place(pos, yaw, pitch, roll)`: a negative `pitch` raises the tip, a positive one swings it down.
 */
export class WoodSword {
  readonly mesh = new THREE.Group();

  constructor() {
    const part = (g: THREE.BufferGeometry, color: number, x: number, y: number, z: number, k = 1.18) => {
      const o = toon(g, color, k);
      o.position.set(x, y, z);
      this.mesh.add(o);
    };
    part(geo('swBlade', () => new THREE.BoxGeometry(0.14, 0.04, 0.78)), TWINS.wood, 0, 0, 0.5, 1.1);
    part(geo('swTip', () => new THREE.SphereGeometry(0.07, 8, 6)), TWINS.wood, 0, 0, 0.89, 1.15);
    part(geo('swGuard', () => new THREE.BoxGeometry(0.4, 0.06, 0.07)), TWINS.woodDark, 0, 0, 0.09, 1.2);
    part(geo('swGrip', () => new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6).rotateX(Math.PI / 2)), TWINS.pimMid, 0, 0, -0.05, 1.3);
    part(geo('swPommel', () => new THREE.SphereGeometry(0.06, 8, 6)), TWINS.pim, 0, 0, -0.17, 1.2);
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

/** A thin box between two local points. */
function strut(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, w: number) {
  const d = new THREE.Vector3().subVectors(b, a), l = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.multiplyScalar(1 / Math.max(l, MIN)));
  mesh.scale.set(w, w, Math.max(l, MIN));
}

/**
 * Pom's slingshot: a wooden Y held out in front (the grip at the origin, the fork up and forward along +Z) with a rubber band and a
 * pebble in the pouch. `draw(k)`: 0 relaxed, 1 pulled all the way back. `place(pos, yaw)` puts it at her hand.
 */
export class Slingshot {
  readonly mesh = new THREE.Group();
  private inner = new THREE.Group();
  private bandA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: TWINS.pink }));
  private bandB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: TWINS.pink }));
  private pebble = toon(geo('sling-pebble', () => new THREE.SphereGeometry(0.1, 8, 6)), TWINS.stone, 1.2);
  private tipA = new THREE.Vector3(0.17, 0.3, 0.12);
  private tipB = new THREE.Vector3(-0.17, 0.3, 0.12);

  constructor() {
    const wood = (g: THREE.BufferGeometry, x: number, y: number, z: number, rz = 0) => {
      const o = toon(g, TWINS.wood, 1.35);
      o.position.set(x, y, z);
      o.rotation.z = rz;
      this.inner.add(o);
    };
    wood(geo('slHandle', () => new THREE.CylinderGeometry(0.04, 0.045, 0.34, 6)), 0, -0.1, 0);
    wood(geo('slProng', () => new THREE.CylinderGeometry(0.035, 0.04, 0.3, 6)), 0.09, 0.14, 0.06, -0.5);
    wood(geo('slProng', () => new THREE.CylinderGeometry(0.035, 0.04, 0.3, 6)), -0.09, 0.14, 0.06, 0.5);
    this.inner.add(this.bandA, this.bandB, this.pebble);
    this.inner.rotation.x = Math.PI / 2 - 0.2;
    // The fork points up in the model; turn it to point forward (+Z) and a little up.
    this.mesh.add(this.inner);
    this.mesh.visible = false;
    this.draw(0);
  }

  /** The pouch is drawn back along the model's -Y (which is the shooter's side once the fork is turned forward). */
  draw(k: number) {
    const pouch = new THREE.Vector3(0, 0.3 - 0.05 - 0.28 * k, 0.12);
    strut(this.bandA, this.tipA, pouch, 0.025);
    strut(this.bandB, this.tipB, pouch, 0.025);
    this.pebble.position.copy(pouch);
  }

  /** The pebble in the pouch is shown or not (not once it has flown). */
  loaded(on: boolean) {
    this.pebble.visible = on;
  }

  place(pos: THREE.Vector3, yaw: number, shake = 0) {
    this.mesh.visible = true;
    this.mesh.position.copy(pos);
    this.mesh.rotation.set(0, yaw, shake, 'YXZ');
  }

  hide() {
    this.mesh.visible = false;
  }
}

/** The stone in flight: a grey pebble with an outline and a pale glint; `spin(t)` tumbles it. Place it with `mesh.position`. */
export class PebbleBolt {
  readonly mesh = new THREE.Group();

  constructor() {
    this.mesh.add(toon(geo('pebble', () => new THREE.IcosahedronGeometry(0.17, 0)), TWINS.stone, 1.25));
    const glint = new THREE.Mesh(geo('pebbleGlint', () => new THREE.SphereGeometry(0.045, 6, 4)), new THREE.MeshBasicMaterial({ color: 0xcfcab8 }));
    glint.position.set(0.06, 0.08, 0.1);
    this.mesh.add(glint);
    this.mesh.visible = false;
  }

  spin(t: number) {
    this.mesh.rotation.set(t * 11, t * 7, t * 3);
  }
}

/**
 * The net of Snare, radius 1 scaled by `place`: three rope rings, eight spokes and a weight at each spoke's end, lying flat. It falls
 * from above (`place(center, height, scale, opacity)`).
 */
export class RopeNet {
  readonly mesh = new THREE.Group();
  private mats: THREE.MeshBasicMaterial[] = [];
  private shadow: THREE.Mesh;

  constructor() {
    const rope = new THREE.MeshBasicMaterial({ color: TWINS.rope, transparent: true });
    const ball = new THREE.MeshBasicMaterial({ color: TWINS.pomMid, transparent: true });
    const dark = new THREE.MeshBasicMaterial({ color: TWINS.dark, transparent: true });
    this.mats.push(rope, ball, dark);
    for (const r of [0.34, 0.67, 1]) {
      const ring = new THREE.Mesh(geo(`netRing${r}`, () => new THREE.TorusGeometry(r, 0.028, 4, 36).rotateX(Math.PI / 2)), rope);
      this.mesh.add(ring);
    }
    const spoke = geo('netSpoke', () => new THREE.BoxGeometry(0.05, 0.03, 1).translate(0, 0, 0.5));
    const weight = geo('netWeight', () => new THREE.SphereGeometry(0.09, 8, 6));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = new THREE.Mesh(spoke, rope);
      s.rotation.y = a;
      this.mesh.add(s);
      const w = new THREE.Mesh(weight, ball);
      w.position.set(Math.sin(a), 0.02, Math.cos(a));
      const wh = new THREE.Mesh(weight, dark);
      wh.position.copy(w.position);
      wh.scale.setScalar(1.35);
      this.mesh.add(wh, w);
    }
    // A soft dark pool under it so it reads against any floor.
    this.shadow = new THREE.Mesh(geo('netShadow', () => new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2)), dark.clone());
    (this.shadow.material as THREE.MeshBasicMaterial).depthWrite = false;
    this.mesh.add(this.shadow);
    this.mesh.visible = false;
  }

  place(center: THREE.Vector3, height: number, scale: number, opacity: number) {
    this.mesh.visible = opacity > 0.01 && scale > 1e-3;
    this.mesh.position.set(center.x, 0.06 + height, center.z);
    this.mesh.scale.setScalar(Math.max(scale, MIN));
    for (const m of this.mats) m.opacity = opacity;
    // The shadow stays on the floor and grows as the net comes down.
    this.shadow.position.y = -height / Math.max(scale, MIN);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.28 * opacity * (1 - Math.min(1, height / 4));
  }
}

/**
 * Pim's toy shield: a round wooden disc with an orange rim and a yellow star, facing +Z, about 0.9 m across. `place(pos, yaw, scale)`.
 */
export class ToyShield {
  readonly mesh = new THREE.Group();

  constructor() {
    const disc = toon(geo('shDisc', () => new THREE.CylinderGeometry(0.46, 0.46, 0.07, 20).rotateX(Math.PI / 2)), TWINS.pimMid, 1.1);
    const rim = new THREE.Mesh(geo('shRim', () => new THREE.TorusGeometry(0.44, 0.045, 5, 24)), new THREE.MeshBasicMaterial({ color: TWINS.woodDark }));
    const star = new THREE.Mesh(geo('shStar', () => starGeometry(5, 0.45).scale(0.28, 0.28, 1)), new THREE.MeshBasicMaterial({ color: TWINS.yellow, side: THREE.DoubleSide }));
    star.position.z = 0.05;
    rim.position.z = 0.0;
    this.mesh.add(disc, rim, star);
    this.mesh.visible = false;
  }

  place(pos: THREE.Vector3, yaw: number, scale: number, roll = 0) {
    this.mesh.visible = scale > 1e-3;
    this.mesh.position.copy(pos);
    this.mesh.rotation.set(0, yaw, roll, 'YXZ');
    this.mesh.scale.setScalar(Math.max(scale, MIN));
  }

  hide() {
    this.mesh.visible = false;
  }
}

/** A little ball with an outline: gloves, a fuse spark. */
export function ball(color: number, r: number): THREE.Group {
  return toon(new THREE.SphereGeometry(r, 8, 6), color, 1.25);
}

/**
 * The twin who rides in the backpack, built twice (Pim in an orange helmet, Pom in a blue hood), about 0.95 m tall with the feet at
 * y 0. `show(kind)` picks one, `place(pos, yaw, scale)` puts it, `wave(k)` raises the right arm (0 down, 1 straight up, for the
 * high-five), and `hide()` parks it.
 */
export class TwinPuppet {
  readonly mesh = new THREE.Group();
  private kids: THREE.Group[] = [];
  private arms: THREE.Group[] = [];

  constructor() {
    for (const kind of [0, 1]) {
      const mid = kind === 0 ? TWINS.pimMid : TWINS.pomMid;
      const g = new THREE.Group();
      const put = (o: THREE.Object3D, x: number, y: number, z: number) => { o.position.set(x, y, z); g.add(o); return o; };
      put(toon(geo('tpBody', () => new THREE.CapsuleGeometry(0.2, 0.28, 4, 10)), mid, 1.12), 0, 0.42, 0);
      put(toon(geo('tpHead', () => new THREE.SphereGeometry(0.27, 12, 10)), TWINS.skin, 1.1), 0, 0.93, 0);
      if (kind === 0) {
        // Helmet: a dome over the top of the head, a little ridge, a yellow stripe.
        put(toon(geo('tpDome', () => new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), TWINS.pimMid, 1.1), 0, 0.96, 0);
        put(new THREE.Mesh(geo('tpStripe', () => new THREE.BoxGeometry(0.07, 0.04, 0.6)), new THREE.MeshBasicMaterial({ color: TWINS.yellow })), 0, 1.26, 0);
      } else {
        // Hood: a dome that comes down over the ears, a pom-pom on top.
        put(toon(geo('tpHood', () => new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62)), TWINS.pomMid, 1.1), 0, 0.96, -0.02);
        put(ball(TWINS.pom, 0.075), 0, 1.3, 0);
      }
      for (const sx of [-0.1, 0.1]) put(new THREE.Mesh(geo('tpEye', () => new THREE.SphereGeometry(0.033, 6, 5)), new THREE.MeshBasicMaterial({ color: TWINS.dark })), sx, 0.93, 0.25);
      // The smile.
      const smile = new THREE.Mesh(geo('tpSmile', () => new THREE.TorusGeometry(0.06, 0.012, 4, 8, Math.PI)), new THREE.MeshBasicMaterial({ color: TWINS.dark }));
      smile.rotation.z = Math.PI;
      smile.position.set(0, 0.86, 0.255);
      g.add(smile);
      // The right arm (the high-five one): pivots at the shoulder.
      const arm = new THREE.Group();
      arm.position.set(0.26, 0.58, 0);
      const sleeve = toon(geo('tpArm', () => new THREE.CapsuleGeometry(0.06, 0.2, 3, 6).translate(0, 0.14, 0)), mid, 1.2);
      arm.add(sleeve, at(ball(TWINS.glove, 0.085), 0, 0.36, 0));
      g.add(arm);
      this.arms.push(arm);
      put(toon(geo('tpArmL', () => new THREE.CapsuleGeometry(0.06, 0.2, 3, 6)), mid, 1.2), -0.27, 0.42, 0).rotation.z = 0.25;
      g.visible = false;
      this.kids.push(g);
      this.mesh.add(g);
    }
    this.mesh.visible = false;
  }

  show(kind: number) {
    this.kids.forEach((k, i) => { k.visible = i === (kind ? 1 : 0); });
    this.mesh.visible = true;
  }

  place(pos: THREE.Vector3, yaw: number, scale: number) {
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = yaw;
    this.mesh.scale.setScalar(Math.max(scale, MIN));
  }

  /** The right arm's raise: 0 hangs, 1 straight up, with a little wave on top. */
  wave(k: number, t = 0) {
    for (const a of this.arms) a.rotation.z = -(0.2 + k * 2.7) + Math.sin(t * 22) * 0.12 * k;
  }

  /** Where the right hand is, in world space (for the high-five spark). */
  hand(out: THREE.Vector3, kind: number): THREE.Vector3 {
    const arm = this.arms[kind ? 1 : 0];
    this.mesh.updateMatrixWorld(true);
    return arm.localToWorld(out.set(0, 0.36, 0));
  }

  hide() {
    this.mesh.visible = false;
  }
}

/**
 * What Backflip leaves where she stood: a round blue cracker with a yellow band and a lit fuse. `place(pos, scale)`; `blink(t)`
 * flashes the fuse spark faster as it is about to go off.
 */
export class Popper {
  readonly mesh = new THREE.Group();
  private spark = ball(TWINS.yellow, 0.06);

  constructor() {
    this.mesh.add(
      toon(geo('popBall', () => new THREE.SphereGeometry(0.24, 12, 9)), TWINS.pomMid, 1.14),
      at(new THREE.Mesh(geo('popBand', () => new THREE.TorusGeometry(0.235, 0.04, 4, 16).rotateX(Math.PI / 2)), new THREE.MeshBasicMaterial({ color: TWINS.yellow })), 0, 0.02, 0),
      at(new THREE.Mesh(geo('popFuse', () => new THREE.CylinderGeometry(0.014, 0.014, 0.16, 4)), new THREE.MeshBasicMaterial({ color: TWINS.woodDark })), 0, 0.3, 0),
      this.spark,
    );
    this.spark.position.set(0, 0.4, 0);
    this.mesh.visible = false;
  }

  place(pos: THREE.Vector3, scale: number) {
    this.mesh.visible = scale > 1e-3;
    this.mesh.position.set(pos.x, 0.26 * scale, pos.z);
    this.mesh.scale.setScalar(Math.max(scale, MIN));
  }

  blink(t: number, rate: number) {
    this.spark.visible = Math.sin(t * rate) > -0.3;
    this.spark.scale.setScalar(1 + 0.4 * Math.sin(t * rate * 1.7));
  }

  hide() {
    this.mesh.visible = false;
  }
}
