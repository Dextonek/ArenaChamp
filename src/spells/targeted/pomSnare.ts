import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Confetti, Dust, RopeNet, ToyRing, ToyWords, TWINS, TWINS_CSS } from '../../effects/parts/twins';
import { frameCast, type CastContext } from '../../effects/targeting';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import { SNARE_DAMAGE, SNARE_DELAY, SNARE_RADIUS, SNARE_RANGE, SNARE_ROOT } from '../../traits/twins';

/**
 * Snare (twins kit, Pom's W: a net). Pom swings a bundled net over her head and throws it up and out to a spot (7 m at most, the
 * aim clamped to that): it flies as a small bundle to above the spot (0.4 s), opens as it comes down and falls onto a 2 m circle,
 * landing flat at 1.0 s with a bounce of its weights, dust and confetti and the word GOTCHA. The circle is the telegraph, shown from
 * the cast. Whoever is inside it at 1.0 s on their live position takes 20 and is rooted 1 s: the net lies over them for that second
 * (a dark pool under it, blue weights round the rim) and then fades. The spot is built from `sentFrom` and the aim, so both screens
 * agree. Clean by about 2.6 s. See pipeline/designs/kit-twins.md.
 */
export interface PomSnareSettings {
  damage: number;
  root: number;
  loop: boolean;
}

export const defaultPomSnare = (): PomSnareSettings => ({ damage: SNARE_DAMAGE, root: SNARE_ROOT, loop: false });

const THROW = 0.4;
const DURATION = 2.7;
const HIGH = 4.2;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class PomSnare implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PomSnareSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  circle: TelegraphShape = { kind: 'circle', x: 0, z: 0, radius: SNARE_RADIUS };
  private time = 0;
  private landed = false;
  private spot = new THREE.Vector3();
  private from = new THREE.Vector3();

  private net = new RopeNet();
  private bits = new Confetti(34);
  private dust = new Dust(18);
  private words = new ToyWords(2);
  private ring = new ToyRing(TWINS.pom, 0.1);
  private star = new StarBurst({ points: 8, inner: 0.3, color: TWINS.pom, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();

  constructor(settings: PomSnareSettings = defaultPomSnare()) {
    this.settings = settings;
    this.group.add(this.bits.mesh, this.dust.mesh, this.ring.mesh, this.net.mesh, this.words.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SNARE_DELAY;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    this.v1.set(ctx.point.x - s.x, 0, ctx.point.z - s.z);
    const d = this.v1.length();
    if (d > SNARE_RANGE) this.v1.multiplyScalar(SNARE_RANGE / d);
    this.spot.set(s.x + this.v1.x, 0, s.z + this.v1.z);
    this.circle = { kind: 'circle', x: this.spot.x, z: this.spot.z, radius: SNARE_RADIUS };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = false;
    this.bits.reset();
    this.dust.reset();
    this.words.reset();
    this.net.place(this.spot, 0, 0, 0);
    this.star.set(this.spot, 0, 0);
    this.ring.set(this.spot, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    this.dust.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;
    if (t >= DURATION) {
      const loop = s.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The throw: a small bundle flies from her hand up to above the spot; then it opens and falls. ---
    if (t < SNARE_DELAY) {
      const k = Math.min(1, t / THROW);
      const x = THREE.MathUtils.lerp(this.from.x, this.spot.x, easeOut(k)), z = THREE.MathUtils.lerp(this.from.z, this.spot.z, easeOut(k));
      if (t < THROW) {
        // The bundle: a tiny net on an arc.
        const h = 1.2 + (HIGH - 1.2) * Math.sin(k * Math.PI * 0.5);
        this.net.place(this.v1.set(x, 0, z), h, 0.22 + 0.08 * k, 1);
        this.net.mesh.rotation.y = t * 12;
      } else {
        // It opens as it falls: wide, then onto the floor at the delay, with the shadow growing under it.
        const f = (t - THROW) / (SNARE_DELAY - THROW);
        this.net.mesh.rotation.y = 0;
        this.net.place(this.spot, HIGH * (1 - f * f), SNARE_RADIUS * (0.3 + 0.7 * easeOut(f * 1.4)), 1);
      }
    }

    // --- It lands: dust, confetti, a word; whoever is inside the circle is netted. ---
    if (!this.landed && t >= SNARE_DELAY) {
      this.landed = true;
      this.shake = 0.1;
      this.dust.ring(this.spot, SNARE_RADIUS * 0.8, 8, 0.7, 0xd9c9a8);
      this.bits.pop(this.v1.set(this.spot.x, 0.4, this.spot.z), 14, 4, 1, [TWINS.pom, TWINS.yellow, TWINS.rope, 0xffffff]);
      this.words.say('GOTCHA', this.v1.set(this.spot.x, 0, this.spot.z), 1.8, 1.0, TWINS_CSS.pom, 2.1);
      if (ctx) this.land(ctx);
    }
    if (this.landed) {
      const a = t - SNARE_DELAY;
      // A little bounce of the weights, then it lies there for the root and fades.
      const bounce = Math.exp(-a * 9) * Math.abs(Math.sin(a * 20)) * 0.25;
      const fade = 1 - THREE.MathUtils.smoothstep(a, s.root + 0.2, s.root + 0.7);
      this.net.place(this.spot, bounce, SNARE_RADIUS, fade);
      const sp = StarBurst.pop(a, 0.05, 0.16);
      this.star.set(this.v1.set(this.spot.x, 1.0, this.spot.z), 1.6 * sp.scale, sp.opacity, a * 5);
      const rp = THREE.MathUtils.clamp(a / 0.45, 0, 1);
      this.ring.set(this.spot, 0.5 + (SNARE_RADIUS - 0.2) * rp, 0.6 * (1 - rp) * (1 - rp));
    }
    this.shake *= Math.exp(-dt * 12);
  }

  /** The hits, on live positions inside the circle. */
  private land(ctx: CastContext) {
    const foes = ctx.enemies?.() ?? ctx.targets;
    for (const e of foes) {
      const p = e.group.position;
      if (!insideTelegraph(this.circle, p.x, p.z)) continue;
      ctx.hit(e, {
        damage: this.settings.damage, knock: 0, from: this.spot, color: TWINS_CSS.pom, status: { kind: 'root', seconds: this.settings.root },
      });
    }
  }
}

export const pomSnareModule: EffectModule = {
  label: 'snare',
  category: 'hero: twins',
  targeting: { mode: 'ground', radius: SNARE_RADIUS },
  create: () => new PomSnare(),
  telegraphs(effect) {
    const e = effect as PomSnare;
    if (!e.ctx) return [];
    return [{ shape: e.circle, start: 0, impact: SNARE_DELAY }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PomSnare;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as PomSnare).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 100, 1);
    f.add(s, 'root', 0.2, 1.5, 0.1);
  },
};
