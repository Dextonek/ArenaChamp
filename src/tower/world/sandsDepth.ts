import * as THREE from 'three';
import { RING, seeded } from '../../arenas/common';
import type { SandsLook } from './sandsZone';
import { rimAt } from './land';
import { sandsScenes, type GroundCanvas, type Proto } from './scenes/sands';

/**
 * The world's depth on a Sands floor (floors 21 to 30; the user, 2026-11-14: "add depth into the worlds, make all the background fit there,
 * all the roads and zones, make them look like they fit there, don't be shy"). Made like the sea's (depth.ts) and the Wood's (woodDepth.ts).
 * **Looks only, never cover:** nothing here stops a walk or a shot; it keeps off the cover, the roads' middles, the places' courts (inside a
 * place only flat things: rugs, a marked grid, a pool's paint) and 2.5 m off the floor's spots (keep.ts `floorKeep`).
 *
 * - The caravan roads: cairns, milestones with a turquoise band, waymark poles with a strip of cloth; bleached bones by the way; one
 *   broken cart and one roadside well a floor.
 * - The open sand: dry scrub, thorn bushes, stones and flat slabs; painted pebbles and darker drifts in the lee of the rocks.
 * - The places, dressed as what they are: the caravanserai (rugs, jars, an awning against its wall, saddle bags), the tombs (urns, broken
 *   statues), the dig (a pegged grid of rope, ropes, ladders, baskets, a sieve), the oasis (a painted pool with a stone edge, reeds, small palms),
 *   the raiders (spears in the sand, hides on a rack, loot sacks), the ruins (rubble, fallen drums), the fort (a weapon rack, sacks), the
 *   watchtower (firewood, sacks), the shrine (offering bowls, prayer flags), the wells (a trough, jars), the camp (rugs, bedrolls, a pot,
 *   saddle bags).
 * - Far off: vultures circling over the northern cliffs, a caravan of camels walking over the far dunes as silhouettes (along the
 *   cliff tops where there are no dunes), ruined arches at the cliffs' foot and one up on them.
 *
 * How it is drawn: everything matte is merged by 96 m squares into at most two meshes a square (props that cast shadows, and the flat
 * scatter that does not), whatever the colours; small trims are a matte brass in those meshes and only the arches' lintels go to the
 * zone's kit in polished gold (a gold part in a 24 m square of the kit is a draw); the moving things are instanced, each with its
 * own material, and updated in place (no allocation a frame). Its own random stream: the zone's own rocks and shrubs stay where they were.
 */

/** What the depth needs of the desert (sandsZone.ts `desert`), from offsets (dx, dz) from the middle. */
export interface SandsLand {
  beyond(dx: number, dz: number): number;
  height(dx: number, dz: number): number;
  duneSide(dx: number, dz: number): number;
  south(dx: number, dz: number): number;
  steepness(dx: number, dz: number): number;
}
/** The zone's kit, for the polished gold only. */
export interface GoldSink {
  add(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw?: number, sx?: number, sy?: number, sz?: number, tilt?: number): unknown;
}
type Seg = { ax: number; az: number; bx: number; bz: number; r: number };

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

/** The Sands' colours (sandsZone.ts `materials`, the heroes' palette; the canyon's own colour is turquoise). */
const C = {
  sandstone: '#9a7252', flag: '#6a5446', cream: '#a89a80', wood: '#4a3220', plank: '#6b4226', lacquer: '#1d1b21', wine: '#5e1a28',
  turquoise: '#1f8a86', clay: '#9a5638', palm: '#4a6638', rope: '#b89a5a', rockA: '#8a4c36', rockB: '#a0664a', rockC: '#6c3a2c',
  bone: '#ddd2bc', scrub: '#8a7a4a', scrubDark: '#6e6438', thorn: '#5e5a36', hide: '#9a7a56', red: '#8a3424', reed: '#7a8248', brass: '#a8843e',
} as const;

/** Merges matte parts by squares, a mesh a square and a kind (`s`: casts shadows; `f`: flat scatter, no shadows). */
class Merge {
  private bins = new Map<string, { pos: number[]; nor: number[]; col: number[] }>();
  private m = new THREE.Matrix4();
  private nm = new THREE.Matrix3();
  private v = new THREE.Vector3();
  private cache = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  private cols = new Map<string, THREE.Color>();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  constructor(private cell: number) {}
  add(hex: string, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, kind: 's' | 'f' = 's') {
    let g = this.cache.get(geo);
    if (!g) {
      g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.attributes.normal) g.computeVertexNormals();
      this.cache.set(geo, g);
    }
    let col = this.cols.get(hex);
    if (!col) this.cols.set(hex, (col = new THREE.Color(hex)));
    this.m.compose(this.v.set(x, y, z), this.q.setFromEuler(this.e.set(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    this.nm.getNormalMatrix(this.m);
    const key = `${kind}:${Math.floor(x / this.cell)}:${Math.floor(z / this.cell)}`;
    let b = this.bins.get(key);
    if (!b) this.bins.set(key, (b = { pos: [], nor: [], col: [] }));
    const pa = g.attributes.position, na = g.attributes.normal, v = this.v;
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(this.m);
      b.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(na, i).applyMatrix3(this.nm).normalize();
      b.nor.push(v.x, v.y, v.z);
      b.col.push(col.r, col.g, col.b);
    }
    return this;
  }
  /** A ready shape (scenes/sands.ts) by a full matrix, into the square its origin is in. */
  proto(kind: 's' | 'f', p: Proto, m: THREE.Matrix4) {
    const e = m.elements, key = `${kind}:${Math.floor(e[12] / this.cell)}:${Math.floor(e[14] / this.cell)}`;
    let b = this.bins.get(key);
    if (!b) this.bins.set(key, (b = { pos: [], nor: [], col: [] }));
    const n = this.nm.getNormalMatrix(m).elements, P = p.pos, N = p.nor, K = p.col;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2], a = N[i], c = N[i + 1], d = N[i + 2];
      b.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      const X = n[0] * a + n[3] * c + n[6] * d, Y = n[1] * a + n[4] * c + n[7] * d, Z = n[2] * a + n[5] * c + n[8] * d, l = Math.hypot(X, Y, Z) || 1;
      b.nor.push(X / l, Y / l, Z / l);
      b.col.push(K[i], K[i + 1], K[i + 2]);
    }
  }
  build(into: THREE.Group, own: { dispose(): void }[]) {
    const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }); // the cloths are single planes
    const flat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
    own.push(solid, flat);
    for (const [key, b] of this.bins) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(b.nor), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(b.col), 3));
      geo.computeBoundingSphere();
      const isS = key[0] === 's', mesh = new THREE.Mesh(geo, isS ? solid : flat);
      mesh.castShadow = isS;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      into.add(mesh);
      own.push(geo);
    }
    this.bins.clear();
    for (const [src, g] of this.cache) { if (g !== src) g.dispose(); src.dispose(); }
    this.cache.clear();
  }
}

