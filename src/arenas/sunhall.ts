import * as THREE from 'three';
import type { Obstacle } from '../obstacles';
import { RING, canvasTexture, seeded } from './common';
import layout from './real/sunhall.json';
import { Glows, realProps, type RealLayout } from './real';
import { COURT_STAGE, eclipseTexture } from './suncourt';
import type { ArenaDef, WallState } from './types';

/**
 * The Hall of Noon: the Sun Warden's boss room for a party of up to 40 (user, 2026-11-11: "what if the arena is not like a round
 * arena, let's just forget all and let's make boss room"). Not a ring: a hall in the shape of a cross, cut out of dark stone. The
 * party comes in at the gate in the south and walks up the nave (26 m wide, 44 m long) to the crossing, where the Warden waits at the
 * Sun Well with the court for two round him as it was; two transepts reach 34 m west and east; the choir runs 40 m north to his empty
 * throne under a great gold halo. Built in blender/arenas/real/sunhall.py (clean forms, the heroes' materials, gold on the edges,
 * lantern light as the only glow), which also writes the obstacle list (`real/sunhall.json`).
 *
 * The game's floor is still a ring (`ring`, 46 m: the hub and the walk both keep heroes inside it); the hall's shape is made by its
 * own walls, obstacles that never break (`Obstacle.fixed`). The stone the hall is cut from is 1.3 m high on the camera's side, so the
 * camera looks over it, and 9 to 11 m to the north; a zone drawn wider than the floor is hidden inside it. Built here: the hall's
 * floor, the lanterns' glow, the eclipse over the north wall.
 *
 * The hall breaks open (user, 2026-11-12: "when there will be second stage the arena will transform"): in the Warden's second phase
 * the four corner blocks of the stone fall, and the cross becomes one round court, `HALL_COURT` to its wall, with the ends of the nave
 * and the choir left beyond it. The blocks are cut into pieces in the Blender file (`falls`), which fall here; the walls between the
 * arms (`opens`) are taken out of the game by the Warden's cast (src/raid/wardenHall.ts); the court's own wall and the rubble are
 * obstacles from the start, inside the stone, where nothing reaches them until it falls. `hallBreak` is the room's state: every
 * question about its shape (`inHall`, `intoHall`, `inArm`) answers for the shape it has now.
 */
interface HallLayout extends RealLayout {
  /** How far the round court's wall is from the Sun Well (m). */
  court: number;
  /** The walls between the arms, by their place in `obstacles`: they go when the hall breaks open. */
  opens: number[];
  /** The rubble the fallen blocks leave, by its place in `obstacles`. */
  rubble: number[];
  /** The pieces that fall: the object's name in the file, its corner (0 south-west, 1 south-east, 2 north-west, 3 north-east), its middle, its height, how far it is from the hall's corner. */
  falls: { name: string; q: number; x: number; z: number; h: number; far: number }[];
}
const LAYOUT = layout as HallLayout;
/**
 * Six of the hall's corners lie behind a brazier that stands a body's width from both walls: a hero pushed in there (a boss's blow, a
 * spot inside the brazier) stood in a pocket the walk planner knows no way out of. To the game each is solid stone, from the brazier to
 * the corner; nothing is drawn for it.
 */
const CORNERS: Obstacle[] = [[11, 49, 13, 51], [31.6, 17.6, 34, 20], [31.6, -3.6, 34, -6]]
  .flatMap(([ax, az, bx, bz]) => [1, -1].map((s): Obstacle => ({ kind: 'wall', ax: s * ax, az, bx: s * bx, bz, r: 0.7, height: 1.2, fixed: true })));
