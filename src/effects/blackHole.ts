import * as THREE from 'three';
import { Emitter, defaultSettings } from '../emitter';
import { Enemy, GlowSphere, createGround, smoothstep, softDotTexture } from './common';
import type { Effect, EffectModule } from './types';

/**
 * "Black hole": a hole opens above and slightly behind the enemy, grows an event horizon, a photon ring and
 * a glowing accretion disk, then drags debris, dust and finally the enemy into itself. It collapses in a
 * flash and a shockwave. Lensing is faked with a dim dark halo and the camera-facing photon ring.
 */
export interface BlackHoleSettings {
  holeSize: number; // event horizon radius
  diskRadius: number; // outer edge of the accretion disk
  diskParticles: number;
  pullStrength: number; // 1 = default pace; higher pulls faster
  debrisCount: number;
  diskInnerColor: string;
  diskOuterColor: string;
  ringColor: string;
  loop: boolean;
}

export const defaultBlackHole = (): BlackHoleSettings => ({
  holeSize: 1.4,
  diskRadius: 7,
  diskParticles: 2400,
  pullStrength: 1,
  debrisCount: 220,
  diskInnerColor: '#ffd9a0',
  diskOuterColor: '#5a1a8a',
  ringColor: '#ffb878',
  loop: false,
});

const OPEN = 1.5;
const PULL = 3;
const COLLAPSE = 0.6;
const AFTERMATH = 2;
const T_PULL = OPEN;
const T_COLLAPSE = OPEN + PULL;
const T_FLASH = T_COLLAPSE + COLLAPSE;
const DURATION = T_FLASH + AFTERMATH;
const HOLE_POS = new THREE.Vector3(0, 6, -1.5);
const UP = new THREE.Vector3(0, 1, 0);
const MAX_DISK = 3000;
const MAX_DEBRIS = 300;
const DUST_COUNT = 700;
const GLINTS = 140; // additive glints kept from the old swirl (the dust body is now the dark emitter)

interface Rock {
  r0: number;
  a0: number;
  delay: number;
  size: number;
  spin: number;
}

