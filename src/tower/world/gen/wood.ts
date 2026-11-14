import type { CacheDef, DoorDef, EnemySpec, PackDef, PersonDef, PlaceDef, QuestDef, Step, WaystoneDef } from '../def';
import type { MoveSpec, PiecesDef, RulerDef } from '../pieces/types';
import type { Look, Piece } from '../zone';
import type { ChapterLook, GenFloor } from './types';
import { Layout, add, dist, inside, makeOutline, mirrorRim, mulberry, polar, r2, rimToward, shuffle, toMid, unit, worldOf, type V } from './core.ts';

/**
 * The Wood chapter's generator (pipeline/designs/tower-50.md): floor `n` (12 to 20) of the Wood, made from floor 11's parts (The Walking
 * Wood: its look, enemies, the `paths` law, its kinds of quest, the Elder Root's moves and room, the glade as the gatekeepers' arena) on a
 * zone five times floor 11's ground, of a wavy outline (the user, 2026-11-14: "lets make those maps 5 x larger", "it doesnt need to have
 * circular shape it can be whatever"). Also lays out floor 11 itself at the new size (`makeWoodEleven`, baked by
 * pipeline/tools/gen-wood11.ts): the same places, people, quests, ruler, gatekeeper, rival and law. Run under `node`; the game never runs it.
 *
 * The wood at five times the ground is GLADES, not corridors: the floor is cut into cells round its places (the cells of the nearest place,
 * a Voronoi diagram), and every border between two cells is a band of trees (one long capsule of cover a piece, drawn as trees: a few
 * hundred pieces in all, where floor 11's way of filling everything but the corridors with masses would have been thousands, and the
 * navigator's cost grows with them). A border has a gap, a PASS, where the two places are joined; the paths law closes some passes with a
 * wall of roots. The passes of a tree joining every cell never close (the camp to the lair, the escorts' and the patrols' ways); the
 * others are shortcuts, half shut at a time. Inside a cell: the place in its middle and open forest floor with groves, single trees,
 * rocks, thorn bushes and logs.
 *
 * Laid out in one frame (the camera looks north: the camp in the south, the lair against the north edge) and mirrored east to west on
 * odd floors.
 */

/** Gatekeepers and rivals are duels against a hero, by design; people stand as heroes until they get models of their own. */
const ROSTER = ['Ada', 'Anka', 'Auriel', 'Bo', 'Bram', 'Brannoc', 'Cantor', 'Fenna', 'Gus', 'Hank', 'Isolde', 'Kaia', 'Lyra', 'Mabel', 'Marin', 'Mortis', 'Mum', 'Nyx', 'Oblivion', 'Opaline', 'Pip', 'Sefu', 'Shiori', 'Silvane', 'Sirix', 'Tempo', 'Vesper', 'Vitriol', 'Wick', 'Zephyr'];
const RULER_BODIES = ['Hank', 'Brannoc', 'Sirix', 'Mortis', 'Bram', 'Oblivion', 'Cantor', 'Isolde', 'Vesper', 'Marin'];
const HANDMADE_GATES = ['Marin', 'Fenna', 'Sefu', 'Opaline', 'Oblivion'];

const FLOOR_NAMES = ['The Mossway', 'Hollowmere', 'The Thornfold', 'The Antler Glades', 'Lanternroot', 'The Whispering Stand', 'Greyoak Deep', 'The Briar Gate'];
const BLURBS = ['A road of moss the wood keeps moving.', 'A mere in a hollow that the trees lean over.', 'Thorns folded round a wood that fold again.', 'Glades where the stags wear crowns.', 'Roots that glow like lanterns underfoot.', 'A stand of trees that talk when the wind stops.', 'Old grey oaks and the dark between them.', 'A wall of briars with one gate, and it moves.'];
const RULERS: [string, string][] = [['The Moss Warden', 'Green over everything'], ['The Thorn Mother', 'She grows the walls'], ['The Antler King', 'Crowned in branches'], ['The Hollow Elder', 'Older than the paths'], ['The Briar Witch', 'Every thorn a word'], ['The Lantern Root', 'It drinks the light'], ['The Grey Oak', 'Bark like a shield'], ['The Mire Heart', 'It beats under the moss']];
const TINTS = ['#4f8a3a', '#5a7a3a', '#3f7a4a', '#6a8a3a', '#4a6a2f', '#5f8f4a', '#3a6a3f', '#6a7a3a'];
const NAMED = ['The Bark Widow', 'Old Rootfoot', 'The Pale Stag', 'Mossjaw', 'The Lantern Thief', 'Grandmother Thorn', 'The Hollow Hunter', 'Briarback', 'The Grey Walker', 'Ashbark', 'The Wet Antler'];
const NPCS = ['Rowan', 'Hazel', 'Bram the younger', 'Ivy', 'Alder', 'Linden', 'Sorrel', 'Fern'];
const LORE: [string, string][] = [
  ['The wood was a field once. It walked away from the plough and has been walking since.', 'What you take for paths are roots, and what you take for roots are paths.'],
  ['The charcoal burners left their fires burning.', 'The wood grew round the fires and kept them.'],
  ['Every tree here was planted by someone who meant to come back.', 'The trees remember. The planters do not.'],
  ['Moss grows on the north side, they say.', 'Here it grows on the side you are not looking at.'],
  ['The stags were kings once. They still wear the crowns.', 'The wood still bows to them, a little.'],
  ['A road ran through here to the sea.', 'The wood took it a mile a year.'],
  ['The lanterns were hung for travellers.', 'The roots drink their light now.'],
  ['A climber passed here before you.', 'The wood moved the path behind them, and they never found it again.'],
  ['The oldest oak is hollow.', 'Something lives in it that is older still.'],
];

/** What each piece of a wood zone is drawn as (the cover's `look` is the sea's word for it; this is the wood's own, in `WoodLook.kinds`). */
export type WoodKind =
  | 'band' | 'grove' | 'tree' | 'rock' | 'thorn' | 'log' | 'stump' | 'menhir' | 'twist' | 'fire' | 'tent' | 'crate' | 'hut' | 'mound' | 'shrine' | 'post'
  | 'hollow' | 'lair' | 'roots' | 'edge';
const LOOK_OF: Record<WoodKind, Look> = {
  band: 'rock', grove: 'rock', tree: 'post', rock: 'rock', thorn: 'rock', log: 'stall', stump: 'barrel', menhir: 'post', twist: 'post', fire: 'fire', tent: 'tent',
  crate: 'crate', hut: 'house', mound: 'rock', shrine: 'house', post: 'post', hollow: 'rock', lair: 'house', roots: 'rock', edge: 'edge',
};
/** What a place is, which says how its ground and its pieces are drawn. */
export type WoodPlaceKind = 'camp' | 'heart' | 'den' | 'bramble' | 'thicket' | 'stones' | 'giants' | 'spring' | 'burners' | 'shrine' | 'hollow' | 'lamps';

/**
 * What a wood zone is drawn from (woodZone.ts): the outline, the cover (its pieces' `kinds` say what each is), the places (world), the
 * trails (offsets), the passes (world; `set` for one that the roots close), where the Elder tree stands beyond the lair (world), the mirror
 * and the land's seed.
 */
export interface WoodLook extends ChapterLook {
  rim: number[];
  pieces: Piece[];
  kinds: WoodKind[];
  places: { id: string; kind: WoodPlaceKind; x: number; z: number; r: number }[];
  paths: [number, number][][];
  passes: { x: number; z: number; dx: number; dz: number; w: number; set?: 0 | 1 }[];
  elder: { x: number; z: number };
  mirror: 1 | -1;
  seed: number;
}

/** Five times floor 11's walkable ground (a circle of 48 m: 7238 m2). */
const AREA = 5 * Math.PI * 48 * 48;
/** A band of trees: its cover's half-width (m). */
const BAND_R = 1.7;

interface Place { id: string; kind: WoodPlaceKind; name: string; c: V; r: number; stand: V }
interface Slot { id: string; kind: WoodPlaceKind; name: string; deg: [number, number]; f: [number, number]; r?: number; pack?: boolean }
interface Pass { i: number; j: number; p: V; dir: V; half: number; set?: 0 | 1; open: boolean; name: string; ends: [V, V] }

