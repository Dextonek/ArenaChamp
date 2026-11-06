import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pillar, wall, type Obstacle } from '../obstacles';
import { TempleRays } from './hazards/temple';
import { templeShift } from './shifts/tables';
import { DEFAULT_STAGE, RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef, WallState } from './types';

/**
 * The Night Temple: an old moonlit temple court. A dark engraved-stone disc with a faint sun-wheel mandala and worn
 * slab joints, a low stepped curb with a gold line at the rim, four braziers outside it at the diagonals, a flagstone
 * apron, and a backdrop of ruined gates, colonnades, guardian statues, obelisks, banners, rubble and a pale moon.
 * Incense motes drift over the ring. The backdrop props come from blender/arenas/temple_backdrop.py →
 * public/models/arenas/temple_backdrop.glb (placed below, merged per material).
 *
 * Cover (`TEMPLE_OBSTACLES`): a low sun altar in the middle, four angled carved screen walls round it and six fluted
 * columns at the sides. The cover and the braziers are sculpted, painted props from Blender
 * (blender/arenas/temple_props.py → public/models/arenas/temple_props.glb), instanced onto the obstacles.
 */

/** Cover layout: point-symmetric about the ring centre (0, 7); checked against the rules in docs/architecture/arenas.md. */
export const TEMPLE_OBSTACLES: Obstacle[] = [
  { ...pillar(0, 7, 1.0), height: 1.45 }, // the sun altar: low, the gameplay camera looks over it
  wall(-4.2, 3.0, -2.2, 4.4),
  wall(4.2, 11.0, 2.2, 9.6),
  wall(4.2, 3.0, 2.2, 4.4),
  wall(-4.2, 11.0, -2.2, 9.6),
  pillar(7.5, 7),
  pillar(-7.5, 7),
  pillar(8, 3.2),
  pillar(-8, 10.8),
  pillar(-8, 3.2),
  pillar(8, 10.8),
];

/** The wall module's length in the props file (a 2.44 m segment plus 2 × 0.35 m ends); longer walls stretch it. */
const WALL_MODULE = 3.14;

// ---- the sculpted props, loaded once and shared by every build ---------------------------------------------------

type PropParts = { geometry: THREE.BufferGeometry; material: THREE.Material; part: string }[];
let propsPromise: Promise<Record<string, PropParts>> | null = null;

/** temple_props.glb and temple_backdrop.glb as {prop name: its parts (one per material)}; objects there are named
 *  "<Prop>__<material>". Both files use the same materials; the first one loaded of each name is used for all. */
function loadProps() {
  propsPromise ??= (() => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = `${import.meta.env.BASE_URL}models/arenas/`;
    return Promise.all([loader.loadAsync(`${base}temple_props.glb`), loader.loadAsync(`${base}temple_backdrop.glb`)]).then((files) => {
      const out: Record<string, PropParts> = {};
      const byPart = new Map<string, THREE.Material>();
      const tuned = new Set<THREE.Material>();
      for (const gltf of files) {
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const [prop, part] = m.name.split('__');
          const geometry = m.geometry.clone().applyMatrix4(m.matrixWorld);
          if (!byPart.has(part)) byPart.set(part, m.material as THREE.Material);
          const material = byPart.get(part) as THREE.MeshStandardMaterial;
          // Moonlit night: the stone much darker than in the Blender file, the gold with a faint warm glow, the altar
          // sun soft. The loader shares one material between the meshes that use it: tune each once.
          if (!tuned.has(material)) {
            tuned.add(material);
            if (part === 'gold') { material.color.multiplyScalar(0.41); material.emissive.setHex(0x5a4210); material.emissiveIntensity = 0.12; }
            else if (part === 'glow') material.emissiveIntensity = 0.55;
            else material.color.multiplyScalar(part === 'light' ? 0.195 : 0.113);
            // a sheen from the Blender file would turn the stone milky under the moonlit rim light
            if (material instanceof THREE.MeshPhysicalMaterial) material.sheen = 0;
          }
          (out[prop] ??= []).push({ geometry, material, part });
        });
      }
      return out;
    });
  })();
  return propsPromise;
}

/** One instanced mesh per part of `prop`, placed by `matrices` (each build gets its own copies to dispose). */
function instance(parts: PropParts, matrices: THREE.Matrix4[]) {
  return parts.map(({ geometry, material }) => {
    const m = new THREE.InstancedMesh(geometry.clone(), material.clone(), matrices.length);
    matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = m.receiveShadow = true;
    return m;
  });
}

const GOLD = 0xc9a24a;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// ---- the backdrop: placed props merged per material (the repeated rubble instanced) -----------------------------

type Place = Record<string, THREE.Matrix4[]>;

/** How much darker the backdrop is than the cover (it stands further out of the braziers' and the rim light). */
const BACK_DIM = 0.7;

