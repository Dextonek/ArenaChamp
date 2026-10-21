import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { ENEMY_POS, Enemy, GlowSphere, createGround, frameArena, smoothstep } from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Deep Breath (reworked): a vast bronze dragon sweeps low across the arena in a straight line, pouring a
 * continuous torrent of fire down and ahead of it. The ground ignites along its path and a scorch strip grows
 * behind it, black smoke rolls up, embers drift, and the enemy in the way is engulfed and crushed. The dragon's
 * shadow sweeps across the ground beneath it.
 */
export interface DeepBreathSettings {
  flyTime: number; // seconds to cross the arena
  halfPath: number; // half length of the flight line
  altitude: number;
  color: string; // fire hot colour
  loop: boolean;
}

export const defaultDeepBreath = (): DeepBreathSettings => ({
  flyTime: 3,
  halfPath: 20,
  altitude: 8,
  color: '#ff7a1a',
  loop: false,
});

const PRE = 0.5;
const AFTERMATH = 2.4;
const TAIL_N = 9;
const JET_ANGLE = THREE.MathUtils.degToRad(48); // downward angle of the fire stream
const STRIP_W = 4.6;

/** A soft-edged alpha texture: `ex`/`ey` are the edge fade fractions along u/v, `round` makes it an ellipse. */
function softTexture(ex: number, ey: number, round = false): THREE.CanvasTexture {
  const n = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  const edge = (u: number, e: number) => {
    const d = Math.min(u, 1 - u);
    return e <= 0 ? 1 : Math.min(1, d / e);
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n, v = (y + 0.5) / n;
      let a: number;
      if (round) {
        const r = Math.hypot(u - 0.5, v - 0.5) * 2;
        a = smoothstep((1 - r) / 0.7);
      } else {
        a = smoothstep(edge(u, ex)) * smoothstep(edge(v, ey));
      }
      img.data.set([0, 0, 0, Math.round(a * 255)], (y * n + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function wingGeometry(sign: number): THREE.BufferGeometry {
  // Triangle fan from the shoulder out along the finger bones and back to the body (z mirrored by `sign`).
  const rim: [number, number, number][] = [
    [2.2, 0.9, 1.0], [0.6, 1.6, 4.0], [-0.4, 1.8, 7.2], [-1.6, 1.1, 10], [-2.6, 0.8, 7.6],
    [-3.4, 0.6, 5.0], [-3.6, 0.5, 2.8], [-2.8, 0.3, 0.8],
  ];
  const verts: number[] = [0, 0, 0];
  for (const [x, y, z] of rim) verts.push(x, y, z * sign);
  const idx: number[] = [];
  for (let i = 1; i < rim.length; i++) idx.push(...(sign > 0 ? [0, i, i + 1] : [0, i + 1, i]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class DeepBreath implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DeepBreathSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private startHitZ = 0;
  private lastHitZ = 0;

  private enemy = new Enemy();
  private dragon = new THREE.Group();
  private bronze = new THREE.MeshStandardMaterial({
    color: 0x7a5a30, metalness: 0.5, roughness: 0.5, emissive: 0x401a08, emissiveIntensity: 0.5, side: THREE.DoubleSide,
  });
  private eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1000, emissive: 0xff7a1a, emissiveIntensity: 1 });
  private wingL = new THREE.Group();
  private wingR = new THREE.Group();
  private tail: THREE.Mesh[] = [];
  private mouthGlow = new GlowSphere(0xffb04a, { rim: false });
  private burnGlow = new GlowSphere(0xff8a2a, { rim: false });
  private shadow: THREE.Mesh;
  private scorch: THREE.Mesh;
  private flames: Emitter;
  private smoke: Emitter;
  private groundFire: Emitter;
  private embers: Emitter;
  private light = new THREE.PointLight(0xff8a2a, 0, 50, 1.5);
  private tmp = new THREE.Vector3();
  private mouth = new THREE.Vector3();

  constructor(settings: DeepBreathSettings = defaultDeepBreath()) {
    this.settings = settings;
    this.group.add(createGround(), this.enemy.group);

    // Shadow and scorch decals (normal-blended dark layers on the ground).
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: softTexture(0, 0, true), color: 0x000000, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.scorch = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: softTexture(0.45, 0.04), color: 0x000000, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.position.y = 0.045;
    this.group.add(this.shadow, this.scorch);

    this.buildDragon();
    this.group.add(this.dragon, this.mouthGlow.mesh, this.burnGlow.mesh, this.light);

    // Fire is emitted by placing particles along the stream path each frame (the emitter itself only fires in a
    // cone around +Y); the particles then just billow and rise.
    this.flames = new Emitter({
      ...defaultSettings(), maxParticles: 2200, rate: 0, lifetime: 0.65, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.2, speed: 1.2, speedJitter: 0.6, spread: 180, gravity: -2.5, drag: 0.8,
      sizeStart: 0.9, sizeEnd: 1.9, colorStart: '#fff2c0', colorMid: settings.color, colorEnd: '#5a1204',
      opacityStart: 0.5, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, spin: 0.5,
    });
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 1400, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 1.4, speedJitter: 0.6, spread: 70, gravity: -1.2, drag: 0.9,
      sizeStart: 1.4, sizeEnd: 3.8, colorStart: '#3a3028', colorEnd: '#0c0a09',
      opacityStart: 0.5, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
    });
    this.groundFire = new Emitter({
      ...defaultSettings(), maxParticles: 1800, rate: 0, lifetime: 1.1, lifetimeJitter: 0.45,
      shape: 'sphere', shapeSize: 0.5, speed: 2.8, speedJitter: 0.6, spread: 35, gravity: -1.5, drag: 0.7,
      sizeStart: 0.8, sizeEnd: 1.4, colorStart: '#ffe6a0', colorMid: '#ff7a1a', colorEnd: '#4a0f04',
      opacityStart: 0.45, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, spin: 0.5, groundFade: 0.25,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 2.4, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 3.5, speedJitter: 0.7, spread: 50, gravity: -1.6, drag: 0.5,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#fff0b0', colorEnd: '#ff4a10',
      opacityStart: 0.9, opacityEnd: 0, additive: true, erosion: 0,
    });
    // Smoke first (dark, behind), then the bright layers.
    this.emitters.push(this.smoke, this.groundFire, this.flames, this.embers);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  private buildDragon() {
    // Local axes: +X forward (head), +Y up, Z across the wings. Rotated to face -Z in layout().
    const m = this.bronze;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 3.6, 8, 16), m);
    body.rotation.z = Math.PI / 2;
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.6, 6, 12), m);
    neck.position.set(2.9, 0.45, 0);
    neck.rotation.z = Math.PI / 2 - 0.55;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.1, 10), m);
    head.position.set(4.3, 0.3, 0);
    head.rotation.z = -Math.PI / 2 - 0.15;
    const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 8), m);
    jaw.position.set(4.1, -0.15, 0);
    jaw.rotation.z = -Math.PI / 2 + 0.25;
    this.dragon.add(body, neck, head, jaw);

    const hornGeo = new THREE.ConeGeometry(0.14, 1.0, 6);
    const eyeGeo = new THREE.SphereGeometry(0.12, 8, 6);
    for (const z of [-0.32, 0.32]) {
      const horn = new THREE.Mesh(hornGeo, m);
      horn.position.set(3.4, 0.95, z * 1.2);
      horn.rotation.z = Math.PI / 2 + 0.7;
      const eye = new THREE.Mesh(eyeGeo, this.eyeMat);
      eye.position.set(4.0, 0.62, z * 1.1);
      this.dragon.add(horn, eye);
    }
    // Spine spikes.
    const spikeGeo = new THREE.ConeGeometry(0.16, 0.6, 6);
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(spikeGeo, m);
      spike.position.set(2.2 - i * 1.0, 0.95 - i * 0.03, 0);
      this.dragon.add(spike);
    }
    // Tapering tail of spheres, ending in a cone; swayed in layout().
    for (let i = 0; i < TAIL_N; i++) {
      const r = 0.8 * (1 - i / (TAIL_N + 1)) + 0.1;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m);
      this.tail.push(seg);
      this.dragon.add(seg);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 8), m);
    tip.rotation.z = Math.PI / 2;
    this.tail.push(tip);
    this.dragon.add(tip);

    // Wings pivot at the shoulders and flap about the body axis (X).
    this.wingR.position.set(0.9, 0.7, 0.5);
    this.wingL.position.set(0.9, 0.7, -0.5);
    this.wingR.add(new THREE.Mesh(wingGeometry(1), m));
    this.wingL.add(new THREE.Mesh(wingGeometry(-1), m));
    this.dragon.add(this.wingR, this.wingL);
  }

  applyStyle() {
    this.flames.settings.colorMid = this.settings.color;
    this.flames.applyStyle();
  }

  get duration() {
    return PRE + this.settings.flyTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.startHitZ = 0;
    this.lastHitZ = 0;
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  /** Dragon z at time t: constant speed from +halfPath to -halfPath. */
  private dragonZ(t: number) {
    const s = this.settings;
    const u = Math.min(1, Math.max(0, (t - PRE) / s.flyTime));
    return s.halfPath - 2 * s.halfPath * u;
  }

  private flying(t: number) {
    return t >= PRE && t <= PRE + this.settings.flyTime;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    this.layout();
    if (this.flying(this.time)) this.breathe(dt);
    // Embers and a little smoke keep rising from the scorched strip after the dragon has passed.
    else if (this.time > PRE + this.settings.flyTime && this.time < this.duration - 0.8) this.smoulder(dt);
  }

  /** Fire stream: mouth -> ground ahead; particles are placed along the path with a widening cone. */
  private breathe(dt: number) {
    const t = this.time;
    const s = this.settings;
    const ramp = smoothstep((t - PRE) / 0.4) * (1 - smoothstep((t - (PRE + s.flyTime - 0.35)) / 0.35));
    if (ramp <= 0.01) return;
    const mouth = this.mouth;
    const len = mouth.y / Math.sin(JET_ANGLE);
    const dirZ = -Math.cos(JET_ANGLE), dirY = -Math.sin(JET_ANGLE);
    const hitZ = mouth.z + dirZ * len;
    if (this.startHitZ === 0 && this.lastHitZ === 0) this.startHitZ = hitZ;
    this.lastHitZ = hitZ;

    const n = Math.round(900 * dt * ramp);
    for (let i = 0; i < n; i++) {
      const u = Math.pow(Math.random(), 0.8);
      const w = 0.25 + u * 1.4; // cone radius grows with distance
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * w;
      this.tmp.set(
        Math.cos(a) * r,
        mouth.y + dirY * u * len + Math.sin(a) * r * 0.6,
        mouth.z + dirZ * u * len,
      );
      this.flames.burst(1, this.tmp);
    }
    // Dark smoke trails above and behind the stream.
    const sm = Math.round(110 * dt * ramp);
    for (let i = 0; i < sm; i++) {
      const u = 0.25 + Math.random() * 0.75;
      this.tmp.set((Math.random() - 0.5) * 2, mouth.y + dirY * u * len + 0.8, mouth.z + dirZ * u * len + 1.5 + Math.random() * 2);
      this.smoke.burst(1, this.tmp);
    }
    // Splash where the stream hits the ground, plus a burning strip behind it (older ground stays aflame).
    const gf = Math.round(380 * dt * ramp);
    for (let i = 0; i < gf; i++) {
      const spread = (Math.random() - 0.5) * STRIP_W * 0.8;
      this.tmp.set(spread, 0.1, hitZ + (Math.random() - 0.3) * 1.6);
      this.groundFire.burst(1, this.tmp);
    }
    const strip = Math.round(260 * dt * ramp);
    for (let i = 0; i < strip; i++) {
      const z = THREE.MathUtils.lerp(this.startHitZ, hitZ, Math.random());
      this.tmp.set((Math.random() - 0.5) * STRIP_W * 0.7, 0.1, z);
      this.groundFire.burst(1, this.tmp);
      if (Math.random() < 0.25) {
        this.tmp.y = 0.8;
        this.smoke.burst(1, this.tmp);
      }
      if (Math.random() < 0.3) this.embers.burst(1, this.tmp);
    }
    // Direct hit: extra roar of fire on the enemy while the stream covers it.
    if (Math.abs(hitZ - ENEMY_POS.z) < 2.6) {
      const k = Math.round(260 * dt * ramp);
      for (let i = 0; i < k; i++) {
        this.tmp.set((Math.random() - 0.5) * 1.6, Math.random() * 2.2, ENEMY_POS.z + (Math.random() - 0.5) * 1.6);
        this.flames.burst(1, this.tmp);
      }
    }
  }

  private smoulder(dt: number) {
    const fade = 1 - smoothstep((this.time - (this.duration - 1.6)) / 1.2);
    const n = Math.round(90 * dt * fade);
    for (let i = 0; i < n; i++) {
      const z = THREE.MathUtils.lerp(this.startHitZ, this.lastHitZ, Math.random());
      this.tmp.set((Math.random() - 0.5) * STRIP_W * 0.7, 0.1, z);
      this.groundFire.burst(1, this.tmp);
      if (Math.random() < 0.35) this.embers.burst(1, this.tmp);
      if (Math.random() < 0.2) { this.tmp.y = 0.8; this.smoke.burst(1, this.tmp); }
    }
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const flyEnd = PRE + s.flyTime;
    const fade = 1 - smoothstep((t - (this.duration - 0.8)) / 0.8);
    const z = this.dragonZ(t);
    const y = s.altitude + 0.35 * Math.sin(t * 2.2);

    // Dragon: faces -Z (local +X forward), banks slightly toward the camera, flaps, tail sways.
    const d = this.dragon;
    d.position.set(0, y, z);
    d.rotation.set(0.32, Math.PI / 2, 0.05 * Math.sin(t * 2.2));
    d.scale.setScalar(0.95);
    d.visible = t > 0.02 && t < flyEnd + 0.05;
    const flap = 0.55 * Math.sin(t * 7.5) + 0.15;
    this.wingR.rotation.x = -flap;
    this.wingL.rotation.x = flap;
    for (let i = 0; i < this.tail.length; i++) {
      const u = (i + 1) / this.tail.length;
      const x = -2.3 - u * 7.2;
      const sway = Math.sin(t * 5 - u * 4.5) * 0.9 * u;
      this.tail[i].position.set(x, -0.15 - u * 0.2, sway);
      if (i === this.tail.length - 1) this.tail[i].position.x -= 0.5;
    }
    this.eyeMat.emissiveIntensity = 0.9 + 0.4 * Math.sin(t * 9);

    // Mouth position in world space (also where the stream starts).
    d.updateMatrixWorld(true);
    this.mouth.set(5.2, 0.05, 0);
    d.localToWorld(this.mouth);
    this.mouthGlow.mesh.position.copy(this.mouth);
    const breathing = this.flying(t) ? smoothstep((t - PRE) / 0.4) : 0;
    this.mouthGlow.mesh.scale.setScalar(0.7 + 0.2 * Math.sin(t * 25));
    this.mouthGlow.opacity = 0.45 * breathing;

    // Shadow sweeps across the ground under the dragon; stronger when it is closer to the enemy line.
    const sh = smoothstep(t / PRE) * (1 - smoothstep((t - flyEnd) / 0.4)) * fade;
    this.shadow.position.set(0, 0.03, z + (t < PRE ? s.halfPath : 0));
    this.shadow.scale.set(21, 11, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * sh;
    if (t < PRE) this.shadow.position.z = s.halfPath;

    // Scorch strip: grows from where the stream first hit the ground to where it hits now.
    const len = Math.max(0.001, Math.abs(this.lastHitZ - this.startHitZ));
    this.scorch.position.set(0, 0.045, (this.lastHitZ + this.startHitZ) / 2);
    this.scorch.scale.set(STRIP_W * 1.5, len + 3, 1);
    (this.scorch.material as THREE.MeshBasicMaterial).opacity = (this.lastHitZ === 0 && this.startHitZ === 0 ? 0 : 0.7) * fade;

    // Light riding the point where the fire lands.
    const hitZ = this.lastHitZ;
    this.light.position.set(0, 3, hitZ);
    const burning = this.flying(t) ? 1 : Math.exp(-(t - flyEnd) * 1.6);
    this.light.intensity = (t >= PRE ? 420 : 0) * burning * fade;
    this.burnGlow.mesh.position.set(0, 0.8, hitZ);
    this.burnGlow.mesh.scale.setScalar(2.8);
    this.burnGlow.opacity = 0.18 * (this.flying(t) ? breathing : 0);

    // Enemy: engulfed while the stream covers it, then crushed as the dragon leaves.
    const engulfed = this.startHitZ !== 0 && this.lastHitZ < ENEMY_POS.z + 2.6 && t < flyEnd + 1.2;
    const cover = engulfed ? smoothstep((ENEMY_POS.z + 2.6 - this.lastHitZ) / 1.2) : 0;
    const flick = 0.75 + 0.25 * Math.sin(t * 40);
    this.enemy.setFlash(cover * 0.9 * flick * (1 - smoothstep((t - (flyEnd + 0.4)) / 0.8)));
    this.enemy.setCrush(smoothstep((t - (flyEnd - 0.6)) / 1.0));
    this.shake = this.flying(t) ? 0.08 + 0.22 * cover : 0.25 * Math.exp(-(t - flyEnd) * 3) * (t > flyEnd ? 1 : 0) + (t < PRE ? 0.1 * smoothstep(t / PRE) : 0);
  }
}

export const deepBreathModule: EffectModule = {
  label: 'deep breath',
  category: 'iconic',
  create: () => new DeepBreath(),
  bloom: { enabled: true, strength: 0.55, radius: 0.55, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const s = (effect as DeepBreath).settings;
    // The whole flight line (along Z) plus the dragon's height must fit.
    frameArena(camera, controls, new THREE.Vector3(0, s.altitude * 0.4, 0), Math.max(14, s.halfPath * 1.15));
  },
  buildGui(f, effect) {
    const b = effect as DeepBreath;
    const s = b.settings;
    f.add(s, 'loop');
    f.add(s, 'flyTime', 1.5, 6, 0.1).name('fly time');
    f.add(s, 'altitude', 4, 16, 0.5);
    f.addColor(s, 'color').onChange(() => b.applyStyle());
  },
};
