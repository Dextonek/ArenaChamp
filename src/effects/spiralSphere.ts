import * as THREE from 'three';
import { Emitter, defaultSettings } from '../emitter';
import { Enemy, GlowSphere, createGround, smoothstep, softDotTexture } from './common';
import type { Effect, EffectModule } from './types';

/**
 * "Spiral sphere" set piece: a spinning energy sphere forms in mid-air in front of the enemy
 * (particle streams spiral in, tilted rings whirl around a bright core), charges, rushes the
 * enemy, grinds against it, then bursts in spiral shockwaves and launches the enemy backwards.
 */
export interface SpiralSphereSettings {
  sphereSize: number; // sphere radius scale in world units
  ringCount: number; // 1..5 orbit rings
  spinSpeed: number; // base spin in radians per second
  formTime: number; // seconds the sphere takes to gather
  power: number; // scales the burst, shake and knockback
  coreColor: string;
  ringColor: string;
  accentColor: string; // wind, sparks and shockwaves
  loop: boolean;
}

export const defaultSpiralSphere = (): SpiralSphereSettings => ({
  sphereSize: 1,
  ringCount: 4,
  spinSpeed: 6,
  formTime: 1.6,
  power: 1,
  coreColor: '#8fdcff',
  ringColor: '#3d8cff',
  accentColor: '#ffb04a',
  loop: false,
});

const START = new THREE.Vector3(0, 1.4, 7); // where the sphere forms, in front of the enemy
const CHARGE = 0.6;
const THRUST = 0.35;
const GRIND = 0.8;
const AFTERMATH = 2.5; // seconds after the burst until everything has faded
const MAX_RINGS = 5;
const STREAMS = 800;
const WIND = 300;
const SPARKS = 700;
const SHOCKS = 4;
const GRAVITY = 22;

/** A small hand-animated additive point cloud with per-point colour (fade by darkening). */
class PointCloud {
  readonly points: THREE.Points;
  readonly pos: Float32Array;
  readonly col: Float32Array;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.PointsMaterial;