/** A layout of glades: the outline, the places on it, the bands between them and the passes; built the same for made and handmade floors. */
function layoutWood(n: number, rnd: () => number, slots: Slot[], o: { closable: number; packIds: string[]; shortName: (p: Place) => string }) {
  const rim = makeOutline(rnd, { area: AREA, min: 74, max: 138 });
  const L = new Layout(rim, rnd, n);
  const kinds: WoodKind[] = [];
  const pill = (k: WoodKind, c: V, r: number, h: number) => { L.pill(LOOK_OF[k], c, r, h); kinds.push(k); };
  const wall = (k: WoodKind, a: V, b: V, r: number, h: number) => { L.wall(LOOK_OF[k], a, b, r, h); kinds.push(k); };
  const range = (a: number, b: number) => L.range(a, b);
  const at = (deg: number, f: number) => polar(deg, rimToward(rim, deg) * f);

  // --- the camp in the south, the lair against the north edge, the outline's walls ------------------------------------------------
  const southR = rimToward(rim, 180), northR = rimToward(rim, 0);
  const camp: Place = { id: 'camp', kind: 'camp', name: 'The camp', c: { x: 0, z: r2(southR - 16) }, r: 8, stand: { x: 0, z: r2(southR - 12.5) } };
  const cz = camp.c.z, C = (dx: number, dz: number): V => ({ x: dx, z: r2(cz + dz) });
  // The outline's invisible walls, one between every second sample (half the pieces of `Layout.edges`: the cover is scanned by every
  // walker every frame); a chord of 2 samples cuts under 1 m inside the wavy outline, so they stand a little further out.
  {
    const nR = rim.length, pad = 1.6, r = 0.6;
    const pt = (i: number) => { const a = (i / nR) * Math.PI * 2, rr = rim[i % nR] + pad + r; return { x: Math.cos(a) * rr, z: Math.sin(a) * rr }; };
    for (let i = 0; i < nR; i += 2) {
      const a = pt(i), b = pt(i + 2);
      L.cover.push({ look: 'edge', o: { ax: r2(a.x), az: r2(a.z), bx: r2(b.x), bz: r2(b.z), r, height: 3, kind: 'wall', fixed: true } });
      kinds.push('edge');
    }
  }
  pill('fire', C(0, -0.5), 0.9, 0.9); pill('tent', C(-8.5, 2.5), 1.7, 2.6); pill('tent', C(8.5, -1.5), 1.7, 2.6);
  pill('crate', C(-5, -4), 0.8, 1.2); pill('crate', C(5.4, 2.2), 0.8, 1.2); wall('log', C(4.2, 6.6), C(7, 5.6), 0.4, 1);
  L.reserve(camp.c, 11);
  // The lair: a wall of roots near the north edge with the door in its doorway (roots fill the doorway until the quest opens it); the Elder
  // tree stands past the edge behind it. No walled yard: ground a walker cannot reach makes the navigator search the whole map for it
  // (1.4 s for one order to the door of a closed yard, measured on floor 12), so the door stands in the wall's own line.
  const lairZ = r2(-northR + 9), lairDoor: V = { x: 0, z: lairZ };
  wall('lair', { x: -24, z: lairZ + 1.5 }, { x: -3.4, z: lairZ }, 0.6, 3.8); wall('lair', { x: 3.4, z: lairZ }, { x: 24, z: lairZ + 1.5 }, 0.6, 3.8);
  // Behind the wall, to the edge, the Elder's roots: no free ground there either.
  for (let x = -30; x <= 30; x += 5) {
    let zE = lairZ - 1;
    while (zE > lairZ - 40 && inside(rim, { x, z: zE }) > -2.6) zE -= 0.5;
    const r = r2((lairZ - 0.4 - zE) / 2 + 1), c = { x, z: r2(zE + r - 1) };
    if (r > 0.8) pill('roots', c, r, 1.6);
  }
  L.reserve({ x: 0, z: lairZ + 3 }, 6);
  const heart: Place = { id: 'heart', kind: 'heart', name: 'The heart', c: { x: 0, z: r2(lairZ + 19) }, r: 10, stand: { x: 0, z: r2(lairZ + 11) } };

  // --- the places, each the middle of its glade ----------------------------------------------------------------------------------
  const places: Place[] = [];
  for (const s of slots) {
    let c: V | null = null;
    for (let i = 0; i < 500; i++) {
      const p = at(range(...s.deg), range(...s.f));
      const both = (q: Place) => o.packIds.includes(q.id) && !!s.pack;
      if (places.some((q) => dist(q.c, p) < (both(q) ? 44 : 32))) continue;
      if (dist(p, camp.c) < 36 || dist(p, heart.c) < 36 || inside(rim, p) < 18) continue;
      c = p;
      break;
    }
    if (!c) throw new Error(`floor ${n}: no room for ${s.id}`);
    const cc = { x: r2(c.x), z: r2(c.z) }, back = s.kind === 'den' ? 3 : s.kind === 'hollow' ? 5.5 : s.kind === 'shrine' ? 3 : 0;
    const st = add(cc, toMid(cc), back);
    places.push({ id: s.id, kind: s.kind, name: s.name, c: cc, r: s.r ?? 9, stand: { x: r2(st.x), z: r2(st.z) } });
  }
  const cells = [camp, heart, ...places];
  const seeds = cells.map((p) => p.c);

  // --- the bands of trees: every border between two cells, inside the outline (and a little past it, into the edge's walls) -----------
  interface Edge { i: number; j: number; mid: V; d: V; t0: number; t1: number }
  const edges: Edge[] = [];
  for (let i = 0; i < seeds.length; i++) for (let j = i + 1; j < seeds.length; j++) {
    const a = seeds[i], b = seeds[j], mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, d = unit({ x: -(b.z - a.z), z: b.x - a.x });
    let cur: { t0: number; t1: number } | null = null;
    const runs: { t0: number; t1: number }[] = [];
    for (let t = -280; t <= 280; t += 0.5) {
      const p = add(mid, d, t), di = dist(p, a);
      let ok = inside(rim, p) > -3;
      for (let k = 0; ok && k < seeds.length; k++) if (k !== i && k !== j && dist(p, seeds[k]) < di - 1e-6) ok = false;
      if (ok) { if (!cur) cur = { t0: t, t1: t }; else cur.t1 = t; } else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    for (const r of runs) if (r.t1 - r.t0 > 1.5) edges.push({ i, j, mid, d, ...r });
  }

  // --- the passes: a tree of them that never closes, then shortcuts that the roots close, half at a time ---------------------------
  const gapOf = (open: boolean) => (open ? 6.5 : 5.2); // half the gap between the bands' ends (the walkable opening is this less BAND_R, twice)
  const passAt = (e: Edge, half: number) => {
    const lo = e.t0 + half + 4, hi = e.t1 - half - 4;
    if (hi < lo) return null;
    // where the straight way between the two places crosses the border (t = 0), kept off the band's ends and well inside the outline
    let best: number | null = null;
    for (let t = lo; t <= hi; t += 0.5) {
      const p = add(e.mid, e.d, t);
      if (inside(rim, p) < 9) continue;
      if (best === null || Math.abs(t) < Math.abs(best)) best = t;
    }
    return best;
  };
  const cand = edges.map((e, k) => ({ e, k, w: dist(seeds[e.i], seeds[e.j]) * (0.85 + 0.3 * rnd()) })).filter((c) => passAt(c.e, gapOf(true)) !== null);
  // Kruskal: the always-open tree.
  const root = seeds.map((_, i) => i), find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  const tree: typeof cand = [], rest: typeof cand = [];
  for (const c of cand.slice().sort((a, b) => a.w - b.w)) {
    const a = find(c.e.i), b = find(c.e.j);
    if (a !== b) { root[a] = b; tree.push(c); } else rest.push(c);
  }
  if (tree.length !== seeds.length - 1) throw new Error(`floor ${n}: the glades cannot all be joined`);
  // The shortcuts: their walls of roots kept a leash (24 m) from the packs' homes, so a rising wall does not cut a fight in two.
  const packHomes = places.filter((p) => o.packIds.includes(p.id)).map((p) => p.c);
  const closable = rest.filter((c) => {
    const t = passAt(c.e, gapOf(false));
    if (t === null) return false;
    const p = add(c.e.mid, c.e.d, t);
    return packHomes.every((h) => dist(h, p) >= 24) && dist(p, heart.c) >= 20 && dist(p, camp.c) >= 18;
  });
  if (closable.length < 2 * o.closable) throw new Error(`floor ${n}: only ${closable.length} shortcuts for ${2 * o.closable} walls of roots`);
  const shut = shuffle(closable, rnd).slice(0, 2 * o.closable);
  const passes: Pass[] = [];
  const used = new Set<string>();
  const mkPass = (c: (typeof cand)[number], set?: 0 | 1) => {
    const open = set === undefined, half = gapOf(open), t = passAt(c.e, half)!;
    const p = add(c.e.mid, c.e.d, t);
    const end = (s: number): V => ({ x: r2(p.x + c.e.d.x * s * (half + BAND_R)), z: r2(p.z + c.e.d.z * s * (half + BAND_R)) });
    passes.push({ i: c.e.i, j: c.e.j, p: { x: r2(p.x), z: r2(p.z) }, dir: c.e.d, half, set, open, name: '', ends: [end(-1), end(1)] });
    used.add(`${c.e.i}:${c.e.j}`);
    return t;
  };
  const passT = new Map<number, number>();
  for (const c of tree) passT.set(c.k, mkPass(c));
  shut.forEach((c, k) => passT.set(c.k, mkPass(c, (k % 2) as 0 | 1)));
  // names of the ways the roots close: by the place further from the camp, then the nearer
  const named = new Set<string>();
  for (const ps of passes.filter((x) => !x.open)) {
    const a = cells[ps.i], b = cells[ps.j], far = dist(a.c, camp.c) > dist(b.c, camp.c) ? a : b, near = far === a ? b : a;
    let nm = `the ${o.shortName(far)} road`;
    if (named.has(nm)) nm = `the ${o.shortName(near)} road`;
    if (named.has(nm)) nm = `the ${o.shortName(far)} path`;
    named.add(nm);
    ps.name = nm;
  }

  // Each border as a band: from one end to the other, broken at its pass, bent a little in the middle of each long run.
  for (const e of edges) {
    const t = passT.get(edges.indexOf(e));
    const ps = t === undefined ? null : passes.find((x) => x.i === e.i && x.j === e.j)!;
    const runs: [number, number][] = ps && t !== undefined ? [[e.t0, t - ps.half - BAND_R], [t + ps.half + BAND_R, e.t1]] : [[e.t0, e.t1]];
    for (const [a, b] of runs) {
      if (b - a < 0.5) continue;
      const k = Math.max(1, Math.ceil((b - a) / 28)), pts: V[] = [];
      for (let s = 0; s <= k; s++) {
        const tt = a + ((b - a) * s) / k, bend = s === 0 || s === k ? 0 : range(-2, 2);
        pts.push(add(add(e.mid, e.d, tt), { x: -e.d.z, z: e.d.x }, bend));
      }
      for (let s = 1; s < pts.length; s++) wall('band', pts[s - 1], pts[s], BAND_R, 9);
    }
  }
  // The pass's ground stays open, and the roads through it: stand to pass to stand.
  const roads: V[][] = [];
  for (const ps of passes) {
    L.reserve(ps.p, ps.half + 1.5);
    for (const c of [cells[ps.i], cells[ps.j]]) {
      const pts = [c.stand, ps.p];
      const bendAt = { x: (c.stand.x + ps.p.x) / 2, z: (c.stand.z + ps.p.z) / 2 }, nrm = unit({ x: -(ps.p.z - c.stand.z), z: ps.p.x - c.stand.x }), mid = add(bendAt, nrm, range(-3, 3));
      if (!L.hitsCover(mid, 2)) pts.splice(1, 0, { x: r2(mid.x), z: r2(mid.z) });
      for (let s = 1; s < pts.length; s++) L.lane(pts[s - 1], pts[s], 2.4);
      roads.push(c === cells[ps.i] ? pts : pts.slice().reverse());
    }
  }
  return { rim, L, kinds, pill, wall, range, at, camp, heart, places, cells, passes, roads, C, lairZ, lairDoor, northR };
}

/** The shortest walk through passes that never close, from cell `a` to cell `b`, cells in `avoid` costing more: its pass points. */
function passRoute(cells: Place[], passes: Pass[], a: number, b: number, avoid: number[] = []) {
  const n = cells.length, d = new Array(n).fill(Infinity), prev: (Pass | null)[] = new Array(n).fill(null), done = new Array(n).fill(false);
  d[a] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0 || u === b) break;
    done[u] = true;
    for (const ps of passes) {
      if (!ps.open || (ps.i !== u && ps.j !== u)) continue;
      const v = ps.i === u ? ps.j : ps.i, w = dist(cells[u].c, ps.p) + dist(ps.p, cells[v].c) + (avoid.includes(v) && v !== b ? 300 : 0);
      if (d[u] + w < d[v]) { d[v] = d[u] + w; prev[v] = ps; }
    }
  }
  const out: V[] = [];
  for (let v = b; v !== a; ) {
    const ps = prev[v];
    if (!ps) throw new Error('no way between two glades');
    out.unshift(ps.p);
    v = ps.i === v ? ps.j : ps.i;
  }
  return out;
}

