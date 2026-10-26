import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../../emitter';
import { GlowSphere, createRing } from '../../../effects/common';
import { BladeTrail, LilyBurst } from '../../../effects/weapons/kit';
import { SOCKETS } from '../../../effects/weapons/sockets';
import { WeaponStrike, strikeModule, IDLE, type Pose } from '../../../effects/weapons/strike';
import { FrostLilySword } from '../frostLilySword';

/**
 * Frost lily thrust: the hero dashes in, coils the Frost-Crystal Sword back at the hip and drives it straight
 * through the target. A frost lily of crystal spikes bursts open on the enemy, a ring of ice spikes erupts from the
 * ground around it (hitting everyone close), frost glitter sprays and a cold ring spreads, then the ice shatters.
 */
const S = SOCKETS['wp-sword-ice'];
const IMPACT = 0.8;
const SPIKES = 9;

export class FrostThrust extends WeaponStrike {
  readonly duration = 2.4;
  readonly impact = IMPACT;
  protected readonly poses: Pose[] = [
    { ...IDLE, t: 0 },
    { t: 0.32, dash: 0.75, crouch: 0.35, lean: 0.15, twist: -0.55, pitch: 1.1, elbow: 1.6, cock: 0.3, side: 0.3, left: 0.9 },
    { t: 0.66, dash: 1, crouch: 0.4, lean: 0.1, twist: -0.75, pitch: 1.0, elbow: 1.9, cock: 0.25, side: 0.35, left: 1.1 },
    { t: IMPACT, dash: 1.05, crouch: 0.65, lean: 0.55, twist: 0.4, pitch: 1.5, elbow: 0.05, cock: -1.9, side: 0.05, left: 0.2 },
    { t: 1.15, dash: 1.05, crouch: 0.6, lean: 0.5, twist: 0.45, pitch: 1.5, elbow: 0.08, cock: -1.9, left: 0.2 },
    { t: 1.65, dash: 1, crouch: 0.3, lean: 0.15, twist: 0.1, pitch: 0.8, elbow: 0.8, cock: 0, left: 0.2 },
    { ...IDLE, t: 2.4, dash: 0 },
  ];

