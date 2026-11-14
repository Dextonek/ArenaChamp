import type { CacheDef, DoorDef, EnemySpec, FloorDef, LawDef, PackDef, PersonDef, PlaceDef, QuestDef, Step, WaystoneDef } from '../def';
import type { MoveSpec, PiecesDef, RulerDef } from '../pieces/types';
import type { WarDecor, WarKind, WarLook } from '../warZone';
import type { Look } from '../zone';
import type { GenFloor } from './types';
import { Layout, RING, add, dist, inside, mirrorRim, mulberry, polar, r2, rimToward, roadRoute, shuffle, toMid, unit, worldOf, type V } from './core.ts';

/**
 * The War chapter's generator (pipeline/designs/tower-50.md): floors 42 to 50 made from floor 41's parts (the Field of Banners: its
 * look, the two ghost armies and the ashen soldiers, the law `sides`, its kinds of quest, the Last Marshal's moves), and floor 41 itself
 * grown to the same size with its own people, quests and ids (`makeBannersFloor`). Five times floor 1's ground (the user, 2026-11-14),
 * of any outline: a broad field between low hills, wider east to west than north to south. Run under `node` by
 * `pipeline/tools/gen-floors.ts` (42 to 50) and `pipeline/tools/gen-banners.ts` (41); the game never runs this.
 *
 * Laid out in one frame with the Crimson Host's side to the west and the Azure Host's to the east, and mirrored for the floors whose
 * crimson camps are east. The camera looks north: the camp is in the south, the siege line and the lair behind it in the north.
 *
 * The law (`sides`, f45/laws.ts) asks the layout for three things it cannot check itself: each site of the armies holds one pack of
 * each army with the same mix (one is gone for good once a banner is taken, the other hunts with a leash of 30 m); every pack that
 * belongs to neither army stands well away from the sites (`_worldCheck` counts both armies' units at a site: a site is six already);
 * no quest step names an army's pack or kind.
 */

const ROSTER = ['Ada', 'Anka', 'Auriel', 'Bo', 'Bram', 'Brannoc', 'Cantor', 'Fenna', 'Gus', 'Hank', 'Isolde', 'Kaia', 'Lyra', 'Mabel', 'Marin', 'Mortis', 'Mum', 'Nyx', 'Oblivion', 'Opaline', 'Pip', 'Sefu', 'Shiori', 'Silvane', 'Sirix', 'Tempo', 'Vesper', 'Vitriol', 'Wick', 'Zephyr'];
const RULER_BODIES = ['Zephyr', 'Brannoc', 'Bram', 'Isolde', 'Mortis', 'Hank', 'Sirix', 'Vesper', 'Cantor', 'Oblivion'];
const HANDMADE_GATES = ['Marin', 'Fenna', 'Sefu', 'Opaline', 'Oblivion'];

const FLOOR_NAMES = ['The Mud Fields', 'The Broken Line', 'Ashford', 'The King’s Road', 'The Trench Line', 'The Crows’ Field', 'The Long Retreat', 'The Last Ridge'];
const BLURBS = [
  'Fields the armies ploughed with their boots.', 'A line both armies held, and neither kept.', 'A village that burned twice, once for each banner.', 'The road a king rode down to a battle he did not see end.',
  'Trenches dug for a week’s fight, still dug deeper every night.', 'The crows do not take sides here.', 'A retreat that never reached anywhere.', 'The ridge where the last charge is still coming.',
];
const RULERS: [string, string][] = [['The Iron Marshal', 'Two banners, one sword'], ['The Siege Lord', 'Walls fall where he points'], ['The Ashen General', 'He lost every battle and fought on'], ['The Banner Knight', 'He never lowered the flag'], ['The Crow King', 'He eats what the war leaves'], ['The Black Herald', 'He brought the declaration'], ['The War Drummer', 'Every beat a charge'], ['The Grey Captain', 'Neither army remembers him']];
const TINTS = ['#8a8a96', '#7a7a8a', '#9a8e80', '#6e7486', '#8e8478', '#7e8696', '#948a8a', '#86827a'];
const NAMED = ['The Turncoat', 'Sir Rust', 'The Hollow Captain', 'The Crow Knight', 'Old Ironside', 'The Weeping Lancer', 'The Last Sergeant', 'The Black Standard', 'Sir Ashes', 'The Grey Rider', 'The Headless Herald', 'The Mud Mother', 'The Broken Oath', 'Sir Nobody', 'The Iron Widow', 'The Lost Colonel', 'Mother Crow', 'The Pale Lancer'];
const CHIEFS = ['The Banner Bearer', 'The Standard Bearer', 'The Ash Captain', 'The Grey Sergeant'];
const NPCS = ['Hale', 'Brother Amos', 'Ilse', 'Young Pell', 'Rook', 'Dace', 'Old Merrin', 'Tobin'];
const HOSTS: [string, string][] = [['Crimson Host', 'Azure Host'], ['Crimson Legion', 'Azure Legion'], ['Crimson Oath', 'Azure Oath'], ['Crimson Crown', 'Azure Crown']];
const LORE: [string, string][] = [
  ['Two armies swore to fight until the other fell.', 'Neither has, and neither will say why.'],
  ['The farmers left when the first banner came.', 'The second banner burned what they left.'],
  ['A herald rode out to call a truce.', 'Both armies shot at him. He is riding still.'],
  ['Every morning the drums call the roll.', 'Every morning the dead answer.'],
  ['The crows came for the first battle and stayed.', 'They have never been so fat, or so tired.'],
  ['A climber passed here before you.', 'Both armies saluted, and neither knew why.'],
  ['The king who began this is a hundred years buried.', 'Nobody has told the soldiers.'],
  ['The field was green once, they say.', 'Nobody here remembers a colour but two.'],
  ['The hospital tents belong to neither side.', 'It is the one place both armies agree on.'],
];

/** Where a floor's places stand and what they are. */
type Kind = 'ridge' | 'works' | 'wagons' | 'hill' | 'siege' | 'farm' | 'mill' | 'hospital' | 'keep' | 'camp';
const PLACE_NAMES: Partial<Record<Kind, string[]>> = {
  ridge: ['The ridge', 'The rise', 'The knoll'], works: ['The north works', 'The siege works', 'The battery'], wagons: ['The burned wagons', 'The wagon line', 'The baggage train'],
  hill: ['The hill', 'The drummers’ hill', 'The mound'], farm: ['The burned farm', 'The farmstead'], mill: ['The burned mill', 'The old mill'],
  hospital: ['The field hospital', 'The surgeons’ tents'], keep: ['The ruined keep', 'The broken keep'],
};
interface Place { id: string; kind: Kind; name: string; c: V; r: number; stand: V }

/** Five times floor 1's walkable ground (a circle of 48 m: 7238 m2). */
const AREA = 5 * Math.PI * 48 * 48;
/** Packs that are not an army's stand at least this far from an army's site (`_worldCheck` counts units within 18 m of a point). */
const NEUTRAL_APART = 38;
/** The hostile army's leash (f45/laws.ts `WAR.hostileLeash`): the hold, the escort and the waystones keep clear of it. */
const HOSTILE_LEASH = 30;

/**
 * A field's outline: an ellipse `stretch` times as wide east to west as it is deep, with three low waves on it, scaled to `area`.
 * Radii from +x (east) towards +z (south), as `makeOutline` (core.ts) counts.
 */
function fieldOutline(rnd: () => number, o: { area: number; stretch: number; min: number; max: number; n?: number; waves?: [number, number, number] }) {
  const n = o.n ?? 48, [w1, w2, w3] = o.waves ?? [0.11, 0.08, 0.05];
  const p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;
  const shape = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a) / o.stretch, s = Math.sin(a);
    return (1 / Math.sqrt(c * c + s * s)) * (1 + w1 * Math.sin(a + p1) + w2 * Math.sin(2 * a + p2) + w3 * Math.sin(3 * a + p3));
  });
  const areaOf = (rs: number[]) => 0.5 * Math.sin((Math.PI * 2) / n) * rs.reduce((s, r, i) => s + r * rs[(i + 1) % n], 0);
  let k = Math.sqrt(o.area / areaOf(shape)), rs = shape;
  for (let i = 0; i < 3; i++) {
    rs = shape.map((s) => Math.max(o.min, Math.min(o.max, s * k)));
    k *= Math.sqrt(o.area / areaOf(rs));
  }
  return rs.map(r2);
}

