import * as THREE from 'three';
import type { Obstacle } from '../obstacles';
import { RING, canvasTexture, flatRing, floorDisc, seeded } from './common';
import layout from './real/harbour.json';
import { Glows, Sea, realProps, type RealLayout } from './real';
import type { ArenaDef } from './types';

/**
 * Drowned Harbour: the round head of a stone quay at dusk, the sea all round it. The first arena in the heroes' style
 * (`real.ts`): its cover and everything round the ring are built in blender/arenas/real/harbour.py, which also writes
 * the obstacle list (`real/harbour.json`).
 *
 * Cover: three barrels in the middle (low), two rows of stacked sea chests guarding the starts (low), two mooring
 * posts of lashed piles with a lantern each flanking the middle (tall), two cannons on the wings aimed out to sea
 * (low), two boats laid keel-up on trestles in the far corners (low). Round it: a three-master with furled sails
 * moored on the left, a pier with a lamp arch leading off to the right, low pier stubs toward both cameras, basalt
 * sea stacks and a lighthouse far out.
 *
 * How it got here (the user, twice): scans as photographed were "too much realistic"; the same scans painted in flat
 * colours still had "walls and background too realistic, not the heroes' style". Three readers agreed the cause was
 * the scans' worn, crooked shapes, so everything is now built as the heroes' own props are: clean forms, the heroes'
 * materials (wood, lacquer, wine, iron, gold, rope), gold on the edges, lantern light as the only glow.
 *
 * Built here: the paved floor (rings of smooth slabs with a brass inlay, in the floors' dark band, a little wet), the
 * kerb and the quay's wall of dressed blocks, the sea, and the lanterns' glow (no lamps: the arena rules allow no
 * extra lights).
 */
const LAYOUT = layout as RealLayout;
export const HARBOUR_OBSTACLES: Obstacle[] = LAYOUT.obstacles;

/** The sea's level, as in harbour.py. */
const SEA = -1.7;
/** How far the quay's stone reaches past the ring. */
const KERB = 0.8;

/** Stone tones of the quay: slabs, their joints, the brass let into them. */
const SLAB = [41, 44, 52], JOINT = '#17181d', BRASS = '#7a6030';

/**
 * The quay's paving: rings of smooth slabs round a middle stone, each slab its own shade, thin dark joints, a brass
 * ring near the rim and a brass star in the middle. Drawn across the floor disc's UVs (the disc fills the square).
 */
function pavingTexture() {
  return canvasTexture(2048, (g, size) => {
    const rnd = seeded(31), c = size / 2, px = size / (2 * RING.r);
    g.fillStyle = JOINT;
    g.fillRect(0, 0, size, size);
    const rings = [1.25, 2.4, 3.6, 4.8, 6.0, 7.2, 8.4, 9.6, 10.8, 11.5, 12.1];
    const gap = 0.035;
    const shade = () => {
      const t = 0.86 + 0.28 * rnd(), warm = (rnd() - 0.5) * 6;
      return `rgb(${Math.round(SLAB[0] * t + warm)},${Math.round(SLAB[1] * t)},${Math.round(SLAB[2] * t - warm)})`;
    };
    g.fillStyle = shade();
    g.beginPath();
    g.arc(c, c, (rings[0] - gap) * px, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i + 1 < rings.length; i++) {
      const r0 = rings[i] + gap, r1 = rings[i + 1] - gap, n = Math.max(6, Math.round((Math.PI * (r0 + r1)) / 1.9)), off = rnd() * Math.PI;
      for (let k = 0; k < n; k++) {
        const a0 = off + (k / n) * Math.PI * 2, a1 = off + ((k + 1) / n) * Math.PI * 2, ga = gap / ((r0 + r1) / 2);
        g.fillStyle = shade();
        g.beginPath();
        g.arc(c, c, r1 * px, a0 + ga, a1 - ga);
        g.arc(c, c, r0 * px, a1 - ga, a0 + ga, true);
        g.closePath();
        g.fill();
      }
    }
    // brass let into the stone: a ring near the rim, a ring and an eight-pointed star in the middle
    g.strokeStyle = BRASS;
    g.lineWidth = 0.09 * px;
    for (const r of [11.15, 1.0]) {
      g.beginPath();
      g.arc(c, c, r * px, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = BRASS;
    g.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, r = (k % 2 ? 0.28 : k % 4 ? 0.62 : 0.9) * px;
      g.lineTo(c + Math.sin(a) * r, c - Math.cos(a) * r);
    }
    g.closePath();
    g.fill();
  });
}

/** Courses of dressed blocks for the kerb and the wall, tiling. */
function blockTexture() {
  return canvasTexture(512, (g, size) => {
    const rnd = seeded(5), rows = 4, h = size / rows;
    g.fillStyle = JOINT;
    g.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      const n = 3, w = size / n, off = (r % 2) * (w / 2);
      for (let k = -1; k < n; k++) {
        const t = 0.8 + 0.3 * rnd();
        g.fillStyle = `rgb(${Math.round(SLAB[0] * t)},${Math.round(SLAB[1] * t)},${Math.round(SLAB[2] * t)})`;
        g.fillRect(off + k * w + 3, r * h + 3, w - 6, h - 6);
      }
    }
  });
}

