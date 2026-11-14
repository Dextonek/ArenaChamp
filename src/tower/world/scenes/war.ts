import * as THREE from 'three';
import { scenesOff } from './off';
import { RING, seeded } from '../../../arenas/common';
import type { Battlefield, WarLook } from '../warZone';

/**
 * Scenes on a War floor (floors 41 to 50): little stories told in props (the user, 2026-11-14: "lets go through all floors and lets add
 * some depth again, like props on the maps, make actual scenarios and stuff"). The depth (`../warDepth.ts`) dressed the roads, the field
 * and the places; here something has *happened* between them. Looks only: nothing here is cover, nothing changes a walk, a shot, the
 * paths, the fights or the checks.
 *
 * - In the open ground, only low things (knee height, 0.6 m, at most): the aftermath of a clash (shields of both colours, swords,
 *   helmets, a fan of arrows, a trampled banner, a cart's wheel), a last stand (a ring of one army's shields round its fallen banner),
 *   a cold cook-fire, a smith's anvil and grindstone, stretchers and bandages, a wrecked catapult with its stones, fresh graves, a
 *   spilled supply cart, a field of stakes and caltrops, a dropped saddle and cut harness, a messenger's satchel and its papers.
 * - Against the cover: siege ladders broken in two at the foot of a wall (the leaning stub inside the band a hero cannot enter).
 * - Past the walkable edge, as background stories: a burned-out farmhouse with its chimney standing, a field hospital's tents under its
 *   army's banner, a graveyard of swords with helmets on them, a watchtower fallen in pieces.
 *
 * Each side of the field (look.crimson) uses its army's colour; the middle ground between the lines holds both. Floors 48 to 50, the
 * hardest, are the most scarred: more aftermath, burnt planks in it, more scenes.
 *
 * Placed by its own random stream (`seeded(8803 + look.seed)`), never the zone's, the depth's or `Math.random`: nothing that was there
 * moves. A scene keeps 3 m off the floor's spots (keep.ts), off the cover, the roads' middles, the places' rounds and the depth's own
 * props (`taken`). Built from shared primitives into one mesh of one matte material (the metals matte, as the depth's), casting no
 * shadow: one draw call for every scene on the floor. `globalThis.__warScenes = false` before a zone is built leaves them out
 * (for an A/B). `pipeline/tools/war-scenes-probe.js` lists every scene's footprint, measured from its vertices, and what it touches.
 */

type Pt = { x: number; z: number };
export type Taken = { x: number; z: number; r: number };
export type WarSceneKind =
  | 'aftermath' | 'laststand' | 'cookfire' | 'smithy' | 'hospital' | 'engine' | 'graves' | 'depot' | 'stakes' | 'saddle' | 'satchel'
  | 'ladder' | 'farmhouse' | 'tents' | 'graveyard' | 'watchtower';
export interface WarScene {
  kind: WarSceneKind;
  x: number; z: number; yaw: number; m: 1 | -1;
  /** The planned radius of its footprint. */
  R: number;
  side: 'crimson' | 'azure' | 'mid';
  /** Past the walkable edge (tall things allowed). */
  beyond: boolean;
  /** Leans on this cover piece (its index in look.pieces). */
  host?: number;
  /** Measured from the built vertices: the footprint's radius round (x, z), the tallest point above the ground. */
  r?: number; h?: number;
  /** For a leaning scene: how far past the host's own radius any part higher than knee height reaches. */
  tallReach?: number;
  /** For a leaning scene, measured: the least gap between any built vertex and another cover piece's body (its radius round its line). */
  gap?: number;
}
export interface WarScenesLog { seed: number; floor?: number; scenes: WarScene[]; taken: Taken[]; planMs: number; ms: number; tris: number }
/** The last build of each floor's scenes, by look.seed: what the probe reads (on `globalThis`, so a page tool's own import of this file
 * sees the game's, whichever copy of the module the dev server handed each). */
const G = globalThis as unknown as { __warScenesLog?: Map<number, WarScenesLog> };
export const warScenesLog: Map<number, WarScenesLog> = G.__warScenesLog ?? (G.__warScenesLog = new Map());
export const warScenesOn = () => (globalThis as unknown as { __warScenes?: boolean }).__warScenes !== false && !scenesOff();

/** Knee height: the most a scene in the walkable ground may rise. */
export const KNEE = 0.6;

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

/** Each kind's planned footprint radius (m) and where it may stand. */
const SIZE: Record<WarSceneKind, number> = {
  aftermath: 5.2, laststand: 4.4, cookfire: 3.0, smithy: 2.8, hospital: 3.8, engine: 4.7, graves: 4.2, depot: 3.8, stakes: 5.3,
  saddle: 2.7, satchel: 2.2, ladder: 2.6, farmhouse: 7.2, tents: 6.4, graveyard: 5.2, watchtower: 7.0,
};
const BEYOND: WarSceneKind[] = ['farmhouse', 'tents', 'graveyard', 'watchtower'];

// --- planning --------------------------------------------------------------------------------------------------------------------

export interface WarScenesPlanIn { look: WarLook; geo: Battlefield; keep: Pt[]; taken: Taken[]; floor?: number }