/** Only position, normal and colour (as float RGB, white when unpainted), indexed: so all parts of a material merge. */
function plain(src: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  const pos = src.attributes.position;
  g.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: pos.count * 3 }, (_, i) => pos.getComponent(Math.floor(i / 3), i % 3)), 3));
  if (!src.attributes.normal) src.computeVertexNormals();
  const nrm = src.attributes.normal;
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: nrm.count * 3 }, (_, i) => nrm.getComponent(Math.floor(i / 3), i % 3)), 3));
  const col = src.attributes.color;
  const c = new Float32Array(pos.count * 3).fill(1);
  if (col) for (let i = 0; i < pos.count; i++) { c[i * 3] = col.getX(i); c[i * 3 + 1] = col.getY(i); c[i * 3 + 2] = col.getZ(i); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setIndex(src.index ? Array.from(src.index.array) : Array.from({ length: pos.count }, (_, i) => i));
  return g;
}

/** A build's own copy of a material, reading the painted vertex colours, dimmed for the backdrop. */
function own(material: THREE.Material) {
  const mat = material.clone() as THREE.MeshStandardMaterial;
  mat.vertexColors = true;
  mat.color.multiplyScalar(BACK_DIM);
  mat.emissiveIntensity *= BACK_DIM;
  return mat;
}

/** Places props (each by its matrices) and merges every placed part into one mesh per material. */
function merged(props: Record<string, PropParts>, place: Place) {
  const lists = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[] }>();
  for (const [name, matrices] of Object.entries(place)) {
    for (const { geometry, material, part } of props[name] ?? []) {
      const entry = lists.get(part) ?? { material, geos: [] };
      lists.set(part, entry);
      const p = plain(geometry);
      for (const mx of matrices) entry.geos.push(p.clone().applyMatrix4(mx));
      p.dispose();
    }
  }
  const meshes: THREE.Mesh[] = [];
  for (const [part, { material, geos }] of lists) {
    const g = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    if (!g) throw new Error(`temple: merging ${part} failed`);
    const m = new THREE.Mesh(g, own(material));
    m.receiveShadow = true;
    meshes.push(m);
  }
  return meshes;
}

/** The repeated small props (rubble heaps): one instanced mesh per prop part. */
function instanced(props: Record<string, PropParts>, place: Place) {
  const meshes: THREE.InstancedMesh[] = [];
  for (const [name, matrices] of Object.entries(place)) {
    if (!matrices.length) continue;
    for (const { geometry, material } of props[name] ?? []) {
      const m = new THREE.InstancedMesh(plain(geometry), own(material), matrices.length);
      matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.receiveShadow = true;
      meshes.push(m);
    }
  }
  return meshes;
}

/** The camera rule: nothing of the backdrop above 2 m within 26 m of the centre unless |x| > 12 (every vertex). */
function checkCameraRule(meshes: THREE.Mesh[]) {
  const v = new THREE.Vector3();
  const mx = new THREE.Matrix4();
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh) : null;
    for (let k = 0; k < (inst ? inst.count : 1); k++) {
      if (inst) inst.getMatrixAt(k, mx);
      else mx.identity();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mx);
        if (v.y > 2 && Math.abs(v.x) <= 12 && Math.hypot(v.x - RING.x, v.z - RING.z) <= 26) {
          throw new Error(`temple: backdrop breaks the camera rule at (${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`);
        }
      }
    }
  }
}

/** Colonnade arcs round the court: angles (degrees) and radius from the centre, number of column places. */
const COLONNADES = [
  { a0: -172, a1: -112, R: 30, n: 6 },
  { a0: -70, a1: -8, R: 30, n: 6 },
  { a0: 12, a1: 72, R: 31, n: 6 },
  { a0: 110, a1: 168, R: 30, n: 6 },
  { a0: -22, a1: 22, R: 22, n: 5 }, // off the z axis (|x| > 20)
  { a0: 158, a1: 202, R: 22, n: 5 },
];
/** The colonnade's column height and the architrave module length in temple_backdrop.py. */
const COL_H = 9.0;
const ARCH_L = 6.2;
/** Banner cloth: 1.8 × 5.5 m, hung by its top edge. */
const BANNER_W = 1.8;
const BANNER_H = 5.5;

// ---- textures --------------------------------------------------------------------------------------------------

