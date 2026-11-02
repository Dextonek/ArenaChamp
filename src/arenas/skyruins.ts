import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pillar, wall, type Obstacle } from '../obstacles';
import { RING, canvasTexture, disposeTree, flatRing, seeded } from './common';
import type { ArenaDef, ArenaStage } from './types';

/**
 * Sky Ruins: a floating slate-marble platform above a sea of clouds at dusk. The tool's slab floor is hidden
 * (`hideGround`), so the platform (top surface at y 0.01, radius ~13, a crumbling edge going down ~5 m) is the only
 * floor, with a compass-rose inlay and worn tiles.
 *
 * Cover (`SKYRUINS_OBSTACLES`): two low broken drum stacks flank the middle on the cross axis, two low balustrade
 * fragments stand off the starts, two tall intact columns with capitals and two tall broken columns stand off the
 * z axis, two broken arch bases (a pier with the stub of its arch, a broken pier, a heap of fallen blocks) guard the
 * wings. Outside the ring: a broken balustrade and crumbling slate blocks along the edge, a toppled column, rock
 * chunks hanging under the edge, floating islands with ruins on them (a ring of columns, a temple, a great broken
 * column), the big broken arch on its islet to the west, loose rocks floating by, cloud puffs, birds.
 * Cover and backdrop are sculpted, painted props from Blender (blender/arenas/skyruins_props.py →
 * public/models/arenas/skyruins_props.glb and skyruins_backdrop.glb): unique placements merged into one mesh per
 * material, the repeated edge pieces instanced.
 */

const STAGE: ArenaStage = {
  background: 0x3a4470,
  zenith: 0x0b1030,
  horizon: 0x5a6aa8,
  glow: 0xffb08a,
  stars: 0.6,
  fog: 0x3a4470,
  fogNear: 60,
  fogFar: 200,
  hemiSky: 0xd0d8ff,
  hemiGround: 0x2a2030,
  hemiIntensity: 0.7,
  sun: 0xfff0e0,
  sunIntensity: 1.6,
  rim: 0xb0c0ff,
  rimIntensity: 1.0,
};

/** Cover layout: point-symmetric about the ring centre (0, 7); checked against the rules in docs/architecture/arenas.md.
 *  Heights are the props' measured heights (they pick the prop): 1.36 / 1.35 the drum stacks, 1.2 / 1.23 the
 *  balustrades (both low: they stand near the z axis, where the gameplay camera looks over them), 4.28 / 4.48 the
 *  intact columns, 3.2 / 2.86 the broken ones, 3.82 / 3.83 the arch bases. Twins follow each other. */
export const SKYRUINS_OBSTACLES: Obstacle[] = [
  { ...pillar(2.4, 7.0, 0.7), height: 1.36 }, // low broken drum stacks flanking the middle
  { ...pillar(-2.4, 7.0, 0.7), height: 1.35 },
  { ...wall(2.6, 3.8, 4.8, 3.0), height: 1.2 }, // low balustrade fragments off the starts
  { ...wall(-2.6, 10.2, -4.8, 11.0), height: 1.23 },
  { ...pillar(4.8, 10.0, 0.85), height: 4.28 }, // tall intact columns with capitals and ivy
  { ...pillar(-4.8, 4.0, 0.85), height: 4.48 },
  { ...pillar(6.6, 6.4, 0.85), height: 3.2 }, // tall broken columns
  { ...pillar(-6.6, 7.6, 0.85), height: 2.86 },
  { ...wall(8.9, 9.0, 7.9, 11.1), r: 0.4, height: 3.82 }, // broken arch bases on the wings
  { ...wall(-8.9, 5.0, -7.9, 2.9), r: 0.4, height: 3.83 },
];

/** The wall modules' lengths in the props file (wall segment plus 2 × the capsule radius); walls stretch them along x. */
const MODULE = { BalA: 3.04, BalB: 3.04, ArchA: 3.13, ArchB: 3.13 };

const RADIUS_TEX = 13.4; // the platform texture covers this radius

/** Edge of the platform: irregular, but never inside the rim line at 12. */
const edgeR = (th: number) => 12.75 + 0.3 * Math.sin(3 * th + 0.5) + 0.2 * Math.sin(8 * th);

