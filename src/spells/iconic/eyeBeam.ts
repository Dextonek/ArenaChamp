import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Eye Beam (demon hunter): the caster's eyes flare fel-green, then a wide layered beam channels from them toward the
 * enemy and sweeps over its contact line. Fel fire burns where it touches the ground, a scorch trail follows the
 * sweep, the enemy flashes continuously and is pushed back slowly.
 */
export interface EyeBeamSettings {
  beamWidth: number;
  sweepWidth: number; // how far the contact point swings to either side
  sweepTime: number;
  pushBack: number;
  chargeTime: number;
  color: string;
  loop: boolean;
}

export const defaultEyeBeam = (): EyeBeamSettings => ({
  beamWidth: 1,
  sweepWidth: 2.4,
  sweepTime: 2,
  pushBack: 1.8,
  chargeTime: 0.9,
  color: '#3aff5a',
  loop: false,
});

const AFTERMATH = 1.7;
const DECAL_STEP = 0.04;
const MAX_DECALS = 100;
const RING_COUNT = 9;
const EYE_Y = 1.55;
const EYE_Z = CASTER_POS.z - 0.5; // eyes sit 0.5 in front of the caster's centre (it faces -Z)
const BEAM_START = new THREE.Vector3(0, EYE_Y, EYE_Z + 0.05);
const UP = new THREE.Vector3(0, 1, 0);
const FEL_CORE = new THREE.Color().setRGB(0.5, 1.5, 0.7);

export class EyeBeam implements Effect {
  readonly group = new THREE.Group();
  readonly settings: EyeBeamSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private fireCarry = 0;
  private moteCarry = 0;

