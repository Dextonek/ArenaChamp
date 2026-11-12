import * as THREE from 'three';
import { pillar, wall, type Obstacle } from '../obstacles';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef, ArenaStage } from './types';

/**
 * The Tower's one place (pipeline/designs/tower.md): a round stair-well room. Every floor of a climb is this room again, a
 * storey higher: the floor's number is inlaid in its middle, the kind of floor decides what stands in it, and its stone, its
 * lanterns and its sky change with the height (the Roots, the Galleries, the Crown). The way up is always in the north wall,
 * where the camera looks: an arch, a flight of steps, and the stair that goes on up along the wall.
 *
 * All drawn in code, in the style of the Raid's hall (src/arenas/noonfall.ts): clean forms, dark floors, gold on the edges,
 * lantern light as the only glow. First pass, for the artist to direct. It is not in `ARENAS`, so no duel picks it.
 *
 * Angles here turn as a boss room's gates do: 0 is the south, where a hero comes in, and half a turn is the north.
 */

/** How far the room's floor reaches from its middle. */
export const TOWER_R = 13;
const GOLD = 0xc9a24a;
/** Where a hero comes up into the room, and the foot of the stairs that lead on. */
export const TOWER_START = { x: RING.x, z: RING.z + 10.2 };
export const TOWER_STAIRS = { x: RING.x, z: RING.z - 10.2 };
/** The three boon altars that rise before the stairs once a floor is cleared. */
export const TOWER_ALTARS = [{ x: RING.x - 4.4, z: RING.z - 4.4 }, { x: RING.x, z: RING.z - 5.8 }, { x: RING.x + 4.4, z: RING.z - 4.4 }];
/** The four doors in the wall that a horde comes in by. */
export const TOWER_DOORS = [{ x: RING.x - 11.4, z: RING.z + 0.6 }, { x: RING.x + 11.4, z: RING.z + 0.6 }, { x: RING.x - 7.6, z: RING.z - 8.4 }, { x: RING.x + 7.6, z: RING.z - 8.4 }];
/** The steps themselves: solid, so nobody walks through them in a fight. Every Tower room has it as its first piece of cover. */
const STEPS: Obstacle = { ...pillar(RING.x, RING.z - 12.6, 1.7), height: 1.4, fixed: true };

/** What stands in a room besides the steps: the baffles of a gauntlet, the pillars a horde or a guardian is fought round. */
export type RoomKind = 'gauntlet' | 'horde' | 'duel' | 'break' | 'hold' | 'guardian';

/** The bands a gauntlet is crossed in, south to north, and which side each baffle leaves open (-1 west, 1 east). */
export interface GauntletWay {
  /** Each baffle: where it lies, and the side its gap is on. */
  baffles: { z: number; open: -1 | 1 }[];
  /** The bands between them a fire can sweep, south first: from `z0` to `z1`. */
  bands: { z0: number; z1: number }[];
  /** Where to walk, in order: through each gap, then to the stairs. */
  way: { x: number; z: number }[];
}

/** A gauntlet's baffles from its seed: two walls across the room, their gaps on opposite sides, so the way through is a long S. */
export function gauntletWay(seed: number): GauntletWay {
  const rng = seeded(seed);
  const first: -1 | 1 = rng() < 0.5 ? -1 : 1;
  const zs = [RING.z + 4.6 + rng() * 0.8, RING.z - 1 + rng() * 0.8];
  const baffles = zs.map((z, i) => ({ z, open: (i % 2 ? -first : first) as -1 | 1 }));
  const bands = [{ z0: zs[0] + 0.6, z1: RING.z + 11.5 }, { z0: zs[1] + 0.6, z1: zs[0] - 0.6 }, { z0: RING.z - 8, z1: zs[1] - 0.6 }];
  // Through the middle of each gap: between the baffle's end and the room's wall.
  const way = [...baffles.map((b) => ({ x: RING.x + b.open * (Math.sqrt(TOWER_R * TOWER_R - (b.z - RING.z) ** 2) - GAP / 2 + 0.2), z: b.z })), { ...TOWER_STAIRS }];
  return { baffles, bands, way };
}

