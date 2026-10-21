import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Pyroblast (reworked): a long, heavy cast. The mage rises, magma rings orbit and the ground cracks open
 * while a huge roiling fireball swells overhead. It lumbers to the enemy on a burning wake and ends in a
 * mushroom explosion with a ground fire ring, flying rocks and a crushed target.
 */
export interface PyroblastSettings {
  size: number; // fireball radius at full growth
  castTime: number;
  flightTime: number;
  color: string;
  loop: boolean;
}

export const defaultPyroblast = (): PyroblastSettings => ({
  size: 1.5,
  castTime: 1.8,
  flightTime: 1.3,
  color: '#ff5a0a',
  loop: false,
});

const AFTERMATH = 2.4;
const RING_N = 3;
const CHUNK_N = 18;
const ROCK_N = 64;
const CRACK_N = 14;

/** Instanced rocks flying on ballistic arcs with bounces; shrink away at the end of their life. */
class Debris {
  readonly mesh: THREE.InstancedMesh;
  private pos: Float32Array;
  private vel: Float32Array;
  private rot: Float32Array;
  private spin: Float32Array;
  private size: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private cursor = 0;
  private dummy = new THREE.Object3D();

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, private n: number, private gravity = 16, private bounce = 0.4) {
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.rot = new Float32Array(n * 3);
    this.spin = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.clear();
  }

  clear() {
    this.age.fill(1);
    this.life.fill(0.5);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(origin: THREE.Vector3, count: number, hSpeed: number, vSpeed: number, size: number, life: number) {
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.n;
      const a = Math.random() * Math.PI * 2;
      const h = Math.sqrt(Math.random()) * hSpeed;
      this.pos[i * 3] = origin.x; this.pos[i * 3 + 1] = origin.y; this.pos[i * 3 + 2] = origin.z;
      this.vel[i * 3] = Math.cos(a) * h;
      this.vel[i * 3 + 1] = vSpeed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = Math.sin(a) * h;
      for (let c = 0; c < 3; c++) { this.rot[i * 3 + c] = Math.random() * 6; this.spin[i * 3 + c] = (Math.random() - 0.5) * 12; }
      this.size[i] = size * (0.5 + Math.random());
      this.age[i] = 0;
      this.life[i] = life * (0.7 + Math.random() * 0.6);
    }
  }

  update(dt: number) {
    const d = this.dummy;
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += dt;
      const j = i * 3;
      this.vel[j + 1] -= this.gravity * dt;
      for (let c = 0; c < 3; c++) { this.pos[j + c] += this.vel[j + c] * dt; this.rot[j + c] += this.spin[j + c] * dt; }
      const floor = this.size[i] * 0.5;
      if (this.pos[j + 1] < floor) {
        this.pos[j + 1] = floor;
        this.vel[j + 1] = Math.abs(this.vel[j + 1]) > 1.5 ? -this.vel[j + 1] * this.bounce : 0;
        this.vel[j] *= 0.7; this.vel[j + 2] *= 0.7;
        for (let c = 0; c < 3; c++) this.spin[j + c] *= 0.6;
      }
      const alive = this.age[i] < this.life[i];
      d.position.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
      d.rotation.set(this.rot[j], this.rot[j + 1], this.rot[j + 2]);
      d.scale.setScalar(alive ? this.size[i] * (1 - smoothstep((this.age[i] / this.life[i] - 0.7) / 0.3)) : 0);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Pyroblast implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PyroblastSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;
  private capDone = false;

  private caster = createCaster(0x4a2f8a);
  private enemy = new Enemy();

  // Magma rings orbiting the caster and chunks orbiting the ball.
  private rings: THREE.Mesh[] = [];
  private ringMats: THREE.MeshStandardMaterial[] = [];
  private chunks: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  // The fireball.
  private ball = new THREE.Group();
  private core = new GlowSphere(0xffe8a0, { rim: false });
  private halo = new GlowSphere(0xff5a10);
  private layers: THREE.Mesh[] = [];
  private layerMats: THREE.MeshStandardMaterial[] = [];

  // Ground under the caster.
  private groundGlow = createRing(0xff4a10, 0, 1, 64);
  private cracks: THREE.LineSegments;
  private crackMat = new THREE.LineBasicMaterial({
    color: 0xff6a1a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private wake = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff4a0a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );

  // Impact.
  private flash = new GlowSphere(0xffe0a0, { rim: false });
  private stem = new GlowSphere(0xff6a14);
  private cap = new GlowSphere(0xff9a30);
  private shock = createRing(0xffa040, 0.9, 1, 96);
  private fireRing = createRing(0xff4a10, 0.75, 1, 96);
  private scorch = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0x040302, transparent: true, opacity: 0, depthWrite: false }),
  );
  private rocks: Debris;

  private castEmbers: Emitter;
  private trailFire: Emitter;
  private wakeFire: Emitter;
  private smoke: Emitter;
  private blastFire: Emitter;
  private ringFire: Emitter;
  private plume: Emitter;
  private capSmoke: Emitter;
  private trailAcc = 0;

  constructor(settings: PyroblastSettings = defaultPyroblast()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);

    // Magma rings.
    for (let i = 0; i < RING_N; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2a0a02, emissive: 0xff5a0a, emissiveIntensity: 0.9, roughness: 0.9, flatShading: true,
        transparent: true, opacity: 0,
      });
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07 + 0.02 * i, 6, 48), mat);
      this.rings.push(m);
      this.ringMats.push(mat);
      this.group.add(m);
    }
    this.chunks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0x2a1208, emissive: 0xff4a08, emissiveIntensity: 0.8, flatShading: true }),
      CHUNK_N,
    );
    this.chunks.frustumCulled = false;
    this.group.add(this.chunks);

    // Fireball: core + three roiling icosahedron layers + halo.
    const layerCols = [0xff5a0a, 0xff2a04, 0xff9a1a];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x300a02, emissive: layerCols[i], emissiveIntensity: 0.9, roughness: 0.9,
        flatShading: true, transparent: true, opacity: [0.85, 0.6, 0.45][i],
      });
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), mat);
      this.layers.push(m);
      this.layerMats.push(mat);
      this.ball.add(m);
    }
    this.ball.add(this.core.mesh, this.halo.mesh);
    this.core.mesh.scale.setScalar(0.75);
    this.halo.mesh.scale.setScalar(1.45);
    this.group.add(this.ball);

    // Cracks radiating from under the caster.
    const verts: number[] = [];
    for (let k = 0; k < CRACK_N; k++) {
      let a = (k / CRACK_N) * Math.PI * 2 + Math.random() * 0.3;
      let r = 0.6;
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      const segs = 5 + Math.floor(Math.random() * 3);
      for (let sgm = 0; sgm < segs; sgm++) {
        a += (Math.random() - 0.5) * 0.5;
        r += 0.5 + Math.random() * 0.5;
        const nx = Math.cos(a) * r, nz = Math.sin(a) * r;
        verts.push(x, 0.05, z, nx, 0.05, nz);
        x = nx; z = nz;
      }
    }
    const crackGeo = new THREE.BufferGeometry();
    crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    this.cracks = new THREE.LineSegments(crackGeo, this.crackMat);
    this.cracks.frustumCulled = false;
    this.wake.rotation.x = -Math.PI / 2;
    this.wake.position.y = 0.035;
    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.position.y = 0.03;

    this.rocks = new Debris(
      new THREE.DodecahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x3a2a22, emissive: 0x8a2a08, emissiveIntensity: 0.4, flatShading: true }),
      ROCK_N,
    );

    this.group.add(this.groundGlow.mesh, this.cracks, this.wake, this.scorch, this.rocks.mesh);
    this.group.add(this.flash.mesh, this.stem.mesh, this.cap.mesh, this.shock.mesh, this.fireRing.mesh);

    const base = defaultSettings();
    this.castEmbers = new Emitter({
      ...base, maxParticles: 300, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4, shape: 'cone', shapeSize: 2.8,
      speed: 3, speedJitter: 0.5, spread: 15, gravity: -0.5, drag: 0.4, sizeStart: 0.14, sizeEnd: 0.02,
      colorStart: '#ffd080', colorEnd: '#ff4a08', opacityStart: 0.9, opacityEnd: 0, additive: true,
      sizeJitter: 0.3, erosion: 0,
    });
    this.smoke = new Emitter({
      ...base, maxParticles: 700, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.8,
      speed: 1, speedJitter: 0.5, spread: 180, gravity: -1.2, drag: 0.8, sizeStart: 1, sizeEnd: 3,
      colorStart: '#35302c', colorEnd: '#100d0b', opacityStart: 0.35, opacityEnd: 0, additive: false,
      colorMid: '#241f1c', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
    });
    this.plume = new Emitter({
      ...base, maxParticles: 700, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 1.5,
      originY: 0.5, speed: 8, speedJitter: 0.4, spread: 14, gravity: -1, drag: 0.9, sizeStart: 2, sizeEnd: 4.5,
      colorStart: '#2c2623', colorEnd: '#0c0a09', opacityStart: 0.45, opacityEnd: 0, additive: false,
      colorMid: '#1c1715', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
    });
    this.capSmoke = new Emitter({
      ...base, maxParticles: 400, rate: 0, lifetime: 2, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 2.5,
      speed: 4, speedJitter: 0.5, spread: 180, gravity: -0.3, drag: 1, sizeStart: 2.5, sizeEnd: 5,
      colorStart: '#3a322d', colorEnd: '#12100e', opacityStart: 0.4, opacityEnd: 0, additive: false,
      colorMid: '#26201c', sizeJitter: 0.4, erosion: 0.65, spin: 0.4,
    });
    this.trailFire = new Emitter({
      ...base, maxParticles: 700, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 1.1,
      speed: 1.5, speedJitter: 0.5, spread: 180, gravity: -2, drag: 1, sizeStart: 1.5, sizeEnd: 0.2,
      colorStart: '#ffc050', colorEnd: '#e02a00', opacityStart: 0.45, opacityEnd: 0, additive: true,
      colorMid: '#ff7a14', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.wakeFire = new Emitter({
      ...base, maxParticles: 800, rate: 0, lifetime: 1.3, lifetimeJitter: 0.5, shape: 'sphere', shapeSize: 0.4,
      speed: 1.2, speedJitter: 0.6, spread: 40, gravity: -1.5, drag: 0.8, sizeStart: 0.9, sizeEnd: 0.15,
      colorStart: '#ff9a30', colorEnd: '#c01a00', opacityStart: 0.45, opacityEnd: 0, additive: true,
      colorMid: '#e65a10', sizeJitter: 0.4, erosion: 0.5, spin: 0.4, groundFade: 0.3,
    });
    this.blastFire = new Emitter({
      ...base, maxParticles: 800, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 1,
      speed: 12, speedJitter: 0.6, spread: 180, gravity: -1, drag: 1.8, sizeStart: 2, sizeEnd: 0.3,
      colorStart: '#ffc050', colorEnd: '#d82400', opacityStart: 0.5, opacityEnd: 0, additive: true,
      colorMid: '#ff7010', sizeJitter: 0.4, erosion: 0.5, spin: 0.5,
    });
    this.ringFire = new Emitter({
      ...base, maxParticles: 600, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.5,
      speed: 5, speedJitter: 0.5, spread: 40, gravity: -1.5, drag: 0.8, sizeStart: 1.2, sizeEnd: 0.3,
      colorStart: '#ff9a30', colorEnd: '#c01a00', opacityStart: 0.5, opacityEnd: 0, additive: true,
      colorMid: '#e65a10', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    // Smoke (normal blending) first so the additive fire draws over it.
    this.emitters.push(this.smoke, this.plume, this.capSmoke, this.trailFire, this.wakeFire, this.castEmbers,
      this.blastFire, this.ringFire);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    this.layerMats[0].emissive.set(this.settings.color);
    this.halo.color.set(this.settings.color);
  }

  get duration() {
    return this.settings.castTime + this.settings.flightTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.capDone = false;
    this.shake = 0;
    this.trailAcc = 0;
    this.caster.reset();
    this.enemy.reset();
    this.castEmbers.settings.rate = 0;
    this.plume.settings.rate = 0;
    for (const e of this.emitters) e.clear();
    this.rocks.clear();
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.rocks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const s = this.settings;
    const impactTime = s.castTime + s.flightTime;
    if (!this.impacted && this.time >= impactTime) this.onImpact();
    this.layout();

    const t = this.time;
    const after = t - impactTime;
    this.castEmbers.settings.rate = t < s.castTime ? 40 + 160 * smoothstep(t / s.castTime) : 0;
    this.plume.settings.rate = this.impacted && after > 0.05 && after < 1.0 ? 260 : 0;
    if (this.impacted && !this.capDone && after > 0.7) {
      this.capDone = true;
      this.capSmoke.burst(220, new THREE.Vector3(0, 8.5, 0));
    }
    // Flight: fire from the ball, burning wake on the ground beneath it.
    if (t >= s.castTime && !this.impacted) {
      this.trailAcc += dt * 160;
      const n = Math.floor(this.trailAcc);
      this.trailAcc -= n;
      const p = this.ball.position;
      this.trailFire.burst(n, p);
      this.smoke.burst(Math.ceil(n * 0.4), p);
      for (let k = 0; k < Math.ceil(n * 0.5); k++) {
        this.wakeFire.burst(1, new THREE.Vector3(p.x + (Math.random() - 0.5) * 3.4, 0.15, p.z + (Math.random() - 0.5) * 1.5));
      }
    }
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const impactTime = s.castTime + s.flightTime;
    const after = t - impactTime;
    const fade = 1 - smoothstep((t - (this.duration - 0.9)) / 0.9);
    const cast = smoothstep(t / s.castTime);
    const fly = THREE.MathUtils.clamp((t - s.castTime) / s.flightTime, 0, 1);
    const released = smoothstep((t - s.castTime) / 0.4);

    // Caster rises during the cast, settles after release.
    const lift = 0.7 * cast * (1 - released);
    this.caster.group.position.y = CASTER_POS.y + lift;
    this.caster.material.emissive.setRGB(0.7 * cast * (1 - released), 0.2 * cast * (1 - released), 0);

    // The ball swells overhead (radius up to size), then lumbers to the enemy and loses height.
    const grow = smoothstep((t - s.castTime * 0.15) / (s.castTime * 0.85));
    const hold = new THREE.Vector3(CASTER_POS.x + 0.2, 4.1 + lift, CASTER_POS.z - 0.3);
    const target = new THREE.Vector3(ENEMY_POS.x, 1.9, ENEMY_POS.z);
    const e = Math.pow(fly, 1.25);
    this.ball.position.copy(hold).lerp(target, e);
    this.ball.position.y += Math.sin(Math.PI * e) * 0.8 + 0.06 * Math.sin(t * 6) * grow;
    const r = s.size * (0.08 + 0.92 * grow);
    this.ball.scale.setScalar(r);
    this.ball.visible = !this.impacted && grow > 0.01;
    this.core.opacity = 0.7;
    this.halo.opacity = 0.28;
    for (let i = 0; i < 3; i++) {
      const m = this.layers[i];
      const wob = 1 + 0.09 * Math.sin(t * (7 + i * 3) + i * 2) + 0.04 * Math.sin(t * 17 + i);
      m.scale.set([1, 0.88, 1.12][i] * wob, [1, 0.88, 1.12][i] / wob, [1, 0.88, 1.12][i] * wob);
      m.position.set(0.1 * Math.sin(t * 5 + i), 0.1 * Math.cos(t * 4 + i * 2), 0.1 * Math.sin(t * 6 + i * 3));
      m.rotation.set(t * (0.9 + i * 0.5), t * (1.3 - i * 0.4), t * (0.7 + i * 0.8));
    }

    // Magma rings orbit the caster until release.
    const ringVis = smoothstep(t / (s.castTime * 0.4)) * (1 - released);
    for (let i = 0; i < RING_N; i++) {
      const m = this.rings[i];
      m.position.set(CASTER_POS.x, 1.3 + lift, CASTER_POS.z);
      m.rotation.set(Math.PI / 2 + 0.6 * Math.sin(t * 1.3 + i * 2), 0.5 * Math.cos(t + i), t * (1.6 + i * 0.7) * (i % 2 ? -1 : 1));
      m.scale.setScalar((1.7 + 0.55 * i) * (0.4 + 0.6 * ringVis));
      this.ringMats[i].opacity = ringVis;
      m.visible = ringVis > 0.01;
    }
    // Rock chunks orbit the ball.
    const chunkVis = !this.impacted && grow > 0.1;
    this.chunks.visible = chunkVis;
    if (chunkVis) {
      for (let i = 0; i < CHUNK_N; i++) {
        const a = t * (1.4 + (i % 3) * 0.4) + i * 2.4;
        const rad = r * 1.4 + 0.3 + 0.2 * Math.sin(t * 3 + i);
        this.dummy.position.set(
          this.ball.position.x + Math.cos(a) * rad * 0.4,
          this.ball.position.y + Math.sin(a * 0.7 + i) * rad * 0.8,
          this.ball.position.z + Math.sin(a) * rad,
        );
        this.dummy.rotation.set(t * 2 + i, t * 1.5, i);
        this.dummy.scale.setScalar(grow * (0.6 + 0.08 * (i % 5)));
        this.dummy.updateMatrix();
        this.chunks.setMatrixAt(i, this.dummy.matrix);
      }
      this.chunks.instanceMatrix.needsUpdate = true;
    }

    // Ground glow + cracks under the caster.
    const crackVis = cast * (1 - smoothstep((t - s.castTime) / 1.0));
    this.groundGlow.mesh.position.set(CASTER_POS.x, 0.04, CASTER_POS.z);
    this.groundGlow.mesh.scale.setScalar(1 + 3.5 * cast);
    this.groundGlow.material.opacity = 0.3 * crackVis * (0.85 + 0.15 * Math.sin(t * 14));
    this.cracks.position.set(CASTER_POS.x, 0, CASTER_POS.z);
    this.cracks.scale.set(0.3 + 0.7 * cast, 1, 0.3 + 0.7 * cast);
    this.crackMat.opacity = 0.7 * crackVis;
    this.cracks.visible = crackVis > 0.01;

    // Burning wake: a wide strip from the caster to the ball that lingers and fades.
    const wakeEnd = this.ball.position.z;
    const wakeLen = Math.max(0.01, CASTER_POS.z - 1 - wakeEnd);
    this.wake.position.z = (CASTER_POS.z - 1 + wakeEnd) / 2;
    this.wake.scale.set(3.4, wakeLen, 1);
    const wakeOp = fly > 0 ? 0.22 * smoothstep(fly / 0.1) : 0;
    this.wake.material.opacity = this.impacted ? wakeOp * Math.exp(-after * 0.8) * fade : wakeOp;
    this.wake.visible = this.wake.material.opacity > 0.003;

    // Impact: flash, mushroom column + cap, shock + fire rings, scorch, crushed enemy.
    if (this.impacted) {
      const c = new THREE.Vector3(ENEMY_POS.x, 1.5, ENEMY_POS.z);
      this.flash.mesh.position.copy(c);
      this.flash.mesh.scale.setScalar(2 + after * 14);
      this.flash.opacity = 0.65 * Math.exp(-after * 6);

      const hStem = 0.5 + 8 * smoothstep(after / 1.1);
      this.stem.mesh.position.set(0, hStem, 0);
      this.stem.mesh.scale.set(1.5 + after * 0.5, hStem, 1.5 + after * 0.5);
      this.stem.opacity = 0.45 * Math.exp(-after * 1.7);
      const capR = 1 + 5.5 * smoothstep(after / 1.4);
      this.cap.mesh.position.set(0, hStem * 1.85, 0);
      this.cap.mesh.scale.set(capR, capR * 0.6, capR);
      this.cap.opacity = 0.4 * smoothstep(after / 0.3) * Math.exp(-after * 0.9);

      this.shock.mesh.scale.setScalar(1 + after * 30);
      this.shock.material.opacity = Math.max(0, 0.7 * (1 - after / 0.55));
      this.fireRing.mesh.scale.setScalar(1 + 6 * smoothstep(after / 0.7));
      this.fireRing.material.opacity = 0.5 * Math.exp(-after * 0.8) * fade;
      this.scorch.scale.setScalar(7.5);
      (this.scorch.material as THREE.MeshBasicMaterial).opacity = 0.6 * smoothstep(after / 0.3) * fade;

      this.shake = 1.4 * Math.exp(-after * 3);
      this.enemy.setCrush(0.88 * smoothstep(after / 0.2));
      this.enemy.setFlash(1.5 * Math.exp(-after * 4));
      const glow = 0.5 * Math.exp(-after * 0.7);
      this.enemy.material.emissive.r += glow * 1.6;
      this.enemy.material.emissive.g += glow * 0.3;
    } else {
      this.flash.opacity = 0;
      this.stem.opacity = 0;
      this.cap.opacity = 0;
      this.shock.material.opacity = 0;
      this.fireRing.material.opacity = 0;
      (this.scorch.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  private onImpact() {
    this.impacted = true;
    const at = new THREE.Vector3(ENEMY_POS.x, 1.5, ENEMY_POS.z);
    this.blastFire.burst(600, at);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      this.ringFire.burst(22, new THREE.Vector3(Math.cos(a) * 5, 0.2, Math.sin(a) * 5));
    }
    this.smoke.burst(200, new THREE.Vector3(0, 1, 0));
    this.rocks.spawn(new THREE.Vector3(0, 0.8, 0), ROCK_N, 9, 15, 0.45, 2.6);
  }
}

export const pyroblastModule: EffectModule = {
  label: 'pyroblast',
  category: 'iconic',
  create: () => new Pyroblast(),
  telegraphs(effect) {
    const s = (effect as Pyroblast).settings;
    const impact = s.castTime + s.flightTime;
    return [
      // Burning wake from the caster to the enemy: dangerous from the moment the ball passes until it burns out.
      {
        shape: { kind: 'line', x1: CASTER_POS.x, z1: CASTER_POS.z - 1, x2: ENEMY_POS.x, z2: ENEMY_POS.z, width: 3.4 },
        start: Math.min(0.4, s.castTime * 0.3), impact, until: impact + 1.8,
      },
      // Mushroom explosion and ground fire ring.
      { shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: 7 }, start: s.castTime * 0.4, impact },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.55, threshold: 0.85 },
  frameCamera(camera, controls) {
    frameArena(camera, controls, new THREE.Vector3(0, 4, 7), 13);
  },
  buildGui(f, effect) {
    const p = effect as Pyroblast;
    const s = p.settings;
    f.add(s, 'loop');
    f.add(s, 'size', 0.6, 2.5, 0.05).name('fireball size');
    f.add(s, 'castTime', 0.8, 3.5, 0.05).name('cast time');
    f.add(s, 'flightTime', 0.6, 3, 0.05).name('flight time');
    f.addColor(s, 'color').onChange(() => p.applyStyle());
  },
};
