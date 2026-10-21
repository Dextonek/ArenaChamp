import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
  softDotTexture,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Death Coil: the dark caster gathers sickly green-yellow necrotic energy, then launches a writhing serpentine
 * coil with a skull-ish head that weaves toward the enemy trailing shadowy wisps. Impact: a necrotic burst of
 * green light and dark smoke, ghostly faces rising, and the enemy flashes and is tinted green.
 */
export interface DeathCoilSettings {
  castTime: number;
  flightTime: number;
  wobble: number; // sideways weave of the coil
  loop: boolean;
}

export const defaultDeathCoil = (): DeathCoilSettings => ({
  castTime: 1.1,
  flightTime: 0.8,
  wobble: 0.6,
  loop: false,
});

const AFTERMATH = 2.4;
const BEADS = 14;
const GATHER = 240;
const GHOSTS = 7;
const NECRO = 0xb6ff3a;

interface Ghost {
  group: THREE.Group;
  bodyMat: THREE.MeshBasicMaterial;
  eyeMat: THREE.MeshBasicMaterial;
  x: number;
  z: number;
  delay: number;
  sway: number;
}

function emit(e: Emitter, rate: number, dt: number, at: THREE.Vector3) {
  const n = rate * dt;
  const count = Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0);
  if (count > 0) e.burst(count, at);
}

