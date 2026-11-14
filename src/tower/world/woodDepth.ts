import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING, seeded } from '../../arenas/common';
import type { WoodLook } from './gen/wood';
import { rimAt } from './land';

/**
 * The world's depth on a Wood floor (floors 11 to 20; the user, 2026-11-14: "add depth into the worlds, make all the background fit there,
 * all the roads and zones, make them look like they fit there, don't be shy"). The sea's pass is depth.ts; this is the Wood's own, made the
 * same way. **Looks only, never cover:** nothing here stops a walk or a shot; it keeps off the cover, the passes (where the roots rise), the
 * roads' middles and the places' grounds (inside a place only flat or very low things, so a fight's markings stay readable).
 *
 * - The trails: root-edged verges (roots arching out of the ground by the bands of trees), mossy stones, ferns and mushrooms along them,
 *   a wooden signpost where a trail meets a glade or another trail, a few hanging lanterns on crooked posts; a brook painted across a
 *   trail or two in the open, with a plank footbridge (or stepping stones) where the trail crosses it.
 * - The glades: grass, wildflowers, fallen leaves, ferns at the feet of the trees, mushrooms (now and then a fairy ring), stumps,
 *   woodpiles, beehives, a hunter's stand with its back to the trees.
 * - Each place dressed as what it is: the camp (a woodpile, a cooking tripod, bedrolls), the burners (stacked billets, smoke), the shrine
 *   (offerings and ribbons), the spring (reeds, stones, lily pads), the old stones (lichen and a ring of tall grass), the dens (bones),
 *   the brambles (berried shoots), the giants' glade (a cairn, a dropped club), the hollow oak (mushrooms, leaves), the lamp glades
 *   (toadstools), the heart (a ring of flowers).
 * - In the air: leaves drifting down under the trees, a few birds over the hills; far off a woodcutter's cottage with smoke from its
 *   chimney and a watchtower on the northern ridge with its lantern.
 *
 * How it is drawn: the solid props go into the zone's merged props (one mesh a 48 m square, whatever the colours); the scatter (grass,
 * leaves, ferns, flowers...) is a few triangles a thing (a blade of grass is one), merged into one mesh a 64 m square with no shadows cast
 * (a square out of view is not drawn: one instanced mesh a kind drew 16 more things a frame and added 1.5 ms on desktop); the moving
 * things are instanced, each with its own material, and updated in place each frame (no allocation). The brook is painted into the
 * ground (free). Its own random stream, so the trees and the fireflies are where they were. The floor's spots (`keep`: people, caches,
 * waystones, doors, quest steps; keep.ts `floorKeep`) are kept 2.5 m clear.
 */

/** The zone's merged props (woodZone.ts `Props`): a colour comes from the material's `color`, gold/sap/water keep their own. */
export interface PropSink {
  add(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw?: number, sx?: number, sy?: number, sz?: number, tilt?: number): PropSink;
}
/** What the depth needs of the Wood's land (woodZone.ts `landOf`), from offsets (dx, dz) from the middle. */
export interface WoodLand {
  beyond(dx: number, dz: number): number;
  height(dx: number, dz: number): number;
  ridge(dx: number, dz: number): number;
}
type Seg = { ax: number; az: number; bx: number; bz: number; r: number };
type Spot = { x: number; y: number; z: number; size?: number };

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

/** The Wood's own colours for the depth (the heroes' palette, STYLE.md, a shade duller; the Wood's one colour is its moss green). */
const C = {
  bark: '#3c2b1c', barkLight: '#5a4530', plank: '#6b4226', lacquer: '#1d1b21', wine: '#5e1a28', cream: '#d8cfb4', rope: '#b89a5a',
  stone: '#60645a', stoneDark: '#4a4c48', moss: '#55693c', mossDark: '#3f5230', fern: '#48663a', fernDark: '#3a5530', straw: '#a88a4e',
  ash: '#3a3836', lichen: '#9a9a52', teal: '#2b5560', reed: '#5f7442', berry: '#7a2236', bone: '#d8d0bc',
} as const;