export class BlackHole implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BlackHoleSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;
  /** Set by frameCamera so the photon ring can face the viewer. */
  camera: THREE.Camera | null = null;

  private time = 0;
  private flashed = false;
  private spike = 0;
  private diskPhase = 0;

  private holeGroup = new THREE.Group();
  private horizon = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  private halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  private ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.3, 0.95, 0.6), transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private photonRing = new THREE.Mesh(new THREE.RingGeometry(1.14, 1.2, 64), this.ringMat);
  private tiltRing = new THREE.Mesh(new THREE.RingGeometry(1.38, 1.41, 64), this.ringMat);
  private flash = new GlowSphere(new THREE.Color(1.6, 1.3, 0.9));
  private shockMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.4, 0.9, 0.6), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private shockGeo = new THREE.RingGeometry(0.9, 1, 72);
  private shockAir = new THREE.Mesh(this.shockGeo, this.shockMat);
  private shockGround = new THREE.Mesh(this.shockGeo, this.shockMat);

  // Accretion disk.
  private diskGroup = new THREE.Group();
  private diskMat = new THREE.PointsMaterial({
    size: 0.17, map: softDotTexture(), vertexColors: true, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private disk: THREE.Points | null = null;
  private diskPos = new Float32Array(0);
  private diskR = new Float32Array(0);
  private diskA = new Float32Array(0);
  private diskY = new Float32Array(0);

  // Debris.
  private rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  private rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  private rocks: THREE.InstancedMesh | null = null;
  private rockData: Rock[] = [];

  // Ground dust swirl.
  private dustMat = new THREE.PointsMaterial({
    size: 0.3, map: softDotTexture(), vertexColors: true, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private swirl: THREE.Points;
  private swirlPos = new Float32Array(DUST_COUNT * 3);
  private swirlCol = new Float32Array(DUST_COUNT * 3);
  private swirlR = new Float32Array(DUST_COUNT);
  private swirlA = new Float32Array(DUST_COUNT);
  private swirlP = new Float32Array(DUST_COUNT);
  private swirlY = new Float32Array(DUST_COUNT);

  private enemy = new Enemy();
  private sparks: Emitter;
  private dust: Emitter;
  private groundDust: Emitter;
  private groundAcc = 0;

  private dummy = new THREE.Object3D();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private cA = new THREE.Color();
  private cB = new THREE.Color();
  private cC = new THREE.Color();
  private hidden = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4); // never 0: a singular instance matrix gives NaN normals → black bloomed frame

  constructor(settings: BlackHoleSettings = defaultBlackHole()) {
    this.settings = settings;

    this.group.add(createGround());
    this.group.add(this.enemy.group);

    this.tiltRing.rotation.set(1.1, 0.4, 0);
    this.holeGroup.add(this.horizon, this.halo, this.photonRing, this.tiltRing);
    this.holeGroup.position.copy(HOLE_POS);
    this.flash.mesh.position.copy(HOLE_POS);
    this.shockAir.position.copy(HOLE_POS);
    this.shockAir.rotation.x = -Math.PI / 2;
    this.shockGround.position.set(0, 0.08, 0);
    this.shockGround.rotation.x = -Math.PI / 2;
    this.diskGroup.position.copy(HOLE_POS);
    this.diskGroup.rotation.set(0.5, 0, 0.22);
    this.group.add(this.holeGroup, this.flash.mesh, this.shockAir, this.shockGround, this.diskGroup);

    // Ground dust swirl: each mote loops from the ground edge spiralling in toward the hole.
    const sg = new THREE.BufferGeometry();
    for (let i = 0; i < DUST_COUNT; i++) {
      this.swirlR[i] = 1.5 + Math.random() * 14;
      this.swirlA[i] = Math.random() * Math.PI * 2;
      this.swirlP[i] = Math.random();
      this.swirlY[i] = Math.random() * 0.4;
    }
    sg.setAttribute('position', new THREE.BufferAttribute(this.swirlPos, 3).setUsage(THREE.DynamicDrawUsage));
    sg.setAttribute('color', new THREE.BufferAttribute(this.swirlCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.swirl = new THREE.Points(sg, this.dustMat);
    this.swirl.frustumCulled = false;
    sg.setDrawRange(0, GLINTS);
    this.group.add(this.swirl);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 1.2, lifetimeJitter: 0.5,
      shape: 'point', shapeSize: 0, speed: 14, speedJitter: 0.6, spread: 180, gravity: 5, drag: 1.2,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffe2b0', colorEnd: '#a040ff',
      opacityStart: 0.5, opacityEnd: 0, additive: true,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 6, speedJitter: 0.5, spread: 85, gravity: -0.3, drag: 1.5,
      sizeStart: 0.9, sizeEnd: 3, colorStart: '#5a544c', colorEnd: '#2a2a30',
      colorMid: '#403b38', sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
      opacityStart: 0.2, opacityEnd: 0, additive: false,
    });
    // Dark dust lifted off the ground while the hole feeds (normal-blended, eroded) -- replaces the old additive swirl body.
    this.groundDust = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, originY: 0.1, speed: 1.4, speedJitter: 0.6, spread: 80, gravity: -0.4, drag: 1.0,
      sizeStart: 0.8, sizeEnd: 2.6, colorStart: '#3e3732', colorEnd: '#141416',
      colorMid: '#2c2724', sizeJitter: 0.45, erosion: 0.6, spin: 0.35,
      opacityStart: 0.3, opacityEnd: 0, additive: false,
    });
    this.emitters.push(this.sparks, this.dust, this.groundDust);
    for (const e of this.emitters) this.group.add(e.points);

    this.build();
    this.layout();
  }

  /** (Re)creates the disk and the debris from the settings. */
  build() {
    const s = this.settings;
    const R = s.holeSize;

    if (this.disk) { this.diskGroup.remove(this.disk); this.disk.geometry.dispose(); }
    const n = Math.max(10, Math.min(MAX_DISK, Math.floor(s.diskParticles)));
    this.diskPos = new Float32Array(n * 3);
    this.diskR = new Float32Array(n);
    this.diskA = new Float32Array(n);
    this.diskY = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const rIn = R * 1.5;
    const rOut = Math.max(rIn + 0.5, s.diskRadius);
    this.cA.set(s.diskInnerColor);
    this.cB.set(s.diskOuterColor);
    for (let i = 0; i < n; i++) {
      const f = Math.pow(Math.random(), 1.7); // denser toward the centre
      const r = rIn + f * (rOut - rIn);
      this.diskR[i] = r;
      this.diskA[i] = Math.random() * Math.PI * 2;
      this.diskY[i] = (Math.random() + Math.random() - 1) * 0.07 * r;
      // Hot white-orange inside, deep red/purple outside, a little brightness noise.
      const heat = Math.pow(1 - f, 1.5);
      this.cC.copy(this.cB).lerp(this.cA, heat).multiplyScalar(0.7 + Math.random() * 0.3);
      col[i * 3] = this.cC.r; col[i * 3 + 1] = this.cC.g; col[i * 3 + 2] = this.cC.b;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(this.diskPos, 3).setUsage(THREE.DynamicDrawUsage));
    dg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.disk = new THREE.Points(dg, this.diskMat);
    this.disk.frustumCulled = false;
    this.diskGroup.add(this.disk);

    if (this.rocks) { this.group.remove(this.rocks); this.rocks.dispose(); }
    const m = Math.max(1, Math.min(MAX_DEBRIS, Math.floor(s.debrisCount)));
    this.rocks = new THREE.InstancedMesh(this.rockGeo, this.rockMat, m);
    this.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rocks.frustumCulled = false;
    // Mid-tone, slightly varied rock colours (pale surfaces would wash out).
    const palette = [0x6b5f55, 0x5a5048, 0x77685a, 0x4e4a48];
    const c = new THREE.Color();
    this.rockData = [];
    for (let i = 0; i < m; i++) {
      this.rocks.setColorAt(i, c.setHex(palette[Math.floor(Math.random() * palette.length)]));
      this.rockData.push({
        r0: 2.5 + Math.pow(Math.random(), 0.8) * 13,
        a0: Math.random() * Math.PI * 2,
        delay: Math.random() * 1.2,
        size: 0.25 + Math.random() * 0.45,
        spin: Math.random() * Math.PI,
      });
    }
    this.group.add(this.rocks);
  }

  applyStyle() {
    const s = this.settings;
    this.ringMat.color.set(s.ringColor).multiplyScalar(1.3);
    this.build();
    this.layout();
  }

  get duration() {
    return DURATION;
  }

  play() {
    this.build();
    this.time = 0;
    this.flashed = false;
    this.spike = 0;
    this.diskPhase = 0;
    this.groundAcc = 0;
    this.shake = 0;
    this.enemy.reset();
    this.enemy.group.position.set(0, 0, 0);
    for (const e of this.emitters) e.clear();
    this.playing = true;
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      this.shake = 0;
    }
    const t = this.time;

    // Disk spins up during the collapse.
    const c = THREE.MathUtils.clamp((t - T_COLLAPSE) / COLLAPSE, 0, 1);
    this.diskPhase += dt * (1 + 3.5 * smoothstep(c));

    // Dark dust rises from a ring on the ground while the hole is feeding.
    const dEnv = smoothstep((t - 1) / 0.8) * (1 - smoothstep((t - T_COLLAPSE) / 0.4));
    this.groundAcc += 70 * dEnv * dt;
    const gn = Math.floor(this.groundAcc);
    this.groundAcc -= gn;
    for (let i = 0; i < gn; i++) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 11;
      this.groundDust.burst(1, this.v1.set(HOLE_POS.x + Math.cos(a) * r, 0, HOLE_POS.z + Math.sin(a) * r));
    }

    this.spike *= Math.exp(-dt * 6);
    if (!this.flashed && t >= T_FLASH) {
      this.flashed = true;
      this.spike = 0.9;
      this.sparks.burst(700, HOLE_POS);
      this.dust.burst(160, this.v1.set(0, 0.3, 0));
    }
    {
      const pull = smoothstep((t - T_PULL) / 0.6) * (1 - smoothstep((t - T_COLLAPSE) / 0.3));
      this.shake = 0.03 + 0.07 * pull * this.settings.pullStrength + 0.15 * smoothstep(c) * (this.flashed ? 0 : 1) + this.spike;
    }
    this.layout();
  }

  /** Debris position along its inward spiral, u = 0 on the ground, 1 = at the hole. */
  private spiral(r0: number, a0: number, u: number, out: THREE.Vector3) {
    const r = r0 * Math.pow(1 - u, 1.4);
    const a = a0 + u * 1.5 + u * u * 5;
    const y = 0.2 + (HOLE_POS.y - 0.2) * u * u + 1.5 * Math.sin(Math.PI * u) * (1 - u);
    return out.set(HOLE_POS.x + Math.cos(a) * r, y, HOLE_POS.z + Math.sin(a) * r);
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const R = s.holeSize;
    const ps = Math.max(0.1, s.pullStrength);
    const cl = THREE.MathUtils.clamp((t - T_COLLAPSE) / COLLAPSE, 0, 1);
    const sh = t - T_FLASH; // seconds since the flash

    // Hole size: tiny point grows, swells a little while feeding, bulges at collapse, then is gone.
    let hs = Math.pow(smoothstep(t / OPEN), 1.5);
    hs *= 1 + 0.1 * smoothstep((t - T_PULL) / PULL) + 0.15 * smoothstep(cl / 0.7);
    hs *= 1 - smoothstep((cl - 0.8) / 0.2);
    if (sh >= 0) hs = 0;
    const holeR = hs * R;
    this.holeGroup.visible = hs > 0.002;
    this.holeGroup.scale.setScalar(Math.max(holeR, 0.001));
    this.ringMat.opacity = 0.55 * smoothstep(t / OPEN);
    this.photonRing.visible = true;
    if (this.camera) this.photonRing.quaternion.copy(this.camera.quaternion);
    this.tiltRing.rotation.z = t * 0.5;

    // Accretion disk.
    const diskEnv = smoothstep(t / 1.2) * (1 - smoothstep((cl - 0.85) / 0.15));
    const rScale = smoothstep(t / OPEN) * (1 - 0.75 * smoothstep(cl));
    this.diskMat.opacity = 0.35 * diskEnv;
    if (this.disk) {
      this.disk.visible = diskEnv > 0.002 && sh < 0;
      const n = this.diskR.length;
      for (let i = 0; i < n; i++) {
        const r = this.diskR[i];
        // Keplerian-ish: angular speed ~ r^-1.5, so the inside whirls fastest.
        const a = this.diskA[i] + this.diskPhase * 9 / (r * Math.sqrt(r));
        this.diskPos[i * 3] = Math.cos(a) * r * rScale;
        this.diskPos[i * 3 + 1] = this.diskY[i] * rScale;
        this.diskPos[i * 3 + 2] = Math.sin(a) * r * rScale;
      }
      (this.disk.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    // Debris spirals in, stretching along its path.
    const pullT = t - T_PULL;
    if (this.rocks) {
      const n = this.rockData.length;
      for (let i = 0; i < n; i++) {
        const rk = this.rockData[i];
        const dur = Math.max(0.3, Math.min(1.8 / ps, PULL - rk.delay - 0.05));
        const u = THREE.MathUtils.clamp((pullT - rk.delay) / dur, 0, 1);
        this.spiral(rk.r0, rk.a0, u, this.v1);
        const gone = u >= 0.98 || (u > 0 && this.v1.distanceTo(HOLE_POS) < holeR * 0.9);
        if (gone || sh >= 0) { this.rocks.setMatrixAt(i, this.hidden); continue; }
        this.spiral(rk.r0, rk.a0, Math.min(u + 0.02, 1), this.v2);
        this.v2.sub(this.v1);
        if (this.v2.lengthSq() < 1e-8) this.v2.set(0, 1, 0);
        this.v2.normalize();
        this.dummy.position.copy(this.v1);
        this.dummy.quaternion.setFromUnitVectors(UP, this.v2);
        this.dummy.rotateY(rk.spin + pullT * 2);
        const k = rk.size;
        this.dummy.scale.set(k * (1 - 0.6 * u), k * (1 + 4 * u * u), k * (1 - 0.6 * u));
        this.dummy.updateMatrix();
        this.rocks.setMatrixAt(i, this.dummy.matrix);
      }
      this.rocks.instanceMatrix.needsUpdate = true;
    }

    // Ground dust swirl.
    const dustEnv = smoothstep((t - 1) / 0.8) * (1 - smoothstep((t - T_COLLAPSE) / 0.4));
    const life = 2.2 / ps;
    for (let i = 0; i < DUST_COUNT; i++) {
      const u = (((t - 1) / life + this.swirlP[i]) % 1 + 1) % 1;
      this.spiral(this.swirlR[i], this.swirlA[i], u, this.v1);
      this.swirlPos[i * 3] = this.v1.x;
      this.swirlPos[i * 3 + 1] = this.swirlY[i] + HOLE_POS.y * 0.85 * Math.pow(u, 3.5);
      this.swirlPos[i * 3 + 2] = this.v1.z;
      const f = 0.8 * Math.sin(Math.PI * u) * dustEnv;
      this.swirlCol[i * 3] = 0.5 * f; this.swirlCol[i * 3 + 1] = 0.42 * f; this.swirlCol[i * 3 + 2] = 0.34 * f;
    }
    (this.swirl.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.swirl.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    // Enemy: lifted, spun, spaghettified and swallowed.
    const eDur = Math.min(2.4 / ps, 2.6);
    const e = THREE.MathUtils.clamp((t - 1.9) / eDur, 0, 1);
    const ease = e * e * (3 - 2 * e);
    const sy = 1 + 3 * e * e;
    const sxz = Math.max(0.05, 1 - 0.9 * Math.pow(e, 1.5));
    const swirlR = (1 - e) * 0.8 * smoothstep(e * 4);
    const ang = e * 3 + e * e * 18;
    const eg = this.enemy.group;
    eg.position.set(
      HOLE_POS.x * ease + Math.cos(ang) * swirlR,
      (HOLE_POS.y - 2) * ease,
      HOLE_POS.z * ease + Math.sin(ang) * swirlR,
    );
    eg.rotation.set(0, ang, 0.6 * e);
    eg.scale.set(sxz, sy, sxz);
    eg.visible = e < 0.97;
    this.enemy.setFlash(0.35 * smoothstep(e * 3) * (1 - e));

    // Flash: a tiny spark as the hole opens, a big burst at the collapse.
    let fOp = 0.5 * Math.sin(Math.PI * THREE.MathUtils.clamp(t / 0.7, 0, 1));
    let fScale = 0.3 + 0.5 * R * smoothstep(t / 0.7);
    if (sh >= 0) {
      // A flat-shaded additive sphere reads as a solid wall once it's big, so keep it faint and brief.
      fOp = 0.35 * Math.exp(-sh * 9);
      fScale = R * (1.5 + sh * 12);
    }
    this.flash.opacity = fOp > 0.01 ? fOp : 0;
    this.flash.mesh.scale.setScalar(fScale);

    // Shockwave rings.
    const sw = sh >= 0 ? sh : 0;
    const showShock = sh >= 0 && sh < 1.4;
    this.shockAir.visible = this.shockGround.visible = showShock;
    if (showShock) {
      const a = Math.max(0.5, 18 * smoothstep(sw / 0.9));
      const g = Math.max(0.5, 28 * smoothstep(sw / 1.3));
      this.shockAir.scale.setScalar(a);
      this.shockGround.scale.setScalar(g);
      this.shockMat.opacity = 0.7 * Math.exp(-sw * 2.8);
    }
  }

  dispose() {
    this.rockGeo.dispose();
    this.shockGeo.dispose();
    this.disk?.geometry.dispose();
    this.swirl.geometry.dispose();
    for (const e of this.emitters) e.dispose();
  }
}

export const blackHoleModule: EffectModule = {
  label: 'black hole',
  create: () => new BlackHole(),
  telegraphs(effect) {
    const s = (effect as BlackHole).settings;
    return [
      // Pull zone under the hole while it feeds, then the collapse shockwave ring.
      { shape: { kind: 'circle', x: 0, z: -1.5, radius: s.diskRadius + 2 }, start: 0.3, impact: 1.5, until: 4.5 },
      { shape: { kind: 'ring', x: 0, z: -1.5, inner: s.diskRadius, outer: s.diskRadius + 6 }, start: 4.3, impact: 5.15 },
    ];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const bh = effect as BlackHole;
    bh.camera = camera;
    const s = bh.settings;
    // Slightly low angle, looking up at the hole with the enemy standing below.
    const dist = 16 + s.diskRadius * 1.9;
    camera.position.set(dist * 0.35, 1.8, dist * 0.9);
    controls.target.set(0, 4, -1);
  },
  buildGui(f, effect) {
    const bh = effect as BlackHole;
    const s = bh.settings;
    // Counts and radii are applied on the next play (which rebuilds the disk and debris).
    f.add(s, 'loop');
    f.add(s, 'holeSize', 0.5, 4, 0.05).name('hole size');
    f.add(s, 'diskRadius', 3, 14, 0.1).name('disk radius');
    f.add(s, 'diskParticles', 200, MAX_DISK, 50).name('disk particles');
    f.add(s, 'pullStrength', 0.4, 2.5, 0.05).name('pull strength');
    f.add(s, 'debrisCount', 0, MAX_DEBRIS, 10).name('debris');
    f.addColor(s, 'diskInnerColor').name('disk inner').onChange(() => bh.applyStyle());
    f.addColor(s, 'diskOuterColor').name('disk outer').onChange(() => bh.applyStyle());
    f.addColor(s, 'ringColor').name('ring color').onChange(() => bh.applyStyle());
  },
};