/** The two armies (floor 41's numbers; the game grows them by the floor's tuned number). */
function armies(shard: (x: number) => number): Record<string, EnemySpec> {
  const e: Record<string, EnemySpec> = {};
  for (const a of ['r', 'b'] as const) {
    const col = a === 'r' ? '#e86a5a' : '#6a9aff', side = a === 'r' ? 'Crimson' : 'Azure';
    e[`footman-${a}`] = { id: `footman-${a}`, name: `${side} footman`, blurb: 'Strikes up close.', look: `footman-${a}` as EnemySpec['look'], melee: true, hp: 95, share: 0.028, every: 1.7, speed: 3.1, scale: 1.2, shards: shard(4), color: col };
    e[`bowman-${a}`] = { id: `bowman-${a}`, name: `${side} bowman`, blurb: 'Shoots from a distance.', look: `bowman-${a}` as EnemySpec['look'], melee: false, hp: 60, share: 0.024, every: 2.5, speed: 2.8, range: 10, scale: 1.2, shards: shard(5), color: col };
    e[`knight-${a}`] = { id: `knight-${a}`, name: `${side} knight`, blurb: 'Charges, and hits hard.', look: `knight-${a}` as EnemySpec['look'], melee: true, hp: 190, share: 0.055, every: 3.0, speed: 4.6, scale: 1.3, shards: shard(8), color: col };
  }
  return e;
}
/** The soldiers of neither army, and the two named enemies. */
function neutrals(o: { shard: (x: number) => number; chief?: string; named1?: string; named2?: string }): Record<string, EnemySpec> {
  const s = o.shard, look = (x: string) => x as EnemySpec['look'];
  const e: Record<string, EnemySpec> = {
    ashen: { id: 'ashen', name: 'Ashen soldier', blurb: 'Belongs to neither army.', look: look('ashen'), melee: true, hp: 80, share: 0.026, every: 1.7, speed: 3.0, scale: 1.2, shards: s(3), color: '#c0c8d8' },
    bearer: { id: 'bearer', name: o.chief ?? 'The Banner Bearer', blurb: 'Carries the dead flag of both.', look: look('bearer'), melee: true, hp: 480, share: 0.06, every: 1.8, speed: 3.0, scale: 1.5, shards: s(30), color: '#ffd060' },
    deserter: { id: 'deserter', name: o.named1 ?? 'The Deserter Knight', blurb: 'Walks the field and strikes hard.', look: look('deserter'), melee: true, hp: 700, share: 0.075, every: 2.2, speed: 2.8, scale: 1.4, shards: s(45), color: '#b8d0a0' },
  };
  if (o.named2) e.champion = { id: 'champion', name: o.named2, blurb: 'Walks the hospital’s side and strikes hard.', look: look('bearer'), melee: true, hp: 600, share: 0.068, every: 2.0, speed: 2.9, scale: 1.65, shards: s(40), color: '#e0c890' };
  return e;
}

/** A site's two packs, one for each army, the same mix (the law drops one and sets the other hunting). */
const site = (id: string, at: V, mix: Record<string, number>): PackDef[] =>
  (['r', 'b'] as const).map((a) => ({ id: `${id}-${a}`, at, leash: 24, mix: Object.entries(mix).map(([k, n]) => ({ kind: `${k}-${a}`, n })) }));

/** `_worldCheck`'s count, in the generator: the most units of all packs (both armies, a named one at its first patrol point) within 18 m of a point. */
function mostUnitsNear(packs: PackDef[], rim: number[]) {
  const R = Math.max(...rim) + 2;
  let worst = 0;
  for (let x = -R; x <= R; x += 3) for (let z = -R; z <= R; z += 3) {
    let sum = 0;
    for (const p of packs) {
      const h = p.named ? p.named.patrol[0] : p.at;
      if (Math.hypot(h.x - x, h.z - z) < 18) sum += p.mix.reduce((a, m) => a + m.n, 0) + (p.elite ? 1 : 0);
    }
    worst = Math.max(worst, sum);
  }
  return worst;
}

/**
 * The parts both kinds of floor share: the outline and its walls, the camp and its two banner stands, the siege line across the north
 * with the lair behind it, each place's pieces, roads, scattered cover, and the move into the world.
 */
class War {
  readonly L: Layout;
  readonly rim: number[];
  readonly kinds: [number, WarKind][] = [];
  readonly decor: WarDecor[] = [];
  readonly roads: V[][] = [];
  readonly camp: Place;
  readonly lairZ: number;
  readonly lairDoor: V;
  /** The siege line's ends (x), where it meets the outline (and a little past it). */
  readonly lineW: number;
  readonly lineE: number;
  readonly stands: [V, V];
  readonly rnd: () => number;
  readonly n: number;
  constructor(rim: number[], rnd: () => number, n: number) {
    this.rim = rim;
    this.rnd = rnd;
    this.n = n;
    const L = (this.L = new Layout(rim, rnd, n));
    const southR = rimToward(rim, 180), northR = rimToward(rim, 0);
    this.camp = { id: 'camp', kind: 'camp', name: 'The camp', c: { x: 0, z: r2(southR - 16) }, r: 7, stand: { x: 0, z: r2(southR - 12.5) } };
    L.edges();
    // The camp: a brazier fire, two pavilions, supplies, a drum; the two banner stands (the law's) either side.
    L.pill('fire', this.C(0, -0.5), 0.9, 0.9); L.pill('tent', this.C(-8.5, 2.5), 1.8, 2.8); this.mark('pavilion'); L.pill('tent', this.C(8.5, -1.5), 1.8, 2.8); this.mark('pavilion');
    L.pill('crate', this.C(-5, -4), 0.8, 1.2); L.pill('crate', this.C(5.4, 2.2), 0.8, 1.2); L.pill('barrel', this.C(3.2, -4.4), 0.7, 0.9); this.mark('drum');
    L.reserve(this.camp.c, 11);
    this.stands = [L.reserve(this.C(-12.5, -4), 2.6), L.reserve(this.C(12.5, -4), 2.6)];
    // The siege line: a palisade across the whole north, edge to edge, with a gate in the middle (the lair's door); behind it the lair.
    this.lairZ = r2(-northR + 9);
    this.lairDoor = { x: 0, z: r2(-northR + 5) };
    const z = this.lairZ;
    const end = (s: 1 | -1) => { let x = 4; while (x < 200 && inside(rim, { x: s * x, z }) > -1) x += 1; return r2(s * (x + 4)); };
    this.lineW = end(-1); this.lineE = end(1);
    for (const [a, b] of [[this.lineW, -3.4], [3.4, this.lineE]] as const) {
      const segs = Math.max(1, Math.ceil(Math.abs(b - a) / 12));
      for (let i = 0; i < segs; i++) { L.wall('house', { x: r2(a + ((b - a) * i) / segs), z }, { x: r2(a + ((b - a) * (i + 1)) / segs), z }, 0.5, 3.8); this.mark('palisade'); }
    }
    // the gate's two towers either side of the door
    for (const s of [-1, 1]) { L.pill('post', { x: s * 4.6, z: r2(z - 0.4) }, 1.1, 5.6); this.mark('gatetower'); }
    L.reserve({ x: 0, z: z + 2 }, 6);
  }
  /** A spot round the camp. */
  C(dx: number, dz: number): V { return { x: dx, z: r2(this.camp.c.z + dz) }; }
  /** The last piece's look is the zone's own `k`. */
  mark(k: WarKind) { this.kinds.push([this.L.cover.length - 1, k]); }
  pill(look: Look, c: V, r: number, h: number, k?: WarKind) { this.L.pill(look, c, r, h); if (k) this.mark(k); }
  wall(look: Look, a: V, b: V, r: number, h: number, k?: WarKind) { this.L.wall(look, a, b, r, h); if (k) this.mark(k); }
  /** A spot at a bearing, `f` of the way from the middle to the outline. */
  at(deg: number, f: number) { return polar(deg, rimToward(this.rim, deg) * f); }

