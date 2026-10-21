import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, LightPillar, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Metamorphosis (demon hunter): the caster crouches, leaps high and slams down beside the enemy as a giant demon.
 * In the air the figure grows, darkens to a fel-lit silhouette and sprouts leathery wings and horns. The landing is a
 * fel shockwave with a fire burst, flying rocks and dark smoke; the enemy is blasted back.
 */
export interface MetamorphosisSettings {
  leapHeight: number;
  demonScale: number;
  windup: number;
  flight: number;
  color: string;
  loop: boolean;
}

export const defaultMetamorphosis = (): MetamorphosisSettings => ({
  leapHeight: 8,
  demonScale: 2,
  windup: 0.7,
  flight: 1,
  color: '#3aff5a',
  loop: false,
});

const AFTERMATH = 3;
const ROCKS = 44;
const LAND = new THREE.Vector3(0, 0, 3.2); // where the demon comes down, just in front of the enemy
const BASE_COLOR = new THREE.Color(0x2a3a2a);
const DARK_COLOR = new THREE.Color(0x0b0f0c);
const FEL_EDGE = new THREE.Color().setRGB(0.25, 1.5, 0.5);

/** A bat-like wing: a fan of triangles between five spokes with scalloped trailing edges. sign = -1 mirrors it. */
function createWing(sign: number) {
  const angles = [8, 38, 66, 92, 114].map((d) => THREE.MathUtils.degToRad(d));
  const lengths = [3.1, 3.5, 3.1, 2.5, 1.7];
  const tips = angles.map((a, i) => new THREE.Vector3(Math.cos(a) * lengths[i] * sign, Math.sin(a) * lengths[i], -0.12 * i));
  const root = new THREE.Vector3();
  const tri: number[] = [];
  const edge: number[] = [];
  const push = (arr: number[], ...vs: THREE.Vector3[]) => vs.forEach((v) => arr.push(v.x, v.y, v.z));
  for (let i = 0; i < tips.length; i++) {
    push(edge, root, tips[i]);
    if (i + 1 >= tips.length) break;
    const scallop = tips[i].clone().add(tips[i + 1]).multiplyScalar(0.5 * 0.72);
    push(tri, root, tips[i], scallop, root, scallop, tips[i + 1]);
    push(edge, tips[i], scallop, scallop, tips[i + 1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  geo.computeVertexNormals();
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
  return { geo, edges };
}

export class Metamorphosis implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MetamorphosisSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;
  private emberCarry = 0;

  private caster = createCaster(0x2a3a2a);
  private enemy = new Enemy();
  private wingMat = new THREE.MeshStandardMaterial({
    color: 0x16101e, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide, flatShading: true,
    emissive: 0x0a3a1a, emissiveIntensity: 0.35,
  });
  private edgeMat = new THREE.LineBasicMaterial({ color: FEL_EDGE, transparent: true, opacity: 0.9 });
  private hornMat = new THREE.MeshStandardMaterial({
    color: 0x14181a, roughness: 0.5, emissive: 0x0a5a24, emissiveIntensity: 0.4,
  });
  private wings: THREE.Group[] = [];
  private horns: THREE.Mesh[] = [];
  private eyeGlows = [new GlowSphere(0x3aff5a, { rim: false }), new GlowSphere(0x3aff5a, { rim: false })];
  private aura = new GlowSphere(0x3aff5a);
  private gatherGlow = new GlowSphere(0x3aff5a, { rim: false });
  private burst = new GlowSphere(0x5aff80);
  private pillar = new LightPillar(0x3aff5a, 2);
  private shock = createRing(0x4aff78, 0.88, 1, 96);
  private shock2 = createRing(0x1ec84a, 0.9, 1, 96);
  private rune = createRing(0x3aff5a, 0.8, 0.88, 6);
  private mark = createRing(0x3aff5a, 0.9, 1, 64); // landing marker shown during the leap
  private crater: THREE.Mesh;
  private craterMat = new THREE.MeshBasicMaterial({ color: 0x040604, transparent: true, opacity: 0, depthWrite: false });
  private light = new THREE.PointLight(0x3aff5a, 0, 18, 2);
  private rocks: THREE.InstancedMesh;
  private rockPos = new Float32Array(ROCKS * 3);
  private rockVel = new Float32Array(ROCKS * 3);
  private rockRot = new Float32Array(ROCKS * 3);
  private rockSpin = new Float32Array(ROCKS * 3);
  private rockSize = new Float32Array(ROCKS);
  private fire: Emitter;
  private smoke: Emitter;
  private sparks: Emitter;
  private embers: Emitter;
  private dummy = new THREE.Object3D();
  private eul = new THREE.Euler();

  constructor(settings: MetamorphosisSettings = defaultMetamorphosis()) {
    this.settings = settings;

    // Wings and horns ride on the caster so they scale and move with it.
    for (const sign of [1, -1]) {
      const { geo, edges } = createWing(sign);
      const pivot = new THREE.Group();
      pivot.position.set(sign * 0.3, 1.75, -0.4);
      pivot.add(new THREE.Mesh(geo, this.wingMat), new THREE.LineSegments(edges, this.edgeMat));
      pivot.userData.sign = sign;
      this.caster.group.add(pivot);
      this.wings.push(pivot);

      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.95, 8), this.hornMat);
      horn.position.set(sign * 0.33, 2.2, 0.05);
      horn.rotation.set(-0.5, 0, -sign * 0.45);
      this.caster.group.add(horn);
      this.horns.push(horn);
    }
    for (const [i, g] of this.eyeGlows.entries()) {
      g.mesh.position.set(i === 0 ? -0.18 : 0.18, 1.55, 0.5);
      this.caster.group.add(g.mesh);
    }

    this.crater = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.craterMat);
    this.crater.position.set(LAND.x, 0.03, LAND.z);
    this.crater.renderOrder = 1;

    this.rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.3, 0),
      new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.9, flatShading: true }),
      ROCKS,
    );
    this.rocks.frustumCulled = false;

    this.group.add(createGround(), this.crater, this.enemy.group, this.caster.group);
    this.group.add(this.rocks, this.aura.mesh, this.gatherGlow.mesh, this.burst.mesh, this.pillar.mesh);
    this.group.add(this.mark.mesh, this.shock.mesh, this.shock2.mesh, this.rune.mesh, this.light);

    // Dark smoke (normal blended) sits behind the bright fel fire.
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.6, originY: 0.3, speed: 4.5, speedJitter: 0.6, spread: 85, gravity: -0.9, drag: 1.4,
      sizeStart: 1.1, sizeEnd: 3.2, colorStart: '#1d261f', colorEnd: '#070908',
      opacityStart: 0.55, opacityEnd: 0, additive: false, sizeJitter: 0.45, erosion: 0.55, spin: 0.5,
    });
    this.fire = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, originY: 0.3, speed: 7, speedJitter: 0.6, spread: 70, gravity: -2, drag: 1.2,
      sizeStart: 1.0, sizeEnd: 0.2, colorStart: '#d8ffd0', colorMid: '#3aff5a', colorEnd: '#0a5a20',
      opacityStart: 0.5, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, spin: 0.5, groundFade: 0.15,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 1, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, originY: 0.3, speed: 11, speedJitter: 0.6, spread: 75, gravity: 12, drag: 0.4,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#eaffd8', colorMid: '#7affa0', colorEnd: '#2ee858',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.5, speed: 0.8, speedJitter: 0.6, spread: 40, gravity: -1.6, drag: 0.5,
      sizeStart: 0.18, sizeEnd: 0, colorStart: '#d8ffd0', colorMid: '#3aff5a', colorEnd: '#0a5a20',
      opacityStart: 0.6, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.3,
    });
    this.emitters.push(this.smoke, this.fire, this.sparks, this.embers);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.aura.color.set(c);
    this.gatherGlow.color.set(c);
    for (const g of this.eyeGlows) g.color.set(c);
    this.pillar.color.set(c);
    this.shock.material.color.set(c);
    this.rune.material.color.set(c);
    this.mark.material.color.set(c);
    this.light.color.set(c);
    this.fire.settings.colorMid = c;
    this.fire.applyStyle();
    this.embers.settings.colorMid = c;
    this.embers.applyStyle();
  }

  private get leapStart() {
    return this.settings.windup;
  }

  private get impactTime() {
    return this.settings.windup + this.settings.flight;
  }

  get duration() {
    return this.impactTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.emberCarry = 0;
    this.shake = 0;
    this.caster.reset();
    this.caster.material.color.copy(BASE_COLOR);
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.rockSize.fill(0);
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
    if (!this.impacted && this.time >= this.impactTime) this.onImpact();
    if (this.impacted) this.stepRocks(dt);

    // Fel embers stream off the demon form (and a hot trail behind the leap).
    const m = this.morph();
    const flying = this.time > this.leapStart && !this.impacted;
    const rate = flying ? 160 : this.impacted && this.time < this.duration - 1 ? 90 * m : 0;
    this.emberCarry += dt * rate;
    const n = Math.floor(this.emberCarry);
    this.emberCarry -= n;
    if (n > 0) {
      const p = this.caster.group.position;
      this.embers.burst(n, new THREE.Vector3(p.x, p.y + 1.1 * this.caster.group.scale.y, p.z));
    }
    this.layout();
  }

  private morph() {
    const s = this.settings;
    return smoothstep((this.time - this.leapStart - 0.12) / (s.flight * 0.85));
  }

  private stepRocks(dt: number) {
    const P = this.rockPos, V = this.rockVel, R = this.rockRot, S = this.rockSpin;
    for (let i = 0; i < ROCKS; i++) {
      const rad = this.rockSize[i] * 0.22;
      V[i * 3 + 1] -= 24 * dt;
      for (let k = 0; k < 3; k++) {
        P[i * 3 + k] += V[i * 3 + k] * dt;
        R[i * 3 + k] += S[i * 3 + k] * dt;
      }
      if (P[i * 3 + 1] < rad) {
        P[i * 3 + 1] = rad;
        if (Math.abs(V[i * 3 + 1]) > 2) {
          V[i * 3 + 1] *= -0.4;
          V[i * 3] *= 0.7; V[i * 3 + 2] *= 0.7;
        } else {
          V[i * 3 + 1] = 0;
          const f = Math.exp(-4 * dt);
          V[i * 3] *= f; V[i * 3 + 2] *= f;
          S[i * 3] *= f; S[i * 3 + 1] *= f; S[i * 3 + 2] *= f;
        }
      }
    }
  }

  private onImpact() {
    this.impacted = true;
    const at = new THREE.Vector3(LAND.x, 0.2, LAND.z);
    this.fire.burst(520, at);
    this.sparks.burst(450, at);
    this.smoke.burst(150, at);
    for (let i = 0; i < ROCKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 8;
      this.rockPos.set([LAND.x + Math.cos(a) * 1.2, 0.4, LAND.z + Math.sin(a) * 1.2], i * 3);
      this.rockVel.set([Math.cos(a) * sp, 6 + Math.random() * 10, Math.sin(a) * sp], i * 3);
      this.rockRot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
      this.rockSpin.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14], i * 3);
      this.rockSize[i] = 0.5 + Math.random() * 1.1;
    }
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const impactTime = this.impactTime;
    const after = t - impactTime;
    const fade = 1 - smoothstep((t - (this.duration - 0.9)) / 0.9);
    const m = this.morph();
    const g = this.caster.group;

    // --- Caster: crouch -> leap (arc) -> crash down -> settle as a giant. ---
    const crouch = smoothstep(t / s.windup) * (1 - smoothstep((t - s.windup) / 0.12));
    const u = THREE.MathUtils.clamp((t - this.leapStart) / s.flight, 0, 1);
    const ease = 0.5 * u + 0.5 * smoothstep(u);
    const y = s.leapHeight * 4 * u * (1 - u);
    const size = 1 + (s.demonScale - 1) * m;
    const landSquash = this.impacted ? 0.22 * Math.exp(-after * 7) * Math.cos(after * 14) : 0;
    g.position.set(
      CASTER_POS.x + (LAND.x - CASTER_POS.x) * ease, y, CASTER_POS.z + (LAND.z - CASTER_POS.z) * ease,
    );
    g.scale.set(size * (1 + landSquash * 0.5), size * (1 - 0.18 * crouch - landSquash), size * (1 + landSquash * 0.5));
    // Lean forward on the way up, plunge head-first-ish on the way down, upright after landing.
    const lean = u > 0 && u < 1 ? -0.5 * Math.sin(u * Math.PI) : 0;
    g.rotation.set(lean, Math.PI, 0);

    // Dark fel-lit body.
    this.caster.material.color.lerpColors(BASE_COLOR, DARK_COLOR, m);
    const spike = this.impacted ? 0.5 * Math.exp(-after * 5) : 0;
    this.caster.material.emissive.setRGB(0.04 * m + spike * 0.2, 0.5 * m + spike, 0.14 * m + spike * 0.3);
    this.hornMat.emissiveIntensity = 0.3 + 0.7 * m;
    for (const h of this.horns) h.scale.setScalar(Math.max(0.001, smoothstep((m - 0.2) / 0.5)));
    for (const eg of this.eyeGlows) {
      eg.mesh.scale.setScalar(0.1 + 0.18 * m);
      eg.opacity = 0.6 * Math.max(crouch, m);
    }

    // Wings unfold in the air, snap wider on landing, then beat slowly.
    const grow = smoothstep((m - 0.25) / 0.6);
    const flap = this.impacted ? Math.sin(after * 3.2) * 0.12 * smoothstep(after / 0.6) : 0;
    for (const w of this.wings) {
      const sign = w.userData.sign as number;
      w.scale.setScalar(Math.max(0.001, 0.9 * grow));
      this.eul.set(0, sign * (1.45 - 0.7 * grow + 0.3 * (this.impacted ? Math.exp(-after * 4) : 0) + flap), sign * -0.15);
      w.rotation.copy(this.eul);
    }
    this.wingMat.emissiveIntensity = 0.3 + 0.4 * m + spike * 1.2;
    this.edgeMat.opacity = 0.9 * grow;

    // --- Anticipation: fel gathers around the caster; landing marker shows where it will come down. ---
    const centre = g.position;
    this.gatherGlow.mesh.position.set(centre.x, centre.y + 1.1 * size, centre.z);
    this.gatherGlow.mesh.scale.setScalar((0.5 + 0.9 * crouch) * size);
    this.gatherGlow.opacity = 0.4 * Math.max(crouch, m * (this.impacted ? 0 : 1)) * (this.impacted ? 0 : 1);
    this.aura.mesh.position.set(centre.x, centre.y + 1.3 * size, centre.z);
    this.aura.mesh.scale.set(2.2 * size, 2.7 * size, 2.2 * size);
    this.aura.opacity = 0.28 * m * fade * (0.9 + 0.1 * Math.sin(t * 6));

    const markIn = smoothstep((t - s.windup * 0.5) / 0.4) * (this.impacted ? 0 : 1);
    this.mark.mesh.position.set(LAND.x, 0.04, LAND.z);
    this.mark.mesh.scale.setScalar(3.6 - 1.6 * u);
    this.mark.material.opacity = 0.5 * markIn;

    // --- Impact. ---
    if (this.impacted) {
      this.burst.mesh.position.set(LAND.x, 1.3, LAND.z);
      this.burst.mesh.scale.setScalar(1.5 + after * 12);
      this.burst.opacity = 0.55 * Math.exp(-after * 4.5);
      this.shock.mesh.position.set(LAND.x, 0.05, LAND.z);
      this.shock.mesh.scale.setScalar(1 + after * 26);
      this.shock.material.opacity = Math.max(0, 0.85 * (1 - after / 0.9));
      const a2 = Math.max(0, after - 0.12);
      this.shock2.mesh.position.set(LAND.x, 0.05, LAND.z);
      this.shock2.mesh.scale.setScalar(1 + a2 * 18);
      this.shock2.material.opacity = Math.max(0, 0.5 * (1 - a2 / 1.0));
      this.rune.mesh.position.set(LAND.x, 0.06, LAND.z);
      this.rune.mesh.scale.setScalar(3.4);
      this.rune.mesh.rotation.z = t * 0.7;
      this.rune.material.opacity = 0.55 * smoothstep(after / 0.3) * fade;
      this.pillar.set(LAND.x, LAND.z, 0, 16, 0.5 * Math.exp(-after * 3.5));
      this.craterMat.opacity = 0.55 * smoothstep(after / 0.1) * fade;
      this.crater.scale.setScalar(3.6);
      this.light.position.set(LAND.x, 2, LAND.z);
      this.light.intensity = 45 * Math.exp(-after * 5) + 4 * fade;
      this.shake = 0.9 * Math.exp(-after * 5);
    } else {
      this.burst.opacity = 0;
      this.shock.material.opacity = 0;
      this.shock2.material.opacity = 0;
      this.rune.material.opacity = 0;
      this.pillar.set(0, 0, 0, 1, 0);
      this.craterMat.opacity = 0;
      this.light.intensity = 0;
      this.shake = 0;
    }

    // Enemy: blasted back (-Z) in a hop, tumbles backwards, then slowly picks itself up.
    if (this.impacted) {
      const slide = 5.5 * (1 - Math.exp(-after * 4));
      const hop = Math.max(0, 3.2 * after * (1 - after / 0.9));
      this.enemy.group.position.set(ENEMY_POS.x, hop, ENEMY_POS.z - slide);
      const tumble = 1.25 * smoothstep(after / 0.4) - 1.0 * smoothstep((after - 1.6) / 1.0);
      this.enemy.group.rotation.set(-tumble, 0, 0);
      this.enemy.setFlash(1.2 * Math.exp(-after * 4));
    }

    // Rocks.
    for (let i = 0; i < ROCKS; i++) {
      const sz = this.rockSize[i] * fade;
      this.dummy.position.set(this.rockPos[i * 3], this.rockPos[i * 3 + 1], this.rockPos[i * 3 + 2]);
      this.dummy.rotation.set(this.rockRot[i * 3], this.rockRot[i * 3 + 1], this.rockRot[i * 3 + 2]);
      this.dummy.scale.setScalar(sz);
      this.dummy.updateMatrix();
      this.rocks.setMatrixAt(i, this.dummy.matrix);
    }
    this.rocks.instanceMatrix.needsUpdate = true;
  }
}

