import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pillar, type Obstacle } from '../obstacles';
import { RING, canvasTexture, disposeTree, flatRing, seeded } from './common';
import type { ArenaDef, ArenaStage } from './types';

/**
 * Sky Ruins: a floating slate-marble platform above a sea of clouds at dusk. The tool's slab floor is hidden
 * (`hideGround`), so the platform (top surface at y 0.01, radius ~13, a crumbling edge going down ~5 m) is the only
 * floor. Six fluted columns on a hexagon are the cover (three intact with capitals, three broken, two with ivy);
 * a compass-rose inlay and worn tiles on the floor, a low broken balustrade along part of the edge, a toppled column
 * outside the ring. Clouds drift below, rocky islands with strata and hanging roots carry ruins far away, a broken
 * arch stands off to the west, a few birds circle in the distance.
 */

const STAGE: ArenaStage = {
  background: 0x3a4470,
  zenith: 0x0b1030,
  horizon: 0x5a6aa8,
  glow: 0xffb08a,
  stars: 0.6,
  fog: 0x3a4470,
  fogNear: 60,
  fogFar: 200,
  hemiSky: 0xd0d8ff,
  hemiGround: 0x2a2030,
  hemiIntensity: 0.7,
  sun: 0xfff0e0,
  sunIntensity: 1.6,
  rim: 0xb0c0ff,
  rimIntensity: 1.0,
};

/** Column heights (m), one per angle 0°, 60°, ... 300°. Columns 0, 2, 4 are intact (capital on top), 1, 3, 5 are broken. */
const HEIGHTS = [4.5, 3.2, 3.8, 2.5, 4.0, 3.0];
const INTACT = [true, false, true, false, true, false];
const IVY = [false, true, false, true, false, true];
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const OBSTACLES: Obstacle[] = HEIGHTS.map((h, i) => {
  const a = (i * Math.PI) / 3;
  return { ...pillar(r6(6 * Math.cos(a)), r6(7 + 6 * Math.sin(a)), 0.8), height: h };
});

const RADIUS_TEX = 13.4; // the platform texture covers this radius

/** Edge of the platform: irregular, but never inside the rim line at 12. */
const edgeR = (th: number) => 12.75 + 0.3 * Math.sin(3 * th + 0.5) + 0.2 * Math.sin(8 * th);

/** Yaw (about y) that turns a local +x axis into the tangent of the circle at angle `th`. */
const tanYaw = (th: number) => Math.atan2(-Math.cos(th), -Math.sin(th));

/** Angular spans (degrees) of the low broken balustrade along the platform edge. */
const BALUSTRADE: [number, number][] = [[18, 52], [78, 98], [132, 176], [204, 232], [292, 334]];
const BAL_R = 12.62;
const inBalustrade = (th: number, margin = 0) => {
  const d = (((th * 180) / Math.PI) % 360 + 360) % 360;
  return BALUSTRADE.some(([a, b]) => d >= a - margin && d <= b + margin);
};

// ---- merge helper (same idea as the glade's) -------------------------------------------------------------------

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

interface Xf { rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number }

class Bucket {
  geos: THREE.BufferGeometry[] = [];
  add(src: THREE.BufferGeometry, x: number, y: number, z: number, color: number, o: Xf = {}) {
    const g = src.index ? src.toNonIndexed() : src.clone();
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.setHex(color);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // Euler order YXZ: yaw is applied last, so a tilt (rx / rz) leans in the local frame and the yaw swings it round.
    _q.setFromEuler(_e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'YXZ'));
    _m.compose(_p.set(x, y, z), _q, _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    g.applyMatrix4(_m);
    this.geos.push(g);
  }
  mesh(mat: THREE.Material, shadow: boolean) {
    const merged = mergeGeometries(this.geos, false);
    for (const g of this.geos) g.dispose();
    if (!merged) throw new Error('skyruins: geometry merge failed');
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = m.receiveShadow = shadow;
    return m;
  }
}

// ---- textures --------------------------------------------------------------------------------------------------

/**
 * Dark slate marble tiles (3 m) with veins, wear, chipped corners and cracks, and a gold inlay: rim at 12, ring at
 * 6, a compass rose / eight-pointed sun with a circle of constellation dots at 8.9, a small centre ring. A few
 * tiles are broken out, showing a darker under-layer.
 */
