import * as THREE from 'three';
import { RAID_HALL_RING } from '../../server/protocol.mjs';
import { pillar, type Obstacle } from '../obstacles';
import { RING, canvasTexture, disposeTree, flatRing, floorDisc, seeded } from './common';
import { instance, loadKit, merged, type Place } from './temple';
import type { ArenaDef, ArenaStage } from './types';

/** How far the hall's floor reaches from its middle. */
export const HALL_R = RAID_HALL_RING;
const GOLD = 0xc9a24a;

/** The two gates, on the far side where the camera sees them: the Court's and the Pit's. Where a hero walks in to go through. */
export const HALL_GATES: Record<string, { x: number; z: number; yaw: number }> = {
  sun: { x: RING.x - 7, z: RING.z - 9.2, yaw: 0.65 },
  ash: { x: RING.x + 7, z: RING.z - 9.2, yaw: -0.65 },
};

/** The three altars, in an arc before the fallen sun, and where heroes come in: alone, then side 0 and side 1. */
export const HALL_ALTARS = [{ x: RING.x - 5.2, z: RING.z + 3.6 }, { x: RING.x, z: RING.z + 5.2 }, { x: RING.x + 5.2, z: RING.z + 3.6 }];
export const HALL_STARTS: [{ x: number; z: number }, { x: number; z: number }, { x: number; z: number }] = [
  { x: RING.x, z: RING.z + 11 }, { x: RING.x - 1.6, z: RING.z + 11 }, { x: RING.x + 1.6, z: RING.z + 11 },
];

/** Broken rays of the fallen sun, standing out of the floor between the gates. They are the hall's only cover. */
const SHARDS: Obstacle[] = [
  { ...pillar(RING.x, RING.z - 7.2, 0.9), height: 4 },
  { ...pillar(RING.x - 2.5, RING.z - 5.6, 0.6), height: 2.6 },
  { ...pillar(RING.x + 2.5, RING.z - 5.6, 0.6), height: 2.6 },
];

/** Half under what is left of the eclipse, half lit from below. */
const STAGE: ArenaStage = {
  background: 0x130a0c,
  zenith: 0x06050d,
  horizon: 0x4c200e,
  glow: 0xe06a20,
  stars: 0.3,
  fog: 0x1f100c,
  fogNear: 58,
  fogFar: 170,
  hemiSky: 0xb0a0c0,
  hemiGround: 0x34140a,
  hemiIntensity: 0.55,
  sun: 0xffc890,
  sunIntensity: 1.45,
  rim: 0xff8a40,
  rimIntensity: 0.9,
};

/** Metres from the middle to canvas pixels, and the jagged seam between the Court's half and the Pit's. */
const seamX = (z: number) => Math.sin(z * 0.9) * 0.35 + Math.sin(z * 2.3) * 0.18;