export const HALL_OBSTACLES: Obstacle[] = [...LAYOUT.obstacles, ...CORNERS];
/** The round court the hall breaks open into: how far its wall is from the Sun Well (m), the walls that go, the rubble that is left. */
export const HALL_COURT = LAYOUT.court;
export const HALL_OPENS: readonly number[] = LAYOUT.opens;
export const HALL_RUBBLE: readonly number[] = LAYOUT.rubble;
/** The pieces of the corner blocks, and when each falls after the hall breaks (s): the low south blocks first, from the hall's corners outward. */
export const HALL_FALLS = LAYOUT.falls.map((f) => ({ ...f, delay: (f.h > 2 ? 0.7 : 0) + f.far * 0.05 }));
/** How far the hall reaches from the Sun Well (m): its nave's far corners. */
export const HALL_R = 46;
/** The cross, as in sunhall.py: half the arms' width, and how far the nave, the transepts and the choir reach. */
const W = 13, SOUTH = 44, EAST = 34, NORTH = 40, GATE = 3.2;
/** The floor's drawing covers this far each way from the well (m). */
const SPAN = 52;

/** Half the width of the hall's arms, and of the crossing they meet in (m). */
export const HALL_HALF = W;
/**
 * The hall's four arms as seen from the Sun Well: which way each runs (a yaw: 0 is south, toward the gate) and how far its end wall
 * is from the well (m). The Warden's moves name an arm by its place in this list.
 */
export const HALL_ARMS: readonly { name: string; dir: number; reach: number }[] = [
  { name: 'the nave', dir: 0, reach: SOUTH },
  { name: 'the east transept', dir: Math.PI / 2, reach: EAST },
  { name: 'the choir', dir: Math.PI, reach: NORTH },
  { name: 'the west transept', dir: -Math.PI / 2, reach: EAST },
];

/** What shows the hall now (the last one built): its pieces fall there. */
interface HallShow {
  reset(): void;
  crack(amount: number): void;
  fall(instant: boolean): void;
}
let show: HallShow | null = null;
/** The hall has broken open: it is the round court. */
let open = false;

/**
 * The hall's own state. Only the Warden's casts change it (src/raid/wardenHall.ts), so every screen has the same hall at the same
 * moment of the fight; `reset` before each fight (`BossDef.resize`).
 */
export const hallBreak = {
  get open() { return open; },
  /** A new fight: the hall is whole. */
  reset() {
    open = false;
    show?.reset();
  },
  /** The corner blocks shake, 0 (still) to 1 (about to go). */
  crack(amount: number) { show?.crack(amount); },
  /** They fall, and the hall is the round court from now on. `instant`: no fall to watch (the moment was missed). */
  fall(instant = false) {
    if (open) return;
    open = true;
    show?.fall(instant);
  },
};

/**
 * Whether (x, z) is on the hall's floor, `pad` m inside its walls: the cross, the gate's passage south of the nave, and once the
 * hall has broken open the round court between the arms.
 */
export function inHall(x: number, z: number, pad = 0) {
  const dx = Math.abs(x - RING.x), dz = z - RING.z;
  if (dx <= W - pad && dz >= -(NORTH - pad) && dz <= SOUTH - pad) return true;
  if (Math.abs(dz) <= W - pad && dx <= EAST - pad) return true;
  if (open && dx <= EAST - pad && Math.hypot(dx, dz) <= HALL_COURT - pad) return true;
  return pad <= 0 && dx <= GATE && dz >= SOUTH && dz <= SOUTH + 8;
}

