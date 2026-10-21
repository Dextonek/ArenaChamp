import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Blizzard (reworked): the caster channels a swirling storm cloud over the enemy area. Wind-driven snow, a rain of
 * ice shards that each stab a short ice spike into the ground, and a pale frost disc with crystalline hexagon
 * rings spreading under it. The enemy slowly turns ice-blue and sluggish, then thaws as the storm fades.
 */
export interface BlizzardSettings {
  radius: number;
  cloudHeight: number;
  channelTime: number; // seconds of storm before it fades
  shardRate: number; // ice shards per second at full strength
  color: string; // frost colour
  loop: boolean;
}

export const defaultBlizzard = (): BlizzardSettings => ({
  radius: 6,
  cloudHeight: 16,
  channelTime: 4,
  shardRate: 55,
  color: '#a8e4f2',
  loop: false,
});

const FADE = 1.0;
const GROW = 0.8; // cloud formation time
const MAX_SHARDS = 90;
const MAX_SPIKES = 56;
const SPIKE_LIFE = 0.8;
const SNOW = 650;
const WIND = new THREE.Vector3(3.2, -6.5, 1.1);
const DOWN = new THREE.Vector3(0, -1, 0);
const ENEMY_BASE = new THREE.Color(0x5a1820);
const ENEMY_ICE = new THREE.Color(0x4a90c8);

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Puff {
  mesh: THREE.Mesh;
  a: number; // base angle
  d: number; // distance from the cloud centre (0..1 of the storm radius)
  dir: number; // swirl direction / speed factor
  bob: number;
}

interface FrostRing {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  frac: number; // radius as a fraction of the frost disc
  spin: number;
  alpha: number;
}

