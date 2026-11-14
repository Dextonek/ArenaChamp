import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING, canvasTexture, seeded } from '../../arenas/common';
import { Glows } from '../../arenas/real';
import type { ArenaDef, ArenaStage } from '../../arenas/types';
import { rimAt } from './land';
import { Kit, type Piece } from './zone';

/**
 * The Sands chapter's zones (floors 21 to 30; pipeline/designs/tower-50.md), drawn from a layout: a wadi in a red canyon, five times
 * floor 1's ground, of any outline. The walkable ground is the wadi's flat sandy floor; past its outline the world goes on (the user,
 * 2026-11-13: "make those floors be like real world"): on the walls' side and in the north the canyon's stepped red cliffs rise a few
 * metres past the edge, with fallen rock at their foot; on the dunes' side (east or west, `dunes`) a bank of sand, a row of old brass-
 * capped markers along the edge and dunes rolling away; in the south (the camera's side) only low ledges near the edge. Mesas stand in
 * the haze far off.
 *
 * Drawn in the heroes' style (blender/arenas/real/STYLE.md, docs/ART_BIBLE.md): clean forms (stacked rounded blocks, boxes, turned
 * forms), a flat colour a part, the palette's wood, lacquer, cream and gold, and the canyon's own colour, turquoise (glaze, cloth, tiles);
 * the ground is drawn (sand with the wind's ripples, worn flagstone roads, courts with a ring of turquoise tiles); lanterns and fire
 * bowls the only glow. Only the look: the cover, places, roads and packs are the floor's (gen/sands.ts).
 */

/** The zone's own looks for pieces whose `Look` (zone.ts) is a general one: by the piece's index in `pieces`. */
export type SandsKind = 'well' | 'spring' | 'jars' | 'brazier' | 'column' | 'obelisk' | 'palm' | 'statue' | 'pier' | 'tower';
/** What stands but does not block: an arch's lintel over two piers. */
export interface SandsDecor { kind: 'arch'; x: number; z: number; yaw: number; s: number }

/** What a Sands zone is drawn from (a type, not an interface: it is a `ChapterLook`, gen/types.ts). */
export type SandsLook = {
  /** The walkable outline: radii round the middle, from +x (east) towards +z (south), as land.ts's `rimAt` reads it. */
  rim: number[];
  pieces: Piece[];
  kinds: [number, SandsKind][];
  decor: SandsDecor[];
  /** The places, in the world; `kind` says how the ground is drawn and what stands round it. */
  places: { id: string; kind?: string; x: number; z: number; r: number }[];
  /** The roads, as lines of offsets from the middle. */
  paths: [number, number][][];
  /** The side the open desert is on: 1 east, -1 west, 0 none (the canyon's walls all round). */
  dunes: 1 | -1 | 0;
  seed: number;
};

