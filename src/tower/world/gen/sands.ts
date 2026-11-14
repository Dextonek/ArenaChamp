import type { CacheDef, DoorDef, EnemySpec, FloorDef, LawDef, PackDef, PersonDef, PlaceDef, QuestDef, Step, WaystoneDef } from '../def';
import type { MoveSpec, PiecesDef, RulerDef } from '../pieces/types';
import type { SandsDecor, SandsKind, SandsLook } from '../sandsZone';
import type { GenFloor } from './types';
import { Layout, add, dist, inside, mirrorRim, mulberry, polar, r2, r4, rimToward, roadRoute, shuffle, toMid, unit, worldOf, type V } from './core.ts';

/**
 * The Sands chapter's generator (pipeline/designs/tower-50.md): floors 22 to 30 made from floor 21's parts (the Storm Canyon: its look,
 * raiders and slingers, the storm, its kinds of quest, the Scarab Colossus's moves), and floor 21 itself grown to the same size with
 * its own people, quests and ids (`makeCanyonFloor`). Five times floor 1's ground (the user, 2026-11-14), of any outline: a wadi that
 * runs north to south, sometimes long and narrow (a canyon), sometimes wide (a basin). Run under `node` by
 * `pipeline/tools/gen-floors.ts` (22 to 30) and `pipeline/tools/gen-canyon.ts` (21); the game never runs this.
 *
 * Laid out in one frame with the open desert (the dunes) to the east and the canyon's red walls to the west and the north, and mirrored
 * for the floors whose dunes are west. The camera looks north: the camp is in the south, the lair in the north.
 */

const ROSTER = ['Ada', 'Anka', 'Auriel', 'Bo', 'Bram', 'Brannoc', 'Cantor', 'Fenna', 'Gus', 'Hank', 'Isolde', 'Kaia', 'Lyra', 'Mabel', 'Marin', 'Mortis', 'Mum', 'Nyx', 'Oblivion', 'Opaline', 'Pip', 'Sefu', 'Shiori', 'Silvane', 'Sirix', 'Tempo', 'Vesper', 'Vitriol', 'Wick', 'Zephyr'];
const RULER_BODIES = ['Sirix', 'Hank', 'Brannoc', 'Mortis', 'Bram', 'Oblivion', 'Cantor', 'Vesper', 'Isolde', 'Marin'];
const HANDMADE_GATES = ['Marin', 'Fenna', 'Sefu', 'Opaline', 'Oblivion'];

const FLOOR_NAMES = ['The Red Wadi', 'The Glass Flats', 'Caravan Rest', 'The Singing Dunes', 'The Brass Road', 'The Dry Wells', 'The Scorpion Steps', 'The Mirage Road'];
const BLURBS = ['A riverbed that forgot its river.', 'Sand the sun burnt to glass, and what walks on it.', 'Where the caravans stopped, and stayed.', 'Dunes that hum when the wind is coming.', 'An old road of brass markers, half buried.', 'Wells that answer in dust.', 'Steps cut into red stone, and what nests on them.', 'A road that is never where it looks.'];
const RULERS: [string, string][] = [['The Scarab King', 'Crowned in a shell'], ['The Dune Colossus', 'A hill that walks'], ['The Brass Sphinx', 'Riddles and claws'], ['The Glass Serpent', 'Sand burnt to glass'], ['The Mirage Lord', 'Never where it stands'], ['The Sand Tyrant', 'Every grain obeys'], ['The Red Jackal', 'It runs the wadi'], ['The Sun-Eater', 'It swallowed noon once']];
const TINTS = ['#c0904a', '#b0703a', '#c8a050', '#a8683a', '#d0a060', '#b88040', '#a0603a', '#c89858'];
const NAMED = ['The Dune Mother', 'Sandjaw', 'The Glass Widow', 'Old Scarab', 'The Dust Prince', 'Mother Mirage', 'The Red Rider', 'Brasshand', 'The Hollow Rider', 'Sirocco', 'Cinderveil', 'The Salt Hound', 'Two-Tails', 'The Pale Nomad', 'Grit', 'The Sun Widow', 'Ashmane', 'The Thirst'];
const CHIEFS = ['The Raider Chief', 'The Dig Warden', 'The Brass Captain', 'The Red Chief'];
const NPCS = ['Tamsin', 'Oro', 'Hadi', 'Zel', 'Mira', 'Kett', 'Nuri', 'Sabe'];
const LORE: [string, string][] = [
  ['The river left one summer and did not say why.', 'The wadi still waits for it.'],
  ['Caravans came for the water, and the wind came for the caravans.', 'Only the rocks remember the way.'],
  ['Every well here was dug by someone thirsty.', 'Every one was found by someone thirstier.'],
  ['The dunes walk a little every night.', 'What they walk over, they keep.'],
  ['The brass markers showed the road to the sea.', 'There has been no sea for a thousand years.'],
  ['A climber passed here before you.', 'The sand kept the footprints for a day.'],
  ['The storm has a name in every tongue of the road.', 'In none of them is it a kind one.'],
  ['The sun fell here once, they say, and went under the sand.', 'The sand is still warm.'],
  ['Shade is worth more than water here.', 'Water you can carry.'],
];

/** Where a made floor's places stand and what they are. */
type Kind = 'raiders' | 'serai' | 'tombs' | 'fort' | 'ruins' | 'tower' | 'shrine' | 'dig' | 'oasis' | 'well' | 'bridge' | 'bay' | 'gatehouse' | 'camp';
const PLACE_NAMES: Partial<Record<Kind, string[]>> = {
  raiders: ['The raiders’ camp', 'The red tents'], serai: ['The caravanserai', 'The travellers’ court'], tombs: ['The tombs', 'The rock tombs', 'The kings’ tombs'],
  fort: ['The old fort', 'The mud fort'], ruins: ['The ruined temple', 'The colonnade'], tower: ['The watchtower', 'The signal tower'], shrine: ['The sun shrine', 'The obelisk'],
  dig: ['The scarab dig', 'The fallen obelisk'], oasis: ['The oasis', 'The palm well'],
};
interface Place { id: string; kind: Kind; name: string; c: V; r: number; stand: V }

/** Five times floor 1's walkable ground (a circle of 48 m: 7238 m2). */
const AREA = 5 * Math.PI * 48 * 48;
const RING_X = 0, RING_Z = 7; // core.ts `RING`

/**
 * A wadi's outline: an ellipse `stretch` times as long north to south as it is wide, with three low waves on it, scaled to `area`.
 * Radii from +x (east) towards +z (south), as `makeOutline` (core.ts) counts.
 */
function wadiOutline(rnd: () => number, o: { area: number; stretch: number; min: number; max: number; n?: number; waves?: [number, number, number] }) {
  const n = o.n ?? 48, [w1, w2, w3] = o.waves ?? [0.12, 0.08, 0.05];
  const p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;
  const shape = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a) / o.stretch;
    return (1 / Math.sqrt(c * c + s * s)) * (1 + w1 * Math.sin(a + p1) + w2 * Math.sin(2 * a + p2) + w3 * Math.sin(3 * a + p3));
  });
  // scale to the area, then clamp, then scale once more for what the clamp took
  const areaOf = (rs: number[]) => 0.5 * Math.sin((Math.PI * 2) / n) * rs.reduce((s, r, i) => s + r * rs[(i + 1) % n], 0);
  let k = Math.sqrt(o.area / areaOf(shape)), rs = shape;
  for (let i = 0; i < 3; i++) {
    rs = shape.map((s) => Math.max(o.min, Math.min(o.max, s * k)));
    k *= Math.sqrt(o.area / areaOf(rs));
  }
  return rs.map(r2);
}

/** The storm at a floor of the chapter, `k` 0 (floor 21) to 1 (floor 30), over a zone of radius `ring`: a band that moves at a steady
 * speed whatever the zone's size (law.ts sweeps `2 * ring + width` in `lasts` seconds), a little wider, faster, harder and with more
 * wraiths as the chapter climbs. */