/** Yaw (about y) that turns a local +x axis into the tangent of the circle at angle `th`. */
const tanYaw = (th: number) => Math.atan2(-Math.cos(th), -Math.sin(th));

/** Angular spans (degrees) of the low broken balustrade along the platform edge. */
const BALUSTRADE: [number, number][] = [[18, 52], [78, 98], [132, 176], [204, 232], [292, 334]];
const BAL_R = 12.62;
const inBalustrade = (th: number, margin = 0) => {
  const d = (((th * 180) / Math.PI) % 360 + 360) % 360;
  return BALUSTRADE.some(([a, b]) => d >= a - margin && d <= b + margin);
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

// ---- the sculpted props, loaded once and shared by every build ---------------------------------------------------

type PropParts = { geometry: THREE.BufferGeometry; material: THREE.Material; part: string }[];
let propsPromise: Promise<Record<string, PropParts>> | null = null;

/** Brightness of each painted material in the dusk light (the Blender files are lit brighter). */
const TUNE: Record<string, number> = { marble: 0.36, chip: 0.36, gold: 0.6, ivy: 0.45, rock: 0.55, grass: 0.45 };

/** skyruins_props.glb and skyruins_backdrop.glb as {prop name: its parts (one per material)}; objects there are
 *  named "<Prop>__<material>". Both files share material names; the first one loaded of each name is used for all. */
function loadProps() {
  propsPromise ??= (() => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = `${import.meta.env.BASE_URL}models/arenas/`;
    return Promise.all([loader.loadAsync(`${base}skyruins_props.glb`), loader.loadAsync(`${base}skyruins_backdrop.glb`)]).then((files) => {
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
          const own = m.material as THREE.MeshStandardMaterial;
          if (!byPart.has(part)) byPart.set(part, own);
          const material = byPart.get(part) as THREE.MeshStandardMaterial;
          // the loader shares one material between the meshes that use it: tune each once
          if (!tuned.has(material)) {
            tuned.add(material);
            material.color.multiplyScalar(TUNE[part] ?? 0.6);
            // rougher gold: the sun's highlight on the thin bands bloomed into white rings
            if (part === 'gold') material.roughness = Math.max(material.roughness, 0.5);
            // a sheen from the Blender file would turn the stone and leaves milky under the dusk rim light
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

type Place = Record<string, THREE.Matrix4[]>;

/** A build's own copy of a material, reading the painted vertex colours. */
function own(material: THREE.Material) {
  const mat = material.clone() as THREE.MeshStandardMaterial;
  mat.vertexColors = true;
  return mat;
}

/** Places props (each by its matrices) and merges every placed part into one mesh per material: one draw call per
 *  material for the group (each build gets its own geometry and material copies to dispose). */
function merged(props: Record<string, PropParts>, place: Place, shadow: boolean) {
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
    if (!g) throw new Error(`skyruins: merging ${part} failed`);
    const m = new THREE.Mesh(g, own(material));
    m.castShadow = shadow && part !== 'ivy';
    m.receiveShadow = true;
    meshes.push(m);
  }
  return meshes;
}

/** The repeated small props (edge balustrade, slate blocks, hanging rocks): one instanced mesh per prop part. */
function instanced(props: Record<string, PropParts>, place: Place, shadow: boolean) {
  const meshes: THREE.InstancedMesh[] = [];
  for (const [name, matrices] of Object.entries(place)) {
    if (!matrices.length) continue;
    for (const { geometry, material } of props[name] ?? []) {
      const m = new THREE.InstancedMesh(plain(geometry), own(material), matrices.length);
      matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.castShadow = shadow;
      m.receiveShadow = true;
      meshes.push(m);
    }
  }
  return meshes;
}

// ---- textures --------------------------------------------------------------------------------------------------

/**
 * Dark slate marble tiles (3 m) with veins, wear, chipped corners and cracks, and a gold inlay: rim at 12, ring at
 * 6, a compass rose / eight-pointed sun with a circle of constellation dots at 8.9, a small centre ring. A few
 * tiles are broken out, showing a darker under-layer.
 */
function platformTexture() {
  return canvasTexture(2048, (g, s) => {
    const rnd = seeded(31);
    const sc = s / (2 * RADIUS_TEX); // px per metre
    const c = s / 2;
    g.fillStyle = '#181a24';
    g.fillRect(0, 0, s, s);
    const tile = 3 * sc, off = c - 1.5 * sc;
    for (let ty = -6; ty < 6; ty++) {
      for (let tx = -6; tx < 6; tx++) {
        const x = off + tx * tile, y = off + ty * tile;
        const v = Math.floor(rnd() * 8);
        g.fillStyle = `rgb(${22 + v},${24 + v},${34 + v})`;
        g.fillRect(x, y, tile, tile);
        // veins
        g.strokeStyle = 'rgba(70,76,100,0.22)';
        g.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          let vx = x + rnd() * tile, vy = y + rnd() * tile;
          g.moveTo(vx, vy);
          for (let j = 0; j < 6; j++) { vx += (rnd() - 0.4) * tile * 0.25; vy += (rnd() - 0.4) * tile * 0.25; g.lineTo(vx, vy); }
          g.stroke();
        }
        // wear: soft dark scuffs and a few lighter, polished patches
        for (let k = 0; k < 2; k++) {
          if (rnd() < 0.45) continue;
          const wx = x + rnd() * tile, wy = y + rnd() * tile, wr = (0.4 + rnd() * 0.8) * sc;
          const rg = g.createRadialGradient(wx, wy, 0, wx, wy, wr);
          const dark = rnd() < 0.6;
          rg.addColorStop(0, dark ? 'rgba(0,0,0,0.16)' : 'rgba(90,96,124,0.1)');
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = rg;
          g.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
        }
        // chipped corner
        if (rnd() < 0.35) {
          const cx = rnd() < 0.5 ? x : x + tile, cy = rnd() < 0.5 ? y : y + tile;
          const sx = cx === x ? 1 : -1, sy = cy === y ? 1 : -1, cz = (0.12 + rnd() * 0.22) * sc;
          g.fillStyle = '#0b0c12';
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + sx * cz * (1 + rnd()), cy);
          g.lineTo(cx + sx * cz * 0.4, cy + sy * cz * 0.5);
          g.lineTo(cx, cy + sy * cz * (1 + rnd()));
          g.closePath();
          g.fill();
        }
        // slightly lifted top and left edge
        g.strokeStyle = 'rgba(80,86,112,0.16)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + 3, y + tile - 3); g.lineTo(x + 3, y + 3); g.lineTo(x + tile - 3, y + 3);
        g.stroke();
        g.strokeStyle = '#0d0e15';
        g.lineWidth = 4;
        g.strokeRect(x, y, tile, tile);
      }
    }
    // cracks: a few near the edge, more small ones over the floor
    g.strokeStyle = 'rgba(8,8,12,0.8)';
    g.lineWidth = 3;
    for (let k = 0; k < 26; k++) {
      const a = rnd() * Math.PI * 2;
      const r = (10.2 + rnd() * 1.2) * sc;
      let x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
      g.beginPath();
      g.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += (rnd() - 0.5) * 0.6 * sc + Math.cos(a) * 0.3 * sc; y += (rnd() - 0.5) * 0.6 * sc + Math.sin(a) * 0.3 * sc; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(8,8,12,0.65)';
    g.lineWidth = 2;
    for (let k = 0; k < 40; k++) {
      const a = rnd() * Math.PI * 2, d = rnd() * Math.PI * 2;
      const r = (1.8 + rnd() * 8.4) * sc;
      let x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
      g.beginPath();
      g.moveTo(x, y);
      const n = 3 + Math.floor(rnd() * 4);
      for (let j = 0; j < n; j++) { x += Math.cos(d + (rnd() - 0.5) * 1.2) * 0.28 * sc; y += Math.sin(d + (rnd() - 0.5) * 1.2) * 0.28 * sc; g.lineTo(x, y); }
      g.stroke();
    }

    // gold inlay (canvas x = world x, canvas y = world z - 7)
    g.strokeStyle = '#9a7a34';
    g.fillStyle = '#b08a3a';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const P = (r: number, a: number): [number, number] => [c + Math.cos(a) * r * sc, c + Math.sin(a) * r * sc];
    const ring = (r: number, w: number) => { g.lineWidth = w * sc; g.beginPath(); g.arc(c, c, r * sc, 0, Math.PI * 2); g.stroke(); };
    ring(12, 0.14);
    ring(11.5, 0.05);
    ring(6, 0.1);
    ring(3.1, 0.05);
    ring(1.1, 0.08);
    // compass rose: four long and four short kite points, with a spine each, and eight small rays between
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, long = k % 2 === 0;
      const tip = long ? 10.7 : 7.3, base = long ? 1.9 : 1.7, half = long ? 0.34 : 0.3;
      g.lineWidth = 0.07 * sc;
      g.beginPath();
      g.moveTo(...P(base, a - half));
      g.lineTo(...P(tip, a));
      g.lineTo(...P(base, a + half));
      g.stroke();
      g.lineWidth = 0.05 * sc;
      g.beginPath();
      g.moveTo(...P(1.1, a));
      g.lineTo(...P(tip, a));
      g.stroke();
      const b = a + Math.PI / 8;
      g.lineWidth = 0.04 * sc;
      g.beginPath();
      g.moveTo(...P(1.1, b));
      g.lineTo(...P(3.7, b));
      g.stroke();
    }
    // small suns at the cardinal tips
    for (let k = 0; k < 4; k++) {
      const [x, y] = P(11.05, (k * Math.PI) / 2);
      g.beginPath();
      g.arc(x, y, 0.13 * sc, 0, Math.PI * 2);
      g.fill();
    }
    // circle of constellation dots with two thin constellation lines
    const dots: [number, number][] = [];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2 + (rnd() - 0.5) * 0.08, r = 8.9 + (rnd() - 0.5) * 0.5;
      dots.push(P(r, a));
    }
    g.lineWidth = 0.025 * sc;
    g.strokeStyle = 'rgba(154,122,52,0.7)';
    for (const [from, to] of [[2, 6], [11, 15], [19, 22]]) {
      g.beginPath();
      for (let k = from; k <= to; k++) { if (k === from) g.moveTo(...dots[k]); else g.lineTo(...dots[k]); }
      g.stroke();
    }
    dots.forEach(([x, y], k) => {
      g.beginPath();
      g.arc(x, y, (0.045 + (k % 3) * 0.025) * sc, 0, Math.PI * 2);
      g.fill();
    });
    // gold worn away in places
    g.fillStyle = 'rgba(24,26,36,0.7)';
    for (let k = 0; k < 40; k++) {
      const a = rnd() * Math.PI * 2, r = (rnd() < 0.5 ? 6 : 1.5 + rnd() * 9) * sc;
      g.beginPath();
      g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, (0.08 + rnd() * 0.14) * sc, (0.06 + rnd() * 0.1) * sc, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }

    // missing tiles: irregular holes down to a darker under-layer (avoid the starts, the centre, the rim)
    let placed = 0;
    for (let tries = 0; placed < 9 && tries < 200; tries++) {
      const a = rnd() * Math.PI * 2, r = 2.6 + rnd() * 8.2;
      const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
      if (Math.hypot(hx, hz - 6) < 3.2 || Math.hypot(hx, hz + 6) < 3.2) continue;
      if (SKYRUINS_OBSTACLES.some((o) => Math.hypot(hx - o.ax, hz - (o.az - 7)) < 2.2)) continue;
      const w = (0.5 + rnd() * 0.5) * sc, [x, y] = P(r, a);
      const rot = rnd() * 3;
      const poly: [number, number][] = [];
      for (let k = 0; k < 8; k++) {
        const ang = rot + (k / 8) * Math.PI * 2, rr = w * (0.62 + rnd() * 0.45);
        poly.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.85]);
      }
      g.beginPath();
      poly.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.fillStyle = '#07080c';
      g.fill();
      g.strokeStyle = 'rgba(88,94,122,0.35)';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = '#12141c';
      for (let k = 0; k < 3; k++) g.fillRect(x - w * 0.5 + rnd() * w * 0.6, y - w * 0.4 + rnd() * w * 0.6, w * (0.2 + rnd() * 0.3), w * (0.12 + rnd() * 0.15));
      placed++;
    }
  });
}

