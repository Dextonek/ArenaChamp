import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Confetti, ToyRing, ToyWords, TwinPuppet, TWINS, TWINS_CSS, ball } from '../../effects/parts/twins';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { TAG_HOLD, twinBookOf } from '../../traits/twins';

/**
 * Tag Out (twins kit, R: the swap). A readable half second: the twin who rides in the backpack pops out over the shoulder with a clear
 * flash (0.0 s: a star in his colour, a ring, a burst of confetti and the word TAG!), stands up on the pack and waves his arm. At about
 * 0.2 s the twin on the field raises a glove, and at 0.38 s the two hands slap together: a big spark, a ring and a shake (the high-five).
 * At 0.5 s (`TAG_HOLD`, the trait's hold) the swap itself happens in the trait: the figure changes under a second, bigger flash in the
 * incoming twin's colour with the words MY TURN, and the puppet shrinks away. Which twin comes out is read from the trait's book
 * (`twinBookOf`, the twin who is in now) when the effect starts, so the swap halfway does not change it. No damage, no zone. Clean by 1.5 s.
 * See pipeline/designs/kit-twins.md.
 */
export interface TagOutSettings {
  loop: boolean;
}

export const defaultTagOut = (): TagOutSettings => ({ loop: false });

const DURATION = 1.5;
const HIGH_FIVE = 0.38;
const easeBack = (x: number) => {
  const k = Math.min(1, Math.max(0, x)), c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};

