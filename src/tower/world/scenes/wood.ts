import * as THREE from 'three';
import { RING, seeded } from '../../../arenas/common';
import type { WoodLook } from '../gen/wood';
import { rimAt } from '../land';

/**
 * Scenes on a Wood floor (floors 11 to 20; the user, 2026-11-14: "lets go through all floors and lets add some depth again, like props on
 * the maps, make actual scenarios and stuff"). The sea's are scenes/sea.ts; these are the Wood's own, made the same way: a small group of
 * props, 3 to 12 m across, that tells at a glance that something happened there. A woodcutter's work left mid-way, a hunter's camp left
 * in a hurry, a cart of logs tipped into the ditch, a hive knocked over and its honey spilled, a mushroom basket dropped, a snapped trap
 * with a torn cloth in its jaws, a wayside offering, a wall half built, a fallen tree with its branches lopped, a picnic cut
 * short, a fight's aftermath; past the edge a woodcutter's yard.
 *
 * **Looks only, never cover.** On the walkable ground a scene is low (nothing above knee height, 0.55 m); the tall one (the yard) stands past
 * the walkable outline, clear of the trees' trunks and with no tree just south of it, never south of the walkable ground. Every part keeps 3 m off the floor's spots (keep.ts),
 * off the trails' middles, the cover, the passes where the roots rise, the places' grounds, the brooks and the depth's own props
 * (woodDepth.ts `solids`); the woodDepth already has woodpiles, upright beehives, fairy rings and the shrine's ribbons, so these are other
 * stories (a hive knocked over, not a hive).
 *
 * Each kind is a list of parts in its own frame from shapes made once a floor, placed turned, mirrored and varied by the floor's own
 * random stream (`seeded(SEED + look.seed)`): the zone's and the depth's streams are untouched, so nothing that was there moves. The parts
 * go into the zone's merged props (woodZone.ts `Props`: one mesh a square of ground whatever the colours; gold its own).
 *
 * `?scenes=off` in the address leaves them out (for before-and-after pictures and A/B timing).
 */

/** The zone's merged props (woodZone.ts `Props`). */
export interface Sink {
  add(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw?: number, sx?: number, sy?: number, sz?: number, tilt?: number): unknown;
}
type Pt = { x: number; z: number };
export interface WoodScenesIn {
  look: WoodLook;
  land: { beyond(dx: number, dz: number): number; height(dx: number, dz: number): number };
  kit: Sink;
  gold: THREE.Material;
  own: { dispose(): void }[];
  keep: Pt[];
  /** The depth's solid props (woodDepth.ts `solids`) and the trees past the edge, with their radii (world). */
  taken: { x: number; z: number; r: number; tree?: boolean }[];
  /** The brooks' lines (world), from the depth. */
  brooks: [number, number][][];
}
/** One placed scene, for the overlap probe (`pipeline/tools/scenes-probe.js`). */
export interface Placed { kind: string; x: number; z: number; r: number; beyond: boolean; top: number; pts: [number, number][] }

const SEED = 7171;
const KNEE = 0.55;
/** The ground scenes are drawn this much larger than life (seen from the game's high camera); never above the knee. */
const GROUND_SCALE = 1.3;

/** The Wood's colours (the heroes' palette, STYLE.md, a shade duller; the Wood's own colour is its moss green). */
const C = {
  bark: '#3c2b1c', barkLight: '#5a4530', plank: '#6b4226', lacquer: '#1d1b21', wine: '#5e1a28', rope: '#b89a5a', stone: '#60645a',
  stoneDark: '#4a4c48', moss: '#55693c', straw: '#a88a4e', teal: '#2b5560', iron: '#3c3f47', ash: '#3a3836', cap: '#8a2e2a',
  stem: '#c9bfa4', cloth: '#7a6e5a', bread: '#9a6a34', green: '#4a6638',
} as const;
type Col = keyof typeof C | 'gold';

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

type Part = { key: Col; g: THREE.BufferGeometry; x: number; y: number; z: number; yaw: number; s: [number, number, number]; tilt: number };
class Parts {
  list: Part[] = [];
  p(key: Col, g: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, tilt = 0, sx = 1, sy = sx, sz = sx) {
    this.list.push({ key, g, x, y, z, yaw, s: [sx, sy, sz], tilt });
    return this;
  }
}