/** Tileable cloud field. `opaque`: the sea (violet with pink tops); otherwise soft wisps on transparent. */
function cloudTexture(size: number, seed: number, opaque: boolean, repeat: number) {
  return canvasTexture(
    size,
    (g, s) => {
      const rnd = seeded(seed);
      if (opaque) {
        const gr = g.createLinearGradient(0, 0, s, s);
        gr.addColorStop(0, '#3d4378');
        gr.addColorStop(1, '#464c86');
        g.fillStyle = gr;
        g.fillRect(0, 0, s, s);
      } else g.clearRect(0, 0, s, s);
      const cols = opaque ? ['#5b5fa0', '#7a74b0', '#c48a9a', '#e8b0a0', '#4a5088', '#8a86bc'] : ['#f0c8d0', '#c8b8e8', '#ffe0d8', '#d8d0f0'];
      const n = opaque ? 340 : 170;
      for (let i = 0; i < n; i++) {
        const x = rnd() * s, y = rnd() * s;
        const r = s * (opaque ? 0.04 + rnd() * 0.1 : 0.03 + rnd() * 0.08);
        const col = cols[Math.floor(rnd() * cols.length)];
        const a = opaque ? 0.2 + rnd() * 0.3 : 0.1 + rnd() * 0.18;
        for (const dx of [-s, 0, s]) {
          for (const dy of [-s, 0, s]) {
            const px = x + dx, py = y + dy;
            if (px + r < 0 || px - r > s || py + r < 0 || py - r > s) continue;
            const rg = g.createRadialGradient(px, py, 0, px, py, r);
            rg.addColorStop(0, col);
            rg.addColorStop(1, 'rgba(0,0,0,0)');
            g.globalAlpha = a;
            g.fillStyle = rg;
            g.fillRect(px - r, py - r, r * 2, r * 2);
          }
        }
      }
      g.globalAlpha = 1;
    },
    repeat,
  );
}