/** (x, z), or the nearest spot to it on the hall's floor, `pad` m inside its walls. */
export function intoHall(x: number, z: number, pad = 0) {
  if (inHall(x, z, pad)) return { x, z };
  const dx = x - RING.x, dz = z - RING.z, clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  // The gate's passage is narrower than any `pad`: its middle, as far in as the spot is. (Pulled back into the nave, what he aims
  // would never reach a hero standing in the passage.)
  if (Math.abs(dx) <= GATE && dz > SOUTH - pad && dz <= SOUTH + 8) return { x: RING.x, z };
  // The cross is two bars: the nearer of the nearest spots in each.
  const a = { x: clamp(dx, -(W - pad), W - pad), z: clamp(dz, -(NORTH - pad), SOUTH - pad) };
  const b = { x: clamp(dx, -(EAST - pad), EAST - pad), z: clamp(dz, -(W - pad), W - pad) };
  let near = Math.hypot(a.x - dx, a.z - dz) <= Math.hypot(b.x - dx, b.z - dz) ? a : b;
  if (open) {
    // The round court: the spot pulled in to its wall, if that is nearer still.
    const k = Math.min(1, (HALL_COURT - pad) / Math.hypot(dx, dz)), c = { x: clamp(dx * k, -(EAST - pad), EAST - pad), z: dz * k };
    if (Math.hypot(c.x - dx, c.z - dz) < Math.hypot(near.x - dx, near.z - dz)) near = c;
  }
  return { x: RING.x + near.x, z: RING.z + near.z };
}

/**
 * Whether (x, z) is in arm `arm` (its place in `HALL_ARMS`), `pad` m past the crossing's edge. Past the arm's end and beside it counts
 * too (the gate's passage, the stone): nobody stands there, and a spot there is no spot in another arm. Once the hall has broken open
 * an arm is its quarter of the round court: the quarter turn round the arm's line, from `HALL_HALF` m off the Sun Well outward.
 */
export function inArm(arm: number, x: number, z: number, pad = 0) {
  const a = HALL_ARMS[arm], dx = x - RING.x, dz = z - RING.z;
  const along = dx * Math.sin(a.dir) + dz * Math.cos(a.dir), across = dx * Math.cos(a.dir) - dz * Math.sin(a.dir);
  if (open) return Math.abs(across) <= along && Math.hypot(dx, dz) >= W + pad;
  return along >= W + pad && Math.abs(across) <= W + 1;
}

/** Which arm's quarter (x, z) lies in: the arm whose line it is nearest to. */
export function quarterOf(x: number, z: number) {
  const turn = Math.atan2(x - RING.x, z - RING.z);
  return ((Math.round(turn / (Math.PI / 2)) % 4) + 4) % 4;
}

/** A spot in arm `arm`, `along` m from the well down its middle. */
export function armSpot(arm: number, along: number) {
  const a = HALL_ARMS[arm];
  return { x: RING.x + Math.sin(a.dir) * along, z: RING.z + Math.cos(a.dir) * along };
}

/** The hall's outline on the canvas: (x east, s south) of the well, in pixels. */
function crossPath(g: CanvasRenderingContext2D, ppm: number, inset = 0) {
  const w = W - inset, s = SOUTH - inset, e = EAST - inset, n = NORTH - inset;
  const pts = [[-w, s], [-w, w], [-e, w], [-e, -w], [-w, -w], [-w, -n], [w, -n], [w, -w], [e, -w], [e, w], [w, w], [w, s]];
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x * ppm, y * ppm) : g.moveTo(x * ppm, y * ppm)));
  g.closePath();
}

