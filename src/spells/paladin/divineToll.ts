import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Divine Toll (reworked): a giant translucent golden bell materialises above the caster, swings once and tolls.
 * Visible sound rings expand from it while five beams of light shoot from the caster into the five enemies in
 * front, each of which flashes and gets a judgement mark above its head. Ring pulses linger afterwards.
 */
export interface DivineTollSettings {
  bellSize: number;
  color: string;
  loop: boolean;
}

export const defaultDivineToll = (): DivineTollSettings => ({
  bellSize: 1.6,
  color: '#ffcf6a',
  loop: false,
});

const TOLL = 1.4; // the bell strikes
const BEAMS = TOLL + 0.1;
const DURATION = 4.8;
const PULSES = [TOLL, TOLL + 0.22, TOLL + 0.44, 2.7, 3.4]; // sound ring start times
const PIVOT = new THREE.Vector3(0, 9.5, 14);
const BEAM_START = new THREE.Vector3(0, 2.4, 13.2);
const BELL_HEIGHT = 2.35;

// Five enemies in an arc: ends nearer the caster, middle furthest (x is the depth axis seen by the camera).
const TARGETS = [-8, -4, 0, 4, 8].map((x) => new THREE.Vector3(x, 0, 2 - 4 * (1 - (x / 8) ** 2)));

const UP = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();

/** Stretches a unit cylinder (height 1 along Y) from `a` toward `b`; `grow` 0..1 is how far it has shot out. */
function placeBeam(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, grow: number, width: number) {
  tmpDir.subVectors(b, a);
  const len = tmpDir.length();
  tmpDir.normalize();
  mesh.quaternion.setFromUnitVectors(UP, tmpDir);
  mesh.position.copy(a).addScaledVector(tmpDir, (len * grow) / 2);
  mesh.scale.set(width, Math.max(0.001, len * grow), width);
}

function createBell() {
  const pts = [
    [1.65, -0.12], [1.55, 0], [1.4, 0.3], [1.05, 0.95], [0.82, 1.55], [0.58, 1.95], [0.25, 2.25], [0, 2.35],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 40).translate(0, -BELL_HEIGHT, 0); // top at the pivot
}

