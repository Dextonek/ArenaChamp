import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Shadow Puppet Execution (targeted, single enemy): the world goes dark and a tall back-lit paper screen unrolls
 * behind the target, facing the caster. Three flat black shadow-play puppets (lamellar armour, helmet plume, spear,
 * jointed limbs on pivots, animated at 12 fps) walk onto the screen on strings, raise their spears, step off the
 * screen into the arena and surround the target (two at the sides, one above). After a dead beat all three thrust:
 * violet/black impact frames, a black ink star under a magenta star, short black ink spikes. The strings are cut,
 * the puppets fold and topple, burn from their edges into violet embers while the screen tears away.
 *
 * The pale violet paper (#e8dcf4 centre to #8a2ee0 edge) is what makes the black puppets read, so the puppets
 * always stay in front of it.
 */
export interface ShadowPuppetExecutionSettings {
  /** Damage of the thrust. */
  damage: number;
  loop: boolean;
}

export const defaultShadowPuppetExecution = (): ShadowPuppetExecutionSettings => ({ damage: 55, loop: false });

// Timeline (seconds).
const UNROLL = 0.6;
const STEP0 = 1.55;
const STEP1 = 1.95;
const D = 2.1;
const COLLAPSE = 0.5; // after D
const DURATION = 4.4;

const INK = 0x07030c;
const INK_VIOLET = 0x0d0518;
const HOT = 0xd68cff;
const BODY = 0x8a2ee0;
const MAGENTA = 0xff3fa0;

const SCREEN_W = 11;
const SCREEN_H = 7.4;
const SCREEN_DIST = 3.2; // behind the target, away from the caster
const PX = 180; // canvas pixels per world unit

const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);
const lerp = THREE.MathUtils.lerp;
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------------------------------------------
// Canvas drawing: flat black cut-outs with ornate holes (destination-out).

function drawPart(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * PX);
  cv.height = Math.ceil(h * PX);
  const g = cv.getContext('2d')!;
  g.scale(PX, PX);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function poly(g: CanvasRenderingContext2D, pts: number[][]) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill();
}

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function cut(g: CanvasRenderingContext2D, fn: () => void) {
  g.globalCompositeOperation = 'destination-out';
  fn();
  g.globalCompositeOperation = 'source-over';
}

function slot(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rrect(g, x, y, w, h, Math.min(w, h) * 0.4);
  g.fill();
}

/** Torso 1.35 x 2.1: helmet with plume, pauldron, lamellar cuirass, tassets. Pivot: (0.65, 2.1) = hip. */
function torsoTexture() {
  return drawPart(1.35, 2.1, (g) => {
    // Plume: three tapered feather strands sweeping back from the helmet top.
    const strand = (x1: number, y1: number, cx: number, cy: number, wid: number) => {
      g.beginPath();
      g.moveTo(0.74, 0.56);
      g.quadraticCurveTo(cx, cy, x1, y1);
      g.quadraticCurveTo(cx + wid, cy + wid * 1.2, 0.86, 0.5);
      g.closePath();
      g.fill();
    };
    strand(0.06, 0.18, 0.5, 0.02, 0.1);
    strand(0.14, 0.02, 0.62, 0.0, 0.08);
    strand(0.0, 0.46, 0.42, 0.22, 0.09);
    // Helmet dome, brim, finial.
    g.beginPath();
    g.ellipse(0.78, 0.74, 0.28, 0.27, 0, Math.PI, 2 * Math.PI);
    g.closePath();
    g.fill();
    poly(g, [[0.74, 0.5], [0.78, 0.3], [0.82, 0.5]]);
    poly(g, [[0.48, 0.74], [1.14, 0.7], [1.1, 0.78], [0.48, 0.8]]);
    // Face profile (nose, lips, chin) and jaw guard.
    poly(g, [[0.52, 0.78], [1.04, 0.78], [1.08, 0.86], [1.01, 0.89], [1.04, 0.95], [0.97, 1.0], [0.9, 1.0],
      [0.88, 1.06], [0.6, 1.06], [0.54, 0.98]]);
    g.fillRect(0.62, 1.0, 0.22, 0.14);
    // Ear flap of the helmet.
    poly(g, [[0.5, 0.78], [0.6, 0.78], [0.6, 1.0], [0.46, 0.96]]);
    // Pauldron fan.
    g.beginPath();
    g.ellipse(0.62, 1.12, 0.44, 0.22, 0, Math.PI, 2 * Math.PI);
    g.closePath();
    g.fill();
    // Cuirass.
    poly(g, [[0.2, 1.06], [1.08, 1.08], [1.04, 1.5], [0.96, 1.7], [0.3, 1.7], [0.2, 1.4]]);
    // Tassets: pointed lamellar flaps.
    for (let i = 0; i < 4; i++) {
      const x = 0.2 + i * 0.22;
      poly(g, [[x, 1.64], [x + 0.23, 1.64], [x + 0.115, 2.1]]);
    }
    // Cut-outs: lamellar rows, pauldron scallops, chest medallion, eye, tasset diamonds, helmet bands.
    cut(g, () => {
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
          const x = 0.3 + col * 0.1 + (row % 2) * 0.05;
          if (x > 0.98) continue;
          slot(g, x, 1.2 + row * 0.07, 0.07, 0.04);
        }
      }
      for (let k = 0; k < 6; k++) {
        const a = Math.PI + (k + 0.5) * (Math.PI / 6);
        g.beginPath();
        g.arc(0.62 + Math.cos(a) * 0.3, 1.12 + Math.sin(a) * 0.12, 0.028, 0, Math.PI * 2);
        g.fill();
      }
      g.lineWidth = 0.022;
      g.beginPath();
      g.arc(0.62, 1.36, 0.085, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(0.62, 1.36, 0.02, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 4; i++) poly(g, [[0.315 + i * 0.22, 1.83], [0.35 + i * 0.22, 1.9], [0.315 + i * 0.22, 1.97], [0.28 + i * 0.22, 1.9]]);
      // Eye almond and helmet bands.
      g.beginPath();
      g.moveTo(0.86, 0.84);
      g.quadraticCurveTo(0.92, 0.8, 0.98, 0.84);
      g.quadraticCurveTo(0.92, 0.87, 0.86, 0.84);
      g.fill();
      g.lineWidth = 0.02;
      for (const r of [0.14, 0.21]) {
        g.beginPath();
        g.arc(0.78, 0.74, r, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      }
      slot(g, 0.51, 0.86, 0.06, 0.04);
      slot(g, 0.51, 0.93, 0.06, 0.04);
      // Feather veins in the plume.
      g.lineWidth = 0.015;
      g.beginPath();
      g.moveTo(0.62, 0.52); g.quadraticCurveTo(0.35, 0.3, 0.12, 0.22);
      g.stroke();
    });
  });
}

