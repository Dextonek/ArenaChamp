import * as THREE from 'three';

/**
 * The cat kit (pipeline/designs/kit-cat.md): Sir Whiskers, a cat knight. Ginger fur, shining steel, a red plume, a cream foil that
 * shows on the dark floor and under every dark layer. `Claws` = three crossed claw strokes in the air (dark under amber under a
 * white core); `Pot` = a clay pot that rocks on a ledge, wobbles on its way down and breaks into shards; `LandingMark` = the
 * shadow disc that closes on the spot; `ArcTrail` = the ribbon and the head of a leap; `Specks` = pooled flecks (dust, sparks,
 * fur, sparkles); `Hearts` = a tiny cracked heart that drifts up (a life spent); `CatWord` = a floating word (MROW); `PawPrints`
 * = four prints on the ground; `Halo` = a ring with orbiting gems around the hero. Everything is pooled, takes world-space
 * positions and has a `reset()`. Flat unlit colours (nothing additive), so nothing turns into a white blob under bloom.
 */

/** Palette (`CAT_CSS` for APIs that want a string). `foil` is the cream that reads on the dark floor. */
export const CAT = {
  core: 0xfff6e0,
  foil: 0xf4e6c8,
  body: 0xe8a13a,
  warm: 0xc9741f,
  dark: 0x2a1608,
  plume: 0xc8423a,
  steel: 0xc4ced8,
  clay: 0xb5653a,
  clayDark: 0x6e3a20,
  pink: 0xff9eb4,
} as const;

export const CAT_CSS = {
  core: '#fff6e0',
  foil: '#f4e6c8',
  body: '#e8a13a',
  warm: '#c9741f',
  dark: '#2a1608',
  plume: '#c8423a',
  steel: '#c4ced8',
  clay: '#b5653a',
  clayDark: '#6e3a20',
  pink: '#ff9eb4',
} as const;

const MIN = 1e-4;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

