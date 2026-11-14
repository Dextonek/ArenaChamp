import * as THREE from 'three';
import { RING, seeded } from '../../../arenas/common';
import { WATER, rimAt, type Geo, type Key, type LandSpec } from '../land';

/**
 * Scenes on a sea floor (floors 1 to 10; the user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on
 * the maps, make actual scenarios and stuff"). A scene is a small group of props, 3 to 12 m across, that tells at a glance that something
 * happened there: a fish stall knocked over, a beach fire just left with its kettle, a net half mended, a chest washed up with its lid
 * open, a rowing boat hauled up on the sand, a hull capsized on the far rocks.
 *
 * **Looks only, never cover.** On the walkable ground a scene is low (nothing above knee height, 0.55 m: a hero can walk over it and
 * nothing hides behind it); the tall ones (a boat, a net on its frame, a stack of pots, a mooring post) stand on the beach past the
 * walkable outline, or out at sea. Every part keeps off the floor's spots (keep.ts: 3 m), the roads' middles, the cover, the places'
 * stands, the tidal flats, the depth's own props (depth.ts) and the land's houses and jetties (land.ts).
 *
 * Each kind is a list of parts in its own frame, built from geometry made once a floor, placed many times turned, mirrored and with
 * small variations (which baskets, how many fish, how many arrows), by the floor's own random stream (`seeded(SEED + spec.seed)`): the
 * zone's and the depth's streams are untouched, so nothing that was there moves. The parts go into the land's merged dressing (one
 * mesh a 24 m square whatever the colours; gold into the zone's kit): no new draw calls.
 *
 * `?scenes=off` in the address leaves them out (for before-and-after pictures and A/B timing).
 */

/** The land's merged dressing (land.ts `Dress`). */
export interface Sink {
  add(key: Key, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw?: number, sx?: number, sy?: number, sz?: number, tilt?: number): unknown;
}
type Seg = { ax: number; az: number; bx: number; bz: number; r: number };
type Pt = { x: number; z: number };
export interface SeaScenesIn {
  spec: LandSpec;
  geo: Geo;
  dress: Sink;
  /** The zone's cover (world), its looks' invisible edge walls left out. */
  cover: Seg[];
  /** Where the depth put its props (world), each with a radius. */
  marks: { x: number; z: number; r: number }[];
  /** What else stands there (world): the land's houses, jetties, boats and trees (`tree`), the harbour file's props. */
  taken: { x: number; z: number; r: number; tree?: boolean }[];
}
/** One placed scene, for the overlap probe (`pipeline/tools/scenes-probe.js`): its parts' corners on the ground and their tops. */
export interface Placed {
  kind: string;
  x: number;
  z: number;
  r: number;
  /** Past the walkable outline (the beach, the sea): tall parts allowed. */
  beyond: boolean;
  top: number;
  pts: [number, number][];
}

const SEED = 6161;
const KNEE = 0.55;
/** The ground scenes are drawn this much larger than life-sized props (they are seen from the game's high camera); never above the knee. */
const GROUND_SCALE = 1.3;

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

// --- a part and a scene's parts ---------------------------------------------------------------------------------------------------
type Part = { key: Key; g: THREE.BufferGeometry; x: number; y: number; z: number; yaw: number; s: [number, number, number]; tilt: number };
class Parts {
  list: Part[] = [];
  p(key: Key, g: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, tilt = 0, sx = 1, sy = sx, sz = sx) {
    this.list.push({ key, g, x, y, z, yaw, s: [sx, sy, sz], tilt });
    return this;
  }
}

