import * as THREE from 'three';
import { RING, canvasTexture, seeded } from '../../arenas/common';
import { Glows } from '../../arenas/real';
import type { ArenaDef, ArenaStage } from '../../arenas/types';
import { rimAt } from './land';
import { buildWarDepth } from './warDepth';
import { Kit, type Piece } from './zone';

/**
 * The War chapter's zones (floors 41 to 50; pipeline/designs/tower-50.md), drawn from a layout: a broad field between low hills where
 * two ghost armies never stop fighting, five times floor 1's ground, of any outline. Floor 41's look (the Fallen Battlefield's,
 * src/arenas/battlefield.ts, and f45/banners-zone.ts) at the new size: trodden earth and tired grass, old paved roads, paved rounds with
 * a brass ring at the places, the two armies' colours (crimson and azure) on cloth only. Past the outline the world goes on (the user,
 * 2026-11-13: "make those floors be like real world"): an earth bank with a hedge of sharpened stakes where a walk stops, rolling
 * grassland, the enemy's ridge in the north beyond the siege line, low ground in the south (the camera's side). What stands far off
 * (the armies' camps, watch fires, smoke, crows) is the depth's (`warDepth.ts`).
 *
 * Drawn in the heroes' style (blender/arenas/real/STYLE.md, docs/ART_BIBLE.md): clean forms (boxes, turned forms, cones), a flat colour
 * a part, the palette's wood, lacquer, cream and gold, steel, and the chapter's own colours (crimson and azure cloth); the ground is
 * drawn; braziers and lanterns the only glow. Only the look: the cover, places, roads and packs are the floor's (gen/war.ts).
 */

/** The zone's own looks for pieces whose `Look` (zone.ts) is a general one: by the piece's index in `pieces`. */
export type WarKind =
  | 'pavilion' | 'whitetent' | 'drum' | 'barrel' | 'hay' | 'sacks' | 'cot' | 'shieldpile' | 'rubble'
  | 'palisade' | 'gatetower' | 'standard' | 'shield' | 'fence' | 'catapult' | 'stake' | 'wagon' | 'siegetower'
  | 'farmwall' | 'ruinwall' | 'ruintower' | 'mill';
/** What stands but does not block (none yet; the generator's frame carries it). */
export interface WarDecor { kind: 'arch'; x: number; z: number; yaw: number; s: number }

/** What a War zone is drawn from (a type, not an interface: it is a `ChapterLook`, gen/types.ts). */
export type WarLook = {
  /** The walkable outline: radii round the middle, from +x (east) towards +z (south), as land.ts's `rimAt` reads it. */
  rim: number[];
  pieces: Piece[];
  kinds: [number, WarKind][];
  decor: WarDecor[];
  /** The places, in the world; `kind` says how the ground is drawn and how the depth dresses it. */
  places: { id: string; kind?: string; x: number; z: number; r: number }[];
  /** The roads, as lines of offsets from the middle. */
  paths: [number, number][][];
  /** The side the crimson army camps on (-1 west, 1 east): its pavilions and far camps fly crimson, the other side's azure. */
  crimson: 1 | -1;
  /** The siege line across the north (world): its z and its ends. */
  line: { z: number; w: number; e: number };
  seed: number;
};

/** A grey evening after a day of battle: warm low sun through smoke, cool rim; brighter than the duel arena's night, the field is large. */
const STAGE: ArenaStage = {
  background: 0x6c6a72, zenith: 0x3c4658, horizon: 0xa6948a, glow: 0xe09a64, stars: 0,
  fog: 0x80787a, fogNear: 70, fogFar: 250,
  hemiSky: 0xccd0dc, hemiGround: 0x3e3628, hemiIntensity: 0.82,
  sun: 0xffcc9c, sunIntensity: 1.55, rim: 0x90aade, rimIntensity: 0.5,
};

