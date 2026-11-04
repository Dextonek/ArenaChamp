import * as THREE from 'three';

/**
 * Mole kit parts (Mabel, the mole): a cheerful miner's palette of warm soil browns with a dark layer under everything and a
 * pale gold foil (her helmet lamp, a pickaxe's edge, a pebble of gold in the dirt). Every part is small and pooled:
 *  - `Clods`: chunky flying lumps of earth with a dark outline hull, a few flecks of gold. Thrown, they fall, bounce once, rest, shrink.
 *  - `Puffs`: ragged billboard dust puffs that grow, rise and erode away (never smooth opaque spheres).
 *  - `Mound`: the big moving mound of dirt that shows where she is underground (soil cone, dark skirt, a gold ring so it reads
 *    at gameplay distance, a glowing lamp on top). `Furrow` is the torn strip behind it.
 *  - `buildPit` / `pitLook`: a hole seen from above: a dark round pit with a raised rim of dirt and a lit crescent. The ground
 *    mark for her holes (`Trait.markLook`) and the Sinkhole pit use it.
 *  - `LampGlow` (a little warm light from her helmet), `Pickaxe` (a tiny pick that taps), `GroundRing` (a dust ring), `ClawArcs`
 *    (the three gold strokes of a swipe, laid on the ground), `Cracks` (radial cracks that run out from a point).
 */

export const MOLE = {
  accent: 0x8a6a4a, foil: 0xffcf5a, soil: 0xa98258, dirt: 0x6b4e33, dark: 0x2b1d12, deep: 0x120b06, light: 0xd9b98a, hot: 0xfff0c0, steel: 0x9aa3ad,
} as const;
export const MOLE_CSS = {
  accent: '#8a6a4a', foil: '#ffcf5a', soil: '#a98258', dirt: '#6b4e33', dark: '#2b1d12', light: '#d9b98a', hot: '#fff0c0',
} as const;

const MIN = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

// ---------------------------------------------------------------------------------------------------------------
// Clods
// ---------------------------------------------------------------------------------------------------------------

interface Clod {
  live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number;
  q: THREE.Quaternion; axis: THREE.Vector3; spin: number; bounces: number;
}

const CLOD_COLORS = [MOLE.soil, MOLE.dirt, MOLE.light, MOLE.dirt, MOLE.soil, MOLE.dark];

/**
 * Flying lumps of earth. `burst(pos, count, speed, size)` throws them in every direction, `fan(pos, dir, count, speed, spread, size)`
 * along a heading. Each falls (gravity 16), bounces once, rests and shrinks away at the end of its `life`. Add `mesh`.
 */
