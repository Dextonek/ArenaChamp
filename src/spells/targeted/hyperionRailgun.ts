import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep, softDotTexture } from '../../effects/common';
import {
  HeatHaze, LightningArc, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic,
  createScreenFx, flashBeat, impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Hyperion Railgun (hero tier, short cutscene, ~8.5 s): a huge rail cannon assembles itself from hard drawn panels
 * behind the caster's shoulder, locks a HUD reticle on the primary target, charges (coils light up back to front,
 * arcs jump between the rails, heat shimmer, violet motes sucked into the muzzle), holds a dead beat, then fires a
 * hypersonic slug. There is no fat laser: the shot is a thin, near-instant tracer; the power reads from the
 * refraction tunnel bending the arena along the line, the muzzle shock, the impact frames and the pierced enemies.
 *
 * Everything is a pure function of the clock `time` (the one-shot bursts are fired when the clock crosses them), so
 * scrubbing works. Camera: scripted with `cinematic` (hard cuts, letterbox in/out), keys built in cast().
 *
 * Design: pipeline/designs/hyperion-railgun.md. Recipes: railgun / sniper / charge / muzzle / hitscan / tracer.
 *
 * Timeline (seconds):
 *  0 assembly | 2.0 charge (low side cut, then over-the-rails cut, dead beat 4.2-4.6) | 4.6 fire |
 *  4.6 aftermath | 6.5 disassembly | 8.5 end
 */
export interface HyperionRailgunSettings {
  damage: number;
  loop: boolean;
}

export const defaultHyperionRailgun = (): HyperionRailgunSettings => ({ damage: 95, loop: false });

const T = {
  rails: 0.7, coils: 1.38, caps: 1.9, lock: 2.0, deadBeat: 4.2, fire: 4.6, after: 6.5, end: 8.5,
};

const MAX_TARGETS = 12;
const PIERCE_WIDTH = 1.4;
const RANGE = 40;
const RAIL_LEN = 6.6;
const COILS = 6;
const COIL_Z = (i: number) => -2.3 + i * 0.9;
const MUZZLE_Z = 3.5;
const TUNNEL_RINGS = 8;
const SMOKE_RINGS = 12;
const SUCK = 140;
const RECOIL = 1.2;
/** World scale of the cannon model (local rails are 6.6 long, so about 5 in the world). */
const SCALE = 0.75;

const COL = {
  plasma: new THREE.Color(0x8a7bff),
  copper: new THREE.Color(0xd7803a),
  yellow: new THREE.Color(0xffd23a),
};

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** The clock with the dead beat cut out: everything time-driven (haze, motes) holds still for 0.4 s. */
const animT = (t: number) => (t < T.deadBeat ? t : t < T.fire ? T.deadBeat : t - (T.fire - T.deadBeat));

// --- Textures ---------------------------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Yellow / black hazard stripes with a hard border. */
function hazardTexture() {
  return canvasTexture(256, 64, (c) => {
    c.fillStyle = '#e0b02a';
    c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#14171d';
    for (let x = -64; x < 256 + 64; x += 44) {
      c.beginPath();
      c.moveTo(x, 64);
      c.lineTo(x + 22, 64);
      c.lineTo(x + 22 + 64, 0);
      c.lineTo(x + 64, 0);
      c.closePath();
      c.fill();
    }
    c.fillStyle = '#14171d';
    c.fillRect(0, 0, 256, 5);
    c.fillRect(0, 59, 256, 5);
  });
}

/** Gunmetal panels with drawn seams, rivets and scratches: one tile per world unit. */
function panelTexture() {
  return canvasTexture(256, 256, (c) => {
    c.fillStyle = '#2b313a';
    c.fillRect(0, 0, 256, 256);
    const cuts = [0, 96, 256], cutsY = [0, 150, 256];
    for (let i = 0; i < cuts.length - 1; i++) {
      for (let j = 0; j < cutsY.length - 1; j++) {
        const shade = 0.82 + hash(i * 7 + j * 13 + 3) * 0.3;
        c.fillStyle = `rgb(${Math.round(46 * shade)},${Math.round(53 * shade)},${Math.round(62 * shade)})`;
        c.fillRect(cuts[i] + 3, cutsY[j] + 3, cuts[i + 1] - cuts[i] - 6, cutsY[j + 1] - cutsY[j] - 6);
      }
    }
    c.strokeStyle = '#0b0d11';
    c.lineWidth = 5;
    for (const x of cuts) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
    for (const y of cutsY) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }
    // Rivets.
    c.fillStyle = '#566070';
    for (const x of cuts.slice(0, -1)) {
      for (const y of cutsY.slice(0, -1)) {
        for (const [dx, dy] of [[14, 14], [82, 14], [14, 70], [82, 70]]) {
          c.beginPath();
          c.arc(x + dx, y + dy, 3.2, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    // Scratches and a yellow stencil bar.
    c.strokeStyle = 'rgba(160,170,185,0.25)';
    c.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const x = hash(i * 3.1) * 256, y = hash(i * 5.7) * 256;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 10 + hash(i) * 30, y + (hash(i * 2.2) - 0.5) * 10);
      c.stroke();
    }
    c.fillStyle = '#b8902a';
    c.fillRect(110, 176, 60, 8);
    c.fillRect(110, 192, 36, 4);
  }, true);
}

/** HUD ring: four arcs with gaps and inward ticks, black underlay so it reads on any background. */
function reticleRingTexture() {
  return canvasTexture(256, 256, (c) => {
    const arcs = (color: string, width: number) => {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.lineCap = 'butt';
      for (let k = 0; k < 4; k++) {
        const mid = (k * Math.PI) / 2 + Math.PI / 4;
        c.beginPath();
        c.arc(128, 128, 112, mid - 0.62, mid + 0.62);
        c.stroke();
      }
    };
    arcs('#14171d', 18);
    arcs('#ffd23a', 8);
    c.fillStyle = '#ffd23a';
    for (let k = 0; k < 4; k++) {
      c.save();
      c.translate(128, 128);
      c.rotate((k * Math.PI) / 2);
      c.fillRect(-4, -104, 8, 26);
      c.restore();
    }
  });
}

/** HUD centre: four corner brackets and a small dot. */
function reticleCrossTexture() {
  return canvasTexture(256, 256, (c) => {
    const draw = (color: string, w: number) => {
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = w;
      c.lineCap = 'square';
      const a = 62, b = 104;
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        c.beginPath();
        c.moveTo(128 + sx * a, 128 + sy * b);
        c.lineTo(128 + sx * b, 128 + sy * b);
        c.lineTo(128 + sx * b, 128 + sy * a);
        c.stroke();
      }
      c.beginPath();
      c.arc(128, 128, w * 0.5, 0, Math.PI * 2);
      c.fill();
    };
    draw('#14171d', 16);
    draw('#ffd23a', 7);
  });
}

