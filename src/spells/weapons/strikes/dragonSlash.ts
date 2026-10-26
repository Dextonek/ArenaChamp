import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../../emitter';
import { GlowSphere } from '../../../effects/common';
import { CrescentArc, StarBurst } from '../../../effects/parts';
import { BladeTrail } from '../../../effects/weapons/kit';
import { SOCKETS } from '../../../effects/weapons/sockets';
import { WeaponStrike, strikeModule, IDLE, type Pose } from '../../../effects/weapons/strike';
import { AzureDragonSword } from '../azureDragonSword';

/**
 * Azure dragon slash: the hero dashes in with the Azure Dragon-Spine Sword raised over the right shoulder, cuts
 * diagonally down across the target (a cyan blade trail), and the cut throws a crescent of sword qi that bursts
 * on the enemy in a star and a spray of cyan sparks. Walks back to its spot afterwards.
 */
const S = SOCKETS['wp-sword-dragon'];
const IMPACT = 0.95;

export class DragonSlash extends WeaponStrike {
  readonly duration = 2.3;
  readonly impact = IMPACT;
  protected readonly poses: Pose[] = [
    { ...IDLE, t: 0 },
    { t: 0.38, dash: 0.8, crouch: 0.35, lean: 0.25, twist: -0.6, pitch: 2.7, side: 0.45, elbow: 1.1, cock: 0.5, left: 0.7 },
    { t: 0.8, dash: 1, crouch: 0.25, lean: 0.1, twist: -0.75, pitch: 2.95, side: 0.5, elbow: 1.2, cock: 0.6, left: 0.8 },
    { t: IMPACT, dash: 1, crouch: 0.55, lean: 0.45, twist: 0.55, pitch: 1.0, yaw: 0.8, side: 0.1, elbow: 0.15, cock: -0.2, left: 0.3 },
    { t: 1.15, dash: 1, crouch: 0.5, lean: 0.4, twist: 0.75, pitch: 0.55, yaw: 1.15, side: 0, elbow: 0.25, cock: -0.3, left: 0.2 },
    { t: 1.6, dash: 1, crouch: 0.3, lean: 0.15, twist: 0.3, pitch: 0.6, yaw: 0.4, elbow: 0.7, cock: 0.1, left: 0.2 },
    { ...IDLE, t: 2.3, dash: 0 },
  ];

  private trail = new BladeTrail(30, 0.2, ['#ffffff', '#7ff6ff', '#0f5a7a']);
  private wave = new CrescentArc({ radius: 1.5, width: 0.5, sweep: Math.PI * 0.95, style: 'soft', edge: '#f0ffff', mid: '#6ff2ff', outer: '#0a4a6a' });
  private star = new StarBurst({ points: 10, color: 0x7ff6ff, core: 0xffffff });
  private flash = new GlowSphere(0x6ff2ff, { rim: false });
  private sparks = this.addEmitter(new Emitter({
    ...defaultSettings(), maxParticles: 240, rate: 0, lifetime: 0.6, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.3,
    speed: 7, speedJitter: 0.6, spread: 180, gravity: 4, drag: 2.2, sizeStart: 0.1, sizeEnd: 0.02, sizeJitter: 0.5,
    colorStart: '#ffffff', colorMid: '#7ff6ff', colorEnd: '#0f5a7a', opacityStart: 1, opacityEnd: 0, additive: true,
  }));
  private hitDone = false;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  constructor() {
    super(new AzureDragonSword());
    this.group.add(this.trail.mesh, this.wave.mesh, this.star.mesh, this.flash.mesh);
  }

  protected reset() {
    this.hitDone = false;
    this.trail.clear();
    this.wave.opacity = 0;
    this.star.set(this.spot, 0, 0);
    this.flash.opacity = 0;
  }

  protected animate(t: number) {
    const target = this.ctx?.targetPos[0] ?? this.spot;

    // the swing leaves a cyan trail from the blade
    if (this.playing && t > IMPACT - 0.2 && t < IMPACT + 0.25) {
      this.trail.push(this.weaponPoint(S.bladeBase, this.tmpA), this.weaponPoint(S.tip, this.tmpB));
    }
    this.trail.update(1 / 60);

    // the cut throws a crescent of sword qi that flies to the target
    const w = (t - IMPACT + 0.05) / 0.3;
    if (this.playing && w >= 0 && w <= 1.4) {
      const m = this.wave.mesh;
      m.position.copy(this.spot).lerp(target, Math.min(1, w)).setY(1.7);
      m.rotation.set(0, Math.atan2(this.dir.x, this.dir.z), 0);
      m.rotateZ(-0.9);
      this.wave.head = Math.min(1.35, w * 1.6);
      this.wave.length = 0.6;
      this.wave.erosion = Math.max(0, w - 0.8) * 2;
      this.wave.time = t;
      this.wave.opacity = 1;
    } else {
      this.wave.opacity = 0;
    }

    // impact on the enemy
    const age = t - (IMPACT + 0.2);
    if (this.playing && !this.hitDone && age >= 0) {
      this.hitDone = true;
      this.hitAround(target, 2.2, { damage: 34 + Math.round(Math.random() * 10), knock: 5, color: '#9ff8ff' }, this.ctx?.targets.slice(0, 1));
      this.sparks.burst(45, this.tmpA.copy(target).setY(1.3));
    }
    const pop = StarBurst.pop(age, 0.1, 0.2);
    this.star.set(this.tmpA.copy(target).setY(1.4), 1.1 * pop.scale, 0.85 * pop.opacity, t * 3);
    const f = age >= 0 && age < 0.5 ? 1 - age / 0.5 : 0;
    this.flash.mesh.position.copy(target).setY(1.3);
    this.flash.mesh.scale.setScalar(0.8 + 1.4 * (1 - f));
    this.flash.opacity = 0.35 * f;
    this.shake = age >= 0 && age < 0.25 ? 0.35 * (1 - age / 0.25) : 0;
  }
}

export const dragonSlashModule = strikeModule('azure dragon slash', () => new DragonSlash());
