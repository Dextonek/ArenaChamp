import * as THREE from 'three';
import type { Obstacle } from '../obstacles';
import { RING, canvasTexture, flatRing, floorDisc, seeded } from './common';
import { DustDevils } from './hazards/canyon';
import { canyonShift } from './shifts/canyon';
import layout from './real/canyon.json';
import { Glows, realProps, type RealLayout } from './real';
import type { ArenaDef } from './types';

/**
 * Sandstone Canyon: the paved court of an old caravan stop on a canyon floor at dusk, between wind-carved walls. An
 * arena in the heroes' style (`real.ts`, blender/arenas/real/STYLE.md): its cover and everything round the ring are
 * built in blender/arenas/real/canyon.py, which also writes the obstacle list (`real/canyon.json`).
 *
 * Cover: the dry well in the middle (low), two fallen columns guarding the starts (low), two wind-carved rock pillars
 * with a way lantern each flanking the middle (tall), two clusters of glazed jars on the wings (low), two fallen
 * statues by their plinths in the far corners (low). Round it: the canyon runs along z, toward both cameras, its walls
 * two terraces of rounded bastions left and right; a broken colonnade, a trader's awning and banners beside the court;
 * a great rock arch across the far end, mesas beyond. The arena's own colour is the turquoise of glazed tiles and cloth.
 *
 * Built here: the court's paving (square flags inside a ring of kerb stones, a line of turquoise tiles round the rim
 * and round the well, in the floors' dark band), the kerb, the sand of the canyon floor and the old road through it,
 * all drawn, and the lanterns' glow (no lamps: the arena rules allow no extra lights).
 */
const LAYOUT = layout as RealLayout;
export const CANYON_OBSTACLES: Obstacle[] = LAYOUT.obstacles;

/** How far the court's kerb reaches past the ring. */
const KERB = 0.8;
/** The sand's level round the court. */
const SAND_Y = -0.03;

/** The court's stone (warm, in the dark band of the harbour's slabs), its joints, the tiles and the brass in it. */
const FLAG = [47, 42, 39], JOINT = '#171514', TILE = [20, 66, 64], BRASS = '#74592c';
/** The sand of the canyon floor at dusk, and the worn stone of the road. */
const SAND = [56, 44, 40], ROAD = [47, 40, 37];

const tone = (c: number[], t: number, warm = 0) => `rgb(${Math.round(c[0] * t + warm)},${Math.round(c[1] * t)},${Math.round(c[2] * t - warm)})`;

/**
 * The court's paving: square flags in running rows, a ring of long kerb stones round them, a line of turquoise tiles
 * between two brass lines where they meet, and the same round the well. Drawn across the floor disc's UVs.
 */
function courtTexture() {
  return canvasTexture(2048, (g, size) => {
    const rnd = seeded(47), c = size / 2, px = size / (2 * RING.r);
    const shade = (base = FLAG) => tone(base, 0.86 + 0.28 * rnd(), (rnd() - 0.5) * 5);
    g.fillStyle = JOINT;
    g.fillRect(0, 0, size, size);
    // the field of square flags, each row shifted half a flag
    const flag = 1.5, gap = 0.035, field = 10.3;
    g.save();
    g.beginPath();
    g.arc(c, c, field * px, 0, Math.PI * 2);
    g.clip();
    for (let j = -8; j < 8; j++) {
      for (let i = -9; i < 9; i++) {
        const x = (i + (j & 1 ? 0.5 : 0)) * flag, z = j * flag;
        g.fillStyle = shade();
        g.fillRect(c + (x + gap) * px, c + (z + gap) * px, (flag - 2 * gap) * px, (flag - 2 * gap) * px);
      }
    }
    g.restore();
    const stones = (r0: number, r1: number, n: number, base = FLAG, join = gap) => {
      const off = rnd() * Math.PI;
      for (let k = 0; k < n; k++) {
        const a0 = off + (k / n) * Math.PI * 2, a1 = off + ((k + 1) / n) * Math.PI * 2, ga = join / ((r0 + r1) / 2);
        g.fillStyle = shade(base);
        g.beginPath();
        g.arc(c, c, r1 * px, a0 + ga, a1 - ga);
        g.arc(c, c, r0 * px, a1 - ga, a0 + ga, true);
        g.closePath();
        g.fill();
      }
    };
    const ring = (r0: number, r1: number) => {
      g.fillStyle = JOINT;
      g.beginPath();
      g.arc(c, c, r1 * px, 0, Math.PI * 2);
      g.arc(c, c, r0 * px, 0, Math.PI * 2, true);
      g.fill('evenodd');
    };
    const brass = (r: number) => {
      g.strokeStyle = BRASS;
      g.lineWidth = 0.07 * px;
      g.beginPath();
      g.arc(c, c, r * px, 0, Math.PI * 2);
      g.stroke();
    };
    // the rim: the tile line, then two rings of kerb stones
    ring(field, RING.r + 0.2);
    stones(field + 0.1, field + 0.42, 150, TILE, 0.02);
    stones(field + 0.6, 11.3, 40);
    stones(11.3 + gap, 12.1, 56);
    brass(field + 0.05);
    brass(field + 0.5);
    // round the well: a ring of flags, the tile line again
    ring(0, 2.75);
    g.fillStyle = shade();
    g.beginPath();
    g.arc(c, c, 1.2 * px, 0, Math.PI * 2);
    g.fill();
    stones(1.2 + gap, 2.2, 12);
    stones(2.33, 2.62, 44, TILE, 0.02);
    brass(2.27);
    brass(2.69);
  });
}