export class Blizzard implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BlizzardSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private shardAcc = 0;
  private enemyHit = 0;

  private caster = createCaster();
  private enemy = new Enemy();
  private handGlow = new GlowSphere(0x7fc8ff, { rim: false });
  private castRing = createRing(0x8fd8ff, 0.8, 1, 6);

  // Storm cloud: two layers of flattened translucent puffs, counter-rotating.
  private cloud = new THREE.Group();
  private puffGeo = new THREE.SphereGeometry(1, 16, 10);
  private darkMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false });
  private lightMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false });
  private puffs: Puff[] = [];

  // Snow: own Points so the fall can be diagonal.
  private snowPos = new Float32Array(SNOW * 3);
  private snowMul = new Float32Array(SNOW);
  private snowPhase = new Float32Array(SNOW);
  private snowGeo = new THREE.BufferGeometry();
  private snowMat: THREE.PointsMaterial;
  private snow: THREE.Points;

  // Ice shards (falling) and ground spikes (short-lived).
  private iceMat = new THREE.MeshStandardMaterial({
    color: 0x8fd0f0, emissive: 0x3a9ad0, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1,
    transparent: true, opacity: 0.9,
  });
  private shards: THREE.InstancedMesh;
  private shardPos: THREE.Vector3[] = [];
  private shardVel: THREE.Vector3[] = [];
  private shardSize = new Float32Array(MAX_SHARDS);
  private shardOn = new Uint8Array(MAX_SHARDS);
  private spikes: THREE.InstancedMesh;
  private spikeAge = new Float32Array(MAX_SPIKES).fill(SPIKE_LIFE);
  private spikeX = new Float32Array(MAX_SPIKES);
  private spikeZ = new Float32Array(MAX_SPIKES);
  private spikeH = new Float32Array(MAX_SPIKES);
  private spikeTilt = new Float32Array(MAX_SPIKES * 2);
  private spikeCursor = 0;

  // Frost on the ground.
  private frostDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 72),
    new THREE.MeshBasicMaterial({ color: 0xa8e4f2, transparent: true, opacity: 0, depthWrite: false }),
  );
  private frostEdge = createRing(0xc8f2ff, 0.94, 1, 96);
  private frostRings: FrostRing[] = [];

  private frost: Emitter; // impact puffs
  private glitter: Emitter; // ice glints
  private mist: Emitter; // low drifting mist

  private dummy = new THREE.Object3D();
  private v = new THREE.Vector3();
  private tmpColor = new THREE.Color();

  constructor(settings: BlizzardSettings = defaultBlizzard()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.handGlow.mesh, this.castRing.mesh);
    this.castRing.mesh.position.copy(this.caster.group.position).setY(0.05);
    this.castRing.mesh.scale.setScalar(1.7);

    // Cloud puffs.
    this.darkMat.color.setRGB(0.008, 0.022, 0.07);
    this.lightMat.color.setRGB(0.03, 0.08, 0.2);
    for (let i = 0; i < 14; i++) {
      const dark = i < 8;
      const mesh = new THREE.Mesh(this.puffGeo, dark ? this.darkMat : this.lightMat);
      this.cloud.add(mesh);
      this.puffs.push({
        mesh, a: (i / 8) * Math.PI * 2 + rand(-0.3, 0.3), d: dark ? rand(0.1, 0.85) : rand(0.2, 0.7),
        dir: dark ? 1 : -1.4, bob: rand(0, Math.PI * 2),
      });
      const r = rand(2.6, 4.2);
      mesh.userData.r = r;
    }
    this.group.add(this.cloud);

    // Snow.
    this.snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.snowMat = new THREE.PointsMaterial({
      size: 0.24, map: dotTexture(), color: 0xe8f6ff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.snow = new THREE.Points(this.snowGeo, this.snowMat);
    this.snow.frustumCulled = false;
    this.group.add(this.snow);

    // Shards (tip pointing down -Y) and spikes (tip +Y, base at y = 0).
    const shardGeo = new THREE.ConeGeometry(0.13, 1.5, 5).rotateX(Math.PI);
    this.shards = new THREE.InstancedMesh(shardGeo, this.iceMat, MAX_SHARDS);
    this.shards.frustumCulled = false;
    const spikeGeo = new THREE.ConeGeometry(0.17, 1, 5).translate(0, 0.5, 0);
    this.spikes = new THREE.InstancedMesh(spikeGeo, this.iceMat, MAX_SPIKES);
    this.spikes.frustumCulled = false;
    for (let i = 0; i < MAX_SHARDS; i++) {
      this.shardPos.push(new THREE.Vector3());
      this.shardVel.push(new THREE.Vector3());
    }
    this.group.add(this.shards, this.spikes);

    // Frost disc + crystalline rings (hexagons at different radii and spins).
    this.frostDisc.rotation.x = -Math.PI / 2;
    this.frostDisc.position.y = 0.02;
    this.frostEdge.mesh.position.y = 0.03;
    this.group.add(this.frostDisc, this.frostEdge.mesh);
    const defs: [number, number, number, number, number, number][] = [
      // inner, outer, segments, frac, spin, alpha
      [0.96, 1, 6, 0.9, 0.15, 0.5], [0.97, 1, 6, 0.68, -0.25, 0.45], [0.96, 1, 6, 0.46, 0.35, 0.45],
      [0.95, 1, 12, 0.26, -0.5, 0.4], [0.97, 1, 3, 0.55, 0.2, 0.3],
    ];
    defs.forEach(([inner, outer, seg, frac, spin, alpha], i) => {
      const r = createRing(0x9fe8ff, inner, outer, seg);
      r.mesh.position.y = 0.035 + i * 0.002;
      this.frostRings.push({ mesh: r.mesh, material: r.material, frac, spin, alpha });
      this.group.add(r.mesh);
    });

    this.frost = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.15, speed: 2.4, speedJitter: 0.5, spread: 75, gravity: -0.3, drag: 1.5,
      sizeStart: 0.5, sizeEnd: 1.3, colorStart: '#e6f8ff', colorEnd: '#8fc8e8',
      opacityStart: 0.35, opacityEnd: 0, additive: false,
    });
    this.glitter = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.6, lifetimeJitter: 0.5,
      shape: 'point', shapeSize: 0, speed: 5, speedJitter: 0.6, spread: 70, gravity: 9, drag: 0.8,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#6fc8ff',
      opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.mist = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 2, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 5, originY: 0.2, speed: 0.6, speedJitter: 0.5, spread: 90, gravity: -0.1, drag: 0.8,
      sizeStart: 1.2, sizeEnd: 2.6, colorStart: '#b6d8ec', colorEnd: '#7aa8c8',
      opacityStart: 0.12, opacityEnd: 0, additive: false,
    });
    this.emitters.push(this.frost, this.glitter, this.mist);
    for (const e of this.emitters) this.group.add(e.points);

    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    (this.frostDisc.material as THREE.MeshBasicMaterial).color.set(c);
  }

  get duration() {
    return this.settings.channelTime + FADE;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    const s = this.settings;
    this.time = 0;
    this.shardAcc = 0;
    this.enemyHit = 0;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    this.enemy.material.color.copy(ENEMY_BASE);
    for (const e of this.emitters) e.clear();
    this.shardOn.fill(0);
    this.spikeAge.fill(SPIKE_LIFE);
    for (let i = 0; i < SNOW; i++) {
      const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * s.radius * 1.15;
      this.snowPos[i * 3] = Math.cos(a) * d - 4 + rand(0, 8) * 0.5;
      this.snowPos[i * 3 + 1] = rand(0, s.cloudHeight);
      this.snowPos[i * 3 + 2] = Math.sin(a) * d;
      this.snowMul[i] = rand(0.7, 1.3);
      this.snowPhase[i] = rand(0, Math.PI * 2);
    }
    this.snowGeo.attributes.position.needsUpdate = true;
    this.step(0, 0);
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
    const closing = 1 - smoothstep((t - this.settings.channelTime) / FADE);
    const rain = smoothstep((t - 0.4) / 0.9) * closing;
    this.enemyHit *= Math.exp(-dt * 6);
    this.shake *= Math.exp(-dt * 6);
    this.step(dt, rain);
    this.layout();
  }

  /** Simulates snow, falling shards and ground spikes. */
  private step(dt: number, rain: number) {
    const s = this.settings;
    const R = s.radius, H = s.cloudHeight;
    const p = this.snowPos;
    for (let i = 0; i < SNOW; i++) {
      const j = i * 3, m = this.snowMul[i], ph = this.snowPhase[i];
      p[j] += (WIND.x * m + Math.sin(this.time * 1.7 + ph) * 1.2) * dt;
      p[j + 1] += WIND.y * m * dt;
      p[j + 2] += (WIND.z * m + Math.cos(this.time * 1.3 + ph) * 0.8) * dt;
      if (p[j + 1] < 0.05) {
        const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * R * 1.1;
        p[j] = Math.cos(a) * d - 4;
        p[j + 1] = H - rand(0, 1.5);
        p[j + 2] = Math.sin(a) * d;
      }
    }
    this.snowGeo.attributes.position.needsUpdate = true;

    // Shards: spawn from under the cloud, fall fast and slightly slanted by the wind.
    this.shardAcc += s.shardRate * rain * dt;
    while (this.shardAcc >= 1) {
      this.shardAcc -= 1;
      this.spawnShard();
    }
    for (let i = 0; i < MAX_SHARDS; i++) {
      if (this.shardOn[i]) {
        const pos = this.shardPos[i], vel = this.shardVel[i];
        pos.addScaledVector(vel, dt);
        if (pos.y <= 0) {
          this.shardOn[i] = 0;
          this.impact(pos.x, pos.z);
        }
      }
      if (this.shardOn[i]) {
        this.dummy.position.copy(this.shardPos[i]);
        this.v.copy(this.shardVel[i]).normalize();
        this.dummy.quaternion.setFromUnitVectors(DOWN, this.v);
        this.dummy.scale.setScalar(this.shardSize[i]);
      } else {
        this.dummy.position.set(0, -50, 0);
        this.dummy.scale.setScalar(0.0001);
      }
      this.dummy.updateMatrix();
      this.shards.setMatrixAt(i, this.dummy.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = true;

    // Spikes: quick stab out of the ground, then retract.
    for (let i = 0; i < MAX_SPIKES; i++) {
      this.spikeAge[i] += dt;
      const u = this.spikeAge[i] / SPIKE_LIFE;
      if (u < 1) {
        const h = this.spikeH[i] * (u < 0.15 ? smoothstep(u / 0.15) : 1 - smoothstep((u - 0.3) / 0.7));
        this.dummy.position.set(this.spikeX[i], 0, this.spikeZ[i]);
        this.dummy.rotation.set(this.spikeTilt[i * 2], 0, this.spikeTilt[i * 2 + 1]);
        this.dummy.quaternion.setFromEuler(this.dummy.rotation);
        this.dummy.scale.set(1, Math.max(h, 0.0001), 1);
      } else {
        this.dummy.position.set(0, -50, 0);
        this.dummy.scale.setScalar(0.0001);
      }
      this.dummy.updateMatrix();
      this.spikes.setMatrixAt(i, this.dummy.matrix);
    }
    this.spikes.instanceMatrix.needsUpdate = true;
  }

  private spawnShard() {
    const s = this.settings;
    let i = 0;
    while (i < MAX_SHARDS && this.shardOn[i]) i++;
    if (i >= MAX_SHARDS) return;
    // A quarter of the shards are aimed at the enemy so it gets pelted.
    const aimed = Math.random() < 0.25;
    const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * (aimed ? 1.3 : s.radius);
    const vel = this.shardVel[i];
    vel.set(rand(2, 3.4), -rand(28, 40), rand(0, 1.2));
    const fall = (s.cloudHeight - 0.5) / -vel.y;
    // Pre-compensate the wind drift so the shard lands where it was aimed.
    this.shardPos[i].set(
      ENEMY_POS.x + Math.cos(a) * d - vel.x * fall, s.cloudHeight - 0.5 - rand(0, 1.2),
      ENEMY_POS.z + Math.sin(a) * d - vel.z * fall,
    );
    this.shardSize[i] = rand(0.8, 1.4);
    this.shardOn[i] = 1;
  }

  private impact(x: number, z: number) {
    this.v.set(x, 0.1, z);
    this.frost.burst(3, this.v);
    this.glitter.burst(4, this.v);
    const k = this.spikeCursor;
    this.spikeCursor = (k + 1) % MAX_SPIKES;
    this.spikeAge[k] = 0;
    this.spikeX[k] = x;
    this.spikeZ[k] = z;
    this.spikeH[k] = rand(0.9, 1.7);
    this.spikeTilt[k * 2] = rand(-0.25, 0.25);
    this.spikeTilt[k * 2 + 1] = rand(-0.25, 0.25);
    if (Math.hypot(x - ENEMY_POS.x, z - ENEMY_POS.z) < 0.9) this.enemyHit = Math.min(0.35, this.enemyHit + 0.12);
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const ch = s.channelTime;
    const closing = 1 - smoothstep((t - ch) / FADE);
    const active = this.playing ? 1 : 0;
    const rain = smoothstep((t - 0.4) / 0.9) * closing * active;
    const grow = smoothstep(t / GROW) * active;

    // Caster channels: a cold glow in the raised hand and a hexagon rune at the feet.
    const cast = smoothstep(t / 0.5) * closing * active;
    this.handGlow.mesh.position.copy(this.caster.group.position).add(this.v.set(0.45, 2.4, -0.3));
    this.handGlow.mesh.scale.setScalar(0.2 + 0.18 * cast + 0.04 * Math.sin(t * 9));
    this.handGlow.opacity = 0.5 * cast;
    this.castRing.mesh.rotation.z = t * 1.2;
    this.castRing.material.opacity = 0.4 * cast;

    // Cloud: flattened puffs swirling in two counter-rotating layers.
    this.cloud.visible = grow > 0.001 && closing > 0.001;
    this.cloud.position.set(ENEMY_POS.x, s.cloudHeight, ENEMY_POS.z);
    this.cloud.scale.setScalar(Math.max(grow, 0.001));
    this.darkMat.opacity = 0.8 * closing;
    this.lightMat.opacity = 0.45 * closing;
    for (const p of this.puffs) {
      const ang = p.a + t * 0.55 * p.dir;
      const d = p.d * s.radius * 0.95;
      const r = p.mesh.userData.r as number;
      p.mesh.position.set(Math.cos(ang) * d, 0.35 * Math.sin(t * 1.3 + p.bob), Math.sin(ang) * d);
      p.mesh.scale.set(r, r * 0.28, r);
      p.mesh.rotation.y = ang;
    }

    // Snow and shards fade in with the storm.
    this.snowMat.opacity = 0.5 * rain;
    this.snow.visible = rain > 0.002;
    this.shards.visible = this.spikes.visible = this.playing;
    this.iceMat.emissiveIntensity = 0.5 + 0.2 * Math.sin(t * 7);

    // Frost disc growing outwards, hexagon rings drifting at their own speeds.
    const frostGrow = smoothstep((t - 0.3) / (ch * 0.75)) * active;
    const fr = Math.max(0.001, s.radius * 1.05 * frostGrow);
    this.frostDisc.scale.setScalar(fr);
    (this.frostDisc.material as THREE.MeshBasicMaterial).opacity = 0.45 * frostGrow * closing;
    this.frostEdge.mesh.scale.setScalar(fr);
    this.frostEdge.material.opacity = 0.5 * frostGrow * closing;
    for (const r of this.frostRings) {
      r.mesh.scale.setScalar(Math.max(0.001, fr * r.frac));
      r.mesh.rotation.z = t * r.spin;
      r.material.opacity = r.alpha * frostGrow * closing;
    }
    this.mist.settings.rate = this.playing ? 60 * frostGrow * closing : 0;

    // Enemy: slowly goes ice-blue, sways ever more sluggishly, thaws with the storm.
    const slow = smoothstep((t - 0.5) / 1.6) * closing * active;
    this.enemy.material.color.copy(ENEMY_BASE).lerp(ENEMY_ICE, slow);
    this.enemy.setFlash(Math.min(this.enemyHit, 0.35));
    this.tmpColor.setRGB(0.03 * slow, 0.09 * slow, 0.17 * slow);
    this.enemy.material.emissive.add(this.tmpColor);
    this.enemy.group.rotation.y = Math.sin(t * (2.4 - 1.8 * slow)) * 0.22 * (1 - 0.5 * slow) * active;
    this.enemy.group.scale.set(1, 1 - 0.04 * slow, 1);
  }
}

export const blizzardModule: EffectModule = {
  label: 'blizzard',
  category: 'iconic',
  create: () => new Blizzard(),
  bloom: { enabled: true, strength: 0.45, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const s = (effect as Blizzard).settings;
    // Caster at z = 14, storm over the enemy at the origin.
    frameArena(camera, controls, new THREE.Vector3(0, s.cloudHeight * 0.35, 5), Math.max(12, s.cloudHeight * 0.75));
  },
  buildGui(f, effect) {
    const b = effect as Blizzard;
    const s = b.settings;
    f.add(s, 'loop');
    f.add(s, 'radius', 3, 9, 0.1);
    f.add(s, 'cloudHeight', 8, 28, 0.5).name('cloud height');
    f.add(s, 'channelTime', 1.5, 6, 0.1).name('channel time');
    f.add(s, 'shardRate', 10, 90, 1).name('shard rate');
    f.addColor(s, 'color').onChange(() => b.applyStyle());
  },
};
