import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, chromaPulse, clearCinematic, clearScreenFx, createCinematic, createScreenFx,
  impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Abyssal Angler (targeted ground, radius 6, hero tier, ~18 s cutscene): the arena sinks into the deep sea. Darkness
 * floods in, silt and bioluminescent motes hang in the water, a single cyan lure sways in the black and the enemies
 * drift toward it, hypnotised. One flash lights the whole anglerfish behind the lure, then darkness again; its maw
 * erupts out of the dark around the enemies and snaps shut. The fish sinks back, the lure goes out last, the light
 * returns and the enemies drop back to the floor.
 *
 * Everything is a pure function of time t (fish pose, jaw, light, drift, motes, bubbles, rings); only emitter bursts,
 * the smoke ball and the hit fire when t crosses their time, so scrubbing works.
 *
 * The head is built from shapes: a flattened skull dome with a drawn skin texture (pores, scars, mottling), an
 * extruded U-shaped underbite jaw on a hinge, two rows of long curved needle teeth (bone with dark tips), tiny pale
 * eyes, a throat wall, and the illicium rod arching over the mouth to the lure bulb (the only bright thing).
 *
 * Camera: scripted with `cinematic`, every shot placed explicitly from the caster P0, the aim point C, the fish
 * heading F and its side R (no auto-fit), every key clamped to at most 24 from its look-at.
 *
 * Palette: lure core cyan (tiny) | bio blue | abyss teal | bone | abyss black.
 *
 * Timeline: 0 descent (wide, behind the caster) | 3.0 lure (cut, low, looking up at the cyan light) |
 * 5.2 enemies (cut, from the lure side, they drift and rise) | 7.0 reveal (cut, wide frontal; one flash lights the
 * fish) | 7.4 dead beat | 8.0 strike (cut, side profile; the maw erupts, snaps at 8.6) | 10.0 retreat (cut, wide;
 * the fish sinks, the lure goes out last) | 14.0 surface (cut, gameplay-like; light returns, enemies drop) | 18 end
 */
export interface AbyssalAnglerSettings {
  damage: number;
  loop: boolean;
}

export const defaultAbyssalAngler = (): AbyssalAnglerSettings => ({ damage: 95, loop: false });

const DURATION = 18;
const FLASH = 7.0;
const RUSH0 = 8.0;
const SNAP = 8.6;
const RET0 = 10.2;
const RET1 = 13.8;
const MAXE = 8;
const BUB_PER = 7;
const N_BIO = 70;
const N_SILT = 170;
const N_RISE = 60;
const N_MURK = 14;
const N_NEAR = 70;
const N_RAYS = 6;

// Palette.
const LURE_CORE = 0xbffcff;
const BIO = 0x3fd0ff;
const BIO_BODY = 0x2a9ec4;
const TEAL = 0x0f3a4a;
const BONE = 0xd8d0b8;
const ABYSS = 0x010406;

// Fish model (local space: +X forward out of the mouth, +Y up, +Z side).
const HINGE = new THREE.Vector3(-3, -1, 0);
const ROD_BASE = new THREE.Vector3(5.8, 9.4, 0);
const LURE_LOCAL = new THREE.Vector3(19.3, 10.4, 0);

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));

/** Deterministic 0..1 sequence. */
function lcg(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// --- Drawn textures ---------------------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Ragged dark deep-sea skin: teal gradient, mottling, pores with pale rims, light scars with stitch ticks. */
function skinTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    const rnd = lcg(5);
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#0a1418');
    gr.addColorStop(1, '#0c1a20');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 512);
    // Mottling: dark and lighter blotches.
    for (let i = 0; i < 120; i++) {
      g.fillStyle = i % 3 ? 'rgba(2,6,8,0.4)' : 'rgba(20,48,58,0.55)';
      g.beginPath();
      g.ellipse(rnd() * 512, rnd() * 512, 12 + rnd() * 38, 8 + rnd() * 24, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    // Wrinkle lines: short ragged dark strokes.
    g.strokeStyle = 'rgba(3,10,14,0.55)';
    g.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 512, y = rnd() * 512;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 14 + rnd() * 30, y + (rnd() - 0.5) * 16);
      g.lineTo(x + 30 + rnd() * 30, y + (rnd() - 0.5) * 22);
      g.stroke();
    }
    // Pores: dark pit with a pale rim.
    for (let i = 0; i < 280; i++) {
      const x = rnd() * 512, y = rnd() * 512, r = 2 + rnd() * 3.5;
      g.strokeStyle = 'rgba(40,84,92,0.4)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x, y, r + 1.6, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#030b0f';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // Scars: curved pale strokes crossed by stitch ticks.
    for (let i = 0; i < 16; i++) {
      const x = rnd() * 440, y = 30 + rnd() * 450, len = 50 + rnd() * 90, bend = (rnd() - 0.5) * 60;
      g.strokeStyle = 'rgba(3,10,14,0.7)';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len / 2, y + bend, x + len, y);
      g.stroke();
      g.strokeStyle = 'rgba(96,120,118,0.34)';
      g.lineWidth = 3;
      g.stroke();
      g.lineWidth = 2;
      for (let k = 1; k < 6; k++) {
        const u = k / 6;
        const px = x + len * u, py = y + bend * 2 * u * (1 - u);
        g.beginPath();
        g.moveTo(px, py - 7);
        g.lineTo(px + 2, py + 7);
        g.stroke();
      }
    }
    // Lateral line: a wavy lighter stroke.
    g.strokeStyle = 'rgba(20,48,58,0.5)';
    g.lineWidth = 5;
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const y = 256 + Math.sin(x * 0.04) * 22;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  });
}

// --- Geometry helpers -------------------------------------------------------------------------------------

