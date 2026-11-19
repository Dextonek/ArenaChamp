import * as THREE from 'three';
import { clamp01, easeOut, hash, smooth } from '../../../heroes/sheath/partsBig';

/**
 * Look pieces of gallery group 2 (quetzal descent, runestone fall; pipeline/designs/gallery-20.md). Everything is made in a
 * constructor, never when the file is loaded, and takes no dice: a hash of an index. Nothing allocates per frame.
 *
 * - `Chips`: a pool of flat or solid chips (feathers, stone, frost) on one instanced mesh: thrown, they fall, rest, shrink away.
 * - `Glyphs`: a canvas atlas of eight Elder Futhark runes and plane geometries that show one of them.
 * - `glowTexture`, `streakTexture`: soft canvas gradients.
 * - `placeOn`: an instance matrix from a position, a forward direction, a roll and a scale.
 */
export { clamp01, easeOut, hash, smooth };

const tmpObj = new THREE.Object3D();
const HIDE = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4).setPosition(0, -60, 0);

/** A pool of chips on one InstancedMesh with per-chip colours: `put` throws one, `update` flies, rests and shrinks them. */
export class Chips {
  readonly mesh: THREE.InstancedMesh;
  private pos: Float32Array;
  private vel: Float32Array;
  private rot: Float32Array;
  private spin: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private grav: Float32Array;
  private flat: Uint8Array;
  private head = 0;
  private col = new THREE.Color();

  constructor(private n: number, geo: THREE.BufferGeometry, material: THREE.Material, private floor = 0.05) {
    this.mesh = new THREE.InstancedMesh(geo, material, n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.rot = new Float32Array(n * 3);
    this.spin = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(9);
    this.life = new Float32Array(n).fill(1);
    this.size = new Float32Array(n).fill(1);
    this.grav = new Float32Array(n).fill(9);
    this.flat = new Uint8Array(n);
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, HIDE); this.mesh.setColorAt(i, this.col.set(0xffffff)); }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.head = 0;
    for (let i = 0; i < this.n; i++) { this.age[i] = 9; this.mesh.setMatrixAt(i, HIDE); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** One chip at (x, y, z) moving (vx, vy, vz), `size` big, for `life` s, pulled down at `grav`; `seed` varies its turning. */
  put(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color, size: number, life: number, seed: number, grav = 9, lie = false) {
    const i = this.head;
    this.head = (this.head + 1) % this.n;
    const b = i * 3;
    this.pos[b] = x; this.pos[b + 1] = y; this.pos[b + 2] = z;
    this.vel[b] = vx; this.vel[b + 1] = vy; this.vel[b + 2] = vz;
    this.rot[b] = hash(seed + 1) * 6.28; this.rot[b + 1] = hash(seed + 2) * 6.28; this.rot[b + 2] = hash(seed + 3) * 6.28;
    this.spin[b] = (hash(seed + 4) - 0.5) * 12; this.spin[b + 1] = (hash(seed + 5) - 0.5) * 12; this.spin[b + 2] = (hash(seed + 6) - 0.5) * 12;
    this.age[i] = 0; this.life[i] = life; this.size[i] = size; this.grav[i] = grav; this.flat[i] = lie ? 1 : 0;
    this.mesh.setColorAt(i, this.col.copy(color).multiplyScalar(0.7 + 0.25 * hash(seed + 7)));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    let touched = false;
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) {
        if (this.age[i] < 9) { this.age[i] = 9; this.mesh.setMatrixAt(i, HIDE); touched = true; }
        continue;
      }
      touched = true;
      const b = i * 3;
      this.age[i] += dt;
      const drag = Math.exp(-1.4 * dt);
      this.vel[b] *= drag; this.vel[b + 2] *= drag;
      this.vel[b + 1] -= this.grav[i] * dt;
      this.pos[b] += this.vel[b] * dt; this.pos[b + 1] += this.vel[b + 1] * dt; this.pos[b + 2] += this.vel[b + 2] * dt;
      let rest = false;
      if (this.pos[b + 1] < this.floor) {
        this.pos[b + 1] = this.floor;
        this.vel[b] *= 0.35; this.vel[b + 2] *= 0.35;
        this.vel[b + 1] = this.vel[b + 1] < -2 ? -this.vel[b + 1] * 0.25 : 0;
        rest = this.vel[b + 1] === 0;
      }
      if (rest) { this.spin[b] *= 0.8; this.spin[b + 1] *= 0.8; this.spin[b + 2] *= 0.8; }
      this.rot[b] += this.spin[b] * dt; this.rot[b + 1] += this.spin[b + 1] * dt; this.rot[b + 2] += this.spin[b + 2] * dt;
      const f = this.age[i] / this.life[i];
      const s = this.size[i] * (f < 0.06 ? f / 0.06 : 1 - smooth((f - 0.6) / 0.4)) + 1e-3;
      tmpObj.position.set(this.pos[b], this.pos[b + 1], this.pos[b + 2]);
      if (this.flat[i] && rest) tmpObj.rotation.set(0, this.rot[b + 1], 0); else tmpObj.rotation.set(this.rot[b], this.rot[b + 1], this.rot[b + 2]);
      tmpObj.scale.setScalar(s);
      tmpObj.updateMatrix();
      this.mesh.setMatrixAt(i, tmpObj.matrix);
    }
    if (touched) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** An instance matrix: at `p`, long axis (z) along `fwd`, rolled by `roll` round it, scaled (sx, sy, sz). */
const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3(), bm = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0), ALT = new THREE.Vector3(1, 0, 0);
export function placeOn(mesh: THREE.InstancedMesh, i: number, p: THREE.Vector3, fwd: THREE.Vector3, roll: number, sx: number, sy: number, sz: number) {
  bz.copy(fwd).normalize();
  bx.crossVectors(Math.abs(bz.y) > 0.97 ? ALT : UP, bz).normalize();
  by.crossVectors(bz, bx);
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const rx = bx.x * c + by.x * s, ry = bx.y * c + by.y * s, rz = bx.z * c + by.z * s;
    by.set(by.x * c - bx.x * s, by.y * c - bx.y * s, by.z * c - bx.z * s);
    bx.set(rx, ry, rz);
  }
  bm.makeBasis(bx.multiplyScalar(Math.max(sx, 1e-4)), by.multiplyScalar(Math.max(sy, 1e-4)), bz.multiplyScalar(Math.max(sz, 1e-4)));
  bm.setPosition(p);
  mesh.setMatrixAt(i, bm);
}

