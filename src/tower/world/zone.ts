import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING, seeded } from '../../arenas/common';
import { HARBOUR_OBSTACLES } from '../../arenas/harbour';
import { Glows, realProps } from '../../arenas/real';
import type { ArenaDef, ArenaStage } from '../../arenas/types';
import { pillar, wall, type Obstacle } from '../../obstacles';
import { buildLand } from './land';

/**
 * Stage 0 of the Tower's floors as worlds (pipeline/designs/tower-worlds-build.md): one walking zone in the Drowned Harbour's
 * look, radius `ZONE_R` (an arena is 12 to 16). A camp in the south, four other places (a market, a lighthouse, a wreck, caves)
 * joined by paths, and cover (crates, stalls, rocks, a ruined customs house in the middle) so that path finding has work to do.
 *
 * Drawn in code from the harbour's own pieces: its paving, its kerb and wall of dressed blocks, its sea and glows, its stage,
 * and some of the props the arena's file holds (barrels, chests, mooring posts, cannons, boats), merged into a few meshes.
 * First pass, for the artist to direct.
 *
 * Coordinates are the duel's: the middle is `RING` (0, 7), the south (z up) is where the camp is and the camera looks north.
 */

/**
 * How far the walkable ground reaches from the middle (m). The walk clamp in `Arena.walk` is +-55 (arena.ts:727) and the middle is
 * (0, 7), so 48 keeps the rim clean in z.
 *
 * TOWER-HOOK (ring): the middle of a room is always `RING` and `Arena.walk` clamps to +-55 whatever the ring: at 50 the south rim is
 * flat (z 55) and the others reach 49.3. `ArenaDef` should carry its middle and the clamp should follow `arena.bounds`.
 */
export const ZONE_R = 48;
const at = (dx: number, dz: number) => ({ x: RING.x + dx, z: RING.z + dz });

/** The tide's low ground (floor 1's law, floors/harbour.ts): kept here because the ground is drawn from it (tidal flats, land.ts). */
export const TIDE_LOW = [
  { ...at(-16, 19), rx: 8, rz: 5, rot: 0.3 }, { ...at(12, 11), rx: 5, rz: 4 }, { ...at(-9, -22), rx: 8, rz: 5 }, { ...at(35, -12), rx: 6, rz: 5 },
  { ...at(-33, -17), rx: 6, rz: 4 }, { ...at(20, 31), rx: 7, rz: 4 }, { ...at(4, -33), rx: 7, rz: 3 },
];

export interface Place { id: string; name: string; x: number; z: number; r: number; /** Open ground to walk to: the middle of a place can be cover. */ stand: { x: number; z: number } }
/** The five places: where each stands, and how wide its plaza is. */
export const PLACES: Record<'camp' | 'market' | 'lighthouse' | 'wreck' | 'caves', Place> = {
  camp: { id: 'camp', name: 'The camp', ...at(0, 34), r: 7, stand: at(0, 37.5) },
  market: { id: 'market', name: 'The fish market', ...at(-29, 6), r: 8, stand: at(-29, 6) },
  caves: { id: 'caves', name: 'The caves', ...at(-17, -31), r: 8, stand: at(-17, -29) },
  lighthouse: { id: 'lighthouse', name: 'The lighthouse', ...at(24, -26), r: 8, stand: at(24, -19) },
  wreck: { id: 'wreck', name: 'The wreck', ...at(26, 12), r: 8, stand: at(26, 8) },
};
/** Where the hero comes in. */
export const ZONE_START = at(0, 39.5);

/** The paths: each a line of points (offsets from the middle) that joins two places. */
const PATHS: [number, number][][] = [
  [[0, 28], [-10, 20], [-20, 10], [-27, 7]],
  [[3, 28], [12, 22], [19, 16], [24, 13]],
  [[-29, 0], [-27, -12], [-22, -24], [-18, -28]],
  [[-12, -30], [0, -33], [12, -30], [21, -27]],
  [[25, -20], [28, -8], [27, 5]],
];