/** Upper arm 0.4 x 0.85, sleeve with lamellar slots. Pivot (0.2, 0.08). */
function armTexture() {
  return drawPart(0.4, 0.85, (g) => {
    rrect(g, 0.06, 0.0, 0.28, 0.85, 0.08);
    g.fill();
    cut(g, () => {
      for (let i = 0; i < 4; i++) slot(g, 0.14, 0.16 + i * 0.17, 0.12, 0.07);
    });
  });
}

/** Forearm 0.36 x 0.8 with bracer rings and a hand. Pivot (0.18, 0.06); hand at (0.18, 0.7). */
function foreTexture() {
  return drawPart(0.36, 0.8, (g) => {
    poly(g, [[0.08, 0], [0.28, 0], [0.31, 0.6], [0.26, 0.66], [0.1, 0.66], [0.05, 0.6]]);
    g.beginPath();
    g.arc(0.18, 0.7, 0.1, 0, Math.PI * 2);
    g.fill();
    cut(g, () => {
      for (const y of [0.16, 0.34, 0.5]) {
        g.beginPath();
        g.arc(0.18, y, 0.04, 0, Math.PI * 2);
        g.fill();
      }
    });
  });
}

/** Thigh 0.5 x 0.95 (tasset plates). Pivot (0.25, 0). */
function thighTexture() {
  return drawPart(0.5, 0.95, (g) => {
    poly(g, [[0.08, 0], [0.42, 0], [0.46, 0.5], [0.38, 0.92], [0.12, 0.92], [0.04, 0.5]]);
    cut(g, () => {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) slot(g, 0.12 + col * 0.11 + (row % 2) * 0.03, 0.12 + row * 0.19, 0.07, 0.09);
      }
    });
  });
}

/** Shin + pointed boot 0.55 x 0.95. Pivot (0.25, 0). */
function shinTexture() {
  return drawPart(0.55, 0.95, (g) => {
    poly(g, [[0.1, 0], [0.4, 0], [0.36, 0.7], [0.44, 0.76], [0.54, 0.9], [0.5, 0.95], [0.08, 0.95], [0.1, 0.72]]);
    cut(g, () => {
      for (let i = 0; i < 3; i++) slot(g, 0.17, 0.12 + i * 0.2, 0.14, 0.08);
      poly(g, [[0.25, 0.76], [0.29, 0.82], [0.25, 0.88], [0.21, 0.82]]);
    });
  });
}

