import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Frostbolt (reworked): ice shards crystallise in front of the mage and fuse into a sharp ice spear that
 * flies on a frosty mist trail. On impact it shatters into bouncing fragments, frost crystallises across the
 * ground, and the enemy is sealed in a faceted ice shell that cracks and falls away.
 */
export interface FrostboltSettings {
  castTime: number;
  flightTime: number;
  freezeTime: number; // how long the enemy stays encased
  color: string;
  loop: boolean;
}

export const defaultFrostbolt = (): FrostboltSettings => ({
  castTime: 1.0,
  flightTime: 0.55,
  freezeTime: 1.5,
  color: '#5fd6ff',
  loop: false,
});

const CRYSTAL_N = 8;
const SHARD_N = 90;
const FREEZE_DELAY = 0.15; // impact -> shell fully formed
const ORIGIN = new THREE.Vector3(0.3, 1.7, 12.4);
const TARGET = new THREE.Vector3(ENEMY_POS.x, 1.3, ENEMY_POS.z);

/** Instanced ice shards flying on ballistic arcs with bounces; shrink away at the end of their life. */
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
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.6;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.8;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.6;
      this.vel[i * 3] = Math.cos(a) * h;
      this.vel[i * 3 + 1] = vSpeed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = Math.sin(a) * h;
      for (let c = 0; c < 3; c++) { this.rot[i * 3 + c] = Math.random() * 6; this.spin[i * 3 + c] = (Math.random() - 0.5) * 14; }
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
      const floor = this.size[i] * 0.4;
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

