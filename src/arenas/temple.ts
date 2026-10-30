import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DUEL_OBSTACLES, type Obstacle } from '../obstacles';
import { DEFAULT_STAGE, RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef } from './types';

/**
 * The Night Temple: an old moonlit temple court. A dark engraved-stone disc with a faint sun-wheel mandala and worn
 * slab joints, a low stepped curb with a gold line at the rim, four braziers outside it at the diagonals, fluted
 * columns and carved screen walls as cover (same collision as `DUEL_OBSTACLES`), a flagstone apron, and a backdrop
 * of silhouetted gate, colonnades, banners and a pale moon. Incense motes drift over the ring.
 */

const GOLD = 0xc9a24a;

// ---- merge helper: transformed geometry with a vertex colour, merged into one mesh ------------------------------

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
    _q.setFromEuler(_e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0));
    _m.compose(_p.set(x, y, z), _q, _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    g.applyMatrix4(_m);
    this.geos.push(g);
  }
  /** A box centred at (x, y, z). */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, ry = 0) {
    this.add(BOX, x, y, z, color, { sx: w, sy: h, sz: d, ry });
  }
  mesh(mat: THREE.Material, shadow = true) {
    const merged = mergeGeometries(this.geos, false);
    for (const g of this.geos) g.dispose();
    if (!merged) throw new Error('temple: geometry merge failed');
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = m.receiveShadow = shadow;
    return m;
  }
}

const BOX = new THREE.BoxGeometry(1, 1, 1);

/** A fluted shaft: an open cylinder whose odd segments are pulled in, faceted. */
function flutedShaft(rBot: number, rTop: number, h: number, flutes: number) {
  const seg = flutes * 2;
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, true);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if ((i % (seg + 1)) % 2 === 1) pos.setXYZ(i, pos.getX(i) * 0.9, pos.getY(i), pos.getZ(i) * 0.9);
  }
  const ng = g.toNonIndexed();
  g.dispose();
  ng.computeVertexNormals();
  return ng;
}

// ---- cover -----------------------------------------------------------------------------------------------------

const STONE = 0x4b4757;
const STONE_DARK = 0x38343f;
const STONE_LIGHT = 0x5a5568;

function addColumn(stone: Bucket, gold: Bucket, x: number, z: number, seed: number) {
  const rnd = seeded(seed);
  const ry = rnd() * Math.PI;
  const tone = rnd() * 0.03;
  const col = (c: number) => _c.setHex(c).offsetHSL(0, 0, tone - 0.015).getHex();
  // base: plinth 1.8 square, torus moulding
  stone.box(x, 0.17, z, 1.8, 0.34, 1.8, col(STONE_DARK), ry);
  stone.add(new THREE.TorusGeometry(0.74, 0.1, 6, 16), x, 0.42, z, col(STONE), { rx: Math.PI / 2 });
  // fluted shaft 0.47 .. 3.4
  stone.add(flutedShaft(0.74, 0.62, 2.95, 10), x, 1.94, z, col(STONE_LIGHT));
  // gold necking band
  gold.add(new THREE.CylinderGeometry(0.66, 0.66, 0.1, 16), x, 3.38, z, GOLD);
  // capital: echinus, abacus, carved volutes
  stone.add(new THREE.CylinderGeometry(0.88, 0.62, 0.34, 16), x, 3.6, z, col(STONE));
  stone.box(x, 3.9, z, 1.7, 0.26, 1.7, col(STONE_LIGHT), ry);
  stone.box(x, 4.1, z, 1.5, 0.1, 1.5, col(STONE_DARK), ry);
  for (let k = 0; k < 4; k++) {
    const a = ry + k * Math.PI / 2;
    stone.add(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 8), x + Math.cos(a) * 0.78, 3.62, z - Math.sin(a) * 0.78, col(STONE_LIGHT), { rx: Math.PI / 2, ry: a });
  }
}

/** Rotates a local (lx, lz) offset the way a mesh with rotation.y = ry rotates it. */
const rot = (lx: number, lz: number, ry: number) => [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)];