/** Spear 0.5 x 4.4, tip at the top, leaf blade with a cut-out, hooks, tassel. Pivot at the grip (0.25, 2.6). */
function spearTexture() {
  return drawPart(0.5, 4.4, (g) => {
    g.beginPath();
    g.moveTo(0.25, 0.02);
    g.quadraticCurveTo(0.47, 0.36, 0.3, 0.8);
    g.lineTo(0.2, 0.8);
    g.quadraticCurveTo(0.03, 0.36, 0.25, 0.02);
    g.closePath();
    g.fill();
    g.fillRect(0.19, 0.8, 0.12, 0.12);
    poly(g, [[0.25, 0.86], [0.48, 0.78], [0.45, 0.92]]);
    poly(g, [[0.25, 0.86], [0.02, 0.78], [0.05, 0.92]]);
    for (let i = -2; i <= 2; i++) poly(g, [[0.25 + i * 0.045 - 0.02, 0.92], [0.25 + i * 0.045 + 0.02, 0.92], [0.25 + i * 0.05, 1.12 + (i % 2 === 0 ? 0.06 : 0)]]);
    g.fillRect(0.225, 0.9, 0.05, 3.45);
    poly(g, [[0.25, 4.4], [0.3, 4.18], [0.2, 4.18]]);
    cut(g, () => {
      poly(g, [[0.25, 0.22], [0.31, 0.42], [0.25, 0.62], [0.19, 0.42]]);
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Shaders.

const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

const PUPPET_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** Black cut-out with a faint violet rim; burns away from its edges into violet embers as uBurn goes 0 to 1. */
const PUPPET_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uBurn, uSeed;
  uniform vec2 uTexel;
  varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    float a = texture2D(uMap, vUv).a;
    if (a < 0.5) discard;
    float solid = 0.0;
    solid += step(0.5, texture2D(uMap, vUv + vec2(uTexel.x * 2.0, 0.0)).a);
    solid += step(0.5, texture2D(uMap, vUv - vec2(uTexel.x * 2.0, 0.0)).a);
    solid += step(0.5, texture2D(uMap, vUv + vec2(0.0, uTexel.y * 2.0)).a);
    solid += step(0.5, texture2D(uMap, vUv - vec2(0.0, uTexel.y * 2.0)).a);
    float edge = 1.0 - solid / 4.0;
    float b = vnoise(vUv * 7.0 + uSeed) * 0.7 + (1.0 - edge) * 0.3;
    float th = uBurn * 1.12 - 0.06;
    if (b < th) discard;
    vec3 col = mix(vec3(0.012, 0.006, 0.025), vec3(0.05, 0.012, 0.11), edge);
    float glow = smoothstep(th + 0.1, th, b) * step(0.001, uBurn);
    col = mix(col, vec3(0.25, 0.027, 0.75), smoothstep(0.0, 0.5, glow));
    col = mix(col, vec3(0.67, 0.26, 1.0), smoothstep(0.55, 1.0, glow));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SCREEN_VERT = PUPPET_VERT;

/** Back-lit paper: pale centre to violet edge, fibres, dark frame, unrolls from the top, tears away in ragged holes. */
const SCREEN_FRAG = /* glsl */ `
  uniform float uReveal, uOpacity, uTear, uFlicker, uHit;
  uniform vec3 uCentre, uRim, uHot;
  varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    float dv = 1.0 - vUv.y;
    if (dv > uReveal) discard;
    vec2 q = (vUv - 0.5) * vec2(1.7, 2.0);
    float r = length(q);
    vec3 col = mix(uCentre, uRim, smoothstep(0.3, 1.25, r));
    float fib = vnoise(vec2(vUv.x * 70.0, vUv.y * 7.0)) * 0.5 + vnoise(vUv * vec2(9.0, 34.0)) * 0.5;
    col *= (0.94 + 0.1 * fib) * (1.08 + 0.05 * uFlicker);
    col = mix(col, uHot, uHit * (1.0 - smoothstep(0.0, 1.1, r)));
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    col = mix(col, vec3(0.01, 0.005, 0.02), 1.0 - smoothstep(0.012, 0.022, e));
    if (uReveal - dv < 0.014) col = vec3(0.01, 0.005, 0.02);
    float tn = vnoise(vUv * vec2(5.0, 7.0) + 3.0) * 0.6 + vnoise(vUv * 17.0) * 0.4 + (1.0 - vUv.y) * 0.25;
    float th = uTear * 1.3 - 0.05;
    if (tn < th) discard;
    col = mix(col, uHot, smoothstep(th + 0.06, th, tn) * step(0.001, uTear));
    gl_FragColor = vec4(col, uOpacity);
  }
`;

// ---------------------------------------------------------------------------------------------------------------
// Puppets.

interface PuppetCfg {
  dir: number; // +1 faces camera-right, -1 faces camera-left
  scale: number;
  enter: number;
  startX: number;
  screenX: number;
  /** [right, depth along the cast direction, feet height] while surrounding the target. */
  stand: [number, number, number];
  /** [right, depth, feet height] at the thrust. */
  strike: [number, number, number];
  aerial: boolean;
  seed: number;
  /** Floppy limb angles after the strings are cut. */
  flop: { arm: number; fore: number; armB: number; thF: number; shF: number; thB: number; shB: number; spear: number };
}

const CFGS: PuppetCfg[] = [
  {
    dir: 1, scale: 0.88, enter: 0.6, startX: -5.1, screenX: -3.9, stand: [-3.6, 0, 0], strike: [-3.0, 0, 0], aerial: false, seed: 1.7,
    flop: { arm: 1.9, fore: -0.8, armB: -1.2, thF: 0.5, shF: -0.9, thB: -0.6, shB: -0.4, spear: 0.5 },
  },
  {
    dir: -1, scale: 0.88, enter: 0.78, startX: 5.1, screenX: 3.9, stand: [3.6, 0, 0], strike: [3.0, 0, 0], aerial: false, seed: 4.1,
    flop: { arm: -1.6, fore: 0.9, armB: 1.4, thF: -0.4, shF: -1.1, thB: 0.7, shB: -0.3, spear: -0.4 },
  },
  {
    dir: 1, scale: 0.98, enter: 1.0, startX: 0, screenX: 0, stand: [-1.6, 0.9, 3.0], strike: [-1.3, 0.8, 1.9], aerial: true, seed: 8.3,
    flop: { arm: 1.2, fore: 0.9, armB: -1.6, thF: 0.9, shF: -1.4, thB: 0.2, shB: -1.0, spear: 0.8 },
  },
];

class Puppet {
  readonly root = new THREE.Group();
  readonly flip = new THREE.Group();
  readonly fall = new THREE.Group();
  readonly hip = new THREE.Group();
  readonly torso = new THREE.Group();
  readonly armF = new THREE.Group();
  readonly foreF = new THREE.Group();
  readonly hand = new THREE.Group();
  readonly armB = new THREE.Group();
  readonly foreB = new THREE.Group();
  readonly thF = new THREE.Group();
  readonly shF = new THREE.Group();
  readonly thB = new THREE.Group();
  readonly shB = new THREE.Group();
  readonly parts: THREE.Mesh[] = [];
  readonly burn = { value: 0 };
  readonly string: THREE.Line;
  private stringGeo = new THREE.BufferGeometry();

  constructor(readonly cfg: PuppetCfg, tex: Record<'torso' | 'arm' | 'fore' | 'thigh' | 'shin' | 'spear', THREE.CanvasTexture>) {
    const mk = (map: THREE.CanvasTexture, w: number, h: number, ax: number, ay: number, z: number, parent: THREE.Object3D) => {
      const geo = new THREE.PlaneGeometry(w, h).translate(w / 2 - ax, ay - h / 2, 0);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: map },
          uBurn: this.burn,
          uSeed: { value: cfg.seed + this.parts.length * 1.3 },
          uTexel: { value: new THREE.Vector2(1 / (w * PX), 1 / (h * PX)) },
        },
        vertexShader: PUPPET_VERT,
        fragmentShader: PUPPET_FRAG,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.z = z;
      m.renderOrder = 10;
      parent.add(m);
      this.parts.push(m);
      return m;
    };
    const at = (g: THREE.Group, x: number, y: number, parent: THREE.Object3D) => {
      g.position.set(x, y, 0);
      parent.add(g);
    };

    this.root.add(this.flip);
    this.flip.scale.x = cfg.dir;
    this.flip.add(this.fall);
    this.fall.add(this.hip);
    this.hip.position.y = 1.9;

    // Back limbs sit behind the torso, front limbs in front of it.
    at(this.thB, 0, 0, this.hip);
    mk(tex.thigh, 0.5, 0.95, 0.25, 0, -0.06, this.thB);
    at(this.shB, 0, -0.95, this.thB);
    mk(tex.shin, 0.55, 0.95, 0.25, 0, -0.06, this.shB);
    at(this.thF, 0, 0, this.hip);
    mk(tex.thigh, 0.5, 0.95, 0.25, 0, 0.06, this.thF);
    at(this.shF, 0, -0.95, this.thF);
    mk(tex.shin, 0.55, 0.95, 0.25, 0, 0.06, this.shF);

    at(this.torso, 0, 0, this.hip);
    mk(tex.torso, 1.35, 2.1, 0.65, 2.1, 0, this.torso);
    // Shoulder at canvas (0.68, 1.12) of the torso = local (0.03, 0.98).
    at(this.armB, 0.03, 0.98, this.torso);
    mk(tex.arm, 0.4, 0.85, 0.2, 0.08, -0.04, this.armB);
    at(this.foreB, 0, -0.77, this.armB);
    mk(tex.fore, 0.36, 0.8, 0.18, 0.06, -0.04, this.foreB);
    at(this.armF, 0.03, 0.98, this.torso);
    mk(tex.arm, 0.4, 0.85, 0.2, 0.08, 0.1, this.armF);
    at(this.foreF, 0, -0.77, this.armF);
    mk(tex.fore, 0.36, 0.8, 0.18, 0.06, 0.1, this.foreF);
    at(this.hand, 0, -0.64, this.foreF);
    mk(tex.spear, 0.5, 4.4, 0.25, 2.6, 0.12, this.hand);

    this.root.scale.setScalar(cfg.scale);
    this.stringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.string = new THREE.Line(this.stringGeo, new THREE.LineBasicMaterial({ color: 0x000000 }));
    this.string.frustumCulled = false;
  }

  setString(a: THREE.Vector3, b: THREE.Vector3) {
    const p = this.stringGeo.attributes.position as THREE.BufferAttribute;
    p.setXYZ(0, a.x, a.y, a.z);
    p.setXYZ(1, b.x, b.y, b.z);
    p.needsUpdate = true;
  }
}

/** Orientation of a plane whose face (+Z) points back toward the caster. */
function screenYaw(fwd: THREE.Vector3) {
  return Math.atan2(-fwd.x, -fwd.z);
}

const SPIKES = 14;

export class ShadowPuppetExecution implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShadowPuppetExecutionSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private hitDone = false;
  private smokeDone = false;

  // Cast geometry.
  private target = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private yaw = 0;

  private screenUniforms = {
    uReveal: { value: 0 }, uOpacity: { value: 0.97 }, uTear: { value: 0 }, uFlicker: { value: 0 }, uHit: { value: 0 },
    uCentre: { value: new THREE.Color(0xe8dcf4) }, uRim: { value: new THREE.Color(BODY) }, uHot: { value: new THREE.Color(HOT) },
  };
  private paper = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_W, SCREEN_H).translate(0, SCREEN_H / 2, 0),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: this.screenUniforms, vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG,
    }),
  );

  private puppets: Puppet[] = [];

  private inkStar = new StarBurst({ points: 12, inner: 0.22, jitter: 0.4, color: INK, core: INK_VIOLET, additive: false });
  private hitStar = new StarBurst({ points: 8, inner: 0.3, color: MAGENTA, core: MAGENTA, additive: false });
  private spikeMat = new THREE.MeshBasicMaterial({ color: INK });
  private spikes: THREE.Mesh[] = [];
  private spikeDir: THREE.Vector3[] = [];
  private spikeLen: number[] = [];
  private smoke = new SmokeBall({ color: INK, rim: 0x2a0a4a, flake: BODY, maxBalls: 3 });

  private inkBurst: Emitter;
  private spray: Emitter;
  private embers: Emitter;

  constructor(settings: ShadowPuppetExecutionSettings = defaultShadowPuppetExecution()) {
    this.settings = settings;
    this.screen.tint.set(INK);
    this.screen.impactColor.set(BODY);
    this.screen.speedLineColor.set(HOT);
    this.screen.keepHue.set(BODY);
    this.screen.edgeTint.set(MAGENTA);

    this.paper.renderOrder = 1;
    this.group.add(this.paper);

    const tex = {
      torso: torsoTexture(), arm: armTexture(), fore: foreTexture(), thigh: thighTexture(), shin: shinTexture(), spear: spearTexture(),
    };
    for (const cfg of CFGS) {
      const p = new Puppet(cfg, tex);
      this.puppets.push(p);
      this.group.add(p.root, p.string);
    }

    this.inkStar.mesh.renderOrder = 30;
    this.hitStar.mesh.renderOrder = 31;
    this.group.add(this.inkStar.mesh, this.hitStar.mesh, this.smoke.mesh);

    // Short black ink spikes bursting from the target.
    const cone = new THREE.ConeGeometry(0.17, 1, 6).translate(0, 0.5, 0);
    for (let i = 0; i < SPIKES; i++) {
      const m = new THREE.Mesh(cone, this.spikeMat);
      m.visible = false;
      m.renderOrder = 28;
      this.spikes.push(m);
      this.spikeDir.push(new THREE.Vector3(0, 1, 0));
      this.spikeLen.push(1);
      this.group.add(m);
    }

    this.inkBurst = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.45, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.25, speed: 5, speedJitter: 0.5, spread: 180, gravity: 8, drag: 2.6,
      sizeStart: 0.28, sizeEnd: 0.06, colorStart: '#12062a', colorEnd: '#07030c',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.3,
    });
    this.spray = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.5, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.25, speed: 9, speedJitter: 0.6, spread: 180, gravity: 9, drag: 1.8,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#f0d8ff', colorEnd: '#8a2ee0',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.12, speed: 0.9, speedJitter: 0.7, spread: 60, gravity: -1.2, drag: 0.8,
      sizeStart: 0.11, sizeEnd: 0.0, colorStart: '#d68cff', colorEnd: '#8a2ee0',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.5, erosion: 0, spin: 0.5,
    });
    this.emitters.push(this.inkBurst, this.spray, this.embers, this.smoke.emitter);
    for (const e of [this.inkBurst, this.spray, this.embers]) this.group.add(e.points);
    this.reset();
  }

  get impactTime() {
    return D;
  }
  get duration() {
    return DURATION;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const t = ctx.targetPos[0] ?? ctx.point;
    this.target.copy(t).setY(0);
    // The gameplay camera sits behind the caster looking at the target: "forward" is caster -> target.
    this.fwd.set(this.target.x - ctx.from.x, 0, this.target.z - ctx.from.z);
    if (this.fwd.lengthSq() < 1e-3) this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.fwd.lengthSq() < 1e-6) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    this.yaw = screenYaw(this.fwd);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.target).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitDone = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.hitDone && this.time >= D) this.onHit();
    if (!this.smokeDone && this.hitDone && this.time >= D + 0.05) {
      this.smokeDone = true;
      this.smoke.trigger(this.target.clone().addScaledVector(this.fwd, -0.6).setY(0.5), 0.7, 0.7);
    }
    this.layout(dt);
  }

  /** World point from (right, depth along the cast direction, height) relative to the target. */
  private world(x: number, d: number, y: number, out: THREE.Vector3) {
    return out.copy(this.target).addScaledVector(this.right, x).addScaledVector(this.fwd, d).setY(y);
  }

  private layout(dt: number) {
    const t = this.time;
    const ts = Math.floor(t * 12) / 12; // puppet animation runs at 12 fps
    const after = t - D;
    const over = t >= DURATION;

    // --- World grade: dark, so the lit paper is the brightest thing in the frame. ---
    this.screen.darken = over ? 0 : after < 0.3 ? 0.85 * smoothstep(t / 0.5) : 0.85 * (1 - smoothstep((after - 0.3) / 1.2));
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.8);
    this.screen.speedLines = t >= D - 0.2 && t < D ? 0.4 * smoothstep((t - (D - 0.2)) / 0.2) : Math.max(0, 0.4 * (1 - Math.max(0, after) * 8));

    // --- Paper screen. ---
    const reveal = smoothstep(t / UNROLL);
    const tear = smoothstep((after - 0.35) / 1.1);
    const u = this.screenUniforms;
    u.uReveal.value = reveal;
    u.uTear.value = tear;
    u.uFlicker.value = Math.sin(ts * 47.0) * 0.5;
    u.uHit.value = after >= 0 ? 0.5 * Math.exp(-after * 10) : 0;
    this.paper.visible = !over && tear < 0.999;
    this.paper.position.copy(this.target).addScaledVector(this.fwd, SCREEN_DIST).setY(0);
    this.paper.rotation.y = this.yaw;

    // --- Puppets. ---
    const T = new THREE.Vector3(this.target.x, 1.1, this.target.z);
    const hw = new THREE.Vector3();
    const headTop = new THREE.Vector3();
    const stringTop = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    this.puppets.forEach((p, i) => {
      const c = p.cfg;
      const entered = t >= c.enter;
      const burnT = clamp01((after - 0.7 - i * 0.08) / 0.8);
      p.burn.value = burnT;
      p.root.visible = entered && !over && burnT < 0.999;
      p.string.visible = entered && !over && after < COLLAPSE && tear < 0.5;
      if (!p.root.visible) return;

      // Stepped phases.
      const walkK = clamp01((ts - c.enter) / 0.55);
      const stepE = smoothstep(clamp01((ts - STEP0) / (STEP1 - STEP0)));
      const stepping = ts >= STEP0 && ts < STEP1 + 0.05;
      const walking = (!c.aerial && walkK < 1) || stepping;
      const s = after >= 0 ? (after < 0.04 ? 0.5 : 1) : 0; // thrust lands in two frames
      const cAge = after - COLLAPSE;
      const kc = cAge > 0 ? smoothstep(cAge / 0.3) : 0;
      const kf = cAge > 0 ? clamp01(cAge / 0.5) : 0;
      const fallAng = 1.45 * kf * kf;

      // Position: on the screen, then stepped off into the arena, then the thrust.
      let sx = c.screenX;
      if (!c.aerial) sx = lerp(c.startX, c.screenX, 1 - (1 - walkK) * (1 - walkK));
      const onX = sx, onD = SCREEN_DIST - 0.15, onY = 0.5;
      let x = lerp(onX, c.stand[0], stepE);
      let d = lerp(onD, c.stand[1], stepE);
      let y = lerp(onY, c.stand[2], stepE);
      x = lerp(x, c.strike[0], s);
      d = lerp(d, c.strike[1], s);
      y = lerp(y, c.strike[2], s);
      if (cAge > 0) y = lerp(y, 0.05, kf * kf);
      this.world(x, d, y, p.root.position);
      p.root.rotation.y = this.yaw;
      // Pop in: stepped scale-up (the centre puppet appears on the screen at once).
      const pop = c.aerial ? [0.55, 0.8, 1][Math.min(2, Math.floor((ts - c.enter) * 12))] ?? 1 : 1;
      p.root.scale.setScalar(Math.max(1e-4, c.scale * pop));

      // Pose.
      const ph = ts * 10 + i * 1.7;
      const stepUp = smoothstep(clamp01((ts - 1.7) / 0.3));
      let tr = -0.03 + 0.02 * Math.sin(ts * 14 + i);
      let hipY = 1.9;
      let armF = lerp(0.55, 0.9, stepUp), foreF = lerp(0.5, 0.35, stepUp);
      let armB = -0.3, foreB = 0.5;
      let thF = 0.05, shF = -0.05, thB = -0.05, shB = 0.02;
      let phi = lerp(1.15, 1.35, stepUp);
      if (walking && !c.aerial) {
        thF = 0.45 * Math.sin(ph); shF = -0.5 * Math.max(0, Math.sin(ph + 1.3));
        thB = -thF; shB = -0.5 * Math.max(0, Math.sin(ph + 1.3 + Math.PI));
        armB = -0.4 * Math.sin(ph); hipY -= 0.07 * Math.abs(Math.sin(ph));
      } else if (c.aerial) {
        // The flier tucks its legs while it floats over.
        thF = lerp(0.1, 0.9, stepE); shF = lerp(-0.05, -1.3, stepE);
        thB = lerp(-0.05, 0.2, stepE); shB = lerp(0.02, -1.0, stepE);
        hipY -= 0.25 * stepE;
      }
      // Thrust pose.
      if (s > 0) {
        tr = lerp(tr, -0.22, s);
        hipY = lerp(hipY, c.aerial ? 1.5 : 1.57, s);
        armF = lerp(armF, 1.3, s); foreF = lerp(foreF, 0.1, s);
        armB = lerp(armB, 0.5, s); foreB = lerp(foreB, 0.9, s);
        if (!c.aerial) {
          thF = lerp(thF, 0.85, s); shF = lerp(shF, -0.9, s);
          thB = lerp(thB, -0.7, s); shB = lerp(shB, 0.2, s);
        } else {
          thF = lerp(thF, 1.1, s); shF = lerp(shF, -1.6, s);
          thB = lerp(thB, 0.5, s); shB = lerp(shB, -1.4, s);
        }
      }
      // Strings cut: limbs go limp, the body topples.
      if (kc > 0) {
        const f = c.flop;
        tr = lerp(tr, 0.2, kc);
        armF = lerp(armF, f.arm, kc); foreF = lerp(foreF, f.fore, kc);
        armB = lerp(armB, f.armB, kc); foreB = lerp(foreB, 0.6, kc);
        thF = lerp(thF, f.thF, kc); shF = lerp(shF, f.shF, kc);
        thB = lerp(thB, f.thB, kc); shB = lerp(shB, f.shB, kc);
        hipY = lerp(hipY, 1.9, kc);
      }
      p.fall.rotation.z = fallAng;
      p.hip.position.y = hipY;
      p.torso.rotation.z = tr;
      p.armF.rotation.z = armF; p.foreF.rotation.z = foreF;
      p.armB.rotation.z = armB; p.foreB.rotation.z = foreB;
      p.thF.rotation.z = thF; p.shF.rotation.z = shF;
      p.thB.rotation.z = thB; p.shB.rotation.z = shB;

      // Spear: world direction phi (angle from the facing direction), aimed at the target on the thrust.
      p.hand.rotation.z = 0;
      if (s > 0) {
        p.root.updateMatrixWorld(true);
        p.hand.getWorldPosition(hw);
        const face = tmp.copy(this.right).multiplyScalar(c.dir);
        const dx = (T.x - hw.x) * face.x + (T.z - hw.z) * face.z;
        const aim = Math.atan2(T.y - hw.y, Math.max(0.3, dx));
        phi = lerp(phi, aim, s);
      }
      let rel = phi - Math.PI / 2 - (tr + armF + foreF + fallAng);
      if (kc > 0) rel = lerp(rel, c.flop.spear, kc);
      p.hand.rotation.z = rel;

      // String from the head up to the rod, cut at the collapse.
      p.root.updateMatrixWorld(true);
      headTop.copy(p.root.position).addScaledVector(this.right, c.dir * 0.12 * c.scale).setY(p.root.position.y + (hipY + 1.62) * c.scale);
      stringTop.copy(headTop).setY(8.4);
      p.setString(headTop, stringTop);

      // Embers while the cut-outs burn away.
      if (dt > 0 && burnT > 0.02 && burnT < 0.97) {
        for (let k = 0; k < 4; k++) {
          const part = p.parts[Math.floor(Math.random() * p.parts.length)];
          part.getWorldPosition(hw);
          this.embers.burst(1, hw);
        }
      }
    });

    // --- Impact: black ink star under a magenta star, short ink spikes. ---
    const hitPos = new THREE.Vector3(this.target.x, 1.2, this.target.z).addScaledVector(this.fwd, -0.6);
    const pop1 = StarBurst.pop(after, 0.0, 0.03);
    this.inkStar.set(hitPos, 3.6 * pop1.scale, pop1.opacity, 0.3);
    const pop2 = StarBurst.pop(after - 0.01, 0.0, 0.03);
    this.hitStar.set(hitPos.clone().addScaledVector(this.fwd, -0.3), 2.1 * pop2.scale, pop2.opacity, 0);
    for (let i = 0; i < SPIKES; i++) {
      const sp = this.spikes[i];
      const grow = after >= 0 ? clamp01(after / 0.04) : 0;
      const shrink = clamp01((after - 0.12) / 0.28);
      const k = grow * (1 - shrink * shrink);
      sp.visible = k > 0.02;
      if (!sp.visible) continue;
      sp.position.set(this.target.x, 1.0, this.target.z).addScaledVector(this.spikeDir[i], 0.25);
      sp.quaternion.setFromUnitVectors(UP, this.spikeDir[i]);
      sp.scale.set(Math.max(1e-4, k), Math.max(1e-4, k * this.spikeLen[i]), Math.max(1e-4, k));
    }

    this.shake = after >= 0 ? 0.7 * Math.exp(-after * 7) : 0;
  }

  private onHit() {
    this.hitDone = true;
    const c = new THREE.Vector3(this.target.x, 1.2, this.target.z);
    this.inkBurst.burst(24, c);
    this.spray.burst(30, c);
    // Spikes fan out from the target, mostly sideways and toward the camera.
    for (let i = 0; i < SPIKES; i++) {
      const a = (i / SPIKES) * Math.PI * 2 + Math.random() * 0.3;
      const el = (Math.random() - 0.3) * 1.0;
      const dir = new THREE.Vector3()
        .addScaledVector(this.right, Math.cos(a))
        .addScaledVector(this.fwd, -Math.abs(Math.sin(a)) * 0.6)
        .setY(Math.sin(el) * 0.9 + 0.1);
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      this.spikeDir[i].copy(dir.normalize());
      this.spikeLen[i] = 1.1 + Math.random() * 0.8;
    }
    const ctx = this.ctx;
    const e = ctx?.targets[0];
    if (ctx && e) {
      const from = this.target.clone().addScaledVector(this.right, -2).setY(0);
      ctx.hit(e, { damage: this.settings.damage, knock: 3, from, color: '#ff3fa0' });
    }
  }
}

export const shadowPuppetExecutionModule: EffectModule = {
  label: 'shadow puppet execution',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new ShadowPuppetExecution(),
  telegraphs(effect) {
    const e = effect as ShadowPuppetExecution;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: 2 }, start: STEP0, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.5, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as ShadowPuppetExecution;
    if (e.ctx) frameCast(camera, controls, e.ctx, SCREEN_H);
  },
  buildGui(f, effect) {
    const s = (effect as ShadowPuppetExecution).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
