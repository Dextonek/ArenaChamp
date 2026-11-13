import * as THREE from 'three';
import { RING, canvasTexture, flatRing, floorDisc, seeded } from '../../arenas/common';
import { gladeArena } from '../../arenas/glade';
import { Glows } from '../../arenas/real';
import type { ArenaDef, ArenaStage } from '../../arenas/types';
import { pillar, wall, type Obstacle } from '../../obstacles';
import type { PlaceDef } from './def';
import { Kit } from './zone';
import { barrier, corridor, massCover, masses, type Mass, type Open } from './zoneGen';

/**
 * Floor 2, The Walking Wood, drawn in code in the Verdant Glade's look (dark moss and earth, golden dusk, fireflies, mossy stone, amber
 * lanterns) at the zone's size (`ZONE_R`, 48 m). The wood is a net of places (the camp, the hounds' den, the bramble, the old stones in
 * the middle, the giants' glade, the thicket, the heart) joined by corridors: everything else is tree masses (`zoneGen.ts`). The
 * `paths` law closes three corridors at a time with barriers of roots (`BARRIERS`); each set leaves every place reachable from the camp
 * (pipeline/designs/tower-worlds-floors23.md has the check).
 *
 * Clean forms in a few plain materials (bark, three leaf greens, moss stone, gold edges, amber glow): a first pass drawn in code for the
 * artist to direct, as floor 1's harbour is. The glade's own sculpted props are not reused (its loader is private to `glade.ts`).
 */
export const ZONE_R = 48;
const at = (dx: number, dz: number) => ({ x: RING.x + dx, z: RING.z + dz });

type Id = 'camp' | 'den' | 'bramble' | 'stones' | 'giants' | 'thicket' | 'heart';
const place = (id: Id, name: string, dx: number, dz: number, r: number, sx = dx, sz = dz): PlaceDef => ({ id, name, ...at(dx, dz), r, stand: at(sx, sz) });
export const PLACES: Record<Id, PlaceDef> = {
  camp: place('camp', 'The camp', 0, 34, 8, 0, 37.5),
  den: place('den', 'The hounds’ den', -29, 10, 8.5),
  bramble: place('bramble', 'The bramble', 29, 10, 8.5),
  stones: place('stones', 'The old stones', 0, 2, 6),
  giants: place('giants', 'The giants’ glade', 28, -24, 8.5),
  thicket: place('thicket', 'The thicket', -28, -24, 8),
  heart: place('heart', 'The heart', 0, -30, 9, 0, -26),
};
export const ZONE_START = at(0, 39.5);

const W = 3.4;
/** The corridors, as lines of points (offsets); the avenue to the heart is wider. */
export const WAYS: Record<string, { pts: [number, number][]; w: number }> = {
  campDen: { pts: [[-6, 30], [-15, 24], [-24, 15]], w: W },
  campBramble: { pts: [[6, 30], [15, 24], [24, 15]], w: W },
  campStones: { pts: [[0, 27], [0, 8]], w: W },
  denStones: { pts: [[-22, 8], [-12, 5], [-5, 3]], w: W },
  brambleStones: { pts: [[22, 8], [12, 5], [5, 3]], w: W },
  avenue: { pts: [[0, -3], [0, -22]], w: 6 },
  denThicket: { pts: [[-29, 2], [-28, -6], [-28, -16]], w: W },
  brambleGiants: { pts: [[29, 2], [28, -6], [28, -16]], w: W },
  thicketHeart: { pts: [[-21, -24], [-12, -27], [-7, -29]], w: W },
  giantsHeart: { pts: [[21, -24], [12, -27], [7, -29]], w: W },
  lair: { pts: [[0, -30], [0, -42]], w: 3.6 },
  // two short branches off the camp: the trial's hollow to the west, the gate up to the east (both in sight from the camp)
  hollow: { pts: [[-8, 36], [-25, 36.5]], w: W },
  gateway: { pts: [[8, 36], [25, 36.5]], w: W },
};
/** Little dead ends off the corridors where a cache lies. */
export const NOOKS: [number, number][][] = [[[-28, -5], [-38, -6]], [[34, 12], [42, 17.5]], [[-6, -11], [-13.5, -11.4]]];
/** Which corridors the roots close: set 0 from the start, set 1 after the first change; the rest are always open. */
export const CLOSES: Record<0 | 1, string[]> = { 0: ['campStones', 'denThicket', 'giantsHeart'], 1: ['denStones', 'brambleGiants', 'thicketHeart'] };
const WAY_NAMES: Record<string, string> = { campStones: 'the old road', denThicket: 'the den road', giantsHeart: 'the giants’ road', denStones: 'the den path', brambleGiants: 'the bramble road', thicketHeart: 'the thicket road' };
export const BARRIERS = (['0', '1'] as const).flatMap((s) => CLOSES[Number(s) as 0 | 1].map((k) => barrier(WAYS[k].pts, WAYS[k].w, 3.4, Number(s) as 0 | 1, WAY_NAMES[k])));

