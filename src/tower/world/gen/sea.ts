import type { CacheDef, DoorDef, EnemySpec, PackDef, PersonDef, PlaceDef, QuestDef, Region, Step, WaystoneDef } from '../def';
import type { MoveSpec, PiecesDef, RulerDef } from '../pieces/types';
import type { SeaLook } from '../zone';
import type { GenFloor } from './types';
import { Layout, add, dist, inside, makeOutline, mirrorRim, mulberry, polar, r2, r4, rimToward, roadRoute, shuffle, toMid, unit, worldOf, type V } from './core.ts';

/**
 * The sea chapter's generator (pipeline/designs/tower-50.md): floor `n` (2 to 10) of the sea, made from floor 1's parts (the Drowned
 * Harbour: its look, enemies, tide, kinds of quest, ruler's moves) on a zone five times floor 1's ground, of a wavy outline (the user,
 * 2026-11-14: "lets make those maps 5 x larger", "it doesnt need to have circular shape it can be whatever"). Run by
 * `pipeline/tools/gen-floors.ts` under `node`, which bakes the result into a file; the game never runs this.
 *
 * Laid out in one frame, the sea to the east, and mirrored at the end for the floors whose sea is in the west. The camera looks north:
 * the camp is in the south, the lair in the north. Eight places on two rings round the middle, joined by a ring road; roads from the camp.
 */

/** Gatekeepers and rivals are duels against a hero, by design. People and rulers get models of their own later (docs/tower/models);
 * until those exist they stand as heroes too. */
const ROSTER = ['Ada', 'Anka', 'Auriel', 'Bo', 'Bram', 'Brannoc', 'Cantor', 'Fenna', 'Gus', 'Hank', 'Isolde', 'Kaia', 'Lyra', 'Mabel', 'Marin', 'Mortis', 'Mum', 'Nyx', 'Oblivion', 'Opaline', 'Pip', 'Sefu', 'Shiori', 'Silvane', 'Sirix', 'Tempo', 'Vesper', 'Vitriol', 'Wick', 'Zephyr'];
const RULER_BODIES = ['Bram', 'Hank', 'Brannoc', 'Sirix', 'Mortis', 'Marin', 'Oblivion', 'Vesper', 'Cantor', 'Isolde'];
const HANDMADE_GATES = ['Marin', 'Fenna', 'Sefu', 'Opaline', 'Oblivion'];

const FLOOR_NAMES = ['The Salt Docks', 'Gull Point', 'The Sunken Mile', 'Wreckers’ Cove', 'The Lantern Coast', 'Kelp Hollow', 'The Anchorage', 'The Brine Steps', 'The Pearl Shallows'];
const BLURBS = ['Docks where the salt never dries.', 'A point of rock the gulls will not leave.', 'A mile of town the sea walked into.', 'A cove that lured ships onto its rocks.', 'Lights along a coast that no ship reaches now.', 'A hollow full of kelp and the things in it.', 'An anchorage of boats that never sail.', 'Steps cut down to a sea that keeps rising.', 'Shallows where pearls lie with their divers.'];
const RULERS: [string, string][] = [['The Drowned Admiral', 'Fleet, cannon and tide'], ['The Salt King', 'Crowned in brine'], ['Mother of Wrecks', 'She keeps what sinks'], ['The Tide Judge', 'Every tide a sentence'], ['The Pearl Tyrant', 'Hoarder of the shallows'], ['The Bell Below', 'It rings the sea in'], ['The Lantern Leviathan', 'A light that eats ships'], ['The Gull Queen', 'Wings and anchors']];
const TINTS = ['#2f8a96', '#3a7a9a', '#2a6a7a', '#4a8a8a', '#2f6f8f', '#3f8f8a', '#2a7f7a', '#4a7a9a'];
const NAMED = ['The Brine Widow', 'Saltjaw', 'The Pale Diver', 'Captain Gull', 'Rustfin', 'Mother Kelp', 'The Tidecaller', 'Grim Anchor', 'Old Hobb’s Ghost', 'The Wet Bell', 'Barnacle Bess'];
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
  ['The sea does not drown a town all at once.', 'It takes a street a year, and asks nothing.'],
];

type Kind = 'market' | 'village' | 'saltworks' | 'fort' | 'caves' | 'chapel' | 'lighthouse' | 'beacon' | 'wreck' | 'shipyard';
const PLACE_NAMES: Record<Kind, string[]> = {
  market: ['The fish market', 'The net market', 'The oyster market'], village: ['The fishers’ row', 'The old village', 'The lane of nets'], saltworks: ['The salt pans', 'The drying racks'],
  fort: ['The old fort', 'The watch fort'], caves: ['The caves', 'The sea caves', 'The smugglers’ caves'], chapel: ['The drowned chapel', 'The sailors’ chapel'],
  lighthouse: ['The lighthouse', 'The north light'], beacon: ['The beacon', 'The signal fire'], wreck: ['The wreck', 'The broken galley'], shipyard: ['The shipyard', 'The boat sheds'],
};
interface Place { id: string; kind: Kind; name: string; c: V; r: number; stand: V }

export interface SeaGenOptions { n: number; attempt?: number }

/** Five times floor 1's walkable ground (a circle of 48 m: 7238 m2). */
const AREA = 5 * Math.PI * 48 * 48;
const RING_X = 0, RING_Z = 7; // core.ts `RING`