/** The floor's colour: slate and gold rings on the Court's side (west), hex basalt on the Pit's (east). */
function hallFloor() {
  return canvasTexture(1536, (g, s) => {
    const rnd = seeded(417), ppm = s / (HALL_R * 2), c = s / 2;
    g.fillStyle = '#10121b';
    g.fillRect(0, 0, s, s);
    g.translate(c, c);
    // The Court's half: slabs in rings.
    g.save();
    g.beginPath();
    g.moveTo(0, -c);
    for (let y = -HALL_R; y <= HALL_R; y += 0.25) g.lineTo(seamX(y) * ppm, y * ppm);
    g.lineTo(-c, c);
    g.lineTo(-c, -c);
    g.closePath();
    g.clip();
    const rings = [[3.4, 5, 16], [5, 7, 22], [7, 9, 28], [9, 11, 34], [11, 13, 40]] as const;
    rings.forEach(([r0, r1, n], ri) => {
      for (let k = 0; k < n; k++) {
        const a0 = ((k + (ri % 2) * 0.5) / n) * Math.PI * 2, a1 = ((k + 1 + (ri % 2) * 0.5) / n) * Math.PI * 2;
        g.fillStyle = rnd() < 0.5 ? `rgba(120,130,170,${0.02 + rnd() * 0.03})` : `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
        g.beginPath();
        g.arc(0, 0, r1 * ppm, a0, a1);
        g.arc(0, 0, r0 * ppm, a1, a0, true);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(4,4,9,0.85)';
        g.lineWidth = 2.5;
        g.stroke();
      }
    });
    g.strokeStyle = 'rgba(201,162,74,0.55)';
    g.lineWidth = 4;
    for (const r of [5, 9]) {
      g.beginPath();
      g.arc(0, 0, r * ppm, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    // The Pit's half: hex basalt.
    g.save();
    g.beginPath();
    g.moveTo(0, -c);
    for (let y = -HALL_R; y <= HALL_R; y += 0.25) g.lineTo(seamX(y) * ppm, y * ppm);
    g.lineTo(c, c);
    g.lineTo(c, -c);
    g.closePath();
    g.clip();
    g.fillStyle = '#17110f';
    g.fillRect(-c, -c, s, s);
    const hex = 1.05 * ppm, w = hex * Math.sqrt(3);
    for (let row = -16; row <= 16; row++) {
      for (let col = -16; col <= 16; col++) {
        const x = (col + (row % 2 ? 0.5 : 0)) * w, y = row * hex * 1.5;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 6 + k * Math.PI / 3, px = x + Math.cos(a) * hex * 0.96, py = y + Math.sin(a) * hex * 0.96;
          if (k) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.closePath();
        g.fillStyle = `rgb(${34 + rnd() * 14},${26 + rnd() * 10},${22 + rnd() * 8})`;
        g.fill();
      }
    }
    g.restore();
    // The fallen sun: a gold wheel sunk in the floor, with its rays.
    g.fillStyle = '#6a5228';
    g.beginPath();
    g.arc(0, 0, 3.5 * ppm, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d9b45c';
    g.lineWidth = 7;
    for (const r of [3.4, 2.5, 1.3]) {
      g.beginPath();
      g.arc(0, 0, r * ppm, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 5;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 1.3 * ppm, Math.sin(a) * 1.3 * ppm);
      g.lineTo(Math.cos(a) * 3.4 * ppm, Math.sin(a) * 3.4 * ppm);
      g.stroke();
    }
  });
}

/** Where the floor glows: lava in the cracks that run out of the fallen sun, into the Pit's half. */
function hallGlow() {
  return canvasTexture(1536, (g, s) => {
    const rnd = seeded(902), ppm = s / (HALL_R * 2), c = s / 2;
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.translate(c, c);
    g.lineCap = 'round';
    g.strokeStyle = '#ff7a24';
    const crack = (a: number, from: number, to: number, width: number) => {
      let x = Math.cos(a) * from, y = Math.sin(a) * from, r = from;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x * ppm, y * ppm);
      while (r < to) {
        r += 0.5 + rnd() * 0.5;
        a += (rnd() - 0.5) * 0.45;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r;
        g.lineTo(x * ppm, y * ppm);
      }
      g.stroke();
    };
    // Through the wheel, then out over the Pit's half.
    for (let k = 0; k < 7; k++) crack(rnd() * Math.PI * 2, 0.3, 3.4, 5);
    for (let k = 0; k < 11; k++) crack((-0.45 + (k / 10) * 0.9) * Math.PI, 3.2, 8 + rnd() * 4.5, 3 + rnd() * 3);
    // A few thin ones on the Court's side, where it broke.
    for (let k = 0; k < 4; k++) crack(Math.PI * (0.8 + rnd() * 0.4), 3.2, 5 + rnd() * 2, 2);
    // The seam itself.
    g.lineWidth = 4;
    g.strokeStyle = '#ff9a40';
    for (const [a, b] of [[-HALL_R, -3.6], [3.6, HALL_R]]) {
      g.beginPath();
      for (let y = a; y <= b; y += 0.25) {
        if (y === a) g.moveTo(seamX(y) * ppm, y * ppm);
        else g.lineTo(seamX(y) * ppm, y * ppm);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,190,110,0.55)';
    g.beginPath();
    g.arc(0, 0, 1.2 * ppm, 0, Math.PI * 2);
    g.fill();
  });
}

const portalVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const portalFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpen;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - vec2(0.5, 0.0);
    float edge = smoothstep(0.5, 0.2, abs(p.x)) * smoothstep(1.0, 0.75, vUv.y);
    float waves = 0.7 + 0.3 * sin(vUv.y * 11.0 - uTime * 3.0 + sin(p.x * 13.0 + uTime) * 1.4);
    float core = smoothstep(0.34, 0.0, abs(p.x)) * (1.0 - vUv.y * 0.6);
    gl_FragColor = vec4(uColor * edge * waves * (0.35 + 1.1 * core) * uOpen, 1.0);
  }
`;

const STONE = new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.85, flatShading: true });

/**
 * A gate of the keep: two tall posts, a lintel with what lies beyond on it, and light between the posts once it opens. The hall
 * has two, and each boss room has one to come in by and one to leave by, so it all reads as one place.
 */
export class KeepGate {
  readonly group = new THREE.Group();
  private light: THREE.ShaderMaterial;
  private open = 0;
  private wanted = 0;
  private trim: THREE.MeshStandardMaterial;

  /** `tone`: gold for the Court's, ember for the Pit's. */
  constructor(x: number, z: number, yaw: number, tone: 'sun' | 'ash') {
    const color = tone === 'sun' ? 0xffc860 : 0xff6a20;
    this.trim = new THREE.MeshStandardMaterial({ color: tone === 'sun' ? GOLD : 0x8a3a18, roughness: 0.42, metalness: 0.75, emissive: color, emissiveIntensity: 0.12 });
    const W = 2.1, H = 5.4;
    const post = new THREE.BoxGeometry(0.85, H, 0.95).translate(0, H / 2, 0);
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(post, STONE);
      p.position.x = side * W;
      p.castShadow = true;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 1.05), this.trim);
      band.position.set(side * W, H * 0.7, 0);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 1.25), STONE);
      foot.position.set(side * W, 0.25, 0);
      this.group.add(p, band, foot);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.6, 0.8, 1.15), STONE);
    lintel.position.y = H + 0.3;
    lintel.castShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.1, 0.24, 1.25), this.trim);
    top.position.y = H - 0.14;
    // What lies beyond: a sun's ring for the Court, a flame's tongue for the Pit.
    const sign = tone === 'sun'
      ? new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.13, 8, 28), this.trim)
      : new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.45, 6).scale(1, 1, 0.5), this.trim);
    sign.position.set(0, H + 1.25, 0);
    this.group.add(lintel, top, sign);
    this.light = new THREE.ShaderMaterial({
      vertexShader: portalVertex, fragmentShader: portalFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpen: { value: 0 }, uTime: { value: 0 } },
    });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 - 0.85, H - 0.1).translate(0, (H - 0.1) / 2, 0), this.light);
    portal.renderOrder = 2;
    this.group.add(portal);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
  }

  /** Light between the posts, or none. It eases there. */
  setOpen(on: boolean) {
    this.wanted = on ? 1 : 0;
  }

  update(dt: number, time: number) {
    this.open += (this.wanted - this.open) * Math.min(1, dt * 4);
    this.light.uniforms.uOpen.value = this.open;
    this.light.uniforms.uTime.value = time;
    this.trim.emissiveIntensity = 0.12 + 0.9 * this.open;
  }

  dispose() {
    this.group.removeFromParent();
    disposeTree(this.group);
  }
}

