import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Earthquake (reworked): the caster drives a rune totem into the ground, a glowing fissure races to the enemy
 * and a huge circle around it ruptures. Cracks web outward, brown rock slabs heave up and down in a rolling
 * wave, pebbles bounce, dust columns rise, the camera shakes in pulses and the enemy is thrown over.
 */
export interface EarthquakeSettings {
  radius: number; // radius of the ruptured area
  quakeTime: number; // seconds of sustained quake after the first hit
  slabHeight: number; // how far the slabs jut up
  shakeStrength: number;
  color: string; // rune colour (the second rune colour is always amber)
  loop: boolean;
}

export const defaultEarthquake = (): EarthquakeSettings => ({
  radius: 7,
  quakeTime: 3,
  slabHeight: 1,
  shakeStrength: 1,
  color: '#7bd83a',
  loop: false,
});

const SLAM = 0.7; // totem hits the ground
const HIT = 1.2; // the fissure reaches the enemy: quake starts
const FADE = 0.9;
const BASE_RADIUS = 7; // geometry is generated for this radius and scaled
const FRONT_SPEED = 13; // how fast the rupture spreads outward
const SLAB_H = 1.8;
const PULSES = [{ t: 0, s: 0.8 }, { t: 0.9, s: 1 }, { t: 1.8, s: 0.6 }, { t: 2.6, s: 0.8 }];
const KNOCK_AT = 0.9; // the enemy goes over on the second (biggest) pulse
const SLAB_COUNT = 150;
const PEBBLES = 110;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CrackSeg { x: number; z: number; a: number; len: number; w: number; d: number }

/** Jagged crack web: radial arms of connected segments with short branches. Direction of angle a = (cos a, -sin a). */
function buildCracks(): CrackSeg[] {
  const rand = rng(7);
  const segs: CrackSeg[] = [];
  const width = (d: number) => 0.08 + 0.2 * Math.max(0, 1 - d / (BASE_RADIUS * 1.6));
  const arms = 16;
  for (let i = 0; i < arms; i++) {
    let a = (i / arms) * Math.PI * 2 + (rand() - 0.5) * 0.3;
    let x = Math.cos(a) * 0.7, z = -Math.sin(a) * 0.7, d = 0.7;
    while (d < BASE_RADIUS * 1.1 && segs.length < 168) {
      const len = 0.9 + rand() * 0.8;
      segs.push({ x, z, a, len, w: width(d), d });
      if (d > 1.5 && rand() < 0.45 && segs.length < 164) {
        const ba = a + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.5);
        const bl = 0.8 + rand() * 0.7;
        segs.push({ x: x + Math.cos(a) * len, z: z - Math.sin(a) * len, a: ba, len: bl, w: width(d) * 0.7, d: d + len });
      }
      x += Math.cos(a) * len; z -= Math.sin(a) * len; d += len;
      a += (rand() - 0.5) * 0.6;
    }
  }
  return segs;
}

interface Slab { x: number; z: number; r: number; w: number; dp: number; amp: number; phase: number; rot: number }

function buildSlabs(): Slab[] {
  const rand = rng(21);
  const slabs: Slab[] = [];
  for (let i = 0; i < SLAB_COUNT; i++) {
    const r = Math.sqrt(1.4 * 1.4 + rand() * (BASE_RADIUS * BASE_RADIUS - 1.4 * 1.4)); // area-uniform, clear of the enemy
    const a = rand() * Math.PI * 2;
    slabs.push({
      x: Math.cos(a) * r, z: Math.sin(a) * r, r,
      w: 0.9 + rand() * 1.0, dp: 0.9 + rand() * 1.0, amp: 0.5 + rand() * 0.9, phase: rand() * 6.28, rot: rand() * 3.14,
    });
  }
  return slabs;
}

export class Earthquake implements Effect {
  readonly group = new THREE.Group();
  readonly settings: EarthquakeSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private pulseIdx = 0;
  private columnAcc = 0;
  private sparkAcc = 0;
  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();