export class Frostbolt implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FrostboltSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;
  private shattered = false;

  private caster = createCaster(0x4a3fb0);
  private enemy = new Enemy();

  private crystals: THREE.Mesh[] = [];
  private iceMat = new THREE.MeshStandardMaterial({
    color: 0xbfe8ff, emissive: 0x40d0ff, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.1,
    flatShading: true, transparent: true, opacity: 0.85,
  });
  private spear: THREE.Mesh;
  private fuseGlow = new GlowSphere(0x7fe4ff, { rim: false });
  private halo = new GlowSphere(0x7fe4ff);

  private flash = new GlowSphere(0x9fe8ff, { rim: false });
  private shock = createRing(0xcfeeff, 0.9, 1, 96);
  private frostRing = createRing(0xcfeeff, 0.93, 1, 96);
  private frostDisc = createRing(0x5fd0ff, 0, 1, 64);
  private frostLines: THREE.LineSegments;
  private frostLineMat = new THREE.LineBasicMaterial({
    color: 0x5fd6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private shells: THREE.Mesh[] = [];
  private shellMats: THREE.MeshStandardMaterial[] = [];
  private shards: Debris;

  private mist: Emitter;
  private snow: Emitter;
  private sparkle: Emitter;
  private trailAcc = 0;

  constructor(settings: FrostboltSettings = defaultFrostbolt()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);

    // Converging crystals (alternating cones and stretched octahedra, tips along -Z).
    for (let i = 0; i < CRYSTAL_N; i++) {
      const geo = i % 2 === 0 ? new THREE.ConeGeometry(0.13, 0.75, 5) : new THREE.OctahedronGeometry(0.2);
      if (i % 2 === 0) geo.rotateX(-Math.PI / 2);
      else geo.scale(0.7, 0.7, 1.7);
      const m = new THREE.Mesh(geo, this.iceMat);
      this.crystals.push(m);
      this.group.add(m);
    }
    const spearGeo = new THREE.OctahedronGeometry(1);
    spearGeo.scale(0.24, 0.24, 1.6);
    this.spear = new THREE.Mesh(spearGeo, this.iceMat);
    this.group.add(this.spear, this.fuseGlow.mesh, this.halo.mesh);

    // Frost pattern on the ground: radial lines with side branches.
    const verts: number[] = [];
    const spokes = 18;
    for (let k = 0; k < spokes; k++) {
      let a = (k / spokes) * Math.PI * 2;
      const len = 4.5 + Math.random() * 2.5;
      let x = Math.cos(a) * 0.8, z = Math.sin(a) * 0.8;
      let r = 0.8;
      for (let sgm = 0; sgm < 4; sgm++) {
        r += len / 4;
        a += (Math.random() - 0.5) * 0.12;
        const nx = Math.cos(a) * r, nz = Math.sin(a) * r;
        verts.push(x, 0.05, z, nx, 0.05, nz);
        if (sgm > 0) {
          for (const side of [-1, 1]) {
            const ba = a + side * 0.7;
            const bl = 0.7 + Math.random() * 0.9;
            verts.push(nx, 0.05, nz, nx + Math.cos(ba) * bl, 0.05, nz + Math.sin(ba) * bl);
          }
        }
        x = nx; z = nz;
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    this.frostLines = new THREE.LineSegments(lineGeo, this.frostLineMat);
    this.frostLines.frustumCulled = false;

    // Ice shell: two offset faceted icosahedra.
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xaee8ff, emissive: 0x30c0ff, emissiveIntensity: 0.4, roughness: 0.15, flatShading: true,
        transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, i), mat);
      this.shells.push(m);
      this.shellMats.push(mat);
      this.group.add(m);
    }

    this.shards = new Debris(
      new THREE.ConeGeometry(0.3, 1.1, 4),
      new THREE.MeshStandardMaterial({
        color: 0xcfeeff, emissive: 0x40c8ff, emissiveIntensity: 0.5, roughness: 0.2, flatShading: true,
        transparent: true, opacity: 0.85,
      }),
      SHARD_N, 18, 0.5,
    );

    this.group.add(this.frostDisc.mesh, this.frostLines, this.frostRing.mesh, this.shock.mesh, this.flash.mesh);
    this.group.add(this.shards.mesh);

    const base = defaultSettings();
    this.mist = new Emitter({
      ...base, maxParticles: 1400, rate: 0, lifetime: 1, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.3,
      speed: 0.7, speedJitter: 0.5, spread: 180, gravity: -0.2, drag: 0.8, sizeStart: 0.45, sizeEnd: 1.2,
      colorStart: '#d8f2ff', colorEnd: '#6fb4e0', opacityStart: 0.25, opacityEnd: 0, additive: false,
    });
    this.snow = new Emitter({
      ...base, maxParticles: 1200, rate: 0, lifetime: 1.4, lifetimeJitter: 0.5, shape: 'sphere', shapeSize: 0.4,
      speed: 1.6, speedJitter: 0.6, spread: 180, gravity: 0.8, drag: 0.7, sizeStart: 0.13, sizeEnd: 0.05,
      colorStart: '#ffffff', colorEnd: '#9fe0ff', opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.sparkle = new Emitter({
      ...base, maxParticles: 800, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.6,
      speed: 7, speedJitter: 0.6, spread: 180, gravity: 6, drag: 1.2, sizeStart: 0.16, sizeEnd: 0.03,
      colorStart: '#eaffff', colorEnd: '#4cc8ff', opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    // Mist (normal blending) first so the additive flakes draw over it.
    this.emitters.push(this.mist, this.snow, this.sparkle);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.iceMat.emissive.set(c);
    this.halo.color.set(c);
    this.fuseGlow.color.set(c);
    this.frostLineMat.color.set(c);
    this.frostDisc.material.color.set(c);
  }

  get duration() {
    return this.settings.castTime + this.settings.flightTime + FREEZE_DELAY + this.settings.freezeTime + 1.4;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.shattered = false;
    this.shake = 0;
    this.trailAcc = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.shards.clear();
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.shards.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const s = this.settings;
    const impactTime = s.castTime + s.flightTime;
    const shatterTime = impactTime + FREEZE_DELAY + s.freezeTime;
    if (!this.impacted && this.time >= impactTime) this.onImpact();
    if (this.impacted && !this.shattered && this.time >= shatterTime) this.onShatter();
    this.layout();

    const t = this.time;
    // Cast: drifting snow gathers around the crystals; flight: mist + flakes shed along the spear.
    if (t < s.castTime) this.snow.burst(Math.random() < dt * 70 ? 1 : 0, ORIGIN);
    if (t >= s.castTime && !this.impacted) {
      this.trailAcc += dt * 200;
      const n = Math.floor(this.trailAcc);
      this.trailAcc -= n;
      const p = this.spear.position;
      this.mist.burst(n, p);
      this.snow.burst(Math.ceil(n * 0.35), p);
    }
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const impactTime = s.castTime + s.flightTime;
    const after = t - impactTime;
    const shatterTime = impactTime + FREEZE_DELAY + s.freezeTime;
    const sinceShatter = t - shatterTime;
    const fade = 1 - smoothstep((t - (this.duration - 0.8)) / 0.8);
    const cast = s.castTime;

    // Crystals crystallise one after another, orbit slightly, then converge and fuse.
    const conv = smoothstep((t - cast * 0.45) / (cast * 0.5));
    for (let i = 0; i < CRYSTAL_N; i++) {
      const m = this.crystals[i];
      const a = i * 2.4 + t * 2 * (1 - conv);
      const ri = 1.5 + 0.2 * (i % 3);
      const x = ORIGIN.x + Math.cos(a) * ri * (1 - conv);
      const y = ORIGIN.y + Math.sin(a) * ri * 0.8 * (1 - conv);
      const z = ORIGIN.z - 0.4 * (i % 3) * (1 - conv) - 0.5 * conv;
      m.position.set(x, y, z);
      m.lookAt(ORIGIN.x, ORIGIN.y, ORIGIN.z - 1.5);
      const born = smoothstep((t - 0.05 - i * 0.07) / 0.2);
      const sc = born * (1 - smoothstep((conv - 0.8) / 0.2));
      m.scale.setScalar(Math.max(0.001, sc) * (1 + 0.5 * conv));
      m.visible = sc > 0.01 && !this.impacted;
    }

    // Spear: fuses at the origin, then flies; the fuse flash blooms briefly.
    const fuse = smoothstep((t - cast * 0.78) / (cast * 0.22));
    const fly = THREE.MathUtils.clamp((t - cast) / s.flightTime, 0, 1);
    const e = fly * fly;
    this.spear.position.copy(ORIGIN).lerp(TARGET, e);
    this.spear.position.y += Math.sin(Math.PI * e) * 0.5;
    this.spear.lookAt(TARGET);
    this.spear.scale.set(fuse, fuse, 0.5 + 0.5 * fuse);
    this.spear.visible = fuse > 0.01 && !this.impacted;
    this.iceMat.emissiveIntensity = 0.7 + 0.2 * Math.sin(t * 30) * fuse;

    this.fuseGlow.mesh.position.copy(this.spear.position);
    this.fuseGlow.mesh.scale.setScalar(0.5 + 0.7 * Math.sin(Math.PI * fuse));
    this.fuseGlow.opacity = this.impacted ? 0 : 0.5 * Math.sin(Math.PI * fuse) * (1 - fly * 0.7);
    this.halo.mesh.position.copy(this.spear.position);
    this.halo.mesh.scale.setScalar(1.1);
    this.halo.opacity = this.impacted ? 0 : 0.25 * fuse;

    this.caster.material.emissive.setRGB(0, 0.18 * smoothstep(t / cast) * (1 - fly), 0.35 * smoothstep(t / cast) * (1 - fly));

    if (this.impacted) {
      // Impact flash and ground frost.
      this.flash.mesh.position.set(TARGET.x, 1.2, TARGET.z);
      this.flash.mesh.scale.setScalar(1 + after * 8);
      this.flash.opacity = 0.5 * Math.exp(-after * 7);
      this.shock.mesh.scale.setScalar(0.6 + after * 16);
      this.shock.material.opacity = Math.max(0, 0.6 * (1 - after / 0.7));

      const spread = smoothstep(after / 0.6);
      this.frostLines.scale.set(0.15 + 0.85 * spread, 1, 0.15 + 0.85 * spread);
      this.frostLineMat.opacity = 0.55 * spread * fade;
      this.frostLines.visible = this.frostLineMat.opacity > 0.005;
      this.frostRing.mesh.scale.setScalar(0.5 + 6.2 * spread);
      this.frostRing.material.opacity = 0.5 * smoothstep(after / 0.1) * fade;
      this.frostDisc.mesh.scale.setScalar(0.5 + 6 * spread);
      this.frostDisc.material.opacity = 0.14 * spread * fade;

      // Ice shell: grows over FREEZE_DELAY, shivers before the crack, vanishes on shatter.
      const form = smoothstep(after / FREEZE_DELAY);
      const crackLead = smoothstep((t - (shatterTime - 0.45)) / 0.45);
      const alive = this.shattered ? 0 : 1;
      for (let i = 0; i < 2; i++) {
        const m = this.shells[i];
        const shiver = crackLead * 0.05 * Math.sin(t * 70 + i * 3);
        const k = (0.35 + 0.65 * form) * (1 + shiver);
        m.position.set(ENEMY_POS.x, 1.2, ENEMY_POS.z);
        m.scale.set(k * (i === 0 ? 1.5 : 1.15), k * (i === 0 ? 1.95 : 1.7), k * (i === 0 ? 1.5 : 1.15));
        m.rotation.set(0.3 * i, 0.8 * i + 0.4, 0);
        this.shellMats[i].opacity = [0.4, 0.28][i] * form * alive * (1 - 0.35 * crackLead * (0.5 + 0.5 * Math.sin(t * 55)));
        this.shellMats[i].emissiveIntensity = 0.4 + 0.5 * crackLead;
        m.visible = this.shellMats[i].opacity > 0.01;
      }

      // Enemy: cyan tint while frozen, brief white flash on hit.
      const frozen = this.shattered ? Math.exp(-sinceShatter * 6) : form;
      this.enemy.setFlash(0.9 * Math.exp(-after * 8));
      this.enemy.material.emissive.r += 0.03 * frozen;
      this.enemy.material.emissive.g += 0.22 * frozen;
      this.enemy.material.emissive.b += 0.32 * frozen;
      this.shake = 0.3 * Math.exp(-after * 8) + (this.shattered ? 0.35 * Math.exp(-sinceShatter * 9) : 0);
    } else {
      this.flash.opacity = 0;
      this.shock.material.opacity = 0;
      this.frostLineMat.opacity = 0;
      this.frostLines.visible = false;
      this.frostRing.material.opacity = 0;
      this.frostDisc.material.opacity = 0;
      for (const m of this.shells) m.visible = false;
    }
  }

  private onImpact() {
    this.impacted = true;
    const at = new THREE.Vector3(TARGET.x, 1.2, TARGET.z);
    this.shards.spawn(at, 40, 8, 10, 0.4, 2.4);
    this.sparkle.burst(350, at);
    this.snow.burst(250, at);
    this.mist.burst(180, at);
  }

  private onShatter() {
    this.shattered = true;
    const at = new THREE.Vector3(ENEMY_POS.x, 1.2, ENEMY_POS.z);
    this.shards.spawn(at, 48, 4.5, 7, 0.55, 1.2);
    this.sparkle.burst(250, at);
    this.mist.burst(160, at);
  }
}

export const frostboltModule: EffectModule = {
  label: 'frostbolt',
  category: 'iconic',
  create: () => new Frostbolt(),
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls) {
    frameArena(camera, controls, new THREE.Vector3(0, 1.5, 7), 10);
  },
  buildGui(f, effect) {
    const fb = effect as Frostbolt;
    const s = fb.settings;
    f.add(s, 'loop');
    f.add(s, 'castTime', 0.4, 3, 0.05).name('cast time');
    f.add(s, 'flightTime', 0.2, 2, 0.05).name('flight time');
    f.add(s, 'freezeTime', 0.3, 4, 0.05).name('freeze time');
    f.addColor(s, 'color').onChange(() => fb.applyStyle());
  },
};
