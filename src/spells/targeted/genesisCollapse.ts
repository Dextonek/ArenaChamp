import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, LightPillar, createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  CrescentArc, HeatHaze, LightningArc, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic,
  createScreenFx, flashBeat, impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Genesis Collapse (targeted cinematic ultimate, up to 8 enemies, ~60 s): the caster is lifted out of the arena
 * on a column of light (a stand-in figure rises; the real caster is only hidden and restored), the camera leaves
 * the atmosphere for orbit, matter spirals in and the caster forges a star in three colour stages (teal, violet,
 * gold), a dead beat, then hurls it down: the camera falls with it, cuts to the arena sky, the star lands, every
 * enemy is hit once, whiteout, the planet seen from orbit with a ring of light, dust walls, a calm scorched arena.
 *
 * Camera: scripted with `cinematic` (hard cuts, held shots, letterbox in/out). The space scenes live in a "void"
 * set 4000 units above the arena (camera far plane is 400, so the arena disappears by itself). A sky dome and a
 * star dome follow the camera, because the scene background is not black.
 *
 * Recipes: g-castorice-dragon-rise-cutscene (shot grammar, held reveal), g-castorice-wing-nova-finisher (finisher
 * pacing, ink frame, whiteout then held result), b-lost-ark-sorceress-doomsday (a celestial body falling at huge
 * scale), VFX_PRINCIPLES section 10 (charge in a void, hit in the world; transitions are VFX; dead beat).
 *
 * Timeline (script seconds, scaled by duration / 60):
 *  0 resolve | 6 ascension | 14.2 orbit | 22 forge | 36 dead beat, 36.6 throw | 38.6 sky | 42 impact |
 *  43.4 orbit view | 46.8 dust | 50 aftermath | 60 end
 */
export interface GenesisCollapseSettings {
  /** Total length in seconds; every act scales with it. */
  duration: number;
  damage: number;
  loop: boolean;
}

export const defaultGenesisCollapse = (): GenesisCollapseSettings => ({ duration: 60, damage: 120, loop: false });

const U = {
  rise: 6, riseCut: 10, smear: 13.9, orbit: 14.2, orbit2: 18.4, forge: 22, st2: 27, st3: 31.5,
  dead: 36, throw: 36.6, ground: 38.6, hit: 42, orbitHit: 43.4, dust: 46.8, after: 50, med: 55, end: 60,
};

const BASE_DURATION = 60;
const MAX_TARGETS = 8;
const CHUNKS = 150;
const GAS = 280;
const CLOUDS = 18;
const WALLS = 20;
const STREAKS = 26;
const HEIGHT = 165; // how high the stand-in rises in the arena sky
const R_PLANET = 200;
const R_STAR_A = 9; // the falling star in the arena sky

/** The void set: planet, stars, forge. 4000 units above the arena, far outside the 400 unit far plane. */
const O = new THREE.Vector3(0, 4000, 0);
const FZ = O.clone().add(new THREE.Vector3(0, 90, 0)); // where the caster floats in orbit
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));

function ramp(u: number, pts: readonly (readonly [number, number])[]): number {
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (u <= pts[i][0]) {
      const a = pts[i - 1], b = pts[i];
      const d = b[0] - a[0];
      return d <= 1e-6 ? b[1] : a[1] + ((b[1] - a[1]) * (u - a[0])) / d;
    }
  }
  return pts[pts.length - 1][1];
}

/** Colour stages of the forge (core, hot, body, dark). Teal, then violet, then star gold. */
const STAGES = [
  { core: new THREE.Color(0xe6fffb), hot: new THREE.Color(0x7ff0e0), body: new THREE.Color(0x3ad8c8), dark: new THREE.Color(0x0a3a40) },
  { core: new THREE.Color(0xf0e6ff), hot: new THREE.Color(0xc7a8ff), body: new THREE.Color(0x8a5aff), dark: new THREE.Color(0x2a1060) },
  { core: new THREE.Color(0xfff4d6), hot: new THREE.Color(0xffe08a), body: new THREE.Color(0xff7a2a), dark: new THREE.Color(0x7a2a08) },
];

const NOISE_GLSL = /* glsl */ `
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float vnoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x);
    float b = mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x);
    float c = mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x);
    float d = mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
  }
`;

// --- Textures --------------------------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cloudTexture() {
  return canvasTexture(128, 128, (c) => {
    for (let i = 0; i < 9; i++) {
      const x = 64 + (Math.random() - 0.5) * 56, y = 64 + (Math.random() - 0.5) * 30, r = 22 + Math.random() * 26;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }
  });
}