function platformTexture() {
  return canvasTexture(2048, (g, s) => {
    const rnd = seeded(31);
    const sc = s / (2 * RADIUS_TEX); // px per metre
    const c = s / 2;
    g.fillStyle = '#181a24';
    g.fillRect(0, 0, s, s);
    const tile = 3 * sc, off = c - 1.5 * sc;
    for (let ty = -6; ty < 6; ty++) {
      for (let tx = -6; tx < 6; tx++) {
        const x = off + tx * tile, y = off + ty * tile;
        const v = Math.floor(rnd() * 8);
        g.fillStyle = `rgb(${22 + v},${24 + v},${34 + v})`;
        g.fillRect(x, y, tile, tile);
        // veins
        g.strokeStyle = 'rgba(70,76,100,0.22)';
        g.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          let vx = x + rnd() * tile, vy = y + rnd() * tile;
          g.moveTo(vx, vy);
          for (let j = 0; j < 6; j++) { vx += (rnd() - 0.4) * tile * 0.25; vy += (rnd() - 0.4) * tile * 0.25; g.lineTo(vx, vy); }
          g.stroke();
        }
        // wear: soft dark scuffs and a few lighter, polished patches
        for (let k = 0; k < 2; k++) {
          if (rnd() < 0.45) continue;
          const wx = x + rnd() * tile, wy = y + rnd() * tile, wr = (0.4 + rnd() * 0.8) * sc;
          const rg = g.createRadialGradient(wx, wy, 0, wx, wy, wr);
          const dark = rnd() < 0.6;
          rg.addColorStop(0, dark ? 'rgba(0,0,0,0.16)' : 'rgba(90,96,124,0.1)');
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = rg;
          g.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
        }
        // chipped corner
        if (rnd() < 0.35) {
          const cx = rnd() < 0.5 ? x : x + tile, cy = rnd() < 0.5 ? y : y + tile;
          const sx = cx === x ? 1 : -1, sy = cy === y ? 1 : -1, cz = (0.12 + rnd() * 0.22) * sc;
          g.fillStyle = '#0b0c12';
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + sx * cz * (1 + rnd()), cy);
          g.lineTo(cx + sx * cz * 0.4, cy + sy * cz * 0.5);
          g.lineTo(cx, cy + sy * cz * (1 + rnd()));
          g.closePath();
          g.fill();
        }
        // slightly lifted top and left edge
        g.strokeStyle = 'rgba(80,86,112,0.16)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + 3, y + tile - 3); g.lineTo(x + 3, y + 3); g.lineTo(x + tile - 3, y + 3);
        g.stroke();
        g.strokeStyle = '#0d0e15';
        g.lineWidth = 4;
        g.strokeRect(x, y, tile, tile);
      }
    }
    // cracks: a few near the edge, more small ones over the floor
    g.strokeStyle = 'rgba(8,8,12,0.8)';
    g.lineWidth = 3;
    for (let k = 0; k < 26; k++) {
      const a = rnd() * Math.PI * 2;
      const r = (10.2 + rnd() * 1.2) * sc;
      let x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
      g.beginPath();
      g.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += (rnd() - 0.5) * 0.6 * sc + Math.cos(a) * 0.3 * sc; y += (rnd() - 0.5) * 0.6 * sc + Math.sin(a) * 0.3 * sc; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(8,8,12,0.65)';
    g.lineWidth = 2;
    for (let k = 0; k < 40; k++) {
      const a = rnd() * Math.PI * 2, d = rnd() * Math.PI * 2;
      const r = (1.8 + rnd() * 8.4) * sc;
      let x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
      g.beginPath();
      g.moveTo(x, y);
      const n = 3 + Math.floor(rnd() * 4);
      for (let j = 0; j < n; j++) { x += Math.cos(d + (rnd() - 0.5) * 1.2) * 0.28 * sc; y += Math.sin(d + (rnd() - 0.5) * 1.2) * 0.28 * sc; g.lineTo(x, y); }
      g.stroke();
    }

    // gold inlay (canvas x = world x, canvas y = world z - 7)
    g.strokeStyle = '#9a7a34';
    g.fillStyle = '#b08a3a';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const P = (r: number, a: number): [number, number] => [c + Math.cos(a) * r * sc, c + Math.sin(a) * r * sc];
    const ring = (r: number, w: number) => { g.lineWidth = w * sc; g.beginPath(); g.arc(c, c, r * sc, 0, Math.PI * 2); g.stroke(); };
    ring(12, 0.14);
    ring(11.5, 0.05);
    ring(6, 0.1);
    ring(3.1, 0.05);
    ring(1.1, 0.08);
    // compass rose: four long and four short kite points, with a spine each, and eight small rays between
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, long = k % 2 === 0;
      const tip = long ? 10.7 : 7.3, base = long ? 1.9 : 1.7, half = long ? 0.34 : 0.3;
      g.lineWidth = 0.07 * sc;
      g.beginPath();
      g.moveTo(...P(base, a - half));
      g.lineTo(...P(tip, a));
      g.lineTo(...P(base, a + half));
      g.stroke();
      g.lineWidth = 0.05 * sc;
      g.beginPath();
      g.moveTo(...P(1.1, a));
      g.lineTo(...P(tip, a));
      g.stroke();
      const b = a + Math.PI / 8;
      g.lineWidth = 0.04 * sc;
      g.beginPath();
      g.moveTo(...P(1.1, b));
      g.lineTo(...P(3.7, b));
      g.stroke();
    }
    // small suns at the cardinal tips
    for (let k = 0; k < 4; k++) {
      const [x, y] = P(11.05, (k * Math.PI) / 2);
      g.beginPath();
      g.arc(x, y, 0.13 * sc, 0, Math.PI * 2);
      g.fill();
    }
    // circle of constellation dots with two thin constellation lines
    const dots: [number, number][] = [];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2 + (rnd() - 0.5) * 0.08, r = 8.9 + (rnd() - 0.5) * 0.5;
      dots.push(P(r, a));
    }
    g.lineWidth = 0.025 * sc;
    g.strokeStyle = 'rgba(154,122,52,0.7)';
    for (const [from, to] of [[2, 6], [11, 15], [19, 22]]) {
      g.beginPath();
      for (let k = from; k <= to; k++) { if (k === from) g.moveTo(...dots[k]); else g.lineTo(...dots[k]); }
      g.stroke();
    }
    dots.forEach(([x, y], k) => {
      g.beginPath();
      g.arc(x, y, (0.045 + (k % 3) * 0.025) * sc, 0, Math.PI * 2);
      g.fill();
    });
    // gold worn away in places
    g.fillStyle = 'rgba(24,26,36,0.7)';
    for (let k = 0; k < 40; k++) {
      const a = rnd() * Math.PI * 2, r = (rnd() < 0.5 ? 6 : 1.5 + rnd() * 9) * sc;
      g.beginPath();
      g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, (0.08 + rnd() * 0.14) * sc, (0.06 + rnd() * 0.1) * sc, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }

    // missing tiles: irregular holes down to a darker under-layer (avoid the starts, the centre, the rim)
    let placed = 0;
    for (let tries = 0; placed < 9 && tries < 200; tries++) {
      const a = rnd() * Math.PI * 2, r = 2.6 + rnd() * 8.2;
      const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
      if (Math.hypot(hx, hz - 6) < 3.2 || Math.hypot(hx, hz + 6) < 3.2) continue;
      if (OBSTACLES.some((o) => Math.hypot(hx - o.ax, hz - (o.az - 7)) < 2.2)) continue;
      const w = (0.5 + rnd() * 0.5) * sc, [x, y] = P(r, a);
      const rot = rnd() * 3;
      const poly: [number, number][] = [];
      for (let k = 0; k < 8; k++) {
        const ang = rot + (k / 8) * Math.PI * 2, rr = w * (0.62 + rnd() * 0.45);
        poly.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.85]);
      }
      g.beginPath();
      poly.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.fillStyle = '#07080c';
      g.fill();
      g.strokeStyle = 'rgba(88,94,122,0.35)';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = '#12141c';
      for (let k = 0; k < 3; k++) g.fillRect(x - w * 0.5 + rnd() * w * 0.6, y - w * 0.4 + rnd() * w * 0.6, w * (0.2 + rnd() * 0.3), w * (0.12 + rnd() * 0.15));
      placed++;
    }
  });
}