/** The depth (warDepth.ts) can be switched off for an A/B of its cost: `globalThis.__warDepth = false` before a zone is built. */
const DEPTH = true;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Smooth value noise on a 64 x 64 lattice that wraps; three octaves, 0..1. */
export function noiseOf(seed: number) {
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

// --- the palette (sRGB): the ground's colours, a shade duller than the heroes -------------------------------------------------
const EARTH: RGB = [104, 88, 70], MUD: RGB = [74, 62, 52], GRASS: RGB = [88, 94, 62], GRASS_DRY: RGB = [116, 108, 74], SCORCH: RGB = [54, 48, 44];
const BANK: RGB = [96, 80, 62], HILL: RGB = [82, 90, 60], HILL_FAR: RGB = [92, 96, 76];
const SLAB: RGB = [96, 98, 104], JOINT = '#2a2a2e', BRASS = '#9a7a38';

/** The world's shape past the outline, from offsets (dx, dz). */
export function battlefield(rim: number[], seed: number) {
  const fbm = noiseOf(4150 + seed), fbm2 = noiseOf(171 + seed);
  const beyond = (dx: number, dz: number) => Math.hypot(dx, dz) - rimAt(rim, Math.atan2(dz, dx));
  /** 1 in the north (the enemy's ridge), 1 in the south (the camera's side: kept low). */
  const north = (dx: number, dz: number) => smooth(0.25, 0.8, -dz / (Math.hypot(dx, dz) || 1));
  const south = (dx: number, dz: number) => smooth(0.15, 0.65, dz / (Math.hypot(dx, dz) || 1));
  const height = (dx: number, dz: number) => {
    const b = beyond(dx, dz);
    if (b <= 0.3) return 0;
    const so = south(dx, dz), no = north(dx, dz);
    // an earth bank where the walk stops, then rolling grassland rising to hills; the enemy's ridge in the north; low in the south
    const bank = 0.9 * smooth(0.3, 2.6, b) - 0.4 * smooth(2.6, 6, b);
    const roll = (1.5 + 6 * fbm(dx * 0.013 + 3, dz * 0.013 + 7)) * smooth(5, 46, b);
    const hills = (4 + 16 * fbm2(dx * 0.008, dz * 0.008)) * smooth(40, 120, b);
    const ridge = no * (smooth(14, 60, b) * (10 + 8 * fbm(dx * 0.02, dz * 0.02 + 4)));
    return bank + (roll + hills) * (1 - 0.75 * so) + ridge;
  };
  const steepness = (dx: number, dz: number) => {
    const e = 0.7;
    return Math.hypot(height(dx + e, dz) - height(dx - e, dz), height(dx, dz + e) - height(dx, dz - e)) / (2 * e);
  };
  /** The ground's own colour: tired grass and earth in patches; the bank earth; far hills a paler green in the haze; slopes earth. */
  const color = (dx: number, dz: number, h: number): RGB => {
    const b = beyond(dx, dz);
    let c = mix(GRASS, GRASS_DRY, fbm(dx * 0.05 + 1, dz * 0.05 + 2));
    c = mix(c, EARTH, 0.55 * smooth(0.5, 0.75, fbm2(dx * 0.03 + 11, dz * 0.03 + 4)));
    c = mix(c, BANK, smooth(0.2, 1.5, b) * (1 - smooth(4, 9, b)));
    c = mix(c, HILL, smooth(8, 30, b) * 0.6);
    c = mix(c, HILL_FAR, smooth(60, 160, b) * 0.5);
    c = mix(c, EARTH, smooth(0.35, 0.8, steepness(dx, dz)) * smooth(0.5, 2, h) * 0.6);
    return c;
  };
  return { beyond, north, south, height, steepness, color, fbm, fbm2 };
}
export type Battlefield = ReturnType<typeof battlefield>;

/** The painted middle: the ground's colour, trodden patches, mud and scorch, the paved roads, the places' rounds. `L` metres across. */
function paint(look: WarLook, geo: Battlefield, L: number) {
  const size = L > 140 ? 4096 : 2048;
  return canvasTexture(size, (g) => {
    const ppm = size / L, c = size / 2, rnd = seeded(91 + look.seed);
    const X = (dx: number) => c + dx * ppm, Z = (dz: number) => c + dz * ppm;
    const rgb = (k: RGB, t = 1, a = 1) => `rgba(${Math.round(k[0] * t)},${Math.round(k[1] * t)},${Math.round(k[2] * t)},${a})`;
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
    const blob = (dx: number, dz: number, r: number, fill: string, lobes = 7, squash = 1.25) => {
      const ls = Array.from({ length: lobes }, () => 0.72 + 0.5 * rnd());
      g.fillStyle = fill;
      g.beginPath();
      ls.forEach((l, k) => {
        const b = (k / ls.length) * Math.PI * 2, x = X(dx + Math.cos(b) * r * l * squash), z = Z(dz + Math.sin(b) * r * l);
        if (k) g.lineTo(x, z); else g.moveTo(x, z);
      });
      g.closePath();
      g.fill();
    };
    const area = (L / 112) ** 2;
    // trodden patches of earth, mud in the low places, scorch where something burned (soft-edged: hard lobes read as a low-poly floor)
    g.filter = `blur(${Math.max(2, Math.round(0.5 * ppm))}px)`;
    for (let i = 0; i < 160 * area; i++) {
      const dx = (rnd() - 0.5) * L, dz = (rnd() - 0.5) * L;
      if (geo.beyond(dx, dz) > 2) continue;
      blob(dx, dz, 2.5 + rnd() * 6, rgb(EARTH, rnd() < 0.5 ? 0.86 + 0.08 * rnd() : 1.04 + 0.06 * rnd(), 0.55));
    }
    for (let i = 0; i < 40 * area; i++) {
      const dx = (rnd() - 0.5) * L, dz = (rnd() - 0.5) * L;
      if (geo.beyond(dx, dz) > 1) continue;
      blob(dx, dz, 1.4 + rnd() * 2.6, rgb(MUD, 0.9, 0.7), 6, 1.5);
      g.strokeStyle = 'rgba(180,190,200,0.12)'; // a wet sheen on the mud
      g.lineWidth = 0.08 * ppm;
      g.beginPath(); g.ellipse(X(dx), Z(dz), 0.9 * ppm, 0.4 * ppm, rnd(), 0, Math.PI * 2); g.stroke();
    }
    for (let i = 0; i < 18 * area; i++) {
      const dx = (rnd() - 0.5) * L, dz = (rnd() - 0.5) * L;
      if (geo.beyond(dx, dz) > 1) continue;
      const r = 1.6 + rnd() * 2.2, grad = g.createRadialGradient(X(dx), Z(dz), 0, X(dx), Z(dz), r * ppm);
      grad.addColorStop(0, rgb(SCORCH, 0.8, 0.85)); grad.addColorStop(0.6, rgb(SCORCH, 1, 0.5)); grad.addColorStop(1, rgb(SCORCH, 1, 0));
      g.fillStyle = grad;
      g.beginPath(); g.arc(X(dx), Z(dz), r * ppm, 0, Math.PI * 2); g.fill();
    }
    g.filter = 'none';
    // The roads: a band of trodden earth, wheel ruts, the old paving in two rows of slabs, a few gone.
    g.lineCap = g.lineJoin = 'round';
    for (const path of look.paths) {
      const trace = () => { g.beginPath(); path.forEach(([dx, dz], i) => (i ? g.lineTo(X(dx), Z(dz)) : g.moveTo(X(dx), Z(dz)))); };
      g.strokeStyle = rgb(EARTH, 0.82, 0.8); g.lineWidth = 4.6 * ppm; trace(); g.stroke();
      for (let i = 1; i < path.length; i++) {
        const [ax, az] = path[i - 1], [bx, bz] = path[i], len = Math.hypot(bx - ax, bz - az);
        if (len < 0.5) continue;
        g.save();
        g.translate(X(ax), Z(az));
        g.rotate(Math.atan2(bz - az, bx - ax));
        for (let s = 0, row = 0; s < len; s += 1.25, row++) for (let k = 0; k < 2; k++) {
          if (rnd() < 0.14) continue;
          g.fillStyle = rgb(SLAB, 0.84 + 0.24 * rnd());
          const off = row & 1 ? 0.3 : 0;
          g.fillRect((s + 0.06 + off) * ppm, (-1.32 + k * 1.34) * ppm, 1.14 * ppm, 1.22 * ppm);
        }
        // the ruts: two dark lines either side of the paving
        g.fillStyle = 'rgba(46,40,36,0.45)';
        g.fillRect(0, -1.75 * ppm, len * ppm, 0.16 * ppm); g.fillRect(0, 1.6 * ppm, len * ppm, 0.16 * ppm);
        g.restore();
      }
    }
    // The places: paved rounds with a brass ring at the ridges, works, hill, siege and keep; trodden earth at the camp; ash at the farm.
    for (const p of look.places) {
      const dx = p.x - RING.x, dz = p.z - RING.z, cx = X(dx), cz = Z(dz), r = p.r;
      if (p.kind === 'camp' || p.kind === 'hospital' || p.kind === 'wagons') {
        const rr = r * 0.8, grad = g.createRadialGradient(cx, cz, 0, cx, cz, (rr + 2.5) * ppm), col = p.kind === 'wagons' ? SCORCH : EARTH;
        grad.addColorStop(0, rgb(col, 1, 0.75)); grad.addColorStop(rr / (rr + 2.5), rgb(col, 1, 0.45)); grad.addColorStop(1, rgb(col, 1, 0));
        g.fillStyle = grad;
        g.beginPath(); g.arc(cx, cz, (rr + 2.5) * ppm, 0, Math.PI * 2); g.fill();
        continue;
      }
      if (p.kind === 'farm' || p.kind === 'mill') {
        blob(dx, dz, r * 0.9, rgb(SCORCH, 1.1, 0.75), 9, 1.1);
        continue;
      }
      g.save(); g.beginPath(); g.arc(cx, cz, r * ppm, 0, Math.PI * 2); g.clip();
      g.fillStyle = JOINT; g.fillRect(cx - r * ppm, cz - r * ppm, r * 2 * ppm, r * 2 * ppm);
      for (let z = -r; z < r; z += 1.5) for (let x = -r; x < r; x += 1.5) {
        if (rnd() < 0.1) continue;
        g.fillStyle = rgb(SLAB, 0.88 + 0.24 * rnd());
        g.fillRect(cx + (x + ((((z + r) / 1.5) | 0) % 2) * 0.7) * ppm + 0.08 * ppm, cz + z * ppm + 0.08 * ppm, 1.34 * ppm, 1.34 * ppm);
      }
      g.restore();
      g.strokeStyle = BRASS; g.lineWidth = 0.12 * ppm;
      g.beginPath(); g.arc(cx, cz, (r - 0.3) * ppm, 0, Math.PI * 2); g.stroke();
    }
  });
}

/** The materials: matte parts, the one polished metal (gold), steel, and the two armies' cloth. */
function materials(own: { dispose(): void }[]) {
  const mat = (hex: number, rough = 0.8, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, ...o });
    own.push(m);
    return m;
  };
  return {
    rockA: mat(0x5e5a58, 0.92, { flatShading: true }), rockB: mat(0x6c6660, 0.92, { flatShading: true }), rockC: mat(0x4c4a4c, 0.92, { flatShading: true }),
    stone: mat(0x7a766e, 0.85), charred: mat(0x3a3430, 0.9), wood: mat(0x4a3220, 0.72), darkWood: mat(0x2c211a, 0.8), plank: mat(0x6b4a2e, 0.75),
    lacquer: mat(0x1d1b21, 0.45), cream: mat(0xd8cfb4, 0.85, { side: THREE.DoubleSide }), white: mat(0xb8b2a4, 0.9, { side: THREE.DoubleSide }),
    // the tents' canvas a shade down from the cream: lit by the low sun, cream and white tents bloomed to a white glare
    canvas: mat(0x9e9480, 0.95, { side: THREE.DoubleSide }), linen: mat(0xa49e90, 0.95, { side: THREE.DoubleSide }),
    crimson: mat(0x9a2c2c, 0.8, { side: THREE.DoubleSide }), azure: mat(0x2c4c9a, 0.8, { side: THREE.DoubleSide }),
    steel: mat(0x8a8e98, 0.42, { metalness: 0.55 }), iron: mat(0x2a2c32, 0.55, { metalness: 0.5 }), straw: mat(0xb89a5a, 0.9), sack: mat(0x9a8a66, 0.9),
    gold: mat(0xc9a24a, 0.32, { metalness: 0.85, emissive: 0xffb050, emissiveIntensity: 0.18 }),
    flame: mat(0xffc060, 0.4, { emissive: 0xffa040, emissiveIntensity: 1.2 }),
  };
}
export type WarMats = ReturnType<typeof materials>;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r0: number, r1: number, h: number, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);

