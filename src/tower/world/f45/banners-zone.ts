import * as THREE from 'three';
import { RING, canvasTexture, flatRing, floorDisc, seeded } from '../../../arenas/common';
import { battlefieldArena } from '../../../arenas/battlefield';
import { Glows } from '../../../arenas/real';
import type { ArenaDef, ArenaStage } from '../../../arenas/types';
import type { Obstacle } from '../../../obstacles';
import type { PlaceDef } from '../def';
import { Kit, P, W, at, box, cyl, frame, px, pz, scatter, type Path, type Piece } from './zonekit';

/**
 * Floor 5's zone, The Field of Banners, in the Fallen Battlefield's look (src/arenas/battlefield.ts): trodden earth in broad patches, an old
 * paved road, paved rounds with brass rings at the places, a stone kerb, a heavy evening and light rain; its own colour beside the shared
 * palette is the banners' blue (and here the other army's crimson). About 48 m across: a camp in the south, the west and east ridges, the
 * hill in the middle, the north works, the burned wagons and the siege line across the north. The banners themselves are the law's
 * (`laws.ts`): the zone is drawn once for either choice. Clean forms in flat materials merged into a few meshes: a first pass for the artist.
 */
export const BANNERS_R = 48;
const KERB = 0.6, APRON = 130;

export const BANNER_PLACES: Record<'camp' | 'west' | 'east' | 'hill' | 'north' | 'wagons' | 'siege', PlaceDef> = {
  camp: { id: 'camp', name: 'The camp', ...at(0, 34), r: 7, stand: at(0, 37.5) },
  west: { id: 'west', name: 'The west ridge', ...at(-30, 8), r: 8, stand: at(-26, 11) },
  east: { id: 'east', name: 'The east ridge', ...at(31, 10), r: 8, stand: at(27, 13) },
  hill: { id: 'hill', name: 'The hill', ...at(0, -8), r: 9, stand: at(0, -2.5) },
  north: { id: 'north', name: 'The north works', ...at(22, -26), r: 8, stand: at(20, -22) },
  wagons: { id: 'wagons', name: 'The burned wagons', ...at(-22, -20), r: 8, stand: at(-18, -17) },
  siege: { id: 'siege', name: 'The siege line', ...at(0, -34), r: 8, stand: at(0, -30) },
};
export const SPOTS = {
  start: at(0, 39.5),
  standardW: at(-30, 8), standardE: at(31, 10), standardN: at(22, -26),
  hill: at(0, -8),
  standW: at(-12.5, 30), standE: at(12.5, 30),
  cloth: at(-22, -16), tent: at(-6, 33), brazier1: at(14, 12), brazier2: at(-12, 21),
  rival: at(-26, -30),
  way1: at(-17, 14), way2: at(14, -12), way3: at(24, 18),
  cache1: at(-44, -2), cache2: at(42, -4), cache3: at(8, -38.5),
  lore: at(36, 28), trial: at(-38, 26), gate: at(16, 38),
};

const PATHS: Path[] = [
  [[-3, 29], [-14, 22], [-24, 13], [-27, 10]], [[3, 29], [15, 24], [26, 15], [28, 12]], [[0, 28], [0, 14], [0, 0]],
  [[4, -13], [14, -20], [19, -23]], [[-4, -13], [-12, -17], [-17, -19]], [[0, -17], [0, -26], [0, -30]],
  [[30, 2], [28, -10], [24, -20]], [[-22, -25], [-25, -28]],
];

