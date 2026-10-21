import * as THREE from 'three';
import { Emitter, defaultSettings } from '../emitter';
import { Enemy, GlowSphere, createGround, smoothstep, softDotTexture } from './common';
import type { Effect, EffectModule } from './types';

/**
 * "Energy beam" set piece: a caster 22 units in front of the enemy gathers light between cupped
 * hands (particles stream inward, arcs crackle, dust is stirred up), then fires a wave that
 * extends to the enemy, explodes on contact, scars the ground and finally crushes the target.
 */
export interface EnergyBeamSettings {
  chargeTime: number; // seconds of charging before the beam fires
  beamDuration: number; // seconds the beam holds once it has reached the enemy
  beamRadius: number; // radius of the middle beam layer
  distance: number; // caster to enemy = beam length
  ringCount: number; // rings travelling along the beam
  coreColor: string;
  beamColor: string;
  blastColor: string;
  loop: boolean;
}

export const defaultEnergyBeam = (): EnergyBeamSettings => ({
  chargeTime: 2,
  beamDuration: 1.8,
  beamRadius: 0.7,
  distance: 22,
  ringCount: 9,
  coreColor: '#ffffff',
  beamColor: '#4fb4ff',
  blastColor: '#ffa650',
  loop: false,
});

const EXTEND = 0.25; // seconds the beam takes to reach the enemy
const THIN = 0.5; // seconds the beam takes to thin out at the end
const AFTERMATH = 2.5; // seconds after the beam ends until everything has faded
const CASTER_Y = 1.5; // height of the cupped hands (and of the beam)
const CHARGE_POINTS = 900;
const SPIRAL_POINTS = 500;
const ARC_COUNT = 6;
const ARC_SEGMENTS = 8;
const SHOCK_RINGS = 3;
const SMOKE_RISE = 1.6; // seconds of rising smoke after the beam ends

const additive = {
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
} as const;

export class EnergyBeam implements Effect {
  readonly group = new THREE.Group();
  readonly settings: EnergyBeamSettings;
  /** Particle emitters owned by the effect (main needs them for pixel-scale updates). */
  readonly emitters: Emitter[] = [];
  /** Camera shake amount for this frame, in world units. */
  shake = 0;
  playing = false;

  private time = 0;
  private fired = false;
  private impacted = false;
  private acc = [0, 0, 0, 0, 0];
  private arcTimer = 0;

  private enemy = new Enemy();
  private flashLight = new THREE.PointLight(0xffe2a0, 0, 60, 1.5);
  private ballLight = new THREE.PointLight(0x7fc8ff, 0, 30, 1.5);
  private sphereGeo = new THREE.SphereGeometry(1, 24, 16);

  // Ball of light at the caster.
  private ball = new THREE.Group();
  private ballMat: THREE.MeshBasicMaterial;
  private ballCore: THREE.Mesh;
  private halo = new GlowSphere(0xffffff);

  // Charge stream (inward-moving points) and arcs.
  private chargePts: THREE.Points;
  private chargeMat: THREE.PointsMaterial;
  private chargePos = new Float32Array(CHARGE_POINTS * 3);
  private chargeDir = new Float32Array(CHARGE_POINTS * 3);
  private chargePhase = new Float32Array(CHARGE_POINTS);
  private chargeSpeed = new Float32Array(CHARGE_POINTS);
  private arcGroup = new THREE.Group();
  private arcs: THREE.Line[] = [];
  private arcMat: THREE.LineBasicMaterial;

  // Beam (local +Z = firing direction, origin at the ball).
  private beamGroup = new THREE.Group();
  private core: THREE.Mesh;
  private mid: THREE.Mesh;
  private outer: THREE.Mesh;
  private coreMat: THREE.MeshBasicMaterial;
  private midMat: THREE.MeshBasicMaterial;
  private outerMat: THREE.MeshBasicMaterial;
  private cap: THREE.Mesh;
  private capMat: THREE.MeshBasicMaterial;
  private ringGeo = new THREE.TorusGeometry(1, 0.05, 8, 40);
  private ringMat: THREE.MeshBasicMaterial;
  private rings: THREE.Mesh[] = [];
  private spiralPts: THREE.Points;
  private spiralMat: THREE.PointsMaterial;
  private spiralPos = new Float32Array(SPIRAL_POINTS * 3);
  private spiralPhase = new Float32Array(SPIRAL_POINTS);
  private spiralAngle = new Float32Array(SPIRAL_POINTS);
  private spiralRad = new Float32Array(SPIRAL_POINTS);
  private spiralSpeed = new Float32Array(SPIRAL_POINTS);

