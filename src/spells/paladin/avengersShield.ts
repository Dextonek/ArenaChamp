import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, createShieldGeometry,
  frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Avenger's Shield (reworked): a spinning shield of light is thrown, ricochets through three enemies (each hit
 * flashes, sparks, rings and leaves a silence mark spinning over the head), then returns to the caster's hand.
 */
export interface AvengersShieldSettings {
  shieldSize: number;
  speed: number; // units per second in flight
  windup: number; // seconds before the throw
  color: string;
  loop: boolean;
}

export const defaultAvengersShield = (): AvengersShieldSettings => ({
  shieldSize: 1.8,
  speed: 28,
  windup: 0.6,
  color: '#ffcf6a',
  loop: false,
});

const AFTERMATH = 1.5;
const TARGET_HOMES = [ENEMY_POS.clone(), new THREE.Vector3(-5, 0, -4), new THREE.Vector3(5, 0, -6)];
const CHEST = 1.3;
const HAND = new THREE.Vector3(0.45, 2.4, -0.3).add(CASTER_POS);

export class AvengersShield implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AvengersShieldSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private hits = 0;
  private pos = new THREE.Vector3();
  private flying = false;

  private caster = createCaster();
  private enemies = TARGET_HOMES.map((h) => new Enemy().setHome(h));
  private handGlow = new GlowSphere(0xffe2a0, { rim: false });
  private shieldMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24e, metalness: 0.6, roughness: 0.35, emissive: 0xffc24a, emissiveIntensity: 0.7,
    transparent: true,
  });
  private shieldMesh = new THREE.Mesh(createShieldGeometry(), this.shieldMat); // spins about its axis
  private shieldTilt = new THREE.Group(); // turns the shield's +Z face toward the camera side (+X)
  private shieldRoot = new THREE.Group();
  private shieldGlow = new GlowSphere(0xffd27a);
  private flashes = TARGET_HOMES.map(() => new GlowSphere(0xffd27a));
  private hitRings = TARGET_HOMES.map(() => createRing(0xffe2a0, 0.85, 1, 64));
  private markRings = TARGET_HOMES.map(() => createRing(0xffd27a, 0.78, 0.92, 48));
  private markDiamonds = TARGET_HOMES.map(() => createRing(0xffe2a0, 0.5, 0.58, 4));
  private sparks: Emitter;
  private trail: Emitter;
  private dust: Emitter;

  constructor(settings: AvengersShieldSettings = defaultAvengersShield()) {
    this.settings = settings;
    this.shieldTilt.rotation.y = Math.PI / 2;
    this.shieldTilt.add(this.shieldMesh);
    this.shieldRoot.add(this.shieldTilt);
    this.group.add(createGround(), this.caster.group, this.handGlow.mesh, this.shieldRoot, this.shieldGlow.mesh);
    for (const e of this.enemies) this.group.add(e.group);
    for (let i = 0; i < TARGET_HOMES.length; i++) {
      this.hitRings[i].mesh.rotation.set(0, Math.PI / 2, 0); // upright, facing the camera side
      this.markDiamonds[i].mesh.rotation.set(0, 0, 0);
      this.group.add(this.flashes[i].mesh, this.hitRings[i].mesh, this.markRings[i].mesh, this.markDiamonds[i].mesh);
    }

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 9, speedJitter: 0.6, spread: 180, gravity: 9, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 2400, rate: 0, lifetime: 0.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.25, speed: 0.8, speedJitter: 0.6, spread: 180, gravity: 0, drag: 1.2,
      sizeStart: 0.24, sizeEnd: 0.02, colorStart: '#fff2c4', colorEnd: settings.color,
      colorMid: '#ffd77a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
      opacityStart: 0.45, opacityEnd: 0, additive: true,
    });
    // Dark dust kicked up under each hit, behind the bright sparks.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.8, speed: 3, speedJitter: 0.5, spread: 80, gravity: -0.3, drag: 1.2,
      sizeStart: 0.5, sizeEnd: 1.2, colorStart: '#8a7656', colorMid: '#5a4a34', colorEnd: '#2a2218',
      sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
      opacityStart: 0.28, opacityEnd: 0, additive: false,
    });
    this.emitters.push(this.dust, this.sparks, this.trail);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.shieldMat.emissive.set(c);
    this.shieldGlow.color.set(c);
    for (const m of this.markRings) m.material.color.set(c);
    this.trail.settings.colorEnd = c;
    this.trail.applyStyle();
  }

  /** Waypoints (hand, three targets, hand) and the time the shield reaches each. */
  private route() {
    const s = this.settings;
    const pts = [HAND, ...TARGET_HOMES.map((h) => new THREE.Vector3(h.x, CHEST, h.z)), HAND];
    const starts = [s.windup];
    for (let i = 0; i < pts.length - 1; i++) starts.push(starts[i] + pts[i].distanceTo(pts[i + 1]) / s.speed);
    return { pts, starts };
  }

  /** Times (seconds after play) the shield reaches each of the three targets, for the danger zones. */
  hitTimes() {
    return this.route().starts.slice(1, 4);
  }

  get duration() {
    const { starts } = this.route();
    return starts[starts.length - 1] + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hits = 0;
    this.flying = false;
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
    const { pts, starts } = this.route();
    this.layout();
    if (this.flying) this.trail.burst(Math.ceil(dt * 1000), this.pos);
    while (this.hits < 3 && this.time >= starts[this.hits + 1]) {
      const p = pts[this.hits + 1];
      this.sparks.burst(450, p);
      this.dust.burst(90, new THREE.Vector3(p.x, 0.2, p.z));
      this.shake = 0.35;
      this.hits++;
    }
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const { pts, starts } = this.route();
    const end = starts[starts.length - 1];
    const fade = 1 - smoothstep((t - (this.duration - 0.7)) / 0.7);

    // Shield position: held at the hand, then through the waypoints with a slight lift on each leg.
    const cast = smoothstep(t / s.windup);
    this.flying = false;
    if (t < starts[0]) {
      this.pos.copy(HAND);
    } else if (t >= end) {
      this.pos.copy(HAND);
    } else {
      let i = 0;
      while (i < 3 && t >= starts[i + 1]) i++;
      const f = (t - starts[i]) / (starts[i + 1] - starts[i]);
      this.pos.lerpVectors(pts[i], pts[i + 1], f);
      this.pos.y += Math.sin(Math.PI * f) * (i === 3 ? 2.6 : 1.1);
      this.flying = true;
    }
    const caught = t >= end;
    const held = t < starts[0] || caught;
    this.handGlow.mesh.position.copy(HAND);
    this.handGlow.mesh.scale.setScalar(0.15 + 0.35 * cast);
    this.handGlow.opacity = held ? 0.5 * cast * (caught ? Math.exp(-(t - end) * 3) : 1) : 0.1;

    this.shieldRoot.position.copy(this.pos);
    this.shieldRoot.scale.setScalar(s.shieldSize * (held ? 0.5 + 0.5 * cast : 1));
    this.shieldMesh.rotation.z = t * 38;
    this.shieldMat.opacity = Math.max(0.001, cast * (caught ? fade : 1));
    this.shieldMat.emissiveIntensity = 0.6 + (this.flying ? 0.3 : 0);
    this.shieldRoot.visible = this.shieldMat.opacity > 0.01;
    this.shieldGlow.mesh.position.copy(this.pos);
    this.shieldGlow.mesh.scale.setScalar(s.shieldSize * 0.75);
    this.shieldGlow.opacity = (this.flying ? 0.3 : 0.15 * cast) * (caught ? fade : 1);

    // Per target: hit flash, ring of light, and the silence mark spinning over the head.
    for (let i = 0; i < 3; i++) {
      const home = TARGET_HOMES[i];
      const hitT = starts[i + 1];
      const age = t - hitT;
      const hit = t >= hitT;
      const a = hit ? age : 0;
      const e = this.enemies[i];
      e.setFlash(hit ? 1.2 * Math.exp(-a * 5) : 0);
      this.flashes[i].mesh.position.set(home.x, CHEST, home.z);
      this.flashes[i].mesh.scale.setScalar(0.8 + a * 7);
      this.flashes[i].opacity = hit ? 0.6 * Math.exp(-a * 8) : 0;
      this.hitRings[i].mesh.position.set(home.x, CHEST, home.z);
      this.hitRings[i].mesh.scale.setScalar(0.6 + a * 10);
      this.hitRings[i].material.opacity = hit ? Math.max(0, 0.8 * (1 - a / 0.5)) : 0;

      const m = hit ? smoothstep((a - 0.1) / 0.3) * fade : 0;
      const my = 3.2 + 0.12 * Math.sin(t * 3 + i);
      this.markRings[i].mesh.position.set(home.x, my, home.z);
      this.markRings[i].mesh.scale.setScalar(0.75);
      this.markRings[i].mesh.rotation.set(-Math.PI / 2, 0, t * 2.2);
      this.markRings[i].material.opacity = 0.65 * m;
      this.markDiamonds[i].mesh.position.set(home.x, my, home.z);
      this.markDiamonds[i].mesh.scale.setScalar(0.8);
      this.markDiamonds[i].mesh.rotation.set(-Math.PI / 2, 0, -t * 3.2);
      this.markDiamonds[i].material.opacity = 0.6 * m;
    }
    if (t >= starts[1]) this.shake *= 0.95;
  }
}

export const avengersShieldModule: EffectModule = {
  label: "avenger's shield",
  category: 'paladin',
  create: () => new AvengersShield(),
  telegraphs(effect) {
    const hits = (effect as AvengersShield).hitTimes();
    // A small zone under each enemy, filling up until the shield reaches it.
    return TARGET_HOMES.map((h, i) => ({
      shape: { kind: 'circle' as const, x: h.x, z: h.z, radius: 2.2 },
      start: Math.max(0, hits[i] - 0.7), impact: hits[i],
    }));
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Caster at z = 14, targets at z = 0, -4, -6, x within +-5.
    frameArena(camera, controls, new THREE.Vector3(0, 2, 4), 13);
  },
  buildGui(f, effect) {
    const a = effect as AvengersShield;
    const s = a.settings;
    f.add(s, 'loop');
    f.add(s, 'shieldSize', 0.5, 5, 0.1).name('shield size');
    f.add(s, 'speed', 10, 60, 1);
    f.add(s, 'windup', 0.1, 2, 0.05);
    f.addColor(s, 'color').onChange(() => a.applyStyle());
  },
};
