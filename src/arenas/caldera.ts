import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pillar, wall, type Obstacle } from '../obstacles';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded, shadowed } from './common';
import type { ArenaDef } from './types';

/** Bakes a transform into a (non-indexed) copy of `geo`, so many props merge into one draw call. */
function bake(geo: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    ),
  );
  return g;
}

const merged = (list: THREE.BufferGeometry[], mat: THREE.Material) => {
  const m = shadowed(new THREE.Mesh(mergeGeometries(list)!, mat));
  list.forEach((g) => g.dispose());
  return m;
};

/** Like `merged` for flat or emissive things that neither cast nor receive shadows. */
const mergedFlat = (list: THREE.BufferGeometry[], mat: THREE.Material) => {
  const m = new THREE.Mesh(mergeGeometries(list)!, mat);
  list.forEach((g) => g.dispose());
  return m;
};

const OBSTACLES: Obstacle[] = [wall(-6, 9, -2, 5), wall(6, 5, 2, 9), pillar(8, 7, 0.9), pillar(-8, 7, 0.9)];

const hash1 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A basalt column (hexagonal prism, base at y = 0, `h` tall); `slant` snaps its top off at an angle. */
function hexColumn(x: number, z: number, rt: number, rb: number, h: number, slant: number, yaw: number) {
  const c = new THREE.CylinderGeometry(rt, rb, h, 6, 1);
  c.translate(0, h / 2, 0);
  const p = c.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > h * 0.6) p.setY(i, p.getY(i) - slant * (0.5 - p.getX(i) / rt / 2));
  return bake(c, x, 0, z, 1, 1, 1, 0, yaw, 0);
}

/** Basalt floor: hexagonal columns seen from above, ash drifts on top. Returns the colour map and the lava-crack emissive map. */
function hexFloor() {
  const R = 40;
  const w = Math.sqrt(3) * R;
  const cells: { x: number; y: number }[] = [];
  for (let row = -1; row * R * 1.5 < 1024 + R; row++) {
    for (let col = -1; col * w < 1024 + w; col++) cells.push({ x: col * w + (row & 1 ? w / 2 : 0), y: row * R * 1.5 });
  }
  const verts = (cx: number, cy: number) => Array.from({ length: 6 }, (_, k) => [cx + R * Math.cos(Math.PI / 6 + (k * Math.PI) / 3), cy + R * Math.sin(Math.PI / 6 + (k * Math.PI) / 3)]);
  const color = canvasTexture(1024, (g, s) => {
    const rnd = seeded(5);
    g.fillStyle = '#17110f';
    g.fillRect(0, 0, s, s);
    for (const c of cells) {
      const v = verts(c.x, c.y);
      const l = 17 + Math.floor(rnd() * 9);
      g.fillStyle = `rgb(${l + 2},${l - 3},${l - 5})`;
      g.beginPath();
      v.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
      g.strokeStyle = '#080605';
      g.lineWidth = 3;
      g.stroke();
    }
    // soft ash drifts lying over the columns (stretched, dark grey, low contrast)
    for (let i = 0; i < 70; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const rx = 30 + rnd() * 90;
      g.save();
      g.translate(x, y);
      g.rotate(rnd() * 3.14);
      g.scale(1, 0.35 + rnd() * 0.3);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, 'rgba(52,47,44,0.3)');
      grad.addColorStop(1, 'rgba(52,47,44,0)');
      g.fillStyle = grad;
      g.fillRect(-rx, -rx, rx * 2, rx * 2);
      g.restore();
    }
  });
  const glow = canvasTexture(1024, (g, s) => {
    const rnd = seeded(9);
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.lineCap = 'round';
    for (const c of cells) {
      const v = verts(c.x, c.y);
      for (let k = 0; k < 6; k++) {
        if (rnd() > 0.05) continue;
        const a = v[k];
        const b = v[(k + 1) % 6];
        g.strokeStyle = '#ff6a1a';
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
    }
  });
  return { color, glow };
}

