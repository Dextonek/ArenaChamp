import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING, canvasTexture, seeded } from '../../arenas/common';
import { Glows } from '../../arenas/real';
import type { ArenaDef, ArenaStage } from '../../arenas/types';
import { Kit } from './f45/zonekit';
import { rimAt } from './land';
import type { Piece } from './zone';

/**
 * The Deep's zone drawn from a layout (pipeline/designs/tower-50.md): floor 31 grown and the Deep's made floors 32 to 40
 * (gen/deep.ts), at five times the old ground and of any outline. The Deep is underground, so the "real world" past the outline is a
 * cave: the outline is the foot of the cave's wall, and rock rises there (tall in the north, low in the south, where the camera
 * stands and the ground falls away into the dark past a timber rail); on one side the black water of an underground lake runs in, with
 * a far wall beyond it. Inside, ridges of rock (cover) split the ground into chambers; the mine's tracks run between them as the
 * passages. Stalagmites crowd the wall's foot, crystals grow on the walls and glow, timber frames stand at the mouths of tunnels that
 * lead off into the rock, and lamps on posts are the warm light.
 *
 * Drawn in the heroes' style (blender/arenas/real/STYLE.md, docs/ART_BIBLE.md): clean forms in flat colours, a drawn ground (the
 * crystal cavern's slate flagstones, its mine track, its amethyst), gold on the edges, lamp light and crystal light as the only glow.
 * Most of it carries its colour in its vertices and is merged per square of ground (a few draw calls whatever its size); the glowing
 * crystals and the gold have materials of their own.
 *
 * Coordinates: world, the middle is `RING` (0, 7). The layout's places, pools and middle are world; its paths are offsets.
 */

/** What a piece of the Deep's cover is drawn as (gen/deep.ts lays them out). `edge`: the outline's invisible walls. */
export type DeepLookKind = 'stal' | 'stalwall' | 'column' | 'rock' | 'crystal' | 'great' | 'timber' | 'hut' | 'cradle' | 'cart' | 'fire' | 'crate' | 'wall' | 'ridge' | 'post' | 'edge';

/** What a Deep zone is drawn from (gen/deep.ts writes it; a made floor bakes it, floor 31 too). */
export interface DeepLook {
  /** The walkable outline: radii round the middle, from +x towards +z (gen/core.ts `makeOutline`). */
  rim: number[];
  /** The cover. Its `look` is the nearest of zone.ts's looks (the only ones the shared types take); what it is in the Deep is `kinds`. */
  pieces: Piece[];
  /** Each piece's own kind, by its index in `pieces`. */
  kinds: DeepLookKind[];
  /** The places, world; `kind` says how the ground is drawn. */
  places: { id: string; kind?: string; x: number; z: number; r: number }[];
  /** The mine's tracks, as lines of offsets from the middle. */
  paths: [number, number][][];
  /** Glowing pools let into the floor (looks only), world. */
  pools: { x: number; z: number; rx: number; rz: number; rot?: number }[];
  /** Where the tracks meet in the middle (world): an old turntable. */
  middle?: { x: number; z: number };
  /** The black water's side: 1 east, -1 west. */
  mirror: 1 | -1;
  /** The cave's own seed: other walls, crystals, tunnels. */
  seed: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Smooth value noise on a 64 x 64 lattice that wraps; three octaves, 0..1 (land.ts's, with the cave's own seeds). */
function noiseOf(seed: number) {
  const rnd = seeded(seed), N = 64, v = new Float32Array(N * N);
  for (let i = 0; i < v.length; i++) v[i] = rnd();
  const at = (i: number, j: number) => v[(((i % N) + N) % N) + (((j % N) + N) % N) * N];
  const fade = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, z: number) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = fade(x - xi), fz = fade(z - zi);
    const a = at(xi, zi) + (at(xi + 1, zi) - at(xi, zi)) * fx, b = at(xi, zi + 1) + (at(xi + 1, zi + 1) - at(xi, zi + 1)) * fx;
    return a + (b - a) * fz;
  };
  return (x: number, z: number) => 0.55 * noise(x, z) + 0.3 * noise(2.1 * x + 5.3, 2.1 * z + 3.1) + 0.15 * noise(4.3 * x + 9.7, 4.3 * z + 1.9);
}

// --- the palette (sRGB 0..255): the crystal cavern's slate and amethyst, a shade under the heroes ----------------------------------
const FLOOR_A: RGB = [44, 43, 54], FLOOR_B: RGB = [54, 52, 64], GRAVEL: RGB = [62, 60, 70];
const ROCK_A: RGB = [58, 56, 72], ROCK_B: RGB = [72, 68, 88], ROCK_DARK: RGB = [36, 34, 46], VEIN: RGB = [96, 70, 140];
const WET: RGB = [34, 36, 48], UNDER: RGB = [10, 14, 26], DROP: RGB = [8, 8, 14];
/** The black water's level (m). */
const WATER = -0.45;