/** How wide a baffle's gap is (m), from the wall of the room to the baffle's end. */
const GAP = 4.6;
/** No pillar stands nearer than this to an altar's middle or to the foot of the stairs (m): a hero must be able to walk onto both. */
const CLEAR = 3.1;

/** The cover of a room of this kind, from the floor's seed. The steps come first in every list. */
export function towerCover(kind: RoomKind, seed: number): Obstacle[] {
  const rng = seeded(seed + 77);
  const at = (deg: number, r: number, radius: number, height = 3.6): Obstacle => {
    const a = THREE.MathUtils.degToRad(deg);
    return { ...pillar(RING.x + Math.sin(a) * r, RING.z + Math.cos(a) * r, radius), height };
  };
  const turn = rng() * 20 - 10;
  /** Pillars pushed off the altars and the stairs' foot, straight away from whichever they stand too near. */
  const clear = (list: Obstacle[]) => list.map((o) => {
    for (const s of [...TOWER_ALTARS, TOWER_STAIRS, TOWER_START]) {
      const dx = o.ax - s.x, dz = o.az - s.z, d = Math.hypot(dx, dz);
      if (d >= CLEAR) continue;
      const k = d > 0.01 ? CLEAR / d : 1, x = s.x + (d > 0.01 ? dx * k : CLEAR), z = s.z + dz * k;
      o = { ...o, ax: x, az: z, bx: x, bz: z };
    }
    return o;
  });
  if (kind === 'gauntlet') {
    return [STEPS, ...gauntletWay(seed).baffles.map((b) => {
      // From the far wall to where the gap begins: the room's own wall, so it never breaks.
      const half = Math.sqrt(TOWER_R * TOWER_R - (b.z - RING.z) ** 2) + 0.6;
      const o = wall(RING.x - b.open * half, b.z, RING.x + b.open * (half - GAP - 0.6), b.z);
      return { ...o, fixed: true };
    })];
  }
  if (kind === 'horde') return [STEPS, ...clear([40, 100, 260, 320].map((d) => at(d + turn, 6.6, 0.85)))];
  if (kind === 'duel') return [STEPS, ...clear([at(90 + turn, 6.5, 0.9), at(270 + turn, 6.5, 0.9)])];
  if (kind === 'break') return [STEPS, ...clear([at(60 + turn, 7.4, 0.8), at(300 + turn, 7.4, 0.8)])];
  if (kind === 'guardian') return [STEPS, ...clear([30, 150, 210, 330].map((d) => at(d, 8.4, 0.95, 4.2)))];
  return [STEPS];
}

/** The three heights of the Tower: floors 1 to 10, 11 to 20, and from 21 up. */
const HEIGHTS = [
  {
    name: 'The Roots', stone: 0x24262f, block: '#1b1d26', floor: '#10121a', slab: 'rgba(120,130,170,', lantern: 0xffb060,
    stage: { background: 0x0b0c12, zenith: 0x05060c, horizon: 0x1a1c2c, glow: 0x3a2c2a, stars: 0.25, fog: 0x10111a, fogNear: 46, fogFar: 150, hemiSky: 0x9aa6d8, hemiGround: 0x241a12, hemiIntensity: 0.55, sun: 0xffd8a8, sunIntensity: 1.35, rim: 0x8a9cff, rimIntensity: 0.7 },
  },
  {
    name: 'The Galleries', stone: 0x2f2a26, block: '#231e1a', floor: '#14110f', slab: 'rgba(170,140,110,', lantern: 0xffc070,
    stage: { background: 0x140d0c, zenith: 0x0a0710, horizon: 0x4a2a1c, glow: 0xc8642a, stars: 0.5, fog: 0x1e1410, fogNear: 50, fogFar: 160, hemiSky: 0xc0a898, hemiGround: 0x2c180e, hemiIntensity: 0.58, sun: 0xffc890, sunIntensity: 1.45, rim: 0xff9a50, rimIntensity: 0.8 },
  },
  {
    name: 'The Crown', stone: 0x35363f, block: '#262831', floor: '#12141b', slab: 'rgba(160,175,210,', lantern: 0xffe2a8,
    stage: { background: 0x0a0e18, zenith: 0x04060e, horizon: 0x24385a, glow: 0x8fb0e8, stars: 1, fog: 0x141c2c, fogNear: 54, fogFar: 170, hemiSky: 0xb4c4ff, hemiGround: 0x1c1c22, hemiIntensity: 0.62, sun: 0xf2f0ff, sunIntensity: 1.5, rim: 0xa8c0ff, rimIntensity: 1 },
  },
] satisfies { name: string; stone: number; block: string; floor: string; slab: string; lantern: number; stage: ArenaStage }[];

