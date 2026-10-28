import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Orbital Lance (targeted, single enemy, orbital tech): the world darkens cold and a hex-grid targeting reticle
 * unfolds on the ground under the chosen enemy (thin cyan hex outlines popping outward, dark tinted tiles, a red
 * crosshair that rotates). A small drawn satellite (dark hull, gold trim, blue solar panels, one glowing dish)
 * slides in high above and in front of the caster, tilted toward the caster so its panels read, and unfolds its
 * panels. A thin red laser pointer touches the target while three red pulses contract on the reticle, then a
 * cyan needle and a small hard flare gather at the dish, and there is a dead beat. At D the lance fires: a dark
 * under-beam, a blue electric copy, a cyan core and a thin white centre line drill down onto the target with
 * short cyan impact frames, a toon star, a cyan shock ring and a red molten ring. The hex tiles shatter outward
 * as flat tiles, the beam pinches to a line and stops, the satellite retracts its panels and slides away and the
 * hex scorch cools from cyan to red to dark.
 *
 * The satellite is unlit and below the bloom threshold: only its dish glows. White only in the beam's thin line.
 *
 * Recipes: a-val-sova-hunters-fury (a tech beam with a lock-on), c-gnomon-charged-energy-beam (charge, dead beat,
 * thick beam), a-dota-invoker-sun-strike (strike from above at a point), j-aguiar-layered-laser-beam (under-beam,
 * core, electric copy).
 */
export interface OrbitalLanceSettings {
  damage: number;
  loop: boolean;
}

export const defaultOrbitalLance = (): OrbitalLanceSettings => ({
  damage: 70,
  loop: false,
});

// Timeline (seconds).
const SAT_IN = 0.55;
const SAT_IN_END = 1.35;
const PANEL_START = 0.9;
const PANEL_END = 1.5;
const POINTER_START = 0.9;
const CHARGE_START = 1.6;
const CHARGE_END = 1.78;
const D = 1.85; // beam fires
const HOLD_END = 2.25;
const PINCH_END = 2.6;
const BEAM_END = 2.75;
const FOLD_START = 2.7;
const FOLD_END = 3.3;
const SLIDE_START = 3.0;
const SLIDE_END = 3.9;
const DURATION = 4.4;
const PULSES = [1.0, 1.22, 1.44];

// Palette (core, hot, body, accent, dark) plus gold / steel for the satellite.
const WHITE = 0xffffff;
const CYAN = 0x7ff0ff;
const BLUE = 0x2a8aff;
const BLUE_DEEP = 0x1a4fb0;
const RED = 0xff3a3a;
const DARK = 0x0a0e14;
const HULL = 0x37414e;
const GOLD = 0xb8923a;

const HEX_R = 0.6;
const HEX_RINGS = 3;
const BEAM_R = 0.5;
const SAT_S = 2.55;
const HOLD_H = 9.5;

const easeOutBack = (x: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  const k = Math.min(1, Math.max(0, x)) - 1;
  return 1 + c3 * k * k * k + c1 * k * k;
};
const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Solar panel texture (canvas 256 x 128): deep blue cells split by thin lighter grid lines, a dark frame. */
function panelTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#0a0e14';
  g.fillRect(0, 0, 256, 128);
  const cols = 8, rows = 4;
  const cw = 256 / cols, ch = 128 / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const grad = g.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
      grad.addColorStop(0, '#1d4a96');
      grad.addColorStop(1, '#10285a');
      g.fillStyle = grad;
      g.fillRect(i * cw + 2, j * ch + 2, cw - 4, ch - 4);
      g.fillStyle = 'rgba(127,240,255,0.35)';
      g.fillRect(i * cw + 4, j * ch + 4, cw - 8, 2);
    }
  }
  g.strokeStyle = '#b8923a';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 124);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// --- Beam material (shader copies of one ribbon: dark under-beam, electric, core, thin line) -------------------