export const OPEN: Open[] = [
  ...Object.values(PLACES).map((p) => ({ x: p.x - RING.x, z: p.z - RING.z, r: p.r })),
  ...Object.values(WAYS).flatMap((w) => corridor(w.pts, w.w)),
  ...NOOKS.flatMap((n) => corridor(n, 2.6)),
];
export const MASSES: Mass[] = masses(OPEN, { ring: ZONE_R, spacing: 10.4, rMax: 7.2, rMin: 1.2, margin: 0.4, jitter: 1.2, seed: 4411, rFill: 3 });

const P = (dx: number, dz: number, r: number, h: number): Obstacle => ({ ...pillar(RING.x + dx, RING.z + dz, r), height: h });
const WL = (ax: number, az: number, bx: number, bz: number, r: number, h: number): Obstacle => ({ ...wall(RING.x + ax, RING.z + az, RING.x + bx, RING.z + bz), r, height: h });
/** What stands in the open ground: the camp's fire and tents, stones, logs, thorn bushes. */
const PROPS: { kind: 'fire' | 'tent' | 'crate' | 'rock' | 'log' | 'thorn' | 'menhir' | 'twist'; o: Obstacle }[] = [
  { kind: 'fire', o: P(0, 33.5, 0.9, 0.9) }, { kind: 'tent', o: P(-6.4, 37.5, 1.6, 2.6) }, { kind: 'tent', o: P(6.4, 31, 1.6, 2.6) }, { kind: 'crate', o: P(-4.6, 30.4, 0.8, 1.2) }, { kind: 'crate', o: P(5.4, 37, 0.8, 1.2) },
  { kind: 'rock', o: P(-32, 12.5, 1.2, 1.8) }, { kind: 'log', o: WL(-27, 6, -23.5, 7.4, 0.45, 1.2) }, { kind: 'rock', o: P(-25.5, 14.5, 1.0, 1.4) },
  { kind: 'thorn', o: P(26, 7, 1.1, 1.5) }, { kind: 'thorn', o: P(32.5, 13.5, 1.1, 1.5) }, { kind: 'thorn', o: P(30.5, 5.5, 1.0, 1.4) },
  { kind: 'menhir', o: P(22.5, -27, 0.8, 3.2) }, { kind: 'menhir', o: P(33.5, -21, 0.8, 3.2) }, { kind: 'menhir', o: P(28, -30.5, 0.8, 3.2) },
  { kind: 'twist', o: P(-32.5, -21, 0.9, 3.6) }, { kind: 'twist', o: P(-23.5, -27.5, 0.9, 3.6) },
  { kind: 'menhir', o: P(3.4, 5, 0.6, 2.4) }, { kind: 'menhir', o: P(-3.4, -1.4, 0.6, 2.4) },
  { kind: 'rock', o: P(-13, 6.8, 0.9, 1.2) }, { kind: 'rock', o: P(12.5, 2.2, 0.9, 1.2) }, { kind: 'log', o: WL(-3, 18, -1.6, 21, 0.4, 1.1) }, { kind: 'rock', o: P(-19, 20.5, 0.9, 1.2) }, { kind: 'rock', o: P(18, 19.6, 0.9, 1.2) },
  // the lair: a long wall of roots across the north with a doorway in the middle (the door itself is the floor's)
  { kind: 'log', o: WL(-26, -41, -3.4, -41, 0.5, 3.6) }, { kind: 'log', o: WL(3.4, -41, 26, -41, 0.5, 3.6) },
];
export const ZONE_COVER: Obstacle[] = [...MASSES.map((m) => massCover(m, 4.5)), ...PROPS.map((p) => p.o)];

