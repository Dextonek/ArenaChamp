import * as THREE from 'three';
import { scenesOff } from './off';
import { RING, seeded } from '../../../arenas/common';
import type { Battlefield, WarLook } from '../warZone';

/**
 * Scenes on a War floor (floors 41 to 50): little stories told in props (the user, 2026-11-14: "lets go through all floors and lets add
 * some depth again, like props on the maps, make actual scenarios and stuff"; then "continue more refine"). The depth (`../warDepth.ts`)
 * dressed the roads, the field and the places; here something has *happened* between them. Looks only: nothing here is cover, nothing
 * changes a walk, a shot, the paths, the fights or the checks.
 *
 * Each story has one main piece big enough to read from the game's camera at its centre (a great standard fallen flat, a war cart's
 * bed, a catapult, a ram, a trench's line of sandbags, a dispatch chest...), its spill round it, and a ground of its own painted into the
 * zone's map (churned mud, trampled grass, scorch, wheel ruts and drag marks to the road, hoof marks, spilled grain, a soft dark under the
 * big pieces, which cast no shadow). Every kind has two or three layouts; floors pick which comes first (the ladder and the far stories
 * by the floor's seed).
 * - In the open ground, only low things (knee height, 0.6 m, at most): the aftermath of a clash, a last stand, a camp's fire, a smith's
 *   forge, the wounded's stretchers, a wrecked siege engine, fresh graves, a spilled load, a field of stakes or spiked logs, a rider's
 *   caparison and saddle, a courier's chest and papers, a broken trench, an abandoned ram, the drummers' drums, a banner still
 *   smouldering (a thin smoke), captured shields, a supply tower pulled down; and between a story and the road, echo props (`trail`:
 *   arrows towards the fight, a crate fallen from the load, a wheel) so the stories connect along the way.
 * - Against the cover: siege ladders broken in two at the foot of a wall (the leaning stub inside the band a hero cannot enter).
 * - Past the walkable edge, as background stories: a burned-out farmhouse still smoking, a field hospital's tents under its army's banner,
 *   a graveyard of swords with helmets on them, a watchtower fallen in pieces; each on a draped disc of its own ground.
 *
 * Each side of the field (look.crimson) uses its army's colour; the middle ground between the lines holds both. Floors 48 to 50, the
 * hardest, are the most scarred: more aftermath, trenches and smouldering, burnt planks and craters, more scenes.
 *
 * Placed by its own random stream (`seeded(8803 + look.seed)`), never the zone's, the depth's or `Math.random`: nothing that was there
 * moves. A scene keeps 3 m off the floor's spots (keep.ts), off the cover, the roads' middles, the places' rounds and the depth's own
 * props (`taken`). Built from shared primitives into one mesh of one matte material (the metals matte, as the depth's), casting no
 * shadow: one draw call for every scene on the floor, and one more for the smoke where something smoulders. `globalThis.__warScenes =
 * false` (or scenes/off.ts's switch) before a zone is built leaves them out, their paint and smoke too.
 * `pipeline/tools/war-scenes-probe.js` lists every scene's footprint, measured from its vertices, and what it touches;
 * `pipeline/tools/war-views-probe.js` measures how many of the game camera's views show one.
 */

type Pt = { x: number; z: number };
export type Taken = { x: number; z: number; r: number };
export type WarSceneKind =
  | 'aftermath' | 'laststand' | 'cookfire' | 'smithy' | 'hospital' | 'engine' | 'graves' | 'depot' | 'stakes' | 'saddle' | 'satchel'
  | 'trench' | 'ram' | 'drums' | 'smoulder' | 'captured' | 'stores' | 'trail'
  | 'ladder' | 'farmhouse' | 'tents' | 'graveyard' | 'watchtower';
export interface WarScene {
  kind: WarSceneKind;
  x: number; z: number; yaw: number; m: 1 | -1;
  /** The planned radius of its footprint. */
  R: number;
  side: 'crimson' | 'azure' | 'mid';
  /** Which of the kind's layouts (a different main piece or state); for an echo prop (`trail`), what it echoes. */
  v: number;
  /** Past the walkable edge (tall things allowed). */
  beyond: boolean;
  /** Leans on this cover piece (its index in look.pieces). */
  host?: number;
  /** Measured from the built vertices: the footprint's radius round (x, z), the tallest point above the ground. */
  r?: number; h?: number;
  /** The radius of its main piece (the thing that tells the story, at its centre): what the views probe asks to be big enough. */
  mr?: number;
  /** For a leaning scene: how far past the host's own radius any part higher than knee height reaches. */
  tallReach?: number;
  /** For a leaning scene, measured: the least gap between any built vertex and another cover piece's body (its radius round its line). */
  gap?: number;
}
export interface WarScenesLog {
  seed: number; floor?: number; scenes: WarScene[]; taken: Taken[]; planMs: number; ms: number; paintMs: number; tris: number; smokes: number;
}
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
/** The squared distance from a point to a segment (no square root: the planner asks it thousands of times a floor). */
const segDist2 = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  const dx = px - (ax + ex * t), dz = pz - (az + ez * t);
  return dx * dx + dz * dz;
};
/** Whether (x, z) is nearer than `d` to (px, pz). */
const within = (x: number, z: number, px: number, pz: number, d: number) => { const dx = x - px, dz = z - pz; return dx * dx + dz * dz < d * d; };

/** Each kind's planned footprint radius (m). */
const SIZE: Record<WarSceneKind, number> = {
  aftermath: 6.6, laststand: 5.2, cookfire: 4.2, smithy: 4.4, hospital: 5.4, engine: 6.4, graves: 5.6, depot: 5.8, stakes: 6.4,
  saddle: 5.8, satchel: 5.4, trench: 6.6, ram: 6.2, drums: 5.5, smoulder: 4.6, captured: 5.1, stores: 5.6, trail: 1.6,
  ladder: 2.6, farmhouse: 7.2, tents: 6.4, graveyard: 5.2, watchtower: 7.0,
};
/** How many layouts each kind has. */
const VARIANTS: Partial<Record<WarSceneKind, number>> = {
  aftermath: 2, laststand: 2, cookfire: 2, smithy: 2, hospital: 2, engine: 3, graves: 2, depot: 2, stakes: 2, saddle: 2, satchel: 2,
  trench: 2, ram: 2, drums: 2, smoulder: 2, captured: 2, stores: 2,
};
const BEYOND: WarSceneKind[] = ['farmhouse', 'tents', 'graveyard', 'watchtower'];
/** Kinds with two layouts whose first is chosen by the floor's seed, not drawn (added after the first refinement: drawing would move
 * every other story). */
const SEEDED: WarSceneKind[] = ['ladder', 'farmhouse', 'tents', 'graveyard', 'watchtower'];
/** What an echo prop between a scene and the road shows: 0 arrows towards the fight, 1 a dropped crate and sack, 2 a shield and a
 * helmet, 3 a wheel (or a stone shot in its crater), 4 papers blown along. */
const ECHO: Partial<Record<WarSceneKind, number[]>> = {
  aftermath: [0, 2], laststand: [0, 2], stakes: [0, 2], trench: [0, 2], drums: [2, 0], captured: [2], depot: [1], stores: [1],
  engine: [3], ram: [3], saddle: [2, 3], satchel: [4], hospital: [1, 2], smoulder: [3, 0], graves: [2], cookfire: [1], smithy: [2],
};

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

  /** Whether a footprint of radius R at (x, z) is clear (in the open ground, or past the edge when `out`). `small`: an echo prop, which
   * may stand nearer the scenes. */
  const clear = (x: number, z: number, R: number, out: boolean, host?: number, small = false) => {
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
    // the cheap and most often failing tests first (squared distances: the same answers, a fraction of the time)
    for (const s of placed) if (within(x, z, s.x, s.z, s.R + R + (small || s.kind === 'trail' ? 1.2 : 3.5))) return false;
    for (const p of look.places) if (within(x, z, p.x, p.z, p.r + 1.5 + R)) return false;
    for (const k of keep) if (within(x, z, k.x, k.z, 3.2 + R)) return false;
    if (!out) for (const r of roads) { const d = 2.5 + R; if (segDist2(x, z, r[0], r[1], r[2], r[3]) < d * d) return false; }
    for (const t of taken) if (within(x, z, t.x, t.z, t.r + R + 0.3)) return false;
    for (const c of cover) {
      if (c.i === host) continue;
      // a scene leaning on a wall keeps its parts on the wall's field side: the wall's next pieces may be near its centre, never in it
      const d = c.o.r + (host !== undefined ? 1.0 : R + (out ? 1 : 0.6));
      if (segDist2(x, z, c.o.ax, c.o.az, c.o.bx, c.o.bz) < d * d) return false;
    }
    return true;
  };

  // How many of each kind this floor may have: the floor's own draw, so floor 42 and floor 49 do not look alike.
  const caps: Record<WarSceneKind, number> = {
    aftermath: scarred ? 6 : 4, laststand: scarred ? 3 : 2, cookfire: 3, smithy: 1, hospital: 2, engine: 2, graves: scarred ? 3 : 2, depot: 3,
    stakes: scarred ? 3 : 2, saddle: 3, satchel: 2, trench: scarred ? 3 : 2, ram: scarred ? 2 : 1, drums: 2, smoulder: scarred ? 3 : 1,
    captured: 2, stores: 2, trail: scarred ? 16 : 12,
    ladder: 2, farmhouse: 1, tents: 1, graveyard: 1, watchtower: 1,
  };
  for (const k of Object.keys(caps) as WarSceneKind[]) if (!BEYOND.includes(k) && k !== 'aftermath' && k !== 'trail' && rnd() < 0.2) caps[k] = Math.max(0, caps[k] - 1);
  const want = scarred ? 33 + Math.floor(rnd() * 4) : 27 + Math.floor(rnd() * 4);
  // which layout each kind starts with on this floor (then they take turns), so floor 42's aftermath is not floor 45's
  const first: Partial<Record<WarSceneKind, number>> = {};
  for (const k of Object.keys(VARIANTS) as WarSceneKind[]) first[k] = Math.floor(rnd() * VARIANTS[k]!);
  for (const k of SEEDED) first[k] = (look.seed + k.length) % 2;
  const count = (k: WarSceneKind) => placed.filter((s) => s.kind === k).length;
  const stories = () => placed.filter((s) => s.kind !== 'trail').length;
  const put = (kind: WarSceneKind, x: number, z: number, yaw: number, out = false, host?: number, v?: number) => {
    const nv = VARIANTS[kind] ?? (SEEDED.includes(kind) ? 2 : 1);
    placed.push({ kind, x, z, yaw, m: rnd() < 0.5 ? 1 : -1, R: SIZE[kind], side: sideOf(x), v: v ?? ((first[kind] ?? 0) + count(kind)) % nv, beyond: out, host });
  };
  /** Tries a kind at `tries` spots drawn by `spot`; the first clear one wins. */
  const attempt = (kind: WarSceneKind, tries: number, spot: () => Pt & { yaw?: number }) => {
    if (count(kind) >= caps[kind] || stories() >= want) return false;
    for (let t = 0; t < tries; t++) {
      const p = spot();
      if (!clear(p.x, p.z, SIZE[kind], false)) continue;
      put(kind, p.x, p.z, p.yaw ?? rnd() * Math.PI * 2);
      return true;
    }
    return false;
  };
  const near = (p: { x: number; z: number; r: number }, kind: WarSceneKind) => () => {
    const a = rnd() * Math.PI * 2, d = p.r + 2 + SIZE[kind] + rnd() * 8;
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

  // 3. Beside the roads first (where players walk; on the verge, never the middle), about every 26 to 34 m, alternating sides.
  const fieldKind = (x: number): WarSceneKind => {
    const s = sideOf(x), pool: WarSceneKind[] = s === 'mid'
      ? ['aftermath', 'aftermath', 'stakes', 'trench', 'satchel', 'laststand', 'saddle', 'engine', 'smoulder', 'drums', 'ram']
      : ['cookfire', 'hospital', 'depot', 'graves', 'saddle', 'smithy', 'aftermath', 'laststand', 'satchel', 'captured', 'stores', 'drums', 'trench'];
    if (scarred) pool.push('aftermath', 'aftermath', 'stakes', 'trench', 'smoulder', 'engine');
    return pool[Math.floor(rnd() * pool.length)];
  };
  for (const p of look.paths.slice().sort(() => rnd() - 0.5)) {
    let since = 10 + rnd() * 14, sd = rnd() < 0.5 ? 1 : -1;
    for (let i = 1; i < p.length; i++) {
      const ax = RING.x + p[i - 1][0], az = RING.z + p[i - 1][1], bx = RING.x + p[i][0], bz = RING.z + p[i][1];
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / (L || 1), uz = (bz - az) / (L || 1);
      for (let s = 0; s < L; s += 2) {
        since += 2;
        if (since < 26 + rnd() * 8) continue;
        const cx = ax + ux * s, cz = az + uz * s;
        for (let k = 0; k < 4; k++) { // a different kind if the first does not fit; either side
          const kind = fieldKind(cx), R = SIZE[kind];
          const side = k < 2 ? sd : -sd;
          if (attempt(kind, 5, () => { const d = 2.7 + R + rnd() * 3; return { x: cx - uz * side * d, z: cz + ux * side * d }; })) { since = 0; sd = -side; break; }
        }
      }
    }
  }
  // 4. By the places, the stories that belong to them; then the open ground between them.
  const byPlace: Partial<Record<string, WarSceneKind[]>> = {
    hospital: ['hospital', 'graves'], works: ['engine', 'stores', 'depot'], wagons: ['depot', 'stores', 'saddle'], keep: ['graves', 'captured', 'laststand'],
    hill: ['drums', 'laststand', 'aftermath'], ridge: ['trench', 'stakes', 'cookfire'], farm: ['smoulder', 'saddle', 'cookfire'],
    mill: ['smoulder', 'cookfire', 'saddle'], camp: ['smithy', 'captured'], siege: ['ram', 'aftermath', 'engine'],
  };
  for (const p of look.places.slice().sort(() => rnd() - 0.5)) {
    const kinds = byPlace[p.kind ?? ''] ?? [];
    for (const kind of kinds) if (rnd() < 0.75) attempt(kind, 50, near(p, kind));
  }

  for (let t = 0; t < 1500 && stories() < want; t++) {
    const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
    attempt(fieldKind(x), 1, () => ({ x, z }));
  }

  // 5. Echo props: between a story and the nearest road, something of it dropped on the way (arrows towards the fight, a crate fallen
  // from the load, a wheel), so the stories connect along the way.
  const nearestRoad = (x: number, z: number) => {
    let best = { d: 1e9, x: 0, z: 0 };
    for (const r of roads) {
      const ex = r[2] - r[0], ez = r[3] - r[1], l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - r[0]) * ex + (z - r[1]) * ez) / l2)) : 0;
      const px = r[0] + ex * t, pz = r[1] + ez * t, d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { d, x: px, z: pz };
    }
    return best;
  };
  /** Puts up to `most` echoes of story `s` at the first clear spots `spots` gives (local +z of each points back at the story). */
  const echoes = (s: WarScene, spots: Pt[], most: number) => {
    const echo = ECHO[s.kind]!;
    let made = 0;
    for (const p of spots) {
      if (made >= most || count('trail') >= caps.trail) break;
      if (!clear(p.x, p.z, SIZE.trail, false, undefined, true)) continue;
      put('trail', p.x, p.z, Math.atan2(s.x - p.x, s.z - p.z), false, undefined, echo[made % echo.length]);
      made++;
    }
  };
  const open = placed.filter((s) => ECHO[s.kind] && !s.beyond && s.host === undefined);
  for (const s of open.slice().sort(() => rnd() - 0.5)) {
    if (rnd() < 0.1) continue;
    const road = nearestRoad(s.x, s.z);
    if (road.d > 45) continue;
    const ux = (road.x - s.x) / road.d, uz = (road.z - s.z) / road.d, spots: Pt[] = [];
    // on the way to the road, then on the road's verge either side of the story, as if dropped by those who came and went
    for (let d = s.R + 2; d < road.d - 4; d += 1.5) spots.push({ x: s.x + ux * d + (rnd() - 0.5) * 1.4, z: s.z + uz * d + (rnd() - 0.5) * 1.4 });
    for (let k = 0; k < 10; k++) {
      const along = (k % 2 ? 1 : -1) * (s.R + 2 + rnd() * 9), off = 4.2 + rnd() * 1.6;
      spots.push({ x: road.x - uz * along - ux * off, z: road.z + ux * along - uz * off });
    }
    echoes(s, spots, 2);
  }
  // between two stories near each other: a trail from one to the other (arrows towards the fight, a crate dropped on the way)
  for (let i = 0; i < open.length; i++) for (let k = i + 1; k < open.length; k++) {
    const a = open[i], b = open[k], d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < a.R + b.R + 5 || d > 36 || rnd() < 0.4) continue;
    const spots: Pt[] = [];
    for (let t = 0; t < 6; t++) { const f = (a.R + 1.8 + rnd() * (d - a.R - b.R - 3.6)) / d; spots.push({ x: a.x + (b.x - a.x) * f + (rnd() - 0.5) * 2, z: a.z + (b.z - a.z) * f + (rnd() - 0.5) * 2 }); }
    echoes(rnd() < 0.5 ? a : b, spots, 1);
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
  steel: '#9a9ea8', iron: '#34363c', gold: '#c9a24a', tin: '#a2a4aa', lacquer: '#1d1b21', ember: '#7a2a1c', // matte, as the depth's: one material for every scene
} as const;
type Colour = keyof typeof COLOUR;
type RGB = [number, number, number];
/** The scenes' own ground, painted into the zone's map (sRGB): churned mud, wet ruts, trodden and fresh-dug earth, scorch, ash, spilled
 * grain, flattened straw, and the soft dark under a big piece that stands in for the shadow it does not cast. */
