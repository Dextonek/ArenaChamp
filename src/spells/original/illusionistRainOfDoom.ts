import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, LightPillar, createCaster, createGround, createRing,
  createSwordGeometry, frameArena, smoothstep, softDotTexture,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Illusionist Rain of Doom: the caster twirls in prismatic light and five mirror clones step out beside it (each
 * with red/cyan chromatic ghosts). A vast flickering cloud of swords and orbs appears over the enemy and rains
 * down in waves. Nearly all of it is illusion that shatters into rainbow glitter a few metres above the ground;
 * a handful of heavy gold swords are real and strike in and around the enemy. Finale: everyone points, the
 * remaining illusions snap into one giant real blade that drops, shatters into a ring of glass shards, and the
 * clones dissolve into glitter.
 */
export interface RainOfDoomSettings {
  cloudHeight: number; // centre height of the sword cloud
  blastPower: number; // scales the finale shake / burst
  loop: boolean;
}

export const defaultRainOfDoom = (): RainOfDoomSettings => ({
  cloudHeight: 17,
  blastPower: 1,
  loop: false,
});

// Timeline (seconds)
const T_TWIRL = 1.3;
const T_CLONE = 1.25;
const T_CLOUD = 1.6;
const T_POSE = 4.2; // everyone points
const T_CONV = 4.3; // remaining illusions converge
const T_BLADE = 4.6; // the real blade forms
const T_DROP = 5.05;
const DROP_TIME = 0.3;
const T_IMPACT = T_DROP + DROP_TIME;
const DURATION = 7.0;

const N_FAKE = 85; // illusion swords: first 52 rain down, the rest wait for the finale
const N_WAVE_FAKE = 52;
const N_ORB = 30; // glowing orbs: first 15 rain down
const N_WAVE_ORB = 15;
const N_ITEM = N_FAKE + N_ORB;
const N_REAL = 10;
const REAL_DUR = 0.42;
const N_GLINT = 150;
const N_TRI = 220;
const N_GLASS = 150;
const BLADE_SIZE = 9;
const BLADE_HOVER = 15;
const CONVERGE_Y = 19.5;

// Formation of the five mirror clones (x offsets ±2.5 / ±5, nudged behind the caster so they read from the side).
const CLONE_FORM: [number, number][] = [[-5, 1.8], [-2.5, 0.9], [2.5, 0.9], [5, 1.8], [0, 2.6]];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Clone {
  main: Enemy;
  red: Enemy;
  cyan: Enemy;
  fx: boolean;
}

