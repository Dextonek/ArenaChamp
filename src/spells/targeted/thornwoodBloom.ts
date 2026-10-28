import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Thornwood Bloom (targeted, ground AoE r5): roots crack the ground in a spiral and leaves rustle up, then eight
 * thick thorned vines (tapered bark tubes with a toon shader skin, black thorn cones) burst up in spiral order and
 * arch over the area into a briar cage. Rose buds swell at the vine tips, hold one dead beat, and burst open into
 * crimson roses taller than the enemies: impact frames, a pale green star, petals and thorns spraying outward and
 * a ring of ground roses. Then the vines wither back into the earth and the petals settle.
 *
 * Recipes: c-ice-spikes-eruption (eruption in sequence), i-ice-cathedral-line-cone-eruption (spires rising in a
 * pattern), e-geodraws-crimson-pillar (spiral ribbons round a pillar).
 */
export interface ThornwoodBloomSettings {
  damage: number;
  loop: boolean;
}

export const defaultThornwoodBloom = (): ThornwoodBloomSettings => ({ damage: 50, loop: false });

const D = 2.05; // the roses burst
const DURATION = 4.8;
const VINES = 8;
const SEG = 56;
const RAD = 8;
const THORNS = 9;
const GROUND_ROSES = 5;
const SPRAY_PETALS = 52;
const SPRAY_THORNS = 36;
const RAD2DEG = Math.PI / 180;

const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);
const easeOutBack = (x: number) => {
  const k = clamp01(x) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// Rose / vine value ladder (design note): leaf, vine, rose crimson, bark dark.
const C_ROSE_DARK = new THREE.Color(0x7a1230);
const C_ROSE_MID = new THREE.Color(0xb81f3c);
const C_ROSE_TIP = new THREE.Color(0xe02a4a);
const C_ROSE_EDGE = new THREE.Color(0x2a0510);

/** Vine radius at u (0 root .. 1 tip): thick base, tapered tip, small knots. */
const vineRadius = (u: number) => (0.36 * (1 - 0.82 * Math.pow(u, 0.85)) + 0.035) * (1 + 0.12 * Math.sin(u * 38));

/** Centre-line of vine i relative to the cast point: out of the ground on the rim, arching over to the middle. */
function vineCurve(i: number): THREE.CatmullRomCurve3 {
  const a = (i / VINES) * Math.PI * 2 + Math.PI / 8;
  const hi = i % 2 ? 4.9 : 4.2;
  const pt = (r: number, da: number, y: number) => new THREE.Vector3(Math.sin(a + da) * r, y, Math.cos(a + da) * r);
  return new THREE.CatmullRomCurve3([
    pt(4.5, 0, -0.3), pt(5.0, 0.5, 2.2), pt(3.6, 1.1, 4.6), pt(2.1, 1.6, hi), pt(1.8, 1.85, hi + 0.5),
  ], false, 'centripetal');
}

interface ThornDef { u: number; offset: THREE.Vector3; q: THREE.Quaternion; size: number }

/** Tapered vine tube with centre / u / angle attributes so the vertex shader can grow and pinch it. */
function vineGeometry(curve: THREE.CatmullRomCurve3, thorns: ThornDef[]): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(SEG, false);
  const pos: number[] = [], ctr: number[] = [], nor: number[] = [], uu: number[] = [], an: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG;
    curve.getPoint(u, p);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= RAD; j++) {
      const ang = (j / RAD) * Math.PI * 2;
      d.copy(N).multiplyScalar(Math.cos(ang)).addScaledVector(B, Math.sin(ang));
      const r = vineRadius(u);
      pos.push(p.x + d.x * r, p.y + d.y * r, p.z + d.z * r);
      ctr.push(p.x, p.y, p.z);
      nor.push(d.x, d.y, d.z);
      uu.push(u);
      an.push(ang);
    }
  }
  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < RAD; j++) {
      const a = i * (RAD + 1) + j, b = a + RAD + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('ctr', new THREE.Float32BufferAttribute(ctr, 3));
  g.setAttribute('nrm', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uu', new THREE.Float32BufferAttribute(uu, 1));
  g.setAttribute('ang', new THREE.Float32BufferAttribute(an, 1));
  g.setIndex(idx);

  // Thorn placements along the same frames: spiral round the vine, pointing outward and back toward the root.
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < THORNS; k++) {
    const u = 0.1 + (k / (THORNS - 1)) * 0.82;
    const fi = Math.round(u * SEG);
    const ang = k * 2.4;
    const dir = new THREE.Vector3()
      .copy(frames.normals[fi]).multiplyScalar(Math.cos(ang)).addScaledVector(frames.binormals[fi], Math.sin(ang));
    const base = curve.getPoint(u).addScaledVector(dir, vineRadius(u) * 0.8);
    dir.multiplyScalar(0.92).addScaledVector(frames.tangents[fi], -0.4).normalize();
    thorns.push({
      u, offset: base, q: new THREE.Quaternion().setFromUnitVectors(up, dir), size: 1.25 - 0.5 * u + (k % 3) * 0.12,
    });
  }
  return g;
}