function pieces(): Piece[] {
  const L: Piece[] = [];
  // The camp: a brazier fire, two pavilions, supplies, the stands' spears are the law's.
  L.push(P('fire', 0, 33.5, 0.9, 0.9), P('tent', -8.5, 36.5, 1.8, 2.8), P('tent', 8.5, 32.5, 1.8, 2.8), P('crate', -5, 30, 0.8, 1.2), P('crate', 5.4, 36.2, 0.8, 1.2), P('drum', 3.2, 29.6, 0.7, 0.9));
  // The ridges: a standard on its stone foot in the middle, a sill of great shields across the back, spears planted.
  for (const [id, face] of [['west', -Math.PI / 2], ['east', Math.PI / 2]] as const) {
    const p = BANNER_PLACES[id], cx = p.x - RING.x, cz = p.z - RING.z, s = Math.sin(face), c = Math.cos(face);
    L.push(P('standard', cx, cz, 0.9, 5));
    L.push(W('shield', cx + s * 6.4 - c * 3.2, cz + c * 6.4 + s * 3.2, cx + s * 6.4 + c * 3.2, cz + c * 6.4 - s * 3.2, 0.35, 1.5));
    L.push(P('rock', cx + s * 3 + c * 5.5, cz + c * 3 - s * 5.5, 1.2, 1.5), P('rock', cx + s * 3 - c * 5.5, cz + c * 3 + s * 5.5, 1.2, 1.5));
  }
  // The hill: a drum in the middle, shields fallen round it, two standards with no cloth.
  L.push(P('drum', 0, -8, 1.1, 1.2), P('shieldpile', 4.5, -10.5, 0.9, 0.9), P('shieldpile', -4.2, -5.5, 0.9, 0.9), P('standard', -7, -9.5, 0.7, 4.4), P('standard', 7, -6.5, 0.7, 4.4));
  // The north works: two catapults with the arm down, a wagon, a standard in the middle.
  L.push(P('standard', 22, -26, 0.9, 5), P('catapult', 15, -29.5, 1.5, 1.8), P('catapult', 28.5, -29, 1.5, 1.8), W('wagon', 26, -21, 29.5, -19.5, 0.9, 1.4));
  // The burned wagons: three wagons on their sides, a tent, planted spears.
  L.push(W('wagon', -27, -22, -23.5, -23.5, 0.9, 1.5), W('wagon', -19.5, -25.5, -16.5, -24, 0.9, 1.5), W('wagon', -26, -15.5, -24.5, -18.5, 0.9, 1.5), P('tent', -17, -15.5, 1.5, 2.4));
  // The siege line: a long palisade across the north with a gate in the middle (the door is the floor's), a siege tower fallen along the left.
  L.push(W('palisade', -26, -41, -3.4, -41, 0.5, 3.8), W('palisade', 3.4, -41, 26, -41, 0.5, 3.8), W('tower', -20, -34.5, -10, -37, 1.5, 3.2));
  L.push(P('stake', -4, -36, 0.5, 1.5), P('stake', 4.5, -37, 0.5, 1.5), P('catapult', 12, -36.5, 1.4, 1.8));
  // Brannoc's ground, between the lines: a shield sill on each side of the door's approach.
  L.push(W('shield', -29.5, -27, -29.5, -24.5, 0.35, 1.5), W('shield', -22.5, -27.5, -22.5, -25, 0.35, 1.5));
  // Filler: stake hedges, planted spears, rocks, crates, shields.
  const places = Object.values(BANNER_PLACES).map((p) => ({ dx: p.x - RING.x, dz: p.z - RING.z, r: p.r + 1.5 }));
  const keep = Object.values(SPOTS).map((s) => ({ dx: s.x - RING.x, dz: s.z - RING.z, r: 3.2 }));
  L.push(...scatter({
    seed: 5151, n: 34, ring: BANNERS_R, rim: 3.5, paths: PATHS, clear: 3.0, places, keep, gap: 4.4,
    make: (rnd, dx, dz) => (rnd() < 0.4 ? P('rock', dx, dz, 1.0 + rnd() * 0.6, 1.3 + rnd()) : rnd() < 0.55 ? P('stake', dx, dz, 0.5, 1.4) : rnd() < 0.8 ? P('crate', dx, dz, 0.8, 1.2) : P('shieldpile', dx, dz, 0.9, 0.9)),
  }));
  return L;
}
const PIECES = pieces();
export const BANNERS_COVER: Obstacle[] = PIECES.map((p) => p.o);

