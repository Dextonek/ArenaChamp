import type { CacheDef, DoorDef, EnemySpec, PackDef, PersonDef, PlaceDef, QuestDef, RivalDef as FloorRival, Step, WaystoneDef } from '../def';
import type { DeepLook, DeepLookKind } from '../deepZone';
import type { MoveSpec, PiecesDef, RulerDef } from '../pieces/types';
import type { Look, Piece } from '../zone';
import type { GenFloor } from './types';
import { Layout, add, dist, inside, makeOutline, mirrorRim, mulberry, polar, r2, rimToward, roadRoute, segDist, shuffle, toMid, unit, worldOf, type V } from './core.ts';

/**
 * The Deep chapter's generator (pipeline/designs/tower-50.md): floor `n` (32 to 40) of the Deep, made from floor 31's parts (the
 * Lightless Deep: its look, its enemies, the dark, its kinds of quest, the Prism Mother's moves and room, the cavern as the gatekeepers'
 * ground) on a zone five times floor 1's ground, of a wavy outline (the user, 2026-11-14: "lets make those maps 5 x larger", "it doesnt
 * need to have circular shape it can be whatever"). And floor 31 itself, grown to the same size (`home`): the same place, people, quests,
 * ruler, gatekeeper, race and law, laid out again (baked by `pipeline/tools/gen-deep-home.ts`).
 *
 * The Deep is underground: a cave system. The outline is the cave's wall (deepZone.ts draws rock rising past it, the black water on one
 * side, a drop into the dark in the south); ridges of rock inside split the ground into chambers joined by passages (the mine's tracks,
 * kept clear). Laid out in one frame, the water to the east, mirrored at the end for the floors whose water is in the west. The camera
 * looks north: the camp is in the south, the lair (a rock fall) in the north. Runs under `node` (plain TypeScript: no parameter
 * properties, imports with their `.ts` ending, types only besides gen/core.ts).
 */

const ROSTER = ['Ada', 'Anka', 'Auriel', 'Bo', 'Bram', 'Brannoc', 'Cantor', 'Fenna', 'Gus', 'Hank', 'Isolde', 'Kaia', 'Lyra', 'Mabel', 'Marin', 'Mortis', 'Mum', 'Nyx', 'Oblivion', 'Opaline', 'Pip', 'Sefu', 'Shiori', 'Silvane', 'Sirix', 'Tempo', 'Vesper', 'Vitriol', 'Wick', 'Zephyr'];
const RULER_BODIES = ['Auriel', 'Silvane', 'Sirix', 'Mortis', 'Opaline', 'Cantor', 'Isolde', 'Vitriol', 'Nyx', 'Hank'];
const HANDMADE_GATES = ['Marin', 'Fenna', 'Sefu', 'Opaline', 'Oblivion'];
/** The sea's gatekeepers (gen/sea.ts draws its nine the same way): the Deep's are others, so no two chapters share one if it can help it. */
const SEA_GATES = shuffle(ROSTER.filter((h) => !HANDMADE_GATES.includes(h)), mulberry(1001)).slice(0, 9);

const FLOOR_NAMES = ['The Amethyst Seam', 'The Echo Galleries', 'The Black Water', 'The Lamp Road', 'The Hollow Choir', 'The Glass Roots', 'The Sunless Market', 'The Prism Stair'];
const BLURBS = ['A seam of violet crystal that went out one night.', 'Galleries that answer every step twice.', 'A cave beside water that has never seen the sun.', 'A road of lamps the miners kept lit, until they could not.', 'Halls where the crystals once sang.', 'Roots of glass grown down through the rock.', 'A market the miners held below, for light and bread.', 'A stair of prisms down to the deepest halls.'];
const RULERS: [string, string][] = [['The Hollow Queen', 'Shade beneath the stone'], ['The Lamp Warden', 'Keeper of the last light'], ['The Glass Abbot', 'Prayers in prism'], ['Mother of Echoes', 'She answers every step'], ['The Seam King', 'Crowned in ore'], ['The Blind Cantor', 'He sings the dark awake'], ['The Gem Tyrant', 'Hoarder of the halls'], ['The Drowned Lantern', 'A light under the black water']];
const TINTS = ['#7a62c8', '#6a5ab8', '#8a6ad8', '#5a6ac8', '#7a52b8', '#6a72d0', '#8a5ac0', '#5a5aa8'];
const NAMED = ['The Hollow Foreman', 'Old Pick', 'The Glass Widow', 'Mother Seam', 'The Lampless', 'Grey Tallow', 'The Stone Choir', 'Cinder Jack', 'The Long Dark', 'Quartz Annie', 'The Last Shift'];
const NPCS = ['Dunn', 'Hesk', 'Moll', 'Tobin', 'Greet', 'Abel', 'Sorrel', 'Kit'];
const LORE: [string, string][] = [
  ['The miners lit the crystals to find their way home.', 'When the crystals went out, the miners stayed, and learned to wait in the dark.'],
  ['Every seam here was followed by lamplight.', 'Where the lamps stopped, the seam went on without them.'],
  ['The water below has no tide and no bottom.', 'Things that fall into it are not lost. They are kept.'],
  ['A miner wrote the halls down by the light of each crystal.', 'The last page is dark, and the writing goes on across it.'],
  ['The crystals sang when they were lit.', 'Stand still in a dark hall and you can hear them trying.'],
  ['Bread was baked down here once, and sold for light.', 'The ovens are cold. The prices are still chalked on the wall.'],
  ['A climber passed here before you.', 'The rock remembers the footsteps; the dark does not.'],
  ['The deeper the hall, the older the crystal.', 'The oldest are not asleep. They are listening.'],
];

type Kind = 'hall' | 'rest' | 'yard' | 'shore' | 'pools' | 'shaft' | 'well';
const PLACE_NAMES: Record<Kind, string[]> = {
  hall: [], rest: ['The miners’ rest', 'The lamp huts', 'The old bunks'], yard: ['The cart yard', 'The ore yard', 'The winding yard'],
  shore: ['The black landing', 'The still shore', 'The boat steps'], pools: ['The glow pools', 'The cold pools', 'The blue pools'],
  shaft: ['The old shaft', 'The fallen shaft', 'The deep shaft'], well: ['The echo well'],
};
interface Place { id: string; kind: Kind; name: string; c: V; r: number; stand: V }

export interface DeepGenOptions { n: number; attempt?: number }

/** Five times floor 1's walkable ground (a circle of 48 m: 7238 m2). */
const AREA = 5 * Math.PI * 48 * 48;
const RING_X = 0, RING_Z = 7; // core.ts `RING`
/** The dark wakes a pack of lurkers from this far when the hero stands outside every light (f45/laws.ts `DARK.wakeDark`, 15), and some room. */
const LURK = 20;

const lk = (s: DeepLookKind) => s as unknown as Look;
/** The nearest of zone.ts's looks to each of the Deep's (what a reader of the baked data that knows only those would draw). */
const NEAREST: Record<DeepLookKind, Look> = {
  stal: 'rock', stalwall: 'rock', column: 'post', rock: 'rock', crystal: 'rock', great: 'rock', timber: 'crate', hut: 'tent', cradle: 'barrel', cart: 'crate', fire: 'fire', crate: 'crate',
  wall: 'house', ridge: 'rock', post: 'post', edge: 'edge',
}; // Layout takes zone.ts's looks; the Deep draws its own (deepZone.ts)