// --- Small building blocks ----------------------------------------------------------------------------------

const _q = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const Z_AXIS = v3(0, 0, 1);

/** Camera-facing plane with an in-plane spin (userData.spin, radians). Parent group must be untransformed. */
function faceCamera(mesh: THREE.Mesh) {
  mesh.onBeforeRender = (_r, _s, camera) => {
    camera.getWorldQuaternion(_q);
    _spin.setFromAxisAngle(Z_AXIS, (mesh.userData.spin as number) ?? 0);
    mesh.quaternion.copy(_q).multiply(_spin);
    mesh.updateMatrixWorld(true);
  };
}

/** A straight, camera-facing line of constant world width (the tracer and its ionised trail). */
class BeamLine {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private positions = new Float32Array(12);
  private mat: THREE.ShaderMaterial;
  private a = v3();
  private b = v3();
  private width = 0;
  private cam = v3();
  private dir = v3();
  private side = v3();

  constructor(core: THREE.ColorRepresentation, glow: THREE.ColorRepresentation, blending: THREE.Blending = THREE.AdditiveBlending) {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), 2));
    this.geo.setIndex([0, 1, 2, 1, 3, 2]);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending, side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0 }, uCore: { value: new THREE.Color(core) }, uGlow: { value: new THREE.Color(glow) } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity; uniform vec3 uCore, uGlow; varying vec2 vUv;
        void main() {
          float x = abs(vUv.y * 2.0 - 1.0);
          float core = smoothstep(0.5, 0.0, x);
          float glow = pow(1.0 - x, 2.0);
          gl_FragColor = vec4(mix(uGlow, uCore, core), (glow * 0.55 + core) * uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.onBeforeRender = (_r, _s, camera) => this.build(camera);
  }

  set(a: THREE.Vector3, b: THREE.Vector3, width: number, opacity: number) {
    this.a.copy(a);
    this.b.copy(b);
    this.width = width;
    this.mat.uniforms.uOpacity.value = opacity;
    this.mesh.visible = opacity > 0.003 && width > 1e-4;
  }

  private build(camera: THREE.Camera) {
    this.cam.setFromMatrixPosition(camera.matrixWorld);
    this.dir.subVectors(this.b, this.a);
    this.side.crossVectors(this.dir, this.cam.sub(this.a));
    if (this.side.lengthSq() < 1e-10) this.side.set(0, 1, 0);
    this.side.normalize().multiplyScalar(this.width / 2);
    const s = this.side, a = this.a, b = this.b;
    this.positions.set([
      a.x - s.x, a.y - s.y, a.z - s.z, a.x + s.x, a.y + s.y, a.z + s.z,
      b.x - s.x, b.y - s.y, b.z - s.z, b.x + s.x, b.y + s.y, b.z + s.z,
    ]);
    this.geo.attributes.position.needsUpdate = true;
  }
}

interface Part {
  obj: THREE.Object3D;
  home: THREE.Vector3;
  /** Offset in cannon space it flies in from (and out to). */
  from: THREE.Vector3;
  spin: THREE.Vector3;
  a0: number; a1: number; d0: number; d1: number;
}

interface LockEvent { t: number; at: THREE.Vector3; n: number }

const GUN = {
  steel: () => new THREE.MeshStandardMaterial({ color: 0xbfc4cc, map: panelTexture(), metalness: 0.3, roughness: 0.55 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x14171d, metalness: 0.3, roughness: 0.6 }),
  hazard: () => new THREE.MeshStandardMaterial({ color: 0xd4d4d4, map: hazardTexture(), metalness: 0.1, roughness: 0.6 }),
};

// --- The effect --------------------------------------------------------------------------------------------