const STAGE: ArenaStage = { ...battlefieldArena.stage, fogNear: 44, fogFar: 130 };
const EARTH = [42, 39, 37], SLAB = [41, 44, 52], JOINT = '#17181c', BRASS = '#7a6030', BEYOND = [27, 27, 30];
const tone = (c: number[], t: number, warm = 0) => `rgb(${Math.round(c[0] * t + warm)},${Math.round(c[1] * t)},${Math.round(c[2] * t - warm)})`;

function fieldTexture() {
  return canvasTexture(2048, (g, size) => {
    const rnd = seeded(61), c = size / 2, ppm = size / (2 * BANNERS_R);
    g.fillStyle = tone(EARTH, 1);
    g.fillRect(0, 0, size, size);
    // broad trodden patches
    for (let i = 0; i < 70; i++) {
      const x = (rnd() - 0.5) * 2 * BANNERS_R, z = (rnd() - 0.5) * 2 * BANNERS_R, r = 2.5 + rnd() * 5, lobes = Array.from({ length: 7 }, () => 0.72 + 0.5 * rnd());
      g.fillStyle = tone(EARTH, rnd() < 0.5 ? 0.84 + 0.06 * rnd() : 1.06 + 0.06 * rnd());
      g.beginPath();
      lobes.forEach((l, k) => {
        const b = (k / lobes.length) * Math.PI * 2;
        const X = px(RING.x + x + Math.cos(b) * r * l * 1.25, c, ppm), Z = pz(RING.z + z + Math.sin(b) * r * l, c, ppm);
        if (k) g.lineTo(X, Z); else g.moveTo(X, Z);
      });
      g.closePath();
      g.fill();
    }
    // the old paved road along each path: two rows of slabs, a few gone
    g.lineCap = g.lineJoin = 'round';
    for (const path of PATHS) {
      const trace = () => {
        g.beginPath();
        path.forEach(([dx, dz], i) => (i ? g.lineTo(px(RING.x + dx, c, ppm), pz(RING.z + dz, c, ppm)) : g.moveTo(px(RING.x + dx, c, ppm), pz(RING.z + dz, c, ppm))));
      };
      g.strokeStyle = tone(EARTH, 0.78);
      g.lineWidth = 3.6 * ppm;
      trace();
      g.stroke();
      g.strokeStyle = tone(SLAB, 0.85);
      g.lineWidth = 3.0 * ppm;
      trace();
      g.stroke();
      g.strokeStyle = JOINT;
      g.lineWidth = 3.0 * ppm;
      g.setLineDash([0.07 * ppm, 1.5 * ppm]);
      trace();
      g.stroke();
      g.setLineDash([]);
    }
    // the paved rounds at the places: slabs in a ring, a brass line
    for (const pl of Object.values(BANNER_PLACES)) {
      const cx = px(pl.x, c, ppm), cz = pz(pl.z, c, ppm);
      g.save();
      g.beginPath();
      g.arc(cx, cz, pl.r * ppm, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = JOINT;
      g.fillRect(cx - pl.r * ppm, cz - pl.r * ppm, pl.r * 2 * ppm, pl.r * 2 * ppm);
      for (let z = pl.z - pl.r; z < pl.z + pl.r; z += 1.5) for (let x = pl.x - pl.r; x < pl.x + pl.r; x += 1.5) {
        if (rnd() < 0.1) continue;
        g.fillStyle = tone(SLAB, 0.92 + 0.22 * rnd(), (rnd() - 0.5) * 6);
        g.fillRect(px(x + (((z / 1.5) | 0) % 2) * 0.7, c, ppm) + 1, pz(z, c, ppm) + 1, 1.5 * ppm - 2, 1.5 * ppm - 2);
      }
      g.restore();
      g.strokeStyle = BRASS;
      g.lineWidth = 0.09 * ppm;
      g.beginPath();
      g.arc(cx, cz, (pl.r - 0.3) * ppm, 0, Math.PI * 2);
      g.stroke();
    }
    // mud and a brass ring near the rim
    g.fillStyle = 'rgba(20,18,20,0.4)';
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.ellipse(px(RING.x + (rnd() - 0.5) * 80, c, ppm), pz(RING.z + (rnd() - 0.5) * 80, c, ppm), (1.4 + rnd() * 2) * ppm, (0.8 + rnd()) * ppm, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = BRASS;
    g.lineWidth = 0.12 * ppm;
    g.beginPath();
    g.arc(c, pz(RING.z, c, ppm), (BANNERS_R - 0.9) * ppm, 0, Math.PI * 2);
    g.stroke();
  });
}

function blockTexture() {
  return canvasTexture(256, (g, size) => {
    const rnd = seeded(5), rows = 2, h = size / rows;
    g.fillStyle = JOINT;
    g.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      const n = 2, w = size / n, off = (r % 2) * (w / 2);
      for (let k = -1; k < n; k++) {
        g.fillStyle = tone(SLAB, 0.8 + 0.3 * rnd());
        g.fillRect(off + k * w + 2, r * h + 2, w - 4, h - 4);
      }
    }
  });
}

function kerbGeometry() {
  const r = BANNERS_R;
  const profile = [[r + KERB + 0.05, -0.2], [r + KERB, 0.1], [r + KERB - 0.08, 0.17], [r + 0.02, 0.17], [r - 0.05, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 256);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 60, uv.getY(i) * 1.0);
  geo.translate(RING.x, 0, RING.z);
  return geo;
}

/** Light rain: thin straight streaks on one slant, falling through a cylinder over the zone. */
class Rain {
  readonly lines: THREE.LineSegments;
  private pos: Float32Array;
  private speed: Float32Array;
  private readonly slant = new THREE.Vector3(0.12, -1, 0.05).normalize();
  constructor(private count = 420, private reach = 46, private top = 16) {
    this.pos = new Float32Array(count * 6);
    this.speed = new Float32Array(count);
    for (let i = 0; i < count; i++) this.drop(i, Math.random() * top);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb2d0, transparent: true, opacity: 0.24, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
  }
  private drop(i: number, y: number) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.reach;
    this.pos[i * 6] = RING.x + Math.cos(a) * r;
    this.pos[i * 6 + 1] = y;
    this.pos[i * 6 + 2] = RING.z + Math.sin(a) * r;
    this.speed[i] = 17 + Math.random() * 6;
  }
  update(dt: number) {
    const p = this.pos, s = this.slant;
    for (let i = 0; i < this.count; i++) {
      const d = this.speed[i] * Math.min(dt, 0.05);
      p[i * 6] += s.x * d; p[i * 6 + 1] += s.y * d; p[i * 6 + 2] += s.z * d;
      if (p[i * 6 + 1] < 0) this.drop(i, this.top);
      p[i * 6 + 3] = p[i * 6] - s.x * 0.85; p[i * 6 + 4] = p[i * 6 + 1] - s.y * 0.85; p[i * 6 + 5] = p[i * 6 + 2] - s.z * 0.85;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
  dispose() {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}

export function buildBannersZone(): { group: THREE.Group; update(dt: number, time: number): void; dispose(): void } {
  const g = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const mat = (color: number, rough = 0.85, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, ...o });
    own.push(m);
    return m;
  };
  const stone = mat(0x4a4e5a), rock = mat(0x3c3f48, 0.95), wood = mat(0x4a3626), darkWood = mat(0x2a1f1a), plank = mat(0x5a4632), canvas = mat(0x8a8a96, 0.95, { side: THREE.DoubleSide });
  const blue = mat(0x3558b0, 0.9, { side: THREE.DoubleSide }), steel = mat(0x7a7e8c, 0.45, { metalness: 0.5 });
  const gold = mat(0xc9a24a, 0.4, { metalness: 0.8, emissive: 0xffb050, emissiveIntensity: 0.2 });
  const iron = mat(0x23252c, 0.55, { metalness: 0.5 });

  const field = new THREE.MeshStandardMaterial({ map: fieldTexture(), roughness: 0.55, envMapIntensity: 0.3 });
  const floor = floorDisc(BANNERS_R, field, 0.012, 192);
  const stoneMat = new THREE.MeshStandardMaterial({ map: blockTexture(), color: 0xf0f2ff, roughness: 0.7, envMapIntensity: 0.2 });
  const kerb = new THREE.Mesh(kerbGeometry(), stoneMat);
  kerb.receiveShadow = true;
  const line = flatRing(BANNERS_R + 0.24, BANNERS_R + 0.33, 0x9a7a38, 1, 0.176, 192);
  const earth = new THREE.MeshStandardMaterial({ color: new THREE.Color(tone(BEYOND, 1)), roughness: 0.9, envMapIntensity: 0.15 });
  const apron = new THREE.Mesh(new THREE.RingGeometry(BANNERS_R + KERB - 0.1, APRON, 96, 1), earth);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(RING.x, 0, RING.z);
  apron.receiveShadow = true;
  g.add(floor, kerb, line, apron);
  own.push(floor.geometry, field.map!, field, kerb.geometry, stoneMat.map!, stoneMat, line.geometry, line.material as THREE.Material, apron.geometry, earth);

  const kit = new Kit();
  const rnd = seeded(913);
  const glowSpots: { x: number; y: number; z: number; size?: number }[] = [];
  for (const { look, o } of PIECES) {
    const { yaw, len, mx, mz, r, h } = frame(o);
    switch (look) {
      case 'crate':
        kit.add(plank, box(r * 2, h, r * 2), o.ax, 0, o.az, rnd() * 3).add(iron, box(r * 2.06, 0.08, r * 2.06), o.ax, h * 0.5, o.az, 0);
        break;
      case 'drum':
        kit.add(wood, cyl(r, r * 0.9, h, 10), o.ax, 0, o.az).add(gold, cyl(r * 1.04, r * 1.04, 0.07, 10), o.ax, h * 0.15, o.az).add(gold, cyl(r * 1.04, r * 1.04, 0.07, 10), o.ax, h * 0.85, o.az).add(canvas, cyl(r * 0.96, r * 0.96, 0.06, 10), o.ax, h, o.az);
        break;
      case 'rock': {
        const k = new THREE.IcosahedronGeometry(1, 0);
        kit.add(rock, k, o.ax, h * 0.3, o.az, rnd() * 6, r * 1.1, h * 0.7, r * 1.1).add(rock, k, o.ax + r * 0.5, h * 0.12, o.az - r * 0.3, rnd() * 6, r * 0.6, h * 0.38, r * 0.6);
        break;
      }
      case 'stake':
        for (let k = 0; k < 3; k++) kit.add(wood, new THREE.ConeGeometry(0.1, h, 5).translate(0, h / 2, 0), o.ax + (k - 1) * 0.28, 0, o.az + (k % 2) * 0.12, 0, 1, 1, 1, 0.35 * (k - 1), 0.1);
        break;
      case 'shieldpile':
        for (let k = 0; k < 4; k++) kit.add(k % 2 ? blue : steel, new THREE.CylinderGeometry(0.5, 0.5, 0.07, 7).translate(0, 0.1 + k * 0.1, 0), o.ax + (rnd() - 0.5) * 0.4, 0, o.az + (rnd() - 0.5) * 0.4, rnd() * 3, 1, 1, 1, (rnd() - 0.5) * 0.3);
        kit.add(wood, cyl(0.04, 0.04, 1.7, 4), o.ax + 0.3, 0.2, o.az, 0.4, 1, 1, 1, 0, 1.2);
        break;
      case 'standard': {
        // A banner standard on a stone foot, its cloth gone (the law flies the colours): a tall pole, a crossbar, a gold finial.
        kit.add(stone, cyl(r * 1.1, r * 1.3, 0.6, 7), o.ax, 0, o.az).add(wood, cyl(0.09, 0.11, h, 6), o.ax, 0.4, o.az).add(wood, box(1.5, 0.08, 0.08), o.ax, h - 0.5, o.az, 0.4);
        kit.add(gold, new THREE.ConeGeometry(0.16, 0.45, 5).translate(0, 0.22, 0), o.ax, h + 0.4, o.az);
        break;
      }
      case 'tent':
        kit.add(canvas, new THREE.ConeGeometry(r * 1.3, h * 1.3, 6).translate(0, h * 0.65, 0), o.ax, 0, o.az, rnd() * 3).add(blue, new THREE.ConeGeometry(r * 1.32, 0.35, 6).translate(0, 0.2, 0), o.ax, 0, o.az).add(gold, cyl(0.05, 0.05, h * 1.8, 4), o.ax, 0, o.az);
        break;
      case 'fire':
        kit.add(rock, cyl(r, r * 1.1, 0.35, 8), o.ax, 0, o.az).add(iron, cyl(0.5, 0.35, 0.5, 6), o.ax, 0.3, o.az).add(gold, new THREE.ConeGeometry(0.35, 0.9, 6).translate(0, 0.85, 0), o.ax, 0, o.az);
        glowSpots.push({ x: o.ax, y: 1.2, z: o.az, size: 7 });
        break;
      case 'shield': {
        // A sill of great shields across the back: a low stone sill, a row of big round shields standing on it, each its own tilt.
        kit.add(stone, box(r * 2.2, 0.32, len + r * 2), mx, 0, mz, yaw);
        const n = Math.max(2, Math.round(len / 1.5));
        for (let k = 0; k < n; k++) {
          const t = n === 1 ? 0.5 : k / (n - 1), x = o.ax + (o.bx - o.ax) * t, z = o.az + (o.bz - o.az) * t;
          kit.add(k % 2 ? blue : steel, new THREE.CylinderGeometry(0.78, 0.78, 0.1, 8).rotateX(Math.PI / 2).translate(0, 0.85, 0), x, 0.3, z, yaw + Math.PI / 2, 1, 1, 1, 0, (rnd() - 0.5) * 0.18);
          kit.add(gold, new THREE.SphereGeometry(0.16, 6, 4).translate(0, 0.85, 0.07), x, 0.3, z, yaw + Math.PI / 2);
        }
        break;
      }
      case 'palisade':
        kit.add(wood, box(r * 1.6, h * 0.85, len + r * 2), mx, 0, mz, yaw);
        for (let k = 0; k <= len / 0.9; k++) {
          const t = (k * 0.9) / Math.max(len, 0.1), x = o.ax + (o.bx - o.ax) * Math.min(1, t), z = o.az + (o.bz - o.az) * Math.min(1, t);
          kit.add(darkWood, new THREE.ConeGeometry(0.25, h * 0.35, 5).translate(0, h * 0.85 + h * 0.17, 0), x, 0, z, rnd() * 3);
        }
        kit.add(iron, box(r * 2.1, 0.12, len + r * 2.1), mx, h * 0.55, mz, yaw);
        break;
      case 'wagon':
        kit.add(plank, box(r * 1.6, h * 0.55, len + r * 1.6), mx, 0.35, mz, yaw, 1, 1, 1, 0.12 * (rnd() - 0.5)).add(iron, box(r * 1.7, 0.08, len + r * 1.7), mx, 0.35 + h * 0.55, mz, yaw);
        for (const s of [-1, 1]) for (const e of [-1, 0.9]) kit.add(wood, cyl(0.5, 0.5, 0.12, 9), mx + Math.cos(yaw) * s * r * 1.05 + Math.sin(yaw) * e * len * 0.4, 0.5, mz - Math.sin(yaw) * s * r * 1.05 + Math.cos(yaw) * e * len * 0.4, yaw, 1, 1, 1, 0, Math.PI / 2 + (rnd() - 0.5) * 0.4);
        break;
      case 'catapult':
        kit.add(plank, box(r * 1.5, 0.35, r * 2.4), o.ax, 0.2, o.az, rnd() * 3).add(wood, cyl(0.1, 0.12, 3.0, 5), o.ax, 0.6, o.az, 0.5, 1, 1, 1, 1.2, 0.3).add(iron, cyl(0.45, 0.45, 0.12, 8), o.ax + 0.7, 0.5, o.az, 0.5, 1, 1, 1, 0, Math.PI / 2);
        break;
      case 'tower':
        kit.add(plank, box(r * 2, h * 0.7, len + r * 2), mx, 0.3, mz, yaw, 1, 1, 1, 0.05).add(wood, box(r * 2.2, 0.2, len + r * 2.2), mx, 0.3 + h * 0.7, mz, yaw);
        for (let k = 0; k < 6; k++) kit.add(darkWood, box(r * 2.1, 0.2, 0.2), mx + Math.sin(yaw) * (k - 2.5) * len / 6, 0.3 + h * 0.2 + (k % 2) * 0.9, mz + Math.cos(yaw) * (k - 2.5) * len / 6, yaw);
        break;
    }
  }
  // Braziers at each plaza's rim (towards the middle) and along the kerb.
  for (const pl of Object.values(BANNER_PLACES)) {
    const a = Math.atan2(RING.x - pl.x, RING.z - pl.z), x = pl.x + Math.sin(a) * (pl.r - 1), z = pl.z + Math.cos(a) * (pl.r - 1);
    kit.add(darkWood, cyl(0.12, 0.16, 1.6, 6), x, 0, z).add(iron, cyl(0.38, 0.22, 0.4, 7), x, 1.6, z).add(gold, new THREE.ConeGeometry(0.22, 0.5, 5).translate(0, 0.25, 0), x, 1.95, z);
    glowSpots.push({ x, y: 2.3, z, size: 2.0 });
  }
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2 + 0.07, x = RING.x + Math.sin(a) * (BANNERS_R - 0.9), z = RING.z + Math.cos(a) * (BANNERS_R - 0.9);
    kit.add(darkWood, cyl(0.12, 0.16, 1.4, 6), x, 0, z).add(iron, cyl(0.3, 0.18, 0.3, 6), x, 1.4, z);
    if (k % 2 === 0) glowSpots.push({ x, y: 1.9, z, size: 1.3 });
  }
  // Far out: pavilions, tall standards and low hills against the sky, in a few flat tones.
  for (let k = 0; k < 18; k++) {
    const a = rnd() * Math.PI * 2, d = 56 + rnd() * 36, x = RING.x + Math.sin(a) * d, z = RING.z + Math.cos(a) * d;
    if (k % 3 === 0) kit.add(canvas, new THREE.ConeGeometry(3.4, 5, 6).translate(0, 2.5, 0), x, -0.2, z, rnd() * 3).add(blue, new THREE.ConeGeometry(3.45, 0.7, 6).translate(0, 0.4, 0), x, -0.2, z);
    else if (k % 3 === 1) kit.add(wood, cyl(0.15, 0.2, 9, 5), x, -0.2, z).add(blue, box(0.12, 2.2, 1.6), x, 6.6, z + 0.9, 0);
    else kit.add(rock, new THREE.SphereGeometry(1, 8, 5).scale(9 + rnd() * 8, 2 + rnd() * 2, 7 + rnd() * 5), x, -0.4, z, rnd() * 3);
  }
  kit.build(g, own);

  const glows = new Glows(glowSpots, 0xc8702c, 1.1);
  g.add(glows.group);
  own.push(glows);
  const rain = new Rain();
  g.add(rain.lines);
  own.push(rain);

  return {
    group: g,
    update(dt, time) { rain.update(dt); glows.update(time); },
    dispose() {
      g.removeFromParent();
      for (const o of own) o.dispose();
    },
  };
}

export const bannersArena: ArenaDef = {
  id: 'tower-zone-banners',
  name: 'The Field of Banners, a zone',
  ring: BANNERS_R,
  obstacles: BANNERS_COVER,
  stage: STAGE,
  hideGround: true,
  build() {
    const z = buildBannersZone();
    return { group: z.group, update: z.update, dispose: z.dispose };
  },
};
