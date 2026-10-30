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

/** A crystal: octahedron with its base at y = 0, `h` tall, leaning outward along angle `a` by `tilt`. */
function crystal(x: number, z: number, h: number, r: number, a: number, tilt: number) {
  const o = new THREE.OctahedronGeometry(1, 0);
  o.translate(0, 1, 0);
  return bake(o, x, 0, z, r, h / 2, r, tilt * Math.sin(a), a, -tilt * Math.cos(a));
}

/** A broken crystal stump: a hexagonal prism with a slanted, snapped top, base at y = 0. */
function stump(x: number, z: number, r: number, h: number, slant: number, yaw: number) {
  const c = new THREE.CylinderGeometry(r * 0.72, r, h, 6, 1);
  c.translate(0, h / 2, 0);
  const p = c.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > h * 0.6) p.setY(i, p.getY(i) - slant * (0.5 - p.getX(i) / r / 2));
  return bake(c, x, 0, z, 1, 1, 1, 0, yaw, 0);
}

/** Turns a geometry built in a wall's local frame (x across, z along) into world space. */
const place = (g: THREE.BufferGeometry, cx: number, cz: number, yaw: number) => {
  g.rotateY(yaw);
  g.translate(cx, 0, cz);
  return g;
};

const OBSTACLES: Obstacle[] = [
  pillar(0, 7, 1.0),
  pillar(6.5, 6),
  pillar(-6.5, 8),
  wall(-7, 3, -3.5, 3),
  wall(7, 11, 3.5, 11),
];

// ---- value noise (shapes the snowfield and the mountain ridges) ------------------------------------------------
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash2 = (ix: number, iz: number) => {
  const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function vnoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), u), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), u), v);
}
const fbm = (x: number, z: number) => (0.5 * vnoise(x, z) + 0.25 * vnoise(x * 2 + 17, z * 2 + 3) + 0.125 * vnoise(x * 4 + 5, z * 4 + 31)) / 0.875;

/** Wind-blown ridge pattern of the snowfield (0..0.5): sharp crests running across the wind. */
function windRidge(x: number, z: number) {
  const u = (x * 0.8 + z * 0.6) * 0.32 + fbm(x * 0.045, z * 0.045) * 7;
  return Math.pow(1 - Math.abs(Math.sin(u)), 3) * 0.5;
}

/** Height of the snowfield apron at a world position: flat inside radius ~13.5, low swells near the ring (< 0.5 m
 *  within 16 m), higher drifts and a rising bowl far out. */
function snowH(x: number, z: number) {
  const d = Math.hypot(x - RING.x, z - RING.z);
  const mask = smooth(13.5, 24, d);
  return mask * (fbm(x * 0.06 + 9, z * 0.06) * 1.7 + windRidge(x, z)) + smooth(30, 50, d) * 4;
}