  private caster = createCaster(0x2a3a2a);
  private enemy = new Enemy();
  private eyeL = new GlowSphere(0x3aff5a, { rim: false });
  private eyeR = new GlowSphere(0x3aff5a, { rim: false });
  private flare = new GlowSphere(0x7affa0, { rim: false }); // bright source where the beam leaves the eyes
  private coreMat = new THREE.MeshBasicMaterial({
    color: FEL_CORE, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private midMat = new THREE.MeshBasicMaterial({
    color: 0x2ee858, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private outerMat = new THREE.MeshBasicMaterial({
    color: 0x14a83c, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private ringMat = new THREE.MeshBasicMaterial({
    color: 0x8affb0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private core: THREE.Mesh;
  private mid: THREE.Mesh;
  private outer: THREE.Mesh;
  private rings: THREE.InstancedMesh;
  private scorch: THREE.InstancedMesh; // dark normal-blended burn marks
  private scorchGlow: THREE.InstancedMesh; // fel glow of the fresh burn, cools down
  private scorchGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private hotspot = new GlowSphere(0x3aff5a, { rim: false });
  private light = new THREE.PointLight(0x3aff5a, 0, 14, 2);
  private gather: THREE.Points;
  private gatherDirs: THREE.Vector3[] = [];
  private fire: Emitter;
  private smoke: Emitter;
  private sparks: Emitter;
  private motes: Emitter;
  private dummy = new THREE.Object3D();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private eul = new THREE.Euler();

  constructor(settings: EyeBeamSettings = defaultEyeBeam()) {
    this.settings = settings;

    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
    this.core = new THREE.Mesh(beamGeo, this.coreMat);
    this.mid = new THREE.Mesh(beamGeo, this.midMat);
    this.outer = new THREE.Mesh(beamGeo, this.outerMat);
    for (const m of [this.core, this.mid, this.outer]) { m.visible = false; m.frustumCulled = false; }
    this.rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.03, 6, 40).rotateX(Math.PI / 2), this.ringMat, RING_COUNT);
    this.rings.frustumCulled = false;

    const decalGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
    this.scorch = new THREE.InstancedMesh(
      decalGeo,
      new THREE.MeshBasicMaterial({ color: 0x050805, transparent: true, opacity: 0.55, depthWrite: false }),
      MAX_DECALS,
    );
    this.scorchGlow = new THREE.InstancedMesh(decalGeo, this.scorchGlowMat, MAX_DECALS);
    this.scorchGlow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DECALS * 3), 3);
    this.scorch.frustumCulled = false;
    this.scorchGlow.frustumCulled = false;
    this.scorch.renderOrder = 1;
    this.scorchGlow.renderOrder = 2;

    // Anticipation: fel motes spiral in toward the eyes.
    let seed = 99;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 70; i++) {
      this.gatherDirs.push(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(1.5 + rnd() * 1.5));
    }
    this.gather = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(this.gatherDirs.map(() => new THREE.Vector3())),
      new THREE.PointsMaterial({
        color: 0x5aff80, size: 0.14, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.gather.frustumCulled = false;

    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.scorch, this.scorchGlow);
    this.group.add(this.outer, this.mid, this.core, this.rings);
    this.group.add(this.eyeL.mesh, this.eyeR.mesh, this.flare.mesh, this.hotspot.mesh, this.gather, this.light);

    // Fel fire (bright), dark smoke behind it (normal blended), sparks, and motes shed by the beam.
    this.fire = new Emitter({
      ...defaultSettings(), maxParticles: 1800, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, originY: 0.1, speed: 2.8, speedJitter: 0.6, spread: 35, gravity: -3, drag: 0.8,
      sizeStart: 0.7, sizeEnd: 0.15, colorStart: '#d8ffd0', colorMid: '#3aff5a', colorEnd: '#0a5a20',
      opacityStart: 0.5, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, spin: 0.5, groundFade: 0.15,
    });
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, originY: 0.3, speed: 1.4, speedJitter: 0.5, spread: 30, gravity: -0.8, drag: 0.6,
      sizeStart: 0.7, sizeEnd: 1.9, colorStart: '#1a281a', colorEnd: '#070b07',
      opacityStart: 0.5, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1000, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, originY: 0.1, speed: 7, speedJitter: 0.6, spread: 60, gravity: 10, drag: 0.5,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#eaffd8', colorEnd: '#2ee858', colorMid: '#7affa0',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 1.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 0.9, speedJitter: 0.6, spread: 180, gravity: -0.8, drag: 0.7,
      sizeStart: 0.16, sizeEnd: 0, colorStart: '#d8ffd0', colorEnd: '#1ec84a',
      opacityStart: 0.45, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    this.emitters.push(this.smoke, this.fire, this.sparks, this.motes);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.eyeL.color.set(c);
    this.eyeR.color.set(c);
    this.hotspot.color.set(c);
    this.light.color.set(c);
    this.midMat.color.set(c);
    this.fire.settings.colorMid = c;
    this.fire.applyStyle();
  }

  private get beamStart() {
    return this.settings.chargeTime;
  }

  private get beamEnd() {
    return this.settings.chargeTime + this.settings.sweepTime;
  }

  get duration() {
    return this.beamEnd + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.fireCarry = 0;
    this.moteCarry = 0;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  /** How far back the enemy has been shoved (along -Z) at time t. */
  private pushAt(t: number) {
    const s = this.settings;
    return s.pushBack * smoothstep((t - this.beamStart) / (s.sweepTime + 0.6));
  }

  /** The beam's ground contact point at time t (follows the pushed enemy). */
  private contactAt(t: number, out: THREE.Vector3) {
    const s = this.settings;
    const u = THREE.MathUtils.clamp((t - this.beamStart) / s.sweepTime, 0, 1);
    const a = u * Math.PI * 2;
    return out.set(ENEMY_POS.x + 0.5 * Math.sin(a * 1.5), 0.05, ENEMY_POS.z - this.pushAt(t) + s.sweepWidth * Math.sin(a));
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
    this.layout();
    const active = t > this.beamStart + 0.12 && t < this.beamEnd + 0.15;
    if (active) {
      const p = this.contactAt(t, this.tmpA);
      this.fireCarry += dt * 260;
      const nf = Math.floor(this.fireCarry);
      this.fireCarry -= nf;
      if (nf > 0) {
        this.fire.burst(nf, p);
        this.smoke.burst(Math.ceil(nf * 0.3), p);
        this.sparks.burst(Math.ceil(nf * 0.25), p);
      }
      // Motes peel off random spots along the beam.
      this.moteCarry += dt * 90;
      const nm = Math.floor(this.moteCarry);
      this.moteCarry -= nm;
      for (let i = 0; i < nm; i++) {
        this.tmpB.lerpVectors(BEAM_START, p, 0.1 + Math.random() * 0.9);
        this.tmpB.x += (Math.random() - 0.5) * 0.8;
        this.tmpB.y += (Math.random() - 0.5) * 0.8;
        this.motes.burst(1, this.tmpB);
      }
      this.shake = 0.12;
    } else {
      this.shake = 0;
    }
  }

  private placeBeam(m: THREE.Mesh, dir: THREE.Vector3, length: number, radius: number) {
    m.position.copy(BEAM_START);
    m.quaternion.setFromUnitVectors(UP, dir);
    m.scale.set(radius, Math.max(0.001, length), radius);
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const charge = smoothstep(t / s.chargeTime);
    const bt = t - this.beamStart;
    const beamOn = smoothstep(bt / 0.12) * (1 - smoothstep((t - this.beamEnd) / 0.4));
    const reach = smoothstep(bt / 0.15);
    const flick = 0.85 + 0.15 * Math.sin(t * 55);

    // Eyes flare during the charge and stay hot while channelling.
    const eyeGlow = t < this.beamStart ? charge : Math.max(0.55, beamOn) * (1 - smoothstep((t - this.beamEnd) / 0.6));
    const eyeScale = 0.1 + 0.2 * eyeGlow;
    this.eyeL.mesh.position.set(-0.18, EYE_Y, EYE_Z - 0.04);
    this.eyeR.mesh.position.set(0.18, EYE_Y, EYE_Z - 0.04);
    this.eyeL.mesh.scale.setScalar(eyeScale);
    this.eyeR.mesh.scale.setScalar(eyeScale);
    this.eyeL.opacity = 0.7 * eyeGlow;
    this.eyeR.opacity = 0.7 * eyeGlow;
    this.flare.mesh.position.copy(BEAM_START);
    this.flare.mesh.scale.setScalar(0.5 + 0.2 * Math.sin(t * 40));
    this.flare.opacity = 0.4 * beamOn;

    // Anticipation motes pulled into the eyes.
    const gAttr = this.gather.geometry.getAttribute('position') as THREE.BufferAttribute;
    const pull = smoothstep(t / s.chargeTime);
    for (let i = 0; i < this.gatherDirs.length; i++) {
      const d = this.gatherDirs[i];
      const k = Math.pow(1 - pull, 1.5);
      const ang = pull * 2.5 + i;
      gAttr.setXYZ(
        i, d.x * k * Math.cos(ang * 0.3), EYE_Y + d.y * k, EYE_Z + d.z * k * 0.8 + 0.1 * Math.sin(ang),
      );
    }
    gAttr.needsUpdate = true;
    (this.gather.material as THREE.PointsMaterial).opacity = t < this.beamStart ? 0.7 * Math.min(1, t * 4) : 0;

    // The beam: layered cylinders from the eyes to the (sweeping) ground contact point.
    const contact = this.contactAt(t, this.tmpA);
    const dir = this.tmpB.subVectors(contact, BEAM_START);
    const fullLen = dir.length();
    dir.normalize();
    const len = fullLen * reach;
    const w = s.beamWidth * flick * (0.4 + 0.6 * beamOn);
    const visible = beamOn > 0.01;
    this.core.visible = this.mid.visible = this.outer.visible = this.rings.visible = visible;
    this.coreMat.opacity = 0.7 * beamOn;
    this.midMat.opacity = 0.22 * beamOn;
    this.outerMat.opacity = 0.12 * beamOn;
    this.ringMat.opacity = 0.4 * beamOn;
    if (visible) {
      this.placeBeam(this.core, dir, len, 0.12 * w);
      this.placeBeam(this.mid, dir, len, 0.4 * w);
      this.placeBeam(this.outer, dir, len, 0.8 * w);

      // Spiral rings scroll from the eyes toward the target, wobbling so they read as a helix.
      this.qa.setFromUnitVectors(UP, dir);
      for (let k = 0; k < RING_COUNT; k++) {
        const f = (k / RING_COUNT + t * 1.4) % 1;
        const a = t * 7 + k * 1.7;
        this.eul.set(0.4 * Math.cos(a), 0, 0.4 * Math.sin(a));
        this.qb.setFromEuler(this.eul);
        this.dummy.position.copy(BEAM_START).addScaledVector(dir, len * f);
        this.dummy.quaternion.copy(this.qa).multiply(this.qb);
        this.dummy.scale.setScalar((0.35 + 0.65 * f) * s.beamWidth * 0.8);
        this.dummy.updateMatrix();
        this.rings.setMatrixAt(k, this.dummy.matrix);
      }
      this.rings.instanceMatrix.needsUpdate = true;
    }

    // Ground hot spot + light at the contact point.
    this.hotspot.mesh.position.set(contact.x, 0.4, contact.z);
    this.hotspot.mesh.scale.setScalar(1.3 * flick);
    this.hotspot.opacity = 0.45 * beamOn * reach;
    this.light.position.set(contact.x, 1.4, contact.z);
    this.light.intensity = 22 * beamOn * reach * flick;

    // Scorch trail: a dark mark per step along the sweep, with a fel glow that cools.
    const glowCol = this.tmpC;
    const colAttr = this.scorchGlow.instanceColor!;
    const decals = Math.min(MAX_DECALS, Math.floor(s.sweepTime / DECAL_STEP) + 1);
    const tail = 1 - smoothstep((t - (this.duration - 1.0)) / 1.0);
    const felC = this.light.color;
    for (let k = 0; k < MAX_DECALS; k++) {
      const tk = this.beamStart + 0.12 + k * DECAL_STEP;
      const on = k < decals && t >= tk && tk < this.beamEnd + 0.15;
      if (!on) {
        this.dummy.position.set(0, -50, 0); this.dummy.scale.setScalar(0);
      } else {
        this.contactAt(tk, glowCol);
        this.dummy.position.set(glowCol.x, 0.03, glowCol.z);
        this.dummy.scale.setScalar(0.9 * s.beamWidth * Math.min(1, (t - tk) / 0.15 + 0.3));
      }
      this.dummy.quaternion.identity();
      this.dummy.updateMatrix();
      this.scorch.setMatrixAt(k, this.dummy.matrix);
      this.dummy.position.y = on ? 0.05 : -50;
      this.dummy.scale.multiplyScalar(0.7);
      this.dummy.updateMatrix();
      this.scorchGlow.setMatrixAt(k, this.dummy.matrix);
      const heat = on ? 0.5 * Math.exp(-(t - tk) * 1.6) * tail : 0;
      colAttr.setXYZ(k, felC.r * heat, felC.g * heat, felC.b * heat);
    }
    this.scorch.instanceMatrix.needsUpdate = true;
    this.scorchGlow.instanceMatrix.needsUpdate = true;
    colAttr.needsUpdate = true;
    (this.scorch.material as THREE.MeshBasicMaterial).opacity = 0.55 * tail;

    // Enemy: continuous flash while the beam is on it, shoved slowly back (-Z) and leaning away.
    const push = this.pushAt(t);
    const dz = Math.abs(contact.z - (ENEMY_POS.z - push));
    const onEnemy = beamOn * reach * (1 - smoothstep((dz - 0.4) / 1.3));
    this.enemy.group.position.set(ENEMY_POS.x, 0, ENEMY_POS.z - push);
    this.enemy.group.rotation.set(-0.2 * Math.min(1, push / Math.max(0.01, s.pushBack)), 0, 0);
    const after = Math.max(0, t - this.beamEnd);
    this.enemy.setFlash(0.95 * onEnemy * flick + 0.5 * Math.exp(-after * 5) * (t > this.beamEnd ? 1 : 0));
  }
}

export const eyeBeamModule: EffectModule = {
  label: 'eye beam',
  category: 'iconic',
  create: () => new EyeBeam(),
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    frameArena(camera, controls, new THREE.Vector3(0, 1.5, 7), 11);
  },
  buildGui(f, effect) {
    const e = effect as EyeBeam;
    const s = e.settings;
    f.add(s, 'loop');
    f.add(s, 'beamWidth', 0.3, 2.5, 0.05).name('beam width');
    f.add(s, 'sweepWidth', 0, 5, 0.1).name('sweep width');
    f.add(s, 'sweepTime', 0.8, 3.5, 0.1).name('sweep time');
    f.add(s, 'pushBack', 0, 5, 0.1).name('push back');
    f.add(s, 'chargeTime', 0.3, 2, 0.05).name('charge time');
    f.addColor(s, 'color').onChange(() => e.applyStyle());
  },
};
