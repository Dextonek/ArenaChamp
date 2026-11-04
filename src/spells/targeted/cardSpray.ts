import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BOLT_Y, Flyers, MAGIC, MAGIC_CSS, Pieces } from '../../effects/parts/magic';
import { boltWidth } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import { CARD_DAMAGE, CARD_FAN, CARD_RADIUS, CARD_RANGE, CARD_SPEED, CARD_WIND } from '../../traits/magic';

/**
 * Card Spray (magic kit, Q: three cards). The Great Zambini flicks his wrist: over the 0.3 s wind-up a fan of three playing cards
 * appears at his hand (gold stars fall from it) and at 0.3 s they leave as three real bolts (`ctx.projectile`: 8 m, 22 m/s, radius 0.3)
 * in a 24 degree fan (-12, 0 and +12 degrees from the aim). Each card spins as it flies and leaves a trail of confetti and gold
 * stars. 22 damage each; every card that hits bursts into a spray of confetti, stars and loose cards, and one that misses (or meets a
 * wall) pops into confetti. A card reaches 6 m at 0.57 s. Close up the three overlap into a wall; past 5 m a player can stand in a gap.
 *
 * Telegraph: three thin lines, one per card, as wide as the bolt really hits (`boltWidth`), from the cast to where the card ends
 * (shortened at a wall by `bankPath`, as the bolt is); `impact` is the launch (0.3 s), so it roots him until then. Network duels: bolts fly
 * on the victim's screen; the caster's screen draws the same three cards along the same lines. Clean by about 2.2 s.
 * See pipeline/designs/kit-magic.md.
 */
export interface CardSpraySettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultCardSpray = (): CardSpraySettings => ({ damage: CARD_DAMAGE, knock: 1.2, loop: false });

const MUZZLE = 0.8;
const LINE_W = boltWidth(CARD_RADIUS);
const MAX_T = 2.2;
const FAN = [-CARD_FAN / 2, 0, CARD_FAN / 2];
const LOOK = { hit: MAGIC_CSS.foil };

