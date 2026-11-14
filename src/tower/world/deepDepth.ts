import * as THREE from 'three';
import { RING, seeded } from '../../arenas/common';
import { Glows } from '../../arenas/real';
import type { DeepLook } from './deepZone';
import { rimAt } from './land';

/**
 * The Deep's depth (floors 31 to 40; the user, 2026-11-14: "add depth into the worlds, make all the background fit there, all the roads
 * and zones, make them look like they fit there, don't be shy"): the cave dressed as a mine people worked in. Looks only, never cover:
 * nothing here stops a walk or a shot. It keeps off the zone's cover, the tracks' beds, the places' stands and the pools, and on ground a
 * hero walks on it puts only low or thin things (a cart, a crate, timber or a hut is cover in the Deep: a walk-through one would lie).
 *
 * - The tracks: timber frames across them (some with a hanging lamp), points levers where two meet, buffers where one ends in the yard,
 *   and along the verges spilled ore, sacks, rope coils, pick-axes and loose sleepers.
 * - The places: the miners' rest (pallet bunks, a stove with its kettle, a table, lamps on a line), the cart yard (spare rails, wheel
 *   sets, sleepers, ore, a winch), the landing (a jetty out over the black water, a moored boat, nets, bollards), the glow pools (pale
 *   reeds, mushrooms, a few glowing fungi), the old shaft (the head-frame's beams and wheel, its rope to a winch), the halls (crystal
 *   chips at the wall's foot), the camp (sacks and rope).
 * - The cave: rubble and scree at the wall's foot, tipped carts against it, puddles, glowing fungi, ledges and boulders on the slopes,
 *   gold veins in the rock; stalactites hanging far overhead; an arch in the north wall onto a second cavern; a waterfall into the black
 *   lake, glints on it and its far shore; bats.
 * - The dark law is the look: about a dozen new glows a floor (lamps on the tracks and at the rest, the jetty's lamp, a few fungi, the far
 *   cavern), so the crystals, the lamps and the waystones stay what a player steers by.
 *
 * Speed: every prop shape is built once; each placement is copied straight into one merged mesh, all on one material (the unlit parts and
 * the gold's warmth ride on each vertex), per quarter of the floor, near or far (the camera sees one or two quarters). None of it casts a
 * shadow: a handful of draw calls in view. The trade: the gold is matte with a faint warmth, not polished metal. Nothing is allocated
 * per frame. (Meshes per 24 or 40 m square, or folded into the zone's own dressing squares, cost the phone profile 2 to 2.6 ms a frame on
 * floor 31: the scree reaches every square, and each square drew twice, for the picture and the shadows, some 25 draw calls more.)
 */

/** The cave's shape, as deepZone.ts's `caveOf` gives it (offsets from the middle). */
export interface DeepCave {
  beyond(dx: number, dz: number): number;
  water(dx: number, dz: number): number;
  south(dx: number, dz: number): number;
  north(dx: number, dz: number): number;
  height(dx: number, dz: number): number;
}
export interface DeepDepthIn {
  look: DeepLook;
  cave: DeepCave;
  into: THREE.Group;
  own: { dispose(): void }[];
  /** The black water's level (m). */
  waterLevel: number;
  /** The floor's spots its looks keep clear of (keep.ts: people, packs, quests, doors...), in world coordinates. */
  keep?: { x: number; z: number }[];
}

const COL = {
  rock: '#3a3a4c', rockLight: '#4c4a60', rockDark: '#2c2c3a', pale: '#b8b2cc', paleDark: '#8e88a6', wood: '#4a3626', plank: '#5a3c26',
  darkWood: '#2a1f1a', cloth: '#4a3a6a', cream: '#a89e86', sack: '#6e604a', rope: '#9a8250', iron: '#2a2c34', rail: '#55586a', gold: '#c9a24a',
  ore: '#262632', reed: '#77748a', capPale: '#5e5872', scree: '#625e78', glass: '#ffcf80', ember: '#ff9a40', violet: '#7a52c8', fungus: '#5fc8d0', black: '#020205',
  stalactite: '#262634', puddle: '#323a54', foam: '#8a96b4', net: '#6e5c3a',
} as const;
type Hex = (typeof COL)[keyof typeof COL];

/** One prop shape: positions, normals and colours, not indexed. Built once, copied per placement. */
interface Proto { pos: Float32Array; nor: Float32Array; col: Float32Array }
function proto(parts: [THREE.BufferGeometry, Hex][]): Proto {
  let n = 0;
  const list = parts.map(([g, hex]) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    if (!ng.attributes.normal) ng.computeVertexNormals();
    n += ng.attributes.position.count;
    return { g: ng, c: new THREE.Color(hex) };
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const { g, c } of list) {
    const k = g.attributes.position.count;
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += k;
    g.dispose();
  }
  return { pos, nor, col };
}

/**
 * How a placement is lit. All go into one material: `low` and `tall` matte, `metal` the gold (its faint warmth), `glow` unlit (lamp glass,
 * fungi, crystal chips: reads as lit, adds no light), `wet` the puddles (a faint sheen of their own). The difference rides on each vertex (`glow`, 0 to 1).
 */
type Bucket = 'low' | 'tall' | 'metal' | 'glow' | 'wet';
const GLOW: Record<Bucket, number> = { low: 0, tall: 0, metal: 0.2, glow: 1, wet: 0.3 };

/** Placements merged into one mesh per quarter of the floor, near or far, copied in one pass at the end. */
class Batch {
  private cells = new Map<number, { p: Proto[]; e: number[]; g: number[] }>();
  private M = new THREE.Matrix4();
  private Q = new THREE.Quaternion();
  private E = new THREE.Euler();
  private V = new THREE.Vector3();
  private S = new THREE.Vector3();
  /** `far`: past this far from the middle a placement is 'far' (the slopes, the ceiling, the lake). */
  constructor(private far: number) {}
  put(b: Bucket, p: Proto, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0) {
    // the camera sees one or two quarters
    const dx = x - RING.x, dz = z - RING.z, key = (dx < 0 ? 0 : 1) + (dz < 0 ? 0 : 2) + (dx * dx + dz * dz > this.far * this.far ? 4 : 0);
    let bin = this.cells.get(key);
    if (!bin) this.cells.set(key, (bin = { p: [], e: [], g: [] }));
    this.M.compose(this.V.set(x, y, z), this.Q.setFromEuler(this.E.set(tilt, yaw, roll, 'YXZ')), this.S.set(sx, sy, sz));
    bin.p.push(p);
    bin.g.push(GLOW[b]);
    for (let i = 0; i < 16; i++) bin.e.push(this.M.elements[i]);
  }
  build(into: THREE.Group, own: { dispose(): void }[], material: THREE.Material) {
    let draws = 0, verts = 0;
    for (const bin of this.cells.values()) {
      let n = 0;
      for (const p of bin.p) n += p.pos.length;
      const pos = new Float32Array(n), nor = new Float32Array(n), col = new Float32Array(n), glow = new Float32Array(n / 3);
      let o = 0;
      bin.p.forEach((p, k) => {
        const e = bin.e, j = k * 16;
        const a0 = e[j], a1 = e[j + 1], a2 = e[j + 2], a4 = e[j + 4], a5 = e[j + 5], a6 = e[j + 6], a8 = e[j + 8], a9 = e[j + 9], a10 = e[j + 10];
        const tx = e[j + 12], ty = e[j + 13], tz = e[j + 14];
        const P = p.pos, N = p.nor;
        for (let i = 0; i < P.length; i += 3) {
          const x = P[i], y = P[i + 1], z = P[i + 2];
          pos[o + i] = a0 * x + a4 * y + a8 * z + tx;
          pos[o + i + 1] = a1 * x + a5 * y + a9 * z + ty;
          pos[o + i + 2] = a2 * x + a6 * y + a10 * z + tz;
          const nx = N[i], ny = N[i + 1], nz = N[i + 2];
          const X = a0 * nx + a4 * ny + a8 * nz, Y = a1 * nx + a5 * ny + a9 * nz, Z = a2 * nx + a6 * ny + a10 * nz, l = Math.sqrt(X * X + Y * Y + Z * Z) || 1;
          nor[o + i] = X / l; nor[o + i + 1] = Y / l; nor[o + i + 2] = Z / l;
        }
        col.set(p.col, o);
        glow.fill(bin.g[k], o / 3, (o + P.length) / 3);
        o += P.length;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
      verts += n / 3;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.receiveShadow = true;
      into.add(mesh);
      own.push(geo);
      draws++;
    }
    this.cells.clear();
    return { draws, verts };
  }
}

// --- shapes, standing on y = 0 unless said ----------------------------------------------------------------------------------------
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const boxAt = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (r0: number, r1: number, h: number, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const oct = (r: number, h: number) => new THREE.OctahedronGeometry(1).scale(r, h / 2, r).translate(0, h / 2, 0);

type Seg = { ax: number; az: number; bx: number; bz: number; r: number; tag: number };
const segDist = (px: number, pz: number, s: { ax: number; az: number; bx: number; bz: number }) => {
  const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - s.ax) * ex + (pz - s.az) * ez) / l2)) : 0;
  return Math.hypot(px - (s.ax + ex * t), pz - (s.az + ez * t));
};

