import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Divine Shield (reworked): a golden dome of hexagonal panels lights up around the caster in a wave from the
 * ground up. The enemy charges and fires dark red bolts; every impact ripples through the panels, brightens the
 * shell, throws a ripple ring and deflects sparks. Finally the bubble shatters: every panel flies off as a
 * fragment and fades.
 */
export interface DivineShieldSettings {
  bolts: number; // 3..4
  radius: number;
  color: string;
  loop: boolean;
}

export const defaultDivineShield = (): DivineShieldSettings => ({
  bolts: 4,
  radius: 3.2,
  color: '#ffc94a',
  loop: false,
});

const FORM = 1.3; // dome fully lit
const FIRE0 = 1.8; // first bolt leaves
const GAP = 0.5;
const FLIGHT = 0.5;
const PANELS = 130;
const MAX_BOLTS = 4;
// Where on the shell each bolt lands: offsets (sideways, up) from the direction pointing at the enemy.
const HIT_OFFSETS: [number, number][] = [[-0.4, 0.15], [0.35, 0.5], [-0.12, -0.05], [0.55, 0.25]];

interface Panel { dir: THREE.Vector3; quat: THREE.Quaternion; vel: THREE.Vector3; axis: THREE.Vector3; spin: number }

export class DivineShield implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DivineShieldSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private hitIdx = 0;
  private shattered = false;
  private trailAcc = 0;

  private caster = createCaster();
  private enemy = new Enemy();
  private shell = new GlowSphere(0xffd27a);
  private charge = new GlowSphere(0xff3a22, { rim: false });
  private groundRune = createRing(0xffc94a, 0.9, 0.95, 6);
  private groundRune2 = createRing(0xffc94a, 0.97, 1, 64);
  private ripples = Array.from({ length: MAX_BOLTS }, () => createRing(0xffe2a0, 0.85, 1, 64));
  private boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.15, 0.1) });
  private bolts = Array.from({ length: MAX_BOLTS }, () => new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), this.boltMat));
  private panelOutMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide,
  });
  private panelFillMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide,
  });
  private panelOut: THREE.InstancedMesh;
  private panelFill: THREE.InstancedMesh;
  private panels: Panel[] = [];
  private hitDirs: THREE.Vector3[] = [];
  private sparks: Emitter;
  private trail: Emitter;
  private debris: Emitter;

  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();
  private tmpQ = new THREE.Quaternion();

  constructor(settings: DivineShieldSettings = defaultDivineShield()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.shell.mesh, this.charge.mesh, this.groundRune.mesh, this.groundRune2.mesh);
    for (const r of this.ripples) this.group.add(r.mesh);
    for (const b of this.bolts) { b.visible = false; this.group.add(b); }

    // Panels on a Fibonacci sphere, each facing outward.
    const z = new THREE.Vector3(0, 0, 1);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < PANELS; i++) {
      const y = 1 - (2 * (i + 0.5)) / PANELS;
      const r = Math.sqrt(1 - y * y);
      const dir = new THREE.Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r);
      const quat = new THREE.Quaternion().setFromUnitVectors(z, dir);
      quat.multiply(new THREE.Quaternion().setFromAxisAngle(z, Math.random() * Math.PI / 3));
      const vel = dir.clone().multiplyScalar(2.5 + Math.random() * 4);
      vel.y += 1 + Math.random() * 2;
      this.panels.push({
        dir, quat, vel, axis: new THREE.Vector3().randomDirection(), spin: (Math.random() - 0.5) * 10,
      });
    }
    const hexOut = new THREE.RingGeometry(0.8, 1, 6);
    const hexFill = new THREE.CircleGeometry(0.8, 6);
    this.panelOut = new THREE.InstancedMesh(hexOut, this.panelOutMat, PANELS);
    this.panelFill = new THREE.InstancedMesh(hexFill, this.panelFillMat, PANELS);
    for (const m of [this.panelOut, this.panelFill]) {
      m.frustumCulled = false;
      for (let i = 0; i < PANELS; i++) m.setColorAt(i, this.tmpColor.setRGB(0, 0, 0));
      this.group.add(m);
    }

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.2, speed: 7, speedJitter: 0.6, spread: 130, gravity: 7, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#fff0c0', colorEnd: '#ff8a2a',
      opacityStart: 0.85, opacityEnd: 0, additive: true,
    });
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 0.35, lifetimeJitter: 0.3,
      shape: 'point', speed: 0.3, speedJitter: 0.5, spread: 180, gravity: 0, drag: 1,
      sizeStart: 0.32, sizeEnd: 0.02, colorStart: '#ff4a2a', colorEnd: '#5a0505',
      opacityStart: 0.5, opacityEnd: 0, additive: true,
    });
    this.debris = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.2, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 2.8, speed: 4, speedJitter: 0.6, spread: 180, gravity: 3, drag: 0.8,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: settings.color,
      opacityStart: 0.7, opacityEnd: 0, additive: true,
    });
    this.emitters.push(this.sparks, this.trail, this.debris);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.shell.color.set(c);
    this.groundRune.material.color.set(c);
    this.groundRune2.material.color.set(c);
    this.debris.settings.colorEnd = c;
    this.debris.applyStyle();
  }

  private get nBolts() {
    return Math.max(3, Math.min(MAX_BOLTS, Math.round(this.settings.bolts)));
  }

  private fireTime(k: number) { return FIRE0 + k * GAP; }
  private hitTime(k: number) { return this.fireTime(k) + FLIGHT; }
  private get shatterTime() { return this.hitTime(this.nBolts - 1) + 0.7; }

  get duration() {
    return this.shatterTime + 1.2;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private center() {
    return new THREE.Vector3(CASTER_POS.x, 1.2, CASTER_POS.z);
  }

  /** Impact point and outward normal of bolt k on the shell. */
  private hitDir(k: number) {
    const [sx, sy] = HIT_OFFSETS[k];
    return new THREE.Vector3(sx, sy, -1).normalize();
  }

  private reset() {
    this.time = 0;
    this.hitIdx = 0;
    this.shattered = false;
    this.trailAcc = 0;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    this.hitDirs = Array.from({ length: MAX_BOLTS }, (_, k) => this.hitDir(k));
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
    const R = this.settings.radius;
    const c = this.center();
    // Impacts: deflected sparks and a small camera kick.
    while (this.hitIdx < this.nBolts && this.time >= this.hitTime(this.hitIdx)) {
      const p = c.clone().addScaledVector(this.hitDirs[this.hitIdx], R);
      this.sparks.burst(110, p);
      this.shake = 0.3;
      this.hitIdx++;
    }
    if (!this.shattered && this.time >= this.shatterTime) {
      this.shattered = true;
      this.debris.burst(500, c);
      this.sparks.burst(300, c);
      this.shake = 0.6;
    }
    // Short dark red trails behind bolts in flight.
    this.trailAcc += 90 * dt;
    while (this.trailAcc >= 1) {
      this.trailAcc -= 1;
      for (let k = 0; k < this.nBolts; k++) {
        const e = (this.time - this.fireTime(k)) / FLIGHT;
        if (e >= 0 && e < 1) this.trail.burst(1, this.boltPos(k, e));
      }
    }
    this.shake *= Math.exp(-dt * 8);
    this.layout();
  }

  private boltPos(k: number, e: number) {
    const start = new THREE.Vector3(0, 1.5, 0.6);
    const end = this.center().addScaledVector(this.hitDirs[k], this.settings.radius);
    const p = start.lerp(end, e);
    p.y += Math.sin(Math.PI * e) * 0.8;
    return p;
  }

  private layout() {
    const s = this.settings;
    const R = s.radius;
    const t = this.time;
    const c = this.center();
    const nb = this.nBolts;
    const shatterAt = this.shatterTime;
    const st = t - shatterAt; // < 0 while the bubble is intact
    const intact = st < 0;

    // Dome growth and wave.
    const form = smoothstep(t / 0.7);
    const domeR = R * (0.4 + 0.6 * form);

    // Hit ripples: for each hit, angular distance of every panel to the impact drives a travelling flash.
    let hitGlow = 0;
    const active: { dir: THREE.Vector3; age: number }[] = [];
    for (let k = 0; k < nb; k++) {
      const age = t - this.hitTime(k);
      if (age >= 0) {
        active.push({ dir: this.hitDirs[k], age });
        hitGlow += Math.exp(-age * 5);
      }
    }

    const d = this.dummy;
    const fragT = Math.max(0, st);
    const fragFade = 1 - smoothstep(fragT / 1.1);
    for (let i = 0; i < PANELS; i++) {
      const p = this.panels[i];
      // Lights up in a wave from the ground to the crown.
      const delay = (1 - p.dir.y) * 0.5 * (FORM - 0.45);
      let b = smoothstep((t - 0.15 - delay) / 0.45) * (0.4 + 0.1 * Math.sin(t * 3 + i));
      for (const h of active) {
        const ang = Math.acos(Math.max(-1, Math.min(1, p.dir.dot(h.dir))));
        b += 1.1 * Math.exp(-Math.pow((ang - h.age * 4.5) / 0.28, 2)) * Math.exp(-h.age * 2.2);
        b += 1.4 * Math.exp(-ang * ang / 0.05) * Math.exp(-h.age * 6);
      }
      if (intact) {
        d.position.copy(p.dir).multiplyScalar(domeR * 1.01).add(c);
        d.quaternion.copy(p.quat);
        d.scale.setScalar(R * 0.155 * (0.55 + 0.45 * form));
      } else {
        // Fragment: flies outward, tumbles, falls and shrinks.
        d.position.copy(p.dir).multiplyScalar(R * 1.01).add(c).addScaledVector(p.vel, fragT);
        d.position.y -= 3 * fragT * fragT;
        this.tmpQ.setFromAxisAngle(p.axis, p.spin * fragT);
        d.quaternion.copy(this.tmpQ).multiply(p.quat);
        d.scale.setScalar(R * 0.155 * (1 - 0.5 * smoothstep(fragT / 1.2)));
        b = (0.8 + 0.4 * (i % 3) / 2) * fragFade;
      }
      d.updateMatrix();
      this.panelOut.setMatrixAt(i, d.matrix);
      this.panelFill.setMatrixAt(i, d.matrix);
      const bo = Math.min(1.8, b);
      this.panelOut.setColorAt(i, this.tmpColor.setRGB(1.3 * bo, 0.95 * bo, 0.35 * bo));
      this.panelFill.setColorAt(i, this.tmpColor.setRGB(1.1 * bo * 0.3, 0.8 * bo * 0.3, 0.3 * bo * 0.3));
    }
    this.panelOut.instanceMatrix.needsUpdate = true;
    this.panelFill.instanceMatrix.needsUpdate = true;
    if (this.panelOut.instanceColor) this.panelOut.instanceColor.needsUpdate = true;
    if (this.panelFill.instanceColor) this.panelFill.instanceColor.needsUpdate = true;

    // Shell: brightens with each hit; flashes and blows outward when it shatters.
    this.shell.mesh.position.copy(c);
    if (intact) {
      this.shell.mesh.scale.setScalar(domeR);
      this.shell.opacity = Math.min(0.75, (0.22 + 0.12 * Math.sin(t * 4) + 0.2 * hitGlow) * form);
    } else {
      this.shell.mesh.scale.setScalar(R * (1 + st * 1.2));
      this.shell.opacity = 0.7 * Math.exp(-st * 6);
    }

    // Ground runes under the caster.
    const rune = smoothstep((t - 0.1) / 0.8) * (intact ? 1 : Math.exp(-st * 3));
    this.groundRune.mesh.position.set(c.x, 0.05, c.z);
    this.groundRune.mesh.scale.setScalar(R * 0.95);
    this.groundRune.mesh.rotation.z = t * 0.6;
    this.groundRune.material.opacity = 0.55 * rune;
    this.groundRune2.mesh.position.set(c.x, 0.05, c.z);
    this.groundRune2.mesh.scale.setScalar(R * 1.1);
    this.groundRune2.material.opacity = 0.4 * rune;

    // Bolts and the enemy's charge-up.
    let kick = 0;
    for (let k = 0; k < MAX_BOLTS; k++) {
      const bolt = this.bolts[k];
      const ripple = this.ripples[k];
      ripple.material.opacity = 0;
      bolt.visible = false;
      if (k >= nb) continue;
      const e = (t - this.fireTime(k)) / FLIGHT;
      if (e >= 0 && e < 1) {
        bolt.visible = true;
        const pos = this.boltPos(k, e);
        bolt.position.copy(pos);
        bolt.lookAt(this.boltPos(k, Math.min(1, e + 0.05)));
        bolt.scale.set(1, 1, 2.2);
      }
      if (e >= 0) kick += Math.exp(-e * FLIGHT * 9);
      const age = t - this.hitTime(k);
      if (age >= 0 && age < 0.6) {
        const q = age / 0.6;
        ripple.mesh.position.copy(c).addScaledVector(this.hitDirs[k], R * 1.02);
        ripple.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.hitDirs[k]);
        ripple.mesh.scale.setScalar(0.3 + 1.9 * q);
        ripple.material.opacity = 0.7 * (1 - q) * (intact ? 1 : 0);
      }
    }
    this.enemy.group.position.z = -0.35 * kick;
    const chargeIn = smoothstep((t - 1.1) / 0.7);
    const chargeOut = 1 - smoothstep((t - (this.fireTime(nb - 1) + 0.3)) / 0.5);
    this.charge.mesh.position.set(0, 1.5, 0.4);
    this.charge.mesh.scale.setScalar(0.45 + 0.35 * chargeIn + 0.2 * kick);
    this.charge.opacity = 0.55 * chargeIn * chargeOut;
  }
}

export const divineShieldModule: EffectModule = {
  label: 'divine shield',
  category: 'paladin',
  create: () => new DivineShield(),
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Caster at z = 14 with the dome, enemy at the origin.
    frameArena(camera, controls, new THREE.Vector3(0, 2.5, 9), 10.5);
  },
  buildGui(f, effect) {
    const d = effect as DivineShield;
    const s = d.settings;
    f.add(s, 'loop');
    f.add(s, 'bolts', 3, 4, 1);
    f.add(s, 'radius', 2, 6, 0.1);
    f.addColor(s, 'color').onChange(() => d.applyStyle());
  },
};