  /** A place's own pieces round its middle; then its ground and stand are kept clear. */
  dress(p: Place, face?: V) {
    const rnd = this.rnd, out = face ?? unit(p.c), tan = { x: -out.z, z: out.x };
    const Q = (dOut: number, dTan: number): V => add(add(p.c, out, dOut), tan, dTan);
    switch (p.kind) {
      case 'ridge':
        // a standard on its stone foot in the middle (the main quest's), a sill of great shields across the back, two rocks
        this.pill('post', p.c, 0.9, 5, 'standard');
        this.wall('stall', Q(6.4, -3.4), Q(6.4, 3.4), 0.35, 1.5, 'shield');
        this.pill('rock', Q(3, 5.6), 1.2, 1.5); this.pill('rock', Q(3, -5.6), 1.2, 1.5);
        this.pill('crate', Q(-2.5, 6.2), 0.9, 0.9, 'shieldpile');
        break;
      case 'works':
        // a standard in the middle, two catapults with the arm down, a wagon of stones
        this.pill('post', p.c, 0.9, 5, 'standard');
        this.pill('post', Q(4, -6.2), 1.5, 1.8, 'catapult'); this.pill('post', Q(4.5, 6), 1.5, 1.8, 'catapult');
        this.wall('hull', Q(-1.5, -6.5), Q(-4.5, -5), 0.9, 1.4, 'wagon');
        break;
      case 'wagons':
        // three wagons on their sides, a tent, planted spears
        this.wall('hull', Q(4.5, -2.5), Q(6, 1), 0.9, 1.5, 'wagon'); this.wall('hull', Q(-1, 5.2), Q(2.5, 6.5), 0.9, 1.5, 'wagon'); this.wall('hull', Q(1, -6.2), Q(-2.4, -6.8), 0.9, 1.5, 'wagon');
        this.pill('tent', Q(-3.5, -3.2), 1.5, 2.4, 'pavilion');
        this.pill('post', Q(5.5, 5), 0.5, 1.5, 'stake');
        break;
      case 'hill':
        // a drum on the hill's top, shields fallen round it, two standards with no cloth (the hold is round the middle)
        this.pill('barrel', Q(3.4, 0), 1.1, 1.2, 'drum');
        this.pill('crate', Q(1, 5.2), 0.9, 0.9, 'shieldpile'); this.pill('crate', Q(-1.5, -5.4), 0.9, 0.9, 'shieldpile');
        this.pill('post', Q(5.8, -4.5), 0.7, 4.4, 'standard'); this.pill('post', Q(5.6, 4.8), 0.7, 4.4, 'standard');
        break;
      case 'siege':
        // stakes before the line, a catapult, a siege tower fallen along one side
        this.pill('post', Q(-3.5, -5.5), 0.5, 1.5, 'stake'); this.pill('post', Q(-4, 5.2), 0.5, 1.5, 'stake');
        this.wall('hull', Q(3.5, -9.5), Q(-3.5, -11), 1.5, 3.2, 'siegetower');
        this.pill('post', Q(2, 9), 1.4, 1.8, 'catapult');
        break;
      case 'farm':
        // a farmhouse burned to its walls, open to the middle; hay stacks; a fence
        this.wall('house', Q(5.5, -4.5), Q(5.5, 4.5), 0.45, 3.2, 'farmwall');
        this.wall('house', Q(5.5, -4.5), Q(0.5, -4.5), 0.45, 3.2, 'farmwall'); this.wall('house', Q(5.5, 4.5), Q(1.5, 4.5), 0.45, 2.4, 'farmwall');
        this.pill('barrel', Q(-3.5, 6.5), 1.0, 1.6, 'hay'); this.pill('barrel', Q(-4.5, -6.2), 1.0, 1.4, 'hay');
        this.wall('stall', Q(-6.5, -3), Q(-6.5, 2.5), 0.25, 1.0, 'fence');
        break;
      case 'mill':
        // a mill tower burned hollow, its sails broken; sacks; a cart
        this.pill('lighthouse', Q(4.5, 0), 2.4, 8.5, 'mill');
        this.pill('crate', Q(1, 5.5), 0.8, 1.1, 'sacks'); this.pill('crate', Q(1.5, -5.6), 0.8, 1.1, 'sacks');
        this.wall('hull', Q(-3.5, 5.5), Q(-5.5, 3), 0.8, 1.3, 'wagon');
        break;
      case 'hospital':
        // three white pavilions in an arc open to the middle, cots, a brazier
        for (const t of [-6, 0, 6]) this.pill('tent', Q(5.2 - Math.abs(t) * 0.25, t), 1.7, 2.6, 'whitetent');
        this.pill('crate', Q(0.5, -5), 0.7, 0.6, 'cot'); this.pill('crate', Q(0.5, 5), 0.7, 0.6, 'cot');
        this.pill('fire', Q(-2.5, -2.5), 0.6, 0.9);
        break;
      case 'keep':
        // the broken walls of a keep in a horseshoe open to the middle, a broken tower at its back
        for (const deg of [-100, -60, 60, 100]) { const a = (deg * Math.PI) / 180; this.wall('house', add(add(p.c, out, Math.cos(a) * 7), tan, Math.sin(a) * 7), add(add(p.c, out, Math.cos(a + 0.5) * 7), tan, Math.sin(a + 0.5) * 7), 0.6, 3 + rnd() * 1.6, 'ruinwall'); }
        this.pill('lighthouse', Q(7.4, 0), 2.6, 9 + rnd() * 2, 'ruintower');
        this.pill('rock', Q(-1.5, 7.8), 1.0, 1.0, 'rubble');
        break;
      case 'camp':
        break;
    }
    this.L.reserve(p.c, p.r + 1.5);
    this.L.reserve(p.stand, 3);
  }

  /** The edge of a place towards a point; the keep is left by its mouth (its sides are walls). */
  edge(p: Place, to: V): V {
    const e = p.kind === 'keep' ? add(p.c, toMid(p.c), p.r + 1) : add(p.c, unit({ x: to.x - p.c.x, z: to.z - p.c.z }), p.r - 1);
    return { x: r2(e.x), z: r2(e.z) };
  }
  road(a: V, b: V, bends = 1, amp = 4) { const r = this.L.road(a, b, bends, amp, 2.6); this.roads.push(r); return r; }

  /** Scattered cover in what is left: rocks, stake hedges, crates, shield piles, so a way across has to bend. */
  scatter(o: { small: number; keepOff: { c: V; r: number }[] }) {
    const L = this.L, rnd = this.rnd;
    for (let i = 0, made = 0; i < 9000 && made < o.small; i++) {
      const p = polar(L.range(-180, 180), Math.sqrt(rnd()) * 140);
      const t = rnd();
      const kind: [Look, WarKind | undefined, number, number] = t < 0.36 ? ['rock', undefined, L.range(1.0, 1.7), 0] : t < 0.58 ? ['post', 'stake', 0.5, 1.4] : t < 0.78 ? ['crate', undefined, 0.8, 1.2] : t < 0.9 ? ['crate', 'shieldpile', 0.9, 0.9] : ['barrel', 'barrel', 0.6, 1.0];
      const [look, k, r] = kind;
      if (inside(this.rim, p) < 3 + r || L.inKeep(p, r + 0.4) || L.hitsCover(p, r + 3.2) || o.keepOff.some((q) => dist(q.c, p) < q.r + r)) continue;
      // under the siege line's walls and behind them: nothing
      if (p.z < this.lairZ + 6) continue;
      this.pill(look, p, r2(r), r2(look === 'rock' ? r * L.range(1.2, 1.6) : kind[3] || (look === 'post' ? 1.4 : look === 'crate' ? (k ? 0.9 : 1.2) : 1)), k);
      made++;
    }
  }

  /** The look the zone is drawn from, in the world (`m` -1: the crimson side in the east). */
  look(m: 1 | -1, places: Place[], seed: number): WarLook {
    const W = worldOf(m), X = W.X;
    return {
      rim: m === 1 ? this.rim : mirrorRim(this.rim),
      pieces: this.L.cover.map(W.piece),
      kinds: this.kinds,
      decor: this.decor.map((d) => ({ ...d, ...X(d), yaw: W.yaw(d.yaw) })),
      places: places.map((p) => ({ id: p.id, kind: p.kind, ...X(p.c), r: p.r })),
      paths: this.roads.map((r) => r.map(W.off)),
      crimson: m === 1 ? -1 : 1,
      line: { z: r2(RING.z + this.lairZ), w: r2(m === 1 ? this.lineW : -this.lineE), e: r2(m === 1 ? this.lineE : -this.lineW) },
      seed,
    };
  }
}

/**
 * A road with a point every `step` m: an escort walks only while the hero is near (quests.ts), and the bot walks to its next point, so
 * points far apart had the bot run ahead, the escort stop and the bot walk back (the Sands' first caravan took 19 minutes).
 */
function dense(pts: V[], step = 6): V[] {
  const out: V[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], k = Math.max(1, Math.round(dist(a, b) / step));
    for (let j = 1; j <= k; j++) out.push({ x: r2(a.x + ((b.x - a.x) * j) / k), z: r2(a.z + ((b.z - a.z) * j) / k) });
  }
  return out;
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
function placeAll(S: War, slots: { id: string; kind: Kind; deg: [number, number]; f: [number, number]; r?: number; name?: string }[], packIds: string[], packApart: number) {
  const L = S.L, places: Place[] = [];
  for (const s of slots) {
    let c: V | null = null;
    for (let i = 0; i < 500; i++) {
      const p = S.at(L.range(...s.deg), L.range(...s.f));
      if (places.some((q) => dist(q.c, p) < (packIds.includes(q.id) && packIds.includes(s.id) ? packApart : 28))) continue;
      if (dist(p, S.camp.c) < 32 || p.z < S.lairZ + 22 || inside(S.rim, p) < 14) continue;
      // a pack's place stays clear of the siege line's guard (it stands 10 m before the line's gate)
      if (packIds.includes(s.id) && dist(p, { x: 0, z: S.lairZ + 10 }) < NEUTRAL_APART + 4) continue;
      c = p;
      break;
    }
    if (!c) throw new Error(`floor ${S.n}: no room for ${s.id}`);
    const back = s.kind === 'keep' ? 1.5 : s.kind === 'hill' ? 0 : s.kind === 'mill' ? 2 : s.kind === 'hospital' ? 1 : 0;
    const cc = { x: r2(c.x), z: r2(c.z) }, st = add(cc, toMid(cc), back);
    places.push({ id: s.id, kind: s.kind, name: s.name ?? L.pick(PLACE_NAMES[s.kind] ?? ['The place']), c: cc, r: s.r ?? 8, stand: { x: r2(st.x), z: r2(st.z) } });
  }
  return places;
}

