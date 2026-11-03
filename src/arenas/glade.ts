import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pillar, wall, type Obstacle } from '../obstacles';
import { SporeBurst } from './hazards/glade';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef, ArenaStage } from './types';

/**
 * Verdant Glade: an old forest clearing at golden dusk. Dark moss-and-earth floor with a canvas texture (moss, leaf
 * litter, stepping stones), grass, flowers and small mushrooms; warm fireflies, falling leaves and soft god rays.
 *
 * Cover (`GLADE_OBSTACLES`): a great fallen log lies across the middle, two broken giant stumps with roots stand off
 * its ends, two carved rune stones flank the starts, two giant mushroom clusters sit beside the middle and two fallen
 * trunks with upturned root plates guard the wings. Outside the ring: mossy rim stones and ferns, rocks and bushes on
 * the forest floor, tall trees and dead snags (tall ones only beyond 26 m or at |x| > 12), a far canopy silhouette.
 * Cover and backdrop are sculpted, painted props from Blender (blender/arenas/glade_props.py →
 * public/models/arenas/glade_props.glb and glade_backdrop.glb), placed and merged into one mesh per material.
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

/** Cover layout: point-symmetric about the ring centre (0, 7); checked against the rules in docs/architecture/arenas.md.
 *  Heights are the props' (they pick the prop): 1.1 the fallen log in the middle, 3.6 the stumps, 2.5 the rune
 *  stones, 1.45 the mushroom clusters, 1.9 the root-plate trunks. Twins follow each other. */
export const GLADE_OBSTACLES: Obstacle[] = [
  { ...wall(-1.6, 5.9, 1.6, 8.1), r: 0.4, height: 1.1 }, // great fallen log across the middle: low, the camera looks over it
  { ...pillar(5.8, 9.8, 1.0), height: 3.6 }, // broken giant stumps with roots
  { ...pillar(-5.8, 4.2, 1.0), height: 3.6 },
  { ...pillar(3.6, 2.8, 0.6), height: 2.5 }, // carved rune stones off the starts
  { ...pillar(-3.6, 11.2, 0.6), height: 2.5 },
  { ...pillar(4.2, 6.2, 0.7), height: 1.45 }, // giant mushroom clusters beside the middle
  { ...pillar(-4.2, 7.8, 0.7), height: 1.45 },
  { ...wall(6.8, 2.0, 8.6, 4.4), r: 0.4, height: 1.9 }, // fallen trunks with upturned root plates on the wings
  { ...wall(-6.8, 12.0, -8.6, 9.6), r: 0.4, height: 1.9 },
];

/** The log modules' lengths in the props file (wall segment plus 2 × 0.4 m ends); walls stretch them along x. */
const LOG_MODULE = { LogA: 4.68, LogB: 3.8, LogC: 3.8 };

// ---- the sculpted props, loaded once and shared by every build ---------------------------------------------------

type PropParts = { geometry: THREE.BufferGeometry; material: THREE.Material; part: string }[];
let propsPromise: Promise<Record<string, PropParts>> | null = null;

/** Brightness of each painted material in the dusk light (the Blender files are lit brighter); emissive runes kept faint. */
const TUNE: Record<string, number> = { bark: 0.5, wood: 0.32, moss: 0.45, stone: 0.5, stem: 0.45, cap: 0.6, leaf: 0.45, fern: 0.55 };

/** glade_props.glb and glade_backdrop.glb as {prop name: its parts (one per material)}; objects there are named
 *  "<Prop>__<material>". Both files share material names; the first one loaded of each name is used for all. */
