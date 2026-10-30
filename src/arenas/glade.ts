import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pillar, wall, type Obstacle } from '../obstacles';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef, ArenaStage } from './types';

/**
 * Verdant Glade: an old forest clearing at golden dusk. Dark moss-and-earth floor with a canvas texture (moss, leaf
 * litter, stepping stones), a ring of mossy rim stones, broken ancient trunks, carved standing stones and fallen
 * logs as cover; an apron of forest floor with a wall of tall trees (only beyond radius 19), bushes and rocks;
 * warm fireflies and a few falling leaves drift over it. Ground detail: grass clumps, flowers, mushrooms at the roots
 * and logs, ferns along the rim stones; far canopy silhouette and soft god rays behind.
 */

const STAGE: ArenaStage = {
  background: 0x1a2e1e,
  zenith: 0x07120c,
  horizon: 0x24402a,
  glow: 0xd8b860,
  stars: 0.4,
  fog: 0x1a2e1e,
  fogNear: 35,
  fogFar: 120,
  hemiSky: 0xcfe8b0,
  hemiGround: 0x1a140a,
  hemiIntensity: 0.65,
  sun: 0xffe6b0,
  sunIntensity: 1.5,
  rim: 0xa8ffc8,
  rimIntensity: 0.7,
};

const withHeight = (o: Obstacle, height: number): Obstacle => ({ ...o, height });

const OBSTACLES: Obstacle[] = [
  withHeight(pillar(2.5, 7, 0.7), 4),
  withHeight(pillar(-2.5, 7, 0.7), 4),
  withHeight(pillar(5, 3, 0.7), 2.7),
  withHeight(pillar(-5, 11, 0.7), 2.7),
  withHeight(pillar(-6, 4, 0.7), 2.7),
  withHeight(pillar(6, 10, 0.7), 2.7),
  withHeight(wall(8, 6, 9.5, 8), 1),
  withHeight(wall(-8, 8, -9.5, 6), 1),
];

// ---- merge helper: collects transformed geometry with a vertex colour, merges it into one mesh ----------------

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

interface Xf {
  rx?: number; ry?: number; rz?: number;
  sx?: number; sy?: number; sz?: number;
  q?: THREE.Quaternion;
}

class Bucket {
  geos: THREE.BufferGeometry[] = [];
  /** `color`: a hex number, or a function of the vertex's local y, x, z (for gradients and stripes). */
  add(src: THREE.BufferGeometry, x: number, y: number, z: number, color: number | ((ly: number, lx: number, lz: number) => number), o: Xf = {}) {
    const g = src.index ? src.toNonIndexed() : src.clone();
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      _c.setHex(typeof color === 'number' ? color : color(pos.getY(i), pos.getX(i), pos.getZ(i)));
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (o.q) _q.copy(o.q); else _q.setFromEuler(_e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0));
    _m.compose(_p.set(x, y, z), _q, _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    g.applyMatrix4(_m);
    this.geos.push(g);
  }
  mesh(mat: THREE.Material, shadow = true) {
    const merged = mergeGeometries(this.geos, false);
    for (const g of this.geos) g.dispose();
    if (!merged) throw new Error('glade: geometry merge failed');
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = m.receiveShadow = shadow;
    return m;
  }
}

interface Inst { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; color: number }

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Inst[], shadow: boolean) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    _m.compose(_p.set(it.x, it.y, it.z), _q.setFromAxisAngle(UP, it.ry), _s.set(it.sx, it.sy, it.sz));
    m.setMatrixAt(i, _m);
    m.setColorAt(i, _c.setHex(it.color));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = m.receiveShadow = shadow;
  return m;
}

// ---- textures --------------------------------------------------------------------------------------------------