/** The checks the law needs and the tools count, on the canonical layout; throws (the bake tries the next seed). */
function lawChecks(n: number, o: { packs: PackDef[]; sites: V[]; rim: number[]; hold: V; lead: V[]; stones: V[]; quests: QuestDef[] }) {
  const armyIds = new Set(o.packs.filter((p) => /-(r|b)$/.test(p.id)).map((p) => p.id));
  const neutral = o.packs.filter((p) => !armyIds.has(p.id));
  for (const p of neutral) {
    const h = p.named ? p.named.patrol[0] : p.at;
    const near = o.sites.find((s) => dist(s, h) < NEUTRAL_APART);
    if (near) throw new Error(`floor ${n}: ${p.id} ${dist(near, h).toFixed(1)} m from an army's site`);
  }
  const most = mostUnitsNear(o.packs, o.rim);
  if (most > 6) throw new Error(`floor ${n}: ${most} units near one spot`);
  const homes = o.packs.flatMap((p) => (p.named ? p.named.patrol : [p.at]));
  if (o.sites.some((s) => dist(s, o.hold) < HOSTILE_LEASH + 6)) throw new Error(`floor ${n}: the hold within reach of an army's site`);
  if (o.packs.some((p) => !p.named && dist(p.at, o.hold) < 30)) throw new Error(`floor ${n}: the hold too near a pack`);
  for (const q of o.lead) if (o.sites.some((s) => dist(s, q) < 24)) throw new Error(`floor ${n}: the escort's road passes an army's site`);
  for (const w of o.stones) if (homes.some((h) => dist(h, w) < 15)) throw new Error(`floor ${n}: a waystone next to a pack`);
  for (const q of o.quests) for (const s of q.steps) {
    const names = s.verb === 'fell' ? s.packs : s.verb === 'fell-named' ? [s.pack] : s.verb === 'hold' ? s.waves.kinds : [];
    if (names.some((x) => /-(r|b)$/.test(x))) throw new Error(`floor ${n}: quest ${q.id} names an army's pack or kind`);
  }
}

export interface WarGenOptions { n: number; attempt?: number }

