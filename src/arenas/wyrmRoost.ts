import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import type { Obstacle } from '../obstacles';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef, ArenaStage } from './types';

/** How far the walkable roof reaches from its middle (m). */
export const ROOST_R = RAID_BOSSES.wyrm.ring;

/** Dark bronze for the dial's lines and the stumps' bands (never bright gold: gold on the floor means a zone to stand in). */
const BRONZE = 0x6b4a26;
const SLATE = 0x1b202c;
const STONE = 0x14161f;
const GOLD = 0xc9a24a;
const BONE = 0x9a917f;
const TEAR_PINK = 0xff3fa8;

/** No cover of its own: the fight raises none, as in the Heart's room (./sunkenHeart.ts). */
const COVER: Obstacle[] = [];

/** Night under the Tear: a cool blue-violet key light, low ambient, a pink-violet rim, the sky deep indigo with a faint pink horizon. */
export const ROOST_STAGE: ArenaStage = {
  background: 0x0a0a1e,
  zenith: 0x060617,
  horizon: 0x2a1a4a,
  glow: 0x7a2c6e,
  stars: 1,
  fog: 0x120f2c,
  fogNear: 55,
  fogFar: 170,
  hemiSky: 0x6070c8,
  hemiGround: 0x1a1030,
  hemiIntensity: 0.45,
  sun: 0x8090ff,
  sunIntensity: 1.15,
  rim: 0xd05ab8,
  rimIntensity: 0.8,
};

/**
 * The roof's floor: the old sun-dial, broken and scorched. Dark blue-grey slate in slabs, thin dark bronze hour lines and rings, slabs
 * cracked, long scorch marks from the wyrm's breath, and a few faint violet-pink glints in the cracks (the Tear's light, an emissive
 * drawing of its own). Dark and calm on purpose: pale orange zones (leave) and gold zones (stand) must stand out on it.
 */