/** Floor 31 grown (true) or a made floor of the Deep. */
export function makeDeepFloor(o: DeepGenOptions): GenFloor {
  const n = o.n, home = n === 31, seed = n * 1000 + (o.attempt ?? 0) + 7, rnd = mulberry(seed);
  const m: 1 | -1 = home ? 1 : n % 2 === 0 ? -1 : 1; // even floors have their water in the west
  const k = (n - 31) / 9; // 0 at floor 31, 1 at floor 40
  const rim = makeOutline(rnd, { area: AREA, min: 72, max: 140, waves: [0.18, 0.11, 0.08] });
  const L = new Layout(rim, rnd, n);
  const range = (a: number, b: number) => L.range(a, b);
  const pick = <T>(xs: readonly T[]) => L.pick(xs);
  const pill = (look: DeepLookKind, c: V, r: number, h: number) => L.pill(lk(look), c, r, h);
  const wall = (look: DeepLookKind, a: V, b: V, r?: number, h?: number) => L.wall(lk(look), a, b, r, h);
  /** A spot at a bearing, `f` of the way from the middle to the outline. */
  const at = (deg: number, f: number) => polar(deg, rimToward(rim, deg) * f);

  // --- who is where -----------------------------------------------------------------------------------------------------------
  const order = shuffle(ROSTER.filter((h) => !HANDMADE_GATES.includes(h) && !SEA_GATES.includes(h)), mulberry(4001));
  const gates = order.slice(0, 9), folk = [...order.slice(9), ...SEA_GATES, ...HANDMADE_GATES].filter((h) => !['Mabel', 'Isolde', 'Tempo'].includes(h));
  const who = (i: number) => folk[((n - 32) * 5 + i) % folk.length];
  const keeperHero = home ? 'Mabel' : who(0), giverHero = home ? 'Isolde' : who(1), traderHero = home ? 'Mr. Ledger' : who(2), rivalHero = home ? 'Tempo' : who(3), villagerHero = who(4);
  const gateHero = home ? 'Opaline' : gates[(n - 32) % gates.length];
  const turn = (n - 32 + RULER_BODIES.length) % RULER_BODIES.length, round = [...RULER_BODIES.slice(turn), ...RULER_BODIES.slice(0, turn)];
  const rulerBody = round.find((b) => ![keeperHero, giverHero, traderHero, rivalHero, villagerHero, gateHero].includes(b)) ?? 'Auriel';

  // --- the camp in the south, the lair (a rock fall) in the north, the outline's walls ----------------------------------------------
  const southR = rimToward(rim, 180), northR = rimToward(rim, 0);
  const camp: Place = { id: 'camp', kind: 'yard', name: home ? 'The lamp camp' : 'The camp', c: { x: 0, z: r2(southR - 16) }, r: 7, stand: { x: 0, z: r2(southR - 12.5) } };
  const cz = camp.c.z, C = (dx: number, dz: number): V => ({ x: dx, z: r2(cz + dz) });
  L.edges();
  pill('fire', C(0, -0.5), 0.9, 0.9); pill('hut', C(-8.5, 2.5), 1.7, 2.4); pill('hut', C(8.5, -1.5), 1.7, 2.4);
  pill('crate', C(-5, -4), 0.8, 1.2); pill('crate', C(5.4, 2.2), 0.8, 1.2); pill('timber', C(11, 4), 1.0, 1.6);
  const cradle = C(5.5, -4.5);
  pill('cradle', cradle, 0.7, 0.9);
  L.reserve(camp.c, 11);
  const lights = [C(0, 0), C(-6, 3), C(6, -3)];
  // The lair: a rock fall across the north, its gap facing the middle.
  // The door stands in front of the fall, as floor 31's did (behind it, in a yard shut on every side, nothing could walk to it).
  const lairZ = r2(-northR + 9), lairDoor: V = { x: 0, z: r2(lairZ + 2.6) };
  wall('wall', { x: -24, z: lairZ }, { x: -3.4, z: lairZ }, 0.5, 4.4); wall('wall', { x: 3.4, z: lairZ }, { x: 24, z: lairZ }, 0.5, 4.4);
  // Free-standing: the ground behind it can be walked round to. (Walled in at the sides, it shut in the spot the zone's unseen boss
  // stands on, at the ring's far north, and an autopilot with no other goal planned a way to it every frame and found none.)
  L.reserve({ x: 0, z: lairZ + 2 }, 6);

  // --- eight places on two rings round the middle -------------------------------------------------------------------------------
  // Canonical bearings (the water is east, 90): the outer ring 0.66 to 0.82 of the way out, the inner 0.3 to 0.46.
  const slots: { id: string; kind: Kind; deg: [number, number]; f: [number, number]; r?: number }[] = home
    ? [
      { id: 'hall1', kind: 'hall', deg: [-84, -66], f: [0.68, 0.78] }, // west: the first crystal
      { id: 'hall2', kind: 'hall', deg: [-36, -18], f: [0.72, 0.8] }, // north-west: the second
      { id: 'hall3', kind: 'hall', deg: [48, 66], f: [0.72, 0.8] }, // north-east: the third
      { id: 'pools', kind: 'pools', deg: [108, 126], f: [0.66, 0.76] }, // south-east: the thief
      { id: 'yard', kind: 'yard', deg: [-20, 20], f: [0.3, 0.4] }, // the inner north: the cart yard
      { id: 'well', kind: 'well', deg: [70, 110], f: [0.24, 0.34] }, // the inner east: Tempo's race runs to it
      { id: 'shaft', kind: 'shaft', deg: [-150, -100], f: [0.3, 0.42] }, // the inner south-west: Isolde's satchel
      { id: 'shore', kind: 'shore', deg: [82, 98], f: [0.76, 0.84] }, // the black water
    ]
    : [
      { id: 'a', kind: 'hall', deg: [-118, -100], f: [0.66, 0.76] }, // west-south-west: the first crystal
      { id: 'v', kind: 'rest', deg: [-80, -62], f: [0.7, 0.8], r: 9 }, // west: the miners' rest (no pack)
      { id: 'b', kind: 'hall', deg: [-40, -22], f: [0.72, 0.8] }, // north-west: the second
      { id: 'y', kind: 'yard', deg: [-8, 12], f: [0.36, 0.46] }, // the inner north
      { id: 'c', kind: 'hall', deg: [32, 52], f: [0.72, 0.8] }, // north-east: the third
      { id: 'e', kind: 'shore', deg: [86, 102], f: [0.74, 0.82] }, // the black water (no pack): the survey lamp
      { id: 'd', kind: 'pools', deg: [118, 135], f: [0.68, 0.76] }, // south-east: the thief and his lamp
      { id: 'h', kind: 'shaft', deg: [-150, 150], f: [0.32, 0.44] }, // the inner ring: the shaft
    ];
  const packIds = home ? ['hall1', 'hall2', 'hall3', 'pools', 'yard'] : ['a', 'b', 'y', 'c', 'd'];
  const places: Place[] = [];
  let hallNo = 0;
  for (const s of slots) {
    let c: V | null = null;
    for (let i = 0; i < 400; i++) {
      const p = at(range(...s.deg), range(...s.f));
      if (places.some((q) => dist(q.c, p) < (packIds.includes(q.id) && packIds.includes(s.id) ? 44 : 28))) continue;
      if (dist(p, camp.c) < 32 || dist(p, { x: 0, z: lairZ }) < 26 || inside(rim, p) < 14) continue;
      if (segDist(p, { x: -24, z: lairZ }, { x: 24, z: lairZ }) < 16) continue;
      c = p;
      break;
    }
    if (!c) throw new Error(`floor ${n}: no room for ${s.id}`);
    const back = s.kind === 'hall' ? 5.5 : s.kind === 'shore' ? 3 : s.kind === 'pools' ? 4 : s.kind === 'yard' ? 4 : 0;
    const cc = { x: r2(c.x), z: r2(c.z) }, st = add(cc, toMid(cc), back);
    const HOME: Partial<Record<Kind, string>> = { yard: 'The cart yard', pools: 'The glow pools', shaft: 'The old shaft', well: 'The echo well', shore: 'The black landing' };
    const name = s.kind === 'hall' ? `The ${['first', 'second', 'third'][hallNo]} hall` : home ? HOME[s.kind]! : pick(PLACE_NAMES[s.kind]);
    if (s.kind === 'hall') hallNo++;
    places.push({ id: s.id, kind: s.kind, name, c: cc, r: s.r ?? 8, stand: { x: r2(st.x), z: r2(st.z) } });
  }
  const P = (id: string) => places.find((p) => p.id === id)!;
  const halls = places.filter((p) => p.kind === 'hall');
  const [H1, H2, H3] = halls;
  const Y = places.find((p) => p.kind === 'yard')!, Po = places.find((p) => p.kind === 'pools')!, Sh = places.find((p) => p.kind === 'shaft')!, Sr = places.find((p) => p.kind === 'shore')!;
  const Vl = home ? null : P('v'), Wl = home ? P('well') : null;

  // Each place's own pieces round its stand.
  const crystals: V[] = [];
  for (const p of places) {
    const out = unit(p.c), tan = { x: -out.z, z: out.x };
    const Q = (dOut: number, dTan: number): V => add(add(p.c, out, dOut), tan, dTan);
    switch (p.kind) {
      case 'hall': {
        // The back of the hall: one wall of stalagmites in four joined lengths, open to the middle, the great crystal set into it. A wall,
        // not a row of posts: the route bot wedged itself in a 0.9 m gap between two posts (floor 33's first bake) and pressed for good
        // against a row of touching ones (floor 37's third).
        const arc = [-100, -50, 0, 50, 100].map((d) => { const a = (d * Math.PI) / 180; return add(add(p.c, out, Math.cos(a) * 6.9), tan, Math.sin(a) * 6.9); });
        for (let i = 1; i < arc.length; i++) wall('stalwall', arc[i - 1], arc[i], 1.0, 3.4);
        const cr = Q(5.6, 0), front = Q(3.5, 0);
        // Where the shard goes and where the hero stands to wake it: open ground just in front of the crystal, not the crystal itself (a
        // goal inside cover ends at its edge on the walker's side: coming at the hall from behind, the route bot stopped outside its wall).
        crystals.push({ x: r2(front.x), z: r2(front.z) });
        pill('great', cr, 1.0, 5.2);
        break;
      }
      case 'rest':
        for (const s of [-1, 1]) for (const t of [-6.2, 0, 6.2]) pill('hut', Q(s * 5 - 1.2, t), 1.6, 2.4);
        pill('timber', Q(0.5, 9.6), 1.0, 1.6); pill('crate', Q(2, -9.6), 0.8, 1.2);
        break;
      case 'yard':
        if (p.id === 'camp') break;
        pill('cart', Q(3.4, -1.6), 1.5, 1.3); pill('timber', Q(-4.6, 1.6), 1.1, 1.6); pill('timber', Q(1.2, 5.6), 1.1, 1.6);
        pill('column', Q(-5.4, -5), 0.8, 4.6); pill('column', Q(5.2, 4.8), 0.8, 4.6);
        break;
      case 'shore':
        pill('post', Q(5.2, -3.2), 0.4, 2.6); pill('post', Q(5.2, 3.2), 0.4, 2.6); pill('crate', Q(2, -5.4), 0.8, 1.2); pill('crate', Q(2.6, 5), 0.8, 1.2);
        pill('timber', Q(-1.5, 6.5), 1.0, 1.6);
        break;
      case 'pools':
        pill('rock', Q(-5, -6), 1.3, 1.8); pill('rock', Q(6, -5), 1.4, 2.2); pill('rock', Q(4, 6.2), 1.2, 1.6); pill('crystal', Q(6.6, 1), 0.9, 2.4); pill('crystal', Q(-6, 4.4), 0.8, 2.0);
        break;
      case 'shaft':
        // a timber head-frame over the hole (on the outer side), stacks of timber
        for (const [a, b] of [[1.2, -2.2], [1.2, 2.2], [5.6, -2.2], [5.6, 2.2]]) pill('post', Q(a, b), 0.4, 4.2);
        pill('timber', Q(-3, 4.6), 1.0, 1.6); pill('timber', Q(-2.6, -4.8), 1.0, 1.6);
        break;
      case 'well':
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; pill('rock', add(p.c, { x: Math.cos(a), z: Math.sin(a) }, 5.6), 0.6, 0.8); }
        break;
    }
    L.reserve(p.c, p.r + 1.5);
    L.reserve(p.stand, 3);
  }

  // --- roads (the mine's tracks): the camp to the first and last outer place; a ring through the outer places; spokes to the inner --
  const edge = (p: Place, to: V) => { const e = add(p.c, unit({ x: to.x - p.c.x, z: to.z - p.c.z }), p.r - 1); return { x: r2(e.x), z: r2(e.z) }; };
  const campW: V = C(-2.5, -6), campE: V = C(3, -6);
  const byBearing = (p: Place) => { const b = (Math.atan2(p.c.x, -p.c.z) * 180) / Math.PI; return b < -150 ? b + 360 : b; };
  const outer = places.filter((p) => p.kind !== 'yard' && p.kind !== 'shaft' && p.kind !== 'well').sort((a, b) => byBearing(a) - byBearing(b));
  const inner = places.filter((p) => !outer.includes(p));
  const roads: V[][] = [L.road(campW, edge(outer[0], campW), 1, 4), L.road(campE, edge(outer[outer.length - 1], campE), 1, 4)];
  for (let i = 1; i < outer.length; i++) roads.push(L.road(edge(outer[i - 1], outer[i].c), edge(outer[i], outer[i - 1].c), 2, 5));
  const middle: V = { x: r2(range(-5, 5)), z: r2(range(-4, 4)) };
  for (const p of inner) {
    const near = outer.reduce((b, q) => (dist(q.c, p.c) < dist(b.c, p.c) ? q : b));
    roads.push(L.road(edge(near, p.c), edge(p, near.c), 1, 3));
    roads.push(L.road(edge(p, middle), middle, 1, 3));
  }
  roads.push(L.road(C(0, -7), middle, 2, 5)); // the camp to the middle
  roads.push(L.road(middle, add(lairDoor, { x: 0, z: 6 }), 2, 4)); // the middle to the lair
  L.reserve(middle, 4);

  const lurkers = home ? [H2, H3, Y] : [H2, H3, Y]; // the packs with lurkers in them (the dark wakes them from 15 m)
  const packSpots = packIds.map((id) => P(id).c);
  const farFromLurkers = (q: V, d = LURK) => lurkers.every((p) => dist(p.c, q) >= d);
  const farFromPacks = (q: V, d = 14) => packSpots.every((s) => dist(s, q) >= d);

  // --- doors and the spots of the quests, the people, the secrets ---------------------------------------------------------------
  const gate = L.reserve(L.spot(C(pick([-16, 16]), 6), 2, 2.2), 3.5);
  const trial = L.reserve(L.spot(at(range(-150, -132), 0.85), 4, 2), 3.5);
  const rivalDoor = home ? null : L.reserve(L.spot(at(range(-58, -46), 0.88), 4, 2, (q) => farFromLurkers(q, 16)), 3.5);
  const rivalAt = home ? L.reserve(L.spot(C(4, -10), 1.5, 1.2), 2) : L.reserve(L.spot(add(rivalDoor!, toMid(rivalDoor!), 5), 1.5, 1.2), 2);
  const villagerAt = Vl ? L.reserve(L.spot(Vl.stand, 2, 1.2), 2) : null;
  const hold = L.reserve(L.spot(home ? add(Wl!.c, toMid(Wl!.c), -11) : Sr.stand, 4, 4, (q) => farFromLurkers(q, LURK + 4) && farFromPacks(q, 22)), 5);
  // Caches and the lore stone off the packs' ground (floor 32's first bake: Bram fell three times fetching caches by the halls).
  // Also off a hall's back and the rock fall: the route bot picks up a cache within 14 m of it on the way, and one behind a wall, near in
  // a straight line and far on foot, had it turning between the cache and its quest for good (floor 31's second bake).
  const lairSegs: [V, V][] = [[{ x: -24, z: lairZ }, { x: 24, z: lairZ }]];
  const clear = (q: V) => farFromLurkers(q, LURK + 2) && farFromPacks(q, 16) && halls.every((h) => dist(h.c, q) >= 20) && q.z > lairZ + 4 && lairSegs.every(([a, b]) => segDist(q, a, b) >= 12);
  const lore = L.reserve(L.spot(at(range(150, 165), 0.82), 4, 1.5, clear), 2.5);
  const caches = [at(range(-170, -155), 0.86), at(range(-95, -85), 0.9), at(range(-32, -14), 0.58), at(range(14, 32), 0.58), at(range(70, 80), 0.6), at(range(140, 150), 0.88)]
    .map((p) => L.reserve(L.spot(p, 4, 1.5, clear), 2.5));

  // Two named enemies (floor 31: the Pale One alone): one walks a loop round the middle, one the west side. Their ways are kept clear.
  // Small loops walked slowly: a named enemy's home is where its patrol is now (packs.ts), and it gives up 24 m from it, so on a loop 50 to
  // 75 m round (the first bake's) a slow fight drifted from it, it walked off healing, and a melee hero never felled it (floor 34, Bram).
  const loop = (c: V, ok: (q: V) => boolean) => [45, 135, 225, 315].map((a) => L.spot(add(c, polar(a + range(-15, 15), range(8, 10))), 2, 2, ok));
  const patrol1: V[] = loop(middle, (q) => farFromPacks(q, 16));
  for (let i = 0; i < 4; i++) L.lane(patrol1[i], patrol1[(i + 1) % 4], 1.8);
  const patrol2: V[] = home ? [] : loop(at(range(-95, -70), 0.5), (q) => packSpots.every((s) => dist(s, q) > 20));
  for (let i = 0; i < patrol2.length; i++) L.lane(patrol2[i], patrol2[(i + 1) % patrol2.length], 1.8);
  const patrol2Loop = patrol2;
  const patrolPts = [...patrol1, ...patrol2];

  // Waystones: one by each place but the yard, on the camp's side of it, clear of the packs (and further from the lurkers, whom the dark
  // wakes: a fall wakes the hero at the last stone, and one beside a pack is a loop of falls).
  const stoneNear = home ? [H1, Y, Po, H2, H3, Sh] : [H1, Vl!, H2, H3, Po, Sh];
  const stones = stoneNear.map((p) => {
    const lurk = lurkers.includes(p) ? 23 : 16;
    return L.reserve(L.spot(add(p.c, toMid(p.c), lurk), 3, 1.5, (q) => farFromPacks(q, 15) && farFromLurkers(q) && patrolPts.every((s) => dist(s, q) >= 10)), 2.5);
  });

  /** Ground kept open round the things the bot picks up on its way: no ridge within 16 m of them. */
  const open = [...caches, ...stones, lore];

  // The lead: someone walks from the shaft to the camp along the roads (floor 31 has none).
  const leadFrom = add(Sh.stand, toMid(Sh.c), 4);
  const leadPath = home ? [] : roadRoute(roads, add(Sh.stand, toMid(Sh.c), 5), C(0, -3)).map((p) => ({ x: r2(p.x), z: r2(p.z) }));
  if (!home) leadPath.push(C(0, -3));
  for (let i = 1; i < leadPath.length; i++) L.lane(leadPath[i - 1], leadPath[i], 1.5);
  const leadNpc = pick(NPCS);
  // Tempo's race (floor 31): from by the camp to the echo well, along the roads.
  const echo = Wl ? L.reserve(Wl.stand, 3) : null;
  const raceRoute = Wl ? roadRoute(roads, rivalAt, echo!).map((p) => ({ x: r2(p.x), z: r2(p.z) })) : [];
  if (Wl) { raceRoute.unshift(rivalAt); raceRoute.push(echo!); }
  const nearLurk = (path: V[], d: number) => path.some((p, i) => i > 0 && lurkers.some((h) => segDist(h.c, path[i - 1], p) < d));
  if (nearLurk(leadPath, 17)) throw new Error(`floor ${n}: the lead's road passes a pack of lurkers`);
  if (nearLurk(raceRoute, 17)) throw new Error(`floor ${n}: the race passes a pack of lurkers`);

  // The great shards: the first in its cradle at the camp, each next one at the stand of the hall before.
  const shardAt = [cradle, H1.stand, H2.stand];

  // --- ridges of rock: they split the ground into chambers, the roads are the passages between them ---------------------------------
  const ridgeWant = 20 + Math.round(6 * k);
  for (let i = 0, made = 0; i < 6000 && made < ridgeWant; i++) {
    const c = polar(range(-180, 180), Math.sqrt(rnd()) * 128), len = range(8, 18), a = rnd() * Math.PI, r = range(1.3, 2.2);
    const d = { x: Math.cos(a) * len * 0.5, z: Math.sin(a) * len * 0.5 }, p0 = add(c, d, -1), p1 = add(c, d);
    const pts = Array.from({ length: Math.ceil(len / 1.5) + 1 }, (_, j) => { const t = j / Math.ceil(len / 1.5); return { x: p0.x + (p1.x - p0.x) * t, z: p0.z + (p1.z - p0.z) * t }; });
    if (pts.some((q) => inside(rim, q) < r + 4 || L.inKeep(q, r + 2.2) || L.hitsCover(q, r + 3.2) || open.some((o) => dist(o, q) < 16 + r))) continue;
    if (c.z > cz - 18 && Math.abs(c.x) < 30) continue; // keep the camp's own chamber open
    // tall ones away from the south (the camera looks north: a tall rock south of the hero hides it)
    wall('ridge', p0, p1, r, r2(range(2.6, 4.2) + (c.z < 0 ? 1.2 : 0)));
    made++;
  }

  // --- glowing pools let into the floor: looks only, in the open ----------------------------------------------------------------
  const pools: { x: number; z: number; rx: number; rz: number; rot: number }[] = [];
  for (const [dO, dT, rx, rz] of [[-2, -2.5, 3.2, 1.9], [2.6, 3, 2.6, 1.6]]) {
    const out = unit(Po.c), tan = { x: -out.z, z: out.x }, q = add(add(Po.c, out, dO), tan, dT);
    pools.push({ x: r2(q.x), z: r2(q.z), rx, rz, rot: 0.3 });
  }
  for (let i = 0; i < 3000 && pools.length < 10; i++) {
    const c = polar(range(-180, 180), Math.sqrt(rnd()) * 120), rx = range(1.6, 3.2), rz = rx * range(0.5, 0.8);
    if (inside(rim, c) < rx + 3 || L.inKeep(c, rx + 1) || L.hitsCover(c, rx + 1.5) || pools.some((f) => dist(f, c) < 14)) continue;
    pools.push({ x: r2(c.x), z: r2(c.z), rx: r2(rx), rz: r2(rz), rot: r2(range(-1.5, 1.5)) });
  }

  // --- scattered cover in what is left: stalagmites, rocks, crystals, so a way across has to bend ----------------------------------
  const want = 56 + Math.round(10 * k);
  for (let i = 0, made = 0; i < 8000 && made < want; i++) {
    const p = polar(range(-180, 180), Math.sqrt(rnd()) * 138);
    const u = rnd(), look: DeepLookKind = u < 0.4 ? 'stal' : u < 0.72 ? 'rock' : 'crystal';
    const r = look === 'stal' ? range(0.8, 1.4) : look === 'rock' ? range(1.1, 1.8) : range(0.8, 1.2);
    if (inside(rim, p) < 3 + r || L.inKeep(p, r + 0.4) || L.hitsCover(p, r + 3.2)) continue;
    pill(look, p, r, look === 'stal' ? range(2.4, 4.4) : look === 'rock' ? r * range(1.1, 1.5) : range(1.8, 3.2));
    made++;
  }

  // --- enemies (floor 31's), packs -----------------------------------------------------------------------------------------------
  // The roaming enemies' growth is the game's own by the floor's tuned number (`tunedAs` below, `floorNumbers` in src/tower/floors.ts):
  // from 4 (floor 31) to 5 (floor 40), so the War (floor 41, tuned as 5) follows on with no step. No growth of the generator's own on top.
  const shard = (x: number) => Math.round(x * (1 + 0.04 * (n - 31)));
  const named1 = home ? 'The Pale One' : NAMED[(2 * (n - 32)) % NAMED.length], named2 = NAMED[(2 * (n - 32) + 1) % NAMED.length];
  const look = (s: string) => s as EnemySpec['look'];
  const enemies: Record<string, EnemySpec> = {
    mite: { id: 'mite', name: 'Shard mite', blurb: 'Comes in a swarm. Small and quick.', look: look('mite'), melee: true, hp: 34, share: 0.013, every: 1.2, speed: 4.0, scale: 1.1, shards: shard(3), color: '#9af0ff' },
    lurker: { id: 'lurker', name: 'Lurker', blurb: 'Waits in the dark and leaps.', look: look('lurker'), melee: true, hp: 65, share: 0.03, every: 3.2, speed: 5.4, scale: 1.2, shards: shard(7), color: '#d8e8ff' },
    golem: { id: 'golem', name: 'Crystal golem', blurb: 'Slow. Throws a bolt back.', look: look('golem'), melee: false, hp: 240, share: 0.04, every: 3.2, speed: 1.7, range: 9, scale: 1.4, shards: shard(9), color: '#7ad8ff' },
    thief: { id: 'thief', name: 'The Lantern Thief', blurb: 'Carries the only lamp in the Deep that is not a crystal.', look: look('thief'), melee: true, hp: 430, share: 0.045, every: 1.7, speed: 3.4, scale: 1.5, shards: shard(30), color: '#ffb84a' },
    ...(home
      ? { pale: { id: 'pale', name: 'The Pale One', blurb: 'Walks the Deep and strikes hard.', look: look('pale'), melee: true, hp: 560, share: 0.055, every: 2.2, speed: 2.6, scale: 1.4, shards: 45, color: '#e6f4ff' } }
      : {
        named1: { id: 'named1', name: named1, blurb: 'Walks the middle of the Deep and strikes hard.', look: look('pale'), melee: true, hp: 560, share: 0.055, every: 2.2, speed: 2.6, scale: 1.4, shards: shard(45), color: '#e6f4ff' },
        named2: { id: 'named2', name: named2, blurb: 'Walks the west of the Deep, slow and heavy.', look: look('golem'), melee: true, hp: 520, share: 0.055, every: 2.4, speed: 2.2, scale: 2.0, shards: shard(40), color: '#b8a8ff' },
      }),
  };
  const moreMites = n >= 36 ? 1 : 0;
  const packs: PackDef[] = home
    ? [
      { id: 'h1', at: H1.c, leash: 24, mix: [{ kind: 'mite', n: 3 }, { kind: 'golem', n: 1 }] },
      { id: 'yard', at: Y.c, leash: 24, mix: [{ kind: 'lurker', n: 2 }, { kind: 'mite', n: 2 }] },
      { id: 'h2', at: H2.c, leash: 24, mix: [{ kind: 'lurker', n: 2 }, { kind: 'mite', n: 2 }] },
      { id: 'h3', at: H3.c, leash: 24, mix: [{ kind: 'lurker', n: 2 }, { kind: 'golem', n: 1 }] },
      { id: 'pools', at: Po.c, leash: 24, mix: [{ kind: 'mite', n: 2 }], elite: 'thief' },
      { id: 'pale', at: patrol1[0], mix: [{ kind: 'pale', n: 1 }], named: { name: 'The Pale One', speed: 1.0, patrol: patrol1, bounty: { shards: 45, relic: true } } },
    ]
    : [
      { id: 'a', at: H1.c, leash: 24, mix: [{ kind: 'mite', n: 3 + moreMites }, { kind: 'golem', n: 1 }] },
      { id: 'b', at: H2.c, leash: 24, mix: [{ kind: 'lurker', n: 2 }, { kind: 'mite', n: 2 + moreMites }] },
      { id: 'c', at: H3.c, leash: 24, mix: [{ kind: 'lurker', n: 2 }, { kind: 'golem', n: 1 }, { kind: 'mite', n: moreMites }].filter((x) => x.n > 0) },
      { id: 'y', at: Y.c, leash: 24, mix: [{ kind: 'lurker', n: 2 }, { kind: 'mite', n: 2 }] },
      // the elite's pack keeps two mites (with a third from floor 36 Lyra lost to it, healed at the camp and lost again: floor 36)
      { id: 'd', at: Po.c, leash: 24, mix: [{ kind: 'mite', n: 2 }], elite: 'thief' },
      { id: 'named1', at: patrol1[0], mix: [{ kind: 'named1', n: 1 }], named: { name: named1, speed: 1.0, patrol: patrol1, bounty: { shards: shard(45), relic: true } } },
      { id: 'named2', at: patrol2Loop[0], mix: [{ kind: 'named2', n: 1 }], named: { name: named2, speed: 1.0, patrol: patrol2Loop, bounty: { shards: shard(40), relic: false } } },
    ];

  // --- the set pieces: the ruler (the Prism Mother's moves, another body and name), the gate, the trial, the rival ------------------
  // Floor 40 is the chapter's crown: behind the lair is a Raid boss, alone (pieces/core.ts `crownFight`): the Sun Warden at tier 2.
  const crown = n === 40 ? ('sun' as const) : undefined;
  const [rulerName, rulerTitle] = home ? ['The Prism Mother', 'Beams in the dark'] : crown ? ['The Sun Warden', 'Keeper of the Sun Court'] : RULERS[(n - 32) % RULERS.length];
  const extra: [string, MoveSpec] = pick([
    ['rain', { use: 'stones', name: 'Crystal Rain', share: 0.06, count: 4, cooldown: 7 }],
    ['split', { use: 'halves', name: 'The Split Light', share: 0.08, cooldown: 16 }],
    ['shards', { use: 'volley', name: 'Shard Volley', share: 0.05, cooldown: 6 }],
  ] as [string, MoveSpec][]);
  const ruler: RulerDef = {
    name: rulerName, title: rulerTitle, stand: rulerBody, tint: TINTS[(n - 32 + TINTS.length) % TINTS.length], scale: r2(range(2.4, 2.8)), hp: Math.round((3600 * (1 + 0.02 * (n - 31))) / 50) * 50, speed: 0, stagger: { max: 100, kneel: 5 },
    room: 'cavern',
    moves: {
      beams: { use: 'volley', name: pick(['Prism Beams', 'Glass Beams', 'Cold Beams']), share: 0.06, cooldown: 4 },
      fan: { use: 'fan', share: 0.05 },
      stars: { use: 'stones', name: pick(['Falling Light', 'Falling Glass', 'Starfall']), share: 0.06, light: true, count: 3, cooldown: 6 },
      rake: { use: 'spokes', name: pick(['Turning Light', 'The Wheel of Light']), share: 0.1, cooldown: 14 },
      [extra[0]]: extra[1],
    },
    phases: [
      { name: `${rulerName} wakes`, at: 1, moves: ['beams', 'fan'], gap: [1.6, 2.4] },
      { name: 'The beams turn', at: 0.66, moves: ['beams', 'fan', 'stars', extra[0]], gap: [1.4, 2.2] },
      { name: 'The light goes out', at: 0.33, moves: ['beams', 'fan', 'stars', 'rake', extra[0]], gap: [1.2, 1.9] },
    ],
    sentries: { look: 'crystal', spots: [[45, 8.8], [135, 8.8], [225, 8.8], [315, 8.8]], hp: 150, fall: { stagger: 30 } },
    dark: { from: 2 },
    line: crown ? 'A Raid boss, alone: read its sun and keep moving' : 'Break a crystal to leave a gap with no beam in it',
  };
  const twists = ['swift', 'giant', 'warded'] as const;
  const pieces: PiecesDef = {
    floor: n, hard: r2(1.4 + 0.016 * (n - 31)), // floor 31 is 1.4, floor 40 1.54, the War (floor 41) 1.55
    ruler,
    gate: { hero: gateHero, arena: 'cavern', level: 3, twist: { kind: 'shift', name: 'The roof gives way', early: 29 } },
    trial: { kind: (['gauntlet', 'break', 'hold', 'horde'] as const)[n % 4], height: 8 + Math.floor((n - 31) / 5), twist: 'dark' },
    ...(crown ? { crown, crownTier: 2 } : {}),
    ...(home ? {} : { rival: { hero: rivalHero, twist: twists[n % 3], line: `${rivalHero} waits in the dark`, height: 8 + Math.floor((n - 31) / 5) } }),
  };

  // --- people, quests, doors, secrets (offsets still; the world's coordinates come at the end) ----------------------------------
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const mid = (s: string) => s.replace(/^The /, 'the ');
  const poss = (s: string) => (s.endsWith('s') ? `${s}’` : `${s}’s`);
  const facing = (p: V) => r2(Math.atan2(-p.x, -p.z));
  const reward = (s: number, more: { boon?: boolean; relic?: boolean } = {}) => ({ shards: shard(s), ...more });
  const things = (i: number) => [{ id: `crystal${i + 1}`, at: crystals[i] }];
  const main: QuestDef = home
    ? {
      id: 'main', name: 'The Three Crystals', giver: 'mabel', main: true,
      intro: ['Take the great shard from the cradle by my camp to the first crystal, in the west hall. Stay by it and it wakes and lights the hall. Each hall holds the next shard. Wake all three, then the rock fall will let you through.'],
      steps: [
        { verb: 'carry', text: 'Carry the great shard from the camp to the first crystal', item: 'shard', itemName: 'A great shard', toName: 'the first crystal', from: shardAt[0], to: crystals[0], r: 2.2 },
        { verb: 'light', text: 'Stay by the first crystal until it wakes', things: things(0), seconds: 2 },
        { verb: 'carry', text: 'Carry the next great shard to the second crystal', item: 'shard', itemName: 'A great shard', toName: 'the second crystal', from: shardAt[1], to: crystals[1], r: 2.2 },
        { verb: 'light', text: 'Stay by the second crystal until it wakes', things: things(1), seconds: 2 },
        { verb: 'carry', text: 'Carry the last great shard to the third crystal', item: 'shard', itemName: 'A great shard', toName: 'the third crystal', from: shardAt[2], to: crystals[2], r: 2.2 },
        { verb: 'light', text: 'Stay by the third crystal until it wakes', things: things(2), seconds: 2 },
        { verb: 'open', text: 'Go to the rock fall in the north: the halls are lit', door: 'lair' },
      ],
      outro: ['Three halls lit, and you can see the road. The rock fall has moved. The Prism Mother is behind it. Take your time, then go in.'],
      reward: { shards: 60, boon: true },
    }
    : {
      id: 'main', name: pick(['The Three Crystals', 'The Sleeping Halls', 'Light the Deep']), giver: 'keeper', main: true,
      intro: [`Three great crystals went dark in ${lower(H1.name)}, ${lower(H2.name)} and ${lower(H3.name)}, and with them the way. Clear each hall, then carry a great shard to its crystal and stay by it until it wakes. The first shard lies in the cradle by my camp; each hall holds the next. Wake all three and the rock fall in the north lets you through to ${mid(rulerName)}.`],
      steps: [
        // Each hall's pack first: a hit drops a carried shard, and the dark wakes lurkers from 15 m (the sea's lesson: the key's guard first).
        { verb: 'fell', text: `Clear ${lower(H1.name)}`, packs: ['a'] },
        { verb: 'carry', text: 'Carry the great shard from the camp to the first crystal', item: 'shard', itemName: 'A great shard', toName: 'the first crystal', from: shardAt[0], to: crystals[0], r: 2.2 },
        { verb: 'light', text: 'Stay by the first crystal until it wakes', things: things(0), seconds: 2 },
        { verb: 'fell', text: `Clear ${lower(H2.name)}`, packs: ['b'] },
        { verb: 'carry', text: 'Carry the next great shard to the second crystal', item: 'shard', itemName: 'A great shard', toName: 'the second crystal', from: shardAt[1], to: crystals[1], r: 2.2 },
        { verb: 'light', text: 'Stay by the second crystal until it wakes', things: things(1), seconds: 2 },
        { verb: 'fell', text: `Clear ${lower(H3.name)}`, packs: ['c'] },
        { verb: 'carry', text: 'Carry the last great shard to the third crystal', item: 'shard', itemName: 'A great shard', toName: 'the third crystal', from: shardAt[2], to: crystals[2], r: 2.2 },
        { verb: 'light', text: 'Stay by the third crystal until it wakes', things: things(2), seconds: 2 },
        { verb: 'open', text: 'Go to the rock fall in the north: the halls are lit', door: 'lair' },
      ] as Step[],
      outro: [`Three halls lit, and you can see the road. The rock fall has moved. ${mid(rulerName).replace(/^the /, 'The ')} is behind it. Take your time, then go in.`],
      reward: reward(80, { boon: true }),
    };
  const people: (Omit<PersonDef, 'at'> & { at: V })[] = home
    ? [
      { id: 'mabel', hero: 'Mabel', name: 'Mabel', role: 'keeper', at: C(-2.6, 2), face: 0.4, greet: ['Mind the dark, climber. Three great crystals in these halls went out, and with them the way. Carry a great shard to each and they wake. The Prism Mother sits behind the rock fall in the north.'], quests: ['main', 'bounty'] },
      { id: 'isolde', hero: 'Isolde', name: 'Isolde', role: 'giver', at: C(5.5, -0.7), face: -0.5, greet: ['I lost my lantern, and my satchel with it. Without light I am only a cold woman in a cave. Perhaps you can fetch them.'], quests: ['lantern', 'lamp'] },
      { id: 'tempo', hero: 'Tempo', name: 'Tempo', role: 'rival', at: rivalAt, face: 3.1, greet: [], quests: [] },
      { id: 'ledger', hero: 'Mr. Ledger', name: 'Mr. Ledger', role: 'trader', at: C(-5.5, 5.5), face: 0.6, greet: ['Shards for what you need. Light is dear down here, and I price it so.'], quests: [] },
    ]
    : [
      { id: 'keeper', hero: keeperHero, name: keeperHero, role: 'keeper', at: C(-2.6, 2), face: 0.4, greet: [`Mind the dark, climber. Three great crystals went out in these halls, and ${mid(rulerName)} sits behind the rock fall in the far north. The Deep is wide: keep to the tracks.`], quests: ['main', 'bounty1', 'bounty2'] },
      { id: 'giver', hero: giverHero, name: giverHero, role: 'giver', at: C(5.5, -0.7), face: -0.5, greet: [pick(['Light is dear down here. Help me keep a little of it.', 'I have work, if you have a light. The dark does not wait.', 'Everything I own is somewhere in these halls. Help me find it.'])], quests: ['g1', 'g2'] },
      { id: 'villager', hero: villagerHero, name: villagerHero, role: 'giver', at: villagerAt!, face: facing(villagerAt!), greet: [`You came all the way to ${lower(Vl!.name)} in the dark? Then you can help.`], quests: ['g3'] },
      { id: 'rival', hero: rivalHero, name: rivalHero, role: 'rival', at: rivalAt, face: facing(rivalAt), greet: [], quests: [] },
      { id: 'trader', hero: traderHero, name: traderHero, role: 'trader', at: C(-5.5, 5.5), face: 0.6, greet: ['Shards for what you need. Light is dear down here, and I price it so.'], quests: [] },
    ];
  const quests: QuestDef[] = home
    ? [
      main,
      { id: 'bounty', name: 'The Pale One', giver: 'mabel', intro: ['Something pale walks the middle of the Deep, round the cart yard. It does not need light. Fell it and the dark is a little less.'], steps: [{ verb: 'fell-named', text: 'Fell the Pale One', pack: 'pale' }], outro: ['A relic from the Pale One. Keep it.'], reward: { shards: 45, relic: true } },
      {
        id: 'lantern', name: 'The Lost Lantern', giver: 'isolde', intro: ['My satchel fell at the old shaft. The thief took my lantern to the glow pools in the east. Bring my light home.'],
        steps: [{ verb: 'reach', text: 'Find Isolde’s satchel at the old shaft', at: Sh.stand, r: 3 }, { verb: 'fell', text: 'Take the lantern back from the Lantern Thief at the glow pools', packs: ['pools'] }],
        outro: ['My lantern! The thief is gone and my hands are warm. Take this, from the Deep itself.'], reward: { shards: 40, boon: true },
      },
      { id: 'lamp', name: 'The Survey Lamp', giver: 'isolde', intro: ['The old survey lamp stands east of the yard. Hold it while the swarm comes, and the Deep is mapped.'], steps: [{ verb: 'hold', text: 'Hold the survey lamp while the swarm comes', at: hold, r: 3.6, seconds: 18, waves: { kinds: ['mite', 'mite'], every: 8 } }], outro: ['The lamp burned through. I have it on the map. Take your share.'], reward: { shards: 35, boon: true } },
    ]
    : [
      main,
      { id: 'bounty1', name: named1, giver: 'keeper', intro: [`${named1} walks the middle of the Deep. It does not need light. Fell it and the dark is a little less.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named1)}`, pack: 'named1' }], outro: ['A relic from the dark. Keep it.'], reward: reward(45, { relic: true }) },
      { id: 'bounty2', name: named2, giver: 'keeper', intro: [`${named2} walks the west of the Deep. Nobody goes to ${lower(Vl!.name)} while it does.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named2)}`, pack: 'named2' }], outro: ['The track is open again.'], reward: reward(40) },
      {
        id: 'g1', name: 'The Lost Lantern', giver: 'giver', intro: [`My satchel fell at ${lower(Sh.name)}. The thief took my lantern to ${lower(Po.name)}. Bring my light home.`],
        steps: [{ verb: 'reach', text: `Find the satchel at ${lower(Sh.name)}`, at: Sh.stand, r: 3 }, { verb: 'fell', text: `Take the lantern back from the Lantern Thief at ${lower(Po.name)}`, packs: ['d'] }] as Step[],
        outro: ['My lantern! The thief is gone and my hands are warm. Take this, from the Deep itself.'], reward: reward(40, { boon: true }),
      },
      { id: 'g2', name: 'The Survey Lamp', giver: 'giver', intro: [`The old survey lamp stands at ${lower(Sr.name)}, by the black water. Hold it while the swarm comes, and the Deep is mapped.`], steps: [{ verb: 'hold', text: 'Hold the survey lamp while the swarm comes', at: hold, r: 3.6, seconds: 18 + Math.round(4 * k), waves: { kinds: ['mite', 'mite', 'mite'], every: 8 } } as Step], outro: ['The lamp burned through. I have it on the map. Take your share.'], reward: reward(35, { boon: true }) },
      { id: 'g3', name: `Bring ${leadNpc} Up`, giver: 'villager', intro: [`${leadNpc} went down ${lower(Sh.name)} and will not come up alone. Walk them to the camp; stand close and they follow the track.`], steps: [{ verb: 'lead', text: `Lead ${leadNpc} from ${lower(Sh.name)} to the camp`, name: leadNpc, from: leadFrom, r: 2.5, path: leadPath } as Step], outro: [`${leadNpc} is safe, and pays in what they have.`], reward: reward(45) },
    ];
  const doors: (Omit<DoorDef, 'at'> & { at: V })[] = [
    { id: 'lair', piece: 'ruler', name: crown ? 'The Sun Court' : `${poss(rulerName)} door`, at: lairDoor, r: 2.2, wall: { ax: -3.4, az: lairZ, bx: 3.4, bz: lairZ, r: 0.5, height: 4.4 }, locked: `Fallen rock blocks the way. ${keeperHero} has a quest about the crystals.` },
    { id: 'trial', piece: 'trial', name: home ? 'The Dark Vault' : pick(['The Dark Vault', 'The Sealed Gallery', 'The Ore Cellar']), at: trial, r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: gate, r: 2.2, needs: { won: 'ruler' }, locked: `The gate is sealed. Its warden answers only once ${mid(rulerName)} has fallen.` },
    ...(rivalDoor ? [{ id: 'rival', piece: 'rival' as const, name: `${poss(rivalHero)} gallery`, at: rivalDoor, r: 2, locked: '' }] : []),
  ];
  const cacheDefs = caches.map((c, i) => ({ id: `c${i + 1}`, at: c, shards: shard(home ? [25, 30, 20, 30, 25, 20][i] : [25, 30, 20, 30, 25, 20][i]), ...(i === 2 || i === 5 ? { boon: true } : {}) }));
  const stoneNames = home ? ['The first hall stone', 'The yard stone', 'The pools stone', 'The second hall stone', 'The third hall stone', 'The shaft stone'] : stoneNear.map((p) => `The ${p.name.replace(/^The /, '').toLowerCase()} stone`);
  const stoneDefs = stones.map((s, i) => ({ id: `w${i + 1}`, name: stoneNames[i], at: s }));
  const loreText = LORE[(n - 31) % LORE.length];

  // --- checks: everything can be walked to (as `_worldCheck` floods it), and no spot has more than six units near it ---------------
  const ring = Math.ceil(Math.max(...rim) + 1.5);
  const spots: { name: string; p: V }[] = [{ name: 'start', p: C(0, 5.5) }, { name: 'camp', p: C(0, 2) }];
  for (const p of people) spots.push({ name: `person ${p.id}`, p: p.at });
  for (const p of packs) spots.push({ name: `pack ${p.id}`, p: p.named ? p.named.patrol[0] : p.at });
  for (const p of packs) if (p.named) p.named.patrol.forEach((q, i) => spots.push({ name: `patrol ${p.id}.${i}`, p: q }));
  stones.forEach((s, i) => spots.push({ name: `waystone w${i + 1}`, p: s }));
  caches.forEach((s, i) => spots.push({ name: `cache c${i + 1}`, p: s }));
  spots.push({ name: 'lore', p: lore });
  for (const d of doors) if (!d.wall) spots.push({ name: `door ${d.id}`, p: d.at });
  for (const q of quests) q.steps.forEach((s, i) => {
    const t = `${q.id}.${i + 1}`;
    if ('at' in s) spots.push({ name: `${t} at`, p: s.at });
    if ('from' in s) spots.push({ name: `${t} from`, p: s.from });
    if ('to' in s) spots.push({ name: `${t} to`, p: s.to });
    if (s.verb === 'light') s.things.forEach((x) => spots.push({ name: `${t} ${x.id}`, p: x.at }));
    if (s.verb === 'lead') s.path.forEach((x, j) => spots.push({ name: `${t} road ${j}`, p: x }));
  });
  if (echo) spots.push({ name: 'rival goal', p: echo });
  const cut = unreachable(L.cover, ring, C(0, 5.5), spots);
  for (const [name, p] of [...caches.map((c, i) => [`cache c${i + 1}`, c] as const), ...stones.map((w, i) => [`waystone w${i + 1}`, w] as const), ['lore', lore] as const]) {
    if (detour(L.cover, p, 16, (q) => inside(rim, q) > 1.5)) cut.push(`${name} (a long way round to it)`);
  }
  if (cut.length) throw new Error(`floor ${n}: cannot reach ${cut.slice(0, 4).join(', ')}`);
  let most = 0;
  for (let x = -ring; x <= ring; x += 3) for (let z = -ring; z <= ring; z += 3) {
    let sum = 0;
    for (const p of packs) { const h = p.named ? p.named.patrol[0] : p.at; if (Math.hypot(h.x - x, h.z - z) < 18) sum += p.mix.reduce((a, q) => a + q.n, 0) + (p.elite ? 1 : 0); }
    most = Math.max(most, sum);
  }
  if (most > 6) throw new Error(`floor ${n}: ${most} units near one spot`);
  // No gap between two pieces of cover that a walker could half enter and wedge in (the path finder's walker is 0.5 m round).
  for (let i = 0; i < L.cover.length; i++) for (let j = i + 1; j < L.cover.length; j++) {
    const a = L.cover[i].o, b = L.cover[j].o, A0 = { x: a.ax, z: a.az }, A1 = { x: a.bx, z: a.bz }, B0 = { x: b.ax, z: b.az }, B1 = { x: b.bx, z: b.bz };
    const gap = Math.min(segDist(A0, B0, B1), segDist(A1, B0, B1), segDist(B0, A0, A1), segDist(B1, A0, A1)) - a.r - b.r;
    if (gap > 0.05 && gap < 1.2) throw new Error(`floor ${n}: a ${gap.toFixed(2)} m gap at ${r2(a.ax)}, ${r2(a.az)}`);
  }

  // --- into the world: mirrored if the water is west, moved to the ring's middle ---------------------------------------------------
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
  const lookOut = {
    rim: m === 1 ? rim : mirrorRim(rim),
    places: [camp, ...places].map((p) => ({ id: p.id, kind: p.id === 'camp' ? 'camp' : p.kind, ...X(p.c), r: p.r })),
    paths: roads.map((r) => r.map(W.off)),
    // The shared `Look` (zone.ts) has no word for the Deep's kinds: each piece carries the nearest one, its own is in `kinds`.
    pieces: L.cover.map((p) => ({ ...W.piece(p), look: NEAREST[p.look as unknown as DeepLookKind] })),
    kinds: L.cover.map((p) => p.look as unknown as DeepLookKind),
    pools: pools.map((f) => ({ ...X(f), rx: f.rx, rz: f.rz, rot: r2(m * f.rot) })),
    middle: X(middle),
    mirror: m, seed: n * 101,
  } satisfies DeepLook;
  const rival: FloorRival = home
    ? {
      hero: 'Tempo', goal: 'the echo well', mode: 'race', at: X(rivalAt), to: X(echo!), r: 3, pace: 0.45, boon: true, route: raceRoute.map(X),
      lines: ['Tempo. I run the Deep in the dark and I never trip. To the echo well in the middle of the Deep: first to stand on it wins. Care to try?'],
    }
    : { hero: rivalHero, goal: 'the gallery', mode: 'duel', at: X(rivalAt), boon: true, lines: [`Another climber, down here? I am ${rivalHero}. Walk into the gallery behind me and we see who is better. Win, and I fight beside you.`] };
  return {
    n, chapter: 'deep', seed, look: lookOut, pieces,
    floor: {
      n, id: home ? 'deep' : `deep-${nn}`, name: home ? 'The Lightless Deep' : crown ? 'The Crown of the Deep' : FLOOR_NAMES[(n - 32) % FLOOR_NAMES.length],
      blurb: home ? 'A mine whose crystals went dark. Only what shines can be seen.' : crown ? 'At the bottom of the Deep, a court of the sun keeps the way up.' : BLURBS[(n - 32) % BLURBS.length],
      tunedAs: r2(4 + (n - 31) / 9), ring, start: X(C(0, 5.5)), camp: X(C(0, 2)), places: placeDefs, par: Math.round((900 + 20 * (n - 31)) * 2.2),
      shop: { heal: 35 + 2 * (n - 31), boon: 60 + 3 * (n - 31), life: 85 + 4 * (n - 31), hint: 15 },
      law: {
        kind: 'dark', name: 'The dark',
        blurb: home
          ? 'Only crystals give light. Beyond it you see nothing, and the lurkers hunt there. A great shard you carry lights a few steps; a woken crystal lights its hall for good.'
          : `Only crystals give light. Beyond ${n >= 36 ? 'a few steps' : 'it'} you see nothing, and the lurkers hunt there. A great shard you carry lights a few steps more; a woken crystal lights its hall for good.`,
        radius: r2(8 - k), lit: r2(18 - 2 * k), lights: lights.map(X),
      },
      enemies, packs: packs.map((p) => ({ ...p, at: X(p.at), ...(p.named ? { named: { ...p.named, patrol: p.named.patrol.map(X) } } : {}) })),
      people: people.map((p) => ({ ...p, at: X(p.at), face: W.yaw(p.face) })),
      quests: quests.map((q) => ({ ...q, steps: q.steps.map(mapStep) })),
      caches: cacheDefs.map((c): CacheDef => ({ ...c, at: X(c.at) })),
      waystones: stoneDefs.map((w): WaystoneDef => ({ ...w, at: X(w.at) })),
      lore: { id: 'lore', name: 'The miners’ stone', at: X(lore), text: [...loreText] },
      doors: doors.map((d) => ({ ...d, at: X(d.at), ...(d.wall ? { wall: { ...d.wall, ax: r2(RING_X + m * d.wall.ax), az: r2(RING_Z + d.wall.az), bx: r2(RING_X + m * d.wall.bx), bz: r2(RING_Z + d.wall.bz) } } : {}) })),
      rival,
    },
  };
}