/** A made floor of the War, 42 to 50 (50 is the crown). */
export function makeWarFloor(o: WarGenOptions): GenFloor {
  const n = o.n, seed = n * 1000 + (o.attempt ?? 0), rnd = mulberry(seed);
  if (n < 42 || n > 50) throw new Error(`floor ${n}: the War's made floors are 42 to 50`);
  const m: 1 | -1 = n % 2 === 0 ? -1 : 1; // even floors have the crimson side in the east
  const k = (n - 41) / 9; // 0 at floor 41, 1 at floor 50
  const fi = n - 42;
  const rim = fieldOutline(rnd, { area: AREA, stretch: 1.12 + 0.3 * rnd(), min: 70, max: 138 });
  const S = new War(rim, rnd, n), L = S.L, C = (dx: number, dz: number) => S.C(dx, dz);
  const range = (a: number, b: number) => L.range(a, b);
  const pick = <T>(xs: readonly T[]) => L.pick(xs);
  const at = (deg: number, f: number) => S.at(deg, f);
  const camp = S.camp;

  // --- who is where: gatekeepers all different over the chapter, people five at a time round the rest ---------------------------
  const order = shuffle(ROSTER.filter((h) => !HANDMADE_GATES.includes(h)), mulberry(5001));
  const gates = order.slice(0, 9), folk = [...order.slice(9), ...HANDMADE_GATES];
  const who = (i: number) => folk[(fi * 5 + i) % folk.length];
  const keeperHero = who(0), giverHero = who(1), traderHero = who(2), rivalHero = who(3), healerHero = who(4), gateHero = gates[fi];
  const turn = fi % RULER_BODIES.length, round = [...RULER_BODIES.slice(turn), ...RULER_BODIES.slice(0, turn)];
  const rulerBody = round.find((b) => ![keeperHero, giverHero, traderHero, rivalHero, healerHero, gateHero].includes(b)) ?? 'Zephyr';

  // --- eight places on two rings: the crimson side west, the azure side east; the siege line in the north -----------------------
  const ridgeWord = pick(['ridge', 'rise', 'knoll']);
  const slots: { id: string; kind: Kind; deg: [number, number]; f: [number, number]; r?: number; name?: string }[] = [
    { id: 'a', kind: 'ridge', deg: [-118, -98], f: [0.62, 0.74], name: `The ${m === 1 ? 'west' : 'east'} ${ridgeWord}` }, // the west ridge: a site, its standard
    { id: 'v', kind: 'hospital', deg: [-90, -72], f: [0.7, 0.8], r: 9 }, // the west: the field hospital (no pack)
    { id: 'b', kind: 'keep', deg: [-58, -40], f: [0.7, 0.8] }, // the north-west: the ruined keep (ashen, later floors)
    { id: 'f', kind: 'hill', deg: [-12, 12], f: [0.24, 0.36], r: 9 }, // the middle north: the hill (the hold)
    { id: 'c', kind: 'works', deg: [30, 50], f: [0.68, 0.78] }, // the north-east: a site, its standard
    { id: 'e', kind: 'ridge', deg: [84, 104], f: [0.66, 0.76], name: `The ${m === 1 ? 'east' : 'west'} ${ridgeWord}` }, // the east ridge: a site, its standard
    { id: 'd', kind: 'wagons', deg: [118, 138], f: [0.62, 0.72] }, // the south-east: a site, the burned wagons
    { id: 'h', kind: pick(['farm', 'mill'] as const), deg: [150, 215], f: [0.3, 0.42] }, // the inner south: a farm, the escort's start
  ];
  const sitesIds = ['a', 'c', 'e', 'd'];
  const places = placeAll(S, slots, [...sitesIds, 'b'], 46);
  const P = (id: string) => places.find((p) => p.id === id)!;
  const A = P('a'), B = P('b'), D = P('d'), Fh = P('f'), Cw = P('c'), E = P('e'), Vh = P('v'), H = P('h');
  const siege: Place = { id: 'siege', kind: 'siege', name: 'The siege line', c: { x: 0, z: r2(S.lairZ + 10) }, r: 7, stand: { x: 0, z: r2(S.lairZ + 15) } };
  places.push(siege);
  // The farm (or mill) in the inner south turns its back east or west: facing out (south) its walls stood on the road to the camp,
  // and the escort's cart, which starts there, stood against them for good (floors 46 and 47's first routes).
  for (const p of places) S.dress(p, p === H ? { x: H.c.x < 0 ? -1 : 1, z: 0 } : undefined);
  const siteSpots = [A.c, Cw.c, E.c, D.c];

  // --- roads: the camp to A and to D; a ring through the outer places; spokes to the inner ones; the middle to the siege line -----
  const outer = [A, Vh, B, Cw, E, D];
  S.road(C(-2.5, -6), S.edge(A, C(-2.5, -6)), 1, 4); S.road(C(3, -6), S.edge(D, C(3, -6)), 1, 4);
  for (let i = 1; i < outer.length; i++) S.road(S.edge(outer[i - 1], outer[i].c), S.edge(outer[i], outer[i - 1].c), 2, 5);
  const middle: V = { x: r2(range(-6, 6)), z: r2(range(2, 10)) };
  L.reserve(middle, 3);
  S.road(S.edge(Fh, middle), middle, 1, 2);
  { const near = [B, Cw].reduce((b, q) => (dist(q.c, Fh.c) < dist(b.c, Fh.c) ? q : b)); S.road(S.edge(near, Fh.c), S.edge(Fh, near.c), 1, 3); }
  S.road(C(0, -7), middle, 2, 4);
  S.road(S.edge(H, C(0, -7)), C(0, -7.5), 1, 2);
  S.road(S.edge(H, middle), middle, 1, 2);
  S.road(S.edge(Fh, siege.c), S.edge(siege, Fh.c), 1, 3);
  S.road(S.edge(siege, S.lairDoor), add(S.lairDoor, { x: 0, z: 6 }), 0, 0);

  // --- the packs' homes first, then every spot the quests and people use -----------------------------------------------------------
  const late = n >= 46;
  const keepPack = n >= 44, keepElite = n >= 48;
  const siegeAt = siege.c;
  const homes = [...siteSpots, siegeAt, ...(keepPack ? [B.c] : [])];
  const awayFromPacks = (d: number) => (q: V) => homes.every((s) => dist(s, q) >= d);
  const awayFromSites = (d: number) => (q: V) => siteSpots.every((s) => dist(s, q) >= d);
  const gate = L.reserve(L.spot(C(pick([-17, 17]), 7), 2, 2.2), 3.5);
  const trial = L.reserve(L.spot(at(range(-150, -134), 0.86), 4, 2, awayFromPacks(22)), 3.5);
  const rivalDoor = L.reserve(L.spot(at(range(150, 165), 0.84), 4, 2, awayFromPacks(22)), 3.5);
  const rivalAt = L.reserve(L.spot(add(rivalDoor, toMid(rivalDoor), 5), 1.5, 1.2), 2);
  const healerAt = L.reserve(L.spot(Vh.stand, 2, 1.2), 2);
  const hold = Fh.c;
  const clothFrom = B.stand, clothTo = Vh.stand; // the keep's mouth, the hospital's middle (both kept clear)
  const fire1 = L.reserve(L.spot(add(H.stand, toMid(H.c), 4), 3, 1.5, awayFromPacks(16)), 2.5);
  const fire2 = L.reserve(L.spot(at(range(55, 75), 0.5), 4, 1.5, awayFromPacks(20)), 2.5);
  const lore = L.reserve(L.spot(at(range(-170, -158), 0.62), 4, 1.5, awayFromPacks(15)), 2.5);
  const caches = [at(range(-170, -155), 0.86), at(range(-100, -90), 0.9), at(range(-25, -10), 0.62), at(range(15, 25), 0.88), at(range(62, 78), 0.86), at(range(140, 150), 0.88)]
    .map((p) => L.reserve(L.spot(p, 4, 1.5, awayFromPacks(8)), 2.5));
  const stoneNear = [A, Vh, B, Cw, D, H];
  const stones = stoneNear.map((p) => L.reserve(L.spot(add(p.c, toMid(p.c), 17), 3, 1.5, awayFromPacks(16)), 2.5));

  // Two named enemies of neither army: one walks a loop round the middle, one the hospital's side. Their ways are kept clear.
  const clearOf = (q: V) => stones.every((s) => dist(s, q) >= 17) && dist(q, hold) >= 18;
  const patrol1: V[] = [-60, 30, 120, 210].map((a, i) => L.spot(polar(a + range(-15, 15), range(18, 26)), 3, 2, (q) => awayFromSites(i === 0 ? NEUTRAL_APART + 2 : 28)(q) && awayFromPacks(20)(q) && clearOf(q)));
  for (let i = 0; i < 4; i++) L.lane(patrol1[i], patrol1[(i + 1) % 4], 1.8);
  const patrol2: V[] = [at(range(-150, -138), 0.45), at(range(-118, -106), 0.45), at(range(-88, -76), 0.48), at(range(-62, -52), 0.45)]
    .map((p, i) => L.spot(p, 5, 2, (q) => awayFromSites(i === 0 ? NEUTRAL_APART + 2 : 26)(q) && awayFromPacks(20)(q) && clearOf(q)));
  for (let i = 1; i < 4; i++) L.lane(patrol2[i - 1], patrol2[i], 1.8);
  const patrol2Loop = [...patrol2, ...patrol2.slice(1, 3).reverse()];

  // The escort: a farmer's cart from the burned farm (or mill) to the camp, along the road between them; short, a point every 6 m.
  const toCamp = unit({ x: C(0, -7).x - H.c.x, z: C(0, -7).z - H.c.z });
  const leadFrom = L.reserve(L.spot(add(H.c, toCamp, H.r + 3), 1.5, 1.5), 2);
  const road = roadRoute(S.roads, S.edge(H, C(0, -7)), C(0, -7.5)).map((p) => ({ x: r2(p.x), z: r2(p.z) })).filter((q) => dist(q, H.c) > dist(leadFrom, H.c));
  const leadPath = dense([leadFrom, ...road]).slice(1);
  for (let i = 1; i < leadPath.length; i++) L.lane(leadPath[i - 1], leadPath[i], 1.6);
  // the cart walks no cover (its road is a lane, kept clear from here; what stood before is checked)
  for (let i = 0; i < leadPath.length; i++) {
    const a = i ? leadPath[i - 1] : leadFrom, b = leadPath[i];
    for (let k = 0; k <= 8; k++) if (L.hitsCover(add(a, { x: b.x - a.x, z: b.z - a.z }, k / 8), 0.6)) throw new Error(`floor ${n}: the escort's road runs into cover`);
  }
  const leadLen = leadPath.reduce((s, q, i) => s + (i ? dist(leadPath[i - 1], q) : dist(leadFrom, q)), 0);
  if (leadLen > 75) throw new Error(`floor ${n}: the escort's road is ${leadLen.toFixed(0)} m`);
  const leadNpc = pick(NPCS);

  // --- scattered cover in what is left ------------------------------------------------------------------------------------------
  S.scatter({ small: 64 + Math.round(10 * k), keepOff: places.map((p) => ({ c: p.c, r: p.r + 2 })) });

  // --- enemies and packs: floor 41's, grown only by the game's own `floorNumbers` (tunedAs below); the law's variants grow gently ----
  const shard = (x: number) => Math.round(x * (1 + 0.05 * (n - 41)));
  const named1 = NAMED[(2 * fi) % NAMED.length], named2 = NAMED[(2 * fi + 1) % NAMED.length];
  const chief = pick(CHIEFS);
  const enemies = { ...armies(shard), ...neutrals({ shard, chief, named1, named2 }) };
  // Each site: three of each army. Bowmen early; a knight in more of them as the chapter climbs.
  const mixes: Record<string, number>[] = [{ footman: 2, bowman: 1 }, { footman: 1, bowman: 1, knight: 1 }, { footman: 2, knight: 1 }, { footman: 1, bowman: 2 }];
  const knights = Math.min(4, Math.round(1 + 3 * k)); // sites with a knight: 1 (42) to 4 (50)
  const siteMix = (i: number) => (i < knights ? mixes[[1, 2, 1, 2][i]] : mixes[[0, 3, 0, 3][i]]);
  const siteIds = ['a', 'c', 'e', 'd'];
  const packs: PackDef[] = [
    ...siteIds.flatMap((id, i) => site(id, siteSpots[i], siteMix(i))),
    { id: 'siege', at: siegeAt, leash: 24, mix: [{ kind: 'ashen', n: 3 }], elite: 'bearer' },
    ...(keepPack ? [{ id: 'keep', at: B.c, leash: 24, mix: [{ kind: 'ashen', n: keepElite ? 2 : 3 }], ...(keepElite ? { elite: 'bearer' } : {}) } as PackDef] : []),
    { id: 'named1', at: patrol1[0], leash: 24, mix: [{ kind: 'deserter', n: 1 }], named: { name: named1, speed: 1.6, patrol: patrol1, bounty: { shards: shard(45), relic: true } } },
    { id: 'named2', at: patrol2Loop[0], leash: 24, mix: [{ kind: 'champion', n: 1 }], named: { name: named2, speed: 1.7, patrol: patrol2Loop, bounty: { shards: shard(40), relic: false } } },
  ];
  const [crimsonName, azureName] = HOSTS[fi % HOSTS.length];

  // --- the set pieces: the ruler (the Last Marshal's moves, another body and name), the gate, the trial, the rival -----------------
  // Floor 50 is the chapter's crown and the Climb's last floor: behind the lair is the Raid's Ash and Ember, alone, at the second tier.
  const crown = n === 50 ? ('ash' as const) : undefined;
  const [rulerName, rulerTitle] = crown ? ['Ash and Ember', 'The fire after the war'] : RULERS[fi % RULERS.length];
  const extra: [string, MoveSpec] = pick([
    ['volley', { use: 'volley', name: pick(['Arrow Rain', 'The Archers Loose', 'A Sky of Arrows']), share: 0.07, cooldown: 7 }],
    ['fan', { use: 'fan', share: 0.06 }],
    ['sweep', { use: 'sweep', name: pick(['The Charge', 'The Line Advances']), share: 0.08, cooldown: 12 }],
  ] as [string, MoveSpec][]);
  const ruler: RulerDef = {
    name: rulerName, title: rulerTitle, stand: rulerBody, tint: TINTS[fi % TINTS.length], scale: r2(range(2.3, 2.6)), hp: Math.round((3800 * (1 + 0.02 * (n - 41))) / 50) * 50, speed: 2.3, stagger: { max: 100, kneel: 5 },
    room: 'battlefield',
    moves: {
      guard: { use: 'call', name: pick(['The Guard Marches', 'The Reserve Comes Up', 'The Drums Call']), count: 2, cooldown: 24 },
      cleave: { use: 'cleave', share: 0.08 },
      lunge: { use: 'lunge', share: 0.08 },
      rake: { use: 'spokes', name: pick(['The Line Burns', 'Fire on the Line', 'The Burning Field']), share: 0.08, cooldown: 14 },
      [extra[0]]: extra[1],
    },
    phases: [
      { name: `${rulerName} wakes`, at: 1, moves: ['cleave', 'lunge'], gap: [1.4, 2.2] },
      { name: 'The guard marches', at: 0.66, opener: 'guard', moves: ['guard', 'cleave', 'lunge', extra[0]], gap: [1.3, 2.1] },
      { name: pick(['Alone on a horse of smoke', 'The last charge', 'Under no banner']), at: 0.33, moves: ['cleave', 'lunge', 'rake', extra[0]], gap: [0.9, 1.5] },
    ],
    sentries: { look: 'standard', spots: [[180, 8.6]], hp: Math.round(220 * (1 + 0.02 * (n - 41))), fall: { kneel: true }, from: 0 },
    line: crown ? 'A Raid boss, alone, at the second tier: the last floor of the Climb' : 'Fell the standard and his guard kneels',
  };
  const twists = ['giant', 'swift', 'warded'] as const;
  const pieces: PiecesDef = {
    floor: n, hard: r2(1.55 + 0.016 * (n - 41)), // floor 41 is 1.55, floor 50 1.69
    ruler,
    // CPU level 3: at level 4 the route bot lost floor 48's gate (Tempo) 37 times with Bram and floor 49's (Mum) 44 times with Lyra.
    gate: { hero: gateHero, arena: 'battlefield', level: 3, twist: { kind: 'hazard', name: 'Arrows fall on a line' } },
    trial: { kind: (['hold', 'gauntlet', 'break', 'horde'] as const)[n % 4], height: n < 46 ? 10 : 11 },
    ...(crown ? { crown, crownTier: 2 } : {}),
    rival: { hero: rivalHero, twist: twists[n % 3], line: `${rivalHero} stands between the lines`, height: 10 + Math.floor((n - 41) / 4) },
  };

  // --- people, quests, doors, secrets ---------------------------------------------------------------------------------------
  const people: (Omit<PersonDef, 'at'> & { at: V })[] = [
    { id: 'keeper', hero: keeperHero, name: keeperHero, role: 'keeper', at: C(-2.6, 2), face: 0.4, greet: [`Two armies, and they never stop. Take a banner from the stands: its soldiers will march with you, and the other banner will hunt you. Then take the three standards, hold ${lower(Fh.name)}, and break the siege line in the north. ${rulerName} waits behind it.`], quests: ['main', 'bounty1', 'bounty2'] },
    { id: 'giver', hero: giverHero, name: giverHero, role: 'giver', at: C(5.5, -0.7), face: -0.5, greet: [pick(['I fought for both banners once. Neither paid.', 'I keep my head down and my boots dry. Help me with two things.', 'The field gives nothing back. Except the dead, every morning.'])], quests: ['g2', 'g3'] },
    { id: 'healer', hero: healerHero, name: healerHero, role: 'giver', at: healerAt, face: facing(healerAt), greet: [`I mend whoever is carried in, whatever the colour. You came all the way to ${lower(Vh.name)}? Then you can help me.`], quests: ['g1'] },
    { id: 'rival', hero: rivalHero, name: rivalHero, role: 'rival', at: rivalAt, face: facing(rivalAt), greet: [], quests: [] },
    { id: 'trader', hero: traderHero, name: traderHero, role: 'trader', at: C(-5.5, 5.5), face: 0.6, greet: ['Both armies buy from me, and both pay. Shards for what you need.'], quests: [] },
  ];
  const reward = (s: number, more: { boon?: boolean; relic?: boolean } = {}) => ({ shards: shard(s), ...more });
  const holdSeconds = 40 + 2 * (n - 41);
  const quests: QuestDef[] = [
    {
      id: 'main', name: pick(['Break the Siege', 'The Three Standards', 'Through the Line']), giver: 'keeper', main: true,
      intro: [`Three standards stand bare: on ${lower(A.name)}, on ${lower(E.name)} and at ${lower(Cw.name)}. Touch each and it flies your colours. Then hold ${lower(Fh.name)} while the dead come, and break the siege line in the north.`],
      steps: [
        { verb: 'reach', text: `Take the standard on ${lower(A.name)}`, at: A.c, r: 3.8 },
        { verb: 'reach', text: `Take the standard on ${lower(E.name)}`, at: E.c, r: 3.8 },
        { verb: 'reach', text: `Take the standard at ${lower(Cw.name)}`, at: Cw.c, r: 3.8 },
        { verb: 'hold', text: `Hold ${lower(Fh.name)} while the dead come`, at: hold, r: 4.6, seconds: holdSeconds, waves: { kinds: ['ashen', 'ashen', 'ashen'], every: late ? 14 : 15 } },
        { verb: 'fell', text: 'Fell the guard of the siege line', packs: ['siege'] },
        { verb: 'open', text: 'Break the siege line: go through the gate in the north', door: 'lair' },
      ] as Step[],
      outro: [`The siege line is broken. ${rulerName} is behind it. Take your time, then go in.`],
      reward: reward(70, { boon: true }),
    },
    { id: 'bounty1', name: named1, giver: 'keeper', intro: [`${named1} walks the middle of the field, under no banner. Fell it, and let the song close.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named1)}`, pack: 'named1' }], outro: ['A relic from a soldier of nobody. It is lighter than it looks.'], reward: reward(45, { relic: true }) },
    { id: 'bounty2', name: named2, giver: 'keeper', intro: [`${named2} walks the west of the field, by ${lower(Vh.name)}. The wounded will not be carried in while it does.`], steps: [{ verb: 'fell-named', text: `Fell ${mid(named2)}`, pack: 'named2' }], outro: ['The road to the tents is open again.'], reward: reward(40) },
    {
      id: 'g1', name: 'The White Cloth', giver: 'healer',
      intro: [`A white cloth for a truce hangs in ${lower(B.name)}. Bring it here and I will fly it over the tents, so both armies spare them.${keepPack ? ' The ashen soldiers in the keep will not give it up.' : ''}`],
      steps: [
        ...(keepPack ? [{ verb: 'fell', text: `Clear ${lower(B.name)}`, packs: ['keep'] } as Step] : []),
        { verb: 'carry', text: `Bring the white cloth from ${lower(B.name)} to ${lower(Vh.name)}`, item: 'cloth', itemName: 'The white cloth', toName: lower(Vh.name), from: clothFrom, to: clothTo, r: 2.4 },
      ] as Step[],
      outro: ['The cloth flies. For a moment, nobody fights. Take this.'], reward: reward(40, { boon: true }),
    },
    { id: 'g2', name: `${poss(leadNpc)} Cart`, giver: 'giver', intro: [`${leadNpc} is at ${lower(H.name)} with a cart of what the fire left. Walk it to the camp; stand close and it follows the road.`],
      steps: [{ verb: 'lead', text: `Lead the cart from ${lower(H.name)} to the camp`, name: 'The cart', look: 'cart', speed: 2.2, from: leadFrom, r: 3, path: leadPath } as Step], outro: [`The cart is in. ${leadNpc} pays in what was saved.`], reward: reward(40) },
    { id: 'g3', name: 'Braziers for the Dead', giver: 'giver', intro: ['Two braziers lie cold on the field. Light them, standing by each a moment, so the dead may see the way home.'],
      steps: [{ verb: 'light', text: 'Light the two braziers', things: [{ id: 'br1', at: fire1 }, { id: 'br2', at: fire2 }], seconds: 2 } as Step], outro: ['Two fires, and the field is a little warmer. Take your share.'], reward: reward(35, { boon: true }) },
  ];
  const doors: (Omit<DoorDef, 'at'> & { at: V })[] = [
    { id: 'lair', piece: 'ruler', name: crown ? 'The Burning Gate' : `${poss(rulerName)} gate`, at: S.lairDoor, r: 2.2, wall: { ax: -3.4, az: S.lairZ, bx: 3.4, bz: S.lairZ, r: 0.5, height: 3.8 }, locked: `The siege line holds. ${keeperHero} has a quest about it.` },
    { id: 'trial', piece: 'trial', name: pick(['The Trench', 'The Sapper’s Tunnel', 'The Muster Ground']), at: trial, r: 2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: gate, r: 2.2, needs: { won: 'ruler' }, locked: `The gate is sealed. Its warden answers only once ${mid(rulerName)} has fallen.` },
    { id: 'rival', piece: 'rival', name: `${poss(rivalHero)} ground`, at: rivalDoor, r: 2, locked: '' },
  ];
  const cacheDefs = caches.map((c, i) => ({ id: `c${i + 1}`, at: c, shards: shard([25, 30, 20, 30, 25, 20][i]), ...(i === 2 || i === 5 ? { boon: true } : {}) }));
  const stoneDefs = stones.map((s, i) => ({ id: `w${i + 1}`, name: `The ${stoneNear[i].name.replace(/^The /, '').replace(/’s$/, '').toLowerCase()} stone`, at: s }));
  const loreText = LORE[fi % LORE.length];

  lawChecks(n, { packs, sites: siteSpots, rim, hold, lead: [leadFrom, ...leadPath], stones, quests });

  // --- into the world ---------------------------------------------------------------------------------------------------------
  const W = worldOf(m), X = W.X;
  const placeDefs: Record<string, PlaceDef> = {};
  for (const p of [camp, ...places]) placeDefs[p.id] = { id: p.id, name: p.name, ...X(p.c), r: p.r, stand: X(p.stand) };
  const nn = String(n).padStart(2, '0');
  const look = S.look(m, [camp, ...places], n * 313) satisfies WarLook;
  const ring = Math.ceil(Math.max(...rim) + 1.5);
  const law: LawDef = {
    kind: 'sides', name: 'The war',
    blurb: `Two ghost armies fight for ever. Take a banner in the camp: its soldiers fight beside you and the other army hunts you.`,
    banners: [
      { id: 'r', name: crimsonName, color: 0xb03a3a, at: X(S.stands[0]), packs: siteIds.map((id) => `${id}-r`) },
      { id: 'b', name: azureName, color: 0x3a62c0, at: X(S.stands[1]), packs: siteIds.map((id) => `${id}-b`) },
    ],
  };
  return {
    n, chapter: 'war', seed, look, pieces,
    floor: {
      n, id: `war-${nn}`, name: crown ? 'The Crown of the War' : FLOOR_NAMES[fi % FLOOR_NAMES.length], blurb: crown ? 'The last field of the Climb, where the war burned down to its embers.' : BLURBS[fi % BLURBS.length],
      tunedAs: r2(5 + (n - 41) / 9), ring, start: X(C(0, 5.5)), camp: X(C(0, 2)), places: placeDefs, par: Math.round((1000 + 20 * (n - 41)) * 2.2),
      shop: { heal: 40 + 2 * (n - 41), boon: 65 + 3 * (n - 41), life: 90 + 4 * (n - 41), hint: 15 },
      law,
      enemies, packs: packs.map((p) => ({ ...p, at: X(p.at), ...(p.named ? { named: { ...p.named, patrol: p.named.patrol.map(X) } } : {}) })),
      people: people.map((p) => ({ ...p, at: X(p.at), face: W.yaw(p.face) })),
      quests: quests.map((q) => ({ ...q, steps: q.steps.map(stepTo(X)) })),
      caches: cacheDefs.map((c): CacheDef => ({ ...c, at: X(c.at) })),
      waystones: stoneDefs.map((w): WaystoneDef => ({ ...w, at: X(w.at) })),
      lore: { id: 'lore', name: 'The soldiers’ stone', at: X(lore), text: [...loreText] },
      doors: doors.map((d) => ({ ...d, at: X(d.at), ...(d.wall ? { wall: { ...d.wall, ax: r2(RING.x + m * d.wall.ax), az: r2(RING.z + d.wall.az), bx: r2(RING.x + m * d.wall.bx), bz: r2(RING.z + d.wall.bz) } } : {}) })),
      rival: { hero: rivalHero, goal: 'between the lines', mode: 'duel', at: X(rivalAt), boon: true, lines: [`I hold the ground between the lines. I am ${rivalHero}. Step onto it and we will see which of us the field remembers. Win, and I fight beside you.`] },
    },
  };
}


