import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pillar, wall, type Obstacle } from '../obstacles';
import { VentEruption } from './hazards/caldera';
import { calderaShift } from './shifts/tables';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded, shadowed } from './common';
import type { ArenaDef } from './types';

/**
 * Ember Caldera: a basalt shelf in a lava lake, inside a crater wall with lava falls and smoke columns.
 *
 * Cover (`CALDERA_OBSTACLES`): no centre piece (the lava vent stays open); two low obsidian ridges flank the middle
 * lane, two tall basalt column clusters and two low clusters of snapped stumps stand off the z axis, and two taller
 * bladed obsidian ridges guard the wings. The cover is sculpted, painted props from Blender
 * (blender/arenas/caldera_props.py → public/models/arenas/caldera_props.glb), instanced onto the obstacles.
 *
 * Outside the ring: a jagged obsidian lip round the ring edge, basalt prism clusters, cooled-lava boulders and small
 * vents on the apron, lava-crusted rock spires standing in the lava lake, big vents under the smoke columns and a
 * crater wall of chiselled basalt segments with thin lava falls (tall ones only beyond 26 m or at |x| > 12). The
 * backdrop props come from blender/arenas/caldera_backdrop.py → public/models/arenas/caldera_backdrop.glb (placed
 * below: the unique ones merged per material, the repeated ones instanced).
 */

/** Bakes a transform into a (non-indexed) copy of `geo`, so many props merge into one draw call. */
function bake(geo: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    ),
  );
  return g;
}

const merged = (list: THREE.BufferGeometry[], mat: THREE.Material) => {
  const m = shadowed(new THREE.Mesh(mergeGeometries(list)!, mat));
  list.forEach((g) => g.dispose());
  return m;
};

/** Cover layout: point-symmetric about the ring centre (0, 7); checked against the rules in docs/architecture/arenas.md.
 *  Heights are the props' (they pick the prop): 1.18 / 2.08 the low and tall obsidian ridges, 3.3 / 1.27 the tall
 *  basalt cluster and the snapped stumps. Twins follow each other (even index, odd index). */
export const CALDERA_OBSTACLES: Obstacle[] = [
  { ...wall(1.6, 5.0, 4.4, 6.2), r: 0.4, height: 1.18 }, // low obsidian ridges flanking the middle lane
  { ...wall(-1.6, 9.0, -4.4, 7.8), r: 0.4, height: 1.18 },
  { ...pillar(4.6, 10.4, 0.9), height: 3.3 }, // tall basalt column clusters
  { ...pillar(-4.6, 3.6, 0.9), height: 3.3 },
  { ...pillar(4.2, 2.0, 0.8), height: 1.27 }, // low clusters of snapped basalt stumps
  { ...pillar(-4.2, 12.0, 0.8), height: 1.27 },
  { ...wall(8.0, 5.0, 7.6, 8.4), r: 0.4, height: 2.08 }, // tall bladed obsidian ridges on the wings
  { ...wall(-8.0, 9.0, -7.6, 5.6), r: 0.4, height: 2.08 },
];

/** The ridge modules' lengths in the props file (wall segment plus 2 × 0.4 m ends); walls stretch them along x. */
export const RIDGE_MODULE = { RidgeA: 3.85, RidgeB: 4.22 };

// ---- the sculpted props, loaded once and shared by every build ---------------------------------------------------

type PropParts = { geometry: THREE.BufferGeometry; material: THREE.Material; part: string }[];
let propsPromise: Promise<Record<string, PropParts>> | null = null;

/** caldera_props.glb and caldera_backdrop.glb as {prop name: its parts (one per material)}; objects there are named
 *  "<Prop>__<material>". Both files share material names; the first one loaded of each name (the cover's) is used. */