/** The snowfield: a displaced ring-shaped mesh (wind ridges, rock patches in the vertex colours). */
function apronGeometry() {
  const NR = 46;
  const NA = 128;
  const pos = new Float32Array((NR + 1) * (NA + 1) * 3);
  const uv = new Float32Array((NR + 1) * (NA + 1) * 2);
  const col = new Float32Array((NR + 1) * (NA + 1) * 3);
  const idx: number[] = [];
  for (let i = 0; i <= NR; i++) {
    const r = 11.6 + 48.4 * Math.pow(i / NR, 1.6);
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      const x = RING.x + Math.cos(a) * r;
      const z = RING.z + Math.sin(a) * r;
      const v = i * (NA + 1) + j;
      pos.set([x, snowH(x, z), z], v * 3);
      uv.set([x / 20, z / 20], v * 2);
      const d = Math.hypot(x - RING.x, z - RING.z);
      const rockiness = smooth(0.58, 0.72, fbm(x * 0.1 + 40, z * 0.1 + 7)) * smooth(14, 20, d);
      const lit = 0.92 + windRidge(x, z) * 0.2;
      col.set([lerp(lit, 0.46, rockiness), lerp(lit, 0.48, rockiness), lerp(lit, 0.54, rockiness)], v * 3);
      if (i < NR && j < NA) {
        const c = v + NA + 1;
        idx.push(v, v + 1, c, v + 1, c + 1, c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** A wind-sculpted drift in a wall's local frame (x across, z along): long gentle windward slope, sharp crest pushed
 *  to the lee side, with a lower layered ramp. `lee` = +1 or -1 (which local x side is the lee). */
function driftGeometry(len: number, lee: number, wob: number) {
  const half = len / 2 + 0.55;
  const mk = (sx: number, sy: number, sz: number, ox: number, ang: number) => {
    const s = new THREE.SphereGeometry(1, 28, 14);
    const p = s.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = Math.max(p.getY(i), 0);
      const z = p.getZ(i);
      const windward = x * lee < 0;
      const xs = x * sx * (windward ? 1.5 : 0.75) + lee * 0.22 * y * sx;
      const ys = y * sy * (1 + 0.12 * Math.sin(z * 4.1 + wob));
      p.setXYZ(i, xs + ox, ys, z * sz);
    }
    s.rotateY(ang);
    s.computeVertexNormals();
    return s;
  };
  return [
    mk(0.62, 1.55, half, 0, 0),
    mk(0.5, 0.65, half * 0.55, -lee * 0.55, 0), // lower windward layer
    mk(0.4, 0.55, half * 0.32, lee * 0.45, 0.12), // small pile in the lee
  ];
}

function iceTexture() {
  const rnd = seeded(7);
  const px = (wx: number) => (wx / 24 + 0.5) * 1024;
  const pz = (wz: number) => ((wz - RING.z) / 24 + 0.5) * 1024;
  return canvasTexture(1024, (g, s) => {
    // deep under-layer
    g.fillStyle = '#121c28';
    g.fillRect(0, 0, s, s);
    const depth = g.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.5);
    depth.addColorStop(0, 'rgba(4,10,20,0.35)');
    depth.addColorStop(1, 'rgba(4,10,20,0)');
    g.fillStyle = depth;
    g.fillRect(0, 0, s, s);
    // deep cracks: wide soft dark lines with a blue edge
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = rnd() * s;
      let y = rnd() * s;
      let a = rnd() * 6.28;
      const pts: number[][] = [[x, y]];
      for (let k = 0; k < 9; k++) {
        a += (rnd() - 0.5) * 0.7;
        x += Math.cos(a) * 45;
        y += Math.sin(a) * 45;
        pts.push([x, y]);
      }
      for (const [w, c] of [
        [10 + rnd() * 6, 'rgba(28,80,130,0.22)'],
        [4 + rnd() * 3, 'rgba(3,8,16,0.65)'],
      ] as const) {
        g.strokeStyle = c;
        g.lineWidth = w;
        g.beginPath();
        pts.forEach(([qx, qy], k) => (k ? g.lineTo(qx, qy) : g.moveTo(qx, qy)));
        g.stroke();
      }
    }
    // trapped bubbles: strings of small rings rising towards the surface
    for (let i = 0; i < 26; i++) {
      let x = rnd() * s;
      let y = rnd() * s;
      const n = 3 + Math.floor(rnd() * 6);
      for (let k = 0; k < n; k++) {
        const r = 1.5 + rnd() * 6;
        g.fillStyle = 'rgba(120,170,210,0.06)';
        g.strokeStyle = `rgba(170,210,235,${0.14 + rnd() * 0.12})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, y, r, 0, 6.3);
        g.fill();
        g.stroke();
        x += (rnd() - 0.5) * 22;
        y += (rnd() - 0.5) * 22;
      }
    }
    // a sunken branch (dark, forked)
    const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
      g.strokeStyle = 'rgba(52,38,30,0.75)';
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len;
      g.lineTo(ex, ey);
      g.stroke();
      if (depth > 0) {
        branch(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, a + 0.6, len * 0.45, w * 0.6, depth - 1);
        branch(x + Math.cos(a) * len * 0.75, y + Math.sin(a) * len * 0.75, a - 0.7, len * 0.4, w * 0.6, depth - 1);
      }
    };
    branch(px(-9), pz(2), 0.35, 120, 6, 2);
    branch(px(3.5), pz(9), 2.6, 90, 5, 2);
    // frozen fish under the ice
    const fish = (wx: number, wz: number, a: number, len: number) => {
      g.save();
      g.translate(px(wx), pz(wz));
      g.rotate(a);
      g.fillStyle = 'rgba(70,112,140,0.5)';
      g.strokeStyle = 'rgba(150,195,220,0.28)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(0, 0, len / 2, len / 5, 0, 0, 6.3);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(-len / 2 + 2, 0);
      g.lineTo(-len / 2 - len * 0.28, -len * 0.2);
      g.lineTo(-len / 2 - len * 0.28, len * 0.2);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(20,30,40,0.8)';
      g.beginPath();
      g.arc(len * 0.3, -len * 0.03, 2, 0, 6.3);
      g.fill();
      g.restore();
    };
    fish(-5.2, 9.6, 0.5, 62);
    fish(6.8, 2.6, 3.5, 52);
    fish(-1.8, 5.2, 2.2, 44);
  });
}

/** Faint frosted top layer over the ice: swirls, thin pale cracks and rime growing toward the rim. */
function frostTexture() {
  const rnd = seeded(11);
  return canvasTexture(1024, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.lineWidth = 7;
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(150,195,230,${0.035 + rnd() * 0.03})`;
      g.beginPath();
      g.arc(rnd() * s, rnd() * s, 30 + rnd() * 120, rnd() * 6, rnd() * 6 + 1 + rnd() * 2);
      g.stroke();
    }
    const crack = (x: number, y: number, a: number, len: number, depth: number) => {
      g.strokeStyle = `rgba(190,224,240,${0.3 + depth * 0.1})`;
      g.lineWidth = 0.8 + depth * 0.4;
      g.beginPath();
      g.moveTo(x, y);
      for (let d = 0; d < len; d += 18) {
        a += (rnd() - 0.5) * 0.55;
        x += Math.cos(a) * 18;
        y += Math.sin(a) * 18;
        g.lineTo(x, y);
        if (depth > 0 && rnd() < 0.16) crack(x, y, a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.7), len * 0.45, depth - 1);
      }
      g.stroke();
    };
    for (let i = 0; i < 9; i++) crack(rnd() * s, rnd() * s, rnd() * 6.28, 200 + rnd() * 240, 2);
    // rime: a white-blue haze toward the rim and short frost spikes pointing inward
    const rime = g.createRadialGradient(s / 2, s / 2, s * 0.36, s / 2, s / 2, s * 0.5);
    rime.addColorStop(0, 'rgba(200,225,240,0)');
    rime.addColorStop(1, 'rgba(200,225,240,0.22)');
    g.fillStyle = rime;
    g.fillRect(0, 0, s, s);
    g.lineCap = 'round';
    for (let i = 0; i < 520; i++) {
      const a = rnd() * 6.283;
      const r0 = s * (0.49 - rnd() * 0.07);
      const len = 6 + rnd() * 22;
      g.strokeStyle = `rgba(220,236,246,${0.1 + rnd() * 0.14})`;
      g.lineWidth = 0.8 + rnd() * 1.2;
      g.beginPath();
      g.moveTo(s / 2 + Math.cos(a) * r0, s / 2 + Math.sin(a) * r0);
      g.lineTo(s / 2 + Math.cos(a + (rnd() - 0.5) * 0.15) * (r0 - len), s / 2 + Math.sin(a + (rnd() - 0.5) * 0.15) * (r0 - len));
      g.stroke();
    }
  });
}

function snowTexture() {
  const rnd = seeded(21);
  return canvasTexture(1024, (g, s) => {
    g.fillStyle = '#2a3644';
    g.fillRect(0, 0, s, s);
    // soft blobs, wrapped so the tile repeats without a seam
    for (let i = 0; i < 240; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 20 + rnd() * 70;
      const l = rnd() < 0.6;
      for (const ox of [-s, 0, s]) {
        for (const oy of [-s, 0, s]) {
          const cx = x + ox;
          const cy = y + oy;
          if (cx < -r || cx > s + r || cy < -r || cy > s + r) continue;
          const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
          grad.addColorStop(0, l ? 'rgba(88,108,130,0.22)' : 'rgba(10,16,26,0.25)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
    }
    // fine wind streaks along the wind direction (x*0.8 + z*0.6 is across: streaks run along (0.6, -0.8))
    g.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const len = 40 + rnd() * 120;
      g.strokeStyle = rnd() < 0.6 ? 'rgba(96,116,138,0.14)' : 'rgba(8,14,22,0.16)';
      g.lineWidth = 1 + rnd() * 2.5;
      for (const ox of [-s, 0, s]) {
        for (const oy of [-s, 0, s]) {
          g.beginPath();
          g.moveTo(x + ox, y + oy);
          g.lineTo(x + ox + 0.6 * len, y + oy - 0.8 * len);
          g.stroke();
        }
      }
    }
  });
}

/** A jagged mountain ridge ring (flat silhouette) with a pale snow line on the peaks. */
function mountainRing(R: number, base: number, amp: number, seedOff: number, dark: number, snowCol: number) {
  const NA = 180;
  const pos = new Float32Array((NA + 1) * 3 * 3);
  const col = new Float32Array((NA + 1) * 3 * 3);
  const cDark = new THREE.Color(dark);
  const cSnow = new THREE.Color(snowCol);
  const idx: number[] = [];
  for (let j = 0; j <= NA; j++) {
    const a = (j / NA) * Math.PI * 2;
    const ridge = (k: number, p: number) => 1 - Math.abs(Math.sin(k * a + p));
    const n =
      0.45 * ridge(5, seedOff) + 0.3 * ridge(9, seedOff * 2.3) + 0.2 * ridge(17, seedOff * 3.1) + 0.1 * hash2(j % NA, seedOff) +
      0.25 * Math.sin(2 * a + seedOff);
    const top = base + amp * Math.max(0.05, n);
    const x = Math.cos(a) * R + RING.x;
    const z = Math.sin(a) * R + RING.z;
    const rows = [-6, top * 0.55, top];
    for (let k = 0; k < 3; k++) {
      const v = j * 3 + k;
      pos.set([x, rows[k], z], v * 3);
      const c = k === 2 ? cSnow : cDark;
      col.set([c.r, c.g, c.b], v * 3);
      if (j < NA && k < 2) idx.push(v, v + 3, v + 1, v + 1, v + 3, v + 4);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

export const frostArena: ArenaDef = {
  id: 'frost',
  name: 'Frostfall Lake',
  obstacles: OBSTACLES,
  stage: {
    background: 0x1a2a3a,
    zenith: 0x0a1a2e,
    horizon: 0x3a5a78,
    glow: 0x8fc8e8,
    stars: 0.3,
    fog: 0x2a4058,
    fogNear: 30,
    fogFar: 120,
    hemiSky: 0xbfe0ff,
    hemiGround: 0x1a2a3a,
    hemiIntensity: 0.65,
    sun: 0xe8f4ff,
    sunIntensity: 1.3,
    rim: 0x9fd8ff,
    rimIntensity: 1.0,
  },
  build() {
    const g = new THREE.Group();
    const rnd = seeded(1337);

    // floors: displaced snowfield, glossy dark ice (deep layer + frosted top), packed-snow rim
    const apron = new THREE.Mesh(
      apronGeometry(),
      new THREE.MeshStandardMaterial({
        map: snowTexture(), vertexColors: true, color: 0xffffff, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
      }),
    );
    apron.position.y = 0.006;
    apron.receiveShadow = true;
    const ice = floorDisc(RING.r, new THREE.MeshStandardMaterial({ map: iceTexture(), color: 0xa8b4c4, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.25 }), 0.02);
    const frost = floorDisc(
      RING.r,
      new THREE.MeshStandardMaterial({
        map: frostTexture(), color: 0x8a96a6, roughness: 0.9, envMapIntensity: 0.2, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }),
      0.024,
    );
    frost.renderOrder = 1;
    const snowBand = flatRing(RING.r - 0.7, RING.r + 0.35, 0x5a6c80, 0.95, 0.03);
    const rimLine = flatRing(RING.r - 0.08, RING.r, 0xb8d4e8, 0.8, 0.036);
    snowBand.renderOrder = 2;
    rimLine.renderOrder = 3;
    g.add(apron, ice, frost, snowBand, rimLine);

    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x5aa4c0, roughness: 0.35, metalness: 0.1, flatShading: true, emissive: 0x1a5a7a, emissiveIntensity: 0.3,
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x2e5a72, roughness: 0.4, metalness: 0.1, flatShading: true, emissive: 0x10384c, emissiveIntensity: 0.25,
    });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0x46525e, roughness: 0.95 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.9, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 1 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x182630, roughness: 0.95, flatShading: true });

    const crystals: THREE.BufferGeometry[] = [];
    const snow: THREE.BufferGeometry[] = [];

    // crystal clusters on the three pillars: a tall spire with satellites, a fan, a thin spire; each with snapped
    // stumps and a toppled shard so no two read alike
    const cluster = (o: Obstacle, main: number, count: number, spread: number, rad: number) => {
      crystals.push(crystal(o.ax, o.az, main, rad * 1.1, 0, 0.04));
      for (let i = 1; i < count; i++) {
        const a = (i / (count - 1)) * Math.PI * 2 + rnd() * 0.5;
        const d = spread * (0.6 + rnd() * 0.4);
        const h = main * (0.45 + rnd() * 0.4);
        crystals.push(crystal(o.ax + Math.cos(a) * d, o.az + Math.sin(a) * d, h, rad * (0.7 + rnd() * 0.3), a, 0.16 + rnd() * 0.2));
      }
      snow.push(bake(new THREE.SphereGeometry(1, 12, 6), o.ax, 0, o.az, o.r * 1.25, 0.32, o.r * 1.25));
    };
    const [spire, fanA, fanB] = OBSTACLES;
    cluster(spire, 4.2, 6, 0.6, 0.42);
    crystals.push(crystal(spire.ax + 0.95, spire.az - 0.45, 1.6, 0.26, 2.0, 1.25).translate(0, 0.2, 0)); // toppled shard
    crystals.push(stump(spire.ax - 0.85, spire.az + 0.55, 0.36, 0.55, 0.25, 0.4), stump(spire.ax + 0.3, spire.az + 0.95, 0.28, 0.35, 0.18, 1.2));

    cluster(fanA, 3.2, 4, 0.5, 0.36);
    crystals.push(stump(fanA.ax + 0.7, fanA.az + 0.55, 0.4, 0.7, 0.3, 0.9), stump(fanA.ax - 0.75, fanA.az - 0.5, 0.3, 0.4, 0.2, 2.1));
    crystals.push(crystal(fanA.ax - 0.4, fanA.az + 0.95, 1.2, 0.22, 4.2, 1.2).translate(0, 0.18, 0));

    cluster(fanB, 3.7, 3, 0.5, 0.3);
    crystals.push(stump(fanB.ax - 0.7, fanB.az + 0.5, 0.34, 0.8, 0.35, 0.2), stump(fanB.ax + 0.6, fanB.az - 0.6, 0.38, 0.45, 0.2, 1.7), stump(fanB.ax + 0.85, fanB.az + 0.35, 0.24, 0.3, 0.15, 2.8));

    // wind-sculpted drift ridges (crest toward the lee, layered ramps) with ice shards poking out of the crest
    for (const o of OBSTACLES.slice(3)) {
      const len = Math.hypot(o.bx - o.ax, o.bz - o.az);
      const yaw = Math.atan2(o.bx - o.ax, o.bz - o.az);
      const cx = (o.ax + o.bx) / 2;
      const cz = (o.az + o.bz) / 2;
      const lee = Math.sign(Math.sin(yaw)) || 1; // the wind blows toward -z
      for (const d of driftGeometry(len, lee, yaw)) snow.push(place(d.toNonIndexed(), cx, cz, yaw));
      for (const [t, across, y, h] of [
        [-0.32, 0.2, 1.4, 0.8], [-0.05, 0.22, 1.45, 0.95], [0.3, 0.2, 1.4, 0.7], [0.12, -0.5, 0.75, 0.5], [-0.4, -0.45, 0.6, 0.45],
      ] as const) {
        const sh = crystal(lee * across, t * len + (rnd() - 0.5) * 0.15, h, 0.14, rnd() * 6.28, 0.2).translate(0, y, 0);
        crystals.push(place(sh, cx, cz, yaw));
      }
    }

    // shoreline: broken ice plates pushed up around the rim, with a few standing shards (all < 0.6 m)
    const plates: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 54; i++) {
      const a = (i / 54) * 6.283 + (rnd() - 0.5) * 0.1;
      const r = 12.3 + rnd() * 1.0;
      const rad = 0.45 + rnd() * 0.5;
      const tilt = 0.1 + rnd() * 0.3;
      const ta = rnd() * 6.283;
      const p = new THREE.CylinderGeometry(rad * (0.8 + rnd() * 0.2), rad, 0.12, rnd() < 0.5 ? 5 : 6);
      plates.push(
        bake(p, RING.x + Math.cos(a) * r, 0.06 + Math.sin(tilt) * rad * 0.7, RING.z + Math.sin(a) * r, 1, 1, 1, tilt * Math.sin(ta), rnd() * 3, -tilt * Math.cos(ta)),
      );
    }
    for (let i = 0; i < 18; i++) {
      const a = rnd() * 6.283;
      const r = 12.2 + rnd() * 0.9;
      plates.push(crystal(RING.x + Math.cos(a) * r, RING.z + Math.sin(a) * r, 0.3 + rnd() * 0.25, 0.1 + rnd() * 0.06, a, 0.3 + rnd() * 0.3));
    }

    // snowfield props: rocks (exposed rock patches), dead pines and a dense forest. Taller than 2 m only beyond 26 m
    // of the centre or off the z axis (|x| > 12), so the gameplay camera never loses a hero behind them.
    const rocks: THREE.BufferGeometry[] = [];
    const trunks: THREE.BufferGeometry[] = [];
    const pines: THREE.BufferGeometry[] = [];
    const tallOk = (x: number, z: number) => Math.abs(x - RING.x) > 12 || Math.hypot(x - RING.x, z - RING.z) > 26;
    for (let i = 0; i < 30; i++) {
      const a = rnd() * 6.283;
      const r = 15 + rnd() * 24;
      const s = 0.4 + rnd() * 0.9 + (r > 28 ? rnd() * 1.4 : 0);
      const x = RING.x + Math.cos(a) * r;
      const z = RING.z + Math.sin(a) * r;
      if (s * 0.6 > 2 && !tallOk(x, z)) continue;
      rocks.push(bake(new THREE.DodecahedronGeometry(1, 0), x, snowH(x, z) + s * 0.1, z, s, s * 0.6, s * 0.85, 0, rnd() * 3, 0));
    }
    const pine = (x: number, z: number, h: number, w: number) => {
      const gy = snowH(x, z) - 0.15;
      trunks.push(bake(new THREE.CylinderGeometry(0.08 * w, 0.2 * w, h * 0.5, 5), x, gy + h * 0.25, z));
      const tiers = h > 6 ? 4 : 3;
      for (let k = 0; k < tiers; k++) {
        const rr = (1.05 - k * 0.22) * w * (0.85 + rnd() * 0.25);
        const hh = h * (0.42 - k * 0.04);
        pines.push(bake(new THREE.ConeGeometry(rr, hh, 6), x, gy + h * 0.28 + k * hh * 0.5 + hh * 0.5, z, 1, 1, 1, 0, rnd() * 3, 0));
      }
    };
    for (let i = 0; i < 40; i++) {
      // low scrub pines near the ring (< 2 m)
      const a = rnd() * 6.283;
      const r = 16.5 + rnd() * 9;
      pine(RING.x + Math.cos(a) * r, RING.z + Math.sin(a) * r, 1.0 + rnd() * 0.9, 0.5 + rnd() * 0.2);
    }
    for (let i = 0; i < 92; i++) {
      const a = (i / 92) * 6.283 + rnd() * 0.2;
      let r = 20 + Math.pow(rnd(), 0.8) * 40;
      let x = RING.x + Math.cos(a) * r;
      let z = RING.z + Math.sin(a) * r;
      if (!tallOk(x, z)) {
        r = 26.5 + rnd() * 12;
        x = RING.x + Math.cos(a) * r;
        z = RING.z + Math.sin(a) * r;
      }
      const dead = rnd() < 0.25;
      pine(x, z, (r > 45 ? 8 : 4.5) + rnd() * 5, dead ? 0.55 : 0.9 + rnd() * 0.4);
    }

    // far backdrop: two mountain ridges (flat silhouettes)
    const farRidge = mountainRing(105, 12, 22, 1.7, 0x16222e, 0x405468);
    const nearRidge = mountainRing(80, 5, 12, 4.1, 0x101a24, 0x2c3d4e);
    // faint aurora ribbon, behind everything: additive, low opacity, slow wave
    const NA = 96;
    const aPos = new Float32Array((NA + 1) * 3 * 3);
    const aCol = new Float32Array((NA + 1) * 3 * 3);
    const green = new THREE.Color(0.08, 0.5, 0.32);
    const violet = new THREE.Color(0.34, 0.18, 0.5);
    const aIdx: number[] = [];
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      const b = smooth(-0.2, 0.6, Math.sin(3 * a + 0.7) * 0.7 + Math.sin(7 * a) * 0.3);
      const c = green.clone().lerp(violet, 0.5 + 0.5 * Math.sin(2 * a)).multiplyScalar(b);
      for (let k = 0; k < 3; k++) {
        const v = j * 3 + k;
        aPos.set([RING.x + Math.cos(a) * 150, 0, RING.z + Math.sin(a) * 150], v * 3);
        const m = k === 1 ? 1 : 0;
        aCol.set([c.r * m, c.g * m, c.b * m], v * 3);
        if (j < NA && k < 2) aIdx.push(v, v + 3, v + 1, v + 1, v + 3, v + 4);
      }
    }
    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
    aGeo.setAttribute('color', new THREE.BufferAttribute(aCol, 3));
    aGeo.setIndex(aIdx);
    const aurora = new THREE.Mesh(
      aGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    );
    aurora.frustumCulled = false;
    aurora.renderOrder = -1;
    const auroraWave = (time: number) => {
      for (let j = 0; j <= NA; j++) {
        const w = Math.sin((j / NA) * Math.PI * 2 * 5 + time * 0.15) * 4 + Math.sin((j / NA) * Math.PI * 2 * 3 - time * 0.09) * 3;
        aPos[(j * 3) * 3 + 1] = 40 + w;
        aPos[(j * 3 + 1) * 3 + 1] = 62 + w * 1.5;
        aPos[(j * 3 + 2) * 3 + 1] = 95 + w * 2;
      }
      aGeo.attributes.position.needsUpdate = true;
    };
    auroraWave(0);

    g.add(
      merged(crystals, iceMat),
      merged(snow, snowMat),
      merged(plates, plateMat),
      merged(rocks, rockMat),
      merged(trunks, trunkMat),
      merged(pines, pineMat),
      farRidge,
      nearRidge,
      aurora,
    );

    // ground mist wisps drifting along the rim (instanced flat quads, additive, fade in and out)
    const WISPS = 10;
    const mistTex = canvasTexture(128, (c, s) => {
      const grad = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, s, s);
    });
    const mist = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: mistTex, color: 0x9db8d0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      WISPS,
    );
    mist.frustumCulled = false;
    mist.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const wAng = new Float32Array(WISPS);
    const wRad = new Float32Array(WISPS);
    const wSpd = new Float32Array(WISPS);
    const wLife = new Float32Array(WISPS);
    const wLen = new Float32Array(WISPS);
    const wSize = new Float32Array(WISPS);
    const respawn = (i: number, first: boolean) => {
      wAng[i] = rnd() * 6.283;
      wRad[i] = 11.5 + rnd() * 4;
      wSpd[i] = (rnd() < 0.5 ? -1 : 1) * (0.015 + rnd() * 0.03);
      wLife[i] = first ? rnd() : 0;
      wLen[i] = 14 + rnd() * 14;
      wSize[i] = 5 + rnd() * 4;
    };
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < WISPS; i++) {
      respawn(i, true);
      mist.setColorAt(i, tint.setScalar(0));
    }
    g.add(mist);

    // falling snow
    const N = 300;
    const pos = new Float32Array(N * 3);
    const vy = new Float32Array(N);
    const ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = rnd() * 6.283;
      const r = Math.sqrt(rnd()) * 24;
      pos[i * 3] = RING.x + Math.cos(a) * r;
      pos[i * 3 + 1] = rnd() * 14;
      pos[i * 3 + 2] = RING.z + Math.sin(a) * r;
      vy[i] = 0.7 + rnd() * 1.0;
      ph[i] = rnd() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xeaf4ff, size: 0.14, transparent: true, opacity: 0.85, depthWrite: false }));
    flakes.frustumCulled = false;
    g.add(flakes);

    return {
      group: g,
      update(dt, time) {
        for (let i = 0; i < N; i++) {
          let y = pos[i * 3 + 1] - vy[i] * dt;
          if (y < 0) y += 14;
          pos[i * 3 + 1] = y;
          pos[i * 3] += Math.sin(time * 0.6 + ph[i]) * 0.25 * dt;
          pos[i * 3 + 2] += Math.cos(time * 0.5 + ph[i]) * 0.18 * dt;
        }
        geo.attributes.position.needsUpdate = true;
        auroraWave(time);
        for (let i = 0; i < WISPS; i++) {
          wLife[i] += dt / wLen[i];
          if (wLife[i] > 1) respawn(i, false);
          wAng[i] += wSpd[i] * dt;
          const f = Math.sin(Math.PI * wLife[i]);
          dummy.position.set(RING.x + Math.cos(wAng[i]) * wRad[i], 0.3 + 0.08 * Math.sin(time * 0.4 + i), RING.z + Math.sin(wAng[i]) * wRad[i]);
          dummy.rotation.set(-Math.PI / 2, 0, -wAng[i]);
          dummy.scale.set(wSize[i], wSize[i] * 0.45, 1);
          dummy.updateMatrix();
          mist.setMatrixAt(i, dummy.matrix);
          mist.setColorAt(i, tint.setScalar(f * 0.22));
        }
        mist.instanceMatrix.needsUpdate = true;
        if (mist.instanceColor) mist.instanceColor.needsUpdate = true;
      },
      dispose() {
        mist.dispose();
        disposeTree(g);
      },
    };
  },
};