function stormOf(k: number, ring: number): Extract<LawDef, { kind: 'storm' }> {
  const width = Math.round(22 + 8 * k), speed = 4.5 + k, lasts = Math.round((2 * ring + width) / speed), every = lasts + Math.round(80 - 12 * k);
  return {
    kind: 'storm', name: 'The storm',
    blurb: `Every ${every} seconds a wall of sand ${width} m deep crosses from the north. Inside it you see a few steps and it hurts, unless you stand behind a rock.`,
    every, lasts, warn: 8, burn: r4(0.04 + 0.01 * k), width, shelter: 7, sight: r2(5 - k),
    wraiths: { kind: 'wraith', n: 2, every: r2(4 - k), most: k >= 0.5 ? 5 : 4 },
  };
}

/** The canyon's own enemies (floor 21's numbers; the game grows them by the floor's tuned number). */
function canyonEnemies(o: { shard: (x: number) => number; chief?: string; guards?: string; named1?: string; named2?: string }): Record<string, EnemySpec> {
  const s = o.shard;
  const e: Record<string, EnemySpec> = {
    raider: { id: 'raider', name: 'Raider', blurb: 'Strikes up close.', look: 'raider', melee: true, hp: 75, share: 0.026, every: 1.6, speed: 3.3, scale: 1.3, shards: s(4), color: '#ff9a6a' },
    slinger: { id: 'slinger', name: 'Slinger', blurb: 'Throws stones from a distance.', look: 'slinger', melee: false, hp: 48, share: 0.022, every: 2.4, speed: 2.7, range: 11, scale: 1.3, shards: s(5), color: '#ffd27a' },
    wraith: { id: 'wraith', name: 'Dust wraith', blurb: 'Lives only in the storm.', look: 'wraith', melee: true, hp: 45, share: 0.02, every: 1.4, speed: 3.8, scale: 1.2, shards: s(3), color: '#e8d0a0' },
    chief: { id: 'chief', name: o.chief ?? 'The Raider Chief', blurb: o.guards ?? 'Leads the raiders of the fort.', look: 'chief', melee: true, hp: 400, share: 0.055, every: 1.5, speed: 3.1, scale: 1.8, shards: s(30), color: '#ffe08a' },
    mother: { id: 'mother', name: o.named1 ?? 'The Dune Mother', blurb: 'Walks the canyon and strikes hard.', look: 'mother', melee: true, hp: 560, share: 0.065, every: 2.0, speed: 2.3, scale: 2.2, shards: s(40), color: '#ffd060' },
  };
  if (o.named2) e.rider = { id: 'rider', name: o.named2, blurb: 'Walks the wall side and strikes hard.', look: 'chief', melee: true, hp: 460, share: 0.058, every: 1.7, speed: 2.8, scale: 2.1, shards: s(35), color: '#e0a070' };
  return e;
}

/**
 * The parts both kinds of floor share: the outline and its walls, the camp, the lair's yard, each place's pieces, roads, big rocks and
 * scattered cover, and the move into the world. `kinds` names the pieces whose look is the zone's own (a well, a palm...), by index.
 */
class Sands {
  readonly L: Layout;
  readonly rim: number[];
  readonly kinds: [number, SandsKind][] = [];
  readonly decor: SandsDecor[] = [];
  readonly roads: V[][] = [];
  readonly camp: Place;
  readonly lairZ: number;
  readonly lairDoor: V;
  readonly rnd: () => number;
  constructor(rim: number[], rnd: () => number, n: number) {
    this.rim = rim;
    this.rnd = rnd;
    const L = (this.L = new Layout(rim, rnd, n));
    const southR = rimToward(rim, 180), northR = rimToward(rim, 0);
    this.camp = { id: 'camp', kind: 'camp', name: 'The camp', c: { x: 0, z: r2(southR - 16) }, r: 7, stand: { x: 0, z: r2(southR - 12.5) } };
    L.edges();
    // The camp: a fire, two tents, supplies, the spring.
    L.pill('fire', this.C(0, -0.5), 0.9, 0.9); L.pill('tent', this.C(-8.5, 2.5), 1.7, 2.6); L.pill('tent', this.C(8.5, -1.5), 1.7, 2.6);
    L.pill('crate', this.C(-5, -4), 0.8, 1.2); L.pill('barrel', this.C(-9.5, 6.2), 0.7, 1.2); this.mark('jars');
    L.pill('barrel', this.C(7, 5.2), 1.1, 0.9); this.mark('spring');
    L.reserve(this.camp.c, 11);
    // The lair: a walled yard against the north edge, its doorway facing the middle.
    this.lairZ = r2(-northR + 9);
    this.lairDoor = { x: 0, z: r2(-northR + 5) };
    const z = this.lairZ;
    L.wall('house', { x: -22, z }, { x: -3.4, z }, 0.5, 3.8); L.wall('house', { x: 3.4, z }, { x: 22, z }, 0.5, 3.8);
    for (const s of [-1, 1]) L.wall('house', { x: s * 22, z }, { x: s * 22, z: z - 7 }, 0.5, 3.8);
    L.reserve({ x: 0, z: z + 2 }, 6);
  }
  /** A spot round the camp. */
  C(dx: number, dz: number): V { return { x: dx, z: r2(this.camp.c.z + dz) }; }
  /** The last piece's look is the zone's own `k`. */
  mark(k: SandsKind) { this.kinds.push([this.L.cover.length - 1, k]); }
  /** A spot at a bearing, `f` of the way from the middle to the outline. */
  at(deg: number, f: number) { return polar(deg, rimToward(this.rim, deg) * f); }