/** Courses of dressed blocks for the kerb, tiling. */
function blockTexture() {
  return canvasTexture(256, (g, size) => {
    const rnd = seeded(9), rows = 2, h = size / rows;
    g.fillStyle = JOINT;
    g.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      const n = 2, w = size / n, off = (r % 2) * (w / 2);
      for (let k = -1; k < n; k++) {
        g.fillStyle = tone(FLAG, 0.85 + 0.25 * rnd());
        g.fillRect(off + k * w + 2, r * h + 2, w - 4, h - 4);
      }
    }
  });
}

/**
 * The canyon floor: flat sand with the wind's ripples drawn on it as a few short, clean crescents, a little lighter
 * on one side and darker on the other (a tile of about 16 m; nothing touches its edge, so it repeats).
 */
function sandTexture(repeat: number) {
  return canvasTexture(512, (g, size) => {
    const rnd = seeded(13);
    g.fillStyle = tone(SAND, 1);
    g.fillRect(0, 0, size, size);
    g.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const x = (0.14 + 0.72 * rnd()) * size, y = (0.1 + 0.8 * ((k + rnd() * 0.6) / 9)) * size, w = (0.06 + 0.07 * rnd()) * size;
      for (const [dy, t, lw] of [[0, 1.09, 3], [5, 0.9, 4]] as const) {
        g.strokeStyle = tone(SAND, t);
        g.lineWidth = lw;
        g.beginPath();
        g.moveTo(x - w, y + dy);
        g.quadraticCurveTo(x, y + dy - 0.22 * w, x + w, y + dy);
        g.stroke();
      }
    }
  }, repeat);
}

/** The old road's worn flags: three across, in running rows (a square tile as wide as the road). */
function roadTexture(repeat: number) {
  const t = canvasTexture(256, (g, size) => {
    const rnd = seeded(21), rows = 3, h = size / rows;
    g.fillStyle = tone(SAND, 0.8);
    g.fillRect(0, 0, size, size);
    for (let r = 0; r < rows; r++) {
      const n = 3, w = size / n, off = (r % 2) * (w / 2);
      for (let k = -1; k < n; k++) {
        g.fillStyle = tone(ROAD, 0.86 + 0.26 * rnd());
        g.fillRect(off + k * w + 3, r * h + 3, w - 6, h - 6);
      }
    }
  });
  t.repeat.set(1, repeat);
  return t;
}

/** The kerb round the court: one turned profile from the sand up and in over the rim. */
function kerbGeometry() {
  const r = RING.r;
  const profile = [[r + KERB + 0.22, SAND_Y - 0.05], [r + KERB + 0.04, 0.08], [r + KERB - 0.08, 0.17], [r + 0.02, 0.17], [r - 0.05, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 128);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 28, uv.getY(i) * 1.0);
  geo.translate(RING.x, 0, RING.z);
  return geo;
}

