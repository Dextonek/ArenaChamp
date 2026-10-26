import * as THREE from 'three';
import { GlowSphere } from '../../../effects/common';
import { BladeTrail, FlowRibbon, LilyBurst, PetalSwarm, StarFlare } from '../../../effects/weapons/kit';
import { WeaponStrike, strikeModule, IDLE, type Pose } from '../../../effects/weapons/strike';
import { PhoenixFan } from '../phoenixFan';

/**
 * Phoenix gale: the hero stays put, draws the Jade-Leaf Phoenix Fan across the body and sweeps it out wide. One
 * flame-petal gust per target flies out in a curve (a hot star with a pink flame streak), and where each lands a
 * gold spider-lily bursts open, a crown of flame tongues licks up and petals scatter — one target after another.
 */
const IMPACT = 0.62; // the release of the sweep
const MAXT = 4;
const TONGUES = 7;

interface Gust {
  head: StarFlare;
  streak: BladeTrail;
  lily: LilyBurst;
  glow: GlowSphere;
  crown: THREE.Group;
  tongues: FlowRibbon[];
  launch: number;
  land: number;
  hit: boolean;
  curve: THREE.QuadraticBezierCurve3;
}

export class PhoenixGale extends WeaponStrike {
  readonly duration = 2.6;
  readonly impact = IMPACT + 0.45;
  protected readonly poses: Pose[] = [
    { ...IDLE, t: 0 },
    { t: 0.35, crouch: 0.3, lean: 0.05, twist: 0.7, pitch: 1.3, yaw: 1.2, elbow: 1.2, cock: 0.2, left: 0.3 },
    { t: 0.5, crouch: 0.35, twist: 0.8, pitch: 1.35, yaw: 1.3, elbow: 1.3, cock: 0.25, left: 0.3 },
    { t: IMPACT + 0.12, crouch: 0.45, lean: 0.2, twist: -0.6, pitch: 1.55, yaw: -0.7, side: 0.6, elbow: 0.15, cock: -0.1, left: 0.6 },
    { t: 1.3, crouch: 0.4, lean: 0.15, twist: -0.5, pitch: 1.45, yaw: -0.6, side: 0.55, elbow: 0.2, cock: -0.1, left: 0.6 },
    { ...IDLE, t: 2.6 },
  ];

  private gusts: Gust[] = [];
  private petals = new PetalSwarm({ count: 140, color: 0xffa860, size: 0.14, gravity: 1, drag: 1.4, life: 1.8 });
  private sweep = new BladeTrail(26, 0.25, ['#fff0c0', '#ff7a5a', '#7a2070']);
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor() {
    super(new PhoenixFan());
    this.reach = 1e6; // ranged: the hero never dashes
    for (let i = 0; i < MAXT; i++) {
      const g: Gust = {
        head: new StarFlare(0xfff0d0, 0xff9ad0),
        streak: new BladeTrail(20, 0.18, ['#fff0c0', '#ff6a5a', '#7a2070']),
        lily: new LilyBurst(0xffb85a, 0xfff0c8, { filaments: 30, curl: 1, seed: i + 3 }),
        glow: new GlowSphere(0xff5a8a, { rim: false }),
        crown: new THREE.Group(),
        tongues: [],
        launch: 0, land: 0, hit: false,
        curve: new THREE.QuadraticBezierCurve3(),
      };
      // a ring of flame tongues licking up round the target (built at the origin, moved on cast)
      for (let k = 0; k < TONGUES; k++) {
        const ang = (k / TONGUES) * Math.PI * 2;
        const out = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
        const pts = [0, 0.4, 0.75, 1].map((u) => out.clone().multiplyScalar(0.6 + 0.3 * u).setY(u * (1.6 + 0.5 * (k % 3))));
        const r = new FlowRibbon({
          points: pts, width: (u) => 0.45 * (1 - 0.7 * u), colors: ['#ffc070', '#ff4a6a', '#5a1050'], cross: true,
          tiling: 3, across: 5, erosion: 0.6, sway: 0.15, swayWaves: 1, intensity: 0.85,
        });
        g.tongues.push(r);
        g.crown.add(r.mesh);
      }
      this.gusts.push(g);
      this.group.add(g.head.group, g.streak.mesh, g.lily.group, g.glow.mesh, g.crown);
    }
    this.group.add(this.petals.mesh, this.sweep.mesh);
  }