/**
 * Whether ground within `R` m of `p` in a straight line is much further on foot (behind a wall): a walk out from `p` on a 0.5 m grid,
 * a walker 0.5 m round; true when open ground within `R` (inside the outline: `onGround`) is not reached within 1.4 times its straight
 * distance and 6 m.
 */
function detour(cover: Piece[], p: V, R: number, onGround: (q: V) => boolean): boolean {
  const step = 0.5, W = R + 8, n = Math.round((2 * W) / step) + 1, body = 0.5;
  const near = cover.filter(({ o }) => segDist(p, { x: o.ax, z: o.az }, { x: o.bx, z: o.bz }) < W * 1.5 + o.r);
  const blocked = (x: number, z: number) => near.some(({ o }) => segDist({ x, z }, { x: o.ax, z: o.az }, { x: o.bx, z: o.bz }) < o.r + body);
  const at = (i: number) => -W + i * step, c = Math.round(W / step);
  const d = new Float32Array(n * n).fill(Infinity), done = new Uint8Array(n * n), bl = new Int8Array(n * n).fill(-1);
  const isBlocked = (i: number, j: number) => { const k = j * n + i; if (bl[k] < 0) bl[k] = blocked(p.x + at(i), p.z + at(j)) ? 1 : 0; return bl[k] === 1; };
  d[c * n + c] = 0;
  // Dijkstra on 8 neighbours with a bucketed queue (steps of 0.5 and 0.71 m)
  const queue: number[][] = [];
  const push = (k: number, v: number) => { const b = Math.floor(v * 4); (queue[b] ??= []).push(k); };
  push(c * n + c, 0);
  for (let b = 0; b < queue.length; b++) {
    const list = queue[b];
    if (!list) continue;
    for (let li = 0; li < list.length; li++) {
      const k = list[li];
      if (done[k]) continue;
      done[k] = 1;
      const i = k % n, j = (k - i) / n;
      for (const [di, dj, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
        const a = i + di, bb = j + dj;
        if (a < 0 || bb < 0 || a >= n || bb >= n) continue;
        const kk = bb * n + a;
        if (done[kk] || isBlocked(a, bb)) continue;
        const v = d[k] + w * step;
        if (v < d[kk] && v < 3 * W) { d[kk] = v; push(kk, v); }
      }
    }
  }
  for (let j = 0; j < n; j += 2) for (let i = 0; i < n; i += 2) {
    const x = at(i), z = at(j), s = Math.hypot(x, z);
    if (s > R || s < 2 || isBlocked(i, j)) continue;
    if (onGround({ x: p.x + x, z: p.z + z }) && d[j * n + i] > s * 1.4 + 6) return true;
  }
  return false;
}

/**
 * The spots that cannot be walked to from `start`: `_worldCheck`'s flood fill (pipeline/tools/world-tool.js) in the layout's own frame:
 * a 0.4 m grid inside the ring, an agent 0.47 m out from the cover, a spot reached when a reached cell lies within 1.6 m of it.
 */
function unreachable(cover: Piece[], ring: number, start: V, spots: { name: string; p: V }[]): string[] {
  const step = 0.4, agent = 0.47, R = ring, n = Math.ceil((2 * R) / step), B = 4, nb = Math.ceil((2 * R) / B) + 2;
  const bins: number[][] = Array.from({ length: nb * nb }, () => []);
  cover.forEach(({ o }, i) => {
    const pad = o.r + agent;
    const x0 = Math.floor((Math.min(o.ax, o.bx) - pad + R) / B), x1 = Math.floor((Math.max(o.ax, o.bx) + pad + R) / B);
    const z0 = Math.floor((Math.min(o.az, o.bz) - pad + R) / B), z1 = Math.floor((Math.max(o.az, o.bz) + pad + R) / B);
    for (let a = Math.max(0, x0); a <= Math.min(nb - 1, x1); a++) for (let b = Math.max(0, z0); b <= Math.min(nb - 1, z1); b++) bins[b * nb + a].push(i);
  });
  const blocked = (x: number, z: number) => {
    const a = Math.floor((x + R) / B), b = Math.floor((z + R) / B);
    if (a < 0 || b < 0 || a >= nb || b >= nb) return true;
    for (const i of bins[b * nb + a]) { const o = cover[i].o; if (segDist({ x, z }, { x: o.ax, z: o.az }, { x: o.bx, z: o.bz }) < o.r + agent) return true; }
    return false;
  };
  const ix = (x: number) => Math.round((x + R) / step), at = (i: number) => -R + i * step;
  const seen = new Uint8Array(n * n), q: number[] = [];
  const si = ix(start.x), sj = ix(start.z);
  seen[sj * n + si] = 1;
  q.push(si, sj);
  while (q.length) {
    const j = q.pop()!, i = q.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= n || b >= n || seen[b * n + a]) continue;
      const x = at(a), z = at(b);
      if (Math.hypot(x, z) > R - 0.7 || blocked(x, z)) continue;
      seen[b * n + a] = 1;
      q.push(a, b);
    }
  }
  const cut: string[] = [];
  for (const s of spots) {
    let ok = false;
    for (let a = -4; a <= 4 && !ok; a++) for (let b = -4; b <= 4 && !ok; b++) {
      const i = ix(s.p.x) + a, j = ix(s.p.z) + b;
      if (i >= 0 && j >= 0 && i < n && j < n && seen[j * n + i] && Math.hypot(a * step, b * step) <= 1.6) ok = true;
    }
    if (!ok) cut.push(s.name);
  }
  return cut;
}