function starsTexture() {
  return canvasTexture(1024, 512, (c) => {
    const blob = (x: number, y: number, r: number, rgba: string) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    // A faint violet and teal nebula band, then hard little stars.
    for (let i = 0; i < 16; i++) {
      const x = i * 70 + Math.random() * 40, y = 230 + Math.sin(i * 0.7) * 60 + Math.random() * 40;
      blob(x, y, 90 + Math.random() * 70, i % 3 === 0 ? 'rgba(58,216,200,0.07)' : 'rgba(138,90,255,0.09)');
    }
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.6})`;
      const s = Math.random() < 0.9 ? 1 : 2;
      c.fillRect(Math.random() * 1024, Math.random() * 512, s, s);
    }
    c.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 1024, y = Math.random() * 512;
      c.fillRect(x - 3, y, 7, 1);
      c.fillRect(x, y - 3, 1, 7);
    }
  });
}

/** White cracks on black: red channel is the crack mask for the crater. */
function crackTexture() {
  return canvasTexture(512, 512, (c) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, 512, 512);
    c.strokeStyle = '#fff';
    c.lineCap = 'round';
    const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
      if (len < 10 || depth > 3) return;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(x, y);
      let px = x, py = y, pa = a;
      for (let i = 0; i < 6; i++) {
        pa += (Math.random() - 0.5) * 0.7;
        px += Math.cos(pa) * (len / 6);
        py += Math.sin(pa) * (len / 6);
        c.lineTo(px, py);
      }
      c.stroke();
      if (Math.random() < 0.8) branch(px, py, pa + 0.6, len * 0.5, w * 0.6, depth + 1);
      if (Math.random() < 0.5) branch(px, py, pa - 0.7, len * 0.45, w * 0.6, depth + 1);
    };
    for (let i = 0; i < 15; i++) branch(256, 256, (i / 15) * Math.PI * 2 + Math.random() * 0.3, 150 + Math.random() * 90, 5, 0);
  });
}

// --- Small building blocks -------------------------------------------------------------------------------

/** Toon star: banded, hard limb outline. Palette is set per colour stage. */
class Sun {
  readonly group = new THREE.Group();
  readonly flare = new StarBurst({ points: 8, inner: 0.2, jitter: 0.25, color: 0xff7a2a, core: 0xffe08a, additive: false });
  private mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uCore: { value: new THREE.Color() }, uHot: { value: new THREE.Color() },
        uBody: { value: new THREE.Color() }, uDark: { value: new THREE.Color() }, uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView; varying vec3 vObj;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); vObj = normal;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore, uHot, uBody, uDark; uniform float uTime;
        varying vec3 vN; varying vec3 vView; varying vec3 vObj;
        ${NOISE_GLSL}
        void main() {
          float rr = 1.0 - clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
          float t = 0.6 * vnoise(vObj * 3.0 + vec3(0.0, uTime * 0.35, 0.0)) + 0.4 * vnoise(vObj * 7.0 - vec3(uTime * 0.2));
          float v = (1.0 - rr * rr * 1.1) + (t - 0.5) * 0.85;
          vec3 col = v > 1.12 ? uCore : (v > 0.78 ? uHot * 0.85 : (v > 0.42 ? uBody * 0.9 : uDark));
          if (rr > 0.965) col = vec3(0.012, 0.008, 0.012);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), this.mat);
    this.group.add(this.mesh, this.flare.mesh);
    this.group.visible = false;
  }

  setPalette(p: { core: THREE.Color; hot: THREE.Color; body: THREE.Color; dark: THREE.Color }) {
    const u = this.mat.uniforms;
    (u.uCore.value as THREE.Color).copy(p.core);
    (u.uHot.value as THREE.Color).copy(p.hot);
    (u.uBody.value as THREE.Color).copy(p.body);
    (u.uDark.value as THREE.Color).copy(p.dark);
    this.flare.color.copy(p.body);
    this.flare.coreColor.copy(p.hot);
  }

  /** `flare` is the ray star's size in star radii (0 hides it). */
  set(pos: THREE.Vector3, radius: number, time: number, flare: number, spin: number) {
    this.group.visible = radius > 1e-3;
    this.group.position.copy(pos);
    this.mesh.scale.setScalar(Math.max(radius, 1e-4));
    this.mat.uniforms.uTime.value = time;
    this.flare.set(v3(), radius * flare, flare > 0 ? 0.95 : 0, spin);
  }

  hide() {
    this.group.visible = false;
  }
}

/** Dark-bodied stand-in for the caster (the arena caster is only hidden, never moved). */
class Hero {
  readonly group = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private body: THREE.MeshStandardMaterial;
  private halo: THREE.Mesh;
  private haloMat = new THREE.MeshBasicMaterial({ color: 0xe8c06a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  private tmpQ = new THREE.Quaternion();

  constructor() {
    this.body = new THREE.MeshStandardMaterial({ color: 0x2a2f2c, metalness: 0.6, roughness: 0.45, emissive: 0x000000 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.4 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xb8bcb6, roughness: 0.6 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 4, 12), this.body);
    torso.position.y = 1.15;
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.9, 6, 1, true), new THREE.MeshStandardMaterial({
      color: 0x15181a, roughness: 0.8, side: THREE.DoubleSide,
    }));
    cape.position.set(0, 1.0, -0.3);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), bone);
    head.position.y = 2.15;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 6, 20), gold);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 1.0;
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    gem.position.set(0, 1.5, 0.42);
    const armGeo = new THREE.CapsuleGeometry(0.11, 0.7, 4, 8);
    for (const [arm, x] of [[this.armL, 0.55], [this.armR, -0.55]] as const) {
      arm.position.set(x, 1.7, 0);
      const m = new THREE.Mesh(armGeo, this.body);
      m.position.y = -0.45;
      arm.add(m);
    }
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), this.haloMat);
    this.group.add(torso, cape, head, belt, gem, this.armL, this.armR, this.halo);
    this.group.visible = false;
  }

  /** `raise` 0..1 lifts both arms, `thrust` 0..1 swings them forward and down (the throw). */
  pose(raise: number, thrust: number) {
    const z = (1 - thrust) * raise * 2.5;
    this.armL.rotation.set(-thrust * 2.0, 0, z);
    this.armR.rotation.set(-thrust * 2.0, 0, -z);
  }

  /** Warm rim light from the star: emissive stays below the bloom threshold. */
  light(color: THREE.Color, amount: number) {
    this.body.emissive.copy(color).multiplyScalar(0.3 * amount);
  }

  /** Gold ring behind the figure, always facing the camera, so it reads as a drawn shape in wide shots. */
  faceHalo(camQ: THREE.Quaternion, camForward: THREE.Vector3, opacity: number, size: number) {
    this.haloMat.opacity = opacity;
    this.halo.visible = opacity > 0.01;
    this.halo.scale.setScalar(size);
    this.tmpQ.copy(this.group.quaternion).invert();
    this.halo.quaternion.copy(this.tmpQ).multiply(camQ);
    this.halo.position.set(0, 1.4, 0).addScaledVector(camForward.clone().applyQuaternion(this.tmpQ), 0.8);
  }
}

/** A pool of camera-facing soft quads (clouds, dust walls). */
class QuadField {
  readonly group = new THREE.Group();
  private quads: THREE.Mesh[] = [];
  private mat: THREE.MeshBasicMaterial;
  private tmp = new THREE.Quaternion();

  constructor(count: number, tex: THREE.Texture, color: number, geo: THREE.PlaneGeometry) {
    this.mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, this.mat);
      m.visible = false;
      m.frustumCulled = false;
      this.quads.push(m);
      this.group.add(m);
    }
  }

  get count() {
    return this.quads.length;
  }

  set opacity(v: number) {
    this.mat.opacity = v;
  }

  place(i: number, pos: THREE.Vector3, w: number, h: number, rot: number, camQ: THREE.Quaternion) {
    const m = this.quads[i];
    m.visible = true;
    m.position.copy(pos);
    m.scale.set(w, h, 1);
    m.quaternion.copy(camQ).multiply(this.tmp.setFromAxisAngle(Z_AXIS, rot));
  }

  hideAll() {
    for (const m of this.quads) m.visible = false;
  }
}

// --- The effect ------------------------------------------------------------------------------------------

export class GenesisCollapse implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GenesisCollapseSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  /** Orbit clock in script seconds: frozen during the dead beat. */
  private orb = 0;
  private hitDone = false;
  private smokeDone = false;
  private casterHidden = false;
  private keys: ShotKey[] = [];
  private lastPick = -1;

  // Cast geometry.
  private P = v3(0, 0, 14);
  private C = v3();
  private fwd = v3(0, 0, -1);
  private right = v3(1, 0, 0);
  private aim = 0;
  private targetSil: THREE.Object3D[] = [];

  // Camera helper for billboards.
  private camHelp = new THREE.PerspectiveCamera();
  private camForward = v3();

  // Sky.
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private starMat: THREE.MeshBasicMaterial;
  private starDome: THREE.Mesh;

  // Ground (arena) set.
  private groundG = new THREE.Group();
  private windPlanes: THREE.Group[] = [];
  private wind: CrescentArc[] = [];
  private pillar = new LightPillar(0xffe08a, 1.4);
  private liftRing = createRing(0xffe08a, 0.9, 1, 64);
  private clouds: QuadField;
  private cloudSeed = Array.from({ length: CLOUDS }, () => ({
    a: Math.random() * Math.PI * 2, d: 3 + Math.random() * 24, y: 18 + Math.random() * 135, s: 14 + Math.random() * 14, r: Math.random() * 6.28,
  }));
  private walls: QuadField;
  private wallSeed = Array.from({ length: WALLS }, (_, i) => ({ a: (i / WALLS) * Math.PI * 2 + Math.random() * 0.2, h: 6 + Math.random() * 5, r: Math.random() * 6.28, y: Math.random() * 2 }));
  private sunA = new Sun();
  private crater: THREE.Mesh;
  private craterMat: THREE.ShaderMaterial;
  private shockRing = createRing(0xffe08a, 0.9, 1, 96);
  private shockRing2 = createRing(0xff7a2a, 0.94, 1, 96);
  private shockRefract = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private craterHaze = new HeatHaze({ width: 8, height: 10, scale: 3 });
  private shockDome = new GlowSphere(0xff7a2a);
  private impactStar = new StarBurst({ points: 12, inner: 0.22, color: 0xff7a2a, core: 0xffe08a, additive: false });
  private hitStars: StarBurst[] = [];
  private smoke = new SmokeBall({ maxBalls: MAX_TARGETS + 2 });

  // The caster stand-in (ground set while rising, void set while forging).
  private hero = new Hero();

  // Void set.
  private voidG = new THREE.Group();
  private planetMat: THREE.ShaderMaterial;
  private atmoMat: THREE.ShaderMaterial;
  private planetRingMat: THREE.ShaderMaterial;
  private planetRing: THREE.Mesh;
  private spot: THREE.Mesh;
  private sunV = new Sun();
  private flashDot = new StarBurst({ points: 8, inner: 0.18, color: 0xff7a2a, core: 0xffe08a, additive: false });
  private diskG = new THREE.Group();
  private diskMat: THREE.ShaderMaterial;
  private debris: THREE.InstancedMesh;
  private debrisMat: THREE.ShaderMaterial;
  private chunks = Array.from({ length: CHUNKS }, (_, i) => ({
    r0: 13 + Math.random() * 22, ph: Math.random() * Math.PI * 2, plane: i % 3, s: 0.35 + Math.random() * 0.9,
    y: (Math.random() - 0.5) * 3, ax: v3().randomDirection(), spin: 0.5 + Math.random() * 2, delay: Math.random() * 0.4,
  }));
  private chunkPos = Array.from({ length: CHUNKS }, () => v3());
  private chunkOn = new Array<boolean>(CHUNKS).fill(false);
  private planeQ = [
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0.1)),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0, -0.45)),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, 0.9)),
  ];
  private gasGeo = new THREE.BufferGeometry();
  private gasPos = new Float32Array(GAS * 3);
  private gasMat = new THREE.PointsMaterial({
    size: 0.55, map: softDotTexture(), color: 0x3ad8c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private gas: THREE.Points;
  private gasSeed = Array.from({ length: GAS }, (_, i) => ({ r0: 9 + Math.random() * 30, ph: Math.random() * 6.28, plane: i % 3, y: (Math.random() - 0.5) * 2.4 }));
  private bolts: LightningArc[] = [];
  private boltPick = [{ a: 0, b: 1 }, { a: 2, b: 3 }, { a: 4, b: 5 }, { a: 6, b: 7 }];
  private boltClock = 0;

  // Emitters.
  private motesRise: Emitter;
  private motesFall: Emitter;
  private plasma: Emitter;
  private trailSmoke: Emitter;
  private sparks: Emitter;
  private embers: Emitter;
  private dust: Emitter;

  // Cinematic-only screen-space streaks (diagonal speed smear).
  private streakGeo = new THREE.PlaneGeometry(1, 1);
  private streaks: THREE.Mesh[] = [];
  private streakMats = [
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: 0x8a5aff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
  ];
  private streakSeed = Array.from({ length: STREAKS }, () => ({ y: (Math.random() - 0.5) * 5.2, len: 6 + Math.random() * 8, w: 0.03 + Math.random() * 0.1, o: Math.random() * 0.45 }));

  private tmpV = v3();
  private tmpV2 = v3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = v3();
  private tmpC = new THREE.Color();
  private stageNow = { core: new THREE.Color(), hot: new THREE.Color(), body: new THREE.Color(), dark: new THREE.Color() };

  constructor(settings: GenesisCollapseSettings = defaultGenesisCollapse()) {
    this.settings = settings;
    this.screen.tint.set(0x40508a);
    this.screen.impactColor.set(0x3ad8c8);
    this.screen.whiteColor.set(0xfff0d8);
    this.screen.speedLineColor.set(0xffe08a);
    this.screen.edgeTint.set(0xff7a2a);

    // Sky domes follow the camera. The gradient dome also paints solid black for space.
    this.skyMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide,
      uniforms: { uTop: { value: new THREE.Color(0x030308) }, uHor: { value: new THREE.Color(0x030308) }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHor; uniform float uOpacity; varying vec3 vDir;
        void main() { gl_FragColor = vec4(mix(uHor, uTop, smoothstep(-0.05, 0.65, vDir.y)), uOpacity); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), this.skyMat);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.starMat = new THREE.MeshBasicMaterial({
      map: starsTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide, toneMapped: false,
    });
    this.starDome = new THREE.Mesh(new THREE.SphereGeometry(370, 32, 16), this.starMat);
    this.starDome.renderOrder = -999;
    this.starDome.frustumCulled = false;
    this.group.add(this.sky, this.starDome, this.groundG, this.voidG, this.hero.group);

    this.buildGround();
    this.craterMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uCrack: { value: crackTexture() }, uHeat: { value: 1 }, uOp: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uCrack; uniform float uHeat, uOp; varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float n = vnoise(vec3(vUv * 9.0, 1.0));
          float scorch = smoothstep(1.0, 0.35, d + (n - 0.5) * 0.35);
          float crack = texture2D(uCrack, vUv).r * smoothstep(1.0, 0.15, d);
          float heat = crack * uHeat;
          vec3 hot = mix(vec3(0.42, 0.1, 0.04), vec3(1.0, 0.48, 0.16), uHeat);
          vec3 col = mix(vec3(0.02, 0.015, 0.02), hot, step(0.2, heat) * min(1.0, heat * 1.6));
          float a = max(scorch * 0.9, step(0.2, heat)) * uOp;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.crater = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.craterMat);
    this.crater.rotation.x = -Math.PI / 2;
    this.crater.visible = false;
    this.groundG.add(this.crater);

    // --- void set: planet, atmosphere, impact ring, arena spot ---
    const planetCenter = O.clone().add(v3(0, -R_PLANET, 0));
    this.planetMat = new THREE.ShaderMaterial({
      uniforms: {
        uStarPos: { value: v3(0, 1e5, 0) }, uStarI: { value: 0 }, uTime: { value: 0 },
        uOcean: { value: new THREE.Color(0x10306a) }, uLand: { value: new THREE.Color(0x2a5a58) },
        uIce: { value: new THREE.Color(0x9ab8d8) }, uWarm: { value: new THREE.Color(0xff7a2a) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vObj; varying vec3 vWorld; varying vec3 vN;
        void main() {
          vObj = normalize(position);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uStarPos, uOcean, uLand, uIce, uWarm; uniform float uStarI, uTime;
        varying vec3 vObj; varying vec3 vWorld; varying vec3 vN;
        ${NOISE_GLSL}
        void main() {
          vec3 p = vObj * 3.2;
          float c = 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.1) + 0.15 * vnoise(p * 4.3);
          vec3 base = c > 0.56 ? uLand : uOcean;
          base = mix(base, uIce, smoothstep(0.78, 0.86, abs(vObj.y)));
          float cl = vnoise(vec3(vObj.x * 6.0 + uTime * 0.02, vObj.y * 14.0, vObj.z * 6.0));
          if (cl > 0.72) base = mix(base, vec3(0.3, 0.34, 0.42), 0.55);
          vec3 N = normalize(vN);
          float key = max(dot(N, normalize(vec3(0.5, 0.6, 0.35))), 0.0);
          key = floor(key * 3.0 + 0.5) / 3.0;
          vec3 toStar = uStarPos - vWorld;
          float sl = max(dot(N, toStar / max(length(toStar), 1.0)), 0.0) * uStarI;
          sl = floor(sl * 4.0 + 0.5) / 4.0;
          vec3 col = base * (0.14 + 0.5 * key) + uWarm * sl * (base * 1.2 + 0.1);
          gl_FragColor = vec4(min(col, vec3(0.78)), 1.0);
        }`,
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(R_PLANET, 64, 48), this.planetMat);
    planet.position.copy(planetCenter);
    this.atmoMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x3ad8c8) }, uFlare: { value: new THREE.Color(0xff7a2a) }, uFlareAmt: { value: 0 }, uOpacity: { value: 0.5 } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor, uFlare; uniform float uFlareAmt, uOpacity; varying vec3 vN; varying vec3 vView;
        void main() {
          float a = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 4.0);
          gl_FragColor = vec4(mix(uColor, uFlare, uFlareAmt), a * uOpacity);
        }`,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R_PLANET * 1.03, 48, 32), this.atmoMat);
    atmo.position.copy(planetCenter);
    this.planetRingMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uAng: { value: 0 }, uW: { value: 0.05 }, uOp: { value: 0 }, uScorch: { value: 0 } },
      vertexShader: /* glsl */ `varying vec3 vObj; void main() { vObj = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uAng, uW, uOp, uScorch; varying vec3 vObj;
        void main() {
          float a = acos(clamp(vObj.y, -1.0, 1.0));
          float ring = 1.0 - smoothstep(uW * 0.4, uW, abs(a - uAng));
          float inner = 1.0 - smoothstep(uAng * 0.5, uAng, a);
          vec3 col = mix(vec3(0.03, 0.01, 0.01), vec3(1.0, 0.48, 0.16), ring);
          col = mix(col, vec3(1.0, 0.88, 0.54), smoothstep(0.7, 1.0, ring));
          gl_FragColor = vec4(col, max(ring, inner * 0.6 * uScorch) * uOp);
        }`,
    });
    this.planetRing = new THREE.Mesh(new THREE.SphereGeometry(R_PLANET * 1.004, 64, 48), this.planetRingMat);
    this.planetRing.position.copy(planetCenter);
    this.planetRing.visible = false;
    this.spot = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.spot.rotation.x = -Math.PI / 2;
    this.spot.position.copy(O).add(v3(0, 0.15, 0));
    this.spot.scale.setScalar(2.6);
    this.voidG.add(planet, atmo, this.planetRing, this.spot, this.sunV.group, this.flashDot.mesh);

    // --- forge: accretion disk, rock chunks, gas, lightning ---
    this.diskMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }, uBody: { value: new THREE.Color() }, uHot: { value: new THREE.Color() },
        uDark: { value: new THREE.Color(0x030308) }, uOpacity: { value: 0 },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity; uniform vec3 uBody, uHot, uDark; varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float rn = (r - 0.6) / 0.4;
          if (rn < 0.0 || rn > 1.0) discard;
          float ang = atan(p.y, p.x);
          float b = rn * 6.0 + uTime * 1.2 + ang * 3.0 / 6.2831853;
          float f = fract(b);
          if (f < 0.07) discard;
          float m = mod(floor(b), 3.0);
          vec3 col = m < 0.5 ? uBody : (m < 1.5 ? uDark : uHot * 0.85);
          float a = (m < 1.5 && m > 0.5 ? 0.9 : 0.85) * smoothstep(1.0, 0.88, rn) * smoothstep(0.0, 0.07, rn);
          gl_FragColor = vec4(col, a * uOpacity);
        }`,
    });
    const disk = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 128, 1), this.diskMat);
    disk.frustumCulled = false;
    this.diskG.add(disk);
    this.diskG.rotation.set(-1.15, 0, 0.25);
    this.diskG.visible = false;
    this.voidG.add(this.diskG);

    this.debrisMat = new THREE.ShaderMaterial({
      uniforms: { uStar: { value: v3() }, uTint: { value: new THREE.Color() }, uI: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vCol; varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vCol = instanceColor;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uStar, uTint; uniform float uI; varying vec3 vN; varying vec3 vCol; varying vec3 vW;
        void main() {
          vec3 L = normalize(uStar - vW);
          float d = max(dot(normalize(vN), L), 0.0);
          d = floor(d * 3.0 + 0.5) / 3.0;
          gl_FragColor = vec4(min(vCol * (0.22 + 0.6 * d) + uTint * d * uI * 0.35, vec3(0.78)), 1.0);
        }`,
    });
    this.debris = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), this.debrisMat, CHUNKS);
    this.debris.frustumCulled = false;
    const rock = [0x4a4458, 0x3a3a48, 0x5a4a40, 0x44505a];
    for (let i = 0; i < CHUNKS; i++) {
      this.debris.setColorAt(i, this.tmpC.setHex(rock[i % rock.length]).multiplyScalar(0.8 + Math.random() * 0.4));
      this.tmpM.makeScale(1e-4, 1e-4, 1e-4);
      this.debris.setMatrixAt(i, this.tmpM);
    }
    this.debris.visible = false;
    this.gasGeo.setAttribute('position', new THREE.BufferAttribute(this.gasPos, 3));
    this.gas = new THREE.Points(this.gasGeo, this.gasMat);
    this.gas.frustumCulled = false;
    this.voidG.add(this.debris, this.gas);
    for (let i = 0; i < 4; i++) {
      const arc = new LightningArc({ width: 0.5, segments: 12, jitter: 0.1, branches: 2, core: 0xffffff, glow: 0x3ad8c8 });
      this.bolts.push(arc);
      this.voidG.add(arc.mesh);
    }

    // --- emitters (rate 0, burst by hand; about 5k particles in total) ---
    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      return e;
    };
    this.motesRise = em({
      maxParticles: 400, lifetime: 2.2, lifetimeJitter: 0.4, shapeSize: 0.3, speed: 2.2, speedJitter: 0.5, spread: 25, gravity: -0.6, drag: 0.4,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#fff4d6', colorEnd: '#ff7a2a', colorMid: '#ffe08a', opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.3,
    });
    this.motesFall = em({
      maxParticles: 320, lifetime: 5, lifetimeJitter: 0.3, shapeSize: 0.2, speed: 0.25, speedJitter: 0.8, spread: 180, gravity: 0.25, drag: 0.5,
      sizeStart: 0.13, sizeEnd: 0.03, colorStart: '#ffe08a', colorEnd: '#ff7a2a', opacityStart: 0.7, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    this.plasma = em({
      maxParticles: 1000, lifetime: 0.9, lifetimeJitter: 0.4, shapeSize: 0.5, speed: 1.2, speedJitter: 0.8, spread: 180, gravity: 0, drag: 1.2,
      sizeStart: 1.6, sizeEnd: 0.2, colorStart: '#ffe08a', colorEnd: '#7a2a08', colorMid: '#ff7a2a', opacityStart: 0.5, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, spin: 0.6,
    });
    this.trailSmoke = em({
      maxParticles: 400, lifetime: 1.4, lifetimeJitter: 0.4, shapeSize: 0.6, speed: 1, speedJitter: 0.8, spread: 180, gravity: 0, drag: 1,
      sizeStart: 1.5, sizeEnd: 0.5, colorStart: '#1a1218', colorEnd: '#07050a', opacityStart: 0.8, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.45, spin: 0.5,
    });
    this.sparks = em({
      maxParticles: 900, lifetime: 0.9, lifetimeJitter: 0.5, shapeSize: 0.5, speed: 14, speedJitter: 0.6, spread: 85, gravity: 9, drag: 1.1,
      sizeStart: 0.16, sizeEnd: 0.02, colorStart: '#ffe08a', colorEnd: '#ff7a2a', opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.embers = em({
      maxParticles: 400, lifetime: 3, lifetimeJitter: 0.4, shapeSize: 0.4, speed: 0.9, speedJitter: 0.7, spread: 50, gravity: -0.4, drag: 0.6,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffe08a', colorEnd: '#7a2a08', colorMid: '#ff7a2a', opacityStart: 0.75, opacityEnd: 0, additive: true, sizeJitter: 0.4, groundFade: 0.15,
    });
    this.dust = em({
      maxParticles: 500, lifetime: 3.2, lifetimeJitter: 0.4, shapeSize: 3, speed: 9, speedJitter: 0.6, spread: 80, gravity: -0.1, drag: 1.4,
      sizeStart: 2, sizeEnd: 5, colorStart: '#5a4a42', colorEnd: '#2a2220', opacityStart: 0.4, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4, groundFade: 0.4,
    });
    this.emitters.push(this.motesRise, this.motesFall, this.plasma, this.trailSmoke, this.sparks, this.embers, this.dust, this.smoke.emitter);
    this.group.add(this.smoke.mesh, this.shockRefract.mesh, this.craterHaze.mesh);

    // Streak quads for the transition smear (positioned in front of the camera every frame).
    for (let i = 0; i < STREAKS; i++) {
      const m = new THREE.Mesh(this.streakGeo, this.streakMats[i % 3 === 0 ? 1 : 0]);
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 999;
      this.streaks.push(m);
      this.group.add(m);
    }
    this.clouds = new QuadField(CLOUDS, cloudTexture(), 0x6a7488, new THREE.PlaneGeometry(1, 1));
    this.walls = new QuadField(WALLS, cloudTexture(), 0x5a4a42, new THREE.PlaneGeometry(1, 1));
    this.groundG.add(this.clouds.group, this.walls.group);
    this.reset();
  }

  /** Arena-side pieces built once. */
  private buildGround() {
    for (let i = 0; i < 4; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 1.8 + 0.3 * (i % 3), width: 0.9, style: 'soft', edge: 0xfff0c8, mid: 0xffe08a, outer: 0x7a4a10 });
      plane.add(arc.mesh);
      this.windPlanes.push(plane);
      this.wind.push(arc);
      this.groundG.add(plane);
    }
    for (let i = 0; i < MAX_TARGETS; i++) {
      const s = new StarBurst({ points: 8, inner: 0.2, color: 0xffe08a, core: 0xff7a2a, additive: false });
      this.hitStars.push(s);
      this.groundG.add(s.mesh);
    }
    this.groundG.add(
      this.pillar.mesh, this.liftRing.mesh, this.sunA.group, this.shockRing.mesh, this.shockRing2.mesh,
      this.shockDome.mesh, this.impactStar.mesh,
    );
  }

  get duration() {
    return this.settings.duration;
  }

  private get k() {
    return this.settings.duration / BASE_DURATION;
  }

  get impactTime() {
    return U.hit * this.k;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.P.copy(ctx.from).setY(0);
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    this.C.set(0, 0, 0);
    for (const p of pts) this.C.add(p);
    this.C.divideScalar(pts.length).setY(0);
    this.fwd.copy(this.C).sub(this.P).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    this.aim = ctx.aim;
    this.targetSil = ctx.targets.map((e) => e.group);
    this.screen.silhouettes = this.targetSil;
    for (let i = 0; i < this.windPlanes.length; i++) {
      const plane = this.windPlanes[i];
      plane.position.copy(this.P).setY(1.3);
      plane.rotation.set(Math.PI / 2 + (i - 1.5) * 0.4, (i * Math.PI) / 2, 0);
    }
    this.crater.position.copy(this.C).setY(0.03);
    this.crater.scale.setScalar(24);
    this.buildKeys();
  }

  /** Height of the stand-in over the arena, script time. */
  private figY(u: number) {
    return HEIGHT * Math.pow(clamp((u - 6.4) / 7.8, 0, 1), 2.1);
  }

  /** The star's centre while it forms above the caster in orbit. */
  private starR(u: number) {
    return ramp(u, [[22, 0.15], [24, 0.9], [27, 2.2], [31.5, 5], [34.6, 9.5], [36, 12], [99, 12]]);
  }

  private starFormPos(u: number, out: THREE.Vector3) {
    return out.copy(FZ).add(this.tmpV2.set(0, 3.4 + this.starR(Math.min(u, 36)) * 1.05, 0));
  }

  /** The falling star in orbit (36.6 - 38.6). */
  private starFallPos(u: number, out: THREE.Vector3) {
    const p = clamp((u - U.throw) / (U.ground - U.throw), 0, 1);
    const y0 = 90 + 3.4 + 12 * 1.05, y1 = 12.5;
    return out.set(O.x, O.y + lerp(y0, y1, Math.pow(p, 2.3)), O.z);
  }

  /** The falling star in the arena sky (38.6 - 42). */
  private starSkyPos(u: number, out: THREE.Vector3) {
    const p = clamp((u - U.ground) / (U.hit - U.ground), 0, 1);
    const s = Math.pow(p, 1.9);
    const sx = this.C.x - this.fwd.x * 70 + this.right.x * 30, sz = this.C.z - this.fwd.z * 70 + this.right.z * 30;
    return out.set(lerp(sx, this.C.x, s), lerp(240, 5, s), lerp(sz, this.C.z, s));
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    const P = this.P, C = this.C, f = this.fwd, r = this.right;
    const add = (t: number, pos: THREE.Vector3, target: THREE.Vector3, fov: number, o: { roll?: number; cut?: boolean; ease?: ShotKey['ease'] } = {}) =>
      keys.push({ t, position: pos, target, fov, roll: o.roll ?? 0, cut: o.cut, ease: o.ease });
    /** base + f*fw + r*rt + (0, y, 0) */
    const pf = (base: THREE.Vector3, fw: number, rt: number, y: number) =>
      base.clone().addScaledVector(f, fw).addScaledVector(r, rt).add(v3(0, y, 0));
    const up = (base: THREE.Vector3, x: number, y: number, z: number) => base.clone().add(v3(x, y, z));
    const tmp = v3();

    // 1. Resolve: low close-up on the caster (held, slow push-in), cut to a wide.
    add(0, pf(P, 5.2, 1.0, 0.6), up(P, 0, 1.9, 0), 32);
    add(3.4 - 0.001, pf(P, 4.4, 0.8, 0.7), up(P, 0, 2.0, 0), 32, { ease: 'linear' });
    add(3.4, pf(P, -7, 5, 3.2), pf(P, 9, 0, 1.6), 56, { cut: true });
    add(U.rise - 0.001, pf(P, -6, 4.2, 2.4), pf(P, 9, 0, 1.6), 56, { ease: 'linear' });

    // 2. Ascension: follow from below, then cut to a high shot looking down.
    for (let t = U.rise; t <= U.riseCut + 1e-6; t += 0.5) {
      const y = this.figY(t);
      add(t, pf(P, 5, 3.5, Math.max(0.7, y * 0.9 - 4.8)), up(P, 0, y + 1.6, 0), 52, { roll: 0.1 * ss(6, 8, t), cut: t === U.rise, ease: 'linear' });
    }
    for (let t = U.riseCut; t <= U.orbit - 0.2 + 1e-6; t += 0.4) {
      const y = this.figY(t);
      add(t, pf(P, -3, 10, Math.max(1, y - 4)), up(P, 0, y - 0.5, 0), 60, { roll: -0.06, cut: t === U.riseCut, ease: 'linear' });
    }

    // 3. Orbit: wide with a slow push-in, then a medium.
    add(U.orbit, up(FZ, 45, 40, 30), up(FZ, 0, -12, 0), 58, { cut: true });
    add(U.orbit2 - 0.001, up(FZ, 40, 36, 27), up(FZ, 0, -11, 0), 58, { ease: 'linear' });
    add(U.orbit2, up(FZ, 14, 3, 18), up(FZ, 0, 1.5, 0), 38, { cut: true });
    add(U.forge - 0.001, up(FZ, 11, 2.5, 14), up(FZ, 0, 1.8, 0), 38, { ease: 'linear' });

    // 4. Forge: close and wide alternate every 2-4 s.
    add(U.forge, up(FZ, -62, 18, 48), up(FZ, 0, 6, 0), 50, { cut: true });
    add(25 - 0.001, up(FZ, -56, 19, 44), up(FZ, 0, 6, 0), 50, { ease: 'linear' });
    add(25, up(FZ, 4, -3.5, 7), up(FZ, 0, 4, 0), 34, { cut: true });
    add(27.2 - 0.001, up(FZ, 3.4, -3.2, 6.2), up(FZ, 0, 4.2, 0), 34, { ease: 'linear' });
    add(27.2, up(FZ, 58, 30, 30), up(FZ, 0, 7, 0), 50, { cut: true });
    add(30.2 - 0.001, up(FZ, 54, 30, 28), up(FZ, 0, 7, 0), 50, { ease: 'linear' });
    add(30.2, up(FZ, 16, 13, 22), up(FZ, 0, 8.5, 0), 40, { cut: true });
    add(32.4 - 0.001, up(FZ, 13, 12, 18), up(FZ, 0, 9, 0), 40, { ease: 'linear' });
    add(32.4, up(FZ, 40, 25, 60), up(FZ, 0, 12, 0), 50, { cut: true });
    add(34.6 - 0.001, up(FZ, 70, 38, 105), up(FZ, 0, 12, 0), 50, { ease: 'out' });
    add(34.6, up(FZ, 20, -16, 26), up(FZ, 0, 14, 0), 60, { cut: true });
    add(U.dead, up(FZ, 19.5, -15.6, 25.4), up(FZ, 0, 14, 0), 60, { ease: 'linear' });
    add(U.throw - 0.001, up(FZ, 19.5, -15.6, 25.4), up(FZ, 0, 14, 0), 60);

    // 5. Throw: behind the falling star, the camera falls with it.
    for (let t = U.throw; t <= U.ground - 0.2 + 1e-6; t += 0.2) {
      this.starFallPos(t, tmp);
      add(t, tmp.clone().add(v3(6, 20, 24)), tmp.clone().add(v3(0, -30, 0)), 55, { roll: 0.05, cut: t === U.throw, ease: 'linear' });
    }

    // 6. The arena sky: ground level, the star grows and falls onto the enemies.
    const camG = C.clone().addScaledVector(r, 22).addScaledVector(f, -12).setY(1.6);
    for (let t = U.ground; t <= U.hit + 1e-6; t += 0.2) {
      this.starSkyPos(t, tmp);
      const look = tmp.clone().lerp(C.clone().setY(3), 0.35);
      add(t, camG.clone(), look, lerp(44, 36, ss(U.ground, U.hit, t)), { cut: t === U.ground, ease: 'linear' });
    }
    add(U.orbitHit - 0.001, camG.clone(), C.clone().setY(4), 36, { ease: 'linear' });

    // 7. Impact seen from orbit, then ground level for the dust, then the calm aftermath.
    add(U.orbitHit, up(O, 88, 50, 105), up(O, 0, -4, 0), 52, { cut: true });
    add(U.dust - 0.001, up(O, 80, 45, 95), up(O, 0, -4, 0), 52, { ease: 'linear' });
    add(U.dust, C.clone().addScaledVector(r, 16).addScaledVector(f, -20).setY(0.8), C.clone().setY(4), 50, { cut: true });
    add(U.after - 0.001, C.clone().addScaledVector(r, 13).addScaledVector(f, -17).setY(1.0), C.clone().setY(4), 50, { ease: 'linear' });
    add(U.after, pf(P, -13, 11, 6.5), pf(C, 0, 0, 1.5), 46, { cut: true });
    add(U.med - 0.001, pf(P, -11, 9, 5.8), pf(C, 0, 0, 1.5), 46, { ease: 'linear' });
    add(U.med, pf(P, -9, 7, 3.5), pf(P, 4, 0, 1.4), 44, { cut: true });
    add(U.end, pf(P, -8, 6.2, 3.3), pf(P, 4.5, 0, 1.4), 44, { ease: 'linear' });
    this.keys = keys;
  }

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout(0);
  }

  private reset() {
    this.time = 0;
    this.orb = 0;
    this.hitDone = false;
    this.smokeDone = false;
    this.lastPick = -1;
    this.boltClock = 0;
    this.shake = 0;
    this.restoreCaster();
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  private restoreCaster() {
    if (this.casterHidden && this.ctx) this.ctx.caster.group.visible = true;
    this.casterHidden = false;
  }

  /** End of the timeline: everything back to neutral and hidden. */
  private finish() {
    this.playing = false;
    this.restoreCaster();
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.shake = 0;
    this.time = 0;
    this.orb = 0;
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.finish();
      return;
    }
    const u = this.time / this.k;
    const dead = u >= U.dead && u < U.throw;
    if (!dead) this.orb += dt / this.k;
    for (const a of this.bolts) a.update(dt);
    if (!this.hitDone && this.time >= this.impactTime) this.onHit();
    if (!this.smokeDone && this.time >= this.impactTime + 0.3) this.onSmoke();
    this.layout(dt);
  }

  // --- Layout -------------------------------------------------------------------------------------------

  private stage(u: number) {
    const a = ss(U.st2 - 0.15, U.st2 + 0.15, u), b = ss(U.st3 - 0.15, U.st3 + 0.15, u);
    const s = this.stageNow;
    for (const key of ['core', 'hot', 'body', 'dark'] as const) {
      s[key].copy(STAGES[0][key]).lerp(STAGES[1][key], a).lerp(STAGES[2][key], b);
    }
    return s;
  }

  private layout(dt: number) {
    const k = this.k;
    const t = this.time;
    const u = t / k;
    const live = this.playing && dt >= 0;
    const cin = this.cinematic;
    sampleShots(this.keys, u, cin);
    cin.letterbox = ss(0, 1.2, u) * (1 - ss(U.end - 1.6, U.end, u));
    // Camera helper: the exact orientation main.ts will render with, used by every billboard.
    this.camHelp.position.copy(cin.position);
    this.camHelp.lookAt(cin.target);
    this.camHelp.rotateZ(cin.roll);
    this.camHelp.getWorldDirection(this.camForward);
    const camQ = this.camHelp.quaternion;

    const inVoid = (u >= U.orbit && u < U.ground) || (u >= U.orbitHit && u < U.dust);
    this.voidG.visible = inVoid || u >= U.smear - 0.4 && u < U.orbit;
    this.groundG.visible = !inVoid;
    const stage = this.stage(u);
    const dead = u >= U.dead && u < U.throw;
    const P = this.P;
    const after = t - this.impactTime;

    // ---- domes follow the camera; sky colours per act ----
    this.sky.position.copy(cin.position);
    this.starDome.position.copy(cin.position);
    this.layoutSky(u, inVoid);

    // ---- real caster: hidden while the stand-in is away, restored for the aftermath ----
    if (this.ctx && live) {
      const away = u >= U.rise && u < U.after;
      if (away) { this.ctx.caster.group.visible = false; this.casterHidden = true; }
      else if (this.casterHidden) this.restoreCaster();
    }

    // ---- Act 1: resolve (wind crescents, gold motes) ----
    const windOp = 0.8 * ss(0.3, 1.2, u) * (1 - ss(U.rise - 1, U.rise, u));
    this.wind.forEach((arc, i) => {
      arc.head = (((u * 1.2 + i * 0.23) % 1) * 1.35);
      arc.length = 0.38;
      arc.time = t;
      arc.erosion = 0.2;
      arc.opacity = windOp;
    });
    if (live && dt > 0 && u > 0.4 && u < U.rise + 1) {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2, rad = 0.5 + Math.random() * 1.3;
        this.motesRise.burst(1, this.tmpV.set(P.x + Math.cos(a) * rad, 0.2, P.z + Math.sin(a) * rad));
      }
    }

    // ---- Act 2: ascension (stand-in, column of light, clouds) ----
    const figY = this.figY(u);
    const riseOn = u >= U.rise && u < U.orbit;
    this.pillar.set(P.x, P.z, 0, Math.max(1, figY - 0.5), riseOn ? 0.4 * ss(U.rise, U.rise + 0.8, u) * (1 - ss(13, U.orbit, u)) : 0);
    this.liftRing.mesh.position.set(P.x, 0.06, P.z);
    this.liftRing.mesh.scale.setScalar(1 + 6 * ss(U.rise, U.rise + 1.5, u));
    this.liftRing.material.opacity = u >= U.rise && u < U.rise + 1.6 ? 0.7 * (1 - ss(U.rise, U.rise + 1.6, u)) : 0;
    const cloudOn = u >= 7.5 && u < U.orbit;
    this.clouds.opacity = 0.6 * ss(7.5, 9, u) * (1 - ss(13.2, U.orbit, u));
    if (cloudOn) {
      for (let i = 0; i < CLOUDS; i++) {
        const c = this.cloudSeed[i];
        this.tmpV.set(P.x + Math.cos(c.a + u * 0.05) * c.d, c.y, P.z + Math.sin(c.a + u * 0.05) * c.d);
        this.clouds.place(i, this.tmpV, c.s, c.s * 0.55, c.r, camQ);
      }
    } else this.clouds.hideAll();

    // Stand-in figure: arena rise, then floating in orbit.
    const bob = Math.sin(this.orb * 0.8) * 0.4;
    const hero = this.hero;
    let heroLight = 0;
    if (u >= U.rise && u < U.orbit) {
      hero.group.visible = true;
      hero.group.position.set(P.x, figY, P.z);
      hero.group.rotation.set(0, this.aim, 0);
      hero.group.scale.setScalar(1);
      hero.pose(0, 0);
      heroLight = 0.5;
      hero.faceHalo(camQ, this.camForward, 0.7 * ss(U.rise, U.rise + 1, u), 2.4);
    } else if (u >= U.orbit && u < U.ground) {
      hero.group.visible = true;
      hero.group.position.set(FZ.x, FZ.y + bob, FZ.z);
      hero.group.rotation.set(0, 0, 0);
      hero.group.scale.setScalar(1.8);
      const raise = ss(21, 23, u), thrust = ss(U.throw - 0.15, U.throw, u);
      hero.pose(raise, thrust);
      heroLight = ss(22, 35, u);
      hero.faceHalo(camQ, this.camForward, 0.75, 2.8);
    } else hero.group.visible = false;
    hero.light(stage.body, heroLight);

    // ---- Act 3-5: the void (planet, forge, throw) ----
    this.layoutVoid(u, dt, live, stage, dead, camQ);

    // ---- Act 5-7: arena sky, impact, aftermath ----
    this.layoutGround(u, t, dt, live, after, camQ);

    // ---- Transition smear 13.9 - 14.5 ----
    this.layoutSmear(u, camQ);

    // ---- Screen ----
    this.layoutScreen(u, t, stage, after);
  }

  private layoutSky(u: number, inVoid: boolean) {
    const m = this.skyMat.uniforms;
    const top = m.uTop.value as THREE.Color, hor = m.uHor.value as THREE.Color;
    let opacity = 0;
    if (inVoid || (u >= U.smear - 0.4 && u < U.orbit)) {
      top.setHex(0x030308); hor.setHex(0x030308); opacity = 1;
    } else if (u < U.orbit) {
      // Dusk darkening into the night of high altitude.
      const k = ss(0, 12, u);
      top.setHex(0x2a3a5a).lerp(this.tmpC.setHex(0x030308), k);
      hor.setHex(0x1a2440).lerp(this.tmpC.setHex(0x030308), k);
      opacity = ramp(u, [[0, 0], [5, 0.85], [9, 0.95], [11, 1]]);
    } else if (u >= U.ground && u < U.orbitHit) {
      // The falling star turns the sky orange; the impact blows it out.
      const k = ss(U.ground, U.hit - 0.4, u);
      top.setHex(0x1a0a1c).lerp(this.tmpC.setHex(0x3a1018), k);
      hor.setHex(0x1a0a14).lerp(this.tmpC.setHex(0xc85a20), k);
      opacity = ss(U.ground, U.ground + 1.2, u) * 0.92;
    } else if (u >= U.dust) {
      // Ember dusk that clears by the end.
      top.setHex(0x1a0e1c); hor.setHex(0x8a3a1a);
      opacity = 0.85 * (1 - ss(U.after, U.end - 1.2, u));
    }
    m.uOpacity.value = opacity;
    this.sky.visible = opacity > 0.003;
    const stars = inVoid || (u >= U.smear - 0.4 && u < U.orbit) ? 1 : u < U.orbit ? ss(10.5, 13.6, u) : 0;
    this.starMat.opacity = stars;
    this.starDome.visible = stars > 0.003;
  }

  private layoutVoid(u: number, dt: number, live: boolean, stage: { core: THREE.Color; hot: THREE.Color; body: THREE.Color; dark: THREE.Color }, dead: boolean, camQ: THREE.Quaternion) {
    const orb = this.orb;
    const vis = this.voidG.visible;
    const sun = this.sunV;
    const starPos = this.tmpV;
    // Star centre and radius for this moment.
    let rS = 0;
    let falling = false;
    if (u >= 22 && u < U.throw) { this.starFormPos(u, starPos); rS = this.starR(u); }
    else if (u >= U.throw && u < U.ground) { this.starFallPos(u, starPos); rS = 12; falling = true; }
    else starPos.copy(FZ);
    const starCenter = starPos.clone();
    const starI = falling ? 1 : ss(22, 36, u);

    // Planet uniforms.
    this.planetMat.uniforms.uStarPos.value.copy(rS > 0 ? starCenter : v3(0, 1e5, 0));
    this.planetMat.uniforms.uStarI.value = rS > 0 ? starI : 0;
    this.planetMat.uniforms.uTime.value = orb;
    const hitD = u - U.orbitHit;
    let flare = falling ? ss(0, 1, 1 - (starCenter.y - O.y - 12) / 55) : 0;
    if (u >= U.orbitHit) flare = Math.exp(-Math.max(0, hitD) * 0.7);
    this.atmoMat.uniforms.uFlareAmt.value = flare;
    this.atmoMat.uniforms.uOpacity.value = 0.45 + 0.45 * flare;
    this.spot.visible = vis && u < U.orbitHit;
    this.spot.scale.setScalar(2.6 * (1 + 0.15 * Math.sin(orb * 3)));

    // The star: forms in three colour stages, falls with a plasma trail.
    sun.setPalette(stage);
    if (vis && rS > 0.01) sun.set(starCenter, rS, orb, falling ? 3.2 : 2.6 + 0.5 * Math.sin(orb * 2), orb * 0.6);
    else sun.hide();
    this.debrisMat.uniforms.uStar.value.copy(starCenter);
    this.debrisMat.uniforms.uTint.value.copy(stage.body);
    this.debrisMat.uniforms.uI.value = starI;
    this.diskMat.uniforms.uTime.value = orb;
    this.diskMat.uniforms.uBody.value.copy(stage.body);
    this.diskMat.uniforms.uHot.value.copy(stage.hot);
    this.gasMat.color.copy(stage.body);

    // Accretion disk, chunks, gas.
    const forgeOn = vis && u >= 21.8 && u < U.ground;
    const diskOp = ss(22.4, 24, u) * (1 - ss(U.throw, U.throw + 0.8, u));
    this.diskG.visible = forgeOn && diskOp > 0.01;
    this.diskG.position.copy(starCenter);
    this.diskG.scale.setScalar(Math.max(1e-3, rS * 2.1 + 2.5));
    this.diskG.children[0].rotation.z = orb * 0.6;
    this.diskMat.uniforms.uOpacity.value = diskOp;
    this.debris.visible = forgeOn;
    this.gas.visible = forgeOn;
    this.gasMat.opacity = 0.55 * ss(22.4, 24, u) * (1 - ss(U.throw, U.throw + 1, u));
    if (forgeOn) this.layoutDebris(u, orb, starCenter, rS);

    // Lightning between chunks and the star (silent in the dead beat).
    const bolt = forgeOn && !dead && u >= 23 && u < U.throw ? ss(23, 24, u) : 0;
    this.boltClock += live ? dt : 0;
    const pickIdx = Math.floor(this.boltClock / 0.18);
    if (pickIdx !== this.lastPick) {
      this.lastPick = pickIdx;
      for (const p of this.boltPick) { p.a = Math.floor(Math.random() * CHUNKS); p.b = Math.floor(Math.random() * CHUNKS); }
    }
    this.bolts.forEach((arc, i) => {
      const p = this.boltPick[i];
      const ok = bolt > 0 && this.chunkOn[p.a] && this.chunkOn[p.b];
      arc.opacity = ok ? 0.85 * bolt : 0;
      if (ok) {
        arc.glowColor.copy(stage.body);
        if (i < 2) {
          this.tmpV2.copy(this.chunkPos[p.a]).sub(starCenter).normalize().multiplyScalar(rS * 0.95).add(starCenter);
          arc.setEnds(this.tmpV2, this.chunkPos[p.a]);
        } else arc.setEnds(this.chunkPos[p.a], this.chunkPos[p.b]);
      }
    });

    // Plasma trail while the star falls (planet entry), dark smoke kept small.
    if (live && dt > 0 && falling) {
      const near = starCenter.y - O.y < 60;
      for (let i = 0; i < (near ? 40 : 18); i++) {
        this.plasma.burst(1, this.tmpV2.set(
          starCenter.x + (Math.random() - 0.5) * 16, starCenter.y + 5 + Math.random() * 7, starCenter.z + (Math.random() - 0.5) * 16));
      }
      this.trailSmoke.burst(4, this.tmpV2.set(starCenter.x + (Math.random() - 0.5) * 10, starCenter.y + 9, starCenter.z + (Math.random() - 0.5) * 10));
    }

    // Impact seen from orbit: flash dot, then a ring of light across the surface.
    const hd = u - U.orbitHit;
    const ringOn = vis && hd >= 0 && hd < 3.6;
    this.planetRing.visible = ringOn;
    this.planetRingMat.uniforms.uAng.value = hd * 0.28;
    this.planetRingMat.uniforms.uW.value = 0.03 + hd * 0.02;
    this.planetRingMat.uniforms.uOp.value = ringOn ? 1 - ss(2.4, 3.6, hd) : 0;
    this.planetRingMat.uniforms.uScorch.value = ringOn ? 1 : 0;
    const dot = StarBurst.pop(hd * this.k * 0.8, 0.5, 0.7);
    this.flashDot.set(this.tmpV2.copy(O).add(v3(0, 0.6, 0)), 30 * dot.scale, vis && hd >= 0 ? dot.opacity : 0, hd * 0.5);

    // Shake: rumble that grows with the star, hard in the fall.
    if (!this.hitDone && u >= 22 && u < U.dead) this.shake = 0.03 + 0.1 * ss(22, 36, u);
    else if (dead) this.shake = 0;
    else if (falling) this.shake = 0.18;
    else if (!this.hitDone && u >= U.ground) this.shake = 0.05 + 0.25 * ss(U.ground, U.hit, u);
    else this.shake = Math.max(this.shake * 0.9, 0);
    void camQ;
  }

  private layoutDebris(u: number, orb: number, center: THREE.Vector3, rS: number) {
    const uc = Math.min(u, U.dead);
    const infall = ss(22.5, 36, uc);
    const vanish = 1 - ss(U.throw + 0.1, U.throw + 1.0, u);
    for (let i = 0; i < CHUNKS; i++) {
      const c = this.chunks[i];
      const rr = c.r0 * (1 - 0.62 * infall);
      const th = c.ph + orb * (14 / (rr + 6));
      const local = this.tmpV2.set(Math.cos(th) * rr, c.y, Math.sin(th) * rr).applyQuaternion(this.planeQ[c.plane]);
      const appear = ss(21.8 + c.delay, 22.6 + c.delay, u);
      const swallow = clamp((rr - (rS + 1)) / 3, 0, 1);
      const s = Math.max(1e-4, c.s * appear * swallow * vanish);
      this.chunkOn[i] = s > 0.05;
      this.chunkPos[i].copy(center).add(local);
      this.tmpQ.setFromAxisAngle(c.ax, orb * c.spin);
      this.tmpM.compose(this.chunkPos[i], this.tmpQ, this.tmpS.set(s, Math.max(1e-4, s * 0.7), Math.max(1e-4, s * 0.9)));
      this.debris.setMatrixAt(i, this.tmpM);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < GAS; i++) {
      const g = this.gasSeed[i];
      const rr = g.r0 * (1 - 0.6 * infall) + rS * 0.6;
      const th = g.ph + orb * (18 / (rr + 6));
      const local = this.tmpV2.set(Math.cos(th) * rr, g.y, Math.sin(th) * rr).applyQuaternion(this.planeQ[g.plane]);
      this.gasPos[i * 3] = center.x + local.x;
      this.gasPos[i * 3 + 1] = center.y + local.y;
      this.gasPos[i * 3 + 2] = center.z + local.z;
    }
    this.gasGeo.attributes.position.needsUpdate = true;
  }

  private layoutGround(u: number, t: number, dt: number, live: boolean, after: number, camQ: THREE.Quaternion) {
    const C = this.C, P = this.P;
    const skyOn = u >= U.ground && u < U.orbitHit;
    // The falling star in the arena sky: grows, trails plasma, expands as it lands, then is gone in the whiteout.
    const lateral = this.tmpV;
    if (skyOn && after < 0.35) {
      this.starSkyPos(Math.min(u, U.hit), lateral);
      const boom = after > 0 ? 1 + 0.9 * Math.min(1, after / 0.25) : 1;
      this.sunA.setPalette(STAGES[2]);
      this.sunA.set(lateral, R_STAR_A * boom, this.orb + u, 3 + 2 * Math.max(0, after) * 4, u);
      if (live && dt > 0 && after < 0) {
        for (let i = 0; i < 16; i++) {
          this.plasma.burst(1, this.tmpV2.set(lateral.x + (Math.random() - 0.5) * 12, lateral.y + 3 + Math.random() * 6, lateral.z + (Math.random() - 0.5) * 12));
        }
        this.trailSmoke.burst(2, this.tmpV2.set(lateral.x, lateral.y + 7, lateral.z));
      }
    } else this.sunA.hide();

    // Impact: ground rings, shock dome, big star pop, per-target glints.
    const hit = this.hitDone && after >= 0;
    const a = Math.max(0, after);
    this.shockRing.mesh.position.set(C.x, 0.05, C.z);
    this.shockRing.mesh.scale.setScalar(1 + a * 34);
    this.shockRing.material.opacity = hit ? Math.max(0, 0.8 * (1 - a / 1.3)) : 0;
    const a2 = a - 0.15;
    this.shockRing2.mesh.position.set(C.x, 0.06, C.z);
    this.shockRing2.mesh.scale.setScalar(1 + Math.max(0, a2) * 22);
    this.shockRing2.material.opacity = hit && a2 > 0 ? Math.max(0, 0.6 * (1 - a2 / 1.6)) : 0;
    // Refraction ring with the gold ring (0.6 s), then a slow heat shimmer over the cooling crater.
    const rp = clamp(a / 0.6, 0, 1);
    this.shockRefract.set(this.tmpV2.set(C.x, 0, C.z), 1 + a * 34, hit && rp < 1 ? 0.05 * (1 - rp) * (1 - rp) : 0);
    this.craterHaze.set(this.tmpV2.set(C.x, 0, C.z), hit && u < U.end ? 0.012 * ss(0, 0.8, a) * Math.exp(-a / 8) * (1 - ss(U.end - 3, U.end - 0.4, u)) : 0, t, 2.2);
    this.shockDome.mesh.position.set(C.x, 0, C.z);
    this.shockDome.mesh.scale.setScalar(Math.max(1e-3, 3 + a * 28));
    this.shockDome.opacity = hit ? 0.35 * Math.exp(-a * 2.6) : 0;
    const pop = StarBurst.pop(after - 0.02, 0.12, 0.3);
    this.impactStar.set(this.tmpV2.set(C.x, 5, C.z), 26 * pop.scale, hit ? pop.opacity : 0, 0.2);
    this.hitStars.forEach((s, i) => {
      const p = this.ctx?.targetPos[i];
      const g = StarBurst.pop(after - 0.05 - i * 0.015, 0.1, 0.25);
      if (!p || !hit || g.opacity === 0) { s.set(this.tmpV2.set(0, -50, 0), 0, 0, 0); return; }
      s.set(this.tmpV2.set(p.x, 1.4, p.z), 3.2 * g.scale, g.opacity, i * 0.7);
    });

    // Dust walls rush outward from the impact and past the camera.
    const wallOn = hit && after < 4.2;
    if (wallOn) {
      const R = 40 * (1 - Math.exp(-1.6 * a));
      this.walls.opacity = 0.65 * ss(0, 0.15, a) * (1 - ss(1.8, 4.2, a));
      for (let i = 0; i < WALLS; i++) {
        const w = this.wallSeed[i];
        this.walls.place(i, this.tmpV2.set(C.x + Math.cos(w.a) * R, 2.5 + w.h * 0.3 + w.y + a * 0.5, C.z + Math.sin(w.a) * R), 12, w.h, w.r, camQ);
      }
    } else this.walls.hideAll();

    // Scorched crater with glowing cracks that cool.
    const craterOn = this.hitDone && u < U.end;
    this.crater.visible = craterOn;
    this.craterMat.uniforms.uOp.value = craterOn ? ss(0, 0.2, a) * (1 - ss(U.end - 3, U.end - 0.4, u)) : 0;
    this.craterMat.uniforms.uHeat.value = 0.15 + 0.85 * Math.exp(-a / 8);
    if (live && dt > 0 && this.hitDone && u > U.hit + 0.5 && u < U.end - 4) {
      for (let i = 0; i < 2; i++) {
        const ang = Math.random() * Math.PI * 2, rad = Math.random() * 8;
        this.embers.burst(1, this.tmpV2.set(C.x + Math.cos(ang) * rad, 0.1, C.z + Math.sin(ang) * rad));
      }
    }
    // Aftermath: the caster is back, motes drift down.
    if (live && dt > 0 && u >= U.after && u < U.end - 1.5) {
      this.motesFall.burst(1, this.tmpV2.set(P.x + (Math.random() - 0.5) * 4, 5 + Math.random() * 2, P.z + (Math.random() - 0.5) * 4));
    }
    void t;
  }

  private layoutSmear(u: number, camQ: THREE.Quaternion) {
    const s = (u - U.smear) / 0.6;
    const on = s > 0 && s < 1;
    const fade = on ? Math.sin(Math.PI * s) : 0;
    this.streakMats[0].opacity = 0.9 * fade;
    this.streakMats[1].opacity = 0.8 * fade;
    const ang = 0.5; // diagonal
    this.streaks.forEach((m, i) => {
      m.visible = on;
      if (!on) return;
      const q = this.streakSeed[i];
      const x = (-1 + 2 * clamp(s * 1.5 - q.o, 0, 1)) * 12;
      const lx = x * Math.cos(ang) - q.y * Math.sin(ang), ly = x * Math.sin(ang) + q.y * Math.cos(ang);
      m.position.copy(this.cinematic.position).add(this.tmpV2.set(lx, ly, -6).applyQuaternion(camQ));
      m.quaternion.copy(camQ).multiply(this.tmpQ.setFromAxisAngle(Z_AXIS, ang));
      m.scale.set(q.len, q.w, 1);
    });
  }

  private layoutScreen(u: number, t: number, stage: { body: THREE.Color; hot: THREE.Color }, after: number) {
    const fx = this.screen;
    const k = this.k;
    fx.darken = ramp(u, [
      [0, 0], [3, 0.45], [6, 0.6], [11, 0.5], [14.2, 0.1], [36, 0.2], [38.6, 0.25], [41, 0.3], [41.95, 0.2],
      [42, 0], [43.4, 0], [43.5, 0.15], [50, 0.3], [56, 0.15], [60, 0],
    ]);
    // World grade: cold night, violet forge, warm sky and ember aftermath.
    const violet = ramp(u, [[18, 0], [27, 1], [36, 1], [38, 0]]);
    const warm = ramp(u, [[36, 0], [38.6, 0.5], [41, 1], [43.4, 1], [60, 0.4]]);
    fx.tint.setHex(0x40508a).lerp(this.tmpC.setHex(0x5a3a8a), violet).lerp(this.tmpC.setHex(0x8a4a28), warm);

    // Speed lines: wind (resolve), rise, falling star, approach.
    fx.speedLines = Math.max(
      0.22 * ss(0.5, 1.5, u) * (1 - ss(U.rise - 0.5, U.rise, u)),
      0.5 * ss(U.rise, U.rise + 2, u) * (1 - ss(13.6, U.smear + 0.1, u)),
      0.8 * Math.sin(Math.PI * clamp((u - U.smear) / 0.6, 0, 1)),
      u >= U.throw && u < U.ground ? 0.45 : 0,
      u >= U.ground && u < U.hit ? 0.5 * ss(U.ground + 1, U.hit, u) : 0,
    );
    fx.speedLineColor.copy(u >= U.forge && u < U.throw ? stage.hot : this.tmpC.setHex(0xffe08a));
    if (u < U.rise) fx.focus.copy(this.P).add(this.tmpV2.set(0, 1.5, 0));
    else if (u < U.orbit) fx.focus.set(this.P.x, this.figY(u), this.P.z);
    else if (u < U.throw) fx.focus.copy(FZ).add(this.tmpV2.set(0, 12, 0));
    else if (u < U.ground) this.starFallPos(u, fx.focus);
    else this.starSkyPos(Math.min(u, U.hit), fx.focus);
    if (u >= U.hit) fx.focus.copy(this.C).setY(3);

    // Exposure: the star's light pushes the frame, the dead beat snaps it back.
    fx.exposure = u < U.dead ? 1 + 0.18 * ss(30, 35.5, u) : 1;
    fx.whiteout = 0;

    // Chroma: smear, impact.
    fx.chroma = Math.max(
      0.9 * Math.sin(Math.PI * clamp((u - U.smear) / 0.6, 0, 1)),
      this.hitDone ? chromaPulse(t, this.impactTime, 1, 7) : 0,
      chromaPulse(t, U.orbitHit * k, 0.6, 9),
    );

    // Impact frames: one per colour stage, the cut into orbit, the landing.
    let mode: 0 | 1 | 2 | 3 | 4 = 0;
    let colour = stage.body;
    const marks: [number, (0 | 1 | 2 | 3 | 4)[], number][] = [
      [U.smear + 0.25, [4], 0x3ad8c8], [U.forge, [4], 0x3ad8c8], [U.st2, [1], 0x8a5aff], [U.st3, [3], 0xffe08a],
    ];
    for (const [mu, pattern, hex] of marks) {
      const m = impactFrameAt(t, mu * k, pattern, 0.04);
      if (m) { mode = m; colour = this.tmpC.setHex(hex); fx.silhouettes = [this.hero.group]; }
    }
    const hitMode = impactFrameAt(t, this.impactTime, [1, 2], 0.04);
    if (hitMode) { mode = hitMode; colour = this.tmpC.setHex(0xffe08a); fx.silhouettes = this.targetSil; }
    fx.impact = mode;
    fx.impactColor.copy(colour);

    // The deliberate whiteout right after the impact frames (VFX_PRINCIPLES section 12).
    if (t > this.impactTime - 0.05 && t < this.impactTime + 2) {
      const fb = flashBeat(t, this.impactTime + 0.08, 0.5, 1.0);
      if (fb.whiteout > 0 || fb.exposure < 1) Object.assign(fx, fb);
    }
    void after;
  }

  private onHit() {
    this.hitDone = true;
    const ctx = this.ctx;
    const C = this.C;
    this.sparks.burst(700, this.tmpV2.set(C.x, 1.5, C.z));
    this.dust.burst(300, this.tmpV2.set(C.x, 0.5, C.z));
    this.shake = 1.4;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      this.sparks.burst(30, this.tmpV2.set(p.x, 1.2, p.z));
      ctx.hit(e, { damage: this.settings.damage, knock: 10, from: C, color: '#ffd27a' });
    });
  }

  private onSmoke() {
    this.smokeDone = true;
    this.smoke.trigger(this.tmpV2.set(this.C.x, 1.2, this.C.z), 3, 1.6);
    for (const p of this.ctx?.targetPos ?? []) this.smoke.trigger(this.tmpV2.set(p.x, 1, p.z), 1.4, 1.2);
  }
}

export const genesisCollapseModule: EffectModule = {
  label: 'genesis collapse',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAX_TARGETS },
  create: () => new GenesisCollapse(),
  telegraphs(effect) {
    const e = effect as GenesisCollapse;
    const pts = e.ctx?.targetPos ?? [];
    if (!e.ctx) return [];
    const c = new THREE.Vector3();
    for (const p of pts) c.add(p);
    if (pts.length) c.divideScalar(pts.length); else c.copy(e.ctx.point);
    const k = e.duration / BASE_DURATION;
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: 7 }, start: U.dead * k, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as GenesisCollapse;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as GenesisCollapse).settings;
    f.add(s, 'loop');
    f.add(s, 'duration', 30, 90, 1).name('duration (s)');
    f.add(s, 'damage', 1, 150, 1);
  },
};
