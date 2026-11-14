import * as THREE from 'three';
import { scenesOff } from './off';
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
 * Each kind is a list of parts in its own frame, built from geometry made once a floor, placed many times turned, mirrored and in two or
 * three ways (which main piece, which load, how many fish or arrows), by the floor's own random stream (`seeded(SEED + spec.seed)`): the
 * zone's and the depth's streams are untouched, so nothing that was there moves. Each placed scene is baked into one geometry a colour
 * and goes into the land's merged dressing (one mesh a 24 m square whatever the colours); its gold trim is drawn matte (`brass`) there.
 *
 * The second pass (2026-11-14, "continue more refine"): every scene has a clear main piece big enough to read from the game's camera (a
 * striped awning, a tent down, a sail, a shield wall, the anchor), its own ground painted into the land's map (a trodden patch, a scorch,
 * a black pool of oil, wheel ruts from the road, the furrow an anchor left), more of them along the roads and at the forks and round the
 * floor's spots, and small echoes between (a crate fallen off the cart before it went over). Painted ground costs no triangles or draws.
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
  /** The land's painted middle (land.ts `paint`: a canvas `L` m across centred on the ring), for the scenes' trodden ground. */
  ground?: { map: THREE.Texture; L: number };
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
  /** The middle of its largest part (the cart, the sail, the awning), for the views probe. */
  main?: [number, number];
  /** A small echo of a scene between two (a crate fallen off the cart): not counted as a scene. */
  echo?: boolean;
}

const SEED = 6161;
const KNEE = 0.55;
/** The ground scenes are drawn this much larger than life-sized props (they are seen from the game's high camera); never above the knee. */
const GROUND_SCALE = 1.45;

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

// --- a part and a scene's parts ---------------------------------------------------------------------------------------------------
type Part = { key: Key; g: THREE.BufferGeometry; x: number; y: number; z: number; yaw: number; s: [number, number, number]; tilt: number };
/** A mark painted on the ground under a scene: a trodden patch, a scorch, a stain of oil, wet ground, a pale spill of salt or grain. */
type MarkT = 'patch' | 'scorch' | 'stain' | 'wet' | 'spill';
class Parts {
  list: Part[] = [];
  marks: { t: MarkT; x: number; z: number; a: number; b: number; rot: number }[] = [];
  /** A ground mark in the scene's frame: an ellipse `a` by `b` m (radii), turned `rot`. */
  m(t: MarkT, x: number, z: number, a: number, b = a, rot = 0) {
    this.marks.push({ t, x, z, a, b, rot });
    return this;
  }
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
      const body = new THREE.SphereGeometry(1, 6, 4).scale(0.17, 0.045, 0.06).translate(0, 0.045, 0);
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
  /** A trail painted to it: wheel ruts from the nearest road (a cart), a furrow from the sea (an anchor dragged ashore). */
  trail?: 'ruts' | 'drag';
  /** A small piece of it dropped along the road before it (looks only, low). */
  echo?: Make;
}

// --- the scenes -----------------------------------------------------------------------------------------------------------------
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
/** A kind's reach as drawn (the ground scenes are drawn larger). */
const reach = (k: Kind) => k.R * (k.where === 'ground' ? GROUND_SCALE : 1);

/** A wicker basket (upright), with a gilt rim. */
const basket = (S: Shapes, P: Parts, x: number, z: number, h = 0.3) => {
  P.p('plank', S.cyl(0.27, 0.21, h), x, 0, z).p('lacquer', S.disc(0.24), x, h - 0.04, z).p('gold', S.ring(0.27, 0.018), x, h - 0.02, z);
};
/** A basket on its side, its mouth towards +x. */
const basketDown = (S: Shapes, P: Parts, x: number, z: number, yaw: number) => {
  P.p('plank', S.log(0.2, 0.42, 10), x, 0, z, yaw).p('lacquer', S.k('bmouth', () => S.disc(0.17, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.2, 0)), x + Math.cos(yaw) * 0.21, 0, z - Math.sin(yaw) * 0.21, yaw);
};
const fishFan = (S: Shapes, P: Parts, r: () => number, x: number, z: number, a: number, n: number, spread = 1.2) => {
  for (let k = 0; k < n; k++) {
    const t = a + (r() - 0.5) * 1.3, d = 0.3 + r() * spread;
    P.p(r() < 0.6 ? 'slate' : 'cloth', S.fish(), x + Math.cos(t) * d, 0, z - Math.sin(t) * d, r() * 6.28);
  }
};
/** A wooden crate (0.45 m), lid off and lying beside it, or shut. */
const crate = (S: Shapes, P: Parts, x: number, z: number, yaw: number, open: boolean) => {
  P.p('wood', S.box(0.62, 0.36, 0.48), x, 0, z, yaw).p('gold', S.box(0.64, 0.035, 0.5), x, 0.26, z, yaw);
  if (open) P.p('plank', S.box(0.66, 0.04, 0.52), x + Math.sin(yaw + 0.9) * 0.7, 0, z + Math.cos(yaw + 0.9) * 0.7, yaw + 0.5);
  else P.p('plank', S.box(0.64, 0.04, 0.5), x, 0.36, z, yaw);
};
const coil = (S: Shapes, P: Parts, x: number, z: number, s = 1) => P.p('rope', S.ring(0.26, 0.045), x, 0, z, 0, 0, s, 1, s).p('rope', S.ring(0.18, 0.045), x, 0.07, z, 0, 0, s, 1, s);
const shells = (S: Shapes, P: Parts, r: () => number, x: number, z: number, n: number, spread = 0.8) => {
  for (let k = 0; k < n; k++) P.p(r() < 0.5 ? 'cream' : 'salt', S.ball(0.05, 0.5), x + (r() - 0.5) * spread * 2, 0, z + (r() - 0.5) * spread * 2);
};
/** A barrel lying along x (0.4 m across), gilt hoops. */
const barrelDown = (S: Shapes, P: Parts, x: number, z: number, yaw: number) => {
  P.p('wood', S.log(0.2, 0.62, 12), x, 0, z, yaw);
  for (const s of [-0.2, 0.2]) P.p('gold', S.k('bhoop', () => S.ring(0.21, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.2, 0)), x + Math.cos(yaw) * s, 0, z - Math.sin(yaw) * s, yaw);
};
/** A barrel standing (0.62 m: only past the walkable edge, or it is drawn lower). */
const barrelUp = (S: Shapes, P: Parts, x: number, y: number, z: number) => {
  P.p('wood', S.cyl(0.21, 0.21, 0.62, 12), x, y, z);
  for (const h of [0.12, 0.5]) P.p('gold', S.ring(0.215, 0.02), x, y + h, z);
};
/** A lobster pot: a slatted half-round on a board (0.38 m), along x. */
const pot = (S: Shapes, P: Parts, x: number, y: number, z: number, yaw: number) => {
  P.p('plank', S.box(0.72, 0.04, 0.5), x, y, z, yaw);
  for (const s of [-0.3, 0, 0.3]) P.p('wood', S.hoop(0.23, 0.018), x + Math.cos(yaw) * s, y + 0.04, z - Math.sin(yaw) * s, yaw + Math.PI / 2);
  P.p('rope', S.k('potmesh', () => S.box(0.7, 0.22, 0.42).clone().translate(0, -0.11, 0)), x, y + 0.15, z, yaw);
};
/** A cart's wheel lying flat (spokes and a gilt hub). */
const wheelFlat = (S: Shapes, P: Parts, x: number, z: number, rr = 0.55) => {
  P.p('wood', S.ring(rr, 0.05), x, 0, z).p('gold', S.cyl(0.1, 0.1, 0.12, 8), x, 0, z);
  for (let k = 0; k < 3; k++) P.p('wood', S.log(0.025, rr * 2, 4), x, 0.03, z, k * 1.05);
};
/** A cloth lying flat in strips of two colours (a market awning), `w` along x, `d` along z. */
const striped = (S: Shapes, P: Parts, x: number, z: number, yaw: number, w: number, d: number, a: Key, b: Key, n = 5) => {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let k = 0; k < n; k++) {
    const lx = -w / 2 + (w / n) * (k + 0.5);
    P.p(k % 2 ? b : a, S.box(w / n, 0.03, d), x + c * lx, 0, z - s * lx, yaw);
  }
  P.p('gold', S.box(w, 0.035, 0.06), x + s * (d / 2), 0, z + c * (d / 2), yaw);
};
/** Arrows standing in the ground, leaning, in an area `w` by `d`. */
const arrows = (S: Shapes, P: Parts, r: () => number, x: number, z: number, w: number, d: number, n: number) => {
  for (let k = 0; k < n; k++) {
    const ax = x + (r() - 0.5) * w, az = z + (r() - 0.5) * d, y = r() * 6.28, t = 0.25 + r() * 0.35;
    P.p('wood', S.cyl(0.012, 0.012, 0.4, 4), ax, 0, az, y, t).p('cream', S.box(0.006, 0.08, 0.05), ax + Math.sin(y) * Math.sin(t) * 0.36, Math.cos(t) * 0.36, az + Math.cos(y) * Math.sin(t) * 0.36, y, t);
  }
};
/** A round shield lying flat: a colour, a gilt rim and boss. */
const shield = (S: Shapes, P: Parts, x: number, z: number, col: Key, rr = 0.4) => {
  P.p(col, S.cyl(rr, rr, 0.04, 14), x, 0, z).p('gold', S.ring(rr, 0.024), x, 0.02, z).p('gold', S.ball(0.07, 0.6), x, 0.04, z);
};

