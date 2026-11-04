import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { COURIER, COURIER_CSS, Flecks, buildLetter, wordSprite } from '../../effects/parts/courier';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SHORTCUT_RANGE, SHORTCUT_TIME, bookOf } from '../../traits/courier';

/**
 * Shortcut (courier kit v5, E: a sprint). Pip puts his head down and runs up to 6 m toward the aim (`distance` setting; a shorter aim
 * gives a shorter run, 2 m at least) in `SHORTCUT_TIME` (0.3 s, shared with his trait), cap and bag flapping. No damage and no
 * zone. Where he stood: a ring of dust and a puff of paper. Along the run: a pale streak on the floor, scraps of paper blown back
 * and three envelopes that spill out of the bag and tumble away. Where he stops: a small star and a second ring.
 *
 * The refund: his trait spends a Charge when he has one, and E is nearly ready again (0.4 s). Both screens learn it from the
 * `spent` counter in `courierBooks`; the effect compares it with what it saw at the last cast. Then a blue-and-yellow ring pops
 * round him as he lands, and a little DELIVERED-yellow star shows what it cost. Network duels: the other screen has no `moveCaster`
 * (his client streams the run), so the path is drawn from `sentFrom` and the aim. Clean by 1.3 s.
 */
export interface ShortcutSettings {
  /** Metres of the run at most (the aim may shorten it). */
  distance: number;
  loop: boolean;
}

export const defaultShortcut = (): ShortcutSettings => ({ distance: SHORTCUT_RANGE, loop: false });

const DURATION = 1.3;
const MIN_RUN = 2;
const ENVELOPES = 3;
const MIN = 1e-3;

