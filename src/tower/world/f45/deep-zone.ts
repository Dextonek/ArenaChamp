import * as THREE from 'three';
import { RING, canvasTexture, flatRing, floorDisc, seeded } from '../../../arenas/common';
import { cavernArena } from '../../../arenas/cavern';
import { Glows } from '../../../arenas/real';
import type { ArenaDef, ArenaStage } from '../../../arenas/types';
import type { Obstacle } from '../../../obstacles';
import type { PlaceDef } from '../def';
import { Kit, P, W, at, box, cyl, frame, px, pz, scatter, type Path, type Piece } from './zonekit';

/**
 * Floor 4's zone, The Lightless Deep, in Crystal Cavern's look (src/arenas/cavern.ts): slate flagstones and a mine track, pit timber, pale
 * stalagmites, amethyst prisms and a cool light in the crystals; its own colour beside the shared palette is amethyst. About 48 m
 * across: a lit camp in the south, a cart yard in the middle, three halls with a dark crystal each, and the glow pools, joined by the
 * mine's track. Drawn in code from clean forms in flat materials, merged into a few meshes: a first pass for the artist to direct.
 * Where each thing stands is exported for the floor's data (`floors/deep.ts`), so the picture and the data cannot drift apart.
 */
export const DEEP_R = 48;
const OUT = -0.6, BORDER = 0.9;

export const DEEP_PLACES: Record<'camp' | 'hall1' | 'hall2' | 'hall3' | 'pools' | 'yard', PlaceDef> = {
  camp: { id: 'camp', name: 'The lamp camp', ...at(0, 34), r: 7, stand: at(0, 37.5) },
  hall1: { id: 'hall1', name: 'The first hall', ...at(-28, 10), r: 8, stand: at(-22, 13) },
  hall2: { id: 'hall2', name: 'The second hall', ...at(-14, -24), r: 8, stand: at(-10, -20) },
  hall3: { id: 'hall3', name: 'The third hall', ...at(24, -14), r: 8, stand: at(20, -10) },
  pools: { id: 'pools', name: 'The glow pools', ...at(27, 18), r: 8, stand: at(24, 22) },
  yard: { id: 'yard', name: 'The cart yard', ...at(0, -4), r: 7, stand: at(4, 0) },
};
/** The three dark crystals, the great shards that wake them (each in the hall before), the survey lamp and the race's goal. */
export const SPOTS = {
  crystal1: at(-34, 8), crystal2: at(-14, -30.5), crystal3: at(30, -17),
  shard1: at(6.5, 30.5), shard2: at(-23, 13.5), shard3: at(-10, -20),
  lamp: at(14, 6), echo: at(12, -22), shaft: at(-3, -17),
  start: at(0, 39.5),
  way1: at(-18, 8), way2: at(8, -10), way3: at(18, 16),
  cache1: at(-43, -8), cache2: at(41, 2), cache3: at(8, -37), lore: at(-33, -28),
  trial: at(-38, 24), gate: at(16, 38),
};

const PATHS: Path[] = [
  [[-3, 29], [-14, 22], [-22, 15]], [[4, 29], [16, 24], [24, 21]], [[0, 28], [0, 14], [1, 3]],
  [[-4, -8], [-10, -15], [-12, -20]], [[5, -8], [14, -11], [20, -12]],
  [[-27, 3], [-24, -8], [-18, -19]], [[27, -8], [28, 2], [27, 12]], [[-9, -29], [-4, -37], [0, -40]], [[21, -21], [11, -33], [3, -39]],
];

const arcAt = (cx: number, cz: number, face: number, R: number, degs: number[], make: (x: number, z: number, deg: number) => Piece) => degs.map((d) => {
  const a = face + (d * Math.PI) / 180;
  return make(cx + Math.sin(a) * R, cz + Math.cos(a) * R, d);
});