/** Where this floor's scenes go: pure numbers (no THREE object: the zone's ids and the depth's stream stay as they were). */
export function planWarScenes(o: WarScenesPlanIn): WarScene[] {
  const t0 = performance.now();
  const { look, geo, keep, taken } = o;
  const rnd = seeded(8803 + look.seed);
  const n = o.floor ?? 41, scarred = n >= 48;
  const rim = look.rim, rmax = Math.max(...rim);
  const beyondOf = (x: number, z: number) => geo.beyond(x - RING.x, z - RING.z);
  const behindLine = (x: number, z: number, pad: number) => z < look.line.z + 2 + pad && x > look.line.w - 3 - pad && x < look.line.e + 3 + pad;
  const sideOf = (x: number): WarScene['side'] => (Math.abs(x - RING.x) < 26 ? 'mid' : (x - RING.x) * look.crimson > 0 ? 'crimson' : 'azure');
  const cover = look.pieces.map((p, i) => ({ i, o: p.o, look: p.look, kind: look.kinds.find((k) => k[0] === i)?.[1] }));
  const roads: [number, number, number, number][] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push([RING.x + p[i - 1][0], RING.z + p[i - 1][1], RING.x + p[i][0], RING.z + p[i][1]]);
  const placed: WarScene[] = [];

  /** Whether a footprint of radius R at (x, z) is clear (in the open ground, or past the edge when `out`). */
  const clear = (x: number, z: number, R: number, out: boolean, host?: number) => {
    const b = beyondOf(x, z);
    if (out) {
      if (b < 4 + R || b > 9 + R) return false; // past the stake hedge (2 m out), near enough to be seen from the field
      if (geo.south(x - RING.x, z - RING.z) > 0.35) return false; // the camera's side: never seen
      for (let k = 0; k < 8; k++) { // flat enough to stand on
        const a = (k / 8) * Math.PI * 2;
        if (geo.steepness(x + Math.cos(a) * R * 0.7 - RING.x, z + Math.sin(a) * R * 0.7 - RING.z) > 0.16) return false;
      }
    } else if (b > -(R + 1.2)) return false;
    if (behindLine(x, z, host !== undefined ? -2 : R)) return false; // a ladder may stand at the siege line's foot, on the field's side
    for (const c of cover) {
      if (c.i === host) continue;
      // a scene leaning on a wall keeps its parts on the wall's field side: the wall's next pieces may be near its centre, never in it
      if (segDist(x, z, c.o.ax, c.o.az, c.o.bx, c.o.bz) < c.o.r + (host !== undefined ? 1.0 : R + (out ? 1 : 0.6))) return false;
    }
    if (!out) for (const r of roads) if (segDist(x, z, r[0], r[1], r[2], r[3]) < 2.5 + R) return false;
    for (const p of look.places) if (Math.hypot(x - p.x, z - p.z) < p.r + 1.5 + R) return false;
    for (const k of keep) if (Math.hypot(x - k.x, z - k.z) < 3.2 + R) return false;
    for (const t of taken) if (Math.hypot(x - t.x, z - t.z) < t.r + R + 0.3) return false;
    for (const s of placed) if (Math.hypot(x - s.x, z - s.z) < s.R + R + 4) return false;
    return true;
  };

  // How many of each kind this floor may have: the floor's own draw, so floor 42 and floor 49 do not look alike.
  const caps: Record<WarSceneKind, number> = {
    aftermath: scarred ? 6 : 3, laststand: scarred ? 2 : 1, cookfire: 2, smithy: 1, hospital: 2, engine: scarred ? 2 : 1, graves: scarred ? 3 : 2,
    depot: 2, stakes: scarred ? 3 : 2, saddle: 2, satchel: 1, ladder: 2, farmhouse: 1, tents: 1, graveyard: 1, watchtower: 1,
  };
  for (const k of Object.keys(caps) as WarSceneKind[]) if (!BEYOND.includes(k) && k !== 'aftermath' && rnd() < 0.18) caps[k] = Math.max(0, caps[k] - 1);
  const want = scarred ? 23 + Math.floor(rnd() * 3) : 16 + Math.floor(rnd() * 4);
  const count = (k: WarSceneKind) => placed.filter((s) => s.kind === k).length;
  const put = (kind: WarSceneKind, x: number, z: number, yaw: number, out = false, host?: number) => {
    placed.push({ kind, x, z, yaw, m: rnd() < 0.5 ? 1 : -1, R: SIZE[kind], side: sideOf(x), beyond: out, host });
  };
  /** Tries a kind at `tries` spots drawn by `spot`; the first clear one wins. */
  const attempt = (kind: WarSceneKind, tries: number, spot: () => Pt & { yaw?: number }) => {
    if (count(kind) >= caps[kind] || placed.length >= want) return false;
    for (let t = 0; t < tries; t++) {
      const p = spot();
      if (!clear(p.x, p.z, SIZE[kind], false)) continue;
      put(kind, p.x, p.z, p.yaw ?? rnd() * Math.PI * 2);
      return true;
    }
    return false;
  };
  const near = (p: { x: number; z: number; r: number }, kind: WarSceneKind) => () => {
    const a = rnd() * Math.PI * 2, d = p.r + 2 + SIZE[kind] + rnd() * 9;
    return { x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d };
  };

  // 1. Past the edge: one or two of the four far stories (three on the scarred floors), seen from the field's edge.
  const outs = BEYOND.slice().sort(() => rnd() - 0.5).slice(0, scarred ? 3 : 1 + Math.floor(rnd() * 2) + (rnd() < 0.4 ? 1 : 0));
  for (const kind of outs) {
    for (let t = 0; t < 160; t++) {
      const a = rnd() * Math.PI * 2, R = SIZE[kind], rr = rimAtLook(rim, a) + 4.5 + R + rnd() * 4;
      const x = RING.x + Math.cos(a) * rr, z = RING.z + Math.sin(a) * rr;
      if (!clear(x, z, R, true)) continue;
      put(kind, x, z, Math.atan2(RING.x - x, RING.z - z) + (rnd() - 0.5) * 0.8, true); // turned to face the field
      break;
    }
  }

  // 2. Against the siege line and the ruined walls: broken ladders (the stub leans inside the band a hero cannot enter).
  const walls = cover.filter((c) => c.look === 'house' && (c.kind === 'palisade' || c.kind === 'ruinwall' || c.kind === 'farmwall') && Math.hypot(c.o.bx - c.o.ax, c.o.bz - c.o.az) > 3);
  for (let t = 0; t < 60 && walls.length && count('ladder') < caps.ladder; t++) {
    const c = walls[Math.floor(rnd() * walls.length)], o2 = c.o, len = Math.hypot(o2.bx - o2.ax, o2.bz - o2.az);
    const f = 0.2 + rnd() * 0.6, wx = o2.ax + (o2.bx - o2.ax) * f, wz = o2.az + (o2.bz - o2.az) * f;
    const nx = -(o2.bz - o2.az) / len, nz = (o2.bx - o2.ax) / len;
    for (const s of [1, -1]) {
      // the field's side of the wall: the palisade's south, a ruin's open side
      const d = o2.r + 1.2, x = wx + nx * s * d, z = wz + nz * s * d;
      if (c.kind === 'palisade' && z < wz) continue;
      if (!clear(x, z, SIZE.ladder, false, c.i)) continue;
      // facing: local +z points at the wall
      put('ladder', x, z, Math.atan2(-nx * s, -nz * s), false, c.i);
      break;
    }
  }

  // 3. By the places, the stories that belong to them.
  const byPlace: Partial<Record<string, WarSceneKind[]>> = {
    hospital: ['hospital', 'graves'], works: ['engine', 'depot'], wagons: ['depot', 'saddle'], keep: ['graves', 'laststand'],
    hill: ['laststand', 'aftermath'], ridge: ['stakes', 'cookfire'], farm: ['saddle', 'cookfire'], mill: ['cookfire', 'saddle'],
    camp: ['smithy'], siege: ['aftermath', 'engine'],
  };
  for (const p of look.places.slice().sort(() => rnd() - 0.5)) {
    const kinds = byPlace[p.kind ?? ''] ?? [];
    for (const kind of kinds) if (rnd() < 0.8) attempt(kind, 40, near(p, kind));
  }

  // 4. Beside the roads (on the verge, never the middle) about every 50 m, and in the open ground between the places.
  const fieldKind = (x: number): WarSceneKind => {
    const s = sideOf(x), pool: WarSceneKind[] = s === 'mid'
      ? ['aftermath', 'aftermath', 'stakes', 'satchel', 'laststand', 'saddle', 'engine']
      : ['cookfire', 'hospital', 'depot', 'graves', 'saddle', 'smithy', 'aftermath', 'laststand', 'satchel'];
    if (scarred) pool.push('aftermath', 'aftermath', 'stakes');
    return pool[Math.floor(rnd() * pool.length)];
  };
  for (const p of look.paths.slice().sort(() => rnd() - 0.5)) {
    let since = 20 + rnd() * 20;
    for (let i = 1; i < p.length; i++) {
      const ax = RING.x + p[i - 1][0], az = RING.z + p[i - 1][1], bx = RING.x + p[i][0], bz = RING.z + p[i][1];
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / (L || 1), uz = (bz - az) / (L || 1);
      for (let s = 0; s < L; s += 2) {
        since += 2;
        if (since < 46 + rnd() * 14) continue;
        const cx = ax + ux * s, cz = az + uz * s, kind = fieldKind(cx), R = SIZE[kind], sd = rnd() < 0.5 ? 1 : -1;
        if (attempt(kind, 4, () => { const d = 2.6 + R + rnd() * 2.5; return { x: cx - uz * sd * d, z: cz + ux * sd * d }; })) since = 0;
      }
    }
  }
  for (let t = 0; t < 900 && placed.length < want; t++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    attempt(fieldKind(x), 1, () => ({ x, z }));
  }
  lastPlanMs = performance.now() - t0;
  return placed;
}
let lastPlanMs = 0;
function rimAtLook(rim: number[], a: number) {
  const n = rim.length, t = ((((a / (Math.PI * 2)) % 1) + 1) % 1) * n, i = Math.floor(t) % n, f = t - Math.floor(t), s = f * f * (3 - 2 * f);
  return rim[i] + (rim[(i + 1) % n] - rim[i]) * s;
}

// --- building --------------------------------------------------------------------------------------------------------------------

const COLOUR = {
  wood: '#4a3220', dark: '#2c211a', plank: '#6b4a2e', charred: '#3a3430', ash: '#4c4844', stone: '#7a766e', rubble: '#6c6860',
  earth: '#4a3c30', shot: '#56524e', soot: '#4a4440', mud: '#3e342c', leather: '#5a3a24', cream: '#c8bea4', paper: '#d0c8b0', linen: '#a49e90', canvas: '#9e9480',
  straw: '#b89a5a', sack: '#9a8a66', rope: '#b89a5a', leaf: '#3e5a30', wine: '#5e1a28', crimson: '#9a2c2c', azure: '#2c4c9a',
  steel: '#9a9ea8', iron: '#34363c', gold: '#c9a24a', tin: '#a2a4aa', // matte, as the depth's: one material for every scene
} as const;
type Colour = keyof typeof COLOUR;