/** Tileable cloud field. `opaque`: the sea (violet with pink tops); otherwise soft wisps on transparent. */
function cloudTexture(size: number, seed: number, opaque: boolean, repeat: number) {
  return canvasTexture(
    size,
    (g, s) => {
      const rnd = seeded(seed);
      if (opaque) {
        const gr = g.createLinearGradient(0, 0, s, s);
        gr.addColorStop(0, '#3d4378');
        gr.addColorStop(1, '#464c86');
        g.fillStyle = gr;
        g.fillRect(0, 0, s, s);
      } else g.clearRect(0, 0, s, s);
      const cols = opaque ? ['#5b5fa0', '#7a74b0', '#c48a9a', '#e8b0a0', '#4a5088', '#8a86bc'] : ['#f0c8d0', '#c8b8e8', '#ffe0d8', '#d8d0f0'];
      const n = opaque ? 340 : 170;
      for (let i = 0; i < n; i++) {
        const x = rnd() * s, y = rnd() * s;
        const r = s * (opaque ? 0.04 + rnd() * 0.1 : 0.03 + rnd() * 0.08);
        const col = cols[Math.floor(rnd() * cols.length)];
        const a = opaque ? 0.2 + rnd() * 0.3 : 0.1 + rnd() * 0.18;
        for (const dx of [-s, 0, s]) {
          for (const dy of [-s, 0, s]) {
            const px = x + dx, py = y + dy;
            if (px + r < 0 || px - r > s || py + r < 0 || py - r > s) continue;
            const rg = g.createRadialGradient(px, py, 0, px, py, r);
            rg.addColorStop(0, col);
            rg.addColorStop(1, 'rgba(0,0,0,0)');
            g.globalAlpha = a;
            g.fillStyle = rg;
            g.fillRect(px - r, py - r, r * 2, r * 2);
          }
        }
      }
      g.globalAlpha = 1;
    },
    repeat,
  );
}