  // Contact.
  private scar: THREE.Mesh;
  private scarMat: THREE.MeshBasicMaterial;
  private expl = new GlowSphere(0xffffff);
  private explCore = new GlowSphere(0xffffff, { rim: false });
  private shocks: THREE.Mesh[] = [];
  private shockMat: THREE.MeshBasicMaterial;

  private sparks: Emitter;
  private dust: Emitter;
  private muzzle: Emitter;
  private smoke: Emitter;

  private caster = new THREE.Vector3();
  private target = new THREE.Vector3(0, CASTER_Y, 0);
  private groundHit = new THREE.Vector3(0, 0.2, 0);
  private groundCaster = new THREE.Vector3();

  constructor(settings: EnergyBeamSettings = defaultEnergyBeam()) {
    this.settings = settings;

    this.group.add(createGround());
    this.group.add(this.enemy.group);

    // Ball of light.
    this.ballMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.ballCore = new THREE.Mesh(this.sphereGeo, this.ballMat);
    this.halo.opacity = 0.3;
    this.ball.add(this.ballCore, this.halo.mesh, this.ballLight);
    this.group.add(this.ball);

    // Charge stream: points on a sphere around the ball that fly inward.
    for (let i = 0; i < CHARGE_POINTS; i++) {
      const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      this.chargeDir[i * 3] = r * Math.cos(a);
      this.chargeDir[i * 3 + 1] = z;
      this.chargeDir[i * 3 + 2] = r * Math.sin(a);
      this.chargePhase[i] = Math.random();
      this.chargeSpeed[i] = 0.55 + Math.random() * 0.6;
    }
    const chargeGeo = new THREE.BufferGeometry();
    chargeGeo.setAttribute('position', new THREE.BufferAttribute(this.chargePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.chargeMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.28, map: softDotTexture(), opacity: 0.45, ...additive,
    });
    this.chargePts = new THREE.Points(chargeGeo, this.chargeMat);
    this.chargePts.frustumCulled = false;
    this.group.add(this.chargePts);

    // Small arcs / flickers around the ball.
    this.arcMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.7, ...additive });
    for (let i = 0; i < ARC_COUNT; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_SEGMENTS * 3), 3));
      const line = new THREE.Line(geo, this.arcMat);
      line.frustumCulled = false;
      this.arcs.push(line);
      this.arcGroup.add(line);
    }
    this.group.add(this.arcGroup);

    // Beam layers: unit cylinders along local +Z, from z=0 to z=1.
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.midMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.3, ...additive });
    this.outerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.15, ...additive });
    this.core = new THREE.Mesh(cylGeo, this.coreMat);
    this.mid = new THREE.Mesh(cylGeo, this.midMat);
    this.outer = new THREE.Mesh(cylGeo, this.outerMat);
    this.capMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.cap = new THREE.Mesh(this.sphereGeo, this.capMat);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.4, side: THREE.DoubleSide, ...additive });
    this.beamGroup.add(this.outer, this.mid, this.core, this.cap);
    this.beamGroup.rotation.y = Math.PI; // local +Z -> world -Z (toward the enemy)
    this.group.add(this.beamGroup);
    this.buildRings();

    // Spiral particles along the beam (local coordinates).
    for (let i = 0; i < SPIRAL_POINTS; i++) {
      this.spiralPhase[i] = Math.random();
      this.spiralAngle[i] = Math.random() * Math.PI * 2;
      this.spiralRad[i] = Math.random();
      this.spiralSpeed[i] = 0.5 + Math.random() * 0.9;
    }
    const spiralGeo = new THREE.BufferGeometry();
    spiralGeo.setAttribute('position', new THREE.BufferAttribute(this.spiralPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.spiralMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.22, map: softDotTexture(), opacity: 0.45, ...additive,
    });
    this.spiralPts = new THREE.Points(spiralGeo, this.spiralMat);
    this.spiralPts.frustumCulled = false;
    this.beamGroup.add(this.spiralPts);

    // Ground scar along the beam path.
    this.scarMat = new THREE.MeshBasicMaterial({
      color: 0x050506, transparent: true, opacity: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    this.scar = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.scarMat);
    this.scar.position.y = 0.02;
    this.group.add(this.scar);

    // Explosion dome + hot core, ground shockwaves.
    this.expl.mesh.position.set(0, 1.2, 0);
    this.explCore.mesh.position.set(0, 1.4, 0);
    this.group.add(this.expl.mesh, this.explCore.mesh);

    this.shockMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, side: THREE.DoubleSide, ...additive });
    const shockGeo = new THREE.RingGeometry(0.85, 1, 96);
    for (let i = 0; i < SHOCK_RINGS; i++) {
      // Each ring needs its own opacity, so clone the material per ring.
      const m = new THREE.Mesh(shockGeo, this.shockMat.clone());
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.05;
      this.shocks.push(m);
      this.group.add(m);
    }

    this.group.add(this.flashLight);
    this.flashLight.position.set(0, 2.5, 1);

    // Particles: impact sparks, dust (charge ring + impact), muzzle motes.
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 1.4, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 15, speedJitter: 0.6, spread: 180, gravity: 16, drag: 0.7,
      sizeStart: 0.2, sizeEnd: 0.04, colorStart: '#fff4d8', colorEnd: '#ffa650',
      opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 3, lifetimeJitter: 0.3,
      shape: 'cone', shapeSize: 3, speed: 6, speedJitter: 0.4, spread: 85,
      gravity: -0.2, drag: 1.6, sizeStart: 1.6, sizeEnd: 6, colorStart: '#8a7f70', colorEnd: '#3a3a40',
      colorMid: '#6a6258', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
      opacityStart: 0.35, opacityEnd: 0, additive: false,
    });
    // Dark smoke column rising from the impact once the beam is gone.
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 3, lifetimeJitter: 0.35,
      shape: 'sphere', shapeSize: 0.8, originY: 0.3, speed: 2.8, speedJitter: 0.5, spread: 22,
      gravity: -0.6, drag: 1.0, sizeStart: 1.0, sizeEnd: 4.5, colorStart: '#3a3633', colorEnd: '#0e0e10',
      colorMid: '#24211f', sizeJitter: 0.45, erosion: 0.6, spin: 0.4,
      opacityStart: 0.4, opacityEnd: 0, additive: false,
    });
    this.muzzle = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 6, speedJitter: 0.5, spread: 180, gravity: 0, drag: 1.5,
      sizeStart: 0.3, sizeEnd: 0, colorStart: '#ffffff', colorEnd: '#4fb4ff',
      opacityStart: 0.45, opacityEnd: 0, additive: true,
    });
    this.emitters.push(this.sparks, this.dust, this.muzzle, this.smoke);
    for (const e of this.emitters) this.group.add(e.points);

    this.applyStyle();
    this.reset();
  }

  /** Recreates the travelling rings (call after changing ringCount). */
  buildRings() {
    for (const r of this.rings) this.beamGroup.remove(r);
    this.rings = [];
    const n = Math.max(0, Math.floor(this.settings.ringCount));
    for (let i = 0; i < n; i++) {
      const r = new THREE.Mesh(this.ringGeo, this.ringMat);
      this.rings.push(r);
      this.beamGroup.add(r);
    }
  }

  /** Applies colour changes from the settings. */
  applyStyle() {
    const s = this.settings;
    const core = new THREE.Color(s.coreColor).multiplyScalar(1.4);
    const beam = new THREE.Color(s.beamColor);
    const blast = new THREE.Color(s.blastColor);
    this.coreMat.color.copy(core);
    this.ballMat.color.copy(core);
    this.capMat.color.copy(core);
    this.midMat.color.copy(beam);
    this.outerMat.color.copy(beam);
    this.halo.color.copy(beam);
    this.ringMat.color.copy(beam).lerp(new THREE.Color(1, 1, 1), 0.3);
    this.chargeMat.color.copy(beam).lerp(new THREE.Color(1, 1, 1), 0.45);
    this.spiralMat.color.copy(beam).lerp(new THREE.Color(1, 1, 1), 0.35);
    this.arcMat.color.copy(beam).lerp(new THREE.Color(1, 1, 1), 0.5);
    this.ballLight.color.copy(beam).lerp(new THREE.Color(1, 1, 1), 0.3);
    this.expl.color.copy(blast);
    this.explCore.color.copy(blast).lerp(new THREE.Color(1, 1, 1), 0.5);
    for (const m of this.shocks) (m.material as THREE.MeshBasicMaterial).color.copy(blast).multiplyScalar(1.4);
    this.sparks.settings.colorEnd = s.blastColor;
    this.sparks.applyStyle();
    this.muzzle.settings.colorEnd = s.beamColor;
    this.muzzle.applyStyle();
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.fired = false;
    this.impacted = false;
    this.shake = 0;
    this.acc.fill(0);
    this.arcTimer = 0;
    for (const e of this.emitters) e.clear();
    this.enemy.reset();
    this.flashLight.intensity = 0;
    this.expl.opacity = 0;
    this.explCore.opacity = 0;
    this.scarMat.opacity = 0;
    for (const m of this.shocks) (m.material as THREE.MeshBasicMaterial).opacity = 0;
    this.layout(0);
  }

  get duration() {
    const s = this.settings;
    return s.chargeTime + EXTEND + s.beamDuration + AFTERMATH;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;

    const s = this.settings;
    this.time += dt;

    if (this.time >= this.duration) {
      if (s.loop) this.play();
      else {
        this.playing = false;
        this.layout(dt);
        return;
      }
    }

    if (!this.fired && this.time >= s.chargeTime) {
      this.fired = true;
      this.muzzle.burst(250, this.caster);
    }
    if (!this.impacted && this.time >= s.chargeTime + EXTEND) {
      this.impacted = true;
      this.sparks.burst(1000, this.target);
      this.dust.burst(350, this.groundHit);
    }
    this.layout(dt);
  }

  /** Spawns particles at a steady rate; `slot` picks the fractional-remainder accumulator. */
  private stream(slot: number, em: Emitter, rate: number, dt: number, at: THREE.Vector3) {
    this.acc[slot] += rate * dt;
    const n = Math.floor(this.acc[slot]);
    this.acc[slot] -= n;
    if (n > 0) em.burst(n, at);
  }

  /** Positions everything for the current time. */
  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const R = s.beamRadius;
    const fire = s.chargeTime;
    const tHit = fire + EXTEND;
    const beamEnd = tHit + s.beamDuration;
    const end = this.duration;

    this.caster.set(0, CASTER_Y, s.distance);
    this.groundCaster.set(0, 0.2, s.distance);
    this.target.set(0, CASTER_Y, 0);

    const c = smoothstep(t / Math.max(0.01, fire)); // charge 0..1
    const front = smoothstep((t - fire) / EXTEND);
    const L = s.distance * front;
    const thin = 1 - smoothstep((t - (beamEnd - THIN)) / THIN);
    const w = t >= fire ? smoothstep((t - fire) / 0.08) * thin : 0; // beam radius multiplier
    const beamOn = w > 0.002 && L > 0.01;
    const after = t - tHit; // time since contact

    // --- Ball of light ---------------------------------------------------------
    const ballMax = Math.max(0.8, R * 1.5);
    let ballR = THREE.MathUtils.lerp(0.12, ballMax, c);
    if (t >= fire) {
      ballR = ballMax * (1 + 0.1 * Math.sin(t * 50)) * (0.4 + 0.6 * thin) * (1 + 0.35 * Math.exp(-(t - fire) * 8));
    }
    this.ball.position.copy(this.caster);
    this.ball.visible = t < beamEnd;
    this.ballCore.scale.setScalar(ballR);
    this.halo.mesh.scale.setScalar(ballR * (1.8 + 0.25 * Math.sin(t * 31)));
    this.ballLight.intensity = t < fire ? 30 * c * c : 45 * w;

    // --- Charge stream + arcs --------------------------------------------------
    const streamOn = t < fire + 0.5;
    this.chargePts.visible = streamOn;
    if (streamOn) {
      this.chargeMat.opacity = 0.45 * (1 - smoothstep((t - (fire - 0.1)) / 0.6));
      this.chargePts.geometry.setDrawRange(0, Math.floor(CHARGE_POINTS * smoothstep(t / (fire * 0.35 + 0.01))));
      const rMax = 6 + R * 2;
      const tt = Math.min(t, fire + 0.5);
      for (let i = 0; i < CHARGE_POINTS; i++) {
        const p = (this.chargePhase[i] + tt * this.chargeSpeed[i]) % 1;
        const r = ballR * 1.1 + (rMax - ballR) * Math.pow(1 - p, 1.4);
        const j = i * 3;
        this.chargePos[j] = this.caster.x + this.chargeDir[j] * r;
        this.chargePos[j + 1] = this.caster.y + this.chargeDir[j + 1] * r;
        this.chargePos[j + 2] = this.caster.z + this.chargeDir[j + 2] * r;
      }
      this.chargePts.geometry.attributes.position.needsUpdate = true;
    }

    const arcLevel = t < fire ? c : t < beamEnd ? 0.5 * w : 0;
    this.arcGroup.position.copy(this.caster);
    this.arcGroup.visible = arcLevel > 0.02;
    this.arcTimer -= dt;
    if (this.arcGroup.visible && this.arcTimer <= 0) {
      this.arcTimer = 0.05;
      this.flickerArcs(ballR, arcLevel);
    }

    // --- Ground dust ring beneath the caster ----------------------------------
    if (this.playing && t < fire + 0.6) this.stream(0, this.dust, 70 * c, dt, this.groundCaster);

    // --- Beam ------------------------------------------------------------------
    this.beamGroup.position.copy(this.caster);
    this.beamGroup.visible = beamOn;
    if (beamOn) {
      const wob = (rate: number, ph: number, amp: number) => 1 + amp * Math.sin(t * rate + ph);
      const rc = R * 0.35 * w * wob(55, 0, 0.06);
      const rm = R * w * (wob(23, 1, 0.12) + 0.05 * Math.sin(t * 61));
      const ro = R * 1.8 * w * wob(17, 2, 0.18);
      this.core.scale.set(rc, rc, L);
      this.mid.scale.set(rm, rm, L);
      this.outer.scale.set(ro, ro, L);
      this.cap.scale.setScalar(R * 1.25 * w * wob(40, 0, 0.1));
      this.cap.position.z = L;

      const ringR = R * 1.4 * w;
      const n = this.rings.length;
      for (let i = 0; i < n; i++) {
        const ring = this.rings[i];
        ring.position.z = ((i / n + t * 0.9) % 1) * L;
        ring.scale.setScalar(ringR * (1 + 0.1 * Math.sin(t * 20 + i)));
      }

      this.spiralMat.opacity = 0.45 * w;
      const sr = R * w;
      for (let i = 0; i < SPIRAL_POINTS; i++) {
        const zf = ((this.spiralPhase[i] + t * this.spiralSpeed[i]) % 1) * L;
        const ang = this.spiralAngle[i] + zf * 0.9 + t * 7;
        const r = sr * (1.15 + 1.1 * this.spiralRad[i]);
        const j = i * 3;
        this.spiralPos[j] = Math.cos(ang) * r;
        this.spiralPos[j + 1] = Math.sin(ang) * r;
        this.spiralPos[j + 2] = zf;
      }
      this.spiralPts.geometry.attributes.position.needsUpdate = true;
    }

    // Muzzle flare: extra motes at the ball while firing.
    if (this.playing && t >= fire && t < beamEnd) this.stream(1, this.muzzle, 150 * w, dt, this.caster);

    // --- Ground scar -----------------------------------------------------------
    const scarLen = Math.max(0.001, L);
    this.scar.visible = t >= fire;
    this.scar.scale.set(R * 3.2, 1, scarLen);
    this.scar.position.z = s.distance - scarLen / 2;
    this.scarMat.opacity = 0.75 * smoothstep((t - fire) / 0.4) * (1 - smoothstep((t - (end - 1.2)) / 1.2));

    // --- Contact ---------------------------------------------------------------
    this.shake = 0;
    if (t < fire) {
      this.shake = 0.03 + 0.2 * c * c; // rising rumble
      this.flashLight.intensity = 0;
    } else {
      this.shake = 0.2 * w;
    }

    if (this.impacted) {
      const explR = 2.5 + 2.5 * R;
      const rise = smoothstep(after / 0.1);
      const linger = 1 - smoothstep((t - beamEnd) / (AFTERMATH * 0.8));
      const flick = 1 + 0.08 * Math.sin(t * 37);
      this.expl.mesh.scale.setScalar((explR * (1 - Math.exp(-after * 4)) + after * 0.3) * flick * (0.85 + 0.15 * linger));
      // Rim-lit shell keeps the dome from reading as a solid wall; it still fades early.
      this.expl.opacity = 0.28 * rise * linger * (0.4 + 0.6 * Math.exp(-after * 0.8));
      this.explCore.mesh.scale.setScalar(explR * 0.55 * (1 - Math.exp(-after * 6)) * flick);
      this.explCore.opacity = 0.4 * rise * Math.exp(-after * 1.2) * linger;

      for (let i = 0; i < SHOCK_RINGS; i++) {
        const wave = (after - i * 0.18) / 1.1;
        const m = this.shocks[i];
        const mat = m.material as THREE.MeshBasicMaterial;
        m.visible = wave > 0 && wave < 1;
        if (m.visible) {
          m.scale.setScalar(1 + wave * 22);
          mat.opacity = (1 - wave) * 0.5;
        }
      }

      this.flashLight.intensity = 400 * Math.exp(-after * 6) + (t < beamEnd ? 30 * w : 0);
      this.shake += 0.9 * Math.exp(-after * 2.5);

      // Steady sparks and dust at the point of impact while the beam holds.
      if (this.playing && t < beamEnd) {
        this.stream(2, this.sparks, 150 * w, dt, this.target);
        this.stream(3, this.dust, 20 * w, dt, this.groundHit);
      }

      // Dark smoke rises from the impact after the beam ends.
      if (this.playing && t >= beamEnd && t < beamEnd + SMOKE_RISE) {
        this.stream(4, this.smoke, 90 * (1 - (t - beamEnd) / SMOKE_RISE), dt, this.groundHit);
      }

      // Enemy: white-hot flash under the beam, crushed once it ends.
      const flash = t < beamEnd
        ? 0.15 + 0.85 * Math.exp(-after * 5) + 0.05 * Math.random()
        : 0.15 * Math.exp(-(t - beamEnd) * 6);
      this.enemy.setFlash(flash);
      this.enemy.setCrush(smoothstep((t - beamEnd) / 0.35));
    } else {
      this.expl.opacity = 0;
      this.explCore.opacity = 0;
      for (const m of this.shocks) m.visible = false;
    }
  }

  /** Re-randomises the small lightning arcs around the ball. */
  private flickerArcs(ballR: number, level: number) {
    const shown = Math.ceil(ARC_COUNT * level);
    for (let a = 0; a < ARC_COUNT; a++) {
      const line = this.arcs[a];
      line.visible = a < shown;
      if (!line.visible) continue;
      const z = Math.random() * 2 - 1, ang = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - z * z);
      const dx = rr * Math.cos(ang), dy = z, dz = rr * Math.sin(ang);
      const len = ballR * (1.1 + Math.random() * 1.6) + 0.3;
      const pos = line.geometry.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < ARC_SEGMENTS; k++) {
        const f = (k / (ARC_SEGMENTS - 1)) * len;
        const jit = k === 0 ? 0 : len * 0.07;
        pos.setXYZ(
          k,
          dx * f + (Math.random() - 0.5) * jit * 2,
          dy * f + (Math.random() - 0.5) * jit * 2,
          dz * f + (Math.random() - 0.5) * jit * 2,
        );
      }
      pos.needsUpdate = true;
    }
  }

  dispose() {
    this.sphereGeo.dispose();
    this.ringGeo.dispose();
    for (const e of this.emitters) e.dispose();
  }
}

