import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Sandstorm Djinn (targeted, `self` mode, Arabian-nights desert): sand ripples spiral across the ground and a
 * twisted toon-band sand funnel (ochre, dune shade, storm-brown lines, no glow) spins up round the caster. A giant
 * hand-drawn djinn (canvas sprite: bronze skin, folded arms, gold jewellery, teal turban, black outlines, only the
 * eyes glow teal) rises out of it high behind the caster, always turned to the camera, with a smoky sand tail. The
 * enemies in range are dragged in a little and ticked three times. It raises its hands, a dead beat, then CLAPS:
 * short sand/black impact frames, a flat toon ring and sand sheets blast outward, enemies hurled away. The djinn
 * crumbles into falling sand while the funnel slows, sinks and dissolves.
 *
 * Every sand colour is a toon band below the bloom threshold. Palette: sand white #fff0d0 (thin edges only) ->
 * sand gold #e8b860 -> dune ochre #b8803a -> djinn teal #3ad8c8 (eyes, a gem, the clap glint) -> storm brown #2a1a0c.
 *
 * Recipes: j-lelu-twisted-wind-tornado (twisted funnel, texture scrolled against the spin, alpha-clipped),
 * e-yordin-soft-wind-swirl (swirl sheets as crescents on tilted planes), a-marvel-rivals-doctor-strange-eye-of-agamotto
 * (a big figure that rises behind the caster, then a ring blast).
 */
export interface SandstormDjinnSettings {
  damage: number;
  tickDamage: number;
  knock: number;
  loop: boolean;
}

export const defaultSandstormDjinn = (): SandstormDjinnSettings => ({ damage: 45, tickDamage: 6, knock: 9, loop: false });

const D = 2.1; // the clap
const DURATION = 4.8;
const RADIUS = 6;
const GATHER = 0.7;
const RAISE_AT = 1.8; // hands go up
const TICKS = [0.95, 1.35, 1.75];
const H = 5.5; // funnel height, metres
const TWIST = 1.2;
const SPIN = 5.5;
const N_SLICE = 5;
const MAX_STARS = 6;

// Djinn sprite: canvas 640 x 768 drawn onto a plane of SPR_W x SPR_H metres.
const CW = 640;
const CH = 768;
const SPR_H = 6.4;
const SPR_W = SPR_H * (CW / CH);
const BACK = 3.0; // metres behind the caster (away from the target)
const Y_LOW = 4.4;
const Y_HIGH = 7.0;

// Sand: toon bands, all under the bloom threshold.
const DARK = 0x2a1a0c;
const EDGE = 0xe0c48e;
const MID = 0xc4903f;
const SHADE = 0x8a5a26;
const GOLD = 0xd8a850;
const TEAL = 0x3ad8c8;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const fract = (x: number) => x - Math.floor(x);

/** Funnel wall radius at normalised height 0..1 (the same formula runs in the funnel vertex shader). */
const radiusAt = (hn: number) => 1.4 + 1.9 * Math.pow(hn, 1.5) + 0.5 * smoothstep((hn - 0.85) / 0.15);

type Pt = [number, number];

/** A fat polyline with a black outline under a flat fill and a thin highlight on its upper edge. */
function limb(g: CanvasRenderingContext2D, pts: Pt[], outW: number, fillW: number, fill: string, hi: string) {
  const path = () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#1c1008';
  g.lineWidth = outW;
  path();
  g.stroke();
  g.strokeStyle = fill;
  g.lineWidth = fillW;
  path();
  g.stroke();
  g.save();
  g.translate(0, -fillW * 0.22);
  g.strokeStyle = hi;
  g.lineWidth = fillW * 0.16;
  path();
  g.stroke();
  g.restore();
}

/** A gold band across a limb at fraction `k` of a segment, perpendicular to it. */
function band(g: CanvasRenderingContext2D, a: Pt, b: Pt, k: number, len: number) {
  const x = a[0] + (b[0] - a[0]) * k;
  const y = a[1] + (b[1] - a[1]) * k;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  const seg: Pt[] = [[x - nx * len, y - ny * len], [x + nx * len, y + ny * len]];
  limb(g, seg, 28, 18, '#c8902a', '#e6b850');
}

/**
 * The djinn as one hard-edged drawing, upper body plus a smoky tail that curls down. `raised` = hands lifted over
 * the head ready to clap, otherwise the arms are folded over the chest. Black outlines, three-step skin and sand
 * ramps, gold jewellery, teal turban; only the eyes are the bright teal.
 */