// --- the look ---------------------------------------------------------------------------------------------------

const STAGE: ArenaStage = { ...gladeArena.stage, fogNear: 50, fogFar: 150 };
const px = (x: number, c: number, ppm: number) => c + x * ppm;

function groundTexture() {
  return canvasTexture(2048, (g, size) => {
    const rnd = seeded(31), c = size / 2, ppm = size / (2 * ZONE_R);
    g.fillStyle = '#121810';
    g.fillRect(0, 0, size, size);
    const blob = (x: number, y: number, rx: number, ry: number, rot: number, fill: string, a: number) => {
      g.save(); g.globalAlpha = a; g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); g.restore();
    };
    const moss = ['#1b2814', '#18240f', '#101608', '#202e17'];
    for (let i = 0; i < 380; i++) blob(rnd() * size, rnd() * size, size * (0.01 + rnd() * 0.03), size * (0.008 + rnd() * 0.02), rnd() * 3, moss[i % 4], 0.4 + rnd() * 0.3);
    // trails: pale earth with a darker edge, along every corridor
    g.lineCap = g.lineJoin = 'round';
    for (const w of Object.values(WAYS)) {
      const trace = () => { g.beginPath(); w.pts.forEach(([x, z], i) => (i ? g.lineTo(px(x, c, ppm), px(z, c, ppm)) : g.moveTo(px(x, c, ppm), px(z, c, ppm)))); };
      g.strokeStyle = '#0c0f08'; g.lineWidth = (w.w * 2 + 0.8) * ppm; trace(); g.stroke();
      g.strokeStyle = '#2e2514'; g.lineWidth = w.w * 2 * ppm * 0.92; trace(); g.stroke();
      g.strokeStyle = '#3a2f19'; g.lineWidth = w.w * 0.9 * ppm; g.setLineDash([0.9 * ppm, 2.2 * ppm]); trace(); g.stroke(); g.setLineDash([]);
    }
    // the places: mossy flags in a ring of darker moss, a gold-green ring
    for (const p of Object.values(PLACES)) {
      const cx = px(p.x - RING.x, c, ppm), cz = px(p.z - RING.z, c, ppm);
      g.save(); g.beginPath(); g.arc(cx, cz, p.r * ppm, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#16200f'; g.fillRect(cx - p.r * ppm, cz - p.r * ppm, p.r * 2 * ppm, p.r * 2 * ppm);
      for (let z = -p.r; z < p.r; z += 1.3) for (let x = -p.r; x < p.r; x += 1.3) {
        const t = 0.8 + 0.4 * rnd();
        g.fillStyle = `rgb(${Math.round(46 * t)},${Math.round(58 * t)},${Math.round(40 * t)})`;
        g.fillRect(cx + (x + (((z / 1.3) | 0) % 2) * 0.65) * ppm + 1, cz + z * ppm + 1, 1.3 * ppm - 2, 1.3 * ppm - 2);
      }
      g.restore();
      g.strokeStyle = '#6a8a3a'; g.lineWidth = 0.1 * ppm; g.beginPath(); g.arc(cx, cz, (p.r - 0.3) * ppm, 0, Math.PI * 2); g.stroke();
    }
    // leaf litter everywhere
    const litter = ['#2c1f10', '#33260f', '#241a0c', '#2a2410'];
    for (let i = 0; i < 2600; i++) blob(rnd() * size, rnd() * size, size * 0.0035, size * 0.002, rnd() * 3, litter[i % 4], 0.5);
    g.strokeStyle = '#6a8a3a'; g.lineWidth = 0.14 * ppm; g.beginPath(); g.arc(c, c, (ZONE_R - 0.9) * ppm, 0, Math.PI * 2); g.stroke();
  });
}