export class Shortcut implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShortcutSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private arrived = false;
  private refunded = false;
  private seen = 0;
  private trailT = 0;

  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private len = 6;

  private bits = new Flecks(60);
  private envelopes: { g: THREE.Group; v: THREE.Vector3; spin: number; born: number }[] = [];
  private pop = new StarBurst({ points: 8, inner: 0.3, color: COURIER.accent, core: 0xffffff, additive: false });
  private ringA = new ShockRefraction({ facing: 'ground' });
  private ringB = new ShockRefraction({ facing: 'ground' });
  private streak = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COURIER.paper, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private refundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COURIER.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private word = wordSprite('-1', COURIER_CSS.dark, COURIER_CSS.accent, 0.9);
  private v1 = new THREE.Vector3();

  constructor(settings: ShortcutSettings = defaultShortcut()) {
    this.settings = settings;
    this.streak.renderOrder = 1;
    this.refundRing.renderOrder = 3;
    this.group.add(this.streak, this.refundRing, this.bits.mesh, this.pop.mesh, this.ringA.mesh, this.ringB.mesh, this.word);
    for (let i = 0; i < ENVELOPES; i++) {
      const g = buildLetter();
      g.visible = false;
      this.group.add(g);
      this.envelopes.push({ g, v: new THREE.Vector3(), spin: 0, born: 0 });
    }
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SHORTCUT_TIME;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    const d = this.v1.length();
    if (d < 0.3) this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    else this.dir.copy(this.v1).multiplyScalar(1 / d);
    this.len = d < 0.3 ? this.settings.distance : THREE.MathUtils.clamp(d, MIN_RUN, this.settings.distance);
    this.end.copy(this.start).addScaledVector(this.dir, this.len);
    // Did his trait spend a Charge on this one? (It was counted before the cast reached either screen.)
    const spent = bookOf(ctx.caster).spent;
    this.refunded = spent !== this.seen;
    this.seen = spent;
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The run: he slides to the spot (the engine clamps it into the ring and out of the walls) and the path is drawn to where he lands.
    if (ctx.moveCaster) this.end.copy(ctx.moveCaster(this.end, SHORTCUT_TIME)).setY(0);
    this.v1.copy(this.start).setY(0.9);
    this.bits.burst(this.v1, 14, [COURIER.paper, COURIER.cream, COURIER.brown], 3.4, 2.2, 0.17, 1.2);
    // Three envelopes spill out of the bag and tumble away behind him.
    for (let i = 0; i < ENVELOPES; i++) {
      const e = this.envelopes[i];
      e.g.visible = true;
      e.born = 0.04 + i * 0.07;
      e.v.set(-this.dir.x * 3 + (Math.random() - 0.5) * 2, 3 + Math.random() * 2, -this.dir.z * 3 + (Math.random() - 0.5) * 2);
      e.spin = (Math.random() > 0.5 ? 1 : -1) * (9 + Math.random() * 6);
      e.g.position.copy(this.v1.lerpVectors(this.start, this.end, 0.2 + i * 0.25)).setY(1.1);
      e.g.scale.setScalar(MIN);
    }
    this.shake = 0.06;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.arrived = false;
    this.trailT = 0;
    this.bits.reset();
    for (const e of this.envelopes) e.g.visible = false;
    this.pop.set(this.end, 0, 0);
    this.ringA.set(this.start, 0, 0);
    this.ringB.set(this.end, 0, 0);
    this.word.visible = false;
    (this.streak.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.refundRing.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;

    // The ring where he left, growing at once.
    const lp = THREE.MathUtils.clamp(t / 0.35, 0, 1);
    this.ringA.set(this.start, 0.3 + 1.8 * lp, 0.05 * (1 - lp) * (1 - lp));

    // The streak on the floor: from where he stood to where he is, fading.
    const run = Math.min(1, t / SHORTCUT_TIME), reach = this.len * (1 - Math.pow(1 - run, 3));
    this.v1.copy(this.start).addScaledVector(this.dir, reach / 2);
    this.streak.position.set(this.v1.x, 0.05, this.v1.z);
    this.streak.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    this.streak.scale.set(0.5 * (1 - 0.5 * run), 1, Math.max(MIN, reach));
    (this.streak.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - smoothstep((t - SHORTCUT_TIME) / 0.5));

    // Paper blown back from where he is, while he runs.
    if (t < SHORTCUT_TIME + 0.05) {
      this.trailT += dt;
      if (this.trailT >= 0.03) {
        this.trailT = 0;
        this.v1.copy(this.start).addScaledVector(this.dir, reach).setY(1.0);
        this.bits.burst(this.v1, 2, [COURIER.paper, COURIER.cream], 1.6, 0.8, 0.13, 0.9);
      }
    }

    // The envelopes tumble.
    for (const e of this.envelopes) {
      if (!e.g.visible) continue;
      const a = t - e.born;
      if (a < 0) continue;
      e.v.y -= 6 * dt;
      e.g.position.addScaledVector(e.v, dt);
      if (e.g.position.y < 0.1) { e.g.position.y = 0.1; e.v.set(e.v.x * 0.3, 0, e.v.z * 0.3); }
      e.g.rotation.x += e.spin * dt;
      e.g.rotation.z += e.spin * 0.6 * dt;
      e.g.scale.setScalar(Math.max(MIN, Math.min(1, a * 8) * (1 - smoothstep((t - 0.8) / 0.4))));
    }

    if (!this.arrived && t >= SHORTCUT_TIME) {
      this.arrived = true;
      this.v1.copy(this.end).setY(0.6);
      this.bits.burst(this.v1, 10, [COURIER.paper, COURIER.cream, COURIER.string], 3.2, 2.4, 0.15);
      this.shake = 0.1;
    }
    if (this.arrived) {
      const after = t - SHORTCUT_TIME;
      const sp = StarBurst.pop(after, 0, 0.03);
      this.v1.copy(this.end).setY(1.1);
      this.pop.set(this.v1, 0.8 * sp.scale, sp.opacity, 0.2);
      const rp = THREE.MathUtils.clamp(after / 0.35, 0, 1);
      this.ringB.set(this.end, 0.3 + 1.4 * rp, 0.045 * (1 - rp) * (1 - rp));
      this.shake = Math.max(this.shake, 0.1 * Math.exp(-after * 14));
      if (this.refunded) {
        // A Charge was spent: a yellow ring pops round him and a small "-1" floats up.
        const rr = this.refundRing.material as THREE.MeshBasicMaterial, k = smoothstep(after / 0.3);
        this.refundRing.position.set(this.end.x, 0.07, this.end.z);
        this.refundRing.scale.setScalar(Math.max(MIN, 0.4 + 1.4 * k));
        rr.opacity = 0.95 * (1 - smoothstep((after - 0.2) / 0.5));
        const out = 1 - smoothstep((after - 0.5) / 0.4);
        this.word.visible = out > 0.02;
        this.word.position.set(this.end.x, 2.4 + 0.5 * smoothstep(after / 0.6), this.end.z);
        this.word.scale.set(0.9 * Math.max(MIN, out), 0.3 * Math.max(MIN, out), 1);
      }
    }
  }
}

export const shortcutModule: EffectModule = {
  label: 'shortcut',
  category: 'hero: courier',
  // A run toward the aim, no area: the radius only lets the AI cast it when the target is within reach.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new Shortcut(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Shortcut;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as Shortcut).settings;
    f.add(s, 'loop');
    f.add(s, 'distance', 2, 10, 0.5);
  },
};