/** Plans the depth of one Wood floor from its look: `paint` draws into the ground's canvas, `build` makes the props. */
export function woodDepth(look: WoodLook, land: WoodLand, keep: { x: number; z: number }[] = []) {
  const rnd = seeded(9100 + look.seed);
  const rmax = Math.max(...look.rim);
  const roads: { ax: number; az: number; bx: number; bz: number }[] = [];
  for (const p of look.paths) for (let i = 1; i < p.length; i++) roads.push({ ax: RING.x + p[i - 1][0], az: RING.z + p[i - 1][1], bx: RING.x + p[i][0], bz: RING.z + p[i][1] });
  const cover: Seg[] = look.pieces.map((p) => p.o);
  const nearRoad = (x: number, z: number) => {
    let m = 1e9;
    for (const s of roads) m = Math.min(m, segDist(x, z, s.ax, s.az, s.bx, s.bz));
    return m;
  };
  const coverDist = (x: number, z: number) => {
    let m = 1e9;
    for (const c of cover) m = Math.min(m, segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r);
    return m;
  };
  const onCover = (x: number, z: number, pad: number) => cover.some((c) => segDist(x, z, c.ax, c.az, c.bx, c.bz) < c.r + pad);
  const nearPass = (x: number, z: number, pad: number) => look.passes.some((p) => Math.hypot(x - p.x, z - p.z) < p.w + 3 + pad);
  /** Near one of the floor's spots (a person, a cache, a waystone, a door, a quest's step...): props keep 2.5 m off them. */
  const kept = (x: number, z: number, pad: number) => keep.some((k) => Math.hypot(x - k.x, z - k.z) < 2.5 + pad);
  const placeAt = (x: number, z: number, pad: number) => look.places.find((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);
  /** Free ground for a look: inside the outline by `inside` m, off the cover by `pad`, off the passes, the roads' middles and (if asked) the places. */
  const free = (x: number, z: number, pad: number, o: { road?: number; place?: number; inside?: number } = {}) => {
    if (land.beyond(x - RING.x, z - RING.z) > -(o.inside ?? 1.5)) return false;
    if (onCover(x, z, pad) || nearPass(x, z, pad) || kept(x, z, pad)) return false;
    if (nearRoad(x, z) < (o.road ?? 2.2) + pad) return false;
    if (o.place !== undefined && placeAt(x, z, o.place)) return false;
    return true;
  };
  /** A tall thing stands only with its back to the trees: cover just north of it (the camera looks north, so it hides nobody). */
  const backed = (x: number, z: number) => cover.some((c) => segDist(x, z - 3.5, c.ax, c.az, c.bx, c.bz) < c.r + 1.2) && !onCover(x, z, 1);

  // --- the brooks: one or two, across a trail in the open; painted, with a footbridge or stepping stones -------------------------------
  type Brook = { pts: [number, number][]; cross: { x: number; z: number; yaw: number }; bridge: boolean };
  const brooks: Brook[] = [];
  for (let k = 0; k < 120 && brooks.length < 2; k++) {
    const s = roads[Math.floor(rnd() * roads.length)];
    if (!s) break;
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (L < 14) continue;
    const t = 0.3 + rnd() * 0.4, cx = s.ax + (s.bx - s.ax) * t, cz = s.az + (s.bz - s.az) * t;
    if (placeAt(cx, cz, 6) || nearPass(cx, cz, 4) || kept(cx, cz, 3) || coverDist(cx, cz) < 4 || brooks.some((b) => Math.hypot(b.cross.x - cx, b.cross.z - cz) < 60)) continue;
    const ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L, nx = -uz, nz = ux;
    // walk out each way, across the trail, wandering a little, until the trees, a place, another trail or the edge
    const side = (dir: number) => {
      const out: [number, number][] = [];
      let x = cx, z = cz, a = Math.atan2(nz * dir, nx * dir);
      for (let i = 0; i < 16; i++) {
        a += (rnd() - 0.5) * 0.5;
        x += Math.cos(a) * 1.6; z += Math.sin(a) * 1.6;
        if (land.beyond(x - RING.x, z - RING.z) > -1 || placeAt(x, z, 3) || nearPass(x, z, 2) || kept(x, z, 2)) break;
        out.push([x, z]);
        if (coverDist(x, z) < 0.5) break; // into the trees: it runs on under them
        if (i > 3 && roads.some((r) => r !== s && segDist(x, z, r.ax, r.az, r.bx, r.bz) < 3)) break;
      }
      return out;
    };
    const a1 = side(1), a2 = side(-1);
    if (a1.length + a2.length < 7 || Math.min(a1.length, a2.length) < 2) continue;
    brooks.push({ pts: [...a1.reverse(), [cx, cz], ...a2], cross: { x: cx, z: cz, yaw: Math.atan2(ux, uz) }, bridge: rnd() < 0.6 });
  }
  const nearBrook = (x: number, z: number, pad: number) => brooks.some((b) => b.pts.some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.6 + pad));

  /** Draws into the ground's canvas (woodZone.ts `paint`): `X`, `Z` from offsets to pixels, `ppm` pixels a metre. */
  const paint = (g: CanvasRenderingContext2D, X: (dx: number) => number, Z: (dz: number) => number, ppm: number) => {
    const prnd = seeded(733 + look.seed);
    // fallen leaves in drifts at the feet of the bands and the groves, and specks of flowers in the open: free, and from far they read
    const spots = Math.round(Math.min(9000, rmax * rmax * 0.35));
    for (let k = 0; k < spots; k++) {
      const x = RING.x + (prnd() - 0.5) * 2 * rmax, z = RING.z + (prnd() - 0.5) * 2 * rmax, cd = coverDist(x, z);
      if (land.beyond(x - RING.x, z - RING.z) > 2 || nearRoad(x, z) < 2) continue;
      const leafy = cd < 4;
      if (!leafy && prnd() > 0.35) continue;
      g.fillStyle = leafy ? ['rgba(150,104,48,0.55)', 'rgba(120,70,40,0.5)', 'rgba(170,140,60,0.5)'][Math.floor(prnd() * 3)] : ['rgba(214,206,180,0.6)', 'rgba(216,184,74,0.55)', 'rgba(140,120,170,0.5)'][Math.floor(prnd() * 3)];
      const r = (leafy ? 0.09 + prnd() * 0.1 : 0.05 + prnd() * 0.05) * ppm;
      g.beginPath(); g.ellipse(X(x - RING.x), Z(z - RING.z), r * 1.4, r, prnd() * 3, 0, Math.PI * 2); g.fill();
    }
    // the brooks: a dark bank, the water, a lighter middle where it catches the sky
    g.lineCap = g.lineJoin = 'round';
    for (const b of brooks) {
      const trace = () => { g.beginPath(); b.pts.forEach(([x, z], i) => (i ? g.lineTo(X(x - RING.x), Z(z - RING.z)) : g.moveTo(X(x - RING.x), Z(z - RING.z)))); };
      for (const [w, col] of [[3.4, 'rgba(62,58,40,0.55)'], [2.4, 'rgba(70,84,60,0.9)'], [1.8, 'rgba(44,90,92,0.95)'], [0.7, 'rgba(96,140,138,0.7)']] as [number, string][]) {
        g.strokeStyle = col; g.lineWidth = w * ppm; trace(); g.stroke();
      }
    }
  };

  /** Builds the props into the zone: solid props into `kit`, scatter and moving things into `into`; lantern lights into `glows`. */
  const build = (o: { kit: PropSink; into: THREE.Group; own: { dispose(): void }[]; gold: THREE.Material; glows: Spot[] }) => {
    const { kit, into, own, gold, glows } = o;
    /** Solid props' footprints, for the check that they keep off the floor's spots. */
    const solids: { x: number; z: number; r: number; k?: string }[] = [];
    const mats = new Map<string, THREE.MeshStandardMaterial>();
    const M = (hex: string) => {
      let m = mats.get(hex);
      if (!m) { mats.set(hex, (m = new THREE.MeshStandardMaterial({ color: hex }))); own.push(m); }
      return m;
    };
    const temp: THREE.BufferGeometry[] = [];
    const T = <G extends THREE.BufferGeometry>(g: G) => (temp.push(g), g);
    const box = (w: number, h: number, d: number) => T(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0));
    const cyl = (r0: number, r1: number, h: number, n = 7) => T(new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0));
    const ico = T(new THREE.IcosahedronGeometry(1, 0));
    /** Puts a part of one colour (`put`) or of one of the zone's own materials (`add`, the gold); both chain. */
    interface Chain {
      put(hex: string, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw?: number, sx?: number, sy?: number, sz?: number, tilt?: number): Chain;
      add(mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw?: number, sx?: number, sy?: number, sz?: number, tilt?: number): Chain;
    }
    const chain: Chain = {
      put: (hex, geo, x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0) => (kit.add(M(hex), geo, x, y, z, yaw, sx, sy, sz, tilt), chain),
      add: (mat, geo, x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0) => (kit.add(mat, geo, x, y, z, yaw, sx, sy, sz, tilt), chain),
    };
    const put = chain.put;
    const solid = (x: number, z: number, r: number, k?: string) => solids.push({ x, z, r, k });

    // a few shapes used again and again
    const lantern = (x: number, z: number, yaw: number) => { // a crooked post with a lantern hung from its arm
      put(C.bark, cyl(0.08, 0.12, 2.6, 6), x, 0, z).put(C.bark, box(0.07, 0.07, 0.8).translate(0, 0, 0.35), x, 2.45, z, yaw, 1, 1, 1, -0.15);
      const lx = x + Math.sin(yaw) * 0.68, lz = z + Math.cos(yaw) * 0.68;
      put(C.lacquer, box(0.24, 0.32, 0.24), lx, 1.95, lz).add(gold, box(0.28, 0.05, 0.28), lx, 2.27, lz);
      glows.push({ x: lx, y: 2.1, z: lz, size: 1.1 });
      solid(x, z, 0.4, 'lantern');
    };
    const signpost = (x: number, z: number, a: number, b: number) => { // two arms, one each way
      put(C.bark, cyl(0.08, 0.1, 2.2, 6), x, 0, z).put(C.plank, box(0.95, 0.22, 0.06).translate(0.38, 0, 0), x, 1.8, z, a).put(C.plank, box(0.8, 0.2, 0.06).translate(0.32, 0, 0), x, 1.5, z, b);
      kit.add(gold, box(0.16, 0.05, 0.16), x, 2.2, z);
      solid(x, z, 0.4, 'signpost');
    };
    const stump = (x: number, z: number, s: number) => {
      // low and mossy, so it does not pass for the cover's taller, flat-cut stumps
      put(C.bark, cyl(0.3 * s, 0.4 * s, 0.28 * s, 9), x, 0, z).put(C.moss, cyl(0.29 * s, 0.31 * s, 0.05, 9), x, 0.28 * s, z);
      for (let i = 0; i < 3; i++) put(C.bark, cyl(0.05, 0.1, 0.6 * s, 5), x, 0, z, rnd() * 6, 1, 1, 1, 1.2); // roots splaying
      solid(x, z, 0.5 * s, 'stump');
    };
    const woodpile = (x: number, z: number, yaw: number) => { // billets stacked between two stakes
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) put(i % 2 ? C.barkLight : C.bark, T(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 7).rotateX(Math.PI / 2)), x + Math.cos(yaw) * (i - (3 - row) / 2) * 0.27, 0.13 + row * 0.23, z - Math.sin(yaw) * (i - (3 - row) / 2) * 0.27, yaw);
      for (const s of [-1, 1]) put(C.bark, box(0.07, 0.95, 0.07), x + Math.cos(yaw) * s * 0.62, 0, z - Math.sin(yaw) * s * 0.62, yaw);
      solid(x, z, 0.8, 'woodpile');
    };
    const beehive = (x: number, z: number) => { // a straw skep on a stand, its bands gilt
      put(C.bark, box(0.7, 0.5, 0.7), x, 0, z).put(C.straw, T(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1)), x, 0.5, z);
      kit.add(gold, T(new THREE.TorusGeometry(0.4, 0.025, 4, 16).rotateX(Math.PI / 2)), x, 0.62, z);
      put(C.lacquer, box(0.12, 0.08, 0.04), x, 0.52, z + 0.4);
      solid(x, z, 0.5, 'beehive');
    };
    const stand = (x: number, z: number) => { // a hunter's stand: four posts, a floor, a rail, a ladder; its back to the trees
      for (const [px, pz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) put(C.bark, cyl(0.07, 0.09, 3.1, 6), x + px, 0, z + pz);
      put(C.plank, box(1.7, 0.1, 1.7), x, 2.2, z).put(C.plank, box(1.7, 0.08, 0.06), x, 2.85, z - 0.82).put(C.plank, box(0.06, 0.08, 1.7), x - 0.82, 2.85, z).put(C.plank, box(0.06, 0.08, 1.7), x + 0.82, 2.85, z);
      kit.add(gold, box(1.74, 0.05, 0.08), x, 2.93, z - 0.82);
      for (const s of [-0.22, 0.22]) put(C.barkLight, box(0.05, 2.5, 0.05), x + s, 0, z + 1.15, 0, 1, 1, 1, -0.28);
      for (let r = 0.4; r < 2.2; r += 0.4) put(C.barkLight, box(0.5, 0.04, 0.05), x, r, z + 1.15 - r * 0.29);
      solid(x, z, 1.2, 'stand');
    };

    // --- the trails: verges, roots, signposts, lanterns --------------------------------------------------------------------------------
    let sinceLamp = 20 + rnd() * 20, lamps = 0;
    const fernAt: [number, number, number][] = [], stoneAt: [number, number, number][] = [], mushAt: [number, number, number, number][] = [];
    for (const s of roads) {
      const L = Math.hypot(s.bx - s.ax, s.bz - s.az), ux = (s.bx - s.ax) / (L || 1), uz = (s.bz - s.az) / (L || 1), nx = -uz, nz = ux, yaw = Math.atan2(ux, uz);
      for (let d = 1; d < L - 1; d += 1.3) {
        const cx = s.ax + ux * d, cz = s.az + uz * d;
        sinceLamp += 1.3;
        for (const side of [-1, 1]) {
          const off = 2.3 + rnd() * 1.6, x = cx + nx * side * off, z = cz + nz * side * off;
          if (!free(x, z, 0.3, { road: 2.1, place: 0.5 })) continue;
          const u = rnd();
          if (u < 0.22) fernAt.push([x, z, 0.7 + rnd() * 0.5]);
          else if (u < 0.32) stoneAt.push([x, z, 0.18 + rnd() * 0.22]);
          else if (u < 0.38) mushAt.push([x, z, 0.8 + rnd() * 0.6, rnd() < 0.5 ? 0 : 1]);
          // a root running out of the trees along the verge, half sunk in the ground, with a smaller one crossing it
          if (rnd() < 0.05 && coverDist(x, z) < 6 && !nearBrook(x, z, 1.5)) {
            put(C.bark, T(new THREE.CylinderGeometry(0.1, 0.2, 2.4, 6).rotateX(Math.PI / 2)), x, 0.02, z, yaw + (rnd() - 0.5) * 0.5, 1, 1, 1, -0.06);
            put(C.barkLight, T(new THREE.CylinderGeometry(0.06, 0.12, 1.3, 5).rotateX(Math.PI / 2)), x + ux * 0.5, 0.0, z + uz * 0.5, yaw + 0.9 + rnd() * 0.5, 1, 1, 1, -0.08);
            solid(x, z, 1.2);
          }
        }
        if (sinceLamp > 34 + rnd() * 16 && lamps < 6) {
          const side = rnd() < 0.5 ? 1 : -1, x = cx + nx * side * 2.8, z = cz + nz * side * 2.8;
          if (free(x, z, 0.5, { road: 2.5, place: 3 }) && !nearBrook(x, z, 1)) { lantern(x, z, Math.atan2(-nx * side, -nz * side)); sinceLamp = 0; lamps++; }
        }
      }
    }
    // a signpost where a trail meets a glade, and where two trails meet
    const ends: { x: number; z: number; ux: number; uz: number }[] = [];
    for (const p of look.paths) {
      const n = p.length;
      if (n < 2) continue;
      for (const [i, j] of [[0, 1], [n - 1, n - 2]]) ends.push({ x: RING.x + p[i][0], z: RING.z + p[i][1], ux: p[j][0] - p[i][0], uz: p[j][1] - p[i][1] });
    }
    const posts: { x: number; z: number }[] = [];
    for (const e of ends) {
      const l = Math.hypot(e.ux, e.uz) || 1, ux = e.ux / l, uz = e.uz / l;
      const place = placeAt(e.x, e.z, 3), fork = !place && ends.some((f) => f !== e && Math.hypot(f.x - e.x, f.z - e.z) < 3);
      if (!place && !fork) continue;
      // stand it a few metres up the trail from the glade's edge, to one side
      const back = place ? Math.max(0, place.r + 2 - Math.hypot(e.x - place.x, e.z - place.z)) : 3, side = rnd() < 0.5 ? 1 : -1;
      const x = e.x + ux * back - uz * side * 2.7, z = e.z + uz * back + ux * side * 2.7;
      if (posts.some((q) => Math.hypot(q.x - x, q.z - z) < 8) || !free(x, z, 0.4, { road: 2.2 }) || nearBrook(x, z, 0.5)) continue;
      posts.push({ x, z });
      const a = Math.atan2(uz, -ux);
      signpost(x, z, a, a + 2.2 + rnd() * 0.6);
    }
    // the footbridges and the stepping stones
    for (const b of brooks) {
      const { x, z, yaw } = b.cross;
      if (b.bridge) {
        put(C.plank, box(2.6, 0.12, 3.6), x, 0.12, z, yaw);
        for (let k = -1.5; k <= 1.51; k += 0.5) put(C.bark, box(2.7, 0.04, 0.06), x + Math.sin(yaw) * k, 0.24, z + Math.cos(yaw) * k, yaw);
        for (const s of [-1.35, 1.35]) {
          for (const e of [-1.6, 1.6]) put(C.bark, cyl(0.06, 0.07, 0.9, 6), x + Math.cos(yaw) * s + Math.sin(yaw) * e, 0, z - Math.sin(yaw) * s + Math.cos(yaw) * e);
          put(C.barkLight, box(0.07, 0.07, 3.4), x + Math.cos(yaw) * s, 0.86, z - Math.sin(yaw) * s, yaw);
          kit.add(gold, box(0.08, 0.03, 3.42), x + Math.cos(yaw) * s, 0.91, z - Math.sin(yaw) * s, yaw);
        }
      } else {
        for (let k = -1.2; k <= 1.21; k += 0.8) put(C.stone, cyl(0.32, 0.36, 0.14, 9), x + Math.sin(yaw) * k + (rnd() - 0.5) * 0.3, 0, z + Math.cos(yaw) * k + (rnd() - 0.5) * 0.3);
      }
      // reeds and stones along its banks
      b.pts.forEach(([px, pz], i) => {
        if (i % 2 || Math.hypot(px - x, pz - z) < 3) return;
        const s2 = rnd() < 0.5 ? 1 : -1, qx = px + s2 * (1.2 + rnd() * 0.4), qz = pz + (rnd() - 0.5) * 1.2;
        if (rnd() < 0.6) fernAt.push([qx, qz, 0.6 + rnd() * 0.3]);
        else stoneAt.push([qx, qz, 0.2 + rnd() * 0.15]);
      });
    }

    // --- the places, dressed as what they are (solid props round the edge, only low things inside) -------------------------------------
    const ring = (p: { x: number; z: number; r: number }, n: number, from: number, to: number, make: (x: number, z: number, a: number) => void, pad = 0.8, o2: { road?: number; tall?: boolean } = {}) => {
      for (let k = 0, made = 0; k < n * 16 && made < n; k++) {
        const a = rnd() * Math.PI * 2, d = from + rnd() * (to - from), x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
        if (!free(x, z, pad, { road: o2.road ?? 2.4 }) || nearBrook(x, z, 0.5) || (o2.tall && !backed(x, z))) continue;
        if (look.places.some((q) => q !== p && Math.hypot(x - q.x, z - q.z) < q.r + 1)) continue;
        make(x, z, a);
        made++;
      }
    };
    const lowAt: [number, number, number][] = []; // flowers inside a place: [x, z, kind]
    for (const p of look.places) {
      const r = p.r;
      switch (p.kind) {
        case 'camp':
          ring(p, 1, r + 0.5, r + 4, (x, z, a) => woodpile(x, z, a + Math.PI / 2), 1);
          ring(p, 1, r + 0.5, r + 4, (x, z) => { // a cooking tripod with a pot
            for (let i = 0; i < 3; i++) put(C.bark, cyl(0.04, 0.05, 1.9, 5), x + Math.cos(i * 2.1) * 0.5, 0, z + Math.sin(i * 2.1) * 0.5, -i * 2.1, 1, 1, 1, 0.26);
            put(C.lacquer, T(new THREE.SphereGeometry(0.26, 10, 6)), x, 0.75, z).add(gold, T(new THREE.TorusGeometry(0.22, 0.02, 4, 12).rotateX(Math.PI / 2)), x, 0.95, z);
            solid(x, z, 0.7, 'tripod');
          }, 1);
          ring(p, 3, r + 0.5, r + 5, (x, z, a) => { put(C.wine, box(0.75, 0.14, 1.9), x, 0, z, a).put(C.cream, cyl(0.16, 0.16, 0.75, 8).rotateZ(Math.PI / 2), x + Math.sin(a) * 0.8, 0.15, z + Math.cos(a) * 0.8, a + Math.PI / 2); solid(x, z, 0.9); }, 0.6);
          break;
        case 'burners':
          ring(p, 3, r + 0.5, r + 5, (x, z, a) => woodpile(x, z, a + Math.PI / 2), 0.8);
          ring(p, 2, r + 0.5, r + 4, (x, z) => { // a stack of cut billets standing on end, ready for the mound
            for (let i = 0; i < 7; i++) { const aa = (i / 7) * 6.28; put(i % 2 ? C.bark : C.barkLight, cyl(0.12, 0.12, 1.2, 6), x + Math.cos(aa) * 0.32, 0, z + Math.sin(aa) * 0.32, 0, 1, 1, 1, 0.12); }
            solid(x, z, 0.6);
          }, 0.8);
          for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, d = rnd() * r; lowAt.push([p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 3]); } // charcoal crumbs
          break;
        case 'shrine':
          ring(p, 2, r + 0.5, r + 3.5, (x, z, a) => { // ribbons on a line between two posts
            const cx2 = Math.cos(a), sz = -Math.sin(a);
            for (const s of [-1.3, 1.3]) put(C.bark, box(0.08, 2.1, 0.08), x + cx2 * s, 0, z + sz * s);
            put(C.rope, box(2.6, 0.02, 0.02), x, 2.0, z, a);
            for (let f = -1; f <= 1.01; f += 0.4) put([C.wine, C.cream, C.teal][Math.floor(rnd() * 3)], box(0.12, 0.65 + rnd() * 0.3, 0.02).translate(0, -0.33, 0), x + cx2 * f, 2.0, z + sz * f, a + (rnd() - 0.5) * 0.3);
            solid(x, z, 1.4);
          }, 0.8);
          ring(p, 5, r - 1.5, r + 1, (x, z) => { // offerings: small jars and a bowl of fruit at the edge
            put(C.cream, cyl(0.1, 0.13, 0.28, 8), x, 0, z).add(gold, cyl(0.08, 0.08, 0.03, 8), x, 0.28, z);
            put(C.wine, T(new THREE.SphereGeometry(0.07, 6, 4)), x + 0.2, 0.06, z + 0.05);
          }, 0.4, { road: 2 });
          for (let i = 0; i < 18; i++) { const a = rnd() * 6.28, d = r - 1 + rnd() * 2; lowAt.push([p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, Math.floor(rnd() * 3)]); }
          break;
        case 'spring': {
          for (let i = 0; i < 16; i++) { // stones round the pool (its rim is 3.7 m)
            const a = (i / 16) * 6.28 + rnd() * 0.2;
            put(C.stone, ico, p.x + Math.cos(a) * 4.05, 0.02, p.z + Math.sin(a) * 4.05, rnd() * 6, 0.32 + rnd() * 0.12, 0.16, 0.26);
          }
          for (let i = 0; i < 26; i++) { // reeds in clumps at the pool's edge, on its north side (behind it for the camera)
            const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, d = 4.3 + rnd() * 0.9;
            fernAt.push([p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, -1]); // -1: a reed
          }
          for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, d = 1 + rnd() * 2.2; lowAt.push([p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 4]); } // lily pads
          break;
        }
        case 'stones': case 'giants': {
          // lichen on fallen stones round the edge, a ring of tall grass
          ring(p, 6, r + 0.5, r + 5, (x, z) => { put(C.stone, ico, x, 0.1, z, rnd() * 6, 0.5 + rnd() * 0.3, 0.32, 0.45).put(C.lichen, ico, x, 0.32, z, rnd() * 6, 0.32, 0.08, 0.3); solid(x, z, 0.6); }, 0.6);
          for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.28 + rnd() * 0.1, d = r + 0.6 + rnd() * 0.8; fernAt.push([p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, -2]); } // -2: tall grass
          if (p.kind === 'giants') {
            ring(p, 1, r + 1, r + 5, (x, z) => { // a cairn of stones
              for (let i = 0; i < 4; i++) put(i % 2 ? C.stone : C.stoneDark, ico, x, 0.25 + i * 0.4, z, rnd() * 6, 0.8 - i * 0.15, 0.32, 0.7 - i * 0.14);
              kit.add(gold, cyl(0.06, 0.06, 0.3, 6), x, 1.65, z);
              solid(x, z, 0.9);
            }, 1);
            ring(p, 1, r + 1, r + 5, (x, z, a) => { put(C.bark, cyl(0.16, 0.3, 2.6, 7).rotateZ(Math.PI / 2), x, 0.3, z, a); solid(x, z, 1.3); }, 1); // a dropped club
          }
          break;
        }
        case 'den':
          ring(p, 6, r - 1, r + 3, (x, z) => { // bones in the leaves
            put(C.bone, cyl(0.04, 0.04, 0.55, 5).rotateZ(Math.PI / 2), x, 0.05, z, rnd() * 6).put(C.bone, T(new THREE.SphereGeometry(0.07, 5, 4)), x + 0.26, 0.06, z);
          }, 0.4, { road: 2 });
          ring(p, 2, r + 0.5, r + 4, (x, z, a) => { put(C.bark, cyl(0.25, 0.3, 2.2, 7).rotateZ(Math.PI / 2), x, 0.25, z, a); solid(x, z, 1.1); }, 1); // a log with its bark clawed off
          break;
        case 'bramble':
          ring(p, 7, r, r + 4, (x, z) => { // berried shoots
            for (let i = 0; i < 4; i++) put('#5a2f3e', T(new THREE.ConeGeometry(0.05, 0.9 + rnd() * 0.5, 4).translate(0, 0.45, 0)), x + (rnd() - 0.5) * 0.6, 0, z + (rnd() - 0.5) * 0.6, 0, 1, 1, 1, (rnd() - 0.5) * 0.9);
            for (let i = 0; i < 4; i++) put(C.berry, T(new THREE.SphereGeometry(0.06, 5, 4)), x + (rnd() - 0.5) * 0.6, 0.4 + rnd() * 0.4, z + (rnd() - 0.5) * 0.6);
            solid(x, z, 0.5);
          }, 0.5);
          break;
        case 'thicket':
          for (let i = 0; i < 24; i++) { const a = rnd() * 6.28, d = r + rnd() * 4; fernAt.push([p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 0.9 + rnd() * 0.4]); }
          ring(p, 3, r, r + 4, (x, z, a) => put(C.bark, cyl(0.05, 0.09, 1.8, 5).rotateZ(Math.PI / 2), x, 0.08, z, a), 0.4); // fallen branches
          break;
        case 'hollow':
          ring(p, 2, r + 0.5, r + 5, (x, z) => stump(x, z, 0.9 + rnd() * 0.4), 0.8);
          for (let i = 0; i < 30; i++) { const a = rnd() * 6.28, d = r * 0.6 + rnd() * (r * 0.6); mushAt.push([p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 0.7 + rnd() * 0.7, rnd() < 0.6 ? 0 : 1]); }
          break;
        case 'lamps':
          for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, d = r - 0.5 + rnd() * 3; mushAt.push([p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 0.9 + rnd() * 0.8, 1]); }
          break;
        case 'heart':
          for (let i = 0; i < 60; i++) { const a = (i / 60) * 6.28, d = r + 0.3 + rnd() * 0.8; lowAt.push([p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, i % 3]); }
          break;
      }
    }

    // --- the glades: stumps, woodpiles, beehives, a hunter's stand; a fairy ring now and then -------------------------------------------
    const area = 0.5 * Math.sin((Math.PI * 2) / look.rim.length) * look.rim.reduce((s, v, i) => s + v * look.rim[(i + 1) % look.rim.length], 0);
    const glade = (n: number, make: (x: number, z: number) => void, pad: number, o2: { tall?: boolean; road?: number; away?: number } = {}) => {
      const done: { x: number; z: number }[] = [];
      for (let k = 0; k < n * 30 && done.length < n; k++) {
        const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
        if (!free(x, z, pad, { road: o2.road ?? 3, place: 3 }) || nearBrook(x, z, 0.5) || (o2.tall && !backed(x, z))) continue;
        if (done.some((d) => Math.hypot(d.x - x, d.z - z) < (o2.away ?? 25))) continue;
        make(x, z);
        done.push({ x, z });
      }
    };
    glade(Math.round(area / 1400), (x, z) => stump(x, z, 0.8 + rnd() * 0.5), 1, { away: 12 });
    glade(Math.round(area / 5000), (x, z) => woodpile(x, z, rnd() * 3), 1, { away: 30 });
    glade(Math.round(area / 9000), (x, z) => { beehive(x, z); if (rnd() < 0.6) beehive(x + 1.2, z + 0.3); }, 1.2, { away: 40, tall: true });
    glade(2, (x, z) => stand(x, z), 1.6, { tall: true, away: 60 });
    glade(Math.max(1, Math.round(area / 12000)), (x, z) => { for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.28; mushAt.push([x + Math.cos(a) * 1.7, z + Math.sin(a) * 1.7, 0.8 + rnd() * 0.4, 0]); } }, 2.5, { away: 50 });

    // --- the far wood: a woodcutter's cottage with smoke from its chimney, a watchtower on the ridge ------------------------------------
    const smokeFrom: { x: number; y: number; z: number; big: number }[] = [];
    for (const p of look.places) if (p.kind === 'burners') { const m = look.pieces.find((q, i) => look.kinds[i] === 'mound' && Math.hypot(q.o.ax - p.x, q.o.az - p.z) < p.r + 4); if (m) smokeFrom.push({ x: m.o.ax, y: m.o.height, z: m.o.az, big: 1 }); }
    {
      // the cottage: east or west (the side away from the mirror's elder is as good as any), 26 to 40 m past the outline, on the hills
      for (let k = 0; k < 40; k++) {
        const a = (look.mirror === 1 ? Math.PI : 0) + (rnd() - 0.5) * 0.9, b = 26 + rnd() * 14, rr = rimAt(look.rim, a) + b, dx = Math.cos(a) * rr, dz = Math.sin(a) * rr;
        if (dz > 10) continue;
        const x = RING.x + dx, z = RING.z + dz, y = land.height(dx, dz) - 0.2, yaw = Math.atan2(-dx, -dz);
        put(C.stoneDark, box(5.6, 0.6, 4.4), x, y - 0.3, z, yaw).put('#b4ab94', box(5, 2.8, 3.8), x, y, z, yaw);
        put(C.straw, T(new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4).scale(4.4, 2.4, 3.6)), x, y + 2.8 + 1.2, z, yaw);
        const cx2 = x + Math.cos(yaw) * 1.6, cz2 = z - Math.sin(yaw) * 1.6;
        put(C.stone, box(0.7, 2.6, 0.7), cx2, y + 2.6, cz2, yaw);
        put(C.plank, box(1, 1.8, 0.08), x + Math.sin(yaw) * 1.92, y, z + Math.cos(yaw) * 1.92, yaw);
        smokeFrom.push({ x: cx2, y: y + 5.3, z: cz2, big: 1.6 });
        glows.push({ x: x + Math.sin(yaw) * 2.1 + Math.cos(yaw) * 1.4, y: y + 1.6, z: z + Math.cos(yaw) * 2.1 - Math.sin(yaw) * 1.4, size: 1.6 });
        break;
      }
      // the watchtower on the northern ridge: stone, a gilt rim, a lantern at its top
      for (let k = 0; k < 40; k++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 1.2, b = 30 + rnd() * 16, rr = rimAt(look.rim, a) + b, dx = Math.cos(a) * rr, dz = Math.sin(a) * rr;
        if (land.ridge(dx, dz) < 0.6 || Math.hypot(RING.x + dx - look.elder.x, RING.z + dz - look.elder.z) < 40) continue;
        const x = RING.x + dx, z = RING.z + dz, y = land.height(dx, dz) - 0.5;
        put(C.stone, cyl(1.6, 2.0, 10, 10), x, y, z).put(C.stoneDark, cyl(2.1, 1.7, 1.2, 10), x, y + 10, z).put(C.wine, T(new THREE.ConeGeometry(2.2, 2.6, 10).translate(0, 1.3, 0)), x, y + 11.2, z);
        kit.add(gold, cyl(2.15, 2.15, 0.14, 10), x, y + 11.1, z);
        glows.push({ x, y: y + 10.6, z: z + 1.9, size: 3 });
        break;
      }
    }

    // --- the scatter: merged by squares, no shadows cast ----------------------------------------------------------------------------------
    const tint = (geo: THREE.BufferGeometry, hex: string) => {
      const nn = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(hex), c = new Float32Array(nn.attributes.position.count * 3);
      for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
      for (const k of Object.keys(nn.attributes)) if (k !== 'position' && k !== 'normal') nn.deleteAttribute(k);
      nn.setAttribute('color', new THREE.BufferAttribute(c, 3));
      return nn;
    };
    const matI = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
    own.push(matI);
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    const lists = new Map<string, THREE.Matrix4[]>();
    const add = (kind: string, x: number, y: number, z: number, s: number, sy = s, yaw = rnd() * 6.28, tilt = 0) => {
      let l = lists.get(kind);
      if (!l) lists.set(kind, (l = []));
      q.setFromEuler(e.set(tilt, yaw, 0, 'YXZ'));
      l.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, sy, s)));
    };
    // the glades' own: grass, fallen leaves, flowers in clumps, ferns at the feet of the trees, pebbles
    // grass in clumps (a clump of tufts reads from the camera's height; tufts spread evenly read as noise), thicker near the trees
    for (let k = 0, made = 0, want = Math.round(area / 5.5); k < want && made < want; k++) {
      const cx = RING.x + (rnd() - 0.5) * 2 * rmax, cz = RING.z + (rnd() - 0.5) * 2 * rmax, cd = coverDist(cx, cz);
      if (rnd() > (cd < 6 ? 1 : 0.55)) continue;
      const n = 4 + Math.floor(rnd() * 8), wide = 0.6 + rnd() * 1.1, dry = rnd() < 0.25;
      for (let i = 0; i < n; i++) {
        const x = cx + (rnd() - 0.5) * 2 * wide, z = cz + (rnd() - 0.5) * 2 * wide;
        if (!free(x, z, 0.15, { road: 1.9, place: 0.3, inside: 0.5 }) || nearBrook(x, z, 0)) continue;
        add(dry ? 'dry' : 'tuft', x, 0, z, 0.8 + rnd() * 0.6, 0.7 + rnd() * 0.8);
        made++;
      }
    }
    // low shrubs along the tree lines (a hand's height: they read as undergrowth, not as something to walk round)
    for (let k = 0, made = 0, want = Math.round(area / 70); k < want * 4 && made < want; k++) {
      const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax, cd = coverDist(x, z);
      if (cd < 0.3 || cd > 4 || !free(x, z, 0.2, { road: 2.2, place: 1, inside: 0.5 }) || nearBrook(x, z, 0.3)) continue;
      add(rnd() < 0.6 ? 'shrub0' : 'shrub1', x, 0, z, 0.55 + rnd() * 0.45, 0.45 + rnd() * 0.3);
      made++;
    }
    for (let k = 0, want = Math.round(area / 5); k < want * 3 && (lists.get('leaf')?.length ?? 0) < want; k++) {
      const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
      // thick under the trees, thinner in the open, none on the trails' middles or in the brooks
      if (land.beyond(x - RING.x, z - RING.z) > 0 || nearRoad(x, z) < 1.2 || nearBrook(x, z, -0.4)) continue;
      const cd = coverDist(x, z);
      if (cd < -0.5 || rnd() > (cd < 4 ? 1 : 0.3)) continue;
      add('leaf', x, 0.02, z, 0.8 + rnd() * 0.6, 1, rnd() * 6.28, (rnd() - 0.5) * 0.3);
    }
    for (let k = 0, made = 0, want = Math.round(area / 160); k < want * 4 && made < want; k++) {
      const cx = RING.x + (rnd() - 0.5) * 2 * rmax, cz = RING.z + (rnd() - 0.5) * 2 * rmax;
      if (!free(cx, cz, 0.6, { road: 2.4, place: 1, inside: 1 }) || coverDist(cx, cz) < 2 || nearBrook(cx, cz, 0.5)) continue;
      const col = Math.floor(rnd() * 3), wide = 1 + rnd() * 1.4;
      for (let f = 0; f < 16; f++) {
        const x = cx + (rnd() - 0.5) * 2 * wide, z = cz + (rnd() - 0.5) * 2 * wide;
        if (free(x, z, 0.2, { road: 2, inside: 0.5 })) add(`flower${rnd() < 0.8 ? col : (col + 1) % 3}`, x, 0, z, 0.8 + rnd() * 0.6);
      }
      made++;
    }
    for (let k = 0, made = 0, want = Math.round(area / 30); k < want * 4 && made < want; k++) {
      // ferns at the feet of the bands and the groves
      const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax, cd = coverDist(x, z);
      if (cd < 0.2 || cd > 3.2 || !free(x, z, 0.2, { road: 2, place: 0.5, inside: 0.5 })) continue;
      add('fern', x, 0, z, 0.9 + rnd() * 0.6);
      made++;
    }
    for (let k = 0, want = Math.round(area / 260); k < want * 3 && (lists.get('stone')?.length ?? 0) < want; k++) {
      const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax;
      if (!free(x, z, 0.3, { road: 1.6, place: 0, inside: 0.5 })) continue;
      add('stone', x, 0, z, 0.2 + rnd() * 0.3, 0.14 + rnd() * 0.12);
    }
    for (let k = 0, want = Math.round(area / 300); k < want * 3 && (lists.get('mush0')?.length ?? 0) < want; k++) {
      const x = RING.x + (rnd() - 0.5) * 2 * rmax, z = RING.z + (rnd() - 0.5) * 2 * rmax, cd = coverDist(x, z);
      if (cd < 0.3 || cd > 3 || !free(x, z, 0.2, { road: 2, place: 0.5, inside: 0.5 })) continue;
      for (let i = 0, n = 2 + Math.floor(rnd() * 3); i < n; i++) add(`mush${rnd() < 0.7 ? 0 : 1}`, x + (rnd() - 0.5) * 0.7, 0, z + (rnd() - 0.5) * 0.7, 0.7 + rnd() * 0.6);
    }
    // what the trails, the places and the brooks asked for
    for (const [x, z, s] of fernAt) {
      if (onCover(x, z, 0.1)) continue;
      if (s === -1) add('reed', x, 0, z, 0.8 + rnd() * 0.4, 0.8 + rnd() * 0.6);
      else if (s === -2) add('tuft', x, 0, z, 1.0 + rnd() * 0.4, 1.4 + rnd() * 0.6);
      else add('fern', x, 0, z, s);
    }
    for (const [x, z, s] of stoneAt) if (!onCover(x, z, 0.1)) add('mossy', x, 0, z, s * 1.4, s);
    for (const [x, z, s, k] of mushAt) if (!onCover(x, z, 0.1) && nearRoad(x, z) > 1.8) add(`mush${k}`, x, 0, z, s);
    for (const [x, z, k] of lowAt) {
      if (onCover(x, z, 0.1)) continue;
      if (k < 3) add(`flower${k}`, x, 0, z, 0.8 + rnd() * 0.5);
      else if (k === 3) add('coal', x, 0.01, z, 0.06 + rnd() * 0.07, 0.03 + rnd() * 0.03);
      else add('pad', x, 0.05, z, 0.3 + rnd() * 0.25, 1);
    }
    // the shapes: few triangles each (a blade of grass is one), positions and colours only (the material shades them flat)
    type Shape = { p: number[]; c: number[] };
    const shape = (): Shape => ({ p: [], c: [] });
    const col3 = (hex: string) => { const k = new THREE.Color(hex); return [k.r, k.g, k.b]; };
    /** Adds a three geometry to a shape, moved by `m` (a matrix), in one colour. */
    const geoInto = (sh: Shape, g: THREE.BufferGeometry, hex: string, m?: THREE.Matrix4) => {
      const n = g.index ? g.toNonIndexed() : g, pa = n.attributes.position, v = new THREE.Vector3(), cc = col3(hex);
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); if (m) v.applyMatrix4(m); sh.p.push(v.x, v.y, v.z); sh.c.push(...cc); }
      if (n !== g) n.dispose();
      g.dispose();
      return sh;
    };
    /** A flat triangle from (−w, 0) to (w, 0) to a tip at height h leaning out by `lean`, turned by `a` round the up axis. */
    const blade = (sh: Shape, a: number, w: number, h: number, lean: number, hex: string) => {
      const ca = Math.cos(a), sa = Math.sin(a), cc = col3(hex);
      const pt = (x: number, y: number, z: number) => sh.p.push(x * ca + z * sa, y, -x * sa + z * ca);
      pt(-w, 0, 0); pt(w, 0, 0); pt(0, h, lean);
      sh.c.push(...cc, ...cc, ...cc);
      return sh;
    };
    /** A frond: a long diamond (two triangles) lying out from the middle at a slant. */
    const frond = (sh: Shape, a: number, l: number, hex: string) => {
      const ca = Math.cos(a), sa = Math.sin(a), cc = col3(hex), w = l * 0.16;
      const pt = (x: number, y: number, z: number) => sh.p.push(x * ca + z * sa, y, -x * sa + z * ca);
      pt(0, 0.02, 0); pt(-w, l * 0.42, l * 0.45); pt(0, l * 0.5, l); pt(0, 0.02, 0); pt(0, l * 0.5, l); pt(w, l * 0.42, l * 0.45);
      for (let i = 0; i < 6; i++) sh.c.push(...cc);
      return sh;
    };
    const tuftOf = (cols: string[]) => { const s = shape(); [0, 1.05, 2.1, 3.15, 4.2, 5.25].forEach((a, i) => blade(s, a, 0.09, 0.5 + (i % 3) * 0.12, 0.22, cols[i % cols.length])); return s; };
    const shroom = (cap: string) => geoInto(geoInto(shape(), new THREE.CylinderGeometry(0.04, 0.05, 0.2, 4, 1, true).translate(0, 0.1, 0), C.cream), new THREE.ConeGeometry(0.13, 0.11, 6, 1, true).translate(0, 0.25, 0), cap);
    const flower = (head: string) => geoInto(blade(shape(), 0, 0.02, 0.38, 0, '#4a6638'), new THREE.OctahedronGeometry(0.1).scale(1, 0.55, 1).translate(0, 0.4, 0), head);
    const shrubOf = (a: string, b: string) => geoInto(geoInto(shape(), new THREE.IcosahedronGeometry(1, 0).scale(1, 0.7, 1).translate(0, 0.5, 0), a), new THREE.IcosahedronGeometry(0.7, 0).scale(1, 0.7, 1).translate(0.6, 0.45, 0.3), b);
    const shapes: Record<string, Shape> = {
      tuft: tuftOf(['#62783e', '#546c38', '#6e8444']),
      dry: tuftOf(['#868250', '#787646', '#908a56']),
      shrub0: shrubOf('#4a6a36', '#557a3e'),
      shrub1: shrubOf('#5a6e34', '#6a7c3c'),
      fern: (() => { const s = shape(); [0, 1.25, 2.5, 3.75, 5].forEach((a, i) => frond(s, a, 0.75 + (i % 2) * 0.15, i % 2 ? C.fern : C.fernDark)); return s; })(),
      reed: (() => { const s = shape(); [0, 2.1, 4.2].forEach((a, i) => blade(s, a, 0.03, 1.3 + i * 0.2, 0.12, C.reed)); return geoInto(s, new THREE.OctahedronGeometry(0.05).scale(1, 2.2, 1).translate(0.05, 1.35, 0), '#5a3a22'); })(),
      leaf: (() => { const s = shape(); const cc = [1, 1, 1]; s.p.push(-0.12, 0, 0, 0, 0, 0.07, 0.12, 0, 0, -0.12, 0, 0, 0.12, 0, 0, 0, 0, -0.07); for (let i = 0; i < 6; i++) s.c.push(...cc); return s; })(),
      mossy: geoInto(geoInto(shape(), new THREE.IcosahedronGeometry(1, 0), C.stone), new THREE.IcosahedronGeometry(0.85, 0).scale(1, 0.35, 1).translate(0, 0.62, 0), C.moss),
      stone: geoInto(shape(), new THREE.IcosahedronGeometry(1, 0), C.stoneDark),
      mush0: shroom('#7a3a26'),
      mush1: shroom('#c8a250'),
      flower0: flower('#e6dfcc'),
      flower1: flower('#d8b84a'),
      flower2: flower('#8a76b0'),
      coal: geoInto(shape(), new THREE.OctahedronGeometry(1), '#2e2c2a'),
      pad: geoInto(shape(), new THREE.CircleGeometry(1, 7, 0.3, 5.6).rotateX(-Math.PI / 2), '#3e6a3a'),
    };
    const leafTints = ['#a8803a', '#8a4a2a', '#7a7a36', '#b89a4a', '#6e5a2e'].map((h) => new THREE.Color(h));
    // Merged into one mesh a 64 m square (a square out of the camera's view is not drawn): a few draws for all of it, no shadows cast.
    const CELLM = 64, cells = new Map<string, { n: number; items: [Shape, THREE.Matrix4, number][] }>();
    for (const [kind, list] of lists) {
      const sh = shapes[kind];
      if (!sh) continue;
      list.forEach((m, i) => {
        const key = `${Math.floor(m.elements[12] / CELLM)}:${Math.floor(m.elements[14] / CELLM)}`;
        let cell = cells.get(key);
        if (!cell) cells.set(key, (cell = { n: 0, items: [] }));
        cell.items.push([sh, m, kind === 'leaf' ? 1 + (i % leafTints.length) : 0]);
        cell.n += sh.p.length / 3;
      });
    }
    for (const cell of cells.values()) {
      const pos = new Float32Array(cell.n * 3), colr = new Float32Array(cell.n * 3);
      let o3 = 0;
      for (const [sh, m, tintI] of cell.items) {
        const el = m.elements, tc = tintI ? leafTints[tintI - 1] : null;
        for (let i = 0; i < sh.p.length; i += 3) {
          const x = sh.p[i], y = sh.p[i + 1], z = sh.p[i + 2];
          pos[o3] = el[0] * x + el[4] * y + el[8] * z + el[12];
          pos[o3 + 1] = el[1] * x + el[5] * y + el[9] * z + el[13];
          pos[o3 + 2] = el[2] * x + el[6] * y + el[10] * z + el[14];
          colr[o3] = tc ? tc.r : sh.c[i]; colr[o3 + 1] = tc ? tc.g : sh.c[i + 1]; colr[o3 + 2] = tc ? tc.b : sh.c[i + 2];
          o3 += 3;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, matI);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.matrixAutoUpdate = false;
      into.add(mesh);
      own.push(geo);
    }
    lists.clear();

    // --- the moving things: leaves drifting down under the trees, birds over the hills, smoke --------------------------------------------
    const m4 = new THREE.Matrix4(), rot = new THREE.Matrix4(), scl = new THREE.Matrix4();
    // drifting leaves: each falls from a crown's height to the ground under a band or a grove, swaying, then begins again
    const DRIFT = 90, dx0 = new Float32Array(DRIFT), dz0 = new Float32Array(DRIFT), dph = new Float32Array(DRIFT), dsp = new Float32Array(DRIFT);
    for (let i = 0, k = 0; i < DRIFT && k < DRIFT * 40; k++) {
      const c = cover[Math.floor(rnd() * cover.length)];
      if (!c || c.r > 4 || land.beyond(c.ax - RING.x, c.az - RING.z) > 0) continue; // the bands and groves, not the edge walls
      const t = rnd(), side = (rnd() - 0.5) * 2 * (c.r + 3);
      const L = Math.hypot(c.bx - c.ax, c.bz - c.az) || 1, nx = -(c.bz - c.az) / L, nz = (c.bx - c.ax) / L;
      dx0[i] = c.ax + (c.bx - c.ax) * t + (L > 0.5 ? nx * side : side * 0.7); dz0[i] = c.az + (c.bz - c.az) * t + (L > 0.5 ? nz * side : (rnd() - 0.5) * 2 * (c.r + 3));
      dph[i] = rnd() * 100; dsp[i] = 0.5 + rnd() * 0.4;
      i++;
    }
    const driftGeo = tint(new THREE.CircleGeometry(0.11, 4).scale(1, 0.55, 1), '#ffffff');
    // its own material: one shared by plain meshes and an instanced one makes three look the shader up again every frame
    const driftMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
    own.push(driftMat);
    const drift = new THREE.InstancedMesh(driftGeo, driftMat, DRIFT);
    for (let i = 0; i < DRIFT; i++) drift.setColorAt(i, leafTints[i % leafTints.length]);
    drift.frustumCulled = false;
    into.add(drift);
    own.push(driftGeo);
    // birds: dark V's wheeling over the hills, east and west
    const BIRDS = 10, birdGeo = mergeGeometries([new THREE.BoxGeometry(0.8, 0.04, 0.14).translate(0.38, 0, 0).rotateZ(0.22), new THREE.BoxGeometry(0.8, 0.04, 0.14).translate(-0.38, 0, 0).rotateZ(-0.22)])!;
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x2a2826 });
    own.push(birdGeo, birdMat);
    const flock = new THREE.InstancedMesh(birdGeo, birdMat, BIRDS);
    flock.frustumCulled = false;
    into.add(flock);
    const bx = new Float32Array(BIRDS), bz = new Float32Array(BIRDS), br = new Float32Array(BIRDS), bh = new Float32Array(BIRDS), bs = new Float32Array(BIRDS), bp = new Float32Array(BIRDS);
    for (let i = 0; i < BIRDS; i++) {
      const a = (i < BIRDS / 2 ? 0 : Math.PI) + (rnd() - 0.5) * 0.8, d = rmax + 30 + rnd() * 30;
      bx[i] = RING.x + Math.cos(a) * d; bz[i] = RING.z + Math.sin(a) * d * 0.7 - 20; br[i] = 8 + rnd() * 12; bh[i] = 20 + rnd() * 10; bs[i] = 0.2 + rnd() * 0.2; bp[i] = rnd() * 6.28;
    }
    // smoke: soft puffs rising from the burners' mounds and the cottage's chimney, growing and thinning
    const PUFFS = 9, SMOKE = smokeFrom.length * PUFFS;
    const smokeGeo = new THREE.IcosahedronGeometry(1, 1), smokeMat = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 1, transparent: true, opacity: 0.32, depthWrite: false, flatShading: true });
    own.push(smokeGeo, smokeMat);
    const smoke = SMOKE ? new THREE.InstancedMesh(smokeGeo, smokeMat, SMOKE) : null;
    if (smoke) { smoke.frustumCulled = false; smoke.castShadow = false; into.add(smoke); }

    const update = (time: number) => {
      for (let i = 0; i < DRIFT; i++) {
        const cyc = 7 / dsp[i], t = ((time + dph[i]) % cyc) / cyc, y = 5.5 * (1 - t) + 0.05;
        const sway = Math.sin((time + dph[i]) * 1.9) * 0.6;
        rot.makeRotationFromEuler(e.set(sway, (time + dph[i]) * 1.3, sway * 0.6));
        scl.makeScale(t > 0.96 ? (1 - t) * 25 : 1, 1, t > 0.96 ? (1 - t) * 25 : 1);
        m4.multiplyMatrices(rot, scl).setPosition(dx0[i] + Math.sin((time + dph[i]) * 0.7) * 0.9, y, dz0[i] + Math.cos((time + dph[i]) * 0.5) * 0.9);
        drift.setMatrixAt(i, m4);
      }
      drift.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < BIRDS; i++) {
        const a = bp[i] + time * bs[i], x = bx[i] + Math.cos(a) * br[i], z = bz[i] + Math.sin(a) * br[i];
        m4.makeRotationY(-a).setPosition(x, bh[i] + Math.sin(time * 1.3 + i) * 0.6, z);
        flock.setMatrixAt(i, m4);
      }
      flock.instanceMatrix.needsUpdate = true;
      if (smoke) {
        for (let s = 0, k = 0; s < smokeFrom.length; s++) {
          const f = smokeFrom[s];
          for (let p = 0; p < PUFFS; p++, k++) {
            const t = ((time * 0.11 + p / PUFFS) % 1), sz = f.big * (0.35 + t * 1.3) * (t > 0.8 ? (1 - t) * 5 : 1);
            m4.makeScale(sz, sz * 0.8, sz).setPosition(f.x + Math.sin(t * 5 + p) * 0.4 * f.big + t * 2.2 * f.big, f.y + t * 9 * f.big, f.z - t * 1.2 * f.big);
            smoke.setMatrixAt(k, m4);
          }
        }
        smoke.instanceMatrix.needsUpdate = true;
      }
    };
    update(0);
    for (const g of temp) g.dispose();
    return { update, solids, brooks: brooks.map((b) => ({ ...b.cross, bridge: b.bridge, pts: b.pts })) };
  };

  return { paint, build };
}