/** `edge`: a piece of the zone's outline (an invisible wall that keeps a walk inside; the land draws what stands there). */
export type Look = 'crate' | 'barrel' | 'rock' | 'stall' | 'tent' | 'hull' | 'house' | 'fire' | 'lighthouse' | 'post' | 'edge';
export interface Piece { o: Obstacle; look: Look }

const piece = (look: Look, o: Obstacle, height?: number): Piece => ({ look, o: height ? { ...o, height } : o });
const P = (look: Look, dx: number, dz: number, r: number, h: number) => piece(look, { ...pillar(RING.x + dx, RING.z + dz, r), height: h });
const W = (look: Look, ax: number, az: number, bx: number, bz: number, r = 0.35, h = 2.3) => piece(look, { ...wall(RING.x + ax, RING.z + az, RING.x + bx, RING.z + bz), r, height: h });

/** Everything that stands in the zone and blocks a walk: about fifty pieces, so a way across has to bend. */
function cover(): Piece[] {
  const list: Piece[] = [];
  // The camp: a fire, two tents, supplies.
  list.push(P('fire', 0, 33.5, 0.9, 0.9), P('tent', -8.5, 36.5, 1.7, 2.6), P('tent', 8.5, 32.5, 1.7, 2.6), P('crate', -5, 30, 0.8, 1.2), P('crate', 5.4, 36.2, 0.8, 1.2), P('barrel', 3.2, 29.6, 0.6, 1));
  // The fish market (the pack stands in its middle, (-29, 6)): stalls round it, crates, barrels.
  list.push(
    W('stall', -36, 2, -32, -1.2), W('stall', -36, 10, -32.5, 13), W('stall', -24, -0.5, -20.5, 1.5), W('stall', -24, 12, -20.5, 10.5),
    P('crate', -27, 0.6, 0.8, 1.3), P('crate', -33.2, 6, 0.8, 1.3), P('crate', -24.6, 8, 0.8, 1.3), P('crate', -30, 12.4, 0.8, 1.3),
    P('barrel', -22, 5.5, 0.6, 1), P('barrel', -26.5, 14.5, 0.6, 1), P('barrel', -34.5, -1.5, 0.6, 1),
  );
  // The caves: a horseshoe of rock open to the south, the pack inside it.
  const cx = -17, cz = -32;
  for (const deg of [18, 46, 74, 102, 130, 158]) {
    const a = (deg * Math.PI) / 180;
    list.push(P('rock', cx + Math.cos(a) * 6.6, cz - Math.sin(a) * 6.6, 2.1, 5.6));
  }
  list.push(P('rock', cx + 9.5, cz + 3, 1.2, 2.2), P('rock', cx - 9.8, cz + 4.5, 1.4, 2.6));
  // The lighthouse: the tower's foot, a low wall each side, crates.
  list.push(P('lighthouse', 24, -26, 2.8, 16), W('stall', 17.5, -21, 20.5, -17.5, 0.4, 1.4), W('stall', 30.5, -21, 33.5, -24.5, 0.4, 1.4), P('crate', 27.5, -20, 0.8, 1.3), P('crate', 19.5, -30, 0.8, 1.3), P('post', 29, -31, 0.4, 3.9));
  // The wreck: a hull on its side, its bow and stern timbers.
  list.push(piece('hull', { ...wall(RING.x + 28.5, RING.z + 6.5, RING.x + 36, RING.z + 17), r: 1.7, height: 3 }), P('post', 38, 19, 0.5, 5), P('rock', 27, 16, 1.3, 1.6), P('rock', 36.5, 5, 1.5, 2));
  // The ruined customs house in the middle: three walls, open to the south.
  list.push(W('house', -6, -8, 6, -8, 0.45, 3.4), W('house', -6, -8, -6, -1.5, 0.45, 3.4), W('house', 6, -8, 6, -1.5, 0.45, 3.4));
  // The Drowned Captain's lair: a long wall across the north with a doorway in the middle (the door itself is the floor's: floors/harbour.ts).
  list.push(W('house', -26, -41, -3.4, -41, 0.5, 3.6), W('house', 3.4, -41, 26, -41, 0.5, 3.6));
  // Rocks and crates in the open, some on the paths so the way bends round them.
  list.push(
    P('rock', -12, 18, 1.3, 1.8), P('rock', 14, 25, 1.2, 1.5), P('rock', -24, -6, 1.4, 2.2), P('rock', -3, -32, 1.5, 2.2), P('rock', 14.5, -29, 1.3, 1.8), P('rock', 27, -3, 1.4, 1.8),
    P('crate', -10, 14, 0.8, 1.3), P('crate', 2, 17, 0.8, 1.3), P('crate', 12, 6, 0.8, 1.3), P('crate', -14, 2, 0.8, 1.3), P('barrel', 15, -8, 0.6, 1), P('barrel', -20, -17, 0.6, 1),
    P('rock', 8, -16, 1.6, 2.4), P('rock', -8, 8, 1.2, 1.6), P('rock', 20, 8, 1.2, 1.6), P('rock', -18, 24, 1.3, 1.8), P('rock', 38, -10, 1.8, 2.8), P('rock', -38, -14, 1.8, 2.8),
  );
  return list;
}
const PIECES = cover();
export const ZONE_COVER: Obstacle[] = PIECES.map((p) => p.o);

