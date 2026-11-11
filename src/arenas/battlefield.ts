import * as THREE from 'three';
import type { Obstacle } from '../obstacles';
import { RING, canvasTexture, flatRing, floorDisc, seeded } from './common';
import { ArrowsFall } from './hazards/battlefield';
import { battlefieldShift } from './shifts/battlefield';
import layout from './real/battlefield.json';
import { Glows, realProps, type RealLayout } from './real';
import type { ArenaDef } from './types';

/**
 * Fallen Battlefield: a field after the battle under a heavy evening sky, in light rain. An arena in the heroes' style
 * (`real.ts`, blender/arenas/real/STYLE.md): its cover and everything round the ring are built in
 * blender/arenas/real/battlefield.py, which also writes the obstacle list (`real/battlefield.json`). Solemn and tidy:
 * what tells of the fight is how things lie, not dirt or damage. Its own colour is the banners' blue.
 *
 * Cover: a war drum in the middle (low), two rows of great shields on a sill guarding the starts (low), two banner
 * standards on a stone foot flanking the middle (tall), two field catapults with the arm down and a wheel off on the
 * wings (low), two supply wagons in the far corners (low). Round it: a siege tower fallen on its side along the left,
 * a palisade with a gate on the right and more of it behind the tower, braziers at the kerb, low stake hedges toward
 * both cameras, planted spears, a camp of pavilions and tall banners far out, low hills against the sky.
 *
 * Built here: the drawn floor (trodden earth in broad clean patches, an old paved road across it, a paved round in the
 * middle and a ring of slabs near the rim, a few of them gone, all in the floors' dark band), the stone kerb with its
 * gold line, the ground beyond with the road leading out to the gate, the rain (thin straight streaks) and the
 * braziers' glow (no lamps: the arena rules allow no extra lights).
 */
const LAYOUT = layout as RealLayout;
export const BATTLEFIELD_OBSTACLES: Obstacle[] = LAYOUT.obstacles;

/** How far the kerb's stone reaches past the ring. */
const KERB = 0.6;
/** The ground beyond the ring: drawn out to `APRON`, one flat tone from there on. */
const APRON = 48;
/** The old road across the field, along x: half its width. */
const ROAD = 1.3;

/**
 * Tones before lighting: trodden earth, the road's and the rings' stone (the harbour's slabs), the joints, the brass let
 * into the stone, and the ground beyond the ring, which is darker and cooler so that the ring stands out of it.
 */
const EARTH = [42, 39, 37], SLAB = [41, 44, 52], JOINT = '#17181c', BRASS = '#7a6030', BEYOND = [27, 27, 30];
const tone = (c: number[], t: number, warm = 0) => `rgb(${Math.round(c[0] * t + warm)},${Math.round(c[1] * t)},${Math.round(c[2] * t - warm)})`;

/**
 * A broad patch with a clean, rounded edge round (x, y) px, and its twin through the canvas' middle: the field is
 * point-symmetric, as its cover is.
 */
function patches(g: CanvasRenderingContext2D, size: number, rnd: () => number, count: number, reach: [number, number], radius: [number, number], shade: () => string) {
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, d = reach[0] + rnd() * (reach[1] - reach[0]), r = radius[0] + rnd() * (radius[1] - radius[0]);
    const lobes = Array.from({ length: 7 }, () => 0.72 + 0.5 * rnd()), turn = rnd() * 6.28;
    g.fillStyle = shade();
    for (const side of [1, -1]) {
      const cx = size / 2 + side * Math.cos(a) * d, cy = size / 2 + side * Math.sin(a) * d;
      const at = (k: number) => {
        const b = turn + (k / lobes.length) * Math.PI * 2, l = r * lobes[((k % lobes.length) + lobes.length) % lobes.length];
        return [cx + side * Math.cos(b) * l * 1.25, cy + side * Math.sin(b) * l];
      };
      const mid = (k: number) => [(at(k)[0] + at(k + 1)[0]) / 2, (at(k)[1] + at(k + 1)[1]) / 2];
      g.beginPath();
      g.moveTo(mid(-1)[0], mid(-1)[1]);
      for (let k = 0; k < lobes.length; k++) g.quadraticCurveTo(at(k)[0], at(k)[1], mid(k)[0], mid(k)[1]);
      g.closePath();
      g.fill();
    }
  }
}

/**
 * The field inside the ring, drawn across the floor disc's UVs (canvas x is the world's x, canvas y its z): trodden
 * earth in broad patches, the old road of slabs across it, a paved round in the middle where the drum stands, a ring of
 * slabs near the rim; about one slab in eight is gone and the earth shows, each with its twin. Brass lines round the two rings.
 */