export const energyBeamModule: EffectModule = {
  label: 'energy beam',
  create: () => new EnergyBeam(),
  telegraphs(effect) {
    const s = (effect as EnergyBeam).settings;
    const fire = s.chargeTime + 0.25;
    return [
      { shape: { kind: 'line', x1: 0, z1: s.distance, x2: 0, z2: -1, width: s.beamRadius * 3.5 }, start: 0.3, impact: fire, until: fire + s.beamDuration },
      { shape: { kind: 'circle', x: 0, z: 0, radius: 2.5 + 2.5 * s.beamRadius }, start: 0.3, impact: fire, until: fire + s.beamDuration },
    ];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const d = (effect as EnergyBeam).settings.distance;
    // Side view from +X (caster screen-left, enemy screen-right), pulled back so the explosion dome fits
    // and centred a little toward the enemy so it isn't hidden behind the panel.
    camera.position.set(Math.max(30, d * 1.9), Math.max(6, d * 0.35), d * 0.4);
    controls.target.set(0, 3, d * 0.36);
  },
  buildGui(f, effect) {
    const beam = effect as EnergyBeam;
    const bs = beam.settings;
    f.add(bs, 'loop');
    f.add(bs, 'chargeTime', 0.5, 5, 0.05).name('charge time');
    f.add(bs, 'beamDuration', 0.5, 5, 0.05).name('beam duration');
    f.add(bs, 'beamRadius', 0.2, 3, 0.01).name('beam radius');
    f.add(bs, 'distance', 8, 40, 0.5).name('beam length');
    f.add(bs, 'ringCount', 0, 24, 1).name('ring count').onFinishChange(() => beam.buildRings());
    f.addColor(bs, 'coreColor').name('core color').onChange(() => beam.applyStyle());
    f.addColor(bs, 'beamColor').name('beam color').onChange(() => beam.applyStyle());
    f.addColor(bs, 'blastColor').name('blast color').onChange(() => beam.applyStyle());
  },
};