export class IllusionistRainOfDoom implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RainOfDoomSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;

  private caster = createCaster(0x4b3a7a);
  private enemy = new Enemy();
  private clones: Clone[] = [];
  private prismRings = [createRing(0xff7ad9, 0.9, 1, 64), createRing(0x7affc8, 0.9, 1, 64), createRing(0x7aa8ff, 0.9, 1, 64)];
  private pointGlows = Array.from({ length: 6 }, () => new GlowSphere(0xe8d8ff, { rim: false }));
  private beams: THREE.Mesh[] = [];
  private beamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  // the cloud
  private swordGeo = createSwordGeometry();
  private swordSolid: THREE.InstancedMesh;
  private swordWire: THREE.InstancedMesh;
  private orbs: THREE.InstancedMesh;
  private items = new Float32Array(N_ITEM * 9); // hx hy hz ex ez ys start dur seed (start < 0 = waits for finale)
  private itemFired = new Uint8Array(N_ITEM);
  private glints: THREE.Points;
  private glintSeed = new Float32Array(N_GLINT * 2);

  // real swords
  private reals: THREE.InstancedMesh;
  private realData = new Float32Array(N_REAL * 6); // tx tz start tilt y0 spin
  private realHit = new Float32Array(N_REAL).fill(-1);
  private realRings = Array.from({ length: N_REAL }, () => createRing(0xffd070, 0.8, 1, 40));
  private realScorch: THREE.Mesh[] = [];

  // prismatic triangle shards from shattered illusions
  private tris: THREE.InstancedMesh;
  private triT0 = new Float32Array(N_TRI).fill(-1);
  private triData = new Float32Array(N_TRI * 11); // px py pz vx vy vz ax ay az spin hue
  private triLife = new Float32Array(N_TRI);
  private triCursor = 0;

  // finale
  private blade: THREE.Mesh;
  private bladeMat = new THREE.MeshStandardMaterial({
    color: 0xcfc4a0, metalness: 0.5, roughness: 0.4, emissive: 0xffb84a, emissiveIntensity: 0.5, transparent: true,
  });
  private bladeGlow = new GlowSphere(0xffe0a0);
  private snap = new GlowSphere(0xffffff, { rim: false });
  private pillar = new LightPillar(0xffe3a8, 1.1);
  private burst = new GlowSphere(0xfff0d0);
  private burstPrism = new GlowSphere(0xb890ff);
  private shockRings = [createRing(0xff4060, 0.9, 1, 96), createRing(0x60ff90, 0.9, 1, 96), createRing(0x6090ff, 0.9, 1, 96)];
  private glass: THREE.InstancedMesh;
  private glassData = new Float32Array(N_GLASS * 8); // angle speed vy ax ay az spin size
  private light = new THREE.PointLight(0xffe0a0, 0, 60, 1.6);

  private shimmer: Emitter;
  private glitA: Emitter;
  private glitB: Emitter;
  private glitC: Emitter;
  private dust: Emitter;
  private gold: Emitter;

  private dummy = new THREE.Object3D();
  private tmpC = new THREE.Color();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private cPoint = new THREE.Vector3(0, CONVERGE_Y, 0);

  constructor(settings: RainOfDoomSettings = defaultRainOfDoom()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    for (const r of this.prismRings) this.group.add(r.mesh);

    // --- clones: iridescent translucent body + red / cyan additive chromatic ghosts ----------------------------
    CLONE_FORM.forEach(() => {
      const main = new Enemy({ color: 0x9fb4ff, horns: false, eyeColor: new THREE.Color(1.1, 1.1, 1.5), facing: Math.PI });
      const ghostOpts = { horns: false, eyeColor: new THREE.Color(0, 0, 0), facing: Math.PI };
      const red = new Enemy({ ...ghostOpts, color: 0xff2a4a });
      const cyan = new Enemy({ ...ghostOpts, color: 0x2adfff });
      main.material.transparent = true;
      main.material.depthWrite = false;
      for (const g of [red, cyan]) {
        g.material.transparent = true;
        g.material.depthWrite = false;
        g.material.blending = THREE.AdditiveBlending;
        g.group.traverse((o) => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) o.visible = false; // no eye dots
        });
      }
      this.group.add(main.group, red.group, cyan.group);
      this.clones.push({ main, red, cyan, fx: false });
    });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), this.beamMat);
      b.visible = false;
      this.beams.push(b);
      this.group.add(b, this.pointGlows[i].mesh);
    }

    // --- the sword / orb cloud ---------------------------------------------------------------------------------
    this.swordSolid = new THREE.InstancedMesh(this.swordGeo, new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0.2, roughness: 0.45, emissive: 0x302060, emissiveIntensity: 0.55,
      transparent: true, opacity: 0.85,
    }), N_FAKE);
    this.swordWire = new THREE.InstancedMesh(this.swordGeo, new THREE.MeshBasicMaterial({
      color: 0xbfe0ff, wireframe: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }), N_FAKE);
    this.orbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 12, 8), new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }), N_ORB);
    for (const m of [this.swordSolid, this.swordWire, this.orbs]) { m.frustumCulled = false; this.group.add(m); }
    for (let i = 0; i < N_FAKE; i++) {
      this.tmpC.setHSL(Math.random(), 0.55, 0.6, THREE.SRGBColorSpace);
      this.swordSolid.setColorAt(i, this.tmpC);
    }
    for (let i = 0; i < N_ORB; i++) {
      this.tmpC.setHSL(Math.random(), 0.85, 0.62, THREE.SRGBColorSpace);
      this.orbs.setColorAt(i, this.tmpC);
    }
    for (let k = 0; k < N_ITEM; k++) {
      const isOrb = k >= N_FAKE;
      const idx = isOrb ? k - N_FAKE : k;
      const wave = isOrb ? idx < N_WAVE_ORB : idx < N_WAVE_FAKE;
      const w = isOrb ? Math.floor(idx / (N_WAVE_ORB / 4)) : Math.floor(idx / (N_WAVE_FAKE / 4));
      const hx = rnd(-13, 13), hz = rnd(-12, 12);
      this.items.set([
        hx, 0, hz, hx * 0.7 + rnd(-1.5, 1.5), hz * 0.7 + rnd(-1.5, 1.5), rnd(2.4, 4.8),
        wave ? 2.4 + 0.4 * Math.min(3, w) + rnd(0, 0.25) : -1, rnd(0.55, 0.78), Math.random(),
      ], k * 9);
    }
    this.applyCloudHeight();

    const gp = new THREE.BufferGeometry();
    gp.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_GLINT * 3), 3));
    gp.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_GLINT * 3), 3));
    this.glints = new THREE.Points(gp, new THREE.PointsMaterial({
      size: 0.5, map: softDotTexture(), vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.glints.frustumCulled = false;
    this.group.add(this.glints);
    for (let i = 0; i < N_GLINT; i++) { this.glintSeed[i * 2] = Math.random(); this.glintSeed[i * 2 + 1] = Math.random(); }

    // --- real swords ---------------------------------------------------------------------------------------------
    this.reals = new THREE.InstancedMesh(this.swordGeo, new THREE.MeshStandardMaterial({
      color: 0xc9a24e, metalness: 0.6, roughness: 0.4, emissive: 0xffa020, emissiveIntensity: 0.5,
    }), N_REAL);
    this.reals.frustumCulled = false;
    this.group.add(this.reals);
    const realStart = [3.0, 3.25, 3.5, 3.7, 3.9, 4.0, 3.3, 3.6, 3.8, 4.1];
    const into: [number, number][] = [[0.25, 0.1], [-0.3, -0.2], [0.1, -0.35]];
    for (let r = 0; r < N_REAL; r++) {
      let tx: number, tz: number;
      if (r < into.length) [tx, tz] = into[r];
      else { const a = rnd(0, Math.PI * 2), d = rnd(1.8, 4.8); tx = Math.cos(a) * d; tz = Math.sin(a) * d; }
      this.realData.set([tx, tz, realStart[r], rnd(-0.18, 0.18), rnd(18, 21), rnd(0, 6)], r * 6);
      const sc = new THREE.Mesh(
        new THREE.CircleGeometry(0.9, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: 0x07050a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
        }),
      );
      sc.position.set(tx, 0.03, tz);
      this.realScorch.push(sc);
      this.group.add(sc, this.realRings[r].mesh);
      this.realRings[r].mesh.position.set(tx, 0.05, tz);
    }

    // --- triangle shards -----------------------------------------------------------------------------------------
    this.tris = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 3), new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
    }), N_TRI);
    this.tris.frustumCulled = false;
    this.group.add(this.tris);
    for (let i = 0; i < N_TRI; i++) this.tris.setColorAt(i, this.tmpC.setHex(0xffffff));

    // --- finale pieces -------------------------------------------------------------------------------------------
    this.blade = new THREE.Mesh(this.swordGeo, this.bladeMat);
    this.blade.scale.setScalar(BLADE_SIZE);
    this.group.add(this.blade, this.bladeGlow.mesh, this.snap.mesh, this.pillar.mesh, this.burst.mesh, this.burstPrism.mesh, this.light);
    for (const r of this.shockRings) this.group.add(r.mesh);
    this.glass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 1.5, 3), new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false,
    }), N_GLASS);
    this.glass.frustumCulled = false;
    this.group.add(this.glass);
    for (let i = 0; i < N_GLASS; i++) {
      this.glass.setColorAt(i, this.tmpC.setHex(0xffffff));
      const ax = new THREE.Vector3().randomDirection();
      this.glassData.set([
        (i / N_GLASS) * Math.PI * 2 + rnd(-0.03, 0.03), rnd(8, 22), rnd(2, 9), ax.x, ax.y, ax.z, rnd(4, 14), rnd(0.5, 1.4),
      ], i * 8);
    }

    // --- emitters ------------------------------------------------------------------------------------------------
    const glitter = (mid: string, end: string) => new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 1.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 5, speedJitter: 0.6, spread: 180, gravity: 3, drag: 0.9,
      sizeStart: 0.22, sizeEnd: 0.02, colorStart: '#ffffff', colorMid: mid, colorEnd: end,
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.5,
    });
    this.glitA = glitter('#ff6ad5', '#7a4dff');
    this.glitB = glitter('#5af0ff', '#3a6bff');
    this.glitC = glitter('#8cff7a', '#ffcf40');
    // Pastel shimmer around the caster as it twirls.
    this.shimmer = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.5, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 1.0, speed: 1.8, speedJitter: 0.5, spread: 30, gravity: -0.5, drag: 0.7,
      sizeStart: 0.5, sizeEnd: 0.1, colorStart: '#ffffff', colorMid: '#b890ff', colorEnd: '#4ad0ff',
      opacityStart: 0.35, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.4, spin: 0.5,
    });
    this.shimmer.points.position.set(0, 0, CASTER_POS.z);
    // Dark dust behind the bright layers (real strikes and the finale).
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 1.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 4, speedJitter: 0.6, spread: 75, gravity: 1.5, drag: 1.3,
      sizeStart: 0.7, sizeEnd: 2.0, colorStart: '#5a5163', colorMid: '#3a3342', colorEnd: '#17141c',
      opacityStart: 0.7, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.55, groundFade: 0.3, spin: 0.6,
    });
    this.gold = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 9, speedJitter: 0.6, spread: 80, gravity: 9, drag: 0.8,
      sizeStart: 0.15, sizeEnd: 0.02, colorStart: '#fff4d0', colorMid: '#ffc24a', colorEnd: '#a0501a',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    // dark first, bright on top
    this.emitters.push(this.dust, this.shimmer, this.glitA, this.glitB, this.glitC, this.gold);
    for (const e of this.emitters) this.group.add(e.points);

    this.reset();
  }

  applyCloudHeight() {
    for (let k = 0; k < N_ITEM; k++) this.items[k * 9 + 1] = this.settings.cloudHeight - 3 + this.items[k * 9 + 8] * 6;
  }

  get duration() {
    return DURATION;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.shake = 0;
    this.itemFired.fill(0);
    this.realHit.fill(-1);
    this.triT0.fill(-1);
    this.triCursor = 0;
    for (const c of this.clones) { c.fx = false; c.main.reset(); c.red.reset(); c.cyan.reset(); }
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const prev = this.time;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const t = this.time;

    // prismatic shimmer around the caster while it twirls
    this.shimmer.settings.rate = t < 2.4 ? 160 * smoothstep(t / 0.3) * (1 - smoothstep((t - 1.6) / 0.8)) : 0;

    // clones emerge in a puff of glitter
    this.clones.forEach((c, i) => {
      if (!c.fx && t >= T_CLONE + 0.12 * i + 0.3) {
        c.fx = true;
        const p = this.tmpV.set(CLONE_FORM[i][0], 1.2, CASTER_POS.z + CLONE_FORM[i][1]);
        for (const g of [this.glitA, this.glitB, this.glitC]) g.burst(12, p);
      }
    });

    // illusions shatter into rainbow glitter a few metres above the ground
    for (let k = 0; k < N_ITEM; k++) {
      const o = k * 9;
      const start = this.items[o + 6];
      if (start < 0 || this.itemFired[k]) continue;
      if (t >= start + this.items[o + 7]) {
        this.itemFired[k] = 1;
        const p = this.tmpV.set(this.items[o + 3], this.items[o + 5], this.items[o + 4]);
        this.glitA.burst(8, p); this.glitB.burst(8, p); this.glitC.burst(8, p);
        for (let n = 0; n < 4; n++) this.spawnTri(p, 4, t);
      }
    }
    // real swords land: dark dust, gold sparks, ring, scorch
    for (let r = 0; r < N_REAL; r++) {
      const o = r * 6;
      if (this.realHit[r] < 0 && t >= this.realData[o + 2] + REAL_DUR) {
        this.realHit[r] = this.realData[o + 2] + REAL_DUR;
        const p = this.tmpV.set(this.realData[o], 0.2, this.realData[o + 1]);
        this.dust.burst(24, p);
        this.gold.burst(30, p);
      }
    }
    if (!this.impacted && prev < T_IMPACT && t >= T_IMPACT) this.onImpact();
    this.layout();
  }

  private spawnTri(p: THREE.Vector3, speed: number, t: number) {
    const i = this.triCursor;
    this.triCursor = (this.triCursor + 1) % N_TRI;
    const d = this.triData, o = i * 11;
    const v = this.tmpV2.randomDirection().multiplyScalar(speed * rnd(0.5, 1.2));
    v.y += speed * 0.3;
    const ax = this.tmpV.set(0, 0, 0).randomDirection();
    d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z;
    d[o + 3] = v.x; d[o + 4] = v.y; d[o + 5] = v.z;
    d[o + 6] = ax.x; d[o + 7] = ax.y; d[o + 8] = ax.z;
    d[o + 9] = rnd(5, 14); d[o + 10] = Math.random();
    this.triT0[i] = t;
    this.triLife[i] = rnd(0.9, 1.5);
  }

  private hsl(c: THREE.Color, h: number, s: number, l: number) {
    return c.setHSL(((h % 1) + 1) % 1, s, l, THREE.SRGBColorSpace);
  }

  private layout() {
    const t = this.time;
    const s = this.settings;
    const after = Math.max(0, t - T_IMPACT);
    const fade = 1 - smoothstep((t - (DURATION - 0.7)) / 0.7);
    let shake = 0;

    // --- caster twirl + prismatic rings ------------------------------------------------------------------------
    const tw = smoothstep(t / T_TWIRL);
    const pose = smoothstep((t - T_POSE) / 0.25) * (1 - smoothstep((t - T_IMPACT - 0.1) / 0.3));
    this.caster.group.rotation.set(-0.3 * pose, Math.PI + Math.PI * 4 * tw, 0);
    this.prismRings.forEach((r, i) => {
      const k = smoothstep((t - i * 0.15) / 1.2);
      this.hsl(r.material.color, t * 0.5 + i / 3, 0.8, 0.6);
      r.mesh.position.set(0, 0.05, CASTER_POS.z);
      r.mesh.scale.setScalar(1.6 + i * 0.6 + 1.2 * k);
      r.mesh.rotation.z = t * (2 + i) * (i % 2 ? -1 : 1);
      r.material.opacity = 0.35 * Math.sin(Math.min(1, t / 2.2) * Math.PI) * (t < 2.2 ? 1 : 0);
    });

    // --- mirror clones with chromatic ghosts ---------------------------------------------------------------------
    const cloneBase = new THREE.Vector3();
    const handPositions: THREE.Vector3[] = [new THREE.Vector3(0.45, 2.5 - 0.5 * pose, CASTER_POS.z - 0.9)];
    const dissolve = smoothstep(after / 0.6);
    this.clones.forEach((c, i) => {
      const e = smoothstep((t - T_CLONE - 0.12 * i) / 0.8);
      const [fx, fz] = CLONE_FORM[i];
      cloneBase.set(fx * e, dissolve * 1.2, CASTER_POS.z + fz * e);
      const flick = 0.85 + 0.15 * Math.sin(t * 17 + i * 2.1);
      const alpha = 0.5 * e * flick * (1 - dissolve);
      const live = e > 0.01 && dissolve < 1;
      const hue = t * 0.35 + i * 0.2;
      this.hsl(c.main.material.color, hue, 0.55, 0.68);
      this.hsl(c.main.material.emissive, hue + 0.5, 0.7, 0.3);
      c.main.material.emissiveIntensity = 0.6;
      c.main.material.opacity = alpha;
      const jump = Math.sin(t * 9 + i * 3) > 0.7 ? 0.4 : 0.15;
      const sh = jump + 0.1 * Math.sin(t * 13 + i);
      const spin = Math.PI + (1 - e) * Math.PI * 4;
      const sc = 1 + 0.15 * dissolve;
      const place = (g: Enemy, dx: number, dz: number, op: number) => {
        g.group.position.set(cloneBase.x + dx, cloneBase.y, cloneBase.z + dz);
        g.group.rotation.set(-0.3 * pose, spin, 0);
        g.group.scale.setScalar(sc);
        g.group.visible = live;
        g.material.opacity = op;
      };
      place(c.main, 0, 0, alpha);
      place(c.red, sh, 0.05, alpha * 0.4);
      place(c.cyan, -sh, -0.05, alpha * 0.4);
      handPositions.push(new THREE.Vector3(cloneBase.x + 0.45, 2.5 - 0.5 * pose + cloneBase.y, cloneBase.z - 0.9));
    });

    // --- everybody points ------------------------------------------------------------------------------------------
    const aim = this.cPoint;
    this.beamMat.opacity = 0.4 * pose;
    this.hsl(this.beamMat.color, t * 0.8, 0.7, 0.7);
    handPositions.forEach((hp, i) => {
      const live = i === 0 ? true : this.clones[i - 1].main.group.visible;
      const g = this.pointGlows[i];
      g.mesh.position.copy(hp);
      g.mesh.scale.setScalar(0.35 + 0.1 * Math.sin(t * 20 + i));
      this.hsl(g.color, t * 0.8 + i / 6, 0.7, 0.75);
      g.opacity = live ? 0.6 * pose : 0;
      const b = this.beams[i];
      const dir = this.tmpV.copy(aim).sub(hp);
      const len = dir.length();
      b.visible = pose > 0.01 && live;
      b.position.copy(hp).addScaledVector(dir, 0.5);
      b.quaternion.setFromUnitVectors(this.up, dir.normalize());
      b.scale.set(0.06, len, 0.06);
    });

    // --- the sword / orb cloud ---------------------------------------------------------------------------------------
    for (let k = 0; k < N_ITEM; k++) {
      const o = k * 9;
      const it = this.items;
      const seed = it[o + 8];
      const start = it[o + 6];
      let x = it[o], y = it[o + 1] + Math.sin(t * 1.4 + seed * 20) * 0.35, z = it[o + 2];
      let sc = smoothstep((t - T_CLOUD - seed * 0.9) / 0.35);
      let falling = false;
      if (start >= 0) {
        if (t >= start) {
          const tau = (t - start) / it[o + 7];
          if (tau >= 1) sc = 0;
          else {
            falling = true;
            y = it[o + 1] + (it[o + 5] - it[o + 1]) * tau * tau;
            x = it[o] + (it[o + 3] - it[o]) * tau;
            z = it[o + 2] + (it[o + 4] - it[o + 2]) * tau;
          }
        }
      } else {
        const cv = smoothstep((t - T_CONV - seed * 0.2) / 0.65);
        const k2 = cv * cv;
        const ang = seed * 6 + k2 * 5, rad = (1 - k2) * k2 * 3;
        x = x * (1 - k2) + Math.cos(ang) * rad;
        z = z * (1 - k2) + Math.sin(ang) * rad;
        y = y + (CONVERGE_Y - y) * k2;
        sc *= 1 - 0.75 * k2;
        if (t > T_DROP) sc = 0;
      }
      const f = Math.sin(t * (falling ? 16 : 6 + seed * 5) + seed * 40) + 0.6 * Math.sin(t * (falling ? 31 : 13) + seed * 9);
      const solid = f > -0.15;
      const jit = 1 + 0.1 * Math.sin(t * 19 + seed * 50);
      if (k < N_FAKE) {
        const size = (2.0 + seed * 0.8) * sc * jit;
        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(0, t * 0.9 + seed * 6, 0.1 * Math.sin(t * 1.3 + seed * 9));
        this.dummy.scale.setScalar(Math.max(0.0001, solid ? size : 0));
        this.dummy.updateMatrix();
        this.swordSolid.setMatrixAt(k, this.dummy.matrix);
        this.dummy.scale.setScalar(Math.max(0.0001, solid ? 0 : size * 1.04));
        this.dummy.updateMatrix();
        this.swordWire.setMatrixAt(k, this.dummy.matrix);
      } else {
        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(Math.max(0.0001, sc * jit * (solid ? 1.2 : 0.7)));
        this.dummy.updateMatrix();
        this.orbs.setMatrixAt(k - N_FAKE, this.dummy.matrix);
      }
    }
    this.swordSolid.instanceMatrix.needsUpdate = true;
    this.swordWire.instanceMatrix.needsUpdate = true;
    this.orbs.instanceMatrix.needsUpdate = true;
    if (this.swordSolid.instanceColor) this.swordSolid.instanceColor.needsUpdate = true;
    if (this.orbs.instanceColor) this.orbs.instanceColor.needsUpdate = true;
    (this.swordWire.material as THREE.MeshBasicMaterial).opacity = 0.5 * (0.8 + 0.2 * Math.sin(t * 11));
    (this.orbs.material as THREE.MeshBasicMaterial).opacity = 0.5 * (0.8 + 0.2 * Math.sin(t * 7));

    // mirror-shard glints drifting through the cloud
    const gpos = this.glints.geometry.attributes.position as THREE.BufferAttribute;
    const gcol = this.glints.geometry.attributes.color as THREE.BufferAttribute;
    const cloudAmt = smoothstep((t - T_CLOUD) / 1.0) * (1 - smoothstep((t - T_DROP) / 0.4));
    for (let i = 0; i < N_GLINT; i++) {
      const a = this.glintSeed[i * 2], b = this.glintSeed[i * 2 + 1];
      gpos.setXYZ(i, (a - 0.5) * 28 + Math.sin(t * 0.6 + b * 20) * 0.8, s.cloudHeight - 3 + b * 7 + Math.cos(t * 0.8 + a * 15) * 0.5, (b - 0.5) * 26 * (0.5 + a * 0.5));
      const tw2 = Math.pow(Math.max(0, Math.sin(t * (3 + a * 6) + b * 40)), 6);
      this.hsl(this.tmpC, a * 3 + t * 0.4, 0.7, 0.7);
      gcol.setXYZ(i, this.tmpC.r * tw2, this.tmpC.g * tw2, this.tmpC.b * tw2);
    }
    gpos.needsUpdate = true; gcol.needsUpdate = true;
    this.glints.visible = cloudAmt > 0.01;
    (this.glints.material as THREE.PointsMaterial).opacity = 0.9 * cloudAmt;

    // --- real swords -----------------------------------------------------------------------------------------------
    let hitFlash = 0;
    for (let r = 0; r < N_REAL; r++) {
      const o = r * 6;
      const rd = this.realData;
      const start = rd[o + 2];
      let y = rd[o + 4];
      if (t >= start) y = t >= start + REAL_DUR ? -0.3 : rd[o + 4] * (1 - Math.pow((t - start) / REAL_DUR, 2));
      let sc = 2.8 * smoothstep((t - (start - 0.35)) / 0.3) * (1 - smoothstep((t - T_IMPACT) / 0.08));
      if (t < start - 0.35) sc = 0;
      this.dummy.position.set(rd[o], y, rd[o + 1]);
      this.dummy.rotation.set(0, rd[o + 5], rd[o + 3]);
      this.dummy.scale.setScalar(Math.max(0.0001, sc));
      this.dummy.updateMatrix();
      this.reals.setMatrixAt(r, this.dummy.matrix);

      const age = this.realHit[r] >= 0 ? t - this.realHit[r] : -1;
      const rr = this.realRings[r];
      rr.mesh.scale.setScalar(0.5 + Math.max(0, age) * 6);
      rr.material.opacity = age >= 0 ? 0.6 * Math.exp(-age * 4.5) * fade : 0;
      (this.realScorch[r].material as THREE.MeshBasicMaterial).opacity = age >= 0 ? 0.65 * fade : 0;
      if (age >= 0 && r < 3) hitFlash = Math.max(hitFlash, Math.exp(-age * 8));
      if (age >= 0) shake += 0.12 * Math.exp(-age * 9);
    }
    this.reals.instanceMatrix.needsUpdate = true;

    // --- triangle shards ---------------------------------------------------------------------------------------------
    for (let i = 0; i < N_TRI; i++) {
      const age = this.triT0[i] >= 0 ? t - this.triT0[i] : -1;
      const life = this.triLife[i];
      if (age < 0 || age > life) {
        this.dummy.scale.setScalar(0.0001);
        this.dummy.position.set(0, -50, 0);
        this.dummy.quaternion.identity();
        this.dummy.updateMatrix();
        this.tris.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      const d = this.triData, o = i * 11;
      const drag = (1 - Math.exp(-age * 1.5)) / 1.5;
      this.dummy.position.set(d[o] + d[o + 3] * drag, Math.max(0.08, d[o + 1] + d[o + 4] * drag - 5 * age * age), d[o + 2] + d[o + 5] * drag);
      this.dummy.quaternion.setFromAxisAngle(this.tmpV.set(d[o + 6], d[o + 7], d[o + 8]), d[o + 9] * age);
      this.dummy.scale.setScalar(0.22 * (1 - smoothstep((age / life - 0.6) / 0.4)));
      this.dummy.updateMatrix();
      this.tris.setMatrixAt(i, this.dummy.matrix);
      this.hsl(this.tmpC, d[o + 10] + age * 0.8, 0.9, 0.62);
      this.tris.setColorAt(i, this.tmpC);
    }
    this.dummy.quaternion.identity();
    this.tris.instanceMatrix.needsUpdate = true;
    if (this.tris.instanceColor) this.tris.instanceColor.needsUpdate = true;

    // --- the giant real blade ------------------------------------------------------------------------------------------
    const appear = smoothstep((t - T_BLADE) / 0.45);
    const dropTau = THREE.MathUtils.clamp((t - T_DROP) / DROP_TIME, 0, 1);
    const hy = t < T_DROP ? BLADE_HOVER + 0.3 * Math.sin(t * 6) : BLADE_HOVER * (1 - dropTau * dropTau);
    this.blade.position.set(ENEMY_POS.x, hy, ENEMY_POS.z);
    this.blade.scale.setScalar(BLADE_SIZE * (0.4 + 0.6 * appear));
    this.bladeMat.opacity = appear;
    this.blade.visible = appear > 0.01 && after < 0.06;
    this.bladeMat.emissiveIntensity = 0.5 + 0.5 * appear + 1.6 * Math.exp(-after * 20);
    const snapT = Math.abs(t - (T_BLADE + 0.2));
    this.snap.mesh.position.copy(this.cPoint);
    this.snap.mesh.scale.setScalar(1 + 5 * Math.exp(-snapT * 4));
    this.snap.opacity = t > T_CONV + 0.4 && t < T_DROP ? 0.5 * Math.exp(-snapT * 4) : 0;
    this.bladeGlow.mesh.position.set(0, hy + BLADE_SIZE * 0.5, 0);
    this.bladeGlow.mesh.scale.setScalar(BLADE_SIZE * 0.55);
    this.bladeGlow.opacity = t < T_IMPACT ? 0.2 * appear : 0;
    const pillarOp = t < T_IMPACT ? 0.35 * smoothstep((t - T_DROP + 0.1) / 0.1) : 0.5 * Math.exp(-after * 4);
    this.pillar.set(ENEMY_POS.x, ENEMY_POS.z, 0, 34, pillarOp * fade);
    shake += t > T_BLADE && t < T_IMPACT ? 0.08 * appear : 0;

    // --- enemy ------------------------------------------------------------------------------------------------------------
    this.enemy.group.position.x = hitFlash > 0.05 ? 0.08 * Math.sin(t * 60) * hitFlash : 0;
    if (!this.impacted) this.enemy.setFlash(0.9 * hitFlash);
    else { this.enemy.setFlash(1.2 * Math.exp(-after * 8)); this.enemy.setCrush(smoothstep(after / 0.12)); }

    // --- impact: burst, chromatic shockwave, glass shards, dissolving clones ------------------------------------------------
    if (this.impacted) {
      this.burst.mesh.position.set(0, 1.5, 0);
      this.burst.mesh.scale.setScalar(1 + after * 14);
      this.burst.opacity = 0.6 * Math.exp(-after * 4.5) * fade;
      this.burstPrism.mesh.position.set(0, 2, 0);
      this.burstPrism.mesh.scale.setScalar(2 + after * 20);
      this.burstPrism.opacity = 0.35 * Math.exp(-after * 3.5) * fade;
      this.shockRings.forEach((r, i) => {
        r.mesh.scale.setScalar(1 + after * (22 + i * 2.5));
        r.material.opacity = Math.max(0, 0.5 * (1 - after / 0.9));
      });
      this.light.position.set(0, 3, 0);
      this.light.intensity = 520 * Math.exp(-after * 6) * s.blastPower;
      shake += 0.9 * s.blastPower * Math.exp(-after * 6);
    } else {
      this.burst.opacity = 0;
      this.burstPrism.opacity = 0;
      for (const r of this.shockRings) r.material.opacity = 0;
      this.light.intensity = 0;
    }
    for (let i = 0; i < N_GLASS; i++) {
      const o = i * 8, g = this.glassData;
      if (!this.impacted) {
        this.dummy.scale.setScalar(0.0001);
        this.dummy.position.set(0, -50, 0);
      } else {
        const tau = after;
        const h = (1 - Math.exp(-tau * 1.4)) / 1.4;
        let y = 0.3 + g[o + 2] * tau - 7 * tau * tau;
        let spin = g[o + 6] * tau;
        if (y < 0.1) { y = 0.1; spin = g[o + 6] * Math.min(tau, 0.9); }
        this.dummy.position.set(Math.cos(g[o]) * (0.6 + g[o + 1] * h), y, Math.sin(g[o]) * (0.6 + g[o + 1] * h));
        this.dummy.quaternion.setFromAxisAngle(this.tmpV.set(g[o + 3], g[o + 4], g[o + 5]), spin);
        this.dummy.scale.setScalar(g[o + 7] * (1 - smoothstep((t - (DURATION - 1.0)) / 0.9)));
        const glint = 0.5 + 0.3 * Math.pow(Math.max(0, Math.sin(tau * 14 + i)), 3);
        this.hsl(this.tmpC, g[o] / (Math.PI * 2) + tau * 0.7, 0.9, glint);
        this.glass.setColorAt(i, this.tmpC);
      }
      this.dummy.updateMatrix();
      this.glass.setMatrixAt(i, this.dummy.matrix);
    }
    this.dummy.quaternion.identity();
    this.glass.instanceMatrix.needsUpdate = true;
    if (this.glass.instanceColor) this.glass.instanceColor.needsUpdate = true;

    this.shake = shake;
  }

  private onImpact() {
    this.impacted = true;
    const k = this.settings.blastPower;
    for (let n = 0; n < 12; n++) {
      const a = (n / 12) * Math.PI * 2;
      this.dust.burst(20, this.tmpV.set(Math.cos(a) * 2.5, 0.2, Math.sin(a) * 2.5));
    }
    this.gold.burst(Math.floor(300 * k), this.tmpV.set(0, 0.6, 0));
    for (const g of [this.glitA, this.glitB, this.glitC]) g.burst(Math.floor(80 * k), this.tmpV.set(0, 1.2, 0));
    for (let n = 0; n < 40; n++) this.spawnTri(this.tmpV.set(0, 0.8, 0), 12, this.time);
    // clones dissolve into glitter
    CLONE_FORM.forEach(([fx, fz]) => {
      const p = this.tmpV.set(fx, 1.2, CASTER_POS.z + fz);
      for (const g of [this.glitA, this.glitB, this.glitC]) g.burst(24, p);
    });
  }
}

export const illusionistRainOfDoomModule: EffectModule = {
  label: 'illusionist rain of doom',
  category: 'original',
  create: () => new IllusionistRainOfDoom(),
  telegraphs: () => [
    // The rain zone (mostly illusions — only the real blades hurt), then the giant blade's drop point.
    { shape: { kind: 'circle', x: 0, z: 0, radius: 6 }, start: 1.6, impact: 2.6, until: 4.7 },
    { shape: { kind: 'circle', x: 0, z: 0, radius: 4 }, start: 4.4, impact: T_DROP + 0.3 },
  ],
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls) {
    // Caster + clones at z ~ 14-17, enemy at 0, the sword cloud ~ 17 high.
    frameArena(camera, controls, new THREE.Vector3(0, 8, 7), 17);
  },
  buildGui(f, effect) {
    const r = effect as IllusionistRainOfDoom;
    const s = r.settings;
    f.add(s, 'loop');
    f.add(s, 'cloudHeight', 10, 26, 0.5).name('cloud height').onChange(() => r.applyCloudHeight());
    f.add(s, 'blastPower', 0.3, 2, 0.05).name('finale power');
  },
};