/** Where each pack stands: the middle of three of the places. */
export const PACK_HOMES = [
  { place: 'market', ...PLACES.market, count: 4 },
  { place: 'wreck', x: PLACES.wreck.x, z: PLACES.wreck.z, count: 3 },
  { place: 'caves', x: PLACES.caves.x, z: PLACES.caves.z + 0.5, count: 5 },
] as const;

// --- the look ---------------------------------------------------------------------------------------------------

/**
 * Daylight, late in the afternoon (the user, 2026-11-13: the floors should look like the real world). A shade muted, as the house
 * style asks (the world stays behind the heroes); the fog is the far haze over land and sea.
 */
const STAGE: ArenaStage = {
  background: 0x9db4c6, zenith: 0x5a83b0, horizon: 0xc6d2d6, glow: 0xf0d2a2, stars: 0,
  fog: 0xa9b8c0, fogNear: 70, fogFar: 240,
  hemiSky: 0xd2e0ec, hemiGround: 0x4c4636, hemiIntensity: 0.85,
  sun: 0xffe8c8, sunIntensity: 1.6, rim: 0xa4bedf, rimIntensity: 0.35,
};

/**
 * The dressing, collected as geometry and merged per material and per square of ground `CELL` m across: a few draw calls for the
 * whole zone, and a square that is out of the camera's view (and out of the sun's shadow box) is not drawn. (Merged into one mesh
 * per material for the whole zone, the first try drew every prop of the zone in both passes whatever the camera saw: 195 000
 * triangles.)
 */
const CELL = 24;
export class Kit {
  private cells = new Map<string, Map<THREE.Material, THREE.BufferGeometry[]>>();
  private m = new THREE.Matrix4();
  private put(mat: THREE.Material, g: THREE.BufferGeometry) {
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new THREE.Vector3()), key = `${Math.floor(c.x / CELL)}:${Math.floor(c.z / CELL)}`;
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, (cell = new Map()));
    let bin = cell.get(mat);
    if (!bin) cell.set(mat, (bin = []));
    bin.push(g);
  }
  private clean(geo: THREE.BufferGeometry) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g;
  }
  add(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0) {
    const g = this.clean(geo);
    this.m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    this.put(mat, g);
    return this;
  }
  /** A mesh of a cloned prop from the arena's file: its geometry and material, put where it stands now. */
  addMesh(mesh: THREE.Mesh) {
    mesh.updateWorldMatrix(true, false);
    const g = this.clean(mesh.geometry);
    g.applyMatrix4(mesh.matrixWorld);
    this.put(mesh.material as THREE.Material, g);
  }
  build(into: THREE.Group, own: { dispose(): void }[]) {
    for (const cell of this.cells.values()) {
      for (const [mat, geos] of cell) {
        const merged = mergeGeometries(geos, false);
        for (const g of geos) g.dispose();
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = mesh.receiveShadow = true;
        into.add(mesh);
        own.push(merged);
      }
    }
    this.cells.clear();
  }
}

