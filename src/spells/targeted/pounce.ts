import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { ArcTrail, CAT, CAT_CSS, CatWord, Hearts, PawPrints, Specks } from '../../effects/parts/cat';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { POUNCE_DAMAGE, POUNCE_RADIUS, POUNCE_RANGE, POUNCE_TIME } from '../../traits/cat';

/**
 * Pounce (cat kit v5, E: a leap that costs a life; label 'pounce'). The trait spends the life he is on (`payHp` in `afterCast`, src/traits/cat.ts):
 * a tiny cracked heart pops over his head and drifts up, MROW. He crouches (a puff at his feet) and leaps up to 7 m toward the aim,
 * landing 0.8 m short of it, in 0.65 s (`ctx.moveCaster`): an amber ribbon arcs over the ground from where he sprang to where he
 * lands, a ginger head with two ears riding its front. The landing is shown from the cast as a 1.5 m circle with an amber ring
 * closing on it (a circle needs at least 0.25 + 1.5 / 4 = 0.63 s to leave). At 0.65 s whoever stands inside it, on their live
 * position, takes 60 and a push; dust runs out along the floor, four paw prints stamp, a star pops, GOTCHA. He cannot cast for 0.4 s
 * after landing (the trait's `hold` and `canCast`). Network duels: the other screen has no `moveCaster` (his own client streams the
 * leap), so the path is drawn from `sentFrom` and the aim. Clean by about 2.2 s. See pipeline/designs/kit-cat.md.
 */
export interface PounceSettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultPounce = (): PounceSettings => ({ damage: POUNCE_DAMAGE, knock: 4, loop: false });

const DURATION = 2.2;
const STOP_SHORT = 0.8;
const MIN_LEAP = 1.5;
const PEAK = 2.4;

export class Pounce implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PounceSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  zone: TelegraphShape = { kind: 'circle', x: 0, z: 0, radius: POUNCE_RADIUS };
  private start = new THREE.Vector3();
  private land = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private landed = false;

  private arc = new ArcTrail();
  private specks = new Specks(60);
  private hearts = new Hearts(2);
  private word = new CatWord(2);
  private prints = new PawPrints(4);
  private closing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CAT.body, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private pop = new StarBurst({ points: 8, inner: 0.3, color: CAT.body, core: CAT.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();

  constructor(settings: PounceSettings = defaultPounce()) {
    this.settings = settings;
    this.closing.renderOrder = 3;
    this.group.add(this.closing, this.prints.mesh, this.arc.mesh, this.specks.mesh, this.hearts.mesh, this.word.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return POUNCE_TIME;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens agree: only `sentFrom` and the aim point decide where he lands.
    const s = ctx.sentFrom ?? ctx.from;
    this.start.set(s.x, 0, s.z);
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= d; dz /= d; }
    this.dir.set(dx, 0, dz);
    const leap = Math.min(POUNCE_RANGE, Math.max(MIN_LEAP, (d < 0.05 ? POUNCE_RANGE : d) - STOP_SHORT));
    this.land.set(s.x + dx * leap, 0, s.z + dz * leap);
    this.zone = { kind: 'circle', x: this.land.x, z: this.land.z, radius: POUNCE_RADIUS };
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The leap itself (the engine clamps it into the ring and out of the walls); the ribbon follows what he really reaches.
    if (ctx.moveCaster) this.land.copy(ctx.moveCaster(this.land, POUNCE_TIME)).setY(0);
    this.arc.fly(this.start, this.land, PEAK, POUNCE_TIME);
    // A life spent: the cracked heart over his head, MROW, and a puff where he crouched.
    this.hearts.pop(this.v1.copy(this.start).setY(2.3), 0.6, 1.2);
    this.word.show('MROW', this.v1.copy(this.start).setY(2.9), 1.0, 0.9);
    this.specks.ring(this.v1.copy(this.start).setY(0.15), 8, 3, 0.5, [CAT.foil, CAT.body], 0.1);
    this.shake = 0.06;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = false;
    this.arc.reset();
    this.specks.reset();
    this.hearts.reset();
    this.word.reset();
    this.prints.reset();
    (this.closing.material as THREE.MeshBasicMaterial).opacity = 0;
    this.pop.set(this.land, 0, 0);
    this.shock.set(this.land, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.arc.update(dt);
    this.specks.update(dt);
    this.hearts.update(dt);
    this.word.update(dt);
    this.prints.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (t >= DURATION && !this.arc.busy && !this.specks.busy && !this.word.busy && !this.hearts.busy && !this.prints.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The landing ring closes on the spot until he arrives. ---
    const cm = this.closing.material as THREE.MeshBasicMaterial;
    if (t < POUNCE_TIME) {
      const k = t / POUNCE_TIME;
      this.closing.position.set(this.zone.kind === 'circle' ? this.zone.x : 0, 0.07, this.zone.kind === 'circle' ? this.zone.z : 0);
      this.closing.scale.setScalar(Math.max(1e-4, POUNCE_RADIUS * (1 - k * 0.9)));
      cm.opacity = 0.9;
    } else cm.opacity = 0;

    if (!this.landed && t >= POUNCE_TIME) {
      this.landed = true;
      this.touchdown();
    }
    if (this.landed) {
      const a = t - POUNCE_TIME;
      const sp = StarBurst.pop(a, 0, 0.03);
      this.pop.set(this.v1.set(this.land.x, 1.0, this.land.z), 1.2 * sp.scale, sp.opacity, 0.2);
      const g = Math.min(1, a / 0.45);
      this.shock.set(this.v1.set(this.land.x, 0, this.land.z), 0.4 + 2.6 * g, 0.045 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * Math.exp(-dt * 10), 0.22 * Math.exp(-a * 9));
    }
  }

  /** He lands: the hit on live positions, dust, paw prints, a word. */
  private touchdown() {
    const ctx = this.ctx, s = this.settings;
    this.specks.ring(this.v1.set(this.land.x, 0.15, this.land.z), 14, 4.5, 0.7, [CAT.foil, CAT.body, CAT.clay], 0.14);
    this.specks.burst(this.v1.set(this.land.x, 0.5, this.land.z), 8, 3.2, 0.5, [CAT.core, CAT.body], 0.09, 1, 8);
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 0.35 : -0.35;
      this.prints.stamp(this.v1.set(this.land.x - this.dir.x * (1.4 - i * 0.35) - this.dir.z * side, 0, this.land.z - this.dir.z * (1.4 - i * 0.35) + this.dir.x * side), yaw, 0.9);
    }
    this.word.show('GOTCHA', this.v1.set(this.land.x, 2.4, this.land.z), 1.2, 1.0);
    if (!ctx) return;
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.zone, p.x, p.z)) continue;
      ctx.hit(e, { damage: s.damage, knock: s.knock, from: this.v1.set(this.land.x, 0, this.land.z), color: CAT_CSS.body });
    }
  }
}

export const pounceModule: EffectModule = {
  label: 'pounce',
  category: 'hero: cat',
  // A leap onto a spot: the radius is the landing circle the CPU uses to judge a catch.
  targeting: { mode: 'ground', radius: POUNCE_RADIUS },
  create: () => new Pounce(),
  telegraphs(effect) {
    const e = effect as Pounce;
    return e.ctx ? [{ shape: e.zone, start: 0, impact: POUNCE_TIME }] : [];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Pounce;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as Pounce).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
