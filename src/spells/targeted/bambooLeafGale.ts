import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Bamboo Leaf Gale (targeted, single target): hundreds of hard-edged bamboo leaves (instanced, drawn on a canvas
 * with a dark midrib, outline and a two-tone value ramp) lift off the ground round the caster in a toon-wind
 * spiral, flatten into one wide horizontal crescent in front of the caster, hold for a dead beat, then the
 * crescent is flung at the enemy while growing to 2.6x. It cuts through: a thin white slash line, a soft green
 * impact frame, a ring, and the leaves burst outward, carry on through the enemy and flutter down to the ground
 * while a soft smoke crescent lingers for a moment.
 *
 * Leaves are a material, not a light: normal-blended, mid-tone colours below the bloom threshold. White lives only
 * in the slash line core.
 *
 * Recipes: f-swipe-smoke-crescent-slash (soft smoke crescent = speed), h-noggi-anime-wind-streaks (tapered toon
 * streaks trailing the blade), e-yordin-toon-color-cyclone (toon bands: light inner edge, saturated middle, dark
 * outer edge, around the caster).
 */
export interface BambooLeafGaleSettings {
  damage: number;
  color: string;
  loop: boolean;
}

export const defaultBambooLeafGale = (): BambooLeafGaleSettings => ({
  damage: 45,
  color: '#7fd8c0',
  loop: false,
});

const T_FORM = 0.7; // the spiral starts flattening into the crescent
const T_HOLD = 1.05; // crescent complete, dead beat
const T_GO = 1.1; // crescent released
const D = 1.45; // it cuts through the enemy
const DURATION = 3.8;
const LEAVES = 380;
const STREAKS = 3;
const BANDS = 3;
const GLINTS = 3;
const R0 = 1.8; // crescent radius at the caster
const GROW = 1.6; // radius is R0 * (1 + GROW) at the enemy
const HS = 1.15; // crescent half angle
const TILT = 0.5; // the crescent plane leans: tip low and forward, horns trailing and up
const FORWARD_SPEED = 11; // leaves keep flying through the enemy
const DRAG = 2.6;
const UP = new THREE.Vector3(0, 1, 0);

const rand = (n: number) => {
  const x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

// Leaf tones (mid-tones; the brightest is well below the bloom threshold after the texture multiply).
const TONE_PALE = new THREE.Color(0x92d6aa);
const TONE_MID = new THREE.Color(0x4fae70);
const TONE_DEEP = new THREE.Color(0x2a7a52);
const TONE_GOLD = new THREE.Color(0xc9a24a);

interface Leaf {
  a: number; r: number; h: number; d: number; // spiral: start angle, radius, height factor, lift delay
  s: number; ph: number; f: number; roll: number; // stagger, flutter phase and rate, crescent roll
  th: number; w: number; n: number; // crescent slot: angle, radial offset, thickness offset
  len: number; yaw: number; // size, resting heading on the ground
}

/**
 * A bamboo leaf drawn flat (long axis along +X, tip at the right), grayscale so the instance colour tints it:
 * two value-ramped halves split by a dark midrib, vein ticks, a dark outline, a light edge along the top.
 * Hard alpha (alphaTest), no soft edge.
 */
function leafTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 112;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const body = new Path2D();
  body.moveTo(8, 56);
  body.bezierCurveTo(60, 12, 170, 12, 250, 56);
  body.bezierCurveTo(170, 100, 60, 100, 8, 56);
  body.closePath();

  g.save();
  g.clip(body);
  const up = g.createLinearGradient(0, 0, 256, 0);
  up.addColorStop(0, '#8a8a8a');
  up.addColorStop(0.5, '#dcdcdc');
  up.addColorStop(1, '#f0f0f0');
  g.fillStyle = up;
  g.fillRect(0, 0, 256, 56);
  const lo = g.createLinearGradient(0, 0, 256, 0);
  lo.addColorStop(0, '#5a5a5a');
  lo.addColorStop(0.5, '#9c9c9c');
  lo.addColorStop(1, '#bcbcbc');
  g.fillStyle = lo;
  g.fillRect(0, 56, 256, 56);
  // Vein ticks angled toward the tip.
  g.strokeStyle = 'rgba(40,40,40,0.55)';
  g.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 33;
    g.beginPath(); g.moveTo(x, 56); g.lineTo(x + 26, 28 + i * 2); g.stroke();
    g.beginPath(); g.moveTo(x, 56); g.lineTo(x + 26, 84 - i * 2); g.stroke();
  }
  // Light edge along the top (light from above).
  g.strokeStyle = '#ffffff';
  g.globalAlpha = 0.5;
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(40, 36); g.bezierCurveTo(80, 22, 160, 22, 232, 50); g.stroke();
  g.globalAlpha = 1;
  g.restore();

  // Dark midrib (thicker at the base) and outline.
  g.strokeStyle = '#1c1c1c';
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(2, 56); g.lineTo(236, 56); g.stroke();
  g.lineWidth = 7;
  g.stroke(body);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A thin tapered lens (the slash line) as a camera-facing billboard with a roll. */
