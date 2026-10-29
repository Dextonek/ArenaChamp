import * as THREE from 'three';
import type { Projectile } from '../projectile';

/**
 * A generic skillshot bolt look for `ctx.projectile` handles (`effects/projectile.ts`): a small hot core, a flat
 * coloured body, a dark rim outside it, and a tapered trail behind; a hit gives a short spark tinted by the hit
 * colour. Flat unlit colours, normal blending (nothing additive), so a bolt never turns into a white blob under
 * bloom (docs/ART_BIBLE.md). Spells may use it or draw their own bolt from the same handle.
 *
 * - `BoltFx`  one bolt's meshes, handed out and taken back by the set's pool.
 * - `BoltSet` follows a handle and every child it splits into, draws a `BoltFx` for each and a spark for each hit.
 *
 * Use: `set = new BoltSet(group)`; when the bolt is fired `set.follow(handle, look)`; each frame `set.update(dt)`;
 * `set.busy` stays true while something is still flying or fading (keep the effect `playing` until it is false).
 */
export interface BoltLook {
  /** Hot centre (a pale tint of the body colour, not white). */
  core: string;
  /** The coloured body. */
  body: string;
  /** Dark outline and the tail end of the trail. */
  rim: string;
  /** Visual radius of the body (m). */
  size: number;
  /** Trail length at full speed (m). */
  trail: number;
  /** Spark colour on a hit (css). */
  hit: string;
}

export const defaultBoltLook = (): BoltLook => ({ core: '#ffe9b8', body: '#ff9a3c', rim: '#4a1408', size: 0.3, trail: 2.2, hit: '#ffb347' });

const STRETCH = 1.7; // the body is an ellipsoid, this much longer than wide
const DIE_TIME = 0.12;
const SPARK_LIFE = 0.38;
const SHARDS = 7;

let sphereGeo: THREE.SphereGeometry | undefined;
let trailGeo: THREE.BufferGeometry | undefined;
let shardGeo: THREE.BufferGeometry | undefined;
let ringGeo: THREE.RingGeometry | undefined;

/** A thin triangle in the XZ plane: base across the head (z = 0, x = -1..1), tip at the tail (z = -1). `aV` 0 → 1. */
function trailGeometry() {
  if (trailGeo) return trailGeo;
  trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 0, -1], 3));
  trailGeo.setAttribute('aV', new THREE.Float32BufferAttribute([0, 0, 1], 1));
  return trailGeo;
}

const trailVertex = /* glsl */ `
  attribute float aV;
  varying float vV;
  void main() {
    vV = aV;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const trailFragment = /* glsl */ `
  uniform vec3 uBody, uRim;
  uniform float uAlpha;
  varying float vV;
  void main() {
    gl_FragColor = vec4(mix(uBody, uRim, vV * 0.7), pow(1.0 - vV, 1.5) * 0.75 * uAlpha);
  }