export const metamorphosisModule: EffectModule = {
  label: 'metamorphosis',
  category: 'iconic',
  create: () => new Metamorphosis(),
  telegraphs(effect) {
    const s = (effect as Metamorphosis).settings;
    // Landing circle, readable from take-off (like a leap telegraph) until the demon crashes down.
    return [{
      shape: { kind: 'circle', x: LAND.x, z: LAND.z, radius: 3.6 },
      start: s.windup, impact: s.windup + s.flight,
    }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const s = (effect as Metamorphosis).settings;
    // Caster at z = 14 leaping to z ~ 3, enemy flung back behind the origin.
    frameArena(camera, controls, new THREE.Vector3(0, s.leapHeight * 0.4, 6), Math.max(12, s.leapHeight * 1.2));
  },
  buildGui(f, effect) {
    const e = effect as Metamorphosis;
    const s = e.settings;
    f.add(s, 'loop');
    f.add(s, 'leapHeight', 2, 16, 0.5).name('leap height');
    f.add(s, 'demonScale', 1, 3.5, 0.05).name('demon scale');
    f.add(s, 'windup', 0.2, 2, 0.05);
    f.add(s, 'flight', 0.5, 2, 0.05);
    f.addColor(s, 'color').onChange(() => e.applyStyle());
  },
};
