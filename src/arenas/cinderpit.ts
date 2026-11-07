import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { pillar, wall, type Obstacle } from '../obstacles';
import { RIDGE_MODULE, instance, lavaTexture, loadProps } from './caldera';
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

/**
 * Cover made for Ash's Charge, which stops dead at it, and Ember's lines, which it cuts: tall basalt on the diagonals, ridges on
 * the wings, low stumps further out. None of it breaks. Nothing on the z axis, and the middle stays open for the vent.
 */
const COVER: Obstacle[] = [
  ...[45, 135, 225, 315].map((deg) => {
    const a = THREE.MathUtils.degToRad(deg);
    return { ...pillar(RING.x + Math.sin(a) * 7.5, RING.z + Math.cos(a) * 7.5, 0.9), height: 3.3 };
  }),
  { ...wall(10.5, 5.2, 10.5, 8.8), r: 0.4, height: 2.08 },
  { ...wall(-10.5, 8.8, -10.5, 5.2), r: 0.4, height: 2.08 },
  ...[20, 160, 200, 340].map((deg) => {
    const a = THREE.MathUtils.degToRad(deg);
    return { ...pillar(RING.x + Math.sin(a) * 12.5, RING.z + Math.cos(a) * 12.5, 0.8), height: 1.27 };
  }),
];

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

    // A perch on the lip at each spot the one on the rim can stand.
    const perchMat = new THREE.MeshStandardMaterial({ color: 0x241c1c, roughness: 0.7, flatShading: true });
    for (const s of RIM_SPOTS) {
      const perch = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.7, 9), perchMat.clone());
      perch.position.set(s.x, 0.35, s.z);
      perch.castShadow = perch.receiveShadow = true;
      g.add(perch);
    }
    perchMat.dispose();

    // A crater wall far off, so the lake has an edge. Well outside the camera's way.
    const crater = new THREE.Mesh(
      new THREE.LatheGeometry([[62, 0], [70, 14], [84, 34], [110, 46]].map(([x, y]) => new THREE.Vector2(x, y)), 64),
      new THREE.MeshStandardMaterial({ color: 0x140c0a, roughness: 1, side: THREE.DoubleSide }),
    );
    crater.position.set(RING.x, 0, RING.z);
    g.add(crater);

    let disposed = false;
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const at = (x: number, z: number, ry: number, sx = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, ry), new THREE.Vector3(sx, 1, 1));
    void loadProps().then((props) => {
      if (disposed) return;
      const place: Record<string, THREE.Matrix4[]> = { RidgeB: [], BasaltA: [], BasaltB: [] };
      COVER.forEach((o, i) => {
        if (o.kind === 'wall') {
          const dx = o.bx - o.ax, dz = o.bz - o.az;
          place.RidgeB.push(at((o.ax + o.bx) / 2, (o.az + o.bz) / 2, Math.atan2(-dz, dx), (Math.hypot(dx, dz) + 2 * o.r) / RIDGE_MODULE.RidgeB));
        } else place[o.height > 2 ? 'BasaltA' : 'BasaltB'].push(at(o.ax, o.az, 0.6 + i));
      });
      for (const [name, list] of Object.entries(place)) if (props[name] && list.length) g.add(...instance(props[name], list));
    }).catch((e) => console.warn('cinder pit: props failed to load', e));

    return {
      group: g,
      update(_dt, time) {
        lavaTex.offset.x = (time * 0.004) % 1;
        lavaTex.offset.y = (time * 0.0025) % 1;
      },
      dispose() {
        disposed = true;
        disposeTree(g);
      },
    };
  },
};
