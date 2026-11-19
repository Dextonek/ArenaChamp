import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING, seeded } from '../../arenas/common';
import { grassStands, type Dress, type Geo, type Key, type LandSpec } from './land';
import { buildSeaScenes } from './scenes/sea';
import { distanceTo, roadNet, roadside, type Pt } from './roads';

/**
 * The world's depth on a sea floor (the user, 2026-11-14: "add depth into the worlds, make all the background fit there, all the roads
 * and zones, make them look like they fit there, don't be shy"). Looks only, never cover: nothing here stops a walk or a shot, and it
 * keeps off the cover, the tidal flats, the roads' middles and the places' stands.
 *
 * - Roads: lantern posts and kerb stones along them, fence runs on the verge, a signpost where a road meets a place, grass on the verges.
 * - Meadows: tufts of grass, flowers in clumps, pebbles.
 * - Places, dressed as what they are: nets and racks at a market, gardens, a well and washing lines in a village, planks and rope at a
 *   wreck, firewood at a beacon, graves at a chapel, banners at a fort, torches at the caves, heaps at the salt pans, a camp's logs.
 * - The far sea: islands, one with its own small light; seabirds wheeling over the water.
 *
 * Merged into the land's dressing (one mesh a square of ground) or instanced (the grass, the flowers): a few draw calls in all.
 */

type Seg = { ax: number; az: number; bx: number; bz: number; r: number };
export interface DepthIn {
  spec: LandSpec;
  geo: Geo;
  dress: Dress;
  into: THREE.Group;
  own: { dispose(): void }[];
  rnd: () => number;
  /** The zone's cover in world coordinates. */
  cover: Seg[];
  /** The land's painted middle (a canvas `L` m across), where the scenes paint their trodden ground (scenes/sea.ts). */
  ground?: { map: THREE.Texture; L: number };
  /** The land's houses and jetties (offsets from the middle) and boats (world), for the scenes to keep off. */
  taken?: { x: number; z: number; r: number; tree?: boolean }[];
}

const segDist = (px: number, pz: number, s: Seg) => {
  const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - s.ax) * ex + (pz - s.az) * ez) / l2)) : 0;
  return Math.hypot(px - (s.ax + ex * t), pz - (s.az + ez * t));
};