/** Where each of the harbour file's props stands now (the middle of its obstacle) and which way it lies: cover 0 the barrels, 1 and 2 chests, 3 and 4 mooring posts, 5 and 6 cannons, 7 and 8 boats. */
const ORIGINAL = HARBOUR_OBSTACLES.map((o) => ({ x: (o.ax + o.bx) / 2, z: (o.az + o.bz) / 2, yaw: Math.atan2(o.bx - o.ax, o.bz - o.az) }));
/** Where to stand copies of them (offsets from the middle) and which way. */
const PROPS: { i: number; dx: number; dz: number; yaw: number }[] = [
  { i: 0, dx: -26.5, dz: 14.5, yaw: 0 }, { i: 0, dx: -22, dz: 5.5, yaw: 1 }, { i: 1, dx: -27, dz: 0.6, yaw: 0.4 }, { i: 2, dx: -30, dz: 12.4, yaw: 2 },   { i: 3, dx: -4, dz: 33, yaw: 0 }, { i: 4, dx: 4, dz: 33, yaw: 0 }, { i: 3, dx: 29, dz: -31, yaw: 0.5 }, { i: 4, dx: 33, dz: 20, yaw: 0 }, { i: 5, dx: 42, dz: 6, yaw: 1.2 }, { i: 6, dx: 38, dz: 24, yaw: 2.2 },
  { i: 7, dx: -12, dz: 30, yaw: 0.3 }, { i: 8, dx: 17, dz: 31, yaw: -0.4 }, { i: 7, dx: 40, dz: -20, yaw: 0.9 }, { i: 8, dx: -40, dz: -6, yaw: 0.2 },
];

/**
 * What a sea zone is drawn from (floor 1's is below; the generator's floors of the sea chapter carry their own, floors/gen/): its
 * places (world), paths (offsets), cover with its looks, the tide's flats (world), the sea's side, the land's seed, the caves' middle
 * (offset; a dark back wall and crystals) and copies of the harbour file's props (offsets).
 */
export interface SeaLook {
  /** The walkable outline: radii round the middle (land.ts `LandSpec.rim`); none is floor 1's circle. */
  rim?: number[];
  places: { id: string; kind?: string; x: number; z: number; r: number }[];
  paths: [number, number][][];
  pieces: Piece[];
  flats: { x: number; z: number; rx: number; rz: number; rot?: number }[];
  mirror: 1 | -1;
  seed: number;
  caves?: { dx: number; dz: number };
  props?: { i: number; dx: number; dz: number; yaw: number }[];
  /** The ruined customs house's floor (offset), when there is one. */
  ruin?: { dx: number; dz: number };
}
const FLOOR1_LOOK: SeaLook = { places: Object.values(PLACES), paths: PATHS, pieces: PIECES, flats: TIDE_LOW, mirror: 1, seed: 0, caves: { dx: -17, dz: -32 }, props: PROPS, ruin: { dx: 0, dz: -5 } };
/** The outline of a look: its own, or floor 1's circle. */
const rimOf = (look: SeaLook) => look.rim ?? new Array(48).fill(ZONE_R);

/** Floor 1's zone. */
export function buildZone() {
  return buildSeaZone(FLOOR1_LOOK);
}