/** The cave's shape, from offsets (dx, dz) from the middle. */
function caveOf(rim: number[], m: 1 | -1, seed: number) {
  const fbm = noiseOf(5151 + seed), fbm2 = noiseOf(313 + seed);
  const beyond = (dx: number, dz: number) => Math.hypot(dx, dz) - rimAt(rim, Math.atan2(dz, dx));
  const dirOf = (dx: number, dz: number) => { const r = Math.hypot(dx, dz) || 1; return { x: dx / r, z: dz / r }; };
  /** The water's side (east before the mirror): 1 on it; the lake runs in from the outline and ends at a far wall. */
  const waterSide = (dx: number, dz: number) => smooth(0.3, 0.6, (m * dx) / (Math.hypot(dx, dz) || 1));
  const wander = (dx: number, dz: number) => {
    const a = Math.atan2(dz, m * dx) * 8;
    return Math.max(0, 0.6 + 1.1 * Math.sin(a * 1.4 + 0.7) + 0.8 * Math.sin(a * 3.3 + 2.1));
  };
  const water = (dx: number, dz: number) => {
    const b = beyond(dx, dz);
    return waterSide(dx, dz) * smooth(-2, 2, b - wander(dx, dz) - 1.2) * (1 - smooth(48, 72, b));
  };
  /** The near side (the south, where the camera stands): no tall rock, the ground drops into the dark. */
  const south = (dx: number, dz: number) => smooth(0.35, 0.75, dirOf(dx, dz).z) * (1 - waterSide(dx, dz));
  const north = (dx: number, dz: number) => smooth(0.1, 0.7, -dirOf(dx, dz).z);
  const height = (dx: number, dz: number) => {
    const b = beyond(dx, dz);
    if (b <= 0.4) return 0;
    const s = south(dx, dz), w = water(dx, dz);
    const tall = (7 + 11 * fbm(dx * 0.03 + 3, dz * 0.03 + 7)) * (1 + 0.7 * north(dx, dz));
    // rubble at the foot, the wall's face, and the rock going on up behind it
    const rubble = 0.6 * smooth(0.4, 2.6, b) + 0.5 * fbm2(dx * 0.4, dz * 0.4) * smooth(0.6, 3, b);
    const face = tall * smooth(1.6, 8, b) + 0.5 * tall * smooth(8, 46, b) + 2.5 * fbm2(dx * 0.09, dz * 0.09) * smooth(3, 10, b);
    const land = rubble + face * (1 - 0.92 * s) - s * 12 * smooth(4.5, 16, b);
    const lake = -1.0 * smooth(0.6, 3, b) - 3 * smooth(3, 18, b);
    return land * (1 - w) + lake * w;
  };
  const steepness = (dx: number, dz: number) => {
    const e = 0.7;
    return Math.hypot(height(dx + e, dz) - height(dx - e, dz), height(dx, dz + e) - height(dx, dz - e)) / (2 * e);
  };
  /** The ground's own colour: the cave floor inside, rock outside (darker where steep, veined with amethyst), wet by the water. */
  const color = (dx: number, dz: number, h: number): RGB => {
    const b = beyond(dx, dz);
    let c = mix(FLOOR_A, FLOOR_B, fbm(dx * 0.06 + 1, dz * 0.06 + 2));
    c = mix(c, GRAVEL, 0.5 * smooth(0.6, 0.8, fbm2(dx * 0.03 + 11, dz * 0.03 + 4)));
    if (b > 0) {
      let rock = mix(ROCK_A, ROCK_B, fbm2(dx * 0.05, dz * 0.05));
      rock = mix(rock, ROCK_DARK, smooth(0.8, 2.2, steepness(dx, dz)));
      rock = mix(rock, VEIN, 0.55 * smooth(0.7, 0.82, fbm(dx * 0.11 + 4, dz * 0.11 + 9)));
      c = mix(c, rock, smooth(0.2, 2.5, b));
    }
    if (h < -0.05) {
      c = mix(c, WET, smooth(-0.05, -0.3, h));
      c = mix(c, UNDER, smooth(WATER - 0.05, WATER - 0.7, h));
    }
    if (h < -2) c = mix(c, DROP, smooth(-2, -8, h) * (1 - water(dx, dz)));
    return c;
  };
  return { beyond, water, waterSide, south, north, height, steepness, color, fbm, fbm2 };
}
type Cave = ReturnType<typeof caveOf>;