const PAINT: Record<'mud' | 'wet' | 'trodden' | 'fresh' | 'scorch' | 'ash' | 'grain' | 'straw' | 'shade', RGB> = {
  mud: [60, 50, 41], wet: [44, 38, 34], trodden: [118, 100, 76], fresh: [112, 88, 62], scorch: [30, 26, 24], ash: [112, 108, 102],
  grain: [200, 170, 100], straw: [146, 136, 92], shade: [22, 20, 18],
};

/** Every scene on a floor, into one mesh (and a few puffs of smoke). Called by warDepth.ts as its last step, inside its seeded
 * `Math.random`. Paints each scene's ground into the zone's map (`ground`). Returns the smoke's update, or null. */
export function buildWarScenes(o: {
  look: WarLook; geo: Battlefield; into: THREE.Group; own: { dispose(): void }[]; scenes: WarScene[]; taken: Taken[]; floor?: number;
  ground?: { map: THREE.CanvasTexture; L: number };
}): { update(time: number): void } | null {
  const t0 = performance.now();
  const { look, geo, scenes } = o;
  const rnd = seeded(8807 + look.seed);
  const scarred = (o.floor ?? 41) >= 48;
  const H = (x: number, z: number) => geo.height(x - RING.x, z - RING.z);
  const roads: [number, number, number, number][] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push([RING.x + p[i - 1][0], RING.z + p[i - 1][1], RING.x + p[i][0], RING.z + p[i][1]]);

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
  /** A point of the current frame, in the world. */
  const W = { x: 0, z: 0 };
  const toW = (lx: number, lz: number) => {
    const c = Math.cos(fyaw), s = Math.sin(fyaw);
    const px = (fx + lx * c + lz * s) * cur.m, pz = fz - lx * s + lz * c; // mirrored by the layout (x), never by a negative scale
    W.x = cur.x + px * cos + pz * sin; W.z = cur.z - px * sin + pz * cos;
    return W;
  };
  /** One part: a shape, its colour, its place in the current frame (y up from the ground), its turn, scale, tilt (about x) and roll. */
  const add = (shape: { p: Float32Array; n: Float32Array }, colour: Colour, lx: number, ly: number, lz: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0, roll = 0) => {
    const { x: wx, z: wz } = toW(lx, lz);
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
      measure(X, Y, Z, ground);
    }
  };
  /** The footprint and height, measured from what is built. */
  const measure = (X: number, Y: number, Z: number, ground: number) => {
    const dx = X - cur.x, dz = Z - cur.z, rr = dx * dx + dz * dz, hy = Y - ground; // the ground under the part (past the edge the ground rolls a little under a part: close enough for a height)
    if (rr > r2max) r2max = rr;
    if (hy > hmax) hmax = hy;
    if (hostSeg && hy > KNEE) reach = Math.max(reach, segDist(X, Z, hostSeg[0], hostSeg[1], hostSeg[2], hostSeg[3]) - hostSeg[4]);
    for (const c of nearCover) gap = Math.min(gap, segDist(X, Z, c[0], c[1], c[2], c[3]) - c[4]);
  };
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const other = (s: 'crimson' | 'azure'): 'crimson' | 'azure' => (s === 'crimson' ? 'azure' : 'crimson');
  /** The army colour of the current scene's side (the middle: either). */
  const army = (): 'crimson' | 'azure' => (cur.side === 'mid' ? (rnd() < 0.5 ? 'crimson' : 'azure') : cur.side);
  /** The main piece's radius (it stands at the scene's centre). */
  const main = (mr: number) => { cur.mr = +mr.toFixed(2); };

  // --- the ground: painted into the zone's map (soft radial stains, no blur filter: cheap), off the roads and places --------------
  const cv = o.ground ? (o.ground.map.image as HTMLCanvasElement) : null;
  const pg = cv ? cv.getContext('2d') : null;
  const ppm = cv && o.ground ? cv.width / o.ground.L : 0, pc = cv ? cv.width / 2 : 0;
  const PX = (wx: number) => pc + (wx - RING.x) * ppm, PZ = (wz: number) => pc + (wz - RING.z) * ppm;
  const rgba = (k: RGB, a: number) => `rgba(${k[0]},${k[1]},${k[2]},${a.toFixed(3)})`;
  let paintMs = 0;
  /** A soft stain: an ellipse rx by rz (m, along the frame's x and z), its colour at `a` in the middle fading to nothing at its edge. */
  const stain = (lx: number, lz: number, rx: number, rz: number, k: RGB, a: number, rot = 0) => {
    if (!pg || cur.beyond) return;
    const t = performance.now();
    const { x, z } = toW(lx, lz);
    pg.save();
    pg.translate(PX(x), PZ(z));
    pg.rotate(-(cur.yaw + cur.m * (fyaw + rot)));
    pg.scale(rx / rz, 1);
    const R = rz * ppm, gr = pg.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, rgba(k, a)); gr.addColorStop(0.5, rgba(k, a * 0.8)); gr.addColorStop(1, rgba(k, 0));
    pg.fillStyle = gr;
    pg.beginPath(); pg.arc(0, 0, R, 0, Math.PI * 2); pg.fill();
    pg.restore();
    paintMs += performance.now() - t;
  };
  /** A small mark (a footprint, a flattened stalk): a plain ellipse, no gradient (cheap: a floor paints hundreds). */
  const dot = (lx: number, lz: number, rx: number, rz: number, k: RGB, a: number, rot = 0) => {
    if (!pg || cur.beyond) return;
    const t = performance.now(), { x, z } = toW(lx, lz);
    pg.fillStyle = rgba(k, a);
    pg.beginPath(); pg.ellipse(PX(x), PZ(z), rx * ppm, rz * ppm, -(cur.yaw + cur.m * (fyaw + rot)), 0, Math.PI * 2); pg.fill();
    paintMs += performance.now() - t;
  };
  /** A churned patch: a few stains overlapping, so its edge is not a circle. */
  const blotch = (lx: number, lz: number, R: number, k: RGB, a: number, n = 5) => {
    stain(lx, lz, R * 0.75, R * 0.6, k, a * 0.8, rnd() * 3);
    for (let i = 0; i < n; i++) { const ang = rnd() * 6.28, d = R * r(0.15, 0.5); stain(lx + Math.sin(ang) * d, lz + Math.cos(ang) * d, R * r(0.35, 0.55), R * r(0.3, 0.45), k, a * r(0.6, 0.9), rnd() * 3); }
  };
  /** Footprints and hoof marks: small dark stains strewn over a round of radius R. */
  const prints = (lx: number, lz: number, R: number, k: number) => {
    for (let i = 0; i < k; i++) { const ang = rnd() * 6.28, d = Math.sqrt(rnd()) * R; dot(lx + Math.sin(ang) * d, lz + Math.cos(ang) * d, 0.1, 0.15, PAINT.wet, 0.3, rnd() * 3); }
  };
  /** Trampled grass: short pale strokes lying one way (`dir`, in the frame) over a round of radius R. */
  const streaks = (lx: number, lz: number, R: number, dir: number, k: number) => {
    for (let i = 0; i < k; i++) { const ang = rnd() * 6.28, d = Math.sqrt(rnd()) * R; dot(lx + Math.sin(ang) * d, lz + Math.cos(ang) * d, 0.06, r(0.25, 0.45), PAINT.straw, 0.22, dir + r(-0.25, 0.25)); }
  };
  /** A soft dark under a big piece (w by d m): the shadow it does not cast. */
  const shade = (lx: number, lz: number, w: number, d: number, rot = 0, a = 0.5) => stain(lx, lz, w * 0.62, d * 0.62, PAINT.shade, a, rot);
  /** Whether a world point is free ground for a mark (off the roads' paved band and ruts, the places' rounds, the cover). */
  const markable = (x: number, z: number) => {
    for (const rd of roads) if (segDist2(x, z, rd[0], rd[1], rd[2], rd[3]) < 2.9 * 2.9) return false;
    for (const p of look.places) if (within(x, z, p.x, p.z, p.r + 0.5)) return false;
    for (const p of look.pieces) { const d = p.o.r + 0.4; if (segDist2(x, z, p.o.ax, p.o.az, p.o.bx, p.o.bz) < d * d) return false; }
    return true;
  };
  /** A line painted on the ground in the world (a rut, a drag mark), from (ax, az) towards (bx, bz) as far as the ground is free. */
  const line = (ax: number, az: number, bx: number, bz: number, w: number, k: RGB, a: number) => {
    if (!pg) return;
    const L = Math.hypot(bx - ax, bz - az);
    let end = 0;
    for (let s = 0; s <= L; s += 0.5) { if (!markable(ax + (bx - ax) * s / L, az + (bz - az) * s / L)) break; end = s; }
    if (end < 1) return;
    const t = performance.now(), ex = ax + (bx - ax) * end / L, ez = az + (bz - az) * end / L;
    pg.lineCap = 'round';
    for (const [lw, la] of [[w * 1.8, a * 0.35], [w, a * 0.7]] as const) {
      pg.strokeStyle = rgba(k, la); pg.lineWidth = lw * ppm;
      pg.beginPath(); pg.moveTo(PX(ax), PZ(az)); pg.lineTo(PX(ex), PZ(ez)); pg.stroke();
    }
    paintMs += performance.now() - t;
  };
  /** The nearest point of a road's line to a world point. */
  const nearestRoad = (x: number, z: number) => {
    let best = { d: 1e9, x: 0, z: 0 };
    for (const rd of roads) {
      const ex = rd[2] - rd[0], ez = rd[3] - rd[1], l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - rd[0]) * ex + (z - rd[1]) * ez) / l2)) : 0;
      const px = rd[0] + ex * t, pz = rd[1] + ez * t, d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { d, x: px, z: pz };
    }
    return best;
  };
  /** Two wheel ruts (or, `gauge` 0, one drag mark) from the frame's point (lx, lz) to the nearest road's verge, if one is near. */
  const ruts = (lx: number, lz: number, gauge = 1.5, k: RGB = PAINT.wet, a = 0.5) => {
    const { x, z } = toW(lx, lz), sx = x, sz = z, rd = nearestRoad(sx, sz);
    if (rd.d > 34 || rd.d < 3.5) return;
    const ux = (rd.x - sx) / rd.d, uz = (rd.z - sz) / rd.d, bx = rd.x - ux * 2.8, bz = rd.z - uz * 2.8;
    if (!gauge) { line(sx, sz, bx, bz, 0.55, k, a * 0.7); return; }
    for (const s of [-0.5, 0.5]) line(sx - uz * s * gauge, sz + ux * s * gauge, bx - uz * s * gauge, bz + ux * s * gauge, 0.2, k, a);
  };
  /** Hoof marks leaving the scene the way (the frame's angle) a horse ran. */
  const hooves = (lx: number, lz: number, ang: number, len: number) => {
    for (let s = 0.6; s < len; s += 0.55) { const j = (Math.floor(s / 0.55) % 2 ? 0.22 : -0.22); dot(lx + Math.sin(ang) * s + Math.cos(ang) * j, lz + Math.cos(ang) * s - Math.sin(ang) * j, 0.11, 0.13, PAINT.wet, 0.36); }
  };

  // --- past the edge the map does not reach: a draped disc of the scene's ground, its rim the ground's own colour -----------------
  const tmpC = new THREE.Color(), inC = new THREE.Color();
  const drape = (R: number, k: RGB, a: number) => {
    const N = 20, RINGS = [0, 0.4, 0.75, 1], T = [a, a * 0.8, a * 0.4, 0];
    const pts: { x: number; y: number; z: number; c: [number, number, number] }[][] = [];
    inC.setRGB(k[0] / 255, k[1] / 255, k[2] / 255, THREE.SRGBColorSpace);
    for (let i = 0; i < RINGS.length; i++) {
      const row: { x: number; y: number; z: number; c: [number, number, number] }[] = [];
      for (let j = 0; j < (i ? N : 1); j++) {
        const ang = (j / N) * 6.28, x = cur.x + Math.cos(ang) * R * RINGS[i], z = cur.z + Math.sin(ang) * R * RINGS[i];
        const gc = geo.color(x - RING.x, z - RING.z, H(x, z));
        tmpC.setRGB(gc[0] / 255, gc[1] / 255, gc[2] / 255, THREE.SRGBColorSpace).lerp(inC, T[i]);
        row.push({ x, y: H(x, z) + 0.06, z, c: [tmpC.r, tmpC.g, tmpC.b] });
      }
      pts.push(row);
    }
    const tri = (a1: typeof pts[0][0], b1: typeof pts[0][0], c1: typeof pts[0][0]) => {
      room(9);
      for (const p of [a1, b1, c1]) {
        const at = all.len; all.len += 3;
        all.p[at] = p.x; all.p[at + 1] = p.y; all.p[at + 2] = p.z;
        all.n[at] = 0; all.n[at + 1] = 1; all.n[at + 2] = 0;
        all.c[at] = p.c[0]; all.c[at + 1] = p.c[1]; all.c[at + 2] = p.c[2];
      }
    };
    for (let j = 0; j < N; j++) tri(pts[0][0], pts[1][(j + 1) % N], pts[1][j]);
    for (let i = 1; i < RINGS.length - 1; i++) for (let j = 0; j < N; j++) {
      const a1 = pts[i][j], b1 = pts[i][(j + 1) % N], c1 = pts[i + 1][j], d1 = pts[i + 1][(j + 1) % N];
      tri(a1, b1, c1); tri(b1, d1, c1);
    }
  };

  // --- smoke: a few soft puffs rising from what still smoulders (one instanced mesh for the floor, built last) ------------------------
  const smokes: { x: number; y: number; z: number; h: number; r: number }[] = [];
  const smoke = (lx: number, lz: number, h = 2.6, rr = 0.32) => { const { x, z } = toW(lx, lz); smokes.push({ x, y: cur.beyond ? H(x, z) : 0, z, h, r: rr }); };

  // --- the small things every scene is made of ------------------------------------------------------------------------------------
  /** A round shield lying on the ground: face up (its colour, gold rim and boss) or face down (its planks and iron strap); `tilt` props it up. */
  const shield = (lx: number, lz: number, colour: Colour, up: boolean, yaw = rnd() * 6.28, tilt = 0) => sub(lx, lz, yaw, () => {
    const y = 0.035 + Math.sin(Math.abs(tilt)) * 0.4;
    add(S.cyl(0.42, 0.42, 0.06, 10), up ? colour : 'plank', 0, y - 0.03, 0, 0, 1, 1, 1, tilt);
    if (up) {
      add(S.cyl(0.45, 0.45, 0.05, 10), 'gold', 0, y - 0.035, 0, 0, 1, 1, 1, tilt); // the rim: a gold disc a little wider, under the face
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
  /** An army's great standard fallen flat: a long pole, a big cloth with a gold border, the finial; `burnt` leaves half the cloth black. */
  const standard = (lx: number, lz: number, colour: 'crimson' | 'azure', yaw = 0, burnt = false) => sub(lx, lz, yaw, () => {
    add(S.log(0.065, 4.8, 8), burnt ? 'charred' : 'wood', 0.6, 0, -1.35);
    add(S.cone(0.12, 0.4, 6), 'gold', 3.2, 0.065, -1.35, 0, 1, 1, 1, 0, -Math.PI / 2);
    add(S.box(0.07, 0.07, 1.8), burnt ? 'charred' : 'wood', 1.45, 0, -0.45); // the crossbar the cloth hung from
    add(S.sheet(1.7, 2.6), colour, 0.3, 0.03, 0.05, r(-0.06, 0.06));
    for (const s of [-1, 1]) add(S.box(1.72, 0.012, 0.07), 'gold', 0.3, 0.032, 0.05 + s * 1.28);
    add(S.box(0.07, 0.012, 2.6), 'gold', 0.3 - 0.83, 0.032, 0.05);
    if (burnt) { add(S.sheet(1.3, 1.5), 'charred', 0.0, 0.04, 0.6, 0.3); add(S.sheet(0.6, 0.7), 'ash', -0.5, 0.045, 1.1, 0.8); }
    else add(S.sheet(0.7, 0.8), colour, -1.1, 0.034, 1.0, 0.7); // a torn corner apart
  });
  /** A cart's wheel lying flat. */
  const wheel = (lx: number, lz: number, R = 0.5, colour: Colour = 'dark') => sub(lx, lz, rnd() * 6.28, () => {
    add(S.ring(R, 0.06, 16), colour, 0, 0, 0);
    for (let k = 0; k < 3; k++) add(S.box(0.06, 0.05, R * 2), colour === 'charred' ? 'charred' : 'wood', 0, 0.035, 0, (k / 3) * Math.PI);
    add(S.cyl(0.11, 0.11, 0.14, 8), colour === 'charred' ? 'charred' : 'gold', 0, 0, 0);
  });
  /** Where something burned: charred planks and a blackened shield or two, on a scorched patch. */
  const burnt = (lx: number, lz: number, R: number) => {
    stain(lx, lz, R * 1.1, R * 0.9, PAINT.scorch, 0.55, rnd() * 3);
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
  /** A sack split open, its grain fanned out over the ground. */
  const splitSack = (lx: number, lz: number, ang = rnd() * 6.28) => {
    add(S.ball(0.26, 8), 'sack', lx, 0, lz, ang, 1.1, 0.45, 0.9);
    stain(lx + Math.sin(ang) * 0.7, lz + Math.cos(ang) * 0.7, 0.55, 0.95, PAINT.grain, 0.75, ang);
  };
  const bowl = (lx: number, lz: number, R = 0.12) => add(S.cyl(R, R * 0.7, R * 0.6, 10), 'tin', lx, 0, lz);
  const stool = (lx: number, lz: number) => { add(S.cyl(0.2, 0.2, 0.06, 10), 'plank', lx, 0.36, lz); for (let k = 0; k < 3; k++) { const a = (k / 3) * 6.28; add(S.box(0.05, 0.36, 0.05), 'wood', lx + Math.cos(a) * 0.13, 0, lz + Math.sin(a) * 0.13); } };
  /** A sandbag (0.56 by 0.36, 0.22 high). */
  const bag = (lx: number, lz: number, yaw: number, ly = 0, tilt = 0) => add(S.ball(0.2, 7), 'sack', lx, ly, lz, yaw, 1.4, 0.55, 0.9, tilt);
  /** A stretcher with the army's folded blanket. */
  const stretcher = (lx: number, lz: number, yaw: number, a: Colour) => sub(lx, lz, yaw, () => {
    for (const s of [-0.32, 0.32]) add(S.box(0.05, 0.05, 2.3), 'wood', s, 0.12, 0);
    for (const e2 of [-1.0, 1.0]) for (const s of [-0.3, 0.3]) add(S.box(0.05, 0.12, 0.05), 'wood', s, 0, e2);
    add(S.box(0.6, 0.015, 1.9), 'linen', 0, 0.16, 0);
    if (rnd() < 0.7) add(S.box(0.62, 0.05, 0.7), a, 0, 0.175, r(0.2, 0.6));
  });
  /** A drum lying on its side: the army's colour, gold hoops, pale heads. */
  const sideDrum = (lx: number, lz: number, colour: Colour, R = 0.27, yaw = rnd() * 6.28) => sub(lx, lz, yaw, () => {
    add(S.log(R, R * 1.9, 12), colour, 0, 0, 0);
    for (const s of [-1, 1]) { add(S.log(R + 0.015, 0.05, 12), 'gold', s * R * 0.92, -0.015, 0); add(S.log(R - 0.02, 0.02, 12), 'cream', s * R * 0.97, 0.02, 0); }
  });
  const drumstick = (lx: number, lz: number, yaw: number) => sub(lx, lz, yaw, () => { add(S.box(0.035, 0.035, 0.46), 'wood', 0, 0, 0); add(S.ball(0.04, 6), 'cream', 0, 0, 0.24); });

  // --- the kinds -------------------------------------------------------------------------------------------------------------------
  const KINDS: Record<WarSceneKind, () => void> = {
    /** Where two lines met: a great standard fallen in the middle (or a war cart's bed, its wheels off), shields of both colours thickest
     * on their own sides, swords, helmets, spears, two volleys, a second banner; churned mud and trampled grass; burnt when scarred. */
    aftermath() {
      const a = army(), b = cur.side === 'mid' ? other(a) : rnd() < 0.35 ? other(a) : a;
      blotch(0, 0, 5.4, PAINT.mud, 0.5, 7);
      streaks(0, 0, 6, rnd() * 6.28, 34);
      prints(0, 0, 5, 46);
      if (scarred) burnt(r(-2, 2), r(-1.5, 1.5), 2.8);
      if (cur.v === 1) { // a war cart's bed down in the mud, its wheels off, its javelins spilled; its ruts from the road
        shade(0, 0, 1.8, 3.2, 0, 0.55);
        sub(0, 0, r(-0.2, 0.2), () => {
          add(S.box(1.5, 0.12, 2.8), 'plank', 0, 0.02, 0, 0, 1, 1, 1, 0, 0.05);
          add(S.box(0.07, 0.4, 2.8), 'plank', -0.72, 0.06, 0); add(S.box(0.075, 0.03, 2.82), 'gold', -0.72, 0.46, 0);
          add(S.box(0.07, 0.4, 2.8), 'plank', 1.3, 0, 0.1, 0.1, 1, 1, 1, 0, Math.PI / 2 - 0.05); // the other side fallen flat beside it
          add(S.box(1.5, 0.36, 0.07), 'plank', 0, 0.06, -1.38);
          for (const z of [-1.2, 1.2]) add(S.box(1.56, 0.06, 0.08), 'iron', 0, 0.12, z);
          add(S.log(0.07, 1.9, 8), 'dark', 0, 0, 1.75, 0.2);
          for (let k = 0; k < 4; k++) spear(-0.2 + k * 0.18, 1.0, -Math.PI / 2 + r(-0.1, 0.1), false);
        });
        wheel(-1.9, 1.5, 0.62); wheel(2.2, -1.4, 0.62);
        ruts(0, 0, 1.5);
        main(1.6);
      } else {
        standard(0, 0, a, rnd() * 6.28, scarred && rnd() < 0.5);
        main(1.7);
      }
      // two lines met here: each army's shields thickest on its own side of the scene, mixed in the middle
      const k = scarred ? 16 + Math.floor(rnd() * 4) : 13 + Math.floor(rnd() * 4);
      for (let i = 0; i < k; i++) {
        const mine = i % 2 === 0, ang = (mine ? -1.57 : 1.57) + r(-1.4, 1.4), d = 1.9 + Math.sqrt(rnd()) * 3.6;
        shield(Math.sin(ang) * d, Math.cos(ang) * d * 0.85, mine ? a : b, rnd() < 0.75, undefined, rnd() < 0.2 ? r(0.15, 0.3) : 0);
      }
      for (let i = 0; i < 6 + Math.floor(rnd() * 3); i++) { const ang = rnd() * 6.28, d = r(1.6, 4.8); sword(Math.sin(ang) * d, Math.cos(ang) * d); }
      for (let i = 0; i < 4 + Math.floor(rnd() * 2); i++) { const ang = rnd() * 6.28, d = r(1.8, 5); helmet(Math.sin(ang) * d, Math.cos(ang) * d); }
      for (let i = 0; i < 4; i++) { const ang = rnd() * 6.28, d = r(1.8, 4.2); spear(Math.sin(ang) * d, Math.cos(ang) * d); }
      volley(r(-2.5, 2.5), r(-5, -4), 10 + Math.floor(rnd() * 4), 1.3);
      volley(r(-3, 3), r(3.8, 4.8), scarred ? 10 : 7, 1.1);
      fallenBanner(r(2.4, 3.2), r(-1.4, 1.4), b, rnd() * 6.28);
      if (rnd() < 0.6) wheel(r(-5, -4.2), r(-1, 1));
    },
    /** A last stand: a ring (or a square) of one army's shields round its fallen standard, spears laid outward, arrows all over. */
    laststand() {
      const a = army(), R = r(2.7, 3.0);
      stain(0, 0, R + 1.6, R + 1.6, PAINT.trodden, 0.4);
      for (let k = 0; k < 10; k++) { const ang = (k / 10) * 6.28; stain(Math.sin(ang) * R, Math.cos(ang) * R, 1.0, 0.8, PAINT.mud, 0.45, ang); }
      prints(0, 0, R + 1.2, 40);
      if (cur.v === 1) { // a square of shields, two deep, round a dropped drum
        for (let side = 0; side < 4; side++) for (let k = 0; k < 5; k++) {
          if (rnd() < 0.1) continue;
          const t = (k - 2) * 0.95, ang = side * Math.PI / 2;
          const x = Math.sin(ang) * R * 0.92 + Math.cos(ang) * t, z = Math.cos(ang) * R * 0.92 - Math.sin(ang) * t;
          shield(x, z, a, rnd() < 0.85, ang, rnd() < 0.3 ? 0.2 : 0);
        }
        sideDrum(r(-0.6, 0.6), r(0.8, 1.3), a);
      } else {
        const k = 13 + Math.floor(rnd() * 3);
        for (let i = 0; i < k; i++) {
          if (rnd() < 0.1) continue; // one gone
          const ang = (i / k) * 6.28 + r(-0.08, 0.08);
          shield(Math.sin(ang) * R, Math.cos(ang) * R, a, rnd() < 0.85, ang, rnd() < 0.3 ? 0.2 : 0);
        }
      }
      for (let i = 0; i < 7; i++) { const ang = (i / 7) * 6.28 + r(-0.2, 0.2); sub(Math.sin(ang) * (R + 0.5), Math.cos(ang) * (R + 0.5), ang - Math.PI / 2, () => spear(0, 0, 0, false)); }
      standard(-0.4, 0, a, rnd() * 6.28, scarred);
      helmet(r(-0.8, 0.8), r(-0.8, 0.8), true);
      volley(r(-1, 1), r(-1.2, 1.2), 10, 1.8);
      volley(r(-2, 2), r(R + 0.6, R + 1.2), 7, 1.0);
      if (scarred) burnt(0, 0, 2.2);
      main(R);
    },
    /** A camp just left: the stone ring round the ash, a big pot on three stones, a spit over the fire, bedrolls round it like spokes,
     * a bench, bowls, packs; or the same kicked over and scattered (layout 1). */
    cookfire() {
      const a = army(), kicked = cur.v === 1;
      stain(0, 0, 3.8, 3.4, PAINT.trodden, 0.45, rnd() * 3);
      stain(0, 0, 1.6, 1.5, PAINT.ash, 0.6); stain(0, 0, 0.9, 0.9, PAINT.scorch, 0.65);
      prints(0, 0, 3.4, 26);
      add(S.cyl(0.8, 0.8, 0.02, 14), 'ash', 0, 0.005, 0);
      for (let k = 0; k < 11; k++) {
        const ang = (k / 11) * 6.28 + (kicked ? r(-0.3, 0.3) : 0), d = kicked && rnd() < 0.4 ? r(1.2, 2.2) : 0.95;
        add(S.stone(0.19), 'stone', Math.sin(ang) * d, 0, Math.cos(ang) * d, rnd() * 6);
      }
      for (let k = 0; k < 3; k++) add(S.log(0.075, 0.9, 6), 'charred', kicked ? r(-0.8, 0.8) : 0, 0.02, kicked ? r(-0.8, 0.8) : 0, (k / 3) * Math.PI + r(-0.2, 0.2));
      if (!kicked) { // the spit on two forked sticks
        for (const s of [-1.05, 1.05]) { add(S.cyl(0.03, 0.03, 0.5, 5), 'wood', s, 0, 0); add(S.box(0.16, 0.05, 0.04), 'wood', s, 0.48, 0); }
        add(S.log(0.022, 2.3, 5), 'iron', 0, 0.48, 0);
      }
      sub(1.7, 0.4, 0, () => { // the pot on its stones (kicked: on its side, its stew spilled)
        if (kicked) { add(S.cyl(0.28, 0.22, 0.36, 12), 'iron', 0, 0.28, 0, 0, 1, 1, 1, 0, Math.PI / 2); stain(0.6, 0, 0.9, 0.5, PAINT.wet, 0.6); return; }
        for (let k = 0; k < 3; k++) { const ang = (k / 3) * 6.28; add(S.stone(0.13), 'stone', Math.sin(ang) * 0.24, 0, Math.cos(ang) * 0.24); }
        add(S.cyl(0.34, 0.27, 0.36, 12), 'iron', 0, 0.12, 0);
        add(S.ring(0.34, 0.025, 12), 'gold', 0, 0.46, 0);
        add(S.box(0.04, 0.02, 0.55), 'tin', 0.2, 0.48, 0.1, 0.6, 1, 1, 1, -0.3);
      });
      // bedrolls round the fire like spokes, in the army's colour, a pale roll at the head of each
      // bedrolls where men slept round the fire, feet to the warmth; some still rolled; layout 1 kicked about
      const rolls = 4 + Math.floor(rnd() * 2);
      for (let k = 0; k < rolls; k++) {
        const ang = (k / rolls) * 6.28 + r(-0.35, 0.35) + 0.3, d = kicked ? r(2.0, 3.0) : r(2.1, 2.7), rolled = rnd() < 0.3;
        sub(Math.sin(ang) * d, Math.cos(ang) * d, ang + r(-0.35, 0.35) + (kicked ? r(-0.8, 0.8) : 0), () => {
          if (rolled) { add(S.log(0.17, 0.8, 10), 'canvas', 0, 0, 0.3); for (const s2 of [-0.25, 0.25]) add(S.log(0.18, 0.05, 10), 'leather', s2, -0.01, 0.3); return; }
          add(S.box(0.75, 0.08, 1.8), a, 0, 0, 0);
          add(S.box(0.7, 0.05, 0.7), 'cream', 0, 0.08, -0.45, r(-0.2, 0.2)); // the blanket thrown back
          add(S.log(0.11, 0.7, 8), 'cream', 0, 0.06, 0.8);
        });
      }
      for (let k = 0; k < 3; k++) { const ang = r(0, 6.28), d = r(1.3, 1.6); bowl(Math.sin(ang) * d, Math.cos(ang) * d); }
      sack(-3.2, -1.2); sack(-3.0, 1.6);
      sub(r(-0.5, 0.5), -3.4, r(-0.3, 0.3), () => { for (let k = 0; k < 5; k++) add(S.log(0.09, 1.1, 6), 'wood', 0, k < 3 ? 0 : 0.15, (k < 3 ? k - 1 : k - 3.5) * 0.19); }); // the firewood
      main(1.2);
    },
    /** A smith's corner: a stone forge with its dark embers and bellows, the anvil on its stump, a grindstone, a quench barrel, blades
     * laid out on the army's cloth with a gold edge; or a mended pile of blades and helmets beside the anvil (layout 1). */
    smithy() {
      const a = army();
      stain(0, 0, 3.8, 3.4, PAINT.trodden, 0.45, rnd() * 3);
      stain(0, 0, 2.2, 1.8, PAINT.scorch, 0.5);
      shade(0, 0, 1.6, 1.2, 0, 0.55);
      add(S.box(1.6, 0.4, 1.2), 'stone', 0, 0, 0); // the forge
      add(S.box(1.36, 0.06, 0.96), 'charred', 0, 0.4, 0);
      for (let k = 0; k < 4; k++) add(S.box(r(0.14, 0.26), 0.06, r(0.14, 0.26)), 'ember', r(-0.4, 0.4), 0.42, r(-0.3, 0.3), rnd() * 3);
      add(S.box(1.64, 0.04, 0.05), 'gold', 0, 0.4, 0.6); add(S.box(1.64, 0.04, 0.05), 'gold', 0, 0.4, -0.6);
      sub(-1.15, 0.1, Math.PI / 2, () => { add(S.box(0.5, 0.16, 0.7), 'leather', 0, 0, 0, 0, 1, 1, 1, 0.12); add(S.cone(0.05, 0.3, 6), 'gold', 0, 0.08, -0.45, 0, 1, 1, 1, -Math.PI / 2); }); // the bellows
      sub(1.7, 0.5, 0.3, () => { // the anvil on its stump
        add(S.cyl(0.3, 0.34, 0.3, 10), 'wood', 0, 0, 0);
        add(S.box(0.22, 0.1, 0.5), 'iron', 0, 0.3, 0); add(S.box(0.3, 0.09, 0.62), 'iron', 0, 0.4, 0);
        add(S.cone(0.06, 0.22, 6), 'iron', 0, 0.445, 0.38, 0, 1, 1, 1, Math.PI / 2);
      });
      sub(2.4, 0.0, 0.5, () => { add(S.box(0.05, 0.03, 0.32), 'dark', 0, 0, 0); add(S.box(0.14, 0.07, 0.07), 'iron', 0, 0, 0.18); }); // the hammer
      sub(-1.9, -1.4, 0, () => { // the grindstone in its low frame
        add(S.box(0.9, 0.12, 0.08), 'wood', 0, 0.1, -0.2); add(S.box(0.9, 0.12, 0.08), 'wood', 0, 0.1, 0.2);
        for (const s of [-0.38, 0.38]) add(S.box(0.08, 0.32, 0.45), 'wood', s, 0, 0);
        add(S.cyl(0.25, 0.25, 0.1, 14), 'stone', 0, 0.3, -0.05, 0, 1, 1, 1, Math.PI / 2, 0);
      });
      sub(1.6, -1.4, 0, () => { add(S.cyl(0.26, 0.22, 0.44, 12), 'plank', 0, 0, 0); add(S.ring(0.265, 0.02, 12), 'iron', 0, 0.3, 0); add(S.cyl(0.24, 0.24, 0.01, 12), 'mud', 0, 0.4, 0); });
      if (cur.v === 1) { // a pile of the dented and the mended: helmets and shields stacked by the anvil
        for (let k = 0; k < 4; k++) shield(r(-0.6, 0.6) - 0.3, 2.2 + r(-0.2, 0.2), a, true, undefined, 0.08 * k);
        for (let k = 0; k < 4; k++) helmet(-1.8 + k * 0.5, 2.6, false);
      }
      sub(0.4, 2.3, 0, () => { // the blades laid out on the army's cloth
        add(S.sheet(2.4, 1.0), a, 0, 0.02, 0); add(S.box(2.42, 0.012, 0.05), 'gold', 0, 0.022, 0.5); add(S.box(2.42, 0.012, 0.05), 'gold', 0, 0.022, -0.5);
        for (let k = 0; k < (cur.v === 1 ? 3 : 6); k++) sword(-1.0 + k * 0.38, 0, Math.PI + r(-0.06, 0.06));
      });
      for (let k = 0; k < 3; k++) add(S.ring(0.08, 0.018, 8), 'iron', r(-2.6, 2.6), 0, r(-2.6, -2.2));
      main(1.1);
    },
    /** Where the wounded were carried: a field awning blown flat (canvas with the army's border) and stretchers round it; or a long row of
     * stretchers under their army's blankets (layout 1). Bandages, a basin on a stool, a chest; drag marks from the road. */
    hospital() {
      const a = army();
      stain(0, 0, 4.6, 3.8, PAINT.trodden, 0.45, rnd() * 3);
      prints(0, 0, 4.2, 30);
      ruts(0, -1, 0, PAINT.wet, 0.45);
      if (cur.v === 1) {
        for (let k = 0; k < 6; k++) stretcher((k - 2.5) * 1.0, r(-0.25, 0.25), r(-0.06, 0.06), a);
        add(S.sheet(6.2, 0.5), a, 0, 0.012, -1.6); add(S.box(6.2, 0.01, 0.05), 'gold', 0, 0.014, -1.37); // the army's long cloth along the row
        main(1.8);
      } else {
        sub(0, 0, r(-0.2, 0.2), () => { // the awning blown flat: its canvas, the army's border, the poles and ropes
          add(S.sheet(3.8, 2.8), 'canvas', 0, 0.03, 0, 0, 1, 1, 1, 0.0, 0.03);
          for (const s of [-1, 1]) { add(S.box(3.8, 0.012, 0.32), a, 0, 0.035, s * 1.24); add(S.box(3.82, 0.014, 0.05), 'gold', 0, 0.04, s * 1.41); }
          add(S.log(0.05, 3.2, 6), 'wood', 0.2, 0, 1.75, 0.05); add(S.log(0.05, 2.6, 6), 'wood', -0.6, 0, -1.8, -0.1);
          for (let k = 0; k < 3; k++) add(S.box(0.025, 0.02, 1.1), 'rope', -1.9 + k * 1.9, 0.01, -2.2, r(-0.4, 0.4));
        });
        for (let k = 0; k < 4; k++) stretcher(-3.0 + (k % 2) * 6.0, (k < 2 ? -1 : 1) * 1.15, Math.PI / 2 + r(-0.15, 0.15), a);
        main(2.0);
      }
      for (let k = 0; k < 6; k++) add(S.log(0.05, 0.12, 8), 'cream', r(-2.4, 2.4), 0, r(2.2, 3.0), rnd() * 6);
      add(S.sheet(0.08, 1.4), 'cream', r(-1, 1), 0.02, r(2.4, 3.2), r(1, 2)); // a bandage unrolled
      sub(3.4, 2.2, 0, () => { stool(0, 0); add(S.cyl(0.2, 0.13, 0.1, 12), 'tin', 0, 0.42, 0); add(S.cyl(0.18, 0.18, 0.005, 12), 'wine', 0, 0.5, 0); });
      add(S.cyl(0.08, 0.1, 0.26, 10), 'tin', 3.9, 0, 1.8);
      sub(-3.6, 2.2, 0.3, () => crate(0, 0, true, 0, 0.55));
      for (let k = 0; k < 2; k++) helmet(r(-2.4, 2.4), r(-3.2, -2.6), true);
    },
    /** A siege engine wrecked where it stood: a catapult with its frame down and its arm broken (layout 0), the same burned black and
     * still smoking (1, or any on the scarred floors), or a great bow-engine with its arms apart and its bolt (2). Stone shot in a pyramid
     * and others down the line it threw, each in a dark scar; ruts back to the road. */
    engine() {
      const burned = cur.v === 1 || (scarred && rnd() < 0.5), wd: Colour = burned ? 'charred' : 'plank', wd2: Colour = burned ? 'charred' : 'wood';
      stain(0, 0, 4.6, 4.2, burned ? PAINT.scorch : PAINT.mud, burned ? 0.6 : 0.45, rnd() * 3);
      prints(0, 0, 4.4, 34);
      shade(0, 0, 2.8, 4.8, 0, 0.5);
      ruts(0, 2.4, 2.0);
      if (cur.v === 2) { // a bow-engine: the stock, its two arms apart, the winch, a giant bolt with its gold head
        add(S.box(0.45, 0.3, 4.2), 'plank', 0, 0, 0);
        for (const e2 of [-0.22, 0.22]) add(S.box(0.04, 0.04, 4.22), 'gold', e2, 0.3, 0); // gold on its edges only
        for (const s of [-1, 1]) sub(s * 1.2, -1.8, s * 0.5, () => { add(S.box(0.2, 0.2, 2.6), 'wood', 0, 0, 0); add(S.box(0.22, 0.05, 0.1), 'gold', 0, 0.2, s * 1.25); });
        add(S.log(0.2, 1.1, 10), 'dark', 0, 0, 1.8, Math.PI / 2 * 0); add(S.box(0.05, 0.05, 0.8), 'iron', 0.6, 0.2, 1.8);
        sub(1.3, 0.6, 0.12, () => { add(S.log(0.07, 3.4, 8), 'wood', 0, 0, 0, Math.PI / 2); add(S.cone(0.15, 0.5, 4), 'gold', 0, 0.07, -1.95, 0, 1, 1, 1, -Math.PI / 2); for (let k = 0; k < 3; k++) add(S.box(0.01, 0.16, 0.4), 'paper', 0, 0.07, 1.5, (k / 3) * Math.PI); });
        for (let k = 0; k < 3; k++) sub(-1.7 + k * 0.2, 1.6, 0, () => add(S.log(0.05, 2.4, 6), 'wood', 0, k === 2 ? 0.1 : 0, 0, Math.PI / 2 + r(-0.1, 0.1)));
        main(2.1);
      } else {
        sub(0, 0, 0, () => { // the frame down
          for (const s of [-1.1, 1.1]) add(S.box(0.32, 0.3, 4.6), wd, s, 0, 0);
          for (const z of [-1.8, 0, 1.8]) add(S.box(2.6, 0.16, 0.24), wd2, 0, 0.1, z);
          add(S.box(0.24, 0.24, 1.9), wd2, -1.9, 0, 0.4, 0.3); add(S.box(0.24, 0.24, 1.7), wd2, 1.9, 0, -0.6, -0.4); // uprights fallen
          add(S.log(0.15, 2.5, 8), 'dark', 0, 0.26, -0.6); // the axle
          for (const s of [-1.1, 1.1]) for (const z of [-2.3, 2.3]) add(S.box(0.34, 0.05, 0.1), burned ? 'charred' : 'gold', s, 0.3, z);
        });
        sub(0.5, 2.0, 0.3, () => { // the arm in two pieces, the cup on the shorter one
          add(S.box(0.24, 0.2, 3.0), wd2, 0, 0, 0);
          sub(1.0, 2.3, 0.9, () => { add(S.box(0.24, 0.2, 1.6), wd2, 0, 0, 0); add(S.cyl(0.42, 0.26, 0.22, 10), 'iron', 0, 0, 0.9); });
        });
        for (let k = 0; k < 4; k++) wheel(k < 2 ? -2.4 : 2.5, k % 2 ? 2.2 : -2.0, 0.7, burned ? 'charred' : 'dark');
        for (let k = 0; k < 3; k++) add(S.ring(0.3, 0.05, 10), 'rope', r(-1.6, 1.6), 0, r(-3.4, -2.8));
        if (burned) { smoke(0.3, 0.3, 3.2, 0.42); smoke(-0.8, -1.2, 2.4, 0.3); }
        main(2.4);
      }
      sub(-3.0, -2.6, 0, () => { // the stone shot in a pyramid
        for (let i = 0; i < 6; i++) add(S.ball(0.17, 8), 'shot', (i % 3 - 1) * 0.36, 0, (i < 3 ? -0.2 : 0.2));
        for (let i = 0; i < 2; i++) add(S.ball(0.17, 8), 'shot', (i - 0.5) * 0.36, 0.22, 0);
      });
      for (let k = 0; k < 3; k++) { const z = -3.6 - k * 0.9, x = r(-2.6, 2.6); stain(x, z, 0.6, 0.6, PAINT.scorch, 0.5); stain(x, z, 1.0, 1.0, PAINT.fresh, 0.3); add(S.ball(0.17, 8), 'shot', x, -0.08, z); }
    },
    /** Fresh graves in a row (or two rows): low mounds of new earth, a sword and a helmet on each, a wreath, the army's banner laid along
     * their heads, the spade left by the last. */
    graves() {
      const a = army(), two = cur.v === 1, k = two ? 8 : 5 + Math.floor(rnd() * 2);
      stain(0, 0, 4.8, 3.6, PAINT.trodden, 0.4);
      prints(0, 2.4, 4, 22);
      const per = two ? 4 : k;
      for (let i = 0; i < k; i++) {
        const row = two ? Math.floor(i / per) : 0, j = i % per;
        sub((j - (per - 1) / 2) * 1.35, two ? (row - 0.5) * 2.9 : 0, r(-0.05, 0.05), () => {
          stain(0, 0, 0.8, 1.3, PAINT.fresh, 0.75);
          add(S.ball(0.5, 10), 'earth', 0, -0.2, 0, 0, 1, 0.48, 2.0); // a low mound, 0.28 m
          sub(0, 0, 0, () => sword(0, -0.25, 0), 0.22);
          helmet(0, 1.2, false); // at the mound's foot
          if (j === 1) { add(S.ring(0.22, 0.05, 12), 'leaf', 0.0, 0.2, 0.2); for (let f = 0; f < 4; f++) add(S.ball(0.035, 5), a, Math.cos(f * 1.6) * 0.22, 0.22, 0.2 + Math.sin(f * 1.6) * 0.22); }
        });
      }
      // the banner laid along the heads of the row
      const len = per * 1.35;
      sub(0, (two ? -1.45 : 0) - 1.45, 0, () => { add(S.sheet(len, 0.6), a, 0, 0.015, 0); add(S.box(len, 0.012, 0.05), 'gold', 0, 0.018, 0.3); add(S.box(len, 0.012, 0.05), 'gold', 0, 0.018, -0.3); add(S.cone(0.1, 0.32, 5), 'gold', len / 2 + 0.2, 0.06, 0, 0, 1, 1, 1, 0, -Math.PI / 2); });
      sub(len / 2 + 0.6, 1.6, 0.5, () => { add(S.box(0.05, 0.05, 1.1), 'wood', 0, 0.02, 0); add(S.box(0.24, 0.02, 0.3), 'iron', 0, 0.01, 0.65); });
      stain(len / 2 + 0.8, 0.8, 0.7, 0.9, PAINT.fresh, 0.6);
      main(2.4);
    },
    /** A supply cart's load spilled where the cart was cut loose: the load still lashed under the army's tarp, crates broken open, barrels
     * on their sides, a sack split and its grain fanned out, sheaves of arrows; the cart's ruts to the road (layout 1: a second load
     * and no tarp, the barrels stove in). */
    depot() {
      const a = army();
      stain(0, 0, 4.2, 3.6, PAINT.trodden, 0.4, rnd() * 3);
      ruts(0, 0, 1.5);
      shade(0, 0, 2.6, 1.8, 0, 0.55);
      sub(0, 0, r(-0.3, 0.3), () => { // the load, lashed
        add(S.box(2.4, 0.5, 1.6), cur.v === 1 ? 'plank' : a, 0, 0, 0);
        for (const e2 of [-0.55, 0.55]) add(S.box(2.44, 0.03, 0.05), 'rope', 0, 0.48, e2);
        for (const x of [-0.8, 0, 0.8]) add(S.box(0.05, 0.03, 1.64), 'rope', x, 0.48, 0);
        add(S.box(2.44, 0.04, 0.06), 'gold', 0, 0.02, 0.8); add(S.box(2.44, 0.04, 0.06), 'gold', 0, 0.02, -0.8);
      });
      crate(1.9, -1.4, true); crate(-2.1, 1.4, true, undefined, 0.45); crate(2.4, 0.6, false); crate(-2.6, -0.6, cur.v === 1);
      barrelLying(-2.0, -1.6); barrelLying(2.6, 1.8); barrelLying(0.4, -2.6);
      sack(-0.6, 2.0); sack(-0.1, 2.4); splitSack(1.0, 2.0, 0.4); if (cur.v === 1) splitSack(-3.1, 0.8, -1.2);
      for (let k = 0; k < 3; k++) sub(r(-3, 3), r(-3.6, -2.6), rnd() * 6, () => { // sheaves of arrows, bound
        add(S.log(0.08, 0.7, 6), 'wood', 0, 0, 0); add(S.log(0.085, 0.05, 6), 'rope', 0, 0, 0);
        add(S.log(0.1, 0.12, 6), 'paper', 0.3, -0.02, 0);
      });
      sub(-3.4, -2.2, 0.3, () => { add(S.box(0.08, 0.08, 1.8), 'wood', 0, 0, 0); add(S.box(0.08, 0.08, 1.8), 'wood', 0.5, 0, 0); for (let k = 0; k < 3; k++) spear(0.3, (k - 1) * 0.4, Math.PI / 2 + r(-0.3, 0.3), false); });
      main(1.5);
    },
    /** A field made ready against horses: a ditch dug with its earth thrown up, four rows of sharpened stakes, a palisade's panel lying
     * flat, caltrops; or two spiked logs (one rolled aside) across the way (layout 1). */
    stakes() {
      stain(0, 0, 5.4, 4.4, PAINT.trodden, 0.35, rnd() * 3);
      prints(0, 0, 5, 24);
      if (cur.v === 1) {
        stain(0, 0, 3.4, 2.6, PAINT.mud, 0.4);
        for (const [dx, dz, yaw] of [[0, -1.3, r(-0.1, 0.1)], [0.4, 1.3, r(-0.1, 0.1)], [-1.0, 3.6, r(0.4, 0.7)]] as const) sub(dx, dz, yaw, () => {
          add(S.log(0.18, 5.0, 10), 'wood', 0, 0, 0);
          // spikes crossed through it in an X (each leans 45 degrees and passes the log's axis), their sharpened tips under knee height
          for (let k = 0; k < 7; k++) for (const s of [-1, 1]) {
            add(S.cyl(0.08, 0.08, 0.85, 6), 'wood', -2.1 + k * 0.7, -0.17, -s * 0.35, 0, 1, 1, 1, s * Math.PI / 4);
            add(S.cone(0.08, 0.12, 6), 'cream', -2.1 + k * 0.7, 0.43, s * 0.25, 0, 1, 1, 1, s * Math.PI / 4);
          }
        });
        shade(0, -1.3, 5.2, 0.8, 0, 0.45); shade(0.4, 1.3, 5.2, 0.8, 0, 0.45);
        main(2.6);
      } else {
        // the ditch: a dark band of wet earth, its spoil thrown up behind it
        stain(-1.2, 0, 1.0, 4.8, PAINT.wet, 0.6); stain(-2.4, 0, 0.9, 4.6, PAINT.fresh, 0.55);
        for (let k = 0; k < 6; k++) add(S.ball(0.4, 7), 'earth', -2.4, -0.12, (k - 2.5) * 1.5 + r(-0.2, 0.2), rnd() * 3, 1.6, 0.6, 1.1);
        for (let row = 0; row < 4; row++) for (let k = 0; k < 9; k++) {
          const z = (k - 4) * 1.0 + (row % 2 ? 0.5 : 0), x = 0.2 + row * 0.75;
          if (rnd() < 0.12) { add(S.cone(0.1, 0.7, 6), 'wood', x + 0.4, 0.1, z, rnd() * 6, 1, 1, 1, Math.PI / 2 - 0.1); continue; } // knocked flat
          sub(x, z, 0, () => { add(S.cyl(0.11, 0.11, 0.36, 6), 'wood', 0, 0, 0, 0, 1, 1, 1, 0, -0.55); add(S.cone(0.11, 0.2, 6), 'cream', -Math.sin(0.55) * 0.36, Math.cos(0.55) * 0.36, 0, 0, 1, 1, 1, 0, -0.55); }); // pale sharpened tips: the rows read
        }
        sub(3.6, r(-2, 2), r(-0.3, 0.3), () => { // a palisade's panel lying flat
          for (let k = 0; k < 7; k++) add(S.box(0.26, 0.08, 2.6), 'plank', (k - 3) * 0.28, 0, 0);
          for (const z of [-0.8, 0.8]) add(S.box(2.0, 0.07, 0.14), 'wood', 0, 0.08, z);
          for (let k = 0; k < 7; k++) add(S.cone(0.13, 0.25, 4), 'plank', (k - 3) * 0.28, 0.04, 1.42, Math.PI / 4, 1, 0.4, 1, Math.PI / 2);
        });
        main(2.8);
      }
      for (let k = 0; k < 8; k++) { const x = r(3.6, 5.0) * (rnd() < 0.5 ? 1 : -1), z = r(-4, 4); for (let t = 0; t < 4; t++) add(S.cone(0.035, 0.18, 3), 'iron', x, 0.02, z, (t / 4) * 6.28 + 0.4, 1, 1, 1, t === 3 ? 0 : 1.9); }
      add(S.ring(0.32, 0.07, 12), 'rope', r(-3.4, -2.8), 0, r(-3, 3));
      sub(-3.6, r(2.6, 3.6), 0.3, () => { add(S.box(0.06, 0.05, 1.1), 'wood', 0, 0.02, 0); add(S.box(0.26, 0.03, 0.32), 'iron', 0, 0.01, 0.68); }); // the spade
      if (scarred) for (let k = 0; k < 3; k++) shield(r(1.8, 4), r(-3.6, 3.6), army(), rnd() < 0.6);
      if (scarred) volley(r(2, 4), r(-2, 2), 8, 1.2);
    },
    /** A rider's end, without the horse: the caparison of the army's colour with its gold border spread in the mud, the saddle on its side,
     * a plumed helmet, cut harness, a broken lance, hoof marks churned in an arc and running off; two riders' (layout 1). */
    saddle() {
      const a = army();
      blotch(0, 0, 3.2, PAINT.mud, 0.45, 5);
      for (let k = 0; k < 16; k++) { const ang = -1.2 + k * 0.17, d = 2.6 + r(-0.3, 0.3); dot(Math.sin(ang) * d, Math.cos(ang) * d, 0.12, 0.15, PAINT.wet, 0.4); }
      hooves(0, 0, r(2, 4), 4.2);
      const cap = (lx: number, lz: number, yaw: number, colour: 'crimson' | 'azure') => sub(lx, lz, yaw, () => {
        add(S.sheet(2.6, 1.8), colour, 0, 0.02, 0, 0.05);
        add(S.box(1.6, 0.07, 0.8), colour, 0.6, 0, -0.8, 0.5, 1, 1, 1, 0.1); // a fold
        for (const s of [-1, 1]) add(S.box(2.62, 0.012, 0.07), 'gold', 0, 0.023, s * 0.9);
        for (const s of [-1, 1]) add(S.box(0.07, 0.012, 1.8), 'gold', s * 1.3, 0.023, 0);
      });
      cap(0, 0, r(-0.3, 0.3), a);
      sub(-0.3, 0.1, r(-0.5, 0.5), () => { // the saddle on its side
        add(S.log(0.22, 0.7, 10), 'leather', 0, 0.02, 0, Math.PI / 2, 1.1, 0.8, 1.1);
        add(S.box(0.6, 0.3, 0.14), 'leather', 0, 0.02, -0.36); add(S.box(0.36, 0.24, 0.12), 'leather', 0, 0.02, 0.36);
        add(S.ring(0.1, 0.022, 8), 'gold', 0.45, 0.0, 0.1); add(S.ring(0.1, 0.022, 8), 'gold', -0.5, 0.0, -0.1);
      });
      sub(1.8, -1.4, 0, () => { helmet(0, 0, true); add(S.cone(0.09, 0.4, 6), a, 0, 0.3, -0.05, 0, 1, 1, 1, 1.3); }); // the plume
      for (let k = 0; k < 5; k++) sub(r(-2.2, 2.2), r(-2.2, 2.2), rnd() * 6, () => { add(S.box(0.07, 0.014, r(0.9, 1.4)), 'leather', 0, 0.006, 0); add(S.box(0.1, 0.024, 0.08), 'gold', 0, 0.01, 0.3); });
      for (let k = 0; k < 2; k++) add(S.ring(0.1, 0.024, 8), 'iron', r(-2, 2), 0, r(1.6, 2.4));
      sub(r(-0.4, 0.4), -2.2, r(-0.3, 0.3), () => { // the lance, broken, its pennon
        add(S.log(0.055, 2.6, 8), 'plank', 0, 0, 0); add(S.cone(0.07, 0.4, 5), 'steel', 1.3, 0.055, 0, 0, 1, 1, 1, 0, -Math.PI / 2);
        add(S.cyl(0.13, 0.05, 0.3, 8), 'gold', -1.3, 0.055, 0, 0, 1, 1, 1, 0, Math.PI / 2);
        sub(-2.0, 0.7, 0.7, () => { add(S.log(0.055, 1.3, 8), 'plank', 0, 0, 0); add(S.sheet(0.7, 0.45), a, -0.45, 0.06, 0.3, 0.3); });
      });
      if (cur.v === 1) {
        const b = cur.side === 'mid' ? other(a) : a;
        cap(2.4, 1.6, r(0.6, 1.2), b);
        sub(2.6, 2.8, r(-0.6, 0.6), () => { add(S.log(0.055, 3.0, 8), 'plank', 0, 0, 0); add(S.cone(0.07, 0.4, 5), 'steel', 1.5, 0.055, 0, 0, 1, 1, 1, 0, -Math.PI / 2); });
        main(1.9);
      } else {
        sub(2.2, 1.4, 0, () => { add(S.cyl(0.2, 0.16, 0.34, 10), 'plank', 0, 0.17, 0, 0, 1, 1, 1, Math.PI / 2 - 0.15); add(S.sheet(0.7, 0.6), 'straw', 0, 0.01, 0.5); });
        main(1.5);
      }
    },
    /** A courier's last errand: the dispatch chest, black with gold bands, its lid thrown open, a long trail of papers blown off on the
     * wind (no writing), the courier's cloak of the army's colour, the satchel, a lantern dropped, hoof marks running off; layout 1 keeps
     * the chest shut and adds the courier's pennant lance. */
    satchel() {
      const a = army(), wind = rnd() * 6.28, open = cur.v === 0;
      stain(0, 0, 2.6, 2.2, PAINT.mud, 0.4, rnd() * 3);
      prints(0, 0, 2.2, 18);
      hooves(0.6, 0.4, wind + Math.PI + r(-0.6, 0.6), 4.6);
      shade(0, 0, 1.2, 0.8, 0, 0.55);
      sub(0, 0, r(-0.4, 0.4), () => { // the chest
        add(S.box(1.0, 0.42, 0.62), 'lacquer', 0, 0, 0);
        for (const x of [-0.35, 0, 0.35]) add(S.box(0.06, open ? 0.44 : 0.5, 0.64), 'gold', x, 0, 0);
        if (open) { sub(0, -0.55, 0, () => { add(S.box(1.0, 0.06, 0.5), 'lacquer', 0, 0, 0, 0, 1, 1, 1, -0.3); add(S.box(1.02, 0.07, 0.06), 'gold', 0, 0, -0.22, 0, 1, 1, 1, -0.3); }); add(S.box(0.9, 0.02, 0.52), 'paper', 0, 0.4, 0); }
        else add(S.box(1.02, 0.08, 0.64), 'lacquer', 0, 0.42, 0);
      });
      sub(-1.4, 0.6, r(-0.5, 0.5), () => { add(S.sheet(1.5, 1.1), a, 0, 0.02, 0, 0.1); add(S.box(1.52, 0.012, 0.05), 'gold', 0, 0.024, 0.55); add(S.box(0.8, 0.06, 0.5), a, 0.3, 0, -0.5, 0.4); }); // the cloak
      sub(1.0, 0.9, r(0, 6), () => { add(S.box(0.42, 0.14, 0.32), 'leather', 0, 0, 0); add(S.box(0.44, 0.02, 0.24), 'leather', 0, 0.12, 0.22, 0.4); add(S.box(0.05, 0.012, 1.2), 'leather', 0.5, 0.006, -0.1, 0.8); });
      sub(0.9, -0.9, 0, () => { add(S.cyl(0.12, 0.12, 0.3, 8), 'iron', 0, 0.12, 0, 0, 1, 1, 1, 0, Math.PI / 2); add(S.cyl(0.13, 0.08, 0.08, 8), 'gold', -0.19, 0.12, 0, 0, 1, 1, 1, 0, Math.PI / 2); }); // the lantern
      const papers = open ? 22 : 12;
      for (let k = 0; k < papers; k++) { const d = r(0.9, open ? 5.0 : 3.4), ang = wind + r(-0.35, 0.35) * (1 + d * 0.15); add(S.sheet(0.3, 0.4), 'paper', Math.sin(ang) * d, 0.015 + k * 0.0008, Math.cos(ang) * d, rnd() * 6); }
      for (const s of [-1, 1]) add(S.cyl(0.06, 0.06, 0.02, 8), 'wine', 0.35 + s * 0.07, 0.012, -0.6 + s * 0.02, rnd() * 6, 1, 1, 0.5);
      helmet(r(-1.6, -1.0), r(-1.4, -0.8), true);
      if (!open) sub(-0.4, -1.8, r(-0.3, 0.3), () => { add(S.log(0.05, 3.0, 8), 'plank', 0, 0, 0); add(S.cone(0.06, 0.34, 5), 'steel', 1.5, 0.05, 0, 0, 1, 1, 1, 0, -Math.PI / 2); add(S.sheet(0.8, 0.45), a, 1.0, 0.06, 0.3, 0.2); add(S.box(0.82, 0.012, 0.04), 'gold', 1.0, 0.065, 0.52, 0.2); });
      main(1.0);
    },
    /** A broken section of trench: its floor of dark wet earth with duckboards, sandbags along both lips two high, one lip caved in and
     * its bags spilled out; a shovel, a helmet, a shield; layout 1 turns a corner. */
    trench() {
      const a = army(), corner = cur.v === 1;
      const run = (len: number, gapAt: number | null) => { // one straight run along the frame's x, centred; `gapAt`: where its lip caved in
        stain(0, 0, len / 2 + 0.8, 2.1, PAINT.fresh, 0.4);
        stain(0, 0, len / 2 + 0.3, 0.75, PAINT.wet, 0.8); stain(0, 0, len / 2, 0.45, PAINT.scorch, 0.35);
        for (let k = 0; k < Math.floor(len / 1.25); k++) sub(-len / 2 + 0.7 + k * 1.25, 0, r(-0.05, 0.05), () => { add(S.box(1.1, 0.04, 0.5), 'plank', 0, 0, 0); for (const s of [-0.4, 0, 0.4]) add(S.box(0.06, 0.05, 0.56), 'wood', s, 0, 0); });
        for (const side of [-1, 1]) for (let x = -len / 2 + 0.3; x < len / 2; x += 0.6) {
          const caved = gapAt !== null && side === 1 && x > gapAt && x < gapAt + 2.4;
          if (caved) continue;
          bag(x, side * 1.0, r(-0.1, 0.1));
          if (rnd() < 0.85) bag(x + 0.3, side * 1.0, r(-0.1, 0.1), 0.2);
        }
        if (gapAt === null) return;
        for (let k = 0; k < 10; k++) bag(gapAt + r(0, 2.4), r(1.2, 2.6), rnd() * 6, 0, r(-0.2, 0.2)); // the caved lip's bags spilled out
        stain(gapAt + 1.2, 1.9, 1.6, 1.1, PAINT.fresh, 0.6);
        for (let k = 0; k < 3; k++) add(S.box(0.24, 0.04, 1.6), 'plank', gapAt + r(-0.6, 2.4), 0.06 * k, r(1.3, 2.2), r(-1, 1)); // the revetment's boards
      };
      if (corner) {
        sub(-1.5, 0, 0, () => run(6.2, 0.2));
        sub(2.2, -2.6, Math.PI / 2, () => run(4.2, null));
      } else run(10, r(-2, 1.5));
      sub(r(-3, 3), -2.0, r(-0.4, 0.4), () => { add(S.box(0.06, 0.05, 1.1), 'wood', 0, 0.02, 0); add(S.box(0.26, 0.03, 0.32), 'iron', 0, 0.01, 0.68); }); // the shovel
      helmet(r(-2, 2), r(-0.3, 0.3), false);
      shield(r(-4, -2), r(-2.4, -1.8), a, rnd() < 0.6);
      if (scarred) volley(r(-3, 3), r(-3.2, -2.6), 9, 1.2);
      main(2.8);
    },
    /** A ram left by the siege line: its great log on a low frame, the iron head with gold bands, its wheels off, the hide roof that
     * covered it fallen flat beside; deep ruts behind it. */
    ram() {
      stain(0, 0, 5.0, 3.4, PAINT.mud, 0.45);
      prints(0, 0, 4.4, 30);
      for (const s of [-0.75, 0.75]) stain(-3.2, s, 3.2, 0.2, PAINT.wet, 0.6); // the ruts it left
      ruts(-3, 0, 1.5);
      shade(0, 0, 6.6, 1.5, 0, 0.55);
      sub(0, 0, 0, () => {
        for (const s of [-0.62, 0.62]) add(S.box(6.0, 0.22, 0.2), 'plank', 0, 0, s);
        for (const x of [-2.4, -0.8, 0.8, 2.4]) add(S.box(0.2, 0.12, 1.44), 'wood', x, 0.1, 0);
        add(S.log(0.25, 6.2, 12), 'wood', 0, 0.06, 0);
        add(S.log(0.27, 0.7, 12), 'iron', 3.4, 0.02, 0); add(S.cone(0.27, 0.45, 12), 'iron', 3.95, 0.29, 0, 0, 1, 1, 1, 0, -Math.PI / 2);
        for (const x of [-2.6, -0.9, 0.9, 2.6]) add(S.log(0.265, 0.12, 12), 'gold', x, 0.045, 0);
        add(S.log(0.28, 0.06, 12), 'gold', 3.05, 0.01, 0);
      });
      for (let k = 0; k < 3; k++) wheel(-2.4 + k * 2.2 + r(-0.3, 0.3), (k % 2 ? -1 : 1) * r(1.5, 2.0), 0.55);
      sub(0.4, cur.v === 1 ? -2.9 : 2.8, r(-0.15, 0.15), () => { // the roof fallen flat: hides over its ribs, a gold ridge
        add(S.sheet(4.6, 2.4), 'leather', 0, 0.06, 0);
        for (let k = 0; k < 5; k++) add(S.box(0.1, 0.07, 2.5), 'dark', -2.0 + k * 1.0, 0, 0);
        add(S.box(4.7, 0.05, 0.08), 'gold', 0, 0.07, 0);
        if (cur.v === 1) add(S.sheet(1.5, 1.0), 'charred', 1.2, 0.07, 0.5, 0.4);
      });
      for (let k = 0; k < 2; k++) add(S.ring(0.32, 0.06, 12), 'rope', r(-3, 3), 0, cur.v === 1 ? r(1.4, 1.8) : r(-1.8, -1.4));
      if (cur.v === 1) { smoke(1.6, -2.4, 2.4, 0.3); shield(r(-2, 2), 2.2, army(), true); }
      main(3.0);
    },
    /** The drummers' end: a great kettle drum with its pale head and gold rim, a side drum rolled away, the sticks crossed, its strap cut;
     * layout 1: three side drums toppled in a line and the drum-major's gold-topped staff. */
    drums() {
      const a = army();
      stain(0, 0, 3.4, 3.0, PAINT.trodden, 0.45, rnd() * 3);
      prints(0, 0, 3.2, 30);
      if (cur.v === 1) { // the drummers' line: four side drums dropped where they stood, a burst drum's head apart, the drum-major's staff
        for (let k = 0; k < 4; k++) sideDrum((k - 1.5) * 1.2, r(-0.35, 0.35), a, 0.29, r(-0.5, 0.5) + Math.PI / 2);
        sub(r(-0.8, 0.8), 1.5, 0, () => { add(S.cyl(0.5, 0.5, 0.02, 14), 'cream', 0, 0.005, 0, 0, 1, 1, 1, 0.08); add(S.ring(0.5, 0.025, 14), 'gold', 0, 0.0, 0); });
        sub(0, -1.4, r(-0.3, 0.3), () => { add(S.log(0.035, 2.2, 6), 'dark', 0, 0, 0); add(S.ball(0.08, 8), 'gold', 1.15, -0.04, 0); add(S.cone(0.06, 0.2, 6), 'gold', -1.2, 0.0, 0, 0, 1, 1, 1, 0, Math.PI / 2); });
        shade(0, 0, 4.4, 1.0, 0, 0.45);
        main(1.9);
      } else {
        shade(0, 0, 1.4, 1.4, 0, 0.55);
        add(S.cyl(0.62, 0.36, 0.42, 14), 'iron', 0, 0, 0);
        add(S.cyl(0.63, 0.63, 0.04, 14), a, 0, 0.3, 0);
        add(S.cyl(0.6, 0.6, 0.03, 14), 'cream', 0, 0.42, 0);
        add(S.ring(0.61, 0.03, 16), 'gold', 0, 0.41, 0);
        sideDrum(1.6, 0.9, a, 0.27);
        add(S.box(0.06, 0.012, 1.6), 'leather', -1.0, 0.006, 0.8, 0.7);
        main(1.0);
      }
      drumstick(0.9, -0.9, 0.5); drumstick(1.0, -0.8, -0.4);
      fallenBanner(r(-2.6, -1.8), r(-1.4, 0), a);
      helmet(r(1.4, 2.4), r(-2.2, -1.4));
      volley(r(-1, 1), r(1.6, 2.4), 7, 1.0);
    },
    /** What still smoulders: an army's banner pole burned through and fallen, half its cloth gone black, ash and embers on a scorch mark,
     * a thin smoke rising; layout 1 is a supply cart's bed burned down to its frame, its sacks charred. */
    smoulder() {
      const a = army();
      stain(0, 0, 3.6, 3.2, PAINT.scorch, 0.65, rnd() * 3);
      stain(0, 0, 2.0, 1.8, PAINT.ash, 0.5);
      for (let k = 0; k < 5; k++) add(S.box(r(0.12, 0.22), 0.04, r(0.12, 0.22)), 'ember', r(-1.2, 1.2), 0, r(-1.2, 1.2), rnd() * 3);
      if (cur.v === 1) {
        sub(0, 0, r(-0.2, 0.2), () => {
          add(S.box(1.5, 0.1, 2.8), 'charred', 0, 0.02, 0);
          add(S.box(0.07, 0.3, 2.6), 'charred', -0.72, 0.05, 0.1); add(S.box(0.07, 0.24, 1.4), 'charred', 0.7, 0.05, -0.6);
          for (let k = 0; k < 4; k++) add(S.ball(0.26, 8), 'charred', r(-0.5, 0.5), 0.1, r(-1, 1), rnd() * 6, 1, 0.6, 0.8);
        });
        wheel(-1.8, 1.4, 0.6, 'charred'); wheel(1.9, -1.2, 0.6, 'charred');
        add(S.sheet(1.0, 1.4), a, 2.2, 0.02, 1.4, 0.6); add(S.sheet(0.6, 0.8), 'charred', 2.0, 0.025, 1.1, 0.9);
        smoke(0, 0.2, 2.8, 0.36); smoke(-0.4, -0.9, 2.0, 0.26);
        main(1.6);
      } else {
        standard(0, 0, a, rnd() * 6.28, true);
        smoke(0.3, 0.6, 2.8, 0.34);
        main(1.6);
      }
      sword(r(-2.6, -1.6), r(1.2, 2.2)); helmet(r(1.6, 2.6), r(-2, -1.2), true);
    },
    /** Spoils: a pile of the other side's shields stacked, a bundle of their spears roped, their banner folded on a crate, helmets in a
     * row; layout 1 lays their great standard out flat beside the pile. */
    captured() {
      const a = army(), b = other(a);
      stain(0, 0, 3.0, 2.6, PAINT.trodden, 0.45, rnd() * 3);
      prints(0, 0, 2.8, 20);
      shade(0, 0, 1.6, 1.6, 0, 0.55);
      for (let k = 0; k < 7; k++) shield(r(-0.2, 0.2), r(-0.2, 0.2), b, true, rnd() * 6.28, 0.04 + k * 0.035 + (k > 3 ? 0.1 : 0)); // the stacked pile
      for (let k = 0; k < 4; k++) shield(1.0 + r(-0.15, 0.15), -0.4 + r(-0.15, 0.15), b, rnd() < 0.7, rnd() * 6.28, 0.04 + k * 0.05);
      sub(-1.6, 0.2, Math.PI / 2 + r(-0.2, 0.2), () => { for (let k = 0; k < 6; k++) sub(0, (k - 2.5) * 0.07, 0, () => spear(0, 0, 0, false), k > 2 ? 0.06 : 0); for (const x of [-0.5, 0.5]) add(S.log(0.12, 0.06, 6), 'rope', x, 0, 0); });
      sub(1.4, 1.3, r(-0.3, 0.3), () => { crate(0, 0, false, 0, 0.5); add(S.box(0.46, 0.08, 0.46), b, 0, 0.49, 0); add(S.box(0.47, 0.012, 0.47), 'gold', 0, 0.53, 0); });
      for (let k = 0; k < 5; k++) helmet(-1.4 + k * 0.6, -1.5, false);
      if (cur.v === 1) { standard(0.6, 2.6, b, r(-0.3, 0.3)); main(1.6); } else main(1.0);
    },
    /** A supply tower pulled down: its frame lying on its side, its platform apart, the crates it held spilled in a fan from its top, a
     * few broken open with their grain out; layout 1 has barrels too and the army's tarp torn off. */
    stores() {
      const a = army();
      stain(0, 0, 4.6, 3.6, PAINT.trodden, 0.4, rnd() * 3);
      prints(0, 0, 4, 26);
      shade(-0.6, 0, 4.8, 1.8, 0, 0.45);
      sub(-1.0, 0, 0, () => { // the frame on its side
        for (const [z, y] of [[-0.75, 0], [0.75, 0], [-0.75, 0.22], [0.75, 0.22]] as const) add(S.box(4.6, 0.2, 0.2), 'wood', 0, y, z);
        for (let k = 0; k < 4; k++) { add(S.box(0.14, 0.14, 1.6), 'dark', -1.9 + k * 1.25, 0.08, 0); add(S.box(0.14, 0.42, 0.14), 'dark', -1.9 + k * 1.25, 0, 0.75); }
        add(S.box(0.06, 0.04, 1.62), 'gold', 2.3, 0.42, 0);
      });
      sub(2.0, 0.4, 0.4, () => add(S.box(1.8, 0.1, 1.8), 'plank', 0, 0.04, 0, 0, 1, 1, 1, 0.12)); // its platform
      for (let k = 0; k < 9; k++) { const ang = r(-0.9, 0.9), d = r(2.6, 4.6); crate(Math.cos(ang) * d + 0.4, Math.sin(ang) * d, rnd() < 0.3, undefined, r(0.45, 0.58)); }
      splitSack(3.4, -1.6, 0.8); splitSack(2.6, 2.2, -0.6); sack(4.0, 0.4);
      if (cur.v === 1) { barrelLying(1.2, -2.4); barrelLying(1.4, 2.6); add(S.sheet(2.2, 1.4), a, -2.4, 0.02, 1.9, 0.4); add(S.box(2.22, 0.012, 0.05), 'gold', -2.4, 0.024, 2.6, 0.4); }
      else add(S.sheet(1.6, 1.2), a, -2.6, 0.02, -1.9, -0.3);
      main(2.2);
    },
    /** An echo prop on the way between a story and the road: arrows leaning towards the fight, a crate and a sack fallen from a load, a
     * shield and a helmet, a wheel (or a stone shot in its scar), papers blown along. Local +z points back at the story. */
    trail() {
      const a = army();
      prints(0, 0, 1.2, 6);
      switch (cur.v) {
        case 0: for (let k = 0; k < 7; k++) arrow(r(-0.5, 0.5), -1.2 + k * 0.4, Math.PI + r(-0.12, 0.12), 0.5); helmet(r(-0.6, 0.6), -1.0, true); break;
        case 1: crate(r(-0.3, 0.3), r(-0.3, 0.3), rnd() < 0.5); splitSack(0.7, 0.6, rnd() * 6.28); break;
        case 2: shield(0, 0, a, rnd() < 0.7, undefined, rnd() < 0.3 ? 0.2 : 0); helmet(0.7, 0.6); if (rnd() < 0.5) sword(-0.6, 0.4); break;
        case 3:
          if (scarred) { stain(0, 0, 0.8, 0.8, PAINT.scorch, 0.55); stain(0, 0, 1.3, 1.3, PAINT.fresh, 0.3); add(S.ball(0.17, 8), 'shot', 0, -0.06, 0); add(S.ball(0.17, 8), 'shot', 0.8, -0.04, 0.5); }
          else wheel(0, 0, 0.55);
          break;
        default: for (let k = 0; k < 6; k++) add(S.sheet(0.3, 0.4), 'paper', r(-0.5, 0.5), 0.015 + k * 0.001, -1.2 + k * 0.45, rnd() * 6);
      }
    },
    /** A siege ladder broken in two at the foot of a wall: the stub leans on the wall, the top half lies along it, a dropped shield. */
    ladder() {
      // local +z points at the wall; the scene's centre is 1.2 m out from the host's own radius
      const d = 1.2, len = 1.7, lean = 0.18;
      stain(0, 0.4, 2.0, 1.4, PAINT.mud, 0.5);
      prints(0, 0, 1.8, 12);
      if (cur.v === 1) { // the ladder thrown down whole along the wall's foot, a fascine of bound sticks dropped beside it
        sub(r(-0.2, 0.2), 0.5, Math.PI / 2 + r(-0.08, 0.08), () => {
          for (const s2 of [-0.26, 0.26]) add(S.box(0.07, 0.07, 3.8), 'wood', s2, 0, 0);
          for (let k = 0; k < 9; k++) add(S.box(0.5, 0.05, 0.05), 'wood', 0, 0.01, (k - 4) * 0.42);
        });
        sub(r(-0.6, 0.6), -0.9, r(-0.3, 0.3), () => { add(S.log(0.24, 1.8, 10), 'straw', 0, 0, 0); for (const x of [-0.6, 0, 0.6]) add(S.log(0.25, 0.06, 10), 'rope', x, -0.01, 0); });
        shield(r(1.0, 1.6), r(-1.4, -0.9), army(), rnd() < 0.6);
        for (let k = 0; k < 5; k++) arrow(r(-1.8, 1.8), r(-1.8, -1.2), Math.PI + r(-0.2, 0.2), 0.5);
        main(1.2);
        return;
      }
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
      main(0.9);
    },
    /** Past the edge: a farmhouse burned out, its walls stubs, beams black and fallen, the chimney standing and still smoking. */
    farmhouse() {
      const W2 = 7, D = 5;
      drape(7.0, PAINT.scorch, 0.75);
      if (cur.v === 1) { // a burned mill: the round tower's stub, the millstone down, the sails fallen across the ground, still smoking
        for (let k = 0; k < 14; k++) { if (rnd() < 0.2) continue; const a = (k / 14) * 6.28; add(S.box(1.0, r(0.8, 2.6), 0.6), rnd() < 0.5 ? 'charred' : 'soot', Math.sin(a) * 2.3, -0.1, Math.cos(a) * 2.3, a); }
        sub(-3.2, 2.6, r(0, 3), () => { add(S.cyl(0.95, 0.95, 0.32, 16), 'stone', 0, 0.2, 0, 0, 1, 1, 1, 0.25); add(S.cyl(0.2, 0.2, 0.34, 8), 'dark', 0, 0.2, 0, 0, 1, 1, 1, 0.25); });
        sub(1.6, -1.4, r(0.3, 0.8), () => { // the sails: two long arms crossed, their lattices
          for (const a of [0, Math.PI / 2]) sub(0, 0, a, () => {
            add(S.box(0.24, 0.24, 6.6), 'charred', 0, 0, 0);
            for (let k = 0; k < 6; k++) add(S.box(1.1, 0.06, 0.08), 'charred', 0.55, 0.05, 0.9 + k * 0.42);
          });
        });
        for (let k = 0; k < 4; k++) add(S.box(0.22, 0.22, r(2.4, 3.6)), 'charred', r(-1.5, 1.5), r(0.1, 0.8), r(-1.5, 1.5), rnd() * 3, 1, 1, 1, r(-0.4, 0.4));
        for (let k = 0; k < 4; k++) sack(r(3.2, 4.6), r(1, 3));
        smoke(0, 0, 6, 0.65);
        main(3.0);
        return;
      }
      const course = (x: number, z: number, len: number, along: boolean) => {
        for (let k = 0; k < Math.round(len / 1.1); k++) {
          const t = (k + 0.5) / Math.round(len / 1.1) - 0.5, h = r(0.4, 1.7);
          if (rnd() < 0.15) continue;
          add(S.box(along ? len / Math.round(len / 1.1) : 0.5, h, along ? 0.5 : len / Math.round(len / 1.1)), rnd() < 0.5 ? 'charred' : 'soot', x + (along ? t * len : 0), -0.1, z + (along ? 0 : t * len));
        }
      };
      course(0, -D / 2, W2, true); course(0, D / 2, W2, true); course(-W2 / 2, 0, D, false); course(W2 / 2, 0, D, false);
      add(S.box(1.1, 4.6, 1.1), 'soot', W2 / 2 - 0.3, -0.2, -0.6); add(S.box(1.2, 0.3, 1.2), 'charred', W2 / 2 - 0.3, 4.4, -0.6);
      for (let k = 0; k < 5; k++) add(S.box(0.22, 0.22, r(3.2, 4.6)), 'charred', r(-2.5, 2), r(0.2, 1.6), r(-1.6, 1.6), rnd() * 3, 1, 1, 1, r(-0.5, 0.5));
      sub(-1, 0, 0.4, () => { add(S.box(0.2, 0.2, 3.6), 'charred', 0, 0.5, 0, 0, 1, 1, 1, 0.4, 0.5); add(S.box(0.2, 0.2, 3.6), 'charred', 0.8, 0.5, 0, 0, 1, 1, 1, 0.4, -0.5); }); // the roof's frame down
      sub(0, D / 2 + 0.3, 0, () => { for (const s of [-0.6, 0.6]) add(S.box(0.22, 2.1, 0.22), 'dark', s, -0.1, 0); add(S.box(1.5, 0.22, 0.26), 'dark', 0, 2.0, 0); });
      for (let k = 0; k < 6; k++) add(S.stone(r(0.25, 0.45)), 'soot', r(-4, 4), -0.05, r(-3.5, 3.5), rnd() * 6);
      wheel(-4.6, 2.6, 0.5);
      sub(4.8, 2.4, 0.3, () => { add(S.box(1.2, 0.8, 0.6), 'plank', 0, 0, 0, 0, 1, 1, 1, 0.1); add(S.box(1.25, 0.06, 0.65), 'charred', 0, 0.8, 0); });
      smoke(-0.8, 0.3, 5.5, 0.6);
      main(3.5);
    },
    /** Past the edge: an army's field hospital, two bell tents under its banner, cots in a row, a basin and chests. */
    tents() {
      const a = cur.side === 'mid' ? 'crimson' : cur.side;
      drape(6.2, PAINT.trodden, 0.6);
      if (cur.v === 1) { // one bell tent still standing, the other down flat round its fallen pole, the banner pole broken
        sub(-2.6, -1.2, rnd() * 3, () => {
          add(S.cone(2.0, 2.9, 8), 'canvas', 0, 0, 0); add(S.cyl(1.65, 2.02, 0.35, 8), a, 0, 0, 0);
          add(S.cyl(0.04, 0.04, 3.4, 5), 'gold', 0, 0, 0); add(S.box(0.8, 1.3, 0.05), 'dark', 0, 0, 1.75, 0, 1, 1, 1, -0.5);
        });
        sub(2.6, -0.8, rnd() * 3, () => {
          add(S.cyl(2.1, 2.3, 0.18, 10), 'canvas', 0, 0, 0); add(S.ring(2.2, 0.08, 16), a, 0, 0.04, 0);
          add(S.log(0.04, 3.4, 5), 'gold', 0.4, 0.2, 0.3, 0.6);
        });
        sub(0.4, 2.6, 0.4, () => { add(S.log(0.08, 3.0, 6), 'wood', 0, 0, 0); add(S.sheet(1.0, 1.4), a, 0.9, 0.17, 0.85); add(S.cone(0.1, 0.32, 5), 'gold', -1.7, 0.08, 0, 0, 1, 1, 1, 0, Math.PI / 2); });
        for (let k = 0; k < 3; k++) sub((k - 1) * 1.2 - 1.0, 4.0, r(-0.4, 0.4), () => { add(S.box(0.75, 0.42, 1.9), 'wood', 0, 0, 0, 0, 1, 1, 1, 0, k === 1 ? 1.4 : 0); add(S.box(0.7, 0.08, 1.8), 'linen', 0.3, 0, 0.3, 0.5); });
        crate(4.2, 2.6, true);
        main(3.0);
        return;
      }
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
      main(3.0);
    },
    /** Past the edge: a graveyard of the fallen, rows of mounds, a sword upright in each with a helmet on its hilt, a torn banner over them. */
    graveyard() {
      const a = cur.side === 'mid' ? (rnd() < 0.5 ? 'crimson' : 'azure') : cur.side;
      drape(5.6, PAINT.fresh, 0.55);
      if (cur.v === 1) { // one long row of cairns, a sword upright in each, the army's banner at the row's head
        for (let k = 0; k < 7; k++) sub((k - 3) * 1.3, r(-0.2, 0.2), 0, () => {
          add(S.stone(0.42), 'stone', 0, -0.1, 0, rnd() * 6); add(S.stone(0.32), 'rubble', 0.1, 0.32, -0.05, rnd() * 6); add(S.stone(0.22), 'stone', -0.05, 0.6, 0.05, rnd() * 6);
          add(S.box(0.06, 0.8, 0.014), 'steel', 0, 0.55, -0.45); add(S.box(0.3, 0.05, 0.05), 'gold', 0, 1.28, -0.45); add(S.box(0.045, 0.2, 0.045), 'dark', 0, 1.32, -0.45);
        });
        add(S.ring(0.26, 0.06, 12), 'leaf', 0.2, 0.05, 1.0);
        sub(-4.9, 0.6, 0, () => { add(S.cyl(0.07, 0.09, 3.8, 6), 'wood', 0, 0, 0, 0, 1, 1, 1, 0.05); add(S.box(1.1, 0.07, 0.07), 'wood', 0, 3.45, 0); add(S.cloth(0.95, 1.4), a, 0, 3.42, 0); });
        main(3.2);
        return;
      }
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
      main(3.5);
    },
    /** Past the edge: a watchtower fallen in pieces, its frame on its side, the platform and roof apart, its ladder and planks strewn. */
    watchtower() {
      drape(6.6, PAINT.mud, 0.6);
      if (cur.v === 1) { // burned where it stood: four black posts, the platform fallen in between them, the roof on the ground, a brazier tipped
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(S.box(0.24, r(1.8, 3.2), 0.24), 'charred', x, -0.1, z, 0, 1, 1, 1, r(-0.08, 0.08), r(-0.08, 0.08));
        add(S.box(2.2, 0.16, 2.2), 'charred', 0.1, 0.4, 0, 0.2, 1, 1, 1, 0.3, 0.15);
        sub(3.4, -1.4, 0.4, () => add(S.cone(1.6, 1.4, 4), 'dark', 0, 0, 0, Math.PI / 4, 1, 1, 1, 0.5));
        sub(-2.6, 2.4, 0, () => { add(S.cyl(0.45, 0.25, 0.4, 10), 'iron', 0, 0.42, 0, 0, 1, 1, 1, 0, Math.PI / 2); for (let k = 0; k < 4; k++) add(S.box(0.2, 0.06, 0.2), 'ember', r(0.4, 1.2), 0, r(-0.5, 0.5), rnd() * 3); });
        for (let k = 0; k < 6; k++) add(S.box(0.3, 0.05, r(1.2, 2)), 'charred', r(-4, 4), 0.02, r(-3.5, 3.5), rnd() * 6, 1, 1, 1, r(-0.1, 0.1));
        shield(2.4, 2.6, army(), true, undefined, 0.3);
        smoke(0, 0, 4.5, 0.5);
        main(2.4);
        return;
      }
      sub(0, 0, Math.PI / 2 + r(-0.15, 0.15), () => { // the frame on its side
        for (const [x, y] of [[-0.8, 0.12], [0.8, 0.12], [-0.8, 1.5], [0.8, 1.5]]) add(S.box(0.22, 0.22, 6.4), 'wood', x, y - 0.1, 0);
        for (let k = 0; k < 4; k++) { add(S.box(1.8, 0.14, 0.14), 'dark', 0, 0.1, (k - 1.5) * 2); add(S.box(0.14, 1.5, 0.14), 'dark', 0.8, 0.1, (k - 1.5) * 2); }
        add(S.box(2.0, 2.0, 0.18), 'plank', 0, -0.05, 3.3, 0, 1, 1, 1, 0.15);
        sub(0.6, 5.3, 0.5, () => add(S.cone(1.6, 1.4, 4), 'dark', 0, 0.6, 0, Math.PI / 4, 1, 1, 1, Math.PI / 2 - 0.15));
      });
      for (let k = 0; k < 6; k++) add(S.box(0.3, 0.05, r(1.2, 2)), 'plank', r(-4, 4), 0.02, r(-3.5, 3.5), rnd() * 6, 1, 1, 1, r(-0.1, 0.1));
      sub(-2.6, 2.6, 0.6, () => { for (const s of [-0.26, 0.26]) add(S.box(0.07, 0.07, 3.2), 'wood', s, 0, 0); for (let k = 0; k < 7; k++) add(S.box(0.5, 0.05, 0.05), 'wood', 0, 0.01, (k - 3) * 0.42); });
      shield(2.4, -2.6, army(), true, undefined, 0.3);
      main(3.2);
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
  if (pg && o.ground) o.ground.map.needsUpdate = true;

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

  // The smoke: a few puffs a source, rising, swelling and leaning with the wind; one instanced mesh, no allocation a frame.
  let life: { update(time: number): void } | null = null;
  if (smokes.length) {
    const PUFFS = 7;
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    const smokeMat = new THREE.MeshLambertMaterial({ color: 0x7c7672, transparent: true, opacity: 0.24, depthWrite: false });
    const puffs = new THREE.InstancedMesh(puffGeo, smokeMat, smokes.length * PUFFS);
    puffs.name = 'war-scenes-smoke';
    puffs.castShadow = puffs.receiveShadow = false;
    puffs.frustumCulled = false;
    puffs.renderOrder = 3;
    o.into.add(puffs);
    o.own.push(puffGeo, smokeMat, { dispose: () => puffs.dispose() });
    const pm = new THREE.Matrix4(), pv = new THREE.Vector3(), ps = new THREE.Vector3(), pq = new THREE.Quaternion();
    const drift = (time: number) => {
      for (let ci = 0; ci < smokes.length; ci++) {
        const c = smokes[ci];
        for (let i = 0; i < PUFFS; i++) {
          const t = (i / PUFFS + time * 0.09 + ci * 0.37) % 1, sz = c.r * (0.55 + 2.2 * t), j = ((i * 7919 + ci * 104729) % 97) / 97 - 0.5;
          pv.set(c.x + j * c.r * 0.8 + t * t * 0.9, c.y + 0.2 + t * c.h, c.z + j * c.r * 0.6 - t * t * 0.4);
          pm.compose(pv, pq, ps.set(sz, sz * 0.85, sz));
          puffs.setMatrixAt(ci * PUFFS + i, pm);
        }
      }
      puffs.instanceMatrix.needsUpdate = true;
    };
    drift(0);
    life = { update: drift };
  }
  warScenesLog.set(look.seed, {
    seed: look.seed, floor: o.floor, scenes, taken: o.taken, planMs: +lastPlanMs.toFixed(1), ms: +(performance.now() - t0).toFixed(1),
    paintMs: +paintMs.toFixed(1), tris: Math.round(tris), smokes: smokes.length,
  });
  return life;
}