function flatMat(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------------------------------------------------------
// Claws
// ---------------------------------------------------------------------------------------------------------------

/** A tapered lens from x 0 to 1, widest near the start: one claw stroke. */
function lensGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.3, 0.5, 0, 1, 0, 0, 0.3, -0.5, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

interface Stroke {
  holder: THREE.Group;
  dark: THREE.Mesh;
  body: THREE.Mesh;
  core: THREE.Mesh;
  len: number;
  delay: number;
}

const STROKES: { angle: number; len: number; x: number; y: number }[] = [
  { angle: -44, len: 2.3, x: 0.0, y: 0.05 },
  { angle: 6, len: 2.7, x: 0.12, y: -0.12 },
  { angle: 50, len: 2.1, x: -0.1, y: 0.1 },
];

/**
 * Three crossed claw strokes drawn in the air in front of the hero. `fire(at, yaw, size)` once: the strokes are drawn on in a few
 * frames one after another (a dark band, an amber band, a thin white core), hold for a beat and fade.
 */
export class Claws {
  readonly mesh = new THREE.Group();
  private root = new THREE.Group();
  private strokes: Stroke[] = [];
  private t = 99;
  private size = 1;
  private life = 0.5;

  constructor() {
    const geo = lensGeometry();
    for (const s of STROKES) {
      const holder = new THREE.Group();
      holder.rotation.z = THREE.MathUtils.degToRad(s.angle);
      holder.position.set(s.x, s.y, 0);
      const dark = new THREE.Mesh(geo, flatMat(CAT.dark, 0.85));
      const body = new THREE.Mesh(geo, flatMat(CAT.body));
      const core = new THREE.Mesh(geo, flatMat(CAT.core));
      dark.renderOrder = 10;
      body.renderOrder = 11;
      core.renderOrder = 12;
      holder.add(dark, body, core);
      this.root.add(holder);
      this.strokes.push({ holder, dark, body, core, len: s.len, delay: this.strokes.length * 0.045 });
    }
    this.root.visible = false;
    this.mesh.add(this.root);
  }

  get busy() {
    return this.t < this.life;
  }

  fire(at: THREE.Vector3, yaw: number, size = 1) {
    this.root.position.copy(at);
    this.root.rotation.y = yaw;
    this.size = size;
    this.t = 0;
    this.root.visible = true;
  }

  update(dt: number) {
    if (this.t >= this.life) return;
    this.t += dt;
    if (this.t >= this.life) { this.root.visible = false; return; }
    const fade = 1 - clamp01((this.t - 0.28) / (this.life - 0.28));
    for (const s of this.strokes) {
      const k = easeOut((this.t - s.delay) / 0.1);
      const L = s.len * this.size * Math.max(k, MIN);
      const off = -s.len * this.size * 0.5;
      const w = this.size;
      s.dark.scale.set(L, 0.4 * w, 1);
      s.body.scale.set(L, 0.25 * w, 1);
      s.core.scale.set(L * 0.96, 0.09 * w, 1);
      for (const m of [s.dark, s.body, s.core]) {
        m.position.x = off;
        (m.material as THREE.MeshBasicMaterial).opacity = (m === s.dark ? 0.85 : 1) * fade;
      }
    }
  }

  reset() {
    this.t = 99;
    this.root.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Specks
// ---------------------------------------------------------------------------------------------------------------

interface Speck {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  gravity: number;
  spin: number;
}

/** Pooled flecks: dust, sparks, fur, sparkles. `burst` throws them from a point; `ring` sends them out along the floor. */
export class Specks {
  readonly mesh = new THREE.Group();
  private pool: Speck[] = [];
  private cursor = 0;
  private geo = new THREE.OctahedronGeometry(1, 0);

  constructor(max = 60) {
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: CAT.body, transparent: true, depthWrite: false }));
      m.visible = false;
      m.scale.setScalar(MIN);
      this.mesh.add(m);
      this.pool.push({ mesh: m, vel: new THREE.Vector3(), age: 9, life: 1, size: 0.1, gravity: 9, spin: 0 });
    }
  }

  get busy() {
    return this.pool.some((p) => p.age < p.life);
  }

  private take(): Speck {
    const p = this.pool[this.cursor++ % this.pool.length];
    return p;
  }

  private put(at: THREE.Vector3, vel: THREE.Vector3, life: number, color: number, size: number, gravity: number) {
    const p = this.take();
    p.mesh.position.copy(at);
    p.vel.copy(vel);
    p.age = 0;
    p.life = life;
    p.size = size;
    p.gravity = gravity;
    p.spin = (Math.sin(this.cursor * 12.9898) * 43758.5453) % 1 * 9;
    (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    p.mesh.visible = true;
  }

  /** `n` flecks out in every direction (more upward with `up`), mixed from `colors`. */
  burst(at: THREE.Vector3, n: number, speed: number, life: number, colors: number[] = [CAT.body], size = 0.1, up = 1, gravity = 9) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random();
      const sp = speed * (0.45 + Math.random() * 0.75);
      v.set(Math.cos(a) * sp * (1 - e * 0.5), (0.35 + e) * sp * up, Math.sin(a) * sp * (1 - e * 0.5));
      this.put(at, v, life * (0.7 + Math.random() * 0.6), colors[i % colors.length], size * (0.6 + Math.random() * 0.8), gravity);
    }
  }

  /** `n` flecks racing out along the floor from `at`. */
  ring(at: THREE.Vector3, n: number, speed: number, life: number, colors: number[] = [CAT.foil], size = 0.13) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      v.set(Math.cos(a) * speed, 0.7 + Math.random() * 0.8, Math.sin(a) * speed);
      this.put(at, v, life * (0.7 + Math.random() * 0.6), colors[i % colors.length], size * (0.7 + Math.random() * 0.6), 5);
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (p.age >= p.life) continue;
      p.age += dt;
      if (p.age >= p.life) { p.mesh.visible = false; continue; }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.vel.y = Math.abs(p.vel.y) * 0.25; p.vel.x *= 0.6; p.vel.z *= 0.6; }
      const k = p.age / p.life;
      p.mesh.scale.set(Math.max(MIN, p.size * (1 - k * 0.7)), Math.max(MIN, p.size * 0.6 * (1 - k * 0.7)), Math.max(MIN, p.size * (1 - k * 0.7)));
      p.mesh.rotation.y += p.spin * dt;
      p.mesh.rotation.x += p.spin * 0.6 * dt;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    }
  }

  reset() {
    for (const p of this.pool) { p.age = 9; p.mesh.visible = false; }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The clay pot
// ---------------------------------------------------------------------------------------------------------------

const POT_PROFILE: [number, number][] = [
  [0.0, 0.0], [0.26, 0.0], [0.34, 0.1], [0.42, 0.32], [0.4, 0.5], [0.28, 0.62], [0.3, 0.66], [0.32, 0.74], [0.24, 0.74], [0.2, 0.66], [0.0, 0.66],
];

function buildPot(): THREE.Group {
  const g = new THREE.Group();
  const lathe = new THREE.LatheGeometry(POT_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 14);
  const body = new THREE.Mesh(lathe, new THREE.MeshBasicMaterial({ color: CAT.clay, side: THREE.DoubleSide }));
  // A dark outline shell behind it, so the pot reads on any floor.
  const shell = new THREE.Mesh(lathe, new THREE.MeshBasicMaterial({ color: CAT.dark, side: THREE.BackSide }));
  shell.scale.set(1.12, 1.06, 1.12);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.035, 6, 20), new THREE.MeshBasicMaterial({ color: CAT.body }));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.4;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.03, 6, 18), new THREE.MeshBasicMaterial({ color: CAT.foil }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.74;
  const paw = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: CAT.foil, side: THREE.DoubleSide }));
  paw.position.set(0, 0.24, 0.395);
  g.add(shell, body, band, rim, paw);
  g.visible = false;
  for (const m of g.children) m.frustumCulled = false;
  return g;
}

