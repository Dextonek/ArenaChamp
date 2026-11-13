import type { CacheDef, DoorDef, PackDef, PersonDef, PlaceDef, QuestDef, Region, Spot, Step, WaystoneDef } from '../def';
import type { MoveSpec, PiecesDef, RulerDef } from '../pieces/types';
import type { Look, Piece, SeaLook } from '../zone';
import type { GenFloor } from './types';

/**
 * The sea chapter's generator (pipeline/designs/tower-50.md): floor `n` (2 to 9) of the sea, made from floor 1's parts (the Drowned
 * Harbour: its look, enemies, tide, kinds of quest, ruler's moves) in a new layout. Run by `pipeline/tools/gen-floors.ts` under `node`,
 * which bakes the result into a file; the game never runs this. It imports types only.
 *
 * Everything is laid out in one frame, the sea to the east (+u), and mirrored at the end for the floors whose sea is in the west. The
 * camera looks north: the camp is in the south and the lair in the north, as on floor 1. Coordinates are offsets from the ring's
 * middle (`RING`, 0 7) until the end, where they become the world's.
 */

const RING = { x: 0, z: 7 }; // src/arenas/common.ts `RING`
const R = 48; // zone.ts `ZONE_R`
type V = { x: number; z: number };

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const len = (v: V) => Math.hypot(v.x, v.z);
const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.z - b.z);
const add = (a: V, b: V, k = 1): V => ({ x: a.x + b.x * k, z: a.z + b.z * k });
const unit = (v: V): V => { const l = len(v) || 1; return { x: v.x / l, z: v.z / l }; };
/** A point `d` m out at `deg` degrees from the north, clockwise (east is 90). */
const polar = (deg: number, d: number): V => ({ x: d * Math.sin((deg * Math.PI) / 180), z: -d * Math.cos((deg * Math.PI) / 180) });
const segDist = (p: V, a: V, b: V) => {
  const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / l2)) : 0;
  return Math.hypot(p.x - (a.x + ex * t), p.z - (a.z + ez * t));
};

/** The heroes who can stand as people, rulers and gatekeepers (the roster's, src/kits). */
const ROSTER = ['Ada', 'Anka', 'Auriel', 'Bo', 'Bram', 'Brannoc', 'Cantor', 'Fenna', 'Gus', 'Hank', 'Isolde', 'Kaia', 'Lyra', 'Mabel', 'Marin', 'Mortis', 'Mum', 'Nyx', 'Oblivion', 'Opaline', 'Pip', 'Sefu', 'Shiori', 'Silvane', 'Sirix', 'Tempo', 'Vesper', 'Vitriol', 'Wick', 'Zephyr'];
/** Big, heavy figures for a ruler's body. */
const RULER_BODIES = ['Bram', 'Hank', 'Brannoc', 'Sirix', 'Mortis', 'Marin', 'Oblivion', 'Vesper', 'Cantor', 'Isolde'];

const FLOOR_NAMES = ['The Salt Docks', 'Gull Point', 'The Sunken Mile', 'Wreckers’ Cove', 'The Lantern Coast', 'Kelp Hollow', 'The Anchorage', 'The Brine Steps', 'The Pearl Shallows'];
const BLURBS = ['Docks where the salt never dries.', 'A point of rock the gulls will not leave.', 'A mile of town the sea walked into.', 'A cove that lured ships onto its rocks.', 'Lights along a coast that no ship reaches now.', 'A hollow full of kelp and the things in it.', 'An anchorage of boats that never sail.', 'Steps cut down to a sea that keeps rising.', 'Shallows where pearls lie with their divers.'];
const RULERS: [string, string][] = [['The Drowned Admiral', 'Fleet, cannon and tide'], ['The Salt King', 'Crowned in brine'], ['Mother of Wrecks', 'She keeps what sinks'], ['The Tide Judge', 'Every tide a sentence'], ['The Pearl Tyrant', 'Hoarder of the shallows'], ['The Bell Below', 'It rings the sea in'], ['The Lantern Leviathan', 'A light that eats ships'], ['The Gull Queen', 'Wings and anchors']];
const TINTS = ['#2f8a96', '#3a7a9a', '#2a6a7a', '#4a8a8a', '#2f6f8f', '#3f8f8a', '#2a7f7a', '#4a7a9a'];
const NAMED = ['The Brine Widow', 'Saltjaw', 'The Pale Diver', 'Captain Gull', 'Rustfin', 'Mother Kelp', 'The Tidecaller', 'Grim Anchor', 'Old Hobb’s Ghost'];
const NPCS = ['Tam', 'Wren', 'Marl', 'Cobb', 'Ysolde', 'Hobb', 'Nell', 'Fen'];
const LORE: [string, string][] = [
  ['The sea came in once and kept what it liked.', 'What it kept, it still visits at every tide.'],
  ['The boats were tied up for one night.', 'That was a hundred tides ago.'],
  ['They rang the bell to call the boats home.', 'The sea heard it too.'],
  ['Every house here was built a little higher than the last.', 'The sea was patient.'],
  ['The keeper wrote the tide down every day.', 'The last page says only: higher.'],
  ['Salt in the walls, salt in the bread.', 'Salt in the eyes of those who stayed.'],
  ['A climber passed here before you.', 'The tide stone remembers the name; the sea does not.'],
  ['The lights were lit for ships that never came.', 'They are lit still.'],
];

