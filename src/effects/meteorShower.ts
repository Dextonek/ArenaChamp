import * as THREE from 'three';
import { Emitter, defaultSettings } from '../emitter';
import { Enemy, createGround, smoothstep } from './common';
import type { Effect, EffectModule } from './types';

/**
 * "Meteor shower": the sky over the target reddens and warning rings appear on the ground, then a
 * barrage of burning rocks streaks down at a diagonal and cratering the area. One huge meteor lands
 * last, right on the enemy.
 */
export interface MeteorSettings {
  meteorCount: number; // regular meteors, not counting the final big one
  meteorSize: number; // rock radius in world units
  sizeJitter: number; // 0..1 random size variation
  fallAngle: number; // degrees from vertical
  fallHeight: number; // start height of the meteors
  fallSpeed: number;
  anticipation: number; // seconds of reddening sky before the first meteor
  barrageTime: number; // seconds over which the regular meteors land
  areaRadius: number; // impact area around the enemy
  fireColor: string;
  skyColor: string;
  loop: boolean;
}

export const defaultMeteor = (): MeteorSettings => ({
  meteorCount: 30,
  meteorSize: 0.7,
  sizeJitter: 0.5,
  fallAngle: 35,
  fallHeight: 40,
  fallSpeed: 45,
  anticipation: 1.5,
  barrageTime: 4,
  areaRadius: 9,
  fireColor: '#ff8a2a',
  skyColor: '#5a1408',
  loop: false,
});

const AFTERMATH = 3;
const FADE = 1.2;
const SHOCK_TIME = 0.8;
const BIG_SCALE = 3.4;
const ENEMY_POS = new THREE.Vector3(0, 1.1, 0);

interface Meteor {
  big: boolean;
  size: number;
  target: THREE.Vector3;
  start: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  launchTime: number;
  impactTime: number;
  warnTime: number; // when its warning ring starts to show
  spin: THREE.Vector3;
  impacted: boolean;
}