function dialFloor() {
  const R = ROOST_R, size = 1536, ppm = size / (2 * R);
  const rnd = seeded(7719);
  // Slabs: rings of them, each a little irregular. Same in both drawings.
  const joints = [0.2, 2.2, 4.6, 7.2, 9.8, 12.0, R];
  const plates: { pts: [number, number][]; tone: number }[] = [];
  joints.slice(0, -1).forEach((r0, i) => {
    const r1 = joints[i + 1], n = i === 0 ? 1 : 8 + i * 4, turn = rnd() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a0 = turn + (k / n) * Math.PI * 2 + 0.012, a1 = turn + ((k + 1) / n) * Math.PI * 2 - 0.012;
      const i0 = i === 0 ? 0 : r0 + 0.05 + rnd() * 0.06, i1 = r1 - 0.05 - rnd() * 0.06, pts: [number, number][] = [];
      const steps = i === 0 ? 24 : 5;
      for (let j = 0; j <= steps; j++) { const a = i === 0 ? (j / steps) * Math.PI * 2 : a0 + ((a1 - a0) * j) / steps; pts.push([Math.cos(a) * i1, Math.sin(a) * i1]); }
      if (i) for (let j = steps; j >= 0; j--) { const a = a0 + ((a1 - a0) * j) / steps; pts.push([Math.cos(a) * i0, Math.sin(a) * i0]); }
      plates.push({ pts, tone: rnd() });
    }
  });
  // Cracks across the slabs, wandering; a few run long. Some of them carry the Tear's light.
  const cracks: { line: [number, number][]; lit: boolean }[] = [];
  for (let k = 0; k < 22; k++) {
    let a = rnd() * Math.PI * 2, r = 1 + rnd() * 10;
    const line: [number, number][] = [[Math.cos(a) * r, Math.sin(a) * r]];
    const len = 2 + rnd() * (k < 6 ? 9 : 4), dir = rnd() < 0.5 ? 1 : -1;
    let walked = 0;
    while (walked < len && r < R - 0.5) {
      const step = 0.3 + rnd() * 0.4;
      a += dir * (step / Math.max(r, 1)) * (0.4 + rnd() * 0.5) + (rnd() - 0.5) * 0.12;
      r += (rnd() - 0.4) * 0.5;
      walked += step;
      line.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    cracks.push({ line, lit: k % 4 === 0 });
  }
  const path = (g: CanvasRenderingContext2D, pts: [number, number][]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * ppm, y * ppm) : g.moveTo(x * ppm, y * ppm)));
    g.closePath();
  };
  const strokeCracks = (g: CanvasRenderingContext2D, style: string, width: number, litOnly = false) => {
    g.strokeStyle = style;
    g.lineWidth = width;
    g.lineCap = g.lineJoin = 'round';
    for (const c of cracks) {
      if (litOnly && !c.lit) continue;
      g.beginPath();
      c.line.forEach(([x, y], i) => (i ? g.lineTo(x * ppm, y * ppm) : g.moveTo(x * ppm, y * ppm)));
      g.stroke();
    }
  };
  // Scorch marks: long dark streaks of its breath, from the north edge sweeping south and a little aside (canvas y is the room's z).
  const scorches: [number, number][][] = [];
  for (let k = 0; k < 6; k++) {
    const x0 = (rnd() - 0.5) * 16, y0 = -R + 1 + rnd() * 3, bend = (rnd() - 0.5) * 0.6, len = 9 + rnd() * 10;
    const line: [number, number][] = [];
    for (let j = 0; j <= 14; j++) { const u = j / 14; line.push([x0 + bend * len * u * u + (rnd() - 0.5) * 0.15, y0 + len * u]); }
    scorches.push(line);
  }
  const color = canvasTexture(size, (g, s) => {
    g.fillStyle = '#0a0c12';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    for (const p of plates) {
      path(g, p.pts);
      const t = p.tone;
      g.fillStyle = `rgb(${24 + t * 9},${28 + t * 9},${40 + t * 11})`;
      g.fill();
      g.strokeStyle = 'rgba(8,10,16,0.9)';
      g.lineWidth = 0.05 * ppm;
      g.stroke();
    }
    // Grit.
    for (let i = 0; i < 1800; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R;
      g.fillStyle = rnd() < 0.5 ? 'rgba(120,130,170,0.06)' : 'rgba(0,0,0,0.14)';
      g.fillRect(Math.cos(a) * r * ppm, Math.sin(a) * r * ppm, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    // The dial: thin dark bronze rings and twelve hour lines, worn.
    g.strokeStyle = 'rgba(112,80,44,0.5)';
    g.lineWidth = 0.07 * ppm;
    for (const r of [2.2, 4.6, 9.8, 12.9]) { g.beginPath(); g.arc(0, 0, r * ppm, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 0.05 * ppm;
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      // The hour lines skip where the dial wore away.
      const gap = rnd() < 0.3 ? 2 + rnd() * 5 : 0;
      g.beginPath();
      g.moveTo(c * 2.2 * ppm, sn * 2.2 * ppm);
      g.lineTo(c * (gap ? gap : 12.9) * ppm, sn * (gap ? gap : 12.9) * ppm);
      g.stroke();
      if (!gap) {
        // An hour mark: a short thick bar between the two outer rings.
        g.lineWidth = 0.16 * ppm;
        g.beginPath();
        g.moveTo(c * 10.4 * ppm, sn * 10.4 * ppm);
        g.lineTo(c * 11.6 * ppm, sn * 11.6 * ppm);
        g.stroke();
        g.lineWidth = 0.05 * ppm;
      }
    }
    // The gnomon's foot in the middle: a worn dark bronze disc.
    g.fillStyle = 'rgba(70,52,30,0.55)';
    g.beginPath(); g.arc(0, 0, 0.9 * ppm, 0, Math.PI * 2); g.fill();
    strokeCracks(g, '#05060a', 0.17 * ppm);
    // Scorch: wide soft dark strokes, then a narrower darker core.
    g.lineCap = g.lineJoin = 'round';
    for (const [w, a] of [[1.5, 0.12], [0.9, 0.18], [0.4, 0.26]] as const) {
      g.strokeStyle = `rgba(4,3,6,${a})`;
      g.lineWidth = w * ppm;
      for (const line of scorches) {
        g.beginPath();
        line.forEach(([x, y], i) => (i ? g.lineTo(x * ppm, y * ppm) : g.moveTo(x * ppm, y * ppm)));
        g.stroke();
      }
    }
  });
  const glow = canvasTexture(size, (g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    // Only some cracks glint, thin, and fainter than the lit slabs would be.
    strokeCracks(g, 'rgba(120,40,110,0.55)', 0.12 * ppm, true);
    strokeCracks(g, '#b04ab8', 0.04 * ppm, true);
  });
  return { color, glow };
}

/** The Tear's outline: a tall, jagged rift, alternating spikes and bites, the same for the black and for its burning edge. */
function tearOutline(): [number, number][] {
  const rnd = seeded(9001), pts: [number, number][] = [], N = 34;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const j = (i % 2 ? 0.72 : 1.1) * (0.85 + rnd() * 0.3);
    // A lens, taller than wide, pinched at top and bottom.
    pts.push([Math.cos(a) * 8.5 * j * (0.7 + 0.3 * Math.abs(Math.sin(a))), Math.sin(a) * 15 * j]);
  }
  return pts;
}

/** A snapped stump of the crown's pillars: dark stone, a broken top, a dark bronze band. */
function stump(tall: number, rnd: () => number, stone: THREE.Material, bronze: THREE.Material) {
  const g = new THREE.Group();
  const w = 0.75 + rnd() * 0.25;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.86, w, tall, 7).translate(0, tall / 2, 0), stone);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(w * 1.25, w * 1.35, 0.3, 7).translate(0, 0.15, 0), stone);
  // The break: a wedge of stone standing off the top at a slant.
  const wedge = new THREE.Mesh(new THREE.ConeGeometry(w * 0.9, 0.55 + rnd() * 0.5, 4).translate(0, tall + 0.2, 0), stone);
  wedge.rotation.set((rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.95, w * 0.98, 0.14, 7).translate(0, tall * 0.55, 0), bronze);
  for (const m of [body, foot, wedge]) m.castShadow = true;
  g.add(body, foot, wedge, band);
  return g;
}