export class Clods {
  readonly mesh = new THREE.Group();
  frozen = false;
  private body: THREE.InstancedMesh;
  private hull: THREE.InstancedMesh;
  private clods: Clod[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  private zero = new THREE.Vector3(0, -50, 0);
  private ident = new THREE.Quaternion();
  private spinQ = new THREE.Quaternion();

  constructor(private max = 90) {
    const geo = new THREE.DodecahedronGeometry(0.5, 0);
    this.body = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.hull = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: MOLE.deep, side: THREE.BackSide }), max);
    for (const im of [this.body, this.hull]) { im.frustumCulled = false; this.mesh.add(im); }
    for (let i = 0; i < max; i++) {
      this.clods.push({
        live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 0.2,
        q: new THREE.Quaternion(), axis: new THREE.Vector3(1, 0, 0), spin: 0, bounces: 0,
      });
      this.body.setColorAt(i, this.c.set(MOLE.soil));
    }
    this.update(0);
  }

  get busy() {
    return this.clods.some((k) => k.live);
  }

  /** One lump. `gold`: a fleck of gold in the dirt. */
  throw(pos: THREE.Vector3, vel: THREE.Vector3, size = 0.2, life = 1.1, color?: number) {
    const k = this.clods[this.cursor];
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    k.live = true;
    k.pos.copy(pos);
    k.vel.copy(vel);
    k.age = 0;
    k.life = life;
    k.size = size;
    k.bounces = 0;
    k.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    k.spin = 4 + Math.random() * 10;
    k.q.setFromAxisAngle(k.axis, Math.random() * 6);
    const col = color ?? (Math.random() < 0.09 ? MOLE.foil : CLOD_COLORS[Math.floor(Math.random() * CLOD_COLORS.length)]);
    this.body.setColorAt(i, this.c.set(col));
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
  }

  burst(pos: THREE.Vector3, count = 8, speed = 4, size = 1, up = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.45 + Math.random() * 0.7);
      this.throw(
        pos, new THREE.Vector3(Math.cos(a) * sp, (2.2 + Math.random() * 3.4) * up, Math.sin(a) * sp),
        (0.12 + Math.random() * 0.16) * size, 0.8 + Math.random() * 0.7,
      );
    }
  }

  fan(pos: THREE.Vector3, dir: THREE.Vector3, count = 6, speed = 5, spread = 0.7, size = 1) {
    const base = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * spread * 2, sp = speed * (0.5 + Math.random() * 0.7);
      this.throw(
        pos, new THREE.Vector3(Math.sin(a) * sp, 1.8 + Math.random() * 2.6, Math.cos(a) * sp),
        (0.1 + Math.random() * 0.14) * size, 0.7 + Math.random() * 0.6,
      );
    }
  }

  reset() {
    for (const k of this.clods) k.live = false;
    this.frozen = false;
  }

  update(dt: number) {
    const dd = this.frozen ? 0 : dt;
    // One instance per clod (its colour is set by index); a dead clod is a speck at the origin.
    for (let i = 0; i < this.clods.length; i++) {
      const k = this.clods[i];
      if (k.live) {
        k.age += dd;
        if (k.age >= k.life) k.live = false;
      }
      if (!k.live) {
        this.m.compose(this.zero, this.ident, this.s.set(MIN, MIN, MIN));
        this.body.setMatrixAt(i, this.m);
        this.hull.setMatrixAt(i, this.m);
        continue;
      }
      if (k.bounces < 2) {
        k.vel.y -= 16 * dd;
        k.pos.addScaledVector(k.vel, dd);
        k.q.premultiply(this.spinQ.setFromAxisAngle(k.axis, k.spin * dd));
        if (k.pos.y <= 0.09 && k.vel.y < 0) {
          k.pos.y = 0.09;
          k.bounces++;
          k.vel.y *= -0.32;
          k.vel.x *= 0.5;
          k.vel.z *= 0.5;
          if (k.bounces >= 2 || k.vel.y < 0.8) { k.bounces = 2; k.vel.set(0, 0, 0); }
        }
      }
      const shrink = 1 - smooth((k.age - (k.life - 0.3)) / 0.3);
      const sc = Math.max(MIN, k.size * shrink);
      this.m.compose(k.pos, k.q, this.s.set(sc, sc * 0.85, sc));
      this.body.setMatrixAt(i, this.m);
      this.m.compose(k.pos, k.q, this.s.set(sc * 1.32 + 0.02, sc * 1.2 + 0.02, sc * 1.32 + 0.02));
      this.hull.setMatrixAt(i, this.m);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.hull.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Puffs
// ---------------------------------------------------------------------------------------------------------------

interface Puff { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; seed: number; color: THREE.Color }

/**
 * Ragged billboard dust puffs: a dark underside, a pale lit top, an edge that erodes as they age. `puff(pos, size, color?)`
 * lays one that rises and spreads; `ring(center, radius, count, size)` lays a ring of them on the ground. Add `mesh`.
 */
export class Puffs {
  readonly mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private cursor = 0;
  private aSeed: THREE.InstancedBufferAttribute;
  private aAge: THREE.InstancedBufferAttribute;
  private aCol: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(private max = 40) {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.aSeed = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAge = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSeed', this.aSeed);
    geo.setAttribute('aAge', this.aAge);
    geo.setAttribute('aCol', this.aCol);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aSeed; attribute float aAge; attribute vec3 aCol;
        varying vec2 vUv; varying float vSeed; varying float vAge; varying vec3 vC;
        void main() {
          vUv = position.xy; vSeed = aSeed; vAge = aAge; vC = aCol;
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float s = length(instanceMatrix[0].xyz);
          c.xy += position.xy * s;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vSeed; varying float vAge; varying vec3 vC;
        void main() {
          float r = length(vUv);
          float a = atan(vUv.y, vUv.x);
          float edge = 0.78 + 0.12 * sin(a * 3.0 + vSeed * 6.0) + 0.08 * sin(a * 7.0 + vSeed * 13.0) - vAge * 0.55;
          if (r > edge) discard;
          float rim = smoothstep(edge - 0.2, edge, r);
          vec3 col = mix(vC, vC * 0.5, rim * 0.7 + (vUv.y < -0.15 ? 0.22 : 0.0));
          col = mix(col, min(vC * 1.35 + 0.08, vec3(1.0)), smoothstep(0.55, 0.0, length(vUv - vec2(-0.25, 0.3))) * 0.45);
          gl_FragColor = vec4(col, 0.92 * (1.0 - vAge * vAge));
        }`,
    }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 4;
    for (let i = 0; i < max; i++) this.puffs.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 0.5, seed: 0, color: new THREE.Color() });
  }

  puff(pos: THREE.Vector3, size = 0.6, color: number = MOLE.light, rise = 0.9) {
    const p = this.puffs[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.live = true;
    p.pos.copy(pos);
    const a = Math.random() * Math.PI * 2;
    p.vel.set(Math.cos(a) * 0.5, rise * (0.6 + Math.random() * 0.6), Math.sin(a) * 0.5);
    p.age = 0;
    p.life = 0.6 + Math.random() * 0.4;
    p.size = size;
    p.seed = Math.random();
    p.color.set(color);
  }

  ring(center: THREE.Vector3, radius: number, count = 8, size = 0.7, color: number = MOLE.light) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      this.puff(new THREE.Vector3(center.x + Math.cos(a) * radius, 0.2, center.z + Math.sin(a) * radius), size * (0.7 + Math.random() * 0.6), color, 0.5);
      const p = this.puffs[(this.cursor + this.max - 1) % this.max];
      p.vel.set(Math.cos(a) * 1.2, 0.5, Math.sin(a) * 1.2);
    }
  }

  reset() {
    for (const p of this.puffs) p.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let n = 0;
    const seed = this.aSeed.array as Float32Array, age = this.aAge.array as Float32Array, col = this.aCol.array as Float32Array;
    for (const p of this.puffs) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) { p.live = false; continue; }
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.exp(-dt * 2.2));
      const k = p.age / p.life;
      const sc = Math.max(MIN, p.size * (0.5 + 0.75 * Math.sqrt(k)));
      this.m.compose(p.pos, this.q, this.s.set(sc, sc, sc));
      this.mesh.setMatrixAt(n, this.m);
      seed[n] = p.seed;
      age[n] = k;
      col[n * 3] = p.color.r; col[n * 3 + 1] = p.color.g; col[n * 3 + 2] = p.color.b;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aSeed.needsUpdate = this.aAge.needsUpdate = this.aCol.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Pit (a hole seen from above)
// ---------------------------------------------------------------------------------------------------------------

/**
 * A hole of radius `r` lying on the ground, its feet at y 0: a dark spoil ring round it, a black pit, a raised rim of chunky dirt
 * (lit on one side), a few crumbs and a fleck of gold on the rim. Reads as a hole from the gameplay camera because the rim is
 * lighter than the floor and the middle is nearly black. `Trait.markLook` for her holes; the Sinkhole scales one up.
 */
export function buildPit(r: number): THREE.Group {
  const root = new THREE.Group();
  const flat = (geo: THREE.BufferGeometry, color: number, y: number, opacity = 1, order = 1) => {
    const mesh = new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false }));
    mesh.position.y = y;
    mesh.renderOrder = order;
    return mesh;
  };
  root.add(
    flat(new THREE.CircleGeometry(r * 1.32, 40), MOLE.dirt, 0.03, 0.55, 1),
    flat(new THREE.CircleGeometry(r * 1.04, 40), MOLE.dark, 0.045, 1, 2),
    flat(new THREE.CircleGeometry(r * 0.86, 40), MOLE.deep, 0.055, 1, 3),
    flat(new THREE.CircleGeometry(r * 0.5, 32), 0x000000, 0.06, 0.8, 4),
  );
  // The raised rim: a squashed torus in soil, a pale crescent on the side the light comes from.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * 0.14, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: MOLE.soil }));
  rim.scale.y = 0.7;
  rim.position.y = r * 0.07;
  const rimDark = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * 0.2, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: MOLE.deep, side: THREE.BackSide }));
  rimDark.scale.y = 0.7;
  rimDark.position.y = r * 0.07;
  const crescent = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.88, r * 1.02, 24, 1, Math.PI * 0.55, Math.PI * 0.7).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: MOLE.light, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  crescent.position.y = r * 0.17;
  crescent.renderOrder = 5;
  root.add(rimDark, rim, crescent);
  // Chunky lumps round the rim, none the same.
  const lump = new THREE.DodecahedronGeometry(1, 0);
  const n = Math.max(8, Math.round(r * 7));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i) * 0.4;
    const rr = r * (1.0 + (hash(i + 9) - 0.5) * 0.3);
    const s = r * (0.09 + hash(i + 3) * 0.1);
    const gold = i === 2 || (r > 2 && i % 9 === 4);
    const m = new THREE.Mesh(lump, new THREE.MeshBasicMaterial({ color: gold ? MOLE.foil : i % 3 === 0 ? MOLE.light : i % 3 === 1 ? MOLE.soil : MOLE.dirt }));
    m.position.set(Math.cos(a) * rr, s * 0.6, Math.sin(a) * rr);
    m.scale.set(s, s * 0.8, s);
    m.rotation.set(hash(i) * 3, hash(i + 1) * 3, 0);
    const o = new THREE.Mesh(lump, new THREE.MeshBasicMaterial({ color: MOLE.deep, side: THREE.BackSide }));
    o.position.copy(m.position);
    o.scale.copy(m.scale).multiplyScalar(1.3);
    o.rotation.copy(m.rotation);
    root.add(o, m);
  }
  for (const c of root.children) c.frustumCulled = false;
  return root;
}

/** The look of one of her holes (`Trait.markLook`): radius `r`. */
export function pitLook(r: number): THREE.Object3D {
  return buildPit(r);
}

// ---------------------------------------------------------------------------------------------------------------
// Mound and furrow
// ---------------------------------------------------------------------------------------------------------------

/**
 * The mound that shows where she is while she tunnels: a big lump of loose soil (a dark outline hull, a lit crown), a dark shadow
 * and a gold ring on the ground so it reads from far away, and a small warm lamp glowing on top. `set(pos, yaw, size, time)`
 * places it; it bobs and wobbles with `time`. Radius about 0.9 m at size 1. Add `mesh`.
 */
export class Mound {
  readonly mesh = new THREE.Group();
  private body = new THREE.Group();
  private ringMat: THREE.MeshBasicMaterial;
  private lampMat: THREE.MeshBasicMaterial;
  private shadowMat: THREE.MeshBasicMaterial;

  constructor() {
    const geo = new THREE.ConeGeometry(0.9, 0.85, 12, 3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const j = 1 + (hash(i * 3.1) - 0.5) * 0.22;
      p.setX(i, p.getX(i) * j);
      p.setZ(i, p.getZ(i) * j);
      if (p.getY(i) < 0.4) p.setY(i, p.getY(i) + (hash(i) - 0.5) * 0.12);
    }
    geo.translate(0, 0.42, 0);
    geo.computeVertexNormals();
    const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: MOLE.soil }));
    const hull = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: MOLE.deep, side: THREE.BackSide }));
    hull.scale.set(1.1, 1.06, 1.1);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.42, 10, 1).translate(0, 0.74, 0), new THREE.MeshBasicMaterial({ color: MOLE.light }));
    this.body.add(hull, cone, crown);
    const lump = new THREE.DodecahedronGeometry(0.5, 0);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + hash(i) * 0.5, rr = 0.78 + hash(i + 4) * 0.28, s = 0.16 + hash(i + 7) * 0.16;
      const m = new THREE.Mesh(lump, new THREE.MeshBasicMaterial({ color: i % 2 ? MOLE.dirt : MOLE.soil }));
      m.position.set(Math.cos(a) * rr, s * 0.4, Math.sin(a) * rr);
      m.scale.set(s, s * 0.8, s);
      const o = new THREE.Mesh(lump, new THREE.MeshBasicMaterial({ color: MOLE.deep, side: THREE.BackSide }));
      o.position.copy(m.position);
      o.scale.copy(m.scale).multiplyScalar(1.3);
      this.body.add(o, m);
    }
    this.lampMat = new THREE.MeshBasicMaterial({ color: MOLE.hot, transparent: true, opacity: 0.95, depthWrite: false });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), this.lampMat);
    lamp.position.set(0, 0.98, 0.1);
    this.body.add(lamp);
    this.shadowMat = new THREE.MeshBasicMaterial({ color: MOLE.deep, transparent: true, opacity: 0.5, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.25, 28).rotateX(-Math.PI / 2), this.shadowMat);
    shadow.position.y = 0.03;
    shadow.renderOrder = 1;
    this.ringMat = new THREE.MeshBasicMaterial({ color: MOLE.foil, transparent: true, opacity: 0.8, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.32, 36).rotateX(-Math.PI / 2), this.ringMat);
    ring.position.y = 0.05;
    ring.renderOrder = 2;
    this.mesh.add(shadow, ring, this.body);
    for (const c of this.mesh.children) c.frustumCulled = false;
    this.mesh.visible = false;
  }

  hide() {
    this.mesh.visible = false;
  }

  set(pos: THREE.Vector3, yaw: number, size: number, time: number, opacity = 1) {
    this.mesh.visible = size > 0.01 && opacity > 0.01;
    this.mesh.position.set(pos.x, 0, pos.z);
    this.mesh.scale.setScalar(Math.max(size, MIN));
    this.body.rotation.y = yaw;
    this.body.position.y = 0.06 * Math.sin(time * 19);
    this.body.rotation.z = 0.06 * Math.sin(time * 13);
    this.body.rotation.x = 0.05 * Math.sin(time * 11 + 1);
    this.ringMat.opacity = (0.55 + 0.3 * Math.sin(time * 9)) * opacity;
    this.lampMat.opacity = (0.7 + 0.3 * Math.sin(time * 23)) * opacity;
    this.shadowMat.opacity = 0.5 * opacity;
  }
}

/** The torn strip behind the mound: a dark core in a wider soil-coloured edge, from `a` to `b` on the ground. */
export class Furrow {
  readonly mesh = new THREE.Group();
  private edge: THREE.Mesh;
  private core: THREE.Mesh;

  constructor() {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.edge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: MOLE.soil, transparent: true, opacity: 0.85, depthWrite: false }));
    this.core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: MOLE.deep, transparent: true, opacity: 0.9, depthWrite: false }));
    this.edge.position.y = 0.035;
    this.core.position.y = 0.04;
    this.edge.renderOrder = 1;
    this.core.renderOrder = 2;
    this.mesh.add(this.edge, this.core);
    this.mesh.visible = false;
    this.edge.frustumCulled = this.core.frustumCulled = false;
  }

  hide() {
    this.mesh.visible = false;
  }

  set(a: THREE.Vector3, b: THREE.Vector3, width: number, opacity = 1) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    this.mesh.visible = len > 0.15 && opacity > 0.01;
    if (!this.mesh.visible) return;
    this.mesh.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.edge.scale.set(width * 1.7, 1, len);
    this.core.scale.set(width, 1, len);
    (this.edge.material as THREE.MeshBasicMaterial).opacity = 0.85 * opacity;
    (this.core.material as THREE.MeshBasicMaterial).opacity = 0.9 * opacity;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Lamp, pickaxe, ring, claw arcs, cracks
// ---------------------------------------------------------------------------------------------------------------

let lampTex: THREE.CanvasTexture | null = null;
function lampTexture() {
  if (lampTex) return lampTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  r.addColorStop(0, 'rgba(255,248,214,1)');
  r.addColorStop(0.25, 'rgba(255,207,90,0.85)');
  r.addColorStop(1, 'rgba(255,170,40,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  lampTex = new THREE.CanvasTexture(c);
  return lampTex;
}

/** A small warm glow, a sprite: her helmet lamp. `set(pos, size, opacity)`. Add `mesh`. */
export class LampGlow {
  readonly mesh: THREE.Sprite;

  constructor() {
    this.mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.mesh.visible = false;
    this.mesh.renderOrder = 6;
  }

  set(pos: THREE.Vector3, size: number, opacity: number) {
    this.mesh.visible = opacity > 0.01 && size > 0.01;
    this.mesh.position.copy(pos);
    this.mesh.scale.setScalar(Math.max(size, MIN));
    this.mesh.material.opacity = Math.min(1, opacity);
  }
}

/** A tiny pickaxe (0.45 m): a wooden handle, a steel head with a gold edge. `place(base, yaw, swing, scale)`: `swing` tips it about its base. Add `mesh`. */
export class Pickaxe {
  readonly mesh = new THREE.Group();
  private pivot = new THREE.Group();

  constructor() {
    const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.46, 6).translate(0, 0.23, 0), new THREE.MeshBasicMaterial({ color: MOLE.dirt }));
    const woodHull = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.46, 6).translate(0, 0.23, 0), new THREE.MeshBasicMaterial({ color: MOLE.deep, side: THREE.BackSide }));
    woodHull.scale.set(1.7, 1.03, 1.7);
    const headGeo = new THREE.ConeGeometry(0.05, 0.3, 6).rotateZ(Math.PI / 2);
    const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: MOLE.steel }));
    const headHull = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: MOLE.deep, side: THREE.BackSide }));
    headHull.scale.setScalar(1.35);
    head.position.y = headHull.position.y = 0.46;
    const edge = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: MOLE.foil }));
    edge.position.set(0.15, 0.46, 0);
    const edge2 = edge.clone();
    edge2.position.x = -0.15;
    this.pivot.add(woodHull, wood, headHull, head, edge, edge2);
    this.mesh.add(this.pivot);
    this.mesh.visible = false;
    for (const c of this.pivot.children) c.frustumCulled = false;
  }

  hide() {
    this.mesh.visible = false;
  }

  place(base: THREE.Vector3, yaw: number, swing: number, scale = 1.6) {
    this.mesh.visible = scale > 0.01;
    this.mesh.position.copy(base);
    this.mesh.rotation.y = yaw;
    this.mesh.scale.setScalar(Math.max(scale, MIN));
    this.pivot.rotation.set(swing, 0, 0);
  }
}

/** A flat dust ring on the ground: `set(center, radius, opacity)`. Add `mesh`. */
export class GroundRing {
  readonly mesh: THREE.Mesh;

  constructor(color: number = MOLE.light) {
    this.mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.mesh.position.y = 0.07;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }

  set(center: THREE.Vector3, radius: number, opacity: number) {
    this.mesh.visible = opacity > 0.01 && radius > 0.01;
    this.mesh.position.set(center.x, 0.07, center.z);
    this.mesh.scale.set(Math.max(radius, MIN), 1, Math.max(radius, MIN));
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
  }
}

/** A crescent stroke lying on the ground, between radii that swell in the middle, from angle `a0` to `a1` (yaw convention). */
function strokeGeo(r: number, w: number, a0: number, a1: number, seg = 16) {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, a = a0 + (a1 - a0) * u, sw = Math.sin(Math.PI * u) ** 0.6 * w;
    pos.push(Math.sin(a) * (r - sw * 0.5), 0, Math.cos(a) * (r - sw * 0.5), Math.sin(a) * (r + sw * 0.5), 0, Math.cos(a) * (r + sw * 0.5));
    if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/**
 * The three gold strokes of her claw swipe, laid on the ground in front of her, each over a dark stroke. `set(origin, yaw, k,
 * opacity)`: `k` 0..1 sweeps them across the cone from one edge to the other. Add `mesh`.
 */
export class ClawArcs {
  readonly mesh = new THREE.Group();
  private arcs: THREE.Group[] = [];

  constructor(reach: number, span: number) {
    const radii = [reach * 0.5, reach * 0.74, reach * 0.96];
    radii.forEach((r, i) => {
      const g = new THREE.Group();
      const len = span * (0.5 - i * 0.06);
      const dark = new THREE.Mesh(strokeGeo(r, 0.5, -len / 2, len / 2), new THREE.MeshBasicMaterial({ color: MOLE.deep, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const gold = new THREE.Mesh(strokeGeo(r, 0.3, -len / 2 + 0.05, len / 2 - 0.05), new THREE.MeshBasicMaterial({ color: i === 1 ? MOLE.hot : MOLE.foil, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      dark.position.y = 0.09;
      gold.position.y = 0.11;
      dark.renderOrder = 3;
      gold.renderOrder = 4;
      g.add(dark, gold);
      for (const c of g.children) c.frustumCulled = false;
      this.mesh.add(g);
      this.arcs.push(g);
    });
    this.mesh.visible = false;
    this.span = span;
  }

  private span: number;

  set(origin: THREE.Vector3, yaw: number, k: number, opacity: number) {
    this.mesh.visible = opacity > 0.01;
    this.mesh.position.set(origin.x, 0, origin.z);
    this.arcs.forEach((g, i) => {
      const kk = Math.min(1, Math.max(0, k * 1.15 - i * 0.07));
      g.rotation.y = yaw + (0.5 - kk) * this.span * 0.5;
      for (const c of g.children) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.min(1, opacity * (i === 1 ? 1 : 0.85));
    });
  }
}

/**
 * Radial cracks that run out from a point along the ground: thin dark strips (0.16 m wide, a gold glint line beside each) that grow
 * out to their length. `set(center, reach, grow, opacity)`: `reach` the radius, `grow` 0..1. Seeded, so both screens agree. Add `mesh`.
 */
export class Cracks {
  readonly mesh = new THREE.Group();
  private strips: { dark: THREE.Mesh; glint: THREE.Mesh; yaw: number; len: number }[] = [];

  constructor(count = 9) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    for (let i = 0; i < count; i++) {
      const dark = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: MOLE.deep, transparent: true, depthWrite: false }));
      const glint = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: MOLE.foil, transparent: true, depthWrite: false }));
      dark.position.y = 0.06;
      glint.position.y = 0.065;
      dark.renderOrder = 3;
      glint.renderOrder = 4;
      dark.frustumCulled = glint.frustumCulled = false;
      this.mesh.add(dark, glint);
      this.strips.push({ dark, glint, yaw: (i / count) * Math.PI * 2 + (hash(i) - 0.5) * 0.5, len: 0.6 + hash(i + 5) * 0.4 });
    }
    this.mesh.visible = false;
  }

  set(center: THREE.Vector3, reach: number, grow: number, opacity: number) {
    this.mesh.visible = grow > 0.01 && opacity > 0.01;
    for (const s of this.strips) {
      const len = Math.max(MIN, reach * s.len * Math.min(1, grow));
      for (const [m, w] of [[s.dark, 0.2], [s.glint, 0.06]] as [THREE.Mesh, number][]) {
        m.position.x = center.x;
        m.position.z = center.z;
        m.rotation.y = s.yaw;
        m.scale.set(w, 1, len);
        (m.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
    }
  }
}

/** Rotates `v` about the vertical by `a` (helper for the effects). */
export function turnY(v: THREE.Vector3, a: number, out = new THREE.Vector3()) {
  return out.copy(v).applyAxisAngle(UP, a);
}