/**
 * Floor 41, The Field of Banners, grown to the new size (the user's choice, 2026-11-14): the same place, people, quests, enemies, ruler,
 * gatekeeper, rival and law, with every id kept (a save made on the small floor still finds its banner, its quest step, caches and
 * stones), laid out again on a field of the new size. Three more waystones and three more caches (new ids), and two places to look at
 * (a ruined keep, a burned farm), for the longer walks. The set pieces stay in pieces/floors.ts. Baked by `pipeline/tools/gen-banners.ts`
 * into floors/banners-made.ts.
 */
export function makeBannersFloor(attempt = 0): Omit<GenFloor, 'pieces'> {
  const n = 41, seed = 41000 + attempt, rnd = mulberry(seed);
  const rim = fieldOutline(rnd, { area: AREA, stretch: 1.25, min: 72, max: 136, waves: [0.09, 0.07, 0.05] });
  const S = new War(rim, rnd, n), L = S.L, C = (dx: number, dz: number) => S.C(dx, dz), at = (deg: number, f: number) => S.at(deg, f);
  const camp = S.camp;

  // The places of the small floor, on the same bearings and shares of the way out (the wagons in the north-west, the works north-east).
  const slots: { id: string; kind: Kind; deg: [number, number]; f: [number, number]; r?: number; name: string }[] = [
    { id: 'west', kind: 'ridge', name: 'The west ridge', deg: [-102, -88], f: [0.62, 0.72] },
    { id: 'east', kind: 'ridge', name: 'The east ridge', deg: [88, 102], f: [0.62, 0.72] },
    { id: 'north', kind: 'works', name: 'The north works', deg: [36, 50], f: [0.7, 0.78] },
    { id: 'wagons', kind: 'wagons', name: 'The burned wagons', deg: [-50, -36], f: [0.68, 0.78] },
    { id: 'hill', kind: 'hill', name: 'The hill', deg: [-10, 10], f: [0.18, 0.3], r: 9 },
    { id: 'keep', kind: 'keep', name: 'The ruined keep', deg: [-150, -132], f: [0.66, 0.76] },
    { id: 'farm', kind: 'farm', name: 'The burned farm', deg: [130, 150], f: [0.6, 0.72] },
  ];
  const places = placeAll(S, slots, ['west', 'east', 'north', 'wagons'], 46);
  const siege: Place = { id: 'siege', kind: 'siege', name: 'The siege line', c: { x: 0, z: r2(S.lairZ + 10) }, r: 7, stand: { x: 0, z: r2(S.lairZ + 15) } };
  places.push(siege);
  const P = (id: string) => places.find((p) => p.id === id)!;
  const We = P('west'), Ea = P('east'), No = P('north'), Wa = P('wagons'), Hi = P('hill'), Ke = P('keep'), Fa = P('farm');
  for (const p of places) S.dress(p);
  const siteSpots = [We.c, Ea.c, No.c, Wa.c];

  // --- roads: the camp to the two ridges, the ridges to the north, the camp up the middle to the hill and the siege line -------------
  const middle: V = { x: r2(L.range(-5, 5)), z: r2(L.range(4, 12)) };
  L.reserve(middle, 3);
  S.road(C(-3, -6), S.edge(We, C(-3, -6)), 1, 4); S.road(C(3, -6), S.edge(Ea, C(3, -6)), 1, 4);
  S.road(S.edge(We, Wa.c), S.edge(Wa, We.c), 1, 4); S.road(S.edge(Ea, No.c), S.edge(No, Ea.c), 1, 4);
  S.road(C(0, -7), middle, 2, 4); S.road(middle, S.edge(Hi, middle), 1, 2);
  S.road(S.edge(Hi, Wa.c), S.edge(Wa, Hi.c), 1, 3); S.road(S.edge(Hi, No.c), S.edge(No, Hi.c), 1, 3);
  S.road(S.edge(Hi, siege.c), S.edge(siege, Hi.c), 1, 3);
  S.road(S.edge(siege, S.lairDoor), add(S.lairDoor, { x: 0, z: 6 }), 0, 0);
  S.road(S.edge(We, Ke.c), S.edge(Ke, We.c), 1, 3); S.road(S.edge(Ea, Fa.c), S.edge(Fa, Ea.c), 1, 3);

  // --- the small floor's spots ---------------------------------------------------------------------------------------------------
  const homes = [...siteSpots, siege.c];
  const awayFromPacks = (d: number) => (q: V) => homes.every((s) => dist(s, q) >= d);
  const tent = L.reserve(C(-6, -1), 2); // the pavilion the white cloth is hung by
  const clothAt = Wa.stand;
  const trialAt = L.reserve(L.spot(at(-128, 0.84), 4, 2, awayFromPacks(22)), 3.5);
  const gateAt = L.reserve(L.spot(C(16, 4), 2, 2.2), 3.5);
  const rivalDoor = L.reserve(L.spot(at(L.range(-24, -14), 0.62), 4, 2, awayFromPacks(24)), 3.5);
  const brannocAt = L.reserve(L.spot(add(rivalDoor, toMid(rivalDoor), 5), 1.5, 1.2), 2);
  const brazier1 = L.reserve(L.spot(at(118, 0.42), 4, 1.5, awayFromPacks(18)), 2.5), brazier2 = L.reserve(L.spot(at(-128, 0.42), 4, 1.5, awayFromPacks(18)), 2.5);
  const lore = L.reserve(L.spot(at(150, 0.8), 4, 1.5, awayFromPacks(15)), 2.5);
  const caches = [at(-96, 0.92), at(94, 0.9), at(176, 0.2), at(-160, 0.84), at(62, 0.88), at(-10, 0.6)].map((p) => L.reserve(L.spot(p, 4, 1.5, awayFromPacks(10)), 2.5));
  const stoneAt = [add(We.c, toMid(We.c), 17), add(Hi.c, { x: 0, z: 14 }), add(Ea.c, toMid(Ea.c), 17), C(-11, -9), add(No.c, toMid(No.c), 18), add(Wa.c, toMid(Wa.c), 17)]
    .map((p) => L.reserve(L.spot(p, 3, 1.5, awayFromPacks(16)), 2.5));
  // The Deserter Knight walks a ring round the middle, south of the hill, between the lines.
  const patrol: V[] = [-50, 20, 90, 160, 230].map((a, i) => L.spot(polar(a + L.range(-10, 10), L.range(26, 34)), 3, 2, (q) => awayFromPacks(i === 0 ? NEUTRAL_APART + 2 : 26)(q) && stoneAt.every((s) => dist(s, q) >= 17) && dist(q, Hi.c) >= 20));
  for (let i = 0; i < patrol.length; i++) L.lane(patrol[i], patrol[(i + 1) % patrol.length], 1.8);

  S.scatter({ small: 66, keepOff: places.map((p) => ({ c: p.c, r: p.r + 2 })) });

  // --- the small floor's content, with its ids --------------------------------------------------------------------------------
  const enemies = { ...armies((x) => x), ...neutrals({ shard: (x) => x }) };
  const packs: PackDef[] = [
    ...site('a', We.c, { footman: 2, bowman: 1 }),
    ...site('b', Ea.c, { footman: 1, bowman: 1, knight: 1 }),
    ...site('c', No.c, { footman: 2, knight: 1 }),
    ...site('d', Wa.c, { footman: 1, bowman: 2 }),
    { id: 'siege', at: siege.c, leash: 24, mix: [{ kind: 'ashen', n: 3 }], elite: 'bearer' },
    { id: 'deserter', at: patrol[0], leash: 24, mix: [{ kind: 'deserter', n: 1 }], named: { name: 'The Deserter Knight', speed: 1.7, patrol, bounty: { shards: 45, relic: true } } },
  ];
  const people: (Omit<PersonDef, 'at'> & { at: V })[] = [
    { id: 'cantor', hero: 'Cantor', name: 'Cantor', role: 'keeper', at: C(-2.6, 2), face: 0.4, greet: ['Hush. Two armies fought here and never stopped, and I sing for both. Take a banner in the camp: its soldiers will march with you. Then take the standards, hold the hill, and break the siege line in the north. The Marshal waits behind it.'], quests: ['main', 'bounty'] },
    { id: 'whiskers', hero: 'Sir Whiskers', name: 'Sir Whiskers', role: 'giver', at: C(5.5, -0.7), face: -0.5, greet: ['I deserted. A cat of my breeding! Nine lives, and I used the first to run. Do me two small kindnesses and I will call it even.'], quests: ['cloth', 'braziers'] },
    { id: 'brannoc', hero: 'Brannoc', name: 'Brannoc', role: 'giver', at: brannocAt, face: facing(brannocAt), greet: ['I hold the ground between the lines. Walk through the arch behind me, and we will see which of us the field remembers.'], quests: [] },
    { id: 'cleaver', hero: 'Madame Cleaver', name: 'Madame Cleaver', role: 'trader', at: C(-5.5, 5.5), face: 0.6, greet: ['A cook feeds both armies, and both pay. Shards for what you need.'], quests: [] },
  ];
  const quests: QuestDef[] = [
    {
      id: 'main', name: 'Break the Siege', giver: 'cantor', main: true,
      intro: ['Three standards stand bare on the ridges and the north works. Touch each and it flies your colours. Then hold the hill for a minute while the dead come, and break the siege line in the north.'],
      steps: [
        { verb: 'reach', text: 'Take the west standard', at: We.c, r: 3.8 },
        { verb: 'reach', text: 'Take the east standard', at: Ea.c, r: 3.8 },
        { verb: 'reach', text: 'Take the north standard', at: No.c, r: 3.8 },
        { verb: 'hold', text: 'Hold the hill for a minute while the dead come', at: Hi.c, r: 4.6, seconds: 60, waves: { kinds: ['ashen', 'ashen', 'ashen'], every: 15 } },
        { verb: 'fell', text: 'Fell the guard of the siege line', packs: ['siege'] },
        { verb: 'open', text: 'Break the siege line: go through the gate in the north', door: 'lair' },
      ] as Step[],
      outro: ['The siege line is broken. The Last Marshal is behind it, with the guard of both banners. Take your time, then go in.'],
      reward: { shards: 60, boon: true },
    },
    { id: 'bounty', name: 'The Deserter Knight', giver: 'cantor', intro: ['A knight walks the field alone, round the hill and between the lines. He ran from both banners. Fell him, and let the song close.'], steps: [{ verb: 'fell-named', text: 'Fell the Deserter Knight', pack: 'deserter' }], outro: ['A relic from a deserter. It is lighter than shame.'], reward: { shards: 45, relic: true } },
    { id: 'cloth', name: 'The White Cloth', giver: 'whiskers', intro: ['A white cloth for a truce lies at the burned wagons in the north-west. Bring it to the pavilion by the camp so both armies may see it.'], steps: [{ verb: 'carry', text: 'Bring the white cloth from the burned wagons to the camp', item: 'cloth', itemName: 'The white cloth', toName: 'the pavilion', from: clothAt, to: tent, r: 2.4 } as Step], outro: ['The cloth is hung. For a moment, nobody fights. Take this, from a cat of honour, nearly.'], reward: { shards: 40, boon: true } },
    { id: 'braziers', name: 'Braziers for the Dead', giver: 'whiskers', intro: ['Two braziers lie cold on the field, in the east and by the western road. Light them so the dead may see the way home.'], steps: [{ verb: 'light', text: 'Light the two braziers', things: [{ id: 'br1', at: brazier1 }, { id: 'br2', at: brazier2 }], seconds: 2 } as Step], outro: ['Two fires, and the field is a little warmer. Take your share.'], reward: { shards: 35, boon: true } },
  ];
  const doors: (Omit<DoorDef, 'at'> & { at: V })[] = [
    { id: 'lair', piece: 'ruler', name: 'The Last Marshal’s gate', at: S.lairDoor, r: 2.2, wall: { ax: -3.4, az: S.lairZ, bx: 3.4, bz: S.lairZ, r: 0.5, height: 3.8 }, locked: 'The siege line holds. Cantor has a quest about it.' },
    { id: 'trial', piece: 'trial', name: 'The Trench', at: trialAt, r: 2, locked: '' },
    { id: 'rival', piece: 'rival', name: 'Brannoc’s ground', at: rivalDoor, r: 2.2, locked: '' },
    { id: 'gate', piece: 'gate', name: 'The gate up', at: gateAt, r: 2.2, needs: { won: 'ruler' }, locked: 'The gate is sealed. Its warden answers only once the Last Marshal has fallen.' },
  ];
  const stoneNames = ['The west road stone', 'The hill stone', 'The east road stone', 'The camp stone', 'The north stone', 'The wagons stone'];

  lawChecks(n, { packs, sites: siteSpots, rim, hold: Hi.c, lead: [], stones: stoneAt, quests });

  const m = 1 as const, Wd = worldOf(m), X = Wd.X;
  const placeDefs: Record<string, PlaceDef> = {};
  for (const p of [camp, ...places]) placeDefs[p.id] = { id: p.id, name: p.name, ...X(p.c), r: p.r, stand: X(p.stand) };
  const look = S.look(m, [camp, ...places], 4141) satisfies WarLook;
  const ring = Math.ceil(Math.max(...rim) + 1.5);
  const floor: Omit<FloorDef, 'arena' | 'cover'> = {
    n: 41, tunedAs: 5, id: 'banners', name: 'The Field of Banners', blurb: 'Two ghost armies still fight here. Take a side.',
    ring, start: X(C(0, 5.5)), camp: X(C(0, 2)), places: placeDefs, par: Math.round(1000 * 2.2),
    shop: { heal: 40, boon: 65, life: 90, hint: 15 },
    law: {
      kind: 'sides', name: 'The war',
      blurb: 'Two ghost armies fight for ever. Take a banner in the camp: its soldiers fight beside you and the other army hunts you.',
      banners: [
        { id: 'r', name: 'Crimson Host', color: 0xb03a3a, at: X(S.stands[0]), packs: ['a-r', 'b-r', 'c-r', 'd-r'] },
        { id: 'b', name: 'Azure Host', color: 0x3a62c0, at: X(S.stands[1]), packs: ['a-b', 'b-b', 'c-b', 'd-b'] },
      ],
    },
    enemies, packs: packs.map((p) => ({ ...p, at: X(p.at), ...(p.named ? { named: { ...p.named, patrol: p.named.patrol.map(X) } } : {}) })),
    people: people.map((p) => ({ ...p, at: X(p.at), face: Wd.yaw(p.face) })),
    quests: quests.map((q) => ({ ...q, steps: q.steps.map(stepTo(X)) })),
    caches: caches.map((c, i): CacheDef => ({ id: `c${i + 1}`, at: X(c), shards: [25, 30, 20, 25, 30, 25][i], ...(i === 2 ? { boon: true } : {}) })),
    waystones: stoneAt.map((s, i): WaystoneDef => ({ id: `w${i + 1}`, name: stoneNames[i], at: X(s) })),
    lore: { id: 'lore', name: 'The soldiers’ stone', at: X(lore), text: ['Two armies swore to fight until the other fell. Neither has.', 'They fight on, and nobody has told them why.'] },
    doors: doors.map((d) => ({ ...d, at: X(d.at), ...(d.wall ? { wall: { ...d.wall, ax: r2(RING.x + d.wall.ax), az: r2(RING.z + d.wall.az), bx: r2(RING.x + d.wall.bx), bz: r2(RING.z + d.wall.bz) } } : {}) })),
    rival: {
      hero: 'Brannoc', goal: 'between the lines', mode: 'duel', at: X(brannocAt), boon: true,
      lines: ['I hold the ground between the lines. Walk through the arch behind me, and we will see which of us the field remembers.'],
    },
  };
  return { n, chapter: 'war', seed, look, floor };
}