/** A heavy old chain: links alternate flat and upright along a sagging line from `a` to `b`; hanging or lying, as the line falls. */
function chain(a: THREE.Vector3, b: THREE.Vector3, sag: number, link: THREE.BufferGeometry, mat: THREE.Material) {
  const n = Math.max(6, Math.round(a.distanceTo(b) / 0.34));
  const m = new THREE.InstancedMesh(link, mat, n);
  const o = new THREE.Object3D(), p = new THREE.Vector3(), q = new THREE.Vector3();
  const along = (u: number, out: THREE.Vector3) => out.lerpVectors(a, b, u).setY(THREE.MathUtils.lerp(a.y, b.y, u) - Math.sin(u * Math.PI) * sag);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    along(u, p);
    along(Math.min(1, u + 0.02), q);
    o.position.copy(p);
    o.lookAt(q.x === p.x && q.y === p.y && q.z === p.z ? q.setY(q.y + 0.01) : q);
    o.rotateZ(i % 2 ? Math.PI / 2 : 0);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  }
  m.castShadow = true;
  return m;
}

/**
 * The Roost: the Tower's crown, above the Sun Court, open to the sky at night (the Eclipse Wyrm's room, not one of the duel arenas).
 * A round roof of dark blue-grey slate with its broken, scorched sun-dial, a low dark stone parapet with a dark bronze edge, the snapped
 * stumps of the crown's pillars round the rim with old chains, and beyond the lip the gilded plates and big bones of what it ate. Overhead
 * to the north, beyond the rim, the Tear: a black rift with a burning pink edge. All drawn in code from clean forms (blender/arenas/real/
 * STYLE.md); gold only off the floor.
 */