/** The shapes, made once a floor (keyed by name) and disposed when the scenes are in the props (which copy them). */
function shapes() {
  const cache = new Map<string, THREE.BufferGeometry>();
  const of = (name: string, make: () => THREE.BufferGeometry) => {
    let g = cache.get(name);
    if (!g) {
      cache.set(name, (g = make()));
      g.computeBoundingBox();
    }
    return g;
  };
  const S = {
    box: (w: number, h: number, d: number) => of(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0)),
    cyl: (r0: number, r1: number, h: number, n = 10) => of(`cyl${r0},${r1},${h},${n}`, () => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0)),
    /** A round thing lying along x on the ground (a log, a pole). */
    log: (r: number, len: number, n = 9) => of(`log${r},${len},${n}`, () => new THREE.CylinderGeometry(r, r, len, n).rotateZ(Math.PI / 2).translate(0, r, 0)),
    /** A log split along its length: a half lying on its flat side. */
    half: (r: number, len: number) => of(`half${r},${len}`, () => new THREE.CylinderGeometry(r, r, len, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2)),
    ball: (r: number, sy = 1) => of(`ball${r},${sy}`, () => new THREE.SphereGeometry(r, 10, 7).scale(1, sy, 1).translate(0, r * sy, 0)),
    dome: (r: number, sy = 1) => of(`dome${r},${sy}`, () => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, sy, 1)),
    stone: (r: number) => of(`stone${r}`, () => new THREE.IcosahedronGeometry(r, 0).scale(1, 0.62, 1).translate(0, r * 0.45, 0)),
    ring: (r: number, t: number, arc = Math.PI * 2) => of(`ring${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 6, 18, arc).rotateX(Math.PI / 2).translate(0, t, 0)),
    disc: (r: number, h = 0.012) => of(`disc${r},${h}`, () => new THREE.CylinderGeometry(r, r, h, 16).translate(0, h / 2, 0)),
    /** A mushroom: a pale stem and a cap. */
    shroom: (s: number) => of(`shroom${s}`, () => mergeAll([new THREE.CylinderGeometry(0.035 * s, 0.045 * s, 0.12 * s, 6).translate(0, 0.06 * s, 0), new THREE.SphereGeometry(0.09 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.11 * s, 0)])),
    /** Any other shape, made once a floor under its own name. */
    k: (name: string, make: () => THREE.BufferGeometry) => of(name, make),
  };
  const dispose = () => { for (const g of cache.values()) g.dispose(); cache.clear(); };
  return { S, dispose };
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

type Shapes = ReturnType<typeof shapes>['S'];
interface Kind {
  name: string;
  /** Its reach round its middle (m), as made (before the ground scale). */
  R: number;
  /** On the walkable ground (low), or past the outline (tall allowed). */
  where: 'ground' | 'beyond';
  make: (S: Shapes, P: Parts, r: () => number) => void;
}
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const reach = (k: Kind) => k.R * (k.where === 'ground' ? GROUND_SCALE : 1);

// --- little things used by several scenes ----------------------------------------------------------------------------------------
const billet = (S: Shapes, P: Parts, x: number, z: number, yaw: number, light = false) => P.p(light ? 'barkLight' : 'bark', S.log(0.12, 0.7, 7), x, 0, z, yaw).p('straw', S.k('billetEnd', () => S.disc(0.11, 0.01).clone().rotateZ(Math.PI / 2).translate(0, 0.12, 0)), x + Math.cos(yaw) * 0.355, 0, z - Math.sin(yaw) * 0.355, yaw);
const coil = (S: Shapes, P: Parts, x: number, z: number) => P.p('rope', S.ring(0.24, 0.04), x, 0, z).p('rope', S.ring(0.16, 0.04), x, 0.06, z);
const basket = (S: Shapes, P: Parts, x: number, z: number, h = 0.28) => P.p('straw', S.cyl(0.25, 0.2, h), x, 0, z).p('lacquer', S.disc(0.22), x, h - 0.04, z).p('gold', S.ring(0.25, 0.016), x, h - 0.02, z);
const basketDown = (S: Shapes, P: Parts, x: number, z: number, yaw: number) => P.p('straw', S.log(0.2, 0.4, 10), x, 0, z, yaw).p('lacquer', S.k('basketMouth', () => S.disc(0.17, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.2, 0)), x + Math.cos(yaw) * 0.2, 0, z - Math.sin(yaw) * 0.2, yaw);
const shrooms = (S: Shapes, P: Parts, r: () => number, x: number, z: number, n: number, spread: number) => {
  for (let k = 0; k < n; k++) P.p(r() < 0.75 ? 'cap' : 'straw', S.shroom(0.8 + r() * 0.7), x + (r() - 0.5) * spread * 2, 0, z + (r() - 0.5) * spread * 2, r() * 6, r() < 0.4 ? 1.4 : 0);
};
const arrows = (S: Shapes, P: Parts, r: () => number, n: number, w: number, d: number, cx = 0, cz = 0) => {
  for (let k = 0; k < n; k++) {
    const x = cx + (r() - 0.5) * w, z = cz + (r() - 0.5) * d, y = r() * 6.28, t = 0.25 + r() * 0.35;
    P.p('barkLight', S.cyl(0.012, 0.012, 0.4, 4), x, 0, z, y, t).p('wine', S.box(0.006, 0.08, 0.05), x + Math.sin(y) * Math.sin(t) * 0.36, Math.cos(t) * 0.36, z + Math.cos(y) * Math.sin(t) * 0.36, y, t);
  }
};
const fireRing = (S: Shapes, P: Parts, r: () => number, x: number, z: number) => {
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28; P.p('stone', S.stone(0.15), x + Math.cos(a) * 0.52, 0, z + Math.sin(a) * 0.52, r() * 6); }
  P.p('ash', S.disc(0.44, 0.02), x, 0, z);
  for (let k = 0; k < 3; k++) P.p('lacquer', S.log(0.05, 0.7, 6), x, 0.02, z, k * 1.05 + r() * 0.3);
};

const KINDS: Kind[] = [
  {
    // The woodcutter's work left mid-way: the axe stood in a half-split round on the block, the halves fallen apart, billets strewn,
    // a low stack begun, the saw dropped, chips everywhere.
    name: 'woodcut', R: 2.6, where: 'ground',
    make: (S, P, r) => {
      P.p('bark', S.cyl(0.36, 0.42, 0.28, 12), 0, 0, 0).p('straw', S.disc(0.35, 0.01), 0, 0.28, 0);
      P.p('barkLight', S.half(0.2, 0.5), 0.12, 0.28, 0, 0, 0).p('barkLight', S.half(0.2, 0.5), -0.12, 0.28, 0, Math.PI, 0);
      // the axe: its head in the round, its haft leaning out low
      P.p('iron', S.box(0.2, 0.06, 0.12), 0, 0.42, 0, 0.6).p('bark', S.log(0.02, 0.7, 5), -0.33, 0.34, 0.2, 0.6, 0).p('gold', S.box(0.05, 0.04, 0.05), 0.08, 0.43, -0.05, 0.6);
      for (let k = 0; k < 5 + Math.floor(r() * 4); k++) billet(S, P, (r() - 0.5) * 3, 0.6 + r() * 1.3, r() * 6, r() < 0.5);
      // the stack begun: two rows between stakes
      for (let row = 0; row < 2; row++) for (let i = 0; i < 4 - row; i++) P.p(i % 2 ? 'barkLight' : 'bark', S.log(0.11, 0.9, 7), -1.6, 0.0 + row * 0.2, -1.0 + (i - (3 - row) / 2) * 0.23, Math.PI / 2);
      P.p('iron', S.box(0.9, 0.012, 0.16), 1.3, 0, -0.8, 0.4).p('plank', S.box(0.12, 0.05, 0.3), 1.75, 0, -1.0, 0.4);
      for (let k = 0; k < 14; k++) P.p('straw', S.box(0.08, 0.012, 0.05), (r() - 0.5) * 2.2, 0, (r() - 0.5) * 2.2, r() * 6);
    },
  },
  {
    // A hunter's camp left in a hurry: the fire cold, the bedroll kicked aside, the bow left on a stump, the quiver spilled, the pot over.
    name: 'hunters', R: 2.6, where: 'ground',
    make: (S, P, r) => {
      fireRing(S, P, r, 0, 0);
      P.p('lacquer', S.log(0.14, 0.24, 10), 0.75, 0, 0.35, 2.2).p('gold', S.k('potRim', () => S.ring(0.14, 0.015).clone().rotateZ(Math.PI / 2).translate(0, 0.14, 0)), 0.86, 0, 0.4, 2.2);
      P.p('wine', S.box(0.75, 0.05, 1.7), -1.5, 0, 0.6, 0.5).p('wine', S.log(0.15, 0.75, 10), -1.85, 0, 1.3, 0.5).p('gold', S.box(0.77, 0.055, 0.05), -1.15, 0, -0.15, 0.5);
      // the stump with the bow across it
      P.p('bark', S.cyl(0.3, 0.36, 0.3, 10), 1.4, 0, -0.9).p('moss', S.disc(0.29, 0.02), 1.4, 0.3, -0.9);
      P.p('plank', S.k('bow', () => new THREE.TorusGeometry(0.6, 0.025, 5, 16, 2.2).rotateX(Math.PI / 2).translate(0, 0.03, 0)), 1.3, 0.3, -0.7, 0.4).p('stem', S.log(0.004, 1.0, 3), 1.25, 0.3, -0.4, 0.4);
      // the quiver on its side, arrows spilled from it
      P.p('teal', S.log(0.07, 0.6, 8), -0.4, 0, -1.4, 2.6).p('gold', S.k('quiverBand', () => S.ring(0.075, 0.012).clone().rotateZ(Math.PI / 2).translate(0, 0.07, 0)), -0.2, 0, -1.48, 2.6);
      for (let k = 0; k < 5; k++) P.p('barkLight', S.log(0.01, 0.7, 4), -0.9 + k * 0.08, 0, -1.2 - k * 0.12, 2.6 + (r() - 0.5) * 0.5);
      arrows(S, P, r, 3 + Math.floor(r() * 3), 3, 1.2, 0.5, 1.6);
      if (r() < 0.6) P.p('teal', S.box(0.9, 0.03, 0.7), 1.6, 0, 0.9, 1.0); // his cloak, dropped
    },
  },
  {
    // A cart of logs tipped into the ditch: on its side, a wheel off, its load rolled out across the verge.
    name: 'logcart', R: 2.8, where: 'ground',
    make: (S, P, r) => {
      P.p('plank', S.box(1.8, 0.4, 0.3), 0, 0, 0, 0).p('gold', S.box(1.84, 0.04, 0.32), 0, 0.38, 0, 0).p('plank', S.box(1.8, 0.05, 1.0), 0, 0, 0.62, 0);
      P.p('bark', S.k('wheel', () => S.ring(0.42, 0.045)), -0.4, 0, -0.75).p('bark', S.cyl(0.08, 0.08, 0.1, 8), -0.4, 0, -0.75);
      for (let k = 0; k < 3; k++) P.p('bark', S.log(0.022, 0.8, 4), -0.4, 0.03, -0.75, k * 1.05);
      P.p('bark', S.ring(0.42, 0.045), 1.3, 0, -1.0);
      for (let k = 0; k < 3; k++) P.p('bark', S.log(0.022, 0.8, 4), 1.3, 0.03, -1.0, k * 1.05 + 0.4);
      P.p('bark', S.log(0.035, 1.3, 6), -1.4, 0, 0.2, 0.3);
      const logs = 3 + Math.floor(r() * 3);
      for (let k = 0; k < logs; k++) P.p(k % 2 ? 'barkLight' : 'bark', S.log(0.18, 2.2 + r() * 0.6, 9), 0.2 + (r() - 0.5) * 0.6, 0, 1.3 + k * 0.42, (r() - 0.5) * 0.3);
      if (r() < 0.6) coil(S, P, 1.4, 0.4);
    },
  },
  {
    // A hive knocked over: the stand on its side, the straw skep rolled off, combs of honey (gilt) in the grass, the keeper's smoker dropped.
    name: 'hive', R: 1.9, where: 'ground',
    make: (S, P, r) => {
      P.p('bark', S.box(0.7, 0.35, 0.5), 0, 0, 0, 0.3);
      P.p('straw', S.k('skepSide', () => S.dome(0.38, 1.2).clone().rotateZ(Math.PI / 2).translate(0, 0.38, 0)), 0.75, 0, 0.45, 0.6).p('gold', S.k('skepBand', () => S.ring(0.38, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.38, 0)), 0.75, 0, 0.45, 0.6);
      for (let k = 0; k < 3 + Math.floor(r() * 3); k++) P.p('gold', S.k('comb', () => new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6).translate(0, 0.015, 0)), 0.6 + (r() - 0.5) * 1.4, 0, 1.0 + (r() - 0.5) * 0.9, r() * 6, 0, 1.4, 1, 0.8);
      P.p('lacquer', S.log(0.08, 0.28, 8), -0.9, 0, 0.7, 1.4).p('gold', S.k('smokerSpout', () => new THREE.ConeGeometry(0.06, 0.12, 6).rotateZ(-Math.PI / 2).translate(0.2, 0.08, 0)), -0.9, 0, 0.7, 1.4);
      if (r() < 0.6) P.p('teal', S.box(0.6, 0.02, 0.5), -0.8, 0, -0.6, 0.7); // the keeper's veil
      for (let k = 0; k < 4; k++) P.p('green', S.stone(0.12), (r() - 0.5) * 2, 0, (r() - 0.5) * 2, r() * 6);
    },
  },
  {
    // A mushroom gatherer's basket dropped: tipped over, its finds spilled, the knife and the cloth left behind.
    name: 'gatherer', R: 1.8, where: 'ground',
    make: (S, P, r) => {
      basketDown(S, P, 0, 0, 0.3);
      P.p('bark', S.k('handle', () => new THREE.TorusGeometry(0.2, 0.02, 4, 10, Math.PI).rotateY(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.2, 0)), -0.05, 0, 0, 0.3);
      shrooms(S, P, r, 0.6, -0.15, 8 + Math.floor(r() * 6), 0.55);
      P.p('iron', S.box(0.2, 0.01, 0.04), -0.7, 0, 0.5, 0.8).p('plank', S.box(0.1, 0.03, 0.05), -0.83, 0, 0.6, 0.8);
      P.p('teal', S.box(1.0, 0.02, 0.8), -0.5, 0, -0.9, 0.4).p('gold', S.box(1.0, 0.025, 0.04), -0.43, 0, -0.5, 0.4);
      shrooms(S, P, r, -0.5, -0.9, 5, 0.3);
      basket(S, P, 0.9, 0.8, 0.26);
      shrooms(S, P, r, 0.9, 0.8, 3, 0.1);
      P.p('bark', S.log(0.02, 1.3, 5), -1.2, 0, 0.5, 0.9); // the stick for turning the leaves
    },
  },
  {
    // A snapped trap: its iron jaws sprung on a torn cloth, its chain to the stake, feathers and a tuft in the grass.
    name: 'trap', R: 1.8, where: 'ground',
    make: (S, P, r) => {
      P.p('iron', S.ring(0.4, 0.04), 0, 0, 0).p('iron', S.k('jaw', () => new THREE.TorusGeometry(0.38, 0.035, 4, 12, Math.PI).translate(0, 0.03, 0)), 0, 0.02, 0, 0, 0.45).p('iron', S.k('jaw', () => new THREE.TorusGeometry(0.38, 0.035, 4, 12, Math.PI).translate(0, 0.03, 0)), 0, 0.02, 0, Math.PI, 0.45);
      // the cloak it caught, torn off and left in its jaws, a strip of it further off
      P.p('wine', S.box(1.0, 0.025, 0.7), 0.25, 0.03, 0.15, 0.3).p('wine', S.box(0.6, 0.025, 0.35), 1.05, 0, 0.65, 1.1).p('gold', S.box(1.0, 0.03, 0.04), 0.3, 0.035, 0.49, 0.3);
      for (let k = 0; k < 6; k++) P.p('iron', S.k('link', () => S.ring(0.06, 0.014).clone().rotateZ(Math.PI / 2)), -0.5 - k * 0.13, 0, -0.07 * k, 0.2);
      P.p('bark', S.cyl(0.06, 0.035, 0.3, 6), -1.3, 0, -0.42).p('gold', S.ring(0.07, 0.014), -1.3, 0.24, -0.42);
      // a satchel dropped as they ran, its strap out, an arrow snapped
      P.p('plank', S.box(0.45, 0.2, 0.3), -0.7, 0, 0.9, 0.6).p('gold', S.box(0.06, 0.21, 0.31), -0.7, 0, 0.9, 0.6).p('plank', S.log(0.015, 0.9, 4), -0.2, 0, 1.2, 0.2);
      P.p('barkLight', S.log(0.012, 0.35, 4), 0.9, 0, -0.6, 0.4).p('barkLight', S.log(0.012, 0.3, 4), 1.1, 0, -0.85, 1.6);
      for (let k = 0; k < 7; k++) P.p(k % 2 ? 'stem' : 'cloth', S.box(0.18, 0.012, 0.04), (r() - 0.5) * 2.4, 0, (r() - 0.5) * 2.4, r() * 6);
    },
  },
  {
    // A wayside offering where a trail bends: a flat stone with candles on gilt dishes, bowls of berries and bread, a garland, pebbles in a ring.
    name: 'offering', R: 1.6, where: 'ground',
    make: (S, P, r) => {
      P.p('stone', S.box(1.0, 0.22, 0.55), 0, 0, 0, 0.1).p('stoneDark', S.box(0.5, 0.36, 0.14), 0, 0.22, -0.18, 0.1).p('moss', S.box(0.52, 0.03, 0.16), 0, 0.58, -0.18, 0.1);
      for (const [cx, h] of [[-0.35, 0.16], [0.35, 0.12], [-0.15, 0.1]] as const) P.p('gold', S.disc(0.06, 0.015), cx, 0.22, 0.08).p('stem', S.cyl(0.025, 0.025, h, 8), cx, 0.235, 0.08);
      P.p('plank', S.cyl(0.11, 0.08, 0.06, 10), 0.15, 0.22, 0.12).p('cap', S.ball(0.04), 0.13, 0.27, 0.12).p('cap', S.ball(0.04), 0.19, 0.27, 0.1);
      P.p('bread', S.ball(0.1, 0.6), -0.55, 0, 0.4).p('green', S.ring(0.3, 0.05), 0.5, 0, 0.45);
      for (let k = 0; k < 5; k++) { const a = k * 1.25; P.p('wine', S.ball(0.035), 0.5 + Math.cos(a) * 0.3, 0.06, 0.45 + Math.sin(a) * 0.3); }
      for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.28; P.p('stone', S.stone(0.1), Math.cos(a) * 1.2, 0, Math.sin(a) * 0.9 + 0.1, r() * 6); }
    },
  },
  {
    // A dry-stone wall half built: two courses laid, the rest of its stones heaped beside it, the barrow and the mallet left.
    name: 'wall', R: 2.6, where: 'ground',
    make: (S, P, r) => {
      const len = 2.6 + r() * 1.2;
      for (let i = 0; i < len / 0.5; i++) P.p(i % 2 ? 'stone' : 'stoneDark', S.box(0.48, 0.2, 0.4), -len / 2 + i * 0.5, 0, 0, (r() - 0.5) * 0.1);
      for (let i = 0; i < len / 0.5 - 2; i++) P.p(i % 2 ? 'stoneDark' : 'stone', S.box(0.46, 0.18, 0.36), -len / 2 + 0.25 + i * 0.5, 0.2, 0, (r() - 0.5) * 0.1);
      P.p('moss', S.box(1.0, 0.02, 0.36), -len / 2 + 0.8, 0.38, 0);
      for (let k = 0; k < 9; k++) P.p(k % 2 ? 'stone' : 'stoneDark', S.stone(0.2 + r() * 0.08), len / 2 + 0.6 + (r() - 0.5) * 1.1, 0, 0.7 + (r() - 0.5) * 0.9, r() * 6);
      P.p('plank', S.box(0.55, 0.3, 0.85), -0.6, 0, 1.1, 0.3).p('bark', S.ring(0.2, 0.035), -0.6 - 0.1, 0, 1.75, 0.3);
      P.p('bark', S.log(0.02, 0.6, 5), 0.6, 0, 0.9, 1.2).p('plank', S.log(0.07, 0.2, 8), 0.86, 0, 0.8, 1.2);
    },
  },
  {
    // A tree come down across the way, its branches lopped and stacked, moss on its back, mushrooms at its foot.
    name: 'fallen', R: 3.6, where: 'ground',
    make: (S, P, r) => {
      const len = 5 + r() * 2;
      P.p('bark', S.log(0.24, len, 11), 0, 0, 0).p('moss', S.k(`mossTop${len}`, () => new THREE.CylinderGeometry(0.245, 0.245, len * 0.7, 11, 1, false, -0.9, 1.8).rotateZ(Math.PI / 2).translate(0, 0.24, 0)), -len * 0.1, 0, 0);
      P.p('straw', S.k('trunkEnd', () => S.disc(0.23, 0.01).clone().rotateZ(Math.PI / 2).translate(0, 0.24, 0)), len / 2, 0, 0);
      for (let k = 0; k < 4; k++) P.p('bark', S.cyl(0.07, 0.09, 0.22, 6), -len / 2 + 0.8 + k * 1.1, 0.4, (k % 2 ? 1 : -1) * 0.1, 0, (k % 2 ? 1 : -1) * 0.9);
      for (let k = 0; k < 6; k++) P.p(k % 2 ? 'barkLight' : 'bark', S.log(0.05, 1.4 + r() * 0.6, 6), -0.6 + (r() - 0.5) * 1.2, 0, 1.1 + (k % 3) * 0.12, 0.2 + (r() - 0.5) * 0.3);
      shrooms(S, P, r, -len / 2 + 0.4, -0.45, 6, 0.4);
    },
  },
  {
    // The aftermath of a fight with the Wood's beasts: a shield dropped, a broken spear, arrows in the ground, a lantern on its side.
    name: 'fight', R: 2.4, where: 'ground',
    make: (S, P, r) => {
      P.p('teal', S.cyl(0.38, 0.38, 0.04, 16), -0.6, 0, -0.2).p('gold', S.ring(0.38, 0.022), -0.6, 0.02, -0.2).p('gold', S.ball(0.06, 0.6), -0.6, 0.04, -0.2);
      P.p('bark', S.log(0.03, 1.4, 6), 0.6, 0, 0.6, 0.3).p('bark', S.log(0.03, 1.0, 6), 1.2, 0, -0.5, 1.4).p('iron', S.k('spearHead', () => new THREE.ConeGeometry(0.05, 0.3, 6).rotateZ(-Math.PI / 2).translate(0, 0.03, 0)), 1.4, 0, 0.35, 0.3);
      P.p('lacquer', S.k('lanternSide', () => S.box(0.2, 0.28, 0.2).clone().rotateZ(Math.PI / 2).translate(0, -0.04, 0)), -1.2, 0.1, 0.8, 1.8).p('gold', S.k('lanternCap', () => S.cyl(0.12, 0.12, 0.04, 8).clone().rotateZ(Math.PI / 2)), -1.05, 0.1, 0.72, 1.8);
      arrows(S, P, r, 8 + Math.floor(r() * 8), 3.6, 3);
      for (let k = 0; k < 4; k++) P.p('cloth', S.box(0.3, 0.012, 0.08), (r() - 0.5) * 2.4, 0, (r() - 0.5) * 2.4, r() * 6); // torn fur, tufts
    },
  },
  {
    // A picnic cut short: the cloth spread, the basket open, bread, a jug on its side, cups.
    name: 'picnic', R: 1.7, where: 'ground',
    make: (S, P, r) => {
      P.p('wine', S.box(1.5, 0.015, 1.2), 0, 0, 0, 0.2).p('gold', S.box(1.5, 0.02, 0.04), 0.12, 0, 0.58, 0.2);
      basket(S, P, -0.45, -0.25, 0.26);
      P.p('plank', S.box(0.5, 0.02, 0.3), -0.45, 0.27, -0.55, 0.2, 1.1);
      P.p('bread', S.ball(0.12, 0.55), 0.3, 0.015, -0.2).p('bread', S.ball(0.09, 0.55), 0.45, 0.015, 0.05);
      P.p('teal', S.log(0.08, 0.26, 10), 0.2, 0.015, 0.35, 1.1).p('wine', S.disc(0.25, 0.006), 0.42, 0.015, 0.5, 0, 0, 1.3, 1, 0.8);
      for (const [cx, cz] of [[-0.2, 0.3], [0.6, -0.4]] as const) P.p('stem', S.cyl(0.05, 0.04, 0.1, 8), cx, 0.015, cz);
      if (r() < 0.6) P.p('cap', S.ball(0.05), -0.1, 0.015, 0.0).p('cap', S.ball(0.05), -0.02, 0.015, 0.06);
    },
  },
  // --- past the edge (tall allowed) ---
  {
    // A woodcutter's yard: a log on the sawhorse, the cut rounds, a woodpile stacked to the eaves of nothing, the axe in the block.
    name: 'yard', R: 3.2, where: 'beyond',
    make: (S, P, r) => {
      for (const s of [-0.6, 0.6]) {
        P.p('plank', S.box(0.08, 1.0, 0.08), s, 0, -0.3, 0, 0.35).p('plank', S.box(0.08, 1.0, 0.08), s, 0, 0.3, 0, -0.35);
      }
      P.p('bark', S.log(0.2, 2.8, 10), 0.3, 0.75, 0);
      P.p('iron', S.box(1.0, 0.16, 0.012), -0.9, 0.95, 0.0, Math.PI / 2, 0).p('plank', S.box(0.1, 0.12, 0.05), -0.9, 0.95, 0.5);
      for (let row = 0; row < 5; row++) for (let i = 0; i < 6 - (row % 2); i++) P.p(i % 2 ? 'barkLight' : 'bark', S.log(0.12, 1.0, 7), -1.2 + i * 0.25 + (row % 2) * 0.12, row * 0.22, -1.6, Math.PI / 2);
      for (const s of [-1.45, 0.3]) P.p('bark', S.box(0.08, 1.3, 0.08), s, 0, -1.6);
      P.p('bark', S.cyl(0.35, 0.4, 0.45, 12), 1.6, 0, 0.9).p('bark', S.log(0.025, 0.75, 5), 1.6, 0.45, 0.9, 0.6, 0.9).p('iron', S.box(0.2, 0.06, 0.12), 1.6, 0.5, 0.9, 0.6);
      for (let k = 0; k < 4; k++) P.p('bark', S.cyl(0.18, 0.18, 0.3, 9), 0.5 + (r() - 0.5) * 1.6, 0, 1.2 + (r() - 0.5) * 0.8);
    },
  },
];
export const WOOD_SCENE_KINDS = KINDS.map((k) => k.name);

/** Which kinds suit a place's kind (one is put near such a place, outside its ground). */
const BY_PLACE: Record<string, string[]> = {
  burners: ['woodcut', 'logcart'], den: ['trap', 'fight'], bramble: ['gatherer'], thicket: ['trap', 'hunters'], stones: ['offering', 'wall'],
  giants: ['fight', 'fallen'], spring: ['picnic'], shrine: ['offering'], hollow: ['gatherer', 'hive'], lamps: ['gatherer', 'picnic'], heart: ['offering'],
};
/** Kinds for the trails' verges and the open glades. */
const ROADSIDE = ['woodcut', 'hunters', 'logcart', 'hive', 'gatherer', 'trap', 'offering', 'wall', 'fallen', 'fight', 'picnic'];

export function scenesOff() {
  return typeof location !== 'undefined' && /[?&]scenes=off\b/.test(location.search);
}

/** Plans and adds the scenes of one Wood floor; returns where they stand (for the probe). */
export function buildWoodScenes(o: WoodScenesIn): Placed[] {
  const { look, land, kit, gold } = o;
  if (scenesOff()) return [];
  const rnd = seeded(SEED + look.seed);
  const { S, dispose } = shapes();
  const mats = new Map<string, THREE.Material>();
  const M = (key: Col) => {
    if (key === 'gold') return gold;
    let m = mats.get(key);
    if (!m) { mats.set(key, (m = new THREE.MeshStandardMaterial({ color: (C as Record<string, string>)[key] ?? '#d8cfb4' }))); o.own.push(m); }
    return m;
  };
  const roads: { ax: number; az: number; bx: number; bz: number }[] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push({ ax: RING.x + p[i - 1][0], az: RING.z + p[i - 1][1], bx: RING.x + p[i][0], bz: RING.z + p[i][1] });
  const cover = look.pieces.filter((p) => p.look !== 'edge').map((p) => p.o);
  const keep = o.keep, placed: Placed[] = [];
  const kinds = new Map(KINDS.map((k) => [k.name, k]));
  const cap = new Map<string, number>();
  for (const k of KINDS) cap.set(k.name, k.where === 'ground' ? 1 + Math.floor(rnd() * 2.6) + (rnd() < 0.4 ? 1 : 0) : 1);
  const used = new Map<string, number>();
  /** Each ground kind's squash: its tallest sample, drawn larger, brought down to the knee as a whole (parts stay stacked). */
  const squash = new Map<string, number>();
  for (const k of KINDS) {
    if (k.where !== 'ground') { squash.set(k.name, 1); continue; }
    let top = 0;
    for (let t = 0; t < 4; t++) {
      const P = new Parts();
      k.make(S, P, seeded(t + 1));
      for (const p of P.list) {
        const bb = p.g.boundingBox ?? (p.g.computeBoundingBox(), p.g.boundingBox!);
        top = Math.max(top, (p.y + bb.max.y * p.s[1] * Math.abs(Math.cos(p.tilt)) + Math.abs(Math.sin(p.tilt)) * Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z)) * p.s[2]) * GROUND_SCALE);
      }
    }
    squash.set(k.name, Math.min(1, (KNEE - 0.04) / top));
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), corner = new THREE.Vector3();
  const beyondOf = (x: number, z: number) => land.beyond(x - RING.x, z - RING.z);
  const heightOf = (x: number, z: number) => land.height(x - RING.x, z - RING.z);

  // --- what the scenes keep off, by squares (each thing in every square within NEAR m of it) ---
  const CELL = 8, NEAR = 10, cells = new Map<number, { x: number; z: number; r: number; m: number }[]>();
  const cellKey = (i: number, j: number) => i * 4096 + j;
  const brookPts = o.brooks.flatMap((b) => b.map(([x, z]) => ({ x, z, r: 1.7 })));
  // a tree is kept off by its trunk and a little more (its crown may hang over a scene), a bush and a depth prop by their reach
  const allNear: { x: number; z: number; r: number; m: number }[] = [...o.taken.map((t) => ({ x: t.x, z: t.z, r: t.tree ? Math.min(t.r, 0.9) : t.r, m: 0.4 })), ...brookPts.map((t) => ({ ...t, m: 0.3 }))];
  for (const t of allNear) {
    const e2 = t.r + NEAR;
    for (let i = Math.floor((t.x - e2) / CELL); i <= Math.floor((t.x + e2) / CELL); i++) for (let j = Math.floor((t.z - e2) / CELL); j <= Math.floor((t.z + e2) / CELL); j++) {
      const key = cellKey(i, j);
      let c = cells.get(key);
      if (!c) cells.set(key, (c = []));
      c.push(t);
    }
  }
  const propsNear = (x: number, z: number, reachM: number) => (reachM + 3 > NEAR ? allNear : cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []);
  const trees = o.taken.filter((t) => t.tree);
  const nearPass = (x: number, z: number, pad: number) => look.passes.some((p) => Math.hypot(x - p.x, z - p.z) < p.w + 3 + pad);

  /** `ground` is where the part's own height is measured from (its ground, lowered by the kind's squash); `floor` its real ground. */
  type Laid = { p: Part; wx: number; wz: number; wyaw: number; ground: number; floor: number; cx: number; cz: number; r: number; top: number; k: number; sy: number };
  /** Where each part stands (see scenes/sea.ts `lay`): its middle, a circle round it, its top; stops at the first part `ok` refuses. */
  const lay = (P: Parts, x: number, z: number, yaw: number, mir: number, beyond: boolean, ok: (L: Laid) => boolean, fy = 1): Laid[] | null => {
    const c = Math.cos(yaw), s = Math.sin(yaw), k = beyond ? 1 : GROUND_SCALE, out: Laid[] = [];
    for (const p of P.list) {
      const lx = p.x * mir * k, lz = p.z * k, wx = x + c * lx + s * lz, wz = z - s * lx + c * lz, wyaw = yaw + p.yaw * mir;
      const ground = beyond ? heightOf(wx, wz) : 0;
      const bb = p.g.boundingBox ?? (p.g.computeBoundingBox(), p.g.boundingBox!);
      const sx = p.s[0] * k, sz = p.s[2] * k, ox = ((bb.min.x + bb.max.x) / 2) * sx, oz = ((bb.min.z + bb.max.z) / 2) * sz;
      const cy = Math.cos(wyaw), sy2 = Math.sin(wyaw), lean = Math.abs(Math.sin(p.tilt)), up = Math.abs(Math.cos(p.tilt));
      const reachZ = Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z)) * sz;
      let sy = p.s[1] * k * fy;
      const topOf = (yy: number) => p.y * k * fy + Math.max(bb.max.y * yy * up, bb.min.y * yy * up) + lean * reachZ;
      let top = topOf(sy);
      if (!beyond && top > KNEE - 0.02) {
        const base = p.y * k * fy + lean * reachZ;
        sy *= Math.max(0.3, (KNEE - 0.03 - base) / Math.max(0.01, top - base));
        top = topOf(sy);
      }
      const r = Math.hypot((bb.max.x - bb.min.x) * sx, (bb.max.z - bb.min.z) * sz) / 2 + lean * Math.max(Math.abs(bb.min.y), Math.abs(bb.max.y)) * sy;
      const L: Laid = { p, wx, wz, wyaw, ground: ground + p.y * k * fy - p.y * k, floor: ground, cx: wx + cy * ox + sy2 * oz, cz: wz - sy2 * ox + cy * oz, r, top, k, sy };
      if (!ok(L)) return null;
      out.push(L);
    }
    return out;
  };
  const corners = (L: Laid) => {
    const p = L.p, bb = p.g.boundingBox!;
    m4.compose(v.set(L.wx, L.ground + p.y * L.k, L.wz), q.setFromEuler(e.set(p.tilt, L.wyaw, 0, 'YXZ')), sc.set(p.s[0] * L.k, L.sy, p.s[2] * L.k));
    const pts: [number, number][] = [];
    let top = -1e9;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m4);
      if (!(i & 2)) pts.push([corner.x, corner.z]);
      top = Math.max(top, corner.y - L.floor);
    }
    return { pts, top };
  };

  /** The tests on each part: spots, cover, trails, the passes, places, the depth's props and brooks, trees; low and inside, or past the edge. */
  const partCheck = (k: Kind, x: number, z: number) => {
    const R = reach(k) + 1;
    const nearKeep = keep.filter((s) => Math.hypot(s.x - x, s.z - z) < R + 3.5);
    const nearCover = cover.filter((c) => segDist(x, z, c.ax, c.az, c.bx, c.bz) < R + c.r + 1);
    const nearRoads = roads.filter((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < R + 2.5);
    const nearProps = propsNear(x, z, R).filter((m) => Math.hypot(m.x - x, m.z - z) < R + m.r + 1.5);
    const nearPlaces = look.places.filter((p) => Math.hypot(p.x - x, p.z - z) < R + p.r + 1.5);
    return (L: Laid) => {
      const { cx, cz, r } = L;
      if (nearKeep.some((s) => Math.hypot(s.x - cx, s.z - cz) < 3.1 + r)) return false;
      if (nearCover.some((c) => segDist(cx, cz, c.ax, c.az, c.bx, c.bz) < c.r + 0.6 + r)) return false;
      if (nearRoads.some((s) => segDist(cx, cz, s.ax, s.az, s.bx, s.bz) < 2.0 + r)) return false;
      if (nearProps.some((m) => Math.hypot(m.x - cx, m.z - cz) < m.r + m.m + r)) return false;
      if (nearPlaces.some((p) => Math.hypot(p.x - cx, p.z - cz) < p.r + 0.8 + r)) return false;
      if (nearPass(cx, cz, r)) return false;
      const b = beyondOf(cx, cz);
      if (k.where === 'ground') { if (b > -0.8 - r || L.top > KNEE) return false; }
      else if (b < 2.5 + r || b > 16) return false;
      return true;
    };
  };
  /** A scene past the edge stands on fairly even ground. */
  const sceneFits = (k: Kind, laid: Laid[]) => {
    if (k.where !== 'beyond') return true;
    let lo = 1e9, hi = -1e9;
    for (const L of laid) { lo = Math.min(lo, L.floor); hi = Math.max(hi, L.floor); }
    return hi - lo < 0.7;
  };
  /** The cheap tests on a scene's middle alone, before its parts are made. */
  const roughly = (k: Kind, x: number, z: number) => {
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + reach(k) + 1.5)) return false;
    const b = beyondOf(x, z);
    if (k.where === 'ground' ? b > -1.2 : b < 3 || b > 16) return false;
    if (keep.some((s) => Math.hypot(s.x - x, s.z - z) < 3.2)) return false;
    if (roads.some((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 2.2)) return false;
    if (cover.some((c) => segDist(x, z, c.ax, c.az, c.bx, c.bz) < c.r + 0.4)) return false;
    if (look.places.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 0.8)) return false;
    if (nearPass(x, z, 0)) return false;
    if (k.where === 'beyond') {
      // never south of the walkable ground (between the camera and a hero); no tree on it or just south of it (hiding it)
      const dz = z - RING.z, d = Math.hypot(x - RING.x, dz) || 1;
      if (dz / d > 0.2) return false;
      if (trees.some((t) => t.z > z && t.z < z + 9 && Math.abs(t.x - x) < reach(k) * 0.6)) return false;
    }
    return true;
  };
  const tryPut = (name: string, x: number, z: number, jitter: number, faceYaw?: number) => {
    const k = kinds.get(name)!;
    if ((used.get(name) ?? 0) >= (cap.get(name) ?? 0)) return false;
    for (let t = 0; t < 5; t++) {
      const sub = seeded(Math.floor(rnd() * 1e9));
      const px = x + (rnd() - 0.5) * jitter * (t ? 1 : 0), pz = z + (rnd() - 0.5) * jitter * (t ? 1 : 0);
      const yaw = faceYaw !== undefined ? faceYaw + (rnd() - 0.5) * 0.5 : rnd() * Math.PI * 2, mir = rnd() < 0.5 ? 1 : -1;
      if (!roughly(k, px, pz)) continue;
      const P = new Parts();
      k.make(S, P, sub);
      const laid = lay(P, px, pz, yaw, mir, k.where !== 'ground', partCheck(k, px, pz), squash.get(name));
      if (!laid || !sceneFits(k, laid)) continue;
      const pts: [number, number][] = [];
      let top = 0;
      for (const L of laid) {
        kit.add(M(L.p.key), L.p.g, L.wx, L.ground + L.p.y * L.k, L.wz, L.wyaw, L.p.s[0] * L.k, L.sy, L.p.s[2] * L.k, L.p.tilt);
        const cn = corners(L);
        pts.push(...cn.pts, [L.cx, L.cz]);
        top = Math.max(top, cn.top);
      }
      let r = 0;
      for (const [qx, qz] of pts) r = Math.max(r, Math.hypot(qx - px, qz - pz));
      placed.push({ kind: name, x: px, z: pz, r, beyond: k.where !== 'ground', top: +top.toFixed(2), pts: pts.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]) });
      used.set(name, (used.get(name) ?? 0) + 1);
      return true;
    }
    return false;
  };
  const shuffled = <T,>(xs: T[]) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 1. Near the places that suit them, outside their ground.
  for (const p of shuffled(look.places)) {
    const opts = BY_PLACE[p.kind];
    if (!opts) continue;
    const name = pick(rnd, opts), k = kinds.get(name)!;
    cap.set(name, Math.max(cap.get(name) ?? 0, (used.get(name) ?? 0) + 1));
    for (let t = 0; t < 10; t++) {
      const a = rnd() * Math.PI * 2, d = p.r + reach(k) + 1.2 + rnd() * 3;
      if (tryPut(name, p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 1.5)) break;
    }
  }
  // 2. Along the trails: about one every 34 to 52 m, on the verge.
  for (const s of shuffled(roads)) {
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (L < 8) continue;
    const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
    for (let d = 5 + rnd() * 20; d < L - 5; d += 28 + rnd() * 16) {
      const side = rnd() < 0.5 ? 1 : -1;
      for (const name of shuffled(ROADSIDE).slice(0, 6)) {
        const k = kinds.get(name)!, off = 2.2 + reach(k) * 0.95 + rnd() * 1.5;
        if (tryPut(name, s.ax + ux * d - uz * side * off, s.az + uz * d + ux * side * off, 0.8, name === 'fallen' ? Math.atan2(ux, uz) : undefined)) break;
      }
    }
  }
  // 3. The open glades between the places.
  const rmax = Math.max(...look.rim);
  for (let t = 0, made = 0; t < 320 && made < 10; t++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (beyondOf(x, z) > -4) continue;
    if (roads.some((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 9)) continue;
    if (tryPut(pick(rnd, ROADSIDE), x, z, 0)) made++;
  }
  // 4. Past the edge, in a clearing among the trees outside: a woodcutter's yard.
  for (let t = 0; t < 400; t++) {
    const a = rnd() * Math.PI * 2, d = rimAt(look.rim, a) + 4 + rnd() * 8;
    if (tryPut('yard', RING.x + Math.cos(a) * d, RING.z + Math.sin(a) * d, 1.5, Math.atan2(-Math.sin(a), Math.cos(a)))) break;
  }
  dispose();
  return placed;
}