const KINDS: Kind[] = [
  {
    // A fish stall knocked over: its striped awning down, the board flat, baskets tipped, the catch spilled in a fan. Two ways: the
    // board whole with the awning thrown back, or the board broken in two and the big tunny of the day on the ground.
    name: 'stall', R: 3.0, where: 'ground',
    make: (S, P, r) => {
      const [a, b] = pick(r, [['wine', 'canvas'], ['teal', 'canvas'], ['wine', 'rope']] as [Key, Key][]);
      P.m('patch', 0, 0, 3.0, 2.4, 0.2).m('wet', 1.7, -0.3, 1.5, 1.0, -0.3);
      if (r() < 0.5) {
        P.p('plank', S.box(2.6, 0.06, 1.0), 0, 0, -0.1, 0.15).p('gold', S.box(2.64, 0.03, 0.05), 0.07, 0.06, 0.4, 0.15);
        P.p('wood', S.box(0.08, 0.08, 1.0), -1.0, 0, -1.1, 0.3).p('wood', S.box(0.08, 0.08, 1.0), 0.9, 0, -1.2, -0.2);
        striped(S, P, 0.5, 1.4, 0.35, 2.9, 1.7, a, b);
        P.p('wood', S.log(0.045, 3.0, 6), 0.3, 0, 2.3, 0.4);
      } else {
        P.p('plank', S.box(1.4, 0.06, 1.0), -0.8, 0, -0.2, 0.4).p('plank', S.box(1.3, 0.06, 1.0), 0.75, 0, 0.1, -0.35).p('gold', S.box(1.3, 0.03, 0.05), 0.75, 0.06, 0.6, -0.35);
        striped(S, P, -0.2, 1.6, -0.2, 2.6, 1.6, a, b, 4);
        // the tunny: a long body and its tail
        P.p('slate', S.k('tunny', () => new THREE.SphereGeometry(1, 10, 6).scale(0.75, 0.16, 0.2).translate(0, 0.16, 0)), 1.6, 0, -1.3, 0.5).p('cream', S.k('tunnybelly', () => new THREE.SphereGeometry(1, 8, 4).scale(0.6, 0.06, 0.16).translate(0, 0.06, 0.06)), 1.6, 0, -1.3, 0.5);
        P.p('slate', S.k('tunnytail', () => new THREE.ConeGeometry(0.22, 0.4, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.25).translate(-0.9, 0.16, 0)), 1.6, 0, -1.3, 0.5);
      }
      basket(S, P, -1.8, 0.4);
      basketDown(S, P, 1.6, -0.1, -0.2);
      fishFan(S, P, r, 1.9, -0.15, -0.2, 10 + Math.floor(r() * 6), 1.5);
      if (r() < 0.7) basketDown(S, P, -0.8, -1.7, 2.6);
      if (r() < 0.6) crate(S, P, -1.9, -1.1, 0.4, true);
      fishFan(S, P, r, 0.2, -0.4, 3.6, 5);
    },
    echo: (S, P, r) => { basketDown(S, P, 0, 0, r() * 6); fishFan(S, P, r, 0.4, 0, 0, 3, 0.6); },
  },
  {
    // A camp on the shore just left: a scorched ring of stones, the kettle on them, a bedroll, a pack, driftwood seats. Two ways: as it
    // was (seats round it), or its tent come down flat beside it, poles out from under the canvas, the tripod fallen with its pot.
    name: 'fire', R: 2.9, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0.2, 2.8, 2.6, 0).m('scorch', 0, 0, 1.0, 1.0, 0);
      for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.28; P.p('stone', S.stone(0.16), Math.cos(a) * 0.58, 0, Math.sin(a) * 0.58, r() * 6); }
      for (let k = 0; k < 3; k++) P.p('lacquer', S.log(0.055, 0.8, 6), 0, 0.02, 0, k * 1.05 + r() * 0.3);
      P.p('lacquer', S.cyl(0.17, 0.2, 0.2, 12), 0.62, 0.1, 0.18).p('gold', S.disc(0.15, 0.03), 0.62, 0.3, 0.18);
      P.p('wine', S.box(0.75, 0.05, 1.7), 1.6, 0, 1.1, 0.4).p('wine', S.log(0.15, 0.75, 10), 1.25, 0, 1.85, 0.4).p('gold', S.box(0.77, 0.055, 0.05), 1.6, 0.0, 0.3, 0.4);
      P.p('lacquer', S.box(0.45, 0.3, 0.3), 2.2, 0, 0.05, 1.0).p('gold', S.box(0.08, 0.31, 0.32), 2.2, 0, 0.05, 1.0);
      if (r() < 0.5) {
        const seats = 2 + Math.floor(r() * 2);
        for (let k = 0; k < seats; k++) { const a = 1.9 + k * 1.5 + (r() - 0.5) * 0.4; P.p('plank', S.log(0.17, 1.6, 9), Math.cos(a) * 1.7, 0, -Math.sin(a) * 1.7, a + Math.PI / 2); }
        if (r() < 0.6) P.p('wood', S.log(0.02, 2.6, 5), 1.3, 0, -1.3, -0.5);
      } else {
        // the tent, down: a cream canvas with a gilt hem, its poles out from under it, a guy line
        P.p('canvas', S.box(2.8, 0.04, 2.1), -1.5, 0, -1.5, 0.3).p('gold', S.box(2.8, 0.045, 0.05), -1.5 + Math.sin(0.3) * 1.05, 0, -1.5 + Math.cos(0.3) * 1.05, 0.3);
        P.p('wood', S.log(0.04, 2.0, 6), -1.4, 0.04, -2.9, 1.2).p('wood', S.log(0.04, 2.0, 6), -2.9, 0.04, -0.8, 0.1).p('rope', S.log(0.012, 1.8, 4), -0.3, 0, -2.6, -0.6);
        // the tripod fallen, its pot rolled out
        for (let k = 0; k < 3; k++) P.p('wood', S.log(0.03, 1.5, 5), -0.9 + k * 0.08, 0, 1.0 + k * 0.1, 2.6 + k * 0.25);
        P.p('lacquer', S.log(0.14, 0.24, 10), -1.6, 0, 1.5, 2.0).p('gold', S.k('potrim', () => S.ring(0.14, 0.015).clone().rotateZ(Math.PI / 2).translate(0, 0.14, 0)), -1.48, 0, 1.55, 2.0);
      }
    },
    echo: (S, P, r) => { P.p('plank', S.log(0.12, 1.1, 8), 0, 0, 0, r() * 3); P.p('lacquer', S.log(0.05, 0.6, 6), 0.6, 0, 0.4, 1 + r()); },
  },
  {
    // A net being mended on the ground: spread out, its floats along the edge, the rest heaped, a basket of floats, a stool, the line
    // coiled. Two ways: mending (the shuttle on it), or hauled in with its catch heaped in the middle.
    name: 'nets', R: 2.9, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, -0.3, 3.0, 2.4, 0.1).m('wet', -0.2, -1.2, 2.2, 1.3, 0.1);
      P.p('plank', S.sheet(4.2, 2.5, true), 0, 0, -1.4, 0.1).p('rope', S.net(4.2, 2.5, true), 0, 0.005, -1.4, 0.1);
      for (let k = 0; k < 9; k++) P.p('wine', S.ball(0.08), -1.95 + k * 0.49, 0, -1.35 + k * 0.045);
      P.p('rope', S.ball(0.7, 0.33), -1.8, 0, 0.75, 0.3, 0, 1, 1, 0.7).p('rope', S.ball(0.45, 0.4), -1.2, 0, 1.25, 1.2);
      if (r() < 0.5) {
        basket(S, P, 1.8, 0.8, 0.28);
        for (let k = 0; k < 4; k++) P.p('wine', S.ball(0.08), 1.75 + (r() - 0.5) * 0.25, 0.26, 0.8 + (r() - 0.5) * 0.25);
        P.p('plank', S.cyl(0.2, 0.2, 0.05, 12), 0.7, 0.33, 1.1);
        for (let k = 0; k < 3; k++) { const a = k * 2.09; P.p('wood', S.cyl(0.025, 0.03, 0.33, 5), 0.7 + Math.cos(a) * 0.14, 0, 1.1 + Math.sin(a) * 0.14); }
        P.p('gold', S.box(0.22, 0.02, 0.05), 0.4, 0.02, -0.4, 0.6);
      } else {
        fishFan(S, P, r, 0.2, -1.2, 0, 14, 0.9);
        fishFan(S, P, r, 0.4, -1.4, 3.1, 8, 0.8);
        basketDown(S, P, 1.9, 0.7, 2.4);
      }
      coil(S, P, -0.1, 1.5);
      if (r() < 0.5) shells(S, P, r, 2.0, -0.4, 4, 0.5);
    },
    echo: (S, P, r) => { coil(S, P, 0, 0); for (let k = 0; k < 3; k++) P.p('wine', S.ball(0.08), 0.5 + k * 0.3, 0, 0.2 * k); },
  },
  {
    // The lighthouse keeper's oil barrels rolled off the ramp and spilled: barrels on their sides, the plank ramp, one stove in with its
    // staves fanned in a black pool of oil, his lantern dropped.
    name: 'barrels', R: 2.7, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.6, 2.2, 0).m('stain', 1.0, 0.8, 1.9, 1.1, 0.4);
      barrelDown(S, P, -0.8, -0.5, 0.3);
      barrelDown(S, P, 0.5, -1.0, -0.5);
      barrelDown(S, P, -1.6, 0.6, 1.2 + r() * 0.4);
      if (r() < 0.6) barrelDown(S, P, 1.7, -0.6, 2.0);
      P.p('lacquer', S.disc(0.55, 0.012), 1.1, 0, 1.0, 0.4, 0, 2.6, 1, 1.5);
      // the one stove in: its end and its staves in the pool
      P.p('wood', S.disc(0.2, 0.04), 0.9, 0.01, 0.9, 0.3);
      for (let k = 0; k < 6; k++) { const a = 0.2 + k * 0.5; P.p('plank', S.box(0.1, 0.03, 0.66), 1.0 + Math.cos(a) * 0.7, 0.012, 0.9 - Math.sin(a) * 0.6, a); }
      P.p('gold', S.ring(0.22, 0.02), 1.6, 0.012, 0.4, 0, 0, 1, 1, 0.8);
      // the ramp they came down
      P.p('plank', S.box(0.32, 0.05, 3.0), -0.2, 0, 1.6, 1.4).p('plank', S.box(0.32, 0.05, 3.0), -0.1, 0, 2.1, 1.4);
      // his lantern, dropped and out
      P.p('lacquer', S.k('lanternside', () => S.box(0.22, 0.3, 0.22).clone().rotateZ(Math.PI / 2).translate(0.15, -0.04, 0)), -1.5, 0.11, -0.9, 0.8).p('gold', S.k('lanterncap', () => S.cyl(0.13, 0.13, 0.05, 8).clone().rotateZ(Math.PI / 2)), -1.8, 0.11, -0.65, 0.8);
      if (r() < 0.5) coil(S, P, -2.0, -1.4);
    },
    echo: (S, P, r) => { barrelDown(S, P, 0, 0, r() * 6); P.m('stain', 0.5, 0, 0.7, 0.4, r() * 3); },
  },
  {
    // Pots left to the gulls: a hand-cart tipped and its lobster pots spilled, one broken open, crab shells, feathers, a float on its line.
    name: 'pots', R: 2.5, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.4, 2.0, 0);
      // the hand-cart on its side: its bed, a wheel up, the shafts
      P.p('teal', S.box(1.6, 0.3, 0.9), -0.3, 0, -0.9, 0.2).p('gold', S.box(1.64, 0.035, 0.94), -0.3, 0.28, -0.9, 0.2);
      wheelFlat(S, P, -1.4, -0.4, 0.42);
      for (const s of [-0.3, 0.3]) P.p('wood', S.log(0.03, 1.4, 5), 1.0, 0, -1.2 + s, 0.2);
      pot(S, P, -0.4, 0, 0.3, 0.4);
      pot(S, P, 0.75, 0, 0.45, -0.9);
      pot(S, P, 1.5, 0, -0.3, 1.2);
      if (r() < 0.7) pot(S, P, -0.2, 0, 1.3, 1.9);
      for (let k = 0; k < 3 + Math.floor(r() * 3); k++) P.p('wine', S.ball(0.08, 0.45), (r() - 0.5) * 2.6, 0, (r() - 0.5) * 2.6);
      for (let k = 0; k < 5; k++) P.p('cream', S.box(0.16, 0.012, 0.035), (r() - 0.5) * 2.6, 0, (r() - 0.5) * 2.6, r() * 6);
      P.p('rope', S.log(0.015, 1.6, 4), -1.0, 0, 1.0, 0.5).p('wine', S.ball(0.14), -1.65, 0, 1.45).p('gold', S.ring(0.142, 0.015), -1.65, 0.13, 1.45);
    },
    echo: (S, P, r) => { pot(S, P, 0, 0, 0, r() * 6); },
  },
  {
    // The washing blown down: the props fallen, the line on the ground, the sheets and the clothes strewn along it, the basket tipped.
    // Two ways: off a line between two props, or its frame fallen flat with the sheets still pegged on.
    name: 'washing', R: 3.3, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0.3, 3.2, 1.8, 0);
      const cols: Key[] = ['canvas', 'teal', 'cloth', 'wine', 'canvas', 'rope'];
      if (r() < 0.5) {
        P.p('wood', S.log(0.05, 2.2, 6), -2.9, 0, 0.2, 1.3).p('wood', S.log(0.05, 2.2, 6), 3.0, 0, -0.1, 1.9);
        P.p('rope', S.log(0.014, 6.0, 4), 0, 0, 0, 0.05);
        for (let k = 0; k < 6; k++) P.p(cols[(k + Math.floor(r() * 6)) % 6], S.box(0.95, 0.02, 1.2), -2.4 + k * 0.95, 0, 0.45 + (r() - 0.5) * 1.0, (r() - 0.5) * 1.2);
      } else {
        // the frame, flat: two long poles and the cross-bars, two big sheets over it
        for (const s of [-0.75, 0.75]) P.p('wood', S.log(0.045, 4.4, 6), 0, 0, s, 0);
        for (const s of [-2.1, 0, 2.1]) P.p('wood', S.box(0.08, 0.06, 1.6), s, 0, 0);
        P.p('canvas', S.box(1.8, 0.025, 1.7), -1.0, 0.06, 0.1, 0.06).p('teal', S.box(1.5, 0.025, 1.6), 1.1, 0.06, -0.05, -0.08);
        for (let k = 0; k < 3; k++) P.p(cols[(k + 3) % 6], S.box(0.8, 0.02, 0.9), -1.6 + k * 1.4, 0, 1.6 + (r() - 0.5) * 0.4, (r() - 0.5) * 1.4);
      }
      basketDown(S, P, 1.6, 1.6, -2.4);
      P.p('wine', S.box(0.55, 0.02, 0.45), 1.0, 0, 2.0, 0.6);
      for (let k = 0; k < 5; k++) P.p('wood', S.box(0.03, 0.02, 0.08), (r() - 0.5) * 4, 0, (r() - 0.5) * 1.8, r() * 6);
    },
    echo: (S, P, r) => { P.p(pick(r, ['canvas', 'teal', 'wine'] as Key[]), S.box(0.9, 0.02, 1.1), 0, 0, 0, r() * 6); },
  },
  {
    // An anchor dragged ashore: the big ship's anchor lying in its furrow from the sea, its wooden stock and gilt ring, its cable run out
    // to a heap of coils. Two ways: a hemp cable to the coils, or an iron chain to a broken mooring stump.
    name: 'anchor', R: 3.0, where: 'ground', trail: 'drag',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.8, 2.0, 0);
      // the shank, the arms and their flukes (iron); the stock across the head (wood, light); the ring (gold)
      P.p('iron', S.log(0.09, 2.5, 8), 0, 0, 0, 0);
      P.p('iron', S.k('arms', () => S.ring(0.85, 0.09, Math.PI).clone().rotateY(-Math.PI / 2)), -1.1, 0, 0);
      for (const s of [-1, 1]) P.p('iron', S.k('fluke', () => new THREE.ConeGeometry(0.3, 0.5, 4).rotateX(Math.PI / 2).scale(1, 0.25, 1).translate(0, 0.08, 0)), -1.1, 0, s * 0.85, s > 0 ? 0 : Math.PI);
      P.p('plank', S.box(0.24, 0.24, 2.6), 1.0, 0, 0).p('gold', S.box(0.26, 0.04, 0.26), 1.0, 0.1, -1.18).p('gold', S.box(0.26, 0.04, 0.26), 1.0, 0.1, 1.18);
      P.p('gold', S.ring(0.26, 0.05), 1.48, 0.0, 0);
      let x = 1.72, z = 0;
      const chain = r() < 0.5;
      for (let k = 0; k < 5; k++) { const a = 0.35 * Math.sin(k * 0.9) + 0.2; const nx = x + Math.cos(a) * 0.4, nz = z - Math.sin(a) * 0.4; P.p(chain ? 'iron' : 'rope', S.log(chain ? 0.045 : 0.07, 0.42, 5), (x + nx) / 2, 0, (z + nz) / 2, a); x = nx; z = nz; }
      if (chain) {
        P.p('wood', S.cyl(0.24, 0.28, 0.4, 12), x + 0.35, 0, z - 0.1).p('gold', S.ring(0.25, 0.025), x + 0.35, 0.32, z - 0.1);
        for (let k = 0; k < 4; k++) P.p('wood', S.box(0.08, 0.04, 0.5), x + 0.35 + Math.cos(k * 1.7) * 0.6, 0, z - 0.1 + Math.sin(k * 1.7) * 0.6, k * 1.7);
      } else {
        coil(S, P, x + 0.6, z - 0.1, 2.2);
        P.p('rope', S.ring(0.36, 0.07), x + 0.6, 0.14, z - 0.1);
      }
      shells(S, P, r, 0.2, -0.8, 4, 0.8);
    },
    echo: (S, P, r) => { for (let k = 0; k < 3; k++) P.p('iron', S.log(0.045, 0.42, 5), k * 0.38, 0, 0.1 * Math.sin(k), 0.2 * k); },
  },
  {
    // Flotsam from a wreck washed up: her sail torn off its yard, the hatch cover, a broken cask and its staves, weed. Two ways: the sail
    // and the yard, or her wheel with its gilt hub, a length of her rail and the cargo's crates.
    name: 'flotsam', R: 2.9, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.8, 2.4, 0).m('wet', -0.5, 0.5, 2.0, 1.4, 0.5);
      if (r() < 0.5) {
        P.p('canvas', S.k('tornsail', () => {
          const sh = new THREE.Shape([new THREE.Vector2(-1.7, -1.1), new THREE.Vector2(1.6, -1.2), new THREE.Vector2(1.9, 0.2), new THREE.Vector2(1.0, 1.1), new THREE.Vector2(0.3, 0.6), new THREE.Vector2(-0.6, 1.2), new THREE.Vector2(-1.8, 0.9)]);
          return new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2).translate(0, 0.03, 0);
        }), -0.3, 0, 0.4, 0.2);
        P.p('wood', S.log(0.08, 4.4, 8), -0.2, 0, -1.0, 0.18).p('gold', S.k('yardend', () => S.cyl(0.09, 0.09, 0.08, 8).clone().rotateZ(Math.PI / 2).translate(0, 0.08, 0)), 1.95, 0, -1.4, 0.18);
        P.p('rope', S.log(0.025, 1.6, 4), 1.4, 0, 0.6, 1.1).p('rope', S.log(0.025, 1.3, 4), -1.9, 0, 0.0, 1.9);
      } else {
        // the wheel: a rim, eight spokes with their handles, the gilt hub
        P.p('wood', S.ring(0.75, 0.06), -0.6, 0, 0.3).p('gold', S.cyl(0.16, 0.16, 0.14, 10), -0.6, 0, 0.3);
        for (let k = 0; k < 4; k++) P.p('plank', S.log(0.035, 1.9, 5), -0.6, 0.04, 0.3, k * (Math.PI / 4));
        // the rail: its rail, its posts lying
        P.p('plank', S.box(3.2, 0.08, 0.14), 0.6, 0, -1.3, -0.1);
        for (let k = 0; k < 5; k++) P.p('wood', S.box(0.08, 0.08, 0.55), -0.6 + k * 0.6, 0, -1.0 + k * 0.03, -0.1);
        crate(S, P, 1.5, 0.6, 0.7, true);
        crate(S, P, 0.9, 1.6, -0.3, false);
      }
      P.p('plank', S.box(1.1, 0.06, 1.1), -1.5, 0, -0.3, 0.3).p('gold', S.box(1.14, 0.03, 0.05), -1.5, 0.06, -0.3, 0.3);
      P.p('wood', S.log(0.2, 0.3, 12), 1.5, 0, -0.4, 1.1);
      for (let k = 0; k < 5; k++) P.p('plank', S.box(0.1, 0.03, 0.62), 1.9 + k * 0.14, 0, 0.3 + (r() - 0.5) * 0.4, 0.4 + (r() - 0.5) * 0.9);
      for (let k = 0; k < 4; k++) P.p('leaf', S.box(0.08, 0.02, 0.9), (r() - 0.5) * 3, 0, (r() - 0.5) * 2.4, r() * 6);
      shells(S, P, r, 0.2, 0.3, 4, 1.2);
    },
    echo: (S, P, r) => { P.p('plank', S.box(0.14, 0.04, 1.3), 0, 0, 0, r() * 3).p('plank', S.box(0.14, 0.04, 1.0), 0.4, 0, 0.3, r() * 3); P.p('leaf', S.box(0.08, 0.02, 0.8), -0.3, 0, 0.4, r() * 6); },
  },
  {
    // Where they remember the drowned: a cairn of flat stones, the oars of the lost laid round it like rays, wreaths, candles on gilt
    // dishes, a ring of stones. Two ways: the oars round it, or a broken bow of their boat laid before it with its name-board blank.
    name: 'memorial', R: 3.1, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 3.0, 2.8, 0);
      P.p('stone', S.box(1.1, 0.14, 0.86), 0, 0, 0, 0.2).p('capstone', S.box(0.82, 0.12, 0.62), 0, 0.14, 0, -0.1).p('stone', S.box(0.55, 0.1, 0.42), 0, 0.26, 0, 0.3).p('wine', S.box(0.4, 0.03, 0.66), 0, 0.36, 0, 0.5);
      if (r() < 0.55) {
        const n = 6 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * 6.28 + 0.3, c = Math.cos(a), s = Math.sin(a);
          P.p('plank', S.log(0.04, 1.9, 6), c * 1.45, 0, -s * 1.45, a).p('teal', S.box(0.7, 0.03, 0.22), c * 2.7, 0, -s * 2.7, a).p('gold', S.box(0.04, 0.035, 0.23), c * 2.33, 0, -s * 2.33, a);
        }
      } else {
        P.p('teal', S.k('bow', () => {
          const sh = new THREE.Shape([new THREE.Vector2(-0.8, 0), new THREE.Vector2(0.8, 0), new THREE.Vector2(0.55, 0.9), new THREE.Vector2(0, 1.5), new THREE.Vector2(-0.55, 0.9)]);
          return new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.12, 0);
        }), 0, 0, 0.75, Math.PI, 0, 1.5, 1, 1.5).p('gold', S.box(2.4, 0.05, 0.08), 0, 0.12, 0.8);
        P.p('cloth', S.box(0.8, 0.04, 0.26), 0, 0.12, 1.7);
      }
      P.p('leaf', S.ring(0.3, 0.06), -0.8, 0, 0.35).p('leaf', S.ring(0.26, 0.055), 0.8, 0, -0.5);
      for (let k = 0; k < 5; k++) { const a = k * 1.25; P.p('wine', S.ball(0.045), -0.8 + Math.cos(a) * 0.3, 0.06, 0.35 + Math.sin(a) * 0.3); }
      for (const [cx, cz, h] of [[0.6, 0.45, 0.18], [0.75, 0.15, 0.13], [-0.45, -0.55, 0.15], [-0.65, -0.3, 0.12]] as const) P.p('gold', S.disc(0.07, 0.015), cx, 0, cz).p('cream', S.cyl(0.03, 0.03, h, 6), cx, 0.015, cz);
      for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.28; P.p('stone', S.stone(0.15), Math.cos(a) * 3.2, 0, Math.sin(a) * 3.0, r() * 6); }
      shells(S, P, r, 0, 0.1, 6, 1.0);
    },
  },
  {
    // A fight's aftermath: the banner they fought for down in the grass, a shield split in two, a cutlass, a pike, a helmet, arrows standing
    // in the ground. Two ways: the banner, or their shield wall broken (shields in a row, the drum on its side).
    name: 'fight', R: 2.9, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 3.0, 2.5, 0.3).m('patch', 1.0, -0.6, 1.6, 1.2, 0);
      const half = (a: number) => S.k(`half${a}`, () => new THREE.CylinderGeometry(0.4, 0.4, 0.04, 14, 1, false, a, Math.PI).translate(0, 0.02, 0));
      P.p('wine', half(0), -0.6, 0, -0.2, 0.3).p('wine', half(Math.PI), -0.35, 0, 0.25, 0.9).p('gold', S.ring(0.4, 0.022, Math.PI), -0.6, 0.01, -0.2, 0.3);
      P.p('salt', S.box(0.9, 0.012, 0.06), 0.6, 0.01, 0.6, 0.4).p('gold', S.box(0.04, 0.03, 0.2), 1.06, 0, 0.42, 0.4);
      P.p('lacquer', S.k('helm', () => new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), -1.4, 0.04, 0.9, 0, 1.3).p('gold', S.ring(0.17, 0.018), -1.4, 0.0, 0.9, 0, 1.3);
      if (r() < 0.55) {
        // the banner, down: its pole, its finial, the cloth with a gilt hem
        P.p('wood', S.log(0.045, 4.0, 7), 0.3, 0, -1.4, 0.25).p('gold', S.ball(0.09), 2.25, 0, -1.9);
        P.p('wine', S.box(1.4, 0.03, 2.0), -1.15, 0, -1.6, 0.25 + Math.PI / 2).p('gold', S.box(1.4, 0.035, 0.06), -1.15 - Math.sin(0.25) * 0.0, 0, -2.6, 0.25 + Math.PI / 2).p('cream', S.box(0.5, 0.032, 0.5), -1.2, 0, -1.6, 0.25 + Math.PI / 4);
        P.p('wood', S.log(0.03, 2.6, 6), 0.1, 0, 1.4, -0.15).p('iron', S.k('pikehead', () => S.cyl(0.05, 0.0, 0.3, 6).clone().rotateZ(-Math.PI / 2).translate(0, 0.03, 0)), 1.43, 0, 1.2, -0.15);
      } else {
        // the shield wall, broken: shields fallen in a row, the drum on its side with its sticks
        const cols: Key[] = ['wine', 'teal', 'wine', 'teal'];
        for (let k = 0; k < 4; k++) shield(S, P, -1.6 + k * 0.85, -1.5 + (r() - 0.5) * 0.4, cols[(k + Math.floor(r() * 2)) % 4], 0.42);
        P.p('wine', S.log(0.36, 0.5, 14), 1.7, 0, -0.4, 0.9).p('gold', S.k('drumrim', () => S.ring(0.37, 0.03).clone().rotateZ(Math.PI / 2).translate(0, 0.36, 0)), 1.7 + Math.cos(0.9) * 0.24, 0, -0.4 - Math.sin(0.9) * 0.24, 0.9).p('cream', S.k('drumhead', () => S.disc(0.34, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.36, 0)), 1.7 - Math.cos(0.9) * 0.26, 0, -0.4 + Math.sin(0.9) * 0.26, 0.9);
        for (const s of [0, 0.4]) P.p('wood', S.log(0.02, 0.45, 4), 2.3 + s * 0.3, 0, 0.3 + s, 1.0 + s);
      }
      arrows(S, P, r, 0, 0, 4.4, 3.6, 10 + Math.floor(r() * 9));
    },
    echo: (S, P, r) => { arrows(S, P, r, 0, 0, 1.4, 1.0, 4 + Math.floor(r() * 3)); },
  },
  {
    // Smugglers surprised: their tarpaulin thrown back off the crates, one broken open, bottles rolled out, a dropped lantern, a spade by a
    // hole half dug (the second way: barrels instead of crates, one broached).
    name: 'smugglers', R: 2.6, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.6, 2.2, 0).m('stain', 1.3, -1.1, 0.9, 0.7, 0.3);
      P.p('teal', S.box(2.6, 0.03, 1.9), -0.6, 0, 1.2, 0.2).p('gold', S.box(2.6, 0.035, 0.06), -0.6 + Math.sin(0.2) * 0.95, 0, 1.2 + Math.cos(0.2) * 0.95, 0.2);
      if (r() < 0.5) {
        crate(S, P, -0.4, -0.2, 0.3, true);
        crate(S, P, 0.45, -0.6, -0.4, false);
        if (r() < 0.6) crate(S, P, -1.3, -0.9, 1.1, false);
      } else {
        barrelDown(S, P, -0.5, -0.3, 0.4);
        barrelDown(S, P, 0.3, -0.9, -0.2);
        P.p('lacquer', S.disc(0.4, 0.012), -0.9, 0, -0.1, 0, 0, 1.4, 1, 1);
      }
      for (let k = 0; k < 4 + Math.floor(r() * 4); k++) { const a = 0.3 + r() * 1.6, d = 0.55 + r() * 0.9; P.p('teal', S.log(0.045, 0.24, 7), -0.4 + Math.cos(a) * d, 0, -0.2 + Math.sin(a) * d, r() * 6); }
      P.p('lacquer', S.k('lanternside', () => S.box(0.22, 0.3, 0.22).clone().rotateZ(Math.PI / 2).translate(0.15, -0.04, 0)), 0.9, 0.1, 0.5, 2.3);
      // the spade by the hole
      P.p('wood', S.log(0.025, 1.2, 5), 1.9, 0, -0.5, 2.0).p('iron', S.box(0.24, 0.02, 0.3), 1.6, 0, -1.0, 2.0);
      P.p('rope', S.ball(0.3, 0.6), 0.1, 0, 1.4, 0, 0, 1.3, 1, 1);
      coil(S, P, -1.6, 0.4);
    },
    echo: (S, P, r) => { crate(S, P, 0, 0, r() * 6, r() < 0.5); },
  },
  {
    // A cart tipped off the road: its tray upside down in its ruts, a wheel off, the tarp thrown, its load spilled. Three loads: fish and
    // baskets, barrels and crates, or sacks of grain split open in a pale fan.
    name: 'cart', R: 3.1, where: 'ground', trail: 'ruts',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 3.0, 2.4, 0.1);
      P.p('plank', S.box(2.4, 0.34, 1.3), 0, 0, 0, 0.1).p('gold', S.box(2.44, 0.04, 1.34), 0, 0.02, 0, 0.1);
      P.p('teal', S.box(2.2, 0.025, 1.6), 0.3, 0, -1.8, -0.3).p('gold', S.box(2.2, 0.03, 0.06), 0.3 - Math.sin(-0.3) * 0.0, 0, -1.0, -0.3);
      for (const s of [-0.45, 0.45]) P.p('wood', S.log(0.04, 1.4, 6), 1.8, 0, s, 0.1 + 0.1 * s);
      wheelFlat(S, P, -0.6, 1.4);
      if (r() < 0.6) wheelFlat(S, P, 1.3, -1.6);
      const load = r();
      if (load < 0.34) {
        basketDown(S, P, -1.6, -0.5, 2.8);
        fishFan(S, P, r, -1.8, -0.5, 3.0, 7 + Math.floor(r() * 5));
        crate(S, P, 0.9, 1.5, 0.8, r() < 0.5);
      } else if (load < 0.67) {
        barrelDown(S, P, -1.7, -0.3, 2.0);
        barrelDown(S, P, -1.2, 0.9, 0.7);
        crate(S, P, 1.0, 1.5, 0.8, true);
        crate(S, P, -2.2, 0.6, 0.2, false);
      } else {
        P.m('spill', -1.8, 0.3, 1.5, 0.9, 0.3);
        for (let k = 0; k < 4; k++) P.p(k % 2 ? 'cloth' : 'rope', S.ball(0.32, 0.5), -1.2 - k * 0.45, 0, -0.4 + (r() - 0.5) * 1.2, r() * 3, 0, 1.4, 1, 1);
        P.p('cream', S.k('grainheap', () => new THREE.ConeGeometry(0.7, 0.18, 10).translate(0, 0.09, 0)), -2.1, 0, 0.4, 0, 0, 1.3, 1, 0.8);
      }
    },
    echo: (S, P, r) => { r() < 0.5 ? crate(S, P, 0, 0, r() * 6, true) : wheelFlat(S, P, 0, 0, 0.5); },
  },
  {
    // The salt barrow tipped: its tray on its side, the salt spilled in a heap and a white fan, the rake dropped beside it.
    name: 'barrow', R: 2.3, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.2, 1.8, 0).m('spill', 0.9, 0, 1.8, 1.2, 0);
      P.p('plank', S.box(0.32, 0.4, 1.2), 0, 0, 0, 0.2).p('gold', S.box(0.34, 0.03, 1.22), 0, 0.37, 0, 0.2);
      P.p('wood', S.ring(0.28, 0.045), -0.35, 0, 0.9, 0.2);
      for (const s of [-0.25, 0.25]) P.p('wood', S.log(0.03, 1.1, 6), 0.05, 0, -0.95 + s * 0.1, 1.77 + s);
      P.p('salt', S.k('saltheap', () => new THREE.ConeGeometry(0.6, 0.26, 12).translate(0, 0.13, 0)), 0.9, 0, -0.05, 0, 0, 1.8, 1, 1.2);
      P.p('wood', S.log(0.022, 2.0, 5), -0.7, 0, 1.1, 0.6).p('iron', S.box(0.05, 0.03, 0.55), -1.5, 0, 1.7, 0.6);
      if (r() < 0.6) basket(S, P, 1.4, 1.3, 0.28);
    },
  },
  {
    // A catch put out to dry: split fish laid in rows on a sailcloth, a low rack of poles with more on it knocked flat, the salt sack,
    // the baskets they came in.
    name: 'drying', R: 3.0, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 3.0, 2.2, 0).m('spill', 1.6, 0.9, 0.8, 0.6, 0);
      P.p('canvas', S.box(3.6, 0.025, 1.6), -0.3, 0, -0.3, 0.05).p('gold', S.box(3.6, 0.03, 0.05), -0.3, 0, 0.5, 0.05);
      for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) P.p(row === 1 ? 'cloth' : 'slate', S.k('split', () => new THREE.SphereGeometry(1, 6, 3).scale(0.22, 0.03, 0.1).translate(0, 0.055, 0)), -1.8 + k * 0.6 + (row % 2) * 0.15, 0, -0.85 + row * 0.5, 1.57 + (r() - 0.5) * 0.3);
      // the rack, knocked flat: two long poles and the cross-sticks, fish still on it
      P.p('wood', S.log(0.04, 3.4, 6), -0.2, 0, 1.4, -0.08).p('wood', S.log(0.04, 3.4, 6), -0.3, 0, 1.9, -0.05);
      for (let k = 0; k < 5; k++) P.p('wood', S.box(0.06, 0.05, 0.75), -1.6 + k * 0.7, 0.03, 1.65, -0.07);
      for (let k = 0; k < 5; k++) P.p('slate', S.fish(), -1.4 + k * 0.6, 0.06, 1.65 + (r() - 0.5) * 0.3, 1.57 + (r() - 0.5) * 0.4);
      P.p('cloth', S.ball(0.3, 0.6), 1.9, 0, 1.0, 0, 0, 1.2, 1, 1).p('rope', S.cyl(0.05, 0.05, 0.06, 8), 1.9, 0.34, 1.0);
      basket(S, P, 2.1, -0.4, 0.28);
      basketDown(S, P, -2.4, 0.7, 2.0);
    },
    echo: (S, P, r) => { fishFan(S, P, r, 0, 0, r() * 6, 4, 0.7); },
  },
  // --- past the outline: the beach and the sea ---
  {
    // A rowing boat hauled up on the sand, oars beside it, its little mast down with the sail half off it.
    name: 'rowboat', R: 3.4, where: 'beach', wet: true,
    make: (S, P, r) => {
      const paint = pick(r, ['teal', 'wine', 'teal'] as Key[]);
      P.p(paint, S.hull(4, 1.5, 0.55), 0, 0, 0, 0, 0, 1, 1, 1);
      P.p('gold', S.gunwale(4, 1.5), 0, 0.55, 0);
      for (const s of [-0.7, 0.5]) P.p('plank', S.box(1.3, 0.05, 0.2), 0, 0.42, s);
      P.p('plank', S.log(0.035, 2.4, 6), 1.2, 0, -0.4, Math.PI / 2 + 0.15).p('plank', S.box(0.14, 0.03, 0.55), 1.32, 0, 0.75, 0.15);
      P.p('plank', S.log(0.035, 2.4, 6), 0.4, 0.5, 0.2, Math.PI / 2 - 0.1, 0.15);
      P.p('wood', S.log(0.05, 3.0, 7), -1.3, 0, 0.6, Math.PI / 2 + 0.25).p('canvas', S.sail(2.6, 1.5), -1.25, 0, 1.9, -Math.PI / 2 - 0.25);
      if (r() < 0.6) coil(S, P, 1.1, 1.8);
    },
  },
  {
    // A boat upside down on two trestles, being caulked: the tar pot on its little fire, the bucket, the mallet, oakum in hanks, planks.
    name: 'caulk', R: 3.4, where: 'beach', wet: true,
    make: (S, P, r) => {
      const paint = pick(r, ['teal', 'wine'] as Key[]);
      for (const s of [-1.1, 1.1]) {
        P.p('wood', S.box(1.9, 0.12, 0.14), 0, 0.85, s);
        for (const q of [-0.75, 0.75]) P.p('wood', S.cyl(0.05, 0.06, 0.9, 6), q, 0, s);
      }
      P.p(paint, S.upturned(4.4, 1.6, 0.6), 0, 0.97, 0).p('gold', S.gunwale(4.4, 1.6), 0, 0.97, 0).p('lacquer', S.box(0.12, 0.12, 4.2), 0, 1.53, 0);
      P.p('lacquer', S.k('tarstreak', () => new THREE.SphereGeometry(1, 12, 4, 0, Math.PI * 2, 0, 0.5).scale(0.81, 0.61, 2.21)), 0, 0.97, 0);
      // the tar pot on its stones, the bucket, the mallet, the oakum
      for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28; P.p('stone', S.stone(0.12), 1.6 + Math.cos(a) * 0.32, 0, 1.5 + Math.sin(a) * 0.32); }
      P.p('lacquer', S.cyl(0.2, 0.17, 0.3, 10), 1.6, 0.1, 1.5).p('gold', S.ring(0.2, 0.02), 1.6, 0.38, 1.5).p('wood', S.log(0.02, 0.8, 4), 1.6, 0.4, 1.5, 0.6, 0.6);
      P.p('plank', S.cyl(0.16, 0.13, 0.3, 10), -1.7, 0, 1.3).p('gold', S.ring(0.16, 0.015), -1.7, 0.28, 1.3);
      P.p('wood', S.log(0.06, 0.25, 8), -1.2, 0, 1.8, 0.4).p('wood', S.log(0.02, 0.5, 4), -1.0, 0, 1.6, 2.0);
      for (let k = 0; k < 3; k++) P.p('rope', S.log(0.07, 0.4, 6), 0.5 + k * 0.3, 0, 1.7 + k * 0.1, 0.3 * k);
      for (let k = 0; k < 2; k++) P.p('plank', S.box(0.25, 0.05, 2.6), -1.8 - k * 0.3, 0, -0.5, 0.05 * k);
    },
  },
  {
    // A fish rack on the beach: two A-frames, the pole across, split fish hung along it, one end fallen and its fish in the sand.
    name: 'fishrack', R: 2.8, where: 'beach', wet: true,
    make: (S, P, r) => {
      for (const s of [-1.5, 1.5]) for (const q of [-1, 1]) P.p('wood', S.cyl(0.05, 0.06, 1.95, 6), s, 0, q * 0.35, 0, q * 0.2);
      P.p('wood', S.log(0.05, 3.4, 7), 0, 1.75, 0).p('gold', S.ball(0.07), 1.72, 1.8, 0).p('gold', S.ball(0.07), -1.72, 1.8, 0);
      for (let k = 0; k < 9; k++) {
        const x = -1.3 + k * 0.32;
        P.p('rope', S.log(0.008, 0.3, 3), x, 1.6, 0, 0, 0, 1, 1, 1).p(k % 3 === 1 ? 'cloth' : 'slate', S.k('hangfish', () => new THREE.SphereGeometry(1, 6, 4).scale(0.07, 0.22, 0.035).translate(0, -0.22, 0)), x, 1.55, 0);
      }
      fishFan(S, P, r, 1.4, 0.8, -0.6, 5, 0.7);
      basket(S, P, -1.2, 1.0, 0.32);
      P.p('cloth', S.ball(0.3, 0.6), 0.2, 0, 1.2, 0, 0, 1.2, 1, 1);
    },
  },
  {
    // A cart stuck at the tide line: sunk to its hubs in the wet sand, its shafts in the air, its load of weed and a barrel.
    name: 'tidecart', R: 3.0, where: 'beach', wet: true,
    make: (S, P, r) => {
      P.p('plank', S.box(2.4, 0.5, 1.4), 0, 0.15, 0, 0, -0.12).p('gold', S.box(2.44, 0.05, 1.44), 0, 0.62, 0, 0, -0.12);
      for (const s of [-0.8, 0.8]) P.p('wood', S.k('wheelup', () => S.ring(0.6, 0.06).clone().rotateX(Math.PI / 2)), 0.1, -0.15, s).p('gold', S.k('hubup', () => S.cyl(0.1, 0.1, 0.16, 8).clone().rotateX(Math.PI / 2)), 0.1, 0.45, s);
      for (const s of [-0.5, 0.5]) P.p('wood', S.cyl(0.045, 0.05, 2.4, 6), 1.3, 0.35, s, Math.PI / 2, 0.75);
      P.p('leaf', S.ball(0.6, 0.45), -0.3, 0.6, 0.1, 0, 0, 1.4, 1, 1).p('leaf', S.ball(0.4, 0.5), 0.5, 0.6, -0.2);
      barrelUp(S, P, -1.6, 0, 0.9);
      P.p('leaf', S.box(0.1, 0.02, 1.0), -1.2, 0, -1.2, 0.6).p('leaf', S.box(0.1, 0.02, 0.8), 1.5, 0, 1.1, 2.1);
    },
  },
  {
    // A mooring post with its rope parted, the frayed end trailing; the boat's anchor fast in the sand, its fluke up.
    name: 'mooring', R: 2.4, where: 'beach', wet: true,
    make: (S, P, r) => {
      P.p('wood', S.cyl(0.3, 0.34, 2.3, 12), 0, 0, 0).p('wine', S.cyl(0.31, 0.31, 0.35, 12), 0, 1.5, 0).p('gold', S.cyl(0.32, 0.32, 0.07, 12), 0, 1.85, 0).p('gold', S.cyl(0.32, 0.32, 0.07, 12), 0, 1.45, 0).p('wood', S.cyl(0.32, 0.29, 0.1, 12), 0, 2.3, 0);
      P.p('rope', S.ring(0.36, 0.07), 0, 1.1, 0).p('rope', S.ring(0.36, 0.07), 0, 0.95, 0);
      let x = 0.35, z = 0.05;
      for (let k = 0; k < 6; k++) { const a = -0.3 + 0.3 * Math.sin(k); const nx = x + Math.cos(a) * 0.45, nz = z - Math.sin(a) * 0.45; P.p('rope', S.log(0.06, 0.47, 5), (x + nx) / 2, 0, (z + nz) / 2, a); x = nx; z = nz; }
      for (let k = 0; k < 4; k++) P.p('rope', S.log(0.02, 0.3, 4), x + 0.12, 0, z + (k - 1.5) * 0.08, -0.4 + k * 0.25);
      // the anchor, stood fluke-down in the sand, leaning: iron, its stock in light wood
      P.p('iron', S.cyl(0.08, 0.08, 1.7, 8), -1.2, -0.2, 1.0, 0.4, 0.35).p('plank', S.box(1.3, 0.16, 0.16), -1.2 + Math.sin(0.4) * 0.5, 1.3, 1.0 + Math.cos(0.4) * 0.5, 0.4 + Math.PI / 2);
      P.p('iron', S.k('mooranch', () => S.ring(0.55, 0.08, Math.PI).clone().rotateX(Math.PI / 2).rotateY(Math.PI / 2)), -1.2, -0.05, 1.0, 0.4);
      P.p('gold', S.k('mooring', () => S.ring(0.15, 0.03).clone().rotateX(Math.PI / 2)), -1.2 + Math.sin(0.4) * 0.62, 1.55, 1.0 + Math.cos(0.4) * 0.62, 0.4);
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

/** Which kinds suit a place's kind (one or two are put near such a place, outside its stand). */
const BY_PLACE: Record<string, string[]> = {
  market: ['stall', 'cart', 'drying'], village: ['washing', 'fire', 'drying'], lighthouse: ['barrels'], beacon: ['barrels', 'fire'], wreck: ['flotsam', 'anchor'],
  shipyard: ['anchor', 'nets'], chapel: ['memorial'], fort: ['fight'], caves: ['smugglers'], saltworks: ['barrow', 'drying'],
};
/** Kinds for the roads' verges and the open ground. */
const ROADSIDE = ['cart', 'fire', 'nets', 'pots', 'fight', 'flotsam', 'anchor', 'washing', 'barrels', 'stall', 'memorial', 'drying', 'smugglers'];

export { scenesOff };

/** A ground mark in world space, painted into the land's map (scenes/sea.ts `paintGround`). */
type WMark = { t: MarkT; x: number; z: number; a: number; b: number; rot: number };

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
  const marks: WMark[] = [];
  const lines: { x1: number; z1: number; x2: number; z2: number; w: number; t: 'rut' | 'furrow' }[] = [];
  const kinds = new Map(KINDS.map((k) => [k.name, k]));
  // How many of each kind this floor may have (so floors differ): 1 to 4 on the ground, the beach's 1 or 2.
  const cap = new Map<string, number>();
  for (const k of KINDS) cap.set(k.name, k.where === 'ground' ? 2 + Math.floor(rnd() * 2.6) + (rnd() < 0.4 ? 1 : 0) : k.where === 'beach' ? 1 + Math.floor(rnd() * 2) : 1);
  const used = new Map<string, number>();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), corner = new THREE.Vector3();

  /**
   * Where each part of a scene at (x, z) turned `yaw` (mirrored or not) stands: its middle on the ground, a circle round it and its top
   * (above its own ground), worked out from its shape's box without building it (a tilted part is given room for its lean). A ground
   * scene is drawn `GROUND_SCALE` larger, and a part that this lifts over the knee is drawn lower instead (`sy`).
   */
  type Laid = { p: Part; wx: number; wz: number; wyaw: number; ground: number; cx: number; cz: number; r: number; top: number; k: number; sy: number; area: number };
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
      const w = (bb.max.x - bb.min.x) * sx, d = (bb.max.z - bb.min.z) * sz;
      const r = Math.hypot(w, d) / 2 + lean * Math.max(Math.abs(bb.min.y), Math.abs(bb.max.y)) * sy;
      const L: Laid = { p, wx, wz, wyaw, ground, cx: wx + cy * ox + sy2 * oz, cz: wz - sy2 * ox + cy * oz, r, top, k, sy, area: w * d };
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
  /** The props near (x, z): everything within `NEAR` m of it at least (all of them for a scene wider than that). */
  const propsNear = (x: number, z: number, reachM: number) => {
    const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL);
    if (reachM + 3 <= NEAR) return cells.get(cellKey(i0, j0)) ?? [];
    // a wider scene: the squares round it (a thing may be listed twice; the checks only ask "any")
    const n = Math.ceil((reachM + 3 - NEAR) / CELL), out: { x: number; z: number; r: number; m: number }[] = [];
    for (let i = i0 - n; i <= i0 + n; i++) for (let j = j0 - n; j <= j0 + n; j++) { const c = cells.get(cellKey(i, j)); if (c) for (const t of c) out.push(t); }
    return out;
  };

  /** In a tidal flat as it is drawn (land.ts: an ellipse turned `rot`, wet out to `rx + 2`), with `pad` m more. */
  const inFlat = (x: number, z: number, pad: number) => spec.flats.some((f) => {
    const c = Math.cos(f.rot ?? 0), s2 = Math.sin(f.rot ?? 0), dx = x - f.x, dz = z - f.z, u = dx * c + dz * s2, w = -dx * s2 + dz * c, R = f.rx + 2;
    return Math.hypot(u / (R + pad), w / (R * (f.rz / f.rx) + pad)) < 1;
  });
  const roadDist = (x: number, z: number) => { let d = 1e9; for (const s of roads) d = Math.min(d, segDist(x, z, s.ax, s.az, s.bx, s.bz)); return d; };
  /** Is every part clear? Walkable scenes: low, inside the outline, off roads, cover, spots, places, flats, the depth's props. */
  const partCheck = (k: { where: Kind['where']; wet?: boolean }, x: number, z: number, R: number) => {
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
    if (k.where === 'beach' && !k.wet) {
      let lo = 1e9, hi = -1e9;
      for (const L of laid) { lo = Math.min(lo, L.ground); hi = Math.max(hi, L.ground); }
      if (hi - lo > 0.6) return false;
    }
    return true;
  };

  /** The cheap tests on a scene's middle alone, before its parts are made: spacing, the outline, a spot, a road, the cover, a place. */
  const roughly = (k: Kind, x: number, z: number, R = reach(k)) => {
    // the cheapest first; a spot or a road under the scene's middle part fails it whatever its turn
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + R + (p.echo ? 0.6 : 1.5))) return false;
    const inner = k.where === 'ground' ? R * 0.35 : 0;
    if (keep.some((s) => Math.hypot(s.x - x, s.z - z) < 3.2 + inner)) return false;
    if (spec.places.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 0.8 + inner)) return false;
    if (roads.some((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 2.2 + inner * 0.6)) return false;
    if (o.cover.some((c) => segDist(x, z, c.ax, c.az, c.bx, c.bz) < c.r + 0.4)) return false;
    const b = geo.beyond(x - RING.x, z - RING.z);
    if (k.where === 'ground' ? b > -1.2 - inner : k.where === 'beach' ? b < 1.4 || b > 16 : b < 16) return false;
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
  /** Writes laid parts into the dressing (one geometry a colour) and records them; returns the record. */
  const commit = (name: string, laid: Laid[], px: number, pz: number, beyond: boolean, echo: boolean) => {
    const pts: [number, number][] = [];
    let top = 0, main: Laid = laid[0];
    const byKey = new Map<Key, { g: THREE.BufferGeometry; m: THREE.Matrix4 }[]>();
    for (const L of laid) {
      const cn = corners(L), key: Key = L.p.key === 'gold' ? 'brass' : L.p.key;
      let list = byKey.get(key);
      if (!list) byKey.set(key, (list = []));
      list.push({ g: L.p.g, m: m4.clone() });
      pts.push(...cn.pts, [L.cx, L.cz]);
      top = Math.max(top, cn.top);
      if (L.area > main.area) main = L;
    }
    for (const [key, list] of byKey) { const g = bake(list); dress.add(key, g, 0, 0, 0); g.dispose(); }
    let r = 0;
    for (const [qx, qz] of pts) r = Math.max(r, Math.hypot(qx - px, qz - pz));
    const rec: Placed = { kind: name, x: px, z: pz, r, beyond, top: +top.toFixed(2), main: [+main.cx.toFixed(2), +main.cz.toFixed(2)], pts: pts.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]) };
    if (echo) rec.echo = true;
    placed.push(rec);
    return rec;
  };
  /** The scene's ground marks, from its own frame to the world. */
  const markOut = (P: Parts, x: number, z: number, yaw: number, mir: number, k: number) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const g of P.marks) {
      const lx = g.x * mir * k, lz = g.z * k;
      marks.push({ t: g.t, x: x + c * lx + s * lz, z: z - s * lx + c * lz, a: g.a * k, b: g.b * k, rot: yaw + g.rot * mir });
    }
  };
  /** Tries a kind round (x, z): a few turns and nudges. */
  const tryPut = (name: string, x: number, z: number, jitter: number, faceYaw?: number) => {
    const k = kinds.get(name)!;
    if ((used.get(name) ?? 0) >= (cap.get(name) ?? 0)) return null;
    for (let t = 0; t < 3; t++) {
      const sub = seeded(Math.floor(rnd() * 1e9));
      const px = x + (rnd() - 0.5) * jitter * (t ? 1 : 0), pz = z + (rnd() - 0.5) * jitter * (t ? 1 : 0);
      const yaw = faceYaw !== undefined ? faceYaw + (rnd() - 0.5) * 0.5 : rnd() * Math.PI * 2, mir = rnd() < 0.5 ? 1 : -1;
      if (!roughly(k, px, pz)) continue;
      const P = new Parts();
      k.make(S, P, sub);
      const laid = lay(P, px, pz, yaw, mir, k.where !== 'ground', partCheck(k, px, pz, extent(P, k.where === 'ground' ? GROUND_SCALE : 1)));
      if (!laid || !sceneFits(k, laid)) continue;
      const rec = commit(name, laid, px, pz, k.where !== 'ground', false);
      if (k.where === 'ground') markOut(P, px, pz, yaw, mir, GROUND_SCALE);
      if (k.trail) trail(k.trail, px, pz);
      used.set(name, (used.get(name) ?? 0) + 1);
      return rec;
    }
    return null;
  };
  /** How far a scene's parts reach from its middle (each part's place and its own size), for the checks' short lists. */
  const extent = (P: Parts, k: number) => {
    let R = 0;
    for (const p of P.list) {
      const bb = p.g.boundingBox!;
      R = Math.max(R, (Math.hypot(p.x, p.z) + Math.hypot(Math.max(-bb.min.x, bb.max.x) * p.s[0], Math.max(-bb.min.z, bb.max.z) * p.s[2]) + Math.abs(bb.max.y * Math.sin(p.tilt))) * k);
    }
    return R + 0.5;
  };
  /** A small echo of a kind (a crate fallen off the cart, arrows towards the fight) at (x, z): looks only, low, its own record. */
  const ECHO = { where: 'ground' as const };
  const tryEcho = (name: string, x: number, z: number) => {
    const k = kinds.get(name)!;
    if (!k.echo) return false;
    const P = new Parts();
    k.echo(S, P, seeded(Math.floor(rnd() * 1e9)));
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 2.5)) return false;
    if (geo.beyond(x - RING.x, z - RING.z) > -1.5 || inFlat(x, z, 1.5)) return false;
    const yaw = rnd() * 6.28, laid = lay(P, x, z, yaw, 1, false, partCheck(ECHO, x, z, extent(P, GROUND_SCALE)));
    if (!laid) return false;
    commit(`echo-${name}`, laid, x, z, false, true);
    markOut(P, x, z, yaw, 1, GROUND_SCALE);
    marks.push({ t: 'patch', x, z, a: 1.3, b: 1.0, rot: yaw });
    return true;
  };
  /** Ruts from the nearest road to a cart; the furrow an anchor left, dragged up from the sea. */
  const trail = (t: 'ruts' | 'drag', x: number, z: number) => {
    if (t === 'ruts') {
      let best: Seg | null = null, bd = 16;
      for (const s of roads) { const d = segDist(x, z, s.ax, s.az, s.bx, s.bz); if (d < bd) { bd = d; best = s; } }
      if (!best || bd < 4) return;
      const ex = best.bx - best.ax, ez = best.bz - best.az, l2 = ex * ex + ez * ez, tt = Math.max(0, Math.min(1, ((x - best.ax) * ex + (z - best.az) * ez) / l2));
      const fx = best.ax + ex * tt, fz = best.az + ez * tt, ux = (x - fx) / bd, uz = (z - fz) / bd;
      // from the road's edge, bending a little, to under the cart
      const along = (rnd() - 0.5) * 6, sx = fx + ux * 1.6 - uz * along * 0.4, sz = fz + uz * 1.6 + ux * along * 0.4;
      for (const off of [-0.65, 0.65]) lines.push({ x1: sx - uz * off, z1: sz + ux * off, x2: x - uz * off - ux * 1.2, z2: z + ux * off - uz * 1.2, w: 0.32, t: 'rut' });
    } else {
      // the shortest way out to the sea (or the beach), up to 22 m; the furrow runs from there to the anchor, stopping short of a road
      let best = -1, bd = 1e9;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        for (let d = 3; d < 22; d += 1.5) {
          const bx = x + c * d, bz = z + s * d;
          if (geo.beyond(bx - RING.x, bz - RING.z) > 0.5 || geo.beach(bx - RING.x, bz - RING.z) > 0.6) { if (d < bd) { bd = d; best = a; } break; }
        }
      }
      if (best < 0) return;
      const c = Math.cos(best), s = Math.sin(best);
      let ex = x, ez = z;
      for (let d = 2.4; d < bd + 1; d += 0.75) {
        const bx = x + c * d, bz = z + s * d;
        if (roadDist(bx, bz) < 2.2 || inFlat(bx, bz, 0) || spec.places.some((p) => Math.hypot(p.x - bx, p.z - bz) < p.r + 0.3)) break;
        ex = bx; ez = bz;
      }
      if (Math.hypot(ex - x, ez - z) > 3) lines.push({ x1: ex, z1: ez, x2: x + c * 1.4, z2: z + s * 1.4, w: 0.7, t: 'furrow' });
    }
  };
  const shuffled = <T,>(xs: T[]) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 1. Near the places that suit them: outside the stand (one, or two at a big place).
  for (const p of shuffled(spec.places)) {
    const opts = BY_PLACE[p.kind ?? ''];
    if (!opts) continue;
    for (let n = 0; n < (p.r > 9 ? 2 : 1); n++) {
      const name = pick(rnd, opts), k = kinds.get(name)!;
      cap.set(name, Math.max(cap.get(name) ?? 0, (used.get(name) ?? 0) + 1));
      for (let t = 0; t < 8; t++) {
        const a = rnd() * Math.PI * 2, d = p.r + reach(k) + 1.0 + rnd() * 3;
        if (tryPut(name, p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 1.5)) break;
      }
    }
  }
  // 2. Along the roads: about one every 22 to 34 m, on alternate verges, each a kind from the roadside list; between two, now and then
  //    an echo of the one ahead (what fell off the cart before it went over, arrows towards the fight).
  for (const s of shuffled(roads)) {
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (L < 8) continue;
    const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
    let side = rnd() < 0.5 ? 1 : -1;
    for (let d = 4 + rnd() * 12; d < L - 4; d += 20 + rnd() * 10) {
      side = -side;
      for (const [j, name] of shuffled(ROADSIDE).slice(0, 6).entries()) {
        const k = kinds.get(name)!, off = 2.2 + reach(k) * 0.95 + rnd() * 1.2 + (j % 3) * 1.2, sd = j % 2 ? -side : side;
        const rec = tryPut(name, s.ax + ux * d - uz * sd * off, s.az + uz * d + ux * sd * off, 0.8);
        if (rec) {
          if (k.echo && rnd() < 0.8) for (let t = 0; t < 3; t++) {
            const back = 8 + rnd() * 6, eo = 2.6 + rnd() * 1.4, dd = d - back * (t === 1 ? -1 : 1), se = t === 2 ? -sd : sd;
            if (dd > 2 && dd < L - 2 && tryEcho(name, s.ax + ux * dd - uz * se * eo, s.az + uz * dd + ux * se * eo)) break;
          }
          break;
        }
      }
    }
  }
  // 2b. At the forks (where three roads or more meet), a scene a little off the crossing.
  const ends = new Map<string, { x: number; z: number; n: number }>();
  for (const s of roads) for (const [x, z] of [[s.ax, s.az], [s.bx, s.bz]]) {
    const key = `${Math.round(x)}:${Math.round(z)}`, e0 = ends.get(key);
    if (e0) e0.n++; else ends.set(key, { x, z, n: 1 });
  }
  for (const f of shuffled([...ends.values()].filter((f) => f.n >= 3))) {
    for (let t = 0; t < 4; t++) {
      const a = rnd() * Math.PI * 2, d = 7 + rnd() * 4;
      if (tryPut(pick(rnd, ROADSIDE), f.x + Math.cos(a) * d, f.z + Math.sin(a) * d, 1.5)) break;
    }
  }
  // 3. Round the floor's spots (the quest steps, the waystones, the people), 6 to 10 m off: where players stop.
  for (const sp of shuffled(keep).slice(0, 14)) {
    const name = pick(rnd, ROADSIDE), a = rnd() * Math.PI * 2, d = 6 + rnd() * 4;
    tryPut(name, sp.x + Math.cos(a) * d, sp.z + Math.sin(a) * d, 1.5);
  }
  // 4. The open ground between the places.
  const rmax = Math.max(...spec.rim);
  for (let t = 0, made = 0; t < 140 && made < 7; t++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (geo.beyond(x - RING.x, z - RING.z) > -4) continue;
    if (roads.some((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 9)) continue;
    if (tryPut(pick(rnd, ROADSIDE), x, z, 0)) made++;
  }
  // 5. The beach past the outline, on the sea's side; 6. a wreck far out on the rocks.
  const seaDir = geo.m === 1 ? 0 : Math.PI;
  const beach = KINDS.filter((k) => k.where === 'beach').map((k) => k.name);
  for (let t = 0, made = 0; t < 280 && made < 7; t++) {
    // half the tries on the sea's side, half anywhere round (headlands, the land's side)
    const a = t % 2 ? seaDir + (rnd() - 0.5) * 2.6 : rnd() * Math.PI * 2, rr = rimAt(spec.rim, a), d = rr + 1.8 + rnd() * 4;
    const x = RING.x + Math.cos(a) * d, z = RING.z + Math.sin(a) * d;
    if (tryPut(pick(rnd, beach), x, z, 0.8, Math.atan2(Math.cos(a), Math.sin(a)))) made++;
  }
  for (let t = 0; t < 30; t++) {
    const a = seaDir + (rnd() - 0.5) * 1.6, d = rimAt(spec.rim, a) + 26 + rnd() * 22;
    if (tryPut('capsized', RING.x + Math.cos(a) * d, RING.z + Math.sin(a) * d, 4)) break;
  }
  // The scenes' own ground, painted into the land's map: the trodden patch under each, its stains, the ruts and furrows that lead to it.
  if (o.ground) paintGround(o.ground, marks, lines, { roads, places: spec.places, inFlat, roadDist });
  dispose();
  return placed;
}

