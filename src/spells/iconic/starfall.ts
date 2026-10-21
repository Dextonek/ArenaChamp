import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
  softDotTexture,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Starfall (reworked): the sky over the battlefield darkens to a starry violet while a lunar crescent glows under
 * the caster. Dozens of stars then streak down at a diagonal, each trailing a long thin light streak and ending in a
 * starburst on the ground; a few of them strike the enemy directly.
 */
export interface StarfallSettings {
  stars: number;
  radius: number; // area (around the enemy) the stars land in
  duration: number;
  color: string;
  loop: boolean;
}

export const defaultStarfall = (): StarfallSettings => ({
  stars: 44,
  radius: 9,
  duration: 4.5,
  color: '#c7a4ff',
  loop: false,
});

const MAX_STARS = 80;
const FLIGHT = 0.6;
const SKY_STARS = 520;
const DOME_R = 42;
const SLANT = new THREE.Vector3(-0.32, 1, -0.18).normalize(); // direction from impact point back up to the sky
const UP = new THREE.Vector3(0, 1, 0);
const STAR_HEIGHT = 30;

interface Star {
  target: THREE.Vector3;
  start: number; // seconds into the spell
  hitsEnemy: boolean;
  head: GlowSphere;
  ring: ReturnType<typeof createRing>;
  fired: boolean;
}

