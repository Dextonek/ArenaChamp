import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import type { Obstacle } from '../obstacles';
import { RING, canvasTexture, seeded } from './common';
import layout from './real/sunburst.json';
import { Glows, realProps, type RealLayout } from './real';
import { HEART_STAGE } from './sunkenHeart';
import type { ArenaDef } from './types';

/**
 * The Sunburst: the Heart of Noon's boss room for a party of up to 40 (user, 2026-11-11: "what if the arena is not like a round
 * arena, let's just forget all and let's make boss room"). The place under the hall where the sun fell: a crater in the shape of the
 * sun itself. A round well (18 m to its rim) with the Heart over its middle, and eight rays, bays 11.6 m wide cut straight out to
 * 34 m, one every 45 degrees. The party comes in at the gate at the end of the south ray; the way out is the alcove at the end of the
 * north one, under the keepers' sun sign. Built in blender/arenas/real/sunburst.py (clean forms, the heroes' materials and one burnt
 * red of its own, gold on the edges, lantern light as the only glow), which also writes the obstacle list (`real/sunburst.json`).
 *
 * Why a sun: everything the Heart does runs outward from the middle. Every ray is a straight lane from the Heart to an end wall, so
 * its rings, beams and rays run the whole length of each, and no wall ever stands between the Heart and a hero. The stone between
 * two rays (a spur) splits the party into bays that don't see each other, and a crust plate falls in front of each spur's nose.
 *
 * The game's floor is still a ring (`ring`, 35 m: the hub and the walk both keep heroes inside it); the room's shape is made by its
 * own walls, obstacles that never break (`Obstacle.fixed`). The stone is 1.3 m high on the camera's side, so the camera looks over
 * it, and 6.5 to 13 m to the north; a zone drawn wider than the floor is hidden inside it. Built here: the floor (the crust of the
 * room for two, carried on out along the rays), the lanterns' glow, the far wall of the cavern and the gold motes.
 */
const LAYOUT = layout as RealLayout;
export const BURST_OBSTACLES: Obstacle[] = LAYOUT.obstacles;
/** How far the room reaches from the Heart (m): the far corners of its rays. */
export const BURST_R = RAID_BOSSES.heart.partyRing ?? 35;
/** The sun, as in sunburst.py: how many rays, the well's radius, half a ray's width, how far a ray reaches, and how far out the fallen armillary's pieces lie. */
export const BURST = { rays: 8, well: 18, half: 5.8, len: 34, arcAt: 22.5 };
/**
 * Where the floor's rings of plates meet, from the Heart out (m), the ones Hold Still's light lands on: four of the old floor's, the
 * well's rim, and two across the rays.
 */
export const BURST_JOINTS = [2.2, 5.2, 8.6, 12, 18, 26, 34];
/** Every joint the floor draws. */
const JOINTS = [2.2, 3.6, 5.2, 6.9, 8.6, 10.3, 12, 15, 18, 22, 26, 30, 34];
const GATE = 3.2, ALCOVE = 41;
/** The floor's drawing covers this far each way from the Heart (m). */
const SPAN = 44;

/** Ray `k`'s angle from the south (radians, toward the east): ray 0 is the way in. */
export const rayAngle = (k: number) => (k * Math.PI * 2) / BURST.rays;
/** The angle of the spur after ray `k` (between rays k and k + 1). */
export const spurAngle = (k: number) => ((k + 0.5) * Math.PI * 2) / BURST.rays;
/** A spot `along` ray `k` from the Heart and `lat` across it (toward ray k + 1). */
export function burstAt(k: number, along: number, lat = 0) {
  const a = rayAngle(k);
  return { x: RING.x + Math.sin(a) * along + Math.cos(a) * lat, z: RING.z + Math.cos(a) * along - Math.sin(a) * lat };
}

/**
 * The floor turns (user, 2026-11-12: "when there will be second stage the arena will transform"): in the Heart's second phase the
 * well is three rings round it. The inner one stands (to `inner` m), the middle one turns one way (to `mid`), the outer one the
 * other (to the well's rim), each carrying whoever stands on it. Drawn as three pieces of the one floor, so the drawing turns with
 * its ring, with a gold seam between them and gold arrowheads that point the way each goes.
 */