export class DivineToll implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DivineTollSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private hit: boolean[] = TARGETS.map(() => false);

  private caster = createCaster();
  private enemies = TARGETS.map((p) => new Enemy().setHome(p));
  private handGlow = new GlowSphere(0xffe2a0, { rim: false });
  private bellPivot = new THREE.Group();
  private bellMat = new THREE.MeshStandardMaterial({
    color: 0xd9a23a, metalness: 0.5, roughness: 0.4, emissive: 0xffb840, emissiveIntensity: 0.6,
    transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
  });
  private bell = new THREE.Mesh(createBell(), this.bellMat);
  private clapper = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), this.bellMat);
  private bellGlow = new GlowSphere(0xffd27a);
  private groundRings = PULSES.map(() => createRing(0xffd27a, 0.92, 1, 96));
  private soundRings = PULSES.map(() => createRing(0xffe2a0, 0.94, 1, 96));
  private coreMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.8, 1.5, 0.7), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private haloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.5, 1.0, 0.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
  private cores = TARGETS.map(() => new THREE.Mesh(this.beamGeo, this.coreMat));
  private halos = TARGETS.map(() => new THREE.Mesh(this.beamGeo, this.haloMat));
  private marks = TARGETS.map(() => createRing(0xffe2a0, 0.7, 0.8, 4));
  private sparks: Emitter;
  private motes: Emitter;
  private dust: Emitter;

  constructor(settings: DivineTollSettings = defaultDivineToll()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.handGlow.mesh, this.bellPivot, this.bellGlow.mesh);
    for (const e of this.enemies) this.group.add(e.group);
    this.bellPivot.position.copy(PIVOT);
    this.bell.add(this.clapper);
    this.clapper.position.y = BELL_HEIGHT - 0.2;
    this.bellPivot.add(this.bell);
    for (const r of this.groundRings) this.group.add(r.mesh);
    for (const r of this.soundRings) {
      r.mesh.rotation.set(0, Math.PI / 2, 0); // upright, facing the camera side
      this.group.add(r.mesh);
    }
    for (const m of [...this.cores, ...this.halos]) { m.visible = false; this.group.add(m); }
    for (const m of this.marks) {
      m.mesh.rotation.set(0, Math.PI / 2, 0);
      this.group.add(m.mesh);
    }

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 7, speedJitter: 0.6, spread: 180, gravity: 8, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 2.0, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 0.9, speed: 1.6, speedJitter: 0.5, spread: 25, gravity: -0.6, drag: 0.6,
      sizeStart: 0.18, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: settings.color,
      opacityStart: 0.4, opacityEnd: 0, additive: true,
      colorMid: '#ffd98a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    // Dark dust kicked up under each beam hit (normal blending) for contrast behind the bright layers.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 2.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, originY: 0.3, speed: 2.2, speedJitter: 0.5, spread: 70, gravity: -0.3, drag: 1,
      sizeStart: 0.7, sizeEnd: 1.8, colorStart: '#6a5a44', colorEnd: '#2a241d',
      opacityStart: 0.3, opacityEnd: 0, additive: false,
      colorMid: '#4a3f31', sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
    });
    // Dust (normal blending) first so the additive layers draw over it.
    this.emitters.push(this.dust, this.sparks, this.motes);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.bellMat.emissive.set(c);
    this.bellGlow.color.set(c);
    for (const r of this.groundRings) r.material.color.set(c);
    this.motes.settings.colorEnd = c;
    this.motes.applyStyle();
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
    this.hit = TARGETS.map(() => false);
    this.shake = 0;
    this.caster.reset();
    for (const e of this.enemies) e.reset();
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
    if (this.time >= BEAMS) {
      for (let i = 0; i < TARGETS.length; i++) {
        if (!this.hit[i] && this.time >= BEAMS + 0.12) this.onHit(i);
      }
    }
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const fade = 1 - smoothstep((t - (DURATION - 0.8)) / 0.8);
    const sinceToll = t - TOLL;

    // Caster raises a hand as the bell forms; the hand flares when the beams leave.
    const cast = smoothstep(t / TOLL);
    const sinceBeam = t - BEAMS;
    this.handGlow.mesh.position.set(0, 2.4 + 0.3 * cast, 13.2);
    this.handGlow.mesh.scale.setScalar(0.15 + 0.35 * cast);
    this.handGlow.opacity = (sinceBeam < 0 ? 0.5 * cast : 0.5 * Math.exp(-sinceBeam * 3)) * fade;

    // Bell: slides down and fades in, swings back (anticipation), then tolls and rings down.
    const appear = smoothstep(t / 0.9);
    let angle = 0;
    const u = t - 0.9;
    if (u > 0 && u < 0.5) angle = 0.55 * smoothstep(u / 0.5);
    else if (u >= 0.5) angle = 0.55 * Math.cos((u - 0.5) * 7) * Math.exp(-(u - 0.5) * 2.2);
    this.bellPivot.position.set(PIVOT.x, PIVOT.y + 3 * (1 - appear), PIVOT.z);
    this.bellPivot.rotation.set(angle, 0, 0); // swings along Z, visible from the camera side
    this.bellPivot.scale.setScalar(s.bellSize);
    const flare = sinceToll > 0 ? Math.exp(-sinceToll * 3.5) : 0;
    this.bellMat.opacity = 0.55 * appear * fade;
    this.bellMat.emissiveIntensity = 0.6 + 1.6 * flare;
    this.bellPivot.visible = this.bellMat.opacity > 0.01;
    this.bellGlow.mesh.position.set(PIVOT.x, PIVOT.y + 3 * (1 - appear) - BELL_HEIGHT * s.bellSize * 0.5, PIVOT.z);
    this.bellGlow.mesh.scale.setScalar(2.2 * s.bellSize);
    this.bellGlow.opacity = (0.12 * appear + 0.3 * flare) * fade;

    // Sound rings: vertical rings from the bell, ground rings beneath it.
    const bellMid = PIVOT.y - BELL_HEIGHT * s.bellSize * 0.5;
    PULSES.forEach((ts, i) => {
      const age = t - ts;
      const late = i >= 3;
      const live = age > 0 && age < 2.0;
      const k = live ? 1 - age / 2.0 : 0;
      const g = this.groundRings[i];
      g.mesh.position.set(PIVOT.x, 0.05, PIVOT.z);
      g.mesh.scale.setScalar(1.5 + Math.max(0, age) * 8);
      g.material.opacity = (late ? 0.3 : 0.45) * k * fade;
      const v = this.soundRings[i];
      v.mesh.position.set(PIVOT.x, bellMid, PIVOT.z);
      v.mesh.scale.setScalar(1.5 + Math.max(0, age) * 7);
      v.material.opacity = (late ? 0.2 : 0.35) * k * k * fade;
    });
    if (sinceToll > 0) this.shake = Math.max(this.shake, 0.4 * Math.exp(-sinceToll * 6));
    else this.shake = 0;

    // Beams shoot from the caster to every enemy at once, flare, then thin out.
    const bAge = t - BEAMS;
    const grow = smoothstep(bAge / 0.12);
    const beamK = bAge < 0 ? 0 : Math.exp(-Math.max(0, bAge - 0.15) * 3.2);
    this.coreMat.opacity = 0.5 * beamK * fade;
    this.haloMat.opacity = 0.16 * beamK * fade;
    const thin = 1 - 0.7 * smoothstep(bAge / 0.9);
    const aim = new THREE.Vector3();
    TARGETS.forEach((p, i) => {
      aim.set(p.x, 1.4, p.z);
      placeBeam(this.cores[i], BEAM_START, aim, grow, 0.1 * thin);
      placeBeam(this.halos[i], BEAM_START, aim, grow, 0.32 * thin);
      this.cores[i].visible = this.halos[i].visible = this.coreMat.opacity > 0.002;
    });

    // Enemies: flash and stagger on the hit, judgement mark above the head.
    TARGETS.forEach((p, i) => {
      const after = t - (BEAMS + 0.12);
      const e = this.enemies[i];
      if (after > 0) {
        e.setFlash(1.2 * Math.exp(-after * 4));
        e.group.scale.set(1, 1 - 0.2 * smoothstep(after / 0.1) * Math.exp(-after * 1.5), 1);
      }
      const sig = after > 0 ? smoothstep((after - 0.1) / 0.3) * fade : 0;
      const m = this.marks[i];
      m.mesh.position.set(p.x, 3.3 + 0.15 * Math.sin(t * 3 + i), p.z);
      m.mesh.rotation.set(0, Math.PI / 2, t * 0.8);
      m.mesh.scale.setScalar(0.5);
      m.material.opacity = 0.7 * sig;
    });
  }

  private onHit(i: number) {
    this.hit[i] = true;
    const p = TARGETS[i];
    this.sparks.burst(180, new THREE.Vector3(p.x, 1.3, p.z));
    this.motes.burst(70, new THREE.Vector3(p.x, 0.2, p.z));
    this.dust.burst(40, new THREE.Vector3(p.x, 0, p.z));
  }
}

export const divineTollModule: EffectModule = {
  label: 'divine toll',
  category: 'paladin',
  create: () => new DivineToll(),
  telegraphs: () => TARGETS.map((p) => ({
    shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 2 },
    start: 0.4,
    impact: BEAMS + 0.12,
  })),
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Caster and bell at z = 14 (bell up to ~y 10), enemy arc around z = -2..2.
    // Centre toward the caster so the bell above it stays in frame.
    frameArena(camera, controls, new THREE.Vector3(0, 4.5, 10), 13);
  },
  buildGui(f, effect) {
    const d = effect as DivineToll;
    const s = d.settings;
    f.add(s, 'loop');
    f.add(s, 'bellSize', 0.8, 3, 0.05).name('bell size');
    f.addColor(s, 'color').onChange(() => d.applyStyle());
  },
};