function blob(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, fill: string, alpha: number) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Moss patches and leaf litter on dark earth; `stones` adds flat stepping stones (floor only). */
function groundTexture(size: number, seed: number, stones: boolean, repeat: number) {
  return canvasTexture(
    size,
    (g, s) => {
      const rnd = seeded(seed);
      g.fillStyle = '#141a12';
      g.fillRect(0, 0, s, s);
      const mossCols = ['#1d2a16', '#1a2613', '#101709', '#22301a'];
      for (let i = 0; i < s / 6; i++) {
        const r = s * (0.02 + rnd() * 0.05);
        blob(g, rnd() * s, rnd() * s, r, r * (0.5 + rnd() * 0.5), rnd() * Math.PI, mossCols[Math.floor(rnd() * mossCols.length)], 0.35 + rnd() * 0.3);
      }
      const litter = ['#2c1f10', '#33260f', '#241a0c', '#2a2410'];
      for (let i = 0; i < s * 1.2; i++) {
        const r = s * (0.003 + rnd() * 0.004);
        blob(g, rnd() * s, rnd() * s, r, r * 0.55, rnd() * Math.PI, litter[Math.floor(rnd() * litter.length)], 0.45 + rnd() * 0.3);
      }
      if (stones) {
        // A loose path of flat stones curving between the two starts. Canvas x = world x, canvas y = world z - 7.
        const sc = s / 24;
        for (let i = 0; i < 16; i++) {
          const t = i / 15;
          const wx = Math.sin(t * Math.PI * 2) * 1.6 * (1 - t * 0.4) + (rnd() - 0.5) * 0.7;
          const wz = -5.6 + t * 11.2 + (rnd() - 0.5) * 0.5;
          const px = s / 2 + wx * sc, py = s / 2 + wz * sc;
          const r = sc * (0.28 + rnd() * 0.18);
          blob(g, px, py, r * 1.06, r * 0.9, rnd() * Math.PI, '#0c100a', 0.5);
          blob(g, px, py, r, r * 0.85, rnd() * Math.PI, '#2c2f2a', 0.9);
          blob(g, px - r * 0.2, py - r * 0.2, r * 0.5, r * 0.35, 0, '#1f3018', 0.5);
        }
      }
    },
    repeat,
  );
}

/** A small angular rune (white on clear), drawn dim teal by its material. */
function runeTexture() {
  return canvasTexture(128, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.12); g.lineTo(s * 0.5, s * 0.88);
    g.moveTo(s * 0.5, s * 0.28); g.lineTo(s * 0.74, s * 0.46); g.lineTo(s * 0.5, s * 0.64);
    g.moveTo(s * 0.5, s * 0.5); g.lineTo(s * 0.26, s * 0.7);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.42, 0, Math.PI * 2);
    g.stroke();
  });
}

/** A soft vertical light beam: bright in the middle, fading sideways and at both ends. */
function rayTexture() {
  return canvasTexture(128, (g, s) => {
    g.clearRect(0, 0, s, s);
    const h = g.createLinearGradient(0, 0, s, 0);
    h.addColorStop(0, 'rgba(255,255,255,0)');
    h.addColorStop(0.3, 'rgba(255,255,255,0.35)');
    h.addColorStop(0.5, 'rgba(255,255,255,1)');
    h.addColorStop(0.7, 'rgba(255,255,255,0.35)');
    h.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = h;
    g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'destination-in';
    const v = g.createLinearGradient(0, 0, 0, s);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.3, 'rgba(0,0,0,1)');
    v.addColorStop(0.65, 'rgba(0,0,0,0.6)');
    v.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, s, s);
  });
}

function leafTexture() {
  return canvasTexture(32, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(s / 2, s / 2, s * 0.42, s * 0.2, 0.6, 0, Math.PI * 2);
    g.fill();
  });
}

