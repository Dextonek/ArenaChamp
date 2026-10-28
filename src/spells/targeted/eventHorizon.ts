import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  ShockRefraction, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import type { Enemy } from '../../effects/common';

/**
 * Event Horizon (hero tier, targeted ground, radius 6): a real black hole. A pure-black sphere hangs over the aim
 * point, a thin photon ring hugs it and a drawn, tilted accretion disk (spiral gas arms with black lines between
 * the bands, a cool doppler side) spins faster and faster. The hero is a permanent gravitational lens: a strong
 * camera-facing refraction ring around the hole bends the floor and the enemies, while ground ripples run inward.
 * Enemies inside the radius are dragged in and stretched toward the hole, everything freezes for a dead beat, then
 * the hole collapses into a toon gas shell, impact frames and a huge refraction wave.
 *
 * Design: pipeline/designs/event-horizon.md. Recipe: c-gnomon-charged-energy-beam (escalation in stages).
 */
export interface EventHorizonSettings {
  damage: number;
  loop: boolean;
}

export const defaultEventHorizon = (): EventHorizonSettings => ({ damage: 70, loop: false });

// Timeline (seconds).
const SEED_END = 0.8; // the mote lands, the hole opens (birth 0.8-1.6)
const BIRTH_END = 1.6;
const PULL_END = 4.6; // dead beat 4.6-5.0
const COLLAPSE = 5.0;
const DURATION = 7.0;
const TICKS = [2.2, 3.2, 4.2];

const HOLE_R = 1.1;
const HOLE_Y = 2.6; // hole centre height above the aim point
const DISK_R = 3.5;
const PULL_RADIUS = 6;

const PHOTON = 0xffe6b0;
const ACCRETION = 0xff9a3a;
const SPACE = 0x06040c;

const DEBRIS = 38;
const PEBBLES = 30;
const STREAKS = 18;
const STREAK_SEGS = 10;

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const frac = (x: number) => x - Math.floor(x);
const lerp = THREE.MathUtils.lerp;
const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);

function billboard(mesh: THREE.Object3D) {
  mesh.onBeforeRender = (_r, _s, camera) => {
    mesh.quaternion.copy(camera.quaternion);
  };
}

/** Accretion disk ring texture (inner 0.35, outer 1): spiral gas arms, black lines between bands. */
function diskTexture(seed: number, arms: number, mode: 'gas' | 'doppler'): THREE.CanvasTexture {
  const S = 512, C = S / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const hash = (x: number, y: number) => frac(Math.sin(x * 127.1 + y * 311.7 + seed * 17.3) * 43758.5453);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - C) / C, dy = (y + 0.5 - C) / C;
      const r = Math.hypot(dx, dy);
      const i = (y * S + x) * 4;
      if (r < 0.35 || r > 1) continue;
      const rn = (r - 0.35) / 0.65;
      const a = Math.atan2(dy, dx);
      const side = Math.cos(a); // +x bright (approaching), -x receding (cool)
      let R = 0, G = 0, B = 0, A = 0;
      // Black outlines on both rims.
      const rim = rn < 0.025 || rn > 0.965;
      if (mode === 'gas') {
        const q = (a / (Math.PI * 2)) * arms + Math.log(1 + rn * 7) * 3.2 + seed * 0.37;
        const wob = (hash(Math.floor(a * 40), Math.floor(rn * 30)) - 0.5) * 0.12;
        const v = 0.5 + 0.5 * Math.cos((q + wob) * Math.PI * 2);
        if (rim || v < 0.16) {
          R = G = B = 0; A = 255; // thin black line between the bands
        } else if (v < 0.36) {
          R = 38; G = 16; B = 8; A = 235; // dark gap
        } else {
          const heat = clamp01((v - 0.36) / 0.64) * (1 - rn * 0.55);
          // value ramp: deep orange -> accretion orange -> pale hot (kept under the bloom threshold)
          const hot = clamp01(heat * 1.15);
          R = lerp(150, 238, hot); G = lerp(60, 168, hot); B = lerp(18, 84, hot);
          const grain = 0.88 + hash(x * 0.5, y * 0.5) * 0.12;
          const beam = 0.78 + 0.22 * side;
          R *= grain * beam; G *= grain * beam; B *= grain * beam;
          A = 255;
        }
        const outer = 1 - smoothstep((rn - 0.8) / 0.2);
        if (!rim) A *= 0.25 + 0.75 * outer;
      } else {
        // Static overlay: cool receding edge (blue), nothing on the bright side.
        const w = clamp01((0.15 - side) / 1.15) * (0.4 + 0.6 * rn) * (1 - smoothstep((rn - 0.85) / 0.15));
        const a = 0.34 * w * w;
        R = 106 * a; G = 184 * a; B = 255 * a;
        A = 255;
      }
      d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = A;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Scorched ground decal with a spiral scar. */