/** A spot's straight walk to another stays off the cover (sampled every metre). */
const clearWalk = (L: Layout, a: V, b: V, rad: number) => {
  const l = dist(a, b);
  for (let s = 0; s <= l; s += 1) if (L.hitsCover({ x: a.x + ((b.x - a.x) * s) / l, z: a.z + ((b.z - a.z) * s) / l }, rad)) return false;
  return true;
};

type Lay = ReturnType<typeof layoutWood>;

/** Each place's own pieces round its middle; then the camp's road and the open forest floor's cover. */
function dressPlaces(G: Lay) {
  const { L, pill, wall } = G;
  for (const p of G.places.concat(G.heart)) {
    const out = unit(p.c), tan = { x: -out.z, z: out.x };
    const Q = (dOut: number, dTan: number): V => add(add(p.c, out, dOut), tan, dTan);
    const ring = (k: number, rr: number, from = 0, to = 360) => Array.from({ length: k }, (_, i) => {
      const a = ((from + ((to - from) * (i + 0.5)) / k) * Math.PI) / 180;
      return add(p.c, { x: Math.cos(a), z: Math.sin(a) }, rr);
    });
    switch (p.kind) {
      case 'den': // a horseshoe of mossy rock open to the middle, the hounds' bones and a fallen log
        for (const deg of [-70, -35, 0, 35, 70]) { const a = (deg * Math.PI) / 180; pill('rock', add(add(p.c, out, Math.cos(a) * 7.4), tan, Math.sin(a) * 7.4), 1.9, 4.2); }
        wall('log', Q(-3, -6.5), Q(-5.5, -3.5), 0.5, 1.1);
        break;
      case 'bramble':
        for (const q of ring(5, 7.2)) pill('thorn', q, 1.2, 1.6);
        break;
      case 'thicket':
        for (const q of ring(5, 7.5, 20, 340)) pill('twist', q, 0.9, 3.8);
        break;
      case 'stones':
        for (const q of ring(5, 6.6)) pill('menhir', q, 0.75, 2.6);
        break;
      case 'giants':
        for (const q of ring(5, 8)) pill('menhir', q, 0.9, 3.4);
        break;
      case 'spring': // a pool (drawn, walkable at its edge) with stones round it
        for (const q of ring(5, 5.2, 200, 520)) pill('rock', q, 0.9, 1.1);
        break;
      case 'burners': // the charcoal burners' huts either side of their mound, wood stacked
        pill('mound', p.c, 2.2, 1.8);
        for (const s of [-1, 1]) wall('hut', Q(4.5, s * 5.5 - 1.6), Q(4.5, s * 5.5 + 1.6), 1.5, 3.2);
        wall('log', Q(-4.5, -4), Q(-4.5, -1.2), 0.5, 1.2); wall('log', Q(-4, 2.4), Q(-6, 4.4), 0.5, 1.2);
        break;
      case 'shrine': // three walls of a small shrine, open to the middle, and two lantern posts
        wall('shrine', Q(4, -3), Q(4, 3), 0.45, 3.6); wall('shrine', Q(4, -3), Q(0, -3), 0.45, 3.6); wall('shrine', Q(4, 3), Q(0, 3), 0.45, 3.6);
        pill('post', Q(-2.5, -4.2), 0.35, 3); pill('post', Q(-2.5, 4.2), 0.35, 3);
        break;
      case 'hollow': // the hollow oak, too wide to see round, its roots on the ground
        pill('hollow', Q(2, 0), 3.4, 14);
        wall('log', Q(-1, 4.2), Q(-4.2, 6.6), 0.45, 0.9); wall('log', Q(-1, -4.2), Q(-4.2, -6.6), 0.45, 0.9);
        break;
      case 'lamps':
        pill('post', Q(2.5, 2), 0.35, 3); pill('stump', Q(-3, -3), 0.6, 0.7); pill('rock', Q(3.5, -4.5), 1, 1.3);
        break;
      case 'heart': // roots that arch over the clearing's edge
        for (const q of ring(4, 10.5, 200, 340)) pill('twist', q, 0.9, 4);
        break;
    }
    L.reserve(p.c, p.r + 1.5);
    L.reserve(p.stand, 3);
  }
}

/** The open forest floor: groves, single trees, rocks, thorns, logs and stumps in what is left, so a walk has to bend. */
function scatter(G: Lay, want: number, open: V[] = []) {
  const { L, pill, wall, range, rim } = G, rnd = L.rnd;
  for (let i = 0, made = 0; i < 12000 && made < want; i++) {
    const p = polar(range(-180, 180), Math.sqrt(rnd()) * 138), u = rnd();
    const k: WoodKind = u < 0.4 ? 'grove' : u < 0.6 ? 'tree' : u < 0.72 ? 'rock' : u < 0.84 ? 'thorn' : u < 0.93 ? 'log' : 'stump';
    const r = k === 'grove' ? range(2.6, 4.4) : k === 'tree' ? range(0.7, 1) : k === 'rock' ? range(1, 1.8) : k === 'thorn' ? range(0.9, 1.2) : k === 'stump' ? 0.6 : 0.45;
    // the packs fight in clear ground: cover between a unit and the hero sends it round by the navigator, which costs (pipeline/designs/tower-50.md)
    if (inside(rim, p) < 3 + r || L.inKeep(p, r + 0.4) || L.hitsCover(p, r + 3.2) || open.some((q) => dist(q, p) < 18 + r)) continue;
    if (k === 'log') {
      const a = rnd() * 6.28, h = range(1.6, 2.4), q = { x: p.x + Math.cos(a) * h, z: p.z + Math.sin(a) * h };
      if (L.hitsCover(q, r + 3.2) || L.inKeep(q, r + 0.4) || inside(rim, q) < 4) continue;
      wall('log', { x: p.x - Math.cos(a) * h, z: p.z - Math.sin(a) * h }, q, 0.45, 1.1);
    } else pill(k, p, r, k === 'grove' ? range(7, 10) : k === 'tree' ? range(8, 12) : k === 'rock' ? r * range(1.1, 1.5) : k === 'thorn' ? 1.5 : 0.7);
    made++;
  }
}