/** Plans the depth of one Sands floor from its look: `paint` draws into the ground's canvas, `build` makes the props. */
export function sandsDepth(look: SandsLook, land: SandsLand, keep: { x: number; z: number }[] = []) {
  const rnd = seeded(9300 + look.seed);
  const rim = look.rim, rmax = Math.max(...rim);
  const roads: { ax: number; az: number; bx: number; bz: number }[] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push({ ax: RING.x + p[i - 1][0], az: RING.z + p[i - 1][1], bx: RING.x + p[i][0], bz: RING.z + p[i][1] });
  const cover: Seg[] = look.pieces.map((p) => p.o);
  const nearRoad = (x: number, z: number) => { let m = 1e9; for (const s of roads) m = Math.min(m, segDist(x, z, s.ax, s.az, s.bx, s.bz)); return m; };
  const coverDist = (x: number, z: number) => { let m = 1e9; for (const c of cover) m = Math.min(m, segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r); return m; };
  const onCover = (x: number, z: number, pad: number) => cover.some((c) => segDist(x, z, c.ax, c.az, c.bx, c.bz) < c.r + pad);
  const kept = (x: number, z: number, pad: number) => keep.some((k) => Math.hypot(x - k.x, z - k.z) < 2.5 + pad);
  const placeAt = (x: number, z: number, pad: number) => look.places.find((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);
  const free = (x: number, z: number, pad: number, o: { road?: number; place?: number; inside?: number } = {}) => {
    if (land.beyond(x - RING.x, z - RING.z) > -(o.inside ?? 1.5)) return false;
    if (onCover(x, z, pad) || kept(x, z, pad)) return false;
    if (nearRoad(x, z) < (o.road ?? 2.4) + pad) return false;
    if (o.place !== undefined && placeAt(x, z, o.place)) return false;
    return true;
  };
  /** A tall thing stands only with cover just north of it (the camera looks north, so it hides nobody). */
  const backed = (x: number, z: number) => cover.some((c) => segDist(x, z - 3.5, c.ax, c.az, c.bx, c.bz) < c.r + 1.2) && !onCover(x, z, 1);
  const oasis = look.places.filter((p) => p.kind === 'oasis').map((p) => {
    // the pool: just outside the court, on its side away from the middle, where no road and no cover is
    for (let k = 0; k < 24; k++) {
      const a = Math.atan2(p.z - RING.z, p.x - RING.x) + (k % 2 ? 1 : -1) * Math.floor(k / 2) * 0.3, d = p.r + 4.2;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (free(x, z, 3.6, { road: 2.2 }) && !look.places.some((q) => q !== p && Math.hypot(q.x - x, q.z - z) < q.r + 4)) return { x, z, r: 2.8, a };
    }
    return null;
  }).filter((v): v is { x: number; z: number; r: number; a: number } => !!v);
  const inPool = (x: number, z: number, pad: number) => oasis.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad);

  /** The ground's canvas, kept from `paint` for the scenes (scenes/sands.ts paints their ground into it in `build`, before it is drawn). */
  let ground: GroundCanvas | null = null;
  /** Draws into the ground's canvas (sandsZone.ts `paint`): `X`, `Z` from offsets to pixels, `ppm` pixels a metre. */
  const paint = (g: CanvasRenderingContext2D, X: (dx: number) => number, Z: (dz: number) => number, ppm: number) => {
    ground = { g, X, Z, ppm };
    const prnd = seeded(931 + look.seed);
    // darker drifts in the lee (south) of the rocks, and pebbles: free, and from far the sand reads as ground, not a cloth
    for (const c of cover) {
      if (c.r < 1.2 || land.beyond(c.ax - RING.x, c.az - RING.z) > 0) continue;
      const gr = g.createRadialGradient(X(c.ax - RING.x), Z(c.az + c.r * 1.4 - RING.z), 0, X(c.ax - RING.x), Z(c.az + c.r * 1.4 - RING.z), c.r * 2.2 * ppm);
      gr.addColorStop(0, 'rgba(150,112,78,0.32)'); gr.addColorStop(1, 'rgba(150,112,78,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(X(c.ax - RING.x), Z(c.az + c.r * 1.4 - RING.z), c.r * 1.6 * ppm, c.r * 2.2 * ppm, 0, 0, Math.PI * 2); g.fill();
    }
    for (let k = 0, n = Math.round(rmax * rmax * 0.5); k < n; k++) {
      const x = RING.x + (prnd() - 0.5) * 2 * rmax, z = RING.z + (prnd() - 0.5) * 2 * rmax;
      if (land.beyond(x - RING.x, z - RING.z) > 2 || placeAt(x, z, 0)) continue;
      g.fillStyle = ['rgba(120,84,60,0.55)', 'rgba(160,120,86,0.6)', 'rgba(96,70,52,0.5)'][Math.floor(prnd() * 3)];
      const r = (0.05 + prnd() * 0.08) * ppm;
      g.beginPath(); g.ellipse(X(x - RING.x), Z(z - RING.z), r * 1.3, r, prnd() * 3, 0, Math.PI * 2); g.fill();
    }
    // the oasis pools: a ring of dressed stone, the water, a lighter middle (the court's flags are drawn after this, so nothing here
    // goes inside a court)
    for (const o of oasis) {
      const cx = X(o.x - RING.x), cz = Z(o.z - RING.z);
      g.fillStyle = 'rgba(120,100,80,0.9)'; g.beginPath(); g.ellipse(cx, cz, (o.r + 0.5) * ppm, (o.r * 0.8 + 0.5) * ppm, o.a, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(70,104,72,0.9)'; g.beginPath(); g.ellipse(cx, cz, (o.r + 0.15) * ppm, (o.r * 0.8 + 0.15) * ppm, o.a, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(36,118,128,0.95)'; g.beginPath(); g.ellipse(cx, cz, o.r * ppm, o.r * 0.8 * ppm, o.a, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(110,176,176,0.5)'; g.beginPath(); g.ellipse(cx - 0.4 * ppm, cz - 0.3 * ppm, o.r * 0.55 * ppm, o.r * 0.35 * ppm, o.a, 0, Math.PI * 2); g.fill();
    }
  };

  /** Builds the props: matte parts merged into `into`; gilt parts into the zone's `kit` (no new lights: the places' lanterns are enough). */
  const build = (o: { kit: GoldSink; gold: THREE.Material; into: THREE.Group; own: { dispose(): void }[] }) => {
    const { kit, gold, into, own } = o;
    const mg = new Merge(96);
    const solids: { x: number; z: number; r: number; k?: string }[] = [];
    const solid = (x: number, z: number, r: number, k?: string) => solids.push({ x, z, r, k });
    // shapes, made once
    const G = {
      box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0),
      cyl6: new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0),
      cone4: new THREE.CylinderGeometry(0.72, 1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
      ico: new THREE.IcosahedronGeometry(1, 0),
      ico1: new THREE.IcosahedronGeometry(1, 1),
      jar: new THREE.SphereGeometry(0.42, 10, 7).scale(1, 1.25, 1).translate(0, 0.5, 0),
      neck: new THREE.CylinderGeometry(0.14, 0.18, 0.22, 10).translate(0, 1.0, 0),
      flatBox: new THREE.BoxGeometry(1, 1, 1),
      oct: new THREE.OctahedronGeometry(1),
      log: new THREE.CylinderGeometry(1, 1, 1, 7).rotateZ(Math.PI / 2),
      wheel: new THREE.TorusGeometry(0.8, 0.1, 6, 14),
      sack: new THREE.SphereGeometry(0.4, 8, 6).scale(1, 0.8, 0.9).translate(0, 0.3, 0),
      rib: new THREE.TorusGeometry(0.5, 0.04, 4, 10, Math.PI),
      skull: new THREE.SphereGeometry(0.16, 7, 5).scale(1, 0.8, 1.4),
      cloth: new THREE.PlaneGeometry(1, 1),
      blade: (() => { const gg = new THREE.BufferGeometry(); const p: number[] = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), h = 0.45 + (i % 3) * 0.12; p.push(-0.06 * ca, 0, 0.06 * sa, 0.06 * ca, 0, -0.06 * sa, 0.28 * sa, h, 0.28 * ca); } gg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return gg; })(),
      cairnStone: new THREE.CylinderGeometry(1, 1, 1, 7).translate(0, 0.5, 0),
      frond: new THREE.ConeGeometry(0.3, 2.0, 4).rotateZ(-Math.PI / 2).translate(1.0, 0, 0).scale(1, 0.35, 1),
    };
    const put = (hex: string, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0) => mg.add(hex, geo, x, y, z, yaw, sx, sy, sz, tilt, 's');
    const low = (hex: string, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0) => mg.add(hex, geo, x, y, z, yaw, sx, sy, sz, tilt, 'f');
    // Small trims in a matte brass in the merged mesh (each part in the zone's gold put a gold mesh in its 24 m square: a draw each);
    // the polished gold only on the arches' lintels, few and far.
    const goldAt = (geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx) => put(C.brass, geo, x, y, z, yaw, sx, sy, sz);

    // the props
    const jar = (x: number, z: number, s: number, hex: string) => { put(hex, G.jar, x, 0, z, rnd() * 6, s); put(hex, G.neck, x, 0, z, 0, s); };
    const jars = (x: number, z: number) => { for (let k = 0; k < 2; k++) { const a = k * 2.6 + rnd(); jar(x + Math.cos(a) * 0.3, z + Math.sin(a) * 0.3, 0.5 + rnd() * 0.15, k === 1 ? C.turquoise : C.clay); } solid(x, z, 0.6, 'jars'); }; // smaller than the cover's jars
    const sack = (x: number, z: number) => { put(rnd() < 0.5 ? C.cream : C.hide, G.sack, x, 0, z, rnd() * 6, 0.9 + rnd() * 0.3); };
    const sacks = (x: number, z: number) => { for (let k = 0; k < 3; k++) sack(x + (rnd() - 0.5) * 1.1, z + (rnd() - 0.5) * 1.1); solid(x, z, 1, 'sacks'); };
    const rug = (x: number, z: number, yaw: number, a: string, b: string) => { low(b, G.flatBox, x, 0.015, z, yaw, 1.9, 0.02, 2.8); low(a, G.flatBox, x, 0.03, z, yaw, 1.6, 0.02, 2.5); low(b, G.flatBox, x, 0.045, z, yaw, 0.5, 0.02, 1.2); };
    const cairn = (x: number, z: number) => { let y = 0; for (let k = 0; k < 4; k++) { const r = 0.55 - k * 0.1, h = 0.22 + rnd() * 0.06; put([C.rockA, C.rockB, C.sandstone][k % 3], G.cairnStone, x + (rnd() - 0.5) * 0.08, y, z + (rnd() - 0.5) * 0.08, rnd() * 3, r, h, r * 0.85); y += h; } solid(x, z, 0.6, 'cairn'); };
    const milestone = (x: number, z: number, yaw: number) => { put(C.sandstone, G.box, x, 0, z, yaw, 0.5, 1.2, 0.36); put(C.turquoise, G.box, x, 0.8, z, yaw, 0.53, 0.14, 0.39); put(C.sandstone, G.cone4, x, 1.2, z, yaw + Math.PI / 4, 0.3, 0.2, 0.3); solid(x, z, 0.4, 'milestone'); };
    const waymark = (x: number, z: number, yaw: number) => { put(C.wood, G.cyl6, x, 0, z, 0, 0.06, 2.0, 0.06); put(rnd() < 0.5 ? C.turquoise : C.wine, G.cloth, x + Math.sin(yaw) * 0.25, 1.6, z + Math.cos(yaw) * 0.25, yaw + Math.PI / 2, 0.55, 0.36, 1, 1.0); solid(x, z, 0.3, 'waymark'); }; // the cloth lifted by the wind: a hanging cloth is a line from above
    const bones = (x: number, z: number, yaw: number) => { // a beast's ribs half buried, its skull
      for (let k = 0; k < 4; k++) put(C.bone, G.rib, x + Math.sin(yaw) * (k - 1.5) * 0.3, -0.12, z + Math.cos(yaw) * (k - 1.5) * 0.3, yaw + Math.PI / 2, 1 - Math.abs(k - 1.5) * 0.12);
      put(C.bone, G.skull, x + Math.sin(yaw) * 1.1, 0.1, z + Math.cos(yaw) * 1.1, yaw);
      put(C.bone, G.log, x - Math.sin(yaw) * 0.9, 0.05, z - Math.cos(yaw) * 0.9, yaw + 0.4, 0.5, 0.05, 0.05);
      solid(x, z, 1, 'bones');
    };
    const cart = (x: number, z: number, yaw: number) => { // a broken cart: its bed tipped, one wheel on, one lying, a spilled sack
      put(C.plank, G.box, x, 0.35, z, yaw, 1.5, 0.18, 2.6, 0.14);
      for (const s of [-1, 1]) put(C.plank, G.box, x + Math.cos(yaw) * s * 0.72, 0.5, z - Math.sin(yaw) * s * 0.72, yaw, 0.08, 0.4, 2.6, 0.14);
      put(C.wood, G.wheel, x + Math.cos(yaw) * 0.85, 0.8, z - Math.sin(yaw) * 0.85, yaw + Math.PI / 2);
      put(C.wood, G.wheel, x - Math.cos(yaw) * 1.6, 0.1, z + Math.sin(yaw) * 1.6, yaw, 1, 1, 1, Math.PI / 2);
      goldAt(G.cyl, x + Math.cos(yaw) * 0.9, 0.8, z - Math.sin(yaw) * 0.9, yaw, 0.12, 0.08, 0.12);
      put(C.wood, G.box, x + Math.sin(yaw) * 1.9, 0.1, z + Math.cos(yaw) * 1.9, yaw + 0.3, 0.1, 0.1, 1.8, 0.1);
      sack(x - Math.sin(yaw) * 1.7, z - Math.cos(yaw) * 1.7);
      solid(x, z, 2, 'cart');
    };
    const roadWell = (x: number, z: number) => { // a low round well, a turquoise band, a beam, a bucket
      put(C.sandstone, G.cyl, x, 0, z, 0, 0.9, 0.8, 0.9); put(C.lacquer, G.cyl, x, 0.79, z, 0, 0.7, 0.02, 0.7); put(C.turquoise, G.cyl, x, 0.32, z, 0, 0.93, 0.14, 0.93);
      for (const s of [-1, 1]) put(C.wood, G.cyl6, x + s * 0.95, 0, z, 0, 0.07, 2.2, 0.07);
      put(C.wood, G.box, x, 2.15, z, 0, 2.1, 0.1, 0.1); put(C.clay, G.cyl, x + 0.3, 1.3, z, 0, 0.16, 0.24, 0.16);
      goldAt(new THREE.TorusGeometry(0.9, 0.05, 5, 18).rotateX(Math.PI / 2), x, 0.81, z);
      jars(x + 1.8, z + 0.6);
      solid(x, z, 1.4, 'well');
    };

    // --- the roads ----------------------------------------------------------------------------------------------------------------
    let since = 10 + rnd() * 10, sinceMile = 30 + rnd() * 10, sinceBones = 40 + rnd() * 40, carts = 0, wells = 0;
    for (const s of roads) {
      const L = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / (L || 1), uz = (s.bz - s.az) / (L || 1), nx = -uz, nz = ux, yaw = Math.atan2(ux, uz);
      for (let d = 1; d < L - 1; d += 1.5) {
        const cx = s.ax + ux * d, cz = s.az + uz * d;
        since += 1.5; sinceMile += 1.5; sinceBones += 1.5;
        const side = rnd() < 0.5 ? 1 : -1, off = 3 + rnd() * 0.8, x = cx + nx * side * off, z = cz + nz * side * off;
        if (sinceMile > 46 && free(x, z, 0.4, { place: 2 })) { milestone(x, z, yaw); sinceMile = 0; continue; }
        if (since > 16 + rnd() * 10 && free(x, z, 0.5, { place: 2 })) { if (rnd() < 0.55) cairn(x, z); else waymark(x, z, yaw); since = 0; continue; }
        if (sinceBones > 70 && free(x + nx * side * 1.5, z + nz * side * 1.5, 1.2, { place: 3 })) { bones(x + nx * side * 1.5, z + nz * side * 1.5, yaw + rnd()); sinceBones = 0; continue; }
        if (carts < 1 && d > 8 && rnd() < 0.02 && free(x + nx * side * 1.8, z + nz * side * 1.8, 2.2, { place: 4 })) { cart(x + nx * side * 1.8, z + nz * side * 1.8, yaw + 0.5); carts++; continue; }
        if (wells < 1 && d > 8 && rnd() < 0.015 && free(x + nx * side * 2, z + nz * side * 2, 2.6, { place: 5 })) { roadWell(x + nx * side * 2, z + nz * side * 2); wells++; continue; }
      }
    }

    // --- the places ----------------------------------------------------------------------------------------------------------------
    const ring = (p: { x: number; z: number; r: number }, n: number, from: number, to: number, make: (x: number, z: number, a: number) => void, pad = 0.8, o2: { tall?: boolean } = {}) => {
      for (let k = 0, made = 0; k < n * 18 && made < n; k++) {
        const a = rnd() * Math.PI * 2, d = from + rnd() * (to - from), x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
        if (!free(x, z, pad, { road: 2.6 }) || inPool(x, z, 0.8) || (o2.tall && !backed(x, z))) continue;
        if (look.places.some((q) => q !== p && Math.hypot(x - q.x, z - q.z) < q.r + 1)) continue;
        make(x, z, a);
        made++;
      }
    };
    /** Flat things inside a place's court (rugs): off the cover and the spots only. */
    const inside = (p: { x: number; z: number; r: number }, n: number, make: (x: number, z: number, a: number) => void) => {
      for (let k = 0, made = 0; k < n * 18 && made < n; k++) {
        const a = rnd() * Math.PI * 2, d = rnd() * (p.r - 2), x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
        if (onCover(x, z, 1.4) || kept(x, z, -0.5)) continue;
        make(x, z, a);
        made++;
      }
    };
    const awning = (x: number, z: number, yaw: number, hex: string) => { // a cloth on four poles, its back to the cover north of it
      for (const [px, pz] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) put(C.wood, G.cyl6, x + Math.cos(yaw) * px + Math.sin(yaw) * pz, 0, z - Math.sin(yaw) * px + Math.cos(yaw) * pz, 0, 0.06, pz < 0 ? 2.5 : 2.1, 0.06);
      put(hex, G.flatBox, x, 2.3, z, yaw, 2.9, 0.05, 2.3, 0.18);
      goldAt(G.box, x + Math.sin(yaw) * 1.17, 2.12, z + Math.cos(yaw) * 1.17, yaw, 2.9, 0.05, 0.06);
      solid(x, z, 1.8, 'awning');
    };
    const urn = (x: number, z: number) => { const s = 0.9 + rnd() * 0.4; put(C.cream, G.jar, x, 0, z, 0, s * 0.9, s * 1.1, s * 0.9); put(C.sandstone, G.cyl, x, 1.05 * s, z, 0, 0.22 * s, 0.1, 0.22 * s); goldAt(G.cyl, x, 1.15 * s, z, 0, 0.08, 0.08, 0.08); solid(x, z, 0.5, 'urn'); };
    const statue = (x: number, z: number, a: number) => { // a broken statue: a plinth with its feet, the torso fallen by it, the head further off
      put(C.sandstone, G.box, x, 0, z, a, 1.2, 0.7, 1.2); put(C.turquoise, G.box, x, 0.6, z, a, 1.24, 0.12, 1.24); put(C.cream, G.box, x, 0.7, z, a, 0.8, 0.5, 0.5);
      put(C.cream, G.cone4, x + Math.cos(a) * 1.4, 0.35, z - Math.sin(a) * 1.4, a, 0.45, 1.6, 0.35, Math.PI / 2);
      put(C.cream, G.ico1, x + Math.cos(a) * 2.6, 0.25, z - Math.sin(a) * 2.6, rnd() * 6, 0.3);
      solid(x, z, 1.4, 'statue');
    };
    const ladder = (x: number, z: number, yaw: number) => { for (const s of [-0.22, 0.22]) put(C.wood, G.box, x + Math.cos(yaw) * s, 0.05, z - Math.sin(yaw) * s, yaw, 0.06, 0.06, 2.6); for (let k = -1.1; k <= 1.11; k += 0.37) put(C.plank, G.box, x + Math.sin(yaw) * k, 0.05, z + Math.cos(yaw) * k, yaw, 0.5, 0.04, 0.05); solid(x, z, 1.3, 'ladder'); };
    const rope = (x: number, z: number) => { for (let k = 0; k < 3; k++) put(C.rope, new THREE.TorusGeometry(0.3 - k * 0.04, 0.05, 5, 12).rotateX(Math.PI / 2), x, 0.05 + k * 0.09, z); solid(x, z, 0.4, 'rope'); };
    const basket = (x: number, z: number) => { put(C.rope, G.cyl, x, 0, z, 0, 0.3, 0.4, 0.3); put(C.sandstone, G.cyl, x, 0.38, z, 0, 0.26, 0.04, 0.26); solid(x, z, 0.4, 'basket'); };
    const sieve = (x: number, z: number, yaw: number) => { put(C.wood, G.box, x, 0.5, z, yaw, 1.2, 0.08, 0.9, 0.3); for (const s of [-1, 1]) put(C.wood, G.box, x + Math.cos(yaw) * s * 0.55, 0, z - Math.sin(yaw) * s * 0.55, yaw, 0.06, 0.8, 0.06); solid(x, z, 0.8, 'sieve'); };
    const spears = (x: number, z: number) => { for (let k = 0; k < 3; k++) { put(C.wood, G.cyl6, x + (rnd() - 0.5) * 0.7, 0, z + (rnd() - 0.5) * 0.7, 0, 0.03, 2.2, 0.03, (rnd() - 0.5) * 0.3); } solid(x, z, 0.5, 'spears'); };
    const hideRack = (x: number, z: number, yaw: number) => { for (const s of [-1, 1]) put(C.wood, G.cyl6, x + Math.cos(yaw) * s, 0, z - Math.sin(yaw) * s, 0, 0.05, 1.6, 0.05); put(C.wood, G.box, x, 1.55, z, yaw, 2.1, 0.06, 0.06); put(C.hide, G.cloth, x, 1.05, z, yaw, 1.4, 1.0, 1, 0.6); solid(x, z, 1.2, 'hides'); };
    const rubble = (x: number, z: number) => { for (let k = 0; k < 4; k++) put(rnd() < 0.5 ? C.sandstone : C.cream, G.box, x + (rnd() - 0.5) * 1.4, 0, z + (rnd() - 0.5) * 1.4, rnd() * 3, 0.4 + rnd() * 0.4, 0.25 + rnd() * 0.25, 0.3 + rnd() * 0.3, (rnd() - 0.5) * 0.3); solid(x, z, 0.9, 'rubble'); };
    const drum = (x: number, z: number, a: number) => { put(C.cream, G.cyl, x, 0.32, z, a, 0.32, 0.45, 0.32, Math.PI / 2); solid(x, z, 0.5, 'drum'); }; // smaller than the fallen columns that are cover
    const firewood = (x: number, z: number, a: number) => { for (let k = 0; k < 5; k++) put(k % 2 ? C.plank : C.wood, G.log, x + Math.sin(a) * (k % 3 - 1) * 0.24, 0.12 + Math.floor(k / 3) * 0.22, z + Math.cos(a) * (k % 3 - 1) * 0.24, a, 0.6, 0.11, 0.11); solid(x, z, 0.7, 'firewood'); };
    const rack = (x: number, z: number, yaw: number) => { put(C.wood, G.box, x, 0.9, z, yaw, 1.6, 0.08, 0.08); for (const s of [-1, 1]) put(C.wood, G.box, x + Math.cos(yaw) * s * 0.75, 0, z - Math.sin(yaw) * s * 0.75, yaw, 0.08, 1.0, 0.08); for (let k = -0.5; k <= 0.51; k += 0.33) put(C.wood, G.cyl6, x + Math.cos(yaw) * k, 0, z - Math.sin(yaw) * k, 0, 0.025, 1.8, 0.025, 0.12); solid(x, z, 1, 'rack'); };
    const bowl = (x: number, z: number) => { put(C.clay, G.cyl, x, 0, z, 0, 0.22, 0.1, 0.22); put(C.wine, G.ico, x, 0.12, z, rnd() * 6, 0.07); goldAt(G.cyl, x, 0.1, z, 0, 0.23, 0.02, 0.23); };
    const flags = (x: number, z: number, a: number) => { // prayer flags on a line between two poles
      const cx = Math.cos(a), sz = -Math.sin(a);
      for (const s of [-1.6, 1.6]) put(C.wood, G.cyl6, x + cx * s, 0, z + sz * s, 0, 0.05, 2.3, 0.05);
      put(C.rope, G.box, x, 2.2, z, a, 3.2, 0.02, 0.02);
      for (let f = -1.3; f <= 1.31; f += 0.37) put([C.turquoise, C.wine, C.cream, C.brass][Math.floor(rnd() * 4)], G.cloth, x + cx * f, 1.95, z + sz * f, a, 0.3, 0.42, 1, 0.8);
      solid(x, z, 1.7, 'flags');
    };
    const smallPalm = (x: number, z: number) => {
      const h = 2.6 + rnd() * 1.2, lean = (rnd() - 0.5) * 0.25;
      put(C.plank, G.cyl6, x, 0, z, 0, 0.13, h, 0.13, lean);
      const tz = z + Math.sin(lean) * h, ty = Math.cos(lean) * h;
      for (let i = 0; i < 6; i++) put(C.palm, G.frond, x, ty, tz, (i / 6) * Math.PI * 2 + rnd() * 0.4);
      solid(x, z, 0.6, 'palm');
    };
    const reeds = (x: number, z: number) => { for (let k = 0; k < 5; k++) low(C.reed, G.blade, x + (rnd() - 0.5) * 0.8, 0, z + (rnd() - 0.5) * 0.8, rnd() * 6, 1, 2 + rnd() * 0.8, 1); };
    const bedroll = (x: number, z: number, a: number) => { low(C.wine, G.flatBox, x, 0.07, z, a, 0.75, 0.14, 1.8); put(C.cream, G.log, x + Math.sin(a) * 0.8, 0.15, z + Math.cos(a) * 0.8, a + Math.PI / 2, 0.38, 0.15, 0.15); };
    for (const p of look.places) {
      const r = p.r;
      switch (p.kind) {
        case 'camp':
          inside(p, 2, (x, z, a) => rug(x, z, a, C.turquoise, C.wine));
          ring(p, 3, r - 0.5, r + 3, (x, z, a) => { bedroll(x, z, a); solid(x, z, 1); }, 0.6);
          ring(p, 1, r - 0.5, r + 3, (x, z) => { put(C.lacquer, new THREE.SphereGeometry(0.3, 10, 6), x, 0.25, z); put(C.sandstone, G.cyl, x, 0, z, 0, 0.45, 0.12, 0.45); goldAt(new THREE.TorusGeometry(0.26, 0.025, 4, 12).rotateX(Math.PI / 2), x, 0.48, z); solid(x, z, 0.5); }, 0.6);
          ring(p, 2, r, r + 4, (x, z) => sacks(x, z), 0.8);
          break;
        case 'serai':
          inside(p, 3, (x, z, a) => rug(x, z, a, rnd() < 0.5 ? C.wine : C.turquoise, C.cream));
          ring(p, 3, r + 0.5, r + 4, (x, z) => jars(x, z), 0.8);
          ring(p, 1, r + 1, r + 5, (x, z) => awning(x, z, 0, C.turquoise), 1.2, { tall: true });
          ring(p, 2, r + 0.5, r + 4, (x, z) => sacks(x, z), 0.8);
          break;
        case 'tombs':
          ring(p, 4, r - 1, r + 3, (x, z) => urn(x, z), 0.6);
          ring(p, 2, r + 1, r + 6, (x, z, a) => statue(x, z, a), 1.2);
          break;
        case 'dig':
          { // a pegged grid over the court, rope on the ground between the pegs (flat)
            const sz = p.r * 0.45;
            for (let i = -2; i <= 2; i++) {
              low(C.rope, G.flatBox, p.x, 0.03, p.z + (i * sz) / 2, 0, sz * 2, 0.02, 0.05);
              low(C.rope, G.flatBox, p.x + (i * sz) / 2, 0.03, p.z, 0, 0.05, 0.02, sz * 2);
              for (let j = -2; j <= 2; j++) low(C.wood, G.box, p.x + (i * sz) / 2, 0, p.z + (j * sz) / 2, 0, 0.07, 0.25, 0.07);
            }
          }
          ring(p, 2, r, r + 4, (x, z, a) => ladder(x, z, a), 1);
          ring(p, 3, r - 0.5, r + 3, (x, z) => rope(x, z), 0.5);
          ring(p, 4, r - 0.5, r + 3, (x, z) => basket(x, z), 0.5);
          ring(p, 1, r + 0.5, r + 4, (x, z, a) => sieve(x, z, a), 1);
          break;
        case 'oasis': {
          const pool = oasis.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < p.r + 6);
          if (pool) {
            for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, x = pool.x + Math.cos(a) * (pool.r + 0.6), z = pool.z + Math.sin(a) * (pool.r * 0.8 + 0.6); if (!onCover(x, z, 0.3) && !kept(x, z, -1)) put(C.sandstone, G.box, x, -0.05, z, -a, 0.7, 0.22, 0.5); }
            for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6, x = pool.x + Math.cos(a) * (pool.r + 1.4), z = pool.z + Math.sin(a) * (pool.r * 0.8 + 1.4); if (!onCover(x, z, 0.3) && !kept(x, z, -1)) reeds(x, z); }
            solid(pool.x, pool.z, pool.r + 0.8);
          }
          ring(p, 3, r + 1, r + 6, (x, z) => smallPalm(x, z), 1.2, { tall: true });
          ring(p, 2, r + 0.5, r + 4, (x, z) => jars(x, z), 0.8);
          break;
        }
        case 'raiders':
          ring(p, 3, r - 0.5, r + 3, (x, z) => spears(x, z), 0.5);
          ring(p, 1, r + 0.5, r + 4, (x, z, a) => hideRack(x, z, a + Math.PI / 2), 1);
          ring(p, 2, r, r + 4, (x, z) => sacks(x, z), 0.8);
          break;
        case 'ruins': case 'bridge': case 'bay':
          ring(p, 4, r - 0.5, r + 5, (x, z) => rubble(x, z), 0.6);
          ring(p, 2, r + 0.5, r + 5, (x, z, a) => drum(x, z, a), 0.8);
          break;
        case 'fort': case 'gatehouse':
          ring(p, 1, r + 0.5, r + 4, (x, z, a) => rack(x, z, a + Math.PI / 2), 1);
          ring(p, 2, r, r + 4, (x, z) => sacks(x, z), 0.8);
          ring(p, 2, r, r + 4, (x, z) => spears(x, z), 0.5);
          break;
        case 'tower':
          ring(p, 2, r, r + 4, (x, z, a) => firewood(x, z, a), 0.8);
          ring(p, 1, r, r + 4, (x, z) => sacks(x, z), 0.8);
          break;
        case 'shrine':
          ring(p, 6, r - 1.2, r + 0.5, (x, z) => bowl(x, z), 0.3);
          ring(p, 1, r + 0.5, r + 4, (x, z, a) => flags(x, z, a + Math.PI / 2), 1.2);
          break;
        case 'well':
          ring(p, 1, r - 0.5, r + 3, (x, z, a) => { put(C.sandstone, G.box, x, 0, z, a, 2.2, 0.5, 0.7); put(C.lacquer, G.box, x, 0.46, z, a, 1.9, 0.05, 0.45); solid(x, z, 1.2); }, 1);
          ring(p, 2, r, r + 4, (x, z) => jars(x, z), 0.8);
          break;
      }
    }

    // --- the open sand: scrub, thorn bushes, stones, slabs (flat, no shadows) ---------------------------------------------------------------
    const area = 0.5 * Math.sin((Math.PI * 2) / rim.length) * rim.reduce((s, v, i) => s + v * rim[(i + 1) % rim.length], 0);
    for (let k = 0, made = 0, want = Math.round(area / 28); k < want * 4 && made < want; k++) {
      const cx = RING.x + (rnd() - 0.5) * 2 * rmax, cz = RING.z + (rnd() - 0.5) * 2 * rmax;
      if (!free(cx, cz, 0.3, { road: 2.2, place: 1.5, inside: 1 }) || inPool(cx, cz, 1)) continue;
      // more in the lee of the rocks, where the sand holds water
      if (rnd() > (coverDist(cx, cz) < 5 ? 1 : 0.45)) continue;
      const n = 1 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const x = cx + (rnd() - 0.5) * 2.4, z = cz + (rnd() - 0.5) * 2.4;
        if (!free(x, z, 0.2, { road: 2, place: 1, inside: 0.5 })) continue;
        const u = rnd();
        if (u < 0.55) low(rnd() < 0.6 ? C.scrub : C.scrubDark, G.blade, x, 0, z, rnd() * 6, 0.9 + rnd() * 0.6, 0.7 + rnd() * 0.7);
        else if (u < 0.75) low(C.thorn, G.ico, x, 0.2, z, rnd() * 6, 0.35 + rnd() * 0.3, 0.3 + rnd() * 0.15, 0.35 + rnd() * 0.3);
        else if (u < 0.93) low([C.rockA, C.rockB, C.rockC][Math.floor(rnd() * 3)], G.oct, x, 0.02, z, rnd() * 6, 0.15 + rnd() * 0.2, 0.1 + rnd() * 0.08, 0.15 + rnd() * 0.2);
        else low(C.sandstone, G.flatBox, x, 0.04, z, rnd() * 6, 0.9 + rnd() * 0.7, 0.1, 0.6 + rnd() * 0.5, (rnd() - 0.5) * 0.15);
        made++;
      }
    }

    // --- far off: ruined arches on the cliffs, the caravan, vultures ------------------------------------------------------------------------
    const arches: { x: number; z: number; y: number }[] = [];
    for (let k = 0, made = 0; k < 120 && made < 3; k++) {
      // two at the cliffs' foot (seen from the floor), one up on the cliffs
      const foot = made < 2, a = rnd() * Math.PI * 2, b = foot ? 1.4 + rnd() * 1.0 : 14 + rnd() * 18, rr = rimAt(rim, a) + b, dx = Math.cos(a) * rr, dz = Math.sin(a) * rr;
      if (land.south(dx, dz) > 0.3 || land.duneSide(dx, dz) > 0.3 || land.steepness(dx, dz) > (foot ? 2.2 : 0.35) || (foot && land.height(dx, dz) > 3)) continue;
      const x = RING.x + dx, z = RING.z + dz, y = land.height(dx, dz) - 0.4, yaw = Math.atan2(-dx, -dz), broken = made === 1;
      for (const s of [-1, 1]) {
        const px = x + Math.cos(yaw) * s * 3.2, pz = z - Math.sin(yaw) * s * 3.2, h = broken && s > 0 ? 3.2 : 6;
        put(C.flag, G.box, px, y, pz, yaw, 1.4, h, 1.4); put(C.turquoise, G.box, px, y + h * 0.7, pz, yaw, 1.46, 0.3, 1.46);
      }
      if (!broken) { put(C.flag, G.box, x, y + 6, z, yaw, 7.8, 1.1, 1.5); kit.add(gold, G.box, x, y + 7.1, z, yaw, 7.9, 0.1, 1.6); }
      else put(C.flag, G.box, x + Math.cos(yaw) * 2.6, y, z - Math.sin(yaw) * 2.6, yaw + 0.3, 3.2, 1.0, 1.4, 0.1);
      arches.push({ x, z, y });
      made++;
    }
    // the caravan: a line of camels, dark against the haze, walking along the far cliff tops in the north, back and forth
    const camel = (() => {
      const parts: THREE.BufferGeometry[] = [
        new THREE.SphereGeometry(0.75, 8, 6).scale(1.5, 0.75, 0.75).translate(0, 1.8, 0),
        new THREE.SphereGeometry(0.45, 8, 6).translate(0, 2.35, 0),
        new THREE.CylinderGeometry(0.16, 0.22, 1.3, 6).rotateZ(-0.7).translate(1.35, 2.25, 0),
        new THREE.SphereGeometry(0.24, 7, 5).scale(1.4, 0.8, 0.8).translate(1.9, 2.75, 0),
        ...[[-0.7, -0.3], [-0.7, 0.3], [0.7, -0.3], [0.7, 0.3]].map(([lx, lz]) => new THREE.CylinderGeometry(0.08, 0.1, 1.5, 5).translate(lx, 0.75, lz)),
      ];
      const ni = parts.map((p) => (p.index ? p.toNonIndexed() : p));
      const merged = new THREE.BufferGeometry(), all: number[] = [];
      for (const p of ni) all.push(...(p.attributes.position.array as Float32Array));
      merged.setAttribute('position', new THREE.Float32BufferAttribute(all, 3));
      merged.computeVertexNormals();
      parts.forEach((p) => p.dispose()); ni.forEach((p) => p.dispose());
      return merged;
    })();
    const camelMat = new THREE.MeshBasicMaterial({ color: 0x5a4030 });
    own.push(camel, camelMat);
    const CAMELS = 7, herd = new THREE.InstancedMesh(camel, camelMat, CAMELS), m4 = new THREE.Matrix4();
    herd.frustumCulled = false;
    into.add(herd);
    const route = (() => { // over the dunes, 30 m past the edge, about 70 m long (with no dunes: along the northern cliffs, 46 m out)
      const mid = look.dunes === 1 ? -0.25 : look.dunes === -1 ? Math.PI + 0.25 : -Math.PI / 2, b = look.dunes ? 30 : 46;
      const at = (a: number) => { const rr = rimAt(rim, a) + b, dx = Math.cos(a) * rr, dz = Math.sin(a) * rr; return { x: RING.x + dx, z: RING.z + dz, y: land.height(dx, dz) - 0.1 }; };
      return [at(mid - 0.3), at(mid + 0.3)];
    })();
    const rlen = Math.hypot(route[1].x - route[0].x, route[1].z - route[0].z), rax = (route[1].x - route[0].x) / rlen, raz = (route[1].z - route[0].z) / rlen;
    // vultures: two flocks circling over the walls' side
    const VULTS = 8, vgeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.3, 1.5, 0.15, 0.1, 0, 0, 0.35, 0, 0, -0.3, 0, 0, 0.35, -1.5, 0.15, 0.1], 3)); g.computeVertexNormals(); return g; })();
    const vmat = new THREE.MeshBasicMaterial({ color: 0x2a2220, side: THREE.DoubleSide });
    own.push(vgeo, vmat);
    const vults = new THREE.InstancedMesh(vgeo, vmat, VULTS);
    vults.frustumCulled = false;
    into.add(vults);
    const vx = new Float32Array(VULTS), vz = new Float32Array(VULTS), vr = new Float32Array(VULTS), vh = new Float32Array(VULTS), vs = new Float32Array(VULTS), vp = new Float32Array(VULTS);
    for (let i = 0; i < VULTS; i++) {
      const a = (i < VULTS / 2 ? -Math.PI / 2 - 0.6 : -Math.PI / 2 + 0.7) + (rnd() - 0.5) * 0.2, d = rimAt(rim, a) + 8;
      vx[i] = RING.x + Math.cos(a) * d; vz[i] = RING.z + Math.sin(a) * d; vr[i] = 6 + rnd() * 5; vh[i] = 17 + rnd() * 5; vs[i] = 0.18 + rnd() * 0.1; vp[i] = rnd() * 6.28;
    }
    const e = new THREE.Euler();
    const update = (time: number) => {
      const span = rlen + CAMELS * 3.2, t = (time * 0.9) % (2 * span), dir = t < span ? 1 : -1, lead = t < span ? t : 2 * span - t;
      for (let i = 0; i < CAMELS; i++) {
        const s = Math.max(0, Math.min(rlen, lead - i * 3.2)), x = route[0].x + rax * s, z = route[0].z + raz * s;
        const y = route[0].y + (route[1].y - route[0].y) * (s / rlen) + Math.abs(Math.sin(time * 2.4 + i)) * 0.08;
        m4.makeRotationFromEuler(e.set(0, Math.atan2(-raz * dir, rax * dir), 0)).setPosition(x, y, z);
        herd.setMatrixAt(i, m4);
      }
      herd.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < VULTS; i++) {
        const a = vp[i] + time * vs[i];
        m4.makeRotationFromEuler(e.set(0, -a, 0.35)).setPosition(vx[i] + Math.cos(a) * vr[i], vh[i] + Math.sin(time * 0.7 + i) * 0.8, vz[i] + Math.sin(a) * vr[i]);
        vults.setMatrixAt(i, m4);
      }
      vults.instanceMatrix.needsUpdate = true;
    };
    update(0);
    // The scenes (scenes/sands.ts): little stories in props, into the same merged meshes; their own random stream, so nothing above moves.
    const sc = sandsScenes({ look, land, keep, solids, sink: mg, ground });
    ground = null;
    mg.build(into, own);
    for (const g of Object.values(G)) g.dispose();
    const caravan = { x: (route[0].x + route[1].x) / 2, z: (route[0].z + route[1].z) / 2, y: (route[0].y + route[1].y) / 2 };
    return { update, solids, pools: oasis.map((p) => ({ x: p.x, z: p.z })), far: { caravan, arches }, scenes: sc.scenes, scenesMs: sc.ms };
  };

  return { paint, build };
}