/** A ruined screen wall along the obstacle's segment: plinth, panels of varied height, pilasters, gold frieze. */
function addScreenWall(stone: Bucket, gold: Bucket, o: Obstacle, seed: number) {
  const rnd = seeded(seed);
  const dx = o.bx - o.ax, dz = o.bz - o.az;
  const seg = Math.hypot(dx, dz);
  const L = seg + 2 * o.r;
  const ry = Math.atan2(-dz, dx);
  const cx = (o.ax + o.bx) / 2, cz = (o.az + o.bz) / 2;
  const at = (lx: number, ly: number, lz: number): [number, number, number] => {
    const [wx, wz] = rot(lx, lz, ry);
    return [cx + wx, ly, cz + wz];
  };
  const box = (lx: number, ly: number, lz: number, w: number, h: number, d: number, c: number, target = stone) => {
    const [x, y, z] = at(lx, ly, lz);
    target.box(x, y, z, w, h, d, c, ry);
  };
  box(0, 0.2, 0, L + 0.1, 0.4, 0.86, STONE_DARK);
  const n = Math.max(3, Math.round(L / 1.1));
  const pw = L / n;
  for (let i = 0; i < n; i++) {
    const lx = -L / 2 + pw * (i + 0.5);
    const h = i % 2 === 0 ? 1.55 + rnd() * 0.25 : 1.8 + rnd() * 0.5; // ruined: uneven panel heights
    box(lx, 0.4 + h / 2, 0, pw - 0.04, h, 0.66, STONE);
    // recessed carved panel, both faces
    box(lx, 0.4 + h * 0.4, 0.31, pw * 0.6, h * 0.45, 0.06, STONE_DARK);
    box(lx, 0.4 + h * 0.4, -0.31, pw * 0.6, h * 0.45, 0.06, STONE_DARK);
    // gold frieze band under the cornice
    box(lx, 0.4 + h - 0.2, 0, pw - 0.02, 0.14, 0.7, GOLD, gold);
    box(lx, 0.4 + h + 0.04, 0, pw + 0.02, 0.1, 0.76, STONE_LIGHT);
  }
  // pilasters with gold caps, at both ends and between panels
  for (let i = 0; i <= n; i += 2) {
    const lx = -L / 2 + pw * i;
    const lxc = THREE.MathUtils.clamp(lx, -L / 2 + 0.17, L / 2 - 0.17);
    box(lxc, 1.3, 0, 0.34, 2.1, 0.78, STONE_LIGHT);
    box(lxc, 2.4, 0, 0.42, 0.1, 0.84, GOLD, gold);
  }
}

// ---- textures --------------------------------------------------------------------------------------------------

