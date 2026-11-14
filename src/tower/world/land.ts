import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING, canvasTexture, seeded } from '../../arenas/common';
import { Sea } from '../../arenas/real';
import { buildDepth } from './depth';
import type { Kit } from './zone';

/**
 * A sea floor as a place in the world, not a platform in the sea (the user, 2026-11-13: "make it more like real maps, not just like
 * something inside somewhere; make those floors be like real world"), of any outline and size (2026-11-14: "lets make those maps 5 x
 * larger", "it doesnt need to have circular shape it can be whatever"). The walkable ground (flat at y = 0) is the edge of a town by
 * the sea; past its outline the land goes on: a bank, then hills, a cliff along the north, the town's houses on the land side, woods;
 * on the sea side a beach runs down into the sea, with jetties and boats. What stops a walk at the edge is something there: water,
 * the cliff, houses and their walls, a hedge (and, for the walk itself, the zone's invisible edge walls).
 *
 * The outline is `rim`: the walkable radius in each direction round the middle (`RING`), N samples evenly round from +x (the east)
 * towards +z (the south), as `Math.atan2(dz, dx)` counts. A circle is one radius everywhere. Everything here is placed by how far
 * past that outline a point is (`beyond`), so any outline works.
 *
 * Drawn in the heroes' style (blender/arenas/real/STYLE.md): clean forms in the palette's flat colours, a drawn ground (no
 * photographed textures), the drawn sea of the duel harbour. Only the look: cover, places, paths and packs are the zone's.
 */

