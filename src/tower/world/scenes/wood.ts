import * as THREE from 'three';
import { scenesOff } from './off';
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
 * random stream (`seeded(SEED + look.seed)`): the zone's and the depth's streams are untouched, so nothing that was there moves. Each
 * placed scene is baked into one geometry a colour and goes into the zone's merged props (woodZone.ts `Props`: one mesh a square of
 * ground whatever the colours); its gold trim is drawn matte (brass) there, not in the zone's polished gold.
 *
 * The second pass (2026-11-14, "continue more refine"): drawn 1.45 times life size, each scene with a clear main piece (a snare net, a
 * striped cloth, a tipped hive bench, a lean-to blown flat, the charcoal's black ring) and its own ground painted into the Wood's map
 * (woodZone.ts `paint`: trodden earth, a scorch, pale chips, wet ground by a brook, ruts from the trail to the log cart), placed every 18
 * to 28 m along the trails with a fill pass for stretches the game's camera still shows empty, at forks and round the floor's spots, with
 * small echoes between; new kinds: the charcoal burner's mound raked open, a footbridge's rail broken on a brook's bank, and past the edge
 * the forester's woodshed. Random sizes are rounded to steps so the shapes made once a floor are shared (a new size is a new shape).
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
  own: { dispose(): void }[];
  keep: Pt[];
  /** The depth's solid props (woodDepth.ts `solids`) and the trees past the edge, with their radii (world). */
  taken: { x: number; z: number; r: number; tree?: boolean }[];
  /** The brooks' lines (world), from the depth. */
  brooks: [number, number][][];
  /** The ground's painted middle (woodZone.ts `paint`: a canvas `L` m across centred on the ring), for the scenes' trodden ground. */
  ground?: { map: THREE.Texture; L: number };
}
/**
 * One placed scene, for the overlap probe (`pipeline/tools/scenes-probe.js`): `main` is the middle of its largest part (for the views
 * probe); an `echo` is a small piece of a scene dropped between two, not counted as a scene.
 */
export interface Placed { kind: string; x: number; z: number; r: number; beyond: boolean; top: number; pts: [number, number][]; main?: [number, number]; echo?: boolean }

const SEED = 7171;
const KNEE = 0.55;
/** The ground scenes are drawn this much larger than life (seen from the game's high camera); never above the knee. */
const GROUND_SCALE = 1.45;

/** The Wood's colours (the heroes' palette, STYLE.md, a shade duller; the Wood's own colour is its moss green). */
const C = {
  bark: '#3c2b1c', barkLight: '#5a4530', plank: '#6b4226', lacquer: '#1d1b21', wine: '#5e1a28', rope: '#b89a5a', stone: '#60645a',
  stoneDark: '#4a4c48', moss: '#55693c', straw: '#a88a4e', teal: '#2b5560', iron: '#3c3f47', ash: '#3a3836', cap: '#8a2e2a',
  stem: '#c9bfa4', cloth: '#7a6e5a', bread: '#9a6a34', green: '#4a6638',
  /** A hide or a tarred cloth (a lean-to blown flat, a cart's tilt): a leather brown, lighter than the bark. */
  hide: '#7c5f3e',
} as const;
type Col = keyof typeof C | 'gold';

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