/** The kerb and the wall below it: one turned profile, its UVs stretched so the cobbles keep their size. */
function quayGeometry() {
  const r = RING.r;
  // from the sea bed up the wall and in over the kerb: a profile that climbs faces outward
  const profile = [[r + KERB + 0.12, SEA - 2.5], [r + KERB + 0.03, -0.5], [r + KERB, 0.08], [r + KERB - 0.1, 0.17], [r + 0.02, 0.17], [r - 0.05, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 128);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14, uv.getY(i) * 1.6);
  geo.translate(RING.x, 0, RING.z);
  return geo;
}

export const harbourArena: ArenaDef = {
  id: 'harbour',
  name: 'Drowned Harbour',
  obstacles: HARBOUR_OBSTACLES,
  hideGround: true,
  stage: {
    background: 0x1c2230,
    zenith: 0x0e1730,
    horizon: 0x5a5068,
    glow: 0xe89a62,
    stars: 0.25,
    fog: 0x3a4256,
    fogNear: 26,
    fogFar: 105,
    hemiSky: 0xa9c0e6,
    hemiGround: 0x2a2622,
    hemiIntensity: 0.7,
    sun: 0xffc694,
    sunIntensity: 1.5,
    rim: 0x86a6e2,
    rimIntensity: 0.9,
  },
  build() {
    const g = new THREE.Group();
    const own: { dispose(): void }[] = [];

    // the quay: smooth paving a little wet, a kerb round it, the wall down into the water
    const paving = new THREE.MeshStandardMaterial({ map: pavingTexture(), roughness: 0.48, envMapIntensity: 0.3 });
    const floor = floorDisc(RING.r, paving, 0.012, 128);
    const stone = new THREE.MeshStandardMaterial({ map: blockTexture(), color: 0xf0f2ff, roughness: 0.7, envMapIntensity: 0.2 });
    const quay = new THREE.Mesh(quayGeometry(), stone);
    quay.receiveShadow = true;
    quay.castShadow = true;
    g.add(floor, quay);
    own.push(floor.geometry, paving.map!, paving, quay.geometry, stone.map!, stone);

    // a line of gold let into the kerb, as on the heroes' hems
    const line = flatRing(RING.r + 0.3, RING.r + 0.4, 0x9a7a38, 1, 0.176);
    g.add(line);
    own.push(line.geometry, line.material as THREE.Material);

    const sea = new Sea({ y: SEA, inner: RING.r + KERB + 0.1, deep: 0x0b2a3c, sky: 0x7c7490, band: 0x2c5f7c, glint: 0xffc890, sun: new THREE.Vector3(0.85, 0.2, 0.25), foam: 0x9fb0c0 });
    g.add(sea.mesh);
    own.push(sea);

    const SIZE: Record<string, number> = { lantern: 1, lamp: 1.8, beacon: 5 };
    const glows = new Glows(LAYOUT.marks.filter((m) => SIZE[m.kind]).map((m) => ({ ...m, size: SIZE[m.kind] })), 0xffa040, 1.5);
    g.add(glows.group);
    own.push(glows);

    let disposed = false;
    // the heroes' materials, a shade duller than on a hero: the arena must not outshine them
    void realProps('harbour', HARBOUR_OBSTACLES.length, {
      dim: 0.85, env: 0.35,
      parts: { glow: { emissive: 0xffa040, strength: 2.2 }, cream: { dim: 0.6 }, stone: { dim: 0.8 }, gold: { dim: 0.8 } },
    }).then((props) => {
      if (disposed) return;
      for (const c of props.cover) if (c) g.add(c);
      if (props.back) g.add(props.back);
    }).catch((e) => console.warn('harbour: props failed to load', e));

    return {
      group: g,
      update(_dt, time) {
        sea.update(time);
        glows.update(time);
      },
      dispose() {
        disposed = true;
        for (const o of own) o.dispose();
      },
    };
  },
};