/**
 * Noonfall's hall: the place between the bosses. A sun fell into the mountain at noon, and this is what is left of it, sunk in the
 * floor: the Court's marble and gold on one side, the Pit's basalt and lava on the other. All first-pass, drawn in code with the
 * temple's and the caldera's props, for the artist to direct.
 */
export const noonfallHall: ArenaDef = {
  id: 'noonfall',
  name: 'Noonfall',
  ring: HALL_R,
  obstacles: SHARDS,
  stage: STAGE,
  build() {
    const g = new THREE.Group();
    const R = HALL_R;
    const apron = floorDisc(46, new THREE.MeshStandardMaterial({ color: 0x14100f, roughness: 0.95 }), 0.004, 64);
    const disc = floorDisc(R, new THREE.MeshStandardMaterial({ map: hallFloor(), roughness: 0.78, metalness: 0.14, emissive: 0xffffff, emissiveMap: hallGlow(), emissiveIntensity: 0.9 }));
    disc.receiveShadow = true;
    g.add(apron, disc, flatRing(R - 0.14, R, GOLD, 0.75, 0.02));

    // The rim: wide steps, so the hall reads as sunken. Under 2 m, so the camera looks over them.
    const steps = new THREE.Mesh(
      new THREE.LatheGeometry([[R, 0], [R, 0.35], [R + 0.8, 0.35], [R + 0.8, 0.7], [R + 1.6, 0.7], [R + 1.6, 1.05], [R + 2.6, 1.05], [R + 3, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 96),
      new THREE.MeshStandardMaterial({ color: 0x2c2830, roughness: 0.9, side: THREE.DoubleSide }),
    );
    steps.position.set(RING.x, 0, RING.z);
    steps.castShadow = steps.receiveShadow = true;
    g.add(steps, flatRing(R + 0.02, R + 0.12, GOLD, 0.85, 0.355));

    // The broken rays of the fallen sun, standing where they struck.
    const rayMat = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.38, metalness: 0.8, flatShading: true, emissive: 0xff8a30, emissiveIntensity: 0.1 });
    SHARDS.forEach((o, i) => {
      const r = o.r, h = o.height ?? 3;
      const ray = new THREE.Mesh(new THREE.ConeGeometry(r * 1.25, h * 1.25, 5).translate(0, (h * 1.25) / 2, 0), rayMat);
      ray.position.set(o.ax, 0, o.az);
      ray.rotation.set(i === 0 ? 0.08 : i === 1 ? -0.2 : 0.16, i * 1.3, i === 0 ? -0.1 : i === 1 ? -0.22 : 0.26);
      ray.castShadow = true;
      g.add(ray);
    });

    let disposed = false;
    const rnd = seeded(1311);
    const UP = new THREE.Vector3(0, 1, 0);
    // The two lairs' own pieces on their two sides: the Warden's obelisks and arches on the Court's (west), Ash and Ember's spires,
    // rocks and lanterns on the Pit's (east). Nothing tall on the camera's side.
    const court: Place = {}, pit: Place = {};
    const put = (into: Place, name: string, x: number, z: number, ry: number, s = 1) =>
      (into[name] ??= []).push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(s, s, s)));
    const facing = (x: number, z: number) => Math.atan2(RING.x - x, RING.z - z);
    for (let k = 0; k < 6; k++) {
      const an = Math.PI + 0.25 + (k / 5) * (Math.PI * 0.62), d = 19 + rnd() * 4, x = RING.x + Math.sin(an) * d, z = RING.z + Math.cos(an) * d;
      if (z > RING.z + 8) continue;
      put(court, k % 2 ? 'Obelisk' : 'Column', x, z, facing(x, z), k % 2 ? 0.75 : 1.3);
    }
    put(court, 'Arch', RING.x - 24, RING.z - 4, facing(RING.x - 24, RING.z - 4), 1.1);
    for (let k = 0; k < 6; k++) {
      const an = Math.PI - 0.25 - (k / 5) * (Math.PI * 0.62), d = 18 + rnd() * 5, x = RING.x + Math.sin(an) * d, z = RING.z + Math.cos(an) * d;
      if (z > RING.z + 8) continue;
      put(pit, k % 3 === 2 ? 'CraterRock' : 'Spire', x, z, rnd() * 6.28, k % 3 === 2 ? 0.7 : 1.6 + rnd() * 0.6);
    }
    for (const [x, z] of [[18, -2], [15, -12]]) put(pit, 'LanternPost', RING.x + x, RING.z + z, facing(RING.x + x, RING.z + z));
    void loadKit(['sanctum_props.glb']).then((props) => {
      if (!disposed) g.add(...merged(props, court));
    }).catch((e) => console.warn('noonfall: the sanctum kit failed to load', e));
    void loadKit(['den_props.glb']).then((props) => {
      if (disposed) return;
      for (const [name, list] of Object.entries(pit)) if (props[name] && list.length) g.add(...instance(props[name], list));
    }).catch((e) => console.warn('noonfall: the den kit failed to load', e));

    return {
      group: g,
      dispose() {
        disposed = true;
        rayMat.dispose();
        disposeTree(g);
      },
    };
  },
};