export class HyperionRailgun implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HyperionRailgunSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private fireDone = false;
  private keys: ShotKey[] = [];
  private lockFired: boolean[] = [];
  private steamFired: boolean[] = [];

  // Cast geometry.
  private P = v3();
  private d = v3(0, 0, -1);
  private r = v3(1, 0, 0);
  private CC = v3();
  private s = v3(0, 0, -1);
  private M = v3();
  private E = v3();
  private TA = v3();
  private rayLen = RANGE;
  private qBase = new THREE.Quaternion();
  private pierced: number[] = [];

  // Cannon.
  private root = new THREE.Group();
  private slide = new THREE.Group();
  private parts: Part[] = [];
  private lockEvents: LockEvent[] = [];
  private coilMats: THREE.MeshBasicMaterial[] = [];
  private ventLocal = [v3(0, 0.95, -4.1), v3(0.6, 0.95, -4.1), v3(-0.6, 0.95, -4.1)];
  private arcs: LightningArc[] = [];

  // Distortion.
  private haze = new HeatHaze({ width: 4.2, height: 2.4, scale: 5, speed: 1.6 });
  private muzzleShock = new ShockRefraction({ facing: 'camera', width: 0.3 });
  private tunnel: ShockRefraction[] = [];
  private groundRings: ShockRefraction[] = [];

  // Visual parts.
  private reticle: THREE.Mesh[] = [];
  private reticleMats: THREE.MeshBasicMaterial[] = [];
  private tracer = new BeamLine(0xffffff, 0xb8aeff);
  private trail = new BeamLine(0x8a7bff, 0x8a7bff);
  private underTrail = new BeamLine(0x2a1f5a, 0x2a1f5a, THREE.NormalBlending);
  private muzzleStar = new StarBurst({ points: 8, inner: 0.2, jitter: 0.3, color: 0x8a7bff, core: 0xdfe4ff, additive: false });
  private smokeRings: THREE.Mesh[] = [];
  private smokeRingMats: THREE.MeshBasicMaterial[] = [];
  private suck: THREE.Points;
  private suckPos = new Float32Array(SUCK * 3);
  private suckDir: THREE.Vector3[] = [];
  private smoke = new SmokeBall({ maxBalls: MAX_TARGETS + 2 });

  // Emitters.
  private lockSparks: Emitter;
  private sprayViolet: Emitter;
  private sprayHot: Emitter;
  private steam: Emitter;
  private sprayQ = new THREE.Quaternion();
  private sprayQInv = new THREE.Quaternion();

  private tmp = v3();
  private tmp2 = v3();
  private tmp3 = v3();
  private tmpC = new THREE.Color();
  private qYaw = new THREE.Quaternion();

  constructor(settings: HyperionRailgunSettings = defaultHyperionRailgun()) {
    this.settings = settings;
    this.screen.tint.set(0x2a3050);
    this.screen.impactColor.set(0x8a7bff);
    this.screen.whiteColor.set(0xe6e4ff);
    this.screen.speedLineColor.set(0xb8aeff);
    this.screen.edgeTint.set(0x8a7bff);

    this.buildCannon();
    this.root.scale.setScalar(SCALE);
    this.group.add(this.root);

    for (let i = 0; i < 4; i++) {
      const arc = new LightningArc({ width: 0.11, segments: 5, jitter: 0.15, branches: 0, core: 0xffffff, glow: 0x8a7bff, rerollEvery: 0.05 });
      this.arcs.push(arc);
      this.root.add(arc.mesh);
    }

    // Distortion meshes.
    for (let i = 0; i < TUNNEL_RINGS; i++) this.tunnel.push(new ShockRefraction({ facing: 'camera', width: 0.3 }));
    for (let i = 0; i < MAX_TARGETS; i++) this.groundRings.push(new ShockRefraction({ facing: 'ground', width: 0.3 }));
    this.group.add(this.haze.mesh, this.muzzleShock.mesh);
    for (const m of this.tunnel) this.group.add(m.mesh);
    for (const g of this.groundRings) this.group.add(g.mesh);

    // HUD reticle: three tightening rings and the centre brackets.
    const ringTex = reticleRingTexture(), crossTex = reticleCrossTexture();
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: i < 3 ? ringTex : crossTex, color: 0xe6bd30, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      mesh.renderOrder = 60 + i;
      mesh.frustumCulled = false;
      mesh.visible = false;
      faceCamera(mesh);
      this.reticle.push(mesh);
      this.reticleMats.push(mat);
      this.group.add(mesh);
    }

    // Tracer, trail, muzzle star.
    this.tracer.mesh.renderOrder = 40;
    this.trail.mesh.renderOrder = 39;
    this.underTrail.mesh.renderOrder = 38;
    this.group.add(this.underTrail.mesh, this.trail.mesh, this.tracer.mesh, this.muzzleStar.mesh);

    // Smoke rings along the shot line (normal blending: dark, hard-edged, thin).
    const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    for (let i = 0; i < SMOKE_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x3a3d48, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.smokeRings.push(mesh);
      this.smokeRingMats.push(mat);
      this.group.add(mesh);
    }

    // Violet motes sucked into the muzzle (positions are a pure function of the clock).
    for (let i = 0; i < SUCK; i++) {
      const y = 1 - (i + 0.5) * (2 / SUCK), rad = Math.sqrt(1 - y * y), phi = i * 2.399963;
      this.suckDir.push(v3(Math.cos(phi) * rad, y, Math.sin(phi) * rad));
    }
    const suckGeo = new THREE.BufferGeometry();
    suckGeo.setAttribute('position', new THREE.BufferAttribute(this.suckPos, 3));
    suckGeo.setDrawRange(0, 0);
    this.suck = new THREE.Points(suckGeo, new THREE.PointsMaterial({
      size: 0.2, map: softDotTexture(), color: 0x8a7bff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.suck.frustumCulled = false;
    this.suck.visible = false;
    this.group.add(this.suck);

    // Emitters (rate 0, burst by hand).
    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      return e;
    };
    this.lockSparks = em({
      maxParticles: 500, lifetime: 0.7, lifetimeJitter: 0.4, shapeSize: 0.15, speed: 6, speedJitter: 0.6, spread: 180, gravity: 8, drag: 1.2,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffd23a', colorEnd: '#d7803a', opacityStart: 0.95, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Directional sprays: the points object is turned so +Y is the shot direction (gravity is 0 because it would turn too).
    this.sprayViolet = em({
      maxParticles: 400, lifetime: 0.7, lifetimeJitter: 0.5, shapeSize: 0.25, speed: 24, speedJitter: 0.6, spread: 24, gravity: 0, drag: 1.8,
      sizeStart: 0.15, sizeEnd: 0.02, colorStart: '#dcd6ff', colorMid: '#8a7bff', colorEnd: '#3a2f9a', opacityStart: 0.95, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.sprayHot = em({
      maxParticles: 800, lifetime: 0.75, lifetimeJitter: 0.5, shapeSize: 0.25, speed: 20, speedJitter: 0.6, spread: 30, gravity: 0, drag: 1.7,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#ffd23a', colorMid: '#ffa62e', colorEnd: '#d7803a', opacityStart: 0.95, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.steam = em({
      maxParticles: 300, lifetime: 1.5, lifetimeJitter: 0.4, shapeSize: 0.12, speed: 3.2, speedJitter: 0.5, spread: 20, gravity: -0.3, drag: 0.8,
      sizeStart: 0.7, sizeEnd: 2.2, colorStart: '#8c93a3', colorEnd: '#2c2f38', opacityStart: 0.5, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.4, spin: 0.4,
    });
    this.emitters.push(this.lockSparks, this.sprayViolet, this.sprayHot, this.steam, this.smoke.emitter);
    this.group.add(this.smoke.mesh);
    this.reset();
  }

  /** The cannon in local space: +Z is the shot direction, centre at the origin, muzzle at z = 3.5. */
  private buildCannon() {
    const steel = GUN.steel(), dark = GUN.dark();
    steel.map!.repeat.set(1, 1);
    const hazard = GUN.hazard();
    this.root.add(this.slide);

    const add = (obj: THREE.Object3D, home: THREE.Vector3, from: THREE.Vector3, spin: THREE.Vector3, a0: number, a1: number, d0: number, d1: number) => {
      obj.position.copy(home);
      this.slide.add(obj);
      this.parts.push({ obj, home: home.clone(), from, spin, a0, a1, d0, d1 });
    };
    const box = (w: number, h: number, dp: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), mat);
      m.position.set(x, y, z);
      return m;
    };
    const decal = (w: number, h: number, x: number, y: number, z: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), hazard);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      return m;
    };

    // Rails: bevelled profile extruded along Z.
    const w = 0.4, h = 0.7, c = 0.1;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + c, -h / 2);
    shape.lineTo(w / 2 - c, -h / 2);
    shape.lineTo(w / 2, -h / 2 + c);
    shape.lineTo(w / 2, h / 2 - c);
    shape.lineTo(w / 2 - c, h / 2);
    shape.lineTo(-w / 2 + c, h / 2);
    shape.lineTo(-w / 2, h / 2 - c);
    shape.lineTo(-w / 2, -h / 2 + c);
    shape.closePath();
    const railGeo = new THREE.ExtrudeGeometry(shape, { depth: RAIL_LEN, bevelEnabled: false, steps: 1 });
    railGeo.translate(0, 0, -RAIL_LEN / 2);
    for (const side of [-1, 1]) {
      const rail = new THREE.Group();
      rail.add(new THREE.Mesh(railGeo, steel));
      // Hazard bands on the outer face (front and rear) and a dark top groove.
      rail.add(decal(1.1, 0.3, side * (w / 2 + 0.004), 0.02, 2.55, side * Math.PI / 2));
      rail.add(decal(0.7, 0.3, side * (w / 2 + 0.004), 0.02, -2.9, side * Math.PI / 2));
      rail.add(box(0.1, 0.03, RAIL_LEN - 0.4, dark, 0, h / 2 + 0.005, 0));
      add(rail, v3(side * 0.4, 0, 0), v3(side * 18, 8, -9), v3(0.4, 0, -side * 0.3), side < 0 ? 0 : 0.1, side < 0 ? 0.6 : 0.7, side < 0 ? 7.7 : 7.8, side < 0 ? 8.3 : 8.4);
    }

    // Cross braces between the rails.
    const braces = new THREE.Group();
    for (const z of [-3.0, -0.9, 1.0, 2.9]) braces.add(box(0.5, 0.4, 0.34, steel, 0, -0.03, z));
    add(braces, v3(0, 0, 0), v3(0, 12, -7), v3(0.3, 0, 0), 0.45, 0.7, 7.5, 8.0);

    // Copper coils, back to front.
    for (let i = 0; i < COILS; i++) {
      const coil = new THREE.Group();
      // Dark metallic copper body; the charge glow lives only on a thin inner band so no full torus can bloom.
      const body = new THREE.MeshStandardMaterial({ color: 0x6a3a1c, metalness: 0.85, roughness: 0.35 });
      const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      this.coilMats.push(mat);
      coil.add(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.09, 12, 32), body));
      coil.add(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.11, 4, 32).scale(1, 1, 0.3), dark));
      coil.add(new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.028, 6, 40), mat));
      coil.add(box(0.28, 0.22, 0.26, dark, 0, -0.84, 0));
      const a = ((i % 2 ? 1 : -1) * 1.0 + i * 0.4);
      const from = v3(Math.cos(a) * 16, 6 + Math.sin(a) * 6, -4 - i);
      const start = 0.7 + i * 0.08;
      add(coil, v3(0, 0, COIL_Z(i)), from, v3(0, 0, 3.5 * (i % 2 ? 1 : -1)), start, start + 0.28, 7.05 + (COILS - 1 - i) * 0.07, 7.05 + (COILS - 1 - i) * 0.07 + 0.4);
      this.lockEvents.push({ t: start + 0.28, at: v3(0.8, 0, COIL_Z(i)), n: 10 }, { t: start + 0.28, at: v3(-0.8, 0, COIL_Z(i)), n: 10 });
    }

    // Capacitor block with vent slats and hazard plates.
    const cap = new THREE.Group();
    cap.add(box(1.9, 1.7, 1.6, steel));
    for (let k = 0; k < 6; k++) cap.add(box(1.5, 0.05, 0.1, dark, 0, 0.86, -0.6 + k * 0.24));
    cap.add(box(1.1, 0.9, 0.12, dark, 0, 0, 0.84));
    cap.add(box(0.2, 0.2, 1.1, new THREE.MeshStandardMaterial({ color: 0xd7803a, metalness: 0.5, roughness: 0.4 }), 0.45, 0.1, 1.1));
    cap.add(box(0.2, 0.2, 1.1, new THREE.MeshStandardMaterial({ color: 0xd7803a, metalness: 0.5, roughness: 0.4 }), -0.45, 0.1, 1.1));
    cap.add(decal(1.2, 0.34, 0.954, -0.45, 0, Math.PI / 2), decal(1.2, 0.34, -0.954, -0.45, 0, -Math.PI / 2));
    add(cap, v3(0, 0, -4.1), v3(0, 10, -16), v3(-0.5, 0, 0), 1.25, 1.8, 6.5, 7.05);
    this.lockEvents.push({ t: 1.8, at: v3(0.95, 0.4, -4.1), n: 14 }, { t: 1.8, at: v3(-0.95, 0.4, -4.1), n: 14 });

    // Muzzle shroud: a square frame around the opening.
    const muzzle = new THREE.Group();
    muzzle.add(box(2.1, 0.32, 0.55, steel, 0, 0.9, 0), box(2.1, 0.32, 0.55, steel, 0, -0.9, 0));
    muzzle.add(box(0.32, 1.5, 0.55, steel, 1.0, 0, 0), box(0.32, 1.5, 0.55, steel, -1.0, 0, 0));
    muzzle.add(decal(1.2, 0.26, 0, 1.07, 0.278, 0));
    muzzle.add(box(1.0, 0.1, 0.3, dark, 0, 1.12, -0.05));
    add(muzzle, v3(0, 0, 3.15), v3(0, 6, 16), v3(0.4, 0, 0), 1.45, 1.9, 6.5, 7.05);
    this.lockEvents.push({ t: 1.9, at: v3(0.95, 0.9, 3.4), n: 12 }, { t: 1.9, at: v3(-0.95, 0.9, 3.4), n: 12 });

    // Under-slung mount block.
    const mount = new THREE.Group();
    mount.add(box(0.8, 0.5, 1.6, steel), box(1.5, 0.16, 1.9, dark, 0, -0.3, 0));
    add(mount, v3(0, -1.28, -0.6), v3(0, -10, -4), v3(0, 0.6, 0), 1.4, 1.9, 6.5, 7.05);

    // Rail lock sparks.
    for (const sx of [-1, 1]) {
      this.lockEvents.push({ t: T.rails, at: v3(sx * 0.5, 0.4, 3.3), n: 12 }, { t: T.rails, at: v3(sx * 0.5, 0.4, -3.3), n: 12 });
    }
    this.lockFired = this.lockEvents.map(() => false);
    this.steamFired = [false, false, false, false];
  }

  get duration() {
    return T.end;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const P = this.P.copy(ctx.from).setY(0);
    const primary = ctx.targetPos.length ? ctx.targetPos[0] : ctx.point;
    const d = this.d.copy(primary).sub(P).setY(0);
    if (d.lengthSq() < 0.25) d.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (d.lengthSq() < 1e-4) d.set(0, 0, -1);
    d.normalize();
    this.r.set(-d.z, 0, d.x);
    const dist = Math.max(4, this.tmp.copy(primary).sub(P).setY(0).dot(d));
    this.TA.set(primary.x, 1.5, primary.z);

    // Which enemies the slug pierces: within PIERCE_WIDTH of the caster-to-target line, in front, up to RANGE.
    this.pierced = [];
    ctx.targets.forEach((_e, i) => {
      const v = this.tmp.copy(ctx.targetPos[i]).sub(P).setY(0);
      const along = v.dot(d);
      const perp = v.addScaledVector(d, -along).length();
      if (i === 0 || (along > 0 && along <= RANGE && perp <= PIERCE_WIDTH)) this.pierced.push(i);
    });
    this.screen.silhouettes = this.pierced.map((i) => ctx.targets[i].group);
    this.screen.focus.copy(this.TA);

    // Cannon: behind and above the right shoulder, aimed so the slug crosses the caster line near the target.
    this.CC.copy(P).addScaledVector(d, -0.3).addScaledVector(this.r, 1.3).setY(2.1);
    const dq = Math.max(dist + 5, 16);
    const Q = this.tmp.copy(P).addScaledVector(d, dq).setY(1.7);
    this.s.copy(Q).sub(this.CC).normalize();
    this.M.copy(this.CC).addScaledVector(this.s, MUZZLE_Z * SCALE);
    // The ray ends at RANGE or where it meets the ground.
    this.rayLen = RANGE;
    if (this.s.y < -1e-3) this.rayLen = Math.min(RANGE, (this.M.y - 0.35) / -this.s.y);
    this.E.copy(this.M).addScaledVector(this.s, this.rayLen);
    this.root.position.copy(this.CC);
    this.root.up.set(0, 1, 0);
    this.root.lookAt(this.tmp.copy(this.CC).add(this.s));
    this.qBase.copy(this.root.quaternion);

    // Spray emitters point along the shot.
    this.sprayQ.setFromUnitVectors(v3(0, 1, 0), this.s);
    this.sprayQInv.copy(this.sprayQ).invert();
    this.sprayViolet.points.quaternion.copy(this.sprayQ);
    this.sprayHot.points.quaternion.copy(this.sprayQ);
    this.buildKeys();
  }

  /** Cannon-space point to world (uses the cannon's un-recoiled pose). */
  private world(local: THREE.Vector3, out: THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    return this.root.localToWorld(out.copy(local));
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    const P = this.P, d = this.d, r = this.r, CC = this.CC, s = this.s;
    const add = (t: number, pos: THREE.Vector3, target: THREE.Vector3, fov: number, o: { cut?: boolean; ease?: ShotKey['ease'] } = {}) =>
      keys.push({ t, position: pos, target, fov, roll: 0, cut: o.cut, ease: o.ease });
    const pf = (base: THREE.Vector3, fw: number, rt: number, y: number) =>
      base.clone().addScaledVector(d, fw).addScaledVector(r, rt).add(v3(0, y, 0));
    const along = (fw: number, rt: number, y: number) => CC.clone().addScaledVector(s, fw).addScaledVector(r, rt).add(v3(0, y, 0));
    const mid = pf(P, 8, 0, 1.8);
    const Cm = P.clone().add(CC).multiplyScalar(0.5).add(v3(0, -0.1, 0));
    const high = (fw: number) => pf(P, fw, -1.8, 4.5);

    // 1. Assembly: wide shot from the cannon side that keeps every part inside the frame, then ends behind the caster.
    add(0, Cm.clone().addScaledVector(r, 11).addScaledVector(d, 4).add(v3(0, 2.4, 0)), Cm.clone(), 46);
    add(1.0, Cm.clone().addScaledVector(r, 10).addScaledVector(d, -2).add(v3(0, 2.8, 0)), Cm.clone(), 46);
    add(T.lock - 0.001, high(-9), mid, 52);
    // 2. Charge: low side shot along the rails, then from above the rear looking along the rails to the target.
    add(T.lock, along(-0.8, 6.8, -1.3), along(-0.4, 0, 0), 40, { cut: true });
    add(3.5 - 0.001, along(0.1, 6.8, -1.2), along(-0.4, 0, 0), 40, { ease: 'linear' });
    const aimLow = this.TA.clone().add(v3(0, -2.0, 0));
    add(3.5, along(-6.2, 0, 2.0), aimLow, 36, { cut: true });
    add(4.2, along(-5.3, 0, 1.8), aimLow, 32, { ease: 'inOut' });
    add(T.fire - 0.001, along(-5.3, 0, 1.8), aimLow, 32);
    // 3. Fire and aftermath: high and back on the side opposite the cannon, the whole line in frame.
    const fireTarget = pf(P, 20, 0, 1.3);
    add(T.fire, high(-9), fireTarget, 52, { cut: true });
    add(T.after - 0.001, high(-7.6), fireTarget, 50, { ease: 'out' });
    // 4. Disassembly: wide view from the cannon side while the parts leave.
    add(T.after, Cm.clone().addScaledVector(r, 11).addScaledVector(d, -3).add(v3(0, 3.2, 0)), Cm.clone(), 54, { cut: true });
    add(T.end, Cm.clone().addScaledVector(r, 12).addScaledVector(d, -4).add(v3(0, 3.6, 0)), Cm.clone(), 54, { ease: 'linear' });
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
    this.fireDone = false;
    this.lockFired = this.lockEvents.map(() => false);
    this.steamFired = [false, false, false, false];
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.zeroDistortion();
    this.layout(0);
  }

  private zeroDistortion() {
    this.haze.set(this.tmp.set(0, -100, 0), 0, 0);
    this.muzzleShock.set(this.tmp, 0, 0);
    for (const m of this.tunnel) m.set(this.tmp, 0, 0);
    for (const g of this.groundRings) g.set(this.tmp, 0, 0);
  }

  private finish() {
    this.playing = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.shake = 0;
    this.time = 0;
    this.zeroDistortion();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= T.end) {
      if (this.settings.loop) { this.play(); return; }
      this.finish();
      return;
    }
    for (const a of this.arcs) a.update(dt);
    this.layout(dt);
    this.fireEvents();
  }

  // --- Events (one-shot bursts, fired when the clock crosses them) --------------------------------------------

  private fireEvents() {
    const t = this.time;
    this.lockEvents.forEach((e, i) => {
      if (this.lockFired[i] || t < e.t) return;
      this.lockFired[i] = true;
      this.lockSparks.burst(e.n, this.world(e.at, this.tmp2));
    });
    [4.75, 5.05, 5.45, 5.95].forEach((at, i) => {
      if (this.steamFired[i] || t < at) return;
      this.steamFired[i] = true;
      for (const v of this.ventLocal) this.steam.burst(8, this.world(v.clone().add(this.slide.position), this.tmp2));
    });
    if (!this.fireDone && t >= T.fire) this.onFire();
  }

  private onFire() {
    this.fireDone = true;
    const ctx = this.ctx;
    this.sprayViolet.burst(120, this.tmp2.copy(this.M).applyQuaternion(this.sprayQInv));
    if (!ctx) return;
    for (const i of this.pierced) {
      const e = ctx.targets[i], p = ctx.targetPos[i];
      ctx.hit(e, { damage: this.settings.damage, knock: 12, from: ctx.from, color: '#b8aeff' });
      // Spark spray out of the enemy's back, along the line.
      this.tmp3.set(p.x, 1.4, p.z).addScaledVector(this.s, 0.7);
      this.sprayHot.burst(55, this.tmp2.copy(this.tmp3).applyQuaternion(this.sprayQInv));
      this.smoke.trigger(this.tmp3.set(p.x, 1.2, p.z), 0.9, 0.9);
    }
  }

  // --- Layout: everything that is drawn is a function of the clock --------------------------------------------

  private coilGlow(i: number, t: number, out: THREE.Color): number {
    const start = 2.1 + i * 0.32;
    const e = ss(start, start + 0.6, t);
    // Copper -> yellow -> violet as the coil charges.
    if (e < 0.5) out.copy(COL.copper).lerp(COL.yellow, e * 2); else out.copy(COL.yellow).lerp(COL.plasma, (e - 0.5) * 2);
    let k = 0.45 * e;
    if (t < T.fire) {
      k *= 1 + 2.4 * ss(4.3, 4.55, t); // the last moments: only now it crosses the bloom threshold
      if (t >= T.deadBeat) k *= 0.62 + 0.38 * hash(Math.floor(t * 34) + i * 3.1);
      return k;
    }
    // Aftermath: violet -> copper -> dark.
    out.copy(COL.plasma).lerp(COL.copper, ss(T.fire, 5.4, t));
    return lerp(1.5, 0.35, ss(T.fire, 5.4, t)) * (1 - ss(5.4, 6.4, t));
  }

  private partAway(p: Part, t: number): number {
    if (t < p.d0) return 1 - Math.pow(clamp((t - p.a0) / (p.a1 - p.a0), 0, 1), 2.2);
    return Math.pow(clamp((t - p.d0) / (p.d1 - p.d0), 0, 1), 2);
  }

  private layout(dt: number) {
    const t = this.time;
    const at = animT(t);
    const live = this.playing && dt >= 0;
    const cin = this.cinematic;
    const M = this.M, s = this.s;

    sampleShots(this.keys, t, cin);
    cin.letterbox = ss(0, 0.6, t) * (1 - ss(5.8, T.after, t));

    // ---- cannon pose: hover bob, aim settling, assembly, recoil ----
    const recoil = t < T.fire ? 0 : t < T.fire + 0.06 ? (t - T.fire) / 0.06 : 1 - ss(T.fire + 0.06, 5.5, t);
    this.root.position.copy(this.CC);
    this.root.position.y += Math.sin(at * 2.1) * 0.04 * ss(1.8, 2.2, t);
    this.qYaw.setFromAxisAngle(this.tmp.set(0, 1, 0), 0.35 * (1 - ss(0, T.caps, t)));
    this.root.quaternion.copy(this.qBase).multiply(this.qYaw);
    this.slide.position.set(0, 0, (-RECOIL / SCALE) * recoil);
    for (const p of this.parts) {
      const away = this.partAway(p, t);
      p.obj.visible = t >= p.a0 && away < 0.999;
      p.obj.position.copy(p.home).addScaledVector(p.from, away);
      p.obj.rotation.set(p.spin.x * away, p.spin.y * away, p.spin.z * away);
    }
    this.root.updateMatrixWorld(true);

    // ---- coils ----
    for (let i = 0; i < COILS; i++) {
      const k = this.coilGlow(i, t, this.tmpC);
      this.coilMats[i].color.copy(this.tmpC).multiplyScalar(k);
    }

    // ---- arcs between the rails and from the rails to the coils (charge + dead beat) ----
    const arcOn = t >= 2.5 && t < T.fire;
    const slot = Math.floor(t * 16);
    for (let k = 0; k < this.arcs.length; k++) {
      const arc = this.arcs[k];
      const lit = clamp(Math.floor((t - 2.1) / 0.32), 0, COILS - 1);
      const zc = COIL_Z(Math.floor(hash(slot * 1.7 + k * 9.3) * (lit + 1)));
      const on = arcOn && hash(slot + k * 4.1) > (t >= T.deadBeat ? 0.25 : 0.5);
      if (k < 2) {
        const side = k === 0 ? 1 : -1;
        arc.setEnds(this.tmp.set(side * 0.2, 0.05 + hash(slot + k) * 0.25, zc), this.tmp2.set(-side * 0.2, 0.05 + hash(slot * 2.3 + k) * 0.25, zc + 0.25));
      } else {
        const side = k === 2 ? 1 : -1;
        const a = 0.9 + hash(slot * 1.3 + k) * 0.5;
        arc.setEnds(this.tmp.set(side * 0.4, 0.35, zc), this.tmp2.set(side * Math.cos(a) * 0.72, Math.sin(a) * 0.72, zc));
      }
      arc.opacity = on ? 0.85 : 0;
    }

    // ---- heat haze over the coils ----
    this.world(this.tmp.set(0, -0.9, 0.2), this.tmp2);
    const hazeK = 0.02 * ss(2.2, 4.0, t) * (1 - ss(T.fire, 6.6, t));
    this.haze.set(this.tmp2, hazeK, at);

    // ---- violet motes sucked into the muzzle ----
    const suckOn = t >= 2.3 && t < T.fire;
    this.suck.visible = suckOn;
    if (suckOn) {
      const n = Math.floor(SUCK * ss(2.3, 3.4, t));
      for (let i = 0; i < n; i++) {
        const p = (at * 1.1 + hash(i * 1.37)) % 1;
        const rad = lerp(4.2, 0.06, Math.pow(p, 1.7)) * (0.7 + 0.5 * hash(i * 2.9));
        const dir = this.suckDir[i];
        this.suckPos[i * 3] = M.x + dir.x * rad;
        this.suckPos[i * 3 + 1] = M.y + dir.y * rad;
        this.suckPos[i * 3 + 2] = M.z + dir.z * rad;
      }
      const geo = this.suck.geometry;
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
    }

    // ---- HUD reticle: three tightening rings lock on, the brackets hold until the shot ----
    const rOn = t >= 0.6 && t < T.fire;
    for (let j = 0; j < 4; j++) {
      const mesh = this.reticle[j], mat = this.reticleMats[j];
      mesh.visible = rOn;
      if (!rOn) continue;
      mesh.position.copy(this.TA);
      if (j < 3) {
        const start = 0.6 + j * 0.4;
        const p = ss(start, start + 0.9, t);
        const rad = lerp(3.4 + j * 0.5, 1.15 - j * 0.2, p);
        mesh.scale.setScalar(rad / 1.0);
        mesh.userData.spin = (j % 2 ? -1 : 1) * (p * 1.6 + at * 0.35 * ss(T.lock, 2.6, t));
        mat.opacity = 0.9 * ss(start, start + 0.25, t);
      } else {
        const p = ss(1.6, 2.1, t);
        mesh.scale.setScalar(lerp(1.7, 0.95, p));
        mesh.userData.spin = 0;
        mat.opacity = 0.95 * ss(1.6, 1.9, t) * (t >= T.deadBeat ? (hash(Math.floor(t * 30)) > 0.3 ? 1 : 0.35) : 1);
      }
    }

    // ---- the shot: tracer, trail, muzzle star, smoke rings ----
    const f = t - T.fire;
    const trailA = f >= 0 && f < 0.8 ? 1 - f / 0.8 : 0;
    const tracerOn = f >= 0 && f < 2 / 60;
    this.tracer.set(M, this.E, 0.06, tracerOn ? 1 : 0);
    const trailO = f >= 0 ? Math.pow(trailA, 0.6) : 0;
    this.trail.set(M, this.E, 0.3 * trailA, 0.9 * trailO);
    this.underTrail.set(M, this.E, 0.6 * trailA, 0.5 * trailO);
    this.muzzleStar.set(M, 2.8 * (1 - clamp(f / 0.1, 0, 1)), f >= 0 && f < 0.1 ? 1 : 0, f * 20);
    for (let k = 0; k < SMOKE_RINGS; k++) {
      const mesh = this.smokeRings[k], mat = this.smokeRingMats[k];
      const start = T.fire + 0.05 + k * 0.015, p = (t - start) / 2.2;
      mesh.visible = p >= 0 && p < 1;
      if (!mesh.visible) continue;
      const dist = this.rayLen * (0.05 + (k / (SMOKE_RINGS - 1)) * 0.9);
      const ang = k * 0.9, wob = 0.3 * p;
      this.tmp.copy(M).addScaledVector(s, dist);
      // Spiral: each ring's centre drifts around the line as it ages.
      this.tmp3.set(0, 1, 0).cross(s).normalize();
      this.tmp2.crossVectors(s, this.tmp3);
      this.tmp.addScaledVector(this.tmp3, Math.cos(ang + p * 2) * wob).addScaledVector(this.tmp2, Math.sin(ang + p * 2) * wob);
      mesh.position.copy(this.tmp);
      mesh.quaternion.setFromUnitVectors(Z_AXIS, s);
      mesh.scale.setScalar(0.45 + 2.0 * (1 - Math.pow(1 - p, 2)));
      mat.color.setHex(0x3a3d48).lerp(this.tmpC.setHex(0x8a7bff), 0.6 * (1 - ss(0, 0.25, p)));
      mat.opacity = 0.7 * (1 - ss(0.35, 1, p));
    }

    // ---- distortion: muzzle shock, refraction tunnel, ground rings ----
    const mp = clamp((t - T.fire) / 0.35, 0, 1);
    if (t >= T.fire && mp < 1) this.muzzleShock.set(M, lerp(0.5, 6, 1 - Math.pow(1 - mp, 2)), 0.06 * (1 - mp) * (1 - mp));
    else this.muzzleShock.set(M, 0, 0);
    for (let k = 0; k < TUNNEL_RINGS; k++) {
      const p = (t - (T.fire + (k * 0.12) / (TUNNEL_RINGS - 1))) / 0.4;
      if (p < 0 || p >= 1) { this.tunnel[k].set(M, 0, 0); continue; }
      const dist = this.rayLen * (0.06 + (k / (TUNNEL_RINGS - 1)) * 0.9);
      this.tunnel[k].set(this.tmp.copy(M).addScaledVector(s, dist), lerp(0.4, 2.5, p), 0.04 * (1 - p));
    }
    for (let j = 0; j < MAX_TARGETS; j++) {
      const idx = this.pierced[j];
      const p = (t - (T.fire + 0.02)) / 0.5;
      if (idx === undefined || !this.ctx || p < 0 || p >= 1) { this.groundRings[j].set(M, 0, 0); continue; }
      this.groundRings[j].set(this.ctx.targetPos[idx], lerp(0.5, 3, 1 - Math.pow(1 - p, 2)), 0.03 * (1 - p));
    }

    // ---- screen: dark charge grade, impact frames, short whiteout, chroma ----
    const sf = this.screen;
    sf.darken = t < T.fire ? 0.35 * ss(T.lock, 2.6, t) : 0;
    sf.impact = impactFrameAt(t, T.fire, [1, 2], 0.03);
    const fb = flashBeat(t, T.fire, 0.02, 0.04, 0.1);
    sf.exposure = fb.exposure;
    sf.whiteout = fb.whiteout * 0.6;
    sf.chroma = chromaPulse(t, T.fire, 0.7, 30);
    sf.speedLines = t >= T.fire ? 0.5 * Math.exp(-(t - T.fire) * 16) : 0;

    // ---- shake: assembly locks, then the shot ----
    let sh = 0;
    for (const b of [T.rails, T.coils, T.caps]) if (t >= b) sh += 0.05 * Math.exp(-(t - b) * 14);
    if (t >= T.fire) sh += 0.7 * Math.exp(-(t - T.fire) * 6);
    this.shake = live ? sh : 0;
  }

  telegraphSpecs(): TelegraphSpec[] {
    if (!this.ctx) return [];
    const P = this.P, d = this.d;
    return [{
      shape: { kind: 'line', x1: P.x, z1: P.z, x2: P.x + d.x * RANGE, z2: P.z + d.z * RANGE, width: 2.8 },
      start: T.lock,
      impact: T.fire,
    }];
  }
}

export const hyperionRailgunModule: EffectModule = {
  label: 'hyperion railgun',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAX_TARGETS },
  create: () => new HyperionRailgun(),
  telegraphs(effect) {
    return (effect as HyperionRailgun).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.45, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as HyperionRailgun;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as HyperionRailgun).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