function createSlash() {
  const shape = new THREE.Shape();
  shape.moveTo(-1, 0);
  shape.quadraticCurveTo(0, 0.5, 1, 0);
  shape.quadraticCurveTo(0, -0.5, -1, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
  mesh.visible = false;
  const camQ = new THREE.Quaternion();
  const parentQ = new THREE.Quaternion();
  const rollQ = new THREE.Quaternion();
  let roll = 0;
  mesh.onBeforeRender = (_r, _s, camera) => {
    mesh.parent?.getWorldQuaternion(parentQ);
    camera.getWorldQuaternion(camQ);
    rollQ.setFromAxisAngle(UP.clone().set(0, 0, 1), roll);
    mesh.quaternion.copy(parentQ.invert().multiply(camQ).multiply(rollQ));
    mesh.updateMatrixWorld(true);
  };
  return {
    mesh,
    set(pos: THREE.Vector3, length: number, thick: number, opacity: number, r: number) {
      mesh.visible = opacity > 0.002 && length > 1e-3 && thick > 1e-3;
      mesh.position.copy(pos);
      mesh.scale.set(Math.max(length, 1e-3), Math.max(thick, 1e-3), 1);
      mat.opacity = opacity;
      roll = r;
    },
  };
}

export class BambooLeafGale implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BambooLeafGaleSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private smokeDone = false;

  // Cast geometry.
  private feet = new THREE.Vector3(0, 0, 14);
  private tFeet = new THREE.Vector3();
  private chest = new THREE.Vector3(0, 1.3, 0);
  private F = new THREE.Vector3(0, 0, -1); // flight direction (horizontal)
  private S = new THREE.Vector3(-1, 0, 0); // lateral
  private Fp = new THREE.Vector3(); // crescent forward (tilted)
  private Np = new THREE.Vector3(); // crescent plane normal
  private hold = new THREE.Vector3();
  private hit = new THREE.Vector3();

  // Per-frame crescent frame.
  private cO = new THREE.Vector3();
  private cR = R0;
  private cL = 1;

  // Leaves.
  private leaves: Leaf[] = Array.from({ length: LEAVES }, (_, i) => {
    const th = (rand(i + 11) * 2 - 1) * HS * 0.97;
    return {
      a: rand(i + 1) * Math.PI * 2, r: 0.7 + rand(i + 2) * 1.6, h: Math.pow(rand(i + 3), 0.8), d: rand(i + 4) * 0.35,
      s: rand(i + 5), ph: rand(i + 6) * Math.PI * 2, f: 4 + rand(i + 7) * 5, roll: (rand(i + 8) - 0.5) * 2.4,
      th, w: (rand(i + 12) * 2 - 1) * 0.5, n: rand(i + 13) * 2 - 1,
      len: 0.55 + rand(i + 14) * 0.25, yaw: rand(i + 15) * Math.PI * 2,
    };
  });
  private leafMat = new THREE.MeshBasicMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  private leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.42), this.leafMat, LEAVES);
  private lp = new Float32Array(LEAVES * 3); // last laid-out position
  private lv = new Float32Array(LEAVES * 3); // velocity after the cut
  private landed = new Uint8Array(LEAVES);

  // Wind: toon bands round the caster, toon streaks behind the blade, soft smoke crescent after the cut.
  private bandRoot = new THREE.Group();
  private bandPlanes: THREE.Group[] = [];
  private bands: CrescentArc[] = [];
  private streakRoots: THREE.Group[] = [];
  private streaks: CrescentArc[] = [];
  private smokePlane = new THREE.Group();
  private smokeCres: CrescentArc;

  // Pieces.
  private castRing = createRing(0x7fd8c0, 0.82, 1, 64);
  private ringA = createRing(0x7fd8c0, 0.72, 1, 96);
  private ringB = createRing(0xe8c86a, 0.95, 1, 96);
  private flash = new GlowSphere(0xcdf5e6, { rim: false });
  private star = new StarBurst({ points: 8, color: 0x7fd8c0, core: 0xe6fff6, additive: false });
  private glints: StarBurst[] = [];
  private slash = createSlash();
  private smoke = new SmokeBall({ color: 0x1d3a34, rim: 0x3a5a50, flake: '#1d3a34', maxBalls: 2 });
  private dust: Emitter;
  private motes: Emitter;

  // Scratch.
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private sc = new THREE.Vector3();
  private vx = new THREE.Vector3();
  private vy = new THREE.Vector3();
  private vz = new THREE.Vector3();
  private pA = new THREE.Vector3();
  private tA = new THREE.Vector3();
  private nA = new THREE.Vector3();
  private pB = new THREE.Vector3();
  private tB = new THREE.Vector3();
  private nB = new THREE.Vector3();
  private rollA = 0;
  private rollB = 0;

  constructor(settings: BambooLeafGaleSettings = defaultBambooLeafGale()) {
    this.settings = settings;
    this.screen.tint.set(0x3a5a54);
    this.screen.impactColor.set(0xcfeede);
    this.screen.speedLineColor.set(0xcdf5e6);
    this.screen.edgeTint.set(0x7fd8c0);

    // Leaves: tone follows the position in the crescent (outer, leading edge pale; trailing edge deep), a few gold.
    this.leafMesh.frustumCulled = false;
    const col = new THREE.Color();
    for (let i = 0; i < LEAVES; i++) {
      const L = this.leaves[i];
      const k = L.w + 0.5 + (rand(i + 21) - 0.5) * 0.45; // 0 inner/trailing .. 1 outer/leading
      if (rand(i + 22) < 0.07) col.copy(TONE_GOLD);
      else if (k > 0.66) col.copy(TONE_PALE);
      else if (k > 0.32) col.copy(TONE_MID);
      else col.copy(TONE_DEEP);
      col.multiplyScalar(0.9 + rand(i + 23) * 0.12);
      this.leafMesh.setColorAt(i, col);
    }
    if (this.leafMesh.instanceColor) this.leafMesh.instanceColor.needsUpdate = true;

    // Toon bands whirling round the caster (light inner edge, saturated middle, dark outer edge).
    for (let i = 0; i < BANDS; i++) {
      const plane = new THREE.Group();
      plane.rotation.order = 'YXZ';
      const arc = new CrescentArc({
        radius: 1.5 + 0.45 * i, width: 0.5, sweep: Math.PI * 1.3, style: 'toon', edge: 0xcdf5e6, mid: 0x4fb89a, outer: 0x1d3a34,
      });
      plane.add(arc.mesh);
      this.bandRoot.add(plane);
      this.bandPlanes.push(plane);
      this.bands.push(arc);
    }
    this.group.add(this.bandRoot);

    // Streaks: near-straight toon arcs trailing the blade.
    for (let i = 0; i < STREAKS; i++) {
      const root = new THREE.Group();
      const arc = new CrescentArc({
        radius: 14 + i * 2, width: i === 2 ? 0.55 : 0.4, sweep: 0.5, style: 'toon', edge: 0xcdf5e6, mid: 0x4fb89a, outer: 0x1d3a34,
      });
      root.add(arc.mesh);
      this.group.add(root);
      this.streakRoots.push(root);
      this.streaks.push(arc);
    }

    // Smoke crescent: unit-radius soft arc, scaled to the crescent radius when placed.
    this.smokeCres = new CrescentArc({
      radius: 1, width: 0.34, sweep: HS * 2, style: 'soft', edge: 0xcdeee0, mid: 0x9ad4c0, outer: 0x2a6a5a,
    });
    this.smokeCres.mesh.rotation.z = Math.PI / 2 - HS;
    this.smokePlane.add(this.smokeCres.mesh);
    this.group.add(this.smokePlane);

    for (let i = 0; i < GLINTS; i++) {
      const g = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xe8c86a, core: 0xfff0c0 });
      this.glints.push(g);
      this.group.add(g.mesh);
    }

    // Small ground dust while the leaves lift (normal-blended, short).
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 2.4, speedJitter: 0.6, spread: 85, gravity: -0.3, drag: 2.5,
      sizeStart: 0.6, sizeEnd: 1.5, colorStart: '#a8c4b4', colorEnd: '#3a5a50', colorMid: '#6a8a7c',
      opacityStart: 0.3, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.4, groundFade: 0.3,
    });
    // Tiny pale-gold motes trailing the blade and bursting off the cut.
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.35, speed: 5, speedJitter: 0.7, spread: 180, gravity: 1.5, drag: 2,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#fff0b8', colorEnd: '#e8c86a',
      opacityStart: 0.6, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.dust, this.motes, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);

    this.group.add(
      this.leafMesh, this.castRing.mesh, this.ringA.mesh, this.ringB.mesh, this.flash.mesh, this.star.mesh,
      this.slash.mesh, this.smoke.mesh,
    );
    this.applyStyle();
    this.setup(this.feet, new THREE.Vector3(0, 0, 0), Math.PI);
    this.reset();
  }

  applyStyle() {
    this.castRing.material.color.set(this.settings.color);
    this.ringA.material.color.set(this.settings.color);
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  /** Derives every cast-dependent vector from the caster feet, the target feet and the aim yaw. */
  private setup(from: THREE.Vector3, target: THREE.Vector3, aim: number) {
    this.feet.copy(from).setY(0);
    this.tFeet.copy(target).setY(0);
    this.chest.copy(target).setY(1.3);
    this.F.set(Math.sin(aim), 0, Math.cos(aim));
    this.S.set(Math.cos(aim), 0, -Math.sin(aim));
    this.Fp.copy(this.F).multiplyScalar(Math.cos(TILT)).addScaledVector(UP, -Math.sin(TILT)).normalize();
    this.Np.crossVectors(this.Fp, this.S).normalize();
    const dist = Math.hypot(target.x - from.x, target.z - from.z);
    this.hold.copy(this.feet).addScaledVector(this.F, Math.min(2.6, 0.35 * dist)).setY(1.5);
    this.hit.copy(this.chest).addScaledVector(this.F, 0.4);
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.setup(ctx.from, ctx.targetPos[0] ?? ctx.point, ctx.aim);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.chest);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.landed.fill(0);
    this.lv.fill(0);
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
    const t = this.time;
    // Dust plumes at the feet while the leaves lift off.
    if (dt > 0 && t > 0.05 && t < T_FORM - 0.05 && Math.floor(t / 0.12) !== Math.floor((t - dt) / 0.12)) {
      this.dust.burst(16, this.feet.clone().setY(0.15));
    }
    if (!this.impacted && t >= D) this.onImpact();
    if (this.impacted && !this.smokeDone && t >= D + 0.12) this.onSmoke();
    this.layout(dt);
  }

  /** Crescent origin (the tip), radius and leaf scale at time t, before the cut. */
  private crescentFrame(t: number) {
    const pull = 0.35 * smoothstep((t - 0.85) / 0.2);
    const held = this.cO.copy(this.hold).addScaledVector(this.F, -pull);
    if (t < T_GO) {
      this.cR = R0;
      this.cL = 1;
    } else {
      const u = Math.min(1, (t - T_GO) / (D - T_GO));
      const e = Math.pow(u, 1.6);
      held.lerp(this.hit, e);
      this.cR = R0 * (1 + GROW * e);
      this.cL = 1 + 0.9 * e;
    }
  }

  /** Distance the crescent has travelled past the cut `tau` seconds after it. */
  private carry(tau: number) {
    return (FORWARD_SPEED / DRAG) * (1 - Math.exp(-DRAG * Math.max(0, tau)));
  }

  /** Leaf i in the lifting spiral round the caster. */
  private spiral(i: number, t: number, tf: number) {
    const L = this.leaves[i];
    const k = smoothstep((t - L.d) / 0.5);
    const a = L.a + 5.5 * t;
    const r = L.r * (0.85 + 0.55 * k);
    this.pA.set(this.feet.x + Math.cos(a) * r, 0.05 + k * (0.3 + 2.8 * L.h), this.feet.z + Math.sin(a) * r);
    this.tA.set(-Math.sin(a), 0.25 * k, Math.cos(a));
    this.nA.set(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5);
    this.rollA = L.ph + tf * L.f * (0.3 + 0.7 * k);
  }

  /** Leaf i at its slot in the crescent (frame from crescentFrame). */
  private slot(i: number, tf: number) {
    const L = this.leaves[i];
    const R = this.cR;
    const taper = Math.pow(Math.max(0, Math.cos((L.th / HS) * Math.PI * 0.5)), 0.8);
    const wd = R * (0.1 + 0.75 * taper);
    const r = R + L.w * wd;
    const sx = r * Math.sin(L.th);
    const fz = r * Math.cos(L.th) - R;
    const thick = 0.14 * R * L.n * (0.4 + taper);
    this.pB.copy(this.cO).addScaledVector(this.S, sx).addScaledVector(this.Fp, fz).addScaledVector(this.Np, thick);
    this.tB.copy(this.S).multiplyScalar(Math.cos(L.th)).addScaledVector(this.Fp, -Math.sin(L.th));
    this.nB.copy(this.Np);
    this.rollB = L.roll * 0.45 + 0.3 * Math.sin(tf * L.f * 0.6 + L.ph);
  }

  /** Writes leaf i's matrix from a position, a long-axis direction, a normal hint, a roll about the axis and a size. */
  private setLeaf(i: number, p: THREE.Vector3, T: THREE.Vector3, N: THREE.Vector3, roll: number, size: number) {
    const X = this.vx.copy(T);
    if (X.lengthSq() < 1e-8) X.set(1, 0, 0);
    X.normalize();
    const Z = this.vz.copy(N);
    Z.addScaledVector(X, -Z.dot(X));
    if (Z.lengthSq() < 1e-6) {
      Z.set(Math.abs(X.y) < 0.9 ? 0 : 1, Math.abs(X.y) < 0.9 ? 1 : 0, 0);
      Z.addScaledVector(X, -Z.dot(X));
    }
    Z.normalize();
    const Y = this.vy.crossVectors(Z, X);
    const c = Math.cos(roll), s = Math.sin(roll);
    const Zr = Z.multiplyScalar(c).addScaledVector(Y, s);
    const Yr = Y.crossVectors(Zr, X);
    this.m4.makeBasis(X, Yr, Zr);
    this.q.setFromRotationMatrix(this.m4);
    this.m4.compose(p, this.q, this.sc.setScalar(Math.max(1e-4, size)));
    this.leafMesh.setMatrixAt(i, this.m4);
    this.lp[i * 3] = p.x;
    this.lp[i * 3 + 1] = p.y;
    this.lp[i * 3 + 2] = p.z;
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const fade = 1 - smoothstep((t - (DURATION - 0.6)) / 0.6);
    const leafFade = 1 - smoothstep((t - (D + 1.4)) / 0.9);
    // Flutter clock freezes through the dead beat.
    const tf = t - (Math.min(Math.max(t, T_HOLD), T_GO) - T_HOLD);
    let shake = 0;

    // --- Grade: a light grade from the start, released after the cut. ---
    this.screen.darken = (t < D + 0.05 ? 0.4 * smoothstep(t / 0.3) : 0.4 * (1 - smoothstep((t - D - 0.1) / 0.5)));
    const flight = smoothstep((t - T_GO) / (D - T_GO));
    this.screen.speedLines = t >= T_GO && t < D + 0.12 ? 0.5 * flight : 0;
    this.screen.focus.copy(this.chest);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = 0.45 * chromaPulse(t, D, 1, 12);

    // --- Crescent frame for this time. ---
    if (!this.impacted) this.crescentFrame(t);
    const O = this.cO;
    const R = this.cR;

    // --- Leaves. ---
    const P = this.pA;
    for (let i = 0; i < LEAVES; i++) {
      const L = this.leaves[i];
      const ap = smoothstep((t - L.s * 0.12) / 0.1);
      if (!this.impacted) {
        const m = t < T_FORM ? 0 : smoothstep((t - T_FORM - 0.12 * L.s) / 0.23);
        if (m < 1) this.spiral(i, t, tf);
        if (m > 0) this.slot(i, tf);
        let roll: number;
        if (m <= 0) {
          roll = this.rollA;
        } else if (m >= 1) {
          P.copy(this.pB); this.tA.copy(this.tB); this.nA.copy(this.nB);
          roll = this.rollB;
        } else {
          P.lerp(this.pB, m);
          this.tA.lerp(this.tB, m);
          this.nA.lerp(this.nB, m);
          roll = this.rollA + (this.rollB - this.rollA) * m;
        }
        this.setLeaf(i, P, this.tA, this.nA, roll, L.len * this.cL * ap);
      } else {
        // After the cut: carry on through the enemy, drag, flutter down at a slow terminal speed, lie on the ground.
        const o = i * 3;
        if (dt > 0 && !this.landed[i]) {
          const k = Math.exp(-DRAG * dt);
          this.lv[o] *= k;
          this.lv[o + 2] *= k;
          this.lv[o + 1] += (-1.4 - this.lv[o + 1]) * (1 - Math.exp(-2.5 * dt));
          const sway = Math.sin(tf * L.f * 0.7 + L.ph) * 0.9 * dt;
          this.lp[o] += this.lv[o] * dt + this.S.x * sway;
          this.lp[o + 1] += this.lv[o + 1] * dt;
          this.lp[o + 2] += this.lv[o + 2] * dt + this.S.z * sway;
          if (this.lp[o + 1] <= 0.04) {
            this.lp[o + 1] = 0.04;
            this.landed[i] = 1;
          }
        }
        P.set(this.lp[o], this.lp[o + 1], this.lp[o + 2]);
        const size = L.len * this.cL * leafFade;
        if (this.landed[i]) {
          this.tA.set(Math.cos(L.yaw), 0, Math.sin(L.yaw));
          this.nA.set(0, 1, 0);
          this.setLeaf(i, P, this.tA, this.nA, 0, size);
        } else {
          this.tA.set(this.lv[o], this.lv[o + 1] * 0.3, this.lv[o + 2]);
          if (this.tA.lengthSq() < 0.25) this.tA.set(Math.cos(L.yaw), 0, Math.sin(L.yaw));
          this.nA.set(Math.sin(tf * L.f + L.ph) * 0.4, 1, Math.cos(tf * L.f + L.ph) * 0.4);
          this.setLeaf(i, P, this.tA, this.nA, L.ph + tf * L.f * 0.8, size);
        }
      }
    }
    this.leafMesh.instanceMatrix.needsUpdate = true;

    // --- Anticipation: toon bands round the caster, a cast ring at the feet. ---
    const bandPos = new THREE.Vector3(this.feet.x, 1.3, this.feet.z).lerp(this.hold, smoothstep((t - T_FORM) / 0.3));
    this.bandRoot.position.copy(bandPos);
    this.bandRoot.scale.setScalar(Math.max(1e-3, 1 - 0.3 * smoothstep((t - T_FORM) / 0.3)));
    this.bands.forEach((arc, i) => {
      const plane = this.bandPlanes[i];
      plane.rotation.set(Math.PI / 2 + (i - 1) * 0.4, tf * (3 + i) + i * 2.1, 0);
      arc.head = ((tf * 1.8 + i * 0.35) % 1.3) + 0.15;
      arc.length = 0.5;
      arc.time = t;
      arc.erosion = smoothstep((t - T_FORM) / 0.35);
      arc.opacity = t < T_FORM + 0.4 ? 0.9 * smoothstep(t / 0.15) : 0;
    });
    const ringT = smoothstep(t / 0.4);
    this.castRing.mesh.position.set(this.feet.x, 0.05, this.feet.z);
    this.castRing.mesh.scale.setScalar(0.8 + 1.4 * easeOut(t / 0.6));
    this.castRing.material.opacity = t < T_GO ? 0.4 * ringT * (1 - smoothstep((t - T_FORM) / 0.4)) : 0;

    // --- Streaks trailing the blade, then eroding. ---
    const stOn = t >= T_GO && t < D + 0.35;
    const stTh = [HS, -HS, 0.3];
    const dirX = new THREE.Vector3();
    const dirZ = new THREE.Vector3();
    const base = new THREE.Vector3();
    this.streaks.forEach((arc, i) => {
      const root = this.streakRoots[i];
      const rad = 14 + i * 2;
      const chord = rad * Math.sin(0.5);
      const th = stTh[i];
      const end = base.copy(O).addScaledVector(this.S, R * Math.sin(th)).addScaledVector(this.Fp, R * Math.cos(th) - R);
      if (this.impacted) end.addScaledVector(this.F, this.carry(after));
      const rho = [0.4, -0.4, 1.3][i];
      dirX.copy(this.S).multiplyScalar(Math.cos(rho)).addScaledVector(UP, Math.sin(rho));
      dirZ.crossVectors(dirX, this.F);
      this.m4.makeBasis(dirX, this.F, dirZ);
      root.quaternion.setFromRotationMatrix(this.m4);
      root.position.copy(end).addScaledVector(this.F, -chord).addScaledVector(dirX, -rad);
      arc.head = 1.15;
      arc.length = 0.9;
      arc.time = t;
      arc.erosion = smoothstep((t - D) / 0.3);
      arc.opacity = stOn ? 0.9 * smoothstep((t - T_GO) / 0.05) : 0;
    });

    // --- Smoke crescent: lingers for 0.4 s in the crescent's plane after the cut. ---
    const smokeAge = after;
    const smokeOn = smokeAge >= 0 && smokeAge < 0.5;
    if (smokeOn) {
      const c = base.copy(this.hit).addScaledVector(this.F, this.carry(smokeAge));
      const rs = R0 * (1 + GROW) * (1 + 0.15 * smokeAge);
      this.m4.makeBasis(this.S, this.Fp, this.Np);
      this.smokePlane.quaternion.setFromRotationMatrix(this.m4);
      this.smokePlane.position.copy(c).addScaledVector(this.Fp, -rs);
      this.smokePlane.scale.setScalar(rs);
    }
    this.smokeCres.head = 1.0;
    this.smokeCres.length = 1.0;
    this.smokeCres.time = t;
    this.smokeCres.erosion = smoothstep(smokeAge / 0.5);
    this.smokeCres.opacity = smokeOn ? 0.5 * (1 - smoothstep((smokeAge - 0.1) / 0.4)) : 0;

    // --- Flight: pale motes shed from the tip. ---
    if (!this.impacted && t >= T_GO && dt > 0) {
      this.motes.burst(5, this.cO);
      shake = Math.max(shake, 0.05);
    }

    // --- Cut: slash line, flash, star, rings, glints. ---
    const sl = this.slash;
    const slashAge = after;
    if (slashAge >= 0 && slashAge < 0.4) {
      const grow = easeOut(slashAge / 0.07);
      const thin = 1 - smoothstep((slashAge - 0.12) / 0.25);
      sl.set(this.chest, 4.4 * grow, 0.55 * thin, 1, 0.22);
    } else {
      sl.set(this.chest, 0, 0, 0, 0);
    }
    this.flash.mesh.position.copy(this.chest);
    this.flash.mesh.scale.setScalar(1.2 + Math.max(0, after) * 5);
    this.flash.opacity = after >= 0 ? 0.5 * Math.exp(-after * 16) : 0;
    const pop = StarBurst.pop(after - 0.02, 0.09, 0.16);
    this.star.set(this.chest, 3.2 * pop.scale, pop.opacity, 0.3);
    this.glints.forEach((g, i) => {
      const age = after - 0.06 - i * 0.05;
      const p = StarBurst.pop(age, 0.04, 0.12);
      if (p.opacity === 0) { g.set(new THREE.Vector3(), 0, 0); return; }
      const a = i * 2.2 + 0.7;
      g.set(
        new THREE.Vector3(this.chest.x + this.S.x * Math.cos(a) * 2.2, this.chest.y + 0.6 + Math.sin(a) * 1.0, this.chest.z + this.S.z * Math.cos(a) * 2.2),
        0.8 * p.scale, p.opacity, a,
      );
    });
    const tf0 = this.tFeet;
    const ra = after / 0.5;
    this.ringA.mesh.position.set(tf0.x, 0.06, tf0.z);
    this.ringA.mesh.scale.setScalar(0.8 + 3.2 * easeOut(ra));
    this.ringA.material.opacity = after >= 0 ? Math.max(0, 0.75 * (1 - ra)) * fade : 0;
    const rb = (after - 0.08) / 0.55;
    this.ringB.mesh.position.set(tf0.x, 0.07, tf0.z);
    this.ringB.mesh.scale.setScalar(0.8 + 3.2 * easeOut(rb));
    this.ringB.material.opacity = rb >= 0 && rb <= 1 ? 0.6 * (1 - rb) * fade : 0;

    if (after >= 0) shake = Math.max(shake, 0.6 * Math.exp(-after * 7));
    this.shake = shake;
  }

  private onImpact() {
    this.impacted = true;
    // Burst: out from the cut point, on through the enemy, a little up.
    const c = this.chest;
    for (let i = 0; i < LEAVES; i++) {
      const o = i * 3;
      const rx = this.lp[o] - c.x, ry = (this.lp[o + 1] - c.y) * 0.5, rz = this.lp[o + 2] - c.z;
      const len = Math.hypot(rx, ry, rz);
      const k = len > 1e-3 ? (2.5 + rand(i + 31) * 5.5) * 0.8 / len : 0;
      const fw = FORWARD_SPEED * (0.7 + 0.5 * rand(i + 32));
      this.lv[o] = rx * k + this.F.x * fw;
      this.lv[o + 1] = ry * k + 1.5 + rand(i + 33) * 2;
      this.lv[o + 2] = rz * k + this.F.z * fw;
    }
    this.motes.burst(90, c);
    const ctx = this.ctx;
    if (ctx) {
      ctx.targets.forEach((e, i) => ctx.hit(e, {
        damage: i === 0 ? this.settings.damage : 15, knock: 7, from: ctx.from, color: '#d8ffe8',
      }));
    }
  }

  private onSmoke() {
    this.smokeDone = true;
    this.smoke.trigger(this.tFeet.clone().setY(0.9), 0.9, 0.8);
  }
}

export const bambooLeafGaleModule: EffectModule = {
  label: 'bamboo leaf gale',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new BambooLeafGale(),
  telegraphs(effect) {
    const e = effect as BambooLeafGale;
    const ctx = e.ctx;
    const t = ctx?.targetPos[0] ?? ctx?.point;
    if (!ctx || !t) return [];
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: t.x, z2: t.z, width: 4.5 }, start: T_FORM, impact: D,
    }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as BambooLeafGale;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const g = effect as BambooLeafGale;
    const s = g.settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.addColor(s, 'color').onChange(() => g.applyStyle());
  },
};