  /** A place's own pieces round its middle; then its ground and stand are kept clear. */
  dress(p: Place) {
    const L = this.L, rnd = this.rnd, out = unit(p.c), tan = { x: -out.z, z: out.x };
    const Q = (dOut: number, dTan: number): V => add(add(p.c, out, dOut), tan, dTan);
    /** Spots `d` m from the middle at these angles (degrees; 0 is outward, 180 towards the middle of the zone). */
    const ring = (degs: number[], d: number, f: (q: V) => void) => {
      for (const deg of degs) { const a = (deg * Math.PI) / 180; f(add(add(p.c, out, Math.cos(a) * d), tan, Math.sin(a) * d)); }
    };
    switch (p.kind) {
      case 'raiders':
        // red tents round a fire bowl, their supplies; the middle is the pack's
        ring([-70, 0, 70], 6.4, (q) => L.pill('tent', q, 1.7, 2.6));
        L.pill('fire', Q(-3.4, 0), 0.9, 1); this.mark('brazier');
        L.pill('crate', Q(4.2, 3.6), 0.8, 1.3); L.pill('crate', Q(4.6, -3), 0.8, 1.3); L.pill('barrel', Q(1.5, 5.4), 0.6, 1.1); this.mark('jars');
        break;
      case 'serai':
        // a walled court open to the middle, a well inside
        L.wall('house', Q(6.5, -6), Q(6.5, 6), 0.5, 3.4);
        for (const s of [-1, 1]) L.wall('house', Q(6.5, s * 6), Q(-1.5, s * 6.5), 0.5, 3.4);
        L.pill('barrel', Q(3, 0), 1.2, 1.1); this.mark('well');
        L.pill('barrel', Q(4.6, 4.2), 0.6, 1.1); this.mark('jars');
        L.pill('crate', Q(4.6, -4.2), 0.8, 1.2);
        break;
      case 'tombs':
        // a horseshoe of rock open to the middle, two obelisks at its mouth
        for (const deg of [-90, -60, -30, 0, 30, 60, 90]) { const a = (deg * Math.PI) / 180; L.pill('rock', add(add(p.c, out, Math.cos(a) * 7), tan, Math.sin(a) * 7), 2.2, 5.4); }
        for (const s of [-1, 1]) { L.pill('post', Q(-6.5, s * 4.2), 0.6, 5.2); this.mark('obelisk'); }
        break;
      case 'fort':
        L.wall('house', Q(5.5, -5), Q(5.5, 5), 0.5, 3.4); L.wall('house', Q(5.5, -5), Q(-1.5, -5.5), 0.5, 3.4); L.wall('house', Q(5.5, 5), Q(-1.5, 5.5), 0.5, 3.4);
        L.pill('crate', Q(3.6, -3.4), 0.8, 1.3); L.pill('crate', Q(3.6, 3.4), 0.8, 1.3);
        break;
      case 'ruins':
        // two rows of standing columns and a fallen one
        for (const s of [-1, 1]) for (const t of [-4.5, 0, 4.5]) { L.pill('post', Q(t, s * 5.2), 0.6, 4.6); this.mark('column'); }
        L.wall('hull', Q(6.2, -3), Q(6.6, 3.2), 0.6, 1.2); this.mark('column');
        break;
      case 'tower': {
        L.pill('lighthouse', p.c, 2.6, 13);
        const st = p.stand, d0 = unit({ x: p.c.x - st.x, z: p.c.z - st.z }), side = { x: -d0.z, z: d0.x };
        L.wall('stall', add(add(st, side, 6.5), out, 1.5), add(add(st, side, 6.5), out, -3), 0.4, 1.3);
        L.wall('stall', add(add(st, side, -6.5), out, 1.5), add(add(st, side, -6.5), out, -3), 0.4, 1.3);
        L.pill('crate', Q(1, 5.5), 0.8, 1.3); L.pill('barrel', Q(-1, -5.5), 0.6, 1.1); this.mark('jars');
        break;
      }
      case 'shrine':
        // an obelisk with a fire bowl before it (the watch fire), three lantern posts, a low wall behind
        L.pill('post', Q(2.2, 0), 0.9, 7.5); this.mark('obelisk');
        ring([-100, 100], 4.4, (q) => L.pill('post', q, 0.35, 3.2));
        L.wall('stall', Q(5.5, -4), Q(5.5, 4), 0.4, 1.3);
        break;
      case 'dig':
        // the dig: a fallen obelisk, the spoil of the dig, the diggers' crates
        L.wall('hull', Q(2.5, -5.5), Q(4.5, 4.5), 1.6, 2.6); this.mark('statue');
        L.pill('rock', Q(-1, 6.5), 1.3, 1.6); L.pill('rock', Q(2, -8.5), 1.5, 2); L.pill('crate', Q(-3, -5), 0.8, 1.2);
        break;
      case 'oasis':
        L.pill('barrel', p.c, 1.4, 1.1); this.mark('well');
        { const o0 = rnd() * 40; ring([0, 72, 144, 216, 288].map((a) => a + o0), 6, (q) => { L.pill('post', q, 0.45, 6.5); this.mark('palm'); }); }
        break;
      case 'well':
        L.pill('barrel', p.c, 1.4, 1.1); this.mark('well');
        ring([-70 - rnd() * 30, 70 + rnd() * 30], 5.6, (q) => { L.pill('post', q, 0.45, 6.2); this.mark('palm'); });
        break;
      case 'bridge':
        // two piers of an arch (the rival's door between them), its fallen stones
        for (const s of [-1, 1]) { L.pill('post', Q(1.5, s * 2.6), 0.85, 5.2); this.mark('pier'); }
        this.decor.push({ kind: 'arch', x: r2(Q(1.5, 0).x), z: r2(Q(1.5, 0).z), yaw: r2(Math.atan2(tan.x, tan.z)), s: 5.2 });
        L.pill('rock', Q(4.5, 5), 1.2, 1.6); L.pill('rock', Q(4, -5.5), 1.4, 2);
        break;
      case 'bay':
        L.pill('rock', Q(3.5, 3.5), 1.6, 3.4); L.pill('rock', Q(3.8, -3.6), 1.4, 3);
        break;
      case 'gatehouse':
        break;
    }
    L.reserve(p.c, p.r + 1.5);
    L.reserve(p.stand, 3);
  }

  /** The edge of a place towards a point. */
  edge(p: Place, to: V): V { const e = add(p.c, unit({ x: to.x - p.c.x, z: to.z - p.c.z }), p.r - 1); return { x: r2(e.x), z: r2(e.z) }; }
  road(a: V, b: V, bends = 1, amp = 4) { const r = this.L.road(a, b, bends, amp, 2.6); this.roads.push(r); return r; }

  /** Big rocks standing in the wadi (the canyon's bastions: shelter from the storm, and a way across has to bend), then small cover. */
  scatter(o: { big: number; small: number; keepOff: { c: V; r: number }[] }) {
    const L = this.L, rnd = this.rnd, big: V[] = [];
    for (let i = 0; i < 4000 && big.length < o.big; i++) {
      const p = polar(L.range(-180, 180), Math.sqrt(rnd()) * 140), r = L.range(2.8, 5.2);
      if (inside(this.rim, p) < r + 7 || L.inKeep(p, r + 3) || L.hitsCover(p, r + 5) || big.some((q) => dist(q, p) < 24) || o.keepOff.some((k) => dist(k.c, p) < k.r + r + 4)) continue;
      L.pill('rock', p, r2(r), r2(4.5 + r * 0.9));
      big.push(p);
    }
    for (let i = 0, made = 0; i < 9000 && made < o.small; i++) {
      const p = polar(L.range(-180, 180), Math.sqrt(rnd()) * 140);
      const t = rnd(), look = t < 0.68 ? 'rock' as const : t < 0.84 ? 'crate' as const : 'barrel' as const;
      const r = look === 'rock' ? L.range(1.1, 2.1) : look === 'crate' ? 0.8 : 0.7;
      if (inside(this.rim, p) < 3 + r || L.inKeep(p, r + 0.4) || L.hitsCover(p, r + 3.2) || o.keepOff.some((k) => dist(k.c, p) < k.r + r)) continue;
      L.pill(look, p, r2(r), r2(look === 'rock' ? r * L.range(1.4, 2.0) : look === 'crate' ? 1.3 : 1.2));
      if (look === 'barrel') this.mark('jars');
      made++;
    }
  }

  /** The look the zone is drawn from, in the world (`m` -1: the dunes in the west). */
  look(m: 1 | -1, open: 1 | -1 | 0, places: Place[], seed: number): SandsLook {
    const W = worldOf(m), X = W.X;
    return {
      rim: m === 1 ? this.rim : mirrorRim(this.rim),
      pieces: this.L.cover.map(W.piece),
      kinds: this.kinds,
      decor: this.decor.map((d) => ({ ...d, ...X(d), yaw: W.yaw(d.yaw) })),
      places: places.map((p) => ({ id: p.id, kind: p.kind, ...X(p.c), r: p.r })),
      paths: this.roads.map((r) => r.map(W.off)),
      dunes: open === 0 ? 0 : (open * m) as 1 | -1, seed,
    };
  }
}

/** A quest step's spots into the world. */
const stepTo = (X: (v: V) => V) => (s: Step): Step => {
  switch (s.verb) {
    case 'reach': case 'hold': return { ...s, at: X(s.at) };
    case 'light': return { ...s, things: s.things.map((t) => ({ ...t, at: X(t.at) })) };
    case 'carry': return { ...s, from: X(s.from), to: X(s.to) };
    case 'lead': return { ...s, from: X(s.from), path: s.path.map(X) };
    default: return s;
  }
};
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const mid = (s: string) => s.replace(/^The /, 'the ');
const poss = (s: string) => (s.endsWith('s') ? `${s}’` : `${s}’s`);
const facing = (p: V) => r2(Math.atan2(-p.x, -p.z));

/** Places on bearings and shares of the way out, `apart` m from each other (packs `packApart`); throws when one finds no room. */
function placeAll(S: Sands, n: number, slots: { id: string; kind: Kind; deg: [number, number]; f: [number, number]; r?: number; name?: string }[], packIds: string[], packApart: number) {
  const L = S.L, places: Place[] = [];
  for (const s of slots) {
    let c: V | null = null;
    for (let i = 0; i < 500; i++) {
      const p = S.at(L.range(...s.deg), L.range(...s.f));
      if (places.some((q) => dist(q.c, p) < (packIds.includes(q.id) && packIds.includes(s.id) ? packApart : 26))) continue;
      if (dist(p, S.camp.c) < 30 || dist(p, { x: 0, z: S.lairZ }) < 26 || inside(S.rim, p) < 14) continue;
      c = p;
      break;
    }
    if (!c) throw new Error(`floor ${n}: no room for ${s.id}`);
    const back = s.kind === 'tower' ? 7 : s.kind === 'shrine' ? 4.5 : s.kind === 'tombs' ? 1.5 : s.kind === 'dig' ? 4 : s.kind === 'oasis' || s.kind === 'well' ? 2.8 : 0;
    const cc = { x: r2(c.x), z: r2(c.z) }, st = add(cc, toMid(cc), back);
    places.push({ id: s.id, kind: s.kind, name: s.name ?? L.pick(PLACE_NAMES[s.kind] ?? ['The place']), c: cc, r: s.r ?? 8, stand: { x: r2(st.x), z: r2(st.z) } });
  }
  return places;
}