type Part = { key: Col; g: THREE.BufferGeometry; x: number; y: number; z: number; yaw: number; s: [number, number, number]; tilt: number };
/** A mark painted on the ground under a scene: a trodden patch, a scorch, a dark stain, wet ground, a pale spill of chips or finds. */
type MarkT = 'patch' | 'scorch' | 'stain' | 'wet' | 'spill';
class Parts {
  list: Part[] = [];
  marks: { t: MarkT; x: number; z: number; a: number; b: number; rot: number }[] = [];
  /** A ground mark in the scene's frame: an ellipse `a` by `b` m (radii), turned `rot`. */
  m(t: MarkT, x: number, z: number, a: number, b = a, rot = 0) {
    this.marks.push({ t, x, z, a, b, rot });
    return this;
  }
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
    /** A round thing lying along x on the ground (a log, a pole). */
    log: (r: number, len: number, n = 9) => of(`log${r},${len},${n}`, () => new THREE.CylinderGeometry(r, r, len, Math.min(n, r < 0.06 ? 5 : 8)).rotateZ(Math.PI / 2).translate(0, r, 0)),
    /** A log split along its length: a half lying on its flat side. */
    half: (r: number, len: number) => of(`half${r},${len}`, () => new THREE.CylinderGeometry(r, r, len, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2)),
    ball: (r: number, sy = 1) => of(`ball${r},${sy}`, () => new THREE.SphereGeometry(r, r < 0.1 ? 6 : 8, r < 0.1 ? 4 : 5).scale(1, sy, 1).translate(0, r * sy, 0)),
    dome: (r: number, sy = 1) => of(`dome${r},${sy}`, () => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, sy, 1)),
    stone: (r: number) => of(`stone${r}`, () => new THREE.IcosahedronGeometry(r, 0).scale(1, 0.62, 1).translate(0, r * 0.45, 0)),
    ring: (r: number, t: number, arc = Math.PI * 2) => of(`ring${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 4, r < 0.2 ? 10 : 14, arc).rotateX(Math.PI / 2).translate(0, t, 0)),
    disc: (r: number, h = 0.012) => of(`disc${r},${h}`, () => new THREE.CylinderGeometry(r, r, h, r < 0.1 ? 6 : 12).translate(0, h / 2, 0)),
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
interface Kind {
  name: string;
  /** Its reach round its middle (m), as made (before the ground scale). */
  R: number;
  /** On the walkable ground (low), or past the outline (tall allowed). */
  where: 'ground' | 'beyond';
  make: (S: Shapes, P: Parts, r: () => number) => void;
  /** Wheel ruts painted to it from the nearest trail (the log cart). */
  trail?: 'ruts';
  /** Placed on a brook's bank, along it (the broken rail). */
  brook?: boolean;
  /** A small piece of it dropped along the trail before it (looks only, low). */
  echo?: (S: Shapes, P: Parts, r: () => number) => void;
}
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
/** A random size rounded to steps of `st`, so the shapes made once a floor are shared (a new size is a new shape to build). */
const q = (v: number, st: number) => Math.round(v / st) * st;
const reach = (k: Kind) => k.R * (k.where === 'ground' ? GROUND_SCALE : 1);

// --- little things used by several scenes ----------------------------------------------------------------------------------------
const billet = (S: Shapes, P: Parts, x: number, z: number, yaw: number, light = false) => P.p(light ? 'barkLight' : 'bark', S.log(0.12, 0.7, 7), x, 0, z, yaw).p('straw', S.k('billetEnd', () => S.disc(0.11, 0.01).clone().rotateZ(Math.PI / 2).translate(0, 0.12, 0)), x + Math.cos(yaw) * 0.355, 0, z - Math.sin(yaw) * 0.355, yaw);
const coil = (S: Shapes, P: Parts, x: number, z: number) => P.p('rope', S.ring(0.24, 0.04), x, 0, z).p('rope', S.ring(0.16, 0.04), x, 0.06, z);
const basket = (S: Shapes, P: Parts, x: number, z: number, h = 0.28) => P.p('straw', S.cyl(0.25, 0.2, h), x, 0, z).p('lacquer', S.disc(0.22), x, h - 0.04, z).p('gold', S.ring(0.25, 0.016), x, h - 0.02, z);
const basketDown = (S: Shapes, P: Parts, x: number, z: number, yaw: number) => P.p('straw', S.log(0.2, 0.4, 10), x, 0, z, yaw).p('lacquer', S.k('basketMouth', () => S.disc(0.17, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.2, 0)), x + Math.cos(yaw) * 0.2, 0, z - Math.sin(yaw) * 0.2, yaw);
const shrooms = (S: Shapes, P: Parts, r: () => number, x: number, z: number, n: number, spread: number) => {
  for (let k = 0; k < n; k++) P.p(r() < 0.75 ? 'cap' : 'straw', S.shroom(q(0.8 + r() * 0.7, 0.15)), x + (r() - 0.5) * spread * 2, 0, z + (r() - 0.5) * spread * 2, r() * 6, r() < 0.4 ? 1.4 : 0);
};
const arrows = (S: Shapes, P: Parts, r: () => number, n: number, w: number, d: number, cx = 0, cz = 0) => {
  for (let k = 0; k < n; k++) {
    const x = cx + (r() - 0.5) * w, z = cz + (r() - 0.5) * d, y = r() * 6.28, t = 0.25 + r() * 0.35;
    P.p('barkLight', S.cyl(0.012, 0.012, 0.4, 4), x, 0, z, y, t).p('wine', S.box(0.006, 0.08, 0.05), x + Math.sin(y) * Math.sin(t) * 0.36, Math.cos(t) * 0.36, z + Math.cos(y) * Math.sin(t) * 0.36, y, t);
  }
};
/** A cart's wheel lying flat: rim, spokes, a gilt hub. */
const wheel = (S: Shapes, P: Parts, x: number, z: number, rr = 0.48) => {
  P.p('bark', S.ring(rr, 0.05), x, 0, z).p('gold', S.cyl(0.09, 0.09, 0.11, 8), x, 0, z);
  for (let k = 0; k < 3; k++) P.p('bark', S.log(0.022, rr * 2, 4), x, 0.03, z, k * 1.05);
};
const fireRing = (S: Shapes, P: Parts, r: () => number, x: number, z: number) => {
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28; P.p('stone', S.stone(0.15), x + Math.cos(a) * 0.52, 0, z + Math.sin(a) * 0.52, r() * 6); }
  P.p('ash', S.disc(0.44, 0.02), x, 0, z);
  for (let k = 0; k < 3; k++) P.p('lacquer', S.log(0.05, 0.7, 6), x, 0.02, z, k * 1.05 + r() * 0.3);
};

const KINDS: Kind[] = [
  {
    // The woodcutter's work left mid-way: the axe stood in a half-split round on the block, billets strewn, a stack begun, the saw dropped,
    // a carpet of pale chips. Two ways: the stack begun, or the sawbuck knocked over with its log half sawn.
    name: 'woodcut', R: 2.8, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0.2, 2.8, 2.4, 0).m('spill', 0.2, 0.3, 1.6, 1.2, 0.4);
      P.p('bark', S.cyl(0.36, 0.42, 0.28, 12), 0, 0, 0).p('straw', S.disc(0.35, 0.01), 0, 0.28, 0);
      P.p('barkLight', S.half(0.2, 0.5), 0.12, 0.28, 0, 0, 0).p('barkLight', S.half(0.2, 0.5), -0.12, 0.28, 0, Math.PI, 0);
      P.p('iron', S.box(0.2, 0.06, 0.12), 0, 0.42, 0, 0.6).p('bark', S.log(0.02, 0.7, 5), -0.33, 0.34, 0.2, 0.6, 0).p('gold', S.box(0.05, 0.04, 0.05), 0.08, 0.43, -0.05, 0.6);
      for (let k = 0; k < 6 + Math.floor(r() * 4); k++) billet(S, P, (r() - 0.5) * 3.4, 0.6 + r() * 1.5, r() * 6, r() < 0.5);
      if (r() < 0.5) {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 6 - row; i++) P.p(i % 2 ? 'barkLight' : 'bark', S.log(0.11, 1.0, 7), -1.8, row * 0.2, -1.3 + (i - (5 - row) / 2) * 0.23, Math.PI / 2);
        for (const s of [-0.75, 0.75]) P.p('bark', S.cyl(0.04, 0.04, 0.5, 5), -1.8, 0, -1.3 + s);
      } else {
        // the sawbuck on its side and its log, a cut halfway, the saw still in it
        for (const s of [-0.6, 0.6]) P.p('plank', S.box(0.08, 0.08, 1.1), -1.6 + s, 0, -1.2, 0.5).p('plank', S.box(0.08, 0.08, 1.1), -1.6 + s, 0, -1.2, -0.5);
        P.p('bark', S.log(0.22, 3.0, 10), -1.4, 0, -0.7, 0.05).p('straw', S.k('logEnd22', () => S.disc(0.21, 0.01).clone().rotateZ(Math.PI / 2).translate(0, 0.22, 0)), 0.1, 0, -0.78, 0.05);
        P.p('iron', S.box(0.9, 0.16, 0.012), -1.1, 0.25, -0.72, Math.PI / 2 + 0.05).p('plank', S.box(0.1, 0.12, 0.05), -1.1, 0.3, -0.25, 0.05);
      }
      P.p('iron', S.box(0.9, 0.012, 0.16), 1.3, 0, -0.8, 0.4).p('plank', S.box(0.12, 0.05, 0.3), 1.75, 0, -1.0, 0.4);
    },
    echo: (S, P, r) => { billet(S, P, 0, 0, r() * 6); billet(S, P, 0.5, 0.3, r() * 6, true); },
  },
  {
    // A hunter's camp left in a hurry: the fire cold on its scorch, the lean-to blown flat, the bedroll kicked aside, the bow on a stump,
    // the quiver spilled, the pot over, his cloak dropped.
    name: 'hunters', R: 2.8, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.8, 2.5, 0).m('scorch', 0, 0, 0.95, 0.95, 0);
      fireRing(S, P, r, 0, 0);
      P.p('lacquer', S.log(0.14, 0.24, 10), 0.75, 0, 0.35, 2.2).p('gold', S.k('potRim', () => S.ring(0.14, 0.015).clone().rotateZ(Math.PI / 2).translate(0, 0.14, 0)), 0.86, 0, 0.4, 2.2);
      P.p('wine', S.box(0.75, 0.05, 1.7), -1.5, 0, 0.6, 0.5).p('wine', S.log(0.15, 0.75, 10), -1.85, 0, 1.3, 0.5).p('gold', S.box(0.77, 0.055, 0.05), -1.15, 0, -0.15, 0.5);
      P.p('bark', S.cyl(0.3, 0.36, 0.3, 10), 1.4, 0, -0.9).p('moss', S.disc(0.29, 0.02), 1.4, 0.3, -0.9);
      P.p('plank', S.k('bow', () => new THREE.TorusGeometry(0.6, 0.025, 5, 16, 2.2).rotateX(Math.PI / 2).translate(0, 0.03, 0)), 1.3, 0.3, -0.7, 0.4).p('stem', S.log(0.004, 1.0, 3), 1.25, 0.3, -0.4, 0.4);
      P.p('teal', S.log(0.07, 0.6, 8), -0.4, 0, -1.4, 2.6).p('gold', S.k('quiverBand', () => S.ring(0.075, 0.012).clone().rotateZ(Math.PI / 2).translate(0, 0.07, 0)), -0.2, 0, -1.48, 2.6);
      for (let k = 0; k < 5; k++) P.p('barkLight', S.log(0.01, 0.7, 4), -0.9 + k * 0.08, 0, -1.2 - k * 0.12, 2.6 + (r() - 0.5) * 0.5);
      if (r() < 0.55) {
        // the lean-to, blown flat: its frame of poles and the hide over it
        P.p('hide', S.box(2.4, 0.03, 1.8), 0.4, 0, 1.9, 0.15).p('gold', S.box(2.4, 0.035, 0.05), 0.4 - Math.sin(0.15) * 0.9, 0, 1.9 - Math.cos(0.15) * 0.9, 0.15);
        for (const s of [-1.2, 0, 1.2]) P.p('barkLight', S.log(0.035, 2.2, 5), 0.4 + s, 0.03, 1.9, Math.PI / 2 + 0.15);
      } else P.p('teal', S.box(1.3, 0.03, 1.0), 1.6, 0, 1.0, 1.0);
      arrows(S, P, r, 3 + Math.floor(r() * 3), 3, 1.2, 0.5, -1.8);
    },
    echo: (S, P, r) => { P.p('teal', S.log(0.07, 0.6, 8), 0, 0, 0, r() * 6); arrows(S, P, r, 3, 1.2, 0.8); },
  },
  {
    // A cart of logs tipped into the ditch: on its side in its ruts, a wheel off, its load rolled out across the verge, the chain parted.
    name: 'logcart', R: 3.1, where: 'ground', trail: 'ruts',
    make: (S, P, r) => {
      P.m('patch', 0, 0.6, 3.2, 2.4, 0);
      P.p('plank', S.box(2.4, 0.4, 0.3), 0, 0, 0, 0).p('gold', S.box(2.44, 0.04, 0.32), 0, 0.38, 0, 0).p('plank', S.box(2.4, 0.05, 1.3), 0, 0, 0.8, 0);
      wheel(S, P, -0.5, -0.85); wheel(S, P, 1.6, -1.2, 0.4);
      P.p('bark', S.log(0.04, 1.6, 6), -1.7, 0, 0.2, 0.3);
      const logs = 4 + Math.floor(r() * 3);
      for (let k = 0; k < logs; k++) P.p(k % 2 ? 'barkLight' : 'bark', S.log(0.2, q(2.6 + r() * 0.8, 0.4), 9), 0.2 + (r() - 0.5) * 0.8, 0, 1.6 + k * 0.45, (r() - 0.5) * 0.3);
      for (let k = 0; k < 6; k++) P.p('iron', S.k('link', () => S.ring(0.06, 0.014).clone().rotateZ(Math.PI / 2)), 1.4 + k * 0.13, 0, 0.3 + k * 0.05, 0.3);
      if (r() < 0.6) coil(S, P, 1.7, -0.2);
    },
    echo: (S, P, r) => { P.p('bark', S.log(0.2, 2.4, 9), 0, 0, 0, r() * 3); },
  },
  {
    // The hives knocked over: two stands on their sides, the straw skeps rolled off, combs of honey (gilt) in the grass, the smoker and the
    // keeper's veil dropped.
    name: 'hive', R: 2.8, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0.3, 2.8, 2.2, 0).m('spill', 0.3, 1.0, 1.3, 0.7, 0);
      // the bench they stood on, tipped: its long board and its legs in the air
      P.p('plank', S.box(3.0, 0.08, 0.6), 0, 0, -0.6, 0.1).p('gold', S.box(3.04, 0.04, 0.06), 0, 0.08, -0.32, 0.1);
      for (const s2 of [-1.2, 1.2]) P.p('bark', S.log(0.05, 0.5, 6), s2, 0.08, -0.6, Math.PI / 2 + 0.1);
      for (const [x, z, a] of [[-1.0, 0.5, 0.3], [0.2, 0.8, -0.6], [1.3, 0.3, 1.2]] as const) {
        P.p('straw', S.k('skepSide', () => S.dome(0.38, 1.2).clone().rotateZ(Math.PI / 2).translate(0, 0.38, 0)), x, 0, z, a).p('gold', S.k('skepBand', () => S.ring(0.38, 0.02).clone().rotateZ(Math.PI / 2).translate(0, 0.38, 0)), x, 0, z, a);
      }
      for (let k = 0; k < 6 + Math.floor(r() * 4); k++) P.p('gold', S.k('comb', () => new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6).translate(0, 0.015, 0)), 0.2 + (r() - 0.5) * 2.6, 0, 1.3 + (r() - 0.5) * 1.0, r() * 6, 0, 1.4, 1, 0.8);
      P.p('lacquer', S.log(0.08, 0.28, 8), -1.9, 0, 1.0, 1.4).p('gold', S.k('smokerSpout', () => new THREE.ConeGeometry(0.06, 0.12, 6).rotateZ(-Math.PI / 2).translate(0.2, 0.08, 0)), -1.9, 0, 1.0, 1.4);
      P.p('teal', S.box(1.3, 0.02, 1.0), -1.6, 0, -1.6, 0.7).p('gold', S.box(1.3, 0.025, 0.04), -1.6 + Math.sin(0.7) * 0.5, 0, -1.6 + Math.cos(0.7) * 0.5, 0.7);
    },
    echo: (S, P, r) => { P.p('gold', S.k('comb', () => new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6).translate(0, 0.015, 0)), 0, 0, 0, r() * 6, 0, 1.4, 1, 0.8).p('gold', S.k('comb', () => new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6).translate(0, 0.015, 0)), 0.4, 0, 0.2, r() * 6, 0, 1.4, 1, 0.8); },
  },
  {
    // A mushroom gatherer's basket dropped: her shawl spread, two baskets tipped, the finds spilled across it in a pale fan, the knife and
    // the stick left. Two ways: on foot, or her little hand-cart tipped with its baskets.
    name: 'gatherer', R: 2.4, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.4, 2.0, 0).m('spill', 0.6, -0.1, 1.2, 0.8, 0);
      P.p('teal', S.box(1.8, 0.02, 1.4), -0.4, 0, -0.7, 0.4).p('gold', S.box(1.8, 0.025, 0.05), -0.4 + Math.sin(0.4) * 0.7, 0, -0.7 + Math.cos(0.4) * 0.7, 0.4);
      basketDown(S, P, 0, 0, 0.3);
      shrooms(S, P, r, 0.7, -0.15, 10 + Math.floor(r() * 6), 0.7);
      shrooms(S, P, r, -0.4, -0.7, 7, 0.5);
      P.p('iron', S.box(0.2, 0.01, 0.04), -0.7, 0, 0.5, 0.8).p('plank', S.box(0.1, 0.03, 0.05), -0.83, 0, 0.6, 0.8);
      if (r() < 0.5) {
        basketDown(S, P, 1.1, 0.9, 2.2);
        shrooms(S, P, r, 1.5, 1.0, 5, 0.3);
        P.p('bark', S.log(0.02, 1.4, 5), -1.4, 0, 0.6, 0.9);
      } else {
        // the hand-cart on its side, a wheel up
        P.p('wine', S.box(1.4, 0.3, 0.8), 1.4, 0, 0.8, 1.2).p('gold', S.box(1.44, 0.035, 0.84), 1.4, 0.28, 0.8, 1.2);
        wheel(S, P, 1.0, 1.7, 0.36);
        for (const s of [-0.25, 0.25]) P.p('bark', S.log(0.025, 1.2, 5), 1.7 + s, 0, -0.3, 1.2);
        basket(S, P, -1.5, 0.6, 0.26);
      }
    },
    echo: (S, P, r) => { shrooms(S, P, r, 0, 0, 5, 0.35); },
  },
  {
    // A trap sprung: a snare net torn open on the leaves, the jaw trap with a torn cloak in its jaws, its chain to the stake, a satchel
    // dropped, an arrow snapped, tufts of fur.
    name: 'trap', R: 2.5, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.5, 2.2, 0);
      // the snare net, spread and torn, its weights round its edge
      P.p('rope', S.k('snare', () => {
        const gs: THREE.BufferGeometry[] = [];
        for (let i = 0; i <= 6; i++) gs.push(new THREE.BoxGeometry(0.04, 0.03, 2.4).translate(-1.2 + i * 0.4, 0.015, 0));
        for (let j = 0; j <= 6; j++) if (j !== 3) gs.push(new THREE.BoxGeometry(2.4, 0.03, 0.04).translate(0, 0.015, -1.2 + j * 0.4));
        return mergeAll(gs);
      }), -0.6, 0, -0.6, 0.3);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28; P.p('stoneDark', S.stone(0.1), -0.6 + Math.cos(a) * 1.5, 0, -0.6 + Math.sin(a) * 1.5); }
      P.p('iron', S.ring(0.4, 0.04), 1.2, 0, 0.6).p('iron', S.k('jaw', () => new THREE.TorusGeometry(0.38, 0.035, 4, 12, Math.PI).translate(0, 0.03, 0)), 1.2, 0.02, 0.6, 0, 0.45).p('iron', S.k('jaw', () => new THREE.TorusGeometry(0.38, 0.035, 4, 12, Math.PI).translate(0, 0.03, 0)), 1.2, 0.02, 0.6, Math.PI, 0.45);
      P.p('wine', S.box(1.5, 0.025, 1.0), 1.45, 0.03, 0.8, 0.3).p('wine', S.box(0.7, 0.025, 0.4), 2.2, 0, 1.5, 1.1).p('gold', S.box(1.5, 0.03, 0.04), 1.5, 0.035, 1.3, 0.3);
      for (let k = 0; k < 6; k++) P.p('iron', S.k('link', () => S.ring(0.06, 0.014).clone().rotateZ(Math.PI / 2)), 0.7 - k * 0.13, 0, 0.6 - 0.07 * k, 0.2);
      P.p('bark', S.cyl(0.06, 0.035, 0.3, 6), -0.1, 0, 0.18).p('gold', S.ring(0.07, 0.014), -0.1, 0.24, 0.18);
      P.p('plank', S.box(0.45, 0.2, 0.3), -1.2, 0, 1.1, 0.6).p('gold', S.box(0.06, 0.21, 0.31), -1.2, 0, 1.1, 0.6).p('plank', S.log(0.015, 0.9, 4), -0.7, 0, 1.4, 0.2);
      P.p('barkLight', S.log(0.012, 0.35, 4), 1.9, 0, -0.4, 0.4).p('barkLight', S.log(0.012, 0.3, 4), 2.1, 0, -0.65, 1.6);
      for (let k = 0; k < 7; k++) P.p(k % 2 ? 'stem' : 'cloth', S.box(0.18, 0.012, 0.04), (r() - 0.5) * 3, 0, (r() - 0.5) * 3, r() * 6);
    },
  },
  {
    // A wayside offering where a trail bends: a flat stone with candles on gilt dishes, bowls of berries and bread, garlands, ribbons laid
    // out like rays, a ring of pebbles.
    name: 'offering', R: 2.7, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.8, 2.4, 0);
      P.p('stone', S.box(1.7, 0.22, 0.9), 0, 0, 0, 0.1).p('stoneDark', S.box(0.7, 0.36, 0.18), 0, 0.22, -0.3, 0.1).p('moss', S.box(0.62, 0.03, 0.18), 0, 0.58, -0.22, 0.1);
      for (const [cx, h] of [[-0.45, 0.16], [0.45, 0.12], [-0.2, 0.1], [0.2, 0.14]] as const) P.p('gold', S.disc(0.06, 0.015), cx, 0.22, 0.1).p('stem', S.cyl(0.025, 0.025, h, 6), cx, 0.235, 0.1);
      P.p('plank', S.cyl(0.11, 0.08, 0.06, 10), 0.15, 0.22, 0.15).p('cap', S.ball(0.04), 0.13, 0.27, 0.15).p('cap', S.ball(0.04), 0.19, 0.27, 0.13);
      P.p('bread', S.ball(0.1, 0.6), -0.7, 0, 0.55).p('green', S.ring(0.32, 0.06), 0.7, 0, 0.6).p('green', S.ring(0.28, 0.055), -0.8, 0, -0.6);
      for (let k = 0; k < 6; k++) { const a = k * 1.05; P.p('wine', S.ball(0.035), 0.7 + Math.cos(a) * 0.32, 0.06, 0.6 + Math.sin(a) * 0.32); }
      // ribbons laid out from the stone like rays
      const cols: Col[] = ['wine', 'teal', 'straw', 'wine', 'teal'];
      for (let k = 0; k < 5; k++) { const a = Math.PI * (0.15 + k * 0.175) + Math.PI, c = Math.cos(a), s = Math.sin(a); P.p(cols[k], S.box(1.6, 0.012, 0.14), c * 1.75, 0, -s * 1.75 + 0.2, a); }
      for (let k = 0; k < 18; k++) { const a = (k / 18) * 6.28; P.p('stone', S.stone(0.12), Math.cos(a) * 2.7, 0, Math.sin(a) * 2.2 + 0.1, r() * 6); }
    },
  },
  {
    // A dry-stone wall half built: two courses laid, the rest of its stones heaped, the barrow and the mallet left, its line pegged out.
    name: 'wall', R: 2.8, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0.5, 3.0, 1.8, 0);
      const len = 3.6 + r() * 1.2;
      for (let i = 0; i < len / 0.5; i++) P.p(i % 2 ? 'stone' : 'stoneDark', S.box(0.48, 0.2, 0.4), -len / 2 + i * 0.5, 0, 0, (r() - 0.5) * 0.1);
      for (let i = 0; i < len / 0.5 - 3; i++) P.p(i % 2 ? 'stoneDark' : 'stone', S.box(0.46, 0.18, 0.36), -len / 2 + 0.25 + i * 0.5, 0.2, 0, (r() - 0.5) * 0.1);
      P.p('moss', S.box(1.0, 0.02, 0.36), -len / 2 + 0.8, 0.38, 0);
      P.p('rope', S.log(0.008, 2.2, 3), len / 2 + 1.1, 0, 0).p('bark', S.cyl(0.03, 0.02, 0.3, 5), len / 2 + 2.2, 0, 0);
      for (let k = 0; k < 12; k++) P.p(k % 2 ? 'stone' : 'stoneDark', S.stone(q(0.2 + r() * 0.08, 0.04)), len / 2 + 0.3 + (r() - 0.5) * 1.4, 0, 0.9 + (r() - 0.5) * 1.1, r() * 6);
      P.p('plank', S.box(0.55, 0.3, 0.85), -0.6, 0, 1.1, 0.3).p('bark', S.ring(0.2, 0.035), -0.7, 0, 1.75, 0.3);
      P.p('bark', S.log(0.02, 0.6, 5), 0.6, 0, 0.9, 1.2).p('plank', S.log(0.07, 0.2, 8), 0.86, 0, 0.8, 1.2);
    },
    echo: (S, P, r) => { for (let k = 0; k < 3; k++) P.p(k % 2 ? 'stone' : 'stoneDark', S.stone(0.2), k * 0.45, 0, (r() - 0.5) * 0.4, r() * 6); },
  },
  {
    // A tree come down across the way, its branches lopped and stacked, moss on its back, mushrooms at its foot, the drag of it in the earth.
    name: 'fallen', R: 3.8, where: 'ground',
    make: (S, P, r) => {
      const len = q(5.5 + r() * 2, 0.5);
      P.m('patch', 0, 0.5, len * 0.6, 1.8, 0);
      P.p('bark', S.log(0.26, len, 11), 0, 0, 0).p('moss', S.k(`mossTop${len}`, () => new THREE.CylinderGeometry(0.265, 0.265, len * 0.7, 11, 1, false, -0.9, 1.8).rotateZ(Math.PI / 2).translate(0, 0.26, 0)), -len * 0.1, 0, 0);
      P.p('straw', S.k('trunkEnd26', () => S.disc(0.25, 0.01).clone().rotateZ(Math.PI / 2).translate(0, 0.26, 0)), len / 2, 0, 0);
      for (let k = 0; k < 4; k++) P.p('bark', S.cyl(0.07, 0.09, 0.22, 6), -len / 2 + 0.8 + k * 1.1, 0.42, (k % 2 ? 1 : -1) * 0.1, 0, (k % 2 ? 1 : -1) * 0.9);
      for (let k = 0; k < 7; k++) P.p(k % 2 ? 'barkLight' : 'bark', S.log(0.05, q(1.4 + r() * 0.6, 0.3), 6), -0.6 + (r() - 0.5) * 1.4, 0, 1.1 + (k % 3) * 0.12, 0.2 + (r() - 0.5) * 0.3);
      for (let k = 0; k < 3; k++) P.p('green', S.ball(0.4, 0.5), -len / 2 - 0.5 + (r() - 0.5) * 0.6, 0, (r() - 0.5) * 1.4, 0, 0, 1.3, 1, 1);
      shrooms(S, P, r, -len / 2 + 0.6, -0.5, 7, 0.45);
    },
  },
  {
    // A fight with the Wood's beasts: shields dropped, a spear broken, a lantern on its side, a cloak torn, arrows in the ground, the
    // earth churned, tufts of fur. Two ways: the shields, or a cart's tilt and its hoops torn off with them.
    name: 'fight', R: 2.8, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.9, 2.5, 0.3).m('patch', 0.8, -0.6, 1.6, 1.2, 0);
      for (const [x, z, c] of [[-0.6, -0.2, 'teal'], [0.9, -1.2, 'wine']] as const) P.p(c, S.cyl(0.4, 0.4, 0.04, 14), x, 0, z).p('gold', S.ring(0.4, 0.022), x, 0.02, z).p('gold', S.ball(0.06, 0.6), x, 0.04, z);
      P.p('bark', S.log(0.03, 1.6, 6), 0.6, 0, 0.6, 0.3).p('bark', S.log(0.03, 1.2, 6), 1.4, 0, -0.3, 1.4).p('iron', S.k('spearHead', () => new THREE.ConeGeometry(0.05, 0.3, 6).rotateZ(-Math.PI / 2).translate(0, 0.03, 0)), 1.5, 0, 0.35, 0.3);
      P.p('lacquer', S.k('lanternSide', () => S.box(0.2, 0.28, 0.2).clone().rotateZ(Math.PI / 2).translate(0, -0.04, 0)), -1.2, 0.1, 0.8, 1.8).p('gold', S.k('lanternCap', () => S.cyl(0.12, 0.12, 0.04, 8).clone().rotateZ(Math.PI / 2)), -1.05, 0.1, 0.72, 1.8);
      if (r() < 0.55) P.p('wine', S.box(1.6, 0.025, 1.2), -1.0, 0, -1.5, 0.6).p('gold', S.box(1.6, 0.03, 0.05), -1.0 + Math.sin(0.6) * 0.6, 0, -1.5 + Math.cos(0.6) * 0.6, 0.6);
      else {
        P.p('hide', S.box(2.2, 0.03, 1.5), -1.0, 0, -1.4, 0.4);
        for (let k = 0; k < 3; k++) P.p('barkLight', S.k('hoopDown', () => new THREE.TorusGeometry(0.75, 0.03, 4, 10, Math.PI).translate(0, 0.03, 0).rotateX(-Math.PI / 2)), -1.8 + k * 0.8, 0, -0.3, 0.4 + k * 0.3);
      }
      arrows(S, P, r, 8 + Math.floor(r() * 7), 4.2, 3.4);
      for (let k = 0; k < 6; k++) P.p('cloth', S.box(0.3, 0.012, 0.08), (r() - 0.5) * 3, 0, (r() - 0.5) * 3, r() * 6);
    },
    echo: (S, P, r) => { arrows(S, P, r, 4 + Math.floor(r() * 3), 1.4, 1.0); },
  },
  {
    // A picnic cut short: a striped cloth spread, the basket open, bread, a jug on its side and its wine spilled, cups, a hat blown off.
    name: 'picnic', R: 2.2, where: 'ground',
    make: (S, P, r) => {
      P.m('patch', 0, 0, 2.2, 1.9, 0).m('stain', 0.7, 0.8, 0.6, 0.4, 0.3);
      const [a, b] = pick(r, [['wine', 'straw'], ['teal', 'straw']] as [Col, Col][]);
      for (let k = 0; k < 5; k++) P.p(k % 2 ? b : a, S.box(0.46, 0.015, 1.9), -0.92 + k * 0.46, 0, 0, 0);
      P.p('gold', S.box(2.3, 0.02, 0.05), 0, 0, 0.95);
      basket(S, P, -0.6, -0.4, 0.26);
      P.p('plank', S.box(0.5, 0.02, 0.3), -0.6, 0.27, -0.7, 0.2, 1.1);
      P.p('bread', S.ball(0.12, 0.55), 0.3, 0.015, -0.4).p('bread', S.ball(0.09, 0.55), 0.5, 0.015, -0.1);
      P.p('teal', S.log(0.08, 0.26, 10), 0.4, 0.015, 0.45, 1.1);
      for (const [cx, cz] of [[-0.2, 0.4], [0.75, -0.6], [1.3, 0.9]] as const) P.p('stem', S.cyl(0.05, 0.04, 0.1, 8), cx, 0.015, cz);
      P.p('straw', S.cyl(0.32, 0.32, 0.03, 12), -1.6, 0, 1.2).p('straw', S.cyl(0.16, 0.18, 0.12, 10), -1.6, 0.03, 1.2).p('wine', S.ring(0.17, 0.02), -1.6, 0.06, 1.2);
      if (r() < 0.6) P.p('cap', S.ball(0.05), -0.1, 0.015, 0.0).p('cap', S.ball(0.05), -0.02, 0.015, 0.06);
    },
    echo: (S, P, r) => { P.p('stem', S.cyl(0.05, 0.04, 0.1, 8), 0, 0, 0); P.p('bread', S.ball(0.1, 0.55), 0.3, 0, 0.2); },
  },
  {
    // The charcoal burner's mound raked open: the black charcoal spread in a wide ring, the turf that covered it stacked, the rakes and the
    // shovel, the sacks filled, a ladder laid down.
    name: 'charcoal', R: 2.9, where: 'ground',
    make: (S, P, r) => {
      P.m('scorch', 0, 0, 2.2, 2.0, 0).m('patch', 0, 0, 3.0, 2.7, 0);
      P.p('ash', S.k('char', () => new THREE.CylinderGeometry(1.5, 1.9, 0.18, 14).translate(0, 0.09, 0)), 0, 0, 0);
      for (let k = 0; k < 10; k++) P.p('lacquer', S.log(0.07, q(0.8 + r() * 0.5, 0.25), 6), (r() - 0.5) * 2.4, 0.15, (r() - 0.5) * 2.2, r() * 6);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28 + 0.4; P.p('moss', S.box(0.6, 0.12, 0.45), Math.cos(a) * 2.5, 0, Math.sin(a) * 2.3, a); }
      P.p('barkLight', S.log(0.025, 2.0, 5), 1.0, 0, 1.9, 0.3).p('iron', S.box(0.1, 0.03, 0.6), 2.0, 0, 1.6, 0.3);
      P.p('barkLight', S.log(0.025, 1.6, 5), -1.8, 0, 1.4, 2.2).p('iron', S.box(0.3, 0.02, 0.35), -2.4, 0, 1.0, 2.2);
      for (let k = 0; k < 3; k++) P.p('cloth', S.ball(0.3, 0.7), -2.1 + k * 0.6, 0, -1.9, 0, 0, 1.1, 1, 1).p('lacquer', S.disc(0.16, 0.02), -2.1 + k * 0.6, 0.41, -1.9);
      for (const s of [-0.25, 0.25]) P.p('barkLight', S.log(0.03, 2.8, 5), 2.4, 0, -0.6 + s, 1.5);
      for (let k = 0; k < 6; k++) P.p('barkLight', S.box(0.5, 0.03, 0.05), 2.4, 0.04, -1.8 + k * 0.42 - 0.6 + 1.2, 1.5);
    },
    echo: (S, P, r) => { P.p('cloth', S.ball(0.3, 0.7), 0, 0, 0, 0, 0, 1.1, 1, 1); for (let k = 0; k < 4; k++) P.p('lacquer', S.log(0.06, 0.5, 6), 0.5 + (r() - 0.5), 0, (r() - 0.5), r() * 6); },
  },
  {
    // The rail of a footbridge broken: its long rail and a post down on the bank, the planks it took with it, the rope that held it.
    name: 'rail', R: 2.6, where: 'ground', brook: true,
    make: (S, P, r) => {
      P.m('patch', 0, -0.2, 2.6, 1.4, 0).m('wet', 0, 0.6, 2.4, 0.8, 0);
      P.p('plank', S.box(3.6, 0.1, 0.14), 0, 0, 0, 0.08).p('gold', S.box(0.16, 0.12, 0.16), 1.82, 0, -0.15, 0.08).p('gold', S.box(0.16, 0.12, 0.16), -1.82, 0, 0.15, 0.08);
      P.p('plank', S.box(0.14, 0.14, 1.2), -1.0, 0, -0.75, 0.3).p('barkLight', S.k('postStub', () => new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6).translate(0, 0.15, 0)), 1.6, 0, 0.5);
      for (let k = 0; k < 3; k++) P.p('plank', S.box(1.4, 0.06, 0.28), -0.6 + k * 0.9, 0, -1.3 - (k % 2) * 0.3, 0.4 * (k - 1));
      P.p('rope', S.log(0.02, 2.0, 4), 0.6, 0, 0.5, -0.2);
      coil(S, P, 1.9, -1.0);
    },
  },
  // --- past the edge (tall allowed) ---
  {
    // A woodcutter's yard: a log on the sawhorse, the cut rounds, a woodpile, the axe in the block.
    name: 'yard', R: 3.2, where: 'beyond',
    make: (S, P, r) => {
      for (const s of [-0.6, 0.6]) P.p('plank', S.box(0.08, 1.0, 0.08), s, 0, -0.3, 0, 0.35).p('plank', S.box(0.08, 1.0, 0.08), s, 0, 0.3, 0, -0.35);
      P.p('bark', S.log(0.2, 2.8, 10), 0.3, 0.75, 0);
      P.p('iron', S.box(1.0, 0.16, 0.012), -0.9, 0.95, 0.0, Math.PI / 2, 0).p('plank', S.box(0.1, 0.12, 0.05), -0.9, 0.95, 0.5);
      for (let row = 0; row < 5; row++) for (let i = 0; i < 6 - (row % 2); i++) P.p(i % 2 ? 'barkLight' : 'bark', S.log(0.12, 1.0, 7), -1.2 + i * 0.25 + (row % 2) * 0.12, row * 0.22, -1.6, Math.PI / 2);
      for (const s of [-1.45, 0.3]) P.p('bark', S.box(0.08, 1.3, 0.08), s, 0, -1.6);
      P.p('bark', S.cyl(0.35, 0.4, 0.45, 12), 1.6, 0, 0.9).p('bark', S.log(0.025, 0.75, 5), 1.6, 0.45, 0.9, 0.6, 0.9).p('iron', S.box(0.2, 0.06, 0.12), 1.6, 0.5, 0.9, 0.6);
      for (let k = 0; k < 4; k++) P.p('bark', S.cyl(0.18, 0.18, 0.3, 9), 0.5 + (r() - 0.5) * 1.6, 0, 1.2 + (r() - 0.5) * 0.8);
    },
  },
  {
    // The forester's woodshed: a lean-to roof on four posts over its stacked wood, the chopping block, a barrow, a lantern on its hook.
    name: 'woodshed', R: 3.0, where: 'beyond',
    make: (S, P, r) => {
      for (const [x, z, h] of [[-1.4, -0.8, 2.3], [1.4, -0.8, 2.3], [-1.4, 0.8, 1.8], [1.4, 0.8, 1.8]] as const) P.p('bark', S.box(0.14, h, 0.14), x, 0, z);
      P.p('wine', S.box(3.3, 0.1, 2.2), 0, 2.05, 0, 0, -0.25).p('gold', S.box(3.34, 0.06, 0.08), 0, 1.78, 1.08, 0, -0.25);
      for (let row = 0; row < 6; row++) for (let i = 0; i < 10 - (row % 2); i++) P.p(i % 2 ? 'barkLight' : 'bark', S.log(0.12, 1.2, 7), -1.15 + i * 0.25 + (row % 2) * 0.12, row * 0.22, -0.2, Math.PI / 2);
      P.p('bark', S.cyl(0.35, 0.4, 0.45, 12), 1.0, 0, 1.7).p('bark', S.log(0.025, 0.75, 5), 1.0, 0.45, 1.7, 0.6, 0.9).p('iron', S.box(0.2, 0.06, 0.12), 1.0, 0.5, 1.7, 0.6);
      P.p('plank', S.box(0.55, 0.3, 0.85), -1.3, 0, 1.6, 0.3).p('bark', S.ring(0.2, 0.035), -1.4, 0, 2.25, 0.3);
      P.p('lacquer', S.box(0.18, 0.28, 0.18), 1.55, 1.3, 0.85).p('gold', S.cyl(0.11, 0.11, 0.04, 8), 1.55, 1.58, 0.85);
    },
  },
];
export const WOOD_SCENE_KINDS = KINDS.map((k) => k.name);

/** Which kinds suit a place's kind (one or two are put near such a place, outside its ground). */
const BY_PLACE: Record<string, string[]> = {
  burners: ['charcoal', 'woodcut', 'logcart'], den: ['trap', 'fight'], bramble: ['gatherer'], thicket: ['trap', 'hunters'], stones: ['offering', 'wall'],
  giants: ['fight', 'fallen'], spring: ['picnic'], shrine: ['offering'], hollow: ['gatherer', 'hive'], lamps: ['gatherer', 'picnic'], heart: ['offering'],
};
/** Kinds for the trails' verges and the open glades. */
const ROADSIDE = ['woodcut', 'hunters', 'logcart', 'hive', 'gatherer', 'trap', 'offering', 'wall', 'fallen', 'fight', 'picnic', 'charcoal'];

export { scenesOff };

type MarkW = { t: MarkT; x: number; z: number; a: number; b: number; rot: number };
type LineW = { x1: number; z1: number; x2: number; z2: number; w: number };

/** Plans and adds the scenes of one Wood floor; returns where they stand (for the probe). */
export function buildWoodScenes(o: WoodScenesIn): Placed[] {
  // gold is drawn matte (brass) in the shared merged props, so the scenes open no cells of the polished gold of their own
  const { look, land, kit } = o;
  if (scenesOff()) return [];
  const rnd = seeded(SEED + look.seed);
  const { S, dispose } = shapes();
  const mats = new Map<string, THREE.Material>();
  const M = (key: Col) => {
    let m = mats.get(key);
    if (!m) { mats.set(key, (m = new THREE.MeshStandardMaterial({ color: key === 'gold' ? '#b8923e' : (C as Record<string, string>)[key] ?? '#d8cfb4' }))); o.own.push(m); }
    return m;
  };
  const roads: { ax: number; az: number; bx: number; bz: number }[] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push({ ax: RING.x + p[i - 1][0], az: RING.z + p[i - 1][1], bx: RING.x + p[i][0], bz: RING.z + p[i][1] });
  const cover = look.pieces.filter((p) => p.look !== 'edge').map((p) => p.o);
  const keep = o.keep, placed: Placed[] = [];
  const marks: MarkW[] = [], lines: LineW[] = [];
  const kinds = new Map(KINDS.map((k) => [k.name, k]));
  const cap = new Map<string, number>();
  for (const k of KINDS) cap.set(k.name, k.where === 'ground' ? 2 + Math.floor(rnd() * 3) + (rnd() < 0.5 ? 1 : 0) : 1);
  const used = new Map<string, number>();
  /** Each ground kind's squash: its tallest sample, drawn larger, brought down to the knee as a whole (parts stay stacked). */
  const squash = new Map<string, number>();
  for (const k of KINDS) {
    if (k.where !== 'ground') { squash.set(k.name, 1); continue; }
    let top = 0;
    for (let t = 0; t < 2; t++) {
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
  /** What is listed in the square of (x, z), or for a wider scene in the squares round it (a thing may come twice; the checks ask "any"). */
  function gather<T>(m: Map<number, T[]>, x: number, z: number, reachM: number): T[] {
    const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL);
    if (reachM + 3 <= NEAR) return m.get(cellKey(i0, j0)) ?? [];
    const n = Math.ceil((reachM + 3 - NEAR) / CELL), out: T[] = [];
    for (let i = i0 - n; i <= i0 + n; i++) for (let j = j0 - n; j <= j0 + n; j++) { const c = m.get(cellKey(i, j)); if (c) for (const t of c) out.push(t); }
    return out;
  }
  /** The cover and the trails by squares too (a segment in every square within its reach and NEAR m of it). */
  type Seg = { ax: number; az: number; bx: number; bz: number; r: number };
  const segCells = (list: Seg[]) => {
    const m = new Map<number, Seg[]>();
    for (const t of list) {
      const e2 = t.r + NEAR;
      for (let i = Math.floor((Math.min(t.ax, t.bx) - e2) / CELL); i <= Math.floor((Math.max(t.ax, t.bx) + e2) / CELL); i++) for (let j = Math.floor((Math.min(t.az, t.bz) - e2) / CELL); j <= Math.floor((Math.max(t.az, t.bz) + e2) / CELL); j++) {
        const key = cellKey(i, j);
        let c = m.get(key);
        if (!c) m.set(key, (c = []));
        c.push(t);
      }
    }
    return (x: number, z: number, reachM: number) => gather(m, x, z, reachM);
  };
  const coverNear = segCells(cover), roadsNear = segCells(roads.map((r) => ({ ...r, r: 0 })));
  const propsNear = (x: number, z: number, reachM: number) => gather(cells, x, z, reachM);
  const trees = o.taken.filter((t) => t.tree);
  const nearPass = (x: number, z: number, pad: number) => look.passes.some((p) => Math.hypot(x - p.x, z - p.z) < p.w + 3 + pad);
  const roadDist = (x: number, z: number) => { let d = 1e9; for (const s of roads) d = Math.min(d, segDist(x, z, s.ax, s.az, s.bx, s.bz)); return d; };

  /** `ground` is where the part's own height is measured from (its ground, lowered by the kind's squash); `floor` its real ground. */
  type Laid = { p: Part; wx: number; wz: number; wyaw: number; ground: number; floor: number; cx: number; cz: number; r: number; top: number; k: number; sy: number; area: number };
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
      const w = (bb.max.x - bb.min.x) * sx, d = (bb.max.z - bb.min.z) * sz;
      const r = Math.hypot(w, d) / 2 + lean * Math.max(Math.abs(bb.min.y), Math.abs(bb.max.y)) * sy;
      const L: Laid = { p, wx, wz, wyaw, ground: ground + p.y * k * fy - p.y * k, floor: ground, cx: wx + cy * ox + sy2 * oz, cz: wz - sy2 * ox + cy * oz, r, top, k, sy, area: w * d };
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
  /** How far a scene's parts reach from its middle (each part's place and its own size), for the checks' short lists. */
  const extent = (P: Parts, k: number) => {
    let R = 0;
    for (const p of P.list) {
      const bb = p.g.boundingBox!;
      R = Math.max(R, (Math.hypot(p.x, p.z) + Math.hypot(Math.max(-bb.min.x, bb.max.x) * p.s[0], Math.max(-bb.min.z, bb.max.z) * p.s[2]) + Math.abs(bb.max.y * Math.sin(p.tilt))) * k);
    }
    return R + 0.5;
  };

  /** The tests on each part: spots, cover, trails, the passes, places, the depth's props and brooks, trees; low and inside, or past the edge. */
  const partCheck = (where: Kind['where'], x: number, z: number, R: number) => {
    const nearKeep = keep.filter((s) => Math.hypot(s.x - x, s.z - z) < R + 3.5);
    const nearCover = coverNear(x, z, R).filter((c) => segDist(x, z, c.ax, c.az, c.bx, c.bz) < R + c.r + 1);
    const nearRoads = roadsNear(x, z, R).filter((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < R + 2.5);
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
      if (where === 'ground') { if (b > -0.8 - r || L.top > KNEE) return false; }
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
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + reach(k) + (p.echo ? 0.6 : 1.5))) return false;
    const b = beyondOf(x, z);
    if (k.where === 'ground' ? b > -1.2 : b < 3 || b > 16) return false;
    if (keep.some((s) => Math.hypot(s.x - x, s.z - z) < 3.2)) return false;
    if (roadsNear(x, z, 0).some((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 2.2)) return false;
    if (coverNear(x, z, 0).some((c) => segDist(x, z, c.ax, c.az, c.bx, c.bz) < c.r + 0.4)) return false;
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
  /** Writes laid parts into the merged props (one geometry a colour) and records them. */
  const commit = (name: string, laid: Laid[], px: number, pz: number, beyond: boolean, echo: boolean) => {
    const pts: [number, number][] = [];
    let top = 0, main = laid[0];
    const byKey = new Map<Col, { g: THREE.BufferGeometry; m: THREE.Matrix4 }[]>();
    for (const L of laid) {
      const cn = corners(L);
      let list = byKey.get(L.p.key);
      if (!list) byKey.set(L.p.key, (list = []));
      list.push({ g: L.p.g, m: m4.clone() });
      pts.push(...cn.pts, [L.cx, L.cz]);
      top = Math.max(top, cn.top);
      if (L.area > main.area) main = L;
    }
    for (const [key, list] of byKey) { const g = bake(list); kit.add(M(key), g, 0, 0, 0); g.dispose(); }
    let r = 0;
    for (const [qx, qz] of pts) r = Math.max(r, Math.hypot(qx - px, qz - pz));
    const rec: Placed = { kind: name, x: px, z: pz, r, beyond, top: +top.toFixed(2), main: [+main.cx.toFixed(2), +main.cz.toFixed(2)], pts: pts.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]) };
    if (echo) rec.echo = true;
    placed.push(rec);
    return rec;
  };
  const markOut = (P: Parts, x: number, z: number, yaw: number, mir: number, k: number) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const g of P.marks) {
      const lx = g.x * mir * k, lz = g.z * k;
      marks.push({ t: g.t, x: x + c * lx + s * lz, z: z - s * lx + c * lz, a: g.a * k, b: g.b * k, rot: yaw + g.rot * mir });
    }
  };
  /** Two wheel ruts from the nearest trail to a scene (the log cart). */
  const ruts = (x: number, z: number) => {
    let best: (typeof roads)[number] | null = null, bd = 16;
    for (const s of roads) { const d = segDist(x, z, s.ax, s.az, s.bx, s.bz); if (d < bd) { bd = d; best = s; } }
    if (!best || bd < 4) return;
    const ex = best.bx - best.ax, ez = best.bz - best.az, l2 = ex * ex + ez * ez, tt = Math.max(0, Math.min(1, ((x - best.ax) * ex + (z - best.az) * ez) / l2));
    const fx = best.ax + ex * tt, fz = best.az + ez * tt, ux = (x - fx) / bd, uz = (z - fz) / bd, along = (rnd() - 0.5) * 6;
    const sx = fx + ux * 1.6 - uz * along * 0.4, sz = fz + uz * 1.6 + ux * along * 0.4;
    for (const off of [-0.65, 0.65]) lines.push({ x1: sx - uz * off, z1: sz + ux * off, x2: x - uz * off - ux * 1.2, z2: z + ux * off - uz * 1.2, w: 0.32 });
  };
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
      const laid = lay(P, px, pz, yaw, mir, k.where !== 'ground', partCheck(k.where, px, pz, extent(P, k.where === 'ground' ? GROUND_SCALE : 1)), squash.get(name));
      if (!laid || !sceneFits(k, laid)) continue;
      const rec = commit(name, laid, px, pz, k.where !== 'ground', false);
      if (k.where === 'ground') markOut(P, px, pz, yaw, mir, GROUND_SCALE);
      if (k.trail === 'ruts') ruts(px, pz);
      used.set(name, (used.get(name) ?? 0) + 1);
      return rec;
    }
    return null;
  };
  /** A small echo of a kind (a log fallen off the cart, arrows towards the fight) at (x, z): looks only, low, its own record. */
  const tryEcho = (name: string, x: number, z: number) => {
    const k = kinds.get(name)!;
    if (!k.echo) return false;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 1.5)) return false;
    if (beyondOf(x, z) > -1.5 || nearPass(x, z, 1)) return false;
    const P = new Parts();
    k.echo(S, P, seeded(Math.floor(rnd() * 1e9)));
    const yaw = rnd() * 6.28, laid = lay(P, x, z, yaw, 1, false, partCheck('ground', x, z, extent(P, GROUND_SCALE)), squash.get(name));
    if (!laid) return false;
    commit(`echo-${name}`, laid, x, z, false, true);
    marks.push({ t: 'patch', x, z, a: 1.3, b: 1.0, rot: yaw });
    return true;
  };
  const shuffled = <T,>(xs: T[]) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 1. Near the places that suit them, outside their ground (one, or two at a big place).
  for (const p of shuffled(look.places)) {
    const opts = BY_PLACE[p.kind];
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
  // 2. By the brooks: a footbridge's rail broken on the bank, a few metres from where the trail crosses.
  for (const b of o.brooks) {
    for (let t = 0; t < 12; t++) {
      const i = 1 + Math.floor(rnd() * Math.max(1, b.length - 2)), [ax, az] = b[i - 1], [bx, bz] = b[Math.min(b.length - 1, i)];
      const L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L, side = rnd() < 0.5 ? 1 : -1, off = 4.8 + rnd() * 1.2;
      if (tryPut('rail', ax - uz * side * off, az + ux * side * off, 0.4, Math.atan2(-uz, ux))) break;
    }
  }
  // 3. Along the trails: about one every 20 to 30 m, on alternate verges; between two, now and then an echo of the one ahead.
  for (const s of shuffled(roads)) {
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (L < 8) continue;
    const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L;
    let side = rnd() < 0.5 ? 1 : -1;
    for (let d = 4 + rnd() * 10; d < L - 4; d += 18 + rnd() * 10) {
      side = -side;
      const names = shuffled(ROADSIDE);
      for (let j = 0; j < 9; j++) {
        // both verges, three distances, then shifted a few metres along the trail
        const name = names[j % names.length], k = kinds.get(name)!, sd = j % 2 ? -side : side;
        const off = 2.2 + reach(k) * 0.9 + rnd() * 1.0 + (j % 3) * 1.3, dd = d + (j >= 6 ? (j - 7) * 4 : 0);
        const rec = tryPut(name, s.ax + ux * dd - uz * sd * off, s.az + uz * dd + ux * sd * off, 0.8, name === 'fallen' ? Math.atan2(ux, uz) : undefined);
        if (rec) {
          if (k.echo && rnd() < 0.85) for (let t = 0; t < 4; t++) {
            const back = 10 + rnd() * 6, eo = 3.4 + rnd() * 1.6, de = dd - back * (t % 2 ? -1 : 1), se = t >= 2 ? -sd : sd;
            // past the end of this piece of trail too: the trail goes on, and the checks keep the echo off every trail
            if (tryEcho(name, s.ax + ux * de - uz * se * eo, s.az + uz * de + ux * se * eo)) break;
          }
          break;
        }
      }
    }
  }
  // 3a. Where a stretch of trail still shows no scene in the game's camera (the hero on the trail, the camera's own frame), one put ahead
  //     of it, off the trail: the stretches the verges' pass found no room on.
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 400), pv = new THREE.Vector3();
  const inView = (x: number, z: number) => {
    cam.position.set(x, 15 * 1.25, z + 10.5 * 1.25);
    cam.lookAt(x, 0.5, z - 1.5);
    cam.updateMatrixWorld();
    for (const p of placed) {
      if (p.echo || !p.main || Math.abs(p.main[0] - x) > 30 || p.main[1] - z > 8 || z - p.main[1] > 34) continue;
      pv.set(p.main[0], 0.3, p.main[1]).project(cam);
      if (pv.z < 1 && Math.abs(pv.x) < 0.92 && pv.y > -0.6 && pv.y < 0.9) return true;
    }
    return false;
  };
  for (const s of roads) {
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
    for (let d = 0; d < L; d += 8) {
      const x = s.ax + ((s.bx - s.ax) * d) / L, z = s.az + ((s.bz - s.az) * d) / L;
      if (beyondOf(x, z) > -2 || inView(x, z)) continue;
      const names = shuffled(ROADSIDE);
      for (let j = 0; j < 8; j++) {
        const a = rnd() * Math.PI * 2, r0 = 5 + rnd() * 8;
        if (tryPut(names[j % names.length], x + Math.cos(a) * r0 * 1.2, z - 6 + Math.sin(a) * r0 * 0.7, 0.8)) break;
      }
    }
  }
  // 3b. At the forks (three trails or more), a scene a little off the crossing.
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
  // 4. Round the floor's spots (the quest steps, the waystones, the people), 6 to 10 m off: where players stop.
  for (const sp of shuffled(keep).slice(0, 14)) {
    const a = rnd() * Math.PI * 2, d = 6 + rnd() * 4;
    tryPut(pick(rnd, ROADSIDE), sp.x + Math.cos(a) * d, sp.z + Math.sin(a) * d, 1.5);
  }
  // 5. The open glades between the places.
  const rmax = Math.max(...look.rim);
  for (let t = 0, made = 0; t < 200 && made < 10; t++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    if (beyondOf(x, z) > -4) continue;
    if (roads.some((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < 9)) continue;
    if (tryPut(pick(rnd, ROADSIDE), x, z, 0)) made++;
  }
  // 6. Past the edge, in clearings among the trees outside: a woodcutter's yard, the forester's woodshed.
  for (const name of ['yard', 'woodshed']) for (let t = 0; t < 300; t++) {
    const a = rnd() * Math.PI * 2, d = rimAt(look.rim, a) + 4 + rnd() * 8;
    if (tryPut(name, RING.x + Math.cos(a) * d, RING.z + Math.sin(a) * d, 1.5, Math.atan2(-Math.sin(a), Math.cos(a)))) break;
  }
  if (o.ground) paintGround(o.ground, marks, lines, { places: look.places, roadDist, brooks: brookPts });
  dispose();
  return placed;
}

/**
 * Paints the scenes' ground into the Wood's painted middle (woodZone.ts `paint`, about 15 to 18 pixels a metre): trodden earth under
 * each, a scorch under a fire or the charcoal, a dark stain, a pale spill of chips or finds, wet ground by a brook, two wheel ruts. Bold
 * shapes only; nothing on the trails' middles, the places' grounds or the brooks (each patch is shrunk to keep off them).
 */
function paintGround(ground: { map: THREE.Texture; L: number }, marks: MarkW[], lines: LineW[],
  keepOff: { places: { x: number; z: number; r: number }[]; roadDist: (x: number, z: number) => number; brooks: { x: number; z: number }[] }) {
  const canvas = ground.map.image as HTMLCanvasElement | undefined;
  const g = canvas?.getContext?.('2d');
  if (!canvas || !g) return;
  const size = canvas.width, ppm = size / ground.L, c = size / 2;
  const X = (x: number) => c + (x - RING.x) * ppm, Z = (z: number) => c + (z - RING.z) * ppm;
  const STYLE: Record<MarkT, [string, number, number]> = {
    patch: ['112,90,60', 0.6, 0.5],
    scorch: ['30,26,24', 0.85, 0.5],
    stain: ['50,18,28', 0.6, 0.65],
    wet: ['46,56,52', 0.5, 0.5],
    spill: ['196,170,120', 0.6, 0.55],
  };
  g.save();
  for (const m of marks) {
    let k = 1;
    const big = Math.max(m.a, m.b);
    for (const p of keepOff.places) k = Math.min(k, (Math.hypot(p.x - m.x, p.z - m.z) - p.r - 0.2) / big);
    k = Math.min(k, (keepOff.roadDist(m.x, m.z) - 1.4) / big);
    if (m.t !== 'wet') for (const b of keepOff.brooks) if (Math.abs(b.x - m.x) < big + 2 && Math.abs(b.z - m.z) < big + 2) k = Math.min(k, (Math.hypot(b.x - m.x, b.z - m.z) - 1.4) / big);
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
  g.strokeStyle = 'rgba(70,52,34,0.7)';
  for (const l of lines) { g.lineWidth = l.w * ppm; g.beginPath(); g.moveTo(X(l.x1), Z(l.z1)); g.lineTo(X(l.x2), Z(l.z2)); g.stroke(); }
  g.restore();
  ground.map.needsUpdate = true;
}
