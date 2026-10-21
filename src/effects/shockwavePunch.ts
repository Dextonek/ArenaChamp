import * as THREE from 'three';
import { Emitter, defaultSettings } from '../emitter';
import { Enemy, GlowSphere, createGround, smoothstep } from './common';
import type { Effect, EffectModule } from './types';

/**
 * "Shockwave punch" set piece: a puncher stands 8 units in front of the enemy (which is at the
 * origin) and gathers energy in its fist. The release sends cone/ring shockwaves, an air blast and
 * a ground-hugging dust wall down +Z, flings debris, and launches the enemy down the punch axis.
 */
export interface ShockwavePunchSettings {
  power: number; // scales blast size, debris energy, knockback and shake
  windupTime: number; // seconds the fist gathers energy
  ringCount: number;
  blastLength: number; // how far the air blast travels along +Z
  debrisCount: number;
  dustAmount: number; // multiplier of the dust wall density
  blastColor: string;
  dustColor: string;
  loop: boolean;
}

export const defaultShockwavePunch = (): ShockwavePunchSettings => ({
  power: 1,
  windupTime: 0.8,
  ringCount: 5,
  blastLength: 38,
  debrisCount: 220,
  dustAmount: 1,
  blastColor: '#9fd8ff',
  dustColor: '#8a7d6a',
  loop: false,
});

const AFTERMATH = 4.2; // seconds after the punch until the effect has fully faded
const FADE = 1.0; // final fade-out length inside the aftermath
const MAX_RINGS = 10;
const MOTES = 260;
const RING_LIFE = 0.9;
const BLAST_LIFE = 1.0;
const HIT_DELAY = 0.13; // blast travel time from the fist to the enemy
const GRAVITY = 26;
const BODY_Z = -9.4;
const FIST_REST_Z = -9.0;
const FIST_OUT_Z = -7.6;
const FIST_Y = 1.55;

interface Chunk {
  zFrac: number; // 0..1 of the debris field along the blast path
  x: number;
  scale: number;
  launched: boolean;
  settled: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  q: THREE.Quaternion;
  axis: THREE.Vector3;
  spin: number;
}

interface Mote {
  dir: THREE.Vector3;
  r0: number;
  phase: number;
}