/** Which height floor `n` is in, and its name. */
export const towerHeight = (n: number) => Math.min(2, Math.floor((n - 1) / 10));
export const heightName = (n: number) => HEIGHTS[towerHeight(n)].name;

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number) {
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

/** The floor: slabs in rings, two gold bands, the kind's sign round the middle and the floor's number in it. */
function roomFloor(kind: RoomKind, n: number) {
  const H = HEIGHTS[towerHeight(n)];
  return canvasTexture(1280, (g, s) => {
    const rnd = seeded(300 + n), ppm = s / (TOWER_R * 2), c = s / 2;
    g.fillStyle = H.floor;
    g.fillRect(0, 0, s, s);
    g.translate(c, c);
    const rings = [[3.6, 5.2, 16], [5.2, 7.2, 22], [7.2, 9.2, 28], [9.2, 11.2, 34], [11.2, 13, 40]] as const;
    rings.forEach(([r0, r1, count], ri) => {
      for (let k = 0; k < count; k++) {
        const a0 = ((k + (ri % 2) * 0.5) / count) * Math.PI * 2, a1 = ((k + 1 + (ri % 2) * 0.5) / count) * Math.PI * 2;
        g.fillStyle = rnd() < 0.5 ? `${H.slab}${(0.02 + rnd() * 0.035).toFixed(3)})` : `rgba(0,0,0,${(0.05 + rnd() * 0.09).toFixed(3)})`;
        g.beginPath();
        g.arc(0, 0, r1 * ppm, a0, a1);
        g.arc(0, 0, r0 * ppm, a1, a0, true);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(3,3,8,0.85)';
        g.lineWidth = 2.5;
        g.stroke();
      }
    });
    const gold = (alpha: number) => `rgba(201,162,74,${alpha})`;
    g.strokeStyle = gold(0.5);
    g.lineWidth = 4;
    for (const r of [3.6, 9.2]) {
      g.beginPath();
      g.arc(0, 0, r * ppm, 0, Math.PI * 2);
      g.stroke();
    }
    // The middle: a dark plate with the kind's sign round the floor's number.
    g.fillStyle = 'rgba(8,8,12,0.9)';
    g.beginPath();
    g.arc(0, 0, 3.5 * ppm, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = gold(0.62);
    g.lineWidth = 3;
    const spoke = (a: number, r0: number, r1: number) => {
      g.beginPath();
      g.moveTo(Math.sin(a) * r0 * ppm, -Math.cos(a) * r0 * ppm);
      g.lineTo(Math.sin(a) * r1 * ppm, -Math.cos(a) * r1 * ppm);
      g.stroke();
    };
    const circle = (r: number) => {
      g.beginPath();
      g.arc(0, 0, r * ppm, 0, Math.PI * 2);
      g.stroke();
    };
    if (kind === 'guardian') {
      // A sun of ten rays: one for each floor it keeps.
      circle(2.1);
      for (let k = 0; k < 10; k++) spoke((k / 10) * Math.PI * 2, 2.1, 3.3);
    } else if (kind === 'horde') {
      circle(2.6);
      for (let k = 0; k < 4; k++) spoke(Math.PI / 4 + (k / 4) * Math.PI * 2, 2.6, 3.4);
    } else if (kind === 'duel') {
      circle(2.3);
      circle(2.9);
      spoke(Math.PI / 2, 2.3, 3.4);
      spoke(-Math.PI / 2, 2.3, 3.4);
    } else if (kind === 'break') {
      for (let k = 0; k < 8; k++) spoke((k / 8) * Math.PI * 2, k % 2 ? 2.4 : 2, 3.3);
      circle(2);
    } else if (kind === 'hold') {
      circle(2.2);
      for (let k = 0; k < 12; k++) spoke((k / 12) * Math.PI * 2, k % 3 ? 2.9 : 2.6, 3.3);
    } else {
      // A gauntlet: chevrons toward the stairs.
      circle(2.4);
      for (const r of [2.6, 3]) {
        g.beginPath();
        g.moveTo(-0.5 * ppm, -(r - 0.35) * ppm);
        g.lineTo(0, -r * ppm);
        g.lineTo(0.5 * ppm, -(r - 0.35) * ppm);
        g.stroke();
      }
    }
    const numeral = roman(n);
    g.fillStyle = gold(0.78);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round((numeral.length > 4 ? 0.95 : numeral.length > 2 ? 1.25 : 1.7) * ppm)}px ui-serif, Georgia, serif`;
    g.fillText(numeral, 0, 0.08 * ppm);
  });
}

/** The wall's stone: courses of blocks. One texture a height, wrapped round the drum. */
function wallStone(n: number) {
  const H = HEIGHTS[towerHeight(n)];
  return canvasTexture(512, (g, s) => {
    const rnd = seeded(51 + towerHeight(n));
    g.fillStyle = H.block;
    g.fillRect(0, 0, s, s);
    const rows = 8, h = s / rows;
    for (let r = 0; r < rows; r++) {
      const cols = 8, w = s / cols, off = r % 2 ? w / 2 : 0;
      for (let k = -1; k < cols; k++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${(rnd() * 0.05).toFixed(3)})`;
        g.fillRect(k * w + off + 1.5, r * h + 1.5, w - 3, h - 3);
      }
    }
  }, 1);
}

