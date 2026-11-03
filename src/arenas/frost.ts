import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pillar, wall, type Obstacle } from '../obstacles';
import { IceRift } from './hazards/frost';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef } from './types';

/**
 * Frostfall Lake: a frozen lake in a snowfield at night, ringed by snow-laden pines and mountains under a faint aurora.
 *
 * Cover (`FROST_OBSTACLES`): a low frozen boulder in the middle, two long snow drifts guarding the starts, two
 * short drifts in the far corners, two ice spires flanking the middle and two taller ones on the wings. The cover
 * is sculpted, painted props from Blender (blender/arenas/frost_props.py → public/models/arenas/frost_props.glb),
 * instanced onto the obstacles.
 *
 * Outside the ring: broken ice plates and pressure ridges at the shore, snow-capped boulders and rocks, low scrub
 * pines, frozen dead trees and a snow-laden pine forest on the sculpted snowfield (tall ones only beyond 26 m or at
 * |x| > 12), far chiselled peaks in front of a mountain silhouette. The backdrop props come from
 * blender/arenas/frost_backdrop.py → public/models/arenas/frost_backdrop.glb (placed below: the unique ones merged
 * per material, the repeated ones instanced).
 */

/** Cover layout: point-symmetric about the ring centre (0, 7); checked against the rules in docs/architecture/arenas.md.
 *  Heights are the props' (they pick the prop): 1.25 boulder, 3.7 / 4.28 the two spires, 1.48 / 1.39 the long and
 *  short drifts (with their ice shards). */
export const FROST_OBSTACLES: Obstacle[] = [
  { ...pillar(0, 7, 0.9), height: 1.25 }, // frozen boulder: low, the gameplay camera looks over it
  { ...wall(-2.6, 3.8, -5.8, 2.3), r: 0.4, height: 1.48 }, // long drifts guarding the starts
  { ...wall(2.6, 10.2, 5.8, 11.7), r: 0.4, height: 1.48 },
  { ...pillar(4.3, 4.7, 0.8), height: 3.7 }, // ice spires flanking the middle
  { ...pillar(-4.3, 9.3, 0.8), height: 3.7 },
  { ...pillar(8.2, 7.8, 0.8), height: 4.28 }, // taller spires on the wings
  { ...pillar(-8.2, 6.2, 0.8), height: 4.28 },
  { ...wall(6.0, 1.3, 8.0, 3.3), r: 0.4, height: 1.39 }, // short drifts in the far corners
  { ...wall(-6.0, 12.7, -8.0, 10.7), r: 0.4, height: 1.39 },
];

/** The drift module's length in the props file (a 3.4 m segment plus 2 × 0.4 m ends); drifts stretch it along x. */
const DRIFT_MODULE = 4.2;

// ---- the sculpted props, loaded once and shared by every build ---------------------------------------------------

type PropParts = { geometry: THREE.BufferGeometry; material: THREE.Material; part: string }[];
let propsPromise: Promise<Record<string, PropParts>> | null = null;

/** Brightness of each painted material at night (the Blender files are lit brighter). The cover's three were once
 *  multiplied per mesh, five meshes each, so the same look is the factor to the fifth power. */
const TUNE: Record<string, number> = { ice: 0.75 ** 5, snow: 0.66 ** 5, rock: 0.85 ** 5, bark: 0.55, needle: 0.6, dead: 0.32 };

/** frost_props.glb and frost_backdrop.glb as {prop name: its parts (one per material)}; objects there are named
 *  "<Prop>__<material>". Both files share material names; the first one loaded of each name (the cover's) is used. */