  protected reset() {
    this.petals.clear();
    this.sweep.clear();
    const ctx = this.ctx;
    this.gusts.forEach((g, i) => {
      g.hit = false;
      g.streak.clear();
      g.launch = IMPACT + 0.06 * i;
      g.land = g.launch + 0.38 + 0.03 * i;
      const target = ctx?.targetPos[i];
      if (!target) return;
      const start = this.from.clone().setY(2.0);
      const end = target.clone().setY(1.3);
      const mid = start.clone().lerp(end, 0.5).setY(3.2 + 0.6 * i);
      const side = new THREE.Vector3(-this.dir.z, 0, this.dir.x).multiplyScalar((i % 2 ? 1 : -1) * (1.5 + i));
      mid.add(side);
      g.curve.v0.copy(start); g.curve.v1.copy(mid); g.curve.v2.copy(end);
      g.crown.position.copy(target).setY(0);
    });
  }

  protected animate(t: number, dt: number) {
    const ctx = this.ctx;
    // the fan's own sweep leaves a wide flame trail
    if (this.playing && t > IMPACT - 0.1 && t < IMPACT + 0.2) {
      this.sweep.push(this.weaponPoint(new THREE.Vector3(0, 0.12, 0), this.a), this.weaponPoint(new THREE.Vector3(0, 0.45, 0), this.b));
    }
    this.sweep.update(1 / 60);

    this.gusts.forEach((g, i) => {
      const target = ctx?.targets[i];
      const active = this.playing && !!target;
      const f = active ? (t - g.launch) / (g.land - g.launch) : -1;
      const flying = f >= 0 && f < 1;
      if (flying) {
        const p = g.curve.getPoint(f, this.a);
        const back = g.curve.getPoint(Math.max(0, f - 0.04), new THREE.Vector3());
        const up = new THREE.Vector3(0, 0.3, 0);
        g.head.set(p, 0.9, 1, t * 4);
        g.streak.push(back.clone().sub(up), back.clone().add(up));
      } else {
        g.head.set(this.a, 0, 0);
      }
      g.streak.update(1 / 60);

      const age = active ? t - g.land : -1;
      if (active && age >= 0 && !g.hit && target) {
        g.hit = true;
        this.hitAround(ctx!.targetPos[i], 0, { damage: 18 + Math.round(Math.random() * 8), knock: 3, color: '#ffc0a0' }, [target]);
        this.petals.emit(this.b.copy(ctx!.targetPos[i]).setY(1.4), 22, 3, 0.8);
      }
      const live = age >= 0;
      const bloom = live ? Math.min(1, age / 0.12) : 0;
      const fade = live ? Math.max(0, 1 - Math.max(0, age - 0.3) / 0.6) : 0;
      const at = this.b.copy(ctx?.targetPos[i] ?? this.spot).setY(1.4);
      g.lily.set(at, 3.2 * (0.4 + 0.6 * bloom), fade, age * 0.5);
      g.glow.mesh.position.copy(at);
      g.glow.mesh.scale.setScalar(0.5 + 0.7 * bloom);
      g.glow.opacity = live ? 0.18 * fade : 0;
      const grow = live ? Math.min(1, age / 0.25) : 0;
      g.crown.scale.set(1, Math.max(1e-3, grow), 1);
      g.tongues.forEach((r) => {
        r.update(Math.max(0, age) % 2, 2, 2, 1);
        r.opacity = 0.7 * fade * grow;
      });
    });
    this.petals.update(dt);
    const age = t - (IMPACT + 0.4);
    this.shake = this.playing && age >= 0 && age < 0.3 ? 0.2 * (1 - age / 0.3) : 0;
  }
}

export const phoenixGaleModule = strikeModule('phoenix gale', () => new PhoenixGale(), {
  mode: 'enemies', maxTargets: MAXT, zone: { kind: 'circle', radius: 1.6 },
});