/** A soft round glow, white at the middle to clear at the rim (tint it with the material's colour). */
export function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A streak: white at the bottom of the picture to clear at the top, narrow edges (a comet's tail standing on its head). */
export function streakTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 256, 0, 0);
  v.addColorStop(0, 'rgba(255,255,255,1)');
  v.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.beginPath();
  g.moveTo(32, 0); g.lineTo(60, 256); g.lineTo(4, 256);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Eight Elder Futhark runes, 4 x 2 in a canvas atlas, white strokes on clear. */
export function runeAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#fff';
  g.lineWidth = 11;
  g.lineCap = 'square';
  g.lineJoin = 'miter';
  const R: number[][][] = [
    [[64, 18, 64, 110], [64, 46, 98, 24], [64, 76, 98, 54]],
    [[38, 110, 38, 18], [38, 18, 90, 54], [90, 54, 90, 110]],
    [[48, 18, 48, 110], [48, 40, 92, 64], [92, 64, 48, 88]],
    [[48, 18, 48, 110], [48, 36, 92, 58], [48, 62, 92, 84]],
    [[44, 18, 44, 110], [44, 18, 90, 42], [90, 42, 44, 66], [44, 66, 92, 110]],
    [[90, 30, 44, 64], [44, 64, 90, 98]],
    [[42, 24, 88, 104], [88, 24, 42, 104]],
    [[44, 18, 44, 110], [44, 18, 90, 42], [90, 42, 44, 66]],
  ];
  R.forEach((strokes, k) => {
    const ox = (k % 4) * 128, oy = Math.floor(k / 4) * 128;
    g.beginPath();
    for (const [x1, y1, x2, y2] of strokes) { g.moveTo(ox + x1, oy + y1); g.lineTo(ox + x2, oy + y2); }
    g.stroke();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A unit plane (x, y in -0.5..0.5) whose picture is rune `k` of the atlas. */
export function runePlane(k: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(1, 1);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const u0 = (k % 4) / 4, v0 = 1 - (Math.floor(k / 4) + 1) / 2;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 4, v0 + uv.getY(i) / 2);
  return g;
}