// --- the made floors ------------------------------------------------------------------------------------------------------------

export interface WoodGenOptions { n: number; attempt?: number }

export function makeWoodFloor(o: WoodGenOptions): GenFloor {
  const n = o.n, seed = n * 1000 + 7 + (o.attempt ?? 0), rnd = mulberry(seed);
  const m: 1 | -1 = n % 2 === 0 ? 1 : -1;
  const k = (n - 11) / 9; // 0 at floor 11, 1 at floor 20
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

  // --- who is where: gatekeepers all different over the chapter (none a handmade floor's), people five at a time round the rest ------
  const order = shuffle(ROSTER.filter((h) => !HANDMADE_GATES.includes(h)), mulberry(2002));
  const gates = order.slice(0, 9), folk = [...order.slice(9), ...HANDMADE_GATES];
  const who = (i: number) => folk[((n - 12) * 5 + i) % folk.length];
  const keeperHero = who(0), giverHero = who(1), traderHero = who(2), rivalHero = who(3), villagerHero = who(4), gateHero = gates[(n - 12) % gates.length];
  const turn = (n - 12) % RULER_BODIES.length, round = [...RULER_BODIES.slice(turn), ...RULER_BODIES.slice(0, turn)];
  const rulerBody = round.find((b) => ![keeperHero, giverHero, traderHero, rivalHero, villagerHero, gateHero].includes(b)) ?? 'Hank';

  const kindA = pick(['den', 'bramble'] as const), kindB = kindA === 'den' ? 'thicket' : pick(['den', 'thicket'] as const);
  const kindC = pick(['shrine', 'spring'] as const), kindE = kindC === 'shrine' ? 'spring' : 'shrine';
  const kindF = pick(['stones', 'giants'] as const), kindD = kindF === 'stones' ? 'giants' : 'stones';
  const PN: Record<WoodPlaceKind, string[]> = {
    camp: ['The camp'], heart: ['The heart'], den: ['The hounds’ den', 'The bark den'], bramble: ['The bramble', 'The thorn brake'], thicket: ['The thicket', 'The dark thicket'],
    stones: ['The old stones', 'The standing stones'], giants: ['The giants’ glade', 'The stag glade'], spring: ['The spring', 'The mossy spring'], burners: ['The burners’ clearing', 'The charcoal clearing'],
    shrine: ['The wayside shrine', 'The lantern shrine'], hollow: ['The hollow oak', 'The old oak'], lamps: ['The lamp glade'],
  };
  const slots: Slot[] = [
    { id: 'a', kind: kindA, name: pick(PN[kindA]), deg: [-122, -100], f: [0.62, 0.74], pack: true }, // south-west: the main quest's first pack and wisp
    { id: 'v', kind: 'burners', name: pick(PN.burners), deg: [-84, -62], f: [0.66, 0.78], r: 10 }, // west: the burners (the villager)
    { id: 'b', kind: kindB, name: pick(PN[kindB]), deg: [-44, -24], f: [0.66, 0.78], pack: true }, // north-west
    { id: 'f', kind: kindF, name: pick(PN[kindF]), deg: [-25, 25], f: [0.22, 0.36], pack: true }, // the inner north
    { id: 'c', kind: kindC, name: pick(PN[kindC]), deg: [30, 52], f: [0.66, 0.78] }, // north-east: a lamp
    { id: 'e', kind: kindE, name: pick(PN[kindE]), deg: [78, 100], f: [0.64, 0.76] }, // east: the other lamp
    { id: 'd', kind: kindD, name: pick(PN[kindD]), deg: [112, 134], f: [0.6, 0.72], pack: true }, // south-east: the guard and the second wisp
    { id: 'h', kind: 'hollow', name: pick(PN.hollow), deg: [-170, 170], f: [0.3, 0.44] }, // the inner ring, anywhere free
  ];
  const short = (p: Place) => p.name.replace(/^The /, '').replace(/’s?$/, '').split(' ').slice(-1)[0].toLowerCase();
  const closable = n >= 16 ? 4 : 3;
  const G = layoutWood(n, rnd, slots, { closable, packIds: ['a', 'b', 'f', 'd'], shortName: short });
  const { L, heart, places, cells, passes, C, lairZ, lairDoor, range } = G;
  const at = G.at;
  const P = (id: string) => places.find((p) => p.id === id)!;
  const A = P('a'), Vl = P('v'), B = P('b'), Fp = P('f'), Cl = P('c'), E = P('e'), D = P('d'), H = P('h');
  const cellOf = (p: Place) => cells.indexOf(p);
  dressPlaces(G);

  // --- doors and the spots of the quests, the people, the secrets ----------------------------------------------------------------
  const packSpots = [A.c, B.c, Fp.c, D.c, heart.c];
  const far = (min: number) => (q: V) => packSpots.every((s) => dist(s, q) >= min);
  const gate = L.reserve(L.spot(C(pick([-16, 16]), 6), 2, 2.2), 3.5);
  const trial = L.reserve(L.spot(at(range(-150, -132), 0.84), 5, 2, far(22)), 3.5);
  const rivalDoor = L.reserve(L.spot(at(range(-60, -48), 0.86), 5, 2, far(20)), 3.5);
  const rivalAt = L.reserve(L.spot(add(rivalDoor, toMid(rivalDoor), 5), 1.5, 1.2), 2);
  const villagerAt = L.reserve(L.spot(add(Vl.stand, toMid(Vl.c), 6), 2, 1.2), 2);
  const reach = L.reserve(L.spot(add(Vl.c, unit(Vl.c), 18), 4, 2, far(24)), 3);
  const hold = L.reserve(L.spot(add(Vl.c, toMid(Vl.c), 15), 4, 4, far(26)), 5);
  const lore = L.reserve(L.spot(at(range(150, 165), 0.8), 4, 1.5), 2.5);
  const caches = [at(range(-170, -155), 0.84), at(range(-100, -88), 0.88), at(range(-20, -8), 0.86), at(range(14, 26), 0.86), at(range(64, 76), 0.6), at(range(140, 150), 0.86)]
    .map((p) => L.reserve(L.spot(p, 5, 1.5), 2.5));
  const stoneNear = [A, Vl, B, Cl, D, H];
  const stones = stoneNear.map((p) => L.reserve(L.spot(add(p.c, toMid(p.c), 16), 4, 1.5, far(14)), 2.5));

  // Two named enemies: one walks round the hollow oak's glade, one round a lamp's glade (no pack there). Their ways are kept clear.
  const patrolIn = (p: Place, r0: number, r1: number) => {
    for (let t = 0; t < 60; t++) {
      const base = range(0, 360), pts = [0, 90, 180, 270].map((a) => { try { return L.spot(add(p.c, polar(base + a + range(-15, 15), range(r0, r1)), 1), 3, 2, far(22)); } catch { return null; } });
      if (pts.some((q) => !q)) continue;
      const ps = pts as V[];
      if (ps.every((q, i) => clearWalk(L, q, ps[(i + 1) % 4], 1.2))) { for (let i = 0; i < 4; i++) L.lane(ps[i], ps[(i + 1) % 4], 1.8); return ps; }
    }
    throw new Error(`floor ${n}: no patrol round ${p.id}`);
  };
  const patrol1 = patrolIn(H, 12, 18);
  const patrol2 = patrolIn(rnd() < 0.5 ? Cl : E, 12, 17);

  // The wisps' roads: from the first pack's glade and from the guard's to the heart, through passes that never close.
  const wispA = L.reserve(L.spot(add(A.stand, toMid(A.c), 4), 2, 1.2), 2);
  const wispD = L.reserve(L.spot(add(D.stand, toMid(D.c), 4), 2, 1.2), 2);
  const hi = cellOf(heart);
  const roadA = [...passRoute(cells, passes, cellOf(A), hi, [cellOf(B), cellOf(Fp), cellOf(D)]), heart.stand];
  const roadD = [...passRoute(cells, passes, cellOf(D), hi, [cellOf(B), cellOf(Fp)]), heart.stand];
  const spadeFrom = L.reserve(L.spot(add(B.stand, toMid(B.c), 6), 2, 1.5), 2.5);
  const spadeTo = C(2, -2.8);
  // The heart's three feeding roots, round its clearing (off the way to the door).
  const roots = [add(heart.c, { x: -8, z: -2 }), add(heart.c, { x: 8, z: -2 }), add(heart.c, { x: 0, z: 7 })];
  for (const r of roots) L.reserve(r, 2);

  scatter(G, 44 + Math.round(8 * k), [A.c, B.c, Fp.c, D.c, heart.c]);

  // --- enemies (floor 11's: the game raises them by the floor's tuned number, `tunedAs` below), packs ---------------------------------
  const shard = (x: number) => Math.round(x * (1 + 0.05 * (n - 1)));
  const named1 = NAMED[(2 * (n - 12)) % NAMED.length], named2 = NAMED[(2 * (n - 12) + 1) % NAMED.length];
  const enemies: Record<string, EnemySpec> = {
    hound: { id: 'hound', name: 'Bark hound', blurb: 'Fast, and hunts in a pack.', look: 'hound', melee: true, hp: 55, share: 0.02, every: 1.2, speed: 4.6, scale: 1.2, shards: shard(4), color: '#e0a060' },
    sprite: { id: 'sprite', name: 'Thorn sprite', blurb: 'Floats back and throws thorns.', look: 'sprite', melee: false, hp: 40, share: 0.022, every: 2.2, speed: 2.6, range: 10, scale: 1.55, shards: shard(5), color: '#ff7aa8' },
    giant: { id: 'giant', name: 'Moss giant', blurb: 'Slow, heavy, hits hard.', look: 'giant', melee: true, hp: 230, share: 0.045, every: 2.6, speed: 1.7, scale: 1.7, shards: shard(8), color: '#9acd6a' },
    stag: { id: 'stag', name: 'The Stag-Crowned', blurb: `Guards ${D.name.toLowerCase()}.`, look: 'stag', melee: true, hp: 420, share: 0.055, every: 1.5, speed: 3.4, scale: 1.9, shards: shard(30), color: '#ffe08a' },
    named1: { id: 'named1', name: named1, blurb: 'Walks round the old oak and strikes hard.', look: 'oak', melee: true, hp: 620, share: 0.065, every: 2.2, speed: 2.0, scale: 2.4, shards: shard(40), color: '#e0c080' },
    named2: { id: 'named2', name: named2, blurb: 'Walks the far glades and strikes hard.', look: 'stag', melee: true, hp: 480, share: 0.058, every: 1.6, speed: 3.0, scale: 2.1, shards: shard(35), color: '#e8d090' },
    root: { id: 'root', name: 'Feeding root', blurb: 'A root that feeds the heart. It cannot move; it throws thorns.', look: 'root', melee: false, hp: 150, share: 0.03, every: 3, speed: 0, range: 11, scale: 1.6, shards: shard(10), color: '#c8f080' },
  };
  const mixOf = (kind: WoodPlaceKind): PackDef['mix'] =>
    kind === 'den' ? [{ kind: 'hound', n: 4 }] : kind === 'bramble' ? [{ kind: 'sprite', n: 3 }, ...(n >= 16 ? [{ kind: 'hound', n: 1 }] : [])]
      : kind === 'thicket' ? [{ kind: 'hound', n: 2 }, { kind: 'sprite', n: 2 }] : kind === 'stones' ? [{ kind: 'giant', n: 1 }, { kind: 'sprite', n: 2 }] : [{ kind: 'giant', n: 2 }];
  const packs: PackDef[] = [
    { id: 'a', at: A.c, leash: 24, mix: mixOf(A.kind) },
    { id: 'd', at: D.c, leash: 24, mix: [{ kind: 'giant', n: D.kind === 'giants' ? 2 : 1 }, ...(D.kind === 'stones' ? [{ kind: 'sprite', n: 1 }] : [])], elite: 'stag' },
    { id: 'b', at: B.c, leash: 24, mix: mixOf(B.kind) },
    { id: 'f', at: Fp.c, leash: 24, mix: Fp.kind === 'giants' ? [{ kind: 'giant', n: 1 }, { kind: 'hound', n: 2 }] : mixOf('stones') },
    { id: 'named1', at: patrol1[0], mix: [{ kind: 'named1', n: 1 }], named: { name: named1, speed: 1.6, patrol: patrol1, bounty: { shards: shard(40), relic: true } } },
    { id: 'named2', at: patrol2[0], mix: [{ kind: 'named2', n: 1 }], named: { name: named2, speed: 1.7, patrol: patrol2, bounty: { shards: shard(35), relic: false } } },
    ...roots.map((r, i) => ({ id: `root${i + 1}`, at: { x: r2(r.x), z: r2(r.z) }, mix: [{ kind: 'root', n: 1 }] })),
  ];

  // --- the set pieces: the ruler (the Elder Root's moves, another body and name), the gate, the trial, the rival ---------------------
  // Floor 20 is the chapter's crown: behind the lair are Ash and Ember, a Raid boss, alone (pieces/core.ts `crownFight`).
  const crown = n === 20 ? ('ash' as const) : undefined;
  const [rulerName, rulerTitle] = crown ? ['Ash and Ember', 'The fire at the wood’s end'] : RULERS[(n - 12) % RULERS.length];
  const extra: [string, MoveSpec] = pick([
    ['fan', { use: 'fan', share: 0.05 }],
    ['briars', { use: 'stones', name: 'Falling Briars', share: 0.07, count: 4, radius: 1.5, cooldown: 8 }],
    ['call', { use: 'call', name: 'The Pack Comes', count: 2, cooldown: 20 }],
  ] as [string, MoveSpec][]);
  const ruler: RulerDef = {
    name: rulerName, title: rulerTitle, stand: rulerBody, tint: TINTS[(n - 12) % TINTS.length], scale: r2(range(2.5, 2.9)), hp: Math.round((4000 * (1 + 0.02 * (n - 11))) / 50) * 50, speed: 0, stagger: { max: 100, kneel: 5 },
    room: 'glade',
    moves: {
      thorns: { use: 'volley', name: pick(['Thorn Volley', 'Seed Volley', 'Briar Volley']), share: 0.085, cooldown: 4.5 },
      walls: { use: 'stones', name: pick(['Walls of Roots', 'Rising Roots', 'Root Snares']), share: 0.05, count: 3, radius: 1.7, cooldown: 7 },
      quake: { use: 'halves', name: pick(['The Wood Tilts', 'The Ground Splits', 'The Moss Heaves']), share: 0.09, cooldown: 12 },
      rake: { use: 'spokes', name: pick(['Root Spokes', 'Branch Rake', 'Thorn Spokes']), share: 0.1, cooldown: 14 },
      [extra[0]]: extra[1],
    },
    phases: [
      { name: `${rulerName} wakes`, at: 1, moves: ['thorns', 'walls'], gap: [1.8, 2.8] },
      { name: 'The roots close in', at: 0.66, moves: ['thorns', 'walls', 'quake', extra[0]], gap: [1.6, 2.4] },
      { name: 'The wood walks', at: 0.33, moves: ['thorns', 'walls', 'quake', 'rake', extra[0]], gap: [1.3, 2] },
    ],
    sentries: { look: 'root', spots: [[60, 8.4], [180, 8.8], [300, 8.4]], hp: 100, again: 34, fall: { stagger: 30 }, guards: { open: 9 } },
    line: crown ? 'A Raid boss, alone: two of them, fire and ash; keep moving' : 'Cut the roots that feed it; it stands open when none is left',
  };
  const twists = ['swift', 'giant', 'warded'] as const;
  const pieces: PiecesDef = {
    floor: n, hard: r2(1.12 + 0.0125 * (n - 11)), // floor 11 is 1.12, the Sands (floor 21) 1.25
    ruler,
    gate: { hero: gateHero, arena: 'glade', level: 3, twist: { kind: 'shift', name: 'Roots rise as cover', early: 29 } },
    trial: { kind: (['gauntlet', 'break', 'hold', 'horde'] as const)[n % 4], height: n < 16 ? 4 : 5 },
    ...(crown ? { crown } : {}),
    rival: { hero: rivalHero, twist: twists[n % 3], line: `${rivalHero} waits in the thicket`, height: 4 + Math.floor((n - 11) / 4) },
  };

  // --- people, quests, doors, secrets ----------------------------------------------------------------------------------------------
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const mid = (s: string) => s.replace(/^The /, 'the ');
  const poss = (s: string) => (s.endsWith('s') ? `${s}’` : `${s}’s`);
  const facing = (p: V) => r2(Math.atan2(-p.x, -p.z));
  const people: (Omit<PersonDef, 'at'> & { at: V })[] = [
    { id: 'keeper', hero: keeperHero, name: keeperHero, role: 'keeper', at: C(-2.6, 2), face: 0.4, greet: [`Careful, climber. The wood walks. Two wisps are bound in it, and ${mid(rulerName)} waits at its heart, far to the north. Free the wisps, cut the roots that feed it, and its door opens.`], quests: ['main', 'bounty1', 'bounty2'] },
    { id: 'giver', hero: giverHero, name: giverHero, role: 'giver', at: C(5.5, -0.7), face: -0.5, greet: [pick(['I lose things in this wood, and the wood keeps them. Maybe you can bring them back.', 'Two lamps, a lost tool, and nobody with the legs for it. Except you.', 'The paths move, but my lamps stay put. Mostly.'])], quests: ['g1', 'g2'] },
    { id: 'villager', hero: villagerHero, name: villagerHero, role: 'giver', at: villagerAt, face: facing(villagerAt), greet: [`You found ${lower(Vl.name)}? Then you can stand by it a while.`], quests: ['g3'] },
    { id: 'rival', hero: rivalHero, name: rivalHero, role: 'rival', at: rivalAt, face: facing(rivalAt), greet: [], quests: [] },
    { id: 'trader', hero: traderHero, name: traderHero, role: 'trader', at: C(-5.5, 5.5), face: 0.6, greet: ['Shards for what you need. The wood takes nothing back, so I take shards.'], quests: [] },
  ];
  const reward = (s: number, more: { boon?: boolean; relic?: boolean } = {}) => ({ shards: shard(s), ...more });
  const leadNpc = pick(NPCS);
  const quests: QuestDef[] = [
    {
      id: 'main', name: pick(['The Heart of the Wood', 'The Bound Wisps', 'The Feeding Roots']), giver: 'keeper', main: true,
      intro: [`Clear ${lower(A.name)}, and its wisp follows you: lead it to the heart. Then ${lower(D.name)}: the Stag-Crowned guards the second wisp. Last, cut the three roots that feed ${mid(rulerName)}, and its door opens.`],
      steps: [
        { verb: 'fell', text: `Clear ${lower(A.name)}`, packs: ['a'] },
        { verb: 'lead', text: `Lead the wisp from ${lower(A.name)} to the heart`, name: 'The wisp', look: 'wisp', speed: 3, from: wispA, r: 3, path: roadA },
        // The guard first: a pack that loses the hero walks home and heals, so leading a wisp past an awake guard is a fight on two fronts.
        { verb: 'fell', text: `Clear ${lower(D.name)}`, packs: ['d'] },
        { verb: 'lead', text: `Lead the wisp from ${lower(D.name)} to the heart`, name: 'The wisp', look: 'wisp', speed: 3, from: wispD, r: 3, path: roadD },
        { verb: 'fell', text: 'Cut the three roots that feed the heart', packs: ['root1', 'root2', 'root3'] },
        { verb: 'open', text: `Go to ${poss(mid(rulerName))} door`, door: 'lair' },
      ] as Step[],
      outro: [`The wisps are home, the roots are cut. ${poss(rulerName)} door stands open, far in the north. Rest first, then go in.`],
      reward: reward(80, { boon: true }),
    },
    { id: 'bounty1', name: named1, giver: 'keeper', intro: [`${named1} walks round ${lower(H.name)}. Fell it and the wood grows calmer.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named1)}`, pack: 'named1' }], outro: ['A relic from the old wood. Keep it.'], reward: reward(40, { relic: true }) },
    { id: 'bounty2', name: named2, giver: 'keeper', intro: [`${named2} walks the far glades. Nobody lights the lamps while it does.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named2)}`, pack: 'named2' }], outro: ['The glades are quiet again.'], reward: reward(35) },
    {
      id: 'g1', name: 'The Spore Lamps', giver: 'giver', intro: [`Two spore lamps: one at ${lower(Cl.name)}, one at ${lower(E.name)}. Light both, stand by each a moment, and I can see the paths move.`],
      steps: [{ verb: 'light', text: 'Light the two spore lamps', things: [{ id: 'lamp1', at: Cl.stand }, { id: 'lamp2', at: E.stand }], seconds: 2 }] as Step[],
      outro: ['Now I can see. Take this, it was in the moss.'], reward: reward(35, { boon: true }),
    },
    { id: 'g2', name: pick(['The Lost Spade', 'The Lost Lantern', 'The Lost Bundle']), giver: 'giver', intro: [`${leadNpc} dropped a bundle in ${lower(B.name)} and will not go back for it. Carry it to the camp fire. A hit and you drop it.`],
      steps: [{ verb: 'carry', text: `Bring the bundle from ${lower(B.name)} to the fire`, item: 'bundle', itemName: 'The bundle', toName: 'the camp fire', look: 'bundle', plain: true, from: spadeFrom, to: spadeTo, r: 2.2 } as Step], outro: ['Here, for the trouble.'], reward: reward(45) },
    {
      id: 'g3', name: 'The Burners’ Watch', giver: 'villager', intro: [`My stacks lie past ${lower(Vl.name)}. Find them, then hold the clearing while I bring the charcoal in: the hounds smell the smoke.`],
      steps: [
        { verb: 'reach', text: 'Find the charcoal stacks', at: reach, r: 3 },
        { verb: 'hold', text: 'Hold the clearing while the charcoal comes in', at: hold, r: 3.6, seconds: 18 + Math.round(4 * k), waves: { kinds: ['hound', 'hound', 'hound'], every: 9 } },
      ] as Step[],
      outro: ['All in, and dry. Take this.'], reward: reward(40),
    },
  ];
  const doors: (Omit<DoorDef, 'at'> & { at: V })[] = [
    { id: 'lair', piece: 'ruler', name: crown ? 'The Cinder Court' : `${poss(rulerName)} door`, at: lairDoor, r: 2.2, wall: { ax: -3.4, az: lairZ, bx: 3.4, bz: lairZ, r: 0.6, height: 3.8 }, locked: `Roots hold the door shut. ${keeperHero} has a quest about the wisps.` },
    { id: 'trial', piece: 'trial', name: pick(['The Hollow Stump', 'The Root Cellar', 'The Moss Barrow']), at: trial, r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: gate, r: 2.2, needs: { won: 'ruler' }, locked: `The gate is sealed. Its warden answers only once ${mid(rulerName)} has fallen.` },
    { id: 'rival', piece: 'rival', name: `${poss(rivalHero)} thicket`, at: rivalDoor, r: 2, locked: '' },
  ];
  const cacheDefs = caches.map((c, i) => ({ id: `c${i + 1}`, at: c, shards: shard([25, 30, 20, 30, 25, 20][i]), ...(i === 2 || i === 5 ? { boon: true } : {}) }));
  const stoneDefs = stones.map((s, i) => ({ id: `w${i + 1}`, name: `The ${stoneNear[i].name.replace(/^The /, '').toLowerCase()} stone`, at: s }));
  const loreText = LORE[(n - 12) % LORE.length];

  return finish(G, {
    n, seed, m, crown, pieces, enemies, packs, people, quests, doors, caches: cacheDefs, stones: stoneDefs, lore, loreName: 'The root stone', loreText,
    name: crown ? 'The Crown of the Wood' : FLOOR_NAMES[(n - 12) % FLOOR_NAMES.length], blurb: crown ? 'Where the wood ends, the fire it was planted against.' : BLURBS[(n - 12) % BLURBS.length],
    id: `wood-${String(n).padStart(2, '0')}`, tunedAs: r2(2 + (n - 11) / 9), par: Math.round((840 + 20 * (n - 11)) * 2.2),
    shop: { heal: 30 + 2 * (n - 11), boon: 55 + 3 * (n - 11), life: 80 + 4 * (n - 11), hint: 15 },
    law: { every: 120 - 2 * (n - 11), warn: 8, blurb: `Every ${120 - 2 * (n - 11)} seconds roots close ${closable} ways and open ${closable} others. A green glow marks the ways that are open.` },
    rival: { hero: rivalHero, goal: 'the thicket', at: rivalAt, lines: [`Another climber. I am ${rivalHero}. Walk into the thicket behind me and we see who is better. Win, and I fight beside you.`] },
  });
}

