import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../../emitter';
import { GlowSphere, createRing } from '../../../effects/common';
import { LightningArc, StarBurst } from '../../../effects/parts';
import { BladeTrail } from '../../../effects/weapons/kit';
import { WeaponStrike, strikeModule, IDLE, type Pose } from '../../../effects/weapons/strike';
import { ThunderDrumHammer } from '../thunderDrumHammer';

/**
 * Thunder drum slam: the hero runs in, leaps with the Thunder-Drum Hammer swung up over the head, and brings it
 * down on the target. At the impact three bolts crash out of the sky onto the spot, a violet star bursts, a
 * shockwave ring races out over the ground, sparks and dark dust fly, and everything inside the ring is hit.
 */
const IMPACT = 0.92;
const RADIUS = 3.2;
const BOLTS = 4;

export class ThunderSlam extends WeaponStrike {
  readonly duration = 2.5;
  readonly impact = IMPACT;
  protected readonly poses: Pose[] = [
    { ...IDLE, t: 0 },
    { t: 0.3, dash: 0.55, crouch: 0.55, lean: 0.25, twist: -0.3, pitch: 1.6, elbow: 0.9, cock: 0.3, left: 0.8 },
    { t: 0.62, dash: 0.9, hop: 1.1, crouch: 0.1, lean: -0.3, twist: -0.1, pitch: 3.1, elbow: 0.7, cock: 0.9, side: 0.15, left: 2.6 },
    { t: 0.78, dash: 1, hop: 0.7, crouch: 0.2, lean: -0.2, pitch: 3.25, elbow: 0.5, cock: 1.0, left: 2.7 },
    { t: IMPACT, dash: 1, hop: 0, crouch: 0.9, lean: 0.75, pitch: 0.95, elbow: 0.05, cock: -0.5, side: 0.05, left: 0.6 },
    { t: 1.3, dash: 1, crouch: 0.85, lean: 0.7, pitch: 0.9, elbow: 0.1, cock: -0.5, left: 0.5 },
    { t: 1.8, dash: 1, crouch: 0.3, lean: 0.2, pitch: 0.7, elbow: 0.7, cock: 0, left: 0.2 },
    { ...IDLE, t: 2.5, dash: 0 },
  ];

  private trail = new BladeTrail(24, 0.18, ['#ffffff', '#c9b6ff', '#3a1a7a']);
  private bolts: LightningArc[] = [];
  private star = new StarBurst({ points: 12, color: 0xb49aff, core: 0xffffff });
  private flash = new GlowSphere(0x9a6aff, { rim: false });
  private ring = createRing(0xc9b6ff, 0.9, 1, 128);
  private ring2 = createRing(0x7a4ae0, 0.7, 1, 128);
  private sparks = this.addEmitter(new Emitter({
    ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.6, lifetimeJitter: 0.5, shape: 'sphere', shapeSize: 0.4,
    speed: 10, speedJitter: 0.6, spread: 80, gravity: 6, drag: 2.5, sizeStart: 0.1, sizeEnd: 0.01, sizeJitter: 0.5,
    colorStart: '#ffffff', colorMid: '#c9b6ff', colorEnd: '#3a1a7a', opacityStart: 1, opacityEnd: 0, additive: true,
  }));
  private dust = this.addEmitter(new Emitter({
    ...defaultSettings(), maxParticles: 120, rate: 0, lifetime: 1.4, lifetimeJitter: 0.4, shape: 'cone', shapeSize: 1.2,
    speed: 3.5, speedJitter: 0.5, spread: 70, gravity: 0.6, drag: 2.2, sizeStart: 0.9, sizeEnd: 1.8, sizeJitter: 0.5,
    erosion: 0.55, spin: 0.4, groundFade: 0.3, colorStart: '#3a3048', colorEnd: '#120e18', opacityStart: 0.6, opacityEnd: 0, additive: false,
  }));
  private hitDone = false;
  private boltFrame = 0;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor() {
    super(new ThunderDrumHammer());
    this.reach = 2.3;
    for (let i = 0; i < BOLTS; i++) {
      const bolt = new LightningArc({ width: 0.22, segments: 12, jitter: 0.14, branches: 2, core: 0xffffff, glow: 0x9a6aff });
      this.bolts.push(bolt);
      this.group.add(bolt.mesh);
    }
    this.group.add(this.trail.mesh, this.star.mesh, this.flash.mesh, this.ring.mesh, this.ring2.mesh);
  }

