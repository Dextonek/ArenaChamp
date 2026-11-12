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
    for (const r of [2.2, 12]) { g.beginPath(); g.arc(0, 0, r * ppm, 0, Math.PI * 2); g.stroke(); }
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
  stage: { ...HEART_STAGE, fogNear: 95, fogFar: 260 },
  build() {
    const g = new THREE.Group();
    const own: { dispose(): void }[] = [];
    // The floor: one drawn square under the room; the stone round it stands on it and hides the rest.
    const crust = crustFloor();
    const face = new THREE.MeshStandardMaterial({ map: crust.color, roughness: 0.6, metalness: 0.3, emissive: 0xffffff, emissiveMap: crust.glow, emissiveIntensity: 0.38 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(SPAN * 2, SPAN * 2), face);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(RING.x, 0.012, RING.z);
    floor.receiveShadow = true;
    g.add(floor);
    own.push(floor.geometry, crust.color, crust.glow, face);

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
    void realProps('sunburst', BURST_OBSTACLES.length, {
      dim: 0.85, env: 0.35,
      parts: { glow: { emissive: 0xffa040, strength: 2.0 }, stone: { dim: 0.8 }, slate: { dim: 0.85 }, gold: { dim: 0.62, rough: 0.5 }, scorch: { dim: 0.8 } },
    }).then((props) => {
      if (disposed) return;
      for (const c of props.cover) if (c) g.add(c);
      if (props.back) g.add(props.back);
    }).catch((e) => console.warn('the sunburst: props failed to load', e));

    return {
      group: g,
      update(_dt, time) {
        glows.update(time);
        for (let i = 0; i < MOTES; i++) {
          const s = moteSeed[i], u = (time * (0.06 + s * 0.08) + s * 3) % 1;
          motePos[i * 3 + 1] = u * 8;
        }
        moteGeo.attributes.position.needsUpdate = true;
      },
      dispose() {
        disposed = true;
        for (const o of own) o.dispose();
      },
    };
  },
};