function fieldTexture() {
  return canvasTexture(2048, (g, size) => {
    const rnd = seeded(47), c = size / 2, px = size / (2 * RING.r), gap = 0.035;
    g.fillStyle = tone(EARTH, 1);
    g.fillRect(0, 0, size, size);
    patches(g, size, rnd, 9, [2.5 * px, 10.5 * px], [1.7 * px, 3.6 * px], () => tone(EARTH, rnd() < 0.5 ? 0.84 + 0.06 * rnd() : 1.06 + 0.06 * rnd()));
    const shade = () => tone(SLAB, 0.98 + 0.24 * rnd(), (rnd() - 0.5) * 6);
    /** A ring of `n` slabs (an even number) between two radii: slab k and its twin k + n/2 share a fate. */
    const ring = (r0: number, r1: number, n: number, gone: number) => {
      const off = rnd() * Math.PI, ga = gap / ((r0 + r1) / 2);
      for (let k = 0; k < n / 2; k++) {
        const there = rnd() >= gone;
        for (const kk of [k, k + n / 2]) {
          const a0 = off + (kk / n) * Math.PI * 2, a1 = off + ((kk + 1) / n) * Math.PI * 2;
          g.beginPath();
          g.arc(c, c, r1 * px, a0, a1);
          g.arc(c, c, r0 * px, a1, a0, true);
          g.closePath();
          g.fillStyle = there ? JOINT : tone(EARTH, 0.88);
          g.fill();
          if (!there) continue;
          g.fillStyle = shade();
          g.beginPath();
          g.arc(c, c, (r1 - gap) * px, a0 + ga, a1 - ga);
          g.arc(c, c, (r0 + gap) * px, a1 - ga, a0 + ga, true);
          g.closePath();
          g.fill();
        }
      }
    };
    // the road: two rows of slabs along x. A slab of the far row and its twin, which lies in the near row; the far row
    // starts a quarter slab off the middle, so the two rows' joints come out half a slab apart
    const slab = 1.9, n = Math.ceil(RING.r / slab) + 1;
    for (let k = -n; k < n; k++) {
      const x0 = (k + 0.25) * slab, there = rnd() >= 0.12;
      for (const [ax, az] of [[x0, -ROAD], [-x0 - slab, 0]]) {
        g.fillStyle = there ? JOINT : tone(EARTH, 0.88);
        g.fillRect(c + ax * px, c + az * px, slab * px, ROAD * px);
        if (!there) continue;
        g.fillStyle = shade();
        g.fillRect(c + (ax + gap) * px, c + (az + gap) * px, (slab - 2 * gap) * px, (ROAD - 2 * gap) * px);
      }
    }
    // the rings: near the rim, and the round in the middle
    ring(10.2, 11.4, 34, 0.12);
    ring(1.15, 2.45, 8, 0);
    g.fillStyle = JOINT;
    g.beginPath();
    g.arc(c, c, 1.15 * px, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = shade();
    g.beginPath();
    g.arc(c, c, (1.15 - gap) * px, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = BRASS;
    g.lineWidth = 0.08 * px;
    for (const r of [11.62, 2.62]) {
      g.beginPath();
      g.arc(c, c, r * px, 0, Math.PI * 2);
      g.stroke();
    }
  });
}

/** The ground beyond the ring, across `APRON` metres each way: darker earth in broad patches, the road as a trodden track. */
function groundTexture() {
  return canvasTexture(1024, (g, size) => {
    const rnd = seeded(83), c = size / 2, px = size / (2 * APRON);
    g.fillStyle = tone(BEYOND, 1);
    g.fillRect(0, 0, size, size);
    patches(g, size, rnd, 16, [14 * px, 44 * px], [5 * px, 11 * px], () => tone(BEYOND, rnd() < 0.5 ? 0.86 + 0.06 * rnd() : 1.08 + 0.07 * rnd()));
    g.fillStyle = tone(BEYOND, 0.8);
    g.fillRect(0, c - (ROAD + 0.22) * px, size, 2 * (ROAD + 0.22) * px);
    g.fillStyle = tone(SLAB, 0.8);
    g.fillRect(0, c - ROAD * px, size, 2 * ROAD * px);
  });
}

/** Courses of dressed blocks for the kerb, tiling. */
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

/** The kerb: one turned profile from the ground outside up and in over the ring's edge. */
function kerbGeometry() {
  const r = RING.r;
  const profile = [[r + KERB + 0.05, -0.2], [r + KERB, 0.1], [r + KERB - 0.08, 0.17], [r + 0.02, 0.17], [r - 0.05, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 128);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 44, uv.getY(i) * 1.0);
  geo.translate(RING.x, 0, RING.z);
  return geo;
}

/** Light rain: thin straight streaks, all on one slant, falling through a cylinder round the ring. Looks only. */
class Rain {
  readonly lines: THREE.LineSegments;
  private pos: Float32Array;
  private speed: Float32Array;
  private readonly slant = new THREE.Vector3(0.12, -1, 0.05).normalize();
  private static readonly TOP = 15;
  private static readonly REACH = 21;

  constructor(private count = 150, private length = 0.85) {
    this.pos = new Float32Array(count * 6);
    this.speed = new Float32Array(count);
    for (let i = 0; i < count; i++) this.drop(i, Math.random() * Rain.TOP);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb2d0, transparent: true, opacity: 0.26, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
  }

  private drop(i: number, y: number) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Rain.REACH;
    this.pos[i * 6] = RING.x + Math.cos(a) * r;
    this.pos[i * 6 + 1] = y;
    this.pos[i * 6 + 2] = RING.z + Math.sin(a) * r;
    this.speed[i] = 17 + Math.random() * 6;
  }

  update(dt: number) {
    const p = this.pos, s = this.slant;
    for (let i = 0; i < this.count; i++) {
      const d = this.speed[i] * Math.min(dt, 0.05);
      p[i * 6] += s.x * d;
      p[i * 6 + 1] += s.y * d;
      p[i * 6 + 2] += s.z * d;
      if (p[i * 6 + 1] < 0) this.drop(i, Rain.TOP);
      // the streak's tail, back up its own line
      p[i * 6 + 3] = p[i * 6] - s.x * this.length;
      p[i * 6 + 4] = p[i * 6 + 1] - s.y * this.length;
      p[i * 6 + 5] = p[i * 6 + 2] - s.z * this.length;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}

export const battlefieldArena: ArenaDef = {
  id: 'battlefield',
  name: 'Fallen Battlefield',
  obstacles: BATTLEFIELD_OBSTACLES,
  hazard: (seed) => new ArrowsFall(seed),
  shift: () => battlefieldShift(),
  hideGround: true,
  stage: {
    background: 0x1b1e26,
    zenith: 0x0d1119,
    horizon: 0x4c4954,
    glow: 0xb87c50,
    stars: 0,
    fog: 0x363841,
    fogNear: 26,
    fogFar: 105,
    hemiSky: 0xa6b6d4,
    hemiGround: 0x2a2521,
    hemiIntensity: 0.7,
    sun: 0xffc392,
    sunIntensity: 1.45,
    rim: 0x86a4de,
    rimIntensity: 0.9,
  },
  build() {
    const g = new THREE.Group();
    const own: { dispose(): void }[] = [];

    // the field inside the ring, a little wet; the kerb round it
    const field = new THREE.MeshStandardMaterial({ map: fieldTexture(), roughness: 0.55, envMapIntensity: 0.3 });
    const floor = floorDisc(RING.r, field, 0.012, 128);
    const stone = new THREE.MeshStandardMaterial({ map: blockTexture(), color: 0xf0f2ff, roughness: 0.7, envMapIntensity: 0.2 });
    const kerb = new THREE.Mesh(kerbGeometry(), stone);
    kerb.receiveShadow = true;
    kerb.castShadow = true;
    g.add(floor, kerb);
    own.push(floor.geometry, field.map!, field, kerb.geometry, stone.map!, stone);

    // a line of gold let into the kerb, as on the heroes' hems
    const line = flatRing(RING.r + 0.24, RING.r + 0.33, 0x9a7a38, 1, 0.176);
    g.add(line);
    own.push(line.geometry, line.material as THREE.Material);

    // the ground beyond: drawn near the ring (a ring's UVs span its outer square), one tone from there to the fog
    const earth = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.9, envMapIntensity: 0.15 });
    const apron = new THREE.Mesh(new THREE.RingGeometry(RING.r + KERB - 0.1, APRON, 96, 6), earth);
    const beyond = new THREE.MeshStandardMaterial({ color: new THREE.Color(tone(BEYOND, 1)), roughness: 0.9, envMapIntensity: 0.15 });
    const far = new THREE.Mesh(new THREE.RingGeometry(APRON, 330, 64, 1), beyond);
    for (const m of [apron, far]) {
      m.rotation.x = -Math.PI / 2;
      m.position.set(RING.x, 0, RING.z);
      m.receiveShadow = true;
      g.add(m);
    }
    own.push(apron.geometry, earth.map!, earth, far.geometry, beyond);

    const rain = new Rain();
    g.add(rain.lines);
    own.push(rain);

    const glows = new Glows(LAYOUT.marks.filter((m) => m.kind === 'brazier'), 0xc8702c, 1.1);
    g.add(glows.group);
    own.push(glows);

    let disposed = false;
    // the heroes' materials, a shade duller than on a hero: the arena must not outshine them
    void realProps('battlefield', BATTLEFIELD_OBSTACLES.length, {
      dim: 0.85, env: 0.35,
      parts: {
        glow: { dim: 0.6, tint: 0xf0a060, emissive: 0xc8641e, strength: 0.9 }, cream: { dim: 0.5 }, stone: { dim: 0.8 }, gold: { dim: 0.8 }, plank: { dim: 0.75 },
        // the backdrop's wood and tent cloth: far things in a few flat tones, fading toward the sky
        timber: { dim: 0.6 }, canvas: { dim: 0.22 },
      },
    }).then((props) => {
      if (disposed) return;
      for (const c of props.cover) if (c) g.add(c);
      if (props.back) g.add(props.back);
    }).catch((e) => console.warn('battlefield: props failed to load', e));

    return {
      group: g,
      update(dt, time) {
        rain.update(dt);
        glows.update(time);
      },
      dispose() {
        disposed = true;
        for (const o of own) o.dispose();
      },
    };
  },
};
