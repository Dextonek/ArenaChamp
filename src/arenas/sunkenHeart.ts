import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import type { Obstacle } from '../obstacles';
import { lavaTexture } from './caldera';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef, ArenaStage } from './types';

/** How far the walkable floor reaches from the heart (m). */
export const HEART_R = RAID_BOSSES.heart.ring;
/** Where the floor's rings of plates meet, from the heart out (m): the cracks its beat runs along (Hold Still, src/raid/heart.ts). */
export const HEART_JOINTS = [2.2, 3.6, 5.2, 6.9, 8.6, 10.3, 12];

const GOLD = 0xc9a24a;
/** The crust's colours: cooled gold gone dark bronze, and the basalt of the lip. */
const CRUST = 0x231a14;
const BASALT = 0x17131a;

/**
 * No cover of its own: the Heart's beams and its Heartbeat cross the whole floor, and the only cover is what the fight raises (the
 * crust plates of Shade the heart, `PlayContext.addStone`).
 */
const COVER: Obstacle[] = [];

/** Under the mountain, lit from the molten floor and the lanterns: warm, low, no sky. */
const STAGE: ArenaStage = {
  background: 0x150a06,
  zenith: 0x080405,
  horizon: 0x3c1a0a,
  glow: 0xffa040,
  stars: 0,
  fog: 0x1c0d08,
  fogNear: 50,
  fogFar: 150,
  hemiSky: 0xffd0a0,
  hemiGround: 0x2a1006,
  hemiIntensity: 0.55,
  sun: 0xffd8a0,
  sunIntensity: 1.5,
  rim: 0xff8a3a,
  rimIntensity: 0.85,
};

/**
 * The floor: a crust of cooled gold, gone dark bronze, broken into plates round the heart, with molten light only in the cracks
 * between them. Rings of plates, so the Solar Flare's rings and the beams read on it. Dark on purpose: pale orange means leave and
 * gold means stand, and both must stand out. One drawing for the colour, one for the glow.
 */
function crustFloor() {
  const R = HEART_R, size = 1536, ppm = size / (2 * R);
  const rnd = seeded(1203);
  // The plates: rings of them round the middle, each a little irregular, the same in both drawings.
  const plates: { pts: [number, number][]; tone: number }[] = [];
  const rings = HEART_JOINTS.slice(0, -1).map((r0, i) => [r0, HEART_JOINTS[i + 1], 9 + i * 4] as const);
  for (const [r0, r1, n] of rings) {
    const turn = rnd() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a0 = turn + (k / n) * Math.PI * 2 + 0.02, a1 = turn + ((k + 1) / n) * Math.PI * 2 - 0.02;
      const i0 = r0 + 0.07 + rnd() * 0.08, i1 = r1 - 0.07 - rnd() * 0.08, pts: [number, number][] = [];
      const steps = 5;
      for (let j = 0; j <= steps; j++) { const a = a0 + ((a1 - a0) * j) / steps; pts.push([Math.cos(a) * i1, Math.sin(a) * i1]); }
      for (let j = steps; j >= 0; j--) { const a = a0 + ((a1 - a0) * j) / steps; pts.push([Math.cos(a) * i0, Math.sin(a) * i0]); }
      // A plate chipped at a corner here and there.
      if (rnd() < 0.35) pts.splice(1 + Math.floor(rnd() * 3), 1);
      plates.push({ pts, tone: rnd() });
    }
  }
  // A few cracks that run across plates, out from the heart.
  const cracks: [number, number][][] = [];
  for (let k = 0; k < 14; k++) {
    let a = rnd() * Math.PI * 2, r = 2.4 + rnd() * 2;
    const line: [number, number][] = [[Math.cos(a) * r, Math.sin(a) * r]];
    const end = r + 2 + rnd() * 6;
    while (r < Math.min(end, R - 0.4)) {
      r += 0.35 + rnd() * 0.45;
      a += (rnd() - 0.5) * 0.25;
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
  const color = canvasTexture(size, (g, s) => {
    g.fillStyle = '#0a0605';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
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
    // Flecks of the gold it was, low.
    for (let i = 0; i < 1400; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R;
      g.fillStyle = rnd() < 0.5 ? 'rgba(200,160,80,0.08)' : 'rgba(0,0,0,0.12)';
      g.fillRect(Math.cos(a) * r * ppm, Math.sin(a) * r * ppm, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    strokeCracks(g, '#060303', 0.22 * ppm);
    // The socket the heart floats over: a ring of brass, worn, not gold-bright.
    g.strokeStyle = 'rgba(170,130,60,0.3)';
    g.lineWidth = 0.12 * ppm;
    g.beginPath(); g.arc(0, 0, 2.2 * ppm, 0, Math.PI * 2); g.stroke();
  });
  const glow = canvasTexture(size, (g, s) => {
    g.translate(s / 2, s / 2);
    // The molten heart under the crust: brighter in the middle, an ember glow at the edge.
    const light = g.createRadialGradient(0, 0, 0, 0, 0, R * ppm);
    light.addColorStop(0, '#e08a38');
    light.addColorStop(0.3, '#a8441a');
    light.addColorStop(1, '#3e1206');
    g.fillStyle = light;
    g.fillRect(-s / 2, -s / 2, s, s);
    // The plates cover it: only the gaps between them, and the cracks, glow.
    g.fillStyle = '#000';
    for (const p of plates) {
      path(g, p.pts);
      g.fill();
    }
    strokeCracks(g, '#b04a16', 0.09 * ppm);
  });
  return { color, glow };
}

/** A lantern of the Heart's keepers: a basalt post, a gold cap and a caged sun. Its light is the room's only glow besides the cracks. */
function lantern(tall: number, stone: THREE.Material, gold: THREE.Material, flame: THREE.Material) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, tall, 6).translate(0, tall / 2, 0), stone);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.28, 6).translate(0, 0.14, 0), stone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 6).translate(0, tall * 0.62, 0), gold);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.12, 6).translate(0, tall + 0.06, 0), gold);
  const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0).scale(1, 1.35, 1).translate(0, tall + 0.55, 0), gold);
  const sun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), flame);
  sun.position.y = tall + 0.55;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 4).translate(0, tall + 1.15, 0), gold);
  for (const m of [post, foot, tip]) m.castShadow = true;
  // The cage is open: only its edges.
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cage.geometry), new THREE.LineBasicMaterial({ color: 0xd8b060 }));
  cage.geometry.dispose();
  g.add(post, foot, band, cap, edges, sun, tip);
  return g;
}

