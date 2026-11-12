import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { pillar, type Obstacle } from '../obstacles';
import { instance, lavaTexture } from './caldera';
import { PIT_STAGE } from './cinderpit';
import { buildPillars } from './cinderPillars';
import { loadKit } from './temple';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import type { ArenaDef, WallState } from './types';

/**
 * The Cinder Pit for a party: Twin Flames (pipeline/designs/raid-party.md). The pit wide enough for forty, split from the south
 * gate to the far side by a wall of fire: Ash fights in the west half, among his pillars, Ember in the east, over her vents. The
 * wall is an obstacle that never breaks (`Obstacle.fixed`): it stops walking, sight and bolts, until one of the two falls and
 * it goes out (`wallState`).
 *
 * First-pass, drawn in code like the pit for two; a room built in Blender comes later as an art pass. **Every number of the
 * layout is in this block**, and the boss file (src/raid/ashEmber.ts) reads them from here.
 */
export const TWIN_R = RAID_BOSSES.ash.partyRing ?? 30;
const C = { x: RING.x, z: RING.z };
export const TWIN_LAYOUT = {
  /** How far the floor reaches (m): the hub clamps walks to it (`raidRing`). */
  ring: TWIN_R,
  /** The wall of fire: along x = 0 from rim to rim, this thick each side of the line (m), and how tall its flames are. */
  wallHalf: 0.9,
  wallHeight: 4.2,
  /** Where each of them starts and waits out its Eruption: Ash in the middle of his pillars, Ember over her great vent. */
  hold: [{ x: -14, z: 7 }, { x: 14, z: 7 }],
  /** Heroes come in at the south gate, either side of the wall: rows of this many, this far from the wall and from each other. */
  rowOf: 4,
  rowFrom: 3,
  rowGap: 1.4,
  /** How far inside the rim the first row stands (m). */
  rowIn: 6.5,
  /** Ash's pillars, in the order they are added as the party grows: the first four stand round him as the pit's four do. */
  pillars: [[-6.6, 14.4], [-6.6, -0.4], [-21.4, -0.4], [-21.4, 14.4], [-12, 25], [-12, -11], [-24.5, 7], [-4.5, 24], [-4.5, -10], [-21, 25], [-21, -11]],
  pillarR: 1.15,
  /** Ember's vents: her great one (her Eruption, her wave, the one to seal) is `hold[1]`; these are the small ones round it. */
  vents: [[8, 20], [8, -6], [22, 15], [22, -1], [14, 27], [14, -13]],
  ventR: 1,
  greatVentR: 1.6,
};

/** How many pillars Ash's half has for a party tuned for `band`: four, and one more for every three heroes of his half. */
export const twinPillarCount = (band: number) => Math.min(TWIN_LAYOUT.pillars.length, 4 + Math.ceil(band / 2 / 3));

/** The wall of fire, as the game sees it. */
export const TWIN_WALL: Obstacle = {
  ax: C.x, az: C.z + TWIN_R + 1, bx: C.x, bz: C.z - TWIN_R - 1, r: TWIN_LAYOUT.wallHalf, height: TWIN_LAYOUT.wallHeight, kind: 'wall', fixed: true,
};
/** Ash's pillars standing in this fight's room (`setTwinBand`), and the room's whole cover: the wall first. */
export const TWIN_PILLARS: Obstacle[] = [];
const COVER: Obstacle[] = [TWIN_WALL];

/** Where hero number `n` of a half (0 west, 1 east) comes in. */
export function twinHeroStart(half: number, n: number) {
  const L = TWIN_LAYOUT, col = n % L.rowOf, row = Math.floor(n / L.rowOf);
  return { x: (half ? 1 : -1) * (L.rowFrom + col * L.rowGap), z: C.z + TWIN_R - L.rowIn - row * L.rowGap };
}

