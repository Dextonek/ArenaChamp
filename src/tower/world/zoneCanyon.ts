import * as THREE from 'three';
import { RING, canvasTexture, flatRing, floorDisc, seeded } from '../../arenas/common';
import { canyonArena } from '../../arenas/canyon';
import { Glows } from '../../arenas/real';
import type { ArenaDef, ArenaStage } from '../../arenas/types';
import { pillar, wall, type Obstacle } from '../../obstacles';
import type { PlaceDef } from './def';
import { Kit } from './zone';
import { corridor, massCover, masses, type Mass, type Open } from './zoneGen';

/**
 * Floor 3, The Storm Canyon, drawn in code in the Sandstone Canyon's look (a dark band of warm stone and sand at dusk, turquoise glaze and
 * cloth, brass, amber lanterns) at the zone's size (`ZONE_R`, 48 m). A wide wadi runs from the camp in the south to the raiders' gate in
 * the north with rocks standing in it (they are the storm's shelter: `law.ts` `storm`), a few places beside it (three wells, the bridge, two
 * bays by the camp), and everything else is cliff (`zoneGen.ts` masses). Clean forms in a few plain materials: a first pass drawn in code
 * for the artist to direct. The canyon's own sculpted props are not reused here.
 */
export const ZONE_R = 48;
const at = (dx: number, dz: number) => ({ x: RING.x + dx, z: RING.z + dz });

type Id = 'camp' | 'well1' | 'well2' | 'well3' | 'bridge' | 'hollow' | 'gateway' | 'gate' | 'fort';
const place = (id: Id, name: string, dx: number, dz: number, r: number, sx = dx, sz = dz): PlaceDef => ({ id, name, ...at(dx, dz), r, stand: at(sx, sz) });
export const PLACES: Record<Id, PlaceDef> = {
  camp: place('camp', 'The camp', 0, 34, 8, 0, 37.5),
  well1: place('well1', 'The west well', -25, 16, 5.5),
  well2: place('well2', 'The east well', 26, 6, 5.5),
  well3: place('well3', 'The north well', -22, -12, 5.5),
  bridge: place('bridge', 'The bridge', -32, -8, 5),
  hollow: place('hollow', 'The west bay', -26, 36, 4.2),
  gateway: place('gateway', 'The east bay', 26, 36.5, 4.2),
  gate: place('gate', 'The raiders’ gate', 0, -34, 8, 0, -30),
  fort: place('fort', 'The old fort', 25, -27, 7),
};
export const ZONE_START = at(0, 39.5);

/** The wadi and the places and the little ways between them. */
export const WAYS: Record<string, { pts: [number, number][]; w: number }> = {
  wadi: { pts: [[0, 40], [0, -36]], w: 21 },
  bridge: { pts: [[-19, -6], [-29, -8]], w: 3.4 },
  hollow: { pts: [[-12, 36], [-24, 36]], w: 3.6 },
  gateway: { pts: [[12, 36.5], [24, 36.5]], w: 3.6 },
};
/** Little alcoves off the wadi where a cache lies. */
export const NOOKS: [number, number][][] = [[[-20, 10], [-34, 12]], [[20, -12], [34, -14]], [[-16, -26], [-27, -29]]];

export const OPEN: Open[] = [
  ...Object.values(PLACES).map((p) => ({ x: p.x - RING.x, z: p.z - RING.z, r: p.r })),
  ...Object.values(WAYS).flatMap((w) => corridor(w.pts, w.w)),
  ...NOOKS.flatMap((n) => corridor(n, 2.6)),
];
export const MASSES: Mass[] = masses(OPEN, { ring: ZONE_R, spacing: 10.4, rMax: 7.4, rMin: 1.2, margin: 0.4, jitter: 1.2, seed: 7313, rFill: 3 });