const facing = (x: number, z: number) => Math.atan2(RING.x - x, RING.z - z);
const onRim = (a: number, r: number) => ({ x: RING.x + Math.sin(a) * r, z: RING.z + Math.cos(a) * r });

/** One arch in the wall: two posts and a lintel with a gold band, and the dark beyond. */
function arch(x: number, z: number, yaw: number, w: number, h: number, stone: THREE.Material, trim: THREE.Material, dark: THREE.Material) {
  const g = new THREE.Group();
  const post = new THREE.BoxGeometry(0.7, h, 0.9).translate(0, h / 2, 0);
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(post, stone);
    p.position.x = side * (w / 2 + 0.35);
    p.castShadow = true;
    g.add(p);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(w + 1.8, 0.7, 1), stone);
  lintel.position.y = h + 0.35;
  const band = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 0.14, 1.06), trim);
  band.position.y = h - 0.05;
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, -0.3), dark);
  g.add(lintel, band, beyond);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

/**
 * The stair-well room for floor `n` of kind `kind`, with `obstacles` as its cover (`towerCover`). A new def for each floor: the
 * duel keeps a room it is given twice (a floor and the landing after it are one room), and builds a new one for the next floor.
 */
export function towerRoom(kind: RoomKind, n: number, obstacles: Obstacle[]): ArenaDef {
  const H = HEIGHTS[towerHeight(n)];
  return {
    id: `tower-${kind}`,
    name: `Floor ${n}`,
    ring: TOWER_R,
    obstacles,
    stage: H.stage,
    build() {
      const g = new THREE.Group();
      const R = TOWER_R;
      const stone = new THREE.MeshStandardMaterial({ color: H.stone, roughness: 0.88, flatShading: true });
      const trim = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.42, metalness: 0.78, emissive: 0xffb050, emissiveIntensity: 0.14 });
      const dark = new THREE.MeshBasicMaterial({ color: 0x030306 });
      const flame = new THREE.MeshBasicMaterial({ color: H.lantern });
      const apron = floorDisc(44, new THREE.MeshStandardMaterial({ color: 0x0c0c11, roughness: 0.96 }), 0.004, 64);
      const disc = floorDisc(R, new THREE.MeshStandardMaterial({ map: roomFloor(kind, n), roughness: 0.8, metalness: 0.12 }));
      g.add(apron, disc, flatRing(R - 0.14, R, GOLD, 0.7, 0.02));

      // The well's wall: tall round the north where the camera looks, stepping down toward the south so it looks over it.
      const wallMat = new THREE.MeshStandardMaterial({ map: wallStone(n), color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
      const W = R + 2.4;
      const drum = (from: number, to: number, h: number) => {
        const len = to - from;
        const geo = new THREE.CylinderGeometry(W, W, h, Math.max(6, Math.round(len * 14)), 1, true, from, len);
        // The courses keep their size whatever the piece's length and height.
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (len * W) / 8, uv.getY(i) * h / 8);
        const m = new THREE.Mesh(geo, wallMat);
        m.position.set(RING.x, h / 2, RING.z);
        m.receiveShadow = true;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(W + 0.05, W + 0.05, 0.16, Math.max(6, Math.round(len * 14)), 1, true, from, len), trim);
        cap.position.set(RING.x, h + 0.02, RING.z);
        g.add(m, cap);
      };
      const TALL = 0.56 * Math.PI, MID = 0.72 * Math.PI, LOW = 0.86 * Math.PI;
      drum(Math.PI - TALL, Math.PI + TALL, 7.2);
      for (const side of [-1, 1]) {
        drum(side > 0 ? Math.PI + TALL : Math.PI - MID, side > 0 ? Math.PI + MID : Math.PI - TALL, 3.4);
        drum(side > 0 ? Math.PI + MID : Math.PI - LOW, side > 0 ? Math.PI + LOW : Math.PI - MID, 1.3);
      }
      // A low kerb all the way round, with a gold line on it: the floor reads as sunk into the well.
      const kerb = new THREE.Mesh(
        new THREE.LatheGeometry([[R, 0], [R, 0.3], [R + 0.9, 0.3], [R + 0.9, 0.6], [W, 0.6], [W + 0.6, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 96),
        new THREE.MeshStandardMaterial({ color: H.stone, roughness: 0.9, side: THREE.DoubleSide }),
      );
      kerb.position.set(RING.x, 0, RING.z);
      kerb.receiveShadow = true;
      g.add(kerb, flatRing(R + 0.02, R + 0.12, GOLD, 0.8, 0.305));

      // The way up: the arch in the north wall, the flight to it, and the stair going on up along the wall to the west.
      const north = onRim(Math.PI, W - 0.5);
      g.add(arch(north.x, north.z, 0, 3, 4.6, stone, trim, dark));
      const stepGeo = new THREE.BoxGeometry(3, 0.24, 0.62);
      for (let k = 0; k < 6; k++) {
        const st = new THREE.Mesh(stepGeo, stone);
        st.position.set(RING.x, 0.12 + k * 0.22, RING.z - R + 1.6 - k * 0.56);
        st.castShadow = st.receiveShadow = true;
        const nose = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.035, 0.07), trim);
        nose.position.set(RING.x, 0.26 + k * 0.22, RING.z - R + 1.9 - k * 0.56);
        g.add(st, nose);
      }
      const spiral = new THREE.BoxGeometry(1.7, 0.2, 0.74);
      for (let k = 0; k < 26; k++) {
        const a = Math.PI + 0.16 + k * 0.05, p = onRim(a, R + 1.45);
        const st = new THREE.Mesh(spiral, stone);
        st.position.set(p.x, 1.5 + k * 0.21, p.z);
        st.rotation.y = facing(p.x, p.z) + Math.PI / 2;
        st.castShadow = true;
        g.add(st);
        if (k % 2) continue;
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.74), trim);
        const q = onRim(a, R + 0.62);
        nose.position.set(q.x, 1.61 + k * 0.21, q.z);
        nose.rotation.y = st.rotation.y;
        g.add(nose);
      }

      // The four doors a horde comes in by: dark arches in the wall.
      for (const d of TOWER_DOORS) {
        const a = Math.atan2(d.x - RING.x, d.z - RING.z), p = onRim(a, W - 0.45);
        g.add(arch(p.x, p.z, facing(p.x, p.z), 2, 3, stone, trim, dark));
      }

      // Lanterns on the wall: a bracket, a cage, a small flame. The only glow in the room.
      const cage = new THREE.CylinderGeometry(0.2, 0.16, 0.5, 6, 1, true);
      const core = new THREE.OctahedronGeometry(0.14);
      const lanterns: THREE.Mesh[] = [];
      for (const a of [0.52, 0.66, 0.8, 0.9, 1.1, 1.2, 1.34, 1.48].map((k) => k * Math.PI)) {
        const p = onRim(a, W - 0.42), h = Math.abs(a - Math.PI) > 0.2 * Math.PI ? 2.9 : 5.2;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), trim);
        arm.position.set(p.x, h + 0.36, p.z);
        arm.rotation.y = facing(p.x, p.z);
        const c = new THREE.Mesh(cage, trim);
        c.position.set(p.x, h, p.z);
        const f = new THREE.Mesh(core, flame);
        f.position.set(p.x, h, p.z);
        lanterns.push(f);
        g.add(arm, c, f);
      }

      // What stands in the room: pillars with gold bands, a gauntlet's baffles with a gold coping. Not the steps: they are drawn above.
      const band = new THREE.TorusGeometry(1, 0.06, 6, 24).rotateX(Math.PI / 2);
      for (const o of obstacles) {
        if (o === STEPS) continue;
        if (o.kind === 'pillar') {
          const body = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.92, o.r, o.height, 8).translate(0, o.height / 2, 0), stone);
          body.position.set(o.ax, 0, o.az);
          body.castShadow = body.receiveShadow = true;
          g.add(body);
          for (const y of [0.3, o.height - 0.3]) {
            const b = new THREE.Mesh(band, trim);
            b.scale.setScalar(o.r * 1.02);
            b.position.set(o.ax, y, o.az);
            g.add(b);
          }
          continue;
        }
        const len = Math.hypot(o.bx - o.ax, o.bz - o.az), yaw = Math.atan2(o.bx - o.ax, o.bz - o.az);
        const body = new THREE.Mesh(new THREE.BoxGeometry(o.r * 2, o.height, len + o.r * 2).translate(0, o.height / 2, 0), stone);
        body.position.set((o.ax + o.bx) / 2, 0, (o.az + o.bz) / 2);
        body.rotation.y = yaw;
        body.castShadow = body.receiveShadow = true;
        // A gold line round it under its top, not a gold top: from above only its two edges show.
        const coping = new THREE.Mesh(new THREE.BoxGeometry(o.r * 2 + 0.1, 0.07, len + o.r * 2 + 0.1), trim);
        coping.position.set(body.position.x, o.height - 0.16, body.position.z);
        coping.rotation.y = yaw;
        g.add(body, coping);
      }

      return {
        group: g,
        update(_dt: number, time: number) {
          // The flames breathe, each a little apart.
          lanterns.forEach((f, i) => f.scale.setScalar(1 + 0.16 * Math.sin(time * 3.1 + i * 1.7)));
        },
        dispose() {
          disposeTree(g);
        },
      };
    },
  };
}