export const BURST_RINGS = { inner: 6.9, mid: 12, outer: BURST.well };
/**
 * The crust falls (the same request, the last phase): the floor is eight sectors, one to a ray, and a sector drops into the sun for
 * good. A sector is its ray's bay and its slice of the well, from the inner ring out: a wedge `wedge` radians to each side of the
 * ray's line, and from `bay` m along it the whole width of the bay. What never falls: the inner ring, and a spoke of crust from it
 * to each spur's nose (where a plate falls), which is what is left between two sectors.
 */
export const BURST_SECTOR = { from: BURST_RINGS.inner, wedge: THREE.MathUtils.degToRad(15.5), bay: 17.3 };
const SECTOR_TAN = Math.tan(BURST_SECTOR.wedge);
/** How far along its ray a sector reaches: to the end wall, and the south one through the gate's passage. */
const sectorEnd = (k: number) => (k === 0 ? SPAN + 2 : BURST.len + 0.7);

/** Whether (x, z) lies in sector `k`, fallen or not. */
export function inSector(k: number, x: number, z: number) {
  const a = rayAngle(k), dx = x - RING.x, dz = z - RING.z;
  const along = dx * Math.sin(a) + dz * Math.cos(a);
  if (along <= 0 || along > sectorEnd(k) || dx * dx + dz * dz < BURST_SECTOR.from * BURST_SECTOR.from) return false;
  return Math.abs(dx * Math.cos(a) - dz * Math.sin(a)) <= (along >= BURST_SECTOR.bay ? BURST.half + 0.7 : along * SECTOR_TAN);
}

/** What shows the room now (the last one built). */
interface BurstShow {
  sync(): void;
  fall(k: number, instant: boolean): void;
  reset(): void;
}
let show: BurstShow | null = null;
const floor = { mid: 0, out: 0, lit: 0, sense: 1, crack: [0, 0, 0, 0, 0, 0, 0, 0], gone: [0, 0, 0, 0, 0, 0, 0, 0] };

/**
 * The room's own state: how far its two rings have turned, which sectors glow and which are gone. Only the Heart's casts change it
 * (src/raid/heart.ts), at times counted from them, so every screen has the same room at the same moment of the fight; `reset`
 * before each fight (`BossDef.resize`).
 */
export const burstFloor = {
  /** How far the middle and the outer ring have turned (radians, toward the east from the south). */
  get mid() { return floor.mid; },
  get out() { return floor.out; },
  /** A new fight: the floor is whole and still. */
  reset() {
    Object.assign(floor, { mid: 0, out: 0, lit: 0, sense: 1 });
    floor.crack.fill(0);
    floor.gone.fill(0);
    show?.reset();
  },
  /** The rings stand at these angles; `lit`: how bright the seams and the arrowheads are, 0..1; `sense`: which way the middle one goes (1 or -1). */
  turn(mid: number, out: number, lit: number, sense: number) {
    Object.assign(floor, { mid, out, lit, sense });
    show?.sync();
  },
  /** Sector `k` glows along its cracks, 0 (not) to 1 (about to go). */
  crack(k: number, amount: number) {
    if (floor.gone[k]) return;
    floor.crack[k] = amount;
    show?.sync();
  },
  /** Sector `k` drops into the sun, for good. `instant`: no fall to watch. */
  fall(k: number, instant = false) {
    if (floor.gone[k] || !(k >= 0 && k < BURST.rays)) return;
    floor.gone[k] = 1;
    floor.crack[k] = 0;
    show?.fall(k, instant);
    show?.sync();
  },
  /** The fight is over: what fell crusts over, dark, and can be walked on. */
  cool() {
    for (let k = 0; k < BURST.rays; k++) if (floor.gone[k]) floor.gone[k] = 2;
    show?.sync();
  },
  /** How far sector `k` glows along its cracks, 0..1. */
  cracked: (k: number) => floor.crack[k],
  /** Whether sector `k` has fallen. */
  gone: (k: number) => floor.gone[k] === 1,
  /** How many have. */
  get fallen() { return floor.gone.filter((g) => g === 1).length; },
  /** Whether (x, z) is over the sun: in a sector that has fallen. */
  lost(x: number, z: number) {
    for (let k = 0; k < BURST.rays; k++) if (floor.gone[k] === 1 && inSector(k, x, z)) return true;
    return false;
  },
};

/** (x, z) turned by `angle` round the Heart (radians, the way a ring turns). */
export function turned(x: number, z: number, angle: number) {
  const dx = x - RING.x, dz = z - RING.z, c = Math.cos(angle), s = Math.sin(angle);
  return { x: RING.x + dx * c + dz * s, z: RING.z + dz * c - dx * s };
}