function scarTexture(): THREE.CanvasTexture {
  const S = 512, C = S / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(C, C, 0, C, C, C);
  grad.addColorStop(0, 'rgba(6,4,12,0.95)');
  grad.addColorStop(0.55, 'rgba(10,6,12,0.85)');
  grad.addColorStop(0.9, 'rgba(10,6,12,0.35)');
  grad.addColorStop(1, 'rgba(10,6,12,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(C, C, C, 0, Math.PI * 2);
  g.fill();
  // spiral scar: three arms, dark thick line with a thin ember core
  for (let arm = 0; arm < 3; arm++) {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 60; k++) {
      const s = k / 60;
      const rr = (0.08 + 0.85 * s) * C;
      const aa = arm * ((Math.PI * 2) / 3) + s * 4.2;
      pts.push([C + Math.cos(aa) * rr, C + Math.sin(aa) * rr]);
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.9)';
    g.lineWidth = 11;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.strokeStyle = 'rgba(150,60,20,0.55)';
    g.lineWidth = 2.5;
    g.beginPath();
    pts.slice(0, 40).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Pulled {
  enemy: Enemy;
  baseRot: number;
  baseScale: THREE.Vector3;
}

export class EventHorizon implements Effect {
  readonly group = new THREE.Group();
  readonly settings: EventHorizonSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first cast. */
  ctx: CastContext | null = null;
  private time = 0;
  private tickIdx = 0;
  private collapsed = false;
  private pulled: Pulled[] = [];
  private P = new THREE.Vector3(); // aim point on the ground
  private C = new THREE.Vector3(); // hole centre
  private toCaster = new THREE.Vector3(0, 0, 1);
  private hand = new THREE.Vector3();
  private lastLap: number[] = new Array(DEBRIS).fill(-1);

  // The hole and its rings.
  private holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  private hole = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), this.holeMat);
  private photonMat = new THREE.MeshBasicMaterial({
    color: 0xe6c88e, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  private photon = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.13, 96), this.photonMat);
  private photonLine = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.045, 96),
    new THREE.MeshBasicMaterial({ color: 0xf2dca8, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide }),
  );
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xe0a050, core: PHOTON, additive: false });

  // Disk.
  private diskRoot = new THREE.Group();
  private tiltG = new THREE.Group();
  private pivot = new THREE.Group();
  private layerA: THREE.Mesh;
  private layerB: THREE.Mesh;
  private dopp: THREE.Mesh;
  private shellBlack: THREE.Mesh;
  private shellOrange: THREE.Mesh;
  private debris: THREE.InstancedMesh;
  private debrisSeed: { a: number; T: number; off: number; r0: number; s: number; y: number; spin: number }[] = [];

  // Seed.
  private mote = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  private moteRing = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.27, 40),
    new THREE.MeshBasicMaterial({ color: 0xe08a34, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  private streaks: THREE.LineSegments;
  private streakSeed: { a: number; elev: number; r0: number; swirl: number }[] = [];
  private streakMat = new THREE.LineBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0, depthWrite: false });

  // Ground.
  private pebbles: THREE.InstancedMesh;
  private pebSeed: { a: number; r0: number; T: number; off: number; s: number }[] = [];
  private scarMat = new THREE.MeshBasicMaterial({
    map: scarTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  private scar = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.scarMat);
  private groundRing = createRing(ACCRETION, 0.94, 1, 64);

  // Distortion.
  private lens = new ShockRefraction({ facing: 'camera', width: 0.5 });
  private lensResidual = new ShockRefraction({ facing: 'camera', width: 0.5 });
  private ripples = [0, 1, 2].map(() => new ShockRefraction({ facing: 'ground', width: 0.3 }));
  private collapseRing = new ShockRefraction({ facing: 'camera', width: 0.3 });
  private collapseGround = new ShockRefraction({ facing: 'ground', width: 0.3 });

  private star = new StarBurst({ points: 12, color: ACCRETION, core: PHOTON, additive: false });

  private sparks: Emitter;
  private embers: Emitter;
  private dust: Emitter;

  constructor(settings: EventHorizonSettings = defaultEventHorizon()) {
    this.settings = settings;
    this.screen.tint.set(SPACE);
    this.screen.impactColor.set(0xfff0d8);
    this.screen.speedLineColor.set(PHOTON);
    this.screen.edgeTint.set(0x3a1a08);
    this.screen.keepHue.set(ACCRETION);

    // --- Hole + photon ring (camera-facing). ---
    billboard(this.photon);
    billboard(this.photonLine);
    billboard(this.moteRing);
    this.photon.renderOrder = 6;
    this.photonLine.renderOrder = 7;
    this.group.add(this.hole, this.photon, this.photonLine, this.glint.mesh, this.mote, this.moteRing);

    // --- Disk chain: diskRoot (at hole) > tiltG (leans toward the caster) > pivot (XY ring -> XZ plane). ---
    this.pivot.rotation.x = -Math.PI / 2;
    const ringGeo = new THREE.RingGeometry(0.35, 1, 96, 1);
    const mk = (tex: THREE.Texture, order: number) => {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }));
      m.renderOrder = order;
      return m;
    };
    this.layerA = mk(diskTexture(1, 12, 'gas'), 2);
    this.layerB = mk(diskTexture(2, 9, 'gas'), 3);
    this.layerB.position.z = 0.04;
    (this.layerB.material as THREE.MeshBasicMaterial).opacity = 0.7;
    this.dopp = mk(diskTexture(3, 6, 'doppler'), 4);
    (this.dopp.material as THREE.MeshBasicMaterial).blending = THREE.AdditiveBlending;
    this.dopp.position.z = 0.08;
    this.pivot.add(this.layerA, this.layerB, this.dopp);

    // Collapse shell (toon: black ring under an orange ring) on the disk plane.
    const shellMat = (c: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.shellBlack = new THREE.Mesh(new THREE.RingGeometry(0.55, 1, 72), shellMat(0x000000));
    this.shellOrange = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 72), shellMat(0xe8862c));
    this.shellBlack.renderOrder = 8;
    this.shellOrange.renderOrder = 9;
    this.shellOrange.position.z = 0.02;
    this.pivot.add(this.shellBlack, this.shellOrange);
    this.tiltG.add(this.pivot);

    // Debris: small dark drawn rock shards spiralling in along the disk plane.
    const shard = new THREE.TetrahedronGeometry(0.13).scale(1.2, 0.8, 1);
    const debMat = new THREE.MeshStandardMaterial({ color: 0x2c2622, roughness: 0.95, flatShading: true, emissive: 0x1a0a04, emissiveIntensity: 0.7 });
    this.debris = new THREE.InstancedMesh(shard, debMat, DEBRIS);
    this.debris.frustumCulled = false;
    const rnd = lcg(7);
    for (let i = 0; i < DEBRIS; i++) {
      this.debrisSeed.push({
        a: rnd() * Math.PI * 2, T: 1.5 + rnd() * 1.1, off: rnd() * 3, r0: 6 + rnd() * 1.6,
        s: 0.6 + rnd() * 0.7, y: (rnd() - 0.5) * 0.3, spin: 2 + rnd() * 4,
      });
    }
    this.tiltG.add(this.debris);
    this.diskRoot.add(this.tiltG);
    this.group.add(this.diskRoot);

    // --- Seed streaks (thin bent lines pulled toward the point). ---
    const sr = lcg(31);
    for (let i = 0; i < STREAKS; i++) {
      this.streakSeed.push({ a: sr() * Math.PI * 2, elev: (sr() - 0.4) * 3.2, r0: 4.5 + sr() * 4, swirl: 1.2 + sr() * 1.4 });
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * STREAK_SEGS * 2 * 3), 3));
    this.streaks = new THREE.LineSegments(sg, this.streakMat);
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);

    // --- Ground: pebbles creeping in, scar decal, collapse ring. ---
    this.pebbles = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.14),
      new THREE.MeshStandardMaterial({ color: 0x3a322c, roughness: 0.95, flatShading: true }), PEBBLES,
    );
    this.pebbles.frustumCulled = false;
    const pr = lcg(19);
    for (let i = 0; i < PEBBLES; i++) {
      this.pebSeed.push({ a: pr() * Math.PI * 2, r0: 2.5 + pr() * 4, T: 1.6 + pr() * 1.4, off: pr() * 3, s: 0.7 + pr() * 1.0 });
    }
    this.scar.rotation.x = -Math.PI / 2;
    this.scar.renderOrder = 1;
    this.groundRing.mesh.renderOrder = 4;
    this.group.add(this.pebbles, this.scar, this.groundRing.mesh, this.star.mesh);

    // --- Distortion meshes. ---
    this.group.add(
      this.lens.mesh, this.lensResidual.mesh, this.collapseRing.mesh, this.collapseGround.mesh,
      ...this.ripples.map((r) => r.mesh),
    );

    // --- Particles. ---
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.45, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.1, speed: 3, speedJitter: 0.6, spread: 180, gravity: 2, drag: 1.5,
      sizeStart: 0.08, sizeEnd: 0.01, colorStart: '#ffb050', colorEnd: '#c04a10',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0, colorMid: '#ff9a3a',
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 2.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 1.2, speed: 4, speedJitter: 0.7, spread: 180, gravity: -0.5, drag: 1.4,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#9ad0ff', colorEnd: '#1a2a5a',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0, colorMid: '#6ab8ff',
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 200, rate: 0, lifetime: 1.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 4, speedJitter: 0.6, spread: 80, gravity: 0, drag: 2,
      sizeStart: 0.4, sizeEnd: 1.0, colorStart: '#2a2430', colorEnd: '#0a0810',
      opacityStart: 0.3, opacityEnd: 0, additive: false, colorMid: '#1a1620', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.emitters.push(this.sparks, this.embers, this.dust);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SEED_END;
  }

  cast(ctx: CastContext) {
    this.restoreEnemies();
    this.ctx = ctx;
    this.P.copy(ctx.point).setY(0);
    this.C.copy(this.P).setY(HOLE_Y);
    this.hand.copy(ctx.from).setY(2.3);
    const yaw = Number.isFinite(ctx.aim) ? ctx.aim : Math.PI;
    this.toCaster.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    // The disk leans toward the caster (and a little toward the side camera) so it reads as a disk, not a line.
    const lean = this.toCaster.clone().add(new THREE.Vector3(1, 0, 0)).normalize();
    const tilt = 0.35; // ~20 deg from horizontal
    const n = new THREE.Vector3(0, Math.cos(tilt), 0).addScaledVector(lean, Math.sin(tilt)).normalize();
    this.tiltG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    this.pulled = ctx.targets.map((e) => ({ enemy: e, baseRot: e.group.rotation.y, baseScale: e.group.scale.clone() }));
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private restoreEnemies() {
    for (const p of this.pulled) {
      p.enemy.group.scale.setScalar(1);
      p.enemy.group.rotation.y = p.baseRot;
    }
  }

  private reset() {
    this.restoreEnemies();
    this.time = 0;
    this.tickIdx = 0;
    this.collapsed = false;
    this.shake = 0;
    this.lastLap.fill(-1);
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    // Zero every distortion strength.
    const zero = new THREE.Vector3(0, -50, 0);
    for (const s of [this.lens, this.lensResidual, this.collapseRing, this.collapseGround, ...this.ripples]) s.set(zero, 1, 0);
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.time = DURATION;
      this.playing = false;
    }
    while (this.tickIdx < TICKS.length && this.time >= TICKS[this.tickIdx]) this.onTick();
    if (!this.collapsed && this.time >= COLLAPSE) this.onCollapse();
    this.layout(dt);
    if (!this.playing) {
      clearScreenFx(this.screen);
      this.restoreEnemies();
    }
  }

  private onTick() {
    this.tickIdx++;
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) ctx.hit(e, { damage: 10, knock: 0, from: this.P });
    this.shake = Math.max(this.shake, 0.18);
  }

  private onCollapse() {
    this.collapsed = true;
    const c = this.C;
    this.sparks.burst(160, c);
    this.embers.burst(140, new THREE.Vector3(c.x, 0.6, c.z));
    this.dust.burst(40, new THREE.Vector3(c.x, 0.3, c.z));
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 10, from: this.P });
  }

  /** Hole radius over time: opens with overshoot, breathes, collapses to a point at COLLAPSE. */
  private holeRadius(t: number) {
    if (t < SEED_END) return 0;
    if (t < BIRTH_END) {
      const p = (t - SEED_END) / (BIRTH_END - SEED_END);
      const c1 = 1.9, c3 = c1 + 1;
      const e = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      return HOLE_R * e;
    }
    if (t < COLLAPSE) return HOLE_R * (1 + 0.02 * Math.sin(Math.min(t, PULL_END) * 9));
    return HOLE_R * (1 - smoothstep((t - COLLAPSE) / 0.12));
  }

  private layout(dt: number) {
    const t = this.time;
    const te = Math.min(t, PULL_END); // the world freezes at the dead beat
    const C = this.C, P = this.P;
    const tmp = new THREE.Vector3();
    const tmp2 = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const e0 = new THREE.Euler();
    const after = t - COLLAPSE;
    const rh = this.holeRadius(t);
    const alive = t >= SEED_END && t < COLLAPSE + 0.12;
    const pull = clamp01((te - BIRTH_END) / (PULL_END - BIRTH_END));

    // --- Screen: world darkens and drains toward the hole, releases after the collapse. ---
    const grade = t < COLLAPSE ? smoothstep((t - 1.0) / 3.6) : Math.exp(-Math.max(0, after) * 3);
    this.screen.darken = 0.25 * grade;
    this.screen.desaturate = 0.4 * grade;
    this.screen.focus.copy(C);
    this.screen.impact = impactFrameAt(t, COLLAPSE, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, COLLAPSE, 0.8, 10);
    this.screen.speedLines = t >= 3.9 && t < PULL_END ? 0.25 * smoothstep((t - 3.9) / 0.6) : 0;

    if (this.ctx) this.screen.silhouettes = [this.ctx.caster.group, ...this.ctx.targets.map((e) => e.group)];
    // Nothing of the hole may linger once it has collapsed.
    const gone = t >= COLLAPSE + 0.15;
    this.debris.visible = this.pebbles.visible = !gone;

    // --- Seed mote: drops from the caster's raised hand to the point. ---
    const sp = clamp01(t / SEED_END);
    const moteOn = t < SEED_END + 0.05;
    tmp.set(
      lerp(this.hand.x, C.x, sp), lerp(this.hand.y, C.y, sp * sp) + Math.sin(sp * Math.PI) * 1.3, lerp(this.hand.z, C.z, sp),
    );
    this.mote.visible = moteOn && t > 0 && t < SEED_END + 0.05;
    this.mote.position.copy(tmp);
    this.moteRing.visible = this.mote.visible;
    this.moteRing.position.copy(tmp);
    const moteS = 1 + 0.6 * sp;
    this.mote.scale.setScalar(moteS);
    this.moteRing.scale.setScalar(moteS);

    // --- Hole, photon ring, glint. ---
    this.hole.visible = alive && rh > 1e-3;
    this.hole.position.copy(C);
    this.hole.scale.setScalar(Math.max(rh, 1e-4));
    const ringOn = alive && t >= SEED_END + 0.12;
    const snap = t < SEED_END + 0.12 ? 0 : 1 + 0.5 * Math.exp(-(t - SEED_END - 0.12) * 14);
    this.photon.visible = ringOn;
    this.photonLine.visible = ringOn;
    for (const r of [this.photon, this.photonLine]) {
      r.position.copy(C);
      r.scale.setScalar(Math.max(rh * 1.02, 1e-4) * (1 + 0.04 * (snap - 1)));
    }
    this.photonMat.opacity = 0.9;
    const gp = StarBurst.pop(frac(t * 0.85) * 1.17 - 0.1, 0.05, 0.2);
    tmp.set(C.x + 0.2, C.y + rh * 0.78, C.z - rh * 0.62);
    this.glint.set(tmp, ringOn ? 0.55 * gp.scale : 0, ringOn && t < COLLAPSE ? gp.opacity : 0, t * 1.5);

    // --- Disk: unfolds from a thin ring, spins faster as the pull builds, freezes at the dead beat. ---
    const unfold = smoothstep((t - SEED_END) / (BIRTH_END - SEED_END));
    const dScale = t < COLLAPSE ? lerp(0.25, 1, unfold) : Math.max(1e-3, 1 - smoothstep(after / 0.1));
    this.diskRoot.visible = t >= SEED_END && t < COLLAPSE + 0.1;
    this.diskRoot.position.copy(C);
    const tt = Math.max(0, te - SEED_END);
    const spin = 4.5 * tt + 1.4 * tt * tt;
    this.layerA.rotation.z = -spin;
    this.layerB.rotation.z = -spin * 1.38 + 1.1;
    this.layerA.scale.setScalar(DISK_R * dScale);
    this.layerB.scale.setScalar(DISK_R * 0.82 * dScale);
    this.dopp.scale.setScalar(DISK_R * dScale);
    const diskFade = clamp01((t - SEED_END) / 0.3);
    (this.layerA.material as THREE.MeshBasicMaterial).opacity = diskFade;
    (this.layerB.material as THREE.MeshBasicMaterial).opacity = 0.7 * diskFade;
    (this.dopp.material as THREE.MeshBasicMaterial).opacity = diskFade;

    // Collapse shell: toon ring flung out on the disk plane.
    const sp2 = clamp01(after / 0.45);
    const se = 1 - Math.pow(1 - sp2, 3);
    const shellOn = after > 0 && after < 0.45;
    this.shellBlack.visible = this.shellOrange.visible = shellOn;
    this.shellBlack.scale.setScalar(1 + 8 * se);
    this.shellOrange.scale.setScalar(1 + 8 * se);
    (this.shellBlack.material as THREE.MeshBasicMaterial).opacity = shellOn ? 0.95 * (1 - sp2 * sp2) : 0;
    (this.shellOrange.material as THREE.MeshBasicMaterial).opacity = shellOn ? 0.95 * (1 - sp2 * sp2) : 0;

    // --- Debris spiralling in along the disk plane; vanishes at the photon ring with a tiny spark. ---
    for (let i = 0; i < DEBRIS; i++) {
      const s = this.debrisSeed[i];
      const on = te > 1.3 && t < COLLAPSE;
      const tau = Math.max(0, te - 1.3) * (1 + 0.5 * pull) + s.off;
      const lap = Math.floor(tau / s.T);
      const f = frac(tau / s.T);
      const r = lerp(s.r0, HOLE_R * 1.1, Math.pow(f, 1.5));
      const ang = s.a + lap * 2.1 + 5.2 * Math.pow(f, 0.7);
      const size = on ? s.s * (1 - smoothstep((f - 0.88) / 0.12)) * smoothstep((f) / 0.08) : 0;
      m.compose(
        tmp.set(Math.cos(ang) * r, s.y * (1 - f), Math.sin(ang) * r),
        q.setFromEuler(e0.set(tau * s.spin, tau * s.spin * 0.7, tau)),
        sc.setScalar(Math.max(size, 1e-4)),
      );
      this.debris.setMatrixAt(i, m);
      if (dt > 0 && on && lap !== this.lastLap[i]) {
        if (this.lastLap[i] >= 0) {
          // Spark where the previous lap ended: the photon ring end of the old path.
          const pa = s.a + (lap - 1) * 2.1 + 5.2;
          tmp2.set(Math.cos(pa) * HOLE_R * 1.1, 0, Math.sin(pa) * HOLE_R * 1.1);
          this.tiltG.localToWorld(tmp2);
          this.sparks.burst(4, tmp2);
        }
        this.lastLap[i] = lap;
      }
    }
    this.debris.instanceMatrix.needsUpdate = true;

    // --- Ground pebbles creep toward the hole and lift into it. ---
    for (let i = 0; i < PEBBLES; i++) {
      const s = this.pebSeed[i];
      const on = te > 0.9 && t < COLLAPSE;
      const tau = Math.max(0, te - 0.9) * (1 + 0.6 * pull) + s.off;
      const f = frac(tau / s.T);
      const r = s.r0 * Math.pow(1 - f, 1.2) + 0.2;
      const y = 0.1 + Math.max(0, 1 - r / 2.2) * (HOLE_Y - 0.1);
      const size = on ? s.s * (1 - smoothstep((f - 0.9) / 0.1)) : 0;
      m.compose(
        tmp.set(P.x + Math.cos(s.a + f * 1.4) * r, y, P.z + Math.sin(s.a + f * 1.4) * r),
        q.setFromEuler(e0.set(tau * 3, tau * 2, i)), sc.setScalar(Math.max(size, 1e-4)),
      );
      this.pebbles.setMatrixAt(i, m);
    }
    this.pebbles.instanceMatrix.needsUpdate = true;

    // --- Light streaks bend toward the hole (seed, fading to a quiet background through the pull). ---
    const streakA = t < 0.2 || t >= COLLAPSE ? 0 : (t < SEED_END ? smoothstep((t - 0.2) / 0.5) : 0.55);
    this.streakMat.opacity = streakA;
    this.streaks.visible = streakA > 0.01;
    const pos = (this.streaks.geometry.attributes.position as THREE.BufferAttribute);
    for (let i = 0; i < STREAKS; i++) {
      const s = this.streakSeed[i];
      const head = frac(te * 0.5 + i / STREAKS);
      const tail = Math.max(0, head - 0.3);
      for (let k = 0; k < STREAK_SEGS; k++) {
        for (let e = 0; e < 2; e++) {
          const sk = lerp(tail, head, (k + e) / STREAK_SEGS);
          const r = s.r0 * Math.pow(1 - sk, 1.6) + HOLE_R * 1.3;
          const ang = s.a + s.swirl * sk * sk * 3;
          const o = ((i * STREAK_SEGS + k) * 2 + e) * 3;
          pos.array[o] = C.x + Math.cos(ang) * r;
          pos.array[o + 1] = C.y + s.elev * (1 - sk) * 0.6;
          pos.array[o + 2] = C.z + Math.sin(ang) * r;
        }
      }
    }
    pos.needsUpdate = true;

    // --- Enemies: dragged in, stretched toward the hole, flung back out at the collapse. ---
    const ctx = this.ctx;
    if (ctx) {
      const pf = Math.pow(clamp01((te - BIRTH_END) / (PULL_END - BIRTH_END)), 2.2);
      const release = t >= COLLAPSE ? smoothstep((t - COLLAPSE) / 0.9) : 0;
      this.pulled.forEach((pd, i) => {
        const tp = ctx.targetPos[i] ?? P;
        const dir = tmp.set(P.x - tp.x, 0, P.z - tp.z);
        const dist = dir.length();
        const f = 0.9 * pf;
        const jitter = t >= BIRTH_END && t < PULL_END ? 0.04 * Math.sin(t * 40 + i * 2) * pf : 0;
        const off = tmp2.set(dir.x * (f + jitter), 1.5 * Math.pow(pull, 1.5), dir.z * (f + jitter));
        const fling = Math.sin(clamp01((t - COLLAPSE) / 0.9) * Math.PI) * 1.6;
        off.multiplyScalar(1 - release).y += fling;
        ctx.displace(pd.enemy, off);
        const g = pd.enemy.group;
        if (dist > 0.05 && t < COLLAPSE) {
          // Face the hole and stretch along that axis (spaghettification), squash across it.
          const want = Math.atan2(dir.x, dir.z);
          const d = Math.atan2(Math.sin(want - pd.baseRot), Math.cos(want - pd.baseRot));
          g.rotation.y = pd.baseRot + d * smoothstep((te - BIRTH_END) / 0.4);
          const k = 0.25 * pull + 0.75 * smoothstep((te - 3.6) / 1.0);
          g.scale.set(1 - 0.4 * k, 1 - 0.4 * k, 1 + 1.0 * k);
        } else if (t >= COLLAPSE) {
          g.rotation.y = pd.baseRot;
          const back = smoothstep(after / 0.2);
          const k = (0.25 * pull + 0.75) * (1 - back);
          g.scale.set(1 - 0.4 * k, 1 - 0.4 * k, 1 + 1.0 * k);
        } else {
          g.rotation.y = pd.baseRot;
          g.scale.setScalar(1);
        }
      });
    }

    // --- Distortion: the lens is the hero. ---
    const pulse = 1 + 0.1 * Math.sin(Math.PI * 2 * 1.5 * te);
    let lensR = 0, lensS = 0;
    if (t < SEED_END) {
      const s = smoothstep(t / SEED_END);
      lensR = 0.3 + 1.4 * s;
      lensS = 0.04 * s;
    } else if (t < PULL_END) {
      lensR = Math.max(2.2 * rh, 1.7) * (1 + 0.03 * Math.sin(Math.PI * 2 * 1.5 * te));
      lensS = lerp(0.04, 0.056, smoothstep((t - SEED_END) / 0.8)) * lerp(1, 1.25, pull) * pulse;
    } else if (t < COLLAPSE) {
      lensR = 2.2 * HOLE_R;
      lensS = 0.1;
    }
    this.lens.set(C, lensR, lensS);

    const rq = clamp01(after / 1.5);
    this.lensResidual.set(C, 2.4 + 1.6 * rq, t >= COLLAPSE ? 0.035 * (1 - rq) * (1 - rq) : 0);

    // Infall ripples: a ground ring runs inward from 7 to 1 every 0.6 s while the pull runs.
    const RIP_LIFE = 1.2;
    const hideAt = new THREE.Vector3(0, -50, 0);
    this.ripples.forEach((r) => r.set(hideAt, 1, 0));
    if (t >= BIRTH_END && t < PULL_END) {
      const nLast = Math.floor((t - BIRTH_END) / 0.6);
      for (const n of [nLast, nLast - 1]) {
        if (n < 0) continue;
        const age = t - BIRTH_END - 0.6 * n;
        if (age < 0 || age >= RIP_LIFE) continue;
        const u = age / RIP_LIFE;
        this.ripples[n % 3].set(tmp.set(P.x, 0, P.z), lerp(7, 1, u * u * 0.5 + u * 0.5), 0.025 * Math.sin(Math.PI * u));
      }
    }

    // Collapse: a wide fast camera-facing ring plus a ground ring.
    const cp = clamp01(after / 0.5);
    const cE = 1 - Math.pow(1 - cp, 3);
    this.collapseRing.set(C, lerp(1, 14, cE), after > 0 && after < 0.5 ? 0.08 * Math.pow(1 - cp, 1.5) : 0);
    this.collapseGround.set(tmp.set(P.x, 0, P.z), lerp(1, 12, cE), after > 0 && after < 0.45 ? 0.04 * (1 - cp) * (1 - cp) : 0);
    this.groundRing.mesh.position.set(P.x, 0.06, P.z);
    const gq = clamp01(after / 0.35);
    this.groundRing.mesh.scale.setScalar(1 + 6 * (1 - Math.pow(1 - gq, 3)));
    this.groundRing.material.opacity = after > 0 && after < 0.35 ? 0.5 * (1 - gq) : 0;

    // Star burst at the collapse point.
    const bp = StarBurst.pop(after - 0.01, 0.08, 0.2);
    this.star.set(C, 5.5 * bp.scale, bp.opacity, 0.4);

    // Scorched decal with a spiral scar, stays after the collapse.
    this.scar.position.set(P.x, 0.03, P.z);
    this.scar.scale.setScalar(5.2);
    this.scar.rotation.z = 0.5;
    this.scarMat.opacity = t < COLLAPSE ? 0.35 * smoothstep((t - BIRTH_END) / 2.5) : lerp(0.8, 0.65, smoothstep(after / 2));

    // --- Shake: birth thump, pull rumble, collapse. Silence in the dead beat. ---
    const birth = t >= SEED_END && t < SEED_END + 0.5 ? 0.15 * Math.exp(-(t - SEED_END) * 6) : 0;
    const rumble = t > BIRTH_END && t < PULL_END ? 0.03 + 0.07 * pull : 0;
    const boom = after >= 0 ? 0.7 * Math.exp(-after * 5) : 0;
    this.shake = Math.max(birth, rumble, boom, this.shake * 0.9);
    if (t >= PULL_END && t < COLLAPSE) this.shake = 0;
  }
}

export const eventHorizonModule: EffectModule = {
  label: 'event horizon',
  category: 'targeted',
  targeting: { mode: 'ground', radius: PULL_RADIUS },
  create: () => new EventHorizon(),
  telegraphs(effect) {
    const e = effect as EventHorizon;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: PULL_RADIUS }, start: 0, impact: SEED_END, until: COLLAPSE }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as EventHorizon;
    if (e.ctx) frameCast(camera, controls, e.ctx, 7);
  },
  buildGui(f, effect) {
    const s = (effect as EventHorizon).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
