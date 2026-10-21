import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Heroic Leap (reworked): the warrior crouches, explodes into the sky on a wind-trailed arc, hangs at the apex,
 * then dives and craters the ground beside the enemy. Shockwave, flying rock, a dark dust dome, heavy shake.
 */
export interface HeroicLeapSettings {
  apex: number; // peak height
  landZ: number; // landing distance from the enemy along the caster's side
  hangTime: number; // pause at the top
  color: string; // impact glow
  loop: boolean;
}

export const defaultHeroicLeap = (): HeroicLeapSettings => ({
  apex: 12,
  landZ: 2.4,
  hangTime: 0.45,
  color: '#ff8a3a',
  loop: false,
});

const LAUNCH = 0.7;
const ASCENT = 0.8;
const FALL = 0.35;
const AFTERMATH = 2.7;
const ROCKS = 80;
const RIM = 26;
const TRAIL_N = 34;
const TRAIL_STEP = 0.028;
const GRAVITY = 30;

/** Camera-facing ribbon (in the YZ plane the trail travels in) with tapering width and fading alpha. */
class Ribbon {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private positions: Float32Array;
  private tmp = new THREE.Vector3();

  constructor(rgb: [number, number, number], peak: number) {
    this.positions = new Float32Array(TRAIL_N * 2 * 3);
    const col = new Float32Array(TRAIL_N * 2 * 4), idx: number[] = [];
    for (let i = 0; i < TRAIL_N; i++) {
      const a = peak * Math.pow(1 - i / (TRAIL_N - 1), 1.5);
      for (let v = 0; v < 2; v++) col.set([rgb[0], rgb[1], rgb[2], a], (i * 2 + v) * 4);
      if (i < TRAIL_N - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setIndex(idx);
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
  }

  set opacity(v: number) {
    this.material.opacity = v;
    this.mesh.visible = v > 0.002;
  }

  /** `points[0]` is the head. Width tapers to zero at the tail; `nOff` shifts sideways in the trail's plane. */
  update(points: THREE.Vector3[], width: number, xOff: number, nOff: number) {
    for (let i = 0; i < TRAIL_N; i++) {
      const a = points[i], b = points[Math.min(i + 1, TRAIL_N - 1)], c = points[Math.max(i - 1, 0)];
      const t = this.tmp.set(0, b.y - c.y, b.z - c.z);
      const len = t.length();
      if (len < 1e-4) t.set(0, 0, 1); else t.divideScalar(len);
      const ny = -t.z, nz = t.y; // normal in the YZ plane
      const w = width * (1 - i / (TRAIL_N - 1)) * 0.5;
      const o = i * 6;
      this.positions[o] = xOff; this.positions[o + 1] = a.y + ny * (nOff + w); this.positions[o + 2] = a.z + nz * (nOff + w);
      this.positions[o + 3] = xOff; this.positions[o + 4] = a.y + ny * (nOff - w); this.positions[o + 5] = a.z + nz * (nOff - w);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

export class HeroicLeap implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HeroicLeapSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private launched = false;
  private impacted = false;
  private trailAcc = 0;
  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();
  private trailPts: THREE.Vector3[] = Array.from({ length: TRAIL_N }, () => new THREE.Vector3());
  private casterPos = new THREE.Vector3();

  private caster = createCaster(0x9a4a30);
  private enemy = new Enemy();
  private trails = [new Ribbon([1, 0.9, 0.85], 0.4), new Ribbon([1, 0.45, 0.3], 0.5), new Ribbon([1, 0.45, 0.3], 0.5)];
  private aura = new GlowSphere(0xffc080, { rim: false });
  private chargeRing = createRing(0xffa040, 0.8, 1, 64);
  private launchRing = createRing(0xffa040, 0.9, 1, 64);
  private marker = createRing(0xff5a2a, 0.88, 1, 64); // landing mark
  private markerSq = createRing(0xff5a2a, 0.5, 0.56, 4);
  private craterMat = new THREE.MeshBasicMaterial({ color: 0x060504, transparent: true, opacity: 0, depthWrite: false });
  private crater = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.craterMat);
  private craterRing = createRing(0xff8a3a, 0.78, 1, 64);
  private shock = createRing(0xffb060, 0.88, 1, 96);
  private shock2 = createRing(0xd0c8c0, 0.94, 1, 96);
  private flash = new GlowSphere(0xffa860);

  private rocks = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), ROCKS,
  );
  private rim = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.9, 0.7, 0.6), new THREE.MeshStandardMaterial({ color: 0x6e5238, roughness: 0.9 }), RIM,
  );
  private rockPos = new Float32Array(ROCKS * 3);
  private rockVel = new Float32Array(ROCKS * 3);
  private rockRot = new Float32Array(ROCKS * 3);
  private rockSpin = new Float32Array(ROCKS * 3);
  private rockSize = new Float32Array(ROCKS);
  private rockLive = new Uint8Array(ROCKS);

  private wind: Emitter;
  private dome: Emitter;
  private groundDust: Emitter;
  private sparks: Emitter;

  constructor(settings: HeroicLeapSettings = defaultHeroicLeap()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.crater, this.craterRing.mesh, this.marker.mesh, this.markerSq.mesh, this.chargeRing.mesh, this.launchRing.mesh);
    this.group.add(this.shock.mesh, this.shock2.mesh, this.flash.mesh, this.aura.mesh, this.rocks, this.rim);
    for (const r of this.trails) this.group.add(r.mesh);
    this.crater.rotation.x = -Math.PI / 2;
    this.crater.position.y = 0.035;
    this.rocks.frustumCulled = false;
    this.rim.frustumCulled = false;

    for (let i = 0; i < ROCKS; i++) {
      this.rockSize[i] = 0.25 + Math.random() * 0.65;
      this.rocks.setColorAt(i, this.tmpColor.setHSL(0.07 + Math.random() * 0.03, 0.3, 0.28 + Math.random() * 0.12));
    }

    this.wind = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 0.6, speedJitter: 0.5, spread: 180, gravity: 0, drag: 1,
      sizeStart: 0.35, sizeEnd: 0.05, colorStart: '#e8e0d8', colorEnd: '#a09890',
      opacityStart: 0.25, opacityEnd: 0, additive: true, colorMid: '#c8beb4', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.dome = new Emitter({
      ...defaultSettings(), maxParticles: 1300, rate: 0, lifetime: 2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 10, speedJitter: 0.5, spread: 80, gravity: 1, drag: 1.4,
      sizeStart: 0.8, sizeEnd: 3.2, colorStart: '#7a6f63', colorEnd: '#3b3631',
      opacityStart: 0.85, opacityEnd: 0, additive: false,
      colorMid: '#5f564d', sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
    });
    this.groundDust = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.8, speed: 13, speedJitter: 0.5, spread: 88, gravity: 0.5, drag: 1.5,
      sizeStart: 0.7, sizeEnd: 2.4, colorStart: '#6b6157', colorEnd: '#34302b',
      opacityStart: 0.7, opacityEnd: 0, additive: false,
      colorMid: '#50483f', sizeJitter: 0.4, erosion: 0.5, spin: 0.4, groundFade: 0.3,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 1, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 12, speedJitter: 0.6, spread: 75, gravity: 14, drag: 0.5,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#fff0d0', colorEnd: '#ff5a1a',
      opacityStart: 0.85, opacityEnd: 0, additive: true, erosion: 0, sizeJitter: 0.3,
    });
    this.emitters.push(this.wind, this.dome, this.groundDust, this.sparks);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.craterRing.material.color.set(c);
    this.flash.color.set(c);
  }

  private get t1() { return LAUNCH + ASCENT; }
  private get t2() { return this.t1 + this.settings.hangTime; }
  private get impactTime() { return this.t2 + FALL; }

  get duration() {
    return this.impactTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.launched = false;
    this.impacted = false;
    this.trailAcc = 0;
    this.shake = 0;
    this.rockLive.fill(0);
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
    const t = this.time;
    if (!this.launched && t >= LAUNCH) {
      this.launched = true;
      this.groundDust.burst(160, new THREE.Vector3(CASTER_POS.x, 0.3, CASTER_POS.z));
      this.dome.burst(100, new THREE.Vector3(CASTER_POS.x, 0.3, CASTER_POS.z));
    }
    if (t >= LAUNCH && t < this.impactTime) {
      // Wind puffs shed along the flight path.
      this.trailAcc += dt * 120;
      const n = Math.floor(this.trailAcc);
      this.trailAcc -= n;
      if (n > 0) this.wind.burst(n, this.pathAt(t, this.casterPos).add(new THREE.Vector3(0, 1.1, 0)));
    }
    if (!this.impacted && t >= this.impactTime) this.onImpact();
    this.stepRocks(dt);
    this.layout();
    if (!this.playing) this.shake = 0;
  }

  /** Where the warrior's feet are at time `tt`: crouch, arc up, hang, dive. */
  private pathAt(tt: number, out: THREE.Vector3) {
    const s = this.settings;
    const land = ENEMY_POS.z + s.landZ;
    const apexZ = (CASTER_POS.z + land) / 2 + 0.6;
    const hangZ = apexZ - 1;
    const t1 = this.t1, t2 = this.t2;
    if (tt <= LAUNCH) return out.set(0, 0, CASTER_POS.z);
    if (tt < t1) {
      const a = (tt - LAUNCH) / ASCENT;
      return out.set(0, s.apex * (1 - (1 - a) * (1 - a)), CASTER_POS.z + (apexZ - CASTER_POS.z) * a);
    }
    if (tt < t2) {
      const h = (tt - t1) / s.hangTime;
      return out.set(0, s.apex + 0.35 * Math.sin(h * Math.PI), apexZ + (hangZ - apexZ) * h);
    }
    if (tt < this.impactTime) {
      const d = (tt - t2) / FALL;
      return out.set(0, s.apex * (1 - d * d), hangZ + (land - hangZ) * d);
    }
    return out.set(0, 0, land);
  }

  private onImpact() {
    this.impacted = true;
    const land = new THREE.Vector3(0, 0, ENEMY_POS.z + this.settings.landZ);
    this.dome.burst(450, land.clone().setY(0.3));
    this.groundDust.burst(400, land.clone().setY(0.2));
    this.sparks.burst(400, land.clone().setY(0.3));
    for (let i = 0; i < ROCKS; i++) {
      const j = i * 3;
      const a = Math.random() * Math.PI * 2, r0 = 1 + Math.random() * 1.8, sp = 5 + Math.random() * 10;
      this.rockPos[j] = land.x + Math.cos(a) * r0; this.rockPos[j + 1] = 0.3; this.rockPos[j + 2] = land.z + Math.sin(a) * r0;
      this.rockVel[j] = Math.cos(a) * sp; this.rockVel[j + 1] = 7 + Math.random() * 13; this.rockVel[j + 2] = Math.sin(a) * sp;
      for (let c = 0; c < 3; c++) { this.rockRot[j + c] = Math.random() * 6; this.rockSpin[j + c] = (Math.random() - 0.5) * 14; }
      this.rockLive[i] = 1;
    }
  }

  private stepRocks(dt: number) {
    for (let i = 0; i < ROCKS; i++) {
      if (!this.rockLive[i]) continue;
      const j = i * 3, half = this.rockSize[i] * 0.5;
      this.rockVel[j + 1] -= GRAVITY * dt;
      for (let c = 0; c < 3; c++) { this.rockPos[j + c] += this.rockVel[j + c] * dt; this.rockRot[j + c] += this.rockSpin[j + c] * dt; }
      if (this.rockPos[j + 1] < half) {
        this.rockPos[j + 1] = half;
        if (this.rockVel[j + 1] < -1.2) this.rockVel[j + 1] = -this.rockVel[j + 1] * 0.35;
        else this.rockVel[j + 1] = 0;
        this.rockVel[j] *= 0.7; this.rockVel[j + 2] *= 0.7;
        for (let c = 0; c < 3; c++) this.rockSpin[j + c] *= 0.7;
      }
    }
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const imp = this.impactTime;
    const after = t - imp;
    const fade = 1 - smoothstep((t - (this.duration - 0.8)) / 0.8);
    const land = ENEMY_POS.z + s.landZ;
    const d = this.dummy;
    const t1 = this.t1, t2 = this.t2;

    // Warrior: coils down, springs off, tucks and dives, lands in a crouch.
    const crouch = smoothstep(t / 0.55) * (1 - smoothstep((t - 0.55) / 0.15));
    const squash = crouch + (after > 0 ? 0.8 * Math.exp(-after * 7) : 0);
    this.pathAt(t, this.casterPos);
    this.caster.group.position.copy(this.casterPos);
    this.caster.group.scale.set(1 + 0.12 * squash, 1 - 0.38 * Math.min(1, squash), 1 + 0.12 * squash);
    const dive = t > t2 && t < imp ? smoothstep((t - t2) / FALL) : 0;
    this.caster.group.rotation.x = -0.8 * dive - 0.3 * Math.sin(Math.PI * THREE.MathUtils.clamp((t - LAUNCH) / ASCENT, 0, 1));
    const hang = smoothstep((t - (t1 - 0.1)) / 0.15) * (1 - smoothstep((t - t2) / 0.2));
    this.aura.mesh.position.set(0, this.casterPos.y + 1.1, this.casterPos.z);
    this.aura.mesh.scale.setScalar(1.6);
    this.aura.opacity = 0.25 * hang;

    // Wind trail: three ribbons along the recent path, vanishing once the warrior lands.
    for (let i = 0; i < TRAIL_N; i++) {
      this.pathAt(t - i * TRAIL_STEP, this.trailPts[i]);
      this.trailPts[i].y += 1.1;
    }
    const flight = smoothstep((t - LAUNCH) / 0.1) * (1 - smoothstep(after / 0.2));
    this.trails[0].update(this.trailPts, 0.7, 0, 0);
    this.trails[1].update(this.trailPts, 0.12, 0.5, 0.45);
    this.trails[2].update(this.trailPts, 0.12, -0.5, -0.45);
    this.trails[0].opacity = flight;
    this.trails[1].opacity = flight;
    this.trails[2].opacity = flight;

    // Anticipation: energy gathers into the warrior, then the launch ring blasts out.
    const charge = smoothstep(t / 0.5) * (1 - smoothstep((t - LAUNCH) / 0.05));
    this.chargeRing.mesh.position.set(0, 0.05, CASTER_POS.z);
    this.chargeRing.mesh.scale.setScalar(3 - 2 * smoothstep(t / LAUNCH));
    this.chargeRing.mesh.rotation.z = t * 3;
    this.chargeRing.material.opacity = 0.5 * charge;
    const sl = t - LAUNCH;
    this.launchRing.mesh.position.set(0, 0.05, CASTER_POS.z);
    this.launchRing.mesh.scale.setScalar(1 + Math.max(0, sl) * 14);
    this.launchRing.material.opacity = sl > 0 ? Math.max(0, 0.5 * (1 - sl / 0.5)) : 0;

    // Landing mark on the ground, locking on while the warrior is in the air.
    const mk = smoothstep((t - LAUNCH) / 0.4) * (t < imp ? 1 : 0);
    this.marker.mesh.position.set(0, 0.05, land);
    this.marker.mesh.scale.setScalar(3.3 - 0.4 * smoothstep((t - LAUNCH) / (imp - LAUNCH)));
    this.marker.material.opacity = 0.4 * mk;
    this.markerSq.mesh.position.set(0, 0.06, land);
    this.markerSq.mesh.scale.setScalar(2.2);
    this.markerSq.mesh.rotation.z = t * 1.5;
    this.markerSq.material.opacity = 0.45 * mk;

    // Impact: crater, glowing rim, two shock rings, flash.
    const a = Math.max(0, after);
    const hit = after >= 0;
    this.crater.position.set(0, 0.035, land);
    this.crater.scale.setScalar(Math.max(0.001, 3.3 * smoothstep(a / 0.12)));
    this.craterMat.opacity = hit ? 0.9 * fade : 0;
    this.craterRing.mesh.position.set(0, 0.07, land);
    this.craterRing.mesh.scale.setScalar(3.3 * (1 + 0.1 * smoothstep(a / 0.2)));
    this.craterRing.material.opacity = hit ? 0.6 * Math.exp(-a * 1.1) * fade : 0;
    this.shock.mesh.position.set(0, 0.08, land);
    this.shock.mesh.scale.setScalar(1 + a * 30);
    this.shock.material.opacity = hit ? Math.max(0, 0.7 * (1 - a / 0.5)) : 0;
    this.shock2.mesh.position.set(0, 0.09, land);
    this.shock2.mesh.scale.setScalar(1 + a * 16);
    this.shock2.material.opacity = hit ? Math.max(0, 0.4 * (1 - a / 0.8)) : 0;
    this.flash.mesh.position.set(0, 1.2, land);
    this.flash.mesh.scale.setScalar(1 + a * 11);
    this.flash.opacity = hit ? 0.5 * Math.exp(-a * 7) : 0;

    // Rim stones thrown up around the crater.
    d.rotation.order = 'XYZ';
    const rise = smoothstep(a / 0.12);
    for (let i = 0; i < RIM; i++) {
      const ang = (i / RIM) * Math.PI * 2;
      const r = 3.5 + 0.3 * Math.sin(i * 12.9);
      d.position.set(Math.cos(ang) * r, hit ? -0.4 + 0.65 * rise : -2, land + Math.sin(ang) * r);
      d.rotation.set(0, -ang, -0.6);
      d.scale.setScalar(hit ? (0.8 + 0.4 * Math.abs(Math.sin(i * 7.3))) * Math.max(0.001, fade) : 0.001);
      d.updateMatrix();
      this.rim.setMatrixAt(i, d.matrix);
    }
    this.rim.instanceMatrix.needsUpdate = true;

    // Flying rock.
    for (let i = 0; i < ROCKS; i++) {
      const j = i * 3;
      d.position.set(this.rockPos[j], this.rockPos[j + 1], this.rockPos[j + 2]);
      d.rotation.set(this.rockRot[j], this.rockRot[j + 1], this.rockRot[j + 2]);
      d.scale.setScalar(this.rockLive[i] ? this.rockSize[i] * Math.max(0.001, fade) : 0.001);
      d.updateMatrix();
      this.rocks.setMatrixAt(i, d.matrix);
    }
    this.rocks.instanceMatrix.needsUpdate = true;

    // Enemy: blown back along -Z in a hop, then lies tilted away from the warrior.
    if (hit) {
      const kb = 1 - Math.exp(-a * 5);
      const tilt = smoothstep(a / 0.4) * (1 - 0.6 * smoothstep((t - (this.duration - 1.2)) / 1));
      const hop = Math.sin(Math.PI * Math.min(1, a / 0.55));
      this.enemy.group.position.set(0, 1.0 * hop + 0.25 * tilt, -3.4 * kb);
      this.enemy.group.rotation.x = -(1.0 + 0.08 * Math.sin(a * 12) * Math.exp(-a * 3)) * tilt;
      this.enemy.setFlash(1.2 * Math.exp(-a * 4));
    }

    // Shake: small kick at launch, huge slam on landing with a lingering rumble.
    this.shake = (sl > 0 ? 0.12 * Math.exp(-sl * 10) : 0.03 * crouch)
      + (hit ? 0.9 * Math.exp(-a * 3.5) + 0.2 * Math.exp(-a * 1.2) : 0);
  }
}