export function makeSeaFloor(o: SeaGenOptions): GenFloor {
  const n = o.n, seed = n * 1000 + (o.attempt ?? 0), rnd = mulberry(seed);
  const m: 1 | -1 = n % 2 === 0 ? -1 : 1; // even floors have their sea in the west
  const k = (n - 1) / 9; // 0 at floor 1, 1 at floor 10
  // The index into the chapter's lists: floors 2 to 10 are 0 to 8; floor 1 (the harbour, made by gen/harbour.ts) is 8.
  const fi = (n + 7) % 9;
  const rim = makeOutline(rnd, { area: AREA, min: 72, max: 140 });
  const L = new Layout(rim, rnd, n);
  const range = (a: number, b: number) => L.range(a, b);
  const pick = <T>(xs: readonly T[]) => L.pick(xs);
  /** A spot at a bearing, `f` of the way from the middle to the outline. */
  const at = (deg: number, f: number) => polar(deg, rimToward(rim, deg) * f);

  // --- who is where: gatekeepers all different over the chapter, people five at a time round the rest ---------------------------
  const order = shuffle(ROSTER.filter((h) => !HANDMADE_GATES.includes(h)), mulberry(1001));
  const gates = order.slice(0, 9), folk = [...order.slice(9), ...HANDMADE_GATES];
  const who = (i: number) => folk[(fi * 5 + i) % folk.length];
  const keeperHero = who(0), giverHero = who(1), traderHero = who(2), rivalHero = who(3), villagerHero = who(4), gateHero = gates[fi % gates.length];
  const turn = fi % RULER_BODIES.length, round = [...RULER_BODIES.slice(turn), ...RULER_BODIES.slice(0, turn)];
  const rulerBody = round.find((b) => ![keeperHero, giverHero, traderHero, rivalHero, villagerHero, gateHero].includes(b)) ?? 'Bram';

  // --- the camp in the south, the lair in the north, the outline's walls ----------------------------------------------------------
  const southR = rimToward(rim, 180), northR = rimToward(rim, 0);
  const camp: Place = { id: 'camp', kind: 'market', name: 'The camp', c: { x: 0, z: r2(southR - 16) }, r: 7, stand: { x: 0, z: r2(southR - 12.5) } };
  const cz = camp.c.z, C = (dx: number, dz: number): V => ({ x: dx, z: r2(cz + dz) });
  L.edges();
  L.pill('fire', C(0, -0.5), 0.9, 0.9); L.pill('tent', C(-8.5, 2.5), 1.7, 2.6); L.pill('tent', C(8.5, -1.5), 1.7, 2.6);
  L.pill('crate', C(-5, -4), 0.8, 1.2); L.pill('crate', C(5.4, 2.2), 0.8, 1.2); L.pill('barrel', C(3.2, -4.4), 0.6, 1);
  L.reserve(camp.c, 11);
  // The lair: a walled yard against the north edge, its doorway facing the middle.
  const lairZ = r2(-northR + 9), lairDoor: V = { x: 0, z: r2(-northR + 5) };
  L.wall('house', { x: -22, z: lairZ }, { x: -3.4, z: lairZ }, 0.5, 3.6); L.wall('house', { x: 3.4, z: lairZ }, { x: 22, z: lairZ }, 0.5, 3.6);
  for (const s of [-1, 1]) L.wall('house', { x: s * 22, z: lairZ }, { x: s * 22, z: lairZ - 7 }, 0.5, 3.6);
  L.reserve({ x: 0, z: lairZ + 2 }, 6);

  // --- eight places on two rings round the middle -------------------------------------------------------------------------------
  // Canonical bearings (the sea is east, 90): the outer ring 0.66 to 0.82 of the way out, the inner 0.34 to 0.46. Packs 42 m apart at least.
  const kindA = pick(['market', 'saltworks'] as const), kindF = pick(['fort', 'chapel'] as const);
  const kindW = pick(['wreck', 'wreck', 'shipyard'] as const);
  const slots: { id: string; kind: Kind; deg: [number, number]; f: [number, number]; r?: number }[] = [
    { id: 'a', kind: kindA, deg: [-118, -100], f: [0.66, 0.76] }, // land side, south-west: the main quest's pack
    { id: 'v', kind: 'village', deg: [-80, -62], f: [0.7, 0.8], r: 9 }, // land side, west: the village (no pack)
    { id: 'b', kind: 'caves', deg: [-40, -22], f: [0.72, 0.8] }, // north-west, under the cliff
    { id: 'f', kind: 'fort', deg: [-8, 12], f: [0.36, 0.46] }, // the inner north
    { id: 'c', kind: 'lighthouse', deg: [32, 52], f: [0.74, 0.82] }, // the north-east headland
    { id: 'e', kind: 'beacon', deg: [86, 102], f: [0.72, 0.8] }, // the east shore
    { id: 'd', kind: kindW, deg: [118, 135], f: [0.68, 0.76] }, // the south-east shore: the key and its guard
    { id: 'h', kind: kindF === 'fort' ? 'chapel' : kindF, deg: [-150, 150], f: [0.34, 0.46] }, // the inner ring, anywhere free
  ];
  const places: Place[] = [];
  const packIds = ['a', 'b', 'f', 'd'];
  for (const s of slots) {
    let c: V | null = null;
    for (let i = 0; i < 400; i++) {
      const p = at(range(...s.deg), range(...s.f));
      if (places.some((q) => dist(q.c, p) < (packIds.includes(q.id) && packIds.includes(s.id) ? 42 : 26))) continue;
      if (dist(p, camp.c) < 30 || dist(p, { x: 0, z: lairZ }) < 26 || inside(rim, p) < 14) continue;
      c = p;
      break;
    }
    if (!c) throw new Error(`floor ${n}: no room for ${s.id}`);
    const back = s.kind === 'lighthouse' ? 7 : s.kind === 'beacon' ? 4.5 : s.kind === 'caves' ? 2 : s.kind === 'wreck' || s.kind === 'shipyard' ? 4 : 0;
    const cc = { x: r2(c.x), z: r2(c.z) }, st = add(cc, toMid(cc), back);
    places.push({ id: s.id, kind: s.kind, name: pick(PLACE_NAMES[s.kind]), c: cc, r: s.r ?? 8, stand: { x: r2(st.x), z: r2(st.z) } });
  }
  const P = (id: string) => places.find((p) => p.id === id)!;
  const A = P('a'), B = P('b'), D = P('d'), Fp = P('f'), Cl = P('c'), E = P('e'), Vl = P('v'), H = P('h');

  // Each place's own pieces round its stand.
  for (const p of places) {
    const out = unit(p.c), tan = { x: -out.z, z: out.x };
    const Q = (dOut: number, dTan: number): V => add(add(p.c, out, dOut), tan, dTan);
    switch (p.kind) {
      case 'market':
        for (const a of [45, 135, 225, 315]) {
          const rad = (a * Math.PI) / 180, mm = add(p.c, { x: Math.cos(rad), z: Math.sin(rad) }, 6.2), t = { x: -Math.sin(rad), z: Math.cos(rad) };
          L.wall('stall', add(mm, t, -2.1), add(mm, t, 2.1));
        }
        for (const a of [0, 90, 180, 270]) { const rad = ((a + range(-15, 15)) * Math.PI) / 180; L.pill('crate', add(p.c, { x: Math.cos(rad), z: Math.sin(rad) }, 4.3), 0.8, 1.3); }
        for (let i = 0; i < 3; i++) { const rad = rnd() * 6.28; L.pill('barrel', add(p.c, { x: Math.cos(rad), z: Math.sin(rad) }, 8.2), 0.6, 1); }
        break;
      case 'village':
        // two rows of houses either side of a lane (their walls are the cover), a barrel and a crate
        // cottages 6 m long on 6.5 m: apart, with a gap too narrow to walk (overlapping, their roofs fought in stripes)
        for (const s of [-1, 1]) for (const t of [-6.5, 0, 6.5]) L.wall('house', Q(s * 5 - 1.4, t - 1.6), Q(s * 5 - 1.4, t + 1.6), 1.4, 3.6);
        L.pill('barrel', Q(0, 9.5), 0.6, 1); L.pill('crate', Q(2, -9.5), 0.8, 1.2);
        break;
      case 'saltworks':
        for (const s of [-1, 0, 1]) L.wall('stall', Q(2.2 + s * 3.2, -2.6), Q(2.2 + s * 3.2, 2.6), 0.35, 1.2);
        for (let i = 0; i < 4; i++) L.pill('barrel', Q(-3.5, -4 + i * 2.6), 0.6, 1);
        break;
      case 'fort':
        L.wall('house', Q(5.5, -5), Q(5.5, 5), 0.45, 3.2); L.wall('house', Q(5.5, -5), Q(-1.5, -5.5), 0.45, 3.2); L.wall('house', Q(5.5, 5), Q(-1.5, 5.5), 0.45, 3.2);
        L.pill('crate', Q(3.6, -3.4), 0.8, 1.3); L.pill('crate', Q(3.6, 3.4), 0.8, 1.3);
        break;
      case 'chapel':
        // three walls of a small chapel, open to the middle, and two lantern posts
        L.wall('house', Q(4.5, -3.5), Q(4.5, 3.5), 0.45, 4); L.wall('house', Q(4.5, -3.5), Q(-1, -3.5), 0.45, 4); L.wall('house', Q(4.5, 3.5), Q(-1, 3.5), 0.45, 4);
        L.pill('post', Q(-3, -4.5), 0.4, 3.4); L.pill('post', Q(-3, 4.5), 0.4, 3.4);
        break;
      case 'caves':
        for (const deg of [18, 46, 74, 102, 130, 158]) { const a = (deg * Math.PI) / 180; L.pill('rock', { x: p.c.x + Math.cos(a) * 6.6, z: p.c.z - Math.sin(a) * 6.6 }, 2.1, 5.6); }
        L.pill('rock', { x: p.c.x + 9.5, z: p.c.z + 3 }, 1.2, 2.2); L.pill('rock', { x: p.c.x - 9.8, z: p.c.z + 4.5 }, 1.4, 2.6);
        break;
      case 'lighthouse': {
        L.pill('lighthouse', p.c, 2.8, 16);
        const st = p.stand, d0 = unit({ x: p.c.x - st.x, z: p.c.z - st.z }), side = { x: -d0.z, z: d0.x };
        L.wall('stall', add(add(st, side, 6.5), out, 1.5), add(add(st, side, 6.5), out, -3), 0.4, 1.4);
        L.wall('stall', add(add(st, side, -6.5), out, 1.5), add(add(st, side, -6.5), out, -3), 0.4, 1.4);
        L.pill('crate', Q(1, 5.5), 0.8, 1.3); L.pill('crate', Q(-1, -5.5), 0.8, 1.3); L.pill('post', Q(3.5, -4.5), 0.4, 3.9);
        break;
      }
      case 'beacon':
        L.pill('fire', p.c, 1.3, 1.2);
        for (const a of [0, 120, 240]) { const rad = (a * Math.PI) / 180; L.pill('post', add(p.c, { x: Math.cos(rad), z: Math.sin(rad) }, 3.2), 0.4, 3.4); }
        L.wall('stall', Q(5, -4), Q(5, 4), 0.4, 1.4);
        break;
      case 'wreck':
        L.wall('hull', Q(1.5, -6.5), Q(4.5, 6), 1.7, 3);
        L.pill('post', Q(5.5, 8), 0.5, 5); L.pill('rock', Q(-1, 6.5), 1.3, 1.6); L.pill('rock', Q(2, -9), 1.5, 2);
        break;
      case 'shipyard':
        L.wall('hull', Q(3.2, -4.5), Q(3.2, 4.5), 1.5, 2.6);
        for (const s of [-1, 1]) { L.pill('post', Q(1, s * 5.5), 0.4, 3.4); L.pill('post', Q(5.5, s * 5.5), 0.4, 3.4); }
        L.pill('crate', Q(-2.5, -4), 0.8, 1.3); L.pill('crate', Q(-3, 3.5), 0.8, 1.3); L.pill('barrel', Q(-2, 5.8), 0.6, 1);
        break;
    }
    L.reserve(p.c, p.r + 1.5);
    L.reserve(p.stand, 3);
  }
  // The ruined customs house, in the middle (when no place stands there).
  const ruin = { x: r2(range(-8, 8)), z: r2(range(-6, 4)) };
  const hasRuin = places.every((p) => dist(p.c, ruin) > 20);
  if (hasRuin) {
    L.wall('house', add(ruin, { x: -6, z: -3 }), add(ruin, { x: 6, z: -3 }), 0.45, 3.4);
    L.wall('house', add(ruin, { x: -6, z: -3 }), add(ruin, { x: -6, z: 3.5 }), 0.45, 3.4);
    L.wall('house', add(ruin, { x: 6, z: -3 }), add(ruin, { x: 6, z: 3.5 }), 0.45, 3.4);
    L.reserve(add(ruin, { x: 0, z: 0.5 }), 7.5);
  }

  // --- roads: the camp to A and to D; a ring through the outer places; spokes to the inner ones -----------------------------------
  const edge = (p: Place, to: V) => { const e = add(p.c, unit({ x: to.x - p.c.x, z: to.z - p.c.z }), p.r - 1); return { x: r2(e.x), z: r2(e.z) }; };
  const campW: V = C(-2.5, -6), campE: V = C(3, -6);
  const outer = [A, Vl, B, Cl, E, D]; // by bearing: the land side, round the north, to the sea side
  const roads: V[][] = [L.road(campW, edge(A, campW), 1, 4), L.road(campE, edge(D, campE), 1, 4)];
  for (let i = 1; i < outer.length; i++) roads.push(L.road(edge(outer[i - 1], outer[i].c), edge(outer[i], outer[i - 1].c), 2, 5));
  // the inner places: each joined to its nearest outer place and to the middle
  const middle: V = hasRuin ? add(ruin, { x: 0, z: 6 }) : { x: 0, z: 0 };
  for (const p of [Fp, H]) {
    const near = outer.reduce((b, q) => (dist(q.c, p.c) < dist(b.c, p.c) ? q : b));
    roads.push(L.road(edge(near, p.c), edge(p, near.c), 1, 3));
    roads.push(L.road(edge(p, middle), middle, 1, 3));
  }
  roads.push(L.road(C(0, -7), middle, 2, 5)); // the camp to the middle
  roads.push(L.road(middle, add(lairDoor, { x: 0, z: 6 }), 2, 4)); // the middle to the lair

  // --- doors and the spots of the quests, the people, the secrets ---------------------------------------------------------------
  const winch = L.reserve(C(13.5, 4.5), 2.5);
  const gate = L.reserve(L.spot(C(pick([-16, 16]), 6), 2, 2.2), 3.5);
  const trial = L.reserve(L.spot(at(range(-150, -132), 0.85), 4, 2), 3.5);
  const rivalDoor = L.reserve(L.spot(at(range(-58, -46), 0.88), 4, 2), 3.5);
  const rivalAt = L.reserve(L.spot(add(rivalDoor, toMid(rivalDoor), 5), 1.5, 1.2), 2);
  const villagerAt = L.reserve(L.spot(Vl.stand, 2, 1.2), 2);
  const hold = L.reserve(L.spot(at(range(-15, 15), 0.62), 4, 4), 5);
  const reach = L.reserve(L.spot(at(range(60, 80), 0.88), 4, 2), 3);
  const lore = L.reserve(L.spot(at(range(150, 165), 0.82), 4, 1.5), 2.5);
  const caches = [at(range(-170, -155), 0.86), at(range(-95, -85), 0.9), at(range(-20, -5), 0.9), at(range(15, 25), 0.88), at(range(70, 80), 0.6), at(range(140, 150), 0.88)]
    .map((p) => L.reserve(L.spot(p, 4, 1.5), 2.5));
  const packSpots = [A.c, B.c, Fp.c, D.c];
  const stoneNear = [A, Vl, B, Cl, D, H];
  const stones = stoneNear.map((p) => L.reserve(L.spot(add(p.c, toMid(p.c), 15), 3, 1.5, (q) => packSpots.every((s) => dist(s, q) >= 14)), 2.5));

  // Two named enemies: one walks a loop round the middle, one the land side. Their ways are kept clear.
  const patrol1: V[] = [-60, 30, 120, 210].map((a) => L.spot(polar(a + range(-15, 15), range(18, 26)), 3, 2));
  for (let i = 0; i < 4; i++) L.lane(patrol1[i], patrol1[(i + 1) % 4], 1.8);
  const patrol2: V[] = [at(range(-125, -115), 0.5), at(range(-95, -85), 0.52), at(range(-65, -55), 0.52), at(range(-40, -30), 0.5)].map((p) => L.spot(p, 4, 2, (q) => packSpots.every((s) => dist(s, q) > 20)));
  for (let i = 1; i < 4; i++) L.lane(patrol2[i - 1], patrol2[i], 1.8);
  const patrol2Loop = [...patrol2, ...patrol2.slice(1, 3).reverse()];

  // The escort's road: from the caves (B) to the camp along the roads.
  const leadFrom = add(B.stand, toMid(B.c), 5);
  const leadPath = roadRoute(roads, add(B.stand, toMid(B.c), 6), C(0, -3)).map((p) => ({ x: r2(p.x), z: r2(p.z) }));
  leadPath.push(C(0, -3));
  for (let i = 1; i < leadPath.length; i++) L.lane(leadPath[i - 1], leadPath[i], 1.5);
  const leadNpc = pick(NPCS);
  const jarFrom = L.reserve(L.spot(add(Vl.c, toMid(Vl.c), 8), 2, 1.5), 2.5);
  const jarTo = L.reserve(C(7.5, -2.5), 2);

  // --- the tide's flats: low ground in the open, off the camp, the doors and the stands -------------------------------------------
  const flats: Region[] = [];
  const keyspots = [lairDoor, gate, trial, rivalDoor, rivalAt, winch, hold, reach, villagerAt, jarFrom, jarTo, ...stones, ...caches, ...places.map((p) => p.stand), ...patrol1];
  for (let i = 0; i < 3000 && flats.length < 16; i++) {
    const c = polar(range(-160, 160), Math.sqrt(rnd()) * 125), rx = range(5, 9), rz = range(3, 5.5);
    if (inside(rim, c) < rx + 3 || dist(c, camp.c) < 16) continue;
    if (keyspots.some((s) => dist(s, c) < rx + 3)) continue;
    if (places.some((p) => dist(p.c, c) < p.r + rx * 0.7)) continue;
    if (flats.some((f) => dist(f, c) < 15)) continue;
    flats.push({ x: r2(c.x), z: r2(c.z), rx: r2(rx), rz: r2(rz), rot: r2(range(-0.6, 0.6)) });
  }

  // --- scattered cover in what is left: rocks, crates, barrels, so a way across has to bend ------------------------------------------
  const want = 60 + Math.round(10 * k);
  for (let i = 0, made = 0; i < 8000 && made < want; i++) {
    const p = polar(range(-180, 180), Math.sqrt(rnd()) * 138);
    const look = rnd() < 0.6 ? 'rock' as const : rnd() < 0.6 ? 'crate' as const : 'barrel' as const, r = look === 'rock' ? range(1.1, 1.9) : look === 'crate' ? 0.8 : 0.6;
    if (inside(rim, p) < 3 + r || L.inKeep(p, r + 0.4) || L.hitsCover(p, r + 3.2) || flats.some((f) => dist(f, p) < Math.max(f.rx, f.rz) + r)) continue;
    L.pill(look, p, r, look === 'rock' ? r * range(1.2, 1.6) : look === 'crate' ? 1.3 : 1);
    made++;
  }

  // --- enemies (floor 1's, a little stronger a floor), packs -----------------------------------------------------------------------
  // The roaming enemies' growth is the game's own by the floor's tuned number (`tunedAs` below, `floorNumbers` in src/tower/floors.ts):
  // from 1 (floor 1) to 2 (floor 10), so the Wood (floor 11, tuned as 2) follows on with no step. (An own +1.5 % a floor on top of the
  // floor's real number made floor 9's packs nearly twice floor 1's: the bot took 50 minutes over it.)
  const hpK = 1, shK = 1, shard = (x: number) => Math.round(x * (1 + 0.05 * (n - 1)));
  const named1 = NAMED[(2 * fi) % NAMED.length], named2 = NAMED[(2 * fi + 1) % NAMED.length];
  const enemies: Record<string, EnemySpec> = {
    docker: { id: 'docker', name: 'Drowned docker', blurb: 'Strikes up close.', look: 'docker', melee: true, hp: Math.round(70 * hpK), share: r4(0.024 * shK), every: 1.8, speed: 3.2, scale: 1.3, shards: shard(4), color: '#7fd0c0' },
    netter: { id: 'netter', name: 'Net caster', blurb: 'Throws a net: you are rooted a moment.', look: 'netter', melee: false, hp: Math.round(50 * hpK), share: r4(0.02 * shK), every: 2.8, speed: 2.8, range: 9, scale: 1.3, net: { kind: 'root', seconds: 0.8 }, shards: shard(5), color: '#9fe0a0' },
    crab: { id: 'crab', name: 'Brine crab', blurb: 'Slow and armoured.', look: 'crab', melee: true, hp: Math.round(170 * hpK), share: r4(0.035 * shK), every: 2.4, speed: 1.9, scale: 1.4, shards: shard(7), color: '#e08a70' },
    mate: { id: 'mate', name: 'The Harbourmaster’s Mate', blurb: `Guards ${D.name.toLowerCase()}.`, look: 'mate', melee: true, hp: Math.round(360 * hpK), share: r4(0.05 * shK), every: 1.6, speed: 3.0, scale: 1.9, shards: shard(30), color: '#ffd27a' },
    named1: { id: 'named1', name: named1, blurb: 'Walks the middle and strikes hard.', look: 'barnacle', melee: true, hp: Math.round(520 * hpK), share: r4(0.06 * shK), every: 2.0, speed: 2.6, scale: 2.3, shards: shard(40), color: '#c8e0a0' },
    named2: { id: 'named2', name: named2, blurb: 'Walks the land side and strikes hard.', look: 'mate', melee: true, hp: Math.round(440 * hpK), share: r4(0.055 * shK), every: 1.8, speed: 2.8, scale: 2.1, shards: shard(35), color: '#e0c8a0' },
  };
  const packs: PackDef[] = [
    { id: 'a', at: A.c, leash: 24, mix: [{ kind: 'docker', n: 2 }, { kind: 'netter', n: 1 }, { kind: 'crab', n: 1 }] },
    { id: 'd', at: D.c, leash: 24, mix: [{ kind: 'docker', n: 2 }], elite: 'mate' },
    { id: 'b', at: { x: B.c.x, z: r2(B.c.z + 0.5) }, leash: 24, mix: [{ kind: 'docker', n: n >= 7 ? 1 : 2 }, { kind: 'netter', n: n >= 7 ? 3 : 2 }, { kind: 'crab', n: 1 }] },
    { id: 'f', at: Fp.c, leash: 24, mix: [{ kind: 'docker', n: 2 }, { kind: 'crab', n: 1 }] },
    { id: 'named1', at: patrol1[0], mix: [{ kind: 'named1', n: 1 }], named: { name: named1, speed: 1.6, patrol: patrol1, bounty: { shards: shard(40), relic: true } } },
    { id: 'named2', at: patrol2Loop[0], mix: [{ kind: 'named2', n: 1 }], named: { name: named2, speed: 1.7, patrol: patrol2Loop, bounty: { shards: shard(35), relic: false } } },
  ];

  // --- the set pieces: the ruler (the Drowned Captain's moves, another body and name), the gate, the trial, the rival ------------------
  // Floor 10 is the chapter's crown: behind the lair is a Raid boss, alone (pieces/core.ts `crownFight`); the first is the Sun Warden.
  const crown = n === 10 ? ('sun' as const) : undefined;
  const [rulerName, rulerTitle] = crown ? ['The Sun Warden', 'Keeper of the Sun Court'] : RULERS[fi % RULERS.length];
  const extra: [string, MoveSpec] = pick([
    ['spray', { use: 'stones', name: 'Falling Spray', share: 0.08, count: 3, cooldown: 6 }],
    ['whirl', { use: 'spokes', name: 'The Whirlpool', share: 0.09, cooldown: 14 }],
    ['fan', { use: 'fan', share: 0.05 }],
  ] as [string, MoveSpec][]);
  const ruler: RulerDef = {
    name: rulerName, title: rulerTitle, stand: rulerBody, tint: TINTS[fi % TINTS.length], scale: r2(range(2.1, 2.5)), hp: Math.round((2800 * (1 + 0.02 * (n - 1))) / 50) * 50, speed: 2.0, stagger: { max: 100, kneel: 5 },
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
      { name: `${rulerName} wakes`, at: 1, moves: ['anchor', 'cleave', 'lunge'], gap: [1.4, 2.2] },
      { name: 'The wreck opens fire', at: 0.66, opener: 'raise', moves: ['anchor', 'cannons', 'cleave', 'lunge', extra[0]], gap: [1.3, 2.1] },
      { name: 'The tide is called', at: 0.5, opener: 'tide', moves: ['anchor', 'cannons', 'cleave', 'lunge', extra[0]], timed: { move: 'tide', first: 24, every: 26, most: 99 }, gap: [1.1, 1.8] },
    ],
    sentries: { look: 'cannon', spots: [[68, 9.6], [292, 9.6]], hp: 150, again: 22, fall: { stagger: 55 }, from: 1 },
    surge: { safe: { decks: [{ x: 0, z: 7, r: 3.7 }, { x: 0, z: 14.6, r: 2.3 }, { x: 0, z: -0.6, r: 2.3 }] }, burn: 0.06, slow: 0.35, name: 'The tide', look: 'sea' },
    line: crown ? 'A Raid boss, alone: read its sun and keep moving' : 'Stand on the deck when the tide comes in',
  };
  const twists = ['swift', 'giant', 'warded'] as const;
  const pieces: PiecesDef = {
    floor: n, hard: r2(1 + 0.012 * (n - 1)), // floor 1 is 1, the Wood (floor 11) 1.12
    ruler,
    gate: { hero: gateHero, arena: 'harbour', level: 3, twist: { kind: 'shift', name: 'The tide comes in', early: 29 } },
    trial: { kind: (['gauntlet', 'break', 'hold', 'horde'] as const)[n % 4], height: n < 6 ? 2 : 3 },
    ...(crown ? { crown } : {}),
    rival: { hero: rivalHero, twist: twists[n % 3], line: `${rivalHero} waits by the arch`, height: 2 + Math.floor((n - 1) / 4) },
  };

  // --- people, quests, doors, secrets (offsets still; the world's coordinates come at the end) ----------------------------------
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const mid = (s: string) => s.replace(/^The /, 'the ');
  const poss = (s: string) => (s.endsWith('s') ? `${s}’` : `${s}’s`);
  const facing = (p: V) => r2(Math.atan2(-p.x, -p.z));
  const people: (Omit<PersonDef, 'at'> & { at: V })[] = [
    { id: 'keeper', hero: keeperHero, name: keeperHero, role: 'keeper', at: C(-2.6, 2), face: 0.4, greet: [`Another climber. ${A.name} is overrun, and ${mid(rulerName)} sits in the lair to the far north, behind a chain only a key will lift. The coast is long: take the roads.`], quests: ['main', 'bounty1', 'bounty2'] },
    { id: 'giver', hero: giverHero, name: giverHero, role: 'giver', at: C(5.5, -0.7), face: -0.5, greet: [pick(['The sea keeps what it takes. Perhaps you can take some of it back.', 'I have work, if you have legs. The tide does not wait.', 'Everything I own is somewhere on this shore. Help me find it.'])], quests: ['g1', 'g2'] },
    { id: 'villager', hero: villagerHero, name: villagerHero, role: 'giver', at: villagerAt, face: facing(villagerAt), greet: [`You came all the way to ${lower(Vl.name)}? Then you can carry something back.`], quests: ['g3'] },
    { id: 'rival', hero: rivalHero, name: rivalHero, role: 'rival', at: rivalAt, face: facing(rivalAt), greet: [], quests: [] },
    { id: 'trader', hero: traderHero, name: traderHero, role: 'trader', at: C(-5.5, 5.5), face: 0.6, greet: ['Shards for what you need. Prices are fixed; the sea does not haggle either.'], quests: [] },
  ];
  const reward = (s: number, more: { boon?: boolean; relic?: boolean } = {}) => ({ shards: shard(s), ...more });
  const quests: QuestDef[] = [
    {
      id: 'main', name: pick(['The Harbour Key', 'The Captain’s Key', 'The Sea Gate Key']), giver: 'keeper', main: true,
      intro: [`Four things. Clear ${lower(A.name)}, where they gather. Light ${lower(Cl.name)} and ${lower(E.name)}, so the boats know the harbour lives. Last, the key lies in ${lower(D.name)}, and the Mate guards it: clear them, then bring the key to the winch by the camp.`],
      steps: [
        { verb: 'fell', text: `Clear ${lower(A.name)}`, packs: ['a'] },
        { verb: 'light', text: `Light ${lower(Cl.name)} and ${lower(E.name)}`, things: [{ id: 'light1', at: Cl.stand }, { id: 'light2', at: E.stand }], seconds: 2 },
        // The key's guard first: a pack that loses the hero walks home and heals, so carrying the key past an awake Mate (a hit drops it)
        // was a loop of fetching it again (the route bot's falls on floors 2 and 9 of the first bake were all at the wreck).
        { verb: 'fell', text: `Clear ${lower(D.name)}`, packs: ['d'] },
        { verb: 'carry', text: `Bring the key from ${lower(D.name)} to the winch`, item: 'key', itemName: 'The key', toName: 'the winch', from: D.stand, to: winch, r: 2.2, opens: 'lair' },
      ] as Step[],
      outro: [`The chain falls. ${poss(rulerName)} door stands open, far in the north. Take your time, then go in.`],
      reward: reward(80, { boon: true }),
    },
    { id: 'bounty1', name: named1, giver: 'keeper', intro: [`${named1} walks the middle of the harbour. Fell it and the sea quietens a little.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named1)}`, pack: 'named1' }], outro: ['A relic from the deep. Keep it.'], reward: reward(40, { relic: true }) },
    { id: 'bounty2', name: named2, giver: 'keeper', intro: [`${named2} walks the land side. Nobody goes to ${lower(Vl.name)} while it does.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named2)}`, pack: 'named2' }], outro: ['The road is open again.'], reward: reward(35) },
    {
      id: 'g1', name: 'The Net Lines', giver: 'giver', intro: ['My boat lies on the shore. My lines are hauled from a spot in the north: hold the place while I do.'],
      steps: [
        { verb: 'reach', text: 'Find the boat on the shore', at: reach, r: 3 },
        { verb: 'hold', text: 'Hold the net spot while the lines come in', at: hold, r: 3.6, seconds: 18 + Math.round(4 * k), waves: { kinds: ['docker', 'docker', 'docker'], every: 9 } },
      ] as Step[],
      outro: ['The lines are in. Take this, from the sea’s own pockets.'], reward: reward(35, { boon: true }),
    },
    { id: 'g2', name: `Bring ${leadNpc} Home`, giver: 'giver', intro: [`${leadNpc} hides in ${lower(B.name)} and will not come out alone. Walk them back to the camp; stand close and they follow the road.`],
      steps: [{ verb: 'lead', text: `Lead ${leadNpc} from ${lower(B.name)} to the camp`, name: leadNpc, from: leadFrom, r: 2.5, path: leadPath } as Step], outro: [`${leadNpc} is home, and pays in what they have.`], reward: reward(45) },
    { id: 'g3', name: 'A Jar of Oil', giver: 'villager', intro: ['A jar of good lamp oil, for the camp. Carry it there before the tide finds it.'],
      steps: [{ verb: 'carry', text: 'Bring the jar to the camp', item: 'jar', itemName: 'A jar of oil', toName: 'the camp', from: jarFrom, to: jarTo, r: 2.2, look: 'jar' } as Step], outro: ['Good oil, and dry. Take this.'], reward: reward(40) },
  ];
  const doors: (Omit<DoorDef, 'at'> & { at: V })[] = [
    { id: 'lair', piece: 'ruler', name: crown ? 'The Sun Court' : `${poss(rulerName)} lair`, at: lairDoor, r: 2.2, wall: { ax: -3.4, az: lairZ, bx: 3.4, bz: lairZ, r: 0.5, height: 3.6 }, locked: `A chain holds the lair shut. ${keeperHero} has a quest about a key.` },
    { id: 'trial', piece: 'trial', name: pick(['The Flooded Vault', 'The Salt Cellar', 'The Drowned Chapel']), at: trial, r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: gate, r: 2.2, needs: { won: 'ruler' }, locked: `The gate is sealed. Its warden answers only once ${mid(rulerName)} has fallen.` },
    { id: 'rival', piece: 'rival', name: `${poss(rivalHero)} arch`, at: rivalDoor, r: 2, locked: '' },
  ];
  const cacheDefs = caches.map((c, i) => ({ id: `c${i + 1}`, at: c, shards: shard([25, 30, 20, 30, 25, 20][i]), ...(i === 2 || i === 5 ? { boon: true } : {}) }));
  const stoneDefs = stones.map((s, i) => ({ id: `w${i + 1}`, name: `The ${stoneNear[i].name.replace(/^The /, '').toLowerCase()} stone`, at: s }));
  const loreText = LORE[fi % LORE.length];

  // A few of the harbour file's props by the places (looks only: barrels, chests, mooring posts, cannons, boats).
  const props: { i: number; dx: number; dz: number; yaw: number }[] = [];
  for (const [p, kinds] of [[A, [0, 1, 2]], [D, [3, 4, 7]], [Cl, [5, 6]], [E, [3, 8]], [B, [0, 8]], [Vl, [1, 2]]] as [Place, number[]][]) {
    for (const i of kinds) {
      try { const s = L.spot(p.c, p.r + 3, 1.2, (q) => dist(q, p.c) > p.r - 1); props.push({ i, dx: s.x, dz: s.z, yaw: r2(range(0, 6.28)) }); } catch { /* no room: none */ }
    }
  }

  // --- into the world: mirrored if the sea is west, moved to the ring's middle -----------------------------------------------------
  const W = worldOf(m), X = W.X;
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
  const look = {
    rim: m === 1 ? rim : mirrorRim(rim),
    places: [camp, ...places].map((p) => ({ id: p.id, kind: p.id === 'camp' ? 'camp' : p.kind, ...X(p.c), r: p.r })),
    paths: roads.map((r) => r.map(W.off)),
    pieces: L.cover.map(W.piece),
    flats: flats.map((f) => ({ ...X(f), rx: f.rx, rz: f.rz, rot: r2(m * (f.rot ?? 0)) })),
    mirror: m, seed: n * 101,
    caves: { dx: r2(m * B.c.x), dz: r2(B.c.z) },
    props: props.map((p) => ({ i: p.i, dx: r2(m * p.dx), dz: p.dz, yaw: r2(m * p.yaw) })),
    ...(hasRuin ? { ruin: { dx: r2(m * ruin.x), dz: r2(ruin.z) } } : {}),
  } satisfies SeaLook;
  return {
    n, chapter: 'sea', seed, look, pieces,
    floor: {
      n, id: `sea-${nn}`, name: crown ? 'The Crown of the Sea' : FLOOR_NAMES[fi % FLOOR_NAMES.length], blurb: crown ? 'Where the sea ends, a court of the sun keeps the way up.' : BLURBS[fi % BLURBS.length],
      tunedAs: r2(1 + (n - 1) / 9), ring: Math.ceil(Math.max(...rim) + 1.5), start: X(C(0, 5.5)), camp: X(C(0, 2)), places: placeDefs, par: Math.round((780 + 20 * (n - 1)) * 2.2),
      shop: { heal: 30 + 2 * (n - 1), boon: 55 + 3 * (n - 1), life: 80 + 4 * (n - 1), hint: 15 },
      law: {
        kind: 'tide', name: 'The tide', blurb: `Every ${80 - (n - 1)} seconds the sea comes in for ${15 + Math.round(k * 2)}: the tidal flats flood, slow and hurt. The higher ground stays dry.`,
        every: 80 - (n - 1), lasts: 15 + Math.round(k * 2), warn: 7, burn: r4(0.02 * (1 + 0.02 * (n - 1))), slow: 0.6, low: look.flats,
      },
      enemies, packs: packs.map((p) => ({ ...p, at: X(p.at), ...(p.named ? { named: { ...p.named, patrol: p.named.patrol.map(X) } } : {}) })),
      people: people.map((p) => ({ ...p, at: X(p.at), face: W.yaw(p.face) })),
      quests: quests.map((q) => ({ ...q, steps: q.steps.map(mapStep) })),
      caches: cacheDefs.map((c): CacheDef => ({ ...c, at: X(c.at) })),
      waystones: stoneDefs.map((w): WaystoneDef => ({ ...w, at: X(w.at) })),
      lore: { id: 'lore', name: 'The tide stone', at: X(lore), text: [...loreText] },
      doors: doors.map((d) => ({ ...d, at: X(d.at), ...(d.wall ? { wall: { ...d.wall, ax: r2(RING_X + m * d.wall.ax), az: r2(RING_Z + d.wall.az), bx: r2(RING_X + m * d.wall.bx), bz: r2(RING_Z + d.wall.bz) } } : {}) })),
      rival: { hero: rivalHero, goal: 'the arch', mode: 'duel', at: X(rivalAt), boon: true, lines: [`Another climber. I am ${rivalHero}. Walk through the arch behind me and we see who is better. Win, and I fight beside you.`] },
    },
  };
}