function floorTexture() {
  return canvasTexture(1024, (g, s) => {
    const rnd = seeded(7);
    const ppm = s / 24; // px per metre (disc diameter 24 m)
    const c = s / 2;
    g.fillStyle = '#17151d';
    g.fillRect(0, 0, s, s);
    // slabs 2 m, every other row offset, each with its own slight tone
    const slab = 2 * ppm;
    for (let row = -1; row * slab < s; row++) {
      const off = row % 2 === 0 ? 0 : slab / 2;
      for (let x = -slab; x < s + slab; x += slab) {
        const t = rnd();
        g.fillStyle = t < 0.5 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.05)';
        g.fillRect(x + off, row * slab, slab, slab);
      }
    }
    g.strokeStyle = 'rgba(6,5,9,0.85)';
    g.lineWidth = 2.5;
    for (let row = 0; row * slab <= s + slab; row++) {
      const off = row % 2 === 0 ? 0 : slab / 2;
      g.beginPath(); g.moveTo(0, row * slab); g.lineTo(s, row * slab); g.stroke();
      for (let x = off; x < s; x += slab) { g.beginPath(); g.moveTo(x, row * slab); g.lineTo(x, (row + 1) * slab); g.stroke(); }
    }
    // sun-wheel mandala, low contrast
    g.save();
    g.translate(c, c);
    g.strokeStyle = 'rgba(120,108,150,0.2)';
    g.lineWidth = 2.5;
    for (const r of [2.4, 4.6, 7.0, 9.7, 11.2]) { g.beginPath(); g.arc(0, 0, r * ppm, 0, Math.PI * 2); g.stroke(); }
    // 16 petals between 2.4 and 4.6
    for (let i = 0; i < 16; i++) {
      g.save();
      g.rotate((i / 16) * Math.PI * 2);
      g.beginPath();
      g.moveTo(2.4 * ppm, 0);
      g.quadraticCurveTo(3.5 * ppm, 0.85 * ppm, 4.6 * ppm, 0);
      g.quadraticCurveTo(3.5 * ppm, -0.85 * ppm, 2.4 * ppm, 0);
      g.stroke();
      g.restore();
    }
    // 32 fine spokes between 4.6 and 7
    g.lineWidth = 1.5;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      g.beginPath(); g.moveTo(Math.cos(a) * 4.6 * ppm, Math.sin(a) * 4.6 * ppm); g.lineTo(Math.cos(a) * 7 * ppm, Math.sin(a) * 7 * ppm); g.stroke();
    }
    // 16 sun rays between 7 and 9.7, long and short alternating
    g.strokeStyle = 'rgba(150,126,80,0.2)';
    g.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? 9.7 : 8.6;
      const w = 0.12;
      g.beginPath();
      g.moveTo(Math.cos(a - w) * 7 * ppm, Math.sin(a - w) * 7 * ppm);
      g.lineTo(Math.cos(a) * rr * ppm, Math.sin(a) * rr * ppm);
      g.lineTo(Math.cos(a + w) * 7 * ppm, Math.sin(a + w) * 7 * ppm);
      g.stroke();
    }
    // dot ring at 10.5
    g.fillStyle = 'rgba(150,126,80,0.22)';
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      g.beginPath(); g.arc(Math.cos(a) * 10.5 * ppm, Math.sin(a) * 10.5 * ppm, 2.6, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // cracks
    g.strokeStyle = 'rgba(5,4,8,0.8)';
    g.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      let x = rnd() * s, y = rnd() * s, a = rnd() * Math.PI * 2;
      g.beginPath(); g.moveTo(x, y);
      const steps = 6 + Math.floor(rnd() * 8);
      for (let i = 0; i < steps; i++) {
        a += (rnd() - 0.5) * 1.1;
        x += Math.cos(a) * (10 + rnd() * 22); y += Math.sin(a) * (10 + rnd() * 22);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // wear speckle
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)';
      g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 3, 1 + rnd() * 3);
    }
  });
}

function apronTexture() {
  return canvasTexture(1024, (g, s) => {
    const rnd = seeded(31);
    g.fillStyle = '#121017';
    g.fillRect(0, 0, s, s);
    const n = 4;
    const slab = s / n;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const jx = (rnd() - 0.5) * 10, jy = (rnd() - 0.5) * 10;
        g.fillStyle = `rgba(${40 + rnd() * 14},${36 + rnd() * 12},${50 + rnd() * 14},0.16)`;
        g.fillRect(col * slab + 4 + jx, row * slab + 4 + jy, slab - 8, slab - 8);
      }
    }
    g.strokeStyle = 'rgba(4,3,7,0.9)';
    g.lineWidth = 5;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(0, i * slab); g.lineTo(s, i * slab); g.stroke();
      g.beginPath(); g.moveTo(i * slab, 0); g.lineTo(i * slab, s); g.stroke();
    }
    // weeds / moss specks and cracks
    for (let i = 0; i < 260; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(30,44,30,0.35)' : 'rgba(0,0,0,0.25)';
      g.beginPath(); g.arc(rnd() * s, rnd() * s, 2 + rnd() * 7, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(4,3,7,0.8)';
    g.lineWidth = 2.5;
    for (let k = 0; k < 8; k++) {
      let x = rnd() * s, y = rnd() * s, a = rnd() * 6.28;
      g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < 7; i++) { a += (rnd() - 0.5); x += Math.cos(a) * 30; y += Math.sin(a) * 30; g.lineTo(x, y); }
      g.stroke();
    }
  }, 14);
}