/** Bark skin: hard toon bands, ridges, moss and leaf-green highlights on the lit side; dries to grey-brown. */
function vineMaterial(dry: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uGrow: { value: 0 }, uDry: dry,
      uBark: { value: new THREE.Color(0x140c06) }, uBarkLit: { value: new THREE.Color(0x33200f) },
      uMoss: { value: new THREE.Color(0x2f6a2a) }, uLeaf: { value: new THREE.Color(0x4f9a32) },
      uDryA: { value: new THREE.Color(0x2b241c) }, uDryB: { value: new THREE.Color(0x120e0a) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 ctr; attribute vec3 nrm; attribute float uu; attribute float ang;
      uniform float uGrow;
      varying vec3 vN; varying float vU; varying float vA;
      void main() {
        // Rings behind the growing tip keep their radius, the ring at the tip pinches shut, the rest collapse.
        float k = clamp((uGrow - uu) / 0.05, 0.0, 1.0);
        vec3 p = ctr + (position - ctr) * k;
        vN = normalize(mat3(modelMatrix) * nrm);
        vU = uu; vA = ang;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDry;
      uniform vec3 uBark, uBarkLit, uMoss, uLeaf, uDryA, uDryB;
      varying vec3 vN; varying float vU; varying float vA;
      void main() {
        float lit = dot(normalize(vN), normalize(vec3(-0.35, 0.85, 0.45)));
        float ridge = sin(vA * 3.0 + vU * 7.0 + sin(vU * 21.0) * 1.3);
        vec3 col = lit > 0.2 ? uBarkLit : uBark;
        if (ridge > 0.6) col = uBark;
        float mossy = sin(vU * 31.0 + vA * 1.5);
        if (uDry < 0.5) {
          if (lit > 0.5 && mossy > -0.2) col = uMoss;
          if (lit > 0.82 && mossy > 0.45) col = uLeaf;
        }
        vec3 dryCol = (lit > 0.3 && ridge < 0.6) ? uDryA : uDryB;
        gl_FragColor = vec4(mix(col, dryCol, uDry), 1.0);
      }`,
  });
}

/** Round rose petal half-width at height s (length 1). */
const roseWidth = (s: number) => 0.46 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(s, 0.6))), 0.45);
const roseCurl = (y: number) => -0.28 * y * y;

function roseColor(s: number, out: THREE.Color) {
  return s < 0.5
    ? out.copy(C_ROSE_DARK).lerp(C_ROSE_MID, s / 0.5)
    : out.copy(C_ROSE_MID).lerp(C_ROSE_TIP, clamp01((s - 0.5) / 0.5));
}

/** Flat-shaded rose petal, length 1 along +Y: crimson body in stripes, a dark edge band, cupped inward. */
function rosePetalGeometry(): THREE.BufferGeometry {
  const S = 6;
  const pos: number[] = [], col: number[] = [];
  const push = (x: number, y: number, c: THREE.Color, sh: number) => {
    pos.push(x, y, roseCurl(y));
    col.push(c.r * sh, c.g * sh, c.b * sh);
  };
  const c0 = new THREE.Color(), c1 = new THREE.Color();
  for (let i = 0; i < S; i++) {
    const y0 = i / S, y1 = (i + 1) / S;
    const w0 = roseWidth(y0), w1 = roseWidth(y1);
    roseColor(y0, c0); roseColor(y1, c1);
    for (const side of [-1, 1]) {
      const sh = (side < 0 ? 0.78 : 1) * (i % 2 ? 0.94 : 1);
      push(0, y0, c0, sh * 0.9); push(side * 0.84 * w0, y0, c0, sh); push(side * 0.84 * w1, y1, c1, sh);
      push(0, y0, c0, sh * 0.9); push(side * 0.84 * w1, y1, c1, sh); push(0, y1, c1, sh * 0.9);
      push(side * 0.84 * w0, y0, C_ROSE_EDGE, sh); push(side * w0, y0, C_ROSE_EDGE, sh); push(side * w1, y1, C_ROSE_EDGE, sh);
      push(side * 0.84 * w0, y0, C_ROSE_EDGE, sh); push(side * w1, y1, C_ROSE_EDGE, sh); push(side * 0.84 * w1, y1, C_ROSE_EDGE, sh);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Root cracks: eight spiralling dark lines with side roots, dark green edge. */
function rootTexture(): THREE.CanvasTexture {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const g = cv.getContext('2d');
  if (g) {
    g.translate(size / 2, size / 2);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath(); g.arc(0, 0, size * 0.2, 0, Math.PI * 2);
    g.fillStyle = 'rgba(6,3,2,0.45)'; g.fill();
    const lines: number[][][] = [];
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2;
      const main: number[][] = [];
      for (let s = 0; s <= 24; s++) {
        const r = 12 + (s / 24) * (size * 0.47);
        const a = a0 + (s / 24) * 1.3 + Math.sin(s * 1.7 + k) * 0.05;
        main.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      lines.push(main);
      for (let b = 4; b < 22; b += 5) {
        const [x, y] = main[b];
        const dir = Math.atan2(y, x) + (b % 2 ? 0.9 : -0.9);
        lines.push([[x, y], [x + Math.cos(dir) * 36, y + Math.sin(dir) * 36], [x + Math.cos(dir + 0.4) * 70, y + Math.sin(dir + 0.4) * 70]]);
      }
    }
    const stroke = (w: number, style: string) => {
      g.strokeStyle = style; g.lineWidth = w;
      for (const l of lines) {
        g.beginPath();
        l.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
      }
    };
    stroke(13, '#1b3a14');
    stroke(7, '#050302');
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface RosePetal { yaw: THREE.Group; pivot: THREE.Group; body: THREE.Mesh; tier: number; idx: number }

/** A rose: three tiers of cupped petals that open from a bud. Origin at the base, opens toward +Y. */
class Rose {
  readonly group = new THREE.Group();
  private petals: RosePetal[] = [];

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material) {
    const tiers = [6, 5, 3];
    tiers.forEach((n, tier) => {
      for (let i = 0; i < n; i++) {
        const yaw = new THREE.Group();
        yaw.rotation.y = ((i + tier * 0.5) / n) * Math.PI * 2;
        const pivot = new THREE.Group();
        const body = new THREE.Mesh(geo, mat);
        pivot.add(body);
        yaw.add(pivot);
        this.group.add(yaw);
        this.petals.push({ yaw, pivot, body, tier, idx: i });
      }
    });
    this.group.visible = false;
  }

  /** open 0..1 (may overshoot), size = overall scale (rose radius ~1.1 at 1). */
  set(open: number, size: number) {
    this.group.visible = size > 0.02;
    const L = [1.4, 1.1, 0.8];
    const closed = [8, 4, 1].map((a) => a * RAD2DEG);
    const opened = [38, 24, 8].map((a) => a * RAD2DEG);
    const r0 = [0.18, 0.1, 0.04];
    for (const p of this.petals) {
      const o = open * 1.15 - 0.15 * (p.idx % 2);
      p.pivot.position.z = r0[p.tier];
      p.pivot.rotation.x = THREE.MathUtils.lerp(closed[p.tier], opened[p.tier], Math.min(1.12, Math.max(0, o)));
      const len = Math.max(1e-3, L[p.tier]);
      p.body.scale.set(len, len, len);
    }
    this.group.scale.setScalar(Math.max(1e-3, size));
  }
}

interface Flyer {
  p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; size: number; age: number; live: boolean;
}

const newFlyers = (n: number): Flyer[] => Array.from({ length: n }, () => ({
  p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(),
  size: 1, age: 0, live: false,
}));

interface Vine {
  curve: THREE.CatmullRomCurve3;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  thorns: ThornDef[];
  start: number;
  grow: number;
  dusted: boolean;
}

export class ThornwoodBloom implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThornwoodBloomSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private ticked = [false, false];
  private burstDone = false;
  private smokeDone = false;
  private c = new THREE.Vector3();
  private tilt = new THREE.Quaternion();

  private dry = { value: 0 };
  private vines: Vine[] = [];
  private thornMesh: THREE.InstancedMesh;
  private tipRoses: Rose[] = [];
  private groundRoses: Rose[] = [];
  private roseMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

  private rootMat: THREE.ShaderMaterial;
  private roots: THREE.Mesh;
  private shock = createRing(0xe02a4a, 0.9, 1, 96);
  private star = new StarBurst({ points: 8, inner: 0.3, color: 0x7ad04a, core: 0xe8ffd8, additive: false });
  private smoke = new SmokeBall({ color: 0x0c0804, rim: 0x2f6a2a, flake: 0x140c06, maxBalls: 5 });

  private sprayPetals: THREE.InstancedMesh;
  private sprayThorns: THREE.InstancedMesh;
  private petalState = newFlyers(SPRAY_PETALS);
  private thornState = newFlyers(SPRAY_THORNS);
  private leaves: Emitter;
  private dust: Emitter;
  private petalsFx: Emitter;
  private motes: Emitter;

  constructor(settings: ThornwoodBloomSettings = defaultThornwoodBloom()) {
    this.settings = settings;
    this.screen.tint.set(0x1c3a22);
    this.screen.impactColor.set(0xe02a4a);
    this.screen.speedLineColor.set(0xe8ffd8);
    this.screen.edgeTint.set(0xe02a4a);

    // Roots on the ground (revealed in a spiral from the middle).
    this.rootMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { map: { value: rootTexture() }, uReveal: { value: 0 }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform float uReveal; uniform float uFade;
        varying vec2 vUv;
        void main() {
          vec2 d = vUv - 0.5;
          float r = length(d) * 2.0;
          float a = atan(d.y, d.x) / 6.2832 + 0.5;
          float m = step(r * 0.8 + a * 0.25, uReveal * 1.05);
          vec4 t = texture2D(map, vUv);
          gl_FragColor = vec4(t.rgb, t.a * m * uFade);
        }`,
    });
    this.roots = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), this.rootMat);
    this.roots.rotation.x = -Math.PI / 2;
    this.roots.position.y = 0.035;
    this.shock.mesh.position.y = 0.07;
    this.group.add(this.roots, this.shock.mesh);

    // Vines and their thorns.
    const thornGeo = new THREE.ConeGeometry(0.09, 0.5, 5);
    thornGeo.translate(0, 0.25, 0);
    const thornMat = new THREE.MeshBasicMaterial({ color: 0x0b0704 });
    this.thornMesh = new THREE.InstancedMesh(thornGeo, thornMat, VINES * THORNS);
    this.thornMesh.frustumCulled = false;
    for (let i = 0; i < VINES; i++) {
      const curve = vineCurve(i);
      const thorns: ThornDef[] = [];
      const mat = vineMaterial(this.dry);
      const mesh = new THREE.Mesh(vineGeometry(curve, thorns), mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.group.add(mesh);
      this.vines.push({ curve, mesh, mat, thorns, start: 0.6 + i * 0.07, grow: 0, dusted: false });
    }
    this.group.add(this.thornMesh);

    // Roses.
    const petalGeo = rosePetalGeometry();
    for (let i = 0; i < VINES; i++) {
      const r = new Rose(petalGeo, this.roseMat);
      this.tipRoses.push(r);
      this.group.add(r.group);
    }
    for (let i = 0; i < GROUND_ROSES; i++) {
      const r = new Rose(petalGeo, this.roseMat);
      this.groundRoses.push(r);
      this.group.add(r.group);
    }

    // Spray of petals and thorns at the burst.
    this.sprayPetals = new THREE.InstancedMesh(petalGeo, this.roseMat, SPRAY_PETALS);
    this.sprayThorns = new THREE.InstancedMesh(thornGeo, thornMat, SPRAY_THORNS);
    this.sprayPetals.frustumCulled = false;
    this.sprayThorns.frustumCulled = false;
    this.group.add(this.sprayPetals, this.sprayThorns, this.star.mesh, this.smoke.mesh);

    this.leaves = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 3.6, speedJitter: 0.6, spread: 45, gravity: 2.5, drag: 0.8,
      sizeStart: 0.3, sizeEnd: 0.18, colorStart: '#7ad04a', colorEnd: '#2f6a2a',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0, spin: 1.5,
    });
    // Small, short bark dust where a vine breaks the ground.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.35, speed: 2.4, speedJitter: 0.6, spread: 70, gravity: 1, drag: 1.6,
      sizeStart: 0.35, sizeEnd: 0.7, colorStart: '#2a1a0c', colorEnd: '#140c06',
      opacityStart: 0.4, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.4, groundFade: 0.3,
    });
    this.petalsFx = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 6.5, speedJitter: 0.6, spread: 140, gravity: 1.8, drag: 1.3,
      sizeStart: 0.24, sizeEnd: 0.16, colorStart: '#e02a4a', colorEnd: '#5a0a1c', colorMid: '#b81f3c',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0, spin: 1.8, groundFade: 0.2,
    });
    // Tiny pale green motes, the only bright specks.
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 9, speedJitter: 0.6, spread: 110, gravity: 6, drag: 1.6,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#e8ffd8', colorEnd: '#7ad04a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.leaves, this.dust, this.petalsFx, this.motes, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.c.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.c).setY(2.2);
    for (const v of this.vines) v.mesh.position.copy(this.c);
    this.roots.position.set(this.c.x, 0.035, this.c.z);
    // Roses lean 30 degrees toward the caster so their cups read from the gameplay camera.
    const toCaster = new THREE.Vector3(ctx.from.x - this.c.x, 0, ctx.from.z - this.c.z);
    if (toCaster.lengthSq() < 1e-4) toCaster.set(0, 0, 1);
    toCaster.normalize();
    const dir = new THREE.Vector3(0, Math.cos(30 * RAD2DEG), 0).addScaledVector(toCaster, Math.sin(30 * RAD2DEG));
    this.tilt.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.ticked = [false, false];
    this.burstDone = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const f of [...this.petalState, ...this.thornState]) { f.live = false; f.p.set(0, -50, 0); }
    for (const v of this.vines) v.dusted = false;
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    const ctx = this.ctx;
    const t = this.time;
    const c = this.c;
    if (ctx) {
      [0.95, 1.35].forEach((tt, i) => {
        if (!this.ticked[i] && t >= tt) {
          this.ticked[i] = true;
          for (const e of ctx.targets) ctx.hit(e, { damage: 6, knock: 0, from: c });
        }
      });
    }
    for (const v of this.vines) {
      if (!v.dusted && t >= v.start) {
        v.dusted = true;
        const p = v.curve.getPoint(0);
        this.dust.burst(34, new THREE.Vector3(c.x + p.x, 0.1, c.z + p.z));
      }
    }
    // Leaves rustle up around the rim while the roots crack and the vines rise.
    if (dt > 0 && t > 0.1 && t < 1.6) {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 3.5;
        this.leaves.burst(1, new THREE.Vector3(c.x + Math.sin(a) * r, 0.1, c.z + Math.cos(a) * r));
      }
    }
    if (!this.burstDone && t >= D) this.onBurst();
    if (!this.smokeDone && t >= D + 0.12) this.onSmoke();
    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const c = this.c;
    const bursted = t >= D;
    const fade = 1 - smoothstep((t - (DURATION - 0.7)) / 0.7);

    // --- World grade: dim green-dark for the build, release after the burst. ---
    this.screen.darken = !bursted
      ? 0.55 * smoothstep(t / 0.5)
      : 0.55 * Math.exp(-after * 1.4) * fade;

    // --- Roots crack the ground in a spiral; they fade last. ---
    this.rootMat.uniforms.uReveal.value = smoothstep(t / 0.7);
    this.rootMat.uniforms.uFade.value = 0.9 * fade;
    this.roots.visible = t > 0.01;

    // --- Vines: burst up in spiral order, arch into a cage, wither back into the earth after the burst. ---
    this.dry.value = smoothstep((t - 2.2) / 0.9);
    const m = new THREE.Matrix4();
    const sc = new THREE.Vector3();
    const wp = new THREE.Vector3();
    this.vines.forEach((v, i) => {
      const raw = clamp01((t - v.start) / 0.5);
      const wither = smoothstep((t - 2.5 - i * 0.03) / 1.1);
      v.grow = easeOut(raw) * (1 - wither);
      v.mat.uniforms.uGrow.value = v.grow;
      v.mesh.visible = v.grow > 0.002;
      v.thorns.forEach((th, k) => {
        const s = v.mesh.visible ? th.size * clamp01((v.grow - th.u) / 0.06) : 0;
        wp.copy(th.offset).add(c);
        m.compose(wp, th.q, sc.setScalar(Math.max(1e-4, s)));
        this.thornMesh.setMatrixAt(i * THORNS + k, m);
      });

      // Rose at the vine tip: a bud that swells and beats, then bursts open.
      const rose = this.tipRoses[i];
      const sprout = smoothstep((raw - 0.8) / 0.2);
      const swell = smoothstep((t - 1.55) / 0.45);
      const beat = t > 1.8 && t < D ? 0.08 * Math.sin((t - 1.8) * 30) : 0;
      const bud = (0.1 + 0.42 * swell) * sprout * (1 + beat);
      const bloom = bursted ? easeOutBack(after / 0.3) : 0;
      const gone = 1 - smoothstep((t - 3.2) / 1.0);
      const size = THREE.MathUtils.lerp(bud, 1, clamp01(bloom)) * gone;
      rose.group.position.copy(v.curve.getPoint(clamp01(v.grow))).add(c);
      rose.group.quaternion.copy(this.tilt).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.8));
      rose.set(bloom, v.grow > 0.01 && sprout > 0 ? size : 0);
    });
    this.thornMesh.instanceMatrix.needsUpdate = true;
    this.roseMat.color.setScalar(1 - 0.45 * this.dry.value);

    // --- Ground roses: the cage becomes a garden. ---
    this.groundRoses.forEach((r, j) => {
      const start = D + 0.2 + j * 0.05;
      const k = clamp01((t - start) / 0.35);
      const a = (j / GROUND_ROSES) * Math.PI * 2 + 0.3;
      const gone = 1 - smoothstep((t - 3.4) / 0.9);
      r.group.position.set(c.x + Math.sin(a) * 3.2, 0.05, c.z + Math.cos(a) * 3.2);
      r.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), j * 1.3);
      r.set(easeOutBack(k), t > start ? THREE.MathUtils.lerp(0.1, 0.75, easeOut(k)) * gone : 0);
    });

    // --- Burst: ring, pale green star, screen beat. ---
    if (bursted) {
      const hot = StarBurst.pop(after, 0.07, 0.2);
      this.star.set(new THREE.Vector3(c.x, 2.6, c.z), 6 * hot.scale, hot.opacity, 0.2);
      this.shock.mesh.position.set(c.x, 0.07, c.z);
      this.shock.mesh.scale.setScalar(Math.max(1e-3, 1 + after * 11));
      this.shock.material.opacity = Math.max(0, 0.6 * (1 - after / 0.5));
      this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
      this.screen.chroma = chromaPulse(t, D, 0.6);
      this.screen.speedLines = Math.max(0, 0.7 - after * 5);
      this.shake = 0.8 * Math.exp(-after * 6);
    } else {
      this.star.set(c, 0, 0);
      this.shock.material.opacity = 0;
      this.screen.impact = 0;
      this.screen.chroma = 0;
      // Implode: focus lines pull in over the dead beat.
      this.screen.speedLines = t > 1.7 ? 0.7 * smoothstep((t - 1.7) / 0.35) : 0;
      this.shake = t > 0.6 && t < 1.6 ? 0.05 : t > 1.7 ? 0.03 : 0;
    }

    // --- Flying petals and thorns: tumble, land, shrink away. ---
    const q = new THREE.Quaternion();
    this.stepFlyers(this.petalState, this.sprayPetals, dt, 1 - smoothstep((t - 3.6) / 0.9), 11, q, m, sc);
    this.stepFlyers(this.thornState, this.sprayThorns, dt, 1, 16, q, m, sc);
  }

  private stepFlyers(
    list: Flyer[], mesh: THREE.InstancedMesh, dt: number, fade: number, grav: number,
    q: THREE.Quaternion, m: THREE.Matrix4, sc: THREE.Vector3,
  ) {
    const thorn = mesh === this.sprayThorns;
    list.forEach((f, i) => {
      if (f.live && dt > 0) {
        f.age += dt;
        f.v.y -= grav * dt;
        f.v.x *= 1 - 1.0 * dt; f.v.z *= 1 - 1.0 * dt;
        f.p.addScaledVector(f.v, dt);
        if (f.p.y < 0.08) { f.p.y = 0.08; f.v.set(0, 0, 0); f.w.set(0, 0, 0); }
        f.r.set(f.r.x + f.w.x * dt, f.r.y + f.w.y * dt, f.r.z + f.w.z * dt);
      }
      // Thorns vanish quickly; petals settle and stay until the exit.
      const life = thorn ? 1 - smoothstep((f.age - 0.7) / 0.5) : 1;
      const s = f.live ? Math.max(1e-4, f.size * life * fade) : 1e-4;
      m.compose(f.p, q.setFromEuler(f.r), sc.setScalar(s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  private onBurst() {
    this.burstDone = true;
    const c = this.c;
    const origins = [...this.tipRoses, ...this.groundRoses].map((r) => r.group.position.clone());
    this.petalsFx.burst(130, new THREE.Vector3(c.x, 3.4, c.z));
    this.motes.burst(110, new THREE.Vector3(c.x, 2.6, c.z));
    this.dust.burst(40, new THREE.Vector3(c.x, 0.3, c.z));
    this.petalState.forEach((f, i) => {
      const o = origins[i % origins.length];
      const dx = o.x - c.x, dz = o.z - c.z;
      const len = Math.hypot(dx, dz);
      const ox = len > 1e-3 ? dx / len : Math.random() - 0.5, oz = len > 1e-3 ? dz / len : Math.random() - 0.5;
      const sp = 3 + Math.random() * 5;
      f.p.copy(o).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6));
      f.v.set(ox * sp + (Math.random() - 0.5) * 3, 3 + Math.random() * 5, oz * sp + (Math.random() - 0.5) * 3);
      f.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      f.w.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
      f.size = 0.45 + Math.random() * 0.4;
      f.age = 0; f.live = true;
    });
    this.thornState.forEach((f, i) => {
      const o = origins[i % VINES];
      const a = Math.random() * Math.PI * 2;
      const sp = 7 + Math.random() * 7;
      f.p.copy(o);
      f.v.set(Math.sin(a) * sp, 2 + Math.random() * 7, Math.cos(a) * sp);
      f.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      f.w.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      f.size = 1.1 + Math.random() * 0.6;
      f.age = 0; f.live = true;
    });
    const ctx = this.ctx;
    if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 4, from: c });
  }

  private onSmoke() {
    this.smokeDone = true;
    const c = this.c;
    // A few small black puffs at the base of the cage.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      this.smoke.trigger(new THREE.Vector3(c.x + Math.sin(a) * 2.8, 0.6, c.z + Math.cos(a) * 2.8), 0.9, 0.7);
    }
  }
}

export const thornwoodBloomModule: EffectModule = {
  label: 'thornwood bloom',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 5 },
  create: () => new ThornwoodBloom(),
  telegraphs(effect) {
    const e = effect as ThornwoodBloom;
    const p = e.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: 5 }, start: 0.2, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as ThornwoodBloom;
    if (e.ctx) frameCast(camera, controls, e.ctx, 7);
  },
  buildGui(f, effect) {
    const s = (effect as ThornwoodBloom).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