function glowTexture() {
  return canvasTexture(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
}

// ---- props -----------------------------------------------------------------------------------------------------

/** A broken-off trunk 4 m tall: bark ripple, a flared foot with buttress lobes, jagged top (functions of the angle keep the seam closed). */
function trunkGeometry(phase: number) {
  const g = new THREE.CylinderGeometry(0.62, 0.8, 4, 28, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = p.getY(i);
    const th = Math.atan2(z, x);
    const low = Math.max(0, 1 - (y + 2) / 1.3);
    const k = 1 + 0.07 * Math.sin(9 * th + phase) + 0.035 * Math.sin(17 * th + phase * 1.7)
      + 0.3 * low * low * (0.4 + 0.6 * (0.5 + 0.5 * Math.cos(5 * th + phase)));
    p.setX(i, x * k);
    p.setZ(i, z * k);
    if (y > 1.9) y += Math.hypot(x, z) > 1e-4 ? 0.25 * Math.sin(3 * th + phase) + 0.1 * Math.sin(7 * th + phase * 2) : 0.05;
    p.setY(i, y + 2);
  }
  g.computeVertexNormals();
  return g;
}

/** Furrowed bark: dark grooves running up the trunk, mossier toward the foot. */
const barkColor = (ly: number, lx: number, lz: number) => {
  const t = 0.5 + 0.5 * Math.sin(13 * Math.atan2(lz, lx) + 2 * Math.sin(3 * ly));
  const mossy = ly < 0.9 ? 0.18 : 0;
  const r = Math.round(0x2a + (0x54 - 0x2a) * t - mossy * 20);
  const gr = Math.round(0x20 + (0x43 - 0x20) * t + mossy * 14);
  const b = Math.round(0x16 + (0x2d - 0x16) * t - mossy * 10);
  return (r << 16) | (gr << 8) | b;
};

function addTrunk(bark: Bucket, moss: Bucket, o: Obstacle, idx: number) {
  const x = o.ax, z = o.az;
  const ph = idx * 2.1;
  bark.add(trunkGeometry(ph), x, 0, z, barkColor, { ry: ph });
  // Roots flaring out over the ground: eight long ones, five short between them.
  const root = new THREE.ConeGeometry(0.32, 2.4, 5);
  for (let k = 0; k < 8; k++) {
    const a = ph + (k / 8) * Math.PI * 2 + (k % 2) * 0.15;
    const d = new THREE.Vector3(Math.cos(a), -0.28, Math.sin(a)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d);
    bark.add(root, x + d.x * 1.5, 0.45, z + d.z * 1.5, 0x33271a, { q, sx: 1 + (k % 3) * 0.15, sz: 0.7 + (k % 2) * 0.3 });
  }
  const small = new THREE.ConeGeometry(0.2, 1.4, 5);
  for (let k = 0; k < 5; k++) {
    const a = ph + 0.4 + (k / 5) * Math.PI * 2;
    const d = new THREE.Vector3(Math.cos(a), -0.2, Math.sin(a)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d);
    bark.add(small, x + d.x * 1.15, 0.3, z + d.z * 1.15, 0x2c2218, { q });
  }
  moss.add(new THREE.SphereGeometry(0.72, 8, 5), x, 3.8, z, 0x4e7a2c, { sy: 0.32, sx: 1.05 });
  moss.add(new THREE.SphereGeometry(0.3, 6, 4), x + 0.62, 1.1, z + 0.1, 0x3f6624, { sy: 0.7, rz: 0.4 });
  moss.add(new THREE.SphereGeometry(0.34, 6, 4), x - 0.45, 0.5, z - 0.5, 0x3f6624, { sy: 0.5 });
  // Hanging vines from the broken top, with a few leaves.
  for (let k = 0; k < 5; k++) {
    const a = ph + 0.3 + k * 1.26;
    const len = 1.1 + (k % 3) * 0.5;
    const vx = x + Math.cos(a) * 0.7, vz = z + Math.sin(a) * 0.7;
    moss.add(new THREE.CylinderGeometry(0.024, 0.014, len, 4), vx, 3.85 - len / 2, vz, 0x2f5220, { rz: 0.04 });
    for (let j = 0; j < 3; j++) {
      moss.add(new THREE.IcosahedronGeometry(0.08, 0), vx + Math.cos(a) * 0.03, 3.8 - (j + 0.5) * (len / 3), vz + Math.sin(a) * 0.03, 0x4c7a2a, { sy: 0.45, sx: 1.4, ry: a + j });
    }
  }
}

/** A weathered standing stone: tapered, leaning a little, uneven top, chipped corners. Height 2.6, base 1.5 x 1.2. */
function stoneGeometry(seed: number) {
  const g = new THREE.BoxGeometry(1.5, 2.6, 1.2, 2, 5, 2);
  const p = g.attributes.position;
  const hash = (x: number, y: number, z: number, k: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + k * 17.3 + seed * 5.1) * 43758.5453;
    return v - Math.floor(v);
  };
  const lean = seed % 2 ? 0.1 : -0.1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + 1.3) / 2.6;
    const taper = 1 - 0.3 * t;
    let nx = x * taper + (hash(x, y, z, 1) - 0.5) * 0.07 + lean * t;
    let nz = z * taper + (hash(x, y, z, 2) - 0.5) * 0.07;
    let ny = y + (hash(x, y, z, 3) - 0.5) * 0.05;
    if (t > 0.97) {
      const corner = Math.abs(x) > 0.7 && Math.abs(z) > 0.55;
      if (corner) { ny -= 0.2 + 0.28 * hash(x, y, z, 4); nx *= 0.8; nz *= 0.8; }
      else ny -= hash(x, y, z, 5) * 0.14;
    }
    p.setXYZ(i, nx, ny + 1.3, nz);
  }
  g.computeVertexNormals();
  return g;
}

