import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { pillar, type Obstacle } from '../obstacles';
import { instance, lavaTexture } from './caldera';
import { buildPillars } from './cinderPillars';
import { loadKit } from './temple';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef } from './types';

/** How far the walkable floor reaches from the middle. */
export const PIT_R = RAID_BOSSES.ash.ring;

/** Where the one on the rim can stand: on the far side, where the camera sees them. On the lip, out of everyone's reach. */
const onRim = (deg: number) => {
  const a = THREE.MathUtils.degToRad(deg);
  return { x: RING.x + Math.sin(a) * (PIT_R + 1.4), z: RING.z + Math.cos(a) * (PIT_R + 1.4) };
};
export const RIM_SPOTS = [onRim(180), onRim(135), onRim(225), onRim(90), onRim(270)];

/** How far from the middle the pillars stand (m), and how thick they are. */
const PILLAR_RING = 7.5;
const PILLAR_R = 1.15;

/**
 * The pit's only cover: six pillars round the vent, between where the Coal Hearts rise (src/arenas/cinderPillars.ts). Ash's Charge
 * stops at one and breaks it; Ember's lines and his cracks stop at them too. Nothing on the z axis, and the middle stays open.
 */
export const PILLARS: Obstacle[] = [30, 90, 150, 210, 270, 330].map((deg) => {
  const a = THREE.MathUtils.degToRad(deg);
  return { ...pillar(RING.x + Math.sin(a) * PILLAR_RING, RING.z + Math.cos(a) * PILLAR_RING, PILLAR_R), height: 3.3 };
});
const COVER: Obstacle[] = PILLARS;

/** Their own kit (blender/arenas/den_props.py): Ember's lantern perches, the sun shard, the ribs, the posts and rocks out in the lava. */
const denProps = () => loadKit(['den_props.glb'], (part, m) => {
  if (part === 'glow') m.emissiveIntensity = Math.min(m.emissiveIntensity, 0.85);
});

/** Where Ash dragged his claws through the floor: three gouges at each, in metres from the middle, and the way they run. */
const CLAWS = [{ x: -6.5, z: 3.5, dir: 0.5 }, { x: 7.5, z: -2, dir: -1.1 }, { x: 2.5, z: 9.5, dir: 2.6 }];

/**
 * The den's floor: plates of black glass and cooled lava over the sun that fell here. Its light comes up through the gaps, brightest
 * in the middle, and Ash's claw marks cross it. Dark on purpose, so the orange and gold warnings stand out. One drawing for the colour,
 * one for the glow, both mapped once over the whole floor.
 */
function denFloor() {
  const R = PIT_R, size = 1536, ppm = size / (2 * R);
  // The plates, the same in both drawings.
  const rnd = seeded(707), plates: { pts: [number, number][]; tone: number }[] = [];
  for (let gy = -R; gy <= R; gy += 1.55) {
    for (let gx = -R; gx <= R; gx += 1.55) {
      const cx = gx + (rnd() - 0.5) * 0.7, cy = gy + (rnd() - 0.5) * 0.7, n = 6 + Math.floor(rnd() * 3), r = 0.98 + rnd() * 0.14, a0 = rnd() * 6.28;
      const pts = Array.from({ length: n }, (_, k): [number, number] => {
        const a = a0 + (k / n) * Math.PI * 2, rr = r * (0.88 + rnd() * 0.2);
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
      });
      plates.push({ pts, tone: rnd() });
    }
  }
  const path = (g: CanvasRenderingContext2D, pts: [number, number][]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * ppm, y * ppm) : g.moveTo(x * ppm, y * ppm)));
    g.closePath();
  };
  const gouges = (g: CanvasRenderingContext2D, style: string, width: number) => {
    g.strokeStyle = style;
    g.lineCap = 'round';
    for (const c of CLAWS) {
      const dx = Math.sin(c.dir), dz = Math.cos(c.dir), px = dz, pz = -dx;
      for (const k of [-1, 0, 1]) {
        g.lineWidth = width * (k === 0 ? 1.2 : 1);
        g.beginPath();
        for (let t = -2.6; t <= 2.6; t += 0.4) {
          const bend = Math.sin(t * 0.6) * 0.35, x = c.x + dx * t + px * (k * 0.45 + bend), z = c.z + dz * t + pz * (k * 0.45 + bend);
          if (t === -2.6) g.moveTo(x * ppm, z * ppm);
          else g.lineTo(x * ppm, z * ppm);
        }
        g.stroke();
      }
    }
  };
  const color = canvasTexture(size, (g, s) => {
    g.fillStyle = '#0b0807';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    for (const p of plates) {
      path(g, p.pts);
      // Black glass with the odd plate of rust-brown cooled lava.
      g.fillStyle = p.tone < 0.7 ? `rgb(${18 + p.tone * 10},${15 + p.tone * 7},${17 + p.tone * 8})` : `rgb(${40 + p.tone * 12},${22 + p.tone * 6},${16})`;
      g.fill();
      g.strokeStyle = 'rgba(120,110,140,0.12)';
      g.lineWidth = 1.5;
      g.stroke();
    }
    gouges(g, '#050303', 0.5 * ppm);
  });
  const glow = canvasTexture(size, (g, s) => {
    g.translate(s / 2, s / 2);
    // The buried sun: bright under the middle, an ember glow at the edge.
    const light = g.createRadialGradient(0, 0, 0, 0, 0, R * ppm);
    light.addColorStop(0, '#d89a48');
    light.addColorStop(0.35, '#9a4614');
    light.addColorStop(1, '#3a1206');
    g.fillStyle = light;
    g.fillRect(-s / 2, -s / 2, s, s);
    // The plates cover it: only the gaps between them glow.
    g.fillStyle = '#000';
    for (const p of plates) {
      path(g, p.pts);
      g.fill();
    }
    gouges(g, '#c8501a', 0.16 * ppm);
  });
  return { color, glow };
}

