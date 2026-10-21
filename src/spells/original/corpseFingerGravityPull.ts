import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
  softDotTexture,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Corpse Finger Gravity Pull: the dark caster stabs a hand into the earth, a crack of violet-black light runs to
 * the middle of the arena and a giant corpse hand claws out of the ground. Its index finger hooks, then points at
 * the enemy, a gravity well forms on the fingertip and drags the enemy across the dirt into the palm. The fingers
 * close and crush it in a necrotic burst; the hand sinks away leaving a crater and lingering violet wisps.
 */
export interface CorpseFingerSettings {
  color: string; // gravity-well / crack colour
  crushPower: number; // scales the crush shake and burst size
  loop: boolean;
}

export const defaultCorpseFinger = (): CorpseFingerSettings => ({
  color: '#a24bff',
  crushPower: 1,
  loop: false,
});

// Timeline (seconds)
const T_STAB = 0.55; // caster's hand hits the ground
const T_ERUPT = 0.95; // the hand tears out of the earth
const T_POINT = 2.0; // index finger starts to hook / point
const T_DRAG = 2.7; // enemy starts to slide
const DRAG_TIME = 1.3;
const T_LIFT = 4.0;
const T_CLOSE = 4.5; // fingers close
const T_CRUSH = 5.1;
const T_SINK = 5.55;
const DURATION = 6.8;

const HAND_Z = 5; // hand root position (z); y = 0 is ground level
const PALM_TOP = 4.8;
const SINK_DEPTH = 8.8;
const N_PEBBLES = 70;
const N_SHARDS = 70;
const N_WELL = 360;
const WELL_LEN = 7.5;

type Curl = [number, number, number];
const CLAW: Curl = [-0.35, -0.5, -0.4];
const POINT: Curl = [-1.1, -1.2, -0.9];
const HOOK: Curl = [-2.3, -1.2, -0.9];
const POINT_IDX: Curl = [-1.8, -0.05, -0.05];
const CUP: Curl = [-0.3, -0.35, -0.3];
const FIST: Curl = [-1.45, -1.55, -1.2];

const mix3 = (a: Curl, b: Curl, k: number): Curl => [
  a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k,
];

interface Finger {
  joints: THREE.Group[];
  tip: THREE.Object3D;
}

interface CrackLine {
  segs: { mesh: THREE.Mesh }[];
  t0: number;
  dur: number;
}

