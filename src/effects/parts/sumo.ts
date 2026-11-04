import * as THREE from 'three';

/**
 * The sumo kit (pipeline/designs/kit-sumo.md): Big Yoko. Straw rope and raked sand, a red belt, warm skin, white salt and pale
 * dust. `dohyoLook` = the ring on the floor (a straw rope twisted round it, a pale line inside, a red outer band): the look of
 * `Trait.markLook`; `Puffs` = pooled dust clouds; `Cracks` = jagged cracks that run out across the floor, red light in them;
 * `SaltGrains` = pooled white crystals thrown in an arc that lie on the floor and glitter; `Palm` = a big open hand;
 * `Ripple` = a flat ring that runs out over the floor. Everything is pooled or built once, takes world-space positions, has
 * `reset()` where it holds state, and stays under the bloom threshold (no colour above 0.92).
 */

/** Palette. Numbers for `THREE.Color`, `SUMO_CSS` for APIs that want a string. `accent` is the red belt, `core` the pale foil. */
export const SUMO = {
  core: 0xf4ead0,
  hot: 0xfff8ea,
  body: 0xe63a3a,
  shade: 0xa42626,
  rope: 0xd2ac5a,
  ropeDark: 0x8a6a2c,
  sand: 0xdcc58f,
  skin: 0xe6b08a,
  skinShade: 0xb97a56,
  dust: 0xcdbb98,
  dark: 0x1e1412,
  accent: 0xe63a3a,
} as const;

export const SUMO_CSS = {
  core: '#f4ead0',
  hot: '#fff8ea',
  body: '#e63a3a',
  shade: '#a42626',
  rope: '#d2ac5a',
  ropeDark: '#8a6a2c',
  sand: '#dcc58f',
  skin: '#e6b08a',
  skinShade: '#b97a56',
  dust: '#cdbb98',
  dark: '#1e1412',
  accent: '#e63a3a',
} as const;

const MIN = 1e-4;
const flatMat = (color: number, opacity = 1, side: THREE.Side = THREE.DoubleSide) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, side });

// ---------------------------------------------------------------------------------------------------------------
// The ring
// ---------------------------------------------------------------------------------------------------------------

/**
 * The dohyo on the floor: `radius` is where the rope lies, the real edge. A raked-sand disc, a dark band under the rope so it
 * reads on any floor, a rope of twisted straw bales (a capsule every 0.3 m, rolled alternately, two shades), a pale line just
 * inside it, a red band outside, four red cords tied round the rope and the two white start lines in the middle.
 */
export function dohyoLook(radius: number): THREE.Group {
  const g = new THREE.Group();
  const disc = (inner: number, outer: number, color: number, opacity: number, y: number) => {
    const m = new THREE.Mesh(
      inner > 0 ? new THREE.RingGeometry(inner, outer, 72).rotateX(-Math.PI / 2) : new THREE.CircleGeometry(outer, 72).rotateX(-Math.PI / 2),
      flatMat(color, opacity),
    );
    m.position.y = y;
    m.renderOrder = 1;
    g.add(m);
  };
  disc(0, radius, SUMO.sand, 0.5, 0.01);
  disc(radius - 0.58, radius - 0.42, SUMO.hot, 0.9, 0.02);
  disc(radius - 0.22, radius + 0.32, SUMO.dark, 0.5, 0.02);
  disc(radius + 0.3, radius + 0.58, SUMO.body, 0.45, 0.02);

  // The rope.
  const n = Math.max(12, Math.round((Math.PI * 2 * radius) / 0.3));
  const bale = new THREE.CapsuleGeometry(0.14, 0.3, 3, 8).rotateZ(Math.PI / 2);
  const rope = new THREE.InstancedMesh(bale, new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
  rope.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const straw = new THREE.Color(SUMO.rope), dark = new THREE.Color(SUMO.ropeDark);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * radius, 0.15, Math.sin(a) * radius);
    dummy.rotation.set(i % 2 ? 0.55 : -0.55, -a - Math.PI / 2, 0, 'YXZ');
    dummy.scale.set(1.05, 1, 1);
    dummy.updateMatrix();
    rope.setMatrixAt(i, dummy.matrix);
    rope.setColorAt(i, i % 2 ? straw : dark);
  }
  g.add(rope);
  // Four red cords tied round the rope.
  const cord = new THREE.BoxGeometry(0.1, 0.34, 0.5);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const c = new THREE.Mesh(cord, new THREE.MeshBasicMaterial({ color: SUMO.body }));
    c.position.set(Math.cos(a) * radius, 0.16, Math.sin(a) * radius);
    c.rotation.y = -a;
    g.add(c);
  }
  // The start lines.
  const line = new THREE.BoxGeometry(1.1, 0.02, 0.09);
  for (const z of [-0.35, 0.35]) {
    const l = new THREE.Mesh(line, new THREE.MeshBasicMaterial({ color: SUMO.hot }));
    l.position.set(0, 0.03, z);
    g.add(l);
  }
  g.visible = false;
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Dust
// ---------------------------------------------------------------------------------------------------------------