export function loadProps() {
  propsPromise ??= (() => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = `${import.meta.env.BASE_URL}models/arenas/`;
    return Promise.all([loader.loadAsync(`${base}caldera_props.glb`), loader.loadAsync(`${base}caldera_backdrop.glb`)]).then((files) => {
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
          // the loader shares one material between the props: tune each once. Red-lit caldera: the crust and basalt
          // darker than in the Blender file, the obsidian keeps its gloss, the cracks glow softly under the bloom
          if (!tuned.has(material)) {
            tuned.add(material);
            if (part === 'glow') material.emissiveIntensity = 0.8;
            else if (part === 'obsidian') {
              material.color.multiplyScalar(0.8);
              if (material instanceof THREE.MeshPhysicalMaterial) material.clearcoat *= 0.5;
            } else if (part === 'basalt') material.color.multiplyScalar(0.3);
            else material.color.multiplyScalar(0.5);
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
export function instance(parts: PropParts, matrices: THREE.Matrix4[]) {
  return parts.map(({ geometry, material }) => {
    const m = new THREE.InstancedMesh(geometry.clone(), material.clone(), matrices.length);
    matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = m.receiveShadow = true;
    return m;
  });
}

// ---- the backdrop: placed props merged per material (the repeated ones instanced) --------------------------------

type Place = Record<string, THREE.Matrix4[]>;

/** How much darker the backdrop's rock is than the cover's: the far ring must not outshine the heroes and spells;
 *  its lava seams keep `BACK_GLOW` of the cover's glow. */
const BACK_DIM = 0.6;
const BACK_GLOW = 0.9;

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
  mat.emissiveIntensity *= BACK_GLOW;
  // the obsidian's clearcoat glints all round the rim would read as sparks
  if (mat instanceof THREE.MeshPhysicalMaterial) mat.clearcoat = 0;
  mat.roughness = Math.max(mat.roughness, 0.3);
  return mat;
}

/** Places props (each by its matrices) and merges every placed part into one mesh per material. */
function mergedBack(props: Record<string, PropParts>, place: Place) {
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
    if (!g) throw new Error(`caldera: merging ${part} failed`);
    const m = new THREE.Mesh(g, own(material));
    m.receiveShadow = part !== 'glow';
    meshes.push(m);
  }
  return meshes;
}

/** The repeated props (rim lip modules, small boulders): one instanced mesh per prop part. */
function instancedBack(props: Record<string, PropParts>, place: Place) {
  const meshes: THREE.InstancedMesh[] = [];
  for (const [name, matrices] of Object.entries(place)) {
    if (!matrices.length) continue;
    for (const { geometry, material, part } of props[name] ?? []) {
      const m = new THREE.InstancedMesh(plain(geometry), own(material), matrices.length);
      matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.receiveShadow = part !== 'glow';
      meshes.push(m);
    }
  }
  return meshes;
}

/** The camera rule: nothing of the backdrop more than 2 m above the floor within 26 m of the centre unless |x| > 12
 *  (every vertex). Returns the backdrop's triangle count. */
function checkCameraRule(meshes: THREE.Mesh[]) {
  const v = new THREE.Vector3();
  const mx = new THREE.Matrix4();
  let tris = 0;
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh) : null;
    const n = inst ? inst.count : 1;
    tris += ((m.geometry.index?.count ?? pos.count) / 3) * n;
    for (let k = 0; k < n; k++) {
      if (inst) inst.getMatrixAt(k, mx);
      else mx.identity();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mx);
        if (Math.abs(v.x) <= 12 && Math.hypot(v.x - RING.x, v.z - RING.z) <= 26 && v.y > 2) {
          throw new Error(`caldera: backdrop breaks the camera rule at (${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`);
        }
      }
    }
  }
  return tris;
}

/** Distance from (x, z) to the surface of obstacle `o`'s capsule. */
function distToObstacle(o: Obstacle, x: number, z: number) {
  const dx = o.bx - o.ax;
  const dz = o.bz - o.az;
  const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((x - o.ax) * dx + (z - o.az) * dz) / l2)) : 0;
  return Math.hypot(x - o.ax - dx * t, z - o.az - dz * t) - o.r;
}