/** Builds a sea zone's meshes. The harbour's own props load from its file and join the dressing when they arrive. */
export function buildSeaZone(L: SeaLook): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const mat = (color: number, rough = 0.85, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, ...o });
    own.push(m);
    return m;
  };
  const stone = mat(0x4a4e5a), rock = mat(0x383c46, 0.95), wood = mat(0x4a3626), darkWood = mat(0x2a1f1a), cream = mat(0xb6ae9a, 0.7), wine = mat(0x6a2535), teal = mat(0x2b5560), sail = mat(0x6f6652, 0.95, { side: THREE.DoubleSide });
  const gold = mat(0xc9a24a, 0.4, { metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.22 });
  const iron = mat(0x23252c, 0.55, { metalness: 0.5 });
  const crystal = new THREE.MeshBasicMaterial({ color: 0x7ad8ff });
  own.push(crystal);

  const kit = new Kit();
  // The world past the rim: land, a beach, the sea, the town, woods (land.ts). The cover below stands on its ground.
  const land = buildLand({ rim: rimOf(L), paths: L.paths, places: L.places, flats: L.flats, mirror: L.mirror, seed: L.seed, ruin: L.ruin, cover: L.pieces.map((p) => p.o) }, kit, g, own);
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const rnd = seeded(913);
  const glowSpots: { x: number; y: number; z: number; size?: number }[] = [];

  for (const { look, o } of L.pieces) {
    const yaw = Math.atan2(o.bx - o.ax, o.bz - o.az), len = Math.hypot(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, r = o.r, h = o.height;
    switch (look) {
      case 'crate':
        kit.add(wood, box(r * 2, h, r * 2), o.ax, 0, o.az, rnd() * 3).add(gold, box(r * 2.06, 0.08, r * 2.06), o.ax, h * 0.5, o.az, 0);
        break;
      case 'barrel':
        kit.add(wood, cyl(r * 0.9, r, h, 9), o.ax, 0, o.az).add(iron, cyl(r * 1.02, r * 1.02, 0.07, 9), o.ax, h * 0.3, o.az).add(iron, cyl(r * 1.02, r * 1.02, 0.07, 9), o.ax, h * 0.75, o.az);
        break;
      case 'rock': {
        const k = new THREE.IcosahedronGeometry(1, 0);
        kit.add(rock, k, o.ax, h * 0.3, o.az, rnd() * 6, r * 1.1, h * 0.7, r * 1.1).add(rock, k, o.ax + r * 0.5, h * 0.12, o.az - r * 0.3, rnd() * 6, r * 0.6, h * 0.38, r * 0.6);
        break;
      }
      case 'stall': {
        kit.add(wood, box(r * 2, h * 0.55, len + r * 2), mx, 0, mz, yaw).add(gold, box(r * 2.3, 0.1, len + r * 2.3), mx, h * 0.55, mz, yaw);
        if (h > 2) {
          for (const s of [-1, 1]) kit.add(darkWood, cyl(0.07, 0.07, h, 5), o.ax + Math.sin(yaw) * (len / 2) * s, 0, o.az + Math.cos(yaw) * (len / 2) * s);
          kit.add(rnd() < 0.5 ? wine : teal, new THREE.BoxGeometry(1.6, 0.06, len + 0.6).translate(0, h, 0), mx, 0, mz, yaw, 1, 1, 1, 0);
        }
        break;
      }
      case 'tent':
        kit.add(sail, new THREE.ConeGeometry(r * 1.25, h * 1.4, 7).translate(0, h * 0.7, 0), o.ax, 0, o.az, rnd() * 3).add(gold, cyl(0.05, 0.05, h * 1.9, 4), o.ax, 0, o.az);
        break;
      case 'house': {
        kit.add(cream, box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add(gold, box(r * 2.3, 0.1, len + r * 2.3), mx, h, mz, yaw);
        // fallen blocks at its foot
        kit.add(stone, box(0.7, 0.5, 0.9), mx + 0.9, 0, mz + 0.6, rnd() * 3).add(stone, box(0.9, 0.4, 0.6), mx - 1.1, 0, mz - 0.7, rnd() * 3);
        break;
      }
      case 'hull': {
        // a ship on its side: a long wooden body, ribs standing up along it, a broken mast
        kit.add(darkWood, box(r * 2, h * 0.7, len + r * 2), mx, 0, mz, yaw, 1, 1, 1, 0).add(wood, box(r * 1.2, h, len * 0.7), mx, 0.3, mz, yaw);
        for (let k = 0; k <= 6; k++) {
          const t = k / 6, x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t;
          kit.add(wood, cyl(0.12, 0.2, h * 1.4, 5), x + Math.cos(yaw) * r * 0.9, 0, z - Math.sin(yaw) * r * 0.9, 0, 1, 1, 1, 0.3).add(wood, cyl(0.12, 0.2, h * 1.2, 5), x - Math.cos(yaw) * r * 0.9, 0, z + Math.sin(yaw) * r * 0.9, 0, 1, 1, 1, -0.3);
        }
        kit.add(darkWood, cyl(0.2, 0.3, 6, 6), mx, 1.5, mz, yaw, 1, 1, 1, 1.15);
        break;
      }
      case 'fire':
        kit.add(rock, cyl(r, r * 1.1, 0.35, 8), o.ax, 0, o.az).add(darkWood, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 0.3, 1, 1, 1, 0.8).add(darkWood, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 2.4, 1, 1, 1, 0.8);
        kit.add(gold, new THREE.ConeGeometry(0.35, 0.9, 6).translate(0, 0.85, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: 1.2, z: o.az, size: 7 });
        break;
      case 'post':
        kit.add(darkWood, cyl(r * 0.8, r, h, 7), o.ax, 0, o.az).add(gold, cyl(r * 1.05, r * 1.05, 0.12, 7), o.ax, h * 0.7, o.az);
        glowSpots.push({ x: o.ax, y: h + 0.2, z: o.az, size: 1.4 });
        break;
      case 'lighthouse': {
        kit.add(cream, new THREE.CylinderGeometry(2.0, 2.9, 11, 12).translate(0, 5.5, 0), o.ax, 0, o.az).add(wine, new THREE.CylinderGeometry(1.7, 2.0, 2.4, 12).translate(0, 11 + 1.2, 0), o.ax, 0, o.az);
        kit.add(cream, new THREE.CylinderGeometry(1.45, 1.7, 2.6, 12).translate(0, 13.4 + 1.3, 0), o.ax, 0, o.az).add(gold, new THREE.CylinderGeometry(2.3, 2.3, 0.22, 12).translate(0, 16.1, 0), o.ax, 0, o.az);
        kit.add(iron, new THREE.ConeGeometry(1.8, 1.4, 12).translate(0, 17.9, 0), o.ax, 0, o.az).add(wine, new THREE.CylinderGeometry(2.1, 2.9, 0.5, 12).translate(0, 4, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: 16.9, z: o.az, size: 7 });
        break;
      }
    }
    if (h > 0 && look === 'stall') glowSpots.push({ x: o.ax, y: h + 0.1, z: o.az, size: 0.9 });
  }
  // The caves: a dark back wall inside the horseshoe and crystals that glow in it.
  const dark = new THREE.MeshBasicMaterial({ color: 0x03050a, side: THREE.DoubleSide });
  own.push(dark);
  if (L.caves) {
  const cv = L.caves;
  const back = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 5.4, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76).translate(0, 2.7, 0), dark);
  back.position.set(cv.dx + RING.x, 0, cv.dz + RING.z);
  g.add(back);
  own.push(back.geometry);
  for (const [ox, oz, s] of [[-3, -3, 1], [2, -4.5, 1.4], [4.5, -2, 0.8], [-5, -0.4, 0.7]] as const) {
    const dx = cv.dx + ox, dz = cv.dz + oz;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 * s).scale(0.6, 1.8, 0.6).translate(0, 0.6 * s, 0), crystal);
    m.position.set(RING.x + dx, 0, RING.z + dz);
    m.rotation.z = (rnd() - 0.5) * 0.5;
    g.add(m);
    own.push(m.geometry);
    glowSpots.push({ x: RING.x + dx, y: 1.0 * s, z: RING.z + dz, size: 3.2 * s });
  }
  }
  // The paths' edges are lit at the places: a lantern post at each plaza's rim, towards the middle.
  for (const pl of L.places) {
    const a = Math.atan2(RING.x - pl.x, RING.z - pl.z), x = pl.x + Math.sin(a) * (pl.r - 1), z = pl.z + Math.cos(a) * (pl.r - 1);
    kit.add(darkWood, cyl(0.12, 0.16, 2.6, 6), x, 0, z).add(gold, cyl(0.2, 0.2, 0.1, 6), x, 2.6, z);
    glowSpots.push({ x, y: 2.85, z, size: 1.6 });
  }
  kit.build(g, own);

  glowSpots.push(...land.glows);
  const glows = new Glows(glowSpots, 0xffa040, 1.5);
  g.add(glows.group);
  own.push(glows);

  // The harbour's own props, from its file: some of each kind stand in the places. Baked into the same few meshes as the rest.
  let disposed = false;
  const props = new THREE.Group();
  g.add(props);
  void realProps('harbour', ORIGINAL.length, {
    dim: 0.85, env: 0.35,
    parts: { glow: { emissive: 0xffa040, strength: 2.2 }, cream: { dim: 0.6 }, stone: { dim: 0.8 }, gold: { dim: 0.8 } },
  }).then((loaded) => {
    if (disposed) return;
    const extra = new Kit();
    for (const p of L.props ?? []) {
      const src = loaded.cover[p.i], from = ORIGINAL[p.i];
      if (!src) continue;
      const wrap = new THREE.Group(), inner = src.clone(true);
      inner.position.set(-from.x, 0, -from.z);
      wrap.add(inner);
      wrap.position.set(RING.x + p.dx, 0, RING.z + p.dz);
      wrap.rotation.y = p.yaw - from.yaw;
      wrap.updateMatrixWorld(true);
      inner.traverse((o) => { if ((o as THREE.Mesh).isMesh) extra.addMesh(o as THREE.Mesh); });
    }
    extra.build(props, []);
  }).catch((e) => console.warn('zone: harbour props failed to load', e));

  return {
    group: g,
    update(_dt, time) {
      land.update(time);
      glows.update(time);
    },
    dispose() {
      disposed = true;
      g.removeFromParent();
      for (const o of own) o.dispose();
      props.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    },
  };
}

/** A sea floor made by the generator, as an arena: its own layout, the same stage. */
export function seaArena(id: string, name: string, look: SeaLook): ArenaDef {
  // The ring is the circle round the whole outline: the walk's box and the checks' grid; the outline's own walls keep a walk inside it.
  return { id, name, ring: Math.ceil(Math.max(...rimOf(look)) + 1.5), obstacles: look.pieces.map((p) => p.o), stage: STAGE, hideGround: true, build: () => buildSeaZone(look) };
}

/** The zone as an arena for `Duel.startBoss`: its ring is `ZONE_R`, its cover `ZONE_COVER`, its look a coast by day (land.ts). */
export const zoneArena: ArenaDef = {
  id: 'tower-zone-harbour',
  name: 'The Drowned Harbour, a zone',
  ring: ZONE_R,
  obstacles: ZONE_COVER,
  stage: STAGE,
  hideGround: true,
  build() {
    const z = buildZone();
    return { group: z.group, update: z.update, dispose: z.dispose };
  },
};