  private caster = createCaster();
  private enemy = new Enemy();
  private totemMat = new THREE.MeshStandardMaterial({
    color: 0x6a5538, roughness: 0.8, emissive: 0x7bd83a, emissiveIntensity: 0.5,
  });
  private totem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.08, 1.8, 6), this.totemMat);
  private fissureMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private fissure = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.fissureMat);

  private runeOuter = createRing(0x7bd83a, 0.95, 1, 64);
  private runeHex = createRing(0xffa832, 0.8, 0.84, 6);
  private runeSquare = createRing(0x7bd83a, 0.6, 0.63, 4);
  private runeInner = createRing(0xffa832, 0.36, 0.4, 64);

  private segs = buildCracks();
  private crackGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private crackDarkMat = new THREE.MeshBasicMaterial({
    color: 0x070504, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  private crackGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.crackGlowMat, this.segs.length);
  private crackDark = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.crackDarkMat, this.segs.length);

  private slabs = buildSlabs();
  private slabMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 }), this.slabs.length,
  );

  private pebbleMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8a6a46, roughness: 0.9 }), PEBBLES,
  );
  private pebBase = new Float32Array(PEBBLES * 2); // unscaled x/z where each pebble lies
  private pebSize = new Float32Array(PEBBLES);
  private pebPos = new Float32Array(PEBBLES * 3);
  private pebVel = new Float32Array(PEBBLES * 3);
  private pebRot = new Float32Array(PEBBLES * 3);
  private pebSpin = new Float32Array(PEBBLES * 3);
  private pebLive = new Uint8Array(PEBBLES);

  private dust: Emitter;
  private sparks: Emitter;

  constructor(settings: EarthquakeSettings = defaultEarthquake()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.totem, this.fissure);
    this.group.add(this.runeOuter.mesh, this.runeHex.mesh, this.runeSquare.mesh, this.runeInner.mesh);
    this.group.add(this.crackGlow, this.crackDark, this.slabMesh, this.pebbleMesh);
    this.fissure.rotation.x = -Math.PI / 2;
    this.fissure.position.y = 0.05;
    this.crackGlow.position.y = 0.05;
    this.crackDark.position.y = 0.07;
    for (const m of [this.crackGlow, this.crackDark, this.slabMesh, this.pebbleMesh]) m.frustumCulled = false;
    this.fissureMat.color.setRGB(1.4, 0.6, 0.1);

    const rand = rng(99);
    for (let i = 0; i < this.slabs.length; i++) {
      // Dark earth tones. setHSL defaults to the linear working space (l = 0.35 displays as pale cardboard),
      // so give the values in sRGB.
      this.tmpColor.setHSL(0.07 + rand() * 0.03, 0.35, 0.18 + rand() * 0.1, THREE.SRGBColorSpace);
      this.slabMesh.setColorAt(i, this.tmpColor);
    }
    for (let i = 0; i < PEBBLES; i++) {
      const r = 0.8 + Math.sqrt(rand()) * (BASE_RADIUS - 0.8), a = rand() * Math.PI * 2;
      this.pebBase[i * 2] = Math.cos(a) * r; this.pebBase[i * 2 + 1] = Math.sin(a) * r;
      this.pebSize[i] = 0.1 + rand() * 0.18;
    }

    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1800, rate: 0, lifetime: 1.5, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 0.45, speed: 3.5, speedJitter: 0.4, spread: 10, gravity: -0.4, drag: 0.8,
      sizeStart: 0.7, sizeEnd: 1.8, colorStart: '#8a7358', colorEnd: '#5a4a3a',
      opacityStart: 0.5, opacityEnd: 0, additive: false,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 6, speedJitter: 0.6, spread: 40, gravity: 9, drag: 0.6,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#e9ff9a', colorEnd: '#ff7a1a',
      opacityStart: 0.8, opacityEnd: 0, additive: true,
    });
    this.emitters.push(this.dust, this.sparks);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.runeOuter.material.color.set(c);
    this.runeSquare.material.color.set(c);
    this.totemMat.emissive.set(c);
  }

  get duration() {
    return HIT + this.settings.quakeTime + FADE;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.pulseIdx = 0;
    this.columnAcc = 0;
    this.sparkAcc = 0;
    this.shake = 0;
    this.pebLive.fill(0);
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const s = this.settings;
    const after = this.time - HIT;
    const env = this.quakeEnv(after);

    while (this.pulseIdx < PULSES.length && after >= PULSES[this.pulseIdx].t) {
      if (PULSES[this.pulseIdx].t < s.quakeTime) this.onPulse(PULSES[this.pulseIdx].s);
      this.pulseIdx++;
    }
    if (env > 0.05) {
      // Dust columns and embers keep coming through the whole quake.
      this.columnAcc += dt * 18 * env;
      while (this.columnAcc >= 1) { this.columnAcc -= 1; this.dust.burst(9, this.randomSpot()); }
      this.sparkAcc += dt * 30 * env;
      while (this.sparkAcc >= 1) { this.sparkAcc -= 1; this.sparks.burst(2, this.randomSpot()); }
    }
    this.stepPebbles(dt, after, env);
    this.layout();
    if (!this.playing) this.shake = 0;
  }

  private quakeEnv(after: number) {
    if (after < 0) return 0;
    return smoothstep(after / 0.2) * (1 - smoothstep((after - this.settings.quakeTime) / FADE));
  }

  private randomSpot() {
    const r = 1.2 + Math.sqrt(Math.random()) * (this.settings.radius - 1.2), a = Math.random() * Math.PI * 2;
    return new THREE.Vector3(ENEMY_POS.x + Math.cos(a) * r, 0, ENEMY_POS.z + Math.sin(a) * r);
  }

  private onPulse(strength: number) {
    const R = this.settings.radius;
    const cols = Math.round(10 * strength);
    for (let i = 0; i < cols; i++) {
      const a = (i / cols) * Math.PI * 2 + Math.random();
      const r = R * (0.5 + 0.5 * Math.random());
      this.dust.burst(12, new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    this.sparks.burst(Math.round(160 * strength), new THREE.Vector3(0, 0.2, 0));
    for (let i = 0; i < PEBBLES; i++) {
      if (this.pebLive[i] && this.pebPos[i * 3 + 1] < this.pebSize[i] + 0.1) this.pebVel[i * 3 + 1] = strength * (4 + Math.random() * 6);
    }
  }

  private stepPebbles(dt: number, after: number, env: number) {
    const k = this.settings.radius / BASE_RADIUS;
    for (let i = 0; i < PEBBLES; i++) {
      const j = i * 3;
      if (!this.pebLive[i]) {
        const bx = this.pebBase[i * 2] * k, bz = this.pebBase[i * 2 + 1] * k;
        if (after < Math.hypot(bx, bz) / FRONT_SPEED) continue; // the wave has not arrived yet
        this.pebLive[i] = 1;
        this.pebPos[j] = bx; this.pebPos[j + 1] = this.pebSize[i]; this.pebPos[j + 2] = bz;
        this.pebVel[j] = (Math.random() - 0.5) * 2; this.pebVel[j + 1] = 4 + Math.random() * 7; this.pebVel[j + 2] = (Math.random() - 0.5) * 2;
        for (let c = 0; c < 3; c++) this.pebSpin[j + c] = (Math.random() - 0.5) * 12;
      }
      this.pebVel[j + 1] -= 26 * dt;
      for (let c = 0; c < 3; c++) { this.pebPos[j + c] += this.pebVel[j + c] * dt; this.pebRot[j + c] += this.pebSpin[j + c] * dt; }
      if (this.pebPos[j + 1] < this.pebSize[i]) {
        this.pebPos[j + 1] = this.pebSize[i];
        if (this.pebVel[j + 1] < -1.5) {
          this.pebVel[j + 1] = -this.pebVel[j + 1] * 0.5;
          this.pebVel[j] *= 0.8; this.pebVel[j + 2] *= 0.8;
        } else {
          this.pebVel[j + 1] = 0; this.pebVel[j] *= 0.9; this.pebVel[j + 2] *= 0.9;
          for (let c = 0; c < 3; c++) this.pebSpin[j + c] *= 0.8;
          if (env > 0.2 && Math.random() < dt * 0.9) this.pebVel[j + 1] = 3 + Math.random() * 5; // shaken loose again
        }
      }
    }
  }

  private pulseAmount(after: number) {
    let v = 0;
    for (const p of PULSES) if (p.t < this.settings.quakeTime && after >= p.t) v += p.s * Math.exp(-(after - p.t) * 5);
    return v;
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const after = t - HIT;
    const k = s.radius / BASE_RADIUS;
    const env = this.quakeEnv(after);
    const fade = 1 - smoothstep((t - (this.duration - 1.2)) / 1.2);
    const pulse = this.pulseAmount(after);
    const d = this.dummy;

    // Caster: crouches, drives the totem into the ground, springs back up.
    const crouch = smoothstep(t / 0.5) * (1 - smoothstep((t - SLAM - 0.05) / 0.4));
    this.caster.group.scale.set(1 + 0.1 * crouch, 1 - 0.32 * crouch, 1 + 0.1 * crouch);
    const drop = smoothstep((t - 0.3) / (SLAM - 0.3));
    const sink = smoothstep((t - 1.6) / 0.8);
    const tipY = t < SLAM ? 3 - 3.2 * drop : -0.2 - 1.6 * sink;
    this.totem.position.set(0.7, tipY + 0.9, CASTER_POS.z - 0.8);
    this.totem.visible = t > 0.3 && sink < 1;
    this.totemMat.emissiveIntensity = 0.5 + 1.5 * (t >= SLAM ? Math.exp(-(t - SLAM) * 3) : 0);

    // Fissure runs from the caster's feet to the enemy.
    const run = 14 * smoothstep((t - SLAM) / (HIT - SLAM));
    this.fissure.scale.set(0.45, Math.max(0.001, run), 1);
    this.fissure.position.z = CASTER_POS.z - 0.8 - run / 2;
    this.fissureMat.opacity = t < SLAM ? 0 : 0.4 * (t < HIT ? 1 : Math.exp(-after * 2));

    // Rune circle: locks in at the hit, spins, flares on every pulse.
    const lock = smoothstep(after / 0.5);
    const R = s.radius * (0.7 + 0.3 * lock);
    const runeOp = Math.min(0.55, 0.45 * smoothstep(after / 0.3) * (1 + 0.3 * pulse)) * fade;
    this.runeOuter.mesh.scale.setScalar(R);
    this.runeHex.mesh.scale.setScalar(R);
    this.runeSquare.mesh.scale.setScalar(R);
    this.runeInner.mesh.scale.setScalar(R);
    this.runeHex.mesh.rotation.z = t * 0.9;
    this.runeSquare.mesh.rotation.z = -t * 1.3;
    this.runeInner.mesh.rotation.z = t * 2;
    this.runeOuter.material.opacity = runeOp;
    this.runeHex.material.opacity = runeOp;
    this.runeSquare.material.opacity = runeOp * 0.9;
    this.runeInner.material.opacity = runeOp * 0.8;

    // Cracks spread outward; glow flickers between amber and green.
    const front = Math.max(0, after) * FRONT_SPEED;
    for (let i = 0; i < this.segs.length; i++) {
      const sg = this.segs[i];
      const prog = THREE.MathUtils.clamp((front - sg.d * k) / (sg.len * k), 0, 1);
      const len = sg.len * k * prog;
      const cx = (sg.x * k + Math.cos(sg.a) * len / 2) + ENEMY_POS.x;
      const cz = (sg.z * k - Math.sin(sg.a) * len / 2) + ENEMY_POS.z;
      d.rotation.order = 'YXZ';
      d.rotation.set(-Math.PI / 2, sg.a, 0);
      d.position.set(cx, 0, cz);
      d.scale.set(Math.max(0.0001, len), sg.w + 0.34, 1);
      d.updateMatrix();
      this.crackGlow.setMatrixAt(i, d.matrix);
      d.scale.set(Math.max(0.0001, len), sg.w, 1);
      d.updateMatrix();
      this.crackDark.setMatrixAt(i, d.matrix);
    }
    this.crackGlow.instanceMatrix.needsUpdate = true;
    this.crackDark.instanceMatrix.needsUpdate = true;
    const mix = 0.5 + 0.5 * Math.sin(t * 3);
    this.crackGlowMat.color.setRGB(1.5 - 1 * mix, 0.7 + 0.8 * mix, 0.1 + 0.1 * mix);
    this.crackGlowMat.opacity = Math.min(0.5, 0.22 + 0.2 * pulse + 0.15 * Math.exp(-Math.max(0, after) * 0.8)) * fade * (after > 0 ? 1 : 0);
    this.crackDarkMat.opacity = 0.9 * fade * (after > 0 ? 1 : 0);

    // Slabs heave in a rolling wave that travels outward, up above the ground and down below it.
    for (let i = 0; i < this.slabs.length; i++) {
      const sl = this.slabs[i];
      const r = sl.r * k;
      const local = after - r / FRONT_SPEED;
      let top = -0.3, tilt = 0;
      if (local > 0) {
        const e = smoothstep(local / 0.25) * env;
        top = -0.05 + sl.amp * s.slabHeight * e * Math.sin(local * 7.5 - r * 0.9 + sl.phase);
        tilt = 0.18 * e * Math.sin(local * 5 + sl.phase);
      }
      d.rotation.order = 'XYZ';
      d.rotation.set(tilt, sl.rot, -tilt * 0.8);
      d.position.set(sl.x * k + ENEMY_POS.x, top - SLAB_H / 2, sl.z * k + ENEMY_POS.z);
      d.scale.set(sl.w, SLAB_H, sl.dp);
      d.updateMatrix();
      this.slabMesh.setMatrixAt(i, d.matrix);
    }
    this.slabMesh.instanceMatrix.needsUpdate = true;

    // Pebbles (simulated in update).
    d.rotation.order = 'XYZ';
    for (let i = 0; i < PEBBLES; i++) {
      const j = i * 3;
      if (!this.pebLive[i]) d.scale.setScalar(0);
      else d.scale.setScalar(this.pebSize[i] * Math.max(0.001, fade));
      d.position.set(this.pebPos[j], this.pebPos[j + 1], this.pebPos[j + 2]);
      d.rotation.set(this.pebRot[j], this.pebRot[j + 1], this.pebRot[j + 2]);
      d.updateMatrix();
      this.pebbleMesh.setMatrixAt(i, d.matrix);
    }
    this.pebbleMesh.instanceMatrix.needsUpdate = true;

    // Enemy: rattled by every pulse, then thrown over on the big one.
    this.enemy.setFlash(1.1 * pulse);
    const knock = smoothstep((after - KNOCK_AT) / 0.35);
    const recover = smoothstep((t - (this.duration - 1.0)) / 0.8);
    const wobble = 0.1 * Math.sin(t * 14) * env * (1 - knock);
    const tilt = (1.35 * knock) * (1 - 0.6 * recover);
    this.enemy.group.rotation.x = -tilt + wobble;
    this.enemy.group.position.set(0, 0.3 * tilt + 0.25 * pulse * (1 - knock), -0.9 * knock);

    // Camera shake: sustained rumble plus a punch on each pulse.
    this.shake = (env * 0.2 * (0.7 + 0.3 * Math.sin(t * 9)) + 0.55 * pulse) * s.shakeStrength * fade;
  }
}

export const earthquakeModule: EffectModule = {
  label: 'earthquake',
  category: 'iconic',
  create: () => new Earthquake(),
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const s = (effect as Earthquake).settings;
    // Caster at z = 14, the ruptured circle centred on the enemy at z = 0.
    frameArena(camera, controls, new THREE.Vector3(0, 1.5, 6), Math.max(12, s.radius * 1.7));
  },
  buildGui(f, effect) {
    const e = effect as Earthquake;
    const s = e.settings;
    f.add(s, 'loop');
    f.add(s, 'radius', 3, 12, 0.1);
    f.add(s, 'quakeTime', 1.5, 5, 0.1).name('quake time');
    f.add(s, 'slabHeight', 0.3, 2.5, 0.05).name('slab height');
    f.add(s, 'shakeStrength', 0, 2, 0.05).name('shake');
    f.addColor(s, 'color').onChange(() => e.applyStyle());
  },
};