/** Light rain round the camera: thin streaks on one slant, falling through a cylinder that walks with the view (the zone is too large to fill). */
class Rain {
  readonly lines: THREE.LineSegments;
  private pos: Float32Array;
  private speed: Float32Array;
  private readonly slant = new THREE.Vector3(0.12, -1, 0.05).normalize();
  private readonly count: number;
  private readonly reach: number;
  private readonly top: number;
  constructor(count = 520, reach = 34, top = 18) {
    this.count = count; this.reach = reach; this.top = top;
    this.pos = new Float32Array(count * 6);
    this.speed = new Float32Array(count);
    for (let i = 0; i < count; i++) this.drop(i, Math.random() * top);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa8b6cc, transparent: true, opacity: 0.22, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
    // The rain stands round the point the camera looks at: moved before each draw.
    const fwd = new THREE.Vector3();
    this.lines.onBeforeRender = (_r, _s, cam) => {
      cam.getWorldDirection(fwd);
      const t = cam.position.y > 0.5 && fwd.y < -0.05 ? Math.min(60, -cam.position.y / fwd.y) * 0.7 : 10;
      this.lines.position.set(cam.position.x + fwd.x * t, 0, cam.position.z + fwd.z * t);
      this.lines.updateMatrixWorld();
      this.lines.modelViewMatrix.multiplyMatrices(cam.matrixWorldInverse, this.lines.matrixWorld);
    };
  }
  private drop(i: number, y: number) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.reach;
    this.pos[i * 6] = Math.cos(a) * r;
    this.pos[i * 6 + 1] = y;
    this.pos[i * 6 + 2] = Math.sin(a) * r;
    this.speed[i] = 17 + Math.random() * 6;
  }
  update(dt: number) {
    const p = this.pos, s = this.slant;
    for (let i = 0; i < this.count; i++) {
      const d = this.speed[i] * Math.min(dt, 0.05);
      p[i * 6] += s.x * d; p[i * 6 + 1] += s.y * d; p[i * 6 + 2] += s.z * d;
      if (p[i * 6 + 1] < 0) this.drop(i, this.top);
      p[i * 6 + 3] = p[i * 6] - s.x * 0.85; p[i * 6 + 4] = p[i * 6 + 1] - s.y * 0.85; p[i * 6 + 5] = p[i * 6 + 2] - s.z * 0.85;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
  dispose() {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}

/** Builds a War zone's meshes. */
export function buildWarZone(look: WarLook, keep: { x: number; z: number }[] = [], floor?: number): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const M = materials(own);
  const rim = look.rim, geo = battlefield(rim, look.seed), rnd = seeded(5051 + look.seed);
  const rmax = Math.max(...rim), rmean = rim.reduce((s, r) => s + r, 0) / rim.length;
  const kit = new Kit();
  const glowSpots: { x: number; y: number; z: number; size?: number }[] = [];
  const W = (dx: number, dz: number) => ({ x: RING.x + dx, z: RING.z + dz });
  /** A point `b` m past the outline in direction `a` (radians, atan2(dz, dx)), as an offset. */
  const out = (a: number, b: number) => { const r = rimAt(rim, a) + b; return { dx: Math.cos(a) * r, dz: Math.sin(a) * r }; };
  /** The cloth of the army whose side `x` (world) is on. */
  const sideCloth = (x: number) => ((x - RING.x) * look.crimson > 0 ? M.crimson : M.azure);

  // --- the ground: one plane, flat inside, the bank and the hills outside; a painted map in the middle ---------------------------
  const SIZE = Math.max(420, 2 * (rmax + 170)), SEG = Math.round(SIZE / 2.1), L = 2 * (rmax + 8);
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
  const groundMat = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.92, envMapIntensity: 0.12 });
  groundMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', 'vec4 texelColor = texture2D( map, vMapUv );\n diffuseColor.rgb = mix( vColor.rgb, texelColor.rgb, vColor.a );')
      .replace('#include <color_fragment>', '');
  };
  groundMat.customProgramCacheKey = () => 'tower-war-ground';
  const ground = new THREE.Mesh(plane, groundMat);
  ground.position.set(RING.x, 0, RING.z);
  ground.receiveShadow = true;
  g.add(ground);
  own.push(plane, map, groundMat);

  const ico1 = new THREE.IcosahedronGeometry(1, 1), ico0 = new THREE.IcosahedronGeometry(1, 0);
  own.push(ico1, ico0);
  const rocks = [M.rockA, M.rockB, M.rockC];
  const boulder = (x: number, z: number, r: number, h: number, base = 0, y = 0) => {
    kit.add(rocks[base % 3], ico1, x, y + h * 0.34, z, rnd() * 6, r * 1.08, h * 0.6, r, (rnd() - 0.5) * 0.15);
    const a = rnd() * 6.28;
    kit.add(rocks[(base + 1) % 3], ico0, x + Math.cos(a) * r * 0.75, y + h * 0.1, z + Math.sin(a) * r * 0.75, rnd() * 6, r * 0.5, h * 0.24, r * 0.45);
  };
  /** Three sharpened stakes leaning one way, lashed: the hedge where a walk stops and the field's filler. */
  const stakes = (x: number, z: number, h: number, yaw: number, y = 0) => {
    for (let k = 0; k < 3; k++) kit.add(M.wood, new THREE.ConeGeometry(0.1, h, 5).translate(0, h / 2, 0), x + Math.cos(yaw) * (k - 1) * 0.3, y, z - Math.sin(yaw) * (k - 1) * 0.3, yaw, 1, 1, 1, 0.38);
    kit.add(M.darkWood, new THREE.CylinderGeometry(0.06, 0.06, 1.0, 5).rotateZ(Math.PI / 2), x, y + h * 0.35, z, yaw);
  };
  /** A banner on a pole: a pole, a crossbar, a cloth of an army's colour hanging, a gold finial. */
  const banner = (x: number, z: number, h: number, cloth: THREE.Material, yaw = 0, y = 0, torn = false) => {
    kit.add(M.wood, cyl(0.07, 0.09, h, 6), x, y, z).add(M.wood, box(1.2, 0.07, 0.07), x, y + h - 0.35, z, yaw);
    kit.add(cloth, new THREE.PlaneGeometry(1.0, torn ? 1.2 : 1.7).translate(0, -(torn ? 0.6 : 0.85), 0), x, y + h - 0.38, z, yaw);
    kit.add(M.gold, new THREE.ConeGeometry(0.1, 0.32, 5).translate(0, 0.16, 0), x, y + h, z);
  };

  // --- the cover -----------------------------------------------------------------------------------------------------------------
  const kinds = new Map(look.kinds);
  look.pieces.forEach(({ look: lk, o }, idx) => {
    const kind = kinds.get(idx), yaw = Math.atan2(o.bx - o.ax, o.bz - o.az), len = Math.hypot(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, r = o.r, h = o.height;
    switch (lk) {
      case 'edge': return;
      case 'rock': {
        if (kind === 'rubble') {
          for (let k = 0; k < 5; k++) kit.add(M.stone, box(0.8, 0.5, 0.6), o.ax + (rnd() - 0.5) * r * 1.6, 0, o.az + (rnd() - 0.5) * r * 1.6, rnd() * 3, 0.7 + rnd() * 0.6, 1, 1, (rnd() - 0.5) * 0.4);
        } else boulder(o.ax, o.az, r, h, idx);
        return;
      }
      case 'crate':
        if (kind === 'shieldpile') {
          for (let k = 0; k < 4; k++) kit.add(k % 2 ? sideCloth(o.ax) : M.steel, new THREE.CylinderGeometry(0.5, 0.5, 0.07, 9).translate(0, 0.1 + k * 0.1, 0), o.ax + (rnd() - 0.5) * 0.4, 0, o.az + (rnd() - 0.5) * 0.4, rnd() * 3, 1, 1, 1, (rnd() - 0.5) * 0.3);
          kit.add(M.wood, cyl(0.04, 0.04, 1.7, 4), o.ax + 0.3, 0.2, o.az, 0.4, 1, 1, 1, 1.2);
        } else if (kind === 'sacks') {
          for (let k = 0; k < 3; k++) kit.add(M.sack, new THREE.SphereGeometry(0.42, 9, 6).scale(1, 0.75, 0.8).translate(0, 0.3, 0), o.ax + (k - 1) * 0.5, k === 1 ? 0.45 : 0, o.az + (rnd() - 0.5) * 0.3, rnd() * 3);
        } else if (kind === 'cot') {
          kit.add(M.wood, box(r * 2.6, 0.45, r * 1.2), o.ax, 0, o.az, rnd() * 0.4).add(M.white, box(r * 2.4, 0.08, r * 1.1), o.ax, 0.45, o.az, rnd() * 0.4);
        } else {
          kit.add(M.plank, box(r * 2, h, r * 2), o.ax, 0, o.az, rnd() * 3).add(M.iron, box(r * 2.06, 0.08, r * 2.06), o.ax, h * 0.55, o.az, 0);
        }
        return;
      case 'barrel':
        if (kind === 'drum') {
          kit.add(M.wood, cyl(r, r * 0.92, h, 14), o.ax, 0, o.az).add(M.gold, cyl(r * 1.04, r * 1.04, 0.07, 14), o.ax, h * 0.15, o.az).add(M.gold, cyl(r * 1.04, r * 1.04, 0.07, 14), o.ax, h * 0.85, o.az);
          kit.add(M.canvas, cyl(r * 0.97, r * 0.97, 0.05, 14), o.ax, h, o.az).add(sideCloth(o.ax), cyl(r * 1.01, r * 1.01, h * 0.4, 14), o.ax, h * 0.3, o.az);
        } else if (kind === 'hay') {
          kit.add(M.straw, new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1), o.ax, 0, o.az).add(M.charred, new THREE.SphereGeometry(r * 1.01, 12, 4, 0, Math.PI * 2, Math.PI / 2 - 0.5, 0.5).scale(1, h / r, 1), o.ax, 0, o.az, rnd() * 3);
        } else {
          kit.add(M.plank, cyl(r * 0.9, r, h, 12), o.ax, 0, o.az).add(M.iron, cyl(r * 1.02, r * 1.02, 0.06, 12), o.ax, h * 0.25, o.az).add(M.iron, cyl(r * 0.95, r * 0.95, 0.06, 12), o.ax, h * 0.8, o.az);
        }
        return;
      case 'tent': {
        const white = kind === 'whitetent', cloth = white ? M.linen : M.canvas, band = white ? M.gold : sideCloth(o.ax);
        kit.add(cloth, new THREE.ConeGeometry(r * 1.3, h * 1.3, 8).translate(0, h * 0.65, 0), o.ax, 0, o.az, rnd() * 3).add(band, new THREE.CylinderGeometry(r * 1.06, r * 1.32, 0.4, 8).translate(0, 0.2, 0), o.ax, 0, o.az);
        kit.add(M.gold, cyl(0.05, 0.05, h * 1.8, 5), o.ax, 0, o.az);
        if (!white) kit.add(band, new THREE.PlaneGeometry(0.5, 0.36).translate(0.25, 0, 0), o.ax, h * 1.7, o.az, rnd() * 3);
        return;
      }
      case 'fire':
        // a brazier: an iron bowl on a stone foot, the fire
        kit.add(M.stone, cyl(r * 0.5, r * 0.65, 0.45, 10), o.ax, 0, o.az).add(M.iron, cyl(r, r * 0.55, 0.45, 12), o.ax, 0.45, o.az).add(M.gold, new THREE.TorusGeometry(r, 0.05, 6, 18).rotateX(Math.PI / 2).translate(0, 0.9, 0), o.ax, 0, o.az);
        kit.add(M.flame, new THREE.ConeGeometry(0.42 * r, 1.0, 7).translate(0, 1.35, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: 1.4, z: o.az, size: 5 });
        return;
      case 'post':
        if (kind === 'standard') {
          // a standard on a stone foot, its cloth gone (the law flies the colours)
          kit.add(M.stone, cyl(r * 1.1, r * 1.3, 0.6, 8), o.ax, 0, o.az).add(M.gold, cyl(r * 1.12, r * 1.12, 0.06, 8), o.ax, 0.6, o.az).add(M.wood, cyl(0.09, 0.11, h, 6), o.ax, 0.4, o.az).add(M.wood, box(1.5, 0.08, 0.08), o.ax, h - 0.5, o.az, 0.4);
          kit.add(M.gold, new THREE.ConeGeometry(0.16, 0.45, 5).translate(0, 0.22, 0), o.ax, h + 0.4, o.az);
        } else if (kind === 'catapult') {
          kit.add(M.plank, box(r * 1.5, 0.35, r * 2.4), o.ax, 0.25, o.az, rnd() * 3);
          for (const s of [-1, 1]) for (const e of [-1, 1]) kit.add(M.darkWood, new THREE.CylinderGeometry(0.42, 0.42, 0.14, 10).rotateZ(Math.PI / 2), o.ax + s * r * 0.82, 0.42, o.az + e * r * 0.8);
          kit.add(M.wood, box(0.25, 1.5, 0.25), o.ax - 0.4, 0.5, o.az).add(M.wood, box(0.25, 1.5, 0.25), o.ax + 0.4, 0.5, o.az);
          kit.add(M.wood, cyl(0.1, 0.12, 3.0, 6), o.ax, 0.7, o.az, 0.5, 1, 1, 1, 1.2).add(M.iron, cyl(0.42, 0.42, 0.12, 10), o.ax + 0.6, 0.55, o.az, 0.5);
        } else if (kind === 'stake') {
          stakes(o.ax, o.az, h * 1.1, rnd() * 6.28);
        } else if (kind === 'gatetower') {
          // a timber tower either side of the siege line's gate: four posts, a planked box, a roof
          kit.add(M.darkWood, box(r * 1.9, h * 0.7, r * 1.9), o.ax, 0, o.az).add(M.plank, box(r * 2.2, h * 0.3, r * 2.2), o.ax, h * 0.7, o.az);
          kit.add(M.lacquer, new THREE.ConeGeometry(r * 1.8, 1.4, 4).rotateY(Math.PI / 4).translate(0, 0.7, 0), o.ax, h, o.az).add(M.gold, box(0.12, 0.5, 0.12), o.ax, h + 1.3, o.az);
          banner(o.ax + (o.ax > RING.x ? 0.9 : -0.9), o.az + 0.9, h + 2.4, sideCloth(o.ax > RING.x ? RING.x + look.crimson : RING.x - look.crimson));
          glowSpots.push({ x: o.ax, y: h * 0.8, z: o.az + r + 0.2, size: 1.4 });
        } else {
          kit.add(M.wood, cyl(r * 0.8, r, h, 7), o.ax, 0, o.az).add(M.gold, cyl(r * 1.05, r * 1.05, 0.12, 7), o.ax, h * 0.7, o.az);
        }
        return;
      case 'stall':
        if (kind === 'shield') {
          // a sill of great shields across the back: a low stone sill, big round shields standing on it, each its own tilt
          kit.add(M.stone, box(r * 2.2, 0.32, len + r * 2), mx, 0, mz, yaw);
          const k = Math.max(2, Math.round(len / 1.5));
          for (let i = 0; i < k; i++) {
            const t = i / (k - 1), x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t;
            kit.add(i % 2 ? sideCloth(x) : M.steel, new THREE.CylinderGeometry(0.78, 0.78, 0.1, 10).rotateX(Math.PI / 2).translate(0, 0.85, 0), x, 0.3, z, yaw + Math.PI / 2, 1, 1, 1, (rnd() - 0.5) * 0.18);
            kit.add(M.gold, new THREE.SphereGeometry(0.16, 6, 4).translate(0, 0.85, 0.07), x, 0.3, z, yaw + Math.PI / 2);
          }
        } else if (kind === 'fence') {
          const k = Math.max(2, Math.round(len / 1.6));
          for (let i = 0; i <= k; i++) { const t = i / k; kit.add(M.charred, box(0.14, h, 0.14), o.ax + (o.bx - o.ax) * t, 0, o.az + (o.bz - o.az) * t, rnd()); }
          kit.add(M.wood, box(0.08, 0.1, len), mx, h * 0.5, mz, yaw).add(M.wood, box(0.08, 0.1, len * 0.7), mx, h * 0.85, mz, yaw, 1, 1, 1, 0.08);
        } else {
          kit.add(M.stone, box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add(M.gold, box(r * 2.2, 0.08, len + r * 2.2), mx, h, mz, yaw);
        }
        return;
      case 'house':
        if (kind === 'palisade') {
          // the siege line: a palisade of trunks with pointed tops, an iron band, a walkway's beam behind
          kit.add(M.wood, box(r * 1.6, h * 0.85, len + r * 2), mx, 0, mz, yaw).add(M.iron, box(r * 2.0, 0.12, len + r * 2), mx, h * 0.55, mz, yaw);
          for (let k = 0; k <= len / 0.85; k++) {
            const t = Math.min(1, (k * 0.85) / Math.max(len, 0.1)), x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t;
            kit.add(M.darkWood, new THREE.ConeGeometry(0.26, h * 0.32, 6).translate(0, h * 0.85 + h * 0.16, 0), x, 0, z, rnd() * 3);
          }
        } else if (kind === 'farmwall' || kind === 'ruinwall') {
          // a wall burned or broken to an uneven top: blocks of the wall's stone, the last course ragged
          const mat = kind === 'farmwall' ? M.charred : M.stone, k = Math.max(2, Math.round(len / 1.2));
          kit.add(mat, box(r * 2, h * 0.55, len + r * 2), mx, 0, mz, yaw);
          for (let i = 0; i < k; i++) {
            const t = (i + 0.5) / k, x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t, hh = h * (0.15 + 0.45 * rnd());
            kit.add(mat, box(r * 2, hh, len / k + 0.02), x, h * 0.55, z, yaw);
          }
          if (kind === 'farmwall') {
            // the roof burned away: the charred stubs of its uprights on the wall's top, and a chimney stack on the long wall
            for (const t of [0.15, 0.5, 0.85]) kit.add(M.darkWood, box(0.2, 1.1 + rnd() * 0.9, 0.2), o.ax + (o.bx - o.ax) * t, h * 0.6, o.az + (o.bz - o.az) * t, yaw, 1, 1, 1, (rnd() - 0.5) * 0.25);
            if (len > 7) kit.add(M.stone, box(0.9, h + 1.6, 0.9), mx, 0, mz, yaw).add(M.charred, box(1.0, 0.25, 1.0), mx, h + 1.6, mz, yaw);
          }
        } else {
          kit.add(M.stone, box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add(M.gold, box(r * 2.2, 0.1, len + r * 2.2), mx, h, mz, yaw);
        }
        return;
      case 'hull':
        if (kind === 'siegetower') {
          // a siege tower fallen on its side: its frame, planks, a wheel up
          kit.add(M.plank, box(r * 2, h * 0.7, len + r * 2), mx, 0.3, mz, yaw, 1, 1, 1, 0.05).add(M.wood, box(r * 2.2, 0.2, len + r * 2.2), mx, 0.3 + h * 0.7, mz, yaw);
          for (let k = 0; k < 6; k++) kit.add(M.darkWood, box(r * 2.1, 0.2, 0.2), mx + Math.sin(yaw) * ((k - 2.5) * len) / 6, 0.3 + h * 0.2 + (k % 2) * 0.9, mz + Math.cos(yaw) * ((k - 2.5) * len) / 6, yaw);
          kit.add(M.darkWood, new THREE.CylinderGeometry(0.8, 0.8, 0.2, 12), o.ax, 0.9, o.az, yaw);
        } else {
          // a wagon on its side: its bed, an iron band, two wheels standing up, one lying
          kit.add(M.plank, box(r * 1.6, h * 0.55, len + r * 1.6), mx, 0.35, mz, yaw, 1, 1, 1, 0.12 * (rnd() - 0.5)).add(M.iron, box(r * 1.7, 0.08, len + r * 1.7), mx, 0.35 + h * 0.55, mz, yaw);
          for (const e of [-1, 0.9]) kit.add(M.darkWood, new THREE.TorusGeometry(0.5, 0.08, 6, 14), mx + Math.sin(yaw) * e * len * 0.4 + Math.cos(yaw) * r * 1.05, 0.55, mz + Math.cos(yaw) * e * len * 0.4 - Math.sin(yaw) * r * 1.05, yaw + Math.PI / 2);
          kit.add(M.darkWood, new THREE.TorusGeometry(0.5, 0.08, 6, 14).rotateX(Math.PI / 2), mx - Math.cos(yaw) * (r + 1.2), 0.08, mz + Math.sin(yaw) * (r + 1.2));
        }
        return;
      case 'lighthouse':
        if (kind === 'mill') {
          // a mill tower burned hollow: a tapering stone tower, a charred cap, two broken sails
          kit.add(M.stone, cyl(r * 0.75, r, h, 12), o.ax, 0, o.az).add(M.charred, new THREE.ConeGeometry(r * 0.95, 1.8, 12).translate(0, 0.9, 0), o.ax, h, o.az);
          kit.add(M.lacquer, box(0.9, 1.4, 0.1), o.ax, 1.2, o.az + r - 0.02).add(M.darkWood, box(0.3, 0.3, 0.5), o.ax, h - 1.3, o.az + r * 0.8);
          for (const a of [0.5, 2.2]) kit.add(M.darkWood, box(0.22, 6.5, 0.12).translate(0, 1.2, 0).rotateZ(a), o.ax, h - 1.3, o.az + r * 0.8 + 0.3);
        } else {
          // a keep's broken tower: a round tower whose top is gone, ragged; a dark doorway
          kit.add(M.stone, cyl(r * 0.92, r, h * 0.75, 14), o.ax, 0, o.az);
          for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; kit.add(M.stone, box(r * 0.62, h * (0.08 + 0.25 * rnd()), 0.7), o.ax + Math.cos(a) * r * 0.82, h * 0.75, o.az + Math.sin(a) * r * 0.82, -a + Math.PI / 2); }
          kit.add(M.lacquer, box(1.1, 2.1, 0.2), o.ax, 0, o.az + r * 0.95).add(M.gold, box(1.3, 0.1, 0.24), o.ax, 2.1, o.az + r * 0.95);
        }
        return;
    }
  });
  // Braziers on poles at the places, towards the middle.
  for (const p of look.places) {
    if (p.kind === 'camp') continue;
    const a = Math.atan2(RING.x - p.x, RING.z - p.z), x = p.x + Math.sin(a) * (p.r - 0.6), z = p.z + Math.cos(a) * (p.r - 0.6);
    kit.add(M.darkWood, cyl(0.12, 0.16, 1.7, 6), x, 0, z).add(M.iron, cyl(0.38, 0.22, 0.4, 8), x, 1.7, z).add(M.flame, new THREE.ConeGeometry(0.22, 0.5, 6).translate(0, 0.25, 0), x, 2.05, z);
    glowSpots.push({ x, y: 2.4, z, size: 2.0 });
  }

  // --- where a walk stops: a hedge of sharpened stakes on the earth bank, all round (low in the south) ---------------------------------
  const around = 2 * Math.PI * rmean;
  for (let k = 0; k < around / 2.2; k++) {
    const a = (k / (around / 2.2)) * Math.PI * 2, o = out(a, 1.5 + rnd() * 0.6), p = W(o.dx, o.dz), y = geo.height(o.dx, o.dz);
    // behind the siege line the line itself stands: no hedge
    if (p.z < look.line.z - 1 && p.x > look.line.w - 2 && p.x < look.line.e + 2) continue;
    const so = geo.south(o.dx, o.dz), outward = Math.atan2(Math.cos(a), Math.sin(a));
    if (k % 5 === 0 && rnd() < 0.5) boulder(p.x, p.z, 0.6 + rnd() * 0.5, 0.9, k, y - 0.15);
    else stakes(p.x, p.z, so > 0.5 ? 1.2 : 1.6 + rnd() * 0.4, outward + Math.PI / 2, y - 0.1);
  }
  // The siege line goes on past the outline's ends a little, into the bank (its pieces end 4 m past the outline).
  kit.build(g, own);

  const glows = new Glows(glowSpots, 0xff9a48, 1.5);
  g.add(glows.group);
  own.push(glows);
  const rain = new Rain();
  g.add(rain.lines);
  own.push(rain);

  const depthOn = DEPTH && (globalThis as unknown as { __warDepth?: boolean }).__warDepth !== false;
  // Built on its own random stream: three.js draws on `Math.random` for every object's id, so a depth built on the game's own stream
  // changed the dice of every fight after it (the perf tool's A/B played two different fights).
  let depth: ReturnType<typeof buildWarDepth> | null = null;
  if (depthOn) {
    const gameRandom = Math.random;
    Math.random = seeded(991 + look.seed);
    try { depth = buildWarDepth({ look, geo, into: g, own, rnd: seeded(777 + look.seed), mats: M, keep, floor, ground: { map, L } }); } finally { Math.random = gameRandom; }
  }

  return {
    group: g,
    update(dt, time) { rain.update(dt); glows.update(time); depth?.update(dt, time); },
    dispose() {
      g.removeFromParent();
      for (const o of own) o.dispose();
    },
  };
}

/** A War floor as an arena: its own layout and outline, the evening's stage. */
export function warArena(id: string, name: string, look: WarLook, keep: { x: number; z: number }[] = []): ArenaDef {
  // The ring is the circle round the whole outline: the walk's box and the checks' grid; the outline's own walls keep a walk inside it.
  // The floor's number, read from the arena's id (`tower-war-46`; floor 41 is `tower-zone-banners`), for the scenes (48 to 50 the most scarred).
  const n = /war-(\d+)/.exec(id)?.[1], floor = n ? Number(n) : id.includes('banners') ? 41 : undefined;
  return { id, name, ring: Math.ceil(Math.max(...look.rim) + 1.5), obstacles: look.pieces.map((p) => p.o), stage: STAGE, hideGround: true, build: () => buildWarZone(look, keep, floor) };
}