function loadProps() {
  propsPromise ??= (() => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = `${import.meta.env.BASE_URL}models/arenas/`;
    return Promise.all([loader.loadAsync(`${base}glade_props.glb`), loader.loadAsync(`${base}glade_backdrop.glb`)]).then((files) => {
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
            if (part === 'rune') material.emissiveIntensity = 0.35;
            else material.color.multiplyScalar(TUNE[part] ?? 0.6);
            // the moss and foliage sheen of the Blender file turns them milky under the dusk rim light
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

/** Places props (each by its matrices) and merges every placed part into one mesh per material: one draw call per
 *  material for the whole arena (each build gets its own geometry and material copies to dispose). */
function instance(props: Record<string, PropParts>, place: Record<string, THREE.Matrix4[]>) {
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
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) throw new Error(`glade: merging ${part} failed`);
    const mat = material.clone() as THREE.MeshStandardMaterial;
    mat.vertexColors = true;
    if (part === 'fern') mat.side = THREE.DoubleSide;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = part !== 'fern' && part !== 'rune';
    m.receiveShadow = true;
    meshes.push(m);
  }
  return meshes;
}

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

/** How far the prop on `o` reaches past its capsule at the ground (the stumps' roots most). */
const footprint = (o: Obstacle) => (o.kind === 'pillar' && o.height > 3 ? 0.9 : 0.5);

export const gladeArena: ArenaDef = {
  id: 'glade',
  name: 'Verdant Glade',
  hazard: (seed) => new SporeBurst(seed),
  obstacles: GLADE_OBSTACLES,
  stage: STAGE,
  build() {
    const g = new THREE.Group();
    const rnd = seeded(7041);
    const rr = (a: number, b: number) => a + (b - a) * rnd();

    // Floor, apron, rim line.
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

    // Kept clear of decoration: the starts, the rim stones and the cover props' footprints.
    const clear = (x: number, z: number, rad: number) =>
      Math.hypot(x, z - 13) >= 3.2 && Math.hypot(x, z - 1) >= 3.2 && !(rad > RING.r - 0.5 && rad < RING.r + 0.9) &&
      !GLADE_OBSTACLES.some((o) => distToObstacle(o, x, z) < footprint(o) + 0.15);

    // Cover and backdrop: the sculpted props, added when the files have loaded (the first pick waits a moment for
    // them), merged into one mesh per material. Point-symmetric twins get the A / B variant of their kind and are
    // turned half round; the root-plate trunks keep their plates at the outer end.
    let disposed = false;
    const at = (x: number, z: number, ry: number, sx = 1, s = 1) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(sx * s, s, s));
    const place: Record<string, THREE.Matrix4[]> = {};
    const put = (name: string, m: THREE.Matrix4) => (place[name] ??= []).push(m);
    GLADE_OBSTACLES.forEach((o) => {
      const a = o.ax + o.bx > 0;
      const twin = a ? 0 : Math.PI;
      if (o.kind === 'wall') {
        const dx = o.bx - o.ax, dz = o.bz - o.az;
        const name = o.height < 1.6 ? 'LogA' : a ? 'LogB' : 'LogC';
        // LogC has its root plate at -x: turned half round, its plate lands on the outer end like LogB's
        const ry = Math.atan2(-dz, dx) + (name === 'LogC' ? Math.PI : 0);
        put(name, at((o.ax + o.bx) / 2, (o.az + o.bz) / 2, ry, (Math.hypot(dx, dz) + 2 * o.r) / LOG_MODULE[name]));
      } else if (o.height > 3) put(a ? 'StumpA' : 'StumpB', at(o.ax, o.az, 0.5 + twin));
      else if (o.height > 2) put(a ? 'StoneA' : 'StoneB', at(o.ax, o.az, Math.atan2(RING.x - o.ax, RING.z - o.az) + 0.25 + twin));
      else put(a ? 'ShroomA' : 'ShroomB', at(o.ax, o.az, 1.1 + twin));
    });

    // Backdrop (seeded). Rim stones and ferns round the ring; rocks and bushes on the forest floor; trees taller than
    // 2 m only beyond 26 m from the centre or at |x| > 12 (the gameplay camera sits on the z axis at either end), and
    // none right at the overview camera.
    const polar = (rad: number, a: number) => [RING.x + Math.cos(a) * rad, RING.z + Math.sin(a) * rad] as const;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2 + rr(-0.02, 0.02);
      const [x, z] = polar(RING.r + rr(0.0, 0.25), a);
      put(i % 3 ? 'RimA' : 'RimB', at(x, z, -a + rr(-0.4, 0.4), 1, rr(0.9, 1.3)));
    }
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + rr(-0.05, 0.05);
      const [x, z] = polar(RING.r + (i % 2 ? rr(0.6, 1.2) : rr(-0.95, -0.6)), a);
      if (i % 2 === 0 && !clear(x, z, RING.r + 2)) continue;
      put(i % 3 ? 'FernA' : 'FernB', at(x, z, rnd() * 6.28, 1, rr(0.8, 1.3)));
    }
    for (let i = 0; i < 20; i++) {
      const [x, z] = polar(rr(14.5, 26), rnd() * 6.28);
      put(i % 2 ? 'RockA' : 'RockB', at(x, z, rnd() * 6.28, 1, rr(0.6, 1.4)));
    }
    for (let i = 0; i < 24; i++) {
      const rad = rr(15, 29);
      const [x, z] = polar(rad, rnd() * 6.28);
      put(i % 2 ? 'BushA' : 'BushB', at(x, z, rnd() * 6.28, 1, rad < 19 ? rr(0.7, 0.95) : rr(1.0, 1.6)));
    }
    const trees: [number, number][] = [];
    for (let tries = 0; trees.length < 21 && tries < 400; tries++) {
      const rad = rr(19.5, 42);
      const [x, z] = polar(rad, rnd() * 6.28);
      if (Math.hypot(x - RING.x, z - RING.z) <= 26 && Math.abs(x) <= 13) continue;
      if (Math.hypot(x - 16, z - 27) < 9) continue;
      if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 5.5)) continue;
      trees.push([x, z]);
      const k = trees.length % 4;
      put(k === 3 ? 'TreeC' : k === 1 ? 'TreeB' : 'TreeA', at(x, z, rnd() * 6.28, 1, rr(0.8, 1.2)));
    }

    void loadProps().then((props) => {
      if (disposed) return;
      g.add(...instance(props, place));
    }).catch((e) => console.warn('glade: props failed to load', e));

    // Small mushroom clusters in clear spots of the floor.
    const shroom = new Bucket();
    for (let c = 0, tries = 0; c < 10 && tries < 200; tries++) {
      const rad = rr(3, 11), a = rnd() * Math.PI * 2;
      const [x, z] = polar(rad, a);
      if (!clear(x, z, rad)) continue;
      addMushrooms(shroom, x, z, 3 + (c % 3), rnd);
      c++;
    }
    const shroomMesh = shroom.mesh(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8 }), false);

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
    tuft.geos.forEach((t) => t.dispose());

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

    // Far forest wall behind the sculpted trees: cheap trunks and crowns (34-50 m, half lost in the fog) that close the gaps.
    const farTrunks: Inst[] = [], farCrowns: Inst[] = [];
    for (let i = 0; i < 44; i++) {
      const rad = rr(34, 50), a = (i / 44) * Math.PI * 2 + rr(-0.06, 0.06);
      const [x, z] = polar(rad, a);
      const r = rr(0.6, 1.1), h = rr(14, 21);
      farTrunks.push({ x, y: h / 2, z, sx: r, sy: h, sz: r, ry: rnd() * 6, color: [0x1e1812, 0x221b14, 0x1a1610][i % 3] });
      const cr = rr(4.5, 7);
      farCrowns.push({ x, y: h - 1, z, sx: cr, sy: cr * 0.7, sz: cr, ry: rnd() * 6, color: [0x15301a, 0x1a3a1c, 0x12281a][i % 3] });
    }
    const farTrunkMesh = instanced(new THREE.CylinderGeometry(0.7, 1, 1, 7, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), farTrunks, false);
    const farCrownMesh = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), farCrowns, false);

    // Distant canopy silhouette: big dark crowns far out (fog-tinted, unlit), lifting the skyline above the trees.
    const canopy: Inst[] = [];
    for (let i = 0; i < 70; i++) {
      const rad = rr(52, 74), a = rnd() * Math.PI * 2, sz = rr(9, 17);
      canopy.push({
        x: RING.x + Math.cos(a) * rad, y: rr(12, 22), z: RING.z + Math.sin(a) * rad,
        sx: sz, sy: sz * 0.55, sz: sz * 0.9, ry: rnd() * 6, color: [0x0e1f16, 0x112619, 0x0c1a13][i % 3],
      });
    }
    const canopyMesh = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), canopy, false);

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

    g.add(apron, floor, rimLine, shroomMesh, grassMesh, stemMesh, headMesh, farTrunkMesh, farCrownMesh, canopyMesh, shaftMesh, flies, leaves);

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
        disposed = true;
        disposeTree(g);
      },
    };
  },
};