/** Segments with a radius in a grid of `size` m squares, each kept in every square within `reach` of it: a query looks at one square. */
class SegGrid {
  private cells = new Map<number, Seg[]>();
  constructor(private size: number, private reach: number) {}
  private key(i: number, j: number) { return (i + 512) * 1024 + j + 512; }
  add(s: Seg) {
    const g = this.reach + s.r, s0 = this.size;
    for (let i = Math.floor((Math.min(s.ax, s.bx) - g) / s0); i <= Math.floor((Math.max(s.ax, s.bx) + g) / s0); i++) {
      for (let j = Math.floor((Math.min(s.az, s.bz) - g) / s0); j <= Math.floor((Math.max(s.az, s.bz) + g) / s0); j++) {
        const k = this.key(i, j);
        let c = this.cells.get(k);
        if (!c) this.cells.set(k, (c = []));
        c.push(s);
      }
    }
  }
  /** The clearance from (x, z) to the nearest segment's edge (up to `reach`; further is `reach`). `skip`: a tag to leave out. */
  clear(x: number, z: number, skip = -1) {
    const c = this.cells.get(this.key(Math.floor(x / this.size), Math.floor(z / this.size)));
    let best = this.reach;
    if (c) for (const s of c) if (s.tag !== skip) best = Math.min(best, segDist(x, z, s) - s.r);
    return best;
  }
}