function addStandingStone(stone: Bucket, moss: Bucket, decal: Bucket, o: Obstacle, idx: number) {
  const yaw = Math.atan2(RING.x - o.ax, RING.z - o.az) + (idx % 2 ? 0.12 : -0.12);
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  const wx = (lx: number, lz: number) => o.ax + lx * cs + lz * sn;
  const wz = (lx: number, lz: number) => o.az - lx * sn + lz * cs;
  stone.add(stoneGeometry(idx), o.ax, 0, o.az, (ly) => (ly < 0.5 ? 0x3c3f38 : ly > 2.2 ? 0x555349 : 0x4a4c47), { ry: yaw });
  stone.add(new THREE.BoxGeometry(1.75, 0.3, 1.45), o.ax, 0.15, o.az, 0x33362f, { ry: yaw, rz: (idx % 3 - 1) * 0.02 });
  stone.add(new THREE.DodecahedronGeometry(0.3, 0), wx(0.85, 0.7), 0.2, wz(0.85, 0.7), 0x3c3f38, { sy: 0.7, ry: idx });
  moss.add(new THREE.SphereGeometry(0.8, 8, 5), wx(0.05, 0), 2.45, wz(0.05, 0), 0x4e7a2c, { sy: 0.26, sx: 0.8, sz: 0.65, ry: yaw });
  moss.add(new THREE.SphereGeometry(0.4, 6, 4), wx(0.55, -0.3), 0.45, wz(0.55, -0.3), 0x3f6624, { sy: 0.6 });
  // Lichen patches on the two wide faces (pale green and ochre), flat against the stone.
  const hd = (y: number) => 0.6 * (1 - 0.3 * (y / 2.6)) + 0.01;
  const patches: [number, number, number, number][] = [[-0.3, 2.05, 1, 0x9aa86a], [0.35, 0.9, 1, 0xb8a860], [0.25, 1.95, -1, 0x9aa86a], [-0.35, 1.0, -1, 0x8a9a5a]];
  patches.forEach(([lx, ly, side, col], k) => {
    moss.add(new THREE.SphereGeometry(0.16, 6, 4), wx(lx, side * hd(ly)), ly, wz(lx, side * hd(ly)), col, { sx: 1.3 + (k % 2) * 0.6, sy: 0.9, sz: 0.14, ry: yaw });
  });
  // A dim carved rune on each wide face (leaning back with the taper).
  const plane = new THREE.PlaneGeometry(0.8, 0.8);
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.07);
  const front = new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(tilt);
  const back = new THREE.Quaternion().setFromAxisAngle(UP, yaw + Math.PI).multiply(tilt);
  decal.add(plane, wx(0.05, hd(1.5) + 0.05), 1.5, wz(0.05, hd(1.5) + 0.05), 0xffffff, { q: front });
  decal.add(plane, wx(0.05, -(hd(1.5) + 0.05)), 1.5, wz(0.05, -(hd(1.5) + 0.05)), 0xffffff, { q: back });
}

function addLog(bark: Bucket, moss: Bucket, o: Obstacle) {
  const dx = o.bx - o.ax, dz = o.bz - o.az, len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const cx = (o.ax + o.bx) / 2, cz = (o.az + o.bz) / 2;
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  const L = len + 0.9;
  bark.add(new THREE.CylinderGeometry(0.46, 0.5, L, 12, 1), cx, 0.5, cz, 0x4a3a28, { q });
  // End cuts a little paler, a broken branch stub.
  const qy = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const ex = Math.sin(yaw) * (L / 2), ez = Math.cos(yaw) * (L / 2);
  bark.add(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 10), cx + ex, 0.5, cz + ez, 0x7a6644, { q });
  bark.add(new THREE.ConeGeometry(0.14, 0.7, 5), cx - Math.cos(yaw) * 0.3, 0.9, cz + Math.sin(yaw) * 0.3, 0x3a2c1c, { q: qy.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.9)) });
  moss.add(new THREE.SphereGeometry(1, 8, 5), cx, 0.93, cz, 0x4e7a2c, { sx: 0.34, sy: 0.14, sz: L * 0.4, ry: yaw });
  moss.add(new THREE.SphereGeometry(1, 6, 4), cx + ex * 0.6, 0.18, cz + ez * 0.6, 0x3f6624, { sx: 0.5, sy: 0.25, sz: 0.5 });
}

/** A small cluster of mushrooms (stems and caps, <= 0.25 m) around (x, z). */
function addMushrooms(m: Bucket, x: number, z: number, n: number, rnd: () => number) {
  const stem = new THREE.CylinderGeometry(0.025, 0.035, 1, 6);
  const cap = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const caps = [0xa8442a, 0xc9b48a, 0x8a4a2a, 0xd8d0c0];
  for (let k = 0; k < n; k++) {
    const ox = x + (rnd() - 0.5) * 0.6, oz = z + (rnd() - 0.5) * 0.6;
    const h = 0.07 + rnd() * 0.15, cr = 0.045 + rnd() * 0.06;
    m.add(stem, ox, h / 2, oz, 0xd8d0b8, { sy: h });
    m.add(cap, ox, h, oz, caps[Math.floor(rnd() * caps.length)], { sx: cr, sy: cr * 0.7, sz: cr });
  }
}

