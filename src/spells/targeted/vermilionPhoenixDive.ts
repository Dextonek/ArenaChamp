import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { LightPillar, smoothstep } from '../../effects/common';
import {
  CrescentArc, HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Vermilion Phoenix Dive (targeted, single enemy): embers spiral up round the caster and a cold glint opens; a
 * hand-drawn phoenix (canvas sprite rig: crested head, body, two feathered wings, three scrolling tail plumes)
 * unfolds behind the caster with its wings spread wide and holds that pose. Then the wings fold, the beak turns
 * to the target, a needle line flashes, there is a dead beat, and the folded phoenix dives head-first onto the
 * enemy. Impact: dark/light frames, the wings snap open once at 2x and shatter into feathers, a crater flower of
 * molten petals and black wedges, a cool star at the base, a collapsing fire pillar, toon smoke and a scorch.
 *
 * Recipes: g-castorice-wing-nova-finisher (wing spread as the held reveal), f-spiderlily-tome-wings (scrolling
 * plume ribbons), f-html-meteor-slam (falling body, crater flower of petals and dark wedges).
 */
export interface VermilionPhoenixDiveSettings {
  damage: number;
  loop: boolean;
}

export const defaultVermilionPhoenixDive = (): VermilionPhoenixDiveSettings => ({
  damage: 65,
  loop: false,
});

// Timeline (seconds).
const GLINT = 0.15;
const RISE_START = 0.4;
const OPEN_START = 0.5;
const OPEN_END = 1.0;
const FOLD_START = 1.5;
const FOLD_END = 1.7;
const DIVE_START = 1.75;
const IMPACT = 2.05;
const DURATION = 4.6;

// Fire / phoenix row of the art bible.
const CORE = 0xfff4d6;
const HOT = 0xffc247;
const BODY = 0xff6a1f;
const PINK = 0xff4f8b;
const DARK = 0x3a0d0a;
const COOL = 0xcfe8ff;

const SEGS = 32;
const PETALS = 8;

// Rig dimensions (metres at rig scale 1).
const BODY_H = 4.4;
const BODY_W = BODY_H / 2;
const WING_S = 4.0;
const WING_ROOT_U = 14 / 256;
const SHOULDER_X = 0.15;
const SHOULDER_Y = (0.5 - 150 / 512) * BODY_H;
const ANGLE_SPREAD = 0.3;
const ANGLE_FOLD = -1.5;
const TAIL_BACK = BODY_H / 2 - 0.1;

const easeOutBack = (x: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  const k = Math.min(1, Math.max(0, x)) - 1;
  return 1 + c3 * k * k * k + c1 * k * k;
};
const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** A leaf-shaped feather from (x0,y0) to (x1,y1), bulging by `w` on each side. */
function featherPath(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, curl = 0) {
  const dx = x1 - x0, dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const px = -dy / l, py = dx / l;
  const mx = x0 + dx * 0.5, my = y0 + dy * 0.5;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo(mx + px * (w + curl), my + py * (w + curl), x1 + px * curl * 0.5, y1 + py * curl * 0.5);
  g.quadraticCurveTo(mx - px * w, my - py * w, x0, y0);
  g.closePath();
}

/**
 * The phoenix's head and body as a hard-edged drawing (canvas, 512 x 1024; drawn on a 256 x 512 grid): beak and
 * head at the top (it flies "up" in the texture), a pink crest of three feathers sweeping back, a value ramp from
 * hot head to dark tail root, scalloped plumage, a black outline, a thin cream edge on the brow and beak, and a
 * pink eye. The tail root is the bottom tip, where the plume ribbons join.
 */
function bodyTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 1024;
  const g = cv.getContext('2d')!;
  g.scale(2, 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const out = '#2a0a08';

  // Crest: three pink feathers sweeping back from the skull, behind the head.
  const crest = [
    { x1: 44, y1: 196, w: 15, x0: 112, y0: 62 },
    { x1: 62, y1: 150, w: 12, x0: 114, y0: 50 },
    { x1: 82, y1: 112, w: 9, x0: 118, y0: 40 },
  ];
  for (const c of crest) {
    const grad = g.createLinearGradient(c.x0, c.y0, c.x1, c.y1);
    grad.addColorStop(0, css(PINK));
    grad.addColorStop(0.5, css(BODY));
    grad.addColorStop(1, css(DARK));
    featherPath(g, c.x0, c.y0, c.x1, c.y1, c.w, -6);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = out;
    g.lineWidth = 4.5;
    g.stroke();
  }

  // Body: head, neck, chest, belly, tapering to the tail root.
  const body = new Path2D();
  body.moveTo(128, 30);
  body.bezierCurveTo(150, 34, 160, 56, 152, 82);
  body.bezierCurveTo(148, 100, 140, 108, 146, 124);
  body.bezierCurveTo(176, 160, 176, 250, 150, 340);
  body.bezierCurveTo(140, 400, 134, 450, 128, 506);
  body.bezierCurveTo(122, 450, 116, 400, 106, 340);
  body.bezierCurveTo(80, 250, 80, 160, 110, 124);
  body.bezierCurveTo(116, 108, 108, 100, 104, 82);
  body.bezierCurveTo(96, 56, 106, 34, 128, 30);
  const grad = g.createLinearGradient(0, 30, 0, 506);
  grad.addColorStop(0, css(HOT));
  grad.addColorStop(0.3, css(BODY));
  grad.addColorStop(0.65, '#c23a12');
  grad.addColorStop(1, css(DARK));
  g.fillStyle = grad;
  g.fill(body);
  g.strokeStyle = out;
  g.lineWidth = 6;
  g.stroke(body);

  // Plumage: rows of dark scallops, narrowing with the body.
  g.strokeStyle = 'rgba(58,13,10,0.6)';
  g.lineWidth = 3;
  for (let row = 0, y = 150; y < 440; row++, y += 30) {
    const hw = y < 260 ? 44 : Math.max(4, 44 * (1 - (y - 260) / 200));
    for (let x = -hw + 10 + (row % 2) * 10; x <= hw - 8; x += 20) {
      g.beginPath();
      g.arc(128 + x, y, 10, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    }
  }
  // A warm lighter chest patch for the value ramp.
  g.fillStyle = 'rgba(255,194,71,0.22)';
  g.beginPath();
  g.ellipse(132, 190, 22, 46, 0, 0, Math.PI * 2);
  g.fill();

  // Beak: gold, slightly hooked, black outline.
  g.fillStyle = css(HOT);
  g.strokeStyle = out;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(113, 42);
  g.bezierCurveTo(111, 24, 122, 8, 135, 2);
  g.bezierCurveTo(139, 12, 143, 28, 143, 46);
  g.quadraticCurveTo(128, 36, 113, 42);
  g.closePath();
  g.fill();
  g.stroke();

  // Thin cream edge on the beak and brow (light from above): the only near-white on the sprite.
  g.strokeStyle = css(CORE);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(118, 34); g.bezierCurveTo(118, 22, 126, 12, 134, 6);
  g.stroke();
  g.beginPath();
  g.moveTo(144, 38); g.bezierCurveTo(154, 48, 158, 62, 153, 80);
  g.stroke();

  // Eye: pink almond, black slit, tiny cream glint.
  g.fillStyle = css(PINK);
  g.strokeStyle = out;
  g.lineWidth = 3.5;
  g.beginPath(); g.ellipse(136, 66, 10, 6, -0.35, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = out;
  g.beginPath(); g.ellipse(138, 66, 2.6, 5.2, -0.35, 0, Math.PI * 2); g.fill();
  g.fillStyle = css(CORE);
  g.beginPath(); g.arc(133, 63.5, 1.8, 0, Math.PI * 2); g.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * One wing as a hard-edged drawing (canvas, 512 x 512; 256 x 256 grid): the shoulder is at the left middle (14, 128)
 * and nine flight feathers fan out to the right, longest on the leading (top) edge, over a row of short covert
 * feathers. Each feather runs hot gold -> orange -> deep red -> dark at the tip, with a black outline.
 */
function wingTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  g.scale(2, 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const out = '#2a0a08';
  const rx = 14, ry = 128;

  const feather = (a: number, len: number, w: number, curl: number, hotToDark: boolean) => {
    const x1 = rx + Math.cos(a) * len, y1 = ry + Math.sin(a) * len;
    const grad = g.createLinearGradient(rx, ry, x1, y1);
    grad.addColorStop(0, css(HOT));
    grad.addColorStop(hotToDark ? 0.45 : 0.9, css(BODY));
    grad.addColorStop(hotToDark ? 0.8 : 1, hotToDark ? '#c23a12' : css(BODY));
    if (hotToDark) grad.addColorStop(1, css(DARK));
    featherPath(g, rx, ry, x1, y1, w, curl);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = out;
    g.lineWidth = 4;
    g.stroke();
    if (hotToDark) {
      // Rachis.
      g.strokeStyle = 'rgba(255,194,71,0.55)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(rx + 6, ry);
      g.lineTo(rx + Math.cos(a) * len * 0.88, ry + Math.sin(a) * len * 0.88);
      g.stroke();
    }
  };

  const N = 9;
  for (let i = N - 1; i >= 0; i--) {
    const k = i / (N - 1);
    const a = -0.85 + 1.65 * k;
    feather(a, 236 - 10 * i, 21 - 1.2 * i, -7, true);
  }
  for (let i = 5; i >= 0; i--) {
    const a = -1.0 + 1.8 * (i / 5);
    feather(a, 96 - 6 * i, 12, -3, false);
  }
  // Cream edge along the leading (top) feather: tiny and thin.
  const a0 = -0.85, l0 = 236;
  g.strokeStyle = css(CORE);
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(rx + 10, ry - 12);
  g.quadraticCurveTo(rx + Math.cos(a0) * l0 * 0.5 + 6, ry + Math.sin(a0) * l0 * 0.5 - 18, rx + Math.cos(a0) * l0 * 0.9, ry + Math.sin(a0) * l0 * 0.9 - 6);
  g.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const plumeVert = /* glsl */ `
  attribute vec3 aTan;
  attribute float aSide;
  uniform float uWidth;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 tw = mat3(modelMatrix) * aTan;
    vec3 off = cross(tw, cameraPosition - wp);
    float l = length(off);
    off = l > 1e-5 ? off / l : vec3(0.0, 0.0, 1.0);
    float u = uv.x;
    float w = uWidth * (0.55 + 0.45 * smoothstep(0.0, 0.1, u)) * (1.0 - 0.85 * u);
    wp += off * aSide * w;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const plumeFrag = /* glsl */ `
  uniform vec3 uHot, uBody, uAccent, uDark;
  uniform float uOpacity, uTime, uErosion, uUnder;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float u = vUv.x;
    float across = vUv.y * 2.0 - 1.0;
    // Scrolling flame grain, eroded toward the tip.
    float n = noise(vec2(u * 18.0 - uTime * 3.5, across * 2.5));
    if (n < uErosion * 0.8 + smoothstep(0.5, 1.0, u) * 0.6) discard;
    if (uUnder > 0.5) { gl_FragColor = vec4(uDark, uOpacity * (1.0 - 0.4 * u)); return; }
    vec3 col = mix(uHot, uBody, smoothstep(0.0, 0.3, u));
    col = mix(col, uAccent, smoothstep(0.4, 0.85, u));
    col = mix(col, uDark, smoothstep(0.85, 1.0, u) * 0.6);
    gl_FragColor = vec4(col, uOpacity * (1.0 - 0.5 * u));
  }
`;

/** A camera-facing flame strip along a polyline spine: u = 0 at the tail root, 1 at the tip. */
class PlumeStrip {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private pos = new Float32Array((SEGS + 1) * 2 * 3);
  private tan = new Float32Array((SEGS + 1) * 2 * 3);
  private geo = new THREE.BufferGeometry();

  constructor(width: number, under: boolean) {
    const side = new Float32Array((SEGS + 1) * 2);
    const uv = new Float32Array((SEGS + 1) * 2 * 2);
    const index: number[] = [];
    for (let i = 0; i <= SEGS; i++) {
      for (let j = 0; j < 2; j++) {
        const v = i * 2 + j;
        side[v] = j === 0 ? -1 : 1;
        uv[v * 2] = i / SEGS;
        uv[v * 2 + 1] = j;
      }
      if (i < SEGS) { const b = i * 2; index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aTan', new THREE.BufferAttribute(this.tan, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: under ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uWidth: { value: width }, uOpacity: { value: 0 }, uTime: { value: 0 }, uErosion: { value: 0 }, uUnder: { value: under ? 1 : 0 },
        uHot: { value: new THREE.Color(HOT) }, uBody: { value: new THREE.Color(BODY) },
        uAccent: { value: new THREE.Color(PINK) }, uDark: { value: new THREE.Color(DARK) },
      },
      vertexShader: plumeVert,
      fragmentShader: plumeFrag,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = under ? 3 : 4;
    this.mesh.visible = false;
  }

  setSpine(pts: THREE.Vector3[]) {
    for (let i = 0; i <= SEGS; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(SEGS, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
      const l = Math.hypot(tx, ty, tz);
      if (l > 1e-6) { tx /= l; ty /= l; tz /= l; } else { tx = 0; ty = -1; tz = 0; }
      for (let j = 0; j < 2; j++) {
        const v = (i * 2 + j) * 3;
        this.pos[v] = pts[i].x; this.pos[v + 1] = pts[i].y; this.pos[v + 2] = pts[i].z;
        this.tan[v] = tx; this.tan[v + 1] = ty; this.tan[v + 2] = tz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aTan.needsUpdate = true;
  }

  style(opacity: number, erosion: number, time: number) {
    const u = this.material.uniforms;
    u.uOpacity.value = opacity;
    u.uErosion.value = erosion;
    u.uTime.value = time;
    this.mesh.visible = opacity > 0.002;
  }
}

export class VermilionPhoenixDive implements Effect {
  readonly group = new THREE.Group();
  readonly settings: VermilionPhoenixDiveSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private smokeStep = 0;
  private craterStep = 0;
  private trailStep = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private chest = new THREE.Vector3();
  private hold = new THREE.Vector3();
  private recoil = new THREE.Vector3();
  private pStart = new THREE.Vector3();
  private pControl = new THREE.Vector3();
  private strike = new THREE.Vector3();
  private ground = new THREE.Vector3();
  private dirInit = new THREE.Vector3(0, -1, 0);
  private dirEnd = new THREE.Vector3(0, -1, 0);
  private hitFrom = new THREE.Vector3();

  // Billboard state, written by the rig's onBeforeRender and read in layout().
  private heading = new THREE.Vector3(0, 1, 0);
  private camFwd = new THREE.Vector3(-1, 0, 0);
  private camRight = new THREE.Vector3(0, 0, -1);
  private lastRoll = 0;

  // Phoenix rig: head and body, two wings (pivot -> scale group -> mesh), all turned toward the camera.
  private rig = new THREE.Group();
  private bodyMat = new THREE.MeshBasicMaterial({
    map: bodyTexture(), transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide,
  });
  private wingMat = new THREE.MeshBasicMaterial({
    map: wingTexture(), transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide,
  });
  private wingPivot: THREE.Group[] = [];
  private wingScale: THREE.Group[] = [];
  private plumes: PlumeStrip[] = [];
  private plumeUnder = new PlumeStrip(0.62, true);
  private plumeLen = [6, 4.4, 4.4];
  private plumeFan = [0, 0.85, -0.85];
  private plumePhase = [0, 2.1, 4.2];
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: COOL, core: 0xffffff, additive: false });

  // Telegraph line and slipstream.
  private needle: THREE.Line;
  private needleMat = new THREE.LineBasicMaterial({ color: HOT, transparent: true, opacity: 0, depthWrite: false });
  private slip = new CrescentArc({ radius: 2.3, width: 1.5, style: 'soft', sweep: Math.PI * 0.9, edge: HOT, mid: BODY, outer: DARK });
  private slipBasis = new THREE.Group();

  // Impact.
  private impactStar = new StarBurst({ points: 12, color: BODY, core: HOT, additive: false });
  private coolStar = new StarBurst({ points: 8, color: COOL, core: 0xffffff, additive: false });
  private tipGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: HOT, core: CORE, additive: false });
  private pillar = new LightPillar(BODY, 0.8);
  private refract = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private haze = new HeatHaze({ width: 6, height: 7, scale: 4 });
  private petals: THREE.InstancedMesh;
  private petalMat = new THREE.MeshBasicMaterial({
    color: BODY, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private wedges: THREE.InstancedMesh;
  private wedgeMat = new THREE.MeshBasicMaterial({
    color: DARK, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  private scorch = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0x1a0605, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private smoke = new SmokeBall({ color: 0x3a0d0a, rim: 0x6a1a10, flake: '#3a0d0a', maxBalls: 8 });

  private embers: Emitter;
  private feathers: Emitter;
  private sparks: Emitter;

  constructor(settings: VermilionPhoenixDiveSettings = defaultVermilionPhoenixDive()) {
    this.settings = settings;
    this.screen.tint.set(DARK);
    this.screen.impactColor.set(BODY);
    this.screen.speedLineColor.set(HOT);
    this.screen.edgeTint.set(PINK);

    // Body and wings. The wings sit slightly behind the body plane.
    const bodyMesh = new THREE.Mesh(new THREE.PlaneGeometry(BODY_W, BODY_H), this.bodyMat);
    bodyMesh.renderOrder = 6;
    this.rig.add(bodyMesh);
    const meshes: THREE.Mesh[] = [bodyMesh];
    for (let k = 0; k < 2; k++) {
      const pivot = new THREE.Group();
      const sc = new THREE.Group();
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(WING_S, WING_S), this.wingMat);
      wing.position.set((0.5 - WING_ROOT_U) * WING_S, 0, 0);
      wing.renderOrder = 5;
      sc.add(wing);
      pivot.add(sc);
      pivot.position.set(k === 0 ? SHOULDER_X : -SHOULDER_X, SHOULDER_Y, -0.02);
      if (k === 1) pivot.scale.x = -1;
      this.rig.add(pivot);
      this.wingPivot.push(pivot);
      this.wingScale.push(sc);
      meshes.push(wing);
    }
    // Camera-facing rig: the whole group turns to the camera, then rolls so the beak leads along `heading`.
    const camQ = new THREE.Quaternion();
    const parentQ = new THREE.Quaternion();
    const face = (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
      camera.getWorldQuaternion(camQ);
      this.camFwd.set(0, 0, -1).applyQuaternion(camQ);
      this.camRight.set(1, 0, 0).applyQuaternion(camQ);
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camQ);
      const dx = this.heading.dot(this.camRight), dy = this.heading.dot(camUp);
      // Rolling +Y by r turns it toward (-sin r, cos r): aim that at the heading seen on screen.
      if (Math.hypot(dx, dy) > 1e-3) this.lastRoll = Math.atan2(-dx, dy);
      this.rig.parent?.getWorldQuaternion(parentQ);
      this.rig.quaternion.copy(parentQ.invert().multiply(camQ));
      this.rig.rotateZ(this.lastRoll);
      this.rig.updateMatrixWorld(true);
    };
    for (const m of meshes) {
      m.onBeforeRender = face;
      m.frustumCulled = false;
    }
    this.rig.visible = false;
    this.group.add(this.rig);

    for (const w of [0.5, 0.26, 0.26]) this.plumes.push(new PlumeStrip(w, false));
    this.group.add(this.plumeUnder.mesh, ...this.plumes.map((p) => p.mesh));
    this.group.add(this.glint.mesh);

    const nGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
    this.needle = new THREE.Line(nGeo, this.needleMat);
    this.needle.frustumCulled = false;
    this.needle.visible = false;
    this.slipBasis.add(this.slip.mesh);
    this.group.add(this.needle, this.slipBasis);

    // Crater flower: molten petals (additive) alternating with dark wedges (normal), lying flat.
    const petal = new THREE.Shape();
    petal.moveTo(0, 0.1);
    petal.quadraticCurveTo(0.28, 0.5, 0, 1);
    petal.quadraticCurveTo(-0.28, 0.5, 0, 0.1);
    const wedge = new THREE.Shape();
    wedge.moveTo(0, 0.12);
    wedge.lineTo(0.2, 0.95);
    wedge.lineTo(-0.2, 0.95);
    wedge.closePath();
    this.petals = new THREE.InstancedMesh(new THREE.ShapeGeometry(petal), this.petalMat, PETALS);
    this.wedges = new THREE.InstancedMesh(new THREE.ShapeGeometry(wedge), this.wedgeMat, PETALS);
    this.petals.frustumCulled = false;
    this.wedges.frustumCulled = false;
    this.petals.renderOrder = 2;
    this.wedges.renderOrder = 1;
    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.renderOrder = 0;
    this.group.add(this.scorch, this.wedges, this.petals, this.pillar.mesh, this.refract.mesh, this.haze.mesh);
    this.group.add(this.impactStar.mesh, this.coolStar.mesh, this.tipGlint.mesh, this.smoke.mesh);

    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.3, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.15, speed: 0.9, speedJitter: 0.6, spread: 40, gravity: -1.2, drag: 1.1,
      sizeStart: 0.2, sizeEnd: 0.02, colorStart: '#ffc247', colorEnd: '#ff4f8b',
      opacityStart: 0.5, opacityEnd: 0, additive: true, colorMid: '#ff6a1f', sizeJitter: 0.5, erosion: 0.4, spin: 0.5,
    });
    // Feathers and flakes: normal-blended orange that burns down to dark red.
    this.feathers = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 2.0, lifetimeJitter: 0.45,
      shape: 'sphere', shapeSize: 0.5, speed: 4, speedJitter: 0.7, spread: 180, gravity: 2.2, drag: 1.3,
      sizeStart: 0.3, sizeEnd: 0.1, colorStart: '#ff6a1f', colorEnd: '#3a0d0a',
      opacityStart: 0.95, opacityEnd: 0, additive: false, colorMid: '#c23a12', sizeJitter: 0.5, erosion: 0.35, spin: 0.8,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 11, speedJitter: 0.6, spread: 90, gravity: 9, drag: 1.4,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffc247', colorEnd: '#ff4f8b',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.embers, this.feathers, this.sparks, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return IMPACT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(ctx.from).setY(1.6);
    this.hold.copy(ctx.from).addScaledVector(this.fwd, -2).setY(5);
    const target = ctx.targetPos[0] ?? ctx.point;
    this.ground.copy(target).setY(0);
    this.strike.copy(this.ground).setY(1.2);
    // Dive arc: starts a little behind the hold point (the recoil), bows up, ends on the target's chest.
    this.pControl.copy(this.hold).lerp(this.strike, 0.45).setY(Math.max(this.hold.y, this.strike.y) * 0.8 + 0.8);
    this.dirInit.subVectors(this.pControl, this.hold);
    if (this.dirInit.lengthSq() < 1e-6) this.dirInit.set(0, -1, 0);
    this.dirInit.normalize();
    this.recoil.copy(this.dirInit).multiplyScalar(-0.6);
    this.pStart.copy(this.hold).add(this.recoil);
    this.dirEnd.subVectors(this.strike, this.pControl);
    if (this.dirEnd.lengthSq() < 1e-6) this.dirEnd.set(0, -1, 0);
    this.dirEnd.normalize();
    // Knock away from a point just behind the target, so the direction is never zero.
    this.hitFrom.copy(this.ground).addScaledVector(this.fwd, -1.2);
    this.screen.silhouettes = ctx.targets.length ? ctx.targets.map((e) => e.group) : [ctx.caster.group];
    this.screen.focus.copy(this.strike);
    this.scorch.position.set(this.ground.x, 0.02, this.ground.z);
    this.wedges.position.set(this.ground.x, 0.03, this.ground.z);
    this.petals.position.set(this.ground.x, 0.045, this.ground.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.smokeStep = 0;
    this.craterStep = 0;
    this.trailStep = 0;
    this.shake = 0;
    this.lastRoll = 0;
    this.heading.set(0, 1, 0);
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.embers.update(dt);
    this.feathers.update(dt);
    this.sparks.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.impacted && this.time >= IMPACT) this.onImpact();
    this.layout(dt);
  }

  /** Point and direction on the dive curve, u in 0..1. */
  private diveAt(u: number, p: THREE.Vector3, dir: THREE.Vector3) {
    const a = this.pStart, b = this.pControl, c = this.strike;
    const k = 1 - u;
    p.set(
      k * k * a.x + 2 * k * u * b.x + u * u * c.x,
      k * k * a.y + 2 * k * u * b.y + u * u * c.y,
      k * k * a.z + 2 * k * u * b.z + u * u * c.z,
    );
    dir.set(
      2 * k * (b.x - a.x) + 2 * u * (c.x - b.x),
      2 * k * (b.y - a.y) + 2 * u * (c.y - b.y),
      2 * k * (b.z - a.z) + 2 * u * (c.z - b.z),
    );
    if (dir.lengthSq() < 1e-8) dir.copy(this.dirInit);
    dir.normalize();
  }

  private layout(dt: number) {
    const t = this.time;
    const D = IMPACT;
    const after = t - D;
    const ctx = this.ctx;

    // --- Layer 1: the world darkens and warms to dark red; a deeper dip on the dead beat; released after the hit. ---
    const dead = t >= FOLD_END && t < DIVE_START ? 0.12 : 0;
    this.screen.darken = (0.6 * smoothstep(t / 0.4) + dead) * (1 - smoothstep((after - 0.1) / 1.3));
    this.screen.chroma = chromaPulse(t, D, 0.8);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);

    // --- Layer 2: embers spiral up round the caster, then a cold glint at the chest. ---
    if (dt > 0 && t < RISE_START) {
      for (let i = 0; i < 3; i++) {
        const a = t * 11 + (i * Math.PI * 2) / 3;
        const r = 1.3 * (1 - 0.5 * (t / RISE_START));
        this.embers.burst(2, new THREE.Vector3(this.from.x + Math.cos(a) * r, 0.2 + (t / RISE_START) * 2.2, this.from.z + Math.sin(a) * r));
      }
    }
    const gl = StarBurst.pop(t - GLINT, 0.22, 0.15);
    this.glint.set(this.chest, 1.1 * gl.scale, gl.opacity, 0.4);

    // --- Layer 3: the phoenix. Pose, position, heading. ---
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3(0, 1, 0);
    const diveU = clamp01((t - DIVE_START) / (D - DIVE_START));
    const diveE = Math.pow(diveU, 2.2);
    const alive = t >= RISE_START && after < 0.06;
    let wingP: number;
    const grow = t >= DIVE_START ? 1 : easeOutBack((t - RISE_START) / 0.45);
    if (t < DIVE_START) {
      const rise = easeOutCubic((t - RISE_START) / 0.7);
      pos.lerpVectors(this.chest, this.hold, rise);
      pos.y += 0.12 * Math.sin(t * 5) * smoothstep((t - 1.0) / 0.3);
      const r = smoothstep((t - FOLD_START) / (FOLD_END - FOLD_START));
      if (r > 0) pos.lerp(this.pStart.clone(), r);
      // Wings open over 0.5 s with overshoot, hold wide, then fold.
      const open = easeOutBack((t - OPEN_START) / (OPEN_END - OPEN_START));
      const fold = clamp01((t - FOLD_START) / (FOLD_END - FOLD_START));
      wingP = t < FOLD_START ? open : open * (1 - fold * fold);
      // The beak turns from straight up toward the target.
      const turn = smoothstep((t - FOLD_START) / (FOLD_END - FOLD_START));
      dir.set(0, 1, 0).lerp(this.dirInit, turn);
      if (dir.lengthSq() < 1e-6) dir.copy(this.dirInit);
      dir.normalize();
    } else if (after < 0) {
      this.diveAt(diveE, pos, dir);
      wingP = 0;
    } else {
      pos.copy(this.strike);
      dir.copy(this.dirEnd);
      wingP = 1;
    }
    this.heading.copy(dir);
    let rigScale = grow;
    if (t >= DIVE_START) rigScale = 1 - 0.2 * diveE;
    if (after >= 0) rigScale = 2;
    const flap = t >= OPEN_END && t < FOLD_START ? 0.07 * Math.sin((t - OPEN_END) * 9) : 0;
    const angle = THREE.MathUtils.lerp(ANGLE_FOLD, ANGLE_SPREAD, wingP) + flap;
    const sx = THREE.MathUtils.lerp(0.35, 1, Math.min(1.12, Math.max(0, wingP)));
    for (let k = 0; k < 2; k++) {
      this.wingPivot[k].rotation.z = k === 0 ? angle : -angle;
      this.wingScale[k].scale.x = Math.max(1e-3, sx);
    }
    this.rig.position.copy(pos);
    this.rig.scale.setScalar(Math.max(1e-3, rigScale));
    this.rig.visible = alive;

    // --- Layer 4: tail plumes streaming back from the tail root. ---
    const back = dir.clone().multiplyScalar(-1);
    const root = pos.clone().addScaledVector(back, TAIL_BACK * rigScale);
    const perp = new THREE.Vector3().crossVectors(this.camFwd, dir);
    if (perp.lengthSq() < 1e-6) perp.copy(this.camRight);
    perp.normalize();
    const stretch = 1 + 0.7 * diveE;
    const fan = 1 - 0.75 * diveE;
    const amp = 1 - 0.6 * diveE;
    const plumeOn = alive && after < 0;
    const spine: THREE.Vector3[] = [];
    for (let k = 0; k <= SEGS; k++) spine.push(new THREE.Vector3());
    for (let i = 0; i < 3; i++) {
      if (plumeOn) {
        const L = this.plumeLen[i] * stretch * clamp01(grow) * (0.6 + 0.4 * smoothstep((t - OPEN_START) / 0.5));
        for (let k = 0; k <= SEGS; k++) {
          const u = k / SEGS;
          const wig = amp * (0.35 + 0.2 * i) * Math.sin(u * 5.5 - t * 6 + this.plumePhase[i]) * smoothstep(u / 0.3);
          const lat = this.plumeFan[i] * fan * Math.pow(u, 1.2) * 1.6 + wig * u;
          spine[k].copy(root).addScaledVector(back, u * L).addScaledVector(perp, lat);
        }
        this.plumes[i].setSpine(spine);
        if (i === 0) this.plumeUnder.setSpine(spine);
      }
      const op = plumeOn ? 0.7 * smoothstep((t - RISE_START) / 0.3) : 0;
      this.plumes[i].style(op, 0.05 + 0.1 * diveE, t);
      if (i === 0) this.plumeUnder.style(plumeOn ? 0.85 * smoothstep((t - RISE_START) / 0.3) : 0, 0.05, t);
    }

    // Feathers shed from the spread wings while the pose holds, and a trail of flakes in the dive.
    if (dt > 0 && alive && after < 0) {
      if (t >= OPEN_START && t < FOLD_START && Math.floor(t * 40) !== this.trailStep) {
        this.trailStep = Math.floor(t * 40);
        const side = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2.6);
        this.feathers.burst(1, pos.clone().addScaledVector(this.camRight, side).add(new THREE.Vector3(0, 0.4 * Math.random(), 0)));
      } else if (t >= DIVE_START) {
        this.feathers.burst(3, pos.clone().addScaledVector(back, 1.2));
      }
    }

    // --- Telegraph needle: thin hot line from the phoenix to the target, flashing once at the fold. ---
    const nT = t - FOLD_START;
    const needleOn = nT >= 0 && nT < 0.14;
    this.needle.visible = needleOn;
    this.needleMat.opacity = needleOn ? 0.9 * (1 - nT / 0.14) : 0;
    if (needleOn) {
      const a = this.needle.geometry.attributes.position as THREE.BufferAttribute;
      a.setXYZ(0, pos.x, pos.y, pos.z);
      a.setXYZ(1, this.strike.x, this.strike.y, this.strike.z);
      a.needsUpdate = true;
    }

    // --- Layer 5: fire slipstream crescent trailing the dive (soft dialect, in the screen plane). ---
    const slipOn = t >= DIVE_START && after < 0.02;
    const n = this.camFwd.clone().multiplyScalar(-1);
    const e2 = new THREE.Vector3().crossVectors(n, dir);
    if (e2.lengthSq() < 1e-6) e2.copy(this.camRight);
    e2.normalize();
    const n2 = new THREE.Vector3().crossVectors(dir, e2).normalize();
    this.slipBasis.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, e2, n2));
    this.slipBasis.position.copy(pos).addScaledVector(dir, 0.6);
    // The arc spans angles 0..sweep: turn it so it is centred behind the phoenix (direction -dir).
    this.slip.mesh.rotation.z = Math.PI - (Math.PI * 0.9) / 2;
    this.slip.head = 0.15 + diveU * 1.2;
    this.slip.length = 0.75;
    this.slip.time = t;
    this.slip.erosion = 0.1;
    this.slip.opacity = slipOn ? 0.65 : 0;
    this.slip.mesh.visible = slipOn;

    // Black normal-blended smoke puffs pop along the path.
    if (dt > 0 && t >= DIVE_START + 0.05 && after < 0 && this.smokeStep < 2 && t >= DIVE_START + 0.08 + this.smokeStep * 0.12) {
      this.smoke.trigger(pos.clone().addScaledVector(back, 0.8), 0.5, 0.7);
      this.smokeStep++;
    }

    // Speed lines converge on the target during the dive and drain after the hit.
    this.screen.speedLines = t < DIVE_START ? 0 : after < 0 ? 0.7 * diveU : Math.max(0, 0.7 - after * 4);

    // --- Layer 7: impact stars. The orange toon star is the body, the cool star is a 2-frame cold cue. ---
    const ip = StarBurst.pop(after - 0.02, 0.1, 0.2);
    this.impactStar.set(new THREE.Vector3(this.strike.x, 1.6, this.strike.z), 7 * ip.scale, ip.opacity, 0.2);
    const cs = StarBurst.pop(after, 0.03, 0.05);
    this.coolStar.set(new THREE.Vector3(this.ground.x, 0.8, this.ground.z), 3.4 * cs.scale, cs.opacity, 0.3);

    // --- Layer 8: crater flower and scorch. ---
    this.updateCrater(after);

    // Short fire pillar collapses to a line and a star.
    const pp = clamp01((after - 0.05) / 0.5);
    const pTop = after > 0.05 ? 14 - 12.4 * pp * pp : 0;
    this.pillar.set(this.ground.x, this.ground.z, 0, Math.max(1.2, pTop), after > 0.05 && after < 0.6 ? 0.4 * (1 - pp * 0.8) : 0);
    const tg = StarBurst.pop(after - 0.5, 0.15, 0.3);
    this.tipGlint.set(new THREE.Vector3(this.ground.x, 1.4, this.ground.z), 1.8 * tg.scale, tg.opacity, t * 2);

    // Distortion: ground shock bend as the crater opens, heat shimmer over the collapsing pillar.
    const rp = clamp01(after / 0.5);
    this.refract.set(this.ground, 1 + 5 * easeOutCubic(rp), after > 0 && after < 0.5 ? 0.05 * (1 - rp) * (1 - rp) : 0);
    this.haze.set(this.ground, after > 0.05 ? 0.014 * smoothstep((after - 0.05) / 0.2) * (1 - smoothstep((after - 0.8) / 0.9)) : 0, t, 1.2);

    // Toon smoke rolls out of the crater after the hit.
    if (ctx && dt > 0 && this.craterStep < 2) {
      const i = this.craterStep;
      if (after >= 0.2 + i * 0.12) {
        // Back edge of the crater (away from the camera), one ball either side.
        const bx = this.camFwd.x, bz = this.camFwd.z;
        const bl = Math.hypot(bx, bz) || 1;
        const fx = bx / bl, fz = bz / bl;
        const side = i === 0 ? -1.3 : 1.3;
        this.smoke.trigger(new THREE.Vector3(this.ground.x + fx * 2.6 - fz * side, 0.6, this.ground.z + fz * 2.6 + fx * side), 0.75, 1.1);
        this.craterStep++;
      }
    }

    this.shake = after >= 0 ? 0.9 * Math.exp(-after * 6) : t >= DIVE_START ? 0.12 * diveU : t >= OPEN_START && t < FOLD_START ? 0.03 : 0;
  }

  private updateCrater(after: number) {
    const m = new THREE.Matrix4();
    const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const qYaw = new THREE.Quaternion();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const on = after >= 0;
    const grow = easeOutCubic(after / 0.3);
    const fade = 1 - smoothstep((after - 1.1) / 0.7);
    const L = 3.4 * grow;
    for (let i = 0; i < PETALS; i++) {
      const a = (i / PETALS) * Math.PI * 2;
      const wa = a + Math.PI / PETALS;
      if (!on) {
        m.compose(pos.set(0, -10, 0), q.identity(), sc.setScalar(1e-4));
        this.petals.setMatrixAt(i, m);
        this.wedges.setMatrixAt(i, m);
        continue;
      }
      qYaw.setFromAxisAngle(up, a);
      q.copy(qYaw).multiply(qFlat);
      m.compose(pos.set(0, 0, 0), q, sc.set(Math.max(1e-4, L * 0.9), Math.max(1e-4, L), 1));
      this.petals.setMatrixAt(i, m);
      qYaw.setFromAxisAngle(up, wa);
      q.copy(qYaw).multiply(qFlat);
      m.compose(pos.set(0, 0, 0), q, sc.set(Math.max(1e-4, L * 0.95), Math.max(1e-4, L * 0.95), 1));
      this.wedges.setMatrixAt(i, m);
    }
    this.petals.instanceMatrix.needsUpdate = true;
    this.wedges.instanceMatrix.needsUpdate = true;
    this.petalMat.opacity = on ? 0.5 * (1 - smoothstep((after - 0.25) / 0.9)) : 0;
    this.petalMat.color.set(BODY).lerp(new THREE.Color(DARK), smoothstep((after - 0.2) / 0.9));
    this.wedgeMat.opacity = on ? 0.9 * fade : 0;
    this.petals.visible = this.petalMat.opacity > 0.003;
    this.wedges.visible = this.wedgeMat.opacity > 0.003;
    // Scorch: grows with the crater, fades last.
    const sm = this.scorch.material as THREE.MeshBasicMaterial;
    this.scorch.scale.setScalar(Math.max(1e-3, 2.9 * grow));
    sm.opacity = on ? 0.75 * (1 - smoothstep((after - 1.6) / 0.9)) : 0;
    this.scorch.visible = sm.opacity > 0.003;
  }

  private onImpact() {
    this.impacted = true;
    const c = this.strike;
    this.sparks.burst(380, new THREE.Vector3(c.x, 0.6, c.z));
    this.feathers.burst(260, new THREE.Vector3(c.x, 1.4, c.z));
    this.embers.burst(80, new THREE.Vector3(c.x, 0.8, c.z));
    const ctx = this.ctx;
    if (ctx) {
      ctx.targets.forEach((e, i) => {
        ctx.hit(e, { damage: i === 0 ? this.settings.damage : 25, knock: 6, from: this.hitFrom });
      });
    }
  }
}

export const vermilionPhoenixDiveModule: EffectModule = {
  label: 'vermilion phoenix dive',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new VermilionPhoenixDive(),
  telegraphs(effect) {
    const e = effect as VermilionPhoenixDive;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 2.5 }, start: FOLD_START, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.45, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as VermilionPhoenixDive;
    if (e.ctx) frameCast(camera, controls, e.ctx, 9);
  },
  buildGui(f, effect) {
    const s = (effect as VermilionPhoenixDive).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