  constructor(count: number, size: number, opacity: number, map: THREE.Texture) {
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.PointsMaterial({
      size, map, vertexColors: true, sizeAttenuation: true, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
  }

  flush() {
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

interface Orbit {
  holder: THREE.Object3D;
  mat: THREE.MeshBasicMaterial;
  axis: THREE.Vector3;
  dir: number;
}

export class SpiralSphere implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SpiralSphereSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private windAngle = 0;
  private contacted = false;
  private released = false;
  private ringPulse = 0;

  private sphere = new THREE.Group();
  private coreMat: THREE.MeshBasicMaterial;
  private halo = new GlowSphere(0xffffff);
  private orbits: Orbit[] = [];
  private shells: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; spin: THREE.Vector3 }[] = [];
  private streams: PointCloud;
  private wind: PointCloud;
  private sparkCloud: PointCloud;
  private shocks: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; tilt: THREE.Vector2 }[] = [];
  private groundShock: THREE.Mesh;
  private groundShockMat: THREE.MeshBasicMaterial;
  private gouge: THREE.Mesh;
  private gougeMat: THREE.MeshBasicMaterial;
  private dustRing: THREE.Mesh;
  private dustRingMat: THREE.MeshBasicMaterial;
  private enemy = new Enemy();
  private light = new THREE.PointLight(0x6fb8ff, 0, 25, 1.5);
  private flashLight = new THREE.PointLight(0xffc27a, 0, 50, 1.5);
  private sparks: Emitter;
  private dust: Emitter;
  private darkDust: Emitter;

  // Stream / wind / spark state.
  private sAz = new Float32Array(STREAMS);
  private sPol = new Float32Array(STREAMS);
  private sR0 = new Float32Array(STREAMS);
  private sOff = new Float32Array(STREAMS);
  private sTurns = new Float32Array(STREAMS);
  private wR = new Float32Array(WIND);
  private wH = new Float32Array(WIND);
  private wA = new Float32Array(WIND);
  private wTilt = new Float32Array(WIND);
  private wSpd = new Float32Array(WIND);
  private pVel = new Float32Array(SPARKS * 3);
  private pAge = new Float32Array(SPARKS);
  private pLife = new Float32Array(SPARKS);
  private pCursor = 0;

  // Enemy knockback state.
  private evel = new THREE.Vector3();
  private espin = 0;

  private spherePos = START.clone();
  private baseCore = new THREE.Color();
  private baseRing = new THREE.Color();
  private baseAccent = new THREE.Color();
  private tmp = new THREE.Vector3();

  constructor(settings: SpiralSphereSettings = defaultSpiralSphere()) {
    this.settings = settings;

    // Core, halo.
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    this.sphere.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), this.coreMat));
    this.halo.mesh.scale.setScalar(1.25);
    this.sphere.add(this.halo.mesh);

    // Orbit rings, each tilted and tumbling about its own axis, with a bead to make the spin readable.
    const ringGeo = new THREE.TorusGeometry(1, 0.022, 8, 96);
    const beadGeo = new THREE.SphereGeometry(0.06, 10, 8);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const holder = new THREE.Object3D();
      const ring = new THREE.Mesh(ringGeo, mat);
      const bead = new THREE.Mesh(beadGeo, mat);
      bead.position.x = 1;
      ring.add(bead);
      const radius = 0.85 + 0.17 * i;
      ring.scale.setScalar(radius);
      holder.add(ring);
      holder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      this.orbits.push({ holder, mat, axis, dir: i % 2 === 0 ? 1 : -1 });
      this.sphere.add(holder);
    }

    // Swirling outer shell: two counter-rotating torus knots.
    const knots: [THREE.BufferGeometry, THREE.Vector3][] = [
      [new THREE.TorusKnotGeometry(1.05, 0.045, 160, 6, 2, 3), new THREE.Vector3(0.1, 0.3, 0.05)],
      [new THREE.TorusKnotGeometry(1.12, 0.035, 160, 6, 3, 5), new THREE.Vector3(-0.05, -0.4, 0.12)],
    ];
    for (const [geo, spin] of knots) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.shells.push({ mesh, mat, spin });
      this.sphere.add(mesh);
    }
    this.group.add(this.sphere);

    // Particle clouds.
    this.streams = new PointCloud(STREAMS, 0.16, 0.5, softDotTexture());
    this.wind = new PointCloud(WIND, 0.14, 0.5, softDotTexture());
    this.sparkCloud = new PointCloud(SPARKS, 0.12, 0.9, softDotTexture());
    this.group.add(this.streams.points, this.wind.points, this.sparkCloud.points);
    this.seed();

    // Shockwave rings (spiral burst) and ground rings.
    const shockGeo = new THREE.TorusGeometry(1, 0.03, 6, 96);
    const tilts = [[0, 0], [0.5, 0.2], [-0.45, 0.35], [0.2, -0.6]];
    for (let k = 0; k < SHOCKS; k++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(shockGeo, mat);
      mesh.visible = false;
      this.shocks.push({ mesh, mat, tilt: new THREE.Vector2(tilts[k][0], tilts[k][1]) });
      this.group.add(mesh);
    }
    const flat = (inner: number, outer: number, additive: boolean) => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      return { mesh, mat };
    };
    ({ mesh: this.groundShock, mat: this.groundShockMat } = flat(0.9, 1, true));
    ({ mesh: this.gouge, mat: this.gougeMat } = flat(0.5, 1.6, true));
    ({ mesh: this.dustRing, mat: this.dustRingMat } = flat(0.85, 1, false));
    this.gouge.position.set(0, 0.03, 0.4);
    this.groundShock.position.set(0, 0.05, 0.4);
    this.dustRingMat.color.set('#8a7f70');

    this.group.add(createGround());
    this.group.add(this.enemy.group);
    this.group.add(this.light, this.flashLight);

    // Emitters: burst sparks and ground dust.
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.3, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 13, speedJitter: 0.6, spread: 180, gravity: 12, drag: 0.8,
      sizeStart: 0.16, sizeEnd: 0.03, colorStart: '#fff0d0', colorEnd: '#ff8a20',
      opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 2.5, lifetimeJitter: 0.3,
      shape: 'cone', shapeSize: 0.6, originY: 0.15, speed: 5, speedJitter: 0.5, spread: 82,
      gravity: -0.2, drag: 1.5, sizeStart: 1.1, sizeEnd: 4, colorStart: '#8a7f70', colorEnd: '#3a3a40',
      colorMid: '#6a6258', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
      opacityStart: 0.35, opacityEnd: 0, additive: false,
    });
    // Darker, denser smoke behind the bright burst for contrast (normal-blended).
    this.darkDust = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.4, lifetimeJitter: 0.3,
      shape: 'sphere', shapeSize: 0.8, originY: 0.2, speed: 3.5, speedJitter: 0.5, spread: 70,
      gravity: -0.3, drag: 1.3, sizeStart: 1.2, sizeEnd: 4.5, colorStart: '#2e2924', colorEnd: '#0e0e11',
      colorMid: '#1c1a1a', sizeJitter: 0.45, erosion: 0.6, spin: 0.35,
      opacityStart: 0.4, opacityEnd: 0, additive: false,
    });
    this.emitters.push(this.sparks, this.dust, this.darkDust);
    for (const e of this.emitters) this.group.add(e.points);

    this.applyStyle();
    this.reset();
  }

  /** Randomises the per-point layout of the streams and wind. */
  private seed() {
    for (let i = 0; i < STREAMS; i++) {
      this.sAz[i] = Math.random() * Math.PI * 2;
      this.sPol[i] = Math.acos(Math.random() * 2 - 1);
      this.sR0[i] = 4 + Math.random() * 6;
      this.sOff[i] = Math.random();
      this.sTurns[i] = 0.6 + Math.random() * 0.8;
    }
    for (let i = 0; i < WIND; i++) {
      this.wR[i] = 1.8 + Math.random() * 1.3;
      this.wH[i] = (Math.random() - 0.5) * 1.6;
      this.wA[i] = Math.random() * Math.PI * 2;
      this.wTilt[i] = (Math.random() - 0.5) * 1.6;
      this.wSpd[i] = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.8);
    }
  }

  /** Applies colour changes from the settings. */
  applyStyle() {
    const s = this.settings;
    this.baseCore.set(s.coreColor);
    this.baseRing.set(s.ringColor);
    this.baseAccent.set(s.accentColor);
    this.coreMat.color.copy(this.baseCore).multiplyScalar(1.2);
    this.halo.color.copy(this.baseRing);
    this.orbits.forEach((o, i) => o.mat.color.copy(i % 2 ? this.baseCore : this.baseRing).multiplyScalar(1.3));
    this.shells.forEach((sh, i) => sh.mat.color.copy(i ? this.baseCore : this.baseRing).multiplyScalar(1.3));
    for (const sh of this.shocks) sh.mat.color.copy(this.baseAccent).multiplyScalar(1.3);
    this.groundShockMat.color.copy(this.baseAccent).multiplyScalar(1.3);
    this.gougeMat.color.copy(this.baseAccent);
    this.light.color.copy(this.baseRing);
    this.flashLight.color.copy(this.baseAccent);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.windAngle = 0;
    this.contacted = false;
    this.released = false;
    this.ringPulse = 0;
    this.shake = 0;
    this.espin = 0;
    this.evel.set(0, 0, 0);
    this.spherePos.copy(START);
    for (const e of this.emitters) e.clear();
    this.pLife.fill(0);
    this.pAge.fill(0);
    this.sparkCloud.col.fill(0);
    this.sparkCloud.flush();
    this.enemy.reset();
    this.enemy.group.position.set(0, 0, 0);
    this.light.intensity = 0;
    this.flashLight.intensity = 0;
    this.layout(0);
  }

  private get tCharge() { return this.settings.formTime; }
  private get tThrust() { return this.settings.formTime + CHARGE; }
  private get tGrind() { return this.tThrust + THRUST; }
  private get tRelease() { return this.tGrind + GRIND; }

  get duration() {
    return this.tRelease + AFTERMATH;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.updateSparks(dt);
    if (!this.playing) return;

    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) this.play();
      else {
        this.playing = false;
        this.layout(dt);
        return;
      }
    }
    this.layout(dt);
  }

  /** World position where the sphere meets the enemy. */
  private contactZ() {
    return 0.6 + this.settings.sphereSize * 0.7;
  }

  private spawnSpark(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
    const i = this.pCursor;
    this.pCursor = (this.pCursor + 1) % SPARKS;
    const p = this.sparkCloud.pos, j = i * 3;
    p[j] = x; p[j + 1] = y; p[j + 2] = z;
    this.pVel[j] = vx; this.pVel[j + 1] = vy; this.pVel[j + 2] = vz;
    this.pAge[i] = 0;
    this.pLife[i] = life;
  }

  /** Spawns a tangential spiral spray around the thrust axis (Z) at the contact point. */
  private spraySpiral(count: number, speed: number, radius: number) {
    const cz = this.contactZ() - 0.15;
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const r0 = radius * (0.3 + Math.random() * 0.7);
      const vt = speed * (0.6 + Math.random() * 0.6);
      const vr = speed * (0.15 + Math.random() * 0.25);
      this.spawnSpark(
        c * r0, START.y + sn * r0, cz,
        -sn * vt + c * vr, c * vt + sn * vr, 1.5 + Math.random() * 4,
        0.5 + Math.random() * 0.6,
      );
    }
  }

  private updateSparks(dt: number) {
    const p = this.sparkCloud.pos, c = this.sparkCloud.col, v = this.pVel;
    const ca = Math.cos(5 * dt), sa = Math.sin(5 * dt); // spiral: curl the velocity about the Z axis
    const drag = Math.exp(-0.8 * dt);
    const a = this.baseAccent;
    for (let i = 0; i < SPARKS; i++) {
      const j = i * 3;
      if (this.pLife[i] <= 0) { c[j] = c[j + 1] = c[j + 2] = 0; continue; }
      this.pAge[i] += dt;
      if (this.pAge[i] >= this.pLife[i]) {
        this.pLife[i] = 0;
        c[j] = c[j + 1] = c[j + 2] = 0;
        continue;
      }
      const vx = v[j] * ca - v[j + 1] * sa, vy = v[j] * sa + v[j + 1] * ca;
      v[j] = vx * drag; v[j + 1] = (vy - 7 * dt) * drag; v[j + 2] *= drag;
      p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      if (p[j + 1] < 0.03) { p[j + 1] = 0.03; v[j + 1] *= -0.3; }
      const f = 1 - this.pAge[i] / this.pLife[i];
      c[j] = (0.6 + 0.4 * a.r) * f; c[j + 1] = (0.6 + 0.4 * a.g) * f; c[j + 2] = (0.5 + 0.4 * a.b) * f;
    }
    this.sparkCloud.flush();
  }

  /** Positions everything for the current time. */
  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const pw = s.power;
    const F = s.formTime;
    const tCharge = this.tCharge, tThrust = this.tThrust, tGrind = this.tGrind, tRelease = this.tRelease;
    const formP = THREE.MathUtils.clamp(t / F, 0, 1);
    const chargeP = THREE.MathUtils.clamp((t - tCharge) / CHARGE, 0, 1);
    const thrustP = THREE.MathUtils.clamp((t - tThrust) / THRUST, 0, 1);
    const grindP = THREE.MathUtils.clamp((t - tGrind) / GRIND, 0, 1);
    const rp = Math.max(0, t - tRelease); // time since the burst
    const contactZ = this.contactZ();

    // Triggers.
    if (this.playing && !this.contacted && t >= tGrind) this.onContact();
    if (this.playing && !this.released && t >= tRelease) this.onRelease();

    // --- Sphere pose ---------------------------------------------------------
    let z = START.z;
    if (t >= tThrust) z = THREE.MathUtils.lerp(START.z, contactZ, thrustP * thrustP);
    if (t >= tGrind) z = contactZ - 0.2 * smoothstep(grindP);
    const bob = t < tThrust ? Math.sin(t * 3) * 0.05 : 0;
    this.spherePos.set(0, START.y + bob, z);

    let grow: number;
    if (t < tCharge) grow = 0.12 + 0.58 * smoothstep(formP);
    else if (t < tGrind) grow = 0.7 + 0.3 * smoothstep(chargeP);
    else grow = 1 + 0.08 * grindP;
    const R0 = s.sphereSize;
    let vis = 1;
    if (this.released) {
      grow = 1.08 + 2.2 * smoothstep(rp / 0.35);
      vis = 1 - smoothstep(rp / 0.5);
    }
    const R = R0 * grow;
    this.sphere.position.copy(this.spherePos);
    this.sphere.scale.setScalar(Math.max(R, 1e-3));
    this.sphere.visible = vis > 0.003;

    // --- Spin ------------------------------------------------------------------
    let spinMul: number;
    if (t < tCharge) spinMul = 0.5 + 1.0 * formP;
    else if (t < tThrust) spinMul = 1.5 + 2.5 * chargeP;
    else spinMul = 4.5;
    const rate = s.spinSpeed * spinMul;
    this.windAngle += rate * dt;

    const nRings = THREE.MathUtils.clamp(Math.round(s.ringCount), 1, MAX_RINGS);
    const formIn = smoothstep(formP * 2.2);
    this.orbits.forEach((o, i) => {
      o.holder.visible = i < nRings;
      if (!o.holder.visible) return;
      o.holder.rotateOnAxis(o.axis, rate * o.dir * (1 + 0.35 * i) * dt);
      o.mat.opacity = 0.42 * smoothstep(formIn * 1.6 - i * 0.2) * vis;
    });
    this.shells.forEach((sh, i) => {
      const d = i ? -1 : 1;
      sh.mesh.rotation.x += sh.spin.x * rate * d * dt;
      sh.mesh.rotation.y += sh.spin.y * rate * dt;
      sh.mesh.rotation.z += sh.spin.z * rate * d * dt;
      sh.mat.opacity = (0.16 + 0.06 * chargeP) * formIn * vis;
    });
    this.coreMat.color.copy(this.baseCore).multiplyScalar(1.15 + 0.1 * Math.sin(t * 28));
    this.coreMat.opacity = smoothstep(formP * 4) * vis;
    this.halo.opacity = (0.13 + 0.08 * chargeP) * formIn * vis;

    this.light.position.copy(this.spherePos);
    this.light.intensity = 40 * R * formIn * vis;

    // --- Inward spiral streams ---------------------------------------------------
    const streamAmt = smoothstep(t / 0.25) * (1 - smoothstep((t - tThrust) / 0.25));
    const sp = this.streams.pos, sc = this.streams.col;
    const cycle = 1 / (F * 0.5);
    const cc = this.baseCore, rc = this.baseRing;
    for (let i = 0; i < STREAMS; i++) {
      const j = i * 3;
      const u = (t * cycle + this.sOff[i]) % 1;
      const r = R * 0.9 + this.sR0[i] * Math.pow(1 - u, 1.5);
      const az = this.sAz[i] + this.sTurns[i] * u * Math.PI * 2;
      const sinp = Math.sin(this.sPol[i]);
      sp[j] = this.spherePos.x + r * sinp * Math.cos(az);
      sp[j + 1] = this.spherePos.y + r * Math.cos(this.sPol[i]) * 0.8;
      sp[j + 2] = this.spherePos.z + r * sinp * Math.sin(az);
      const fade = Math.min(1, u * 6) * (1 - u * u) * streamAmt;
      const mix = i % 3 === 0 ? rc : cc;
      sc[j] = mix.r * fade; sc[j + 1] = mix.g * fade; sc[j + 2] = mix.b * fade;
    }
    this.streams.flush();

    // --- Tangential wind -----------------------------------------------------------
    const windAmt = smoothstep((t - 0.2) / 0.4) * (1 - smoothstep(rp / 0.25));
    const wp = this.wind.pos, wc = this.wind.col, ac = this.baseAccent;
    for (let i = 0; i < WIND; i++) {
      const j = i * 3;
      const a = this.wA[i] + this.windAngle * this.wSpd[i];
      const r = R * this.wR[i];
      const lx = r * Math.cos(a), ly = this.wH[i] * R, lz = r * Math.sin(a);
      const ct = Math.cos(this.wTilt[i]), st = Math.sin(this.wTilt[i]);
      wp[j] = this.spherePos.x + lx * ct - ly * st;
      wp[j + 1] = this.spherePos.y + lx * st + ly * ct;
      wp[j + 2] = this.spherePos.z + lz;
      const mix = i % 2 ? ac : cc;
      const k = windAmt * 0.8;
      wc[j] = mix.r * k; wc[j + 1] = mix.g * k; wc[j + 2] = mix.b * k;
    }
    this.wind.flush();

    // --- Charge: ground dust ring blown outward ----------------------------------
    if (t >= tCharge && t < tThrust) {
      this.ringPulse += dt;
      const ph = (this.ringPulse / 0.3) % 1;
      this.dustRing.visible = true;
      this.dustRing.position.set(0, 0.03, START.z);
      this.dustRing.scale.setScalar(R0 * (1 + 4.5 * ph));
      this.dustRingMat.opacity = 0.28 * (1 - ph);
      if (dt > 0) {
        const n = Math.ceil(110 * dt);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          this.dust.burst(1, this.tmp.set(Math.cos(a) * R0 * 1.4, 0, START.z + Math.sin(a) * R0 * 1.4));
        }
      }
    } else {
      this.dustRing.visible = false;
    }

    // --- Thrust: dust kicked up along the path --------------------------------------
    if (t >= tThrust && t < tGrind && dt > 0) {
      this.dust.burst(Math.ceil(120 * dt), this.tmp.set(0, 0, z + 0.5));
    }

    // --- Grind: sparks, gouge ring, enemy shudder ---------------------------------------
    if (t >= tGrind && !this.released && this.playing) {
      if (dt > 0) {
        this.spraySpiral(Math.ceil(520 * dt), 9 * pw, R0 * 0.9);
        this.dust.burst(Math.ceil(60 * dt), this.tmp.set(0, 0, 0.4));
      }
      const e = this.enemy.group;
      const jit = 0.05 * (0.5 + grindP);
      e.position.set((Math.random() - 0.5) * jit, 0, -0.3 * smoothstep(grindP) + (Math.random() - 0.5) * jit);
      this.enemy.setFlash(0.1 + 0.08 * Math.sin(t * 50));
      this.gouge.visible = true;
      this.gouge.scale.setScalar(R0 * (0.9 + 0.5 * grindP));
      this.gouge.rotation.z = t * rate * 0.3;
      this.gougeMat.opacity = 0.32 * smoothstep(grindP * 3);
      this.shake = (0.08 + 0.07 * grindP) * pw;
    } else if (!this.released) {
      this.shake = 0;
    }

    // --- Release: shock rings, launch, aftermath ------------------------------------------
    if (this.released) {
      const cp = this.tmp.set(0, START.y, 0.55);
      this.shocks.forEach((sh, k) => {
        const p = (rp - 0.07 * k) / 1.1;
        sh.mesh.visible = p > 0 && p < 1;
        if (!sh.mesh.visible) return;
        const r = R0 * 1.5 + (7 + 1.5 * k) * Math.sqrt(pw) * Math.pow(p, 0.65);
        sh.mesh.position.copy(cp);
        sh.mesh.scale.set(r, r, 1);
        sh.mesh.rotation.set(sh.tilt.x, sh.tilt.y, k * 1.3 + rp * (4 + 2 * k));
        sh.mat.opacity = 0.45 * (1 - p);
      });
      const gp = rp / 1.3;
      this.groundShock.visible = gp < 1;
      this.groundShock.scale.setScalar(1 + gp * 15 * Math.sqrt(pw));
      this.groundShockMat.opacity = 0.4 * (1 - gp);
      this.gouge.scale.setScalar(R0 * (1.4 + rp * 2));
      this.gougeMat.opacity = 0.3 * Math.exp(-rp * 2);
      this.gouge.visible = this.gougeMat.opacity > 0.005;
      this.flashLight.position.set(0, START.y, 0.6);
      this.flashLight.intensity = 260 * pw * Math.exp(-rp * 6);
      this.shake = 0.9 * pw * Math.exp(-rp * 4);
      this.enemy.setFlash(Math.exp(-rp * 5));
      this.integrateEnemy(dt);
    }
  }

  private onContact() {
    this.contacted = true;
    this.sparks.burst(Math.round(250 * this.settings.power), this.tmp.set(0, START.y, 0.55));
    this.dust.burst(120, this.tmp.set(0, 0, 0.5));
    this.flashLight.position.set(0, START.y, 0.6);
    this.flashLight.intensity = 80;
    this.shake = 0.25 * this.settings.power;
  }

  private onRelease() {
    this.released = true;
    const pw = this.settings.power;
    this.sparks.burst(Math.round(900 * pw), this.tmp.set(0, START.y, 0.6));
    this.dust.burst(Math.round(600 * pw), this.tmp.set(0, 0, 0.5));
    this.darkDust.burst(Math.round(300 * pw), this.tmp.set(0, 0.3, 0.5));
    this.spraySpiral(Math.round(350 * pw), 14 * pw, this.settings.sphereSize * 1.2);
    // Launch the enemy backwards (away from the caster, toward -Z) with a tumble.
    this.evel.set((Math.random() - 0.5) * 2, 9 * pw, -19 * pw);
    this.espin = 7 * pw;
    this.enemy.group.position.set(0, 0, -0.3);
  }

  /** Simple ballistic knockback with a bounce, slide and settle. */
  private integrateEnemy(dt: number) {
    if (dt <= 0) return;
    const e = this.enemy.group;
    const v = this.evel;
    v.y -= GRAVITY * dt;
    e.position.addScaledVector(v, dt);
    if (e.position.y <= 0) {
      e.position.y = 0;
      if (v.y < -3) {
        v.y = -v.y * 0.35;
        v.x *= 0.7; v.z *= 0.7;
        this.espin *= 0.6;
        this.dust.burst(120, this.tmp.set(e.position.x, 0, e.position.z));
        this.shake = Math.max(this.shake, 0.3 * this.settings.power);
      } else {
        v.y = 0;
        const slide = Math.exp(-3 * dt);
        v.x *= slide; v.z *= slide;
        this.espin *= Math.exp(-4 * dt);
      }
    }
    e.rotation.x -= this.espin * dt;
    e.rotation.y += this.espin * 0.15 * dt;
    // Once the tumble has died down, settle onto the nearest flat or upright pose.
    if (Math.abs(this.espin) < 1.5) {
      const target = Math.round(e.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
      e.rotation.x += (target - e.rotation.x) * Math.min(1, 5 * dt);
    }
  }

  dispose() {
    this.streams.dispose();
    this.wind.dispose();
    this.sparkCloud.dispose();
    for (const e of this.emitters) e.dispose();
  }
}

