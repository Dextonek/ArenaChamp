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
 */
const LAYOUT = layout as RealLayout;
/**
 * Six of the hall's corners lie behind a brazier that stands a body's width from both walls: a hero pushed in there (a boss's blow, a
 * spot inside the brazier) stood in a pocket the walk planner knows no way out of. To the game each is solid stone, from the brazier to
 * the corner; nothing is drawn for it.
 */
const CORNERS: Obstacle[] = [[11, 49, 13, 51], [31.6, 17.6, 34, 20], [31.6, -3.6, 34, -6]]
  .flatMap(([ax, az, bx, bz]) => [1, -1].map((s): Obstacle => ({ kind: 'wall', ax: s * ax, az, bx: s * bx, bz, r: 0.7, height: 1.2, fixed: true })));
export const HALL_OBSTACLES: Obstacle[] = [...LAYOUT.obstacles, ...CORNERS];
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

/** Whether (x, z) is on the hall's floor, `pad` m inside its walls: the cross, and the gate's passage south of the nave. */
export function inHall(x: number, z: number, pad = 0) {
  const dx = Math.abs(x - RING.x), dz = z - RING.z;
  if (dx <= W - pad && dz >= -(NORTH - pad) && dz <= SOUTH - pad) return true;
  if (Math.abs(dz) <= W - pad && dx <= EAST - pad) return true;
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
  const near = Math.hypot(a.x - dx, a.z - dz) <= Math.hypot(b.x - dx, b.z - dz) ? a : b;
  return { x: RING.x + near.x, z: RING.z + near.z };
}

/**
 * Whether (x, z) is in arm `arm` (its place in `HALL_ARMS`), `pad` m past the crossing's edge. Past the arm's end and beside it counts
 * too (the gate's passage, the stone): nobody stands there, and a spot there is no spot in another arm.
 */
export function inArm(arm: number, x: number, z: number, pad = 0) {
  const a = HALL_ARMS[arm], dx = x - RING.x, dz = z - RING.z;
  const along = dx * Math.sin(a.dir) + dz * Math.cos(a.dir), across = dx * Math.cos(a.dir) - dz * Math.sin(a.dir);
  return along >= W + pad && Math.abs(across) <= W + 1;
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
    g.add(glows.group);
    own.push(glows);

    const eclipse = new THREE.Sprite(new THREE.SpriteMaterial({ map: eclipseTexture(), transparent: true, depthWrite: false, fog: false }));
    eclipse.scale.set(230, 230, 1);
    eclipse.position.set(0, 100, RING.z - 240);
    g.add(eclipse);
    own.push(eclipse.material.map!, eclipse.material);

    let disposed = false;
    let cover: (THREE.Object3D | null)[] = [];
    /** How far each piece has sunk: a broken screen goes down into the floor. */
    const sink = new Map<THREE.Object3D, number>();
    void realProps('sunhall', LAYOUT.obstacles.length, {
      dim: 0.85, env: 0.35,
      parts: { glow: { emissive: 0xffa040, strength: 2.0 }, cream: { dim: 0.55 }, stone: { dim: 0.8 }, slate: { dim: 0.85 }, gold: { dim: 0.62, rough: 0.5 }, copper: { dim: 0.7, rough: 0.5 } },
    }).then((props) => {
      if (disposed) return;
      cover = props.cover;
      for (const c of props.cover) if (c) g.add(c);
      if (props.back) g.add(props.back);
    }).catch((e) => console.warn('hall of noon: props failed to load', e));

    return {
      group: g,
      update(dt, time) {
        glows.update(time);
        for (const [o, to] of sink) o.position.y += (to - o.position.y) * Math.min(1, dt * 5);
      },
      wallState(index: number, state: WallState) {
        const o = cover[index];
        if (!o) return;
        // Whole, a hand's width into the floor, or gone under it.
        sink.set(o, state === 'whole' ? 0 : state === 'cracked' ? -0.25 : -2.2);
        if (state === 'whole') o.position.y = 0;
      },
      dispose() {
        disposed = true;
        for (const o of own) o.dispose();
      },
    };
  },
};