function floorTexture() {
  return canvasTexture(1024, (g, s) => {
    const rnd = seeded(7);
    const ppm = s / 24; // px per metre (disc diameter 24 m)
    const c = s / 2;
    g.fillStyle = '#17151d';
    g.fillRect(0, 0, s, s);
    // slabs 2 m, every other row offset, each with its own slight tone
    const slab = 2 * ppm;
    for (let row = -1; row * slab < s; row++) {
      const off = row % 2 === 0 ? 0 : slab / 2;
      for (let x = -slab; x < s + slab; x += slab) {
        const t = rnd();
        g.fillStyle = t < 0.5 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.05)';
        g.fillRect(x + off, row * slab, slab, slab);
      }
    }
    g.strokeStyle = 'rgba(6,5,9,0.85)';
    g.lineWidth = 2.5;
    for (let row = 0; row * slab <= s + slab; row++) {
      const off = row % 2 === 0 ? 0 : slab / 2;
      g.beginPath(); g.moveTo(0, row * slab); g.lineTo(s, row * slab); g.stroke();
      for (let x = off; x < s; x += slab) { g.beginPath(); g.moveTo(x, row * slab); g.lineTo(x, (row + 1) * slab); g.stroke(); }
    }
    // sun-wheel mandala, low contrast
    g.save();
    g.translate(c, c);
    g.strokeStyle = 'rgba(120,108,150,0.2)';
    g.lineWidth = 2.5;
    for (const r of [2.4, 4.6, 7.0, 9.7, 11.2]) { g.beginPath(); g.arc(0, 0, r * ppm, 0, Math.PI * 2); g.stroke(); }
    // 16 petals between 2.4 and 4.6
    for (let i = 0; i < 16; i++) {
      g.save();
      g.rotate((i / 16) * Math.PI * 2);
      g.beginPath();
      g.moveTo(2.4 * ppm, 0);
      g.quadraticCurveTo(3.5 * ppm, 0.85 * ppm, 4.6 * ppm, 0);
      g.quadraticCurveTo(3.5 * ppm, -0.85 * ppm, 2.4 * ppm, 0);
      g.stroke();
      g.restore();
    }
    // 32 fine spokes between 4.6 and 7
    g.lineWidth = 1.5;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      g.beginPath(); g.moveTo(Math.cos(a) * 4.6 * ppm, Math.sin(a) * 4.6 * ppm); g.lineTo(Math.cos(a) * 7 * ppm, Math.sin(a) * 7 * ppm); g.stroke();
    }
    // 16 sun rays between 7 and 9.7, long and short alternating
    g.strokeStyle = 'rgba(150,126,80,0.2)';
    g.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? 9.7 : 8.6;
      const w = 0.12;
      g.beginPath();
      g.moveTo(Math.cos(a - w) * 7 * ppm, Math.sin(a - w) * 7 * ppm);
      g.lineTo(Math.cos(a) * rr * ppm, Math.sin(a) * rr * ppm);
      g.lineTo(Math.cos(a + w) * 7 * ppm, Math.sin(a + w) * 7 * ppm);
      g.stroke();
    }
    // dot ring at 10.5
    g.fillStyle = 'rgba(150,126,80,0.22)';
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      g.beginPath(); g.arc(Math.cos(a) * 10.5 * ppm, Math.sin(a) * 10.5 * ppm, 2.6, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // cracks
    g.strokeStyle = 'rgba(5,4,8,0.8)';
    g.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      let x = rnd() * s, y = rnd() * s, a = rnd() * Math.PI * 2;
      g.beginPath(); g.moveTo(x, y);
      const steps = 6 + Math.floor(rnd() * 8);
      for (let i = 0; i < steps; i++) {
        a += (rnd() - 0.5) * 1.1;
        x += Math.cos(a) * (10 + rnd() * 22); y += Math.sin(a) * (10 + rnd() * 22);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // wear speckle
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)';
      g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 3, 1 + rnd() * 3);
    }
  });
}

function apronTexture() {
  return canvasTexture(1024, (g, s) => {
    const rnd = seeded(31);
    g.fillStyle = '#121017';
    g.fillRect(0, 0, s, s);
    const n = 4;
    const slab = s / n;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const jx = (rnd() - 0.5) * 10, jy = (rnd() - 0.5) * 10;
        g.fillStyle = `rgba(${40 + rnd() * 14},${36 + rnd() * 12},${50 + rnd() * 14},0.16)`;
        g.fillRect(col * slab + 4 + jx, row * slab + 4 + jy, slab - 8, slab - 8);
      }
    }
    g.strokeStyle = 'rgba(4,3,7,0.9)';
    g.lineWidth = 5;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(0, i * slab); g.lineTo(s, i * slab); g.stroke();
      g.beginPath(); g.moveTo(i * slab, 0); g.lineTo(i * slab, s); g.stroke();
    }
    // weeds / moss specks and cracks
    for (let i = 0; i < 260; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(30,44,30,0.35)' : 'rgba(0,0,0,0.25)';
      g.beginPath(); g.arc(rnd() * s, rnd() * s, 2 + rnd() * 7, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(4,3,7,0.8)';
    g.lineWidth = 2.5;
    for (let k = 0; k < 8; k++) {
      let x = rnd() * s, y = rnd() * s, a = rnd() * 6.28;
      g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < 7; i++) { a += (rnd() - 0.5); x += Math.cos(a) * 30; y += Math.sin(a) * 30; g.lineTo(x, y); }
      g.stroke();
    }
  }, 14);
}