/** Cracked basalt apron that heats up towards its edge, where the lava lake begins. */
function apronFloor() {
  const rnd = seeded(33);
  const color = canvasTexture(1024, (g, s) => {
    g.fillStyle = '#1a1311';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 14 + rnd() * 50;
      g.fillStyle = `rgba(${rnd() < 0.5 ? '40,30,26' : '8,6,5'},0.25)`;
      g.beginPath();
      g.arc(x, y, r, 0, 6.3);
      g.fill();
    }
    g.strokeStyle = '#070504';
    g.lineWidth = 2.5;
    for (let i = 0; i < 40; i++) {
      let x = rnd() * s;
      let y = rnd() * s;
      let a = rnd() * 6.28;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        a += (rnd() - 0.5) * 1.1;
        x += Math.cos(a) * 28;
        y += Math.sin(a) * 28;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
  const glow = canvasTexture(1024, (g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    // heat band over the last third of the radius (disc radius 22.5 -> glow starts at ~r 17.5)
    const grad = g.createRadialGradient(s / 2, s / 2, s * 0.35, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, 'rgba(120,36,8,0.35)');
    grad.addColorStop(1, 'rgba(255,106,26,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#ff6a1a';
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (let i = 0; i < 55; i++) {
      const a0 = rnd() * 6.28;
      const rr = (0.34 + rnd() * 0.16) * s;
      let x = s / 2 + Math.cos(a0) * rr;
      let y = s / 2 + Math.sin(a0) * rr;
      let a = a0 + (rnd() - 0.5) * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        a += (rnd() - 0.5) * 0.9;
        x += Math.cos(a) * 18;
        y += Math.sin(a) * 18;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
  return { color, glow };
}

function lavaTexture() {
  const rnd = seeded(77);
  return canvasTexture(
    512,
    (g, s) => {
      g.fillStyle = '#5a1a08';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 150; i++) {
        const x = rnd() * s;
        const y = rnd() * s;
        const r = 12 + rnd() * 40;
        const hot = rnd() < 0.55;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, hot ? 'rgba(200,76,16,0.55)' : 'rgba(18,8,5,0.7)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    8,
  );
}

/** Height of the far crater wall's rim at angle `a`. */
const craterTop = (a: number) => 26 + 9 * Math.sin(2 * a + 1) + 5 * Math.sin(5 * a + 0.4) + 5 * (1 - Math.abs(Math.sin(11 * a))) + hash1(Math.round(a * 40)) * 4;
const CRATER_R0 = 84;
const CRATER_R1 = 96;

/** The crater wall: a jagged silhouette ring leaning outward, glowing faintly at its foot. */
function craterWall() {
  const NA = 200;
  const pos = new Float32Array((NA + 1) * 3 * 3);
  const col = new Float32Array((NA + 1) * 3 * 3);
  const cFoot = new THREE.Color(0x3a1206);
  const cMid = new THREE.Color(0x1c0c08);
  const cTop = new THREE.Color(0x0a0505);
  const idx: number[] = [];
  for (let j = 0; j <= NA; j++) {
    const a = (j / NA) * Math.PI * 2;
    const T = craterTop(a);
    const levels = [
      [CRATER_R0, -2, cFoot],
      [(CRATER_R0 + CRATER_R1) / 2, (T - 2) / 2, cMid],
      [CRATER_R1, T, cTop],
    ] as const;
    levels.forEach(([r, y, c], k) => {
      const v = j * 3 + k;
      pos.set([RING.x + Math.cos(a) * r, y, RING.z + Math.sin(a) * r], v * 3);
      col.set([c.r, c.g, c.b], v * 3);
      if (j < NA && k < 2) idx.push(v, v + 3, v + 1, v + 1, v + 3, v + 4);
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

/** Dim lava falls running down the far crater wall (tapered emissive strips). */
function lavaFalls(rnd: () => number) {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const top = new THREE.Color(0.28, 0.09, 0.02);
  const bot = new THREE.Color(0.78, 0.27, 0.07);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = ((i + rnd() * 0.7) / n) * Math.PI * 2;
    const T = craterTop(a);
    const tx = -Math.sin(a);
    const tz = Math.cos(a);
    const base = pos.length / 3;
    for (let k = 0; k < 4; k++) {
      const f = k / 3; // 0 = foot, 1 = near the top
      const y = 1 + f * (T * 0.82);
      const r = CRATER_R0 + ((y + 2) / (T + 2)) * (CRATER_R1 - CRATER_R0) - 0.9;
      const wob = (rnd() - 0.5) * 1.6;
      const hw = (1.5 - f * 0.9) / 2;
      const c = bot.clone().lerp(top, f);
      for (const s of [-1, 1]) {
        pos.push(RING.x + Math.cos(a) * r + tx * (wob + s * hw), y, RING.z + Math.sin(a) * r + tz * (wob + s * hw));
        col.push(c.r, c.g, c.b);
      }
      if (k < 3) idx.push(base + k * 2, base + k * 2 + 1, base + k * 2 + 2, base + k * 2 + 1, base + k * 2 + 3, base + k * 2 + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

/** Cooled lava flow ribbons: dark crust strips lying slightly above the floor, with a short skirt. */
function flowRibbons(paths: [number, number][][]) {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const path of paths) {
    const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const pts = curve.getPoints(16);
    const base = pos.length / 3;
    pts.forEach((p, k) => {
      const t = pts[Math.min(k + 1, pts.length - 1)].clone().sub(pts[Math.max(k - 1, 0)]).normalize();
      const f = k / (pts.length - 1);
      const hw = (0.85 - f * 0.4 + Math.sin(k * 1.7 + path[0][0]) * 0.12) / 2;
      const lx = p.x - t.z * hw;
      const lz = p.z + t.x * hw;
      const rx = p.x + t.z * hw;
      const rz = p.z - t.x * hw;
      const y = 0.055 + Math.sin(k * 2.1) * 0.008;
      // top left, top right, skirt left, skirt right
      pos.push(lx, y, lz, rx, y, rz, lx, 0.024, lz, rx, 0.024, rz);
      if (k < pts.length - 1) {
        const a = base + k * 4;
        const b = a + 4;
        idx.push(a, a + 1, b, a + 1, b + 1, b); // top (up)
        idx.push(a, b, a + 2, a + 2, b, b + 2); // left skirt
        idx.push(a + 1, a + 3, b + 1, b + 1, a + 3, b + 3); // right skirt
      }
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const SMOKE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * 650.0 / -mv.z;
    vA = aAlpha;
    gl_Position = projectionMatrix * mv;
  }
`;
const SMOKE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5)) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export const calderaArena: ArenaDef = {
  id: 'caldera',
  name: 'Ember Caldera',
  obstacles: OBSTACLES,
  stage: {
    background: 0x2a0e06,
    zenith: 0x120606,
    horizon: 0x3a1408,
    glow: 0xff5a1a,
    stars: 0,
    fog: 0x2a0e06,
    fogNear: 40,
    fogFar: 130,
    hemiSky: 0xffb080,
    hemiGround: 0x200804,
    hemiIntensity: 0.5,
    sun: 0xffc890,
    sunIntensity: 1.4,
    rim: 0xff6a2a,
    rimIntensity: 0.8,
  },
  build() {
    const g = new THREE.Group();
    const rnd = seeded(4242);
    const nearStart = (x: number, z: number, d: number) => Math.hypot(x, z - 13) < d || Math.hypot(x, z - 1) < d;

    // lava lake beyond the apron (slowly scrolling, dim), apron, basalt floor, obsidian rim with a lava seam
    const lavaTex = lavaTexture();
    const lava = new THREE.Mesh(new THREE.RingGeometry(21, 86, 72, 1), new THREE.MeshBasicMaterial({ map: lavaTex, color: 0xcccccc }));
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(RING.x, 0.01, RING.z);
    const ap = apronFloor();
    const apron = floorDisc(
      22.5,
      new THREE.MeshStandardMaterial({
        map: ap.color, roughness: 0.95, emissive: 0xffffff, emissiveMap: ap.glow, emissiveIntensity: 0.6,
        polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
      }),
      0.016,
    );
    const hx = hexFloor();
    const floor = floorDisc(
      RING.r,
      new THREE.MeshStandardMaterial({ map: hx.color, color: 0xffffff, roughness: 0.9, emissive: 0xffffff, emissiveMap: hx.glow, emissiveIntensity: 0.7 }),
      0.024,
    );
    const rim = flatRing(RING.r - 0.65, RING.r + 0.15, 0x0b090c, 0.97, 0.03);
    const seam = flatRing(RING.r - 0.65, RING.r - 0.56, 0xd8581a, 0.85, 0.034);
    g.add(lava, apron, floor, rim, seam);

    // dim lava vent at the centre (flat decoration, no collision)
    g.add(flatRing(0, 0.8, 0x7a2a0e, 0.9, 0.04), flatRing(0.8, 1.0, 0x0a0706, 0.9, 0.038));

    // cooled lava flow ribbons: from the rim toward the middle, away from both starts
    const flow = (a0: number, a1: number): [number, number][] =>
      [[12.4, a0], [10.4, a0 + (a1 - a0) * 0.35], [8.6, a0 + (a1 - a0) * 0.1], [7.0, a1]].map(([r, a]) => [RING.x + Math.cos((a * Math.PI) / 180) * r, RING.z + Math.sin((a * Math.PI) / 180) * r]);
    const paths = [flow(35, 46), flow(215, 226), flow(150, 138), flow(330, 318)];
    g.add(new THREE.Mesh(flowRibbons(paths), new THREE.MeshStandardMaterial({ color: 0x0f0b0a, roughness: 0.55, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));

    // obsidian ridges: two rows of faceted blocks of varied size and lean, shards on the crest, glowing fissures,
    // a lava seam at the base and rubble at the feet
    const ridge: THREE.BufferGeometry[] = [];
    const seams: THREE.BufferGeometry[] = [];
    for (const o of OBSTACLES.slice(0, 2)) {
      const len = Math.hypot(o.bx - o.ax, o.bz - o.az);
      const yaw = Math.atan2(o.bx - o.ax, o.bz - o.az);
      const sx = Math.sin(yaw);
      const cz = Math.cos(yaw);
      const mx = (o.ax + o.bx) / 2;
      const mz = (o.az + o.bz) / 2;
      const at = (t: number, across: number) => [o.ax + sx * t + cz * across, o.az + cz * t - sx * across] as const;
      const n = Math.ceil((len + 0.7) / 0.85);
      for (let i = 0; i < n; i++) {
        const t = -0.35 + ((len + 0.7) * (i + 0.5)) / n;
        const hy = 1.2 + rnd() * 1.4;
        const [x, z] = at(t, (rnd() - 0.5) * 0.25);
        ridge.push(bake(new THREE.IcosahedronGeometry(1, 0), x, hy * 0.3, z, 0.45 + rnd() * 0.45, hy * 0.7, 0.45 + rnd() * 0.4, (rnd() - 0.5) * 0.8, rnd() * 3, (rnd() - 0.5) * 0.8));
      }
      for (let i = 0; i < Math.ceil(n * 0.8); i++) {
        const t = -0.2 + ((len + 0.4) * (i + 0.5)) / Math.ceil(n * 0.8);
        const side = i % 2 ? 1 : -1;
        const hy = 0.5 + rnd() * 0.7;
        const [x, z] = at(t, side * (0.42 + rnd() * 0.15));
        ridge.push(bake(new THREE.IcosahedronGeometry(1, 0), x, hy * 0.3, z, 0.3 + rnd() * 0.25, hy * 0.7, 0.3 + rnd() * 0.3, (rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6));
      }
      for (let i = 0; i < 5; i++) {
        const [x, z] = at(0.4 + (i / 4) * (len - 0.8) + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.2);
        const h = 2.2 + rnd() * 0.6;
        const a = rnd() * 6.28;
        const oct = new THREE.OctahedronGeometry(1, 0);
        oct.translate(0, 1, 0);
        ridge.push(bake(oct, x, 0.5, z, 0.2 + rnd() * 0.08, h / 2, 0.2 + rnd() * 0.08, 0.15 * Math.sin(a), a, -0.15 * Math.cos(a)));
      }
      for (let i = 0; i < 18; i++) {
        const side = rnd() < 0.5 ? -1 : 1;
        const [x, z] = at(-0.6 + rnd() * (len + 1.2), side * (0.75 + rnd() * 0.55));
        const s = 0.06 + rnd() * 0.16;
        ridge.push(bake(new THREE.DodecahedronGeometry(1, 0), x, s * 0.4, z, s, s * 0.7, s, 0, rnd() * 3, 0));
      }
      // glowing fissures wedged between the blocks
      for (let i = 0; i < 9; i++) {
        const side = i % 2 ? 1 : -1;
        const [x, z] = at(0.3 + rnd() * (len - 0.6), side * (0.52 + rnd() * 0.12));
        const hf = 0.4 + rnd() * 0.7;
        seams.push(bake(new THREE.BoxGeometry(0.05, hf, 0.07 + rnd() * 0.06), x, 0.5 + hf / 2 + rnd() * 0.4, z, 1, 1, 1, 0, yaw + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5));
      }
      for (const side of [-1, 1]) {
        seams.push(bake(new THREE.BoxGeometry(0.1, 0.07, len + 0.9), mx + cz * 1.0 * side, 0.05, mz - sx * 1.0 * side, 1, 1, 1, 0, yaw, 0));
      }
    }
    const obsMat = new THREE.MeshStandardMaterial({ color: 0x0c0a12, roughness: 0.2, metalness: 0.3, flatShading: true });
    const seamMat = new THREE.MeshBasicMaterial({ color: 0xc84a14 });

    // obsidian lip round the rim: low jagged blocks with molten seams in the gaps
    const lip: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 100; i++) {
      const a = (i / 100) * 6.283 + (rnd() - 0.5) * 0.02;
      const r = RING.r + 0.15 + rnd() * 0.2;
      const h = 0.15 + rnd() * 0.4;
      const x = RING.x + Math.cos(a) * r;
      const z = RING.z + Math.sin(a) * r;
      if (rnd() < 0.12) {
        const oct = new THREE.OctahedronGeometry(1, 0);
        oct.translate(0, 1, 0);
        lip.push(bake(oct, x, 0.02, z, 0.18, 0.35 + rnd() * 0.3, 0.18, 0, -a, (rnd() - 0.5) * 0.4));
      } else {
        lip.push(bake(new THREE.DodecahedronGeometry(1, 0), x, h * 0.35, z, 0.18 + rnd() * 0.12, h, 0.3 + rnd() * 0.3, 0, -a, (rnd() - 0.5) * 0.5));
      }
    }
    const lipSeams: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 26; i++) {
      const a0 = rnd() * 6.283;
      const arc = new THREE.RingGeometry(RING.r - 0.04, RING.r + 0.08, 6, 1, a0, 0.08 + rnd() * 0.18);
      arc.rotateX(-Math.PI / 2);
      arc.translate(RING.x, 0.045, RING.z);
      lipSeams.push(arc);
    }

    // basalt column clusters: dark grey hexagonal prisms, varied heights, some snapped off, ash on top
    const cols: THREE.BufferGeometry[] = [];
    const ash: THREE.BufferGeometry[] = [];
    const column = (x: number, z: number, r: number, h: number, slant: number) => {
      cols.push(hexColumn(x, z, r * 0.92, r, h, slant, rnd() * 3));
      if (rnd() < 0.65) ash.push(bake(new THREE.SphereGeometry(1, 6, 3), x, h - slant * 0.05, z, r * 0.95, 0.07 + rnd() * 0.05, r * 0.95, 0, rnd() * 3, 0));
    };
    for (const o of OBSTACLES.slice(2)) {
      column(o.ax, o.az, 0.4, 3.5, 0);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3 + (rnd() - 0.5) * 0.3;
        const broken = rnd() < 0.4;
        column(o.ax + Math.cos(a) * 0.62, o.az + Math.sin(a) * 0.62, 0.28 + rnd() * 0.1, 1.2 + rnd() * 2.0, broken ? 0.3 + rnd() * 0.4 : 0);
      }
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.8 + rnd() * 0.4;
        column(o.ax + Math.cos(a) * 0.98, o.az + Math.sin(a) * 0.98, 0.22 + rnd() * 0.06, 0.35 + rnd() * 0.55, rnd() < 0.5 ? 0.2 : 0);
      }
    }
    const colMesh = merged(cols, new THREE.MeshStandardMaterial({ color: 0x2a2522, roughness: 0.9, flatShading: true }));
    const ashMesh = merged(ash, new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 1, flatShading: true }));

    // floor props: small rocks and low ash mounds (all < 0.3 m, clear of both starts)
    const pebbles: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 70; i++) {
      const a = rnd() * 6.283;
      const r = Math.sqrt(rnd()) * 11.2;
      const x = RING.x + Math.cos(a) * r;
      const z = RING.z + Math.sin(a) * r;
      if (nearStart(x, z, 2.2)) continue;
      const s = 0.06 + rnd() * 0.16;
      pebbles.push(bake(new THREE.DodecahedronGeometry(1, 0), x, s * 0.35, z, s, s * 0.7, s * 0.9, 0, rnd() * 3, 0));
    }
    const mounds: THREE.BufferGeometry[] = [];
    const moundAt = (x: number, z: number) => {
      if (nearStart(x, z, 2.5)) return;
      mounds.push(bake(new THREE.SphereGeometry(1, 8, 4), x, 0.02, z, 0.7 + rnd() * 0.9, 0.05 + rnd() * 0.07, 0.5 + rnd() * 0.6, 0, rnd() * 3, 0));
    };
    for (const o of OBSTACLES) moundAt(o.ax + (rnd() - 0.5) * 2, o.az + 1.2 + rnd() * 0.6), moundAt(o.bx + (rnd() - 0.5) * 2, o.bz - 1.2 - rnd() * 0.6);
    for (let i = 0; i < 8; i++) {
      const a = rnd() * 6.283;
      const r = 8.5 + rnd() * 2.8;
      moundAt(RING.x + Math.cos(a) * r, RING.z + Math.sin(a) * r);
    }

    // low basalt blocks on the apron, jagged rock spires far out (tall ones all beyond 36 m)
    const blocks: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 14; i++) {
      const a = rnd() * 6.283;
      const r = 15 + rnd() * 5;
      const s = 0.4 + rnd() * 0.7;
      blocks.push(bake(new THREE.DodecahedronGeometry(1, 0), RING.x + Math.cos(a) * r, s * 0.3, RING.z + Math.sin(a) * r, s, s * 0.7, s * 0.9, 0, rnd() * 3, 0));
    }
    const spires: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283 + rnd() * 0.25;
      const r = 36 + rnd() * 24;
      const cx = RING.x + Math.cos(a) * r;
      const cz = RING.z + Math.sin(a) * r;
      for (let k = 0; k < 3; k++) {
        const h = (k ? 4 : 8) + rnd() * (k ? 5 : 11);
        spires.push(
          bake(new THREE.ConeGeometry(0.9 + rnd() * 1.6, h, 5), cx + (k ? (rnd() - 0.5) * 6 : 0), h / 2 - 1, cz + (k ? (rnd() - 0.5) * 6 : 0), 1, 1, 1, (rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.3),
        );
      }
    }
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x241a17, roughness: 0.95, flatShading: true });
    g.add(
      merged(ridge, obsMat),
      mergedFlat(seams, seamMat),
      merged(lip, obsMat),
      mergedFlat(lipSeams, seamMat),
      colMesh,
      ashMesh,
      merged(pebbles, new THREE.MeshStandardMaterial({ color: 0x2c2724, roughness: 0.9, flatShading: true })),
      merged(mounds, new THREE.MeshStandardMaterial({ color: 0x2c2826, roughness: 1 })),
      merged(blocks, rockMat),
      merged(spires, rockMat),
    );

    // backdrop: crater wall with lava falls, smoke columns with a faint red glow under them
    g.add(craterWall(), lavaFalls(rnd));
    const COLS = 3;
    const PUFFS = 9;
    const smokeN = COLS * PUFFS;
    const sBase = [35, 160, 265].map((d) => [RING.x + Math.cos((d * Math.PI) / 180) * 62, RING.z + Math.sin((d * Math.PI) / 180) * 62]);
    const sPos = new Float32Array(smokeN * 3);
    const sSize = new Float32Array(smokeN);
    const sAlpha = new Float32Array(smokeN);
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
    smokeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
    const smoke = new THREE.Points(
      smokeGeo,
      new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(0x1c1210) } }, vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG, transparent: true, depthWrite: false }),
    );
    smoke.frustumCulled = false;
    const glowTex = canvasTexture(128, (c, s) => {
      const grad = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, s, s);
    });
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(sBase.flatMap(([x, z]) => [x, 6, z]), 3));
    const smokeGlow = new THREE.Points(
      glowGeo,
      new THREE.PointsMaterial({ map: glowTex, color: 0x6a1c08, size: 34, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    smokeGlow.frustumCulled = false;
    g.add(smoke, smokeGlow);
    const updateSmoke = (time: number) => {
      for (let i = 0; i < smokeN; i++) {
        const c = i % COLS;
        const u = (time * 0.018 + Math.floor(i / COLS) / PUFFS + c * 0.31) % 1;
        sPos[i * 3] = sBase[c][0] + u * 14 + Math.sin(time * 0.2 + i) * 1.5;
        sPos[i * 3 + 1] = 4 + u * 58;
        sPos[i * 3 + 2] = sBase[c][1] + u * 6 + Math.cos(time * 0.17 + i) * 1.5;
        sSize[i] = 5 + u * 13;
        sAlpha[i] = Math.sin(Math.PI * u) * 0.55;
      }
      smokeGeo.attributes.position.needsUpdate = true;
      smokeGeo.attributes.aSize.needsUpdate = true;
      smokeGeo.attributes.aAlpha.needsUpdate = true;
    };
    updateSmoke(0);

    // lava bubbles popping in the lake (one instanced mesh of half-spheres)
    const BUB = 8;
    const bubbles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff8030 }),
      BUB,
    );
    bubbles.frustumCulled = false;
    bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const bPos = Array.from({ length: BUB }, () => new THREE.Vector3());
    const bT = new Float32Array(BUB);
    const bS = new Float32Array(BUB);
    const bubRespawn = (i: number, first: boolean) => {
      const a = rnd() * 6.283;
      const r = 24 + rnd() * 20;
      bPos[i].set(RING.x + Math.cos(a) * r, 0.02, RING.z + Math.sin(a) * r);
      bT[i] = first ? -rnd() * 6 : -(1.5 + rnd() * 6);
      bS[i] = 0.7 + rnd() * 0.8;
    };
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < BUB; i++) {
      bubRespawn(i, true);
      bubbles.setColorAt(i, tint.setScalar(0));
    }
    g.add(bubbles);

    // rising embers
    const N = 260;
    const pos = new Float32Array(N * 3);
    const vy = new Float32Array(N);
    const ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = rnd() * 6.283;
      const r = Math.sqrt(rnd()) * 22;
      pos[i * 3] = RING.x + Math.cos(a) * r;
      pos[i * 3 + 1] = rnd() * 12;
      pos[i * 3 + 2] = RING.z + Math.sin(a) * r;
      vy[i] = 0.5 + rnd() * 1.3;
      ph[i] = rnd() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const embers = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xff8a3a, size: 0.13, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    embers.frustumCulled = false;
    g.add(embers);

    // slow falling ash flakes (grey)
    const AN = 80;
    const aPos = new Float32Array(AN * 3);
    const aVy = new Float32Array(AN);
    const aPh = new Float32Array(AN);
    for (let i = 0; i < AN; i++) {
      const a = rnd() * 6.283;
      const r = Math.sqrt(rnd()) * 22;
      aPos[i * 3] = RING.x + Math.cos(a) * r;
      aPos[i * 3 + 1] = rnd() * 12;
      aPos[i * 3 + 2] = RING.z + Math.sin(a) * r;
      aVy[i] = 0.35 + rnd() * 0.5;
      aPh[i] = rnd() * 6.28;
    }
    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
    const flakes = new THREE.Points(aGeo, new THREE.PointsMaterial({ color: 0x8a8480, size: 0.1, transparent: true, opacity: 0.6, depthWrite: false }));
    flakes.frustumCulled = false;
    g.add(flakes);

    return {
      group: g,
      update(dt, time) {
        lavaTex.offset.x = (time * 0.004) % 1;
        lavaTex.offset.y = (time * 0.0025) % 1;
        for (let i = 0; i < N; i++) {
          let y = pos[i * 3 + 1] + vy[i] * dt;
          if (y > 12) y -= 12;
          pos[i * 3 + 1] = y;
          pos[i * 3] += Math.sin(time * 0.8 + ph[i]) * 0.35 * dt;
          pos[i * 3 + 2] += Math.cos(time * 0.7 + ph[i]) * 0.3 * dt;
        }
        geo.attributes.position.needsUpdate = true;
        for (let i = 0; i < AN; i++) {
          let y = aPos[i * 3 + 1] - aVy[i] * dt;
          if (y < 0) y += 12;
          aPos[i * 3 + 1] = y;
          aPos[i * 3] += Math.sin(time * 0.4 + aPh[i]) * 0.3 * dt;
          aPos[i * 3 + 2] += Math.cos(time * 0.35 + aPh[i]) * 0.25 * dt;
        }
        aGeo.attributes.position.needsUpdate = true;
        updateSmoke(time);
        for (let i = 0; i < BUB; i++) {
          bT[i] += dt;
          if (bT[i] > 1.2) bubRespawn(i, false);
          const t = bT[i];
          // 0..0.9 s: swell, 0.9..1.2 s: pop (burst outward and fade); before 0: hidden
          const swell = t < 0 ? 0 : Math.min(t / 0.9, 1);
          const pop = t > 0.9 ? (t - 0.9) / 0.3 : 0;
          const s = bS[i] * (swell * (1 - 0.3 * swell) + pop * 0.8);
          dummy.position.copy(bPos[i]);
          dummy.scale.set(s, s * (pop ? 0.35 : 1), s);
          dummy.updateMatrix();
          bubbles.setMatrixAt(i, dummy.matrix);
          bubbles.setColorAt(i, tint.setScalar(t < 0 ? 0 : 1 - pop));
        }
        bubbles.instanceMatrix.needsUpdate = true;
        if (bubbles.instanceColor) bubbles.instanceColor.needsUpdate = true;
      },
      dispose() {
        bubbles.dispose();
        disposeTree(g);
      },
    };
  },
};