/** A curved needle tooth of height 4 along +Y (dir 1) or -Y (dir -1): bone base, dark tip, bends toward +X. */
function toothGeometry(dir: 1 | -1): THREE.BufferGeometry {
  const N = 6, S = 8, H = 4;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const bone = new THREE.Color(BONE), root = new THREE.Color(0x6a6458), tip = new THREE.Color(0x2a2622);
  const c = new THREE.Color();
  for (let i = 0; i <= S; i++) {
    const u = i / S;
    const r = 0.25 * Math.pow(1 - u, 0.85);
    for (let j = 0; j < N; j++) {
      const a = (j / N) * Math.PI * 2;
      pos.push(Math.cos(a) * r + 1.0 * u * u, dir * u * H, Math.sin(a) * r);
      if (u < 0.1) c.copy(root).lerp(bone, u / 0.1);
      else if (u < 0.68) c.copy(bone);
      else c.copy(bone).lerp(tip, (u - 0.68) / 0.22);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * N + j, b = i * N + ((j + 1) % N), c2 = (i + 1) * N + j, d = (i + 1) * N + ((j + 1) % N);
      idx.push(a, b, c2, b, d, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Skin shader: drawn texture times a light level, plus a bio-blue rim so the dark body keeps a readable outline. */
function makeSkinMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uLight: { value: 0 },
      uRim: { value: new THREE.Color(BIO_BODY) },
      uRimK: { value: 0.23 },
      uKeyPos: { value: new THREE.Vector3() },
      uKeyK: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vWP;
      varying vec3 vWN;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vWP = (modelMatrix * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * normal);
        vN = normalize(normalMatrix * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uLight, uRimK, uKeyK;
      uniform vec3 uRim, uKeyPos;
      varying vec3 vWP;
      varying vec3 vWN;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
        float ndl = dot(normalize(vWN), normalize(uKeyPos - vWP));
        float key = step(0.5, ndl) * uKeyK;
        vec3 col = (texture2D(map, vUv).rgb + uRim * f * uRimK + vec3(0.12, 0.3, 0.38) * key) * uLight;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

interface Pose {
  dist: number;
  y: number;
  pitch: number;
  jaw: number;
}

interface LitBasic {
  mat: THREE.MeshBasicMaterial;
  base: THREE.Color;
}

// --- The effect -------------------------------------------------------------------------------------------

export class AbyssalAngler implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AbyssalAnglerSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private keys: ShotKey[] = [];
  private silFull: THREE.Object3D[] = [];
  private snapDone = false;
  private rushDone = false;
  private retreatDone = false;
  private surfDone = false;

  // Cast geometry.
  private P0 = v3(0, 0, 12);
  private C = v3();
  private F = v3(0, 0, -1);
  private R = v3(1, 0, 0);
  private yaw = 0;
  private tp: THREE.Vector3[] = [];

  // Fish.
  private fish = new THREE.Group();
  private probe = new THREE.Object3D();
  private body = new THREE.Group();
  private lowerJaw = new THREE.Group();
  private rod = new THREE.Group();
  private rodMesh!: THREE.Mesh;
  private baseCone!: THREE.Mesh;
  private lure = new THREE.Group();
  private lureHalo: THREE.Sprite;
  private lureHalo2: THREE.Sprite;
  private skinMat: THREE.ShaderMaterial;
  private lit: LitBasic[] = [];
  private lureGlow: THREE.Mesh;

  // Water.
  private murk: { s: THREE.Sprite; mat: THREE.SpriteMaterial; pos: THREE.Vector3; base: number }[] = [];
  private bioGeo = new THREE.BufferGeometry();
  private bioPos = new Float32Array(N_BIO * 3);
  private bio: THREE.Points;
  private siltGeo = new THREE.BufferGeometry();
  private siltPos = new Float32Array(N_SILT * 3);
  private silt: THREE.Points;
  private riseGeo = new THREE.BufferGeometry();
  private risePos = new Float32Array(N_RISE * 3);
  private rise: THREE.Points;
  private bubGeo = new THREE.BufferGeometry();
  private bubPos = new Float32Array(MAXE * BUB_PER * 3);
  private bubbles: THREE.Points;
  private rays: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; lat: number; fwd: number; tilt: number; base: number }[] = [];
  private nearGeo = new THREE.BufferGeometry();
  private nearPos = new Float32Array(N_NEAR * 3);
  private near: THREE.Points;
  private seeds:{ x: number; z: number; y: number; ph: number; sp: number }[] = [];
  private rings: ReturnType<typeof createRing>[] = [];
  private shockCam = new ShockRefraction({ facing: 'camera', width: 0.3 });
  private shockGround = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private haze = new HeatHaze({ width: 44, height: 24, scale: 3.2, speed: 0.7 });
  private smoke = new SmokeBall({ maxBalls: 8, color: 0x041016, rim: 0x16424e, flake: '#041016' });

  private siltBurst: Emitter;
  private bubbleBurst: Emitter;

  private tmpA = v3();
  private tmpB = v3();
  private tmpC = v3();
  private tmpD = v3();

  constructor(settings: AbyssalAnglerSettings = defaultAbyssalAngler()) {
    this.settings = settings;
    this.screen.tint.set(0x14607a);
    this.screen.impactColor.set(0x9fe8ff);
    this.screen.edgeTint.set(BIO);
    this.probe.rotation.order = 'YZX';
    this.fish.rotation.order = 'YZX';

    const skin = skinTexture();
    this.skinMat = makeSkinMaterial(skin);
    this.buildFish();
    this.group.add(this.fish);

    // Lure foot glow on the ground and the soft glow under it.
    const dot = softDotTexture();
    this.lureGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: dot, color: BIO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }),
    );
    this.lureGlow.rotation.x = -Math.PI / 2;
    this.lureGlow.scale.setScalar(18);
    this.lureGlow.visible = false;
    this.group.add(this.lureGlow);

    // Halos on the lure (the only things that should bloom).
    this.lureHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: BIO, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.lureHalo2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: BIO, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.lure.add(this.lureHalo, this.lureHalo2);
    for (const h of [this.lureHalo, this.lureHalo2]) h.frustumCulled = false;

    // Murk: a few big dark teal sprites far out around the arena.
    const rnd = lcg(31);
    for (let i = 0; i < N_MURK; i++) {
      const mat = new THREE.SpriteMaterial({ map: dot, color: TEAL, transparent: true, opacity: 0, depthWrite: false, rotation: rnd() * 6.28 });
      const s = new THREE.Sprite(mat);
      s.frustumCulled = false;
      if (i < 8) {
        const a = (i / 8) * Math.PI * 2 + rnd() * 0.5;
        const rad = 20 + rnd() * 8;
        this.murk.push({ s, mat, pos: v3(Math.cos(a) * rad, 3 + rnd() * 7, Math.sin(a) * rad), base: 0.28 });
        s.scale.setScalar(16 + rnd() * 6);
      } else {
        // Close murk behind the enemies (along F, the side away from the caster).
        this.murk.push({ s, mat, pos: v3(7 + rnd() * 6, 2 + rnd() * 4, (rnd() - 0.5) * 18), base: 0.34 });
        s.scale.setScalar(10 + rnd() * 4);
      }
      this.group.add(s);
    }

    // Motes: bioluminescent (additive), silt (normal), rising bubbles (normal).
    for (let i = 0; i < Math.max(N_BIO, N_SILT, N_RISE); i++) {
      this.seeds.push({ x: rnd() * 2 - 1, z: rnd() * 2 - 1, y: rnd(), ph: rnd() * 6.28, sp: 0.5 + rnd() });
    }
    const mk = (geo: THREE.BufferGeometry, arr: Float32Array, size: number, color: number, opacity: number, additive: boolean) => {
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const p = new THREE.Points(geo, new THREE.PointsMaterial({
        size, map: dot, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      p.frustumCulled = false;
      p.visible = false;
      this.group.add(p);
      return p;
    };
    this.bio = mk(this.bioGeo, this.bioPos, 0.4, BIO, 0.9, true);
    this.silt = mk(this.siltGeo, this.siltPos, 0.2, 0x5a7a86, 0.55, false);
    this.rise = mk(this.riseGeo, this.risePos, 0.22, 0xa8e6f4, 0.55, false);
    this.bubbles = mk(this.bubGeo, this.bubPos, 0.26, 0xbfeaf4, 0.7, false);

    this.near = mk(this.nearGeo, this.nearPos, 0.16, 0x9cc8d4, 0.6, false);

    // God rays: faint tall light shafts from above that fade as we sink.
    const rayTex = canvasTexture(64, 256, (g) => {
      const h = g.createLinearGradient(0, 0, 64, 0);
      h.addColorStop(0, 'rgba(255,255,255,0)');
      h.addColorStop(0.5, 'rgba(255,255,255,1)');
      h.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = h;
      g.fillRect(0, 0, 64, 256);
      g.globalCompositeOperation = 'destination-in';
      const v = g.createLinearGradient(0, 0, 0, 256);
      v.addColorStop(0, 'rgba(0,0,0,1)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = v;
      g.fillRect(0, 0, 64, 256);
    });
    for (let i = 0; i < N_RAYS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: rayTex, color: 0x4fb4d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), mat);
      m.frustumCulled = false;
      m.scale.set(3 + rnd() * 3, 34, 1);
      this.rays.push({ m, mat, lat: (i - (N_RAYS - 1) / 2) * 5 + (rnd() - 0.5) * 3, fwd: (rnd() - 0.3) * 14, tilt: 0.18 + rnd() * 0.12, base: 0.09 + rnd() * 0.05 });
      this.group.add(m);
    }

    // Snap rings on the ground.
    for (const c of [BIO, BONE]) {
      const r = createRing(c, 0.93, 1, 96);
      this.rings.push(r);
      this.group.add(r.mesh);
    }
    this.group.add(this.shockCam.mesh, this.shockGround.mesh, this.haze.mesh, this.smoke.mesh);

    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      this.emitters.push(e);
      return e;
    };
    this.siltBurst = em({
      maxParticles: 800, lifetime: 2.8, lifetimeJitter: 0.4, shapeSize: 3.5, speed: 3.2, speedJitter: 0.6, spread: 100, gravity: -0.05, drag: 1.4,
      sizeStart: 0.55, sizeEnd: 1.0, colorStart: '#4a6e7a', colorEnd: '#1a3440', opacityStart: 0.55, opacityEnd: 0, additive: false, sizeJitter: 0.5,
      erosion: 0.4, spin: 0.3, groundFade: 0.2,
    });
    this.bubbleBurst = em({
      maxParticles: 500, lifetime: 2.4, lifetimeJitter: 0.5, shapeSize: 2.5, speed: 2.4, speedJitter: 0.6, spread: 90, gravity: -2.2, drag: 0.8,
      sizeStart: 0.22, sizeEnd: 0.16, colorStart: '#bfeaf4', colorEnd: '#5fb8d0', opacityStart: 0.8, opacityEnd: 0, additive: false, sizeJitter: 0.5,
    });
    this.emitters.push(this.smoke.emitter);
    this.group.add(this.smoke.emitter.points);
    this.smoke.hold = 0.25;

    this.reset();
  }

  get duration() {
    return DURATION;
  }

  // --- The fish model ------------------------------------------------------------------------------------

  private basic(color: number, extra: Partial<THREE.MeshBasicMaterialParameters> = {}) {
    const mat = new THREE.MeshBasicMaterial({ color, fog: false, ...extra });
    this.lit.push({ mat, base: new THREE.Color(color) });
    return mat;
  }

  private ellipsoid(r: [number, number, number], at: [number, number, number], mat: THREE.Material, parent: THREE.Object3D) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), mat);
    m.scale.set(...r);
    m.position.set(...at);
    parent.add(m);
    return m;
  }

  /** Places teeth along a half-path mirrored into a U. Positions are in the parent's local space. */
  private teeth(half: [number, number, number][], n: number, baseY: number, dir: 1 | -1, cx: number, sMin: number, sMax: number, seed: number) {
    const pts = half.map(([x, y, z]) => v3(x, y, z));
    const full = [...pts, ...pts.slice(0, -1).reverse().map((p) => v3(p.x, p.y, -p.z))];
    const curve = new THREE.CatmullRomCurve3(full);
    const sp = curve.getSpacedPoints(n);
    const geo = toothGeometry(dir);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
    this.lit.push({ mat, base: new THREE.Color(0xffffff) });
    const rnd = lcg(seed);
    const items: THREE.Matrix4[] = [];
    for (let i = 2; i < n - 1; i++) {
      const p = sp[i];
      const f = Math.exp(-Math.pow(p.z / 4.2, 2));
      let s = lerp(sMin, sMax, f) * (0.85 + 0.2 * rnd()) * (i % 2 ? 0.82 : 1);
      s = Math.max(s, 0.2);
      const ix = cx - p.x, iz = -p.z;
      const il = Math.hypot(ix, iz) || 1;
      const phi = Math.atan2(-iz / il, ix / il);
      const m = new THREE.Matrix4().compose(
        v3(p.x, baseY, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, phi, 0)), v3(s, s, s),
      );
      items.push(m);
    }
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((m, i) => im.setMatrixAt(i, m));
    im.frustumCulled = false;
    return im;
  }

  /** Ragged dorsal fin and two pectoral fins: thin dark extruded spiky plates. */
  private buildFins(body: THREE.Object3D) {
    const rnd = lcg(13);
    const mat = this.basic(0x0e242c, { side: THREE.DoubleSide });
    // Dorsal: spikes leaning back along the top of the skull (profile in XY).
    const d = new THREE.Shape();
    d.moveTo(-10, 8.6);
    for (let i = 0; i < 8; i++) {
      const x = -10 + i * 1.8;
      d.lineTo(x + 0.9, 9.0 + 3.4 + rnd() * 2.2);
      d.lineTo(x + 1.5, 9.2);
    }
    d.lineTo(5, 9.6);
    d.lineTo(5, 8.0);
    d.closePath();
    const dorsal = new THREE.Mesh(new THREE.ExtrudeGeometry(d, { depth: 0.18, bevelEnabled: false }).translate(0, 0, -0.09), mat);
    body.add(dorsal);
    // Pectorals: jagged plates splayed out and back from the cheeks.
    for (const z of [-1, 1]) {
      const f = new THREE.Shape();
      f.moveTo(0, 0);
      for (let i = 0; i < 5; i++) {
        f.lineTo(-2.2 - i * 1.7, -1.5 - i * 0.6 - rnd() * 1.2);
        f.lineTo(-1.6 - i * 1.7, -0.4 - i * 0.4);
      }
      f.lineTo(0, 1.2);
      f.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 0.16, bevelEnabled: false }), mat);
      m.position.set(-4, -0.5, z * 10.2);
      m.rotation.y = z * 0.5;
      body.add(m);
    }
  }

  private buildFish() {
    const skin = this.skinMat;
    const body = this.body;

    // Skull dome, upper lip, throat block and cheeks.
    this.ellipsoid([11, 5.2, 8.2], [-1.5, 5.6, 0], skin, body);
    this.ellipsoid([9.5, 2.6, 9.4], [1.6, 0.3, 0], skin, body);
    this.ellipsoid([6, 4.5, 10.2], [-9, -1.5, 0], skin, body);
    this.ellipsoid([6, 4.5, 4.5], [-11.5, 3, 0], skin, body);
    for (const z of [-1, 1]) this.ellipsoid([3.4, 3.8, 2.8], [-3, -1.5, z * 9.6], skin, body);
    this.buildFins(body);

    // Throat wall at the back of the mouth (near black with a teal edge).
    const wall = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateY(Math.PI / 2), this.basic(0x04141a, { side: THREE.DoubleSide }));
    wall.scale.set(1, 6, 7.2);
    wall.position.set(-2.6, -2.2, 0);
    body.add(wall);

    // Eyes: tiny, pale, with dark pupils.
    const eyeMat = this.basic(0xc9c4b0);
    for (const z of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), eyeMat);
      e.position.set(6.0, 8.0, z * 4.6);
      body.add(e);
    }

    // Upper teeth: short needles hanging from the lip, leaning inward.
    body.add(this.teeth(
      [[-2, 0, -7.6], [3.5, 0, -7.4], [7.8, 0, -5.6], [9.9, 0, -2.7], [10.5, 0, 0]], 30, -0.1, -1, 3, 0.6, 1.1, 71,
    ));

    // Lower jaw on a hinge: extruded U ring (the underbite), a dark mouth floor and long fangs.
    const half: [number, number, number][] = [[0, 0, -10.0], [5.5, -0.4, -10.0], [11, -0.2, -7.4], [14.4, 0.4, -3.8], [15.5, 0.9, 0]];
    const pts = half.map(([x, y, z]) => v3(x, y, z));
    const full = [...pts, ...pts.slice(0, -1).reverse().map((p) => v3(p.x, p.y, -p.z))];
    const curve = new THREE.CatmullRomCurve3(full);
    const sp = curve.getSpacedPoints(60);
    const outer: THREE.Vector2[] = [], inner: THREE.Vector2[] = [];
    sp.forEach((p, i) => {
      const t = curve.getTangentAt(i / 60);
      const nx = -t.z, nz = t.x; // normal in xz, flipped below to point away from the U's centre
      const nl = Math.hypot(nx, nz) || 1;
      const sgn = nx * (p.x - 5) + nz * p.z >= 0 ? 1 : -1;
      const ox = (nx / nl) * sgn, oz = (nz / nl) * sgn;
      outer.push(new THREE.Vector2(p.x + ox * 1.4, -(p.z + oz * 1.4)));
      inner.push(new THREE.Vector2(p.x - ox * 1.4, -(p.z - oz * 1.4)));
    });
    const ring = new THREE.Shape([...outer, ...inner.slice().reverse()]);
    const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: 2.2, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 2 });
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, -1.6, 0);
    this.lowerJaw.add(new THREE.Mesh(ringGeo, skin));
    const floorGeo = new THREE.ShapeGeometry(new THREE.Shape(inner));
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.translate(0, -0.4, 0);
    this.lowerJaw.add(new THREE.Mesh(floorGeo, this.basic(0x06222a, { side: THREE.DoubleSide })));
    this.lowerJaw.add(this.teeth(half, 34, 0.6, 1, 5, 0.8, 1.5, 97));
    this.lowerJaw.position.copy(HINGE);
    body.add(this.lowerJaw);

    // Illicium rod from the forehead, arching forward over the mouth; the lure hangs at its end.
    const rodCurve = new THREE.CatmullRomCurve3([v3(0, 0, 0), v3(1.5, 4.4, 0), v3(5.7, 7.2, 0), v3(10.7, 6.2, 0), v3(13.4, 2.6, 0)]);
    this.rodMesh = new THREE.Mesh(new THREE.TubeGeometry(rodCurve, 36, 0.2, 6), this.basic(0x2a6a80));
    const baseCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 8).translate(0, 0.6, 0), this.basic(0x1a4a5a));
    this.rod.add(this.rodMesh, baseCone);
    this.baseCone = baseCone;
    this.rod.position.copy(ROD_BASE);
    this.fish.add(this.rod); // not under body: the lure stays visible while the body is hidden

    // Lure bulb: dark outline shell, bio-blue body, tiny cyan core, dark tendrils. Hangs off the rod tip.
    const lure = this.lure;
    lure.position.set(LURE_LOCAL.x - ROD_BASE.x, LURE_LOCAL.y - ROD_BASE.y, 0);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10), new THREE.MeshBasicMaterial({ color: ABYSS, side: THREE.BackSide, fog: false }));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshBasicMaterial({ color: BIO_BODY, fog: false }));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: LURE_CORE, fog: false }));
    const filament = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 5).translate(0, 0.65, 0), new THREE.MeshBasicMaterial({ color: 0x2a6a80, fog: false }));
    lure.add(shell, bulb, core, filament);
    const tendril = new THREE.ConeGeometry(0.05, 0.8, 5).translate(0, -0.4, 0);
    const tMat = new THREE.MeshBasicMaterial({ color: 0x1a5060, fog: false });
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(tendril, tMat);
      const a = (i / 6) * Math.PI * 2;
      t.position.set(Math.cos(a) * 0.22, -0.25, Math.sin(a) * 0.22);
      t.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      lure.add(t);
    }
    this.rod.add(lure);

    this.fish.add(body);
    this.fish.visible = false;
  }

  // --- Pose and world helpers ----------------------------------------------------------------------------

  /** Fish pose at time t (a pure function): creep, rush, bite, hold, then sink back. */
  private poseAt(t: number, o: Pose): Pose {
    let dist: number, y: number;
    if (t < RUSH0) {
      dist = 30 - 2.5 * ss(3, 8, t);
      y = 3 + 0.25 * Math.sin(t * 0.8) * (1 - ss(7.5, 8, t));
    } else if (t < SNAP) {
      const p = (t - RUSH0) / (SNAP - RUSH0);
      dist = lerp(27.5, 4, 1 - Math.pow(1 - p, 2.2));
      y = 3 + 2 * ss(RUSH0, RUSH0 + 0.5, t);
    } else if (t < RET0) {
      dist = 4 - 0.6 * ss(SNAP, RET0, t);
      y = 5;
    } else {
      const p = ss(RET0, RET1, t);
      dist = lerp(3.4, 34, p);
      y = lerp(5, -14, p);
    }
    o.dist = dist;
    o.y = y;
    o.pitch = -0.28 * ss(RET0, RET1, t);
    if (t < 7.7) o.jaw = 0.45;
    else if (t < SNAP) o.jaw = 0.45 + 0.13 * ss(7.7, 8.3, t);
    else if (t < RET0) o.jaw = 0.58 - 0.55 * ss(SNAP, SNAP + 0.12, t);
    else o.jaw = 0.03 + 0.25 * ss(RET0, 12.5, t);
    return o;
  }

  private _pose: Pose = { dist: 0, y: 0, pitch: 0, jaw: 0 };

  /** A fish-local point in world space at time t. */
  private toWorld(t: number, local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const p = this.poseAt(t, this._pose);
    this.probe.position.set(this.C.x + this.F.x * p.dist, p.y, this.C.z + this.F.z * p.dist);
    this.probe.rotation.set(0, this.yaw, p.pitch);
    this.probe.updateMatrixWorld(true);
    return out.copy(local).applyMatrix4(this.probe.matrixWorld);
  }

  /** Light level on the fish's body (0 = hidden in the dark): one flash at the reveal, dim light on the strike. */
  private bodyL(t: number): number {
    let l = 0;
    if (t < FLASH) l = 0;
    else if (t < FLASH + 0.18) l = 1; // visible for the silhouette card only
    else if (t < RUSH0) l = 0;
    else if (t < 11) l = 0.72 * ss(RUSH0, RUSH0 + 0.4, t);
    else l = 0.72 * (1 - ss(11, 13.2, t));
    if (t >= SNAP && t < SNAP + 0.4) l += 0.3 * (1 - ss(SNAP, SNAP + 0.4, t));
    return l;
  }

  private flashK(t: number): number {
    if (t < FLASH) return 0;
    return t < FLASH + 0.18 ? 1 : 0;
  }

  private lureI(t: number): number {
    return ss(3.0, 3.6, t) * (1 - ss(13.2, 14.0, t));
  }

  /** Drift of enemy i (hypnotised toward the lure, rising), recovering to the floor from 14 s. */
  private enemyOffset(t: number, i: number, out: THREE.Vector3): THREE.Vector3 {
    const d = ss(3.6, 7.0, t);
    const lift = ss(4.4, 7.0, t);
    const ret = 1 - ss(14.0, 16.4, t);
    const base = this.tp[i] ?? this.C;
    out.set(0, 0, 0);
    out.addScaledVector(this.F, 1.8 * d);
    out.addScaledVector(this.tmpD.copy(this.C).sub(base).setY(0), 0.25 * d);
    out.addScaledVector(this.R, 0.12 * Math.sin(t * 1.3 + i) * d);
    out.y = (0.9 + 0.1 * Math.sin(t * 1.7 + i)) * lift;
    return out.multiplyScalar(ret);
  }

  // --- Cast and camera keys ------------------------------------------------------------------------------

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.C.copy(ctx.point).setY(0);
    this.tp = ctx.targetPos.length ? ctx.targetPos.map((p) => p.clone().setY(0)) : [];
    this.P0.copy(ctx.from).setY(0);
    this.F.copy(this.C).sub(this.P0).setY(0);
    if (this.F.lengthSq() < 1e-4) this.F.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.F.lengthSq() < 1e-4) this.F.set(0, 0, -1);
    this.F.normalize();
    this.R.set(-this.F.z, 0, this.F.x);
    // Fish faces -F (toward the caster); local +X maps to -F.
    this.yaw = Math.atan2(this.F.z, -this.F.x);
    this.silFull = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.fish];
    this.screen.silhouettes = this.silFull;
    this.buildKeys();
    this.reset();
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const { P0, C, F, R } = this;
    const B = F.clone().negate();
    const up = (y: number) => v3(0, y, 0);
    const key = (t: number, pos: THREE.Vector3, target: THREE.Vector3, fov: number, cut = false, ease: ShotKey['ease'] = 'inOut') => {
      const p = pos.clone();
      if (p.y < 0.7) p.y = 0.7;
      const off = p.clone().sub(target);
      if (off.length() > 24) p.copy(target).addScaledVector(off.normalize(), 24);
      keys.push({ t, position: p, target: target.clone(), fov, roll: 0, cut, ease });
    };
    const at = (base: THREE.Vector3, ...parts: [THREE.Vector3, number][]) => {
      const o = base.clone();
      for (const [v, k] of parts) o.addScaledVector(v, k);
      return o;
    };

    // 1. Descent: wide from behind the caster, slow push toward the arena while the water closes in.
    const descLook = C.clone().add(up(1.8));
    key(0, at(P0, [B, 8], [R, 3]).add(up(4.4)), descLook, 46, true);
    key(3 - 0.001, at(P0, [B, 5], [R, 1.8]).add(up(3.2)), descLook, 46, false, 'linear');

    // 2. Lure: low behind the enemies, looking up at the cyan pinpoint; slow push in.
    const lureAt = this.toWorld(4.2, LURE_LOCAL, v3());
    const lureLook = lureAt.clone().add(up(-3.6)); // lure sits in the upper third
    key(3.0, at(C, [B, 11], [R, 2]).add(up(1.2)), lureLook, 56, true);
    key(5.2 - 0.001, at(C, [B, 9], [R, 1.5]).add(up(1.4)), lureLook, 52, false, 'linear');

    // 3. Enemies: from the lure side at floor level, looking back at them as they drift toward us and rise.
    const enLook = C.clone().add(F.clone().multiplyScalar(1.4)).add(up(1.7));
    key(5.2, at(C, [F, 8.5], [R, 3.6]).add(up(1.5)), enLook, 54, true);
    key(7.0 - 0.001, at(C, [F, 6.6], [R, 2.6]).add(up(1.7)), enLook, 54, false, 'linear');

    // 4. Reveal: wide frontal view of the fish and the lure above it; held (the flash is the event).
    // Whole head (jaw, teeth, dorsal spines, rod, lure) three-quarter from the front, ~22 away, about 60% of the width.
    const headAt = this.toWorld(7.1, v3(6, 5, 0), v3());
    key(7.0, headAt.clone().addScaledVector(B, 16).addScaledVector(R, 15).add(up(-2)), headAt, 56, true);
    key(8.0 - 0.001, headAt.clone().addScaledVector(B, 15).addScaledVector(R, 14).add(up(-2)), headAt, 56, false, 'linear');

    // 5. Strike: side profile from the right; the fish enters from screen right, the maw closes on the point.
    const stLook = C.clone().addScaledVector(F, -0.5).add(up(5.2));
    key(8.0, at(C, [R, 21.5], [F, 0.5]).add(up(6.6)), stLook, 60, true);
    key(10.0 - 0.001, at(C, [R, 19.5], [F, -0.5]).add(up(6.0)), stLook, 60, false, 'inOut');

    // 6. Retreat: wide from the caster side, high enough to see the fish sink away into the dark.
    key(10.0, at(C, [B, 12], [R, 8]).add(up(7)), at(C, [F, 6]).add(up(3)), 52, true);
    key(14.0 - 0.001, at(C, [B, 9], [R, 10]).add(up(6)), at(C, [F, 16]).add(up(1.5)), 52, false, 'inOut');

    // 7. Surface: gameplay-like framing behind the caster.
    const calmLook = P0.clone().lerp(C, 0.6).add(up(1));
    key(14.0, at(P0, [B, 7.5], [R, 2]).add(up(5.8)), calmLook, 44, true);
    key(DURATION, at(P0, [B, 7], [R, 2]).add(up(5.6)), calmLook, 44, false, 'linear');
  }

  /** Danger zone: a circle at the aim point from 3 to 8.6. */
  telegraphSpecs(): TelegraphSpec[] {
    return [{ shape: { kind: 'circle', x: this.C.x, z: this.C.z, radius: 6 }, start: 3, impact: SNAP }];
  }

  // --- Play / reset --------------------------------------------------------------------------------------

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout();
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.snapDone = false;
    this.rushDone = false;
    this.retreatDone = false;
    this.surfDone = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.layout();
  }

  /** End of the timeline: everything back to neutral and hidden. */
  private finish() {
    this.playing = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.shake = 0;
    this.time = 0;
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.finish();
      return;
    }
    const t = this.time;
    if (!this.rushDone && t >= RUSH0 + 0.1) {
      this.rushDone = true;
      this.siltBurst.burst(130, this.tmpA.copy(this.C).addScaledVector(this.F, 12).setY(0.6));
      this.bubbleBurst.burst(60, this.tmpA.copy(this.C).addScaledVector(this.F, 9).setY(2));
    }
    if (!this.snapDone && t >= SNAP) this.onSnap();
    if (!this.retreatDone && t >= RET0 + 0.2) {
      this.retreatDone = true;
      this.siltBurst.burst(130, this.tmpA.copy(this.C).addScaledVector(this.F, 3).setY(0.5));
    }
    if (!this.surfDone && t >= 14.1) {
      this.surfDone = true;
      this.bubbleBurst.burst(70, this.tmpA.copy(this.C).setY(1.2));
    }
    this.layout();
  }

  private onSnap() {
    this.snapDone = true;
    const tip = this.toWorld(SNAP, this.tmpB.set(11, 0.5, 0), this.tmpA);
    this.siltBurst.burst(300, tip);
    this.bubbleBurst.burst(220, this.tmpC.copy(this.C).setY(2.2));
    this.smoke.trigger(this.tmpC.copy(this.C).setY(2.6), 1.2, 1.0);
    const ctx = this.ctx;
    if (!ctx) return;
    const from = this.toWorld(SNAP, this.tmpB.set(0, 0, 0), this.tmpD).setY(0);
    for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 3, from: from.clone(), color: '#3fd0ff' });
  }

  // --- Layout (pure function of time, apart from the bursts above) ---------------------------------------

  private layout() {
    const on = this.playing;
    const t = on ? this.time : -1;
    const cin = this.cinematic;
    if (on) {
      sampleShots(this.keys, t, cin);
      cin.letterbox = ss(0.3, 0.9, t) * (1 - ss(16.6, 17.4, t));
      cin.active = t < 17.5;
    }
    this.layoutFish(t);
    this.layoutWater(t);
    this.layoutEnemies(t);
    this.layoutSnap(t);
    this.layoutScreen(t);
  }

  private layoutFish(t: number) {
    const on = this.playing;
    const p = this.poseAt(Math.max(t, 0), this._pose);
    const L = on ? this.bodyL(t) : 0;
    const lureI = on ? this.lureI(t) : 0;
    const fish = this.fish;
    fish.visible = on && (L > 0.01 || lureI > 0.01);
    this.body.visible = L > 0.01;
    this.rodMesh.visible = L > 0.01;
    this.baseCone.visible = L > 0.01;
    fish.position.set(this.C.x + this.F.x * p.dist, p.y, this.C.z + this.F.z * p.dist);
    fish.rotation.set(0, this.yaw, p.pitch);
    this.lowerJaw.rotation.z = -p.jaw;
    this.rod.rotation.set(0.07 * Math.sin(t * 0.9 + 1), 0, 0.05 * Math.sin(t * 1.3));
    this.skinMat.uniforms.uLight.value = L;
    for (const l of this.lit) l.mat.color.copy(l.base).multiplyScalar(L);

    // Lure: pinpoint that grows, breathes, and keeps shining after the body goes dark.
    const grow = 0.25 + 0.75 * ss(3.0, 4.4, t);
    const pulse = 1 + 0.12 * Math.sin(t * 3.1) + 0.05 * Math.sin(t * 7.3);
    this.lure.visible = lureI > 0.01;
    this.lure.scale.setScalar(Math.max(grow * pulse, 1e-3));
    (this.lureHalo.material as THREE.SpriteMaterial).opacity = 0.35 * lureI;
    this.lureHalo.scale.setScalar(2.4);
    (this.lureHalo2.material as THREE.SpriteMaterial).opacity = 0;
    this.lureHalo2.scale.setScalar(1);

    // Ground glow under the lure.
    fish.updateMatrixWorld(true);
    this.lure.getWorldPosition(this.tmpA);
    this.skinMat.uniforms.uKeyPos.value.copy(this.tmpA);
    const gm = this.lureGlow.material as THREE.MeshBasicMaterial;
    gm.opacity = 0.16 * lureI * (0.9 + 0.1 * Math.sin(t * 3.1));
    this.lureGlow.visible = on && lureI > 0.01;
    this.lureGlow.position.set(this.tmpA.x, 0.07, this.tmpA.z);
  }

  private layoutWater(t: number) {
    const on = this.playing;
    const amb = on ? ss(0.6, 3.0, t) * (1 - ss(14.5, 17.5, t)) : 0;
    const C = this.C, F = this.F, R = this.R;

    for (const m of this.murk) {
      m.s.visible = on && amb > 0.01;
      m.s.position.copy(C).addScaledVector(F, m.pos.x).addScaledVector(R, m.pos.z);
      m.s.position.y = m.pos.y + 0.4 * Math.sin(t * 0.3 + m.pos.x);
      m.mat.opacity = m.base * amb * ss(0.1, 1.2, t);
    }

    const place = (arr: Float32Array, n: number, spread: number, h: number, rise: number, sway: number) => {
      for (let i = 0; i < n; i++) {
        const s = this.seeds[i];
        const x = s.x * spread + sway * Math.sin(t * 0.4 * s.sp + s.ph);
        const z = s.z * spread + sway * Math.cos(t * 0.35 * s.sp + s.ph);
        const y = ((s.y * h + Math.max(t, 0) * rise * s.sp) % h + h) % h;
        this.tmpA.copy(C).addScaledVector(F, x).addScaledVector(R, z);
        arr[i * 3] = this.tmpA.x;
        arr[i * 3 + 1] = y + 0.2;
        arr[i * 3 + 2] = this.tmpA.z;
      }
    };
    place(this.bioPos, N_BIO, 20, 12, 0.25, 0.8);
    place(this.siltPos, N_SILT, 22, 14, 0.04, 0.5);
    place(this.risePos, N_RISE, 18, 12, 0.9, 0.3);
    this.bioGeo.attributes.position.needsUpdate = true;
    this.siltGeo.attributes.position.needsUpdate = true;
    this.riseGeo.attributes.position.needsUpdate = true;
    this.bio.visible = this.silt.visible = this.rise.visible = on && amb > 0.01;
    (this.bio.material as THREE.PointsMaterial).opacity = 0.9 * amb;
    (this.silt.material as THREE.PointsMaterial).opacity = 0.55 * amb;
    (this.rise.material as THREE.PointsMaterial).opacity = 0.55 * amb;

    // Haze: a big quad centred in front of the camera = underwater refraction for the whole underwater part.
    const cin = this.cinematic;
    const strength = on ? 0.008 * ss(0.5, 2.5, t) * (1 - ss(14.5, 17.0, t)) : 0;
    this.tmpA.copy(cin.target).sub(cin.position).normalize();
    this.tmpB.crossVectors(this.tmpA, v3(0, 1, 0));
    if (this.tmpB.lengthSq() < 1e-6) this.tmpB.set(1, 0, 0);
    this.tmpB.normalize();
    this.tmpC.crossVectors(this.tmpB, this.tmpA).normalize();
    this.tmpD.copy(cin.position).addScaledVector(this.tmpA, 9).addScaledVector(this.tmpC, -12);
    this.haze.set(this.tmpD, strength, Math.max(t, 0), 1);

    // Marine snow near the camera: drifting specks in the camera's frame.
    for (let i = 0; i < N_NEAR; i++) {
      const s = this.seeds[i];
      const x = s.x * 6 + 0.5 * Math.sin(t * 0.5 * s.sp + s.ph);
      const y = (s.z * 3.5) + (((s.y * 4 + Math.max(t, 0) * 0.15 * s.sp) % 4) - 2);
      const z = 2.5 + s.y * 8 + 0.4 * Math.cos(t * 0.4 * s.sp + s.ph);
      this.tmpD.copy(cin.position).addScaledVector(this.tmpB, x).addScaledVector(this.tmpC, y).addScaledVector(this.tmpA, z);
      this.nearPos[i * 3] = this.tmpD.x;
      this.nearPos[i * 3 + 1] = this.tmpD.y;
      this.nearPos[i * 3 + 2] = this.tmpD.z;
    }
    this.nearGeo.attributes.position.needsUpdate = true;
    this.near.visible = on && amb > 0.01;
    (this.near.material as THREE.PointsMaterial).opacity = 0.6 * amb;

    // God rays: strong at the start of the descent, gone as we sink.
    const rayA = on ? ss(0.1, 1.0, t) * (1 - ss(2.5, 6.5, t)) : 0;
    for (const r of this.rays) {
      r.m.visible = rayA > 0.005;
      r.m.position.copy(C).addScaledVector(R, r.lat).addScaledVector(F, r.fwd);
      r.m.position.y = 30;
      r.m.rotation.set(0, Math.atan2(R.x, R.z), r.tilt);
      r.mat.opacity = r.base * rayA * (0.8 + 0.2 * Math.sin(t * 0.7 + r.lat));
    }
  }

  /** Enemy drift (displace) and the bubbles rising off them. */
  private layoutEnemies(t: number) {
    const ctx = this.ctx;
    const on = this.playing;
    const n = Math.min(this.tp.length, MAXE);
    const a = this.bubPos;
    const vis = on && ((t > 4.6 && t < 8.7) || (t > 10.6 && t < 14.6));
    for (let i = 0; i < MAXE; i++) {
      if (i < n) this.enemyOffset(on ? t : -1, i, this.tmpC);
      for (let k = 0; k < BUB_PER; k++) {
        const o = (i * BUB_PER + k) * 3;
        if (i >= n || !vis) {
          a[o] = 0;
          a[o + 1] = -100;
          a[o + 2] = 0;
          continue;
        }
        const ph = (k * 0.37 + i * 0.113) % 1;
        const u = (((t * 0.55 + ph) % 1) + 1) % 1;
        const ang = k * 2.4 + i;
        a[o] = this.tp[i].x + this.tmpC.x + Math.cos(ang) * 0.5 * (0.6 + u * 0.5);
        a[o + 1] = this.tmpC.y + 0.2 + u * 3.4;
        a[o + 2] = this.tp[i].z + this.tmpC.z + Math.sin(ang) * 0.5 * (0.6 + u * 0.5);
      }
    }
    this.bubGeo.attributes.position.needsUpdate = true;
    this.bubbles.visible = vis;
    if (ctx) {
      ctx.targets.forEach((e, i) => {
        this.enemyOffset(on ? t : -1, i, this.tmpC);
        ctx.displace(e, this.tmpC);
      });
    }
  }

  /** Refraction and rings at the snap. */
  private layoutSnap(t: number) {
    const on = this.playing;
    const age = t - SNAP;
    const live = on && age >= 0;
    const p = clamp(age / 0.7, 0, 1);
    const e = 1 - Math.pow(1 - p, 3);
    const tip = this.toWorld(Math.max(t, SNAP), this.tmpB.set(11, 0.5, 0), this.tmpA);
    this.shockCam.set(tip, lerp(1, 10, e), live && age < 0.7 ? 0.06 * (1 - p) * (1 - p) : 0);
    this.shockGround.set(this.tmpD.copy(this.C).setY(0.05), lerp(1, 11, e), live && age < 0.7 ? 0.04 * (1 - p) * (1 - p) : 0);
    this.rings.forEach((r, k) => {
      const q = clamp((age - 0.05 * k) / (0.8 + 0.2 * k), 0, 1);
      r.mesh.position.set(this.C.x, 0.08 + k * 0.004, this.C.z);
      r.mesh.scale.setScalar(1 + 10 * (1 - Math.pow(1 - q, 3)));
      r.material.opacity = live && q < 1 ? 0.55 * (1 - q) : 0;
    });
  }

  private layoutScreen(t: number) {
    const on = this.playing;
    const scr = this.screen;
    const flash = on ? this.flashK(t) : 0;
    scr.darken = on ? 0.8 * ss(0, 1.0, t) * (1 - ss(14.0, 17.0, t)) * (1 - 0.85 * flash) : 0;
    // Underwater: dim the highlights too (the darken pass leaves bright mids alone), until the reveal card.
    scr.exposure = on ? 1 - 0.3 * ss(0, 1.0, t) * (1 - ss(6.6, 7.0, t)) * (1 - ss(14.0, 17.0, t)) : 1;
    // 7.0: a light cyan silhouette card of the whole fish (black shape on cyan); 8.6: the bite's dark then light frame.
    const card = impactFrameAt(t, FLASH, [2, 2, 2, 2], 0.045);
    scr.impact = on ? (card || impactFrameAt(t, SNAP, [1, 2], 0.04)) : 0;
    scr.silhouettes = on && t < SNAP - 0.5 ? [this.fish] : this.silFull;
    scr.chroma = on ? Math.max(chromaPulse(t, SNAP, 0.5, 8), chromaPulse(t, FLASH, 0.25, 12)) : 0;
    scr.speedLines = 0;
    scr.focus.copy(this.C).setY(3);
    let sh = 0;
    if (on) {
      if (t >= SNAP) sh = 0.8 * Math.exp(-(t - SNAP) * 5.5);
      else sh = 0.18 * ss(8.05, 8.5, t);
      if (t > 10.3 && t < 13.5) sh = Math.max(sh, 0.1);
    }
    this.shake = sh;
  }
}

export const abyssalAnglerModule: EffectModule = {
  label: 'abyssal angler',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 6 },
  create: () => new AbyssalAngler(),
  telegraphs(effect) {
    return (effect as AbyssalAngler).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as AbyssalAngler;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as AbyssalAngler).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1).name('damage');
  },
};