const BEAM_VERT = /* glsl */ `
  uniform vec3 uA, uB; uniform float uHalfW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 a = (modelMatrix * vec4(uA, 1.0)).xyz;
    vec3 b = (modelMatrix * vec4(uB, 1.0)).xyz;
    vec3 side = cross(b - a, cameraPosition - a);
    float sl = length(side);
    side = sl > 1e-6 ? side / sl : vec3(0.0, 1.0, 0.0);
    vec3 w = mix(a, b, uv.y) + side * (uv.x - 0.5) * 2.0 * uHalfW;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

const BEAM_FRAG = /* glsl */ `
  uniform float uTime, uScroll, uDistort, uClip, uOpacity, uLength, uDark, uSeed, uBase, uGain, uSharp;
  uniform vec3 uHot, uMid, uEdge;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    float y = vUv.y;
    float c = vUv.x * 2.0 - 1.0;
    float pinch = 0.3 + 0.7 * sqrt(max(sin(3.14159265 * y), 0.0));
    float mask = smoothstep(0.0, 0.05, y) * mix(1.0, 0.6, smoothstep(0.35, 0.85, y)) * (1.0 - smoothstep(0.85, 1.0, y));
    float along = y * uLength * 0.35;
    vec2 q = vec2(along, c);
    vec2 d = vec2(noise(q * 3.0 + vec2(uTime * 3.0, uSeed)), noise(q * 3.0 + vec2(17.0 - uTime * 2.4, uSeed * 1.7 + 5.0)));
    float pc = c + (d.y - 0.5) * uDistort * 2.5;
    along += (d.x - 0.5) * uDistort * 2.0;
    float ap = abs(pc) / pinch;
    if (uDark > 0.5) {
      float n = noise(vec2(along * 0.8 - uTime * 1.2, pc * 2.0));
      float a = (1.0 - smoothstep(0.55, 1.0, ap)) * mask * uOpacity;
      gl_FragColor = vec4(mix(uEdge, uMid, n), a);
      return;
    }
    float prof = 1.0 - smoothstep(0.0, 1.0, ap);
    float sc = uTime * uScroll;
    float st = 0.6 * noise(vec2((along - sc) * 1.4, pc * 3.5)) + 0.4 * noise(vec2((along - sc * 1.4) * 3.0 + 9.0, pc * 7.0));
    float s = mix(st, smoothstep(0.35, 0.85, st), uSharp);
    float v = prof * (uBase + uGain * s);
    if (v < uClip) discard;
    float a = clamp(v, 0.0, 1.0) * smoothstep(uClip, uClip + 0.12, v) * mask * uOpacity;
    vec3 col = mix(uEdge, uMid, smoothstep(0.08, 0.55, v));
    col = mix(col, uHot, smoothstep(0.7, 1.1, v + 0.15 * prof * prof));
    gl_FragColor = vec4(col, a);
  }`;

interface BeamLayerOptions {
  dark?: boolean;
  hot: THREE.ColorRepresentation;
  mid: THREE.ColorRepresentation;
  edge: THREE.ColorRepresentation;
  scroll: number;
  distort: number;
  clip: number;
  base: number;
  gain: number;
  sharp: number;
  seed: number;
  order: number;
}

/** One shader copy of the beam: a camera-facing ribbon from a to b. */
class BeamLayer {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(o: BeamLayerOptions) {
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: o.dark ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3(0, 0, 1) }, uHalfW: { value: 0.1 },
        uTime: { value: 0 }, uScroll: { value: o.scroll }, uDistort: { value: o.distort }, uClip: { value: o.clip },
        uOpacity: { value: 0 }, uLength: { value: 1 }, uDark: { value: o.dark ? 1 : 0 }, uSeed: { value: o.seed },
        uBase: { value: o.base }, uGain: { value: o.gain }, uSharp: { value: o.sharp },
        uHot: { value: new THREE.Color(o.hot) }, uMid: { value: new THREE.Color(o.mid) }, uEdge: { value: new THREE.Color(o.edge) },
      },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = o.order;
    this.mesh.visible = false;
  }

  place(a: THREE.Vector3, b: THREE.Vector3, halfW: number, opacity: number, time: number) {
    const u = this.material.uniforms;
    (u.uA.value as THREE.Vector3).copy(a);
    (u.uB.value as THREE.Vector3).copy(b);
    const len = a.distanceTo(b);
    u.uHalfW.value = halfW;
    u.uOpacity.value = opacity;
    u.uTime.value = time;
    u.uLength.value = len;
    this.mesh.visible = opacity > 0.002 && halfW > 1e-3 && len > 0.02;
  }
}

interface Hex {
  x: number;
  z: number;
  ring: number;
  // Shatter state.
  p: THREE.Vector3;
  v: THREE.Vector3;
  e: THREE.Euler;
  w: THREE.Vector3;
  landed: boolean;
}

function buildHexes(): Hex[] {
  const out: Hex[] = [];
  const n = HEX_RINGS;
  for (let q = -n; q <= n; q++) {
    for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
      out.push({
        x: 1.5 * HEX_R * q,
        z: Math.sqrt(3) * HEX_R * (r + q / 2),
        ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)),
        p: new THREE.Vector3(), v: new THREE.Vector3(), e: new THREE.Euler(), w: new THREE.Vector3(), landed: false,
      });
    }
  }
  return out;
}

export class OrbitalLance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: OrbitalLanceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private smokeStep = 0;
  private sparkAcc = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private hold = new THREE.Vector3(0, HOLD_H, 0);
  private strike = new THREE.Vector3();
  private ground = new THREE.Vector3();
  private hitFrom = new THREE.Vector3();
  private upHint = new THREE.Vector3(0, 1, 0);

  // Scratch.
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private zAxis = new THREE.Vector3(0, 0, 1);
  private mat4 = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private scl = new THREE.Vector3();
  private hexes = buildHexes();
  private redCol = new THREE.Color(RED);

  // Satellite.
  private sat = new THREE.Group();
  private panelPivots: THREE.Group[] = [];
  private dishFlare = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: CYAN, core: 0xcffcff });
  private dishGlow = new GlowSphere(CYAN, { rim: false });
  private dishCore: THREE.Mesh;
  private dishCoreMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6 });

  // Ground reticle.
  private fillMat = new THREE.MeshBasicMaterial({
    color: 0x0c2848, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  private lineMat = new THREE.MeshBasicMaterial({
    color: CYAN, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  private tiles: THREE.InstancedMesh;
  private outlines: THREE.InstancedMesh;
  private crossGroup = new THREE.Group();
  private crossRing = createRing(RED, 0.88, 1, 64);
  private crossBarMat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  private pulses = PULSES.map(() => createRing(RED, 0.9, 1, 6));
  private pointer: THREE.Line;
  private pointerMat = new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0, depthWrite: false });
  private scorch: THREE.Mesh;
  private scorchMat = new THREE.MeshBasicMaterial({ color: DARK, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

  // Beam.
  private under = new BeamLayer({
    dark: true, hot: DARK, mid: 0x12263e, edge: DARK, scroll: 0, distort: 0.02, clip: 0, base: 0, gain: 0, sharp: 0, seed: 3, order: 1,
  });
  private electric = new BeamLayer({
    hot: 0xbff8ff, mid: BLUE, edge: BLUE_DEEP, scroll: 4, distort: 0.02, clip: 0.1, base: 0.6, gain: 0.4, sharp: 0, seed: 11, order: 2,
  });
  private core = new BeamLayer({
    hot: CYAN, mid: BLUE, edge: BLUE_DEEP, scroll: 3, distort: 0.02, clip: 0, base: 0.75, gain: 0.3, sharp: 0, seed: 7, order: 3,
  });
  private line = new BeamLayer({
    hot: WHITE, mid: 0xcffcff, edge: CYAN, scroll: 4, distort: 0.05, clip: 0, base: 0.85, gain: 0.2, sharp: 0, seed: 5, order: 4,
  });
  private needle = new BeamLayer({
    hot: CYAN, mid: CYAN, edge: BLUE, scroll: 2, distort: 0.02, clip: 0, base: 0.8, gain: 0.2, sharp: 0, seed: 9, order: 4,
  });

  // Impact.
  private star = new StarBurst({ points: 8, inner: 0.3, jitter: 0.25, color: BLUE, core: CYAN, additive: false });
  private redGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: RED, core: 0xffb0a8, additive: false });
  private shock = createRing(CYAN, 0.92, 1, 96);
  private molten = createRing(RED, 0.9, 1, 6);
  private refract = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private haze = new HeatHaze({ width: 3, height: 5 });
  private smoke = new SmokeBall({ color: 0x1a2433, rim: 0x34506e, flake: '#1a2433', maxBalls: 3 });

  private sparks: Emitter;
  private dust: Emitter;

  constructor(settings: OrbitalLanceSettings = defaultOrbitalLance()) {
    this.settings = settings;
    this.screen.tint.set(0x1a2a50);
    this.screen.impactColor.set(CYAN);
    this.screen.speedLineColor.set(CYAN);
    this.screen.edgeTint.set(BLUE);

    // --- Satellite: hull, gold trim, folding panels, one dish with a glowing core. ---
    const hullMat = new THREE.MeshBasicMaterial({ color: HULL });
    const goldMat = new THREE.MeshBasicMaterial({ color: GOLD });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x1a2028, side: THREE.DoubleSide });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x05080c });
    const panelMat = new THREE.MeshBasicMaterial({ map: panelTexture(), color: 0xdddddd });
    const bodyGeo = new THREE.BoxGeometry(1.2, 1.0, 1.9);
    const body = new THREE.Mesh(bodyGeo, hullMat);
    const bodyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), lineMat);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.26, 1.06, 0.14), goldMat);
    band.position.z = -0.4;
    const band2 = band.clone();
    band2.position.z = 0.4;
    const dishGeo = new THREE.SphereGeometry(0.75, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    dishGeo.rotateX(Math.PI / 2);
    const dish = new THREE.Mesh(dishGeo, darkMat);
    dish.position.z = 1.0;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 28), goldMat);
    rim.position.z = 1.0;
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5).rotateX(Math.PI / 2), goldMat);
    feed.position.z = 1.3;
    this.dishCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), this.dishCoreMat);
    this.dishCore.position.z = 1.62;
    this.sat.add(body, bodyEdges, band, band2, dish, rim, feed, this.dishCore);
    for (const sgn of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.x = sgn * 0.62;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.07), goldMat);
      arm.position.x = sgn * 0.25;
      const panelGeo = new THREE.BoxGeometry(3.2, 0.05, 1.5);
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.x = sgn * (0.5 + 1.6);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(panelGeo), lineMat);
      edges.position.copy(panel.position);
      pivot.add(arm, panel, edges);
      this.sat.add(pivot);
      this.panelPivots.push(pivot);
    }
    this.sat.visible = false;
    this.group.add(this.sat, this.dishFlare.mesh, this.dishGlow.mesh);

    // --- Hex reticle: dark tinted tiles (they shatter) and thin cyan outlines (they stay as scorch). ---
    const tileGeo = new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2);
    const outGeo = new THREE.RingGeometry(0.88, 1, 6).rotateX(-Math.PI / 2);
    this.tiles = new THREE.InstancedMesh(tileGeo, this.fillMat, this.hexes.length);
    this.outlines = new THREE.InstancedMesh(outGeo, this.lineMat, this.hexes.length);
    this.tiles.frustumCulled = false;
    this.outlines.frustumCulled = false;
    this.tiles.renderOrder = 1;
    this.outlines.renderOrder = 2;
    this.scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2), this.scorchMat);
    this.scorch.visible = false;
    this.scorch.renderOrder = 0;

    // Red crosshair: a ring plus four tick bars, spinning about the vertical axis.
    const barGeoX = new THREE.PlaneGeometry(0.55, 0.09).rotateX(-Math.PI / 2);
    const barGeoZ = new THREE.PlaneGeometry(0.09, 0.55).rotateX(-Math.PI / 2);
    for (const [geo, px, pz] of [[barGeoX, 1.25, 0], [barGeoX, -1.25, 0], [barGeoZ, 0, 1.25], [barGeoZ, 0, -1.25]] as const) {
      const bar = new THREE.Mesh(geo, this.crossBarMat);
      bar.position.set(px, 0.01, pz);
      this.crossGroup.add(bar);
    }
    this.crossRing.mesh.position.y = 0.01;
    this.crossGroup.add(this.crossRing.mesh);
    this.crossGroup.visible = false;

    const pg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
    this.pointer = new THREE.Line(pg, this.pointerMat);
    this.pointer.frustumCulled = false;
    this.pointer.visible = false;

    this.group.add(this.scorch, this.tiles, this.outlines, this.crossGroup, this.pointer);
    for (const p of this.pulses) this.group.add(p.mesh);

    // --- Beam layers, impact. ---
    this.group.add(this.under.mesh, this.electric.mesh, this.core.mesh, this.line.mesh, this.needle.mesh);
    this.shock.mesh.visible = false;
    this.molten.mesh.visible = false;
    this.group.add(this.star.mesh, this.redGlint.mesh, this.shock.mesh, this.molten.mesh, this.smoke.mesh, this.refract.mesh, this.haze.mesh);

    // Small cyan sparks, short.
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 10, speedJitter: 0.6, spread: 90, gravity: 9, drag: 1.4,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#7ff0ff', colorEnd: '#2a8aff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Small, short hull-dark dust (normal blend).
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 200, rate: 0, lifetime: 1.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.8, speed: 3, speedJitter: 0.6, spread: 80, gravity: -0.1, drag: 1.6,
      sizeStart: 0.45, sizeEnd: 1.0, colorStart: '#1c2630', colorEnd: '#0a0e14',
      opacityStart: 0.55, opacityEnd: 0, additive: false, colorMid: '#121a24', sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
      groundFade: 0.3,
    });
    this.emitters.push(this.sparks, this.dust, this.smoke.emitter);
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
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    const target = ctx.targetPos[0] ?? ctx.point;
    this.ground.copy(target).setY(0);
    this.strike.copy(this.ground).setY(1.1);
    // Beyond the target (far side from the caster), so the camera behind the caster sees satellite, beam and target together.
    this.hold.copy(this.ground).addScaledVector(this.fwd, 5).setY(HOLD_H);
    // Panels face the caster: local +Y of the satellite points from it toward the caster.
    this.upHint.copy(this.from).setY(3).sub(this.hold);
    this.hitFrom.copy(this.ground).addScaledVector(this.fwd, -1.2);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.strike);
    this.crossGroup.position.set(this.ground.x, 0.07, this.ground.z);
    this.scorch.position.set(this.ground.x, 0.04, this.ground.z);
    this.shock.mesh.position.set(this.ground.x, 0.05, this.ground.z);
    this.molten.mesh.position.set(this.ground.x, 0.06, this.ground.z);
    for (const p of this.pulses) p.mesh.position.set(this.ground.x, 0.08, this.ground.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.smokeStep = 0;
    this.sparkAcc = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const h of this.hexes) {
      h.landed = false;
      h.p.set(h.x, 0.05, h.z);
      h.v.set(0, 0, 0);
      h.w.set(0, 0, 0);
      h.e.set(0, 0, 0);
    }
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
    if (!this.impacted && this.time >= D) this.onImpact();
    this.layout(dt);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const ctx = this.ctx;
    const tmp = this.tmp;
    const gx = this.ground.x, gz = this.ground.z;

    // --- Layer 1: the world darkens cold, a deeper dip on the dead beat, released after the hit. ---
    const dead = t >= CHARGE_END && t < D ? 0.1 : 0;
    this.screen.darken = (0.6 * smoothstep(t / 0.6) + dead) * (1 - smoothstep((after - 0.1) / 1.3));
    this.screen.chroma = chromaPulse(t, D, 0.6);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    const lockK = smoothstep((t - CHARGE_START) / 0.2);
    this.screen.speedLines = t < CHARGE_START ? 0 : after < 0 ? 0.6 * lockK : Math.max(0, 0.6 - after * 4);

    // --- Layer 2: the satellite. Slides in, unfolds panels, recoils on firing, retracts, slides away. ---
    const rise = easeOutCubic((t - SAT_IN) / (SAT_IN_END - SAT_IN));
    const slideOut = smoothstep((t - SLIDE_START) / (SLIDE_END - SLIDE_START));
    const alive = t >= SAT_IN - 0.05 && t < SLIDE_END && ctx !== null;
    const pos = this.tmp2.copy(this.hold);
    pos.addScaledVector(this.right, 16 * (1 - rise) - 18 * slideOut);
    pos.y += 3 * (1 - rise) + 2 * slideOut + 0.15 * Math.sin(t * 2.1) * rise;
    this.zAxis.copy(this.strike).sub(pos);
    if (this.zAxis.lengthSq() < 1e-6) this.zAxis.set(0, -1, 0);
    this.zAxis.normalize();
    const kick = after >= 0 ? Math.exp(-after * 9) : 0;
    pos.addScaledVector(this.zAxis, -0.45 * kick);
    // Attitude in the group's own space: +Z at the target, +Y toward the caster.
    const up = Math.abs(this.upHint.clone().normalize().dot(this.zAxis)) > 0.98 ? new THREE.Vector3(0, 1, 0) : this.upHint;
    this.mat4.lookAt(this.strike, pos, up); // z axis = strike - pos
    this.quat.setFromRotationMatrix(this.mat4);
    this.sat.quaternion.copy(this.quat);
    this.sat.position.copy(pos);
    const satScale = Math.max(1e-3, SAT_S * (1 + 0.06 * kick));
    this.sat.scale.setScalar(satScale);
    this.sat.visible = alive;
    const open = easeOutBack((t - PANEL_START) / (PANEL_END - PANEL_START));
    const fold = clamp01((t - FOLD_START) / (FOLD_END - FOLD_START));
    const panelP = t < FOLD_START ? open : open * (1 - fold * fold);
    this.panelPivots.forEach((p) => p.scale.set(Math.max(0.03, panelP), 1, 1));

    // Dish position (world/group space) and its small hard flare.
    const dishPos = new THREE.Vector3().copy(pos).addScaledVector(this.zAxis, 1.6 * satScale);
    const charge = smoothstep((t - CHARGE_START) / (CHARGE_END - CHARGE_START));
    const chargeOn = t >= CHARGE_START && t < CHARGE_END;
    this.dishCoreMat.opacity = 0.5 + 0.4 * (alive ? Math.max(chargeOn ? charge : 0, after >= 0 ? Math.exp(-after * 3) : 0) : 0);
    this.dishCore.scale.setScalar(1 + (chargeOn ? 0.8 * charge : 0) + 0.6 * kick);
    this.dishGlow.mesh.position.copy(dishPos);
    this.dishGlow.mesh.scale.setScalar(Math.max(1e-3, 0.3 + 0.5 * charge) * (chargeOn ? 1 : 0.5));
    this.dishGlow.opacity = alive ? (chargeOn ? 0.5 * charge : after >= 0 && after < 0.5 ? 0.4 * Math.exp(-after * 6) : 0.1 * rise * (1 - slideOut)) : 0;
    const fl = StarBurst.pop(after, 0.06, 0.2);
    const flareSize = chargeOn ? 1.1 * charge : 1.8 * fl.scale;
    this.dishFlare.set(dishPos, flareSize, chargeOn ? 0.9 * charge : fl.opacity, t * 1.5);

    // --- Layer 3: the hex reticle pops outward from the target, tiles then shatter outward at the hit. ---
    const gridOn = ctx !== null && t < FOLD_END + 0.6;
    const tilesFade = after < 0 ? 1 : 1 - smoothstep(after / 1.1);
    this.fillMat.opacity = ctx ? 0.55 * smoothstep(t / 0.25) * tilesFade : 0;
    // Outlines: cyan while locked, red while the scorch cools, then out.
    const cool = smoothstep(after / 1.6);
    this.lineMat.color.setHex(CYAN).lerp(this.redCol, cool);
    const lineFade = 1 - smoothstep((t - 3.5) / (DURATION - 3.5));
    this.lineMat.opacity = ctx ? (after < 0 ? 0.75 : 0.65 * (1 - 0.5 * cool)) * smoothstep(t / 0.2) * lineFade : 0;
    for (let i = 0; i < this.hexes.length; i++) {
      const h = this.hexes[i];
      const pop = easeOutBack((t - 0.04 - h.ring * 0.07) / 0.25);
      const base = HEX_R * 0.94;
      if (this.impacted && dt > 0) this.stepTile(h, dt);
      const flying = this.impacted;
      this.quat.setFromEuler(h.e);
      // Tiles: static pop before the hit, tumbling flat shards after.
      const ts = Math.max(1e-4, base * (flying ? 1 : pop));
      this.mat4.compose(flying ? h.p : tmp.set(h.x, 0.05, h.z), flying ? this.quat : this.quat.identity(), this.scl.setScalar(ts));
      this.tiles.setMatrixAt(i, this.mat4);
      // Outlines stay put (inner rings stay as scorch, outer rings drop out fast after the hit).
      const dropOut = this.impacted && h.ring > 2 ? 1 - clamp01((after - 0.1 - h.ring * 0.04) / 0.15) : 1;
      const os = Math.max(1e-4, base * pop * dropOut * (1 + (this.impacted ? 0 : 0.03 * Math.sin(t * 6 - h.ring))));
      this.mat4.compose(tmp.set(h.x, 0.06, h.z), this.quat.identity(), this.scl.setScalar(os));
      this.outlines.setMatrixAt(i, this.mat4);
    }
    this.tiles.instanceMatrix.needsUpdate = true;
    this.outlines.instanceMatrix.needsUpdate = true;
    this.tiles.position.set(gx, 0, gz);
    this.outlines.position.set(gx, 0, gz);
    this.tiles.visible = gridOn;
    this.outlines.visible = gridOn;

    // Black scorch under the cooling grid (dark is a colour).
    this.scorch.visible = after >= 0.05 && lineFade > 0.01;
    this.scorch.scale.setScalar(Math.max(1e-3, 1.9 * easeOutCubic((after - 0.05) / 0.3)));
    this.scorchMat.opacity = after >= 0.05 ? 0.75 * lineFade : 0;

    // Red crosshair: appears with the grid, spins, locks (steadies) at the charge, flashes off at the hit.
    const crossOn = ctx !== null && t >= 0.2 && after < 0.12;
    this.crossGroup.visible = crossOn;
    this.crossGroup.rotation.y = t * (t < CHARGE_START ? 1.6 : 0.3);
    const crossIn = easeOutBack((t - 0.2) / 0.3);
    this.crossGroup.scale.setScalar(Math.max(1e-3, crossIn * (1 - 0.18 * lockK)));
    this.crossBarMat.opacity = 0.85 * (after < 0 ? 1 : 0);
    this.crossRing.material.opacity = 0.55 * (after < 0 ? 1 : 0);

    // Countdown: three red hex pulses contract onto the crosshair.
    this.pulses.forEach((p, i) => {
      const age = (t - PULSES[i]) / 0.22;
      const on = age >= 0 && age < 1;
      p.mesh.visible = on;
      p.mesh.scale.setScalar(on ? Math.max(1e-3, THREE.MathUtils.lerp(3.2, 1.1, easeOutCubic(age))) : 1e-3);
      p.mesh.rotation.z = i * 0.5;
      p.material.opacity = on ? 0.8 * (1 - age * age) : 0;
    });

    // --- Layer 4: thin red laser pointer from the dish to the target; a cyan needle on the same axis at the charge. ---
    const pointerOn = alive && t >= POINTER_START && t < CHARGE_START;
    this.pointer.visible = pointerOn;
    this.pointerMat.opacity = pointerOn ? 0.55 + 0.3 * Math.sin(t * 50) : 0;
    if (pointerOn) {
      const a = this.pointer.geometry.attributes.position as THREE.BufferAttribute;
      a.setXYZ(0, dishPos.x, dishPos.y, dishPos.z);
      a.setXYZ(1, this.strike.x, this.strike.y, this.strike.z);
      a.needsUpdate = true;
    }
    const needleOn = alive && chargeOn;
    this.needle.place(dishPos, this.strike, 0.035, needleOn ? 0.8 * charge : 0, t);

    // --- Layer 5: the lance. Snaps out in 0.1 s, holds, pinches to a line, ends. ---
    const lenK = after < 0 ? 0 : easeOutCubic(after / 0.1);
    const pinch = smoothstep((t - HOLD_END) / (PINCH_END - HOLD_END));
    const endFade = 1 - smoothstep((t - PINCH_END) / (BEAM_END - PINCH_END));
    const beamOn = lenK > 0.01 && endFade > 0.01;
    const b = new THREE.Vector3().lerpVectors(dishPos, this.strike, lenK);
    const wob = 1 + 0.01 * Math.sin(t * 44);
    const coreW = BEAM_R * wob * THREE.MathUtils.lerp(1, 0.14, pinch);
    this.under.place(dishPos, b, coreW * 2.5 + 0.08, beamOn ? 0.92 * endFade : 0, t);
    this.electric.place(dishPos, b, coreW * 1.75, beamOn ? 0.4 * endFade : 0, t);
    this.core.place(dishPos, b, coreW, beamOn ? 0.5 * endFade : 0, t);
    this.line.place(dishPos, b, 0.05 + 0.03 * (1 - pinch), beamOn ? 0.55 * endFade : 0, t);

    // Sparks spit from the impact point while the lance is on.
    if (dt > 0 && beamOn && lenK > 0.5) {
      this.sparkAcc += 45 * dt * endFade;
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        this.sparks.burst(1, tmp.set(gx + (Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.5, gz + (Math.random() - 0.5) * 0.8));
      }
    }

    // --- Layer 6: toon star (blue / cyan core), a 2-frame red glint, cyan shock ring, red molten ring. ---
    const sp = StarBurst.pop(after - 0.01, 0.08, 0.16);
    this.star.set(tmp.set(gx, 1.3, gz), 3.0 * sp.scale, sp.opacity, 0.2);
    const gp = StarBurst.pop(after, 0.03, 0.05);
    this.redGlint.set(tmp.set(gx, 1.0, gz), 3.2 * gp.scale, gp.opacity, 0.5);
    this.shock.mesh.visible = after >= 0 && after < 0.6;
    this.shock.mesh.scale.setScalar(1 + Math.max(0, after) * 24);
    this.shock.material.opacity = after >= 0 ? Math.max(0, 0.7 * (1 - after / 0.55)) : 0;
    // Refraction ring with the cyan shock ring (0.5 s), and heat shimmer over the impact while the lance burns.
    const rp = clamp01(after / 0.5);
    this.refract.set(tmp.set(gx, 0, gz), 1 + Math.max(0, after) * 24, after >= 0 && rp < 1 ? 0.04 * (1 - rp) * (1 - rp) : 0);
    this.haze.set(tmp.set(gx, 0, gz), beamOn ? 0.015 * endFade * smoothstep(after / 0.25) : 0, t, 0.9);
    const moltenIn = easeOutCubic((after - 0.05) / 0.25);
    this.molten.mesh.visible = after >= 0.05 && lineFade > 0.01;
    this.molten.mesh.scale.setScalar(Math.max(1e-3, 0.5 + 1.2 * moltenIn));
    this.molten.material.opacity = after >= 0.05 ? 0.6 * (1 - smoothstep((after - 0.4) / 2.2)) * lineFade : 0;

    // Small dark smoke: two balls either side of the crater.
    if (ctx && dt > 0 && this.smokeStep < 2 && after >= 0.2 + this.smokeStep * 0.12) {
      const side = this.smokeStep === 0 ? -1.3 : 1.3;
      this.smoke.trigger(tmp.set(gx, 0.4, gz).addScaledVector(this.right, side * 0.8), 0.35, 0.9);
      this.smokeStep++;
    }

    this.shake = after >= 0
      ? (after < 0.9 ? 0.12 : 0) + 0.7 * Math.exp(-after * 7)
      : t >= CHARGE_START ? 0.04 * lockK : t >= SAT_IN && t < SAT_IN_END ? 0.03 : 0;
  }

  /** One physics step of a shattered tile: outward and up, tumbling, then it lands flat and stops spinning. */
  private stepTile(h: Hex, dt: number) {
    if (h.landed) return;
    h.v.y -= 20 * dt;
    h.p.addScaledVector(h.v, dt);
    h.e.set(h.e.x + h.w.x * dt, h.e.y + h.w.y * dt, h.e.z + h.w.z * dt);
    if (h.p.y < 0.05 && h.v.y < 0) {
      h.p.y = 0.05;
      h.landed = true;
      h.e.set(0, h.e.y, 0);
    }
  }

  private onImpact() {
    this.impacted = true;
    const c = this.ground;
    for (const h of this.hexes) {
      // Positions are relative to the grid centre (the instanced meshes are placed at the target).
      h.p.set(h.x, 0.1, h.z);
      const len = Math.hypot(h.x, h.z);
      const dx = len > 1e-4 ? h.x / len : Math.cos(h.ring * 2.4);
      const dz = len > 1e-4 ? h.z / len : Math.sin(h.ring * 2.4);
      const sp = 3.5 + h.ring * 1.8 + Math.random() * 2.5;
      h.v.set(dx * sp, 3 + Math.random() * 4.5, dz * sp);
      h.w.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 16);
      h.e.set(0, 0, 0);
      h.landed = false;
    }
    this.sparks.burst(220, this.tmp.set(c.x, 0.7, c.z));
    this.dust.burst(40, this.tmp.set(c.x, 0.3, c.z));
    const ctx = this.ctx;
    if (ctx) {
      ctx.targets.forEach((e, i) => {
        ctx.hit(e, { damage: i === 0 ? this.settings.damage : 25, knock: 3, from: this.hitFrom, color: '#7ff0ff' });
      });
    }
  }
}

export const orbitalLanceModule: EffectModule = {
  label: 'orbital lance',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new OrbitalLance(),
  telegraphs(effect) {
    const e = effect as OrbitalLance;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 2.8 }, start: 0.3, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.45, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as OrbitalLance;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as OrbitalLance).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
