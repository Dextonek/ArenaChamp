import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, LightningArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, flashBeat, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * World Sever (targeted, one enemy): the Scarlet Sheath draw as a spell. The world drains to paper and red, a red sun
 * is painted behind the caster with one brush stroke while black ink arcs wheel round them. The blade leaves the
 * scabbard (a star at the hip, speed lines), ONE cut flashes through the target and far past it, and then nothing
 * moves: the cut hangs as a thin red line, dust holds in the air. The line opens into a tear (a long lens of burning
 * red-gold rims, dark inside, gold spikes, lightning crawling off the edges), the screen cracks, the hit lands, and
 * the screen shatters. The tear seals from both tips to the middle, black ink smoke rolls along the cut, red ink
 * splatters the ground and a red seal (斷) stamps beside the target.
 *
 * Palette row Blood with the showpiece's foils (ink `#151012`, paper `#ebe8e2`, gold `#d9a43c`).
 * Design note: pipeline/designs/world-sever.md.
 */
export interface WorldSeverSettings {
  damage: number;
  loop: boolean;
}

export const defaultWorldSever = (): WorldSeverSettings => ({ damage: 64, loop: false });

// Palette (Blood row + foils).
const CORE = 0xfff1e6;
const HOT = 0xff3b4e;
const BODY = 0x8c0f22;
const DARK = 0x140306;
const INK = 0x151012;
const GOLD = 0xffc247;

// Timeline (seconds).
const T_DRAW = 0.9;
const T_CUT = 1.15;
const T_FLASH = 1.2;
const T_STILL_END = 2.2;
const T_TEAR_FULL = 2.5;
const T_HIT = 2.5;
const T_SEAL_FROM = 2.95;
const T_SEAL_TO = 3.95;
const T_STAMP = 3.3;
const DURATION = 4.6;

// The tear: a lens HALF_L long each way and HALF_OPEN wide at the middle, lying on the ground.
const HALF_L = 4.6;
const HALF_OPEN = 1.0;
const CHEST = 1.1;
const TEAR_W = 4.0;
const CUT_W = 0.7;
const INK_ARCS = 9;
const SPIKES = 28;
const SPLATS = 16;
const SMOKES = 7;

const profile = (u: number) => HALF_OPEN * Math.pow(Math.max(0, 1 - u * u), 1.15);
const hash01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
`;
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/**
 * The tear, one quad in the ground plane. u runs -1..1 along the cut, the lens half-width is a rounded profile that
 * opens with `uOpen` and is eaten from both tips by `uExt`. Mode 0: the dark inside (normal blend). Mode 1: the
 * burning rims as hard cel bands, gold inside, cream edge line, red, dark red outside (additive).
 */
const LENS_FRAG = /* glsl */ `
  uniform float uOpen, uExt, uTime, uOp, uMode, uHalfOpen, uHalfW;
  uniform vec3 uC0, uC1, uC2, uC3, uC4;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    float u = vUv.x * 2.0 - 1.0;
    float w = (vUv.y * 2.0 - 1.0) * uHalfW;
    float side = w < 0.0 ? -1.0 : 1.0;
    float prof = uHalfOpen * uOpen * pow(max(0.0, 1.0 - u * u), 1.15);
    float jag = 1.0 + 0.16 * (noise(vec2(u * 7.0 + side * 5.0, uTime * 0.7)) - 0.5)
                    + 0.05 * (noise(vec2(u * 31.0 + side * 9.0, uTime * 2.0)) - 0.5);
    float h = prof * jag;
    float live = smoothstep(0.0, 0.08, uExt - abs(u)) * (1.0 - smoothstep(0.9, 1.0, abs(u)));
    float e = abs(w) - h;
    if (live <= 0.0) discard;
    if (uMode < 0.5) {
      if (e > 0.0) discard;
      float depth = clamp(-e / max(h, 0.05), 0.0, 1.0);
      vec3 col = mix(uC0, uC1, 0.35 * noise(vec2(u * 5.0 - uTime * 0.4, w * 3.0)) + 0.25 * (1.0 - depth));
      gl_FragColor = vec4(col, uOp * live * smoothstep(0.0, 0.06, -e));
      return;
    }
    float ee = e + 0.06 * noise(vec2(u * 24.0, w * 6.0 + uTime)) * step(0.0, e);
    vec3 col; float a;
    if (ee < -0.14) discard;
    else if (ee < -0.05) { col = uC2; a = 0.55; }
    else if (ee < 0.03) { col = uC1; a = 0.85; }
    else if (ee < 0.2) { col = uC3; a = 0.65; }
    else if (ee < 0.5) { col = uC4; a = 0.4 * (1.0 - (ee - 0.2) / 0.3); }
    else discard;
    gl_FragColor = vec4(col, a * uOp * live);
  }