/** What a floor adds to its layout to be a floor; moved into the world (mirrored when `m` is -1). */
interface Content {
  n: number; seed: number; m: 1 | -1; crown?: 'ash';
  pieces: PiecesDef; enemies: Record<string, EnemySpec>; packs: PackDef[];
  people: (Omit<PersonDef, 'at'> & { at: V })[]; quests: QuestDef[]; doors: (Omit<DoorDef, 'at'> & { at: V })[];
  caches: (Omit<CacheDef, 'at'> & { at: V })[]; stones: (Omit<WaystoneDef, 'at'> & { at: V })[]; lore: V; loreName: string; loreText: [string, string];
  name: string; blurb: string; id: string; tunedAs: number; par: number; shop: { heal: number; boon: number; life: number; hint: number };
  law: { every: number; warn: number; blurb: string; name?: string };
  rival: { hero: string; goal: string; at: V; lines: string[] };
}

function finish(G: Lay, c: Content): GenFloor {
  const { m, n } = c, W = worldOf(m), X = W.X;
  const mapStep = (s: Step): Step => {
    switch (s.verb) {
      case 'reach': case 'hold': return { ...s, at: X(s.at) };
      case 'light': return { ...s, things: s.things.map((t) => ({ ...t, at: X(t.at) })) };
      case 'carry': return { ...s, from: X(s.from), to: X(s.to) };
      case 'lead': return { ...s, from: X(s.from), path: s.path.map(X) };
      default: return s;
    }
  };
  const all = [G.camp, ...G.places, G.heart];
  const placeDefs: Record<string, PlaceDef> = {};
  for (const p of all) placeDefs[p.id] = { id: p.id, name: p.name, ...X(p.c), r: p.r, stand: X(p.stand) };
  // The law's walls of roots: across each closing pass, their ends buried in the bands either side.
  const walls = G.passes.filter((p) => !p.open).map((p) => {
    const e = p.half + BAND_R + 0.4;
    return { a: X(add(p.p, p.dir, -e)), b: X(add(p.p, p.dir, e)), r: 0.7, height: 3.4, set: p.set!, name: p.name };
  });
  if (G.kinds.length !== G.L.cover.length) throw new Error(`floor ${n}: ${G.kinds.length} kinds for ${G.L.cover.length} pieces`);
  const elderW = X({ x: 0, z: G.lairZ - 18 });
  const look = {
    rim: m === 1 ? G.rim : mirrorRim(G.rim),
    pieces: G.L.cover.map(W.piece),
    kinds: G.kinds,
    places: all.map((p) => ({ id: p.id, kind: p.kind, ...X(p.c), r: p.r })),
    paths: G.roads.map((r) => r.map(W.off)),
    passes: G.passes.map((p) => ({ ...X(p.p), dx: r2(m * p.dir.x), dz: r2(p.dir.z), w: p.half, ...(p.open ? {} : { set: p.set }) })),
    elder: elderW,
    mirror: m, seed: n * 101 + 7,
  } satisfies WoodLook;
  return {
    n, chapter: 'wood', seed: c.seed, look, pieces: c.pieces,
    floor: {
      n, id: c.id, name: c.name, blurb: c.blurb, tunedAs: c.tunedAs, ring: Math.ceil(Math.max(...G.rim) + 1.5), start: X(G.C(0, 5.5)), camp: X(G.C(0, 2)), places: placeDefs, par: c.par, shop: c.shop,
      law: { kind: 'paths', name: c.law.name ?? 'The wood walks', blurb: c.law.blurb, every: c.law.every, warn: c.law.warn, first: 0, walls },
      enemies: c.enemies, packs: c.packs.map((p) => ({ ...p, at: X(p.at), ...(p.named ? { named: { ...p.named, patrol: p.named.patrol.map(X) } } : {}) })),
      people: c.people.map((p) => ({ ...p, at: X(p.at), face: W.yaw(p.face) })),
      quests: c.quests.map((q) => ({ ...q, steps: q.steps.map(mapStep) })),
      caches: c.caches.map((x): CacheDef => ({ ...x, at: X(x.at) })),
      waystones: c.stones.map((w): WaystoneDef => ({ ...w, at: X(w.at) })),
      lore: { id: 'lore', name: c.loreName, at: X(c.lore), text: [...c.loreText] },
      doors: c.doors.map((d) => ({ ...d, at: X(d.at), ...(d.wall ? { wall: { ...d.wall, ax: X({ x: d.wall.ax, z: d.wall.az }).x, az: X({ x: d.wall.ax, z: d.wall.az }).z, bx: X({ x: d.wall.bx, z: d.wall.bz }).x, bz: X({ x: d.wall.bx, z: d.wall.bz }).z } } : {}) })),
      rival: { hero: c.rival.hero, goal: c.rival.goal, mode: 'duel', at: X(c.rival.at), boon: true, lines: c.rival.lines },
    },
  };
}