/** The floor: dark slate slabs, a gold line inside the walls, the dial at the crossing, a sun road down each arm. */
function hallFloor() {
  return canvasTexture(2048, (g, size) => {
    const rnd = seeded(404), ppm = size / (SPAN * 2);
    g.fillStyle = '#08080c';
    g.fillRect(0, 0, size, size);
    g.translate(size / 2, size / 2);
    // The round court between the arms, under the corner blocks until they fall: the bare rock the hall was cut from, in great
    // rough slabs laid round the Sun Well, cracked where the blocks stood.
    g.save();
    g.beginPath();
    g.rect(-EAST * ppm, -HALL_COURT * ppm, EAST * 2 * ppm, HALL_COURT * 2 * ppm);
    g.clip();
    g.beginPath();
    g.arc(0, 0, HALL_COURT * ppm, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#0f1019';
    g.fillRect(-SPAN * ppm, -SPAN * ppm, SPAN * 2 * ppm, SPAN * 2 * ppm);
    for (let ring = 0; ring < 8; ring++) {
      const r0 = 13 + ring * 3.4, r1 = r0 + 3.4, n = 26 + ring * 6, off = rnd() * 6.283;
      for (let k = 0; k < n; k++) {
        const a0 = off + (k / n) * Math.PI * 2, a1 = off + ((k + 1) / n) * Math.PI * 2;
        g.beginPath();
        g.arc(0, 0, r1 * ppm, a0, a1);
        g.arc(0, 0, r0 * ppm, a1, a0, true);
        g.closePath();
        g.fillStyle = rnd() < 0.5 ? `rgba(110,118,150,${0.01 + rnd() * 0.03})` : `rgba(0,0,0,${0.06 + rnd() * 0.12})`;
        g.fill();
        g.strokeStyle = 'rgba(3,3,8,0.85)';
        g.lineWidth = 2;
        g.stroke();
      }
    }
    // Cracks run out from each of the hall's corners, burnt at their root.
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const burn = g.createRadialGradient(sx * W * ppm, sz * W * ppm, 0, sx * W * ppm, sz * W * ppm, 15 * ppm);
      burn.addColorStop(0, 'rgba(40,16,4,0.5)');
      burn.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = burn;
      g.fillRect(-SPAN * ppm, -SPAN * ppm, SPAN * 2 * ppm, SPAN * 2 * ppm);
      for (let c = 0; c < 7; c++) {
        let x = sx * W, y = sz * W, turn = Math.atan2(sz, sx) + (c / 6 - 0.5) * 1.3;
        g.beginPath();
        g.moveTo(x * ppm, y * ppm);
        for (let k = 0; k < 9; k++) {
          turn += (rnd() - 0.5) * 0.7;
          x += Math.cos(turn) * 2.4;
          y += Math.sin(turn) * 2.4;
          g.lineTo(x * ppm, y * ppm);
        }
        g.strokeStyle = `rgba(2,2,6,${0.6 + rnd() * 0.3})`;
        g.lineWidth = 1.5 + rnd() * 2.5;
        g.stroke();
      }
    }
    // A gold line just inside the court's wall.
    g.strokeStyle = 'rgba(200,160,80,0.5)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, (HALL_COURT - 1.1) * ppm, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    g.save();
    crossPath(g, ppm);
    // The gate's passage and the throne's alcove are floor too.
    g.rect(-GATE * ppm, SOUTH * ppm, GATE * 2 * ppm, 8 * ppm);
    g.rect(-6 * ppm, (-NORTH - 7.5) * ppm, 12 * ppm, 7.5 * ppm);
    g.clip();
    g.fillStyle = '#12141f';
    g.fillRect(-SPAN * ppm, -SPAN * ppm, SPAN * 2 * ppm, SPAN * 2 * ppm);
    const slab = 2.6;
    for (let row = -20; row < 20; row++) {
      for (let col = -20; col < 20; col++) {
        const x = (col + (row % 2 ? 0.5 : 0)) * slab, y = row * slab;
        g.fillStyle = rnd() < 0.5 ? `rgba(120,130,170,${0.012 + rnd() * 0.024})` : `rgba(0,0,0,${0.05 + rnd() * 0.09})`;
        g.fillRect(x * ppm, y * ppm, slab * ppm, slab * ppm);
        g.strokeStyle = 'rgba(4,4,9,0.8)';
        g.lineWidth = 2;
        g.strokeRect(x * ppm, y * ppm, slab * ppm, slab * ppm);
      }
    }
    // The sun roads: down the nave to the gate, up the choir to the throne, out along each transept.
    g.fillStyle = 'rgba(190,150,70,0.07)';
    g.strokeStyle = 'rgba(190,150,70,0.3)';
    g.lineWidth = 3;
    for (const [x, y, w, h] of [[-1.7, 13, 3.4, SOUTH + 8 - 13], [-1.7, -NORTH, 3.4, NORTH - 13], [13, -1.7, EAST - 14, 3.4], [-EAST + 1, -1.7, EAST - 14, 3.4]]) {
      g.fillRect(x * ppm, y * ppm, w * ppm, h * ppm);
      g.strokeRect(x * ppm, y * ppm, w * ppm, h * ppm);
    }
    // The dial at the crossing: the court for two, its wheel and its rays.
    for (const r of [1.5, 3, 7.6, 12.4]) { g.beginPath(); g.arc(0, 0, r * ppm, 0, Math.PI * 2); g.stroke(); }
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, long = k % 2 === 0, w = long ? 0.09 : 0.06, r = long ? 12.2 : 9;
      g.beginPath();
      g.moveTo(Math.cos(a - w) * 3 * ppm, Math.sin(a - w) * 3 * ppm);
      g.lineTo(Math.cos(a) * r * ppm, Math.sin(a) * r * ppm);
      g.lineTo(Math.cos(a + w) * 3 * ppm, Math.sin(a + w) * 3 * ppm);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // Where the halos fell, the floor is burnt.
    for (const [x, y, rx, ry] of [[0, 29, 13, 2.6], [0, -22, 13, 2.6], [23, 0, 2.6, 9], [-23, 0, 2.6, 9]]) {
      const burn = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      burn.addColorStop(0, 'rgba(34,12,2,0.55)');
      burn.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.translate(x * ppm, y * ppm);
      g.scale(rx * ppm, ry * ppm);
      g.fillStyle = burn;
      g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.restore();
    // A gold line just inside the walls.
    g.strokeStyle = 'rgba(200,160,80,0.5)';
    g.lineWidth = 4;
    crossPath(g, ppm, 1.1);
    g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 3200; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.06)';
      g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1 + rnd() * 3);
    }
  });
}