export class MeteorShower implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MeteorSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private bigImpact = 0; // when the big meteor lands
  private killed = false;
  private kick = 0; // decaying impact shake, on top of the pre-barrage rumble

  private meteors: Meteor[] = [];
  private rocks!: THREE.InstancedMesh;
  private glows!: THREE.InstancedMesh;
  private marks!: THREE.InstancedMesh; // warning ring, then crater glow
  private shocks!: THREE.InstancedMesh;

  private rockGeo = createRockGeometry();
  private rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, metalness: 0, flatShading: true, emissive: 0xff5a1a, emissiveIntensity: 0.8,
  });
  private glowGeo = new THREE.SphereGeometry(1, 12, 8);
  private glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.3, 0.55, 0.15), transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private markGeo = new THREE.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
  private shockGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2).translate(0, 0.05, 0);
  private ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private dome = new THREE.Mesh(
    new THREE.SphereGeometry(95, 32, 16),
    new THREE.MeshBasicMaterial({
      color: 0x9a1808, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, fog: false,
    }),
  );

  private enemy = new Enemy();
  private enemyFlash = 0;
  private impactLight = new THREE.PointLight(0xff8a3a, 0, 70, 1.2);
  private lightFlash = 0;
  private trail: Emitter;
  private smoke: Emitter;
  private sparks: Emitter;
  private dust: Emitter;

  private dummy = new THREE.Object3D();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private col = new THREE.Color();
  private fire = new THREE.Color();
  private warn = new THREE.Color(1, 0.18, 0.08);
  private hidden = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4); // never 0: a singular instance matrix gives NaN normals → black bloomed frame

  constructor(settings: MeteorSettings = defaultMeteor()) {
    this.settings = settings;

    this.group.add(this.dome);
    this.group.add(createGround());
    this.group.add(this.enemy.group);
    this.group.add(this.impactLight);

    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 3000, rate: 0, lifetime: 0.55, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.25, speed: 0.8, speedJitter: 0.5, spread: 180, gravity: -1, drag: 1.5,
      sizeStart: 0.9, sizeEnd: 0.1, colorStart: '#fff0b0', colorMid: '#ff8a2a', colorEnd: '#7a1408',
      opacityStart: 0.4, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 2500, rate: 0, lifetime: 1.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 0.6, speedJitter: 0.5, spread: 180, gravity: -0.3, drag: 1.2,
      sizeStart: 0.7, sizeEnd: 2.2, colorStart: '#4a3a34', colorMid: '#2e2826', colorEnd: '#1c1c22',
      opacityStart: 0.28, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 3000, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'point', shapeSize: 0, speed: 9, speedJitter: 0.6, spread: 70, gravity: 16, drag: 0.8,
      sizeStart: 0.16, sizeEnd: 0.02, colorStart: '#fff0c0', colorEnd: '#ff8a2a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 2.8, speedJitter: 0.5, spread: 75, gravity: -0.2, drag: 1.5,
      sizeStart: 1.0, sizeEnd: 3.4, colorStart: '#6a5c50', colorMid: '#46403c', colorEnd: '#26262e',
      opacityStart: 0.32, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.15,
    });
    this.emitters.push(this.trail, this.smoke, this.sparks, this.dust);
    for (const e of this.emitters) this.group.add(e.points);

    this.build();
    this.applyStyle();
  }

  /** (Re)creates the meteor schedule and instanced meshes from the settings. */
  build() {
    const s = this.settings;
    for (const m of [this.rocks, this.glows, this.marks, this.shocks]) {
      if (m) { this.group.remove(m); m.dispose(); }
    }

    const n = Math.max(1, Math.floor(s.meteorCount));
    const ang = THREE.MathUtils.degToRad(s.fallAngle);
    const baseDir = new THREE.Vector3(Math.sin(ang), -Math.cos(ang), 0);
    const pathLen = s.fallHeight / Math.max(0.2, Math.cos(ang));
    const flight = pathLen / s.fallSpeed;

    this.meteors = [];
    for (let i = 0; i <= n; i++) {
      const big = i === n;
      // Regular meteors land stratified over the barrage; the big one comes last, on the enemy.
      const impactTime = big
        ? s.anticipation + flight + s.barrageTime + 0.5
        : s.anticipation + flight + ((i + Math.random()) / n) * s.barrageTime;
      const size = big ? s.meteorSize * BIG_SCALE : s.meteorSize * (1 + (Math.random() * 2 - 1) * s.sizeJitter);
      const target = new THREE.Vector3();
      if (!big) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.6 + Math.sqrt(Math.random()) * Math.max(0, s.areaRadius - 1.6); // keep clear of the enemy
        target.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      }
      const dir = big ? baseDir.clone() : baseDir.clone().add(new THREE.Vector3(0, 0, (Math.random() - 0.5) * 0.14)).normalize();
      const speed = big ? s.fallSpeed * 0.85 : s.fallSpeed * (0.9 + Math.random() * 0.2);
      const start = target.clone().addScaledVector(dir, -pathLen);
      const launchTime = impactTime - pathLen / speed;
      this.meteors.push({
        big, size, target, start, dir, speed, launchTime, impactTime,
        warnTime: big ? 0.3 : 0.3 + Math.random() * Math.max(0.1, s.anticipation - 0.6),
        spin: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6),
        impacted: false,
      });
    }
    this.bigImpact = this.meteors[n].impactTime;

    const count = n + 1;
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, colored: boolean) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      if (colored) {
        for (let i = 0; i < count; i++) m.setColorAt(i, this.col.setRGB(1, 1, 1));
        m.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      }
      for (let i = 0; i < count; i++) m.setMatrixAt(i, this.hidden);
      this.group.add(m);
      return m;
    };
    this.rocks = mk(this.rockGeo, this.rockMat, true);
    // Dark, slightly varied basalt tones.
    for (let i = 0; i < count; i++) {
      const g = 0.22 + Math.random() * 0.22;
      this.rocks.setColorAt(i, this.col.setRGB(g * 1.15, g * 0.95, g * 0.85));
    }
    this.glows = mk(this.glowGeo, this.glowMat, false);
    this.marks = mk(this.markGeo, this.ringMat, true);
    this.shocks = mk(this.shockGeo, this.ringMat, true);
  }

  /** Pushes colour settings to the materials and emitters. */
  applyStyle() {
    const s = this.settings;
    this.fire.set(s.fireColor);
    (this.dome.material as THREE.MeshBasicMaterial).color.set(s.skyColor);
    this.glowMat.color.copy(this.fire).multiplyScalar(1.4);
    this.rockMat.emissive.copy(this.fire).multiplyScalar(0.7);
    this.impactLight.color.copy(this.fire);
    this.trail.settings.colorMid = s.fireColor;
    this.sparks.settings.colorEnd = s.fireColor;
    this.trail.applyStyle();
    this.sparks.applyStyle();
  }

  get duration() {
    return this.bigImpact + AFTERMATH;
  }

  play() {
    this.build();
    this.time = 0;
    this.killed = false;
    this.enemyFlash = 0;
    this.lightFlash = 0;
    this.kick = 0;
    this.shake = 0;
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.playing = true;
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

    this.kick *= Math.exp(-dt * 7);
    this.enemyFlash *= Math.exp(-dt * 7);
    this.lightFlash *= Math.exp(-dt * 6);
    for (const m of this.meteors) {
      if (!m.impacted && this.time >= m.impactTime) this.onImpact(m);
    }
    this.layout(dt);

    // Low rumble while the sky darkens, then the accumulated impact kicks.
    const rumble = 0.04 * smoothstep(this.time / Math.max(0.1, this.settings.anticipation)) * (this.time < this.bigImpact ? 1 : 0);
    this.shake = this.kick + rumble;
  }

  private layout(dt = 0) {
    const s = this.settings;
    const t = this.time;
    const closing = 1 - smoothstep((t - (this.duration - FADE)) / FADE);

    // Sky: reddens and darkens during the anticipation, holds through the barrage, clears at the end.
    const skyIn = smoothstep(t / Math.max(0.1, s.anticipation));
    const skyOut = smoothstep((t - (this.bigImpact + 0.5)) / (AFTERMATH - 0.5));
    (this.dome.material as THREE.MeshBasicMaterial).opacity = 0.3 * skyIn * (1 - skyOut);
    this.dome.visible = this.playing || t > 0;

    this.impactLight.intensity = this.lightFlash * 500;

    for (let i = 0; i < this.meteors.length; i++) {
      const m = this.meteors[i];
      const flying = t >= m.launchTime && t < m.impactTime;
      const sinceImpact = t - m.impactTime;

      // Rock + glow shell while falling, a half-buried glowing rubble chunk afterwards.
      if (flying) {
        const local = t - m.launchTime;
        const pos = this.v1.copy(m.start).addScaledVector(m.dir, m.speed * local);
        this.dummy.position.copy(pos);
        this.dummy.rotation.set(m.spin.x * local, m.spin.y * local, m.spin.z * local);
        this.dummy.scale.set(m.size, m.size * 0.85, m.size * 1.1);
        this.dummy.updateMatrix();
        this.rocks.setMatrixAt(i, this.dummy.matrix);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(m.size * 1.8);
        this.dummy.updateMatrix();
        this.glows.setMatrixAt(i, this.dummy.matrix);

        // Fire trail and smoke along the path (random rounding keeps the rate frame-rate independent).
        if (dt > 0) {
          const rate = m.big ? 260 : 110;
          this.trail.burst(Math.floor(rate * dt + Math.random()), pos);
          // Smoke is laid down a little behind the fire so it reads as a dark wake.
          this.v2.copy(pos).addScaledVector(m.dir, -m.size * 1.6);
          this.smoke.burst(Math.floor(rate * 0.4 * dt + Math.random()), this.v2);
        }
      } else if (sinceImpact >= 0 && closing > 0.001) {
        this.dummy.position.copy(m.target);
        this.dummy.position.y = m.size * 0.1;
        this.dummy.rotation.set(m.spin.x, m.spin.y, m.spin.z);
        this.dummy.scale.set(m.size * 0.5, m.size * 0.3, m.size * 0.55).multiplyScalar(closing);
        this.dummy.updateMatrix();
        this.rocks.setMatrixAt(i, this.dummy.matrix);
        this.glows.setMatrixAt(i, this.hidden);
      } else {
        this.rocks.setMatrixAt(i, this.hidden);
        this.glows.setMatrixAt(i, this.hidden);
      }

      // Ground decal: pulsing warning ring before the hit, cooling crater glow after.
      const radius = m.size * 1.8;
      if (sinceImpact < 0 && t >= m.warnTime) {
        const appear = smoothstep((t - m.warnTime) / 0.4);
        const pulse = 0.55 + 0.45 * Math.sin(t * 12 + i);
        const approach = 1 - 0.25 * smoothstep(1 - (m.impactTime - t) / Math.max(0.1, m.impactTime - m.warnTime));
        this.dummy.position.copy(m.target);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(radius * approach);
        this.dummy.updateMatrix();
        this.marks.setMatrixAt(i, this.dummy.matrix);
        this.marks.setColorAt(i, this.col.copy(this.warn).multiplyScalar(0.7 * appear * pulse));
      } else if (sinceImpact >= 0 && closing > 0.001) {
        const heat = (0.15 + 0.85 * Math.exp(-sinceImpact * 0.9)) * closing;
        this.dummy.position.copy(m.target);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(radius * 1.15);
        this.dummy.updateMatrix();
        this.marks.setMatrixAt(i, this.dummy.matrix);
        this.marks.setColorAt(i, this.col.copy(this.fire).multiplyScalar(0.9 * heat));
      } else {
        this.marks.setMatrixAt(i, this.hidden);
      }

      // Expanding shockwave ring.
      const shockAge = sinceImpact / (SHOCK_TIME * (m.big ? 1.6 : 1));
      if (shockAge >= 0 && shockAge < 1) {
        const ease = 1 - (1 - shockAge) * (1 - shockAge);
        this.dummy.position.copy(m.target);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(m.size * (0.6 + 4.5 * ease));
        this.dummy.updateMatrix();
        this.shocks.setMatrixAt(i, this.dummy.matrix);
        this.shocks.setColorAt(i, this.col.copy(this.fire).multiplyScalar(0.9 * (1 - shockAge) * (1 - shockAge)));
      } else {
        this.shocks.setMatrixAt(i, this.hidden);
      }
    }
    this.rocks.instanceMatrix.needsUpdate = true;
    this.glows.instanceMatrix.needsUpdate = true;
    this.marks.instanceMatrix.needsUpdate = true;
    this.shocks.instanceMatrix.needsUpdate = true;
    this.rocks.instanceColor!.needsUpdate = true;
    this.marks.instanceColor!.needsUpdate = true;
    this.shocks.instanceColor!.needsUpdate = true;

    // Enemy flinches from close hits, then is crushed by the big meteor.
    this.enemy.setFlash(Math.min(this.enemyFlash, 1.2));
    if (this.killed) {
      this.enemy.setCrush(smoothstep((t - this.bigImpact) / 0.25));
    } else {
      this.enemy.group.rotation.x = -0.15 * Math.min(this.enemyFlash, 1);
    }
  }

  private onImpact(m: Meteor) {
    m.impacted = true;
    this.sparks.burst(m.big ? 700 : 40, m.target);
    this.dust.burst(m.big ? 120 : 10, m.target);
    this.smoke.burst(m.big ? 60 : 0, m.target);
    this.kick = Math.min(this.kick + (m.big ? 0.7 : 0.07), 0.9);
    this.lightFlash = Math.min(this.lightFlash + (m.big ? 1.5 : 0.35), 1.5);
    this.impactLight.position.set(m.target.x, 2.5, m.target.z);
    if (m.big) {
      this.killed = true;
      this.enemyFlash = 1.5;
      this.sparks.burst(500, ENEMY_POS);
    } else if (Math.hypot(m.target.x, m.target.z) < 3.2) {
      this.enemyFlash = Math.min(this.enemyFlash + 0.4, 1.5);
    }
  }
}

