import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING, canvasTexture, seeded } from '../../arenas/common';
import { Glows } from '../../arenas/real';
import type { ArenaDef, ArenaStage } from '../../arenas/types';
import type { WoodKind, WoodLook } from './gen/wood';
import { rimAt } from './land';
import { woodDepth } from './woodDepth';
import { buildWoodScenes } from './scenes/wood';

/**
 * A Wood floor at the new size (the Climb's chapter 2, floors 11 to 20; pipeline/designs/tower-50.md), drawn from its baked look
 * (gen/wood.ts `WoodLook`): a forest in the gold of a late afternoon, not a platform in one. Inside the outline: glades of moss and leaf
 * litter, trails through the passes, each place's ground; the bands of trees between the glades and the groves in them (one capsule of
 * cover each, drawn as trees, instanced); past the outline the wood goes on, rising into wooded hills and a rocky ridge in the north, and
 * the Elder tree stands behind the lair. What stops a walk at the edge is the wood itself.
 *
 * The house style (blender/arenas/real/STYLE.md, docs/ART_BIBLE.md): clean forms in flat colours, a drawn ground, gold on the edges,
 * lantern light as the only glow. Only the look: the cover, places and packs are the floor's.
 */

/** Late afternoon in the wood: warm light low through the trees, a green-gold haze in the distance. */
const STAGE: ArenaStage = {
  background: 0x9aaa98, zenith: 0x4f6f8c, horizon: 0xd4c49c, glow: 0xf0c27c, stars: 0,
  fog: 0x9aa48a, fogNear: 70, fogFar: 235,
  hemiSky: 0xd0dcc4, hemiGround: 0x3e3c28, hemiIntensity: 0.85,
  sun: 0xffdcaa, sunIntensity: 1.55, rim: 0xa0b4d0, rimIntensity: 0.35,
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Smooth value noise on a 64 x 64 lattice that wraps, three octaves, 0..1. */
function noiseOf(seed: number) {
  const rnd = seeded(seed), N = 64, v = new Float32Array(N * N);
  for (let i = 0; i < v.length; i++) v[i] = rnd();
  // `& 63` is the same wrap as ((i % N) + N) % N for every whole i (N = 64), without two float modulos (deepZone.ts: most of a build).
  const at = (i: number, j: number) => v[(i & 63) + (j & 63) * N];
  const fade = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, z: number) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = fade(x - xi), fz = fade(z - zi);
    const a = at(xi, zi) + (at(xi + 1, zi) - at(xi, zi)) * fx, b = at(xi, zi + 1) + (at(xi + 1, zi + 1) - at(xi, zi + 1)) * fx;
    return a + (b - a) * fz;
  };
  return (x: number, z: number) => 0.55 * noise(x, z) + 0.3 * noise(2.1 * x + 5.3, 2.1 * z + 3.1) + 0.15 * noise(4.3 * x + 9.7, 4.3 * z + 1.9);
}

// --- the palette (sRGB 0..255), a shade duller than the heroes ------------------------------------------------------------------
const MOSS_A: RGB = [56, 74, 44], MOSS_B: RGB = [70, 88, 50], LITTER: RGB = [96, 78, 50], NEEDLES: RGB = [70, 56, 38];
const ROCK: RGB = [96, 92, 86], ROCK_DARK: RGB = [70, 68, 66];
const DIRT: RGB = [104, 86, 62], DIRT_EDGE: RGB = [78, 66, 48], DIRT_MID: RGB = [122, 104, 78];
const COLORS = {
  bark: '#4a3220', barkDark: '#33241a', leafA: '#2f4a2c', leafB: '#3e5a32', leafC: '#4c6a38', leafGold: '#7a7a36', pine: '#2a4232', bush: '#3a5434', thorn: '#5a2f3e',
} as const;

/** The world's shape past the outline, from offsets (dx, dz) from the middle. */
function landOf(rim: number[], seed: number) {
  const fbm = noiseOf(5151 + seed), fbm2 = noiseOf(313 + seed);
  const beyond = (dx: number, dz: number) => Math.hypot(dx, dz) - rimAt(rim, Math.atan2(dz, dx));
  /** The ridge along the north (screen top), 0..1. */
  const ridge = (dx: number, dz: number) => smooth(0.3, 0.75, -dz / (Math.hypot(dx, dz) || 1));
  const height = (dx: number, dz: number) => {
    const b = beyond(dx, dz);
    if (b <= 0.5) return 0;
    const bank = 0.5 * smooth(0.5, 5, b);
    const hills = (0.6 + 8 * fbm(dx * 0.018 + 3, dz * 0.018 + 7)) * smooth(6, 46, b);
    const r = ridge(dx, dz) * smooth(10, 34, b) * (8 + 12 * fbm2(dx * 0.03, dz * 0.03));
    return bank + Math.max(hills, r);
  };
  const steepness = (dx: number, dz: number) => {
    const e = 0.7;
    return Math.hypot(height(dx + e, dz) - height(dx - e, dz), height(dx, dz + e) - height(dx, dz - e)) / (2 * e);
  };
  /** The ground's colour; `steep` when it is known already (the ground's grid works it out from its own heights). */
  const color = (dx: number, dz: number, steep?: number): RGB => {
    let c = mix(MOSS_A, MOSS_B, fbm(dx * 0.05 + 1, dz * 0.05 + 2));
    c = mix(c, LITTER, 0.5 * smooth(0.55, 0.8, fbm2(dx * 0.03 + 11, dz * 0.03 + 4)));
    const b = beyond(dx, dz);
    if (b < 0.5) return c; // flat inside the outline
    c = mix(c, NEEDLES, 0.3 * smooth(4, 20, b) * fbm2(dx * 0.04 + 2, dz * 0.04 + 9));
    c = mix(c, mix(ROCK, ROCK_DARK, fbm2(dx * 0.15, dz * 0.15)), smooth(0.6, 1.15, steep ?? steepness(dx, dz)));
    return c;
  };
  return { beyond, height, color, fbm, fbm2, ridge };
}
type Land = ReturnType<typeof landOf>;