/** The shapes, made once a floor (keyed by name) and disposed when the scenes are in the dressing (which copies them). */
function shapes() {
  const cache = new Map<string, THREE.BufferGeometry>();
  const of = (name: string, make: () => THREE.BufferGeometry) => {
    let g = cache.get(name);
    if (!g) {
      g = make();
      if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
      cache.set(name, g);
      g.computeBoundingBox();
    }
    return g;
  };
  const S = {
    box: (w: number, h: number, d: number) => of(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0)),
    cyl: (r0: number, r1: number, h: number, n = 10) => of(`cyl${r0},${r1},${h},${n}`, () => new THREE.CylinderGeometry(r0, r1, h, Math.min(n, 8)).translate(0, h / 2, 0)),
    /** A round thing lying along x on the ground (a log, a pole, a barrel). */
    log: (r: number, len: number, n = 9) => of(`log${r},${len},${n}`, () => new THREE.CylinderGeometry(r, r, len, Math.min(n, r < 0.06 ? 5 : 8)).rotateZ(Math.PI / 2).translate(0, r, 0)),
    ball: (r: number, sy = 1) => of(`ball${r},${sy}`, () => new THREE.SphereGeometry(r, r < 0.1 ? 6 : 8, r < 0.1 ? 4 : 5).scale(1, sy, 1).translate(0, r * sy, 0)),
    stone: (r: number) => of(`stone${r}`, () => new THREE.IcosahedronGeometry(r, 0).scale(1, 0.62, 1).translate(0, r * 0.45, 0)),
    ring: (r: number, t: number, arc = Math.PI * 2) => of(`ring${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 4, r < 0.2 ? 10 : 14, arc).rotateX(Math.PI / 2).translate(0, t, 0)),
    /** An upright hoop (a trap's or a pot's rib), across x. */
    hoop: (r: number, t: number) => of(`hoop${r},${t}`, () => new THREE.TorusGeometry(r, t, 4, 8, Math.PI)),
    disc: (r: number, h = 0.012) => of(`disc${r},${h}`, () => new THREE.CylinderGeometry(r, r, h, r < 0.1 ? 6 : 12).translate(0, h / 2, 0)),
    /** A fish: a slim body and a tail, along x. */
    fish: () => of('fish', () => {
      const body = new THREE.SphereGeometry(1, 8, 5).scale(0.17, 0.045, 0.06).translate(0, 0.045, 0);
      const tail = new THREE.ConeGeometry(0.06, 0.1, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.3).translate(-0.2, 0.045, 0);
      const m = mergeTwo(body, tail);
      return m;
    }),
    /** A rowing boat's hull, upright, its keel at y = 0, along z (4 m). */
    hull: (len: number, w: number, h: number) => of(`hull${len},${w},${h}`, () => new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(w / 2, h, len / 2).translate(0, h, 0)),
    /** A hull upturned (capsized): the dome up. */
    upturned: (len: number, w: number, h: number) => of(`up${len},${w},${h}`, () => new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(w / 2, h, len / 2)),
    gunwale: (len: number, w: number) => of(`gw${len},${w}`, () => new THREE.TorusGeometry(1, 0.035, 5, 28).scale(w / 2, len / 2, 1).rotateX(Math.PI / 2)),
    /** A net hanging or spread: a sheet with a grid of cords on it, in x (w) and y (h), 2 cm thick. */
    net: (w: number, h: number, flat: boolean) => of(`net${w},${h},${flat}`, () => {
      const gs: THREE.BufferGeometry[] = [];
      for (let i = 0; i <= 7; i++) gs.push(new THREE.BoxGeometry(0.035, h, 0.03).translate(-w / 2 + (w * i) / 7, h / 2, 0.012));
      for (let j = 0; j <= 5; j++) gs.push(new THREE.BoxGeometry(w, 0.035, 0.03).translate(0, (h * j) / 5, 0.012));
      let g = mergeAll(gs);
      if (flat) g = g.rotateX(-Math.PI / 2).translate(0, 0.02, h / 2);
      return g;
    }),
    sheet: (w: number, h: number, flat: boolean) => of(`sheet${w},${h},${flat}`, () => {
      const g = new THREE.BoxGeometry(w, h, 0.012).translate(0, h / 2, 0);
      return flat ? g.rotateX(-Math.PI / 2).translate(0, 0.008, h / 2) : g;
    }),
    /** A sail: a triangle lying on the ground (x along the boom, z out). */
    sail: (a: number, b: number) => of(`sail${a},${b}`, () => {
      const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(a, 0), new THREE.Vector2(a * 0.15, b)]);
      return new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2).translate(0, 0.03, 0);
    }),
  };
  /** Any other shape, made once a floor under its own name. */
  const k = (name: string, make: () => THREE.BufferGeometry) => of(name, make);
  const dispose = () => { for (const g of cache.values()) g.dispose(); cache.clear(); };
  return { S: { ...S, k }, dispose };
}
const strip = (g: THREE.BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
};
function mergeAll(gs: THREE.BufferGeometry[]) {
  const parts = gs.map(strip);
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
const mergeTwo = (a: THREE.BufferGeometry, b: THREE.BufferGeometry) => mergeAll([a, b]);

/** A scene's parts of one colour, transformed and written into one geometry (one hand-off to the merged props, not one a part). */
function bake(items: { g: THREE.BufferGeometry; m: THREE.Matrix4 }[]) {
  let n = 0;
  for (const it of items) n += it.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  let o = 0;
  for (const it of items) {
    const P = it.g.attributes.position.array as Float32Array, N = it.g.attributes.normal.array as Float32Array, e = it.m.elements;
    nm.getNormalMatrix(it.m);
    const f = nm.elements;
    for (let i = 0; i < P.length; i += 3, o += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      pos[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; pos[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pos[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      v.set(f[0] * N[i] + f[3] * N[i + 1] + f[6] * N[i + 2], f[1] * N[i] + f[4] * N[i + 1] + f[7] * N[i + 2], f[2] * N[i] + f[5] * N[i + 1] + f[8] * N[i + 2]).normalize();
      nor[o] = v.x; nor[o + 1] = v.y; nor[o + 2] = v.z;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

type Shapes = ReturnType<typeof shapes>['S'];
type Make = (S: Shapes, P: Parts, r: () => number) => void;
interface Kind {
  name: string;
  /** Its reach round its middle (m), for spacing. */
  R: number;
  /** Stands past the outline (the beach) or out at sea; else on the walkable ground, low. */
  where: 'ground' | 'beach' | 'sea';
  /** A beach scene that may stand in the shallows (a boat drawn up, a mooring at the water's edge); else on dry, gentle ground. */
  wet?: boolean;
  make: Make;
}

// --- the scenes -----------------------------------------------------------------------------------------------------------------
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
/** A kind's reach as drawn (the ground scenes are drawn larger). */
const reach = (k: Kind) => k.R * (k.where === 'ground' ? GROUND_SCALE : 1);

/** A wicker basket (upright), with a gilt rim. */
const basket = (S: Shapes, P: Parts, x: number, z: number, h = 0.3) => {
  P.p('plank', S.cyl(0.27, 0.21, h), x, 0, z).p('lacquer', S.disc(0.24), x, h - 0.04, z).p('gold', S.ring(0.27, 0.018), x, h - 0.02, z);
};
/** A basket on its side, its mouth towards +x, and what spilled from it. */
const basketDown = (S: Shapes, P: Parts, x: number, z: number, yaw: number) => {
  P.p('plank', S.log(0.2, 0.42, 10), x, 0, z, yaw).p('lacquer', S.k('S.disc(0.17, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.2, 0)', () => S.disc(0.17, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.2, 0)), x + Math.cos(yaw) * 0.21, 0, z - Math.sin(yaw) * 0.21, yaw);
};
const fishFan = (S: Shapes, P: Parts, r: () => number, x: number, z: number, a: number, n: number) => {
  for (let k = 0; k < n; k++) {
    const t = a + (r() - 0.5) * 1.3, d = 0.3 + r() * 1.2;
    P.p(r() < 0.6 ? 'slate' : 'cloth', S.fish(), x + Math.cos(t) * d, 0, z - Math.sin(t) * d, r() * 6.28);
  }
};
/** A wooden crate (0.45 m), lid off and lying beside it. */
const crate = (S: Shapes, P: Parts, x: number, z: number, yaw: number, open: boolean) => {
  P.p('wood', S.box(0.62, 0.36, 0.48), x, 0, z, yaw).p('gold', S.box(0.64, 0.035, 0.5), x, 0.26, z, yaw);
  if (open) P.p('plank', S.box(0.66, 0.04, 0.52), x + Math.sin(yaw + 0.9) * 0.7, 0, z + Math.cos(yaw + 0.9) * 0.7, yaw + 0.5);
  else P.p('plank', S.box(0.64, 0.04, 0.5), x, 0.36, z, yaw);
};
const coil = (S: Shapes, P: Parts, x: number, z: number) => P.p('rope', S.ring(0.26, 0.045), x, 0, z).p('rope', S.ring(0.18, 0.045), x, 0.07, z);
const shells = (S: Shapes, P: Parts, r: () => number, x: number, z: number, n: number, spread = 0.8) => {
  for (let k = 0; k < n; k++) P.p(r() < 0.5 ? 'cream' : 'salt', S.ball(0.05, 0.5), x + (r() - 0.5) * spread * 2, 0, z + (r() - 0.5) * spread * 2);
};
/** A barrel lying along x (0.52 m high), gilt hoops. */
const barrelDown = (S: Shapes, P: Parts, x: number, z: number, yaw: number) => {
  P.p('wood', S.log(0.2, 0.62, 12), x, 0, z, yaw);
  for (const s of [-0.2, 0.2]) P.p('gold', S.k('S.ring(0.21, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.2, 0)', () => S.ring(0.21, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.2, 0)), x + Math.cos(yaw) * s, 0, z - Math.sin(yaw) * s, yaw);
};
/** A lobster pot: a slatted half-round on a board (0.38 m), along x. Lying on its side when `down`. */
const pot = (S: Shapes, P: Parts, x: number, y: number, z: number, yaw: number, down = false) => {
  const tilt = down ? 0 : 0;
  P.p('plank', S.box(0.72, 0.04, 0.5), x, y, z, yaw, tilt);
  for (const s of [-0.3, -0.1, 0.1, 0.3]) {
    const g = S.hoop(0.23, 0.018);
    P.p('wood', g, x + Math.cos(yaw) * s, y + 0.04, z - Math.sin(yaw) * s, yaw + Math.PI / 2);
  }
  P.p('rope', S.k('S.box(0.7, 0.22, 0.42).clone().translate(0, -0.11, 0).scale(1, 1, 1)', () => S.box(0.7, 0.22, 0.42).clone().translate(0, -0.11, 0).scale(1, 1, 1)), x, y + 0.04 + 0.11, z, yaw, 0, 1, 0.01 + 1, 1);
};

const KINDS: Kind[] = [
  {
    // A fish stall knocked over: its board flat on the ground, its legs and awning down, baskets tipped, fish spilled in a fan.
    name: 'stall', R: 2.6, where: 'ground',
    make: (S, P, r) => {
      P.p('plank', S.box(2.2, 0.06, 0.9), 0, 0, 0, 0.15).p('gold', S.box(2.24, 0.03, 0.05), 0.07, 0.06, 0.44, 0.15);
      P.p('wood', S.box(0.08, 0.08, 0.95), -0.85, 0, -0.95, 0.3).p('wood', S.box(0.08, 0.08, 0.95), 0.75, 0, -1.05, -0.2);
      P.p('wine', S.box(2.3, 0.03, 1.4), 0.7, 0, 1.35, 0.35).p('gold', S.box(2.3, 0.035, 0.05), 0.95, 0, 0.72, 0.35).p('wine', S.box(0.8, 0.07, 0.35), -0.4, 0, 1.4, 0.2).p('wood', S.log(0.04, 2.3, 6), 0.4, 0, 1.95, 0.4);
      basket(S, P, -1.55, 0.35);
      basketDown(S, P, 1.4, -0.1, -0.2);
      fishFan(S, P, r, 1.65, -0.15, -0.2, 9 + Math.floor(r() * 6));
      if (r() < 0.6) basketDown(S, P, -0.6, -1.5, 2.6);
      if (r() < 0.6) crate(S, P, -1.6, -0.9, 0.4, true);
      fishFan(S, P, r, 0.2, -0.2, 3.6, 4);
    },
  },
  {
    // A fire on the shore just left: a ring of stones, charred sticks, a kettle on the stones, driftwood logs to sit on, a blanket, a rod.
    name: 'fire', R: 2.5, where: 'ground',
    make: (S, P, r) => {
      for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.28; P.p('stone', S.stone(0.16), Math.cos(a) * 0.58, 0, Math.sin(a) * 0.58, r() * 6); }
      P.p('lacquer', S.disc(0.48, 0.02), 0, 0, 0);
      for (let k = 0; k < 3; k++) P.p('lacquer', S.log(0.055, 0.8, 6), 0, 0.02, 0, k * 1.05 + r() * 0.3);
      // the kettle, on the stones
      P.p('lacquer', S.cyl(0.17, 0.2, 0.2, 12), 0.62, 0.1, 0.18).p('gold', S.disc(0.15, 0.03), 0.62, 0.3, 0.18).p('gold', S.k('S.hoop(0.15, 0.012).clone().translate(0, 0.32, 0)', () => S.hoop(0.15, 0.012).clone().translate(0, 0.32, 0)), 0.62, 0, 0.18, 0.4);
      P.p('lacquer', S.cyl(0.025, 0.035, 0.16, 6), 0.83, 0.17, 0.18, 0, -1.0);
      const seats = 2 + Math.floor(r() * 2);
      for (let k = 0; k < seats; k++) { const a = 1.9 + k * 1.5 + (r() - 0.5) * 0.4; P.p('plank', S.log(0.17, 1.5, 9), Math.cos(a) * 1.7, 0, -Math.sin(a) * 1.7, a + Math.PI / 2); }
      if (r() < 0.7) P.p('wine', S.log(0.13, 0.8, 9), -1.1, 0, -0.9, 0.7).p('cream', S.log(0.135, 0.06, 9), -1.1 + Math.cos(0.7) * 0.4, 0, -0.9 - Math.sin(0.7) * 0.4, 0.7);
      if (r() < 0.6) P.p('wood', S.log(0.02, 2.6, 5), 1.3, 0, -1.3, -0.5).p('gold', S.k('S.cyl(0.05, 0.05, 0.06, 8).clone().rotateZ(Math.PI / 2)', () => S.cyl(0.05, 0.05, 0.06, 8).clone().rotateZ(Math.PI / 2)), 0.4, 0.05, -0.85, -0.5);
      P.p('cream', S.cyl(0.05, 0.04, 0.1, 8), -0.75, 0, 0.55);
      // a bedroll half unrolled, a pack against it, the cooking pot knocked over
      P.p('wine', S.box(0.75, 0.05, 1.7), 1.6, 0, 1.1, 0.4).p('wine', S.log(0.15, 0.75, 10), 1.25, 0, 1.85, 0.4).p('gold', S.box(0.77, 0.055, 0.05), 1.6, 0.0, 0.3, 0.4);
      P.p('lacquer', S.box(0.45, 0.3, 0.3), 2.2, 0, 0.05, 1.0).p('gold', S.box(0.08, 0.31, 0.32), 2.2, 0, 0.05, 1.0);
      if (r() < 0.6) P.p('lacquer', S.log(0.14, 0.22, 10), -0.95, 0, -0.1, 2.0).p('gold', S.k('S.ring(0.14, 0.015).clone().rotateZ(Math.PI / 2).translate(0, 0.14, 0)', () => S.ring(0.14, 0.015).clone().rotateZ(Math.PI / 2).translate(0, 0.14, 0)), -0.84, 0, -0.06, 2.0);
    },
  },
  {
    // A net being mended on the ground: spread out, the rest heaped, its floats in a basket, a stool, a coil of line, the shuttle dropped.
    name: 'nets', R: 2.4, where: 'ground',
    make: (S, P, r) => {
      P.p('plank', S.sheet(3.0, 1.9, true), 0, 0, -1.0, 0.1).p('rope', S.net(3.0, 1.9, true), 0, 0.005, -1.0, 0.1);
      P.p('rope', S.ball(0.6, 0.35), -1.45, 0, 0.55, 0.3, 0, 1, 1, 0.7).p('rope', S.ball(0.4, 0.4), -1.0, 0, 0.95, 1.2);
      for (let k = 0; k < 7; k++) P.p('wine', S.ball(0.07), -1.1 + k * 0.37, 0, -0.95 + k * 0.035);
      basket(S, P, 1.55, 0.7, 0.28);
      for (let k = 0; k < 4; k++) P.p('wine', S.ball(0.08), 1.5 + (r() - 0.5) * 0.25, 0.26, 0.7 + (r() - 0.5) * 0.25);
      P.p('plank', S.cyl(0.2, 0.2, 0.05, 12), 0.6, 0.33, 1.0);
      for (let k = 0; k < 3; k++) { const a = k * 2.09; P.p('wood', S.cyl(0.025, 0.03, 0.33, 5), 0.6 + Math.cos(a) * 0.14, 0, 1.0 + Math.sin(a) * 0.14); }
      coil(S, P, -0.2, 1.3);
      P.p('gold', S.box(0.22, 0.02, 0.05), 0.4, 0.02, 0.05, 0.6);
      if (r() < 0.5) shells(S, P, r, 1.7, -0.4, 4, 0.5);
    },
  },
  {
    // The lighthouse keeper's oil barrels, rolled off and spilled: barrels on their sides, one open in a dark pool, the bung and his lantern.
    name: 'barrels', R: 2.2, where: 'ground',
    make: (S, P, r) => {
      barrelDown(S, P, -0.7, -0.4, 0.3);
      barrelDown(S, P, 0.5, -0.9, -0.5);
      barrelDown(S, P, 0.9, 0.5, 1.2 + r() * 0.4);
      P.p('lacquer', S.disc(0.55, 0.012), 1.1, 0, 1.0, 0.4, 0, 1.2, 1, 0.7);
      P.p('wood', S.disc(0.08, 0.04), 1.7, 0, 0.2);
      // his lantern, dropped and out
      P.p('lacquer', S.k('S.box(0.22, 0.3, 0.22).clone().rotateZ(Math.PI / 2).translate(0.15, -0.04, 0)', () => S.box(0.22, 0.3, 0.22).clone().rotateZ(Math.PI / 2).translate(0.15, -0.04, 0)), -1.3, 0.11, 0.6, 0.8).p('gold', S.k('S.cyl(0.13, 0.13, 0.05, 8).clone().rotateZ(Math.PI / 2)', () => S.cyl(0.13, 0.13, 0.05, 8).clone().rotateZ(Math.PI / 2)), -1.6, 0.11, 0.85, 0.8);
      if (r() < 0.6) P.p('plank', S.box(0.3, 0.05, 2.2), -0.2, 0, 1.3, 1.3);
      if (r() < 0.5) coil(S, P, -1.5, -1.2);
    },
  },
  {
    // Pots left to the gulls: two lobster pots on their sides, one broken open, crab shells picked clean, feathers, a float on its line.
    name: 'pots', R: 1.9, where: 'ground',
    make: (S, P, r) => {
      pot(S, P, -0.5, 0, -0.2, 0.4);
      pot(S, P, 0.65, 0, 0.35, -0.9);
      if (r() < 0.7) pot(S, P, -0.2, 0, 1.15, 1.9);
      for (let k = 0; k < 3; k++) P.p('wood', S.log(0.02, 0.5, 5), 0.2 + k * 0.18, 0, -0.75 + k * 0.1, 1.2 + k * 0.4);
      for (let k = 0; k < 3 + Math.floor(r() * 3); k++) P.p('wine', S.ball(0.08, 0.45), (r() - 0.5) * 2.2, 0, (r() - 0.5) * 2.2);
      for (let k = 0; k < 5; k++) P.p('cream', S.box(0.16, 0.012, 0.035), (r() - 0.5) * 2.4, 0, (r() - 0.5) * 2.4, r() * 6);
      P.p('rope', S.log(0.015, 1.6, 4), -0.9, 0, 0.8, 0.5).p('wine', S.ball(0.14), -1.55, 0, 1.25).p('gold', S.ring(0.142, 0.015), -1.55, 0.13, 1.25);
    },
  },
  {
    // The washing blown down: two props fallen, the line on the ground, the clothes strewn along it, the basket tipped.
    name: 'washing', R: 2.8, where: 'ground',
    make: (S, P, r) => {
      P.p('wood', S.log(0.045, 2.0, 6), -2.0, 0, 0.2, 1.3).p('wood', S.log(0.045, 2.0, 6), 2.1, 0, -0.1, 1.9);
      P.p('rope', S.log(0.012, 4.2, 4), 0, 0, 0, 0.05);
      const cols: Key[] = ['wine', 'slate', 'teal', 'rope', 'plank'];
      for (let k = 0; k < 5; k++) P.p(cols[(k + Math.floor(r() * 5)) % 5], S.box(0.8, 0.02, 0.95), -1.6 + k * 0.8, 0, 0.35 + (r() - 0.5) * 0.9, (r() - 0.5) * 1.4);
      basketDown(S, P, 1.3, 1.2, -2.4);
      P.p('teal', S.box(0.5, 0.02, 0.4), 0.9, 0, 1.5, 0.6);
      for (let k = 0; k < 4; k++) P.p('wood', S.box(0.03, 0.02, 0.08), (r() - 0.5) * 3, 0, (r() - 0.5) * 1.5, r() * 6);
    },
  },
  {
    // An anchor dragged ashore: lying in the sand, its line run out to the stump of a mooring post, the rope's end frayed.
    name: 'anchor', R: 2.4, where: 'ground',
    make: (S, P, r) => {
      P.p('lacquer', S.log(0.06, 1.5, 8), 0, 0, 0, 0);
      P.p('lacquer', S.log(0.05, 1.0, 8), 0.68, 0, 0, Math.PI / 2);
      P.p('lacquer', S.k('S.ring(0.48, 0.06, Math.PI).clone().rotateY(-Math.PI / 2)', () => S.ring(0.48, 0.06, Math.PI).clone().rotateY(-Math.PI / 2)), -0.72, 0, 0);
      for (const s of [-1, 1]) P.p('lacquer', S.k('S.box(0.24, 0.05, 0.2).clone().rotateY(Math.PI / 4)', () => S.box(0.24, 0.05, 0.2).clone().rotateY(Math.PI / 4)), -0.72, 0, s * 0.48);
      P.p('gold', S.ring(0.12, 0.025), 0.86, 0.03, 0);
      // the line out to the stump, in an easy curve
      let x = 0.98, z = 0;
      for (let k = 0; k < 6; k++) { const a = 0.35 * Math.sin(k * 0.9) + 0.2; const nx = x + Math.cos(a) * 0.32, nz = z - Math.sin(a) * 0.32; P.p('rope', S.log(0.035, 0.34, 5), (x + nx) / 2, 0, (z + nz) / 2, a); x = nx; z = nz; }
      P.p('wood', S.cyl(0.17, 0.2, 0.34, 12), x + 0.35, 0, z - 0.1).p('gold', S.ring(0.18, 0.02), x + 0.35, 0.28, z - 0.1);
      for (let k = 0; k < 4; k++) P.p('rope', S.log(0.012, 0.22, 4), -0.8 - Math.cos(k) * 0.1, 0, 0.6 + k * 0.05, 2.4 + k * 0.35);
      P.p('rope', S.log(0.035, 0.6, 5), -0.55, 0, 0.35, 2.2);
      shells(S, P, r, 0.2, -0.5, 3, 0.6);
    },
  },
  {
    // Flotsam from a wreck washed up: a hatch cover, a broken cask and its staves, a spar with its rope, a lantern, a scrap of sail, weed.
    name: 'flotsam', R: 2.2, where: 'ground',
    make: (S, P, r) => {
      // the hatch cover: a gilt-edged frame with its grating
      P.p('plank', S.box(1.1, 0.06, 1.1), 0, 0, 0, 0.3).p('gold', S.box(1.14, 0.03, 0.05), 0, 0.06, 0, 0.3);
      for (let k = -2; k <= 2; k++) P.p('wood', S.box(0.05, 0.05, 1.05), Math.cos(0.3) * k * 0.2, 0.06, -Math.sin(0.3) * k * 0.2, 0.3);
      // the cask, broken: its end and staves spread
      P.p('wood', S.log(0.2, 0.3, 12), 1.2, 0, 0.7, 1.1).p('gold', S.k('caskhoop', () => S.ring(0.21, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.2, 0)), 1.2, 0, 0.7, 1.1);
      for (let k = 0; k < 5; k++) P.p('plank', S.box(0.1, 0.03, 0.62), 1.6 + k * 0.14, 0, 0.0 + (r() - 0.5) * 0.4, 0.4 + (r() - 0.5) * 0.9);
      // the spar and its rope
      P.p('wood', S.log(0.07, 3.0, 8), -0.4, 0, -1.2, -0.2).p('rope', S.log(0.03, 1.2, 5), -1.6, 0, -0.7, 0.9);
      coil(S, P, -1.3, 0.4);
      if (r() < 0.7) P.p('rope', S.box(1.3, 0.02, 0.9), 0.4, 0, 1.4, 0.5);
      P.p('lacquer', S.k('lanternside', () => S.box(0.2, 0.28, 0.2).clone().rotateZ(Math.PI / 2).translate(0, -0.04, 0)), -0.9, 0.1, 1.1, 2.0);
      for (let k = 0; k < 3; k++) P.p('leaf', S.box(0.07, 0.02, 0.8), (r() - 0.5) * 2.4, 0, (r() - 0.5) * 2, r() * 6);
      shells(S, P, r, 0.2, 0.3, 4, 1.0);
    },
  },
  {
    // Where they remember the drowned: a cairn of flat stones, an oar laid in front, a wreath, three candles on gilt dishes, shells.
    name: 'memorial', R: 1.7, where: 'ground',
    make: (S, P, r) => {
      P.p('stone', S.box(0.8, 0.13, 0.62), 0, 0, 0, 0.2).p('capstone', S.box(0.6, 0.11, 0.46), 0, 0.13, 0, -0.1).p('stone', S.box(0.4, 0.09, 0.32), 0, 0.24, 0, 0.3).p('wine', S.box(0.3, 0.03, 0.5), 0, 0.33, 0, 0.5);
      P.p('plank', S.log(0.03, 2.1, 6), 0, 0, 0.7, 0).p('plank', S.box(0.5, 0.025, 0.15), 1.25, 0, 0.7);
      P.p('leaf', S.ring(0.26, 0.055), -0.6, 0, 0.25);
      for (let k = 0; k < 5; k++) { const a = k * 1.25; P.p('wine', S.ball(0.04), -0.6 + Math.cos(a) * 0.26, 0.06, 0.25 + Math.sin(a) * 0.26); }
      for (const [cx, cz, h] of [[0.5, 0.3, 0.18], [0.65, 0.05, 0.13], [-0.35, -0.45, 0.15]] as const) P.p('gold', S.disc(0.07, 0.015), cx, 0, cz).p('cream', S.cyl(0.03, 0.03, h, 8), cx, 0.015, cz);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.28; P.p('stone', S.stone(0.13), Math.cos(a) * 1.35, 0, Math.sin(a) * 1.1 - 0.05, r() * 6); }
      shells(S, P, r, 0, 0.1, 6, 0.9);
      if (r() < 0.5) P.p('teal', S.cyl(0.04, 0.05, 0.22, 8), 0.3, 0, -0.45);
    },
  },
  {
    // A fight's aftermath: a shield split in two, a dropped cutlass, a boarding pike, a dented helmet, arrows standing in the ground.
    name: 'fight', R: 2.4, where: 'ground',
    make: (S, P, r) => {
      const half = (a: number) => S.k(`half${a}`, () => new THREE.CylinderGeometry(0.38, 0.38, 0.04, 14, 1, false, a, Math.PI).translate(0, 0.02, 0));
      P.p('wine', half(0), -0.6, 0, -0.2, 0.3).p('wine', half(Math.PI), -0.35, 0, 0.2, 0.9).p('gold', S.ring(0.38, 0.02, Math.PI), -0.6, 0.01, -0.2, 0.3);
      P.p('salt', S.box(0.85, 0.012, 0.05), 0.6, 0.01, -0.5, 0.4).p('gold', S.box(0.04, 0.03, 0.18), 1.04, 0, -0.68, 0.4).p('lacquer', S.log(0.022, 0.17, 6), 1.15, 0, -0.73, 0.4);
      P.p('wood', S.log(0.03, 2.4, 6), 0.1, 0, 0.9, -0.15).p('slate', S.k('S.cyl(0.05, 0.0, 0.3, 6).clone().rotateZ(-Math.PI / 2).translate(0, 0.03, 0)', () => S.cyl(0.05, 0.0, 0.3, 6).clone().rotateZ(-Math.PI / 2).translate(0, 0.03, 0)), 1.33, 0, 0.72, -0.15);
      P.p('lacquer', S.k('helm', () => new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), -1.3, 0.04, 0.6, 0, 1.3).p('gold', S.ring(0.17, 0.018), -1.3, 0.0, 0.6, 0, 1.3);
      // the banner they fought for, down in the grass
      P.p('wood', S.log(0.04, 3.2, 7), 0.3, 0, -1.4, 0.25).p('gold', S.ball(0.07), 1.85, 0, -1.8).p('wine', S.box(1.0, 0.03, 1.3), -0.85, 0, -1.6, 0.25 + Math.PI / 2).p('gold', S.box(1.0, 0.035, 0.05), -0.85, 0, -2.25, 0.25 + Math.PI / 2);
      if (r() < 0.6) P.p('wine', S.cyl(0.36, 0.36, 0.04, 16), 1.6, 0, 0.3).p('gold', S.ring(0.36, 0.022), 1.6, 0.02, 0.3).p('gold', S.ball(0.06, 0.6), 1.6, 0.04, 0.3);
      const arrows = 8 + Math.floor(r() * 9);
      for (let k = 0; k < arrows; k++) {
        const x = (r() - 0.5) * 3.6, z = (r() - 0.5) * 3, y = r() * 6.28, t = 0.25 + r() * 0.35;
        P.p('wood', S.cyl(0.012, 0.012, 0.4, 4), x, 0, z, y, t).p('cream', S.box(0.006, 0.08, 0.05), x + Math.sin(y) * Math.sin(t) * 0.36, Math.cos(t) * 0.36, z + Math.cos(y) * Math.sin(t) * 0.36, y, t);
      }
    },
  },
  {
    // Smugglers surprised: a crate broken open, bottles rolled out, a dropped lantern, a coil of rope, a cloth bundle.
    name: 'smugglers', R: 2.0, where: 'ground',
    make: (S, P, r) => {
      crate(S, P, -0.4, -0.2, 0.3, true);
      crate(S, P, 0.45, -0.55, -0.4, false);
      for (let k = 0; k < 4 + Math.floor(r() * 4); k++) { const a = 0.3 + r() * 1.6, d = 0.55 + r() * 0.9; P.p('teal', S.log(0.045, 0.24, 7), -0.4 + Math.cos(a) * d, 0, -0.2 + Math.sin(a) * d, r() * 6).p('gold', S.log(0.018, 0.08, 5), -0.4 + Math.cos(a) * d, 0.03, -0.2 + Math.sin(a) * d, r() * 6); }
      P.p('lacquer', S.k('S.box(0.2, 0.28, 0.2).clone().rotateZ(Math.PI / 2).translate(0, -0.04, 0)', () => S.box(0.2, 0.28, 0.2).clone().rotateZ(Math.PI / 2).translate(0, -0.04, 0)), 0.9, 0.1, 0.5, 2.3).p('gold', S.k('S.cyl(0.12, 0.12, 0.04, 8).clone().rotateZ(Math.PI / 2)', () => S.cyl(0.12, 0.12, 0.04, 8).clone().rotateZ(Math.PI / 2)), 1.05, 0.1, 0.43, 2.3);
      coil(S, P, -1.2, 0.6);
      P.p('rope', S.ball(0.3, 0.6), 0.2, 0, 1.2, 0, 0, 1.3, 1, 1).p('rope', S.cyl(0.05, 0.05, 0.06, 8), 0.2, 0.34, 1.2);
      if (r() < 0.7) P.p('rope', S.ball(0.28, 0.55), 0.85, 0, 1.0, 0.8, 0, 1.4, 1, 1);
      if (r() < 0.6) crate(S, P, -1.3, -0.9, 1.1, false);
      for (let k = 0; k < 4; k++) P.p('plank', S.box(0.1, 0.03, 0.62), 1.4 + k * 0.13, 0, -0.6 + (r() - 0.5) * 0.3, 0.3 + (r() - 0.5) * 0.6);
    },
  },
  {
    // A fish cart tipped off the road: its tray upside down, a wheel off and lying flat, the other in the air, crates and baskets spilled.
    name: 'cart', R: 2.6, where: 'ground',
    make: (S, P, r) => {
      P.p('plank', S.box(1.6, 0.34, 1.0), 0, 0, 0, 0.1).p('gold', S.box(1.64, 0.04, 1.04), 0, 0.02, 0, 0.1);
      P.p('teal', S.box(1.7, 0.025, 1.3), 0.2, 0, -1.5, -0.3).p('gold', S.box(1.7, 0.03, 0.05), 0.2, 0, -0.86, -0.3);
      for (const s of [-0.35, 0.35]) P.p('wood', S.log(0.035, 1.0, 6), 1.1, 0, s, 0.1 + 0.1 * s);
      const wheel = (x: number, z: number) => {
        P.p('wood', S.ring(0.42, 0.045), x, 0, z).p('wood', S.cyl(0.08, 0.08, 0.1, 8), x, 0, z);
        for (let k = 0; k < 3; k++) P.p('wood', S.log(0.022, 0.8, 4), x, 0.03, z, k * 1.05);
      };
      wheel(-0.5, 1.15);
      if (r() < 0.6) wheel(1.0, -1.25);
      basketDown(S, P, -1.3, -0.4, 2.8);
      fishFan(S, P, r, -1.5, -0.4, 3.0, 5 + Math.floor(r() * 4));
      crate(S, P, 0.7, 1.2, 0.8, r() < 0.5);
      if (r() < 0.5) basket(S, P, -1.4, 0.9, 0.3);
    },
  },
  {
    // The salt barrow tipped: its tray on its side, the salt spilled in a heap, the rake dropped beside it.
    name: 'barrow', R: 1.9, where: 'ground',
    make: (S, P, r) => {
      P.p('plank', S.box(0.3, 0.36, 1.0), 0, 0, 0, 0.2).p('gold', S.box(0.32, 0.03, 1.02), 0, 0.34, 0, 0.2);
      P.p('wood', S.ring(0.22, 0.04), -0.3, 0, 0.75, 0.2);
      for (const s of [-0.25, 0.25]) P.p('wood', S.log(0.03, 0.9, 6), 0.05, 0, -0.75 + s * 0.1, 1.77 + s);
      P.p('cloth', S.k('saltheap', () => new THREE.ConeGeometry(0.6, 0.26, 12).translate(0, 0.13, 0)), 0.7, 0, -0.05, 0, 0, 1.3, 1, 0.9);
      P.p('wood', S.log(0.022, 1.7, 5), -0.6, 0, 0.9, 0.6).p('lacquer', S.box(0.05, 0.03, 0.45), -1.3, 0, 1.4, 0.6);
      if (r() < 0.5) basket(S, P, 1.1, 1.0, 0.28);
    },
  },
  // --- past the outline: the beach and the sea ---
  {
    // A rowing boat hauled up on the sand, heeled over, oars beside it, its little mast down with the sail half off it.
    name: 'rowboat', R: 3.4, where: 'beach', wet: true,
    make: (S, P, r) => {
      const paint = pick(r, ['teal', 'wine', 'lacquer'] as Key[]);
      P.p(paint, S.hull(4, 1.5, 0.55), 0, 0, 0, 0, 0, 1, 1, 1);
      P.p('gold', S.gunwale(4, 1.5), 0, 0.55, 0);
      for (const s of [-0.7, 0.5]) P.p('plank', S.box(1.3, 0.05, 0.2), 0, 0.42, s);
      P.p('plank', S.log(0.035, 2.4, 6), 1.2, 0, -0.4, Math.PI / 2 + 0.15).p('plank', S.box(0.14, 0.03, 0.55), 1.32, 0, 0.75, 0.15);
      P.p('plank', S.log(0.035, 2.4, 6), 0.4, 0.5, 0.2, Math.PI / 2 - 0.1, 0.15);
      P.p('wood', S.log(0.05, 3.0, 7), -1.3, 0, 0.6, Math.PI / 2 + 0.25).p('wine', S.sail(2.6, 1.5), -1.25, 0, 1.9, -Math.PI / 2 - 0.25);
      if (r() < 0.6) coil(S, P, 1.1, 1.8);
    },
  },
  {
    // A net hung on its frame to be mended, half of it still heaped below; a stool, the basket of floats.
    name: 'netframe', R: 2.6, where: 'beach',
    make: (S, P, r) => {
      for (const s of [-1.35, 1.35]) P.p('wood', S.cyl(0.07, 0.08, 2.1, 7), s, 0, 0).p('gold', S.cyl(0.09, 0.09, 0.06, 7), s, 2.1, 0);
      P.p('wood', S.log(0.05, 2.9, 7), 0, 1.95, 0);
      P.p('rope', S.net(2.5, 1.3, false), 0, 0.62, 0.02);
      for (let k = 0; k < 6; k++) P.p('wine', S.ball(0.07), -1.1 + k * 0.44, 0.55, 0.04);
      P.p('rope', S.ball(0.65, 0.35), 0.3, 0, 0.7, 0, 0, 1.4, 1, 0.9);
      P.p('plank', S.cyl(0.2, 0.2, 0.05, 12), -0.7, 0.4, 1.2);
      for (let k = 0; k < 3; k++) { const a = k * 2.09; P.p('wood', S.cyl(0.025, 0.03, 0.4, 5), -0.7 + Math.cos(a) * 0.14, 0, 1.2 + Math.sin(a) * 0.14); }
      basket(S, P, 1.6, 1.0, 0.3);
      for (let k = 0; k < 4; k++) P.p('wine', S.ball(0.08), 1.55 + (r() - 0.5) * 0.25, 0.28, 1.0 + (r() - 0.5) * 0.25);
    },
  },
  {
    // Lobster pots stacked to dry, one fallen and broken, buoys and a coil of line.
    name: 'potstack', R: 2.2, where: 'beach',
    make: (S, P, r) => {
      for (let k = 0; k < 3; k++) pot(S, P, -0.8 + k * 0.78, 0, 0, 0);
      for (let k = 0; k < 2; k++) pot(S, P, -0.42 + k * 0.78, 0.31, 0, 0);
      if (r() < 0.7) pot(S, P, 0.0, 0.62, 0.0, 0.2);
      pot(S, P, 1.4, 0, 1.0, 1.1);
      for (let k = 0; k < 3; k++) P.p('wine', S.ball(0.15), -1.3 + k * 0.35, 0, 1.0 + (k % 2) * 0.25).p('gold', S.ring(0.152, 0.015), -1.3 + k * 0.35, 0.14, 1.0 + (k % 2) * 0.25);
      coil(S, P, 0.2, 1.3);
    },
  },
  {
    // A mooring post with its rope parted, the frayed end trailing; the boat's anchor fast in the sand, its fluke up.
    name: 'mooring', R: 2.2, where: 'beach', wet: true,
    make: (S, P, r) => {
      P.p('wood', S.cyl(0.2, 0.24, 1.7, 12), 0, 0, 0).p('gold', S.cyl(0.215, 0.215, 0.07, 12), 0, 1.3, 0).p('wood', S.cyl(0.22, 0.2, 0.08, 12), 0, 1.7, 0);
      P.p('rope', S.ring(0.25, 0.05), 0, 1.0, 0);
      let x = 0.25, z = 0.05;
      for (let k = 0; k < 5; k++) { const a = -0.3 + 0.3 * Math.sin(k); const nx = x + Math.cos(a) * 0.4, nz = z - Math.sin(a) * 0.4; P.p('rope', S.log(0.04, 0.42, 5), (x + nx) / 2, 0, (z + nz) / 2, a); x = nx; z = nz; }
      for (let k = 0; k < 4; k++) P.p('rope', S.log(0.012, 0.25, 4), x + 0.1, 0, z + (k - 1.5) * 0.06, -0.4 + k * 0.25);
      // the anchor, stood fluke-down in the sand, leaning
      P.p('lacquer', S.cyl(0.06, 0.06, 1.3, 8), -1.0, -0.2, 0.9, 0.4, 0.35).p('lacquer', S.log(0.05, 0.9, 8), -1.0 + Math.sin(0.4) * 0.38, 0.95, 0.9 + Math.cos(0.4) * 0.38, 0.4 + Math.PI / 2);
      P.p('lacquer', S.k('S.ring(0.4, 0.06, Math.PI).clone().rotateX(Math.PI / 2).rotateY(Math.PI / 2)', () => S.ring(0.4, 0.06, Math.PI).clone().rotateX(Math.PI / 2).rotateY(Math.PI / 2)), -1.0, -0.05, 0.9, 0.4);
      P.p('gold', S.k('S.ring(0.1, 0.022).clone().rotateX(Math.PI / 2)', () => S.ring(0.1, 0.022).clone().rotateX(Math.PI / 2)), -1.0 + Math.sin(0.4) * 0.48, 1.15, 0.9 + Math.cos(0.4) * 0.48, 0.4);
      if (r() < 0.6) shells(S, P, r, 0.5, 1.0, 4, 0.6);
    },
  },
  {
    // Out at sea: a ship capsized on the far rocks, keel to the sky, her mast broken off beside her.
    name: 'capsized', R: 9, where: 'sea',
    make: (S, P, r) => {
      for (let k = 0; k < 7; k++) P.p('rock', S.k('ico', () => new THREE.IcosahedronGeometry(1, 0)), (r() - 0.5) * 12, -0.4, (r() - 0.5) * 16, r() * 6, 0, 2 + r() * 2, 1.4 + r() * 1.6, 2 + r() * 2);
      P.p('lacquer', S.upturned(15, 5.4, 2.8), 0, 0.9, 0, 0, 0.14).p('wood', S.box(0.4, 0.5, 15), 0, 3.6, 0, 0, 0.14).p('gold', S.gunwale(15, 5.4), 0, 0.92, 0, 0, 0.14);
      P.p('wood', S.cyl(0.25, 0.32, 9, 8), 4, -0.3, 3, 0.8, 1.0).p('wood', S.log(0.15, 4.5, 7), 6.5, 0.2, -1.5, 0.3).p('sail', S.box(3.2, 0.05, 2.6), 7.5, 0.1, 4.8, 0.6, 0.12);
    },
  },
];
export const SEA_SCENE_KINDS = KINDS.map((k) => k.name);

/** Which kinds suit a place's kind (one is put near such a place, outside its stand). */
const BY_PLACE: Record<string, string[]> = {
  market: ['stall', 'cart'], village: ['washing', 'fire'], lighthouse: ['barrels'], beacon: ['barrels', 'fire'], wreck: ['flotsam', 'anchor'],
  shipyard: ['anchor', 'nets'], chapel: ['memorial'], fort: ['fight'], caves: ['smugglers'], saltworks: ['barrow'],
};
/** Kinds for the roads' verges and the open ground. */
const ROADSIDE = ['cart', 'fire', 'nets', 'pots', 'fight', 'flotsam', 'anchor', 'washing', 'barrels', 'stall', 'memorial'];

export function scenesOff() {
  return typeof location !== 'undefined' && /[?&]scenes=off\b/.test(location.search);
}

/** Plans and adds the scenes of one sea floor; returns where they stand (for the probe). */
export function buildSeaScenes(o: SeaScenesIn): Placed[] {
  const { spec, geo, dress } = o;
  if (scenesOff()) return [];
  const rnd = seeded(SEED + (spec.seed ?? 0));
  const { S, dispose } = shapes();
  const roads: Seg[] = [];
  for (const p of spec.paths) for (let i = 1; i < p.length; i++) roads.push({ ax: RING.x + p[i - 1][0], az: RING.z + p[i - 1][1], bx: RING.x + p[i][0], bz: RING.z + p[i][1], r: 0 });
  const keep: Pt[] = spec.keep ?? [];
  const taken = o.taken;
  const placed: Placed[] = [];
  const kinds = new Map(KINDS.map((k) => [k.name, k]));
  // How many of each kind this floor may have (so floors differ): 0 to 3 on the ground, the beach's 1 or 2.
  const cap = new Map<string, number>();
  for (const k of KINDS) cap.set(k.name, k.where === 'ground' ? 1 + Math.floor(rnd() * 2.6) + (rnd() < 0.4 ? 1 : 0) : k.where === 'beach' ? 1 + Math.floor(rnd() * 2) : 1);
  const used = new Map<string, number>();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), corner = new THREE.Vector3();

  /**
   * Where each part of a scene at (x, z) turned `yaw` (mirrored or not) stands: its middle on the ground, a circle round it and its top
   * (above its own ground), worked out from its shape's box without building it (a tilted part is given room for its lean). A ground
   * scene is drawn `GROUND_SCALE` larger, and a part that this lifts over the knee is drawn lower instead (`sy`).
   */
  type Laid = { p: Part; wx: number; wz: number; wyaw: number; ground: number; cx: number; cz: number; r: number; top: number; k: number; sy: number };
  const lay = (P: Parts, x: number, z: number, yaw: number, mir: number, beyond: boolean, ok: (L: Laid) => boolean): Laid[] | null => {
    const c = Math.cos(yaw), s = Math.sin(yaw), k = beyond ? 1 : GROUND_SCALE, out: Laid[] = [];
    for (const p of P.list) {
      const lx = p.x * mir * k, lz = p.z * k, wx = x + c * lx + s * lz, wz = z - s * lx + c * lz, wyaw = yaw + p.yaw * mir;
      const ground = beyond ? Math.max(geo.height(wx - RING.x, wz - RING.z), WATER - 0.25) : 0;
      const bb = p.g.boundingBox ?? (p.g.computeBoundingBox(), p.g.boundingBox!);
      const sx = p.s[0] * k, sz = p.s[2] * k, ox = ((bb.min.x + bb.max.x) / 2) * sx, oz = ((bb.min.z + bb.max.z) / 2) * sz;
      const cy = Math.cos(wyaw), sy2 = Math.sin(wyaw), lean = Math.abs(Math.sin(p.tilt)), up = Math.abs(Math.cos(p.tilt));
      let sy = p.s[1] * k;
      const topOf = (yy: number) => p.y * k + Math.max(bb.max.y * yy * up, bb.min.y * yy * up) + lean * Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z)) * sz;
      let top = topOf(sy);
      if (!beyond && top > KNEE - 0.02) {
        const base = p.y * k + lean * Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z)) * sz;
        sy *= Math.max(0.3, (KNEE - 0.03 - base) / Math.max(0.01, top - base));
        top = topOf(sy);
      }
      const r = Math.hypot((bb.max.x - bb.min.x) * sx, (bb.max.z - bb.min.z) * sz) / 2 + lean * Math.max(Math.abs(bb.min.y), Math.abs(bb.max.y)) * sy;
      const L: Laid = { p, wx, wz, wyaw, ground, cx: wx + cy * ox + sy2 * oz, cz: wz - sy2 * ox + cy * oz, r, top, k, sy };
      if (!ok(L)) return null;
      out.push(L);
    }
    return out;
  };
  /** A placed part's real corners on the ground and its real top (for the probe), from its full transform. */
  const corners = (L: Laid) => {
    const p = L.p, bb = p.g.boundingBox!;
    m4.compose(v.set(L.wx, L.ground + p.y * L.k, L.wz), q.setFromEuler(e.set(p.tilt, L.wyaw, 0, 'YXZ')), sc.set(p.s[0] * L.k, L.sy, p.s[2] * L.k));
    const pts: [number, number][] = [];
    let top = -1e9;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m4);
      if (!(i & 2)) pts.push([corner.x, corner.z]);
      top = Math.max(top, corner.y - L.ground);
    }
    return { pts, top };
  };
  /** The depth's props and the land's houses, jetties, boats and trees, by squares of `CELL` m (each in every square within `NEAR` m of it). */
  const CELL = 8, NEAR = 10, cells = new Map<number, { x: number; z: number; r: number; m: number }[]>();
  const cellKey = (i: number, j: number) => i * 4096 + j;
  for (const [list, m] of [[o.marks, 0.35], [taken, 0.6]] as const) for (const t of list) {
    const e2 = t.r + NEAR;
    for (let i = Math.floor((t.x - e2) / CELL); i <= Math.floor((t.x + e2) / CELL); i++) for (let j = Math.floor((t.z - e2) / CELL); j <= Math.floor((t.z + e2) / CELL); j++) {
      const key = cellKey(i, j);
      let c = cells.get(key);
      if (!c) cells.set(key, (c = []));
      c.push({ x: t.x, z: t.z, r: t.r, m });
    }
  }
  const trees = taken.filter((t) => t.tree);
  const allNear = [...o.marks.map((t) => ({ ...t, m: 0.35 })), ...taken.map((t) => ({ ...t, m: 0.6 }))];
  /** The props near (x, z): everything within `NEAR` m of it at least (all of them for a scene wider than that). */
  const propsNear = (x: number, z: number, reachM: number) => (reachM + 3 > NEAR ? allNear : cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []);

  /** In a tidal flat as it is drawn (land.ts: an ellipse turned `rot`, wet out to `rx + 2`), with `pad` m more. */
  const inFlat = (x: number, z: number, pad: number) => spec.flats.some((f) => {
    const c = Math.cos(f.rot ?? 0), s2 = Math.sin(f.rot ?? 0), dx = x - f.x, dz = z - f.z, u = dx * c + dz * s2, w = -dx * s2 + dz * c, R = f.rx + 2;
    return Math.hypot(u / (R + pad), w / (R * (f.rz / f.rx) + pad)) < 1;
  });
  /** Is every part clear? Walkable scenes: low, inside the outline, off roads, cover, spots, places, flats, the depth's props. */
  const partCheck = (k: Kind, x: number, z: number) => {
    const R = reach(k) + 1;
    const nearKeep = keep.filter((s) => Math.hypot(s.x - x, s.z - z) < R + 3.5);
    const nearCover = o.cover.filter((c) => segDist(x, z, c.ax, c.az, c.bx, c.bz) < R + c.r + 1);
    const nearRoads = roads.filter((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < R + 2.5);
    const nearProps = propsNear(x, z, R).filter((m) => Math.hypot(m.x - x, m.z - z) < R + m.r + 1.5);
    const nearPlaces = spec.places.filter((p) => Math.hypot(p.x - x, p.z - z) < R + p.r + 1.5);
    return (L: Laid) => {
      const { cx, cz, r } = L;
      if (nearKeep.some((s) => Math.hypot(s.x - cx, s.z - cz) < 3.1 + r)) return false;
      if (nearCover.some((c) => segDist(cx, cz, c.ax, c.az, c.bx, c.bz) < c.r + 0.6 + r)) return false;
      if (nearRoads.some((s) => segDist(cx, cz, s.ax, s.az, s.bx, s.bz) < 2.0 + r)) return false;
      if (nearProps.some((m) => Math.hypot(m.x - cx, m.z - cz) < m.r + m.m + r)) return false;
      if (nearPlaces.some((p) => Math.hypot(p.x - cx, p.z - cz) < p.r + 0.8 + r)) return false;
      const b = geo.beyond(cx - RING.x, cz - RING.z);
      if (k.where === 'ground') {
        if (b > -0.8 - r || L.top > KNEE) return false;
        if (inFlat(cx, cz, r + 0.5)) return false;
      } else if (k.where === 'beach') {
        // past the outline (its invisible edge walls reach 1.2 m out), never far up the land
        if (b < 1.4 + r || b > 14) return false;
        const gh = geo.height(cx - RING.x, cz - RING.z);
        if (k.wet) { if (gh < WATER - 0.4 || geo.seaSide(cx - RING.x, cz - RING.z) < 0.5) return false; }
        else if (gh < WATER - 0.35 || geo.steepness(cx - RING.x, cz - RING.z) > 0.7 || geo.cliff(cx - RING.x, cz - RING.z) > 0.2) return false;
      } else if (b < 16) return false;
      return true;
    };
  };
  /** The whole scene: a dry-ground beach scene stands on fairly even ground. */
  const sceneFits = (k: Kind, laid: Laid[]) => {
    if (k.where === 'beach') {
      if (!k.wet) {
        let lo = 1e9, hi = -1e9;
        for (const L of laid) { lo = Math.min(lo, L.ground); hi = Math.max(hi, L.ground); }
        if (hi - lo > 0.6) return false;
      }
    }
    return true;
  };

  /** The cheap tests on a scene's middle alone, before its parts are made: spacing, the outline, a spot, a road, the cover, a place. */
  const roughly = (k: Kind, x: number, z: number) => {
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + reach(k) + 1.5)) return false;
    const b = geo.beyond(x - RING.x, z - RING.z);
    if (k.where === 'ground' ? b > -1.2 : k.where === 'beach' ? b < 1.4 || b > 16 : b < 16) return false;
    if (keep.some((s) => Math.hypot(s.x - x, s.z - z) < 3.2)) return false;
    if (roads.some((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 2.2)) return false;
    if (o.cover.some((c) => segDist(x, z, c.ax, c.az, c.bx, c.bz) < c.r + 0.4)) return false;
    if (spec.places.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 0.8)) return false;
    if (k.where === 'beach') {
      // never south of the walkable ground (between the camera and a hero); a dry-ground scene's middle on dry ground
      const dz = z - RING.z, d = Math.hypot(x - RING.x, dz) || 1, gh = geo.height(x - RING.x, z - RING.z);
      if (dz / d > 0.35) return false;
      if (k.wet ? gh < WATER - 0.4 || geo.seaSide(x - RING.x, z - RING.z) < 0.5 : gh < WATER + 0.02) return false;
      if (propsNear(x, z, 0).some((m) => Math.hypot(m.x - x, m.z - z) < m.r + m.m)) return false;
      if (trees.some((t) => t.z > z - 1 && t.z < z + 10 && Math.abs(t.x - x) < 5)) return false;
    }
    if (k.where === 'sea' && geo.sea(x - RING.x, z - RING.z) < 0.97) return false;
    return true;
  };
  /** Tries a kind round (x, z): a few turns and nudges. */
  const tryPut = (name: string, x: number, z: number, jitter: number, faceYaw?: number) => {
    const k = kinds.get(name)!;
    if ((used.get(name) ?? 0) >= (cap.get(name) ?? 0)) return false;
    for (let t = 0; t < 3; t++) {
      const sub = seeded(Math.floor(rnd() * 1e9));
      const px = x + (rnd() - 0.5) * jitter * (t ? 1 : 0), pz = z + (rnd() - 0.5) * jitter * (t ? 1 : 0);
      const yaw = faceYaw !== undefined ? faceYaw + (rnd() - 0.5) * 0.5 : rnd() * Math.PI * 2, mir = rnd() < 0.5 ? 1 : -1;
      if (!roughly(k, px, pz)) continue;
      const P = new Parts();
      k.make(S, P, sub);
      const chk = partCheck(k, px, pz);
      const laid = lay(P, px, pz, yaw, mir, k.where !== 'ground', chk);
      if (!laid || !sceneFits(k, laid)) continue;
      const pts: [number, number][] = [];
      let top = 0;
      const byKey = new Map<Key, { g: THREE.BufferGeometry; m: THREE.Matrix4 }[]>();
      for (const L of laid) {
        const cn = corners(L), key: Key = L.p.key === 'gold' ? 'brass' : L.p.key;
        let list = byKey.get(key);
        if (!list) byKey.set(key, (list = []));
        list.push({ g: L.p.g, m: m4.clone() });
        pts.push(...cn.pts, [L.cx, L.cz]);
        top = Math.max(top, cn.top);
      }
      for (const [key, list] of byKey) { const g = bake(list); dress.add(key, g, 0, 0, 0); g.dispose(); }
      let r = 0;
      for (const [qx, qz] of pts) r = Math.max(r, Math.hypot(qx - px, qz - pz));
      placed.push({ kind: name, x: px, z: pz, r, beyond: k.where !== 'ground', top: +top.toFixed(2), pts: pts.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]) });
      used.set(name, (used.get(name) ?? 0) + 1);
      return true;
    }
    return false;
  };
  const shuffled = <T,>(xs: T[]) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 1. Near the places that suit them: outside the stand, towards the roads' ends.
  for (const p of shuffled(spec.places)) {
    const opts = BY_PLACE[p.kind ?? ''];
    if (!opts) continue;
    const name = pick(rnd, opts), k = kinds.get(name)!;
    cap.set(name, Math.max(cap.get(name) ?? 0, (used.get(name) ?? 0) + 1));
    for (let t = 0; t < 10; t++) {
      const a = rnd() * Math.PI * 2, d = p.r + reach(k) + 1.2 + rnd() * 3;
      if (tryPut(name, p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 1.5)) break;
    }
  }
  // 2. Along the roads: about one every 40 to 60 m, on the verge, each a kind from the roadside list.
  for (const s of shuffled(roads)) {
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (L < 8) continue;
    const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
    for (let d = 6 + rnd() * 24; d < L - 6; d += 34 + rnd() * 18) {
      const side = rnd() < 0.5 ? 1 : -1;
      for (const name of shuffled(ROADSIDE).slice(0, 4)) {
        const k = kinds.get(name)!, off = 2.2 + reach(k) * 0.95 + rnd() * 1.5;
        if (tryPut(name, s.ax + ux * d - uz * side * off, s.az + uz * d + ux * side * off, 0.8)) break;
      }
    }
  }
  // 3. The open ground between the places.
  const rmax = Math.max(...spec.rim);
  for (let t = 0, made = 0; t < 160 && made < 7; t++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (geo.beyond(x - RING.x, z - RING.z) > -4) continue;
    if (roads.some((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 9)) continue;
    if (tryPut(pick(rnd, ROADSIDE), x, z, 0)) made++;
  }
  // 4. The beach past the outline, on the sea's side; 5. a wreck far out on the rocks.
  const seaDir = geo.m === 1 ? 0 : Math.PI;
  const beach = KINDS.filter((k) => k.where === 'beach').map((k) => k.name);
  for (let t = 0, made = 0; t < 320 && made < 6; t++) {
    // half the tries on the sea's side, half anywhere round (headlands, the land's side)
    const a = t % 2 ? seaDir + (rnd() - 0.5) * 2.6 : rnd() * Math.PI * 2, rr = rimAt(spec.rim, a), d = rr + 1.8 + rnd() * 4;
    const x = RING.x + Math.cos(a) * d, z = RING.z + Math.sin(a) * d;
    if (tryPut(pick(rnd, beach), x, z, 0.8, Math.atan2(Math.cos(a), Math.sin(a)))) made++;
  }
  for (let t = 0; t < 30; t++) {
    const a = seaDir + (rnd() - 0.5) * 1.6, d = rimAt(spec.rim, a) + 26 + rnd() * 22;
    if (tryPut('capsized', RING.x + Math.cos(a) * d, RING.z + Math.sin(a) * d, 4)) break;
  }
  dispose();
  return placed;
}