const P = (dx: number, dz: number, r: number, h: number): Obstacle => ({ ...pillar(RING.x + dx, RING.z + dz, r), height: h });
const WL = (ax: number, az: number, bx: number, bz: number, r: number, h: number): Obstacle => ({ ...wall(RING.x + ax, RING.z + az, RING.x + bx, RING.z + bz), r, height: h });
type Kind = 'fire' | 'tent' | 'crate' | 'rock' | 'column' | 'well' | 'jars' | 'spring';
/** Rocks stand in the wadi so that a hero can get out of the wind behind one (the storm's shelter), tents and a fire in the camp, wells. */
const PROPS: { kind: Kind; o: Obstacle }[] = [
  { kind: 'fire', o: P(0, 33.5, 0.9, 0.9) }, { kind: 'tent', o: P(-6.4, 37.5, 1.6, 2.6) }, { kind: 'tent', o: P(6.4, 31, 1.6, 2.6) }, { kind: 'crate', o: P(-4.6, 30.4, 0.8, 1.2) }, { kind: 'jars', o: P(10, 38.5, 0.9, 1.3) },
  { kind: 'spring', o: P(7, 38.5, 1.1, 0.9) },
  { kind: 'well', o: P(-25, 16, 1.4, 1.1) }, { kind: 'well', o: P(26, 6, 1.4, 1.1) }, { kind: 'well', o: P(-22, -12, 1.4, 1.1) },
  // the rocks of the wadi: sandstone pillars of every size, and a few fallen columns
  { kind: 'rock', o: P(-9, 24, 2.0, 4.2) }, { kind: 'rock', o: P(11, 25, 1.7, 3.6) }, { kind: 'rock', o: P(-16, 28, 1.5, 3.2) }, { kind: 'rock', o: P(17, 17, 2.2, 4.8) },
  { kind: 'rock', o: P(-5, 14, 1.6, 3.4) }, { kind: 'rock', o: P(6, 10, 1.9, 4.0) }, { kind: 'rock', o: P(-14, 4, 2.4, 5.0) }, { kind: 'rock', o: P(13, -2, 1.8, 3.8) },
  { kind: 'rock', o: P(-4, -4, 1.5, 3.2) }, { kind: 'rock', o: P(-12, -22, 2.0, 4.4) }, { kind: 'rock', o: P(5, -14, 2.3, 4.8) }, { kind: 'rock', o: P(15, -26, 1.8, 3.8) },
  { kind: 'rock', o: P(-6, -28, 1.6, 3.4) }, { kind: 'rock', o: P(8, -22, 1.4, 3.0) }, { kind: 'rock', o: P(-18, 18, 1.3, 2.8) }, { kind: 'rock', o: P(18, 30, 1.5, 3.2) },
  { kind: 'rock', o: P(-18, 30, 1.4, 3.0) }, { kind: 'rock', o: P(20, -8, 1.6, 3.4) }, { kind: 'rock', o: P(-3, -12, 1.3, 2.8) }, { kind: 'rock', o: P(10, 3, 1.2, 2.6) },
  { kind: 'column', o: WL(-9, 8, -5, 9.6, 0.7, 1.4) }, { kind: 'column', o: WL(8, -8, 12, -9.6, 0.7, 1.4) }, { kind: 'column', o: WL(-20, -2, -16, -1, 0.7, 1.4) },
  // the raiders' gate: a long wall across the north with a doorway in the middle (the door itself is the floor's)
  { kind: 'column', o: WL(-26, -41, -3.4, -41, 0.6, 3.8) }, { kind: 'column', o: WL(3.4, -41, 26, -41, 0.6, 3.8) },
];
export const ZONE_COVER: Obstacle[] = [...MASSES.map((m) => massCover(m, 2.8 + m.r * 0.5)), ...PROPS.map((p) => p.o)];

// --- the look ---------------------------------------------------------------------------------------------------

const STAGE: ArenaStage = { ...canyonArena.stage, fogNear: 50, fogFar: 160 };
const px = (x: number, c: number, ppm: number) => c + x * ppm;
const SAND = [56, 44, 40], ROAD = [47, 40, 37], FLAG = [47, 42, 39], TILE = [20, 66, 64];
const tone = (c: number[], t: number, warm = 0) => `rgb(${Math.round(c[0] * t + warm)},${Math.round(c[1] * t)},${Math.round(c[2] * t - warm)})`;