export class CorpseFingerGravityPull implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CorpseFingerSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private stabbed = false;
  private erupted = false;
  private crushed = false;
  private dustAcc = 0;
  private kickAcc = 0;

  private caster = createCaster(0x2a2633);
  private enemy = new Enemy();
  private castGlow = new GlowSphere(0xa24bff, { rim: false });
  private stabRing = createRing(0xa24bff, 0.8, 1, 48);

  // ground marks
  private scorch: THREE.Mesh;
  private crackGroup = new THREE.Group();
  private crackMat = new THREE.MeshBasicMaterial({
    color: 0xb070ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private cracks: CrackLine[] = [];
  private crater: THREE.Mesh;
  private craterRim: THREE.Mesh;
  private craterGlow = createRing(0x9d4dff, 0.9, 1, 64);
  private groove: THREE.Mesh;
  private grooveGlow: THREE.Mesh;

  // the hand
  private hand = new THREE.Group();
  private handMat = new THREE.MeshStandardMaterial({
    // Darker, greener grey: the lighter bone tone read as clean white plastic under the sun.
    color: 0x5c6150, roughness: 0.95, metalness: 0, flatShading: true, emissive: 0x4a2290, emissiveIntensity: 0.3,
  });
  private boneMat = new THREE.MeshStandardMaterial({
    color: 0xa39f85, roughness: 0.9, metalness: 0, flatShading: true, emissive: 0x4a2290, emissiveIntensity: 0.3,
  });
  private fingers: Finger[] = []; // 0 index, 1 middle, 2 ring, 3 pinky, 4 thumb

  // gravity well
  private wellCore: THREE.Mesh;
  private wellRim = new GlowSphere(0x9d4dff);
  private wellRings = Array.from({ length: 5 }, () => createRing(0xa86bff, 0.9, 1, 64));
  private aura = new GlowSphere(0x8a4bff);
  private wellPoints: THREE.Points;
  private wellSeeds = new Float32Array(N_WELL * 3);
  private pebbles: THREE.InstancedMesh;
  private pebbleData = new Float32Array(N_PEBBLES * 5); // sx, sz, seed, size, side

  // crush
  private burstGreen = new GlowSphere(0x78ff8c);
  private burstViolet = new GlowSphere(0x9d4dff);
  private crushRing = createRing(0x8cff9a, 0.88, 1, 80);
  private shards: THREE.InstancedMesh;
  private shardData = new Float32Array(N_SHARDS * 9); // vx vy vz, axis xyz, spin, size, seed
  private light = new THREE.PointLight(0x9d4dff, 0, 26, 2);

  private dust: Emitter;
  private kick: Emitter;
  private smoke: Emitter;
  private sparks: Emitter;
  private wisps: Emitter;

  private tipPos = new THREE.Vector3();
  private dummy = new THREE.Object3D();
  private tmpV = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpC = new THREE.Color();
  private tmpC2 = new THREE.Color();
  private crushPoint = new THREE.Vector3(0, 4.3, HAND_Z - 1.2);

  constructor(settings: CorpseFingerSettings = defaultCorpseFinger()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.castGlow.mesh, this.stabRing.mesh);

    // --- ground marks -------------------------------------------------------------------------------------
    const dark = (c: number, o = 1) => new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
    });
    this.scorch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), dark(0x07040b, 0));
    this.scorch.position.y = 0.025;
    this.crater = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), dark(0x050308, 0));
    this.crater.position.set(0, 0.035, HAND_Z);
    this.craterRim = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.12, 48).rotateX(-Math.PI / 2), dark(0x17110f, 0));
    this.craterRim.position.set(0, 0.045, HAND_Z);
    this.craterGlow.mesh.position.set(0, 0.05, HAND_Z);
    this.groove = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1).rotateX(-Math.PI / 2), dark(0x07040b, 0));
    this.groove.position.y = 0.03;
    this.grooveGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x6a2bd0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.grooveGlow.position.y = 0.05;
    this.group.add(this.scorch, this.crater, this.craterRim, this.craterGlow.mesh, this.groove, this.grooveGlow);

    this.buildCracks();
    this.group.add(this.crackGroup);

    // --- the hand -----------------------------------------------------------------------------------------
    this.buildHand();
    this.group.add(this.hand);

    // --- gravity well -------------------------------------------------------------------------------------
    this.wellCore = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x06030a, transparent: true, opacity: 0.92 }),
    );
    this.wellCore.visible = false;
    this.group.add(this.wellCore, this.wellRim.mesh, this.aura.mesh);
    for (const r of this.wellRings) this.group.add(r.mesh);

    const wp = new THREE.BufferGeometry();
    wp.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_WELL * 3), 3));
    wp.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_WELL * 3), 3));
    this.wellPoints = new THREE.Points(wp, new THREE.PointsMaterial({
      size: 0.28, map: softDotTexture(), vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.wellPoints.frustumCulled = false;
    this.group.add(this.wellPoints);
    for (let i = 0; i < N_WELL; i++) {
      this.wellSeeds[i * 3] = Math.random();
      this.wellSeeds[i * 3 + 1] = Math.random() * Math.PI * 2;
      this.wellSeeds[i * 3 + 2] = Math.random();
    }

    this.pebbles = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x4a4338, roughness: 1, flatShading: true }),
      N_PEBBLES,
    );
    this.pebbles.frustumCulled = false;
    this.group.add(this.pebbles);
    for (let i = 0; i < N_PEBBLES; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 5;
      const d = this.pebbleData;
      d[i * 5] = Math.cos(a) * r; d[i * 5 + 1] = Math.sin(a) * r * 0.9;
      d[i * 5 + 2] = Math.random(); d[i * 5 + 3] = 0.1 + Math.random() * 0.17;
      d[i * 5 + 4] = (Math.random() - 0.5) * 6;
    }

    // --- crush --------------------------------------------------------------------------------------------
    this.group.add(this.burstGreen.mesh, this.burstViolet.mesh, this.crushRing.mesh, this.light);
    this.shards = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(1, 0).scale(0.3, 1, 0.22),
      new THREE.MeshStandardMaterial({
        color: 0xa8a58a, roughness: 0.85, flatShading: true, emissive: 0x2f6a3a, emissiveIntensity: 0.4,
      }),
      N_SHARDS,
    );
    this.shards.frustumCulled = false;
    this.group.add(this.shards);
    for (let i = 0; i < N_SHARDS; i++) {
      const d = this.shardData;
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.8 + 0.25;
      v.normalize().multiplyScalar(5 + Math.random() * 9);
      const ax = new THREE.Vector3().randomDirection();
      d.set([v.x, v.y, v.z, ax.x, ax.y, ax.z, 4 + Math.random() * 12, 0.25 + Math.random() * 0.45, Math.random()], i * 9);
    }

    // --- emitters -----------------------------------------------------------------------------------------
    // Dark normal-blended dust: the erupting earth.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 1.8, speed: 6, speedJitter: 0.6, spread: 70, gravity: 3, drag: 1.4,
      sizeStart: 0.9, sizeEnd: 2.4, colorStart: '#6a5f55', colorMid: '#3f3732', colorEnd: '#1c1816',
      opacityStart: 0.75, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.55, groundFade: 0.3, spin: 0.6,
    });
    // Smaller dust kicked up by the dragged feet.
    this.kick = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.3, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 3, speedJitter: 0.6, spread: 60, gravity: 2.5, drag: 1.5,
      sizeStart: 0.5, sizeEnd: 1.4, colorStart: '#6a5f55', colorMid: '#46403a', colorEnd: '#241f1c',
      opacityStart: 0.6, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.5, groundFade: 0.25, spin: 0.5,
    });
    // Dark necrotic smoke from the crush.
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 4, speedJitter: 0.6, spread: 180, gravity: -0.8, drag: 1.4,
      sizeStart: 0.8, sizeEnd: 3.2, colorStart: '#2e1f3a', colorMid: '#1c1224', colorEnd: '#0c0810',
      opacityStart: 0.8, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.6, spin: 0.7,
    });
    // Green-violet sparks.
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.1, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 11, speedJitter: 0.6, spread: 180, gravity: 10, drag: 0.7,
      sizeStart: 0.16, sizeEnd: 0.02, colorStart: '#e8ffd0', colorMid: '#8cff7a', colorEnd: '#7a2bd8',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    // Lingering violet wisps from the crater (positioned at the hand's base, rate driven by the timeline).
    this.wisps = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.6, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 1.4, speed: 1, speedJitter: 0.5, spread: 18, gravity: -0.3, drag: 0.8,
      sizeStart: 0.7, sizeEnd: 1.5, colorStart: '#c9a0ff', colorMid: '#6a2bd0', colorEnd: '#1a0a30',
      opacityStart: 0.3, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, groundFade: 0.2, spin: 0.5,
    });
    this.wisps.points.position.set(0, 0, HAND_Z);
    // Draw order: dark first, bright on top.
    this.emitters.push(this.dust, this.kick, this.smoke, this.sparks, this.wisps);
    for (const e of this.emitters) this.group.add(e.points);

    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.castGlow.color.set(c);
    this.stabRing.material.color.set(c);
    this.craterGlow.material.color.set(c);
    this.wellRim.color.set(c);
    this.burstViolet.color.set(c);
    this.crackMat.color.set(c);
    for (const r of this.wellRings) r.material.color.set(c);
  }

  get duration() {
    return DURATION;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.stabbed = this.erupted = this.crushed = false;
    this.dustAcc = this.kickAcc = 0;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const t = this.time;
    if (!this.stabbed && t >= T_STAB) {
      this.stabbed = true;
      this.dust.burst(40, this.tmpV.set(0, 0.1, CASTER_POS.z - 1.7));
    }
    if (!this.erupted && t >= T_ERUPT) {
      this.erupted = true;
      this.dust.burst(380, this.tmpV.set(0, 0.2, HAND_Z));
      this.smoke.burst(50, this.tmpV.set(0, 0.5, HAND_Z));
    }
    if (!this.crushed && t >= T_CRUSH) this.onCrush();

    // Continuous dust while the hand tears up, and kicked dust while the enemy is dragged.
    if (t > T_ERUPT && t < T_POINT) {
      this.dustAcc += dt * 140;
      for (; this.dustAcc >= 1; this.dustAcc -= 1) {
        const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.8;
        this.dust.burst(1, this.tmpV.set(Math.cos(a) * r, 0.1, HAND_Z + Math.sin(a) * r));
      }
    }
    if (t > T_DRAG && t < T_LIFT) {
      this.kickAcc += dt * 110;
      for (; this.kickAcc >= 1; this.kickAcc -= 1) {
        this.kick.burst(1, this.tmpV.set(
          this.enemy.group.position.x + (Math.random() - 0.5) * 1.2, 0.1,
          this.enemy.group.position.z - 0.2 + (Math.random() - 0.5) * 0.6,
        ));
      }
    }
    this.wisps.settings.rate = t > T_SINK && t < DURATION - 0.5 ? 45 : 0;
    this.layout();
  }

  private buildCracks() {
    const zs = CASTER_POS.z - 1.7; // where the stab lands
    const mk = (pts: [number, number][], t0: number, dur: number, w: number) => {
      const segs: { mesh: THREE.Mesh }[] = [];
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
        const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.crackMat);
        const len = Math.hypot(x1 - x0, z1 - z0);
        m.scale.set(w, 0.03, len + 0.05);
        m.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2);
        m.rotation.y = Math.atan2(x1 - x0, z1 - z0);
        m.visible = false;
        this.crackGroup.add(m);
        segs.push({ mesh: m });
      }
      this.cracks.push({ segs, t0, dur });
    };
    const jag = (x0: number, z0: number, x1: number, z1: number, n: number, amp: number): [number, number][] => {
      const p: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const edge = i === 0 || i === n ? 0 : 1;
        p.push([x0 + (x1 - x0) * k + (Math.random() - 0.5) * amp * edge, z0 + (z1 - z0) * k + (Math.random() - 0.5) * amp * edge]);
      }
      return p;
    };
    // main fissure from the stab to the hand, two branches, and radial cracks around the hand's base
    mk(jag(0, zs, 0, HAND_Z + 0.8, 12, 1.0), T_STAB, 0.7, 0.14);
    mk(jag(0, zs - 2.5, 1.6, zs - 5.2, 4, 0.5), T_STAB + 0.3, 0.45, 0.09);
    mk(jag(0, zs - 4, -1.8, zs - 6.2, 4, 0.5), T_STAB + 0.4, 0.45, 0.09);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
      const r1 = 4 + Math.random() * 2.5;
      mk(jag(Math.cos(a) * 0.8, HAND_Z + Math.sin(a) * 0.8, Math.cos(a) * r1, HAND_Z + Math.sin(a) * r1, 4, 0.7),
        T_ERUPT - 0.1, 0.4, 0.1);
    }
  }

  private buildFinger(parent: THREE.Object3D, x: number, y: number, z: number, lens: number[], r: number): Finger {
    const joints: THREE.Group[] = [];
    let host: THREE.Object3D = parent;
    let tip: THREE.Object3D = parent;
    lens.forEach((len, i) => {
      const j = new THREE.Group();
      if (i === 0) j.position.set(x, y, z); else j.position.y = lens[i - 1];
      host.add(j);
      const rr = r * (1 - i * 0.12);
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(rr * 1.2, 10, 8), this.boneMat);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.85, rr, len, 8), this.handMat);
      seg.position.y = len / 2;
      j.add(knuckle, seg);
      joints.push(j);
      host = j;
      if (i === lens.length - 1) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(rr * 0.85, 0.4, 7), this.boneMat);
        claw.position.y = len + 0.15;
        j.add(claw);
        tip = new THREE.Object3D();
        tip.position.y = len + 0.35;
        j.add(tip);
      }
    });
    return { joints, tip };
  }

  private buildHand() {
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 2.7, 9), this.handMat);
    forearm.position.y = 1.3;
    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), this.boneMat);
    wrist.position.y = 2.5;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.85), this.handMat);
    palm.position.y = 3.6;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.7, 0.2), this.boneMat); // ribbed back-of-hand plate
    plate.position.set(0, 3.7, 0.5);
    this.hand.add(forearm, wrist, palm, plate);
    const xs = [0.95, 0.32, -0.32, -0.95];
    const lens = [[1.05, 0.95, 0.8], [1.15, 1.0, 0.85], [1.05, 0.95, 0.8], [0.85, 0.75, 0.65]];
    xs.forEach((x, i) => this.fingers.push(this.buildFinger(this.hand, x, PALM_TOP, 0, lens[i], 0.27)));
    const mount = new THREE.Group();
    mount.position.set(1.4, 3.0, -0.05);
    mount.rotation.z = -0.75;
    this.hand.add(mount);
    this.fingers.push(this.buildFinger(mount, 0, 0, 0, [1.0, 0.9, 0.75], 0.3));
    this.hand.visible = false;
  }

  private pose(f: Finger, c: Curl) {
    for (let i = 0; i < 3; i++) f.joints[i].rotation.x = c[i];
  }

  private layout() {
    const t = this.time;
    const s = this.settings;
    const fade = 1 - smoothstep((t - (DURATION - 0.7)) / 0.7);
    const after = Math.max(0, t - T_CRUSH);
    let shake = 0;

    // --- caster: leans over and plunges a violet hand into the ground ---------------------------------------
    const lean = smoothstep((t - 0.15) / 0.3) * (1 - smoothstep((t - 1.3) / 0.6));
    this.caster.group.rotation.x = -0.45 * lean;
    const stab = smoothstep((t - 0.25) / 0.3);
    this.castGlow.mesh.position.set(0.5, 3.1 - 2.95 * stab, CASTER_POS.z - 0.6 - 1.1 * stab);
    this.castGlow.mesh.scale.setScalar(0.28 + 0.25 * stab);
    this.castGlow.opacity = 0.55 * smoothstep(t / 0.25) * (1 - smoothstep((t - 0.8) / 0.5));
    const sr = Math.max(0, t - T_STAB);
    this.stabRing.mesh.position.set(0, 0.05, CASTER_POS.z - 1.7);
    this.stabRing.mesh.scale.setScalar(0.3 + sr * 5);
    this.stabRing.material.opacity = t >= T_STAB ? 0.6 * Math.exp(-sr * 4) : 0;

    // --- cracks, scorch, crater ----------------------------------------------------------------------------
    const crackFade = 1 - smoothstep((t - 4.6) / 1.0);
    this.crackMat.opacity = (0.6 + 0.2 * Math.sin(t * 9)) * crackFade * fade;
    for (const c of this.cracks) {
      const p = smoothstep((t - c.t0) / c.dur);
      c.segs.forEach((sg, i) => { sg.mesh.visible = p * c.segs.length > i; });
    }
    const crackU = smoothstep((t - T_STAB) / 0.7);
    const sLen = (CASTER_POS.z - 1.7 - HAND_Z) * crackU;
    this.scorch.scale.set(1.3, 1, Math.max(0.001, sLen));
    this.scorch.position.set(0, 0.025, CASTER_POS.z - 1.7 - sLen / 2);
    (this.scorch.material as THREE.MeshBasicMaterial).opacity = 0.75 * crackU * fade;

    const open = smoothstep((t - T_ERUPT) / 0.5);
    this.crater.scale.set(2.6 * open, 1, 2.6 * open);
    (this.crater.material as THREE.MeshBasicMaterial).opacity = 0.9 * open;
    this.craterRim.scale.set(2.9 * open, 1, 2.9 * open);
    (this.craterRim.material as THREE.MeshBasicMaterial).opacity = 0.85 * open;
    const kWell = smoothstep((t - 2.35) / 0.5) * (1 - smoothstep((t - 4.1) / 0.45));
    this.craterGlow.mesh.scale.setScalar(2.7 * open);
    this.craterGlow.material.opacity = ((t >= T_ERUPT ? 0.5 * Math.exp(-(t - T_ERUPT) * 1.3) : 0)
      + 0.2 * kWell + 0.5 * Math.exp(-after * 3) * (this.crushed ? 1 : 0)) * fade;

    // --- the hand: tears up, claws, points, cups, closes, sinks ------------------------------------------
    const u = smoothstep((t - T_ERUPT) / 1.05);
    const sink = smoothstep((t - T_SINK) / 0.85);
    const overshoot = 0.2 * Math.sin(u * Math.PI) * (1 - sink);
    const fistK = smoothstep((t - T_CLOSE) / 0.55);
    this.hand.position.set(0, -SINK_DEPTH * (1 - u) - SINK_DEPTH * sink + overshoot, HAND_Z);
    this.hand.rotation.set(
      0.3 * (1 - u),
      0,
      0.2 * (1 - u) * Math.sin(t * 16) + 0.03 * Math.sin(t * 60) * fistK * (this.crushed ? 0 : 1),
    );
    this.hand.visible = t > T_ERUPT - 0.05 && this.hand.position.y > -SINK_DEPTH + 0.1;

    const kPoint = smoothstep((t - T_POINT) / 0.35);
    const kHook = smoothstep((t - T_POINT) / 0.3);
    const kIdx = smoothstep((t - (T_POINT + 0.35)) / 0.35);
    const kCup = smoothstep((t - T_LIFT + 0.1) / 0.4);
    for (let i = 0; i < 5; i++) {
      const f = this.fingers[i];
      const wig = u * (1 - kPoint) * 0.12 * Math.sin(t * 9 + i * 1.7);
      let c: Curl;
      if (i === 0) {
        c = mix3(CLAW, HOOK, kHook);
        c = mix3(c, POINT_IDX, kIdx);
      } else {
        const sc = i === 4 ? 0.75 : 1;
        c = mix3(CLAW, POINT.map((v) => v * sc) as Curl, kPoint);
      }
      c = mix3(c, CUP, kCup);
      c = mix3(c, FIST, fistK);
      const throb = i === 0 ? 0.06 * Math.sin(t * 14) * kWell : 0;
      this.pose(f, [c[0] + wig + throb, c[1] + wig, c[2] + wig]);
    }
    this.hand.updateMatrixWorld(true);
    this.fingers[0].tip.getWorldPosition(this.tipPos);
    const T = this.tipPos;

    // Emissive: violet while it rises and points, green-white flare when the fist crushes.
    const crushGlow = this.crushed ? Math.exp(-after * 3) : 0;
    this.tmpC.setHex(0x4a2290).lerp(this.tmpC2.setHex(0x3fbf5a), Math.min(1, crushGlow * 1.5));
    const emI = 0.3 + 0.5 * kWell + 1.3 * crushGlow;
    for (const m of [this.handMat, this.boneMat]) { m.emissive.copy(this.tmpC); m.emissiveIntensity = emI; }

    // --- gravity well at the fingertip --------------------------------------------------------------------
    const pulse = 1 + 0.12 * Math.sin(t * 13);
    this.wellCore.position.set(T.x, T.y, T.z - 0.5);
    this.wellCore.scale.setScalar((0.2 + 0.55 * kWell) * pulse);
    this.wellCore.visible = kWell > 0.01;
    this.wellRim.mesh.position.copy(this.wellCore.position);
    this.wellRim.mesh.scale.setScalar((0.35 + 1.0 * kWell) * pulse);
    this.wellRim.opacity = 0.5 * kWell * fade;
    this.wellRings.forEach((r, k) => {
      const p = (t * 1.1 + k / this.wellRings.length) % 1;
      const uu = 1 - p; // contracts toward the fingertip
      r.mesh.position.set(T.x, T.y, T.z - 0.6 - uu * WELL_LEN * 0.6);
      r.mesh.rotation.set(0, 0, t * (1.2 + k * 0.4) * (k % 2 ? -1 : 1));
      r.mesh.scale.setScalar(0.4 + 3.2 * uu);
      r.material.opacity = 0.4 * Math.sin(p * Math.PI) * kWell * fade;
    });

    // inward spiral of grave dust
    const wp = this.wellPoints.geometry.attributes.position as THREE.BufferAttribute;
    const wc = this.wellPoints.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < N_WELL; i++) {
      const sd = this.wellSeeds;
      const uu = 1 - ((sd[i * 3] + t * (0.45 + sd[i * 3 + 2] * 0.35)) % 1);
      const r = 0.12 + 3.4 * Math.pow(uu, 1.4) * (0.5 + 0.5 * sd[i * 3 + 2]);
      const a = sd[i * 3 + 1] + (1 - uu) * 5 + t * 1.5;
      wp.setXYZ(i, T.x + Math.cos(a) * r, T.y + Math.sin(a) * r, T.z - 0.5 - uu * WELL_LEN);
      this.tmpC.setHex(0xb070ff).lerp(this.tmpC2.setHex(0xe9d4ff), 1 - uu);
      wc.setXYZ(i, this.tmpC.r, this.tmpC.g, this.tmpC.b);
    }
    wp.needsUpdate = true; wc.needsUpdate = true;
    (this.wellPoints.material as THREE.PointsMaterial).opacity = 0.7 * kWell * fade;
    this.wellPoints.visible = kWell > 0.01;

    // pebbles and grave debris pulled along curved paths into the fingertip
    const pebbleEnv = kWell;
    const d = this.pebbleData;
    for (let i = 0; i < N_PEBBLES; i++) {
      const uu = (d[i * 5 + 2] + (t - 2.3) * 0.5) % 1;
      const k = Math.max(0, uu);
      const sx = d[i * 5], sz = d[i * 5 + 1];
      // quadratic bezier: ground start -> lifted control point -> fingertip
      const cx = (sx + T.x) / 2 + d[i * 5 + 4], cy = 3.5, cz = (sz + T.z) / 2;
      const w0 = (1 - k) * (1 - k), w1 = 2 * (1 - k) * k, w2 = k * k;
      this.dummy.position.set(w0 * sx + w1 * cx + w2 * T.x, w0 * 0.15 + w1 * cy + w2 * T.y, w0 * sz + w1 * cz + w2 * (T.z - 0.5));
      this.dummy.rotation.set(t * 3 + i, t * 2 + i * 2, 0);
      const sc = d[i * 5 + 3] * pebbleEnv * (1 - smoothstep((k - 0.85) / 0.15)) * smoothstep(k / 0.08);
      this.dummy.scale.setScalar(Math.max(0.0001, sc));
      this.dummy.updateMatrix();
      this.pebbles.setMatrixAt(i, this.dummy.matrix);
    }
    this.pebbles.instanceMatrix.needsUpdate = true;

    // --- enemy: trembles, is dragged across the dirt, lifted into the palm, crushed --------------------------
    const drag = THREE.MathUtils.clamp((t - T_DRAG) / DRAG_TIME, 0, 1);
    const lift = smoothstep((t - T_LIFT) / 0.6);
    const squeeze = smoothstep((t - 4.75) / 0.35);
    const e = this.enemy.group;
    e.position.set(
      0.06 * Math.sin(t * 40) * kWell * (1 - smoothstep(drag * 5)),
      3.0 * lift + 0.08 * Math.abs(Math.sin(t * 18)) * drag * (1 - lift),
      3.5 * Math.pow(drag, 1.7) + 0.2 * lift,
    );
    e.rotation.set(
      0.5 * smoothstep(drag * 3) * (1 - lift) - 0.12 * lift, 0,
      0.12 * Math.sin(t * 21) * drag * (1 - lift),
    );
    e.scale.setScalar(1 - 0.2 * lift - 0.35 * squeeze);
    e.visible = !this.crushed;

    // tractor aura around the enemy while it is dragged
    const dragEnv = smoothstep((t - 2.4) / 0.4) * (1 - smoothstep((t - T_CRUSH + 0.1) / 0.1));
    this.aura.mesh.position.set(e.position.x, e.position.y + 1.1, e.position.z);
    this.aura.mesh.scale.setScalar(1.7);
    this.aura.opacity = 0.25 * dragEnv * (0.8 + 0.2 * Math.sin(t * 20)) * fade;

    // groove in the dirt behind the enemy
    const gLen = e.position.z * (1 - lift);
    const gv = Math.max(0.001, gLen);
    const gOp = t > T_DRAG ? 1 : 0;
    this.groove.scale.set(1, 1, gv);
    this.groove.position.set(0, 0.03, gLen / 2);
    (this.groove.material as THREE.MeshBasicMaterial).opacity = 0.8 * gOp * fade;
    this.grooveGlow.scale.set(1, 1, gv);
    this.grooveGlow.position.set(0, 0.05, gLen / 2);
    (this.grooveGlow.material as THREE.MeshBasicMaterial).opacity = 0.25 * gOp * (1 - smoothstep((t - 4.4) / 0.6)) * fade;

    // --- crush burst ---------------------------------------------------------------------------------------
    const P = this.crushPoint;
    if (this.crushed) {
      this.burstGreen.mesh.position.copy(P);
      this.burstGreen.mesh.scale.setScalar((1 + after * 8) * s.crushPower);
      this.burstGreen.opacity = 0.55 * Math.exp(-after * 5) * fade;
      this.burstViolet.mesh.position.copy(P);
      this.burstViolet.mesh.scale.setScalar((1.4 + after * 11) * s.crushPower);
      this.burstViolet.opacity = 0.4 * Math.exp(-after * 3.5) * fade;
      this.crushRing.mesh.position.set(0, 0.06, HAND_Z);
      this.crushRing.mesh.scale.setScalar(1 + after * 14 * s.crushPower);
      this.crushRing.material.opacity = Math.max(0, 0.7 * (1 - after / 0.8)) * fade;
      this.light.position.set(P.x, P.y, P.z);
      this.light.color.setHex(after < 0.25 ? 0x9cff9a : 0x9d4dff);
      this.light.intensity = 450 * Math.exp(-after * 6);
      shake += 0.8 * s.crushPower * Math.exp(-after * 7);
    } else {
      this.burstGreen.opacity = 0;
      this.burstViolet.opacity = 0;
      this.crushRing.material.opacity = 0;
      this.light.color.setHex(0x9d4dff);
      const eruptT = t - T_ERUPT;
      this.light.position.set(0, 3, HAND_Z);
      this.light.intensity = (eruptT > 0 ? 280 * Math.exp(-eruptT * 2.2) : 0) + 90 * kWell;
    }
    // bone shards: ballistic, tumbling, resting on the ground, shrinking away
    const sd = this.shardData;
    for (let i = 0; i < N_SHARDS; i++) {
      const o = i * 9;
      if (!this.crushed) { this.dummy.scale.setScalar(0.0001); this.dummy.position.set(0, -50, 0); this.dummy.updateMatrix(); this.shards.setMatrixAt(i, this.dummy.matrix); continue; }
      const tau = after;
      let py = P.y + sd[o + 1] * tau - 8 * tau * tau;
      let spin = sd[o + 6] * tau;
      if (py < 0.12) { py = 0.12; spin = sd[o + 6] * Math.min(tau, 0.5); }
      this.dummy.position.set(P.x + sd[o] * tau * Math.exp(-tau * 0.3), py, P.z + sd[o + 2] * tau * Math.exp(-tau * 0.3));
      this.tmpQ.setFromAxisAngle(this.tmpV.set(sd[o + 3], sd[o + 4], sd[o + 5]).normalize(), spin);
      this.dummy.quaternion.copy(this.tmpQ);
      this.dummy.scale.setScalar(sd[o + 7] * (1 - smoothstep((t - (DURATION - 1.0)) / 0.9)));
      this.dummy.updateMatrix();
      this.shards.setMatrixAt(i, this.dummy.matrix);
    }
    this.dummy.quaternion.identity();
    this.shards.instanceMatrix.needsUpdate = true;

    // --- camera shake --------------------------------------------------------------------------------------
    const eruptT = t - T_ERUPT;
    if (eruptT > 0) shake += 0.4 * Math.exp(-eruptT * 4) + (eruptT < 1.05 ? 0.1 : 0);
    shake += 0.07 * kWell + (t > T_CLOSE && !this.crushed ? 0.15 * fistK : 0);
    this.shake = shake;
  }

  private onCrush() {
    this.crushed = true;
    const k = this.settings.crushPower;
    this.sparks.burst(Math.floor(500 * k), this.crushPoint);
    this.smoke.burst(Math.floor(170 * k), this.crushPoint);
    this.dust.burst(120, this.tmpV.set(0, 0.2, HAND_Z - 1));
  }
}

export const corpseFingerGravityPullModule: EffectModule = {
  label: 'corpse finger gravity pull',
  category: 'original',
  create: () => new CorpseFingerGravityPull(),
  telegraphs: () => [
    // The gravity well drags everything in front of the hand toward it…
    { shape: { kind: 'cone', x: 0, z: 5, radius: 9, angle: 70, dir: Math.PI }, start: 1.6, impact: 2.6, until: 4.6 },
    // …then the fist closes around the palm.
    { shape: { kind: 'circle', x: 0, z: 4, radius: 3 }, start: 4.2, impact: 5.1 },
  ],
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls) {
    // Caster at z = 14, enemy at 0, the hand (8 tall) rises at z = 5.
    frameArena(camera, controls, new THREE.Vector3(0, 3.5, 7), 11.5);
  },
  buildGui(f, effect) {
    const c = effect as CorpseFingerGravityPull;
    const s = c.settings;
    f.add(s, 'loop');
    f.add(s, 'crushPower', 0.3, 2, 0.05).name('crush power');
    f.addColor(s, 'color').name('well colour').onChange(() => c.applyStyle());
  },
};