/** Every scene on a floor, into four meshes. Called by warDepth.ts as its last step, inside its seeded `Math.random`. */
export function buildWarScenes(o: { look: WarLook; geo: Battlefield; into: THREE.Group; own: { dispose(): void }[]; scenes: WarScene[]; taken: Taken[]; floor?: number }) {
  const t0 = performance.now();
  const { look, geo, scenes } = o;
  const rnd = seeded(8807 + look.seed);
  const scarred = (o.floor ?? 41) >= 48;
  const H = (x: number, z: number) => geo.height(x - RING.x, z - RING.z);

  // The shared shapes: each made once a build, as plain arrays; the THREE geometry made for it is disposed at once.
  const prims = new Map<string, { p: Float32Array; n: Float32Array }>();
  const prim = (key: string, make: () => THREE.BufferGeometry) => {
    let pr = prims.get(key);
    if (!pr) {
      const g0 = make(), g = g0.index ? g0.toNonIndexed() : g0;
      pr = { p: Float32Array.from(g.attributes.position.array), n: Float32Array.from(g.attributes.normal.array) };
      g0.dispose(); g.dispose();
      prims.set(key, pr);
    }
    return pr;
  };
  /** Sizes to two significant figures: a beam 3.84 m long and one 3.8 m long share one shape (most of the build's time was new shapes). */
  const q2 = (v: number) => +v.toPrecision(2);
  const S = {
    box: (w: number, h: number, d: number) => { w = q2(w); h = q2(h); d = q2(d); return prim(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0)); },
    cyl: (r0: number, r1: number, h: number, n = 10) => { r0 = q2(r0); r1 = q2(r1); h = q2(h); return prim(`c${r0},${r1},${h},${n}`, () => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0)); },
    /** A cylinder lying along local x, resting on the ground. */
    log: (r: number, len: number, n = 8) => { r = q2(r); len = q2(len); return prim(`l${r},${len},${n}`, () => new THREE.CylinderGeometry(r, r, len, n).rotateZ(Math.PI / 2).translate(0, r, 0)); },
    cone: (r: number, h: number, n = 8) => { r = q2(r); h = q2(h); return prim(`k${r},${h},${n}`, () => new THREE.ConeGeometry(r, h, n).translate(0, h / 2, 0)); },
    dome: (r: number, n = 10) => { r = q2(r); return prim(`d${r},${n}`, () => new THREE.SphereGeometry(r, n, Math.max(3, n >> 1), 0, Math.PI * 2, 0, Math.PI / 2)); },
    ball: (r: number, n = 8) => { r = q2(r); return prim(`s${r},${n}`, () => new THREE.SphereGeometry(r, n, Math.max(3, n >> 1)).translate(0, r, 0)); },
    /** A ring lying flat on the ground. */
    ring: (R: number, t: number, n = 14) => { R = q2(R); t = q2(t); return prim(`t${R},${t},${n}`, () => new THREE.TorusGeometry(R, t, 5, n).rotateX(Math.PI / 2).translate(0, t, 0)); },
    stone: (r: number) => { r = q2(r); return prim(`i${r}`, () => new THREE.IcosahedronGeometry(r, 0).scale(1, 0.7, 1).translate(0, r * 0.6, 0)); },
    /** A flat sheet lying on the ground, facing up (cloth, paper, ash). */
    sheet: (w: number, d: number) => { w = q2(w); d = q2(d); return prim(`p${w},${d}`, () => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2)); },
    /** A sheet standing up (a hanging cloth), its top edge at y = 0. */
    cloth: (w: number, h: number) => { w = q2(w); h = q2(h); return prim(`h${w},${h}`, () => new THREE.PlaneGeometry(w, h).translate(0, -h / 2, 0)); },
  };

  // One sink for every scene on the floor (plain arrays, one mesh at the end: one draw call, no shadow pass; measured on the phone
  // profile, four meshes and their shadows cost more than the noise).
  const all = { p: new Float32Array(1 << 19), n: new Float32Array(1 << 19), c: new Float32Array(1 << 19), len: 0 };
  const room = (k: number) => {
    if (all.len + k <= all.p.length) return;
    const grow = (a: Float32Array) => { const b = new Float32Array(Math.max(a.length * 2, all.len + k)); b.set(a); return b; };
    all.p = grow(all.p); all.n = grow(all.n); all.c = grow(all.c);
  };
  const cols = new Map<Colour, THREE.Color>();
  const m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();

  // The scene being built: its place, turn and mirror, and a stack of sub-frames (a sword's own turn inside the scene).
  let cur: WarScene, cos = 1, sin = 0, fx = 0, fz = 0, fyaw = 0, fy = 0, hostSeg: [number, number, number, number, number] | null = null;
  let r2max = 0, hmax = 0, reach = -1e9, gap = 1e9, nearCover: [number, number, number, number, number][] = [];
  const sub = (lx: number, lz: number, yaw: number, fn: () => void, ly = 0) => {
    const sx = fx, sz = fz, syaw = fyaw, sy = fy, c = Math.cos(fyaw), s = Math.sin(fyaw);
    fx = sx + lx * c + lz * s; fz = sz - lx * s + lz * c; fyaw += yaw; fy += ly;
    fn();
    fx = sx; fz = sz; fyaw = syaw; fy = sy;
  };
  /** One part: a shape, its colour, its place in the current frame (y up from the ground), its turn, scale, tilt (about x) and roll. */
  const add = (shape: { p: Float32Array; n: Float32Array }, colour: Colour, lx: number, ly: number, lz: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0) => {
    const c = Math.cos(fyaw), s = Math.sin(fyaw);
    const px = (fx + lx * c + lz * s) * cur.m, pz = fz - lx * s + lz * c; // mirrored by the layout (x), never by a negative scale
    const wx = cur.x + px * cos + pz * sin, wz = cur.z - px * sin + pz * cos;
    const ground = cur.beyond ? H(wx, wz) : 0;
    e.set(tilt, cur.yaw + cur.m * (fyaw + yaw), cur.m * roll, 'YXZ');
    m4.compose(v.set(wx, ground + fy + ly, wz), q.setFromEuler(e), sc.set(sx, sy, sz));
    nm.getNormalMatrix(m4);
    let col = cols.get(colour);
    if (!col) cols.set(colour, (col = new THREE.Color(COLOUR[colour])));
    room(shape.p.length);
    const P = shape.p, N = shape.n, me = m4.elements, ne = nm.elements;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      const X = me[0] * x + me[4] * y + me[8] * z + me[12], Y = me[1] * x + me[5] * y + me[9] * z + me[13], Z = me[2] * x + me[6] * y + me[10] * z + me[14];
      const at = all.len; all.len += 3;
      all.p[at] = X; all.p[at + 1] = Y; all.p[at + 2] = Z;
      const a = N[i], b = N[i + 1], d = N[i + 2];
      let nx = ne[0] * a + ne[3] * b + ne[6] * d, ny = ne[1] * a + ne[4] * b + ne[7] * d, nz = ne[2] * a + ne[5] * b + ne[8] * d;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
      all.n[at] = nx; all.n[at + 1] = ny; all.n[at + 2] = nz;
      all.c[at] = col.r; all.c[at + 1] = col.g; all.c[at + 2] = col.b;
      // the footprint and height, measured from what is built
      const dx = X - cur.x, dz = Z - cur.z, rr = dx * dx + dz * dz, hy = Y - ground; // the ground under the part (past the edge the ground rolls a little under a part: close enough for a height)
      if (rr > r2max) r2max = rr;
      if (hy > hmax) hmax = hy;
      if (hostSeg && hy > KNEE) reach = Math.max(reach, segDist(X, Z, hostSeg[0], hostSeg[1], hostSeg[2], hostSeg[3]) - hostSeg[4]);
      for (const c of nearCover) gap = Math.min(gap, segDist(X, Z, c[0], c[1], c[2], c[3]) - c[4]);
    }
  };
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const other = (s: 'crimson' | 'azure'): 'crimson' | 'azure' => (s === 'crimson' ? 'azure' : 'crimson');
  /** The army colour of the current scene's side (the middle: either). */
  const army = (): 'crimson' | 'azure' => (cur.side === 'mid' ? (rnd() < 0.5 ? 'crimson' : 'azure') : cur.side);

  // --- the small things every scene is made of ------------------------------------------------------------------------------------
  /** A round shield lying on the ground: face up (its colour, gold rim and boss) or face down (its planks and iron strap); `tilt` props it up. */
  const shield = (lx: number, lz: number, colour: Colour, up: boolean, yaw = rnd() * 6.28, tilt = 0) => sub(lx, lz, yaw, () => {
    const y = 0.035 + Math.sin(Math.abs(tilt)) * 0.4;
    add(S.cyl(0.42, 0.42, 0.06, 14), up ? colour : 'plank', 0, y - 0.03, 0, 0, 1, 1, 1, tilt);
    if (up) {
      add(S.cyl(0.45, 0.45, 0.05, 14), 'gold', 0, y - 0.035, 0, 0, 1, 1, 1, tilt); // the rim: a gold disc a little wider, under the face
      add(S.cone(0.1, 0.08, 6), 'gold', 0, y + 0.03, 0, 0, 1, 1, 1, tilt);
    } else add(S.box(0.06, 0.02, 0.8), 'iron', 0, y + 0.03, 0, 0, 1, 1, 1, tilt);
  });
  /** A sword lying flat. */
  const sword = (lx: number, lz: number, yaw = rnd() * 6.28) => sub(lx, lz, yaw, () => {
    add(S.box(0.085, 0.018, 0.86), 'steel', 0, 0.012, 0.25);
    add(S.box(0.32, 0.04, 0.06), 'gold', 0, 0.01, -0.19);
    add(S.box(0.05, 0.04, 0.2), 'dark', 0, 0.01, -0.32);
    add(S.ball(0.035, 6), 'gold', 0, 0.002, -0.45);
  });
  /** A helmet: on its crown or on its side. */
  const helmet = (lx: number, lz: number, onSide = rnd() < 0.5) => sub(lx, lz, rnd() * 6.28, () => {
    add(S.dome(0.21, 10), 'steel', 0, onSide ? 0.21 : 0.02, 0, 0, 1, 1, 1, onSide ? 1.4 : 0);
    add(S.cyl(0.22, 0.22, 0.035, 10), 'gold', 0, onSide ? 0.21 : 0.02, 0, 0, 1, 1, 1, onSide ? 1.4 : 0);
    add(S.box(0.05, 0.03, 0.16), 'gold', 0, onSide ? 0.21 : 0.2, 0.14, 0, 1, 1, 1, onSide ? 1.4 : 0); // the nasal
  });
  /** An arrow stuck in the ground at a slant (pointing the way the volley flew). */
  const arrow = (lx: number, lz: number, yaw: number, tilt = 0.5) => sub(lx, lz, yaw, () => {
    add(S.cyl(0.012, 0.012, 0.6, 3), 'wood', 0, -0.02, 0, 0, 1, 1, 1, -tilt);
    add(S.box(0.004, 0.12, 0.06), 'paper', 0, -0.02 + 0.5, 0, 0, 1, 1, 1, -tilt);
  });
  /** A fan of arrows where a volley fell: `k` arrows, all leaning one way. */
  const volley = (lx: number, lz: number, k: number, spread = 1.4) => {
    const yaw = rnd() * 6.28, tilt = r(0.35, 0.6);
    for (let i = 0; i < k; i++) {
      const a = yaw + (i / Math.max(1, k - 1) - 0.5) * 1.1, d = r(0.2, spread);
      arrow(lx + Math.sin(a) * d, lz + Math.cos(a) * d, yaw + r(-0.12, 0.12), tilt + r(-0.08, 0.08));
    }
  };
  /** A spear lying, whole or broken in two. */
  const spear = (lx: number, lz: number, yaw = rnd() * 6.28, broken = rnd() < 0.5) => sub(lx, lz, yaw, () => {
    if (broken) {
      add(S.log(0.03, 1.1, 5), 'wood', 0, 0, 0);
      sub(0.9, 0.35, r(0.3, 0.8), () => { add(S.log(0.03, 1.0, 5), 'wood', 0, 0, 0); add(S.cone(0.05, 0.28, 4), 'steel', 0.62, 0.03, 0, 0, 1, 1, 1, 0, -Math.PI / 2); });
    } else {
      add(S.log(0.03, 2.4, 5), 'wood', 0, 0, 0);
      add(S.cone(0.05, 0.28, 4), 'steel', 1.32, 0.03, 0, 0, 1, 1, 1, 0, -Math.PI / 2);
    }
  });
  /** A banner trampled in the mud: its cloth flat on the ground, the pole broken in two, the gold finial apart. */
  const fallenBanner = (lx: number, lz: number, colour: 'crimson' | 'azure', yaw = rnd() * 6.28) => sub(lx, lz, yaw, () => {
    add(S.sheet(1.0, 1.6), colour, 0, 0.025, 0, r(-0.2, 0.2));
    add(S.sheet(0.5, 0.6), colour, 0.45, 0.03, 0.75, r(0.4, 0.9)); // a torn corner apart
    add(S.log(0.045, 1.6, 6), 'wood', 0, 0, -0.85, 0.06);
    add(S.log(0.045, 1.4, 6), 'wood', 1.7, 0, -0.5, 0.5);
    add(S.cone(0.1, 0.32, 5), 'gold', 2.5, 0.06, -0.1, 0, 1, 1, 1, 0, -Math.PI / 2);
    add(S.box(1.2, 0.07, 0.07), 'wood', 0, 0, -0.95);
  });
  /** A cart's wheel lying flat. */
  const wheel = (lx: number, lz: number, R = 0.5) => sub(lx, lz, rnd() * 6.28, () => {
    add(S.ring(R, 0.06, 16), 'dark', 0, 0, 0);
    for (let k = 0; k < 3; k++) add(S.box(0.06, 0.05, R * 2), 'wood', 0, 0.035, 0, (k / 3) * Math.PI);
    add(S.cyl(0.11, 0.11, 0.14, 8), 'iron', 0, 0, 0);
  });
  /** Where something burned: charred planks and a blackened shield or two (a dark disc on the drawn ground read as a decal). */
  const burnt = (lx: number, lz: number, R: number) => {
    for (let k = 0; k < 4; k++) add(S.box(0.16, 0.1, r(0.8, 1.6)), 'charred', lx + r(-R, R) * 0.6, 0, lz + r(-R, R) * 0.6, rnd() * 6, 1, 1, 1, 0, r(-0.1, 0.1));
    for (let k = 0; k < 2; k++) add(S.cyl(0.4, 0.4, 0.06, 12), 'charred', lx + r(-R, R) * 0.6, 0.005, lz + r(-R, R) * 0.6, 0, 1, 1, 1, r(-0.1, 0.1));
  };
  const crate = (lx: number, lz: number, open = false, yaw = rnd() * 6.28, s = 0.5) => sub(lx, lz, yaw, () => {
    add(S.box(s, s * 0.9, s), 'plank', 0, 0, 0);
    add(S.box(s + 0.02, 0.05, s + 0.02), 'iron', 0, s * 0.45, 0);
    if (open) { add(S.box(s, 0.04, s), 'plank', s * 0.9, 0, 0.2, 0.5); add(S.box(s * 0.85, 0.02, s * 0.85), 'straw', 0, s * 0.9 - 0.04, 0); }
    else add(S.box(s, 0.04, s), 'plank', 0, s * 0.9, 0);
  });
  const barrelLying = (lx: number, lz: number, yaw = rnd() * 6.28) => sub(lx, lz, yaw, () => {
    add(S.log(0.28, 0.8, 12), 'plank', 0, 0, 0);
    for (const s of [-0.28, 0.28]) add(S.log(0.29, 0.05, 12), 'iron', s, -0.01, 0);
  });
  const sack = (lx: number, lz: number) => add(S.ball(0.26, 8), 'sack', lx, 0, lz, rnd() * 6, 1, 0.7, 0.8);
  const bowl = (lx: number, lz: number, R = 0.12) => add(S.cyl(R, R * 0.7, R * 0.6, 10), 'tin', lx, 0, lz);
  const stool = (lx: number, lz: number) => { add(S.cyl(0.2, 0.2, 0.06, 10), 'plank', lx, 0.36, lz); for (let k = 0; k < 3; k++) { const a = (k / 3) * 6.28; add(S.box(0.05, 0.36, 0.05), 'wood', lx + Math.cos(a) * 0.13, 0, lz + Math.sin(a) * 0.13); } };

  // --- the kinds -------------------------------------------------------------------------------------------------------------------
  const KINDS: Record<WarSceneKind, () => void> = {
    /** Where two lines met: shields of both colours, swords, helmets, a volley's arrows, trampled banners, a wheel; burnt planks when scarred. */
    aftermath() {
      const a = army(), b = cur.side === 'mid' ? other(a) : rnd() < 0.35 ? other(a) : a;
      if (scarred) burnt(r(-1.5, 1.5), r(-1, 1), 2.6);
      // two lines met here: each army's shields thickest on its own side of the scene, mixed in the middle
      const k = scarred ? 12 + Math.floor(rnd() * 4) : 9 + Math.floor(rnd() * 3);
      for (let i = 0; i < k; i++) {
        const mine = i % 2 === 0, ang = (mine ? -1.57 : 1.57) + r(-1.4, 1.4), d = Math.sqrt(rnd()) * 3.4;
        shield(Math.sin(ang) * d, Math.cos(ang) * d * 0.8, mine ? a : b, rnd() < 0.75, undefined, rnd() < 0.2 ? r(0.15, 0.3) : 0);
      }
      for (let i = 0; i < 4 + Math.floor(rnd() * 3); i++) { const ang = rnd() * 6.28, d = r(0.4, 3.2); sword(Math.sin(ang) * d, Math.cos(ang) * d); }
      for (let i = 0; i < 3 + Math.floor(rnd() * 2); i++) { const ang = rnd() * 6.28, d = r(0.6, 3.4); helmet(Math.sin(ang) * d, Math.cos(ang) * d); }
      for (let i = 0; i < 3; i++) { const ang = rnd() * 6.28, d = r(0.8, 3); spear(Math.sin(ang) * d, Math.cos(ang) * d); }
      volley(r(-2, 2), r(-3.6, -2.6), 9 + Math.floor(rnd() * 4), 1.3);
      volley(r(-2.5, 2.5), r(2.4, 3.4), scarred ? 9 : 6, 1.1);
      fallenBanner(r(-1.6, -0.6), r(-0.6, 0.4), a);
      if (rnd() < 0.7) fallenBanner(r(0.8, 1.6), r(0.6, 1.4), b, rnd() * 6.28);
      if (rnd() < 0.6) wheel(r(-3.8, -3), r(-1, 1));
    },
    /** A last stand: a ring of one army's shields, face up and overlapping, round its fallen banner; spears laid outward. */
    laststand() {
      const a = army(), k = 9 + Math.floor(rnd() * 3), R = r(1.9, 2.3);
      for (let i = 0; i < k; i++) {
        if (rnd() < 0.12) continue; // one gone
        const ang = (i / k) * 6.28 + r(-0.1, 0.1);
        shield(Math.sin(ang) * R, Math.cos(ang) * R, a, rnd() < 0.85, ang, rnd() < 0.3 ? 0.2 : 0);
      }
      for (let i = 0; i < 5; i++) { const ang = rnd() * 6.28; sub(Math.sin(ang) * (R + 0.4), Math.cos(ang) * (R + 0.4), ang - Math.PI / 2, () => spear(0, 0, 0, false)); }
      fallenBanner(0, 0, a);
      helmet(r(-0.8, 0.8), r(-0.8, 0.8), true);
      volley(r(-1, 1), r(-1.2, 1.2), 9, 1.6);
      if (scarred) burnt(0, 0, 2.2);
    },
    /** A cook-fire just left: its ring of stones round the ash, a big pot on three stones, a ladle, a bench, tin bowls, bedrolls. */
    cookfire() {
      const a = army();
      add(S.cyl(0.75, 0.75, 0.02, 14), 'ash', 0, 0.005, 0);
      for (let k = 0; k < 10; k++) { const ang = (k / 10) * 6.28; add(S.stone(0.17), 'stone', Math.sin(ang) * 0.85, 0, Math.cos(ang) * 0.85, rnd() * 6); }
      for (let k = 0; k < 3; k++) add(S.log(0.07, 0.8, 6), 'charred', 0, 0.02, 0, (k / 3) * Math.PI + r(-0.2, 0.2));
      sub(1.45, 0.3, 0, () => { // the pot on its stones
        for (let k = 0; k < 3; k++) { const ang = (k / 3) * 6.28; add(S.stone(0.13), 'stone', Math.sin(ang) * 0.24, 0, Math.cos(ang) * 0.24); }
        add(S.cyl(0.32, 0.26, 0.36, 12), 'iron', 0, 0.14, 0);
        add(S.ring(0.32, 0.025, 12), 'iron', 0, 0.48, 0);
        add(S.box(0.04, 0.02, 0.55), 'tin', 0.2, 0.5, 0.1, 0.6, 1, 1, 1, -0.3); // the ladle over the rim
      });
      sub(-0.3, 1.7, r(-0.3, 0.3), () => { // a plank bench
        add(S.box(1.5, 0.06, 0.32), 'plank', 0, 0.36, 0);
        for (const s of [-0.6, 0.6]) add(S.box(0.08, 0.36, 0.28), 'wood', s, 0, 0);
        bowl(-0.3, 0); bowl(0.35, 0.02);
      });
      for (let k = 0; k < 3; k++) { const ang = r(2.2, 4.4), d = r(1.2, 1.9); bowl(Math.sin(ang) * d, Math.cos(ang) * d); add(S.box(0.025, 0.012, 0.2), 'tin', Math.sin(ang) * d + 0.16, 0, Math.cos(ang) * d, rnd() * 6); }
      sub(-1.9, -0.6, r(-0.4, 0.4) + Math.PI / 2, () => { add(S.box(0.75, 0.12, 1.8), a, 0, 0, 0); add(S.log(0.12, 0.75, 8), 'cream', 0, 0.06, -0.8); });
      if (rnd() < 0.7) sub(1.0, -1.6, r(-0.5, 0.5), () => { add(S.box(0.75, 0.1, 1.7), a, 0, 0, 0); add(S.log(0.11, 0.75, 8), 'cream', 0, 0.05, 0.75); });
      sack(-1.2, -1.9);
      add(S.log(0.18, 1.4, 8), 'wood', -1.9, 0, 1.1, 0.9);
    },
    /** A smith's corner: an anvil on its stump, a grindstone in its frame, a quench bucket, a hammer and tongs, blades waiting. */
    smithy() {
      const a = army();
      add(S.cyl(0.3, 0.34, 0.32, 10), 'wood', 0, 0, 0);
      add(S.box(0.22, 0.12, 0.5), 'iron', 0, 0.32, 0); add(S.box(0.3, 0.09, 0.62), 'iron', 0, 0.44, 0);
      add(S.cone(0.06, 0.22, 6), 'iron', 0, 0.485, 0.38, 0, 1, 1, 1, Math.PI / 2);
      sub(0.6, -0.1, 0.5, () => { add(S.box(0.05, 0.03, 0.32), 'dark', 0, 0, 0); add(S.box(0.14, 0.07, 0.07), 'iron', 0, 0, 0.18); }); // the hammer
      sub(-0.55, 0.35, 0, () => { // the grindstone: a stone wheel on its axle in a low frame, a trough under it
        add(S.box(0.9, 0.12, 0.08), 'wood', 0, 0.1, -0.2); add(S.box(0.9, 0.12, 0.08), 'wood', 0, 0.1, 0.2);
        for (const s of [-0.38, 0.38]) add(S.box(0.08, 0.32, 0.45), 'wood', s, 0, 0);
        add(S.cyl(0.25, 0.25, 0.1, 14), 'stone', 0, 0.3, -0.05, 0, 1, 1, 1, Math.PI / 2, 0);
        add(S.box(0.5, 0.08, 0.3), 'dark', 0, 0, 0);
      });
      sub(0.75, 0.7, 0, () => { add(S.cyl(0.24, 0.2, 0.42, 12), 'plank', 0, 0, 0); add(S.ring(0.245, 0.02, 12), 'iron', 0, 0.3, 0); add(S.cyl(0.22, 0.22, 0.01, 12), 'mud', 0, 0.38, 0); });
      for (let k = 0; k < 4; k++) sword(-0.9 + k * 0.22, -1.2, Math.PI / 2 + r(-0.15, 0.15));
      for (let k = 0; k < 2; k++) add(S.ring(0.08, 0.018, 8), 'iron', r(-1.4, 1.4), 0, r(1.2, 1.7));
      sub(-1.4, -0.4, r(-0.4, 0.4), () => { add(S.box(0.9, 0.36, 0.5), 'plank', 0, 0, 0); add(S.sheet(0.9, 0.55), a, 0, 0.365, 0); for (let k = 0; k < 3; k++) add(S.ball(0.08, 6), 'charred', r(-0.3, 0.3), 0.36, r(-0.15, 0.15)); });
      shield(1.6, -0.6, a, rnd() < 0.5);
      helmet(1.3, 1.5, false);
    },
    /** Where the wounded were carried: stretchers with their army's blankets, bandage rolls, a basin and jug, a stool, an opened chest. */
    hospital() {
      const a = army();
      for (let k = 0; k < 3; k++) sub((k - 1) * 1.05, r(-0.3, 0.3), r(-0.08, 0.08), () => {
        for (const s of [-0.32, 0.32]) add(S.box(0.05, 0.05, 2.3), 'wood', s, 0.12, 0);
        for (const e of [-1.0, 1.0]) for (const s of [-0.3, 0.3]) add(S.box(0.05, 0.12, 0.05), 'wood', s, 0, e);
        add(S.box(0.6, 0.015, 1.9), 'linen', 0, 0.16, 0);
        if (rnd() < 0.65) add(S.box(0.62, 0.05, 0.7), a, 0, 0.175, r(0.2, 0.6)); // a folded blanket
      });
      for (let k = 0; k < 5; k++) add(S.log(0.05, 0.12, 8), 'cream', r(-1.6, 1.6), 0, r(1.4, 2.1), rnd() * 6);
      add(S.sheet(0.08, 1.3), 'cream', r(-1, 1), 0.02, r(1.6, 2.2), r(1, 2)); // a bandage unrolled
      sub(2.2, 0.6, 0, () => { stool(0, 0); add(S.cyl(0.2, 0.13, 0.1, 12), 'tin', 0, 0.42, 0); add(S.cyl(0.18, 0.18, 0.005, 12), 'mud', 0, 0.5, 0); });
      add(S.cyl(0.08, 0.1, 0.26, 10), 'tin', 2.5, 0, 0.1);
      sub(-2.2, 0.8, 0.3, () => crate(0, 0, true, 0, 0.55));
      sub(-2.0, -1.2, r(0, 0.5), () => { add(S.box(0.9, 0.06, 0.9), a, 0, 0, 0); add(S.box(0.88, 0.06, 0.88), a, 0, 0.06, 0, 0.2); }); // folded cloth of the army
      for (let k = 0; k < 2; k++) helmet(r(-1.4, 1.4), r(-2, -1.6), true);
    },
    /** A catapult wrecked where it stood: its frame down, wheels flat, the throwing arm broken in two, its stone shot still stacked. */
    engine() {
      sub(0, 0, 0, () => {
        for (const s of [-0.8, 0.8]) add(S.box(0.28, 0.3, 3.4), 'plank', s, 0, 0);
        for (const e of [-1.3, 0, 1.3]) add(S.box(1.9, 0.18, 0.24), 'wood', 0, 0.06, e);
        add(S.box(0.24, 0.24, 1.9), 'wood', -1.4, 0, 0.2, 0.3); add(S.box(0.24, 0.24, 1.7), 'wood', 1.5, 0, -0.4, -0.5); // uprights fallen
        add(S.log(0.14, 1.7, 8), 'dark', 0, 0.3, -0.6); // the axle
      });
      wheel(-1.8, 1.9, 0.55); wheel(2.0, 1.4, 0.55); wheel(-2.1, -1.7, 0.55);
      sub(0.4, 1.6, 0.3, () => { // the arm in two pieces, the cup on the shorter one
        add(S.box(0.2, 0.18, 2.4), 'wood', 0, 0, 0);
        sub(0.9, 1.9, 0.9, () => { add(S.box(0.2, 0.18, 1.3), 'wood', 0, 0, 0); add(S.cyl(0.36, 0.22, 0.2, 10), 'iron', 0, 0, 0.75); });
      });
      for (let k = 0; k < 3; k++) add(S.ring(0.26, 0.05, 10), 'rope', r(-1.6, 1.6), 0, r(-2.2, -1.4));
      sub(2.4, -1.4, 0, () => { // the stone shot in a pyramid
        for (let i = 0; i < 6; i++) add(S.ball(0.17, 8), 'shot', (i % 3 - 1) * 0.36, 0, (i < 3 ? -0.2 : 0.2));
        for (let i = 0; i < 2; i++) add(S.ball(0.17, 8), 'shot', (i - 0.5) * 0.36, 0.26, 0);
        add(S.ball(0.17, 8), 'shot', 0.55, 0, 0.7);
      });
      if (scarred) burnt(0, 0, 2.6);
    },
    /** Fresh graves: low mounds, each with a helmet and a sword laid on it, a wreath on one, the spade left by the last. */
    graves() {
      const k = 3 + Math.floor(rnd() * 2), a = army();
      for (let i = 0; i < k; i++) sub((i - (k - 1) / 2) * 1.35, r(-0.2, 0.2), r(-0.06, 0.06), () => {
        add(S.ball(0.5, 10), 'earth', 0, -0.2, 0, 0, 1, 0.48, 2.0); // a low mound, 0.28 m
        sub(0, 0, 0, () => sword(0, -0.25, 0), 0.22);
        helmet(0, 1.2, false); // at the mound's foot
        if (i === 1) add(S.ring(0.22, 0.05, 12), 'leaf', 0.0, 0.2, 0.2);
        if (i === 1) for (let f = 0; f < 4; f++) add(S.ball(0.035, 5), a, Math.cos(f * 1.6) * 0.22, 0.22, 0.2 + Math.sin(f * 1.6) * 0.22);
      });
      sub(k * 0.7 + 0.4, 1.2, 0.5, () => { add(S.box(0.05, 0.05, 1.1), 'wood', 0, 0.02, 0); add(S.box(0.24, 0.02, 0.3), 'iron', 0, 0.01, 0.65); });
    },
    /** A supply cart's load spilled: crates (one broken open), barrels on their sides, sacks, sheaves of arrows, a spear rack fallen. */
    depot() {
      const a = army();
      sub(0, 0, r(-0.3, 0.3), () => { // the load still lashed under its army's tarp, the cart that carried it gone
        add(S.box(1.5, 0.5, 1.1), a, 0, 0, 0);
        for (const e of [-0.35, 0.35]) add(S.box(1.54, 0.03, 0.05), 'rope', 0, 0.48, e);
        add(S.box(0.05, 0.03, 1.14), 'rope', 0, 0.48, 0);
      });
      crate(1.2, -1.0, true); crate(-1.4, 1.1, true, undefined, 0.45);
      barrelLying(-1.5, -0.8); barrelLying(1.6, 0.8); if (rnd() < 0.6) barrelLying(0.4, -1.9);
      sack(-0.6, 1.6); sack(-0.2, 1.9); sack(2.4, -0.1);
      for (let k = 0; k < 3; k++) sub(r(-2.2, 2.2), r(-2.6, -1.6), rnd() * 6, () => { // sheaves of arrows, bound
        add(S.log(0.08, 0.7, 6), 'wood', 0, 0, 0); add(S.log(0.085, 0.05, 6), 'rope', 0, 0, 0);
        add(S.log(0.1, 0.12, 6), 'paper', 0.3, -0.02, 0);
      });
      for (let k = 0; k < 6; k++) sub(r(-2.5, 2.5), r(1.7, 2.6), rnd() * 6, () => { add(S.box(0.015, 0.015, 0.65), 'wood', 0, 0.01, 0); add(S.box(0.005, 0.06, 0.1), 'paper', 0, 0.01, -0.28); });
      sub(-2.4, 0, 0.3, () => { add(S.box(0.08, 0.08, 1.8), 'wood', 0, 0, 0); add(S.box(0.08, 0.08, 1.8), 'wood', 0.5, 0, 0); for (let k = 0; k < 3; k++) spear(0.3, (k - 1) * 0.4, Math.PI / 2 + r(-0.3, 0.3), false); });
    },
    /** A field staked against cavalry: three staggered rows of short sharpened stakes, caltrops scattered, the spade and the rope left. */
    stakes() {
      for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) {
        const z = (k - 3) * 1.1 + (row === 1 ? 0.55 : 0), x = 0.5 + row * 0.8;
        if (rnd() < 0.15) { add(S.cone(0.1, 0.7, 6), 'wood', x + 0.4, 0.1, z, rnd() * 6, 1, 1, 1, Math.PI / 2 - 0.1); continue; } // knocked flat
        sub(x, z, 0, () => { add(S.cyl(0.1, 0.1, 0.36, 6), 'wood', 0, 0, 0, 0, 1, 1, 1, 0, -0.55); add(S.cone(0.1, 0.2, 6), 'plank', -Math.sin(0.55) * 0.36, Math.cos(0.55) * 0.36, 0, 0, 1, 1, 1, 0, -0.55); });
      }
      for (let k = 0; k < 10; k++) { const x = r(2.4, 3.8), z = r(-3, 3); for (let t = 0; t < 4; t++) add(S.cone(0.035, 0.18, 3), 'iron', x, 0.02, z, (t / 4) * 6.28 + 0.4, 1, 1, 1, t === 3 ? 0 : 1.9); }
      add(S.ring(0.32, 0.07, 12), 'rope', r(-2.2, -1.6), 0, r(-2, 2));
      sub(-1.6, r(2, 3), 0.3, () => { add(S.box(0.06, 0.05, 1.1), 'wood', 0, 0.02, 0); add(S.box(0.26, 0.03, 0.32), 'iron', 0, 0.01, 0.68); }); // the spade
      if (scarred) for (let k = 0; k < 3; k++) shield(r(1.8, 3.6), r(-2.8, 2.8), army(), rnd() < 0.6);
      if (scarred) volley(r(2, 3.5), r(-2, 2), 8, 1.2);
    },
    /** A rider's end, without the horse: a dropped saddle on its blanket, the harness cut, a horseshoe, a broken lance with its pennon. */
    saddle() {
      const a = army();
      sub(0, 0, r(-0.4, 0.4), () => { // the horse's cloth in its army's colour, crumpled in two folds, the gold edge
        add(S.sheet(1.8, 1.3), a, 0, 0.02, 0, 0.05);
        add(S.box(1.4, 0.07, 0.8), a, 0.5, 0, -0.6, 0.6, 1, 1, 1, 0.1);
        add(S.box(1.82, 0.012, 0.06), 'gold', 0, 0.022, 0.64);
      });
      sub(-0.3, 0.1, r(-0.5, 0.5), () => { // the saddle on its side
        add(S.log(0.22, 0.7, 10), 'leather', 0, 0.02, 0, Math.PI / 2, 1.1, 0.8, 1.1);
        add(S.box(0.6, 0.3, 0.14), 'leather', 0, 0.02, -0.36); add(S.box(0.36, 0.24, 0.12), 'leather', 0, 0.02, 0.36);
        add(S.ring(0.1, 0.022, 8), 'gold', 0.45, 0.0, 0.1); add(S.ring(0.1, 0.022, 8), 'gold', -0.5, 0.0, -0.1);
      });
      sub(1.2, -0.6, 0, () => { helmet(0, 0, true); add(S.cone(0.09, 0.4, 6), a, 0, 0.3, -0.05, 0, 1, 1, 1, 1.3); }); // the plume
      for (let k = 0; k < 4; k++) sub(r(-1.5, 1.5), r(-1.6, 1.6), rnd() * 6, () => { add(S.box(0.07, 0.014, r(0.9, 1.4)), 'leather', 0, 0.006, 0); add(S.box(0.1, 0.024, 0.08), 'gold', 0, 0.01, 0.3); });
      add(S.ring(0.1, 0.024, 8), 'iron', r(-1.4, 1.4), 0, r(1.2, 1.7));
      sub(r(-0.4, 0.4), -1.6, r(-0.3, 0.3), () => { // the lance, broken, its pennon
        add(S.log(0.055, 2.0, 8), 'plank', 0, 0, 0); add(S.cone(0.07, 0.4, 5), 'steel', 1.0, 0.055, 0, 0, 1, 1, 1, 0, -Math.PI / 2);
        add(S.cyl(0.12, 0.05, 0.3, 8), 'gold', -1.0, 0.055, 0, 0, 1, 1, 1, 0, Math.PI / 2);
        sub(-1.6, 0.6, 0.7, () => { add(S.log(0.055, 1.1, 8), 'plank', 0, 0, 0); add(S.sheet(0.55, 0.35), a, -0.35, 0.06, 0.24, 0.3); });
      });
      sub(1.6, 1.1, 0, () => { add(S.cyl(0.2, 0.16, 0.34, 10), 'plank', 0, 0.17, 0, 0, 1, 1, 1, Math.PI / 2 - 0.15); add(S.sheet(0.6, 0.5), 'straw', 0, 0.01, 0.45); });
    },
    /** A messenger's last errand: the satchel on the ground, its papers blown about (no writing), the seal broken in two. */
    satchel() {
      sub(0, 0, rnd() * 6, () => { add(S.box(0.42, 0.14, 0.32), 'leather', 0, 0, 0); add(S.box(0.44, 0.02, 0.24), 'leather', 0, 0.12, 0.22, 0.4); add(S.box(0.05, 0.012, 1.2), 'leather', 0.5, 0.006, -0.1, 0.8); });
      const wind = rnd() * 6.28;
      for (let k = 0; k < 9; k++) { const d = r(0.4, 1.9), ang = wind + r(-0.8, 0.8); add(S.sheet(0.24, 0.32), 'paper', Math.sin(ang) * d, 0.015 + k * 0.001, Math.cos(ang) * d, rnd() * 6); }
      for (const s of [-1, 1]) add(S.cyl(0.05, 0.05, 0.02, 8, ), 'wine', 0.35 + s * 0.06, 0.012, -0.4 + s * 0.02, rnd() * 6, 1, 1, 0.5);
      add(S.box(0.3, 0.012, 0.02), 'gold', -0.4, 0.008, -0.35, 0.7); // the cord
      helmet(r(-0.8, 0.8), r(0.8, 1.2), true);
    },
    /** A siege ladder broken in two at the foot of a wall: the stub leans on the wall, the top half lies along it, a dropped shield. */
    ladder() {
      // local +z points at the wall; the scene's centre is 1.2 m out from the host's own radius
      const d = 1.2, len = 1.7, lean = 0.18;
      sub(0, d - 0.35, 0, () => {
        for (const s of [-0.26, 0.26]) add(S.box(0.07, len, 0.07), 'wood', s, 0, 0, 0, 1, 1, 1, lean);
        for (let k = 0; k < 4; k++) add(S.box(0.5, 0.05, 0.05), 'wood', 0, 0.25 + k * 0.38, Math.sin(lean) * (0.25 + k * 0.38));
      });
      sub(r(-0.4, 0.4), -0.2, Math.PI / 2 + r(-0.12, 0.12), () => {
        for (const s of [-0.26, 0.26]) add(S.box(0.07, 0.07, 2.6), 'wood', s, 0, 0);
        for (let k = 0; k < 6; k++) add(S.box(0.5, 0.05, 0.05), 'wood', 0, 0.01, (k - 2.5) * 0.4);
      });
      shield(r(-1.5, -0.9), r(-1.2, -0.5), army(), rnd() < 0.6);
      for (let k = 0; k < 4; k++) arrow(r(-1.6, 1.6), r(-1.6, -0.8), Math.PI + r(-0.2, 0.2), 0.5);
      helmet(r(0.9, 1.5), r(-1.2, -0.6));
    },
    /** Past the edge: a farmhouse burned out, its walls stubs, beams black and fallen, the chimney still standing. */
    farmhouse() {
      const W = 7, D = 5;
      const course = (x: number, z: number, len: number, along: boolean) => {
        for (let k = 0; k < Math.round(len / 1.1); k++) {
          const t = (k + 0.5) / Math.round(len / 1.1) - 0.5, h = r(0.4, 1.7);
          if (rnd() < 0.15) continue;
          add(S.box(along ? len / Math.round(len / 1.1) : 0.5, h, along ? 0.5 : len / Math.round(len / 1.1)), rnd() < 0.5 ? 'charred' : 'soot', x + (along ? t * len : 0), -0.1, z + (along ? 0 : t * len));
        }
      };
      course(0, -D / 2, W, true); course(0, D / 2, W, true); course(-W / 2, 0, D, false); course(W / 2, 0, D, false);
      add(S.box(1.1, 4.6, 1.1), 'soot', W / 2 - 0.3, -0.2, -0.6); add(S.box(1.2, 0.3, 1.2), 'charred', W / 2 - 0.3, 4.4, -0.6);
      for (let k = 0; k < 5; k++) add(S.box(0.22, 0.22, r(3.2, 4.6)), 'charred', r(-2.5, 2), r(0.2, 1.6), r(-1.6, 1.6), rnd() * 3, 1, 1, 1, r(-0.5, 0.5));
      sub(-1, 0, 0.4, () => { add(S.box(0.2, 0.2, 3.6), 'charred', 0, 0.5, 0, 0, 1, 1, 1, 0.4, 0.5); add(S.box(0.2, 0.2, 3.6), 'charred', 0.8, 0.5, 0, 0, 1, 1, 1, 0.4, -0.5); }); // the roof's frame down
      sub(0, D / 2 + 0.3, 0, () => { for (const s of [-0.6, 0.6]) add(S.box(0.22, 2.1, 0.22), 'dark', s, -0.1, 0); add(S.box(1.5, 0.22, 0.26), 'dark', 0, 2.0, 0); });
      for (let k = 0; k < 6; k++) add(S.stone(r(0.25, 0.45)), 'soot', r(-4, 4), -0.05, r(-3.5, 3.5), rnd() * 6);
      wheel(-4.6, 2.6, 0.5);
      sub(4.8, 2.4, 0.3, () => { add(S.box(1.2, 0.8, 0.6), 'plank', 0, 0, 0, 0, 1, 1, 1, 0.1); add(S.box(1.25, 0.06, 0.65), 'charred', 0, 0.8, 0); });
    },
    /** Past the edge: an army's field hospital, two bell tents under its banner, cots in a row, a basin and chests. */
    tents() {
      const a = cur.side === 'mid' ? 'crimson' : cur.side;
      for (const s of [-1, 1]) sub(s * 2.6, -1.2, rnd() * 3, () => {
        add(S.cone(2.0, 2.9, 8), 'canvas', 0, 0, 0); add(S.cyl(1.65, 2.02, 0.35, 8), a, 0, 0, 0);
        add(S.cyl(0.04, 0.04, 3.4, 5), 'gold', 0, 0, 0);
        add(S.box(0.8, 1.3, 0.05), 'dark', 0, 0, 1.75, 0, 1, 1, 1, -0.5);
      });
      sub(0, 2.2, 0, () => { // the banner: a pole, a crossbar, the army's cloth, a gold finial
        add(S.cyl(0.07, 0.09, 4.6, 6), 'wood', 0, 0, 0); add(S.box(1.2, 0.07, 0.07), 'wood', 0, 4.25, 0);
        add(S.cloth(1.0, 1.6), a, 0, 4.22, 0); add(S.cone(0.1, 0.32, 5), 'gold', 0, 4.6, 0);
      });
      for (let k = 0; k < 4; k++) sub((k - 1.5) * 1.1, 3.4, 0, () => { add(S.box(0.75, 0.42, 1.9), 'wood', 0, 0, 0); add(S.box(0.7, 0.08, 1.8), 'linen', 0, 0.42, 0); if (rnd() < 0.6) add(S.box(0.72, 0.05, 0.6), a, 0, 0.5, 0.5); });
      sub(-4.6, 2.4, 0, () => { stool(0, 0); add(S.cyl(0.2, 0.13, 0.1, 12), 'tin', 0, 0.42, 0); });
      crate(4.4, 2.0, true); crate(4.6, 3.0, false);
      for (let k = 0; k < 3; k++) add(S.log(0.05, 0.12, 8), 'cream', r(-1, 1), 0, r(0.4, 1.2), rnd() * 6);
    },
    /** Past the edge: a graveyard of the fallen, rows of mounds, a sword upright in each with a helmet on its hilt, a torn banner over them. */
    graveyard() {
      const a = cur.side === 'mid' ? (rnd() < 0.5 ? 'crimson' : 'azure') : cur.side;
      for (let row = 0; row < 2; row++) for (let k = 0; k < 5; k++) {
        if (rnd() < 0.12) continue;
        sub((k - 2) * 1.6 + (row ? 0.4 : 0), (row - 0.5) * 2.9, r(-0.05, 0.05), () => {
          add(S.ball(0.55, 10), 'earth', 0, -0.36, 0.5, 0, 1, 1, 1.9);
          add(S.box(0.06, 0.8, 0.014), 'steel', 0, -0.05, -0.55); add(S.box(0.3, 0.05, 0.05), 'gold', 0, 0.68, -0.55); add(S.box(0.045, 0.2, 0.045), 'dark', 0, 0.72, -0.55);
          add(S.dome(0.17, 10), 'steel', 0, 0.86, -0.55, rnd() * 6, 1, 1, 1, r(-0.15, 0.15)); add(S.cyl(0.18, 0.18, 0.03, 10), 'gold', 0, 0.86, -0.55);
        });
      }
      add(S.ring(0.26, 0.06, 12), 'leaf', 0.3, 0.05, -1.0);
      sub(-4.6, 0, 0, () => { add(S.cyl(0.07, 0.09, 3.8, 6), 'wood', 0, 0, 0, 0, 1, 1, 1, 0.05); add(S.box(1.1, 0.07, 0.07), 'wood', 0, 3.45, 0); add(S.cloth(0.95, 1.1), a, 0, 3.42, 0); add(S.cloth(0.4, 0.35), a, 0.28, 3.42 - 1.1, 0); });
    },
    /** Past the edge: a watchtower fallen in pieces, its frame on its side, the platform and roof apart, its ladder and planks strewn. */
    watchtower() {
      sub(0, 0, Math.PI / 2 + r(-0.15, 0.15), () => { // the frame on its side
        for (const [x, y] of [[-0.8, 0.12], [0.8, 0.12], [-0.8, 1.5], [0.8, 1.5]]) add(S.box(0.22, 0.22, 6.4), 'wood', x, y - 0.1, 0);
        for (let k = 0; k < 4; k++) { add(S.box(1.8, 0.14, 0.14), 'dark', 0, 0.1, (k - 1.5) * 2); add(S.box(0.14, 1.5, 0.14), 'dark', 0.8, 0.1, (k - 1.5) * 2); }
        add(S.box(2.0, 2.0, 0.18), 'plank', 0, -0.05, 3.3, 0, 1, 1, 1, 0.15);
        sub(0.6, 5.3, 0.5, () => add(S.cone(1.6, 1.4, 4), 'dark', 0, 0.6, 0, Math.PI / 4, 1, 1, 1, Math.PI / 2 - 0.15));
      });
      for (let k = 0; k < 6; k++) add(S.box(0.3, 0.05, r(1.2, 2)), 'plank', r(-4, 4), 0.02, r(-3.5, 3.5), rnd() * 6, 1, 1, 1, r(-0.1, 0.1));
      sub(-2.6, 2.6, 0.6, () => { for (const s of [-0.26, 0.26]) add(S.box(0.07, 0.07, 3.2), 'wood', s, 0, 0); for (let k = 0; k < 7; k++) add(S.box(0.5, 0.05, 0.05), 'wood', 0, 0.01, (k - 3) * 0.42); });
      shield(2.4, -2.6, army(), true, undefined, 0.3);
    },
  };

  // --- build each scene, measure it -------------------------------------------------------------------------------------------------
  for (const s of scenes) {
    cur = s; cos = Math.cos(s.yaw); sin = Math.sin(s.yaw); fx = fz = fyaw = fy = 0;
    r2max = 0; hmax = 0; reach = -1e9; gap = 1e9;
    const hp = s.host !== undefined ? look.pieces[s.host]?.o : undefined;
    hostSeg = hp ? [hp.ax, hp.az, hp.bx, hp.bz, hp.r] : null;
    nearCover = s.host === undefined ? [] : look.pieces.filter((p, i) => i !== s.host && segDist(s.x, s.z, p.o.ax, p.o.az, p.o.bx, p.o.bz) < p.o.r + s.R + 6).map((p) => [p.o.ax, p.o.az, p.o.bx, p.o.bz, p.o.r]);
    KINDS[s.kind]();
    s.r = +Math.sqrt(r2max).toFixed(2); s.h = +hmax.toFixed(2);
    if (hostSeg) { s.tallReach = +reach.toFixed(2); s.gap = +gap.toFixed(2); }
  }

  let tris = 0;
  if (all.len) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(all.p.slice(0, all.len), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(all.n.slice(0, all.len), 3));
    g.setAttribute('color', new THREE.BufferAttribute(all.c.slice(0, all.len), 3));
    g.computeBoundingSphere();
    tris = all.len / 9;
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'war-scenes';
    mesh.receiveShadow = true;
    o.into.add(mesh);
    o.own.push(g, mat);
  }
  warScenesLog.set(look.seed, { seed: look.seed, floor: o.floor, scenes, taken: o.taken, planMs: +lastPlanMs.toFixed(1), ms: +(performance.now() - t0).toFixed(1), tris: Math.round(tris) });
}