function createCrescent(): THREE.ShapeGeometry {
  const R = 1, r = 0.8, d = 0.4;
  const x0 = (R * R - r * r + d * d) / (2 * d);
  const y0 = Math.sqrt(R * R - x0 * x0);
  const aOuter = Math.atan2(y0, x0);
  const aInner = Math.atan2(y0, x0 - d);
  const shape = new THREE.Shape();
  const N = 40;
  // Outer arc of the big circle, the long way round, then back along the left side of the offset circle.
  for (let i = 0; i <= N; i++) {
    const a = aOuter + (i / N) * (2 * Math.PI - 2 * aOuter);
    if (i === 0) shape.moveTo(Math.cos(a) * R, Math.sin(a) * R); else shape.lineTo(Math.cos(a) * R, Math.sin(a) * R);
  }
  for (let i = 0; i <= N; i++) {
    const a = 2 * Math.PI - aInner - (i / N) * (2 * Math.PI - 2 * aInner);
    shape.lineTo(d + Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(shape);
}

export class Starfall implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StarfallSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private caster = createCaster(0x6a4a9a);
  private enemy = new Enemy();
  private handGlow = new GlowSphere(0xd9c4ff, { rim: false });
  private domeMat = new THREE.MeshBasicMaterial({
    color: 0x120a2e, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  private dome: THREE.Mesh;
  private skyGeo = new THREE.BufferGeometry();
  private skyColors: Float32Array;
  private skySeed: Float32Array;
  private skyMat = new THREE.PointsMaterial({
    size: 0.7, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true, map: softDotTexture(),
  });
  private sky: THREE.Points;
  private moonRing = createRing(0xe6dcff, 0.92, 1, 96);
  private moonRing2 = createRing(0xc9b4ff, 0.55, 0.58, 96);
  private crescentMat = new THREE.MeshBasicMaterial({
    color: 0xe6dcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide,
  });
  private crescent = new THREE.Mesh(createCrescent(), this.crescentMat);
  private streakMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8,
  });
  private streaks: THREE.InstancedMesh;
  private stars: Star[] = [];
  private flashGlow = new GlowSphere(0xe6dcff);
  private sparks: Emitter;
  private dust: Emitter;
  private tmp = new THREE.Object3D();
  private tmpV = new THREE.Vector3();
  private tmpC = new THREE.Color();

  constructor(settings: StarfallSettings = defaultStarfall()) {
    this.settings = settings;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.domeMat);
    this.dome.position.set(0, -0.5, 4);
    this.dome.renderOrder = 5;

    // Twinkling sky points on the dome.
    const pos = new Float32Array(SKY_STARS * 3);
    this.skyColors = new Float32Array(SKY_STARS * 3);
    this.skySeed = new Float32Array(SKY_STARS);
    for (let i = 0; i < SKY_STARS; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(0.12 + Math.random() * 0.88); // keep away from the horizon, favour the high sky
      const r = DOME_R - 1;
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      pos[i * 3 + 1] = Math.cos(ph) * r;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r + 4;
      this.skySeed[i] = Math.random() * 100;
    }
    this.skyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.skyGeo.setAttribute('color', new THREE.BufferAttribute(this.skyColors, 3));
    this.sky = new THREE.Points(this.skyGeo, this.skyMat);
    this.sky.frustumCulled = false;

    this.crescent.rotation.x = -Math.PI / 2;
    this.crescent.position.set(CASTER_POS.x, 0.06, CASTER_POS.z);

    // Streaks: unit-height cylinders, base at the head, pointing back along the trail (instanced).
    const sg = new THREE.CylinderGeometry(0.025, 0.07, 1, 6, 1, true);
    sg.translate(0, 0.5, 0);
    this.streaks = new THREE.InstancedMesh(sg, this.streakMat, MAX_STARS);
    this.streaks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_STARS * 3), 3);
    this.streaks.frustumCulled = false;
    this.streaks.count = 0;

    this.group.add(createGround(), this.caster.group, this.enemy.group, this.handGlow.mesh);
    this.group.add(this.dome, this.sky, this.moonRing.mesh, this.moonRing2.mesh, this.crescent, this.streaks);
    this.group.add(this.flashGlow.mesh);

    // Stars: scheduled landing points in a disc around the enemy; a quarter of them hit the enemy itself.
    for (let i = 0; i < MAX_STARS; i++) {
      const hitsEnemy = i % 7 === 3;
      const target = new THREE.Vector3();
      if (hitsEnemy) target.set((Math.random() - 0.5) * 0.7, 1.2 + Math.random() * 0.6, (Math.random() - 0.5) * 0.7);
      const head = new GlowSphere(0xf0e6ff);
      const ring = createRing(0xd9c4ff, 0.7, 1, 32);
      this.group.add(head.mesh, ring.mesh);
      this.stars.push({ target, start: 0, hitsEnemy, head, ring, fired: false });
    }

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 2400, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.15, speed: 5, speedJitter: 0.6, spread: 90, gravity: 6, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#a46bff',
      opacityStart: 0.85, opacityEnd: 0, additive: true,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 3, speed: 1.2, speedJitter: 0.5, spread: 25, gravity: -0.3, drag: 0.7,
      sizeStart: 0.18, sizeEnd: 0, colorStart: '#efe6ff', colorEnd: '#b48cff',
      opacityStart: 0.4, opacityEnd: 0, additive: true,
    });
    this.emitters.push(this.sparks, this.dust);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.moonRing2.material.color.set(c);
    for (const s of this.stars) s.ring.material.color.set(c);
    this.flashGlow.color.set(c);
    this.sparks.settings.colorEnd = c;
    this.sparks.applyStyle();
  }

  get duration() {
    return this.settings.duration;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.schedule();
    this.layout();
  }

  /** Lays out landing points and start times for the current settings. */
  private schedule() {
    const s = this.settings;
    const n = Math.min(MAX_STARS, Math.round(s.stars));
    const t0 = 0.9;
    const t1 = s.duration - 1.2 - FLIGHT;
    for (let i = 0; i < MAX_STARS; i++) {
      const st = this.stars[i];
      st.fired = false;
      // Evenly spread with a little jitter; the density rises toward the middle of the volley.
      const f = (i + 0.5) / n;
      const eased = f * f * (3 - 2 * f) * 0.35 + f * 0.65;
      st.start = t0 + eased * (t1 - t0) + Math.sin(i * 12.9898) * 0.06;
      if (!st.hitsEnemy) {
        // Stored as unit-disc offsets; normalise to the landing radius.
        const a = i * 2.399963; // golden angle spiral for an even spread
        const rr = Math.sqrt(((i * 0.618) % 1) * 0.9 + 0.1);
        st.target.set(Math.cos(a) * rr * s.radius, 0.05, Math.sin(a) * rr * s.radius * 0.8);
      }
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const n = Math.min(MAX_STARS, Math.round(this.settings.stars));
    for (let i = 0; i < n; i++) {
      const st = this.stars[i];
      if (!st.fired && this.time >= st.start + FLIGHT) {
        st.fired = true;
        this.sparks.burst(st.hitsEnemy ? 40 : 22, st.target);
        if (st.hitsEnemy) this.shake = Math.max(this.shake, 0.08);
      }
    }
    this.shake *= 0.9;
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const n = Math.min(MAX_STARS, Math.round(s.stars));
    const fade = 1 - smoothstep((t - (this.duration - 0.9)) / 0.9);
    const dusk = smoothstep(t / 0.9) * fade;

    // Sky darkens to starry violet; sky points twinkle.
    this.domeMat.opacity = 0.62 * dusk;
    this.dome.visible = dusk > 0.01;
    this.skyMat.opacity = dusk;
    for (let i = 0; i < SKY_STARS; i++) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (1.5 + (this.skySeed[i] % 3)) + this.skySeed[i]));
      const warm = this.skySeed[i] % 1;
      this.skyColors[i * 3] = (0.55 + 0.35 * warm) * tw;
      this.skyColors[i * 3 + 1] = (0.45 + 0.2 * warm) * tw;
      this.skyColors[i * 3 + 2] = 0.95 * tw;
    }
    (this.skyGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.sky.visible = dusk > 0.01;

    // Lunar circle under the caster: pale ring + crescent, slowly turning.
    const moon = smoothstep((t - 0.1) / 0.9) * fade;
    this.moonRing.mesh.position.set(CASTER_POS.x, 0.05, CASTER_POS.z);
    this.moonRing.mesh.scale.setScalar(2.8);
    this.moonRing2.mesh.position.set(CASTER_POS.x, 0.055, CASTER_POS.z);
    this.moonRing2.mesh.scale.setScalar(2.1);
    this.moonRing2.mesh.rotation.z = t * 0.6;
    this.crescent.position.set(CASTER_POS.x, 0.06, CASTER_POS.z);
    this.crescent.rotation.set(-Math.PI / 2, 0, t * 0.35);
    this.crescent.scale.setScalar(1.7);
    this.moonRing.material.opacity = 0.45 * moon;
    this.moonRing2.material.opacity = 0.35 * moon;
    this.crescentMat.opacity = 0.4 * moon * (0.85 + 0.15 * Math.sin(t * 3));

    // Caster hand glow while the sky answers.
    this.handGlow.mesh.position.set(CASTER_POS.x + 0.35, 2.5, CASTER_POS.z - 0.35);
    this.handGlow.mesh.scale.setScalar(0.25 + 0.15 * Math.sin(t * 6));
    this.handGlow.opacity = 0.5 * smoothstep(t / 0.8) * fade;
    this.caster.material.emissive.setRGB(0.08 * moon, 0.04 * moon, 0.2 * moon);

    // Stars in flight.
    let flash = 0;
    let used = 0;
    this.tmpV.copy(SLANT);
    for (let i = 0; i < MAX_STARS; i++) {
      const st = this.stars[i];
      const active = i < n;
      const u = active ? (t - st.start) / FLIGHT : -1;
      const flying = u >= 0 && u < 1;
      st.head.mesh.visible = flying;
      if (flying) {
        // Head falls along the slanted line down to its target (accelerating).
        const dist = STAR_HEIGHT * (1 - u * u);
        const hx = st.target.x + SLANT.x * dist;
        const hy = st.target.y + SLANT.y * dist;
        const hz = st.target.z + SLANT.z * dist;
        st.head.mesh.position.set(hx, hy, hz);
        st.head.mesh.scale.setScalar(0.28 + 0.1 * Math.sin(i + t * 20));
        st.head.opacity = 0.9;
        // Streak: from the head, pointing back up the line, long and thin.
        const len = Math.min(dist, 7 + 2 * Math.sin(i));
        this.tmp.position.set(hx, hy, hz);
        this.tmp.quaternion.setFromUnitVectors(UP, this.tmpV);
        this.tmp.scale.set(1 + 0.4 * Math.sin(i * 1.7), len, 1);
        this.tmp.updateMatrix();
        this.streaks.setMatrixAt(used, this.tmp.matrix);
        this.tmpC.setRGB(0.75 * (1 - u * 0.4), 0.55 * (1 - u * 0.4), 1.0);
        this.streaks.setColorAt(used, this.tmpC);
        used++;
      }
      // Impact starburst at the landing point.
      const after = t - (st.start + FLIGHT);
      const bursting = active && after >= 0 && after < 0.5;
      if (bursting) {
        const k = after / 0.5;
        st.ring.mesh.position.set(st.target.x, st.hitsEnemy ? 0.06 : 0.07, st.target.z);
        st.ring.mesh.scale.setScalar(0.25 + 1.8 * (1 - Math.pow(1 - k, 2)));
        st.ring.material.opacity = 0.7 * (1 - k) * fade;
      } else {
        st.ring.material.opacity = 0;
      }
      if (st.hitsEnemy && active && after >= 0) flash = Math.max(flash, Math.exp(-after * 9));
    }
    this.streaks.count = used;
    this.streaks.instanceMatrix.needsUpdate = true;
    if (this.streaks.instanceColor) this.streaks.instanceColor.needsUpdate = true;
    this.streakMat.opacity = 0.7 * fade;

    // Enemy flash on direct hits.
    this.enemy.setFlash(flash);
    this.flashGlow.mesh.position.set(ENEMY_POS.x, 1.3, ENEMY_POS.z);
    this.flashGlow.mesh.scale.setScalar(1.2 + 0.8 * (1 - flash));
    this.flashGlow.opacity = 0.35 * flash;
  }
}

export const starfallModule: EffectModule = {
  label: 'starfall',
  category: 'iconic',
  create: () => new Starfall(),
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const s = (effect as Starfall).settings;
    frameArena(camera, controls, new THREE.Vector3(0, 8, 6), Math.max(13, s.radius * 1.4 + 5));
  },
  buildGui(f, effect) {
    const sf = effect as Starfall;
    const s = sf.settings;
    f.add(s, 'loop');
    f.add(s, 'stars', 10, 80, 1).name('stars');
    f.add(s, 'radius', 3, 16, 0.5).name('area radius');
    f.add(s, 'duration', 3, 7, 0.1).name('duration');
    f.addColor(s, 'color').onChange(() => sf.applyStyle());
  },
};