type Kind = 'market' | 'saltworks' | 'fort' | 'caves' | 'lighthouse' | 'beacon' | 'wreck' | 'shipyard';
const PLACE_NAMES: Record<Kind, string[]> = {
  market: ['The fish market', 'The net market', 'The oyster market'], saltworks: ['The salt pans', 'The drying racks'], fort: ['The old fort', 'The watch fort'],
  caves: ['The caves', 'The sea caves', 'The smugglers’ caves'], lighthouse: ['The lighthouse', 'The north light'], beacon: ['The beacon', 'The signal fire'],
  wreck: ['The wreck', 'The broken galley'], shipyard: ['The shipyard', 'The boat sheds'],
};
interface Place { id: string; kind: Kind; name: string; c: V; r: number; stand: V }

export interface SeaGenOptions { n: number; attempt?: number }

/** Makes floor `n` of the sea (2..9). `attempt` makes it again from another seed when a check has thrown a floor out. */
export function makeSeaFloor(o: SeaGenOptions): GenFloor {
  const n = o.n, seed = n * 1000 + (o.attempt ?? 0), rnd = mulberry(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  const range = (a: number, b: number) => a + (b - a) * rnd();
  const m: 1 | -1 = n % 2 === 0 ? -1 : 1; // even floors have their sea in the west
  const k = (n - 1) / 9; // 0 at floor 1, 1 at floor 10

  // --- who is where: the chapter's heroes in an order fixed for the chapter, so floors do not repeat each other's people ------------
  const order = shuffle(ROSTER, mulberry(1001));
  const at = (i: number) => order[(n * 5 + i) % order.length];
  const keeperHero = at(0), giverHero = at(1), traderHero = at(2), rivalHero = at(3), gateHero = at(4);
  const bodies = RULER_BODIES.filter((b) => ![keeperHero, giverHero, traderHero, rivalHero, gateHero].includes(b));
  const rulerBody = bodies[n % bodies.length];

  // --- the places: four round the middle, in slots (the camp is in the south) ---------------------------------------------------
  const kindA = pick(['market', 'saltworks', 'fort'] as const), kindB: Kind = kindA === 'fort' ? 'caves' : pick(['caves', 'caves', 'fort'] as const);
  const kindC = pick(['lighthouse', 'lighthouse', 'beacon'] as const), kindD = pick(['wreck', 'wreck', 'shipyard'] as const);
  const mk = (id: string, kind: Kind, deg: number, d: number, r = 8): Place => {
    const c = polar(deg, d), toMid = unit({ x: -c.x, z: -c.z });
    const back = kind === 'lighthouse' ? 7 : kind === 'beacon' ? 4.5 : kind === 'caves' ? 2 : kind === 'wreck' || kind === 'shipyard' ? 4 : 0;
    return { id, kind, name: pick(PLACE_NAMES[kind]), c, r, stand: add(c, toMid, back) };
  };
  // A's and B's packs at least 37 m apart: a pack wakes within 18 m, so closer than that one spot can have both on it (the cap is six).
  let A = mk('a', kindA, range(-112, -88), range(28, 32));
  let B = mk('b', kindB, kindB === 'caves' ? range(-40, -20) : range(-40, -22), range(31, 35));
  for (let i = 0; i < 300 && dist(A.c, B.c) < 37; i++) {
    A = mk('a', kindA, range(-120, -92), range(27, 32));
    B = mk('b', kindB, range(-40, -20), range(31, 36));
  }
  if (dist(A.c, B.c) < 37) throw new Error(`floor ${n}: no room for A and B apart`);
  const C = mk('c', kindC, range(32, 52), range(31, 35));
  const D = mk('d', kindD, range(100, 120), range(27, 30.5));
  const places = [A, B, C, D];
  const camp: Place = { id: 'camp', kind: 'market', name: 'The camp', c: { x: 0, z: 34 }, r: 7, stand: { x: 0, z: 37.5 } };

  // --- cover, and the ground kept clear ----------------------------------------------------------------------------------------
  const cover: Piece[] = [];
  const keep: { c: V; r: number }[] = []; // discs no scattered cover may touch
  const lanes: { a: V; b: V; w: number }[] = []; // corridors kept clear (paths, the patrol, the escort)
  const pill = (look: Look, c: V, r: number, h: number) => cover.push({ look, o: { ax: c.x, az: c.z, bx: c.x, bz: c.z, r, height: h, kind: 'pillar' } });
  const wallP = (look: Look, a: V, b: V, r = 0.35, h = 2.3) => cover.push({ look, o: { ax: a.x, az: a.z, bx: b.x, bz: b.z, r, height: h, kind: 'wall' } });
  /** Does a disc at `p` of radius `rad` touch any cover? */
  const hitsCover = (p: V, rad: number) => cover.some(({ o }) => segDist(p, { x: o.ax, z: o.az }, { x: o.bx, z: o.bz }) < o.r + rad);
  const inKeep = (p: V, rad: number) => keep.some((d) => dist(p, d.c) < d.r + rad) || lanes.some((l) => segDist(p, l.a, l.b) < l.w + rad);

  // The camp (floor 1's), the lair's wall across the north with its doorway (the door is in `doors`).
  pill('fire', { x: 0, z: 33.5 }, 0.9, 0.9); pill('tent', { x: -8.5, z: 36.5 }, 1.7, 2.6); pill('tent', { x: 8.5, z: 32.5 }, 1.7, 2.6);
  pill('crate', { x: -5, z: 30 }, 0.8, 1.2); pill('crate', { x: 5.4, z: 36.2 }, 0.8, 1.2); pill('barrel', { x: 3.2, z: 29.6 }, 0.6, 1);
  wallP('house', { x: -26, z: -41 }, { x: -3.4, z: -41 }, 0.5, 3.6); wallP('house', { x: 3.4, z: -41 }, { x: 26, z: -41 }, 0.5, 3.6);
  keep.push({ c: camp.c, r: 10 }, { c: { x: 0, z: -43 }, r: 4 });

  // Each place's own pieces round its stand.
  for (const p of places) {
    const out = unit(p.c), tan = { x: -out.z, z: out.x }; // away from the middle, and along the ring
    const P = (dOut: number, dTan: number): V => add(add(p.c, out, dOut), tan, dTan);
    switch (p.kind) {
      case 'market':
        for (const a of [45, 135, 225, 315]) {
          const rad = (a * Math.PI) / 180, mid = add(p.c, { x: Math.cos(rad), z: Math.sin(rad) }, 6.2), t = { x: -Math.sin(rad), z: Math.cos(rad) };
          wallP('stall', add(mid, t, -2.1), add(mid, t, 2.1));
        }
        for (const a of [0, 90, 180, 270]) { const rad = ((a + range(-15, 15)) * Math.PI) / 180; pill('crate', add(p.c, { x: Math.cos(rad), z: Math.sin(rad) }, 4.3), 0.8, 1.3); }
        for (let i = 0; i < 3; i++) { const rad = rnd() * 6.28; pill('barrel', add(p.c, { x: Math.cos(rad), z: Math.sin(rad) }, 8.2), 0.6, 1); }
        break;
      case 'saltworks':
        for (const s of [-1, 0, 1]) wallP('stall', P(2.2 + s * 3.2, -2.6), P(2.2 + s * 3.2, 2.6), 0.35, 1.2);
        for (let i = 0; i < 4; i++) pill('barrel', P(-3.5, -4 + i * 2.6), 0.6, 1);
        break;
      case 'fort':
        wallP('house', P(5.5, -5), P(5.5, 5), 0.45, 3.2); wallP('house', P(5.5, -5), P(-1.5, -5.5), 0.45, 3.2); wallP('house', P(5.5, 5), P(-1.5, 5.5), 0.45, 3.2);
        pill('crate', P(3.6, -3.4), 0.8, 1.3); pill('crate', P(3.6, 3.4), 0.8, 1.3);
        break;
      case 'caves': {
        for (const deg of [18, 46, 74, 102, 130, 158]) { const a = (deg * Math.PI) / 180; pill('rock', { x: p.c.x + Math.cos(a) * 6.6, z: p.c.z - Math.sin(a) * 6.6 }, 2.1, 5.6); }
        pill('rock', { x: p.c.x + 9.5, z: p.c.z + 3 }, 1.2, 2.2); pill('rock', { x: p.c.x - 9.8, z: p.c.z + 4.5 }, 1.4, 2.6);
        break;
      }
      case 'lighthouse':
        pill('lighthouse', p.c, 2.8, 16);
        { const st = p.stand, side = { x: -unit({ x: p.c.x - st.x, z: p.c.z - st.z }).z, z: unit({ x: p.c.x - st.x, z: p.c.z - st.z }).x };
          wallP('stall', add(add(st, side, 6.5), out, 1.5), add(add(st, side, 6.5), out, -3), 0.4, 1.4);
          wallP('stall', add(add(st, side, -6.5), out, 1.5), add(add(st, side, -6.5), out, -3), 0.4, 1.4); }
        pill('crate', P(1, 5.5), 0.8, 1.3); pill('crate', P(-1, -5.5), 0.8, 1.3); pill('post', P(3.5, -4.5), 0.4, 3.9);
        break;
      case 'beacon':
        pill('fire', p.c, 1.3, 1.2);
        for (const a of [0, 120, 240]) { const rad = (a * Math.PI) / 180; pill('post', add(p.c, { x: Math.cos(rad), z: Math.sin(rad) }, 3.2), 0.4, 3.4); }
        wallP('stall', P(5, -4), P(5, 4), 0.4, 1.4);
        break;
      case 'wreck':
        cover.push({ look: 'hull', o: { ...seg(P(1.5, -6.5), P(4.5, 6)), r: 1.7, height: 3, kind: 'wall' } });
        pill('post', P(5.5, 8), 0.5, 5); pill('rock', P(-1, 6.5), 1.3, 1.6); pill('rock', P(2, -9), 1.5, 2);
        break;
      case 'shipyard':
        cover.push({ look: 'hull', o: { ...seg(P(3.2, -4.5), P(3.2, 4.5)), r: 1.5, height: 2.6, kind: 'wall' } });
        for (const s of [-1, 1]) { pill('post', P(1, s * 5.5), 0.4, 3.4); pill('post', P(5.5, s * 5.5), 0.4, 3.4); }
        pill('crate', P(-2.5, -4), 0.8, 1.3); pill('crate', P(-3, 3.5), 0.8, 1.3); pill('barrel', P(-2, 5.8), 0.6, 1);
        break;
    }
    keep.push({ c: p.c, r: p.r + 1.5 }, { c: p.stand, r: 3 });
  }
  // The ruined customs house, somewhere in the middle (not on every floor).
  let ruin: V | null = null;
  if (rnd() < 0.65) {
    ruin = { x: range(-7, 7), z: range(-10, -2) };
    wallP('house', add(ruin, { x: -6, z: -3 }), add(ruin, { x: 6, z: -3 }), 0.45, 3.4);
    wallP('house', add(ruin, { x: -6, z: -3 }), add(ruin, { x: -6, z: 3.5 }), 0.45, 3.4);
    wallP('house', add(ruin, { x: 6, z: -3 }), add(ruin, { x: 6, z: 3.5 }), 0.45, 3.4);
    keep.push({ c: add(ruin, { x: 0, z: 0.5 }), r: 7.5 });
  }

  // --- the paths: the camp to A and to D, A to B, B to C across the north, C to D -------------------------------------------------
  const edge = (p: Place, to: V) => add(p.c, unit({ x: to.x - p.c.x, z: to.z - p.c.z }), p.r - 1);
  const bend = (a: V, b: V, amp: number): V => { const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, t = unit({ x: -(b.z - a.z), z: b.x - a.x }); return add(mid, t, range(-amp, amp)); };
  const campA: V = { x: -2, z: 28 }, campD: V = { x: 3, z: 28 };
  const northMid: V = { x: range(-4, 4), z: -33 };
  const paths: V[][] = [
    [campA, bend(campA, A.c, 3), edge(A, campA)],
    [campD, bend(campD, D.c, 3), edge(D, campD)],
    [edge(A, B.c), bend(A.c, B.c, 2.5), edge(B, A.c)],
    [edge(B, northMid), northMid, edge(C, northMid)],
    [edge(C, D.c), bend(C.c, D.c, 2.5), edge(D, C.c)],
  ];
  for (const path of paths) for (let i = 1; i < path.length; i++) lanes.push({ a: path[i - 1], b: path[i], w: 2.4 });

  // --- doors and the spots of the quests, the people, the secrets ---------------------------------------------------------------
  /** A free spot: in the ring, off cover, off the kept ground. Tries round `near` within `spread`, widening. */
  const spot = (near: V, spread: number, rad: number, ok: (p: V) => boolean = () => true): V => {
    for (let i = 0; i < 400; i++) {
      const s = spread * (1 + i / 80), a = rnd() * 6.28, d = rnd() * s, p = { x: near.x + Math.cos(a) * d, z: near.z + Math.sin(a) * d };
      if (len(p) > R - 3 - rad || hitsCover(p, rad + 0.8) || inKeep(p, rad) || !ok(p)) continue;
      return { x: r2(p.x), z: r2(p.z) };
    }
    throw new Error(`floor ${n}: no free spot near ${near.x.toFixed(1)}, ${near.z.toFixed(1)}`);
  };
  const reserve = (p: V, r: number) => { keep.push({ c: p, r }); return p; };

  const lairDoor: V = { x: 0, z: -44.5 };
  const winch = reserve({ x: 13.5, z: 38.5 }, 2.5);
  const gate = reserve(spot({ x: pick([-15, 15]), z: 40 }, 2, 2.2), 3.5);
  const trial = reserve(spot(polar(range(-135, -120), 41.5), 2, 2), 3.5);
  const rivalDoor = reserve(spot(polar(range(-75, -55), 41), 2.5, 2), 3.5);
  const rivalAt = reserve(spot(add(rivalDoor, unit({ x: -rivalDoor.x, z: -rivalDoor.z }), 5), 1.5, 1.2), 2);
  const hold = reserve(spot({ x: range(-6, 6), z: range(-28, -22) }, 3, 4), 5);
  const reach = reserve(spot(polar(range(68, 88), 41), 2.5, 2), 3);
  const lore = reserve(spot(polar(range(128, 150), 38), 3, 1.5), 2.5);
  const caches = [polar(range(-160, -140), 41), polar(range(-10, 10), 39), polar(range(60, 80), 34)].map((p) => reserve(spot(p, 3, 1.5), 2.5));
  // Waystones well clear of the packs: a fall wakes the hero at the last one touched, at half health, and one 10 m from an awake
  // elite was a loop of falls (floor 2's first bake: the bot fell four times running at the wreck's stone).
  const packSpots = [A.c, B.c, D.c];
  const stones = [A, D, C].map((p) => reserve(spot(add(p.c, unit({ x: -p.c.x, z: -p.c.z }), 15), 2.5, 1.5, (q) => packSpots.every((s) => dist(s, q) >= 13)), 2.5));

  // The named enemy's patrol: four points round the middle; the way between them is kept clear.
  const patrol: V[] = [];
  for (const deg of [-60, 30, 120, 210].map((a) => a + range(-15, 15))) patrol.push(spot(polar(deg, range(10, 15)), 3, 2));
  for (let i = 0; i < 4; i++) lanes.push({ a: patrol[i], b: patrol[(i + 1) % 4], w: 1.8 });

  // The escort's road: from B to the camp along the paths (B to A, then A to the camp).
  const leadFrom = add(B.stand, unit({ x: -B.c.x, z: -B.c.z }), 5);
  const leadPath: V[] = [add(B.stand, unit({ x: -B.c.x, z: -B.c.z }), 6), ...paths[2].slice().reverse().slice(1), A.stand, ...paths[0].slice().reverse(), { x: 0, z: 31 }];
  for (let i = 1; i < leadPath.length; i++) lanes.push({ a: leadPath[i - 1], b: leadPath[i], w: 1.5 });
  const leadNpc = pick(NPCS);
  const q2Lead = rnd() < 0.6;
  const jarFrom = q2Lead ? null : reserve(spot(add(A.c, unit({ x: -A.c.x, z: -A.c.z }), 6), 2, 1.5), 2.5);
  const jarTo = q2Lead ? null : reserve({ x: 7.5, z: 31.5 }, 2);

  // --- the tide's flats: low ground in the open, off the camp, the doors and the stands -------------------------------------------
  const flats: Region[] = [];
  const keyspots = [lairDoor, gate, trial, rivalDoor, rivalAt, winch, hold, ...stones, ...places.map((p) => p.stand), C.stand, D.stand];
  for (let i = 0; i < 600 && flats.length < 7; i++) {
    const c = polar(range(-150, 150), range(12, 41)), rx = range(5, 8), rz = range(3, 5);
    if (dist(c, camp.c) < 14 || len(c) + rx > R - 2) continue;
    if (keyspots.some((s) => dist(s, c) < rx + 3)) continue;
    if (places.some((p) => dist(p.c, c) < p.r + rx * 0.7)) continue;
    if (flats.some((f) => dist(f, c) < 13)) continue;
    flats.push({ x: r2(c.x), z: r2(c.z), rx: r2(rx), rz: r2(rz), rot: r2(range(-0.6, 0.6)) });
  }

  // --- scattered cover in what is left: rocks, crates, barrels, so a way across has to bend ------------------------------------------
  const want = 18 + Math.round(4 * k);
  for (let i = 0, made = 0; i < 2000 && made < want; i++) {
    const p = polar(range(-180, 180), Math.sqrt(rnd()) * (R - 5));
    const look: Look = rnd() < 0.6 ? 'rock' : rnd() < 0.6 ? 'crate' : 'barrel', r = look === 'rock' ? range(1.1, 1.8) : look === 'crate' ? 0.8 : 0.6;
    if (len(p) > R - 3 - r || inKeep(p, r + 0.4) || hitsCover(p, r + 3.2) || flats.some((f) => dist(f, p) < Math.max(f.rx, f.rz) + r)) continue;
    pill(look, { x: r2(p.x), z: r2(p.z) }, r2(r), look === 'rock' ? r2(r * range(1.2, 1.6)) : look === 'crate' ? 1.3 : 1);
    made++;
  }

  // --- enemies (floor 1's, stronger), packs ---------------------------------------------------------------------------------------
  // Gentle: the handmade floors keep their roaming enemies about level (the Wood's and the Canyon's are floor 1's, give or take) and grow
  // harder in their set pieces. At first these were +7 % health and +4 % a hit a floor: by floor 9 the bot fell at every pack.
  const hpK = 1 + 0.015 * (n - 1), shK = 1 + 0.01 * (n - 1), shard = (x: number) => Math.round(x * (1 + 0.05 * (n - 1)));
  const named = NAMED[(n - 2 + NAMED.length) % NAMED.length];
  const enemies = {
    docker: { id: 'docker', name: 'Drowned docker', blurb: 'Strikes up close.', look: 'docker', melee: true, hp: Math.round(70 * hpK), share: r4(0.024 * shK), every: 1.8, speed: 3.2, scale: 1.3, shards: shard(4), color: '#7fd0c0' },
    netter: { id: 'netter', name: 'Net caster', blurb: 'Throws a net: you are rooted a moment.', look: 'netter', melee: false, hp: Math.round(50 * hpK), share: r4(0.02 * shK), every: 2.8, speed: 2.8, range: 9, scale: 1.3, net: { kind: 'root' as const, seconds: 0.8 }, shards: shard(5), color: '#9fe0a0' },
    crab: { id: 'crab', name: 'Brine crab', blurb: 'Slow and armoured.', look: 'crab', melee: true, hp: Math.round(170 * hpK), share: r4(0.035 * shK), every: 2.4, speed: 1.9, scale: 1.4, shards: shard(7), color: '#e08a70' },
    mate: { id: 'mate', name: 'The Harbourmaster’s Mate', blurb: `Guards ${D.name.toLowerCase()}.`, look: 'mate', melee: true, hp: Math.round(360 * hpK), share: r4(0.05 * shK), every: 1.6, speed: 3.0, scale: 1.9, shards: shard(30), color: '#ffd27a' },
    named: { id: 'named', name: named, blurb: 'Walks the middle and strikes hard.', look: 'barnacle', melee: true, hp: Math.round(520 * hpK), share: r4(0.06 * shK), every: 2.0, speed: 2.6, scale: 2.3, shards: shard(40), color: '#c8e0a0' },
  };
  const packs: PackDef[] = [
    { id: 'a', at: A.c, leash: 24, mix: [{ kind: 'docker', n: 2 }, { kind: 'netter', n: 1 }, { kind: 'crab', n: 1 }] },
    { id: 'd', at: D.c, leash: 24, mix: [{ kind: 'docker', n: 2 }], elite: 'mate' },
    // five, always: with the named enemy's patrol passing, six here made seven on one spot (the cap is six); later floors trade a docker for a net caster
    { id: 'b', at: { x: B.c.x, z: B.c.z + 0.5 }, leash: 24, mix: [{ kind: 'docker', n: n >= 7 ? 1 : 2 }, { kind: 'netter', n: n >= 7 ? 3 : 2 }, { kind: 'crab', n: 1 }] },
    { id: 'named', at: patrol[0], mix: [{ kind: 'named', n: 1 }], named: { name: named, speed: 1.6, patrol, bounty: { shards: shard(40), relic: true } } },
  ];

  // --- the set pieces: the ruler (the Drowned Captain's moves, another body and name), the gate, the trial, the rival ------------------
  const [rulerName, rulerTitle] = RULERS[(n - 2) % RULERS.length];
  const extra: [string, MoveSpec] = pick([
    ['spray', { use: 'stones', name: 'Falling Spray', share: 0.08, count: 3, cooldown: 6 }],
    ['whirl', { use: 'spokes', name: 'The Whirlpool', share: 0.09, cooldown: 14 }],
    ['fan', { use: 'fan', share: 0.05 }],
  ] as [string, MoveSpec][]);
  const ruler: RulerDef = {
    name: rulerName, title: rulerTitle, stand: rulerBody, tint: TINTS[(n - 2) % TINTS.length], scale: r2(range(2.1, 2.5)), hp: Math.round((2800 * (1 + 0.02 * (n - 1))) / 50) * 50, speed: 2.0, stagger: { max: 100, kneel: 5 },
    room: 'harbour',
    moves: {
      anchor: { use: 'sweep', name: pick(['Anchor Sweep', 'Chain Sweep', 'Mast Sweep']), share: 0.045, cooldown: 9 },
      cannons: { use: 'volley', name: pick(['Cannon Volley', 'Harpoon Volley', 'Shell Volley']), share: 0.085, cooldown: 5 },
      cleave: { use: 'cleave', share: 0.12 },
      lunge: { use: 'lunge', share: 0.12 },
      raise: { use: 'raise', name: 'The Wreck Opens Fire' },
      tide: { use: 'surge', name: 'The Tide Comes In', warn: 2.6, seconds: 11, cooldown: 28 },
      [extra[0]]: extra[1],
    },
    phases: [
      { name: `${rulerName.replace(/^The /, 'The ')} wakes`, at: 1, moves: ['anchor', 'cleave', 'lunge'], gap: [1.4, 2.2] },
      { name: 'The wreck opens fire', at: 0.66, opener: 'raise', moves: ['anchor', 'cannons', 'cleave', 'lunge', extra[0]], gap: [1.3, 2.1] },
      { name: 'The tide is called', at: 0.5, opener: 'tide', moves: ['anchor', 'cannons', 'cleave', 'lunge', extra[0]], timed: { move: 'tide', first: 24, every: 26, most: 99 }, gap: [1.1, 1.8] },
    ],
    sentries: { look: 'cannon', spots: [[68, 9.6], [292, 9.6]], hp: 150, again: 22, fall: { stagger: 55 }, from: 1 },
    surge: { safe: { decks: [{ x: 0, z: 7, r: 3.7 }, { x: 0, z: 14.6, r: 2.3 }, { x: 0, z: -0.6, r: 2.3 }] }, burn: 0.06, slow: 0.35, name: 'The tide', look: 'sea' },
    line: 'Stand on the deck when the tide comes in',
  };
  const twists = ['swift', 'giant', 'warded'] as const;
  const pieces: PiecesDef = {
    floor: n, hard: r2(1 + 0.012 * (n - 1)), // floor 1 is 1, the Wood (floor 11) 1.12
    ruler,
    gate: { hero: gateHero, arena: 'harbour', level: 3, twist: { kind: 'shift', name: 'The tide comes in', early: 29 } },
    trial: { kind: (['gauntlet', 'break', 'hold', 'horde'] as const)[n % 4], height: n < 6 ? 2 : 3 },
    rival: { hero: rivalHero, twist: twists[n % 3], line: `${rivalHero} waits by the arch`, height: 2 + Math.floor((n - 1) / 4) },
  };

  // --- people, quests, doors, secrets (offsets still; the world's coordinates come at the end) ----------------------------------
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const lightName = C.kind === 'lighthouse' ? 'the lighthouse' : 'the beacon';
  const people: (Omit<PersonDef, 'at'> & { at: V })[] = [
    { id: 'keeper', hero: keeperHero, name: keeperHero, role: 'keeper', at: { x: -2.6, z: 36 }, face: 0.4, greet: [`Another climber. ${A.name} is overrun, and ${rulerName} sits in the lair to the north, behind a chain only a key will lift.`], quests: ['main', 'bounty'] },
    { id: 'giver', hero: giverHero, name: giverHero, role: 'giver', at: { x: 5.5, z: 33.3 }, face: -0.5, greet: [pick(['The sea keeps what it takes. Perhaps you can take some of it back.', 'I have work, if you have legs. The tide does not wait.', 'Everything I own is somewhere on this shore. Help me find it.'])], quests: ['g1', 'g2'] },
    { id: 'rival', hero: rivalHero, name: rivalHero, role: 'rival', at: rivalAt, face: Math.atan2(-rivalAt.x, -rivalAt.z), greet: [], quests: [] },
    { id: 'trader', hero: traderHero, name: traderHero, role: 'trader', at: { x: -5.5, z: 39.5 }, face: 0.6, greet: ['Shards for what you need. Prices are fixed; the sea does not haggle either.'], quests: [] },
  ];
  const reward = (s: number, more: { boon?: boolean; relic?: boolean } = {}) => ({ shards: shard(s), ...more });
  const g2: QuestDef = q2Lead
    ? { id: 'g2', name: `${leadNpc} of ${B.name.replace(/^The /, '')}`, giver: 'giver', intro: [`${leadNpc} hides in ${lower(B.name)} and will not come out alone. Walk them back to the camp; stand close and they follow the road.`],
        steps: [{ verb: 'lead', text: `Lead ${leadNpc} from ${lower(B.name)} to the camp`, name: leadNpc, from: leadFrom, r: 2.5, path: leadPath } as Step], outro: [`${leadNpc} is home, and pays in what they have.`], reward: reward(45) }
    : { id: 'g2', name: 'A Jar of Oil', giver: 'giver', intro: [`A jar of good lamp oil was left at ${lower(A.name)}. Bring it to me before the tide finds it.`],
        steps: [{ verb: 'carry', text: `Bring the jar from ${lower(A.name)} to the camp`, item: 'jar', itemName: 'A jar of oil', toName: 'the camp', from: jarFrom!, to: jarTo!, r: 2.2, look: 'jar' } as Step], outro: ['Good oil, and dry. Take this.'], reward: reward(40) };
  const quests: QuestDef[] = [
    {
      id: 'main', name: pick(['The Harbour Key', 'The Captain’s Key', 'The Sea Gate Key']), giver: 'keeper', main: true,
      intro: [`Three things. Clear ${lower(A.name)}, where they gather. Then light ${lightName} so the boats know the harbour lives. Last, the key lies in ${lower(D.name)}, and the Mate guards it: clear them, then bring the key to the winch by the camp.`],
      steps: [
        { verb: 'fell', text: `Clear ${lower(A.name)}`, packs: ['a'] },
        { verb: 'light', text: `Light ${lightName}`, things: [{ id: 'light', at: C.stand }], seconds: 2 },
        // The key's guard first: a pack that loses the hero walks home and heals, so carrying the key past an awake Mate (a hit drops it)
        // was a loop of fetching it again (the route bot's falls on floors 2 and 9 were all at the wreck).
        { verb: 'fell', text: `Clear ${lower(D.name)}`, packs: ['d'] },
        { verb: 'carry', text: `Bring the key from ${lower(D.name)} to the winch`, item: 'key', itemName: 'The key', toName: 'the winch', from: D.stand, to: winch, r: 2.2, opens: 'lair' },
      ] as Step[],
      outro: [`The chain falls. ${rulerName}’s door stands open, far in the north. Take your time, then go in.`],
      reward: reward(60, { boon: true }),
    },
    { id: 'bounty', name: named, giver: 'keeper', intro: [`${named} walks the middle of the harbour. Fell it and the sea quietens a little.`], steps: [{ verb: 'fell-named', text: `Fell ${named}`, pack: 'named' }], outro: ['A relic from the deep. Keep it.'], reward: reward(40, { relic: true }) },
    {
      id: 'g1', name: 'The Net Lines', giver: 'giver', intro: ['My boat lies on the shore. My lines are hauled from a spot in the north: hold the place while I do.'],
      steps: [
        { verb: 'reach', text: 'Find the boat on the shore', at: reach, r: 3 },
        { verb: 'hold', text: 'Hold the net spot while the lines come in', at: hold, r: 3.6, seconds: 18 + Math.round(4 * k), waves: { kinds: ['docker', 'docker', 'docker'], every: 9 } },
      ] as Step[],
      outro: ['The lines are in. Take this, from the sea’s own pockets.'], reward: reward(35, { boon: true }),
    },
    g2,
  ];
  const doors: (Omit<DoorDef, 'at'> & { at: V })[] = [
    { id: 'lair', piece: 'ruler', name: `${rulerName}’s lair`, at: lairDoor, r: 2.2, wall: { ax: -3.4, az: -41, bx: 3.4, bz: -41, r: 0.5, height: 3.6 }, locked: `A chain holds the lair shut. ${keeperHero} has a quest about a key.` },
    { id: 'trial', piece: 'trial', name: pick(['The Flooded Vault', 'The Salt Cellar', 'The Drowned Chapel']), at: trial, r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: gate, r: 2.2, needs: { won: 'ruler' }, locked: `The gate is sealed. Its warden answers only once ${rulerName} has fallen.` },
    { id: 'rival', piece: 'rival', name: `${rivalHero}’s arch`, at: rivalDoor, r: 2, locked: '' },
  ];
  const cacheDefs = caches.map((c, i) => ({ id: `c${i + 1}`, at: c, shards: shard([25, 30, 20][i]), ...(i === 2 ? { boon: true } : {}) }));
  const stoneDefs = stones.map((s, i) => ({ id: `w${i + 1}`, name: `The ${[A, D, C][i].name.replace(/^The /, '').toLowerCase()} stone`, at: s }));
  const loreText = LORE[(n - 2) % LORE.length];

  // A few of the harbour file's props by the places (looks only: barrels, chests, mooring posts, cannons, boats).
  const props: { i: number; dx: number; dz: number; yaw: number }[] = [];
  for (const [p, kinds] of [[A, [0, 1, 2]], [D, [3, 4, 7]], [C, [5, 6]], [B, [0, 8]]] as [Place, number[]][]) {
    for (const i of kinds) {
      try { const s = spot(p.c, p.r + 3, 1.2, (q) => dist(q, p.c) > p.r - 1); props.push({ i, dx: s.x, dz: s.z, yaw: r2(range(0, 6.28)) }); } catch { /* no room: none */ }
    }
  }

  // --- into the world: mirrored if the sea is west, moved to the ring's middle -----------------------------------------------------
  const X = (v: V): Spot => ({ x: r2(RING.x + m * v.x), z: r2(RING.z + v.z) });
  const off = (v: V): [number, number] => [r2(m * v.x), r2(v.z)];
  const ob = (p: Piece): Piece => ({ look: p.look, o: { ...p.o, ax: r2(RING.x + m * p.o.ax), az: r2(RING.z + p.o.az), bx: r2(RING.x + m * p.o.bx), bz: r2(RING.z + p.o.bz) } });
  const face = (f: number) => r2(m * f);
  const mapStep = (s: Step): Step => {
    switch (s.verb) {
      case 'reach': case 'hold': return { ...s, at: X(s.at) };
      case 'light': return { ...s, things: s.things.map((t) => ({ ...t, at: X(t.at) })) };
      case 'carry': return { ...s, from: X(s.from), to: X(s.to) };
      case 'lead': return { ...s, from: X(s.from), path: s.path.map(X) };
      default: return s;
    }
  };
  const placeDefs: Record<string, PlaceDef> = {};
  for (const p of [camp, ...places]) placeDefs[p.id] = { id: p.id, name: p.name, ...X(p.c), r: p.r, stand: X(p.stand) };
  const nn = String(n).padStart(2, '0');
  const look: SeaLook = {
    places: [camp, ...places].map((p) => ({ id: p.id, ...X(p.c), r: p.r })),
    paths: paths.map((path) => path.map(off)),
    pieces: cover.map(ob),
    flats: flats.map((f) => ({ ...X(f), rx: f.rx, rz: f.rz, rot: r2(m * (f.rot ?? 0)) })),
    mirror: m, seed: n * 101,
    ...(B.kind === 'caves' ? { caves: { dx: r2(m * B.c.x), dz: r2(B.c.z) } } : {}),
    props: props.map((p) => ({ i: p.i, dx: r2(m * p.dx), dz: p.dz, yaw: r2(m * p.yaw) })),
  };
  return {
    n, chapter: 'sea', seed, look, pieces,
    floor: {
      n, id: `sea-${nn}`, name: FLOOR_NAMES[(n - 2) % FLOOR_NAMES.length], blurb: BLURBS[(n - 2) % BLURBS.length], ring: R,
      start: X({ x: 0, z: 39.5 }), camp: X({ x: 0, z: 36 }), places: placeDefs, par: 780 + 20 * (n - 1),
      shop: { heal: 30 + 2 * (n - 1), boon: 55 + 3 * (n - 1), life: 80 + 4 * (n - 1), hint: 15 },
      law: {
        kind: 'tide', name: 'The tide', blurb: `Every ${80 - (n - 1)} seconds the sea comes in for ${15 + Math.round(k * 2)}: the tidal flats flood, slow and hurt. The higher ground stays dry.`,
        every: 80 - (n - 1), lasts: 15 + Math.round(k * 2), warn: 7, burn: r4(0.02 * (1 + 0.02 * (n - 1))), slow: 0.6, low: look.flats,
      },
      enemies, packs: packs.map((p) => ({ ...p, at: X(p.at), ...(p.named ? { named: { ...p.named, patrol: p.named.patrol.map(X) } } : {}) })),
      people: people.map((p) => ({ ...p, at: X(p.at), face: face(p.face) })),
      quests: quests.map((q) => ({ ...q, steps: q.steps.map(mapStep) })),
      caches: cacheDefs.map((c): CacheDef => ({ ...c, at: X(c.at) })),
      waystones: stoneDefs.map((w): WaystoneDef => ({ ...w, at: X(w.at) })),
      lore: { id: 'lore', name: 'The tide stone', at: X(lore), text: [...loreText] },
      doors: doors.map((d) => ({ ...d, at: X(d.at), ...(d.wall ? { wall: { ...d.wall, ax: r2(RING.x + m * d.wall.ax), az: r2(RING.z + d.wall.az), bx: r2(RING.x + m * d.wall.bx), bz: r2(RING.z + d.wall.bz) } } : {}) })),
      rival: { hero: rivalHero, goal: 'the arch', mode: 'duel', at: X(rivalAt), boon: true, lines: [`Another climber. I am ${rivalHero}. Walk through the arch behind me and we see who is better. Win, and I fight beside you.`] },
    },
  };
}

function seg(a: V, b: V) {
  return { ax: r2(a.x), az: r2(a.z), bx: r2(b.x), bz: r2(b.z) };
}
function r4(x: number) {
  return Math.round(x * 10000) / 10000;
}
function shuffle<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
