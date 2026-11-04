import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { REFEREE, REFEREE_CSS, SoundRings, buildWhistle } from '../../effects/parts/referee';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { WHISTLE_DAMAGE, WHISTLE_RADIUS, WHISTLE_RANGE, WHISTLE_SPEED, WHISTLE_WIND } from '../../traits/referee';

/**
 * Whistle Blast (referee kit, Q: a ring of sound). Whistler draws the chrome whistle up to his lips over the 0.3 s wind-up (his
 * cheeks are the effect's own: a pulse ring at the mouth) and blows it: a real bolt (`ctx.projectile`: 8 m from him, 22 m/s, radius
 * 0.4) that is a standing ring of sound, a fat pale hoop with a smaller one inside it, facing the way it flies and pulsing, and it
 * throws off a train of thin rings that swell and fade behind it. It reaches 6 m at 0.57 s. A hit: 50 damage and three rings burst
 * out of the target, with a dark floor ring. A miss: the ring thins out where its range ends.
 *
 * Telegraph: one thin line as wide as the bolt really hits (`boltWidth`), from the cast; its `impact` is the launch (0.3 s), so
 * the root on him ends there. Network duels: bolts fly on the victim's screen, so the caster's screen draws the same flight along
 * the same line. Clean by about 1.8 s. See pipeline/designs/kit-referee.md.
 */
export interface WhistleBlastSettings {
  damage: number;
  knock: number;
}

export const defaultWhistleBlast = (): WhistleBlastSettings => ({ damage: WHISTLE_DAMAGE, knock: 1.5 });

