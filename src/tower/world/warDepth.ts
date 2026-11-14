import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING } from '../../arenas/common';
import type { Battlefield, WarLook, WarMats } from './warZone';

/**
 * The world's depth on a War floor (the user, 2026-11-14: "add depth into the worlds, make all the background look fit there, all the
 * roads and zones, make them look like they fit there, don't be shy"): the sea's `depth.ts`, made for a war. Looks only, never cover:
 * nothing here stops a walk or a shot, and it keeps off the cover, the roads' middles and the places' stands.
 *
 * - Roads: milestones, banners on poles in the colours of the side they are on (torn), palisade stakes and a broken cart on the verge,
 *   arrows in the ground.
 * - The field: tired grass, arrows in clumps where a volley fell, dropped helmets and broken spears.
 * - Places, dressed as what they are: spears planted on a ridge, stone shot and timber at the works, spilled barrels at the wagons,
 *   drums on the hill, fascines and ladders before the siege line, a burned farm's beams and well, the hospital's cots and washing,
 *   the keep's rubble, the camp's logs, bedrolls and a rack of spears.
 * - Far off: the enemy's keep on the ridge behind the siege line; the two armies' camps on the hills either side, rows of tents and
 *   their fires; watch fires on the hilltops; dead trees; columns of smoke; crows wheeling over the field.
 *
 * Merged by colour into one mesh a square of ground (`VDress`), or instanced (the grass, arrows, helmets, flames, crows): a few draw
 * calls in all. No glow sprites (each is a draw call of its own): the far flames and lit windows are emissive and the bloom lights them.
 */

type Seg = { ax: number; az: number; bx: number; bz: number; r: number };
export interface WarDepthIn {
  look: WarLook;
  geo: Battlefield;
  into: THREE.Group;
  own: { dispose(): void }[];
  rnd: () => number;
  mats: WarMats;
}

const segDist = (px: number, pz: number, s: Seg) => {
  const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - s.ax) * ex + (pz - s.az) * ez) / l2)) : 0;
  return Math.hypot(px - (s.ax + ex * t), pz - (s.az + ez * t));
};

/** The depth's colours (the heroes' palette, STYLE.md, and the armies' two): each part one flat colour, carried in its vertices. */
const PALETTE = {
  wood: '#4a3220', dark: '#2c211a', plank: '#6b4a2e', stone: '#7a766e', mile: '#8a8478', rubble: '#6c6860', charred: '#3a3430',
  steel: '#8a8e98', iron: '#2a2c32', cream: '#d8cfb4', white: '#e8e2d2', straw: '#b89a5a', sack: '#9a8a66', rope: '#b89a5a',
  crimson: '#9a2c2c', azure: '#2c4c9a', leaf: '#3e4a30', bark: '#3a3028', canvas: '#c8bea4', hill: '#56604a',
} as const;
type Key = keyof typeof PALETTE;

/** Geometry merged by colour per square of ground `CELL` m across: one mesh a square, whatever the colours (as land.ts's `Dress`). */
const CELL = 48;
class VDress {
  private readonly cell: number;
  constructor(cell = CELL) { this.cell = cell; }
  private cells = new Map<string, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();
  private colors = new Map<Key, THREE.Color>();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  add(key: Key, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0): this {
    let col = this.colors.get(key);
    if (!col) this.colors.set(key, (col = new THREE.Color(PALETTE[key])));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.m.compose(this.v.set(x, y, z), this.q.setFromEuler(this.e.set(tilt, yaw, roll, 'YXZ')), this.s.set(sx, sy, sz));
    g.applyMatrix4(this.m);
    g.computeBoundingBox();
    const ctr = g.boundingBox!.getCenter(this.v), key2 = `${Math.floor(ctr.x / this.cell)}:${Math.floor(ctr.z / this.cell)}`;
    let cell = this.cells.get(key2);
    if (!cell) this.cells.set(key2, (cell = []));
    cell.push(g);
    return this;
  }
  build(into: THREE.Group, own: { dispose(): void }[], shadows = true) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    own.push(material);
    for (const geos of this.cells.values()) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      into.add(mesh);
      own.push(merged);
    }
    this.cells.clear();
  }
}

