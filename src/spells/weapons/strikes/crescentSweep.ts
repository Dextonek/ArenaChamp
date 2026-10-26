import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../../emitter';
import { CrescentArc, StarBurst } from '../../../effects/parts';
import { BladeTrail, PetalSwarm } from '../../../effects/weapons/kit';
import { SOCKETS } from '../../../effects/weapons/sockets';
import { WeaponStrike, strikeModule, IDLE, type Pose } from '../../../effects/weapons/strike';
import { GreenDragonCrescent } from '../greenDragonCrescent';

/**
 * Green dragon sweep: the hero steps in with the Green Dragon Crescent Blade drawn back low on the right, then
 * whirls it round in one wide horizontal sweep. A flat jade crescent the size of the arc cuts through every enemy
 * in front, each hit popping a jade star in order (right to left, as the blade passes), and gold flecks scatter.
 */
const S = SOCKETS['wp-glaive-guandao'];
const IMPACT = 0.9;
const MAXT = 6;
const REACH = 5.8;

export class CrescentSweep extends WeaponStrike {
  readonly duration = 2.4;
  readonly impact = IMPACT;
  protected readonly poses: Pose[] = [
    { ...IDLE, t: 0 },
    { t: 0.4, dash: 0.8, crouch: 0.45, lean: 0.15, twist: -1.0, pitch: 1.3, side: 0.7, yaw: -0.8, elbow: 0.4, cock: -0.3, left: 0.9 },
    { t: 0.72, dash: 1, crouch: 0.5, lean: 0.2, twist: -1.2, pitch: 1.35, side: 0.8, yaw: -1.0, elbow: 0.35, cock: -0.35, left: 1.0 },
    { t: IMPACT, dash: 1, crouch: 0.6, lean: 0.3, twist: 0.4, pitch: 1.45, side: 0.3, yaw: 0.4, elbow: 0.1, cock: -0.4, left: 0.4 },
    { t: 1.1, dash: 1, crouch: 0.55, lean: 0.3, twist: 1.1, pitch: 1.35, side: 0.1, yaw: 1.2, elbow: 0.2, cock: -0.4, left: 0.2 },
    { t: 1.65, dash: 1, crouch: 0.3, lean: 0.1, twist: 0.4, pitch: 0.9, yaw: 0.4, elbow: 0.6, left: 0.2 },
    { ...IDLE, t: 2.4, dash: 0 },
  ];

  private trail = new BladeTrail(30, 0.25, ['#fff6d0', '#5cff9a', '#0a3a1e']);
  private arc = new CrescentArc({ radius: 3.3, width: 1.1, sweep: Math.PI * 1.1, style: 'soft', edge: '#fff6d0', mid: '#5cff9a', outer: '#0a3a1e' });
  private stars: StarBurst[] = [];
  private hitAt: number[] = [];
  private flecks = new PetalSwarm({ count: 80, color: 0xffd070, size: 0.12, gravity: 1.2, drag: 1.5, life: 1.6 });
  private motes = this.addEmitter(new Emitter({
    ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4, shape: 'sphere', shapeSize: 0.4,
    speed: 5, speedJitter: 0.6, spread: 180, gravity: 2, drag: 2, sizeStart: 0.1, sizeEnd: 0.01, sizeJitter: 0.5,
    colorStart: '#fff6d0', colorMid: '#5cff9a', colorEnd: '#0a3a1e', opacityStart: 1, opacityEnd: 0, additive: true,
  }));
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor() {
    super(new GreenDragonCrescent());
    this.reach = 2.6;
    for (let i = 0; i < MAXT; i++) {
      const s = new StarBurst({ points: 8, color: 0x5cff9a, core: 0xfff6d0 });
      this.stars.push(s);
      this.group.add(s.mesh);
    }
    this.group.add(this.trail.mesh, this.arc.mesh, this.flecks.mesh);
  }

  protected reset() {
    this.trail.clear();
    this.flecks.clear();
    // hit order: right to left as the blade passes (by the side of the sweep each enemy is on)
    const ctx = this.ctx;
    this.hitAt = [];
    if (!ctx) return;
    const right = new THREE.Vector3(-this.dir.z, 0, this.dir.x);
    ctx.targetPos.forEach((p, i) => {
      const side = p.clone().sub(this.spot).dot(right); // + = hero's right
      this.hitAt[i] = IMPACT - 0.06 + THREE.MathUtils.clamp(-side / 4, -0.12, 0.12) + 0.12;
    });
  }

  protected animate(t: number, dt: number) {
    const ctx = this.ctx;
    if (this.playing && t > IMPACT - 0.2 && t < IMPACT + 0.25) {
      this.trail.push(this.weaponPoint(S.collar, this.a), this.weaponPoint(S.tip, this.b));
    }
    this.trail.update(1 / 60);

    // the flat jade crescent sweeps round in front of the hero, right to left
    const w = (t - (IMPACT - 0.12)) / 0.35;
    const m = this.arc.mesh;
    if (this.playing && w >= 0 && w <= 1.6) {
      m.position.copy(this.spot).setY(1.15);
      m.rotation.set(-Math.PI / 2, 0, 0);
      // local XY → ground plane; start the arc at the hero's right and sweep to its left
      m.rotateZ(-Math.atan2(this.dir.z, this.dir.x) - Math.PI * 0.55);
      this.arc.head = Math.min(1.35, w * 1.4);
      this.arc.length = 0.55;
      this.arc.erosion = Math.max(0, w - 0.9) * 1.6;
      this.arc.time = t;
      this.arc.opacity = 0.95;
    } else {
      this.arc.opacity = 0;
    }

    // hits in order, a star and a spray on each
    if (ctx) {
      ctx.targets.forEach((e, i) => {
        if (i >= MAXT) return;
        // the chained targets can reach far: only those within the sweep get cut
        if (ctx.targetPos[i].distanceTo(this.spot) > REACH) { this.stars[i].set(this.a, 0, 0); return; }
        const at = this.hitAt[i] ?? IMPACT;
        const age = t - at;
        const p = this.a.copy(ctx.targetPos[i]).setY(1.4);
        if (this.playing && age >= 0 && age < dt + 1e-6) {
          this.hitAround(p, 0, { damage: 22 + Math.round(Math.random() * 8), knock: 4, color: '#9fffc0' }, [e]);
          this.motes.burst(30, p);
          this.flecks.emit(p, 8, 2.5, 0.6);
        }
        const pop = StarBurst.pop(this.playing ? age : -1, 0.08, 0.2);
        this.stars[i].set(p, 1.0 * pop.scale, 0.85 * pop.opacity, t * 2 + i);
      });
    }
    for (let i = ctx?.targets.length ?? 0; i < MAXT; i++) this.stars[i].set(this.a, 0, 0);
    this.flecks.update(dt);
    const age = t - IMPACT;
    this.shake = this.playing && age >= 0 && age < 0.3 ? 0.3 * (1 - age / 0.3) : 0;
  }
}

export const crescentSweepModule = strikeModule('green dragon sweep', () => new CrescentSweep(), {
  mode: 'enemies', maxTargets: MAXT, zone: { kind: 'cone', radius: REACH, angle: 170 },
});
