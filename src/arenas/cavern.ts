import * as THREE from 'three';
import type { Obstacle } from '../obstacles';
import { RING, canvasTexture, flatRing, floorDisc, seeded } from './common';
import { RoofGives } from './hazards/cavern';
import { cavernShift } from './shifts/cavern';
import layout from './real/cavern.json';
import { Glows, realProps, type RealLayout } from './real';
import type { ArenaDef } from './types';

/**
 * Crystal Cavern: the floor of a great cave that was once a mine. An arena in the heroes' style (`real.ts`,
 * blender/arenas/real/STYLE.md): its cover and everything round the ring are built in blender/arenas/real/cavern.py,
 * which also writes the obstacle list (`real/cavern.json`). Its own colour beside the shared palette is amethyst.
 *
 * Cover: a mine cart loaded with crystals in the middle (low), two stacks of pit timber guarding the starts (low), two
 * tall clusters of amethyst prisms flanking the middle, two rows of smooth pale stalagmites on the wings (low), two
 * winch frames with a hanging ore bucket and a lantern in the far corners (tall). Round it: the cart's track leaves the
 * ring both ways over a trestle into a timbered tunnel mouth, smooth columns and great crystals along both sides, low
 * crystals and stalagmites on the cave floor, walls of dark rock far out. A cave has no sky: the stage is dark, with no
 * stars and the fog close in, and there is no roof, because both game cameras look down from above.
 *
 * Built here: the floor (fitted flagstones in the floors' dark band, the track let into them), the ring's border with
 * its gold line and the step down to the cave floor, and the glow of the lanterns and of a few crystals (sprites: the
 * arena rules allow no extra lights).
 */
const LAYOUT = layout as RealLayout;
export const CAVERN_OBSTACLES: Obstacle[] = LAYOUT.obstacles;

/** The cave floor outside the ring lies this far below it, as in cavern.py. */
const OUT = -0.6;
/** How far the ring's dressed border reaches past it. */
const BORDER = 0.9;
/** The track through the ring's centre: its direction (x, z) and its gauge (m), as in cavern.py (0.72 at 1.3). */
const TRACK = { x: 0.9701, z: 0.2425 };
const GAUGE = 0.936;
/** The first sleeper inside the rim and their spacing, so the drawn track meets the built one outside. */
const SLEEPER = { first: 11.675, step: 0.65 };

/** Stone tones of the floor: flagstones (the harbour's band), their joints. */
const FLAG = [41, 44, 52], JOINT = '#15161b';

type P = [number, number];