function distToObstacle(o: Obstacle, x: number, z: number) {
  const dx = o.bx - o.ax, dz = o.bz - o.az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? THREE.MathUtils.clamp(((x - o.ax) * dx + (z - o.az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(x - (o.ax + dx * t), z - (o.az + dz * t)) - o.r;
}

export const gladeArena: ArenaDef = {
  id: 'glade',
  name: 'Verdant Glade',
  obstacles: OBSTACLES,
  stage: STAGE,
  build() {
    const g = new THREE.Group();
    const rnd = seeded(7041);
    const rr = (a: number, b: number) => a + (b - a) * rnd();

    // Floor, apron, rim.
    const floor = floorDisc(RING.r, new THREE.MeshStandardMaterial({ map: groundTexture(1024, 11, true, 1), roughness: 0.9, metalness: 0 }));
    floor.receiveShadow = true;
    const apron = new THREE.Mesh(
      new THREE.RingGeometry(RING.r - 0.1, 70, 72, 1),
      new THREE.MeshStandardMaterial({ map: groundTexture(512, 23, false, 9), roughness: 0.95, metalness: 0 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(RING.x, 0.006, RING.z);
    apron.receiveShadow = true;

    const rimLine = flatRing(RING.r - 0.35, RING.r - 0.18, 0x7ab050, 0.3, 0.016);
    const rimStones: Inst[] = [];
    const N = 60;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rr(-0.02, 0.02);
      const rad = RING.r + rr(-0.05, 0.25);
      const w = rr(0.42, 0.62);
      rimStones.push({
        x: RING.x + Math.cos(a) * rad, y: 0.1, z: RING.z + Math.sin(a) * rad,
        sx: w, sy: rr(0.26, 0.4), sz: rr(0.34, 0.48), ry: -a + rr(-0.3, 0.3),
        color: [0x4a4c47, 0x3e413b, 0x3c4a32, 0x555349][i % 4],
      });
    }
    const rim = instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), rimStones, true);
    // Moss caps on most of the rim stones.
    const rimMoss: Inst[] = [];
    rimStones.forEach((st, i) => {
      if (i % 3 === 0) return;
      rimMoss.push({
        x: st.x, y: st.y + st.sy * 0.72, z: st.z, sx: st.sx * 0.85, sy: 0.12, sz: st.sz * 0.85, ry: st.ry,
        color: [0x3e6024, 0x324f1e, 0x46682a][i % 3],
      });
    });
    const rimMossMesh = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x7a8a6c, roughness: 1, flatShading: true }), rimMoss, false);

    // Ferns along both sides of the rim stones: seven flat fronds leaning outward.
    const fern = new Bucket();
    const frond = new THREE.ConeGeometry(0.06, 0.55, 4);
    frond.translate(0, 0.275, 0);
    for (let k = 0; k < 7; k++) {
      fern.add(frond, 0, 0, 0, 0xffffff, { rz: -(0.85 + (k % 3) * 0.2), ry: (k / 7) * Math.PI * 2, sx: 0.3, sy: 0.8 + (k % 2) * 0.3, sz: 2.2 });
    }
    const ferns: Inst[] = [];
    const fernGreens = [0x3c6a28, 0x4a7a30, 0x2e5a22, 0x5a8a38];
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + rr(-0.05, 0.05);
      const rad = RING.r + (i % 2 ? rr(0.55, 1.1) : rr(-0.9, -0.5));
      const k = rr(0.8, 1.3);
      ferns.push({ x: RING.x + Math.cos(a) * rad, y: 0.01, z: RING.z + Math.sin(a) * rad, sx: k, sy: k, sz: k, ry: rnd() * 6.28, color: fernGreens[i % 4] });
    }
    const fernMesh = instanced(mergeGeometries(fern.geos, false)!, new THREE.MeshStandardMaterial({ color: 0x9aaa8c, roughness: 0.9, side: THREE.DoubleSide }), ferns, false);

    // Cover.
    const bark = new Bucket(), moss = new Bucket(), stone = new Bucket(), decal = new Bucket();
    OBSTACLES.forEach((o, i) => {
      if (o.kind === 'wall') addLog(bark, moss, o);
      else if (o.height > 3) addTrunk(bark, moss, o, i);
      else addStandingStone(stone, moss, decal, o, i);
    });
    // Mushroom clusters at the roots, along the logs and at the stones.
    const shroom = new Bucket();
    OBSTACLES.forEach((o, i) => {
      if (o.kind === 'wall') {
        const dx = o.bx - o.ax, dz = o.bz - o.az, l = Math.hypot(dx, dz);
        for (const t of [0.1, 0.9]) {
          addMushrooms(shroom, o.ax + dx * t - (dz / l) * 0.8, o.az + dz * t + (dx / l) * 0.8, 4, rnd);
        }
        addMushrooms(shroom, o.ax + dx * 0.5 + (dz / l) * 0.85, o.az + dz * 0.5 - (dx / l) * 0.85, 3, rnd);
      } else if (o.height > 3) {
        for (const da of [0.5, 3.4]) {
          const a = i * 2.1 + da;
          addMushrooms(shroom, o.ax + Math.cos(a) * 1.35, o.az + Math.sin(a) * 1.35, 5, rnd);
        }
      } else {
        addMushrooms(shroom, o.ax + (o.ax > 0 ? 0.9 : -0.9), o.az + (i % 2 ? 0.8 : -0.8), 3, rnd);
      }
    });
    const shroomMesh = shroom.mesh(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8 }), false);

    const barkMesh = bark.mesh(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95 }));
    const mossMesh = moss.mesh(new THREE.MeshStandardMaterial({ color: 0x8a9a7c, vertexColors: true, roughness: 1 }));
    const stoneMesh = stone.mesh(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, flatShading: true }));
    const decalMesh = decal.mesh(
      new THREE.MeshBasicMaterial({
        map: runeTexture(), color: 0x1f8a80, transparent: true, opacity: 0.6, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }),
      false,
    );

    // Grass clumps: six blades per clump, <= 0.35 m, in varied greens, kept off the starts and the cover.
    const tuft = new Bucket();
    const blade = new THREE.ConeGeometry(0.05, 0.28, 3);
    tuft.add(blade, 0, 0.14, 0, 0xffffff, { rz: 0.1 });
    tuft.add(blade, 0.05, 0.13, 0.02, 0xffffff, { rz: -0.35, ry: 1.2, sy: 0.85 });
    tuft.add(blade, -0.03, 0.12, 0.05, 0xffffff, { rx: 0.4, ry: 2.4, sy: 0.75 });
    tuft.add(blade, 0, 0.13, -0.05, 0xffffff, { rx: -0.3, ry: 0.6, sy: 0.9 });
    tuft.add(blade, -0.05, 0.1, -0.02, 0xffffff, { rz: 0.5, ry: 4, sy: 0.7 });
    tuft.add(blade, 0.04, 0.11, 0.05, 0xffffff, { rx: 0.5, ry: 5, sy: 0.65 });
    const grass: Inst[] = [];
    const greens = [0x35541f, 0x44662a, 0x5a7a34, 0x2c4a1c, 0x6a8a3a, 0x3a5a2a, 0x4e7030, 0x7a9a44];
    const clear = (x: number, z: number, rad: number) =>
      Math.hypot(x, z - 13) >= 3.2 && Math.hypot(x, z - 1) >= 3.2 && !(rad > RING.r - 0.5 && rad < RING.r + 0.9) && !OBSTACLES.some((o) => distToObstacle(o, x, z) < 0.6);
    for (let tries = 0; grass.length < 1400 && tries < 9000; tries++) {
      const rad = Math.sqrt(rnd()) * 30;
      const a = rnd() * Math.PI * 2;
      const x = RING.x + Math.cos(a) * rad, z = RING.z + Math.sin(a) * rad;
      if (rad > 12 && rnd() < 0.45) continue;
      if (!clear(x, z, rad)) continue;
      const k = rr(0.75, 1.2);
      grass.push({ x, y: 0.01, z, sx: k, sy: k, sz: k, ry: rnd() * 6.28, color: greens[Math.floor(rnd() * greens.length)] });
    }
    const grassMesh = instanced(mergeGeometries(tuft.geos, false)!, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), grass, false);

    // Flowers (white and yellow) in small drifts: a thin stem and a tiny head.
    const stems: Inst[] = [], heads: Inst[] = [];
    for (let c = 0; c < 16; c++) {
      let cx = 0, cz = 0, ok = false;
      for (let t = 0; t < 30 && !ok; t++) {
        const rad = rr(3, 22), a = rnd() * Math.PI * 2;
        cx = RING.x + Math.cos(a) * rad; cz = RING.z + Math.sin(a) * rad;
        ok = clear(cx, cz, rad);
      }
      if (!ok) continue;
      const white = c % 2 === 1;
      for (let k = 0; k < 9; k++) {
        const x = cx + rr(-0.6, 0.6), z = cz + rr(-0.6, 0.6), h = rr(0.12, 0.22);
        if (!clear(x, z, Math.hypot(x - RING.x, z - RING.z))) continue;
        stems.push({ x, y: h / 2, z, sx: 1, sy: h, sz: 1, ry: 0, color: 0x3a5a22 });
        const w = k % 5 === 0 ? !white : white;
        heads.push({ x, y: h + 0.01, z, sx: 1, sy: 0.55, sz: 1, ry: rnd() * 6, color: w ? 0xc8c8c0 : 0xd8b838 });
      }
    }
    const stemMesh = instanced(new THREE.CylinderGeometry(0.008, 0.01, 1, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), stems, false);
    const headMesh = instanced(new THREE.IcosahedronGeometry(0.045, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), heads, false);

    // Apron: tall trees (only beyond radius 19, with a gap on the camera's axis), bushes, rocks.
    const trunks: Inst[] = [], crowns: Inst[] = [];
    for (let i = 0; i < 70 && trunks.length < 46; i++) {
      const rad = rr(19.5, 36);
      const a = rnd() * Math.PI * 2;
      if (Math.abs(Math.cos(a)) < 0.3 && rad < 33) continue; // keep the line of the camera (along z) open
      const r = rr(0.5, 1.2), h = rr(14, 22);
      const x = RING.x + Math.cos(a) * rad, z = RING.z + Math.sin(a) * rad;
      trunks.push({ x, y: h / 2, z, sx: r, sy: h, sz: r, ry: rnd() * 6, color: [0x2c2218, 0x34281c, 0x28221a][i % 3] });
      const cr = rr(4, 6.5);
      crowns.push({ x, y: h - 1.5, z, sx: cr, sy: cr * 0.6, sz: cr, ry: rnd() * 6, color: [0x1d3a1c, 0x24441f, 0x1a3220, 0x2e4a22][i % 4] });
    }
    const trunkMesh = instanced(new THREE.CylinderGeometry(0.8, 1, 1, 8, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), trunks, false);
    const crownMesh = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), crowns, false);

    const bushes: Inst[] = [];
    for (let i = 0; i < 70; i++) {
      const rad = rr(16.5, 31);
      const a = rnd() * Math.PI * 2;
      const s = rad < 19 ? rr(0.6, 0.85) : rr(0.9, 1.7);
      bushes.push({
        x: RING.x + Math.cos(a) * rad, y: s * 0.35, z: RING.z + Math.sin(a) * rad,
        sx: s * 1.2, sy: s * 0.75, sz: s, ry: rnd() * 6, color: [0x2a4a22, 0x36582a, 0x223e1e, 0x4a5a28][i % 4],
      });
    }
    const bushMesh = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), bushes, false);

    const rocks: Inst[] = [];
    for (let i = 0; i < 26; i++) {
      const rad = rr(14.5, 26);
      const a = rnd() * Math.PI * 2;
      const s = rr(0.3, 0.8);
      rocks.push({ x: RING.x + Math.cos(a) * rad, y: s * 0.3, z: RING.z + Math.sin(a) * rad, sx: s * 1.3, sy: s * 0.7, sz: s, ry: rnd() * 6, color: [0x4a4c47, 0x3c4a32][i % 2] });
    }
    const rockMesh = instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), rocks, false);

    // Distant canopy silhouette: big dark crowns far out, lifting the skyline above the trunks.
    const canopy: Inst[] = [];
    for (let i = 0; i < 70; i++) {
      const rad = rr(52, 74), a = rnd() * Math.PI * 2, sz = rr(9, 17);
      canopy.push({
        x: RING.x + Math.cos(a) * rad, y: rr(12, 22), z: RING.z + Math.sin(a) * rad,
        sx: sz, sy: sz * 0.55, sz: sz * 0.9, ry: rnd() * 6, color: [0x10241a, 0x14301e, 0x0e1f16][i % 3],
      });
    }
    const canopyMesh = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), canopy, false);

    // God rays: a few soft, dim, additive beams (two crossed planes each) far out, leaning with the low sun.
    const shafts = new Bucket();
    const shaftGeo = new THREE.PlaneGeometry(1, 26);
    const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.22);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      if (Math.abs(Math.cos(a)) < 0.35) continue;
      const rad = rr(28, 38), w = rr(3, 6), yaw = rr(0, 3);
      for (const extra of [0, Math.PI / 2]) {
        shafts.add(shaftGeo, RING.x + Math.cos(a) * rad, 11, RING.z + Math.sin(a) * rad, 0xffffff, {
          q: lean.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw + extra)), sx: w,
        });
      }
    }
    const shaftMesh = shafts.mesh(
      new THREE.MeshBasicMaterial({ map: rayTexture(), color: 0xffd890, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      false,
    );

    // Fireflies.
    const FLIES = 60;
    const base = new Float32Array(FLIES * 3), pos = new Float32Array(FLIES * 3), ph = new Float32Array(FLIES * 3);
    for (let i = 0; i < FLIES; i++) {
      const rad = rr(2, 24), a = rnd() * Math.PI * 2;
      base[i * 3] = RING.x + Math.cos(a) * rad;
      base[i * 3 + 1] = rr(0.6, 3.2);
      base[i * 3 + 2] = RING.z + Math.sin(a) * rad;
      ph[i * 3] = rnd() * 6.28; ph[i * 3 + 1] = rnd() * 6.28; ph[i * 3 + 2] = 0.2 + rnd() * 0.35;
    }
    pos.set(base);
    const flyGeo = new THREE.BufferGeometry();
    flyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flyMat = new THREE.PointsMaterial({
      map: glowTexture(), color: 0xffd070, size: 0.3, sizeAttenuation: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const flies = new THREE.Points(flyGeo, flyMat);
    flies.frustumCulled = false;

    // A few falling leaves (36): drift down in a lazy sway and start again at the top.
    const LEAVES = 36, LEAF_H = 7;
    const lBase = new Float32Array(LEAVES * 2), lPh = new Float32Array(LEAVES * 3), lPos = new Float32Array(LEAVES * 3), lCol = new Float32Array(LEAVES * 3);
    const leafCols = [0xb07a2a, 0x8a5a20, 0xa89038, 0x7a6a24];
    for (let i = 0; i < LEAVES; i++) {
      const rad = rr(1, 20), a = rnd() * Math.PI * 2;
      lBase[i * 2] = RING.x + Math.cos(a) * rad; lBase[i * 2 + 1] = RING.z + Math.sin(a) * rad;
      lPh[i * 3] = rnd() * 6.28; lPh[i * 3 + 1] = rr(0.25, 0.45); lPh[i * 3 + 2] = rnd() * LEAF_H;
      _c.setHex(leafCols[i % 4]);
      lCol[i * 3] = _c.r; lCol[i * 3 + 1] = _c.g; lCol[i * 3 + 2] = _c.b;
    }
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
    leafGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3));
    const leaves = new THREE.Points(leafGeo, new THREE.PointsMaterial({ map: leafTexture(), vertexColors: true, size: 0.2, sizeAttenuation: true, alphaTest: 0.4 }));
    leaves.frustumCulled = false;
    const placeLeaves = (time: number) => {
      for (let i = 0; i < LEAVES; i++) {
        const ph = lPh[i * 3];
        const y = LEAF_H - ((time * lPh[i * 3 + 1] + lPh[i * 3 + 2]) % LEAF_H);
        lPos[i * 3] = lBase[i * 2] + Math.sin(time * 0.6 + ph) * 1.4;
        lPos[i * 3 + 1] = y + 0.05;
        lPos[i * 3 + 2] = lBase[i * 2 + 1] + Math.cos(time * 0.5 + ph) * 1.4;
      }
      leafGeo.attributes.position.needsUpdate = true;
    };
    placeLeaves(0);

    g.add(apron, floor, rimLine, rim, rimMossMesh, fernMesh, shroomMesh, barkMesh, mossMesh, stoneMesh, decalMesh, grassMesh, stemMesh, headMesh, trunkMesh, crownMesh, bushMesh, rockMesh, canopyMesh, shaftMesh, flies, leaves);

    return {
      group: g,
      update(_dt: number, time: number) {
        for (let i = 0; i < FLIES; i++) {
          const s = ph[i * 3 + 2];
          pos[i * 3] = base[i * 3] + Math.sin(time * s + ph[i * 3]) * 1.6;
          pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(time * s * 1.7 + ph[i * 3 + 1]) * 0.45;
          pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(time * s * 0.8 + ph[i * 3]) * 1.6;
        }
        flyGeo.attributes.position.needsUpdate = true;
        flyMat.opacity = 0.75 + 0.2 * Math.sin(time * 2.3);
        placeLeaves(time);
      },
      dispose() {
        disposeTree(g);
      },
    };
  },
};