/** Which ring (x, z) stands on: 0 the inner one and everything past the well's rim (they stand), 1 the middle one, 2 the outer one. */
export function ringOf(x: number, z: number) {
  const r = Math.hypot(x - RING.x, z - RING.z);
  return r < BURST_RINGS.inner || r >= BURST_RINGS.outer ? 0 : r < BURST_RINGS.mid ? 1 : 2;
}

/** The room's outline on the canvas, (x east, y south) of the Heart in pixels; `inset` metres inside the walls. */
function sunPath(g: CanvasRenderingContext2D, ppm: number, inset = 0) {
  const w = BURST.half - inset, well = BURST.well - inset, mouth = Math.sqrt(well * well - w * w), len = BURST.len - inset;
  g.beginPath();
  for (let k = 0; k < BURST.rays; k++) {
    const a = rayAngle(k), ux = Math.sin(a), uy = Math.cos(a), vx = Math.cos(a), vy = -Math.sin(a);
    const at = (along: number, lat: number) => [(ux * along + vx * lat) * ppm, (uy * along + vy * lat) * ppm] as const;
    const pts = [at(mouth, -w), at(len, -w), at(len, w), at(mouth, w)];
    pts.forEach(([x, y], i) => (k + i ? g.lineTo(x, y) : g.moveTo(x, y)));
  }
  g.closePath();
}

/**
 * The floor: the crust of cooled gold of the room for two, gone dark bronze, carried on outward: rings of plates round the Heart to
 * the well's rim and on across every ray, molten light only in the cracks between them. Dark on purpose: pale orange means leave
 * and gold means stand. One drawing for the colour, one for the glow.
 */