function loadProps() {
  propsPromise ??= (() => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = `${import.meta.env.BASE_URL}models/arenas/`;
    return Promise.all([loader.loadAsync(`${base}frost_props.glb`), loader.loadAsync(`${base}frost_backdrop.glb`)]).then((files) => {
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
          // Night lake: the snow darker than in the Blender file (its painted shadows are already blue), the rock a
          // little darker, the ice with a faint cold glow. The loader shares one material between the meshes that use
          // it: tune each once.
          if (!tuned.has(material)) {
            tuned.add(material);
            material.color.multiplyScalar(TUNE[part] ?? 0.6);
            if (part === 'ice') { material.emissive.setHex(0x1a5a7a); material.emissiveIntensity = 0.3; }
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

// ---- the backdrop: placed props merged per material (the repeated ones instanced) --------------------------------

type Place = Record<string, THREE.Matrix4[]>;

/** How much darker the backdrop is than the cover: the snow out there must not outshine the heroes and spells. */
const BACK_DIM = 0.72;

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
  // the shore ice's clearcoat glints round the rim would read as sparks
  if (mat instanceof THREE.MeshPhysicalMaterial) mat.clearcoat = 0;
  mat.roughness = Math.max(mat.roughness, 0.45);
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
    if (!g) throw new Error(`frost: merging ${part} failed`);
    const m = new THREE.Mesh(g, own(material));
    m.receiveShadow = true;
    meshes.push(m);
  }
  return meshes;
}

/** The repeated props (pines, rocks, shore plates): one instanced mesh per prop part. */
function instancedBack(props: Record<string, PropParts>, place: Place) {
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

/** The camera rule: nothing of the backdrop more than 2 m above the snowfield within 26 m of the centre unless
 *  |x| > 12 (every vertex). Returns the backdrop's triangle count. */
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
        if (Math.abs(v.x) <= 12 && Math.hypot(v.x - RING.x, v.z - RING.z) <= 26 && v.y - snowH(v.x, v.z) > 2) {
          throw new Error(`frost: backdrop breaks the camera rule at (${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`);
        }
      }
    }
  }
  return tris;
}

// ---- value noise (shapes the snowfield and the mountain ridges) ------------------------------------------------
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash2 = (ix: number, iz: number) => {
  const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function vnoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), u), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), u), v);
}
const fbm = (x: number, z: number) => (0.5 * vnoise(x, z) + 0.25 * vnoise(x * 2 + 17, z * 2 + 3) + 0.125 * vnoise(x * 4 + 5, z * 4 + 31)) / 0.875;

/** Wind-blown ridge pattern of the snowfield (0..0.5): sharp crests running across the wind. */
function windRidge(x: number, z: number) {
  const u = (x * 0.8 + z * 0.6) * 0.32 + fbm(x * 0.045, z * 0.045) * 7;
  return Math.pow(1 - Math.abs(Math.sin(u)), 3) * 0.5;
}

/** Height of the snowfield apron at a world position: flat inside radius ~13.5, low swells near the ring (< 0.5 m
 *  within 16 m), higher drifts and a rising bowl far out. */
function snowH(x: number, z: number) {
  const d = Math.hypot(x - RING.x, z - RING.z);
  const mask = smooth(13.5, 24, d);
  return mask * (fbm(x * 0.06 + 9, z * 0.06) * 1.7 + windRidge(x, z)) + smooth(30, 50, d) * 4;
}