/** A soft cloud puff (several overlapping lobes) for the billboards. */
function puffTexture() {
  return canvasTexture(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    const rnd = seeded(5);
    for (let i = 0; i < 9; i++) {
      const x = s * (0.25 + rnd() * 0.5), y = s * (0.4 + rnd() * 0.2), r = s * (0.14 + rnd() * 0.14);
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.9)');
      rg.addColorStop(0.6, 'rgba(255,255,255,0.4)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

// ---- geometry --------------------------------------------------------------------------------------------------

const NS = 96; // angular samples of the platform edge

/** The top face: a fan with the irregular edge, uv in the platform texture. */
function topGeometry() {
  const pos = new Float32Array((NS + 1) * 3), uv = new Float32Array((NS + 1) * 2), nor = new Float32Array((NS + 1) * 3);
  const put = (i: number, x: number, z: number) => {
    pos.set([RING.x + x, 0.01, RING.z + z], i * 3);
    nor.set([0, 1, 0], i * 3);
    uv.set([(x / RADIUS_TEX + 1) / 2, (1 - z / RADIUS_TEX) / 2], i * 2);
  };
  put(0, 0, 0);
  for (let i = 0; i < NS; i++) {
    const th = (i / NS) * Math.PI * 2, r = edgeR(th);
    put(1 + i, Math.cos(th) * r, Math.sin(th) * r);
  }
  const idx: number[] = [];
  for (let i = 0; i < NS; i++) idx.push(0, 1 + ((i + 1) % NS), 1 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** The crumbling underside: rows of jittered rings narrowing downward, flat shaded, banded slate colours. */
function skirtGeometry() {
  const K = 6;
  const rnd = seeded(77);
  const pos: number[] = [], col: number[] = [];
  const shade = [0x2a2c38, 0x252733, 0x20222c, 0x1c1e27, 0x181a22, 0x15161d, 0x121319];
  for (let k = 0; k <= K; k++) {
    const f = k / K;
    for (let i = 0; i < NS; i++) {
      const th = (i / NS) * Math.PI * 2;
      const r = edgeR(th) * (1 - 0.6 * Math.pow(f, 1.4)) * (k > 0 ? 1 + (rnd() - 0.5) * 0.16 : 1);
      const y = k === 0 ? 0.01 : -k * 0.92 + (rnd() - 0.5) * 0.55;
      pos.push(RING.x + Math.cos(th) * r, y, RING.z + Math.sin(th) * r);
      _c.setHex(shade[k]);
      const j = 1 + (rnd() - 0.5) * 0.35;
      col.push(_c.r * j, _c.g * j, _c.b * j);
    }
  }
  const idx: number[] = [];
  for (let k = 0; k < K; k++) {
    for (let i = 0; i < NS; i++) {
      const a = k * NS + i, b = k * NS + ((i + 1) % NS), c = (k + 1) * NS + i, d = (k + 1) * NS + ((i + 1) % NS);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  return flat;
}

// ---- backdrop layout ---------------------------------------------------------------------------------------------

/** Floating islands far out (all beyond 26 m): the prop, distance and angle from the centre, top height, scale. */
interface IslandSpec { prop: 'IslandA' | 'IslandB' | 'IslandC'; rad: number; ang: number; y: number; s: number }
const ISLANDS: IslandSpec[] = [
  { prop: 'IslandA', rad: 34, ang: 0.3, y: 1, s: 1.1 },
  { prop: 'IslandB', rad: 44, ang: 2.5, y: -3, s: 1.15 },
  { prop: 'IslandC', rad: 30, ang: 3.9, y: 3, s: 1.15 },
  { prop: 'IslandA', rad: 48, ang: 4.7, y: -1, s: 1.6 },
  { prop: 'IslandC', rad: 38, ang: 5.6, y: 5, s: 1.5 },
];

/** The big broken arch off to the west (|x| > 12), on its own islet. */
const ARCH_ISLET = { x: -19.5, y: -0.5, z: 8 };

export const skyruinsArena: ArenaDef = {
  id: 'skyruins',
  name: 'Sky Ruins',
  obstacles: SKYRUINS_OBSTACLES,
  stage: STAGE,
  hideGround: true,
  build() {
    const g = new THREE.Group();
    const rnd = seeded(4242);
    const rr = (a: number, b: number) => a + (b - a) * rnd();
    const textures: THREE.Texture[] = [];
    const keep = <T extends THREE.Texture>(t: T) => { textures.push(t); return t; };

    // Platform.
    const top = new THREE.Mesh(topGeometry(), new THREE.MeshStandardMaterial({ map: platformTexture(), roughness: 0.85, metalness: 0.05 }));
    top.receiveShadow = true;
    const rimLine = flatRing(RING.r - 0.1, RING.r + 0.04, 0xc9a24a, 0.85, 0.02);
    const skirt = new THREE.Mesh(skirtGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, flatShading: true }));
    skirt.castShadow = skirt.receiveShadow = true;

    // Cover and backdrop: the sculpted props, added when the files have loaded (the first pick waits a moment for
    // them). Point-symmetric twins get the A / B variant of their kind and are turned half round.
    let disposed = false;
    const at = (x: number, y: number, z: number, ry: number, s = 1, sx = 1, q?: THREE.Quaternion) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q ?? new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(sx * s, s, s));
    const fixed: Place = {}, floating: Place = {}, edge: Place = {}, drift: Place = {};
    const put = (into: Place, name: string, m: THREE.Matrix4) => (into[name] ??= []).push(m);
    SKYRUINS_OBSTACLES.forEach((o) => {
      const a = o.ax + o.bx > 0;
      const twin = a ? 0 : Math.PI;
      const v = a ? 'A' : 'B';
      if (o.kind === 'wall') {
        const dx = o.bx - o.ax, dz = o.bz - o.az;
        const name = (o.height < 2 ? 'Bal' : 'Arch') + v as keyof typeof MODULE;
        // ArchB has its whole pier at -x: turned half round, it lands on the same end as ArchA's
        const ry = Math.atan2(-dz, dx) + (name === 'ArchB' ? Math.PI : 0);
        put(fixed, name, at((o.ax + o.bx) / 2, 0, (o.az + o.bz) / 2, ry, 1, (Math.hypot(dx, dz) + 2 * o.r) / MODULE[name]));
      } else if (o.height > 4) put(fixed, `Column${v}`, at(o.ax, 0, o.az, 0.35 + twin));
      else if (o.height > 2) put(fixed, `Broken${v}`, at(o.ax, 0, o.az, 1.2 + twin));
      else put(fixed, `Drum${v}`, at(o.ax, 0, o.az, 0.8 + twin));
    });

    // Backdrop (seeded). The broken balustrade along the edge (1 m modules on the tangent, posts at the ends of each
    // run, gaps where it fell); crumbling slate blocks on the rim elsewhere; two toppled columns lying along the
    // edge; rocks hanging under the edge. Nothing taller than 2 m within 26 m of the centre unless |x| > 12.
    const step = 1.0 / BAL_R;
    for (const [a0, a1] of BALUSTRADE) {
      const t0 = (a0 * Math.PI) / 180, t1 = (a1 * Math.PI) / 180;
      let run = 0;
      for (let th = t0; th <= t1; th += step) {
        const ok = BAL_R + 0.2 < edgeR(th) - 0.05 && rnd() > 0.12; // the edge has crumbled, or a module fell
        const x = RING.x + Math.cos(th) * BAL_R, z = RING.z + Math.sin(th) * BAL_R;
        if (ok) put(edge, 'BalSeg', at(x, 0, z, tanYaw(th)));
        // a post where a run starts or ends
        const post = ok !== run > 0 ? th - step / 2 : ok && th + step > t1 ? th + step / 2 : null;
        if (post !== null) put(edge, 'BalPost', at(RING.x + Math.cos(post) * BAL_R, 0, RING.z + Math.sin(post) * BAL_R, tanYaw(post), rr(0.85, 1)));
        run = ok ? run + 1 : 0;
      }
    }
    for (let i = 0; i < 46; i++) {
      if (i % 7 === 3) continue; // gaps where the edge has crumbled away
      const th = (i / 46) * Math.PI * 2 + rr(-0.03, 0.03);
      if (inBalustrade(th, 3)) continue;
      const r = edgeR(th) - 0.35;
      put(edge, i % 3 ? 'EdgeA' : 'EdgeB', at(RING.x + Math.cos(th) * r, 0, RING.z + Math.sin(th) * r, -th + rr(-0.5, 0.5), rr(0.7, 1.25), rr(0.8, 1.3)));
    }
    for (const deg of [256, 112]) {
      const a = (deg * Math.PI) / 180, r = 12.6;
      put(fixed, 'Toppled', at(RING.x + Math.cos(a) * r, 0, RING.z + Math.sin(a) * r, tanYaw(a) + 0.1));
    }
    for (let i = 0; i < 18; i++) {
      const th = (i / 18) * Math.PI * 2 + rr(-0.1, 0.1), s = rr(0.9, 1.8);
      const r = edgeR(th) * rr(0.82, 0.92);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rr(-0.4, 0.4), rnd() * 6.28, rr(-0.4, 0.4)));
      put(edge, i % 2 ? 'ChunkA' : 'ChunkB', at(RING.x + Math.cos(th) * r, rr(-3.6, -1.6), RING.z + Math.sin(th) * r, 0, s, 1, q));
    }

    // Far floating islands with ruins, the broken arch islet to the west, loose rocks floating nearer (they bob).
    for (const is of ISLANDS) {
      put(floating, is.prop, at(RING.x + Math.cos(is.ang) * is.rad, is.y, RING.z + Math.sin(is.ang) * is.rad, is.ang * 2.3, is.s));
    }
    put(floating, 'FarArch', at(ARCH_ISLET.x, ARCH_ISLET.y, ARCH_ISLET.z, 0.15));
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, d = rr(17, 26), s = rr(0.4, 1.1);
      const x = RING.x + Math.cos(a) * d, z = RING.z + Math.sin(a) * d;
      if (Math.hypot(x - ARCH_ISLET.x, z - ARCH_ISLET.z) < 6) continue; // keep the arch islet clear
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6));
      put(drift, i % 2 ? 'ChunkA' : 'ChunkB', at(x, rr(-4, 0.5), z, 0, s, 1, q));
    }

    const floaters = new THREE.Group();
    void loadProps().then((props) => {
      if (disposed) return;
      g.add(...merged(props, fixed, true), ...instanced(props, edge, true));
      floaters.add(...merged(props, floating, false), ...instanced(props, drift, false));
    }).catch((e) => console.warn('skyruins: props failed to load', e));

    // Sea of clouds: an opaque layer 6 m below and a wispy layer above it that the platform's underside pokes through.
    const seaTex = keep(cloudTexture(1024, 9, true, 12));
    const sea = new THREE.Mesh(new THREE.CircleGeometry(320, 48), new THREE.MeshBasicMaterial({ map: seaTex, color: 0xffffff }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(RING.x, -6, RING.z);
    const wispTex = keep(cloudTexture(1024, 21, false, 8));
    const wisps = new THREE.Mesh(
      new THREE.CircleGeometry(240, 48),
      new THREE.MeshBasicMaterial({ map: wispTex, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    wisps.rotation.x = -Math.PI / 2;
    wisps.position.set(RING.x, -4.3, RING.z);

    // Cloud billboards drifting round the platform.
    const puff = keep(puffTexture());
    const mats = [
      new THREE.SpriteMaterial({ map: puff, color: 0xf2c4c4, transparent: true, opacity: 0.75, depthWrite: false }),
      new THREE.SpriteMaterial({ map: puff, color: 0xb4b8ea, transparent: true, opacity: 0.75, depthWrite: false }),
    ];
    interface Drift { sprite: THREE.Sprite; rad: number; ang: number; speed: number }
    const drifts: Drift[] = [];
    for (let i = 0; i < 14; i++) {
      const high = i >= 11;
      const sprite = new THREE.Sprite(mats[i % 2]);
      const w = rr(18, 36);
      sprite.scale.set(w, w * 0.45, 1);
      const rad = high ? rr(50, 75) : rr(22, 70);
      const d: Drift = { sprite, rad, ang: rnd() * Math.PI * 2, speed: rr(0.004, 0.012) * (i % 2 ? 1 : -1) };
      sprite.position.y = high ? rr(2, 7) : rr(-8, -2);
      drifts.push(d);
      g.add(sprite);
    }
    const place = (d: Drift) => d.sprite.position.set(RING.x + Math.cos(d.ang) * d.rad, d.sprite.position.y, RING.z + Math.sin(d.ang) * d.rad);
    drifts.forEach(place);

    // Birds: simple V shapes (two triangles) circling far out, wings flapping.
    const bv = new Float32Array([
      0, 0, 0.35, -1.25, 0.25, -0.1, 0, 0, -0.2,
      0, 0, 0.35, 0, 0, -0.2, 1.25, 0.25, -0.1,
    ]);
    const birdGeo = new THREE.BufferGeometry();
    birdGeo.setAttribute('position', new THREE.BufferAttribute(bv, 3));
    const BIRDS = 9;
    const birds = new THREE.InstancedMesh(birdGeo, new THREE.MeshBasicMaterial({ color: 0x1a1d30, side: THREE.DoubleSide }), BIRDS);
    birds.frustumCulled = false;
    const birdSpec = Array.from({ length: BIRDS }, (_, i) => ({
      rad: rr(36, 58), ang: rnd() * Math.PI * 2, speed: rr(0.025, 0.045) * (i % 3 === 0 ? -1 : 1), y: rr(5, 14), ph: rnd() * 6.28, flap: rr(4, 6), size: rr(0.9, 1.5),
    }));
    const placeBirds = (time: number) => {
      birdSpec.forEach((b, i) => {
        const ang = b.ang + time * b.speed, dir = Math.sign(b.speed);
        _p.set(RING.x + Math.cos(ang) * b.rad, b.y + Math.sin(time * 0.3 + b.ph) * 0.8, RING.z + Math.sin(ang) * b.rad);
        _q.setFromAxisAngle(UP, Math.atan2(-Math.sin(ang) * dir, Math.cos(ang) * dir));
        _m.compose(_p, _q, _s.set(b.size, Math.sin(time * b.flap + b.ph), b.size));
        birds.setMatrixAt(i, _m);
      });
      birds.instanceMatrix.needsUpdate = true;
    };
    placeBirds(0);

    g.add(sea, wisps, skirt, top, rimLine, floaters, birds);

    return {
      group: g,
      update(dt: number, time: number) {
        sea.rotation.z += dt * 0.004;
        wisps.rotation.z -= dt * 0.006;
        for (const d of drifts) { d.ang += d.speed * dt; place(d); }
        floaters.position.y = Math.sin(time * 0.35) * 0.35;
        placeBirds(time);
      },
      dispose() {
        disposed = true;
        // Sprites are not meshes, so disposeTree skips them.
        for (const m of mats) m.dispose();
        for (const t of textures) t.dispose();
        disposeTree(g);
      },
    };
  },
};