/** A desert afternoon, warm and a shade muted (the world stays behind the heroes); the haze is the far canyon's. */
const STAGE: ArenaStage = {
  background: 0xc8b08c, zenith: 0x5b80b2, horizon: 0xe0caa4, glow: 0xf4c890, stars: 0,
  fog: 0xcdb08a, fogNear: 80, fogFar: 260,
  hemiSky: 0xf0e0c4, hemiGround: 0x6a4630, hemiIntensity: 0.82,
  sun: 0xffe0b0, sunIntensity: 1.7, rim: 0xb4c4dc, rimIntensity: 0.3,
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Smooth value noise on a 64 x 64 lattice that wraps; three octaves, 0..1 (land.ts's, with its own seed). */
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

// --- the palette (sRGB): the ground's colours, a shade duller than the heroes ------------------------------------------------
const SAND: RGB = [178, 142, 100], SAND_LIGHT: RGB = [192, 158, 112], SAND_DARK: RGB = [150, 114, 80], DUNE: RGB = [196, 160, 110];
const STRATA: RGB[] = [[132, 72, 50], [156, 94, 62], [172, 118, 78], [112, 60, 44]];
const FLAG: RGB = [128, 108, 90], ROAD: RGB = [118, 96, 78], TILE: RGB = [40, 128, 124], EARTH: RGB = [124, 92, 66];
/** The strata's height (m): the cliffs are steps of this height. */
const STEP = 2.6;

/** The world's shape past the outline, from offsets (dx, dz). */
function desert(rim: number[], dunes: 1 | -1 | 0, seed: number) {
  const fbm = noiseOf(5150 + seed), fbm2 = noiseOf(311 + seed);
  const beyond = (dx: number, dz: number) => Math.hypot(dx, dz) - rimAt(rim, Math.atan2(dz, dx));
  /** 1 on the dunes' side (its edges are where the cliffs end), 0 elsewhere. */
  const duneSide = (dx: number, dz: number) => (dunes === 0 ? 0 : smooth(0.12, 0.5, (dunes * dx) / (Math.hypot(dx, dz) || 1)));
  /** 1 in the south (the camera's side): no wall there near the edge. */
  const south = (dx: number, dz: number) => smooth(0.2, 0.7, dz / (Math.hypot(dx, dz) || 1));
  /** A staircase: flat treads and steep risers of `STEP`. */
  const steps = (h: number) => { const f = h / STEP, i = Math.floor(f); return (i + smooth(0.6, 0.95, f - i)) * STEP; };
  const height = (dx: number, dz: number) => {
    const b = beyond(dx, dz);
    if (b <= 0.3) return 0;
    const ds = duneSide(dx, dz), so = south(dx, dz);
    const bank = 0.7 * smooth(0.3, 3.2, b);
    // the canyon's wall: a first cliff a few metres past the edge, then a second further out; stepped
    const near = smooth(1.2, 6.5, b) * (9 + 10 * fbm2(dx * 0.025, dz * 0.025)), far = smooth(26, 42, b) * (8 + 12 * fbm(dx * 0.012 + 4, dz * 0.012));
    const wall = steps(near + far) * (1 - so * (1 - smooth(22, 48, b)));
    // a low ledge in the south, near the edge
    const ledge = so * smooth(1, 4, b) * 1.4;
    // the dunes: long swells and crests
    const swell = (1.2 + 6 * fbm(dx * 0.016 + 9, dz * 0.016 + 2)) * smooth(1.5, 26, b);
    const crest = 1.8 * Math.pow(Math.abs(Math.sin(dz * 0.045 + dx * 0.012 + 6 * fbm2(dx * 0.01, dz * 0.01))), 3) * smooth(6, 24, b);
    const dune = swell + crest;
    return bank + Math.max(ledge, wall) * (1 - ds) + dune * ds;
  };
  const steepness = (dx: number, dz: number) => {
    const e = 0.6;
    return Math.hypot(height(dx + e, dz) - height(dx - e, dz), height(dx, dz + e) - height(dx, dz - e)) / (2 * e);
  };
  /** The ground's own colour: sand, darker in hollows; on a cliff the strata of its height. */
  const color = (dx: number, dz: number, h: number): RGB => {
    let c = mix(SAND, SAND_LIGHT, fbm(dx * 0.04 + 1, dz * 0.04 + 2));
    c = mix(c, SAND_DARK, 0.45 * smooth(0.55, 0.8, fbm2(dx * 0.02 + 11, dz * 0.02 + 4)));
    c = mix(c, DUNE, duneSide(dx, dz) * smooth(1, 6, beyond(dx, dz)));
    const steep = steepness(dx, dz), band = STRATA[((Math.floor((h + 0.3) / STEP) % 4) + 4) % 4];
    c = mix(c, band, smooth(0.45, 0.95, steep));
    return c;
  };
  return { beyond, duneSide, south, height, steepness, color, fbm, fbm2 };
}
type Desert = ReturnType<typeof desert>;

/** The painted middle: the ground's colour, the wind's ripples, the roads' flagstones and the courts. `L` metres across. */
function paint(look: SandsLook, geo: Desert, L: number) {
  const size = L > 140 ? 4096 : 2048;
  return canvasTexture(size, (g) => {
    const ppm = size / L, c = size / 2, rnd = seeded(77 + look.seed);
    const X = (dx: number) => c + dx * ppm, Z = (dz: number) => c + dz * ppm;
    const rgb = (k: RGB, t = 1) => `rgb(${Math.round(k[0] * t)},${Math.round(k[1] * t)},${Math.round(k[2] * t)})`;
    const n = Math.round(L), low = document.createElement('canvas');
    low.width = low.height = n;
    const lg = low.getContext('2d')!, img = lg.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const dx = ((i + 0.5) / n - 0.5) * L, dz = ((j + 0.5) / n - 0.5) * L;
      const col = geo.color(dx, dz, geo.height(dx, dz)), k = (i + j * n) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(low, 0, 0, size, size);
    // The wind's ripples: short crescents, lighter on the windward side, darker in their lee (the wind is from the north).
    g.lineCap = 'round';
    const ripples = Math.round(900 * (L / 112) ** 2);
    for (let k = 0; k < ripples; k++) {
      const dx = (rnd() - 0.5) * L, dz = (rnd() - 0.5) * L;
      if (geo.beyond(dx, dz) > 3) continue;
      const w = (0.7 + 1.3 * rnd()) * ppm, x = X(dx), y = Z(dz);
      for (const [dy, t, lw] of [[0, 1.08, 0.12], [0.18, 0.88, 0.16]] as const) {
        g.strokeStyle = rgb(SAND, t);
        g.lineWidth = lw * ppm;
        g.beginPath(); g.moveTo(x - w, y + dy * ppm); g.quadraticCurveTo(x, y + dy * ppm - 0.25 * w, x + w, y + dy * ppm); g.stroke();
      }
    }
    // The roads: a band of trodden sand, worn flagstones in running rows along it.
    for (const path of look.paths) {
      g.strokeStyle = 'rgba(150,118,86,0.55)';
      g.lineWidth = 4.4 * ppm;
      g.lineJoin = 'round';
      g.beginPath();
      path.forEach(([dx, dz], i) => (i ? g.lineTo(X(dx), Z(dz)) : g.moveTo(X(dx), Z(dz))));
      g.stroke();
      for (let i = 1; i < path.length; i++) {
        const [ax, az] = path[i - 1], [bx, bz] = path[i], len = Math.hypot(bx - ax, bz - az);
        if (len < 0.5) continue;
        g.save();
        g.translate(X(ax), Z(az));
        g.rotate(Math.atan2(bz - az, bx - ax));
        for (let s = 0, row = 0; s < len; s += 1.4, row++) for (let k = 0; k < 2; k++) {
          if (rnd() < 0.12) continue; // a flag gone: sand shows through
          g.fillStyle = rgb(ROAD, 0.86 + 0.26 * rnd());
          const off = row & 1 ? 0.6 : 0;
          g.fillRect((s + 0.06) * ppm, (-1.5 + k * 1.5 + off * 0.5 - 0.25) * ppm, 1.28 * ppm, 1.32 * ppm);
        }
        g.restore();
      }
    }
    // The courts: square flags, a ring of turquoise tiles and two thin brass rings round the rim; the camp is packed earth.
    for (const p of look.places) {
      const dx = p.x - RING.x, dz = p.z - RING.z, cx = X(dx), cz = Z(dz), r = p.r;
      if (p.kind === 'camp') {
        const grad = g.createRadialGradient(cx, cz, 0, cx, cz, (r + 2) * ppm);
        grad.addColorStop(0, rgb(EARTH)); grad.addColorStop(r / (r + 2), rgb(EARTH)); grad.addColorStop(1, 'rgba(124,92,66,0)');
        g.fillStyle = grad;
        g.beginPath(); g.arc(cx, cz, (r + 2) * ppm, 0, Math.PI * 2); g.fill();
        continue;
      }
      g.save(); g.beginPath(); g.arc(cx, cz, r * ppm, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#4a3c32'; g.fillRect(cx - r * ppm, cz - r * ppm, r * 2 * ppm, r * 2 * ppm);
      for (let z = -r; z < r; z += 1.5) for (let x = -r; x < r; x += 1.5) {
        g.fillStyle = rgb(FLAG, 0.88 + 0.26 * rnd());
        g.fillRect(cx + (x + ((((z + r) / 1.5) | 0) % 2) * 0.75) * ppm + 0.1 * ppm, cz + z * ppm + 0.1 * ppm, 1.3 * ppm, 1.3 * ppm);
      }
      g.restore();
      g.strokeStyle = rgb(TILE); g.lineWidth = 0.34 * ppm; g.beginPath(); g.arc(cx, cz, (r - 0.5) * ppm, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#8a6a32'; g.lineWidth = 0.08 * ppm;
      for (const rr of [r - 0.22, r - 0.78]) { g.beginPath(); g.arc(cx, cz, rr * ppm, 0, Math.PI * 2); g.stroke(); }
    }
  });
}

/** The materials: matte parts and the one polished metal (gold), and the canyon's own turquoise. */
function materials(own: { dispose(): void }[]) {
  const mat = (hex: number, rough = 0.8, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, ...o });
    own.push(m);
    return m;
  };
  return {
    rockA: mat(0x8a4c36, 0.9, { flatShading: true }), rockB: mat(0xa0664a, 0.9, { flatShading: true }), rockC: mat(0x6c3a2c, 0.9, { flatShading: true }),
    sandstone: mat(0x9a7252, 0.85), flag: mat(0x6a5446, 0.85), cream: mat(0xa89a80, 0.8), wood: mat(0x4a3220, 0.7), plank: mat(0x6b4226, 0.75),
    lacquer: mat(0x1d1b21, 0.45), wine: mat(0x5e1a28, 0.6), turquoise: mat(0x1f8a86, 0.6), clay: mat(0x9a5638, 0.75), palm: mat(0x4a6638, 0.8), dark: mat(0x1a1410, 0.9),
    cloth: mat(0x1f8a86, 0.8, { side: THREE.DoubleSide }), red: mat(0x8a3424, 0.8, { side: THREE.DoubleSide }),
    gold: mat(0xc9a24a, 0.32, { metalness: 0.85, emissive: 0xffb050, emissiveIntensity: 0.18 }),
    flame: mat(0xffc060, 0.4, { emissive: 0xffa040, emissiveIntensity: 1.2 }),
    water: mat(0x2e8ea6, 0.25),
  };
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r0: number, r1: number, h: number, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);

/** Builds a Sands zone's meshes. */
export function buildSandsZone(look: SandsLook): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const M = materials(own);
  const rim = look.rim, geo = desert(rim, look.dunes, look.seed), rnd = seeded(4049 + look.seed);
  const rmax = Math.max(...rim), rmean = rim.reduce((s, r) => s + r, 0) / rim.length;
  const kit = new Kit(), far = new Kit();
  const glowSpots: { x: number; y: number; z: number; size?: number }[] = [];
  const W = (dx: number, dz: number) => ({ x: RING.x + dx, z: RING.z + dz });
  /** A point `b` m past the outline in direction `a` (radians, atan2(dz, dx)), as an offset. */
  const out = (a: number, b: number) => { const r = rimAt(rim, a) + b; return { dx: Math.cos(a) * r, dz: Math.sin(a) * r }; };

  // --- the ground: one plane, flat inside, the canyon and the dunes outside; a painted map in the middle -------------------------
  const SIZE = Math.max(420, 2 * (rmax + 160)), SEG = Math.round(SIZE / 2.1), L = 2 * (rmax + 8);
  const plane = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
  const pos = plane.attributes.position, n = pos.count;
  for (let i = 0; i < n; i++) pos.setY(i, geo.height(pos.getX(i), pos.getZ(i)));
  plane.computeVertexNormals();
  const colors = new Float32Array(n * 4), uv = plane.attributes.uv, tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const dx = pos.getX(i), dz = pos.getZ(i), h = pos.getY(i), c = geo.color(dx, dz, h);
    tmp.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
    colors[i * 4] = tmp.r; colors[i * 4 + 1] = tmp.g; colors[i * 4 + 2] = tmp.b;
    const inside = 1 - smooth(3.5, 6, geo.beyond(dx, dz)), onCanvas = Math.abs(dx) < L / 2 - 1 && Math.abs(dz) < L / 2 - 1 ? 1 : 0;
    colors[i * 4 + 3] = inside * onCanvas;
    uv.setXY(i, dx / L + 0.5, dz / L + 0.5);
  }
  plane.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  const map = paint(look, geo, L);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.flipY = false;
  map.anisotropy = 4;
  const groundMat = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.95, envMapIntensity: 0.12 });
  groundMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', 'vec4 texelColor = texture2D( map, vMapUv );\n diffuseColor.rgb = mix( vColor.rgb, texelColor.rgb, vColor.a );')
      .replace('#include <color_fragment>', '');
  };
  groundMat.customProgramCacheKey = () => 'tower-sands-ground';
  const ground = new THREE.Mesh(plane, groundMat);
  ground.position.set(RING.x, 0, RING.z);
  ground.receiveShadow = true;
  g.add(ground);
  own.push(plane, map, groundMat);

  const ico1 = new THREE.IcosahedronGeometry(1, 1), ico0 = new THREE.IcosahedronGeometry(1, 0);
  own.push(ico1, ico0);
  const rocks = [M.rockA, M.rockB, M.rockC];
  /** A boulder: one faceted rounded body and a smaller one at its foot. */
  const boulder = (into: Kit, x: number, z: number, r: number, h: number, y = 0, base = 0) => {
    into.add(rocks[base % 3], ico1, x, y + h * 0.36, z, rnd() * 6, r * 1.08, h * 0.62, r, (rnd() - 0.5) * 0.15);
    const a = rnd() * 6.28;
    into.add(rocks[(base + 1) % 3], ico1, x + Math.cos(a) * r * 0.75, y + h * 0.12, z + Math.sin(a) * r * 0.75, rnd() * 6, r * 0.5, h * 0.24, r * 0.45);
  };
  /** A butte: the far mesas in small, a body that narrows a little, a band of paler stone, a flat cap; boulders at its foot. */
  const butte = (into: Kit, x: number, z: number, r: number, h: number, y = 0, base = 0, foot = true) => {
    const yaw = rnd() * 3;
    into.add(rocks[base % 3], new THREE.CylinderGeometry(r * 0.82, r, h * 0.62, 9).translate(0, h * 0.31, 0), x, y, z, yaw);
    into.add(rocks[(base + 2) % 3], new THREE.CylinderGeometry(r * 0.74, r * 0.82, h * 0.26, 9).translate(0, h * 0.62 + h * 0.13, 0), x, y, z, yaw);
    into.add(M.sandstone, new THREE.CylinderGeometry(r * 0.7, r * 0.74, h * 0.12, 9).translate(0, h * 0.88 + h * 0.06, 0), x, y, z, yaw);
    if (foot) for (let i = 0; i < 3; i++) { const a = rnd() * 6.28, d = r * (0.95 + rnd() * 0.2), s = r * (0.22 + rnd() * 0.12); into.add(rocks[(base + i) % 3], ico1, x + Math.cos(a) * d, y + s * 0.45, z + Math.sin(a) * d, rnd() * 6, s * 1.2, s * 0.9, s); }
  };

  // --- the cover ---------------------------------------------------------------------------------------------------------
  const kinds = new Map(look.kinds);
  look.pieces.forEach(({ look: lk, o }, idx) => {
    const kind = kinds.get(idx), yaw = Math.atan2(o.bx - o.ax, o.bz - o.az), len = Math.hypot(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, r = o.r, h = o.height;
    switch (lk) {
      case 'edge': return;
      case 'rock':
        if (r > 2.6 || h > 2.2 * r) butte(kit, o.ax, o.az, r, h, 0, idx, r > 1.8);
        else boulder(kit, o.ax, o.az, r, h, 0, idx);
        return;
      case 'crate':
        kit.add(M.plank, box(r * 2, h, r * 2), o.ax, 0, o.az, rnd() * 3).add(M.gold, box(r * 2.06, 0.08, r * 2.06), o.ax, h * 0.55, o.az, 0);
        return;
      case 'barrel':
        if (kind === 'well') {
          kit.add(M.sandstone, cyl(r, r * 1.1, 0.9, 16), o.ax, 0, o.az).add(M.dark, cyl(r * 0.8, r * 0.8, 0.06, 16), o.ax, 0.86, o.az).add(M.gold, new THREE.TorusGeometry(r, 0.07, 6, 20).rotateX(Math.PI / 2).translate(0, 0.92, 0), o.ax, 0, o.az);
          kit.add(M.turquoise, cyl(r * 1.12, r * 1.12, 0.16, 16), o.ax, 0.35, o.az);
          for (const s of [-1, 1]) kit.add(M.wood, cyl(0.08, 0.1, 2.5, 6), o.ax + s * (r + 0.1), 0, o.az);
          kit.add(M.wood, box(0.12, 0.12, r * 2.7), o.ax, 2.45, o.az, Math.PI / 2).add(M.cloth, new THREE.TorusGeometry(0.28, 0.07, 6, 12), o.ax, 1.85, o.az, 0);
        } else if (kind === 'spring') {
          kit.add(M.sandstone, cyl(r, r * 1.12, 0.55, 16), o.ax, 0, o.az).add(M.water, cyl(r * 0.82, r * 0.82, 0.05, 16), o.ax, 0.52, o.az).add(M.gold, new THREE.TorusGeometry(r, 0.06, 6, 20).rotateX(Math.PI / 2).translate(0, 0.56, 0), o.ax, 0, o.az);
          glowSpots.push({ x: o.ax, y: 0.9, z: o.az, size: 1.6 });
        } else {
          // clay jars, two glazed turquoise, standing together
          for (let k = 0; k < 3; k++) {
            const a = k * 2.1 + rnd(), d = r * 0.45, s = 0.85 + rnd() * 0.3;
            kit.add(k === 1 ? M.turquoise : M.clay, new THREE.SphereGeometry(0.42, 12, 8).scale(1, 1.25, 1).translate(0, 0.5, 0), o.ax + Math.cos(a) * d, 0, o.az + Math.sin(a) * d, 0, s);
            kit.add(M.gold, new THREE.TorusGeometry(0.17, 0.035, 5, 12).rotateX(Math.PI / 2).translate(0, 1.02, 0), o.ax + Math.cos(a) * d, 0, o.az + Math.sin(a) * d, 0, s);
          }
        }
        return;
      case 'tent':
        kit.add(rnd() < 0.5 ? M.cloth : M.red, new THREE.ConeGeometry(r * 1.3, h * 1.4, 8).translate(0, h * 0.7, 0), o.ax, 0, o.az, rnd() * 3).add(M.gold, cyl(0.05, 0.05, h * 1.9, 5), o.ax, 0, o.az);
        return;
      case 'stall':
        // a low wall of dressed blocks with a brass cap
        kit.add(M.sandstone, box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add(M.gold, box(r * 2.2, 0.08, len + r * 2.2), mx, h, mz, yaw);
        return;
      case 'house':
        // a wall of dressed stone: a band of turquoise tiles, a cap of brass
        kit.add(M.flag, box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add(M.turquoise, box(r * 2.08, 0.38, len + r * 2.08), mx, h * 0.72, mz, yaw).add(M.gold, box(r * 2.3, 0.1, len + r * 2.3), mx, h, mz, yaw);
        return;
      case 'fire':
        // a fire bowl on a short stone foot
        kit.add(M.sandstone, cyl(r * 0.45, r * 0.6, 0.5, 10), o.ax, 0, o.az).add(M.lacquer, cyl(r, r * 0.55, 0.45, 14), o.ax, 0.5, o.az).add(M.gold, new THREE.TorusGeometry(r, 0.06, 6, 18).rotateX(Math.PI / 2).translate(0, 0.95, 0), o.ax, 0, o.az);
        kit.add(M.flame, new THREE.ConeGeometry(0.42 * r, 1.0, 7).translate(0, 1.4, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: 1.5, z: o.az, size: 5 });
        return;
      case 'lighthouse': {
        // the watchtower: a tapering square tower of dressed stone, a turquoise band, a brass-capped platform with the watch fire
        const top = h;
        kit.add(M.flag, new THREE.CylinderGeometry(r * 0.72, r, top, 4).rotateY(Math.PI / 4).translate(0, top / 2, 0), o.ax, 0, o.az);
        kit.add(M.turquoise, new THREE.CylinderGeometry(r * 0.86, r * 0.88, 0.5, 4).rotateY(Math.PI / 4).translate(0, top * 0.55, 0), o.ax, 0, o.az);
        kit.add(M.sandstone, new THREE.BoxGeometry(r * 1.7, 0.5, r * 1.7).translate(0, top + 0.25, 0), o.ax, 0, o.az);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.add(M.flag, box(0.4, 1.4, 0.4), o.ax + sx * r * 0.7, top + 0.5, o.az + sz * r * 0.7);
        kit.add(M.gold, new THREE.BoxGeometry(r * 1.9, 0.12, r * 1.9).translate(0, top + 1.95, 0), o.ax, 0, o.az).add(M.lacquer, new THREE.ConeGeometry(r * 1.3, 1.6, 4).rotateY(Math.PI / 4).translate(0, top + 2.8, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: top + 1.2, z: o.az, size: 5 });
        return;
      }
      case 'post':
        if (kind === 'obelisk') {
          kit.add(M.sandstone, box(r * 2.4, 0.5, r * 2.4), o.ax, 0, o.az).add(M.cream, new THREE.CylinderGeometry(r * 0.55, r * 0.85, h, 4).rotateY(Math.PI / 4).translate(0, h / 2 + 0.5, 0), o.ax, 0, o.az);
          kit.add(M.gold, new THREE.ConeGeometry(r * 0.78, r * 1.1, 4).rotateY(Math.PI / 4).translate(0, h + 0.5 + r * 0.55, 0), o.ax, 0, o.az);
        } else if (kind === 'column') {
          kit.add(M.sandstone, box(r * 2.5, 0.4, r * 2.5), o.ax, 0, o.az).add(M.cream, cyl(r * 0.85, r, h - 0.8, 16), o.ax, 0.4, o.az).add(M.gold, cyl(r * 1.02, r * 1.02, 0.1, 16), o.ax, h * 0.62, o.az);
          kit.add(M.sandstone, box(r * 2.4, 0.4, r * 2.4), o.ax, h - 0.4, o.az);
        } else if (kind === 'palm') {
          // a trunk of stacked rings leaning a little, a crown of long leaves, a few dates in gold
          const lean = (rnd() - 0.5) * 0.4, seg = h / 6;
          for (let i = 0; i < 6; i++) kit.add(i % 2 ? M.wood : M.plank, cyl(0.24 - i * 0.015, 0.28 - i * 0.015, seg, 8), o.ax + lean * i * seg * 0.15, i * seg, o.az);
          const tx = o.ax + lean * 6 * seg * 0.15, ty = h;
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + rnd() * 0.4;
            kit.add(M.palm, new THREE.ConeGeometry(0.42, 3.2, 4).rotateZ(-Math.PI / 2).translate(1.6, 0, 0).scale(1, 0.35, 1), tx, ty, o.az, a, 1, 1, 1, 0);
          }
          kit.add(M.gold, new THREE.IcosahedronGeometry(0.28, 0), tx, ty - 0.35, o.az);
        } else if (kind === 'pier') {
          kit.add(M.flag, box(r * 2, h, r * 2), o.ax, 0, o.az).add(M.turquoise, box(r * 2.08, 0.35, r * 2.08), o.ax, h * 0.7, o.az).add(M.gold, box(r * 2.2, 0.1, r * 2.2), o.ax, h, o.az);
        } else {
          kit.add(M.wood, cyl(r * 0.8, r, h, 7), o.ax, 0, o.az).add(M.gold, cyl(r * 1.05, r * 1.05, 0.12, 7), o.ax, h * 0.7, o.az).add(M.gold, cyl(0.2, 0.2, 0.1, 6), o.ax, h, o.az);
          glowSpots.push({ x: o.ax, y: h + 0.25, z: o.az, size: 1.4 });
        }
        return;
      case 'hull':
        if (kind === 'column') {
          // a column fallen on its side, in drums
          for (let k = 0; k < 3; k++) {
            const t = (k + 0.5) / 3;
            kit.add(M.cream, new THREE.CylinderGeometry(r, r, len / 3 - 0.1, 16).rotateX(Math.PI / 2).translate(0, r, 0), o.ax + (o.bx - o.ax) * t, 0, o.az + (o.bz - o.az) * t, yaw + (rnd() - 0.5) * 0.12);
          }
          kit.add(M.gold, new THREE.TorusGeometry(r * 1.02, 0.05, 6, 16).translate(0, r, 0), o.ax + (o.bx - o.ax) * 0.66, 0, o.az + (o.bz - o.az) * 0.66, yaw);
        } else if (kind === 'statue') {
          // a fallen obelisk: its plinth at one end, the shaft lying broken in two, its gilt tip in the sand beyond
          kit.add(M.sandstone, box(r * 2.2, 0.8, r * 2.2), o.ax, 0, o.az, yaw).add(M.turquoise, box(r * 2.26, 0.26, r * 2.26), o.ax, 0.4, o.az, yaw).add(M.gold, box(r * 2.3, 0.08, r * 2.3), o.ax, 0.8, o.az, yaw);
          const shaft = (t0: number, t1: number, w0: number, w1: number, turn: number) => {
            const l = len * (t1 - t0), cx = o.ax + (o.bx - o.ax) * ((t0 + t1) / 2), cz = o.az + (o.bz - o.az) * ((t0 + t1) / 2);
            kit.add(M.cream, new THREE.CylinderGeometry(w1, w0, l, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).translate(0, w0 * 0.75, 0), cx, 0, cz, yaw + turn);
          };
          shaft(0.12, 0.56, r * 0.8, r * 0.68, 0.04);
          shaft(0.6, 0.9, r * 0.66, r * 0.56, -0.12);
          const tx = o.ax + (o.bx - o.ax) * 1.02, tz = o.az + (o.bz - o.az) * 1.02;
          kit.add(M.gold, new THREE.ConeGeometry(r * 0.62, r * 1.1, 4).rotateY(Math.PI / 4).translate(0, r * 0.4, 0), tx, 0, tz, yaw + 0.5, 1, 1, 1, 0.9);
        } else {
          // a broken cart: its bed, one wheel up, one lying
          kit.add(M.plank, box(r * 1.6, 0.5, len), mx, 0.5, mz, yaw).add(M.wood, new THREE.TorusGeometry(0.8, 0.12, 6, 14), o.ax, 0.8, o.az, yaw + Math.PI / 2);
        }
        return;
    }
  });
  for (const d of look.decor) {
    // an arch's lintel over its two piers
    kit.add(M.flag, box(7.2, 1, 1.4), d.x, d.s, d.z, d.yaw).add(M.turquoise, box(7.3, 0.3, 1.45), d.x, d.s + 0.35, d.z, d.yaw).add(M.gold, box(7.4, 0.1, 1.5), d.x, d.s + 1, d.z, d.yaw);
  }
  // Lanterns at the places, towards the middle.
  for (const p of look.places) {
    const a = Math.atan2(RING.x - p.x, RING.z - p.z), x = p.x + Math.sin(a) * (p.r - 1), z = p.z + Math.cos(a) * (p.r - 1);
    kit.add(M.wood, cyl(0.12, 0.16, 2.6, 6), x, 0, z).add(M.gold, cyl(0.2, 0.2, 0.1, 6), x, 2.6, z);
    glowSpots.push({ x, y: 2.85, z, size: 1.8 });
  }

  // --- where a walk stops: fallen rock at the cliffs' foot, low ledges in the south, markers along the dunes ----------------------
  const around = 2 * Math.PI * rmean;
  for (let k = 0; k < around / 2.6; k++) {
    const a = (k / (around / 2.6)) * Math.PI * 2 + (rnd() - 0.5) * 0.02, o = out(a, 1.2 + rnd() * 2.4), ds = geo.duneSide(o.dx, o.dz);
    const p = W(o.dx, o.dz), y = geo.height(o.dx, o.dz);
    if (ds > 0.5) {
      // a marker every few metres along the dunes' edge: a short sandstone post with a brass cap
      if (k % 3) continue;
      const m = out(a, 1.4), q = W(m.dx, m.dz), yy = geo.height(m.dx, m.dz);
      kit.add(M.sandstone, new THREE.CylinderGeometry(0.28, 0.4, 1.3, 4).rotateY(Math.PI / 4).translate(0, 0.65, 0), q.x, yy - 0.15, q.z).add(M.gold, new THREE.ConeGeometry(0.32, 0.36, 4).rotateY(Math.PI / 4).translate(0, 1.33, 0), q.x, yy - 0.15, q.z);
    } else {
      const s = 0.6 + rnd() * (geo.south(o.dx, o.dz) > 0.5 ? 0.7 : 1.4);
      kit.add(rocks[k % 3], ico0, p.x, y + s * 0.2, p.z, rnd() * 6, s * 1.3, s * 0.85, s * 1.1, (rnd() - 0.5) * 0.4);
    }
  }
  // Bastions of rock on the cliffs, just past the edge (not in the south): stacked, the walls' near face.
  for (let k = 0; k < around / 9; k++) {
    const a = rnd() * Math.PI * 2, o = out(a, 5 + rnd() * 9);
    if (geo.duneSide(o.dx, o.dz) > 0.3 || geo.south(o.dx, o.dz) > 0.3) continue;
    const p = W(o.dx, o.dz);
    butte(kit, p.x, p.z, 3 + rnd() * 3, 7 + rnd() * 8, geo.height(o.dx, o.dz) - 1, k, false);
  }
  // Mesas far off in the haze (no shadows).
  for (let k = 0; k < 34; k++) {
    const a = rnd() * Math.PI * 2, o = out(a, 70 + rnd() * 110);
    if (geo.south(o.dx, o.dz) > 0.4) continue;
    const p = W(o.dx, o.dz), r = 9 + rnd() * 14, h = 14 + rnd() * 22, y = geo.height(o.dx, o.dz) - 2, tiers = 2 + Math.floor(rnd() * 2);
    for (let t = 0; t < tiers; t++) far.add(rocks[(k + t) % 3], new THREE.CylinderGeometry(r * (1 - t * 0.22) * 0.9, r * (1 - t * 0.22), h / tiers, 9).translate(0, h / tiers / 2, 0), p.x, y + (t * h) / tiers, p.z, rnd() * 3);
    far.add(M.sandstone, new THREE.CylinderGeometry(r * (1 - tiers * 0.22) * 0.95, r * (1 - tiers * 0.22) * 0.95, 0.6, 9), p.x, y + h, p.z);
  }
  kit.build(g, own);
  const farGroup = new THREE.Group();
  far.build(farGroup, own);
  farGroup.traverse((o) => { o.castShadow = false; });
  g.add(farGroup);

  // --- dry shrubs: instanced, in the sand past the edge and on the dunes ------------------------------------------------------
  const tufts: THREE.Matrix4[] = [], q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < 900 && tufts.length < Math.round(260 * (rmean / 48)); k++) {
    const o = out(rnd() * Math.PI * 2, 1.5 + Math.pow(rnd(), 1.4) * 60);
    if (geo.steepness(o.dx, o.dz) > 0.5) continue;
    const p = W(o.dx, o.dz), s = 0.45 + rnd() * 0.5;
    tufts.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, geo.height(o.dx, o.dz) - 0.05, p.z), q.setFromAxisAngle(up, rnd() * 6.28).clone(), new THREE.Vector3(s, s * 0.7, s)));
  }
  const tuftParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) tuftParts.push(new THREE.ConeGeometry(0.09, 0.9, 4).translate(0, 0.45, 0).rotateZ(0.5).rotateY((i / 5) * Math.PI * 2));
  const tuftGeo = mergeGeometries(tuftParts)!;
  for (const t of tuftParts) t.dispose();
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x8a7a4a, roughness: 0.9 });
  const tuftMesh = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length);
  tufts.forEach((mm, i) => tuftMesh.setMatrixAt(i, mm));
  tuftMesh.instanceMatrix.needsUpdate = true;
  tuftMesh.receiveShadow = true;
  tuftMesh.computeBoundingSphere();
  g.add(tuftMesh);
  own.push(tuftGeo, tuftMat);

  const glows = new Glows(glowSpots, 0xffa040, 1.5);
  g.add(glows.group);
  own.push(glows);

  return {
    group: g,
    update(_dt, time) { glows.update(time); },
    dispose() {
      g.removeFromParent();
      for (const o of own) o.dispose();
    },
  };
}

/** A Sands floor as an arena: its own layout and outline, the desert's stage. */
export function sandsArena(id: string, name: string, look: SandsLook): ArenaDef {
  // The ring is the circle round the whole outline: the walk's box and the checks' grid; the outline's own walls keep a walk inside it.
  return { id, name, ring: Math.ceil(Math.max(...look.rim) + 1.5), obstacles: look.pieces.map((p) => p.o), stage: STAGE, hideGround: true, build: () => buildSandsZone(look) };
}