export class TagOut implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TagOutSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { out: false, five: false, swap: false };
  private coming = 1;
  private from = new THREE.Vector3();
  private yaw = 0;

  private puppet = new TwinPuppet();
  private glove = ball(TWINS.glove, 0.11);
  private bits = new Confetti(60);
  private words = new ToyWords(3);
  private ring = new ToyRing(TWINS.yellow, 0.12);
  private ring2 = new ToyRing(TWINS.pom, 0.09);
  private flash = new StarBurst({ points: 10, inner: 0.32, color: TWINS.pom, core: 0xffffff, additive: false });
  private spark = new StarBurst({ points: 4, inner: 0.22, color: TWINS.yellow, core: 0xffffff, additive: false });
  private glint = new StarBurst({ points: 5, inner: 0.45, color: TWINS.pim, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: TagOutSettings = defaultTagOut()) {
    this.settings = settings;
    this.glove.visible = false;
    this.group.add(this.puppet.mesh, this.glove, this.bits.mesh, this.ring.mesh, this.ring2.mesh, this.words.mesh, this.flash.mesh, this.spark.mesh, this.glint.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return TAG_HOLD;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.yaw = ctx.caster.group.rotation.y;
  }

  play() {
    this.reset();
    this.playing = true;
    // The twin who is in now steps back; the other comes out. In the tool no trait has written a book, so Pim is in and Pom comes out.
    this.coming = 1 - (this.ctx ? twinBookOf(this.ctx.caster).twin : 0);
    this.flash.color.setHex(this.coming ? TWINS.pom : TWINS.pim);
    this.ring2.color.setHex(this.coming ? TWINS.pom : TWINS.pim);
    this.puppet.show(this.coming);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.out = this.flags.five = this.flags.swap = false;
    this.bits.reset();
    this.words.reset();
    this.puppet.hide();
    this.glove.visible = false;
    for (const s of [this.flash, this.spark, this.glint]) s.set(this.from, 0, 0);
    this.ring.set(this.from, 0, 0);
    this.ring2.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, f = this.flags, c = this.ctx?.caster.group.position;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    if (c) this.from.set(c.x, 0, c.z);
    const yaw = this.ctx ? this.ctx.caster.group.rotation.y : this.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const lightTint = this.coming ? TWINS_CSS.pom : TWINS_CSS.pim;

    // --- Pop out: a flash over the pack, the word, confetti; the twin stands up over the shoulder and waves. ---
    if (!f.out) {
      f.out = true;
      this.shake = 0.08;
      this.v1.set(this.from.x - fx * 0.5, 1.3, this.from.z - fz * 0.5);
      this.bits.pop(this.v1, 14, 3.5, 0.9, [this.coming ? TWINS.pom : TWINS.pim, TWINS.yellow, 0xffffff, TWINS.pink]);
      this.words.say('TAG!', this.v2.set(this.from.x, 0, this.from.z), 1.5, 0.75, lightTint, 2.45);
    }
    const out = Math.min(1, t / 0.2);
    const sw = f.swap ? 1 - Math.min(1, (t - TAG_HOLD) / 0.12) : 1;
    if (sw > 0.01) {
      const grow = easeBack(out);
      this.puppet.place(this.v1.set(this.from.x - fx * 0.5 + fz * 0.15, 0.85 + 0.55 * Math.min(1, out), this.from.z - fz * 0.5 - fx * 0.15), yaw + Math.PI * 0.08, Math.max(0.01, 0.62 * grow * sw));
      this.puppet.wave(THREE.MathUtils.smoothstep(t, 0.08, 0.3), t);
    } else this.puppet.hide();
    // The pop's flash at the pack: a big star that shrinks away fast, and a ring.
    {
      const sp = StarBurst.pop(t, 0.06, 0.2);
      this.flash.set(this.v1.set(this.from.x - fx * 0.5, 1.4, this.from.z - fz * 0.5), (f.swap ? 0 : 2.1) * sp.scale, sp.opacity, t * 3);
      const rp = Math.min(1, t / 0.35);
      this.ring.set(this.from, 0.4 + 1.3 * rp, 0.5 * (1 - rp) * (1 - rp));
    }

    // --- The high-five: the glove on the field flies up to meet the puppet's hand. ---
    if (t >= 0.15 && t < HIGH_FIVE + 0.1) {
      const k = THREE.MathUtils.clamp((t - 0.15) / (HIGH_FIVE - 0.15), 0, 1);
      const e = k * k * (3 - 2 * k);
      this.puppet.hand(this.v3, this.coming);
      this.v2.set(this.from.x + fx * 0.35 + fz * 0.5, 1.0, this.from.z + fz * 0.35 - fx * 0.5);
      this.glove.visible = true;
      this.glove.position.lerpVectors(this.v2, this.v3, e);
    } else if (t >= HIGH_FIVE + 0.1) this.glove.visible = false;
    if (!f.five && t >= HIGH_FIVE) {
      f.five = true;
      this.shake = 0.14;
      this.puppet.hand(this.v3, this.coming);
      this.bits.pop(this.v3, 12, 4, 1);
      this.words.say('SLAP', this.v2.set(this.v3.x, 0, this.v3.z), 1.0, 0.5, TWINS_CSS.yellow, 2.0);
    }
    if (f.five) {
      const a = t - HIGH_FIVE;
      const sp = StarBurst.pop(a, 0.05, 0.16);
      this.puppet.hand(this.v3, this.coming);
      this.spark.set(this.v3, 1.3 * sp.scale, sp.opacity, a * 4);
      this.glint.set(this.v1.copy(this.v3).setY(this.v3.y + 0.1), 0.8 * sp.scale, sp.opacity, -a * 5);
    }

    // --- The swap itself (in the trait) at TAG_HOLD: a bigger, clear flash in the incoming twin's colour, and MY TURN. ---
    if (!f.swap && t >= TAG_HOLD) {
      f.swap = true;
      this.shake = 0.2;
      this.bits.pop(this.v1.set(this.from.x, 1.2, this.from.z), 22, 6.5, 1.2, [this.coming ? TWINS.pom : TWINS.pim, TWINS.yellow, 0xffffff]);
      this.words.say('MY TURN', this.v2.set(this.from.x, 0, this.from.z), 2.1, 1.0, lightTint, 2.2);
    }
    if (f.swap) {
      const a = t - TAG_HOLD;
      const sp = StarBurst.pop(a, 0.07, 0.22);
      this.flash.set(this.v1.set(this.from.x, 1.2, this.from.z), 3.4 * sp.scale, sp.opacity, a * 3);
      const rp = THREE.MathUtils.clamp(a / 0.5, 0, 1);
      this.ring2.set(this.from, 0.5 + 2.4 * rp, 0.55 * (1 - rp) * (1 - rp));
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const tagOutModule: EffectModule = {
  label: 'tag out',
  category: 'hero: twins',
  // On himself, no area. (The CPU casts it when `aiHold` allows; the spell is flagged so the usual ultimate wait does not apply.)
  targeting: { mode: 'self', radius: 3 },
  create: () => new TagOut(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as TagOut;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as TagOut).settings;
    f.add(s, 'loop');
  },
};