export function buildDepth(o: DepthIn) {
  const { spec, geo, rnd } = o;
  // Where the depth puts its props, for the scenes to keep off (scenes/sea.ts); the dressing itself is unchanged.
  const marks: { x: number; z: number; r: number }[] = [];
  interface Rec { add(key: Key, g: THREE.BufferGeometry, x: number, y: number, z: number, yaw?: number, sx?: number, sy?: number, sz?: number, tilt?: number): Rec; mute: boolean; /** No mark for the scenes (the roads' kerbs and rails: on the road's edge, which the scenes keep off anyway). */ nomark?: boolean }
  const dress: Rec = {
    /** A prop planned where it must not be drawn (on a floor's spot, inside a harbour-file prop): planned as before, not drawn. */
    mute: false,
    add(key, g, x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0) {
      if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox!, ox = (b.min.x + b.max.x) / 2, oz = (b.min.z + b.max.z) / 2;
      // a muted prop keeps its mark: the scenes keep off the same ground as before, so none of them moves
      if (!dress.nomark) marks.push({ x, z, r: Math.min(Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2 * Math.max(sx, sz) + Math.hypot(ox, oz) * Math.max(sx, sz), 30) });
      if (!dress.mute) o.dress.add(key, g, x, y, z, yaw, sx, sy, sz, tilt);
      return dress;
    },
  };
  /**
   * Is (x, z) too near a floor's spot (a person, a cache, a waystone, a door, a quest step: `spec.keep`) or inside one of the harbour
   * file's props (`spec.sceneTaken`, drawn later by the zone) for a prop reaching `r` m? Such a prop is muted, not moved: the random stream
   * and every other prop stay as they were (the props pass, 2026-11-14: a signpost through a waystone, a fish rack inside a pile of chests).
   */
  const blocked = (x: number, z: number, r: number) =>
    (spec.keep ?? []).some((k) => Math.hypot(k.x - x, k.z - z) < r + 0.5) || (spec.sceneTaken ?? []).some((t) => Math.hypot(t.x - x, t.z - z) < t.r - 0.6 + r);
  const glows: { x: number; y: number; z: number; size?: number }[] = [];
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (r0: number, r1: number, h: number, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  // the roads as world segments
  const roads: { ax: number; az: number; bx: number; bz: number }[] = [];
  for (const p of spec.paths) for (let i = 1; i < p.length; i++) roads.push({ ax: RING.x + p[i - 1][0], az: RING.z + p[i - 1][1], bx: RING.x + p[i][0], bz: RING.z + p[i][1] });
  // the clean network as drawn (roads.ts): its bends leave the legs above by up to about a metre and a half, so a look keeps off both
  const net = roadNet(spec.paths).map((p) => p.map(([dx, dz]) => [RING.x + dx, RING.z + dz] as Pt));
  const nearNet = distanceTo(net);
  // (the curve is never more than about 1.5 m from the legs, and no check here asks for more than 3.5 m: past 5 m the legs decide)
  const nearRoad = (x: number, z: number) => { const d = roads.reduce((m, s) => Math.min(m, segDist(x, z, { ...s, r: 0 })), 1e9); return d > 5 ? d : Math.min(d, nearNet(x, z)); };
  const inFlat = (x: number, z: number, pad = 0) => spec.flats.some((f) => Math.hypot((x - f.x) / (f.rx + pad), (z - f.z) / (f.rz + pad)) < 1.1);
  const onCover = (x: number, z: number, pad: number) => o.cover.some((c) => segDist(x, z, c) < c.r + pad);
  const inPlace = (x: number, z: number, pad: number) => spec.places.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);
  /** Free ground for a look: walkable side of the outline by `inside` m, off cover, off flats, off the roads' middles. */
  const free = (x: number, z: number, pad: number, o2: { road?: number; place?: number; inside?: number } = {}) => {
    const dx = x - RING.x, dz = z - RING.z;
    if (geo.beyond(dx, dz) > -(o2.inside ?? 1)) return false;
    if (onCover(x, z, pad) || inFlat(x, z, 1)) return false;
    if (nearRoad(x, z) < (o2.road ?? 2.2) + pad) return false;
    if (o2.place !== undefined && inPlace(x, z, o2.place)) return false;
    return true;
  };

  // --- the roads, as they were drawn until 2026-11-19: now a DRY pass that draws nothing ----------------------------------------------
  // It still makes every draw from the floor's random stream that it made, so the places' props, the meadows, the islands and the scenes
  // after it stay exactly where they were. The roads' props are drawn by `roadside` below, along the clean network (roads.ts).
  const DRY: Rec = { mute: false, add: () => DRY };
  { const dress = DRY, glows: { x: number; y: number; z: number; size?: number }[] = [];
  for (const p of spec.paths) {
    let fence = rnd() < 0.35, fenceLeft = 0, side = rnd() < 0.5 ? 1 : -1, sinceLamp = rnd() * 6;
    for (let i = 1; i < p.length; i++) {
      const ax = RING.x + p[i - 1][0], az = RING.z + p[i - 1][1], bx = RING.x + p[i][0], bz = RING.z + p[i][1];
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, yaw = Math.atan2(ux, uz);
      for (let s = 1.5; s < L - 1.5; s += 1.1) {
        const cx = ax + ux * s, cz = az + uz * s;
        sinceLamp += 1.1;
        if (sinceLamp > 13 + rnd() * 5) {
          sinceLamp = 0;
          side = -side;
          const x = cx + nx * side * 2.9, z = cz + nz * side * 2.9;
          if (free(x, z, 0.5, { road: 2.4, place: 1 })) {
            if (rnd() < 0.6) {
              // the arm reaches out over the lantern (it hangs on the -n side of its post)
              dress.mute = blocked(x, z, 0.7);
              dress.add('wood', cyl(0.09, 0.12, 2.5, 6), x, 0, z).add('wood', box(0.08, 0.08, 0.7).translate(0, 0, 0.3), x, 2.4, z, yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2));
              dress.add('lacquer', box(0.26, 0.34, 0.26), x - nx * side * 0.6, 2.05, z - nz * side * 0.6).add('gold', box(0.3, 0.05, 0.3), x - nx * side * 0.6, 2.38, z - nz * side * 0.6);
              if (!dress.mute) glows.push({ x: x - nx * side * 0.6, y: 2.2, z: z - nz * side * 0.6, size: 1.1 });
              dress.mute = false;
            } else {
              dress.add('capstone', box(0.55, 0.32, 0.4), x, 0, z, yaw + rnd() * 0.3).add('stone', box(0.45, 0.26, 0.38), x + ux * 0.8, 0, z + uz * 0.8, yaw - rnd() * 0.3);
            }
          }
        }
        // a fence along the verge, for a run, on the outer side
        if (fence && fenceLeft <= 0 && rnd() < 0.05) fenceLeft = 9 + rnd() * 14;
        if (fenceLeft > 0) {
          fenceLeft -= 1.1;
          const x = cx + nx * side * 3.3, z = cz + nz * side * 3.3;
          if (free(x, z, 0.3, { road: 2.6, place: 1 }) && Math.round(s / 1.1) % 2 === 0) {
            dress.add('wood', box(0.12, 1.0, 0.12), x, 0, z).add('plank', box(0.06, 0.08, 2.3), x, 0.55, z, yaw).add('plank', box(0.06, 0.08, 2.3), x, 0.85, z, yaw);
          }
        }
      }
      if (i === p.length - 1) fence = rnd() < 0.35;
    }
    // a signpost where the road meets a place
    for (const end of [p[0], p[p.length - 1]]) {
      const ex = RING.x + end[0], ez = RING.z + end[1];
      const place = spec.places.find((q) => Math.hypot(q.x - ex, q.z - ez) < q.r + 2.5);
      if (!place || place.kind === 'camp' && rnd() < 0.5) continue;
      const a = Math.atan2(ex - place.x, ez - place.z), x = ex + Math.cos(a) * 2.6, z = ez - Math.sin(a) * 2.6;
      if (!free(x, z, 0.4, { road: 1.6 })) continue;
      dress.mute = blocked(x, z, 0.5);
      dress.add('wood', cyl(0.08, 0.1, 2.3, 6), x, 0, z).add('plank', box(0.9, 0.22, 0.06).translate(0.35, 0, 0), x, 1.85, z, a + 1.2).add('plank', box(0.8, 0.2, 0.06).translate(0.3, 0, 0), x, 1.55, z, a - 0.9);
      dress.add('gold', box(0.18, 0.05, 0.18), x, 2.3, z);
      dress.mute = false;
    }
  }
  void glows; }

  // --- the places, dressed as what they are -------------------------------------------------------------------------------------------
  const ring = (p: { x: number; z: number; r: number }, n: number, from: number, to: number, make: (x: number, z: number, a: number) => void, pad = 0.8, reach = 0.5) => {
    for (let k = 0, made = 0; k < n * 12 && made < n; k++) {
      const a = rnd() * Math.PI * 2, d = from + rnd() * (to - from), x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      if (!free(x, z, pad, { road: 2.4 })) continue;
      dress.mute = blocked(x, z, reach) // `reach`: how far the prop itself reaches from (x, z);
      make(x, z, a);
      dress.mute = false;
      made++;
    }
  };
  for (const p of spec.places) {
    const r = p.r;
    switch (p.kind) {
      case 'market':
        ring(p, 3, r - 1, r + 4, (x, z, a) => { // a net hung between two poles
          dress.add('wood', cyl(0.07, 0.08, 2.4, 5), x - Math.cos(a) * 1.2, 0, z + Math.sin(a) * 1.2).add('wood', cyl(0.07, 0.08, 2.4, 5), x + Math.cos(a) * 1.2, 0, z - Math.sin(a) * 1.2);
          dress.add('rope', box(2.4, 1.3, 0.04), x, 0.9, z, a); // along the line of its poles
        }, 0.8, 1.3); // the net and its poles
        ring(p, 4, r - 2, r + 3, (x, z, a) => dress.add('wood', cyl(0.32, 0.26, 0.35, 9), x, 0, z).add('salt', cyl(0.28, 0.28, 0.06, 9), x, 0.3, z, a)); // baskets of the catch
        ring(p, 2, r, r + 4, (x, z, a) => { // a drying rack of fish
          for (const s of [-1, 1]) dress.add('wood', box(0.08, 1.4, 0.08), x + Math.cos(a) * s, 0, z - Math.sin(a) * s);
          dress.add('plank', box(2.2, 0.06, 0.06), x, 1.35, z, a); // from post to post
          for (let f = -0.8; f <= 0.81; f += 0.4) dress.add('slate', box(0.08, 0.5, 0.18), x + Math.cos(a) * f, 0.85, z - Math.sin(a) * f, a); // hung from the bar
        }, 0.8, 1.1);
        break;
      case 'village':
        ring(p, 3, r + 1, r + 7, (x, z, a) => { // a garden: a low fence and rows
          for (const [fx, fz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) dress.add('wood', box(0.08, 0.6, 0.08), x + fx, 0, z + fz);
          dress.add('plank', box(3.3, 0.06, 0.06), x, 0.45, z - 1.2).add('plank', box(3.3, 0.06, 0.06), x, 0.45, z + 1.2);
          for (const row of [-0.6, 0, 0.6]) dress.add('leaf', box(2.6, 0.28, 0.3), x, 0, z + row);
        }, 2, 1.8);
        ring(p, 1, r + 1, r + 5, (x, z) => { // the well
          dress.add('stone', cyl(0.8, 0.85, 0.8, 12), x, 0, z).add('lacquer', cyl(0.62, 0.62, 0.74, 12), x, 0, z); // the water below the rim
          for (const s of [-1, 1]) dress.add('wood', box(0.1, 1.9, 0.1), x + s * 0.7, 0, z);
          dress.add('wine', box(1.8, 0.1, 1.0), x, 1.9, z).add('gold', box(1.84, 0.04, 0.06), x, 1.97, z); // the roof on its posts
        }, 1.6, 0.9);
        ring(p, 2, r + 0.5, r + 5, (x, z, a) => { // washing on a line
          for (const s of [-1, 1]) dress.add('wood', box(0.08, 2, 0.08), x + Math.cos(a) * 2 * s, 0, z - Math.sin(a) * 2 * s);
          dress.add('rope', box(4, 0.02, 0.02), x, 1.9, z, a); // from post to post
          for (const f of [-1.2, -0.3, 0.6, 1.4]) dress.add(rnd() < 0.5 ? 'cloth' : 'cream', box(0.55, 0.7, 0.02).translate(0, -0.35, 0), x + Math.cos(a) * f, 1.9, z - Math.sin(a) * f, a);
        }, 0.8, 2.0);
        break;
      case 'wreck': case 'shipyard':
        ring(p, 7, r - 1, r + 6, (x, z) => dress.add('plank', box(0.35, 0.08, 1.6 + rnd() * 1.6), x, 0.02, z, rnd() * 6.28, 1, 1, 1, (rnd() - 0.5) * 0.2), 0.4, 1.4);
        ring(p, 3, r - 1, r + 5, (x, z) => dress.add('rope', new THREE.TorusGeometry(0.32, 0.08, 6, 14).rotateX(Math.PI / 2).translate(0, 0.08, 0), x, 0, z), 0.4);
        break;
      case 'beacon':
        ring(p, 3, r - 2, r + 3, (x, z, a) => { for (let k = 0; k < 5; k++) dress.add('wood', cyl(0.12, 0.12, 1.4, 6).rotateZ(Math.PI / 2).translate(0, 0.12 + (k % 3) * 0.22, 0), x, 0, z + (k - 2) * 0.12, a); });
        break;
      case 'chapel':
        ring(p, 6, r + 1, r + 7, (x, z, a) => dress.add('stone', box(0.6, 0.85, 0.16), x, 0, z, a).add('capstone', box(0.66, 0.08, 0.2), x, 0.85, z, a), 0.6);
        ring(p, 2, r - 1, r + 3, (x, z, a) => dress.add('wood', box(1.6, 0.42, 0.4), x, 0, z, a), 0.8, 0.8);
        break;
      case 'fort':
        ring(p, 3, r - 1, r + 3, (x, z, a) => {
          dress.add('wood', cyl(0.07, 0.08, 3.6, 6), x, 0, z).add('gold', box(0.16, 0.06, 0.16), x, 3.6, z);
          dress.add('wine', box(0.04, 1.1, 0.7).translate(0, -0.55, 0.36), x, 3.4, z, a);
        });
        break;
      case 'caves':
        ring(p, 2, r - 2, r + 1, (x, z) => {
          dress.add('wood', cyl(0.06, 0.08, 1.9, 6), x, 0, z).add('gold', cyl(0.12, 0.08, 0.18, 6), x, 1.9, z);
          if (!dress.mute) glows.push({ x, y: 2.15, z, size: 1.6 });
        }, 0.6);
        ring(p, 6, r, r + 6, (x, z) => dress.add('boulder', new THREE.IcosahedronGeometry(0.4 + rnd() * 0.5, 0), x, 0.1, z, rnd() * 6), 0.4);
        break;
      case 'saltworks':
        ring(p, 4, r - 1, r + 4, (x, z) => dress.add('salt', new THREE.ConeGeometry(0.7 + rnd() * 0.4, 0.8 + rnd() * 0.4, 9).translate(0, 0.4, 0), x, 0, z), 0.6);
        break;
      case 'camp':
        ring(p, 3, 3.5, r, (x, z, a) => dress.add('wood', cyl(0.22, 0.22, 1.6, 8).rotateZ(Math.PI / 2).translate(0, 0.22, 0), x, 0, z, a), 0.4); // logs to sit on
        ring(p, 2, 3, r - 1, (x, z, a) => dress.add('wine', box(0.7, 0.14, 1.8), x, 0, z, a), 0.4); // bedrolls
        break;
    }
  }

  // --- meadows: grass, flowers, pebbles (instanced, no shadows) ---------------------------------------------------------------------
  const tuft: THREE.Matrix4[] = [], flower: THREE.Matrix4[] = [], pebble: THREE.Matrix4[] = [];
  const rim = spec.rim, rmax = Math.max(...rim), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const put = (list: THREE.Matrix4[], x: number, y: number, z: number, s: number, sy = s) => list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, rnd() * 6.28).clone(), new THREE.Vector3(s, sy, s)));
  const area = 0.5 * Math.sin((Math.PI * 2) / rim.length) * rim.reduce((s, r, i) => s + r * rim[(i + 1) % rim.length], 0);
  const tufts = Math.round(area / 9), clumps = Math.round(area / 260);
  for (let k = 0; k < tufts * 3 && tuft.length < tufts; k++) {
    const dx = (rnd() - 0.5) * 2 * rmax, dz = (rnd() - 0.5) * 2 * rmax, x = RING.x + dx, z = RING.z + dz;
    if (geo.beach(dx, dz) > 0.25 || !free(x, z, 0.3, { road: 1.9, place: 0.5, inside: 0.5 })) continue;
    put(tuft, x, 0, z, 0.7 + rnd() * 0.6, 0.6 + rnd() * 0.7);
  }
  for (let k = 0; k < clumps * 4 && flower.length < clumps * 9; k++) {
    const dx = (rnd() - 0.5) * 2 * rmax, dz = (rnd() - 0.5) * 2 * rmax, cx = RING.x + dx, cz = RING.z + dz;
    if (geo.beach(dx, dz) > 0.2 || !free(cx, cz, 0.6, { road: 2.4, place: 1, inside: 1 })) continue;
    for (let f = 0; f < 9; f++) {
      const x = cx + (rnd() - 0.5) * 2.4, z = cz + (rnd() - 0.5) * 2.4;
      if (free(x, z, 0.2, { road: 2, inside: 0.5 })) put(flower, x, 0.18, z, 0.7 + rnd() * 0.6);
    }
  }
  for (let k = 0; k < area / 50 && pebble.length < area / 90; k++) {
    const dx = (rnd() - 0.5) * 2 * rmax, dz = (rnd() - 0.5) * 2 * rmax, x = RING.x + dx, z = RING.z + dz;
    if (!free(x, z, 0.2, { road: 1.4, inside: 0.5 })) continue;
    put(pebble, x, 0.03, z, 0.12 + rnd() * 0.18, 0.08 + rnd() * 0.1);
  }
  // --- the roads' sides (2026-11-19, the user: "lets make road more cleanly and like put them into scenario") ---------------------------
  // Planned along the clean network by roads.ts `roadside` (kerbs into the places, lanterns from side to side, fences on the bends,
  // grass on the verges, signposts, milestones), on a random stream of its own (everything above keeps its draw); drawn here in the
  // Sea's look. Nothing on a floor's spot (muted, as the props above), on cover, in the tide's flats, past the outline or on a road.
  {
    const tq = new THREE.Quaternion(), kerb = box(0.42, 0.14, 0.3), rail = box(0.06, 0.08, 1), post = box(0.12, 1.0, 0.12);
    o.own.push(kerb, rail, post);
    roadside(net, {
      rnd: seeded(4242 + (spec.seed ?? 0)),
      places: spec.places,
      ok: (x, z, pad, road, place) => geo.beyond(x - RING.x, z - RING.z) <= -1 && !onCover(x, z, pad) && !inFlat(x, z, 1) && nearNet(x, z) >= road && !(place !== undefined && inPlace(x, z, place)),
      blocked,
      kerb: (x, z, yaw, u, sy, muted) => {
        dress.mute = muted; dress.nomark = true;
        dress.add(u < 0.5 ? 'capstone' : 'stone', kerb, x, 0, z, yaw, 1, sy, 1);
        dress.mute = false; dress.nomark = false;
      },
      lantern: (x, z, nx, nz, side, yaw, muted) => {
        dress.mute = muted;
        dress.add('wood', cyl(0.09, 0.12, 2.5, 6), x, 0, z).add('wood', box(0.08, 0.08, 0.7).translate(0, 0, 0.3), x, 2.4, z, yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2));
        dress.add('lacquer', box(0.26, 0.34, 0.26), x - nx * side * 0.6, 2.05, z - nz * side * 0.6).add('gold', box(0.3, 0.05, 0.3), x - nx * side * 0.6, 2.38, z - nz * side * 0.6);
        if (!muted) glows.push({ x: x - nx * side * 0.6, y: 2.2, z: z - nz * side * 0.6, size: 1.1 });
        dress.mute = false;
      },
      post: (x, z, yaw) => { dress.add('wood', post, x, 0, z, yaw); },
      rail: (mx, mz, yaw, len) => {
        dress.nomark = true;
        dress.add('plank', rail, mx, 0.5, mz, yaw, 1, 1, len).add('plank', rail, mx, 0.82, mz, yaw, 1, 1, len);
        dress.nomark = false;
      },
      vergeOk: (x, z) => geo.beach(x - RING.x, z - RING.z) <= 0.25,
      verge: (x, z, sc, turn, sy) => { tuft.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), tq.setFromAxisAngle(up, turn).clone(), new THREE.Vector3(sc, sy, sc))); },
      signpost: (x, z, a, muted) => {
        dress.mute = muted;
        dress.add('wood', cyl(0.08, 0.1, 2.3, 6), x, 0, z).add('plank', box(0.9, 0.22, 0.06).translate(0.35, 0, 0), x, 1.85, z, a + 1.2).add('plank', box(0.8, 0.2, 0.06).translate(0.3, 0, 0), x, 1.55, z, a - 0.9);
        dress.add('gold', box(0.18, 0.05, 0.18), x, 2.3, z);
        dress.mute = false;
      },
      milestone: (x, z, yaw, muted) => {
        dress.mute = muted;
        dress.add('capstone', box(0.4, 0.75, 0.3), x, 0, z, yaw).add('stone', box(0.5, 0.12, 0.4), x, 0, z, yaw);
        dress.mute = false;
      },
    });
  }
  const tint = (g: THREE.BufferGeometry, hex: string) => {
    const nn = g.index ? g.toNonIndexed() : g, col = new THREE.Color(hex), c = new Float32Array(nn.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
    for (const k of Object.keys(nn.attributes)) if (k !== 'position' && k !== 'normal') nn.deleteAttribute(k);
    nn.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return nn;
  };
  // a tuft: three blades leaning out; a flower: a stem and a head in one of three colours (one geometry a colour)
  const blade = (a: number, h: number) => new THREE.ConeGeometry(0.07, h, 3).translate(0, h / 2, 0).rotateZ(0.25).rotateY(a);
  const tuftGeo = mergeGeometries([tint(blade(0, 0.55), '#55703c'), tint(blade(2.1, 0.45), '#4a6636'), tint(blade(4.2, 0.6), '#5e7a42')])!;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  o.own.push(mat);
  const inst = (geom: THREE.BufferGeometry, list: THREE.Matrix4[]) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geom, mat, list.length);
    list.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.instanceMatrix.needsUpdate = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    o.into.add(im);
    o.own.push(geom);
  };
  inst(tuftGeo, tuft.filter((mm) => grassStands(geo.height, mm.elements[12] - RING.x, mm.elements[14] - RING.z))); // grass only where the ground as drawn is gentle
  const heads = ['#e6dfcc', '#d8b84a', '#9a3448'];
  heads.forEach((hex, i) => inst(mergeGeometries([tint(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 3).translate(0, -0.06, 0), '#4a6638'), tint(new THREE.IcosahedronGeometry(0.07, 0).translate(0, 0.14, 0), hex)])!, flower.filter((_, k) => k % 3 === i)));
  inst(tint(new THREE.IcosahedronGeometry(1, 0), '#6a6662'), pebble);

  // --- the far sea: islands, one with a light; seabirds wheeling ---------------------------------------------------------------------
  const seaDir = geo.m === 1 ? 0 : Math.PI; // the sea's side
  for (let k = 0; k < 4; k++) {
    const a = seaDir + (rnd() - 0.5) * 1.6, d = rmax + 70 + rnd() * 110, x = RING.x + Math.cos(a) * d, z = RING.z + Math.sin(a) * d;
    if (geo.sea(x - RING.x, z - RING.z) < 0.9) continue;
    const s = 10 + rnd() * 16;
    dress.add('rock', new THREE.IcosahedronGeometry(1, 1).scale(s, s * 0.32, s * 0.8), x, -1.2, z, rnd() * 6);
    const ly = rnd() * 6;
    dress.add('leaf', new THREE.IcosahedronGeometry(1, 1).scale(s * 0.82, s * 0.2, s * 0.62), x, s * 0.08, z, ly);
    for (let t = 0; t < 5; t++) {
      // each tree on the island's green where it stands (all were at one height: sunk in its middle, in the air at its edge)
      const ox = (rnd() - 0.5) * s, oz = (rnd() - 0.5) * s * 0.6, u = Math.cos(ly) * ox - Math.sin(ly) * oz, w = Math.sin(ly) * ox + Math.cos(ly) * oz;
      const top = s * 0.08 + s * 0.2 * 0.92 * Math.sqrt(Math.max(0, 1 - (u / (s * 0.82)) ** 2 - (w / (s * 0.62)) ** 2));
      dress.add('leaf', new THREE.ConeGeometry(1.4, 4.5, 7).translate(0, 2.2, 0), x + ox, top - 0.25, z + oz);
    }
    if (k === 0) {
      dress.add('cream', cyl(1.1, 1.5, 7, 10), x, s * 0.2, z).add('wine', cyl(1.0, 1.1, 1.2, 10), x, s * 0.2 + 7, z).add('gold', cyl(1.3, 1.3, 0.15, 10), x, s * 0.2 + 8.3, z);
      glows.push({ x, y: s * 0.2 + 8.8, z, size: 6 });
    }
  }
  // seabirds: a few white V's wheeling over the water (one instanced mesh, turned each frame)
  const birds = new THREE.Group(), birdGeo = mergeGeometries([new THREE.BoxGeometry(0.9, 0.04, 0.16).translate(0.42, 0, 0).rotateZ(0.25), new THREE.BoxGeometry(0.9, 0.04, 0.16).translate(-0.42, 0, 0).rotateZ(-0.25)])!;
  const birdMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ee });
  o.own.push(birdGeo, birdMat);
  const flock = new THREE.InstancedMesh(birdGeo, birdMat, 9), m4 = new THREE.Matrix4();
  const flyers = Array.from({ length: 9 }, () => ({ r: 8 + rnd() * 14, h: 12 + rnd() * 10, sp: 0.25 + rnd() * 0.25, ph: rnd() * 6.28 }));
  const centre = { x: RING.x + Math.cos(seaDir) * (rmax + 25), z: RING.z + Math.sin(seaDir) * (rmax * 0.2) };
  flock.frustumCulled = false;
  birds.add(flock);
  o.into.add(birds);
  const fly = (time: number) => {
    flyers.forEach((b, i) => {
      const a = b.ph + time * b.sp, x = centre.x + Math.cos(a) * b.r, z = centre.z + Math.sin(a) * b.r;
      m4.makeRotationY(-a).setPosition(x, b.h + Math.sin(time * 1.3 + i) * 0.6, z);
      flock.setMatrixAt(i, m4);
    });
    flock.instanceMatrix.needsUpdate = true;
  };
  fly(0);

  // --- scenes: little stories told in props (scenes/sea.ts), their own random stream ---------------------------------------------------
  const scenes = buildSeaScenes({ spec, geo, dress: o.dress, cover: spec.sceneCover ?? o.cover, marks, taken: o.taken ?? [], ground: o.ground });
  o.into.userData.seaScenes = scenes;
  o.into.userData.depthMarks = marks; // for the probe (pipeline/tools/scenes-probe.js)

  return { glows, update: fly };
}