function crustFloor() {
  const size = 2048, ppm = size / (SPAN * 2), rnd = seeded(1207);
  const plates: { pts: [number, number][]; tone: number }[] = [];
  JOINTS.slice(0, -1).forEach((r0, i) => {
    const r1 = JOINTS[i + 1], n = Math.round(9 + i * 4 + Math.max(0, i - 6) * 3), turn = rnd() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a0 = turn + (k / n) * Math.PI * 2 + 0.012, a1 = turn + ((k + 1) / n) * Math.PI * 2 - 0.012;
      const i0 = r0 + 0.07 + rnd() * 0.08, i1 = r1 - 0.07 - rnd() * 0.08, pts: [number, number][] = [];
      const steps = 4;
      for (let j = 0; j <= steps; j++) { const a = a0 + ((a1 - a0) * j) / steps; pts.push([Math.cos(a) * i1, Math.sin(a) * i1]); }
      for (let j = steps; j >= 0; j--) { const a = a0 + ((a1 - a0) * j) / steps; pts.push([Math.cos(a) * i0, Math.sin(a) * i0]); }
      if (rnd() < 0.3) pts.splice(1 + Math.floor(rnd() * 3), 1);
      plates.push({ pts, tone: rnd() });
    }
  });
  // Cracks that run across plates, out from the Heart; a few carry on down a ray.
  const cracks: [number, number][][] = [];
  for (let k = 0; k < 26; k++) {
    let a = k < 16 ? rnd() * Math.PI * 2 : Math.PI / 2 - rayAngle(k - 16) + (rnd() - 0.5) * 0.2, r = k < 16 ? 2.4 + rnd() * 3 : 14 + rnd() * 5;
    const line: [number, number][] = [[Math.cos(a) * r, Math.sin(a) * r]];
    const end = r + (k < 16 ? 3 + rnd() * 7 : 8 + rnd() * 9);
    while (r < Math.min(end, BURST.len - 0.5)) {
      r += 0.4 + rnd() * 0.5;
      a += ((rnd() - 0.5) * 0.25) / Math.max(1, r / 8);
      line.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    cracks.push(line);
  }
  const path = (g: CanvasRenderingContext2D, pts: [number, number][]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * ppm, y * ppm) : g.moveTo(x * ppm, y * ppm)));
    g.closePath();
  };
  const strokeCracks = (g: CanvasRenderingContext2D, style: string, width: number) => {
    g.strokeStyle = style;
    g.lineWidth = width;
    g.lineCap = g.lineJoin = 'round';
    for (const line of cracks) {
      g.beginPath();
      line.forEach(([x, y], i) => (i ? g.lineTo(x * ppm, y * ppm) : g.moveTo(x * ppm, y * ppm)));
      g.stroke();
    }
  };
  /** The floor inside the walls, and the two gates' passages. */
  const clipRoom = (g: CanvasRenderingContext2D) => {
    sunPath(g, ppm);
    g.rect(-GATE * ppm, (BURST.len - 0.5) * ppm, GATE * 2 * ppm, (SPAN - BURST.len) * ppm);
    g.rect(-GATE * ppm, -ALCOVE * ppm, GATE * 2 * ppm, (ALCOVE - BURST.len + 0.5) * ppm);
    g.clip();
  };
  const color = canvasTexture(size, (g, s) => {
    g.fillStyle = '#060405';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    g.save();
    clipRoom(g);
    g.fillStyle = '#0a0605';
    g.fillRect(-s / 2, -s / 2, s, s);
    for (const p of plates) {
      path(g, p.pts);
      // Dark bronze, a few plates a little warmer: gold that cooled.
      const t = p.tone;
      g.fillStyle = t < 0.75 ? `rgb(${30 + t * 14},${22 + t * 10},${17 + t * 6})` : `rgb(${50 + t * 10},${36 + t * 8},${22})`;
      g.fill();
      g.strokeStyle = 'rgba(150,120,70,0.13)';
      g.lineWidth = 1.4;
      g.stroke();
    }
    // The gates' passages: plain dark slabs.
    g.fillStyle = 'rgb(30,23,18)';
    g.fillRect(-GATE * ppm, (BURST.len + 0.1) * ppm, GATE * 2 * ppm, (SPAN - BURST.len) * ppm);
    g.fillRect(-GATE * ppm, -ALCOVE * ppm, GATE * 2 * ppm, (ALCOVE - BURST.len - 0.1) * ppm);
    // Where the sun's rays burnt the stone: a darker, redder streak down the middle of each ray.
    for (let k = 0; k < BURST.rays; k++) {
      g.save();
      g.rotate(-rayAngle(k));
      const burn = g.createLinearGradient(-BURST.half * ppm, 0, BURST.half * ppm, 0);
      burn.addColorStop(0, 'rgba(60,16,6,0)');
      burn.addColorStop(0.5, 'rgba(60,16,6,0.34)');
      burn.addColorStop(1, 'rgba(60,16,6,0)');
      g.fillStyle = burn;
      g.fillRect(-BURST.half * ppm, 13 * ppm, BURST.half * 2 * ppm, (BURST.len - 13) * ppm);
      g.restore();
    }
    // Flecks of the gold it was, low.
    for (let i = 0; i < 5200; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * BURST.len;
      g.fillStyle = rnd() < 0.5 ? 'rgba(200,160,80,0.08)' : 'rgba(0,0,0,0.12)';
      g.fillRect(Math.cos(a) * r * ppm, Math.sin(a) * r * ppm, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    strokeCracks(g, '#060303', 0.2 * ppm);
    // The socket the Heart floats over, and the rim of the room for two: rings of brass, worn, not gold-bright.
    g.strokeStyle = 'rgba(170,130,60,0.3)';
    g.lineWidth = 0.12 * ppm;
    for (const r of [2.2, BURST_RINGS.inner, BURST_RINGS.mid, BURST_RINGS.outer]) { g.beginPath(); g.arc(0, 0, r * ppm, 0, Math.PI * 2); g.stroke(); }
    g.restore();
    // A kerb line just inside the walls.
    g.strokeStyle = 'rgba(190,150,70,0.42)';
    g.lineWidth = 3;
    sunPath(g, ppm, 1.15);
    g.stroke();
  });
  const glow = canvasTexture(size, (g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    clipRoom(g);
    // The molten heart under the crust: brighter in the middle, an ember glow out along the rays.
    const light = g.createRadialGradient(0, 0, 0, 0, 0, BURST.len * ppm);
    light.addColorStop(0, '#e08a38');
    light.addColorStop(0.12, '#a8441a');
    light.addColorStop(0.4, '#54200c');
    light.addColorStop(1, '#3a1206');
    g.fillStyle = light;
    g.fillRect(-s / 2, -s / 2, s, s);
    // The plates cover it: only the gaps between them, and the cracks, glow.
    g.fillStyle = '#000';
    for (const p of plates) {
      path(g, p.pts);
      g.fill();
    }
    g.fillRect(-GATE * ppm, BURST.len * ppm, GATE * 2 * ppm, (SPAN - BURST.len) * ppm);
    g.fillRect(-GATE * ppm, -ALCOVE * ppm, GATE * 2 * ppm, (ALCOVE - BURST.len) * ppm);
    strokeCracks(g, '#b04a16', 0.08 * ppm);
  });
  return { color, glow };
}

export const sunburstArena: ArenaDef = {
  id: 'sunburst',
  name: 'The Sunburst',
  ring: BURST_R,
  obstacles: BURST_OBSTACLES,
  hideGround: true,
  stage: { ...HEART_STAGE, fogNear: 95, fogFar: 260 },
  build() {
    const g = new THREE.Group();
    const own: { dispose(): void }[] = [];
    // The floor: one drawing under the room, in four pieces: the inner ring, the two that turn, and all the rest. The stone round
    // the room stands on it and hides what lies past the walls.
    const crust = crustFloor();
    const face = new THREE.MeshStandardMaterial({ map: crust.color, roughness: 0.6, metalness: 0.3, emissive: 0xffffff, emissiveMap: crust.glow, emissiveIntensity: 0.38 });
    const live = { uBurstGone: { value: floor.gone }, uBurstCrack: { value: floor.crack }, uBurstT: { value: 0 }, uBurstC: { value: new THREE.Vector2(RING.x, RING.z) } };
    face.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, live);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vBurst;\nuniform vec2 uBurstC;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBurst = (modelMatrix * vec4(transformed, 1.0)).xz - uBurstC;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vBurst;\nuniform float uBurstGone[8];\nuniform float uBurstCrack[8];\nuniform float uBurstT;')
        .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
          {
            // The sectors (inSector in src/arenas/sunburst.ts): one that glows along its cracks, one that is gone, one crusted over.
            float bGone = 0.0, bCrack = 0.0, bEdge = 0.0, bR = length(vBurst);
            if (bR >= ${BURST_SECTOR.from.toFixed(3)}) {
              for (int k = 0; k < 8; k++) {
                float a = float(k) * 0.7853981634;
                vec2 u = vec2(sin(a), cos(a));
                float along = dot(vBurst, u), lat = abs(dot(vBurst, vec2(u.y, -u.x)));
                if (along <= 0.0 || along > (k == 0 ? ${(SPAN + 2).toFixed(1)} : ${(BURST.len + 0.7).toFixed(1)})) continue;
                float lim = along >= ${BURST_SECTOR.bay.toFixed(3)} ? ${(BURST.half + 0.7).toFixed(3)} : along * ${SECTOR_TAN.toFixed(5)};
                if (lat > lim) continue;
                bGone = max(bGone, uBurstGone[k]);
                bCrack = max(bCrack, uBurstCrack[k]);
                bEdge = max(bEdge, uBurstCrack[k] * (1.0 - smoothstep(0.0, 0.45, min(lim - lat, bR - ${BURST_SECTOR.from.toFixed(3)}))));
              }
            }
            if (bGone > 0.5 && bGone < 1.5) discard;
            float bPulse = 0.72 + 0.28 * sin(uBurstT * (5.0 + 9.0 * bCrack));
            totalEmissiveRadiance *= 1.0 + 9.0 * bCrack * bPulse;
            totalEmissiveRadiance += vec3(1.0, 0.36, 0.06) * (0.12 * bCrack + 0.9 * bEdge) * bPulse;
            if (bGone > 1.5) {
              diffuseColor.rgb *= 0.28;
              totalEmissiveRadiance *= 0.12;
            }
          }`);
    };
    /** A flat piece of the floor from `r0` to `r1` round the Heart, with the one drawing laid over it as over the whole. */
    const piece = (r0: number, r1: number, segs: number) => {
      const geo = (r0 > 0 ? new THREE.RingGeometry(r0, r1, segs, 1) : new THREE.CircleGeometry(r1, segs)).rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (SPAN * 2), 0.5 - pos.getZ(i) / (SPAN * 2));
      const m = new THREE.Mesh(geo, face);
      m.position.set(RING.x, 0.012, RING.z);
      m.receiveShadow = true;
      g.add(m);
      own.push(geo);
      return m;
    };
    piece(0, BURST_RINGS.inner, 72);
    const midRing = piece(BURST_RINGS.inner, BURST_RINGS.mid, 96), outRing = piece(BURST_RINGS.mid, BURST_RINGS.outer, 128);
    // Out to the cavern's wall: the game's own ground is hidden here, so that a fallen sector opens on the sun and not on a slab.
    piece(BURST_RINGS.outer, 74, 128);
    own.push(crust.color, crust.glow, face);

    // The seams between the rings, and arrowheads on the two that turn: gold light, out until the floor turns.
    const gold = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const seams = new THREE.Group();
    for (const r of [BURST_RINGS.inner, BURST_RINGS.mid, BURST_RINGS.outer]) {
      const geo = new THREE.RingGeometry(r - 0.1, r + 0.1, 160).rotateX(-Math.PI / 2);
      seams.add(new THREE.Mesh(geo, gold));
      own.push(geo);
    }
    seams.position.set(RING.x, 0.03, RING.z);
    seams.visible = false;
    g.add(seams);
    /** Arrowheads round a ring at `r`, pointing the way its angle grows; turned round for the other way (`scale.z`). */
    const arrows = (ring: THREE.Mesh, r: number, n: number, size: number) => {
      const shape = new THREE.Shape();
      // An open chevron, its point toward +x.
      [[0.5, 0], [-0.2, 0.55], [-0.5, 0.55], [0.12, 0], [-0.5, -0.55], [-0.2, -0.55]].forEach(([x, y], i) => (i ? shape.lineTo(x * size, y * size) : shape.moveTo(x * size, y * size)));
      const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), group = new THREE.Group();
      for (let i = 0; i < n; i++) {
        // At angle `a` (from the south toward the east) the angle grows along (cos a, -sin a): the chevron's +x, turned by `a`.
        const a = (i / n) * Math.PI * 2, m = new THREE.Mesh(geo, gold);
        m.position.set(Math.sin(a) * r, 0.02, Math.cos(a) * r);
        m.rotation.y = a;
        group.add(m);
      }
      group.visible = false;
      ring.add(group);
      own.push(geo);
      return group;
    };
    const midArrows = arrows(midRing, (BURST_RINGS.inner + BURST_RINGS.mid) / 2, 10, 1.5), outArrows = arrows(outRing, (BURST_RINGS.mid + BURST_RINGS.outer) / 2, 14, 1.7);
    own.push(gold);

    // Under the crust: the sun. Seen only where a sector has fallen.
    const sunMat = new THREE.ShaderMaterial({
      uniforms: { uTime: live.uBurstT }, fog: false,
      vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vP;
        void main() {
          // Slow cells of hotter orange drifting over deep red, a dark skin where they meet: molten, drawn, not photographed. Never
          // gold: on this floor gold means stand here.
          vec2 p = vP * 0.16;
          float n = sin(p.x * 1.7 + uTime * 0.31) * sin(p.y * 1.3 - uTime * 0.23) + 0.5 * sin((p.x + p.y) * 2.9 + uTime * 0.5) + 0.35 * sin((p.x - p.y) * 4.3 - uTime * 0.37);
          float m = smoothstep(-0.9, 1.3, n);
          vec3 col = mix(vec3(0.3, 0.045, 0.008), vec3(0.78, 0.2, 0.025), m);
          col = mix(col, vec3(1.0, 0.46, 0.08), smoothstep(0.72, 1.0, m) * 0.7);
          col = mix(col, vec3(0.07, 0.015, 0.005), (1.0 - smoothstep(0.0, 0.1, abs(n + 0.25))) * 0.7);
          gl_FragColor = vec4(col * (1.0 - 0.3 * smoothstep(8.0, 40.0, length(vP))), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const DEEP = 7.5;
    const sun = new THREE.Mesh(new THREE.CircleGeometry(SPAN + 6, 48).rotateX(-Math.PI / 2), sunMat);
    sun.position.set(RING.x, -DEEP, RING.z);
    sun.visible = false;
    g.add(sun);
    own.push(sun.geometry, sunMat);
    // What a fallen sector leaves: the broken edge of the crust all round it, dark at the top, lit from below.
    const cliff = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x2a1f17, roughness: 0.7, metalness: 0.25, emissive: 0xff7a20, emissiveIntensity: 0.25, flatShading: true, side: THREE.DoubleSide });
    own.push(cliff, slabMat);
    /** A sector's outline, as (along its ray, across it): from the inner ring out to the ray's end and back. */
    const outline = (k: number) => {
      const from = BURST_SECTOR.from, bay = BURST_SECTOR.bay, end = k === 0 ? BURST.len + 9 : BURST.len, w = BURST.half, pts: [number, number][] = [];
      for (let i = 0; i <= 6; i++) {
        const a = -BURST_SECTOR.wedge + (i / 6) * 2 * BURST_SECTOR.wedge;
        pts.push([Math.cos(a) * from, Math.sin(a) * from]);
      }
      pts.push([bay, bay * SECTOR_TAN], [bay, w], [end, w], [end, -w], [bay, -w], [bay, -bay * SECTOR_TAN]);
      return pts;
    };
    const pits = new Map<number, THREE.Mesh>();
    const dig = (k: number) => {
      if (pits.has(k)) return;
      const pts = outline(k).map(([along, lat]) => burstAt(k, along, lat)), n = pts.length;
      const pos: number[] = [], col: number[] = [];
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        // Two triangles down from the floor's edge: crust at the top, then the glow of what is under it.
        for (const [q, y] of [[a, 0], [b, 0], [b, 1], [a, 0], [b, 1], [a, 1]] as const) {
          pos.push(q.x, y ? -DEEP : 0.012, q.z);
          col.push(...(y ? [0.5, 0.11, 0.015] : [0.035, 0.02, 0.015]));
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const m = new THREE.Mesh(geo, cliff);
      pits.set(k, m);
      g.add(m);
    };
    /** The crust of a sector as it goes: slabs that tip and drop, the ones nearest the Heart first. */
    const slabs: { mesh: THREE.Mesh; delay: number; lean: THREE.Vector3; t: number }[] = [];
    const drop = (k: number) => {
      const from = BURST_SECTOR.from, bay = BURST_SECTOR.bay, end = k === 0 ? BURST.len + 9 : BURST.len, rnd = seeded(900 + k);
      const cuts = [from, 9.4, 12, 14.6, bay, 21.5, 25.7, 29.9, end], wide = (a: number) => (a > bay ? BURST.half : a * SECTOR_TAN);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a0 = cuts[i], a1 = cuts[i + 1], w0 = i < 4 ? wide(a0) : BURST.half, w1 = i < 4 ? wide(a1) : BURST.half;
        for (const side of [-1, 1]) {
          // A four-cornered slab, half a metre thick, a little smaller than its place so the sun shows between them.
          const top = [[a0, 0], [a1, 0], [a1, side * w1], [a0, side * w0]].map(([al, la]) => burstAt(k, al, la));
          const cx = top.reduce((s, q) => s + q.x, 0) / 4, cz = top.reduce((s, q) => s + q.z, 0) / 4;
          const v: number[] = [];
          for (const y of [0, -0.5]) for (const q of top) v.push((q.x - cx) * (y ? 0.86 : 0.97), y, (q.z - cz) * (y ? 0.86 : 0.97));
          const faces = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6];
          for (let e = 0; e < 4; e++) { const f = (e + 1) % 4; faces.push(e, e + 4, f + 4, e, f + 4, f); }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
          geo.setIndex(faces);
          geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, slabMat);
          mesh.position.set(cx, 0.014, cz);
          g.add(mesh);
          slabs.push({ mesh, delay: (a0 - from) * 0.035 + rnd() * 0.12, lean: new THREE.Vector3(rnd() * 2 - 1, 0, rnd() * 2 - 1), t: 0 });
        }
      }
    };

    const SIZE: Record<string, number> = { lantern: 1.1, lamp: 1.9, beacon: 5 };
    const glows = new Glows(LAYOUT.marks.filter((m) => SIZE[m.kind]).map((m) => ({ ...m, size: SIZE[m.kind] })), 0xffa040, 1.5);
    g.add(glows.group);
    own.push(glows);

    // The cavern's wall far off, so the dark past the stone has an edge.
    const cave = new THREE.Mesh(
      new THREE.LatheGeometry([[70, 0], [80, 22], [98, 46], [130, 62]].map(([x, y]) => new THREE.Vector2(x, y)), 48),
      new THREE.MeshStandardMaterial({ color: 0x120a08, roughness: 1, side: THREE.DoubleSide }),
    );
    cave.position.set(RING.x, 0, RING.z);
    g.add(cave);
    own.push(cave.geometry, cave.material as THREE.Material);

    // Motes of gold rising out of the cracks, fading as they climb.
    const MOTES = 150;
    const motePos = new Float32Array(MOTES * 3), moteSeed = new Float32Array(MOTES);
    const mrnd = seeded(5151);
    for (let i = 0; i < MOTES; i++) {
      moteSeed[i] = mrnd();
      const a = mrnd() * Math.PI * 2, r = 3 + Math.sqrt(mrnd()) * (BURST.len - 3);
      motePos[i * 3] = RING.x + Math.sin(a) * r;
      motePos[i * 3 + 2] = RING.z + Math.cos(a) * r;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({ size: 0.12, color: 0xffc070, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    const motes = new THREE.Points(moteGeo, moteMat);
    motes.frustumCulled = false;
    g.add(motes);
    own.push(moteGeo, moteMat);

    let disposed = false;
    let cover: (THREE.Object3D | null)[] = [];
    /** Cover that has gone down with its sector: how long ago (s). */
    const sunk = new Map<THREE.Object3D, number>();
    const me: BurstShow = {
      sync() {
        midRing.rotation.y = floor.mid;
        outRing.rotation.y = floor.out;
        gold.opacity = 0.5 * floor.lit;
        seams.visible = midArrows.visible = outArrows.visible = floor.lit > 0.004;
        // The arrowheads point the way each ring goes: the outer one against the middle one.
        midArrows.scale.z = floor.sense;
        outArrows.scale.z = -floor.sense;
        sun.visible = floor.gone.some((v) => v === 1);
        for (const [k, pit] of pits) pit.visible = floor.gone[k] === 1;
      },
      fall(k, instant) {
        dig(k);
        if (!instant) drop(k);
        // The piece of the fallen armillary that lay in its ray goes with it.
        const c = cover[k];
        if (c) sunk.set(c, instant ? 99 : 0);
      },
      reset() {
        for (const s of slabs) { s.mesh.removeFromParent(); s.mesh.geometry.dispose(); }
        slabs.length = 0;
        for (const pit of pits.values()) { pit.removeFromParent(); pit.geometry.dispose(); }
        pits.clear();
        for (const c of sunk.keys()) { c.position.y = 0; c.rotation.z = 0; c.visible = true; }
        sunk.clear();
        me.sync();
      },
    };
    show = me;
    // A room built while a fight is on shows what has already gone.
    for (let k = 0; k < BURST.rays; k++) if (floor.gone[k] === 1) me.fall(k, true);
    me.sync();
    void realProps('sunburst', BURST_OBSTACLES.length, {
      dim: 0.85, env: 0.35,
      parts: { glow: { emissive: 0xffa040, strength: 2.0 }, stone: { dim: 0.8 }, slate: { dim: 0.85 }, gold: { dim: 0.62, rough: 0.5 }, scorch: { dim: 0.8 } },
    }).then((props) => {
      if (disposed) return;
      cover = props.cover;
      for (let k = 0; k < BURST.rays; k++) if (floor.gone[k] === 1 && cover[k]) sunk.set(cover[k]!, 99);
      for (const c of props.cover) if (c) g.add(c);
      if (props.back) g.add(props.back);
    }).catch((e) => console.warn('the sunburst: props failed to load', e));

    return {
      group: g,
      update(dt, time) {
        glows.update(time);
        live.uBurstT.value = time;
        // The slabs of a sector that is going: each tips and drops into the sun.
        for (let i = slabs.length - 1; i >= 0; i--) {
          const s = slabs[i];
          s.t += dt;
          const t = s.t - s.delay;
          if (t <= 0) continue;
          s.mesh.position.y = 0.014 - 0.5 * 11 * t * t;
          s.mesh.rotation.set(s.lean.x * Math.min(0.9, t * 0.8), 0, s.lean.z * Math.min(0.9, t * 0.8));
          if (s.mesh.position.y > -DEEP - 1) continue;
          s.mesh.removeFromParent();
          s.mesh.geometry.dispose();
          slabs.splice(i, 1);
        }
        for (const [c, t] of sunk) {
          if (t > 3) { c.visible = false; continue; }
          sunk.set(c, t + dt);
          c.position.y = -0.5 * 11 * Math.max(0, t - 0.5) ** 2;
          c.rotation.z = Math.min(0.5, Math.max(0, t - 0.5) * 0.6);
        }
        for (let i = 0; i < MOTES; i++) {
          const s = moteSeed[i], u = (time * (0.06 + s * 0.08) + s * 3) % 1;
          motePos[i * 3 + 1] = u * 8;
        }
        moteGeo.attributes.position.needsUpdate = true;
      },
      resetShift() { burstFloor.reset(); },
      dispose() {
        disposed = true;
        if (show === me) show = null;
        for (const s of slabs) s.mesh.geometry.dispose();
        for (const pit of pits.values()) pit.geometry.dispose();
        for (const o of own) o.dispose();
      },
    };
  },
};