export interface LandSpec {
  /** The walkable outline: radii round the middle (see above). */
  rim: number[];
  /** The paths, as lines of offsets from the middle (`RING`). */
  paths: [number, number][][];
  /** The places, in world coordinates; `kind` says how its ground is drawn (cobbles for a market, flagstones at a lighthouse...). */
  places: { id: string; kind?: string; x: number; z: number; r: number }[];
  /** The tide's low ground (world coordinates): drawn as tidal flats. */
  flats: { x: number; z: number; rx: number; rz: number; rot?: number }[];
  /** The sea's side: 1 east, -1 west (the land mirrored: the town is then east). */
  mirror?: 1 | -1;
  /** 0 is floor 1's land; another number makes other hills, woods and houses. */
  seed?: number;
  /** A ruin's old floor (offset from the middle), drawn as flagstones. */
  ruin?: { dx: number; dz: number };
  /** The zone's cover (world coordinates): the depth's looks keep off it (depth.ts). */
  cover?: { ax: number; az: number; bx: number; bz: number; r: number }[];
  /** The cover without the outline's invisible edge walls (nothing is drawn there), for the scenes (scenes/sea.ts). */
  sceneCover?: { ax: number; az: number; bx: number; bz: number; r: number }[];
  /** Other things the scenes keep off (world): the harbour file's props, which load later. */
  sceneTaken?: { x: number; z: number; r: number }[];
  /** The floor's spots its looks keep clear of (keep.ts: people, packs, quests, doors...), in world coordinates. */
  keep?: { x: number; z: number }[];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Smooth value noise on a 64 x 64 lattice that wraps; `fbm` is three octaves of it, 0..1. */
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

// --- the palette (sRGB 0..255): the ground's colours, kept a shade duller than the heroes ------------------------------------
const GRASS_A: RGB = [70, 92, 54], GRASS_B: RGB = [86, 106, 60], DRY: RGB = [116, 116, 74];
const SAND: RGB = [184, 166, 126], WET: RGB = [132, 120, 92], UNDER: RGB = [70, 76, 66], FOAM: RGB = [206, 210, 200];
const ROCK: RGB = [94, 90, 88], ROCK_DARK: RGB = [70, 68, 70];
const DIRT: RGB = [118, 92, 64], DIRT_EDGE: RGB = [90, 72, 52], DIRT_MID: RGB = [136, 108, 76];
/** The sea's level (m): the beach runs under it past the rim on the sea's side. */
export const WATER = -0.45;

/** The outline's radius in direction `a` (radians, `atan2(dz, dx)`), smoothly between its samples. */
export function rimAt(rim: number[], a: number) {
  const n = rim.length, t = ((((a / (Math.PI * 2)) % 1) + 1) % 1) * n, i = Math.floor(t) % n, f = t - Math.floor(t);
  const s = f * f * (3 - 2 * f);
  return rim[i] + (rim[(i + 1) % n] - rim[i]) * s;
}

/** The world's shape, from offsets (dx, dz) from the middle. */
export function geography(rim: number[], o: { mirror?: 1 | -1; seed?: number } = {}) {
  const m = o.mirror ?? 1, seed = o.seed ?? 0;
  const fbm = noiseOf(4242 + seed), fbm2 = noiseOf(77 + seed);
  /** How far past the outline (dx, dz) is (negative inside). */
  const beyond = (dx: number, dz: number) => Math.hypot(dx, dz) - rimAt(rim, Math.atan2(dz, dx));
  /** The sea's side: 1 on it (the east, before the mirror), 0 off it; the edges of the sector are the headlands. */
  const seaSide = (dx: number, dz: number) => {
    const r = Math.hypot(dx, dz) || 1;
    return smooth(0.18, 0.5, (m * dx) / r);
  };
  /** The shore wanders 0 to about 3 m past the rim, so from above it is a shore and not the outline. */
  const wander = (dx: number, dz: number) => {
    const a = Math.atan2(dz, m * dx) * 8;
    return Math.max(0, 0.7 + 1.3 * Math.sin(a * 1.4 + 0.7) + 0.9 * Math.sin(a * 3.3 + 2.1));
  };
  /** 0 on land, 1 in the sea. */
  const sea = (dx: number, dz: number) => seaSide(dx, dz) * smooth(-2.5, 2.5, beyond(dx, dz) - wander(dx, dz) - 0.9);
  /** The cliff along the north (screen top), 0..1; not where the sea is. */
  const cliff = (dx: number, dz: number) => smooth(0.35, 0.72, -dz / (Math.hypot(dx, dz) || 1)) * (1 - sea(dx, dz));
  const height = (dx: number, dz: number) => {
    const b = beyond(dx, dz);
    if (b <= 0.5) return 0;
    const s = sea(dx, dz);
    const bank = smooth(0.5, 4, b);
    const hills = (0.5 + 7 * fbm(dx * 0.022 + 3, dz * 0.022 + 7)) * smooth(4, 34, b);
    const c = cliff(dx, dz) * smooth(0.8, 5.5, b) * (7 + 6 * fbm2(dx * 0.07, dz * 0.07));
    const land = 0.4 * bank + Math.max(hills, c);
    const water = -1.2 * smooth(0.3, 3, b) - 2.2 * smooth(3, 24, b);
    return land * (1 - s) + water * s;
  };
  /** How much of a beach (dx, dz) is: on the sea's side, near the shore, on land. */
  const beach = (dx: number, dz: number) => seaSide(dx, dz) * smooth(-11, -3.5, beyond(dx, dz) - wander(dx, dz) - 0.9);
  /** How steep the ground is at (dx, dz): rise over run. */
  const steepness = (dx: number, dz: number) => {
    const e = 0.6;
    return Math.hypot(height(dx + e, dz) - height(dx - e, dz), height(dx, dz + e) - height(dx, dz - e)) / (2 * e);
  };
  /** The ground's own colour (no paths or plazas): grass (on the cliff's top too), a beach, wet sand at the water, rock where it is steep. */
  const color = (dx: number, dz: number, h: number): RGB => {
    const b = beyond(dx, dz), steep = steepness(dx, dz);
    let c = mix(GRASS_A, GRASS_B, fbm(dx * 0.05 + 1, dz * 0.05 + 2));
    c = mix(c, DRY, 0.55 * smooth(0.58, 0.78, fbm2(dx * 0.018 + 11, dz * 0.018 + 4)) + 0.35 * smooth(3, 8, h));
    c = mix(c, SAND, beach(dx, dz) * (1 - smooth(6, 20, b) * (1 - sea(dx, dz))));
    if (h < 0) {
      c = mix(c, WET, smooth(-0.05, -0.3, h));
      c = mix(c, FOAM, 0.75 * (smooth(WATER - 0.02, WATER + 0.06, h) * (1 - smooth(WATER + 0.12, WATER + 0.22, h))));
      c = mix(c, UNDER, smooth(WATER - 0.05, WATER - 0.6, h));
    }
    c = mix(c, mix(ROCK, ROCK_DARK, fbm2(dx * 0.15, dz * 0.15)), smooth(0.55, 1.1, steep));
    return c;
  };
  return { beyond, seaSide, sea, cliff, height, beach, color, fbm, fbm2, steepness, m };
}
export type Geo = ReturnType<typeof geography>;

/** The painted middle: the ground's colour, then the tidal flats, the paths and the plazas on top. `L` metres across. */
function paint(spec: LandSpec, geo: Geo, L: number) {
  // About 15 to 18 pixels a metre whatever the size (floor 1's was 18): a bigger zone takes the bigger canvas.
  const size = L > 140 ? 4096 : 2048;
  return canvasTexture(size, (g) => {
    const ppm = size / L, c = size / 2, rnd = seeded(31 + (spec.seed ?? 0));
    const X = (dx: number) => c + dx * ppm, Z = (dz: number) => c + dz * ppm;
    // The ground's colour, worked out on a coarse grid and drawn up smoothly: soft edges, like paint.
    const n = Math.round(L > 140 ? L : L * 2), low = document.createElement('canvas');
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
    // Grass in patches: soft dabs a little lighter or darker, only where it is grass.
    const dabs = Math.round(1400 * (L / 112) ** 2);
    for (let k = 0; k < dabs; k++) {
      const dx = (rnd() - 0.5) * L, dz = (rnd() - 0.5) * L;
      if (geo.beach(dx, dz) > 0.35 || geo.height(dx, dz) < -0.05 || geo.cliff(dx, dz) > 0.3 && geo.beyond(dx, dz) > 0) continue;
      const rad = (1.2 + rnd() * 3.5) * ppm, light = rnd() < 0.5, grad = g.createRadialGradient(X(dx), Z(dz), 0, X(dx), Z(dz), rad);
      grad.addColorStop(0, light ? 'rgba(120,140,80,0.16)' : 'rgba(40,58,36,0.16)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(X(dx) - rad, Z(dz) - rad, rad * 2, rad * 2);
    }
    // The tidal flats (the tide's low ground): wet sand with a sheen of water left in it.
    for (const f of spec.flats) {
      const dx = f.x - RING.x, dz = f.z - RING.z;
      g.save();
      g.translate(X(dx), Z(dz));
      g.rotate(f.rot ?? 0);
      g.scale(1, f.rz / f.rx);
      const rr = (f.rx + 2) * ppm, wet = g.createRadialGradient(0, 0, 0, 0, 0, rr);
      wet.addColorStop(0, 'rgba(118,110,86,1)');
      wet.addColorStop(0.7, 'rgba(126,116,90,0.95)');
      wet.addColorStop(1, 'rgba(126,116,90,0)');
      g.fillStyle = wet;
      g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 7; k++) {
        const a = rnd() * Math.PI * 2, d = rnd() * f.rx * 0.65 * ppm, pr = (0.8 + rnd() * 1.6) * ppm;
        g.fillStyle = 'rgba(86,124,132,0.42)';
        g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, pr * 1.6, pr, rnd() * 3, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    // The paths: dirt roads with a soft edge and a lighter middle where feet go.
    g.lineCap = g.lineJoin = 'round';
    const rgba = (c3: RGB, a: number) => `rgba(${c3[0]},${c3[1]},${c3[2]},${a})`;
    for (const path of spec.paths) {
      const trace = () => {
        g.beginPath();
        path.forEach(([dx, dz], i) => (i ? g.lineTo(X(dx), Z(dz)) : g.moveTo(X(dx), Z(dz))));
      };
      for (const [w, col, a] of [[4.8, DIRT_EDGE, 0.35], [4.1, DIRT_EDGE, 0.7], [3.5, DIRT, 1], [1.7, DIRT_MID, 0.55]] as [number, RGB, number][]) {
        g.strokeStyle = rgba(col, a);
        g.lineWidth = w * ppm;
        trace();
        g.stroke();
      }
      // pebbles along it
      for (let i = 1; i < path.length; i++) {
        const [ax, az] = path[i - 1], [bx, bz] = path[i], len = Math.hypot(bx - ax, bz - az);
        for (let s = 0; s < len * 2; s++) {
          const t = rnd(), side = (rnd() - 0.5) * 3.4, nx = -(bz - az) / len, nz = (bx - ax) / len;
          g.fillStyle = rnd() < 0.5 ? 'rgba(150,128,96,0.8)' : 'rgba(84,66,48,0.7)';
          g.beginPath(); g.arc(X(ax + (bx - ax) * t + nx * side), Z(az + (bz - az) * t + nz * side), (0.06 + rnd() * 0.08) * ppm, 0, Math.PI * 2); g.fill();
        }
      }
    }
    // The plazas, each as the place it is.
    const disc = (dx: number, dz: number, r: number, inner: string, edge = 1.5) => {
      const grad = g.createRadialGradient(X(dx), Z(dz), 0, X(dx), Z(dz), (r + edge) * ppm);
      grad.addColorStop(0, inner);
      grad.addColorStop(r / (r + edge), inner);
      grad.addColorStop(1, inner.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = grad;
      g.beginPath(); g.arc(X(dx), Z(dz), (r + edge) * ppm, 0, Math.PI * 2); g.fill();
    };
    const stones = (dx: number, dz: number, r: number, size: number, base: RGB, joint: string) => {
      g.save();
      g.beginPath(); g.arc(X(dx), Z(dz), r * ppm, 0, Math.PI * 2); g.clip();
      g.fillStyle = joint;
      g.fillRect(X(dx - r), Z(dz - r), 2 * r * ppm, 2 * r * ppm);
      for (let z = dz - r; z < dz + r; z += size) for (let x = dx - r + ((((z - dz) / size) | 0) % 2) * size * 0.5; x < dx + r; x += size) {
        const t = 0.86 + 0.24 * rnd();
        g.fillStyle = `rgb(${Math.round(base[0] * t)},${Math.round(base[1] * t)},${Math.round(base[2] * t)})`;
        const inset = size * 0.09;
        g.beginPath();
        g.roundRect(X(x) + inset * ppm, Z(z) + inset * ppm, (size - 2 * inset) * ppm, (size - 2 * inset) * ppm, size * 0.22 * ppm);
        g.fill();
      }
      g.restore();
      g.strokeStyle = 'rgba(60,54,48,0.55)';
      g.lineWidth = 0.14 * ppm;
      g.beginPath(); g.arc(X(dx), Z(dz), r * ppm, 0, Math.PI * 2); g.stroke();
    };
    for (const p of spec.places) {
      const dx = p.x - RING.x, dz = p.z - RING.z;
      switch (p.kind ?? p.id) {
        case 'camp': disc(dx, dz, p.r - 0.5, rgba(DIRT, 0.9), 2); break; // packed earth round the fire
        case 'market': case 'village': stones(dx, dz, p.r, 0.7, [132, 124, 110], '#4e4840'); break; // a town square's cobbles
        case 'lighthouse': case 'beacon': stones(dx, dz, p.r - 1.5, 1.4, [126, 122, 114], '#55524e'); break; // flagstones at its foot
        case 'fort': case 'chapel': stones(dx, dz, p.r - 1, 1.2, [118, 114, 106], '#4c4944'); break;
        case 'caves': disc(dx, dz, p.r, 'rgba(96,90,84,0.9)', 2.5); break; // gravel
        case 'wreck': case 'shipyard': case 'saltworks': disc(dx, dz, p.r, 'rgba(150,136,104,0.55)', 3); break; // trodden sand
      }
    }
    if (spec.ruin) stones(spec.ruin.dx, spec.ruin.dz + 0.5, 6.5, 1.2, [118, 114, 106], '#4c4944');
  });
}

/** The dressing's colours (the heroes' palette, STYLE.md), each a part's one flat colour. */
const PALETTE = {
  wall: '#b4ab94', stone: '#4e4c4c', capstone: '#64605a', boulder: '#383c46', wood: '#4a3220', plank: '#6b4226', lacquer: '#1d1b21',
  wine: '#5e1a28', slate: '#3a3f4c', teal: '#2b5560', cream: '#d8cfb4', rock: '#615d5a', sail: '#d8cfb4', gold: '#c9a24a',
  rope: '#b89a5a', salt: '#e2dccc', leaf: '#4a6638', cloth: '#b9b2a0',
  /** Iron drawn matte (the scenes' anchors, chains, a spade): a shade lighter than the heroes' iron, to read on grass. */
  iron: '#4d525e',
  /** Sailcloth for the scenes' big flat cloths (a tent down, a sail torn off, a catch laid out): duller than cream so it never glares. */
  canvas: '#a39a82',
  /** Gold drawn matte, in the merged dressing (the scenes' trims: no cells of the polished gold of their own). */
  brass: '#b8923e',
} as const;
export type Key = keyof typeof PALETTE;

/**
 * The dressing past the rim, merged: every matte part carries its colour in its vertices, so a square of ground `CELL` m across is
 * one mesh whatever the colours (out of sight, not drawn). Gold, the one polished metal, goes to the zone's kit with its own material.
 * (A material per colour per square drew 46 more things a frame: 2.7 ms more on the phone profile.)
 */
const CELL = 24;
export class Dress {
  private cells = new Map<string, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();
  private colors = new Map<Key, THREE.Color>();
  constructor(private kit: Kit, private gold: THREE.Material) {}
  add(key: Key, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0): this {
    if (key === 'gold') { this.kit.add(this.gold, geo, x, y, z, yaw, sx, sy, sz, tilt); return this; }
    let col = this.colors.get(key);
    if (!col) this.colors.set(key, (col = new THREE.Color(PALETTE[key])));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    g.computeBoundingBox();
    const ctr = g.boundingBox!.getCenter(new THREE.Vector3()), key2 = `${Math.floor(ctr.x / CELL)}:${Math.floor(ctr.z / CELL)}`;
    let cell = this.cells.get(key2);
    if (!cell) this.cells.set(key2, (cell = []));
    cell.push(g);
    return this;
  }
  build(into: THREE.Group, own: { dispose(): void }[]) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
    own.push(material);
    for (const geos of this.cells.values()) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = mesh.receiveShadow = true;
      into.add(mesh);
      own.push(merged);
    }
    this.cells.clear();
  }
}

/** A gabled house standing at (x, z) (world), facing `yaw`, on ground at height `y`. */
function house(dress: Dress, x: number, y: number, z: number, yaw: number, w: number, d: number, h: number, roof: Key, rnd: () => number) {
  const box = (bw: number, bh: number, bd: number) => new THREE.BoxGeometry(bw, bh, bd).translate(0, bh / 2, 0);
  const at = (lx: number, lz: number) => ({ x: x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z: z - Math.sin(yaw) * lx + Math.cos(yaw) * lz });
  dress.add('stone', box(w + 0.3, 0.5, d + 0.3), x, y - 0.3, z, yaw); // a plinth that also hides a slope under it
  dress.add('wall', box(w, h, d), x, y, z, yaw);
  // the gables: a prism the wall's colour, then two roof slabs over it
  const rh = w * 0.42, gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rh)]);
  const prism = new THREE.ExtrudeGeometry(gable, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
  dress.add('wall', prism, x, y + h, z, yaw);
  const slope = Math.hypot(w / 2 + 0.35, rh + 0.25), ang = Math.atan2(rh + 0.25, w / 2 + 0.35);
  for (const s of [-1, 1]) {
    const slab = new THREE.BoxGeometry(slope, 0.18, d + 0.7).translate(0, 0.09, 0).rotateZ(-s * ang).translate(s * (w / 4 + 0.05), rh / 2 + 0.02, 0);
    dress.add(roof, slab, x, y + h - 0.1, z, yaw);
  }
  dress.add('gold', new THREE.BoxGeometry(0.12, 0.12, d + 0.75).translate(0, rh + 0.22, 0), x, y + h, z, yaw); // the ridge, gilt
  // a chimney, a door and windows on the side that faces the middle (+z in the house's own frame)
  const ch = at(w * 0.22, -d * 0.2);
  dress.add('stone', box(0.6, rh + 1.2, 0.6), ch.x, y + h, ch.z, yaw);
  const door = at(-w * 0.18, d / 2 + 0.02);
  dress.add('wood', box(1.0, 1.9, 0.08), door.x, y, door.z, yaw);
  for (const lx of [w * 0.22, -w * 0.38]) {
    if (Math.abs(lx + w * 0.18) < 0.9) continue;
    const win = at(lx, d / 2 + 0.02);
    dress.add('lacquer', box(0.8, 0.9, 0.06), win.x, y + 1.3, win.z, yaw).add('gold', box(0.92, 0.07, 0.08), win.x, y + 1.25, win.z, yaw);
  }
  if (h > 4 && rnd() < 0.7) for (const lx of [-w * 0.2, w * 0.2]) {
    const win = at(lx, d / 2 + 0.02);
    dress.add('lacquer', box(0.7, 0.8, 0.06), win.x, y + h - 1.5, win.z, yaw);
  }
}