// --- floor 11, The Walking Wood, at the new size -----------------------------------------------------------------------------------

/**
 * Floor 11 laid out at five times its ground by the same glades (the user's choice: "the five handmade floors grow too"): its places,
 * people, quests, packs, ruler, gatekeeper, rival and law as they were (the same ids, the same numbers, `tunedAs` 2), on a large outline.
 * Its set pieces stay in pieces/floors.ts. Waystones and caches grow to six each for the larger ground (the first three keep their ids).
 * Baked by pipeline/tools/gen-wood11.ts into floors/woodGrown.ts.
 */
export function makeWoodEleven(o: { attempt?: number } = {}): GenFloor {
  const n = 11, seed = 11000 + (o.attempt ?? 0), rnd = mulberry(seed), m: 1 | -1 = 1;
  const slots: Slot[] = [
    { id: 'den', kind: 'den', name: 'The hounds’ den', deg: [-116, -102], f: [0.62, 0.72], pack: true, r: 9.5 },
    { id: 'bramble', kind: 'bramble', name: 'The bramble', deg: [102, 116], f: [0.62, 0.72], pack: true, r: 9.5 },
    { id: 'stones', kind: 'stones', name: 'The old stones', deg: [-20, 20], f: [0.04, 0.16], r: 7 },
    { id: 'giants', kind: 'giants', name: 'The giants’ glade', deg: [40, 56], f: [0.66, 0.76], pack: true, r: 9.5 },
    { id: 'thicket', kind: 'thicket', name: 'The thicket', deg: [-56, -40], f: [0.66, 0.76], r: 9 },
    { id: 'lampw', kind: 'lamps', name: 'The west lamp glade', deg: [-150, -134], f: [0.56, 0.66], r: 7 },
    { id: 'lampe', kind: 'lamps', name: 'The east lamp glade', deg: [134, 150], f: [0.56, 0.66], r: 7 },
  ];
  const short = (p: Place) => ({ den: 'den', bramble: 'bramble', stones: 'old', giants: 'giants’', thicket: 'thicket', lampw: 'lamp', lampe: 'east', camp: 'camp', heart: 'heart’s' } as Record<string, string>)[p.id] ?? 'old';
  const G = layoutWood(n, rnd, slots, { closable: 3, packIds: ['den', 'bramble', 'giants'], shortName: short });
  const { L, heart, places, cells, passes, C, lairZ, lairDoor, range } = G;
  const at = G.at;
  const P = (id: string) => places.find((p) => p.id === id)!;
  const Den = P('den'), Bra = P('bramble'), Sto = P('stones'), Gia = P('giants'), Thi = P('thicket'), LW = P('lampw'), LE = P('lampe');
  const cellOf = (p: Place) => cells.indexOf(p);
  dressPlaces(G);
  const packSpots = [Den.c, Bra.c, Gia.c, heart.c];
  const far = (min: number) => (q: V) => packSpots.every((s) => dist(s, q) >= min);
  const gate = L.reserve(L.spot(C(16, 6), 2, 2.2), 3.5);
  const trial = L.reserve(L.spot(C(-16, 6), 2, 2), 3.5);
  const rivalDoor = L.reserve(L.spot(add(Thi.c, unit(Thi.c), 9), 3, 2, far(20)), 3.5);
  const rivalAt = L.reserve(L.spot(add(rivalDoor, toMid(rivalDoor), 6), 1.5, 1.2), 2);
  const lore = L.reserve(L.spot(add(heart.c, { x: -12, z: -3 }), 3, 1.5), 2.5);
  const caches = [add(Thi.c, { x: -14, z: 10 }), at(range(68, 80), 0.86), at(range(-20, -8), 0.5), at(range(150, 165), 0.86), at(range(-100, -90), 0.9), at(range(14, 26), 0.86)]
    .map((p) => L.reserve(L.spot(p, 5, 1.5), 2.5));
  const stoneNear = [LW, LE, Thi, Sto, Gia, Den];
  const stones = stoneNear.map((p) => L.reserve(L.spot(add(p.c, toMid(p.c), p === Sto ? 12 : 16), 4, 1.5, far(14)), 2.5));
  // The Hollow Oak walks the old road between the old stones and the heart (passes that never close, as the avenue never did).
  const oakWay = [Sto.stand, ...passRoute(cells, passes, cellOf(Sto), cellOf(heart)), heart.stand];
  const oakPatrol: V[] = [];
  for (let i = 0; i < oakWay.length; i++) {
    const p = i === 0 ? add(oakWay[0], { x: 0, z: -10 }) : i === oakWay.length - 1 ? add(oakWay[i], { x: 0, z: 9 }) : oakWay[i];
    oakPatrol.push(L.spot(p, 2, 1.5, far(16)));
  }
  const oakLoop = [...oakPatrol, ...oakPatrol.slice(1, -1).reverse()];
  for (let i = 1; i < oakPatrol.length; i++) L.lane(oakPatrol[i - 1], oakPatrol[i], 1.8);
  const wisp = (p: Place) => L.reserve(L.spot(add(p.stand, toMid(p.c), 4.5), 2, 1.2), 2);
  const wDen = wisp(Den), wBra = wisp(Bra), wThi = wisp(Thi);
  const hi = cellOf(heart);
  const road = (p: Place, avoid: Place[]) => [...passRoute(cells, passes, cellOf(p), hi, avoid.map(cellOf)), heart.stand];
  const spadeFrom = L.reserve(L.spot(add(Bra.stand, toMid(Bra.c), 5), 2, 1.5), 2.5);
  const spadeTo = C(1.6, -2.9);
  const roots = [add(heart.c, { x: -7, z: -2 }), add(heart.c, { x: 7, z: -2 }), add(heart.c, { x: 0, z: 7 })];
  for (const r of roots) L.reserve(r, 2);
  scatter(G, 46, [Den.c, Bra.c, Gia.c, heart.c]);

  const enemies: Record<string, EnemySpec> = {
    hound: { id: 'hound', name: 'Bark hound', blurb: 'Fast, and hunts in a pack.', look: 'hound', melee: true, hp: 55, share: 0.02, every: 1.2, speed: 4.6, scale: 1.2, shards: 4, color: '#e0a060' },
    sprite: { id: 'sprite', name: 'Thorn sprite', blurb: 'Floats back and throws thorns.', look: 'sprite', melee: false, hp: 40, share: 0.022, every: 2.2, speed: 2.6, range: 10, scale: 1.55, shards: 5, color: '#ff7aa8' },
    giant: { id: 'giant', name: 'Moss giant', blurb: 'Slow, heavy, hits hard.', look: 'giant', melee: true, hp: 230, share: 0.045, every: 2.6, speed: 1.7, scale: 1.7, shards: 8, color: '#9acd6a' },
    stag: { id: 'stag', name: 'The Stag-Crowned', blurb: 'Guards the glade.', look: 'stag', melee: true, hp: 420, share: 0.055, every: 1.5, speed: 3.4, scale: 1.9, shards: 30, color: '#ffe08a' },
    oak: { id: 'oak', name: 'The Hollow Oak', blurb: 'Walks the old road and strikes hard.', look: 'oak', melee: true, hp: 620, share: 0.065, every: 2.2, speed: 2.0, scale: 2.4, shards: 40, color: '#e0c080' },
    root: { id: 'root', name: 'Feeding root', blurb: 'A root that feeds the Elder Root. It cannot move; it throws thorns.', look: 'root', melee: false, hp: 150, share: 0.03, every: 3, speed: 0, range: 11, scale: 1.6, shards: 10, color: '#c8f080' },
  };
  const packs: PackDef[] = [
    { id: 'den', at: Den.c, mix: [{ kind: 'hound', n: 4 }] },
    { id: 'bramble', at: Bra.c, mix: [{ kind: 'sprite', n: 3 }] },
    { id: 'giants', at: Gia.c, mix: [{ kind: 'giant', n: 2 }], elite: 'stag' },
    { id: 'oak', at: oakLoop[0], mix: [{ kind: 'oak', n: 1 }], named: { name: 'The Hollow Oak', speed: 1.6, patrol: oakLoop, bounty: { shards: 40, relic: true } } },
    ...roots.map((r, i) => ({ id: `root${i + 1}`, at: { x: r2(r.x), z: r2(r.z) }, mix: [{ kind: 'root', n: 1 }] })),
  ];
  const people: (Omit<PersonDef, 'at'> & { at: V })[] = [
    { id: 'bo', hero: 'Bo', name: 'Bo', role: 'keeper', at: C(-2.6, 2.4), face: 0.4, greet: ['Careful, climber. The wood walks, and my sheep walk with it. Three wisps are bound in it, and the Elder Root at its heart is hungry.'], quests: ['main', 'bounty'] },
    { id: 'mortis', hero: 'Mortis', name: 'Mortis', role: 'giver', at: C(3.6, 2), face: -0.5, greet: ['I dig. I find. I lose things in the finding. Maybe you can bring them back.'], quests: ['mortis-lamps', 'mortis-spade'] },
    { id: 'nyx', hero: 'Nyx', name: 'Nyx', role: 'rival', at: rivalAt, face: r2(Math.atan2(-rivalAt.x, -rivalAt.z)), greet: [], quests: [] },
    { id: 'silvane', hero: 'Silvane', name: 'Silvane', role: 'trader', at: C(-4.6, -0.8), face: 0.6, greet: ['Shards for what you need. The wood takes nothing back, so I take shards.'], quests: [] },
  ];
  const quests: QuestDef[] = [
    {
      id: 'main', name: 'The Heart of the Wood', giver: 'bo', main: true,
      intro: ['Free three wisps: stand by each one and it follows you. Lead them to the heart. Then cut the three roots that feed the Elder Root, and its door opens.'],
      steps: [
        { verb: 'lead', text: 'Free the wisp in the hounds’ den and lead it to the heart', name: 'The wisp', look: 'wisp', speed: 3, from: wDen, r: 3, path: road(Den, [Bra, Gia]) },
        { verb: 'lead', text: 'Free the wisp in the bramble and lead it to the heart', name: 'The wisp', look: 'wisp', speed: 3, from: wBra, r: 3, path: road(Bra, [Den, Gia]) },
        { verb: 'lead', text: 'Free the wisp in the thicket and lead it to the heart', name: 'The wisp', look: 'wisp', speed: 3, from: wThi, r: 3, path: road(Thi, [Den, Bra, Gia]) },
        { verb: 'fell', text: 'Cut the three roots that feed the Elder Root', packs: ['root1', 'root2', 'root3'] },
        { verb: 'open', text: 'Go to the Elder Root’s door', door: 'lair' },
      ] as Step[],
      outro: ['The wisps are home, the roots are cut. The Elder Root’s door stands open, far in the north. Rest first, then go in.'],
      reward: { shards: 60, boon: true },
    },
    { id: 'bounty', name: 'The Hollow Oak', giver: 'bo', intro: ['An oak walks the old road to the heart. Hollow, and a hundred winters old. Fell it and the wood grows calmer.'], steps: [{ verb: 'fell-named', text: 'Fell the Hollow Oak', pack: 'oak' }], outro: ['A relic from an oak. Keep it.'], reward: { shards: 40, relic: true } },
    {
      id: 'mortis-lamps', name: 'The Spore Lamps', giver: 'mortis', intro: ['Two spore lamps stand in the glades west and east of the camp. Light both, stand by each a moment, and I can see where to dig.'],
      steps: [{ verb: 'light', text: 'Light the two spore lamps', things: [{ id: 'lamp1', at: LW.stand }, { id: 'lamp2', at: LE.stand }], seconds: 2 }] as Step[],
      outro: ['Now I can see. Take this, it was in the dirt.'], reward: { shards: 35, boon: true },
    },
    {
      id: 'mortis-spade', name: 'The Lost Spade', giver: 'mortis', intro: ['My spade lies in the bramble, where the thorns took it. Carry it back to the camp fire. A hit and you drop it.'],
      steps: [{ verb: 'carry', text: 'Bring Mortis’s spade from the bramble to the fire', item: 'spade', itemName: 'The spade', toName: 'the camp fire', look: 'bundle', plain: true, from: spadeFrom, to: spadeTo, r: 2.2 }] as Step[],
      outro: ['My spade! Here, for the trouble.'], reward: { shards: 45 },
    },
  ];
  const doors: (Omit<DoorDef, 'at'> & { at: V })[] = [
    { id: 'lair', piece: 'ruler', name: 'The Elder Root’s door', at: lairDoor, r: 2.2, wall: { ax: -3.4, az: lairZ, bx: 3.4, bz: lairZ, r: 0.6, height: 3.8 }, locked: 'Roots hold the door shut. Bo has a quest about the wisps.' },
    { id: 'trial', piece: 'trial', name: 'The Hollow Stump', at: trial, r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: gate, r: 2.2, needs: { won: 'ruler' }, locked: 'The gate is sealed. Its warden answers only once the Elder Root has fallen.' },
    { id: 'rival', piece: 'rival', name: 'Nyx’s thicket', at: rivalDoor, r: 2, locked: '' },
  ];
  const stoneNames = ['The den road stone', 'The bramble road stone', 'The thicket stone', 'The old road stone', 'The giants’ stone', 'The den stone'];
  return finish(G, {
    n, seed, m, pieces: null as unknown as PiecesDef, enemies, packs, people, quests, doors,
    caches: caches.map((c, i) => ({ id: `c${i + 1}`, at: c, shards: [25, 30, 20, 25, 30, 20][i], ...(i === 2 || i === 5 ? { boon: true } : {}) })),
    stones: stones.map((s, i) => ({ id: `w${i + 1}`, name: stoneNames[i], at: s })),
    lore, loreName: 'The root stone', loreText: ['The wood was a field once. It walked away from the plough and has been walking since.', 'What you take for paths are roots, and what you take for roots are paths.'],
    name: 'The Walking Wood', blurb: 'A forest that does not stay where you left it.', id: 'wood', tunedAs: 2, par: Math.round(840 * 2.2), shop: { heal: 30, boon: 55, life: 80, hint: 15 },
    law: { every: 120, warn: 8, blurb: 'Every two minutes roots close three ways and open three others. A glow marks the ways that are open.', name: 'The wood walks' },
    rival: { hero: 'Nyx', goal: 'the thicket', at: rivalAt, lines: ['Another climber. I am Nyx, and I hunt in the dark. Walk through the arch behind me and we see who is quicker. Win, and I fight beside you.'] },
  });
}