export function buildWarDepth(o: WarDepthIn) {
  const { look, geo, rnd } = o;
  const near = new VDress(), far = new VDress(120); // far off, one mesh a large square: few draws for the horizon
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (r0: number, r1: number, h: number, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const rim = look.rim, rmax = Math.max(...rim);
  const H = (x: number, z: number) => geo.height(x - RING.x, z - RING.z);
  const beyond = (x: number, z: number) => geo.beyond(x - RING.x, z - RING.z);
  const side = (x: number): Key => ((x - RING.x) * look.crimson > 0 ? 'crimson' : 'azure');
  // the cover and the roads, as world segments
  const cover: Seg[] = look.pieces.map((p) => ({ ax: p.o.ax, az: p.o.az, bx: p.o.bx, bz: p.o.bz, r: p.o.r }));
  const roads: Seg[] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push({ ax: RING.x + p[i - 1][0], az: RING.z + p[i - 1][1], bx: RING.x + p[i][0], bz: RING.z + p[i][1], r: 0 });
  const nearRoad = (x: number, z: number) => roads.reduce((m, s) => Math.min(m, segDist(x, z, s)), 1e9);
  const onCover = (x: number, z: number, pad: number) => cover.some((c) => segDist(x, z, c) < c.r + pad);
  const inPlace = (x: number, z: number, pad: number) => look.places.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);
  const behindLine = (x: number, z: number) => z < look.line.z + 1.5 && x > look.line.w - 2 && x < look.line.e + 2;
  /** Free ground for a look: inside the outline by `inside` m, off cover, off the roads' middles, off the places if asked. */
  const free = (x: number, z: number, pad: number, q: { road?: number; place?: number; inside?: number } = {}) => {
    if (beyond(x, z) > -(q.inside ?? 1)) return false;
    if (behindLine(x, z) || onCover(x, z, pad)) return false;
    if (nearRoad(x, z) < (q.road ?? 2.4) + pad) return false;
    if (q.place !== undefined && inPlace(x, z, q.place)) return false;
    return true;
  };

  // --- instanced things: grass, arrows, helmets, broken spears, far flames --------------------------------------------------------
  const lists = { tuft: [] as THREE.Matrix4[], arrow: [] as THREE.Matrix4[], helm: [] as THREE.Matrix4[], spear: [] as THREE.Matrix4[], flame: [] as THREE.Matrix4[] };
  const qq = new THREE.Quaternion(), ee = new THREE.Euler();
  const put = (list: THREE.Matrix4[], x: number, y: number, z: number, s: number, sy = s, yaw = rnd() * 6.28, tilt = 0, roll = 0) =>
    list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), qq.setFromEuler(ee.set(tilt, yaw, roll, 'YXZ')).clone(), new THREE.Vector3(s, sy, s)));

  // --- the roads: milestones, banners on poles, stakes on the verge, a broken cart now and then, arrows -------------------------------
  for (const p of look.paths) {
    let sinceMile = rnd() * 10, sinceBanner = rnd() * 14, s0 = rnd() < 0.5 ? 1 : -1;
    for (let i = 1; i < p.length; i++) {
      const ax = RING.x + p[i - 1][0], az = RING.z + p[i - 1][1], bx = RING.x + p[i][0], bz = RING.z + p[i][1];
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / (L || 1), uz = (bz - az) / (L || 1), nx = -uz, nz = ux, yaw = Math.atan2(ux, uz);
      for (let s = 1.5; s < L - 1.5; s += 1.2) {
        const cx = ax + ux * s, cz = az + uz * s;
        sinceMile += 1.2; sinceBanner += 1.2;
        if (sinceMile > 24 + rnd() * 8) {
          sinceMile = 0; s0 = -s0;
          const x = cx + nx * s0 * 3.1, z = cz + nz * s0 * 3.1;
          if (free(x, z, 0.4, { road: 2.6, place: 1 })) near.add('mile', new THREE.CylinderGeometry(0.22, 0.3, 1.0, 6).translate(0, 0.5, 0), x, 0, z, yaw).add('stone', box(0.62, 0.14, 0.62), x, 0, z, yaw);
        }
        if (sinceBanner > 30 + rnd() * 10) {
          sinceBanner = 0;
          const sd = -s0, x = cx + nx * sd * 3.3, z = cz + nz * sd * 3.3;
          if (free(x, z, 0.4, { road: 2.6, place: 1.5 })) {
            const h = 3.6 + rnd() * 1.2, k = side(x);
            near.add('wood', cyl(0.07, 0.09, h, 6), x, 0, z, 0, 1, 1, 1, (rnd() - 0.5) * 0.12).add('wood', box(1.1, 0.07, 0.07), x, h - 0.3, z, yaw);
            near.add(k, new THREE.PlaneGeometry(0.95, 1.0 + rnd() * 0.6).translate(0, -0.65, 0), x, h - 0.33, z, yaw, 1, 1, 1, 0, (rnd() - 0.5) * 0.1);
          }
        }
        if (rnd() < 0.03) { // stakes on the verge
          const sd = rnd() < 0.5 ? 1 : -1, x = cx + nx * sd * 3.6, z = cz + nz * sd * 3.6;
          if (free(x, z, 0.5, { road: 2.8, place: 1 })) for (let k = 0; k < 3; k++) near.add('wood', new THREE.ConeGeometry(0.09, 1.5, 5).translate(0, 0.75, 0), x + ux * (k - 1) * 0.35, 0, z + uz * (k - 1) * 0.35, yaw, 1, 1, 1, 0.4 * sd);
        }
        if (rnd() < 0.006) { // a broken cart pushed off the road
          const sd = rnd() < 0.5 ? 1 : -1, x = cx + nx * sd * 4.6, z = cz + nz * sd * 4.6;
          if (free(x, z, 1.6, { road: 3.2, place: 2 })) {
            near.add('plank', box(1.4, 0.4, 2.4), x, 0.25, z, yaw + 0.3, 1, 1, 1, 0.18).add('dark', new THREE.TorusGeometry(0.5, 0.08, 6, 14), x + 0.9, 0.5, z, yaw + 0.3 + Math.PI / 2);
            near.add('dark', new THREE.TorusGeometry(0.5, 0.08, 6, 14).rotateX(Math.PI / 2), x - 1.2, 0.08, z + 0.6).add('wood', box(0.1, 0.1, 2), x, 0.2, z - 1.6, yaw + 0.6);
          }
        }
        if (rnd() < 0.05) { // arrows in the verge
          const sd = rnd() < 0.5 ? 1 : -1, x = cx + nx * sd * (2.8 + rnd() * 2), z = cz + nz * sd * (2.8 + rnd() * 2);
          if (free(x, z, 0.2, { road: 2.2 })) put(lists.arrow, x, 0, z, 1, 1, rnd() * 6.28, 0.3 + rnd() * 0.3);
        }
      }
    }
  }

  // --- the places, dressed as what they are ----------------------------------------------------------------------------------------
  const ring = (p: { x: number; z: number; r: number }, n: number, from: number, to: number, make: (x: number, z: number, a: number) => void, pad = 0.8) => {
    for (let k = 0, made = 0; k < n * 14 && made < n; k++) {
      const a = rnd() * Math.PI * 2, d = from + rnd() * (to - from), x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      if (!free(x, z, pad, { road: 2.4 })) continue;
      make(x, z, a);
      made++;
    }
  };
  const spear = (x: number, z: number, a: number) => near.add('wood', cyl(0.035, 0.04, 2.6, 5), x, 0, z, a, 1, 1, 1, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3).add('steel', new THREE.ConeGeometry(0.06, 0.32, 4).translate(0, 2.75, 0), x, 0, z, a, 1, 1, 1, 0, 0);
  for (const p of look.places) {
    const r = p.r;
    switch (p.kind) {
      case 'ridge':
        ring(p, 7, r - 1, r + 3, (x, z, a) => spear(x, z, a), 0.3);
        ring(p, 4, r - 1, r + 4, (x, z) => put(lists.helm, x, 0, z, 1, 1, rnd() * 6, (rnd() - 0.5) * 0.6), 0.2);
        break;
      case 'works':
        ring(p, 3, r - 1, r + 4, (x, z) => { for (let k = 0; k < 6; k++) near.add('stone', new THREE.IcosahedronGeometry(0.32, 0), x + (k % 3 - 1) * 0.55, 0.28 + (k > 2 ? 0.45 : 0), z + (k > 2 ? 0.2 : 0)); }, 0.8);
        ring(p, 2, r, r + 5, (x, z, a) => { for (let k = 0; k < 5; k++) near.add('wood', cyl(0.16, 0.16, 3.2, 7).rotateZ(Math.PI / 2).translate(0, 0.16 + (k % 3) * 0.3, (k - 2) * 0.18), x, 0, z, a); }, 1.2);
        ring(p, 2, r - 1, r + 3, (x, z) => near.add('rope', new THREE.TorusGeometry(0.34, 0.09, 6, 14).rotateX(Math.PI / 2).translate(0, 0.09, 0), x, 0, z), 0.4);
        break;
      case 'wagons':
        ring(p, 5, r - 1, r + 5, (x, z) => near.add('plank', cyl(0.36, 0.4, 0.95, 10).rotateZ(Math.PI / 2).translate(0, 0.38, 0), x, 0, z, rnd() * 6), 0.6);
        ring(p, 6, r - 1, r + 6, (x, z) => near.add(rnd() < 0.5 ? 'plank' : 'charred', box(0.3, 0.06, 1.4 + rnd()), x, 0.02, z, rnd() * 6, 1, 1, 1, (rnd() - 0.5) * 0.15), 0.4);
        break;
      case 'hill':
        ring(p, 3, r - 2, r + 2, (x, z) => near.add('plank', cyl(0.5, 0.45, 0.7, 12).rotateZ(Math.PI / 2 - 0.2).translate(0, 0.45, 0), x, 0, z, rnd() * 6).add(side(x), cyl(0.51, 0.51, 0.3, 12).rotateZ(Math.PI / 2 - 0.2).translate(0, 0.45, 0), x, 0, z, rnd() * 6), 0.8);
        ring(p, 2, r, r + 4, (x, z, a) => near.add('wood', cyl(0.06, 0.08, 4, 6).rotateZ(Math.PI / 2).translate(0, 0.08, 0), x, 0, z, a), 1);
        break;
      case 'siege':
        ring(p, 6, r - 1, r + 6, (x, z, a) => { for (let k = 0; k < 7; k++) near.add('straw', cyl(0.07, 0.07, 2.4, 4).rotateZ(Math.PI / 2).translate(0, 0.25 + (k % 2) * 0.12, (k - 3) * 0.08), x, 0, z, a); }, 1); // fascines
        ring(p, 2, r, r + 5, (x, z, a) => { for (const s of [-0.3, 0.3]) near.add('wood', box(0.07, 0.07, 4.2), x + Math.cos(a) * s, 0.05, z - Math.sin(a) * s, a); for (let k = -3; k <= 3; k++) near.add('wood', box(0.6, 0.05, 0.05), x + Math.sin(a) * k * 0.55, 0.06, z + Math.cos(a) * k * 0.55, a); }, 1.4); // ladders
        break;
      case 'farm': case 'mill':
        ring(p, 4, r - 1, r + 5, (x, z) => near.add('charred', box(0.22, 0.22, 2.4 + rnd() * 1.4), x, 0.1, z, rnd() * 6, 1, 1, 1, (rnd() - 0.5) * 0.3), 0.5);
        ring(p, 1, r + 1, r + 6, (x, z) => { near.add('stone', cyl(0.75, 0.8, 0.8, 12), x, 0, z).add('iron', cyl(0.58, 0.58, 0.82, 12), x, 0, z); for (const s of [-1, 1]) near.add('dark', box(0.1, 1.8, 0.1), x + s * 0.65, 0, z); near.add('dark', box(1.6, 0.1, 0.1), x, 1.8, z); }, 1.6);
        ring(p, 2, r, r + 6, (x, z, a) => { for (let k = 0; k < 3; k++) near.add('charred', box(0.12, 0.9, 0.12), x + Math.cos(a) * k * 1.5, 0, z - Math.sin(a) * k * 1.5); near.add('wood', box(0.06, 0.1, 3.2), x + Math.cos(a) * 1.5, 0.6, z - Math.sin(a) * 1.5, a + Math.PI / 2); }, 1);
        break;
      case 'hospital':
        ring(p, 3, r - 1, r + 4, (x, z, a) => near.add('wood', box(1.9, 0.45, 0.8), x, 0, z, a).add('white', box(1.8, 0.08, 0.75), x, 0.45, z, a), 0.8);
        ring(p, 2, r, r + 5, (x, z, a) => { // washing on a line: bandages and sheets
          for (const s of [-1, 1]) near.add('wood', box(0.08, 2, 0.08), x + Math.cos(a) * 2 * s, 0, z - Math.sin(a) * 2 * s);
          near.add('rope', box(4, 0.02, 0.02), x, 1.9, z, a + Math.PI / 2);
          for (const f of [-1.3, -0.4, 0.5, 1.3]) near.add('white', box(0.6, 0.75, 0.02).translate(0, -0.38, 0), x + Math.cos(a) * f, 1.9, z - Math.sin(a) * f, a);
        }, 1);
        ring(p, 3, r - 1, r + 3, (x, z) => near.add('sack', cyl(0.3, 0.24, 0.4, 9), x, 0, z), 0.4); // baskets
        break;
      case 'keep':
        ring(p, 8, r - 1, r + 6, (x, z) => near.add('rubble', box(0.7 + rnd() * 0.5, 0.45, 0.5 + rnd() * 0.4), x, 0, z, rnd() * 3, 1, 1, 1, (rnd() - 0.5) * 0.4), 0.4);
        break;
      case 'camp':
        ring(p, 3, 3.5, r, (x, z, a) => near.add('wood', cyl(0.22, 0.22, 1.6, 8).rotateZ(Math.PI / 2).translate(0, 0.22, 0), x, 0, z, a), 0.5); // logs to sit on
        ring(p, 2, 3, r - 1, (x, z, a) => near.add(side(x), box(0.7, 0.14, 1.8), x, 0, z, a), 0.5); // bedrolls
        ring(p, 1, 4, r + 2, (x, z, a) => { near.add('wood', box(2, 0.08, 0.08), x, 1.3, z, a).add('wood', box(0.08, 1.4, 0.08), x + Math.cos(a), 0, z - Math.sin(a)).add('wood', box(0.08, 1.4, 0.08), x - Math.cos(a), 0, z + Math.sin(a)); for (let k = -2; k <= 2; k++) spear(x + Math.cos(a) * k * 0.4, z - Math.sin(a) * k * 0.4, a); }, 1.2); // a rack of spears
        ring(p, 1, 3, r, (x, z) => { for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; near.add('dark', cyl(0.04, 0.04, 1.6, 4), x + Math.cos(a) * 0.4, 0, z + Math.sin(a) * 0.4, 0, 1, 1, 1, Math.cos(a) * 0.25, Math.sin(a) * 0.25); } near.add('iron', new THREE.SphereGeometry(0.32, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 0.9, 0), x, 0, z); }, 0.8); // a pot on a tripod
        break;
    }
  }

  // --- the field: grass, arrows where a volley fell, helmets and broken spears (instanced) --------------------------------
  const area = 0.5 * Math.sin((Math.PI * 2) / rim.length) * rim.reduce((s, r, i) => s + r * rim[(i + 1) % rim.length], 0);
  const tufts = Math.round(area / 10);
  for (let k = 0; k < tufts * 3 && lists.tuft.length < tufts; k++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (!free(x, z, 0.3, { road: 2.1, place: 0.5, inside: 0.5 })) continue;
    put(lists.tuft, x, 0, z, 0.7 + rnd() * 0.6, 0.6 + rnd() * 0.7);
  }
  for (let k = 0, made = 0; k < 400 && made < Math.round(area / 900); k++) { // a volley's arrows, in a clump
    const cx = RING.x + (rnd() - 0.5) * 2 * rmax, cz = RING.z + (rnd() - 0.5) * 2 * rmax, tilt = 0.25 + rnd() * 0.3, yaw = rnd() * 6.28;
    if (!free(cx, cz, 1, { road: 2.6, place: 0.5, inside: 2 })) continue;
    made++;
    for (let f = 0; f < 10; f++) { const x = cx + (rnd() - 0.5) * 3, z = cz + (rnd() - 0.5) * 3; if (free(x, z, 0.2, { road: 2.2, inside: 0.5 })) put(lists.arrow, x, 0, z, 1, 1, yaw + (rnd() - 0.5) * 0.3, tilt + (rnd() - 0.5) * 0.15); }
  }
  for (let k = 0; k < area / 40 && lists.helm.length < area / 260; k++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (free(x, z, 0.3, { road: 2.2, place: 0.3, inside: 0.5 })) put(lists.helm, x, 0, z, 0.9 + rnd() * 0.2, 1, rnd() * 6, (rnd() - 0.5) * 0.8);
  }
  for (let k = 0; k < area / 40 && lists.spear.length < area / 300; k++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (free(x, z, 0.8, { road: 2.2, place: 0.3, inside: 1 })) put(lists.spear, x, 0.05, z, 1, 1, rnd() * 6, Math.PI / 2 - 0.04, 0);
  }

  // --- past the outline: grass on the bank and the hills, dead trees, the far camps, watch fires, the enemy's keep ------------------
  /** A point `b` m past the outline in direction `a` (radians, atan2(dz, dx)), in the world. */
  const outAt = (a: number, b: number) => { const rr = rimToward(a) + b; return { x: RING.x + Math.cos(a) * rr, z: RING.z + Math.sin(a) * rr }; };
  function rimToward(a: number) {
    const n = rim.length, t = ((((a / (Math.PI * 2)) % 1) + 1) % 1) * n, i = Math.floor(t) % n, f = t - Math.floor(t), s = f * f * (3 - 2 * f);
    return rim[i] + (rim[(i + 1) % n] - rim[i]) * s;
  }
  for (let k = 0; k < 2400 && lists.tuft.length < tufts + Math.round(rmax * 5); k++) {
    const p = outAt(rnd() * 6.28, 3 + Math.pow(rnd(), 1.3) * 70);
    if (geo.steepness(p.x - RING.x, p.z - RING.z) > 0.6 || behindLine(p.x, p.z)) continue;
    put(lists.tuft, p.x, H(p.x, p.z) - 0.05, p.z, 0.8 + rnd() * 0.7, 0.7 + rnd() * 0.8);
  }
  // dead trees on the grassland, a few dark living ones (none in the south near the edge: the camera looks over it)
  const tree = (x: number, z: number, s: number, dead: boolean, into: VDress) => {
    const y = H(x, z) - 0.1;
    into.add('bark', cyl(0.16 * s, 0.26 * s, 4.2 * s, 6), x, y, z, rnd() * 6, 1, 1, 1, (rnd() - 0.5) * 0.12);
    if (dead) for (let b = 0; b < 4; b++) into.add('bark', cyl(0.04 * s, 0.09 * s, 1.8 * s, 5), x, y + (2.2 + b * 0.5) * s, z, rnd() * 6.28, 1, 1, 1, 0.7 + rnd() * 0.4);
    else into.add('leaf', new THREE.ConeGeometry(1.6 * s, 4.4 * s, 7).translate(0, 2.2 * s, 0), x, y + 2.2 * s, z).add('leaf', new THREE.ConeGeometry(1.2 * s, 3 * s, 7).translate(0, 1.5 * s, 0), x, y + 4.4 * s, z);
  };
  for (let k = 0, made = 0; k < 600 && made < 70; k++) {
    const a = rnd() * 6.28, p = outAt(a, 8 + rnd() * 90);
    if (geo.south(p.x - RING.x, p.z - RING.z) > 0.4 && beyond(p.x, p.z) < 40) continue;
    if (behindLine(p.x, p.z) && beyond(p.x, p.z) < 20) continue;
    tree(p.x, p.z, 0.8 + rnd() * 0.6, rnd() < 0.6, beyond(p.x, p.z) > 40 ? far : near);
    made++;
  }
  // The two armies' camps on the hills either side: rows of tents (cream, a cap of the army's colour), their fires; a few banners.
  for (const s of [-1, 1] as const) {
    const colour: Key = s === look.crimson ? 'crimson' : 'azure', base = s === 1 ? 0 : Math.PI;
    for (let c = 0; c < 2; c++) {
      const a = base + (rnd() - 0.5) * 0.9 + (c - 0.5) * 0.5, p = outAt(a, 50 + rnd() * 60), yaw = a + Math.PI / 2;
      for (let row = 0; row < 3; row++) for (let t = 0; t < 5; t++) {
        const x = p.x + Math.cos(yaw) * (t - 2) * 5 + Math.cos(a) * row * 6, z = p.z + Math.sin(yaw) * (t - 2) * 5 + Math.sin(a) * row * 6;
        const ty = H(x, z) - 0.1, s = 1 + rnd() * 0.2, ry = rnd() * 3;
        far.add('canvas', new THREE.ConeGeometry(2.4, 3.4, 6).translate(0, 1.7, 0), x, ty, z, ry, s).add(colour, new THREE.CylinderGeometry(1.9, 2.42, 0.6, 6, 1, true).translate(0, 0.3, 0), x, ty, z, ry, s);
        if ((row + t) % 4 === 0) put(lists.flame, x + 2.5, H(x + 2.5, z + 2) + 0.2, z + 2, 0.9);
      }
      const fy = H(p.x, p.z);
      far.add('wood', cyl(0.12, 0.16, 9, 6), p.x, fy, p.z).add(colour, new THREE.PlaneGeometry(1.8, 2.6).translate(0.9, -1.3, 0), p.x, fy + 8.8, p.z, rnd() * 3);
    }
  }
  // Watch fires on the hilltops: a fire basket on a tall pole, seen from across the field.
  for (let k = 0, made = 0; k < 200 && made < 6; k++) {
    const a = rnd() * 6.28, p = outAt(a, 70 + rnd() * 80);
    if (geo.south(p.x - RING.x, p.z - RING.z) > 0.5) continue;
    const y = H(p.x, p.z);
    if (y < 8) continue;
    far.add('dark', cyl(0.18, 0.22, 5, 6), p.x, y, p.z).add('iron', cyl(0.6, 0.3, 0.6, 8), p.x, y + 5, p.z);
    put(lists.flame, p.x, y + 5.5, p.z, 1.6);
    made++;
  }
  // The enemy's keep on the ridge behind the siege line: curtain walls, square towers, a great tower, dark windows, the two banners.
  {
    const cx = RING.x + (rnd() - 0.5) * 30, cz = look.line.z - 60 - rnd() * 25, y = H(cx, cz) - 1.5, w = 34, d = 22;
    const at = (lx: number, lz: number) => ({ x: cx + lx, z: cz + lz });
    for (const [lx, lz, ww, dd] of [[0, d / 2, w, 2.2], [0, -d / 2, w, 2.2], [w / 2, 0, 2.2, d], [-w / 2, 0, 2.2, d]] as const) far.add('stone', box(ww, 9, dd), cx + lx, y, cz + lz);
    for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
      const p = at(lx, lz);
      far.add('stone', box(5.5, 14, 5.5), p.x, y, p.z).add('dark', new THREE.ConeGeometry(4.6, 4.5, 4).rotateY(Math.PI / 4).translate(0, 2.25, 0), p.x, y + 14, p.z);
      far.add('iron', box(1, 1.6, 0.2), p.x, y + 9, p.z + 2.8);
    }
    far.add('stone', cyl(6, 6.6, 22, 12), cx, y, cz).add('dark', new THREE.ConeGeometry(7, 7, 12).translate(0, 3.5, 0), cx, y + 22, cz);
    for (const s of [-1, 1]) {
      const p = at(s * 3, d / 2 + 0.4);
      far.add('wood', cyl(0.12, 0.12, 5, 5), p.x, y + 22, cz).add(s === look.crimson ? 'crimson' : 'azure', new THREE.PlaneGeometry(2.4, 3.6).translate(1.2, -1.8, 0), p.x, y + 26.8, cz, 0);
      far.add('iron', box(1.6, 2.6, 0.2), p.x, y + 1, p.z);
    }
    // lit windows (emissive, no glow sprite: a sprite is a draw call of its own; the bloom lights them)
    for (const [lx, lz, yy] of [[0, 6.7, 12], [0, 6.7, 17], [-w / 2, d / 2 + 2.8, 6], [w / 2, d / 2 + 2.8, 6]]) put(lists.flame, cx + lx, y + yy - 0.5, cz + lz, 1.2, 1.2, 0);
    // its gate faces the field: a dark arch under a lit window
    far.add('iron', box(4, 5.5, 0.4), cx, y, cz + d / 2 + 1.2);
  }

  // --- columns of smoke: soft grey puffs stacked and drifting up (from the far camps and burned farms beyond the hills) ---------------
  const smokeMat = new THREE.MeshLambertMaterial({ color: 0x5a5658, transparent: true, opacity: 0.32, depthWrite: false });
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  o.own.push(smokeMat, puffGeo);
  const columns: { x: number; y: number; z: number; h: number; r: number }[] = [];
  for (let k = 0; k < 120 && columns.length < 6; k++) {
    const p = outAt(rnd() * 6.28, 40 + rnd() * 110);
    if (geo.south(p.x - RING.x, p.z - RING.z) > 0.45) continue;
    if (columns.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 50)) continue;
    columns.push({ x: p.x, y: H(p.x, p.z), z: p.z, h: 28 + rnd() * 22, r: 2.2 + rnd() * 1.6 });
  }
  const PUFFS = 18;
  const smoke = new THREE.InstancedMesh(puffGeo, smokeMat, columns.length * PUFFS);
  smoke.castShadow = smoke.receiveShadow = false;
  smoke.frustumCulled = false;
  smoke.renderOrder = 3;
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), q4 = new THREE.Quaternion();
  const drift = (time: number) => {
    columns.forEach((c, ci) => {
      for (let i = 0; i < PUFFS; i++) {
        // each puff rises, swells and leans with the wind (from the west), a little off the column's line by its own number
        const t = ((i / PUFFS + time * 0.012 + ci * 0.13) % 1), up = t * c.h, s = c.r * (0.7 + 3.2 * t), j = ((i * 7919 + ci * 104729) % 97) / 97 - 0.5;
        v3.set(c.x + j * c.r * 1.2 + t * t * 16, c.y + up, c.z + j * c.r * 0.8 - t * t * 5);
        m4.compose(v3, q4, s3.set(s, s * 0.8, s));
        smoke.setMatrixAt(ci * PUFFS + i, m4);
      }
    });
    smoke.instanceMatrix.needsUpdate = true;
  };
  drift(0);
  if (columns.length) o.into.add(smoke);
  else smoke.dispose();

  // --- crows: two flocks of dark V's wheeling over the field ------------------------------------------------------------------------
  const crowGeo = mergeGeometries([new THREE.BoxGeometry(0.7, 0.04, 0.16).translate(0.33, 0, 0).rotateZ(0.3), new THREE.BoxGeometry(0.7, 0.04, 0.16).translate(-0.33, 0, 0).rotateZ(-0.3)])!;
  const crowMat = new THREE.MeshBasicMaterial({ color: 0x18161a });
  o.own.push(crowGeo, crowMat);
  const CROWS = 16, crows = new THREE.InstancedMesh(crowGeo, crowMat, CROWS);
  crows.frustumCulled = false;
  const flocks = [0, 1].map(() => ({ x: RING.x + (rnd() - 0.5) * rmax, z: RING.z - rnd() * rmax * 0.6 }));
  const flyers = Array.from({ length: CROWS }, (_, i) => ({ f: i % 2, r: 6 + rnd() * 12, h: 14 + rnd() * 9, sp: 0.3 + rnd() * 0.25, ph: rnd() * 6.28 }));
  const tilt = new THREE.Matrix4();
  const fly = (time: number) => {
    flyers.forEach((b, i) => {
      const f = flocks[b.f], a = b.ph + time * b.sp, x = f.x + Math.cos(a) * b.r + Math.sin(time * 0.05 + b.f * 3) * 20, z = f.z + Math.sin(a) * b.r;
      const flap = Math.sin(time * 9 + i) * 0.35;
      m4.makeRotationY(-a).multiply(tilt.makeRotationZ(flap * 0.3)).setPosition(x, b.h + Math.sin(time * 1.3 + i) * 0.6, z);
      crows.setMatrixAt(i, m4);
    });
    crows.instanceMatrix.needsUpdate = true;
  };
  fly(0);
  o.into.add(crows);

  // --- the instanced meshes ------------------------------------------------------------------------------------------------------------
  const tint = (g: THREE.BufferGeometry, hex: string) => {
    const nn = g.index ? g.toNonIndexed() : g, col = new THREE.Color(hex), c = new Float32Array(nn.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
    for (const k of Object.keys(nn.attributes)) if (k !== 'position' && k !== 'normal') nn.deleteAttribute(k);
    nn.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return nn;
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8a30, emissiveIntensity: 1.4, roughness: 0.5 });
  o.own.push(mat, flameMat);
  const inst = (geom: THREE.BufferGeometry, list: THREE.Matrix4[], m: THREE.Material = mat, shadow = false) => {
    if (!list.length) { geom.dispose(); return; }
    const im = new THREE.InstancedMesh(geom, m, list.length);
    list.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    o.into.add(im);
    o.own.push(geom);
  };
  const blade = (a: number, h: number) => new THREE.ConeGeometry(0.07, h, 3, 1, true).translate(0, h / 2, 0).rotateZ(0.28).rotateY(a); // no base: 3 triangles
  inst(mergeGeometries([tint(blade(0, 0.55), '#6a6a40'), tint(blade(2.1, 0.45), '#5a6038'), tint(blade(4.2, 0.62), '#7a7048')])!, lists.tuft);
  // an arrow: a shaft and its fletching, standing in the ground at a slant (the instance's tilt)
  inst(mergeGeometries([tint(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 3).translate(0, 0.32, 0), '#5a4430'), tint(new THREE.BoxGeometry(0.06, 0.14, 0.004).translate(0, 0.64, 0), '#e2dccc')])!, lists.arrow);
  inst(mergeGeometries([tint(new THREE.SphereGeometry(0.18, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.02, 0), '#7e828c'), tint(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 7, 1, true).translate(0, 0.03, 0), '#c9a24a')])!, lists.helm);
  inst(mergeGeometries([tint(new THREE.CylinderGeometry(0.03, 0.035, 1.6, 4).translate(0, 0.8, 0), '#4a3220'), tint(new THREE.ConeGeometry(0.05, 0.26, 4).translate(0, 1.72, 0), '#8a8e98')])!, lists.spear);
  inst(new THREE.ConeGeometry(0.4, 1.1, 6).translate(0, 0.55, 0), lists.flame, flameMat);

  near.build(o.into, o.own, true);
  far.build(o.into, o.own, false);

  return {
    update(_dt: number, time: number) { drift(time); fly(time); },
  };
}