function pieces(): Piece[] {
  const L: Piece[] = [];
  // The camp: a fire, two lean-tos of pit timber, supplies, the cradle the first great shard lies in.
  L.push(P('fire', 0, 33.5, 0.9, 0.9), P('hut', -8.5, 36.5, 1.7, 2.4), P('hut', 8.5, 32.5, 1.7, 2.4), P('crate', -5, 30, 0.8, 1.2), P('crate', 5.4, 36.2, 0.8, 1.2), P('timber', 11, 38, 1.0, 1.6));
  L.push(P('cradle', 6.5, 30.5, 0.7, 0.9));
  // The halls: a horseshoe of stalagmites round the back of each, its crystal in the middle of the back. The front is open to the camp's side.
  const hall = (id: 'hall1' | 'hall2' | 'hall3', face: number, crystal: { x: number; z: number }) => {
    const h = DEEP_PLACES[id], cx = h.x - RING.x, cz = h.z - RING.z;
    L.push(...arcAt(cx, cz, face, 6.9, [-62, -36, 36, 62, 88, -88], (x, z, d) => P(Math.abs(d) > 80 ? 'column' : 'stal', x, z, Math.abs(d) > 80 ? 0.9 : 1.1, Math.abs(d) > 80 ? 5.4 : 3.4)));
    L.push(P('great', crystal.x - RING.x, crystal.z - RING.z, 1.1, 5.2));
  };
  hall('hall1', -Math.PI / 2 - 0.1, SPOTS.crystal1);
  hall('hall2', Math.PI, SPOTS.crystal2);
  hall('hall3', Math.PI * 0.72, SPOTS.crystal3);
  // The cart yard in the middle: a loaded mine cart on its track, two stacks of timber, a winch frame.
  L.push(P('cart', 0, -4, 1.5, 1.3), P('timber', -4.5, -1.5, 1.1, 1.6), P('timber', 4.2, -7.4, 1.1, 1.6), P('column', -6.4, -7.4, 0.8, 4.6), P('column', 6.2, 1.6, 0.8, 4.6));
  // The glow pools: rocks round two pools; the pools themselves are the floor's own drawing.
  L.push(P('rock', 22, 14, 1.3, 1.8), P('rock', 34, 15, 1.4, 2.2), P('rock', 30, 24, 1.2, 1.6), P('crystal', 33, 20, 0.9, 2.4), P('crystal', 21, 25, 0.8, 2.0));
  // The shaft where Isolde's satchel lies, and the echo well.
  L.push(P('timber', -5, -15, 1.0, 1.6), P('timber', -1.2, -18.4, 1.0, 1.6), P('column', 14, -20, 0.8, 4.2), P('column', 10, -24, 0.8, 4.2));
  // The lair: a long wall of fallen rock across the north with a gap in the middle (the door is the floor's: floors/deep.ts).
  L.push(W('wall', -26, -41, -3.4, -41, 0.5, 4.4), W('wall', 3.4, -41, 26, -41, 0.5, 4.4));
  // Filler: stalagmites, prisms and rocks off the track, so that a way across has to bend.
  const places = [...Object.values(DEEP_PLACES).map((p) => ({ dx: p.x - RING.x, dz: p.z - RING.z, r: p.r + 1.5 }))];
  const keep = Object.values(SPOTS).map((s) => ({ dx: s.x - RING.x, dz: s.z - RING.z, r: 3.2 }));
  L.push(...scatter({
    seed: 4142, n: 36, ring: DEEP_R, rim: 3.5, paths: PATHS, clear: 3.0, places, keep, gap: 4.2,
    make: (rnd, dx, dz) => (rnd() < 0.4 ? P('stal', dx, dz, 0.8 + rnd() * 0.6, 2.4 + rnd() * 2.2) : rnd() < 0.6 ? P('rock', dx, dz, 1.1 + rnd() * 0.7, 1.5 + rnd()) : P('crystal', dx, dz, 0.8 + rnd() * 0.4, 1.8 + rnd() * 1.4)),
  }));
  return L;
}
const PIECES = pieces();
export const DEEP_COVER: Obstacle[] = PIECES.map((p) => p.o);

const STAGE: ArenaStage = { ...cavernArena.stage, fogNear: 38, fogFar: 120 };
const FLAG = [38, 40, 52];

