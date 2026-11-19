import * as THREE from 'three';
import { C } from './numbers';

/**
 * Kagen's look pieces, shared by his spells and his cut marks (Issen, Noto, `marks.ts`). Everything is made in a constructor or
 * a builder, never when the file is loaded (a draft's files are loaded with the game's), and takes no dice: a hash of an index.
 *
 * - `lens`: the almond of a cut, a thin pointed blade-shape, unit long (x -0.5..0.5) and unit thick (y -0.5..0.5) before scaling.
 * - `Blade`: a lens lying on its side for the floor or the air, its length along z, placed by `set`.
 * - `Slit`: an upright cut, a cinnabar almond with a rice-paper rim, for the marks and for the cuts that open on a foe.
 * - `Flecks`: a few rice-paper flakes that rise and drift (hash-driven, one shared material).
 * - `ringGeo`, `softPaper`: a thin flat ring; the colours as three.js colours.
 */
export const INK = new THREE.Color(C.dark);
export const CINNABAR = new THREE.Color(C.accent);
export const PAPER = new THREE.Color(C.foil);
export const STEEL = new THREE.Color(C.steel);
export const GOLD = new THREE.Color(C.gold);

export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** The almond: pointed at both ends, `0.5 * (1 - (2x)^2)` high on each side. */
export function lens(seg = 12): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i <= seg; i++) {
    const x = -0.5 + i / seg;
    const y = 0.5 * (1 - 4 * x * x);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  for (let i = seg; i >= 0; i--) {
    const x = -0.5 + i / seg;
    s.lineTo(x, -0.5 * (1 - 4 * x * x));
  }
  return new THREE.ShapeGeometry(s);
}

const mat = (color: THREE.Color, opacity = 0, additive = false) => new THREE.MeshBasicMaterial({
  color: color.clone(), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});

/** A lens lying flat (a floor line or a streak in the air), its length along the direction it is pointed in. */
export class Blade {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  constructor(color: THREE.Color, additive = false, order = 3) {
    this.material = mat(color, 0, additive);
    const g = lens().rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.renderOrder = order;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** From `a` metres to `b` metres along `dir` from `from`, `width` wide, at height `y`; a zero opacity hides it. */
  set(from: THREE.Vector3, dir: THREE.Vector3, a: number, b: number, width: number, y: number, opacity: number, side = 0) {
    const len = b - a;
    this.mesh.visible = opacity > 0.003 && len > 0.01 && width > 1e-4;
    if (!this.mesh.visible) return;
    const m = (a + b) / 2;
    this.mesh.position.set(from.x + dir.x * m - dir.z * side, y, from.z + dir.z * m + dir.x * side);
    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    this.mesh.scale.set(width, 1, len);
    this.material.opacity = opacity;
  }

  hide() {
    this.mesh.visible = false;
  }
}

/** A thin flat ring in the XZ plane, radius 1 (scale it), `width` of the radius thick. */
export function flatRing(color: THREE.Color, width = 0.012, additive = false, order = 3) {
  const material = mat(color, 0, additive);
  const mesh = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 96).rotateX(-Math.PI / 2), material);
  mesh.renderOrder = order;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, material };
}

/** An upright cut: a cinnabar almond over a wider rice-paper rim, in the XY plane, `len` long, at `angle` radians. */
export class Slit {
  readonly group = new THREE.Group();
  private core: THREE.Mesh;
  private rim: THREE.Mesh;
  readonly coreMat: THREE.MeshBasicMaterial;
  readonly rimMat: THREE.MeshBasicMaterial;
  constructor(len: number, thick: number, angle: number, rim = 0.045, order = 6, depthTest = false) {
    const g = lens();
    this.coreMat = mat(CINNABAR, 0.95);
    this.rimMat = mat(PAPER, 0.9);
    this.coreMat.depthTest = this.rimMat.depthTest = depthTest;
    this.rim = new THREE.Mesh(g, this.rimMat);
    this.core = new THREE.Mesh(g, this.coreMat);
    this.rim.scale.set(len + rim * 1.6, thick + rim * 2, 1);
    this.core.scale.set(len, thick, 1);
    this.core.position.z = 0.004;
    this.rim.renderOrder = order;
    this.core.renderOrder = order + 1;
    this.group.add(this.rim, this.core);
    this.group.rotation.z = angle;
  }

  /** 0 hidden, 1 fully open: the almond opens across (`open`) and fades by `opacity`. */
  open(open: number, opacity = 1) {
    this.group.visible = open > 0.01 && opacity > 0.01;
    this.group.scale.set(1, Math.max(open, 1e-3), 1);
    this.coreMat.opacity = 0.95 * opacity;
    this.rimMat.opacity = 0.9 * opacity;
  }
}

/** Rice-paper flakes: `n` small diamonds on one shared material; `burst` throws them, `update` ages them. */
export class Flecks {
  readonly group = new THREE.Group();
  private items: { m: THREE.Mesh; v: THREE.Vector3; age: number; life: number; spin: number }[] = [];
  private material = mat(PAPER, 0.9);
  private next = 0;
  constructor(n: number, size = 0.11) {
    const g = new THREE.PlaneGeometry(size, size * 1.7);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, this.material);
      m.visible = false;
      m.renderOrder = 5;
      m.frustumCulled = false;
      this.group.add(m);
      this.items.push({ m, v: new THREE.Vector3(), age: 9, life: 1, spin: 0 });
    }
  }

  reset() {
    this.next = 0;
    for (const f of this.items) { f.age = 9; f.m.visible = false; }
  }

  /** One flake at `at`, thrown `speed` m/s along (dx, dz), rising `up`; `i` seeds its spin. */
  put(at: THREE.Vector3, dx: number, dz: number, speed: number, up: number, life: number, i: number) {
    const f = this.items[this.next++ % this.items.length];
    f.m.position.copy(at);
    f.v.set(dx * speed, up, dz * speed);
    f.age = 0;
    f.life = life;
    f.spin = (hash(i + 3) - 0.5) * 14;
    f.m.rotation.set(-Math.PI / 2 + (hash(i + 9) - 0.5) * 1.2, 0, hash(i + 5) * 6.28);
    f.m.visible = true;
  }

  update(dt: number) {
    for (const f of this.items) {
      if (f.age >= f.life) { f.m.visible = false; continue; }
      f.age += dt;
      f.v.y -= 2.2 * dt;
      f.v.multiplyScalar(Math.max(0, 1 - 2.4 * dt));
      f.m.position.addScaledVector(f.v, dt);
      f.m.rotation.z += f.spin * dt;
      const k = clamp01(1 - f.age / f.life);
      f.m.scale.setScalar(Math.max(0.05, k));
    }
    this.material.opacity = 0.9;
  }
}