`;

export class BoltFx {
  readonly group = new THREE.Group();
  /** Where the bolt started: the trail grows from here to its full length. */
  readonly start = new THREE.Vector3();
  look = defaultBoltLook();
  /** 0 while flying, then 0 → 1 as it fades out after the bolt ended. */
  dying = 0;
  private rim: THREE.Mesh;
  private body: THREE.Mesh;
  private core: THREE.Mesh;
  private trails: THREE.Mesh[] = [];
  private trailMat: THREE.ShaderMaterial;

  constructor() {
    sphereGeo ??= new THREE.SphereGeometry(1, 14, 10);
    const flat = (color: string, side: THREE.Side) => new THREE.MeshBasicMaterial({ color, side });
    // Core in front, body and rim as back faces of bigger shells: from outside you see the hot core, then a flat body
    // ring, then the dark rim ring, with no depth fighting between the three.
    this.core = new THREE.Mesh(sphereGeo, flat('#ffffff', THREE.FrontSide));
    this.body = new THREE.Mesh(sphereGeo, flat('#ffffff', THREE.BackSide));
    this.rim = new THREE.Mesh(sphereGeo, flat('#000000', THREE.BackSide));
    this.trailMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uBody: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uAlpha: { value: 1 } },
      vertexShader: trailVertex,
      fragmentShader: trailFragment,
    });
    // One trail lying flat and one standing up, so the tail reads from the top-down camera and from the side.
    for (const roll of [0, Math.PI / 2]) {
      const t = new THREE.Mesh(trailGeometry(), this.trailMat);
      t.rotation.z = roll;
      t.renderOrder = 3;
      this.trails.push(t);
    }
    this.group.add(this.rim, this.body, this.core, ...this.trails);
    this.setLook(this.look);
    this.group.visible = false;
  }

  setLook(look: BoltLook) {
    this.look = look;
    (this.core.material as THREE.MeshBasicMaterial).color.set(look.core);
    (this.body.material as THREE.MeshBasicMaterial).color.set(look.body);
    (this.rim.material as THREE.MeshBasicMaterial).color.set(look.rim);
    this.trailMat.uniforms.uBody.value.set(look.body);
    this.trailMat.uniforms.uRim.value.set(look.rim);
  }

  /** Puts the bolt at `pos` flying along `dir` (ground plane). */
  place(pos: THREE.Vector3, dir: THREE.Vector3) {
    const k = 1 - this.dying;
    const s = this.look.size;
    this.group.position.copy(pos);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);
    this.core.scale.set(s * 0.5 * k, s * 0.5 * k, s * 0.5 * STRETCH * k);
    this.body.scale.set(s * k, s * k, s * STRETCH * k);
    this.rim.scale.set(s * 1.3 * k, s * 1.3 * k, s * 1.3 * STRETCH * k);
    const len = Math.min(this.look.trail, pos.distanceTo(this.start)) * k;
    for (const t of this.trails) t.scale.set(s * 0.9, s * 0.9, Math.max(0.001, len));
    this.trailMat.uniforms.uAlpha.value = k;
    this.group.visible = true;
  }
}

class Spark {
  readonly group = new THREE.Group();
  t = SPARK_LIFE;
  private shards: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];
  private ring: THREE.Mesh;
  private mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, side: THREE.DoubleSide });

  constructor() {
    shardGeo ??= new THREE.OctahedronGeometry(0.1).scale(1, 1.6, 0.5);
    ringGeo ??= new THREE.RingGeometry(0.78, 1, 32).rotateX(-Math.PI / 2);
    for (let i = 0; i < SHARDS; i++) {
      const mesh = new THREE.Mesh(shardGeo, this.mat);
      this.shards.push({ mesh, vel: new THREE.Vector3() });
      this.group.add(mesh);
    }
    this.ring = new THREE.Mesh(ringGeo, this.mat);
    this.group.add(this.ring);
    this.group.visible = false;
  }

  fire(at: THREE.Vector3, color: string) {
    this.t = 0;
    this.mat.color.set(color);
    this.group.position.copy(at);
    for (const s of this.shards) {
      const a = Math.random() * Math.PI * 2;
      s.vel.set(Math.cos(a) * (2 + Math.random() * 2.5), 0.6 + Math.random() * 2.2, Math.sin(a) * (2 + Math.random() * 2.5));
      s.mesh.position.set(0, 0, 0);
      s.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    }
    this.group.visible = true;
  }

  get done() {
    return this.t >= SPARK_LIFE;
  }

  update(dt: number) {
    if (this.done) return;
    this.t += dt;
    const k = Math.min(1, this.t / SPARK_LIFE);
    for (const s of this.shards) {
      s.mesh.position.addScaledVector(s.vel, dt);
      s.vel.y -= 9 * dt;
      s.mesh.scale.setScalar(1 - k * k);
    }
    // A ring on the floor under the hit, quick out, fading.
    this.ring.position.y = 0.05 - this.group.position.y;
    this.ring.scale.setScalar(0.25 + 1.0 * (1 - (1 - k) ** 3));
    this.mat.opacity = 1 - k * k;
    if (this.done) this.group.visible = false;
  }
}

interface Entry {
  fx: BoltFx;
  look: BoltLook;
  done: boolean;
}

export class BoltSet {
  private entries = new Map<Projectile, Entry>();
  private roots: { root: Projectile; look: BoltLook }[] = [];
  private free: BoltFx[] = [];
  private sparks: Spark[] = [];

  constructor(private parent: THREE.Group) {}

  /** Draws `root` and everything it splits into with `look`; hits spark in `look.hit`. */
  follow(root: Projectile, look: BoltLook) {
    this.roots.push({ root, look });
    root.onHit((_target, pos) => this.spark(pos, look.hit));
  }

  /** True while a bolt is flying or fading, or a spark is playing. */
  get busy() {
    return this.roots.length > 0 || this.sparks.some((s) => !s.done);
  }

  /** Drops everything shown (a new cast replaces the old one). */
  clear() {
    for (const e of this.entries.values()) this.release(e);
    this.entries.clear();
    this.roots.length = 0;
    for (const s of this.sparks) { s.t = SPARK_LIFE; s.group.visible = false; }
  }

  update(dt: number) {
    for (const r of this.roots) this.visit(r.root, r.look, dt);
    for (const s of this.sparks) s.update(dt);
    // A tree that has fully ended and faded is forgotten.
    this.roots = this.roots.filter((r) => !this.finished(r.root) || this.hasShown(r.root));
  }

  private finished(p: Projectile): boolean {
    return !p.alive && p.children.every((c) => this.finished(c));
  }

  private hasShown(p: Projectile): boolean {
    const e = this.entries.get(p);
    return (!!e && !e.done) || p.children.some((c) => this.hasShown(c));
  }

  private visit(p: Projectile, look: BoltLook, dt: number) {
    let e = this.entries.get(p);
    if (!e) {
      const fx = this.free.pop() ?? this.make();
      fx.setLook(look);
      fx.start.copy(p.pos);
      fx.dying = 0;
      e = { fx, look, done: false };
      this.entries.set(p, e);
    }
    if (!e.done) {
      if (p.alive) e.fx.place(p.pos, p.dir);
      else {
        e.fx.dying = Math.min(1, e.fx.dying + dt / DIE_TIME);
        e.fx.place(p.pos, p.dir);
        if (e.fx.dying >= 1) { e.done = true; this.release(e); }
      }
    }
    for (const c of p.children) this.visit(c, look, dt);
  }

  private make() {
    const fx = new BoltFx();
    this.parent.add(fx.group);
    return fx;
  }

  private release(e: Entry) {
    e.fx.group.visible = false;
    e.done = true;
    if (!this.free.includes(e.fx)) this.free.push(e.fx);
  }

  private spark(pos: THREE.Vector3, color: string) {
    let s = this.sparks.find((x) => x.done);
    if (!s) {
      s = new Spark();
      this.sparks.push(s);
      this.parent.add(s.group);
    }
    s.fire(pos, color);
  }
}
