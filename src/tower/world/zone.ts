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
const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};
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
  // The Drowned Admiral's lair: a long wall across the north with a doorway in the middle (the door itself is the floor's: floors/harbour.ts).
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
  /**
   * The plain matte materials given to `matte` are drawn as one: their parts carry their colour in their vertices and go into one mesh
   * a square whatever their colours (as land.ts's `Dress`). (2026-11-19: the props' detail put more colours in more squares, a draw
   * each.) One material for them all, matte and flat.
   */
  private vc = new Map<THREE.Material, THREE.Color>();
  private shared: THREE.MeshStandardMaterial | null = null;
  matte(...mats: THREE.MeshStandardMaterial[]) {
    for (const m of mats) this.vc.set(m, m.color.clone());
    this.shared ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    return this;
  }
  private put(mat: THREE.Material, g: THREE.BufferGeometry) {
    const col = this.vc.get(mat);
    if (col) {
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      mat = this.shared!;
    }
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
    if (this.shared) own.push(this.shared);
    for (const cell of this.cells.values()) {
      for (const [mat, geos] of cell) {
        const merged = mergeGeometries(geos, false);
        for (const g of geos) g.dispose();
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = mesh.receiveShadow = true;
        if (mat === this.shared) mesh.name = 'zone-cover'; // the cover's own parts (the props probe tells them from the dressing by this)
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
export function buildSeaZone(L: SeaLook, keep: { x: number; z: number }[] = []): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
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
  // (2026-11-19, more detail in the props: the user, "make it more details") the new parts in the zone's own materials, no new one: the
  // props are merged per material per square, so a new colour is a draw more wherever it stands (five new ones cost 50 to 60 draws a
  // floor). Rope in cream, planks in wood, the catch in the blue-grey stone (a dull silver: white read as a light in the sun), jars in wine.
  const rope = cream, plank = wood, fish = stone, salt = stone, clay = wine;
  const crystal = new THREE.MeshBasicMaterial({ color: 0x7ad8ff });
  own.push(crystal);

  const kit = new Kit().matte(stone, rock, wood, darkWood, cream, wine, teal);
  // The world past the rim: land, a beach, the sea, the town, woods (land.ts). The cover below stands on its ground.
  const land = buildLand({ rim: rimOf(L), paths: L.paths, places: L.places, flats: L.flats, mirror: L.mirror, seed: L.seed, ruin: L.ruin, cover: L.pieces.map((p) => p.o), sceneCover: L.pieces.filter((p) => p.look !== 'edge').map((p) => p.o), sceneTaken: (L.props ?? []).map((p) => { const o = HARBOUR_OBSTACLES[p.i]; return { x: RING.x + p.dx, z: RING.z + p.dz, r: (o ? Math.hypot(o.bx - o.ax, o.bz - o.az) / 2 + o.r : 1.5) + 0.6 }; }), keep }, kit, g, own);
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const rnd = seeded(913);
  const glowSpots: { x: number; y: number; z: number; size?: number }[] = [];
  /** A number in [0, 1) from a place: the props' own variety, so the zone's random stream (and every other prop) is as it was. */
  const hv = (x: number, z: number, k = 0) => { const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
  /** Parts built round (0, 0) and put at (x, z) turned `yaw`, as one prop. */
  const at = (x: number, z: number, yaw: number) => {
    const put = { add: (m: THREE.Material, geo: THREE.BufferGeometry) => { kit.add(m, geo, x, 0, z, yaw); return put; } };
    return put;
  };
  const ico = (sx: number, sy: number, sz: number) => new THREE.IcosahedronGeometry(1, 0).scale(sx, sy, sz);
  /** The fires, for the tents' doors (a tent opens towards the camp's fire). */
  const fires = L.pieces.filter((pc) => pc.look === 'fire').map((pc) => pc.o);
  /** A crate's parts, `w` across and `hh` high: planks, dark battens on its corners and rims, braces across its sides, a brass band. */
  const crateParts = (P: ReturnType<typeof at>, w: number, hh: number, y0 = 0) => {
    const e = w / 2 - 0.05;
    P.add(wood, box(w - 0.06, hh - 0.06, w - 0.06).translate(0, y0 + 0.03, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add(darkWood, box(0.1, hh, 0.1).translate(sx * e, y0, sz * e));
    for (const y of [y0, y0 + hh - 0.08]) {
      for (const sz of [-1, 1]) P.add(darkWood, box(w, 0.08, 0.1).translate(0, y, sz * e));
      for (const sx of [-1, 1]) P.add(darkWood, box(0.1, 0.08, w).translate(sx * e, y, 0));
    }
    const diag = Math.atan2(w - 0.2, hh - 0.2), dl = Math.hypot(w - 0.2, hh - 0.2);
    for (const sz of [-1, 1]) P.add(plank, new THREE.BoxGeometry(0.08, dl, 0.04).rotateZ(diag * sz).translate(0, y0 + hh / 2, sz * (w / 2 + 0.01)));
    for (const sx of [-1, 1]) P.add(plank, new THREE.BoxGeometry(0.04, dl, 0.08).rotateX(diag * sx).translate(sx * (w / 2 + 0.01), y0 + hh / 2, 0));
    P.add(gold, box(w + 0.03, 0.05, w + 0.03).translate(0, y0 + hh * 0.5, 0));
  };

  for (const { look, o } of L.pieces) {
    const yaw = Math.atan2(o.bx - o.ax, o.bz - o.az), len = Math.hypot(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, r = o.r, h = o.height;
    switch (look) {
      case 'crate': {
        const cy = rnd() * 3; // its band turned with it (it was square to the world: its corners stood out of the crate's sides)
        // (2026-11-19) planks, battens, braces and a band; now and then a smaller crate or a sack on it
        const P = at(o.ax, o.az, cy), v = hv(o.ax, o.az);
        crateParts(P, r * 2, h);
        if (v < 0.35) { const P2 = at(o.ax + 0.1, o.az - 0.05, cy + 0.5); crateParts(P2, r * 1.25, h * 0.55, h); }
        else if (v < 0.6) P.add(sail, ico(0.42, 0.26, 0.34).translate(0.05, h + 0.2, 0)).add(rope, new THREE.TorusGeometry(0.1, 0.03, 4, 8).rotateX(Math.PI / 2).translate(0.05, h + 0.42, 0));
        break;
      }
      case 'barrel': {
        // (2026-11-19) staves that bulge, three hoops, a lid; one in three open, with the catch in it
        const prof = [[0.01, 0], [r * 0.84, 0], [r * 0.95, h * 0.22], [r, h * 0.5], [r * 0.95, h * 0.78], [r * 0.84, h], [0.01, h]].map(([a, b]) => new THREE.Vector2(a, b));
        const P = at(o.ax, o.az, hv(o.ax, o.az, 1) * 6);
        P.add(wood, new THREE.LatheGeometry(prof, 12));
        for (const [y, rr] of [[0.1, 0.87], [0.5, 1.0], [0.9, 0.87]]) P.add(iron, cyl(r * rr + 0.025, r * rr + 0.025, 0.06, 12).translate(0, h * y - 0.03, 0));
        if (hv(o.ax, o.az, 2) < 0.34) P.add(fish, cyl(r * 0.8, r * 0.8, 0.02, 12).translate(0, h - 0.06, 0)).add(fish, ico(0.22, 0.06, 0.07).translate(0.05, h - 0.02, 0.03));
        else P.add(darkWood, cyl(r * 0.82, r * 0.82, 0.03, 12).translate(0, h - 0.01, 0));
        break;
      }
      case 'rock': {
        const k = new THREE.IcosahedronGeometry(1, 0);
        kit.add(rock, k, o.ax, h * 0.3, o.az, rnd() * 6, r * 1.1, h * 0.7, r * 1.1).add(rock, k, o.ax + r * 0.5, h * 0.12, o.az - r * 0.3, rnd() * 6, r * 0.6, h * 0.38, r * 0.6);
        break;
      }
      case 'stall': {
        // (2026-11-19) a counter on trestles: its planked top with a brass edge, a cloth hung on its front, its goods along it (baskets
        // of the catch, a crate of fish, jars); under an awning in stripes when it has one
        const P = at(mx, mz, yaw), L2 = len + r * 2, top = h * 0.55, cloth = hv(mx, mz) < 0.5 ? wine : teal;
        for (const s of [-1, 1]) for (const t of [-0.42, 0.42]) P.add(darkWood, box(0.09, top - 0.06, 0.09).translate(t * r * 2, 0, s * (L2 / 2 - 0.15)));
        P.add(wood, box(r * 2 - 0.1, 0.07, L2 - 0.2).translate(0, top * 0.35, 0));
        P.add(plank, box(r * 2.3, 0.08, L2).translate(0, top - 0.08, 0)).add(gold, box(r * 2.34, 0.03, L2 + 0.04).translate(0, top - 0.03, 0));
        P.add(cloth, box(0.03, top * 0.55, L2 - 0.3).translate(r * 1.15 + 0.02, top * 0.4, 0));
        for (let k = 0, n = Math.max(1, Math.floor(L2 / 0.75)); k < n; k++) {
          const z = -L2 / 2 + (k + 0.5) * (L2 / n), v = hv(mx + k, mz, 3);
          if (v < 0.4) P.add(wood, cyl(0.22, 0.17, 0.2, 9).translate(0, top, z)).add(salt, cyl(0.19, 0.19, 0.03, 9).translate(0, top + 0.18, z));
          else if (v < 0.7) { P.add(plank, box(0.42, 0.12, 0.34).translate(0, top, z)); for (const f of [-0.1, 0, 0.1]) P.add(fish, ico(0.16, 0.04, 0.05).rotateY(0.3).translate(0, top + 0.13, z + f)); }
          else P.add(clay, new THREE.SphereGeometry(0.13, 8, 6).scale(1, 1.25, 1).translate(0, top + 0.16, z)).add(clay, cyl(0.05, 0.06, 0.08, 8).translate(0, top + 0.3, z));
        }
        if (h > 2) {
          // a pole at each end of the counter, under the awning's ends (one stood in its middle, the other half its length past its end)
          for (const s of [-1, 1]) kit.add(darkWood, cyl(0.07, 0.07, h, 5), mx + Math.sin(yaw) * (len / 2) * s, 0, mz + Math.cos(yaw) * (len / 2) * s);
          const stripe = rnd() < 0.5 ? wine : teal;
          for (let k = 0; k < 4; k++) P.add(k % 2 ? cream : stripe, new THREE.BoxGeometry(0.4, 0.06, len + 0.6).translate(-0.6 + k * 0.4, h, 0));
          P.add(stripe, new THREE.BoxGeometry(1.62, 0.22, 0.03).translate(0, h - 0.12, (len + 0.6) / 2)).add(stripe, new THREE.BoxGeometry(1.62, 0.22, 0.03).translate(0, h - 0.12, -(len + 0.6) / 2));
        }
        break;
      }
      case 'tent': {
        const spin = rnd() * 3; // (the stream's draw, as before)
        void spin;
        // (2026-11-19) its door towards the camp's fire (else towards the camera), the flap tied back, guy ropes to pegs, a coloured skirt,
        // the pole through its top with a gilt finial
        const R = r * 1.25, Hc = h * 1.4, f = fires.reduce<Obstacle | null>((b, c) => (!b || Math.hypot(c.ax - o.ax, c.az - o.az) < Math.hypot(b.ax - o.ax, b.az - o.az) ? c : b), null);
        const door = f && Math.hypot(f.ax - o.ax, f.az - o.az) < 18 ? Math.atan2(f.ax - o.ax, f.az - o.az) : 0;
        const P = at(o.ax, o.az, door), skirt = hv(o.ax, o.az) < 0.5 ? wine : teal;
        P.add(sail, new THREE.ConeGeometry(R, Hc, 10).translate(0, Hc / 2, 0));
        P.add(skirt, new THREE.CylinderGeometry(R * 0.93, R * 1.005, 0.3, 10, 1, true).translate(0, 0.15, 0));
        // the doorway: a dark triangle on the cone's face, towards +z (the fire)
        const dh = Math.min(1.5, Hc * 0.45), rb = R + 0.02, rt = R * (1 - dh / Hc) + 0.02, dw = 0.55;
        const dg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-dw, 0, rb), new THREE.Vector3(dw, 0, rb), new THREE.Vector3(0, dh, rt)]);
        dg.computeVertexNormals();
        const flap = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(dw, 0, rb), new THREE.Vector3(dw + 0.5, 0.05, rb - 0.25), new THREE.Vector3(0, dh, rt)]);
        flap.computeVertexNormals();
        P.add(darkWood, dg).add(sail, flap);
        P.add(darkWood, cyl(0.05, 0.05, Hc + 0.5, 5)).add(gold, new THREE.ConeGeometry(0.09, 0.22, 6).translate(0, Hc + 0.6, 0));
        for (const a of [Math.PI * 0.33, Math.PI, -Math.PI * 0.33]) {
          const ux = Math.sin(a), uz = Math.cos(a), ax = ux * R * 0.4, az = uz * R * 0.4, ay = Hc * 0.6, bx = ux * (R + 1.0), bz = uz * (R + 1.0), l = Math.hypot(bx - ax, ay, bz - az);
          P.add(rope, new THREE.CylinderGeometry(0.015, 0.015, l, 3).translate(0, l / 2, 0).rotateX(Math.acos(ay / l)).rotateY(a + Math.PI).translate(bx, 0, bz));
          P.add(darkWood, box(0.06, 0.2, 0.06).translate(bx, 0, bz));
        }
        break;
      }
      case 'house': {
        if (r >= 1.2) {
          // A cottage (a village's row): walls, gables and a pitched roof along its length, a chimney, a door and windows on both long
          // sides. (Drawn as a wall with a flat gold top, a village read as two long slabs.)
          const w = r * 2, d = len + r * 2, rh = w * 0.45, ux = Math.cos(yaw), uz = -Math.sin(yaw);
          kit.add(cream, box(w, h, d), mx, 0, mz, yaw);
          const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rh)]);
          kit.add(cream, new THREE.ExtrudeGeometry(gable, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), mx, h, mz, yaw);
          const slope = Math.hypot(w / 2 + 0.35, rh + 0.25), ang = Math.atan2(rh + 0.25, w / 2 + 0.35), roof = [wine, teal, stone][Math.floor(rnd() * 3)];
          for (const s of [-1, 1]) kit.add(roof, new THREE.BoxGeometry(slope, 0.18, d + 0.6).translate(0, 0.09, 0).rotateZ(-s * ang).translate(s * (w / 4 + 0.05), rh / 2 + 0.02, 0), mx, h - 0.1, mz, yaw);
          kit.add(gold, new THREE.BoxGeometry(0.12, 0.12, d + 0.65).translate(0, rh + 0.22, 0), mx, h, mz, yaw);
          kit.add(stone, box(0.55, rh + 1.1, 0.55), mx + ux * w * 0.22 + Math.sin(yaw) * d * 0.25, h, mz + uz * w * 0.22 + Math.cos(yaw) * d * 0.25);
          for (const s of [-1, 1]) {
            const fx = mx + ux * s * (w / 2 + 0.03), fz = mz + uz * s * (w / 2 + 0.03);
            kit.add(darkWood, box(0.08, 1.9, 1.0), fx, 0, fz, yaw);
            for (const t of [-1, 1]) kit.add(iron, box(0.07, 0.8, 0.7), fx + Math.sin(yaw) * t * d * 0.3, 1.2, fz + Math.cos(yaw) * t * d * 0.3, yaw).add(gold, box(0.09, 0.06, 0.82), fx + Math.sin(yaw) * t * d * 0.3, 1.15, fz + Math.cos(yaw) * t * d * 0.3, yaw);
          }
          break;
        }
        kit.add(cream, box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add(gold, box(r * 2.3, 0.1, len + r * 2.3), mx, h, mz, yaw);
        // fallen blocks at its foot
        kit.add(stone, box(0.7, 0.5, 0.9), mx + 0.9, 0, mz + 0.6, rnd() * 3).add(stone, box(0.9, 0.4, 0.6), mx - 1.1, 0, mz - 0.7, rnd() * 3);
        {
          // (2026-11-19) a stone footing, buttresses every 4 m on both faces, a coping of stones along its top under the gilt edge, the
          // courses of its blocks drawn as shallow grooves
          const P = at(mx, mz, yaw), Lw = len + r * 2;
          P.add(stone, box(r * 2 + 0.24, 0.45, Lw + 0.1));
          P.add(stone, box(r * 2 + 0.14, 0.16, Lw + 0.06).translate(0, h - 0.17, 0));
          for (let z = -Lw / 2 + 2; z < Lw / 2 - 1; z += 4) for (const s of [-1, 1]) P.add(cream, box(0.4, h * 0.82, 0.7).translate(s * (r + 0.18), 0, z)).add(stone, box(0.46, 0.14, 0.76).translate(s * (r + 0.18), h * 0.82, z));
          for (let y = 0.95; y < h - 0.4; y += 0.6) for (const s of [-1, 1]) P.add(darkWood, box(0.02, 0.03, Lw - 0.1).translate(s * (r + 0.005), y, 0));
        }
        break;
      }
      case 'hull': {
        // a ship on its side: a long wooden body, ribs standing up along it, a broken mast
        // (2026-11-19: a boat's shape, its planked hull rolled on its side with a pale strake and a keel; it was two boxes)
        {
          const P = at(mx, mz, yaw), half = len / 2 + r, roll = 0.95;
          const hullG = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(r * 1.15, h * 0.95, half).rotateZ(-roll).translate(0, h * 0.62, 0);
          P.add(darkWood, hullG);
          P.add(wood, new THREE.TorusGeometry(1, 0.06, 4, 24, Math.PI).scale(r * 1.15, 1, half).rotateX(Math.PI / 2).rotateZ(-roll).translate(0, h * 0.62, 0));
          P.add(wood, new THREE.TorusGeometry(1, 0.05, 4, 24, Math.PI).scale(r * 1.0, 1, half * 0.95).rotateX(Math.PI / 2).translate(0, -h * 0.35, 0).rotateZ(-roll).translate(0, h * 0.62, 0));
          P.add(darkWood, box(0.18, 0.2, half * 1.9).translate(0, 0, 0).rotateZ(-roll).translate(Math.sin(roll) * h * 0.92, h * 0.62 - Math.cos(roll) * h * 0.92, 0));
        }
        for (let k = 0; k <= 6; k++) {
          const t = k / 6, x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t;
          // the ribs lean in across the hull, each side towards the other (they leaned along the world's z, whatever the hull's heading)
          kit.add(wood, cyl(0.12, 0.2, h * 1.4, 5), x + Math.cos(yaw) * r * 0.9, 0, z - Math.sin(yaw) * r * 0.9, yaw + Math.PI / 2, 1, 1, 1, -0.3).add(wood, cyl(0.12, 0.2, h * 1.2, 5), x - Math.cos(yaw) * r * 0.9, 0, z + Math.sin(yaw) * r * 0.9, yaw + Math.PI / 2, 1, 1, 1, 0.3);
        }
        kit.add(darkWood, cyl(0.2, 0.3, 6, 6), mx, 1.5, mz, yaw, 1, 1, 1, 1.15);
        break;
      }
      case 'fire': {
        // (2026-11-19) a ring of stones round the ash, a tepee of logs, the flame, and a tripod with the kettle over it (it was a slab)
        const P = at(o.ax, o.az, hv(o.ax, o.az) * 6);
        P.add(iron, cyl(r * 0.78, r * 0.82, 0.06, 12));
        for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2, rr = r * 0.88; P.add(rock, ico(0.2 + hv(o.ax, o.az, k) * 0.08, 0.15, 0.18).rotateY(a).translate(Math.sin(a) * rr, 0.1, Math.cos(a) * rr)); }
        for (const a of [0.3, 2.4, 4.5]) P.add(darkWood, new THREE.CylinderGeometry(0.07, 0.09, 1.0, 5).translate(0, 0.5, 0).rotateX(0.62).rotateY(a).translate(Math.sin(a) * 0.32, 0.02, Math.cos(a) * 0.32));
        P.add(gold, new THREE.ConeGeometry(0.3, 0.8, 6).translate(0, 0.5, 0)).add(gold, new THREE.ConeGeometry(0.16, 0.5, 5).translate(0.14, 0.36, -0.08));
        for (const a of [0, 2.1, 4.2]) P.add(iron, new THREE.CylinderGeometry(0.025, 0.025, 1.75, 4).translate(0, 0.87, 0).rotateX(-0.36).rotateY(a).translate(Math.sin(a) * 0.62, 0, Math.cos(a) * 0.62));
        P.add(iron, cyl(0.012, 0.012, 0.42, 3).translate(0, 1.22, 0)).add(iron, new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65).translate(0, 1.05, 0)).add(iron, new THREE.TorusGeometry(0.17, 0.012, 3, 10, Math.PI).translate(0, 1.18, 0));
        glowSpots.push({ x: o.ax, y: 1.2, z: o.az, size: 7 });
        break;
      }
      case 'post':
        kit.add(darkWood, cyl(r * 0.8, r, h, 7), o.ax, 0, o.az).add(gold, cyl(r * 1.05, r * 1.05, 0.12, 7), o.ax, h * 0.7, o.az);
        glowSpots.push({ x: o.ax, y: h + 0.2, z: o.az, size: 1.4 });
        break;
      case 'lighthouse': {
        kit.add(cream, new THREE.CylinderGeometry(2.0, 2.9, 11, 12).translate(0, 5.5, 0), o.ax, 0, o.az).add(wine, new THREE.CylinderGeometry(1.7, 2.0, 2.4, 12).translate(0, 11 + 1.2, 0), o.ax, 0, o.az);
        kit.add(cream, new THREE.CylinderGeometry(1.45, 1.7, 2.6, 12).translate(0, 13.4 + 1.3, 0), o.ax, 0, o.az).add(gold, new THREE.CylinderGeometry(2.3, 2.3, 0.22, 12).translate(0, 16.1, 0), o.ax, 0, o.az);
        kit.add(iron, new THREE.ConeGeometry(1.8, 1.4, 12).translate(0, 17.9, 0), o.ax, 0, o.az).add(wine, new THREE.CylinderGeometry(2.1, 2.9, 0.5, 12).translate(0, 4, 0), o.ax, 0, o.az);
        // the lantern room's posts, from the gallery up to the roof (the roof floated a metre over the gallery on nothing)
        for (let k = 0; k < 6; k++) kit.add(iron, cyl(0.06, 0.06, 1.04, 5), o.ax + Math.cos((k / 6) * Math.PI * 2) * 1.32, 16.18, o.az + Math.sin((k / 6) * Math.PI * 2) * 1.32);
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
  // The paths' edges are lit at the places: a lantern post at each plaza's rim, towards the middle, turned along the rim until it stands
  // off the roads' middles, the floor's spots and the cover (it stood on the road into the plaza, and on a person or a waystone).
  const roads: [number, number, number, number][] = [];
  for (const pth of L.paths) for (let i = 1; i < pth.length; i++) roads.push([RING.x + pth[i - 1][0], RING.z + pth[i - 1][1], RING.x + pth[i][0], RING.z + pth[i][1]]);
  const clearAt = (x: number, z: number) => roads.every(([ax, az, bx, bz]) => segDist(x, z, ax, az, bx, bz) > 2.3) && keep.every((k) => Math.hypot(k.x - x, k.z - z) > 1.6)
    && L.pieces.every((pc) => segDist(x, z, pc.o.ax, pc.o.az, pc.o.bx, pc.o.bz) > pc.o.r + 0.4);
  for (const pl of L.places) {
    const a0 = Math.atan2(RING.x - pl.x, RING.z - pl.z), rr = pl.r - 1;
    let a = a0; // (if no turn of it is clear, as it was)
    if (!clearAt(pl.x + Math.sin(a0) * rr, pl.z + Math.cos(a0) * rr)) for (let k = 1; k <= 18; k++) {
      const t = a0 + Math.ceil(k / 2) * 0.3 * (k % 2 ? 1 : -1);
      if (clearAt(pl.x + Math.sin(t) * rr, pl.z + Math.cos(t) * rr)) { a = t; break; }
    }
    const x = pl.x + Math.sin(a) * rr, z = pl.z + Math.cos(a) * rr;
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
    // A copy that would stand in one drawn before it (two piles of chests in each other) is left out.
    const stood: { x: number; z: number; r: number }[] = [];
    for (const p of L.props ?? []) {
      const src = loaded.cover[p.i], from = ORIGINAL[p.i];
      if (!src) continue;
      const ob = HARBOUR_OBSTACLES[p.i], reach = ob ? Math.hypot(ob.bx - ob.ax, ob.bz - ob.az) / 2 + ob.r : 1.2, px = RING.x + p.dx, pz = RING.z + p.dz;
      if (stood.some((q) => Math.hypot(q.x - px, q.z - pz) < (q.r + reach) * 0.8)) continue;
      stood.push({ x: px, z: pz, r: reach });
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
export function seaArena(id: string, name: string, look: SeaLook, keep: { x: number; z: number }[] = []): ArenaDef {
  // The ring is the circle round the whole outline: the walk's box and the checks' grid; the outline's own walls keep a walk inside it.
  return { id, name, ring: Math.ceil(Math.max(...rimOf(look)) + 1.5), obstacles: look.pieces.map((p) => p.o), stage: STAGE, hideGround: true, build: () => buildSeaZone(look, keep) };
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