function djinnTexture(raised: boolean): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = CW;
  cv.height = CH;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const OUT = '#1c1008';
  const SKIN = '#a8683a', SKIN_SH = '#7c4624', SKIN_HI = '#c98a52';
  const GOLD_C = '#c8902a', GOLD_HI = '#e6b850';
  const TEAL_C = '#2fb8aa', TEAL_DK = '#1e7f78';
  const SAND_C = '#c4903f', SAND_SH = '#8a5a26', SAND_HI = '#e0c48e';

  // 1. Tail: a tapering S-curve of smoke, filled with sand bands and little curls on its edges.
  const spine = (t: number): Pt => [320 + 62 * Math.sin(t * 5.0) * (0.35 + t), 498 + t * 252];
  const half = (t: number) => 80 * Math.pow(1 - t, 0.85) + 3;
  const left: Pt[] = [], right: Pt[] = [];
  const N = 44;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = spine(t), q = spine(Math.min(1, t + 0.01));
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    left.push([p[0] + nx * half(t), p[1] + ny * half(t)]);
    right.push([p[0] - nx * half(t), p[1] - ny * half(t)]);
  }
  const tailPath = () => {
    g.beginPath();
    g.moveTo(left[0][0], left[0][1]);
    for (const p of left) g.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath();
  };
  tailPath();
  g.strokeStyle = OUT;
  g.lineWidth = 16;
  g.stroke();
  const tg = g.createLinearGradient(240, 0, 400, 0);
  tg.addColorStop(0, SAND_SH);
  tg.addColorStop(0.45, SAND_C);
  tg.addColorStop(1, SAND_SH);
  g.fillStyle = tg;
  tailPath();
  g.fill();
  // Flow lines along the tail.
  for (const [k, col, w] of [[0.55, SAND_SH, 5], [0.0, SAND_HI, 4], [-0.55, SAND_SH, 5]] as [number, string, number][]) {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    for (let i = 4; i <= N - 4; i++) {
      const t = i / N;
      const p = spine(t), q = spine(Math.min(1, t + 0.01));
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const l = Math.hypot(dx, dy) || 1;
      const x = p[0] - (dy / l) * half(t) * k * 0.9, y = p[1] + (dx / l) * half(t) * k * 0.9;
      if (i === 4) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  // Wisp curls on the tail edge.
  for (const [t, side] of [[0.2, 1], [0.42, -1], [0.62, 1]] as [number, number][]) {
    const p = spine(t);
    const cx = p[0] + side * (half(t) + 4), cy = p[1];
    for (const [col, w] of [[OUT, 8], [SAND_HI, 3]] as [string, number][]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.arc(cx, cy, 15, side > 0 ? Math.PI * 0.7 : -Math.PI * 0.3, side > 0 ? Math.PI * 2.0 : Math.PI * 1.0);
      g.stroke();
    }
  }

  // 2. Torso.
  const torso = () => {
    g.beginPath();
    g.moveTo(175, 305);
    g.quadraticCurveTo(320, 250, 465, 305);
    g.lineTo(425, 400);
    g.lineTo(392, 485);
    g.lineTo(248, 485);
    g.lineTo(215, 400);
    g.closePath();
  };
  torso();
  g.strokeStyle = OUT;
  g.lineWidth = 16;
  g.stroke();
  const bg = g.createLinearGradient(180, 0, 460, 0);
  bg.addColorStop(0, SKIN_SH);
  bg.addColorStop(0.35, SKIN);
  bg.addColorStop(0.7, SKIN);
  bg.addColorStop(1, SKIN_SH);
  g.fillStyle = bg;
  torso();
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(320, 305); g.lineTo(320, 395);
  g.moveTo(240, 385); g.quadraticCurveTo(285, 410, 320, 392);
  g.moveTo(400, 385); g.quadraticCurveTo(355, 410, 320, 392);
  if (raised) {
    g.moveTo(320, 410); g.lineTo(320, 470);
    g.moveTo(285, 430); g.lineTo(355, 430);
    g.moveTo(290, 458); g.lineTo(350, 458);
  }
  g.stroke();
  // Neck.
  g.fillStyle = SKIN_SH;
  g.strokeStyle = OUT;
  g.lineWidth = 8;
  g.beginPath();
  g.rect(292, 245, 56, 52);
  g.fill();
  g.stroke();
  // Sash with a gold buckle.
  g.fillStyle = TEAL_C;
  g.strokeStyle = OUT;
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(240, 468); g.lineTo(400, 468); g.lineTo(410, 504); g.lineTo(230, 504);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = TEAL_DK;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(236, 490); g.lineTo(404, 490);
  g.stroke();
  g.fillStyle = GOLD_C;
  g.strokeStyle = OUT;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(320, 486, 17, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Gold collar necklace with a teal drop.
  limb(g, [[236, 318], [262, 352], [320, 372], [378, 352], [404, 318]], 22, 12, GOLD_C, GOLD_HI);
  g.fillStyle = TEAL_C;
  g.strokeStyle = OUT;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(320, 370); g.lineTo(334, 394); g.lineTo(320, 416); g.lineTo(306, 394);
  g.closePath();
  g.fill();
  g.stroke();

  // 3. Arms, deltoids first.
  for (const sx of [185, 455]) {
    g.fillStyle = SKIN;
    g.strokeStyle = OUT;
    g.lineWidth = 10;
    g.beginPath();
    g.arc(sx, 322, 54, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  const armA: Pt[] = raised ? [[455, 322], [556, 218], [346, 84]] : [[455, 322], [447, 432], [255, 352]];
  const armB: Pt[] = raised ? [[185, 322], [84, 218], [294, 84]] : [[185, 322], [193, 432], [385, 366]];
  for (const arm of [armA, armB]) {
    limb(g, arm, 92, 74, SKIN, SKIN_HI);
    band(g, arm[0], arm[1], 0.5, 44);
    band(g, arm[1], arm[2], 0.78, 40);
    const hand = arm[2];
    g.fillStyle = SKIN;
    g.strokeStyle = OUT;
    g.lineWidth = 10;
    g.beginPath();
    g.arc(hand[0], hand[1], 42, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = OUT;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(hand[0] - 22, hand[1] + 6); g.lineTo(hand[0] + 22, hand[1] + 6);
    g.stroke();
  }

  // 4. Head: face, beard, turban, brows and the teal eyes.
  g.fillStyle = SKIN;
  g.strokeStyle = OUT;
  g.lineWidth = 10;
  g.beginPath();
  g.arc(320, 212, 50, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  for (const sx of [-1, 1]) {
    g.strokeStyle = OUT;
    g.lineWidth = 9;
    g.beginPath();
    g.arc(320 + sx * 52, 236, 11, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = GOLD_HI;
    g.lineWidth = 4;
    g.stroke();
  }
  // Beard and moustache.
  g.fillStyle = '#2a1a0c';
  g.strokeStyle = OUT;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(282, 238);
  g.quadraticCurveTo(300, 252, 320, 246);
  g.quadraticCurveTo(340, 252, 358, 238);
  g.quadraticCurveTo(352, 290, 320, 312);
  g.quadraticCurveTo(288, 290, 282, 238);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = '#4a2c14';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(320, 262); g.lineTo(320, 296);
  g.stroke();
  // Turban.
  g.fillStyle = TEAL_C;
  g.strokeStyle = OUT;
  g.lineWidth = 10;
  g.beginPath();
  g.ellipse(320, 168, 64, 42, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.strokeStyle = TEAL_DK;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(262, 160); g.quadraticCurveTo(320, 128, 380, 150);
  g.moveTo(258, 176); g.quadraticCurveTo(320, 146, 384, 170);
  g.stroke();
  limb(g, [[262, 192], [320, 204], [378, 192]], 20, 11, GOLD_C, GOLD_HI);
  g.fillStyle = GOLD_C;
  g.strokeStyle = OUT;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(320, 132); g.lineTo(334, 156); g.lineTo(320, 178); g.lineTo(306, 156);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#1e7f78';
  g.beginPath();
  g.moveTo(320, 144); g.lineTo(327, 156); g.lineTo(320, 168); g.lineTo(313, 156);
  g.closePath();
  g.fill();
  // Brows and eyes.
  g.strokeStyle = OUT;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(280, 202); g.lineTo(314, 212);
  g.moveTo(360, 202); g.lineTo(326, 212);
  g.stroke();
  g.fillStyle = '#3ad8c8';
  g.strokeStyle = OUT;
  g.lineWidth = 3;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(320 + sx * 30, 216);
    g.lineTo(320 + sx * 6, 222);
    g.lineTo(320 + sx * 9, 230);
    g.lineTo(320 + sx * 30, 224);
    g.closePath();
    g.fill();
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The djinn sprite: opaque alpha-clipped. `uReveal` shows it from the bottom up (rising out of the funnel, with a
 * speckled edge); `uFade` crumbles it into grains, the top first.
 */
function djinnMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uMap: { value: map }, uReveal: { value: 0 }, uFade: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uReveal, uFade;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec4 tx = texture2D(uMap, vUv);
        if (tx.a < 0.5) discard;
        float n = hash(floor(vUv * vec2(70.0, 84.0)));
        if (vUv.y > uReveal) discard;
        if (vUv.y > uReveal - 0.05 && n < 0.55) discard;
        if (n < uFade * 1.45 - 0.45 * (1.0 - vUv.y)) discard;
        gl_FragColor = vec4(tx.rgb * 0.96, 1.0);
      }`,
  });
}

/** Twisted funnel as toon sand bands (dark line, thin pale edge, ochre, dune shade, dark line) with gaps cut by alpha clip. */
function funnelMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uScroll: { value: 0 }, uDissolve: { value: 1 },
      uDark: { value: new THREE.Color(DARK) }, uEdge: { value: new THREE.Color(EDGE) },
      uMid: { value: new THREE.Color(MID) }, uShade: { value: new THREE.Color(SHADE) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv; varying float vH;
      float R(float h) { return 1.4 + 1.9 * pow(h, 1.5) + 0.5 * smoothstep(0.85, 1.0, h); }
      void main() {
        float h = position.y;
        float a = uv.x * 6.2831853 + ${TWIST.toFixed(2)} * h;
        float r = R(h);
        vec2 off = (1.0 - h) * (1.0 - h) * 0.5 * vec2(cos(uTime * 3.0), sin(uTime * 3.0));
        vec3 p = vec3(cos(a) * r + off.x, h * ${H.toFixed(1)}, sin(a) * r + off.y);
        vUv = vec2(uv.x, h); vH = h;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uScroll, uDissolve; uniform vec3 uDark, uEdge, uMid, uShade;
      varying vec2 vUv; varying float vH;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        float n = hash(floor(vec2(vUv.x * 96.0, vH * 40.0)));
        if (n < uDissolve) discard;
        if (vH < 0.03) discard;
        if (vH > 0.9 && n < (vH - 0.9) * 8.0) discard;
        float wob = 0.06 * sin(vUv.x * 18.8495 + vH * 9.0);
        float s = fract(vUv.x * 6.0 + vH * 1.4 + uScroll + wob);
        if (s > 0.76) discard;
        vec3 col = s < 0.07 ? uDark : (s < 0.13 ? uEdge : (s < 0.46 ? uMid : (s < 0.70 ? uShade : uDark)));
        col = mix(uDark, col, smoothstep(0.0, 0.18, vH));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export class SandstormDjinn implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SandstormDjinnSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private burst = false;
  private tick = 0;
  private tgtDone = false;
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private lastOff: THREE.Vector3[] = [];
  private grainAcc = 0;
  private fallAcc = 0;

  // Billboard state, written by the sprite's onBeforeRender and read in layout().
  private camQ = new THREE.Quaternion();
  private parentQ = new THREE.Quaternion();
  private camRight = new THREE.Vector3(1, 0, 0);
  private camUp = new THREE.Vector3(0, 1, 0);

  private funnelMat = funnelMaterial();
  private funnel: THREE.Mesh;
  private slices: CrescentArc[] = [];
  private slicePlanes: THREE.Group[] = [];
  private swirls: CrescentArc[] = [];
  private swirlPlane = new THREE.Group();
  private nova: CrescentArc[] = [];
  private novaPlanes: THREE.Group[] = [];

  private rig = new THREE.Group();
  private matCrossed = djinnMaterial(djinnTexture(false));
  private matRaised = djinnMaterial(djinnTexture(true));
  private crossed: THREE.Mesh;
  private raised: THREE.Mesh;
  private eyes = [0, 1].map(() => new StarBurst({ points: 4, inner: 0.14, jitter: 0, color: TEAL, core: 0xc8fff6 }));

  private groundRing = createRing(0xb8803a, 0.97, 1, 96);
  private ringDark = createRing(DARK, 0.7, 1, 96);
  private ringSand = createRing(MID, 0.8, 1, 96);
  private clapStar = new StarBurst({ points: 12, color: GOLD, core: EDGE, additive: false });
  private clapGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: TEAL, core: 0xc8fff6 });
  private stars: StarBurst[] = [];
  private smoke = new SmokeBall({ color: DARK, rim: 0x6a4a28, flake: '#3a2410', maxBalls: 3 });

  private dust: Emitter;
  private grains: Emitter;
  private fall: Emitter;

  constructor(settings: SandstormDjinnSettings = defaultSandstormDjinn()) {
    this.settings = settings;
    this.screen.tint.set(0x5a3a1c);
    this.screen.impactColor.set(0xe8b860);
    this.screen.speedLineColor.set(0xe0c488);
    this.screen.edgeTint.set(TEAL);

    // --- Funnel mesh: y runs 0..1 in the geometry, the vertex shader lifts it to H metres. ---
    const fg = new THREE.CylinderGeometry(1, 1, 1, 48, 28, true).translate(0, 0.5, 0);
    this.funnel = new THREE.Mesh(fg, this.funnelMat);
    this.funnel.frustumCulled = false;
    this.funnel.visible = false;
    this.group.add(this.funnel);

    // --- Swirl slices riding the funnel wall. ---
    for (let i = 0; i < N_SLICE; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 1, width: 0.3, style: 'toon', sweep: Math.PI * 1.3, edge: EDGE, mid: MID, outer: DARK });
      arc.mesh.rotation.x = -Math.PI / 2 + (i % 2 ? 0.2 : -0.2);
      plane.add(arc.mesh);
      this.slices.push(arc);
      this.slicePlanes.push(plane);
      this.group.add(plane);
    }

    // --- Ground sand ripples: flat toon crescents. ---
    for (let i = 0; i < 4; i++) {
      const arc = new CrescentArc({ radius: 2.2 + 0.9 * i, width: 1.0, style: 'toon', sweep: Math.PI * 1.5, edge: 0xc8a870, mid: SHADE, outer: DARK });
      arc.mesh.rotation.z = (i * Math.PI) / 2;
      this.swirlPlane.add(arc.mesh);
      this.swirls.push(arc);
    }
    this.swirlPlane.rotation.x = -Math.PI / 2;
    this.group.add(this.swirlPlane);

    // --- Clap nova: sand sheets lying flat, pushed outward. ---
    for (let i = 0; i < 4; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 1, width: 0.3, style: 'toon', sweep: Math.PI * 1.35, edge: EDGE, mid: MID, outer: DARK });
      arc.mesh.rotation.x = -Math.PI / 2;
      plane.add(arc.mesh);
      plane.rotation.y = i * (Math.PI / 2) + 0.4;
      this.nova.push(arc);
      this.novaPlanes.push(plane);
      this.group.add(plane);
    }

    // --- The djinn rig: two poses on the same plane, turned to the camera each frame. ---
    const geo = new THREE.PlaneGeometry(SPR_W, SPR_H);
    this.crossed = new THREE.Mesh(geo, this.matCrossed);
    this.raised = new THREE.Mesh(geo, this.matRaised);
    const face = (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
      camera.getWorldQuaternion(this.camQ);
      this.camRight.set(1, 0, 0).applyQuaternion(this.camQ);
      this.camUp.set(0, 1, 0).applyQuaternion(this.camQ);
      this.rig.parent?.getWorldQuaternion(this.parentQ);
      this.rig.quaternion.copy(this.parentQ.invert().multiply(this.camQ));
      this.rig.updateMatrixWorld(true);
    };
    for (const m of [this.crossed, this.raised]) {
      m.onBeforeRender = face;
      m.frustumCulled = false;
      this.rig.add(m);
    }
    this.rig.visible = false;
    this.group.add(this.rig);
    this.eyes.forEach((e) => e.mesh.traverse((o) => { o.renderOrder = 10; }));
    this.group.add(...this.eyes.map((e) => e.mesh));

    for (let i = 0; i < MAX_STARS; i++) {
      const s = new StarBurst({ points: 9, color: GOLD, core: EDGE, additive: false });
      this.stars.push(s);
      this.group.add(s.mesh);
    }
    for (const r of [this.ringDark, this.ringSand]) r.material.blending = THREE.NormalBlending;
    this.groundRing.material.blending = THREE.NormalBlending;
    this.group.add(this.groundRing.mesh, this.ringDark.mesh, this.ringSand.mesh);
    this.group.add(this.clapStar.mesh, this.clapGlint.mesh, this.smoke.mesh);

    // Small sand-brown dust (normal blended), sand grains (streaming up the funnel) and falling grains.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 1.6, speedJitter: 0.6, spread: 80, gravity: -0.1, drag: 1.3,
      sizeStart: 0.22, sizeEnd: 0.55, colorStart: '#b8905a', colorEnd: '#4a3018', colorMid: '#7a5430',
      opacityStart: 0.3, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4, groundFade: 0.25,
    });
    this.grains = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.1, speed: 1.6, speedJitter: 0.6, spread: 180, gravity: 0, drag: 0.5,
      sizeStart: 0.1, sizeEnd: 0.04, colorStart: '#d8b070', colorEnd: '#8a5a26',
      opacityStart: 0.85, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0,
    });
    this.fall = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 1.3, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.25, speed: 0.5, speedJitter: 0.8, spread: 180, gravity: 6, drag: 0.4,
      sizeStart: 0.11, sizeEnd: 0.06, colorStart: '#e0c488', colorEnd: '#8a5a26',
      opacityStart: 0.9, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0, groundFade: 0.2,
    });
    this.emitters.push(this.dust, this.grains, this.fall, this.smoke.emitter);
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
    this.from.copy(ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).setY(2.5);
    this.lastOff = ctx.targets.map(() => new THREE.Vector3());
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.burst = false;
    this.tick = 0;
    this.tgtDone = false;
    this.grainAcc = 0;
    this.fallAcc = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    while (this.tick < TICKS.length && this.time >= TICKS[this.tick]) this.onTick(this.tick++);
    if (!this.burst && this.time >= D) this.onBurst();
    this.layout(dt);
  }

  /** Funnel state at time t <= D: radial scale, height scale, dissolve threshold. */
  private funnelAt(t: number) {
    const grow = smoothstep((t - 0.1) / 0.75);
    const pinch = smoothstep((t - RAISE_AT) / (D - RAISE_AT));
    return { rad: (0.6 + 0.4 * grow) * (1 - 0.4 * pinch), hs: Math.max(1e-4, grow), dissolve: 1 - smoothstep((t - 0.1) / 0.5) };
  }

  /** World point of a pixel on the djinn canvas (640 x 768), using the camera axes of the last render. */
  private spritePoint(px: number, py: number, out: THREE.Vector3) {
    const s = this.rig.scale.x;
    return out.copy(this.rig.position)
      .addScaledVector(this.camRight, ((px - CW / 2) / CW) * SPR_W * s)
      .addScaledVector(this.camUp, ((CH / 2 - py) / CH) * SPR_H * s);
  }

  private layout(dt: number) {
    const t = this.time;
    const aw = t - D;
    const f = this.from;
    const ctx = this.ctx;
    const live = dt > 0 && this.playing;
    const tmp = new THREE.Vector3();

    // 1. World grade: warm brown, deeper during the raise, released after the clap.
    const grade = 0.5 * smoothstep(t / 0.5) + 0.12 * smoothstep((t - RAISE_AT) / 0.2);
    this.screen.darken = t < D ? grade : grade * Math.exp(-aw * 2.4);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.speedLines = t < D ? 0.7 * smoothstep((t - RAISE_AT) / 0.2) : Math.max(0, 0.7 - aw * 5);
    this.screen.chroma = chromaPulse(t, D, 0.5, 10);

    // 2. Funnel: spins fast, then slows, shrinks and dissolves after the clap.
    const fs = this.funnelAt(Math.min(t, D));
    let rad = fs.rad, hs = fs.hs, dis = fs.dissolve;
    let angle = SPIN * t;
    if (t >= D) {
      rad = fs.rad + (1.05 - fs.rad) * easeOut(aw / 0.3);
      hs = Math.max(1e-4, 1 - 0.92 * smoothstep((aw - 0.5) / 1.9));
      dis = smoothstep((aw - 0.4) / 1.9);
      angle = SPIN * (D + (1 - Math.exp(-1.2 * aw)) / 1.2);
    }
    this.funnel.visible = t > 0.1 && dis < 0.995;
    this.funnel.scale.set(rad, hs, rad);
    this.funnel.position.set(f.x, 0, f.z);
    this.funnel.rotation.y = -angle;
    this.funnelMat.uniforms.uTime.value = t;
    this.funnelMat.uniforms.uScroll.value = 1.5 * (t < D ? t : D + (1 - Math.exp(-1.2 * aw)) / 1.2);
    this.funnelMat.uniforms.uDissolve.value = dis;

    // 3. Swirl slices stacked by height on the funnel wall.
    const sliceOn = t > 0.5 && aw < 1.2;
    this.slices.forEach((arc, i) => {
      const hn = (i + 0.5) / N_SLICE;
      const plane = this.slicePlanes[i];
      const r = radiusAt(hn) * rad * 1.05;
      plane.position.set(f.x, hn * H * hs, f.z);
      plane.scale.setScalar(Math.max(1e-3, r));
      plane.rotation.y = angle * (0.6 + i * 0.12);
      arc.head = fract(t * 0.8 + i * 0.37) * 1.4;
      arc.length = 0.55;
      arc.time = t;
      arc.erosion = smoothstep((aw - 0.5) / 0.7);
      arc.opacity = sliceOn ? 1 : 0;
    });

    // 4. Ground: sand ripples spiral in from the start and die away late.
    this.swirlPlane.position.set(f.x, 0.08, f.z);
    this.swirls.forEach((arc, i) => {
      arc.head = fract(t * 0.7 + i * 0.25) * 1.4;
      arc.length = 0.5;
      arc.time = t;
      arc.erosion = smoothstep((t - 3.4) / 1.0);
      arc.opacity = 0.8 * smoothstep(t / 0.5) * (1 - smoothstep((t - 3.6) / 1.0));
    });
    const gr = t < D ? smoothstep(t / 0.5) : 1 - smoothstep(aw / 0.6);
    this.groundRing.mesh.position.set(f.x, 0.05, f.z);
    this.groundRing.mesh.scale.setScalar(RADIUS * (0.35 + 0.65 * smoothstep(t / 0.6)));
    this.groundRing.material.opacity = 0.25 * gr;

    // 5. The djinn: rises from the funnel high behind the caster, folded arms, then hands up, then crumbles.
    const reveal = smoothstep((t - GATHER) / 1.0);
    const rise = easeOut((t - GATHER) / 1.0);
    const kick = aw >= 0 ? Math.exp(-aw * 9) : 0;
    const popRaise = t >= RAISE_AT ? 0.05 * Math.exp(-(t - RAISE_AT) * 12) : 0;
    const crumble = smoothstep((aw - 0.35) / 1.5);
    const alive = t >= GATHER && crumble < 0.999;
    this.rig.visible = alive;
    this.rig.position.set(
      f.x - this.fwd.x * BACK,
      Y_LOW + (Y_HIGH - Y_LOW) * rise + 0.1 * Math.sin(t * 2.6) * reveal,
      f.z - this.fwd.z * BACK,
    );
    this.rig.scale.setScalar(Math.max(1e-3, (0.85 + 0.15 * rise) * (1 + 0.08 * kick + popRaise)));
    this.crossed.visible = t < RAISE_AT;
    this.raised.visible = t >= RAISE_AT;
    for (const m of [this.matCrossed, this.matRaised]) {
      m.uniforms.uReveal.value = t < GATHER ? 0 : 0.02 + 1.0 * reveal;
      m.uniforms.uFade.value = crumble;
    }

    // Teal eyes: the only glow. They open, flare at the raise and at the clap, go out as it crumbles.
    const eyeOn = smoothstep((t - 1.3) / 0.15) * (1 - smoothstep((aw - 0.5) / 0.5)) * (alive ? 1 : 0);
    const eyeFlare = 1 + 0.5 * kick + (t >= RAISE_AT && t < RAISE_AT + 0.15 ? 0.3 : 0);
    this.eyes.forEach((e, k) => {
      this.spritePoint(k === 0 ? 298 : 342, 222, tmp);
      e.set(tmp, 0.42 * eyeFlare * this.rig.scale.x, 0.95 * eyeOn, 0);
    });

    // 6. Sand streams up the funnel, then falls off the crumbling djinn (spawned only while playing).
    if (live) {
      if (t > 0.4 && t < D) {
        this.grainAcc += dt * 90;
        while (this.grainAcc >= 1) {
          this.grainAcc -= 1;
          const hn = Math.random();
          const a = Math.random() * Math.PI * 2 + TWIST * hn;
          const r = radiusAt(hn) * rad * (0.9 + Math.random() * 0.2);
          this.grains.burst(1, tmp.set(f.x + Math.cos(a) * r, hn * H * hs, f.z + Math.sin(a) * r));
        }
      }
      if (crumble > 0 && crumble < 1) {
        this.fallAcc += dt * 110;
        while (this.fallAcc >= 1) {
          this.fallAcc -= 1;
          const topBias = 1 - crumble;
          this.spritePoint(120 + Math.random() * 400, 60 + Math.random() * 650 * (1 - topBias * 0.3), tmp);
          this.fall.burst(1, tmp);
        }
      }
    }

    // 7. Enemies in range are dragged in a little.
    if (ctx && live) this.moveTargets(ctx, t);

    // 8. Clap: sand/gold star at the hands, a teal glint, stars on the enemies, ring and sheets blasting out.
    const sp = StarBurst.pop(aw - 0.02, 0.05, 0.14);
    this.spritePoint(320, 80, tmp);
    this.clapStar.set(tmp, 3.0 * sp.scale, sp.opacity, 0.2);
    this.clapGlint.set(tmp, 2.0 * sp.scale, sp.opacity, 0.6);
    this.stars.forEach((s, i) => {
      const tp = ctx?.targetPos[i];
      const pop = StarBurst.pop(aw - 0.05 - i * 0.015, 0.05, 0.14);
      if (!tp || pop.opacity === 0) { s.set(new THREE.Vector3(), 0, 0); return; }
      const off = this.lastOff[i];
      s.set(new THREE.Vector3(tp.x + (off?.x ?? 0), 1.2 + (off?.y ?? 0), tp.z + (off?.z ?? 0)), 2.2 * pop.scale, pop.opacity, i * 0.7);
    });

    const nOn = aw > 0 && aw < 0.6;
    const nk = easeOut(aw / 0.55);
    this.nova.forEach((arc, i) => {
      const plane = this.novaPlanes[i];
      plane.position.set(f.x, 0.12 + 0.05 * i, f.z);
      plane.scale.setScalar(Math.max(1e-3, 1.4 + 6.5 * nk));
      arc.mesh.rotation.z = aw * 3 + i;
      arc.head = Math.max(0, aw) * 3;
      arc.length = 0.6;
      arc.time = t;
      arc.erosion = smoothstep((aw - 0.2) / 0.4);
      arc.opacity = nOn ? 1 : 0;
    });
    this.ringDark.mesh.position.set(f.x, 0.03, f.z);
    this.ringDark.mesh.scale.setScalar(1 + (aw > 0 ? 7 * nk : 0));
    this.ringDark.material.opacity = aw > 0 ? 0.5 * (1 - smoothstep((aw - 0.15) / 0.5)) : 0;
    this.ringSand.mesh.position.set(f.x, 0.06, f.z);
    this.ringSand.mesh.scale.setScalar(1 + (aw > 0 ? 7.5 * nk : 0));
    this.ringSand.material.opacity = aw > 0 ? 0.85 * (1 - smoothstep(aw / 0.55)) : 0;

    // 9. Camera shake.
    this.shake = aw > 0 ? Math.max(0.6 * Math.exp(-aw * 7), 0) : (t > GATHER ? 0.04 : 0);
  }

  private moveTargets(ctx: CastContext, t: number) {
    const f = this.from;
    const aw = t - D;
    if (aw > 0.8) {
      if (!this.tgtDone) {
        this.tgtDone = true;
        const zero = new THREE.Vector3();
        for (const e of ctx.targets) ctx.displace(e, zero);
      }
      return;
    }
    const pull = smoothstep((t - 0.7) / 1.0);
    const k = aw > 0 ? Math.exp(-aw * 9) : 1;
    ctx.targets.forEach((e, i) => {
      const tp = ctx.targetPos[i];
      const dx = f.x - tp.x, dz = f.z - tp.z;
      const r0 = Math.hypot(dx, dz);
      const off = this.lastOff[i] ?? (this.lastOff[i] = new THREE.Vector3());
      if (r0 < 0.05) { off.set(0, 0.25 * pull * k, 0); ctx.displace(e, off); return; }
      const step = Math.min(r0 * 0.35, 2.2) * pull * k;
      off.set((dx / r0) * step, 0.3 * pull * k, (dz / r0) * step);
      ctx.displace(e, off);
    });
  }

  private onTick(_i: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const from = ctx.from.clone().setY(0);
    ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.tickDamage, knock: 0, from, color: '#e0c488' }));
  }

  private onBurst() {
    this.burst = true;
    const f = this.from;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.dust.burst(12, new THREE.Vector3(f.x + Math.cos(a) * 2.2, 0.1, f.z + Math.sin(a) * 2.2));
    }
    this.grains.burst(60, new THREE.Vector3(f.x, 1.2, f.z));
    this.smoke.trigger(new THREE.Vector3(f.x + this.fwd.z * 2.2, 0.7, f.z - this.fwd.x * 2.2), 1.1, 0.9);
    this.smoke.trigger(new THREE.Vector3(f.x - this.fwd.z * 2.2, 0.7, f.z + this.fwd.x * 2.2), 1.1, 0.9);
    const ctx = this.ctx;
    if (ctx) {
      const from = ctx.from.clone().setY(0);
      ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from, color: '#e8b860' }));
    }
  }
}

export const sandstormDjinnModule: EffectModule = {
  label: 'sandstorm djinn',
  category: 'targeted',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new SandstormDjinn(),
  telegraphs(effect) {
    const e = effect as SandstormDjinn;
    const c = e.ctx?.from;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: GATHER, impact: D }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.5, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SandstormDjinn;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as SandstormDjinn).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tickDamage', 0, 40, 1).name('tick damage');
    f.add(s, 'knock', 0, 20, 0.5);
  },
};