const STAGE: ArenaDef['stage'] = {
  background: 0x200a05,
  zenith: 0x0e0505,
  horizon: 0x3a1408,
  glow: 0xff5a1a,
  stars: 0,
  fog: 0x220c06,
  fogNear: 52,
  fogFar: 150,
  hemiSky: 0xffb080,
  hemiGround: 0x200804,
  hemiIntensity: 0.5,
  sun: 0xffc890,
  sunIntensity: 1.4,
  rim: 0xff6a2a,
  rimIntensity: 0.8,
};

/**
 * The Cinder Pit: Ash and Ember's own room, not one of the duel arenas. A wide basalt floor sunk into a lava lake, a vent in
 * the middle, an obsidian lip round it with perches for whoever is on the rim. All first-pass: the floor comes from the
 * caldera's textures and the cover from its sculpted props, until an artist directs its own.
 */
export const cinderPitArena: ArenaDef = {
  id: 'cinderpit',
  name: 'The Cinder Pit',
  ring: PIT_R,
  obstacles: COVER,
  stage: STAGE,
  build() {
    const g = new THREE.Group();
    const R = PIT_R;
    const lavaTex = lavaTexture();
    const lava = new THREE.Mesh(new THREE.RingGeometry(R + 3, 110, 72, 1), new THREE.MeshBasicMaterial({ map: lavaTex, color: 0xcccccc }));
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(RING.x, 0.01, RING.z);
    const den = denFloor();
    const floor = floorDisc(R, new THREE.MeshStandardMaterial({ map: den.color, color: 0xffffff, roughness: 0.55, metalness: 0.15, emissive: 0xffffff, emissiveMap: den.glow, emissiveIntensity: 0.4 }), 0.024);
    g.add(lava, floor, flatRing(R - 0.65, R, 0x0b090c, 0.97, 0.03), flatRing(R - 0.65, R - 0.56, 0xd8581a, 0.85, 0.034));

    // The vent: a glow in the middle, drawn on the floor. It stops nobody.
    g.add(flatRing(0, 1.3, 0x8a2e0e, 0.95, 0.04), flatRing(1.3, 1.6, 0x0a0706, 0.9, 0.038));

    // The lip: wide obsidian steps out of the lake. Under 2 m, so the camera looks over them.
    const lip = new THREE.Mesh(
      new THREE.LatheGeometry([[R, 0], [R, 0.3], [R + 0.8, 0.3], [R + 0.8, 0.6], [R + 2.2, 0.6], [R + 2.8, 0.1], [R + 3.2, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 128),
      new THREE.MeshStandardMaterial({ color: 0x1a1518, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide }),
    );
    lip.position.set(RING.x, 0, RING.z);
    lip.castShadow = lip.receiveShadow = true;
    g.add(lip, flatRing(R + 0.02, R + 0.12, 0xd8581a, 0.8, 0.31));

    // Ember's lantern perches on the lip, one at each spot the one on the rim can stand: their tops are flat at 0.7 m.

    // A crater wall far off, so the lake has an edge. Well outside the camera's way.
    const crater = new THREE.Mesh(
      new THREE.LatheGeometry([[62, 0], [70, 14], [84, 34], [110, 46]].map(([x, y]) => new THREE.Vector2(x, y)), 64),
      new THREE.MeshStandardMaterial({ color: 0x140c0a, roughness: 1, side: THREE.DoubleSide }),
    );
    crater.position.set(RING.x, 0, RING.z);
    g.add(crater);

    let disposed = false;
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    // `at` stretches along x only (a wall to its length); `big` scales a backdrop piece all round.
    const big = (x: number, z: number, ry: number, s: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, ry), new THREE.Vector3(s, s, s));
    const at = (x: number, z: number, ry: number, sx = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, ry), new THREE.Vector3(sx, 1, 1));
    // The six pillars, drawn in code: each can break and stand again.
    const pillars = buildPillars(COVER, PILLARS);
    g.add(pillars.group);

    void denProps().then((props) => {
      if (disposed) return;
      const place: Record<string, THREE.Matrix4[]> = { Perch: [], SunShard: [], Ribs: [], LanternPost: [], CraterRock: [] };
      for (const s of RIM_SPOTS) place.Perch.push(at(s.x, s.z, Math.atan2(RING.x - s.x, RING.z - s.z)));
      // Out in the lava: the shard of the sun that fell here, the ribs of something that burned, posts with lanterns on the far side
      // of the lip, rocks. Nothing tall on the camera's side.
      place.SunShard.push(at(RING.x + 9, RING.z - 40, 0.4));
      place.Ribs.push(big(RING.x - 31, RING.z - 4, 1.4, 1.2));
      for (const [x, z] of [[-24, -6], [24, -2], [-22, 14], [23, 16], [-14, -20], [15, -21]]) place.LanternPost.push(at(RING.x + x, RING.z + z, Math.atan2(-x, -z)));
      for (const [x, z, s] of [[34, -12, 1.2], [-38, 16, 1.4], [30, 22, 1], [-20, -36, 1.3], [26, -32, 1.1]]) place.CraterRock.push(big(RING.x + x, RING.z + z, x + z, s));
      for (const [name, list] of Object.entries(place)) if (props[name] && list.length) g.add(...instance(props[name], list));
    }).catch((e) => console.warn('cinder pit: props failed to load', e));

    // Embers rising off the lava and out of the seams, fading as they climb.
    const EMBERS = 90;
    const emberPos = new Float32Array(EMBERS * 3), emberSeed = new Float32Array(EMBERS);
    const ernd = seeded(616);
    for (let i = 0; i < EMBERS; i++) {
      emberSeed[i] = ernd();
      const a = ernd() * Math.PI * 2, r = 4 + Math.sqrt(ernd()) * (PIT_R + 14);
      emberPos[i * 3] = RING.x + Math.sin(a) * r;
      emberPos[i * 3 + 2] = RING.z + Math.cos(a) * r;
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ size: 0.14, color: 0xff8a3a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    embers.frustumCulled = false;
    g.add(embers);

    return {
      group: g,
      coverFall: pillars.coverFall,
      resetShift: pillars.resetShift,
      update(dt, time) {
        pillars.update(dt, time);
        lavaTex.offset.x = (time * 0.004) % 1;
        lavaTex.offset.y = (time * 0.0025) % 1;
        for (let i = 0; i < EMBERS; i++) {
          const s = emberSeed[i], u = (time * (0.08 + s * 0.1) + s * 3) % 1;
          emberPos[i * 3 + 1] = u * 7;
          emberPos[i * 3] += Math.sin(time * 1.3 + s * 40) * 0.004;
        }
        emberGeo.attributes.position.needsUpdate = true;
      },
      dispose() {
        disposed = true;
        pillars.dispose();
        disposeTree(g);
      },
    };
  },
};