export class DeathCoil implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DeathCoilSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;

  private caster = createCaster(0x2a3340);
  private enemy = new Enemy();
  private enemyBase = new THREE.Color();
  private hand = new THREE.Vector3(0.45, 2.1, CASTER_POS.z - 0.5);
  private end = new THREE.Vector3(0, 1.3, 0.2);
  private gatherPoints: THREE.Points;
  private gatherParams = new Float32Array(GATHER * 4); // angle, radius, height, phase
  private gatherPos = new Float32Array(GATHER * 3);
  private gatherMat = new THREE.PointsMaterial({
    color: NECRO, size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    map: softDotTexture(),
  });
  private handGlow = new GlowSphere(NECRO, { rim: false });
  private beads: GlowSphere[] = [];
  private beadPos: THREE.Vector3[] = [];
  private headGroup = new THREE.Group();
  private headMat = new THREE.MeshStandardMaterial({
    color: 0x1a2018, roughness: 0.7, emissive: 0x3a7010, emissiveIntensity: 0.7, transparent: true,
  });
  private eyeBlackMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true });
  private headHalo = new GlowSphere(NECRO);
  private burstA = new GlowSphere(NECRO);
  private burstB = new GlowSphere(0x4dff66);
  private ring = createRing(0x8aff3a, 0.88, 1, 96);
  private ghosts: Ghost[] = [];
  private smoke: Emitter;
  private motes: Emitter;
  private impactSmoke: Emitter;
  private impactMotes: Emitter;
  private headPos = new THREE.Vector3();
  private tint = new THREE.Color(0x6bd13a);

  constructor(settings: DeathCoilSettings = defaultDeathCoil()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.enemyBase.copy(this.enemy.material.color);

    // Gathering necrotic energy: own Points spiralling into the hand.
    for (let i = 0; i < GATHER; i++) {
      this.gatherParams[i * 4] = Math.random() * Math.PI * 2;
      this.gatherParams[i * 4 + 1] = 1.2 + Math.random() * 2.2;
      this.gatherParams[i * 4 + 2] = (Math.random() - 0.5) * 2.4;
      this.gatherParams[i * 4 + 3] = Math.random();
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(this.gatherPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.gatherPoints = new THREE.Points(gGeo, this.gatherMat);
    this.gatherPoints.frustumCulled = false;
    this.group.add(this.gatherPoints, this.handGlow.mesh);

    for (let i = 0; i < BEADS; i++) {
      const b = new GlowSphere(i % 3 === 0 ? 0xe4ff5a : NECRO, { rim: false });
      this.beads.push(b);
      this.beadPos.push(new THREE.Vector3());
      this.group.add(b.mesh);
    }

    // Skull-ish head: dark sphere, two black eye holes and a jaw block, facing +Z locally (lookAt aims +Z).
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), this.headMat);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.3), this.headMat);
    jaw.position.set(0, -0.3, 0.12);
    const eyeGeo = new THREE.SphereGeometry(0.1, 10, 8);
    for (const x of [-0.16, 0.16]) {
      const eye = new THREE.Mesh(eyeGeo, this.eyeBlackMat);
      eye.position.set(x, 0.06, 0.34);
      this.headGroup.add(eye);
    }
    this.headGroup.add(skull, jaw);
    this.group.add(this.headGroup, this.headHalo.mesh, this.burstA.mesh, this.burstB.mesh, this.ring.mesh);

    // Ghostly faces: stretched translucent ellipsoids with dark eye and mouth holes.
    const bodyGeo = new THREE.SphereGeometry(1, 14, 10);
    const holeGeo = new THREE.SphereGeometry(0.12, 8, 6);
    for (let i = 0; i < GHOSTS; i++) {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshBasicMaterial({ color: 0xc8ff9a, transparent: true, opacity: 0, depthWrite: false });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a1206, transparent: true, opacity: 0, depthWrite: false });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.scale.set(0.38, 0.62, 0.3);
      g.add(body);
      for (const x of [-0.13, 0.13]) {
        const eye = new THREE.Mesh(holeGeo, eyeMat);
        eye.position.set(x, 0.14, 0.26);
        eye.scale.set(1, 1.5, 0.6);
        g.add(eye);
      }
      const mouth = new THREE.Mesh(holeGeo, eyeMat);
      mouth.position.set(0, -0.2, 0.27);
      mouth.scale.set(1.2, 2, 0.6);
      g.add(mouth);
      g.visible = false;
      this.group.add(g);
      this.ghosts.push({
        group: g, bodyMat, eyeMat, delay: 0.1 + i * 0.12, sway: Math.random() * 6,
        x: (Math.random() - 0.5) * 2.4, z: (Math.random() - 0.5) * 2.4,
      });
    }

    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.15, speed: 0.6, speedJitter: 0.6, spread: 180, gravity: -0.4, drag: 1,
      sizeStart: 0.5, sizeEnd: 0.9, colorStart: '#1c2418', colorEnd: '#06080a', opacityStart: 0.5, opacityEnd: 0, additive: false,
      colorMid: '#2e3a28', sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 1000, rate: 0, lifetime: 0.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.12, speed: 0.5, speedJitter: 0.6, spread: 180, gravity: -0.8, drag: 1,
      sizeStart: 0.2, sizeEnd: 0.02, colorStart: '#d8ff6a', colorEnd: '#2a9a10', opacityStart: 0.5, opacityEnd: 0, additive: true,
      colorMid: '#7be024', sizeJitter: 0.4, erosion: 0.45, spin: 0.4,
    });
    this.impactSmoke = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, speed: 3.5, speedJitter: 0.6, spread: 180, gravity: -0.5, drag: 1.4,
      sizeStart: 0.9, sizeEnd: 2, colorStart: '#222c1c', colorEnd: '#06080a', opacityStart: 0.55, opacityEnd: 0, additive: false,
      colorMid: '#2e3a28', sizeJitter: 0.4, erosion: 0.6, spin: 0.4, groundFade: 0.3,
    });
    this.impactMotes = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.7, speed: 5, speedJitter: 0.6, spread: 180, gravity: -1, drag: 1.2,
      sizeStart: 0.25, sizeEnd: 0.02, colorStart: '#e4ff70', colorEnd: '#2aa010', opacityStart: 0.6, opacityEnd: 0, additive: true,
      colorMid: '#7be024', sizeJitter: 0.4, erosion: 0.45, spin: 0.4,
    });
    this.emitters.push(this.smoke, this.motes, this.impactSmoke, this.impactMotes);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
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
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    this.enemy.material.color.copy(this.enemyBase);
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
    const impactTime = this.settings.castTime + this.settings.flightTime;
    if (!this.impacted && this.time >= impactTime) this.onImpact();
    this.layout();
    if (this.time > this.settings.castTime && !this.impacted) {
      // Shadowy wisps and green motes along the coil body.
      for (let i = 1; i < BEADS; i += 2) {
        emit(this.smoke, 22, dt, this.beadPos[i]);
        emit(this.motes, 16, dt, this.beadPos[i]);
      }
    }
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const impactTime = s.castTime + s.flightTime;
    const after = t - impactTime;
    const gather = smoothstep(t / s.castTime);
    const fade = 1 - smoothstep((t - (this.duration - 0.7)) / 0.7);

    // Gathering spiral: each point flows in from a wide helix to the hand, endlessly recycled.
    const flowing = t < s.castTime + 0.1;
    this.gatherMat.opacity = flowing ? 0.5 * Math.min(1, gather * 2) : 0;
    this.gatherPoints.visible = flowing;
    for (let i = 0; i < GATHER; i++) {
      const a0 = this.gatherParams[i * 4], r0 = this.gatherParams[i * 4 + 1];
      const h0 = this.gatherParams[i * 4 + 2], ph = this.gatherParams[i * 4 + 3];
      const u = (t * 0.9 + ph) % 1;
      const a = a0 + u * 6;
      const r = r0 * (1 - u) + 0.04;
      this.gatherPos[i * 3] = this.hand.x + Math.cos(a) * r;
      this.gatherPos[i * 3 + 1] = this.hand.y + h0 * (1 - u);
      this.gatherPos[i * 3 + 2] = this.hand.z + Math.sin(a) * r;
    }
    this.gatherPoints.geometry.attributes.position.needsUpdate = true;
    this.handGlow.mesh.position.copy(this.hand);
    this.handGlow.mesh.scale.setScalar(0.12 + 0.4 * gather);
    this.handGlow.opacity = t < s.castTime + 0.1 ? 0.5 * gather : 0.5 * Math.exp(-(t - s.castTime - 0.1) * 8);

    // Coil: the head leads along a straight path, beads trail behind it on a sine-wobbling track.
    const launched = t >= s.castTime && !this.impacted;
    const u = THREE.MathUtils.clamp((t - s.castTime) / s.flightTime, 0, 1);
    const pathPoint = (p: number, out: THREE.Vector3) => {
      out.lerpVectors(this.hand, this.end, p);
      const env = Math.sin(Math.min(1, p) * Math.PI) * 0.8 + 0.2;
      out.x += Math.sin(p * 18 - t * 16) * s.wobble * env;
      out.y += Math.cos(p * 13 - t * 12) * s.wobble * 0.7 * env;
      return out;
    };
    const ease = u * u * (3 - 2 * u);
    pathPoint(ease, this.headPos);
    const lead = new THREE.Vector3();
    pathPoint(Math.min(1, ease + 0.03), lead);
    this.headGroup.position.copy(this.headPos);
    this.headGroup.lookAt(lead);
    this.headGroup.scale.setScalar(0.9 + 0.1 * Math.sin(t * 20));
    this.headGroup.visible = launched;
    this.headMat.opacity = 1;
    this.headHalo.mesh.position.copy(this.headPos);
    this.headHalo.mesh.scale.setScalar(0.9);
    this.headHalo.opacity = launched ? 0.3 : 0;
    for (let i = 0; i < BEADS; i++) {
      const p = Math.max(0, ease - (i + 1) * 0.035);
      pathPoint(p, this.beadPos[i]);
      const b = this.beads[i];
      b.mesh.position.copy(this.beadPos[i]);
      b.mesh.scale.setScalar(0.38 - 0.02 * i);
      b.opacity = launched ? 0.5 * (1 - i / (BEADS * 1.3)) : 0;
    }

    // Impact: necrotic burst, ring, ghostly faces, green tint on the enemy.
    if (this.impacted) {
      this.burstA.mesh.position.set(ENEMY_POS.x, 1.3, ENEMY_POS.z);
      this.burstA.mesh.scale.setScalar(0.8 + after * 8);
      this.burstA.opacity = 0.55 * Math.exp(-after * 9);
      this.burstB.mesh.position.set(ENEMY_POS.x, 1.3, ENEMY_POS.z);
      this.burstB.mesh.scale.setScalar(0.5 + Math.max(0, after - 0.08) * 12);
      this.burstB.opacity = after > 0.08 ? 0.4 * Math.exp(-(after - 0.08) * 6) : 0;
      this.ring.mesh.scale.setScalar(1 + after * 14);
      this.ring.material.opacity = Math.max(0, 0.6 * (1 - after / 0.8));
      this.shake = 0.45 * Math.exp(-after * 8);
      this.enemy.setFlash(1.1 * Math.exp(-after * 5));
      const tintAmt = smoothstep(after / 0.12) * (1 - smoothstep((after - 0.5) / 1.2));
      this.enemy.material.color.copy(this.enemyBase).lerp(this.tint, tintAmt);
    } else {
      this.burstA.opacity = 0;
      this.burstB.opacity = 0;
      this.ring.material.opacity = 0;
    }
    for (const g of this.ghosts) {
      const a = after - g.delay;
      const on = this.impacted && a > 0 && a < 1.9;
      g.group.visible = on;
      if (!on) continue;
      const op = 0.4 * smoothstep(a / 0.25) * (1 - smoothstep((a - 1.1) / 0.8)) * fade;
      g.bodyMat.opacity = op;
      g.eyeMat.opacity = op * 2;
      g.group.position.set(ENEMY_POS.x + g.x + Math.sin(a * 2 + g.sway) * 0.3, 1.2 + a * 1.9, ENEMY_POS.z + g.z);
      g.group.rotation.set(0, Math.PI / 2, Math.sin(a * 3 + g.sway) * 0.2); // faces +X, the camera side
      g.group.scale.set(1, 1 + 0.4 * a, 1);
    }
  }

  private onImpact() {
    this.impacted = true;
    const at = new THREE.Vector3(ENEMY_POS.x, 1.2, ENEMY_POS.z);
    this.impactSmoke.burst(260, at);
    this.impactMotes.burst(380, at);
  }
}

export const deathCoilModule: EffectModule = {
  label: 'death coil',
  category: 'iconic',
  create: () => new DeathCoil(),
  telegraphs(effect) {
    const s = (effect as DeathCoil).settings;
    const hit = s.castTime + s.flightTime;
    return [
      // The coil's path from the caster's hand to the enemy...
      { shape: { kind: 'line', x1: 0.45, z1: CASTER_POS.z - 0.5, x2: ENEMY_POS.x, z2: ENEMY_POS.z + 0.2, width: 1.6 }, start: 0.2, impact: hit, until: hit },
      // ...and the necrotic burst around the target.
      { shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: 2.2 }, start: s.castTime * 0.6, impact: hit, until: hit + 0.4 },
    ];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    frameArena(camera, controls, new THREE.Vector3(0, 2.5, 7), 11);
  },
  buildGui(f, effect) {
    const s = (effect as DeathCoil).settings;
    f.add(s, 'loop');
    f.add(s, 'castTime', 0.4, 3, 0.05).name('cast time');
    f.add(s, 'flightTime', 0.3, 2, 0.05).name('flight time');
    f.add(s, 'wobble', 0, 1.5, 0.05).name('coil wobble');
  },
};