  private trail = new BladeTrail(16, 0.14, ['#ffffff', '#bfeaff', '#2a78d0']);
  private lily = new LilyBurst(0x9fdcff, 0xffffff, { filaments: 30, curl: 0 });
  private flash = new GlowSphere(0x9fdcff, { rim: false });
  private ring = createRing(0xbfeaff, 0.86, 1, 96);
  private spikes: THREE.Mesh[] = [];
  private spikeDir: THREE.Vector3[] = [];
  private spikeMat = new THREE.MeshStandardMaterial({
    color: 0x9fc8e8, emissive: 0x2a6aa8, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1,
    transparent: true, opacity: 0.85, flatShading: true,
  });
  private glitter = this.addEmitter(new Emitter({
    ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5, shape: 'sphere', shapeSize: 0.6,
    speed: 4, speedJitter: 0.7, spread: 75, gravity: 3, drag: 1.6, sizeStart: 0.09, sizeEnd: 0.01, sizeJitter: 0.6,
    colorStart: '#ffffff', colorMid: '#bfeaff', colorEnd: '#2a78d0', opacityStart: 1, opacityEnd: 0, additive: true,
  }));
  private mist = this.addEmitter(new Emitter({
    ...defaultSettings(), maxParticles: 80, rate: 0, lifetime: 1.6, lifetimeJitter: 0.3, shape: 'sphere', shapeSize: 1.2,
    speed: 0.6, speedJitter: 0.5, spread: 90, gravity: -0.1, drag: 1.5, sizeStart: 0.8, sizeEnd: 1.6, sizeJitter: 0.5,
    erosion: 0.5, spin: 0.3, colorStart: '#5a7a9a', colorEnd: '#141e30', opacityStart: 0.45, opacityEnd: 0, additive: false,
  }));
  private hitDone = false;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor() {
    super(new FrostLilySword());
    this.reach = 2.6;
    const geo = new THREE.ConeGeometry(0.22, 1, 6, 1);
    geo.translate(0, 0.5, 0);
    for (let i = 0; i < SPIKES; i++) {
      const m = new THREE.Mesh(geo, this.spikeMat);
      m.visible = false;
      this.spikes.push(m);
      const ang = (i / SPIKES) * Math.PI * 2 + (i % 2) * 0.2;
      this.spikeDir.push(new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)));
      this.group.add(m);
    }
    this.group.add(this.trail.mesh, this.lily.group, this.flash.mesh, this.ring.mesh);
  }

  protected reset() {
    this.hitDone = false;
    this.trail.clear();
    for (const m of this.spikes) m.visible = false;
  }

  protected animate(t: number) {
    const target = this.ctx?.targetPos[0] ?? this.spot;
    if (this.playing && t > IMPACT - 0.12 && t < IMPACT + 0.1) {
      this.trail.push(this.weaponPoint(S.bladeBase, this.a), this.weaponPoint(S.tip, this.b));
    }
    this.trail.update(1 / 60);

    const age = t - IMPACT;
    if (this.playing && !this.hitDone && age >= 0) {
      this.hitDone = true;
      this.hitAround(target, 2.6, { damage: 30 + Math.round(Math.random() * 10), knock: 2.5, color: '#cfefff' });
      this.glitter.burst(90, this.a.copy(target).setY(1.2));
      this.mist.burst(16, this.a.copy(target).setY(0.6));
    }
    const live = this.playing && age >= 0;

    // the frost lily bursts on the enemy
    const bloom = live ? Math.min(1, age / 0.12) : 0;
    const fade = live ? Math.max(0, 1 - Math.max(0, age - 0.25) / 0.5) : 0;
    this.lily.set(this.a.copy(target).setY(1.4), 2.2 * (0.4 + 0.6 * bloom), 0.6 * fade, age * 0.6);
    this.flash.mesh.position.copy(target).setY(1.2);
    this.flash.mesh.scale.setScalar(0.6 + 1.6 * bloom);
    this.flash.opacity = live ? 0.15 * Math.max(0, 1 - age / 0.35) : 0;

    // ice spikes erupt round the target, hold, then sink and shatter
    this.spikes.forEach((m, i) => {
      const d = age - 0.04 * (i % 3);
      const up = live && d > 0 ? Math.min(1, d / 0.1) : 0;
      const down = live && age > 1.0 ? Math.min(1, (age - 1.0) / 0.35) : 0;
      const h = (1.4 + 0.8 * ((i * 7) % 3) / 2) * up * (1 - down);
      m.visible = h > 0.01;
      const r = 1.1 + 0.3 * (i % 2);
      m.position.copy(target).addScaledVector(this.spikeDir[i], r).setY(0);
      m.scale.set(1 - 0.5 * down, Math.max(h, 1e-3), 1 - 0.5 * down);
      m.lookAt(m.position.clone().addScaledVector(this.spikeDir[i], 1).setY(2.2));
      m.rotateX(Math.PI / 2);
    });
    if (live && age > 1.0 && age < 1.05) this.glitter.burst(40, this.a.copy(target).setY(0.6));

    // a cold ring spreads on the ground
    const rr = live ? Math.min(1, age / 0.6) : 0;
    this.ring.mesh.position.copy(target).setY(0.05);
    this.ring.mesh.scale.setScalar(0.5 + 3.5 * rr);
    this.ring.material.opacity = live ? 0.5 * (1 - rr) : 0;
    this.shake = live && age < 0.2 ? 0.3 * (1 - age / 0.2) : 0;
  }
}

export const frostThrustModule = strikeModule('frost lily thrust', () => new FrostThrust(), {
  zone: { kind: 'circle', radius: 2.6 },
});