function dotTexture() {
  return canvasTexture(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
}

function moonTexture() {
  return canvasTexture(512, (g, s) => {
    const c = s / 2;
    const halo = g.createRadialGradient(c, c, s * 0.12, c, c, c);
    halo.addColorStop(0, 'rgba(190,205,255,0.5)');
    halo.addColorStop(0.5, 'rgba(120,140,220,0.12)');
    halo.addColorStop(1, 'rgba(120,140,220,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, s, s);
    const r = s * 0.17;
    const disc = g.createRadialGradient(c - r * 0.3, c - r * 0.3, r * 0.1, c, c, r);
    disc.addColorStop(0, '#f2f4ff');
    disc.addColorStop(1, '#bcc6e6');
    g.fillStyle = disc;
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
    const rnd = seeded(5);
    g.save();
    g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.clip();
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(110,120,160,${0.12 + rnd() * 0.12})`;
      g.beginPath(); g.arc(c + (rnd() - 0.5) * r * 1.5, c + (rnd() - 0.5) * r * 1.5, r * (0.06 + rnd() * 0.16), 0, Math.PI * 2); g.fill();
    }
    g.restore();
  });
}

function bannerTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#2a1840';
    g.fillRect(0, 0, s, s);
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#8a6c2a';
    g.lineWidth = 8;
    g.strokeRect(10, 10, s - 20, s - 20);
    // sun emblem
    g.translate(s / 2, s * 0.42);
    g.fillStyle = '#8a6c2a';
    g.beginPath(); g.arc(0, 0, s * 0.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a6c2a';
    g.lineWidth = 6;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath(); g.moveTo(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14); g.lineTo(Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22); g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // swallow-tail cut at the bottom is done by alpha
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(0, s); g.lineTo(s / 2, s * 0.86); g.lineTo(s, s); g.fill();
  });
}

// ---- the arena -------------------------------------------------------------------------------------------------

export const templeArena: ArenaDef = {
  id: 'temple',
  name: 'Night Temple',
  obstacles: DUEL_OBSTACLES,
  stage: DEFAULT_STAGE,
  build() {
    const g = new THREE.Group();

    // Floor, apron
    const apron = floorDisc(
      34,
      new THREE.MeshStandardMaterial({ map: apronTexture(), color: 0xffffff, roughness: 0.9, metalness: 0.05 }),
      0.004,
      64,
    );
    const disc = floorDisc(
      RING.r,
      new THREE.MeshStandardMaterial({ map: floorTexture(), color: 0xffffff, roughness: 0.85, metalness: 0.1, transparent: true, opacity: 0.92 }),
    );
    disc.receiveShadow = false;
    const band = flatRing(RING.r - 0.9, RING.r - 0.2, 0x6a4a9a, 0.2, 0.018);
    const rim = flatRing(RING.r - 0.12, RING.r, GOLD, 0.7, 0.02);
    const centre = flatRing(1.1, 1.18, GOLD, 0.3, 0.02);
    g.add(apron, disc, band, rim, centre);

    // Stepped curb: inner step 0.28 m, outer 0.14 m, gold line on the inner top edge
    const curb = new THREE.Mesh(
      new THREE.LatheGeometry(
        [[12.0, 0], [12.0, 0.28], [12.45, 0.28], [12.45, 0.14], [12.95, 0.14], [12.95, 0]].map(([x, y]) => new THREE.Vector2(x, y)),
        96,
      ),
      new THREE.MeshStandardMaterial({ color: 0x3a3642, roughness: 0.9, side: THREE.DoubleSide }),
    );
    curb.position.set(RING.x, 0, RING.z);
    curb.castShadow = curb.receiveShadow = true;
    const curbGold = flatRing(12.02, 12.14, GOLD, 0.9, 0.285);
    g.add(curb, curbGold);

    // Cover
    const stone = new Bucket();
    const gold = new Bucket();
    DUEL_OBSTACLES.forEach((o, i) => {
      if (o.kind === 'pillar') addColumn(stone, gold, o.ax, o.az, 100 + i);
      else addScreenWall(stone, gold, o, 200 + i);
    });
    const goldMat = new THREE.MeshStandardMaterial({ color: GOLD, vertexColors: true, roughness: 0.5, metalness: 0.5, emissive: 0x5a4210, emissiveIntensity: 0.4 });

    // Braziers outside the rim at the diagonals (radius 13.5, 1.15 m high)
    const braziers: { x: number; z: number }[] = [];
    const bs = new Bucket();
    const bg = new Bucket();
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const x = RING.x + Math.cos(a) * 13.5, z = RING.z + Math.sin(a) * 13.5;
      braziers.push({ x, z });
      bs.add(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 10), x, 0.11, z, STONE_DARK);
      bs.add(new THREE.CylinderGeometry(0.1, 0.14, 0.62, 8), x, 0.52, z, 0x2e2a36);
      bs.add(new THREE.CylinderGeometry(0.46, 0.24, 0.3, 12), x, 0.98, z, 0x3a3030);
      bg.add(new THREE.TorusGeometry(0.46, 0.035, 6, 16), x, 1.13, z, GOLD, { rx: Math.PI / 2 });
    }
    const brazierStone = bs.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    const brazierGold = bg.mesh(goldMat);
    g.add(stone.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.05 })), gold.mesh(goldMat), brazierStone, brazierGold);

    // Brazier coals + ground glow (additive, dim)
    const glowGeos: THREE.BufferGeometry[] = [];
    for (const b of braziers) {
      const coal = new THREE.CircleGeometry(0.38, 12);
      coal.rotateX(-Math.PI / 2);
      coal.translate(b.x, 1.12, b.z);
      glowGeos.push(coal);
      const gl = new THREE.CircleGeometry(1.1, 20);
      gl.rotateX(-Math.PI / 2);
      gl.translate(b.x, 0.03, b.z);
      glowGeos.push(gl);
    }
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
    const glow = new THREE.Mesh(mergeGeometries(glowGeos)!, glowMat);
    glowGeos.forEach((x) => x.dispose());
    g.add(glow);

    // Flame particles: 14 per brazier
    const FL = 14;
    const flamePos = new Float32Array(braziers.length * FL * 3);
    const flameCol = new Float32Array(braziers.length * FL * 3);
    const flamePhase = new Float32Array(braziers.length * FL);
    const frnd = seeded(77);
    for (let i = 0; i < flamePhase.length; i++) flamePhase[i] = frnd();
    const flameGeo = new THREE.BufferGeometry();
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameCol, 3));
    const dot = dotTexture();
    const flames = new THREE.Points(
      flameGeo,
      new THREE.PointsMaterial({ size: 0.34, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    flames.frustumCulled = false;
    g.add(flames);

    // Incense motes: 24, slowly rising gold
    const MOTES = 24;
    const mrnd = seeded(404);
    const moteBase = new Float32Array(MOTES * 4); // angle, radius, y0, speed
    const motePos = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      moteBase[i * 4] = mrnd() * Math.PI * 2;
      moteBase[i * 4 + 1] = 2 + mrnd() * 10;
      moteBase[i * 4 + 2] = mrnd() * 3;
      moteBase[i * 4 + 3] = 0.12 + mrnd() * 0.14;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({ size: 0.1, map: dot, color: 0xe0b860, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    motes.frustumCulled = false;
    g.add(motes);

    // ---- backdrop -------------------------------------------------------------------------------------------
    const rnd = seeded(2024);
    const sil = new Bucket();
    const SIL = 0x2a2836;
    const sil2 = 0x332f40;
    const colGeo = new THREE.CylinderGeometry(0.8, 0.95, 1, 8);
    const cols: { x: number; z: number; h: number; r: number }[] = [];
    const banners: { x: number; z: number; y: number }[] = [];

    // ruined gates, on the z axis at radius 34 (beyond 26 m)
    const gate = (cz: number) => {
      sil.box(-5.6, 7.5, cz, 2.4, 15, 2.4, SIL);
      sil.box(-5.6, 0.4, cz, 3.2, 0.8, 3.2, sil2);
      sil.box(-5.6, 15.3, cz, 3, 0.7, 3, sil2);
      sil.box(5.6, 4.6, cz, 2.4, 9.2, 2.4, SIL); // right pillar broken
      sil.box(5.6, 0.4, cz, 3.2, 0.8, 3.2, sil2);
      sil.box(7.0, 9.5, cz + 0.4, 1.0, 0.7, 1.3, SIL, 0.4); // fallen-looking chunk
      sil.box(-1.2, 14.2, cz, 8.6, 1.8, 2.2, SIL); // lintel, broken short of the right pillar
      sil.box(-1.2, 15.5, cz, 9.4, 0.7, 2.6, sil2);
      sil.box(-3.5, 16.7, cz, 4.5, 1.7, 1.8, SIL); // upper tier
      sil.box(-12, 2.6, cz, 8, 5.2, 1.6, SIL); // flanking ruined walls
      sil.box(13, 1.7, cz, 9, 3.4, 1.6, SIL);
      sil.box(17.5, 4, cz, 2, 8, 1.6, SIL);
    };
    gate(RING.z - 34);
    gate(RING.z + 34);

    // colonnade sections along arcs
    const sections = [
      { a0: -172, a1: -112, R: 30, n: 7 },
      { a0: -70, a1: -8, R: 30, n: 7 },
      { a0: 12, a1: 72, R: 31, n: 7 },
      { a0: 110, a1: 168, R: 30, n: 7 },
      { a0: -22, a1: 22, R: 22, n: 5 }, // off the z axis (|x| > 12)
      { a0: 158, a1: 202, R: 22, n: 5 },
    ];
    sections.forEach((sec, si) => {
      const pts: { x: number; z: number; h: number }[] = [];
      for (let i = 0; i < sec.n; i++) {
        const a = THREE.MathUtils.degToRad(sec.a0 + ((sec.a1 - sec.a0) * i) / (sec.n - 1));
        const x = RING.x + Math.cos(a) * sec.R, z = RING.z + Math.sin(a) * sec.R;
        const intact = rnd() < 0.6;
        const h = intact ? 9 : 3 + rnd() * 5;
        pts.push({ x, z, h });
        cols.push({ x, z, h, r: 1 });
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], B = pts[i + 1];
        if (A.h < 9 || B.h < 9) continue;
        const len = Math.hypot(B.x - A.x, B.z - A.z);
        sil.box((A.x + B.x) / 2, 9.6, (A.z + B.z) / 2, len + 0.6, 1.2, 1.5, sil2, Math.atan2(-(B.z - A.z), B.x - A.x));
        if (si < 4 && i % 2 === 0) banners.push({ x: (A.x + B.x) / 2, z: (A.z + B.z) / 2, y: 9 });
      }
    });
    // two banners flank each gate as well
    for (const cz of [RING.z - 34, RING.z + 34]) {
      banners.push({ x: -1.2, z: cz + (cz < RING.z ? 1.5 : -1.5), y: 13.4 });
    }

    // low rubble round the ring (< 2 m) between radius 16 and 26, a few tall broken columns only off the z axis
    const rubble: { x: number; z: number; y: number; sx: number; sy: number; sz: number; ry: number; c: number }[] = [];
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2, r = 16 + rnd() * 10;
      const h = 0.25 + rnd() * 1.3;
      const w = 0.6 + rnd() * 1.6;
      const x = RING.x + Math.cos(a) * r, z = RING.z + Math.sin(a) * r;
      rubble.push({ x, z, y: h / 2, sx: w, sy: h, sz: w * (0.6 + rnd() * 0.6), ry: rnd() * Math.PI, c: 0x2a2634 + Math.floor(rnd() * 8) * 0x010101 });
    }
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (14 + rnd() * 6), z = RING.z + (rnd() - 0.5) * 22;
      cols.push({ x, z, h: 4 + rnd() * 3, r: 0.8 });
    }

    // tall silhouettes must be > 26 m from the centre or off the z axis (|x| > 12)
    for (const c of cols) {
      if (c.h > 2 && Math.hypot(c.x - RING.x, c.z - RING.z) <= 26 && Math.abs(c.x) <= 12) throw new Error('temple: backdrop breaks the camera rule');
    }

    const silMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const silMesh = sil.mesh(silMat, false);
    g.add(silMesh);

    const colMesh = new THREE.InstancedMesh(colGeo, new THREE.MeshBasicMaterial({ color: 0x2a2836 }), cols.length);
    cols.forEach((c, i) => {
      _m.compose(_p.set(c.x, c.h / 2, c.z), _q.identity(), _s.set(c.r, c.h, c.r));
      colMesh.setMatrixAt(i, _m);
    });
    colMesh.instanceMatrix.needsUpdate = true;
    g.add(colMesh);

    const rubMesh = new THREE.InstancedMesh(BOX.clone(), new THREE.MeshStandardMaterial({ roughness: 0.95 }), rubble.length);
    rubble.forEach((r, i) => {
      _m.compose(_p.set(r.x, r.y, r.z), _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.ry), _s.set(r.sx, r.sy, r.sz));
      rubMesh.setMatrixAt(i, _m);
      rubMesh.setColorAt(i, _c.setHex(r.c));
    });
    rubMesh.instanceMatrix.needsUpdate = true;
    if (rubMesh.instanceColor) rubMesh.instanceColor.needsUpdate = true;
    rubMesh.castShadow = rubMesh.receiveShadow = true;
    g.add(rubMesh);

    // hanging banners (shared geometry and material), swaying slightly
    const bannerGeo = new THREE.PlaneGeometry(1.8, 5.5);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    const bannerMeshes: THREE.Mesh[] = [];
    banners.forEach((b, i) => {
      const m = new THREE.Mesh(bannerGeo, bannerMat);
      m.position.set(b.x, b.y - 2.75, b.z); // b.y is the top edge
      m.rotation.y = Math.atan2(RING.x - b.x, RING.z - b.z);
      m.userData.phase = i * 1.7;
      m.userData.baseRy = m.rotation.y;
      bannerMeshes.push(m);
      g.add(m);
    });

    // pale low moon far away (a sprite, ignores fog)
    const moon = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, depthWrite: false, fog: false, color: 0xdfe6ff }),
    );
    moon.scale.set(150, 150, 1);
    moon.position.set(-110, 52, RING.z - 160);
    g.add(moon);

    const update = (dt: number, time: number) => {
      // flames
      for (let b = 0; b < braziers.length; b++) {
        const br = braziers[b];
        for (let j = 0; j < FL; j++) {
          const idx = b * FL + j;
          const ph = flamePhase[idx];
          const t = (time * 0.9 + ph) % 1;
          const w = 0.16 * (1 - t) * (0.6 + 0.4 * Math.sin(time * 7 + ph * 40));
          flamePos[idx * 3] = br.x + Math.sin(ph * 60 + time * 4) * w;
          flamePos[idx * 3 + 1] = 1.18 + t * 0.62;
          flamePos[idx * 3 + 2] = br.z + Math.cos(ph * 47 + time * 3.4) * w;
          const f = Math.pow(1 - t, 0.9) * 0.8;
          flameCol[idx * 3] = f;
          flameCol[idx * 3 + 1] = f * (0.7 - 0.5 * t);
          flameCol[idx * 3 + 2] = f * 0.2 * (1 - t);
        }
      }
      flameGeo.attributes.position.needsUpdate = true;
      flameGeo.attributes.color.needsUpdate = true;
      glowMat.opacity = 0.11 + 0.035 * Math.sin(time * 9) * Math.sin(time * 5.3 + 1);
      // motes
      for (let i = 0; i < MOTES; i++) {
        const a = moteBase[i * 4] + time * 0.04, r = moteBase[i * 4 + 1];
        const y = (moteBase[i * 4 + 2] + time * moteBase[i * 4 + 3]) % 3.2;
        motePos[i * 3] = RING.x + Math.cos(a) * r + Math.sin(time * 0.5 + i) * 0.3;
        motePos[i * 3 + 1] = 0.3 + y;
        motePos[i * 3 + 2] = RING.z + Math.sin(a) * r + Math.cos(time * 0.4 + i * 2) * 0.3;
      }
      moteGeo.attributes.position.needsUpdate = true;
      // banners
      for (const m of bannerMeshes) m.rotation.y = m.userData.baseRy + Math.sin(time * 0.6 + m.userData.phase) * 0.08;
      void dt;
    };

    return {
      group: g,
      update,
      dispose() {
        (moon.material.map as THREE.Texture | null)?.dispose();
        moon.material.dispose();
        disposeTree(g);
      },
    };
  },
};