interface Shard {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  spin: THREE.Vector3;
}

/**
 * One clay pot. `perch(at)`: it sits on a ledge and rocks, more and more. `launch(to, dur, peak)`: it tips off and falls along an arc,
 * tumbling and wobbling. `smash()`: it is gone and its shards fly and bounce, then fade.
 */
export class Pot {
  readonly mesh = new THREE.Group();
  private pot = buildPot();
  private shards: Shard[] = [];
  private mode: 'off' | 'perch' | 'fly' = 'off';
  private t = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private dur = 0.5;
  private peak = 1;
  private shardAge = 99;

  constructor(shards = 16) {
    this.mesh.add(this.pot);
    const geo = new THREE.TetrahedronGeometry(0.15, 0);
    for (let i = 0; i < shards; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? CAT.clayDark : CAT.clay, transparent: true, side: THREE.DoubleSide }));
      m.visible = false;
      m.scale.set(0.8 + (i % 4) * 0.3, 0.5 + (i % 3) * 0.3, 0.8 + (i % 5) * 0.2);
      this.mesh.add(m);
      this.shards.push({ mesh: m, vel: new THREE.Vector3(), age: 99, spin: new THREE.Vector3() });
    }
  }

  get busy() {
    return this.mode !== 'off' || this.shardAge < 1.6;
  }

  get position() {
    return this.pot.position;
  }

  perch(at: THREE.Vector3) {
    this.mode = 'perch';
    this.t = 0;
    this.from.copy(at);
    this.pot.position.copy(at);
    this.pot.rotation.set(0, 0, 0);
    this.pot.visible = true;
  }

  launch(to: THREE.Vector3, dur: number, peak: number) {
    this.mode = 'fly';
    this.t = 0;
    this.to.copy(to);
    this.dur = Math.max(0.1, dur);
    this.peak = peak;
  }

  smash(at: THREE.Vector3) {
    this.mode = 'off';
    this.pot.visible = false;
    this.shardAge = 0;
    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i], a = (i / this.shards.length) * Math.PI * 2 + i * 0.7, sp = 2.5 + (i % 5) * 0.9;
      s.mesh.position.set(at.x, at.y + 0.2, at.z);
      s.vel.set(Math.cos(a) * sp, 3.2 + (i % 4) * 1.1, Math.sin(a) * sp);
      s.spin.set(((i * 7) % 11) - 5, ((i * 5) % 9) - 4, ((i * 3) % 7) - 3);
      s.age = 0;
      s.mesh.visible = true;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    }
  }

  update(dt: number) {
    if (this.mode === 'perch') {
      this.t += dt;
      const k = Math.min(1, this.t / 0.22);
      // Rocking toward the edge, faster and wider.
      this.pot.rotation.z = Math.sin(this.t * 26) * (0.1 + 0.28 * k);
      this.pot.rotation.x = Math.cos(this.t * 21) * 0.08 * k;
    } else if (this.mode === 'fly') {
      this.t += dt;
      const p = clamp01(this.t / this.dur);
      this.pot.position.lerpVectors(this.from, this.to, p);
      this.pot.position.y += 4 * this.peak * p * (1 - p);
      // Tumbling with a wobble that grows as it comes down.
      this.pot.rotation.z = Math.sin(this.t * 17) * (0.35 + 0.5 * p) + p * 2.2;
      this.pot.rotation.x = Math.cos(this.t * 23) * 0.4 * p;
      this.pot.rotation.y += dt * 5;
    }
    if (this.shardAge < 1.6) {
      this.shardAge += dt;
      for (const s of this.shards) {
        if (!s.mesh.visible) continue;
        s.age += dt;
        s.vel.y -= 14 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        if (s.mesh.position.y < 0.08) { s.mesh.position.y = 0.08; s.vel.y = Math.abs(s.vel.y) * 0.3; s.vel.x *= 0.5; s.vel.z *= 0.5; s.spin.multiplyScalar(0.5); }
        s.mesh.rotation.x += s.spin.x * dt;
        s.mesh.rotation.y += s.spin.y * dt;
        s.mesh.rotation.z += s.spin.z * dt;
        const k = this.shardAge / 1.6;
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
        if (this.shardAge >= 1.6) s.mesh.visible = false;
      }
    }
  }

  reset() {
    this.mode = 'off';
    this.shardAge = 99;
    this.pot.visible = false;
    for (const s of this.shards) { s.mesh.visible = false; s.age = 99; }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The landing mark
// ---------------------------------------------------------------------------------------------------------------

/**
 * The shadow of what is about to land: a dark disc with a cream rim at the real hit radius, and a ring closing on its centre.
 * `set(at, radius, k)`: `k` 0..1 is how close the landing is; `hide()`.
 */
export class LandingMark {
  readonly mesh = new THREE.Group();
  private disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), flatMat(CAT.dark, 0));
  private rim = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), flatMat(CAT.foil, 0));
  private closing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), flatMat(CAT.body, 0));

  constructor() {
    this.disc.renderOrder = 1;
    this.rim.renderOrder = 2;
    this.closing.renderOrder = 3;
    this.mesh.add(this.disc, this.rim, this.closing);
  }

  set(at: THREE.Vector3, radius: number, k: number) {
    const a = clamp01(k);
    for (const m of [this.disc, this.rim, this.closing]) m.position.set(at.x, 0.05, at.z);
    this.disc.scale.setScalar(Math.max(MIN, radius * (0.4 + 0.6 * easeOut(a * 2))));
    this.rim.scale.setScalar(Math.max(MIN, radius));
    this.closing.scale.setScalar(Math.max(MIN, radius * (1 - a * 0.92)));
    (this.disc.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.45 * a;
    (this.rim.material as THREE.MeshBasicMaterial).opacity = 0.9;
    (this.closing.material as THREE.MeshBasicMaterial).opacity = 0.95;
  }

  hide() {
    for (const m of [this.disc, this.rim, this.closing]) (m.material as THREE.MeshBasicMaterial).opacity = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The arc of a leap
// ---------------------------------------------------------------------------------------------------------------

const ARC_N = 26;

/**
 * The leap of a cat: a tapering ribbon (a dark band under an amber band) along a parabola from `a` to `b` that peaks `peak` m above
 * the line, and a head (a ginger blob with two ears) riding its front. `fly(a, b, peak, dur)`; the ribbon trails the head and fades
 * a beat after it lands.
 */
export class ArcTrail {
  readonly mesh = new THREE.Group();
  private dark: THREE.Mesh;
  private body: THREE.Mesh;
  private head = new THREE.Group();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private right = new THREE.Vector3(1, 0, 0);
  private peak = 2;
  private dur = 0.6;
  private t = 99;
  private posD: THREE.BufferAttribute;
  private posB: THREE.BufferAttribute;
  private v = new THREE.Vector3();

  constructor() {
    const mk = (color: number, order: number) => {
      const g = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(new Float32Array(ARC_N * 2 * 3), 3);
      g.setAttribute('position', attr);
      const idx: number[] = [];
      for (let i = 0; i < ARC_N - 1; i++) {
        const o = i * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
      g.setIndex(idx);
      const m = new THREE.Mesh(g, flatMat(color));
      m.frustumCulled = false;
      m.renderOrder = order;
      return { m, attr };
    };
    const d = mk(CAT.dark, 8), bd = mk(CAT.body, 9);
    this.dark = d.m;
    this.body = bd.m;
    this.posD = d.attr;
    this.posB = bd.attr;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: CAT.body }));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: CAT.dark, side: THREE.BackSide }));
    shell.scale.setScalar(1.25);
    this.head.add(shell, ball);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), new THREE.MeshBasicMaterial({ color: CAT.warm }));
      ear.position.set(sx * 0.17, 0.3, 0);
      ear.rotation.z = -sx * 0.3;
      this.head.add(ear);
    }
    this.head.visible = false;
    this.dark.visible = this.body.visible = false;
    this.mesh.add(this.dark, this.body, this.head);
  }

  get busy() {
    return this.t < this.dur + 0.5;
  }

  /** Where the head is now (progress 0..1 along the arc). */
  private at(p: number, out: THREE.Vector3) {
    out.lerpVectors(this.a, this.b, p);
    out.y += 4 * this.peak * p * (1 - p);
    return out;
  }

  fly(a: THREE.Vector3, b: THREE.Vector3, peak: number, dur: number) {
    this.a.set(a.x, 0.9, a.z);
    this.b.set(b.x, 0.9, b.z);
    this.peak = peak;
    this.dur = Math.max(0.1, dur);
    this.t = 0;
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    this.right.set(dz / l, 0, -dx / l);
    this.dark.visible = this.body.visible = this.head.visible = true;
  }

  update(dt: number) {
    if (this.t >= this.dur + 0.5) return;
    this.t += dt;
    const p = clamp01(this.t / this.dur);
    const s0 = Math.max(0, p - 0.55);
    const fade = this.t > this.dur ? 1 - (this.t - this.dur) / 0.5 : 1;
    if (fade <= 0) {
      this.dark.visible = this.body.visible = this.head.visible = false;
      this.t = 99;
      return;
    }
    for (let i = 0; i < ARC_N; i++) {
      const k = i / (ARC_N - 1);
      this.at(s0 + (p - s0) * k, this.v);
      const taper = Math.pow(k, 0.9) * fade;
      const wd = 0.34 * taper, wb = 0.2 * taper;
      this.posD.setXYZ(i * 2, this.v.x + this.right.x * wd, this.v.y, this.v.z + this.right.z * wd);
      this.posD.setXYZ(i * 2 + 1, this.v.x - this.right.x * wd, this.v.y, this.v.z - this.right.z * wd);
      this.posB.setXYZ(i * 2, this.v.x + this.right.x * wb, this.v.y + 0.01, this.v.z + this.right.z * wb);
      this.posB.setXYZ(i * 2 + 1, this.v.x - this.right.x * wb, this.v.y + 0.01, this.v.z - this.right.z * wb);
    }
    this.posD.needsUpdate = true;
    this.posB.needsUpdate = true;
    this.at(p, this.head.position);
    this.head.scale.setScalar(Math.max(MIN, (p < 1 ? 1 : Math.max(0, 1 - (this.t - this.dur) / 0.15)) * 0.9));
    this.head.rotation.y += dt * 12;
  }

  reset() {
    this.t = 99;
    this.dark.visible = this.body.visible = this.head.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Hearts and words
// ---------------------------------------------------------------------------------------------------------------

function heartTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const heart = () => {
      g.beginPath();
      g.moveTo(64, 112);
      g.bezierCurveTo(8, 72, 14, 20, 64, 38);
      g.bezierCurveTo(114, 20, 120, 72, 64, 112);
      g.closePath();
    };
    heart();
    g.lineWidth = 14;
    g.lineJoin = 'round';
    g.strokeStyle = CAT_CSS.dark;
    g.stroke();
    g.fillStyle = CAT_CSS.plume;
    g.fill();
    g.fillStyle = CAT_CSS.pink;
    g.beginPath();
    g.ellipse(38, 52, 11, 7, -0.6, 0, Math.PI * 2);
    g.fill();
    // The crack: a jagged cut through the middle.
    g.strokeStyle = CAT_CSS.dark;
    g.lineWidth = 9;
    g.lineJoin = 'miter';
    g.beginPath();
    g.moveTo(64, 34);
    g.lineTo(52, 56);
    g.lineTo(74, 70);
    g.lineTo(60, 92);
    g.lineTo(66, 112);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface HeartItem { sprite: THREE.Sprite; t: number; life: number; size: number; base: THREE.Vector3; active: boolean }

/** A tiny cracked heart pops over a point and drifts up: a life spent. `pop(at, size, life)`. */
export class Hearts {
  readonly mesh = new THREE.Group();
  private pool: HeartItem[] = [];

  constructor(size = 3) {
    const tex = heartTexture();
    for (let i = 0; i < size; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 21;
      sprite.visible = false;
      this.mesh.add(sprite);
      this.pool.push({ sprite, t: 0, life: 1, size: 0.5, base: new THREE.Vector3(), active: false });
    }
  }

  get busy() {
    return this.pool.some((h) => h.active);
  }

  pop(at: THREE.Vector3, size = 0.55, life = 1.1) {
    const h = this.pool.find((p) => !p.active) ?? this.pool[0];
    h.active = true;
    h.t = 0;
    h.life = life;
    h.size = size;
    h.base.copy(at);
    h.sprite.visible = true;
  }

  update(dt: number) {
    for (const h of this.pool) {
      if (!h.active) continue;
      h.t += dt;
      if (h.t >= h.life) { h.active = false; h.sprite.visible = false; continue; }
      const k = h.t / h.life;
      const pop = h.t < 0.15 ? 0.4 + 0.9 * (h.t / 0.15) : 1.3 - 0.3 * Math.min(1, (h.t - 0.15) / 0.2);
      const s = h.size * Math.max(MIN, pop);
      h.sprite.scale.set(s, s, 1);
      h.sprite.position.set(h.base.x + Math.sin(h.t * 7) * 0.08, h.base.y + k * 1.3, h.base.z);
      h.sprite.material.opacity = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      h.sprite.material.rotation = Math.sin(h.t * 9) * 0.12;
    }
  }

  reset() {
    for (const h of this.pool) { h.active = false; h.sprite.visible = false; }
  }
}

interface WordItem {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  t: number;
  life: number;
  size: number;
  base: THREE.Vector3;
  aspect: number;
  active: boolean;
}

/** A floating comic word (MROW, HISS, GOTCHA): cream letters on a dark outline with an amber shadow. `show(text, at, size, life)`. */
export class CatWord {
  readonly mesh = new THREE.Group();
  private pool: WordItem[] = [];

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
    g.strokeStyle = CAT_CSS.warm;
    g.lineWidth = 34;
    g.strokeText(text, cx + 7, cy + 9);
    g.strokeStyle = CAT_CSS.dark;
    g.lineWidth = 30;
    g.strokeText(text, cx, cy);
    g.fillStyle = CAT_CSS.core;
    g.fillText(text, cx, cy);
    // The lower half is ginger, so the word reads as a furry stripe.
    g.save();
    g.beginPath();
    g.rect(0, cy + 14, w.canvas.width, 200);
    g.clip();
    g.fillStyle = CAT_CSS.body;
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
      w.sprite.position.set(w.base.x, w.base.y + k * 1.2 * w.size * 0.5, w.base.z);
      w.mat.rotation = Math.sin(w.t * 6) * 0.05;
      w.mat.opacity = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    }
  }

  reset() {
    for (const w of this.pool) { w.active = false; w.sprite.visible = false; }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Paw prints
// ---------------------------------------------------------------------------------------------------------------

interface Print { g: THREE.Group; age: number; life: number; mats: THREE.MeshBasicMaterial[] }

/** Paw prints on the floor: a pad and four toes, cream on a dark outline, that fade after a second. `stamp(at, yaw)`. */
export class PawPrints {
  readonly mesh = new THREE.Group();
  private pool: Print[] = [];
  private cursor = 0;

  constructor(max = 4) {
    const pad = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
    for (let i = 0; i < max; i++) {
      const g = new THREE.Group();
      const mats: THREE.MeshBasicMaterial[] = [];
      const part = (x: number, z: number, sx: number, sz: number, color: number, y: number) => {
        const mat = flatMat(color);
        mats.push(mat);
        const m = new THREE.Mesh(pad, mat);
        m.position.set(x, y, z);
        m.scale.set(sx, 1, sz);
        m.renderOrder = 4 + (y > 0.04 ? 1 : 0);
        g.add(m);
      };
      for (const [color, y, k] of [[CAT.dark, 0.035, 1.35], [CAT.foil, 0.045, 1]] as const) {
        part(0, 0.1, 0.34 * k, 0.28 * k, color, y);
        part(-0.3, -0.22, 0.12 * k, 0.15 * k, color, y);
        part(-0.1, -0.38, 0.12 * k, 0.15 * k, color, y);
        part(0.1, -0.38, 0.12 * k, 0.15 * k, color, y);
        part(0.3, -0.22, 0.12 * k, 0.15 * k, color, y);
      }
      g.visible = false;
      this.mesh.add(g);
      this.pool.push({ g, age: 9, life: 1.2, mats });
    }
  }

  get busy() {
    return this.pool.some((p) => p.age < p.life);
  }

  stamp(at: THREE.Vector3, yaw: number, size = 1) {
    const p = this.pool[this.cursor++ % this.pool.length];
    p.g.position.set(at.x, 0, at.z);
    p.g.rotation.y = yaw;
    p.g.scale.setScalar(size);
    p.age = 0;
    p.g.visible = true;
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (p.age >= p.life) continue;
      p.age += dt;
      if (p.age >= p.life) { p.g.visible = false; continue; }
      const k = p.age / p.life;
      for (const m of p.mats) m.opacity = k > 0.5 ? 1 - (k - 0.5) / 0.5 : 1;
    }
  }

  reset() {
    for (const p of this.pool) { p.age = 9; p.g.visible = false; }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Halo
// ---------------------------------------------------------------------------------------------------------------

/** A thin cream ring about a hero's waist with amber gems orbiting it. `set(center, radius, spin, opacity)`; opacity 0 hides it. */
export class Halo {
  readonly mesh = new THREE.Group();
  private ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 40).rotateX(-Math.PI / 2), flatMat(CAT.foil, 0));
  private gems: THREE.Mesh[] = [];

  constructor(count = 6) {
    this.ring.renderOrder = 6;
    this.mesh.add(this.ring);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ color: i % 2 ? CAT.body : CAT.foil, transparent: true, opacity: 0 }));
      m.scale.set(1, 1.4, 1);
      this.gems.push(m);
      this.mesh.add(m);
    }
  }

  set(center: THREE.Vector3, radius: number, spin: number, opacity: number) {
    this.ring.position.copy(center);
    this.ring.scale.setScalar(Math.max(MIN, radius));
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * opacity;
    this.gems.forEach((m, i) => {
      const a = spin + (i / this.gems.length) * Math.PI * 2;
      m.position.set(center.x + Math.cos(a) * radius, center.y + Math.sin(a * 2 + i) * 0.08, center.z + Math.sin(a) * radius);
      m.rotation.y = a;
      (m.material as THREE.MeshBasicMaterial).opacity = opacity;
    });
  }
}