/** The painted middle: the cave floor, the plazas, the tracks, the pools. `L` metres across. */
function paint(look: DeepLook, cave: Cave, L: number) {
  const size = L > 140 ? 4096 : 2048;
  return canvasTexture(size, (g) => {
    const ppm = size / L, c = size / 2, rnd = seeded(41 + look.seed);
    const X = (dx: number) => c + dx * ppm, Z = (dz: number) => c + dz * ppm;
    const n = Math.round(L > 140 ? L : L * 2), low = document.createElement('canvas');
    low.width = low.height = n;
    const lg = low.getContext('2d')!, img = lg.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const dx = ((i + 0.5) / n - 0.5) * L, dz = ((j + 0.5) / n - 0.5) * L;
      const col = cave.color(dx, dz, cave.height(dx, dz)), k = (i + j * n) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(low, 0, 0, size, size);
    // loose stones and dust in patches
    const dabs = Math.round(1400 * (L / 112) ** 2);
    for (let k = 0; k < dabs; k++) {
      const dx = (rnd() - 0.5) * L, dz = (rnd() - 0.5) * L;
      if (cave.beyond(dx, dz) > 1) continue;
      const rad = (1 + rnd() * 3) * ppm, light = rnd() < 0.45, grad = g.createRadialGradient(X(dx), Z(dz), 0, X(dx), Z(dz), rad);
      grad.addColorStop(0, light ? 'rgba(92,88,108,0.18)' : 'rgba(18,16,26,0.2)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(X(dx) - rad, Z(dz) - rad, rad * 2, rad * 2);
    }
    const rgb = (b: number[], t: number) => `rgb(${Math.round(b[0] * t)},${Math.round(b[1] * t)},${Math.round(b[2] * t)})`;
    /** Fitted flagstones in a disc (the crystal cavern's), a thin brass line round them. */
    const flags = (dx: number, dz: number, r: number, s: number, base: number[], joint: string, line = true) => {
      g.save();
      g.beginPath(); g.arc(X(dx), Z(dz), r * ppm, 0, Math.PI * 2); g.clip();
      g.fillStyle = joint;
      g.fillRect(X(dx - r), Z(dz - r), 2 * r * ppm, 2 * r * ppm);
      for (let z = dz - r; z < dz + r; z += s) for (let x = dx - r + ((((z - dz) / s) | 0) % 2) * s * 0.5; x < dx + r; x += s) {
        g.fillStyle = rgb(base, 0.84 + 0.3 * rnd());
        g.fillRect(X(x) + 1, Z(z) + 1, s * ppm - 2, s * ppm - 2);
      }
      g.restore();
      if (line) {
        g.strokeStyle = '#7a6030';
        g.lineWidth = 0.1 * ppm;
        g.beginPath(); g.arc(X(dx), Z(dz), (r - 0.3) * ppm, 0, Math.PI * 2); g.stroke();
      }
    };
    const disc = (dx: number, dz: number, r: number, inner: string, edge = 1.5) => {
      const grad = g.createRadialGradient(X(dx), Z(dz), 0, X(dx), Z(dz), (r + edge) * ppm);
      grad.addColorStop(0, inner);
      grad.addColorStop(r / (r + edge), inner);
      grad.addColorStop(1, inner.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = grad;
      g.beginPath(); g.arc(X(dx), Z(dz), (r + edge) * ppm, 0, Math.PI * 2); g.fill();
    };
    const pool = (dx: number, dz: number, rx: number, rz: number, rot: number) => {
      g.save();
      g.translate(X(dx), Z(dz));
      g.rotate(rot);
      g.fillStyle = 'rgba(20,24,40,0.9)';
      g.beginPath(); g.ellipse(0, 0, (rx + 0.5) * ppm, (rz + 0.5) * ppm, 0, 0, Math.PI * 2); g.fill();
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx * ppm);
      gr.addColorStop(0, 'rgba(120,220,255,0.75)');
      gr.addColorStop(0.7, 'rgba(70,170,240,0.6)');
      gr.addColorStop(1, 'rgba(50,120,220,0.35)');
      g.fillStyle = gr;
      g.scale(1, rz / rx);
      g.beginPath(); g.arc(0, 0, rx * ppm, 0, Math.PI * 2); g.fill();
      g.restore();
    };
    // the plazas
    for (const p of look.places) {
      const dx = p.x - RING.x, dz = p.z - RING.z;
      switch (p.kind ?? p.id) {
        case 'camp': disc(dx, dz, p.r - 0.5, 'rgba(84,64,46,0.85)', 2); break; // packed earth round the fire
        case 'hall': flags(dx, dz, p.r, 1.15, [66, 66, 86], '#0d0d14'); break; // the halls: the cavern's fitted flags
        case 'yard': flags(dx, dz, p.r, 1.6, [60, 60, 74], '#121219'); break;
        case 'rest': disc(dx, dz, p.r, 'rgba(70,52,38,0.8)', 2); break; // boards and earth under the huts
        case 'pools': disc(dx, dz, p.r, 'rgba(30,34,50,0.7)', 2.5); break;
        case 'shore': flags(dx, dz, p.r - 1, 1.4, [54, 58, 70], '#0e1018', false); break;
        case 'shaft': disc(dx, dz, p.r, 'rgba(66,50,36,0.75)', 2); break;
        case 'well': flags(dx, dz, p.r - 1, 1.2, [62, 62, 80], '#0d0d14'); break;
      }
    }
    // the mine's track along each path: a dark bed, timber sleepers across, two iron rails
    g.lineCap = g.lineJoin = 'round';
    for (const path of look.paths) {
      const trace = () => {
        g.beginPath();
        path.forEach(([dx, dz], i) => (i ? g.lineTo(X(dx), Z(dz)) : g.moveTo(X(dx), Z(dz))));
      };
      for (const [w, col] of [[3.8, 'rgba(10,10,16,0.55)'], [3.0, '#34344a'], [2.2, 'rgb(76,52,36)']] as const) {
        g.strokeStyle = col;
        g.lineWidth = w * ppm;
        if (w === 2.2) g.setLineDash([0.22 * ppm, 0.7 * ppm]);
        trace();
        g.stroke();
        g.setLineDash([]);
      }
      for (const [off, col] of [[0.55, '#6a6c7c'], [0.2, '#9a9cac']] as const) {
        g.strokeStyle = col;
        g.lineWidth = 0.08 * ppm;
        for (const s of [-off, off]) {
          g.beginPath();
          path.forEach(([dx, dz], i) => {
            const j = Math.min(path.length - 1, i + 1), k = Math.max(0, i - 1), nx = -(path[j][1] - path[k][1]), nz = path[j][0] - path[k][0], nl = Math.hypot(nx, nz) || 1;
            const x = X(dx + (nx / nl) * s), z = Z(dz + (nz / nl) * s);
            if (i) g.lineTo(x, z); else g.moveTo(x, z);
          });
          g.stroke();
        }
      }
    }
    // the turntable where the tracks meet
    if (look.middle) {
      const dx = look.middle.x - RING.x, dz = look.middle.z - RING.z;
      disc(dx, dz, 3.4, 'rgba(36,36,50,0.95)', 0.6);
      g.strokeStyle = '#9a9cac'; g.lineWidth = 0.1 * ppm;
      g.beginPath(); g.arc(X(dx), Z(dz), 3.0 * ppm, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#7a6030'; g.lineWidth = 0.14 * ppm;
      g.beginPath(); g.arc(X(dx), Z(dz), 3.5 * ppm, 0, Math.PI * 2); g.stroke();
    }
    // the pools of the places and of the open floor
    for (const f of look.pools) pool(f.x - RING.x, f.z - RING.z, f.rx, f.rz, f.rot ?? 0);
    // the shaft's mouth and the echo well: black, with a timber or stone kerb
    for (const p of look.places) {
      if (p.kind !== 'shaft' && p.kind !== 'well') continue;
      const dx = p.x - RING.x, dz = p.z - RING.z, d = Math.hypot(dx, dz) || 1, ox = p.kind === 'shaft' ? (dx / d) * 3.4 : 0, oz = p.kind === 'shaft' ? (dz / d) * 3.4 : 0;
      g.fillStyle = '#020205';
      g.beginPath(); g.arc(X(dx + ox), Z(dz + oz), (p.kind === 'shaft' ? 1.9 : 2.6) * ppm, 0, Math.PI * 2); g.fill();
      g.strokeStyle = p.kind === 'shaft' ? 'rgb(76,52,36)' : '#5a5a70';
      g.lineWidth = 0.45 * ppm;
      g.stroke();
    }
  });
}

/** The cave's palette for the dressing that carries its colour in its vertices. */
const PALETTE = {
  rock: '#3a3a4c', rockLight: '#4c4a60', pale: '#b8b2cc', paleDark: '#8e88a6', wood: '#4a3626', darkWood: '#2a1f1a', cloth: '#4a3a6a',
  stone: '#484a5e', iron: '#23252c', black: '#030308',
} as const;
type Key = keyof typeof PALETTE;

/** Dressing merged per square of ground, its colour in its vertices: one material, a draw call or two a square (land.ts's way). */
const CELL = 24;
class Dress {
  private cells = new Map<string, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();
  private colors = new Map<Key, THREE.Color>();
  add(key: Key, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0): this {
    let col = this.colors.get(key);
    if (!col) this.colors.set(key, (col = new THREE.Color(PALETTE[key])));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, roll, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    g.computeBoundingBox();
    const ctr = g.boundingBox!.getCenter(new THREE.Vector3()), key2 = `${Math.floor(ctr.x / CELL)}:${Math.floor(ctr.z / CELL)}`;
    let cell = this.cells.get(key2);
    if (!cell) this.cells.set(key2, (cell = []));
    cell.push(g);
    return this;
  }
  build(into: THREE.Group, own: { dispose(): void }[], shadow: (x: number, z: number) => boolean) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    own.push(material);
    for (const [key, geos] of this.cells) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      const [cx, cz] = key.split(':').map((v) => (Number(v) + 0.5) * CELL);
      mesh.castShadow = shadow(cx, cz);
      mesh.receiveShadow = true;
      into.add(mesh);
      own.push(merged);
    }
    this.cells.clear();
  }
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
const cone = (r: number, h: number, n = 7) => new THREE.ConeGeometry(r, h, n).translate(0, h / 2, 0);
const ico = new THREE.IcosahedronGeometry(1, 0);

/** Builds a Deep zone's meshes. */
export function buildDeepZone(look: DeepLook): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const rim = look.rim, m = look.mirror, cave = caveOf(rim, m, look.seed), rnd = seeded(77 + look.seed);
  const rmax = Math.max(...rim), rmean = rim.reduce((s, r) => s + r, 0) / rim.length;
  const mat = (color: number, rough = 0.85, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const mm = new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, ...o });
    own.push(mm);
    return mm;
  };
  const gold = mat(0xc9a24a, 0.4, { metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.22 });
  const amethyst = mat(0x7a52c8, 0.4, { emissive: 0x5a30b0, emissiveIntensity: 0.55 });
  const greatMat = mat(0x6a48b8, 0.35, { emissive: 0x4a2ca0, emissiveIntensity: 0.6 });
  const kit = new Kit(), dress = new Dress();
  const W = (dx: number, dz: number) => ({ x: RING.x + dx, z: RING.z + dz });
  /** A point `b` m past the outline in direction `a` (radians, atan2(dz, dx)), as an offset. */
  const out = (a: number, b: number) => { const r = rimAt(rim, a) + b; return { dx: Math.cos(a) * r, dz: Math.sin(a) * r }; };
  const warm: { x: number; y: number; z: number; size?: number }[] = [];
  const cool: { x: number; y: number; z: number; size?: number }[] = [];
  const prism = (mm: THREE.Material, x: number, y: number, z: number, s: number, h: number, yaw = 0, lean = 0) => {
    kit.add(mm, new THREE.OctahedronGeometry(1).scale(0.42 * s, h * 0.5, 0.42 * s).translate(0, h * 0.5, 0), x, y, z, yaw, 1, 1, 1, lean, lean * 0.7);
  };

  // --- the ground: the cave floor inside, rock rising past the outline, the water on its side ---------------------------------------
  const SIZE = Math.max(420, 2 * (rmax + 150)), SEG = Math.round(SIZE / 2.1), L = 2 * (rmax + 8);
  const plane = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
  const pos = plane.attributes.position, nv = pos.count;
  for (let i = 0; i < nv; i++) pos.setY(i, cave.height(pos.getX(i), pos.getZ(i)));
  plane.computeVertexNormals();
  const colors = new Float32Array(nv * 4), uv = plane.attributes.uv, tmp = new THREE.Color();
  for (let i = 0; i < nv; i++) {
    const dx = pos.getX(i), dz = pos.getZ(i), h = pos.getY(i);
    const c = cave.color(dx, dz, h);
    tmp.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
    colors[i * 4] = tmp.r; colors[i * 4 + 1] = tmp.g; colors[i * 4 + 2] = tmp.b;
    const inside = 1 - smooth(3, 6, cave.beyond(dx, dz)), onCanvas = Math.abs(dx) < L / 2 - 1 && Math.abs(dz) < L / 2 - 1 ? 1 : 0;
    colors[i * 4 + 3] = inside * onCanvas;
    uv.setXY(i, dx / L + 0.5, dz / L + 0.5);
  }
  plane.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  const map = paint(look, cave, L);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.flipY = false;
  map.anisotropy = 4;
  const groundMat = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.9, envMapIntensity: 0.15 });
  groundMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', 'vec4 texelColor = texture2D( map, vMapUv );\n diffuseColor.rgb = mix( vColor.rgb, texelColor.rgb, vColor.a );')
      .replace('#include <color_fragment>', '');
  };
  groundMat.customProgramCacheKey = () => 'tower-deep-ground';
  const ground = new THREE.Mesh(plane, groundMat);
  ground.position.set(RING.x, 0, RING.z);
  ground.receiveShadow = true;
  g.add(ground);
  own.push(plane, map, groundMat);
  // the black water: still and dark, lit by nothing (a shiny one caught the light at a glancing angle and read as a grey floor)
  const waterGeo = new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x05070f });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(RING.x, WATER, RING.z);
  g.add(waterMesh);
  own.push(waterGeo, waterMat);

  // --- the cover -----------------------------------------------------------------------------------------------------------------
  for (const [i, { o }] of look.pieces.entries()) {
    const lk = look.kinds[i];
    const yaw = Math.atan2(o.bx - o.ax, o.bz - o.az), len = Math.hypot(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, r = o.r, h = o.height;
    switch (lk) {
      case 'crate':
        dress.add('wood', box(r * 2, h, r * 2), o.ax, 0, o.az, rnd() * 3);
        kit.add(gold, box(r * 2.06, 0.08, r * 2.06), o.ax, h * 0.5, o.az, 0);
        break;
      case 'timber':
        for (let k = 0; k < 4; k++) dress.add(k % 2 ? 'wood' : 'darkWood', cyl(0.16, 0.16, r * 2.2, 6), o.ax + (k % 2 ? 0.2 : -0.2), 0.2 + Math.floor(k / 2) * 0.35, o.az, 0, 1, 1, 1, 0, Math.PI / 2);
        dress.add('darkWood', box(r * 2.2, h * 0.5, 0.15), o.ax, 0, o.az - 0.6, 0.4);
        break;
      case 'hut':
        dress.add('cloth', new THREE.ConeGeometry(r * 1.25, h * 1.3, 4).translate(0, h * 0.65, 0), o.ax, 0, o.az, rnd() * 3).add('darkWood', cyl(0.06, 0.06, h * 1.8, 4), o.ax, 0, o.az);
        kit.add(gold, new THREE.ConeGeometry(r * 1.27, 0.25, 4).translate(0, 0.13, 0), o.ax, 0, o.az, 0);
        break;
      case 'fire':
        dress.add('rock', cyl(r, r * 1.1, 0.35, 8), o.ax, 0, o.az).add('darkWood', cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 0.3, 1, 1, 1, 0.8).add('darkWood', cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 2.4, 1, 1, 1, 0.8);
        kit.add(gold, new THREE.ConeGeometry(0.35, 0.9, 6).translate(0, 0.85, 0), o.ax, 0, o.az);
        warm.push({ x: o.ax, y: 1.2, z: o.az, size: 7 });
        break;
      case 'cradle':
        dress.add('stone', cyl(r, r * 1.2, 0.5, 8), o.ax, 0, o.az);
        kit.add(gold, cyl(r * 1.05, r * 1.05, 0.08, 8), o.ax, 0.5, o.az);
        prism(greatMat, o.ax, 0, o.az, 0.55, 1.5, 0.3, 0.1);
        cool.push({ x: o.ax, y: 1.1, z: o.az, size: 3.2 });
        break;
      case 'cart':
        dress.add('iron', box(r * 1.5, 0.75, r * 1.0), o.ax, 0.25, o.az, 0.4).add('darkWood', box(r * 1.58, 0.07, r * 1.08), o.ax, 0.98, o.az, 0.4);
        for (const [dx, dz] of [[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.4], [0.55, 0.4]]) dress.add('darkWood', cyl(0.26, 0.26, 0.14, 8), o.ax + dx, 0.05, o.az + dz, 0.4, 1, 1, 1, 0, Math.PI / 2);
        for (const [dx, dz, s] of [[-0.3, 0, 0.7], [0.25, 0.1, 0.9], [0, -0.3, 0.6]] as const) prism(amethyst, o.ax + dx, 0.9, o.az + dz, s, 0.9 * s + 0.4, rnd() * 3);
        cool.push({ x: o.ax, y: 1.4, z: o.az, size: 2.6 });
        break;
      case 'stal':
        dress.add('pale', cone(r, h), o.ax, 0, o.az, rnd() * 3).add('paleDark', cone(r * 0.55, h * 0.55, 6), o.ax + r * 0.9, 0, o.az - r * 0.3, rnd() * 3);
        break;
      case 'stalwall': {
        // a wall of stalagmites grown together: a low rock foot along it, pale cones close set on it, tallest in the middle
        const steps = Math.max(2, Math.round(len / 1.1));
        dress.add('rock', box(r * 2, 0.9, len + r), mx, 0, mz, yaw);
        for (let k = 0; k <= steps; k++) {
          const t = k / steps, x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t, hh = h * (0.6 + 0.5 * rnd());
          dress.add(k % 2 ? 'paleDark' : 'pale', cone(r * (0.75 + 0.3 * rnd()), hh), x + (rnd() - 0.5) * 0.5, 0, z + (rnd() - 0.5) * 0.5, rnd() * 3);
        }
        break;
      }
      case 'column':
        dress.add('pale', cyl(r * 0.8, r, h, 9), o.ax, 0, o.az).add('stone', cyl(r * 1.25, r * 1.25, 0.3, 9), o.ax, 0, o.az);
        break;
      case 'rock':
        dress.add('rock', ico, o.ax, h * 0.3, o.az, rnd() * 6, r * 1.1, h * 0.7, r * 1.1).add('rockLight', ico, o.ax + r * 0.5, h * 0.12, o.az - r * 0.3, rnd() * 6, r * 0.6, h * 0.38, r * 0.6);
        break;
      case 'crystal':
        prism(amethyst, o.ax, 0, o.az, r * 1.1, h, rnd() * 3, 0.06);
        prism(amethyst, o.ax + r * 0.8, 0, o.az + r * 0.3, r * 0.7, h * 0.65, rnd() * 3, -0.18);
        prism(amethyst, o.ax - r * 0.6, 0, o.az + r * 0.5, r * 0.55, h * 0.5, rnd() * 3, 0.25);
        if (rnd() < 0.4) cool.push({ x: o.ax, y: h * 0.55, z: o.az, size: 2.0 });
        break;
      case 'great':
        // a dark crown of prisms on a rock foot; asleep, a faint violet; the dark law lights a woken one
        dress.add('rock', ico, o.ax, 0.4, o.az, rnd() * 3, r * 1.5, 0.7, r * 1.5);
        prism(greatMat, o.ax, 0, o.az, r * 1.6, h, 0.2);
        prism(greatMat, o.ax + 0.9, 0, o.az + 0.4, r * 0.9, h * 0.6, 1, -0.25);
        prism(greatMat, o.ax - 0.8, 0, o.az + 0.5, r * 0.8, h * 0.5, 2, 0.3);
        break;
      case 'post':
        dress.add('darkWood', cyl(r * 0.6, r * 0.8, h, 6), o.ax, 0, o.az);
        kit.add(gold, cyl(r, r, 0.1, 6), o.ax, h, o.az);
        warm.push({ x: o.ax, y: h + 0.25, z: o.az, size: 1.5 });
        break;
      case 'wall': // the rock fall
        dress.add('rock', box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add('rockLight', box(r * 2.4, 0.3, len + r * 2.4), mx, h, mz, yaw);
        for (let k = 0; k < len / 3.4; k++) {
          const t = k * 3.4 - len / 2 + 1.7;
          dress.add(k % 2 ? 'rock' : 'rockLight', ico, mx + Math.sin(yaw) * t, h + 0.3, mz + Math.cos(yaw) * t, rnd() * 3, 1.3, 1.0, 1.3);
          dress.add('rock', ico, mx + Math.sin(yaw) * t + Math.cos(yaw) * (r + 0.6), 0.5, mz + Math.cos(yaw) * t - Math.sin(yaw) * (r + 0.6), rnd() * 3, 0.9, 0.7, 0.9);
        }
        break;
      case 'ridge': {
        // a ridge of rock: faceted boulders along it, the middle highest, a skirt of smaller ones at its foot
        const steps = Math.max(2, Math.round(len / 2.4));
        for (let k = 0; k <= steps; k++) {
          const t = k / steps, x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t, top = h * (0.65 + 0.35 * Math.sin(Math.PI * t)) * (0.85 + 0.3 * rnd());
          dress.add(k % 3 === 1 ? 'rockLight' : 'rock', ico, x, top * 0.42, z, rnd() * 6, r * (1.05 + 0.2 * rnd()), top * 0.62, r * (1.05 + 0.2 * rnd()), (rnd() - 0.5) * 0.3);
        }
        for (const e of [0, 1]) dress.add('rock', ico, e ? o.bx : o.ax, 0.4, e ? o.bz : o.az, rnd() * 6, r * 0.9, 0.8, r * 0.9);
        if (rnd() < 0.55) {
          const t = 0.25 + 0.5 * rnd(), x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t;
          prism(amethyst, x, h * 0.55, z, 0.9, 1.6 + rnd(), rnd() * 3, 0.3);
          cool.push({ x, y: h * 0.7, z, size: 2.2 });
        }
        break;
      }
      case 'edge':
        break;
    }
  }

  // --- past the outline: the cave ----------------------------------------------------------------------------------------------
  const around = 2 * Math.PI * rmean;
  const pale: THREE.Matrix4[] = [], dark: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const mtx = (x: number, y: number, z: number, s: number, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, rnd() * 6.28).clone(), new THREE.Vector3(s, sy, s));
  // Stalagmites crowd the wall's foot (low ones in the south, none in the water), dark spires further up.
  for (let k = 0; k < around / 1.6; k++) {
    const a = rnd() * Math.PI * 2, b = 0.9 + Math.pow(rnd(), 1.6) * 7, o = out(a, b), dx = o.dx, dz = o.dz;
    if (cave.water(dx, dz) > 0.1) continue;
    const y = cave.height(dx, dz), s = cave.south(dx, dz), p = W(dx, dz);
    if (y < -1) continue;
    pale.push(mtx(p.x, y - 0.15, p.z, 0.5 + rnd() * 0.7, (1.2 + rnd() * 2.6) * (1 - 0.7 * s)));
  }
  for (let k = 0; k < around / 4; k++) {
    const a = rnd() * Math.PI * 2, o = out(a, 6 + rnd() * 40), dx = o.dx, dz = o.dz;
    if (cave.water(dx, dz) > 0.1 || cave.south(dx, dz) > 0.3) continue;
    const y = cave.height(dx, dz), p = W(dx, dz);
    dark.push(mtx(p.x, y - 0.5, p.z, 1.4 + rnd() * 2.2, 3 + rnd() * 7));
  }
  // Out in the water: spires and islets of crystal, the far wall's foot.
  for (let k = 0; k < 26; k++) {
    const a = (m === 1 ? 0 : Math.PI) + (rnd() - 0.5) * 1.6, o = out(a, 6 + rnd() * 55), dx = o.dx, dz = o.dz;
    if (cave.water(dx, dz) < 0.6) continue;
    const p = W(dx, dz);
    if (k % 3 === 0) {
      prism(amethyst, p.x, WATER - 0.3, p.z, 1.2 + rnd() * 1.6, 3 + rnd() * 5, rnd() * 3, (rnd() - 0.5) * 0.3);
      cool.push({ x: p.x, y: 2.2, z: p.z, size: 3.4 });
    } else dark.push(mtx(p.x, WATER - 0.6, p.z, 1 + rnd() * 1.6, 2 + rnd() * 5));
  }
  // Crystals on the walls, glowing.
  const clusters = Math.round(40 * (rmean / 100));
  for (let k = 0; k < clusters * 4 && cool.length < 140; k++) {
    const a = rnd() * Math.PI * 2, o = out(a, 1.5 + rnd() * 9), dx = o.dx, dz = o.dz;
    if (cave.water(dx, dz) > 0.2 || cave.south(dx, dz) > 0.4) continue;
    const y = cave.height(dx, dz), p = W(dx, dz), s = 0.7 + rnd() * 1.2;
    prism(amethyst, p.x, y - 0.2, p.z, s, 1.6 + rnd() * 2.6, rnd() * 3, (rnd() - 0.5) * 0.6);
    prism(amethyst, p.x + 0.6, y - 0.2, p.z + 0.4, s * 0.6, 1.2 + rnd() * 1.4, rnd() * 3, (rnd() - 0.5) * 0.8);
    if (k % 2 === 0) cool.push({ x: p.x, y: y + 1.6, z: p.z, size: 2.6 + s });
  }
  // Tunnel mouths: a timber frame against the wall, black behind it, a track running in.
  const black = new THREE.MeshBasicMaterial({ color: 0x020205 });
  own.push(black);
  for (let k = 0, made = 0; k < 60 && made < Math.round(6 * (rmean / 100)); k++) {
    const a = rnd() * Math.PI * 2, o = out(a, 2.4), dx = o.dx, dz = o.dz;
    if (cave.water(dx, dz) > 0.05 || cave.south(dx, dz) > 0.2 || cave.north(dx, dz) < 0.05 && rnd() < 0.5) continue;
    const yaw = Math.atan2(-dx, -dz), y = cave.height(dx, dz), p = W(dx, dz), side = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    for (const s of [-1.6, 1.6]) dress.add('wood', box(0.36, 3.3, 0.36), p.x + side.x * s, y - 0.2, p.z + side.z * s, yaw);
    dress.add('darkWood', box(4.2, 0.4, 0.5), p.x, y + 3.0, p.z, yaw);
    kit.add(gold, box(0.5, 0.18, 0.1), p.x, y + 3.05, p.z + 0, yaw);
    kit.add(black, box(3.0, 3.0, 0.2), p.x - Math.sin(yaw) * 0.45, y - 0.2, p.z - Math.cos(yaw) * 0.45, yaw);
    warm.push({ x: p.x + side.x * 1.9, y: y + 2.6, z: p.z + side.z * 1.9, size: 1.4 });
    made++;
  }
  // The south: a timber rail along the edge where the ground falls away (low: the camera looks over it).
  for (let k = 0; k < around / 3; k++) {
    const a = (k / (around / 3)) * Math.PI * 2, o = out(a, 1.0), dx = o.dx, dz = o.dz;
    if (cave.south(dx, dz) < 0.5) continue;
    const y = cave.height(dx, dz), p = W(dx, dz), r0 = rimAt(rim, a), r1 = rimAt(rim, a + 0.02);
    const tx = Math.cos(a + 0.02) * r1 - Math.cos(a) * r0, tz = Math.sin(a + 0.02) * r1 - Math.sin(a) * r0, yaw = Math.atan2(tx, tz);
    dress.add('darkWood', box(0.2, 1.1, 0.2), p.x, y - 0.1, p.z, yaw).add('wood', box(0.12, 0.12, 3.1), p.x, y + 0.85, p.z, yaw);
    if (k % 5 === 0) { kit.add(gold, cyl(0.16, 0.16, 0.08, 6), p.x, y + 1.02, p.z); warm.push({ x: p.x, y: y + 1.3, z: p.z, size: 0.9 }); }
  }
  // Lamps on posts at each place's rim, towards the middle, and along the outline every so often.
  for (const pl of look.places) {
    const a = Math.atan2(RING.x - pl.x, RING.z - pl.z), x = pl.x + Math.sin(a) * (pl.r - 1), z = pl.z + Math.cos(a) * (pl.r - 1);
    dress.add('darkWood', cyl(0.12, 0.16, 2.6, 6), x, 0, z);
    kit.add(gold, cyl(0.2, 0.2, 0.1, 6), x, 2.6, z);
    warm.push({ x, y: 2.85, z, size: 1.8 });
  }
  for (let k = 0; k < around / 26; k++) {
    const a = (k / (around / 26)) * Math.PI * 2 + 0.11, o = out(a, -0.4), dx = o.dx, dz = o.dz;
    if (cave.south(dx, dz) > 0.5 || cave.waterSide(dx, dz) > 0.5) continue;
    const p = W(dx, dz);
    dress.add('darkWood', cyl(0.13, 0.17, 2.2, 6), p.x, 0, p.z);
    kit.add(gold, cyl(0.2, 0.2, 0.1, 6), p.x, 2.2, p.z);
    warm.push({ x: p.x, y: 2.45, z: p.z, size: 1.2 });
  }
  // The pools' glimmer.
  for (const f of look.pools) cool.push({ x: f.x, y: 0.4, z: f.z, size: 1.2 * f.rx });

  // Instanced stalagmites and spires: one draw each (near the walk they cast shadows, far off they do not).
  const paleGeo = mergeGeometries([cone(1, 1, 7), cone(0.5, 0.55, 6).translate(0.8, 0, -0.3)])!;
  const darkGeo = cone(1, 1, 6);
  const paleMat = mat(0xb8b2cc, 0.75), darkMat = mat(0x34364a, 0.95);
  const nearRim = (mm: THREE.Matrix4) => cave.beyond(mm.elements[12] - RING.x, mm.elements[14] - RING.z) < 12;
  for (const [geo, material, list] of [[paleGeo, paleMat, pale], [darkGeo, darkMat, dark]] as const) {
    for (const part of [list.filter(nearRim), list.filter((mm) => !nearRim(mm))]) {
      if (!part.length) continue;
      const im = new THREE.InstancedMesh(geo, material, part.length);
      part.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = nearRim(part[0]);
      im.receiveShadow = true;
      im.computeBoundingSphere();
      g.add(im);
    }
    own.push(geo);
  }

  dress.build(g, own, (x, z) => cave.beyond(x - RING.x, z - RING.z) < 14);
  kit.build(g, own);
  const warmG = new Glows(warm, 0xffa040, 1.5), coolG = new Glows(cool, 0x6a48d0, 1.5);
  g.add(warmG.group, coolG.group);
  own.push(warmG, coolG);

  return {
    group: g,
    update(_dt, time) { warmG.update(time); coolG.update(time); },
    dispose() {
      g.removeFromParent();
      for (const o of own) o.dispose();
    },
  };
}

/** The cave's stage: the crystal cavern's dark and lamp light, the fog further out for the bigger ground. */
const STAGE: ArenaStage = {
  background: 0x0d0c14, zenith: 0x060509, horizon: 0x0d0c14, glow: 0x17131f, stars: 0,
  fog: 0x0d0c14, fogNear: 55, fogFar: 210,
  hemiSky: 0xa9a6e0, hemiGround: 0x2a2422, hemiIntensity: 0.7,
  sun: 0xffd2a0, sunIntensity: 1.5, rim: 0x8c84d0, rimIntensity: 0.9,
};

/** A Deep floor as an arena: its own layout. The ring is the circle round the whole outline (the walk's box, the checks' grid). */
export function deepArena(id: string, name: string, look: DeepLook): ArenaDef {
  return { id, name, ring: Math.ceil(Math.max(...look.rim) + 1.5), obstacles: look.pieces.map((p) => p.o), stage: STAGE, hideGround: true, build: () => buildDeepZone(look) };
}