export const sunHallArena: ArenaDef = {
  id: 'sunhall',
  name: 'The Hall of Noon',
  ring: HALL_R,
  obstacles: HALL_OBSTACLES,
  breakable: true,
  stage: { ...COURT_STAGE, fogNear: 95, fogFar: 260 },
  build() {
    const g = new THREE.Group();
    const own: { dispose(): void }[] = [];
    // The floor: one drawn square under the hall; the stone round the hall stands on it and hides the rest.
    const face = new THREE.MeshStandardMaterial({ map: hallFloor(), roughness: 0.82, metalness: 0.12 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(SPAN * 2, SPAN * 2), face);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(RING.x, 0.012, RING.z);
    floor.receiveShadow = true;
    g.add(floor);
    own.push(floor.geometry, face.map!, face);

    const SIZE: Record<string, number> = { lantern: 1.1, lamp: 1.9, beacon: 6 };
    const glows = new Glows(LAYOUT.marks.filter((m) => SIZE[m.kind]).map((m) => ({ ...m, size: SIZE[m.kind] })), 0xffa040, 1.5);
    // The lights on the corner blocks go out with them (`flamp`); the round court's own windows are lit once they have fallen (`alamp`).
    const lamps = (kind: string) => new Glows(LAYOUT.marks.filter((m) => m.kind === kind).map((m) => ({ ...m, size: SIZE.lamp })), 0xffa040, 1.5);
    const before = lamps('flamp'), after = lamps('alamp');
    after.group.visible = false;
    g.add(glows.group, before.group, after.group);
    own.push(glows, before, after);

    const eclipse = new THREE.Sprite(new THREE.SpriteMaterial({ map: eclipseTexture(), transparent: true, depthWrite: false, fog: false }));
    eclipse.scale.set(230, 230, 1);
    eclipse.position.set(0, 100, RING.z - 240);
    g.add(eclipse);
    own.push(eclipse.material.map!, eclipse.material);

    let disposed = false;
    let cover: (THREE.Object3D | null)[] = [];
    /** How far each piece has sunk: a broken screen goes down into the floor. */
    const sink = new Map<THREE.Object3D, number>();
    /**
     * The corner blocks' pieces, each on a pivot at its own middle. `since`: seconds since the hall broke (-1: it stands); a piece
     * drops after its `delay`, leaning a little as it goes, and is gone once it is under the floor.
     */
    const pieces: { pivot: THREE.Group; h: number; delay: number; lean: THREE.Vector2 }[] = [];
    let since = -1, shake = 0, clock = 0;
    const place = () => {
      for (const p of pieces) {
        const t = since - p.delay;
        if (t <= 0) {
          // Standing: it trembles while it cracks.
          const k = since < 0 ? shake : 1;
          p.pivot.visible = true;
          p.pivot.position.y = k * 0.05 * Math.sin(clock * 47 + p.delay * 31);
          p.pivot.rotation.set(k * 0.004 * Math.sin(clock * 39 + p.delay * 17), 0, k * 0.004 * Math.sin(clock * 43 + p.delay * 11));
          continue;
        }
        // Falling: a tall block drops 9 m in about a second.
        const drop = Math.min(p.h + 0.8, 0.5 * (p.h > 2 ? 15 : 9) * t * t), lean = Math.min(0.1, t * 0.09);
        p.pivot.position.y = -drop;
        p.pivot.rotation.set(p.lean.x * lean, 0, p.lean.y * lean);
        p.pivot.visible = drop < p.h + 0.8;
      }
      before.group.visible = since < 0.4;
      after.group.visible = since > 1.6;
      // The rubble stands inside the blocks until they fall: not drawn till then (a phone has draw calls to spare for nothing unseen).
      for (const i of LAYOUT.rubble) {
        const o = cover[i];
        if (o) o.visible = since >= 0;
      }
    };
    const me: HallShow = {
      reset() { since = -1; shake = 0; place(); },
      crack(amount) { shake = amount; },
      fall(instant) { since = instant ? 60 : 0; place(); },
    };
    show = me;
    void realProps('sunhall', LAYOUT.obstacles.length, {
      dim: 0.85, env: 0.35,
      parts: { glow: { emissive: 0xffa040, strength: 2.0 }, cream: { dim: 0.55 }, stone: { dim: 0.8 }, slate: { dim: 0.85 }, gold: { dim: 0.62, rough: 0.5 }, copper: { dim: 0.7, rough: 0.5 } },
    }, HALL_FALLS.map((f) => f.name)).then((props) => {
      if (disposed) return;
      cover = props.cover;
      for (const c of props.cover) if (c) g.add(c);
      if (props.back) g.add(props.back);
      const rnd = seeded(77);
      for (const f of HALL_FALLS) {
        const o = props.named[f.name];
        if (!o) continue;
        const pivot = new THREE.Group();
        pivot.position.set(f.x, 0, f.z);
        o.position.set(-f.x, 0, -f.z);
        pivot.add(o);
        g.add(pivot);
        pieces.push({ pivot, h: f.h, delay: f.delay, lean: new THREE.Vector2(rnd() * 2 - 1, rnd() * 2 - 1) });
      }
      place();
    }).catch((e) => console.warn('hall of noon: props failed to load', e));

    return {
      group: g,
      update(dt, time) {
        glows.update(time);
        before.update(time);
        after.update(time);
        for (const [o, to] of sink) o.position.y += (to - o.position.y) * Math.min(1, dt * 5);
        clock += dt;
        if (since >= 0 && since < 60) since += dt;
        if (since < 4 && (since >= 0 || shake > 0)) place();
      },
      resetShift() { hallBreak.reset(); },
      wallState(index: number, state: WallState) {
        const o = cover[index];
        if (!o) return;
        // Whole, a hand's width into the floor, or gone under it.
        sink.set(o, state === 'whole' ? 0 : state === 'cracked' ? -0.25 : -2.2);
        if (state === 'whole') o.position.y = 0;
      },
      dispose() {
        disposed = true;
        if (show === me) show = null;
        for (const o of own) o.dispose();
      },
    };
  },
};