/** Basalt floor: hexagonal columns seen from above, ash drifts on top. Returns the colour map and the lava-crack emissive map. */
export function hexFloor() {
  const R = 40;
  const w = Math.sqrt(3) * R;
  const cells: { x: number; y: number }[] = [];
  for (let row = -1; row * R * 1.5 < 1024 + R; row++) {
    for (let col = -1; col * w < 1024 + w; col++) cells.push({ x: col * w + (row & 1 ? w / 2 : 0), y: row * R * 1.5 });
  }
  const verts = (cx: number, cy: number) => Array.from({ length: 6 }, (_, k) => [cx + R * Math.cos(Math.PI / 6 + (k * Math.PI) / 3), cy + R * Math.sin(Math.PI / 6 + (k * Math.PI) / 3)]);
  const color = canvasTexture(1024, (g, s) => {
    const rnd = seeded(5);
    g.fillStyle = '#17110f';
    g.fillRect(0, 0, s, s);
    for (const c of cells) {
      const v = verts(c.x, c.y);
      const l = 17 + Math.floor(rnd() * 9);
      g.fillStyle = `rgb(${l + 2},${l - 3},${l - 5})`;
      g.beginPath();
      v.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
      g.strokeStyle = '#080605';
      g.lineWidth = 3;
      g.stroke();
    }
    // soft ash drifts lying over the columns (stretched, dark grey, low contrast)
    for (let i = 0; i < 70; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const rx = 30 + rnd() * 90;
      g.save();
      g.translate(x, y);
      g.rotate(rnd() * 3.14);
      g.scale(1, 0.35 + rnd() * 0.3);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, 'rgba(52,47,44,0.3)');
      grad.addColorStop(1, 'rgba(52,47,44,0)');
      g.fillStyle = grad;
      g.fillRect(-rx, -rx, rx * 2, rx * 2);
      g.restore();
    }
  });
  const glow = canvasTexture(1024, (g, s) => {
    const rnd = seeded(9);
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.lineCap = 'round';
    for (const c of cells) {
      const v = verts(c.x, c.y);
      for (let k = 0; k < 6; k++) {
        if (rnd() > 0.05) continue;
        const a = v[k];
        const b = v[(k + 1) % 6];
        g.strokeStyle = '#ff6a1a';
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
    }
  });
  return { color, glow };
}