/**
 * Paints the scenes' ground into the land's painted middle (land.ts `paint`, about 15 to 18 pixels a metre): soft trodden patches, a
 * scorch under a fire, a dark stain of oil or wet, a pale fan of spilled salt or grain, two wheel ruts, a dragged furrow. Bold shapes
 * only; nothing on the roads' middles, the places' stands or the tidal flats (each patch is shrunk to keep off them).
 */
function paintGround(ground: { map: THREE.Texture; L: number }, marks: WMark[], lines: { x1: number; z1: number; x2: number; z2: number; w: number; t: 'rut' | 'furrow' }[],
  keepOff: { places: { x: number; z: number; r: number }[]; inFlat: (x: number, z: number, pad: number) => boolean; roadDist: (x: number, z: number) => number; roads: Seg[] }) {
  const canvas = ground.map.image as HTMLCanvasElement | undefined;
  const g = canvas?.getContext?.('2d');
  if (!canvas || !g) return;
  const size = canvas.width, ppm = size / ground.L, c = size / 2;
  const X = (x: number) => c + (x - RING.x) * ppm, Z = (z: number) => c + (z - RING.z) * ppm;
  const STYLE: Record<MarkT, [string, number, number]> = {
    // colour, the middle's opacity, where the fade starts (0 to 1 of the radius)
    patch: ['132,106,72', 0.62, 0.5],
    scorch: ['30,26,24', 0.85, 0.5],
    stain: ['22,20,26', 0.72, 0.65],
    wet: ['58,66,66', 0.55, 0.5],
    spill: ['232,222,190', 0.62, 0.55],
  };
  g.save();
  for (const m of marks) {
    if (keepOff.inFlat(m.x, m.z, 0)) continue;
    let k = 1;
    const dr = keepOff.roadDist(m.x, m.z) - 1.4;
    for (const p of keepOff.places) k = Math.min(k, (Math.hypot(p.x - m.x, p.z - m.z) - p.r - 0.2) / Math.max(m.a, m.b));
    k = Math.min(k, dr / Math.max(m.a, m.b));
    if (k < 0.35) continue;
    const a = m.a * k * ppm, b = m.b * k * ppm, [col, op, f] = STYLE[m.t];
    g.setTransform(Math.cos(-m.rot), Math.sin(-m.rot), -Math.sin(-m.rot) * (b / a), Math.cos(-m.rot) * (b / a), X(m.x), Z(m.z));
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, a);
    grad.addColorStop(0, `rgba(${col},${op})`);
    grad.addColorStop(f, `rgba(${col},${op * 0.85})`);
    grad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grad;
    g.fillRect(-a, -a, a * 2, a * 2);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineCap = 'round';
  for (const l of lines) {
    if (l.t === 'furrow') {
      // the ridges of sand pushed up either side, then the furrow
      const nx = -(l.z2 - l.z1), nz = l.x2 - l.x1, n = Math.hypot(nx, nz) || 1, ox = (nx / n) * l.w * 0.75, oz = (nz / n) * l.w * 0.75;
      g.strokeStyle = 'rgba(214,200,160,0.5)';
      g.lineWidth = l.w * 0.45 * ppm;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(l.x1 + ox * s), Z(l.z1 + oz * s)); g.lineTo(X(l.x2 + ox * s), Z(l.z2 + oz * s)); g.stroke(); }
      g.strokeStyle = 'rgba(70,56,40,0.62)';
    } else g.strokeStyle = 'rgba(84,64,42,0.7)';
    g.lineWidth = l.w * ppm;
    g.beginPath(); g.moveTo(X(l.x1), Z(l.z1)); g.lineTo(X(l.x2), Z(l.z2)); g.stroke();
  }
  g.restore();
  ground.map.needsUpdate = true;
}