export interface SandsGenOptions { n: number; attempt?: number }

/** A made floor of the Sands, 22 to 30 (30 is the crown). */
export function makeSandsFloor(o: SandsGenOptions): GenFloor {
  const n = o.n, seed = n * 1000 + (o.attempt ?? 0), rnd = mulberry(seed);
  if (n < 22 || n > 30) throw new Error(`floor ${n}: the Sands' made floors are 22 to 30`);
  const m: 1 | -1 = n % 2 === 0 ? -1 : 1; // even floors have their dunes in the west
  const k = (n - 21) / 9; // 0 at floor 21, 1 at floor 30
  const rim = wadiOutline(rnd, { area: AREA, stretch: 1 + 0.5 * rnd(), min: 70, max: 138 });
  const S = new Sands(rim, rnd, n), L = S.L, C = (dx: number, dz: number) => S.C(dx, dz);
  const range = (a: number, b: number) => L.range(a, b);
  const pick = <T>(xs: readonly T[]) => L.pick(xs);
  const at = (deg: number, f: number) => S.at(deg, f);
  const camp = S.camp;

  // --- who is where: gatekeepers all different over the chapter, people five at a time round the rest ---------------------------
  const order = shuffle(ROSTER.filter((h) => !HANDMADE_GATES.includes(h)), mulberry(3001));
  const gates = order.slice(0, 9), folk = [...order.slice(9), ...HANDMADE_GATES];
  const who = (i: number) => folk[((n - 22) * 5 + i) % folk.length];
  const keeperHero = who(0), giverHero = who(1), traderHero = who(2), rivalHero = who(3), villagerHero = who(4), gateHero = gates[n - 22];
  const turn = (n - 22) % RULER_BODIES.length, round = [...RULER_BODIES.slice(turn), ...RULER_BODIES.slice(0, turn)];
  const rulerBody = round.find((b) => ![keeperHero, giverHero, traderHero, rivalHero, villagerHero, gateHero].includes(b)) ?? 'Sirix';

  // --- eight places on two rings round the middle: the walls' side west, the dunes east -------------------------------------------
  const kindA = pick(['raiders', 'ruins'] as const);
  const slots: { id: string; kind: Kind; deg: [number, number]; f: [number, number]; r?: number }[] = [
    { id: 'a', kind: kindA, deg: [-118, -100], f: [0.64, 0.76] }, // the walls' side, south-west: the main quest's pack
    { id: 'v', kind: 'serai', deg: [-80, -62], f: [0.7, 0.8], r: 9 }, // the walls' side, west: the caravanserai (no pack)
    { id: 'b', kind: 'tombs', deg: [-40, -22], f: [0.72, 0.8] }, // north-west, under the cliff: the caravan waits there
    { id: 'f', kind: kindA === 'ruins' ? 'fort' : pick(['fort', 'ruins'] as const), deg: [-8, 12], f: [0.36, 0.46] }, // the inner north
    { id: 'c', kind: 'tower', deg: [32, 52], f: [0.72, 0.8] }, // north-east: a watch fire
    { id: 'e', kind: 'shrine', deg: [84, 102], f: [0.7, 0.8] }, // the dunes' side, east: a watch fire
    { id: 'd', kind: 'dig', deg: [118, 135], f: [0.66, 0.76] }, // south-east: the gate's seal and its guard
    { id: 'h', kind: 'oasis', deg: [-150, 150], f: [0.34, 0.46] }, // the inner ring: the well the water goes to
  ];
  const places = placeAll(S, n, slots, ['a', 'b', 'f', 'd'], 44);
  const P = (id: string) => places.find((p) => p.id === id)!;
  const A = P('a'), B = P('b'), D = P('d'), Fp = P('f'), Cl = P('c'), E = P('e'), Vl = P('v'), H = P('h');
  for (const p of places) S.dress(p);
  // A ruined gateway in the middle (when no place stands there).
  const ruin = { x: r2(range(-8, 8)), z: r2(range(-6, 4)) };
  const hasRuin = places.every((p) => dist(p.c, ruin) > 20);
  if (hasRuin) {
    for (const s of [-1, 1]) { L.pill('post', add(ruin, { x: s * 5.5, z: -2 }), 0.9, 5.4); S.mark('pier'); }
    S.decor.push({ kind: 'arch', x: ruin.x, z: r2(ruin.z - 2), yaw: r2(Math.PI / 2), s: 5.4 });
    L.wall('hull', add(ruin, { x: -6, z: 3 }), add(ruin, { x: -1.5, z: 4.5 }), 0.6, 1.2); S.mark('column');
    L.reserve(add(ruin, { x: 0, z: 0.5 }), 7);
  }

  // --- roads: the camp to A and to D; a ring through the outer places; spokes to the inner ones -----------------------------------
  const outer = [A, Vl, B, Cl, E, D];
  S.road(C(-2.5, -6), S.edge(A, C(-2.5, -6)), 1, 4); S.road(C(3, -6), S.edge(D, C(3, -6)), 1, 4);
  for (let i = 1; i < outer.length; i++) S.road(S.edge(outer[i - 1], outer[i].c), S.edge(outer[i], outer[i - 1].c), 2, 5);
  const middle: V = hasRuin ? add(ruin, { x: 0, z: 6 }) : { x: 0, z: 0 };
  for (const p of [Fp, H]) {
    const near = outer.reduce((b, q) => (dist(q.c, p.c) < dist(b.c, p.c) ? q : b));
    S.road(S.edge(near, p.c), S.edge(p, near.c), 1, 3);
    S.road(S.edge(p, middle), middle, 1, 3);
  }
  S.road(C(0, -7), middle, 2, 5);
  S.road(middle, add(S.lairDoor, { x: 0, z: 6 }), 2, 4);

  // --- doors and the spots of the quests, the people, the secrets ---------------------------------------------------------------
  const packSpots = [A.c, B.c, Fp.c, D.c];
  const awayFromPacks = (d: number) => (q: V) => packSpots.every((s) => dist(s, q) >= d);
  const winch = L.reserve(C(13.5, 4.5), 2.5);
  const springAt = C(6.4, 2.6);
  const gate = L.reserve(L.spot(C(pick([-16, 16]), 6), 2, 2.2), 3.5);
  const trial = L.reserve(L.spot(at(range(-150, -132), 0.85), 4, 2), 3.5);
  const rivalDoor = L.reserve(L.spot(at(range(-58, -46), 0.88), 4, 2), 3.5);
  const rivalAt = L.reserve(L.spot(add(rivalDoor, toMid(rivalDoor), 5), 1.5, 1.2), 2);
  const villagerAt = L.reserve(L.spot(Vl.stand, 2, 1.2), 2);
  const hold = L.reserve(L.spot(at(range(-15, 15), 0.62), 4, 4, awayFromPacks(30)), 5);
  const reach = L.reserve(L.spot(at(range(60, 80), 0.88), 4, 2), 3);
  const lore = L.reserve(L.spot(at(range(150, 165), 0.82), 4, 1.5), 2.5);
  const waterTo = L.reserve(H.stand, 2.5);
  const caches = [at(range(-170, -155), 0.86), at(range(-95, -85), 0.9), at(range(-20, -5), 0.9), at(range(15, 25), 0.88), at(range(70, 80), 0.6), at(range(140, 150), 0.88)]
    .map((p) => L.reserve(L.spot(p, 4, 1.5), 2.5));
  const stoneNear = [A, Vl, B, Cl, D, H];
  const stones = stoneNear.map((p) => L.reserve(L.spot(add(p.c, toMid(p.c), 16), 3, 1.5, awayFromPacks(15)), 2.5));

  // Two named enemies: one walks a loop round the middle, one the walls' side. Their ways are kept clear.
  const patrol1: V[] = [-60, 30, 120, 210].map((a) => L.spot(polar(a + range(-15, 15), range(20, 28)), 3, 2, awayFromPacks(24)));
  for (let i = 0; i < 4; i++) L.lane(patrol1[i], patrol1[(i + 1) % 4], 1.8);
  const patrol2: V[] = [at(range(-125, -115), 0.5), at(range(-95, -85), 0.52), at(range(-65, -55), 0.52), at(range(-40, -30), 0.5)].map((p) => L.spot(p, 4, 2, awayFromPacks(22)));
  for (let i = 1; i < 4; i++) L.lane(patrol2[i - 1], patrol2[i], 1.8);
  const patrol2Loop = [...patrol2, ...patrol2.slice(1, 3).reverse()];

  // The caravan's road: from the tombs (B) to the camp along the roads.
  const leadFrom = add(B.stand, toMid(B.c), 5);
  const leadPath = roadRoute(S.roads, add(B.stand, toMid(B.c), 6), C(0, -3)).map((p) => ({ x: r2(p.x), z: r2(p.z) }));
  leadPath.push(C(0, -3));
  for (let i = 1; i < leadPath.length; i++) L.lane(leadPath[i - 1], leadPath[i], 1.6);
  const leadNpc = pick(NPCS);

  // --- big rocks and scattered cover in what is left --------------------------------------------------------------------------
  S.scatter({ big: 12 + Math.round(4 * k), small: 58 + Math.round(10 * k), keepOff: places.map((p) => ({ c: p.c, r: p.r + 2 })) });

  // --- enemies and packs: floor 21's, grown only by the game's own `floorNumbers` (tunedAs below) -----------------------------------
  const shard = (x: number) => Math.round(x * (1 + 0.05 * (n - 21)));
  const named1 = NAMED[(2 * (n - 22)) % NAMED.length], named2 = NAMED[(2 * (n - 22) + 1) % NAMED.length];
  const chief = pick(CHIEFS);
  const enemies = canyonEnemies({ shard, chief, guards: `Guards ${lower(D.name)}.`, named1, named2 });
  const late = n >= 26;
  const packs: PackDef[] = [
    { id: 'a', at: A.c, leash: 24, mix: [{ kind: 'raider', n: 2 }, { kind: 'slinger', n: 2 }] },
    { id: 'd', at: D.c, leash: 24, mix: [{ kind: 'raider', n: 2 }], elite: 'chief' },
    { id: 'b', at: B.c, leash: 24, mix: [{ kind: 'raider', n: late ? 1 : 2 }, { kind: 'slinger', n: late ? 3 : 2 }] },
    { id: 'f', at: Fp.c, leash: 24, mix: [{ kind: 'raider', n: 2 }, { kind: 'slinger', n: 1 }] },
    { id: 'named1', at: patrol1[0], mix: [{ kind: 'mother', n: 1 }], named: { name: named1, speed: 1.6, patrol: patrol1, bounty: { shards: shard(40), relic: true } } },
    { id: 'named2', at: patrol2Loop[0], mix: [{ kind: 'rider', n: 1 }], named: { name: named2, speed: 1.7, patrol: patrol2Loop, bounty: { shards: shard(35), relic: false } } },
  ];

  // --- the set pieces: the ruler (the Scarab Colossus's moves, another body and name), the gate, the trial, the rival ---------------
  // Floor 30 is the chapter's crown: behind the lair is the Raid's Heart of Noon, alone (pieces/core.ts `crownFight`).
  const crown = n === 30 ? ('heart' as const) : undefined;
  const [rulerName, rulerTitle] = crown ? ['The Heart of Noon', 'The sun that fell'] : RULERS[(n - 22) % RULERS.length];
  const extra: [string, MoveSpec] = pick([
    ['whirl', { use: 'spokes', name: 'The Whirlwind', share: 0.09, cooldown: 14 }],
    ['fan', { use: 'fan', share: 0.05 }],
    ['volley', { use: 'volley', name: pick(['Sand Volley', 'Glass Shards', 'Scarab Swarm']), share: 0.07, cooldown: 6 }],
  ] as [string, MoveSpec][]);
  const ruler: RulerDef = {
    name: rulerName, title: rulerTitle, stand: rulerBody, tint: TINTS[(n - 22) % TINTS.length], scale: r2(range(2.3, 2.7)), hp: Math.round((3400 * (1 + 0.02 * (n - 21))) / 50) * 50, speed: 2.1, stagger: { max: 100, kneel: 5 },
    room: 'canyon',
    moves: {
      burrow: { use: 'burrow', name: pick(['It Burrows', 'Under the Sand', 'It Goes Under']), share: 0.14, under: 2.6, open: 4.5, cooldown: 13 },
      cleave: { use: 'cleave', share: 0.16 },
      lunge: { use: 'lunge', share: 0.16 },
      marks: { use: 'stones', name: pick(['Marked Sand', 'Falling Sand', 'Sunstones']), share: 0.1, count: 3, cooldown: 6 },
      storm: { use: 'surge', name: 'The Storm', warn: 2.4, seconds: 9, cooldown: 26 },
      [extra[0]]: extra[1],
    },
    phases: [
      { name: `${rulerName} stirs`, at: 1, moves: ['burrow', 'cleave', 'lunge'], gap: [1.5, 2.3] },
      { name: 'The sand is marked', at: 0.6, moves: ['burrow', 'cleave', 'lunge', 'marks', extra[0]], gap: [1.3, 2.1] },
      { name: 'It calls the storm', at: 0.3, opener: 'storm', moves: ['burrow', 'cleave', 'lunge', 'marks', extra[0]], timed: { move: 'storm', first: 22, every: 24, most: 99 }, gap: [1.2, 1.9] },
    ],
    surge: { safe: { shell: 4.4 }, burn: 0.05, name: 'The storm', look: 'storm' },
    line: crown ? 'A Raid boss, alone: stand still on its beat, run between' : 'It goes under the sand and comes up where you stood',
  };
  const twists = ['giant', 'swift', 'warded'] as const;
  const pieces: PiecesDef = {
    floor: n, hard: r2(1.25 + 0.016 * (n - 21)), // floor 21 is 1.25, the Deep (floor 31) 1.4
    ruler,
    gate: { hero: gateHero, arena: 'canyon', level: 3, twist: { kind: 'hazard', name: 'A storm crosses' } },
    trial: { kind: (['hold', 'gauntlet', 'break', 'horde'] as const)[n % 4], height: n < 26 ? 6 : 7 },
    ...(crown ? { crown } : {}),
    rival: { hero: rivalHero, twist: twists[n % 3], line: `${rivalHero} waits by the arch`, height: 6 + Math.floor((n - 21) / 4) },
  };

  // --- people, quests, doors, secrets ---------------------------------------------------------------------------------------
  const people: (Omit<PersonDef, 'at'> & { at: V })[] = [
    { id: 'keeper', hero: keeperHero, name: keeperHero, role: 'keeper', at: C(-2.6, 2), face: 0.4, greet: [`Another climber. ${A.name} is full of raiders, the oasis is dry, and ${mid(rulerName)} waits behind the brass door in the far north. The wadi is long: keep to the roads, and to the rocks when the wind comes.`], quests: ['main', 'bounty1', 'bounty2'] },
    { id: 'giver', hero: giverHero, name: giverHero, role: 'giver', at: C(5.5, -0.7), face: -0.5, greet: [pick(['I count the storms. Every one, from behind a rock.', 'Sand is free here. Everything else I need help with.', 'The caravans will not move while the road is like this.'])], quests: ['g1', 'g2'] },
    { id: 'villager', hero: villagerHero, name: villagerHero, role: 'giver', at: villagerAt, face: facing(villagerAt), greet: [`You walked all the way to ${lower(Vl.name)}? Then you can light a fire for me.`], quests: ['g3'] },
    { id: 'rival', hero: rivalHero, name: rivalHero, role: 'rival', at: rivalAt, face: facing(rivalAt), greet: [], quests: [] },
    { id: 'trader', hero: traderHero, name: traderHero, role: 'trader', at: C(-5.5, 5.5), face: 0.6, greet: ['Shards for what you need. Sand is free; everything else costs.'], quests: [] },
  ];
  const reward = (s: number, more: { boon?: boolean; relic?: boolean } = {}) => ({ shards: shard(s), ...more });
  const sealName = pick(['The brass seal', 'The sun key', 'The scarab seal']);
  const quests: QuestDef[] = [
    {
      id: 'main', name: pick(['Water and Brass', 'The Brass Door', 'The Road North']), giver: 'keeper', main: true,
      intro: [`Four things. Clear ${lower(A.name)}. Carry a jar from the camp spring to ${lower(H.name)}, so the road has water again. Then ${lower(sealName)} lies in ${lower(D.name)}, and ${mid(chief)} guards it: clear them, then bring it to the winch by the camp.`],
      steps: [
        { verb: 'fell', text: `Clear ${lower(A.name)}`, packs: ['a'] },
        { verb: 'carry', text: `Carry water from the camp spring to ${lower(H.name)}`, item: 'water', itemName: 'A jar of water', toName: lower(H.name), look: 'jar', plain: true, from: springAt, to: waterTo, r: 2.6 },
        // The seal's guard first: carrying it past an awake guard (a hit drops it) was a loop of fetching it again on the sea's floors.
        { verb: 'fell', text: `Clear ${lower(D.name)}`, packs: ['d'] },
        { verb: 'carry', text: `Bring ${lower(sealName)} from ${lower(D.name)} to the winch`, item: 'key', itemName: sealName, toName: 'the winch', from: D.stand, to: winch, r: 2.2, opens: 'lair' },
      ] as Step[],
      outro: [`The winch turns and the brass door opens, far in the north. ${rulerName} is behind it. Rest first, then go in.`],
      reward: reward(80, { boon: true }),
    },
    { id: 'bounty1', name: named1, giver: 'keeper', intro: [`${named1} walks the middle of the wadi. Nobody crosses it twice. Fell it and the road is quieter.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named1)}`, pack: 'named1' }], outro: ['A relic from the dunes. Keep it.'], reward: reward(40, { relic: true }) },
    { id: 'bounty2', name: named2, giver: 'keeper', intro: [`${named2} rides the walls’ side. Nobody goes to ${lower(Vl.name)} while it does.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named2)}`, pack: 'named2' }], outro: ['The road west is open again.'], reward: reward(35) },
    {
      id: 'g1', name: 'The Storm Count', giver: 'giver', intro: ['A marker stone stands out on the dunes. Find it, then hold the high ground in the north while I take the count of the storms. The raiders will not like it.'],
      steps: [
        { verb: 'reach', text: 'Find the marker stone on the dunes', at: reach, r: 3 },
        { verb: 'hold', text: 'Hold the high ground while the count is taken', at: hold, r: 3.6, seconds: 16 + Math.round(4 * k), waves: { kinds: ['raider', 'raider', 'slinger'], every: 8 } },
      ] as Step[],
      outro: ['The count is done. Take your share.'], reward: reward(45, { boon: true }),
    },
    { id: 'g2', name: `${poss(leadNpc)} Caravan`, giver: 'giver', intro: [`${poss(leadNpc)} caravan waits by ${lower(B.name)} and will not move without a guard. Walk it to the camp; stand close and it follows the road.`],
      steps: [{ verb: 'lead', text: `Lead the caravan from ${lower(B.name)} to the camp`, name: 'The caravan', look: 'cart', speed: 2.2, from: leadFrom, r: 3, path: leadPath } as Step], outro: [`The caravan is in. ${leadNpc} pays in what they carry.`], reward: reward(45) },
    { id: 'g3', name: 'The Watch Fires', giver: 'villager', intro: [`Two watch fires stand cold: at ${lower(Cl.name)} and at ${lower(E.name)}. Light both, standing by each a moment, and we will see the storm coming.`],
      steps: [{ verb: 'light', text: `Light the fires at ${lower(Cl.name)} and ${lower(E.name)}`, things: [{ id: 'fire1', at: Cl.stand }, { id: 'fire2', at: E.stand }], seconds: 2 } as Step], outro: ['Now we see it coming. Take this, from the last storm.'], reward: reward(35, { boon: true }) },
  ];
  const doors: (Omit<DoorDef, 'at'> & { at: V })[] = [
    { id: 'lair', piece: 'ruler', name: crown ? 'The Sunken Heart' : `${poss(rulerName)} door`, at: S.lairDoor, r: 2.2, wall: { ax: -3.4, az: S.lairZ, bx: 3.4, bz: S.lairZ, r: 0.5, height: 3.8 }, locked: `A brass door, shut. ${keeperHero} has a quest about a seal.` },
    { id: 'trial', piece: 'trial', name: pick(['The Dust Court', 'The Sun Vault', 'The Glass Cellar']), at: trial, r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: gate, r: 2.2, needs: { won: 'ruler' }, locked: `The gate is sealed. Its warden answers only once ${mid(rulerName)} has fallen.` },
    { id: 'rival', piece: 'rival', name: `${poss(rivalHero)} arch`, at: rivalDoor, r: 2, locked: '' },
  ];
  const cacheDefs = caches.map((c, i) => ({ id: `c${i + 1}`, at: c, shards: shard([25, 30, 20, 30, 25, 20][i]), ...(i === 2 || i === 5 ? { boon: true } : {}) }));
  const stoneDefs = stones.map((s, i) => ({ id: `w${i + 1}`, name: `The ${stoneNear[i].name.replace(/^The /, '').toLowerCase()} stone`, at: s }));
  const loreText = LORE[(n - 22) % LORE.length];

  // --- into the world ---------------------------------------------------------------------------------------------------------
  const W = worldOf(m), X = W.X;
  const placeDefs: Record<string, PlaceDef> = {};
  for (const p of [camp, ...places]) placeDefs[p.id] = { id: p.id, name: p.name, ...X(p.c), r: p.r, stand: X(p.stand) };
  const nn = String(n).padStart(2, '0');
  const look = S.look(m, 1, [camp, ...places], n * 211) satisfies SandsLook;
  const ring = Math.ceil(Math.max(...rim) + 1.5);
  return {
    n, chapter: 'sands', seed, look, pieces,
    floor: {
      n, id: `sands-${nn}`, name: crown ? 'The Crown of the Sands' : FLOOR_NAMES[(n - 22) % FLOOR_NAMES.length], blurb: crown ? 'Where the sands end, the sun that fell keeps the way up.' : BLURBS[(n - 22) % BLURBS.length],
      tunedAs: r2(3 + (n - 21) / 9), ring, start: X(C(0, 5.5)), camp: X(C(0, 2)), places: placeDefs, par: Math.round((900 + 20 * (n - 21)) * 2.2),
      shop: { heal: 30 + 2 * (n - 21), boon: 55 + 3 * (n - 21), life: 80 + 4 * (n - 21), hint: 15 },
      law: stormOf(k, ring),
      enemies, packs: packs.map((p) => ({ ...p, at: X(p.at), ...(p.named ? { named: { ...p.named, patrol: p.named.patrol.map(X) } } : {}) })),
      people: people.map((p) => ({ ...p, at: X(p.at), face: W.yaw(p.face) })),
      quests: quests.map((q) => ({ ...q, steps: q.steps.map(stepTo(X)) })),
      caches: cacheDefs.map((c): CacheDef => ({ ...c, at: X(c.at) })),
      waystones: stoneDefs.map((w): WaystoneDef => ({ ...w, at: X(w.at) })),
      lore: { id: 'lore', name: 'The wind stone', at: X(lore), text: [...loreText] },
      doors: doors.map((d) => ({ ...d, at: X(d.at), ...(d.wall ? { wall: { ...d.wall, ax: r2(RING_X + m * d.wall.ax), az: r2(RING_Z + d.wall.az), bx: r2(RING_X + m * d.wall.bx), bz: r2(RING_Z + d.wall.bz) } } : {}) })),
      rival: { hero: rivalHero, goal: 'the arch', mode: 'duel', at: X(rivalAt), boon: true, lines: [`A climber on my road. I am ${rivalHero}. Step through the arch behind me and we see who is better. Win, and I fight beside you.`] },
    },
  };
}