/** Cracked basalt apron that heats up towards its edge, where the lava lake begins. */
function apronFloor() {
  const rnd = seeded(33);
  const color = canvasTexture(1024, (g, s) => {
    g.fillStyle = '#1a1311';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 14 + rnd() * 50;
      g.fillStyle = `rgba(${rnd() < 0.5 ? '40,30,26' : '8,6,5'},0.25)`;
      g.beginPath();
      g.arc(x, y, r, 0, 6.3);
      g.fill();
    }
    g.strokeStyle = '#070504';
    g.lineWidth = 2.5;
    for (let i = 0; i < 40; i++) {
      let x = rnd() * s;
      let y = rnd() * s;
      let a = rnd() * 6.28;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        a += (rnd() - 0.5) * 1.1;
        x += Math.cos(a) * 28;
        y += Math.sin(a) * 28;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
  const glow = canvasTexture(1024, (g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    // heat band over the last third of the radius (disc radius 22.5 -> glow starts at ~r 17.5)
    const grad = g.createRadialGradient(s / 2, s / 2, s * 0.35, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, 'rgba(120,36,8,0.35)');
    grad.addColorStop(1, 'rgba(255,106,26,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#ff6a1a';
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (let i = 0; i < 55; i++) {
      const a0 = rnd() * 6.28;
      const rr = (0.34 + rnd() * 0.16) * s;
      let x = s / 2 + Math.cos(a0) * rr;
      let y = s / 2 + Math.sin(a0) * rr;
      let a = a0 + (rnd() - 0.5) * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        a += (rnd() - 0.5) * 0.9;
        x += Math.cos(a) * 18;
        y += Math.sin(a) * 18;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
  return { color, glow };
}

export function lavaTexture() {
  const rnd = seeded(77);
  return canvasTexture(
    512,
    (g, s) => {
      g.fillStyle = '#5a1a08';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 150; i++) {
        const x = rnd() * s;
        const y = rnd() * s;
        const r = 12 + rnd() * 40;
        const hot = rnd() < 0.55;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, hot ? 'rgba(200,76,16,0.55)' : 'rgba(18,8,5,0.7)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    8,
  );
}

/** Cooled lava flow ribbons: dark crust strips lying slightly above the floor, with a short skirt. */
function flowRibbons(paths: [number, number][][]) {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const path of paths) {
    const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const pts = curve.getPoints(16);
    const base = pos.length / 3;
    pts.forEach((p, k) => {
      const t = pts[Math.min(k + 1, pts.length - 1)].clone().sub(pts[Math.max(k - 1, 0)]).normalize();
      const f = k / (pts.length - 1);
      const hw = (0.85 - f * 0.4 + Math.sin(k * 1.7 + path[0][0]) * 0.12) / 2;
      const lx = p.x - t.z * hw;
      const lz = p.z + t.x * hw;
      const rx = p.x + t.z * hw;
      const rz = p.z - t.x * hw;
      const y = 0.055 + Math.sin(k * 2.1) * 0.008;
      // top left, top right, skirt left, skirt right
      pos.push(lx, y, lz, rx, y, rz, lx, 0.024, lz, rx, 0.024, rz);
      if (k < pts.length - 1) {
        const a = base + k * 4;
        const b = a + 4;
        idx.push(a, a + 1, b, a + 1, b + 1, b); // top (up)
        idx.push(a, b, a + 2, a + 2, b, b + 2); // left skirt
        idx.push(a + 1, a + 3, b + 1, b + 1, a + 3, b + 3); // right skirt
      }
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** The smoke columns rise from big vents at these angles (degrees), SMOKE_R m from the centre. */
const SMOKE_AT = [35, 160, 265];
const SMOKE_R = 62;

const SMOKE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * 650.0 / -mv.z;
    vA = aAlpha;
    gl_Position = projectionMatrix * mv;
  }
`;
const SMOKE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5)) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export const calderaArena: ArenaDef = {
  id: 'caldera',
  name: 'Ember Caldera',
  hazard: (seed) => new VentEruption(seed),
  shift: () => calderaShift(),
  obstacles: CALDERA_OBSTACLES,
  stage: {
    background: 0x2a0e06,
    zenith: 0x120606,
    horizon: 0x3a1408,
    glow: 0xff5a1a,
    stars: 0,
    fog: 0x2a0e06,
    fogNear: 40,
    fogFar: 130,
    hemiSky: 0xffb080,
    hemiGround: 0x200804,
    hemiIntensity: 0.5,
    sun: 0xffc890,
    sunIntensity: 1.4,
    rim: 0xff6a2a,
    rimIntensity: 0.8,
  },
  build() {
    const g = new THREE.Group();
    const rnd = seeded(4242);
    const nearStart = (x: number, z: number, d: number) => Math.hypot(x, z - 13) < d || Math.hypot(x, z - 1) < d;

    // lava lake beyond the apron (slowly scrolling, dim), apron, basalt floor, obsidian rim with a lava seam
    const lavaTex = lavaTexture();
    const lava = new THREE.Mesh(new THREE.RingGeometry(21, 86, 72, 1), new THREE.MeshBasicMaterial({ map: lavaTex, color: 0xcccccc }));
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(RING.x, 0.01, RING.z);
    const ap = apronFloor();
    const apron = floorDisc(
      22.5,
      new THREE.MeshStandardMaterial({
        map: ap.color, roughness: 0.95, emissive: 0xffffff, emissiveMap: ap.glow, emissiveIntensity: 0.6,
        polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
      }),
      0.016,
    );
    const hx = hexFloor();
    const floor = floorDisc(
      RING.r,
      new THREE.MeshStandardMaterial({ map: hx.color, color: 0xffffff, roughness: 0.9, emissive: 0xffffff, emissiveMap: hx.glow, emissiveIntensity: 0.7 }),
      0.024,
    );
    const rim = flatRing(RING.r - 0.65, RING.r + 0.15, 0x0b090c, 0.97, 0.03);
    const seam = flatRing(RING.r - 0.65, RING.r - 0.56, 0xd8581a, 0.85, 0.034);
    g.add(lava, apron, floor, rim, seam);

    // dim lava vent at the centre (flat decoration, no collision)
    g.add(flatRing(0, 0.8, 0x7a2a0e, 0.9, 0.04), flatRing(0.8, 1.0, 0x0a0706, 0.9, 0.038));

    // cooled lava flow ribbons: from the rim toward the middle, away from both starts
    const flow = (a0: number, a1: number): [number, number][] =>
      [[12.4, a0], [10.4, a0 + (a1 - a0) * 0.35], [8.6, a0 + (a1 - a0) * 0.1], [7.0, a1]].map(([r, a]) => [RING.x + Math.cos((a * Math.PI) / 180) * r, RING.z + Math.sin((a * Math.PI) / 180) * r]);
    const paths = [flow(35, 46), flow(215, 226), flow(150, 138), flow(330, 318)];
    g.add(new THREE.Mesh(flowRibbons(paths), new THREE.MeshStandardMaterial({ color: 0x0f0b0a, roughness: 0.55, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));

    // Cover: the sculpted props, added when the file has loaded (the first pick waits a moment for them). The props
    // pick by height: low / tall obsidian ridge, low / tall basalt cluster; point-symmetric twins are turned half round.
    let disposed = false;
    const _q = new THREE.Quaternion();
    const _up = new THREE.Vector3(0, 1, 0);
    const at = (x: number, z: number, ry: number, sx = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), _q.setFromAxisAngle(_up, ry), new THREE.Vector3(sx, 1, 1));
    void loadProps().then((props) => {
      if (disposed) return;
      const place: Record<string, THREE.Matrix4[]> = { RidgeA: [], RidgeB: [], BasaltA: [], BasaltB: [] };
      CALDERA_OBSTACLES.forEach((o, i) => {
        const twin = i % 2 === 0 ? 0 : Math.PI;
        if (o.kind === 'wall') {
          const dx = o.bx - o.ax, dz = o.bz - o.az;
          const name = o.height < 1.6 ? 'RidgeA' : 'RidgeB';
          place[name].push(at((o.ax + o.bx) / 2, (o.az + o.bz) / 2, Math.atan2(-dz, dx) + twin, (Math.hypot(dx, dz) + 2 * o.r) / RIDGE_MODULE[name]));
        } else place[o.height > 2 ? 'BasaltA' : 'BasaltB'].push(at(o.ax, o.az, 0.6 + twin));
      });
      for (const [name, list] of Object.entries(place)) if (props[name] && list.length) g.add(...instance(props[name], list));
    }).catch((e) => console.warn('caldera: props failed to load', e));

    // the random draws of the old procedural rim lip, so the floor props below keep their places
    for (let i = 0; i < 100; i++) {
      rnd(); rnd(); rnd();
      const n = rnd() < 0.12 ? 2 : 3;
      for (let k = 0; k < n; k++) rnd();
    }
    for (let i = 0; i < 52; i++) rnd();

    // floor props: small rocks and low ash mounds (all < 0.3 m, clear of both starts and the cover)
    const pebbles: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 70; i++) {
      const a = rnd() * 6.283;
      const r = Math.sqrt(rnd()) * 11.2;
      const x = RING.x + Math.cos(a) * r;
      const z = RING.z + Math.sin(a) * r;
      if (nearStart(x, z, 2.2) || CALDERA_OBSTACLES.some((o) => distToObstacle(o, x, z) < 0.5)) continue;
      const s = 0.06 + rnd() * 0.16;
      pebbles.push(bake(new THREE.DodecahedronGeometry(1, 0), x, s * 0.35, z, s, s * 0.7, s * 0.9, 0, rnd() * 3, 0));
    }
    const mounds: THREE.BufferGeometry[] = [];
    const moundAt = (x: number, z: number) => {
      if (nearStart(x, z, 2.5) || CALDERA_OBSTACLES.some((o) => distToObstacle(o, x, z) < 0.6)) return;
      mounds.push(bake(new THREE.SphereGeometry(1, 8, 4), x, 0.02, z, 0.7 + rnd() * 0.9, 0.05 + rnd() * 0.07, 0.5 + rnd() * 0.6, 0, rnd() * 3, 0));
    };
    for (let i = 0; i < 12; i++) {
      const a = rnd() * 6.283;
      const r = 8.5 + rnd() * 2.8;
      moundAt(RING.x + Math.cos(a) * r, RING.z + Math.sin(a) * r);
    }

    g.add(
      merged(pebbles, new THREE.MeshStandardMaterial({ color: 0x2c2724, roughness: 0.9, flatShading: true })),
      merged(mounds, new THREE.MeshStandardMaterial({ color: 0x2c2826, roughness: 1 })),
    );

    // ---- backdrop -------------------------------------------------------------------------------------------
    // Sculpted props from blender/arenas/caldera_backdrop.py, placed (seeded): a jagged obsidian lip round the ring
    // edge, basalt prism clusters, cooled-lava boulders and small vents on the apron, lava-crusted spires standing
    // in the lake, big vents under the smoke columns and the crater wall (segments with thin lava falls) round it
    // all. Taller than 2 m only beyond 26 m from the centre or at |x| > 12 (with the prop's reach as margin), and none
    // at the overview camera (16, 27); checked on every vertex when the props load.
    const brnd = seeded(5151);
    const polar = (r: number, a: number) => [RING.x + Math.cos(a) * r, RING.z + Math.sin(a) * r] as const;
    const back: Place = {}, reps: Place = {};
    const put = (into: Place, name: string, x: number, z: number, ry: number, s = 1, sink = 0.05) =>
      (into[name] ??= []).push(new THREE.Matrix4().compose(new THREE.Vector3(x, -sink * s, z), new THREE.Quaternion().setFromAxisAngle(_up, ry), new THREE.Vector3(s, s, s)));
    const taken: { x: number; z: number; r: number }[] = [];
    const free = (x: number, z: number, r: number) => taken.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + r);
    const tallOk = (x: number, z: number, reach: number) =>
      (Math.abs(x - RING.x) - reach > 12.5 || Math.hypot(x - RING.x, z - RING.z) - reach > 26.5) && Math.hypot(x - 16, z - 27) > 9 + reach;
    /** `count` props of `names` (in turn) between radii r0 and r1, `room` apart (times the scale); `reach` > 0 marks
     *  a tall prop (its radius per unit scale). */
    const scatter = (into: Place, names: string[], count: number, r0: number, r1: number, room: number, s0: number, s1: number, reach = 0, sink = 0.05) => {
      for (let tries = 0, n = 0; n < count && tries < count * 40; tries++) {
        const [x, z] = polar(r0 + (r1 - r0) * Math.sqrt(brnd()), brnd() * Math.PI * 2);
        const s = s0 + (s1 - s0) * brnd();
        if (reach && !tallOk(x, z, reach * s)) continue;
        if (!free(x, z, room * s)) continue;
        put(into, names[n % names.length], x, z, brnd() * Math.PI * 2, s, sink);
        taken.push({ x, z, r: room * s });
        n++;
      }
    };
    // the rim lip: 30 modules round the ring edge, their shards leaning outward (local +Y in Blender = -z here);
    // the taller module (1.24 m) stays away from the low check camera at (9, 16)
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2 + (brnd() - 0.5) * 0.04;
      const [x, z] = polar(12.55, a);
      const tall = i % 3 === 1 && Math.abs(Math.atan2(Math.sin(a - Math.PI / 4), Math.cos(a - Math.PI / 4))) > 0.4;
      (reps[tall ? 'LipB' : 'LipA'] ??= []).push(
        new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(_up, Math.atan2(-Math.cos(a), -Math.sin(a))),
          new THREE.Vector3(0.95 + brnd() * 0.15, 1.0 + brnd() * 0.25, 1)),
      );
    }
    // vents under the three smoke columns (big, in the lake) and three small ones on the apron (under 2 m)
    for (const d of SMOKE_AT) {
      const [x, z] = polar(SMOKE_R, (d * Math.PI) / 180);
      put(back, 'Vent', x, z, brnd() * 6.28, 2.6, 0.1);
      taken.push({ x, z, r: 5 });
    }
    scatter(back, ['Vent'], 3, 16.5, 20.5, 2.0, 0.8, 1.0);
    // tall prism clusters only on the sides (|x| > 12) or out in the lake, low outcrops and boulders all round
    scatter(back, ['Prisms'], 2, 15, 21.5, 2.2, 0.9, 1.1, 2.2);
    scatter(back, ['Prisms'], 1, 27, 34, 2.2, 1.0, 1.3, 2.2);
    scatter(back, ['PrismsLow'], 6, 14.5, 21.5, 1.8, 0.85, 1.15);
    scatter(back, ['Boulder'], 9, 14, 22, 1.4, 0.7, 1.5, 0, 0.08);
    scatter(reps, ['BoulderS'], 14, 13.4, 22, 0.6, 0.7, 1.8, 0, 0.05);
    // lava-crusted spires standing in the lake
    scatter(back, ['SpireA', 'SpireB', 'SpireB'], 15, 32, 60, 4.5, 0.8, 1.35, 3.7, 0.1);
    // the crater wall: 15 segments (39 m wide, scaled up: no gaps at 36 m spacing) facing the ring, front foot near r 80
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * Math.PI * 2 + (brnd() - 0.5) * 0.08;
      const [x, z] = polar(86 + brnd() * 4, a);
      put(back, i % 3 === 2 ? 'WallB' : 'WallA', x, z, Math.atan2(-Math.cos(a), -Math.sin(a)), 1.0 + brnd() * 0.3, 0.3);
    }

    void loadProps().then((props) => {
      if (disposed) return;
      const meshes = [...mergedBack(props, back), ...instancedBack(props, reps)];
      const tris = checkCameraRule(meshes);
      g.add(...meshes);
      console.info(`caldera: backdrop ${Math.round(tris)} triangles in ${meshes.length} meshes`);
    }).catch((e) => console.error('caldera: backdrop failed', e));

    // smoke columns rising from the big vents, with a faint red glow under them
    const COLS = 3;
    const PUFFS = 9;
    const smokeN = COLS * PUFFS;
    const sBase = SMOKE_AT.map((d) => [RING.x + Math.cos((d * Math.PI) / 180) * SMOKE_R, RING.z + Math.sin((d * Math.PI) / 180) * SMOKE_R]);
    const sPos = new Float32Array(smokeN * 3);
    const sSize = new Float32Array(smokeN);
    const sAlpha = new Float32Array(smokeN);
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
    smokeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
    const smoke = new THREE.Points(
      smokeGeo,
      new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(0x1c1210) } }, vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG, transparent: true, depthWrite: false }),
    );
    smoke.frustumCulled = false;
    const glowTex = canvasTexture(128, (c, s) => {
      const grad = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, s, s);
    });
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(sBase.flatMap(([x, z]) => [x, 6, z]), 3));
    const smokeGlow = new THREE.Points(
      glowGeo,
      new THREE.PointsMaterial({ map: glowTex, color: 0x6a1c08, size: 34, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    smokeGlow.frustumCulled = false;
    g.add(smoke, smokeGlow);
    const updateSmoke = (time: number) => {
      for (let i = 0; i < smokeN; i++) {
        const c = i % COLS;
        const u = (time * 0.018 + Math.floor(i / COLS) / PUFFS + c * 0.31) % 1;
        sPos[i * 3] = sBase[c][0] + u * 14 + Math.sin(time * 0.2 + i) * 1.5;
        sPos[i * 3 + 1] = 4 + u * 58;
        sPos[i * 3 + 2] = sBase[c][1] + u * 6 + Math.cos(time * 0.17 + i) * 1.5;
        sSize[i] = 5 + u * 13;
        sAlpha[i] = Math.sin(Math.PI * u) * 0.55;
      }
      smokeGeo.attributes.position.needsUpdate = true;
      smokeGeo.attributes.aSize.needsUpdate = true;
      smokeGeo.attributes.aAlpha.needsUpdate = true;
    };
    updateSmoke(0);

    // lava bubbles popping in the lake (one instanced mesh of half-spheres)
    const BUB = 8;
    const bubbles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff8030 }),
      BUB,
    );
    bubbles.frustumCulled = false;
    bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const bPos = Array.from({ length: BUB }, () => new THREE.Vector3());
    const bT = new Float32Array(BUB);
    const bS = new Float32Array(BUB);
    const bubRespawn = (i: number, first: boolean) => {
      const a = rnd() * 6.283;
      const r = 24 + rnd() * 20;
      bPos[i].set(RING.x + Math.cos(a) * r, 0.02, RING.z + Math.sin(a) * r);
      bT[i] = first ? -rnd() * 6 : -(1.5 + rnd() * 6);
      bS[i] = 0.7 + rnd() * 0.8;
    };
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < BUB; i++) {
      bubRespawn(i, true);
      bubbles.setColorAt(i, tint.setScalar(0));
    }
    g.add(bubbles);

    // rising embers
    const N = 260;
    const pos = new Float32Array(N * 3);
    const vy = new Float32Array(N);
    const ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = rnd() * 6.283;
      const r = Math.sqrt(rnd()) * 22;
      pos[i * 3] = RING.x + Math.cos(a) * r;
      pos[i * 3 + 1] = rnd() * 12;
      pos[i * 3 + 2] = RING.z + Math.sin(a) * r;
      vy[i] = 0.5 + rnd() * 1.3;
      ph[i] = rnd() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const embers = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xff8a3a, size: 0.13, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    embers.frustumCulled = false;
    g.add(embers);

    // slow falling ash flakes (grey)
    const AN = 80;
    const aPos = new Float32Array(AN * 3);
    const aVy = new Float32Array(AN);
    const aPh = new Float32Array(AN);
    for (let i = 0; i < AN; i++) {
      const a = rnd() * 6.283;
      const r = Math.sqrt(rnd()) * 22;
      aPos[i * 3] = RING.x + Math.cos(a) * r;
      aPos[i * 3 + 1] = rnd() * 12;
      aPos[i * 3 + 2] = RING.z + Math.sin(a) * r;
      aVy[i] = 0.35 + rnd() * 0.5;
      aPh[i] = rnd() * 6.28;
    }
    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
    const flakes = new THREE.Points(aGeo, new THREE.PointsMaterial({ color: 0x8a8480, size: 0.1, transparent: true, opacity: 0.6, depthWrite: false }));
    flakes.frustumCulled = false;
    g.add(flakes);

    return {
      group: g,
      update(dt, time) {
        lavaTex.offset.x = (time * 0.004) % 1;
        lavaTex.offset.y = (time * 0.0025) % 1;
        for (let i = 0; i < N; i++) {
          let y = pos[i * 3 + 1] + vy[i] * dt;
          if (y > 12) y -= 12;
          pos[i * 3 + 1] = y;
          pos[i * 3] += Math.sin(time * 0.8 + ph[i]) * 0.35 * dt;
          pos[i * 3 + 2] += Math.cos(time * 0.7 + ph[i]) * 0.3 * dt;
        }
        geo.attributes.position.needsUpdate = true;
        for (let i = 0; i < AN; i++) {
          let y = aPos[i * 3 + 1] - aVy[i] * dt;
          if (y < 0) y += 12;
          aPos[i * 3 + 1] = y;
          aPos[i * 3] += Math.sin(time * 0.4 + aPh[i]) * 0.3 * dt;
          aPos[i * 3 + 2] += Math.cos(time * 0.35 + aPh[i]) * 0.25 * dt;
        }
        aGeo.attributes.position.needsUpdate = true;
        updateSmoke(time);
        for (let i = 0; i < BUB; i++) {
          bT[i] += dt;
          if (bT[i] > 1.2) bubRespawn(i, false);
          const t = bT[i];
          // 0..0.9 s: swell, 0.9..1.2 s: pop (burst outward and fade); before 0: hidden
          const swell = t < 0 ? 0 : Math.min(t / 0.9, 1);
          const pop = t > 0.9 ? (t - 0.9) / 0.3 : 0;
          const s = bS[i] * (swell * (1 - 0.3 * swell) + pop * 0.8);
          dummy.position.copy(bPos[i]);
          dummy.scale.set(s, s * (pop ? 0.35 : 1), s);
          dummy.updateMatrix();
          bubbles.setMatrixAt(i, dummy.matrix);
          bubbles.setColorAt(i, tint.setScalar(t < 0 ? 0 : 1 - pop));
        }
        bubbles.instanceMatrix.needsUpdate = true;
        if (bubbles.instanceColor) bubbles.instanceColor.needsUpdate = true;
      },
      dispose() {
        disposed = true;
        bubbles.dispose();
        disposeTree(g);
      },
    };
  },
};