function dotTexture() {
  return canvasTexture(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
}

function moonTexture() {
  return canvasTexture(512, (g, s) => {
    const c = s / 2;
    const halo = g.createRadialGradient(c, c, s * 0.12, c, c, c);
    halo.addColorStop(0, 'rgba(190,205,255,0.5)');
    halo.addColorStop(0.5, 'rgba(120,140,220,0.12)');
    halo.addColorStop(1, 'rgba(120,140,220,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, s, s);
    const r = s * 0.17;
    const disc = g.createRadialGradient(c - r * 0.3, c - r * 0.3, r * 0.1, c, c, r);
    disc.addColorStop(0, '#f2f4ff');
    disc.addColorStop(1, '#bcc6e6');
    g.fillStyle = disc;
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
    const rnd = seeded(5);
    g.save();
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.clip();
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(110,120,160,${0.12 + rnd() * 0.12})`;
      g.beginPath(); g.arc(c + (rnd() - 0.5) * r * 1.5, c + (rnd() - 0.5) * r * 1.5, r * (0.06 + rnd() * 0.16), 0, Math.PI * 2); g.fill();
    }
    g.restore();
  });
}

function bannerTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#2a1840';
    g.fillRect(0, 0, s, s);
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#8a6c2a';
    g.lineWidth = 8;
    g.strokeRect(10, 10, s - 20, s - 20);
    // sun emblem
    g.translate(s / 2, s * 0.42);
    g.fillStyle = '#8a6c2a';
    g.beginPath(); g.arc(0, 0, s * 0.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a6c2a';
    g.lineWidth = 6;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath(); g.moveTo(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14); g.lineTo(Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22); g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // swallow-tail cut at the bottom is done by alpha
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(0, s); g.lineTo(s / 2, s * 0.86); g.lineTo(s, s); g.fill();
  });
}

// ---- the arena -------------------------------------------------------------------------------------------------

export const templeArena: ArenaDef = {
  id: 'temple',
  name: 'Night Temple',
  hazard: (seed) => new TempleRays(seed),
  shift: (seed) => templeShift(seed, TEMPLE_OBSTACLES),
  obstacles: TEMPLE_OBSTACLES,
  breakable: true,
  stage: DEFAULT_STAGE,
  build() {
    const g = new THREE.Group();

    // Floor, apron
    const apron = floorDisc(
      34,
      new THREE.MeshStandardMaterial({ map: apronTexture(), color: 0xffffff, roughness: 0.9, metalness: 0.05 }),
      0.004,
      64,
    );
    const disc = floorDisc(
      RING.r,
      new THREE.MeshStandardMaterial({ map: floorTexture(), color: 0xffffff, roughness: 0.85, metalness: 0.1, transparent: true, opacity: 0.92 }),
    );
    disc.receiveShadow = false;
    const band = flatRing(RING.r - 0.9, RING.r - 0.2, 0x6a4a9a, 0.2, 0.018);
    const rim = flatRing(RING.r - 0.12, RING.r, GOLD, 0.7, 0.02);
    const centre = flatRing(1.1, 1.18, GOLD, 0.3, 0.02);
    g.add(apron, disc, band, rim, centre);

    // Stepped curb: inner step 0.28 m, outer 0.14 m, gold line on the inner top edge
    const curb = new THREE.Mesh(
      new THREE.LatheGeometry(
        [[12.0, 0], [12.0, 0.28], [12.45, 0.28], [12.45, 0.14], [12.95, 0.14], [12.95, 0]].map(([x, y]) => new THREE.Vector2(x, y)),
        96,
      ),
      new THREE.MeshStandardMaterial({ color: 0x3a3642, roughness: 0.9, side: THREE.DoubleSide }),
    );
    curb.position.set(RING.x, 0, RING.z);
    curb.castShadow = curb.receiveShadow = true;
    const curbGold = flatRing(12.02, 12.14, GOLD, 0.9, 0.285);
    g.add(curb, curbGold);

    // Braziers outside the rim at the diagonals (radius 13.5, 1.15 m high)
    const braziers: { x: number; z: number }[] = [];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      braziers.push({ x: RING.x + Math.cos(a) * 13.5, z: RING.z + Math.sin(a) * 13.5 });
    }

    // Cover and braziers: the sculpted props, added when the file has loaded (the first pick waits a moment for them)
    let disposed = false;
    const at = (x: number, z: number, ry: number, sx = 1) => new THREE.Matrix4().compose(_p.set(x, 0, z), _q.setFromAxisAngle(_s.set(0, 1, 0), ry), new THREE.Vector3(sx, 1, 1));
    const crnd = seeded(100);
    // Breakable walls: each wall's matrix, its state, and one instanced set per look (whole, cracked, rubble). A look
    // without its own prop in the file falls back to the whole wall leant over (cracked) or squashed low (rubble).
    const wallIdx: number[] = []; // obstacle index -> wall instance
    const wallBase: THREE.Matrix4[] = [];
    const wallStates: WallState[] = [];
    const wallSets: Record<WallState, THREE.InstancedMesh[]> = { whole: [], cracked: [], broken: [] };
    TEMPLE_OBSTACLES.forEach((o, i) => {
      if (o.kind !== 'wall') return;
      const dx = o.bx - o.ax, dz = o.bz - o.az;
      wallIdx[i] = wallBase.length;
      wallBase.push(at((o.ax + o.bx) / 2, (o.az + o.bz) / 2, Math.atan2(-dz, dx), (Math.hypot(dx, dz) + 2 * o.r) / WALL_MODULE));
      wallStates.push('whole');
    });
    const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
    const lean = new THREE.Matrix4().makeRotationX(0.05).setPosition(0, -0.06, 0);
    const squash = new THREE.Matrix4().makeScale(1, 0.18, 1.25);
    const showWall = (k: number) => {
      const state = wallStates[k];
      for (const look of ['whole', 'cracked', 'broken'] as const) {
        for (const m of wallSets[look]) {
          let mx = HIDDEN;
          if (look === state) mx = wallBase[k];
          else if (look === 'whole' && !wallSets[state].length) mx = state === 'cracked' ? wallBase[k].clone().multiply(lean) : wallBase[k].clone().multiply(squash);
          m.setMatrixAt(k, mx);
          m.instanceMatrix.needsUpdate = true;
        }
      }
    };

    // The columns: each one's matrix and the instanced sets, so a stage can topple them (`coverFall`).
    const columnIdx: number[] = []; // obstacle index -> column instance
    const columnBase: THREE.Matrix4[] = [];
    let columnSets: THREE.InstancedMesh[] = [];
    const altars: THREE.Matrix4[] = [];
    TEMPLE_OBSTACLES.forEach((o, i) => {
      if (o.kind === 'wall') return;
      if (o.height < 2) altars.push(at(o.ax, o.az, 0));
      else {
        columnIdx[i] = columnBase.length;
        columnBase.push(at(o.ax, o.az, (crnd() - 0.5) * 0.5));
      }
    });
    const setColumn = (k: number, mx: THREE.Matrix4) => {
      for (const m of columnSets) {
        m.setMatrixAt(k, mx);
        m.instanceMatrix.needsUpdate = true;
      }
    };

    void loadProps().then((props) => {
      if (disposed) return;
      const pots = braziers.map((b) => at(b.x, b.z, 0));
      if (props.Column) {
        columnSets = instance(props.Column, columnBase);
        // their bounds would be measured standing and never follow a fall: no culling for these few
        for (const m of columnSets) m.frustumCulled = false;
        g.add(...columnSets);
      }
      for (const [name, list] of [['Altar', altars], ['Brazier', pots]] as const) {
        if (props[name] && list.length) g.add(...instance(props[name], list));
      }
      for (const [look, name] of [['whole', 'Wall'], ['cracked', 'WallCracked'], ['broken', 'WallRubble']] as const) {
        if (!props[name]) continue;
        wallSets[look] = instance(props[name], wallBase);
        // their bounds would be measured while hidden (zero scale) and never drawn again: no culling for these few
        for (const m of wallSets[look]) m.frustumCulled = false;
        g.add(...wallSets[look]);
      }
      wallBase.forEach((_, k) => showWall(k));
    }).catch((e) => console.warn('temple: props failed to load', e));

    // Stone chunks thrown out when a wall cracks or falls: ballistic, then lying on the floor until the round ends
    const CHUNKS = 96;
    const chunkMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ color: 0x3e3a4c, roughness: 0.9 }), CHUNKS);
    chunkMesh.castShadow = true;
    chunkMesh.frustumCulled = false; // starts hidden (zero scale), see the wall sets
    const chunkState = Array.from({ length: CHUNKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler(), s: 0, live: false }));
    for (let i = 0; i < CHUNKS; i++) chunkMesh.setMatrixAt(i, HIDDEN);
    g.add(chunkMesh);
    let chunkNext = 0;
    const drnd = seeded(9);
    const burst = (o: Obstacle, n: number) => {
      for (let j = 0; j < n; j++) {
        const c = chunkState[chunkNext];
        chunkNext = (chunkNext + 1) % CHUNKS;
        const t = drnd();
        c.p.set(o.ax + (o.bx - o.ax) * t, 0.6 + drnd() * 1.4, o.az + (o.bz - o.az) * t);
        c.v.set((drnd() - 0.5) * 5, 2 + drnd() * 3.5, (drnd() - 0.5) * 5);
        c.spin.set(drnd() * 8, drnd() * 8, drnd() * 8);
        c.s = 0.6 + drnd() * 1.3;
        c.live = true;
      }
    };
    // A column toppling along `dir`: it turns about its foot, faster and faster, and breaks up where it lands.
    const falls: { k: number; o: Obstacle; dir: number; t: number; seconds: number; dust: number }[] = [];
    const coverFall = (index: number, dir: number, seconds: number) => {
      const k = columnIdx[index];
      if (k !== undefined) falls.push({ k, o: TEMPLE_OBSTACLES[index], dir, t: 0, seconds, dust: 0 });
    };
    const _axis = new THREE.Vector3(), _tilt = new THREE.Matrix4(), _foot = new THREE.Matrix4();
    const stepFalls = (dt: number) => {
      for (let i = falls.length - 1; i >= 0; i--) {
        const f = falls[i], { k, o, dir } = f;
        f.t += dt;
        const u = Math.min(1, f.t / f.seconds);
        _axis.set(Math.cos(dir), 0, -Math.sin(dir));
        _tilt.makeRotationAxis(_axis, u * u * Math.PI * 0.5);
        _foot.makeTranslation(o.ax, 0, o.az);
        // The column's own turn stays inside: only its foot moves to the spot.
        setColumn(k, _m.copy(_foot).multiply(_tilt).multiply(_foot.clone().invert()).multiply(columnBase[k]));
        if (u < 1) continue;
        setColumn(k, HIDDEN);
        const len = o.height;
        burst({ ...o, bx: o.ax + Math.sin(dir) * len, bz: o.az + Math.cos(dir) * len }, 12);
        falls.splice(i, 1);
      }
    };
    const resetShift = () => {
      falls.length = 0;
      columnBase.forEach((mx, k) => setColumn(k, mx));
    };

    const wallState = (index: number, state: WallState) => {
      const k = wallIdx[index];
      if (k === undefined) return;
      const before = wallStates[k];
      wallStates[k] = state;
      if (state === 'whole' && before !== 'whole') {
        for (let i = 0; i < CHUNKS; i++) { chunkState[i].live = false; chunkMesh.setMatrixAt(i, HIDDEN); }
        chunkMesh.instanceMatrix.needsUpdate = true;
      }
      if (state !== before && state !== 'whole') burst(TEMPLE_OBSTACLES[index], state === 'broken' ? 18 : 6);
      if (wallSets.whole.length) showWall(k);
    };

    // Brazier coals + ground glow (additive, dim)
    const glowGeos: THREE.BufferGeometry[] = [];
    for (const b of braziers) {
      const coal = new THREE.CircleGeometry(0.38, 12);
      coal.rotateX(-Math.PI / 2);
      coal.translate(b.x, 1.12, b.z);
      glowGeos.push(coal);
      const gl = new THREE.CircleGeometry(1.1, 20);
      gl.rotateX(-Math.PI / 2);
      gl.translate(b.x, 0.03, b.z);
      glowGeos.push(gl);
    }
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
    const glow = new THREE.Mesh(mergeGeometries(glowGeos)!, glowMat);
    glowGeos.forEach((x) => x.dispose());
    g.add(glow);

    // Flame particles: 14 per brazier
    const FL = 14;
    const flamePos = new Float32Array(braziers.length * FL * 3);
    const flameCol = new Float32Array(braziers.length * FL * 3);
    const flamePhase = new Float32Array(braziers.length * FL);
    const frnd = seeded(77);
    for (let i = 0; i < flamePhase.length; i++) flamePhase[i] = frnd();
    const flameGeo = new THREE.BufferGeometry();
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameCol, 3));
    const dot = dotTexture();
    const flames = new THREE.Points(
      flameGeo,
      new THREE.PointsMaterial({ size: 0.34, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    flames.frustumCulled = false;
    g.add(flames);

    // Incense motes: 24, slowly rising gold
    const MOTES = 24;
    const mrnd = seeded(404);
    const moteBase = new Float32Array(MOTES * 4); // angle, radius, y0, speed
    const motePos = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      moteBase[i * 4] = mrnd() * Math.PI * 2;
      moteBase[i * 4 + 1] = 2 + mrnd() * 10;
      moteBase[i * 4 + 2] = mrnd() * 3;
      moteBase[i * 4 + 3] = 0.12 + mrnd() * 0.14;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({ size: 0.1, map: dot, color: 0xe0b860, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    motes.frustumCulled = false;
    g.add(motes);

    // ---- backdrop -------------------------------------------------------------------------------------------
    // Sculpted props from blender/arenas/temple_backdrop.py, placed (seeded). The grand ruined gates on the z axis
    // 34 m out; colonnade arcs at 30 m (and at 22 m only off the z axis) with architraves over neighbouring whole
    // columns; a hooded guardian statue on each side; obelisks and banner poles flanking the gates; low stair
    // fragments, fallen drums and rubble heaps on the apron. Nothing above 2 m within 26 m of the centre unless
    // |x| > 12 (checked on every vertex when the props load).
    const rnd = seeded(2024);
    const rr = (a: number, b: number) => a + (b - a) * rnd();
    const UP = new THREE.Vector3(0, 1, 0);
    const put3 = (into: Place, name: string, x: number, y: number, z: number, ry: number, s = 1, sx = 1) =>
      (into[name] ??= []).push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(sx * s, s, s)));
    /** The turn that makes a prop's front (+z in three.js) look at the ring centre. */
    const facing = (x: number, z: number) => Math.atan2(RING.x - x, RING.z - z);
    const back: Place = {}, heaps: Place = {};
    const banners: THREE.Matrix4[] = []; // each banner's top-edge frame
    const bannerAt = (x: number, y: number, z: number, ry: number) =>
      banners.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(1, 1, 1)));
    /** A banner hung in front of a prop: `lx`, `ly`, `lz` in the prop's own frame (x, z turned by `ry`). */
    const bannerOn = (x: number, z: number, ry: number, lx: number, ly: number, lz: number) =>
      bannerAt(x + Math.cos(ry) * lx + Math.sin(ry) * lz, ly, z - Math.sin(ry) * lx + Math.cos(ry) * lz, ry);
    const taken: { x: number; z: number; r: number }[] = [];
    const free = (x: number, z: number, r: number) => taken.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + r);
    const claim = (x: number, z: number, r: number) => taken.push({ x, z, r });

    // the gates (GateB is the mirror ruin: its other pylon stands) and a banner on the whole pylon's face
    for (const [name, cz, ry, s] of [['GateA', RING.z - 34, 0, 1], ['GateB', RING.z + 34, Math.PI, -1]] as const) {
      put3(back, name, RING.x, 0, cz, ry);
      bannerOn(RING.x, cz, ry, -5.6 * s, 14.3, 1.5);
      // obelisks and banner poles flanking the stair, in front of the side walls
      const toward = Math.sign(RING.z - cz);
      for (const side of [-1, 1]) {
        const ox = side * 13.5, oz = cz + toward * 7;
        put3(back, 'Obelisk', ox, 0, oz, facing(ox, oz));
        claim(ox, oz, 2.2);
        const px = side * 8.4, pz = cz + toward * 5.5;
        const pr = facing(px, pz);
        put3(back, 'BannerPole', px, 0, pz, pr);
        bannerOn(px, pz, pr, 0, 7.55, 0.2);
      }
      claim(RING.x, cz, 9);
      claim(RING.x, cz + toward * 4.5, 7.5);
    }

    // a guardian statue on each side, banner poles beside it
    for (const side of [-1, 1]) {
      const sx = side * 17.5, sz = RING.z;
      put3(back, 'Statue', sx, 0, sz, facing(sx, sz));
      claim(sx, sz, 2.4);
      for (const dz of [-4.6, 4.6]) {
        const px = side * 15.2, pz = RING.z + dz, pr = facing(px, pz);
        put3(back, 'BannerPole', px, 0, pz, pr);
        bannerOn(px, pz, pr, 0, 7.55, 0.2);
        claim(px, pz, 0.8);
      }
    }

    // colonnades: whole columns (an architrave over each neighbouring pair, every other one with a banner) and
    // broken ones; places that fall on a landmark stay empty
    COLONNADES.forEach((sec, si) => {
      let prev: { x: number; z: number; whole: boolean } | null = null;
      for (let i = 0; i < sec.n; i++) {
        const a = THREE.MathUtils.degToRad(sec.a0 + ((sec.a1 - sec.a0) * i) / (sec.n - 1));
        const x = RING.x + Math.cos(a) * sec.R, z = RING.z + Math.sin(a) * sec.R;
        if (!free(x, z, 1.3)) { prev = null; continue; }
        const t = rnd();
        const whole = t < 0.58;
        put3(back, whole ? 'ColTall' : t < 0.8 ? 'ColBrokenA' : 'ColBrokenB', x, 0, z, rnd() * Math.PI * 2, 1, 1);
        if (whole && prev?.whole) {
          const mx = (prev.x + x) / 2, mz = (prev.z + z) / 2, ry = facing(mx, mz);
          put3(back, 'Architrave', mx, COL_H, mz, ry, 1, Math.hypot(x - prev.x, z - prev.z) / ARCH_L);
          if (si < 4 && i % 2 === 0) bannerOn(mx, mz, ry, 0, COL_H + 0.25, 1.05);
        }
        prev = { x, z, whole };
      }
    });
    for (const sec of COLONNADES) {
      for (let i = 0; i < sec.n; i++) {
        const a = THREE.MathUtils.degToRad(sec.a0 + ((sec.a1 - sec.a0) * i) / (sec.n - 1));
        claim(RING.x + Math.cos(a) * sec.R, RING.z + Math.sin(a) * sec.R, 1.6);
      }
    }

    // low debris on the apron (all under 2 m): stair fragments rising away from the ring, drums, rubble heaps
    for (const deg of [-35, 35, 145, 215]) {
      const a = THREE.MathUtils.degToRad(deg), x = RING.x + Math.cos(a) * 18.5, z = RING.z + Math.sin(a) * 18.5;
      put3(back, 'Stairs', x, 0, z, facing(x, z) + rr(-0.15, 0.15));
      claim(x, z, 3.8);
    }
    for (const b of braziers) claim(b.x, b.z, 1.2);
    const scatter = (name: string, count: number, r: number, into: Place, s0: number, s1: number) => {
      for (let tries = 0, n = 0; n < count && tries < count * 30; tries++) {
        const a = rnd() * Math.PI * 2, d = rr(14.8, 27);
        const x = RING.x + Math.cos(a) * d, z = RING.z + Math.sin(a) * d;
        if (!free(x, z, r)) continue;
        put3(into, name, x, 0, z, rnd() * Math.PI * 2, rr(s0, s1));
        claim(x, z, r);
        n++;
      }
    };
    scatter('Drums', 5, 3.0, back, 0.9, 1.05);
    scatter('RubbleA', 11, 1.6, heaps, 0.8, 1.3);
    scatter('RubbleB', 14, 1.1, heaps, 0.8, 1.4);

    void loadProps().then((props) => {
      if (disposed) return;
      const meshes = [...merged(props, back), ...instanced(props, heaps)];
      checkCameraRule(meshes);
      g.add(...meshes);
    }).catch((e) => console.error('temple: backdrop failed', e));

    // hanging banners: one instanced cloth, rippling (the shared cloth's vertices) and swinging (each banner's own
    // phase) in a slow wind; hung by the top edge
    const bannerGeo = new THREE.PlaneGeometry(BANNER_W, BANNER_H, 1, 10).translate(0, -BANNER_H / 2, 0);
    const bannerRest = Float32Array.from(bannerGeo.attributes.position.array as Float32Array);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    const bannerMesh = new THREE.InstancedMesh(bannerGeo, bannerMat, banners.length);
    bannerMesh.frustumCulled = false; // its matrices move every frame
    g.add(bannerMesh);
    const swing = new THREE.Matrix4();
    const placeBanners = (time: number) => {
      const pos = bannerGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = bannerRest[i * 3 + 1], x = bannerRest[i * 3]; // y from 0 (top) to -BANNER_H
        const k = -y / BANNER_H;
        pos.setZ(i, k * (0.16 * Math.sin(time * 1.9 + y * 1.3 + x * 0.6) + 0.1 * Math.sin(time * 0.7 + y * 0.5)));
      }
      pos.needsUpdate = true;
      banners.forEach((b, i) => {
        swing.makeRotationX(-0.05 * Math.sin(time * 0.6 + i * 1.7) - 0.06); // the hem lifts outward, never into a wall
        bannerMesh.setMatrixAt(i, _m.multiplyMatrices(b, swing));
      });
      bannerMesh.instanceMatrix.needsUpdate = true;
    };
    placeBanners(0);

    // pale low moon far away (a sprite, ignores fog)
    const moon = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, depthWrite: false, fog: false, color: 0xdfe6ff }),
    );
    moon.scale.set(150, 150, 1);
    moon.position.set(-110, 52, RING.z - 160);
    g.add(moon);

    const update = (dt: number, time: number) => {
      // flames
      for (let b = 0; b < braziers.length; b++) {
        const br = braziers[b];
        for (let j = 0; j < FL; j++) {
          const idx = b * FL + j;
          const ph = flamePhase[idx];
          const t = (time * 0.9 + ph) % 1;
          const w = 0.16 * (1 - t) * (0.6 + 0.4 * Math.sin(time * 7 + ph * 40));
          flamePos[idx * 3] = br.x + Math.sin(ph * 60 + time * 4) * w;
          flamePos[idx * 3 + 1] = 1.18 + t * 0.62;
          flamePos[idx * 3 + 2] = br.z + Math.cos(ph * 47 + time * 3.4) * w;
          const f = Math.pow(1 - t, 0.9) * 0.8;
          flameCol[idx * 3] = f;
          flameCol[idx * 3 + 1] = f * (0.7 - 0.5 * t);
          flameCol[idx * 3 + 2] = f * 0.2 * (1 - t);
        }
      }
      flameGeo.attributes.position.needsUpdate = true;
      flameGeo.attributes.color.needsUpdate = true;
      glowMat.opacity = 0.11 + 0.035 * Math.sin(time * 9) * Math.sin(time * 5.3 + 1);
      // motes
      for (let i = 0; i < MOTES; i++) {
        const a = moteBase[i * 4] + time * 0.04, r = moteBase[i * 4 + 1];
        const y = (moteBase[i * 4 + 2] + time * moteBase[i * 4 + 3]) % 3.2;
        motePos[i * 3] = RING.x + Math.cos(a) * r + Math.sin(time * 0.5 + i) * 0.3;
        motePos[i * 3 + 1] = 0.3 + y;
        motePos[i * 3 + 2] = RING.z + Math.sin(a) * r + Math.cos(time * 0.4 + i * 2) * 0.3;
      }
      moteGeo.attributes.position.needsUpdate = true;
      // banners
      placeBanners(time);
      stepFalls(dt);
      // wall chunks
      let moved = false;
      for (let i = 0; i < CHUNKS; i++) {
        const c = chunkState[i];
        if (!c.live) continue;
        c.v.y -= 14 * dt;
        c.p.addScaledVector(c.v, dt);
        c.rot.set(c.rot.x + c.spin.x * dt, c.rot.y + c.spin.y * dt, c.rot.z + c.spin.z * dt);
        const landed = c.p.y <= 0.08 * c.s;
        if (landed) c.p.y = 0.08 * c.s;
        chunkMesh.setMatrixAt(i, _m.compose(c.p, _q.setFromEuler(c.rot), _s.setScalar(c.s)));
        if (landed) c.live = false; // stays where it fell
        moved = true;
      }
      if (moved) chunkMesh.instanceMatrix.needsUpdate = true;
    };

    return {
      group: g,
      update,
      wallState,
      coverFall,
      resetShift,
      dispose() {
        disposed = true;
        (moon.material.map as THREE.Texture | null)?.dispose();
        moon.material.dispose();
        disposeTree(g);
      },
    };
  },
};