export const heroicLeapModule: EffectModule = {
  label: 'heroic leap',
  category: 'iconic',
  create: () => new HeroicLeap(),
  telegraphs(effect) {
    const h = effect as HeroicLeap;
    const s = h.settings;
    // Landing circle (crater + rim) shows as soon as the warrior leaves the ground, well before the dive ends.
    const impact = LAUNCH + ASCENT + s.hangTime + FALL;
    return [
      { shape: { kind: 'circle', x: 0, z: ENEMY_POS.z + s.landZ, radius: 3.8 }, start: LAUNCH, impact },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const s = (effect as HeroicLeap).settings;
    // Caster at z = 14, the arc peaks around z = 8, the impact is beside the enemy.
    frameArena(camera, controls, new THREE.Vector3(0, s.apex * 0.4, 7), Math.max(11, s.apex * 0.7));
  },
  buildGui(f, effect) {
    const h = effect as HeroicLeap;
    const s = h.settings;
    f.add(s, 'loop');
    f.add(s, 'apex', 4, 25, 0.5);
    f.add(s, 'landZ', 1.5, 6, 0.1).name('landing distance');
    f.add(s, 'hangTime', 0.1, 1, 0.05).name('hang time');
    f.addColor(s, 'color').onChange(() => h.applyStyle());
  },
};