/** A lumpy unit rock: an icosahedron with its vertices pushed in and out by a position hash. */
function createRockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Same hash for coincident vertices, so faces stay joined.
    const h = Math.abs(Math.sin(v.x * 127.1 + v.y * 311.7 + v.z * 74.7) * 43758.5453) % 1;
    v.multiplyScalar(0.78 + 0.4 * h);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export const meteorShowerModule: EffectModule = {
  label: 'meteor shower',
  create: () => new MeteorShower(),
  telegraphs(effect) {
    const s = (effect as MeteorShower).settings;
    const end = s.anticipation + s.barrageTime;
    return [
      // The whole bombardment area stays dangerous through the barrage…
      { shape: { kind: 'circle', x: 0, z: 0, radius: s.areaRadius + 1.5 }, start: 0.1, impact: s.anticipation, until: end },
      // …and the final giant meteor gets its own tighter warning.
      { shape: { kind: 'circle', x: 0, z: 0, radius: 4.5 }, start: end - 1.2, impact: end + 0.5 },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.8 },
  frameCamera(camera, controls, effect) {
    const s = (effect as MeteorShower).settings;
    // Side-on view: the meteors fall from the upper left toward the enemy at the origin.
    const ang = THREE.MathUtils.degToRad(s.fallAngle);
    const drift = Math.tan(ang) * s.fallHeight; // horizontal run of the fall
    const dist = Math.max(45, s.fallHeight * 1.5 + s.areaRadius * 1.5);
    camera.position.set(drift * 0.25, s.fallHeight * 0.5, dist);
    controls.target.set(-drift * 0.35, s.fallHeight * 0.3, 0);
  },
  buildGui(f, effect) {
    const m = effect as MeteorShower;
    const s = m.settings;
    // Layout changes take effect on the next play (which rebuilds everything).
    f.add(s, 'loop');
    f.add(s, 'meteorCount', 5, 60, 1).name('meteors');
    f.add(s, 'meteorSize', 0.2, 2, 0.05).name('meteor size');
    f.add(s, 'sizeJitter', 0, 1, 0.01).name('size variation');
    f.add(s, 'fallAngle', 0, 70, 1).name('fall angle');
    f.add(s, 'fallHeight', 15, 80, 1).name('fall height');
    f.add(s, 'fallSpeed', 15, 120, 1).name('fall speed');
    f.add(s, 'anticipation', 0.3, 4, 0.1).name('anticipation');
    f.add(s, 'barrageTime', 1, 10, 0.1).name('barrage time');
    f.add(s, 'areaRadius', 3, 20, 0.5).name('area radius');
    f.addColor(s, 'fireColor').name('fire color').onChange(() => m.applyStyle());
    f.addColor(s, 'skyColor').name('sky color').onChange(() => m.applyStyle());
  },
};
