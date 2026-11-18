import * as THREE from 'three';

/**
 * The plain look of the engine pieces (src/mech), drawn on both screens from what both have: a ward's pale ribbon or ring,
 * one-sided ground's dark strip with an ember edge, a leash's chain, a sleeper's ring, a token's diamond, an attractor's
 * faint ring. A hero who uses a piece draws its own look over it (marks, parts); this one is there so that every piece
 * reads on the floor from the first day, and for the tests' pictures. Pooled: nothing is made per frame.
 */

const Y = 0.06;
type Kind = 'ward' | 'barrier' | 'edge' | 'chain' | 'sleep' | 'token' | 'pull';

const COLORS: Record<Kind, number> = {
  ward: 0xfff6e0, barrier: 0x070506, edge: 0xff6a2a, chain: 0xd8d2c4, sleep: 0xb9a4ff, token: 0xffcf5a, pull: 0x9fd8ff,
};

export class MechFx {
  readonly group = new THREE.Group();
  private pools = new Map<Kind, THREE.Mesh[]>();
  private used = new Map<Kind, number>();
  private plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  private ring = new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2);
  private diamond = new THREE.OctahedronGeometry(0.16);
  private box = new THREE.BoxGeometry(0.11, 0.11, 1).translate(0, 0, 0.5);

  constructor() {
    this.group.renderOrder = 2;
  }

  /** Starts a frame: every piece drawn last frame is free again. */
  begin() {
    for (const k of this.used.keys()) this.used.set(k, 0);
  }

  /** Hides what this frame did not draw. */
  end() {
    for (const [k, list] of this.pools) {
      const n = this.used.get(k) ?? 0;
      for (let i = n; i < list.length; i++) list[i].visible = false;
    }
  }

  private take(kind: Kind, geo: THREE.BufferGeometry, opacity: number): THREE.Mesh {
    const list = this.pools.get(kind) ?? [];
    this.pools.set(kind, list);
    const n = this.used.get(kind) ?? 0;
    this.used.set(kind, n + 1);
    let m = list[n];
    if (!m) {
      m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLORS[kind], transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
      list.push(m);
      this.group.add(m);
    }
    m.geometry = geo;
    (m.material as THREE.MeshBasicMaterial).opacity = opacity;
    m.visible = true;
    m.rotation.set(0, 0, 0);
    m.scale.set(1, 1, 1);
    return m;
  }

  /** A flat strip on the floor from a to b, `width` wide. */
  strip(kind: Kind, a: { x: number; z: number }, b: { x: number; z: number }, width: number, opacity: number, y = Y) {
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const m = this.take(kind, this.plane, opacity);
    m.position.set(a.x, y, a.z);
    m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    m.scale.set(width, 1, Math.max(0.01, L));
    return m;
  }

  /** A ring on the floor. */
  circle(kind: Kind, x: number, z: number, r: number, opacity: number) {
    const m = this.take(kind, this.ring, opacity);
    m.position.set(x, Y + 0.005, z);
    m.scale.set(r, 1, r);
    return m;
  }

  /** One-sided ground: a dark strip with an ember edge along both sides. */
  chasm(a: { x: number; z: number }, b: { x: number; z: number }, width: number) {
    this.strip('barrier', a, b, width, 0.92);
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = (b.z - a.z) / L, nz = -(b.x - a.x) / L;
    for (const s of [1, -1]) {
      this.strip('edge', { x: a.x + nx * s * width / 2, z: a.z + nz * s * width / 2 }, { x: b.x + nx * s * width / 2, z: b.z + nz * s * width / 2 }, 0.14, 0.95, Y + 0.004);
    }
  }

  /** A chain at waist height from a to b. */
  chain(a: { x: number; z: number }, b: { x: number; z: number }) {
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const m = this.take('chain', this.box, 0.95);
    m.position.set(a.x, 0.9, a.z);
    m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    m.scale.set(1, 1, Math.max(0.01, L));
  }

  /** A token: a turning gold diamond (over a holder's head, or on the floor). */
  token(x: number, y: number, z: number, t: number) {
    const m = this.take('token', this.diamond, 0.95);
    m.position.set(x, y + Math.sin(t * 3) * 0.06, z);
    m.rotation.y = t * 2;
  }
}