/** The snowfield: a displaced ring-shaped mesh (wind ridges, rock patches in the vertex colours). */
function apronGeometry() {
  const NR = 46;
  const NA = 128;
  const pos = new Float32Array((NR + 1) * (NA + 1) * 3);
  const uv = new Float32Array((NR + 1) * (NA + 1) * 2);
  const col = new Float32Array((NR + 1) * (NA + 1) * 3);
  const idx: number[] = [];
  for (let i = 0; i <= NR; i++) {
    const r = 11.6 + 48.4 * Math.pow(i / NR, 1.6);
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      const x = RING.x + Math.cos(a) * r;
      const z = RING.z + Math.sin(a) * r;
      const v = i * (NA + 1) + j;
      pos.set([x, snowH(x, z), z], v * 3);
      uv.set([x / 20, z / 20], v * 2);
      const d = Math.hypot(x - RING.x, z - RING.z);
      const rockiness = smooth(0.58, 0.72, fbm(x * 0.1 + 40, z * 0.1 + 7)) * smooth(14, 20, d);
      // kept dim: bright snow on the horizon would outshine the heroes and spells
      const lit = 0.74 + windRidge(x, z) * 0.16;
      col.set([lerp(lit, 0.46, rockiness), lerp(lit, 0.48, rockiness), lerp(lit, 0.54, rockiness)], v * 3);
      if (i < NR && j < NA) {
        const c = v + NA + 1;
        idx.push(v, v + 1, c, v + 1, c + 1, c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function iceTexture() {
  const rnd = seeded(7);
  const px = (wx: number) => (wx / 24 + 0.5) * 1024;
  const pz = (wz: number) => ((wz - RING.z) / 24 + 0.5) * 1024;
  return canvasTexture(1024, (g, s) => {
    // deep under-layer
    g.fillStyle = '#121c28';
    g.fillRect(0, 0, s, s);
    const depth = g.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.5);
    depth.addColorStop(0, 'rgba(4,10,20,0.35)');
    depth.addColorStop(1, 'rgba(4,10,20,0)');
    g.fillStyle = depth;
    g.fillRect(0, 0, s, s);
    // deep cracks: wide soft dark lines with a blue edge
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = rnd() * s;
      let y = rnd() * s;
      let a = rnd() * 6.28;
      const pts: number[][] = [[x, y]];
      for (let k = 0; k < 9; k++) {
        a += (rnd() - 0.5) * 0.7;
        x += Math.cos(a) * 45;
        y += Math.sin(a) * 45;
        pts.push([x, y]);
      }
      for (const [w, c] of [
        [10 + rnd() * 6, 'rgba(28,80,130,0.22)'],
        [4 + rnd() * 3, 'rgba(3,8,16,0.65)'],
      ] as const) {
        g.strokeStyle = c;
        g.lineWidth = w;
        g.beginPath();
        pts.forEach(([qx, qy], k) => (k ? g.lineTo(qx, qy) : g.moveTo(qx, qy)));
        g.stroke();
      }
    }
    // trapped bubbles: strings of small rings rising towards the surface
    for (let i = 0; i < 26; i++) {
      let x = rnd() * s;
      let y = rnd() * s;
      const n = 3 + Math.floor(rnd() * 6);
      for (let k = 0; k < n; k++) {
        const r = 1.5 + rnd() * 6;
        g.fillStyle = 'rgba(120,170,210,0.06)';
        g.strokeStyle = `rgba(170,210,235,${0.14 + rnd() * 0.12})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, y, r, 0, 6.3);
        g.fill();
        g.stroke();
        x += (rnd() - 0.5) * 22;
        y += (rnd() - 0.5) * 22;
      }
    }
    // a sunken branch (dark, forked)
    const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
      g.strokeStyle = 'rgba(52,38,30,0.75)';
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len;
      g.lineTo(ex, ey);
      g.stroke();
      if (depth > 0) {
        branch(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, a + 0.6, len * 0.45, w * 0.6, depth - 1);
        branch(x + Math.cos(a) * len * 0.75, y + Math.sin(a) * len * 0.75, a - 0.7, len * 0.4, w * 0.6, depth - 1);
      }
    };
    branch(px(-9), pz(2), 0.35, 120, 6, 2);
    branch(px(3.5), pz(9), 2.6, 90, 5, 2);
    // frozen fish under the ice
    const fish = (wx: number, wz: number, a: number, len: number) => {
      g.save();
      g.translate(px(wx), pz(wz));
      g.rotate(a);
      g.fillStyle = 'rgba(70,112,140,0.5)';
      g.strokeStyle = 'rgba(150,195,220,0.28)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(0, 0, len / 2, len / 5, 0, 0, 6.3);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(-len / 2 + 2, 0);
      g.lineTo(-len / 2 - len * 0.28, -len * 0.2);
      g.lineTo(-len / 2 - len * 0.28, len * 0.2);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(20,30,40,0.8)';
      g.beginPath();
      g.arc(len * 0.3, -len * 0.03, 2, 0, 6.3);
      g.fill();
      g.restore();
    };
    fish(-5.2, 9.6, 0.5, 62);
    fish(6.8, 2.6, 3.5, 52);
    fish(-1.8, 5.2, 2.2, 44);
  });
}

/** Faint frosted top layer over the ice: swirls, thin pale cracks and rime growing toward the rim. */
function frostTexture() {
  const rnd = seeded(11);
  return canvasTexture(1024, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.lineWidth = 7;
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(150,195,230,${0.035 + rnd() * 0.03})`;
      g.beginPath();
      g.arc(rnd() * s, rnd() * s, 30 + rnd() * 120, rnd() * 6, rnd() * 6 + 1 + rnd() * 2);
      g.stroke();
    }
    const crack = (x: number, y: number, a: number, len: number, depth: number) => {
      g.strokeStyle = `rgba(190,224,240,${0.3 + depth * 0.1})`;
      g.lineWidth = 0.8 + depth * 0.4;
      g.beginPath();
      g.moveTo(x, y);
      for (let d = 0; d < len; d += 18) {
        a += (rnd() - 0.5) * 0.55;
        x += Math.cos(a) * 18;
        y += Math.sin(a) * 18;
        g.lineTo(x, y);
        if (depth > 0 && rnd() < 0.16) crack(x, y, a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.7), len * 0.45, depth - 1);
      }
      g.stroke();
    };
    for (let i = 0; i < 9; i++) crack(rnd() * s, rnd() * s, rnd() * 6.28, 200 + rnd() * 240, 2);
    // rime: a white-blue haze toward the rim and short frost spikes pointing inward
    const rime = g.createRadialGradient(s / 2, s / 2, s * 0.36, s / 2, s / 2, s * 0.5);
    rime.addColorStop(0, 'rgba(200,225,240,0)');
    rime.addColorStop(1, 'rgba(200,225,240,0.22)');
    g.fillStyle = rime;
    g.fillRect(0, 0, s, s);
    g.lineCap = 'round';
    for (let i = 0; i < 520; i++) {
      const a = rnd() * 6.283;
      const r0 = s * (0.49 - rnd() * 0.07);
      const len = 6 + rnd() * 22;
      g.strokeStyle = `rgba(220,236,246,${0.1 + rnd() * 0.14})`;
      g.lineWidth = 0.8 + rnd() * 1.2;
      g.beginPath();
      g.moveTo(s / 2 + Math.cos(a) * r0, s / 2 + Math.sin(a) * r0);
      g.lineTo(s / 2 + Math.cos(a + (rnd() - 0.5) * 0.15) * (r0 - len), s / 2 + Math.sin(a + (rnd() - 0.5) * 0.15) * (r0 - len));
      g.stroke();
    }
  });
}

function snowTexture() {
  const rnd = seeded(21);
  return canvasTexture(1024, (g, s) => {
    g.fillStyle = '#2a3644';
    g.fillRect(0, 0, s, s);
    // soft blobs, wrapped so the tile repeats without a seam
    for (let i = 0; i < 240; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 20 + rnd() * 70;
      const l = rnd() < 0.6;
      for (const ox of [-s, 0, s]) {
        for (const oy of [-s, 0, s]) {
          const cx = x + ox;
          const cy = y + oy;
          if (cx < -r || cx > s + r || cy < -r || cy > s + r) continue;
          const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
          grad.addColorStop(0, l ? 'rgba(88,108,130,0.22)' : 'rgba(10,16,26,0.25)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
    }
    // fine wind streaks along the wind direction (x*0.8 + z*0.6 is across: streaks run along (0.6, -0.8))
    g.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const len = 40 + rnd() * 120;
      g.strokeStyle = rnd() < 0.6 ? 'rgba(96,116,138,0.14)' : 'rgba(8,14,22,0.16)';
      g.lineWidth = 1 + rnd() * 2.5;
      for (const ox of [-s, 0, s]) {
        for (const oy of [-s, 0, s]) {
          g.beginPath();
          g.moveTo(x + ox, y + oy);
          g.lineTo(x + ox + 0.6 * len, y + oy - 0.8 * len);
          g.stroke();
        }
      }
    }
  });
}

/** A jagged mountain ridge ring (flat silhouette) with a pale snow line on the peaks. */
function mountainRing(R: number, base: number, amp: number, seedOff: number, dark: number, snowCol: number) {
  const NA = 180;
  const pos = new Float32Array((NA + 1) * 3 * 3);
  const col = new Float32Array((NA + 1) * 3 * 3);
  const cDark = new THREE.Color(dark);
  const cSnow = new THREE.Color(snowCol);
  const idx: number[] = [];
  for (let j = 0; j <= NA; j++) {
    const a = (j / NA) * Math.PI * 2;
    const ridge = (k: number, p: number) => 1 - Math.abs(Math.sin(k * a + p));
    const n =
      0.45 * ridge(5, seedOff) + 0.3 * ridge(9, seedOff * 2.3) + 0.2 * ridge(17, seedOff * 3.1) + 0.1 * hash2(j % NA, seedOff) +
      0.25 * Math.sin(2 * a + seedOff);
    const top = base + amp * Math.max(0.05, n);
    const x = Math.cos(a) * R + RING.x;
    const z = Math.sin(a) * R + RING.z;
    const rows = [-6, top * 0.55, top];
    for (let k = 0; k < 3; k++) {
      const v = j * 3 + k;
      pos.set([x, rows[k], z], v * 3);
      const c = k === 2 ? cSnow : cDark;
      col.set([c.r, c.g, c.b], v * 3);
      if (j < NA && k < 2) idx.push(v, v + 3, v + 1, v + 1, v + 3, v + 4);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

export const frostArena: ArenaDef = {
  id: 'frost',
  name: 'Frostfall Lake',
  hazard: (seed) => new IceRift(seed),
  obstacles: FROST_OBSTACLES,
  stage: {
    background: 0x1a2a3a,
    zenith: 0x0a1a2e,
    horizon: 0x3a5a78,
    glow: 0x8fc8e8,
    stars: 0.3,
    fog: 0x2a4058,
    fogNear: 30,
    fogFar: 120,
    hemiSky: 0xbfe0ff,
    hemiGround: 0x1a2a3a,
    hemiIntensity: 0.65,
    sun: 0xe8f4ff,
    sunIntensity: 1.3,
    rim: 0x9fd8ff,
    rimIntensity: 1.0,
  },
  build() {
    const g = new THREE.Group();
    const rnd = seeded(1337);

    // floors: displaced snowfield, glossy dark ice (deep layer + frosted top), packed-snow rim
    const apron = new THREE.Mesh(
      apronGeometry(),
      new THREE.MeshStandardMaterial({
        map: snowTexture(), vertexColors: true, color: 0xffffff, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
      }),
    );
    apron.position.y = 0.006;
    apron.receiveShadow = true;
    const ice = floorDisc(RING.r, new THREE.MeshStandardMaterial({ map: iceTexture(), color: 0xa8b4c4, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.25 }), 0.02);
    const frost = floorDisc(
      RING.r,
      new THREE.MeshStandardMaterial({
        map: frostTexture(), color: 0x8a96a6, roughness: 0.9, envMapIntensity: 0.2, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }),
      0.024,
    );
    frost.renderOrder = 1;
    const snowBand = flatRing(RING.r - 0.7, RING.r + 0.35, 0x5a6c80, 0.95, 0.03);
    const rimLine = flatRing(RING.r - 0.08, RING.r, 0xb8d4e8, 0.8, 0.036);
    snowBand.renderOrder = 2;
    rimLine.renderOrder = 3;
    g.add(apron, ice, frost, snowBand, rimLine);

    // Cover: the sculpted props, added when the files have loaded (the first pick waits a moment for them). Drifts
    // turn their long windward slope away from the centre; point-symmetric twins are turned half round.
    let disposed = false;
    const _q = new THREE.Quaternion();
    const _up = new THREE.Vector3(0, 1, 0);
    const at = (x: number, z: number, ry: number, sx = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), _q.setFromAxisAngle(_up, ry), new THREE.Vector3(sx, 1, 1));
    void loadProps().then((props) => {
      if (disposed) return;
      const place: Record<string, THREE.Matrix4[]> = { Boulder: [], SpireA: [], SpireB: [], DriftA: [], DriftB: [] };
      FROST_OBSTACLES.forEach((o, i) => {
        const twin = i % 2 === 0 ? 0 : Math.PI;
        if (o.kind === 'wall') {
          const dx = o.bx - o.ax, dz = o.bz - o.az;
          const cx = (o.ax + o.bx) / 2, cz = (o.az + o.bz) / 2;
          let ry = Math.atan2(-dz, dx);
          if (Math.sin(ry) * (RING.x - cx) + Math.cos(ry) * (RING.z - cz) > 0) ry += Math.PI;
          place[o.height > 1.42 ? 'DriftA' : 'DriftB'].push(at(cx, cz, ry, (Math.hypot(dx, dz) + 2 * o.r) / DRIFT_MODULE));
        } else if (o.height < 2) place.Boulder.push(at(o.ax, o.az, 0.4));
        else place[o.height < 4.0 ? 'SpireA' : 'SpireB'].push(at(o.ax, o.az, 0.9 + twin));
      });
      for (const [name, list] of Object.entries(place)) if (props[name] && list.length) g.add(...instance(props[name], list));
    }).catch((e) => console.warn('frost: props failed to load', e));

    // ---- backdrop -------------------------------------------------------------------------------------------
    // Sculpted props from blender/arenas/frost_backdrop.py, placed (seeded) on the snowfield (sunk a little into
    // it): broken ice plates all round the shore, pressure ridges along it, snow-capped boulders and rocks, low
    // scrub pines near the ring, frozen dead trees and the snow-laden forest further out, far pines and chiselled
    // peaks on the horizon. Taller than 2 m only beyond 26 m from the centre or at |x| > 12 (with the prop's reach
    // as margin), and none at the overview camera (16, 27); checked on every vertex when the props load.
    const polar = (r: number, a: number) => [RING.x + Math.cos(a) * r, RING.z + Math.sin(a) * r] as const;
    const back: Place = {}, reps: Place = {};
    const put = (into: Place, name: string, x: number, z: number, ry: number, s = 1, sink = 0.1) =>
      (into[name] ??= []).push(
        new THREE.Matrix4().compose(new THREE.Vector3(x, snowH(x, z) - sink * s, z), new THREE.Quaternion().setFromAxisAngle(_up, ry), new THREE.Vector3(s, s, s)),
      );
    const taken: { x: number; z: number; r: number }[] = [];
    const free = (x: number, z: number, r: number) => taken.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + r);
    const tallOk = (x: number, z: number, reach: number) =>
      (Math.abs(x - RING.x) - reach > 12.5 || Math.hypot(x - RING.x, z - RING.z) - reach > 26.5) && Math.hypot(x - 16, z - 27) > 9 + reach;
    /** `count` props of `names` (in turn) between radii r0 and r1, `room` apart (times the scale); `reach` > 0 marks
     *  a tall prop (its crown's radius per unit scale). */
    const scatter = (into: Place, names: string[], count: number, r0: number, r1: number, room: number, s0: number, s1: number, reach = 0, sink = 0.1) => {
      for (let tries = 0, n = 0; n < count && tries < count * 40; tries++) {
        const [x, z] = polar(r0 + (r1 - r0) * Math.sqrt(rnd()), rnd() * Math.PI * 2);
        const s = s0 + (s1 - s0) * rnd();
        if (reach && !tallOk(x, z, reach * s)) continue;
        if (!free(x, z, room * s)) continue;
        put(into, names[n % names.length], x, z, rnd() * Math.PI * 2, s, sink);
        taken.push({ x, z, r: room * s });
        n++;
      }
    };
    // the shore: plate clusters all round, pressure ridges running along it (all under 1 m)
    for (let i = 0; i < 24; i++) {
      const [x, z] = polar(12.9 + rnd() * 0.5, (i / 24) * Math.PI * 2 + (rnd() - 0.5) * 0.12);
      put(reps, 'Plates', x, z, rnd() * Math.PI * 2, 0.85 + rnd() * 0.35, 0.05);
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd() * 0.5;
      const [x, z] = polar(14.6 + rnd() * 2.5, a);
      put(back, 'Ridge', x, z, Math.atan2(-Math.cos(a), -Math.sin(a)) + (rnd() - 0.5) * 0.4, 0.9 + rnd() * 0.3, 0.12);
      taken.push({ x, z, r: 2.4 });
    }
    // boulders (BoulderA stays under 2 m: scale <= 1.25), the forest, low scrub and rocks between
    scatter(back, ['BoulderA', 'BoulderB'], 10, 15.5, 34, 1.8, 0.8, 1.25, 0, 0.15);
    scatter(back, ['DeadTree'], 7, 19, 40, 2.5, 0.85, 1.2, 2.6, 0.2);
    scatter(reps, ['PineA', 'PineB', 'PineC'], 36, 19, 46, 2.4, 0.8, 1.25, 2.7, 0.25);
    scatter(reps, ['PineS'], 26, 15, 26, 1.0, 0.75, 1.1, 0, 0.1);
    scatter(reps, ['RockS'], 20, 14, 32, 0.6, 0.7, 1.6, 0, 0.08);
    scatter(reps, ['PineFar'], 24, 46, 62, 3.0, 1.0, 1.5, 2.7, 0.25);
    // far peaks round the horizon, in front of the mountain silhouette
    for (let i = 0; i < 10; i++) {
      const [x, z] = polar(66 + rnd() * 16, (i / 10) * Math.PI * 2 + rnd() * 0.4);
      put(back, i % 3 ? 'PeakB' : 'PeakA', x, z, rnd() * Math.PI * 2, 0.9 + rnd() * 0.6, 0.1);
    }

    void loadProps().then((props) => {
      if (disposed) return;
      const meshes = [...mergedBack(props, back), ...instancedBack(props, reps)];
      const tris = checkCameraRule(meshes);
      g.add(...meshes);
      console.info(`frost: backdrop ${Math.round(tris)} triangles in ${meshes.length} meshes`);
    }).catch((e) => console.error('frost: backdrop failed', e));

    // far backdrop: a mountain silhouette ring behind the peaks
    const farRidge = mountainRing(105, 12, 22, 1.7, 0x111b26, 0x2c3b4a);
    // faint aurora ribbon, behind everything: additive, low opacity, slow wave
    const NA = 96;
    const aPos = new Float32Array((NA + 1) * 3 * 3);
    const aCol = new Float32Array((NA + 1) * 3 * 3);
    const green = new THREE.Color(0.08, 0.5, 0.32);
    const violet = new THREE.Color(0.34, 0.18, 0.5);
    const aIdx: number[] = [];
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      const b = smooth(-0.2, 0.6, Math.sin(3 * a + 0.7) * 0.7 + Math.sin(7 * a) * 0.3);
      const c = green.clone().lerp(violet, 0.5 + 0.5 * Math.sin(2 * a)).multiplyScalar(b);
      for (let k = 0; k < 3; k++) {
        const v = j * 3 + k;
        aPos.set([RING.x + Math.cos(a) * 150, 0, RING.z + Math.sin(a) * 150], v * 3);
        const m = k === 1 ? 1 : 0;
        aCol.set([c.r * m, c.g * m, c.b * m], v * 3);
        if (j < NA && k < 2) aIdx.push(v, v + 3, v + 1, v + 1, v + 3, v + 4);
      }
    }
    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
    aGeo.setAttribute('color', new THREE.BufferAttribute(aCol, 3));
    aGeo.setIndex(aIdx);
    const aurora = new THREE.Mesh(
      aGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    );
    aurora.frustumCulled = false;
    aurora.renderOrder = -1;
    const auroraWave = (time: number) => {
      for (let j = 0; j <= NA; j++) {
        const w = Math.sin((j / NA) * Math.PI * 2 * 5 + time * 0.15) * 4 + Math.sin((j / NA) * Math.PI * 2 * 3 - time * 0.09) * 3;
        aPos[(j * 3) * 3 + 1] = 40 + w;
        aPos[(j * 3 + 1) * 3 + 1] = 62 + w * 1.5;
        aPos[(j * 3 + 2) * 3 + 1] = 95 + w * 2;
      }
      aGeo.attributes.position.needsUpdate = true;
    };
    auroraWave(0);

    g.add(farRidge, aurora);

    // ground mist wisps drifting along the rim (instanced flat quads, additive, fade in and out)
    const WISPS = 10;
    const mistTex = canvasTexture(128, (c, s) => {
      const grad = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, s, s);
    });
    const mist = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: mistTex, color: 0x9db8d0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      WISPS,
    );
    mist.frustumCulled = false;
    mist.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const wAng = new Float32Array(WISPS);
    const wRad = new Float32Array(WISPS);
    const wSpd = new Float32Array(WISPS);
    const wLife = new Float32Array(WISPS);
    const wLen = new Float32Array(WISPS);
    const wSize = new Float32Array(WISPS);
    const respawn = (i: number, first: boolean) => {
      wAng[i] = rnd() * 6.283;
      wRad[i] = 11.5 + rnd() * 4;
      wSpd[i] = (rnd() < 0.5 ? -1 : 1) * (0.015 + rnd() * 0.03);
      wLife[i] = first ? rnd() : 0;
      wLen[i] = 14 + rnd() * 14;
      wSize[i] = 5 + rnd() * 4;
    };
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < WISPS; i++) {
      respawn(i, true);
      mist.setColorAt(i, tint.setScalar(0));
    }
    g.add(mist);

    // falling snow
    const N = 300;
    const pos = new Float32Array(N * 3);
    const vy = new Float32Array(N);
    const ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = rnd() * 6.283;
      const r = Math.sqrt(rnd()) * 24;
      pos[i * 3] = RING.x + Math.cos(a) * r;
      pos[i * 3 + 1] = rnd() * 14;
      pos[i * 3 + 2] = RING.z + Math.sin(a) * r;
      vy[i] = 0.7 + rnd() * 1.0;
      ph[i] = rnd() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xeaf4ff, size: 0.14, transparent: true, opacity: 0.85, depthWrite: false }));
    flakes.frustumCulled = false;
    g.add(flakes);

    return {
      group: g,
      update(dt, time) {
        for (let i = 0; i < N; i++) {
          let y = pos[i * 3 + 1] - vy[i] * dt;
          if (y < 0) y += 14;
          pos[i * 3 + 1] = y;
          pos[i * 3] += Math.sin(time * 0.6 + ph[i]) * 0.25 * dt;
          pos[i * 3 + 2] += Math.cos(time * 0.5 + ph[i]) * 0.18 * dt;
        }
        geo.attributes.position.needsUpdate = true;
        auroraWave(time);
        for (let i = 0; i < WISPS; i++) {
          wLife[i] += dt / wLen[i];
          if (wLife[i] > 1) respawn(i, false);
          wAng[i] += wSpd[i] * dt;
          const f = Math.sin(Math.PI * wLife[i]);
          dummy.position.set(RING.x + Math.cos(wAng[i]) * wRad[i], 0.3 + 0.08 * Math.sin(time * 0.4 + i), RING.z + Math.sin(wAng[i]) * wRad[i]);
          dummy.rotation.set(-Math.PI / 2, 0, -wAng[i]);
          dummy.scale.set(wSize[i], wSize[i] * 0.45, 1);
          dummy.updateMatrix();
          mist.setMatrixAt(i, dummy.matrix);
          mist.setColorAt(i, tint.setScalar(f * 0.22));
        }
        mist.instanceMatrix.needsUpdate = true;
        if (mist.instanceColor) mist.instanceColor.needsUpdate = true;
      },
      dispose() {
        disposed = true;
        mist.dispose();
        disposeTree(g);
      },
    };
  },
};