/** A soft cloud puff (several overlapping lobes) for the billboards. */
function puffTexture() {
  return canvasTexture(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    const rnd = seeded(5);
    for (let i = 0; i < 9; i++) {
      const x = s * (0.25 + rnd() * 0.5), y = s * (0.4 + rnd() * 0.2), r = s * (0.14 + rnd() * 0.14);
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.9)');
      rg.addColorStop(0.6, 'rgba(255,255,255,0.4)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

// ---- geometry --------------------------------------------------------------------------------------------------

const NS = 96; // angular samples of the platform edge

/** The top face: a fan with the irregular edge, uv in the platform texture. */
function topGeometry() {
  const pos = new Float32Array((NS + 1) * 3), uv = new Float32Array((NS + 1) * 2), nor = new Float32Array((NS + 1) * 3);
  const put = (i: number, x: number, z: number) => {
    pos.set([RING.x + x, 0.01, RING.z + z], i * 3);
    nor.set([0, 1, 0], i * 3);
    uv.set([(x / RADIUS_TEX + 1) / 2, (1 - z / RADIUS_TEX) / 2], i * 2);
  };
  put(0, 0, 0);
  for (let i = 0; i < NS; i++) {
    const th = (i / NS) * Math.PI * 2, r = edgeR(th);
    put(1 + i, Math.cos(th) * r, Math.sin(th) * r);
  }
  const idx: number[] = [];
  for (let i = 0; i < NS; i++) idx.push(0, 1 + ((i + 1) % NS), 1 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** The crumbling underside: rows of jittered rings narrowing downward, flat shaded, banded slate colours. */
function skirtGeometry() {
  const K = 6;
  const rnd = seeded(77);
  const pos: number[] = [], col: number[] = [];
  const shade = [0x2a2c38, 0x252733, 0x20222c, 0x1c1e27, 0x181a22, 0x15161d, 0x121319];
  for (let k = 0; k <= K; k++) {
    const f = k / K;
    for (let i = 0; i < NS; i++) {
      const th = (i / NS) * Math.PI * 2;
      const r = edgeR(th) * (1 - 0.6 * Math.pow(f, 1.4)) * (k > 0 ? 1 + (rnd() - 0.5) * 0.16 : 1);
      const y = k === 0 ? 0.01 : -k * 0.92 + (rnd() - 0.5) * 0.55;
      pos.push(RING.x + Math.cos(th) * r, y, RING.z + Math.sin(th) * r);
      _c.setHex(shade[k]);
      const j = 1 + (rnd() - 0.5) * 0.35;
      col.push(_c.r * j, _c.g * j, _c.b * j);
    }
  }
  const idx: number[] = [];
  for (let k = 0; k < K; k++) {
    for (let i = 0; i < NS; i++) {
      const a = k * NS + i, b = k * NS + ((i + 1) % NS), c = (k + 1) * NS + i, d = (k + 1) * NS + ((i + 1) % NS);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  return flat;
}

/**
 * A fluted column shaft from y 0.3 to `h`. A broken one has a tilted, jagged top (functions of the angle: the seam
 * stays closed); an intact one has a flat top, ready for a capital.
 */
function shaftGeometry(h: number, phase: number, broken: boolean) {
  const g = new THREE.CylinderGeometry(0.72, 0.8, h - 0.3, 40, 1);
  const p = g.attributes.position;
  const half = (h - 0.3) / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = p.getY(i);
    const th = Math.atan2(z, x), rad = Math.hypot(x, z);
    const k = 1 - 0.05 * (0.5 + 0.5 * Math.cos(12 * th));
    p.setX(i, x * k);
    p.setZ(i, z * k);
    if (broken && y > 0) y -= 0.3 * (0.5 + 0.5 * Math.cos(th - phase)) + 0.12 * (0.5 + 0.5 * Math.sin(5 * th + phase * 2)) * (rad > 1e-4 ? 1 : 0.5);
    p.setY(i, y + half + 0.3);
  }
  g.computeVertexNormals();
  return g;
}

/** Shaft radius at height y (matches `shaftGeometry`, a little inside the flutes). */
const shaftRadius = (y: number, hs: number) => 0.8 - 0.08 * Math.min(1, Math.max(0, (y - 0.3) / (hs - 0.3)));

function addColumn(marble: Bucket, gold: Bucket, ivy: Bucket, o: Obstacle, idx: number) {
  const h = o.height, ph = idx * 1.3 + 0.4;
  const intact = INTACT[idx];
  const hs = intact ? h - 0.5 : h; // shaft top; an intact column adds a 0.5 m capital
  // Base with mouldings: square plinth, a step, a torus ring.
  marble.add(new THREE.BoxGeometry(2.05, 0.2, 2.05), o.ax, 0.1, o.az, 0x6a6a76, { ry: 0.2 * idx });
  marble.add(new THREE.CylinderGeometry(1.0, 1.06, 0.12, 24), o.ax, 0.26, o.az, 0x72727e);
  marble.add(new THREE.TorusGeometry(0.86, 0.08, 6, 24), o.ax, 0.36, o.az, 0x7e7e8a, { rx: Math.PI / 2 });
  marble.add(shaftGeometry(hs, ph, !intact), o.ax, 0, o.az, 0x8a8a96, { ry: idx * 0.5 });
  const band = (y: number, w: number) => {
    const br = shaftRadius(y, hs) + 0.035;
    gold.add(new THREE.CylinderGeometry(br, br, w, 24), o.ax, y, o.az, 0xffffff);
  };
  band(0.3 + (hs - 0.3) * 0.5, 0.14);
  band(0.62, 0.08);
  if (intact) {
    band(hs - 0.28, 0.1);
    // capital: a flaring echinus under a square abacus
    marble.add(new THREE.CylinderGeometry(0.98, 0.74, 0.28, 24), o.ax, hs + 0.14, o.az, 0x8e8e9a, { ry: idx });
    marble.add(new THREE.BoxGeometry(1.9, 0.22, 1.9), o.ax, hs + 0.39, o.az, 0x7e7e8a, { ry: 0.12 * idx });
  }
  if (IVY[idx]) {
    // ivy winding up the shaft, a few strands hanging from the broken top
    const leaf = new THREE.IcosahedronGeometry(0.1, 0);
    const greens = [0x2f5a36, 0x3d6a3a, 0x24482c];
    for (let j = 0; j < 18; j++) {
      const y = 0.55 + (j / 18) * (hs - 0.9), a = ph + j * 0.85 + (j % 2) * 0.3;
      const r = shaftRadius(y, hs) + 0.03;
      ivy.add(leaf, o.ax + Math.cos(a) * r, y, o.az + Math.sin(a) * r, greens[j % 3], { sx: 1.5, sy: 0.35, sz: 1.2, ry: -a, rz: (j % 3 - 1) * 0.4 });
    }
    for (let j = 0; j < 3; j++) {
      const a = ph + 1.7 + j * 2.1, r = shaftRadius(hs - 0.2, hs) + 0.03, len = 0.6 + j * 0.25;
      ivy.add(new THREE.CylinderGeometry(0.02, 0.012, len, 4), o.ax + Math.cos(a) * r, hs - 0.2 - len / 2, o.az + Math.sin(a) * r, 0x2a4a2a);
      ivy.add(leaf, o.ax + Math.cos(a) * r, hs - 0.2 - len, o.az + Math.sin(a) * r, 0x3d6a3a, { sx: 1.4, sy: 0.4, sz: 1.2, ry: -a });
    }
  }
  // rubble round the foot, beyond the capsule
  const rnd = seeded(100 + idx);
  for (let k = 0; k < 3; k++) {
    const a = rnd() * Math.PI * 2, d = 1.3 + rnd() * 0.5;
    marble.add(new THREE.BoxGeometry(0.3 + rnd() * 0.3, 0.2 + rnd() * 0.2, 0.3 + rnd() * 0.3), o.ax + Math.cos(a) * d, 0.12, o.az + Math.sin(a) * d, 0x7a7a86, { ry: rnd() * 3, rz: (rnd() - 0.5) * 0.4 });
  }
}

/** A low, broken balustrade along the platform edge (outside the rim at 12): rails, balusters, end posts, gaps. */
function addBalustrade(marble: Bucket) {
  const baluster = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6);
  const post = new THREE.BoxGeometry(0.24, 0.85, 0.24);
  const railTop = new THREE.BoxGeometry(0.92, 0.1, 0.16);
  const railBase = new THREE.BoxGeometry(0.92, 0.14, 0.2);
  const STEP = 0.07;
  const rnd = seeded(555);
  for (const [a0, a1] of BALUSTRADE) {
    const t0 = (a0 * Math.PI) / 180, t1 = (a1 * Math.PI) / 180;
    let first = true;
    for (let th = t0; th <= t1; th += STEP) {
      if (BAL_R + 0.2 > edgeR(th) - 0.05) { first = true; continue; } // the edge has crumbled here
      const x = RING.x + Math.cos(th) * BAL_R, z = RING.z + Math.sin(th) * BAL_R;
      const yaw = tanYaw(th);
      marble.add(railBase, x, 0.07, z, 0x74747f, { ry: yaw });
      if (rnd() > 0.2) {
        for (const k of [-1, 0, 1]) {
          if (rnd() < 0.12) continue;
          const tx = -Math.sin(th) * k * 0.28, tz = Math.cos(th) * k * 0.28;
          marble.add(baluster, x + tx, 0.39, z + tz, 0x8a8a96, { ry: rnd() * 3 });
        }
      }
      if (rnd() > 0.35) marble.add(railTop, x, 0.69, z, 0x7e7e8a, { ry: yaw, rz: (rnd() - 0.5) * 0.05 });
      if (first || th + STEP > t1) {
        marble.add(post, x, rnd() < 0.5 ? 0.42 : 0.3, z, 0x8a8a96, { ry: yaw + (rnd() - 0.5) * 0.2, rz: (rnd() - 0.5) * 0.12 });
        first = false;
      }
    }
  }
}

// ---- islands ---------------------------------------------------------------------------------------------------

/** Roughens a geometry's vertices with a position hash (duplicate vertices move together, so seams stay closed). */
function roughen(g: THREE.BufferGeometry, amp: number, seed: number) {
  const p = g.attributes.position;
  const hash = (x: number, y: number, z: number, k: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + k * 17.3 + seed * 5.1) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6) continue;
    const k = 1 + (hash(x, y, z, 1) - 0.5) * 2 * amp;
    p.setXYZ(i, x * k, y + (hash(x, y, z, 2) - 0.5) * amp * 1.2, z * k);
  }
  g.computeVertexNormals();
  return g;
}

const STRATA = [0x3a3c4a, 0x2f3140, 0x4a4438, 0x2a2c3a, 0x4a3e3c, 0x232532, 0x1c1e29];

/** A floating rocky mass: a mossy top, layered strata stepping inward, a hanging tail, roots and vines. */
function addIsland(rock: Bucket, cx: number, cy: number, cz: number, s: number, seed: number) {
  const rnd = seeded(900 + seed);
  rock.add(roughen(new THREE.CylinderGeometry(s, s * 0.96, 0.6, 12, 1), 0.07, seed), cx, cy, cz, 0x34443a, { ry: seed });
  let y = cy - 0.3;
  let r = s * 0.96;
  for (let k = 0; k < 5; k++) {
    const h = s * (0.26 + rnd() * 0.12);
    const rb = r * (0.78 - rnd() * 0.12);
    rock.add(roughen(new THREE.CylinderGeometry(r, rb, h, 11, 1), 0.12, seed + k * 3), cx + (rnd() - 0.5) * s * 0.12, y - h / 2, cz + (rnd() - 0.5) * s * 0.12, STRATA[(k + seed) % STRATA.length], { ry: rnd() * 6 });
    y -= h;
    r = rb;
  }
  // tail: a jagged chunk hanging below, and a few loose lumps
  rock.add(roughen(new THREE.IcosahedronGeometry(r * 0.9, 1), 0.22, seed + 9), cx, y - r * 0.5, cz, 0x1c1e29, { sy: 1.5, ry: seed });
  for (let k = 0; k < 4; k++) {
    const a = rnd() * 6.28, d = s * (0.5 + rnd() * 0.4);
    rock.add(new THREE.IcosahedronGeometry(s * (0.12 + rnd() * 0.1), 0), cx + Math.cos(a) * d, cy - 0.6 - rnd() * s * 0.5, cz + Math.sin(a) * d, 0x2a2c3a, { sy: 0.8, ry: rnd() * 6, rx: rnd() * 6 });
  }
  // hanging roots and vines under the upper strata
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rnd() * 0.6, d = s * (0.5 + rnd() * 0.35), len = s * (0.35 + rnd() * 0.5);
    rock.add(new THREE.ConeGeometry(0.1 + s * 0.015, len, 4), cx + Math.cos(a) * d, cy - 0.7 - len / 2, cz + Math.sin(a) * d, k % 2 ? 0x4a3a2a : 0x3a5a34, { rx: Math.PI, rz: (rnd() - 0.5) * 0.3 });
  }
}

/** A small colonnade with a lintel on top of an island: `n` columns along the tangent, some broken. */
function addTemple(marble: Bucket, cx: number, topY: number, cz: number, ang: number, s: number) {
  const yaw = tanYaw(ang);
  const tx = -Math.sin(ang), tz = Math.cos(ang), nx = -Math.cos(ang), nz = -Math.sin(ang);
  const n = 5, gap = (s * 1.3) / (n - 1);
  marble.add(new THREE.BoxGeometry(s * 1.6, 0.3, s * 0.9), cx, topY + 0.15, cz, 0x6a6a76, { ry: yaw });
  marble.add(new THREE.BoxGeometry(s * 1.7, 0.18, s * 1.0), cx, topY + 0.05, cz, 0x5a5a66, { ry: yaw });
  for (let k = 0; k < n; k++) {
    const t = (k - (n - 1) / 2) * gap;
    const broken = k === 1 || k === 4;
    const h = broken ? 1.6 + k * 0.2 : 3.4;
    marble.add(new THREE.CylinderGeometry(0.26, 0.31, h, 10), cx + tx * t, topY + 0.3 + h / 2, cz + tz * t, 0x8a8a96, { rz: broken ? 0.05 : 0 });
    if (!broken) marble.add(new THREE.BoxGeometry(0.8, 0.18, 0.8), cx + tx * t, topY + 0.3 + h + 0.09, cz + tz * t, 0x7e7e8a, { ry: yaw });
    else marble.add(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), cx + tx * (t + 0.7) + nx * 0.9, topY + 0.55, cz + tz * (t + 0.7) + nz * 0.9, 0x80808c, { rz: Math.PI / 2, ry: yaw + 0.4 });
  }
  // lintel across the two neighbouring intact columns
  marble.add(new THREE.BoxGeometry(gap + 0.9, 0.34, 0.8), cx + tx * gap * 0.5, topY + 0.3 + 3.4 + 0.35, cz + tz * gap * 0.5, 0x7a7a86, { ry: yaw });
}

/** A broken arch: a full pier, a broken pier and an arc of the arch that stops short of the apex. */
function addArch(marble: Bucket, cx: number, topY: number, cz: number) {
  const R = 1.8, spring = topY + 3.0;
  // the arch plane is x = cx; the piers stand at z = cz -/+ R
  marble.add(new THREE.BoxGeometry(0.8, 3.0, 0.8), cx, topY + 1.5, cz - R, 0x8a8a96);
  marble.add(new THREE.BoxGeometry(1.0, 0.24, 1.0), cx, topY + 0.12, cz - R, 0x6a6a76);
  marble.add(new THREE.BoxGeometry(0.8, 1.9, 0.8), cx, topY + 0.95, cz + R, 0x8a8a96, { rx: 0.03 });
  marble.add(new THREE.BoxGeometry(1.0, 0.24, 1.0), cx, topY + 0.12, cz + R, 0x6a6a76);
  marble.add(new THREE.TorusGeometry(R, 0.28, 8, 20, 2.3), cx, spring, cz, 0x8a8a96, { ry: Math.PI / 2 });
  marble.add(new THREE.BoxGeometry(0.7, 0.5, 0.7), cx - 0.3, topY + 0.3, cz + R + 1.1, 0x7a7a86, { ry: 0.5, rz: 0.3 });
  marble.add(new THREE.BoxGeometry(0.5, 0.4, 0.9), cx + 0.2, topY + 0.2, cz + 0.8, 0x7a7a86, { ry: 1.2, rz: -0.2 });
}

interface IslandSpec { rad: number; ang: number; y: number; size: number; ruin: 'columns' | 'temple' | 'arch' }
const ISLANDS: IslandSpec[] = [
  { rad: 34, ang: 0.3, y: 1, size: 5, ruin: 'columns' },
  { rad: 44, ang: 2.5, y: -3, size: 7, ruin: 'temple' },
  { rad: 30, ang: 3.9, y: 3, size: 4, ruin: 'columns' },
  { rad: 48, ang: 4.7, y: -1, size: 8, ruin: 'arch' },
  { rad: 38, ang: 5.6, y: 5, size: 5.5, ruin: 'columns' },
];

/** The broken arch off to the west (|x| > 14), on its own small rock. */
const ARCH_ISLET = { x: -19.5, y: -0.5, z: 8, size: 3.2 };

export const skyruinsArena: ArenaDef = {
  id: 'skyruins',
  name: 'Sky Ruins',
  obstacles: OBSTACLES,
  stage: STAGE,
  hideGround: true,
  build() {
    const g = new THREE.Group();
    const rnd = seeded(4242);
    const rr = (a: number, b: number) => a + (b - a) * rnd();
    const textures: THREE.Texture[] = [];
    const keep = <T extends THREE.Texture>(t: T) => { textures.push(t); return t; };

    // Platform.
    const top = new THREE.Mesh(topGeometry(), new THREE.MeshStandardMaterial({ map: platformTexture(), roughness: 0.85, metalness: 0.05 }));
    top.receiveShadow = true;
    const rimLine = flatRing(RING.r - 0.1, RING.r + 0.04, 0xc9a24a, 0.85, 0.02);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, flatShading: true });
    const skirt = new THREE.Mesh(skirtGeometry(), rockMat);
    skirt.castShadow = skirt.receiveShadow = true;

    // Broken edge blocks on the rim (not where the balustrade stands), and rock chunks hanging under the edge.
    const edge = new Bucket();
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 40; i++) {
      if (i % 7 === 3) continue; // gaps where the edge has crumbled away
      const th = (i / 40) * Math.PI * 2 + rr(-0.03, 0.03);
      if (inBalustrade(th, 3)) continue;
      const r = edgeR(th) - 0.3;
      const h = rr(0.1, 0.55);
      edge.add(box, RING.x + Math.cos(th) * r, h / 2, RING.z + Math.sin(th) * r, [0x34364a, 0x2c2e3e, 0x3c3e52][i % 3], {
        sx: rr(0.5, 1.1), sy: h, sz: rr(0.35, 0.6), ry: -th + rr(-0.4, 0.4),
      });
    }
    const ico = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 16; i++) {
      const th = rnd() * Math.PI * 2, s = rr(0.5, 1.3);
      edge.add(ico, RING.x + Math.cos(th) * edgeR(th) * 0.9, rr(-3.4, -0.7), RING.z + Math.sin(th) * edgeR(th) * 0.9, 0x24262f, { sx: s, sy: s * 0.8, sz: s, ry: rnd() * 6, rx: rnd() * 6 });
    }
    const edgeMesh = edge.mesh(rockMat, true);

    // Columns, the balustrade, fallen drums and a toppled column outside the ring, the gold bands, the ivy.
    const marble = new Bucket(), gold = new Bucket(), ivy = new Bucket();
    OBSTACLES.forEach((o, i) => addColumn(marble, gold, ivy, o, i));
    addBalustrade(marble);
    const drum = new THREE.CylinderGeometry(0.5, 0.5, 0.9, 16);
    [108, 195, 340].forEach((deg, i) => {
      const a = (deg * Math.PI) / 180, r = 12.55 + (i % 3) * 0.12;
      marble.add(drum, RING.x + Math.cos(a) * r, 0.5, RING.z + Math.sin(a) * r, 0x80808c, { rz: Math.PI / 2, ry: rr(0, 6) });
    });
    // a toppled column: three drums in a line along the edge, a capital and fragments
    {
      const a = (256 * Math.PI) / 180, yaw = tanYaw(a), r = 12.65;
      const tx = -Math.sin(a), tz = Math.cos(a);
      for (let k = 0; k < 3; k++) {
        const t = (k - 1) * 1.0 + (k === 2 ? 0.12 : 0);
        marble.add(drum, RING.x + Math.cos(a) * (r + (k === 2 ? 0.1 : 0)) + tx * t, 0.5, RING.z + Math.sin(a) * (r + (k === 2 ? 0.1 : 0)) + tz * t, 0x80808c, { rz: Math.PI / 2, ry: yaw + (k === 2 ? 0.15 : 0) });
      }
      marble.add(new THREE.CylinderGeometry(0.98, 0.74, 0.28, 20), RING.x + Math.cos(a) * (r + 0.15) + tx * 2.0, 0.42, RING.z + Math.sin(a) * (r + 0.15) + tz * 2.0, 0x8e8e9a, { rz: Math.PI / 2, ry: yaw });
      marble.add(new THREE.BoxGeometry(1.9, 0.22, 1.9), RING.x + Math.cos(a) * (r + 0.1) + tx * 2.8, 0.12, RING.z + Math.sin(a) * (r + 0.1) + tz * 2.8, 0x7e7e8a, { ry: yaw + 0.5, rz: 0.1 });
      for (let k = 0; k < 5; k++) {
        const t = rr(-2, 3.4);
        marble.add(box, RING.x + Math.cos(a) * (r + rr(-0.2, 0.3)) + tx * t, 0.1, RING.z + Math.sin(a) * (r + rr(-0.2, 0.3)) + tz * t, 0x7a7a86, { sx: rr(0.2, 0.45), sy: rr(0.15, 0.3), sz: rr(0.2, 0.4), ry: rr(0, 3) });
      }
    }
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8a96, vertexColors: true, roughness: 0.7, metalness: 0.05 });
    const marbleMesh = marble.mesh(marbleMat, true);
    const goldMesh = gold.mesh(new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.4, metalness: 0.8, emissive: 0x2a1a04, emissiveIntensity: 0.6 }), true);
    const ivyMesh = ivy.mesh(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9 }), false);

    // Far floating islands (rocky, layered, with ruins), the broken arch off to the west, loose debris near the platform.
    const floaters = new THREE.Group();
    const islandRock = new Bucket(), islandMarble = new Bucket();
    ISLANDS.forEach((is, i) => {
      const cx = RING.x + Math.cos(is.ang) * is.rad, cz = RING.z + Math.sin(is.ang) * is.rad;
      const s = is.size;
      addIsland(islandRock, cx, is.y, cz, s, i + 1);
      const topY = is.y + 0.3;
      if (is.ruin === 'temple') addTemple(islandMarble, cx, topY, cz, is.ang, s);
      else if (is.ruin === 'arch') {
        addArch(islandMarble, cx, topY, cz);
        const n = 2;
        for (let k = 0; k < n; k++) {
          const a = is.ang + Math.PI + k * 2.4, d = s * 0.5, h = rr(1.8, 3);
          islandMarble.add(new THREE.CylinderGeometry(0.3, 0.36, h, 10), cx + Math.cos(a) * d, topY + h / 2, cz + Math.sin(a) * d, 0x8a8a96, { rz: rr(-0.06, 0.06) });
        }
      } else {
        const n = 3 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + rr(-0.3, 0.3), d = s * 0.5;
          const h = rr(1.8, 3.6);
          islandMarble.add(new THREE.CylinderGeometry(0.3, 0.36, h, 10), cx + Math.cos(a) * d, topY + h / 2, cz + Math.sin(a) * d, 0x8a8a96, { rz: rr(-0.06, 0.06) });
          if (k === 0) islandMarble.add(new THREE.BoxGeometry(d * 1.1, 0.35, 0.6), cx + Math.cos(a) * d * 0.4, topY + h + 0.15, cz + Math.sin(a) * d * 0.4, 0x7a7a86, { ry: -a + Math.PI / 2 });
        }
      }
    });
    addIsland(islandRock, ARCH_ISLET.x, ARCH_ISLET.y, ARCH_ISLET.z, ARCH_ISLET.size, 7);
    addArch(islandMarble, ARCH_ISLET.x, ARCH_ISLET.y + 0.3, ARCH_ISLET.z);
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2, d = rr(17, 26), s = rr(0.3, 0.9);
      if (Math.cos(a) < -0.7 && Math.abs(Math.sin(a) * d) < 6) continue; // keep the arch islet clear
      islandRock.add(ico, RING.x + Math.cos(a) * d, rr(-4, 0.5), RING.z + Math.sin(a) * d, 0x2b2d3a, { sx: s, sy: s * 0.8, sz: s, ry: rnd() * 6, rx: rnd() * 6 });
    }
    floaters.add(islandRock.mesh(rockMat, false), islandMarble.mesh(marbleMat, false));

    // Sea of clouds: an opaque layer 6 m below and a wispy layer above it that the platform's underside pokes through.
    const seaTex = keep(cloudTexture(1024, 9, true, 12));
    const sea = new THREE.Mesh(new THREE.CircleGeometry(320, 48), new THREE.MeshBasicMaterial({ map: seaTex, color: 0xffffff }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(RING.x, -6, RING.z);
    const wispTex = keep(cloudTexture(1024, 21, false, 8));
    const wisps = new THREE.Mesh(
      new THREE.CircleGeometry(240, 48),
      new THREE.MeshBasicMaterial({ map: wispTex, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    wisps.rotation.x = -Math.PI / 2;
    wisps.position.set(RING.x, -4.3, RING.z);

    // Cloud billboards drifting round the platform.
    const puff = keep(puffTexture());
    const mats = [
      new THREE.SpriteMaterial({ map: puff, color: 0xf2c4c4, transparent: true, opacity: 0.75, depthWrite: false }),
      new THREE.SpriteMaterial({ map: puff, color: 0xb4b8ea, transparent: true, opacity: 0.75, depthWrite: false }),
    ];
    interface Drift { sprite: THREE.Sprite; rad: number; ang: number; speed: number }
    const drifts: Drift[] = [];
    for (let i = 0; i < 14; i++) {
      const high = i >= 11;
      const sprite = new THREE.Sprite(mats[i % 2]);
      const w = rr(18, 36);
      sprite.scale.set(w, w * 0.45, 1);
      const rad = high ? rr(50, 75) : rr(22, 70);
      const d: Drift = { sprite, rad, ang: rnd() * Math.PI * 2, speed: rr(0.004, 0.012) * (i % 2 ? 1 : -1) };
      sprite.position.y = high ? rr(2, 7) : rr(-8, -2);
      drifts.push(d);
      g.add(sprite);
    }
    const place = (d: Drift) => d.sprite.position.set(RING.x + Math.cos(d.ang) * d.rad, d.sprite.position.y, RING.z + Math.sin(d.ang) * d.rad);
    drifts.forEach(place);

    // Birds: simple V shapes (two triangles) circling far out, wings flapping.
    const bv = new Float32Array([
      0, 0, 0.35, -1.25, 0.25, -0.1, 0, 0, -0.2,
      0, 0, 0.35, 0, 0, -0.2, 1.25, 0.25, -0.1,
    ]);
    const birdGeo = new THREE.BufferGeometry();
    birdGeo.setAttribute('position', new THREE.BufferAttribute(bv, 3));
    const BIRDS = 9;
    const birds = new THREE.InstancedMesh(birdGeo, new THREE.MeshBasicMaterial({ color: 0x1a1d30, side: THREE.DoubleSide }), BIRDS);
    birds.frustumCulled = false;
    const birdSpec = Array.from({ length: BIRDS }, (_, i) => ({
      rad: rr(36, 58), ang: rnd() * Math.PI * 2, speed: rr(0.025, 0.045) * (i % 3 === 0 ? -1 : 1), y: rr(5, 14), ph: rnd() * 6.28, flap: rr(4, 6), size: rr(0.9, 1.5),
    }));
    const placeBirds = (time: number) => {
      birdSpec.forEach((b, i) => {
        const ang = b.ang + time * b.speed, dir = Math.sign(b.speed);
        _p.set(RING.x + Math.cos(ang) * b.rad, b.y + Math.sin(time * 0.3 + b.ph) * 0.8, RING.z + Math.sin(ang) * b.rad);
        _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-Math.sin(ang) * dir, Math.cos(ang) * dir));
        _m.compose(_p, _q, _s.set(b.size, Math.sin(time * b.flap + b.ph), b.size));
        birds.setMatrixAt(i, _m);
      });
      birds.instanceMatrix.needsUpdate = true;
    };
    placeBirds(0);

    g.add(sea, wisps, skirt, top, rimLine, edgeMesh, marbleMesh, goldMesh, ivyMesh, floaters, birds);

    return {
      group: g,
      update(dt: number, time: number) {
        sea.rotation.z += dt * 0.004;
        wisps.rotation.z -= dt * 0.006;
        for (const d of drifts) { d.ang += d.speed * dt; place(d); }
        floaters.position.y = Math.sin(time * 0.35) * 0.35;
        placeBirds(time);
      },
      dispose() {
        // Sprites are not meshes, so disposeTree skips them.
        for (const m of mats) m.dispose();
        for (const t of textures) t.dispose();
        disposeTree(g);
      },
    };
  },
};