export const wyrmRoostArena: ArenaDef = {
  id: 'roost',
  name: 'The Roost',
  ring: ROOST_R,
  obstacles: COVER,
  stage: ROOST_STAGE,
  build() {
    const g = new THREE.Group();
    const R = ROOST_R;
    const stone = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.65, metalness: 0.1, flatShading: true });
    const slate = new THREE.MeshStandardMaterial({ color: SLATE, roughness: 0.7, metalness: 0.1, flatShading: true, side: THREE.DoubleSide });
    const bronze = new THREE.MeshStandardMaterial({ color: BRONZE, roughness: 0.5, metalness: 0.7, flatShading: true });
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.4, metalness: 0.85, flatShading: true, emissive: 0x8a5a30, emissiveIntensity: 0.05 });
    const bone = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.85, metalness: 0, flatShading: true });
    const iron = new THREE.MeshStandardMaterial({ color: 0x23252e, roughness: 0.55, metalness: 0.7, flatShading: true });

    // The floor.
    const dial = dialFloor();
    const floor = floorDisc(R, new THREE.MeshStandardMaterial({ map: dial.color, color: 0xffffff, roughness: 0.65, metalness: 0.15, emissive: 0xffffff, emissiveMap: dial.glow, emissiveIntensity: 0.5 }), 0.024);
    g.add(floor, flatRing(R - 0.5, R, 0x07080d, 0.9, 0.03));

    // The roof's edge: a low parapet of dark stone with a dark bronze edge, and the rubble ledge of the broken crown past it (the plates
    // and bones lie there). Under 1 m near the camera, so it looks over.
    const lip = new THREE.Mesh(
      new THREE.LatheGeometry(
        [[R, 0], [R, 0.42], [R + 0.5, 0.42], [R + 0.5, 0.16], [R + 1.1, 0.1], [R + 11, -0.2], [R + 11.5, -6], [R + 11.5, -40]].map(([x, y]) => new THREE.Vector2(x, y)),
        128,
      ),
      slate,
    );
    lip.position.set(RING.x, 0, RING.z);
    lip.castShadow = lip.receiveShadow = true;
    const edge = new THREE.Mesh(new THREE.TorusGeometry(R + 0.25, 0.05, 4, 160).rotateX(Math.PI / 2), bronze);
    edge.position.set(RING.x, 0.43, RING.z);
    g.add(lip, edge);

    // Pillar stumps round the rim, with chains. 0 deg is south (the camera's side, +z), 180 deg north: short in the south, tall behind.
    const at = (deg: number, r: number) => { const a = THREE.MathUtils.degToRad(deg); return new THREE.Vector3(RING.x + Math.sin(a) * r, 0, RING.z + Math.cos(a) * r); };
    const rnd = seeded(4417);
    const linkGeo = new THREE.TorusGeometry(0.16, 0.05, 5, 8).scale(1, 1.5, 1);
    const stumps = [[28, 0.55], [332, 0.6], [75, 1.3], [285, 1.4], [118, 2.4], [242, 2.2], [160, 3.2], [200, 2.7]] as const;
    stumps.forEach(([deg, tall], i) => {
      const p = at(deg, R + 1.5), s = stump(tall, rnd, stone, bronze);
      s.position.set(p.x, 0.1, p.z);
      s.rotation.y = rnd() * 6;
      g.add(s);
      // A chain on some: it hangs from the break over the lip and down the outside, or lies across the lip onto the roof's edge.
      if (i % 2 === 0 || tall > 2) {
        const top = new THREE.Vector3(p.x, 0.1 + tall * 0.8, p.z);
        const hang = i % 3 === 0;
        const to = hang ? at(deg + 5, R + 2.4).setY(-3.2 - rnd()) : at(deg + 9 + rnd() * 5, R - 0.1).setY(0.46);
        if (!hang) top.y = Math.min(top.y, 0.9);
        g.add(chain(top, to, hang ? 0.4 : 0.25, linkGeo, iron));
      }
    });

    // Beyond the lip: what it ate. Gilded plates (gold is fine here, off the floor), big bones. Kept low on the south side.
    const plateAt: [number, number, number, number][] = [[-120, 5, 1.3, 2], [-70, 7.5, 1.6, 2.4], [145, 6, 1.8, 1.4], [210, 8, 1.4, 1.8], [100, 9, 1.5, 2.1], [260, 6.5, 1.2, 1.6], [170, 10, 2, 2.4]];
    for (const [deg, d, w, l] of plateAt) {
      const p = at(deg, R + d);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, l), gold);
      plate.position.set(p.x, -0.05, p.z);
      plate.rotation.set((rnd() - 0.5) * 0.3, rnd() * 6.28, (rnd() - 0.5) * 0.3);
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 6).translate(0, 0.08, 0), bronze);
      plate.add(boss);
      plate.castShadow = true;
      g.add(plate);
    }
    // A long bone: a shaft with a knob at each end.
    const longBone = (len: number, th: number) => {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(new THREE.CylinderGeometry(th, th * 1.1, len, 6).rotateZ(Math.PI / 2), bone));
      for (const sx of [-1, 1]) for (const sz of [-0.55, 0.55]) {
        const k = new THREE.Mesh(new THREE.IcosahedronGeometry(th * 1.6, 0), bone);
        k.position.set(sx * len * 0.5, 0, sz * th);
        b.add(k);
      }
      b.traverse((o) => { o.castShadow = true; });
      return b;
    };
    for (const [deg, d, len, th] of [[130, 5.5, 5.5, 0.28], [-100, 6.5, 4.6, 0.25], [195, 4.5, 6.5, 0.32], [245, 7.5, 4, 0.24], [80, 7, 3.6, 0.22], [-150, 9, 5, 0.27]] as const) {
      const p = at(deg, R + d), b = longBone(len, th);
      b.position.set(p.x, th * 0.9, p.z);
      b.rotation.set(0, rnd() * Math.PI, (rnd() - 0.5) * 0.2);
      g.add(b);
    }
    // A great arc of ribs, half sunk in the rubble to the north-west (tall on the far side only).
    for (let k = 0; k < 5; k++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(2.6 - k * 0.12, 0.2, 5, 14, Math.PI * 0.85), bone);
      const p = at(205, R + 6 + k * 0.9);
      rib.position.set(p.x, -0.3, p.z);
      rib.rotation.set(0.15, 0.7, 0);
      rib.castShadow = true;
      g.add(rib);
    }

    // The Tear: to the north, beyond the rim, high, tipped toward the camera. A black jagged plane and, a hair in front of it, its
    // burning pink edge: a strip from the outline outward, bright pink fading to nothing, drawn additive.
    const outline = tearOutline();
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, side: THREE.DoubleSide });
    const black = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)))), blackMat);
    const edgePos: number[] = [], edgeCol: number[] = [], edgeIdx: number[] = [];
    const pink = new THREE.Color(TEAR_PINK);
    outline.forEach(([x, y], i) => {
      const gl = 1 + 0.18 + (i % 2 ? 0.16 : 0.04), inner = 0.97;
      edgePos.push(x * inner, y * inner, 0, x * gl, y * gl, 0);
      edgeCol.push(pink.r, pink.g, pink.b, 0, 0, 0);
      const n = outline.length, j = (i + 1) % n;
      edgeIdx.push(i * 2, i * 2 + 1, j * 2, j * 2, i * 2 + 1, j * 2 + 1);
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));
    edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(edgeCol, 3));
    edgeGeo.setIndex(edgeIdx);
    const edgeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const burn = new THREE.Mesh(edgeGeo, edgeMat);
    burn.position.z = 0.05;
    const tear = new THREE.Group();
    tear.add(black, burn);
    tear.position.set(RING.x, 21, RING.z - 40);
    tear.rotation.x = -0.6;
    g.add(tear);

    return {
      group: g,
      update(dt, time) {
        // The edge smoulders: a slow, uneven pulse.
        edgeMat.color.setScalar(0.88 + 0.12 * Math.sin(time * 1.3) * Math.sin(time * 0.37 + 1));
      },
      dispose() {
        disposeTree(g);
      },
    };
  },
};