/**
 * The Sunken Heart: the fallen sun's own room, under the hall, not one of the duel arenas. A round floor of cooled gold crust over the
 * molten heart, a basalt lip with a gold edge, a molten lake past it, lanterns of the keepers round the rim, and out in the lake what
 * broke off as it fell: arcs of its armillary, a snapped ray of its crown, slabs of crust. All drawn in code from clean forms in the
 * heroes' props' materials (blender/arenas/real/STYLE.md): dark stone, gold on the edges, lantern light as the only glow.
 */
export const sunkenHeartArena: ArenaDef = {
  id: 'sunkenheart',
  name: 'The Sunken Heart',
  ring: HEART_R,
  obstacles: COVER,
  stage: STAGE,
  build() {
    const g = new THREE.Group();
    const R = HEART_R;
    const stone = new THREE.MeshStandardMaterial({ color: BASALT, roughness: 0.62, metalness: 0.12, flatShading: true });
    const crustMat = new THREE.MeshStandardMaterial({ color: CRUST, roughness: 0.7, metalness: 0.35, flatShading: true });
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.36, metalness: 0.85, flatShading: true, emissive: 0xffa040, emissiveIntensity: 0.06 });
    const flame = new THREE.MeshBasicMaterial({ color: 0xffd090 });

    // The molten lake round it all, and the crust floor.
    const lavaTex = lavaTexture();
    const lava = new THREE.Mesh(new THREE.RingGeometry(R + 3.4, 110, 72, 1), new THREE.MeshBasicMaterial({ map: lavaTex, color: 0xd8b088 }));
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(RING.x, 0.01, RING.z);
    const crust = crustFloor();
    const floor = floorDisc(R, new THREE.MeshStandardMaterial({ map: crust.color, color: 0xffffff, roughness: 0.6, metalness: 0.3, emissive: 0xffffff, emissiveMap: crust.glow, emissiveIntensity: 0.38 }), 0.024);
    g.add(lava, floor, flatRing(R - 0.55, R, 0x0b0809, 0.95, 0.03), flatRing(R - 0.5, R - 0.42, GOLD, 0.55, 0.034));

    // The lip: wide basalt steps out of the lake, gold on the edge. Under 2 m, so the camera looks over them.
    const lip = new THREE.Mesh(
      new THREE.LatheGeometry([[R, 0], [R, 0.32], [R + 0.9, 0.32], [R + 0.9, 0.62], [R + 2.4, 0.62], [R + 3, 0.12], [R + 3.4, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 128),
      new THREE.MeshStandardMaterial({ color: BASALT, roughness: 0.6, metalness: 0.12, side: THREE.DoubleSide }),
    );
    lip.position.set(RING.x, 0, RING.z);
    lip.castShadow = lip.receiveShadow = true;
    const edge = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.06, 4, 160).rotateX(Math.PI / 2), gold);
    edge.position.set(RING.x, 0.33, RING.z);
    const edge2 = new THREE.Mesh(new THREE.TorusGeometry(R + 0.92, 0.05, 4, 160).rotateX(Math.PI / 2), gold);
    edge2.position.set(RING.x, 0.63, RING.z);
    g.add(lip, edge, edge2);

    // The keepers' lanterns on the lip, clear of the two gates (south and north): tall on the far side, short on the camera's.
    const at = (deg: number, r: number) => { const a = THREE.MathUtils.degToRad(deg); return { x: RING.x + Math.sin(a) * r, z: RING.z + Math.cos(a) * r }; };
    const lights: THREE.Mesh[] = [];
    for (const [deg, tall] of [[45, 0.9], [90, 1.7], [130, 2.4], [230, 2.4], [270, 1.7], [315, 0.9]] as const) {
      const p = at(deg, R + 1.65), l = lantern(tall, stone, gold, flame);
      l.position.set(p.x, 0.62, p.z);
      g.add(l);
      lights.push(l.children[5] as THREE.Mesh);
    }

    // Out in the lake, what broke off the heart as it fell. Nothing tall on the camera's side (south).
    // Two arcs of its armillary, half sunk, far behind it.
    for (const [x, z, r, ry, tilt, arc] of [[-9, -24, 9, 0.5, 0.25, 2.1], [14, -21, 6.5, -0.7, -0.2, 1.7]] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.42, 6, 48, arc), gold);
      ring.position.set(RING.x + x, -r * 0.42, RING.z + z);
      ring.rotation.set(tilt, ry, 0.9);
      ring.castShadow = true;
      g.add(ring);
      // Rune studs along it, like the boss's own rings.
      for (let k = 1; k < 6; k++) {
        const a = (k / 6) * arc;
        const stud = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.9), stone);
        stud.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
        stud.rotation.z = a;
        ring.add(stud);
      }
    }
    // A snapped ray of its crown, lying in the lake to the west.
    const ray = new THREE.Mesh(new THREE.ConeGeometry(1.1, 11, 4).rotateZ(Math.PI / 2), gold);
    ray.position.set(RING.x - 22, 0.6, RING.z - 3);
    ray.rotation.set(0.15, 0.5, 0.12);
    ray.castShadow = true;
    g.add(ray);
    // Slabs of crust, tipped up out of the lake, a gold edge on each.
    const rnd = seeded(3301);
    for (let k = 0; k < 11; k++) {
      const a = Math.PI * (0.55 + rnd() * 0.9) + (k % 2 ? 0 : Math.PI * 0.95), d = R + 6 + rnd() * 14;
      const x = RING.x + Math.sin(a) * d, z = RING.z + Math.cos(a) * d;
      if (z > RING.z + R + 2) continue;
      const w = 1.4 + rnd() * 2.2, h = 0.35 + rnd() * 0.3, l = 1.6 + rnd() * 2.6;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), crustMat);
      slab.position.set(x, 0.1, z);
      slab.rotation.set((rnd() - 0.5) * 0.9, rnd() * 6.28, (rnd() - 0.5) * 0.9);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.08, 0.12), gold);
      trim.position.set(0, h / 2, l / 2);
      slab.add(trim);
      slab.castShadow = true;
      g.add(slab);
    }
    // The cavern's wall far off, so the lake has an edge.
    const cave = new THREE.Mesh(
      new THREE.LatheGeometry([[58, 0], [66, 16], [80, 36], [108, 50]].map(([x, y]) => new THREE.Vector2(x, y)), 64),
      new THREE.MeshStandardMaterial({ color: 0x120a08, roughness: 1, side: THREE.DoubleSide }),
    );
    cave.position.set(RING.x, 0, RING.z);
    g.add(cave);

    // Motes of gold rising off the lake and out of the cracks, fading as they climb.
    const MOTES = 80;
    const motePos = new Float32Array(MOTES * 3), moteSeed = new Float32Array(MOTES);
    const mrnd = seeded(5150);
    for (let i = 0; i < MOTES; i++) {
      moteSeed[i] = mrnd();
      const a = mrnd() * Math.PI * 2, r = 3 + Math.sqrt(mrnd()) * (R + 16);
      motePos[i * 3] = RING.x + Math.sin(a) * r;
      motePos[i * 3 + 2] = RING.z + Math.cos(a) * r;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: 0.12, color: 0xffc070, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
    motes.frustumCulled = false;
    g.add(motes);

    return {
      group: g,
      update(dt, time) {
        lavaTex.offset.x = (time * 0.003) % 1;
        lavaTex.offset.y = (time * 0.002) % 1;
        for (let i = 0; i < MOTES; i++) {
          const s = moteSeed[i], u = (time * (0.06 + s * 0.08) + s * 3) % 1;
          motePos[i * 3 + 1] = u * 8;
          motePos[i * 3] += Math.sin(time * 1.1 + s * 40) * 0.003;
        }
        moteGeo.attributes.position.needsUpdate = true;
        // The lanterns breathe a little, each on its own.
        lights.forEach((m, i) => m.scale.setScalar(1 + Math.sin(time * 2.3 + i * 1.7) * 0.08));
      },
      dispose() {
        disposeTree(g);
      },
    };
  },
};