/** The painted middle (`L` m across): the forest floor, the shade under the bands, the trails, the places' ground. */
function paint(look: WoodLook, land: Land, L: number, extra?: (g: CanvasRenderingContext2D, X: (dx: number) => number, Z: (dz: number) => number, ppm: number) => void) {
  const size = L > 140 ? 4096 : 2048;
  return canvasTexture(size, (g) => {
    const ppm = size / L, c = size / 2, rnd = seeded(77 + look.seed);
    const X = (dx: number) => c + dx * ppm, Z = (dz: number) => c + dz * ppm;
    const n = Math.round(L), low = document.createElement('canvas');
    low.width = low.height = n;
    const lg = low.getContext('2d')!, img = lg.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const dx = ((i + 0.5) / n - 0.5) * L, dz = ((j + 0.5) / n - 0.5) * L, col = land.color(dx, dz), k = (i + j * n) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(low, 0, 0, size, size);
    const soft = (dx: number, dz: number, rad: number, col: string) => {
      const gr = g.createRadialGradient(X(dx), Z(dz), 0, X(dx), Z(dz), rad * ppm);
      gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = gr;
      g.fillRect(X(dx) - rad * ppm, Z(dz) - rad * ppm, rad * 2 * ppm, rad * 2 * ppm);
    };
    // moss in patches, sunlit and shaded
    for (let k = 0, dabs = Math.round(Math.min(4200, 1600 * (L / 112) ** 2)); k < dabs; k++) {
      const dx = (rnd() - 0.5) * L, dz = (rnd() - 0.5) * L;
      if (land.beyond(dx, dz) > 6) continue;
      soft(dx, dz, 1.2 + rnd() * 3.8, rnd() < 0.45 ? 'rgba(120,136,72,0.17)' : 'rgba(34,48,28,0.2)');
    }
    // the shade and the fallen needles under the bands of trees and the groves
    const shade = (ax: number, az: number, bx: number, bz: number, w: number, a: number) => {
      g.strokeStyle = `rgba(52,42,28,${a})`; g.lineCap = 'round'; g.lineWidth = w * ppm;
      g.beginPath(); g.moveTo(X(ax), Z(az)); g.lineTo(X(bx), Z(bz)); g.stroke();
    };
    look.pieces.forEach((p, i) => {
      const k = look.kinds[i], o = p.o;
      if (k === 'band') { shade(o.ax - RING.x, o.az - RING.z, o.bx - RING.x, o.bz - RING.z, (o.r + 4) * 2, 0.28); shade(o.ax - RING.x, o.az - RING.z, o.bx - RING.x, o.bz - RING.z, (o.r + 1.6) * 2, 0.5); }
      else if (k === 'grove' || k === 'tree' || k === 'hollow') soft(o.ax - RING.x, o.az - RING.z, o.r + 3.5, 'rgba(52,42,28,0.45)');
    });
    // sunlit glade grass in the middle of each glade
    for (const p of look.places) if (p.kind !== 'camp') soft(p.x - RING.x, p.z - RING.z, p.r + 9, 'rgba(112,120,66,0.26)');
    // the trails: earth with a soft edge and a lighter middle where feet go
    g.lineCap = g.lineJoin = 'round';
    const rgba = (c3: RGB, a: number) => `rgba(${c3[0]},${c3[1]},${c3[2]},${a})`;
    for (const path of look.paths) {
      const trace = () => { g.beginPath(); path.forEach(([dx, dz], i) => (i ? g.lineTo(X(dx), Z(dz)) : g.moveTo(X(dx), Z(dz)))); };
      for (const [w, col, a] of [[4.4, DIRT_EDGE, 0.3], [3.6, DIRT_EDGE, 0.6], [3, DIRT, 0.9], [1.4, DIRT_MID, 0.5]] as [number, RGB, number][]) {
        g.strokeStyle = rgba(col, a); g.lineWidth = w * ppm; trace(); g.stroke();
      }
      for (let i = 1; i < path.length; i++) {
        const [ax, az] = path[i - 1], [bx, bz] = path[i], len = Math.hypot(bx - ax, bz - az) || 1;
        for (let s = 0; s < len * 1.5; s++) {
          const t = rnd(), side = (rnd() - 0.5) * 3, nx = -(bz - az) / len, nz = (bx - ax) / len;
          g.fillStyle = rnd() < 0.5 ? 'rgba(150,126,92,0.7)' : 'rgba(70,56,40,0.6)';
          g.beginPath(); g.arc(X(ax + (bx - ax) * t + nx * side), Z(az + (bz - az) * t + nz * side), (0.06 + rnd() * 0.08) * ppm, 0, Math.PI * 2); g.fill();
        }
      }
    }
    // the depth's own (woodDepth.ts): fallen leaves, flower specks, the brooks
    extra?.(g, X, Z, ppm);
    // each place's ground
    const disc = (dx: number, dz: number, r: number, inner: string, edge = 1.5) => {
      const gr = g.createRadialGradient(X(dx), Z(dz), 0, X(dx), Z(dz), (r + edge) * ppm);
      gr.addColorStop(0, inner); gr.addColorStop(r / (r + edge), inner); gr.addColorStop(1, inner.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = gr;
      g.beginPath(); g.arc(X(dx), Z(dz), (r + edge) * ppm, 0, Math.PI * 2); g.fill();
    };
    const flags = (dx: number, dz: number, r: number, size: number, base: RGB) => {
      g.save(); g.beginPath(); g.arc(X(dx), Z(dz), r * ppm, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#3c4430'; g.fillRect(X(dx - r), Z(dz - r), 2 * r * ppm, 2 * r * ppm);
      for (let z = dz - r; z < dz + r; z += size) for (let x = dx - r + ((((z - dz) / size) | 0) % 2) * size * 0.5; x < dx + r; x += size) {
        const t = 0.82 + 0.3 * rnd();
        g.fillStyle = `rgb(${Math.round(base[0] * t)},${Math.round(base[1] * t)},${Math.round(base[2] * t)})`;
        const inset = size * 0.1;
        g.beginPath(); g.roundRect(X(x) + inset * ppm, Z(z) + inset * ppm, (size - 2 * inset) * ppm, (size - 2 * inset) * ppm, size * 0.25 * ppm); g.fill();
      }
      g.restore();
      g.strokeStyle = 'rgba(201,162,74,0.55)'; g.lineWidth = 0.12 * ppm;
      g.beginPath(); g.arc(X(dx), Z(dz), (r - 0.1) * ppm, 0, Math.PI * 2); g.stroke();
    };
    for (const p of look.places) {
      const dx = p.x - RING.x, dz = p.z - RING.z;
      switch (p.kind) {
        case 'camp': disc(dx, dz, p.r - 0.5, rgba(DIRT, 0.85), 2.5); break;
        case 'stones': case 'giants': case 'shrine': flags(dx, dz, p.r - 1.5, 1.3, [110, 112, 96]); break;
        case 'den': disc(dx, dz, p.r, 'rgba(70,56,40,0.8)', 3); break;
        case 'bramble': disc(dx, dz, p.r, 'rgba(76,52,58,0.55)', 3); break;
        case 'thicket': disc(dx, dz, p.r, 'rgba(50,46,34,0.6)', 3); break;
        case 'burners': disc(dx, dz, p.r, 'rgba(84,80,74,0.75)', 3); break;
        case 'spring': disc(dx, dz, p.r - 1, 'rgba(66,96,60,0.7)', 3); break;
        case 'hollow': disc(dx, dz, p.r, 'rgba(84,68,44,0.6)', 3); break;
        case 'heart': disc(dx, dz, p.r, 'rgba(96,118,58,0.6)', 3); flags(dx, dz, 4, 1.1, [120, 124, 96]); break;
        case 'lamps': disc(dx, dz, p.r, 'rgba(110,122,64,0.45)', 3); break;
      }
    }
  });
}

/**
 * The props, merged: every matte part carries its material's colour in its vertices, so a square of ground `PCELL` m across is one mesh
 * (and the polished gold, the glowing sap and the water one more each); a square out of the camera's view is not drawn. (zone.ts `Kit`, a
 * mesh per material per 24 m square, drew 571 things a frame at this size.)
 */
const PCELL = 48;
class Props {
  private cells = new Map<string, Map<THREE.Material, THREE.BufferGeometry[]>>();
  private m = new THREE.Matrix4();
  private shared: THREE.MeshStandardMaterial;
  constructor(private own: THREE.Material[]) {
    this.shared = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  }
  add(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const own = this.own.includes(mat);
    if (!own) {
      const col = (mat as THREE.MeshStandardMaterial).color, n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    this.m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    g.computeBoundingBox();
    const ctr = g.boundingBox!.getCenter(new THREE.Vector3()), key = `${Math.floor(ctr.x / PCELL)}:${Math.floor(ctr.z / PCELL)}`;
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, (cell = new Map()));
    const bin = own ? mat : this.shared;
    let list = cell.get(bin);
    if (!list) cell.set(bin, (list = []));
    list.push(g);
    return this;
  }
  build(into: THREE.Group, keep: { dispose(): void }[]) {
    keep.push(this.shared);
    for (const cell of this.cells.values()) for (const [mat, geos] of cell) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = mesh.receiveShadow = mat !== this.own[1];
      into.add(mesh);
      keep.push(merged);
    }
    this.cells.clear();
  }
}

/**
 * Trees and bushes, instanced: each kind's instances are put in squares `SQ` m across (and apart by whether they cast a shadow), so a
 * square out of the camera's view (and out of the sun's shadow box) is not drawn.
 */
const SQ = 110;
class Forest {
  private bins = new Map<string, THREE.Matrix4[]>();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  /** Where each tree and bush stands, with its reach (for the scenes to keep off: scenes/wood.ts). */
  readonly at: { x: number; z: number; r: number; tree?: boolean }[] = [];
  add(kind: number, x: number, y: number, z: number, s: number, sy = s, yaw = 0, shadow = true) {
    this.at.push({ x, z, r: (kind === 3 ? 1 : kind === 2 ? 3 : 2.3) * s, tree: kind !== 3 });
    const key = `${kind}:${Math.floor(x / SQ)}:${Math.floor(z / SQ)}:${shadow ? 1 : 0}`;
    let b = this.bins.get(key);
    if (!b) this.bins.set(key, (b = []));
    b.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), this.q.setFromAxisAngle(this.up, yaw).clone(), new THREE.Vector3(s, sy, s)));
  }
  build(geos: THREE.BufferGeometry[], material: THREE.Material, into: THREE.Group) {
    for (const [key, list] of this.bins) {
      const [kind, , , sh] = key.split(':').map(Number);
      const im = new THREE.InstancedMesh(geos[kind], material, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = sh === 1;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      into.add(im);
    }
    this.bins.clear();
  }
}