// Timeline and numbers.
const MUZZLE = 0.8;
const BOLT_Y = 1.45;
const MAX_T = 2.0;
const LINE_W = boltWidth(WHISTLE_RADIUS);
const FLIGHT = WHISTLE_RANGE - MUZZLE;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class WhistleBlast implements Effect {
  readonly group = new THREE.Group();
  readonly settings: WhistleBlastSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  start = new THREE.Vector3();
  dir = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private fired = false;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown by the drawn-only bolt (-1: none, -2: done)
  private goneAt = -1;
  private landed = false;
  private trailT = 0;
  private mouth = new THREE.Vector3();
  private lastPos = new THREE.Vector3();

  private whistle = buildWhistle();
  private rings = new SoundRings(16);
  private head = new THREE.Group();
  private hoopA = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 40), new THREE.MeshBasicMaterial({ color: REFEREE.white, side: THREE.DoubleSide }));
  private hoopB = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.56, 36), new THREE.MeshBasicMaterial({ color: REFEREE.pale, side: THREE.DoubleSide }));
  private edge = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.1, 40), new THREE.MeshBasicMaterial({ color: REFEREE.foil, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  private star = new StarBurst({ points: 8, inner: 0.35, color: REFEREE.white, core: REFEREE.pale, additive: false });
  private starAt = new THREE.Vector3();
  private starAge = 9;
  private yaw = 0;

  private v1 = new THREE.Vector3();

  constructor(settings: WhistleBlastSettings = defaultWhistleBlast()) {
    this.settings = settings;
    this.edge.position.z = -0.02;
    this.hoopB.position.z = 0.01;
    this.head.add(this.edge, this.hoopA, this.hoopB);
    this.head.visible = false;
    this.group.add(this.whistle, this.head, this.rings.group, this.star.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return WHISTLE_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line: only sentFrom and the aim point.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.yaw = Math.atan2(dx, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    // His lips: a little ahead of him, at head height.
    this.mouth.set(ctx.from.x + dx * 0.4, 1.62, ctx.from.z + dz * 0.4);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.bolt = null;
    this.drawn = -1;
    this.goneAt = -1;
    this.landed = false;
    this.trailT = 0;
    this.starAge = 9;
    this.head.visible = false;
    this.whistle.visible = false;
    this.rings.reset();
    this.star.set(this.starAt, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.rings.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: the whistle rises from his hand to his lips, and a pulse swells at the mouth. ---
    if (!this.fired) {
      const k = easeOut(t / WHISTLE_WIND);
      const hx = this.mouth.x - this.dir.x * 0.5 + this.dir.z * 0.35, hz = this.mouth.z - this.dir.z * 0.5 - this.dir.x * 0.35;
      this.whistle.visible = true;
      this.whistle.position.set(hx + (this.mouth.x - hx) * k, 1.0 + 0.62 * k, hz + (this.mouth.z - hz) * k);
      this.whistle.rotation.set(0, this.yaw - Math.PI / 2, 0);
      this.whistle.scale.setScalar(1.5);
      this.trailT += dt;
      if (this.trailT >= 0.09 && t > 0.12) {
        this.trailT = 0;
        this.rings.fire({ x: this.mouth.x, y: 1.62, z: this.mouth.z, r0: 0.7, r1: 0.18, life: 0.14, yaw: this.yaw, opacity: 0.5, thick: 0 });
      }
    }

    // --- Fire. A real bolt where there is one; else (a network duel's caster screen) a drawn bolt along the same line. ---
    if (!this.fired && t >= WHISTLE_WIND) {
      this.fired = true;
      this.shake = 0.07;
      this.whistle.position.set(this.mouth.x, 1.62, this.mouth.z);
      this.starAt.set(this.mouth.x + this.dir.x * 0.5, 1.62, this.mouth.z + this.dir.z * 0.5);
      this.starAge = 0;
      this.rings.fire({ x: this.start.x, y: BOLT_Y, z: this.start.z, r0: 0.4, r1: 1.7, life: 0.3, yaw: this.yaw, opacity: 0.8, thick: 2 });
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: WHISTLE_SPEED, range: FLIGHT, radius: WHISTLE_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: REFEREE_CSS.accent },
        });
        this.bolt.onHit((_target, at) => this.land(at, true));
      } else {
        this.drawn = 0;
      }
    }

    // --- The hoops ride the bolt (or the drawn line), pulsing; thin rings swell and fade behind. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.lastPos.copy(b.pos); this.ride(b.pos, dt); }
    } else if (this.drawn >= 0) {
      this.drawn += WHISTLE_SPEED * dt;
      live = this.drawn < FLIGHT;
      if (live) {
        this.v1.set(this.start.x + this.dir.x * this.drawn, BOLT_Y, this.start.z + this.dir.z * this.drawn);
        this.lastPos.copy(this.v1);
        this.ride(this.v1, dt);
      } else this.drawn = -2;
    }
    if (this.fired && !live && this.goneAt < 0) {
      this.goneAt = t;
      this.head.visible = false;
      if (!this.landed) this.fade();
    }
    if (this.goneAt >= 0) this.whistle.visible = false;
    else if (this.fired) this.whistle.visible = t < WHISTLE_WIND + 0.25;

    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0.05, 0.16);
    this.star.set(this.starAt, 1.1 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 12);

    if ((this.goneAt >= 0 && t >= this.goneAt + 0.7 && !this.rings.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  /** Moves the hoops to the bolt and lays the trail of rings. */
  private ride(pos: THREE.Vector3, dt: number) {
    const t = this.time;
    this.head.visible = true;
    this.head.position.set(pos.x, BOLT_Y, pos.z);
    this.head.rotation.set(0, this.yaw, 0);
    const pulse = 1 + 0.12 * Math.sin(t * 40);
    this.head.scale.setScalar(0.62 * pulse);
    this.hoopB.scale.setScalar(1 + 0.25 * Math.sin(t * 40 + 2));
    this.trailT += dt;
    if (this.trailT >= 0.05) {
      this.trailT = 0;
      this.rings.fire({ x: pos.x - this.dir.x * 0.45, y: BOLT_Y, z: pos.z - this.dir.z * 0.45, r0: 0.55, r1: 1.25, life: 0.3, yaw: this.yaw, opacity: 0.55, thick: 0 });
    }
  }

  /** The ring hits: three rings burst out of the target and a dark ring is stamped on the floor. */
  private land(at: THREE.Vector3, hit: boolean) {
    this.landed = true;
    this.starAt.set(at.x, BOLT_Y, at.z);
    this.starAge = 0;
    if (hit) {
      for (let i = 0; i < 3; i++) this.rings.fire({ x: at.x, y: BOLT_Y, z: at.z, r0: 0.5, r1: 1.6 + i * 0.7, life: 0.35 + i * 0.1, yaw: this.yaw, opacity: 0.8 - i * 0.15, thick: i === 0 ? 2 : 1 });
      this.rings.fire({ x: at.x, y: 0.07, z: at.z, r0: 0.4, r1: 2.3, life: 0.5, yaw: null, color: REFEREE.foil, opacity: 0.8, thick: 2 });
      this.rings.fire({ x: at.x, y: 0.09, z: at.z, r0: 0.3, r1: 2.0, life: 0.45, yaw: null, opacity: 0.8, thick: 1 });
    }
    this.shake = hit ? 0.14 : 0.04;
    this.head.visible = false;
    this.goneAt = this.time;
  }

  /** A miss: the ring thins out where the range ends. */
  private fade() {
    this.landed = true;
    this.rings.fire({ x: this.lastPos.x, y: BOLT_Y, z: this.lastPos.z, r0: 0.6, r1: 1.9, life: 0.4, yaw: this.yaw, opacity: 0.5, thick: 0 });
  }
}

export const whistleBlastModule: EffectModule = {
  label: 'whistle blast',
  category: 'hero: referee',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: WHISTLE_RADIUS },
  create: () => new WhistleBlast(),
  telegraphs(effect) {
    const e = effect as WhistleBlast;
    if (!e.ctx) return [];
    const s = e.ctx.sentFrom ?? e.ctx.from;
    const spec: TelegraphSpec = {
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: s.x + e.dir.x * WHISTLE_RANGE, z2: s.z + e.dir.z * WHISTLE_RANGE, width: LINE_W },
      start: 0,
      impact: WHISTLE_WIND,
      until: WHISTLE_WIND + FLIGHT / WHISTLE_SPEED,
    };
    return [spec];
  },
  bloom: { enabled: true, strength: 0.25, radius: 0.3, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as WhistleBlast;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as WhistleBlast).settings;
    f.add(s, 'damage', 0, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