  protected reset() {
    this.hitDone = false;
    this.trail.clear();
    for (const b of this.bolts) b.opacity = 0;
  }

  protected animate(t: number, dt: number) {
    const target = this.ctx?.targetPos[0] ?? this.spot;
    // the smash point: between the hero and the target, where the hammer lands
    const at = this.b.copy(this.spot).lerp(target, 0.75).setY(0);
    if (this.playing && t > IMPACT - 0.22 && t < IMPACT + 0.05) {
      this.trail.push(this.weaponPoint(new THREE.Vector3(0, 0.3, 0), this.a), this.weaponPoint(new THREE.Vector3(0, 0.56, 0), new THREE.Vector3()));
    }
    this.trail.update(1 / 60);

    const age = t - IMPACT;
    const live = this.playing && age >= 0;
    if (live && !this.hitDone) {
      this.hitDone = true;
      this.hitAround(at, RADIUS, { damage: 40 + Math.round(Math.random() * 12), knock: 7, color: '#d8c8ff' });
      this.sparks.burst(110, this.a.copy(at).setY(0.3));
      this.dust.burst(26, this.a.copy(at).setY(0.1));
    }

    // bolts from the sky onto the spot, redrawn every 3 frames, for 0.45 s
    this.boltFrame += dt;
    const boltsOn = live && age < 0.45;
    this.bolts.forEach((bolt, i) => {
      if (boltsOn && this.boltFrame > 0.05) {
        const ang = i * 1.7 + age * 3;
        const end = this.a.copy(at).add(new THREE.Vector3(Math.cos(ang) * 0.6 * (i % 2), 0.05, Math.sin(ang) * 0.6 * (i % 2)));
        bolt.setEnds(end.clone().add(new THREE.Vector3(Math.cos(ang) * 2.5, 9 + i, Math.sin(ang) * 2.5)), end);
        bolt.reroll();
      }
      bolt.opacity = boltsOn ? (i === 0 ? 1 : 0.8) * (1 - age / 0.45) : 0;
      bolt.update(dt);
    });
    if (this.boltFrame > 0.05) this.boltFrame = 0;

    const pop = StarBurst.pop(this.playing ? age : -1, 0.1, 0.25);
    this.star.set(this.a.copy(at).setY(0.8), 1.4 * pop.scale, 0.75 * pop.opacity, t * 2);
    this.flash.mesh.position.copy(at).setY(0.6);
    this.flash.mesh.scale.setScalar(1 + 2.5 * Math.min(1, Math.max(0, age) / 0.3));
    this.flash.opacity = live ? 0.2 * Math.max(0, 1 - age / 0.4) : 0;

    // the shockwave: a crisp fast ring and a slower soft one
    for (const [r, speed, alpha] of [[this.ring, 0.35, 0.8], [this.ring2, 0.6, 0.45]] as const) {
      const f = live ? Math.min(1, age / speed) : 0;
      r.mesh.position.copy(at).setY(0.06);
      r.mesh.scale.setScalar(Math.max(1e-3, 0.3 + RADIUS * 1.15 * f));
      r.material.opacity = live && f < 1 ? alpha * (1 - f) : 0;
    }
    this.shake = live && age < 0.4 ? 0.8 * (1 - age / 0.4) : 0;
  }
}

export const thunderSlamModule = strikeModule('thunder drum slam', () => new ThunderSlam(), {
  zone: { kind: 'circle', radius: RADIUS },
});