`;

/** The cut: a long thin flat blade of light, drawn out from its start by `uHead`. */
const CUT_FRAG = /* glsl */ `
  uniform float uHead, uOp, uHalfW;
  uniform vec3 uCream, uRed, uDeep;
  varying vec2 vUv;
  void main() {
    float x = vUv.x;
    if (x > uHead) discard;
    float e = abs(vUv.y * 2.0 - 1.0) * uHalfW;
    vec3 col; float a;
    if (e < 0.03) { col = uCream; a = 0.95; }
    else if (e < 0.08) { col = uRed; a = 0.8; }
    else { col = uDeep; a = 0.35 * (1.0 - (e - 0.08) / (uHalfW - 0.08)); }
    a *= smoothstep(0.0, 0.04, x) * (1.0 - smoothstep(0.96, 1.0, x));
    gl_FragColor = vec4(col, a * uOp);
  }
`;

/** A vertical quad: long axis along local X, standing up along local Y (the cut direction and world up). */
function wallQuad(w: number, h: number): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(w, h);
}

/** The telegraph's dashed stand-in: thin dashes along the line, low opacity. */
const DASH_FRAG = /* glsl */ `
  uniform float uOp, uCount; uniform vec3 uColor; varying vec2 vUv;
  void main() {
    if (fract(vUv.x * uCount) > 0.55) discard;
    float e = abs(vUv.y * 2.0 - 1.0);
    gl_FragColor = vec4(uColor, uOp * (1.0 - smoothstep(0.5, 1.0, e)));
  }