/** Dresses a Deep zone. Returns the update for its moving things (bats, the waterfall, the glints, the glows). */
export function buildDeepDepth(o: DeepDepthIn) {
  const t0 = performance.now(), laps: Record<string, number> = {};
  let tl = t0;
  const mark = (k: string) => { const t = performance.now(); laps[k] = +(t - tl).toFixed(1); tl = t; };
  const { look, cave } = o;
  const rnd = seeded(9013 + look.seed);
  const rim = look.rim, m = look.mirror;
  const rmean = rim.reduce((s, r) => s + r, 0) / rim.length, rmax = Math.max(...rim), around = 2 * Math.PI * rmean;
  const group = new THREE.Group();
  group.name = 'deep-depth';
  o.into.add(group);
  const batch = new Batch(rmax + 4);
  const warm: { x: number; y: number; z: number; size?: number }[] = [];
  const cool: { x: number; y: number; z: number; size?: number }[] = [];
  const fungi: { x: number; y: number; z: number; size?: number }[] = [];
  /** Props taller than a pebble on or near walkable ground, for the spot check (`group.userData.props`). */
  const props: { x: number; z: number; r: number; h: number }[] = [];

  // --- the cave, in world coordinates ---------------------------------------------------------------------------------------------
  const B = (x: number, z: number) => cave.beyond(x - RING.x, z - RING.z);
  const H = (x: number, z: number) => cave.height(x - RING.x, z - RING.z);
  const Wt = (x: number, z: number) => cave.water(x - RING.x, z - RING.z);
  const So = (x: number, z: number) => cave.south(x - RING.x, z - RING.z);
  const No = (x: number, z: number) => cave.north(x - RING.x, z - RING.z);
  /** A point `b` m past the outline in direction `a` (radians, atan2(dz, dx)), world. */
  const out = (a: number, b: number) => { const r = rimAt(rim, a) + b; return { x: RING.x + Math.cos(a) * r, z: RING.z + Math.sin(a) * r }; };
  /** The yaw that turns a shape's +z towards (dx, dz). */
  const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);

  const cover = new SegGrid(8, 4);
  look.pieces.forEach(({ o: c }, i) => { if (look.kinds[i] !== 'edge') cover.add({ ax: c.ax, az: c.az, bx: c.bx, bz: c.bz, r: c.r, tag: -2 }); });
  const roads = new SegGrid(8, 6);
  const tracks = look.paths.map((p) => p.map(([dx, dz]) => ({ x: RING.x + dx, z: RING.z + dz })));
  tracks.forEach((p, k) => { for (let i = 1; i < p.length; i++) roads.add({ ax: p[i - 1].x, az: p[i - 1].z, bx: p[i].x, bz: p[i].z, r: 0, tag: k }); });
  const BACK: Record<string, number> = { hall: 5.5, shore: 3, pools: 4, yard: 4, rest: 0, shaft: 0, well: 0, camp: 0 };
  const stands = look.places.map((p) => {
    const dx = RING.x - p.x, dz = RING.z - p.z, l = Math.hypot(dx, dz) || 1, b = BACK[p.kind ?? ''] ?? 0;
    return { x: p.x + (dx / l) * b, z: p.z + (dz / l) * b, r: p.kind === 'camp' ? p.r + 0.5 : 3.5 };
  });
  const inPool = (x: number, z: number, pad: number) => look.pools.some((f) => {
    const c = Math.cos(-(f.rot ?? 0)), s = Math.sin(-(f.rot ?? 0)), lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
    return Math.hypot(lx / (f.rx + pad), lz / (f.rz + pad)) < 1;
  });
  const inPlace = (x: number, z: number, pad: number) => look.places.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);
  /** Free walkable ground for a look: `inside` m inside the outline, off cover by `pad`, off the tracks' beds, the stands and the pools. */
  const free = (x: number, z: number, pad: number, q: { road?: number; place?: number; inside?: number; stand?: boolean } = {}) => {
    if (B(x, z) > -(q.inside ?? 1)) return false;
    if (cover.clear(x, z) < pad) return false;
    if (roads.clear(x, z) < (q.road ?? 2.3) + pad) return false;
    if (q.place !== undefined && inPlace(x, z, q.place)) return false;
    if (q.stand !== false && stands.some((s) => Math.hypot(x - s.x, z - s.z) < s.r)) return false;
    return !inPool(x, z, 0.4);
  };
  const tall = (x: number, z: number, r: number, h: number) => props.push({ x: +x.toFixed(2), z: +z.toFixed(2), r, h });

  mark('cave');
  // --- the shapes ---------------------------------------------------------------------------------------------------------------
  /** A clump of mushrooms: x, z, stem height, cap radius. */
  const CAPS = [[0, 0, 0.32, 0.14], [0.22, 0.1, 0.22, 0.1], [-0.16, 0.14, 0.18, 0.09], [0.05, -0.2, 0.14, 0.07]];
  const S = {
    // a timber frame across a track: two posts, a cap beam, knee braces (+x across the track)
    frame: proto([
      [boxAt(0.22, 3.05, 0.22, -2.35, 1.52, 0), COL.wood], [boxAt(0.22, 3.05, 0.22, 2.35, 1.52, 0), COL.wood],
      [boxAt(5.1, 0.26, 0.3, 0, 3.1, 0), COL.darkWood],
      [boxAt(0.12, 1.0, 0.12, 0, 0, 0).rotateZ(0.8).translate(-1.95, 2.72, 0), COL.darkWood], [boxAt(0.12, 1.0, 0.12, 0, 0, 0).rotateZ(-0.8).translate(1.95, 2.72, 0), COL.darkWood],
    ]),
    frameGold: proto([[boxAt(0.36, 0.3, 0.34, 0, 3.1, 0), COL.gold], [boxAt(0.3, 0.06, 0.3, -2.35, 0.25, 0), COL.gold], [boxAt(0.3, 0.06, 0.3, 2.35, 0.25, 0), COL.gold]]),
    // a lamp hanging from a beam or a line: its chain and body, its glass, its cap
    lampBody: proto([[boxAt(0.03, 0.6, 0.03, 0, 2.7, 0), COL.iron], [boxAt(0.26, 0.06, 0.26, 0, 2.05, 0), COL.iron]]),
    lampGlass: proto([[boxAt(0.2, 0.28, 0.2, 0, 2.22, 0), COL.glass]]),
    lampCap: proto([[new THREE.ConeGeometry(0.19, 0.16, 4).rotateY(Math.PI / 4).translate(0, 2.44, 0), COL.gold]]),
    sack: proto([[new THREE.SphereGeometry(1, 7, 4).scale(0.3, 0.36, 0.25).translate(0, 0.33, 0), COL.sack], [cyl(0.07, 0.1, 0.14, 6).translate(0, 0.64, 0), COL.sack], [new THREE.TorusGeometry(0.08, 0.025, 4, 8).rotateX(Math.PI / 2).translate(0, 0.66, 0), COL.rope]]),
    sackLying: proto([[new THREE.SphereGeometry(1, 7, 4).scale(0.42, 0.2, 0.28).translate(0, 0.18, 0), COL.sack], [cyl(0.07, 0.09, 0.16, 6).rotateZ(Math.PI / 2).translate(0.48, 0.18, 0), COL.sack]]),
    coil: proto([[new THREE.TorusGeometry(0.3, 0.07, 6, 14).rotateX(Math.PI / 2).translate(0, 0.07, 0), COL.rope], [new THREE.TorusGeometry(0.22, 0.06, 6, 12).rotateX(Math.PI / 2).translate(0.03, 0.19, 0), COL.rope]]),
    // a pick-axe lying flat: its handle along +z, its iron head across the end, a gold ferrule
    pick: proto([[boxAt(0.06, 0.06, 1.0, 0, 0.04, 0), COL.wood], [boxAt(0.62, 0.06, 0.08, 0, 0.05, 0.48).rotateY(0), COL.iron]]),
    pickGold: proto([[boxAt(0.09, 0.09, 0.08, 0, 0.05, 0.4), COL.gold]]),
    ore: proto([
      [ico(0.28).scale(1, 0.6, 1).translate(0, 0.12, 0), COL.ore], [ico(0.2).scale(1, 0.6, 1).translate(0.3, 0.08, 0.12), COL.rock], [ico(0.18).scale(1, 0.6, 1).translate(-0.26, 0.07, 0.2), COL.ore],
      [ico(0.14).translate(0.1, 0.05, -0.3), COL.rockDark], [ico(0.12).translate(-0.18, 0.04, -0.22), COL.ore],
    ]),
    chips: proto([[oct(0.07, 0.24).rotateZ(0.4).translate(0.05, 0.02, 0), COL.violet], [oct(0.06, 0.2).rotateX(-0.5).translate(-0.12, 0.02, 0.1), COL.violet], [oct(0.05, 0.16).rotateZ(-0.6).translate(0.02, 0.02, -0.14), COL.violet]]),
    sleeper: proto([[box(0.26, 0.14, 2.1), COL.wood]]),
    // a mine cart on its side: its open top towards +x, its bottom and wheels towards -x, its length along z
    tipped: proto([
      [boxAt(0.75, 1.0, 1.5, 0.375, 0.5, 0), COL.iron], [boxAt(0.08, 1.08, 1.58, 0.77, 0.5, 0), COL.darkWood],
      ...[0.07, 0.93].flatMap((y) => [-0.55, 0.55].map((z) => [new THREE.CylinderGeometry(0.26, 0.26, 0.14, 8).translate(-0.12, y, z), COL.darkWood] as [THREE.BufferGeometry, Hex])),
    ]),
    // a buffer stop: two posts, a beam, earth heaped behind (the track runs along +z towards it)
    buffer: proto([[boxAt(0.2, 0.9, 0.2, -0.6, 0.45, 0), COL.darkWood], [boxAt(0.2, 0.9, 0.2, 0.6, 0.45, 0), COL.darkWood], [boxAt(1.6, 0.32, 0.3, 0, 0.62, -0.05), COL.wood], [ico(0.8).scale(1.2, 0.45, 0.8).translate(0, 0.1, 0.75), COL.ore]]),
    bufferGold: proto([[boxAt(0.4, 0.2, 0.05, -0.45, 0.62, -0.22), COL.gold], [boxAt(0.4, 0.2, 0.05, 0.45, 0.62, -0.22), COL.gold]]),
    // the points' lever: an iron stand, a lever, a gold knob
    lever: proto([[box(0.4, 0.32, 0.3), COL.iron], [boxAt(0.05, 0.95, 0.05, 0, 0, 0).rotateZ(0.35).translate(0.14, 0.72, 0), COL.iron]]),
    leverGold: proto([[new THREE.SphereGeometry(0.07, 6, 4).translate(0.31, 1.17, 0), COL.gold]]),
    rails: proto([
      [boxAt(0.3, 0.12, 0.3, 0, 0.06, -1.5), COL.wood], [boxAt(0.3, 0.12, 0.3, 0, 0.06, 1.5), COL.wood],
      ...[-0.36, -0.12, 0.12, 0.36].map((x) => [boxAt(0.09, 0.12, 4.2, x, 0.18, 0), COL.rail] as [THREE.BufferGeometry, Hex]),
      ...[-0.24, 0, 0.24].map((x) => [boxAt(0.09, 0.12, 4.2, x, 0.3, 0), COL.rail] as [THREE.BufferGeometry, Hex]),
    ]),
    wheelset: proto([[new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6).rotateZ(Math.PI / 2).translate(0, 0.3, 0), COL.iron], [new THREE.CylinderGeometry(0.3, 0.3, 0.09, 10).rotateZ(Math.PI / 2).translate(-0.55, 0.3, 0), COL.darkWood], [new THREE.CylinderGeometry(0.3, 0.3, 0.09, 10).rotateZ(Math.PI / 2).translate(0.55, 0.3, 0), COL.darkWood]]),
    sleepers: proto([0, 1, 2].flatMap((k) => [-0.45, 0, 0.45].map((s) => [k % 2 ? boxAt(2.1, 0.15, 0.26, 0, 0.075 + k * 0.15, s) : boxAt(0.26, 0.15, 2.1, s, 0.075 + k * 0.15, 0), COL.wood] as [THREE.BufferGeometry, Hex]))),
    // a winch: two timber cheeks, a drum of rope, a crank
    winch: proto([[boxAt(0.14, 1.1, 0.9, -0.7, 0.55, 0), COL.wood], [boxAt(0.14, 1.1, 0.9, 0.7, 0.55, 0), COL.wood], [new THREE.CylinderGeometry(0.3, 0.3, 1.26, 10).rotateZ(Math.PI / 2).translate(0, 0.85, 0), COL.rope], [boxAt(0.06, 0.45, 0.06, 0.82, 0.68, 0.18), COL.iron]]),
    winchGold: proto([[new THREE.CylinderGeometry(0.33, 0.33, 0.05, 10).rotateZ(Math.PI / 2).translate(-0.6, 0.85, 0), COL.gold], [new THREE.CylinderGeometry(0.33, 0.33, 0.05, 10).rotateZ(Math.PI / 2).translate(0.6, 0.85, 0), COL.gold]]),
    // the rest's stove: an iron drum on legs, its pipe, a kettle; the fire's mouth
    stove: proto([[cyl(0.36, 0.36, 0.75, 10).translate(0, 0.18, 0), COL.iron], ...[0, 1, 2].map((k) => [boxAt(0.06, 0.2, 0.06, Math.cos(k * 2.1) * 0.28, 0.1, Math.sin(k * 2.1) * 0.28), COL.iron] as [THREE.BufferGeometry, Hex]), [cyl(0.07, 0.07, 2.1, 6).translate(-0.18, 0.93, -0.12), COL.iron], [cyl(0.17, 0.13, 0.2, 8).translate(0.1, 0.93, 0.08), COL.iron]]),
    stoveGold: proto([[new THREE.TorusGeometry(0.37, 0.025, 4, 14).rotateX(Math.PI / 2).translate(0, 0.93, 0), COL.gold], [new THREE.TorusGeometry(0.09, 0.015, 4, 8).translate(0.1, 1.2, 0.08), COL.gold]]),
    stoveFire: proto([[boxAt(0.24, 0.16, 0.04, 0, 0.45, 0.35), COL.ember]]),
    bunk: proto([[box(2.0, 0.32, 0.9), COL.wood], [boxAt(1.7, 0.16, 0.72, 0.08, 0.4, 0), COL.cloth], [boxAt(0.36, 0.14, 0.6, -0.78, 0.4, 0), COL.cream]]),
    table: proto([[boxAt(1.6, 0.08, 0.8, 0, 0.74, 0), COL.plank], ...[[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]].map(([x, z]) => [boxAt(0.08, 0.72, 0.08, x, 0.36, z), COL.darkWood] as [THREE.BufferGeometry, Hex]), [cyl(0.2, 0.2, 0.45, 8).translate(-0.5, 0, 0.75), COL.wood], [cyl(0.2, 0.2, 0.45, 8).translate(0.5, 0, -0.75), COL.wood], [cyl(0.06, 0.05, 0.12, 6).translate(0.3, 0.78, 0.1), COL.cream]]),
    pole: proto([[cyl(0.07, 0.09, 3.2, 6), COL.darkWood]]),
    poleGold: proto([[cyl(0.11, 0.11, 0.08, 6).translate(0, 3.2, 0), COL.gold]]),
    unitWood: proto([[new THREE.BoxGeometry(1, 1, 1), COL.wood]]),
    unitDark: proto([[new THREE.BoxGeometry(1, 1, 1), COL.darkWood]]),
    unitPlank: proto([[new THREE.BoxGeometry(1, 1, 1), COL.plank]]),
    unitRope: proto([[new THREE.BoxGeometry(1, 1, 1), COL.rope]]),
    unitGold: proto([[new THREE.BoxGeometry(1, 1, 1), COL.gold]]),
    unitBlack: proto([[new THREE.BoxGeometry(1, 1, 1), COL.black]]),
    unitRock: proto([[new THREE.BoxGeometry(1, 1, 1), COL.rockLight]]),
    // a sheave wheel, upright in its own x-y plane
    wheel: proto([[new THREE.TorusGeometry(0.85, 0.08, 6, 20), COL.iron], ...[0, 1, 2, 3].map((k) => [new THREE.BoxGeometry(1.64, 0.06, 0.06).rotateZ((k * Math.PI) / 4), COL.iron] as [THREE.BufferGeometry, Hex])]),
    wheelGold: proto([[new THREE.CylinderGeometry(0.16, 0.16, 0.2, 8).rotateX(Math.PI / 2), COL.gold]]),
    bollard: proto([[cyl(0.17, 0.2, 0.62, 8), COL.iron], [cyl(0.24, 0.24, 0.08, 8).translate(0, 0.62, 0), COL.iron]]),
    post: proto([[cyl(0.12, 0.14, 1, 6), COL.darkWood]]),
    // a net hung to dry between two poles: strands across and down, a rope along the top
    net: proto([
      [cyl(0.06, 0.07, 2.3, 5).translate(-1.25, 0, 0), COL.wood], [cyl(0.06, 0.07, 2.3, 5).translate(1.25, 0, 0), COL.wood], [boxAt(2.5, 0.05, 0.05, 0, 2.02, 0), COL.rope],
      ...[0.75, 1.05, 1.35, 1.65].map((y) => [boxAt(2.4, 0.025, 0.025, 0, y, 0), COL.net] as [THREE.BufferGeometry, Hex]),
      ...[-1.0, -0.6, -0.2, 0.2, 0.6, 1.0].map((x) => [boxAt(0.025, 1.3, 0.025, x, 1.35, 0), COL.net] as [THREE.BufferGeometry, Hex]),
    ]),
    // a rowing boat (the hull's lower half of an ellipsoid), seats, oars; its gunwale in gold
    boat: proto([
      [new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.85, 0.5, 2.3).translate(0, 0.42, 0), COL.plank],
      [boxAt(1.5, 0.06, 0.32, 0, 0.32, 0.6), COL.darkWood], [boxAt(1.5, 0.06, 0.32, 0, 0.32, -0.7), COL.darkWood],
      [boxAt(0.08, 0.05, 2.4, 0.4, 0.42, -0.1).rotateY(0.08), COL.wood], [boxAt(0.08, 0.05, 2.4, -0.4, 0.42, -0.1).rotateY(-0.08), COL.wood],
    ]),
    boatGold: proto([[new THREE.TorusGeometry(1, 0.035, 4, 24).rotateX(Math.PI / 2).scale(0.85, 1, 2.3).translate(0, 0.43, 0), COL.gold]]),
    reeds: proto([0, 1, 2, 3, 4].map((k) => [new THREE.ConeGeometry(0.03, 0.6 + (k % 3) * 0.25, 3).translate(0, 0.3 + (k % 3) * 0.125, 0).rotateZ((k - 2) * 0.12).translate(Math.cos(k * 1.3) * 0.18, 0, Math.sin(k * 1.3) * 0.18), COL.reed] as [THREE.BufferGeometry, Hex])),
    shroomStems: proto([[0, 0, 0.32], [0.22, 0.1, 0.22], [-0.16, 0.14, 0.18], [0.05, -0.2, 0.14]].map(([x, z, h]) => [cyl(0.03, 0.045, h, 5).translate(x, 0, z), COL.paleDark] as [THREE.BufferGeometry, Hex])),
    shroomCapsPale: proto(CAPS.map(([x, z, h, r]) => [new THREE.ConeGeometry(r, r * 0.7, 6).translate(x, h + r * 0.3, z), COL.capPale] as [THREE.BufferGeometry, Hex])),
    shroomCapsGlow: proto(CAPS.map(([x, z, h, r]) => [new THREE.ConeGeometry(r, r * 0.7, 6).translate(x, h + r * 0.3, z), COL.fungus] as [THREE.BufferGeometry, Hex])),
    pebble: proto([[new THREE.OctahedronGeometry(1), COL.rock]]),
    pebbleLight: proto([[new THREE.OctahedronGeometry(1), COL.rockLight]]),
    pebblePale: proto([[new THREE.OctahedronGeometry(1), COL.scree]]),
    boulder: proto([[ico(1), COL.rock]]),
    ledge: proto([[new THREE.BoxGeometry(1, 1, 1), COL.rockLight]]),
    stalactite: proto([[new THREE.ConeGeometry(1, 1, 6).rotateX(Math.PI).translate(0, -0.5, 0), COL.stalactite], [new THREE.ConeGeometry(0.45, 0.6, 5).rotateX(Math.PI).translate(0.8, -0.3, 0.3), COL.stalactite]]),
    stalagmite: proto([[new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), COL.pale], [new THREE.ConeGeometry(0.5, 0.55, 6).translate(0.8, 0.27, -0.3), COL.paleDark]]),
    puddle: proto([[new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), COL.puddle]]),
    foam: proto([[new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), COL.foam]]),
    crystal: proto([[oct(0.4, 2.2), COL.violet], [oct(0.28, 1.4).rotateZ(0.35).translate(0.5, 0, 0.1), COL.violet], [oct(0.22, 1.0).rotateZ(-0.4).translate(-0.4, 0, 0.2), COL.violet]]),
  };
  /** A unit box from (ax, ay, az) to (bx, by, bz), `w` thick. */
  const beam = (b: Bucket, p: Proto, ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, h = w) => {
    const dx = bx - ax, dy = by - ay, dz = bz - az, flat = Math.hypot(dx, dz), len = Math.hypot(flat, dy);
    batch.put(b, p, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.atan2(dx, dz), w, h, len, -Math.atan2(dy, flat));
  };
  const pebble = (x: number, y: number, z: number, s: number) => {
    const k = rnd();
    batch.put('low', k < 0.5 ? S.pebble : k < 0.86 ? S.pebbleLight : S.pebblePale, x, y, z, rnd() * 6.28, s * (0.8 + rnd() * 0.5), s * (0.45 + rnd() * 0.25), s * (0.8 + rnd() * 0.5));
  };

  mark('shapes');
  // --- the tracks: frames, lamps, levers, buffers, the verges ------------------------------------------------------------------------
  const nearPlace = (x: number, z: number, pad: number) => look.places.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);
  let frames = 0, trackLamps = 0;
  tracks.forEach((path, k) => {
    let since = 6 + rnd() * 10, verge = rnd() * 4, side = rnd() < 0.5 ? 1 : -1;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (L < 0.5) continue;
      const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L, nx = -uz, nz = ux, yaw = yawTo(ux, uz);
      for (let s = 1; s < L - 1; s += 1) {
        const cx = a.x + ux * s, cz = a.z + uz * s;
        since += 1; verge += 1;
        // a frame of pit timber across the track, every 20 to 30 m, away from the places and off any cover; every other one a lamp
        if (since > 20 + rnd() * 10 && !nearPlace(cx, cz, 5)) {
          const ok = [1, -1].every((sd) => {
            const px = cx + nx * 2.35 * sd, pz = cz + nz * 2.35 * sd;
            return B(px, pz) < -0.8 && cover.clear(px, pz) > 0.5 && roads.clear(px, pz, k) > 2.2 && !inPool(px, pz, 0.3) && !stands.some((q) => Math.hypot(px - q.x, pz - q.z) < 2.5);
          });
          if (ok) {
            since = 0;
            frames++;
            batch.put('tall', S.frame, cx, 0, cz, yaw);
            batch.put('metal', S.frameGold, cx, 0, cz, yaw);
            for (const sd of [1, -1]) tall(cx + nx * 2.35 * sd, cz + nz * 2.35 * sd, 0.15, 3.1);
            if (frames % 2 === 1 && trackLamps < 4) {
              trackLamps++;
              batch.put('low', S.lampBody, cx, 0.4, cz, yaw);
              batch.put('glow', S.lampGlass, cx, 0.4, cz, yaw);
              batch.put('metal', S.lampCap, cx, 0.4, cz, yaw);
              warm.push({ x: cx, y: 2.6, z: cz, size: 1.1 });
            }
          }
        }
        // the verge: spilled ore, sacks, rope, a pick-axe, a loose sleeper, scree
        if (verge > 4 + rnd() * 6) {
          verge = 0;
          if (rnd() < 0.3) side = -side;
          const d = 2.7 + rnd() * 1.1, x = cx + nx * side * d, z = cz + nz * side * d, r = rnd(), yw = rnd() * 6.28;
          if (!free(x, z, 0.5, { road: 2.2, place: 0.5 })) continue;
          if (r < 0.28) {
            batch.put('low', S.ore, x, 0, z, yw, 0.8 + rnd() * 0.6);
            if (rnd() < 0.5) batch.put('glow', S.chips, x + 0.2, 0.05, z - 0.1, yw);
          } else if (r < 0.46) {
            batch.put('low', S.sack, x, 0, z, yw);
            if (rnd() < 0.6) batch.put('low', S.sackLying, x + Math.cos(yw) * 0.6, 0, z - Math.sin(yw) * 0.6, yw + 1);
            tall(x, z, 0.35, 0.7);
          } else if (r < 0.58) batch.put('low', S.coil, x, 0, z, yw);
          else if (r < 0.7) { batch.put('low', S.pick, x, 0, z, yw); batch.put('metal', S.pickGold, x, 0, z, yw); }
          else if (r < 0.84) batch.put('low', S.sleeper, x, 0, z, yaw + (rnd() - 0.5) * 0.9, 1, 1, 1, 0, (rnd() - 0.5) * 0.1);
          else for (let q = 0; q < 4; q++) pebble(x + (rnd() - 0.5) * 1.2, 0.02, z + (rnd() - 0.5) * 1.2, 0.08 + rnd() * 0.12);
        }
      }
    }
  });
  // points: a lever where a track ends on another one (outside the places), and two by the turntable in the middle
  const lever = (x: number, z: number, yaw: number) => {
    batch.put('low', S.lever, x, 0, z, yaw);
    batch.put('metal', S.leverGold, x, 0, z, yaw);
    tall(x, z, 0.25, 1.2);
  };
  tracks.forEach((path, k) => {
    for (const [e, f] of [[path[0], path[1]], [path[path.length - 1], path[path.length - 2]]]) {
      if (!f || nearPlace(e.x, e.z, 1) || roads.clear(e.x, e.z, k) > 1.5) continue;
      const L = Math.hypot(f.x - e.x, f.z - e.z) || 1, ux = (f.x - e.x) / L, uz = (f.z - e.z) / L;
      for (const sd of [1, -1]) {
        const x = e.x + ux * 3 - uz * 2.7 * sd, z = e.z + uz * 3 + ux * 2.7 * sd;
        if (free(x, z, 0.4, { road: 2.0 })) { lever(x, z, yawTo(ux, uz)); break; }
      }
    }
  });
  if (look.middle) {
    for (const a of [0.8, 3.9]) {
      const x = look.middle.x + Math.cos(a) * 4.5, z = look.middle.z + Math.sin(a) * 4.5;
      if (cover.clear(x, z) > 0.4 && !stands.some((q) => Math.hypot(x - q.x, z - q.z) < q.r)) lever(x, z, a);
    }
  }
  // buffers where a track ends in the cart yard or the camp
  for (const path of tracks) {
    for (const [e, f] of [[path[0], path[1]], [path[path.length - 1], path[path.length - 2]]]) {
      if (!f) continue;
      const pl = look.places.find((p) => (p.kind === 'yard' || p.kind === 'camp') && Math.hypot(e.x - p.x, e.z - p.z) < p.r + 0.5);
      if (!pl) continue;
      const L = Math.hypot(f.x - e.x, f.z - e.z) || 1, ux = (e.x - f.x) / L, uz = (e.z - f.z) / L, x = e.x - ux * 0.4, z = e.z - uz * 0.4;
      if (cover.clear(x, z) < 0.6 || stands.some((q) => Math.hypot(x - q.x, z - q.z) < 2.6)) continue;
      batch.put('low', S.buffer, x, 0, z, yawTo(ux, uz));
      batch.put('metal', S.bufferGold, x, 0, z, yawTo(ux, uz));
      tall(x, z, 0.9, 0.95);
    }
  }

  mark('tracks');
  // --- the places, dressed as what they are ---------------------------------------------------------------------------------------
  let restLamps = 0, poolFungi = 0;
  for (const p of look.places) {
    const dx = p.x - RING.x, dz = p.z - RING.z, dl = Math.hypot(dx, dz) || 1, ox = dx / dl, oz = dz / dl, tx = -oz, tz = ox;
    /** A point of the place: `o` m outwards (away from the middle), `t` m along. */
    const Q = (o2: number, t: number) => ({ x: p.x + ox * o2 + tx * t, z: p.z + oz * o2 + tz * t });
    const outYaw = yawTo(ox, oz), tanYaw = yawTo(tx, tz);
    const ok = (q: { x: number; z: number }, pad = 0.4) => cover.clear(q.x, q.z) > pad && roads.clear(q.x, q.z) > 2.1 && !stands.some((s) => Math.hypot(q.x - s.x, q.z - s.z) < s.r) && !inPool(q.x, q.z, 0.4) && B(q.x, q.z) < -0.6;
    switch (p.kind) {
      case 'rest': {
        // the street between the two rows of tents: the stove and its kettle, a table, a line of lamps; pallet bunks by the tents
        let q = Q(-1.2, -4.4);
        if (ok(q, 0.6)) {
          batch.put('tall', S.stove, q.x, 0, q.z, outYaw);
          batch.put('metal', S.stoveGold, q.x, 0, q.z, outYaw);
          batch.put('glow', S.stoveFire, q.x, 0, q.z, outYaw);
          tall(q.x, q.z, 0.45, 3.0);
        }
        q = Q(-1.2, 4.4);
        if (ok(q, 1.0)) { batch.put('low', S.table, q.x, 0, q.z, tanYaw); tall(q.x, q.z, 1.0, 0.8); }
        for (const [o2, t] of [[-6.2, 3.1], [-6.2, -3.1], [3.8, 3.1], [3.8, -3.1]]) {
          q = Q(o2, t);
          if (ok(q, 0.5)) { batch.put('low', S.bunk, q.x, 0, q.z, outYaw); tall(q.x, q.z, 1.0, 0.55); }
        }
        const a = Q(-1.2, -7.8), b = Q(-1.2, 7.8);
        if (cover.clear(a.x, a.z) > 0.3 && cover.clear(b.x, b.z) > 0.3) {
          for (const e of [a, b]) { batch.put('tall', S.pole, e.x, 0, e.z); batch.put('metal', S.poleGold, e.x, 0, e.z); tall(e.x, e.z, 0.12, 3.2); }
          beam('low', S.unitRope, a.x, 3.05, a.z, b.x, 3.05, b.z, 0.03);
          for (const t of [-2.6, 2.6]) {
            const l = Q(-1.2, t);
            batch.put('low', S.lampBody, l.x, 0.35, l.z, tanYaw);
            batch.put('glow', S.lampGlass, l.x, 0.35, l.z, tanYaw);
            batch.put('metal', S.lampCap, l.x, 0.35, l.z, tanYaw);
            if (restLamps++ < 2) warm.push({ x: l.x, y: 2.55, z: l.z, size: 1.2 });
          }
        }
        for (const [o2, t] of [[-1.6, -8.6], [-0.4, -8.9]]) { q = Q(o2, t); if (ok(q)) batch.put('low', S.sack, q.x, 0, q.z, rnd() * 6); }
        q = Q(1.4, 8.4);
        if (ok(q)) batch.put('low', S.coil, q.x, 0, q.z);
        break;
      }
      case 'yard': {
        // spare rails, wheel sets, stacked sleepers, ore, a winch
        const items: [Proto, Proto | null, number, number, number, number][] = [
          [S.rails, null, 0.6, -5.4, tanYaw, 1.6], [S.wheelset, null, 5.6, 1.4, outYaw, 0.8], [S.wheelset, null, -1.6, -3.4, outYaw + 0.4, 0.8],
          [S.sleepers, null, 3.4, 3.6, tanYaw + 0.3, 1.2], [S.ore, null, 5.0, -3.6, 0, 1.0], [S.ore, null, 1.8, 0.6, 1, 1.0], [S.winch, S.winchGold, 6.4, -5.2, tanYaw, 0.9],
        ];
        for (const [sh, gold, o2, t, yw, r] of items) {
          const q = Q(o2, t);
          if (!ok(q, r * 0.6)) continue;
          batch.put(sh === S.winch ? 'tall' : 'low', sh, q.x, 0, q.z, yw);
          if (gold) batch.put('metal', gold, q.x, 0, q.z, yw);
          if (sh === S.ore) batch.put('glow', S.chips, q.x + 0.15, 0.05, q.z, yw);
          if (sh !== S.ore) tall(q.x, q.z, r, sh === S.winch ? 1.2 : sh === S.rails ? 0.4 : 0.6);
        }
        break;
      }
      case 'shore': {
        // a jetty from the landing out over the black water, a boat moored at its end, bollards and a lamp; nets on poles ashore
        let len = 0;
        for (let s = 0; s < 40; s += 0.5) {
          const q = Q(6.6 + s, 0);
          if (Wt(q.x, q.z) > 0.7 && H(q.x, q.z) < o.waterLevel - 0.3) { len = s + 6; break; }
        }
        if (len) {
          len = Math.min(len, 44);
          for (let s = 0; s <= len; s += 1.15) {
            const q = Q(6.6 + s, 0), y = 0.08;
            batch.put('low', S.unitPlank, q.x, y, q.z, outYaw, 2.3, 0.12, 1.05);
            if (Math.round(s / 1.15) % 2 === 0) for (const sd of [-1.05, 1.05]) {
              const pp = Q(6.6 + s, sd), g = H(pp.x, pp.z);
              batch.put('low', S.post, pp.x, Math.min(g, o.waterLevel) - 0.2, pp.z, 0, 1, y + 0.45 - Math.min(g, o.waterLevel) + 0.2, 1);
            }
          }
          const e0 = Q(6.6, -1.17), e1 = Q(6.6 + len, -1.17), f0 = Q(6.6, 1.17), f1 = Q(6.6 + len, 1.17);
          beam('metal', S.unitGold, e0.x, 0.21, e0.z, e1.x, 0.21, e1.z, 0.05, 0.03);
          beam('metal', S.unitGold, f0.x, 0.21, f0.z, f1.x, 0.21, f1.z, 0.05, 0.03);
          const end = Q(6.6 + len - 0.4, 0.75), lampAt = Q(6.6 + len - 0.4, -0.85);
          batch.put('low', S.bollard, end.x, 0.2, end.z);
          batch.put('tall', S.pole, lampAt.x, 0.2, lampAt.z, 0, 1, 0.85, 1);
          batch.put('low', S.lampBody, lampAt.x + ox * 0.35, 0.05, lampAt.z + oz * 0.35, outYaw);
          batch.put('glow', S.lampGlass, lampAt.x + ox * 0.35, 0.05, lampAt.z + oz * 0.35, outYaw);
          batch.put('metal', S.lampCap, lampAt.x + ox * 0.35, 0.05, lampAt.z + oz * 0.35, outYaw);
          beam('low', S.unitDark, lampAt.x, 2.9, lampAt.z, lampAt.x + ox * 0.45, 2.9, lampAt.z + oz * 0.45, 0.08);
          warm.push({ x: lampAt.x + ox * 0.35, y: 2.3, z: lampAt.z + oz * 0.35, size: 1.3 });
          const boat = Q(6.6 + len - 3.2, 2.5);
          batch.put('low', S.boat, boat.x, o.waterLevel - 0.18, boat.z, outYaw + 0.08);
          batch.put('metal', S.boatGold, boat.x, o.waterLevel - 0.18, boat.z, outYaw + 0.08);
          const bow = Q(6.6 + len - 1.0, 2.4);
          beam('low', S.unitRope, end.x, 0.75, end.z, bow.x, o.waterLevel + 0.35, bow.z, 0.03);
          // a second boat drawn up at the water's edge, keel up
          const up = Q(6.6 + Math.max(2, len - 9), -3.4);
          if (B(up.x, up.z) > 0.6 && Wt(up.x, up.z) < 0.5) batch.put('low', S.boat, up.x, H(up.x, up.z) + 0.42, up.z, outYaw + 0.5, 1, 1, 1, 0, Math.PI);
        }
        for (const t of [-2.4, 2.4]) {
          const q = Q(1.2, t);
          if (ok(q, 0.6)) { batch.put('tall', S.net, q.x, 0, q.z, outYaw + Math.PI / 2); tall(q.x, q.z, 1.3, 2.1); }
        }
        const c = Q(3.2, -3.6);
        if (ok(c)) batch.put('low', S.coil, c.x, 0, c.z);
        break;
      }
      case 'pools': {
        // two clumps of glowing fungi by the rocks
        for (const [o2, t] of [[-5.6, -3.6], [5.0, -7.2], [2.4, 7.4]]) {
          const q = Q(o2, t);
          if (!ok(q, 0.3) || poolFungi >= 2) continue;
          batch.put('low', S.shroomStems, q.x, 0, q.z, rnd() * 6, 1.3);
          batch.put('glow', S.shroomCapsGlow, q.x, 0, q.z, rnd() * 6, 1.3);
          fungi.push({ x: q.x, y: 0.5, z: q.z, size: 1.0 });
          poolFungi++;
        }
        break;
      }
      case 'shaft': {
        // the head-frame: the generator's four posts tied at the top, a wheel above the hole, its rope down the hole and to a winch
        const posts = look.pieces.map((pc, i) => ({ o: pc.o, k: look.kinds[i] })).filter((pc) => pc.k === 'post' && Math.hypot(pc.o.ax - p.x, pc.o.az - p.z) < p.r);
        if (posts.length === 4) {
          const cx = posts.reduce((s, q) => s + q.o.ax, 0) / 4, cz = posts.reduce((s, q) => s + q.o.az, 0) / 4, top = posts[0].o.height ?? 4.2;
          const ring = posts.map((q) => q.o).sort((a, b) => Math.atan2(a.az - cz, a.ax - cx) - Math.atan2(b.az - cz, b.ax - cx));
          ring.forEach((a, i) => { const b = ring[(i + 1) % 4]; beam('tall', S.unitWood, a.ax, top - 0.15, a.az, b.ax, top - 0.15, b.az, 0.26); beam('low', S.unitDark, a.ax, 1.6, a.az, b.ax, top - 0.4, b.az, 0.12); });
          beam('tall', S.unitDark, ring[0].ax, top, ring[0].az, ring[2].ax, top, ring[2].az, 0.2);
          // the wheel turns in the plane of the rope: outwards over the hole, inwards to the winch
          const wy = top + 1.3, wYaw = Math.atan2(-oz, ox) ;
          for (const sd of [-0.32, 0.32]) beam('tall', S.unitWood, cx + tx * sd, top, cz + tz * sd, cx + tx * sd, wy, cz + tz * sd, 0.14);
          batch.put('tall', S.wheel, cx, wy, cz, wYaw);
          batch.put('metal', S.wheelGold, cx, wy, cz, wYaw);
          beam('low', S.unitRope, cx + ox * 0.85, wy, cz + oz * 0.85, cx + ox * 0.85, -1.5, cz + oz * 0.85, 0.04);
          const w = Q(-4.6, 3.3); // beside the timber stack, off the shaft's middle (where the lead quest's miner waits)
          if (ok(w, 0.8) || cover.clear(w.x, w.z) > 0.8) {
            batch.put('tall', S.winch, w.x, 0, w.z, tanYaw);
            batch.put('metal', S.winchGold, w.x, 0, w.z, tanYaw);
            beam('low', S.unitRope, cx - ox * 0.85, wy, cz - oz * 0.85, w.x, 1.1, w.z, 0.04);
            tall(w.x, w.z, 0.9, 1.2);
          }
          tall(cx, cz, 2.6, wy + 0.9);
        }
        for (const [o2, t] of [[-1.0, -6.4], [-0.2, 6.6]]) { const q = Q(o2, t); if (ok(q)) batch.put('low', o2 < -0.5 ? S.sack : S.ore, q.x, 0, q.z, rnd() * 6); }
        break;
      }
      case 'hall': {
        // crystal chips at the inner foot of the hall's wall, a pick-axe left by it
        for (let k = 0; k < 9; k++) {
          const a = ((k / 8) * 160 - 80) * (Math.PI / 180), d = 4.9 + rnd() * 0.5, q = Q(Math.cos(a) * d, Math.sin(a) * d);
          if (cover.clear(q.x, q.z) < 0.15 || Math.hypot(q.x - Q(3.5, 0).x, q.z - Q(3.5, 0).z) < 2.2) continue;
          batch.put('glow', S.chips, q.x, 0.02, q.z, rnd() * 6, 0.8 + rnd() * 0.7);
          if (k % 3 === 0) pebble(q.x + 0.3, 0.03, q.z + 0.2, 0.18);
        }
        const q = Q(4.4, -3.2);
        if (cover.clear(q.x, q.z) > 0.2) { batch.put('low', S.pick, q.x, 0, q.z, tanYaw + 0.4); batch.put('metal', S.pickGold, q.x, 0, q.z, tanYaw + 0.4); }
        break;
      }
      case 'well': {
        // a bucket and rope by the echo well's stones
        const q = Q(-3.8, 4.2);
        if (cover.clear(q.x, q.z) > 0.4) { batch.put('low', S.coil, q.x, 0, q.z); batch.put('low', S.unitDark, q.x + 0.7, 0.2, q.z, 0, 0.4, 0.4, 0.4); }
        break;
      }
      case 'camp': {
        // sacks and rope round the camp's edge
        for (let k = 0, made = 0; k < 24 && made < 5; k++) {
          const a = rnd() * Math.PI * 2, d = p.r + 3 + rnd() * 2, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; // past the camp's people
          if (!free(x, z, 0.5, { road: 2.2 })) continue;
          batch.put('low', made % 3 === 2 ? S.coil : S.sack, x, 0, z, rnd() * 6);
          if (made % 3 !== 2) tall(x, z, 0.35, 0.7);
          made++;
        }
        break;
      }
    }
  }
  // the pools: pale reeds round each, pale mushrooms here and there
  for (const f of look.pools) {
    const per = Math.PI * (f.rx + f.rz), n = Math.round(per / 1.1), rot = f.rot ?? 0;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd() * 0.3, e = 0.55 + rnd() * 0.5;
      const lx = Math.cos(a) * (f.rx + e), lz = Math.sin(a) * (f.rz + e), x = f.x + lx * Math.cos(rot) - lz * Math.sin(rot), z = f.z + lx * Math.sin(rot) + lz * Math.cos(rot);
      if (cover.clear(x, z) < 0.2 || roads.clear(x, z) < 2.0 || B(x, z) > -0.5) continue;
      if (rnd() < 0.7) batch.put('low', S.reeds, x, 0, z, rnd() * 6, 0.8 + rnd() * 0.6);
      else { batch.put('low', S.shroomStems, x, 0, z, rnd() * 6); batch.put('low', S.shroomCapsPale, x, 0, z, rnd() * 6); }
    }
  }

  mark('places');
  // --- the cave floor: scree and puddles -------------------------------------------------------------------------------------------
  const area = 0.5 * Math.sin((Math.PI * 2) / rim.length) * rim.reduce((s, r, i) => s + r * rim[(i + 1) % rim.length], 0);
  for (let k = 0, made = 0; k < area / 20 && made < area / 55; k++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (!free(x, z, 0.3, { road: 2.0, place: -1, inside: 0.5 })) continue;
    made++;
    const n = 1 + Math.floor(rnd() * 3);
    for (let q = 0; q < n; q++) pebble(x + (rnd() - 0.5) * 0.9, 0.02, z + (rnd() - 0.5) * 0.9, 0.07 + rnd() * 0.13);
  }
  for (let k = 0, made = 0; k < 120 && made < Math.round(area / 1400); k++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (!free(x, z, 1.4, { road: 2.2, place: 0.5, inside: 3 })) continue;
    made++;
    const r = 0.5 + rnd() * 0.8;
    batch.put('wet', S.puddle, x, 0.025, z, rnd() * 6, r, 1, r * (0.5 + rnd() * 0.4));
    if (rnd() < 0.5) batch.put('wet', S.puddle, x + r * 0.9, 0.025, z + r * 0.3, rnd() * 6, r * 0.45, 1, r * 0.35);
  }

  mark('floor');
  // --- the wall's foot: rubble, tipped carts, glowing fungi ------------------------------------------------------------------------
  for (let k = 0; k < around / 0.9; k++) {
    const a = rnd() * Math.PI * 2, b = -1.2 + Math.pow(rnd(), 1.4) * 5, p = out(a, b);
    if (Wt(p.x, p.z) > 0.1 || So(p.x, p.z) > 0.5) continue;
    if (b < 0 && (cover.clear(p.x, p.z) < 0.2 || roads.clear(p.x, p.z) < 2.0 || stands.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < s.r))) continue;
    const s = b < 0 ? 0.1 + rnd() * 0.18 : 0.22 + rnd() * 0.55, y = b > 0.4 ? H(p.x, p.z) : 0;
    pebble(p.x, y - s * 0.15, p.z, s);
  }
  let carts = 0;
  for (let k = 0; k < 80 && carts < 2; k++) {
    const a = rnd() * Math.PI * 2, p = out(a, 1.0);
    if (Wt(p.x, p.z) > 0.05 || So(p.x, p.z) > 0.2 || cover.clear(p.x, p.z) < 1.2) continue;
    const r1 = rimAt(rim, a), r2 = rimAt(rim, a + 0.02), yaw = yawTo(Math.cos(a + 0.02) * r2 - Math.cos(a) * r1, Math.sin(a + 0.02) * r2 - Math.sin(a) * r1);
    carts++;
    batch.put('tall', S.tipped, p.x, H(p.x, p.z) - 0.1, p.z, yaw + (rnd() - 0.5) * 0.5);
    const q = out(a, -1.4);
    if (free(q.x, q.z, 0.3, { road: 2.0, inside: 0.4 })) { batch.put('low', S.ore, q.x, 0, q.z, rnd() * 6, 1.2); batch.put('glow', S.chips, q.x, 0.05, q.z, rnd() * 6); }
  }
  let wallFungi = 0;
  for (let k = 0, made = 0; k < 160 && made < 10; k++) {
    const a = rnd() * Math.PI * 2, b = -0.8 + rnd() * 1.8, p = out(a, b);
    if (Wt(p.x, p.z) > 0.05 || So(p.x, p.z) > 0.3 || cover.clear(p.x, p.z) < 0.4 || roads.clear(p.x, p.z) < 2.2 || stands.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < s.r)) continue;
    made++;
    const y = b > 0.4 ? H(p.x, p.z) : 0;
    for (let q = 0; q < 2; q++) {
      const x = p.x + (rnd() - 0.5) * 1.4, z = p.z + (rnd() - 0.5) * 1.4, s = 0.9 + rnd() * 0.7;
      batch.put('low', S.shroomStems, x, y, z, rnd() * 6, s);
      batch.put('glow', S.shroomCapsGlow, x, y, z, rnd() * 6, s);
    }
    if (wallFungi < 3 && made % 3 === 1) { fungi.push({ x: p.x, y: y + 0.5, z: p.z, size: 1.1 }); wallFungi++; }
  }

  mark('foot');
  // --- the slopes: ledges, boulders, gold veins ---------------------------------------------------------------------------------------
  for (let k = 0; k < around / 2.6; k++) {
    const a = rnd() * Math.PI * 2, b = 3 + Math.pow(rnd(), 0.8) * 34, p = out(a, b);
    if (Wt(p.x, p.z) > 0.1 || So(p.x, p.z) > 0.35) continue;
    const y = H(p.x, p.z), r1 = rimAt(rim, a), r2 = rimAt(rim, a + 0.02), yaw = yawTo(Math.cos(a + 0.02) * r2 - Math.cos(a) * r1, Math.sin(a + 0.02) * r2 - Math.sin(a) * r1);
    const big = 1 + 0.8 * No(p.x, p.z), ty = yaw + (rnd() - 0.5) * 0.3;
    /** The lowest ground under a slab `w` wide (along the wall) and `d` deep, so no side of it floats off a steep slope. */
    const low = (w: number, d: number) => {
      let lo = y;
      for (const [u, v] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) lo = Math.min(lo, H(p.x + Math.sin(ty) * u * w + Math.cos(ty) * v * d, p.z + Math.cos(ty) * u * w - Math.sin(ty) * v * d));
      return lo;
    };
    if (rnd() < 0.55) {
      const w = (3 + rnd() * 5) * big, d = 1.4 + rnd() * 1.2, h = 0.5 + rnd() * 0.9;
      batch.put('low', S.ledge, p.x, low(w, d) + h * 0.3, p.z, ty, w, h, d, (rnd() - 0.5) * 0.15);
    } else {
      const sx = (0.9 + rnd() * 1.6) * big, sy = (0.6 + rnd()) * big, sz = (0.9 + rnd() * 1.6) * big;
      batch.put('low', S.boulder, p.x, low(sx * 1.6, sz * 1.6) + 0.3 * sy, p.z, rnd() * 6, sx, sy, sz);
    }
  }
  for (let k = 0; k < around / 12; k++) {
    const a = rnd() * Math.PI * 2, b = 2.5 + rnd() * 12, p = out(a, b);
    if (Wt(p.x, p.z) > 0.1 || So(p.x, p.z) > 0.35) continue;
    const y = H(p.x, p.z), yaw = rnd() * 6.28, len = 1.6 + rnd() * 3.2;
    batch.put('metal', S.unitGold, p.x, y + 0.04, p.z, yaw, 0.07, 0.06, len, (rnd() - 0.5) * 0.5);
    if (rnd() < 0.4) batch.put('glow', S.chips, p.x + Math.sin(yaw) * len * 0.4, y, p.z + Math.cos(yaw) * len * 0.4, rnd() * 6, 1.2);
  }

  mark('slopes');
  // --- overhead: stalactites hanging from the ceiling's dark (above the game camera, past the outline) ---------------------------------
  for (let k = 0; k < around / 2.2; k++) {
    const a = rnd() * Math.PI * 2, b = 4 + Math.pow(rnd(), 0.7) * 70, p = out(a, b);
    if (So(p.x, p.z) > 0.3) continue;
    const y = 34 + rnd() * 14 + Math.max(0, H(p.x, p.z)) * 0.4, len = 5 + rnd() * 13, r = 0.9 + rnd() * 2;
    batch.put('low', S.stalactite, p.x, y, p.z, rnd() * 6, r, len, r);
  }

  mark('overhead');
  // --- far off: an arch onto a second cavern in the north wall ---------------------------------------------------------------------
  for (let k = 0; k < 30; k++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
    let b = 4;
    while (b < 26 && H(out(a, b).x, out(a, b).z) < 5) b += 0.5;
    const p = out(a, b);
    if (b >= 26 || Wt(p.x, p.z) > 0.05) continue;
    const y = H(p.x, p.z) - 1.2, ty = yawTo(RING.x - p.x, RING.z - p.z), cx = Math.cos(ty), sx = -Math.sin(ty), fx = Math.sin(ty), fz = Math.cos(ty);
    const at = (lx: number, lz: number) => ({ x: p.x + cx * lx + fx * lz, z: p.z + sx * lx + fz * lz });
    // the opening's black, crystals and pale spires inside lit by their own glow, the pillars and the round head
    let q = at(0, -0.9);
    batch.put('glow', S.unitBlack, q.x, y + 5.5, q.z, ty, 8.4, 11, 0.3);
    q = at(0, 0.2);
    batch.put('glow', S.unitBlack, q.x, y + 1, q.z, ty, 8.4, 0.2, 2.2);
    for (const [lx, s] of [[-2.2, 1.3], [1.6, 1.7], [0, 0.9], [3.0, 0.8]]) { q = at(lx, -0.3); batch.put('glow', S.crystal, q.x, y + 0.9, q.z, rnd() * 6, s); }
    for (const lx of [-3.2, -0.9, 2.4]) { q = at(lx, -0.6); batch.put('low', S.stalagmite, q.x, y + 0.9, q.z, rnd() * 6, 0.6, 2 + rnd() * 2.5, 0.6); }
    for (const sd of [-1, 1]) { q = at(sd * 4.6, 0.3); batch.put('low', S.unitRock, q.x, y + 3.5 - 2, q.z, ty, 1.6, 11, 2.0); }
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * Math.PI, r = 4.6;
      q = at(Math.cos(t) * r, 0.3);
      batch.put('low', S.unitRock, q.x, y + 7.5 + Math.sin(t) * r, q.z, ty, 1.9, 1.5, 2.0, 0, t + Math.PI / 2);
    }
    q = at(0, 0.6);
    batch.put('metal', S.unitGold, q.x, y + 7.5 + 4.6 + 0.85, q.z, ty, 1.6, 0.12, 0.1);
    q = at(0, -0.2);
    cool.push({ x: q.x, y: y + 2.4, z: q.z, size: 4.5 });
    break;
  }

  mark('arch');
  // --- the black lake: its far shore, a waterfall, faint glints ----------------------------------------------------------------------
  const lakeDir = m === 1 ? 0 : Math.PI;
  /** The far shore along direction `a`: the first point past the water where the far wall's foot comes up. */
  const SHORE = 32, shoreB = Array.from({ length: SHORE + 1 }, (_, i) => {
    const a = lakeDir + (i / SHORE - 0.5) * 1.5;
    let wet = false;
    for (let b = 6; b < 120; b += 2) {
      const p = out(a, b), h = H(p.x, p.z);
      if (h < o.waterLevel - 0.3 && Wt(p.x, p.z) > 0.6) wet = true;
      else if (wet && h > o.waterLevel + 0.2) return b;
    }
    return -1;
  });
  /** The far shore along direction `a` (within the lake's sector): how far past the outline the far wall's foot comes up, or -1. */
  const farShore = (a: number) => shoreB[Math.max(0, Math.min(SHORE, Math.round(((a - lakeDir) / 1.5 + 0.5) * SHORE)))];
  for (let k = 0; k < 70; k++) {
    const a = lakeDir + (rnd() - 0.5) * 1.5, b = farShore(a);
    if (b < 0) continue;
    const p = out(a, b + rnd() * 5);
    if (rnd() < 0.55) batch.put('low', S.stalagmite, p.x, H(p.x, p.z) - 0.3, p.z, rnd() * 6, 0.6 + rnd() * 1.1, 1.6 + rnd() * 4.5, 0.6 + rnd() * 1.1);
    else pebble(p.x, H(p.x, p.z), p.z, 0.6 + rnd() * 1.4);
  }
  const fallTex = (() => {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 128;
    const g = c.getContext('2d')!, r2 = seeded(5 + look.seed);
    g.fillStyle = 'rgb(96,110,140)';
    g.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(214,226,250,${0.35 + r2() * 0.55})`;
      g.fillRect(Math.floor(r2() * 32), Math.floor(r2() * 128), 1 + Math.floor(r2() * 2), 10 + Math.floor(r2() * 40));
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const fallMat = new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.85, depthWrite: false });
  o.own.push(fallTex, fallMat);
  for (let k = 0; k < 12; k++) {
    const a = lakeDir + (rnd() - 0.5) * 0.9, b = farShore(a);
    if (b < 0) continue;
    const foot = out(a, b - 2.5), topP = out(a, b + 8), top = Math.max(12, H(topP.x, topP.z) + 1), h = top - o.waterLevel;
    const geo = new THREE.PlaneGeometry(6, h, 1, 1);
    fallTex.repeat.set(1, h / 10);
    const mesh = new THREE.Mesh(geo, fallMat);
    mesh.position.set(foot.x, o.waterLevel + h / 2, foot.z);
    mesh.rotation.y = yawTo(RING.x - foot.x, RING.z - foot.z);
    group.add(mesh);
    o.own.push(geo);
    for (let q = 0; q < 8; q++) batch.put('glow', S.foam, foot.x + (rnd() - 0.5) * 6, o.waterLevel + 0.03, foot.z + (rnd() - 0.5) * 3, rnd() * 6, 0.9 + rnd() * 1.2, 1, 0.6 + rnd() * 0.8);
    break;
  }
  const glintGeo = (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0, made = 0; k < 500 && made < 90; k++) {
      const a = lakeDir + (rnd() - 0.5) * 1.6, p = out(a, 3 + rnd() * 58);
      if (Wt(p.x, p.z) < 0.85) continue;
      made++;
      parts.push(new THREE.PlaneGeometry(0.6 + rnd() * 0.8, 0.12 + rnd() * 0.1).rotateX(-Math.PI / 2).rotateY(rnd() * 0.4 - 0.2).translate(p.x, o.waterLevel + 0.03, p.z));
    }
    if (!parts.length) return null;
    const n = parts.reduce((s, g) => s + g.attributes.position.count, 0), pos = new Float32Array(n * 3);
    let off = 0;
    const idx: number[] = [];
    for (const g of parts) {
      pos.set(g.attributes.position.array as Float32Array, off * 3);
      for (const i of g.index!.array) idx.push(i + off);
      off += g.attributes.position.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  })();
  const glintMat = new THREE.MeshBasicMaterial({ color: 0x6c7cd8, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  o.own.push(glintMat);
  if (glintGeo) { group.add(new THREE.Mesh(glintGeo, glintMat)); o.own.push(glintGeo); }

  mark('lake');
  // --- bats wheeling under the north wall (one instanced mesh, turned each frame) -----------------------------------------------------
  const batGeo = (() => {
    const w = (sd: number) => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(sd * 0.55, 0.05, -0.05), new THREE.Vector3(sd * 0.32, 0, -0.22), new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(sd * 0.32, 0, -0.22), new THREE.Vector3(0, 0, -0.14)]);
    const l = w(-1), r = w(1), n = 12, pos = new Float32Array(n * 3);
    pos.set(l.attributes.position.array as Float32Array, 0);
    pos.set(r.attributes.position.array as Float32Array, 18);
    l.dispose(); r.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  })();
  const batMat = new THREE.MeshBasicMaterial({ color: 0x16141c, side: THREE.DoubleSide });
  o.own.push(batGeo, batMat);
  const BATS = 9, bats = new THREE.InstancedMesh(batGeo, batMat, BATS);
  group.add(bats);
  const roost = out(-Math.PI / 2 + (rnd() - 0.5) * 0.8, -10);
  // culled as a whole: a sphere round the roost holds every loop
  bats.boundingSphere = new THREE.Sphere(new THREE.Vector3(roost.x, 10, roost.z), 18);
  const flyers = Array.from({ length: BATS }, () => ({ r: 4 + rnd() * 9, h: 7 + rnd() * 6, sp: (0.7 + rnd() * 0.6) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6.28, f: 9 + rnd() * 5 }));
  const bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), be = new THREE.Euler(), bp = new THREE.Vector3(), bs = new THREE.Vector3(1, 1, 1);
  const fly = (time: number) => {
    for (let i = 0; i < BATS; i++) {
      const f = flyers[i], a = f.ph + time * f.sp, x = roost.x + Math.cos(a) * f.r, z = roost.z + Math.sin(a) * f.r * 0.6;
      bs.set(1.6, 1, 1.6);
      bm.compose(bp.set(x, f.h + Math.sin(time * 1.7 + i) * 0.8, z), bq.setFromEuler(be.set(0, -a + (f.sp > 0 ? Math.PI : 0), Math.sin(time * f.f + i) * 0.5, 'YXZ')), bs);
      bats.setMatrixAt(i, bm);
    }
    bats.instanceMatrix.needsUpdate = true;
  };
  fly(0);

  mark('bats');
  // --- into meshes ---------------------------------------------------------------------------------------------------------------
  const own = o.own;
  const mk = <T extends THREE.Material>(mm: T) => { own.push(mm); return mm; };
  // One material for all: matte, flat shaded; a vertex's `glow` lights it by its own colour (unlit lamp glass, fungi; the gold's warmth).
  const material = mk(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }));
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;\ndiffuseColor.rgb *= 1.0 - 0.85 * step(0.5, vGlow);');
  };
  material.customProgramCacheKey = () => 'tower-deep-depth';
  const stats = batch.build(group, own, material);
  const warmG = new Glows(warm, 0xffa040, 1.5), coolG = new Glows(cool, 0x6a48d0, 1.5), fungiG = new Glows(fungi, 0x58c8d8, 1.5);
  group.add(warmG.group, coolG.group, fungiG.group);
  own.push(warmG, coolG, fungiG);
  mark('build');
  group.userData.props = props;
  group.userData.stats = { ...stats, glows: warm.length + cool.length + fungi.length, frames, buildMs: +(performance.now() - t0).toFixed(1), laps };

  return {
    update(time: number) {
      fly(time);
      warmG.update(time); coolG.update(time); fungiG.update(time);
      fallTex.offset.y = (time * 0.55) % 1;
      glintMat.opacity = 0.3 + 0.1 * Math.sin(time * 1.3);
    },
  };
}