export const spiralSphereModule: EffectModule = {
  label: 'spiral sphere',
  create: () => new SpiralSphere(),
  telegraphs(effect) {
    const s = (effect as SpiralSphere).settings;
    const contact = s.formTime + 0.6 + 0.35;
    return [
      // The thrust path, then the grinding burst at the enemy.
      { shape: { kind: 'line', x1: 0, z1: 7, x2: 0, z2: -1, width: 2.4 * s.sphereSize }, start: s.formTime * 0.5, impact: contact - 0.3 },
      { shape: { kind: 'circle', x: 0, z: 0, radius: 3.5 * s.sphereSize }, start: s.formTime, impact: contact, until: contact + 0.8 },
    ];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.45, threshold: 0.85 },
  frameCamera(camera, controls) {
    // Side view from +X: the sphere starts on screen-left (z = +7) and the knockback runs to the right (-Z).
    camera.position.set(30, 7, -1);
    controls.target.set(0, 1.5, -4);
  },
  buildGui(f, effect) {
    const sphere = effect as SpiralSphere;
    const ss = sphere.settings;
    f.add(ss, 'loop');
    f.add(ss, 'sphereSize', 0.4, 2.5, 0.01).name('sphere size');
    f.add(ss, 'ringCount', 1, MAX_RINGS, 1).name('ring count');
    f.add(ss, 'spinSpeed', 1, 20, 0.1).name('spin speed');
    f.add(ss, 'formTime', 0.5, 4, 0.05).name('form time');
    f.add(ss, 'power', 0.3, 2.5, 0.05);
    f.addColor(ss, 'coreColor').name('core color').onChange(() => sphere.applyStyle());
    f.addColor(ss, 'ringColor').name('ring color').onChange(() => sphere.applyStyle());
    f.addColor(ss, 'accentColor').name('accent color').onChange(() => sphere.applyStyle());
  },
};