function groundTexture() {
  return canvasTexture(2048, (g, size) => {
    const rnd = seeded(47), c = size / 2, ppm = size / (2 * ZONE_R);
    g.fillStyle = tone(SAND, 1);
    g.fillRect(0, 0, size, size);
    // the wind's ripples: short crescents, lighter on one side and darker on the other
    g.lineCap = 'round';
    for (let k = 0; k < 520; k++) {
      const x = rnd() * size, y = rnd() * size, w = (0.8 + 1.4 * rnd()) * ppm * 2;
      for (const [dy, t, lw] of [[0, 1.1, 2.4], [5, 0.88, 3]] as const) {
        g.strokeStyle = tone(SAND, t);
        g.lineWidth = lw;
        g.beginPath(); g.moveTo(x - w, y + dy); g.quadraticCurveTo(x, y + dy - 0.22 * w, x + w, y + dy); g.stroke();
      }
    }
    // the old road: worn flags in running rows, along the wadi's middle from the camp to the gate
    const rw = 4.6;
    g.fillStyle = tone(SAND, 0.8);
    g.fillRect(px(-rw / 2, c, ppm), px(-41, c, ppm), rw * ppm, 82 * ppm);
    for (let z = -41; z < 41; z += 1.5) for (let k = 0; k < 3; k++) {
      g.fillStyle = tone(ROAD, 0.86 + 0.26 * rnd());
      g.fillRect(px(-rw / 2 + (k + ((z / 1.5) & 1 ? 0.5 : 0)) * (rw / 3), c, ppm) + 2, px(z, c, ppm) + 2, (rw / 3) * ppm - 4, 1.5 * ppm - 4);
    }
    // the courts: square flags, a line of turquoise tiles round the rim, brass
    for (const p of Object.values(PLACES)) {
      const cx = px(p.x - RING.x, c, ppm), cz = px(p.z - RING.z, c, ppm);
      g.save(); g.beginPath(); g.arc(cx, cz, p.r * ppm, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#171514'; g.fillRect(cx - p.r * ppm, cz - p.r * ppm, p.r * 2 * ppm, p.r * 2 * ppm);
      for (let z = -p.r; z < p.r; z += 1.5) for (let x = -p.r; x < p.r; x += 1.5) {
        g.fillStyle = tone(FLAG, 0.86 + 0.28 * rnd(), (rnd() - 0.5) * 5);
        g.fillRect(cx + (x + (((z / 1.5) | 0) % 2) * 0.75) * ppm + 1.5, cz + z * ppm + 1.5, 1.5 * ppm - 3, 1.5 * ppm - 3);
      }
      g.restore();
      g.strokeStyle = tone(TILE, 1.4); g.lineWidth = 0.32 * ppm; g.beginPath(); g.arc(cx, cz, (p.r - 0.5) * ppm, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#74592c'; g.lineWidth = 0.07 * ppm; g.beginPath(); g.arc(cx, cz, (p.r - 0.25) * ppm, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cz, (p.r - 0.75) * ppm, 0, Math.PI * 2); g.stroke();
    }
    g.strokeStyle = '#74592c'; g.lineWidth = 0.14 * ppm; g.beginPath(); g.arc(c, c, (ZONE_R - 0.9) * ppm, 0, Math.PI * 2); g.stroke();
  });
}

export function buildCanyon(): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const mat = (color: number, rough = 0.85, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, ...o });
    own.push(m);
    return m;
  };
  const rockA = mat(0x7a4d3c, 0.95), rockB = mat(0x93604b, 0.95), rockC = mat(0x5e3b30, 0.95), flag = mat(0x5a4d44, 0.8), cloth = mat(0x1f8a86, 0.8, { side: THREE.DoubleSide }), canvas = mat(0xb9a47c, 0.9, { side: THREE.DoubleSide }), wood = mat(0x4a3626), dark = mat(0x2a1f1a);
  const gold = mat(0xc9a24a, 0.4, { metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.22 });
  const water = new THREE.MeshBasicMaterial({ color: 0x3aa6c8 });
  own.push(water);

  const sandTex = groundTexture();
  const ground = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.9, envMapIntensity: 0.12 });
  const floor = floorDisc(ZONE_R, ground, 0.012, 192);
  const apron = new THREE.Mesh(new THREE.RingGeometry(ZONE_R - 0.1, 170, 96, 1), mat(0x382c28, 0.95));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(RING.x, 0.006, RING.z);
  apron.receiveShadow = true;
  const rim = flatRing(ZONE_R + 0.3, ZONE_R + 0.4, 0x9a7a38, 1, 0.176, 192);
  g.add(apron, floor, rim);
  own.push(floor.geometry, sandTex, ground, apron.geometry, rim.geometry, rim.material as THREE.Material);

  const kit = new Kit();
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const rnd = seeded(5521);
  const rocks = [rockA, rockB, rockC];
  const glowSpots: { x: number; y: number; z: number; size?: number }[] = [];

  /** A rock: stacked rounded blocks that narrow upward, with a lighter band, as the canyon's bastions. */
  const stack = (x: number, z: number, r: number, h: number, base = 0) => {
    const n = Math.max(2, Math.round(h / 2.6)), seg = h / n;
    for (let i = 0; i < n; i++) {
      const k = 1 - (i / n) * 0.32, rr = r * k * (0.95 + rnd() * 0.15);
      kit.add(i % 2 ? rockB : rocks[(i + base) % 3 === 1 ? 0 : 2], ico, x + (rnd() - 0.5) * r * 0.1, i * seg + seg * 0.5, z + (rnd() - 0.5) * r * 0.1, rnd() * 6, rr, seg * 0.62, rr);
    }
  };
  for (const m of MASSES) {
    const cx = RING.x + m.x, cz = RING.z + m.z, h = 2.8 + m.r * 0.5;
    // a bastion: one great stack, and smaller ones round its foot so that its edge is ragged
    stack(cx, cz, m.r * 0.92, h);
    const n = Math.round(m.r / 2);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = m.r * (0.4 + rnd() * 0.4);
      stack(cx + Math.cos(a) * d, cz + Math.sin(a) * d, m.r * (0.3 + rnd() * 0.15), h * (0.4 + rnd() * 0.3), i);
    }
  }
  for (const { kind, o } of PROPS) {
    const yaw = Math.atan2(o.bx - o.ax, o.bz - o.az), len = Math.hypot(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, r = o.r, h = o.height;
    switch (kind) {
      case 'fire':
        kit.add(flag, cyl(r, r * 1.1, 0.35, 8), o.ax, 0, o.az).add(wood, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 0.3, 1, 1, 1, 0.8).add(wood, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 2.4, 1, 1, 1, 0.8);
        kit.add(gold, new THREE.ConeGeometry(0.35, 0.9, 6).translate(0, 0.85, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: 1.2, z: o.az, size: 7 });
        break;
      case 'tent':
        kit.add(cloth, new THREE.ConeGeometry(r * 1.3, h * 1.4, 7).translate(0, h * 0.7, 0), o.ax, 0, o.az, rnd() * 3).add(gold, cyl(0.05, 0.05, h * 1.9, 4), o.ax, 0, o.az);
        break;
      case 'crate':
        kit.add(wood, box(r * 2, h, r * 2), o.ax, 0, o.az, rnd() * 3).add(gold, box(r * 2.06, 0.08, r * 2.06), o.ax, h * 0.5, o.az, 0);
        break;
      case 'jars':
        for (let k = 0; k < 4; k++) kit.add(k % 2 ? cloth : canvas, new THREE.SphereGeometry(0.4, 7, 6).translate(0, 0.4, 0), o.ax + Math.cos(k * 1.6) * 0.5, 0, o.az + Math.sin(k * 1.6) * 0.5, 0, 1, 1.15, 1);
        break;
      case 'spring':
        kit.add(flag, cyl(r, r * 1.12, 0.55, 10), o.ax, 0, o.az).add(water, cyl(r * 0.82, r * 0.82, 0.05, 10), o.ax, 0.52, o.az).add(gold, new THREE.TorusGeometry(r * 1.0, 0.07, 5, 14).rotateX(Math.PI / 2).translate(0, 0.56, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: 0.9, z: o.az, size: 2.2 });
        break;
      case 'well':
        kit.add(flag, cyl(r, r * 1.12, 0.9, 10), o.ax, 0, o.az).add(dark, cyl(r * 0.78, r * 0.78, 0.06, 10), o.ax, 0.86, o.az).add(gold, new THREE.TorusGeometry(r, 0.08, 5, 14).rotateX(Math.PI / 2).translate(0, 0.92, 0), o.ax, 0, o.az);
        for (const s of [-1, 1]) kit.add(wood, cyl(0.08, 0.1, 2.4, 5), o.ax + s * (r + 0.1), 0, o.az);
        kit.add(wood, box(0.12, 0.12, r * 2.7), o.ax, 2.4, o.az, Math.PI / 2).add(cloth, new THREE.TorusGeometry(0.28, 0.07, 5, 10), o.ax, 1.8, o.az, 0);
        break;
      case 'rock':
        stack(o.ax, o.az, r, h * 1.3, Math.floor(rnd() * 3));
        break;
      case 'column':
        if (h > 2) {
          // the gate's wall: dressed blocks, a band of turquoise, a cap of brass
          kit.add(flag, box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add(cloth, box(r * 2.1, 0.4, len + r * 2.1), mx, h * 0.7, mz, yaw).add(gold, box(r * 2.3, 0.1, len + r * 2.3), mx, h, mz, yaw);
        } else kit.add(flag, new THREE.CylinderGeometry(r, r, len + r * 2, 8).rotateX(Math.PI / 2).translate(0, r, 0), mx, 0, mz, yaw).add(gold, new THREE.TorusGeometry(r * 1.02, 0.05, 5, 10).translate(0, r, 0), mx, 0, mz, yaw, 1, 1, 1, 0);
        break;
    }
  }
  // Lanterns on posts at the places, towards the middle.
  for (const p of Object.values(PLACES)) {
    const a = Math.atan2(RING.x - p.x, RING.z - p.z), x = p.x + Math.sin(a) * (p.r - 1), z = p.z + Math.cos(a) * (p.r - 1);
    kit.add(wood, cyl(0.12, 0.16, 2.6, 6), x, 0, z).add(gold, cyl(0.2, 0.2, 0.1, 6), x, 2.6, z);
    glowSpots.push({ x, y: 2.85, z, size: 1.8 });
  }
  // The far canyon beyond the rim: mesas and bastions in the fog.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.1, d = ZONE_R + 8 + rnd() * 24, x = RING.x + Math.sin(a) * d, z = RING.z + Math.cos(a) * d;
    stack(x, z, 5 + rnd() * 5, 12 + rnd() * 14, i);
  }
  kit.build(g, own);

  const glows = new Glows(glowSpots, 0xffa040, 1.5);
  g.add(glows.group);
  own.push(glows);

  return {
    group: g,
    update(_dt, time) { glows.update(time); },
    dispose() {
      g.removeFromParent();
      for (const o of own) o.dispose();
    },
  };
}

export const canyonZoneArena: ArenaDef = {
  id: 'tower-zone-canyon',
  name: 'The Storm Canyon, a zone',
  ring: ZONE_R,
  obstacles: ZONE_COVER,
  stage: STAGE,
  hideGround: true,
  build() {
    const z = buildCanyon();
    return { group: z.group, update: z.update, dispose: z.dispose };
  },
};