interface Puff { m: THREE.Mesh; v: THREE.Vector3; age: number; life: number; size: number }

/** Pooled dust clouds: pale low puffs that roll out over the floor, swell and fade. */
export class Puffs {
  readonly mesh = new THREE.Group();
  private items: Puff[] = [];
  private next = 0;

  constructor(count: number) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SUMO.dust, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      this.mesh.add(m);
      this.items.push({ m, v: new THREE.Vector3(), age: 9, life: 1, size: 1 });
    }
  }

  get busy() {
    return this.items.some((p) => p.age < p.life);
  }

  /** `n` puffs from `at`, rolling outward at about `speed` m/s inside the arc of width `spread` around `yaw` (all round: 2π), `size` m. */
  burst(at: THREE.Vector3, n: number, speed: number, size: number, up = 0.5, spread = Math.PI * 2, yaw = 0) {
    for (let i = 0; i < n; i++) {
      const p = this.items[this.next++ % this.items.length];
      const a = yaw + (Math.random() - 0.5) * spread, s = speed * (0.55 + Math.random() * 0.6);
      p.v.set(Math.sin(a) * s, up * (0.6 + Math.random() * 0.8), Math.cos(a) * s);
      p.m.position.set(at.x, Math.max(0.12, at.y) + Math.random() * 0.15, at.z);
      p.age = 0;
      p.life = 0.7 + Math.random() * 0.5;
      p.size = size * (0.7 + Math.random() * 0.6);
      (p.m.material as THREE.MeshBasicMaterial).color.setHex(Math.random() < 0.3 ? SUMO.core : SUMO.dust);
      p.m.visible = true;
    }
  }

  update(dt: number) {
    for (const p of this.items) {
      if (p.age >= p.life) continue;
      p.age += dt;
      if (p.age >= p.life) { p.m.visible = false; continue; }
      const k = p.age / p.life;
      p.m.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(Math.exp(-dt * 3));
      p.v.y *= Math.exp(-dt * 2);
      p.m.scale.set(p.size * (0.5 + k * 1.1), p.size * (0.4 + k * 0.7), p.size * (0.5 + k * 1.1));
      (p.m.material as THREE.MeshBasicMaterial).opacity = 0.62 * (1 - k) * (1 - k * 0.4);
    }
  }

  reset() {
    for (const p of this.items) { p.age = 9; p.m.visible = false; }
    this.next = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Cracks
// ---------------------------------------------------------------------------------------------------------------

/** A jagged ribbon along +z, 1 m long, `w` half-wide at the root and thin at the tip, `y` above the floor. */
function crackRibbon(seed: number, w: number, y: number): THREE.BufferGeometry {
  const steps = 9, pos: number[] = [], idx: number[] = [];
  let x = 0;
  for (let i = 0; i <= steps; i++) {
    const z = i / steps;
    x += (((i * 7919 + seed * 104729) % 13) / 13 - 0.5) * 0.16;
    x *= 0.8;
    const half = w * (1 - z * 0.85);
    pos.push(x - half, y, z, x + half, y, z);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}

interface Crack { dark: THREE.Mesh; glow: THREE.Mesh; len: number }

/** Cracks that run out from a centre across the floor: a dark seam with a red glow in it. They grow, hold, then close. */
export class Cracks {
  readonly mesh = new THREE.Group();
  private items: Crack[] = [];
  private age = -1;
  private growT = 0.15;
  private fadeAt = -1;
  private fadeT = 0.5;

  constructor(count: number) {
    for (let i = 0; i < count; i++) {
      const dark = new THREE.Mesh(crackRibbon(i, 0.13, 0.03), new THREE.MeshBasicMaterial({ color: SUMO.dark, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const glow = new THREE.Mesh(crackRibbon(i, 0.05, 0.04), new THREE.MeshBasicMaterial({ color: SUMO.body, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      dark.visible = glow.visible = false;
      dark.renderOrder = 4;
      glow.renderOrder = 5;
      this.mesh.add(dark, glow);
      this.items.push({ dark, glow, len: 1 });
    }
  }

  get busy() {
    return this.age >= 0;
  }

  /** Cracks out from `at` to about `radius`, running for `seconds`. */
  grow(at: THREE.Vector3, radius: number, seconds: number) {
    this.age = 0;
    this.growT = Math.max(0.05, seconds);
    this.fadeAt = -1;
    const n = this.items.length;
    this.items.forEach((c, i) => {
      const yaw = (i / n) * Math.PI * 2 + ((i * 37) % 7) * 0.05;
      c.len = radius * (0.65 + (((i * 5) % 7) / 7) * 0.4);
      for (const m of [c.dark, c.glow]) {
        m.position.set(at.x, 0, at.z);
        m.rotation.y = yaw;
        m.scale.set(1, 1, MIN);
        m.visible = true;
        (m.material as THREE.MeshBasicMaterial).opacity = 1;
      }
    });
  }

  /** Starts closing them: they fade over `seconds`. */
  fade(seconds: number) {
    if (this.age < 0 || this.fadeAt >= 0) return;
    this.fadeAt = this.age;
    this.fadeT = Math.max(0.05, seconds);
  }

  update(dt: number) {
    if (this.age < 0) return;
    this.age += dt;
    const g = Math.min(1, this.age / this.growT), e = 1 - (1 - g) * (1 - g);
    const f = this.fadeAt >= 0 ? Math.min(1, (this.age - this.fadeAt) / this.fadeT) : 0;
    for (const c of this.items) {
      for (const m of [c.dark, c.glow]) {
        m.scale.z = Math.max(MIN, c.len * e);
        (m.material as THREE.MeshBasicMaterial).opacity = 1 - f;
      }
      // The red glow dies first.
      (c.glow.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - f * 1.8) * (0.7 + 0.3 * Math.sin(this.age * 30));
    }
    if (f >= 1) this.reset();
  }

  reset() {
    this.age = -1;
    this.fadeAt = -1;
    for (const c of this.items) c.dark.visible = c.glow.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Salt
// ---------------------------------------------------------------------------------------------------------------

interface Grain {
  p: THREE.Vector3;
  v: THREE.Vector3;
  delay: number;
  age: number;
  rest: number;
  size: number;
  spin: number;
  landed: boolean;
}

/** Pooled salt crystals: thrown in a fan from his hand, they fly in an arc, land, glitter and fade. */
export class SaltGrains {
  readonly mesh: THREE.InstancedMesh;
  private grains: Grain[] = [];
  private dummy = new THREE.Object3D();
  private live = false;

  constructor(count: number) {
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0).scale(0.7, 1.5, 0.7), new THREE.MeshBasicMaterial({ color: 0xffffff }), count);
    this.mesh.frustumCulled = false;
    const white = new THREE.Color(SUMO.hot), blue = new THREE.Color(0xdbe8ff);
    for (let i = 0; i < count; i++) {
      this.grains.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), delay: 0, age: 99, rest: 0, size: 0.07, spin: 0, landed: false });
      this.mesh.setColorAt(i, i % 3 === 0 ? blue : white);
    }
    this.reset();
  }

  get busy() {
    return this.live;
  }

  /**
   * Throws `n` crystals from `from` in a fan of width `angle` (radians) around `yaw`, landing between 1 m and `reach` away; they leave
   * between `t0` and `t1` seconds from now and fly for about `flight` seconds. The arc is real: gravity, a launch height of 1.3 m.
   */
  fan(from: THREE.Vector3, yaw: number, angle: number, reach: number, n: number, t0: number, t1: number, flight: number) {
    const g = 9;
    let k = 0;
    for (const s of this.grains) {
      if (k++ >= n) break;
      const a = yaw + (Math.random() - 0.5) * angle;
      const d = 1 + (reach - 1) * Math.pow(Math.random(), 0.7);
      const T = flight * (0.75 + Math.random() * 0.5) * (0.6 + 0.4 * (d / reach));
      const y0 = from.y > 0.3 ? from.y : 1.3;
      const vy = (0.04 - y0 + 0.5 * g * T * T) / T;
      s.p.set(from.x, y0, from.z);
      s.v.set((Math.sin(a) * d) / T, vy, (Math.cos(a) * d) / T);
      s.delay = t0 + Math.random() * (t1 - t0);
      s.age = 0;
      s.rest = 0.7 + Math.random() * 0.6;
      s.size = 0.05 + Math.random() * 0.05;
      s.spin = (Math.random() - 0.5) * 18;
      s.landed = false;
    }
    this.live = true;
  }

  update(dt: number) {
    if (!this.live) return;
    let any = false;
    this.grains.forEach((s, i) => {
      if (s.age >= 99) return;
      s.age += dt;
      let size = 0;
      let done = false;
      if (s.age >= s.delay) {
        if (!s.landed) {
          s.v.y -= 9 * dt;
          s.p.addScaledVector(s.v, dt);
          if (s.p.y <= 0.04 && s.v.y < 0) {
            s.p.y = 0.04;
            s.landed = true;
            s.delay = s.age; // the rest timer starts at the landing
            s.v.set(0, 0, 0);
          }
          size = s.size * (1 + 0.3 * Math.sin(s.age * 30));
        } else {
          const r = s.age - s.delay;
          // Glitter on the floor, then shrink away.
          size = r < s.rest ? s.size * (0.8 + 0.5 * Math.abs(Math.sin(r * 14 + i))) : s.size * Math.max(0, 1 - (r - s.rest) / 0.3);
          done = r >= s.rest + 0.3;
        }
      }
      if (done) s.age = 99;
      else any = true;
      this.dummy.position.copy(s.p);
      this.dummy.rotation.set(s.age * s.spin, s.age * s.spin * 0.7, 0);
      this.dummy.scale.setScalar(Math.max(MIN, size));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!any) this.live = false;
  }

  reset() {
    this.live = false;
    this.dummy.scale.setScalar(MIN);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.grains.length; i++) {
      this.grains[i].age = 99;
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The hand
// ---------------------------------------------------------------------------------------------------------------

/** A big open hand, palm toward +z of its own frame, fingers up: skin with a dark outline. `set` places and turns it. */
export class Palm {
  readonly mesh = new THREE.Group();
  private mats: THREE.MeshBasicMaterial[] = [];

  constructor() {
    const part = (geo: THREE.BufferGeometry, color: number, at: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
      const skin = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
      const shell = new THREE.MeshBasicMaterial({ color: SUMO.dark, side: THREE.BackSide, transparent: true, depthWrite: false });
      this.mats.push(skin, shell);
      const m = new THREE.Mesh(geo, skin);
      const o = new THREE.Mesh(geo, shell);
      o.scale.setScalar(1.14);
      for (const x of [m, o]) { x.position.set(...at); x.rotation.set(...rot); }
      this.mesh.add(o, m);
    };
    part(new THREE.SphereGeometry(0.34, 14, 10).scale(1, 1.05, 0.5), SUMO.skin, [0, 0, 0]);
    // Four fingers fanned a little, and a thumb out to the side.
    [[-0.2, 0.42, 0.12, 0.34], [-0.07, 0.5, 0.03, 0.4], [0.07, 0.5, -0.03, 0.4], [0.2, 0.42, -0.12, 0.34]].forEach(([x, y, r, l]) => {
      part(new THREE.CapsuleGeometry(0.075, l, 3, 8), SUMO.skin, [x, y, 0], [0, 0, r]);
    });
    part(new THREE.CapsuleGeometry(0.085, 0.24, 3, 8), SUMO.skin, [-0.36, 0.0, 0], [0, 0, 0.9]);
    // A red mark on the palm: the sumo's hand print.
    part(new THREE.CircleGeometry(0.1, 12), SUMO.body, [0, 0.02, 0.19]);
    this.mesh.visible = false;
  }

  /** Puts the hand at `pos`, its palm toward `yaw`, `scale` times its size (0.8 m tall at 1), `opacity` 0..1 (0 hides it). */
  set(pos: THREE.Vector3, yaw: number, scale: number, opacity: number) {
    this.mesh.visible = opacity > 0.01 && scale > MIN;
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = yaw;
    this.mesh.scale.setScalar(Math.max(scale, MIN));
    for (const m of this.mats) m.opacity = opacity;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// A ripple
// ---------------------------------------------------------------------------------------------------------------

/** A flat ring on the floor that runs out: `set(centre, radius, opacity)`. */
export class Ripple {
  readonly mesh: THREE.Mesh;

  constructor(color: number = SUMO.hot, width = 0.1) {
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  set(at: THREE.Vector3, radius: number, opacity: number) {
    this.mesh.visible = opacity > 0.01 && radius > MIN;
    this.mesh.position.set(at.x, 0.06, at.z);
    this.mesh.scale.setScalar(Math.max(radius, MIN));
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
  }
}