export const canyonArena: ArenaDef = {
  id: 'canyon',
  name: 'Sandstone Canyon',
  obstacles: CANYON_OBSTACLES,
  hazard: (seed) => new DustDevils(seed),
  shift: () => canyonShift(),
  hideGround: true,
  stage: {
    background: 0x241c24,
    zenith: 0x141a3c,
    horizon: 0x7c5560,
    glow: 0xf09a5c,
    stars: 0.3,
    fog: 0x4c3a44,
    fogNear: 30,
    fogFar: 120,
    hemiSky: 0xb4b8e4,
    hemiGround: 0x33261e,
    hemiIntensity: 0.7,
    sun: 0xffc090,
    sunIntensity: 1.5,
    rim: 0x8a9ee2,
    rimIntensity: 0.9,
  },
  build() {
    const g = new THREE.Group();
    const own: { dispose(): void }[] = [];

    // the court: smooth flags, a kerb round it
    const paving = new THREE.MeshStandardMaterial({ map: courtTexture(), roughness: 0.62, envMapIntensity: 0.25 });
    const floor = floorDisc(RING.r, paving, 0.012, 128);
    const stone = new THREE.MeshStandardMaterial({ map: blockTexture(), color: 0xfff4ea, roughness: 0.75, envMapIntensity: 0.2 });
    const kerb = new THREE.Mesh(kerbGeometry(), stone);
    kerb.receiveShadow = true;
    kerb.castShadow = true;
    g.add(floor, kerb);
    own.push(floor.geometry, paving.map!, paving, kerb.geometry, stone.map!, stone);

    // a line of gold let into the kerb, as on the heroes' hems
    const line = flatRing(RING.r + 0.3, RING.r + 0.4, 0x9a7a38, 1, 0.176);
    g.add(line);
    own.push(line.geometry, line.material as THREE.Material);

    // the canyon floor round the court, and the old road that runs through it toward both cameras
    const sand = new THREE.MeshStandardMaterial({ map: sandTexture(22), roughness: 0.95, envMapIntensity: 0.1 });
    const ground = new THREE.Mesh(new THREE.RingGeometry(RING.r + KERB, 180, 96, 1), sand);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(RING.x, SAND_Y, RING.z);
    ground.receiveShadow = true;
    const ROAD_W = 4.6, ROAD_L = 150;
    const paved = new THREE.MeshStandardMaterial({ map: roadTexture(ROAD_L / ROAD_W), roughness: 0.85, envMapIntensity: 0.1 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_L), paved);
    road.rotation.x = -Math.PI / 2;
    road.position.set(RING.x, SAND_Y + 0.012, RING.z);
    road.receiveShadow = true;
    g.add(ground, road);
    own.push(ground.geometry, sand.map!, sand, road.geometry, paved.map!, paved);

    const SIZE: Record<string, number> = { lantern: 1, lamp: 1.5 };
    const glows = new Glows(LAYOUT.marks.filter((m) => SIZE[m.kind]).map((m) => ({ ...m, size: SIZE[m.kind] })), 0xffa040, 1.5);
    g.add(glows.group);
    own.push(glows);

    let disposed = false;
    // the heroes' materials, a shade duller than on a hero, and the rock darker still: the arena must not outshine them
    void realProps('canyon', CANYON_OBSTACLES.length, {
      dim: 0.85, env: 0.3,
      parts: {
        glow: { emissive: 0xffa040, strength: 2.2 }, cream: { dim: 0.4, tint: 0xfff0dc }, rock: { dim: 0.6 }, band: { dim: 0.6 }, far: { dim: 0.7 },
        gold: { dim: 0.8 }, teal: { dim: 0.72 },
      },
    }).then((props) => {
      if (disposed) return;
      for (const c of props.cover) if (c) g.add(c);
      if (!props.back) return;
      // round the court the pale stone and the turquoise cloth are a shade darker than on the cover inside it, so the
      // colonnade and the awning stay behind the fight. Copies of the file's materials: this build made them and frees them.
      const darker = new Map<THREE.Material, THREE.Material>();
      props.back.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || Array.isArray(m.material) || !/cream|teal/.test(m.material.name)) return;
        let copy = darker.get(m.material);
        if (!copy) {
          copy = m.material.clone();
          (copy as THREE.MeshStandardMaterial).color.multiplyScalar(0.68);
          darker.set(m.material, copy);
          own.push(copy);
        }
        m.material = copy;
      });
      g.add(props.back);
    }).catch((e) => console.warn('canyon: props failed to load', e));

    return {
      group: g,
      update(_dt, time) {
        glows.update(time);
      },
      dispose() {
        disposed = true;
        for (const o of own) o.dispose();
      },
    };
  },
};