let bandNow = 0;
/** Sets the room for a party tuned for `band`, before it is built. Returns whether it changed. */
export function setTwinBand(band: number) {
  if (band === bandNow) return false;
  bandNow = band;
  TWIN_PILLARS.length = 0;
  for (const [x, z] of TWIN_LAYOUT.pillars.slice(0, twinPillarCount(band))) TWIN_PILLARS.push({ ...pillar(x, z, TWIN_LAYOUT.pillarR), height: 3.3 });
  COVER.length = 0;
  COVER.push(TWIN_WALL, ...TWIN_PILLARS);
  return true;
}
setTwinBand(10);

const denProps = () => loadKit(['den_props.glb'], (part, m) => {
  if (part === 'glow') m.emissiveIntensity = Math.min(m.emissiveIntensity, 0.85);
});

/** The floor: the pit's black glass plates over the buried sun; Ash's half clawed and dark, Ember's lit from her vents; a burnt line under the wall. */
function twinFloor() {
  const R = TWIN_R, size = 2048, ppm = size / (2 * R), L = TWIN_LAYOUT;
  const rnd = seeded(717), plates: { pts: [number, number][]; tone: number }[] = [];
  for (let gy = -R; gy <= R; gy += 1.7) {
    for (let gx = -R; gx <= R; gx += 1.7) {
      const cx = gx + (rnd() - 0.5) * 0.8, cy = gy + (rnd() - 0.5) * 0.8, n = 6 + Math.floor(rnd() * 3), r = 1.08 + rnd() * 0.15, a0 = rnd() * 6.28;
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
  // Where Ash dragged his claws: only in his half. In metres from the middle (x east, y south).
  const claws = [{ x: -9, z: 5, dir: 0.5 }, { x: -18, z: -6, dir: -1.1 }, { x: -16, z: 14, dir: 2.6 }, { x: -6, z: -14, dir: 1.3 }, { x: -24, z: 4, dir: 0.2 }];
  const gouges = (g: CanvasRenderingContext2D, style: string, width: number) => {
    g.strokeStyle = style;
    g.lineCap = 'round';
    for (const c of claws) {
      const dx = Math.sin(c.dir), dz = Math.cos(c.dir), px = dz, pz = -dx;
      for (const k of [-1, 0, 1]) {
        g.lineWidth = width * (k === 0 ? 1.2 : 1);
        g.beginPath();
        for (let t = -3; t <= 3; t += 0.4) {
          const bend = Math.sin(t * 0.6) * 0.35, x = c.x + dx * t + px * (k * 0.5 + bend), z = c.z + dz * t + pz * (k * 0.5 + bend);
          if (t === -3) g.moveTo(x * ppm, z * ppm);
          else g.lineTo(x * ppm, z * ppm);
        }
        g.stroke();
      }
    }
  };
  // The canvas's y runs south: a spot (x, z) of the room is at (x, z - C.z) from the middle.
  const vents = [...L.vents.map(([x, z]) => ({ x, z: z - C.z, r: L.ventR })), { x: L.hold[1].x, z: L.hold[1].z - C.z, r: L.greatVentR }];
  const color = canvasTexture(size, (g, s) => {
    g.fillStyle = '#0b0807';
    g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    for (const p of plates) {
      path(g, p.pts);
      g.fillStyle = p.tone < 0.7 ? `rgb(${18 + p.tone * 10},${15 + p.tone * 7},${17 + p.tone * 8})` : `rgb(${40 + p.tone * 12},${22 + p.tone * 6},${16})`;
      g.fill();
      g.strokeStyle = 'rgba(120,110,140,0.12)';
      g.lineWidth = 1.5;
      g.stroke();
    }
    gouges(g, '#050303', 0.5 * ppm);
    // Under the wall the floor is burnt black.
    const burn = g.createLinearGradient(-3 * ppm, 0, 3 * ppm, 0);
    burn.addColorStop(0, 'rgba(0,0,0,0)');
    burn.addColorStop(0.5, 'rgba(0,0,0,0.9)');
    burn.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = burn;
    g.fillRect(-3 * ppm, -s / 2, 6 * ppm, s);
    // Ash's place: a ring of cracked stone where he stands.
    g.strokeStyle = 'rgba(160,120,90,0.28)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(L.hold[0].x * ppm, (L.hold[0].z - C.z) * ppm, 2.9 * ppm, 0, Math.PI * 2);
    g.stroke();
    // The vents' dark mouths.
    for (const v of vents) {
      g.fillStyle = '#060404';
      g.beginPath();
      g.arc(v.x * ppm, v.z * ppm, (v.r + 0.35) * ppm, 0, Math.PI * 2);
      g.fill();
    }
  });
  const glow = canvasTexture(size, (g, s) => {
    g.translate(s / 2, s / 2);
    // The buried sun: brighter under Ember's half, an ember glow under Ash's.
    const light = g.createRadialGradient(L.hold[1].x * ppm, 0, 0, L.hold[1].x * ppm, 0, R * 1.5 * ppm);
    light.addColorStop(0, '#d89a48');
    light.addColorStop(0.3, '#9a4614');
    light.addColorStop(1, '#2a0e05');
    g.fillStyle = light;
    g.fillRect(-s / 2, -s / 2, s, s);
    g.fillStyle = '#000';
    for (const p of plates) {
      path(g, p.pts);
      g.fill();
    }
    gouges(g, '#c8501a', 0.16 * ppm);
    for (const v of vents) {
      const hot = g.createRadialGradient(v.x * ppm, v.z * ppm, 0, v.x * ppm, v.z * ppm, v.r * ppm);
      hot.addColorStop(0, '#ffd08a');
      hot.addColorStop(0.7, '#e8601a');
      hot.addColorStop(1, '#5a1a06');
      g.fillStyle = hot;
      g.beginPath();
      g.arc(v.x * ppm, v.z * ppm, v.r * ppm, 0, Math.PI * 2);
      g.fill();
    }
  });
  return { color, glow };
}

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { return noise(p) * 0.6 + noise(p * 2.1 + 3.7) * 0.28 + noise(p * 4.3 + 9.1) * 0.12; }
`;

/**
 * The wall of fire: a row of flames from rim to rim, each a sheet facing the camera's side (the south), over a strip of molten
 * floor. `set(on)` lights it or puts it out; out, only a burnt line is left. Kept dim on purpose: under the game's bloom a bright
 * wall would hide whoever stands beside it.
 */
class FireWall {
  readonly group = new THREE.Group();
  private flames: THREE.ShaderMaterial;
  private strip: THREE.ShaderMaterial;
  private on = 1;
  private to = 1;

  constructor() {
    const L = TWIN_LAYOUT, len = 2 * TWIN_R, step = 1.5, n = Math.floor(len / step), w = L.wallHalf * 2 + 1.3, h = L.wallHeight;
    const pos: number[] = [], uv: number[] = [], seed: number[] = [], idx: number[] = [];
    const rnd = seeded(31);
    for (let i = 0; i < n; i++) {
      // No two alike: each its own height, width and place across the line, and unevenly spaced along it.
      const z = C.z - TWIN_R + 0.5 + i * step + (rnd() - 0.5) * 0.9, s = rnd(), tall = h * (0.6 + rnd() * 0.55), off = (rnd() - 0.5) * 0.9, b = i * 4;
      const wide = w * (0.75 + rnd() * 0.6);
      pos.push(off - wide / 2, 0, z, off + wide / 2, 0, z, off + wide / 2, tall, z, off - wide / 2, tall, z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      seed.push(s, s, s, s);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    geo.setIndex(idx);
    this.flames = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOn: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          vUv = uv;
          vSeed = aSeed;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOn;
        varying vec2 vUv;
        varying float vSeed;
        ${NOISE}
        void main() {
          float h = vUv.y;
          float n = fbm(vec2(vUv.x * 3.0 + vSeed * 17.0, h * 2.0 - uTime * (1.6 + vSeed * 0.8)));
          float n2 = fbm(vec2(vUv.x * 7.0 - vSeed * 9.0, h * 4.5 - uTime * 2.7));
          float side = max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0);
          // Tongues: wide at the foot, narrowing and breaking up toward their tips.
          float a = smoothstep(0.0, 0.28, (n * 0.7 + n2 * 0.3) * (0.5 + side * 0.95) - h * 0.92 - (1.0 - side) * 0.3 + 0.1);
          vec3 col = mix(vec3(0.7, 0.1, 0.02), vec3(1.0, 0.46, 0.1), smoothstep(0.1, 0.9, a) * (1.0 - h * 0.8));
          gl_FragColor = vec4(col, a * uOn * 0.3);
        }
      `,
    });
    const flames = new THREE.Mesh(geo, this.flames);
    flames.frustumCulled = false;
    flames.renderOrder = 3;
    this.strip = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOn: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOn;
        varying vec2 vUv;
        varying vec3 vWorld;
        ${NOISE}
        void main() {
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float n = fbm(vec2(vWorld.x * 1.6, vWorld.z * 0.7 - uTime * 0.5));
          float hot = smoothstep(0.15, 0.9, across) * (0.55 + 0.45 * n);
          vec3 fire = mix(vec3(0.4, 0.07, 0.015), vec3(0.78, 0.3, 0.06), hot * n);
          vec3 col = mix(vec3(0.02, 0.015, 0.015), fire, uOn);
          gl_FragColor = vec4(col, smoothstep(0.0, 0.35, across) * mix(0.75, 0.7 * hot + 0.15, uOn));
        }
      `,
    });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(L.wallHalf * 2 + 0.5, len - 0.6).rotateX(-Math.PI / 2), this.strip);
    strip.position.set(C.x, 0.045, C.z);
    strip.renderOrder = 1;
    this.group.add(strip, flames);
  }

  /** Lit, or out: it fades over two and a half seconds. `now`: at once (a new fight). */
  set(on: boolean, now = false) {
    this.to = on ? 1 : 0;
    if (now) this.on = this.to;
  }

  update(dt: number, time: number) {
    this.on += Math.sign(this.to - this.on) * Math.min(Math.abs(this.to - this.on), dt / 2.5);
    this.flames.uniforms.uTime.value = this.strip.uniforms.uTime.value = time;
    this.flames.uniforms.uOn.value = this.strip.uniforms.uOn.value = this.on;
  }
}

function build(): ReturnType<ArenaDef['build']> {
  const g = new THREE.Group(), R = TWIN_R, L = TWIN_LAYOUT;
  const lavaTex = lavaTexture();
  const lava = new THREE.Mesh(new THREE.RingGeometry(R + 3, 130, 72, 1), new THREE.MeshBasicMaterial({ map: lavaTex, color: 0xcccccc }));
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(C.x, 0.01, C.z);
  const den = twinFloor();
  const floor = floorDisc(R, new THREE.MeshStandardMaterial({ map: den.color, color: 0xffffff, roughness: 0.55, metalness: 0.15, emissive: 0xffffff, emissiveMap: den.glow, emissiveIntensity: 0.4 }), 0.024, 128);
  g.add(lava, floor, flatRing(R - 0.65, R, 0x0b090c, 0.97, 0.03), flatRing(R - 0.65, R - 0.56, 0xd8581a, 0.85, 0.034));

  // The lip: wide obsidian steps out of the lake. Under 2 m, so the camera looks over them.
  const lip = new THREE.Mesh(
    new THREE.LatheGeometry([[R, 0], [R, 0.3], [R + 0.8, 0.3], [R + 0.8, 0.6], [R + 2.2, 0.6], [R + 2.8, 0.1], [R + 3.2, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 160),
    new THREE.MeshStandardMaterial({ color: 0x1a1518, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide }),
  );
  lip.position.set(C.x, 0, C.z);
  lip.castShadow = lip.receiveShadow = true;
  g.add(lip, flatRing(R + 0.02, R + 0.12, 0xd8581a, 0.8, 0.31));

  // A crater wall far off, so the lake has an edge.
  const crater = new THREE.Mesh(
    new THREE.LatheGeometry([[84, 0], [92, 16], [108, 38], [130, 50]].map(([x, y]) => new THREE.Vector2(x, y)), 64),
    new THREE.MeshStandardMaterial({ color: 0x140c0a, roughness: 1, side: THREE.DoubleSide }),
  );
  crater.position.set(C.x, 0, C.z);
  g.add(crater);

  // Ember's vents: a low collar of dark stone round each mouth, so they read from above. They stop nobody.
  const collar = new THREE.MeshStandardMaterial({ color: 0x1c1416, roughness: 0.7, metalness: 0.1, flatShading: true });
  for (const [x, z, r] of [...L.vents.map(([vx, vz]) => [vx, vz, L.ventR]), [L.hold[1].x, L.hold[1].z, L.greatVentR]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.18, 0.16, 5, 14).rotateX(Math.PI / 2), collar);
    ring.position.set(x, 0.05, z);
    g.add(ring);
  }

  const wall = new FireWall();
  g.add(wall.group);
  const pillars = buildPillars(COVER, TWIN_PILLARS);
  g.add(pillars.group);

  let disposed = false;
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const big = (x: number, z: number, ry: number, s: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, ry), new THREE.Vector3(s, s, s));
  void denProps().then((props) => {
    if (disposed) return;
    // Out in the lava, as round the pit for two, pushed out to the wider rim.
    const place: Record<string, THREE.Matrix4[]> = { SunShard: [], Ribs: [], LanternPost: [], CraterRock: [] };
    place.SunShard.push(big(C.x + 14, C.z - 62, 0.4, 1.3));
    place.Ribs.push(big(C.x - 50, C.z - 8, 1.4, 1.5));
    for (const [x, z] of [[-40, -8], [40, -4], [-38, 20], [39, 22], [-24, -34], [25, -35]]) place.LanternPost.push(big(C.x + x, C.z + z, Math.atan2(-x, -z), 1.2));
    for (const [x, z, s] of [[52, -18, 1.4], [-56, 22, 1.6], [48, 32, 1.2], [-32, -52, 1.5], [40, -48, 1.3]]) place.CraterRock.push(big(C.x + x, C.z + z, x + z, s));
    for (const [name, list] of Object.entries(place)) if (props[name] && list.length) g.add(...instance(props[name], list));
  }).catch((e) => console.warn('twin pit: props failed to load', e));

  // Embers rising off the lava, the seams and the wall.
  const EMBERS = 150;
  const emberPos = new Float32Array(EMBERS * 3), emberSeed = new Float32Array(EMBERS);
  const ernd = seeded(626);
  for (let i = 0; i < EMBERS; i++) {
    emberSeed[i] = ernd();
    // A third of them over the wall's line.
    const a = ernd() * Math.PI * 2, r = 4 + Math.sqrt(ernd()) * (R + 14), onWall = i % 3 === 0;
    emberPos[i * 3] = onWall ? C.x + (ernd() - 0.5) * 1.6 : C.x + Math.sin(a) * r;
    emberPos[i * 3 + 2] = onWall ? C.z + (ernd() * 2 - 1) * R : C.z + Math.cos(a) * r;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ size: 0.14, color: 0xff8a3a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.frustumCulled = false;
  g.add(embers);

  return {
    group: g,
    coverFall: pillars.coverFall,
    resetShift() {
      pillars.resetShift();
      wall.set(true, true);
    },
    // The wall of fire is the room's one wall: broken means it has gone out.
    wallState(index: number, state: WallState) {
      if (COVER[index] === TWIN_WALL) wall.set(state !== 'broken', state === 'whole');
    },
    update(dt, time) {
      pillars.update(dt, time);
      wall.update(dt, time);
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
}

/**
 * The room as the duel takes it. A new object for each band, so a room built for another party is built again (the duel keeps a
 * scene as long as its arena is the same object).
 */
let arena: ArenaDef | null = null;
export function twinPitArena(band: number): ArenaDef {
  if (setTwinBand(band) || !arena) arena = { id: 'twinpit', name: 'The Cinder Pit', ring: TWIN_R, obstacles: COVER, stage: { ...PIT_STAGE, fogNear: 70, fogFar: 200 }, build };
  return arena;
}