export class CardSpray implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CardSpraySettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** One thin line per card. */
  specs: TelegraphSpec[] = [];
  private time = 0;
  private fired = false;
  private ends = 0;
  private flash = { age: 9, pos: new THREE.Vector3(), size: 1 };

  private dirs: THREE.Vector3[] = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)];
  private starts: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private ranges = [CARD_RANGE, CARD_RANGE, CARD_RANGE];
  private hand = new THREE.Vector3();
  private origin = new THREE.Vector3();

  private confetti = new Pieces('confetti', 120);
  private stars = new Pieces('star', 50);
  private loose = new Pieces('card', 14, 9);
  private flyers = new Flyers('card', 3, this.stars);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: MAGIC.violet, core: MAGIC.hot, additive: false });

  private v1 = new THREE.Vector3();

  constructor(settings: CardSpraySettings = defaultCardSpray()) {
    this.settings = settings;
    this.group.add(this.confetti.mesh, this.stars.mesh, this.loose.mesh, this.flyers.group, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return CARD_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the three lines: only sentFrom, the aim point and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.origin.set(s.x, 0, s.z);
    this.specs = [];
    const obstacles = ctx.obstacles?.() ?? [];
    FAN.forEach((deg, i) => {
      const a = THREE.MathUtils.degToRad(deg), c = Math.cos(a), sn = Math.sin(a);
      const d = this.dirs[i].set(dx * c + dz * sn, 0, dz * c - dx * sn);
      this.starts[i].set(s.x + d.x * MUZZLE, 0, s.z + d.z * MUZZLE);
      const path = bankPath(this.starts[i], d, CARD_RANGE - MUZZLE, 0, obstacles);
      const e = path[path.length - 1];
      this.ranges[i] = Math.max(0.1, Math.hypot(e.x - this.starts[i].x, e.z - this.starts[i].z));
      this.specs.push({
        shape: { kind: 'line', x1: s.x, z1: s.z, x2: e.x, z2: e.z, width: LINE_W },
        start: 0,
        impact: CARD_WIND,
        until: CARD_WIND + (MUZZLE + this.ranges[i]) / CARD_SPEED,
      });
    });
    // His hand: a little ahead of him, at hand height.
    this.hand.set(s.x + dx * 0.7, 1.3, s.z + dz * 0.7);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.ends = 0;
    this.flash.age = 9;
    this.confetti.reset();
    this.stars.reset();
    this.loose.reset();
    this.flyers.reset();
    this.pop.set(this.hand, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.confetti.update(dt);
    this.stars.update(dt);
    this.loose.update(dt);
    this.flyers.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: three cards fan out of his hand, stars fall from it. ---
    if (t < CARD_WIND) {
      const k = THREE.MathUtils.smoothstep(t / CARD_WIND, 0, 1);
      for (let i = 0; i < 3; i++) {
        const side = (i - 1) * 0.28 * k;
        this.v1.set(this.hand.x - this.dirs[i].z * side * 0.4, this.hand.y + (i === 1 ? 0.05 : 0), this.hand.z + this.dirs[i].x * side * 0.4);
        this.flyers.show(i, this.v1, this.dirs[i], 0.4 + 0.6 * k, 6, t);
      }
      if (Math.random() < dt * 40) this.stars.burst(this.v1.copy(this.hand), 1, 0.8, { size: 0.16, life: 0.5, up: 0.1 });
    }

    // --- Fire: three real bolts (or, on the caster's screen online, three drawn along the same lines). ---
    if (!this.fired && t >= CARD_WIND) {
      this.fired = true;
      this.shake = 0.05;
      this.confetti.burst(this.v1.copy(this.hand), 10, 2.6, { size: 0.15, life: 0.8 });
      for (let i = 0; i < 3; i++) {
        const from = this.v1.set(this.starts[i].x, BOLT_Y, this.starts[i].z).clone();
        const bolt = ctx?.projectile?.({
          from, dir: this.dirs[i].clone(), speed: CARD_SPEED, range: this.ranges[i], radius: CARD_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: LOOK.hit },
        }) ?? null;
        this.flyers.launch(i, {
          bolt, from, dir: this.dirs[i], speed: CARD_SPEED, range: this.ranges[i],
          onEnd: (at, hit) => this.land(at, hit),
        });
      }
    }

    // --- The flash at a landing: a violet star that pops and shrinks. ---
    this.flash.age += dt;
    const sp = StarBurst.pop(this.flash.age, 0.04, 0.14);
    this.pop.set(this.flash.pos, this.flash.size * sp.scale, sp.opacity, this.flash.age * 4);
    this.shake *= Math.exp(-dt * 12);

    if (t >= MAX_T || (this.fired && this.ends >= 3 && !this.confetti.busy && !this.stars.busy && !this.loose.busy)) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  /** A card ends: a hit throws confetti, stars and loose cards; a miss or a wall only pops it into confetti. */
  private land(at: THREE.Vector3, hit: boolean) {
    this.ends++;
    this.flash.age = 0;
    this.flash.pos.copy(at);
    this.flash.size = hit ? 1.9 : 1.0;
    this.confetti.burst(at, hit ? 26 : 12, hit ? 5 : 3, { size: 0.16, life: 1.0 });
    this.stars.burst(at, hit ? 7 : 3, hit ? 4 : 2.4, { size: 0.24, life: 0.9, up: 1 });
    if (hit) {
      this.loose.burst(at, 3, 4.2, { size: 0.5, life: 1.0, up: 1.2 });
      this.shake = Math.max(this.shake, 0.12);
    }
  }
}

export const cardSprayModule: EffectModule = {
  label: 'card spray',
  category: 'hero: magic',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: CARD_RADIUS },
  create: () => new CardSpray(),
  telegraphs(effect) {
    const e = effect as CardSpray;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CardSpray;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as CardSpray).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