/**
 * Floor 21, The Storm Canyon, grown to the new size (the user's choice, 2026-11-14): the same place, people, quests, enemies, ruler,
 * gatekeeper, rival and law, with every id kept (a save made on the small floor still finds its quest step, caches and stones), laid
 * out again on a long canyon of the new size. Three more waystones and three more caches (new ids), for the longer walks. The set
 * pieces stay in pieces/floors.ts. Baked by `pipeline/tools/gen-canyon.ts` into floors/canyon-made.ts.
 */
export function makeCanyonFloor(attempt = 0): Omit<GenFloor, 'pieces'> {
  const n = 21, seed = 21000 + attempt, rnd = mulberry(seed);
  const rim = wadiOutline(rnd, { area: AREA, stretch: 1.55, min: 66, max: 138, waves: [0.1, 0.07, 0.05] });
  const S = new Sands(rim, rnd, n), L = S.L, C = (dx: number, dz: number) => S.C(dx, dz), at = (deg: number, f: number) => S.at(deg, f);
  const camp = S.camp;

  // The places of the small floor, on the same bearings and shares of the way out (the gate before the lair, as it was).
  const slots: { id: string; kind: Kind; deg: [number, number]; f: [number, number]; r?: number; name: string }[] = [
    { id: 'well1', kind: 'well', name: 'The west well', deg: [-126, -118], f: [0.56, 0.64], r: 6 },
    { id: 'well2', kind: 'well', name: 'The east well', deg: [98, 108], f: [0.52, 0.6], r: 6 },
    { id: 'well3', kind: 'well', name: 'The north well', deg: [-66, -56], f: [0.48, 0.56], r: 6 },
    { id: 'bridge', kind: 'bridge', name: 'The bridge', deg: [-80, -72], f: [0.8, 0.86], r: 6 },
    { id: 'hollow', kind: 'bay', name: 'The west bay', deg: [-150, -140], f: [0.84, 0.9], r: 5 },
    { id: 'gateway', kind: 'bay', name: 'The east bay', deg: [140, 150], f: [0.84, 0.9], r: 5 },
    { id: 'fort', kind: 'fort', name: 'The old fort', deg: [38, 48], f: [0.72, 0.8], r: 7 },
  ];
  const places = placeAll(S, n, slots, ['well1', 'well2', 'fort'], 44);
  const gatePlace: Place = { id: 'gate', kind: 'gatehouse', name: 'The raiders’ gate', c: { x: 0, z: r2(S.lairZ + 12) }, r: 8, stand: { x: 0, z: r2(S.lairZ + 16) } };
  places.push(gatePlace);
  const P = (id: string) => places.find((p) => p.id === id)!;
  const W1 = P('well1'), W2 = P('well2'), W3 = P('well3'), Br = P('bridge'), Ho = P('hollow'), Gw = P('gateway'), Fo = P('fort');
  for (const p of places) S.dress(p);

  // --- roads: the wadi from the camp to the gate, and a way to each place ---------------------------------------------------------
  // The caravan's road ends well short of the gate's pack (it wakes at 9 m and shows at 18): 30 m south of it.
  const leadEnd: V = { x: r2(L.range(-4, 4)), z: r2(gatePlace.c.z + 30) };
  L.reserve(leadEnd, 3);
  const wadi = S.road(C(0, -7), leadEnd, 4, 7);
  S.road(leadEnd, S.edge(gatePlace, leadEnd), 1, 2);
  S.road(S.edge(gatePlace, S.lairDoor), add(S.lairDoor, { x: 0, z: 6 }), 0, 0);
  const spine = (p: Place) => { const near = wadi.reduce((b, q) => (dist(q, p.c) < dist(b, p.c) ? q : b)); S.road(near, S.edge(p, near), 1, 3); };
  for (const p of [W1, W2, W3, Fo]) spine(p);
  S.road(S.edge(W3, Br.c), S.edge(Br, W3.c), 1, 3);
  S.road(C(-7, -1), S.edge(Ho, C(-7, -1)), 1, 3); S.road(C(7, -1), S.edge(Gw, C(7, -1)), 1, 3);

  // --- the small floor's spots, by bearing and share --------------------------------------------------------------------------
  const packSpot = { well1: add(W1.c, toMid(W1.c), 3.5), well2: add(W2.c, toMid(W2.c), 3.5), ridge: at(-45, 0.72), fort: Fo.c, gate: gatePlace.c };
  const packList = Object.values(packSpot);
  for (const [a, b] of [['ridge', 'well1'], ['ridge', 'gate'], ['ridge', 'fort'], ['fort', 'gate'], ['well2', 'fort']] as const) {
    if (dist(packSpot[a], packSpot[b]) < 42) throw new Error(`floor 21: packs ${a} and ${b} too close`);
  }
  L.reserve(packSpot.ridge, 7);
  for (const s of [-1, 1]) L.pill('rock', add(packSpot.ridge, { x: s * 7, z: -5 }), 2, 4.4);
  const awayFromPacks = (d: number) => (q: V) => packList.every((s) => dist(s, q) >= d);
  const springAt = C(6.4, 2.6);
  const wellTo = (p: Place) => L.reserve(p.stand, 2.5);
  const to1 = wellTo(W1), to2 = wellTo(W2), to3 = wellTo(W3);
  // The doors stand in their places (kept clear already): the trial and the gate up in the two bays, the rival's in the bridge's arch.
  const trialAt = add(Ho.c, toMid(Ho.c), 1), gateAt = add(Gw.c, toMid(Gw.c), 1);
  const rivalDoor = add(Br.c, unit(Br.c), 1.5), vesperAt = add(Br.c, toMid(Br.c), 3.5);
  const fire1 = L.reserve(L.spot(at(-147, 0.5), 3, 1.5), 2.5), fire2 = L.reserve(L.spot(at(128, 0.42), 3, 1.5), 2.5);
  const towerAt = L.reserve(L.spot(at(36, 0.46), 3, 4, awayFromPacks(28)), 5);
  L.pill('lighthouse', L.spot(add(towerAt, { x: 0, z: -8 }), 2, 2.6), 2.4, 11); S.mark('tower'); // the watchtower behind the hold
  const lore = L.reserve(L.spot(at(-19, 0.7), 4, 1.5, awayFromPacks(15)), 2.5);
  const caches = [at(-110, 0.8), at(67, 0.78), at(-40, 0.86), at(-165, 0.7), at(165, 0.72), at(12, 0.78)].map((p) => L.reserve(L.spot(p, 4, 1.5, awayFromPacks(10)), 2.5));
  const stoneAt = [C(-10, -6), at(172, 0.3), at(25, 0.5), add(W1.c, toMid(W1.c), 16), add(Br.c, toMid(Br.c), 16), add(Fo.c, toMid(Fo.c), 18)]
    .map((p) => L.reserve(L.spot(p, 3, 1.5, awayFromPacks(15)), 2.5));
  // The Dune Mother walks a square round the middle.
  const patrol: V[] = [-45, 45, 135, 225].map((a) => L.spot(polar(a + L.range(-10, 10), L.range(20, 26)), 3, 2, awayFromPacks(24)));
  for (let i = 0; i < 4; i++) L.lane(patrol[i], patrol[(i + 1) % 4], 1.8);
  const leadFrom = L.reserve(C(12, 1), 2.5);
  const leadPath = [...wadi.slice(1)];
  for (let i = 1; i < leadPath.length; i++) L.lane(leadPath[i - 1], leadPath[i], 1.6);

  S.scatter({ big: 14, small: 60, keepOff: places.map((p) => ({ c: p.c, r: p.r + 2 })) });

  // --- the small floor's content, with its ids --------------------------------------------------------------------------------
  const water = (to: V, name: string) => ({ verb: 'carry' as const, text: `Carry water from the camp spring to the ${name}`, item: 'water', itemName: 'A jar of water', toName: `the ${name}`, look: 'jar' as const, plain: true, from: springAt, to, r: 2.6 });
  const enemies = canyonEnemies({ shard: (x) => x });
  const packs: PackDef[] = [
    { id: 'well1', at: packSpot.well1, leash: 24, mix: [{ kind: 'raider', n: 2 }, { kind: 'slinger', n: 1 }] },
    { id: 'well2', at: packSpot.well2, leash: 24, mix: [{ kind: 'slinger', n: 2 }, { kind: 'raider', n: 1 }] },
    { id: 'ridge', at: packSpot.ridge, leash: 24, mix: [{ kind: 'slinger', n: 3 }] },
    { id: 'fort', at: packSpot.fort, leash: 24, mix: [{ kind: 'raider', n: 2 }], elite: 'chief' },
    { id: 'gate', at: packSpot.gate, leash: 24, mix: [{ kind: 'raider', n: 2 }, { kind: 'slinger', n: 1 }] },
    { id: 'mother', at: patrol[0], mix: [{ kind: 'mother', n: 1 }], named: { name: 'The Dune Mother', speed: 1.6, patrol, bounty: { shards: 40, relic: true } } },
  ];
  const people: (Omit<PersonDef, 'at'> & { at: V })[] = [
    { id: 'pip', hero: 'Pip', name: 'Pip', role: 'keeper', at: C(-2.6, 2.4), face: 0.4, greet: ['Courier. I carry what is needed, and nothing here has water. Three wells have gone dry, a caravan is waiting, and the raiders hold the gate in the north.'], quests: ['main', 'bounty'] },
    { id: 'kaia', hero: 'Kaia', name: 'Kaia', role: 'giver', at: C(3.6, 2), face: -0.5, greet: ['I watch the storms. When the wind comes, I am the one behind the rock.'], quests: ['kaia-fires', 'kaia-tower'] },
    { id: 'vesper', hero: 'Vesper', name: 'Vesper', role: 'rival', at: vesperAt, face: facing(vesperAt), greet: [], quests: [] },
    { id: 'wick', hero: 'Wick', name: 'Wick', role: 'trader', at: C(-4.6, -0.8), face: 0.6, greet: ['Shards for what you need. Sand is free; everything else costs.'], quests: [] },
  ];
  const quests: QuestDef[] = [
    {
      id: 'main', name: 'Water for the Road', giver: 'pip', main: true,
      intro: ['Fill three jars at the camp spring and pour them into the three wells. Then bring the caravan up the canyon towards the gate, and clear the raiders from the gate.'],
      steps: [
        { ...water(to1, 'west well') },
        { ...water(to2, 'east well') },
        { ...water(to3, 'north well') },
        { verb: 'lead', text: 'Lead the caravan from the camp up the canyon', name: 'The caravan', look: 'cart', speed: 2.2, from: leadFrom, r: 3, path: leadPath },
        { verb: 'fell', text: 'Clear the raiders from the gate', packs: ['gate'] },
        { verb: 'open', text: 'Go to the raiders’ gate', door: 'lair' },
      ] as Step[],
      outro: ['The wells are full and the caravan is through. The raiders’ gate stands open, far in the north. Rest first, then go in.'],
      reward: { shards: 60, boon: true },
    },
    { id: 'bounty', name: 'The Dune Mother', giver: 'pip', intro: ['A hooded woman of sand walks the middle of the canyon. Nobody has crossed it twice. Fell her and the road is quieter.'], steps: [{ verb: 'fell-named', text: 'Fell the Dune Mother', pack: 'mother' }], outro: ['A relic from the dunes. Keep it.'], reward: { shards: 40, relic: true } },
    { id: 'kaia-fires', name: 'The Watch Fires', giver: 'kaia', intro: ['Two watch fires stand cold on the road. Light both, standing by each a moment, and I will see the storm coming.'], steps: [{ verb: 'light', text: 'Light the two watch fires', things: [{ id: 'fire1', at: fire1 }, { id: 'fire2', at: fire2 }], seconds: 2 } as Step], outro: ['Now I see it coming. Take this, from the last storm.'], reward: { shards: 35, boon: true } },
    {
      id: 'kaia-tower', name: 'The Watchtower', giver: 'kaia', intro: ['There is a watchtower on the way to the old fort. Reach it and hold it while I take the count. The raiders will not like it.'],
      steps: [
        { verb: 'reach', text: 'Go to the watchtower', at: towerAt, r: 3 },
        { verb: 'hold', text: 'Hold the watchtower', at: towerAt, r: 3.6, seconds: 16, waves: { kinds: ['raider', 'raider', 'slinger'], every: 8 } },
      ] as Step[],
      outro: ['The count is done. Take your share.'], reward: { shards: 45, boon: true },
    },
  ];
  const doors: (Omit<DoorDef, 'at'> & { at: V })[] = [
    { id: 'lair', piece: 'ruler', name: 'The raiders’ gate', at: S.lairDoor, r: 2.2, wall: { ax: -3.4, az: S.lairZ, bx: 3.4, bz: S.lairZ, r: 0.6, height: 3.8 }, locked: 'The gate is barred from the inside. Pip has a quest about the road.' },
    { id: 'trial', piece: 'trial', name: 'The Dust Court', at: trialAt, r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: gateAt, r: 2.2, needs: { won: 'ruler' }, locked: 'The gate is sealed. Its warden answers only once the Scarab Colossus has fallen.' },
    { id: 'rival', piece: 'rival', name: 'Vesper’s bridge', at: rivalDoor, r: 2, locked: '' },
  ];
  const stoneNames = ['The camp stone', 'The middle stone', 'The gate stone', 'The west stone', 'The bridge stone', 'The fort stone'];

  const m = 1 as const, Wd = worldOf(m), X = Wd.X;
  const placeDefs: Record<string, PlaceDef> = {};
  for (const p of [camp, ...places]) placeDefs[p.id] = { id: p.id, name: p.name, ...X(p.c), r: p.r, stand: X(p.stand) };
  const look = S.look(m, 0, [camp, ...places], 2121) satisfies SandsLook;
  const ring = Math.ceil(Math.max(...rim) + 1.5);
  const floor: Omit<FloorDef, 'arena' | 'cover'> = {
    n: 21, tunedAs: 3, id: 'canyon', name: 'The Storm Canyon', blurb: 'A dry road between red walls, and a wind that crosses it.',
    ring, start: X(C(0, 5.5)), camp: X(C(0, 2)), places: placeDefs, par: Math.round(900 * 2.2),
    shop: { heal: 30, boon: 55, life: 80, hint: 15 },
    law: stormOf(0, ring),
    enemies, packs: packs.map((p) => ({ ...p, at: X(p.at), ...(p.named ? { named: { ...p.named, patrol: p.named.patrol.map(X) } } : {}) })),
    people: people.map((p) => ({ ...p, at: X(p.at), face: Wd.yaw(p.face) })),
    quests: quests.map((q) => ({ ...q, steps: q.steps.map(stepTo(X)) })),
    caches: caches.map((c, i): CacheDef => ({ id: `c${i + 1}`, at: X(c), shards: [25, 30, 20, 25, 30, 25][i], ...(i === 2 ? { boon: true } : {}) })),
    waystones: stoneAt.map((s, i): WaystoneDef => ({ id: `w${i + 1}`, name: stoneNames[i], at: X(s) })),
    lore: { id: 'lore', name: 'The wind stone', at: X(lore), text: ['The caravans came for the water, and the wind came for the caravans.', 'Only the rocks remember the way, and they will not move for you.'] },
    doors: doors.map((d) => ({ ...d, at: X(d.at), ...(d.wall ? { wall: { ...d.wall, ax: r2(RING_X + d.wall.ax), az: r2(RING_Z + d.wall.az), bx: r2(RING_X + d.wall.bx), bz: r2(RING_Z + d.wall.bz) } } : {}) })),
    rival: {
      hero: 'Vesper', goal: 'the bridge', mode: 'duel', at: X(vesperAt), boon: true,
      lines: ['A climber on my road. I am Vesper. I hold the bridge, and nobody crosses without a word with me. Step through the arch and we talk with our hands. Win, and I fight beside you.'],
    },
  };
  return { n, chapter: 'sands', seed, look, floor };
}