/** Builds the land, the sea and what stands beyond the rim. Its meshes go into `into`; its geometry for merging into `kit`. */
export function buildLand(spec: LandSpec, kit: Kit, into: THREE.Group, own: { dispose(): void }[]) {
  const seed = spec.seed ?? 0, geo = geography(spec.rim, { mirror: spec.mirror, seed }), m = geo.m, rnd = seeded(2024 + seed);
  const rmax = Math.max(...spec.rim), rmean = spec.rim.reduce((s, r) => s + r, 0) / spec.rim.length;
  const mat = (hex: string, rough = 0.8, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const mm = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, ...o });
    own.push(mm);
    return mm;
  };
  const dress = new Dress(kit, mat('#c9a24a', 0.32, { metalness: 0.85 }));
  /** A point `b` m past the outline in direction `a` (radians), as an offset. */
  const out = (a: number, b: number) => { const r = rimAt(spec.rim, a) + b; return { dx: Math.cos(a) * r, dz: Math.sin(a) * r }; };
  /** The direction `a` (radians) of a canonical bearing: `t` turns from the sea's side (0) round through the north (-0.25). */
  const dir = (t: number) => (m === 1 ? t * Math.PI * 2 : Math.PI - t * Math.PI * 2);

  // --- the ground ---------------------------------------------------------------------------------------------------
  const SIZE = Math.max(420, 2 * (rmax + 160)), SEG = Math.round(SIZE / 2.1), L = 2 * (rmax + 8);
  const plane = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
  const pos = plane.attributes.position, n = pos.count;
  for (let i = 0; i < n; i++) pos.setY(i, geo.height(pos.getX(i), pos.getZ(i)));
  plane.computeVertexNormals();
  const colors = new Float32Array(n * 4), uv = plane.attributes.uv, tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const dx = pos.getX(i), dz = pos.getZ(i), h = pos.getY(i);
    const c = geo.color(dx, dz, h);
    tmp.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
    colors[i * 4] = tmp.r; colors[i * 4 + 1] = tmp.g; colors[i * 4 + 2] = tmp.b;
    // the painted map inside (and a little past the outline), the vertex colour outside; never past the canvas's edge
    const inside = 1 - smooth(4.5, 7.5, geo.beyond(dx, dz)), onCanvas = Math.abs(dx) < L / 2 - 1 && Math.abs(dz) < L / 2 - 1 ? 1 : 0;
    colors[i * 4 + 3] = inside * onCanvas;
    uv.setXY(i, dx / L + 0.5, dz / L + 0.5); // the canvas's first row is the north (flipY off)
  }
  plane.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  const map = paint(spec, geo, L);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.flipY = false;
  map.anisotropy = 4;
  const groundMat = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.92, envMapIntensity: 0.15 });
  // The map is used where the vertex's alpha says (the middle), the vertex's colour elsewhere: no tint of one by the other.
  groundMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', 'vec4 texelColor = texture2D( map, vMapUv );\n diffuseColor.rgb = mix( vColor.rgb, texelColor.rgb, vColor.a );')
      .replace('#include <color_fragment>', '');
  };
  groundMat.customProgramCacheKey = () => 'tower-land-ground';
  const ground = new THREE.Mesh(plane, groundMat);
  ground.position.set(RING.x, 0, RING.z);
  ground.receiveShadow = true;
  into.add(ground);
  own.push(plane, map, groundMat);

  // --- the sea --------------------------------------------------------------------------------------------------------
  // Under the land everywhere (its own foam ring is hidden far inside); seen where the beach runs below it.
  const sea = new Sea({ y: WATER, inner: 20, deep: 0x1e4a5e, sky: 0x9cc0d4, band: 0x5f9bb0, glint: 0xfff2d4, sun: new THREE.Vector3(0.6, 0.45, 0.3), foam: 0xe8ecec });
  into.add(sea.mesh);
  own.push(sea);

  const W = (dx: number, dz: number) => ({ x: RING.x + dx, z: RING.z + dz });
  const free: { x: number; z: number; r: number }[] = []; // ground taken by houses and the jetties: no trees there
  const taken = (dx: number, dz: number, pad: number) => free.some((f) => Math.hypot(f.x - dx, f.z - dz) < f.r + pad);

  // --- the town: houses along the land's side, past the outline -------------------------------------------------------------
  const roofs: Key[] = ['wine', 'slate', 'teal', 'wine', 'slate'];
  const houses = Math.round(14 * (rmean / 48));
  for (let k = 0, made = 0; k < houses * 6 && made < houses; k++) {
    // the land's side: from the south-west round to the north-west (before the mirror), not the cliff, not the sea
    const a = dir(0.5 + (rnd() - 0.5) * 0.36), o = out(a, 3.5 + rnd() * 18);
    if (geo.sea(o.dx, o.dz) > 0.05 || geo.cliff(o.dx, o.dz) > 0.3 || geo.beach(o.dx, o.dz) > 0.3 || taken(o.dx, o.dz, 4)) continue;
    const w = 4.6 + rnd() * 1.2, d = w * (0.75 + rnd() * 0.2), h = 3.2 + rnd() * 1.8, y = geo.height(o.dx, o.dz), p = W(o.dx, o.dz);
    house(dress, p.x, y, p.z, Math.atan2(-o.dx, -o.dz), w, d, h, roofs[made % roofs.length], rnd);
    free.push({ x: o.dx, z: o.dz, r: w * 0.85 });
    made++;
  }

  // --- the rim on land: a dry-stone wall where the town is, hedges elsewhere; the cliff and the water need nothing ----------------
  const hedge: { x: number; z: number; s: number }[] = [];
  const around = 2 * Math.PI * rmean;
  for (let k = 0; k < around / 3; k++) {
    const a = (k / (around / 3)) * Math.PI * 2, o = out(a, 1.3 + 0.9 * Math.sin(a * 5 + 1) + 0.5 * Math.sin(a * 13));
    if (geo.sea(o.dx, o.dz) > 0.2 || geo.cliff(o.dx, o.dz) > 0.25) continue;
    const town = Math.cos(a) * m < -0.42; // the land's side, where the houses are
    if (town) {
      if (rnd() < 0.15) continue; // a gap where it has fallen
      const p = W(o.dx, o.dz), y = geo.height(o.dx, o.dz), r0 = rimAt(spec.rim, a), r1 = rimAt(spec.rim, a + 0.02);
      // along the outline: its tangent from two samples of it
      const tx = Math.cos(a + 0.02) * r1 - Math.cos(a) * r0, tz = Math.sin(a + 0.02) * r1 - Math.sin(a) * r0;
      const yaw = Math.atan2(tx, tz) + Math.PI / 2 + (rnd() - 0.5) * 0.15;
      dress.add('stone', new THREE.BoxGeometry(2.8, 0.7, 0.55).translate(0, 0.35, 0), p.x, y - 0.05, p.z, yaw);
      dress.add('capstone', new THREE.BoxGeometry(2.85, 0.12, 0.62).translate(0, 0.06, 0), p.x, y + 0.62, p.z, yaw);
    } else for (let j = 0; j < 2; j++) hedge.push({ x: o.dx + (rnd() - 0.5) * 1.2, z: o.dz + (rnd() - 0.5) * 1.2, s: 0.9 + rnd() * 0.6 });
  }

  // --- jetties and boats, on the sea's side ------------------------------------------------------------------------------
  const jetties = Math.max(2, Math.round(2 * (rmean / 48)));
  for (let j = 0; j < jetties; j++) {
    // straight out from the shore, square to the outline's direction
    const a = dir(((j + 0.5) / jetties - 0.5) * 0.26), len = 13 + rnd() * 7, ux = Math.cos(a), uz = Math.sin(a), r0 = rimAt(spec.rim, a) + 1.5;
    for (let s = 0; s <= len; s += 2.6) for (const side of [-1.1, 1.1]) {
      const p = W(ux * (r0 + s) - uz * side, uz * (r0 + s) + ux * side);
      dress.add('wood', new THREE.CylinderGeometry(0.16, 0.18, 2.6, 8).translate(0, 0.3, 0), p.x, WATER - 1, p.z);
    }
    const mid = W(ux * (r0 + len / 2), uz * (r0 + len / 2)), yaw = Math.atan2(ux, uz);
    dress.add('plank', new THREE.BoxGeometry(2.6, 0.22, len + 1), mid.x, 0.35, mid.z, yaw);
    for (const side of [-1.3, 1.3]) dress.add('gold', new THREE.BoxGeometry(0.1, 0.08, len + 1), mid.x - uz * side, 0.5, mid.z + ux * side, yaw);
    for (let s = 0; s < len; s += 3.5) free.push({ x: ux * (r0 + s), z: uz * (r0 + s), r: 2 });
  }
  const boatsAt: { x: number; z: number; r: number }[] = []; // for the scenes to keep off (scenes/sea.ts)
  const boat = (a: number, b: number, yaw: number, mast: boolean, paint: Key) => {
    const o = out(a, b), p = W(o.dx, o.dz);
    boatsAt.push({ x: p.x, z: p.z, r: 4 });
    const hull = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.3, 0.8, 3.6);
    dress.add(paint, hull, p.x, WATER + 0.5, p.z, yaw).add('wood', new THREE.BoxGeometry(2.3, 0.12, 6.2), p.x, WATER + 0.48, p.z, yaw);
    dress.add('gold', new THREE.TorusGeometry(1, 0.06, 6, 24).scale(1.3, 3.6, 1).rotateX(Math.PI / 2), p.x, WATER + 0.52, p.z, yaw);
    if (mast) {
      dress.add('wood', new THREE.CylinderGeometry(0.1, 0.13, 7, 8).translate(0, 3.5, 0), p.x, WATER + 0.5, p.z);
      dress.add('sail', new THREE.PlaneGeometry(2.6, 4.4).translate(0, 3.9, 0.9), p.x, WATER + 0.5, p.z, yaw + 0.25);
    }
  };
  const boats = Math.max(4, Math.round(4 * (rmean / 48)));
  const paints: Key[] = ['wine', 'teal', 'lacquer'];
  for (let k = 0; k < boats; k++) boat(dir((rnd() - 0.5) * 0.3), 13 + rnd() * 20, rnd() * 6.28, rnd() < 0.7, paints[k % paints.length]);
  // Stacks of rock out at sea, far off.
  for (let k = 0; k < 9; k++) {
    const o = out(dir((rnd() - 0.5) * 0.36), 35 + rnd() * 70), s = 2 + rnd() * 4, p = W(o.dx, o.dz);
    if (geo.sea(o.dx, o.dz) < 0.8) continue;
    dress.add('rock', new THREE.ConeGeometry(s, 7 + rnd() * 10, 7).translate(0, 3.5, 0), p.x, WATER - 1, p.z, rnd() * 3);
  }
  // Fallen rock at the cliff's foot: the floor's own rocks (faceted, dark), sat into the ground.
  const boulders = Math.round(26 * (rmean / 48));
  for (let k = 0; k < boulders; k++) {
    const o = out(-Math.PI / 2 + (rnd() - 0.5) * 2.2, 1.3 + rnd() * 1.6);
    if (geo.sea(o.dx, o.dz) > 0.1 || geo.cliff(o.dx, o.dz) < 0.25) continue;
    const s = 0.5 + rnd() * 1.1, p = W(o.dx, o.dz);
    dress.add('boulder', new THREE.IcosahedronGeometry(1, 0), p.x, geo.height(o.dx, o.dz) + s * 0.15, p.z, rnd() * 6, s * 1.3, s * 0.8, s * 1.1, (rnd() - 0.5) * 0.4);
  }

  // --- trees and bushes: instanced, the woods north and south and on the hills ----------------------------------------
  const conifer: THREE.Matrix4[] = [], broad: THREE.Matrix4[] = [], bush: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), mtx = (x: number, y: number, z: number, s: number, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, rnd() * 6.28).clone(), new THREE.Vector3(s, sy, s));
  const treeMax = Math.round(520 * Math.min(2, rmean / 48));
  for (let k = 0; k < treeMax * 5 && conifer.length + broad.length < treeMax; k++) {
    const o = out(rnd() * Math.PI * 2, 3 + Math.pow(rnd(), 1.3) * 120), dx = o.dx, dz = o.dz;
    if (geo.sea(dx, dz) > 0.05 || geo.beach(dx, dz) > 0.4 || taken(dx, dz, 2.5)) continue;
    const h = geo.height(dx, dz);
    if (h < 0.1) continue;
    // woods are patchy: thick where the noise says, thin elsewhere; the north's cliff top is pine, the south broadleaf
    const wood = geo.fbm2(dx * 0.03 + 21, dz * 0.03 + 5);
    if (rnd() > smooth(0.38, 0.62, wood) + 0.08) continue;
    const p = W(dx, dz), north = dz < -10, s = 0.75 + rnd() * 0.6;
    // nothing tall on the near side of the camera: the south rim gets low, round trees
    const near = dz > 0 && Math.abs(dx) < Math.abs(dz) && geo.beyond(dx, dz) < 14;
    if (north || (rnd() < 0.35 && !near)) conifer.push(mtx(p.x, h - 0.2, p.z, s * (near ? 0.6 : 1)));
    else broad.push(mtx(p.x, h - 0.2, p.z, s * (near ? 0.7 : 1)));
  }
  for (const b of hedge) {
    const p = W(b.x, b.z);
    bush.push(mtx(p.x, geo.height(b.x, b.z) - 0.1, p.z, b.s, b.s * 0.75));
  }
  const bushes = Math.round(160 * (rmean / 48));
  for (let k = 0; k < bushes; k++) {
    const o = out(rnd() * Math.PI * 2, 1.5 + rnd() * 10);
    if (geo.sea(o.dx, o.dz) > 0.05 || geo.cliff(o.dx, o.dz) > 0.3 || taken(o.dx, o.dz, 1)) continue;
    const p = W(o.dx, o.dz), s = 0.6 + rnd() * 0.7;
    bush.push(mtx(p.x, geo.height(o.dx, o.dz) - 0.1, p.z, s, s * 0.7));
  }
  // Only what stands near the walkable ground casts a shadow (the sun's shadow box follows the hero; the far woods would cost the
  // shadow pass their triangles for nothing).
  const nearRim = (mm: THREE.Matrix4) => geo.beyond(mm.elements[12] - RING.x, mm.elements[14] - RING.z) < 26;
  const inst = (geom: THREE.BufferGeometry, material: THREE.Material, list: THREE.Matrix4[], shadow = true) => {
    for (const part of shadow ? [list.filter(nearRim), list.filter((mm) => !nearRim(mm))] : [list]) {
      if (!part.length) continue;
      const im = new THREE.InstancedMesh(geom, material, part.length);
      part.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = shadow && nearRim(part[0]);
      im.receiveShadow = true;
      im.computeBoundingSphere();
      into.add(im);
    }
    own.push(geom);
  };
  const tint = (g: THREE.BufferGeometry, hex: string) => {
    const nn = (g.index ? g.toNonIndexed() : g), col = new THREE.Color(hex), c = new Float32Array(nn.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
    for (const k of Object.keys(nn.attributes)) if (k !== 'position' && k !== 'normal') nn.deleteAttribute(k);
    nn.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return nn;
  };
  const trunk = () => tint(new THREE.CylinderGeometry(0.2, 0.32, 2.4, 6).translate(0, 1.2, 0), PALETTE.wood);
  const pineGeo = mergeGeometries([trunk(), tint(new THREE.ConeGeometry(2.3, 3.4, 9).translate(0, 3.2, 0), '#2c4634'),
    tint(new THREE.ConeGeometry(1.8, 3.0, 9).translate(0, 4.8, 0), '#2c4634'), tint(new THREE.ConeGeometry(1.2, 2.6, 9).translate(0, 6.3, 0), '#2c4634')])!;
  const broadGeo = mergeGeometries([trunk(), tint(new THREE.IcosahedronGeometry(2.4, 1).scale(1, 0.85, 1).translate(0, 4.2, 0), '#4a6638'),
    tint(new THREE.IcosahedronGeometry(1.6, 1).translate(1.2, 3.4, 0.6), '#56703e')])!;
  const bushGeo = tint(new THREE.IcosahedronGeometry(1, 1).translate(0, 0.6, 0), '#40593a');
  const leaves = mat('#ffffff', 0.85, { vertexColors: true });
  inst(pineGeo, leaves, conifer);
  inst(broadGeo, leaves, broad);
  inst(bushGeo, leaves, bush);

  // The depth: roads, meadows, places dressed as what they are, the far sea (depth.ts).
  const depth = buildDepth({ spec, geo, dress, into, own, rnd, ground: { map, L }, cover: spec.cover ?? [], taken: [...free.map((f) => ({ x: RING.x + f.x, z: RING.z + f.z, r: f.r })), ...boatsAt,
    ...[...conifer, ...broad].map((mm) => ({ x: mm.elements[12], z: mm.elements[14], r: 2.6, tree: true })), ...(spec.sceneTaken ?? []), ...bush.map((mm) => ({ x: mm.elements[12], z: mm.elements[14], r: 0.7 }))] });
  dress.build(into, own);

  return {
    /** The lights of the depth (lanterns, torches, the island's light), for the zone's glows. */
    glows: depth.glows,
    update(time: number) {
      sea.update(time);
      depth.update(time);
    },
  };
}