/**
 * Trees between the camera and the hero thin out: the game's camera looks down at the hero in the middle of the screen, so every tree
 * fragment inside a cylinder (`R` m) round the line from the camera to the ground under the screen's middle, and nearer the camera than
 * that ground, is dropped in a screen-door pattern (a band of trees south of a way would otherwise hide whoever walks it). A camera that
 * looks along the ground (a low view) keeps every tree.
 */
function seeThrough(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeeW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 seeW = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          seeW = instanceMatrix * seeW;
        #endif
        vSeeW = ( modelMatrix * seeW ).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeeW;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          vec3 fwd = -vec3( viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2] );
          if ( fwd.y < -0.35 ) {
            float t = ( cameraPosition.y - 1.2 ) / -fwd.y;
            vec3 rel = vSeeW - cameraPosition;
            float along = dot( rel, fwd );
            float off = length( rel - fwd * along );
            float fade = ( 1.0 - smoothstep( 3.2, 5.2, off ) ) * smoothstep( 0.0, 2.0, t - 2.0 - along );
            vec2 cell = mod( floor( gl_FragCoord.xy ), 4.0 );
            float th = ( mod( cell.x + cell.y * 2.0, 4.0 ) + 0.5 ) / 4.0;
            if ( fade * 0.8 > th ) discard;
          }
        }`);
  };
  m.customProgramCacheKey = () => 'tower-wood-see-through';
}

/** Builds a wood zone's meshes from its look. */
export function buildWoodZone(look: WoodLook, keep: { x: number; z: number }[] = []): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const rnd = seeded(4400 + look.seed);
  const land = landOf(look.rim, look.seed);
  const rmax = Math.max(...look.rim);
  const W = (dx: number, dz: number) => ({ x: RING.x + dx, z: RING.z + dz });

  // --- the ground ---------------------------------------------------------------------------------------------------------
  const SIZE = Math.max(420, 2 * (rmax + 150)), SEG = Math.round(SIZE / 2.3), L = 2 * (rmax + 8);
  const plane = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
  const pos = plane.attributes.position, nv = pos.count;
  for (let i = 0; i < nv; i++) pos.setY(i, land.height(pos.getX(i), pos.getZ(i)));
  plane.computeVertexNormals();
  const colors = new Float32Array(nv * 4), uv = plane.attributes.uv, tmp = new THREE.Color(), row = SEG + 1, step = SIZE / SEG;
  /** The slope at a vertex of the grid, from its neighbours' heights (rise over run). */
  const slope = (i: number) => {
    const ix = i % row, iz = Math.floor(i / row), at = (x: number, z: number) => pos.getY(Math.min(SEG, Math.max(0, z)) * row + Math.min(SEG, Math.max(0, x)));
    return Math.hypot(at(ix + 1, iz) - at(ix - 1, iz), at(ix, iz + 1) - at(ix, iz - 1)) / (2 * step);
  };
  for (let i = 0; i < nv; i++) {
    const dx = pos.getX(i), dz = pos.getZ(i), c = land.color(dx, dz, slope(i));
    tmp.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
    colors[i * 4] = tmp.r; colors[i * 4 + 1] = tmp.g; colors[i * 4 + 2] = tmp.b;
    const inside = 1 - smooth(4.5, 7.5, land.beyond(dx, dz)), onCanvas = Math.abs(dx) < L / 2 - 1 && Math.abs(dz) < L / 2 - 1 ? 1 : 0;
    colors[i * 4 + 3] = inside * onCanvas;
    uv.setXY(i, dx / L + 0.5, dz / L + 0.5);
  }
  plane.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  // The depth (woodDepth.ts): looks only; it paints into the ground and adds its props below, before they are merged.
  const depth = woodDepth(look, land, keep);
  const map = paint(look, land, L, depth.paint);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.flipY = false;
  map.anisotropy = 4;
  const groundMat = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.94, envMapIntensity: 0.12 });
  groundMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', 'vec4 texelColor = texture2D( map, vMapUv );\n diffuseColor.rgb = mix( vColor.rgb, texelColor.rgb, vColor.a );')
      .replace('#include <color_fragment>', '');
  };
  groundMat.customProgramCacheKey = () => 'tower-wood-ground';
  const ground = new THREE.Mesh(plane, groundMat);
  ground.position.set(RING.x, 0, RING.z);
  ground.receiveShadow = true;
  g.add(ground);
  own.push(plane, map, groundMat);

  // --- materials of the props -----------------------------------------------------------------------------------------------
  const mat = (color: number, rough = 0.85, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, ...o });
    own.push(m);
    return m;
  };
  const bark = mat(0x3c2b1c), barkLight = mat(0x5a4530), leafA = mat(0x2a4426), leafC = mat(0x3e5a2e), mossy = mat(0x4a5a3a, 0.95), stone = mat(0x60645a, 0.95);
  const wood = mat(0x4a3626), sail = mat(0x8a8264, 0.95, { side: THREE.DoubleSide }), thatch = mat(0x7a6a42, 0.95), plaster = mat(0xb4ab94, 0.85), ash = mat(0x3a3836, 0.95);
  const gold = mat(0xc9a24a, 0.4, { metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.22 });
  const thornMat = mat(0x5a2f3e, 0.8), sap = new THREE.MeshBasicMaterial({ color: 0xffb860 }), water = new THREE.MeshStandardMaterial({ color: 0x2c5a5a, roughness: 0.15, metalness: 0.2, emissive: 0x0c2a2a, emissiveIntensity: 0.4 });
  own.push(sap, water);
  const kit = new Props([gold, sap, water]);
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (r0: number, r1: number, h: number, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const glowSpots: { x: number; y: number; z: number; size?: number }[] = [];

  // --- the trees: geometries carrying their colours, one material ----------------------------------------------------------------
  const tint = (geo: THREE.BufferGeometry, hex: string) => {
    const nn = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(hex), c = new Float32Array(nn.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
    for (const k of Object.keys(nn.attributes)) if (k !== 'position' && k !== 'normal') nn.deleteAttribute(k);
    nn.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return nn;
  };
  const trunk = (r0: number, r1: number, h: number) => tint(new THREE.CylinderGeometry(r0, r1, h, 6).translate(0, h / 2, 0), COLORS.bark);
  const crown = (r: number, x: number, y: number, z: number, hex: string, sy = 0.85) => tint(new THREE.IcosahedronGeometry(r, 0).scale(1, sy, 1).translate(x, y, z), hex);
  const TREE_GEOS = [
    // 0 broadleaf
    mergeGeometries([trunk(0.22, 0.36, 3.4), crown(2.4, 0, 4.4, 0, COLORS.leafB), crown(1.7, 1.1, 3.6, 0.7, COLORS.leafC), crown(1.5, -1, 5.4, -0.4, COLORS.leafA)])!,
    // 1 pine
    mergeGeometries([trunk(0.18, 0.3, 2.6), tint(new THREE.ConeGeometry(2.1, 3.2, 7).translate(0, 3.2, 0), COLORS.pine), tint(new THREE.ConeGeometry(1.6, 2.8, 7).translate(0, 4.8, 0), COLORS.pine),
      tint(new THREE.ConeGeometry(1.05, 2.4, 7).translate(0, 6.2, 0), COLORS.pine)])!,
    // 2 an old oak, wide
    mergeGeometries([trunk(0.45, 0.75, 3.8), crown(3.2, 0, 5.6, 0, COLORS.leafA, 0.7), crown(2.3, 2, 5, 1, COLORS.leafB, 0.75), crown(2.1, -1.9, 5.2, -0.8, COLORS.leafC, 0.75), crown(1.6, 0.4, 7, -0.6, COLORS.leafGold, 0.8)])!,
    // 3 a bush
    tint(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.72, 1).translate(0, 0.55, 0), COLORS.bush),
    // 4 a birch-like slim tree, light
    mergeGeometries([tint(new THREE.CylinderGeometry(0.14, 0.2, 4.6, 6).translate(0, 2.3, 0), '#c8c0a8'), crown(1.4, 0, 4.8, 0, COLORS.leafGold, 1.2), crown(1.0, 0.5, 3.8, 0.3, COLORS.leafC, 1.1)])!,
  ];
  for (const t of TREE_GEOS) own.push(t);
  const leaves = mat(0xffffff, 0.85, { vertexColors: true, flatShading: true });
  seeThrough(leaves);
  const forest = new Forest();
  const near = (x: number, z: number) => land.beyond(x - RING.x, z - RING.z) < 22;

  // --- the cover: bands, groves, trees and the rest, each drawn as what it is --------------------------------------------------------
  look.pieces.forEach(({ o }, idx) => {
    const k: WoodKind = look.kinds[idx];
    const yaw = Math.atan2(o.bx - o.ax, o.bz - o.az), len = Math.hypot(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, r = o.r, h = o.height;
    switch (k) {
      case 'band': {
        // two staggered rows of trees on the capsule, bushes at its foot; a band running east to west is lower (the camera looks north over it)
        const ux = (o.bx - o.ax) / (len || 1), uz = (o.bz - o.az) / (len || 1), nx = -uz, nz = ux, ew = Math.abs(ux);
        const hs = 1 - 0.35 * smooth(0.5, 0.95, ew);
        for (let s = -r; s <= len + r; s += 2.1) {
          for (const side of [-1, 1]) {
            if (rnd() < 0.15) continue;
            const off = side * (0.35 + rnd() * 0.9), x = o.ax + ux * (s + (side > 0 ? 1 : 0)) + nx * off, z = o.az + uz * (s + (side > 0 ? 1 : 0)) + nz * off;
            const u = rnd(), kind = u < 0.48 ? 0 : u < 0.78 ? 1 : u < 0.9 ? 4 : 2, sc = (0.75 + rnd() * 0.4) * hs * (kind === 2 ? 0.8 : 1);
            forest.add(kind, x, 0, z, sc, sc, rnd() * 6.28, true);
          }
          for (const side of [-1, 1]) if (rnd() < 0.8) forest.add(3, o.ax + ux * s + nx * side * (r + 0.3 + rnd() * 0.6), 0, o.az + uz * s + nz * side * (r + 0.3 + rnd() * 0.6), 0.8 + rnd() * 0.7, 0.7 + rnd() * 0.5, rnd() * 6.28, false);
        }
        break;
      }
      case 'grove': {
        const nT = Math.max(3, Math.round(r * 1.6));
        for (let i = 0; i < nT; i++) {
          const a = rnd() * 6.28, d = i === 0 ? 0 : Math.sqrt(rnd()) * r * 0.75, sc = 0.75 + rnd() * 0.45;
          forest.add(rnd() < 0.6 ? 0 : rnd() < 0.5 ? 4 : 1, o.ax + Math.cos(a) * d, 0, o.az + Math.sin(a) * d, sc);
        }
        for (let i = 0; i < Math.round(r * 2.2); i++) { const a = rnd() * 6.28, d = r * (0.85 + rnd() * 0.3); forest.add(3, o.ax + Math.cos(a) * d, 0, o.az + Math.sin(a) * d, 0.7 + rnd() * 0.6, 0.6 + rnd() * 0.5, rnd() * 6.28, false); }
        break;
      }
      case 'tree':
        forest.add(2, o.ax, 0, o.az, 0.8 + r * 0.3);
        break;
      case 'hollow':
        kit.add(bark, cyl(r * 0.8, r * 1.15, 7, 10), o.ax, 0, o.az).add(leafA, ico, o.ax, 9, o.az, 0, 6, 4, 6).add(leafC, ico, o.ax + 3, 10.5, o.az + 1, 1, 4, 3, 4);
        kit.add(sap, new THREE.CircleGeometry(1, 10).scale(0.8, 1.4, 1).translate(0, 1.4, r * 1.02), o.ax, 0, o.az, Math.atan2(RING.x - o.ax, RING.z - o.az));
        glowSpots.push({ x: o.ax, y: 1.6, z: o.az, size: 2.6 });
        for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; kit.add(bark, cyl(0.3, 0.6, 3, 6), o.ax + Math.cos(a) * r, 0, o.az + Math.sin(a) * r, 0, 1, 1, 1, 0.9 * (Math.cos(a) > 0 ? -1 : 1)); }
        break;
      case 'rock':
        kit.add(mossy, ico, o.ax, h * 0.3, o.az, rnd() * 6, r * 1.1, h * 0.7, r * 1.1).add(stone, ico, o.ax + r * 0.5, h * 0.12, o.az - r * 0.3, rnd() * 6, r * 0.6, h * 0.38, r * 0.6);
        break;
      case 'thorn':
        for (let i = 0; i < 6; i++) kit.add(thornMat, new THREE.ConeGeometry(0.16, 1.4 + rnd(), 5).translate(0, 0.75, 0), o.ax + (rnd() - 0.5) * r * 1.3, 0, o.az + (rnd() - 0.5) * r * 1.3, 0, 1, 1, 1, (rnd() - 0.5) * 1.2);
        kit.add(leafA, ico, o.ax, 0.5, o.az, rnd() * 6, r * 1.05, 0.7, r * 1.05);
        break;
      case 'log':
        kit.add(bark, new THREE.CylinderGeometry(r * 1.3, r * 1.45, len + r * 2, 7).rotateX(Math.PI / 2).translate(0, r * 1.3, 0), mx, 0, mz, yaw).add(mossy, box(r * 1.1, 0.18, len * 0.75), mx, r * 2.5, mz, yaw);
        break;
      case 'stump':
        kit.add(barkLight, cyl(r * 0.85, r, h, 8), o.ax, 0, o.az).add(wood, cyl(r * 0.8, r * 0.8, 0.05, 8), o.ax, h, o.az);
        break;
      case 'menhir':
        kit.add(stone, new THREE.BoxGeometry(r * 1.6, h, r * 1.2).translate(0, h / 2, 0), o.ax, 0, o.az, rnd() * 3, 1, 1, 1, 0.04).add(gold, box(r * 1.7, 0.08, r * 1.3), o.ax, h * 0.62, o.az, 0);
        break;
      case 'twist':
        kit.add(bark, cyl(0.3, 0.55, h, 6), o.ax, 0, o.az, 0, 1, 1, 1, 0.12).add(bark, cyl(0.2, 0.3, h * 0.6, 5), o.ax + 0.3, h * 0.7, o.az, 1, 1, 1, 1, -0.9).add(leafC, ico, o.ax, h + 0.7, o.az, 0, 1.6, 1.2, 1.6);
        break;
      case 'fire':
        kit.add(stone, cyl(r, r * 1.1, 0.35, 8), o.ax, 0, o.az).add(bark, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 0.3, 1, 1, 1, 0.8).add(bark, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 2.4, 1, 1, 1, 0.8);
        kit.add(gold, new THREE.ConeGeometry(0.35, 0.9, 6).translate(0, 0.85, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: 1.2, z: o.az, size: 7 });
        break;
      case 'tent':
        kit.add(sail, new THREE.ConeGeometry(r * 1.25, h * 1.4, 7).translate(0, h * 0.7, 0), o.ax, 0, o.az, rnd() * 3).add(gold, cyl(0.05, 0.05, h * 1.9, 4), o.ax, 0, o.az);
        break;
      case 'crate':
        kit.add(wood, box(r * 2, h, r * 2), o.ax, 0, o.az, rnd() * 3).add(gold, box(r * 2.06, 0.08, r * 2.06), o.ax, h * 0.5, o.az, 0);
        break;
      case 'hut': {
        // a burner's hut: timber walls, a steep thatch, a gilt ridge
        kit.add(wood, box(r * 2, h * 0.6, len + r * 2), mx, 0, mz, yaw);
        const roof = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).scale(r * 1.75, h * 0.7, (len + r * 2) * 0.72).translate(0, h * 0.6 + h * 0.35, 0);
        kit.add(thatch, roof, mx, 0, mz, yaw).add(gold, box(0.1, 0.1, len + r * 1.6), mx, h * 1.27, mz, yaw);
        break;
      }
      case 'mound':
        kit.add(ash, new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(r, h, r), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: h * 0.8, z: o.az, size: 2.2 });
        break;
      case 'shrine':
        kit.add(plaster, box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add(gold, box(r * 2.3, 0.1, len + r * 2.3), mx, h, mz, yaw);
        break;
      case 'post':
        kit.add(bark, cyl(r * 0.6, r * 0.8, h, 6), o.ax, 0, o.az).add(gold, cyl(0.22, 0.22, 0.3, 6), o.ax, h, o.az);
        glowSpots.push({ x: o.ax, y: h + 0.2, z: o.az, size: 1.6 });
        break;
      case 'lair': {
        // a wall of roots: a log along it, trunks standing in it, crowns over them
        kit.add(bark, new THREE.CylinderGeometry(r * 1.5, r * 1.7, len + r * 2, 7).rotateX(Math.PI / 2).translate(0, r * 1.5, 0), mx, 0, mz, yaw);
        for (let s = 0; s <= len; s += 2.4) {
          const t = s / (len || 1), x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t;
          kit.add(bark, cyl(0.45, 0.7, h, 6), x, 0, z, rnd() * 3, 1, 1, 1, (rnd() - 0.5) * 0.3).add(leafA, ico, x, h + 0.4, z, rnd() * 3, 1.5, 1.1, 1.5);
        }
        break;
      }
      case 'roots':
        // the Elder's roots behind the lair: a low mound of bark with roots arching out of it
        kit.add(bark, new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(r, h, r), o.ax, 0, o.az);
        for (let i = 0; i < 3; i++) kit.add(barkLight, cyl(0.25, 0.45, r * 1.2, 6), o.ax + (rnd() - 0.5) * r, 0, o.az + (rnd() - 0.5) * r, rnd() * 6, 1, 1, 1, 0.9);
        break;
      case 'edge':
        break;
    }
  });

  // The spring's pool, the lanterns of the places (towards the middle) and of the passes (on the bands' ends).
  for (const p of look.places) {
    if (p.kind === 'spring') {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(3.6, 28).rotateX(-Math.PI / 2), water);
      pool.position.set(p.x, 0.03, p.z);
      g.add(pool);
      own.push(pool.geometry);
      kit.add(gold, new THREE.TorusGeometry(3.7, 0.06, 4, 32).rotateX(Math.PI / 2), p.x, 0.05, p.z);
    }
    const a = Math.atan2(RING.x - p.x, RING.z - p.z), x = p.x + Math.sin(a) * (p.r - 1), z = p.z + Math.cos(a) * (p.r - 1);
    kit.add(bark, cyl(0.12, 0.16, 2.6, 6), x, 0, z).add(gold, cyl(0.2, 0.2, 0.1, 6), x, 2.6, z);
    glowSpots.push({ x, y: 2.85, z, size: 1.8 });
  }
  for (const ps of look.passes) for (const s of [-1, 1]) {
    const e = ps.w + 1.7, x = ps.x + ps.dx * s * e, z = ps.z + ps.dz * s * e;
    kit.add(barkLight, cyl(0.1, 0.14, 2.3, 6), x, 0, z).add(gold, box(0.3, 0.32, 0.3), x, 2.3, z);
    glowSpots.push({ x, y: 2.5, z, size: ps.set === undefined ? 1.4 : 1.1 });
  }

  // The Elder tree, past the edge behind the lair: too wide to see round, roots that arch, a glowing heart.
  {
    const { x, z } = look.elder, y = land.height(x - RING.x, z - RING.z);
    kit.add(bark, new THREE.CylinderGeometry(4.6, 7, 20, 10).translate(0, 10, 0), x, y - 1, z).add(leafA, ico, x, y + 22, z, 0, 13, 8, 13).add(leafC, ico, x + 6, y + 25, z + 2, 1, 8, 6, 8).add(leafA, ico, x - 7, y + 24, z + 1, 2, 7, 5, 7);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; kit.add(bark, cyl(0.7, 1.6, 10), x + Math.cos(a) * 7.4, y - 0.5, z + Math.sin(a) * 7.4, 0, 1, 1, 1, Math.cos(a) > 0 ? -1 : 1); }
    kit.add(sap, new THREE.SphereGeometry(1.8, 10, 8).translate(0, 4.5, 4.4), x, y, z);
    glowSpots.push({ x, y: y + 4.5, z: z + 5, size: 10 });
  }

  // --- the wood past the outline: dense at the edge, then patchy up the hills; pines on the ridge ----------------------------------------
  const around = 2 * Math.PI * (look.rim.reduce((s, v) => s + v, 0) / look.rim.length);
  for (let k = 0, want = Math.round(around * 1.1); k < want; k++) {
    // the edge itself: a wall of trees just past the outline (what stops a walk)
    const a = (k / want) * Math.PI * 2 + rnd() * 0.01, rr = rimAt(look.rim, a) + 2.5 + rnd() * 4, dx = Math.cos(a) * rr, dz = Math.sin(a) * rr, p = W(dx, dz);
    const south = dz > 0 && Math.abs(dx) < dz * 1.2, sc = (south ? 0.6 : 0.85) + rnd() * 0.4, kind = south ? (rnd() < 0.6 ? 0 : 3) : rnd() < 0.45 ? 0 : rnd() < 0.6 ? 1 : 4;
    forest.add(kind, p.x, land.height(dx, dz) - 0.1, p.z, kind === 3 ? sc * 1.4 : sc, kind === 3 ? sc : sc, rnd() * 6.28, true);
    if (rnd() < 0.7) { const q = W(Math.cos(a) * (rr - 1.8), Math.sin(a) * (rr - 1.8)); forest.add(3, q.x, 0, q.z, 0.8 + rnd() * 0.6, 0.6 + rnd() * 0.4, rnd() * 6.28, false); }
  }
  for (let k = 0, made = 0, want = Math.round(1700 * Math.min(1.6, rmax / 110)); k < want * 6 && made < want; k++) {
    const a = rnd() * Math.PI * 2, b = 7 + Math.pow(rnd(), 1.25) * 100, rr = rimAt(look.rim, a) + b, dx = Math.cos(a) * rr, dz = Math.sin(a) * rr;
    const dens = land.fbm2(dx * 0.025 + 21, dz * 0.025 + 5);
    if (rnd() > smooth(0.25, 0.5, dens) + 0.35 + 0.4 * smooth(30, 5, b)) continue;
    const south = dz > 0 && Math.abs(dx) < dz * 1.2 && b < 30;
    const p = W(dx, dz), h = land.height(dx, dz), ridgy = land.ridge(dx, dz) > 0.5 && b > 12;
    const kind = ridgy ? 1 : south ? 0 : rnd() < 0.5 ? 0 : rnd() < 0.55 ? 1 : rnd() < 0.5 ? 2 : 4, sc = (south ? 0.65 : 0.85) + rnd() * 0.5;
    forest.add(kind, p.x, h - 0.2, p.z, sc, sc, rnd() * 6.28, near(p.x, p.z));
    made++;
  }
  const deep = depth.build({ kit, into: g, own, gold, glows: glowSpots });
  g.userData.depth = { solids: deep.solids, brooks: deep.brooks, places: look.places }; // for the checks and the pictures (pipeline/tools)
  // The scenes (scenes/wood.ts): little stories told in props, their own random stream; they keep off the depth's props and the trees.
  g.userData.woodScenes = buildWoodScenes({ look, land, kit, own, keep, ground: { map, L }, taken: [...deep.solids.map((s) => ({ x: s.x, z: s.z, r: s.r })), ...forest.at.filter((t) => land.beyond(t.x - RING.x, t.z - RING.z) > -3)], brooks: deep.brooks.map((b) => b.pts) });
  g.userData.depthMarks = deep.solids; // for the probe (pipeline/tools/scenes-probe.js)
  forest.build(TREE_GEOS, leaves, g);
  kit.build(g, own);

  const glows = new Glows(glowSpots, 0xffb050, 1.5);
  g.add(glows.group);
  own.push(glows);

  // Fireflies over the glades.
  const FLIES = 420, base = new Float32Array(FLIES * 3), fpos = new Float32Array(FLIES * 3), ph = new Float32Array(FLIES * 3);
  for (let i = 0; i < FLIES; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * (rimAt(look.rim, a) - 3);
    base[i * 3] = RING.x + Math.cos(a) * d; base[i * 3 + 1] = 0.6 + rnd() * 2.8; base[i * 3 + 2] = RING.z + Math.sin(a) * d;
    ph[i * 3] = rnd() * 6.28; ph[i * 3 + 1] = rnd() * 6.28; ph[i * 3 + 2] = 0.2 + rnd() * 0.35;
  }
  fpos.set(base);
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const dot = canvasTexture(64, (c2, s) => {
    const gr = c2.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c2.fillStyle = gr; c2.fillRect(0, 0, s, s);
  });
  const flyMat = new THREE.PointsMaterial({ map: dot, color: 0xffd070, size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const flies = new THREE.Points(flyGeo, flyMat);
  flies.frustumCulled = false;
  g.add(flies);
  own.push(flyGeo, dot, flyMat);

  return {
    group: g,
    update(_dt, time) {
      glows.update(time);
      deep.update(time);
      for (let i = 0; i < FLIES; i++) {
        const s = ph[i * 3 + 2];
        fpos[i * 3] = base[i * 3] + Math.sin(time * s + ph[i * 3]) * 1.6;
        fpos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(time * s * 1.7 + ph[i * 3 + 1]) * 0.45;
        fpos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(time * s * 0.8 + ph[i * 3]) * 1.6;
      }
      flyGeo.attributes.position.needsUpdate = true;
      flyMat.opacity = 0.7 + 0.2 * Math.sin(time * 2.3);
    },
    dispose() {
      g.removeFromParent();
      g.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); });
      for (const o of own) o.dispose();
    },
  };
}

/**
 * A Wood floor as an arena: its own layout, the wood's stage. The ring is the circle round the whole outline (the walk's box, the checks' grid).
 * `keep`: the floor's spots (keep.ts `floorKeep`), which the depth's props keep clear of.
 */
export function woodGenArena(id: string, name: string, look: WoodLook, keep: { x: number; z: number }[] = []): ArenaDef {
  return { id, name, ring: Math.ceil(Math.max(...look.rim) + 1.5), obstacles: look.pieces.map((p) => p.o), stage: STAGE, hideGround: true, build: () => buildWoodZone(look, keep) };
}