`;

function groundQuad(w: number, d: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** The red sun disc: a deep red wash with a lighter middle and a fine halftone screen. */
function sunTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(100, 100, 8, 128, 128, 126);
  grad.addColorStop(0, '#ff3b4e');
  grad.addColorStop(0.65, '#a5162a');
  grad.addColorStop(1, '#3a0d0a');
  g.beginPath();
  g.arc(128, 128, 126, 0, Math.PI * 2);
  g.fillStyle = grad;
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = 'rgba(255,150,130,0.24)';
  for (let y = 4; y < 256; y += 9) {
    for (let x = ((y / 9) % 2) * 4.5 + 4; x < 256; x += 9) {
      const d = Math.hypot(x - 128, y - 128) / 126;
      g.beginPath();
      g.arc(x, y, 1.2 + 1.5 * (1 - d), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A red ink splatter: a ragged blob, a few beads round it and a sprinkle of halftone dots. */
function splatTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#a5162a';
  g.beginPath();
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 58 * (i % 2 ? 0.7 + 0.25 * hash01(i) : 1 + 0.35 * hash01(i + 40));
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.fillStyle = '#d9283c';
  g.beginPath();
  g.arc(116, 116, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#a5162a';
  for (let i = 0; i < 14; i++) {
    const a = hash01(i * 3.1) * Math.PI * 2, d = 72 + 44 * hash01(i * 5.7);
    g.beginPath();
    g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 3 + 7 * hash01(i * 9.3), 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(140,15,34,0.7)';
  for (let y = 10; y < 256; y += 12) {
    for (let x = ((y / 12) % 2) * 6 + 8; x < 256; x += 12) {
      const d = Math.hypot(x - 128, y - 128);
      if (d > 70 && d < 118 && hash01(x * 7 + y * 13) > 0.35) {
        g.beginPath();
        g.arc(x, y, 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The seal: a red square with a chewed edge and 斷 carved out in white, worn spots, and splashes round it. */
function sealTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const color = '#c51f26';
  const size = 172, h = size / 2;
  g.save();
  g.translate(128, 128);
  g.beginPath();
  const edge = (ax: number, ay: number, bx: number, by: number, k: number) => {
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, j = (hash01(k * 31 + i) - 0.5) * 7;
      const px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
      g.lineTo(px + (ay === by ? 0 : j), py + (ay === by ? j : 0));
    }
  };
  g.moveTo(-h, -h);
  edge(-h, -h, h, -h, 1); edge(h, -h, h, h, 2); edge(h, h, -h, h, 3); edge(-h, h, -h, -h, 4);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.fillStyle = '#f6efe6';
  g.font = `900 ${Math.round(size * 0.86)}px "Yu Mincho","Hiragino Mincho ProN","MS Mincho","Noto Serif JP",serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('斷', 0, size * 0.04);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = hash01(i * 2.3) < 0.6 ? color : 'rgba(246,239,230,0.75)';
    g.beginPath();
    g.arc((hash01(i * 4.1) - 0.5) * size, (hash01(i * 6.7) - 0.5) * size, 1 + 2.2 * hash01(i * 8.9), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  for (let i = 0; i < 16; i++) {
    const a = hash01(i * 1.7) * Math.PI * 2, d = 98 + 22 * hash01(i * 2.9);
    g.fillStyle = color;
    g.beginPath();
    g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1.5 + (i < 3 ? 5 : 3) * hash01(i * 3.3), 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class WorldSever implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WorldSeverSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The cut's ends on the ground (start beside the caster, end 6 m past the target); the telegraph reads them. */
  readonly cutA = new THREE.Vector3();
  readonly cutB = new THREE.Vector3();

  private time = 0;
  private cutDone = false;
  private hitDone = false;
  private stampDone = false;
  private smokeIdx = 0;

  // Cast geometry.
  private target = new THREE.Vector3();
  private dir = new THREE.Vector3(1, 0, 0); // along the cut
  private nrm = new THREE.Vector3(0, 0, 1); // across it, pointing away from the caster
  private center = new THREE.Vector3(); // centre of the tear
  private hip = new THREE.Vector3();
  private sunCenter = new THREE.Vector3();
  private sealAt = new THREE.Vector3();
  private cutLen = 10;
  private yaw = 0;
  private casterBaseY = 0;

  // The sun, billboarded behind the caster from whatever side the camera looks.
  private sun = new THREE.Group();
  private sunDisc: THREE.Mesh;
  private sunMat: THREE.MeshBasicMaterial;
  private sunRing = new CrescentArc({ radius: 1.8, width: 0.5, sweep: Math.PI * 1.96, style: 'toon', edge: 0xff6a4a, mid: 0xcf2a20, outer: 0x3a0d0a });
  private ink: CrescentArc[] = [];
  private inkPlanes: THREE.Group[] = [];
  private glint = new StarBurst({ points: 8, inner: 0.2, jitter: 0.2, color: HOT, core: CORE, additive: false });
  private hitStar = new StarBurst({ points: 12, color: HOT, core: CORE, additive: false });
  private hitGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: GOLD, core: CORE });
  private ring = createRing(HOT, 0.9, 1, 96);

  // Cut and tear.
  private cutGroup = new THREE.Group();
  private cutMat: THREE.ShaderMaterial;
  private dashMat: THREE.ShaderMaterial;
  private dash: THREE.Mesh;
  private tearGroup = new THREE.Group();
  private lensMats: THREE.ShaderMaterial[] = [];
  private bolts: LightningArc[] = [];
  private spikeMat = new THREE.MeshBasicMaterial({
    color: GOLD, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  private spikes: THREE.InstancedMesh;
  private spikeSeed = Array.from({ length: SPIKES }, (_, i) => ({
    u: (hash01(i * 1.3) - 0.5) * 1.5, side: i % 2 ? 1 : -1, len: 0.8 + 1.6 * hash01(i * 2.1), w: 0.16 + 0.14 * hash01(i * 3.7),
    delay: 0.12 * hash01(i * 4.3), wob: hash01(i * 5.9) - 0.5,
  }));

  // Ground marks.
  private splatTex = splatTexture();
  private splatMat = new THREE.MeshBasicMaterial({ map: this.splatTex, transparent: true, depthWrite: false });
  private splats: THREE.InstancedMesh;
  private splatSeed = Array.from({ length: SPLATS }, (_, i) => ({
    u: (hash01(i * 1.9) - 0.5) * 1.9, off: (hash01(i * 2.7) - 0.5) * 2.6, size: 0.5 + 1.1 * hash01(i * 3.1),
    rot: hash01(i * 4.9) * Math.PI * 2, delay: 0.55 + 0.05 * i,
  }));
  private sealTex = sealTexture();
  private sealMat = new THREE.MeshBasicMaterial({ map: this.sealTex, transparent: true, depthWrite: false, opacity: 0 });
  private sealMesh: THREE.Mesh;

  private smoke = new SmokeBall({ color: INK, rim: 0xc82a24, flake: '#151012', maxBalls: SMOKES + 1 });
  private motes: Emitter;
  private sparks: Emitter;
  private shards: Emitter;

  constructor(settings: WorldSeverSettings = defaultWorldSever()) {
    this.settings = settings;
    this.screen.tint.set(0x7a5a50);
    this.screen.keepHue.set(0xff2a3a);
    this.screen.impactColor.set(HOT);
    this.screen.speedLineColor.set(CORE);
    this.screen.whiteColor.set(CORE);
    this.screen.edgeTint.set(HOT);

    // The sun: a disc (fills after the stroke) and the brush ring, clockwise.
    this.sunMat = new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, depthWrite: false, opacity: 0 });
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), this.sunMat);
    // The CircleGeometry's uv spans the circle's bounding square, so the square texture maps straight on.
    this.sunRing.mesh.scale.x = -1;
    this.sunRing.mesh.position.z = 0.01;
    this.sun.add(this.sunDisc, this.sunRing.mesh);
    const pq = new THREE.Quaternion(), cq = new THREE.Quaternion(), cp = new THREE.Vector3(), dv = new THREE.Vector3();
    const face = (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
      this.sun.parent?.getWorldQuaternion(pq);
      camera.getWorldQuaternion(cq);
      this.sun.quaternion.copy(pq.invert().multiply(cq));
      // Pushed away from the camera along the view line, so it always sits behind the caster on screen.
      camera.getWorldPosition(cp);
      dv.copy(this.sunCenter).sub(cp);
      if (dv.lengthSq() > 1e-6) dv.normalize();
      this.sun.position.copy(this.sunCenter).addScaledVector(dv, 3.5);
      this.sun.updateMatrixWorld(true);
    };
    this.sunDisc.onBeforeRender = face;
    this.sunRing.mesh.onBeforeRender = face;
    this.sun.scale.setScalar(2.2);
    this.sun.visible = false;
    this.group.add(this.sun);

    // Ink arcs wheeling round the caster (thin black toon crescents with a red edge).
    for (let i = 0; i < INK_ARCS; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({
        radius: 1.5 + 0.35 * (i % 4), width: 0.16, sweep: Math.PI * 1.25, style: 'toon', edge: 0xd42a24, mid: INK, outer: INK,
      });
      plane.add(arc.mesh);
      this.ink.push(arc);
      this.inkPlanes.push(plane);
      this.group.add(plane);
    }

    this.group.add(this.glint.mesh, this.hitStar.mesh, this.hitGlint.mesh, this.ring.mesh);

    // The cut line.
    this.cutMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {
        uHead: { value: 0 }, uOp: { value: 0 }, uHalfW: { value: CUT_W / 2 },
        uCream: { value: new THREE.Color(CORE) }, uRed: { value: new THREE.Color(HOT) }, uDeep: { value: new THREE.Color(BODY) },
      },
      vertexShader: VERT, fragmentShader: CUT_FRAG,
    });
    // Two crossing planes (one upright, one flat) so the slash in the air reads from the side and from above.
    const cutWall = new THREE.Mesh(wallQuad(1, CUT_W), this.cutMat);
    const cutFlat = new THREE.Mesh(groundQuad(1, CUT_W), this.cutMat);
    cutWall.renderOrder = cutFlat.renderOrder = 3;
    this.cutGroup.add(cutWall, cutFlat);
    this.dashMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uOp: { value: 0 }, uCount: { value: 30 }, uColor: { value: new THREE.Color(HOT) } },
      vertexShader: VERT, fragmentShader: DASH_FRAG,
    });
    this.dash = new THREE.Mesh(groundQuad(1, 0.06), this.dashMat);
    this.dash.position.y = 0.07;
    this.dash.visible = false;
    this.group.add(this.dash);
    this.cutGroup.visible = false;
    this.group.add(this.cutGroup);

    // The tear: dark inside, then the burning rims.
    for (const mode of [0, 1]) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: mode === 0 ? THREE.NormalBlending : THREE.AdditiveBlending,
        uniforms: {
          uOpen: { value: 0 }, uExt: { value: 1 }, uTime: { value: 0 }, uOp: { value: 1 }, uMode: { value: mode },
          uHalfOpen: { value: HALF_OPEN }, uHalfW: { value: TEAR_W / 2 },
          uC0: { value: new THREE.Color(mode === 0 ? DARK : 0) },
          uC1: { value: new THREE.Color(mode === 0 ? 0x3a0a10 : CORE) },
          uC2: { value: new THREE.Color(GOLD) }, uC3: { value: new THREE.Color(HOT) }, uC4: { value: new THREE.Color(BODY) },
        },
        vertexShader: VERT, fragmentShader: LENS_FRAG,
      });
      const mesh = new THREE.Mesh(wallQuad(HALF_L * 2, TEAR_W), mat);
      mesh.position.z = mode === 0 ? 0 : 0.03;
      mesh.renderOrder = mode === 0 ? 1 : 2;
      this.tearGroup.add(mesh);
      this.lensMats.push(mat);
    }
    this.tearGroup.visible = false;
    this.group.add(this.tearGroup);

    for (let i = 0; i < 5; i++) {
      const b = new LightningArc({ width: 0.22, segments: 10, jitter: 0.14, branches: 2, core: CORE, glow: HOT });
      this.bolts.push(b);
      this.group.add(b.mesh);
    }

    // Gold spikes: thin flat triangles thrown off the rims.
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, 0, 1], 3));
    this.spikes = new THREE.InstancedMesh(tri, this.spikeMat, SPIKES);
    this.spikes.frustumCulled = false;
    this.spikes.renderOrder = 2;
    this.group.add(this.spikes);

    // Ink splatters and the seal on the ground.
    this.splats = new THREE.InstancedMesh(groundQuad(1, 1), this.splatMat, SPLATS);
    this.splats.frustumCulled = false;
    this.splats.renderOrder = 0;
    this.group.add(this.splats);
    this.sealMesh = new THREE.Mesh(groundQuad(3.6, 3.6), this.sealMat);
    this.sealMesh.rotation.y = Math.PI / 2 - 0.05; // the character's top points away from a side camera
    this.sealMesh.renderOrder = 1;
    this.sealMesh.visible = false;
    this.group.add(this.sealMesh);

    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 3.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.1, speed: 0.12, speedJitter: 0.8, spread: 180, gravity: -0.02, drag: 0.5,
      sizeStart: 0.08, sizeEnd: 0.04, colorStart: '#fff1e6', colorEnd: '#ffc247',
      opacityStart: 0.5, opacityEnd: 0, additive: true, sizeJitter: 0.5, erosion: 0,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1400, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.2, speed: 6, speedJitter: 0.6, spread: 90, gravity: 7, drag: 1.2,
      sizeStart: 0.11, sizeEnd: 0.02, colorStart: '#fff1e6', colorEnd: '#ff3b4e', colorMid: '#ffc247',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.shards = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 1.3, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 8, speedJitter: 0.6, spread: 100, gravity: 10, drag: 0.8,
      sizeStart: 0.26, sizeEnd: 0.06, colorStart: '#8c0f22', colorEnd: '#140306',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0, spin: 3,
    });
    this.emitters.push(this.motes, this.sparks, this.shards, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.group.add(this.smoke.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return T_HIT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    this.target.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    // The cut sweeps ACROSS the target, square to the caster's aim, 4.6 m each side of it: so the tear faces the camera
    // behind the caster (a cut along the aim line was seen edge-on from there, and the tear vanished).
    const toT = this.target.clone().sub(ctx.from).setY(0);
    const aimDir = toT.lengthSq() > 1e-4 ? toT.normalize() : fwd.clone();
    this.dir.set(aimDir.z, 0, -aimDir.x);
    this.cutA.copy(this.target).addScaledVector(this.dir, -4.6).setY(0);
    this.cutB.copy(this.target).addScaledVector(this.dir, 4.6).setY(0);
    this.cutLen = this.cutA.distanceTo(this.cutB);
    void right;
    this.nrm.set(-this.dir.z, 0, this.dir.x);
    if (this.nrm.dot(this.target.clone().sub(ctx.from)) < 0) this.nrm.negate();
    this.center.copy(this.target);
    this.yaw = Math.atan2(-this.dir.z, this.dir.x);
    this.sealAt.copy(this.target).addScaledVector(this.nrm, -3.0).setY(0.06);
    this.hip.copy(ctx.from).addScaledVector(right, 0.35).addScaledVector(fwd, 0.35).setY(1.0);
    this.sunCenter.copy(ctx.from).setY(3.0);
    this.casterBaseY = ctx.caster.group.position.y;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];

    this.cutGroup.position.copy(this.cutA).addScaledVector(this.dir, this.cutLen / 2);
    this.cutGroup.rotation.y = this.yaw;
    for (const c of this.cutGroup.children) c.scale.x = this.cutLen;
    this.cutGroup.position.y = CHEST;
    this.dash.position.set(this.cutGroup.position.x, 0.07, this.cutGroup.position.z);
    this.dash.rotation.y = this.yaw;
    this.dash.scale.x = this.cutLen;
    this.dashMat.uniforms.uCount.value = Math.max(6, Math.round(this.cutLen / 0.7));
    this.tearGroup.position.copy(this.center).setY(CHEST);
    this.tearGroup.rotation.y = this.yaw;
    for (let i = 0; i < INK_ARCS; i++) {
      const plane = this.inkPlanes[i];
      plane.position.copy(ctx.from).setY(1.3);
      plane.rotation.set(Math.PI / 2 + (i - 4) * 0.32, (i * Math.PI) / 4.5, 0);
    }
    this.sealMesh.position.copy(this.sealAt);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.cutDone = false;
    this.hitDone = false;
    this.stampDone = false;
    this.smokeIdx = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.motes.update(dt);
    this.sparks.update(dt);
    this.shards.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.time = DURATION;
      this.layout(0);
      return;
    }
    const t = this.time;
    if (!this.cutDone && t >= T_FLASH) this.onCut();
    if (!this.hitDone && t >= T_HIT) this.onHit();
    if (!this.stampDone && t >= T_STAMP) this.onStamp();
    while (this.smokeIdx < SMOKES && t >= T_HIT + 0.05 + this.smokeIdx * 0.18) {
      const u = -0.7 + (1.4 * this.smokeIdx) / (SMOKES - 1);
      this.smoke.trigger(this.center.clone().addScaledVector(this.dir, u * HALF_L).setY(0.5), 1.3, 1.5);
      this.smokeIdx++;
    }
    for (const b of this.bolts) b.update(dt);
    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    const s = this.screen;
    const after = t - T_HIT;
    const rel = 1 - smoothstep((t - (T_SEAL_TO - 0.05)) / 0.7);

    // --- 1. The screen: drained to warm paper with only red left, held until the aftermath releases it. ---
    const drain = smoothstep(t / T_DRAW);
    s.desaturate = 0.85 * drain * rel;
    s.darken = 0.3 * drain * rel;
    s.focus.copy(t < 1.5 ? this.hip : this.target).setY(t < 1.5 ? 1.0 : 1.2);
    s.speedLines = t < T_CUT
      ? 0.8 * smoothstep((t - T_DRAW) / 0.25)
      : Math.max(0, 0.8 - (t - T_CUT) * 8) + (after > 0 ? Math.max(0, 0.6 - after * 3) : 0);
    s.impact = impactFrameAt(t, T_FLASH, [1, 3, 2], 0.04) || impactFrameAt(t, T_HIT, [1, 2], 0.04);
    const fb = flashBeat(t, T_FLASH + 0.14);
    s.exposure = fb.exposure;
    s.whiteout = fb.whiteout;
    s.chroma = chromaPulse(t, T_HIT);
    s.crack = t < 3.2 ? smoothstep((t - 2.1) / 0.4) : 0;
    s.shatter = t >= T_HIT + 0.05 && t < 3.2 ? smoothstep((t - (T_HIT + 0.05)) / 0.6) : 0;

    // --- 2. The caster crouches for the draw. ---
    if (ctx) {
      const dip = 0.16 * smoothstep((t - 0.2) / 0.5) * (1 - smoothstep((t - T_DRAW) / 0.2));
      ctx.caster.group.position.y = this.casterBaseY - dip;
    }

    // --- 3. The red sun: one brush stroke clockwise, then the disc fills, then it burns down to a ring. ---
    const stroke = smoothstep((t - 0.05) / 0.75);
    const fillIn = smoothstep((t - 0.6) / 0.35);
    const burn = 1 - smoothstep((t - T_FLASH) / (T_STILL_END - T_FLASH));
    const ringFade = 1 - smoothstep((t - T_HIT) / 0.7);
    this.sun.visible = t > 0.04 && t < 3.3;
    this.sunMat.opacity = 0.92 * fillIn * burn * (t < T_HIT ? 1 : ringFade);
    this.sunDisc.visible = this.sunMat.opacity > 0.01;
    this.sunRing.head = stroke * 1.02;
    this.sunRing.length = 1;
    this.sunRing.time = t;
    this.sunRing.opacity = t > 0.04 ? 0.95 * (t < T_FLASH ? 1 : 0.6 + 0.4 * burn) * ringFade : 0;

    // --- 4. Ink arcs wheel round the caster until the draw, then break up. ---
    const inkOn = t < T_FLASH + 0.25;
    this.ink.forEach((arc, i) => {
      const cyc = (t * 0.9 + i * 0.113) % 1;
      arc.head = cyc * 1.3;
      arc.length = 0.45;
      arc.time = t;
      arc.erosion = smoothstep((t - T_FLASH) / 0.25);
      arc.opacity = inkOn ? 0.9 * smoothstep((t - 0.1 - i * 0.04) / 0.3) : 0;
      this.inkPlanes[i].rotation.z = t * (i % 2 ? 1.2 : -0.9);
    });

    // --- 5. The draw: a star at the hip as the blade leaves the scabbard. ---
    const g = StarBurst.pop(t - T_DRAW, 0.1, 0.12);
    this.glint.set(this.hip, 2.4 * g.scale, g.opacity, t * 3);

    // --- 6. The cut: one flash, then a thin red line held in the air. ---
    const head = smoothstep((t - T_CUT) / 0.08);
    const open = 1 - Math.pow(1 - smoothstep((t - T_STILL_END) / (T_TEAR_FULL - T_STILL_END)), 3);
    const cutFade = 1 - smoothstep((t - 2.3) / 0.6);
    this.cutGroup.visible = t >= T_CUT && cutFade > 0.002;
    this.dash.visible = t >= 0.1 && t < T_CUT;
    this.dashMat.uniforms.uOp.value = 0.3 * smoothstep((t - 0.1) / 0.3) * (1 - smoothstep((t - (T_CUT - 0.1)) / 0.1));
    this.cutMat.uniforms.uHead.value = head;
    this.cutMat.uniforms.uOp.value = (t < T_FLASH + 0.06 ? 1.1 : 0.75 + 0.1 * Math.sin(t * 9)) * cutFade;

    // --- 7. The tear opens along the cut, held, then seals from both tips to the middle. ---
    const ext = 1 - smoothstep((t - T_SEAL_FROM) / (T_SEAL_TO - T_SEAL_FROM));
    this.tearGroup.visible = t >= T_STILL_END - 0.05 && ext > 0.002;
    for (const m of this.lensMats) {
      m.uniforms.uOpen.value = open;
      m.uniforms.uExt.value = ext;
      m.uniforms.uTime.value = t;
      m.uniforms.uOp.value = 1;
    }
    this.layoutSpikes(t, open, ext);
    this.layoutBolts(t, open, ext);

    // --- 8. The hit: star, glint, ring, shake. ---
    const pop = StarBurst.pop(after - 0.02, 0.1, 0.2);
    const tp = new THREE.Vector3().copy(this.target).setY(1.2);
    this.hitStar.set(tp, 3.4 * pop.scale, pop.opacity, 0.3);
    const gp = StarBurst.pop(after - 0.08, 0.05, 0.25);
    this.hitGlint.set(tp.clone().setY(2.8), 1.1 * gp.scale, gp.opacity, t * 2);
    this.ring.mesh.position.copy(this.target).setY(0.09);
    this.ring.mesh.scale.setScalar(1 + Math.max(0, after) * 24);
    this.ring.material.opacity = after > 0 ? Math.max(0, 0.7 * (1 - after / 0.5)) : 0;
    this.shake = after > 0 ? 0.8 * Math.exp(-after * 7) : 0;
    if (this.stampDone) this.shake = Math.max(this.shake, 0.2 * Math.exp(-(t - T_STAMP) * 12));

    // --- 9. Ground: red ink splatters and the seal. ---
    this.layoutSplats(t);
    const st = t - T_STAMP;
    const sealFade = 1 - smoothstep((t - 4.0) / 0.6);
    this.sealMesh.visible = st >= 0 && sealFade > 0.002;
    if (this.sealMesh.visible) {
      const k = Math.min(1, st / 0.18);
      this.sealMesh.scale.setScalar(Math.max(1e-3, 1 + 0.6 * (1 - k) * (1 - k)));
      this.sealMat.opacity = Math.min(1, st * 10) * sealFade;
    }

    // --- 10. Sparks at the two closing points as the tear seals. ---
    if (dt > 0 && t > T_SEAL_FROM && ext > 0.01) {
      for (const sgn of [-1, 1]) {
        this.sparks.burst(4, this.center.clone().addScaledVector(this.dir, sgn * ext * HALF_L).setY(CHEST));
      }
    }
  }

  private layoutSpikes(t: number, open: number, ext: number) {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3(), dv = new THREE.Vector3(), up = new THREE.Vector3(), x = new THREE.Vector3(), z = new THREE.Vector3();
    const hide = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4);
    for (let i = 0; i < SPIKES; i++) {
      const sp = this.spikeSeed[i];
      const grow = smoothstep((t - T_STILL_END - sp.delay) / 0.3);
      const decay = 1 - smoothstep((t - 2.6 - sp.delay) / 0.8);
      const mask = smoothstep((ext - Math.abs(sp.u)) / 0.15);
      const k = grow * decay * mask;
      if (k < 0.01 || open < 0.01) { this.spikes.setMatrixAt(i, hide); continue; }
      p.copy(this.center).addScaledVector(this.dir, sp.u * HALF_L).setY(CHEST + sp.side * profile(sp.u) * open);
      dv.copy(this.nrm).multiplyScalar(Math.sin(0.45) * (sp.wob > 0 ? 1 : -1)).addScaledVector(this.dir, sp.wob * 0.7).setY(sp.side * Math.cos(0.45)).normalize();
      up.crossVectors(dv, this.dir);
      if (up.lengthSq() < 1e-6) up.set(0, 1, 0);
      up.normalize();
      x.copy(this.dir).multiplyScalar(sp.w * (0.6 + 0.4 * k));
      z.copy(dv).multiplyScalar(sp.len * k);
      m.makeBasis(x, up, z).setPosition(p);
      this.spikes.setMatrixAt(i, m);
    }
    this.spikes.instanceMatrix.needsUpdate = true;
    this.spikeMat.opacity = 0.8;
  }

  private layoutBolts(t: number, open: number, ext: number) {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const on = t > T_STILL_END + 0.05 && t < T_SEAL_TO && open > 0.2;
    this.bolts.forEach((bolt, i) => {
      if (!on) { bolt.opacity = 0; return; }
      // A new crawl every tenth of a second, deterministic from the slot.
      const slot = Math.floor(t * 10) * 13 + i * 7;
      const u = (hash01(slot) - 0.5) * 1.6 * ext;
      const side = hash01(slot + 3.3) < 0.5 ? -1 : 1;
      a.copy(this.center).addScaledVector(this.dir, u * HALF_L).setY(CHEST + side * profile(u) * open);
      b.copy(a).addScaledVector(this.dir, (hash01(slot + 8.2) - 0.5) * 2.4).addScaledVector(this.nrm, (hash01(slot + 1.7) - 0.5) * 1.2);
      b.y = a.y + side * (1.2 + 1.4 * hash01(slot + 5.1));
      bolt.setEnds(a, b);
      bolt.opacity = 0.9 * smoothstep((ext - Math.abs(u)) / 0.2);
    });
  }

  private layoutSplats(t: number) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const fade = 1 - smoothstep((t - 3.7) / 0.9);
    for (let i = 0; i < SPLATS; i++) {
      const sp = this.splatSeed[i];
      const k = Math.min(1, Math.max(0, (t - T_HIT - sp.delay + 0.5) / 0.14));
      const pop = k <= 0 ? 0 : 1 - Math.pow(1 - k, 3);
      p.copy(this.center).addScaledVector(this.dir, sp.u * HALF_L).addScaledVector(this.nrm, sp.off).setY(0.05);
      q.setFromAxisAngle(up, sp.rot);
      sc.setScalar(Math.max(1e-4, sp.size * pop));
      m.compose(p, q, sc);
      this.splats.setMatrixAt(i, m);
    }
    this.splats.instanceMatrix.needsUpdate = true;
    this.splatMat.opacity = 0.92 * fade;
    this.splats.visible = t > T_HIT && fade > 0.002;
  }

  /** The cut flash: dust hangs in the air along the line while everything holds still. */
  private onCut() {
    this.cutDone = true;
    const p = new THREE.Vector3();
    for (let i = 0; i < 70; i++) {
      p.copy(this.cutA).lerp(this.cutB, Math.random());
      p.x += (Math.random() - 0.5) * 1.2;
      p.z += (Math.random() - 0.5) * 1.2;
      p.y = 0.2 + Math.random() * 1.8;
      this.motes.burst(1, p);
    }
  }

  private onHit() {
    this.hitDone = true;
    const tp = this.target.clone().setY(1.0);
    this.sparks.burst(260, tp);
    const p = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      p.copy(this.center).addScaledVector(this.dir, (Math.random() - 0.5) * 1.6 * HALF_L).setY(CHEST);
      this.shards.burst(8, p);
    }
    const ctx = this.ctx;
    if (!ctx) return;
    const enemy = ctx.targets[0];
    if (!enemy) return;
    // The source sits on the caster's side of the cut, so the knock runs along the cut's normal.
    const from = this.target.clone().addScaledVector(this.nrm, -2);
    ctx.hit(enemy, { damage: this.settings.damage, knock: 2.5, from, color: '#ff3b4e' });
  }

  /** The seal lands: a few red specks thrown off. */
  private onStamp() {
    this.stampDone = true;
    this.sparks.burst(40, this.sealAt.clone().setY(0.3));
  }
}

export const worldSeverModule: EffectModule = {
  label: 'world sever',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new WorldSever(),
  telegraphs(effect) {
    const e = effect as WorldSever;
    if (!e.ctx) return [];
    return [{
      shape: { kind: 'line', x1: e.cutA.x, z1: e.cutA.z, x2: e.cutB.x, z2: e.cutB.z, width: 0.06 },
      start: 0.1, impact: T_HIT,
    }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as WorldSever;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as WorldSever).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