function groundTexture() {
  return canvasTexture(2048, (g, size) => {
    const rnd = seeded(51), c = size / 2, ppm = size / (2 * DEEP_R);
    g.fillStyle = '#12121a';
    g.fillRect(0, 0, size, size);
    const slab = (x0: number, z0: number, w: number, h: number, base: number[], spread: number) => {
      const t = 1 - spread + 2 * spread * rnd(), cool = (rnd() - 0.5) * 8;
      g.fillStyle = `rgb(${Math.round(base[0] * t + cool * 0.5)},${Math.round(base[1] * t - cool * 0.3)},${Math.round(base[2] * t + cool)})`;
      g.fillRect(px(x0, c, ppm) + 1, pz(z0, c, ppm) + 1, w * ppm - 2, h * ppm - 2);
    };
    for (let z = RING.z - DEEP_R; z < RING.z + DEEP_R; z += 2.6) for (let x = RING.x - DEEP_R; x < RING.x + DEEP_R; x += 2.6) slab(x + (((z / 2.6) | 0) % 2) * 1.3, z, 2.6, 2.6, FLAG, 0.16);
    for (const pl of Object.values(DEEP_PLACES)) {
      g.save();
      g.beginPath();
      g.arc(px(pl.x, c, ppm), pz(pl.z, c, ppm), pl.r * ppm, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#0d0d14';
      g.fillRect(px(pl.x - pl.r, c, ppm), pz(pl.z - pl.r, c, ppm), pl.r * 2 * ppm, pl.r * 2 * ppm);
      for (let z = pl.z - pl.r; z < pl.z + pl.r; z += 1.15) for (let x = pl.x - pl.r; x < pl.x + pl.r; x += 1.15) slab(x + (((z / 1.15) | 0) % 2) * 0.58, z, 1.15, 1.15, [66, 66, 86], 0.16);
      g.restore();
      g.strokeStyle = '#7a6030';
      g.lineWidth = 0.1 * ppm;
      g.beginPath();
      g.arc(px(pl.x, c, ppm), pz(pl.z, c, ppm), (pl.r - 0.3) * ppm, 0, Math.PI * 2);
      g.stroke();
    }
    // the mine's track along each path: a dark bed, timber sleepers across, two iron rails
    g.lineCap = g.lineJoin = 'round';
    for (const path of PATHS) {
      const trace = () => {
        g.beginPath();
        path.forEach(([dx, dz], i) => (i ? g.lineTo(px(RING.x + dx, c, ppm), pz(RING.z + dz, c, ppm)) : g.moveTo(px(RING.x + dx, c, ppm), pz(RING.z + dz, c, ppm))));
      };
      g.strokeStyle = '#0c0c12';
      g.lineWidth = 3.6 * ppm;
      trace();
      g.stroke();
      g.strokeStyle = '#3a3a50';
      g.lineWidth = 3.0 * ppm;
      trace();
      g.stroke();
      g.strokeStyle = 'rgb(76,52,36)';
      g.lineWidth = 2.2 * ppm;
      g.setLineDash([0.22 * ppm, 0.7 * ppm]);
      trace();
      g.stroke();
      g.setLineDash([]);
      for (const [w, col] of [[0.55, '#6a6c7c'], [0.2, '#9a9cac']] as const) {
        g.strokeStyle = col;
        g.lineWidth = 0.08 * ppm;
        for (const off of [-w, w]) {
          g.beginPath();
          path.forEach(([dx, dz], i) => {
            const j = Math.min(path.length - 1, i + 1), k = Math.max(0, i - 1), nx = -(path[j][1] - path[k][1]), nz = path[j][0] - path[k][0], nl = Math.hypot(nx, nz) || 1;
            const X = px(RING.x + dx + (nx / nl) * off, c, ppm), Z = pz(RING.z + dz + (nz / nl) * off, c, ppm);
            if (i) g.lineTo(X, Z); else g.moveTo(X, Z);
          });
          g.stroke();
        }
      }
    }
    // the glow pools: cool light let into the floor
    g.fillStyle = 'rgba(80,190,255,0.5)';
    for (const [dx, dz, rx, rz] of [[24, 14.5, 3.2, 1.9], [31, 20, 2.6, 1.6]]) {
      g.beginPath();
      g.ellipse(px(RING.x + dx, c, ppm), pz(RING.z + dz, c, ppm), rx * ppm, rz * ppm, 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#7a6030';
    g.lineWidth = 0.14 * ppm;
    g.beginPath();
    g.arc(c, pz(RING.z, c, ppm), (DEEP_R - 0.9) * ppm, 0, Math.PI * 2);
    g.stroke();
  });
}

function blockTexture() {
  return canvasTexture(512, (g, size) => {
    const rnd = seeded(9), rows = 4, h = size / rows;
    g.fillStyle = '#14141b';
    g.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      const n = 3, w = size / n, off = (r % 2) * (w / 2);
      for (let k = -1; k < n; k++) {
        const t = 0.8 + 0.3 * rnd();
        g.fillStyle = `rgb(${Math.round(FLAG[0] * t)},${Math.round(FLAG[1] * t)},${Math.round(FLAG[2] * t)})`;
        g.fillRect(off + k * w + 3, r * h + 3, w - 6, h - 6);
      }
    }
  });
}

function borderGeometry() {
  const r = DEEP_R;
  const profile = [[r + BORDER + 0.16, OUT - 0.4], [r + BORDER + 0.05, -0.07], [r + BORDER - 0.02, 0.006], [r - 0.05, 0.006]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 256);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 60, uv.getY(i) * 1.6);
  geo.translate(RING.x, 0, RING.z);
  return geo;
}

/** Builds the zone's meshes. */
export function buildDeepZone(): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const mat = (color: number, rough = 0.85, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, ...o });
    own.push(m);
    return m;
  };
  const stone = mat(0x484a5e), rock = mat(0x34364a, 0.95), wood = mat(0x4a3626), darkWood = mat(0x2a1f1a), pale = mat(0xb8b2cc, 0.7), cloth = mat(0x4a3a6a, 0.95, { side: THREE.DoubleSide });
  const gold = mat(0xc9a24a, 0.4, { metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.22 });
  const iron = mat(0x23252c, 0.55, { metalness: 0.5 });
  const amethyst = mat(0x7a52c8, 0.4, { emissive: 0x5a30b0, emissiveIntensity: 0.5 });
  const greatMat = mat(0x6a48b8, 0.35, { emissive: 0x4a2ca0, emissiveIntensity: 0.6 });
  const bright = new THREE.MeshBasicMaterial({ color: 0x7ad8ff });
  own.push(bright);

  const flags = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.55, envMapIntensity: 0.3 });
  const floor = floorDisc(DEEP_R, flags, 0.012, 192);
  const border = new THREE.Mesh(borderGeometry(), new THREE.MeshStandardMaterial({ map: blockTexture(), color: 0xf0f0ff, roughness: 0.75, envMapIntensity: 0.2 }));
  border.receiveShadow = true;
  const cave = floorDisc(150, mat(0x1b1c26, 0.9), OUT, 72);
  const line = flatRing(DEEP_R + 0.3, DEEP_R + 0.4, 0x9a7a38, 1, 0.014, 192);
  g.add(floor, border, cave, line);
  own.push(floor.geometry, flags.map!, flags, border.geometry, (border.material as THREE.MeshStandardMaterial).map!, border.material as THREE.Material, cave.geometry, line.geometry, line.material as THREE.Material);

  const kit = new Kit();
  const rnd = seeded(77);
  const glowWarm: { x: number; y: number; z: number; size?: number }[] = [];
  const glowCool: { x: number; y: number; z: number; size?: number }[] = [];
  const prism = (m: THREE.Material, x: number, z: number, s: number, h: number, yaw = 0, lean = 0) => {
    kit.add(m, new THREE.OctahedronGeometry(1).scale(0.42 * s, h * 0.5, 0.42 * s).translate(0, h * 0.5, 0), x, 0, z, yaw, 1, 1, 1, lean, lean * 0.7);
  };

  for (const { look, o } of PIECES) {
    const { yaw, len, mx, mz, r, h } = frame(o);
    switch (look) {
      case 'crate':
        kit.add(wood, box(r * 2, h, r * 2), o.ax, 0, o.az, rnd() * 3).add(gold, box(r * 2.06, 0.08, r * 2.06), o.ax, h * 0.5, o.az, 0);
        break;
      case 'timber':
        for (let k = 0; k < 4; k++) kit.add(wood, cyl(0.16, 0.16, r * 2.2, 6), o.ax + (k % 2 ? 0.2 : -0.2), 0.2 + Math.floor(k / 2) * 0.35, o.az, 0, 1, 1, 1, 0, Math.PI / 2).add(darkWood, cyl(0.12, 0.12, r * 2, 5), o.ax + (k % 2 ? 0.1 : -0.1), 0.2 + (k > 1 ? 0.5 : 0), o.az + 0.25, 1.0, 1, 1, 1, 0, Math.PI / 2);
        kit.add(darkWood, box(r * 2.2, h * 0.5, 0.15), o.ax, 0, o.az - 0.6, 0.4);
        break;
      case 'hut':
        kit.add(cloth, new THREE.ConeGeometry(r * 1.25, h * 1.3, 4).translate(0, h * 0.65, 0), o.ax, 0, o.az, rnd() * 3).add(darkWood, cyl(0.06, 0.06, h * 1.8, 4), o.ax, 0, o.az).add(gold, new THREE.ConeGeometry(r * 1.27, 0.25, 4).translate(0, 0.13, 0), o.ax, 0, o.az, 0);
        break;
      case 'fire':
        kit.add(rock, cyl(r, r * 1.1, 0.35, 8), o.ax, 0, o.az).add(darkWood, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 0.3, 1, 1, 1, 0.8).add(darkWood, cyl(0.1, 0.1, 1, 5), o.ax, 0.3, o.az, 2.4, 1, 1, 1, 0.8);
        kit.add(gold, new THREE.ConeGeometry(0.35, 0.9, 6).translate(0, 0.85, 0), o.ax, 0, o.az);
        glowWarm.push({ x: o.ax, y: 1.2, z: o.az, size: 7 });
        break;
      case 'cradle':
        kit.add(stone, cyl(r, r * 1.2, 0.5, 8), o.ax, 0, o.az).add(gold, cyl(r * 1.05, r * 1.05, 0.08, 8), o.ax, 0.5, o.az);
        prism(greatMat, o.ax, o.az, 0.55, 1.5, 0.3, 0.1);
        glowCool.push({ x: o.ax, y: 1.1, z: o.az, size: 3.2 });
        break;
      case 'cart':
        kit.add(iron, box(r * 1.5, 0.75, r * 1.0), o.ax, 0.25, o.az, 0.4).add(gold, box(r * 1.58, 0.07, r * 1.08), o.ax, 0.98, o.az, 0.4);
        for (const [dx, dz] of [[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.4], [0.55, 0.4]]) kit.add(darkWood, cyl(0.26, 0.26, 0.14, 8), o.ax + dx, 0.05, o.az + dz, 0.4, 1, 1, 1, 0, Math.PI / 2);
        for (const [dx, dz, s] of [[-0.3, 0, 0.7], [0.25, 0.1, 0.9], [0, -0.3, 0.6]] as const) prism(amethyst, o.ax + dx, o.az + dz, s, 0.9 * s + 0.7, rnd() * 3);
        glowCool.push({ x: o.ax, y: 1.4, z: o.az, size: 2.6 });
        break;
      case 'stal':
        kit.add(pale, new THREE.ConeGeometry(r, h, 7).translate(0, h / 2, 0), o.ax, 0, o.az, rnd() * 3).add(pale, new THREE.ConeGeometry(r * 0.55, h * 0.55, 6).translate(0, h * 0.27, 0), o.ax + r * 0.9, 0, o.az - r * 0.3, rnd() * 3);
        break;
      case 'column':
        kit.add(pale, cyl(r * 0.8, r, h, 9), o.ax, 0, o.az).add(stone, cyl(r * 1.25, r * 1.25, 0.3, 9), o.ax, 0, o.az);
        break;
      case 'rock': {
        const k = new THREE.IcosahedronGeometry(1, 0);
        kit.add(rock, k, o.ax, h * 0.3, o.az, rnd() * 6, r * 1.1, h * 0.7, r * 1.1).add(rock, k, o.ax + r * 0.5, h * 0.12, o.az - r * 0.3, rnd() * 6, r * 0.6, h * 0.38, r * 0.6);
        break;
      }
      case 'crystal':
        prism(amethyst, o.ax, o.az, r * 1.1, h, rnd() * 3, 0.06);
        prism(amethyst, o.ax + r * 0.8, o.az + r * 0.3, r * 0.7, h * 0.65, rnd() * 3, -0.18);
        prism(amethyst, o.ax - r * 0.6, o.az + r * 0.5, r * 0.55, h * 0.5, rnd() * 3, 0.25);
        if (rnd() < 0.35) glowCool.push({ x: o.ax, y: h * 0.55, z: o.az, size: 2.0 });
        break;
      case 'great':
        // The great crystals: a dark crown of prisms on a rock foot. Asleep, only a faint violet; a woken one is lit by the dark law.
        kit.add(rock, new THREE.IcosahedronGeometry(1, 0), o.ax, 0.4, o.az, rnd() * 3, r * 1.5, 0.7, r * 1.5);
        prism(greatMat, o.ax, o.az, r * 1.6, h, 0.2);
        prism(greatMat, o.ax + 0.9, o.az + 0.4, r * 0.9, h * 0.6, 1, -0.25);
        prism(greatMat, o.ax - 0.8, o.az + 0.5, r * 0.8, h * 0.5, 2, 0.3);
        break;
      case 'wall': {
        kit.add(rock, box(r * 2, h, len + r * 2), mx, 0, mz, yaw).add(stone, box(r * 2.4, 0.3, len + r * 2.4), mx, h, mz, yaw);
        for (let k = 0; k < len / 4; k++) kit.add(rock, new THREE.IcosahedronGeometry(1, 0), mx + Math.sin(yaw) * (k * 4 - len / 2 + 2), h + 0.4, mz + Math.cos(yaw) * (k * 4 - len / 2 + 2), rnd() * 3, 1.3, 1.0, 1.3);
        break;
      }
    }
  }
  // Pit timber lamps at each plaza's rim, towards the middle, and posts along the rim.
  for (const pl of Object.values(DEEP_PLACES)) {
    const a = Math.atan2(RING.x - pl.x, RING.z - pl.z), x = pl.x + Math.sin(a) * (pl.r - 1), z = pl.z + Math.cos(a) * (pl.r - 1);
    kit.add(darkWood, cyl(0.12, 0.16, 2.6, 6), x, 0, z).add(gold, cyl(0.2, 0.2, 0.1, 6), x, 2.6, z);
    glowWarm.push({ x, y: 2.85, z, size: 1.8 });
  }
  // The pools' glimmer and the crystals along the rim, outside it: prisms, columns, dark rock far out.
  for (const [dx, dz] of [[24, 14.5], [31, 20]]) glowCool.push({ x: RING.x + dx, y: 0.5, z: RING.z + dz, size: 4 });
  for (let k = 0; k < 26; k++) {
    const a = rnd() * Math.PI * 2, d = 52 + rnd() * 40, s = 1.4 + rnd() * 2.2, h = 4 + rnd() * 9, x = RING.x + Math.sin(a) * d, z = RING.z + Math.cos(a) * d;
    if (k % 3 === 0) prism(amethyst, x, z, s, h, rnd() * 3, 0.1);
    else kit.add(rock, new THREE.ConeGeometry(s * 1.4, h, 6).translate(0, h / 2, 0), x, OUT, z, rnd() * 3);
    if (k % 3 === 0 && glowCool.length < 22) glowCool.push({ x, y: h * 0.5, z, size: 3.5 });
  }
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2 + 0.07, x = RING.x + Math.sin(a) * (DEEP_R - 0.9), z = RING.z + Math.cos(a) * (DEEP_R - 0.9);
    kit.add(darkWood, cyl(0.13, 0.17, 2.2, 6), x, 0, z).add(gold, cyl(0.2, 0.2, 0.1, 6), x, 2.2, z);
    if (k % 2 === 0) glowWarm.push({ x, y: 2.45, z, size: 1.2 });
  }
  void iron;
  kit.build(g, own);

  const warm = new Glows(glowWarm, 0xffa040, 1.5), cool = new Glows(glowCool, 0x5c3ab8, 1.5);
  g.add(warm.group, cool.group);
  own.push(warm, cool);

  return {
    group: g,
    update(_dt, time) { warm.update(time); cool.update(time); },
    dispose() {
      g.removeFromParent();
      for (const o of own) o.dispose();
    },
  };
}

export const deepArena: ArenaDef = {
  id: 'tower-zone-deep',
  name: 'The Lightless Deep, a zone',
  ring: DEEP_R,
  obstacles: DEEP_COVER,
  stage: STAGE,
  hideGround: true,
  build() {
    const z = buildDeepZone();
    return { group: z.group, update: z.update, dispose: z.dispose };
  },
};