/** What is left of polygon `poly` on the near side of the line at distance `d` from `s` along the unit vector (nx, nz). */
function clip(poly: P[], s: P, nx: number, nz: number, d: number) {
  const out: P[] = [];
  const side = (p: P) => (p[0] - s[0]) * nx + (p[1] - s[1]) * nz - d;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    if (sa <= 0 !== sb <= 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/**
 * The cave's worked floor: fitted flagstones of many sides with rounded corners, each its own shade, thin dark joints,
 * and the mine track let into them through the middle (a dark bed, timber sleepers, two iron rails). Drawn across the
 * floor disc's UVs (the disc fills the square: x to the right, z down).
 */
function floorTexture() {
  return canvasTexture(2048, (g, size) => {
    const rnd = seeded(47), c = size / 2, px = size / (2 * RING.r), step = 2.15;
    g.fillStyle = JOINT;
    g.fillRect(0, 0, size, size);
    // one stone per site of a loosened honeycomb: its cell is what lies nearer to it than to any other site
    const sites: P[] = [];
    for (let j = -8; j <= 8; j++) {
      for (let i = -8; i <= 8; i++) {
        const x = (i + (j & 1) * 0.5) * step + (rnd() - 0.5) * step * 0.5, z = j * step * 0.866 + (rnd() - 0.5) * step * 0.5;
        if (Math.hypot(x, z) < RING.r + step) sites.push([x, z]);
      }
    }
    const gap = 0.055, round = 0.1;
    g.lineJoin = 'round';
    for (const s of sites) {
      let poly: P[] = [[s[0] - 3, s[1] - 3], [s[0] + 3, s[1] - 3], [s[0] + 3, s[1] + 3], [s[0] - 3, s[1] + 3]];
      for (const o of sites) {
        if (o === s) continue;
        const dx = o[0] - s[0], dz = o[1] - s[1], d = Math.hypot(dx, dz);
        if (d > 6) continue;
        poly = clip(poly, s, dx / d, dz / d, d / 2 - gap / 2 - round / 2);
        if (poly.length < 3) break;
      }
      if (poly.length < 3) continue;
      const t = 0.85 + 0.28 * rnd(), cool = (rnd() - 0.5) * 6;
      g.fillStyle = g.strokeStyle = `rgb(${Math.round(FLAG[0] * t + cool * 0.5)},${Math.round(FLAG[1] * t - cool * 0.3)},${Math.round(FLAG[2] * t + cool)})`;
      g.lineWidth = round * px;
      g.beginPath();
      poly.forEach(([x, z], k) => (k ? g.lineTo(c + x * px, c + z * px) : g.moveTo(c + x * px, c + z * px)));
      g.closePath();
      g.fill();
      g.stroke();
    }
    // the track, in its own frame: x along it
    g.save();
    g.translate(c, c);
    g.rotate(Math.atan2(TRACK.z, TRACK.x));
    const far = (RING.r + 1) * px;
    g.fillStyle = '#131419';
    g.fillRect(-far, -0.82 * px, 2 * far, 1.64 * px);
    g.fillStyle = 'rgb(66,46,32)';
    for (let u = SLEEPER.first; u > -RING.r; u -= SLEEPER.step) g.fillRect((u - 0.11) * px, -0.69 * px, 0.22 * px, 1.38 * px);
    for (const side of [1, -1]) {
      g.fillStyle = '#585c68';
      g.fillRect(-far, (side * GAUGE / 2 - 0.045) * px, 2 * far, 0.09 * px);
      g.fillStyle = '#868a96';
      g.fillRect(-far, (side * GAUGE / 2 - 0.013) * px, 2 * far, 0.026 * px);
    }
    g.restore();
  });
}

/** Courses of dressed blocks for the ring's border and the step below it, tiling. */
function blockTexture() {
  return canvasTexture(512, (g, size) => {
    const rnd = seeded(9), rows = 4, h = size / rows;
    g.fillStyle = JOINT;
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

/** The ring's border, level with the floor, and the step down to the cave floor: one turned profile. */
function borderGeometry() {
  const r = RING.r;
  // from under the cave floor up the step and in over the border: a profile that climbs faces outward
  const profile = [[r + BORDER + 0.16, OUT - 0.4], [r + BORDER + 0.05, -0.07], [r + BORDER - 0.02, 0.006], [r - 0.05, 0.006]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 128);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14, uv.getY(i) * 1.6);
  geo.translate(RING.x, 0, RING.z);
  return geo;
}

export const cavernArena: ArenaDef = {
  id: 'cavern',
  name: 'Crystal Cavern',
  obstacles: CAVERN_OBSTACLES,
  hazard: (seed) => new RoofGives(seed),
  shift: () => cavernShift(),
  hideGround: true,
  // no sky: the dome is the cave's dark, the same as the fog, and the light is lamp light with a violet fill
  stage: {
    background: 0x0d0c14,
    zenith: 0x060509,
    horizon: 0x0d0c14,
    glow: 0x17131f,
    stars: 0,
    fog: 0x0d0c14,
    fogNear: 30,
    fogFar: 88,
    hemiSky: 0xa9a6e0,
    hemiGround: 0x2a2422,
    hemiIntensity: 0.7,
    sun: 0xffd2a0,
    sunIntensity: 1.5,
    rim: 0x8c84d0,
    rimIntensity: 0.9,
  },
  build() {
    const g = new THREE.Group();
    const own: { dispose(): void }[] = [];

    // the worked floor, its border and the step down to the cave floor
    const flags = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.62, envMapIntensity: 0.25 });
    const floor = floorDisc(RING.r, flags, 0.012, 128);
    const stone = new THREE.MeshStandardMaterial({ map: blockTexture(), color: 0xf0f0ff, roughness: 0.75, envMapIntensity: 0.2 });
    const border = new THREE.Mesh(borderGeometry(), stone);
    border.receiveShadow = true;
    const ground = new THREE.MeshStandardMaterial({ color: 0x1b1c26, roughness: 0.9, envMapIntensity: 0.15 });
    const cave = floorDisc(80, ground, OUT, 72);
    g.add(floor, border, cave);
    own.push(floor.geometry, flags.map!, flags, border.geometry, stone.map!, stone, cave.geometry, ground);

    // a line of gold let into the border, as on the heroes' hems
    const line = flatRing(RING.r + 0.32, RING.r + 0.42, 0x9a7a38, 1, 0.014);
    g.add(line);
    own.push(line.geometry, line.material as THREE.Material);

    // lantern light, and the glow of a few crystals
    const WARM: Record<string, number> = { lantern: 1, lamp: 1.5 };
    const COOL: Record<string, number> = { crystal: 1, geode: 2.6 };
    const lamps = new Glows(LAYOUT.marks.filter((m) => WARM[m.kind]).map((m) => ({ ...m, size: WARM[m.kind] })), 0xffa040, 1.5);
    const crystals = new Glows(LAYOUT.marks.filter((m) => COOL[m.kind]).map((m) => ({ ...m, size: COOL[m.kind] })), 0x5c3ab8, 1.5);
    g.add(lamps.group, crystals.group);
    own.push(lamps, crystals);

    let disposed = false;
    // the heroes' materials, a shade duller than on a hero: the arena must not outshine them
    void realProps('cavern', CAVERN_OBSTACLES.length, {
      dim: 0.85, env: 0.35,
      parts: {
        lamp: { emissive: 0xffa040, strength: 2.2 }, shine: { emissive: 0x7040d0, strength: 0.8 }, cream: { dim: 0.36 }, rock: { dim: 0.62 }, gold: { dim: 0.8 },
      },
    }).then((props) => {
      if (disposed) return;
      for (const c of props.cover) if (c) g.add(c);
      if (props.back) g.add(props.back);
    }).catch((e) => console.warn('cavern: props failed to load', e));

    return {
      group: g,
      update(_dt, time) {
        lamps.update(time);
        crystals.update(time);
      },
      dispose() {
        disposed = true;
        for (const o of own) o.dispose();
      },
    };
  },
};