const glowDot = () => canvasTexture(64, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
});

export function buildWood(): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const mat = (color: number, rough = 0.85, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, ...o });
    own.push(m);
    return m;
  };
  const bark = mat(0x3c2b1c), barkLight = mat(0x5a4530), leafA = mat(0x1a3a1f), leafB = mat(0x234a27), leafC = mat(0x2d5a2d), mossy = mat(0x4a5a3a, 0.95), stone = mat(0x565a52, 0.95), wood = mat(0x4a3626), sail = mat(0x6f6a50, 0.95, { side: THREE.DoubleSide });
  const gold = mat(0xc9a24a, 0.4, { metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.22 });
  const thornMat = mat(0x5a2f3e, 0.8), sap = new THREE.MeshBasicMaterial({ color: 0xffb860 });
  own.push(sap);

  const ground = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.9, envMapIntensity: 0.15 });
  const floor = floorDisc(ZONE_R, ground, 0.012, 192);
  const apron = new THREE.Mesh(new THREE.RingGeometry(ZONE_R - 0.1, 160, 96, 1), mat(0x141c10, 0.95));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(RING.x, 0.006, RING.z);
  apron.receiveShadow = true;
  const rim = flatRing(ZONE_R - 0.35, ZONE_R - 0.18, 0x7ab050, 0.3, 0.016, 192);
  g.add(apron, floor, rim);
  own.push(floor.geometry, ground.map!, ground, apron.geometry, rim.geometry, rim.material as THREE.Material);

  const kit = new Kit();
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const cyl = (r0: number, r1: number, h: number, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const rnd = seeded(2207);
  const glowSpots: { x: number; y: number; z: number; size?: number }[] = [];
  const leaves = [leafA, leafB, leafC];

  // The tree masses: a mass is one pillar of cover; inside it stand trunks with crowns and low bushes, so the wood has a wall wherever the ground is not open.
  for (const m of MASSES) {
    const cx = RING.x + m.x, cz = RING.z + m.z, n = Math.max(2, Math.min(7, Math.round(m.r * 1.1)));
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = i === 0 ? 0 : Math.sqrt(rnd()) * m.r * 0.72, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const tr = 0.3 + rnd() * 0.25, th = 1.9 + rnd() * 1.1, cr = 1.15 + rnd() * 0.7 + m.r * 0.08;
      kit.add(i % 3 === 0 ? barkLight : bark, cyl(tr * 0.8, tr * 1.15, th), x, 0, z, rnd() * 3);
      kit.add(leaves[Math.floor(rnd() * 3)], ico, x, th + cr * 0.45, z, rnd() * 6, cr, cr * 0.85, cr);
      if (rnd() < 0.7) kit.add(leaves[Math.floor(rnd() * 3)], ico, x + (rnd() - 0.5) * 1.2, th + cr * 1.05, z + (rnd() - 0.5) * 1.2, rnd() * 6, cr * 0.62, cr * 0.55, cr * 0.62);
    }
    // the low green at the foot, where a hero walks past
    for (let i = 0; i < Math.round(m.r); i++) {
      const a = rnd() * 6.28, d = m.r * (0.55 + rnd() * 0.35), s = 0.9 + rnd() * 0.6;
      kit.add(leaves[Math.floor(rnd() * 3)], ico, cx + Math.cos(a) * d, s * 0.5, cz + Math.sin(a) * d, rnd() * 6, s * 1.1, s * 0.75, s * 1.1);
    }
    if (rnd() < 0.22) glowSpots.push({ x: cx + (rnd() - 0.5) * m.r, y: 1.4, z: cz + (rnd() - 0.5) * m.r, size: 1.0 });
  }

  for (const { kind, o } of PROPS) {
    const yaw = Math.atan2(o.bx - o.ax, o.bz - o.az), len = Math.hypot(o.bx - o.ax, o.bz - o.az), mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2, r = o.r, h = o.height;
    switch (kind) {
      case 'fire':
        kit.add(stone, cyl(r, r * 1.1, 0.35, 8), o.ax, 0, o.az).add(bark, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 0.3, 1, 1, 1, 0.8).add(bark, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 2.4, 1, 1, 1, 0.8);
        kit.add(gold, new THREE.ConeGeometry(0.35, 0.9, 6).translate(0, 0.85, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: 1.2, z: o.az, size: 7 });
        break;
      case 'tent':
        kit.add(sail, new THREE.ConeGeometry(r * 1.25, h * 1.4, 7).translate(0, h * 0.7, 0), o.ax, 0, o.az, rnd() * 3).add(gold, cyl(0.05, 0.05, h * 1.9, 4), o.ax, 0, o.az);
        break;
      case 'crate':
        kit.add(wood, box(r * 2, h, r * 2), o.ax, 0, o.az, rnd() * 3).add(gold, box(r * 2.06, 0.08, r * 2.06), o.ax, h * 0.5, o.az, 0);
        break;
      case 'rock':
        kit.add(mossy, ico, o.ax, h * 0.3, o.az, rnd() * 6, r * 1.1, h * 0.7, r * 1.1).add(stone, ico, o.ax + r * 0.5, h * 0.12, o.az - r * 0.3, rnd() * 6, r * 0.6, h * 0.38, r * 0.6);
        break;
      case 'log':
        kit.add(bark, new THREE.CylinderGeometry(r * 1.5, r * 1.7, len + r * 2, 7).rotateX(Math.PI / 2).translate(0, r * 1.5, 0), mx, 0, mz, yaw).add(mossy, box(r * 1.2, 0.2, len * 0.8), mx, r * 2.8, mz, yaw);
        if (h > 2) for (let k = -3; k <= 3; k++) { const t = (k / 3) * (len / 2); kit.add(bark, cyl(0.5, 0.7, h, 6), o.ax + (o.bx - o.ax) * (0.5 + t / len), 0, o.az + (o.bz - o.az) * (0.5 + t / len), rnd() * 3).add(leafA, ico, o.ax + (o.bx - o.ax) * (0.5 + t / len), h, o.az + (o.bz - o.az) * (0.5 + t / len), rnd() * 3, 1.5, 1.1, 1.5); }
        break;
      case 'thorn':
        for (let k = 0; k < 7; k++) kit.add(thornMat, new THREE.ConeGeometry(0.16, 1.5 + rnd(), 5).translate(0, 0.8, 0), o.ax + (rnd() - 0.5) * 1.4, 0, o.az + (rnd() - 0.5) * 1.4, 0, 1, 1, 1, (rnd() - 0.5) * 1.2);
        kit.add(leafA, ico, o.ax, 0.5, o.az, rnd() * 6, r * 1.1, 0.7, r * 1.1);
        glowSpots.push({ x: o.ax, y: 1.1, z: o.az, size: 1.2 });
        break;
      case 'menhir':
        kit.add(stone, new THREE.BoxGeometry(r * 1.6, h, r * 1.2).translate(0, h / 2, 0), o.ax, 0, o.az, rnd() * 3, 1, 1, 1, 0.04).add(gold, box(r * 1.7, 0.08, r * 1.3), o.ax, h * 0.62, o.az, 0);
        glowSpots.push({ x: o.ax, y: h * 0.7, z: o.az, size: 1.4 });
        break;
      case 'twist':
        kit.add(bark, cyl(0.3, 0.55, h, 6), o.ax, 0, o.az, 0, 1, 1, 1, 0.12).add(bark, cyl(0.2, 0.3, h * 0.6, 5), o.ax + 0.3, h * 0.7, o.az, 1, 1, 1, 1, -0.9).add(leafC, ico, o.ax, h + 0.7, o.az, 0, 1.6, 1.2, 1.6);
        glowSpots.push({ x: o.ax + 0.6, y: h * 0.8, z: o.az, size: 1.2 });
        break;
    }
  }

  // The heart: the Elder Root stands beyond the lair's wall (north of the heart's clearing), a trunk too wide to see round, roots that arch, a glowing core.
  {
    const x = RING.x, z = RING.z - 50;
    kit.add(bark, new THREE.CylinderGeometry(4.2, 6.2, 18, 10).translate(0, 9, 0), x, 0, z).add(leafA, ico, x, 20, z, 0, 11, 7, 11).add(leafB, ico, x + 5, 23, z + 2, 1, 7, 5, 7).add(leafC, ico, x - 6, 22, z + 1, 2, 6, 4.5, 6);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; kit.add(bark, cyl(0.6, 1.4, 9), x + Math.cos(a) * 6.6, 0, z + Math.sin(a) * 6.6, 0, 1, 1, 1, 1.0 * (Math.cos(a) > 0 ? -1 : 1)); }
    kit.add(sap, new THREE.SphereGeometry(1.5, 8, 6).translate(0, 4, 3.6), x, 0, z);
    glowSpots.push({ x, y: 4, z: z + 4, size: 9 });
  }
  // The far wood beyond the rim: tall trunks and crowns in the fog.
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.1, d = ZONE_R + 6 + rnd() * 26, x = RING.x + Math.sin(a) * d, z = RING.z + Math.cos(a) * d, h = 11 + rnd() * 9, c = 5 + rnd() * 3;
    kit.add(bark, cyl(0.8, 1.3, h, 7), x, 0, z).add(leaves[i % 3], ico, x, h, z, rnd() * 6, c, c * 0.75, c);
  }
  // Lanterns on posts at the places, towards the middle.
  for (const p of Object.values(PLACES)) {
    const a = Math.atan2(RING.x - p.x, RING.z - p.z), x = p.x + Math.sin(a) * (p.r - 1), z = p.z + Math.cos(a) * (p.r - 1);
    kit.add(bark, cyl(0.12, 0.16, 2.6, 6), x, 0, z).add(gold, cyl(0.2, 0.2, 0.1, 6), x, 2.6, z);
    glowSpots.push({ x, y: 2.85, z, size: 1.8 });
  }
  kit.build(g, own);

  const glows = new Glows(glowSpots, 0xffb050, 1.5);
  g.add(glows.group);
  own.push(glows);

  // Fireflies over the whole wood.
  const FLIES = 140, base = new Float32Array(FLIES * 3), pos = new Float32Array(FLIES * 3), ph = new Float32Array(FLIES * 3);
  for (let i = 0; i < FLIES; i++) {
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * (ZONE_R - 3);
    base[i * 3] = RING.x + Math.cos(a) * d; base[i * 3 + 1] = 0.6 + rnd() * 2.6; base[i * 3 + 2] = RING.z + Math.sin(a) * d;
    ph[i * 3] = rnd() * 6.28; ph[i * 3 + 1] = rnd() * 6.28; ph[i * 3 + 2] = 0.2 + rnd() * 0.35;
  }
  pos.set(base);
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = glowDot();
  const flyMat = new THREE.PointsMaterial({ map: dot, color: 0xffd070, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flies = new THREE.Points(flyGeo, flyMat);
  flies.frustumCulled = false;
  g.add(flies);
  own.push(flyGeo, dot, flyMat);

  return {
    group: g,
    update(_dt, time) {
      glows.update(time);
      for (let i = 0; i < FLIES; i++) {
        const s = ph[i * 3 + 2];
        pos[i * 3] = base[i * 3] + Math.sin(time * s + ph[i * 3]) * 1.6;
        pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(time * s * 1.7 + ph[i * 3 + 1]) * 0.45;
        pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(time * s * 0.8 + ph[i * 3]) * 1.6;
      }
      flyGeo.attributes.position.needsUpdate = true;
      flyMat.opacity = 0.75 + 0.2 * Math.sin(time * 2.3);
    },
    dispose() {
      g.removeFromParent();
      for (const o of own) o.dispose();
    },
  };
}

export const woodArena: ArenaDef = {
  id: 'tower-zone-wood',
  name: 'The Walking Wood, a zone',
  ring: ZONE_R,
  obstacles: ZONE_COVER,
  stage: STAGE,
  hideGround: true,
  build() {
    const z = buildWood();
    return { group: z.group, update: z.update, dispose: z.dispose };
  },
};