export class ShockwavePunch implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShockwavePunchSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private punched = false;
  private dustCarry = 0;
  // enemy knockback state
  private hit = false;
  private ez = 0;
  private ey = 0;
  private evz = 0;
  private evy = 0;
  private tumble = 0;
  private tumbleRate = 0;

  private enemy = new Enemy();
  private fist: THREE.Mesh;
  private fistMat: THREE.MeshStandardMaterial;
  private arm: THREE.Mesh;
  private glow: GlowSphere;
  private motes: THREE.InstancedMesh;
  private moteMat: THREE.MeshBasicMaterial;
  private moteData: Mote[] = [];
  private rings: THREE.Mesh[] = [];
  private ringMats: THREE.MeshBasicMaterial[] = [];
  private coneOuter: THREE.Mesh;
  private coneInner: THREE.Mesh;
  private coneOuterMat: THREE.MeshBasicMaterial;
  private coneInnerMat: THREE.MeshBasicMaterial;
  private debris!: THREE.InstancedMesh;
  private debrisMat: THREE.MeshStandardMaterial;
  private debrisGeo = new THREE.DodecahedronGeometry(0.25, 0);
  private chunks: Chunk[] = [];
  private flashLight = new THREE.PointLight(0xbfe6ff, 0, 50, 1.5);
  private sparks: Emitter;
  private dust: Emitter;

  private dummy = new THREE.Object3D();
  private dq = new THREE.Quaternion();
  private v1 = new THREE.Vector3();

  constructor(settings: ShockwavePunchSettings = defaultShockwavePunch()) {
    this.settings = settings;
    const s = settings;

    this.group.add(createGround());
    this.group.add(this.enemy.group);

    // Puncher: a simple capsule figure with a glowing fist and an arm that stretches to it.
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2c3a52, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.0, 6, 16), bodyMat);
    body.position.set(0, 1.0, BODY_Z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), bodyMat);
    head.position.set(0, 2.15, BODY_Z + 0.05);
    this.group.add(body, head);

    this.fistMat = new THREE.MeshStandardMaterial({
      color: 0xe8e2d8, roughness: 0.5, emissive: new THREE.Color(s.blastColor), emissiveIntensity: 0.3,
    });
    this.fist = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), this.fistMat);
    this.group.add(this.fist);
    this.arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1, 10).rotateX(Math.PI / 2), bodyMat);
    this.group.add(this.arm);

    // Energy glow around the fist and the inflowing motes.
    this.glow = new GlowSphere(s.blastColor, { rim: false });
    this.group.add(this.glow.mesh);

    this.moteMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(s.blastColor).multiplyScalar(1.3), transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.motes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), this.moteMat, MOTES);
    this.motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.motes.frustumCulled = false;
    this.group.add(this.motes);
    for (let i = 0; i < MOTES; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      if (dir.lengthSq() < 1e-4) dir.set(0, 1, 0);
      this.moteData.push({ dir: dir.normalize(), r0: 1.6 + Math.random() * 2.6, phase: Math.random() });
    }

    // Shock rings (face +Z) and the layered air-blast cones (tip toward +Z).
    const ringGeo = new THREE.RingGeometry(0.9, 1, 64);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(s.blastColor).multiplyScalar(1.3), transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.visible = false;
      this.group.add(ring);
      this.rings.push(ring);
      this.ringMats.push(mat);
    }
    const coneGeo = new THREE.ConeGeometry(1, 1, 48, 1, true).rotateX(Math.PI / 2);
    const coneMat = (op: number) => new THREE.MeshBasicMaterial({
      color: new THREE.Color(s.blastColor).multiplyScalar(1.3), transparent: true, opacity: op,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.coneOuterMat = coneMat(0);
    this.coneInnerMat = coneMat(0);
    this.coneOuter = new THREE.Mesh(coneGeo, this.coneOuterMat);
    this.coneInner = new THREE.Mesh(coneGeo, this.coneInnerMat);
    this.coneOuter.visible = this.coneInner.visible = false;
    this.group.add(this.coneOuter, this.coneInner);

    // Debris chunks (rebuilt when the count changes).
    this.debrisMat = new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 1, flatShading: true });
    this.buildDebris();

    this.group.add(this.flashLight);
    this.flashLight.position.set(0, 2.5, -3);

    // Particles: sparks and the dust wall.
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 1.2, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 18, speedJitter: 0.6, spread: 85,
      gravity: 14, drag: 0.5, sizeStart: 0.2, sizeEnd: 0.03, colorStart: '#fff4d0', colorEnd: '#ff9a30',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1800, rate: 0, lifetime: 2.6, lifetimeJitter: 0.3,
      shape: 'cone', shapeSize: 1.2, originY: 0.2, speed: 6, speedJitter: 0.5, spread: 88,
      gravity: -0.2, drag: 1.5, sizeStart: 1.6, sizeEnd: 5.5, colorStart: s.dustColor, colorMid: '#6e665c', colorEnd: '#44444a',
      opacityStart: 0.35, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.5, spin: 0.4, groundFade: 0.15,
    });
    this.emitters.push(this.sparks, this.dust);
    for (const e of this.emitters) this.group.add(e.points);

    this.reset();
  }

  /** Recreates the instanced debris (call after changing debrisCount). */
  buildDebris() {
    if (this.debris) {
      this.group.remove(this.debris);
      this.debris.dispose();
    }
    const n = Math.max(1, Math.floor(this.settings.debrisCount));
    this.debris = new THREE.InstancedMesh(this.debrisGeo, this.debrisMat, n);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.frustumCulled = false;
    this.group.add(this.debris);

    this.chunks = [];
    for (let i = 0; i < n; i++) {
      this.chunks.push({
        zFrac: Math.pow(Math.random(), 1.3) * 0.55,
        x: (Math.random() - 0.5) * 2 * (1.2 + Math.random() * 4.5),
        scale: 0.5 + Math.random() * 1.6,
        launched: false,
        settled: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        q: new THREE.Quaternion().random(),
        axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        spin: 0,
      });
    }
  }

  /** Applies colour changes from the settings. */
  applyStyle() {
    const s = this.settings;
    const c = new THREE.Color(s.blastColor).multiplyScalar(1.3);
    this.glow.color.set(s.blastColor);
    this.moteMat.color.copy(c);
    this.coneOuterMat.color.copy(c);
    this.coneInnerMat.color.copy(c);
    for (const m of this.ringMats) m.color.copy(c);
    this.fistMat.emissive.set(s.blastColor);
    this.flashLight.color.set(s.blastColor);
    this.dust.settings.colorStart = s.dustColor;
    this.dust.applyStyle();
  }

  play() {
    if (this.chunks.length !== Math.floor(this.settings.debrisCount)) this.buildDebris();
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.punched = false;
    this.dustCarry = 0;
    this.hit = false;
    this.ez = 0; this.ey = 0; this.evz = 0; this.evy = 0;
    this.tumble = 0; this.tumbleRate = 0;
    this.shake = 0;
    for (const e of this.emitters) e.clear();
    for (const c of this.chunks) { c.launched = false; c.settled = false; }
    this.enemy.reset();
    this.enemy.group.position.set(0, 0, 0);
    this.enemy.group.rotation.set(0, Math.PI, 0); // face the puncher
    this.glow.opacity = 0;
    this.coneOuterMat.opacity = this.coneInnerMat.opacity = 0;
    this.coneOuter.visible = this.coneInner.visible = false;
    for (const r of this.rings) r.visible = false;
    this.flashLight.intensity = 0;
    this.layout(0);
  }

  get duration() {
    return this.settings.windupTime + AFTERMATH;
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

    if (!this.punched && this.time >= s.windupTime) this.onPunch();
    this.layout(dt);
  }

  /** Positions everything for the current time. */
  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const W = Math.max(0.05, s.windupTime);
    const after = t - s.windupTime;
    const wp = smoothstep(t / W);
    const pw = 0.7 + 0.3 * s.power;
    const fadeOut = this.punched ? 1 - smoothstep((t - (this.duration - FADE)) / FADE) : 1;

    // --- Puncher -------------------------------------------------------------
    const ext = this.punched ? smoothstep(after / 0.08) : 0;
    const fistZ = THREE.MathUtils.lerp(FIST_REST_Z - 0.3 * wp, FIST_OUT_Z, ext);
    this.fist.position.set(0, FIST_Y, fistZ);
    const shoulderZ = BODY_Z + 0.3;
    this.arm.position.set(0, FIST_Y - 0.1, (shoulderZ + fistZ) / 2);
    this.arm.scale.set(1, 1, Math.max(0.1, fistZ - shoulderZ));
    this.fistMat.emissiveIntensity = this.punched ? 0.3 + 2.2 * Math.exp(-after * 8) : 0.3 + 0.7 * wp;

    // Energy glow: swells during the wind-up, flares and vanishes on release.
    this.glow.mesh.position.copy(this.fist.position);
    if (!this.punched) {
      const gs = 0.12 + 0.5 * wp + 0.04 * wp * Math.sin(t * 40);
      this.glow.mesh.scale.setScalar(gs);
      this.glow.opacity = 0.15 + 0.3 * wp;
      this.flashLight.position.set(0, 2.5, fistZ);
      this.flashLight.intensity = 25 * wp;
    } else {
      const g = Math.min(1, after / 0.35);
      this.glow.mesh.scale.setScalar(0.62 + 1.6 * g);
      this.glow.opacity = 0.5 * (1 - g);
    }

    // Motes streaming into the fist.
    const gather = !this.punched ? smoothstep(t / 0.2) : 0;
    for (let i = 0; i < MOTES; i++) {
      const m = this.moteData[i];
      const p = (t / 0.5 + m.phase) % 1;
      const r = m.r0 * (1 - p * p);
      const sc = Math.max(1e-4, gather * Math.sin(Math.PI * p) * (0.5 + 0.8 * wp));
      this.dummy.position.set(m.dir.x * r, FIST_Y + m.dir.y * r, fistZ + m.dir.z * r);
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(sc);
      this.dummy.updateMatrix();
      this.motes.setMatrixAt(i, this.dummy.matrix);
    }
    this.motes.instanceMatrix.needsUpdate = true;

    this.shake = this.punched ? 0 : 0.05 * wp;

    // --- Release -------------------------------------------------------------
    if (this.punched) {
      const z0 = FIST_OUT_Z;
      const L = s.blastLength;

      // Rings in quick succession.
      const ringN = Math.min(MAX_RINGS, Math.max(1, Math.floor(s.ringCount)));
      for (let i = 0; i < MAX_RINGS; i++) {
        const ring = this.rings[i];
        const age = after - i * 0.06;
        if (i >= ringN || age < 0 || age > RING_LIFE) { ring.visible = false; continue; }
        const p = age / RING_LIFE;
        const ease = 1 - (1 - p) * (1 - p);
        const r = (1.2 + (3.5 + i * 0.25) * Math.sqrt(p)) * pw;
        ring.visible = true;
        ring.position.set(0, FIST_Y, z0 + L * ease * (1 - i * 0.04));
        ring.scale.set(r, r, 1);
        this.ringMats[i].opacity = Math.pow(1 - p, 1.2) * 0.5 * fadeOut;
      }

      // Air blast: two nested open cones racing past the enemy.
      const bp = after / BLAST_LIFE;
      const on = bp >= 0 && bp < 1;
      this.coneOuter.visible = this.coneInner.visible = on;
      if (on) {
        const tipDist = L * (1 - (1 - bp) * (1 - bp));
        const len = Math.min(tipDist + 1, L * 0.45);
        const tip = z0 + tipDist;
        const R = (1.5 + 3 * Math.sqrt(bp)) * pw;
        this.coneOuter.position.set(0, FIST_Y, tip - len / 2);
        this.coneOuter.scale.set(R, R, len);
        this.coneInner.position.set(0, FIST_Y, tip - len * 0.4);
        this.coneInner.scale.set(R * 0.55, R * 0.55, len * 0.8);
        const fade = Math.pow(1 - bp, 1.5);
        this.coneOuterMat.opacity = 0.28 * fade;
        this.coneInnerMat.opacity = 0.4 * fade;
      }

      // Dust wall: bursts along a widening arc ahead of the puncher.
      if (dt > 0 && after < 0.9) {
        const dp = after / 0.9;
        const R = 1 + L * 0.55 * (1 - (1 - dp) * (1 - dp));
        this.dustCarry += 1000 * s.dustAmount * dt;
        const n = Math.floor(this.dustCarry);
        this.dustCarry -= n;
        for (let i = 0; i < n; i++) {
          const th = (Math.random() * 2 - 1) * 1.15;
          const rr = R * (0.85 + Math.random() * 0.3);
          this.v1.set(Math.sin(th) * rr, 0, z0 + Math.cos(th) * rr);
          this.dust.burst(1, this.v1);
        }
      }

      // Light flash and camera shake.
      this.flashLight.position.set(0, 2.5, -3);
      this.flashLight.intensity = 250 * s.power * Math.exp(-after * 7);
      this.shake = 1.2 * s.power * Math.exp(-after * 3.2);

      this.updateDebris(dt, after, fadeOut);
      this.updateEnemy(dt, after);
    }
  }

  private updateDebris(dt: number, after: number, fade: number) {
    const s = this.settings;
    const power = s.power;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      // A chunk launches when the blast front reaches it (front ~ 1 - (1 - p)^2 of the blast length).
      if (!c.launched && after >= (1 - Math.sqrt(Math.max(0, 1 - c.zFrac))) * BLAST_LIFE) {
        c.launched = true;
        c.settled = false;
        c.pos.set(c.x, 0.15, FIST_OUT_Z + 0.5 + c.zFrac * s.blastLength);
        c.vel.set(
          (Math.random() - 0.5) * 6,
          (5 + Math.random() * 9) * power * (1 - c.zFrac * 0.4),
          (6 + Math.random() * 12) * power,
        );
        c.spin = 4 + Math.random() * 10;
      }
      if (c.launched && !c.settled && dt > 0) {
        c.vel.y -= GRAVITY * dt;
        c.pos.addScaledVector(c.vel, dt);
        const floor = 0.25 * c.scale * 0.8;
        if (c.pos.y < floor) {
          c.pos.y = floor;
          if (Math.abs(c.vel.y) > 1.8) {
            c.vel.y = -c.vel.y * 0.38;
            c.vel.x *= 0.65; c.vel.z *= 0.65;
            c.spin *= 0.6;
          } else {
            c.vel.y = 0;
            const f = Math.exp(-6 * dt);
            c.vel.x *= f; c.vel.z *= f; c.spin *= f;
            if (c.vel.lengthSq() < 0.02) { c.settled = true; c.vel.set(0, 0, 0); c.spin = 0; }
          }
        }
        this.dq.setFromAxisAngle(c.axis, c.spin * dt);
        c.q.premultiply(this.dq);
      }
      const sc = c.launched ? c.scale * fade : 1e-4;
      this.dummy.position.copy(c.pos);
      this.dummy.quaternion.copy(c.q);
      this.dummy.scale.setScalar(Math.max(sc, 1e-4));
      this.dummy.updateMatrix();
      this.debris.setMatrixAt(i, this.dummy.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }

  /** Flash, then launch the enemy down +Z, tumbling, bouncing and sliding to rest. */
  private updateEnemy(dt: number, after: number) {
    const s = this.settings;
    const hitAge = after - HIT_DELAY;
    if (hitAge < 0) return;

    if (!this.hit) {
      this.hit = true;
      this.evz = 30 * s.power;
      this.evy = 9 * s.power;
      this.tumbleRate = 9 * s.power;
      this.v1.set(0, 1.1, -0.4);
      this.sparks.burst(500 * s.power, this.v1);
    }
    this.enemy.setFlash(Math.exp(-hitAge * 4));

    if (dt > 0) {
      this.evy -= GRAVITY * dt;
      this.ez += this.evz * dt;
      this.ey += this.evy * dt;
      this.tumble += this.tumbleRate * dt;
      const floor = 0.55 * Math.abs(Math.sin(this.tumble));
      if (this.ey <= floor) {
        this.ey = floor;
        if (this.evy < -3) {
          this.evy = -this.evy * 0.4;
          this.evz *= 0.65;
          this.tumbleRate *= 0.55;
          this.v1.set(0, 0, this.ez);
          this.dust.burst(Math.floor(60 * s.dustAmount), this.v1);
        } else {
          this.evy = 0;
          this.evz *= Math.exp(-3 * dt);
          this.tumbleRate *= Math.exp(-4 * dt);
          if (Math.abs(this.evz) < 4) {
            // Come to rest lying flat.
            const target = Math.round((this.tumble - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
            this.tumble += (target - this.tumble) * (1 - Math.exp(-6 * dt));
          }
        }
      }
    }
    this.enemy.group.position.set(0, this.ey, this.ez);
    this.enemy.group.rotation.set(this.tumble, Math.PI, 0);
  }

  private onPunch() {
    this.punched = true;
    const s = this.settings;
    this.v1.set(0, FIST_Y - 0.3, FIST_OUT_Z);
    this.sparks.burst(450 * s.power, this.v1);
    this.v1.set(0, 0, FIST_OUT_Z + 1);
    this.dust.burst(Math.floor(150 * s.dustAmount), this.v1);
  }

  dispose() {
    this.debrisGeo.dispose();
    this.debris.dispose();
    this.motes.dispose();
    for (const e of this.emitters) e.dispose();
  }
}

export const shockwavePunchModule: EffectModule = {
  label: 'shockwave punch',
  create: () => new ShockwavePunch(),
  telegraphs(effect) {
    const s = (effect as ShockwavePunch).settings;
    // The air blast fans forward from the fist along +Z.
    return [{
      shape: { kind: 'cone', x: 0, z: -7.6, radius: s.blastLength, angle: 50, dir: 0 },
      start: 0.05, impact: s.windupTime + 0.08,
    }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const sp = (effect as ShockwavePunch).settings;
    // Side view from -X so the punch travels left to right on screen (+Z is screen-right from here).
    const span = Math.max(sp.blastLength, 30) + 12;
    const midZ = span / 2 - 12;
    const dist = span * 0.85;
    camera.position.set(-dist, span * 0.2, midZ - span * 0.12);
    controls.target.set(0, 2.5, midZ);
  },
  buildGui(f, effect) {
    const fx = effect as ShockwavePunch;
    const sp = fx.settings;
    f.add(sp, 'loop');
    f.add(sp, 'power', 0.3, 2.5, 0.05);
    f.add(sp, 'windupTime', 0.2, 3, 0.05).name('wind-up time');
    f.add(sp, 'ringCount', 1, MAX_RINGS, 1).name('ring count');
    f.add(sp, 'blastLength', 10, 70, 1).name('blast length');
    f.add(sp, 'debrisCount', 20, 400, 10).name('debris count').onFinishChange(() => fx.buildDebris());
    f.add(sp, 'dustAmount', 0.2, 2, 0.05).name('dust amount');
    f.addColor(sp, 'blastColor').name('blast color').onChange(() => fx.applyStyle());
    f.addColor(sp, 'dustColor').name('dust color').onChange(() => fx.applyStyle());
  },
};
